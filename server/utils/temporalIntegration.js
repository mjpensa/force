/**
 * Temporal Integration
 *
 * Integrates temporal performance tracking with the training loop,
 * providing automatic metric recording, anomaly monitoring, and
 * prompt change impact analysis.
 *
 * Implementation of Plan 07: Temporal Performance Tracking - Phase 6
 */

import { temporalStore } from './temporalStorage.js';
import { trendAnalyzer } from './trendAnalysis.js';
import { anomalyDetector } from './anomalyDetection.js';
import { promptImpactTracker } from './promptImpactTracker.js';

// ============================================================================
// Phase 6: Training Loop Integration
// ============================================================================

/**
 * TemporalIntegration - Bridges temporal tracking with training loop
 */
export class TemporalIntegration {
  /**
   * Create a TemporalIntegration
   *
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.store = temporalStore;
    this.trendAnalyzer = trendAnalyzer;
    this.anomalyDetector = anomalyDetector;
    this.promptImpactTracker = promptImpactTracker;

    this.sessionId = options.sessionId || `session_${Date.now()}`;
    this.contentTypes = options.contentTypes || ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];
    this.checkInterval = options.checkInterval || 100;  // Check trends every N iterations
    this.iteration = 0;

    // Event handlers
    this.onAnomaly = options.onAnomaly || null;
    this.onTrendAlert = options.onTrendAlert || null;
    this.onPromptChange = options.onPromptChange || null;

    // Setup anomaly alert handling
    this.anomalyDetector.onAlert((alert) => {
      this.handleAnomaly(alert);
    });
  }

  /**
   * Record a generation result
   *
   * @param {Object} result - Generation result
   * @param {string} contentType - Content type
   * @param {string} variant - Variant used
   * @param {string} promptVersion - Prompt version
   * @returns {Object} Recorded data point with any anomalies
   */
  recordGeneration(result, contentType, variant, promptVersion) {
    const dataPoint = {
      timestamp: new Date().toISOString(),
      contentType,
      variant,
      promptVersion,
      qualityScore: result.score || result.qualityScore,
      feedbackRating: result.feedback?.rating,
      dimensions: result.dimensions,
      latency: result.latency,
      tokenCount: result.tokenCount,
      success: result.success !== false,
      errorCategory: result.errorCategory || null,
      sampleId: result.sampleId,
      sessionId: this.sessionId
    };

    // Store in temporal store
    this.store.record(dataPoint);

    // Check for anomalies
    const anomalies = this.anomalyDetector.checkDataPoint(dataPoint);

    this.iteration++;

    // Perform periodic checks
    if (this.iteration % this.checkInterval === 0) {
      this.performPeriodicChecks();
    }

    return { dataPoint, anomalies };
  }

  /**
   * Handle an anomaly alert
   *
   * @param {Object} alert - Anomaly alert
   */
  handleAnomaly(alert) {
    console.warn(`[Temporal] Anomaly detected: ${alert.type} - ${alert.message}`);

    if (this.onAnomaly) {
      try {
        this.onAnomaly(alert);
      } catch (e) {
        console.error('[Temporal] Error in anomaly handler:', e);
      }
    }
  }

  /**
   * Perform periodic trend and status checks
   */
  performPeriodicChecks() {
    for (const contentType of this.contentTypes) {
      // Check for declining trends
      const trend = this.trendAnalyzer.analyzeTrend(contentType, 'champion', {
        start: new Date(Date.now() - 3600000),  // Last hour
        end: new Date()
      });

      if (trend.status === 'analyzed' && trend.trend?.direction === 'declining') {
        const alert = {
          type: 'declining_trend',
          contentType,
          trend: trend.trend,
          summary: trend.summary
        };

        console.warn(`[Temporal] Declining trend for ${contentType}:`, trend.summary);

        if (this.onTrendAlert) {
          try {
            this.onTrendAlert(alert);
          } catch (e) {
            console.error('[Temporal] Error in trend alert handler:', e);
          }
        }
      }

      // Check for distribution shifts
      const shift = this.anomalyDetector.detectDistributionShift(contentType, 'champion');
      if (shift && shift.shifted) {
        console.warn(`[Temporal] Distribution shift for ${contentType}:`, shift);
      }
    }
  }

