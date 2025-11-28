/**
 * Monitoring Layer - PROMPT ML Layer 10
 *
 * Unified export and orchestration for monitoring:
 * - Health checks
 * - Metrics dashboard
 * - Alerting system
 * - Continuous optimization
 *
 * Based on PROMPT ML design specification.
 */

// Health check exports
export {
  HealthCheckManager,
  HealthStatus,
  getHealthManager,
  resetHealthManager
} from './health.js';

// Dashboard exports
export {
  DashboardManager,
  getDashboardManager,
  resetDashboardManager
} from './dashboard.js';

// Alert exports
export {
  AlertManager,
  AlertSeverity,
  AlertStatus,
  AlertType,
  getAlertManager,
  resetAlertManager
} from './alerts.js';

import { getHealthManager, HealthStatus } from './health.js';
import { getDashboardManager } from './dashboard.js';
import { getAlertManager, AlertSeverity } from './alerts.js';

/**
 * @typedef {Object} MonitoringConfig
 * @property {boolean} enableHealthChecks - Enable health monitoring
 * @property {boolean} enableDashboard - Enable metrics dashboard
 * @property {boolean} enableAlerts - Enable alerting
 * @property {number} healthCheckInterval - Health check interval (ms)
 * @property {number} alertCheckInterval - Alert check interval (ms)
 */

const DEFAULT_CONFIG = {
  enableHealthChecks: true,
  enableDashboard: true,
  enableAlerts: true,
  healthCheckInterval: 30000,
  alertCheckInterval: 30000
};

/**
 * Monitoring Pipeline
 * Orchestrates all monitoring components
 */
export class MonitoringPipeline {
  /**
   * @param {MonitoringConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Lazy-load components
    this._healthManager = null;
    this._dashboardManager = null;
    this._alertManager = null;

    // Tracking
    this.isRunning = false;
    this.startedAt = null;
  }

  /**
   * Get health manager instance
   */
  get healthManager() {
    if (!this._healthManager && this.config.enableHealthChecks) {
      this._healthManager = getHealthManager({
        interval: this.config.healthCheckInterval
      });
    }
    return this._healthManager;
  }

  /**
   * Get dashboard manager instance
   */
  get dashboardManager() {
    if (!this._dashboardManager && this.config.enableDashboard) {
      this._dashboardManager = getDashboardManager();
    }
    return this._dashboardManager;
  }

  /**
   * Get alert manager instance
   */
  get alertManager() {
    if (!this._alertManager && this.config.enableAlerts) {
      this._alertManager = getAlertManager({
        checkInterval: this.config.alertCheckInterval
      });
    }
    return this._alertManager;
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startedAt = Date.now();

    // Start health checks
    if (this.config.enableHealthChecks && this.healthManager) {
      this.healthManager.startPeriodicChecks((results) => {
        // Update dashboard with health data
        if (this.dashboardManager) {
          this._updateDashboardFromHealth(results);
        }

        // Check for health-based alerts
        if (this.alertManager) {
          this._checkHealthAlerts(results);
        }
      });
    }

    // Start alert checking with metrics provider
    if (this.config.enableAlerts && this.alertManager) {
      this.alertManager.startChecking(() => this._getMetricsForAlerts());
    }

    // Register default alert handler
    if (this.alertManager) {
      this.alertManager.registerHandler((alert) => {
        this._handleAlert(alert);
      });
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.healthManager) {
      this.healthManager.stopPeriodicChecks();
    }

    if (this.alertManager) {
      this.alertManager.stopChecking();
    }

    this.isRunning = false;
  }

  /**
   * Record a request for monitoring
   *
   * @param {Object} data - Request data
   */
  recordRequest(data) {
    if (this.dashboardManager) {
      this.dashboardManager.recordRequest(data);
    }
  }

