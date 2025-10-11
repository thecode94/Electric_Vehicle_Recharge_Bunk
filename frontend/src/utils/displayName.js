// utils/displayName.js (or put near the component)
export function getDisplayName(u) {
    if (!u) return "";
    // Owner object (from /owners/me) comes as top-level fields
    const ownerName = u.displayName || u.ownerDoc?.displayName;
    // User object (from /users/me) is usually nested under profile
    const userName = u.profile?.name || u.name;

    return ownerName || userName || (u.email ? u.email.split("@")[0] : "");
}
