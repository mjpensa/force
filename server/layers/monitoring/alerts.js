/**
 * Alerts Module - PROMPT ML Layer 10
 *
 * Intelligent alerting system for PROMPT ML:
 * - Threshold-based alerts
 * - Anomaly detection
 * - Alert routing and escalation
 * - Alert silencing and deduplication
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Alert severity levels
 * @readonly
 * @enum {string}
 */
export const AlertSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Alert status
 * @readonly
 * @enum {string}
 */
export const AlertStatus = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  SILENCED: 'silenced'
};

/**
 * Alert types
 * @readonly
 * @enum {string}
 */
export const AlertType = {
  THRESHOLD: 'threshold',
  ANOMALY: 'anomaly',
  HEALTH: 'health',
  SLA: 'sla',
  COST: 'cost',
  REGRESSION: 'regression'
};

/**
 * @typedef {Object} AlertRule
 * @property {string} id - Rule ID
 * @property {string} name - Rule name
 * @property {AlertType} type - Alert type
 * @property {string} metric - Metric to monitor
 * @property {string} condition - Condition (gt, lt, eq, ne)
 * @property {number} threshold - Threshold value
 * @property {AlertSeverity} severity - Alert severity
 * @property {number} duration - Duration before triggering (ms)
 * @property {boolean} enabled - Whether rule is enabled
 */

/**
 * @typedef {Object} Alert
 * @property {string} id - Alert ID
 * @property {string} ruleId - Triggering rule ID
 * @property {string} name - Alert name
 * @property {AlertType} type - Alert type
 * @property {AlertSeverity} severity - Severity
 * @property {AlertStatus} status - Current status
 * @property {string} message - Alert message
 * @property {Object} details - Additional details
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 * @property {string} acknowledgedAt - Acknowledgment timestamp
 * @property {string} resolvedAt - Resolution timestamp
 */

/**
 * @typedef {Object} AlertConfig
 * @property {number} checkInterval - Check interval in ms
 * @property {number} deduplicationWindow - Deduplication window in ms
 * @property {number} maxActiveAlerts - Maximum active alerts
 * @property {boolean} autoResolve - Auto-resolve when condition clears
 */

const DEFAULT_CONFIG = {
  checkInterval: 30000,
  deduplicationWindow: 300000, // 5 minutes
  maxActiveAlerts: 100,
  autoResolve: true
};

/**
 * Default alert rules for PROMPT ML
 */
const DEFAULT_RULES = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    type: AlertType.THRESHOLD,
    metric: 'errorRate',
    condition: 'gt',
    threshold: 10,
    severity: AlertSeverity.ERROR,
    duration: 60000,
    enabled: true
  },
  {
    id: 'high-latency',
    name: 'High Latency',
    type: AlertType.THRESHOLD,
    metric: 'avgLatency',
    condition: 'gt',
    threshold: 60000,
    severity: AlertSeverity.WARNING,
    duration: 120000,
    enabled: true
  },
  {
    id: 'low-quality',
    name: 'Low Quality Score',
    type: AlertType.THRESHOLD,
    metric: 'avgQuality',
    condition: 'lt',
    threshold: 0.5,
    severity: AlertSeverity.WARNING,
    duration: 300000,
    enabled: true
  },
  {
    id: 'memory-critical',
    name: 'Critical Memory Usage',
    type: AlertType.HEALTH,
    metric: 'memoryUtilization',
    condition: 'gt',
    threshold: 90,
    severity: AlertSeverity.CRITICAL,
    duration: 30000,
    enabled: true
  },
  {
    id: 'cache-miss-high',
    name: 'High Cache Miss Rate',
    type: AlertType.THRESHOLD,
    metric: 'cacheMissRate',
    condition: 'gt',
    threshold: 80,
    severity: AlertSeverity.INFO,
    duration: 300000,
    enabled: true
  }
];

/**
 * Alert Manager
 */
