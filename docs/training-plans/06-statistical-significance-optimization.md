# Implementation Plan: Statistical Significance Optimization

## Problem Statement

The current training system uses fixed iteration counts and arbitrary thresholds without considering statistical significance. This means:
1. Training may stop before meaningful conclusions are possible
2. Variants may be promoted/demoted based on noise
3. The 70/20/10 distribution may not generate enough candidate samples for reliable comparisons
4. Effect sizes may be too small to detect with available sample sizes

## Current State

```javascript
// Fixed threshold without statistical backing
if (candidateAvg > championAvg * 1.05) {
  // Promote candidate
}

// Fixed iteration count
const MAX_ITERATIONS = 100;

// Fixed distribution
const distribution = { champion: 0.7, candidate: 0.2, active: 0.1 };
// After 100 iterations: ~70 champion, ~20 candidate, ~10 active samples
// Is 20 samples enough to detect a 5% improvement? (Probably not)
```

## Goal

Implement statistically rigorous training that:
1. Calculates required sample sizes for meaningful comparisons
2. Uses proper hypothesis testing for variant promotion
3. Dynamically adjusts training parameters based on observed effect sizes
4. Provides confidence intervals on all metrics

---

## Phase 1: Power Analysis Foundation

### Objective
Implement power analysis to determine required sample sizes.

### Implementation

```javascript
// statisticalUtils.js

/**
 * Calculate required sample size for comparing two means
 * Using two-sample t-test power analysis
 *
 * @param {number} effectSize - Expected difference / pooled std deviation (Cohen's d)
 * @param {number} power - Desired power (typically 0.8)
 * @param {number} alpha - Significance level (typically 0.05)
 * @returns {number} Required sample size per group
 */
function calculateRequiredSampleSize(effectSize, power = 0.8, alpha = 0.05) {
  // Z-scores for alpha and beta
  const zAlpha = normalZScore(1 - alpha / 2);  // Two-tailed
  const zBeta = normalZScore(power);

  // Sample size formula for two-sample t-test
  const n = 2 * Math.pow((zAlpha + zBeta) / effectSize, 2);

  return Math.ceil(n);
}

/**
 * Calculate Cohen's d effect size from two sample groups
 */
function calculateEffectSize(group1, group2) {
  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const pooledStd = Math.sqrt(
    ((group1.length - 1) * variance(group1) + (group2.length - 1) * variance(group2)) /
    (group1.length + group2.length - 2)
  );

  return pooledStd > 0 ? (mean1 - mean2) / pooledStd : 0;
}

/**
 * Standard normal Z-score lookup (approximation)
 */
function normalZScore(p) {
  // Approximation using Abramowitz and Stegun formula
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  if (p > 0.5) {
    return -normalZScore(1 - p);
  }

  const t = Math.sqrt(-2 * Math.log(p));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  return -(t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t));
}

function mean(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1);
}

/**
 * Pre-computed sample size requirements for common scenarios
 */
const SAMPLE_SIZE_TABLE = {
  // effect size -> required n per group (power=0.8, alpha=0.05)
  'large (0.8)': { effectSize: 0.8, requiredN: 26 },
  'medium (0.5)': { effectSize: 0.5, requiredN: 64 },
  'small (0.2)': { effectSize: 0.2, requiredN: 394 },
  'tiny (0.1)': { effectSize: 0.1, requiredN: 1571 }
};

// For a 5% improvement in score (from 3.5 to 3.675):
// If std dev is ~0.5, effect size = 0.175/0.5 = 0.35
// Required n = ~130 per group
```

---

## Phase 2: Hypothesis Testing Implementation

### Objective
Implement proper statistical tests for variant comparison.

### Implementation

