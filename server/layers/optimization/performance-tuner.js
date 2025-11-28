/**
 * Performance Tuner - PROMPT ML Layer 9
 *
 * Runtime performance optimization:
 * - Request batching
 * - Concurrency optimization
 * - Adaptive timeouts
 * - Resource pooling
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Tuning modes
 * @readonly
 * @enum {string}
 */
export const TuningMode = {
  CONSERVATIVE: 'conservative',  // Prioritize reliability
  BALANCED: 'balanced',          // Balance speed and reliability
  AGGRESSIVE: 'aggressive',      // Prioritize speed
  AUTO: 'auto'                   // Automatically adjust
};

/**
 * @typedef {Object} TuningConfig
 * @property {TuningMode} mode - Tuning mode
 * @property {number} maxConcurrency - Maximum concurrent requests
 * @property {number} baseTimeout - Base timeout (ms)
 * @property {number} batchSize - Batch size for requests
 * @property {number} batchDelay - Delay between batches (ms)
 */

const DEFAULT_CONFIG = {
  mode: TuningMode.BALANCED,
  maxConcurrency: 4,
  baseTimeout: 120000,
  batchSize: 4,
  batchDelay: 100
};

/**
 * Request statistics tracker
 */
class RequestStatsTracker {
  constructor(windowSize = 100) {
    this.windowSize = windowSize;
    this.latencies = [];
    this.errors = [];
    this.timeouts = [];
  }

  recordLatency(latency) {
    this.latencies.push({ value: latency, timestamp: Date.now() });
    this._trimToWindow();
  }

  recordError(error) {
    this.errors.push({ error, timestamp: Date.now() });
    this._trimToWindow();
  }

  recordTimeout() {
    this.timeouts.push({ timestamp: Date.now() });
    this._trimToWindow();
  }

  getStats() {
    const recentLatencies = this.latencies.map(l => l.value);
    if (recentLatencies.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0, errorRate: 0, timeoutRate: 0 };
    }

    const sorted = [...recentLatencies].sort((a, b) => a - b);
    const total = this.latencies.length + this.errors.length + this.timeouts.length;

    return {
      avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1],
      errorRate: total > 0 ? this.errors.length / total : 0,
      timeoutRate: total > 0 ? this.timeouts.length / total : 0,
      sampleSize: this.latencies.length
    };
  }

  _trimToWindow() {
    const cutoff = Date.now() - 600000; // 10 minute window
    this.latencies = this.latencies.filter(l => l.timestamp > cutoff).slice(-this.windowSize);
    this.errors = this.errors.filter(e => e.timestamp > cutoff).slice(-this.windowSize);
    this.timeouts = this.timeouts.filter(t => t.timestamp > cutoff).slice(-this.windowSize);
  }
}

/**
 * Adaptive Timeout Calculator
 */
class AdaptiveTimeoutCalculator {
  constructor(baseTimeout = 120000) {
    this.baseTimeout = baseTimeout;
    this.contentTypeMultipliers = {
      roadmap: 1.5,          // Complex, needs more time
      slides: 0.8,           // Generally faster
      document: 1.2,         // Moderate complexity
      'research-analysis': 1.0
    };
  }

  /**
   * Calculate optimal timeout
   * @param {string} contentType - Content type
   * @param {Object} stats - Request statistics
   * @returns {number} Timeout in ms
   */
  calculate(contentType, stats = {}) {
    let timeout = this.baseTimeout;

    // Apply content type multiplier
    const multiplier = this.contentTypeMultipliers[contentType] || 1.0;
    timeout *= multiplier;

    // Adjust based on recent latency stats
    if (stats.p95) {
      // Set timeout to p95 + buffer
      const latencyBasedTimeout = stats.p95 * 1.5;
      timeout = Math.max(timeout, latencyBasedTimeout);
    }

    // Adjust for error rate
    if (stats.errorRate > 0.1) {
      // High error rate - increase timeout to reduce timeouts
      timeout *= 1.3;
    }

    // Cap timeout
    return Math.min(Math.max(timeout, 30000), 600000); // 30s to 10min
  }

  /**
   * Update multiplier based on performance
   * @param {string} contentType
   * @param {Object} stats
   */
  updateMultiplier(contentType, stats) {
    if (!this.contentTypeMultipliers[contentType]) return;

    const current = this.contentTypeMultipliers[contentType];

    // If timeout rate is high, increase multiplier
    if (stats.timeoutRate > 0.05) {
      this.contentTypeMultipliers[contentType] = Math.min(current * 1.1, 3.0);
    }
    // If we have headroom and no timeouts, decrease slightly
    else if (stats.timeoutRate === 0 && stats.sampleSize > 10) {
      this.contentTypeMultipliers[contentType] = Math.max(current * 0.95, 0.5);
    }
  }
}

/**
 * Concurrency Optimizer
 */
class ConcurrencyOptimizer {
  constructor(initialConcurrency = 4) {
    this.currentConcurrency = initialConcurrency;
    this.minConcurrency = 1;
    this.maxConcurrency = 8;
    this.activeRequests = 0;
    this.adjustmentHistory = [];
  }

