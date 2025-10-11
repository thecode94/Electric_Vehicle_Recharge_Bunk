// src/features/owner/pages/OwnerLogin.jsx
import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";
import { useAuth } from "../../../context/AuthProvider";

export default function OwnerLogin() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, error } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState({ type: "", message: "", open: false });

    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            setToast({ type: "error", message: "Enter a valid email", open: true });
            return;
        }
        if (!password) {
            setToast({ type: "error", message: "Password is required", open: true });
            return;
        }

        try {
            setSubmitting(true);
            const ok = await login("owner", { email, password }); // delegates to AuthProvider
            if (!ok) {
                setToast({ type: "error", message: "Owner login failed", open: true });
                return;
            }
            const dest = location.state?.from?.pathname || "/owner/dashboard";
            navigate(dest, { replace: true });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page page--center">
            <div className="card card--auth" style={{ minWidth: 360 }}>
                <h1>Owner Login</h1>
                <p className="muted">Manage your stations and payouts.</p>

                <form onSubmit={handleSubmit} className="form" style={{ marginTop: 16 }}>
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        placeholder="owner@station.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        disabled={submitting}
                    />

                    <label htmlFor="password" style={{ marginTop: 12 }}>Password</label>
                    <input
                        id="password"
                        type="password"
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                        disabled={submitting}
                    />

                    {error && (
                        <div style={{ marginTop: 8, color: "red" }}>
                            {typeof error === "string" ? error : error.message}
                        </div>
                    )}

                    <button type="submit" disabled={submitting} style={{ marginTop: 16 }}>
                        {submitting ? <Spinner size={16} /> : "Login as Owner"}
                    </button>
                </form>

                <div style={{ marginTop: 12 }}>
                    <span className="muted small">New station partner? </span>
                    <Link to="/owner/register" className="muted small">Create owner account</Link>
                </div>
            </div>

            {toast.open && <Toast type={toast.type} onClose={onCloseToast}>{toast.message}</Toast>}
        </div>
    );
}
