// src/services/paymentService.js
import http from "../utils/http";

/**
 * Start checkout for a booking
 * Backend: POST /api/payments/checkout  { bookingId }
 * Returns: { paymentId, paymentUrl?, status, ... }
 */
export async function startCheckout(bookingId) {
    const res = await http.post("/payments/checkout", { bookingId });
    return res.data;
}

/**
 * Verify payment after gateway redirect/webhook
 * Backend: POST /api/payments/verify  { paymentId, bookingId, payload }
 */
export async function verifyPayment({ paymentId, bookingId, payload }) {
    const res = await http.post("/payments/verify", { paymentId, bookingId, payload });
    return res.data;
}

/**
 * Get payment by id
 * Backend: GET /api/payments/:paymentId
 */
export async function getPayment(paymentId) {
    const res = await http.get(`/payments/${encodeURIComponent(paymentId)}`);
    return res.data;
}
