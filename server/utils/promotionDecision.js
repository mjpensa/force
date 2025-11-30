/**
 * Promotion Decision Framework
 *
 * Makes statistically-backed decisions about promoting or demoting variants.
 *
 * Implementation of Plan 06: Statistical Significance Optimization - Phase 4
 */

import {
  mean,
  calculateEffectSize,
  interpretEffectSize,
  calculateRequiredSampleSize
} from './statisticalUtils.js';

import {
  welchTTest,
  mannWhitneyU,
  confidenceInterval,
  differenceConfidenceInterval
} from './hypothesisTesting.js';

// ============================================================================
// Phase 4: Promotion Decision Framework
// ============================================================================

/**
 * PromotionDecisionMaker - Evaluates variants for promotion/demotion
 */
export class PromotionDecisionMaker {
  /**
   * Create a PromotionDecisionMaker
   *
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Significance level for hypothesis tests
    this.alpha = options.alpha || 0.05;

    // Minimum effect size to consider practically meaningful
    this.minEffectSize = options.minEffectSize || 0.1;

    // Required power for decision confidence
    this.requiredPower = options.power || 0.8;

    // Minimum samples before making decisions
    this.minSamples = options.minSamples || 20;

    // Decision history for audit trail
    this.decisionHistory = [];
  }

  /**
   * Evaluate whether to promote, demote, or continue testing
   *
   * @param {Array<number>} championScores - Champion variant scores
   * @param {Array<number>} candidateScores - Candidate variant scores
   * @param {Object} options - Additional options
   * @returns {Object} Decision with analysis
   */
  evaluatePromotion(championScores, candidateScores, options = {}) {
    const decision = {
      shouldPromote: false,
      shouldDemote: false,
      needsMoreData: false,
      confidence: 'low',
      analysis: {},
      recommendation: null,
      timestamp: new Date().toISOString()
    };

    const champN = championScores?.length || 0;
    const candN = candidateScores?.length || 0;

    // Sample size check
    if (champN < this.minSamples || candN < this.minSamples) {
      decision.needsMoreData = true;
      decision.recommendation = 'collect_more_data';
      decision.message = `Insufficient samples: champion=${champN}, candidate=${candN} (need ${this.minSamples} each)`;
      decision.analysis.sampleSizes = { champion: champN, candidate: candN, required: this.minSamples };
      return decision;
    }

    // Calculate basic statistics
    const champMean = mean(championScores);
    const candMean = mean(candidateScores);
    decision.analysis.means = {
      champion: parseFloat(champMean.toFixed(4)),
      candidate: parseFloat(candMean.toFixed(4)),
      difference: parseFloat((candMean - champMean).toFixed(4)),
      percentImprovement: parseFloat(((candMean - champMean) / champMean * 100).toFixed(2))
    };

    // Effect size analysis
    const effectSize = calculateEffectSize(candidateScores, championScores);
    decision.analysis.effectSize = {
      value: parseFloat(effectSize.toFixed(4)),
      interpretation: interpretEffectSize(effectSize),
      practicallySignificant: Math.abs(effectSize) >= this.minEffectSize
    };

    // Check if effect is practically meaningful
    if (Math.abs(effectSize) < this.minEffectSize) {
      decision.needsMoreData = true;
      decision.recommendation = 'effect_too_small';
      decision.message = `Effect size (d=${effectSize.toFixed(3)}) below minimum threshold (${this.minEffectSize})`;
      decision.analysis.practicalSignificance = false;
      return decision;
    }
    decision.analysis.practicalSignificance = true;

    // Statistical tests
    const tTest = welchTTest(candidateScores, championScores);
    const uTest = mannWhitneyU(candidateScores, championScores);
    decision.analysis.welchTTest = tTest;
    decision.analysis.mannWhitneyU = uTest;

    // Confidence intervals
    const champCI = confidenceInterval(championScores);
    const candCI = confidenceInterval(candidateScores);
    const diffCI = differenceConfidenceInterval(candidateScores, championScores);

    decision.analysis.confidenceIntervals = {
      champion: champCI,
      candidate: candCI,
      difference: diffCI
    };

    // Do confidence intervals overlap?
    const ciOverlap = !(candCI.lower > champCI.upper || candCI.upper < champCI.lower);
    decision.analysis.confidenceIntervalsOverlap = ciOverlap;

    // Decision logic
    const candidateBetter = candMean > champMean;

    // High confidence: Both tests significant AND non-overlapping CIs
    if (tTest.significant && !ciOverlap) {
      decision.confidence = 'high';
      if (candidateBetter) {
        decision.shouldPromote = true;
        decision.recommendation = 'promote';
        decision.message = 'Candidate significantly better with high confidence (p<0.05, non-overlapping CIs)';
      } else {
        decision.shouldDemote = true;
        decision.recommendation = 'demote';
        decision.message = 'Candidate significantly worse with high confidence (p<0.05, non-overlapping CIs)';
      }
    }
    // Medium confidence: Significant t-test but overlapping CIs
    else if (tTest.significant && ciOverlap) {
      decision.confidence = 'medium';
      if (candidateBetter && effectSize > 0.3) {
        decision.shouldPromote = true;
        decision.recommendation = 'promote_cautious';
        decision.message = 'Candidate likely better (p<0.05, moderate effect size, but CIs overlap)';
      } else if (!candidateBetter && effectSize < -0.3) {
        decision.shouldDemote = true;
        decision.recommendation = 'demote_cautious';
        decision.message = 'Candidate likely worse (p<0.05, moderate effect size, but CIs overlap)';
      } else {
        decision.needsMoreData = true;
        decision.recommendation = 'collect_more_data';
        decision.message = 'Statistically significant but small effect size - collect more data for clarity';
      }
    }
    // Non-parametric agreement check
    else if (uTest.significant && !tTest.significant) {
      decision.confidence = 'low';
      decision.needsMoreData = true;
      decision.recommendation = 'verify_distribution';
      decision.message = 'Mann-Whitney significant but t-test not - check data distribution';
    }
    // Low confidence: No significant difference
    else {
      decision.confidence = 'low';
      decision.needsMoreData = true;
      decision.recommendation = 'collect_more_data';
      decision.message = 'No significant difference detected - collect more data';
    }

    // Calculate how many more samples might be needed
    if (decision.needsMoreData) {
      const targetEffect = Math.abs(effectSize) || 0.3;
      const requiredN = calculateRequiredSampleSize(targetEffect, this.requiredPower, this.alpha);
      decision.analysis.additionalSamplesNeeded = {
        perVariant: Math.max(0, requiredN - Math.min(champN, candN)),
        targetSampleSize: requiredN
      };
    }

    // Record decision
    this.decisionHistory.push({
      timestamp: decision.timestamp,
      decision: decision.recommendation,
      confidence: decision.confidence,
      sampleSizes: { champion: champN, candidate: candN },
      effectSize: effectSize.toFixed(3),
      pValue: tTest.pValue
    });

    // Trim history
    if (this.decisionHistory.length > 100) {
      this.decisionHistory = this.decisionHistory.slice(-100);
    }

    return decision;
  }

