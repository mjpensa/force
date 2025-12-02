/**
 * Input Validation Utilities
 *
 * Provides validation functions for API endpoints and data processing.
 */

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

export default {
  isPositiveInteger,
  isValidArrayIndex,
  validateSchema
};
