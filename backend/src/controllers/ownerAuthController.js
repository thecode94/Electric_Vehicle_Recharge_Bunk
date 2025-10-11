// src/controllers/ownerAuthController.js
"use strict";

const adminConfig = require("../config/firebase");
const admin = adminConfig.admin || adminConfig;
const db = adminConfig.db || (admin.firestore && admin.firestore());
const axios = require("axios");

const isProd = process.env.NODE_ENV === "production";
const exposeTokens = String(process.env.EXPOSE_TOKENS || "").toLowerCase() === "true";
const apiKey = process.env.FIREBASE_API_KEY;

const cookieBase = { httpOnly: true, secure: isProd, sameSite: "lax", path: "/" };
const cookieOpts = (maxAgeMs) => ({ ...cookieBase, maxAge: maxAgeMs });
const clearCookieOpts = () => ({ ...cookieBase });

const normEmail = (e) => (e || "").trim().toLowerCase();

const ownersCol = db.collection("owners");
const usersCol = db.collection("users");

const getIP = (req) =>
    (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "")
        .toString()
        .split(",")[0]
        .trim();

async function upsertUsersDocForOwner(uid, { email, displayName, phone, photoURL }, extra = {}) {
    const now = new Date();
    const ref = usersCol.doc(uid);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() : null;

    const base = {
        uid,
        email: email ?? existing?.email ?? null,
        name: displayName ?? existing?.name ?? null,
        phone: phone ?? existing?.phone ?? null,
        photoURL: photoURL ?? existing?.photoURL ?? null,
        address: existing?.address ?? null,
        role: existing?.role || "owner",
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        ...extra,
    };

    await ref.set(base, { merge: true });
    return (await ref.get()).data();
}

/* REGISTER */
async function register(req, res) {
    try {
        let { email, password, displayName, phone } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
        email = normEmail(email);

        const { FieldValue } = admin.firestore;

        // Check if user exists
        let existingUser = null;
        try {
            existingUser = await admin.auth().getUserByEmail(email);
        } catch { }
        if (!existingUser && phone) {
            try {
                existingUser = await admin.auth().getUserByPhoneNumber(phone);
            } catch { }
        }

        if (existingUser) {
            const uid = existingUser.uid;
            await admin.auth().setCustomUserClaims(uid, { owner: true, role: "owner" });

            const ownerRef = ownersCol.doc(uid);
            const prevSnap = await ownerRef.get();
            const prev = prevSnap.exists ? prevSnap.data() : {};

            const ownerDoc = {
                uid,
                email: existingUser.email || email,
                displayName: existingUser.displayName || displayName || "",
                phone: existingUser.phoneNumber || phone || null,
                role: "owner",
                verified: !!prev.verified,
                createdAt: prev.createdAt || FieldValue.serverTimestamp(),
                totals: prev.totals || {
                    totalIncome: 0,
                    totalExpense: 0,
                    balance: 0,
                    updatedAt: FieldValue.serverTimestamp(),
                },
            };

            await ownerRef.set(ownerDoc, { merge: true });

            await upsertUsersDocForOwner(uid, {
                email: ownerDoc.email,
                displayName: ownerDoc.displayName,
                phone: ownerDoc.phone,
                photoURL: existingUser.photoURL || null,
            });

            return res.status(200).json({ uid, email: ownerDoc.email, message: "Existing user converted to owner" });
        }

        // New user
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: displayName || undefined,
            phoneNumber: phone || undefined,
            emailVerified: false,
        });

        const uid = userRecord.uid;
        await admin.auth().setCustomUserClaims(uid, { owner: true, role: "owner" });

        const ownerDoc = {
            uid,
            email: userRecord.email,
            displayName: userRecord.displayName || displayName || "",
            phone: phone || null,
            role: "owner",
            verified: false,
            createdAt: FieldValue.serverTimestamp(),
            totals: {
                totalIncome: 0,
                totalExpense: 0,
                balance: 0,
                updatedAt: FieldValue.serverTimestamp(),
            },
        };

        await ownersCol.doc(uid).set(ownerDoc);

        await upsertUsersDocForOwner(uid, {
            email: ownerDoc.email,
            displayName: ownerDoc.displayName,
            phone: ownerDoc.phone,
            photoURL: userRecord.photoURL || null,
        });

        return res.status(201).json({ uid, email: userRecord.email });
    } catch (err) {
        if (err?.code?.startsWith("auth/")) {
            return res.status(409).json({ error: err.message, code: err.code });
        }
        return res.status(500).json({ error: err.message || "Registration failed" });
    }
}

