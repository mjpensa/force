/**
 * Feedback Simulation Module
 *
 * Generates simulated user feedback that correlates with content quality.
 * This replaces purely random feedback with statistically realistic patterns.
 */

// =============================================================================
// PHASE 1: QUALITY-CORRELATED RATING
// =============================================================================

/**
 * Generate a random number from a Gaussian (normal) distribution
 * using the Box-Muller transform.
 *
 * @param {number} mean - The mean of the distribution
 * @param {number} stdDev - The standard deviation of the distribution
 * @returns {number} A random value from the normal distribution
 */
function gaussianRandom(mean = 0, stdDev = 1) {
  // Guard against edge case where u1 = 0 (would cause log(0) = -Infinity)
  let u1 = Math.random();
  while (u1 === 0) {
    u1 = Math.random();
  }
  const u2 = Math.random();

  // Box-Muller transform
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  return mean + z * stdDev;
}

/**
 * Calculate a user rating that correlates with quality score but has realistic variance.
 *
 * Users don't perfectly assess quality - their ratings cluster around the true quality
 * with some random variation. This models that behavior.
 *
 * @param {number} qualityScore - The objective quality score (1-5 scale)
 * @returns {number} Simulated user rating (integer 1-5)
 */
function calculateCorrelatedRating(qualityScore) {
  // Normalize quality score to 1-5 range
  const normalizedScore = Math.max(1, Math.min(5, qualityScore || 3));

  // Add realistic variance: users don't perfectly assess quality
  // Standard deviation of ~0.8 produces realistic spread
  const variance = gaussianRandom(0, 0.8);

  // Calculate rating with variance, then clamp to valid range
  const rawRating = normalizedScore + variance;
  const rating = Math.round(Math.max(1, Math.min(5, rawRating)));

  return rating;
}

// =============================================================================
// PHASE 2: BEHAVIORAL SIGNAL CORRELATION
// =============================================================================

/**
 * Calculate behavioral signals (export, edit, regenerate) that correlate with quality.
 *
 * User behaviors follow predictable patterns:
 * - High quality content is more likely to be exported
 * - Low quality content is more likely to be edited or regenerated
 *
 * @param {number} qualityScore - The quality score (1-5 scale)
 * @returns {Object} Behavioral signals { wasExported, wasEdited, wasRegenerated }
 */
function calculateBehavioralSignals(qualityScore) {
  // Normalize quality score to 1-5 range
  const score = Math.max(1, Math.min(5, qualityScore || 3));

  // Export probability increases with quality
  // Low quality (1): ~5% export, High quality (5): ~50% export
  // Formula: 0.05 + (score - 1) * 0.1125 = 0.05 at 1, 0.50 at 5
  const exportProb = 0.05 + (score - 1) * 0.1125;
  const wasExported = Math.random() < exportProb;

  // Edit probability decreases with quality (inverse correlation)
  // Low quality (1): ~70% edit, High quality (5): ~10% edit
  // Formula: 0.7 - (score - 1) * 0.15 = 0.7 at 1, 0.1 at 5
  const editProb = 0.7 - (score - 1) * 0.15;
  const wasEdited = Math.random() < editProb;

  // Regenerate probability strongly decreases with quality
  // Low quality (1): ~60% regenerate, High quality (5): ~5% regenerate
  // Formula: 0.6 - (score - 1) * 0.1375 = 0.6 at 1, 0.05 at 5
  const regenProb = 0.6 - (score - 1) * 0.1375;
  const wasRegenerated = Math.random() < regenProb;

  return { wasExported, wasEdited, wasRegenerated };
}

// =============================================================================
// PHASE 4: CONTENT-TYPE BEHAVIORAL MODIFIERS
// =============================================================================

/**
 * Content-type-specific behavior modifiers.
 * These reflect how different content types are used in practice:
 * - Roadmaps: Often exported (presentations), less text to edit, visual issues trigger regeneration
 * - Slides: Almost always exported, often need text tweaks, users tolerate minor issues
 * - Documents: Baseline behavior, heavily edited, easier to edit than regenerate
 * - ResearchAnalysis: Often consumed in-app, less editable, wrong insights = regenerate
 */
