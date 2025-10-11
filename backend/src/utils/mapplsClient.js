// backend/src/utils/mapplsClient.js
const axios = require("axios");
const NodeCache = require("node-cache");

const {
    MAPPLS_CLIENT_ID,
    MAPPLS_CLIENT_SECRET,
    MAPPLS_STATIC_KEY,
} = process.env;

const cache = new NodeCache({ stdTTL: 3000, checkperiod: 120 }); // ~50 minutes

/* ----------------------- Helpers ----------------------- */
function normalizePlaceLike(it) {
    const name =
        it.placeName || it.poi || it.name || it.formattedAddress || it.address || "Place";
    const address = it.formattedAddress || it.placeAddress || it.address || "";
    const lat = Number(it.latitude ?? it.lat ?? it.geometry?.location?.lat);
    const lng = Number(it.longitude ?? it.lng ?? it.geometry?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { name, address, latitude: lat, longitude: lng };
}

const STATIC_BLOCK_TTL = 600; // 10 minutes
function markStaticBlocked() {
    cache.set("mappls_static_blocked", true, STATIC_BLOCK_TTL);
}
function isStaticBlocked() {
    return !!cache.get("mappls_static_blocked");
}

/* ----------------------- OAuth (Atlas) ----------------------- */
async function getToken() {
    if (!MAPPLS_CLIENT_ID || !MAPPLS_CLIENT_SECRET) {
        throw new Error("mappls_oauth_missing_creds");
    }
    const cached = cache.get("mappls_token");
    if (cached) return cached;

    const url = "https://outpost.mappls.com/api/security/oauth/token";
    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: MAPPLS_CLIENT_ID,
        client_secret: MAPPLS_CLIENT_SECRET,
    });

    try {
        const { data } = await axios.post(url, body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 10000,
        });
        const token = data?.access_token;
        if (!token) throw new Error("mappls_oauth_token_missing");
        const ttl = Math.max(60, Math.floor((data.expires_in || 3600) * 0.9));
        cache.set("mappls_token", token, ttl);
        return token;
    } catch (err) {
        console.error("[mappls] Token error:", err?.response?.data || err.message || err);
        throw err;
    }
}

async function textSearchOAuth(query, limit = 20, opts = {}) {
    if (!query) return [];
    let token;
    try {
        token = await getToken();
    } catch {
        return [];
    }
    const url = "https://atlas.mappls.com/api/places/textsearch/json";
    const params = { query, limit, region: opts.region || "IND" };
    if (opts.location) params.location = opts.location;

    try {
        const { data } = await axios.get(url, {
            params,
            headers: { Authorization: `Bearer ${token}` },
            timeout: 12000,
        });
        const items = Array.isArray(data?.suggestedLocations)
            ? data.suggestedLocations
            : Array.isArray(data?.results)
                ? data.results
                : Array.isArray(data?.places)
                    ? data.places
                    : [];
        return items.map(normalizePlaceLike).filter(Boolean);
    } catch (err) {
        console.error("[mappls] textSearchOAuth error:", err?.response?.data || err.message || err);
        return [];
    }
}

async function geocodeOAuth(address, opts = {}) {
    if (!address) return null;
    let token;
    try {
        token = await getToken();
    } catch {
        return null;
    }
    const url = "https://atlas.mappls.com/api/places/geocode";
    const params = { address, region: opts.region || "IND" };

    try {
        const { data } = await axios.get(url, {
            params,
            headers: { Authorization: `Bearer ${token}` },
            timeout: 12000,
        });
        const best =
            Array.isArray(data?.copResults) && data.copResults[0]
                ? data.copResults[0]
                : Array.isArray(data?.results) && data.results[0]
                    ? data.results[0]
                    : null;
        const norm = best && normalizePlaceLike(best);
        if (!norm) return null;
        return { lat: norm.latitude, lng: norm.longitude, label: norm.name || address };
    } catch (err) {
        console.error("[mappls] geocodeOAuth error:", err?.response?.data || err.message || err);
        return null;
    }
}

