// src/features/stations/pages/Planner.jsx - COMPLETE WORKING VERSION
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function Planner() {
    // ✅ SIMPLE STATE STRUCTURE
    const [originInput, setOriginInput] = useState('');
    const [destinationInput, setDestinationInput] = useState('');
    const [originCoords, setOriginCoords] = useState(null);
    const [destinationCoords, setDestinationCoords] = useState(null);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [showToast, setShowToast] = useState('');
    const [nearbyStations, setNearbyStations] = useState([]);
    const [isLoadingStations, setIsLoadingStations] = useState(false);

    // ✅ WORKING "Use My Location" Function
    const handleUseMyLocation = async () => {
        console.log('🚀 USE MY LOCATION CLICKED!');

        if (isGettingLocation) {
            console.log('⏸️ Already getting location');
            return;
        }

        if (!navigator.geolocation) {
            setShowToast('❌ Geolocation not supported');
            return;
        }

        try {
            setIsGettingLocation(true);
            console.log('📍 Getting GPS coordinates...');

            // Get GPS coordinates
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
                );
            });

            const { latitude, longitude } = position.coords;
            console.log(`📍 GPS coordinates: ${latitude}, ${longitude}`);

            // Call reverse geocoding API
            console.log('🔍 Calling reverse geocoding API...');
            const response = await axios.get(`/api/maps/reverse?lat=${latitude}&lng=${longitude}`);
            console.log('📥 API Response:', response.data);

            if (response.data) {
                const cityName = response.data.city || response.data.name || 'Current Location';
                const stateName = response.data.state || '';
                const displayText = stateName ? `${cityName}, ${stateName}` : cityName;

                console.log('✅ Setting input to:', displayText);

                // ✅ DIRECT STATE UPDATE
                setOriginInput(displayText);
                setOriginCoords({ lat: latitude, lng: longitude, name: displayText });
                setShowToast(`✅ Location: ${displayText}`);

                console.log('✅ State updated successfully!');
            } else {
                throw new Error('No data from reverse geocoding');
            }

        } catch (error) {
            console.error('❌ Location error:', error);
            const fallbackText = 'Current Location';
            setOriginInput(fallbackText);
            setOriginCoords({ lat: position?.coords?.latitude, lng: position?.coords?.longitude, name: fallbackText });
            setShowToast('⚠️ Location detected, but address lookup failed');
        } finally {
            setIsGettingLocation(false);
            console.log('🏁 Location process finished');
        }
    };

    // ✅ Search for nearby stations when origin is set
    useEffect(() => {
        if (!originCoords?.lat || !originCoords?.lng) {
            setNearbyStations([]);
            return;
        }

        const searchStations = async () => {
            try {
                setIsLoadingStations(true);
                console.log(`🔍 Searching stations near: ${originCoords.lat}, ${originCoords.lng}`);

                const response = await axios.get('/api/maps/nearby', {
                    params: {
                        lat: originCoords.lat,
                        lng: originCoords.lng,
                        radius: 25000,
                        q: ''
                    }
                });

                if (response.data && Array.isArray(response.data)) {
                    const stations = response.data.slice(0, 5);
                    setNearbyStations(stations);
                    console.log(`✅ Found ${stations.length} stations`);
                    if (stations.length > 0) {
                        setShowToast(`✅ Found ${stations.length} EV stations nearby!`);
                    }
                }
            } catch (error) {
                console.error('Station search error:', error);
                setShowToast('❌ Failed to find nearby stations');
            } finally {
                setIsLoadingStations(false);
            }
        };

        // Delay search to avoid too many API calls
        const timer = setTimeout(searchStations, 1000);
        return () => clearTimeout(timer);
    }, [originCoords]);

    // ✅ Clear toast after 4 seconds
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => setShowToast(''), 4000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // ✅ Reset function
    const handleReset = () => {
        setOriginInput('');
        setDestinationInput('');
        setOriginCoords(null);
        setDestinationCoords(null);
        setNearbyStations([]);
        setShowToast('🔄 Reset complete');
        console.log('🔄 All data reset');
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '10px', color: '#1f2937' }}>
                Trip Planner
            </h1>
            <p style={{ color: '#6b7280', marginBottom: '30px' }}>
                Choose your origin and destination. We'll estimate distance and time.
            </p>

            {/* Toast Notification */}
            {showToast && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    background: '#059669',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    {showToast}
                    <button
                        onClick={() => setShowToast('')}
                        style={{
                            marginLeft: '10px',
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Debug Info */}
            <div style={{
                background: '#f3f4f6',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '12px',
                fontFamily: 'monospace'
            }}>
                <strong>DEBUG:</strong> originInput = "{originInput}" | coords = {originCoords ? `${originCoords.lat}, ${originCoords.lng}` : 'null'}
            </div>

            {/* Main Form */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                marginBottom: '20px'
            }}>
                {/* Origin Section */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                        Origin
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="Enter origin city, address, or landmark..."
                            value={originInput}
                            onChange={(e) => setOriginInput(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                fontSize: '14px',
                                border: '2px solid #e5e7eb',
                                borderRadius: '8px',
                                outline: 'none',
                                transition: 'border-color 0.3s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                        />
                        <button
                            onClick={handleUseMyLocation}
                            disabled={isGettingLocation}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: isGettingLocation ? '#9ca3af' : '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px 16px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: isGettingLocation ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s',
                                minWidth: '160px',
                                justifyContent: 'center'
                            }}
                        >
                            {isGettingLocation ? (
                                <>
                                    <span style={{
                                        display: 'inline-block',
                                        width: '16px',
                                        height: '16px',
                                        border: '2px solid #ffffff',
                                        borderTop: '2px solid transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }}></span>
                                    Getting...
                                </>
                            ) : (
                                <>
                                    📍 Use my location
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Destination Section */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                        Destination
                    </label>
                    <input
                        type="text"
                        placeholder="Enter destination..."
                        value={destinationInput}
                        onChange={(e) => setDestinationInput(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            fontSize: '14px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            outline: 'none',
                            transition: 'border-color 0.3s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleReset}
                        style={{
                            background: '#f3f4f6',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            padding: '8px 16px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            fontWeight: '500'
                        }}
                    >
                        Reset
                    </button>

                    {originCoords && destinationInput && (
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lng}&destination=${encodeURIComponent(destinationInput)}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-block',
                                background: '#3b82f6',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '6px',
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}
                        >
                            🗺️ Open in Google Maps
                        </a>
                    )}

                    {originCoords && (
                        <button
                            onClick={() => window.open(`/search?near=${originCoords.lat},${originCoords.lng}`, '_blank')}
                            style={{
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer'
                            }}
                        >
                            🔍 Find Stations Near Origin
                        </button>
                    )}
                </div>
            </div>

            {/* Nearby Stations Results */}
            {nearbyStations.length > 0 && (
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, color: '#1f2937' }}>
                            ⚡ EV Charging Stations Near {originCoords?.name}
                        </h3>
                        <span style={{
                            background: '#f0fdf4',
                            color: '#166534',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500'
                        }}>
                            {nearbyStations.length} found
                        </span>
                        {isLoadingStations && (
                            <span style={{
                                display: 'inline-block',
                                width: '16px',
                                height: '16px',
                                border: '2px solid #10b981',
                                borderTop: '2px solid transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></span>
                        )}
                    </div>

                    <div style={{ display: 'grid', gap: '12px' }}>
                        {nearbyStations.map((station, index) => (
                            <div key={station.id || index} style={{
                                padding: '16px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                background: '#fafafa',
                                transition: 'all 0.3s'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                                        {station.name}
                                    </h4>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <span style={{
                                            background: '#dcfce7',
                                            color: '#166534',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: '500'
                                        }}>
                                            ⚡ Available
                                        </span>
                                        {station.distance && (
                                            <span style={{
                                                background: '#e0f2fe',
                                                color: '#0369a1',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '500'
                                            }}>
                                                📍 {station.distance.toFixed(1)}km
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <p style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: '14px' }}>
                                    📍 {station.address}
                                </p>

                                <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#6b7280' }}>
                                    <span>🗄️ Firebase Database</span>
                                    {station.latitude && station.longitude && (
                                        <button
                                            onClick={() => {
                                                const url = `https://www.google.com/maps/dir/${originCoords.lat},${originCoords.lng}/${station.latitude},${station.longitude}`;
                                                window.open(url, '_blank');
                                            }}
                                            style={{
                                                background: '#10b981',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                fontWeight: '500'
                                            }}
                                        >
                                            🧭 Get Directions
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Trip Summary */}
            {(originCoords || destinationInput) && (
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    marginTop: '20px'
                }}>
                    <h3 style={{ margin: '0 0 16px 0', color: '#1f2937' }}>Trip Summary</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Origin</div>
                            {originCoords ? (
                                <>
                                    <div style={{ fontWeight: '600', color: '#1f2937' }}>{originCoords.name}</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                        {originCoords.lat.toFixed(5)}, {originCoords.lng.toFixed(5)}
                                    </div>
                                </>
                            ) : (
                                <div style={{ color: '#9ca3af' }}>Not selected</div>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Destination</div>
                            {destinationInput ? (
                                <div style={{ fontWeight: '600', color: '#1f2937' }}>{destinationInput}</div>
                            ) : (
                                <div style={{ color: '#9ca3af' }}>Not selected</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CSS Animation */}
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
