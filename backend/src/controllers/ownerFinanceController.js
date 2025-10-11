// backend/src/controllers/ownerFinanceController.js
const adminConfig = require('../config/firebase');
const admin = adminConfig.admin || adminConfig;
const db = adminConfig.db || (admin.firestore && admin.firestore());

/** ---------- utils ---------- */
function toDate(x) {
    if (!x) return null;
    if (x.toDate) return x.toDate();
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : d;
}
function dayKey(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}
function parseRange(range = '30d') {
    const m = /^(\d+)\s*d$/i.exec(String(range).trim());
    const days = m ? Math.max(1, parseInt(m[1], 10)) : 30;
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), to.getDate()); // start of today
    from.setDate(from.getDate() - (days - 1));
    return { from, to, days };
}
// pick owner-facing amount
function ownerAmountOf(p) {
    const b = p.breakdown || {};
    const ownerAmount = Number(b.ownerAmount ?? NaN);
    if (!Number.isNaN(ownerAmount)) return ownerAmount;
    // fallback: amount - platformFee, else amount
    const total = Number(b.totalAmount ?? p.amount ?? 0);
    const fee = Number(b.platformFee ?? 0);
    return total - fee;
}
function isPaid(s) {
    if (!s) return true; // if no status stored, treat as settled
    s = String(s).toLowerCase();
    return ['paid', 'succeeded', 'completed', 'success', 'settled'].includes(s);
}
function isRefunded(s) {
    if (!s) return false;
    s = String(s).toLowerCase();
    return ['refunded', 'refund', 'chargeback'].includes(s);
}
function isIndexError(err) {
    return err && (err.code === 9 || /FAILED_PRECONDITION/i.test(String(err)));
}
const chunk = (arr, n = 10) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

/** ---------- payment loaders (fast + fallback) ---------- */
/** Fast path: payments have ownerId + index on (ownerId, createdAt) */
async function getOwnerPaymentsFast(ownerId, { from, order = 'desc', limit = 2000 } = {}) {
    let q = db.collection('payments').where('ownerId', '==', ownerId);
    if (from) q = q.where('createdAt', '>=', from);
    q = q.orderBy('createdAt', order).limit(limit);
    const snap = await q.get();
    return snap.docs;
}

/** Fallback path: no ownerId on payments → join via bookings → bookingId(IN) */
async function getOwnerPaymentsViaBookings(ownerId, { order = 'desc' } = {}) {
    // 1) all bookings for owner (no orderBy to avoid composite index)
    const bSnap = await db.collection('bookings').where('ownerId', '==', ownerId).get();
    const bookingIds = bSnap.docs.map((d) => d.id);
    if (bookingIds.length === 0) return [];

    // 2) fetch payments by bookingId in chunks of 10
    const all = [];
    for (const ids of chunk(bookingIds, 10)) {
        const pSnap = await db.collection('payments').where('bookingId', 'in', ids).get();
        all.push(...pSnap.docs);
    }

    // 3) in-memory sort by createdAt
    all.sort((a, b) => {
        const ad = toDate(a.data().createdAt)?.getTime() || 0;
        const bd = toDate(b.data().createdAt)?.getTime() || 0;
        return order === 'asc' ? ad - bd : bd - ad;
    });

    return all;
}

/** ---------- summary ---------- */
// GET /owner/finance/summary
exports.getSummary = async (req, res) => {
    try {
        const ownerId = req.user && req.user.uid;
        if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });

        // try owner totals first
        const ownerRef = db.collection('owners').doc(ownerId);
        const ownerDoc = await ownerRef.get();
        const owner = ownerDoc.exists ? ownerDoc.data() : {};
        const totals = owner.totals || {};
        const currency = owner.currency || 'INR';

        // If you already maintain totals, use them
        const hasTotals = ['totalRevenue', 'last30Days', 'monthRevenue', 'totalBookings', 'pendingPayout', 'refunds']
            .some((k) => typeof totals[k] === 'number');

        if (hasTotals) {
            return res.json({
                totalRevenue: Number(totals.totalRevenue || 0),
                monthRevenue: Number(totals.last30Days || totals.monthRevenue || 0),
                totalBookings: Number(totals.totalBookings || 0),
                pendingPayout: Number(totals.pendingPayout || 0),
                refunds: Number(totals.refunds || 0),
                currency,
            });
        }

        // Otherwise compute lightweight summary from payments
        let payDocs;
        try {
            payDocs = await getOwnerPaymentsFast(ownerId, { order: 'desc', limit: 2000 });
        } catch (err) {
            if (!isIndexError(err)) throw err;
        }
        if (!payDocs || payDocs.length === 0) {
            payDocs = await getOwnerPaymentsViaBookings(ownerId, { order: 'desc' });
        }

        let totalRevenue = 0;
        let refunds = 0;
        let totalBookings = 0;
        const seenBookings = new Set();

        const today = new Date();
        const last30From = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        last30From.setDate(last30From.getDate() - 29);
        let last30Days = 0;

        for (const doc of payDocs) {
            const p = doc.data();
            const created = toDate(p.createdAt);
            const status = p.status;

            const amt = ownerAmountOf(p);

            if (isPaid(status)) {
                totalRevenue += amt;
                if (created && created >= last30From) last30Days += amt;

                const bid = p.bookingId || doc.id;
                if (bid && !seenBookings.has(bid)) {
                    seenBookings.add(bid);
                    totalBookings += 1;
                }
            } else if (isRefunded(status)) {
                refunds += Math.abs(amt);
            }
        }

        return res.json({
            totalRevenue,
            monthRevenue: last30Days,
            totalBookings,
            pendingPayout: Number(totals.pendingPayout || 0),
            refunds,
            currency,
        });
    } catch (err) {
        console.error('getSummary error:', err);
        return res.status(500).json({ error: 'Failed to fetch summary' });
    }
};

