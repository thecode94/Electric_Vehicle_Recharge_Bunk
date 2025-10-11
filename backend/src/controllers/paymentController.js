// backend/src/controllers/paymentController.js
const { v4: uuidv4 } = require("uuid");
const adminConfig = require("../config/firebase");
const admin = adminConfig.admin || adminConfig;
const db = adminConfig.db || (admin.firestore && admin.firestore());

function simulatePaymentOutcome() {
  const outcomes = [
    { status: "success", probability: 0.85 },
    { status: "failure", probability: 0.10 },
    { status: "pending", probability: 0.05 },
  ];
  const r = Math.random();
  let c = 0;
  for (const o of outcomes) {
    c += o.probability;
    if (r <= c) return o.status;
  }
  return "success";
}

/**
 * Try to resolve ownerId & station summary from booking + station doc.
 */
async function hydrateBookingMeta(booking) {
  let ownerId = booking.ownerId || null;
  let stationName = booking.stationName || null;

  if (!ownerId || !stationName) {
    const stationId = booking.stationId;
    if (stationId) {
      const stationSnap = await db.collection("stations").doc(stationId).get().catch(() => null);
      if (stationSnap && stationSnap.exists) {
        const s = stationSnap.data() || {};
        ownerId = ownerId || s.ownerId || s.createdBy || s.ownerUID || null;
        stationName = stationName || s.name || s.title || null;
      }
    }
  }

  return { ownerId: ownerId || null, stationName: stationName || null };
}

/**
 * Server-side amount resolution to avoid client tampering.
 * Priority: explicit amount in body (if finite) -> booking.totalAmount/amount/price -> fail
 * (Optionally derive from station tariff if your schema supports it.)
 */
function resolveAmount(reqAmount, booking, station) {
  const tryNums = [
    Number(reqAmount),
    Number(booking?.totalAmount),
    Number(booking?.amount),
    Number(booking?.price),
    Number(booking?.total),
  ].filter((n) => Number.isFinite(n) && n > 0);

  if (tryNums.length) return tryNums[0];

  // (Optional) example compute using tariff & duration if you have those fields:
  // if (station?.pricePerKwh && booking?.kwh) {
  //   const computed = Number(station.pricePerKwh) * Number(booking.kwh);
  //   if (Number.isFinite(computed) && computed > 0) return computed;
  // }

  return NaN;
}

/**
 * Create Payment Intent (Dummy)
 */
async function createPaymentIntent(req, res) {
  try {
    const {
      bookingId,
      amount, // client-provided; we'll validate/override server-side
      currency = "INR",
      paymentMethod = "card",
      customerEmail,
      customerName,
    } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required" });
    }

    // Load booking
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bookingSnap.data();

    // Hydrate missing meta from station if needed
    const { ownerId, stationName } = await hydrateBookingMeta(booking);

    // Optionally load station for price computation (if you decide to compute)
    let stationDoc = null;
    if (booking.stationId) {
      const sSnap = await db.collection("stations").doc(booking.stationId).get().catch(() => null);
      if (sSnap && sSnap.exists) stationDoc = sSnap.data();
    }

    // Resolve amount server-side
    const totalAmount = resolveAmount(amount, booking, stationDoc);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount for payment" });
    }

    // Platform fee calc (10% demo)
    const platformFee = Math.round(totalAmount * 0.10 * 100) / 100;
    const ownerAmount = Math.round((totalAmount - platformFee) * 100) / 100;

    // Create dummy intent
    const paymentIntentId = `pi_dummy_${uuidv4()}`;
    const clientSecret = `pi_dummy_${uuidv4()}_secret_${uuidv4()}`;

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const paymentData = {
      id: paymentIntentId,
      amount: totalAmount,
      currency,
      status: "requires_payment_method",
      bookingId,
      userId: booking.userId || null,
      stationId: booking.stationId || null,
      // only include ownerId if defined
      ...(ownerId && { ownerId }),

      breakdown: {
        totalAmount,
        platformFee,
        ownerAmount,
        platformFeePercentage: 10,
      },

      paymentMethod: {
        type: paymentMethod,
        brand: paymentMethod === "card" ? "visa" : paymentMethod,
        last4: paymentMethod === "card" ? "4242" : null,
      },

      customer: {
        email: customerEmail || booking.userEmail || null,
        name: customerName || booking.userName || null,
      },

      gateway: "dummy_payment_gateway",
      gatewayTransactionId: `txn_dummy_${uuidv4()}`,

      metadata: {
        bookingReference: booking.referenceNumber || bookingId,
        stationName: stationName || null,
        chargingSession: booking.sessionDetails || {},
      },

      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Save intent (guard undefined fields via spreads above)
    await db.collection("payments").doc(paymentIntentId).set(paymentData);

    // Update booking safely
    await bookingRef.set(
      {
        paymentIntentId,
        paymentStatus: "requires_payment_method",
        totalAmount,
        updatedAt: timestamp,
      },
      { merge: true }
    );

    return res.json({
      success: true,
      paymentIntent: {
        id: paymentIntentId,
        clientSecret,
        amount: totalAmount,
        currency,
        status: "requires_payment_method",
        gateway: "dummy_payment_gateway",
        confirmation: {
          type: "manual",
          url: `${req.protocol}://${req.get("host")}/api/payments/confirm/${paymentIntentId}`,
        },
        testCards: {
          success: "4242424242424242",
          decline: "4000000000000002",
          pending: "4000000000000077",
        },
        breakdown: paymentData.breakdown,
        demoMode: true,
      },
      message: "Dummy payment intent created successfully",
    });
  } catch (err) {
    console.error("Create payment intent error:", err);
    return res.status(500).json({
      error: "Failed to create payment intent",
      details: err.message,
    });
  }
}

