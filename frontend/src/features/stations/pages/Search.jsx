// src/features/stations/pages/Search.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { searchPlaces } from "../../../services/mapService";
import useDebounce from "../../../utils/useDebounce";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function Search() {
    const [q, setQ] = useState("");
    const debounced = useDebounce(q, 400);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });

    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    useEffect(() => {
        let ignore = false;

        async function run() {
            const trimmed = debounced?.trim();
            if (!trimmed) {
                setResults([]);
                return;
            }

            try {
                setLoading(true);
                const data = await searchPlaces(trimmed);
                if (ignore) return;

                const list = Array.isArray(data) ? data : data?.results || [];
                setResults(list);
            } catch (err) {
                setToast({
                    open: true,
                    type: "error",
                    message: err.message || "Search failed",
                });
            } finally {
                setLoading(false);
            }
        }

        run();
        return () => (ignore = true);
    }, [debounced]);

    const header = useMemo(() => {
        if (!debounced) return "Search EV recharge locations";
        if (loading) return `Searching “${debounced}”…`;
        return `Results for “${debounced}”`;
    }, [debounced, loading]);

    return (
        <div className="page" style={{ maxWidth: 840, margin: "0 auto", padding: 24 }}>
            <h1>Find Stations</h1>
            <p className="muted">Type a city, area, landmark, or station name.</p>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="e.g., Andheri West, Delhi Airport, MG Road…"
                    style={{ flex: 1 }}
                />
                {loading ? (
                    <button disabled>
                        <Spinner size={16} />
                    </button>
                ) : (
                    <button onClick={() => setQ("")} className="btn-secondary">Clear</button>
                )}
            </div>

            <h3 style={{ marginTop: 16 }}>{header}</h3>

            <div className="card" style={{ marginTop: 8, padding: 0 }}>
                {loading && results.length === 0 ? (
                    <div style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
                        <Spinner /> <span>Loading…</span>
                    </div>
                ) : results.length === 0 ? (
                    <div style={{ padding: 16 }} className="muted">No results yet.</div>
                ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {results.map((r, i) => {
                            const id = r.id || r.place_id || r._id || String(i);
                            const name = r.name || r.title || r.displayName || "Unnamed place";
                            const address =
                                r.address ||
                                r.formatted_address ||
                                r.vicinity ||
                                r.subtitle ||
                                r.displayAddress ||
                                "";
                            const lat = r.lat ?? r.latitude ?? r.location?.lat;
                            const lng = r.lng ?? r.longitude ?? r.location?.lng;

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
                                        {address && <div className="muted small">{address}</div>}
                                        {(lat && lng) && (
                                            <div className="muted small">
                                                {lat.toFixed ? lat.toFixed(5) : lat},{" "}
                                                {lng.toFixed ? lng.toFixed(5) : lng}
                                            </div>
                                        )}
                                    </div>

                                    {/* If using station detail page */}
                                    {id && (
                                        <Link
                                            to={`/stations/${encodeURIComponent(id)}`}
                                            state={{ name, address, lat, lng }}
                                            className="btn-secondary"
                                        >
                                            View
                                        </Link>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
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
