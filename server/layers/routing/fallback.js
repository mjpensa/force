/**
 * Fallback Strategy - PROMPT ML Layer 5
 *
 * Handles model failures with intelligent fallback:
 * - Retry with same model (transient errors)
 * - Escalate to higher tier (capability errors)
 * - Downgrade to lower tier (rate limits/cost)
 *
 * Based on PROMPT ML design specification.
 */

import { ModelTier, getRouter } from './router.js';

/**
 * Error types that determine fallback strategy
 * @readonly
 * @enum {string}
 */
export const ErrorType = {
  TRANSIENT: 'transient',           // Network issues, temporary errors
  RATE_LIMIT: 'rate_limit',         // API rate limits
  QUOTA_EXCEEDED: 'quota_exceeded', // Usage quotas
  CAPABILITY: 'capability',         // Model can't handle request
  INVALID_RESPONSE: 'invalid_response', // Malformed output
  TIMEOUT: 'timeout',               // Request timeout
  UNKNOWN: 'unknown'
};

/**
 * Fallback actions
 * @readonly
 * @enum {string}
 */
export const FallbackAction = {
  RETRY: 'retry',           // Retry with same model
  ESCALATE: 'escalate',     // Try higher tier model
  DOWNGRADE: 'downgrade',   // Try lower tier model
  ABORT: 'abort'            // Give up
};

/**
 * @typedef {Object} FallbackDecision
 * @property {string} action - Fallback action to take
 * @property {string|null} modelId - Model to use (null if abort)
 * @property {number} delayMs - Delay before retry
 * @property {string} reasoning - Why this decision was made
 * @property {boolean} shouldNotify - Whether to notify user of fallback
 */

/**
 * @typedef {Object} FallbackConfig
 * @property {number} maxRetries - Maximum retry attempts per tier
 * @property {number} maxEscalations - Maximum tier escalations
 * @property {Object} delays - Delay configuration
 * @property {Object} errorHandling - Error type handling rules
 */

const DEFAULT_CONFIG = {
  maxRetries: 3,
  maxEscalations: 2,
  maxDowngrades: 2,

  delays: {
    baseRetryMs: 1000,
    maxRetryMs: 16000,
    rateLimitMs: 60000,
    escalationMs: 500
  },

  // How to handle each error type
  errorHandling: {
    [ErrorType.TRANSIENT]: {
      action: FallbackAction.RETRY,
      maxAttempts: 3,
      exponentialBackoff: true
    },
    [ErrorType.RATE_LIMIT]: {
      action: FallbackAction.DOWNGRADE,
      maxAttempts: 2,
      waitForReset: true
    },
    [ErrorType.QUOTA_EXCEEDED]: {
      action: FallbackAction.DOWNGRADE,
      maxAttempts: 1,
      notify: true
    },
    [ErrorType.CAPABILITY]: {
      action: FallbackAction.ESCALATE,
      maxAttempts: 2,
      notify: false
    },
    [ErrorType.INVALID_RESPONSE]: {
      action: FallbackAction.RETRY,
      maxAttempts: 2,
      exponentialBackoff: false
    },
    [ErrorType.TIMEOUT]: {
      action: FallbackAction.RETRY,
      maxAttempts: 2,
      exponentialBackoff: true
    },
    [ErrorType.UNKNOWN]: {
      action: FallbackAction.RETRY,
      maxAttempts: 2,
      exponentialBackoff: true
    }
  }
};

/**
 * Tier ordering for escalation/downgrade
 */
const TIER_ORDER = [ModelTier.FAST, ModelTier.STANDARD, ModelTier.ADVANCED];

/**
 * Fallback Manager class
 */
export class FallbackManager {
  /**
   * @param {FallbackConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = this._mergeConfig(DEFAULT_CONFIG, config);
    this.router = getRouter();

    // Track attempts per request
    this._attempts = new Map();
  }

  /**
   * Determine fallback action after an error
   *
   * @param {string} requestId - Unique request identifier
   * @param {Error} error - The error that occurred
   * @param {string} currentModelId - Model that failed
   * @param {Object} context - Request context
   * @returns {FallbackDecision} Fallback decision
   */
  getFallback(requestId, error, currentModelId, context = {}) {
    // Get or create attempt tracking
    let attemptState = this._attempts.get(requestId);
    if (!attemptState) {
      attemptState = {
        retries: 0,
        escalations: 0,
        downgrades: 0,
        modelsAttempted: [],
        errors: []
      };
      this._attempts.set(requestId, attemptState);
    }

    // Classify the error
    const errorType = this._classifyError(error);

    // Record this attempt
    attemptState.errors.push({
      errorType,
      modelId: currentModelId,
      timestamp: Date.now(),
      message: error.message
    });
    attemptState.modelsAttempted.push(currentModelId);

    // Get handling rules for this error type
    const handling = this.config.errorHandling[errorType];

    // Determine action based on rules and state
    return this._decideAction(attemptState, errorType, handling, currentModelId, context);
  }

