// src/features/admin/pages/AdminLogin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import httpAdmin from "../../../utils/httpAdmin";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function AdminLogin() {
    const [form, setForm] = useState({ email: "", password: "" });
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const nav = useNavigate();

    const onChange = (e) =>
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    async function submit(e) {
        e.preventDefault();
        setToast({ open: false });
        try {
            setBusy(true);

            const { data } = await axios.post("/api/admin/auth/login", {
                email: form.email,
                password: form.password,
            });

            // Save to localStorage
            localStorage.setItem("adminAuth", JSON.stringify(data));

            // Attach token globally to future admin requests
            if (data?.tokens?.accessToken) {
                httpAdmin.defaults.headers.common.Authorization = `Bearer ${data.tokens.accessToken}`;
            }

            // Optional: check /me to verify token
            await httpAdmin.get("/auth/me");

            setToast({
                open: true,
                type: "success",
                message: "Login successful",
            });

            nav("/admin/dashboard", { replace: true });
        } catch (err) {
            const msg =
                err?.response?.data?.error ||
                err?.message ||
                "Admin login failed";
            setToast({ open: true, type: "error", message: msg });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="page page--center">
            <div className="card card--auth" style={{ minWidth: 360 }}>
                <h1>Admin Login</h1>
                <form onSubmit={submit} className="form" style={{ marginTop: 16 }}>
                    <label>Email</label>
                    <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={onChange}
                        required
                    />

                    <label style={{ marginTop: 12 }}>Password</label>
                    <input
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={onChange}
                        required
                    />

                    <button
                        type="submit"
                        disabled={busy}
                        style={{ marginTop: 16 }}
                    >
                        {busy ? <Spinner size={16} /> : "Login as Admin"}
                    </button>
                </form>
            </div>

            {toast.open && (
                <Toast
                    type={toast.type}
                    onClose={() => setToast({ ...toast, open: false })}
                >
                    {toast.message}
                </Toast>
            )}
        </div>
    );
}
