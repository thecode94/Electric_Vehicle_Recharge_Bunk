// src/features/admin/pages/AdminFinance.jsx
import { useEffect, useMemo, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

/**
 * Admin Finance
 * Endpoints (adjust if different):
 *  - GET /api/admin/finance/summary?from=&to=
 *  - GET /api/admin/finance/transactions?cursor=&limit=&from=&to=&status=
 *  - GET /api/admin/finance/payouts?cursor=&limit=
 *
 * Includes a minimal JS-only sparkline (no extra deps).
 */
export default function AdminFinance() {
    const [range, setRange] = useState(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 30);
        return { from: toInput(from), to: toInput(to) };
    });

    const [status, setStatus] = useState("all"); // all|paid|pending|failed|refunded
    const params = useMemo(
        () => ({
            from: range.from ? new Date(range.from).toISOString() : undefined,
            to: range.to ? new Date(range.to).toISOString() : undefined,
            status: status === "all" ? undefined : status,
        }),
        [range, status]
    );

    const [summary, setSummary] = useState(null);
    const [series, setSeries] = useState([]); // [{date, amount}]
    const [txns, setTxns] = useState([]);
    const [tCursor, setTCursor] = useState(null);
    const [payouts, setPayouts] = useState([]);
    const [pCursor, setPCursor] = useState(null);

    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    async function loadAll() {
        try {
            setLoading(true);
            const [sumRes, txnRes, payRes] = await Promise.allSettled([
                http.get("/admin/finance/summary", { params }),
                http.get("/admin/finance/transactions", { params: { ...params, limit: 20 } }),
                http.get("/admin/finance/payouts", { params: { limit: 20 } }),
            ]);

            if (sumRes.status === "fulfilled") {
                const s = sumRes.value.data || {};
                setSummary(s);
                // accept s.series: [{date, amount}] or s.daily[]
                const ser =
                    s.series ||
                    (Array.isArray(s.daily)
                        ? s.daily.map((d) => ({ date: d.date || d.day, amount: d.amount || 0 }))
                        : []);
                setSeries(ser);
            }

            if (txnRes.status === "fulfilled") {
                const data = txnRes.value.data || {};
                const list = Array.isArray(data) ? data : data.items || [];
                setTxns(list);
                setTCursor(Array.isArray(data) ? null : data.nextCursor || null);
            }

            if (payRes.status === "fulfilled") {
                const data = payRes.value.data || {};
                const list = Array.isArray(data) ? data : data.items || [];
                setPayouts(list);
                setPCursor(Array.isArray(data) ? null : data.nextCursor || null);
            }
        } catch (err) {
            setToast({ open: true, type: "error", message: err.message || "Failed to load finance" });
        } finally {
            setLoading(false);
        }
    }

    async function loadMoreTxns() {
        try {
            const res = await http.get("/admin/finance/transactions", {
                params: { ...params, cursor: tCursor || undefined, limit: 20 },
            });
            const data = res.data || {};
            const list = Array.isArray(data) ? data : data.items || [];
            setTxns((prev) => [...prev, ...list]);
            setTCursor(Array.isArray(data) ? null : data.nextCursor || null);
        } catch (err) {
            setToast({ open: true, type: "error", message: err.message || "Failed to load more" });
        }
    }

    async function loadMorePayouts() {
        try {
            const res = await http.get("/admin/finance/payouts", {
                params: { cursor: pCursor || undefined, limit: 20 },
            });
            const data = res.data || {};
            const list = Array.isArray(data) ? data : data.items || [];
            setPayouts((prev) => [...prev, ...list]);
            setPCursor(Array.isArray(data) ? null : data.nextCursor || null);
        } catch (err) {
            setToast({ open: true, type: "error", message: err.message || "Failed to load more payouts" });
        }
    }

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const s = normalizeSummary(summary);

    return (
        <div className="page" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
            <h1>Admin · Finance</h1>

            {/* Filters */}
            <div className="card" style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 8 }}>
                <div>
                    <label className="muted small">From</label>
                    <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                </div>
                <div>
                    <label className="muted small">To</label>
                    <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                </div>
                <div>
                    <label className="muted small">Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        {["all", "paid", "pending", "failed", "refunded"].map((x) => (
                            <option key={x} value={x}>
                                {x[0].toUpperCase() + x.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{ display: "flex", alignItems: "end" }}>
                    <button onClick={loadAll} disabled={loading}>
                        {loading ? <Spinner size={16} /> : "Apply"}
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                    <Spinner /> <span>Loading…</span>
                </div>
            ) : (
                <>
                    {/* Summary cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
                        <Card label="Revenue (range)" value={fmtMoney(s.rangeAmount)} sub={`${s.rangeCount} bookings`} />
                        <Card label="Today" value={fmtMoney(s.todayAmount)} sub={`${s.todayCount} bookings`} />
                        <Card label="This Month" value={fmtMoney(s.monthAmount)} sub={`${s.monthCount} bookings`} />
                        <Card label="All‑time" value={fmtMoney(s.totalAmount)} sub={`${s.totalCount} bookings`} />
                    </div>

                    {/* Sparkline */}
                    <div className="card" style={{ padding: 16, marginTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <strong>Daily Revenue</strong>
                            <span className="muted small">{series.length} days</span>
                        </div>
                        <Sparkline data={series} height={80} />
                    </div>

                    {/* Transactions */}
                    <div className="card" style={{ padding: 0, marginTop: 16 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>Transactions</strong>
                        </div>
                        {txns.length === 0 ? (
                            <div style={{ padding: 16 }} className="muted">
                                No transactions for the selected filters.
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ padding: "10px 16px" }}>Date</th>
                                        <th style={{ padding: "10px 16px" }}>Booking</th>
                                        <th style={{ padding: "10px 16px" }}>User</th>
                                        <th style={{ padding: "10px 16px" }}>Station</th>
                                        <th style={{ padding: "10px 16px" }}>Amount</th>
                                        <th style={{ padding: "10px 16px" }}>Status</th>
                                        <th style={{ padding: "10px 16px" }}>Provider</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {txns.map((t, i) => {
                                        const when = t.createdAt || t.paidAt || t.updatedAt;
                                        const amt = t.amount || t.total || 0;
                                        const booking = t.bookingId || t.booking?._id || t.booking?.id || "-";
                                        const user = t.user?.email || t.userEmail || "-";
                                        const station = t.station?.name || t.stationName || "-";
                                        const status = t.status || t.paymentStatus || "-";
                                        const provider = t.provider || t.gateway || "-";
                                        return (
                                            <tr key={t.id || t._id || i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                                <td style={{ padding: "10px 16px" }}>{when ? new Date(when).toLocaleString() : "-"}</td>
                                                <td style={{ padding: "10px 16px" }}>{booking}</td>
                                                <td style={{ padding: "10px 16px" }}>{user}</td>
                                                <td style={{ padding: "10px 16px" }}>{station}</td>
                                                <td style={{ padding: "10px 16px" }}>{fmtMoney(amt)}</td>
                                                <td style={{ padding: "10px 16px", textTransform: "capitalize" }}>{status}</td>
                                                <td style={{ padding: "10px 16px" }}>{provider}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                        {tCursor && (
                            <div style={{ padding: 12 }}>
                                <button onClick={loadMoreTxns}>Load more</button>
                            </div>
                        )}
                    </div>

                    {/* Payouts */}
                    <div className="card" style={{ padding: 0, marginTop: 16 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>Payouts</strong>
                        </div>
                        {payouts.length === 0 ? (
                            <div style={{ padding: 16 }} className="muted">
                                No payouts found.
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ padding: "10px 16px" }}>Date</th>
                                        <th style={{ padding: "10px 16px" }}>Payout ID</th>
                                        <th style={{ padding: "10px 16px" }}>Amount</th>
                                        <th style={{ padding: "10px 16px" }}>Status</th>
                                        <th style={{ padding: "10px 16px" }}>Method</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payouts.map((p, i) => {
                                        const when = p.createdAt || p.settledAt || p.updatedAt;
                                        const amt = p.amount || 0;
                                        const status = p.status || p.state || "-";
                                        const method = p.method || p.channel || "-";
                                        return (
                                            <tr key={p.id || p._id || i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                                <td style={{ padding: "10px 16px" }}>{when ? new Date(when).toLocaleString() : "-"}</td>
                                                <td style={{ padding: "10px 16px" }}>{p.id || p._id}</td>
                                                <td style={{ padding: "10px 16px" }}>{fmtMoney(amt)}</td>
                                                <td style={{ padding: "10px 16px", textTransform: "capitalize" }}>{status}</td>
                                                <td style={{ padding: "10px 16px" }}>{method}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                        {pCursor && (
                            <div style={{ padding: 12 }}>
                                <button onClick={loadMorePayouts}>Load more</button>
                            </div>
                        )}
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

/* Helpers */
function toInput(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}
function fmtMoney(n, currency = "INR") {
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n || 0);
    } catch {
        return `₹ ${Number(n || 0).toLocaleString()}`;
    }
}
function normalizeSummary(s) {
    if (!s) {
        return {
            rangeAmount: 0, rangeCount: 0,
            todayAmount: 0, todayCount: 0,
            monthAmount: 0, monthCount: 0,
            totalAmount: 0, totalCount: 0,
        };
    }
    return {
        rangeAmount: s.range?.amount ?? s.rangeAmount ?? 0,
        rangeCount: s.range?.count ?? s.rangeCount ?? 0,
        todayAmount: s.today?.amount ?? s.todayAmount ?? 0,
        todayCount: s.today?.count ?? s.todayCount ?? 0,
        monthAmount: s.month?.amount ?? s.monthAmount ?? 0,
        monthCount: s.month?.count ?? s.monthCount ?? 0,
        totalAmount: s.total?.amount ?? s.totalAmount ?? 0,
        totalCount: s.total?.count ?? s.totalCount ?? 0,
    };
}

/** Tiny sparkline (no libs) */
function Sparkline({ data = [], width = 600, height = 80, pad = 4 }) {
    if (!data.length) return <div className="muted small">No data.</div>;
    const xs = data.map((d) => new Date(d.date).getTime());
    const ys = data.map((d) => Number(d.amount || 0));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = 0;
    const maxY = Math.max(...ys) || 1;

    const scaleX = (t) =>
        pad + ((t - minX) / (maxX - minX || 1)) * (width - pad * 2);
    const scaleY = (v) =>
        height - pad - ((v - minY) / (maxY - minY || 1)) * (height - pad * 2);

    const path = xs
        .map((t, i) => `${i === 0 ? "M" : "L"} ${scaleX(t).toFixed(1)} ${scaleY(ys[i]).toFixed(1)}`)
        .join(" ");

    const area = `M ${scaleX(xs[0]).toFixed(1)} ${scaleY(ys[0]).toFixed(1)} ${xs
        .map((t, i) => `L ${scaleX(t).toFixed(1)} ${scaleY(ys[i]).toFixed(1)}`)
        .join(" ")} L ${scaleX(xs[xs.length - 1]).toFixed(1)} ${height - pad} L ${scaleX(xs[0]).toFixed(1)} ${height - pad} Z`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Daily revenue">
            <path d={area} fill="rgba(11,87,208,0.08)" />
            <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}
