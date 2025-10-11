"use strict";

const express = require("express");
const router = express.Router();
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const auth = require("../middleware/auth");
const adminController = require("../controllers/adminController");
const authCtrl = require("../controllers/authController");
const { db } = require("../config/firebase");

/* ---------------- Upload config ---------------- */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const ok = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.mimetype);
        cb(ok ? null : new Error("Only image files (JPEG, PNG, WebP) are allowed"), ok);
    },
});

/* ---------------- Rate limits ---------------- */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many authentication attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

router.use(apiLimiter);

/* ---------------- Admin guards ---------------- */
function isAdmin(req, res, next) {
    // Prefer req.user flags from auth middleware
    const u = req.user;
    const isAdminFlag =
        !!req.admin ||
        u?.isAdmin === true ||
        u?.role === "admin" ||
        u?.claims?.admin === true ||
        u?.customClaims?.admin === true;

    if (!u && !req.admin) {
        return res.status(401).json({ error: "Authentication required" });
    }
    if (!isAdminFlag) {
        return res.status(403).json({ error: "Admin access required" });
    }

    if (!req.admin && u) {
        req.admin = { id: u.uid, email: u.email, role: "admin" };
    }
    next();
}

function isSuperAdmin(req, res, next) {
    if (!req.admin || req.admin.role !== "super_admin") {
        return res.status(403).json({ error: "Super admin access required" });
    }
    next();
}

/* ======================
   AUTHENTICATION ROUTES
   ====================== */

// Admin login -> uses authController.adminLogin
router.post("/auth/login", authLimiter, authCtrl.adminLogin);

// Admin logout (clear cookie)
router.post("/auth/logout", auth, isAdmin, adminController.adminLogout);

// Optional: refresh endpoint
router.post("/auth/refresh", authLimiter, adminController.refreshToken);

// Verify current admin and echo identity
router.get("/auth/verify", auth, isAdmin, (req, res) => {
    const { password, refreshToken, ...safeAdmin } = req.admin || {};
    res.json({ success: true, admin: safeAdmin, message: "Token is valid" });
});

// Admin "me" endpoint (lightweight)
router.get("/auth/me", auth, isAdmin, (req, res) => {
    const u = req.user || {};
    res.json({
        ok: true,
        uid: u.uid || null,
        email: u.email || null,
        isAdmin: true,
    });
});

/* ======================
   PROFILE MANAGEMENT
   ====================== */

router.get("/profile", auth, isAdmin, adminController.getAdminProfile);
router.patch("/profile", auth, isAdmin, adminController.updateAdminProfile);
router.post(
    "/profile/avatar",
    auth,
    isAdmin,
    upload.single("avatar"),
    (req, res) => {
        res.json({
            success: true,
            message: "Avatar upload endpoint - implementation pending",
            file: req.file
                ? { originalName: req.file.originalname, size: req.file.size }
                : null,
        });
    }
);

/* ======================
   BOOKINGS MGMT
   ====================== */
router.get("/bookings", auth, isAdmin, adminController.listAllBookings);


/* ======================
   DASHBOARD & ANALYTICS
   ====================== */

router.get("/dashboard", auth, isAdmin, adminController.getDashboard);
router.get("/analytics/financial", auth, isAdmin, adminController.getFinancialAnalytics);
router.get("/analytics/bookings", auth, isAdmin, adminController.getBookingAnalytics);
router.get("/summary", auth, isAdmin, adminController.getDashboard);
router.get("/summary/stats", auth, isAdmin, adminController.getDashboardStats);

router.get("/analytics/kpis", auth, isAdmin, adminController.getAdminKpis);
router.get("/analytics/users", auth, isAdmin, adminController.getUserSignupTrends);
router.get("/analytics/top-stations", auth, isAdmin, adminController.getTopStations);
router.get("/analytics/errors", auth, isAdmin, adminController.getErrorCounts);


router.get("/analytics/stations", auth, isAdmin, async (req, res) => {
    try {
        const stationsSnapshot = await db.collection("ev_bunks").get();
        const stations = stationsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        const analytics = {
            totalStations: stations.length,
            activeStations: stations.filter((s) => s.status === "active").length,
            topPerforming: stations
                .sort((a, b) => (b.totalBookings || 0) - (a.totalBookings || 0))
                .slice(0, 5),
        };

        res.json({ success: true, analytics });
    } catch (error) {
        res.json({
            success: true,
            message: "Station analytics endpoint - implementation pending",
            analytics: { totalStations: 0, activeStations: 0, topPerforming: [] },
        });
    }
});

/* ======================
   PROFIT & PAYOUT MGMT
   ====================== */
router.post("/bunks", auth, isAdmin, adminController.createBunk);
router.get("/payouts/pending", auth, isAdmin, adminController.getPendingPayouts);
router.post("/payouts/process", auth, isAdmin, adminController.processOwnerPayout);
router.get("/payouts/history", auth, isAdmin, async (req, res) => {
    try {
        const payoutsSnapshot = await db
            .collection("payouts")
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();
        const payouts = payoutsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        res.json({ success: true, payouts });
    } catch (error) {
        res.json({ success: true, message: "Payout history endpoint - implementation pending", payouts: [] });
    }
});

/* ======================
   STATION/BUNK MGMT
   ====================== */

router.post("/bunks", auth, isAdmin, adminController.createBunk);
router.get("/bunks", auth, isAdmin, adminController.listBunks);

router.get("/bunks/:id", auth, isAdmin, async (req, res) => {
    try {
        const bunkDoc = await db.collection("ev_bunks").doc(req.params.id).get();
        if (!bunkDoc.exists) {
            return res.status(404).json({ success: false, error: "Station not found" });
        }
        res.json({ success: true, bunk: { id: bunkDoc.id, ...bunkDoc.data() } });
    } catch (error) {
        res.json({ success: true, message: "Get bunk by ID endpoint - implementation pending", id: req.params.id });
    }
});

router.put("/bunks/:id", auth, isAdmin, adminController.updateBunk);
router.patch("/bunks/:id", auth, isAdmin, adminController.updateBunk);
router.delete("/bunks/:id", auth, isAdmin, adminController.deleteBunk);
router.patch("/bunks/:id/feature", auth, isAdmin, adminController.toggleFeaturedStation);
router.post("/bunks/bulk-update", auth, isAdmin, adminController.bulkUpdateStations);



/* ======================
   USER MGMT
   ====================== */

router.get("/users", auth, isAdmin, adminController.listUsers);

router.get("/users/:id", auth, isAdmin, async (req, res) => {
    try {
        const userDoc = await db.collection("users").doc(req.params.id).get();
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, error: "User not found" });
        }
        res.json({ success: true, user: { id: userDoc.id, ...userDoc.data() } });
    } catch (error) {
        res.json({ success: true, message: "Get user by ID endpoint - implementation pending", id: req.params.id });
    }
});

router.patch("/users/:id", auth, isAdmin, adminController.updateUser);

router.post("/users/:id/ban", auth, isAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        await db.collection("users").doc(req.params.id).update({
            status: "banned",
            bannedAt: new Date(),
            banReason: reason || "Admin action",
            updatedAt: new Date(),
        });
        res.json({ success: true, message: "User banned successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to ban user", message: error.message });
    }
});

module.exports = router;
