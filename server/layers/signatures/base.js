/**
 * DSPy-Style Signature Base - PROMPT ML Layer 3
 *
 * Implements a structured signature system inspired by DSPy:
 * - Declarative input/output field definitions
 * - Automatic prompt generation from signatures
 * - Type validation and constraints
 * - Few-shot example support
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Field types for signature definitions
 * @readonly
 * @enum {string}
 */
export const FieldType = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  OBJECT: 'object',
  JSON: 'json'
};

/**
 * @typedef {Object} FieldDefinition
 * @property {string} name - Field name
 * @property {string} type - Field type (FieldType)
 * @property {string} description - Human-readable description
 * @property {boolean} required - Whether field is required
 * @property {*} default - Default value if not provided
 * @property {Object} constraints - Additional constraints (min, max, pattern, etc.)
 * @property {string[]} examples - Example values for few-shot
 */

/**
 * @typedef {Object} SignatureDefinition
 * @property {string} name - Signature name
 * @property {string} description - Task description
 * @property {string} instructions - Detailed instructions
 * @property {FieldDefinition[]} inputs - Input field definitions
 * @property {FieldDefinition[]} outputs - Output field definitions
 * @property {Object[]} examples - Few-shot examples
 * @property {Object} config - Additional configuration
 */

/**
 * Base Signature class
 * All task-specific signatures extend this class
 */
export class Signature {
  /**
   * @param {SignatureDefinition} definition - Signature definition
   */
  constructor(definition) {
    this.name = definition.name || 'UnnamedSignature';
    this.description = definition.description || '';
    this.instructions = definition.instructions || '';
    this.inputs = definition.inputs || [];
    this.outputs = definition.outputs || [];
    this.examples = definition.examples || [];
    this.config = definition.config || {};

    // Validate definition
    this._validateDefinition();
  }

  /**
   * Generate prompt from signature with provided inputs
   *
   * @param {Object} inputValues - Values for input fields
   * @param {Object} options - Generation options
   * @returns {string} Generated prompt
   */
  generatePrompt(inputValues, options = {}) {
    const {
      includeExamples = true,
      maxExamples = 2,
      outputFormat = 'json'
    } = options;

    const parts = [];

    // 1. Task description and instructions
    parts.push(this._buildTaskSection());

    // 2. Input/Output schema description
    parts.push(this._buildSchemaSection());

    // 3. Few-shot examples (if enabled)
    if (includeExamples && this.examples.length > 0) {
      parts.push(this._buildExamplesSection(maxExamples));
    }

    // 4. Current input values
    parts.push(this._buildInputSection(inputValues));

    // 5. Output instructions
    parts.push(this._buildOutputInstructions(outputFormat));

    return parts.filter(p => p).join('\n\n');
  }

