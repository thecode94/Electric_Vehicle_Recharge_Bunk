"use strict";

const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/authController");
const cookieParser = require("cookie-parser");
const { requireAdmin } = require("../middleware/auth");


// Parse cookies for session cookie auth
router.use(cookieParser());

/**
 * Public auth endpoints
 */

// Register a regular user (creates users/{uid})
router.post("/register", authCtrl.register);

// User login (regular users only)
// Returns { ok, uid, role: "user", isOwner:false, isAdmin:false, profile }
router.post("/login", authCtrl.userLogin);

// Owner login (owners only)
// Returns { ok, uid, role: "owner", isOwner:true, owner }
router.post("/owner/login", authCtrl.ownerLogin);

// Optional: owner registration placeholder (keep or remove as needed)
router.post("/owner/register", async (_req, res) => {
    res.status(501).json({ success: false, error: "Owner registration not implemented" });
});

// Password reset email
router.post("/send-reset", authCtrl.sendPasswordReset);

/**
 * Session-protected user actions (middleware applied upstream)
 */

// Logout – clears session cookie
router.post("/logout", authCtrl.logout);

// Change password (requires valid session)
router.post("/change-password", authCtrl.changePassword);

// Update profile (writes users/{uid})
router.put("/profile", authCtrl.updateProfile);

// Delete account (revokes, deletes users/{uid}, clears cookie)
router.delete("/account", authCtrl.deleteAccount);

// Session summary – lightweight identity echo from auth middleware
router.get("/auth/me", requireAdmin, authCtrl.adminMe);
router.get("/me", authCtrl.me);

module.exports = router;
