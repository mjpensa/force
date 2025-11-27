/**
 * Multi-Dimensional Rate Limiter - PROMPT ML Layer 1
 *
 * Tracks and limits:
 * - Request count (per minute, per hour)
 * - Token usage (per minute, per hour)
 * - Cost accumulation (per minute, per hour)
 * - Concurrent requests
 *
 * Based on PROMPT ML design specification.
 */

/**
 * @typedef {Object} RateLimitConfig
 * @property {number} requestsPerMinute - Max requests per minute (default: 20)
 * @property {number} requestsPerHour - Max requests per hour (default: 200)
 * @property {number} tokensPerMinute - Max tokens per minute (default: 100,000)
 * @property {number} tokensPerHour - Max tokens per hour (default: 1,000,000)
 * @property {number} concurrentRequests - Max concurrent requests (default: 5)
 * @property {number} maxCostPerMinute - Max cost per minute in USD (default: 1.0)
 * @property {number} maxCostPerHour - Max cost per hour in USD (default: 10.0)
 * @property {number} cleanupIntervalMs - Cleanup interval in ms (default: 60000)
 */

const DEFAULT_CONFIG = {
  requestsPerMinute: 20,
  requestsPerHour: 200,
  tokensPerMinute: 100000,
  tokensPerHour: 1000000,
  concurrentRequests: 5,
  maxCostPerMinute: 1.0,
  maxCostPerHour: 10.0,
  cleanupIntervalMs: 60000
};

/**
 * @typedef {Object} RateLimitResult
 * @property {boolean} allowed - Whether the request is allowed
 * @property {number|null} waitTimeSeconds - How long to wait if not allowed
 * @property {string|null} reason - Reason for rejection
 * @property {Object} currentUsage - Current usage statistics
 * @property {Object} limits - Configured limits
 */

/**
 * @typedef {Object} UsageEntry
 * @property {number} timestamp - Unix timestamp in ms
 * @property {number} tokens - Token count
 * @property {number} cost - Cost in USD
 */

/**
 * Multi-dimensional rate limiter class
 */
export class RateLimiter {
  /**
   * @param {RateLimitConfig} config - Configuration options
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {Map<string, UsageEntry[]>} */
    this._requestHistory = new Map();

    /** @type {Map<string, number>} */
    this._activeRequests = new Map();

    /** @type {Map<string, number>} */
    this._lastCleanup = new Map();

