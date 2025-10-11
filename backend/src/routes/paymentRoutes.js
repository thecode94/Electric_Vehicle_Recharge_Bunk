const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth'); // Use auth middleware for protected routes

// Create payment intent (dummy)
router.post('/create-intent', auth, paymentController.createPaymentIntent);

// Confirm payment (dummy)
router.post('/confirm/:paymentIntentId', auth, paymentController.confirmPayment);

// Webhook handler (usually public endpoint)
router.post('/webhook', paymentController.webhookHandler);

// Get payment intent details
router.get('/:paymentIntentId', auth, paymentController.getPaymentDetails);

// List payments (admin only)
router.get('/', auth, paymentController.listPayments);

// Simulate 3DS Authentication (demo)
router.post('/3ds/:paymentIntentId', auth, paymentController.simulate3DS);

module.exports = router;
