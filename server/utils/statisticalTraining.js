/**
 * Statistical Training Integration
 *
 * Integrates all statistical components into a unified training system
 * with proper power analysis, adaptive distribution, and early stopping.
 *
 * Implementation of Plan 06: Statistical Significance Optimization - Phase 5
 */

import { mean, calculateEffectSize, calculatePower, calculateRequiredSampleSize } from './statisticalUtils.js';
import { welchTTest, confidenceInterval } from './hypothesisTesting.js';
import { AdaptiveDistributor } from './adaptiveDistribution.js';
import { PromotionDecisionMaker } from './promotionDecision.js';
import { SequentialAnalyzer } from './sequentialAnalysis.js';

// ============================================================================
// Phase 5: Training Loop Integration
// ============================================================================

/**
 * StatisticalTrainer - Unified statistical training manager
 */
export class StatisticalTrainer {
  /**
   * Create a StatisticalTrainer
   *
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Training parameters
    this.maxIterations = options.maxIterations || 1000;
    this.checkInterval = options.checkInterval || 50;
    this.earlyStopOnSignificance = options.earlyStopOnSignificance !== false;

    // Statistical parameters
    this.alpha = options.alpha || 0.05;
    this.targetPower = options.targetPower || 0.8;
    this.minEffectSize = options.minEffectSize || 0.1;

    // Component instances
    this.distributor = new AdaptiveDistributor({
      targetPower: this.targetPower,
      alpha: this.alpha
    });

    this.decisionMaker = new PromotionDecisionMaker({
      alpha: this.alpha,
      minEffectSize: this.minEffectSize,
      power: this.targetPower
    });

    this.sequentialAnalyzer = new SequentialAnalyzer({
      maxLooks: options.maxLooks || 5,
      alpha: this.alpha
    });

    // Training state
    this.iteration = 0;
    this.contentTypeStats = {};
    this.promotions = [];
    this.demotions = [];
    this.earlyStops = [];

    // Callbacks
    this.onProgress = options.onProgress || null;
    this.onDecision = options.onDecision || null;
  }

  /**
   * Initialize training for content types
   *
   * @param {Array<string>} contentTypes - Content types to train
   */
  initialize(contentTypes) {
    for (const contentType of contentTypes) {
      this.contentTypeStats[contentType] = {
        distributor: new AdaptiveDistributor({
          targetPower: this.targetPower,
          alpha: this.alpha
        }),
        sequentialAnalyzer: new SequentialAnalyzer({
          maxLooks: 5,
          alpha: this.alpha
        }),
        stopped: false,
        stopReason: null
      };

      // Initialize variants
      this.contentTypeStats[contentType].distributor.initializeVariant('champion');
      this.contentTypeStats[contentType].distributor.initializeVariant('candidate');
      this.contentTypeStats[contentType].distributor.initializeVariant('active');
    }
  }

  /**
   * Record a training result
   *
   * @param {string} contentType - Content type
   * @param {string} variant - Variant used
   * @param {number} score - Quality score
   */
  recordResult(contentType, variant, score) {
    if (!this.contentTypeStats[contentType]) {
      return;
    }

    const stats = this.contentTypeStats[contentType];
    if (stats.stopped) return;

    stats.distributor.recordScore(variant, score);
    this.iteration++;
  }

  /**
   * Get next variant to use
   *
   * @param {string} contentType - Content type
   * @returns {Object} { variant, distribution }
   */
  getNextVariant(contentType) {
    if (!this.contentTypeStats[contentType]) {
      return { variant: 'champion', distribution: null };
    }

    const stats = this.contentTypeStats[contentType];
    if (stats.stopped) {
      return { variant: 'champion', distribution: null };
    }

    const distribution = stats.distributor.calculateOptimalDistribution(contentType);
    const variant = stats.distributor.selectVariant(distribution);

    return { variant, distribution };
  }

