/**
 * Optimization Layer - PROMPT ML Layer 9
 *
 * Unified export and orchestration for optimization:
 * - Prompt optimization
 * - Cache optimization
 * - Performance tuning
 * - Combined optimization pipeline
 *
 * Based on PROMPT ML design specification.
 */

// Prompt optimizer exports
export {
  PromptOptimizer,
  PromptTemplate,
  PromptVariant,
  OptimizationStrategy,
  getPromptOptimizer,
  resetPromptOptimizer
} from './prompt-optimizer.js';

// Cache optimizer exports
export {
  CacheOptimizer,
  EvictionPolicy,
  getCacheOptimizer,
  resetCacheOptimizer
} from './cache-optimizer.js';

// Performance tuner exports
export {
  PerformanceTuner,
  TuningMode,
  getPerformanceTuner,
  resetPerformanceTuner
} from './performance-tuner.js';

import { getPromptOptimizer } from './prompt-optimizer.js';
import { getCacheOptimizer } from './cache-optimizer.js';
import { getPerformanceTuner, TuningMode } from './performance-tuner.js';

/**
 * @typedef {Object} OptimizationConfig
 * @property {boolean} enablePromptOptimization - Enable prompt optimization
 * @property {boolean} enableCacheOptimization - Enable cache optimization
 * @property {boolean} enablePerformanceTuning - Enable performance tuning
 * @property {TuningMode} tuningMode - Performance tuning mode
 */

const DEFAULT_CONFIG = {
  enablePromptOptimization: true,
  enableCacheOptimization: true,
  enablePerformanceTuning: true,
  tuningMode: TuningMode.BALANCED
};

/**
 * Optimization Pipeline class
 * Orchestrates all optimization components
 */
export class OptimizationPipeline {
  /**
   * @param {OptimizationConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Lazy-load components
    this._promptOptimizer = null;
    this._cacheOptimizer = null;
    this._performanceTuner = null;
  }

  /**
   * Get prompt optimizer instance
   */
  get promptOptimizer() {
    if (!this._promptOptimizer && this.config.enablePromptOptimization) {
      this._promptOptimizer = getPromptOptimizer();
    }
    return this._promptOptimizer;
  }

  /**
   * Get cache optimizer instance
   */
  get cacheOptimizer() {
    if (!this._cacheOptimizer && this.config.enableCacheOptimization) {
      this._cacheOptimizer = getCacheOptimizer();
    }
    return this._cacheOptimizer;
  }

  /**
   * Get performance tuner instance
   */
  get performanceTuner() {
    if (!this._performanceTuner && this.config.enablePerformanceTuning) {
      this._performanceTuner = getPerformanceTuner({
        mode: this.config.tuningMode
      });
    }
    return this._performanceTuner;
  }

  /**
   * Optimize request before execution
   *
   * @param {Object} request - Request details
   * @returns {Object} Optimized request
   */
  optimizeRequest(request) {
    const { contentType, prompt, cacheKey } = request;
    const optimizations = {
      applied: [],
      settings: {}
    };

    // 1. Check cache first
    if (this.config.enableCacheOptimization && this.cacheOptimizer) {
      const cached = this.cacheOptimizer.get(cacheKey, {
        contentType,
        prompt,
        allowSimilar: true
      });

      if (cached) {
        optimizations.applied.push('cache_hit');
        return {
          ...request,
          cached: true,
          cachedResult: cached,
          optimizations
        };
      }
    }

    // 2. Select optimal prompt variant
    if (this.config.enablePromptOptimization && this.promptOptimizer) {
      const variant = this.promptOptimizer.selectVariant(contentType);
      if (variant) {
        optimizations.applied.push('prompt_variant');
        optimizations.settings.variantId = variant.id;
        optimizations.settings.variantName = variant.name;
      }
    }

    // 3. Get optimized performance settings
    if (this.config.enablePerformanceTuning && this.performanceTuner) {
      const perfSettings = this.performanceTuner.getOptimizedSettings(contentType);
      optimizations.applied.push('performance_tuning');
      optimizations.settings.timeout = perfSettings.timeout;
      optimizations.settings.canStartNow = perfSettings.canStartNow;
    }

    return {
      ...request,
      cached: false,
      optimizations
    };
  }

  /**
   * Record request result for optimization learning
   *
   * @param {Object} request - Original request
   * @param {Object} result - Request result
   */
  recordResult(request, result) {
    const { contentType, cacheKey, prompt } = request;
    const { success, latency, quality, output, timeout, error, variantId } = result;

    // Record for prompt optimization
    if (this.config.enablePromptOptimization && this.promptOptimizer && variantId) {
      this.promptOptimizer.recordResult(contentType, variantId, {
        success,
        latency,
        quality
      });
    }

    // Cache successful results
    if (this.config.enableCacheOptimization && this.cacheOptimizer && success && output) {
      this.cacheOptimizer.set(cacheKey, output, {
        contentType,
        prompt,
        qualityScore: quality
      });
    }

    // Record for performance tuning
    if (this.config.enablePerformanceTuning && this.performanceTuner) {
      this.performanceTuner.recordResult(contentType, {
        success,
        latency,
        timeout,
        error
      });
    }
  }

