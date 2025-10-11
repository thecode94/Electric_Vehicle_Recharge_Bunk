// src/pages/NotFound.jsx
import { Link, useLocation } from "react-router-dom";

export default function NotFound() {
    const { pathname } = useLocation();

    return (
        <div className="page" style={{ maxWidth: 720, margin: "0 auto", padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1 }}>404</div>
            <h1 style={{ marginTop: 8 }}>Page not found</h1>
            <p className="muted">
                We couldn’t find <code style={{ fontFamily: "monospace" }}>{pathname}</code>.
                It might have been moved or deleted.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                <Link to="/" className="btn-primary">Go home</Link>
                <Link to="/search" className="btn-secondary">Find stations</Link>
            </div>
        </div>
    );
}
