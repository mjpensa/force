/**
 * Output Layer - PROMPT ML Layer 6
 *
 * Unified export and orchestration for output validation:
 * - Schema validation
 * - Safety checking
 * - Quality scoring
 * - Combined pipeline
 *
 * Based on PROMPT ML design specification.
 */

// Validator exports
export {
  OutputValidator,
  ValidationLevel,
  createValidator,
  getValidator,
  validateOutput,
  validateByType
} from './validator.js';

// Safety checker exports
export {
  OutputSafetyChecker,
  SafetyLevel,
  SafetyCategory,
  createSafetyChecker,
  getSafetyChecker,
  checkSafety
} from './safety-checker.js';

// Quality scorer exports
export {
  OutputQualityScorer,
  QualityDimension,
  QualityGrade,
  createQualityScorer,
  getQualityScorer,
  scoreQuality
} from './quality-scorer.js';

/**
 * @typedef {Object} OutputProcessingResult
 * @property {boolean} valid - Whether output is valid
 * @property {boolean} safe - Whether output is safe
 * @property {Object} validation - Validation result
 * @property {Object} safety - Safety check result
 * @property {Object} quality - Quality score
 * @property {*} output - Processed output (possibly repaired)
 * @property {Object} metadata - Processing metadata
 */

/**
 * @typedef {Object} OutputProcessorConfig
 * @property {boolean} validateSchema - Run schema validation
 * @property {boolean} checkSafety - Run safety checks
 * @property {boolean} scoreQuality - Run quality scoring
 * @property {boolean} autoRepair - Attempt to repair invalid output
 * @property {boolean} sanitizePII - Remove detected PII
 */

const DEFAULT_CONFIG = {
  validateSchema: true,
  checkSafety: true,
  scoreQuality: true,
  autoRepair: false,
  sanitizePII: false
};

/**
 * Output Processor class
 * Orchestrates all output validation components
 */
export class OutputProcessor {
  /**
   * @param {OutputProcessorConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Lazy-load components
    this._validator = null;
    this._safetyChecker = null;
    this._qualityScorer = null;
  }

  /**
   * Get validator instance
   */
  get validator() {
    if (!this._validator) {
      const { getValidator } = require('./validator.js');
      this._validator = getValidator();
    }
    return this._validator;
  }

  /**
   * Get safety checker instance
   */
  get safetyChecker() {
    if (!this._safetyChecker) {
      const { getSafetyChecker } = require('./safety-checker.js');
      this._safetyChecker = getSafetyChecker();
    }
    return this._safetyChecker;
  }

  /**
   * Get quality scorer instance
   */
  get qualityScorer() {
    if (!this._qualityScorer) {
      const { getQualityScorer } = require('./quality-scorer.js');
      this._qualityScorer = getQualityScorer();
    }
    return this._qualityScorer;
  }

  /**
   * Process output through full validation pipeline
   *
   * @param {*} output - Output to process
   * @param {Object} context - Processing context
   * @param {string} context.outputType - Type of output
   * @param {Object} context.schema - JSON schema for validation
   * @param {string} context.userPrompt - Original user request
   * @param {Array} context.sourceFiles - Source research files
   * @returns {OutputProcessingResult} Processing result
   */
  process(output, context = {}) {
    const { outputType, schema, userPrompt, sourceFiles } = context;
    const startTime = Date.now();

    let processedOutput = output;
    const result = {
      valid: true,
      safe: true,
      validation: null,
      safety: null,
      quality: null,
      output: processedOutput,
      metadata: {
        outputType,
        processingTimeMs: 0,
        steps: []
      }
    };

    // Step 1: Schema Validation
    if (this.config.validateSchema && schema) {
      result.metadata.steps.push('validation');

      if (this.config.autoRepair) {
        const repairResult = this.validator.validateAndRepair(processedOutput, schema);
        result.validation = repairResult.result;

        if (repairResult.repaired) {
          processedOutput = repairResult.output;
          result.metadata.repaired = true;
        }
      } else {
        result.validation = this.validator.validate(processedOutput, schema);
      }

      result.valid = result.validation.valid;
    } else if (this.config.validateSchema && outputType) {
      // Validate by type if no schema provided
      result.metadata.steps.push('validation-by-type');
      result.validation = this.validator.validateByType(outputType, processedOutput);
      result.valid = result.validation.valid;
    }

    // Step 2: Safety Check
    if (this.config.checkSafety) {
      result.metadata.steps.push('safety');

      const safetyOptions = {
        sourceContent: sourceFiles?.map(f => f.content).join('\n') || ''
      };

      result.safety = this.safetyChecker.check(processedOutput, safetyOptions);
      result.safe = result.safety.safe;

      // Sanitize PII if enabled and PII detected
      if (this.config.sanitizePII && result.safety.scores?.pii > 0) {
        const sanitized = this.safetyChecker.sanitizePII(processedOutput);
        if (sanitized.removed > 0) {
          processedOutput = sanitized.sanitized;
          result.metadata.piiRemoved = sanitized.removed;
        }
      }
    }

    // Step 3: Quality Scoring
    if (this.config.scoreQuality) {
      result.metadata.steps.push('quality');

      result.quality = this.qualityScorer.score(processedOutput, {
        outputType,
        userPrompt,
        sourceFiles
      });
    }

    // Finalize
    result.output = processedOutput;
    result.metadata.processingTimeMs = Date.now() - startTime;

    return result;
  }

