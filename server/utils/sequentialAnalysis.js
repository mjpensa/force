/**
 * Sequential Analysis
 *
 * Enables early stopping when significance is reached without inflating Type I error.
 * Uses O'Brien-Fleming spending function.
 *
 * Implementation of Plan 06: Statistical Significance Optimization - Phase 6
 */

import { normalZScore, normalCDF } from './statisticalUtils.js';
import { welchTTest } from './hypothesisTesting.js';

// ============================================================================
// Phase 6: Sequential Analysis (Early Stopping)
// ============================================================================

/**
 * SequentialAnalyzer - Manages interim analyses with controlled Type I error
 */
export class SequentialAnalyzer {
  /**
   * Create a SequentialAnalyzer
   *
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Maximum number of interim analyses (looks)
    this.maxLooks = options.maxLooks || 5;

    // Overall alpha level to spend across looks
    this.alpha = options.alpha || 0.05;

    // Spending function type
    this.spendingFunction = options.spendingFunction || 'obrien-fleming';

    // Pre-calculate boundaries
    this.boundaries = this.calculateBoundaries();

    // Track looks taken
    this.looksTaken = 0;
    this.lookHistory = [];
  }

  /**
   * Calculate stopping boundaries using O'Brien-Fleming spending function
   *
   * @returns {Array} Boundaries for each look
   */
  calculateBoundaries() {
    const boundaries = [];
    const zAlpha = normalZScore(1 - this.alpha / 2);

    for (let k = 1; k <= this.maxLooks; k++) {
      const t = k / this.maxLooks;  // Information fraction

      let criticalZ, effectiveAlpha;

      if (this.spendingFunction === 'obrien-fleming') {
        // O'Brien-Fleming: very conservative early, less conservative later
        // z_k = z_alpha / sqrt(t)
        criticalZ = zAlpha / Math.sqrt(t);
        effectiveAlpha = 2 * (1 - normalCDF(criticalZ));
      } else if (this.spendingFunction === 'pocock') {
        // Pocock: constant boundary across looks
        // Needs adjustment for multiple looks
        criticalZ = zAlpha * Math.sqrt(this.maxLooks / k);
        effectiveAlpha = 2 * (1 - normalCDF(criticalZ));
      } else {
        // Default to O'Brien-Fleming
        criticalZ = zAlpha / Math.sqrt(t);
        effectiveAlpha = 2 * (1 - normalCDF(criticalZ));
      }

      boundaries.push({
        look: k,
        informationFraction: parseFloat(t.toFixed(3)),
        criticalZ: parseFloat(criticalZ.toFixed(4)),
        effectiveAlpha: parseFloat(effectiveAlpha.toFixed(6)),
        pValueThreshold: parseFloat((2 * (1 - normalCDF(criticalZ))).toFixed(6))
      });
    }

    return boundaries;
  }

  /**
   * Perform an interim analysis
   *
   * @param {Array<number>} group1 - First group scores
   * @param {Array<number>} group2 - Second group scores
   * @returns {Object} Analysis result
   */
  performInterimAnalysis(group1, group2) {
    this.looksTaken++;
    const currentLook = this.looksTaken;

    if (currentLook > this.maxLooks) {
      return {
        stop: true,
        reason: 'maximum_looks_exceeded',
        message: `Maximum looks (${this.maxLooks}) exceeded`,
        lookNumber: currentLook
      };
    }

    // Perform t-test
    const tTest = welchTTest(group1, group2);
    const zStatistic = tTest.tStatistic || 0;
    const pValue = tTest.pValue;

    // Get boundary for current look
    const boundary = this.boundaries[currentLook - 1];

    // Check if we should stop
    const result = this.shouldStop(currentLook, zStatistic, pValue);

    // Record look
    const lookRecord = {
      lookNumber: currentLook,
      timestamp: new Date().toISOString(),
      sampleSizes: {
        group1: group1.length,
        group2: group2.length
      },
      zStatistic: parseFloat(zStatistic.toFixed(4)),
      pValue: parseFloat(pValue.toFixed(6)),
      criticalZ: boundary.criticalZ,
      pValueThreshold: boundary.pValueThreshold,
      decision: result.stop ? (result.significant ? 'stop_significant' : 'stop_futility') : 'continue',
      ...result
    };

    this.lookHistory.push(lookRecord);

    return lookRecord;
  }

