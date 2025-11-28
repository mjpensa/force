/**
 * Dashboard Module - PROMPT ML Layer 10
 *
 * Aggregates metrics from all PROMPT ML layers for monitoring:
 * - Real-time metrics dashboard
 * - Historical trend analysis
 * - Performance summaries
 * - Cost tracking
 *
 * Based on PROMPT ML design specification.
 */

/**
 * @typedef {Object} DashboardConfig
 * @property {number} historySize - Number of data points to retain
 * @property {number} aggregationInterval - Aggregation interval in ms
 * @property {boolean} trackCosts - Whether to track API costs
 */

const DEFAULT_CONFIG = {
  historySize: 1000,
  aggregationInterval: 60000, // 1 minute
  trackCosts: true
};

/**
 * Time series data point
 */
class TimeSeriesPoint {
  constructor(value, timestamp = Date.now()) {
    this.value = value;
    this.timestamp = timestamp;
  }
}

/**
 * Time series storage with rolling window
 */
class TimeSeries {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.points = [];
  }

  add(value) {
    this.points.push(new TimeSeriesPoint(value));
    if (this.points.length > this.maxSize) {
      this.points.shift();
    }
  }

  getRange(startTime, endTime = Date.now()) {
    return this.points.filter(
      p => p.timestamp >= startTime && p.timestamp <= endTime
    );
  }

  getLast(n = 10) {
    return this.points.slice(-n);
  }

  getStats() {
    if (this.points.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    const values = this.points.map(p => p.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length,
      latest: values[values.length - 1]
    };
  }
}

/**
 * Dashboard Manager
 */
export class DashboardManager {
  /**
   * @param {DashboardConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize time series for different metrics
    this.metrics = {
      // Request metrics
      requestCount: new TimeSeries(this.config.historySize),
      requestLatency: new TimeSeries(this.config.historySize),
      errorRate: new TimeSeries(this.config.historySize),

      // Token metrics
      inputTokens: new TimeSeries(this.config.historySize),
      outputTokens: new TimeSeries(this.config.historySize),

      // Quality metrics
      qualityScores: new TimeSeries(this.config.historySize),
      validationPassRate: new TimeSeries(this.config.historySize),

      // Cache metrics
      cacheHitRate: new TimeSeries(this.config.historySize),

      // Cost metrics
      estimatedCost: new TimeSeries(this.config.historySize)
    };

    // Content type specific metrics
    this.contentTypeMetrics = new Map();

    // Aggregated stats
    this.aggregatedStats = {
      totalRequests: 0,
      totalErrors: 0,
      totalTokens: 0,
      totalCost: 0,
      startTime: Date.now()
    };

    // Aggregation interval
    this.aggregationInterval = null;
  }

  /**
   * Record a request metric
   *
   * @param {Object} data - Request data
   */
  recordRequest(data) {
    const {
      contentType,
      latency,
      success,
      inputTokens = 0,
      outputTokens = 0,
      qualityScore,
      cacheHit = false,
      cost = 0
    } = data;

    // Update time series
    this.metrics.requestCount.add(1);
    this.metrics.requestLatency.add(latency);
    this.metrics.errorRate.add(success ? 0 : 1);
    this.metrics.inputTokens.add(inputTokens);
    this.metrics.outputTokens.add(outputTokens);

    if (qualityScore !== undefined) {
      this.metrics.qualityScores.add(qualityScore);
    }

    this.metrics.cacheHitRate.add(cacheHit ? 1 : 0);

    if (this.config.trackCosts) {
      this.metrics.estimatedCost.add(cost);
    }

    // Update content type specific metrics
    if (contentType) {
      if (!this.contentTypeMetrics.has(contentType)) {
        this.contentTypeMetrics.set(contentType, {
          requests: new TimeSeries(this.config.historySize),
          latency: new TimeSeries(this.config.historySize),
          errors: new TimeSeries(this.config.historySize),
          quality: new TimeSeries(this.config.historySize)
        });
      }

      const ctMetrics = this.contentTypeMetrics.get(contentType);
      ctMetrics.requests.add(1);
      ctMetrics.latency.add(latency);
      ctMetrics.errors.add(success ? 0 : 1);

      if (qualityScore !== undefined) {
        ctMetrics.quality.add(qualityScore);
      }
    }

    // Update aggregated stats
    this.aggregatedStats.totalRequests++;
    if (!success) this.aggregatedStats.totalErrors++;
    this.aggregatedStats.totalTokens += inputTokens + outputTokens;
    this.aggregatedStats.totalCost += cost;
  }

