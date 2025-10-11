// backend/src/middleware/validation.js
const validator = require('validator');

/**
 * ======================
 * VALIDATION MIDDLEWARE SYSTEM
 * ======================
 */

/**
 * Generic validation middleware factory
 * @param {Object} rules - Validation rules for request fields
 * @param {string} source - Where to get data from ('body', 'query', 'params')
 */
function validate(rules, source = 'body') {
    return (req, res, next) => {
        const data = req[source] || {};
        const errors = [];
        const sanitized = {};

        // Process each field rule
        for (const [field, fieldRules] of Object.entries(rules)) {
            const value = data[field];
            const fieldErrors = [];

            // Required field check
            if (fieldRules.required && (value === undefined || value === null || value === '')) {
                fieldErrors.push(`${field} is required`);
                continue;
            }

            // Skip validation if field is optional and empty
            if (!fieldRules.required && (value === undefined || value === null || value === '')) {
                continue;
            }

            // Type validation
            if (fieldRules.type) {
                switch (fieldRules.type) {
                    case 'string':
                        if (typeof value !== 'string') {
                            fieldErrors.push(`${field} must be a string`);
                        } else {
                            sanitized[field] = value.trim();
                        }
                        break;
                    case 'number':
                        const numValue = Number(value);
                        if (isNaN(numValue)) {
                            fieldErrors.push(`${field} must be a number`);
                        } else {
                            sanitized[field] = numValue;
                        }
                        break;
                    case 'boolean':
                        if (typeof value === 'string') {
                            sanitized[field] = value.toLowerCase() === 'true';
                        } else if (typeof value === 'boolean') {
                            sanitized[field] = value;
                        } else {
                            fieldErrors.push(`${field} must be a boolean`);
                        }
                        break;
                    case 'email':
                        if (!validator.isEmail(String(value))) {
                            fieldErrors.push(`${field} must be a valid email`);
                        } else {
                            sanitized[field] = String(value).toLowerCase().trim();
                        }
                        break;
                    case 'array':
                        if (!Array.isArray(value)) {
                            fieldErrors.push(`${field} must be an array`);
                        } else {
                            sanitized[field] = value;
                        }
                        break;
                    case 'object':
                        if (typeof value !== 'object' || Array.isArray(value)) {
                            fieldErrors.push(`${field} must be an object`);
                        } else {
                            sanitized[field] = value;
                        }
                        break;
                    case 'date':
                        const dateValue = new Date(value);
                        if (isNaN(dateValue.getTime())) {
                            fieldErrors.push(`${field} must be a valid date`);
                        } else {
                            sanitized[field] = dateValue;
                        }
                        break;
                }
            }

            // Length validation
            if (fieldRules.minLength && String(value).length < fieldRules.minLength) {
                fieldErrors.push(`${field} must be at least ${fieldRules.minLength} characters`);
            }
            if (fieldRules.maxLength && String(value).length > fieldRules.maxLength) {
                fieldErrors.push(`${field} must be no more than ${fieldRules.maxLength} characters`);
            }

            // Number range validation
            if (fieldRules.min !== undefined && Number(value) < fieldRules.min) {
                fieldErrors.push(`${field} must be at least ${fieldRules.min}`);
            }
            if (fieldRules.max !== undefined && Number(value) > fieldRules.max) {
                fieldErrors.push(`${field} must be no more than ${fieldRules.max}`);
            }

            // Pattern validation
            if (fieldRules.pattern && !fieldRules.pattern.test(String(value))) {
                fieldErrors.push(`${field} format is invalid`);
            }

            // Custom validation
            if (fieldRules.custom && typeof fieldRules.custom === 'function') {
                const customResult = fieldRules.custom(value, data);
                if (customResult !== true) {
                    fieldErrors.push(customResult || `${field} is invalid`);
                }
            }

            // In validation
            if (fieldRules.in && !fieldRules.in.includes(value)) {
                fieldErrors.push(`${field} must be one of: ${fieldRules.in.join(', ')}`);
            }

            // Add field errors to main errors array
            errors.push(...fieldErrors);
        }

        // Return validation errors
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors,
                requestId: req.requestId
            });
        }

        // Attach sanitized data to request
        req.sanitized = sanitized;
        next();
    };
}

/**
 * ======================
 * PREDEFINED VALIDATION RULES
 * ======================
 */

// User Registration Validation
const validateUserRegistration = validate({
    email: {
        required: true,
        type: 'email'
    },
    password: {
        required: true,
        type: 'string',
        minLength: 6,
        maxLength: 128
    },
    name: {
        required: true,
        type: 'string',
        minLength: 2,
        maxLength: 100
    },
    phone: {
        required: false,
        type: 'string',
        pattern: /^[\+]?[1-9][\d]{0,15}$/
    }
});

// User Login Validation
const validateUserLogin = validate({
    email: {
        required: true,
        type: 'email'
    },
    password: {
        required: true,
        type: 'string',
        minLength: 1
    }
});

