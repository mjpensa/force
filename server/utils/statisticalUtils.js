/**
 * Statistical Utilities
 *
 * Core statistical functions for power analysis, effect size calculation,
 * and sample size determination.
 *
 * Implementation of Plan 06: Statistical Significance Optimization - Phase 1
 */

// ============================================================================
// Phase 1: Power Analysis Foundation
// ============================================================================

/**
 * Calculate the mean of an array
 *
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Mean value
 */
export function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate the sample variance (unbiased)
 *
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Sample variance
 */
export function variance(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1);
}

/**
 * Calculate the standard deviation
 *
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Standard deviation
 */
export function standardDeviation(arr) {
  return Math.sqrt(variance(arr));
}

/**
 * Calculate the standard error of the mean
 *
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Standard error
 */
export function standardError(arr) {
  if (!arr || arr.length < 2) return 0;
  return standardDeviation(arr) / Math.sqrt(arr.length);
}

/**
 * Calculate pooled standard deviation for two groups
 *
 * @param {Array<number>} group1 - First group
 * @param {Array<number>} group2 - Second group
 * @returns {number} Pooled standard deviation
 */
export function pooledStandardDeviation(group1, group2) {
  const n1 = group1.length;
  const n2 = group2.length;

  if (n1 < 2 || n2 < 2) return 0;

  const var1 = variance(group1);
  const var2 = variance(group2);

  const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  return Math.sqrt(pooledVar);
}

/**
 * Standard normal Z-score lookup (inverse CDF)
 * Uses Abramowitz and Stegun approximation
 *
 * @param {number} p - Probability (0 to 1)
 * @returns {number} Z-score
 */
export function normalZScore(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  // Handle p > 0.5 by symmetry
  if (p > 0.5) {
    return -normalZScore(1 - p);
  }

  // Abramowitz and Stegun approximation 26.2.23
  const t = Math.sqrt(-2 * Math.log(p));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  return -(t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t));
}

/**
 * Standard normal CDF
 *
 * @param {number} z - Z-score
 * @returns {number} Cumulative probability
 */
