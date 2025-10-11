import { useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function OwnerRegister() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        email: "",
        password: "",
        displayName: "",
        phone: ""
    });
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState({ type: "", message: "", open: false });

    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.email.match(/^\S+@\S+\.\S+$/)) {
            return setToast({ type: "error", message: "Enter a valid email address.", open: true });
        }
        if (!form.password) {
            return setToast({ type: "error", message: "Password is required.", open: true });
        }
        if (!form.displayName.trim()) {
            return setToast({ type: "error", message: "Name is required.", open: true });
        }
        if (!form.phone.match(/^\+?\d{10,}$/)) {
            return setToast({ type: "error", message: "Enter a valid phone number.", open: true });
        }

        setSubmitting(true);
        try {
            await http.post("/auth/owner/register", form);
            setToast({ type: "success", message: "Account created successfully.", open: true });
            setTimeout(() => navigate("/owner/login"), 1200);
        } catch (error) {
            const msg = error?.response?.data?.error || "Registration failed.";
            setToast({ type: "error", message: msg, open: true });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page page--center">
            <div className="card card--auth" style={{ minWidth: 360 }}>
                <h1>Create Owner Account</h1>
                <p className="muted">Register to manage your stations and payouts.</p>

                <form onSubmit={handleSubmit} className="form" style={{ marginTop: 16 }}>
                    <label htmlFor="displayName">Full Name</label>
                    <input
                        id="displayName"
                        name="displayName"
                        type="text"
                        placeholder="Demo User"
                        value={form.displayName}
                        onChange={handleChange}
                        required
                        disabled={submitting}
                    />

                    <label htmlFor="email" style={{ marginTop: 12 }}>Email</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="owner@example.com"
                        value={form.email}
                        onChange={handleChange}
                        required
                        disabled={submitting}
                        autoComplete="email"
                    />

                    <label htmlFor="phone" style={{ marginTop: 12 }}>Phone Number</label>
                    <input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+911234567890"
                        value={form.phone}
                        onChange={handleChange}
                        required
                        disabled={submitting}
                    />

                    <label htmlFor="password" style={{ marginTop: 12 }}>Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Choose a secure password"
                        value={form.password}
                        onChange={handleChange}
                        required
                        disabled={submitting}
                        autoComplete="new-password"
                    />

                    <button type="submit" disabled={submitting} style={{ marginTop: 16 }}>
                        {submitting ? <Spinner size={16} /> : "Register as Owner"}
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
