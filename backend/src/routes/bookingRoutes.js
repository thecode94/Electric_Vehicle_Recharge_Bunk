// backend/src/routes/bookingRoutes.js
const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const adminConfig = require('../config/firebase');
const admin = adminConfig.admin || adminConfig;
const db = adminConfig.db || (admin.firestore && admin.firestore());

/* ---------------- helpers ---------------- */
const toDate = (x) => (x?.toDate ? x.toDate() : new Date(x));
const toISO = (x) => {
    const d = toDate(x);
    return Number.isNaN(d?.getTime?.()) ? null : d.toISOString();
};
const isIndexError = (err) => err && (err.code === 9 || /FAILED_PRECONDITION/i.test(String(err)));
const n = (v, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);

/* Normalize a booking doc for response (timestamps -> ISO) */
function out(doc) {
    if (!doc) return null;
    return {
        ...doc,
        createdAt: toISO(doc.createdAt) || doc.createdAt || null,
        updatedAt: toISO(doc.updatedAt) || doc.updatedAt || null,
        cancelledAt: toISO(doc.cancelledAt) || undefined,
        startTime: doc.startTime ? toISO(doc.startTime) || doc.startTime : undefined,
        endTime: doc.endTime ? toISO(doc.endTime) || doc.endTime : undefined,
    };
}

/* ---------------- CREATE ---------------- */
router.post('/', auth, async (req, res) => {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ success: false, error: 'unauthenticated' });

        const {
            stationId,
            startTime,
            endTime,
            durationMins,
            vehicleType,
            connectorType,
            notes,
            pricePerKwh
        } = req.body;

        if (!stationId) return res.status(400).json({ success: false, error: 'Station selection is required', field: 'stationId' });
        if (!startTime) return res.status(400).json({ success: false, error: 'Start time is required', field: 'startTime' });

        // compute endTime if not provided
        let computedEnd = endTime;
        if (!computedEnd && durationMins) {
            const start = new Date(startTime);
            computedEnd = new Date(start.getTime() + Number(durationMins) * 60000).toISOString();
        }
        if (!computedEnd) return res.status(400).json({ success: false, error: 'End time or duration is required', field: 'endTime' });

        // money math
        const duration = Number(durationMins ?? Math.round((new Date(computedEnd) - new Date(startTime)) / 60000));
        const baseRate = n(pricePerKwh, 12.5);
        const estimatedKwh = duration * 0.5; // simple model
        const amount = Math.round(estimatedKwh * baseRate * 100) / 100;

        // attempt to derive ownerId from stations/ or ev_bunks/
        let ownerId = null;
        try {
            const s1 = await db.collection('stations').doc(String(stationId)).get();
            const s2 = s1?.exists ? null : await db.collection('ev_bunks').doc(String(stationId)).get();
            const st = s1?.exists ? s1.data() : s2?.exists ? s2.data() : null;
            ownerId = st?.ownerId || st?.createdBy || st?.ownerUID || null;
        } catch { }

        const ref = db.collection('bookings').doc(`booking_${Date.now()}`);

        const booking = {
            id: ref.id,
            userId: uid,
            userEmail: req.user?.email || null,
            ...(ownerId && { ownerId }),

            stationId: String(stationId),
            startTime: new Date(startTime),
            endTime: new Date(computedEnd),
            durationMins: duration,
            vehicleType: vehicleType || 'car',
            connectorType: connectorType || 'type2',
            notes: notes || '',

            baseRate,
            estimatedKwh,
            amount,
            totalAmount: amount,

            status: 'pending_payment',
            paymentStatus: 'pending',

            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await ref.set(booking);

        const response = out({ ...booking, id: ref.id }); // normalize timestamps for client

        return res.status(201).json({
            success: true,
            booking: response,
            message: 'Booking created successfully',
            paymentRequired: true,
            paymentAmount: amount,
            paymentUrl: `/payment?bookingId=${ref.id}`,
            nextStep: 'payment',
            estimatedCost: `₹${amount}`,
            chargingDuration: `${duration} minutes`,
            chargingRate: `₹${baseRate}/kWh`
        });
    } catch (err) {
        console.error('Booking creation error:', err);
        return res.status(500).json({ success: false, error: 'Failed to create booking' });
    }
});

