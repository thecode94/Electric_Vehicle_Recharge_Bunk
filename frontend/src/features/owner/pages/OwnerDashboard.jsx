import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthProvider";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";

export default function OwnerDashboard() {
    const { user } = useAuth();
    const [owner, setOwner] = useState(user);
    const [stations, setStations] = useState([]);
    const [finance, setFinance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });

    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    useEffect(() => {
        let ignore = false;

        async function load() {
            try {
                setLoading(true);

                const [meRes, stRes, finRes] = await Promise.allSettled([
                    http.get("/owners/me"),
                    http.get("/stations/mine"),
                    http.get("/finance/summary"),
                ]);

                if (ignore) return;

                if (meRes.status === "fulfilled") {
                    setOwner(meRes.value.data.owner || meRes.value.data);
                }
                if (stRes.status === "fulfilled") {
                    const list = Array.isArray(stRes.value.data.stations)
                        ? stRes.value.data.stations
                        : stRes.value.data || [];
                    setStations(list);
                }
                if (finRes.status === "fulfilled") {
                    setFinance(finRes.value.data);
                }
            } catch (err) {
                setToast({
                    open: true,
                    type: "error",
                    message: err.message || "Failed to load dashboard",
                });
            } finally {
                setLoading(false);
            }
        }

        load();
        return () => {
            ignore = true;
        };
    }, []);

    const f = finance || {};
    const today = f.today || f.daily || {};
    const month = f.month || f.monthly || {};
    const total = f.total || {};

    return (
        <div className="page" style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
            <h1>Owner Dashboard</h1>
            <p className="muted small">
                Welcome{owner?.name ? `, ${owner.name}` : ""}. Manage stations, bookings, and payouts.
            </p>

            {loading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                    <Spinner /> <span>Loading dashboard…</span>
                </div>
            ) : (
                <>
                    <div
                        className="grid"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 12,
                            marginTop: 12,
                        }}
                    >
                        <StatCard label="Today's Revenue" value={fmtMoney(today.amount || 0)} sub={today.count ? `${today.count} bookings` : ""} />
                        <StatCard label="This Month" value={fmtMoney(month.amount || 0)} sub={month.count ? `${month.count} bookings` : ""} />
                        <StatCard label="All‑time Revenue" value={fmtMoney(total.amount || 0)} sub={total.count ? `${total.count} bookings` : ""} />
                        <StatCard label="Stations" value={stations.length} sub="active" />
                    </div>

                    <div className="card" style={{ padding: 16, marginTop: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 style={{ margin: 0, fontSize: 18 }}>Your Stations</h2>
                            <Link to="/owner/stations/create" className="btn-primary">Add Station</Link>
                        </div>

                        {stations.length === 0 ? (
                            <div className="muted" style={{ marginTop: 12 }}>
                                No stations yet. Click “Add Station” to create your first one.
                            </div>
                        ) : (
                            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                                {stations.map((s, i) => {
                                    const id = s.id || s._id || `s${i}`;
                                    const name = s.name || s.title || s.stationName || "Station";
                                    const addr = s.address || s.formattedAddress || "";
                                    const status = s.status || (s.active ? "active" : "inactive");

                                    return (
                                        <li
                                            key={id}
                                            style={{
                                                padding: "12px 0",
                                                borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                                                display: "grid",
                                                gridTemplateColumns: "1fr auto",
                                                gap: 12,
                                                alignItems: "center",
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{name}</div>
                                                {addr && <div className="muted small">{addr}</div>}
                                                <div className="muted small">Status: {status}</div>
                                            </div>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <Link to={`/stations/${encodeURIComponent(id)}`} className="btn-secondary">
                                                    View
                                                </Link>
                                                <Link to={`/owner/stations/new`} state={{ editId: id }} className="btn-secondary">
                                                    Edit
                                                </Link>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <Link to="/owner/finance" className="btn-secondary">View Finance</Link>
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


function StatCard({ label, value, sub }) {
    return (
        <div className="card" style={{ padding: 16 }}>
            <div className="muted small">{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
            {sub && <div className="muted small">{sub}</div>}
        </div>
    );
}

function fmtMoney(n) {
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
    } catch {
        return `₹ ${Number(n || 0).toLocaleString()}`;
    }
}
