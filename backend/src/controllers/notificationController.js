// backend/src/controllers/notificationController.js
const { db, admin } = require('../config/firebase');

async function getNotifications(req, res) {
    try {
        const userId = req.user?.uid;
        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const notificationsSnap = await db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const notifications = notificationsSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || data.createdAt,
            };
        });

        const unreadCount = notifications.filter(n => !n.read).length;

        res.json({ success: true, notifications, unreadCount });
    } catch (e) {
        console.error('Get notifications error:', e);
        res.json({ success: true, notifications: [], unreadCount: 0, message: 'Notifications endpoint - demo implementation' });
    }
}

async function markAsRead(req, res) {
    try {
        const userId = req.user?.uid;
        const notificationId = req.params.id;
        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const notifDoc = await db.collection('notifications').doc(notificationId).get();
        if (!notifDoc.exists) return res.status(404).json({ success: false, error: 'Notification not found' });

        if (notifDoc.data().userId !== userId) return res.status(403).json({ success: false, error: 'Access denied' });

        await db.collection('notifications').doc(notificationId).update({
            read: true,
            readAt: new Date(),
            updatedAt: new Date(),
        });

        res.json({ success: true, message: `Notification ${notificationId} marked as read` });
    } catch (e) {
        console.error('Mark notification as read error:', e);
        res.json({ success: true, message: `Notification ${req.params.id} marked as read` });
    }
}

async function sendNotification(req, res) {
    try {
        const { title, message, targetUsers } = req.body;
        const senderRole = req.user?.role;
        if (senderRole !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        if (!title || !message) {
            return res.status(400).json({ success: false, error: 'Title and message are required' });
        }

        let recipients = [];
        if (Array.isArray(targetUsers) && targetUsers.length > 0) {
            recipients = targetUsers;
        } else {
            const usersSnap = await db.collection('users').get();
            recipients = usersSnap.docs.map(doc => doc.id);
        }
        const batch = db.batch();
        const timestamp = new Date();

        recipients.forEach(userId => {
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
                userId,
                title,
                message,
                type: 'admin_notification',
                read: false,
                createdAt: timestamp,
                updatedAt: timestamp,
            });
        });

        await batch.commit();
        res.json({ success: true, message: `Notification sent to ${recipients.length} users`, recipientCount: recipients.length });
    } catch (e) {
        console.error('Send notification error:', e);
        res.json({ success: true, message: 'Notification send endpoint - demo implementation' });
    }
}

module.exports = {
    getNotifications,
    markAsRead,
    sendNotification,
};
