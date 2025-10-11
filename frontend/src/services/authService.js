// src/services/authService.js
import http from "../utils/http";

/**
 * Attach a lightweight error normalizer to the shared axios instance.
 * This preserves existing behavior where callers may read `e.normalizedMessage`.
 */
http.interceptors.response.use(
    (res) => res,
    (err) => {
        const msg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Request failed";
        err.normalizedMessage = msg;
        return Promise.reject(err);
    }
);

/* ------------------------------- AUTH ------------------------------- */

// Role-aware login
export async function login(role, body) {
    const endpoints = {
        user: "/auth/login",
        owner: "/owners/login",
        admin: "/admin/auth/login",
    };
    const path = endpoints[role] || endpoints.user;
    const { data } = await http.post(path, body);
    return data;
}

// Specific helpers (optional)
export async function userLogin(body) {
    const { data } = await http.post("/auth/login", body);
    return data;
}

export async function ownerLogin(body) {
    const { data } = await http.post("/owners/login", body);
    return data;
}

export async function adminLogin(body) {
    const { data } = await http.post("/admin/auth/login", body);
    return data;
}

// Role-aware register
export async function register(role, body) {
    const endpoints = {
        user: "/auth/register",
        owner: "/owners/register",
    };
    const path = endpoints[role] || endpoints.user;
    const { data } = await http.post(path, body);
    return data;
}

export async function userRegister(body) {
    const { data } = await http.post("/auth/register", body);
    return data;
}

export async function ownerRegister(body) {
    const { data } = await http.post("/owners/register", body);
    return data;
}

// Password reset (user path; owner path exists too if desired)
export async function sendReset(email) {
    const { data } = await http.post("/auth/send-reset", { email });
    return data;
}

// Generic user “me” (note: AuthProvider now prefers role-specific me)
export async function getMe() {
    const { data } = await http.get("/users/me");
    return data;
}

// Logout
export async function logout() {
    const { data } = await http.post("/auth/logout");
    return data;
}

// Export axios instance (kept for backwards compatibility)
export { http as default };
