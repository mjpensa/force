/**
 * Validation Metrics Collector
 * Collects and analyzes metrics from the validation pipeline
 *
 * Metric Categories:
 * 1. Data Quality - Fact ratio, citation coverage, contradiction rate
 * 2. Validation Performance - Repair rate, validation time, gate failure rate
 * 3. Banking Compliance - Regulatory accuracy, buffer adherence, audit pass rate
 * 4. Confidence Calibration - Calibration accuracy, confidence distribution
 *
 * Provides system health score and trend analysis
 */

class MovingAverage {
  constructor(windowSize = 100) {
    this.windowSize = windowSize;
    this.values = [];
  }

  add(value) {
    this.values.push(value);
    if (this.values.length > this.windowSize) {
      this.values.shift();
    }
  }

  average() {
    if (this.values.length === 0) return 0;
    const sum = this.values.reduce((a, b) => a + b, 0);
    return sum / this.values.length;
  }

  recent(count = 10) {
    return this.values.slice(-count);
  }

  trend() {
    if (this.values.length < 2) return 'stable';

    const recent = this.values.slice(-10);
    const older = this.values.slice(-20, -10);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'degrading';
    return 'stable';
  }
}

export class ValidationMetricsCollector {
  constructor() {
    this.metrics = {
      dataQuality: {
        factRatio: new MovingAverage(100),
        citationCoverage: new MovingAverage(100),
        contradictionRate: new MovingAverage(100),
        provenanceScore: new MovingAverage(100)
      },
      validationPerformance: {
        repairRate: new MovingAverage(100),
        validationTimeMs: new MovingAverage(100),
        gateFailureRate: new MovingAverage(100),
        throughput: new MovingAverage(100) // charts per hour
      },
      bankingCompliance: {
        regulatoryAccuracy: new MovingAverage(100),
        bufferAdherence: new MovingAverage(100),
        auditPassRate: new MovingAverage(100)
      },
      confidenceCalibration: {
        calibrationAccuracy: new MovingAverage(100),
        averageConfidence: new MovingAverage(100),
        confidenceVariance: new MovingAverage(100)
      }
    };

    this.sessionMetrics = [];
    this.startTime = Date.now();
  }

  /**
   * Record validation metrics for a completed chart generation
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Object} validationResult - Complete validation results
   * @param {Object} performanceMetrics - Performance timing data
   */
  recordValidation(ganttData, validationResult, performanceMetrics = {}) {
    const timestamp = new Date().toISOString();

    // Data Quality Metrics
    this.recordDataQuality(ganttData, validationResult);

    // Validation Performance Metrics
    this.recordValidationPerformance(validationResult, performanceMetrics);

    // Banking Compliance Metrics
    this.recordBankingCompliance(ganttData, validationResult);

    // Confidence Calibration Metrics
    this.recordConfidenceMetrics(ganttData, validationResult);

    // Store session metrics
    this.sessionMetrics.push({
      timestamp: timestamp,
      chartId: ganttData.chartId || 'unknown',
      metrics: this.getSnapshotMetrics()
    });

    console.log(`[Metrics] Recorded validation metrics for chart generation`);
  }

  /**
   * Record data quality metrics
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Object} validationResult - Validation results
   */
  recordDataQuality(ganttData, validationResult) {
    const tasks = ganttData.tasks;
    const totalTasks = tasks.length;

    if (totalTasks === 0) return;

    // Fact ratio (explicit vs inferred)
    const explicitTasks = tasks.filter(t => t.origin === 'explicit').length;
    const factRatio = explicitTasks / totalTasks;
    this.metrics.dataQuality.factRatio.add(factRatio);

    // Citation coverage (cited explicit facts)
    const citedExplicitTasks = tasks.filter(t =>
      t.origin === 'explicit' && t.sourceCitations?.length > 0
    ).length;
    const citationCoverage = explicitTasks > 0 ? citedExplicitTasks / explicitTasks : 0;
    this.metrics.dataQuality.citationCoverage.add(citationCoverage);

    // Contradiction rate
    const contradictions = validationResult.contradictions?.length || 0;
    const claims = validationResult.totalClaims || totalTasks;
    const contradictionRate = claims > 0 ? contradictions / claims : 0;
    this.metrics.dataQuality.contradictionRate.add(contradictionRate);

    // Provenance score
    const provenanceScore = validationResult.provenanceResults?.summary?.averageScore || 70;
    this.metrics.dataQuality.provenanceScore.add(provenanceScore);
  }

