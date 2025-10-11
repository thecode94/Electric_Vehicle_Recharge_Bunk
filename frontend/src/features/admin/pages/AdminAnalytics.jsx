// src/features/admin/pages/AdminAnalytics.jsx
import { useEffect, useMemo, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function AdminAnalytics() {
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast(t => ({ ...t, open: false }));

    // Metrics
    const [kpis, setKpis] = useState(null);
    const [seriesUsers, setSeriesUsers] = useState([]);       // [{date, users}]
    const [seriesBookings, setSeriesBookings] = useState([]); // [{date, bookings}]
    const [topStations, setTopStations] = useState([]);       // [{name, bookings, revenue}]
    const [errors, setErrors] = useState([]);                 // [{date, count}]

    useEffect(() => {
        let ignore = false;
        async function load() {
            try {
                setLoading(true);

                // 1) KPIs
                let kRes;
                try { kRes = await http.get("/admin/analytics/kpis"); }
                catch { kRes = { data: null }; }

                // 2) Users & Bookings series (last 30 days)
                let uRes, bRes;
                try { uRes = await http.get("/admin/analytics/users", { params: { range: "30d" } }); }
                catch { uRes = { data: [] }; }
                try { bRes = await http.get("/admin/analytics/bookings", { params: { range: "30d" } }); }
                catch { bRes = { data: [] }; }

                // 3) Top stations
                let tRes;
                try { tRes = await http.get("/admin/analytics/top-stations", { params: { limit: 10, range: "30d" } }); }
                catch { tRes = { data: [] }; }

                // 4) Error counts (14d)
                let eRes;
                try { eRes = await http.get("/admin/analytics/errors", { params: { range: "14d" } }); }
                catch { eRes = { data: [] }; }

                if (ignore) return;

                const k = kRes.data || {};
                const users = Array.isArray(uRes.data) ? uRes.data : uRes.data?.items || [];
                const bookings = Array.isArray(bRes.data) ? bRes.data : bRes.data?.items || [];
                const tops = Array.isArray(tRes.data) ? tRes.data : tRes.data?.items || [];
                const err = Array.isArray(eRes.data) ? eRes.data : eRes.data?.items || [];

                setKpis({
                    totalUsers: k.totalUsers ?? 0,
                    activeUsers: k.activeUsers ?? 0,
                    totalStations: k.totalStations ?? 0,
                    totalBookings: k.totalBookings ?? 0,
                    revenueAllTime: k.revenueAllTime ?? 0,
                    revenue30d: k.revenue30d ?? k.last30Days ?? 0,
                    currency: k.currency || "INR",
                });

                setSeriesUsers(users.map(x => ({ date: x.date || x.day || x.period, users: Number(x.users ?? x.count ?? 0) })));
                setSeriesBookings(bookings.map(x => ({ date: x.date || x.day || x.period, bookings: Number(x.bookings ?? x.count ?? 0) })));
                setTopStations(tops.map(x => ({
                    id: x.id || x._id,
                    name: x.name || x.stationName || "Station",
                    bookings: Number(x.bookings ?? 0),
                    revenue: Number(x.revenue ?? 0),
                })));
                setErrors(err.map(x => ({ date: x.date || x.day || x.period, count: Number(x.count ?? 0) })));
            } catch (e) {
                // Beta fallback
                setKpis({
                    totalUsers: 0, activeUsers: 0, totalStations: 0, totalBookings: 0, revenueAllTime: 0, revenue30d: 0, currency: "INR",
                });
                setSeriesUsers([]); setSeriesBookings([]); setTopStations([]); setErrors([]);
                setToast({ open: true, type: "warning", message: "Analytics API not available. Showing beta view." });
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => { ignore = true; };
    }, []);[]

    const currency = kpis?.currency || "INR";
    const kpiCards = useMemo(() => ([
        { label: "Total users", value: kpis?.totalUsers ?? 0 },
        { label: "Active users", value: kpis?.activeUsers ?? 0 },
        { label: "Stations", value: kpis?.totalStations ?? 0 },
        { label: "Bookings", value: kpis?.totalBookings ?? 0 },
        { label: "Revenue (all)", value: money(kpis?.revenueAllTime, currency) },
        { label: "Revenue (30d)", value: money(kpis?.revenue30d, currency) },
    ]), [kpis, currency]);[]

    return (
        <div className="page" style={{ padding: 24 }}>
            <h1>Admin Analytics</h1>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                    <Spinner /> <span>Loading analytics…</span>
                </div>
            ) : (
                <>
                    {/* KPIs */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 12 }}>
                        {kpiCards.map((k) => (
                            <div key={k.label} className="card" style={{ padding: 16 }}>
                                <div className="muted small">{k.label}</div>
                                <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{k.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Series: Users and Bookings (simple tables for beta; replace with charts later) */}
                    <div className="card" style={{ marginTop: 12, padding: 0 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>Users (30d)</strong>
                        </div>
                        {seriesUsers.length === 0 ? (
                            <div style={{ padding: 12 }} className="muted">No user data.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr className="muted small" style={{ textAlign: "left" }}>
                                        <th style={{ padding: "8px 12px" }}>Date</th>
                                        <th style={{ padding: "8px 12px" }}>Users</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {seriesUsers.map((d, i) => (
                                        <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                            <td style={{ padding: "8px 12px" }}>{formatDate(d.date)}</td>
                                            <td style={{ padding: "8px 12px" }}>{d.users}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="card" style={{ marginTop: 12, padding: 0 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>Bookings (30d)</strong>
                        </div>
                        {seriesBookings.length === 0 ? (
                            <div style={{ padding: 12 }} className="muted">No booking data.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr className="muted small" style={{ textAlign: "left" }}>
                                        <th style={{ padding: "8px 12px" }}>Date</th>
                                        <th style={{ padding: "8px 12px" }}>Bookings</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {seriesBookings.map((d, i) => (
                                        <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                            <td style={{ padding: "8px 12px" }}>{formatDate(d.date)}</td>
                                            <td style={{ padding: "8px 12px" }}>{d.bookings}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Top stations */}
                    <div className="card" style={{ marginTop: 12, padding: 0 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>Top Stations (30d)</strong>
                        </div>
                        {topStations.length === 0 ? (
                            <div style={{ padding: 12 }} className="muted">No station data.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr className="muted small" style={{ textAlign: "left" }}>
                                        <th style={{ padding: "8px 12px" }}>Station</th>
                                        <th style={{ padding: "8px 12px" }}>Bookings</th>
                                        <th style={{ padding: "8px 12px" }}>Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topStations.map((s, i) => (
                                        <tr key={s.id || i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                            <td style={{ padding: "8px 12px" }}>{s.name}</td>
                                            <td style={{ padding: "8px 12px" }}>{s.bookings}</td>
                                            <td style={{ padding: "8px 12px" }}>{money(s.revenue, currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Error counts */}
                    <div className="card" style={{ marginTop: 12, padding: 0 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>System Errors (14d)</strong>
                        </div>
                        {errors.length === 0 ? (
                            <div style={{ padding: 12 }} className="muted">No errors reported.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr className="muted small" style={{ textAlign: "left" }}>
                                        <th style={{ padding: "8px 12px" }}>Date</th>
                                        <th style={{ padding: "8px 12px" }}>Count</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {errors.map((e, i) => (
                                        <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)" }}>
                                            <td style={{ padding: "8px 12px" }}>{formatDate(e.date)}</td>
                                            <td style={{ padding: "8px 12px" }}>{e.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            {toast.open && <Toast type={toast.type} onClose={onCloseToast}>{toast.message}</Toast>}
        </div>
    );
}

function money(v, currency = "INR") {
    const n = Number(v || 0);
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(n);
}
function formatDate(d) {
    if (!d) return "-";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString();
}
