/**
 * Hypothesis Testing
 *
 * Statistical tests for variant comparison including t-tests, Mann-Whitney U,
 * and confidence interval calculations.
 *
 * Implementation of Plan 06: Statistical Significance Optimization - Phase 2
 */

import {
  mean,
  variance,
  standardDeviation,
  normalCDF,
  normalZScore
} from './statisticalUtils.js';

// ============================================================================
// Phase 2: Hypothesis Testing Implementation
// ============================================================================

/**
 * Incomplete beta function approximation for t-distribution CDF
 *
 * @param {number} a - First parameter
 * @param {number} b - Second parameter
 * @param {number} x - Value
 * @returns {number} Incomplete beta value
 */
function betainc(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use continued fraction approximation
  const bt = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) +
    a * Math.log(x) + b * Math.log(1 - x)
  );

  // Use symmetry for efficiency
  if (x < (a + 1) / (a + b + 2)) {
    return bt * betacf(a, b, x) / a;
  }
  return 1 - bt * betacf(b, a, 1 - x) / b;
}

/**
 * Continued fraction for incomplete beta function
 */
function betacf(a, b, x) {
  const MAXIT = 100;
  const EPS = 1e-10;
  const FPMIN = 1e-30;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < EPS) break;
  }

  return h;
}

/**
 * Log gamma function approximation (Lanczos)
 */
function lgamma(x) {
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];

  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }

  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;

  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }

  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Student's t-distribution CDF
 *
 * @param {number} t - t-statistic
 * @param {number} df - Degrees of freedom
 * @returns {number} Cumulative probability
 */
export function tCDF(t, df) {
  // Use normal approximation for large df
  if (df > 100) {
    return normalCDF(t);
  }

  // For small df, use beta function
  const x = df / (df + t * t);
  const p = 0.5 * betainc(df / 2, 0.5, x);

  return t < 0 ? p : 1 - p;
}

/**
 * Welch's t-test for comparing two groups with potentially unequal variances
 *
 * @param {Array<number>} group1 - First group (treatment/candidate)
 * @param {Array<number>} group2 - Second group (control/champion)
 * @returns {Object} Test results
 */
export function welchTTest(group1, group2) {
  const n1 = group1?.length || 0;
  const n2 = group2?.length || 0;

  if (n1 < 2 || n2 < 2) {
    return {
      significant: false,
      pValue: 1,
      tStatistic: null,
      degreesOfFreedom: null,
      meanDifference: null,
      standardError: null,
      message: 'Insufficient samples (need at least 2 per group)'
    };
  }

  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const var1 = variance(group1);
  const var2 = variance(group2);

  // Standard error of difference
  const se = Math.sqrt(var1 / n1 + var2 / n2);

  if (se === 0) {
    return {
      significant: false,
      pValue: 1,
      tStatistic: null,
      degreesOfFreedom: null,
      meanDifference: mean1 - mean2,
      standardError: 0,
      message: 'Zero variance in one or both groups'
    };
  }

  // t-statistic
  const t = (mean1 - mean2) / se;

  // Welch-Satterthwaite degrees of freedom
  const v1 = var1 / n1;
  const v2 = var2 / n2;
  const df = Math.pow(v1 + v2, 2) / (
    Math.pow(v1, 2) / (n1 - 1) + Math.pow(v2, 2) / (n2 - 1)
  );

  // p-value (two-tailed)
  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  return {
    significant: pValue < 0.05,
    pValue: parseFloat(pValue.toFixed(6)),
    tStatistic: parseFloat(t.toFixed(4)),
    degreesOfFreedom: parseFloat(df.toFixed(2)),
    meanDifference: parseFloat((mean1 - mean2).toFixed(4)),
    standardError: parseFloat(se.toFixed(4)),
    group1Mean: parseFloat(mean1.toFixed(4)),
    group2Mean: parseFloat(mean2.toFixed(4)),
    group1N: n1,
    group2N: n2
  };
}

