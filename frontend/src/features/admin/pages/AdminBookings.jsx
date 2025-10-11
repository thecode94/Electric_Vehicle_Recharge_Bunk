// src/features/admin/pages/AdminBookings.jsx
import { useEffect, useMemo, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function AdminBookings() {
    const [q, setQ] = useState("");
    const [status, setStatus] = useState("all");
    const [from, setFrom] = useState(() => toInput(new Date(Date.now() - 7 * 864e5)));
    const [to, setTo] = useState(() => toInput(new Date()));
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    const query = useMemo(
        () => ({
            query: q || undefined,
            status: status === "all" ? undefined : status,
            from: from ? new Date(from).toISOString() : undefined,
            to: to ? new Date(to).toISOString() : undefined,
        }),
        [q, status, from, to]
    );

    async function load() {
        try {
            setLoading(true);
            const res = await http.get("/admin/bookings", {
                params: { ...query, limit: 50 },
            });
            const data = res.data || {};
            const list = Array.isArray(data) ? data : data.bookings || data.items || [];
            setItems(list);
        } catch (err) {
            setToast({ open: true, type: "error", message: err.message || "Failed to load bookings" });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    return (
        <div className="page" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
            <h1>Admin · Bookings</h1>

            {/* Filters */}
            <div className="card" style={{ padding: 12, display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto", gap: 8 }}>
                <input
                    type="search"
                    placeholder="Search booking/user/station…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && load()}
                />
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {["all", "pending", "confirmed", "completed", "cancelled", "failed", "refunded"].map((s) => (
                        <option key={s} value={s}>{capitalize(s)}</option>
                    ))}
                </select>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                <button onClick={() => load()} disabled={loading}>
                    {loading ? <Spinner size={16} /> : "Apply"}
                </button>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, marginTop: 12 }}>
                {loading && items.length === 0 ? (
                    <div style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
                        <Spinner /> <span>Loading…</span>
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ padding: 16 }} className="muted">No bookings found.</div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ textAlign: "left" }}>
                                <th style={{ padding: "10px 16px" }}>ID</th>
                                <th style={{ padding: "10px 16px" }}>User</th>
                                <th style={{ padding: "10px 16px" }}>Station</th>
                                <th style={{ padding: "10px 16px" }}>Start</th>
                                <th style={{ padding: "10px 16px" }}>Duration</th>
                                <th style={{ padding: "10px 16px" }}>Amount</th>
                                <th style={{ padding: "10px 16px" }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((b, i) => {
                                const id = b.id || b._id;
                                const user = b.user?.email || b.userEmail || b.user?.name || "-";
                                const station = b.station?.name || b.stationName || "-";
                                const when = b.startTime ? new Date(b.startTime).toLocaleString() : "-";
                                const dur = (b.durationMins || b.duration || 0) + "m";
                                const amt = fmtMoney(b.amount || b.total || 0, b.currency || "INR");
                                const st = b.status || b.paymentStatus || "pending";
                                return (
                                    <tr key={id || i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                        <td style={{ padding: "10px 16px", fontFamily: "monospace" }}>{id}</td>
                                        <td style={{ padding: "10px 16px" }}>{user}</td>
                                        <td style={{ padding: "10px 16px" }}>{station}</td>
                                        <td style={{ padding: "10px 16px" }}>{when}</td>
                                        <td style={{ padding: "10px 16px" }}>{dur}</td>
                                        <td style={{ padding: "10px 16px" }}>{amt}</td>
                                        <td style={{ padding: "10px 16px", textTransform: "capitalize" }}>{st}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {toast.open && (
                <Toast type={toast.type} onClose={onCloseToast}>
                    {toast.message}
                </Toast>
            )}
        </div>
    );
}

/* helpers */
function toInput(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}
function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
function fmtMoney(n, currency = "INR") {
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n || 0);
    } catch {
        return `₹ ${Number(n || 0).toLocaleString()}`;
    }
}