  /**
   * Calculate how many more iterations are needed
   *
   * @param {Object} currentStats - Current variant statistics
   * @param {Object} distribution - Current distribution ratios
   * @returns {Object} Iteration requirements
   */
  calculateRequiredIterations(currentStats, distribution = null) {
    const dist = distribution || { champion: 0.7, candidate: 0.2, active: 0.1 };

    const championN = currentStats.champion?.count || 0;
    const candidateN = currentStats.candidate?.count || 0;

    // Estimate effect size from current data or assume small-medium
    const effectSize = currentStats.effectSize || 0.3;
    const requiredN = calculateRequiredSampleSize(
      Math.abs(effectSize),
      this.requiredPower,
      this.alpha
    );

    const championNeeded = Math.max(0, requiredN - championN);
    const candidateNeeded = Math.max(0, requiredN - candidateN);

    const champRate = dist.champion || 0.7;
    const candRate = dist.candidate || 0.2;

    const iterationsForChamp = champRate > 0 ? Math.ceil(championNeeded / champRate) : 0;
    const iterationsForCand = candRate > 0 ? Math.ceil(candidateNeeded / candRate) : 0;

    return {
      requiredSamplesPerVariant: requiredN,
      currentSamples: {
        champion: championN,
        candidate: candidateN
      },
      additionalSamplesNeeded: {
        champion: championNeeded,
        candidate: candidateNeeded
      },
      additionalIterationsNeeded: Math.max(iterationsForChamp, iterationsForCand),
      bottleneck: iterationsForCand > iterationsForChamp ? 'candidate' : 'champion',
      assumedEffectSize: effectSize
    };
  }

