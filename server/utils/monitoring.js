/**
 * Performance Monitoring & Alerting System
 *
 * Phase 10 implementation:
 * - Aggregated metrics dashboard
 * - Alerting thresholds with configurable rules
 * - Health status evaluation
 * - Performance trend tracking
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALERT_CONFIG = {
  // Latency thresholds (milliseconds)
  latency: {
    p95Warning: 120000,   // 2 minutes - warning
    p95Critical: 180000,  // 3 minutes - critical
    p99Warning: 180000,   // 3 minutes - warning
    p99Critical: 300000   // 5 minutes - critical
  },
  // Cache performance
  cache: {
    hitRateWarning: 0.2,   // Below 20% cache hit rate
    hitRateCritical: 0.1   // Below 10% cache hit rate
  },
  // Error rates
  errors: {
    rateWarning: 0.05,     // 5% error rate
    rateCritical: 0.15     // 15% error rate
  },
  // Queue health
  queue: {
    queuedTasksWarning: 10,
    queuedTasksCritical: 25
  },
  // Storage health
  storage: {
    sessionCountWarning: 80,   // 80% of max
    sessionCountCritical: 95   // 95% of max
  }
};

// ============================================================================
// METRICS AGGREGATOR
// ============================================================================

/**
 * Metrics Aggregator
 * Collects and aggregates metrics from all system components
 */
class MetricsAggregator {
  constructor() {
    this.collectors = new Map();
    this.snapshots = [];
    this.maxSnapshots = 100;  // Keep last 100 snapshots
    this.snapshotIntervalMs = 60000;  // 1 minute intervals
    this._snapshotInterval = null;
  }

  /**
   * Register a metrics collector
   * @param {string} name - Collector name
   * @param {Function} collector - Async function that returns metrics object
   */
  register(name, collector) {
    this.collectors.set(name, collector);
  }

  /**
   * Collect all metrics
   * @returns {Promise<object>} Aggregated metrics
   */
  async collect() {
    const metrics = {
      timestamp: new Date().toISOString(),
      collectors: {}
    };

    for (const [name, collector] of this.collectors) {
      try {
        metrics.collectors[name] = await collector();
      } catch (error) {
        metrics.collectors[name] = { error: error.message };
      }
    }

    return metrics;
  }

  /**
   * Take a snapshot of current metrics
   */
  async snapshot() {
    const metrics = await this.collect();
    this.snapshots.push(metrics);

    // Enforce max snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return metrics;
  }

  /**
   * Start automatic snapshots
   */
  startAutoSnapshot() {
    if (this._snapshotInterval) return;

    this._snapshotInterval = setInterval(() => {
      this.snapshot().catch(err => {
        console.error('[Monitoring] Snapshot failed:', err.message);
      });
    }, this.snapshotIntervalMs);

    console.log('[Monitoring] Auto-snapshot started (every 60s)');
  }

  /**
   * Stop automatic snapshots
   */
  stopAutoSnapshot() {
    if (this._snapshotInterval) {
      clearInterval(this._snapshotInterval);
      this._snapshotInterval = null;
    }
  }

  /**
   * Get recent snapshots
   * @param {number} count - Number of snapshots to return
   */
  getSnapshots(count = 10) {
    return this.snapshots.slice(-count);
  }

  /**
   * Get trend data for a specific metric path
   * @param {string} path - Dot-separated path to metric (e.g., 'generation.latency.p95')
   */
  getTrend(path) {
    const parts = path.split('.');
    const values = [];

    for (const snapshot of this.snapshots) {
      let value = snapshot.collectors;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      if (typeof value === 'number') {
        values.push({
          timestamp: snapshot.timestamp,
          value
        });
      }
    }

    return values;
  }
}

// ============================================================================
// ALERT EVALUATOR
// ============================================================================

/**
 * Alert Evaluator
 * Evaluates metrics against thresholds and generates alerts
 */
class AlertEvaluator {
  constructor(config = ALERT_CONFIG) {
    this.config = config;
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.maxHistory = 100;
  }

