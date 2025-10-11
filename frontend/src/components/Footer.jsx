// src/components/Footer.jsx
import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer
            style={{
                marginTop: "auto",
                padding: "24px 16px",
                background: "#f9f9f9",
                borderTop: "1px solid rgba(0,0,0,0.05)",
            }}
        >
            <div
                style={{
                    maxWidth: 1200,
                    margin: "0 auto",
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    gap: 16,
                    fontSize: 14,
                }}
            >
                {/* Brand & copyright */}
                <div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                        EV Recharge
                    </div>
                    <div className="muted small">
                        © {new Date().getFullYear()} EV Recharge Platform
                    </div>
                </div>

                {/* Links */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <FooterLink to="/about">About</FooterLink>
                    <FooterLink to="/help">Help & Support</FooterLink>
                    <FooterLink to="/terms">Terms</FooterLink>
                    <FooterLink to="/privacy">Privacy</FooterLink>
                </div>

                {/* Contact or social (optional) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div>Contact us:</div>
                    <a href="mailto:support@evrecharge.com" className="muted small">
                        support@evrecharge.com
                    </a>
                    <a href="tel:+911234567890" className="muted small">
                        +91 12345 67890
                    </a>
                </div>
            </div>
        </footer>
    );
}

function FooterLink({ to, children }) {
    return (
        <Link
            to={to}
            style={{
                textDecoration: "none",
                color: "inherit",
                fontSize: 14,
            }}
        >
            {children}
        </Link>
    );
}
