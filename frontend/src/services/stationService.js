// src/services/stationService.js
import http from "../utils/http";

/**
 * Search stations by query
 * GET /api/stations/search?q=...&lat=...&lng=...&radius=...
 */
export async function searchStations(params = {}) {
    const res = await http.get("/stations/search", { params });
    return res.data;
}

/**
 * Get station details by ID
 * GET /api/stations/:id
 */
export async function getStation(stationId) {
    const res = await http.get(`/stations/${encodeURIComponent(stationId)}`);
    return res.data;
}

/**
 * Get owner's stations
 * GET /api/stations/mine
 */
const pickStations = (payload) =>
    payload?.stations ?? payload?.items ?? payload?.data ?? [];

export async function getMyStations(params = {}) {
    const res = await http.get("/stations/mine", { params });
    const stations = pickStations(res.data);
    // If you still want meta, return both:
    return { stations, raw: res.data };
}


/**
 * Create new station (Owner)
 * POST /api/stations
 */
export async function createStation(payload) {
    const res = await http.post("/stations", payload);
    return res.data;
}

/**
 * Update station (Owner)
 * PATCH /api/stations/:id
 */
export async function updateStation(stationId, payload) {
    const res = await http.patch(`/stations/${encodeURIComponent(stationId)}`, payload);
    return res.data;
}

/**
 * Delete station (Owner)
 * DELETE /api/stations/:id
 */
export async function deleteStation(stationId) {
    const res = await http.delete(`/stations/${encodeURIComponent(stationId)}`);
    return res.data;
}

/**
 * Upload station image (Owner)
 * POST /api/stations/:id/images
 */
export async function uploadStationImage(stationId, imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);

    const res = await http.post(`/stations/${encodeURIComponent(stationId)}/images`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return res.data;
}

/**
 * Set station location (Owner)
 * POST /api/stations/:id/location
 */
export async function setStationLocation(stationId, { latitude, longitude, address }) {
    const res = await http.post(`/stations/${encodeURIComponent(stationId)}/location`, {
        latitude,
        longitude,
        address
    });
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
 * POST /api/users/stations/:id/favorite
 */
export async function addToFavorites(stationId) {
    const res = await http.post(`/users/stations/${encodeURIComponent(stationId)}/favorite`);
    return res.data;
}

/**
 * Remove station from favorites
 * DELETE /api/users/stations/:id/favorite
 */
export async function removeFromFavorites(stationId) {
    const res = await http.delete(`/users/stations/${encodeURIComponent(stationId)}/favorite`);
    return res.data;
}