const CONTENT_TYPE_MODIFIERS = {
  Roadmap: {
    exportMultiplier: 1.3,    // Roadmaps are often exported for presentations
    editMultiplier: 0.8,      // Less text editing needed (visual content)
    regenMultiplier: 1.2      // Visual issues trigger regeneration
  },
  Slides: {
    exportMultiplier: 1.5,    // Slides are almost always exported (PowerPoint, etc.)
    editMultiplier: 1.2,      // Often need text tweaks for polish
    regenMultiplier: 0.9      // Users tolerate and fix minor issues
  },
  Document: {
    exportMultiplier: 1.0,    // Baseline (documents have normal export behavior)
    editMultiplier: 1.4,      // Documents are heavily edited for precision
    regenMultiplier: 0.7      // Easier to edit text than regenerate
  },
  ResearchAnalysis: {
    exportMultiplier: 0.8,    // Often consumed in-app, less exported
    editMultiplier: 0.6,      // Analysis is less editable (complex content)
    regenMultiplier: 1.3      // Wrong insights = regenerate entire analysis
  }
};

/**
 * Apply content-type-specific modifiers to behavioral signals.
 * This recalculates probabilities based on the content type.
 *
 * Behavioral dependencies are modeled:
 * - Export and Regenerate are mutually exclusive (can't export what you regenerated)
 * - Edit can happen independently (user might edit before exporting or after failed regen)
 *
 * @param {number} qualityScore - The quality score (1-5 scale)
 * @param {string} contentType - The type of content being generated
 * @returns {Object} Modified behavioral signals { wasExported, wasEdited, wasRegenerated }
 */
function calculateBehavioralSignalsWithModifiers(qualityScore, contentType) {
  // Normalize quality score to 1-5 range
  const score = Math.max(1, Math.min(5, qualityScore || 3));

  // Get modifiers for this content type (default to neutral if unknown)
  const mods = CONTENT_TYPE_MODIFIERS[contentType] || {
    exportMultiplier: 1.0,
    editMultiplier: 1.0,
    regenMultiplier: 1.0
  };

  // Calculate base probabilities (from Phase 2)
  const baseExportProb = 0.05 + (score - 1) * 0.1125;
  const baseEditProb = 0.7 - (score - 1) * 0.15;
  const baseRegenProb = 0.6 - (score - 1) * 0.1375;

  // Apply multipliers and clamp to [0, 1]
  const exportProb = Math.max(0, Math.min(1, baseExportProb * mods.exportMultiplier));
  const editProb = Math.max(0, Math.min(1, baseEditProb * mods.editMultiplier));
  const regenProb = Math.max(0, Math.min(1, baseRegenProb * mods.regenMultiplier));

  // Model behavioral dependencies:
  // 1. First decide: does user regenerate? (mutually exclusive with export)
  // 2. If not regenerating, does user export?
  // 3. Edit can happen independently
  let wasRegenerated = false;
  let wasExported = false;

  // Regenerate decision (low quality = more likely to regenerate)
  if (Math.random() < regenProb) {
    wasRegenerated = true;
    // If regenerated, user didn't keep this version, so no export
    wasExported = false;
  } else {
    // User kept this version, now decide on export
    wasExported = Math.random() < exportProb;
  }

  // Edit can happen regardless (user might edit before export or after deciding not to regen)
  const wasEdited = Math.random() < editProb;

  return { wasExported, wasEdited, wasRegenerated };
}

// =============================================================================
// PHASE 3: THUMBS UP/DOWN CORRELATION
// =============================================================================

/**
 * Calculate thumbs up/down feedback that correlates with quality.
 *
 * User feedback patterns:
 * - Users are more likely to give thumbs feedback on extreme quality (very good or very bad)
 * - High quality gets mostly thumbs up, low quality gets mostly thumbs down
 * - Many users give no thumbs feedback at all
 *
 * @param {number} qualityScore - The quality score (1-5 scale)
 * @returns {boolean|null} true = thumbs up, false = thumbs down, null = no feedback
 */