    // Start periodic cleanup
    this._cleanupInterval = setInterval(
      () => this._runCleanup(),
      this.config.cleanupIntervalMs
    );
  }

  /**
   * Check if request is allowed and acquire a slot if so
   *
   * @param {string} userId - Unique identifier for the user/client
   * @param {Object} options - Request options
   * @param {number} options.estimatedTokens - Estimated token usage
   * @param {number} options.estimatedCost - Estimated cost in USD
   * @returns {Promise<RateLimitResult>} Rate limit result
   */
  async checkAndAcquire(userId, { estimatedTokens = 1000, estimatedCost = 0.01 } = {}) {
    const now = Date.now();

    // Clean old entries for this user
    this._cleanupUser(userId, now);

    const history = this._requestHistory.get(userId) || [];
    const activeCount = this._activeRequests.get(userId) || 0;

    // Check 1: Concurrent requests
    if (activeCount >= this.config.concurrentRequests) {
      return this._reject(
        'Too many concurrent requests',
        1.0,
        this._getUsage(userId, now),
        null
      );
    }

    // Check 2: Requests per minute
    const minuteAgo = now - 60000;
    const minuteRequests = history.filter(e => e.timestamp > minuteAgo).length;
    if (minuteRequests >= this.config.requestsPerMinute) {
      const oldestInMinute = history.find(e => e.timestamp > minuteAgo);
      const waitTime = oldestInMinute
        ? Math.ceil((oldestInMinute.timestamp + 60000 - now) / 1000)
        : 60;
      return this._reject(
        'Request rate limit exceeded (per minute)',
        waitTime,
        this._getUsage(userId, now),
        'requestsPerMinute'
      );
    }

    // Check 3: Requests per hour
    const hourAgo = now - 3600000;
    const hourRequests = history.filter(e => e.timestamp > hourAgo).length;
    if (hourRequests >= this.config.requestsPerHour) {
      const oldestInHour = history.find(e => e.timestamp > hourAgo);
      const waitTime = oldestInHour
        ? Math.ceil((oldestInHour.timestamp + 3600000 - now) / 1000)
        : 3600;
      return this._reject(
        'Request rate limit exceeded (per hour)',
        waitTime,
        this._getUsage(userId, now),
        'requestsPerHour'
      );
    }

    // Check 4: Tokens per minute
    const minuteTokens = history
      .filter(e => e.timestamp > minuteAgo)
      .reduce((sum, e) => sum + e.tokens, 0);
    if (minuteTokens + estimatedTokens > this.config.tokensPerMinute) {
      return this._reject(
        'Token rate limit exceeded (per minute)',
        60,
        this._getUsage(userId, now),
        'tokensPerMinute'
      );
    }

    // Check 5: Tokens per hour
    const hourTokens = history
      .filter(e => e.timestamp > hourAgo)
      .reduce((sum, e) => sum + e.tokens, 0);
    if (hourTokens + estimatedTokens > this.config.tokensPerHour) {
      return this._reject(
        'Token rate limit exceeded (per hour)',
        3600,
        this._getUsage(userId, now),
        'tokensPerHour'
      );
    }

    // Check 6: Cost per minute
    const minuteCost = history
      .filter(e => e.timestamp > minuteAgo)
      .reduce((sum, e) => sum + e.cost, 0);
    if (minuteCost + estimatedCost > this.config.maxCostPerMinute) {
      return this._reject(
        'Cost limit exceeded (per minute)',
        60,
        this._getUsage(userId, now),
        'maxCostPerMinute'
      );
    }

    // Check 7: Cost per hour
    const hourCost = history
      .filter(e => e.timestamp > hourAgo)
      .reduce((sum, e) => sum + e.cost, 0);
    if (hourCost + estimatedCost > this.config.maxCostPerHour) {
      return this._reject(
        'Cost limit exceeded (per hour)',
        3600,
        this._getUsage(userId, now),
        'maxCostPerHour'
      );
    }

    // All checks passed - acquire slot
    this._activeRequests.set(userId, activeCount + 1);

    // Record request (with estimated values, to be updated on completion)
    history.push({
      timestamp: now,
      tokens: estimatedTokens,
      cost: estimatedCost,
      completed: false
    });
    this._requestHistory.set(userId, history);

    return {
      allowed: true,
      waitTimeSeconds: null,
      reason: null,
      currentUsage: this._getUsage(userId, now),
      limits: this._getLimits()
    };
  }

  /**
   * Release a request slot after completion
   *
   * @param {string} userId - User identifier
   * @param {Object} actualUsage - Actual usage values
   * @param {number} actualUsage.tokens - Actual token count
   * @param {number} actualUsage.cost - Actual cost
   */
  async release(userId, { tokens = 0, cost = 0 } = {}) {
    const activeCount = this._activeRequests.get(userId) || 0;
    this._activeRequests.set(userId, Math.max(0, activeCount - 1));

    // Update the most recent incomplete request with actual values
    const history = this._requestHistory.get(userId) || [];
    const incompleteIndex = history.findIndex(e => !e.completed);
    if (incompleteIndex !== -1) {
      history[incompleteIndex] = {
        ...history[incompleteIndex],
        tokens: tokens || history[incompleteIndex].tokens,
        cost: cost || history[incompleteIndex].cost,
        completed: true
      };
      this._requestHistory.set(userId, history);
    }
  }

  /**
   * Get current usage statistics for a user
   *
   * @param {string} userId - User identifier
   * @returns {Object} Usage statistics
   */
  getUsage(userId) {
    return this._getUsage(userId, Date.now());
  }

  /**
   * Get all usage statistics (for monitoring)
   *
   * @returns {Object} Global statistics
   */
  getGlobalStats() {
    const now = Date.now();
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;

    let totalActiveRequests = 0;
    let totalMinuteRequests = 0;
    let totalHourRequests = 0;
    let totalMinuteTokens = 0;
    let totalHourTokens = 0;
    let totalMinuteCost = 0;
    let totalHourCost = 0;

    for (const [userId, history] of this._requestHistory.entries()) {
      totalActiveRequests += this._activeRequests.get(userId) || 0;

      for (const entry of history) {
        if (entry.timestamp > minuteAgo) {
          totalMinuteRequests++;
          totalMinuteTokens += entry.tokens;
          totalMinuteCost += entry.cost;
        }
        if (entry.timestamp > hourAgo) {
          totalHourRequests++;
          totalHourTokens += entry.tokens;
          totalHourCost += entry.cost;
        }
      }
    }

    return {
      activeUsers: this._requestHistory.size,
      totalActiveRequests,
      minute: {
        requests: totalMinuteRequests,
        tokens: totalMinuteTokens,
        cost: totalMinuteCost
      },
      hour: {
        requests: totalHourRequests,
        tokens: totalHourTokens,
        cost: totalHourCost
      }
    };
  }

  /**
   * Reset limits for a specific user (admin function)
   *
   * @param {string} userId - User identifier
   */
  resetUser(userId) {
    this._requestHistory.delete(userId);
    this._activeRequests.delete(userId);
  }

  /**
   * Shutdown the rate limiter (cleanup interval)
   */
  shutdown() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  /**
   * Create rejection result
   * @private
   */
  _reject(reason, waitTimeSeconds, currentUsage, limitType) {
    return {
      allowed: false,
      waitTimeSeconds,
      reason,
      limitType,
      currentUsage,
      limits: this._getLimits()
    };
  }

  /**
   * Get current usage for a user
   * @private
   */
  _getUsage(userId, now) {
    const history = this._requestHistory.get(userId) || [];
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;

    const minuteHistory = history.filter(e => e.timestamp > minuteAgo);
    const hourHistory = history.filter(e => e.timestamp > hourAgo);

    return {
      activeRequests: this._activeRequests.get(userId) || 0,
      minute: {
        requests: minuteHistory.length,
        tokens: minuteHistory.reduce((sum, e) => sum + e.tokens, 0),
        cost: minuteHistory.reduce((sum, e) => sum + e.cost, 0)
      },
      hour: {
        requests: hourHistory.length,
        tokens: hourHistory.reduce((sum, e) => sum + e.tokens, 0),
        cost: hourHistory.reduce((sum, e) => sum + e.cost, 0)
      }
    };
  }

  /**
   * Get configured limits
   * @private
   */
  _getLimits() {
    return {
      requestsPerMinute: this.config.requestsPerMinute,
      requestsPerHour: this.config.requestsPerHour,
      tokensPerMinute: this.config.tokensPerMinute,
      tokensPerHour: this.config.tokensPerHour,
      concurrentRequests: this.config.concurrentRequests,
      maxCostPerMinute: this.config.maxCostPerMinute,
      maxCostPerHour: this.config.maxCostPerHour
    };
  }

  /**
   * Cleanup old entries for a specific user
   * @private
   */
  _cleanupUser(userId, now) {
    const history = this._requestHistory.get(userId);
    if (!history) return;

    // Keep only entries from the last hour
    const hourAgo = now - 3600000;
    const filtered = history.filter(e => e.timestamp > hourAgo);

    if (filtered.length !== history.length) {
      this._requestHistory.set(userId, filtered);
    }

    // Remove user entirely if no recent activity
    if (filtered.length === 0 && (this._activeRequests.get(userId) || 0) === 0) {
      this._requestHistory.delete(userId);
      this._activeRequests.delete(userId);
    }
  }

  /**
   * Run periodic cleanup across all users
   * @private
   */
  _runCleanup() {
    const now = Date.now();

    for (const userId of this._requestHistory.keys()) {
      this._cleanupUser(userId, now);
    }
  }
}