  /**
   * Record successful completion (cleanup attempt tracking)
   *
   * @param {string} requestId - Request identifier
   */
  recordSuccess(requestId) {
    this._attempts.delete(requestId);
  }

  /**
   * Get attempt history for a request
   *
   * @param {string} requestId - Request identifier
   * @returns {Object|null} Attempt state
   */
  getAttemptState(requestId) {
    return this._attempts.get(requestId) || null;
  }

  /**
   * Clear old attempt records (housekeeping)
   *
   * @param {number} maxAgeMs - Maximum age in milliseconds
   */
  cleanupOldAttempts(maxAgeMs = 300000) {
    const now = Date.now();
    for (const [requestId, state] of this._attempts.entries()) {
      const lastError = state.errors[state.errors.length - 1];
      if (lastError && now - lastError.timestamp > maxAgeMs) {
        this._attempts.delete(requestId);
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Merge configurations
   * @private
   */
  _mergeConfig(defaults, overrides) {
    return {
      ...defaults,
      ...overrides,
      delays: { ...defaults.delays, ...(overrides.delays || {}) },
      errorHandling: { ...defaults.errorHandling, ...(overrides.errorHandling || {}) }
    };
  }

  /**
   * Classify error into error type
   * @private
   */
  _classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    const code = error.code;

    // Rate limiting
    if (message.includes('429') || message.includes('rate limit') ||
        message.includes('too many requests')) {
      return ErrorType.RATE_LIMIT;
    }

    // Quota exceeded
    if (message.includes('quota') || message.includes('resource_exhausted') ||
        message.includes('billing')) {
      return ErrorType.QUOTA_EXCEEDED;
    }

    // Timeout
    if (message.includes('timeout') || message.includes('timed out') ||
        code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
      return ErrorType.TIMEOUT;
    }

    // Capability issues
    if (message.includes('context length') || message.includes('too long') ||
        message.includes('token limit') || message.includes('max_tokens')) {
      return ErrorType.CAPABILITY;
    }

    // Invalid response
    if (message.includes('invalid json') || message.includes('parse error') ||
        message.includes('malformed') || message.includes('unexpected token')) {
      return ErrorType.INVALID_RESPONSE;
    }

    // Transient network errors
    if (message.includes('network') || message.includes('connection') ||
        message.includes('econnreset') || message.includes('enotfound') ||
        code === 'ECONNRESET' || code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
      return ErrorType.TRANSIENT;
    }

    // Server errors (5xx)
    if (message.includes('500') || message.includes('502') ||
        message.includes('503') || message.includes('504')) {
      return ErrorType.TRANSIENT;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Decide on fallback action
   * @private
   */
  _decideAction(state, errorType, handling, currentModelId, context) {
    const currentModel = this.router.getModel(currentModelId);
    const currentTier = currentModel?.tier || ModelTier.STANDARD;
    const currentTierIndex = TIER_ORDER.indexOf(currentTier);

    // Check if we've exhausted all options
    if (this._isExhausted(state)) {
      return {
        action: FallbackAction.ABORT,
        modelId: null,
        delayMs: 0,
        reasoning: `Exhausted all fallback options after ${state.retries} retries, ${state.escalations} escalations, ${state.downgrades} downgrades`,
        shouldNotify: true
      };
    }

    // Determine primary action based on error type
    switch (handling.action) {
      case FallbackAction.RETRY:
        return this._handleRetry(state, handling, currentModelId);

      case FallbackAction.ESCALATE:
        return this._handleEscalate(state, handling, currentTier, currentTierIndex);

      case FallbackAction.DOWNGRADE:
        return this._handleDowngrade(state, handling, currentTier, currentTierIndex, errorType);

      default:
        return this._handleRetry(state, handling, currentModelId);
    }
  }

  /**
   * Handle retry action
   * @private
   */
  _handleRetry(state, handling, currentModelId) {
    if (state.retries >= handling.maxAttempts) {
      // Switch to escalation if retries exhausted
      return {
        action: FallbackAction.ESCALATE,
        modelId: this._getNextTierModel(this.router.getModel(currentModelId)?.tier, 1),
        delayMs: this.config.delays.escalationMs,
        reasoning: `Retries exhausted (${state.retries}/${handling.maxAttempts}), escalating to higher tier`,
        shouldNotify: false
      };
    }

    state.retries++;

    // Calculate delay with exponential backoff if configured
    let delayMs = this.config.delays.baseRetryMs;
    if (handling.exponentialBackoff) {
      delayMs = Math.min(
        this.config.delays.baseRetryMs * Math.pow(2, state.retries - 1),
        this.config.delays.maxRetryMs
      );
    }

    return {
      action: FallbackAction.RETRY,
      modelId: currentModelId,
      delayMs,
      reasoning: `Retry attempt ${state.retries}/${handling.maxAttempts} with ${delayMs}ms delay`,
      shouldNotify: false
    };
  }

  /**
   * Handle escalate action
   * @private
   */
  _handleEscalate(state, handling, currentTier, currentTierIndex) {
    if (state.escalations >= this.config.maxEscalations) {
      return {
        action: FallbackAction.ABORT,
        modelId: null,
        delayMs: 0,
        reasoning: `Maximum escalations reached (${state.escalations}/${this.config.maxEscalations})`,
        shouldNotify: true
      };
    }

    const nextTierIndex = currentTierIndex + 1;
    if (nextTierIndex >= TIER_ORDER.length) {
      return {
        action: FallbackAction.ABORT,
        modelId: null,
        delayMs: 0,
        reasoning: 'Already at highest tier, cannot escalate further',
        shouldNotify: true
      };
    }

    state.escalations++;

    const nextTier = TIER_ORDER[nextTierIndex];
    const nextModelId = this.router.config?.defaultModels?.[nextTier] ||
                        this._getDefaultModelForTier(nextTier);

    return {
      action: FallbackAction.ESCALATE,
      modelId: nextModelId,
      delayMs: this.config.delays.escalationMs,
      reasoning: `Escalating from ${currentTier} to ${nextTier} (escalation ${state.escalations}/${this.config.maxEscalations})`,
      shouldNotify: handling.notify || false
    };
  }

  /**
   * Handle downgrade action
   * @private
   */
  _handleDowngrade(state, handling, currentTier, currentTierIndex, errorType) {
    if (state.downgrades >= this.config.maxDowngrades) {
      return {
        action: FallbackAction.ABORT,
        modelId: null,
        delayMs: 0,
        reasoning: `Maximum downgrades reached (${state.downgrades}/${this.config.maxDowngrades})`,
        shouldNotify: true
      };
    }

    const prevTierIndex = currentTierIndex - 1;
    if (prevTierIndex < 0) {
      // Already at lowest tier, try retry instead
      return this._handleRetry(state, { ...handling, maxAttempts: 2 }, this._getDefaultModelForTier(currentTier));
    }

    state.downgrades++;

    const prevTier = TIER_ORDER[prevTierIndex];
    const prevModelId = this.router.config?.defaultModels?.[prevTier] ||
                        this._getDefaultModelForTier(prevTier);

    let delayMs = this.config.delays.baseRetryMs;
    if (errorType === ErrorType.RATE_LIMIT && handling.waitForReset) {
      delayMs = this.config.delays.rateLimitMs;
    }

    return {
      action: FallbackAction.DOWNGRADE,
      modelId: prevModelId,
      delayMs,
      reasoning: `Downgrading from ${currentTier} to ${prevTier} due to ${errorType} (downgrade ${state.downgrades}/${this.config.maxDowngrades})`,
      shouldNotify: handling.notify || false
    };
  }

  /**
   * Check if all fallback options are exhausted
   * @private
   */
  _isExhausted(state) {
    return (
      state.retries >= this.config.maxRetries * 2 &&
      state.escalations >= this.config.maxEscalations &&
      state.downgrades >= this.config.maxDowngrades
    );
  }

  /**
   * Get model ID for next tier
   * @private
   */
  _getNextTierModel(currentTier, direction) {
    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const nextIndex = currentIndex + direction;

    if (nextIndex < 0 || nextIndex >= TIER_ORDER.length) {
      return null;
    }

    return this._getDefaultModelForTier(TIER_ORDER[nextIndex]);
  }

  /**
   * Get default model for a tier
   * @private
   */
  _getDefaultModelForTier(tier) {
    const defaults = {
      [ModelTier.FAST]: 'gemini-2.0-flash-lite',
      [ModelTier.STANDARD]: 'gemini-2.5-flash-preview-09-2025',
      [ModelTier.ADVANCED]: 'gemini-2.5-pro'
    };
    return defaults[tier] || defaults[ModelTier.STANDARD];
  }
}

/**
 * Create a fallback manager with configuration
 * @param {FallbackConfig} config - Configuration
 * @returns {FallbackManager}
 */
export function createFallbackManager(config = {}) {
  return new FallbackManager(config);
}

// Singleton instance
let _instance = null;

/**
 * Get or create singleton fallback manager
 * @param {FallbackConfig} config - Configuration (only used on first call)
 * @returns {FallbackManager}
 */
export function getFallbackManager(config = {}) {
  if (!_instance) {
    _instance = new FallbackManager(config);
  }
  return _instance;
}

/**
 * Get fallback decision for an error
 * @param {string} requestId - Request ID
 * @param {Error} error - Error that occurred
 * @param {string} currentModelId - Current model
 * @param {Object} context - Request context
 * @returns {FallbackDecision}
 */
export function getFallback(requestId, error, currentModelId, context = {}) {
  return getFallbackManager().getFallback(requestId, error, currentModelId, context);
}

export default FallbackManager;