  /**
   * Record a prompt change
   *
   * @param {string} contentType - Content type
   * @param {string} oldPrompt - Old prompt (or version)
   * @param {string} newPrompt - New prompt (or version)
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Change record
   */
  recordPromptChange(contentType, oldPrompt, newPrompt, metadata = {}) {
    const oldVersion = this.hashPrompt(oldPrompt);
    const newVersion = this.hashPrompt(newPrompt);

    const change = this.promptImpactTracker.recordPromptChange(
      contentType,
      oldVersion,
      newVersion,
      {
        ...metadata,
        sessionId: this.sessionId,
        iteration: this.iteration
      }
    );

    console.log(`[Temporal] Prompt change recorded for ${contentType}: ${oldVersion} -> ${newVersion}`);

    if (this.onPromptChange) {
      try {
        this.onPromptChange(change);
      } catch (e) {
        console.error('[Temporal] Error in prompt change handler:', e);
      }
    }

    return change;
  }

  /**
   * Hash a prompt for versioning
   *
   * @param {string} prompt - Prompt text
   * @returns {string} Hash or version string
   */
  hashPrompt(prompt) {
    if (typeof prompt !== 'string') {
      return `v${Date.now()}`;
    }

    // Simple hash for versioning
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `v${Math.abs(hash).toString(16)}`;
  }

