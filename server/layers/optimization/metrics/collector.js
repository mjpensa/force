/**
 * Metrics Collector - Auto-Improving Prompts Phase 1
 *
 * Collects and stores metrics for prompt optimization.
 * Supports batch inserts, feedback updates, and aggregate queries.
 */

import crypto from 'crypto';
import { createDefaultMetric, validateMetric } from './schema.js';
import { createStorage } from './storage.js';
import { getVariantRegistry } from '../variants/index.js';

/**
 * Metrics Collector class
 * Central service for recording and querying prompt performance metrics
 */
export class MetricsCollector {
  /**
   * @param {Object} config - Configuration options
   * @param {Object} config.storage - Storage backend or config
   * @param {number} config.batchSize - Flush buffer when this many items
   * @param {number} config.flushIntervalMs - Auto-flush interval
   */
  constructor(config = {}) {
    this.storage = config.storage || createStorage(config.storageConfig);
    this.batchSize = config.batchSize || 100;
    this.flushIntervalMs = config.flushIntervalMs || 30000;

    this._buffer = [];
    this._flushTimer = null;
    this._flushing = false;
    this._startFlushTimer();

    // Statistics
    this._stats = {
      totalRecorded: 0,
      totalFlushed: 0,
      totalFeedbackUpdates: 0,
      errors: 0
    };
  }

  /**
   * Record a new generation event
   *
   * @param {Object} data - Generation data
   * @returns {string} Generation ID
   */
  recordGeneration(data) {
    const metric = createDefaultMetric();

    // Generate unique ID
    metric.generationId = data.generationId || crypto.randomUUID();
    metric.timestamp = new Date();

    // Prompt version info
    metric.promptVersion = {
      contentType: data.contentType || 'unknown',
      variantId: data.variantId || 'default',
      promptHash: this._hashPrompt(data.prompt),
      timestamp: new Date()
    };

    // Input metrics
    metric.input = {
      userPromptLength: data.userPrompt?.length || 0,
      userPromptComplexity: data.complexity || 0,
      fileCount: data.fileCount || 0,
      totalInputTokens: data.inputTokens || 0,
      topicsDetected: data.topics || []
    };

    // Execution metrics
    metric.execution = {
      model: data.model || 'gemini-1.5-pro',
      latencyMs: data.latencyMs || 0,
      inputTokens: data.inputTokens || 0,
      outputTokens: data.outputTokens || 0,
      retryCount: data.retryCount || 0,
      cacheHit: data.cacheHit || false
    };

    // Quality metrics from validation
    if (data.validation) {
      metric.quality = {
        validationPassed: data.validation.valid ?? true,
        validationErrors: data.validation.errors || [],
        safetyPassed: data.validation.safe ?? true,
        safetyConcerns: data.validation.concerns || [],
        qualityScore: data.validation.quality?.score || 0,
        qualityGrade: data.validation.quality?.grade || 'N/A',
        dimensions: data.validation.quality?.dimensions || {}
      };
    }

    // Validate before storing
    const validation = validateMetric(metric);
    if (!validation.valid) {
      console.warn('[MetricsCollector] Invalid metric:', validation.errors);
      this._stats.errors++;
    }

    // Store variantId at top level for easier access
    metric.variantId = metric.promptVersion.variantId;

    // Add to buffer
    this._buffer.push(metric);
    this._stats.totalRecorded++;

    // Auto-flush if buffer is full (fire and forget with error handling)
    if (this._buffer.length >= this.batchSize) {
      this._flush().catch(err => {
        console.warn('[MetricsCollector] Background flush error:', err.message);
      });
    }

    return metric.generationId;
  }

  /**
   * Update feedback for a generation
   *
   * @param {string} generationId - Generation to update
   * @param {Object} feedback - Feedback data
   * @returns {Promise<boolean>} Success
   */
  async updateFeedback(generationId, feedback) {
    let variantId = null;

    // First check buffer
    const buffered = this._buffer.find(m => m.generationId === generationId);
    if (buffered) {
      buffered.feedback = { ...buffered.feedback, ...feedback };
      buffered.feedbackUpdatedAt = new Date();
      this._stats.totalFeedbackUpdates++;
      variantId = buffered.variantId;
    } else {
      // Then check storage
      const result = await this.storage.updateFeedback(generationId, feedback);
      if (result) {
        this._stats.totalFeedbackUpdates++;
        // Get variant ID from storage if available
        const metric = await this.storage.getById?.(generationId);
        variantId = metric?.variantId;
      } else {
        return false;
      }
    }

    // Also update variant performance with feedback rating
    if (variantId && feedback.rating !== undefined) {
      try {
        const registry = getVariantRegistry();
        registry.updatePerformance(variantId, {
          feedback: feedback.rating
        });
      } catch (error) {
        // Log but don't fail - variant performance is secondary
        console.warn(`[MetricsCollector] Failed to update variant performance: ${error.message}`);
      }
    }

    return true;
  }