function calculateThumbsFeedback(qualityScore) {
  // Normalize quality score to 1-5 range
  const score = Math.max(1, Math.min(5, qualityScore || 3));

  // Probability of giving any thumbs feedback
  // Users are more likely to give feedback on extreme quality (very good or very bad)
  // At quality 1 or 5, feedback probability is ~70%
  // At quality 3, feedback probability is ~30%
  const extremity = Math.abs(score - 3) / 2;  // 0-1 scale (0 at quality 3, 1 at quality 1 or 5)
  const feedbackProb = 0.3 + extremity * 0.4;  // 30-70% chance

  if (Math.random() >= feedbackProb) {
    return null;  // No feedback given
  }

  // If giving feedback, thumbs up probability scales with quality
  // Quality 1: ~10% thumbs up (90% thumbs down)
  // Quality 5: ~95% thumbs up (5% thumbs down)
  // Formula: 0.1 + (score - 1) * 0.2125 = 0.1 at 1, 0.95 at 5
  const thumbsUpProb = 0.1 + (score - 1) * 0.2125;

  return Math.random() < thumbsUpProb;
}

// =============================================================================
// PHASE 1 VALIDATION
// =============================================================================

/**
 * Validate that Phase 1 (correlated ratings) works correctly.
 * Runs statistical tests to verify correlation.
 *
 * @param {number} samplesPerLevel - Number of samples to generate per quality level
 * @returns {Object} Validation results with statistics
 */
