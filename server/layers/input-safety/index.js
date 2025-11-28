/**
 * Input Safety Layer - PROMPT ML Layer 1
 *
 * Unified input safety layer that orchestrates:
 * 1. Rate limiting (fail fast if over limit)
 * 2. Sanitization (clean the input)
 * 3. Injection detection (analyze cleaned input)
 *
 * Based on PROMPT ML design specification.
 */

import { InputSanitizer, createSanitizer } from './sanitizer.js';
import { InjectionDetector, createDetector, InjectionType } from './injection-detector.js';
import { RateLimiter, createRateLimiter, TokenEstimator } from './rate-limiter.js';

/**
 * @typedef {Object} InputProcessingResult
 * @property {boolean} isSafe - Whether input passed all safety checks
 * @property {string} sanitizedInput - Cleaned input text
 * @property {Object} sanitization - Sanitization result details
 * @property {Object} injectionDetection - Injection detection result
 * @property {Object} rateLimit - Rate limit check result
 * @property {string|null} rejectionReason - Reason for rejection if not safe
 * @property {Object} metadata - Processing metadata (timing, etc.)
 */

/**
 * @typedef {Object} InputSafetyConfig
 * @property {Object} sanitizer - Sanitizer configuration
 * @property {Object} detector - Injection detector configuration
 * @property {Object} rateLimiter - Rate limiter configuration
 * @property {boolean} strictMode - Reject on any warning (default: false)
 * @property {boolean} logRejections - Log rejected inputs (default: true)
 */

const DEFAULT_CONFIG = {
  sanitizer: {
    riskThreshold: 0.7,
    maxLength: 500000,
    escapeDelimiters: true,
    removeControlChars: true
  },
  detector: {
    threshold: 0.5,
    useStatistical: true,
    useSemantic: false
  },
  rateLimiter: {
    requestsPerMinute: 20,
    requestsPerHour: 200,
    tokensPerMinute: 100000,
    tokensPerHour: 1000000,
    concurrentRequests: 5,
    maxCostPerMinute: 1.0,
    maxCostPerHour: 10.0
  },
  strictMode: false,
  logRejections: true
};

/**
 * Input Safety Layer class
 * Orchestrates all safety checks in the correct order
 */
export class InputSafetyLayer {
  /**
   * @param {InputSafetyConfig} config - Configuration options
   */
  constructor(config = {}) {
    this.config = this._mergeConfig(DEFAULT_CONFIG, config);

    this.sanitizer = createSanitizer(this.config.sanitizer);
    this.detector = createDetector(this.config.detector);
    this.rateLimiter = createRateLimiter(this.config.rateLimiter);

    // Statistics
    this._stats = {
      totalProcessed: 0,
      totalRejected: 0,
      rejectionsByReason: {
        rateLimit: 0,
        sanitization: 0,
        injection: 0
      }
    };
  }

  /**
   * Process input through all safety layers
   *
   * @param {string} userId - User identifier for rate limiting
   * @param {string} text - Raw user input
   * @param {Object} options - Processing options
   * @param {number} options.estimatedTokens - Estimated tokens for rate limiting
   * @param {number} options.estimatedCost - Estimated cost for rate limiting
   * @param {string} options.context - Context for injection detection
   * @returns {Promise<InputProcessingResult>} Processing result
   */
  async process(userId, text, options = {}) {
    const startTime = Date.now();
    const {
      estimatedTokens = TokenEstimator.estimateInputTokens(text),
      estimatedCost = 0.01,
      context = 'user input'
    } = options;

    this._stats.totalProcessed++;

    // =========================================================================
    // Step 1: Rate Limiting (fail fast)
    // =========================================================================
    const rateResult = await this.rateLimiter.checkAndAcquire(userId, {
      estimatedTokens,
      estimatedCost
    });

    if (!rateResult.allowed) {
      this._stats.totalRejected++;
      this._stats.rejectionsByReason.rateLimit++;

      if (this.config.logRejections) {
        console.warn(`[InputSafety] Rate limited: ${userId} - ${rateResult.reason}`);
      }

      return {
        isSafe: false,
        sanitizedInput: '',
        sanitization: null,
        injectionDetection: null,
        rateLimit: rateResult,
        rejectionReason: `Rate limited: ${rateResult.reason}`,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          stage: 'rate_limit'
        }
      };
    }

    try {
      // =========================================================================
      // Step 2: Sanitization
      // =========================================================================
      const sanitizationResult = this.sanitizer.sanitize(text);

      if (!sanitizationResult.isSafe) {
        this._stats.totalRejected++;
        this._stats.rejectionsByReason.sanitization++;

        // Release rate limit slot since we're rejecting
        await this.rateLimiter.release(userId, { tokens: 0, cost: 0 });

        if (this.config.logRejections) {
          console.warn(`[InputSafety] Sanitization failed: risk=${sanitizationResult.riskScore.toFixed(2)}`);
        }

        return {
          isSafe: false,
          sanitizedInput: '',
          sanitization: sanitizationResult,
          injectionDetection: null,
          rateLimit: rateResult,
          rejectionReason: `Input failed sanitization (risk score: ${sanitizationResult.riskScore.toFixed(2)})`,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            stage: 'sanitization'
          }
        };
      }

