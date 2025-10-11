// backend/src/config/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log format for files (structured)
const fileFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
);

// Define log format for console (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: {
    service: 'ev-charging-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file - only error level
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat
    }),

    // Combined log file - all levels
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat
    }),

    // Admin actions log file - for audit trail
    new winston.transports.File({
      filename: path.join(logDir, 'admin.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: fileFormat
    })
  ],

  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Add production-specific transports
if (process.env.NODE_ENV === 'production') {
  // Only show warnings and errors in production console
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'warn'
  }));
}

// Custom logging methods for specific use cases
logger.admin = (action, metadata = {}) => {
  logger.info(`ADMIN_ACTION: ${action}`, {
    type: 'admin_action',
    action,
    ...metadata
  });
};

logger.payment = (action, metadata = {}) => {
  logger.info(`PAYMENT: ${action}`, {
    type: 'payment',
    action,
    ...metadata
  });
};

logger.station = (action, metadata = {}) => {
  logger.info(`STATION: ${action}`, {
    type: 'station',
    action,
    ...metadata
  });
};

logger.auth = (action, metadata = {}) => {
  logger.info(`AUTH: ${action}`, {
    type: 'authentication',
    action,
    ...metadata
  });
};

// Create a stream object for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim(), { type: 'http' });
  }
};

// Log initialization
logger.info('🚀 Logger initialized', {
  level: process.env.LOG_LEVEL || 'info',
  environment: process.env.NODE_ENV || 'development',
  logDirectory: logDir
});

module.exports = logger;
