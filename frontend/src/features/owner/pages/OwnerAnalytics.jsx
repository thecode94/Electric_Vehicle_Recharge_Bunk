// src/features/owner/pages/OwnerAnalytics.jsx
import { useEffect, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function OwnerAnalytics() {
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast(t => ({ ...t, open: false }));

    // Simple metrics for owners
    const [kpi, setKpi] = useState({
        stations: 0,
        bookings30d: 0,
        revenue30d: 0,
        currency: "INR",
    });

    // Top stations by bookings
    const [topStations, setTopStations] = useState([]); // [{name, bookings, revenue}]

    useEffect(() => {
        let ignore = false;
        async function load() {
            try {
                setLoading(true);

                // Try preferred endpoints; gracefully fall back to beta mode
                let s, t;
                try {
                    s = await http.get("/owner/analytics/kpis");
                } catch {
                    try {
                        s = await http.get("/owners/me/analytics/kpis");
                    } catch {
                        s = { data: null };
                    }
                }
                try {
                    t = await http.get("/owner/analytics/top-stations", { params: { limit: 10, range: "30d" } });
                } catch {
                    t = { data: [] };
                }

                if (ignore) return;

                const sum = s.data || {};
                const tops = Array.isArray(t.data) ? t.data : t.data?.items || [];

                setKpi({
                    stations: Number(sum.stations ?? sum.totalStations ?? 0),
                    bookings30d: Number(sum.bookings30d ?? sum.last30DaysBookings ?? 0),
                    revenue30d: Number(sum.revenue30d ?? sum.last30DaysRevenue ?? 0),
                    currency: sum.currency || "INR",
                });

                setTopStations(
                    tops.map(x => ({
                        id: x.id || x._id,
                        name: x.name || x.stationName || "Station",
                        bookings: Number(x.bookings ?? 0),
                        revenue: Number(x.revenue ?? 0),
                    }))
                );
            } catch (err) {
                setToast({ open: true, type: "warning", message: "Analytics API not available. Showing beta view." });
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => { ignore = true; };
    }, []);[]

    const money = (v) =>
        new Intl.NumberFormat("en-IN", { style: "currency", currency: kpi.currency || "INR" }).format(Number(v || 0));

    return (
        <div className="page" style={{ padding: 24 }}>
            <h1>Owner Analytics</h1>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                    <Spinner /> <span>Loading analytics…</span>
                </div>
            ) : (
                <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 12 }}>
                        <div className="card" style={{ padding: 16 }}>
                            <div className="muted small">Stations</div>
                            <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{kpi.stations}</div>
                        </div>
                        <div className="card" style={{ padding: 16 }}>
                            <div className="muted small">Bookings (30d)</div>
                            <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{kpi.bookings30d}</div>
                        </div>
                        <div className="card" style={{ padding: 16 }}>
                            <div className="muted small">Revenue (30d)</div>
                            <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{money(kpi.revenue30d)}</div>
                        </div>
                    </div>

                    <div className="card" style={{ marginTop: 12, padding: 0 }}>
                        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                            <strong>Top Stations (30d)</strong>
                        </div>
                        {topStations.length === 0 ? (
                            <div style={{ padding: 12 }} className="muted">No data.</div>
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
                                            <td style={{ padding: "8px 12px" }}>{money(s.revenue)}</td>
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