```javascript
// hypothesisTesting.js

/**
 * Two-sample t-test (Welch's t-test for unequal variances)
 */
function welchTTest(group1, group2) {
  const n1 = group1.length;
  const n2 = group2.length;

  if (n1 < 2 || n2 < 2) {
    return { significant: false, pValue: 1, message: 'Insufficient samples' };
  }

  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const var1 = variance(group1);
  const var2 = variance(group2);

  // Standard error
  const se = Math.sqrt(var1 / n1 + var2 / n2);

  if (se === 0) {
    return { significant: false, pValue: 1, message: 'Zero variance' };
  }

  // t-statistic
  const t = (mean1 - mean2) / se;

  // Welch-Satterthwaite degrees of freedom
  const df = Math.pow(var1 / n1 + var2 / n2, 2) / (
    Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1)
  );

  // p-value (two-tailed)
  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  return {
    significant: pValue < 0.05,
    pValue,
    tStatistic: t,
    degreesOfFreedom: df,
    meanDifference: mean1 - mean2,
    standardError: se
  };
}

/**
 * Student's t CDF approximation
 */
function tCDF(t, df) {
  // Use normal approximation for large df
  if (df > 30) {
    return normalCDF(t);
  }

  // Betainc approximation for small df
  const x = df / (df + t * t);
  return 1 - 0.5 * betainc(df / 2, 0.5, x);
}

function normalCDF(z) {
  // Standard normal CDF approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate confidence interval for mean
 */
function confidenceInterval(data, confidenceLevel = 0.95) {
  const n = data.length;
  if (n < 2) return { lower: null, upper: null, mean: mean(data) };

  const m = mean(data);
  const s = Math.sqrt(variance(data));
  const se = s / Math.sqrt(n);

  // t critical value (approximation for 95% CI)
  const tCrit = n > 30 ? 1.96 : 2.0 + 3.0 / n;

  return {
    mean: m,
    lower: m - tCrit * se,
    upper: m + tCrit * se,
    standardError: se,
    sampleSize: n
  };
}

/**
 * Mann-Whitney U test (non-parametric alternative)
 * Use when data may not be normally distributed
 */
function mannWhitneyU(group1, group2) {
  const n1 = group1.length;
  const n2 = group2.length;

  if (n1 < 5 || n2 < 5) {
    return { significant: false, message: 'Insufficient samples for non-parametric test' };
  }

  // Combine and rank
  const combined = [
    ...group1.map(v => ({ value: v, group: 1 })),
    ...group2.map(v => ({ value: v, group: 2 }))
  ].sort((a, b) => a.value - b.value);

  // Assign ranks (handling ties)
  let rank = 1;
  for (let i = 0; i < combined.length; i++) {
    let j = i;
    while (j < combined.length - 1 && combined[j + 1].value === combined[i].value) {
      j++;
    }
    const avgRank = (rank + rank + j - i) / 2;
    for (let k = i; k <= j; k++) {
      combined[k].rank = avgRank;
    }
    rank += j - i + 1;
    i = j;
  }

  // Calculate U statistic
  const R1 = combined.filter(c => c.group === 1).reduce((sum, c) => sum + c.rank, 0);
  const U1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - R1;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  // Normal approximation for p-value
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = (U - mu) / sigma;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    significant: pValue < 0.05,
    pValue,
    U,
    zScore: z
  };
}
```

---

## Phase 3: Adaptive Sample Distribution

### Objective
Dynamically adjust variant distribution based on observed performance and required samples.

### Implementation

