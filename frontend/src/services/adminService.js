// src/services/adminService.js
import http from "../utils/http";

// Summary
export const getAdminSummary = async () => (await http.get("/admin/summary")).data;

// Stations
export const listAdminStations = async (params = {}) =>
    (await http.get("/admin/stations", { params })).data;

export const approveStation = async (id) =>
    (await http.post(`/admin/stations/${id}/approve`)).data;

export const rejectStation = async (id) =>
    (await http.post(`/admin/stations/${id}/reject`)).data;

export const toggleStationActive = async (id, active) =>
    (await http.patch(`/admin/stations/${id}`, { active })).data;

export const deleteStation = async (id) =>
    (await http.delete(`/admin/stations/${id}`)).data;

// Users
export const listUsers = async (params = {}) =>
    (await http.get("/admin/users", { params })).data;

export const updateUserRole = async (id, role) =>
    (await http.patch(`/admin/users/${id}/role`, { role })).data;

export const toggleUserActive = async (id, active) =>
    (await http.patch(`/admin/users/${id}`, { active })).data;

// Bookings
export const listBookings = async (params = {}) =>
    (await http.get("/admin/bookings", { params })).data;

export const updateBookingStatus = async (id, status) =>
    (await http.patch(`/admin/bookings/${id}`, { status })).data;

export const refundBooking = async (id) =>
    (await http.post(`/admin/bookings/${id}/refund`)).data;

// Finance
export const getFinanceSummary = async (params) =>
    (await http.get("/admin/finance/summary", { params })).data;

export const getFinanceTransactions = async (params) =>
    (await http.get("/admin/finance/transactions", { params })).data;

export const getFinancePayouts = async (params) =>
    (await http.get("/admin/finance/payouts", { params })).data;

// Settings
export const getSettings = async () => (await http.get("/admin/settings")).data;

export const updateSettings = async (payload) =>
    (await http.patch("/admin/settings", payload)).data;

export const sendTestEmail = async (to) =>
    (await http.post("/admin/settings/test-email", { to })).data;
