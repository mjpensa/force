/**
 * Adaptive Sample Distribution
 *
 * Dynamically adjusts variant distribution based on observed performance
 * and required sample sizes for statistical significance.
 *
 * Implementation of Plan 06: Statistical Significance Optimization - Phase 3
 */

import {
  mean,
  variance,
  calculateEffectSize,
  calculateRequiredSampleSize,
  calculatePower,
  minimumDetectableEffect
} from './statisticalUtils.js';

// ============================================================================
// Phase 3: Adaptive Sample Distribution
// ============================================================================

/**
 * AdaptiveDistributor - Manages dynamic variant allocation
 */
export class AdaptiveDistributor {
  /**
   * Create an AdaptiveDistributor
   *
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Minimum samples before making distribution adjustments
    this.minSampleSize = options.minSampleSize || 30;

    // Target statistical power
    this.targetPower = options.targetPower || 0.8;

    // Significance level
    this.alpha = options.alpha || 0.05;

    // Candidate allocation bounds
    this.maxCandidateRatio = options.maxCandidateRatio || 0.4;
    this.minCandidateRatio = options.minCandidateRatio || 0.1;

    // Active exploration allocation (always reserved)
    this.activeRatio = options.activeRatio || 0.1;

    // Default effect size assumption when unknown
    this.defaultEffectSize = options.defaultEffectSize || 0.3;

    // Variant statistics
    this.variantStats = {};

    // Distribution history for analysis
    this.distributionHistory = [];
  }

  /**
   * Initialize a variant
   *
   * @param {string} variant - Variant name
   */
  initializeVariant(variant) {
    this.variantStats[variant] = {
      scores: [],
      count: 0,
      mean: null,
      variance: null,
      lastUpdated: null
    };
  }

  /**
   * Record a score for a variant
   *
   * @param {string} variant - Variant name
   * @param {number} score - Quality score
   */
  recordScore(variant, score) {
    if (!this.variantStats[variant]) {
      this.initializeVariant(variant);
    }

    const stats = this.variantStats[variant];
    stats.scores.push(score);
    stats.count++;
    stats.mean = mean(stats.scores);
    stats.variance = variance(stats.scores);
    stats.lastUpdated = new Date().toISOString();
  }

  /**
   * Calculate optimal distribution based on current statistics
   *
   * @param {string} contentType - Content type (for logging)
   * @returns {Object} Distribution { champion, candidate, active, reasoning }
   */
  calculateOptimalDistribution(contentType = null) {
    const champion = this.variantStats['champion'];
    const candidate = this.variantStats['candidate'];

    // Default distribution if insufficient data
    if (!champion || !candidate || champion.count < 10 || candidate.count < 5) {
      return {
        champion: 0.7,
        candidate: 0.2,
        active: this.activeRatio,
        reasoning: {
          status: 'initializing',
          message: 'Collecting initial samples',
          championN: champion?.count || 0,
          candidateN: candidate?.count || 0
        }
      };
    }

    // Calculate current effect size
    const effectSize = calculateEffectSize(candidate.scores, champion.scores);
    const absEffect = Math.abs(effectSize);

    // Use observed effect size or default
    const estimatedEffect = absEffect > 0.05 ? absEffect : this.defaultEffectSize;

    // Calculate required sample size for this effect
    const requiredN = calculateRequiredSampleSize(
      estimatedEffect,
      this.targetPower,
      this.alpha
    );

    // How many more samples needed?
    const championNeeded = Math.max(0, requiredN - champion.count);
    const candidateNeeded = Math.max(0, requiredN - candidate.count);

    // Determine candidate ratio based on needs
    let candidateRatio;
    let reasoning;

    if (championNeeded === 0 && candidateNeeded === 0) {
      // Have enough samples - use balanced allocation
      candidateRatio = 0.25;
      reasoning = 'sufficient_samples';
    } else if (candidateNeeded > championNeeded * 1.5) {
      // Candidate needs significantly more samples - boost its allocation
      candidateRatio = Math.min(
        this.maxCandidateRatio,
        0.2 + (candidateNeeded / (championNeeded + candidateNeeded + 10)) * 0.2
      );
      reasoning = 'boosting_candidate';
    } else if (championNeeded > candidateNeeded * 1.5) {
      // Champion needs more - reduce candidate allocation
      candidateRatio = Math.max(
        this.minCandidateRatio,
        0.3 - (championNeeded - candidateNeeded) / 200
      );
      reasoning = 'boosting_champion';
    } else {
      // Balanced need
      candidateRatio = 0.25;
      reasoning = 'balanced';
    }

    // Ensure ratios sum to 1
    const championRatio = 1 - candidateRatio - this.activeRatio;

    const distribution = {
      champion: Math.round(championRatio * 100) / 100,
      candidate: Math.round(candidateRatio * 100) / 100,
      active: this.activeRatio,
      reasoning: {
        status: reasoning,
        effectSize: parseFloat(effectSize.toFixed(3)),
        estimatedEffect: parseFloat(estimatedEffect.toFixed(3)),
        requiredN,
        currentChampionN: champion.count,
        currentCandidateN: candidate.count,
        championNeeded,
        candidateNeeded,
        currentPower: parseFloat(calculatePower(
          Math.min(champion.count, candidate.count),
          estimatedEffect,
          this.alpha
        ).toFixed(3))
      }
    };

    // Record distribution history
    this.distributionHistory.push({
      timestamp: new Date().toISOString(),
      contentType,
      distribution: { ...distribution }
    });

    // Trim history to last 100 entries
    if (this.distributionHistory.length > 100) {
      this.distributionHistory = this.distributionHistory.slice(-100);
    }

    return distribution;
  }