```javascript
// adaptiveDistribution.js

class AdaptiveDistributor {
  constructor(options = {}) {
    this.minSampleSize = options.minSampleSize || 30;
    this.targetPower = options.targetPower || 0.8;
    this.alpha = options.alpha || 0.05;
    this.maxCandidateRatio = options.maxCandidateRatio || 0.4;
    this.minCandidateRatio = options.minCandidateRatio || 0.1;

    this.variantStats = {};
  }

  initializeVariant(variant) {
    this.variantStats[variant] = {
      scores: [],
      count: 0,
      mean: null,
      variance: null
    };
  }

  recordScore(variant, score) {
    if (!this.variantStats[variant]) {
      this.initializeVariant(variant);
    }

    const stats = this.variantStats[variant];
    stats.scores.push(score);
    stats.count++;
    stats.mean = mean(stats.scores);
    stats.variance = variance(stats.scores);
  }

  calculateOptimalDistribution(contentType) {
    const champion = this.variantStats['champion'];
    const candidate = this.variantStats['candidate'];

    // Default distribution if insufficient data
    if (!champion || !candidate || champion.count < 10 || candidate.count < 5) {
      return { champion: 0.7, candidate: 0.2, active: 0.1 };
    }

    // Calculate current effect size
    const effectSize = calculateEffectSize(champion.scores, candidate.scores);
    const absEffect = Math.abs(effectSize);

    // Calculate required sample size
    const requiredN = calculateRequiredSampleSize(
      absEffect || 0.3,  // Default to medium effect if unclear
      this.targetPower,
      this.alpha
    );

    // How many more samples needed?
    const championNeeded = Math.max(0, requiredN - champion.count);
    const candidateNeeded = Math.max(0, requiredN - candidate.count);

    // If candidate needs more samples, boost its ratio
    let candidateRatio;
    if (candidateNeeded > championNeeded) {
      // Candidate needs more - increase its allocation
      candidateRatio = Math.min(
        this.maxCandidateRatio,
        candidateNeeded / (championNeeded + candidateNeeded + 10)
      );
    } else if (championNeeded > candidateNeeded) {
      // Champion needs more - keep candidate allocation lower
      candidateRatio = Math.max(
        this.minCandidateRatio,
        0.3 - (championNeeded - candidateNeeded) / 100
      );
    } else {
      // Balanced need
      candidateRatio = 0.25;
    }

    // Keep some allocation for active exploration
    const activeRatio = 0.1;
    const championRatio = 1 - candidateRatio - activeRatio;

    return {
      champion: Math.round(championRatio * 100) / 100,
      candidate: Math.round(candidateRatio * 100) / 100,
      active: activeRatio,
      reasoning: {
        effectSize: effectSize.toFixed(3),
        requiredN,
        currentChampionN: champion.count,
        currentCandidateN: candidate.count,
        champNeeded: championNeeded,
        candNeeded: candidateNeeded
      }
    };
  }

  selectVariant(distribution) {
    const rand = Math.random();
    let cumulative = 0;

    for (const [variant, prob] of Object.entries(distribution)) {
      cumulative += prob;
      if (rand <= cumulative) {
        return variant;
      }
    }

    return 'champion';  // Fallback
  }

  getProgressReport() {
    const champion = this.variantStats['champion'];
    const candidate = this.variantStats['candidate'];

    if (!champion || !candidate) {
      return { status: 'initializing', message: 'Collecting initial samples' };
    }

    const effectSize = calculateEffectSize(champion.scores, candidate.scores);
    const requiredN = calculateRequiredSampleSize(Math.abs(effectSize) || 0.3);

    const championProgress = Math.min(100, (champion.count / requiredN) * 100);
    const candidateProgress = Math.min(100, (candidate.count / requiredN) * 100);

    return {
      status: championProgress >= 100 && candidateProgress >= 100 ? 'ready' : 'collecting',
      championSamples: champion.count,
      candidateSamples: candidate.count,
      requiredSamples: requiredN,
      championProgress: `${championProgress.toFixed(1)}%`,
      candidateProgress: `${candidateProgress.toFixed(1)}%`,
      estimatedEffectSize: effectSize.toFixed(3),
      canCompare: champion.count >= 20 && candidate.count >= 20
    };
  }
}

export const adaptiveDistributor = new AdaptiveDistributor();
```

---

## Phase 4: Promotion Decision Framework

### Objective
Make statistically-backed promotion decisions.

### Implementation