/* ---------------- LIST (current user) ---------------- */
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user?.uid;
        if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });

        const { status, limit = 10, startAfter, offset } = req.query;
        const lim = Math.min(100, Number(limit) || 10);

        let q = db.collection('bookings').where('userId', '==', userId).orderBy('createdAt', 'desc');
        if (status) q = q.where('status', '==', String(status));

        // startAfter pagination is preferred
        if (startAfter) {
            try {
                const sa = await db.collection('bookings').doc(String(startAfter)).get();
                if (sa.exists) q = q.startAfter(sa);
            } catch { }
        }

        let docs;
        try {
            const snap = (offset ? await q.offset(Number(offset)).limit(lim).get() : await q.limit(lim).get());
            docs = snap.docs;
        } catch (err) {
            if (!isIndexError(err)) throw err;
            // Fallback: remove orderBy and sort in memory (ok for dev/small data)
            const snap = await db.collection('bookings').where('userId', '==', userId).get();
            docs = snap.docs
                .filter(d => (status ? d.data().status === status : true))
                .sort((a, b) => {
                    const ad = toDate(a.data().createdAt)?.getTime() || 0;
                    const bd = toDate(b.data().createdAt)?.getTime() || 0;
                    return bd - ad; // desc
                })
                .slice(offset ? Number(offset) : 0, (offset ? Number(offset) : 0) + lim);
        }

        const bookings = docs.map(d => out({ id: d.id, ...d.data() }));
        return res.json({
            success: true,
            items: bookings,                 // 👈 added alias for UI
            bookings,
            total: bookings.length,
            nextPageStartAfter: bookings.length ? bookings[bookings.length - 1].id : null,
            message: bookings.length ? 'Bookings retrieved successfully' : 'No bookings found',
        });
    } catch (error) {
        console.error('Get bookings error:', error);
        return res.status(500).json({ success: false, error: 'Failed to retrieve bookings' });
    }
});

/* ---------------- GET ONE ---------------- */
router.get('/:id', auth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.user?.uid;

        const doc = await db.collection('bookings').doc(bookingId).get();
        if (!doc.exists) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        const booking = { id: doc.id, ...doc.data() };

        // user must own it unless admin
        if (booking.userId !== userId && !req.user?.isAdmin) {
            return res.status(403).json({ success: false, error: 'Access denied to this booking' });
        }

        return res.json({ success: true, booking: out(booking), message: 'Booking details retrieved successfully' });
    } catch (error) {
        console.error('Get booking error:', error);
        return res.status(500).json({ success: false, error: 'Failed to retrieve booking details' });
    }
});

/* ---------------- UPDATE ---------------- */
router.patch('/:id', auth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.user?.uid;
        const { status, paymentStatus, notes } = req.body || {};

        if (!status && !paymentStatus && !notes) {
            return res.status(400).json({ success: false, error: 'Nothing to update' });
        }

        const docRef = db.collection('bookings').doc(bookingId);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ success: false, error: 'Booking not found' });

        const bookingData = doc.data();
        if (bookingData.userId !== userId && !req.user?.isAdmin) {
            return res.status(403).json({ success: false, error: 'Access denied to modify this booking' });
        }

        const updates = {
            ...(status && { status: String(status) }),
            ...(paymentStatus && { paymentStatus: String(paymentStatus) }),
            ...(typeof notes === 'string' && { notes }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await docRef.update(updates);

        return res.json({
            success: true,
            message: `Booking ${bookingId} updated successfully`,
            booking: out({ id: bookingId, ...bookingData, ...updates }),
        });
    } catch (error) {
        console.error('Update booking error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update booking' });
    }
});

/* ---------------- CANCEL (soft delete) ---------------- */
router.delete('/:id', auth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.user?.uid;

        const docRef = db.collection('bookings').doc(bookingId);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ success: false, error: 'Booking not found' });

        const bookingData = doc.data();
        if (bookingData.userId !== userId && !req.user?.isAdmin) {
            return res.status(403).json({ success: false, error: 'Access denied to cancel this booking' });
        }

        const updates = {
            status: 'cancelled',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await docRef.update(updates);

        return res.json({
            success: true,
            message: `Booking ${bookingId} cancelled successfully`,
            booking: out({ id: bookingId, ...bookingData, ...updates }),
        });
    } catch (error) {
        console.error('Cancel booking error:', error);
        return res.status(500).json({ success: false, error: 'Failed to cancel booking' });
    }
});

module.exports = router;
