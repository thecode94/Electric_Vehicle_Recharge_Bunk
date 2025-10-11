// src/features/stations/pages/Favorites.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function Favorites() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast(t => ({ ...t, open: false }));

    useEffect(() => {
        let ignore = false;
        async function load() {
            try {
                setLoading(true);
                // Backend should return an array of stations or { items: [...] }
                const res = await http.get("/users/me/favorites");
                if (ignore) return;
                const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
                setItems(list);
            } catch (err) {
                setToast({
                    open: true,
                    type: "error",
                    message: err?.response?.data?.message || err?.message || "Failed to load favorites",
                });
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => { ignore = true; };
    }, []); // [attached_file:1]

    async function removeFav(id) {
        try {
            await http.delete(`/users/me/favorites/${encodeURIComponent(id)}`);
            setItems(prev => prev.filter(s => (s.id || s._id) !== id));
        } catch (err) {
            setToast({
                open: true,
                type: "error",
                message: err?.response?.data?.message || err?.message || "Failed to remove favorite",
            });
        }
    }

    return (
        <div className="page" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
            <h1>Favorites</h1>

            <div className="card" style={{ padding: 0, marginTop: 12 }}>
                {loading ? (
                    <div style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
                        <Spinner /> <span>Loading…</span>
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ padding: 16 }}>
                        <div className="muted">No favorites yet.</div>
                        <div style={{ marginTop: 8 }}>
                            <Link to="/search" className="btn-primary">Find stations</Link>
                        </div>
                    </div>
                ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {items.map((s, i) => {
                            const id = s.id || s._id || s.stationId || `s${i}`;
                            const name = s.name || s.title || s.stationName || "Station";
                            const addr = s.address || s.formattedAddress || s.location?.address || "";
                            const price = s.pricePerKwh ?? s.price ?? s.tariff;
                            return (
                                <li
                                    key={id}
                                    style={{
                                        padding: "12px 16px",
                                        borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                                        display: "grid",
                                        gridTemplateColumns: "1fr auto auto",
                                        gap: 12,
                                        alignItems: "center"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{name}</div>
                                        {!!addr && <div className="muted small">{addr}</div>}
                                        {price != null && (
                                            <div className="small" style={{ marginTop: 4 }}>₹ {price} / kWh</div>
                                        )}
                                    </div>

                                    <Link
                                        to={`/stations/${encodeURIComponent(id)}`}
                                        className="btn-secondary"
                                        state={{ station: { id, name, address: addr, pricePerKwh: price } }}
                                    >
                                        View
                                    </Link>

                                    <button className="btn-danger" onClick={() => removeFav(id)}>
                                        Remove
                                    </button>
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
