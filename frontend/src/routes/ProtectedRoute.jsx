// src/routes/ProtectedRoute.jsx
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

// Usage patterns:
// <ProtectedRoute />                            // any authenticated
// <ProtectedRoute allowedRoles={["user"]} />    // strict user
// <ProtectedRoute allowedRoles={["owner"]} />   // owner portal
// <ProtectedRoute allowedRoles={["admin"]} />   // admin only

export default function ProtectedRoute({ allowedRoles }) {
    const { user, loading, role: ctxRole } = useAuth();
    const location = useLocation();

    if (loading) return null;

    if (!user) {
        const to = location.pathname.startsWith("/admin")
            ? "/admin/login"
            : location.pathname.startsWith("/owner")
                ? "/owner/login"
                : "/auth/login";
        return <Navigate to={to} replace state={{ from: location }} />;
    }

    const role = (ctxRole || user.role || "user").toLowerCase();

    if (Array.isArray(allowedRoles) && allowedRoles.length) {
        // If route requires admin, only admin allowed
        if (allowedRoles.includes("admin")) {
            if (role !== "admin") {
                return <Navigate to="/auth/login" replace />;
            }
            return <Outlet />;
        }

        // Owner-only area
        if (allowedRoles.includes("owner")) {
            if (role !== "owner" && role !== "admin") {
                // allow admin into owner only if desired; here we don’t
                return <Navigate to="/owner/login" replace />;
            }
            // Optional: block admins from owner UI by design
            if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
            return <Outlet />;
        }

        // Strict user area (no owners/admins)
        if (allowedRoles.includes("user")) {
            if (role !== "user") {
                const fallback =
                    role === "admin" ? "/admin/dashboard" : role === "owner" ? "/owner/dashboard" : "/auth/login";
                return <Navigate to={fallback} replace />;
            }
            return <Outlet />;
        }
    }

    // Default: any authenticated user
    return <Outlet />;
}