```javascript
// promotionDecision.js

class PromotionDecisionMaker {
  constructor(options = {}) {
    this.significanceLevel = options.alpha || 0.05;
    this.minEffectSize = options.minEffectSize || 0.1;  // Minimum meaningful difference
    this.requiredPower = options.power || 0.8;
  }

  evaluatePromotion(championScores, candidateScores) {
    const decision = {
      shouldPromote: false,
      shouldDemote: false,
      needsMoreData: false,
      confidence: 'low',
      analysis: {}
    };

    // Sample size check
    if (championScores.length < 20 || candidateScores.length < 20) {
      decision.needsMoreData = true;
      decision.message = `Insufficient samples: champion=${championScores.length}, candidate=${candidateScores.length}`;
      return decision;
    }

    // Effect size
    const effectSize = calculateEffectSize(candidateScores, championScores);
    decision.analysis.effectSize = effectSize;
    decision.analysis.effectSizeInterpretation = this.interpretEffectSize(effectSize);

    // Is effect size practically meaningful?
    if (Math.abs(effectSize) < this.minEffectSize) {
      decision.message = 'Difference too small to be practically meaningful';
      decision.analysis.practicalSignificance = false;
      return decision;
    }
    decision.analysis.practicalSignificance = true;

    // Statistical tests
    const tTest = welchTTest(candidateScores, championScores);
    const uTest = mannWhitneyU(candidateScores, championScores);
    decision.analysis.tTest = tTest;
    decision.analysis.mannWhitneyU = uTest;

    // Confidence intervals
    const championCI = confidenceInterval(championScores);
    const candidateCI = confidenceInterval(candidateScores);
    decision.analysis.championCI = championCI;
    decision.analysis.candidateCI = candidateCI;

    // Do confidence intervals overlap?
    const ciOverlap = !(candidateCI.lower > championCI.upper || candidateCI.upper < championCI.lower);
    decision.analysis.confidenceIntervalsOverlap = ciOverlap;

    // Decision logic
    const candidateBetter = mean(candidateScores) > mean(championScores);

    if (tTest.significant && !ciOverlap) {
      decision.confidence = 'high';
      if (candidateBetter) {
        decision.shouldPromote = true;
        decision.message = 'Candidate significantly better (p<0.05, non-overlapping CIs)';
      } else {
        decision.shouldDemote = true;
        decision.message = 'Candidate significantly worse (p<0.05, non-overlapping CIs)';
      }
    } else if (tTest.significant && ciOverlap) {
      decision.confidence = 'medium';
      if (candidateBetter && effectSize > 0.3) {
        decision.shouldPromote = true;
        decision.message = 'Candidate likely better (p<0.05, moderate effect size)';
      } else if (!candidateBetter && effectSize < -0.3) {
        decision.shouldDemote = true;
        decision.message = 'Candidate likely worse (p<0.05, moderate effect size)';
      } else {
        decision.needsMoreData = true;
        decision.message = 'Statistically significant but small effect size - collect more data';
      }
    } else {
      decision.confidence = 'low';
      decision.needsMoreData = true;
      decision.message = 'No significant difference detected - collect more data';
    }

    return decision;
  }

  interpretEffectSize(d) {
    const abs = Math.abs(d);
    if (abs < 0.2) return 'negligible';
    if (abs < 0.5) return 'small';
    if (abs < 0.8) return 'medium';
    return 'large';
  }

  calculateRequiredIterations(currentStats) {
    const championN = currentStats.champion?.count || 0;
    const candidateN = currentStats.candidate?.count || 0;

    // Estimate effect size from current data or assume small effect
    const effectSize = currentStats.effectSize || 0.3;
    const requiredN = calculateRequiredSampleSize(effectSize, this.requiredPower);

    const championNeeded = Math.max(0, requiredN - championN);
    const candidateNeeded = Math.max(0, requiredN - candidateN);

    // With current distribution, how many iterations needed?
    const champRate = 0.7;
    const candRate = 0.2;

    const iterationsForChamp = championNeeded / champRate;
    const iterationsForCand = candidateNeeded / candRate;

    return {
      requiredSamplesPerVariant: requiredN,
      additionalIterationsNeeded: Math.ceil(Math.max(iterationsForChamp, iterationsForCand)),
      breakdown: {
        championNeeded,
        candidateNeeded,
        bottleneck: iterationsForCand > iterationsForChamp ? 'candidate' : 'champion'
      }
    };
  }
}

export const promotionDecisionMaker = new PromotionDecisionMaker();
```

