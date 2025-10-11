// src/features/notifications/pages/Notifications.jsx
import { useEffect, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function Notifications() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast(t => ({ ...t, open: false }));

    useEffect(() => {
        let ignore = false;
        async function load() {
            try {
                setLoading(true);
                const res = await http.get("/notifications");
                if (ignore) return;
                setItems(Array.isArray(res.data) ? res.data : res.data?.items || []);
            } catch (err) {
                setToast({ open: true, type: "error", message: err?.response?.data?.message || err?.message || "Failed to load notifications" });
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => { ignore = true; };
    }, []); // [attached_file:1]

    return (
        <div className="page" style={{ maxWidth: 840, margin: "0 auto", padding: 24 }}>
            <h1>Notifications</h1>

            <div className="card" style={{ padding: 0, marginTop: 12 }}>
                {loading ? (
                    <div style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
                        <Spinner /> <span>Loading…</span>
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ padding: 16 }} className="muted">No notifications.</div>
                ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {items.map((n, i) => {
                            const id = n.id || n._id || `n${i}`;
                            const when = n.createdAt ? new Date(n.createdAt).toLocaleString() : "-";
                            return (
                                <li key={id} style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                    <div style={{ fontWeight: 600 }}>{n.title || n.type || "Notification"}</div>
                                    {n.message && <div className="muted small">{n.message}</div>}
                                    <div className="muted small">{when}</div>
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
