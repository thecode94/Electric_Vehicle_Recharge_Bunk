// backend/src/controllers/mapTextController.js - TEXT PLACES SEARCH ONLY
const axios = require('axios');
const adminConfig = require('../config/firebase');
const admin = adminConfig.admin || adminConfig;
const db = adminConfig.db || (admin.firestore && admin.firestore());

// ✅ COMPREHENSIVE TEXT PLACES DATABASE (No Geo API needed)
const placesDatabase = {
    // Cities with alternative names and common searches
    'mumbai': {
        lat: 19.0760, lng: 72.8777,
        name: 'Mumbai, Maharashtra',
        aliases: ['bombay', 'mumbai city', 'financial capital'],
        type: 'city',
        state: 'Maharashtra',
        landmarks: ['Gateway of India', 'Marine Drive', 'Colaba', 'Bandra', 'Andheri']
    },
    'pune': {
        lat: 18.5204, lng: 73.8567,
        name: 'Pune, Maharashtra',
        aliases: ['poona', 'pune city', 'oxford of east'],
        type: 'city',
        state: 'Maharashtra',
        landmarks: ['Shaniwar Wada', 'Koregaon Park', 'Hinjawadi', 'Baner', 'Kothrud']
    },
    'delhi': {
        lat: 28.7041, lng: 77.1025,
        name: 'New Delhi',
        aliases: ['new delhi', 'delhi ncr', 'national capital'],
        type: 'city',
        state: 'Delhi',
        landmarks: ['Red Fort', 'India Gate', 'Connaught Place', 'Karol Bagh']
    },
    'bangalore': {
        lat: 12.9716, lng: 77.5946,
        name: 'Bangalore, Karnataka',
        aliases: ['bengaluru', 'silicon valley', 'garden city'],
        type: 'city',
        state: 'Karnataka',
        landmarks: ['MG Road', 'Brigade Road', 'Electronic City', 'Whitefield']
    },
    'chennai': {
        lat: 13.0827, lng: 80.2707,
        name: 'Chennai, Tamil Nadu',
        aliases: ['madras', 'detroit of india'],
        type: 'city',
        state: 'Tamil Nadu',
        landmarks: ['Marina Beach', 'T Nagar', 'Anna Nagar', 'Velachery']
    },
    'hyderabad': {
        lat: 17.3850, lng: 78.4867,
        name: 'Hyderabad, Telangana',
        aliases: ['cyberabad', 'pearl city'],
        type: 'city',
        state: 'Telangana',
        landmarks: ['Charminar', 'HITEC City', 'Gachibowli', 'Madhapur']
    },
    'jalgaon': {
        lat: 20.9974, lng: 75.5626,
        name: 'Jalgaon, Maharashtra',
        aliases: ['banana city'],
        type: 'city',
        state: 'Maharashtra',
        landmarks: ['Jalgaon Railway Station', 'Ajanta Caves nearby']
    },
    'nashik': {
        lat: 19.9975, lng: 73.7898,
        name: 'Nashik, Maharashtra',
        aliases: ['wine capital'],
        type: 'city',
        state: 'Maharashtra',
        landmarks: ['Sula Vineyards', 'Trimbakeshwar']
    },
    'nagpur': {
        lat: 21.1458, lng: 79.0882,
        name: 'Nagpur, Maharashtra',
        aliases: ['orange city', 'zero mile'],
        type: 'city',
        state: 'Maharashtra',
        landmarks: ['Deekshabhoomi', 'Sitabuldi Fort']
    },
    'aurangabad': {
        lat: 19.8762, lng: 75.3433,
        name: 'Aurangabad, Maharashtra',
        aliases: ['city of gates'],
        type: 'city',
        state: 'Maharashtra',
        landmarks: ['Ajanta Ellora Caves', 'Bibi Ka Maqbara']
    },

    // Popular Areas/Landmarks
    'bandra': {
        lat: 19.0544, lng: 72.8347,
        name: 'Bandra, Mumbai',
        aliases: ['bandra west', 'linking road'],
        type: 'area',
        city: 'Mumbai',
        state: 'Maharashtra'
    },
    'andheri': {
        lat: 19.1136, lng: 72.8697,
        name: 'Andheri, Mumbai',
        aliases: ['andheri east', 'andheri west', 'seepz'],
        type: 'area',
        city: 'Mumbai',
        state: 'Maharashtra'
    },
    'koregaon park': {
        lat: 18.5362, lng: 73.8847,
        name: 'Koregaon Park, Pune',
        aliases: ['kp', 'koregaon'],
        type: 'area',
        city: 'Pune',
        state: 'Maharashtra'
    },
    'hinjawadi': {
        lat: 18.5882, lng: 73.7499,
        name: 'Hinjawadi, Pune',
        aliases: ['hinjewadi', 'tech park'],
        type: 'area',
        city: 'Pune',
        state: 'Maharashtra'
    },
    'electronic city': {
        lat: 12.8456, lng: 77.6603,
        name: 'Electronic City, Bangalore',
        aliases: ['ecity', 'e city'],
        type: 'area',
        city: 'Bangalore',
        state: 'Karnataka'
    },
    'hitec city': {
        lat: 17.4435, lng: 78.3772,
        name: 'HITEC City, Hyderabad',
        aliases: ['hitech city', 'cyberabad'],
        type: 'area',
        city: 'Hyderabad',
        state: 'Telangana'
    },

    // Common Address Keywords
    'railway station': { type: 'keyword', searchHint: 'Look for nearby railway stations' },
    'airport': { type: 'keyword', searchHint: 'Look for airports' },
    'mall': { type: 'keyword', searchHint: 'Look for shopping malls' },
    'hospital': { type: 'keyword', searchHint: 'Look for hospitals' },
    'tech park': { type: 'keyword', searchHint: 'Look for technology parks' }
};