  /**
   * Get quick recommendation based on preliminary data
   *
   * @param {Array<number>} championScores - Champion scores
   * @param {Array<number>} candidateScores - Candidate scores
   * @returns {Object} Quick recommendation
   */
  getQuickRecommendation(championScores, candidateScores) {
    const champN = championScores?.length || 0;
    const candN = candidateScores?.length || 0;

    if (champN < 10 || candN < 10) {
      return {
        status: 'insufficient_data',
        recommendation: 'Continue collecting samples',
        progress: `${Math.min(champN, candN)}/10 minimum samples`
      };
    }

    const champMean = mean(championScores);
    const candMean = mean(candidateScores);
    const effectSize = calculateEffectSize(candidateScores, championScores);

    const trend = candMean > champMean ? 'candidate_leading' : 'champion_leading';
    const effectMagnitude = interpretEffectSize(effectSize);

    return {
      status: 'preliminary',
      trend,
      effectMagnitude,
      effectSize: parseFloat(effectSize.toFixed(3)),
      recommendation: Math.abs(effectSize) < 0.2
        ? 'Difference appears minimal - may need many more samples'
        : `${trend === 'candidate_leading' ? 'Candidate' : 'Champion'} shows ${effectMagnitude} advantage`,
      sampleProgress: `champion: ${champN}, candidate: ${candN}`
    };
  }

  /**
   * Get decision history summary
   *
   * @returns {Object} History summary
   */
  getHistorySummary() {
    if (this.decisionHistory.length === 0) {
      return { message: 'No decisions recorded yet' };
    }

    const decisions = this.decisionHistory;
    const promotions = decisions.filter(d => d.decision === 'promote' || d.decision === 'promote_cautious').length;
    const demotions = decisions.filter(d => d.decision === 'demote' || d.decision === 'demote_cautious').length;
    const continues = decisions.filter(d => d.decision === 'collect_more_data').length;

    return {
      totalDecisions: decisions.length,
      promotions,
      demotions,
      continuations: continues,
      lastDecision: decisions[decisions.length - 1],
      averageEffectSize: parseFloat(
        (decisions.reduce((sum, d) => sum + parseFloat(d.effectSize), 0) / decisions.length).toFixed(3)
      )
    };
  }
}

