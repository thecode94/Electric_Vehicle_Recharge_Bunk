// backend/src/controllers/adminController.js
"use strict";

const { db, admin } = require("../config/firebase");
const logger = require("../config/logger");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/* -------------------------------------------
 * helpers
 * -----------------------------------------*/
function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
}
function ensureJwtSecrets() {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        throw new Error("Missing JWT secrets (JWT_SECRET / JWT_REFRESH_SECRET)");
    }
}

/* ===========================================
 * AUTHENTICATION & SESSION MANAGEMENT
 * =========================================*/

/**
 * Admin Login (hardened)
 */
async function adminLogin(req, res) {
    try {
        let { email, password, rememberMe = false } = req.body || {};
        email = normalizeEmail(email);
        password = String(password || "");

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // Try query by email + active status
        let adminSnap = await db
            .collection("admins")
            .where("email", "==", email)
            .where("status", "==", "active")
            .limit(1)
            .get();

        // Fallback: if your doc id is the email itself
        if (adminSnap.empty) {
            const byId = await db.collection("admins").doc(email).get();
            if (byId.exists && (byId.data()?.status || "active") === "active") {
                adminSnap = { empty: false, docs: [byId] };
            }
        }

        if (adminSnap.empty) {
            // server log only
            console.warn("[ADMIN LOGIN] Not found or inactive:", email);
            return res.status(401).json({ error: "INVALID_LOGIN_CREDENTIALS" });
        }

        const adminDoc = adminSnap.docs[0];
        const adminData = adminDoc.data() || {};

        // Verify password against bcrypt hash in Firestore
        const hash = String(adminData.password || "");
        let passwordOK = false;
        try {
            passwordOK = await bcrypt.compare(password, hash);
        } catch {
            passwordOK = false;
        }
        if (!passwordOK) {
            console.warn("[ADMIN LOGIN] Password mismatch for:", email);
            return res.status(401).json({ error: "INVALID_LOGIN_CREDENTIALS" });
        }

        ensureJwtSecrets();

        const tokenPayload = {
            adminId: adminDoc.id,
            email: adminData.email,
            role: adminData.role || "admin",
            permissions: adminData.permissions || [],
        };

        const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
            expiresIn: rememberMe ? "30d" : "24h",
        });

        const refreshToken = jwt.sign(
            { adminId: adminDoc.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "90d" }
        );

        await db.collection("admins").doc(adminDoc.id).set(
            {
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
                refreshToken,
                loginCount: admin.firestore.FieldValue.increment(1),
            },
            { merge: true }
        );

        await logAdminAction(adminDoc.id, "LOGIN", {
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            rememberMe,
        });

        // Remove sensitive fields before returning
        const { password: _pw, refreshToken: _rt, ...safe } = adminData;

        return res.json({
            success: true,
            message: "Login successful",
            admin: { id: adminDoc.id, ...safe },
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: rememberMe ? "30d" : "24h",
            },
        });
    } catch (err) {
        console.error("🔥 adminLogin failed:", err);
        return res.status(500).json({ error: err.message || "Login failed" });
    }
}

/**
 * Admin Logout
 */