function validatePhase1(samplesPerLevel = 1000) {
  const results = {};

  for (let quality = 1; quality <= 5; quality++) {
    const ratings = [];

    for (let i = 0; i < samplesPerLevel; i++) {
      ratings.push(calculateCorrelatedRating(quality));
    }

    // Calculate statistics
    const sum = ratings.reduce((a, b) => a + b, 0);
    const mean = sum / ratings.length;
    const squaredDiffs = ratings.map(r => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / ratings.length;
    const stdDev = Math.sqrt(variance);

    results[quality] = {
      sampleSize: samplesPerLevel,
      meanRating: mean,
      stdDev,
      expectedMean: quality,
      meanDeviation: Math.abs(mean - quality)
    };
  }

  // Check success criteria
  // Note: At boundaries (quality 1 and 5), clamping causes expected deviation
  // Quality 1: values below 1 are clamped up, so mean is ~1.3
  // Quality 5: values above 5 are clamped down, so mean is ~4.7
  const allMeansClose = Object.entries(results).every(([q, r]) => {
    const quality = parseInt(q);
    // Allow more deviation at boundaries due to clamping effects
    const threshold = (quality === 1 || quality === 5) ? 0.35 : 0.25;
    return r.meanDeviation < threshold;
  });
  const allStdDevsRealistic = Object.values(results).every(
    r => r.stdDev >= 0.4 && r.stdDev <= 1.2  // Slightly lower floor for boundaries
  );

  return {
    phase: 1,
    name: 'Quality-Correlated Rating',
    results,
    passed: allMeansClose && allStdDevsRealistic,
    checks: {
      meansWithin0_3: allMeansClose,
      stdDevRealistic: allStdDevsRealistic
    }
  };
}

// =============================================================================
// FRACTIONAL QUALITY SCORE VALIDATION
// =============================================================================

/**
 * Validate that fractional quality scores work correctly.
 * The training system can produce scores like 2.7 or 4.3, not just integers.
 *
 * @param {number} samplesPerLevel - Number of samples per quality level
 * @returns {Object} Validation results for fractional scores
 */
function validateFractionalScores(samplesPerLevel = 500) {
  // Test fractional quality levels
  const fractionalLevels = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
  const results = {};

  for (const quality of fractionalLevels) {
    const ratings = [];
    let exports = 0, edits = 0, regens = 0;

    for (let i = 0; i < samplesPerLevel; i++) {
      const feedback = calculateCorrelatedFeedback(quality, 'Document');
      ratings.push(feedback.rating);
      if (feedback.wasExported) exports++;
      if (feedback.wasEdited) edits++;
      if (feedback.wasRegenerated) regens++;
    }

    const meanRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    results[quality] = {
      meanRating,
      exportRate: exports / samplesPerLevel,
      editRate: edits / samplesPerLevel,
      regenRate: regens / samplesPerLevel
    };
  }

  // Check that ratings increase monotonically with quality
  const meanRatings = fractionalLevels.map(q => results[q].meanRating);
  const isMonotonic = meanRatings.every((val, i) =>
    i === 0 || val >= meanRatings[i - 1] - 0.15  // Allow small variance
  );

  // Check that export increases and regen decreases
  const exportRates = fractionalLevels.map(q => results[q].exportRate);
  const regenRates = fractionalLevels.map(q => results[q].regenRate);

  const exportIncreases = exportRates[exportRates.length - 1] > exportRates[0];
  const regenDecreases = regenRates[regenRates.length - 1] < regenRates[0];

  // Check interpolation: 2.5 should be between 2.0 and 3.0
  const interpolationCorrect =
    results[2.5].meanRating >= results[2.0].meanRating - 0.2 &&
    results[2.5].meanRating <= results[3.0].meanRating + 0.2;

  return {
    name: 'Fractional Quality Score Validation',
    results,
    passed: isMonotonic && exportIncreases && regenDecreases && interpolationCorrect,
    checks: {
      ratingsMonotonic: isMonotonic,
      exportIncreases,
      regenDecreases,
      interpolationCorrect
    }
  };
}

// =============================================================================
// PHASE 2 VALIDATION
// =============================================================================

/**
 * Validate that Phase 2 (behavioral signals) works correctly.
 * Tests both the base function and the production function with modifiers.
 *
 * @param {number} samplesPerLevel - Number of samples to generate per quality level
 * @returns {Object} Validation results with statistics
 */
function validatePhase2(samplesPerLevel = 1000) {
  const results = {
    base: {},      // Tests calculateBehavioralSignals (base function)
    withModifiers: {}  // Tests calculateBehavioralSignalsWithModifiers (production)
  };

  // Expected base probabilities for reference
  const expected = {
    1: { export: 0.05, edit: 0.70, regen: 0.60 },
    2: { export: 0.1625, edit: 0.55, regen: 0.4625 },
    3: { export: 0.275, edit: 0.40, regen: 0.325 },
    4: { export: 0.3875, edit: 0.25, regen: 0.1875 },
    5: { export: 0.50, edit: 0.10, regen: 0.05 }
  };

  // Test base function
  for (let quality = 1; quality <= 5; quality++) {
    let exports = 0, edits = 0, regens = 0;

    for (let i = 0; i < samplesPerLevel; i++) {
      const signals = calculateBehavioralSignals(quality);
      if (signals.wasExported) exports++;
      if (signals.wasEdited) edits++;
      if (signals.wasRegenerated) regens++;
    }

    results.base[quality] = {
      sampleSize: samplesPerLevel,
      exportRate: exports / samplesPerLevel,
      editRate: edits / samplesPerLevel,
      regenRate: regens / samplesPerLevel,
      expected: expected[quality]
    };
  }

  // Test production function with modifiers (using Document as baseline)
  for (let quality = 1; quality <= 5; quality++) {
    let exports = 0, edits = 0, regens = 0;

    for (let i = 0; i < samplesPerLevel; i++) {
      const signals = calculateBehavioralSignalsWithModifiers(quality, 'Document');
      if (signals.wasExported) exports++;
      if (signals.wasEdited) edits++;
      if (signals.wasRegenerated) regens++;
    }

    results.withModifiers[quality] = {
      sampleSize: samplesPerLevel,
      exportRate: exports / samplesPerLevel,
      editRate: edits / samplesPerLevel,
      regenRate: regens / samplesPerLevel
    };
  }

  // Check success criteria for base function
  const baseExportRates = Object.values(results.base).map(r => r.exportRate);
  const baseEditRates = Object.values(results.base).map(r => r.editRate);
  const baseRegenRates = Object.values(results.base).map(r => r.regenRate);

  // Check success criteria for production function
  const prodExportRates = Object.values(results.withModifiers).map(r => r.exportRate);
  const prodEditRates = Object.values(results.withModifiers).map(r => r.editRate);
  const prodRegenRates = Object.values(results.withModifiers).map(r => r.regenRate);

  const isIncreasing = (arr) => arr.every((val, i) => i === 0 || val >= arr[i - 1] - 0.05);
  const isDecreasing = (arr) => arr.every((val, i) => i === 0 || val <= arr[i - 1] + 0.05);

  const baseChecks = {
    exportIncreases: isIncreasing(baseExportRates),
    editDecreases: isDecreasing(baseEditRates),
    regenDecreases: isDecreasing(baseRegenRates)
  };

  const prodChecks = {
    exportIncreases: isIncreasing(prodExportRates),
    editDecreases: isDecreasing(prodEditRates),
    regenDecreases: isDecreasing(prodRegenRates)
  };

  // Verify mutual exclusivity: when regenerated, should not have exported
  let mutualExclusivityViolations = 0;
  for (let i = 0; i < 1000; i++) {
    const signals = calculateBehavioralSignalsWithModifiers(2, 'Document'); // Low quality = more regen
    if (signals.wasRegenerated && signals.wasExported) {
      mutualExclusivityViolations++;
    }
  }

  return {
    phase: 2,
    name: 'Behavioral Signal Correlation',
    results,
    passed: Object.values(baseChecks).every(v => v) &&
            Object.values(prodChecks).every(v => v) &&
            mutualExclusivityViolations === 0,
    checks: {
      base: baseChecks,
      withModifiers: prodChecks,
      mutualExclusivityHolds: mutualExclusivityViolations === 0
    }
  };
}

// =============================================================================
// PHASE 3 VALIDATION
// =============================================================================

/**
 * Validate that Phase 3 (thumbs feedback) works correctly.
 * Verifies that thumbs up rate correlates with quality and feedback rate varies by extremity.
 *
 * @param {number} samplesPerLevel - Number of samples to generate per quality level
 * @returns {Object} Validation results with statistics
 */
function validatePhase3(samplesPerLevel = 1000) {
  const results = {};

  for (let quality = 1; quality <= 5; quality++) {
    let thumbsUp = 0, thumbsDown = 0, noFeedback = 0;

    for (let i = 0; i < samplesPerLevel; i++) {
      const thumbs = calculateThumbsFeedback(quality);
      if (thumbs === true) thumbsUp++;
      else if (thumbs === false) thumbsDown++;
      else noFeedback++;
    }

    const totalWithFeedback = thumbsUp + thumbsDown;
    results[quality] = {
      sampleSize: samplesPerLevel,
      thumbsUpRate: totalWithFeedback > 0 ? thumbsUp / totalWithFeedback : 0,
      feedbackRate: totalWithFeedback / samplesPerLevel,
      thumbsUp,
      thumbsDown,
      noFeedback
    };
  }

  // Check success criteria
  // 1. Thumbs up rate should increase with quality
  const thumbsUpRates = Object.values(results).map(r => r.thumbsUpRate);
  const isThumbsUpIncreasing = thumbsUpRates.every((val, i) => i === 0 || val >= thumbsUpRates[i - 1] - 0.05);

  // 2. Feedback rate should be higher at extremes (quality 1 and 5) than middle (quality 3)
  const feedbackAt1 = results[1].feedbackRate;
  const feedbackAt3 = results[3].feedbackRate;
  const feedbackAt5 = results[5].feedbackRate;
  const extremityEffect = feedbackAt1 > feedbackAt3 && feedbackAt5 > feedbackAt3;

  return {
    phase: 3,
    name: 'Thumbs Up/Down Correlation',
    results,
    passed: isThumbsUpIncreasing && extremityEffect,
    checks: {
      thumbsUpIncreases: isThumbsUpIncreasing,
      extremityEffect
    }
  };
}

// =============================================================================
// PHASE 5: COMPOSITE FEEDBACK FUNCTION
// =============================================================================

/**
 * Calculate realistic simulated feedback that correlates with quality.
 *
 * This is the main entry point that combines all phases:
 * - Phase 1: Quality-correlated rating
 * - Phase 2: Behavioral signal correlation
 * - Phase 3: Thumbs up/down correlation
 * - Phase 4: Content-type modifiers
 *
 * @param {number} qualityScore - The quality score (typically 1-5 scale)
 * @param {string} contentType - The type of content (Roadmap, Slides, Document, ResearchAnalysis)
 * @returns {Object} Simulated feedback object
 */
function calculateCorrelatedFeedback(qualityScore, contentType) {
  // Ensure valid quality score (clamp to 1-5)
  const score = Math.max(1, Math.min(5, qualityScore || 3));

  // Phase 1: Calculate correlated rating
  const rating = calculateCorrelatedRating(score);

  // Phase 2 & 4: Calculate behavioral signals with content-type modifiers
  const behaviors = calculateBehavioralSignalsWithModifiers(score, contentType);

  // Phase 3: Calculate thumbs feedback
  const thumbsUp = calculateThumbsFeedback(score);

  return {
    rating,
    qualityScore: score,  // Include raw score for debugging/analysis
    wasExported: behaviors.wasExported,
    wasEdited: behaviors.wasEdited,
    wasRegenerated: behaviors.wasRegenerated,
    thumbsUp
  };
}

// =============================================================================
// PHASE 4 VALIDATION
// =============================================================================

/**
 * Validate that Phase 4 (content-type modifiers) works correctly.
 * Verifies that different content types have different behavioral patterns.
 *
 * @param {number} samplesPerType - Number of samples per content type
 * @returns {Object} Validation results with statistics
 */
function validatePhase4(samplesPerType = 1000) {
  const contentTypes = ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];
  const results = {};

  // Test at quality 3 (middle) to see content type differences clearly
  const testQuality = 3;

  for (const contentType of contentTypes) {
    let exports = 0, edits = 0, regens = 0;

    for (let i = 0; i < samplesPerType; i++) {
      const signals = calculateBehavioralSignalsWithModifiers(testQuality, contentType);
      if (signals.wasExported) exports++;
      if (signals.wasEdited) edits++;
      if (signals.wasRegenerated) regens++;
    }

    results[contentType] = {
      sampleSize: samplesPerType,
      quality: testQuality,
      exportRate: exports / samplesPerType,
      editRate: edits / samplesPerType,
      regenRate: regens / samplesPerType,
      modifiers: CONTENT_TYPE_MODIFIERS[contentType]
    };
  }

  // Check success criteria: content types should have different patterns
  // Slides should have highest export rate
  const slideExport = results.Slides.exportRate;
  const slidesHighestExport = contentTypes.every(
    ct => ct === 'Slides' || results[ct].exportRate <= slideExport + 0.05
  );

  // Document should have highest edit rate
  const docEdit = results.Document.editRate;
  const docHighestEdit = contentTypes.every(
    ct => ct === 'Document' || results[ct].editRate <= docEdit + 0.05
  );

  // ResearchAnalysis should have highest regen rate
  const raRegen = results.ResearchAnalysis.regenRate;
  const raHighestRegen = contentTypes.every(
    ct => ct === 'ResearchAnalysis' || results[ct].regenRate <= raRegen + 0.05
  );

  return {
    phase: 4,
    name: 'Content-Type Behavioral Modifiers',
    results,
    passed: slidesHighestExport && docHighestEdit && raHighestRegen,
    checks: {
      slidesHighestExport,
      docHighestEdit,
      raHighestRegen
    }
  };
}