// Station Creation Validation
const validateStationCreation = validate({
    name: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 100
    },
    address: {
        required: false,
        type: 'string',
        maxLength: 500
    },
    location: {
        required: false,
        type: 'object',
        custom: (value) => {
            if (value && (typeof value.lat !== 'number' || typeof value.lng !== 'number')) {
                return 'Location must have valid lat and lng coordinates';
            }
            return true;
        }
    },
    pricing: {
        required: false,
        type: 'object',
        custom: (value) => {
            if (value && typeof value.perKwh !== 'number') {
                return 'Pricing must include valid perKwh rate';
            }
            return true;
        }
    },
    connectors: {
        required: false,
        type: 'array'
    },
    operatingHours: {
        required: false,
        type: 'string',
        maxLength: 100
    }
});

// Booking Creation Validation
const validateBookingCreation = validate({
    stationId: {
        required: true,
        type: 'string',
        minLength: 1
    },
    startTime: {
        required: true,
        type: 'date'
    },
    endTime: {
        required: true,
        type: 'date',
        custom: (value, data) => {
            if (new Date(value) <= new Date(data.startTime)) {
                return 'End time must be after start time';
            }
            return true;
        }
    },
    connectorType: {
        required: false,
        type: 'string',
        in: ['Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla']
    }
});

// Payment Creation Validation
const validatePaymentCreation = validate({
    bookingId: {
        required: true,
        type: 'string',
        minLength: 1
    },
    amount: {
        required: true,
        type: 'number',
        min: 0.01,
        max: 10000
    },
    currency: {
        required: false,
        type: 'string',
        in: ['INR', 'USD', 'EUR'],
        custom: (value) => value ? value.toUpperCase() : 'INR'
    },
    paymentMethod: {
        required: false,
        type: 'string',
        in: ['card', 'upi', 'wallet', 'netbanking']
    }
});

// Profile Update Validation
const validateProfileUpdate = validate({
    name: {
        required: false,
        type: 'string',
        minLength: 2,
        maxLength: 100
    },
    phone: {
        required: false,
        type: 'string',
        pattern: /^[\+]?[1-9][\d]{0,15}$/
    },
    avatar: {
        required: false,
        type: 'string',
        custom: (value) => {
            if (value && !validator.isURL(value)) {
                return 'Avatar must be a valid URL';
            }
            return true;
        }
    },
    preferences: {
        required: false,
        type: 'object'
    }
});

// Admin Login Validation
const validateAdminLogin = validate({
    email: {
        required: true,
        type: 'email'
    },
    password: {
        required: true,
        type: 'string',
        minLength: 1
    },
    rememberMe: {
        required: false,
        type: 'boolean'
    }
});

// Query Parameter Validation
const validatePagination = validate({
    limit: {
        required: false,
        type: 'number',
        min: 1,
        max: 100
    },
    offset: {
        required: false,
        type: 'number',
        min: 0
    },
    page: {
        required: false,
        type: 'number',
        min: 1
    }
}, 'query');

// Geospatial Query Validation
const validateGeospatialQuery = validate({
    lat: {
        required: false,
        type: 'number',
        min: -90,
        max: 90
    },
    lng: {
        required: false,
        type: 'number',
        min: -180,
        max: 180
    },
    radius: {
        required: false,
        type: 'number',
        min: 100,
        max: 50000
    },
    q: {
        required: false,
        type: 'string',
        maxLength: 200
    }
}, 'query');

/**
 * ======================
 * CUSTOM VALIDATORS
 * ======================
 */

// Validate Indian phone number
const validateIndianPhone = (phone) => {
    const phoneRegex = /^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/;
    return phoneRegex.test(phone);
};

// Validate coordinates
const validateCoordinates = (lat, lng) => {
    return Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180;
};

// Validate time range
const validateTimeRange = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    return start.getTime() > now.getTime() &&
        end.getTime() > start.getTime() &&
        (end.getTime() - start.getTime()) <= 24 * 60 * 60 * 1000; // Max 24 hours
};

// Validate price range
const validatePriceRange = (price) => {
    return typeof price === 'number' && price > 0 && price <= 1000;
};

/**
 * ======================
 * SANITIZATION HELPERS
 * ======================
 */

// Sanitize string input
const sanitizeString = (str, maxLength = 1000) => {
    if (typeof str !== 'string') return '';
    return validator.escape(str.trim()).substring(0, maxLength);
};

// Sanitize HTML content
const sanitizeHtml = (html) => {
    if (typeof html !== 'string') return '';
    return validator.escape(html.trim());
};

// Sanitize email
const sanitizeEmail = (email) => {
    if (typeof email !== 'string') return '';
    return validator.normalizeEmail(email.trim());
};

/**
 * ======================
 * ERROR HANDLERS
 * ======================
 */

// Handle validation errors consistently
const handleValidationError = (errors, req, res) => {
    return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: Array.isArray(errors) ? errors : [errors],
        requestId: req.requestId,
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    // Core validation function
    validate,

    // Predefined validators
    validateUserRegistration,
    validateUserLogin,
    validateStationCreation,
    validateBookingCreation,
    validatePaymentCreation,
    validateProfileUpdate,
    validateAdminLogin,
    validatePagination,
    validateGeospatialQuery,

    // Custom validators
    validateIndianPhone,
    validateCoordinates,
    validateTimeRange,
    validatePriceRange,

    // Sanitization helpers
    sanitizeString,
    sanitizeHtml,
    sanitizeEmail,

    // Error handlers
    handleValidationError
};
