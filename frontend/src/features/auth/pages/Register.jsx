import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";
import { register } from "../../../services/authService"; // uses /auth/register (user) and /owners/register (owner)

export default function Register() {
    const navigate = useNavigate();

    // role: "user" | "owner"
    const [role, setRole] = useState("user");

    const [form, setForm] = useState({
        // common
        email: "",
        password: "",
        // user fields
        name: "",
        phone: "",
        // owner fields
        displayName: "",
        ownerPhone: ""
    });

    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast(t => ({ ...t, open: false }));

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const validate = () => {
        if (!/^\S+@\S+\.\S+$/.test(form.email)) {
            return "Enter a valid email address.";
        }
        if (!form.password) {
            return "Password is required.";
        }
        if (role === "user") {
            if (!form.name.trim()) return "Full name is required.";
            if (form.phone && !/^\+?\d{10,}$/.test(form.phone)) return "Enter a valid phone number.";
        } else {
            if (!form.displayName.trim()) return "Owner name is required.";
            if (!/^\+?\d{10,}$/.test(form.ownerPhone)) return "Owner phone is required and must be valid.";
        }
        return null;
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        const error = validate();
        if (error) {
            setToast({ open: true, type: "error", message: error });
            return;
        }

        setSubmitting(true);
        try {
            if (role === "user") {
                // Backend expects: { name, email, phone?, password }
                await register("user", {
                    name: form.name.trim(),
                    email: form.email,
                    phone: form.phone || undefined,
                    password: form.password,
                });
                setToast({ open: true, type: "success", message: "Account created. You can now log in." });
                setTimeout(() => navigate("/auth/login"), 1000);
            } else {
                // Backend expects: { displayName, email, phone, password }
                await register("owner", {
                    displayName: form.displayName.trim(),
                    email: form.email,
                    phone: form.ownerPhone,
                    password: form.password,
                });
                setToast({ open: true, type: "success", message: "Owner account created. Please log in." });
                setTimeout(() => navigate("/owner/login"), 1000);
            }
        } catch (err) {
            setToast({ open: true, type: "error", message: err.normalizedMessage || "Registration failed." });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page page--center">
            <div className="card card--auth" style={{ minWidth: 360 }}>
                <h1>Create {role === "owner" ? "Owner" : "User"} Account</h1>
                <p className="muted">Register to {role === "owner" ? "manage your stations and payouts." : "start booking stations."}</p>

                {/* Role switch */}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {["user", "owner"].map(r => (
                        <button
                            key={r}
                            type="button"
                            onClick={() => setRole(r)}
                            disabled={submitting}
                            style={{
                                flex: 1,
                                padding: "0.5rem",
                                background: role === r ? "#111827" : "#e5e7eb",
                                color: role === r ? "#fff" : "#111827",
                                border: "1px solid #cbd5e1",
                                borderRadius: 6,
                                cursor: "pointer"
                            }}
                        >
                            {r === "user" ? "User" : "Owner"}
                        </button>
                    ))}
                </div>

                <form onSubmit={onSubmit} className="form" style={{ marginTop: 16 }}>
                    {/* Role-specific name */}
                    {role === "user" ? (
                        <>
                            <label htmlFor="name">Full Name</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                placeholder="Your name"
                                value={form.name}
                                onChange={onChange}
                                disabled={submitting}
                                required
                            />
                        </>
                    ) : (
                        <>
                            <label htmlFor="displayName">Owner Name / Business Name</label>
                            <input
                                id="displayName"
                                name="displayName"
                                type="text"
                                placeholder="Demo User / Station Co."
                                value={form.displayName}
                                onChange={onChange}
                                disabled={submitting}
                                required
                            />
                        </>
                    )}

                    {/* Email */}
                    <label htmlFor="email" style={{ marginTop: 12 }}>Email</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder={role === "owner" ? "owner@example.com" : "you@example.com"}
                        value={form.email}
                        onChange={onChange}
                        disabled={submitting}
                        required
                        autoComplete="email"
                    />

                    {/* Phone (optional for user, required for owner) */}
                    {role === "user" ? (
                        <>
                            <label htmlFor="phone" style={{ marginTop: 12 }}>Phone (optional)</label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                placeholder="+911234567890"
                                value={form.phone}
                                onChange={onChange}
                                disabled={submitting}
                            />
                        </>
                    ) : (
                        <>
                            <label htmlFor="ownerPhone" style={{ marginTop: 12 }}>Phone Number</label>
                            <input
                                id="ownerPhone"
                                name="ownerPhone"
                                type="tel"
                                placeholder="+911234567890"
                                value={form.ownerPhone}
                                onChange={onChange}
                                disabled={submitting}
                                required
                            />
                        </>
                    )}

                    {/* Password */}
                    <label htmlFor="password" style={{ marginTop: 12 }}>Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Choose a secure password"
                        value={form.password}
                        onChange={onChange}
                        disabled={submitting}
                        required
                        autoComplete="new-password"
                    />

                    <button type="submit" disabled={submitting} style={{ marginTop: 16 }}>
                        {submitting ? <Spinner size={16} /> : `Create ${role === "owner" ? "Owner" : "User"} Account`}
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