export class AlertManager {
  /**
   * @param {AlertConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = new Map();
    this.alerts = new Map();
    this.alertHistory = [];
    this.handlers = [];
    this.silences = new Map();
    this.checkInterval = null;

    // Tracking for threshold alerts
    this.thresholdBreaches = new Map();

    // Initialize default rules
    DEFAULT_RULES.forEach(rule => this.addRule(rule));
  }

  /**
   * Add an alert rule
   *
   * @param {AlertRule} rule - Alert rule
   */
  addRule(rule) {
    this.rules.set(rule.id, {
      ...rule,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Remove an alert rule
   *
   * @param {string} ruleId - Rule ID
   */
  removeRule(ruleId) {
    this.rules.delete(ruleId);
  }

  /**
   * Enable/disable a rule
   *
   * @param {string} ruleId - Rule ID
   * @param {boolean} enabled - Enable state
   */
  setRuleEnabled(ruleId, enabled) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Register an alert handler
   *
   * @param {Function} handler - Handler function (alert) => void
   */
  registerHandler(handler) {
    this.handlers.push(handler);
  }

  /**
   * Check metrics against rules
   *
   * @param {Object} metrics - Current metrics
   */
  checkMetrics(metrics) {
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      const value = this._getMetricValue(metrics, rule.metric);
      if (value === null) continue;

      const isBreached = this._evaluateCondition(value, rule.condition, rule.threshold);

      if (isBreached) {
        this._handleBreach(rule, value);
      } else {
        this._handleClear(rule);
      }
    }
  }

  /**
   * Create an alert
   *
   * @param {AlertRule} rule - Triggering rule
   * @param {number} value - Current metric value
   */
  createAlert(rule, value) {
    // Check for duplicate
    const existingAlert = Array.from(this.alerts.values()).find(
      a => a.ruleId === rule.id && a.status === AlertStatus.ACTIVE
    );

    if (existingAlert) {
      // Update existing alert
      existingAlert.updatedAt = new Date().toISOString();
      existingAlert.details.latestValue = value;
      existingAlert.details.occurrences = (existingAlert.details.occurrences || 1) + 1;
      return existingAlert;
    }

    // Check silencing
    if (this._isSilenced(rule.id)) {
      return null;
    }

    // Check max alerts
    if (this.alerts.size >= this.config.maxActiveAlerts) {
      // Remove oldest resolved alert
      this._pruneAlerts();
    }

    const alertId = this._generateAlertId();
    const alert = {
      id: alertId,
      ruleId: rule.id,
      name: rule.name,
      type: rule.type,
      severity: rule.severity,
      status: AlertStatus.ACTIVE,
      message: this._formatAlertMessage(rule, value),
      details: {
        metric: rule.metric,
        threshold: rule.threshold,
        condition: rule.condition,
        value,
        occurrences: 1
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.alerts.set(alertId, alert);
    this.alertHistory.push({ ...alert, event: 'created' });

    // Notify handlers
    this._notifyHandlers(alert);

    return alert;
  }

  /**
   * Acknowledge an alert
   *
   * @param {string} alertId - Alert ID
   * @param {string} acknowledgedBy - Who acknowledged
   * @returns {Alert|null} Updated alert
   */
  acknowledgeAlert(alertId, acknowledgedBy = 'system') {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== AlertStatus.ACTIVE) {
      return null;
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = acknowledgedBy;
    alert.updatedAt = new Date().toISOString();

    this.alertHistory.push({ ...alert, event: 'acknowledged' });

    return alert;
  }

  /**
   * Resolve an alert
   *
   * @param {string} alertId - Alert ID
   * @param {string} resolution - Resolution note
   * @returns {Alert|null} Updated alert
   */
  resolveAlert(alertId, resolution = 'Condition cleared') {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status === AlertStatus.RESOLVED) {
      return null;
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date().toISOString();
    alert.resolution = resolution;
    alert.updatedAt = new Date().toISOString();

    this.alertHistory.push({ ...alert, event: 'resolved' });

    return alert;
  }

  /**
   * Silence alerts for a rule
   *
   * @param {string} ruleId - Rule ID
   * @param {number} duration - Silence duration in ms
   * @param {string} reason - Silence reason
   */
  silenceRule(ruleId, duration, reason = '') {
    this.silences.set(ruleId, {
      until: Date.now() + duration,
      reason,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Unsilence a rule
   *
   * @param {string} ruleId - Rule ID
   */
  unsilenceRule(ruleId) {
    this.silences.delete(ruleId);
  }

  /**
   * Get active alerts
   *
   * @param {AlertSeverity} minSeverity - Minimum severity filter
   * @returns {Array<Alert>}
   */
  getActiveAlerts(minSeverity = null) {
    const severityOrder = [AlertSeverity.INFO, AlertSeverity.WARNING, AlertSeverity.ERROR, AlertSeverity.CRITICAL];
    const minIndex = minSeverity ? severityOrder.indexOf(minSeverity) : 0;

    return Array.from(this.alerts.values())
      .filter(a => a.status === AlertStatus.ACTIVE || a.status === AlertStatus.ACKNOWLEDGED)
      .filter(a => severityOrder.indexOf(a.severity) >= minIndex)
      .sort((a, b) => {
        // Sort by severity (critical first), then by creation time
        const severityDiff = severityOrder.indexOf(b.severity) - severityOrder.indexOf(a.severity);
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  /**
   * Get alert history
   *
   * @param {number} limit - Number of entries
   * @returns {Array}
   */
  getAlertHistory(limit = 50) {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alert summary
   *
   * @returns {Object}
   */
  getSummary() {
    const alerts = Array.from(this.alerts.values());
    const activeAlerts = alerts.filter(a => a.status === AlertStatus.ACTIVE);

    return {
      total: alerts.length,
      active: activeAlerts.length,
      acknowledged: alerts.filter(a => a.status === AlertStatus.ACKNOWLEDGED).length,
      resolved: alerts.filter(a => a.status === AlertStatus.RESOLVED).length,
      bySeverity: {
        critical: activeAlerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
        error: activeAlerts.filter(a => a.severity === AlertSeverity.ERROR).length,
        warning: activeAlerts.filter(a => a.severity === AlertSeverity.WARNING).length,
        info: activeAlerts.filter(a => a.severity === AlertSeverity.INFO).length
      },
      rules: {
        total: this.rules.size,
        enabled: Array.from(this.rules.values()).filter(r => r.enabled).length
      },
      silences: {
        active: Array.from(this.silences.entries())
          .filter(([, s]) => s.until > Date.now())
          .length
      }
    };
  }

  /**
   * Start periodic checking
   *
   * @param {Function} metricsProvider - Function that returns current metrics
   */
  startChecking(metricsProvider) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      const metrics = metricsProvider();
      this.checkMetrics(metrics);
    }, this.config.checkInterval);
  }

  /**
   * Stop periodic checking
   */
  stopChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Clear all alerts
   */
  clearAll() {
    this.alerts.clear();
    this.thresholdBreaches.clear();
  }

  // Private methods

  _getMetricValue(metrics, metricPath) {
    const parts = metricPath.split('.');
    let value = metrics;

    for (const part of parts) {
      if (value === null || value === undefined) return null;
      value = value[part];
    }

    return typeof value === 'number' ? value : null;
  }

  _evaluateCondition(value, condition, threshold) {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  _handleBreach(rule, value) {
    const breachKey = rule.id;
    const now = Date.now();

    if (!this.thresholdBreaches.has(breachKey)) {
      this.thresholdBreaches.set(breachKey, {
        startTime: now,
        lastValue: value
      });
    }

    const breach = this.thresholdBreaches.get(breachKey);
    breach.lastValue = value;

    // Check if breach duration exceeded
    if (now - breach.startTime >= rule.duration) {
      this.createAlert(rule, value);
    }
  }

  _handleClear(rule) {
    const breachKey = rule.id;
    this.thresholdBreaches.delete(breachKey);

    // Auto-resolve if configured
    if (this.config.autoResolve) {
      const activeAlerts = Array.from(this.alerts.values())
        .filter(a => a.ruleId === rule.id && a.status === AlertStatus.ACTIVE);

      for (const alert of activeAlerts) {
        this.resolveAlert(alert.id, 'Condition cleared automatically');
      }
    }
  }

  _isSilenced(ruleId) {
    const silence = this.silences.get(ruleId);
    if (!silence) return false;

    if (silence.until <= Date.now()) {
      this.silences.delete(ruleId);
      return false;
    }

    return true;
  }

  _formatAlertMessage(rule, value) {
    const conditionText = {
      gt: 'exceeded',
      gte: 'reached or exceeded',
      lt: 'fell below',
      lte: 'at or below',
      eq: 'equals',
      ne: 'changed from'
    };

    return `${rule.name}: ${rule.metric} ${conditionText[rule.condition] || rule.condition} threshold (${value} ${rule.condition} ${rule.threshold})`;
  }

  _generateAlertId() {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _notifyHandlers(alert) {
    for (const handler of this.handlers) {
      try {
        handler(alert);
      } catch (error) {
        console.error('[AlertManager] Handler error:', error);
      }
    }
  }

  _pruneAlerts() {
    // Remove oldest resolved alerts
    const resolved = Array.from(this.alerts.entries())
      .filter(([, a]) => a.status === AlertStatus.RESOLVED)
      .sort((a, b) => new Date(a[1].resolvedAt) - new Date(b[1].resolvedAt));

    if (resolved.length > 0) {
      this.alerts.delete(resolved[0][0]);
    }
  }
}

// Singleton instance
let _alertManager = null;

/**
 * Get or create singleton alert manager
 * @param {AlertConfig} config - Configuration
 * @returns {AlertManager}
 */
export function getAlertManager(config = {}) {
  if (!_alertManager) {
    _alertManager = new AlertManager(config);
  }
  return _alertManager;
}

/**
 * Reset alert manager (for testing)
 */
export function resetAlertManager() {
  if (_alertManager) {
    _alertManager.stopChecking();
    _alertManager.clearAll();
  }
  _alertManager = null;
}

export default AlertManager;