  /**
   * Record validation performance metrics
   * @param {Object} validationResult - Validation results
   * @param {Object} performanceMetrics - Performance timing data
   */
  recordValidationPerformance(validationResult, performanceMetrics) {
    // Repair rate (how often repairs were needed)
    const repairApplied = validationResult.repairsApplied || 0;
    const totalValidations = validationResult.totalValidations || 1;
    const repairRate = repairApplied / totalValidations;
    this.metrics.validationPerformance.repairRate.add(repairRate);

    // Validation time
    const validationTimeMs = performanceMetrics.validationTimeMs || 0;
    this.metrics.validationPerformance.validationTimeMs.add(validationTimeMs);

    // Gate failure rate
    const gateResults = validationResult.qualityGateResults;
    if (gateResults) {
      const failedGates = gateResults.failures?.length || 0;
      const totalGates = gateResults.summary?.totalGates || 1;
      const gateFailureRate = failedGates / totalGates;
      this.metrics.validationPerformance.gateFailureRate.add(gateFailureRate);
    }

    // Throughput (charts per hour)
    const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
    const throughput = this.sessionMetrics.length / Math.max(uptimeHours, 0.1);
    this.metrics.validationPerformance.throughput.add(throughput);
  }

  /**
   * Record banking compliance metrics
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Object} validationResult - Validation results
   */
  recordBankingCompliance(ganttData, validationResult) {
    const tasks = ganttData.tasks;
    const totalTasks = tasks.length;

    if (totalTasks === 0) return;

    // Regulatory accuracy (properly flagged regulatory tasks)
    const regulatoryTasks = tasks.filter(t => t.regulatoryRequirement?.isRequired).length;
    const gateResult = validationResult.qualityGateResults?.warnings?.find(
      w => w.gate === 'REGULATORY_FLAGS'
    );
    const regulatoryAccuracy = gateResult?.score || 1.0;
    this.metrics.bankingCompliance.regulatoryAccuracy.add(regulatoryAccuracy);

    // Buffer adherence (tasks with proper time buffers)
    const tasksWithBuffers = tasks.filter(t =>
      t.duration?.value && t.duration.value >= 1
    ).length;
    const bufferAdherence = tasksWithBuffers / totalTasks;
    this.metrics.bankingCompliance.bufferAdherence.add(bufferAdherence);

    // Audit pass rate (overall quality gates passed)
    const auditPassed = validationResult.qualityGateResults?.passed ? 1 : 0;
    this.metrics.bankingCompliance.auditPassRate.add(auditPassed);
  }

  /**
   * Record confidence calibration metrics
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Object} validationResult - Validation results
   */
  recordConfidenceMetrics(ganttData, validationResult) {
    const tasks = ganttData.tasks;
    const totalTasks = tasks.length;

    if (totalTasks === 0) return;

    // Calibration accuracy (how much confidence changed)
    const calibratedTasks = tasks.filter(t => t.confidenceMetadata);
    if (calibratedTasks.length > 0) {
      const avgChange = calibratedTasks.reduce((sum, t) => {
        const original = t.confidenceMetadata.originalConfidence;
        const calibrated = t.confidenceMetadata.calibratedConfidence;
        return sum + Math.abs(calibrated - original);
      }, 0) / calibratedTasks.length;

      // Lower change = better calibration (initial confidence was accurate)
      const calibrationAccuracy = 1.0 - Math.min(avgChange, 0.5);
      this.metrics.confidenceCalibration.calibrationAccuracy.add(calibrationAccuracy);
    }

    // Average confidence
    const avgConfidence = tasks.reduce((sum, t) => sum + (t.confidence || 0.5), 0) / totalTasks;
    this.metrics.confidenceCalibration.averageConfidence.add(avgConfidence);

    // Confidence variance
    const variance = tasks.reduce((sum, t) => {
      const diff = (t.confidence || 0.5) - avgConfidence;
      return sum + (diff * diff);
    }, 0) / totalTasks;
    this.metrics.confidenceCalibration.confidenceVariance.add(variance);
  }