// Helper function to calculate distance
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ✅ PURE TEXT PLACE SEARCH FUNCTION
function searchPlacesByText(searchQuery) {
    const query = searchQuery.toLowerCase().trim();
    const results = [];

    // Search through places database
    for (const [key, place] of Object.entries(placesDatabase)) {
        if (place.type === 'keyword') continue; // Skip keywords for location results

        let matchScore = 0;
        let matchType = null;

        // Direct key match (highest priority)
        if (key === query) {
            matchScore = 100;
            matchType = 'exact';
        }
        // Key contains query
        else if (key.includes(query) || query.includes(key)) {
            matchScore = 80;
            matchType = 'key_partial';
        }
        // Name match
        else if (place.name && place.name.toLowerCase().includes(query)) {
            matchScore = 70;
            matchType = 'name';
        }
        // Alias match
        else if (place.aliases && place.aliases.some(alias =>
            alias.includes(query) || query.includes(alias)
        )) {
            matchScore = 60;
            matchType = 'alias';
        }
        // Landmark match
        else if (place.landmarks && place.landmarks.some(landmark =>
            landmark.toLowerCase().includes(query) || query.includes(landmark.toLowerCase())
        )) {
            matchScore = 50;
            matchType = 'landmark';
        }
        // State match (lower priority)
        else if (place.state && place.state.toLowerCase().includes(query)) {
            matchScore = 30;
            matchType = 'state';
        }

        if (matchScore > 0) {
            results.push({
                ...place,
                matchScore,
                matchType,
                searchKey: key
            });
        }
    }

    // Sort by match score (highest first)
    results.sort((a, b) => b.matchScore - a.matchScore);

    return results.slice(0, 10); // Top 10 results
}

// ✅ GET FIREBASE STATIONS (same as before)
async function getStationsFromFirebase() {
    try {
        if (!db) {
            console.log('❌ Firebase database not available');
            return { success: false, stations: [], error: 'Database not available' };
        }

        console.log('🔍 Querying Firebase ev_bunks collection...');

        const querySnapshot = await db.collection('ev_bunks')
            .where('status', '==', 'active')
            .get();

        const stations = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();

            const station = {
                id: doc.id,
                name: data.name || data.metadata?.name || 'EV Station',
                address: data.address || 'Address not provided',
                city: extractCityFromData(data),
                state: extractStateFromData(data),
                location: normalizeLocationData(data.location),
                connectors: data.ports || data.connectors || data.sockets || [],
                totalPorts: data.ports || 0,
                pricing: data.pricing || { active: true },
                status: data.status || 'active',
                metadata: data.metadata || {},
                ownerId: data.ownerId,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                source: 'firebase'
            };

            if (station.location && station.location.lat && station.location.lng) {
                stations.push(station);
            }
        });

        console.log(`✅ Retrieved ${stations.length} stations from Firebase`);
        return { success: true, stations, count: stations.length };

    } catch (error) {
        console.error('❌ Firebase query error:', error);
        return { success: false, stations: [], error: error.message };
    }
}

