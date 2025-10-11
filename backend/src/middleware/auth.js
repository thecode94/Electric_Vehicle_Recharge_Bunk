"use strict";

const jwt = require("jsonwebtoken");
const { admin } = require("../config/firebase");

/**
 * Extract any token we might accept:
 * - Firebase session cookie: ev_session
 * - Bearer header: Authorization: Bearer <token>
 * - Admin header: x-admin-token
 * - Owner header: x-owner-token (optional, treated as bearer/fb token)
 */
function extractToken(req) {
  const sessionCookie = req.cookies?.ev_session;
  if (sessionCookie) return { type: "session", token: sessionCookie, source: "cookie" };

  const adminHeader = req.headers["x-admin-token"];
  if (adminHeader) return { type: "admin-jwt", token: String(adminHeader), source: "x-admin-token" };

  const ownerHeader = req.headers["x-owner-token"];
  if (ownerHeader) return { type: "bearer", token: String(ownerHeader), source: "x-owner-token" };

  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return { type: "bearer", token: auth.slice(7), source: "authorization" };

  return null;
}

const isJwtFormat = (t) => typeof t === "string" && t.split(".").length === 3;

/**
 * Verify Firebase tokens
 * - Session cookie (verifySessionCookie)
 * - ID token (verifyIdToken)
 */
async function verifyFirebaseToken(kind, token) {
  if (kind === "session") {
    // checkRevoked=true for security; set to false if you prefer
    return admin.auth().verifySessionCookie(token, true);
  }
  // bearer → Firebase ID token path
  return admin.auth().verifyIdToken(token, true);
}

/**
 * Convert Firebase decoded token → unified req.user
 */
function userFromFirebase(decoded) {
  const isAdmin =
    decoded.admin === true ||
    decoded.role === "admin" ||
    decoded?.claims?.admin === true ||
    decoded?.customClaims?.admin === true;

  const isOwner =
    decoded.owner === true ||
    decoded.role === "owner" ||
    decoded?.claims?.owner === true ||
    decoded?.customClaims?.owner === true;

  const role = isAdmin ? "admin" : (isOwner ? "owner" : (decoded.role || "user"));

  return {
    uid: decoded.uid,
    email: decoded.email || null,
    role,
    isAdmin,
    isOwner,
    emailVerified: decoded.email_verified ?? true,
    claims: decoded,
    profile: decoded.profile || { email: decoded.email || null, role },
  };
}

/**
 * Convert Admin JWT payload → unified req.user
 * (adminLogin issues tokens with payload: { adminId, email, role, permissions })
 */
function userFromAdminJwt(payload) {
  return {
    uid: payload.adminId,           // use adminId as uid in the request context
    email: payload.email || null,
    role: payload.role || "admin",
    isAdmin: true,
    isOwner: false,
    emailVerified: true,
    claims: payload,
    profile: { email: payload.email || null, role: payload.role || "admin" },
  };
}

/**
 * Main auth middleware:
 * 1) Try Firebase session/ID token
 * 2) If that fails and looks like an Admin JWT, try JWT_SECRET
 */
async function authMiddleware(req, res, next) {
  try {
    const extracted = extractToken(req);
    if (!extracted) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        message: "No authentication token provided",
      });
    }

    const { type, token, source } = extracted;

    // Development hook: allow explicit demo header
    if (process.env.NODE_ENV === "development" && token === "demo_admin_token") {
      req.user = {
        uid: "demo-admin",
        email: "admin@example.com",
        role: "admin",
        isAdmin: true,
        isOwner: false,
        emailVerified: true,
        claims: { dev: true },
        profile: { email: "admin@example.com", role: "admin" },
      };
      return next();
    }

    // First: try Firebase verification (session cookie or bearer idToken)
    try {
      if (type === "session" || type === "bearer") {
        // must be JWT-ish for Firebase idToken; session cookie not necessarily dot format
        if (type === "bearer" && !isJwtFormat(token)) {
          // malformed Authorization bearer (not a JWT) – skip to admin JWT path
          throw new Error("Malformed bearer token");
        }
        const decoded = await verifyFirebaseToken(type, token);
        req.user = userFromFirebase(decoded);
        return next();
      }
    } catch (fbErr) {
      // If header was x-admin-token or Authorization bearer and it's NOT a valid Firebase token,
      // try Admin JWT next (only if JWT_SECRET set).
      // We only proceed to JWT if the token is JWT-like to avoid confusing random strings.
      if (!isJwtFormat(token) || !process.env.JWT_SECRET) {
        return res.status(401).json({
          success: false,
          error: "Invalid authentication",
          message: fbErr?.message || "Session expired or invalid",
        });
      }
      // Continue into admin JWT verification below…
    }

    // Second: Admin JWT (from x-admin-token or Authorization bearer)
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      // Accept only if payload has adminId (as issued by adminLogin)
      if (!payload || !payload.adminId) {
        return res.status(401).json({
          success: false,
          error: "Invalid authentication",
          message: "Token is not an admin token",
        });
      }
      req.user = userFromAdminJwt(payload);
      return next();
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        error: "Invalid authentication",
        message: jwtErr?.message || "Invalid or expired token",
      });
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Authentication failed",
      message: "Invalid or expired token",
      ...(process.env.NODE_ENV === "development" && { details: error.message }),
    });
  }
}

/* --------------------------- Role guards -------------------------------- */

function requireRole(role) {
  const required = String(role || "").toLowerCase();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    if (req.user.isAdmin) return next(); // admins bypass specific role checks
    if ((req.user.role || "").toLowerCase() !== required) {
      return res.status(403).json({
        success: false,
        error: `${required} role required`,
        userRole: req.user.role,
      });
    }
    next();
  };
}

function requireOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  if (req.user.isAdmin || req.user.isOwner) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: "Station owner access required",
    userRole: req.user.role,
  });
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  if (req.user.isAdmin) return next();
  return res.status(403).json({
    success: false,
    error: "Admin access required",
    userRole: req.user.role,
  });
}

/**
 * optionalAuth: if there’s no token, continue as unauthenticated.
 * If a token is present, we fully verify (same as authMiddleware).
 */
async function optionalAuth(req, res, next) {
  const extracted = extractToken(req);
  if (!extracted) {
    req.user = null;
    return next();
  }
  return authMiddleware(req, res, next);
}

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
module.exports.requireOwner = requireOwner;
module.exports.requireAdmin = requireAdmin;
module.exports.optionalAuth = optionalAuth;