/**
 * Two-sample t-test assuming equal variances
 *
 * @param {Array<number>} group1 - First group
 * @param {Array<number>} group2 - Second group
 * @returns {Object} Test results
 */
export function studentTTest(group1, group2) {
  const n1 = group1?.length || 0;
  const n2 = group2?.length || 0;

  if (n1 < 2 || n2 < 2) {
    return {
      significant: false,
      pValue: 1,
      message: 'Insufficient samples'
    };
  }

  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const var1 = variance(group1);
  const var2 = variance(group2);

  // Pooled variance
  const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const se = Math.sqrt(pooledVar * (1 / n1 + 1 / n2));

  if (se === 0) {
    return { significant: false, pValue: 1, message: 'Zero variance' };
  }

  const t = (mean1 - mean2) / se;
  const df = n1 + n2 - 2;
  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  return {
    significant: pValue < 0.05,
    pValue: parseFloat(pValue.toFixed(6)),
    tStatistic: parseFloat(t.toFixed(4)),
    degreesOfFreedom: df,
    meanDifference: parseFloat((mean1 - mean2).toFixed(4)),
    standardError: parseFloat(se.toFixed(4))
  };
}

/**
 * Mann-Whitney U test (non-parametric alternative to t-test)
 * Use when data may not be normally distributed
 *
 * @param {Array<number>} group1 - First group
 * @param {Array<number>} group2 - Second group
 * @returns {Object} Test results
 */
export function mannWhitneyU(group1, group2) {
  const n1 = group1?.length || 0;
  const n2 = group2?.length || 0;

  if (n1 < 5 || n2 < 5) {
    return {
      significant: false,
      pValue: 1,
      message: 'Insufficient samples for non-parametric test (need at least 5 per group)'
    };
  }

  // Combine and rank
  const combined = [
    ...group1.map(v => ({ value: v, group: 1 })),
    ...group2.map(v => ({ value: v, group: 2 }))
  ].sort((a, b) => a.value - b.value);

  // Assign ranks (handling ties by averaging)
  let rank = 1;
  for (let i = 0; i < combined.length; i++) {
    let j = i;
    // Find all ties
    while (j < combined.length - 1 && combined[j + 1].value === combined[i].value) {
      j++;
    }
    // Average rank for ties
    const avgRank = (rank + rank + j - i) / 2;
    for (let k = i; k <= j; k++) {
      combined[k].rank = avgRank;
    }
    rank += j - i + 1;
    i = j;
  }

  // Calculate U statistics
  const R1 = combined.filter(c => c.group === 1).reduce((sum, c) => sum + c.rank, 0);
  const U1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - R1;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  // Normal approximation for p-value
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);

  // Tie correction (simplified)
  const z = sigma > 0 ? (U - mu) / sigma : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    significant: pValue < 0.05,
    pValue: parseFloat(pValue.toFixed(6)),
    U,
    U1,
    U2,
    zScore: parseFloat(z.toFixed(4)),
    group1N: n1,
    group2N: n2
  };
}

/**
 * Calculate confidence interval for a mean
 *
 * @param {Array<number>} data - Sample data
 * @param {number} confidenceLevel - Confidence level (default 0.95)
 * @returns {Object} Confidence interval
 */
export function confidenceInterval(data, confidenceLevel = 0.95) {
  const n = data?.length || 0;

  if (n < 2) {
    return {
      mean: n > 0 ? data[0] : null,
      lower: null,
      upper: null,
      standardError: null,
      sampleSize: n,
      confidenceLevel
    };
  }

  const m = mean(data);
  const s = standardDeviation(data);
  const se = s / Math.sqrt(n);

  // t critical value for confidence level
  // For 95% CI with n-1 degrees of freedom
  const alpha = 1 - confidenceLevel;
  const tCrit = getTCriticalValue(n - 1, alpha / 2);

  const margin = tCrit * se;

  return {
    mean: parseFloat(m.toFixed(4)),
    lower: parseFloat((m - margin).toFixed(4)),
    upper: parseFloat((m + margin).toFixed(4)),
    standardError: parseFloat(se.toFixed(4)),
    marginOfError: parseFloat(margin.toFixed(4)),
    sampleSize: n,
    confidenceLevel
  };
}

