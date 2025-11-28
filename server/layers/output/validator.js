/**
 * Output Validator - PROMPT ML Layer 6
 *
 * Validates LLM outputs against expected schemas:
 * - JSON schema validation
 * - Type checking
 * - Required field verification
 * - Constraint validation
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Validation result levels
 * @readonly
 * @enum {string}
 */
export const ValidationLevel = {
  VALID: 'valid',           // Fully valid output
  WARNING: 'warning',       // Valid but with warnings
  INVALID: 'invalid',       // Invalid output
  ERROR: 'error'            // Validation error (not output error)
};

/**
 * @typedef {Object} ValidationResult
 * @property {string} level - Validation level
 * @property {boolean} valid - Whether output is usable
 * @property {string[]} errors - Validation errors
 * @property {string[]} warnings - Validation warnings
 * @property {Object} details - Detailed validation info
 */

/**
 * @typedef {Object} ValidatorConfig
 * @property {boolean} strictMode - Fail on any schema violation
 * @property {boolean} coerceTypes - Attempt type coercion
 * @property {boolean} removeExtra - Remove extra properties
 * @property {number} maxErrors - Maximum errors to collect
 */

const DEFAULT_CONFIG = {
  strictMode: false,
  coerceTypes: true,
  removeExtra: false,
  maxErrors: 10
};

/**
 * Output Validator class
 */
export class OutputValidator {
  /**
   * @param {ValidatorConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate output against a JSON schema
   *
   * @param {*} output - Output to validate
   * @param {Object} schema - JSON schema
   * @param {Object} options - Validation options
   * @returns {ValidationResult} Validation result
   */
  validate(output, schema, options = {}) {
    const errors = [];
    const warnings = [];
    const details = {
      checkedFields: 0,
      validFields: 0,
      coercedFields: 0,
      missingFields: [],
      extraFields: [],
      typeErrors: []
    };

    try {
      // Check if output is null/undefined
      if (output === null || output === undefined) {
        errors.push('Output is null or undefined');
        return this._buildResult(ValidationLevel.INVALID, errors, warnings, details);
      }

      // Check root type
      if (schema.type && !this._checkType(output, schema.type)) {
        errors.push(`Expected ${schema.type}, got ${typeof output}`);
        return this._buildResult(ValidationLevel.INVALID, errors, warnings, details);
      }

      // Validate based on schema type
      if (schema.type === 'object') {
        this._validateObject(output, schema, '', errors, warnings, details);
      } else if (schema.type === 'array') {
        this._validateArray(output, schema, '', errors, warnings, details);
      }

      // Determine validation level
      let level = ValidationLevel.VALID;
      if (errors.length > 0) {
        level = this.config.strictMode ? ValidationLevel.INVALID : ValidationLevel.WARNING;
      } else if (warnings.length > 0) {
        level = ValidationLevel.WARNING;
      }

      return this._buildResult(level, errors, warnings, details);

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return this._buildResult(ValidationLevel.ERROR, errors, warnings, details);
    }
  }

  /**
   * Validate and repair output
   *
   * @param {*} output - Output to validate
   * @param {Object} schema - JSON schema
   * @param {Object} options - Validation options
   * @returns {Object} {result: ValidationResult, repaired: boolean, output: *}
   */
  validateAndRepair(output, schema, options = {}) {
    const result = this.validate(output, schema, options);

    if (result.level === ValidationLevel.VALID) {
      return { result, repaired: false, output };
    }

    // Attempt repairs
    let repaired = false;
    let repairedOutput = JSON.parse(JSON.stringify(output)); // Deep clone

    // Repair missing required fields with defaults
    if (result.details.missingFields.length > 0 && schema.properties) {
      for (const field of result.details.missingFields) {
        const fieldSchema = schema.properties[field];
        if (fieldSchema) {
          const defaultValue = this._getDefaultForType(fieldSchema);
          if (defaultValue !== undefined) {
            repairedOutput[field] = defaultValue;
            repaired = true;
          }
        }
      }
    }

    // Re-validate after repairs
    if (repaired) {
      const newResult = this.validate(repairedOutput, schema, options);
      return { result: newResult, repaired: true, output: repairedOutput };
    }

    return { result, repaired: false, output };
  }

