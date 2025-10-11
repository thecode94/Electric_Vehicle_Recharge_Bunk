// src/components/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider.jsx";
import Spinner from "./Spinner.jsx";

export default function ProtectedRoute({ roles, children, fallback = "/" }) {
    const { user, loading, isAuthenticated } = useAuth();
    const loc = useLocation();

    // Show loading spinner while auth is resolving
    if (loading) {
        return (
            <div className="page page--center">
                <Spinner size={32} />
                <p className="muted" style={{ marginTop: 16 }}>
                    Checking authentication...
                </p>
            </div>
        );
    }

    // Not signed in → redirect to login (remember where we came from)
    if (!isAuthenticated || !user) {
        return (
            <Navigate
                to="/auth/login"
                replace
                state={{ from: loc.pathname + loc.search }}
            />
        );
    }

    // Optional role-based access control
    if (roles?.length) {
        const userRole = (
            user?.profile?.role ||
            user?.role ||
            user?.type ||
            "user"
        ).toLowerCase();

        const allowedRoles = roles.map((r) => String(r).toLowerCase());

        if (!allowedRoles.includes(userRole)) {
            console.warn(`Access denied: User role "${userRole}" not in allowed roles:`, allowedRoles);

            // Redirect based on user role
            if (userRole === 'admin') {
                return <Navigate to="/admin/dashboard" replace />;
            } else if (userRole === 'owner') {
                return <Navigate to="/owner/dashboard" replace />;
            } else {
                return <Navigate to={fallback} replace />;
            }
        }
    }

    // Auth OK - render children or Outlet for nested routes
    return children ? children : <Outlet />;
}

// Helper wrapper components for specific roles
export function AdminRoute({ children, fallback = "/unauthorized" }) {
    return (
        <ProtectedRoute roles={['admin']} fallback={fallback}>
            {children}
        </ProtectedRoute>
    );
}

export function OwnerRoute({ children, fallback = "/unauthorized" }) {
    return (
        <ProtectedRoute roles={['owner']} fallback={fallback}>
            {children}
        </ProtectedRoute>
    );
}

export function UserRoute({ children, fallback = "/" }) {
    return (
        <ProtectedRoute roles={['user']} fallback={fallback}>
            {children}
        </ProtectedRoute>
    );
}

// Multi-role route (e.g., both admin and owner can access)
export function AdminOrOwnerRoute({ children, fallback = "/unauthorized" }) {
    return (
        <ProtectedRoute roles={['admin', 'owner']} fallback={fallback}>
            {children}
        </ProtectedRoute>
    );
}
