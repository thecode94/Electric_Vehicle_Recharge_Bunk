// backend/src/controllers/bookingController.js
const adminConfig = require("../config/firebase");
const admin = adminConfig.admin || adminConfig;
const db = adminConfig.db || (admin.firestore && admin.firestore());

/* ---------------- utils ---------------- */
const toDate = (x) => (x?.toDate ? x.toDate() : new Date(x));
const isIndexError = (err) => err && (err.code === 9 || /FAILED_PRECONDITION/i.test(String(err)));
const toISO = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

/* Validate minimal fields for creation */
function requireFields(body, fields = []) {
    for (const f of fields) {
        if (body[f] === undefined || body[f] === null || body[f] === "") {
            return f;
        }
    }
    return null;
}

/* ---------------- create booking ---------------- */
exports.createBooking = async (req, res) => {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ error: "unauthenticated" });

        // required
        const missing = requireFields(req.body, ["stationId", "startTime", "durationMins"]);
        if (missing) return res.status(400).json({ error: `${missing} is required` });

        const { stationId, startTime, durationMins, vehicleType } = req.body;

        // Derive ownerId from stations/ or ev_bunks/
        let ownerId = null;
        let stationRef = db.collection("stations").doc(String(stationId));
        let stationSnap = await stationRef.get().catch(() => null);

        if (!stationSnap?.exists) {
            stationRef = db.collection("ev_bunks").doc(String(stationId));
            stationSnap = await stationRef.get().catch(() => null);
        }
        const station = stationSnap?.exists ? stationSnap.data() : null;
        ownerId = station?.ownerId || station?.createdBy || station?.ownerUID || null;

        const now = admin.firestore.FieldValue.serverTimestamp();
        const ref = db.collection("bookings").doc(); // auto-id

        const amount = Number(req.body.amount ?? 0);
        const totalAmount = Number(req.body.totalAmount ?? amount);

        const bookingDoc = {
            id: ref.id,
            userId: uid,
            ...(ownerId && { ownerId }),
            stationId: String(stationId),
            startTime: toISO(startTime),
            durationMins: Number(durationMins),
            vehicleType: vehicleType || null,

            status: "pending_payment",
            paymentStatus: "requires_payment_method",

            amount,
            totalAmount,

            createdAt: now,
            updatedAt: now,
        };

        await ref.set(bookingDoc);

        return res.status(201).json({ ok: true, booking: { ...bookingDoc, id: ref.id } });
    } catch (err) {
        console.error("Create booking error:", err);
        return res.status(500).json({ error: err.message || "Failed to create booking" });
    }
};

/* ---------------- get single booking ---------------- */
exports.getBooking = async (req, res) => {
    try {
        const id = req.params.id;
        const snap = await db.collection("bookings").doc(id).get();
        if (!snap.exists) return res.status(404).json({ error: "booking not found" });
        return res.json({ booking: { id: snap.id, ...snap.data() } });
    } catch (err) {
        console.error("Get booking error:", err);
        return res.status(500).json({ error: "Failed to fetch booking" });
    }
};

/* ---------------- list bookings for current user ---------------- */
exports.listMyBookings = async (req, res) => {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ error: "unauthenticated" });

        const limit = Number(req.query.limit ?? 20);
        const startAfterId = req.query.startAfter || null;
        const order = (req.query.order || "desc").toLowerCase() === "asc" ? "asc" : "desc";

        let q = db.collection("bookings").where("userId", "==", uid).orderBy("createdAt", order).limit(limit);

        // startAfter pagination (by snapshot)
        if (startAfterId) {
            const sa = await db.collection("bookings").doc(startAfterId).get();
            if (sa.exists) q = q.startAfter(sa);
        }

        let docs;
        try {
            const snap = await q.get();
            docs = snap.docs;
        } catch (err) {
            if (!isIndexError(err)) throw err;
            // Fallback without orderBy (then sort in memory)
            const snap = await db.collection("bookings").where("userId", "==", uid).get();
            docs = snap.docs
                .sort((a, b) => {
                    const ad = toDate(a.data().createdAt)?.getTime() || 0;
                    const bd = toDate(b.data().createdAt)?.getTime() || 0;
                    return order === "asc" ? ad - bd : bd - ad;
                })
                .slice(0, limit);
        }

        const items = docs.map((d) => ({ id: d.id, ...d.data() }));
        return res.json({ items, count: items.length });
    } catch (err) {
        console.error("List my bookings error:", err);
        return res.status(500).json({ error: "Failed to fetch bookings" });
    }
};