// ✅ NORMALIZE LOCATION DATA (same as before)
function normalizeLocationData(locationField) {
    if (!locationField) return null;

    if (Array.isArray(locationField) && locationField.length >= 2) {
        return { lat: parseFloat(locationField[0]), lng: parseFloat(locationField[1]) };
    } else if (typeof locationField === 'object') {
        if (locationField._latitude !== undefined && locationField._longitude !== undefined) {
            return { lat: parseFloat(locationField._latitude), lng: parseFloat(locationField._longitude) };
        }
        else if (locationField.lat && locationField.lng) {
            return { lat: parseFloat(locationField.lat), lng: parseFloat(locationField.lng) };
        }
        else if (locationField.latitude && locationField.longitude) {
            return { lat: parseFloat(locationField.latitude), lng: parseFloat(locationField.longitude) };
        }
    } else if (typeof locationField === 'string') {
        const coords = locationField.split(',');
        if (coords.length >= 2) {
            return { lat: parseFloat(coords[0]), lng: parseFloat(coords[1]) };
        }
    }

    return null;
}

// Extract city from Firebase data
function extractCityFromData(data) {
    if (data.city) return data.city;
    if (data.metadata && data.metadata.city) return data.metadata.city;

    if (data.address) {
        const address = data.address.toLowerCase();
        for (const [key, place] of Object.entries(placesDatabase)) {
            if (place.type === 'city' && (address.includes(key) || address.includes(place.name.toLowerCase()))) {
                return place.name.split(',')[0];
            }
        }
    }

    return 'Unknown City';
}

function extractStateFromData(data) {
    if (data.state) return data.state;
    if (data.metadata && data.metadata.state) return data.metadata.state;

    if (data.address) {
        const address = data.address.toLowerCase();
        for (const place of Object.values(placesDatabase)) {
            if (place.state && address.includes(place.state.toLowerCase())) {
                return place.state;
            }
        }
    }

    return 'Unknown State';
}

// ✅ TEXT SEARCH CONTROLLER - Pure Text Search
async function textSearchController(req, res) {
    try {
        const { q, lat, lng, radius = 25, limit = 20 } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter "q" is required and must be at least 2 characters'
            });
        }

        console.log(`🔍 Pure text search for: "${q}"`);

        const searchTerm = q.toLowerCase().trim();

        // ✅ Get stations from Firebase
        const firebaseResult = await getStationsFromFirebase();
        const firebaseStations = firebaseResult.success ? firebaseResult.stations : [];

        // ✅ Search Firebase stations by text
        let matchingStations = [];

        firebaseStations.forEach(station => {
            const nameMatch = station.name.toLowerCase().includes(searchTerm);
            const addressMatch = station.address.toLowerCase().includes(searchTerm);
            const cityMatch = station.city.toLowerCase().includes(searchTerm);
            const stateMatch = station.state.toLowerCase().includes(searchTerm);

            if (nameMatch || addressMatch || cityMatch || stateMatch) {
                matchingStations.push(station);
            }
        });

        // ✅ Also search for places to provide location context
        const placeResults = searchPlacesByText(searchTerm);
        const bestPlace = placeResults[0]; // Best matching place

        // If we have a place match, filter stations by proximity
        if (bestPlace && bestPlace.lat && bestPlace.lng) {
            matchingStations = matchingStations.map(station => {
                if (station.location) {
                    const distance = calculateDistance(
                        bestPlace.lat, bestPlace.lng,
                        station.location.lat, station.location.lng
                    );
                    return {
                        ...station,
                        distance: parseFloat(distance.toFixed(1)),
                        distanceText: `${distance.toFixed(1)} km from ${bestPlace.name}`
                    };
                }
                return station;
            }).sort((a, b) => (a.distance || 999) - (b.distance || 999));
        }

        matchingStations = matchingStations.slice(0, parseInt(limit));

        res.json({
            success: true,
            query: q,
            textSearchResults: {
                places: placeResults.slice(0, 5), // Top 5 place matches
                bestPlaceMatch: bestPlace || null
            },
            stations: matchingStations,
            count: matchingStations.length,
            dataSource: {
                firebase: {
                    total: firebaseStations.length,
                    matching: matchingStations.length
                },
                places: {
                    found: placeResults.length,
                    bestMatch: bestPlace ? bestPlace.name : 'No place match'
                }
            },
            message: matchingStations.length > 0
                ? `Found ${matchingStations.length} EV stations for "${q}"`
                : `No EV stations found for "${q}"`
        });

    } catch (error) {
        console.error('❌ Text search error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed',
            message: error.message
        });
    }
}

