/**
 * Anomaly Detection
 *
 * Real-time anomaly detection for performance metrics using Z-score,
 * sudden drop detection, consecutive low detection, and distribution shift.
 *
 * Implementation of Plan 07: Temporal Performance Tracking - Phase 3
 */

import { TemporalStore, temporalStore } from './temporalStorage.js';

// ============================================================================
// Phase 3: Anomaly Detection
// ============================================================================

/**
 * Calculate mean of an array
 *
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Mean value
 */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * AnomalyDetector - Real-time anomaly detection for performance metrics
 */
export class AnomalyDetector {
  /**
   * Create an AnomalyDetector
   *
   * @param {TemporalStore} store - Temporal store instance
   * @param {Object} options - Configuration options
   */
  constructor(store = temporalStore, options = {}) {
    this.store = store;
    this.thresholds = {
      zScore: options.zScore || 3.0,          // Standard deviations from mean
      percentDrop: options.percentDrop || 20, // Percent drop from recent average
      consecutiveLow: options.consecutiveLow || 5  // Consecutive low scores
    };
    this.alerts = [];
    this.alertCallbacks = [];
    this.maxAlerts = options.maxAlerts || 1000;
  }

  /**
   * Register a callback for alerts
   *
   * @param {Function} callback - Alert callback function
   */
  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Emit an alert to all registered callbacks
   *
   * @param {Object} alert - Alert object
   */
  emitAlert(alert) {
    alert.timestamp = alert.timestamp || new Date().toISOString();
    alert.id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.alerts.push(alert);

    // Limit stored alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (e) {
        console.error('Alert callback error:', e);
      }
    }
  }

  /**
   * Check a new data point for anomalies
   *
   * @param {Object} dataPoint - Data point to check
   * @returns {Array<Object>} Detected anomalies
   */
  checkDataPoint(dataPoint) {
    const anomalies = [];

    // Get baseline statistics
    const baseline = this.getBaseline(dataPoint.contentType, dataPoint.variant);

    if (!baseline || baseline.count < 20) {
      return [];  // Not enough data for anomaly detection
    }

    // Z-score check
    if (baseline.stdDev > 0) {
      const zScore = (dataPoint.qualityScore - baseline.mean) / baseline.stdDev;
      if (Math.abs(zScore) > this.thresholds.zScore) {
        const anomaly = {
          type: 'z_score_outlier',
          severity: zScore < -this.thresholds.zScore ? 'high' : 'medium',
          message: `Quality score ${dataPoint.qualityScore.toFixed(2)} is ${Math.abs(zScore).toFixed(1)} std devs from mean`,
          dataPoint,
          baseline: { mean: baseline.mean, stdDev: baseline.stdDev },
          zScore
        };
        anomalies.push(anomaly);
      }
    }

    // Sudden drop check (compare to last hour)
    const recentAvg = this.getRecentAverage(dataPoint.contentType, dataPoint.variant, 1);
    if (recentAvg && dataPoint.qualityScore < recentAvg * (1 - this.thresholds.percentDrop / 100)) {
      const dropPercent = ((1 - dataPoint.qualityScore / recentAvg) * 100).toFixed(0);
      anomalies.push({
        type: 'sudden_drop',
        severity: 'high',
        message: `Quality dropped ${dropPercent}% from recent average`,
        dataPoint,
        recentAvg: parseFloat(recentAvg.toFixed(3)),
        dropPercent: parseFloat(dropPercent)
      });
    }

    // Consecutive low check
    const consecutiveLow = this.checkConsecutiveLow(dataPoint);
    if (consecutiveLow) {
      anomalies.push(consecutiveLow);
    }

    // Emit alerts for high-severity anomalies
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'high') {
        this.emitAlert({
          ...anomaly,
          contentType: dataPoint.contentType,
          variant: dataPoint.variant
        });
      }
    }

    return anomalies;
  }

  /**
   * Get baseline statistics for a content type and variant
   *
   * @param {string} contentType - Content type
   * @param {string} variant - Variant
   * @param {number} windowHours - Window in hours
   * @returns {Object|null} Baseline statistics
   */
  getBaseline(contentType, variant, windowHours = 24) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - windowHours);

    const points = (this.store.indexByType[contentType] || [])
      .filter(dp =>
        dp.variant === variant &&
        new Date(dp.timestamp) >= cutoff
      )
      .map(dp => dp.qualityScore);

    if (points.length < 10) return null;

    const m = mean(points);
    const stdDev = Math.sqrt(
      points.reduce((sum, p) => sum + Math.pow(p - m, 2), 0) / points.length
    );

    return { mean: m, stdDev, count: points.length };
  }

  /**
   * Get recent average score
   *
   * @param {string} contentType - Content type
   * @param {string} variant - Variant
   * @param {number} hours - Hours to look back
   * @returns {number|null} Average score
   */
  getRecentAverage(contentType, variant, hours = 1) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const points = (this.store.indexByType[contentType] || [])
      .filter(dp =>
        dp.variant === variant &&
        new Date(dp.timestamp) >= cutoff
      )
      .map(dp => dp.qualityScore);

    if (points.length < 3) return null;

    return mean(points);
  }

  /**
   * Check for consecutive low scores
   *
   * @param {Object} dataPoint - Current data point
   * @returns {Object|null} Anomaly if detected
   */
  checkConsecutiveLow(dataPoint) {
    const baseline = this.getBaseline(dataPoint.contentType, dataPoint.variant);
    if (!baseline) return null;

    const lowThreshold = baseline.mean - baseline.stdDev;

    const recentPoints = (this.store.indexByType[dataPoint.contentType] || [])
      .filter(dp => dp.variant === dataPoint.variant)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, this.thresholds.consecutiveLow);

    if (recentPoints.length < this.thresholds.consecutiveLow) return null;

    const allLow = recentPoints.every(dp => dp.qualityScore < lowThreshold);

    if (allLow) {
      return {
        type: 'consecutive_low',
        severity: 'high',
        message: `Last ${this.thresholds.consecutiveLow} scores all below threshold (${lowThreshold.toFixed(2)})`,
        dataPoint,
        threshold: parseFloat(lowThreshold.toFixed(3)),
        recentScores: recentPoints.map(dp => parseFloat(dp.qualityScore.toFixed(2)))
      };
    }

    return null;
  }

  /**
   * Detect distribution shift using Kolmogorov-Smirnov test
   *
   * @param {string} contentType - Content type
   * @param {string} variant - Variant
   * @param {number} windowHours - Window in hours
   * @returns {Object|null} Shift detection results
   */
  detectDistributionShift(contentType, variant, windowHours = 6) {
    const now = new Date();
    const recentCutoff = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const baselineCutoff = new Date(now.getTime() - windowHours * 2 * 60 * 60 * 1000);

    const allPoints = (this.store.indexByType[contentType] || [])
      .filter(dp => dp.variant === variant);

    const recentPoints = allPoints
      .filter(dp => new Date(dp.timestamp) >= recentCutoff)
      .map(dp => dp.qualityScore)
      .sort((a, b) => a - b);

    const baselinePoints = allPoints
      .filter(dp =>
        new Date(dp.timestamp) >= baselineCutoff &&
        new Date(dp.timestamp) < recentCutoff
      )
      .map(dp => dp.qualityScore)
      .sort((a, b) => a - b);

    if (recentPoints.length < 10 || baselinePoints.length < 10) {
      return null;
    }

    // Kolmogorov-Smirnov statistic
    const ksStatistic = this.ksTest(recentPoints, baselinePoints);

    // Critical value for alpha=0.05
    const n1 = recentPoints.length;
    const n2 = baselinePoints.length;
    const criticalValue = 1.36 * Math.sqrt((n1 + n2) / (n1 * n2));

    const isShifted = ksStatistic > criticalValue;

    return {
      shifted: isShifted,
      ksStatistic: parseFloat(ksStatistic.toFixed(4)),
      criticalValue: parseFloat(criticalValue.toFixed(4)),
      recentSampleSize: n1,
      baselineSampleSize: n2,
      recentMean: parseFloat(mean(recentPoints).toFixed(3)),
      baselineMean: parseFloat(mean(baselinePoints).toFixed(3)),
      significance: ksStatistic > criticalValue * 1.5 ? 'high' : ksStatistic > criticalValue ? 'moderate' : 'none'
    };
  }

  /**
   * Kolmogorov-Smirnov two-sample test
   *
   * @param {Array<number>} sample1 - First sorted sample
   * @param {Array<number>} sample2 - Second sorted sample
   * @returns {number} KS statistic
   */
  ksTest(sample1, sample2) {
    const combined = [...sample1, ...sample2].sort((a, b) => a - b);
    const n1 = sample1.length;
    const n2 = sample2.length;

    let maxDiff = 0;
    let idx1 = 0, idx2 = 0;

    for (const value of combined) {
      while (idx1 < n1 && sample1[idx1] <= value) idx1++;
      while (idx2 < n2 && sample2[idx2] <= value) idx2++;

      const diff = Math.abs(idx1 / n1 - idx2 / n2);
      maxDiff = Math.max(maxDiff, diff);
    }

    return maxDiff;
  }

  /**
   * Get recent alerts
   *
   * @param {number} count - Number of alerts to return
   * @returns {Array<Object>} Recent alerts
   */
  getRecentAlerts(count = 20) {
    return this.alerts.slice(-count);
  }

  /**
   * Get alerts filtered by criteria
   *
   * @param {Object} filters - Filter criteria
   * @returns {Array<Object>} Filtered alerts
   */
  getAlerts(filters = {}) {
    let filtered = [...this.alerts];

    if (filters.contentType) {
      filtered = filtered.filter(a => a.contentType === filters.contentType);
    }

    if (filters.severity) {
      filtered = filtered.filter(a => a.severity === filters.severity);
    }

    if (filters.type) {
      filtered = filtered.filter(a => a.type === filters.type);
    }

    if (filters.since) {
      const sinceDate = new Date(filters.since);
      filtered = filtered.filter(a => new Date(a.timestamp) >= sinceDate);
    }

    if (filters.limit) {
      filtered = filtered.slice(-filters.limit);
    }

    return filtered;
  }

  /**
   * Clear all alerts
   */
  clearAlerts() {
    this.alerts = [];
  }

  /**
   * Get anomaly detection summary
   *
   * @returns {Object} Summary statistics
   */
  getSummary() {
    const byType = {};
    const bySeverity = { high: 0, medium: 0, low: 0 };
    const byContentType = {};

    for (const alert of this.alerts) {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      if (alert.contentType) {
        byContentType[alert.contentType] = (byContentType[alert.contentType] || 0) + 1;
      }
    }

    return {
      totalAlerts: this.alerts.length,
      byType,
      bySeverity,
      byContentType,
      recentAlerts: this.getRecentAlerts(5)
    };
  }
}

