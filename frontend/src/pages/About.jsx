// src/pages/About.jsx
export default function About() {
    return (
        <div className="page" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
            <h1>About EV Recharge</h1>
            <p className="muted">
                EV Recharge is a platform to discover charging stations, plan trips, and book charging
                slots with secure payments. Station owners get tools to manage listings, pricing, and payouts.
            </p>

            <div className="card" style={{ padding: 16, marginTop: 12 }}>
                <h2 style={{ marginTop: 0, fontSize: 18 }}>What you can do</h2>
                <ul style={{ margin: "8px 0 0 18px" }}>
                    <li>Search nearby charging stations and view details like tariffs and connector types.</li>
                    <li>Plan trips and estimate distance/ETA between origin and destination.</li>
                    <li>Book a time slot and pay online, then track booking status.</li>
                    <li>Owners can add/manage stations, monitor revenue, and view payouts.</li>
                </ul>
            </div>

            <div className="card" style={{ padding: 16, marginTop: 12 }}>
                <h2 style={{ marginTop: 0, fontSize: 18 }}>How it works</h2>
                <ol style={{ margin: "8px 0 0 18px" }}>
                    <li>Find a station via <strong>Search</strong> or the <strong>Planner</strong>.</li>
                    <li>Open the station page to review details and availability.</li>
                    <li>Click <strong>Book a Slot</strong>, choose a start time and duration, and confirm.</li>
                    <li>Complete payment (if required) to finalize the booking.</li>
                </ol>
            </div>

            <div className="card" style={{ padding: 16, marginTop: 12 }}>
                <h2 style={{ marginTop: 0, fontSize: 18 }}>Contact</h2>
                <p className="muted small">
                    For support or partnership inquiries, write to <a href="mailto:support@evrecharge.com">support@evrecharge.com</a>.
                </p>
            </div>
        </div>
    );
}
