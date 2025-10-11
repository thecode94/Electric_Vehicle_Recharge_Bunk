// src/features/owner/pages/OwnerStations.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import http from "../../../utils/http";
import Spinner from "../../../components/Spinner";
import Toast from "../../../components/Toast";
import { getMyStations } from "../../../services/stationService";

export default function OwnerStations() {
    const navigate = useNavigate();
    const [list, setList] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [toast, setToast] = useState({ open: false, type: "info", message: "" });
    const onCloseToast = () => setToast((t) => ({ ...t, open: false }));

    // Normalize any station-like object from API/demo/firestore into a consistent shape
    const normalizeStation = (s) => {
        if (!s) return null;
        const id =
            s.id ||
            s.stationId ||
            s._id ||
            s.slug ||
            (s.metadata && s.metadata.id) ||
            `st_${Math.random().toString(36).slice(2)}`;

        const address =
            s.address ||
            s.formattedAddress ||
            s.location?.address ||
            (typeof s.location === "string" ? s.location : "") ||
            "";

        const price =
            s.pricePerKwh ??
            s.tariff ??
            s.price ??
            s.pricing?.perKwh ??
            s.pricing?.price ??
            null;

        const active =
            typeof s.active === "boolean"
                ? s.active
                : (s.status || "").toLowerCase() === "active";

        return {
            ...s,
            id,
            address,
            pricePerKwh: price,
            active,
            name: s.name || s.title || "EV Station",
        };
    };

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                setLoading(true);
                // Prefer the service which already normalizes response shapes
                const { stations, raw } = await getMyStations({ limit: 50 });

                if (ignore) return;

                // Fall back defensively if shape differs
                const source =
                    (Array.isArray(stations) && stations.length ? stations :
                        Array.isArray(raw?.stations) ? raw.stations :
                            Array.isArray(raw?.items) ? raw.items :
                                Array.isArray(raw) ? raw : []);

                const normalized = source
                    .map(normalizeStation)
                    .filter(Boolean);

                setList(normalized);
            } catch (err) {
                const msg =
                    err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    err?.normalizedMessage ||
                    err?.message ||
                    "Failed to load stations";
                setToast({ open: true, type: "error", message: msg });
            } finally {
                setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, []);

    const filtered = useMemo(() => {
        if (!query.trim()) return list;
        const q = query.toLowerCase();
        return list.filter((s) => {
            const name = (s.name || "").toLowerCase();
            const addr = (s.address || "").toLowerCase();
            return name.includes(q) || addr.includes(q);
        });
    }, [list, query]);

    async function toggleActive(id, current) {
        try {
            setBusyId(id);
            await http.patch(`/stations/${encodeURIComponent(id)}`, { active: !current });
            setList((prev) =>
                prev.map((s) => (s.id === id ? { ...s, active: !current } : s))
            );
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                "Failed to update status";
            setToast({ open: true, type: "error", message: msg });
        } finally {
            setBusyId(null);
        }
    }

    async function removeStation(id) {
        if (!confirm("Delete this station? This cannot be undone.")) return;
        try {
            setBusyId(id);
            await http.delete(`/stations/${encodeURIComponent(id)}`);
            setList((prev) => prev.filter((s) => s.id !== id));
            setToast({ open: true, type: "success", message: "Station deleted" });
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                "Failed to delete station";
            setToast({ open: true, type: "error", message: msg });
        } finally {
            setBusyId(null);
        }
    }

    function onCreate() {
        navigate("/owner/stations/create");
    }
    function onEdit(station) {
        navigate(`/owner/stations/${encodeURIComponent(station.id)}/edit`);
    }

    return (
        <div className="page" style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
            <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
            >
                <h1 style={{ margin: 0 }}>My Stations</h1>
                <button className="btn-primary" onClick={onCreate}>+ Add Station</button>
            </div>

            <div className="card" style={{ padding: 12, marginTop: 12 }}>
                <input
                    type="text"
                    placeholder="Search by name or address…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            <div className="card" style={{ padding: 0, marginTop: 12 }}>
                {loading ? (
                    <div style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
                        <Spinner /> <span>Loading…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 16 }}>
                        <div className="muted">No stations found.</div>
                        <div style={{ marginTop: 8 }}>
                            <button className="btn-primary" onClick={onCreate}>Create your first station</button>
                        </div>
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ textAlign: "left" }}>
                                <th style={{ padding: "10px 12px" }}>Name</th>
                                <th style={{ padding: "10px 12px" }}>Address</th>
                                <th style={{ padding: "10px 12px" }}>Tariff</th>
                                <th style={{ padding: "10px 12px" }}>Status</th>
                                <th style={{ padding: "10px 12px" }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((s) => (
                                <tr key={s.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{s.name}</td>
                                    <td style={{ padding: "10px 12px" }}>
                                        <div className="small">{s.address || "-"}</div>
                                    </td>
                                    <td style={{ padding: "10px 12px" }}>
                                        {s.pricePerKwh != null ? `₹ ${s.pricePerKwh}/kWh` : "-"}
                                    </td>
                                    <td style={{ padding: "10px 12px" }}>
                                        <span
                                            className="small"
                                            style={{ color: s.active ? "green" : "crimson", fontWeight: 600 }}
                                        >
                                            {s.active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td style={{ padding: "10px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <Link to={`/stations/${encodeURIComponent(s.id)}`} className="btn-secondary">
                                            View
                                        </Link>
                                        <button className="btn-secondary" onClick={() => onEdit(s)}>
                                            Edit
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            disabled={busyId === s.id}
                                            onClick={() => toggleActive(s.id, s.active)}
                                        >
                                            {busyId === s.id ? "…" : s.active ? "Deactivate" : "Activate"}
                                        </button>
                                        <button
                                            className="btn-danger"
                                            disabled={busyId === s.id}
                                            onClick={() => removeStation(s.id)}
                                        >
                                            {busyId === s.id ? "…" : "Delete"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {toast.open && (
                <Toast type={toast.type} onClose={onCloseToast}>
                    {toast.message}
                </Toast>
            )}
        </div>
    );
}
