import { useEffect, useMemo, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function AdminUsers() {
    const [q, setQ] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");     // all|user|owner|admin
    const [statusFilter, setStatusFilter] = useState("all"); // all|active|inactive|banned|pending
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // pagination: limit/offset (controller returns { users, count })
    const LIMIT = 20;
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const [busyId, setBusyId] = useState(null);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    // backend query params
    const listParams = useMemo(() => {
        const p = { limit: LIMIT, offset };
        if (roleFilter !== "all") p.role = roleFilter;
        if (statusFilter !== "all") p.status = statusFilter;
        return p;
    }, [roleFilter, statusFilter, offset]);

    async function load({ append = false } = {}) {
        try {
            setLoading(true);
            const res = await http.get("/admin/users", { params: listParams });
            const data = res.data || {};
            const users = Array.isArray(data) ? data : data.users || [];
            const got = users.length;
            setItems((prev) => (append ? [...prev, ...users] : users));
            setHasMore(got === LIMIT); // naive hasMore using page size
        } catch (err) {
            setToast({ open: true, type: "error", message: err?.response?.data?.error || err.message || "Failed to load users" });
        } finally {
            setLoading(false);
        }
    }

    // reset paging on filter change
    useEffect(() => {
        setOffset(0);
    }, [roleFilter, statusFilter]);

    // fetch on paging/filter change
    useEffect(() => {
        load({ append: offset > 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset, roleFilter, statusFilter]);

    function getId(u) {
        return u.id || u._id;
    }

    // ---- Actions ----

    async function toggleActive(u) {
        const id = getId(u);
        if (!id) return;
        try {
            setBusyId(id);
            const currentStatus = (u.status || (u.active === false ? "inactive" : "active")).toLowerCase();
            const nextStatus = currentStatus === "active" ? "inactive" : "active";
            await http.patch(`/admin/users/${encodeURIComponent(id)}`, { status: nextStatus });
            setItems((prev) => prev.map((x) => (getId(x) === id ? { ...x, status: nextStatus, active: nextStatus === "active" } : x)));
            setToast({ open: true, type: "success", message: nextStatus === "active" ? "User activated" : "User deactivated" });
        } catch (err) {
            setToast({ open: true, type: "error", message: err?.response?.data?.error || err.message || "Update failed" });
        } finally {
            setBusyId(null);
        }
    }

    async function makeRole(u, role) {
        const id = getId(u);
        if (!id) return;
        try {
            setBusyId(id);
            await http.patch(`/admin/users/${encodeURIComponent(id)}`, { role });
            setItems((prev) => prev.map((x) => (getId(x) === id ? { ...x, role } : x)));
            setToast({ open: true, type: "success", message: `Role set to ${role}` });
        } catch (err) {
            setToast({ open: true, type: "error", message: err?.response?.data?.error || err.message || "Role update failed" });
        } finally {
            setBusyId(null);
        }
    }

    async function banUser(u) {
        const id = getId(u);
        if (!id) return;
        if (!confirm("Ban this user?")) return;
        try {
            setBusyId(id);
            await http.post(`/admin/users/${encodeURIComponent(id)}/ban`, { reason: "Policy violation" });
            setItems((prev) => prev.map((x) => (getId(x) === id ? { ...x, status: "banned", active: false } : x)));
            setToast({ open: true, type: "success", message: "User banned" });
        } catch (err) {
            setToast({ open: true, type: "error", message: err?.response?.data?.error || err.message || "Ban failed" });
        } finally {
            setBusyId(null);
        }
    }

    // client-side quick filter for q (name/email)
    const filtered = useMemo(() => {
        if (!q.trim()) return items;
        const s = q.trim().toLowerCase();
        return items.filter((u) => {
            const name = String(u.name || u.fullName || "").toLowerCase();
            const email = String(u.email || "").toLowerCase();
            return name.includes(s) || email.includes(s);
        });
    }, [items, q]);

    function loadMore() {
        if (hasMore && !loading) setOffset((o) => o + LIMIT);
    }

    return (
        <div className="page" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
            <h1>Admin · Users</h1>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <input
                    type="search"
                    placeholder="Search by name or email… (client-side)"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && load({})}
                    style={{ minWidth: 280 }}
                />
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="all">All roles</option>
                    <option value="user">User</option>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                    <option value="banned">Banned</option>
                </select>
                <button onClick={() => { setOffset(0); load({ append: false }); }} disabled={loading}>
                    {loading ? <Spinner size={16} /> : "Apply"}
                </button>
            </div>

            <div className="card" style={{ padding: 0, marginTop: 12 }}>
                {loading && items.length === 0 ? (
                    <div style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
                        <Spinner /> <span>Loading…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 16 }} className="muted">No users found.</div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ textAlign: "left" }}>
                                <th style={{ padding: "10px 16px" }}>Name</th>
                                <th style={{ padding: "10px 16px" }}>Email</th>
                                <th style={{ padding: "10px 16px" }}>Role</th>
                                <th style={{ padding: "10px 16px" }}>Status</th>
                                <th style={{ padding: "10px 16px" }}>Joined</th>
                                <th style={{ padding: "10px 16px" }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((u, i) => {
                                const id = getId(u);
                                const name = u.name || u.fullName || "-";
                                const email = u.email || "-";
                                const role = (u.role || u.type || "user").toLowerCase();
                                const status = (u.status || (u.active === false ? "inactive" : "active")).toLowerCase();
                                const joined =
                                    u.createdAt
                                        ? (typeof u.createdAt === "string" ? new Date(u.createdAt) : new Date(u.createdAt))
                                            .toLocaleString()
                                        : "-";

                                return (
                                    <tr key={id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>{name}</td>
                                        <td style={{ padding: "10px 16px" }}>{email}</td>
                                        <td style={{ padding: "10px 16px", textTransform: "capitalize" }}>{role}</td>
                                        <td style={{ padding: "10px 16px" }}>
                                            <span
                                                className="small"
                                                style={{
                                                    padding: "2px 8px",
                                                    borderRadius: 999,
                                                    background:
                                                        status === "active" ? "rgba(4, 120, 87, 0.12)" :
                                                            status === "banned" ? "rgba(220, 38, 38, 0.12)" :
                                                                "rgba(30, 64, 175, 0.12)",
                                                    color:
                                                        status === "active" ? "#065f46" :
                                                            status === "banned" ? "#991b1b" :
                                                                "#1e40af",
                                                }}
                                            >
                                                {status}
                                            </span>
                                        </td>
                                        <td style={{ padding: "10px 16px" }}>{joined}</td>
                                        <td style={{ padding: "10px 16px" }}>
                                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                                <button
                                                    onClick={() => toggleActive(u)}
                                                    disabled={busyId === id || status === "banned"}
                                                    className="btn-secondary"
                                                    title={status === "active" ? "Deactivate" : "Activate"}
                                                >
                                                    {busyId === id ? <Spinner size={14} /> : status === "active" ? "Deactivate" : "Activate"}
                                                </button>

                                                <RoleMenu u={u} set={(r) => makeRole(u, r)} busy={busyId === id} />

                                                <button
                                                    onClick={() => banUser(u)}
                                                    disabled={busyId === id || status === "banned"}
                                                    className="btn-danger"
                                                    title="Ban user"
                                                >
                                                    {busyId === id ? <Spinner size={14} /> : "Ban"}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {hasMore && (
                <div style={{ marginTop: 12 }}>
                    <button onClick={loadMore} disabled={loading}>
                        {loading ? <Spinner size={16} /> : "Load more"}
                    </button>
                </div>
            )}

            {toast.open && (
                <Toast type={toast.type} onClose={onCloseToast}>
                    {toast.message}
                </Toast>
            )}
        </div>
    );
}

function RoleMenu({ u, set, busy }) {
    const current = (u.role || u.type || "user").toLowerCase();
    const roles = ["user", "owner", "admin"];
    return (
        <div style={{ position: "relative" }}>
            <select
                value={current}
                onChange={(e) => set(e.target.value)}
                disabled={busy}
                style={{ padding: "8px 10px", borderRadius: 8 }}
                aria-label="Change role"
            >
                {roles.map((r) => (
                    <option key={r} value={r}>
                        {r}
                    </option>
                ))}
            </select>
        </div>
    );
}