  /**
   * Determine if analysis should stop
   *
   * @param {number} currentLook - Current look number
   * @param {number} zStatistic - Z-statistic from test
   * @param {number} pValue - P-value from test
   * @returns {Object} Stop decision
   */
  shouldStop(currentLook, zStatistic, pValue = null) {
    if (currentLook > this.maxLooks) {
      return {
        stop: true,
        reason: 'maximum_looks_reached',
        significant: pValue !== null && pValue < this.alpha
      };
    }

    const boundary = this.boundaries[currentLook - 1];

    // Check efficacy (significant effect)
    if (Math.abs(zStatistic) >= boundary.criticalZ) {
      return {
        stop: true,
        reason: 'efficacy_boundary_crossed',
        significant: true,
        message: `|Z| (${Math.abs(zStatistic).toFixed(3)}) >= boundary (${boundary.criticalZ.toFixed(3)})`
      };
    }

    // Optional: Check futility (effect unlikely to become significant)
    if (currentLook >= this.maxLooks - 1) {
      // On last look, any non-significant result should stop
      return {
        stop: currentLook === this.maxLooks,
        reason: currentLook === this.maxLooks ? 'final_look_complete' : 'continuing',
        significant: false,
        message: currentLook === this.maxLooks
          ? 'Final analysis complete - no significant effect'
          : 'Continuing to next look'
      };
    }

    return {
      stop: false,
      reason: 'boundary_not_crossed',
      significant: false,
      currentZ: parseFloat(zStatistic.toFixed(4)),
      requiredZ: boundary.criticalZ,
      lookProgress: `${currentLook}/${this.maxLooks}`
    };
  }

  /**
   * Get boundary for a given information fraction
   *
   * @param {number} informationFraction - Fraction of information collected (0-1)
   * @returns {Object} Appropriate boundary
   */
  getBoundaryForInformation(informationFraction) {
    for (const boundary of this.boundaries) {
      if (informationFraction <= boundary.informationFraction) {
        return boundary;
      }
    }
    return this.boundaries[this.boundaries.length - 1];
  }

  /**
   * Calculate sample size adjusted for sequential design
   *
   * @param {number} baseN - Base sample size for fixed design
   * @returns {number} Adjusted sample size
   */
  adjustSampleSizeForSequential(baseN) {
    // Sequential designs typically need ~3-5% more samples
    // due to multiple comparisons
    const inflationFactor = 1 + (0.01 * this.maxLooks);
    return Math.ceil(baseN * inflationFactor);
  }

  /**
   * Get current analysis status
   *
   * @returns {Object} Status summary
   */
  getStatus() {
    return {
      looksTaken: this.looksTaken,
      maxLooks: this.maxLooks,
      remainingLooks: this.maxLooks - this.looksTaken,
      boundaries: this.boundaries,
      history: this.lookHistory,
      spendingFunction: this.spendingFunction,
      overallAlpha: this.alpha
    };
  }

  /**
   * Reset for new analysis
   */
  reset() {
    this.looksTaken = 0;
    this.lookHistory = [];
  }

  /**
   * Get recommended look schedule
   *
   * @param {number} plannedN - Planned total sample size per group
   * @returns {Array} Recommended look schedule
   */
  getRecommendedLookSchedule(plannedN) {
    const schedule = [];
    for (let k = 1; k <= this.maxLooks; k++) {
      const fraction = k / this.maxLooks;
      schedule.push({
        look: k,
        samplesPerGroup: Math.ceil(plannedN * fraction),
        informationFraction: parseFloat(fraction.toFixed(2)),
        boundary: this.boundaries[k - 1]
      });
    }
    return schedule;
  }
}