  /**
   * Validate input values against signature
   *
   * @param {Object} inputValues - Values to validate
   * @returns {Object} Validation result {valid, errors}
   */
  validateInputs(inputValues) {
    const errors = [];

    for (const field of this.inputs) {
      const value = inputValues[field.name];

      // Check required
      if (field.required && (value === undefined || value === null)) {
        errors.push(`Missing required input: ${field.name}`);
        continue;
      }

      // Type validation
      if (value !== undefined && value !== null) {
        const typeError = this._validateType(field, value);
        if (typeError) {
          errors.push(typeError);
        }

        // Constraint validation
        const constraintErrors = this._validateConstraints(field, value);
        errors.push(...constraintErrors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get output schema for JSON mode
   *
   * @returns {Object} JSON schema for outputs
   */
  getOutputSchema() {
    const properties = {};
    const required = [];

    for (const field of this.outputs) {
      properties[field.name] = this._fieldToJsonSchema(field);
      if (field.required) {
        required.push(field.name);
      }
    }

    return {
      type: 'object',
      properties,
      required
    };
  }

  /**
   * Create a bound signature with preset input values
   *
   * @param {Object} presetValues - Values to preset
   * @returns {BoundSignature} Bound signature instance
   */
  bind(presetValues) {
    return new BoundSignature(this, presetValues);
  }

  /**
   * Get signature metadata
   * @returns {Object}
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputFields: this.inputs.map(f => f.name),
      outputFields: this.outputs.map(f => f.name),
      exampleCount: this.examples.length,
      config: this.config
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate signature definition
   * @private
   */
  _validateDefinition() {
    if (!this.name) {
      throw new Error('Signature must have a name');
    }

    if (!this.outputs || this.outputs.length === 0) {
      throw new Error('Signature must have at least one output field');
    }

    // Validate field definitions
    for (const field of [...this.inputs, ...this.outputs]) {
      if (!field.name) {
        throw new Error('All fields must have a name');
      }
      if (!field.type) {
        throw new Error(`Field ${field.name} must have a type`);
      }
    }
  }

  /**
   * Build task description section
   * @private
   */
  _buildTaskSection() {
    const parts = [];

    if (this.description) {
      parts.push(`# Task: ${this.name}`);
      parts.push(this.description);
    }

    if (this.instructions) {
      parts.push('## Instructions');
      parts.push(this.instructions);
    }

    return parts.join('\n\n');
  }

  /**
   * Build schema description section
   * @private
   */
  _buildSchemaSection() {
    const parts = [];

    // Input schema
    if (this.inputs.length > 0) {
      parts.push('## Input Fields');
      for (const field of this.inputs) {
        const requiredMark = field.required ? ' (required)' : '';
        parts.push(`- **${field.name}**${requiredMark}: ${field.description || field.type}`);
      }
    }

    // Output schema
    parts.push('## Output Fields');
    for (const field of this.outputs) {
      const requiredMark = field.required ? ' (required)' : '';
      parts.push(`- **${field.name}**${requiredMark}: ${field.description || field.type}`);
    }

    return parts.join('\n');
  }

  /**
   * Build few-shot examples section
   * @private
   */
  _buildExamplesSection(maxExamples) {
    if (this.examples.length === 0) return '';

    const selectedExamples = this.examples.slice(0, maxExamples);
    const parts = ['## Examples'];

    for (let i = 0; i < selectedExamples.length; i++) {
      const example = selectedExamples[i];
      parts.push(`### Example ${i + 1}`);

      // Input
      if (example.input) {
        parts.push('**Input:**');
        parts.push('```');
        parts.push(typeof example.input === 'string'
          ? example.input
          : JSON.stringify(example.input, null, 2));
        parts.push('```');
      }

      // Output
      if (example.output) {
        parts.push('**Output:**');
        parts.push('```json');
        parts.push(typeof example.output === 'string'
          ? example.output
          : JSON.stringify(example.output, null, 2));
        parts.push('```');
      }
    }

    return parts.join('\n');
  }

  /**
   * Build input values section
   * @private
   */
  _buildInputSection(inputValues) {
    const parts = ['## Current Input'];

    for (const field of this.inputs) {
      const value = inputValues[field.name];
      if (value !== undefined) {
        parts.push(`### ${field.name}`);

        if (typeof value === 'string') {
          parts.push(value);
        } else if (Array.isArray(value)) {
          // Special handling for research files
          if (field.name === 'researchFiles' || field.name === 'files') {
            for (const item of value) {
              if (item.filename && item.content) {
                parts.push(`#### ${item.filename}`);
                parts.push(item.content);
              } else {
                parts.push(JSON.stringify(item, null, 2));
              }
            }
          } else {
            parts.push(JSON.stringify(value, null, 2));
          }
        } else {
          parts.push(JSON.stringify(value, null, 2));
        }
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Build output instructions
   * @private
   */
  _buildOutputInstructions(format) {
    if (format === 'json') {
      return `## Output Requirements
Respond with ONLY a valid JSON object matching the output schema.
Do not include any explanation, markdown formatting, or additional text.
The response must be parseable JSON.`;
    }

    return '## Output\nProvide your response below:';
  }

  /**
   * Validate field type
   * @private
   */
  _validateType(field, value) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    switch (field.type) {
      case FieldType.STRING:
        if (typeof value !== 'string') {
          return `${field.name} must be a string, got ${actualType}`;
        }
        break;

      case FieldType.NUMBER:
        if (typeof value !== 'number') {
          return `${field.name} must be a number, got ${actualType}`;
        }
        break;

      case FieldType.BOOLEAN:
        if (typeof value !== 'boolean') {
          return `${field.name} must be a boolean, got ${actualType}`;
        }
        break;

      case FieldType.ARRAY:
        if (!Array.isArray(value)) {
          return `${field.name} must be an array, got ${actualType}`;
        }
        break;

      case FieldType.OBJECT:
      case FieldType.JSON:
        if (typeof value !== 'object' || Array.isArray(value)) {
          return `${field.name} must be an object, got ${actualType}`;
        }
        break;
    }

    return null;
  }

  /**
   * Validate field constraints
   * @private
   */
  _validateConstraints(field, value) {
    const errors = [];
    const constraints = field.constraints || {};

    // String constraints
    if (field.type === FieldType.STRING && typeof value === 'string') {
      if (constraints.minLength && value.length < constraints.minLength) {
        errors.push(`${field.name} must be at least ${constraints.minLength} characters`);
      }
      if (constraints.maxLength && value.length > constraints.maxLength) {
        errors.push(`${field.name} must be at most ${constraints.maxLength} characters`);
      }
      if (constraints.pattern && !new RegExp(constraints.pattern).test(value)) {
        errors.push(`${field.name} does not match required pattern`);
      }
    }

    // Number constraints
    if (field.type === FieldType.NUMBER && typeof value === 'number') {
      if (constraints.min !== undefined && value < constraints.min) {
        errors.push(`${field.name} must be at least ${constraints.min}`);
      }
      if (constraints.max !== undefined && value > constraints.max) {
        errors.push(`${field.name} must be at most ${constraints.max}`);
      }
    }

    // Array constraints
    if (field.type === FieldType.ARRAY && Array.isArray(value)) {
      if (constraints.minItems && value.length < constraints.minItems) {
        errors.push(`${field.name} must have at least ${constraints.minItems} items`);
      }
      if (constraints.maxItems && value.length > constraints.maxItems) {
        errors.push(`${field.name} must have at most ${constraints.maxItems} items`);
      }
    }

    // Enum constraint
    if (constraints.enum && !constraints.enum.includes(value)) {
      errors.push(`${field.name} must be one of: ${constraints.enum.join(', ')}`);
    }

    return errors;
  }

  /**
   * Convert field to JSON schema
   * @private
   */
  _fieldToJsonSchema(field) {
    const schema = {
      description: field.description
    };

    switch (field.type) {
      case FieldType.STRING:
        schema.type = 'string';
        break;
      case FieldType.NUMBER:
        schema.type = 'number';
        break;
      case FieldType.BOOLEAN:
        schema.type = 'boolean';
        break;
      case FieldType.ARRAY:
        schema.type = 'array';
        if (field.itemSchema) {
          schema.items = field.itemSchema;
        }
        break;
      case FieldType.OBJECT:
      case FieldType.JSON:
        schema.type = 'object';
        if (field.properties) {
          schema.properties = field.properties;
        }
        break;
    }

    // Add constraints
    if (field.constraints) {
      Object.assign(schema, field.constraints);
    }

    return schema;
  }
}

/**
 * Bound Signature - A signature with preset values
 */
export class BoundSignature {
  constructor(signature, presetValues) {
    this.signature = signature;
    this.presetValues = presetValues;
  }

  /**
   * Generate prompt with preset + additional values
   */
  generatePrompt(additionalValues = {}, options = {}) {
    const mergedValues = {
      ...this.presetValues,
      ...additionalValues
    };
    return this.signature.generatePrompt(mergedValues, options);
  }

  /**
   * Validate merged inputs
   */
  validateInputs(additionalValues = {}) {
    const mergedValues = {
      ...this.presetValues,
      ...additionalValues
    };
    return this.signature.validateInputs(mergedValues);
  }
}

/**
 * Signature Builder - Fluent API for creating signatures
 */
export class SignatureBuilder {
  constructor(name) {
    this._definition = {
      name,
      description: '',
      instructions: '',
      inputs: [],
      outputs: [],
      examples: [],
      config: {}
    };
  }

  /**
   * Set description
   */
  describe(description) {
    this._definition.description = description;
    return this;
  }

  /**
   * Set instructions
   */
  instruct(instructions) {
    this._definition.instructions = instructions;
    return this;
  }

  /**
   * Add input field
   */
  input(name, type, options = {}) {
    this._definition.inputs.push({
      name,
      type,
      description: options.description || '',
      required: options.required !== false,
      default: options.default,
      constraints: options.constraints || {}
    });
    return this;
  }

  /**
   * Add output field
   */
  output(name, type, options = {}) {
    this._definition.outputs.push({
      name,
      type,
      description: options.description || '',
      required: options.required !== false,
      constraints: options.constraints || {},
      itemSchema: options.itemSchema,
      properties: options.properties
    });
    return this;
  }

  /**
   * Add example
   */
  example(input, output) {
    this._definition.examples.push({ input, output });
    return this;
  }

  /**
   * Set configuration
   */
  configure(config) {
    this._definition.config = { ...this._definition.config, ...config };
    return this;
  }

  /**
   * Build the signature
   */
  build() {
    return new Signature(this._definition);
  }
}

/**
 * Create a new signature builder
 * @param {string} name - Signature name
 * @returns {SignatureBuilder}
 */
export function createSignature(name) {
  return new SignatureBuilder(name);
}

export default Signature;
