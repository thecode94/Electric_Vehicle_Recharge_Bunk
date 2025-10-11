// src/services/mapService.js - COMPLETELY FIXED VERSION
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// ✅ FIXED: Safe parameter handling
const safeBuildParams = (params = {}) => {
    const searchParams = new URLSearchParams();

    // Only add defined, non-empty parameters
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, String(value));
        }
    });

    return searchParams.toString();
};

// ✅ FIXED: Safe API request helper
const safeApiRequest = async (endpoint, params = {}, options = {}) => {
    try {
        const queryString = safeBuildParams(params);
        const url = `${API_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;

        console.log(`🔍 API Request: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            signal: options.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`✅ API Response:`, data);
        return data;

    } catch (error) {
        console.error(`❌ API Error for ${endpoint}:`, error.message);
        throw error;
    }
};

// ✅ FIXED: Search places with better error handling
export const searchPlaces = async (query, options = {}) => {
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
        console.warn('searchPlaces: Invalid query provided');
        return [];
    }

    const params = {
        q: query.trim()
    };

    // Add optional parameters safely
    if (options.lat && options.lng) {
        params.lat = options.lat;
        params.lng = options.lng;
    }
    if (options.radius) {
        params.radius = options.radius;
    }

    try {
        const data = await safeApiRequest('/api/maps/locate', params, options);

        // Handle different response formats
        if (data && data.lat && data.lng) {
            return [{
                id: 'locate-result',
                name: data.name || query,
                address: data.address || '',
                lat: data.lat,
                lng: data.lng,
                latitude: data.lat,
                longitude: data.lng
            }];
        }

        return [];
    } catch (error) {
        console.error('searchPlaces error:', error);
        return [];
    }
};

// ✅ FIXED: Reverse geocoding with better error handling
export const reverseGeocode = async (lat, lng, options = {}) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Invalid coordinates provided');
    }

    const params = { lat, lng };

    try {
        const data = await safeApiRequest('/api/maps/reverse', params, options);
        return data;
    } catch (error) {
        console.error('reverseGeocode error:', error);
        throw error;
    }
};

// ✅ FIXED: Search nearby stations
export const searchNearbyStations = async (lat, lng, options = {}) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('Invalid coordinates provided');
    }

    const params = {
        lat,
        lng,
        radius: options.radius || 25000, // 25km default
        q: options.q || '' // empty query for all stations
    };

    try {
        const data = await safeApiRequest('/api/maps/nearby', params, options);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('searchNearbyStations error:', error);
        return [];
    }
};

// ✅ FIXED: Text search for stations
export const searchStations = async (query, options = {}) => {
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return [];
    }

    const params = {
        q: query.trim(),
        limit: options.limit || 20
    };

    // Add location bias if available
    if (options.lat && options.lng) {
        params.lat = options.lat;
        params.lng = options.lng;
        params.radius = options.radius || 50000; // 50km default
    }

    try {
        const data = await safeApiRequest('/api/maps/text', params, options);

        if (data && data.success && Array.isArray(data.stations)) {
            return data.stations;
        }

        return [];
    } catch (error) {
        console.error('searchStations error:', error);
        return [];
    }
};

export default {
    searchPlaces,
    reverseGeocode,
    searchNearbyStations,
    searchStations
};