  /**
   * Get metrics for a specific variant
   *
   * @param {string} variantId - Variant ID to query
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Aggregated metrics
   */
  async getVariantMetrics(variantId, options = {}) {
    const { startDate, endDate, minSamples = 10 } = options;

    // Flush buffer to ensure latest data
    await this._flush();

    const metrics = await this.storage.queryByVariant(variantId, { startDate, endDate });

    if (metrics.length < minSamples) {
      return {
        insufficient: true,
        sampleCount: metrics.length,
        minRequired: minSamples
      };
    }

    return this._aggregateMetrics(metrics);
  }

  /**
   * Get metrics for a content type
   *
   * @param {string} contentType - Content type to query
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Aggregated metrics
   */
  async getContentTypeMetrics(contentType, options = {}) {
    await this._flush();

    const metrics = await this.storage.queryByContentType(contentType, options);
    return this._aggregateMetrics(metrics);
  }

  /**
   * Get comparative metrics for A/B test
   *
   * @param {string[]} variantIds - Variants to compare
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Comparison results
   */
  async getABTestResults(variantIds, options = {}) {
    const results = {};

    for (const variantId of variantIds) {
      results[variantId] = await this.getVariantMetrics(variantId, options);
    }

    return {
      variants: results,
      winner: this._determineWinner(results),
      confidence: this._calculateConfidence(results),
      recommendation: this._generateRecommendation(results)
    };
  }

  /**
   * Get a specific generation by ID
   *
   * @param {string} generationId - Generation ID
   * @returns {Promise<Object|null>} Metric or null
   */
  async getGeneration(generationId) {
    // Check buffer first
    const buffered = this._buffer.find(m => m.generationId === generationId);
    if (buffered) {
      return buffered;
    }

    return this.storage.getById(generationId);
  }

  /**
   * Get collector statistics
   *
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    const storageStats = await this.storage.getStats();

    return {
      ...this._stats,
      bufferSize: this._buffer.length,
      storage: storageStats
    };
  }

  /**
   * Force flush buffer to storage
   */
  async flush() {
    await this._flush();
  }

  /**
   * Shutdown collector gracefully
   */
  async shutdown() {
    this._stopFlushTimer();

    await this._flush();

    if (this.storage.shutdown) {
      await this.storage.shutdown();
    }
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  _hashPrompt(prompt) {
    if (!prompt) return '';
    return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
  }

  async _flush() {
    if (this._buffer.length === 0) return;
    if (this._flushing) return; // Prevent concurrent flushes

    this._flushing = true;
    const toFlush = this._buffer.splice(0, this._buffer.length);

    try {
      await this.storage.batchInsert(toFlush);
      this._stats.totalFlushed += toFlush.length;
    } catch (error) {
      console.error('[MetricsCollector] Flush error:', error.message);
      // Put items back in buffer
      this._buffer.unshift(...toFlush);
      this._stats.errors++;
    } finally {
      this._flushing = false;
    }
  }

  _startFlushTimer() {
    // Use recursive setTimeout to prevent concurrent flushes
    const scheduleNext = () => {
      this._flushTimer = setTimeout(async () => {
        await this._flush();
        scheduleNext();
      }, this.flushIntervalMs);
    };
    scheduleNext();
  }

  _stopFlushTimer() {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
  }

  _aggregateMetrics(metrics) {
    const n = metrics.length;
    if (n === 0) {
      return { insufficient: true, sampleCount: 0 };
    }

    // Execution metrics
    const latencies = metrics.map(m => m.execution?.latencyMs || 0);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / n;
    const sortedLatencies = [...latencies].sort((a, b) => a - b);

    // Quality metrics (with null checks)
    const qualityScores = metrics.map(m => m.quality?.qualityScore || 0);
    const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / n;
    const successRate = metrics.filter(m => m.quality?.validationPassed).length / n;

    // Feedback metrics (only for items with feedback, with null checks)
    const withRating = metrics.filter(m => m.feedback?.rating !== null && m.feedback?.rating !== undefined);
    const withEdit = metrics.filter(m => m.feedback?.wasEdited !== null && m.feedback?.wasEdited !== undefined);
    const withExport = metrics.filter(m => m.feedback?.wasExported !== null && m.feedback?.wasExported !== undefined);

    const avgRating = withRating.length > 0
      ? withRating.reduce((s, m) => s + m.feedback.rating, 0) / withRating.length
      : null;

    const editRate = withEdit.length > 0
      ? withEdit.filter(m => m.feedback.wasEdited).length / withEdit.length
      : null;

    const exportRate = withExport.length > 0
      ? withExport.filter(m => m.feedback.wasExported).length / withExport.length
      : null;

    const regenerateRate = metrics.filter(m => m.feedback?.wasRegenerated).length / n;

    // Grade distribution
    const gradeDistribution = this._countGrades(metrics);

    // Dimension averages
    const dimensionAverages = this._averageDimensions(metrics);

    // Calculate time range safely (convert dates to timestamps)
    const timestamps = metrics.map(m => m.timestamp?.getTime?.() || Date.now());

    return {
      sampleCount: n,
      feedbackCount: withRating.length,
      timeRange: {
        start: new Date(Math.min(...timestamps)),
        end: new Date(Math.max(...timestamps))
      },
      execution: {
        avgLatencyMs: Math.round(avgLatency),
        p50LatencyMs: this._percentile(sortedLatencies, 50),
        p95LatencyMs: this._percentile(sortedLatencies, 95),
        p99LatencyMs: this._percentile(sortedLatencies, 99),
        avgInputTokens: Math.round(metrics.reduce((s, m) => s + (m.execution?.inputTokens || 0), 0) / n),
        avgOutputTokens: Math.round(metrics.reduce((s, m) => s + (m.execution?.outputTokens || 0), 0) / n),
        cacheHitRate: metrics.filter(m => m.execution?.cacheHit).length / n,
        avgRetries: metrics.reduce((s, m) => s + (m.execution?.retryCount || 0), 0) / n
      },
      quality: {
        avgScore: avgQuality,
        successRate,
        safetyPassRate: metrics.filter(m => m.quality?.safetyPassed).length / n,
        gradeDistribution,
        dimensions: dimensionAverages
      },
      feedback: {
        avgRating,
        ratingCount: withRating.length,
        editRate,
        exportRate,
        regenerateRate,
        positiveRate: withRating.length > 0
          ? withRating.filter(m => m.feedback.rating >= 4).length / withRating.length
          : null
      }
    };
  }

  _percentile(sortedArr, p) {
    if (sortedArr.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, idx)];
  }

