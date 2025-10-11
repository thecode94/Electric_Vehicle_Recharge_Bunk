// backend/src/middleware/errorHandler.js
const logger = require('../config/logger');

/**
 * Global Error Handler Middleware
 * This middleware catches all unhandled errors from routes and other middleware
 * Must be placed AFTER all routes in server.js to work properly
 */
function errorHandler(err, req, res, next) {
  // Prepare comprehensive error log data for debugging
  const logData = {
    error: err.message,           // Error message
    stack: err.stack,             // Full stack trace for debugging
    url: req.originalUrl,         // The requested URL that caused error
    method: req.method,           // HTTP method (GET, POST, etc.)
    ip: req.ip,                   // Client IP address
    userAgent: req.get('User-Agent'), // Client browser/app info
    requestId: req.requestId,     // Unique request ID for tracing
    timestamp: new Date().toISOString() // When the error occurred
  };

  // Log error using Winston logger if available, fallback to console
  if (logger && typeof logger.error === 'function') {
    logger.error('Global error handler:', logData);
  } else {
    console.error('Global error handler:', logData);
  }

  // Handle Mongoose/MongoDB validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.message,
      requestId: req.requestId
    });
  }

  // Handle JWT and authentication errors
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      requestId: req.requestId
    });
  }

  // Handle JWT token expiration specifically
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token Expired',
      message: 'Your session has expired. Please login again.',
      requestId: req.requestId
    });
  }

  // Handle CSRF token validation errors
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
      requestId: req.requestId
    });
  }

  // Handle Cross-Origin Resource Sharing policy violations
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      message: err.message,
      requestId: req.requestId
    });
  }

  // Handle Firebase Firestore database errors
  if (err.code && err.code.includes('firestore/')) {
    return res.status(500).json({
      success: false,
      error: 'Database Error',
      // Hide sensitive database details in production
      message: process.env.NODE_ENV === 'production' ? 'Database operation failed' : err.message,
      requestId: req.requestId
    });
  }

  // Handle rate limiting errors from express-rate-limit
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: err.retryAfter || 900, // When client can retry (seconds)
      requestId: req.requestId
    });
  }

  // Default error handler for all unhandled error types
  const statusCode = err.status || err.statusCode || 500; // Use error status or default to 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'  // Generic message for production security
    : err.message;             // Detailed message for development

  res.status(statusCode).json({
    success: false,
    error: message,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    // Include stack trace and error details only in development
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
}

module.exports = errorHandler;
