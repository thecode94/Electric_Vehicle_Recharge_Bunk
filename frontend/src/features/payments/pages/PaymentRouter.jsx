import { useSearchParams, Navigate } from "react-router-dom";

export default function PaymentRouter() {
    const [sp] = useSearchParams();
    // support multiple param names just in case
    const id = sp.get("bookingId") || sp.get("id") || sp.get("ref");
    if (!id) return <Navigate to="/bookings" replace />;
    return <Navigate to={`/checkout/${encodeURIComponent(id)}`} replace />;
}