  /**
   * Get current snapshot of all metrics
   * @returns {Object} Current metrics snapshot
   */
  getSnapshotMetrics() {
    return {
      dataQuality: {
        factRatio: this.metrics.dataQuality.factRatio.average(),
        citationCoverage: this.metrics.dataQuality.citationCoverage.average(),
        contradictionRate: this.metrics.dataQuality.contradictionRate.average(),
        provenanceScore: this.metrics.dataQuality.provenanceScore.average()
      },
      validationPerformance: {
        repairRate: this.metrics.validationPerformance.repairRate.average(),
        validationTimeMs: Math.round(this.metrics.validationPerformance.validationTimeMs.average()),
        gateFailureRate: this.metrics.validationPerformance.gateFailureRate.average(),
        throughput: this.metrics.validationPerformance.throughput.average()
      },
      bankingCompliance: {
        regulatoryAccuracy: this.metrics.bankingCompliance.regulatoryAccuracy.average(),
        bufferAdherence: this.metrics.bankingCompliance.bufferAdherence.average(),
        auditPassRate: this.metrics.bankingCompliance.auditPassRate.average()
      },
      confidenceCalibration: {
        calibrationAccuracy: this.metrics.confidenceCalibration.calibrationAccuracy.average(),
        averageConfidence: this.metrics.confidenceCalibration.averageConfidence.average(),
        confidenceVariance: this.metrics.confidenceCalibration.confidenceVariance.average()
      }
    };
  }

  /**
   * Get system health score (0-100)
   * @returns {Object} Health score and status
   */
  getHealthScore() {
    const weights = {
      factRatio: 0.15,
      citationCoverage: 0.20,
      contradictionRate: 0.15,
      provenanceScore: 0.15,
      regulatoryAccuracy: 0.15,
      auditPassRate: 0.20
    };

    const current = this.getSnapshotMetrics();

    // Calculate weighted score (0-1)
    const score =
      current.dataQuality.factRatio * weights.factRatio +
      current.dataQuality.citationCoverage * weights.citationCoverage +
      (1 - current.dataQuality.contradictionRate) * weights.contradictionRate +
      (current.dataQuality.provenanceScore / 100) * weights.provenanceScore +
      current.bankingCompliance.regulatoryAccuracy * weights.regulatoryAccuracy +
      current.bankingCompliance.auditPassRate * weights.auditPassRate;

    const healthScore = Math.round(score * 100);

    return {
      score: healthScore,
      status: this.getHealthStatus(healthScore),
      trend: this.getHealthTrend(),
      metrics: current,
      recommendations: this.generateRecommendations(healthScore, current)
    };
  }

  /**
   * Determine health status from score
   * @param {number} score - Health score (0-100)
   * @returns {string} Status level
   */
  getHealthStatus(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'healthy';
    if (score >= 70) return 'degraded';
    if (score >= 60) return 'warning';
    return 'critical';
  }

  /**
   * Get health trend
   * @returns {string} Trend direction
   */
  getHealthTrend() {
    const trends = [
      this.metrics.dataQuality.citationCoverage.trend(),
      this.metrics.dataQuality.contradictionRate.trend(),
      this.metrics.bankingCompliance.auditPassRate.trend()
    ];

    const improving = trends.filter(t => t === 'improving').length;
    const degrading = trends.filter(t => t === 'degrading').length;

    if (improving > degrading) return 'improving';
    if (degrading > improving) return 'degrading';
    return 'stable';
  }