/**
 * Create a rate limiter with default configuration
 * @param {RateLimitConfig} config - Optional configuration
 * @returns {RateLimiter}
 */
export function createRateLimiter(config = {}) {
  return new RateLimiter(config);
}

/**
 * Token estimation utilities
 */
export const TokenEstimator = {
  /**
   * Estimate input tokens from text length
   * Rough estimate: 1 token ≈ 4 characters for English
   * @param {string} text - Input text
   * @returns {number} Estimated tokens
   */
  estimateInputTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  },

  /**
   * Estimate output tokens based on task type
   * @param {string} taskType - Type of task
   * @returns {number} Estimated output tokens
   */
  estimateOutputTokens(taskType) {
    const estimates = {
      roadmap: 4000,
      slides: 3000,
      document: 5000,
      'research-analysis': 2000,
      qa: 500,
      default: 2000
    };
    return estimates[taskType] || estimates.default;
  },

  /**
   * Estimate cost based on model and tokens
   * @param {string} model - Model identifier
   * @param {number} inputTokens - Input token count
   * @param {number} outputTokens - Output token count
   * @returns {number} Estimated cost in USD
   */
  estimateCost(model, inputTokens, outputTokens) {
    // Pricing per 1M tokens (approximate as of 2024)
    const pricing = {
      'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
      'gemini-2.0-flash': { input: 0.10, output: 0.40 },
      'gemini-2.5-flash': { input: 0.15, output: 0.60 },
      'gemini-2.5-flash-preview-09-2025': { input: 0.15, output: 0.60 },
      'gemini-2.5-pro': { input: 1.25, output: 5.00 },
      default: { input: 0.15, output: 0.60 }
    };

    const modelPricing = pricing[model] || pricing.default;
    const inputCost = (inputTokens / 1000000) * modelPricing.input;
    const outputCost = (outputTokens / 1000000) * modelPricing.output;

    return inputCost + outputCost;
  }
};

export default RateLimiter;
