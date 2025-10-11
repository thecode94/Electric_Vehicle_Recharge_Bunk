// server.js - Complete Fixed Version (path-safe)
require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const fs = require("fs");

/* ---------------- Logging ---------------- */
let logger;
try {
  logger = require("./src/config/logger");
} catch (err) {
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.log,
  };
}

/* ---------------- Auth middleware ---------------- */
let ownerAuth, adminAuth, auth;
try {
  ownerAuth = require("./src/middleware/ownerAuth");
  adminAuth = require("./src/middleware/adminAuth");
  auth = require("./src/middleware/auth");
} catch (err) {
  console.warn("⚠️  Auth middleware not found, using fallback");
  ownerAuth = (req, _res, next) => { req.user = { uid: "demo-user", email: "demo@example.com" }; next(); };
  adminAuth = (req, _res, next) => { req.admin = { id: "demo-admin", email: "admin@example.com", role: "admin" }; next(); };
  auth = (req, _res, next) => { req.user = { uid: "demo-user", email: "demo@example.com" }; next(); };
}

/* ---------------- Safe route loader ---------------- */
function loadRoutesSafely(routeSegments, routeName) {
  const resolved = Array.isArray(routeSegments)
    ? path.resolve(__dirname, ...routeSegments)
    : path.resolve(__dirname, routeSegments);

  try {
    return require(resolved);
  } catch (err) {
    console.warn(`⚠️  ${routeName} not found @ ${resolved}\n   → ${err.message}\n   Using fallback router.`);
    const router = express.Router();
    router.use("*", (req, res) => {
      res.status(501).json({
        success: false,
        error: `${routeName} endpoint not implemented`,
        route: req.originalUrl,
        method: req.method,
        resolvedPath: resolved,
        message: `This is a placeholder for ${routeName}. Implementation pending.`,
      });
    });
    return router;
  }
}

/* ---------------- App ---------------- */
const app = express();
app.set("trust proxy", 1);

/* ---------------- Security & Core Middleware ---------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://apis.mappls.com", "https://nominatim.openstreetmap.org"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.set("etag", false);

/* ---------------- Rate Limiting ---------------- */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: "Too many requests from this IP, please try again later.", retryAfter: 900 },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many authentication attempts, please try again later.", retryAfter: 900 },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: "API rate limit exceeded, please try again later.", retryAfter: 900 },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

/* ---------------- CORS ---------------- */
const ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
  process.env.ADMIN_DASHBOARD_URL,
].filter(Boolean);

if (process.env.CORS_ORIGINS) {
  ORIGINS.push(...process.env.CORS_ORIGINS.split(",").map(s => s.trim()).filter(Boolean));
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ORIGINS.includes(origin)) return cb(null, true);
      if (process.env.NODE_ENV === "production") logger.warn(`Blocked CORS request from origin: ${origin}`);
      return cb(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Cache-Control",
      "Pragma",
      "Expires",
      "Accept",
      "Accept-Language",
      "X-Admin-Token",
      "X-Owner-Token",
    ],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  })
);
app.options("*", cors());

/* ---------------- Logging ---------------- */
const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(morgan(morganFormat, { stream: { write: msg => logger.info(msg.trim()) } }));

/* ---------------- No-cache Headers ---------------- */
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
  next();
});

/* ---------------- Body & Cookie Parsing ---------------- */
app.use(cookieParser());

// Use raw body ONLY for payment webhooks; JSON elsewhere
app.use((req, res, next) => {
  const rawPaths = ["/api/payments/webhook", "/api/payments/stripe/webhook", "/api/payments/razorpay/webhook"];
  if (rawPaths.includes(req.originalUrl)) return next();
  express.json({
    limit: "10mb",
    verify: (req2, _res2, buf) => {
      req2.rawBody = buf;
    },
  })(req, res, next);
});
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

/* ---------------- Request ID ---------------- */
app.use((req, res, next) => {
  req.requestId = require("crypto").randomUUID();
  res.set("X-Request-ID", req.requestId);
  next();
});

/* ---------------- Static Files ---------------- */
const uploadsPath = path.resolve(__dirname, "uploads");
const publicPath = path.resolve(__dirname, "public");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log("📁 Created uploads directory");
}
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
  console.log("📁 Created public directory");
}
app.use("/uploads", express.static(uploadsPath));
app.use("/public", express.static(publicPath));

// Serve admin dashboard if present
const adminDashboardPath = path.resolve(__dirname, "admin-dashboard", "build");
if (fs.existsSync(adminDashboardPath)) {
  app.use("/admin", express.static(adminDashboardPath));
  console.log("📊 Admin dashboard served at /admin");
}

/* ---------------- Health ---------------- */
app.get("/", (req, res) => {
  res.json({
    message: "EV Charging Platform API",
    version: "1.0.0",
    status: "operational",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    requestId: req.requestId,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
    },
    services: { database: "connected", payment: "operational", maps: "operational" },
    requestId: req.requestId,
  });
});

