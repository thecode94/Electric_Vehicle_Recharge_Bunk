// src/services/bookingService.js
import http from "../utils/http";

// Normalize a Date or ISO-like value to ISO string if possible
const toIso = (v) =>
    typeof v === "string" ? v : (v?.toISOString?.() ?? v);

/**
 * Create a booking.
 * Backend:
 *  POST /api/bookings
 *  Body: { stationId, startTime, durationMins, vehicleType, pricePerKwh?, notes? }
 *  Returns: { id, status, paymentUrl?, paymentRequired?, ... }
 */
export async function createBooking(payload) {
    const body = {
        ...payload,
        startTime: toIso(payload.startTime),
    };
    const res = await http.post("/bookings", body);
    return res.data;
}

/**
 * Fetch booking by id
 * GET /api/bookings/:id
 */
export async function getBooking(bookingId) {
    const res = await http.get(`/bookings/${encodeURIComponent(bookingId)}`);
    return res.data;
}

/**
 * Fetch current user's bookings (optional)
 * GET /api/bookings?cursor=...&limit=...
 */
export async function listMyBookings(params = {}) {
    const res = await http.get("/bookings", { params });
    return res.data;
}