  /**
   * Quick check if output matches expected structure
   *
   * @param {*} output - Output to check
   * @param {string[]} requiredFields - Required top-level fields
   * @returns {boolean} Whether output has required structure
   */
  hasRequiredStructure(output, requiredFields) {
    if (!output || typeof output !== 'object') {
      return false;
    }

    for (const field of requiredFields) {
      if (!(field in output)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate specific output type
   *
   * @param {string} outputType - Type (roadmap, slides, document, research-analysis)
   * @param {*} output - Output to validate
   * @returns {ValidationResult} Validation result
   */
  validateByType(outputType, output) {
    const schema = this._getSchemaForType(outputType);
    if (!schema) {
      return this._buildResult(
        ValidationLevel.ERROR,
        [`Unknown output type: ${outputType}`],
        [],
        {}
      );
    }

    return this.validate(output, schema);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate an object against schema
   * @private
   */
  _validateObject(obj, schema, path, errors, warnings, details) {
    const properties = schema.properties || {};
    const required = schema.required || [];

    // Check required fields
    for (const field of required) {
      details.checkedFields++;
      if (!(field in obj)) {
        details.missingFields.push(path ? `${path}.${field}` : field);
        errors.push(`Missing required field: ${path ? `${path}.${field}` : field}`);
      } else {
        details.validFields++;
      }
    }

    // Validate each property
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const fieldSchema = properties[key];

      if (!fieldSchema) {
        // Extra field
        details.extraFields.push(fieldPath);
        if (this.config.strictMode) {
          warnings.push(`Extra field: ${fieldPath}`);
        }
        continue;
      }

      details.checkedFields++;

      // Type check
      if (fieldSchema.type && !this._checkType(value, fieldSchema.type)) {
        // Attempt coercion
        if (this.config.coerceTypes) {
          const coerced = this._coerceType(value, fieldSchema.type);
          if (coerced.success) {
            obj[key] = coerced.value;
            details.coercedFields++;
            details.validFields++;
            continue;
          }
        }

        details.typeErrors.push({
          path: fieldPath,
          expected: fieldSchema.type,
          actual: typeof value
        });
        errors.push(`Type error at ${fieldPath}: expected ${fieldSchema.type}, got ${typeof value}`);
        continue;
      }

      details.validFields++;

      // Recursive validation for nested objects/arrays
      if (fieldSchema.type === 'object' && value !== null) {
        this._validateObject(value, fieldSchema, fieldPath, errors, warnings, details);
      } else if (fieldSchema.type === 'array' && Array.isArray(value)) {
        this._validateArray(value, fieldSchema, fieldPath, errors, warnings, details);
      }

      // Check constraints
      this._validateConstraints(value, fieldSchema, fieldPath, errors, warnings);
    }

    // Stop if too many errors
    if (errors.length >= this.config.maxErrors) {
      errors.push('... (max errors reached)');
    }
  }

  /**
   * Validate an array against schema
   * @private
   */
  _validateArray(arr, schema, path, errors, warnings, details) {
    const itemSchema = schema.items;

    // Check array constraints
    if (schema.minItems && arr.length < schema.minItems) {
      errors.push(`Array at ${path} has ${arr.length} items, minimum is ${schema.minItems}`);
    }
    if (schema.maxItems && arr.length > schema.maxItems) {
      warnings.push(`Array at ${path} has ${arr.length} items, maximum is ${schema.maxItems}`);
    }

    // Validate items if schema provided
    if (itemSchema) {
      for (let i = 0; i < arr.length; i++) {
        const itemPath = `${path}[${i}]`;
        const item = arr[i];

        if (itemSchema.type && !this._checkType(item, itemSchema.type)) {
          errors.push(`Type error at ${itemPath}: expected ${itemSchema.type}, got ${typeof item}`);
          continue;
        }

        if (itemSchema.type === 'object' && item !== null) {
          this._validateObject(item, itemSchema, itemPath, errors, warnings, details);
        }
      }
    }
  }

  /**
   * Validate value constraints
   * @private
   */
  _validateConstraints(value, schema, path, errors, warnings) {
    // String constraints
    if (typeof value === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        warnings.push(`${path} is shorter than minimum length ${schema.minLength}`);
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        warnings.push(`${path} exceeds maximum length ${schema.maxLength}`);
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
      }
    }

    // Number constraints
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path} is below minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path} exceeds maximum ${schema.maximum}`);
      }
    }
  }

  /**
   * Check if value matches expected type
   * @private
   */
  _checkType(value, expectedType) {
    if (expectedType === 'array') {
      return Array.isArray(value);
    }
    if (expectedType === 'object') {
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
    if (expectedType === 'integer') {
      return typeof value === 'number' && Number.isInteger(value);
    }
    return typeof value === expectedType;
  }

  /**
   * Attempt to coerce value to expected type
   * @private
   */
  _coerceType(value, targetType) {
    try {
      switch (targetType) {
        case 'string':
          return { success: true, value: String(value) };

        case 'number':
          const num = Number(value);
          if (!isNaN(num)) {
            return { success: true, value: num };
          }
          break;

        case 'integer':
          const int = parseInt(value, 10);
          if (!isNaN(int)) {
            return { success: true, value: int };
          }
          break;

        case 'boolean':
          if (value === 'true' || value === 1) return { success: true, value: true };
          if (value === 'false' || value === 0) return { success: true, value: false };
          break;

        case 'array':
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                return { success: true, value: parsed };
              }
            } catch {
              // Not valid JSON array
            }
          }
          break;
      }
    } catch {
      // Coercion failed
    }

    return { success: false };
  }

  /**
   * Get default value for a schema type
   * @private
   */
  _getDefaultForType(schema) {
    if (schema.default !== undefined) {
      return schema.default;
    }

    switch (schema.type) {
      case 'string': return '';
      case 'number': return 0;
      case 'integer': return 0;
      case 'boolean': return false;
      case 'array': return [];
      case 'object': return {};
      default: return undefined;
    }
  }

  /**
   * Get schema for output type
   * @private
   */
  _getSchemaForType(outputType) {
    // Import schemas lazily to avoid circular dependencies
    const schemas = {
      roadmap: {
        type: 'object',
        required: ['title', 'timeColumns', 'data', 'legend', 'researchAnalysis'],
        properties: {
          title: { type: 'string' },
          timeColumns: { type: 'array', items: { type: 'string' } },
          data: { type: 'array' },
          legend: { type: 'array' },
          researchAnalysis: { type: 'object' }
        }
      },
      slides: {
        type: 'object',
        required: ['title', 'slides'],
        properties: {
          title: { type: 'string' },
          slides: { type: 'array', minItems: 1 }
        }
      },
      document: {
        type: 'object',
        required: ['title', 'sections'],
        properties: {
          title: { type: 'string' },
          sections: { type: 'array', minItems: 1 }
        }
      },
      'research-analysis': {
        type: 'object',
        required: ['title', 'overallScore', 'overallRating', 'themes', 'dataCompleteness', 'ganttReadiness'],
        properties: {
          title: { type: 'string' },
          overallScore: { type: 'number', minimum: 1, maximum: 10 },
          overallRating: { type: 'string' },
          themes: { type: 'array' },
          dataCompleteness: { type: 'object' },
          ganttReadiness: { type: 'object' }
        }
      }
    };

    return schemas[outputType] || null;
  }

  /**
   * Build validation result
   * @private
   */
  _buildResult(level, errors, warnings, details) {
    return {
      level,
      valid: level === ValidationLevel.VALID || level === ValidationLevel.WARNING,
      errors: errors.slice(0, this.config.maxErrors),
      warnings: warnings.slice(0, this.config.maxErrors),
      details
    };
  }
}

/**
 * Create an output validator
 * @param {ValidatorConfig} config - Configuration
 * @returns {OutputValidator}
 */
export function createValidator(config = {}) {
  return new OutputValidator(config);
}

// Singleton instance
let _instance = null;

/**
 * Get singleton validator
 * @param {ValidatorConfig} config - Configuration (first call only)
 * @returns {OutputValidator}
 */
export function getValidator(config = {}) {
  if (!_instance) {
    _instance = new OutputValidator(config);
  }
  return _instance;
}

/**
 * Quick validate function
 * @param {*} output - Output to validate
 * @param {Object} schema - JSON schema
 * @returns {ValidationResult}
 */
export function validateOutput(output, schema) {
  return getValidator().validate(output, schema);
}

/**
 * Validate by output type
 * @param {string} outputType - Output type
 * @param {*} output - Output to validate
 * @returns {ValidationResult}
 */
export function validateByType(outputType, output) {
  return getValidator().validateByType(outputType, output);
}

export default OutputValidator;