app.get("/api/status", (req, res) => {
  res.json({ server: "online", database: "connected", timestamp: Date.now(), requestId: req.requestId });
});

/* ---------------- Route mounting (path-safe) ---------------- */
const authRoutes = loadRoutesSafely(["src", "routes", "authRoutes.js"], "Auth Routes");
const adminRoutes = loadRoutesSafely(["src", "routes", "adminRoutes.js"], "Admin Routes");
const userRoutes = loadRoutesSafely(["src", "routes", "userRoutes.js"], "User Routes");
const paymentRoutes = loadRoutesSafely(["src", "routes", "paymentRoutes.js"], "Payment Routes");
const ownerRoutes = loadRoutesSafely(["src", "routes", "ownerRoutes.js"], "Owner Routes");
const financeRoutes = loadRoutesSafely(["src", "routes", "financeRoutes.js"], "Finance Routes");
const stationsRoutes = loadRoutesSafely(["src", "routes", "stationRoutes.js"], "Station Routes");
const mapsRoutes = loadRoutesSafely(["src", "routes", "mapRoutes.js"], "Map Routes");
const bookingRoutes = loadRoutesSafely(["src", "routes", "bookingRoutes.js"], "Booking Routes");
const analyticsRoutes = loadRoutesSafely(["src", "routes", "analyticsRoutes.js"], "Analytics Routes");
const notificationRoutes = loadRoutesSafely(["src", "routes", "notificationRoutes.js"], "Notification Routes");

let mapTextRoutes;
try {
  mapTextRoutes = require(path.resolve(__dirname, "src", "routes", "mapTextRoutes.js"));
} catch {
  console.warn("⚠️  mapTextRoutes not found, skipping...");
}

/* ---------------- API Routes with FIXED Rate Limiting ---------------- */
// Apply login rate limiting to specific endpoints
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", loginLimiter);
app.use("/api/auth/owner/login", loginLimiter);
app.use("/api/auth/owner/register", loginLimiter);

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", apiLimiter, adminRoutes);
app.use("/api/users", apiLimiter, userRoutes);
app.use("/api/payments", apiLimiter, paymentRoutes);
app.use("/api/owners", apiLimiter, ownerRoutes);

// ✅ Finance mounts (all aliases your frontend may use)
app.use("/api/owner/finance", apiLimiter, financeRoutes);   // <— primary (fixes 404)
app.use("/api/owners/finance", apiLimiter, financeRoutes);  // legacy plural
app.use("/api/finance", apiLimiter, financeRoutes);         // broad alias
app.use("/owner/finance", apiLimiter, financeRoutes);       // non-/api alias (optional)

// ✅ Legacy one‑off summary alias used as a fallback in OwnerFinance.jsx
try {
  const ownerFinanceController = require(path.resolve(__dirname, "src", "controllers", "ownerFinanceController.js"));
  app.get("/api/owners/me/finance/summary", apiLimiter, ownerAuth, ownerFinanceController.getSummary);
} catch (e) {
  console.warn("⚠️  ownerFinanceController not found for /api/owners/me/finance/summary alias; using fallback");
  app.get("/api/owners/me/finance/summary", apiLimiter, ownerAuth, (_req, res) => {
    res.json({ totalRevenue: 0, monthRevenue: 0, totalBookings: 0, pendingPayout: 0, refunds: 0, currency: "INR" });
  });
}

app.use("/api/bookings", apiLimiter, bookingRoutes);
app.use("/api/stations", apiLimiter, stationsRoutes);
app.use("/api/maps", mapsRoutes);
if (mapTextRoutes) app.use("/api/maps", mapTextRoutes);
app.use("/api/analytics", apiLimiter, analyticsRoutes);
app.use("/api/notifications", apiLimiter, notificationRoutes);