  /**
   * Get comprehensive health report
   *
   * @returns {Object} Health report
   */
  async getHealthReport() {
    if (!this.healthManager) {
      return { enabled: false };
    }

    return {
      enabled: true,
      ...(await this.healthManager.runFullHealthCheck())
    };
  }

  /**
   * Get liveness status (for Kubernetes probes)
   *
   * @returns {Object} Liveness status
   */
  async getLiveness() {
    if (!this.healthManager) {
      return { alive: true, status: 'unknown' };
    }

    return this.healthManager.livenessProbe();
  }

  /**
   * Get readiness status (for Kubernetes probes)
   *
   * @returns {Object} Readiness status
   */
  async getReadiness() {
    if (!this.healthManager) {
      return { ready: true, status: 'unknown' };
    }

    return this.healthManager.readinessProbe();
  }

  /**
   * Get dashboard data
   *
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    if (!this.dashboardManager) {
      return { enabled: false };
    }

    return {
      enabled: true,
      ...this.dashboardManager.getDashboardData()
    };
  }

  /**
   * Get metrics trend
   *
   * @param {string} metric - Metric name
   * @param {number} duration - Duration in ms
   * @returns {Array} Trend data
   */
  getMetricTrend(metric, duration = 3600000) {
    if (!this.dashboardManager) {
      return [];
    }

    return this.dashboardManager.getTrend(metric, duration);
  }

  /**
   * Get SLA compliance report
   *
   * @param {Object} targets - SLA targets
   * @returns {Object} Compliance report
   */
  getSLACompliance(targets = {}) {
    if (!this.dashboardManager) {
      return { enabled: false };
    }

    return {
      enabled: true,
      ...this.dashboardManager.getSLACompliance(targets)
    };
  }

  /**
   * Get active alerts
   *
   * @param {string} minSeverity - Minimum severity
   * @returns {Array} Active alerts
   */
  getActiveAlerts(minSeverity = null) {
    if (!this.alertManager) {
      return [];
    }

    return this.alertManager.getActiveAlerts(minSeverity);
  }

  /**
   * Get alert summary
   *
   * @returns {Object} Alert summary
   */
  getAlertSummary() {
    if (!this.alertManager) {
      return { enabled: false };
    }

    return {
      enabled: true,
      ...this.alertManager.getSummary()
    };
  }

  /**
   * Acknowledge an alert
   *
   * @param {string} alertId - Alert ID
   * @param {string} by - Acknowledger
   * @returns {Object|null} Updated alert
   */
  acknowledgeAlert(alertId, by = 'system') {
    if (!this.alertManager) return null;
    return this.alertManager.acknowledgeAlert(alertId, by);
  }

  /**
   * Resolve an alert
   *
   * @param {string} alertId - Alert ID
   * @param {string} resolution - Resolution note
   * @returns {Object|null} Updated alert
   */
  resolveAlert(alertId, resolution = '') {
    if (!this.alertManager) return null;
    return this.alertManager.resolveAlert(alertId, resolution);
  }

  /**
   * Silence alerts for a rule
   *
   * @param {string} ruleId - Rule ID
   * @param {number} duration - Duration in ms
   * @param {string} reason - Reason
   */
  silenceRule(ruleId, duration, reason = '') {
    if (!this.alertManager) return;
    this.alertManager.silenceRule(ruleId, duration, reason);
  }

  /**
   * Export metrics in various formats
   *
   * @param {string} format - Format (json, prometheus, csv)
   * @returns {string} Exported metrics
   */
  exportMetrics(format = 'json') {
    if (!this.dashboardManager) {
      return format === 'json' ? '{"enabled": false}' : '# Monitoring disabled\n';
    }

    return this.dashboardManager.exportMetrics(format);
  }

