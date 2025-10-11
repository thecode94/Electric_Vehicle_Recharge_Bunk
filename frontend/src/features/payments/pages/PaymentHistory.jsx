// src/features/payments/pages/PaymentHistory.jsx
import { useEffect, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function PaymentHistory() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast(t => ({ ...t, open: false }));

    useEffect(() => {
        let ignore = false;
        async function load() {
            try {
                setLoading(true);
                const res = await http.get("/payments/my");
                if (ignore) return;
                const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
                setItems(list);
            } catch (err) {
                setToast({ open: true, type: "error", message: err?.response?.data?.message || err?.message || "Failed to load payments" });
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => { ignore = true; };
    }, []); // [attached_file:1]

    return (
        <div className="page" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
            <h1>Payment History</h1>

            <div className="card" style={{ padding: 0, marginTop: 12 }}>
                {loading ? (
                    <div style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
                        <Spinner /> <span>Loading…</span>
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ padding: 16 }} className="muted">No payments yet.</div>
                ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {items.map((p, i) => {
                            const id = p.id || p._id || `p${i}`;
                            const created = p.createdAt ? new Date(p.createdAt).toLocaleString() : "-";
                            return (
                                <li key={id} style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>₹ {p.amount || p.total || 0}</div>
                                        <div className="muted small">{created} · {p.status || "success"}</div>
                                    </div>
                                    {p.bookingId && <span className="muted small">Booking: {p.bookingId}</span>}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {toast.open && <Toast type={toast.type} onClose={onCloseToast}>{toast.message}</Toast>}
        </div>
    );
}