/**
 * Get t critical value for given degrees of freedom and alpha
 * Uses approximation
 *
 * @param {number} df - Degrees of freedom
 * @param {number} alpha - Tail probability
 * @returns {number} Critical t value
 */
function getTCriticalValue(df, alpha) {
  // For large df, use normal approximation
  if (df > 120) {
    return normalZScore(1 - alpha);
  }

  // Common values lookup for efficiency
  const table = {
    // df: t for alpha=0.025 (two-tailed 95%)
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571,
    6: 2.447,
    7: 2.365,
    8: 2.306,
    9: 2.262,
    10: 2.228,
    15: 2.131,
    20: 2.086,
    25: 2.060,
    30: 2.042,
    40: 2.021,
    50: 2.009,
    60: 2.000,
    80: 1.990,
    100: 1.984,
    120: 1.980
  };

  // If alpha is ~0.025, use lookup
  if (Math.abs(alpha - 0.025) < 0.001) {
    // Find closest df in table
    const dfs = Object.keys(table).map(Number).sort((a, b) => a - b);
    for (const d of dfs) {
      if (df <= d) return table[d];
    }
    return 1.96;
  }

  // Otherwise use approximation: t ≈ z + (z^3 + z) / (4 * df)
  const z = normalZScore(1 - alpha);
  return z + (z * z * z + z) / (4 * df);
}

/**
 * Calculate confidence interval for difference between two means
 *
 * @param {Array<number>} group1 - First group
 * @param {Array<number>} group2 - Second group
 * @param {number} confidenceLevel - Confidence level
 * @returns {Object} Confidence interval for difference
 */
