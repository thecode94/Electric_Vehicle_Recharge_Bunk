// src/features/admin/pages/AdminSettings.jsx
import { useEffect, useMemo, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

/**
 * Admin Settings
 * Common endpoints (adjust as needed):
 *  - GET   /api/admin/settings
 *  - PATCH /api/admin/settings         { maintenance:{enabled,message}, rateLimit:{windowSec,maxRequests}, flags:{...} }
 *  - POST  /api/admin/settings/test-email { to }
 */
export default function AdminSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    const [settings, setSettings] = useState(() => ({
        maintenance: { enabled: false, message: "" },
        rateLimit: { windowSec: 60, maxRequests: 120 },
        flags: {
            enableSignup: true,
            enableOwnerSignup: true,
            enablePayments: true,
            enableBookings: true,
            enableMaps: true,
        },
        supportEmail: "support@example.com",
    }));

    async function load() {
        try {
            setLoading(true);
            const res = await http.get("/admin/settings");
            if (res?.data) {
                setSettings(mergeDefaults(res.data));
            }
        } catch (err) {
            setToast({ open: true, type: "error", message: err.message || "Failed to load settings" });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function save() {
        try {
            setSaving(true);
            const payload = normalize(settings);
            await http.patch("/admin/settings", payload);
            setToast({ open: true, type: "success", message: "Settings saved" });
            await load();
        } catch (err) {
            setToast({ open: true, type: "error", message: err.message || "Save failed" });
        } finally {
            setSaving(false);
        }
    }

    async function sendTestEmail() {
        const to = prompt("Send test email to:", settings.supportEmail || "");
        if (!to) return;
        try {
            setSaving(true);
            await http.post("/admin/settings/test-email", { to });
            setToast({ open: true, type: "success", message: `Test email sent to ${to}` });
        } catch (err) {
            setToast({ open: true, type: "error", message: err.message || "Failed to send test email" });
        } finally {
            setSaving(false);
        }
    }

    const rl = settings.rateLimit || {};
    const flags = settings.flags || {};
    const maintenance = settings.maintenance || {};

    const preview = useMemo(() => {
        const obj = normalize(settings);
        return JSON.stringify(obj, null, 2);
    }, [settings]);

    return (
        <div className="page" style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
            <h1>Admin · Settings</h1>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                    <Spinner /> <span>Loading…</span>
                </div>
            ) : (
                <>
                    {/* Maintenance mode */}
                    <div className="card" style={{ padding: 16 }}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>Maintenance Mode</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "center", marginTop: 12 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input
                                    type="checkbox"
                                    checked={!!maintenance.enabled}
                                    onChange={(e) => setSettings((s) => ({ ...s, maintenance: { ...s.maintenance, enabled: e.target.checked } }))}
                                />
                                Enabled
                            </label>
                            <input
                                type="text"
                                placeholder="Maintenance message to show users"
                                value={maintenance.message || ""}
                                onChange={(e) => setSettings((s) => ({ ...s, maintenance: { ...s.maintenance, message: e.target.value } }))}
                            />
                        </div>
                    </div>

                    {/* Rate limiting */}
                    <div className="card" style={{ padding: 16, marginTop: 12 }}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>API Rate Limit</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                            <div>
                                <label className="muted small">Window (seconds)</label>
                                <input
                                    type="number"
                                    min={5}
                                    value={rl.windowSec ?? 60}
                                    onChange={(e) => setSettings((s) => ({ ...s, rateLimit: { ...s.rateLimit, windowSec: Number(e.target.value) } }))}
                                />
                            </div>
                            <div>
                                <label className="muted small">Max Requests per Window</label>
                                <input
                                    type="number"
                                    min={10}
                                    value={rl.maxRequests ?? 120}
                                    onChange={(e) => setSettings((s) => ({ ...s, rateLimit: { ...s.rateLimit, maxRequests: Number(e.target.value) } }))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Feature flags */}
                    <div className="card" style={{ padding: 16, marginTop: 12 }}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>Feature Flags</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
                            {Object.keys(flags).map((key) => (
                                <label key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input
                                        type="checkbox"
                                        checked={!!flags[key]}
                                        onChange={(e) =>
                                            setSettings((s) => ({ ...s, flags: { ...s.flags, [key]: e.target.checked } }))
                                        }
                                    />
                                    {labelForFlag(key)}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Support */}
                    <div className="card" style={{ padding: 16, marginTop: 12 }}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>Support</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", marginTop: 12 }}>
                            <input
                                type="email"
                                placeholder="Support email"
                                value={settings.supportEmail || ""}
                                onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))}
                            />
                            <button onClick={sendTestEmail}>Send Test Email</button>
                        </div>
                    </div>

                    {/* Preview + Save */}
                    <div className="card" style={{ padding: 16, marginTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <strong>Payload Preview</strong>
                            <button onClick={save} disabled={saving}>
                                {saving ? <Spinner size={16} /> : "Save Settings"}
                            </button>
                        </div>
                        <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{preview}</pre>
                    </div>
                </>
            )}

            {toast.open && (
                <Toast type={toast.type} onClose={onCloseToast}>
                    {toast.message}
                </Toast>
            )}
        </div>
    );
}

/* utils */
function mergeDefaults(s = {}) {
    return {
        maintenance: { enabled: false, message: "", ...(s.maintenance || {}) },
        rateLimit: { windowSec: 60, maxRequests: 120, ...(s.rateLimit || {}) },
        flags: {
            enableSignup: true,
            enableOwnerSignup: true,
            enablePayments: true,
            enableBookings: true,
            enableMaps: true,
            ...(s.flags || {}),
        },
        supportEmail: s.supportEmail || "support@example.com",
    };
}
function normalize(s) {
    return {
        maintenance: {
            enabled: !!s.maintenance?.enabled,
            message: s.maintenance?.message || "",
        },
        rateLimit: {
            windowSec: Number(s.rateLimit?.windowSec || 60),
            maxRequests: Number(s.rateLimit?.maxRequests || 120),
        },
        flags: { ...(s.flags || {}) },
        supportEmail: s.supportEmail || "",
    };
}
function labelForFlag(k) {
    const map = {
        enableSignup: "User Signup",
        enableOwnerSignup: "Owner Signup",
        enablePayments: "Payments",
        enableBookings: "Bookings",
        enableMaps: "Maps & Search",
    };
    return map[k] || k;
}