  /**
   * Get real-time dashboard data
   *
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneMinuteAgo = now - 60000;

    return {
      timestamp: new Date().toISOString(),
      uptime: this._formatUptime(now - this.aggregatedStats.startTime),

      // Summary stats
      summary: {
        totalRequests: this.aggregatedStats.totalRequests,
        totalErrors: this.aggregatedStats.totalErrors,
        errorRate: this.aggregatedStats.totalRequests > 0
          ? ((this.aggregatedStats.totalErrors / this.aggregatedStats.totalRequests) * 100).toFixed(2) + '%'
          : '0%',
        totalTokens: this.aggregatedStats.totalTokens,
        totalCost: this.config.trackCosts ? `$${this.aggregatedStats.totalCost.toFixed(4)}` : 'N/A'
      },

      // Real-time metrics (last minute)
      realtime: {
        requestsPerMinute: this.metrics.requestCount.getRange(oneMinuteAgo).length,
        avgLatency: this._getAvgFromRange(this.metrics.requestLatency, oneMinuteAgo),
        errorRate: this._getAvgFromRange(this.metrics.errorRate, oneMinuteAgo) * 100,
        cacheHitRate: this._getAvgFromRange(this.metrics.cacheHitRate, oneMinuteAgo) * 100
      },

      // Hourly metrics
      hourly: {
        requestCount: this.metrics.requestCount.getRange(oneHourAgo).length,
        avgLatency: this._getAvgFromRange(this.metrics.requestLatency, oneHourAgo),
        avgQuality: this._getAvgFromRange(this.metrics.qualityScores, oneHourAgo),
        totalTokens: this._getSumFromRange(this.metrics.inputTokens, oneHourAgo) +
          this._getSumFromRange(this.metrics.outputTokens, oneHourAgo)
      },

      // Latency distribution
      latencyStats: this.metrics.requestLatency.getStats(),

      // Quality distribution
      qualityStats: this.metrics.qualityScores.getStats(),

      // Content type breakdown
      contentTypes: this._getContentTypeBreakdown()
    };
  }

  /**
   * Get metrics by content type
   *
   * @param {string} contentType - Content type
   * @returns {Object|null} Content type metrics
   */
  getContentTypeMetrics(contentType) {
    const ctMetrics = this.contentTypeMetrics.get(contentType);
    if (!ctMetrics) return null;

    return {
      contentType,
      requests: ctMetrics.requests.getStats(),
      latency: ctMetrics.latency.getStats(),
      errors: ctMetrics.errors.getStats(),
      quality: ctMetrics.quality.getStats()
    };
  }

  /**
   * Get performance trends
   *
   * @param {string} metric - Metric name
   * @param {number} duration - Duration in ms
   * @returns {Array} Trend data points
   */
  getTrend(metric, duration = 3600000) {
    const timeSeries = this.metrics[metric];
    if (!timeSeries) return [];

    const startTime = Date.now() - duration;
    return timeSeries.getRange(startTime).map(p => ({
      value: p.value,
      timestamp: new Date(p.timestamp).toISOString()
    }));
  }

  /**
   * Get cost breakdown
   *
   * @returns {Object} Cost breakdown
   */
  getCostBreakdown() {
    if (!this.config.trackCosts) {
      return { enabled: false };
    }

    const now = Date.now();
    const oneDayAgo = now - 86400000;
    const oneWeekAgo = now - 604800000;

    return {
      enabled: true,
      total: `$${this.aggregatedStats.totalCost.toFixed(4)}`,
      lastHour: `$${this._getSumFromRange(this.metrics.estimatedCost, now - 3600000).toFixed(4)}`,
      last24Hours: `$${this._getSumFromRange(this.metrics.estimatedCost, oneDayAgo).toFixed(4)}`,
      lastWeek: `$${this._getSumFromRange(this.metrics.estimatedCost, oneWeekAgo).toFixed(4)}`,
      avgPerRequest: this.aggregatedStats.totalRequests > 0
        ? `$${(this.aggregatedStats.totalCost / this.aggregatedStats.totalRequests).toFixed(6)}`
        : '$0'
    };
  }

  /**
   * Get SLA compliance report
   *
   * @param {Object} slaTargets - SLA targets
   * @returns {Object} SLA compliance
   */
  getSLACompliance(slaTargets = {}) {
    const targets = {
      maxLatencyP95: slaTargets.maxLatencyP95 || 30000,
      minAvailability: slaTargets.minAvailability || 99.5,
      minQuality: slaTargets.minQuality || 0.7,
      ...slaTargets
    };

    const latencyStats = this.metrics.requestLatency.getStats();
    const errorRate = this.aggregatedStats.totalRequests > 0
      ? (this.aggregatedStats.totalErrors / this.aggregatedStats.totalRequests) * 100
      : 0;
    const availability = 100 - errorRate;
    const avgQuality = this.metrics.qualityScores.getStats().avg || 0;

    return {
      targets,
      compliance: {
        latency: {
          target: `${targets.maxLatencyP95}ms (P95)`,
          actual: `${latencyStats.max}ms (max)`,
          compliant: latencyStats.max <= targets.maxLatencyP95
        },
        availability: {
          target: `${targets.minAvailability}%`,
          actual: `${availability.toFixed(2)}%`,
          compliant: availability >= targets.minAvailability
        },
        quality: {
          target: targets.minQuality,
          actual: avgQuality.toFixed(2),
          compliant: avgQuality >= targets.minQuality
        }
      },
      overallCompliant: latencyStats.max <= targets.maxLatencyP95 &&
        availability >= targets.minAvailability &&
        avgQuality >= targets.minQuality
    };
  }