export function differenceConfidenceInterval(group1, group2, confidenceLevel = 0.95) {
  const n1 = group1?.length || 0;
  const n2 = group2?.length || 0;

  if (n1 < 2 || n2 < 2) {
    return {
      meanDifference: null,
      lower: null,
      upper: null,
      message: 'Insufficient samples'
    };
  }

  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const var1 = variance(group1);
  const var2 = variance(group2);

  const diff = mean1 - mean2;
  const se = Math.sqrt(var1 / n1 + var2 / n2);

  // Welch-Satterthwaite df
  const v1 = var1 / n1;
  const v2 = var2 / n2;
  const df = Math.pow(v1 + v2, 2) / (
    Math.pow(v1, 2) / (n1 - 1) + Math.pow(v2, 2) / (n2 - 1)
  );

  const alpha = 1 - confidenceLevel;
  const tCrit = getTCriticalValue(df, alpha / 2);
  const margin = tCrit * se;

  return {
    meanDifference: parseFloat(diff.toFixed(4)),
    lower: parseFloat((diff - margin).toFixed(4)),
    upper: parseFloat((diff + margin).toFixed(4)),
    standardError: parseFloat(se.toFixed(4)),
    degreesOfFreedom: parseFloat(df.toFixed(2)),
    confidenceLevel,
    // Interpretation helpers
    significantlyDifferent: diff - margin > 0 || diff + margin < 0,
    group1Better: diff > 0,
    group2Better: diff < 0
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 2 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase2() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: tCDF(0, df) should be 0.5
  results.tests.push({
    name: 'tCDF(0, df) = 0.5',
    passed: Math.abs(tCDF(0, 10) - 0.5) < 0.001,
    details: `tCDF(0, 10)=${tCDF(0, 10).toFixed(4)}`
  });

  // Test 2: tCDF converges to normalCDF for large df
  const t196 = tCDF(1.96, 1000);
  results.tests.push({
    name: 'tCDF converges to normalCDF for large df',
    passed: Math.abs(t196 - normalCDF(1.96)) < 0.01,
    details: `tCDF(1.96, 1000)=${t196.toFixed(4)}`
  });

  // Test 3: Welch t-test with clearly different groups
  const high = [8, 9, 10, 11, 12, 8, 9, 10, 11, 12];
  const low = [2, 3, 4, 5, 6, 2, 3, 4, 5, 6];
  const tTestResult = welchTTest(high, low);
  results.tests.push({
    name: 'Welch t-test detects significant difference',
    passed: tTestResult.significant === true && tTestResult.pValue < 0.001,
    details: `p=${tTestResult.pValue}, t=${tTestResult.tStatistic}`
  });

  // Test 4: Welch t-test with similar groups
  const similar1 = [5, 5.1, 4.9, 5.2, 4.8, 5, 5.1, 4.9];
  const similar2 = [5, 4.9, 5.1, 5, 5.2, 4.8, 5, 5.1];
  const tTestSimilar = welchTTest(similar1, similar2);
  results.tests.push({
    name: 'Welch t-test non-significant for similar groups',
    passed: tTestSimilar.significant === false,
    details: `p=${tTestSimilar.pValue}`
  });

  // Test 5: Mann-Whitney U test
  const uTestResult = mannWhitneyU(high, low);
  results.tests.push({
    name: 'Mann-Whitney U detects difference',
    passed: uTestResult.significant === true,
    details: `p=${uTestResult.pValue}, U=${uTestResult.U}`
  });

  // Test 6: Confidence interval contains mean
  const data = [10, 12, 14, 16, 18, 20];
  const ci = confidenceInterval(data);
  const dataMean = mean(data);
  results.tests.push({
    name: 'CI contains sample mean',
    passed: ci.lower <= dataMean && ci.upper >= dataMean,
    details: `mean=${dataMean}, CI=[${ci.lower}, ${ci.upper}]`
  });

  // Test 7: CI width decreases with sample size
  const smallSample = [10, 12, 14];
  const largeSample = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const ciSmall = confidenceInterval(smallSample);
  const ciLarge = confidenceInterval(largeSample);
  const widthSmall = ciSmall.upper - ciSmall.lower;
  const widthLarge = ciLarge.upper - ciLarge.lower;
  results.tests.push({
    name: 'CI narrows with larger sample',
    passed: widthLarge < widthSmall,
    details: `small=${widthSmall.toFixed(2)}, large=${widthLarge.toFixed(2)}`
  });

  // Test 8: Difference CI
  const diffCI = differenceConfidenceInterval(high, low);
  results.tests.push({
    name: 'Difference CI shows significant difference',
    passed: diffCI.significantlyDifferent === true && diffCI.lower > 0,
    details: `diff=${diffCI.meanDifference}, CI=[${diffCI.lower}, ${diffCI.upper}]`
  });

  // Test 9: Insufficient samples handling
  const tTestInsufficient = welchTTest([1], [2]);
  results.tests.push({
    name: 'Handles insufficient samples gracefully',
    passed: tTestInsufficient.significant === false && tTestInsufficient.pValue === 1,
    details: `message=${tTestInsufficient.message}`
  });

  // Test 10: studentTTest works
  const studentResult = studentTTest(high, low);
  results.tests.push({
    name: 'Student t-test works',
    passed: studentResult.significant === true,
    details: `p=${studentResult.pValue}`
  });

  // Test 11: U-test handles insufficient samples
  const uInsufficient = mannWhitneyU([1, 2], [3, 4]);
  results.tests.push({
    name: 'U-test handles insufficient samples',
    passed: uInsufficient.significant === false,
    details: `message=${uInsufficient.message}`
  });

  // Test 12: CI with high confidence is wider
  const ci95 = confidenceInterval(data, 0.95);
  const ci99 = confidenceInterval(data, 0.99);
  results.tests.push({
    name: '99% CI is wider than 95% CI',
    passed: (ci99.upper - ci99.lower) > (ci95.upper - ci95.lower),
    details: `95%=${ci95.upper - ci95.lower}, 99%=${ci99.upper - ci99.lower}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase2();
  console.log('Hypothesis Testing Phase 2 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
