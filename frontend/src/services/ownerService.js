// src/services/ownerService.js
import http from "../utils/http";

/**
 * Owner login (cookie session)
 * POST /api/auth/owner/login
 */
export async function ownerLogin({ email, password }) {
    const res = await http.post("/auth/owner/login", { email, password });
    return res.data;
}

/**
 * Get current owner profile (cookie session)
 * GET /api/auth/owner/me
 */
export async function ownerMe() {
    const res = await http.get("/auth/owner/me");
    return res.data;
}

/**
 * Owner registration
 * POST /api/owners/register
 */
export async function ownerRegister({
    businessName,
    contactNumber,
    email,
    password,
    address,
    city,
    state
}) {
    const res = await http.post("/owners/register", {
        businessName,
        contactNumber,
        email,
        password,
        address,
        city,
        state
    });
    return res.data;
}

/**
 * Update owner profile
 * PUT /api/auth/owner/me
 */
export async function updateOwnerProfile(payload) {
    const res = await http.put("/auth/owner/me", payload);
    return res.data;
}

/**
 * Owner logout (clears httpOnly cookie)
 * POST /api/auth/owner/logout
 */
export async function ownerLogout() {
    const res = await http.post("/auth/owner/logout");
    return res.data;
}
