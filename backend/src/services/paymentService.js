const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
async function createPaymentIntent({ bookingId, amount, currency = 'INR' }) {
  const intentId = uuidv4();
  const clientSecret = 'mock_' + intentId;
  await db.collection('payments').doc(intentId).set({ bookingId, amount, currency, clientSecret, intentId, status: 'created', createdAt: new Date() });
  return { clientSecret, intentId };
}
async function handleWebhook(intentId) {
  const snap = await db.collection('payments').doc(intentId).get();
  if (!snap.exists) throw new Error('Payment not found');
  const payment = snap.data();
  await snap.ref.update({ status: 'succeeded', updatedAt: new Date() });
  await db.collection('bookings').doc(payment.bookingId).update({ status: 'confirmed', payment: { intentId, status: 'paid' }, updatedAt: new Date() });
  return true;
}
module.exports = { createPaymentIntent, handleWebhook };