/* ----------------------- Advanced Maps (Static key) ----------------------- */
/* NOTE: Static endpoints may return 412 if referer/IP isn’t whitelisted */
async function textSearchStatic(query, limit = 20, opts = {}) {
    if (!MAPPLS_STATIC_KEY || !query || isStaticBlocked()) return [];
    const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_STATIC_KEY}/places/textsearch`;
    const params = { query, region: opts.region || "IND", limit };
    if (opts.location) params.location = opts.location;

    try {
        const { data } = await axios.get(url, { params, timeout: 12000 });
        const items = Array.isArray(data?.suggestedLocations)
            ? data.suggestedLocations
            : Array.isArray(data?.results)
                ? data.results
                : Array.isArray(data?.places)
                    ? data.places
                    : [];
        return items.map(normalizePlaceLike).filter(Boolean);
    } catch (err) {
        const status = err?.response?.status;
        if (status === 412) {
            console.error("[mappls] textSearchStatic 412 (static key blocked by referer/IP) — switching to OAuth");
            markStaticBlocked();
        } else {
            console.error("[mappls] textSearchStatic error:", err?.response?.data || err.message || err);
        }
        return [];
    }
}

async function autoSuggestStatic(query, limit = 20, opts = {}) {
    if (!MAPPLS_STATIC_KEY || !query || isStaticBlocked()) return [];
    const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_STATIC_KEY}/places/autosuggest`;
    const params = { query, region: opts.region || "IND", limit };
    if (opts.location) params.location = opts.location;

    try {
        const { data } = await axios.get(url, { params, timeout: 12000 });
        const items = Array.isArray(data?.suggestedLocations)
            ? data.suggestedLocations
            : Array.isArray(data?.results)
                ? data.results
                : Array.isArray(data?.places)
                    ? data.places
                    : [];
        return items.map(normalizePlaceLike).filter(Boolean);
    } catch (err) {
        const status = err?.response?.status;
        if (status === 412) {
            console.error("[mappls] autoSuggestStatic 412 (static key blocked by referer/IP) — switching to OAuth");
            markStaticBlocked();
        } else {
            console.error("[mappls] autoSuggestStatic error:", err?.response?.data || err.message || err);
        }
        return [];
    }
}

async function geocodeStatic(address, opts = {}) {
    if (!MAPPLS_STATIC_KEY || !address || isStaticBlocked()) return null;
    const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_STATIC_KEY}/places/geocode`;
    const params = { address, region: opts.region || "IND" };

    try {
        const { data } = await axios.get(url, { params, timeout: 12000 });
        const best =
            Array.isArray(data?.copResults) && data.copResults[0]
                ? data.copResults[0]
                : Array.isArray(data?.results) && data.results[0]
                    ? data.results[0]
                    : null;
        const norm = best && normalizePlaceLike(best);
        if (!norm) return null;
        return { lat: norm.latitude, lng: norm.longitude, label: norm.name || address };
    } catch (err) {
        const status = err?.response?.status;
        if (status === 412) {
            console.error("[mappls] geocodeStatic 412 (static key blocked by referer/IP) — switching to OAuth");
            markStaticBlocked();
        } else {
            console.error("[mappls] geocodeStatic error:", err?.response?.data || err.message || err);
        }
        return null;
    }
}

/* ----------------------- Robust wrappers ----------------------- */
async function robustTextSearch(query, limit = 20, opts = {}) {
    if (!query) return [];
    // Try static first unless we know it’s blocked
    if (MAPPLS_STATIC_KEY && !isStaticBlocked()) {
        let res = await textSearchStatic(query, limit, opts);
        if (res?.length) return res;
        res = await autoSuggestStatic(query, limit, opts);
        if (res?.length) return res;
        const geoSingle = await geocodeStatic(query, opts);
        if (geoSingle) {
            return [
                {
                    name: geoSingle.label,
                    address: geoSingle.label,
                    latitude: geoSingle.lat,
                    longitude: geoSingle.lng,
                },
            ];
        }
    }
    // OAuth fallback (server-safe)
    const resOauth = await textSearchOAuth(query, limit, opts);
    return resOauth || [];
}

async function robustLocate(query, opts = {}) {
    if (!query) return null;
    if (MAPPLS_STATIC_KEY && !isStaticBlocked()) {
        const g = await geocodeStatic(query, opts);
        if (g) return g;
        const t = await textSearchStatic(query, 1, opts);
        if (t[0]) return { lat: t[0].latitude, lng: t[0].longitude, label: t[0].name || query };
        const a = await autoSuggestStatic(query, 1, opts);
        if (a[0]) return { lat: a[0].latitude, lng: a[0].longitude, label: a[0].name || query };
    }
    const go = await geocodeOAuth(query, opts);
    if (go) return go;
    const to = await textSearchOAuth(query, 1, opts);
    if (to[0]) return { lat: to[0].latitude, lng: to[0].longitude, label: to[0].name || query };
    return null;
}

module.exports = {
    robustTextSearch,
    robustLocate,
    // optional debug export
    getToken,
};