export function normalCDF(z) {
  // Approximation using error function
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
 * Calculate Cohen's d effect size from two sample groups
 *
 * @param {Array<number>} group1 - First group (treatment/candidate)
 * @param {Array<number>} group2 - Second group (control/champion)
 * @returns {number} Cohen's d effect size
 */
export function calculateEffectSize(group1, group2) {
  if (!group1 || !group2 || group1.length < 2 || group2.length < 2) {
    return 0;
  }

  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const pooledStd = pooledStandardDeviation(group1, group2);

  if (pooledStd === 0) return 0;

  return (mean1 - mean2) / pooledStd;
}

/**
 * Interpret Cohen's d effect size
 *
 * @param {number} d - Cohen's d value
 * @returns {string} Interpretation
 */
export function interpretEffectSize(d) {
  const abs = Math.abs(d);
  if (abs < 0.2) return 'negligible';
  if (abs < 0.5) return 'small';
  if (abs < 0.8) return 'medium';
  return 'large';
}

/**
 * Calculate required sample size for comparing two means
 * Using two-sample t-test power analysis formula
 *
 * @param {number} effectSize - Expected Cohen's d effect size
 * @param {number} power - Desired statistical power (default 0.8)
 * @param {number} alpha - Significance level (default 0.05)
 * @returns {number} Required sample size per group
 */
export function calculateRequiredSampleSize(effectSize, power = 0.8, alpha = 0.05) {
  // Handle edge cases
  if (!effectSize || effectSize === 0) {
    return Infinity;
  }

  // Z-scores for alpha (two-tailed) and power
  const zAlpha = normalZScore(1 - alpha / 2);
  const zBeta = normalZScore(power);

  // Sample size formula: n = 2 * ((z_alpha + z_beta) / d)^2
  const n = 2 * Math.pow((zAlpha + zBeta) / Math.abs(effectSize), 2);

  return Math.ceil(n);
}

/**
 * Calculate statistical power given sample size
 *
 * @param {number} n - Sample size per group
 * @param {number} effectSize - Cohen's d effect size
 * @param {number} alpha - Significance level
 * @returns {number} Statistical power (0-1)
 */
export function calculatePower(n, effectSize, alpha = 0.05) {
  if (n < 2 || !effectSize) return 0;

  const zAlpha = normalZScore(1 - alpha / 2);
  const se = Math.sqrt(2 / n);
  const ncp = Math.abs(effectSize) / se;  // Non-centrality parameter

  // Power = P(reject H0 | H1 true) = P(Z > z_alpha - ncp) + P(Z < -z_alpha - ncp)
  const power = 1 - normalCDF(zAlpha - ncp) + normalCDF(-zAlpha - ncp);

  return Math.min(1, Math.max(0, power));
}

/**
 * Pre-computed sample size requirements for common effect sizes
 */
export const SAMPLE_SIZE_TABLE = {
  'large': { effectSize: 0.8, requiredN: 26, description: 'd=0.8 (large effect)' },
  'medium': { effectSize: 0.5, requiredN: 64, description: 'd=0.5 (medium effect)' },
  'small': { effectSize: 0.2, requiredN: 394, description: 'd=0.2 (small effect)' },
  'tiny': { effectSize: 0.1, requiredN: 1571, description: 'd=0.1 (tiny effect)' }
};

/**
 * Get recommended sample size based on expected improvement
 *
 * @param {number} expectedImprovement - Expected improvement as percentage (e.g., 0.05 for 5%)
 * @param {number} baselineStd - Baseline standard deviation
 * @param {number} baselineMean - Baseline mean (optional, for context)
 * @returns {Object} Sample size recommendation
 */
export function getRecommendedSampleSize(expectedImprovement, baselineStd, baselineMean = null) {
  // Calculate effect size from expected improvement
  // d = (improvement * baselineMean) / std  (if percentage)
  // or d = improvement / std (if absolute)
  const absoluteImprovement = baselineMean
    ? expectedImprovement * baselineMean
    : expectedImprovement;

  const effectSize = baselineStd > 0 ? absoluteImprovement / baselineStd : 0.3;
  const requiredN = calculateRequiredSampleSize(effectSize);
  const power80N = calculateRequiredSampleSize(effectSize, 0.8);
  const power90N = calculateRequiredSampleSize(effectSize, 0.9);

  return {
    effectSize: parseFloat(effectSize.toFixed(3)),
    effectSizeInterpretation: interpretEffectSize(effectSize),
    requiredSampleSize: {
      power80: power80N,
      power90: power90N
    },
    recommendation: effectSize < 0.2
      ? 'Effect size is very small. Consider whether the improvement is practically meaningful.'
      : effectSize < 0.5
        ? `Medium sample size needed (n≈${power80N} per group). This is achievable.`
        : `Small sample size needed (n≈${power80N} per group). Detection should be straightforward.`
  };
}

/**
 * Calculate minimum detectable effect size given sample size
 *
 * @param {number} n - Sample size per group
 * @param {number} power - Desired power
 * @param {number} alpha - Significance level
 * @returns {number} Minimum detectable effect size
 */
export function minimumDetectableEffect(n, power = 0.8, alpha = 0.05) {
  if (n < 2) return Infinity;

  const zAlpha = normalZScore(1 - alpha / 2);
  const zBeta = normalZScore(power);

  // Rearranged: d = (z_alpha + z_beta) * sqrt(2/n)
  return (zAlpha + zBeta) * Math.sqrt(2 / n);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 1 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase1() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: Mean calculation
  const testData = [1, 2, 3, 4, 5];
  results.tests.push({
    name: 'Mean calculation',
    passed: mean(testData) === 3,
    details: `mean=${mean(testData)}`
  });

  // Test 2: Variance calculation
  const expectedVar = 2.5;  // Sample variance of [1,2,3,4,5]
  results.tests.push({
    name: 'Variance calculation',
    passed: Math.abs(variance(testData) - expectedVar) < 0.001,
    details: `variance=${variance(testData)}`
  });

  // Test 3: Standard deviation
  results.tests.push({
    name: 'Standard deviation calculation',
    passed: Math.abs(standardDeviation(testData) - Math.sqrt(expectedVar)) < 0.001,
    details: `std=${standardDeviation(testData).toFixed(4)}`
  });

  // Test 4: Z-score for p=0.975 should be ~1.96
  const z975 = normalZScore(0.975);
  results.tests.push({
    name: 'Z-score for p=0.975',
    passed: Math.abs(z975 - 1.96) < 0.01,
    details: `z=${z975.toFixed(4)}`
  });

  // Test 5: Z-score for p=0.5 should be 0
  const z50 = normalZScore(0.5);
  results.tests.push({
    name: 'Z-score for p=0.5',
    passed: Math.abs(z50) < 0.01,
    details: `z=${z50.toFixed(4)}`
  });

  // Test 6: normalCDF(0) should be 0.5
  results.tests.push({
    name: 'normalCDF(0) = 0.5',
    passed: Math.abs(normalCDF(0) - 0.5) < 0.001,
    details: `cdf=${normalCDF(0).toFixed(4)}`
  });

  // Test 7: normalCDF(1.96) should be ~0.975
  results.tests.push({
    name: 'normalCDF(1.96) ≈ 0.975',
    passed: Math.abs(normalCDF(1.96) - 0.975) < 0.01,
    details: `cdf=${normalCDF(1.96).toFixed(4)}`
  });

  // Test 8: Effect size calculation
  const group1 = [5, 6, 7, 8, 9];
  const group2 = [1, 2, 3, 4, 5];
  const d = calculateEffectSize(group1, group2);
  results.tests.push({
    name: 'Effect size calculation (large effect)',
    passed: d > 2.0,  // Should be around 2.53
    details: `d=${d.toFixed(3)}`
  });

  // Test 9: Sample size for medium effect (d=0.5)
  const n50 = calculateRequiredSampleSize(0.5, 0.8, 0.05);
  results.tests.push({
    name: 'Sample size for d=0.5 (should be ~64)',
    passed: Math.abs(n50 - 64) < 5,
    details: `n=${n50}`
  });

  // Test 10: Sample size for large effect (d=0.8)
  const n80 = calculateRequiredSampleSize(0.8, 0.8, 0.05);
  results.tests.push({
    name: 'Sample size for d=0.8 (should be ~26)',
    passed: Math.abs(n80 - 26) < 5,
    details: `n=${n80}`
  });

  // Test 11: Power calculation
  const power = calculatePower(64, 0.5, 0.05);
  results.tests.push({
    name: 'Power calculation (n=64, d=0.5)',
    passed: power > 0.75 && power < 0.85,
    details: `power=${power.toFixed(3)}`
  });

  // Test 12: Minimum detectable effect
  const mde = minimumDetectableEffect(100, 0.8, 0.05);
  results.tests.push({
    name: 'Minimum detectable effect (n=100)',
    passed: mde > 0.35 && mde < 0.45,
    details: `mde=${mde.toFixed(3)}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase1();
  console.log('Statistical Utils Phase 1 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