  /**
   * Quick validation check
   *
   * @param {*} output - Output to check
   * @param {string} outputType - Output type
   * @returns {Object} {valid, safe, qualityGrade}
   */
  quickCheck(output, outputType) {
    const validation = this.validator.validateByType(outputType, output);
    const safety = this.safetyChecker.isSafe(output);
    const quality = this.qualityScorer.quickAssess(output);

    return {
      valid: validation.valid,
      safe: safety,
      qualityGrade: quality.grade,
      meetsMinimum: validation.valid && safety && quality.meetsMinimum
    };
  }

  /**
   * Get processing summary
   *
   * @param {OutputProcessingResult} result - Processing result
   * @returns {Object} Summary
   */
  getSummary(result) {
    const summary = {
      valid: result.valid,
      safe: result.safe,
      qualityGrade: result.quality?.grade || 'N/A',
      qualityScore: result.quality?.overall || 0,
      issues: [],
      recommendations: []
    };

    // Collect validation issues
    if (result.validation?.errors) {
      summary.issues.push(...result.validation.errors.map(e => ({
        type: 'validation',
        message: e
      })));
    }

    // Collect safety concerns
    if (result.safety?.concerns) {
      summary.issues.push(...result.safety.concerns.map(c => ({
        type: 'safety',
        category: c.category,
        message: c.message
      })));
    }

    // Collect quality weaknesses
    if (result.quality?.weaknesses) {
      summary.issues.push(...result.quality.weaknesses.map(w => ({
        type: 'quality',
        message: w
      })));
    }

    // Collect recommendations
    if (result.safety?.recommendations) {
      summary.recommendations.push(...result.safety.recommendations);
    }

    return summary;
  }

  /**
   * Check if output should be returned to user
   *
   * @param {OutputProcessingResult} result - Processing result
   * @returns {boolean} Whether output can be returned
   */
  canReturn(result) {
    // Block if unsafe at BLOCKED level
    if (result.safety?.level === 'blocked') {
      return false;
    }

    // Allow if valid and safe
    return result.valid && result.safe;
  }
}

// Singleton instance
let _processor = null;

/**
 * Get or create singleton output processor
 * @param {OutputProcessorConfig} config - Configuration (only used on first call)
 * @returns {OutputProcessor}
 */
export function getOutputProcessor(config = {}) {
  if (!_processor) {
    _processor = new OutputProcessor(config);
  }
  return _processor;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetOutputProcessor() {
  _processor = null;
}

/**
 * Quick process function
 *
 * @param {*} output - Output to process
 * @param {Object} context - Processing context
 * @returns {OutputProcessingResult}
 */
export function processOutput(output, context = {}) {
  return getOutputProcessor().process(output, context);
}

/**
 * Quick check function
 *
 * @param {*} output - Output to check
 * @param {string} outputType - Output type
 * @returns {Object} Quick check result
 */
export function quickCheckOutput(output, outputType) {
  return getOutputProcessor().quickCheck(output, outputType);
}

export default OutputProcessor;