---

## Phase 5: Training Loop Integration

### Objective
Integrate statistical rigor into the training loop.

### Implementation

```javascript
// In training.js

import { adaptiveDistributor } from './adaptiveDistribution.js';
import { promotionDecisionMaker } from './promotionDecision.js';

async function runStatisticalTraining(options = {}) {
  const {
    maxIterations = 1000,
    checkInterval = 50,
    earlyStopOnSignificance = true
  } = options;

  const stats = {
    iterations: 0,
    byContentType: {}
  };

  for (const contentType of contentTypes) {
    adaptiveDistributor.initializeVariant('champion');
    adaptiveDistributor.initializeVariant('candidate');
    adaptiveDistributor.initializeVariant('active');
  }

  for (let i = 0; i < maxIterations; i++) {
    for (const contentType of contentTypes) {
      // Get adaptive distribution
      const distribution = adaptiveDistributor.calculateOptimalDistribution(contentType);

      // Select variant
      const variant = adaptiveDistributor.selectVariant(distribution);

      // Generate and score
      const result = await generateAndScore(contentType, variant);

      // Record score
      adaptiveDistributor.recordScore(variant, result.score);
      stats.iterations++;

      // Log distribution changes
      if (i % 20 === 0) {
        console.log(`[${contentType}] Distribution:`, distribution);
      }
    }

    // Periodic significance check
    if (i > 0 && i % checkInterval === 0) {
      console.log(`\n--- Iteration ${i}: Statistical Check ---`);

      for (const contentType of contentTypes) {
        const champScores = adaptiveDistributor.variantStats['champion']?.scores || [];
        const candScores = adaptiveDistributor.variantStats['candidate']?.scores || [];

        const progress = adaptiveDistributor.getProgressReport();
        console.log(`[${contentType}] Progress:`, progress);

        if (progress.canCompare) {
          const decision = promotionDecisionMaker.evaluatePromotion(champScores, candScores);
          console.log(`[${contentType}] Decision:`, decision);

          if (decision.shouldPromote) {
            console.log(`🎉 Promoting candidate to champion for ${contentType}`);
            await promoteCandidate(contentType);
          } else if (decision.shouldDemote) {
            console.log(`❌ Demoting candidate for ${contentType}`);
            await demoteCandidate(contentType);
          }

          // Early stop if significant result and enough data
          if (earlyStopOnSignificance && decision.confidence === 'high') {
            console.log(`Early stopping for ${contentType} - statistically significant result`);
          }
        }
      }

      // Estimate remaining iterations
      const remaining = promotionDecisionMaker.calculateRequiredIterations(
        adaptiveDistributor.variantStats
      );
      console.log(`Estimated additional iterations needed:`, remaining);
    }
  }

  return generateFinalReport(stats);
}

function generateFinalReport(stats) {
  const report = {
    totalIterations: stats.iterations,
    contentTypes: {}
  };

  for (const contentType of contentTypes) {
    const champScores = adaptiveDistributor.variantStats['champion']?.scores || [];
    const candScores = adaptiveDistributor.variantStats['candidate']?.scores || [];

    report.contentTypes[contentType] = {
      championStats: {
        n: champScores.length,
        mean: mean(champScores).toFixed(3),
        ci: confidenceInterval(champScores)
      },
      candidateStats: {
        n: candScores.length,
        mean: mean(candScores).toFixed(3),
        ci: confidenceInterval(candScores)
      },
      comparison: welchTTest(candScores, champScores),
      effectSize: calculateEffectSize(candScores, champScores).toFixed(3),
      finalDecision: promotionDecisionMaker.evaluatePromotion(champScores, candScores)
    };
  }

  return report;
}
```

