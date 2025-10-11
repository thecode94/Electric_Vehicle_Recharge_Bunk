// src/features/bookings/pages/PaySuccess.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { getBooking } from "../../../services/bookingService";
import { getPayment } from "../../../services/paymentService";

export default function PaySuccess() {
    const { state, search } = useLocation();
    const bookingFromState = state?.booking;

    const params = useMemo(() => new URLSearchParams(search), [search]);
    const paymentId = params.get("paymentId") || params.get("payment_id");
    const bookingId = params.get("bookingId") || params.get("booking_id");

    const [booking, setBooking] = useState(bookingFromState || null);
    const [loading, setLoading] = useState(!bookingFromState && !!bookingId);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (bookingFromState || !bookingId) return;
            try {
                setLoading(true);
                setError(null);
                // Optionally fetch payment to confirm status before booking
                if (paymentId) {
                    await getPayment(paymentId).catch(() => null);
                }
                const data = await getBooking(bookingId);
                if (mounted) setBooking(data);
            } catch (e) {
                if (mounted) setError(e?.message || "Unable to load booking");
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [bookingFromState, bookingId, paymentId]);

    return (
        <div className="page" style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
            <h1>Payment Successful</h1>
            <p className="muted">Your booking has been confirmed.</p>

            {loading && <div className="card" style={{ padding: 16, marginTop: 12 }}>Loading booking…</div>}
            {error && <div className="card" style={{ padding: 16, marginTop: 12, color: "red" }}>{error}</div>}

            {!loading && !error && (
                booking ? (
                    <div className="card" style={{ padding: 16, marginTop: 12 }}>
                        <div><strong>Booking ID:</strong> {booking.id || booking._id}</div>
                        <div><strong>Station:</strong> {booking.station?.name || booking.stationName || "—"}</div>
                        <div><strong>When:</strong> {booking.startTime ? new Date(booking.startTime).toLocaleString() : "—"}</div>
                        <div><strong>Status:</strong> {booking.status || "confirmed"}</div>
                    </div>
                ) : (
                    <div className="card" style={{ padding: 16, marginTop: 12 }}>
                        <div className="muted">We could not find booking details.</div>
                    </div>
                )
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <Link to="/bookings" className="btn-primary">View my bookings</Link>
                <Link to="/search" className="btn-secondary">Find another station</Link>
            </div>
        </div>
    );
}
