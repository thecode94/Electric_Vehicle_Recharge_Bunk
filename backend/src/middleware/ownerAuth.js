// backend/src/middleware/ownerAuth.js
const { admin, db } = require('../config/firebase');

/**
 * Owner-specific authentication middleware
 * Verifies user has owner role and permissions
 */
module.exports = async function ownerAuth(req, res, next) {
    try {
        // Skip preflight requests
        if (req.method === 'OPTIONS') {
            return next();
        }

        console.log('🔍 Owner Auth - Checking credentials...');

        const cookies = req.cookies || {};
        const sessionCookie = cookies.ev_session;
        let decoded;

        // Try session cookie first, then Bearer token
        if (sessionCookie) {
            console.log('🍪 Verifying session cookie...');
            decoded = await admin.auth().verifySessionCookie(sessionCookie, true);
        } else {
            const authHeader = req.headers.authorization || '';
            const match = authHeader.match(/^Bearer (.+)$/);
            const idToken = match ? match[1] : null;

            if (!idToken) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    message: 'No authentication token provided'
                });
            }

            console.log('🔑 Verifying ID token...');
            decoded = await admin.auth().verifyIdToken(idToken, true);
        }

        if (!decoded || !decoded.uid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        console.log('✅ Token verified for:', decoded.email);

        // Check owner permissions (multiple sources)
        const isOwner =
            decoded.owner === true ||
            decoded.role === 'owner' ||
            (decoded.customClaims && decoded.customClaims.role === 'owner');

        // If not found in token claims, check Firestore
        if (!isOwner) {
            console.log('🔍 Checking owner status in Firestore...');
            const ownerDoc = await db.collection('owners').doc(decoded.uid).get();
            const userData = await db.collection('users').doc(decoded.uid).get();

            const isOwnerInDb =
                (ownerDoc.exists && ownerDoc.data()?.role === 'owner') ||
                (userData.exists && userData.data()?.role === 'owner');

            if (!isOwnerInDb) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    message: 'Owner role required for this action'
                });
            }
        }

        // Set user data in request
        req.user = {
            uid: decoded.uid,
            email: decoded.email || null,
            role: 'owner',
            claims: decoded.customClaims || decoded,
            isOwner: true
        };

        console.log('✅ Owner authenticated:', decoded.email);
        return next();

    } catch (error) {
        console.error('❌ Owner auth failed:', error.message);

        // Handle specific Firebase errors
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                message: 'Please login again'
            });
        }

        return res.status(401).json({
            success: false,
            error: 'Authentication failed',
            message: error?.message || 'Invalid or expired token'
        });
    }
};