  /**
   * Perform periodic statistical check
   *
   * @param {string} contentType - Content type
   * @returns {Object} Check results
   */
  performStatisticalCheck(contentType) {
    const stats = this.contentTypeStats[contentType];
    if (!stats || stats.stopped) {
      return { status: 'stopped', contentType };
    }

    const distributor = stats.distributor;
    const progress = distributor.getProgressReport();

    const result = {
      contentType,
      progress,
      decision: null,
      shouldStop: false
    };

    // Only evaluate if we have enough samples
    if (!progress.canCompare) {
      result.decision = {
        recommendation: 'collect_more_data',
        message: 'Not enough samples for comparison yet'
      };
      return result;
    }

    // Get scores
    const champScores = distributor.variantStats['champion']?.scores || [];
    const candScores = distributor.variantStats['candidate']?.scores || [];

    // Sequential analysis (for early stopping)
    const interimResult = stats.sequentialAnalyzer.performInterimAnalysis(champScores, candScores);

    // Full decision evaluation
    const decision = this.decisionMaker.evaluatePromotion(champScores, candScores);
    result.decision = decision;
    result.interimAnalysis = interimResult;

    // Check for early stopping
    if (this.earlyStopOnSignificance && decision.confidence === 'high') {
      result.shouldStop = true;
      result.stopReason = 'high_confidence_decision';
    } else if (interimResult.stop && interimResult.significant) {
      result.shouldStop = true;
      result.stopReason = 'sequential_boundary_crossed';
    }

    // Handle promotion/demotion
    if (decision.shouldPromote) {
      result.action = 'promote';
      this.promotions.push({
        contentType,
        timestamp: new Date().toISOString(),
        effectSize: decision.analysis.effectSize?.value,
        confidence: decision.confidence
      });
    } else if (decision.shouldDemote) {
      result.action = 'demote';
      this.demotions.push({
        contentType,
        timestamp: new Date().toISOString(),
        effectSize: decision.analysis.effectSize?.value,
        confidence: decision.confidence
      });
    }

    // Mark as stopped if needed
    if (result.shouldStop) {
      stats.stopped = true;
      stats.stopReason = result.stopReason;
      this.earlyStops.push({
        contentType,
        reason: result.stopReason,
        timestamp: new Date().toISOString()
      });
    }

    // Trigger callback
    if (this.onDecision) {
      this.onDecision(result);
    }

    return result;
  }

  /**
   * Check if all content types have stopped
   *
   * @returns {boolean} True if all stopped
   */
  allStopped() {
    return Object.values(this.contentTypeStats).every(s => s.stopped);
  }

  /**
   * Generate final report
   *
   * @returns {Object} Training report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalIterations: this.iteration,
      contentTypes: {},
      promotions: this.promotions,
      demotions: this.demotions,
      earlyStops: this.earlyStops
    };

    for (const [contentType, stats] of Object.entries(this.contentTypeStats)) {
      const distributor = stats.distributor;
      const champScores = distributor.variantStats['champion']?.scores || [];
      const candScores = distributor.variantStats['candidate']?.scores || [];

      const champCI = confidenceInterval(champScores);
      const candCI = confidenceInterval(candScores);
      const tTest = welchTTest(candScores, champScores);
      const effectSize = calculateEffectSize(candScores, champScores);

      report.contentTypes[contentType] = {
        stopped: stats.stopped,
        stopReason: stats.stopReason,
        championStats: {
          n: champScores.length,
          mean: champCI.mean,
          ci95: [champCI.lower, champCI.upper]
        },
        candidateStats: {
          n: candScores.length,
          mean: candCI.mean,
          ci95: [candCI.lower, candCI.upper]
        },
        comparison: {
          effectSize: parseFloat(effectSize.toFixed(4)),
          pValue: tTest.pValue,
          significant: tTest.significant,
          meanDifference: tTest.meanDifference
        },
        finalDecision: this.decisionMaker.evaluatePromotion(champScores, candScores),
        sequentialAnalysis: stats.sequentialAnalyzer.getStatus()
      };
    }

    return report;
  }

  /**
   * Get training status summary
   *
   * @returns {Object} Status summary
   */
  getStatus() {
    const status = {
      iteration: this.iteration,
      contentTypes: {}
    };

    for (const [contentType, stats] of Object.entries(this.contentTypeStats)) {
      status.contentTypes[contentType] = {
        stopped: stats.stopped,
        progress: stats.distributor.getProgressReport(),
        sequentialLooks: stats.sequentialAnalyzer.looksTaken
      };
    }

    return status;
  }

  /**
   * Reset trainer for new training session
   */
  reset() {
    this.iteration = 0;
    this.contentTypeStats = {};
    this.promotions = [];
    this.demotions = [];
    this.earlyStops = [];
  }
}

