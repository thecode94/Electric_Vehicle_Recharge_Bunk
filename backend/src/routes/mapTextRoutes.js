// backend/src/routes/mapTextRoutes.js - WITH PLACES SUGGESTIONS
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/mapTextController");

const {
    textSearchController,
    textLocateController,
    placesSuggestionsController,
    nearLocateController,
    reverseGeocodeController
} = ctrl;

/**
 * @route   GET /api/maps/text
 * @desc    Text-based EV station search using pure text matching
 * @example GET /api/maps/text?q=mumbai
 */
router.get("/text", textSearchController);

/**
 * @route   GET /api/maps/text-locate
 * @desc    Find location coordinates using pure text search
 * @example GET /api/maps/text-locate?q=bandra mumbai
 */
router.get("/text-locate", textLocateController);

/**
 * @route   GET /api/maps/places-suggestions
 * @desc    Get place suggestions for autocomplete (no geo API)
 * @example GET /api/maps/places-suggestions?q=mum&limit=5
 */
router.get("/places-suggestions", placesSuggestionsController);

/**
 * @route   GET /api/maps/near-locate
 * @desc    Find stations near coordinates (when coordinates available)
 */
router.get("/near-locate", nearLocateController);

/**
 * @route   GET /api/maps/reverse-geocode  
 * @desc    Get address from coordinates (when coordinates available)
 */
router.get("/reverse-geocode", reverseGeocodeController);

module.exports = router;