// =============================================================================
// PHASE 5 VALIDATION
// =============================================================================

/**
 * Validate that Phase 5 (composite function) works correctly.
 * Tests that the unified function produces expected outputs.
 *
 * @param {number} samplesPerLevel - Number of samples per quality level
 * @returns {Object} Validation results with statistics
 */
function validatePhase5(samplesPerLevel = 500) {
  const contentTypes = ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];
  const results = {};

  for (const contentType of contentTypes) {
    results[contentType] = {};

    for (let quality = 1; quality <= 5; quality++) {
      let ratings = [], exports = 0, edits = 0, regens = 0, thumbsUp = 0, thumbsDown = 0;

      for (let i = 0; i < samplesPerLevel; i++) {
        const feedback = calculateCorrelatedFeedback(quality, contentType);
        ratings.push(feedback.rating);
        if (feedback.wasExported) exports++;
        if (feedback.wasEdited) edits++;
        if (feedback.wasRegenerated) regens++;
        if (feedback.thumbsUp === true) thumbsUp++;
        if (feedback.thumbsUp === false) thumbsDown++;
      }

      results[contentType][quality] = {
        meanRating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
        exportRate: exports / samplesPerLevel,
        editRate: edits / samplesPerLevel,
        regenRate: regens / samplesPerLevel,
        thumbsUpRate: (thumbsUp + thumbsDown) > 0 ? thumbsUp / (thumbsUp + thumbsDown) : 0
      };
    }
  }

  // Check success criteria:
  // 1. All content types should show rating correlation with quality
  // 2. Return value should have all expected fields
  const allRatingsCorrelate = contentTypes.every(ct => {
    const stats = results[ct];
    return stats[1].meanRating < stats[3].meanRating && stats[3].meanRating < stats[5].meanRating;
  });

  // Test that output has correct structure
  const testOutput = calculateCorrelatedFeedback(3, 'Document');
  const hasAllFields = (
    typeof testOutput.rating === 'number' &&
    typeof testOutput.qualityScore === 'number' &&
    typeof testOutput.wasExported === 'boolean' &&
    typeof testOutput.wasEdited === 'boolean' &&
    typeof testOutput.wasRegenerated === 'boolean' &&
    (testOutput.thumbsUp === null || typeof testOutput.thumbsUp === 'boolean')
  );

  return {
    phase: 5,
    name: 'Composite Feedback Function',
    results,
    passed: allRatingsCorrelate && hasAllFields,
    checks: {
      allRatingsCorrelate,
      hasAllFields,
      sampleOutput: testOutput
    }
  };
}

