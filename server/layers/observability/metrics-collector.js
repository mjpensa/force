/**
 * Metrics Collector - PROMPT ML Layer 7
 *
 * Collects and aggregates LLM-specific metrics:
 * - Token usage tracking
 * - Latency percentiles
 * - Quality score distributions
 * - Safety flag rates
 * - Cost estimation
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Metric types
 * @readonly
 * @enum {string}
 */
export const MetricType = {
  COUNTER: 'counter',         // Monotonically increasing
  GAUGE: 'gauge',             // Current value
  HISTOGRAM: 'histogram',     // Distribution
  SUMMARY: 'summary'          // Percentiles
};

/**
 * @typedef {Object} MetricValue
 * @property {string} name - Metric name
 * @property {MetricType} type - Metric type
 * @property {number} value - Current value
 * @property {Object} labels - Metric labels
 * @property {number} timestamp - Recording timestamp
 */

/**
 * @typedef {Object} HistogramBucket
 * @property {number} le - Less than or equal boundary
 * @property {number} count - Count in bucket
 */

/**
 * Counter metric class
 */
class Counter {
  constructor(name, help, labelNames = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.values = new Map();
  }

  inc(labels = {}, value = 1) {
    const key = this._labelKey(labels);
    const current = this.values.get(key) || { value: 0, labels };
    current.value += value;
    this.values.set(key, current);
  }

  get(labels = {}) {
    const key = this._labelKey(labels);
    return this.values.get(key)?.value || 0;
  }

  getAll() {
    return Array.from(this.values.entries()).map(([key, data]) => ({
      name: this.name,
      type: MetricType.COUNTER,
      ...data
    }));
  }

  reset() {
    this.values.clear();
  }

  _labelKey(labels) {
    return this.labelNames.map(n => `${n}=${labels[n] || ''}`).join(',');
  }
}

/**
 * Gauge metric class
 */
class Gauge {
  constructor(name, help, labelNames = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.values = new Map();
  }

  set(labels = {}, value) {
    const key = this._labelKey(labels);
    this.values.set(key, { value, labels });
  }

  inc(labels = {}, value = 1) {
    const key = this._labelKey(labels);
    const current = this.values.get(key)?.value || 0;
    this.values.set(key, { value: current + value, labels });
  }

  dec(labels = {}, value = 1) {
    this.inc(labels, -value);
  }

  get(labels = {}) {
    const key = this._labelKey(labels);
    return this.values.get(key)?.value || 0;
  }

  getAll() {
    return Array.from(this.values.entries()).map(([key, data]) => ({
      name: this.name,
      type: MetricType.GAUGE,
      ...data
    }));
  }

  _labelKey(labels) {
    return this.labelNames.map(n => `${n}=${labels[n] || ''}`).join(',');
  }
}

/**
 * Histogram metric class
 */