  /**
   * Evaluate metrics and return alerts
   * @param {object} metrics - Aggregated metrics object
   * @returns {Array} Array of alert objects
   */
  evaluate(metrics) {
    const alerts = [];

    // Evaluate latency thresholds
    const latency = metrics.collectors?.generation?.latency;
    if (latency) {
      if (latency.p95 >= this.config.latency.p95Critical) {
        alerts.push(this._createAlert('latency_p95', 'critical',
          `P95 latency (${Math.round(latency.p95 / 1000)}s) exceeds critical threshold`));
      } else if (latency.p95 >= this.config.latency.p95Warning) {
        alerts.push(this._createAlert('latency_p95', 'warning',
          `P95 latency (${Math.round(latency.p95 / 1000)}s) exceeds warning threshold`));
      }

      if (latency.p99 >= this.config.latency.p99Critical) {
        alerts.push(this._createAlert('latency_p99', 'critical',
          `P99 latency (${Math.round(latency.p99 / 1000)}s) exceeds critical threshold`));
      } else if (latency.p99 >= this.config.latency.p99Warning) {
        alerts.push(this._createAlert('latency_p99', 'warning',
          `P99 latency (${Math.round(latency.p99 / 1000)}s) exceeds warning threshold`));
      }
    }

    // Evaluate cache hit rate
    const cache = metrics.collectors?.cache?.aggregate;
    if (cache && cache.totalRequests > 10) {
      // Use totalHits (the correct property from getCacheMetrics)
      const hitRate = cache.totalHits / cache.totalRequests;
      if (hitRate < this.config.cache.hitRateCritical) {
        alerts.push(this._createAlert('cache_hit_rate', 'critical',
          `Cache hit rate (${(hitRate * 100).toFixed(1)}%) below critical threshold`));
      } else if (hitRate < this.config.cache.hitRateWarning) {
        alerts.push(this._createAlert('cache_hit_rate', 'warning',
          `Cache hit rate (${(hitRate * 100).toFixed(1)}%) below warning threshold`));
      }
    }

    // Evaluate queue health
    const queue = metrics.collectors?.queue;
    if (queue) {
      if (queue.currentlyQueued >= this.config.queue.queuedTasksCritical) {
        alerts.push(this._createAlert('queue_backlog', 'critical',
          `Queue backlog (${queue.currentlyQueued}) exceeds critical threshold`));
      } else if (queue.currentlyQueued >= this.config.queue.queuedTasksWarning) {
        alerts.push(this._createAlert('queue_backlog', 'warning',
          `Queue backlog (${queue.currentlyQueued}) exceeds warning threshold`));
      }
    }

    // Evaluate storage health
    const storage = metrics.collectors?.storage;
    if (storage && storage.maxSessions) {
      const utilization = storage.sessionCount / storage.maxSessions;
      if (utilization >= this.config.storage.sessionCountCritical / 100) {
        alerts.push(this._createAlert('storage_utilization', 'critical',
          `Storage utilization (${(utilization * 100).toFixed(1)}%) exceeds critical threshold`));
      } else if (utilization >= this.config.storage.sessionCountWarning / 100) {
        alerts.push(this._createAlert('storage_utilization', 'warning',
          `Storage utilization (${(utilization * 100).toFixed(1)}%) exceeds warning threshold`));
      }
    }

    // Update active alerts and history
    this._updateAlerts(alerts);

    return alerts;
  }

  _createAlert(id, severity, message) {
    return {
      id,
      severity,
      message,
      timestamp: new Date().toISOString()
    };
  }

  _updateAlerts(newAlerts) {
    const now = Date.now();
    const alertIds = new Set(newAlerts.map(a => a.id));

    // Clear resolved alerts
    for (const [id, alert] of this.activeAlerts) {
      if (!alertIds.has(id)) {
        this.alertHistory.push({
          ...alert,
          resolvedAt: new Date().toISOString()
        });
        this.activeAlerts.delete(id);
      }
    }

    // Add new alerts
    for (const alert of newAlerts) {
      if (!this.activeAlerts.has(alert.id)) {
        this.activeAlerts.set(alert.id, alert);
        this.alertHistory.push(alert);
      }
    }

    // Trim history
    if (this.alertHistory.length > this.maxHistory) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistory);
    }
  }

  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(count = 20) {
    return this.alertHistory.slice(-count);
  }

  /**
   * Get overall health status
   */
  getHealthStatus() {
    const alerts = this.getActiveAlerts();
    const critical = alerts.filter(a => a.severity === 'critical');
    const warnings = alerts.filter(a => a.severity === 'warning');

    if (critical.length > 0) {
      return { status: 'critical', message: `${critical.length} critical alert(s)` };
    }
    if (warnings.length > 0) {
      return { status: 'warning', message: `${warnings.length} warning(s)` };
    }
    return { status: 'healthy', message: 'All systems operational' };
  }
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Feature Flags Manager
 * Enables A/B testing and gradual feature rollout
 */
class FeatureFlags {
  constructor() {
    this.flags = new Map();
    this.overrides = new Map();  // Per-session overrides
    this.stats = new Map();      // Usage statistics

    // Initialize default flags
    this._initializeDefaults();
  }

  _initializeDefaults() {
    // Define feature flags with default values
    this.define('streaming_enabled', {
      defaultValue: true,
      description: 'Enable SSE streaming for content generation',
      rolloutPercentage: 100
    });

    this.define('cache_enabled', {
      defaultValue: true,
      description: 'Enable content caching',
      rolloutPercentage: 100
    });

    this.define('connection_warmup', {
      defaultValue: true,
      description: 'Enable Gemini API connection prewarming',
      rolloutPercentage: 100
    });

    this.define('compression_enabled', {
      defaultValue: true,
      description: 'Enable response compression',
      rolloutPercentage: 100
    });

    this.define('speculative_ordering', {
      defaultValue: true,
      description: 'Use speculative generation ordering',
      rolloutPercentage: 100
    });

    this.define('worker_threads', {
      defaultValue: false,
      description: 'Use worker threads for file processing',
      rolloutPercentage: 0  // Disabled by default, opt-in
    });

    this.define('experimental_fast_model', {
      defaultValue: false,
      description: 'Use faster model for simple content types',
      rolloutPercentage: 0
    });
  }