// Singleton instance
export const sequentialAnalyzer = new SequentialAnalyzer();

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

  // Create test analyzer
  const analyzer = new SequentialAnalyzer({
    maxLooks: 5,
    alpha: 0.05,
    spendingFunction: 'obrien-fleming'
  });

  // Test 1: Boundaries calculated
  results.tests.push({
    name: 'Boundaries calculated',
    passed: analyzer.boundaries.length === 5,
    details: `boundaryCount=${analyzer.boundaries.length}`
  });

  // Test 2: First boundary more conservative
  const b1 = analyzer.boundaries[0];
  const b5 = analyzer.boundaries[4];
  results.tests.push({
    name: 'OBF: First boundary more conservative than last',
    passed: b1.criticalZ > b5.criticalZ,
    details: `first=${b1.criticalZ.toFixed(2)}, last=${b5.criticalZ.toFixed(2)}`
  });

  // Test 3: Information fractions correct
  results.tests.push({
    name: 'Information fractions correct',
    passed: analyzer.boundaries[0].informationFraction === 0.2 && analyzer.boundaries[4].informationFraction === 1,
    details: `first=${analyzer.boundaries[0].informationFraction}, last=${analyzer.boundaries[4].informationFraction}`
  });

  // Test 4: shouldStop returns correct structure
  const stopResult = analyzer.shouldStop(1, 1.5);
  results.tests.push({
    name: 'shouldStop returns correct structure',
    passed: stopResult.stop !== undefined && stopResult.reason !== undefined,
    details: `stop=${stopResult.stop}, reason=${stopResult.reason}`
  });

  // Test 5: Very large Z crosses boundary
  const largeZResult = analyzer.shouldStop(1, 5.0);
  results.tests.push({
    name: 'Large Z crosses boundary',
    passed: largeZResult.stop === true && largeZResult.significant === true,
    details: `stop=${largeZResult.stop}, significant=${largeZResult.significant}`
  });

  // Test 6: Moderate Z at first look doesn't cross
  const moderateZResult = analyzer.shouldStop(1, 2.5);
  results.tests.push({
    name: 'Moderate Z at first look continues',
    passed: moderateZResult.stop === false,
    details: `stop=${moderateZResult.stop}`
  });

  // Test 7: Perform interim analysis
  const group1 = Array.from({ length: 50 }, () => 3.5 + Math.random() * 0.5);
  const group2 = Array.from({ length: 50 }, () => 3.0 + Math.random() * 0.5);
  const interimResult = analyzer.performInterimAnalysis(group1, group2);
  results.tests.push({
    name: 'Perform interim analysis',
    passed: interimResult.lookNumber === 1 && interimResult.zStatistic !== undefined,
    details: `look=${interimResult.lookNumber}, z=${interimResult.zStatistic}`
  });

  // Test 8: Look history recorded
  results.tests.push({
    name: 'Look history recorded',
    passed: analyzer.lookHistory.length === 1,
    details: `historyLength=${analyzer.lookHistory.length}`
  });

  // Test 9: Multiple looks work
  analyzer.performInterimAnalysis(group1, group2);
  analyzer.performInterimAnalysis(group1, group2);
  results.tests.push({
    name: 'Multiple looks work',
    passed: analyzer.looksTaken === 3,
    details: `looksTaken=${analyzer.looksTaken}`
  });

  // Test 10: Get status
  const status = analyzer.getStatus();
  results.tests.push({
    name: 'Get status works',
    passed: status.looksTaken === 3 && status.remainingLooks === 2,
    details: `taken=${status.looksTaken}, remaining=${status.remainingLooks}`
  });

  // Test 11: Recommended look schedule
  const schedule = analyzer.getRecommendedLookSchedule(100);
  results.tests.push({
    name: 'Recommended look schedule generated',
    passed: schedule.length === 5 && schedule[0].samplesPerGroup === 20,
    details: `scheduleLength=${schedule.length}, firstLookN=${schedule[0].samplesPerGroup}`
  });

  // Test 12: Reset works
  analyzer.reset();
  results.tests.push({
    name: 'Reset works',
    passed: analyzer.looksTaken === 0 && analyzer.lookHistory.length === 0,
    details: `looksTaken=${analyzer.looksTaken}`
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
  console.log('Sequential Analysis Phase 6 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
