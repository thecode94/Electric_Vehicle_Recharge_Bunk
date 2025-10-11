"use strict";

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");               // shared auth middleware (verifies session)
const authCtrl = require("../controllers/authController"); // for ownerLogin if you centralize auth
const ownerAuthController = require("../controllers/ownerAuthController"); // owner profile ops

// Simple owner guard that trusts req.user.isOwner set by auth middleware
function requireOwner(req, res, next) {
    const u = req.user;
    if (!u) return res.status(401).json({ success: false, error: "Authentication required" });
    if (u.isAdmin || u.isOwner) return next();
    return res.status(403).json({ success: false, error: "Station owner access required" });
}

/**
 * Public endpoints
 */

// Optional: owner registration (keep if implemented in your ownerAuthController)
router.post("/register", ownerAuthController.register);

// Owner login (owners only) — use centralized auth flow
// Returns { ok, uid, role:"owner", isOwner:true, owner:{...} }
router.post("/login", authCtrl.ownerLogin);

// Optional: password reset via auth controller if desired (alternatively keep in ownerAuthController)
router.post("/send-reset", ownerAuthController.sendPasswordReset);

/**
 * Protected owner endpoints
 */

// Get owner profile
router.get("/me", auth, requireOwner, ownerAuthController.me);

// Update owner profile
router.put("/profile", auth, requireOwner, ownerAuthController.updateProfile);

module.exports = router;