  /**
   * Get current optimal concurrency
   * @param {Object} stats - Current stats
   * @returns {number}
   */
  getOptimalConcurrency(stats = {}) {
    // Adjust based on error rate
    if (stats.errorRate > 0.15) {
      this._adjustConcurrency(-1, 'High error rate');
    } else if (stats.errorRate < 0.02 && stats.sampleSize > 20) {
      this._adjustConcurrency(1, 'Low error rate');
    }

    // Adjust based on latency
    if (stats.p95 > 180000) { // > 3 minutes
      this._adjustConcurrency(-1, 'High latency');
    }

    return this.currentConcurrency;
  }

  /**
   * Check if new request can start
   * @returns {boolean}
   */
  canStartRequest() {
    return this.activeRequests < this.currentConcurrency;
  }

  /**
   * Track request start
   */
  startRequest() {
    this.activeRequests++;
  }

  /**
   * Track request end
   */
  endRequest() {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  _adjustConcurrency(delta, reason) {
    const newValue = Math.min(
      Math.max(this.currentConcurrency + delta, this.minConcurrency),
      this.maxConcurrency
    );

    if (newValue !== this.currentConcurrency) {
      this.adjustmentHistory.push({
        from: this.currentConcurrency,
        to: newValue,
        reason,
        timestamp: new Date().toISOString()
      });
      this.currentConcurrency = newValue;
    }
  }

  getHistory() {
    return this.adjustmentHistory.slice(-20);
  }
}

/**
 * Request Batcher
 */
class RequestBatcher {
  constructor(config = {}) {
    this.batchSize = config.batchSize || 4;
    this.batchDelay = config.batchDelay || 100;
    this.queue = [];
    this.processing = false;
  }

  /**
   * Add request to batch
   * @param {Function} request - Request function
   * @param {number} priority - Priority (lower = higher)
   * @returns {Promise} Result promise
   */
  add(request, priority = 5) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        request,
        priority,
        resolve,
        reject,
        addedAt: Date.now()
      });

      // Sort by priority
      this.queue.sort((a, b) => a.priority - b.priority);

      // Start processing if not already
      this._startProcessing();
    });
  }

  async _startProcessing() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Take batch
      const batch = this.queue.splice(0, this.batchSize);

      // Execute batch in parallel
      await Promise.all(batch.map(async item => {
        try {
          const result = await item.request();
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
      }));

      // Delay between batches
      if (this.queue.length > 0) {
        await new Promise(r => setTimeout(r, this.batchDelay));
      }
    }

    this.processing = false;
  }

  getQueueSize() {
    return this.queue.length;
  }
}

/**
 * Performance Tuner class
 */
export class PerformanceTuner {
  /**
   * @param {TuningConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = new Map(); // contentType -> RequestStatsTracker
    this.timeoutCalculator = new AdaptiveTimeoutCalculator(this.config.baseTimeout);
    this.concurrencyOptimizer = new ConcurrencyOptimizer(this.config.maxConcurrency);
    this.batcher = new RequestBatcher(this.config);
    this.tuningHistory = [];
  }

  /**
   * Get optimized settings for a request
   * @param {string} contentType - Content type
   * @returns {Object} Optimized settings
   */
  getOptimizedSettings(contentType) {
    const stats = this._getStats(contentType);
    const requestStats = stats.getStats();

    return {
      timeout: this.timeoutCalculator.calculate(contentType, requestStats),
      concurrency: this.concurrencyOptimizer.getOptimalConcurrency(requestStats),
      canStartNow: this.concurrencyOptimizer.canStartRequest(),
      queueSize: this.batcher.getQueueSize(),
      stats: requestStats
    };
  }

  /**
   * Record request result
   * @param {string} contentType - Content type
   * @param {Object} result - Request result
   */
  recordResult(contentType, result) {
    const stats = this._getStats(contentType);

    if (result.success) {
      stats.recordLatency(result.latency);
    } else if (result.timeout) {
      stats.recordTimeout();
    } else {
      stats.recordError(result.error);
    }

    // Update timeout calculator
    this.timeoutCalculator.updateMultiplier(contentType, stats.getStats());
  }

  /**
   * Request tracking - start
   */
  startRequest() {
    this.concurrencyOptimizer.startRequest();
  }

  /**
   * Request tracking - end
   */
  endRequest() {
    this.concurrencyOptimizer.endRequest();
  }

  /**
   * Add request to batch queue
   * @param {Function} request - Request function
   * @param {number} priority - Priority
   * @returns {Promise}
   */
  batchRequest(request, priority = 5) {
    return this.batcher.add(request, priority);
  }

