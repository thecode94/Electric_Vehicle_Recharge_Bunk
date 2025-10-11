import { useState } from "react";
import Toast from "../../../components/Toast";
import Spinner from "../../../components/Spinner";
import { sendReset } from "../../../services/authService";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });

    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    async function handleSubmit(e) {
        e.preventDefault();
        if (!email || !email.includes("@")) {
            return setToast({
                open: true,
                type: "error",
                message: "Please enter a valid email address.",
            });
        }

        try {
            setSubmitting(true);
            const res = await sendReset(email);
            setToast({
                open: true,
                type: "success",
                message: res.message || "Reset link sent. Check your email.",
            });
        } catch (err) {
            setToast({
                open: true,
                type: "error",
                message: err.message || "Failed to send reset link.",
            });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="page page--center">
            <div className="card card--auth" style={{ minWidth: 360 }}>
                <h1>Forgot Password</h1>
                <p className="muted">
                    Enter your registered email. We’ll send a reset link if the account exists.
                </p>

                <form onSubmit={handleSubmit} className="form" style={{ marginTop: 16 }}>
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <button type="submit" disabled={submitting} style={{ marginTop: 12 }}>
                        {submitting ? <Spinner size={16} /> : "Send Reset Link"}
                    </button>
                </form>
            </div>

            {toast.open && (
                <Toast type={toast.type} onClose={onCloseToast}>
                    {toast.message}
                </Toast>
            )}
        </div>
    );
}