// =============================================================================
// PHASE 6: COMPREHENSIVE VALIDATION & CALIBRATION
// =============================================================================

/**
 * Calculate Pearson correlation coefficient between two arrays.
 *
 * @param {number[]} x - First array
 * @param {number[]} y - Second array
 * @returns {number} Correlation coefficient (-1 to 1)
 */
function pearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Comprehensive validation of the feedback simulation system.
 * Tests all phases and calculates key metrics including Pearson correlation.
 *
 * @param {number} samplesPerLevel - Number of samples per quality level
 * @returns {Object} Comprehensive validation results
 */
function validateFeedbackCorrelation(samplesPerLevel = 2000) {
  const contentTypes = ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];
  const results = {
    timestamp: new Date().toISOString(),
    samplesPerLevel,
    overall: {},
    byContentType: {}
  };

  // Collect all quality scores and corresponding ratings for correlation
  const allQualities = [];
  const allRatings = [];

  for (const contentType of contentTypes) {
    const ctResults = {
      qualities: [],
      ratings: [],
      byQuality: {}
    };

    for (let quality = 1; quality <= 5; quality++) {
      const qualityResults = {
        ratings: [],
        exports: 0,
        edits: 0,
        regenerations: 0,
        thumbsUp: 0,
        thumbsDown: 0,
        noThumbs: 0
      };

      for (let i = 0; i < samplesPerLevel; i++) {
        const feedback = calculateCorrelatedFeedback(quality, contentType);

        ctResults.qualities.push(quality);
        ctResults.ratings.push(feedback.rating);
        allQualities.push(quality);
        allRatings.push(feedback.rating);

        qualityResults.ratings.push(feedback.rating);
        if (feedback.wasExported) qualityResults.exports++;
        if (feedback.wasEdited) qualityResults.edits++;
        if (feedback.wasRegenerated) qualityResults.regenerations++;
        if (feedback.thumbsUp === true) qualityResults.thumbsUp++;
        else if (feedback.thumbsUp === false) qualityResults.thumbsDown++;
        else qualityResults.noThumbs++;
      }

      // Calculate statistics for this quality level
      const ratings = qualityResults.ratings;
      const meanRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      const stdDev = Math.sqrt(
        ratings.reduce((sum, r) => sum + Math.pow(r - meanRating, 2), 0) / ratings.length
      );

      ctResults.byQuality[quality] = {
        meanRating: meanRating.toFixed(3),
        stdDev: stdDev.toFixed(3),
        exportRate: (qualityResults.exports / samplesPerLevel * 100).toFixed(1) + '%',
        editRate: (qualityResults.edits / samplesPerLevel * 100).toFixed(1) + '%',
        regenRate: (qualityResults.regenerations / samplesPerLevel * 100).toFixed(1) + '%',
        thumbsUpCount: qualityResults.thumbsUp,
        thumbsDownCount: qualityResults.thumbsDown,
        noThumbsCount: qualityResults.noThumbs
      };
    }

    // Calculate content-type-specific Pearson correlation
    ctResults.pearsonCorrelation = pearsonCorrelation(ctResults.qualities, ctResults.ratings).toFixed(4);

    results.byContentType[contentType] = ctResults;
  }

  // Calculate overall Pearson correlation for ratings
  results.overall.pearsonCorrelation = pearsonCorrelation(allQualities, allRatings).toFixed(4);
  results.overall.totalSamples = allQualities.length;

  // Calculate behavioral correlations (export/edit/regen vs quality)
  // Collect behavioral data across all samples
  const allExports = [];
  const allEdits = [];
  const allRegens = [];
  const behaviorQualities = [];

  for (const contentType of contentTypes) {
    for (let quality = 1; quality <= 5; quality++) {
      for (let i = 0; i < Math.min(samplesPerLevel, 200); i++) {  // Limit for performance
        const feedback = calculateCorrelatedFeedback(quality, contentType);
        behaviorQualities.push(quality);
        allExports.push(feedback.wasExported ? 1 : 0);
        allEdits.push(feedback.wasEdited ? 1 : 0);
        allRegens.push(feedback.wasRegenerated ? 1 : 0);
      }
    }
  }

  results.overall.behavioralCorrelations = {
    exportVsQuality: pearsonCorrelation(behaviorQualities, allExports).toFixed(4),
    editVsQuality: pearsonCorrelation(behaviorQualities, allEdits).toFixed(4),
    regenVsQuality: pearsonCorrelation(behaviorQualities, allRegens).toFixed(4)
  };

  // Success criteria checks
  const correlationThreshold = 0.85;
  const overallCorrelationPasses = parseFloat(results.overall.pearsonCorrelation) >= correlationThreshold;
  const allContentTypesPass = contentTypes.every(
    ct => parseFloat(results.byContentType[ct].pearsonCorrelation) >= correlationThreshold
  );

  // Behavioral correlations should show expected direction:
  // - Export should positively correlate with quality (r > 0)
  // - Edit should negatively correlate with quality (r < 0)
  // - Regen should negatively correlate with quality (r < 0)
  const behavioralCorrelationsCorrect =
    parseFloat(results.overall.behavioralCorrelations.exportVsQuality) > 0 &&
    parseFloat(results.overall.behavioralCorrelations.editVsQuality) < 0 &&
    parseFloat(results.overall.behavioralCorrelations.regenVsQuality) < 0;

  results.passed = overallCorrelationPasses && allContentTypesPass && behavioralCorrelationsCorrect;
  results.checks = {
    overallCorrelation: {
      value: results.overall.pearsonCorrelation,
      threshold: correlationThreshold,
      passed: overallCorrelationPasses
    },
    contentTypeCorrelations: contentTypes.map(ct => ({
      contentType: ct,
      correlation: results.byContentType[ct].pearsonCorrelation,
      passed: parseFloat(results.byContentType[ct].pearsonCorrelation) >= correlationThreshold
    })),
    behavioralCorrelations: {
      export: results.overall.behavioralCorrelations.exportVsQuality,
      edit: results.overall.behavioralCorrelations.editVsQuality,
      regen: results.overall.behavioralCorrelations.regenVsQuality,
      passed: behavioralCorrelationsCorrect
    }
  };

  return results;
}

