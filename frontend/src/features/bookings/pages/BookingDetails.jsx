import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";
import { startCheckout } from "../../../services/paymentService";

export default function BookingDetails() {
    const { bookingId } = useParams();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });

    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    useEffect(() => {
        let ignore = false;

        async function load() {
            try {
                setLoading(true);
                const res = await http.get(`/bookings/${encodeURIComponent(bookingId)}`);
                if (ignore) return;

                const data = res.data?.booking || res.data;
                setBooking(data || null);
            } catch (err) {
                setToast({
                    open: true,
                    type: "error",
                    message: err?.response?.data?.message || err?.message || "Failed to load booking"
                });
            } finally {
                setLoading(false);
            }
        }

        load();
        return () => {
            ignore = true;
        };
    }, [bookingId]);

    async function onPay() {
        try {
            if (booking?.paymentUrl) {
                window.location.assign(booking.paymentUrl);
                return;
            }
            const id = booking?.id || booking?._id;
            if (!id) throw new Error("Missing booking id");

            const pay = await startCheckout(id);
            if (pay?.paymentUrl) window.location.assign(pay.paymentUrl);
            else setToast({ open: true, type: "error", message: "No payment URL returned" });
        } catch (e) {
            setToast({
                open: true,
                type: "error",
                message: e?.response?.data?.message || e?.message || "Payment start failed"
            });
        }
    }

    const formatDate = (value) => {
        if (!value) return "-";
        const d = new Date(value);
        return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
    };

    if (loading) {
        return (
            <div className="page" style={{ maxWidth: 840, margin: "0 auto", padding: 24 }}>
                <Spinner /> Loading…
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="page" style={{ maxWidth: 840, margin: "0 auto", padding: 24 }}>
                <div className="muted">Booking not found.</div>
                <div style={{ marginTop: 8 }}>
                    <Link to="/bookings" className="btn-secondary">Back to bookings</Link>
                </div>
            </div>
        );
    }

    const st = booking.station || {};
    const name = st.name || st.title || booking.stationName || "EV Charging Station";
    const addr = st.address || booking.stationAddress || "";
    const when = formatDate(booking.startTime || booking.start || booking.createdAt);
    const status = (booking.status || "pending").toLowerCase();
    const paymentStatus = (booking.paymentStatus || "").toLowerCase();
    const canPay = ["pending", "awaiting_payment", "pending_payment"].includes(status) || paymentStatus === "pending";

    return (
        <div className="page" style={{ maxWidth: 840, margin: "0 auto", padding: 24 }}>
            <h1>Booking Details</h1>

            <div className="card" style={{ padding: 16, marginTop: 12 }}>
                <div style={{ fontWeight: 600 }}>{name}</div>
                {addr && <div className="muted small">{addr}</div>}
                <div className="muted small">When: {when}</div>
                <div className="muted small">Status: {status}</div>
                {booking.durationMins && <div className="muted small">Duration: {booking.durationMins} mins</div>}
                {booking.amount && <div className="muted small">Amount: ₹{Number(booking.amount).toFixed(2)}</div>}
                {booking.paymentStatus && <div className="muted small">Payment: {paymentStatus}</div>}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Link to="/bookings" className="btn-secondary">Back</Link>
                {canPay && (
                    <button className="btn-primary" onClick={onPay}>Pay</button>
                )}
            </div>

            {toast.open && <Toast type={toast.type} onClose={onCloseToast}>{toast.message}</Toast>}
        </div>
    );
}
