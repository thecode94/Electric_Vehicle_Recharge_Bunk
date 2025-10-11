// backend/src/middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');

/**
 * Admin Authentication Middleware
 * Verifies admin JWT tokens and sets req.admin
 */
async function adminAuth(req, res, next) {
    try {
        let token = null;

        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        // Fallback: Get token from X-Admin-Token header
        if (!token) {
            token = req.headers['x-admin-token'];
        }

        // Fallback: Get token from cookies
        if (!token && req.cookies) {
            token = req.cookies.adminToken || req.cookies.admin_token;
        }

        if (!token) {
            return res.status(401).json({
                error: 'Access denied. No admin token provided.'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.adminId) {
            return res.status(401).json({
                error: 'Invalid admin token format.'
            });
        }

        // Get admin details from database
        const adminDoc = await db.collection('admins').doc(decoded.adminId).get();

        if (!adminDoc.exists) {
            return res.status(401).json({
                error: 'Admin account not found.'
            });
        }

        const adminData = adminDoc.data();

        // Check if admin is active
        if (adminData.status !== 'active') {
            return res.status(403).json({
                error: 'Admin account is not active.'
            });
        }

        // Check token expiration
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            return res.status(401).json({
                error: 'Admin token has expired.'
            });
        }

        // Set admin info in request
        req.admin = {
            id: adminDoc.id,
            email: adminData.email,
            role: adminData.role,
            name: adminData.name,
            permissions: adminData.permissions || [],
            ...decoded
        };

        next();

    } catch (error) {
        console.error('Admin auth error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid admin token.'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Admin token expired.'
            });
        }

        return res.status(500).json({
            error: 'Admin authentication failed.'
        });
    }
}

/**
 * Check specific admin permissions
 */
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({
                error: 'Admin authentication required.'
            });
        }

        const hasPermission = req.admin.permissions.includes(permission) ||
            req.admin.role === 'super_admin';

        if (!hasPermission) {
            return res.status(403).json({
                error: `Permission '${permission}' required.`
            });
        }

        next();
    };
}

/**
 * Super Admin only middleware
 */
function superAdminOnly(req, res, next) {
    if (!req.admin || req.admin.role !== 'super_admin') {
        return res.status(403).json({
            error: 'Super admin access required.'
        });
    }
    next();
}

module.exports = adminAuth;
module.exports.requirePermission = requirePermission;
module.exports.superAdminOnly = superAdminOnly;
