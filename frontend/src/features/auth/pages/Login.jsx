// src/features/auth/pages/Login.jsx
import React, { useState } from "react";
import { useAuth } from "../../../context/AuthProvider";
import { Link } from "react-router-dom";

const Login = () => {
    const { login, loading, error } = useAuth();

    const [form, setForm] = useState({ email: "", password: "" });
    const [role, setRole] = useState("user"); // "user" | "owner" | "admin"

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const ok = await login(role, form);
        if (!ok) return;
        // login() handles redirect based on role
    };

    // Role-aware links
    const registerHref =
        role === "owner" ? "/owner/register" : role === "user" ? "/auth/register" : null;

    // Forgot password: ENABLE only for user; DISABLE (null) for owner/admin
    const resetHref = role === "user" ? "/auth/forgot-password" : null;

    return (
        <div className="login-page" style={{ padding: "2rem", maxWidth: 400, margin: "auto" }}>
            <h2 style={{ marginBottom: "1rem" }}>Login</h2>

            {/* Role Switch */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {["user", "owner", "admin"].map((r) => (
                    <button
                        key={r}
                        onClick={() => setRole(r)}
                        style={{
                            flex: 1,
                            padding: "0.5rem",
                            backgroundColor: role === r ? "#333" : "#eee",
                            color: role === r ? "#fff" : "#000",
                            border: "1px solid #ccc",
                            cursor: "pointer",
                        }}
                    >
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                    <label>Email</label>
                    <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        style={{ width: "100%", padding: 8 }}
                    />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label>Password</label>
                    <input
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        required
                        style={{ width: "100%", padding: 8 }}
                    />
                </div>

                {error && (
                    <div style={{ marginBottom: 12, color: "red" }}>
                        {typeof error === "string" ? error : error?.message}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: "0.75rem",
                        backgroundColor: "#333",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    {loading ? "Logging in..." : `Login as ${role}`}
                </button>
            </form>

            <div style={{ marginTop: 20, textAlign: "center" }}>
                {registerHref ? (
                    <Link to={registerHref}>Don’t have an account?</Link>
                ) : (
                    <span style={{ opacity: 0.5, cursor: "not-allowed" }}>Don’t have an account?</span>
                )}
                <br />
                {resetHref ? (
                    <Link to={resetHref}>Forgot password?</Link>
                ) : (
                    <span style={{ opacity: 0.5, cursor: "not-allowed" }}>Forgot password?</span>
                )}
            </div>
        </div>
    );
};

export default Login;
