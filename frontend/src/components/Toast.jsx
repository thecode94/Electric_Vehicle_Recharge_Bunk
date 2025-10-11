// src/components/Toast.jsx
import { useEffect } from "react";

export default function Toast({ type = "info", children, onClose, timeout = 4000 }) {
    useEffect(() => {
        const t = setTimeout(() => onClose?.(), timeout);
        return () => clearTimeout(t);
    }, [onClose, timeout]);

    return (
        <div
            role="status"
            className={`toast toast--${type}`}
            style={{
                position: "fixed",
                right: 16,
                bottom: 16,
                padding: "12px 14px",
                background: type === "error" ? "#fde2e2" : type === "success" ? "#e6ffed" : "#eef2ff",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 8,
                boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
                maxWidth: 360,
            }}
            onClick={onClose}
        >
            {children}
        </div>
    );
}
