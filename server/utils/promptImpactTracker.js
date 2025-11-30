/**
 * Prompt Impact Tracker
 *
 * Track and analyze the impact of prompt changes on generation quality,
 * with statistical comparison of before/after performance.
 *
 * Implementation of Plan 07: Temporal Performance Tracking - Phase 4
 */

import { TemporalStore, temporalStore } from './temporalStorage.js';
import { TrendAnalyzer, trendAnalyzer } from './trendAnalysis.js';

// ============================================================================
// Phase 4: Prompt Change Impact Tracking
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
 * Calculate variance of an array
 *
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Variance
 */
function variance(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1);
}

/**
 * Calculate percentile of a sorted array
 *
 * @param {Array<number>} sortedArr - Sorted array of numbers
 * @param {number} p - Percentile (0-100)
 * @returns {number|null} Percentile value
 */
function percentile(sortedArr, p) {
  if (!sortedArr || sortedArr.length === 0) return null;
  const idx = Math.floor(sortedArr.length * p / 100);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

/**
 * Welch's t-test for unequal variances
 *
 * @param {Array<number>} sample1 - First sample
 * @param {Array<number>} sample2 - Second sample
 * @returns {Object} T-test results
 */
function welchTTest(sample1, sample2) {
  const n1 = sample1.length;
  const n2 = sample2.length;

  if (n1 < 2 || n2 < 2) {
    return { tStatistic: 0, pValue: 1, significant: false, df: 0 };
  }

  const mean1 = mean(sample1);
  const mean2 = mean(sample2);
  const var1 = variance(sample1);
  const var2 = variance(sample2);

  const se1 = var1 / n1;
  const se2 = var2 / n2;
  const se = Math.sqrt(se1 + se2);

  if (se === 0) {
    return { tStatistic: 0, pValue: 1, significant: false, df: 0 };
  }

  const tStatistic = (mean1 - mean2) / se;

  // Welch-Satterthwaite degrees of freedom
  const num = Math.pow(se1 + se2, 2);
  const denom = Math.pow(se1, 2) / (n1 - 1) + Math.pow(se2, 2) / (n2 - 1);
  const df = denom > 0 ? num / denom : 1;

  // Approximate p-value using normal distribution for large df
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)));

  return {
    tStatistic: parseFloat(tStatistic.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    significant: pValue < 0.05,
    df: parseFloat(df.toFixed(2)),
    meanDifference: parseFloat((mean1 - mean2).toFixed(4))
  };
}

/**
 * Normal CDF approximation
 *
 * @param {number} z - Z-score
 * @returns {number} Cumulative probability
 */