  /**
   * Generate recommendations based on metrics
   * @param {number} healthScore - Current health score
   * @param {Object} metrics - Current metrics
   * @returns {Array} Array of recommendations
   */
  generateRecommendations(healthScore, metrics) {
    const recommendations = [];

    // Citation coverage
    if (metrics.dataQuality.citationCoverage < 0.75) {
      recommendations.push({
        priority: 'high',
        category: 'data_quality',
        issue: 'Low citation coverage',
        value: `${Math.round(metrics.dataQuality.citationCoverage * 100)}%`,
        recommendation: 'Improve source document quality or downgrade uncited facts to inferences',
        target: '≥75%'
      });
    }

    // Contradiction rate
    if (metrics.dataQuality.contradictionRate > 0.1) {
      recommendations.push({
        priority: 'high',
        category: 'data_quality',
        issue: 'High contradiction rate',
        value: `${Math.round(metrics.dataQuality.contradictionRate * 100)}%`,
        recommendation: 'Review source documents for conflicting information and apply resolution matrix',
        target: '<10%'
      });
    }

    // Provenance score
    if (metrics.dataQuality.provenanceScore < 70) {
      recommendations.push({
        priority: 'medium',
        category: 'data_quality',
        issue: 'Low provenance score',
        value: metrics.dataQuality.provenanceScore,
        recommendation: 'Improve citation quality and reduce hallucinations',
        target: '≥70'
      });
    }

    // Regulatory accuracy
    if (metrics.bankingCompliance.regulatoryAccuracy < 0.9) {
      recommendations.push({
        priority: 'high',
        category: 'banking_compliance',
        issue: 'Low regulatory flagging accuracy',
        value: `${Math.round(metrics.bankingCompliance.regulatoryAccuracy * 100)}%`,
        recommendation: 'Review regulatory detection rules and update banking-semantic-rules.js',
        target: '≥90%'
      });
    }

    // Audit pass rate
    if (metrics.bankingCompliance.auditPassRate < 0.8) {
      recommendations.push({
        priority: 'critical',
        category: 'banking_compliance',
        issue: 'Low quality gate pass rate',
        value: `${Math.round(metrics.bankingCompliance.auditPassRate * 100)}%`,
        recommendation: 'Review quality gate thresholds or improve input data quality',
        target: '≥80%'
      });
    }

    // Performance
    if (metrics.validationPerformance.validationTimeMs > 10000) {
      recommendations.push({
        priority: 'low',
        category: 'performance',
        issue: 'Slow validation performance',
        value: `${Math.round(metrics.validationPerformance.validationTimeMs)}ms`,
        recommendation: 'Optimize validation pipeline or reduce task count',
        target: '<10s per chart'
      });
    }

    return recommendations;
  }

  /**
   * Get metrics for a specific time period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Session metrics in time range
   */
  getMetricsInRange(startDate, endDate) {
    return this.sessionMetrics.filter(session => {
      const sessionDate = new Date(session.timestamp);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }

  /**
   * Export metrics for external analysis
   * @returns {Object} Complete metrics export
   */
  exportMetrics() {
    return {
      exportedAt: new Date().toISOString(),
      systemUptime: Date.now() - this.startTime,
      totalSessions: this.sessionMetrics.length,
      currentHealth: this.getHealthScore(),
      sessionHistory: this.sessionMetrics,
      trends: {
        factRatio: this.metrics.dataQuality.factRatio.trend(),
        citationCoverage: this.metrics.dataQuality.citationCoverage.trend(),
        contradictionRate: this.metrics.dataQuality.contradictionRate.trend(),
        auditPassRate: this.metrics.bankingCompliance.auditPassRate.trend()
      }
    };
  }

  /**
   * Reset all metrics (for testing or maintenance)
   */
  resetMetrics() {
    Object.keys(this.metrics).forEach(category => {
      Object.keys(this.metrics[category]).forEach(metric => {
        this.metrics[category][metric] = new MovingAverage(100);
      });
    });

    this.sessionMetrics = [];
    this.startTime = Date.now();

    console.log('[Metrics] All metrics reset');
  }
}

// Export singleton instance
export const validationMetricsCollector = new ValidationMetricsCollector();