  /**
   * Define a feature flag
   * @param {string} name - Flag name
   * @param {object} config - Flag configuration
   */
  define(name, config) {
    this.flags.set(name, {
      name,
      defaultValue: config.defaultValue ?? false,
      description: config.description ?? '',
      rolloutPercentage: config.rolloutPercentage ?? 100,
      createdAt: new Date().toISOString()
    });
    this.stats.set(name, { enabled: 0, disabled: 0 });
  }

  /**
   * Check if a flag is enabled
   * @param {string} name - Flag name
   * @param {string} sessionId - Session ID for consistent bucketing
   * @returns {boolean}
   */
  isEnabled(name, sessionId = null) {
    const flag = this.flags.get(name);
    if (!flag) return false;

    // Check for override
    if (sessionId && this.overrides.has(`${name}:${sessionId}`)) {
      const value = this.overrides.get(`${name}:${sessionId}`);
      this._trackUsage(name, value);
      return value;
    }

    // Calculate if session is in rollout percentage
    let enabled;
    if (flag.rolloutPercentage >= 100) {
      enabled = flag.defaultValue;
    } else if (flag.rolloutPercentage <= 0) {
      enabled = false;
    } else if (sessionId) {
      // Use session ID for consistent bucketing
      const bucket = this._hashToBucket(sessionId, name);
      enabled = bucket < flag.rolloutPercentage;
    } else {
      enabled = flag.defaultValue;
    }

    this._trackUsage(name, enabled);
    return enabled;
  }

  /**
   * Set a per-session override
   * @param {string} name - Flag name
   * @param {string} sessionId - Session ID
   * @param {boolean} value - Override value
   */
  setOverride(name, sessionId, value) {
    this.overrides.set(`${name}:${sessionId}`, value);

    // Prevent memory leak - limit overrides size
    if (this.overrides.size > 10000) {
      // Remove oldest 1000 entries
      const keysToDelete = [...this.overrides.keys()].slice(0, 1000);
      for (const key of keysToDelete) {
        this.overrides.delete(key);
      }
    }
  }

  /**
   * Clear override for a session
   * @param {string} sessionId - Session ID
   */
  clearSessionOverrides(sessionId) {
    for (const key of this.overrides.keys()) {
      if (key.endsWith(`:${sessionId}`)) {
        this.overrides.delete(key);
      }
    }
  }

  /**
   * Clear all overrides
   */
  clearAllOverrides() {
    this.overrides.clear();
  }

  /**
   * Update a flag's rollout percentage
   * @param {string} name - Flag name
   * @param {number} percentage - New percentage (0-100)
   */
  setRollout(name, percentage) {
    const flag = this.flags.get(name);
    if (flag) {
      flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
    }
  }

  /**
   * Get all flags and their current state
   */
  getAllFlags() {
    const result = {};
    for (const [name, flag] of this.flags) {
      result[name] = {
        ...flag,
        stats: this.stats.get(name)
      };
    }
    return result;
  }

  _hashToBucket(sessionId, flagName) {
    // Simple hash to get consistent bucket 0-99
    let hash = 0;
    const str = `${sessionId}:${flagName}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  _trackUsage(name, enabled) {
    const stats = this.stats.get(name);
    if (stats) {
      if (enabled) {
        stats.enabled++;
      } else {
        stats.disabled++;
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const metricsAggregator = new MetricsAggregator();
export const alertEvaluator = new AlertEvaluator();
export const featureFlags = new FeatureFlags();

/**
 * Initialize monitoring system
 * Call this after all metric collectors are registered
 */
export function initializeMonitoring() {
  metricsAggregator.startAutoSnapshot();
  console.log('[Monitoring] System initialized');
}

/**
 * Shutdown monitoring system
 */
export function shutdownMonitoring() {
  metricsAggregator.stopAutoSnapshot();
}

/**
 * Get comprehensive dashboard data
 */
export async function getDashboardData() {
  const metrics = await metricsAggregator.collect();
  const alerts = alertEvaluator.evaluate(metrics);
  const health = alertEvaluator.getHealthStatus();

  return {
    timestamp: new Date().toISOString(),
    health,
    metrics: metrics.collectors,
    activeAlerts: alertEvaluator.getActiveAlerts(),
    recentAlerts: alertEvaluator.getAlertHistory(10)
  };
}

export default {
  metricsAggregator,
  alertEvaluator,
  featureFlags,
  initializeMonitoring,
  shutdownMonitoring,
  getDashboardData,
  ALERT_CONFIG
};