  /**
   * Get optimized timeout for content type
   *
   * @param {string} contentType - Content type
   * @returns {number} Timeout in ms
   */
  getOptimizedTimeout(contentType) {
    if (this.performanceTuner) {
      return this.performanceTuner.getOptimizedSettings(contentType).timeout;
    }
    return 120000; // Default
  }

  /**
   * Check if request can start (concurrency check)
   *
   * @returns {boolean}
   */
  canStartRequest() {
    if (this.performanceTuner) {
      return this.performanceTuner.concurrencyOptimizer.canStartRequest();
    }
    return true;
  }

  /**
   * Track request lifecycle
   */
  trackRequestStart() {
    if (this.performanceTuner) {
      this.performanceTuner.startRequest();
    }
  }

  trackRequestEnd() {
    if (this.performanceTuner) {
      this.performanceTuner.endRequest();
    }
  }

  /**
   * Run auto-tuning cycle
   *
   * @returns {Object} Tuning results
   */
  autoTune() {
    const results = {
      timestamp: new Date().toISOString(),
      actions: []
    };

    // Performance tuning
    if (this.performanceTuner) {
      const perfRecommendations = this.performanceTuner.autoTune();
      results.actions.push(...perfRecommendations.map(r => ({
        component: 'performance',
        ...r
      })));
    }

    // Prompt optimization recommendations
    if (this.promptOptimizer) {
      const promptRecommendations = this.promptOptimizer.getRecommendations();
      results.actions.push(...promptRecommendations.map(r => ({
        component: 'prompt',
        ...r
      })));
    }

    // Cache optimization recommendations
    if (this.cacheOptimizer) {
      const cacheRecommendations = this.cacheOptimizer.getRecommendations();
      results.actions.push(...cacheRecommendations.map(r => ({
        component: 'cache',
        ...r
      })));
    }

    return results;
  }

  /**
   * Get comprehensive optimization summary
   *
   * @returns {Object} Summary
   */
  getSummary() {
    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      prompt: this.promptOptimizer ? {
        experiments: this.promptOptimizer.getExperimentStats(),
        recommendations: this.promptOptimizer.getRecommendations()
      } : null,
      cache: this.cacheOptimizer ? {
        stats: this.cacheOptimizer.getStats(),
        recommendations: this.cacheOptimizer.getRecommendations()
      } : null,
      performance: this.performanceTuner ? {
        summary: this.performanceTuner.getSummary(),
        recommendations: this.performanceTuner.getRecommendations()
      } : null
    };
  }

  /**
   * Get all optimization recommendations
   *
   * @returns {Array} Combined recommendations
   */
  getAllRecommendations() {
    const recommendations = [];

    if (this.promptOptimizer) {
      recommendations.push(...this.promptOptimizer.getRecommendations().map(r => ({
        source: 'prompt',
        ...r
      })));
    }

    if (this.cacheOptimizer) {
      recommendations.push(...this.cacheOptimizer.getRecommendations().map(r => ({
        source: 'cache',
        ...r
      })));
    }

    if (this.performanceTuner) {
      recommendations.push(...this.performanceTuner.getRecommendations().map(r => ({
        source: 'performance',
        ...r
      })));
    }

    return recommendations;
  }

  /**
   * Set performance tuning mode
   *
   * @param {TuningMode} mode - Tuning mode
   */
  setTuningMode(mode) {
    this.config.tuningMode = mode;
    if (this.performanceTuner) {
      this.performanceTuner.setMode(mode);
    }
  }

  /**
   * Warm cache with predictions
   *
   * @param {Array} predictions - Predicted requests
   */
  async warmCache(predictions) {
    if (!this.cacheOptimizer) return;

    for (const prediction of predictions) {
      this.cacheOptimizer.scheduleWarming(prediction);
    }
  }
}

// Singleton instance
let _pipeline = null;

/**
 * Get or create singleton optimization pipeline
 * @param {OptimizationConfig} config - Configuration (only used on first call)
 * @returns {OptimizationPipeline}
 */
export function getOptimizationPipeline(config = {}) {
  if (!_pipeline) {
    _pipeline = new OptimizationPipeline(config);
  }
  return _pipeline;
}

/**
 * Reset pipeline instance (for testing)
 */
export function resetOptimizationPipeline() {
  _pipeline = null;
}

/**
 * Quick optimize request function
 *
 * @param {Object} request - Request to optimize
 * @returns {Object} Optimized request
 */
export function optimizeRequest(request) {
  return getOptimizationPipeline().optimizeRequest(request);
}

/**
 * Quick record result function
 *
 * @param {Object} request - Original request
 * @param {Object} result - Request result
 */
export function recordOptimizationResult(request, result) {
  return getOptimizationPipeline().recordResult(request, result);
}

export default OptimizationPipeline;
