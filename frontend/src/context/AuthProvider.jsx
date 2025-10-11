// src/context/AuthProvider.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import http from "../utils/http";

const AuthContext = createContext(null);

/* ------------------------- Admin token helpers ------------------------- */
const ADMIN_TOKEN_KEY = "adminToken";

function applyAdminTokenHeader(token) {
    if (token) {
        // your middleware accepts this; http.js interceptor will also add Bearer
        http.defaults.headers.common["x-admin-token"] = token;
    } else {
        try {
            delete http.defaults?.headers?.common?.["x-admin-token"];
        } catch {/* ignore */ }
    }
}

function setAdminToken(token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    applyAdminTokenHeader(token);
}

function getAdminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function clearAdminToken() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    applyAdminTokenHeader(null);
}

/* ------------------------------ API calls ----------------------------- */
// Helpers to call correct endpoints
async function postLogin(mode, creds) {
    if (mode === "admin") {
        // NOTE: we need access to both data and headers
        const res = await http.post("/admin/auth/login", creds);
        const data = res?.data || {};
        const hdrs = res?.headers || {};

        // 🔐 Robust token extraction for your current response shape:
        // {
        //   success: true,
        //   admin: {...},
        //   tokens: { accessToken, refreshToken, expiresIn }
        // }
        const token =
            data?.tokens?.accessToken ||
            data?.accessToken ||
            data?.token ||
            data?.data?.token ||
            hdrs["x-admin-token"] ||
            hdrs["X-Admin-Token"];

        if (token) setAdminToken(token);
        return data;
    }
    if (mode === "owner") {
        const { data } = await http.post("/owners/login", creds);
        return data;
    }
    const { data } = await http.post("/auth/login", creds);
    return data;
}

async function fetchMeFor(modeHint) {
    // Try richer, role-specific “me” first, then fall back
    try {
        if (modeHint === "admin") {
            const { data } = await http.get("/admin/auth/me");
            return { ...data, role: "admin", isAdmin: true };
        }
    } catch { }
    try {
        // Owner
        const { data } = await http.get("/owners/me");
        // If owner/me returned plain owner doc, wrap minimally
        if (data && !data.ok && !data.user) {
            return { ok: true, role: "owner", isOwner: true, owner: data };
        }
        return data;
    } catch { }
    // User
    const { data } = await http.get("/users/me");
    return data;
}

function normalizeMe(me) {
    // Accepts shapes from /users/me, /owners/me, /admin/auth/me
    if (!me) return { user: null, role: null };

    // Admin me
    if (me.isAdmin || me.role === "admin") {
        return {
            role: "admin",
            user: {
                uid: me.uid || me.user?.uid || null,
                email: me.email || me.user?.email || null,
                isAdmin: true,
                isOwner: false,
                role: "admin",
                profile: me.profile || me.user?.profile || null,
            },
        };
    }

    // Users route: { success, user: { ... } }
    if ("success" in me && me.user) {
        return { role: me.user.isOwner ? "owner" : (me.user.role || "user"), user: me.user };
    }

    // Owners/me sometimes returns the owner doc only; wrap minimally
    if (me.owner || me.displayName || me.verified !== undefined) {
        return {
            role: "owner",
            user: {
                uid: me.uid || null,
                email: me.email || null,
                isOwner: true,
                isAdmin: false,
                role: "owner",
                profile: { name: me.displayName, email: me.email, phone: me.phone, createdAt: me.createdAt },
            },
        };
    }

    // Fallback generic
    const role = me.role || me.profile?.role || me.user?.role || "user";
    return {
        role,
        user: me.user
            ? { ...me.user, role }
            : { uid: me.uid || null, email: me.email || null, role, profile: me.profile || null },
    };
}

export function AuthProvider({ children }) {
    const navigate = useNavigate();
    const location = useLocation();

    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Bootstrap session
    useEffect(() => {
        // Make sure any persisted admin token is applied before hitting /admin/auth/me
        applyAdminTokenHeader(getAdminToken());

        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                setError(null);

                // Prefer the richest endpoint sequence: admin -> owner -> user
                let me = null;
                try {
                    const { data } = await http.get("/admin/auth/me");
                    me = { ...data, role: "admin", isAdmin: true };
                } catch { }
                if (!me) {
                    try {
                        const { data } = await http.get("/owners/me");
                        me = data;
                    } catch { }
                }
                if (!me) {
                    const { data } = await http.get("/users/me");
                    me = data;
                }

                if (!mounted) return;

                const n = normalizeMe(me);
                setRole(n.role);
                setUser(n.user);
            } catch {
                if (!mounted) return;
                setUser(null);
                setRole(null);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Login
    const login = useCallback(
        async (mode, creds) => {
            try {
                setLoading(true);
                setError(null);

                // Clear stale cache before new login
                try {
                    await http.post("/auth/logout");
                } catch { }

                const data = await postLogin(mode, creds); // sets cookie and (admin) header/token when mode === "admin"

                // After server sets session, fetch role-specific me
                const me = await fetchMeFor(mode);
                const n = normalizeMe(me);

                // Ensure the role matches the tab intent
                const intended = mode === "admin" ? "admin" : mode === "owner" ? "owner" : "user";
                if (n.role !== intended) {
                    // Guard: prevent cross-role login
                    throw new Error(`Expected ${intended} account, got ${n.role}`);
                }

                setRole(n.role);
                setUser(n.user);

                // Redirect by role
                const next =
                    n.role === "admin"
                        ? "/admin/dashboard"
                        : n.role === "owner"
                            ? "/owner/dashboard"
                            : "/";
                navigate(next, { replace: true });

                return true;
            } catch (e) {
                const message =
                    e?.response?.data?.message ||
                    e?.response?.data?.error ||
                    e?.normalizedMessage ||
                    e?.message ||
                    "Login error";
                setError(message);

                // Safety: if admin login failed, ensure we don't keep a stale token header
                if (mode === "admin") {
                    clearAdminToken();
                }
                return false;
            } finally {
                setLoading(false);
            }
        },
        [navigate]
    );

    // Logout
    const logout = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            await http.post("/auth/logout");
            // also try admin/owner if applicable (best effort)
            try {
                await http.post("/admin/auth/logout");
            } catch { }
        } catch {
            // ignore
        } finally {
            // Always clear admin token/header on any logout
            clearAdminToken();

            setUser(null);
            setRole(null);
            setLoading(false);
            const from = location.pathname.startsWith("/admin") ? "/admin/login" : "/auth/login";
            navigate(from, { replace: true });
        }
    }, [navigate, location.pathname]);

    const value = useMemo(
        () => ({
            user,
            role,
            loading,
            error,
            login,
            logout,
            setUser,
            setRole,
            setError,
        }),
        [user, role, loading, error, login, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
    return ctx;
}

export default AuthProvider;
