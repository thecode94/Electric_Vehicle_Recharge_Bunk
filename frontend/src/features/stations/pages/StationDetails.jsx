// src/features/stations/pages/StationDetails.jsx
import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function StationDetails() {
    const { stationId } = useParams();
    const location = useLocation();
    const fromState = location.state?.station || location.state || null;

    const [station, setStation] = useState(fromState || null);
    const [loading, setLoading] = useState(!fromState);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast(t => ({ ...t, open: false }));

    useEffect(() => {
        let ignore = false;
        async function load() {
            if (station) return;
            try {
                setLoading(true);
                const res = await http.get(`/stations/${encodeURIComponent(stationId)}`);
                if (ignore) return;
                const d = res.data || {};
                setStation({
                    id: d.id || d._id || stationId,
                    name: d.name || d.title || d.stationName || "Station",
                    address: d.address || d.formattedAddress || d.location?.address || d.vicinity || "",
                    lat: d.lat || d.latitude || d.location?.lat,
                    lng: d.lng || d.longitude || d.location?.lng,
                    pricePerKwh: d.pricePerKwh || d.price || d.tariff,
                    sockets: d.sockets || d.connectors || d.ports || [],
                    rating: d.rating,
                    images: d.images || d.photos || [],
                    openHours: d.openHours || d.hours || d.timings,
                    phone: d.phone || d.contact || d.phoneNumber,
                    available: d.available,
                });
            } catch (err) {
                setToast({ open: true, type: "error", message: err?.response?.data?.message || err?.message || "Failed to load station" });
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => { ignore = true; };
    }, [stationId]); // [attached_file:1]

    const s = station || {};

    return (
        <div className="page" style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
            <h1 style={{ margin: 0 }}>{s.name || "Station"}</h1>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                    <Spinner /> <span>Loading station…</span>
                </div>
            ) : (
                <>
                    <div className="card" style={{ marginTop: 12, padding: 16 }}>
                        {s.address && (
                            <div style={{ marginBottom: 8 }}>
                                <div className="muted">Address</div>
                                <div>{s.address}</div>
                            </div>
                        )}
                        {s.lat && s.lng && (
                            <div className="small" style={{ marginBottom: 8 }}>
                                {s.lat}, {s.lng} ·{" "}
                                <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer">Open in Maps</a>
                            </div>
                        )}
                        {s.pricePerKwh && (
                            <div style={{ marginBottom: 8 }}>
                                <div className="muted">Tariff</div>
                                <div>₹ {s.pricePerKwh} / kWh</div>
                            </div>
                        )}
                        {Array.isArray(s.sockets) && s.sockets.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                                <div className="muted">Connectors</div>
                                <ul style={{ margin: "6px 0 0 16px" }}>
                                    {s.sockets.map((c, i) => (
                                        <li key={i}>
                                            {typeof c === "string" ? c : c?.type || c?.name || `Connector ${i + 1}`}
                                            {c?.power && ` — ${c.power} kW`}
                                            {c?.status && ` (${c.status})`}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <Link
                            to={`/booking/${encodeURIComponent(s.id || stationId)}`}
                            className="btn-primary"
                            state={{ name: s.name, address: s.address, lat: s.lat, lng: s.lng, pricePerKwh: s.pricePerKwh }}
                        >
                            Book a Slot
                        </Link>
                        <Link
                            to={`/stations/${encodeURIComponent(s.id || stationId)}/book`}
                            className="btn-secondary"
                            state={{ station: { name: s.name, address: s.address, lat: s.lat, lng: s.lng, pricePerKwh: s.pricePerKwh } }}
                        >
                            Quick book
                        </Link>
                        <Link to="/search" className="btn-tertiary">Back to Search</Link>
                    </div>
                </>
            )}

            {toast.open && <Toast type={toast.type} onClose={onCloseToast}>{toast.message}</Toast>}
        </div>
    );
}