/**
 * Confirm Payment (Dummy)
 */
async function confirmPayment(req, res) {
  try {
    const { paymentIntentId } = req.params;
    const { cardNumber } = req.body;

    const paymentRef = db.collection("payments").doc(paymentIntentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
      return res.status(404).json({ error: "Payment intent not found" });
    }
    const payment = paymentSnap.data();

    await new Promise((r) => setTimeout(r, 1200)); // demo delay

    let outcome = "success";
    if (cardNumber) {
      if (cardNumber.includes("4000000000000002")) outcome = "failure";
      else if (cardNumber.includes("4000000000000077")) outcome = "pending";
    } else {
      outcome = simulatePaymentOutcome();
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    let status, message;

    if (outcome === "success") {
      status = "succeeded";
      message = "Payment successful";

      await paymentRef.update({
        status: "succeeded",
        confirmedAt: timestamp,
        updatedAt: timestamp,
        paymentMethod: {
          ...payment.paymentMethod,
          last4: cardNumber ? cardNumber.slice(-4) : "4242",
          fingerprint: `fp_dummy_${uuidv4().slice(0, 8)}`,
        },
      });

      await db.collection("bookings").doc(payment.bookingId).set(
        {
          paymentStatus: "paid",
          status: "confirmed",
          paidAt: timestamp,
          updatedAt: timestamp,
        },
        { merge: true }
      );

      await processSuccessfulPayment(payment, paymentIntentId);
    }

    if (outcome === "failure") {
      status = "failed";
      message = "Payment declined";

      await paymentRef.update({
        status: "failed",
        failureReason: "card_declined",
        failureMessage: "Your card was declined.",
        updatedAt: timestamp,
      });

      await db.collection("bookings").doc(payment.bookingId).set(
        {
          paymentStatus: "failed",
          status: "payment_failed",
          updatedAt: timestamp,
        },
        { merge: true }
      );
    }

    if (outcome === "pending") {
      status = "requires_action";
      message = "Payment requires additional authentication";

      await paymentRef.update({
        status: "requires_action",
        nextAction: {
          type: "3ds_authentication",
          url: `${req.protocol}://${req.get("host")}/api/payments/3ds/${paymentIntentId}`,
        },
        updatedAt: timestamp,
      });
    }

    return res.json({
      success: outcome === "success",
      paymentIntent: {
        id: paymentIntentId,
        status,
        message,
        amount: payment.amount,
        currency: payment.currency,
        demoMode: true,
        ...(outcome === "pending" && {
          nextAction: {
            type: "3ds_authentication",
            url: `${req.protocol}://${req.get("host")}/api/payments/3ds/${paymentIntentId}`,
          },
        }),
      },
    });
  } catch (err) {
    console.error("Confirm payment error:", err);
    return res.status(500).json({ error: "Payment confirmation failed", details: err.message });
  }
}

/**
 * Process successful payment (10% platform, 90% owner)
 * - Skips owner updates gracefully if ownerId is missing
 */
async function processSuccessfulPayment(payment, paymentIntentId) {
  try {
    const { bookingId, stationId } = payment;
    const ownerId = payment.ownerId || null;
    const amount = Number(payment.amount) || 0;
    const platformFee = Math.round(amount * 0.10 * 100) / 100;
    const ownerAmount = Math.round(amount * 0.90 * 100) / 100;

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const transactionData = {
      txnId: paymentIntentId,
      provider: "dummy_payment_gateway",
      stationId: stationId || null,
      bookingId,
      userId: payment.userId || null,
      ...(ownerId && { ownerId }),

      totalAmount: amount,
      platformFee,
      ownerAmount,
      currency: payment.currency || "INR",

      status: "completed",
      payoutStatus: ownerId ? "pending" : "n/a",

      createdAt: timestamp,
      processedAt: timestamp,
    };

    await db.collection("transactions").doc(paymentIntentId).set(transactionData);

    // Update owner totals only if we have an owner
    if (ownerId) {
      await db.collection("owners").doc(ownerId).set(
        {
          earnings: {
            totalEarnings: admin.firestore.FieldValue.increment(ownerAmount),
            pendingPayout: admin.firestore.FieldValue.increment(ownerAmount),
            totalTransactions: admin.firestore.FieldValue.increment(1),
            updatedAt: timestamp,
          },
        },
        { merge: true }
      );
    } else {
      console.warn(`[payments] No ownerId for booking ${bookingId}; skipping owner earnings update`);
    }

    // Update platform totals
    await db
      .collection("platform_stats")
      .doc("financials")
      .set(
        {
          totalRevenue: admin.firestore.FieldValue.increment(amount),
          platformFees: admin.firestore.FieldValue.increment(platformFee),
          ownerPayouts: admin.firestore.FieldValue.increment(ownerAmount),
          totalTransactions: admin.firestore.FieldValue.increment(1),
          updatedAt: timestamp,
        },
        { merge: true }
      );

    console.log(`✅ Payment processed: ₹${amount} (Platform: ₹${platformFee}, Owner: ₹${ownerAmount})`);
  } catch (err) {
    console.error("Process payment error:", err);
  }
}

/** (unchanged helpers) */
async function webhookHandler(req, res) {
  try {
    const event = req.body;
    const { type, data } = event;

    console.log("Received dummy webhook:", type, data);

    switch (type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(data.object);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailure(data.object);
        break;
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return res.json({ success: true, received: true, processed: type });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "Webhook processing failed", details: err.message });
  }
}

