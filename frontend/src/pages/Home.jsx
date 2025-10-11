// src/pages/Home.jsx
import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, useRef } from "react";
import StationMap from "../components/StationMap";
import "../styles/immersive.css";

export default function Home() {
    const [params, setParams] = useSearchParams();

    // URL-synced query
    const qFromUrl = params.get("q") || "";
    const [q, setQ] = useState(qFromUrl);

    // Nearby mode when no query unless user forces it
    const [useNearby, setUseNearby] = useState(() => !qFromUrl);

    // Location permission toggle (UI only)
    const [useLocation, setUseLocation] = useState(false);

    // Sync external URL changes
    useEffect(() => {
        if (qFromUrl !== q) setQ(qFromUrl);
        if (!qFromUrl) setUseNearby(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qFromUrl]);

    const applySearch = useMemo(
        () => () => {
            const next = new URLSearchParams(params);
            const val = q.trim();

            if (val) {
                next.set("q", val);
                setUseNearby(false);
            } else {
                next.delete("q");
            }
            setParams(next, { replace: true });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [q, params]
    );

    // Debounce typing
    const debounceRef = useRef(null);
    useEffect(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => applySearch(), 400);
        return () => clearTimeout(debounceRef.current);
    }, [q, applySearch]);

    // Toggle nearby clears search
    const onToggleNearby = (checked) => {
        setUseNearby(checked);
        if (checked) {
            setQ("");
            const next = new URLSearchParams(params);
            next.delete("q");
            setParams(next, { replace: true });
        }
    };

    // Use my location handler (visual flow only; StationMap can consume geolocation)
    const onUseMyLocation = async () => {
        try {
            setUseLocation(true);
            setQ("");
            const next = new URLSearchParams(params);
            next.delete("q");
            setParams(next, { replace: true });
            setUseNearby(true);
        } catch {
            // noop
        } finally {
            setUseLocation(false);
        }
    };

    // Theme-aware, high-contrast text color fallback
    const textColor = "var(--text-color, #0a0a0a)";

    return (
        <div className="page immersive-bg" style={{ maxWidth: 1100, margin: "0 auto", padding: 24, color: textColor }}>
            <section
                className="card glass hero"
                style={{
                    padding: 24,
                    display: "grid",
                    gridTemplateColumns: "1.1fr 1fr",
                    gap: 16,
                    alignItems: "center",
                    background: "var(--card-bg, #fff)",
                    border: "1px solid var(--card-border, rgba(0,0,0,0.08))",
                    borderRadius: 16
                }}
            >
                <div className="hero-copy">
                    <h1 className="title-xl" style={{ marginTop: 0, color: textColor }}>Recharge smarter. Drive further.</h1>
                    <p className="muted lead" style={{ marginTop: 8 }}>
                        Find EV charging stations, plan trips, and book charging slots with confirmations and payments — all in one place.
                    </p>
                    <div className="cta-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                        <Link to="/search" className="btn-primary btn-raise">Find stations</Link>
                        <Link to="/planner" className="btn-secondary btn-ghost">Open planner</Link>
                    </div>
                </div>

                <div className="hide-on-mobile hero-right">
                    <form
                        onSubmit={(e) => { e.preventDefault(); applySearch(); }}
                        className="search-bar"
                        style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}
                        aria-label="Search for EV charging stations"
                    >
                        <input
                            type="text"
                            aria-label="Search city or area"
                            placeholder="Search city/area…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="input-elevated"
                            style={{ flex: 1, minWidth: 240, color: textColor, background: "var(--input-bg, #fff)" }}
                        />
                        {q && (
                            <button
                                type="button"
                                className="btn-tertiary btn-ghost"
                                onClick={() => { setQ(""); onToggleNearby(true); }}
                                aria-label="Clear search"
                            >
                                Clear
                            </button>
                        )}
                        <button type="submit" className="btn-secondary btn-raise">Go</button>
                    </form>


                    <div
                        className="map-shell"
                        style={{
                            height: 260,
                            borderRadius: 16,
                            overflow: "hidden",
                            border: "1px solid var(--card-border, rgba(0,0,0,0.08))",
                            background: "var(--map-bg, #eef3ff)"
                        }}
                    >
                        {/* Nearby only when toggle ON and URL has no q */}
                        <StationMap
                            query={qFromUrl.trim()}
                            height={260}
                            useNearby={useNearby && !qFromUrl}
                        />
                    </div>
                </div>
            </section>

            <section
                className="feature-grid"
                style={{
                    marginTop: 16,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 12
                }}
            >
                <HomeCard title="Search nearby" text="Find chargers by city, area, or landmark.">
                    <Link to="/search" className="btn-secondary btn-ghost">Search</Link>
                </HomeCard>
                <HomeCard title="Plan a trip" text="Get a quick distance estimate and find stops on the way.">
                    <Link to="/planner" className="btn-secondary btn-ghost">Plan</Link>
                </HomeCard>
                <HomeCard title="Manage bookings" text="View upcoming and past bookings in one place.">
                    <Link to="/bookings" className="btn-secondary btn-ghost">My bookings</Link>
                </HomeCard>
            </section>

            <section
                className="card glass"
                style={{ padding: 16, marginTop: 16, background: "var(--card-bg, #fff)", border: "1px solid var(--card-border, rgba(0,0,0,0.08))", borderRadius: 12 }}
            >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    <Info title="Live availability">Owners can toggle station status and connector availability.</Info>
                    <Info title="Secure payments">Pay online and get instant confirmations and receipts.</Info>
                    <Info title="Owner tools">Station owners manage listings, pricing, and payouts.</Info>
                </div>
            </section>
        </div>
    );
}

function HomeCard({ title, text, children }) {
    return (
        <div
            className="card glass"
            style={{ padding: 16, background: "var(--card-bg, #fff)", border: "1px solid var(--card-border, rgba(0,0,0,0.08))", borderRadius: 12 }}
        >
            <div style={{ fontWeight: 700, color: "var(--text-color, #0a0a0a)" }}>{title}</div>
            <div className="muted small" style={{ marginTop: 6 }}>{text}</div>
            <div style={{ marginTop: 12 }}>{children}</div>
        </div>
    );
}

function Info({ title, children }) {
    return (
        <div>
            <div style={{ fontWeight: 600, color: "var(--text-color, #0a0a0a)" }}>{title}</div>
            <div className="muted small" style={{ marginTop: 4 }}>{children}</div>
        </div>
    );
}