// ✅ TEXT LOCATE CONTROLLER - Pure Text Place Finding
async function textLocateController(req, res) {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter "q" is required'
            });
        }

        console.log(`📍 Text place search for: "${q}"`);

        // ✅ Pure text search for places
        const placeResults = searchPlacesByText(q);
        const bestPlace = placeResults[0];

        if (bestPlace && bestPlace.lat && bestPlace.lng) {
            // Get nearby Firebase stations
            const firebaseResult = await getStationsFromFirebase();
            const allStations = firebaseResult.success ? firebaseResult.stations : [];

            const nearbyStations = allStations
                .filter(station => station.location)
                .map(station => {
                    const distance = calculateDistance(
                        bestPlace.lat, bestPlace.lng,
                        station.location.lat, station.location.lng
                    );
                    return { ...station, distance: parseFloat(distance.toFixed(1)) };
                })
                .filter(station => station.distance <= 50)
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 10);

            res.json({
                success: true,
                query: q,
                location: bestPlace,
                allPlaceResults: placeResults.slice(0, 5),
                nearbyStations: nearbyStations,
                stationCount: nearbyStations.length,
                message: `Found location: ${bestPlace.name} with ${nearbyStations.length} nearby EV stations`
            });
        } else {
            res.json({
                success: false,
                query: q,
                location: null,
                searchResults: placeResults.slice(0, 5),
                message: `No exact location found for "${q}"`,
                suggestions: placeResults.length > 0
                    ? placeResults.slice(0, 3).map(place => place.name)
                    : ['Try: Mumbai, Pune, Delhi, Bangalore, Chennai']
            });
        }

    } catch (error) {
        console.error('❌ Text locate error:', error);
        res.status(500).json({
            success: false,
            error: 'Text locate failed',
            message: error.message
        });
    }
}

// ✅ PLACES SUGGESTIONS CONTROLLER - Get suggestions for autocomplete
async function placesSuggestionsController(req, res) {
    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.trim().length < 1) {
            return res.json({
                success: true,
                suggestions: [],
                message: 'No query provided'
            });
        }

        console.log(`💡 Getting place suggestions for: "${q}"`);

        const placeResults = searchPlacesByText(q);
        const suggestions = placeResults.slice(0, parseInt(limit)).map(place => ({
            id: place.searchKey,
            name: place.name,
            type: place.type,
            matchType: place.matchType,
            state: place.state,
            aliases: place.aliases || []
        }));

        res.json({
            success: true,
            query: q,
            suggestions: suggestions,
            count: suggestions.length,
            message: `Found ${suggestions.length} place suggestions`
        });

    } catch (error) {
        console.error('❌ Places suggestions error:', error);
        res.status(500).json({
            success: false,
            error: 'Places suggestions failed',
            message: error.message
        });
    }
}

// Keep existing near-locate and reverse-geocode controllers...
async function nearLocateController(req, res) {
    // Same as before - for when coordinates are provided
}

async function reverseGeocodeController(req, res) {
    // Same as before - for when coordinates are provided  
}

module.exports = {
    textSearchController,
    textLocateController,
    placesSuggestionsController,
    nearLocateController,
    reverseGeocodeController
};
