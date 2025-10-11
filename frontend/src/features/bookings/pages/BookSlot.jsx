// src/features/bookings/pages/BookSlot.jsx
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { useMemo, useState } from "react";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";
import { createBooking } from "../../../services/bookingService";
import { startCheckout } from "../../../services/paymentService";

export default function BookSlot() {
    const { id: stationId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Station object handed over from StationDetails; if not present, keep minimal details.
    const station = location.state?.station || {};
    const name = station.name || "EV Station";
    const address = station.address || "";
    const lat = Number(station.lat ?? station.latitude);
    const lng = Number(station.lng ?? station.longitude);

    const coordText = useMemo(() => {
        const laOk = Number.isFinite(lat);
        const lnOk = Number.isFinite(lng);
        if (!laOk || !lnOk) return null;
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }, [lat, lng]);

    // simple local form
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [time, setTime] = useState("10:00");
    const [hours, setHours] = useState(1);
    const [vehicleType, setVehicleType] = useState("car"); // optional
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    const toIsoStart = (d, t) => {
        try {
            const iso = new Date(`${d}T${t}:00`).toISOString();
            return iso;
        } catch {
            return null;
        }
    };

    async function handleSubmit(e) {
        e.preventDefault();

        // Client-side validation
        if (!stationId) {
            setToast({ open: true, type: "error", message: "Missing station id" });
            return;
        }
        if (!date || !time) {
            setToast({ open: true, type: "error", message: "Select date and time" });
            return;
        }
        if (hours < 1 || hours > 8) {
            setToast({ open: true, type: "error", message: "Duration must be 1–8 hours" });
            return;
        }

        const startTime = toIsoStart(date, time);
        if (!startTime) {
            setToast({ open: true, type: "error", message: "Invalid date/time" });
            return;
        }

        try {
            setBusy(true);

            // Create booking
            const booking = await createBooking({
                stationId,
                startTime,                   // ISO string
                durationMins: hours * 60,    // backend expects minutes
                vehicleType,                 // optional; backend tolerates missing
            });

            // If payment required, start checkout
            if (booking?.paymentRequired || booking?.paymentUrl) {
                const pay = booking?.paymentUrl
                    ? { paymentUrl: booking.paymentUrl }
                    : await startCheckout(booking.id || booking._id);

                if (pay?.paymentUrl) {
                    // Navigate to external gateway; after success, gateway should redirect back to /pay/success
                    window.location.assign(pay.paymentUrl);
                    return;
                }
            }

            // If no payment step, go to success locally with state
            setToast({ open: true, type: "success", message: "Booking confirmed" });
            navigate("/pay/success", { replace: true, state: { booking } });
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.normalizedMessage ||
                err?.message ||
                "Failed to book";
            setToast({ open: true, type: "error", message: msg });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="page" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
            <h2>Book: {name}</h2>

            <div className="card" style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600 }}>Address</div>
                <div className="muted">{address || "—"}</div>
                <div style={{ marginTop: 6 }}>{coordText ?? "Coordinates unavailable"}</div>
            </div>

            <form onSubmit={handleSubmit} className="card" style={{ marginTop: 12, display: "grid", gap: 12, maxWidth: 520 }}>
                <div>
                    <label className="muted small">Date</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div>
                    <label className="muted small">Start time</label>
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
                </div>
                <div>
                    <label className="muted small">Duration (hours)</label>
                    <input type="number" min={1} max={8} value={hours} onChange={(e) => setHours(Number(e.target.value || 1))} />
                </div>
                <div>
                    <label className="muted small">Vehicle type</label>
                    <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                        <option value="car">Car</option>
                        <option value="bike">Bike</option>
                        <option value="suv">SUV</option>
                        <option value="ev">EV</option>
                    </select>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit" disabled={busy}>
                        {busy ? <><Spinner size={16} />&nbsp;Booking…</> : "Confirm Booking"}
                    </button>
                    <Link to={`/stations/${encodeURIComponent(stationId)}`} className="btn-secondary" state={{ station }}>
                        Back
                    </Link>
                </div>
            </form>

            {toast.open && (
                <Toast type={toast.type} onClose={onCloseToast}>
                    {toast.message}
                </Toast>
            )}
        </div>
    );
}
