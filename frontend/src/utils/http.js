// src/utils/http.js
import axios from "axios";

// In-memory bearer token (for USER flow with Firebase)
let _bearer = null;

// Decide base URL:
// - Dev: always use relative "/api" so Vite proxy handles CORS
// - Prod: use VITE_API_URL (e.g., https://api.example.com/api)
const isDev = import.meta.env.MODE !== "production";
const prodBase = import.meta.env.VITE_API_URL || "/api";
const baseURL = isDev ? "/api" : prodBase;

// Create axios instance
const http = axios.create({
    baseURL,
    timeout: 15000,
    withCredentials: true, // OWNER/ADMIN cookie sessions
    headers: { "Content-Type": "application/json" },
});

// Helpers for AuthProvider (Firebase user flow)
http.setAuthToken = (token) => {
    _bearer = token || null;
};

http.clearAuthToken = () => {
    _bearer = null;
};

// Request interceptor (USER bearer token)
http.interceptors.request.use((config) => {
    // Only attach bearer for Firebase user flows; cookies cover owner/admin
    if (_bearer) {
        config.headers.Authorization = `Bearer ${_bearer}`;
    } else {
        delete config.headers.Authorization;
    }
    return config;
});

/* -----------------------------------------------------------------------
 * ADDITIVE PATCH: ensure admin JWT is always sent for /admin/* endpoints.
 * Reads from localStorage (set by AuthProvider) and attaches x-admin-token.
 * This does not affect user/owner flows and is safe to keep.
 * --------------------------------------------------------------------- */
http.interceptors.request.use((config) => {
    try {
        const url = config.url || "";
        if (url && url.includes("/admin/")) {
            const adminToken = localStorage.getItem("adminToken");
            if (adminToken) {
                config.headers = config.headers || {};
                config.headers["x-admin-token"] = adminToken;
            } else if (config.headers && "x-admin-token" in config.headers) {
                delete config.headers["x-admin-token"];
            }
        }
    } catch {
        // ignore storage access issues
    }
    return config;
});

// Response interceptor (optional centralized error handling)
http.interceptors.response.use(
    (res) => res,
    (err) => {
        // Pass-through; pages can handle 401/403 and refresh flows as needed
        return Promise.reject(err);
    }
);

export default http;