class Histogram {
  constructor(name, help, labelNames = [], buckets = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.buckets = buckets.length > 0 ? buckets : [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    this.data = new Map();
  }

  observe(labels = {}, value) {
    const key = this._labelKey(labels);
    let data = this.data.get(key);

    if (!data) {
      data = {
        labels,
        count: 0,
        sum: 0,
        buckets: this.buckets.map(le => ({ le, count: 0 }))
      };
      this.data.set(key, data);
    }

    data.count++;
    data.sum += value;

    for (const bucket of data.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
  }

  getPercentile(labels = {}, percentile) {
    const key = this._labelKey(labels);
    const data = this.data.get(key);
    if (!data || data.count === 0) return 0;

    const targetCount = data.count * (percentile / 100);

    for (let i = 0; i < data.buckets.length; i++) {
      if (data.buckets[i].count >= targetCount) {
        if (i === 0) return data.buckets[0].le / 2;

        const prevBucket = data.buckets[i - 1];
        const currBucket = data.buckets[i];
        const prevCount = prevBucket.count;
        const currCount = currBucket.count;

        // Linear interpolation
        const ratio = (targetCount - prevCount) / (currCount - prevCount);
        return prevBucket.le + ratio * (currBucket.le - prevBucket.le);
      }
    }

    return data.buckets[data.buckets.length - 1].le;
  }

  getStats(labels = {}) {
    const key = this._labelKey(labels);
    const data = this.data.get(key);
    if (!data || data.count === 0) {
      return { count: 0, sum: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    return {
      count: data.count,
      sum: data.sum,
      avg: data.sum / data.count,
      p50: this.getPercentile(labels, 50),
      p95: this.getPercentile(labels, 95),
      p99: this.getPercentile(labels, 99)
    };
  }

  getAll() {
    return Array.from(this.data.entries()).map(([key, data]) => ({
      name: this.name,
      type: MetricType.HISTOGRAM,
      labels: data.labels,
      count: data.count,
      sum: data.sum,
      buckets: data.buckets
    }));
  }

  reset() {
    this.data.clear();
  }

  _labelKey(labels) {
    return this.labelNames.map(n => `${n}=${labels[n] || ''}`).join(',');
  }
}

/**
 * LLM Metrics Collector
 * Specialized collector for PROMPT ML metrics
 */
export class LLMMetricsCollector {
  constructor() {
    // Request metrics
    this.requestsTotal = new Counter('llm_requests_total', 'Total LLM requests', ['content_type', 'status']);
    this.requestDuration = new Histogram('llm_request_duration_ms', 'Request duration in milliseconds',
      ['content_type'], [100, 500, 1000, 2000, 5000, 10000, 30000, 60000, 120000]);

    // Token metrics
    this.tokensUsed = new Counter('llm_tokens_total', 'Total tokens used', ['content_type', 'token_type']);
    this.tokenBudget = new Gauge('llm_token_budget', 'Token budget', ['content_type']);

    // Latency metrics by layer
    this.layerDuration = new Histogram('llm_layer_duration_ms', 'Layer processing duration',
      ['layer'], [1, 5, 10, 25, 50, 100, 250, 500, 1000]);

    // Quality metrics
    this.qualityScore = new Histogram('llm_quality_score', 'Output quality scores',
      ['content_type', 'dimension'], [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]);
    this.qualityGrade = new Counter('llm_quality_grade_total', 'Quality grade distribution', ['content_type', 'grade']);

    // Safety metrics
    this.safetyChecks = new Counter('llm_safety_checks_total', 'Safety check results', ['content_type', 'result']);
    this.safetyFlags = new Counter('llm_safety_flags_total', 'Safety flags raised', ['content_type', 'category']);

    // Validation metrics
    this.validationResults = new Counter('llm_validation_results_total', 'Validation results', ['content_type', 'valid']);
    this.validationErrors = new Counter('llm_validation_errors_total', 'Validation errors', ['content_type', 'error_type']);

    // Cache metrics
    this.cacheHits = new Counter('llm_cache_hits_total', 'Cache hits', ['content_type']);
    this.cacheMisses = new Counter('llm_cache_misses_total', 'Cache misses', ['content_type']);

    // Cost estimation (in micro-dollars)
    this.estimatedCost = new Counter('llm_estimated_cost_microdollars', 'Estimated cost in micro-dollars', ['content_type', 'model']);

    // Active requests gauge
    this.activeRequests = new Gauge('llm_active_requests', 'Currently active requests', ['content_type']);

    // Errors
    this.errors = new Counter('llm_errors_total', 'Total errors', ['content_type', 'error_type']);
  }

  /**
   * Record a complete request
   * @param {Object} data - Request data
   */
  recordRequest(data) {
    const { contentType, status, durationMs, cached } = data;

    this.requestsTotal.inc({ content_type: contentType, status }, 1);
    this.requestDuration.observe({ content_type: contentType }, durationMs);

    if (cached) {
      this.cacheHits.inc({ content_type: contentType });
    } else {
      this.cacheMisses.inc({ content_type: contentType });
    }
  }

  /**
   * Record token usage
   * @param {Object} data - Token data
   */
  recordTokens(data) {
    const { contentType, promptTokens, completionTokens, totalTokens } = data;

    if (promptTokens) {
      this.tokensUsed.inc({ content_type: contentType, token_type: 'prompt' }, promptTokens);
    }
    if (completionTokens) {
      this.tokensUsed.inc({ content_type: contentType, token_type: 'completion' }, completionTokens);
    }
    if (totalTokens) {
      this.tokensUsed.inc({ content_type: contentType, token_type: 'total' }, totalTokens);
    }
  }

  /**
   * Record layer processing time
   * @param {string} layerName - Layer name
   * @param {number} durationMs - Duration in milliseconds
   */
  recordLayerDuration(layerName, durationMs) {
    this.layerDuration.observe({ layer: layerName }, durationMs);
  }

  /**
   * Record quality metrics
   * @param {Object} data - Quality data
   */
  recordQuality(data) {
    const { contentType, overall, grade, dimensions } = data;

    if (overall !== undefined) {
      this.qualityScore.observe({ content_type: contentType, dimension: 'overall' }, overall);
    }

    if (grade) {
      this.qualityGrade.inc({ content_type: contentType, grade });
    }

    if (dimensions) {
      for (const [dim, score] of Object.entries(dimensions)) {
        this.qualityScore.observe({ content_type: contentType, dimension: dim }, score);
      }
    }
  }

  /**
   * Record safety check results
   * @param {Object} data - Safety data
   */
  recordSafety(data) {
    const { contentType, safe, level, concerns } = data;

    this.safetyChecks.inc({ content_type: contentType, result: safe ? 'safe' : 'unsafe' });

    if (concerns) {
      for (const concern of concerns) {
        this.safetyFlags.inc({ content_type: contentType, category: concern.category });
      }
    }
  }

  /**
   * Record validation results
   * @param {Object} data - Validation data
   */
  recordValidation(data) {
    const { contentType, valid, errors } = data;

    this.validationResults.inc({ content_type: contentType, valid: valid ? 'true' : 'false' });

    if (errors) {
      for (const error of errors) {
        // Extract error type from message
        const errorType = error.includes('Missing') ? 'missing_field'
          : error.includes('Type') ? 'type_error'
          : error.includes('minimum') || error.includes('maximum') ? 'constraint_error'
          : 'other';
        this.validationErrors.inc({ content_type: contentType, error_type: errorType });
      }
    }
  }

  /**
   * Record estimated cost
   * @param {Object} data - Cost data
   */
  recordCost(data) {
    const { contentType, model, tokens, costPerMillionTokens } = data;

    // Calculate cost in micro-dollars (1 dollar = 1,000,000 micro-dollars)
    const costMicrodollars = Math.round((tokens / 1000000) * costPerMillionTokens * 1000000);
    this.estimatedCost.inc({ content_type: contentType, model }, costMicrodollars);
  }

  /**
   * Record an error
   * @param {string} contentType - Content type
   * @param {string} errorType - Error type
   */
  recordError(contentType, errorType) {
    this.errors.inc({ content_type: contentType, error_type: errorType });
  }

  /**
   * Track active request start
   * @param {string} contentType - Content type
   */
  startRequest(contentType) {
    this.activeRequests.inc({ content_type: contentType });
  }

  /**
   * Track active request end
   * @param {string} contentType - Content type
   */
  endRequest(contentType) {
    this.activeRequests.dec({ content_type: contentType });
  }

  /**
   * Get all metrics as a summary object
   * @returns {Object} Metrics summary
   */
  getSummary() {
    const contentTypes = ['roadmap', 'slides', 'document', 'research-analysis'];

    const summary = {
      timestamp: new Date().toISOString(),
      requests: {
        total: 0,
        byContentType: {},
        byStatus: { success: 0, error: 0 }
      },
      tokens: {
        total: 0,
        byContentType: {}
      },
      latency: {
        overall: this.requestDuration.getStats(),
        byContentType: {}
      },
      quality: {
        averageScore: 0,
        gradeDistribution: {}
      },
      safety: {
        checksTotal: 0,
        safeRate: 0,
        flagsByCategory: {}
      },
      validation: {
        total: 0,
        validRate: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      errors: {
        total: 0,
        byType: {}
      }
    };

    // Aggregate by content type
    for (const ct of contentTypes) {
      // Requests
      const successCount = this.requestsTotal.get({ content_type: ct, status: 'success' });
      const errorCount = this.requestsTotal.get({ content_type: ct, status: 'error' });
      summary.requests.byContentType[ct] = { success: successCount, error: errorCount };
      summary.requests.total += successCount + errorCount;
      summary.requests.byStatus.success += successCount;
      summary.requests.byStatus.error += errorCount;

      // Tokens
      const tokens = this.tokensUsed.get({ content_type: ct, token_type: 'total' });
      summary.tokens.byContentType[ct] = tokens;
      summary.tokens.total += tokens;

      // Latency
      summary.latency.byContentType[ct] = this.requestDuration.getStats({ content_type: ct });

      // Cache
      const hits = this.cacheHits.get({ content_type: ct });
      const misses = this.cacheMisses.get({ content_type: ct });
      summary.cache.hits += hits;
      summary.cache.misses += misses;
    }

    // Cache hit rate
    const totalCacheRequests = summary.cache.hits + summary.cache.misses;
    summary.cache.hitRate = totalCacheRequests > 0
      ? (summary.cache.hits / totalCacheRequests)
      : 0;

    return summary;
  }

  /**
   * Get metrics in Prometheus format
   * @returns {string} Prometheus-formatted metrics
   */
  toPrometheusFormat() {
    const lines = [];

    // Helper to format metric
    const formatMetric = (metric) => {
      const values = metric.getAll();
      if (values.length === 0) return;

      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${values[0].type}`);

      for (const v of values) {
        const labels = Object.entries(v.labels || {})
          .map(([k, val]) => `${k}="${val}"`)
          .join(',');
        const labelStr = labels ? `{${labels}}` : '';

        if (v.type === MetricType.HISTOGRAM) {
          for (const bucket of v.buckets) {
            lines.push(`${metric.name}_bucket${labelStr.replace('}', `,le="${bucket.le}"}`)} ${bucket.count}`);
          }
          lines.push(`${metric.name}_count${labelStr} ${v.count}`);
          lines.push(`${metric.name}_sum${labelStr} ${v.sum}`);
        } else {
          lines.push(`${metric.name}${labelStr} ${v.value}`);
        }
      }
      lines.push('');
    };

    formatMetric(this.requestsTotal);
    formatMetric(this.tokensUsed);
    formatMetric(this.qualityGrade);
    formatMetric(this.safetyChecks);
    formatMetric(this.validationResults);
    formatMetric(this.cacheHits);
    formatMetric(this.cacheMisses);
    formatMetric(this.errors);

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.requestsTotal.reset();
    this.requestDuration.reset();
    this.tokensUsed.reset();
    this.layerDuration.reset();
    this.qualityScore.reset();
    this.qualityGrade.reset();
    this.safetyChecks.reset();
    this.safetyFlags.reset();
    this.validationResults.reset();
    this.validationErrors.reset();
    this.cacheHits.reset();
    this.cacheMisses.reset();
    this.estimatedCost.reset();
    this.errors.reset();
  }
}

// Singleton instance
let _collector = null;

/**
 * Get or create singleton metrics collector
 * @returns {LLMMetricsCollector}
 */
export function getMetricsCollector() {
  if (!_collector) {
    _collector = new LLMMetricsCollector();
  }
  return _collector;
}

/**
 * Reset metrics collector (for testing)
 */
export function resetMetricsCollector() {
  if (_collector) {
    _collector.reset();
  }
  _collector = null;
}

/**
 * Cost rates per million tokens (approximate, as of 2024)
 */
export const COST_RATES = {
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.0-flash-exp': { input: 0.10, output: 0.40 }
};

export default LLMMetricsCollector;