/* LOGIN */
async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
        const { data } = await axios.post(url, {
            email: normEmail(email),
            password,
            returnSecureToken: true,
        });

        const { idToken, refreshToken, localId: uid } = data;

        // Set secure session cookie
        const sessionMs = 14 * 24 * 60 * 60 * 1000; // 14 days
        const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn: sessionMs });
        res.cookie("ev_session", sessionCookie, cookieOpts(sessionMs));

        // Verify owner exists — block non-owners from using owner login
        const ownerRef = ownersCol.doc(uid);
        const ownerSnap = await ownerRef.get();
        const userRecord = await admin.auth().getUser(uid);
        if (!ownerSnap.exists) {
            return res.status(403).json({ error: "Owner account not found" });
        }

        // Sync users/{uid} with owner role + login metadata
        const ownerDoc = ownerSnap.data() || {};
        const synced = await upsertUsersDocForOwner(
            uid,
            {
                email: ownerDoc.email || userRecord.email,
                displayName: ownerDoc.displayName || userRecord.displayName,
                phone: ownerDoc.phone || userRecord.phoneNumber,
                photoURL: userRecord.photoURL || null,
            },
            {
                lastLoginAt: new Date(),
                lastLoginIp: getIP(req),
                lastLoginUserAgent: String(req.headers["user-agent"] || ""),
            }
        );

        if (exposeTokens) {
            res.cookie("ev_token", idToken, cookieOpts(55 * 60 * 1000));
            res.cookie("ev_refresh", refreshToken, cookieOpts(sessionMs));
            return res.json({ uid, idToken, refreshToken, owner: ownerDoc, profile: synced });
        }

        return res.json({ uid, owner: ownerDoc, profile: synced });
    } catch (err) {
        return res.status(401).json({
            error: err.response?.data?.error?.message || err.message || "Login failed",
        });
    }
}

/* LOGOUT */
async function logout(req, res) {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ error: "unauthenticated" });

        await admin.auth().revokeRefreshTokens(uid);
        res.clearCookie("ev_session", clearCookieOpts());
        res.clearCookie("ev_token", clearCookieOpts());
        res.clearCookie("ev_refresh", clearCookieOpts());

        return res.json({ message: "User logged out (session revoked)" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

/* ME */
async function me(req, res) {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ error: "unauthenticated" });

        const snap = await ownersCol.doc(uid).get();
        if (!snap.exists) return res.status(404).json({ error: "Owner profile not found" });

        return res.json(snap.data());
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

/* UPDATE PROFILE */
async function updateProfile(req, res) {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ error: "unauthenticated" });

        const updates = {};
        const allowed = ["displayName", "phone", "settings"];
        for (const key of allowed) if (key in req.body) updates[key] = req.body[key];

        if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to update" });

        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        await ownersCol.doc(uid).update(updates);

        // Mirror to Auth & users/{uid} best‑effort
        const authUpdates = {};
        if ("displayName" in updates) authUpdates.displayName = updates.displayName || "";
        if ("phone" in updates && updates.phone) authUpdates.phoneNumber = updates.phone;

        const userRecord = await admin.auth().getUser(uid).catch(() => null);
        if (Object.keys(authUpdates).length) {
            try {
                await admin.auth().updateUser(uid, authUpdates);
            } catch { }
        }

        await upsertUsersDocForOwner(uid, {
            email: userRecord?.email || undefined,
            displayName: updates.displayName ?? userRecord?.displayName,
            phone: updates.phone ?? userRecord?.phoneNumber,
            photoURL: userRecord?.photoURL,
        });

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

/* PROFILE (combined) */
async function profile(req, res) {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ error: "unauthenticated" });

        const userRecord = await admin.auth().getUser(uid);
        const ownerSnap = await ownersCol.doc(uid).get();

        return res.json({
            uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            phone: userRecord.phoneNumber,
            role: userRecord.customClaims?.role || null,
            ownerDoc: ownerSnap.exists ? ownerSnap.data() : null,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
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

module.exports = {
    register,
    login,
    logout,
    me,
    updateProfile,
    profile,
    sendPasswordReset,
};