// Singleton instance
export const anomalyDetector = new AnomalyDetector(temporalStore);

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 3 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase3() {
  const results = {
    passed: true,
    tests: []
  };

  // Create test store with normal data
  const store = new TemporalStore();
  const detector = new AnomalyDetector(store, {
    zScore: 2.5,
    percentDrop: 15,
    consecutiveLow: 3
  });

  // Add baseline data
  const baseTime = new Date();
  for (let i = 0; i < 30; i++) {
    store.record({
      contentType: 'Roadmap',
      variant: 'champion',
      qualityScore: 3.8 + (Math.random() - 0.5) * 0.2,
      timestamp: new Date(baseTime.getTime() - (30 - i) * 3600000).toISOString()
    });
  }

  // Test 1: Get baseline works
  const baseline = detector.getBaseline('Roadmap', 'champion');
  results.tests.push({
    name: 'Get baseline works',
    passed: baseline !== null && baseline.mean > 3.5 && baseline.count >= 20,
    details: `mean=${baseline?.mean?.toFixed(3)}, count=${baseline?.count}`
  });

  // Test 2: Normal point passes
  const normalAnomalies = detector.checkDataPoint({
    contentType: 'Roadmap',
    variant: 'champion',
    qualityScore: 3.85
  });
  results.tests.push({
    name: 'Normal point passes without anomalies',
    passed: normalAnomalies.length === 0,
    details: `anomalies=${normalAnomalies.length}`
  });

  // Test 3: Z-score outlier detected
  const outlierAnomalies = detector.checkDataPoint({
    contentType: 'Roadmap',
    variant: 'champion',
    qualityScore: 2.0  // Way below normal
  });
  const hasZScore = outlierAnomalies.some(a => a.type === 'z_score_outlier');
  results.tests.push({
    name: 'Z-score outlier detected',
    passed: hasZScore,
    details: `found=${hasZScore}, anomalies=${outlierAnomalies.length}`
  });

  // Test 4: Alert callback works
  let alertReceived = false;
  detector.onAlert(() => { alertReceived = true; });
  detector.checkDataPoint({
    contentType: 'Roadmap',
    variant: 'champion',
    qualityScore: 1.5  // Very low
  });
  results.tests.push({
    name: 'Alert callback works',
    passed: alertReceived,
    details: `alertReceived=${alertReceived}`
  });

  // Test 5: Recent average calculation
  const recentAvg = detector.getRecentAverage('Roadmap', 'champion', 24);
  results.tests.push({
    name: 'Recent average calculation',
    passed: recentAvg !== null && recentAvg > 3.5,
    details: `recentAvg=${recentAvg?.toFixed(3)}`
  });

  // Test 6: Get alerts returns alerts
  const alerts = detector.getRecentAlerts(10);
  results.tests.push({
    name: 'Get alerts returns alerts',
    passed: alerts.length >= 1,
    details: `alerts=${alerts.length}`
  });

  // Test 7: KS test calculation
  const sample1 = [1, 2, 3, 4, 5];
  const sample2 = [1, 2, 3, 4, 5];
  const ksIdentical = detector.ksTest(sample1, sample2);
  results.tests.push({
    name: 'KS test identical samples',
    passed: ksIdentical === 0,
    details: `ks=${ksIdentical}`
  });

  // Test 8: KS test different samples
  const sample3 = [1, 2, 3, 4, 5].map(x => x + 2);
  const ksDifferent = detector.ksTest(sample1, sample3);
  results.tests.push({
    name: 'KS test different samples',
    passed: ksDifferent > 0,
    details: `ks=${ksDifferent.toFixed(3)}`
  });

  // Test 9: Filter alerts by severity
  const highAlerts = detector.getAlerts({ severity: 'high' });
  results.tests.push({
    name: 'Filter alerts by severity',
    passed: highAlerts.every(a => a.severity === 'high'),
    details: `highAlerts=${highAlerts.length}`
  });

  // Test 10: Summary statistics
  const summary = detector.getSummary();
  results.tests.push({
    name: 'Summary statistics',
    passed: summary.totalAlerts >= 1 && summary.byType !== undefined,
    details: `total=${summary.totalAlerts}`
  });

  // Test 11: Consecutive low detection
  // Add enough baseline data first (need at least 10 for baseline)
  for (let i = 0; i < 15; i++) {
    store.record({
      contentType: 'Document',
      variant: 'champion',
      qualityScore: 3.5 + (Math.random() - 0.5) * 0.2,
      timestamp: new Date(baseTime.getTime() - (20 - i) * 3600000).toISOString()
    });
  }
  // Now add consecutive low scores (need at least consecutiveLow=3)
  for (let i = 0; i < 4; i++) {
    store.record({
      contentType: 'Document',
      variant: 'champion',
      qualityScore: 2.0,  // Very low score - well below baseline - stdDev
      timestamp: new Date(baseTime.getTime() - (4 - i) * 3600000).toISOString()
    });
  }
  const consecutiveCheck = detector.checkConsecutiveLow({
    contentType: 'Document',
    variant: 'champion',
    qualityScore: 2.0
  });
  results.tests.push({
    name: 'Consecutive low detection',
    passed: consecutiveCheck !== null && consecutiveCheck.type === 'consecutive_low',
    details: `detected=${consecutiveCheck !== null}`
  });

  // Test 12: Clear alerts works
  detector.clearAlerts();
  results.tests.push({
    name: 'Clear alerts works',
    passed: detector.alerts.length === 0,
    details: `alerts=${detector.alerts.length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase3();
  console.log('Anomaly Detection Phase 3 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