function normalCDF(z) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * absZ);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Interpret effect size (Cohen's d)
 *
 * @param {number} d - Cohen's d value
 * @returns {string} Interpretation
 */
function interpretEffectSize(d) {
  const abs = Math.abs(d);
  if (abs < 0.2) return 'negligible';
  if (abs < 0.5) return 'small';
  if (abs < 0.8) return 'medium';
  return 'large';
}

/**
 * PromptImpactTracker - Track and analyze prompt change impacts
 */
export class PromptImpactTracker {
  /**
   * Create a PromptImpactTracker
   *
   * @param {TemporalStore} store - Temporal store instance
   * @param {TrendAnalyzer} analyzer - Trend analyzer instance
   */
  constructor(store = temporalStore, analyzer = trendAnalyzer) {
    this.store = store;
    this.trendAnalyzer = analyzer;
    this.promptChanges = [];
  }

  /**
   * Record a prompt change event
   *
   * @param {string} contentType - Content type
   * @param {string} oldVersion - Old prompt version
   * @param {string} newVersion - New prompt version
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Change record
   */
  recordPromptChange(contentType, oldVersion, newVersion, metadata = {}) {
    const change = {
      id: `pc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      contentType,
      oldVersion,
      newVersion,
      metadata,
      impact: null  // Calculated after sufficient data
    };

    this.promptChanges.push(change);

    return change;
  }

  /**
   * Analyze the impact of a prompt change
   *
   * @param {string} changeId - Change ID to analyze
   * @param {number} windowHours - Analysis window in hours
   * @returns {Object|null} Impact analysis
   */
  analyzePromptChangeImpact(changeId, windowHours = 24) {
    const change = this.promptChanges.find(c => c.id === changeId);
    if (!change) return null;

    const changeTime = new Date(change.timestamp);
    const beforeStart = new Date(changeTime.getTime() - windowHours * 60 * 60 * 1000);
    const afterEnd = new Date(changeTime.getTime() + windowHours * 60 * 60 * 1000);

    // Get data before and after
    const allPoints = this.store.indexByType[change.contentType] || [];

    const beforePoints = allPoints
      .filter(dp =>
        new Date(dp.timestamp) >= beforeStart &&
        new Date(dp.timestamp) < changeTime
      )
      .map(dp => dp.qualityScore);

    const afterPoints = allPoints
      .filter(dp =>
        new Date(dp.timestamp) >= changeTime &&
        new Date(dp.timestamp) <= afterEnd
      )
      .map(dp => dp.qualityScore);

    if (beforePoints.length < 10 || afterPoints.length < 10) {
      return {
        status: 'insufficient_data',
        changeId,
        beforeCount: beforePoints.length,
        afterCount: afterPoints.length,
        requiredCount: 10
      };
    }

    // Statistical comparison
    const beforeMean = mean(beforePoints);
    const afterMean = mean(afterPoints);
    const beforeVar = variance(beforePoints);
    const afterVar = variance(afterPoints);
    const pooledStd = Math.sqrt((beforeVar + afterVar) / 2);
    const effectSize = pooledStd > 0 ? (afterMean - beforeMean) / pooledStd : 0;

    // T-test
    const tTest = welchTTest(afterPoints, beforePoints);

    // Sort for percentiles
    const beforeSorted = [...beforePoints].sort((a, b) => a - b);
    const afterSorted = [...afterPoints].sort((a, b) => a - b);

    const impact = {
      status: 'analyzed',
      changeId,
      contentType: change.contentType,
      changeTimestamp: change.timestamp,
      analysisWindow: windowHours,

      before: {
        count: beforePoints.length,
        mean: parseFloat(beforeMean.toFixed(3)),
        stdDev: parseFloat(Math.sqrt(beforeVar).toFixed(3)),
        min: beforeSorted[0],
        max: beforeSorted[beforeSorted.length - 1],
        p50: percentile(beforeSorted, 50)
      },

      after: {
        count: afterPoints.length,
        mean: parseFloat(afterMean.toFixed(3)),
        stdDev: parseFloat(Math.sqrt(afterVar).toFixed(3)),
        min: afterSorted[0],
        max: afterSorted[afterSorted.length - 1],
        p50: percentile(afterSorted, 50)
      },

      comparison: {
        meanChange: parseFloat((afterMean - beforeMean).toFixed(3)),
        percentChange: beforeMean !== 0
          ? parseFloat(((afterMean - beforeMean) / beforeMean * 100).toFixed(1))
          : 0,
        effectSize: parseFloat(effectSize.toFixed(3)),
        effectSizeInterpretation: interpretEffectSize(effectSize),
        statistically_significant: tTest.significant,
        pValue: tTest.pValue,
        tStatistic: tTest.tStatistic
      },

      verdict: this.getVerdict(effectSize, tTest.significant, afterMean - beforeMean)
    };

    // Store impact on the change record
    change.impact = impact;

    return impact;
  }

  /**
   * Generate verdict for a prompt change
   *
   * @param {number} effectSize - Effect size
   * @param {boolean} significant - Statistical significance
   * @param {number} meanChange - Change in mean
   * @returns {Object} Verdict
   */
  getVerdict(effectSize, significant, meanChange) {
    if (!significant) {
      return {
        outcome: 'no_significant_change',
        recommendation: 'The prompt change did not produce a statistically significant difference',
        confidence: 'high'
      };
    }

    if (meanChange > 0 && effectSize > 0.3) {
      return {
        outcome: 'improvement',
        recommendation: 'Keep the new prompt - significant improvement detected',
        confidence: effectSize > 0.5 ? 'high' : 'medium'
      };
    }

    if (meanChange < 0 && effectSize < -0.3) {
      return {
        outcome: 'regression',
        recommendation: 'Consider reverting - significant regression detected',
        confidence: effectSize < -0.5 ? 'high' : 'medium'
      };
    }

    return {
      outcome: 'marginal_change',
      recommendation: 'Effect is statistically significant but practically small',
      confidence: 'medium'
    };
  }

  /**
   * Get prompt change history
   *
   * @param {string} contentType - Optional content type filter
   * @returns {Array<Object>} Change history
   */
  getPromptChangeHistory(contentType = null) {
    let changes = this.promptChanges;

    if (contentType) {
      changes = changes.filter(c => c.contentType === contentType);
    }

    return changes.map(c => ({
      ...c,
      impact: c.impact || 'pending_analysis'
    }));
  }

  /**
   * Analyze all pending impacts that have sufficient data
   *
   * @param {number} windowHours - Analysis window
   * @returns {Array<Object>} Analyzed impacts
   */
  analyzeAllPendingImpacts(windowHours = 24) {
    const analyzed = [];

    for (const change of this.promptChanges) {
      if (change.impact) continue;  // Already analyzed

      const changeTime = new Date(change.timestamp);
      const timeSinceChange = (Date.now() - changeTime.getTime()) / (1000 * 60 * 60);

      // Only analyze if enough time has passed
      if (timeSinceChange >= windowHours) {
        const impact = this.analyzePromptChangeImpact(change.id, windowHours);
        if (impact && impact.status === 'analyzed') {
          analyzed.push(impact);
        }
      }
    }

    return analyzed;
  }

  /**
   * Get changes by outcome
   *
   * @param {string} outcome - Outcome filter ('improvement', 'regression', 'no_significant_change')
   * @returns {Array<Object>} Filtered changes
   */
  getChangesByOutcome(outcome) {
    return this.promptChanges.filter(c =>
      c.impact && c.impact.verdict && c.impact.verdict.outcome === outcome
    );
  }

  /**
   * Get summary statistics
   *
   * @returns {Object} Summary
   */
  getSummary() {
    const analyzed = this.promptChanges.filter(c => c.impact && c.impact.status === 'analyzed');
    const pending = this.promptChanges.filter(c => !c.impact);

    const byOutcome = {
      improvement: 0,
      regression: 0,
      no_significant_change: 0,
      marginal_change: 0
    };

    const byContentType = {};

    for (const change of analyzed) {
      const outcome = change.impact.verdict?.outcome;
      if (outcome) {
        byOutcome[outcome] = (byOutcome[outcome] || 0) + 1;
      }
      byContentType[change.contentType] = (byContentType[change.contentType] || 0) + 1;
    }

    // Calculate average effect sizes
    const effectSizes = analyzed
      .map(c => c.impact.comparison?.effectSize)
      .filter(e => e !== undefined);
    const avgEffectSize = effectSizes.length > 0 ? mean(effectSizes) : null;

    return {
      totalChanges: this.promptChanges.length,
      analyzed: analyzed.length,
      pending: pending.length,
      byOutcome,
      byContentType,
      avgEffectSize: avgEffectSize !== null ? parseFloat(avgEffectSize.toFixed(3)) : null
    };
  }

  /**
   * Clear all prompt changes
   */
  clear() {
    this.promptChanges = [];
  }
}

// Singleton instance
export const promptImpactTracker = new PromptImpactTracker(temporalStore, trendAnalyzer);

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 4 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase4() {
  const results = {
    passed: true,
    tests: []
  };

  // Create test store
  const store = new TemporalStore();
  const analyzer = new TrendAnalyzer(store);
  const tracker = new PromptImpactTracker(store, analyzer);

  // Add baseline data (before the change)
  const changeTime = new Date();
  const beforeStart = new Date(changeTime.getTime() - 24 * 60 * 60 * 1000);

  for (let i = 0; i < 20; i++) {
    store.record({
      contentType: 'Roadmap',
      variant: 'champion',
      qualityScore: 3.5 + (Math.random() - 0.5) * 0.2,
      timestamp: new Date(beforeStart.getTime() + i * 3600000).toISOString()
    });
  }

  // Record the prompt change
  const change = tracker.recordPromptChange('Roadmap', 'v1', 'v2', { reason: 'test' });

  // Test 1: Record prompt change
  results.tests.push({
    name: 'Record prompt change',
    passed: change.id !== undefined && change.contentType === 'Roadmap',
    details: `id=${change.id}`
  });

  // Test 2: Change is in history
  const history = tracker.getPromptChangeHistory();
  results.tests.push({
    name: 'Change in history',
    passed: history.length === 1 && history[0].id === change.id,
    details: `history.length=${history.length}`
  });

  // Add after-change data (improved)
  for (let i = 0; i < 20; i++) {
    store.record({
      contentType: 'Roadmap',
      variant: 'champion',
      qualityScore: 3.9 + (Math.random() - 0.5) * 0.2,  // Higher scores
      timestamp: new Date(changeTime.getTime() + i * 3600000).toISOString()
    });
  }

  // Test 3: Analyze impact
  const impact = tracker.analyzePromptChangeImpact(change.id, 24);
  results.tests.push({
    name: 'Analyze impact',
    passed: impact !== null && impact.status === 'analyzed',
    details: `status=${impact?.status}`
  });

  // Test 4: Impact shows improvement
  results.tests.push({
    name: 'Impact shows improvement',
    passed: impact !== null && impact.comparison?.meanChange > 0,
    details: `meanChange=${impact?.comparison?.meanChange}`
  });

  // Test 5: Effect size calculated
  results.tests.push({
    name: 'Effect size calculated',
    passed: impact !== null && impact.comparison?.effectSize !== undefined,
    details: `effectSize=${impact?.comparison?.effectSize}`
  });

  // Test 6: Verdict generated
  results.tests.push({
    name: 'Verdict generated',
    passed: impact !== null && impact.verdict?.outcome !== undefined,
    details: `outcome=${impact?.verdict?.outcome}`
  });

  // Test 7: P-value is reasonable
  results.tests.push({
    name: 'P-value is reasonable',
    passed: impact !== null && impact.comparison?.pValue >= 0 && impact.comparison?.pValue <= 1,
    details: `pValue=${impact?.comparison?.pValue}`
  });

  // Test 8: Filter by content type
  tracker.recordPromptChange('Slides', 'v1', 'v2');
  const roadmapChanges = tracker.getPromptChangeHistory('Roadmap');
  results.tests.push({
    name: 'Filter by content type',
    passed: roadmapChanges.length === 1 && roadmapChanges[0].contentType === 'Roadmap',
    details: `filtered=${roadmapChanges.length}`
  });

  // Test 9: Get summary
  const summary = tracker.getSummary();
  results.tests.push({
    name: 'Get summary',
    passed: summary.totalChanges === 2 && summary.analyzed === 1,
    details: `total=${summary.totalChanges}, analyzed=${summary.analyzed}`
  });

  // Test 10: Interpret effect size
  results.tests.push({
    name: 'Interpret effect size - small',
    passed: interpretEffectSize(0.3) === 'small',
    details: `0.3=${interpretEffectSize(0.3)}`
  });

  // Test 11: Interpret effect size - large
  results.tests.push({
    name: 'Interpret effect size - large',
    passed: interpretEffectSize(1.0) === 'large',
    details: `1.0=${interpretEffectSize(1.0)}`
  });

  // Test 12: Clear works
  tracker.clear();
  results.tests.push({
    name: 'Clear works',
    passed: tracker.promptChanges.length === 0,
    details: `changes=${tracker.promptChanges.length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase4();
  console.log('Prompt Impact Tracker Phase 4 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