  /**
   * Export metrics in various formats
   *
   * @param {string} format - Export format (json, prometheus, csv)
   * @returns {string} Exported metrics
   */
  exportMetrics(format = 'json') {
    switch (format) {
      case 'prometheus':
        return this._exportPrometheus();
      case 'csv':
        return this._exportCSV();
      default:
        return JSON.stringify(this.getDashboardData(), null, 2);
    }
  }

  /**
   * Reset all metrics
   */
  reset() {
    for (const ts of Object.values(this.metrics)) {
      ts.points = [];
    }
    this.contentTypeMetrics.clear();
    this.aggregatedStats = {
      totalRequests: 0,
      totalErrors: 0,
      totalTokens: 0,
      totalCost: 0,
      startTime: Date.now()
    };
  }

  // Private helper methods

  _getAvgFromRange(timeSeries, startTime) {
    const points = timeSeries.getRange(startTime);
    if (points.length === 0) return 0;
    return points.reduce((sum, p) => sum + p.value, 0) / points.length;
  }

  _getSumFromRange(timeSeries, startTime) {
    const points = timeSeries.getRange(startTime);
    return points.reduce((sum, p) => sum + p.value, 0);
  }

  _getContentTypeBreakdown() {
    const breakdown = {};
    for (const [ct, metrics] of this.contentTypeMetrics) {
      breakdown[ct] = {
        totalRequests: metrics.requests.points.length,
        avgLatency: metrics.latency.getStats().avg,
        errorRate: metrics.errors.getStats().avg * 100,
        avgQuality: metrics.quality.getStats().avg
      };
    }
    return breakdown;
  }

  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  _exportPrometheus() {
    const lines = [
      '# HELP prompt_ml_requests_total Total number of requests',
      '# TYPE prompt_ml_requests_total counter',
      `prompt_ml_requests_total ${this.aggregatedStats.totalRequests}`,
      '',
      '# HELP prompt_ml_errors_total Total number of errors',
      '# TYPE prompt_ml_errors_total counter',
      `prompt_ml_errors_total ${this.aggregatedStats.totalErrors}`,
      '',
      '# HELP prompt_ml_tokens_total Total tokens processed',
      '# TYPE prompt_ml_tokens_total counter',
      `prompt_ml_tokens_total ${this.aggregatedStats.totalTokens}`,
      '',
      '# HELP prompt_ml_latency_avg Average request latency',
      '# TYPE prompt_ml_latency_avg gauge',
      `prompt_ml_latency_avg ${this.metrics.requestLatency.getStats().avg}`,
      '',
      '# HELP prompt_ml_quality_avg Average quality score',
      '# TYPE prompt_ml_quality_avg gauge',
      `prompt_ml_quality_avg ${this.metrics.qualityScores.getStats().avg}`,
      '',
      '# HELP prompt_ml_cache_hit_rate Cache hit rate',
      '# TYPE prompt_ml_cache_hit_rate gauge',
      `prompt_ml_cache_hit_rate ${this.metrics.cacheHitRate.getStats().avg}`
    ];

    // Add content type specific metrics
    for (const [ct, metrics] of this.contentTypeMetrics) {
      lines.push('');
      lines.push(`prompt_ml_requests_total{content_type="${ct}"} ${metrics.requests.points.length}`);
      lines.push(`prompt_ml_latency_avg{content_type="${ct}"} ${metrics.latency.getStats().avg}`);
    }

    return lines.join('\n');
  }

  _exportCSV() {
    const headers = ['timestamp', 'requests', 'errors', 'avg_latency', 'avg_quality', 'cache_hit_rate'];
    const rows = [headers.join(',')];

    const dashboard = this.getDashboardData();
    rows.push([
      dashboard.timestamp,
      dashboard.summary.totalRequests,
      dashboard.summary.totalErrors,
      dashboard.latencyStats.avg,
      dashboard.qualityStats.avg,
      dashboard.realtime.cacheHitRate
    ].join(','));

    return rows.join('\n');
  }
}

// Singleton instance
let _dashboardManager = null;

/**
 * Get or create singleton dashboard manager
 * @param {DashboardConfig} config - Configuration
 * @returns {DashboardManager}
 */
export function getDashboardManager(config = {}) {
  if (!_dashboardManager) {
    _dashboardManager = new DashboardManager(config);
  }
  return _dashboardManager;
}

/**
 * Reset dashboard manager (for testing)
 */
export function resetDashboardManager() {
  _dashboardManager = null;
}

export default DashboardManager;