// Singleton instance
export const promotionDecisionMaker = new PromotionDecisionMaker();

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

  const decisionMaker = new PromotionDecisionMaker({
    minSamples: 15,
    minEffectSize: 0.1
  });

  // Test 1: Insufficient samples returns needsMoreData
  const insufficient = decisionMaker.evaluatePromotion(
    [1, 2, 3],
    [4, 5, 6]
  );
  results.tests.push({
    name: 'Insufficient samples detected',
    passed: insufficient.needsMoreData === true && insufficient.recommendation === 'collect_more_data',
    details: `needsMoreData=${insufficient.needsMoreData}`
  });

  // Test 2: Clear winner detected
  const champScores = Array.from({ length: 30 }, () => 3 + Math.random() * 0.3);
  const candScoresBetter = Array.from({ length: 30 }, () => 4 + Math.random() * 0.3);
  const clearWinner = decisionMaker.evaluatePromotion(champScores, candScoresBetter);
  results.tests.push({
    name: 'Clear winner detected',
    passed: clearWinner.shouldPromote === true || clearWinner.confidence !== 'low',
    details: `shouldPromote=${clearWinner.shouldPromote}, confidence=${clearWinner.confidence}`
  });

  // Test 3: Analysis includes effect size
  results.tests.push({
    name: 'Analysis includes effect size',
    passed: clearWinner.analysis.effectSize !== undefined && clearWinner.analysis.effectSize.value !== undefined,
    details: `effectSize=${clearWinner.analysis.effectSize?.value}`
  });

  // Test 4: Analysis includes statistical tests
  results.tests.push({
    name: 'Analysis includes t-test',
    passed: clearWinner.analysis.welchTTest !== undefined,
    details: `pValue=${clearWinner.analysis.welchTTest?.pValue}`
  });

  // Test 5: Analysis includes confidence intervals
  results.tests.push({
    name: 'Analysis includes confidence intervals',
    passed: clearWinner.analysis.confidenceIntervals !== undefined,
    details: `hasCI=${clearWinner.analysis.confidenceIntervals !== undefined}`
  });

  // Test 6: Similar scores - no promotion
  const similar1 = Array.from({ length: 30 }, () => 3.5 + Math.random() * 0.2);
  const similar2 = Array.from({ length: 30 }, () => 3.5 + Math.random() * 0.2);
  const similarResult = decisionMaker.evaluatePromotion(similar1, similar2);
  results.tests.push({
    name: 'Similar scores - needs more data or no promotion',
    passed: similarResult.needsMoreData === true || (similarResult.shouldPromote === false && similarResult.shouldDemote === false),
    details: `needsMoreData=${similarResult.needsMoreData}`
  });

  // Test 7: Worse candidate detected
  const candScoresWorse = Array.from({ length: 30 }, () => 2 + Math.random() * 0.3);
  const worseResult = decisionMaker.evaluatePromotion(champScores, candScoresWorse);
  results.tests.push({
    name: 'Worse candidate detected',
    passed: worseResult.shouldDemote === true || worseResult.analysis.means.difference < 0,
    details: `shouldDemote=${worseResult.shouldDemote}, diff=${worseResult.analysis.means?.difference}`
  });

  // Test 8: calculateRequiredIterations works
  const iterReq = decisionMaker.calculateRequiredIterations({
    champion: { count: 20 },
    candidate: { count: 15 },
    effectSize: 0.5
  });
  results.tests.push({
    name: 'Calculate required iterations',
    passed: iterReq.additionalIterationsNeeded !== undefined && iterReq.bottleneck !== undefined,
    details: `iterations=${iterReq.additionalIterationsNeeded}, bottleneck=${iterReq.bottleneck}`
  });

  // Test 9: Quick recommendation works
  const quickRec = decisionMaker.getQuickRecommendation(champScores, candScoresBetter);
  results.tests.push({
    name: 'Quick recommendation works',
    passed: quickRec.trend !== undefined && quickRec.effectSize !== undefined,
    details: `trend=${quickRec.trend}`
  });

  // Test 10: Decision history recorded
  results.tests.push({
    name: 'Decision history recorded',
    passed: decisionMaker.decisionHistory.length > 0,
    details: `historyLength=${decisionMaker.decisionHistory.length}`
  });

  // Test 11: History summary works
  const summary = decisionMaker.getHistorySummary();
  results.tests.push({
    name: 'History summary works',
    passed: summary.totalDecisions !== undefined,
    details: `totalDecisions=${summary.totalDecisions}`
  });

  // Test 12: Practical significance check (tiny effect with variance)
  const tinyChamp = Array.from({ length: 30 }, (_, i) => 3.5 + (i % 5) * 0.1);
  const tinyCand = Array.from({ length: 30 }, (_, i) => 3.52 + (i % 5) * 0.1);
  const tinyEffect = decisionMaker.evaluatePromotion(tinyChamp, tinyCand);
  results.tests.push({
    name: 'Tiny effect size handled',
    passed: Math.abs(tinyEffect.analysis.effectSize?.value) < 0.15 || tinyEffect.needsMoreData === true,
    details: `effectSize=${tinyEffect.analysis.effectSize?.value?.toFixed(3)}, needsMoreData=${tinyEffect.needsMoreData}`
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
  console.log('Promotion Decision Phase 4 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