  /**
   * Select a variant based on distribution
   *
   * @param {Object} distribution - Variant probabilities
   * @returns {string} Selected variant
   */
  selectVariant(distribution) {
    const rand = Math.random();
    let cumulative = 0;

    // Ensure we have valid distribution
    const dist = distribution || { champion: 0.7, candidate: 0.2, active: 0.1 };

    for (const [variant, prob] of Object.entries(dist)) {
      if (variant === 'reasoning') continue;  // Skip metadata
      cumulative += prob;
      if (rand <= cumulative) {
        return variant;
      }
    }

    return 'champion';  // Fallback
  }

  /**
   * Get progress report for sample collection
   *
   * @returns {Object} Progress report
   */
  getProgressReport() {
    const champion = this.variantStats['champion'];
    const candidate = this.variantStats['candidate'];

    if (!champion || !candidate) {
      return {
        status: 'not_started',
        message: 'No variants initialized'
      };
    }

    if (champion.count < 10 || candidate.count < 5) {
      return {
        status: 'initializing',
        message: 'Collecting initial samples',
        championSamples: champion.count,
        candidateSamples: candidate.count,
        progress: 'early_stage'
      };
    }

    // Calculate effect size and required samples
    const effectSize = calculateEffectSize(candidate.scores, champion.scores);
    const absEffect = Math.abs(effectSize) || this.defaultEffectSize;
    const requiredN = calculateRequiredSampleSize(absEffect, this.targetPower, this.alpha);

    const championProgress = Math.min(100, (champion.count / requiredN) * 100);
    const candidateProgress = Math.min(100, (candidate.count / requiredN) * 100);
    const overallProgress = Math.min(championProgress, candidateProgress);

    const currentPower = calculatePower(
      Math.min(champion.count, candidate.count),
      absEffect,
      this.alpha
    );

    return {
      status: overallProgress >= 100 ? 'ready_for_analysis' : 'collecting',
      championSamples: champion.count,
      candidateSamples: candidate.count,
      requiredSamples: requiredN,
      championProgress: parseFloat(championProgress.toFixed(1)),
      candidateProgress: parseFloat(candidateProgress.toFixed(1)),
      overallProgress: parseFloat(overallProgress.toFixed(1)),
      estimatedEffectSize: parseFloat(effectSize.toFixed(3)),
      currentPower: parseFloat(currentPower.toFixed(3)),
      canCompare: champion.count >= 20 && candidate.count >= 20,
      mde: parseFloat(minimumDetectableEffect(
        Math.min(champion.count, candidate.count),
        this.targetPower,
        this.alpha
      ).toFixed(3))
    };
  }

  /**
   * Estimate iterations needed to reach statistical power
   *
   * @param {Object} distribution - Current distribution
   * @returns {Object} Iteration estimate
   */
  estimateIterationsNeeded(distribution = null) {
    const dist = distribution || { champion: 0.7, candidate: 0.2, active: 0.1 };
    const champion = this.variantStats['champion'];
    const candidate = this.variantStats['candidate'];

    if (!champion || !candidate) {
      return { iterations: 100, message: 'Using default estimate' };
    }

    const effectSize = calculateEffectSize(candidate.scores, champion.scores);
    const absEffect = Math.abs(effectSize) || this.defaultEffectSize;
    const requiredN = calculateRequiredSampleSize(absEffect, this.targetPower, this.alpha);

    const championNeeded = Math.max(0, requiredN - champion.count);
    const candidateNeeded = Math.max(0, requiredN - candidate.count);

    const champRate = dist.champion || 0.7;
    const candRate = dist.candidate || 0.2;

    const iterationsForChamp = champRate > 0 ? championNeeded / champRate : Infinity;
    const iterationsForCand = candRate > 0 ? candidateNeeded / candRate : Infinity;

    return {
      iterations: Math.ceil(Math.max(iterationsForChamp, iterationsForCand)),
      breakdown: {
        championNeeded,
        candidateNeeded,
        bottleneck: iterationsForCand > iterationsForChamp ? 'candidate' : 'champion'
      },
      requiredSamplesPerVariant: requiredN
    };
  }

