// src/pages/Help.jsx
import { Link } from "react-router-dom";

export default function Help() {
    return (
        <div className="page" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
            <h1>Help & Support</h1>
            <p className="muted">
                Stuck somewhere? Here are answers to common questions. If you still need help,
                email <a href="mailto:support@evrecharge.com">support@evrecharge.com</a>.
            </p>

            {/* FAQ */}
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
                <h2 style={{ marginTop: 0, fontSize: 18 }}>Frequently Asked Questions</h2>
                <FAQ q="How do I find nearby stations?">
                    Go to <Link to="/search">Search</Link> and type a city, area, or landmark. You’ll see a list of stations with
                    address, tariffs, and connector types.
                </FAQ>

                <FAQ q="How do bookings work?">
                    Open a station, click <strong>Book a Slot</strong>, pick a start time and duration, and confirm.
                    Some bookings may require online payment to finalize.
                </FAQ>

                <FAQ q="My payment succeeded but I didn’t get a confirmation.">
                    Check <Link to="/bookings">My Bookings</Link>. If it still doesn’t show up, contact support with your payment
                    reference and the time of transaction.
                </FAQ>

                <FAQ q="I forgot my password.">
                    Use the <Link to="/forgot">Forgot Password</Link> page to request a reset link. Check spam if you can’t find the email.
                </FAQ>

                <FAQ q="How can I list my own charging station?">
                    Create an owner account at <Link to="/owner/register">Owner Register</Link> and add your station details.
                    Once approved, you can manage pricing, availability, and view payouts.
                </FAQ>
            </div>

            {/* Contact */}
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
                <h2 style={{ marginTop: 0, fontSize: 18 }}>Contact Support</h2>
                <ul style={{ margin: "8px 0 0 18px" }}>
                    <li>Email: <a href="mailto:support@evrecharge.com">support@evrecharge.com</a></li>
                    <li>Phone: <a href="tel:+911234567890">+91 12345 67890</a></li>
                </ul>
            </div>
        </div>
    );
}

function FAQ({ q, children }) {
    return (
        <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{q}</summary>
            <div className="muted small" style={{ marginTop: 6 }}>{children}</div>
        </details>
    );
}
