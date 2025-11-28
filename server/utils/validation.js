/**
 * Input Validation Utilities
 *
 * Provides comprehensive validation functions for API endpoints
 * and data processing to prevent errors and security issues.
 */

/**
 * Check if value is a non-empty string
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a positive integer (including zero)
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isPositiveInteger(value) {
  return typeof value === 'number' &&
         Number.isInteger(value) &&
         value >= 0;
}

/**
 * Check if value is a valid array index
 * @param {*} value - Index to check
 * @param {number} arrayLength - Length of the array
 * @returns {boolean}
 */
export function isValidArrayIndex(value, arrayLength) {
  return isPositiveInteger(value) && value < arrayLength;
}

/**
 * Check if value is a valid port number
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isValidPort(value) {
  const port = parseInt(value, 10);
  return !isNaN(port) && port >= 1 && port <= 65535;
}

/**
 * Check if value is a valid date
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isValidDate(value) {
  if (!value) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Sanitize a value for logging (prevent log injection)
 * @param {*} value - Value to sanitize
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
export function sanitizeForLog(value, maxLength = 100) {
  if (typeof value !== 'string') {
    value = String(value);
  }
  return value.substring(0, maxLength).replace(/[\n\r\t]/g, ' ').trim();
}

/**
 * Safely parse an integer with bounds checking
 * @param {*} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number}
 */
export function parseIntSafe(value, defaultValue, min = 0, max = Infinity) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Safely parse a float with bounds checking
 * @param {*} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number}
 */
export function parseFloatSafe(value, defaultValue, min = 0, max = Infinity) {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Validate data against a schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Validation schema
 * @returns {string[]|null} Array of errors or null if valid
 *
 * Schema format:
 * {
 *   fieldName: {
 *     required: boolean,
 *     type: 'string' | 'number' | 'boolean' | 'object' | 'array',
 *     minLength: number,
 *     maxLength: number,
 *     min: number,
 *     max: number,
 *     pattern: RegExp,
 *     validator: (value) => boolean,
 *     message: string
 *   }
 * }
 */
export function validateSchema(data, schema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data?.[field];

    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip further validation if value is not present and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type checking
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push(`${field} must be a ${rules.type}`);
        continue;
      }
    }

    // String validations
    if (rules.type === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(rules.message || `${field} format is invalid`);
      }
    }

    // Number validations
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }
      if (rules.integer && !Number.isInteger(value)) {
        errors.push(`${field} must be an integer`);
      }
    }

    // Array validations
    if (rules.type === 'array') {
      if (rules.minItems !== undefined && value.length < rules.minItems) {
        errors.push(`${field} must have at least ${rules.minItems} items`);
      }
      if (rules.maxItems !== undefined && value.length > rules.maxItems) {
        errors.push(`${field} must have at most ${rules.maxItems} items`);
      }
    }

    // Custom validator
    if (rules.validator && !rules.validator(value)) {
      errors.push(rules.message || `${field} is invalid`);
    }
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Validate session ID format
 * @param {*} sessionId - Session ID to validate
 * @returns {boolean}
 */
export function isValidSessionId(sessionId) {
  if (!isNonEmptyString(sessionId)) return false;
  // Session IDs are either UUIDs or 64-char hex strings
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hexPattern = /^[0-9a-f]{64}$/i;
  return uuidPattern.test(sessionId) || hexPattern.test(sessionId);
}

/**
 * Validate view type
 * @param {*} viewType - View type to validate
 * @returns {boolean}
 */
export function isValidViewType(viewType) {
  const validTypes = ['roadmap', 'slides', 'document', 'research-analysis'];
  return validTypes.includes(viewType);
}

// Custom Error Classes
export class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

export class RateLimitError extends Error {
  constructor(message, retryAfter = null) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
    this.retryAfter = retryAfter;
  }
}

export class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

export class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

/**
 * Standardized error response handler for routes
 * @param {Response} res - Express response object
 * @param {Error} error - Error to handle
 */
export function handleRouteError(res, error) {
  const statusCode = error.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  // Log server errors
  if (!isClientError) {
    console.error('[Route Error]', error.message, error.stack);
  }

  const response = {
    error: error.message || 'An unexpected error occurred'
  };

  if (error.details) {
    response.details = error.details;
  }

  if (error.retryAfter) {
    res.setHeader('Retry-After', error.retryAfter);
  }

  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production' && !isClientError) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
}

export default {
  isNonEmptyString,
  isPositiveInteger,
  isValidArrayIndex,
  isValidPort,
  isValidDate,
  sanitizeForLog,
  parseIntSafe,
  parseFloatSafe,
  validateSchema,
  isValidSessionId,
  isValidViewType,
  ValidationError,
  NotFoundError,
  RateLimitError,
  AuthorizationError,
  AuthenticationError,
  handleRouteError
};
