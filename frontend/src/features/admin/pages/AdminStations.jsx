import { useEffect, useState, useMemo } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";
import StationCard from "../../../components/StationCard";

export default function AdminStations() {
    const [q, setQ] = useState(""); // UI-only for now (backend list doesn't support 'query')
    const [status, setStatus] = useState("all"); // all|pending|active|inactive|deleted
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // pagination via limit/offset (backend returns { pagination: { hasMore } })
    const LIMIT = 20;
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const [busyId, setBusyId] = useState(null);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    // Details modal state
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detail, setDetail] = useState(null); // { id, ...bunk }

    // Create modal state
    const [createOpen, setCreateOpen] = useState(false);

    // Map UI filter to backend query params
    const listParams = useMemo(() => {
        const p = {
            limit: LIMIT,
            offset,
            sortBy: "createdAt",
            sortOrder: "desc",
        };
        if (status !== "all") p.status = status; // backend supports: status
        return p;
    }, [status, offset]);

    async function load({ append = false } = {}) {
        try {
            setLoading(true);
            const res = await http.get("/admin/bunks", { params: listParams });
            // Controller returns { success, stations, bunks, pagination }
            const data = res.data || {};
            const list = Array.isArray(data) ? data : data.stations || data.bunks || [];
            const pg = data.pagination || {};
            setItems((prev) => (append ? [...prev, ...list] : list));
            setHasMore(!!pg.hasMore);
        } catch (err) {
            setToast({ open: true, type: "error", message: err?.response?.data?.error || err.message || "Failed to load stations" });
        } finally {
            setLoading(false);
        }
    }

    // Initial + filter change
    useEffect(() => {
        // reset paging when filter changes
        setOffset(0);
    }, [status]);

    useEffect(() => {
        load({ append: offset > 0 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset, status]);

    function getId(s) {
        return s.id || s._id;
    }

    // ---- Details ----
    async function viewDetails(station) {
        const id = getId(station);
        if (!id) return;
        try {
            setDetailLoading(true);
            setDetailOpen(true);
            setDetail(null);
            const res = await http.get(`/admin/bunks/${encodeURIComponent(id)}`);
            // Route returns { success, bunk: { id, ... } }
            const data = res.data || {};
            const bunk = data.bunk || null;
            setDetail(bunk);
        } catch (err) {
            setToast({ open: true, type: "error", message: err?.response?.data?.error || err.message || "Failed to fetch details" });
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    }

    function closeDetails() {
        setDetailOpen(false);
        setDetail(null);
    }

    // ---- Actions ----

    // Approve / Reject (no explicit endpoints; use PATCH fields)
    async function approve(station, approve = true) {
        const id = getId(station);
        if (!id) return;
        try {
            setBusyId(id);
            // Convention: approve => approved:true + status:active | reject => approved:false + status:inactive
            const body = approve ? { approved: true, status: "active" } : { approved: false, status: "inactive" };
            const res = await http.patch(`/admin/bunks/${encodeURIComponent(id)}`, body);
            const updated = (res.data && (res.data.station || res.data)) || {};
            setItems((prev) => prev.map((s) => (getId(s) === id ? { ...s, ...updated } : s)));
            setToast({ open: true, type: "success", message: approve ? "Approved" : "Rejected" });
        } catch (err) {
            setToast({ open: true, type: "error", message: err?.response?.data?.error || err.message || "Action failed" });
        } finally {
            setBusyId(null);
        }
    }

    // Activate / Deactivate -> uses 'status' field from backend
    async function toggleActive(station) {
        const id = getId(station);
        if (!id) return;
        try {
            setBusyId(id);
            const nextStatus = station.status === "active" ? "inactive" : "active";
            const res = await http.patch(`/admin/bunks/${encodeURIComponent(id)}`, { status: nextStatus });
            const updated = (res.data && (res.data.station || res.data)) || {};
            setItems((prev) => prev.map((s) => (getId(s) === id ? { ...s, ...updated } : s)));
            setToast({ open: true, type: "success", message: nextStatus === "active" ? "Activated" : "Deactivated" });
        } catch (err) {
            setToast({ open: true, type: "error", message: err?.response?.data?.error || err.message || "Update failed" });
        } finally {
            setBusyId(null);
        }
    }

    // Feature / Unfeature
    async function toggleFeatured(station) {
        const id = getId(station);
        if (!id) return;
        try {
            setBusyId(id);
            const next = !Boolean(station.featured);
            const res = await http.patch(`/admin/bunks/${encodeURIComponent(id)}/featured`, { featured: next });
            const updated = (res.data && (res.data.station || res.data)) || {};
            setItems((prev) => prev.map((s) => (getId(s) === id ? { ...s, featured: next, ...updated } : s)));
            setToast({ open: true, type: "success", message: next ? "Marked as featured" : "Removed from featured" });
        } catch (err) {
            // Back-compat if server only has /feature
            try {
                const next = !Boolean(station.featured);
                const res2 = await http.patch(`/admin/bunks/${encodeURIComponent(id)}/feature`, { featured: next });
                const updated2 = (res2.data && (res2.data.station || res2.data)) || {};
                setItems((prev) => prev.map((s) => (getId(s) === id ? { ...s, featured: next, ...updated2 } : s)));
                setToast({ open: true, type: "success", message: next ? "Marked as featured" : "Removed from featured" });
            } catch (err2) {
                setToast({ open: true, type: "error", message: err2?.response?.data?.error || err2.message || "Feature update failed" });
            }
        } finally {
            setBusyId(null);
        }
    }

    // Delete (soft by default)
    async function removeStation(station) {
        const id = getId(station);
        if (!id) return;
        if (!confirm("Delete this station? This marks it as deleted.")) return;
        try {
            setBusyId(id);
            await http.delete(`/admin/bunks/${encodeURIComponent(id)}`); // soft delete per controller
            setItems((prev) => prev.filter((s) => getId(s) !== id));
            setToast({ open: true, type: "success", message: "Station deleted" });
        } catch (err) {
            setToast({ open: true, type: "error", message: err?.response?.data?.error || err.message || "Delete failed" });
        } finally {
            setBusyId(null);
        }
    }

    // Manual reload (resets to first page)
    async function applyFilters() {
        setOffset(0);
        await load({ append: false });
    }

    // Load more
    function loadMore() {
        if (hasMore && !loading) setOffset((o) => o + LIMIT);
    }

    // ---- Create ----
    function openCreate() {
        setCreateOpen(true);
    }
    function closeCreate() {
        setCreateOpen(false);
    }
    function onCreated(newStation) {
        // Put newly created station at the top
        setItems((prev) => [{ id: newStation.id, ...newStation.station }, ...prev]);
    }

    return (
        <div className="page" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <h1>Admin · Stations</h1>
                <button className="btn-primary" onClick={openCreate}>+ New Station</button>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <input
                    type="search"
                    placeholder="Search by name or address… (UI only)"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    style={{ minWidth: 280 }}
                />
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="all">All</option>
                    <option value="pending">Pending review</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="deleted">Deleted</option>
                </select>
                <button onClick={applyFilters} disabled={loading}>
                    {loading ? <Spinner size={16} /> : "Apply"}
                </button>
            </div>

            {/* List */}
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {loading && items.length === 0 ? (
                    <div className="card" style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
                        <Spinner /> <span>Loading…</span>
                    </div>
                ) : items.length === 0 ? (
                    <div className="card" style={{ padding: 16 }}>No stations found.</div>
                ) : (
                    items.map((s) => {
                        const id = getId(s);
                        const pending = s.status === "pending" || s.reviewed === false || s.approved === false;
                        const isActive = s.status === "active";
                        const isFeatured = Boolean(s.featured);
                        return (
                            <div key={id} className="card" style={{ padding: 12 }}>
                                <StationCard
                                    station={s}
                                    compact
                                    actions={
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            <button
                                                onClick={() => viewDetails(s)}
                                                disabled={busyId === id}
                                                className="btn-secondary"
                                                title="View details"
                                            >
                                                View
                                            </button>

                                            {pending && (
                                                <>
                                                    <button
                                                        onClick={() => approve(s, true)}
                                                        disabled={busyId === id}
                                                        className="btn-primary"
                                                        title="Approve"
                                                    >
                                                        {busyId === id ? <Spinner size={14} /> : "Approve"}
                                                    </button>
                                                    <button
                                                        onClick={() => approve(s, false)}
                                                        disabled={busyId === id}
                                                        className="btn-secondary"
                                                        title="Reject"
                                                    >
                                                        {busyId === id ? <Spinner size={14} /> : "Reject"}
                                                    </button>
                                                </>
                                            )}

                                            <button
                                                onClick={() => toggleActive(s)}
                                                disabled={busyId === id}
                                                className="btn-secondary"
                                                title={isActive ? "Deactivate" : "Activate"}
                                            >
                                                {busyId === id ? <Spinner size={14} /> : isActive ? "Deactivate" : "Activate"}
                                            </button>

                                            <button
                                                onClick={() => toggleFeatured(s)}
                                                disabled={busyId === id}
                                                className="btn-secondary"
                                                title={isFeatured ? "Unfeature" : "Feature"}
                                            >
                                                {busyId === id ? <Spinner size={14} /> : isFeatured ? "Unfeature" : "Feature"}
                                            </button>

                                            <button
                                                onClick={() => removeStation(s)}
                                                disabled={busyId === id}
                                                className="btn-danger"
                                                title="Delete"
                                            >
                                                {busyId === id ? <Spinner size={14} /> : "Delete"}
                                            </button>
                                        </div>
                                    }
                                />
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            {hasMore && (
                <div style={{ marginTop: 12 }}>
                    <button onClick={loadMore} disabled={loading}>
                        {loading ? <Spinner size={16} /> : "Load more"}
                    </button>
                </div>
            )}

            {/* Details Drawer / Modal */}
            {detailOpen && (
                <DetailsModal
                    loading={detailLoading}
                    data={detail}
                    onClose={closeDetails}
                />
            )}

            {/* Create Drawer / Modal */}
            {createOpen && (
                <CreateStationModal
                    onClose={closeCreate}
                    onCreated={(payload) => {
                        onCreated(payload);
                        setToast({ open: true, type: "success", message: "Station created successfully" });
                    }}
                    onError={(msg) => setToast({ open: true, type: "error", message: msg })}
                />
            )}

            {toast.open && (
                <Toast type={toast.type} onClose={onCloseToast}>
                    {toast.message}
                </Toast>
            )}
        </div>
    );
}

/* ---------------------------
   Details Modal Component
----------------------------*/
function DetailsModal({ loading, data, onClose }) {
    const d = data || {};
    const loc = d.location || {};
    const pricing = d.pricing || {};
    const connectors = Array.isArray(d.connectors) ? d.connectors : [];
    const amenities = Array.isArray(d.amenities) ? d.amenities : [];

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                justifyContent: "flex-end",
                zIndex: 50,
            }}
            onClick={(e) => {
                // close when clicking the dark backdrop
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                style={{
                    width: "min(560px, 95vw)",
                    height: "100%",
                    background: "#fff",
                    padding: 20,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                    overflowY: "auto",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <h2 style={{ margin: 0 }}>Station details</h2>
                    <button className="btn-secondary" onClick={onClose} aria-label="Close details">
                        Close
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16 }}>
                        <Spinner /> <span>Loading details…</span>
                    </div>
                ) : !data ? (
                    <div className="muted" style={{ padding: 16 }}>
                        Not found.
                    </div>
                ) : (
                    <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
                        <KV label="ID" value={d.id} />
                        <KV label="Name" value={d.name} />
                        <KV label="Address" value={d.address} />
                        <KV label="Phone" value={d.phone || "—"} />
                        <KV label="Owner ID" value={d.ownerId || "—"} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <KV label="Status" value={d.status} pill />
                            <KV label="Approved" value={String(d.approved ?? true)} pill />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <KV label="Featured" value={String(!!d.featured)} pill />
                            <KV label="Provider" value={d.provider || "Independent"} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <KV label="Slots" value={String(d.slots ?? 0)} />
                            <KV label="Operating hours" value={d.operatingHours || "24/7"} />
                        </div>

                        <section style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
                            <h3 style={{ margin: "4px 0 8px" }}>Location</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <KV label="Latitude" value={String(loc.lat ?? "—")} />
                                <KV label="Longitude" value={String(loc.lng ?? "—")} />
                            </div>
                        </section>

                        <section style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
                            <h3 style={{ margin: "4px 0 8px" }}>Pricing</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <KV label="Per kWh" value={formatMoney(pricing.perKwh)} />
                                <KV label="Flat fee" value={formatMoney(pricing.flat || 0)} />
                            </div>
                        </section>

                        <section style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
                            <h3 style={{ margin: "4px 0 8px" }}>Connectors</h3>
                            {connectors.length === 0 ? (
                                <div className="muted">—</div>
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: 18 }}>
                                    {connectors.map((c, i) => (
                                        <li key={i}>
                                            {typeof c === "string" ? c : `${c.type || "Type"} • ${c.power || ""}`.trim()}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
                            <h3 style={{ margin: "4px 0 8px" }}>Amenities</h3>
                            {amenities.length === 0 ? (
                                <div className="muted">—</div>
                            ) : (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {amenities.map((a, i) => (
                                        <span key={i} style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(0,0,0,0.06)" }}>
                                            {String(a)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
                            <h3 style={{ margin: "4px 0 8px" }}>Timestamps</h3>
                            <KV label="Created" value={fmtTs(d.createdAt)} />
                            <KV label="Updated" value={fmtTs(d.updatedAt)} />
                            {d.deletedAt && <KV label="Deleted" value={fmtTs(d.deletedAt)} />}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ---------------------------
   Create Station Modal
----------------------------*/
function CreateStationModal({ onClose, onCreated, onError }) {
    const [form, setForm] = useState({
        name: "",
        address: "",
        phone: "",
        lat: "",
        lng: "",
        slots: 0,
        perKwh: 0,
        flat: 0,
        amenities: "",
        connectors: "",
        operatingHours: "24/7",
        status: "active", // active|inactive|pending
        provider: "Independent",
        ownerId: "",
    });
    const [submitting, setSubmitting] = useState(false);

    function setField(k, v) {
        setForm((f) => ({ ...f, [k]: v }));
    }

    async function submit(e) {
        e.preventDefault();
        // basic validation (backend will validate as well)
        if (!form.name.trim()) return onError?.("Name is required");
        if (form.lat === "" || form.lng === "") return onError?.("Latitude and Longitude are required");

        try {
            setSubmitting(true);

            // Build payload as expected by your route
            const payload = {
                name: form.name.trim(),
                address: form.address.trim(),
                phone: form.phone.trim() || null,
                location: { lat: Number(form.lat), lng: Number(form.lng) },
                slots: Number(form.slots || 0),
                pricing: { perKwh: Number(form.perKwh || 0), flat: Number(form.flat || 0) },
                amenities: splitCsv(form.amenities),
                operatingHours: form.operatingHours || "24/7",
                status: form.status || "active",
                provider: form.provider || "Independent",
                connectors: splitCsv(form.connectors),
                ownerId: form.ownerId.trim() || undefined,
            };

            const res = await http.post("/admin/bunks", payload);
            const data = res.data || {};
            // data shape from controller: { success, id, station, message }
            onCreated?.({ id: data.id, station: { id: data.id, ...data.station } });
            onClose?.();
        } catch (err) {
            onError?.(err?.response?.data?.error || err.message || "Create failed");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                justifyContent: "flex-end",
                zIndex: 60,
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <form
                onSubmit={submit}
                style={{
                    width: "min(640px, 95vw)",
                    height: "100%",
                    background: "#fff",
                    padding: 20,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                    overflowY: "auto",
                    display: "grid",
                    gap: 12,
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <h2 style={{ margin: 0 }}>Create new station</h2>
                    <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
                </div>

                <div className="grid" style={{ display: "grid", gap: 10 }}>
                    <L label="Name *">
                        <input value={form.name} onChange={(e) => setField("name", e.target.value)} required />
                    </L>

                    <L label="Address">
                        <input value={form.address} onChange={(e) => setField("address", e.target.value)} />
                    </L>

                    <L label="Phone">
                        <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
                    </L>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <L label="Latitude *">
                            <input type="number" step="any" value={form.lat} onChange={(e) => setField("lat", e.target.value)} required />
                        </L>
                        <L label="Longitude *">
                            <input type="number" step="any" value={form.lng} onChange={(e) => setField("lng", e.target.value)} required />
                        </L>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <L label="Slots">
                            <input type="number" min="0" value={form.slots} onChange={(e) => setField("slots", e.target.value)} />
                        </L>
                        <L label="Operating hours">
                            <input value={form.operatingHours} onChange={(e) => setField("operatingHours", e.target.value)} placeholder="24/7" />
                        </L>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <L label="Price / kWh">
                            <input type="number" step="0.01" min="0" value={form.perKwh} onChange={(e) => setField("perKwh", e.target.value)} />
                        </L>
                        <L label="Flat fee">
                            <input type="number" step="0.01" min="0" value={form.flat} onChange={(e) => setField("flat", e.target.value)} />
                        </L>
                    </div>

                    <L label="Amenities (comma separated)">
                        <input value={form.amenities} onChange={(e) => setField("amenities", e.target.value)} placeholder="Restroom, Café, Parking" />
                    </L>

                    <L label="Connectors (comma separated)">
                        <input value={form.connectors} onChange={(e) => setField("connectors", e.target.value)} placeholder="CCS2, Type2, CHAdeMO" />
                    </L>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <L label="Status">
                            <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending</option>
                            </select>
                        </L>
                        <L label="Provider">
                            <input value={form.provider} onChange={(e) => setField("provider", e.target.value)} placeholder="Independent" />
                        </L>
                    </div>

                    <L label="Owner ID (optional)">
                        <input value={form.ownerId} onChange={(e) => setField("ownerId", e.target.value)} placeholder="owner uid (optional)" />
                    </L>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={submitting}>
                        {submitting ? <Spinner size={14} /> : "Create"}
                    </button>
                </div>
            </form>
        </div>
    );
}

/* ---------------------------
   Small UI helpers
----------------------------*/
function L({ label, children }) {
    return (
        <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>{label}</span>
            {children}
        </label>
    );
}

function KV({ label, value, pill = false }) {
    const isTruthy = ["true", "active", "yes"].includes(String(value).toLowerCase());
    const bg =
        pill && isTruthy ? "rgba(4, 120, 87, 0.12)" :
            pill && !isTruthy ? "rgba(220, 38, 38, 0.12)" :
                "transparent";
    const color =
        pill && isTruthy ? "#065f46" :
            pill && !isTruthy ? "#991b1b" :
                "inherit";

    return (
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 10 }}>
            <div className="muted" style={{ fontSize: 12 }}>{label}</div>
            <div style={{ padding: pill ? "2px 8px" : 0, borderRadius: pill ? 999 : 0, background: bg, color }}>
                {isEmpty(value) ? "—" : String(value)}
            </div>
        </div>
    );
}

function isEmpty(v) {
    return v === undefined || v === null || String(v).trim() === "";
}

function splitCsv(s) {
    if (!s) return [];
    return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
}

function formatMoney(n) {
    const num = Number(n || 0);
    if (!Number.isFinite(num)) return "—";
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(num);
}

// Firestore timestamps or ISO/string/number tolerant
function fmtTs(t) {
    if (!t) return "—";
    try {
        // Firestore Timestamp support
        if (typeof t === "object" && t.seconds) {
            return new Date(t.seconds * 1000).toLocaleString();
        }
        const d = typeof t === "string" || typeof t === "number" ? new Date(t) : new Date(t);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleString();
    } catch {
        return "—";
    }
}