  /**
   * Auto-tune based on mode
   */
  autoTune() {
    const allStats = {};
    for (const [ct, tracker] of this.stats) {
      allStats[ct] = tracker.getStats();
    }

    const recommendations = [];

    // Analyze overall performance
    const avgErrorRate = Object.values(allStats)
      .reduce((sum, s) => sum + s.errorRate, 0) / Object.keys(allStats).length || 0;

    const avgLatency = Object.values(allStats)
      .reduce((sum, s) => sum + s.avg, 0) / Object.keys(allStats).length || 0;

    // Mode-specific tuning
    switch (this.config.mode) {
      case TuningMode.AGGRESSIVE:
        if (avgErrorRate < 0.05) {
          recommendations.push({
            action: 'increase_concurrency',
            reason: 'Low error rate allows higher concurrency'
          });
        }
        break;

      case TuningMode.CONSERVATIVE:
        if (avgErrorRate > 0.02) {
          recommendations.push({
            action: 'decrease_concurrency',
            reason: 'Prioritizing reliability over speed'
          });
        }
        break;

      case TuningMode.AUTO:
        // Automatically adjust based on metrics
        if (avgErrorRate > 0.1) {
          this.config.maxConcurrency = Math.max(1, this.config.maxConcurrency - 1);
          recommendations.push({
            action: 'auto_decrease_concurrency',
            newValue: this.config.maxConcurrency
          });
        } else if (avgErrorRate < 0.02 && avgLatency < 60000) {
          this.config.maxConcurrency = Math.min(8, this.config.maxConcurrency + 1);
          recommendations.push({
            action: 'auto_increase_concurrency',
            newValue: this.config.maxConcurrency
          });
        }
        break;
    }

    // Record tuning history
    this.tuningHistory.push({
      timestamp: new Date().toISOString(),
      mode: this.config.mode,
      stats: allStats,
      recommendations
    });

    return recommendations;
  }

  /**
   * Get performance summary
   * @returns {Object}
   */
  getSummary() {
    const contentTypeStats = {};
    for (const [ct, tracker] of this.stats) {
      contentTypeStats[ct] = tracker.getStats();
    }

    return {
      mode: this.config.mode,
      currentConcurrency: this.concurrencyOptimizer.currentConcurrency,
      activeRequests: this.concurrencyOptimizer.activeRequests,
      queueSize: this.batcher.getQueueSize(),
      contentTypeStats,
      concurrencyHistory: this.concurrencyOptimizer.getHistory(),
      recentTuning: this.tuningHistory.slice(-5)
    };
  }

  /**
   * Get optimization recommendations
   * @returns {Array}
   */
  getRecommendations() {
    const recommendations = [];

    for (const [contentType, tracker] of this.stats) {
      const stats = tracker.getStats();

      if (stats.timeoutRate > 0.1) {
        recommendations.push({
          contentType,
          type: 'high_timeout_rate',
          message: `${contentType} has ${(stats.timeoutRate * 100).toFixed(1)}% timeout rate. Consider increasing timeout.`,
          currentTimeout: this.timeoutCalculator.calculate(contentType, stats)
        });
      }

      if (stats.errorRate > 0.15) {
        recommendations.push({
          contentType,
          type: 'high_error_rate',
          message: `${contentType} has ${(stats.errorRate * 100).toFixed(1)}% error rate. Consider reducing concurrency.`
        });
      }

      if (stats.p95 > 180000) {
        recommendations.push({
          contentType,
          type: 'high_latency',
          message: `${contentType} p95 latency is ${Math.round(stats.p95 / 1000)}s. Consider optimizing prompts.`
        });
      }
    }

    return recommendations;
  }

  /**
   * Set tuning mode
   * @param {TuningMode} mode
   */
  setMode(mode) {
    this.config.mode = mode;

    // Apply mode-specific defaults
    switch (mode) {
      case TuningMode.AGGRESSIVE:
        this.config.maxConcurrency = 6;
        this.config.baseTimeout = 90000;
        break;
      case TuningMode.CONSERVATIVE:
        this.config.maxConcurrency = 2;
        this.config.baseTimeout = 180000;
        break;
      case TuningMode.BALANCED:
        this.config.maxConcurrency = 4;
        this.config.baseTimeout = 120000;
        break;
    }

    this.concurrencyOptimizer.currentConcurrency = this.config.maxConcurrency;
    this.concurrencyOptimizer.maxConcurrency = this.config.maxConcurrency;
    this.timeoutCalculator.baseTimeout = this.config.baseTimeout;
  }

  _getStats(contentType) {
    if (!this.stats.has(contentType)) {
      this.stats.set(contentType, new RequestStatsTracker());
    }
    return this.stats.get(contentType);
  }
}

// Singleton instance
let _tuner = null;

/**
 * Get or create singleton performance tuner
 * @param {TuningConfig} config - Configuration
 * @returns {PerformanceTuner}
 */
export function getPerformanceTuner(config = {}) {
  if (!_tuner) {
    _tuner = new PerformanceTuner(config);
  }
  return _tuner;
}

/**
 * Reset performance tuner (for testing)
 */
export function resetPerformanceTuner() {
  _tuner = null;
}

export default PerformanceTuner;