  /**
   * Get status summary for all content types
   *
   * @returns {Object} Status summary
   */
  getStatus() {
    const status = {
      sessionId: this.sessionId,
      iteration: this.iteration,
      timestamp: new Date().toISOString(),
      storage: this.store.getStats(),
      contentTypes: {}
    };

    for (const contentType of this.contentTypes) {
      const trend = this.trendAnalyzer.analyzeTrend(contentType, 'champion', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      status.contentTypes[contentType] = {
        dataPoints: trend.dataPoints || 0,
        trend: trend.status === 'analyzed' ? {
          direction: trend.trend?.direction,
          strength: trend.trend?.strength
        } : null,
        statistics: trend.statistics || null
      };
    }

    status.anomalySummary = this.anomalyDetector.getSummary();
    status.promptChangeSummary = this.promptImpactTracker.getSummary();

    return status;
  }

  /**
   * Get comprehensive report for the session
   *
   * @returns {Object} Session report
   */
  generateReport() {
    const report = {
      sessionId: this.sessionId,
      generatedAt: new Date().toISOString(),
      totalIterations: this.iteration,
      duration: null,
      contentTypes: {}
    };

    // Calculate duration from data
    const stats = this.store.getStats();
    if (stats.oldestTimestamp && stats.newestTimestamp) {
      const duration = new Date(stats.newestTimestamp) - new Date(stats.oldestTimestamp);
      report.duration = {
        milliseconds: duration,
        minutes: parseFloat((duration / 60000).toFixed(2)),
        hours: parseFloat((duration / 3600000).toFixed(2))
      };
    }

    for (const contentType of this.contentTypes) {
      const trend = this.trendAnalyzer.analyzeTrend(contentType, 'champion', {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      });

      const championTrend = trend;
      const candidateTrend = this.trendAnalyzer.analyzeTrend(contentType, 'candidate', {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      });

      report.contentTypes[contentType] = {
        champion: {
          dataPoints: championTrend.dataPoints || 0,
          statistics: championTrend.statistics,
          trend: championTrend.trend,
          weekOverWeek: championTrend.weekOverWeek,
          changePoints: championTrend.changePoints?.length || 0
        },
        candidate: {
          dataPoints: candidateTrend.dataPoints || 0,
          statistics: candidateTrend.statistics,
          trend: candidateTrend.trend,
          weekOverWeek: candidateTrend.weekOverWeek,
          changePoints: candidateTrend.changePoints?.length || 0
        }
      };
    }

    report.anomalies = this.anomalyDetector.getSummary();
    report.promptChanges = this.promptImpactTracker.getSummary();

    // Analyze pending prompt impacts
    const impacts = this.promptImpactTracker.analyzeAllPendingImpacts(24);
    report.recentPromptImpacts = impacts;

    return report;
  }

  /**
   * Reset for a new session
   *
   * @param {string} newSessionId - Optional new session ID
   */
  reset(newSessionId = null) {
    this.sessionId = newSessionId || `session_${Date.now()}`;
    this.iteration = 0;
    this.store.clear();
    this.anomalyDetector.clearAlerts();
    this.promptImpactTracker.clear();
  }
}

// Singleton instance
export const temporalIntegration = new TemporalIntegration();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Record a generation with temporal tracking
 *
 * @param {Object} result - Generation result
 * @param {string} contentType - Content type
 * @param {string} variant - Variant
 * @param {string} promptVersion - Prompt version
 * @returns {Object} Recorded data point with anomalies
 */
export function recordGenerationMetrics(result, contentType, variant, promptVersion) {
  return temporalIntegration.recordGeneration(result, contentType, variant, promptVersion);
}

/**
 * Record a prompt change
 *
 * @param {string} contentType - Content type
 * @param {string} oldPrompt - Old prompt
 * @param {string} newPrompt - New prompt
 * @param {Object} metadata - Metadata
 * @returns {Object} Change record
 */
export function recordPromptChange(contentType, oldPrompt, newPrompt, metadata = {}) {
  return temporalIntegration.recordPromptChange(contentType, oldPrompt, newPrompt, metadata);
}

/**
 * Get current temporal status
 *
 * @returns {Object} Status
 */
export function getTemporalStatus() {
  return temporalIntegration.getStatus();
}

/**
 * Generate session report
 *
 * @returns {Object} Report
 */
export function generateTemporalReport() {
  return temporalIntegration.generateReport();
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 6 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase6() {
  const results = {
    passed: true,
    tests: []
  };

  // Create test integration
  const integration = new TemporalIntegration({
    sessionId: 'test_session',
    contentTypes: ['Roadmap', 'Slides'],
    checkInterval: 10
  });

  // Test 1: Record generation
  const result1 = integration.recordGeneration(
    { score: 3.8, latency: 150, success: true },
    'Roadmap',
    'champion',
    'v1'
  );
  results.tests.push({
    name: 'Record generation',
    passed: result1.dataPoint !== undefined && result1.dataPoint.qualityScore === 3.8,
    details: `score=${result1.dataPoint?.qualityScore}`
  });

  // Test 2: Session ID is tracked
  results.tests.push({
    name: 'Session ID is tracked',
    passed: result1.dataPoint.sessionId === 'test_session',
    details: `sessionId=${result1.dataPoint?.sessionId}`
  });

  // Test 3: Iteration counter
  results.tests.push({
    name: 'Iteration counter increments',
    passed: integration.iteration === 1,
    details: `iteration=${integration.iteration}`
  });

  // Test 4: Multiple recordings
  for (let i = 0; i < 5; i++) {
    integration.recordGeneration(
      { score: 3.5 + Math.random() * 0.5 },
      'Roadmap',
      'champion',
      'v1'
    );
  }
  results.tests.push({
    name: 'Multiple recordings',
    passed: integration.iteration === 6,
    details: `iteration=${integration.iteration}`
  });

  // Test 5: Record prompt change
  const change = integration.recordPromptChange('Roadmap', 'old prompt', 'new prompt', { reason: 'test' });
  results.tests.push({
    name: 'Record prompt change',
    passed: change.id !== undefined && change.contentType === 'Roadmap',
    details: `id=${change.id}`
  });

  // Test 6: Hash prompt
  const hash1 = integration.hashPrompt('test prompt 1');
  const hash2 = integration.hashPrompt('test prompt 2');
  const hash1Again = integration.hashPrompt('test prompt 1');
  results.tests.push({
    name: 'Hash prompt consistently',
    passed: hash1 === hash1Again && hash1 !== hash2,
    details: `hash1=${hash1}, hash1Again=${hash1Again}`
  });

  // Test 7: Get status
  const status = integration.getStatus();
  results.tests.push({
    name: 'Get status',
    passed: status.sessionId === 'test_session' && status.iteration === 6,
    details: `sessionId=${status.sessionId}, iteration=${status.iteration}`
  });

  // Test 8: Status includes content types
  results.tests.push({
    name: 'Status includes content types',
    passed: status.contentTypes !== undefined && 'Roadmap' in status.contentTypes,
    details: `hasRoadmap=${'Roadmap' in status.contentTypes}`
  });

  // Test 9: Generate report
  const report = integration.generateReport();
  results.tests.push({
    name: 'Generate report',
    passed: report.sessionId === 'test_session' && report.totalIterations === 6,
    details: `iterations=${report.totalIterations}`
  });

  // Test 10: Anomaly handler can be set
  let anomalyReceived = false;
  const integration2 = new TemporalIntegration({
    onAnomaly: () => { anomalyReceived = true; }
  });
  results.tests.push({
    name: 'Anomaly handler can be set',
    passed: integration2.onAnomaly !== null,
    details: `hasHandler=${integration2.onAnomaly !== null}`
  });

  // Test 11: Reset works
  integration.reset('new_session');
  results.tests.push({
    name: 'Reset works',
    passed: integration.sessionId === 'new_session' && integration.iteration === 0,
    details: `sessionId=${integration.sessionId}, iteration=${integration.iteration}`
  });

  // Test 12: Convenience functions work
  const convResult = recordGenerationMetrics(
    { score: 4.0 },
    'Slides',
    'candidate',
    'v2'
  );
  results.tests.push({
    name: 'Convenience functions work',
    passed: convResult.dataPoint.qualityScore === 4.0,
    details: `score=${convResult.dataPoint?.qualityScore}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase6();
  console.log('Temporal Integration Phase 6 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
