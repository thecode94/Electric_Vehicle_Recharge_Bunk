// src/features/owner/pages/OwnerFinance.jsx
import { useEffect, useMemo, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function OwnerFinance() {
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    // Data
    const [summary, setSummary] = useState(null);
    const [revenue, setRevenue] = useState([]); // [{date, amount}]
    const [payouts, setPayouts] = useState([]); // [{id, amount, status, createdAt}]
    const [unpaid, setUnpaid] = useState(0);

    useEffect(() => {
        let ignore = false;
        async function load() {
            try {
                setLoading(true);

                // Preferred endpoints; fallback gracefully for “beta” mode
                let s, r, p;
                try {
                    s = await http.get("/owner/finance/summary");
                } catch {
                    try {
                        s = await http.get("/owners/me/finance/summary");
                    } catch {
                        s = { data: null };
                    }
                }
                try {
                    r = await http.get("/owner/finance/revenue", { params: { range: "30d" } });
                } catch {
                    r = { data: [] };
                }
                try {
                    p = await http.get("/owner/finance/payouts");
                } catch {
                    p = { data: [] };
                }

                if (ignore) return;

                // Accept both plain-object and {success,data} shapes
                const rawSummary = s?.data?.currency ? s.data : (s?.data?.data || {});
                const rev = Array.isArray(r.data) ? r.data : r.data?.items || [];
                const pay = Array.isArray(p.data) ? p.data : p.data?.items || [];

                const sum = rawSummary || {};
                setSummary({
                    totalRevenue: toNumber(sum.totalRevenue, 0),
                    monthRevenue: toNumber(sum.monthRevenue ?? sum.last30Days, 0),
                    totalBookings: toNumber(sum.totalBookings, 0),
                    pendingPayout: toNumber(sum.pendingPayout, 0),
                    refunds: toNumber(sum.refunds, 0),
                    currency: sum.currency || "INR",
                });

                setRevenue(
                    rev.map((x) => ({
                        date: x.date || x.day || x.period || "",
                        amount: toNumber(x.amount ?? x.total, 0),
                    }))
                );

                setPayouts(
                    pay.map((x) => ({
                        id: x.id || x._id || x.payoutId || "",
                        amount: toNumber(x.amount, 0),
                        status: (x.status || "scheduled").toLowerCase(),
                        createdAt: x.createdAt || x.date || x.created_on || new Date().toISOString(),
                    }))
                );

                setUnpaid(toNumber(sum.pendingPayout, 0));
            } catch (err) {
                // Beta/development fallback
                setSummary({
                    totalRevenue: 0,
                    monthRevenue: 0,
                    totalBookings: 0,
                    pendingPayout: 0,
                    refunds: 0,
                    currency: "INR",
                });
                setRevenue([]);
                setPayouts([]);
                setUnpaid(0);
                setToast({ open: true, type: "warning", message: "Finance API not available. Showing beta view." });
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => {
            ignore = true;
        };
    }, []);

    const currency = summary?.currency || "INR";
    const kpis = useMemo(
        () => [
            { label: "Total revenue", value: money(summary?.totalRevenue, currency) },
            { label: "Last 30 days", value: money(summary?.monthRevenue, currency) },
            { label: "Total bookings", value: String(summary?.totalBookings ?? 0) },
            { label: "Pending payout", value: money(summary?.pendingPayout, currency) },
            { label: "Refunds", value: money(summary?.refunds, currency) },
        ],
        [summary, currency]
    );

    return (
        <div className="page" style={{ padding: 24 }}>
            <h1>Finance</h1>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                    <Spinner /> <span>Loading finance…</span>
                </div>
            ) : (
                <>
                    {/* KPIs */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                            gap: 12,
                            marginTop: 12,
                        }}
                    >
                        {kpis.map((k) => (
                            <div key={k.label} className="card" style={{ padding: 16 }}>
                                <div className="muted small">{k.label}</div>
                                <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{k.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Revenue list (simple beta table; swap to chart later) */}
                    <div className="card" style={{ marginTop: 12, padding: 0 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>Revenue (last 30 days)</strong>
                        </div>
                        {revenue.length === 0 ? (
                            <div style={{ padding: 12 }} className="muted">
                                No revenue data.
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr className="muted small" style={{ textAlign: "left" }}>
                                        <th style={{ padding: "8px 12px" }}>Date</th>
                                        <th style={{ padding: "8px 12px" }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {revenue.map((d, i) => (
                                        <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                            <td style={{ padding: "8px 12px" }}>{formatDate(d.date)}</td>
                                            <td style={{ padding: "8px 12px" }}>{money(d.amount, currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Payouts */}
                    <div className="card" style={{ marginTop: 12, padding: 0 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>Payouts</strong>
                        </div>
                        {payouts.length === 0 ? (
                            <div style={{ padding: 12 }} className="muted">
                                No payouts yet.
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr className="muted small" style={{ textAlign: "left" }}>
                                        <th style={{ padding: "8px 12px" }}>Payout ID</th>
                                        <th style={{ padding: "8px 12px" }}>Created</th>
                                        <th style={{ padding: "8px 12px" }}>Amount</th>
                                        <th style={{ padding: "8px 12px" }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payouts.map((p, i) => (
                                        <tr key={p.id || i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                            <td style={{ padding: "8px 12px" }}>{p.id || "-"}</td>
                                            <td style={{ padding: "8px 12px" }}>{formatDate(p.createdAt)}</td>
                                            <td style={{ padding: "8px 12px" }}>{money(p.amount, currency)}</td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <span className="small" style={{ fontWeight: 600, color: colorFor(p.status) }}>
                                                    {p.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Actions (beta) */}
                    <div
                        className="card"
                        style={{ marginTop: 12, padding: 12, display: "flex", gap: 8, alignItems: "center" }}
                    >
                        <div className="muted small">Unpaid balance</div>
                        <div style={{ fontWeight: 700 }}>{money(unpaid, currency)}</div>
                        <button className="btn-secondary" onClick={requestPayout} disabled={!unpaid || unpaid <= 0}>
                            Request payout
                        </button>
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

    async function requestPayout() {
        try {
            const res = await http.post("/owner/finance/payouts", { amount: unpaid });
            const msg = res.data?.message || "Payout requested";
            setToast({ open: true, type: "success", message: msg });
        } catch (err) {
            setToast({
                open: true,
                type: "error",
                message: err?.response?.data?.message || err?.message || "Payout request failed",
            });
        }
    }
}

/* ---------- helpers ---------- */
function toNumber(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}

function money(v, currency = "INR") {
    const n = Number(v || 0);
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(n);
}
function formatDate(d) {
    if (!d) return "-";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleString();
}
function colorFor(status) {
    switch ((status || "").toLowerCase()) {
        case "paid":
        case "completed":
        case "success":
            return "green";
        case "failed":
        case "declined":
            return "crimson";
        case "pending":
        case "processing":
        case "scheduled":
            return "#8a6d3b";
        default:
            return "#334155";
    }
}
