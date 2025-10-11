// src/utils/guards.jsx

/**
 * Tiny helpers for auth/role checks that you can use anywhere
 * (components, services, route guards, etc.)
 *
 * Note: <ProtectedRoute /> already enforces most of this at the router level.
 * These helpers are for ad‑hoc checks in pages/components.
 */

/** Is a user object present? */
export function isAuthenticated(user) {
    return !!(user && (user.id || user._id || user.email));
}

/** Does the user have at least one of the required roles? */
export function hasRole(user, roles = []) {
    if (!Array.isArray(roles) || roles.length === 0) return true; // no role required
    const role = (user?.role || user?.type || "user").toLowerCase();
    return roles.map((r) => String(r).toLowerCase()).includes(role);
}

/** Combine both: must be logged in AND have one of the roles */
export function canAccess(user, roles = []) {
    return isAuthenticated(user) && hasRole(user, roles);
}

/**
 * Example resource-level guard
 * The owner can manage a station if:
 * - user.role is 'owner' or 'admin'
 * - AND (admin) OR (station.ownerId matches user.id)
 */
export function canManageStation(user, station) {
    if (!isAuthenticated(user)) return false;
    const role = (user.role || user.type || "user").toLowerCase();
    if (role === "admin") return true;

    if (role === "owner") {
        const uid = user.id || user._id || user.userId;
        const ownerId =
            station?.ownerId || station?.owner?.id || station?.owner?._id;
        return uid && ownerId && String(uid) === String(ownerId);
    }
    return false;
}

/**
 * Simple redirect helper for pages (use in event handlers)
 * Usage:
 *   if (!ensureAuthOrRedirect(user, nav)) return; // stops handler
 */
export function ensureAuthOrRedirect(user, navigate, to = "/login") {
    if (isAuthenticated(user)) return true;
    navigate(to, { replace: true });
    return false;
}

/**
 * Role-based redirect helper (use in event handlers)
 * Usage:
 *   if (!ensureRoleOrRedirect(user, ['owner'], nav, '/owner/login')) return;
 */
export function ensureRoleOrRedirect(user, roles, navigate, to = "/login") {
    if (canAccess(user, roles)) return true;
    navigate(to, { replace: true });
    return false;
}