  _countGrades(metrics) {
    return metrics.reduce((acc, m) => {
      const grade = m.quality?.qualityGrade || 'N/A';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});
  }

  _averageDimensions(metrics) {
    const dimensions = {};
    const counts = {};

    for (const metric of metrics) {
      for (const [key, value] of Object.entries(metric.quality?.dimensions || {})) {
        if (typeof value === 'number') {
          dimensions[key] = (dimensions[key] || 0) + value;
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    }

    const averages = {};
    for (const key of Object.keys(dimensions)) {
      averages[key] = dimensions[key] / counts[key];
    }

    return averages;
  }

  _determineWinner(results) {
    let best = null;
    let bestScore = -1;

    for (const [variantId, metrics] of Object.entries(results)) {
      if (metrics.insufficient) continue;

      // Composite score: 50% quality, 30% feedback, 20% efficiency
      const qualityComponent = metrics.quality.avgScore * 0.5;
      const feedbackComponent = ((metrics.feedback.avgRating || 3) / 5) * 0.3;
      const efficiencyComponent = (1 - Math.min(metrics.execution.avgLatencyMs / 30000, 1)) * 0.2;

      const score = qualityComponent + feedbackComponent + efficiencyComponent;

      if (score > bestScore) {
        bestScore = score;
        best = variantId;
      }
    }

    return best;
  }

  _calculateConfidence(results) {
    const validResults = Object.values(results).filter(r => !r.insufficient);
    if (validResults.length < 2) return 0;

    const scores = validResults.map(r => r.quality.avgScore);
    const maxDiff = Math.max(...scores) - Math.min(...scores);
    const avgSamples = validResults.reduce((s, r) => s + r.sampleCount, 0) / validResults.length;

    // Higher confidence with more samples and larger differences
    // Simple heuristic - production should use proper statistical tests
    const sampleFactor = Math.min(1, avgSamples / 100);
    const diffFactor = Math.min(1, maxDiff * 5);

    return Math.min(1, sampleFactor * 0.6 + diffFactor * 0.4);
  }

  _generateRecommendation(results) {
    const validResults = Object.entries(results).filter(([, r]) => !r.insufficient);

    if (validResults.length === 0) {
      return 'Insufficient data for recommendation. Need more samples.';
    }

    if (validResults.length === 1) {
      return 'Only one variant has sufficient data. Continue collecting.';
    }

    const confidence = this._calculateConfidence(results);

    if (confidence < 0.5) {
      return 'Low confidence. Continue experiment to gather more data.';
    }

    if (confidence < 0.8) {
      return 'Moderate confidence. Consider running longer or with more traffic.';
    }

    const winner = this._determineWinner(results);
    return `High confidence. Recommend promoting "${winner}" to production.`;
  }
}

// ============================================================================
// Singleton management
// ============================================================================

let _collector = null;

/**
 * Get or create singleton metrics collector
 * @param {Object} config - Configuration (only used on first call)
 * @returns {MetricsCollector}
 */
export function getMetricsCollector(config) {
  if (!_collector) {
    _collector = new MetricsCollector(config);
  }
  return _collector;
}

/**
 * Reset singleton (for testing)
 */
export function resetMetricsCollector() {
  if (_collector) {
    _collector.shutdown();
    _collector = null;
  }
}

export default MetricsCollector;
