import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function EmailVerification() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [verifying, setVerifying] = useState(false);
    const [done, setDone] = useState(false);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast(t => ({ ...t, open: false }));

    useEffect(() => {
        let ignore = false;
        async function verify() {
            const oobCode = params.get("oobCode") || params.get("code");
            if (!oobCode) return;
            try {
                setVerifying(true);
                await http.post("/auth/verify-email", { oobCode });
                if (ignore) return;
                setDone(true);
                setToast({ open: true, type: "success", message: "Email verified" });
                setTimeout(() => navigate("/login", { replace: true }), 1200);
            } catch (err) {
                setToast({
                    open: true,
                    type: "error",
                    message: err?.response?.data?.message || err?.message || "Verification failed"
                });
            } finally {
                setVerifying(false);
            }
        }
        verify();
        return () => { ignore = true; };
    }, [params, navigate]);

    return (
        <div className="page" style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
            <h1>Email verification</h1>
            {verifying ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                    <Spinner /> <span>Verifying…</span>
                </div>
            ) : done ? (
                <div className="card" style={{ padding: 16, marginTop: 12 }}>
                    <div>Done! Redirecting to login…</div>
                    <div style={{ marginTop: 8 }}><Link to="/login">Go to login</Link></div>
                </div>
            ) : (
                <div className="card" style={{ padding: 16, marginTop: 12 }}>
                    <div className="muted small">Missing verification code in URL.</div>
                    <div style={{ marginTop: 8 }}><Link to="/">Back home</Link></div>
                </div>
            )}
            {toast.open && <Toast type={toast.type} onClose={onCloseToast}>{toast.message}</Toast>}
        </div>
    );
}