      // =========================================================================
      // Step 3: Injection Detection
      // =========================================================================
      const injectionResult = this.detector.detect(sanitizationResult.sanitized, context);

      if (injectionResult.isInjection) {
        this._stats.totalRejected++;
        this._stats.rejectionsByReason.injection++;

        // Release rate limit slot since we're rejecting
        await this.rateLimiter.release(userId, { tokens: 0, cost: 0 });

        if (this.config.logRejections) {
          console.warn(`[InputSafety] Injection detected: type=${injectionResult.injectionType}, confidence=${injectionResult.confidence.toFixed(2)}`);
        }

        return {
          isSafe: false,
          sanitizedInput: '',
          sanitization: sanitizationResult,
          injectionDetection: injectionResult,
          rateLimit: rateResult,
          rejectionReason: `Potential prompt injection detected: ${injectionResult.explanation}`,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            stage: 'injection_detection'
          }
        };
      }

      // =========================================================================
      // Step 4: Strict Mode Additional Checks
      // =========================================================================
      if (this.config.strictMode) {
        // In strict mode, any elevated risk score is rejected
        const combinedRisk = sanitizationResult.riskScore + injectionResult.confidence;
        if (combinedRisk > 0.5) {
          this._stats.totalRejected++;

          await this.rateLimiter.release(userId, { tokens: 0, cost: 0 });

          return {
            isSafe: false,
            sanitizedInput: '',
            sanitization: sanitizationResult,
            injectionDetection: injectionResult,
            rateLimit: rateResult,
            rejectionReason: `Strict mode: combined risk too high (${combinedRisk.toFixed(2)})`,
            metadata: {
              processingTimeMs: Date.now() - startTime,
              stage: 'strict_mode'
            }
          };
        }
      }

      // =========================================================================
      // All checks passed
      // =========================================================================
      return {
        isSafe: true,
        sanitizedInput: sanitizationResult.sanitized,
        sanitization: sanitizationResult,
        injectionDetection: injectionResult,
        rateLimit: rateResult,
        rejectionReason: null,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          stage: 'complete',
          modifications: sanitizationResult.modifications,
          riskScore: sanitizationResult.riskScore,
          injectionConfidence: injectionResult.confidence
        }
      };

    } catch (error) {
      // Release rate limit slot on error
      await this.rateLimiter.release(userId, { tokens: 0, cost: 0 });
      throw error;
    }
  }

  /**
   * Release a rate limit slot after request completion
   *
   * @param {string} userId - User identifier
   * @param {Object} actualUsage - Actual usage values
   */
  async releaseSlot(userId, actualUsage = {}) {
    await this.rateLimiter.release(userId, actualUsage);
  }

  /**
   * Quick safety check (fast path for simple validation)
   *
   * @param {string} text - Input text
   * @returns {Object} Quick check result
   */
  quickCheck(text) {
    // Quick injection check
    const hasInjection = this.detector.quickCheck(text);

    // Quick risk indicators
    const hasHighRisk = (
      text.length > 100000 ||
      /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text) ||
      (text.match(/[^\x00-\x7F]/g) || []).length / text.length > 0.3
    );

    return {
      passesQuickCheck: !hasInjection && !hasHighRisk,
      hasInjection,
      hasHighRisk,
      needsFullCheck: hasInjection || hasHighRisk
    };
  }

  /**
   * Get current statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this._stats,
      rateLimiter: this.rateLimiter.getGlobalStats()
    };
  }

  /**
   * Reset rate limits for a user
   * @param {string} userId - User identifier
   */
  resetUserLimits(userId) {
    this.rateLimiter.resetUser(userId);
  }

  /**
   * Shutdown the safety layer
   */
  shutdown() {
    this.rateLimiter.shutdown();
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  /**
   * Deep merge configuration objects
   * @private
   */
  _mergeConfig(defaults, overrides) {
    const result = { ...defaults };

    for (const key of Object.keys(overrides)) {
      if (
        typeof overrides[key] === 'object' &&
        overrides[key] !== null &&
        !Array.isArray(overrides[key]) &&
        typeof defaults[key] === 'object'
      ) {
        result[key] = { ...defaults[key], ...overrides[key] };
      } else if (overrides[key] !== undefined) {
        result[key] = overrides[key];
      }
    }

    return result;
  }
}

/**
 * Create an input safety layer with default configuration
 * @param {InputSafetyConfig} config - Optional configuration
 * @returns {InputSafetyLayer}
 */
export function createInputSafetyLayer(config = {}) {
  return new InputSafetyLayer(config);
}

// Singleton instance for the application
let _instance = null;

/**
 * Get or create the singleton input safety layer instance
 * @param {InputSafetyConfig} config - Configuration (only used on first call)
 * @returns {InputSafetyLayer}
 */
export function getInputSafetyLayer(config = {}) {
  if (!_instance) {
    _instance = new InputSafetyLayer(config);
  }
  return _instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetInputSafetyLayer() {
  if (_instance) {
    _instance.shutdown();
    _instance = null;
  }
}

// Re-export components for direct access
export { InputSanitizer, createSanitizer } from './sanitizer.js';
export { InjectionDetector, createDetector, InjectionType } from './injection-detector.js';
export { RateLimiter, createRateLimiter, TokenEstimator } from './rate-limiter.js';

export default InputSafetyLayer;