/**
 * Run all phase validations and return a summary.
 *
 * @returns {Object} Summary of all validation results
 */
function runAllValidations() {
  const results = {
    timestamp: new Date().toISOString(),
    phases: [],
    additionalValidations: []
  };

  // Run each phase validation with sufficient sample sizes for reliable results
  results.phases.push(validatePhase1(2000));  // More samples for stable mean/stddev
  results.phases.push(validatePhase2(1500));  // More samples for behavioral patterns
  results.phases.push(validatePhase3(1500));
  results.phases.push(validatePhase4(1500));
  results.phases.push(validatePhase5(500));

  // Run additional validations
  results.additionalValidations.push(validateFractionalScores());

  // Run comprehensive validation
  const comprehensive = validateFeedbackCorrelation(1000);
  results.comprehensiveValidation = {
    pearsonCorrelation: comprehensive.overall.pearsonCorrelation,
    behavioralCorrelations: comprehensive.overall.behavioralCorrelations,
    passed: comprehensive.passed,
    checks: comprehensive.checks
  };

  // Overall pass/fail
  results.allPhasesPassed = results.phases.every(p => p.passed);
  results.additionalValidationsPassed = results.additionalValidations.every(v => v.passed);
  results.comprehensivePassed = comprehensive.passed;
  results.overallPassed = results.allPhasesPassed &&
                          results.additionalValidationsPassed &&
                          results.comprehensivePassed;

  return results;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Core functions
  gaussianRandom,
  calculateCorrelatedRating,
  calculateBehavioralSignals,
  calculateBehavioralSignalsWithModifiers,
  calculateThumbsFeedback,
  calculateCorrelatedFeedback,

  // Constants
  CONTENT_TYPE_MODIFIERS,

  // Utility functions
  pearsonCorrelation,

  // Validation functions
  validatePhase1,
  validatePhase2,
  validatePhase3,
  validatePhase4,
  validatePhase5,
  validateFractionalScores,
  validateFeedbackCorrelation,
  runAllValidations
};
