// src/features/owner/pages/Finance.jsx
import { useEffect, useMemo, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

/**
 * Finance dashboard for owners.
 * Tries common endpoints from financeRoutes:
 *  - GET /api/finance/summary?from=&to=
 *  - GET /api/finance/transactions?cursor=&limit=&from=&to=
 *  - GET /api/finance/payouts
 *
 * Adjust field names to match your backend if needed.
 */
export default function Finance() {
    const [range, setRange] = useState(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 30);
        return {
            from: toInput(from),
            to: toInput(to),
        };
    });

    const [summary, setSummary] = useState(null);
    const [txns, setTxns] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [payouts, setPayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    const query = useMemo(
        () => ({
            from: range.from ? new Date(range.from).toISOString() : undefined,
            to: range.to ? new Date(range.to).toISOString() : undefined,
        }),
        [range]
    );

    async function loadAll({ next = null } = {}) {
        try {
            setLoading(true);

            const [sumRes, txnRes, payRes] = await Promise.allSettled([
                http.get("/finance/summary", { params: query }),
                http.get("/finance/transactions", {
                    params: { ...query, cursor: next || undefined, limit: 20 },
                }),
                http.get("/finance/payouts"),
            ]);

            if (sumRes.status === "fulfilled") setSummary(sumRes.value.data);

            if (txnRes.status === "fulfilled") {
                const data = txnRes.value.data || {};
                const list = Array.isArray(data) ? data : data.items || [];
                setTxns(next ? (prev) => [...prev, ...list] : list);
                setCursor(Array.isArray(data) ? null : data.nextCursor || null);
            }

            if (payRes.status === "fulfilled") {
                const list = Array.isArray(payRes.value.data)
                    ? payRes.value.data
                    : payRes.value.data?.items || [];
                setPayouts(list);
            }
        } catch (err) {
            setToast({
                open: true,
                type: "error",
                message: err.message || "Failed to load finance data",
            });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAll({});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function applyRange(e) {
        e.preventDefault();
        loadAll({});
    }

    const s = normalizeSummary(summary);

    return (
        <div className="page" style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
            <h1>Finance</h1>

            {/* Date range filter */}
            <form
                onSubmit={applyRange}
                className="card"
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, padding: 16, marginTop: 12 }}
            >
                <div>
                    <label className="muted small">From</label>
                    <input
                        type="date"
                        value={range.from}
                        onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                    />
                </div>
                <div>
                    <label className="muted small">To</label>
                    <input
                        type="date"
                        value={range.to}
                        onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                    />
                </div>
                <div style={{ display: "flex", alignItems: "end" }}>
                    <button type="submit" disabled={busy}>
                        {busy ? <Spinner size={16} /> : "Apply"}
                    </button>
                </div>
            </form>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                    <Spinner /> <span>Loading finance…</span>
                </div>
            ) : (
                <>
                    {/* Summary cards */}
                    <div
                        className="grid"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 12,
                            marginTop: 12,
                        }}
                    >
                        <CardStat label="Revenue (range)" value={fmtMoney(s.rangeAmount)} sub={`${s.rangeCount} bookings`} />
                        <CardStat label="Today" value={fmtMoney(s.todayAmount)} sub={`${s.todayCount} bookings`} />
                        <CardStat label="Month" value={fmtMoney(s.monthAmount)} sub={`${s.monthCount} bookings`} />
                        <CardStat label="All‑time" value={fmtMoney(s.totalAmount)} sub={`${s.totalCount} bookings`} />
                    </div>

                    {/* Transactions table */}
                    <div className="card" style={{ padding: 0, marginTop: 16 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>Transactions</strong>
                        </div>
                        {txns.length === 0 ? (
                            <div style={{ padding: 16 }} className="muted">No transactions in this range.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ padding: "10px 16px" }}>Date</th>
                                        <th style={{ padding: "10px 16px" }}>Booking</th>
                                        <th style={{ padding: "10px 16px" }}>Station</th>
                                        <th style={{ padding: "10px 16px" }}>Amount</th>
                                        <th style={{ padding: "10px 16px" }}>Status</th>
                                        <th style={{ padding: "10px 16px" }}>Provider</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {txns.map((t, i) => {
                                        const when = t.createdAt || t.paidAt || t.updatedAt;
                                        const amount = t.amount || t.total || 0;
                                        const currency = t.currency || "INR";
                                        const bookingId = t.bookingId || t.booking?.id || t.booking?._id || "-";
                                        const station = t.station?.name || t.stationName || "-";
                                        const status = t.status || t.paymentStatus || "-";
                                        const provider = t.provider || t.gateway || "-";
                                        return (
                                            <tr key={t.id || t._id || i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                                <td style={{ padding: "10px 16px" }}>{when ? new Date(when).toLocaleString() : "-"}</td>
                                                <td style={{ padding: "10px 16px" }}>{bookingId}</td>
                                                <td style={{ padding: "10px 16px" }}>{station}</td>
                                                <td style={{ padding: "10px 16px" }}>{fmtMoney(amount, currency)}</td>
                                                <td style={{ padding: "10px 16px", textTransform: "capitalize" }}>{status}</td>
                                                <td style={{ padding: "10px 16px" }}>{provider}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}

                        {cursor && (
                            <div style={{ padding: 12 }}>
                                <button onClick={() => loadAll({ next: cursor })}>
                                    Load more
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Payouts */}
                    <div className="card" style={{ padding: 0, marginTop: 16 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>Payouts</strong>
                        </div>
                        {payouts.length === 0 ? (
                            <div style={{ padding: 16 }} className="muted">No payouts yet.</div>
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
                                        const amount = p.amount || 0;
                                        const currency = p.currency || "INR";
                                        const status = p.status || p.state || "-";
                                        const method = p.method || p.channel || "-";
                                        return (
                                            <tr key={p.id || p._id || i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                                <td style={{ padding: "10px 16px" }}>{when ? new Date(when).toLocaleString() : "-"}</td>
                                                <td style={{ padding: "10px 16px" }}>{p.id || p._id}</td>
                                                <td style={{ padding: "10px 16px" }}>{fmtMoney(amount, currency)}</td>
                                                <td style={{ padding: "10px 16px", textTransform: "capitalize" }}>{status}</td>
                                                <td style={{ padding: "10px 16px" }}>{method}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
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

function toInput(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

function fmtMoney(n, currency = "INR") {
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(n || 0);
    } catch {
        return `₹ ${Number(n || 0).toLocaleString()}`;
    }
}
