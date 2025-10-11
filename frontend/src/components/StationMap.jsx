// frontend/src/components/StationMap.jsx - NO CHECKBOX VERSION
import { useEffect, useRef, useState } from "react";
import axios from "axios";

const cssHref = (key) => `https://apis.mappls.com/advancedmaps/api/${key}/map_sdk?layer=vector&v=3.0`;
const jsSrc = (key) => `https://apis.mappls.com/advancedmaps/api/${key}/map_sdk?layer=vector&v=3.0`;

export default function StationMap({
    query = "",
    height = 520,
    enableLocation = true
}) {
    const KEY = import.meta.env.VITE_MAPPLS_REST_KEY;
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const mapLoadedRef = useRef(false);
    const markersRef = useRef([]);

    // Core map states
    const [loading, setLoading] = useState(false);
    const [searchResult, setSearchResult] = useState(null);
    const [mapReady, setMapReady] = useState(false);
    const [debugInfo, setDebugInfo] = useState("Initializing map...");

    // Location states
    const [userLocation, setUserLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState(null);

    // ✅ INITIALIZATION
    useEffect(() => {
        if (!KEY) {
            setDebugInfo("❌ VITE_MAPPLS_REST_KEY missing in .env file");
            return;
        }
        loadMappls();
    }, [KEY]);

    // Handle external query (if passed as prop)
    useEffect(() => {
        if (query && mapReady && mapLoadedRef.current) {
            performTextSearch(query);
        }
    }, [query, mapReady]);

    // ✅ MAP INITIALIZATION FUNCTIONS
    async function loadMappls() {
        try {
            setDebugInfo("📍 Loading map...");

            // Inject CSS
            if (!document.getElementById("mappls-css")) {
                const link = document.createElement("link");
                link.id = "mappls-css";
                link.rel = "stylesheet";
                link.href = cssHref(KEY);
                document.head.appendChild(link);
            }

            // Load Mappls SDK
            if (!window.mappls) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = jsSrc(KEY);
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            setTimeout(() => {
                initializeMap();
            }, 100);

        } catch (error) {
            setDebugInfo(`❌ Error loading Mappls SDK: ${error.message}`);
            console.error("SDK Load Error:", error);
        }
    }

    function initializeMap() {
        if (!window.mappls) {
            setDebugInfo("❌ Mappls SDK not available");
            return;
        }

        const container = document.getElementById("mappls-container");
        if (!container) {
            setDebugInfo("❌ Map container not found");
            setTimeout(initializeMap, 500);
            return;
        }

        try {
            setDebugInfo("🗺️ Setting up map...");

            const map = new window.mappls.Map("mappls-container", {
                center: [75.5261246, 20.8428826], // Jalgaon coordinates [lng, lat]
                zoom: 6,
                zoomControl: true,
            });

            mapRef.current = map;

            let mapLoaded = false;
            const markMapReady = () => {
                if (!mapLoaded) {
                    console.log("✅ Map fully loaded and ready");
                    mapLoadedRef.current = true;
                    setMapReady(true);
                    setDebugInfo("✅ Map ready! Click the location button to find nearby EV stations");
                    injectCustomCSS();
                    mapLoaded = true;
                }
            };

            // Multiple ready events for reliability
            map.on('load', markMapReady);
            map.on('idle', markMapReady);
            map.on('sourcedata', () => {
                if (map.isStyleLoaded()) {
                    markMapReady();
                }
            });

            // Fallback timeout
            setTimeout(markMapReady, 3000);

            map.on('error', (e) => {
                console.error("Map error:", e);
                setDebugInfo(`❌ Map error: ${e.message || 'Unknown error'}`);
            });

        } catch (error) {
            setDebugInfo(`❌ Error initializing map: ${error.message}`);
            console.error("Map initialization error:", error);
        }
    }

    // ✅ SEARCH FUNCTION (for external queries only)
    async function performTextSearch(searchText) {
        if (!searchText || searchText.length < 2) return;

        setLoading(true);
        setDebugInfo(`🔍 Searching Firebase for: "${searchText}"`);

        try {
            // Try to find location using text
            const locationResponse = await axios.get('/api/maps/text-locate', {
                params: { q: searchText }
            });

            if (locationResponse.data.success && locationResponse.data.location) {
                const location = locationResponse.data.location;

                // Center map on found location
                if (mapRef.current && mapReady) {
                    mapRef.current.setCenter([location.lng, location.lat]);
                    mapRef.current.setZoom(12);
                }

                // Search for stations in Firebase database
                const stationResponse = await axios.get('/api/maps/text', {
                    params: {
                        q: searchText,
                        limit: 20
                    }
                });

                if (stationResponse.data.success && stationResponse.data.stations.length > 0) {
                    const stations = stationResponse.data.stations;
                    const dbStats = stationResponse.data.dataSource?.firebase;

                    setDebugInfo(`✅ Found ${stations.length} stations (${dbStats?.total || 0} total in Firebase DB)`);

                    setSearchResult({
                        hasStations: true,
                        stations: stations,
                        query: searchText,
                        location: location,
                        dataSource: 'firebase'
                    });

                    displayStationsOnMap(stations);
                } else {
                    setDebugInfo(`📍 Found ${location.name} but no EV stations in Firebase database`);
                    setSearchResult({
                        hasStations: false,
                        stations: [],
                        query: searchText,
                        location: location
                    });
                    clearAllMarkers();
                    addLocationMarker(location.lng, location.lat, location.name);
                }
            }

        } catch (error) {
            console.error("Text search error:", error);
            setDebugInfo(`❌ Search error: ${error.response?.data?.message || error.message}`);
        } finally {
            setLoading(false);
        }
    }

    // ✅ USER LOCATION FUNCTIONS
    async function getUserLocation() {
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by this browser");
            setDebugInfo("❌ Geolocation not supported");
            return;
        }

        setLocationLoading(true);
        setLocationError(null);
        setDebugInfo("🌍 Getting your location...");

        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000
        };

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, options);
            });

            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });

            if (mapRef.current && mapReady) {
                mapRef.current.setCenter([longitude, latitude]);
                mapRef.current.setZoom(14);
                addUserLocationMarker(longitude, latitude);
            }

            setDebugInfo("📍 Location found! Searching for nearby EV stations...");

            // Get nearby stations from Firebase
            try {
                const nearbyResponse = await axios.get('/api/maps/near-locate', {
                    params: {
                        lat: latitude,
                        lng: longitude,
                        radius: 25,
                        include_address: true
                    }
                });

                if (nearbyResponse.data.success) {
                    const result = nearbyResponse.data;
                    const stations = result.stations || [];
                    const dbStats = result.dataSource?.firebase;

                    if (stations.length > 0) {
                        setDebugInfo(`✅ Found ${stations.length} nearby EV stations (${dbStats?.total || 0} total in Firebase)`);

                        setSearchResult({
                            hasStations: true,
                            stations: stations,
                            query: "nearby stations",
                            location: result.location,
                            dataSource: 'firebase'
                        });
                        displayStationsOnMap(stations);
                    } else {
                        setDebugInfo(`📍 ${result.location.address || 'Your location found'} - No nearby EV stations in Firebase database`);
                        setSearchResult({
                            hasStations: false,
                            stations: [],
                            query: "nearby search",
                            location: result.location
                        });
                    }
                } else {
                    setDebugInfo("📍 Location found but couldn't search Firebase database");
                }
            } catch (nearbyError) {
                console.error('Nearby stations search failed:', nearbyError);
                setDebugInfo("📍 Location found but search failed - try again");
            }

        } catch (error) {
            let errorMsg = "Failed to get location";

            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = "Location access denied - Please allow location access";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = "Location information unavailable";
                    break;
                case error.TIMEOUT:
                    errorMsg = "Location request timed out - try again";
                    break;
                default:
                    errorMsg = error.message || "Unknown location error";
            }

            setLocationError(errorMsg);
            setDebugInfo(`❌ ${errorMsg}`);
            console.error("Location error:", error);
        } finally {
            setLocationLoading(false);
        }
    }

    // ✅ MAP DISPLAY FUNCTIONS
    function clearAllMarkers() {
        console.log("🧹 Clearing all markers");

        // Clear from our reference
        markersRef.current.forEach(marker => {
            try {
                if (marker && typeof marker.remove === 'function') {
                    marker.remove();
                }
            } catch (e) {
                console.warn("Error removing marker:", e);
            }
        });
        markersRef.current = [];

        // Clear from map object
        const map = mapRef.current;
        if (map && map._customMarkers) {
            map._customMarkers.forEach(marker => {
                try {
                    if (marker && typeof marker.remove === 'function') {
                        marker.remove();
                    }
                } catch (e) {
                    console.warn("Error removing map marker:", e);
                }
            });
            map._customMarkers = [];
        }
    }

    function displayStationsOnMap(stations) {
        const map = mapRef.current;

        if (!map || !window.mappls || !mapReady || !mapLoadedRef.current) {
            console.warn("Map not ready for displaying stations");
            return;
        }

        console.log(`✅ Displaying ${stations.length} stations on map`);

        // Clear existing markers
        clearAllMarkers();

        if (stations.length === 0) {
            console.log("No stations to display");
            return;
        }

        // Add markers for each station
        const successfulMarkers = [];

        stations.forEach((station, index) => {
            try {
                // Validate coordinates
                if (!station.location || !station.location.lat || !station.location.lng ||
                    isNaN(station.location.lat) || isNaN(station.location.lng)) {
                    console.warn(`Invalid coordinates for station ${station.id}`);
                    return;
                }

                // Create custom marker element
                const markerEl = document.createElement('div');
                markerEl.className = 'custom-marker';
                markerEl.innerHTML = `
                    <div class="marker-pin"></div>
                    <div class="marker-label">${index + 1}</div>
                `;
                markerEl.title = `${station.name} - ${station.address}`;

                try {
                    const marker = new window.mappls.Marker({
                        element: markerEl
                    }).setLngLat([station.location.lng, station.location.lat]);

                    marker.addTo(map);

                    successfulMarkers.push(marker);
                    markersRef.current.push(marker);

                    // Initialize map markers array if needed
                    if (!map._customMarkers) {
                        map._customMarkers = [];
                    }
                    map._customMarkers.push(marker);

                    // Add click event for popup
                    markerEl.addEventListener('click', () => {
                        try {
                            const popup = new window.mappls.Popup()
                                .setLngLat([station.location.lng, station.location.lat])
                                .setHTML(`
                                    <div style="min-width: 220px; padding: 4px;">
                                        <h4 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">${station.name}</h4>
                                        <p style="margin: 0 0 4px 0; font-size: 13px; color: #666;">${station.address}</p>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                            <span style="color: green; font-weight: bold; font-size: 12px;">
                                                ⚡ Status: ${station.status || 'Active'}
                                            </span>
                                            ${station.distance ? `<span style="color: #3b82f6; font-size: 12px;">📍 ${station.distanceText || station.distance + 'km away'}</span>` : ''}
                                        </div>
                                        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee;">
                                            <span style="color: #8b5cf6; font-size: 11px;">🗄️ Source: Firebase Database</span>
                                        </div>
                                    </div>
                                `)
                                .addTo(map);
                        } catch (popupError) {
                            console.error("Error creating popup:", popupError);
                        }
                    });

                    console.log(`✅ Added marker ${index + 1} for ${station.name}`);

                } catch (markerError) {
                    console.error(`❌ Error creating marker for station ${station.id}:`, markerError);
                }

            } catch (overallError) {
                console.error(`❌ Overall error processing station ${station.id}:`, overallError);
            }
        });

        // Center map on first station after markers are added
        setTimeout(() => {
            if (stations.length > 0 && successfulMarkers.length > 0) {
                try {
                    map.setCenter([stations[0].location.lng, stations[0].location.lat]);
                    map.setZoom(13);
                    console.log(`✅ Map centered on ${stations[0].name}`);
                } catch (centerError) {
                    console.warn("Error centering map:", centerError);
                }
            }
        }, 100);

        console.log(`✅ Display complete: ${successfulMarkers.length}/${stations.length} markers added successfully`);
    }

    function addLocationMarker(lng, lat, name) {
        const map = mapRef.current;
        if (!map || !window.mappls) return;

        try {
            const locationMarkerEl = document.createElement('div');
            locationMarkerEl.className = 'location-marker';
            locationMarkerEl.innerHTML = `<div class="location-pin">📍</div>`;
            locationMarkerEl.title = name;

            const marker = new window.mappls.Marker({
                element: locationMarkerEl
            }).setLngLat([lng, lat]);

            marker.addTo(map);
            markersRef.current.push(marker);

            // Add popup
            locationMarkerEl.addEventListener('click', () => {
                const popup = new window.mappls.Popup()
                    .setLngLat([lng, lat])
                    .setHTML(`
                        <div style="min-width: 200px;">
                            <h4 style="margin: 0 0 8px 0; color: #333;">${name}</h4>
                            <p style="margin: 0; font-size: 12px; color: #666;">
                                📍 Location found<br>
                                🔍 No EV stations found here
                            </p>
                        </div>
                    `)
                    .addTo(map);
            });

            console.log(`✅ Added location marker for ${name}`);

        } catch (error) {
            console.error("Error adding location marker:", error);
        }
    }

    function addUserLocationMarker(lng, lat) {
        const map = mapRef.current;
        if (!map || !window.mappls) return;

        try {
            // Remove existing user marker
            if (map._userMarker) {
                map._userMarker.remove();
            }

            const userMarkerEl = document.createElement('div');
            userMarkerEl.className = 'user-location-marker';
            userMarkerEl.innerHTML = `
                <div class="user-pin">
                    <div class="user-pulse"></div>
                </div>
            `;
            userMarkerEl.title = "Your Location";

            const userMarker = new window.mappls.Marker({
                element: userMarkerEl
            }).setLngLat([lng, lat]);

            userMarker.addTo(map);
            map._userMarker = userMarker;

            // Add popup for user location
            userMarkerEl.addEventListener('click', () => {
                const popup = new window.mappls.Popup()
                    .setLngLat([lng, lat])
                    .setHTML(`
                        <div style="min-width: 180px; text-align: center;">
                            <h4 style="margin: 0 0 8px 0; color: #333;">📍 Your Location</h4>
                            <p style="margin: 0; font-size: 12px; color: #666;">
                                Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}
                            </p>
                        </div>
                    `)
                    .addTo(map);
            });

            console.log("✅ Added user location marker");

        } catch (error) {
            console.error("Error adding user location marker:", error);
        }
    }

    function injectCustomCSS() {
        if (document.getElementById("custom-marker-css")) return;

        const style = document.createElement("style");
        style.id = "custom-marker-css";
        style.textContent = `
            .custom-marker {
                cursor: pointer;
                position: relative;
            }
            .marker-pin {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: #007bff;
                border: 3px solid white;
                box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                animation: bounce 2s infinite;
            }
            .marker-label {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 11px;
                font-weight: bold;
                pointer-events: none;
            }
            .location-marker {
                cursor: pointer;
                font-size: 22px;
                animation: bounce 2s infinite;
            }
            .user-location-marker {
                cursor: pointer;
                position: relative;
            }
            .user-pin {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #ff4757;
                border: 3px solid white;
                box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                position: relative;
            }
            .user-pulse {
                position: absolute;
                top: -8px;
                left: -8px;
                width: 32px;
                height: 32px;
                border: 2px solid #ff4757;
                border-radius: 50%;
                animation: pulse 2s infinite;
                opacity: 0.6;
            }
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-5px); }
                60% { transform: translateY(-3px); }
            }
            @keyframes pulse {
                0% { transform: scale(0.5); opacity: 1; }
                100% { transform: scale(2); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // ✅ RENDER - COMPLETELY CLEAN VERSION (NO CHECKBOX, JUST LOCATION BUTTON)
    return (
        <div style={{ position: "relative", height }}>
            {/* Map Container */}
            <div
                id="mappls-container"
                ref={mapContainerRef}
                style={{ width: "100%", height: "100%" }}
            />

            {/* ✅ ONLY LOCATION BUTTON - NO CHECKBOX */}
            {enableLocation && (
                <button
                    onClick={getUserLocation}
                    disabled={locationLoading || !mapReady}
                    style={{
                        position: "absolute",
                        top: "15px",
                        right: "15px",
                        background: userLocation ? "#10b981" : (locationLoading ? "#6b7280" : "#007bff"),
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        cursor: (locationLoading || !mapReady) ? "not-allowed" : "pointer",
                        fontSize: "13px",
                        fontWeight: "600",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        zIndex: 1000,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.3s ease"
                    }}
                    title={locationLoading ? "Getting location..." : userLocation ? "Location found" : "Find nearby EV stations"}
                >
                    {locationLoading ? (
                        <>
                            <span style={{ animation: "spin 1s linear infinite" }}>🔄</span>
                            Finding...
                        </>
                    ) : userLocation ? (
                        <>📍 Located</>
                    ) : (
                        <>🎯 Use my location</>
                    )}
                </button>
            )}

            {/* Debug Info */}
            <div style={{
                position: "absolute",
                bottom: "15px",
                left: "15px",
                background: "rgba(0,0,0,0.85)",
                color: "white",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                maxWidth: "320px",
                wordWrap: "break-word",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}>
                {debugInfo}
                {userLocation && (
                    <div style={{ marginTop: 4, fontSize: 10, color: "#90EE90" }}>
                        📍 Your location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                    </div>
                )}
                {locationError && (
                    <div style={{ marginTop: 4, fontSize: 10, color: "#FFB6C1" }}>
                        ❌ {locationError}
                    </div>
                )}
            </div>

            {/* Search Results */}
            {searchResult && !loading && (
                <div style={{
                    position: "absolute",
                    bottom: "15px",
                    right: "15px",
                    background: searchResult.hasStations ? "#10b981" : "#f59e0b",
                    color: "white",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                }}>
                    {searchResult.hasStations
                        ? `✅ ${searchResult.stations.length} EV Station${searchResult.stations.length > 1 ? 's' : ''} Found`
                        : "📍 Location Found - No EV Stations"
                    }
                </div>
            )}

            {/* Loading Indicator */}
            {loading && (
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "rgba(0,0,0,0.9)",
                    color: "white",
                    padding: "20px 28px",
                    borderRadius: "10px",
                    textAlign: "center",
                    zIndex: 2000,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)"
                }}>
                    <div style={{ fontSize: "18px", marginBottom: "10px" }}>🔍</div>
                    <div style={{ fontSize: "13px", fontWeight: "500" }}>Searching Firebase Database...</div>
                </div>
            )}

            {/* ✅ ADD SPIN ANIMATION FOR LOADING SPINNER */}
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