---

## Phase 6: Sequential Analysis (Early Stopping)

### Objective
Enable early stopping when significance is reached without inflating Type I error.

### Implementation

```javascript
// sequentialAnalysis.js

/**
 * O'Brien-Fleming spending function for sequential analysis
 * Allows early stopping while controlling overall Type I error
 */
class SequentialAnalyzer {
  constructor(options = {}) {
    this.maxLooks = options.maxLooks || 5;  // Number of interim analyses
    this.alpha = options.alpha || 0.05;
    this.boundaries = this.calculateOBFBoundaries();
  }

  calculateOBFBoundaries() {
    // O'Brien-Fleming boundaries (approximation)
    // More stringent early, less stringent later
    const boundaries = [];

    for (let k = 1; k <= this.maxLooks; k++) {
      const t = k / this.maxLooks;  // Information fraction
      // OBF: z_k = z_alpha / sqrt(t)
      const zAlpha = normalZScore(1 - this.alpha / 2);
      boundaries.push({
        look: k,
        informationFraction: t,
        criticalZ: zAlpha / Math.sqrt(t),
        effectiveAlpha: 2 * (1 - normalCDF(zAlpha / Math.sqrt(t)))
      });
    }

    return boundaries;
  }

  shouldStop(currentLook, zStatistic) {
    if (currentLook > this.maxLooks) {
      return { stop: true, reason: 'Maximum looks reached' };
    }

    const boundary = this.boundaries[currentLook - 1];

    if (Math.abs(zStatistic) >= boundary.criticalZ) {
      return {
        stop: true,
        reason: `Z-statistic (${zStatistic.toFixed(3)}) exceeds boundary (${boundary.criticalZ.toFixed(3)})`,
        significant: true
      };
    }

    return {
      stop: false,
      reason: 'Not yet significant',
      currentZ: zStatistic,
      requiredZ: boundary.criticalZ,
      lookProgress: `${currentLook}/${this.maxLooks}`
    };
  }

  getCurrentBoundary(informationFraction) {
    // Find appropriate boundary for current information
    for (const boundary of this.boundaries) {
      if (informationFraction <= boundary.informationFraction) {
        return boundary;
      }
    }
    return this.boundaries[this.boundaries.length - 1];
  }
}

export const sequentialAnalyzer = new SequentialAnalyzer();
```

---

## Success Criteria

1. **Sample Size Accuracy**: Required sample sizes calculated correctly (validated against standard tables)
2. **Type I Error Control**: False positive rate ≤ 0.05 across multiple analyses
3. **Power Achievement**: Detect medium effects (d=0.5) with 80% power
4. **Adaptive Efficiency**: Reduce total iterations by 20%+ vs fixed distribution
5. **Confidence Reporting**: All metrics include confidence intervals

---

## Files to Create/Modify

- `/server/utils/statisticalUtils.js` - Core statistical functions
- `/server/utils/hypothesisTesting.js` - Statistical tests
- `/server/utils/adaptiveDistribution.js` - Dynamic distribution
- `/server/utils/promotionDecision.js` - Decision framework
- `/server/utils/sequentialAnalysis.js` - Early stopping
- `/server/routes/training.js` - Integration

---

## Estimated Complexity

- Phase 1: Medium (power analysis math)
- Phase 2: High (hypothesis testing)
- Phase 3: Medium (adaptive distribution)
- Phase 4: Medium (decision logic)
- Phase 5: Medium (integration)
- Phase 6: High (sequential analysis)
