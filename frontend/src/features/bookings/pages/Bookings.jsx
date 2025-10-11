// src/features/bookings/pages/Bookings.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";
import { listMyBookings } from "../../../services/bookingService";
import { startCheckout } from "../../../services/paymentService";

const clean = (o) =>
    Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export default function Bookings() {
    const [items, setItems] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    async function loadMore(next) {
        try {
            setLoading(true);
            const data = await listMyBookings(clean({ cursor: next }));
            const list = Array.isArray(data) ? data : data.items || [];
            const nextCursor = Array.isArray(data) ? null : data.nextCursor || null;

            setItems((prev) => (next ? [...prev, ...list] : list));
            setCursor(nextCursor);
        } catch (err) {
            setToast({
                open: true,
                type: "error",
                message: err?.response?.data?.message || err?.message || "Failed to load bookings",
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadMore(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onPay = async (booking) => {
        try {
            // If API already returned a URL, use it, else start a fresh checkout
            if (booking?.paymentUrl) {
                window.location.assign(booking.paymentUrl);
                return;
            }
            const id = booking?.id || booking?._id;
            if (!id) throw new Error("Missing booking id");
            const pay = await startCheckout(id);
            if (pay?.paymentUrl) {
                window.location.assign(pay.paymentUrl);
            } else {
                setToast({ open: true, type: "error", message: "No payment URL returned" });
            }
        } catch (e) {
            setToast({ open: true, type: "error", message: e?.message || "Payment start failed" });
        }
    };

    return (
        <div className="page" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
            <h1>My Bookings</h1>

            <div className="card" style={{ padding: 0, marginTop: 12 }}>
                {loading && items.length === 0 ? (
                    <div style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
                        <Spinner /> <span>Loading…</span>
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ padding: 16 }}>
                        <div className="muted">No bookings yet.</div>
                        <div style={{ marginTop: 8 }}>
                            <Link to="/search" className="btn-primary">Find a station</Link>
                        </div>
                    </div>
                ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {items.map((b, i) => {
                            const id = b.id || b._id || `b${i}`;
                            const st = b.station || {};
                            const name = st.name || st.title || b.stationName || "Station";
                            const addr = st.address || b.stationAddress || "";
                            const start = b.startTime || b.start || b.createdAt;
                            const when = start ? new Date(start).toLocaleString() : "-";
                            const status = (b.status || "pending").toLowerCase();

                            const showPay = status === "pending" || status === "awaiting_payment";

                            return (
                                <li
                                    key={id}
                                    style={{
                                        padding: "12px 16px",
                                        borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                                        display: "grid",
                                        gridTemplateColumns: "1fr auto",
                                        gap: 12,
                                        alignItems: "center",
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{name}</div>
                                        {addr && <div className="muted small">{addr}</div>}
                                        <div className="muted small">When: {when}</div>
                                        <div className="muted small">Status: {status}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <Link to={`/booking/${encodeURIComponent(id)}`} className="btn-secondary">
                                            View
                                        </Link>
                                        {showPay && (
                                            <button onClick={() => onPay(b)} className="btn-primary">
                                                Pay
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {cursor && (
                <div style={{ marginTop: 12 }}>
                    <button onClick={() => loadMore(cursor)} disabled={loading}>
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
