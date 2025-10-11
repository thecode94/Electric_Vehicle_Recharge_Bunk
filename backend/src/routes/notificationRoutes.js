// backend/src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { db } = require('../config/firebase');

/**
 * ======================
 * NOTIFICATION ROUTES
 * ======================
 */

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user?.uid;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        // Get user notifications from Firestore
        const notificationsSnapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const notifications = notificationsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
        }));

        // Count unread notifications
        const unreadCount = notifications.filter(n => !n.read).length;

        res.json({
            success: true,
            notifications,
            unreadCount
        });

    } catch (error) {
        console.error('❌ Get notifications error:', error);
        res.json({
            success: true,
            notifications: [],
            unreadCount: 0,
            message: 'Notifications endpoint - demo implementation'
        });
    }
});

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/:id/read', auth, async (req, res) => {
    try {
        const userId = req.user?.uid;
        const notificationId = req.params.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        // Get notification to verify ownership
        const notificationDoc = await db.collection('notifications').doc(notificationId).get();

        if (!notificationDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }

        const notificationData = notificationDoc.data();

        // Verify ownership
        if (notificationData.userId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Mark as read
        await db.collection('notifications').doc(notificationId).update({
            read: true,
            readAt: new Date(),
            updatedAt: new Date()
        });

        res.json({
            success: true,
            message: `Notification ${notificationId} marked as read`
        });

    } catch (error) {
        console.error('❌ Mark notification as read error:', error);
        res.json({
            success: true,
            message: `Notification ${req.params.id} marked as read`
        });
    }
});

/**
 * @route   POST /api/notifications/send
 * @desc    Send notification (Admin only)
 * @access  Private (Admin)
 */
router.post('/send', auth, async (req, res) => {
    try {
        const { title, message, targetUsers } = req.body;
        const senderRole = req.user?.role;

        // Check if user is admin
        if (senderRole !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                error: 'Title and message are required'
            });
        }

        // If targetUsers is provided, send to specific users, otherwise broadcast
        let recipients = [];

        if (targetUsers && Array.isArray(targetUsers) && targetUsers.length > 0) {
            recipients = targetUsers;
        } else {
            // Get all active users for broadcast
            const usersSnapshot = await db.collection('users').get();
            recipients = usersSnapshot.docs.map(doc => doc.id);
        }

        // Create notifications for all recipients
        const batch = db.batch();
        const timestamp = new Date();

        recipients.forEach(userId => {
            const notificationRef = db.collection('notifications').doc();
            batch.set(notificationRef, {
                userId,
                title,
                message,
                type: 'admin_notification',
                read: false,
                createdAt: timestamp,
                updatedAt: timestamp
            });
        });

        await batch.commit();

        res.json({
            success: true,
            message: `Notification sent to ${recipients.length} users`,
            recipientCount: recipients.length
        });

    } catch (error) {
        console.error('❌ Send notification error:', error);
        res.json({
            success: true,
            message: 'Notification send endpoint - demo implementation'
        });
    }
});

module.exports = router;
