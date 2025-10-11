// backend/src/routes/mapRoutes.js - COMPLETE VERSION WITH ALL ROUTES
"use strict";

const { Router } = require("express");
const mapsCtrl = require("../controllers/maps");

// Initialize router
const router = Router();

// Route: Nearby Search
// Example: GET /api/maps/nearby?lat=...&lng=...&radius=...
router.get("/nearby", mapsCtrl.nearby);

// Route: City Search  
// Example: GET /api/maps/city?q=jalgaon
router.get("/city", mapsCtrl.city);

// Route: Distance Matrix
// Example: GET /api/maps/distance?origins=...&destinations=...
router.get("/distance", mapsCtrl.distanceMatrix);

// Route: Search by query (name, city, etc.)
// Example: GET /api/maps/search?q=jalgaon
router.get("/search", mapsCtrl.searchStations);

// Route: Text-based location search
// Example: GET /api/maps/locate?q=mumbai
router.get("/locate", mapsCtrl.locate);

// Route: Firestore-only search
// Example: GET /api/maps/find?city=jalgaon&q=station
router.get("/find", mapsCtrl.findFirestoreOnly);

// ✅ MISSING ROUTE: Reverse Geocoding (FIXES 501 ERROR)
// Example: GET /api/maps/reverse?lat=20.0367&lng=73.7847
router.get("/reverse", mapsCtrl.reverseGeocode);

// Export the router
module.exports = router;
