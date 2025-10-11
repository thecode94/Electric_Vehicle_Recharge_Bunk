"use strict";

const axios = require("axios");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { admin, db } = require("../config/firebase");

const isProd = process.env.NODE_ENV === "production";

const getClientIp = (req) =>
  (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "")
    .toString()
    .split(",")[0]
    .trim();

/* -------------------------------------------------------------------------- */
/*                                  REGISTER                                  */
/* -------------------------------------------------------------------------- */
/* Creates Firebase Auth user + users/{uid} with role 'user' by default */
const register = async (req, res) => {
  try {
    const {
      email,
      password,
      name = null,
      phone = null,
      address = null,
      role = "user",
    } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name || undefined,
      phoneNumber: phone || undefined,
    });

    const uid = userRecord.uid;
    const now = new Date();

    const profile = {
      uid,
      email,
      name: name || userRecord.displayName || null,
      phone: phone || userRecord.phoneNumber || null,
      address: address || null,
      photoURL: userRecord.photoURL || null,
      role: role || "user",
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("users").doc(uid).set(profile, { merge: true });
    return res.json({ ok: true, uid, user: profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

/** Sign in with email+password against Firebase IdentityToolkit via axios */
async function passwordLogin(email, password) {
  const key = process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY;
  if (!key) throw new Error("Missing Firebase web API key");

  const { data } = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`,
    { email, password, returnSecureToken: true },
    { headers: { "Content-Type": "application/json" } }
  );

  // data contains { idToken, refreshToken, localId, email, ... }
  return data;
}

async function setSessionCookie(res, idToken) {
  const expiresIn = 1000 * 60 * 60 * 24 * 5; // 5 days
  const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
  res.cookie("ev_session", sessionCookie, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  });
  return expiresIn;
}

async function touchUserLoginMeta(req, uid, emailFallback) {
  const usersRef = db.collection("users").doc(uid);
  const [userSnap, userRecord] = await Promise.all([
    usersRef.get(),
    admin.auth().getUser(uid),
  ]);

  const now = new Date();
  const baseProfile = {
    uid,
    email: userRecord.email || emailFallback,
    name: userRecord.displayName || null,
    phone: userRecord.phoneNumber || null,
    photoURL: userRecord.photoURL || null,
    address: null,
    role: "user",
    createdAt: now,
  };
  const loginMeta = {
    lastLoginAt: now,
    lastLoginIp: getClientIp(req),
    lastLoginUserAgent: (req.headers["user-agent"] || "").toString(),
    updatedAt: now,
  };

  if (!userSnap.exists) {
    await usersRef.set({ ...baseProfile, ...loginMeta }, { merge: true });
  } else {
    await usersRef.set(loginMeta, { merge: true });
  }
  const finalSnap = await usersRef.get();
  return finalSnap.data() || null;
}

/* -------------------------------------------------------------------------- */
/*                                  USER LOGIN                                */
/* -------------------------------------------------------------------------- */
/* Only allows accounts that are not owners/admins. Writes users/{uid}. */
const userLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    const { idToken, localId: uid } = await passwordLogin(email, password);
    await setSessionCookie(res, idToken);

    // role validation
    const [ownerDoc] = await Promise.all([
      db.collection("owners").doc(uid).get(),
    ]);

    if (ownerDoc.exists) {
      return res
        .status(403)
        .json({ error: "This account is registered as an owner" });
    }

    // Optional: check admin custom claim
    const tokenInfo = await admin.auth().verifyIdToken(idToken, true).catch(() => null);
    if (tokenInfo?.admin === true) {
      return res
        .status(403)
        .json({ error: "This account is registered as an admin" });
    }

    const profile = await touchUserLoginMeta(req, uid, email);

    return res.json({
      ok: true,
      uid,
      role: "user",
      isOwner: false,
      isAdmin: false,
      profile,
    });
  } catch (err) {
    const code = /auth\/|Authentication failed/i.test(err.message) ? 401 : 500;
    return res.status(code).json({ error: err.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                                 OWNER LOGIN                                */
/* -------------------------------------------------------------------------- */
/* Only allows owners; requires owners/{uid} doc (or custom claim). */
const ownerLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    const { idToken, localId: uid } = await passwordLogin(email, password);
    await setSessionCookie(res, idToken);

    // Verify owner
    const [ownerDoc, userDoc] = await Promise.all([
      db.collection("owners").doc(uid).get(),
      db.collection("users").doc(uid).get(),
    ]);

    if (!ownerDoc.exists) {
      return res.status(403).json({ error: "Owner account not found" });
    }

    // Optionally update shared metadata in users/{uid}
    if (userDoc.exists) {
      await db.collection("users").doc(uid).set(
        {
          lastLoginAt: new Date(),
          lastLoginIp: getClientIp(req),
          lastLoginUserAgent: (req.headers["user-agent"] || "").toString(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }

    return res.json({
      ok: true,
      uid,
      role: "owner",
      isOwner: true,
      isAdmin: false,
      owner: ownerDoc.data() || null,
    });
  } catch (err) {
    const code = /auth\/|Authentication failed/i.test(err.message) ? 401 : 500;
    return res.status(code).json({ error: err.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                                 ADMIN LOGIN                                */
/* -------------------------------------------------------------------------- */
/** Admin Login (instrumented) */
async function adminLogin(req, res) {
  const startedAt = Date.now();
  try {
    const { email, password, rememberMe = false } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 1) Find active admin by email
    console.log("[adminLogin] step=fetch-admin email=", normalizedEmail);
    const snap = await db
      .collection("admins")
      .where("email", "==", normalizedEmail)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn("[adminLogin] no-admin-found email=", normalizedEmail);
      return res.status(401).json({ error: "INVALID_LOGIN_CREDENTIALS" });
    }

    const adminDoc = snap.docs[0];
    const adminData = adminDoc.data() || {};
    const hash = adminData.password;

    if (!hash || typeof hash !== "string") {
      console.error("[adminLogin] missing-or-bad-hash adminId=", adminDoc.id);
      return res.status(500).json({ error: "Login failed (config)" });
    }

    // 2) Verify password
    console.log("[adminLogin] step=compare-password hashPrefix=", hash.slice(0, 7));
    const ok = await bcrypt.compare(password, hash);
    if (!ok) {
      console.warn("[adminLogin] bad-password adminId=", adminDoc.id);
      return res.status(401).json({ error: "INVALID_LOGIN_CREDENTIALS" });
    }

    // 3) Build tokens
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error("[adminLogin] missing JWT secrets in env");
      return res.status(500).json({ error: "Login failed (env)" });
    }

    const tokenPayload = {
      adminId: adminDoc.id,
      email: adminData.email,
      role: adminData.role || "admin",
      permissions: adminData.permissions || [],
      // Including a light profile helps downstream UIs
      profile: {
        name: adminData.name || null,
        email: adminData.email || null,
        phone: adminData.phone || null,
        createdAt: adminData.createdAt || null,
      },
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: rememberMe ? "30d" : "24h",
    });

    const refreshToken = jwt.sign(
      { adminId: adminDoc.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "90d" }
    );

    // 4) Update login metadata
    await db.collection("admins").doc(adminDoc.id).set(
      {
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        refreshToken,
        loginCount: admin.firestore.FieldValue.increment(1),
      },
      { merge: true }
    );

    // 5) Respond
    const { password: _pw, refreshToken: _rt, ...safe } = adminData;
    console.log("[adminLogin] success adminId=", adminDoc.id, "ttfbMs=", Date.now() - startedAt);

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
    console.error("[adminLogin] fatal", err?.message, err);
    return res.status(500).json({ error: "Login failed" });
  }
}

/* -------------------------------------------------------------------------- */
/*                                   LOGOUT                                   */
/* -------------------------------------------------------------------------- */
const logout = async (req, res) => {
  try {
    res.clearCookie("ev_session", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
    });
    return res.json({ ok: true, message: "Logged out" });
  } catch {
    return res.status(200).json({ ok: true, message: "Logged out" });
  }
};

/* -------------------------------------------------------------------------- */
/*                           SEND PASSWORD RESET                              */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/*                              CHANGE PASSWORD                               */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/*                               UPDATE PROFILE                               */
/* -------------------------------------------------------------------------- */
const updateProfile = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const allowed = ["name", "phone", "address", "photoURL"];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "no fields to update" });
    }

    const authPatch = {};
    if (updates.name) authPatch.displayName = updates.name;
    if (updates.phone) authPatch.phoneNumber = updates.phone;
    if (updates.photoURL) authPatch.photoURL = updates.photoURL;
    if (Object.keys(authPatch).length) {
      try {
        await admin.auth().updateUser(uid, authPatch);
      } catch { }
    }

    updates.updatedAt = new Date();
    await db.collection("users").doc(uid).set(updates, { merge: true });

    const snap = await db.collection("users").doc(uid).get();
    return res.json({ ok: true, user: snap.data() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                              DELETE ACCOUNT                                */
/* -------------------------------------------------------------------------- */
const deleteAccount = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    await admin.auth().revokeRefreshTokens(uid).catch(() => { });
    await admin.auth().deleteUser(uid).catch(() => { });
    await db.collection("users").doc(uid).delete().catch(() => { });
    const snap = await db.collection("bookings").where("userId", "==", uid).get();
    const batch = db.batch();
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit().catch(() => { });

    res.clearCookie("ev_session", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
    });

    return res.json({ ok: true, message: "account deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                                     ME                                    */
/* -------------------------------------------------------------------------- */
const me = async (req, res) => {
  try {
    return res.json({
      ok: true,
      uid: req.user?.uid,
      email: req.user?.email,
      claims: req.user?.claims || {},
      profile: req.user?.profile || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   ADMIN ME                                 */
/* -------------------------------------------------------------------------- */
/**
 * Rich admin "me" endpoint used by the Admin UI.
 * Requires authMiddleware to have decoded an admin JWT (x-admin-token or Bearer).
 */
const adminMe = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const adminId = req.user.uid || req.user.claims?.adminId || null;
    let adminDocData = null;

    if (adminId) {
      const snap = await db.collection("admins").doc(adminId).get();
      adminDocData = snap.exists ? snap.data() : null;
    }

    const profile = {
      name: adminDocData?.name || req.user?.profile?.name || "Admin",
      email: req.user?.email || adminDocData?.email || null,
      phone: adminDocData?.phone || null,
      status: adminDocData?.status || "active",
      createdAt: adminDocData?.createdAt || null,
      lastLogin: adminDocData?.lastLogin || null,
    };

    return res.json({
      ok: true,
      uid: adminId,
      email: profile.email,
      role: "admin",
      isAdmin: true,
      profile,
    });
  } catch (err) {
    console.error("[admin/me] error:", err?.message);
    return res.status(500).json({ error: "Failed to fetch admin profile" });
  }
};

module.exports = {
  register,
  // old serverLogin kept for compatibility; use userLogin/ownerLogin/adminLogin
  serverLogin: userLogin,
  userLogin,
  ownerLogin,
  adminLogin,
  logout,
  sendPasswordReset,
  changePassword,
  updateProfile,
  deleteAccount,
  me,
  adminMe, // <-- export the new rich admin endpoint
};