/** ---------- revenue (time series) ---------- */
// GET /owner/finance/revenue?range=30d
// returns [{ date: 'YYYY-MM-DD', amount }]
exports.getRevenue = async (req, res) => {
    try {
        const ownerId = req.user && req.user.uid;
        if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });

        const { from, to } = parseRange(req.query.range);
        const buckets = new Map();
        // prefill buckets
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
            buckets.set(dayKey(d), 0);
        }

        let payAscDocs;
        try {
            payAscDocs = await getOwnerPaymentsFast(ownerId, { from, order: 'asc' });
        } catch (err) {
            if (!isIndexError(err)) throw err;
        }
        if (!payAscDocs || payAscDocs.length === 0) {
            // fallback via bookings (no from filter here; we bucket by createdAt anyway)
            payAscDocs = await getOwnerPaymentsViaBookings(ownerId, { order: 'asc' });
            // optional filter by 'from' after join:
            payAscDocs = payAscDocs.filter((doc) => {
                const dt = toDate(doc.data().createdAt);
                return dt && dt >= from;
            });
        }

        for (const doc of payAscDocs) {
            const p = doc.data();
            if (!isPaid(p.status)) continue;
            const created = toDate(p.createdAt);
            if (!created) continue;
            const key = dayKey(created);
            if (!buckets.has(key)) continue;
            buckets.set(key, buckets.get(key) + ownerAmountOf(p));
        }

        const out = Array.from(buckets.entries()).map(([date, amount]) => ({ date, amount }));
        return res.json(out);
    } catch (err) {
        console.error('getRevenue error:', err);
        return res.status(500).json({ error: 'Failed to fetch revenue' });
    }
};

/** ---------- payouts ---------- */
// GET /owner/finance/payouts -> array
exports.getPayouts = async (req, res) => {
    try {
        const ownerId = req.user && req.user.uid;
        if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });

        const snap = await db
            .collection('owners')
            .doc(ownerId)
            .collection('payouts')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

        const items = [];
        snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
        return res.json(items);
    } catch (err) {
        console.error('getPayouts error:', err);
        return res.status(500).json({ error: 'Failed to fetch payouts' });
    }
};

// POST /owner/finance/payouts { amount }
exports.createPayout = async (req, res) => {
    try {
        const ownerId = req.user && req.user.uid;
        if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });

        const amount = Number(req.body?.amount || 0);
        if (!(amount > 0)) return res.status(400).json({ error: 'amount must be > 0' });

        const ownerRef = db.collection('owners').doc(ownerId);
        const payoutRef = ownerRef.collection('payouts').doc();

        const payout = {
            payoutId: payoutRef.id,
            ownerId,
            amount,
            status: 'scheduled',
            createdAt: new Date(),
            currency: 'INR',
        };

        await db.runTransaction(async (tx) => {
            const ownerSnap = await tx.get(ownerRef);
            if (!ownerSnap.exists) throw new Error('Owner not found');

            tx.set(payoutRef, payout);
            tx.update(ownerRef, {
                'totals.pendingPayout': admin.firestore.FieldValue.increment(amount),
                'totals.updatedAt': new Date(),
            });

            // optional ledger entry
            const ledgerRef = db.collection('transactions').doc();
            tx.set(ledgerRef, {
                id: ledgerRef.id,
                ownerId,
                type: 'payout_request',
                status: 'scheduled',
                amount: -amount,
                createdAt: new Date(),
                relatedId: payoutRef.id,
            });
        });

        return res.status(201).json({ success: true, message: 'Payout requested', payout });
    } catch (err) {
        console.error('createPayout error:', err);
        return res.status(500).json({ error: 'Failed to request payout' });
    }
};

/** ---------- base/compat handlers for your existing routes ---------- */
// GET /owner/finance (compat wrapper)
exports.getFinance = async (req, res) => {
    try {
        // derive from summary
        const send = (obj) => res.json(obj);
        // Capture the json from getSummary without double-writing headers
        let captured = null;
        await exports.getSummary(req, {
            status: (c) => ({ json: (o) => { res.status(c).json(o); } }),
            json: (o) => { captured = o; return o; }
        });
        if (res.headersSent) return;

        const sum = captured || {};
        return send({
            success: true,
            finance: {
                totalEarnings: Number(sum.totalRevenue || 0),
                pendingPayouts: Number(sum.pendingPayout || 0),
                completedPayouts: 0,
                transactions: [],
            },
        });
    } catch (err) {
        console.error('getFinance error:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch finance data' });
    }
};

// GET /owner/finance/earnings (compat -> revenue)
exports.getEarnings = (req, res) => exports.getRevenue(req, res);