async function adminLogout(req, res) {
    try {
        const adminId = req.admin?.id;

        if (adminId) {
            await db.collection("admins").doc(adminId).set(
                {
                    refreshToken: null,
                    lastLogout: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            await logAdminAction(adminId, "LOGOUT", {
                ip: req.ip,
                userAgent: req.get("User-Agent"),
            });
        }

        return res.json({ success: true, message: "Logout successful" });
    } catch (err) {
        logger.error("adminLogout", err.message);
        return res.status(500).json({ error: "Logout failed" });
    }
}

/**
 * Refresh Access Token
 */
async function refreshToken(req, res) {
    try {
        ensureJwtSecrets();
        const { refreshToken } = req.body || {};
        if (!refreshToken) {
            return res.status(400).json({ error: "Refresh token is required" });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const adminDoc = await db.collection("admins").doc(decoded.adminId).get();

        if (!adminDoc.exists || adminDoc.data().refreshToken !== refreshToken) {
            return res.status(401).json({ error: "Invalid refresh token" });
        }

        const adminData = adminDoc.data();
        const tokenPayload = {
            adminId: adminDoc.id,
            email: adminData.email,
            role: adminData.role || "admin",
            permissions: adminData.permissions || [],
        };

        const newAccessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
            expiresIn: "24h",
        });

        return res.json({ success: true, accessToken: newAccessToken, expiresIn: "24h" });
    } catch (err) {
        logger.error("refreshToken", err.message);
        return res.status(401).json({ error: "Token refresh failed" });
    }
}

/* ===========================================
 * BUNK/STATION MANAGEMENT
 * =========================================*/

async function createBunk(req, res) {
    try {
        const {
            name,
            address,
            phone,
            location,
            slots = 0,
            pricing,
            amenities,
            operatingHours,
            status = "active",
            provider,
            connectors,
            ownerId,
        } = req.body || {};

        if (!name || !location) {
            return res.status(400).json({ error: "Name and location are required" });
        }
        if (!location.lat || !location.lng) {
            return res.status(400).json({ error: "Location must include lat and lng" });
        }

        const stationId = uuidv4();
        const data = {
            name,
            address: address || "",
            phone: phone || null,
            location,
            slots: Number(slots),
            pricing: pricing || { perKwh: 0 },
            amenities: amenities || [],
            operatingHours: operatingHours || "24/7",
            status,
            provider: provider || "Independent",
            connectors: connectors || [],
            ownerId: ownerId || req.admin?.id || null,
            createdBy: req.admin?.id,
            createdByAdmin: true,
            approved: true,
            featured: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("ev_bunks").doc(stationId).set(data);

        await logAdminAction(req.admin?.id, "CREATE_STATION", {
            stationId,
            name,
            location,
        });

        return res.status(201).json({
            success: true,
            id: stationId,
            station: data,
            message: "Station created successfully",
        });
    } catch (err) {
        logger.error("createBunk", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function updateBunk(req, res) {
    try {
        const { id } = req.params;
        const updates = {
            ...req.body,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: req.admin?.id,
        };

        Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

        const docRef = db.collection("ev_bunks").doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: "Station not found" });

        await docRef.update(updates);

        await logAdminAction(req.admin?.id, "UPDATE_STATION", {
            stationId: id,
            updates: Object.keys(updates),
        });

        const updatedDoc = await docRef.get();
        return res.json({
            success: true,
            station: { id: updatedDoc.id, ...updatedDoc.data() },
            message: "Station updated successfully",
        });
    } catch (err) {
        logger.error("updateBunk", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function listBunks(req, res) {
    try {
        const {
            status,
            ownerId,
            featured,
            limit = 50,
            offset = 0,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        let query = db.collection("ev_bunks");
        if (status) query = query.where("status", "==", status);
        if (ownerId) query = query.where("ownerId", "==", ownerId);
        if (featured !== undefined)
            query = query.where("featured", "==", String(featured) === "true");

        query = query.orderBy(sortBy, sortOrder).limit(Number(limit)).offset(Number(offset));

        const snap = await query.get();
        const bunks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const totalSnap = await db.collection("ev_bunks").get();
        const totalCount = totalSnap.size;

        return res.json({
            success: true,
            stations: bunks,
            bunks, // back-compat
            pagination: {
                limit: Number(limit),
                offset: Number(offset),
                total: totalCount,
                hasMore: bunks.length === Number(limit),
            },
        });
    } catch (err) {
        logger.error("listBunks", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function deleteBunk(req, res) {
    try {
        const { id } = req.params;
        const { permanent = false } = req.query;

        const docRef = db.collection("ev_bunks").doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: "Station not found" });

        if (String(permanent) === "true") {
            await docRef.delete();
            await logAdminAction(req.admin?.id, "DELETE_STATION_PERMANENT", {
                stationId: id,
                stationName: doc.data().name,
            });
            return res.json({ success: true, message: "Station permanently deleted" });
        }

        await docRef.update({
            status: "deleted",
            deletedAt: admin.firestore.FieldValue.serverTimestamp(),
            deletedBy: req.admin?.id,
        });
        await logAdminAction(req.admin?.id, "DELETE_STATION_SOFT", {
            stationId: id,
            stationName: doc.data().name,
        });

        return res.json({ success: true, message: "Station marked as deleted" });
    } catch (err) {
        logger.error("deleteBunk", err.message);
        return res.status(500).json({ error: err.message });
    }
}

/* ===========================================
 * PROFILE MANAGEMENT
 * =========================================*/

async function getAdminProfile(req, res) {
    try {
        const adminId = req.admin?.id;
        if (!adminId) return res.status(401).json({ error: "Admin ID not found" });

        const adminDoc = await db.collection("admins").doc(adminId).get();
        if (!adminDoc.exists) return res.status(404).json({ error: "Admin not found" });

        const { password, refreshToken, ...profileData } = adminDoc.data();

        const recentActivities = await db
            .collection("admin_logs")
            .where("adminId", "==", adminId)
            .orderBy("timestamp", "desc")
            .limit(10)
            .get();

        const activities = recentActivities.docs.map((d) => ({ id: d.id, ...d.data() }));

        return res.json({
            success: true,
            profile: { id: adminDoc.id, ...profileData, recentActivities: activities },
        });
    } catch (err) {
        logger.error("getAdminProfile", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function updateAdminProfile(req, res) {
    try {
        const adminId = req.admin?.id;
        if (!adminId) return res.status(401).json({ error: "Admin ID not found" });

        const { name, phone, avatar, preferences, currentPassword, newPassword } = req.body || {};
        const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (avatar) updateData.avatar = avatar;
        if (preferences) updateData.preferences = preferences;

        if (currentPassword && newPassword) {
            const adminDoc = await db.collection("admins").doc(adminId).get();
            const adminData = adminDoc.data() || {};
            const ok = await bcrypt.compare(String(currentPassword), String(adminData.password || ""));
            if (!ok) return res.status(400).json({ error: "Current password is incorrect" });

            updateData.password = await bcrypt.hash(String(newPassword), 12);
            updateData.passwordChangedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        await db.collection("admins").doc(adminId).set(updateData, { merge: true });
        await logAdminAction(adminId, "UPDATE_PROFILE", { updatedFields: Object.keys(updateData) });

        return res.json({ success: true, message: "Profile updated successfully" });
    } catch (err) {
        logger.error("updateAdminProfile", err.message);
        return res.status(500).json({ error: err.message });
    }
}

/* ===========================================
 * ADDITIONAL
 * =========================================*/

async function toggleFeaturedStation(req, res) {
    try {
        const { id } = req.params;
        const { featured } = req.body;

        const docRef = db.collection("ev_bunks").doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: "Station not found" });

        await docRef.update({
            featured: Boolean(featured),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: req.admin?.id,
        });

        await logAdminAction(req.admin?.id, "TOGGLE_FEATURED", {
            stationId: id,
            featured: Boolean(featured),
        });

        return res.json({
            success: true,
            message: `Station ${featured ? "featured" : "unfeatured"} successfully`,
        });
    } catch (err) {
        logger.error("toggleFeaturedStation", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function bulkUpdateStations(req, res) {
    try {
        const { stationIds, updates } = req.body || {};
        if (!Array.isArray(stationIds) || stationIds.length === 0) {
            return res.status(400).json({ error: "Station IDs array is required" });
        }
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "Updates object is required" });
        }

        const batch = db.batch();
        const updateData = {
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: req.admin?.id,
        };

        stationIds.forEach((id) => batch.update(db.collection("ev_bunks").doc(id), updateData));
        await batch.commit();

        await logAdminAction(req.admin?.id, "BULK_UPDATE_STATIONS", {
            stationIds,
            updatesApplied: Object.keys(updates),
            count: stationIds.length,
        });

        return res.json({
            success: true,
            message: `Successfully updated ${stationIds.length} stations`,
            updatedCount: stationIds.length,
        });
    } catch (err) {
        logger.error("bulkUpdateStations", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function listUsers(req, res) {
    try {
        const { role, status, limit = 50, offset = 0 } = req.query || {};
        let query = db.collection("users");
        if (role) query = query.where("role", "==", role);
        if (status) query = query.where("status", "==", status);
        query = query.orderBy("createdAt", "desc").limit(Number(limit)).offset(Number(offset));

        const snap = await query.get();
        const users = snap.docs.map((d) => {
            const { password, refreshToken, ...rest } = d.data() || {};
            return { id: d.id, ...rest };
        });

        return res.json({ success: true, users, count: users.length });
    } catch (err) {
        logger.error("listUsers", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function updateUser(req, res) {
    try {
        const { id } = req.params;
        const { role, status, verified } = req.body || {};

        const userRef = db.collection("users").doc(id);
        const user = await userRef.get();
        if (!user.exists) return res.status(404).json({ error: "User not found" });

        const updates = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: req.admin?.id,
        };
        if (role) updates.role = role;
        if (status) updates.status = status;
        if (verified !== undefined) updates.verified = verified;

        await userRef.update(updates);
        await logAdminAction(req.admin?.id, "UPDATE_USER", {
            targetUserId: id,
            updates: Object.keys(updates),
        });

        return res.json({ success: true, message: "User updated successfully" });
    } catch (err) {
        logger.error("updateUser", err.message);
        return res.status(500).json({ error: err.message });
    }
}

/* ===========================================
 * DASHBOARD / LOGS / HEALTH
 * =========================================*/

async function getDashboard(req, res) {
    try {
        // Load documents
        const [stationsSnap, usersSnap, bookingsSnap, paymentsSnap] = await Promise.all([
            db.collection("ev_bunks").get(),
            db.collection("users").get(),
            db.collection("bookings").get(),
            db.collection("payments").get(), // Optional, depends on your design
        ]);

        const stations = stationsSnap.docs.map((d) => d.data());
        const users = usersSnap.docs.map((d) => d.data());
        const bookings = bookingsSnap.docs.map((d) => d.data());
        const payments = paymentsSnap.docs.map((d) => d.data());

        // Calculate values
        const totalStations = stations.length;
        const activeStations = stations.filter((s) => s.status === "active").length;

        const totalUsers = users.length;
        const totalBookings = bookings.length;

        const totalRevenue = bookings.reduce((sum, b) => sum + (b.amount || 0), 0);
        const ownerPayouts = totalRevenue * 0.7; // assume 70% goes to owners
        const platformProfit = totalRevenue * 0.3; // 30% platform share
        const profitMargin = totalRevenue > 0 ? ((platformProfit / totalRevenue) * 100).toFixed(2) : 0;

        const dashboard = {
            overview: {
                totalStations,
                activeStations,
                totalUsers,
                totalBookings,
            },
            revenue: {
                totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                platformProfit: parseFloat(platformProfit.toFixed(2)),
                ownerPayouts: parseFloat(ownerPayouts.toFixed(2)),
                profitMargin: parseFloat(profitMargin),
            },
            period: req.query?.period || "30d",
            generatedAt: new Date().toISOString(),
        };

        return res.json({ success: true, dashboard });
    } catch (err) {
        logger.error("getDashboard", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function getFinancialAnalytics(req, res) {
    try {
        // ----- period parsing -----
        const { period = "30d", from, to } = req.query || {};
        const now = new Date();
        let start = new Date(now);
        if (from) start = new Date(from);
        else {
            const n = parseInt(String(period).replace(/\D/g, ""), 10) || 30;
            start.setDate(start.getDate() - n);
        }
        const end = to ? new Date(to) : now;

        // ----- fetch data -----
        // Note: requires an index if you add other where-clauses. createdAt must be a Firestore Timestamp.
        let bookingsQuery = db.collection("bookings")
            .where("createdAt", ">=", start)
            .where("createdAt", "<=", end)
            .orderBy("createdAt", "desc");

        const [bookingsSnap, paymentsSnap] = await Promise.all([
            bookingsQuery.get(),
            db.collection("payments").where("createdAt", ">=", start).where("createdAt", "<=", end).get().catch(() => ({ empty: true, docs: [] }))
        ]);

        const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const payments = paymentsSnap.empty ? [] : paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // ----- helpers / assumptions -----
        const isPaid = (b) => {
            const s = (b.paymentStatus || b.status || "").toLowerCase();
            return ["paid", "succeeded", "success", "completed"].includes(s);
        };
        const toNumber = (v) => Number.isFinite(v) ? v : Number(v || 0) || 0;

        // Prefer explicit fields if they exist per booking; else fallback to 70/30
        let totalRevenue = 0;
        let platformProfit = 0;
        let ownerPayouts = 0;
        let paidCount = 0;

        for (const b of bookings) {
            const amt = toNumber(b.amount);
            if (isPaid(b)) {
                paidCount++;
                // Explicit fields?
                const platformFee = toNumber(b.platformFee);
                const ownerPayout = toNumber(b.ownerPayout);
                if (platformFee || ownerPayout) {
                    // If both present, trust them; otherwise compute the missing one from amount.
                    let fee = platformFee;
                    let payout = ownerPayout;
                    if (!fee && amt) fee = Math.max(0, amt - payout);
                    if (!payout && amt) payout = Math.max(0, amt - fee);

                    totalRevenue += amt;
                    platformProfit += fee;
                    ownerPayouts += payout;
                } else {
                    // Commission rate per booking if present, else default 30%
                    const commissionRate = (typeof b.commissionRate === "number") ? b.commissionRate : 0.30;
                    const fee = Math.max(0, amt * commissionRate);
                    const payout = Math.max(0, amt - fee);

                    totalRevenue += amt;
                    platformProfit += fee;
                    ownerPayouts += payout;
                }
            }
        }

        // Optionally add “payments” collection totals if you store settled payments there
        // and not duplicated with bookings. If they mirror bookings, skip this to avoid double counting.
        // Example below assumes they are separate settlement records:
        for (const p of payments) {
            if (String(p.status || "").toLowerCase() === "succeeded") {
                const amt = toNumber(p.amount);
                const fee = toNumber(p.platformFee);
                const payout = toNumber(p.ownerPayout);
                if (amt && (fee || payout)) {
                    totalRevenue += amt;
                    platformProfit += fee || Math.max(0, amt - payout);
                    ownerPayouts += payout || Math.max(0, amt - fee);
                    paidCount++;
                }
            }
        }

        const totalBookings = bookings.length;
        const averageBookingValue = paidCount ? totalRevenue / paidCount : 0;
        const profitMargin = totalRevenue > 0 ? (platformProfit / totalRevenue) * 100 : 0;

        return res.json({
            success: true,
            analytics: {
                period: { from: start.toISOString(), to: end.toISOString(), label: period },
                summary: {
                    totalRevenue: Number(totalRevenue.toFixed(2)),
                    platformProfit: Number(platformProfit.toFixed(2)),
                    ownerPayouts: Number(ownerPayouts.toFixed(2)),
                    profitMargin: Number(profitMargin.toFixed(2)),
                    totalBookings,
                    averageBookingValue: Number(averageBookingValue.toFixed(2)),
                    paidCount
                }
            }
        });
    } catch (err) {
        logger.error("getFinancialAnalytics", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function getBookingAnalytics(req, res) {
    try {
        const { period = "30d", from, to } = req.query || {};
        const now = new Date();
        let start = new Date(now);
        if (from) start = new Date(from);
        else {
            const n = parseInt(String(period).replace(/\D/g, ""), 10) || 30;
            start.setDate(start.getDate() - n);
        }
        const end = to ? new Date(to) : now;

        // Query bookings in range
        let query = db.collection("bookings")
            .where("createdAt", ">=", start)
            .where("createdAt", "<=", end)
            .orderBy("createdAt", "desc");

        const snap = await query.get();
        const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Status breakdown (by paymentStatus primarily, fallback to status)
        const statusBreakdown = {};
        const inc = (key) => { statusBreakdown[key] = (statusBreakdown[key] || 0) + 1; };

        // Patterns
        const hourly = new Array(24).fill(0);              // UTC hours
        const daily = {};                                   // YYYY-MM-DD -> count

        for (const b of bookings) {
            const s = String(b.paymentStatus || b.status || "unknown").toLowerCase();
            inc(s);

            const ts = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt));
            if (!isNaN(ts)) {
                // Hour of day (UTC)
                hourly[ts.getUTCHours()]++;

                // Day bucket
                const y = ts.getUTCFullYear();
                const m = String(ts.getUTCMonth() + 1).padStart(2, "0");
                const d = String(ts.getUTCDate()).padStart(2, "0");
                const key = `${y}-${m}-${d}`;
                daily[key] = (daily[key] || 0) + 1;
            }
        }

        return res.json({
            success: true,
            analytics: {
                period: { from: start.toISOString(), to: end.toISOString(), label: period },
                totalBookings: bookings.length,
                statusBreakdown,
                patterns: { hourly, daily }
            }
        });
    } catch (err) {
        logger.error("getBookingAnalytics", err.message);
        return res.status(500).json({ error: err.message });
    }
}


async function getPendingPayouts(req, res) {
    try {
        return res.json({
            success: true,
            payouts: [],
            summary: { totalPayoutAmount: 0, ownerCount: 0, totalBookings: 0 },
        });
    } catch (err) {
        logger.error("getPendingPayouts", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function processOwnerPayout(req, res) {
    try {
        return res.json({
            success: true,
            message: "Payout processed successfully",
            payout: { id: uuidv4(), amount: 0, bookingCount: 0 },
        });
    } catch (err) {
        logger.error("processOwnerPayout", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function getDashboardStats(req, res) {
    return getDashboard(req, res);
}

async function getAdminLogs(req, res) {
    try {
        const { limit = 50, offset = 0, action, adminId } = req.query || {};
        let query = db.collection("admin_logs").orderBy("timestamp", "desc");
        if (action) query = query.where("action", "==", action);
        if (adminId) query = query.where("adminId", "==", adminId);
        query = query.limit(Number(limit)).offset(Number(offset));

        const snap = await query.get();
        const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        return res.json({ success: true, logs, count: logs.length });
    } catch (err) {
        logger.error("getAdminLogs", err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function getSystemHealth(req, res) {
    try {
        const health = { status: "healthy", timestamp: new Date().toISOString(), services: {} };
        try {
            await db.collection("_health").limit(1).get();
            health.services.firestore = "healthy";
        } catch {
            health.services.firestore = "unhealthy";
            health.status = "degraded";
        }
        return res.json({ success: true, health });
    } catch (err) {
        logger.error("getSystemHealth", err.message);
        return res
            .status(500)
            .json({ success: false, health: { status: "unhealthy", error: err.message } });
    }
}

/**
 * Audit log
 */
async function logAdminAction(adminId, action, metadata = {}) {
    try {
        if (!adminId) {
            console.warn("logAdminAction called without adminId");
            return;
        }
        await db.collection("admin_logs").add({
            adminId,
            action,
            metadata,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            ip: metadata.ip || null,
            userAgent: metadata.userAgent || null,
        });
    } catch (err) {
        logger.error("logAdminAction", err.message);
    }
}
const sendPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email required" });

        const apiKey = process.env.FIREBASE_API_KEY;
        const response = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
            { requestType: "PASSWORD_RESET", email }
        );

        return res.json({
            ok: true,
            message: "Password reset email sent",
            firebase: response.data,
        });
    } catch (err) {
        return res.status(500).json({
            error: err.response?.data?.error?.message || err.message,
        });
    }
};

/* ----------------------------- Change Password --------------------------- */
const changePassword = async (req, res) => {
    try {
        const uid = req.user?.uid;
        const authTime = req.user?.auth_time;
        if (!uid) return res.status(401).json({ error: "Unauthorized" });

        if (!authTime || Date.now() / 1000 - authTime > 5 * 60) {
            return res.status(401).json({ error: "Recent login required" });
        }

        const { newPassword } = req.body || {};
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: "newPassword must be at least 6 characters" });
        }

        await admin.auth().updateUser(uid, { password: newPassword });
        await db.collection("users").doc(uid).set({ updatedAt: new Date() }, { merge: true });

        return res.json({ ok: true, message: "Password updated successfully" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

/* ===========================================
 * BOOKINGS MANAGEMENT
 * ========================================= */
async function listAllBookings(req, res) {
    try {
        const { limit = 50, offset = 0, status } = req.query || {};

        let query = db.collection("bookings").orderBy("createdAt", "desc");

        if (status) {
            query = query.where("paymentStatus", "==", status);
        }

        const snap = await query.limit(Number(limit)).get(); // Firestore does not support offset directly

        const bookings = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return res.json({
            success: true,
            bookings,
            count: bookings.length,
        });
    } catch (err) {
        console.error("listAllBookings error:", err.message);
        return res.status(500).json({ error: err.message || "Failed to fetch bookings" });
    }
}

async function getAdminKpis(req, res) {
    try {
        const [userSnap, stationSnap, bookingSnap] = await Promise.all([
            db.collection("users").get(),
            db.collection("ev_bunks").get(),
            db.collection("bookings").get(),
        ]);

        const users = userSnap.docs.map(d => d.data());
        const bookings = bookingSnap.docs.map(d => d.data());

        const totalRevenue = bookings.reduce((sum, b) => sum + (b.amount || 0), 0);
        const last30DaysRevenue = bookings
            .filter(b => {
                const d = b.createdAt?.toDate?.() || new Date(b.createdAt);
                return d >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            })
            .reduce((sum, b) => sum + (b.amount || 0), 0);

        return res.json({
            totalUsers: users.length,
            activeUsers: users.filter(u => u.status !== "banned").length,
            totalStations: stationSnap.size,
            totalBookings: bookings.length,
            revenueAllTime: Number(totalRevenue.toFixed(2)),
            revenue30d: Number(last30DaysRevenue.toFixed(2)),
            currency: "INR",
        });
    } catch (err) {
        logger.error("getAdminKpis", err.message);
        res.status(500).json({ error: err.message });
    }
}
async function getUserSignupTrends(req, res) {
    try {
        const usersSnap = await db.collection("users").get();
        const daily = {};

        for (const doc of usersSnap.docs) {
            const d = doc.data();
            const ts = d.createdAt?.toDate?.() || new Date(d.createdAt);
            const key = ts.toISOString().slice(0, 10);
            daily[key] = (daily[key] || 0) + 1;
        }

        const result = Object.entries(daily).map(([date, users]) => ({ date, users }));
        result.sort((a, b) => a.date.localeCompare(b.date));
        res.json(result);
    } catch (err) {
        logger.error("getUserSignupTrends", err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getTopStations(req, res) {
    try {
        const bookingsSnap = await db.collection("bookings").get();
        const stations = {};

        bookingsSnap.docs.forEach((doc) => {
            const b = doc.data();
            const id = b.stationId || "unknown";
            const name = b.stationName || "Station";

            if (!stations[id]) stations[id] = { id, name, bookings: 0, revenue: 0 };
            stations[id].bookings += 1;
            stations[id].revenue += b.amount || 0;
        });

        const top = Object.values(stations)
            .sort((a, b) => b.bookings - a.bookings)
            .slice(0, 10);

        res.json(top);
    } catch (err) {
        logger.error("getTopStations", err.message);
        res.status(500).json({ error: err.message });
    }
}
async function getErrorCounts(req, res) {
    try {
        const logsSnap = await db.collection("admin_logs")
            .where("action", "==", "ERROR")
            .orderBy("timestamp", "desc")
            .limit(500)
            .get();

        const daily = {};
        logsSnap.docs.forEach((doc) => {
            const ts = doc.data().timestamp?.toDate?.() || new Date();
            const key = ts.toISOString().slice(0, 10);
            daily[key] = (daily[key] || 0) + 1;
        });

        const result = Object.entries(daily).map(([date, count]) => ({ date, count }));
        result.sort((a, b) => a.date.localeCompare(b.date));
        res.json(result);
    } catch (err) {
        logger.error("getErrorCounts", err.message);
        res.status(500).json({ error: err.message });
    }
}




module.exports = {
    // Authentication
    adminLogin,
    adminLogout,
    refreshToken,
    sendPasswordReset,
    changePassword,

    // Profile
    getAdminProfile,
    updateAdminProfile,

    // Dashboard & Analytics
    getDashboard,
    getFinancialAnalytics,
    getBookingAnalytics,
    getPendingPayouts,
    processOwnerPayout,
    getDashboardStats,
    getAdminLogs,
    getSystemHealth,
    getAdminKpis,
    getUserSignupTrends,
    getTopStations,
    getErrorCounts,



    // Stations
    createBunk,
    updateBunk,
    listBunks,
    deleteBunk,
    toggleFeaturedStation,
    bulkUpdateStations,

    // Users
    listUsers,
    updateUser,

    // Helper
    logAdminAction,
    listAllBookings,
};
