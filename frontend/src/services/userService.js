// src/services/userService.js
import http from "../utils/http";

/**
 * Get current user profile
 * GET /api/users/me
 */
export async function getMe() {
    const res = await http.get("/users/me");
    return res.data;
}

/**
 * Update current user profile
 * PATCH /api/users/me
 */
export async function updateMe(payload) {
    const res = await http.patch("/users/me", payload);
    return res.data;
}

/**
 * Get user's bookings
 * GET /api/users/bookings?status=...&limit=...&offset=...
 */
export async function getUserBookings(params = {}) {
    const res = await http.get("/users/bookings", { params });
    return res.data;
}

/**
 * Get user's favorite stations
 * GET /api/users/stations/favorites
 */
export async function getFavoriteStations() {
    const res = await http.get("/users/stations/favorites");
    return res.data;
}

/**
 * Add station to favorites
 * POST /api/users/stations/:stationId/favorite
 */
export async function addToFavorites(stationId) {
    const res = await http.post(`/users/stations/${encodeURIComponent(stationId)}/favorite`);
    return res.data;
}

/**
 * Remove station from favorites
 * DELETE /api/users/stations/:stationId/favorite
 */
export async function removeFromFavorites(stationId) {
    const res = await http.delete(`/users/stations/${encodeURIComponent(stationId)}/favorite`);
    return res.data;
}

/**
 * Get user dashboard data
 * GET /api/users/dashboard
 */
export async function getUserDashboard() {
    const res = await http.get("/users/dashboard");
    return res.data;
}

/**
 * Get user notifications
 * GET /api/notifications?limit=...&offset=...
 */
export async function getNotifications(params = {}) {
    const res = await http.get("/notifications", { params });
    return res.data;
}

/**
 * Mark notification as read
 * PATCH /api/notifications/:id/read
 */
export async function markNotificationRead(notificationId) {
    const res = await http.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
    return res.data;
}

/**
 * Get user analytics/stats
 * GET /api/analytics/user?period=...
 */
export async function getUserAnalytics(params = {}) {
    const res = await http.get("/analytics/user", { params });
    return res.data;
}

/**
 * Update user preferences
 * PATCH /api/users/me (with preferences object)
 */
export async function updatePreferences(preferences) {
    const res = await http.patch("/users/me", { preferences });
    return res.data;
}

/**
 * Get user payment history
 * GET /api/users/payments?limit=...&offset=...
 */
export async function getPaymentHistory(params = {}) {
    const res = await http.get("/users/payments", { params });
    return res.data;
}

/**
 * Upload user avatar
 * POST /api/users/avatar
 */
export async function uploadAvatar(imageFile) {
    const formData = new FormData();
    formData.append('avatar', imageFile);

    const res = await http.post("/users/avatar", formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return res.data;
}