// Singleton instance
export const statisticalTrainer = new StatisticalTrainer();

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 5 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase5() {
  const results = {
    passed: true,
    tests: []
  };

  // Create trainer
  const trainer = new StatisticalTrainer({
    maxIterations: 100,
    checkInterval: 20,
    targetPower: 0.8
  });

  // Test 1: Initialize content types
  trainer.initialize(['Roadmap', 'Slides']);
  results.tests.push({
    name: 'Initialize content types',
    passed: Object.keys(trainer.contentTypeStats).length === 2,
    details: `contentTypes=${Object.keys(trainer.contentTypeStats).join(', ')}`
  });

  // Test 2: Get next variant
  const next = trainer.getNextVariant('Roadmap');
  results.tests.push({
    name: 'Get next variant',
    passed: next.variant !== undefined && ['champion', 'candidate', 'active'].includes(next.variant),
    details: `variant=${next.variant}`
  });

  // Test 3: Record results
  for (let i = 0; i < 30; i++) {
    trainer.recordResult('Roadmap', 'champion', 3.5 + Math.random() * 0.5);
    trainer.recordResult('Roadmap', 'candidate', 3.8 + Math.random() * 0.5);
    trainer.recordResult('Slides', 'champion', 3.3 + Math.random() * 0.4);
    trainer.recordResult('Slides', 'candidate', 3.4 + Math.random() * 0.4);
  }
  results.tests.push({
    name: 'Record results',
    passed: trainer.iteration === 120,
    details: `iterations=${trainer.iteration}`
  });

  // Test 4: Statistical check
  const check = trainer.performStatisticalCheck('Roadmap');
  results.tests.push({
    name: 'Perform statistical check',
    passed: check.progress !== undefined && check.decision !== undefined,
    details: `hasProgress=${check.progress !== undefined}`
  });

  // Test 5: Progress report accurate
  results.tests.push({
    name: 'Progress report accurate',
    passed: check.progress.championSamples === 30 && check.progress.candidateSamples === 30,
    details: `champion=${check.progress.championSamples}, candidate=${check.progress.candidateSamples}`
  });

  // Test 6: Decision includes analysis
  results.tests.push({
    name: 'Decision includes analysis',
    passed: check.decision.analysis !== undefined && check.decision.analysis.effectSize !== undefined,
    details: `hasEffectSize=${check.decision.analysis?.effectSize !== undefined}`
  });

  // Test 7: Get status
  const status = trainer.getStatus();
  results.tests.push({
    name: 'Get status works',
    passed: status.iteration === 120 && status.contentTypes.Roadmap !== undefined,
    details: `iteration=${status.iteration}`
  });

  // Test 8: Generate report
  const report = trainer.generateReport();
  results.tests.push({
    name: 'Generate report',
    passed: report.contentTypes.Roadmap !== undefined && report.contentTypes.Roadmap.championStats !== undefined,
    details: `hasRoadmap=${report.contentTypes.Roadmap !== undefined}`
  });

  // Test 9: Report includes comparison
  results.tests.push({
    name: 'Report includes comparison',
    passed: report.contentTypes.Roadmap.comparison !== undefined && report.contentTypes.Roadmap.comparison.effectSize !== undefined,
    details: `effectSize=${report.contentTypes.Roadmap.comparison?.effectSize}`
  });

  // Test 10: Report includes sequential analysis
  results.tests.push({
    name: 'Report includes sequential analysis',
    passed: report.contentTypes.Roadmap.sequentialAnalysis !== undefined,
    details: `hasSequential=${report.contentTypes.Roadmap.sequentialAnalysis !== undefined}`
  });

  // Test 11: All stopped detection
  results.tests.push({
    name: 'All stopped detection works',
    passed: typeof trainer.allStopped() === 'boolean',
    details: `allStopped=${trainer.allStopped()}`
  });

  // Test 12: Reset works
  trainer.reset();
  results.tests.push({
    name: 'Reset clears state',
    passed: trainer.iteration === 0 && Object.keys(trainer.contentTypeStats).length === 0,
    details: `iteration=${trainer.iteration}, types=${Object.keys(trainer.contentTypeStats).length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase5();
  console.log('Statistical Training Phase 5 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
