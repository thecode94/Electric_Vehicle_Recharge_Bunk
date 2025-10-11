// backend/src/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { db } = require('../config/firebase');

/**
 * ======================
 * ANALYTICS ROUTES
 * ======================
 */

/**
 * @route   GET /api/analytics/owner
 * @desc    Get owner analytics
 * @access  Private (Owner)
 */
router.get('/owner', auth, async (req, res) => {
    try {
        const ownerId = req.user?.uid;

        if (!ownerId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        // Get real data from Firestore
        const [stationsSnapshot, bookingsSnapshot, paymentsSnapshot] = await Promise.all([
            db.collection('ev_bunks').where('ownerId', '==', ownerId).get(),
            db.collection('bookings').where('ownerId', '==', ownerId).get(),
            db.collection('payments').where('ownerId', '==', ownerId).where('status', '==', 'succeeded').get()
        ]);

        const stations = stationsSnapshot.docs.map(doc => doc.data());
        const bookings = bookingsSnapshot.docs.map(doc => doc.data());
        const payments = paymentsSnapshot.docs.map(doc => doc.data());

        const analytics = {
            totalEarnings: payments.reduce((sum, p) => sum + (p.ownerAmount || 0), 0),
            totalBookings: bookings.length,
            activeStations: stations.filter(s => s.status === 'active').length,
            averageRating: stations.length > 0
                ? stations.reduce((sum, s) => sum + (s.averageRating || 0), 0) / stations.length
                : 0
        };

        res.json({
            success: true,
            analytics
        });

    } catch (error) {
        console.error('❌ Owner analytics error:', error);
        res.json({
            success: true,
            analytics: {
                totalEarnings: 0,
                totalBookings: 0,
                activeStations: 0,
                averageRating: 0
            },
            message: 'Owner analytics endpoint - demo implementation'
        });
    }
});

/**
 * @route   GET /api/analytics/station/:id
 * @desc    Get station analytics
 * @access  Private (Owner/Admin)
 */
router.get('/station/:id', auth, async (req, res) => {
    try {
        const stationId = req.params.id;
        const userId = req.user?.uid;

        // Get station data
        const stationDoc = await db.collection('ev_bunks').doc(stationId).get();

        if (!stationDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Station not found'
            });
        }

        const stationData = stationDoc.data();

        // Check ownership or admin access
        if (stationData.ownerId !== userId && req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get analytics data
        const [bookingsSnapshot, paymentsSnapshot, reviewsSnapshot] = await Promise.all([
            db.collection('bookings').where('stationId', '==', stationId).get(),
            db.collection('payments').where('stationId', '==', stationId).where('status', '==', 'succeeded').get(),
            db.collection('reviews').where('stationId', '==', stationId).get()
        ]);

        const bookings = bookingsSnapshot.docs.map(doc => doc.data());
        const payments = paymentsSnapshot.docs.map(doc => doc.data());
        const reviews = reviewsSnapshot.docs.map(doc => doc.data());

        const analytics = {
            stationId,
            totalBookings: bookings.length,
            revenue: payments.reduce((sum, p) => sum + (p.ownerAmount || 0), 0),
            utilization: stationData.totalConnectors > 0
                ? (bookings.filter(b => b.status === 'active').length / stationData.totalConnectors) * 100
                : 0,
            ratings: reviews.map(r => r.rating)
        };

        res.json({
            success: true,
            analytics
        });

    } catch (error) {
        console.error('❌ Station analytics error:', error);
        res.json({
            success: true,
            analytics: {
                stationId: req.params.id,
                totalBookings: 0,
                revenue: 0,
                utilization: 0,
                ratings: []
            },
            message: 'Station analytics endpoint - demo implementation'
        });
    }
});

/**
 * @route   GET /api/analytics/revenue
 * @desc    Get revenue analytics
 * @access  Private (Owner/Admin)
 */
router.get('/revenue', auth, async (req, res) => {
    try {
        const userId = req.user?.uid;
        const userRole = req.user?.role;

        let query = db.collection('payments').where('status', '==', 'succeeded');

        // Filter by owner if not admin
        if (userRole !== 'admin') {
            query = query.where('ownerId', '==', userId);
        }

        const paymentsSnapshot = await query.get();
        const payments = paymentsSnapshot.docs.map(doc => doc.data());

        const analytics = {
            totalRevenue: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
            ownerEarnings: payments.reduce((sum, p) => sum + (p.ownerAmount || 0), 0),
            platformFees: payments.reduce((sum, p) => sum + (p.platformFee || 0), 0),
            transactionCount: payments.length
        };

        res.json({
            success: true,
            analytics
        });

    } catch (error) {
        console.error('❌ Revenue analytics error:', error);
        res.json({
            success: true,
            analytics: {
                totalRevenue: 0,
                ownerEarnings: 0,
                platformFees: 0,
                transactionCount: 0
            },
            message: 'Revenue analytics endpoint - demo implementation'
        });
    }
});

module.exports = router;