async function getPaymentDetails(req, res) {
  try {
    const { paymentIntentId } = req.params;
    const paymentSnap = await db.collection("payments").doc(paymentIntentId).get();
    if (!paymentSnap.exists) return res.status(404).json({ error: "Payment not found" });

    const payment = paymentSnap.data();
    return res.json({
      success: true,
      payment: {
        id: paymentIntentId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        breakdown: payment.breakdown,
        customer: payment.customer,
        createdAt: payment.createdAt,
        demoMode: true,
      },
    });
  } catch (err) {
    console.error("Get payment details error:", err);
    return res.status(500).json({ error: "Failed to get payment details", details: err.message });
  }
}

async function listPayments(req, res) {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let query = db.collection("payments");
    if (status) query = query.where("status", "==", status);
    query = query.orderBy("createdAt", "desc").limit(Number(limit)).offset(Number(offset));
    const snap = await query.get();
    const payments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, payments, count: payments.length, demoMode: true });
  } catch (err) {
    console.error("List payments error:", err);
    return res.status(500).json({ error: "Failed to list payments", details: err.message });
  }
}

async function simulate3DS(req, res) {
  try {
    const { paymentIntentId } = req.params;
    await new Promise((r) => setTimeout(r, 3000));
    const paymentRef = db.collection("payments").doc(paymentIntentId);
    await paymentRef.update({
      status: "succeeded",
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      "3dsCompleted": true,
    });
    const payment = (await paymentRef.get()).data();
    await processSuccessfulPayment(payment, paymentIntentId);
    return res.json({ success: true, message: "3DS Authentication completed", status: "succeeded", demoMode: true });
  } catch (err) {
    console.error("3DS simulation error:", err);
    return res.status(500).json({ error: "3DS authentication failed", details: err.message });
  }
}

async function handlePaymentSuccess(obj) {
  console.log("Payment succeeded:", obj.id);
}
async function handlePaymentFailure(obj) {
  console.log("Payment failed:", obj.id);
}

module.exports = {
  createPaymentIntent,
  confirmPayment,
  webhookHandler,
  getPaymentDetails,
  listPayments,
  simulate3DS,
};