/* ---------------- list bookings for current owner ---------------- */
exports.listOwnerBookings = async (req, res) => {
    try {
        const ownerId = req.user?.uid;
        if (!ownerId) return res.status(401).json({ error: "unauthenticated" });

        const limit = Number(req.query.limit ?? 20);
        const startAfterId = req.query.startAfter || null;
        const order = (req.query.order || "desc").toLowerCase() === "asc" ? "asc" : "desc";

        let q = db.collection("bookings").where("ownerId", "==", ownerId).orderBy("createdAt", order).limit(limit);

        if (startAfterId) {
            const sa = await db.collection("bookings").doc(startAfterId).get();
            if (sa.exists) q = q.startAfter(sa);
        }

        let docs;
        try {
            const snap = await q.get();
            docs = snap.docs;
        } catch (err) {
            if (!isIndexError(err)) throw err;
            // Fallback: filter + sort in memory
            const snap = await db.collection("bookings").where("ownerId", "==", ownerId).get();
            docs = snap.docs
                .sort((a, b) => {
                    const ad = toDate(a.data().createdAt)?.getTime() || 0;
                    const bd = toDate(b.data().createdAt)?.getTime() || 0;
                    return order === "asc" ? ad - bd : bd - ad;
                })
                .slice(0, limit);
        }

        const items = docs.map((d) => ({ id: d.id, ...d.data() }));
        return res.json({ items, count: items.length });
    } catch (err) {
        console.error("List owner bookings error:", err);
        return res.status(500).json({ error: "Failed to fetch bookings" });
    }
};

/* ---------------- cancel booking (user or owner) ---------------- */
exports.cancelBooking = async (req, res) => {
    try {
        const id = req.params.id;
        const snap = await db.collection("bookings").doc(id).get();
        if (!snap.exists) return res.status(404).json({ error: "booking not found" });

        const b = snap.data();
        // allow user who owns booking or owner who owns station
        const isUser = req.user?.uid && b.userId === req.user.uid;
        const isOwner = req.user?.uid && b.ownerId === req.user.uid;
        if (!isUser && !isOwner) return res.status(403).json({ error: "forbidden" });

        await snap.ref.update({
            status: "cancelled",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.json({ ok: true, message: "Booking cancelled" });
    } catch (err) {
        console.error("Cancel booking error:", err);
        return res.status(500).json({ error: "Failed to cancel booking" });
    }
};

/* ---------------- update booking status (owner/admin) ---------------- */
exports.updateStatus = async (req, res) => {
    try {
        const id = req.params.id;
        const { status, paymentStatus } = req.body || {};
        if (!status && !paymentStatus) return res.status(400).json({ error: "status or paymentStatus required" });

        const snap = await db.collection("bookings").doc(id).get();
        if (!snap.exists) return res.status(404).json({ error: "booking not found" });

        const b = snap.data();
        // only owner of this booking or admin can update
        const isOwner = req.user?.uid && b.ownerId === req.user.uid;
        const isAdmin = req.admin?.role === "admin" || req.user?.role === "admin";
        if (!isOwner && !isAdmin) return res.status(403).json({ error: "forbidden" });

        const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (status) patch.status = String(status);
        if (paymentStatus) patch.paymentStatus = String(paymentStatus);

        await snap.ref.update(patch);
        return res.json({ ok: true, message: "Booking updated" });
    } catch (err) {
        console.error("Update booking error:", err);
        return res.status(500).json({ error: "Failed to update booking" });
    }
};
