// backend/src/config/firebase.js

const admin = require("firebase-admin");
const logger = require("./logger");

let firebaseApp;
let db;
let auth; // Added auth service
let bucket;

try {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  const initOptions = {};

  if (serviceAccountEnv) {
    // Parse JSON string if passed as env var
    const serviceAccount = typeof serviceAccountEnv === "string"
      ? JSON.parse(serviceAccountEnv)
      : serviceAccountEnv;

    // Ensure private key newlines are correct
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }

    initOptions.credential = admin.credential.cert(serviceAccount);
  } else if (projectId && clientEmail && privateKey) {
    // Handle raw env vars
    privateKey = privateKey.replace(/\\n/g, "\n");
    initOptions.credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  } else {
    // Fallback to ADC (Application Default Credentials)
    initOptions.credential = admin.credential.applicationDefault();
  }

  if (storageBucket) {
    initOptions.storageBucket = storageBucket;
  }

  // Initialize only once
  if (!admin.apps.length) {
    firebaseApp = admin.initializeApp(initOptions);
  } else {
    firebaseApp = admin.app();
  }

  // Initialize Firebase services
  db = admin.firestore();
  auth = admin.auth(); // Initialize auth service

  if (initOptions.storageBucket) {
    bucket = admin.storage().bucket();
  }

  logger.info("✅ Firebase Admin initialized", {
    projectId: projectId || 'default',
    storageBucket: initOptions.storageBucket || null,
    hasAuth: !!auth,
    hasDb: !!db
  });

} catch (err) {
  logger.error("❌ Firebase Admin init failed", { error: err.message });
  // Don't exit process, let the app handle the error gracefully
  process.exit(1);
}

// Verify that auth service is properly initialized
if (!auth || typeof auth.verifyIdToken !== 'function') {
  logger.error("❌ Firebase Auth service not properly initialized");
  throw new Error('Firebase Auth service initialization failed');
}

// Export all Firebase services including auth
module.exports = {
  admin,
  db,
  auth,  // Now properly exported
  bucket,
  firebaseApp
};