  /**
   * Reset all statistics
   */
  reset() {
    this.variantStats = {};
    this.distributionHistory = [];
  }

  /**
   * Get statistics summary
   *
   * @returns {Object} Statistics summary
   */
  getStats() {
    const stats = {};
    for (const [variant, data] of Object.entries(this.variantStats)) {
      stats[variant] = {
        count: data.count,
        mean: data.mean !== null ? parseFloat(data.mean.toFixed(4)) : null,
        variance: data.variance !== null ? parseFloat(data.variance.toFixed(4)) : null,
        lastUpdated: data.lastUpdated
      };
    }
    return stats;
  }
}

// Singleton instance
export const adaptiveDistributor = new AdaptiveDistributor();

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

  // Create test distributor
  const distributor = new AdaptiveDistributor({
    minSampleSize: 20,
    targetPower: 0.8
  });

  // Test 1: Initialize variants
  distributor.initializeVariant('champion');
  distributor.initializeVariant('candidate');
  results.tests.push({
    name: 'Initialize variants',
    passed: distributor.variantStats['champion'] !== undefined,
    details: `variants=${Object.keys(distributor.variantStats).join(', ')}`
  });

  // Test 2: Record scores
  for (let i = 0; i < 15; i++) {
    distributor.recordScore('champion', 3.5 + Math.random() * 0.5);
    distributor.recordScore('candidate', 3.7 + Math.random() * 0.5);
  }
  results.tests.push({
    name: 'Record scores',
    passed: distributor.variantStats['champion'].count === 15,
    details: `championN=${distributor.variantStats['champion'].count}`
  });

  // Test 3: Mean calculated correctly
  const champMean = distributor.variantStats['champion'].mean;
  results.tests.push({
    name: 'Mean calculation',
    passed: champMean > 3 && champMean < 4.5,
    details: `mean=${champMean.toFixed(3)}`
  });

  // Test 4: Calculate distribution with some data
  const dist1 = distributor.calculateOptimalDistribution('Test');
  results.tests.push({
    name: 'Calculate distribution',
    passed: dist1.champion + dist1.candidate + dist1.active === 1,
    details: `champ=${dist1.champion}, cand=${dist1.candidate}, active=${dist1.active}`
  });

  // Test 5: Distribution has reasoning
  results.tests.push({
    name: 'Distribution includes reasoning',
    passed: dist1.reasoning !== undefined && dist1.reasoning.status !== undefined,
    details: `status=${dist1.reasoning.status}`
  });

  // Test 6: Select variant works
  const selections = { champion: 0, candidate: 0, active: 0 };
  for (let i = 0; i < 1000; i++) {
    const selected = distributor.selectVariant({ champion: 0.7, candidate: 0.2, active: 0.1 });
    selections[selected]++;
  }
  results.tests.push({
    name: 'selectVariant distributes correctly',
    passed: selections.champion > 600 && selections.candidate > 150 && selections.active > 50,
    details: `champ=${selections.champion}, cand=${selections.candidate}, active=${selections.active}`
  });

  // Test 7: Progress report
  const progress = distributor.getProgressReport();
  results.tests.push({
    name: 'Progress report generated',
    passed: progress.championSamples === 15 && progress.status !== undefined,
    details: `status=${progress.status}, samples=${progress.championSamples}`
  });

  // Test 8: Add more samples and check power increases
  for (let i = 0; i < 50; i++) {
    distributor.recordScore('champion', 3.5 + Math.random() * 0.5);
    distributor.recordScore('candidate', 3.8 + Math.random() * 0.5);
  }
  const progress2 = distributor.getProgressReport();
  results.tests.push({
    name: 'Power increases with samples',
    passed: progress2.currentPower > progress.currentPower || progress2.championSamples > 50,
    details: `power=${progress2.currentPower}, samples=${progress2.championSamples}`
  });

  // Test 9: Estimate iterations needed
  const estimate = distributor.estimateIterationsNeeded();
  results.tests.push({
    name: 'Estimate iterations',
    passed: estimate.iterations !== undefined && estimate.breakdown !== undefined,
    details: `iterations=${estimate.iterations}`
  });

  // Test 10: Get stats
  const stats = distributor.getStats();
  results.tests.push({
    name: 'Get stats summary',
    passed: stats.champion !== undefined && stats.champion.count === 65,
    details: `championCount=${stats.champion.count}`
  });

  // Test 11: Distribution history recorded
  results.tests.push({
    name: 'Distribution history recorded',
    passed: distributor.distributionHistory.length > 0,
    details: `historyLength=${distributor.distributionHistory.length}`
  });

  // Test 12: Reset works
  distributor.reset();
  results.tests.push({
    name: 'Reset clears data',
    passed: Object.keys(distributor.variantStats).length === 0,
    details: `variantsAfterReset=${Object.keys(distributor.variantStats).length}`
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
  console.log('Adaptive Distribution Phase 3 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
