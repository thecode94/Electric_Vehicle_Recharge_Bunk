// src/utils/firebase.jsx
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";

// ---- Config from Vite env ----
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,                 // needed for analytics
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, // optional
};

// ---- Singleton app/auth ----
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Persist auth across reloads (ignore errors in SSR/dev)
setPersistence(auth, browserLocalPersistence).catch(() => { });

// ---- Optional analytics (guarded) ----
let _analytics = null;
analyticsSupported().then((ok) => {
    const hasAnalyticsConfig = !!(firebaseConfig.appId && firebaseConfig.measurementId);
    if (ok && hasAnalyticsConfig) {
        try { _analytics = getAnalytics(app); } catch { }
    }
});
export const analytics = _analytics;
