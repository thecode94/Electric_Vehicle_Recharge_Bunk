// src/services/mapService.js
import http from "../utils/http";

// Remove undefined/null/empty-string params to avoid 400s
const clean = (obj) =>
    Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );

/**
 * Search places by free-text query
 * Backend: GET /api/maps/search?q=<text>
 */
export async function searchPlaces(q) {
    const res = await http.get("/maps/search", { params: clean({ q }) });
    return res.data; // array or { results: [...] }
}

/**
 * Reverse geocode coordinates to an address
 * Backend: GET /api/maps/reverse?lat=&lng=
 */
export async function reverseGeocode(lat, lng) {
    const res = await http.get("/maps/reverse", { params: clean({ lat, lng }) });
    return res.data;
}

/**
 * Get nearby places based on current GPS coordinates
 * Backend: GET /api/maps/nearby?lat=..&lng=..&q=..&radius=..
 */
export async function nearbySearch(lat, lng, { q = "", radius = 3000 } = {}) {
    const res = await http.get("/maps/nearby", {
        params: clean({ lat, lng, q, radius }),
    });
    return res.data;
}

/**
 * Distance Matrix
 * Calculate time and distance between one/many points
 * Backend: GET /api/maps/distance?origins=..&destinations=..&profile=
 *
 * @param {Array<[number, number]>} origins - list of [lat, lng]
 * @param {Array<[number, number]>} destinations - list of [lat, lng]
 * @param {string} profile - driving | walking | biking
 */
export async function getDistanceMatrix(origins, destinations, profile = "driving") {
    const format = (arr) => (Array.isArray(arr) ? arr.map(([lat, lng]) => `${lat},${lng}`).join(";") : "");
    const params = clean({
        origins: format(origins),
        destinations: format(destinations),
        profile,
    });
    const res = await http.get("/maps/distance", { params });
    return res.data;
}
