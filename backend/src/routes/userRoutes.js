// backend/src/routes/userRoutes.js
"use strict";

const express = require("express");
const router = express.Router();
const { db, admin } = require("../config/firebase");
const auth = require("../middleware/auth");

// Block owners/admins from user-only routes
function requireStrictUser(req, res, next) {
    if (!req.user) return res.status(401).json({ success: false, error: "Authentication required" });
    if (req.user.isOwner || req.user.isAdmin) {
        return res.status(403).json({ success: false, error: "User access only" });
    }
    return next();
}

const hasDb = !!db;
const fv = admin?.firestore?.FieldValue;

// Helpers
const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};
const favDocId = (uid, stationId) => `${uid}__${stationId}`;

/**
 * ======================
 * USER MANAGEMENT ROUTES
 * ======================
 */

/**
 * @route   GET /api/users/me
 * @desc    Get current authenticated user profile
 * @access  Private (strict user)
 */
router.get("/me", auth, requireStrictUser, async (req, res) => {
    try {
        const u = req.user;
        const userSnap = hasDb ? await db.collection("users").doc(u.uid).get() : null;
        const profile = userSnap?.exists ? userSnap.data() : null;

        res.json({
            success: true,
            user: {
                uid: u.uid,
                email: u.email,
                emailVerified: u.emailVerified,
                phoneNumber: u.phoneNumber,
                role: u.role,
                isAdmin: u.isAdmin,
                isOwner: u.isOwner,
                customClaims: u.customClaims,
                profile:
                    profile || {
                        email: u.email,
                        role: u.role || "user",
                        createdAt: new Date().toISOString(),
                    },
                lastActivity: profile?.lastActivity,
                createdAt: profile?.createdAt,
            },
        });
    } catch (error) {
        console.error("Get user profile error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get user profile",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

/**
 * @route   PATCH /api/users/me
 * @desc    Update current user profile
 * @access  Private (strict user)
 */
router.patch("/me", auth, requireStrictUser, async (req, res) => {
    try {
        const { name, phone, avatar, preferences, bio } = req.body;
        const uid = req.user?.uid;
        if (!uid) {
            return res.status(401).json({ success: false, error: "User ID not found" });
        }

        const updateData = { updatedAt: new Date() };
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (bio !== undefined) updateData.bio = bio;
        if (preferences && typeof preferences === "object") {
            updateData.preferences = preferences;
        }

        if (hasDb) {
            await db.collection("users").doc(uid).set(updateData, { merge: true });
            const updatedProfile = await db.collection("users").doc(uid).get();
            const profileData = updatedProfile.data();
            return res.json({
                success: true,
                message: "Profile updated successfully",
                user: { uid, email: req.user.email, profile: profileData },
            });
        }

        // Demo fallback
        return res.json({
            success: true,
            message: "Profile updated successfully (demo)",
            user: { uid, email: req.user.email, profile: updateData },
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update profile",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

/**
 * @route   GET /api/users/me/bookings
 * @desc    Get current user's bookings
 * @access  Private (strict user)
 * @query   ?status=completed&limit=20&offset=0
 */
router.get("/me/bookings", auth, requireStrictUser, async (req, res) => {
    try {
        const { status, limit = 20, offset = 0 } = req.query;
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ success: false, error: "User ID not found" });

        if (!hasDb) {
            return res.json({
                success: true,
                bookings: [],
                count: 0,
                hasMore: false,
                message: "Bookings endpoint - demo implementation",
            });
        }

        let query = db.collection("bookings").where("userId", "==", uid);
        if (status) query = query.where("status", "==", status);
        query = query.orderBy("createdAt", "desc").limit(Number(limit)).offset(Number(offset));

        const snapshot = await query.get();
        const bookings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        res.json({
            success: true,
            bookings,
            count: bookings.length,
            hasMore: bookings.length === Number(limit),
        });
    } catch (error) {
        console.error("Get user bookings error:", error);
        res.json({
            success: true,
            bookings: [],
            message: "Bookings endpoint - demo implementation",
        });
    }
});

/**
 * =================
 * FAVORITES (v2 API)
 * =================
 * Storage priority:
 *   1) favorites collection: docId `${uid}__${stationId}`
 *   2) fallback to users/{uid}.favoriteStations array
 */

/**
 * @route   GET /api/users/me/favorites
 * @desc    List user's favorite stations
 * @access  Private (strict user)
 */
router.get("/me/favorites", auth, requireStrictUser, async (req, res) => {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ success: false, error: "User ID not found" });

        // No DB → demo
        if (!hasDb) {
            return res.json({ success: true, favorites: [], count: 0, source: "demo" });
        }

        // Try favorites collection first
        const favSnap = await db.collection("favorites").where("userId", "==", uid).get();
        let stationIds = favSnap.empty ? [] : favSnap.docs.map((d) => d.data().stationId).filter(Boolean);

        // Fallback to array field on user doc
        if (stationIds.length === 0) {
            const userSnap = await db.collection("users").doc(uid).get();
            const favoriteStations = userSnap.exists ? (userSnap.data().favoriteStations || []) : [];
            stationIds = favoriteStations.map(String);
        }

        if (stationIds.length === 0) {
            return res.json({ success: true, favorites: [], count: 0 });
        }

        // Fetch stations (supports both "stations" and "ev_bunks" collections)
        const uniqueIds = Array.from(new Set(stationIds.map(String)));
        const batches = chunk(uniqueIds, 10);

        const results = [];
        for (const ids of batches) {
            // Try "stations"
            const s1 = await db.collection("stations").where(admin.firestore.FieldPath.documentId(), "in", ids).get().catch(() => null);
            if (s1 && !s1.empty) {
                s1.docs.forEach((d) => results.push({ id: d.id, ...d.data() }));
                continue;
            }
            // Try "ev_bunks"
            const s2 = await db.collection("ev_bunks").where(admin.firestore.FieldPath.documentId(), "in", ids).get().catch(() => null);
            if (s2 && !s2.empty) {
                s2.docs.forEach((d) => results.push({ id: d.id, ...d.data() }));
            }
        }

        return res.json({ success: true, favorites: results, count: results.length });
    } catch (error) {
        console.error("list favorites error:", error);
        return res.status(500).json({ success: false, error: error.message || "Failed to list favorites" });
    }
});

/**
 * @route   POST /api/users/me/favorites
 * @desc    Add a station to favorites (body: { stationId })
 * @access  Private (strict user)
 */
router.post("/me/favorites", auth, requireStrictUser, async (req, res) => {
    try {
        const uid = req.user?.uid;
        const { stationId } = req.body || {};
        if (!uid) return res.status(401).json({ success: false, error: "User ID not found" });
        if (!stationId) return res.status(400).json({ success: false, error: "stationId is required" });

        if (!hasDb) {
            return res.status(201).json({
                success: true,
                favorite: { id: favDocId(uid, stationId), userId: uid, stationId, demo: true },
            });
        }

        // Prefer favorites collection
        const id = favDocId(uid, String(stationId));
        const now = admin.firestore.FieldValue.serverTimestamp();
        await db.collection("favorites").doc(id).set(
            { userId: uid, stationId: String(stationId), createdAt: now, updatedAt: now },
            { merge: true }
        );

        // Keep legacy array updated (optional)
        await db.collection("users").doc(uid).set(
            { favoriteStations: fv?.arrayUnion ? fv.arrayUnion(String(stationId)) : [String(stationId)], updatedAt: now },
            { merge: true }
        );

        const doc = await db.collection("favorites").doc(id).get();
        return res.status(201).json({ success: true, favorite: { id, ...doc.data() } });
    } catch (error) {
        console.error("add favorite error:", error);
        return res.status(500).json({ success: false, error: error.message || "Failed to add favorite" });
    }
});

/**
 * @route   POST /api/users/me/favorites/toggle
 * @desc    Toggle favorite (body: { stationId })
 * @access  Private (strict user)
 */
router.post("/me/favorites/toggle", auth, requireStrictUser, async (req, res) => {
    try {
        const uid = req.user?.uid;
        const { stationId } = req.body || {};
        if (!uid) return res.status(401).json({ success: false, error: "User ID not found" });
        if (!stationId) return res.status(400).json({ success: false, error: "stationId is required" });

        if (!hasDb) return res.json({ success: true, toggled: "added", demo: true });

        const id = favDocId(uid, String(stationId));
        const ref = db.collection("favorites").doc(id);
        const snap = await ref.get();

        if (snap.exists) {
            await ref.delete();
            if (fv?.arrayRemove) {
                await db.collection("users").doc(uid).set(
                    { favoriteStations: fv.arrayRemove(String(stationId)), updatedAt: new Date() },
                    { merge: true }
                );
            }
            return res.json({ success: true, toggled: "removed" });
        } else {
            const now = admin.firestore.FieldValue.serverTimestamp();
            await ref.set({ userId: uid, stationId: String(stationId), createdAt: now, updatedAt: now });
            if (fv?.arrayUnion) {
                await db.collection("users").doc(uid).set(
                    { favoriteStations: fv.arrayUnion(String(stationId)), updatedAt: now },
                    { merge: true }
                );
            }
            return res.json({ success: true, toggled: "added" });
        }
    } catch (error) {
        console.error("toggle favorite error:", error);
        return res.status(500).json({ success: false, error: error.message || "Failed to toggle favorite" });
    }
});

/**
 * @route   DELETE /api/users/me/favorites/:stationId
 * @desc    Remove a station from favorites
 * @access  Private (strict user)
 */
router.delete("/me/favorites/:stationId", auth, requireStrictUser, async (req, res) => {
    try {
        const uid = req.user?.uid;
        const { stationId } = req.params;
        if (!uid) return res.status(401).json({ success: false, error: "User ID not found" });
        if (!stationId) return res.status(400).json({ success: false, error: "stationId is required" });

        if (!hasDb) return res.json({ success: true, removed: true, demo: true });

        const id = favDocId(uid, String(stationId));
        await db.collection("favorites").doc(id).delete();

        if (fv?.arrayRemove) {
            await db.collection("users").doc(uid).set(
                { favoriteStations: fv.arrayRemove(String(stationId)), updatedAt: new Date() },
                { merge: true }
            );
        }

        return res.json({ success: true, removed: true });
    } catch (error) {
        console.error("remove favorite error:", error);
        return res.status(500).json({ success: false, error: error.message || "Failed to remove favorite" });
    }
});

/**
 * ===========================
 * (Legacy) Stations favorites
 * ===========================
 * Kept for backward compatibility with your older paths
 *  - GET    /api/users/stations/favorites
 *  - POST   /api/users/stations/:stationId/favorite
 *  - DELETE /api/users/stations/:stationId/favorite
 */
router.get("/stations/favorites", auth, requireStrictUser, async (req, res) => {
    try {
        // Reuse the new handler
        req.url = "/me/favorites";
        return router.handle(req, res);
    } catch (error) {
        console.error("legacy favorites list error:", error);
        return res.json({ success: true, stations: [], message: "Favorites endpoint - demo implementation" });
    }
});

router.post("/stations/:stationId/favorite", auth, requireStrictUser, async (req, res) => {
    try {
        const { stationId } = req.params;
        req.body = { ...(req.body || {}), stationId };
        req.url = "/me/favorites";
        req.method = "POST";
        return router.handle(req, res);
    } catch (error) {
        console.error("legacy add favorite error:", error);
        return res.status(500).json({ success: false, error: "Failed to add favorite" });
    }
});

router.delete("/stations/:stationId/favorite", auth, requireStrictUser, async (req, res) => {
    try {
        const { stationId } = req.params;
        req.url = `/me/favorites/${encodeURIComponent(stationId)}`;
        req.method = "DELETE";
        return router.handle(req, res);
    } catch (error) {
        console.error("legacy remove favorite error:", error);
        return res.status(500).json({ success: false, error: "Failed to remove favorite" });
    }
});

module.exports = router;