  /**
   * Get comprehensive monitoring summary
   *
   * @returns {Object} Summary
   */
  async getSummary() {
    return {
      timestamp: new Date().toISOString(),
      status: this.isRunning ? 'running' : 'stopped',
      uptime: this.startedAt ? Date.now() - this.startedAt : 0,
      config: this.config,
      health: this.healthManager ? this.healthManager.getLastResults() : null,
      dashboard: this.dashboardManager ? {
        totalRequests: this.dashboardManager.aggregatedStats.totalRequests,
        errorRate: this.dashboardManager.aggregatedStats.totalRequests > 0
          ? (this.dashboardManager.aggregatedStats.totalErrors /
            this.dashboardManager.aggregatedStats.totalRequests * 100).toFixed(2) + '%'
          : '0%'
      } : null,
      alerts: this.alertManager ? this.alertManager.getSummary() : null
    };
  }

  // Private methods

  _updateDashboardFromHealth(healthResults) {
    // Extract memory utilization from health check
    const memoryCheck = healthResults.dependencies?.find(d => d.name === 'dependency:memory');
    if (memoryCheck && memoryCheck.details) {
      // Could update dashboard with memory metrics
    }
  }

  _checkHealthAlerts(healthResults) {
    // Check for unhealthy components
    const unhealthy = [
      ...healthResults.layers.filter(l => l.status === HealthStatus.UNHEALTHY),
      ...healthResults.dependencies.filter(d => d.status === HealthStatus.UNHEALTHY)
    ];

    if (unhealthy.length > 0) {
      // Manually trigger health alerts
      for (const check of unhealthy) {
        this.alertManager.checkMetrics({
          health: {
            [check.name]: {
              status: 'unhealthy',
              message: check.message
            }
          }
        });
      }
    }
  }

  _getMetricsForAlerts() {
    if (!this.dashboardManager) {
      return {};
    }

    const dashboard = this.dashboardManager.getDashboardData();

    return {
      errorRate: parseFloat(dashboard.summary?.errorRate) || 0,
      avgLatency: dashboard.latencyStats?.avg || 0,
      avgQuality: dashboard.qualityStats?.avg || 0,
      cacheMissRate: 100 - (dashboard.realtime?.cacheHitRate || 0),
      memoryUtilization: this._getMemoryUtilization()
    };
  }

  _getMemoryUtilization() {
    const used = process.memoryUsage();
    return (used.heapUsed / used.heapTotal) * 100;
  }

  _handleAlert(alert) {
    // Default alert handler - log to console
    const severityEmoji = {
      [AlertSeverity.INFO]: 'ℹ️',
      [AlertSeverity.WARNING]: '⚠️',
      [AlertSeverity.ERROR]: '❌',
      [AlertSeverity.CRITICAL]: '🔥'
    };

    console.log(
      `[Alert] ${severityEmoji[alert.severity] || '📢'} ${alert.severity.toUpperCase()}: ${alert.message}`
    );
  }
}

// Singleton instance
let _pipeline = null;

/**
 * Get or create singleton monitoring pipeline
 * @param {MonitoringConfig} config - Configuration
 * @returns {MonitoringPipeline}
 */
export function getMonitoringPipeline(config = {}) {
  if (!_pipeline) {
    _pipeline = new MonitoringPipeline(config);
  }
  return _pipeline;
}

/**
 * Reset monitoring pipeline (for testing)
 */
export function resetMonitoringPipeline() {
  if (_pipeline) {
    _pipeline.stop();
  }
  _pipeline = null;
}

/**
 * Quick access to health check
 *
 * @returns {Object} Health report
 */
export async function quickHealthCheck() {
  return getMonitoringPipeline().getHealthReport();
}

/**
 * Quick access to dashboard
 *
 * @returns {Object} Dashboard data
 */
export function quickDashboard() {
  return getMonitoringPipeline().getDashboardData();
}

/**
 * Quick access to active alerts
 *
 * @returns {Array} Active alerts
 */
export function quickAlerts() {
  return getMonitoringPipeline().getActiveAlerts();
}

export default MonitoringPipeline;
