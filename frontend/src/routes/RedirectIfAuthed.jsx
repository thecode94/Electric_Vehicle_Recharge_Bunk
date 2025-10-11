import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthProvider.jsx";

export default function RedirectIfAuthed() {
    const { user, loading } = useAuth();
    const loc = useLocation();

    if (loading) return null; // avoid flicker
    return user ? (
        <Navigate to={loc.state?.from || "/"} replace />
    ) : (
        <Outlet />
    );
}