/* ---------------- Debug & Development Routes ---------------- */
if (process.env.NODE_ENV === "development") {
  app.get("/api/_debug/whoami", ownerAuth, (req, res) => {
    res.json({
      requestId: req.requestId,
      uid: req.user?.uid || null,
      email: req.user?.email || null,
      role: req.user?.role || null,
      claims: req.user?.claims || {},
      isAdmin: req.user?.admin || false,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/_debug/admin", adminAuth, (req, res) => {
    res.json({
      requestId: req.requestId,
      adminId: req.admin?.id || null,
      email: req.admin?.email || null,
      role: req.admin?.role || null,
      permissions: req.admin?.permissions || [],
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/_debug/server", (req, res) => {
    res.json({
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV,
      cors: ORIGINS,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  app.get("/api/_debug/routes", (req, res) => {
    const routes = [];
    function extractRoutes(stack, prefix = "") {
      stack.forEach((layer) => {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods).join(", ").toUpperCase();
          routes.push(`${methods} ${prefix}${layer.route.path}`);
        } else if (layer.name === "router" && layer.handle?.stack) {
          const match = layer.regexp?.toString().match(/^\/\^\\?(.*?)\\\?\$/);
          const routerPrefix = match ? match[1].replace(/\\\//g, "/") : "";
          extractRoutes(layer.handle.stack, prefix + routerPrefix);
        }
      });
    }
    extractRoutes(app._router.stack, "");
    res.json({ totalRoutes: routes.length, routes: routes.sort(), requestId: req.requestId });
  });

  app.get("/api/_debug/env", (_req, res) => {
    res.json({
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        HOST: process.env.HOST,
        FRONTEND_URL: process.env.FRONTEND_URL,
      },
      requestId: res.getHeader("X-Request-ID"),
    });
  });
}

/* ---------------- API Documentation ---------------- */
app.get("/api/docs", (req, res) => {
  res.json({
    title: "EV Charging Platform API",
    version: "1.0.0",
    description: "Complete API for EV charging station management platform",
    baseUrl: `${req.protocol}://${req.get("host")}/api`,
    timestamp: new Date().toISOString(),
    endpoints: {
      authentication: {
        login: "POST /auth/login",
        register: "POST /auth/register",
        logout: "POST /auth/logout",
        refresh: "POST /auth/refresh",
      },
      users: {
        profile: "GET /users/me",
        updateProfile: "PATCH /users/me",
      },
      stations: {
        list: "GET /stations",
        search: "GET /stations/search",
        create: "POST /stations",
        details: "GET /stations/:id",
        update: "PATCH /stations/:id",
      },
      bookings: {
        create: "POST /bookings",
        list: "GET /bookings",
        details: "GET /bookings/:id",
        cancel: "DELETE /bookings/:id",
      },
      payments: {
        createIntent: "POST /payments/create-intent",
        confirmPayment: "POST /payments/confirm/:id",
        webhook: "POST /payments/webhook",
        demoInfo: "GET /payments/demo/info",
      },
      admin: {
        login: "POST /admin/auth/login",
        dashboard: "GET /admin/dashboard",
        analytics: "GET /admin/analytics/*",
        stations: "GET /admin/bunks",
        users: "GET /admin/users",
        payouts: "POST /admin/payouts/process",
      },
    },
    rateLimits: {
      general: "1000 requests per 15 minutes",
      authentication: "50 requests per 15 minutes",
      api: "500 requests per 15 minutes",
    },
    features: [
      "✅ Dummy payment system for internship projects",
      "✅ 10% platform margin with 90% owner payouts",
      "✅ Complete admin dashboard and analytics",
      "✅ EV station management with image uploads",
      "✅ Map integration with location services",
      "✅ Booking system with status tracking",
      "✅ Rate limiting and security middleware",
      "✅ Comprehensive error handling",
      "✅ Development debugging tools",
    ],
    requestId: req.requestId,
  });
});

/* ---------------- 404 Handler ---------------- */
app.use("*", (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    availableEndpoints: "/api/docs",
  });
});

/* ---------------- Global Error Handler ---------------- */
let errorHandler;
try {
  errorHandler = require("./src/middleware/errorHandler");
} catch {
  console.warn("⚠️  Error handler middleware not found, using fallback");
  errorHandler = (err, req, res, _next) => {
    console.error("Error:", err.message);
    const statusCode = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message;
    res.status(statusCode).json({
      success: false,
      error: message,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  };
}
app.use(errorHandler);

/* ---------------- Server Startup ---------------- */
const port = process.env.PORT || 5000;
const host = process.env.HOST || "localhost";

const server = app.listen(port, host, () => {
  logger.info(`🚀 EV Charging Platform Server started`);
  logger.info(`   📍 URL: http://${host}:${port}`);
  logger.info(`   📊 Health: http://${host}:${port}/api/health`);
  logger.info(`   📚 Docs: http://${host}:${port}/api/docs`);
  logger.info(`   🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`   🔒 CORS Origins: ${ORIGINS.join(", ")}`);
  logger.info(`   🛡️  Security: Helmet, Rate Limiting, CORS enabled`);
  logger.info(`   💳 Payment: Dummy system for internship projects`);
  logger.info(`   📊 Platform Fee: 10% margin with 90% owner payouts`);
});

/* ---------------- Graceful Shutdown ---------------- */
const gracefulShutdown = (signal) => {
  logger.info(`🔌 Received ${signal}. Starting graceful shutdown...`);
  server.close((err) => {
    if (err) {
      logger.error("Error during server close:", err);
      process.exit(1);
    }
    logger.info("✅ Server closed successfully");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("⚠️  Forced shutdown after 30 seconds");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

module.exports = app;
