import { useEffect, useState } from "react";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";
import { Link } from "react-router-dom";

/**
 * Admin Dashboard
 * Tries endpoints in order:
 *  1) GET /admin/summary
 *  2) GET /admin/summary/stats
 *  3) GET /admin/dashboard
 *
 * Supports shapes:
 * A) {
 *   users: { total, activeToday, newThisMonth },
 *   stations: { total, active, pendingReview },
 *   bookings: { total, today, month },
 *   revenue: { today, month, total }
 * }
 *
 * B) {
 *   success: true,
 *   dashboard: {
 *     overview: { totalStations, activeStations, totalUsers, totalBookings },
 *     revenue: { totalRevenue, platformProfit, ownerPayouts, profitMargin },
 *     period, generatedAt
 *   }
 * }
 */
export default function AdminDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            try {
                // Try primary
                let res = await safeGet("/admin/summary");
                if (!res) res = await safeGet("/admin/summary/stats");
                if (!res) res = await safeGet("/admin/dashboard");
                if (!ignore) setData(res ?? {});
            } catch (err) {
                if (!ignore) {
                    const msg =
                        err?.response?.data?.message ||
                        err?.response?.data?.error ||
                        err?.message ||
                        "Failed to load admin summary";
                    setToast({ open: true, type: "error", message: msg });
                    setData({});
                }
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, []);

    const s = normalize(data);

    return (
        <div className="page" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
            <h1>Admin Dashboard</h1>
            <p className="muted small">Platform-wide overview of users, stations, bookings, and revenue.</p>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                    <Spinner /> <span>Loading…</span>
                </div>
            ) : (
                <>
                    {/* Top stats */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 12,
                            marginTop: 12,
                        }}
                    >
                        <Card
                            label="Users"
                            value={fmt(s.users.total)}
                            sub={`${fmt(s.users.newThisMonth)} new this month`}
                            to="/admin/users"
                        />
                        <Card
                            label="Active Today"
                            value={fmt(s.users.activeToday)}
                            sub="unique users"
                            to="/admin/users"
                        />
                        <Card
                            label="Stations"
                            value={fmt(s.stations.total)}
                            sub={`${fmt(s.stations.active)} active`}
                            to="/admin/stations"
                        />
                        <Card
                            label="Pending Review"
                            value={fmt(s.stations.pendingReview)}
                            sub="awaiting approval"
                            to="/admin/stations"
                        />
                        <Card
                            label="Bookings (today)"
                            value={fmt(s.bookings.today)}
                            sub={`Month: ${fmt(s.bookings.month)}`}
                            to="/admin/bookings"
                        />
                        <Card
                            label="Revenue (today)"
                            value={fmtMoney(s.revenue.today)}
                            sub={`Month: ${fmtMoney(s.revenue.month)}`}
                            to="/admin/finance"
                        />
                    </div>

                    {/* Quick links */}
                    <div className="card" style={{ padding: 16, marginTop: 16 }}>
                        <h2 style={{ marginTop: 0, fontSize: 18 }}>Quick Actions</h2>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                            <Link className="btn-secondary" to="/admin/users">Manage Users</Link>
                            <Link className="btn-secondary" to="/admin/stations">Moderate Stations</Link>
                            <Link className="btn-secondary" to="/admin/bookings">View Bookings</Link>
                            <Link className="btn-secondary" to="/admin/settings">System Settings</Link>
                        </div>
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

function Card({ label, value, sub, to }) {
    const content = (
        <div className="card" style={{ padding: 16 }}>
            <div className="muted small">{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
            {sub && <div className="muted small">{sub}</div>}
        </div>
    );
    if (to) {
        return (
            <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>
                {content}
            </Link>
        );
    }
    return content;
}

/** fetch helper that returns data or null */
async function safeGet(path) {
    try {
        const res = await http.get(path);
        return res?.data ?? null;
    } catch {
        return null;
    }
}

/** Null‑safe normalizer covering both shapes A & B */
function normalize(d) {
    const src = d || {};
    const dash = src.dashboard || {};

    // If "dashboard.overview" exists (controller shape B)
    if (dash.overview || dash.revenue) {
        const ov = dash.overview || {};
        const rev = dash.revenue || {};
        return {
            users: {
                total: ov.totalUsers ?? 0,
                activeToday: src.users?.activeToday ?? 0,
                newThisMonth: src.users?.newThisMonth ?? 0,
            },
            stations: {
                total: ov.totalStations ?? 0,
                active: ov.activeStations ?? 0,
                pendingReview: src.stations?.pendingReview ?? 0,
            },
            bookings: {
                total: ov.totalBookings ?? 0,
                today: src.bookings?.today ?? 0,
                month: src.bookings?.month ?? 0,
            },
            revenue: {
                today: src.revenue?.today ?? 0,
                month: src.revenue?.month ?? 0,
                total: rev.totalRevenue ?? src.revenue?.total ?? 0,
            },
        };
    }

    // Otherwise fall back to shape A (flat summary)
    return {
        users: {
            total: src.users?.total ?? src.usersTotal ?? src.totals?.users ?? 0,
            activeToday: src.users?.activeToday ?? src.activeUsersToday ?? 0,
            newThisMonth: src.users?.newThisMonth ?? src.newUsersThisMonth ?? 0,
        },
        stations: {
            total: src.stations?.total ?? src.stationsTotal ?? src.totals?.stations ?? 0,
            active: src.stations?.active ?? src.activeStations ?? 0,
            pendingReview: src.stations?.pendingReview ?? src.pendingStations ?? 0,
        },
        bookings: {
            total: src.bookings?.total ?? src.bookingsTotal ?? src.totals?.bookings ?? 0,
            today: src.bookings?.today ?? src.bookingsToday ?? 0,
            month: src.bookings?.month ?? src.bookingsThisMonth ?? 0,
        },
        revenue: {
            today: src.revenue?.today ?? src.revenueToday ?? 0,
            month: src.revenue?.month ?? src.revenueThisMonth ?? 0,
            total: src.revenue?.total ?? src.totalRevenue ?? 0,
        },
    };
}

function fmt(n) {
    return Number(n || 0).toLocaleString();
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
