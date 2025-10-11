// src/features/stations/pages/BunkDetails.jsx
import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

/**
 * Station details page.
 * - If navigated from Search with router `state`, it uses that immediately.
 * - Otherwise it fetches from backend: GET /api/stations/:id
 */
export default function BunkDetails() {
    const { id } = useParams();
    const location = useLocation();
    const fromState = location.state || {};
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    const [station, setStation] = useState(
        fromState?.name || fromState?.address || fromState?.lat
            ? {
                id,
                name: fromState.name,
                address: fromState.address,
                lat: fromState.lat,
                lng: fromState.lng,
                pricePerKwh: fromState.pricePerKwh,
            }
            : null
    );

    useEffect(() => {
        let ignore = false;
        async function load() {
            if (station) return; // already have from state
            try {
                setLoading(true);
                // Flexible backend: /api/stations/:id
                const res = await http.get(`/stations/${encodeURIComponent(id)}`);
                if (ignore) return;

                // Accept different shapes
                const data = res.data || {};
                const s = {
                    id: data.id || data._id || id,
                    name:
                        data.name ||
                        data.title ||
                        data.stationName ||
                        data.displayName ||
                        "Station",
                    address:
                        data.address ||
                        data.formattedAddress ||
                        data.location?.address ||
                        data.vicinity ||
                        "",
                    lat: data.lat || data.latitude || data.location?.lat,
                    lng: data.lng || data.longitude || data.location?.lng,
                    pricePerKwh: data.pricePerKwh || data.price || data.tariff,
                    sockets: data.sockets || data.connectors || data.ports,
                    openHours: data.openHours || data.hours || data.timings,
                    phone: data.phone || data.contact || data.phoneNumber,
                    amenities: data.amenities || [],
                    images: data.images || data.photos || [],
                    rating: data.rating,
                    available: data.available,
                };
                setStation(s);
            } catch (err) {
                setToast({
                    open: true,
                    type: "error",
                    message: err?.response?.data?.message || err?.message || "Failed to load station",
                });
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const s = station || {};

    return (
        <div className="page" style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <h1 style={{ margin: 0 }}>{s.name || "Station"}</h1>
                {typeof s.rating === "number" && (
                    <span className="muted small">★ {s.rating.toFixed(1)}</span>
                )}
            </div>

            {loading && !station ? (
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

                        {(s.lat && s.lng) && (
                            <div style={{ marginBottom: 8 }}>
                                <div className="muted">Location</div>
                                <div className="small">
                                    {s.lat}, {s.lng} ·{" "}
                                    <a
                                        href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Open in Maps
                                    </a>
                                </div>
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
                                            {typeof c === "string"
                                                ? c
                                                : c?.type || c?.name || `Connector ${i + 1}`}
                                            {c?.power && ` — ${c.power} kW`}
                                            {c?.status && ` (${c.status})`}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {s.openHours && (
                            <div style={{ marginBottom: 8 }}>
                                <div className="muted">Hours</div>
                                <div>{typeof s.openHours === "string" ? s.openHours : "Open hours available"}</div>
                            </div>
                        )}

                        {s.phone && (
                            <div style={{ marginBottom: 8 }}>
                                <div className="muted">Contact</div>
                                <div>{s.phone}</div>
                            </div>
                        )}

                        {Array.isArray(s.amenities) && s.amenities.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                                <div className="muted">Amenities</div>
                                <div className="small">{s.amenities.join(" • ")}</div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        {/* Booking flow (protected route) */}
                        <Link
                            to={`/booking/${encodeURIComponent(s.id || id)}`}
                            className="btn-primary"
                            state={{ name: s.name, address: s.address, lat: s.lat, lng: s.lng, pricePerKwh: s.pricePerKwh }}
                        >
                            Book a Slot
                        </Link>
                        <Link
                            to={`/stations/${encodeURIComponent(s.id || id)}/book`}
                            className="btn-secondary"
                            state={{ station: { name: s.name, address: s.address, lat: s.lat, lng: s.lng, pricePerKwh: s.pricePerKwh } }}
                        >
                            Quick book
                        </Link>
                        <Link to="/search" className="btn-tertiary">
                            Back to Search
                        </Link>
                    </div>
                </>
            )}

            {toast.open && (
                <Toast type={toast.type} onClose={onCloseToast}>
                    {toast.message}
                </Toast>
            )}
        </div>
    );
}
