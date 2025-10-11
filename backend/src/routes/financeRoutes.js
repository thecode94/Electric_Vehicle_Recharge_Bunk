// backend/src/routes/financeRoutes.js - COMPLETE FIXED VERSION
const express = require('express');
const router = express.Router();
const ownerAuth = require('../middleware/ownerAuth');

// Lazy-load controller (optional; keeps fallbacks if file is absent)
let ownerFinanceController = null;
function getController() {
    if (ownerFinanceController) return ownerFinanceController;
    try {
        // eslint-disable-next-line global-require
        ownerFinanceController = require('../controllers/ownerFinanceController');
    } catch (err) {
        console.log('ℹ️ ownerFinanceController not found, using fallbacks');
        ownerFinanceController = null;
    }
    return ownerFinanceController;
}

/**
 * Owner Finance Routes — shapes tailored to src/features/owner/pages/OwnerFinance.jsx
 *
 *  GET  /owner/finance/summary  -> summary object
 *  GET  /owner/finance/revenue  -> [{ date, amount }]
 *  GET  /owner/finance/payouts  -> array
 *  POST /owner/finance/payouts  -> { success, message, payout }
 *
 * Compatibility:
 *  GET  /owner/finance          -> { success, finance: {...} }
 *  GET  /owner/finance/earnings -> same as /revenue
 */

// --- SUMMARY ---
router.get('/summary', ownerAuth, async (req, res) => {
    try {
        const ctl = getController();
        if (ctl && ctl.getSummary) return ctl.getSummary(req, res);

        // Fallback: zeroed summary (exact shape)
        return res.json({
            totalRevenue: 0,
            monthRevenue: 0,
            totalBookings: 0,
            pendingPayout: 0,
            refunds: 0,
            currency: 'INR',
        });
    } catch (error) {
        console.error('❌ Finance summary error:', error);
        return res.status(500).json({ error: 'Failed to fetch finance summary' });
    }
});

// --- REVENUE (time series) ---
router.get('/revenue', ownerAuth, async (req, res) => {
    try {
        const ctl = getController();
        if (ctl && ctl.getRevenue) return ctl.getRevenue(req, res);

        // Fallback: empty series
        return res.json([]);
    } catch (error) {
        console.error('❌ Revenue error:', error);
        return res.status(500).json({ error: 'Failed to fetch revenue' });
    }
});

// --- PAYOUTS LIST ---
router.get('/payouts', ownerAuth, async (req, res) => {
    try {
        const ctl = getController();
        if (ctl && ctl.getPayouts) return ctl.getPayouts(req, res);

        // Fallback: none
        return res.json([]);
    } catch (error) {
        console.error('❌ Payouts list error:', error);
        return res.status(500).json({ error: 'Failed to fetch payouts' });
    }
});

// --- CREATE PAYOUT ---
router.post('/payouts', ownerAuth, async (req, res) => {
    try {
        const ctl = getController();
        if (ctl && ctl.createPayout) return ctl.createPayout(req, res);

        // Fallback: accept but do nothing
        return res.status(201).json({
            success: true,
            message: 'Payout requested (demo mode)',
            payout: null,
        });
    } catch (error) {
        console.error('❌ Create payout error:', error);
        return res.status(500).json({ error: 'Failed to request payout' });
    }
});

// --- BASE DETAILED FINANCE (compat) ---
router.get('/', ownerAuth, async (req, res) => {
    try {
        const ctl = getController();
        if (ctl && ctl.getFinance) return ctl.getFinance(req, res);

        // Fallback compat shape
        return res.json({
            success: true,
            finance: {
                totalEarnings: 0,
                pendingPayouts: 0,
                completedPayouts: 0,
                transactions: [],
            },
        });
    } catch (error) {
        console.error('❌ Finance data error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch finance data' });
    }
});

// --- BASE EARNINGS (compat -> revenue) ---
router.get('/earnings', ownerAuth, async (req, res) => {
    try {
        const ctl = getController();
        if (ctl && ctl.getEarnings) return ctl.getEarnings(req, res);

        // Fallback: empty list
        return res.json([]);
    } catch (error) {
        console.error('❌ Earnings data error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch earnings' });
    }
});

module.exports = router;
