// src/features/bookings/pages/PayFailed.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { getPayment } from "../../../services/paymentService";

export default function PayFailed() {
    const { state, search } = useLocation();
    const [reason, setReason] = useState(
        state?.reason || "Payment was cancelled or failed."
    );

    const params = useMemo(() => new URLSearchParams(search), [search]);
    const paymentId = params.get("paymentId") || params.get("payment_id");

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!paymentId || state?.reason) return;
            try {
                // Try to load payment to extract failure reason/status if available
                const payment = await getPayment(paymentId).catch(() => null);
                const msg =
                    payment?.failureReason ||
                    payment?.status ||
                    payment?.message ||
                    null;
                if (mounted && msg) setReason(String(msg));
            } catch {
                // ignore, keep default reason
            }
        })();
        return () => { mounted = false; };
    }, [paymentId, state?.reason]);

    return (
        <div className="page" style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
            <h1>Payment Failed</h1>
            <p className="muted">{reason}</p>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <Link to="/bookings" className="btn-secondary">View my bookings</Link>
                <Link to="/search" className="btn-primary">Try another station</Link>
            </div>
        </div>
    );
}
