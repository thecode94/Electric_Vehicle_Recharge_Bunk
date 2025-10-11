// src/features/bookings/pages/Booking.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";
import { createBooking } from "../../../services/bookingService";
import { startCheckout } from "../../../services/paymentService";

export default function Booking() {
    const { id } = useParams();
    const nav = useNavigate();
    const location = useLocation();
    const fromState = location.state || {};

    const [station, setStation] = useState(
        fromState?.name
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
    const [loading, setLoading] = useState(!station);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    // form state
    const [vehicleType, setVehicleType] = useState("car");
    const [durationMins, setDurationMins] = useState(30);
    const [startLocal, setStartLocal] = useState(() => {
        const d = new Date(Date.now() + 15 * 60 * 1000);
        return toLocalInputValue(d);
    });
    const [notes, setNotes] = useState("");

    // Load station if needed
    useEffect(() => {
        let ignore = false;
        async function load() {
            if (station) return;
            try {
                setLoading(true);
                // http baseURL is "/api" (dev) or VITE_API_URL (prod)
                const res = await http.get(`/stations/${encodeURIComponent(id)}`);
                if (ignore) return;
                const data = res.data || {};
                setStation({
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
                        "",
                    lat: data.lat || data.latitude || data.location?.lat,
                    lng: data.lng || data.longitude || data.location?.lng,
                    pricePerKwh: data.pricePerKwh || data.price || data.tariff,
                });
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

    const startISO = useMemo(() => {
        try {
            return localInputToISO(startLocal);
        } catch {
            return null;
        }
    }, [startLocal]);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!startISO) {
            setToast({ open: true, type: "error", message: "Choose a valid start time" });
            return;
        }
        const dur = Number(durationMins);
        if (!dur || dur < 15) {
            setToast({
                open: true,
                type: "error",
                message: "Duration must be at least 15 minutes",
            });
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                stationId: station?.id || id,
                startTime: startISO, // let service normalize further if needed
                durationMins: dur,
                vehicleType,
                notes: notes?.trim() || undefined,
            };

            const result = await createBooking(payload);

            // Expecting: { id, status, paymentUrl?, paymentRequired?, message? }
            if (result?.paymentUrl) {
                window.location.assign(result.paymentUrl);
                return;
            }

            // Start checkout if required but URL not provided
            if (result?.paymentRequired && (result?.id || result?._id)) {
                const pay = await startCheckout(result.id || result._id);
                if (pay?.paymentUrl) {
                    window.location.assign(pay.paymentUrl);
                    return;
                }
            }

            // fallback: success page with booking info
            nav("/pay/success", { replace: true, state: { booking: result } });
        } catch (err) {
            setToast({
                open: true,
                type: "error",
                message:
                    err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    err?.normalizedMessage ||
                    err?.message ||
                    "Booking failed",
            });
            // Optionally route to failed page:
            // nav("/pay/failed", { state: { reason: message } });
        } finally {
            setSubmitting(false);
        }
    }

    const s = station || {};

    return (
        <div className="page" style={{ maxWidth: 840, margin: "0 auto", padding: 24 }}>
            <h1>Book a Charging Slot</h1>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Spinner /> <span>Loading station…</span>
                </div>
            ) : (
                <>
                    <div className="card" style={{ padding: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
                            <div><strong>{s.name || "Station"}</strong></div>
                            {s.address && <div className="muted small">{s.address}</div>}
                            {s.lat && s.lng && (
                                <div className="muted small">
                                    {s.lat}, {s.lng} ·{" "}
                                    <a
                                        href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Open in Maps
                                    </a>
                                </div>
                            )}
                            {s.pricePerKwh && (
                                <div className="muted small">Tariff: ₹ {s.pricePerKwh} / kWh</div>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="form" style={{ marginTop: 16 }}>
                        <div className="card" style={{ padding: 16 }}>
                            <label htmlFor="start">Start time</label>
                            <input
                                id="start"
                                type="datetime-local"
                                value={startLocal}
                                onChange={(e) => setStartLocal(e.target.value)}
                                required
                            />

                            <label htmlFor="duration" style={{ marginTop: 12 }}>
                                Duration (minutes)
                            </label>
                            <input
                                id="duration"
                                type="number"
                                min={15}
                                step={15}
                                value={durationMins}
                                onChange={(e) => setDurationMins(e.target.value)}
                                required
                            />

                            <label htmlFor="vehicleType" style={{ marginTop: 12 }}>
                                Vehicle Type
                            </label>
                            <select
                                id="vehicleType"
                                value={vehicleType}
                                onChange={(e) => setVehicleType(e.target.value)}
                            >
                                <option value="car">Car</option>
                                <option value="two_wheeler">Two Wheeler</option>
                                <option value="three_wheeler">Three Wheeler</option>
                                <option value="bus">Bus</option>
                            </select>

                            <label htmlFor="notes" style={{ marginTop: 12 }}>
                                Notes (optional)
                            </label>
                            <textarea
                                id="notes"
                                rows={3}
                                placeholder="Any special instructions…"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />

                            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                                <button type="submit" disabled={submitting}>
                                    {submitting ? <Spinner size={16} /> : "Confirm Booking"}
                                </button>
                                <Link to={`/stations/${encodeURIComponent(id)}`} className="btn-secondary">
                                    Cancel
                                </Link>
                            </div>
                        </div>
                    </form>
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

/** Utilities */
function toLocalInputValue(date) {
    // yyyy-MM-ddTHH:mm for <input type="datetime-local">
    const pad = (n) => String(n).padStart(2, "0");
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localInputToISO(localStr) {
    const d = new Date(localStr);
    if (isNaN(d.getTime())) throw new Error("Invalid date");
    return d.toISOString();
}
