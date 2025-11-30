/**
 * Hybrid Feedback Manager
 *
 * Enables training loop to use both simulated and real production feedback.
 * Provides seamless fallback and blending between data sources.
 *
 * Implementation of Plan 05: Production Feedback Integration - Phase 5
 */

import { feedbackStore } from './feedbackStorage.js';
import { calculateCorrelatedFeedback } from './feedbackSimulation.js';
import { FEEDBACK_CONTENT_TYPES } from './feedbackSchema.js';

// ============================================================================
// Phase 5: Hybrid Training Integration
// ============================================================================

/**
 * HybridFeedbackManager - Blends production and simulated feedback
 */
export class HybridFeedbackManager {
  /**
   * Create a new HybridFeedbackManager
   *
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Weight given to production feedback patterns when blending
    this.productionWeight = options.productionWeight || 0.7;

    // Minimum production samples needed before trusting production patterns
    this.minProductionSamples = options.minProductionSamples || 10;

    // Whether to fall back to simulated when no production data
    this.fallbackToSimulated = options.fallbackToSimulated !== false;

    // Cache for production patterns
    this.patternCache = {};
    this.patternCacheTTL = options.patternCacheTTL || 60000; // 1 minute
  }

  /**
   * Get feedback for a generation
   *
   * Priority:
   * 1. Direct production feedback for this generation
   * 2. Blended feedback from similar productions
   * 3. Simulated feedback (fallback)
   *
   * @param {string} generationId - Generation ID
   * @param {string} contentType - Content type
   * @param {number} qualityScore - Quality score (0-1)
   * @param {string} promptVariant - Prompt variant (optional)
   * @returns {Object} Feedback object
   */
  async getFeedback(generationId, contentType, qualityScore, promptVariant = 'default') {
    // Normalize quality score to 1-5 scale for feedback simulation
    const qualityScore5 = 1 + (qualityScore * 4);

    // Priority 1: Check for direct production feedback
    const productionEvents = feedbackStore.getEventsForGeneration(generationId);
    if (productionEvents.length > 0) {
      return this.aggregateProductionFeedback(productionEvents);
    }

    // Priority 2: Check for similar production patterns
    const similarFeedback = await this.findSimilarFeedback(contentType, promptVariant, qualityScore5);
    if (similarFeedback && similarFeedback.sampleCount >= this.minProductionSamples) {
      return this.blendFeedback(similarFeedback, qualityScore5, contentType);
    }

    // Priority 3: Fall back to simulated
    if (this.fallbackToSimulated) {
      const simulated = calculateCorrelatedFeedback(qualityScore5, contentType);
      return {
        ...simulated,
        source: 'simulated'
      };
    }

    return null;
  }

  /**
   * Aggregate multiple production feedback events into a single result
   *
   * @param {Array} events - Production feedback events
   * @returns {Object} Aggregated feedback
   */
  aggregateProductionFeedback(events) {
    const result = {
      rating: null,
      qualityScore: null,
      wasExported: false,
      wasEdited: false,
      wasRegenerated: false,
      thumbsUp: null,
      source: 'production',
      eventCount: events.length
    };

    // Aggregate ratings
    const ratings = events.filter(e => e.rating != null).map(e => e.rating);
    if (ratings.length > 0) {
      result.rating = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
    }

    // Aggregate quality scores
    const qualities = events.filter(e => e.qualityScore != null).map(e => e.qualityScore);
    if (qualities.length > 0) {
      result.qualityScore = qualities.reduce((a, b) => a + b, 0) / qualities.length;
    }

    // Behavioral signals (any positive indicates behavior)
    result.wasExported = events.some(e => e.exported);
    result.wasEdited = events.some(e => e.edited);
    result.wasRegenerated = events.some(e => e.regenerated);

    // Thumbs aggregation (majority vote)
    const thumbs = events.filter(e => e.thumbsUp != null);
    if (thumbs.length > 0) {
      const upCount = thumbs.filter(e => e.thumbsUp).length;
      result.thumbsUp = upCount / thumbs.length > 0.5;
    }

    return result;
  }

  /**
   * Find production feedback patterns similar to the current context
   *
   * @param {string} contentType - Content type
   * @param {string} promptVariant - Prompt variant
   * @param {number} qualityScore - Quality score (1-5)
   * @returns {Object|null} Similar feedback patterns
   */
  async findSimilarFeedback(contentType, promptVariant, qualityScore) {
    // Check cache
    const cacheKey = `${contentType}_${promptVariant}`;
    const cached = this.patternCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < this.patternCacheTTL) {
      return cached.data;
    }

    // Get aggregates from store
    const aggregates = feedbackStore.getAggregates(contentType, promptVariant);

    if (!aggregates) return null;

    const patterns = {
      sampleCount: aggregates.totalEvents,
      avgRating: aggregates.avgRating,
      exportRate: aggregates.exportRate,
      editRate: aggregates.editRate,
      regenerateRate: aggregates.regenerateRate,
      thumbsUpRate: aggregates.thumbsUpRate,
      avgQualityScore: aggregates.avgQualityScore
    };

    // Cache result
    this.patternCache[cacheKey] = {
      data: patterns,
      timestamp: Date.now()
    };

    return patterns;
  }

  /**
   * Blend simulated feedback with production patterns
   *
   * @param {Object} productionPatterns - Production feedback patterns
   * @param {number} qualityScore - Quality score (1-5)
   * @param {string} contentType - Content type
   * @returns {Object} Blended feedback
   */
  blendFeedback(productionPatterns, qualityScore, contentType) {
    // Start with simulated feedback
    const simulated = calculateCorrelatedFeedback(qualityScore, contentType);

    // Create blended result
    const blended = {
      ...simulated,
      source: 'blended',
      productionInfluence: this.productionWeight
    };

    // Blend rating toward production average
    if (productionPatterns.avgRating !== null && simulated.rating !== null) {
      const diff = productionPatterns.avgRating - simulated.rating;
      blended.rating = Math.round(simulated.rating + diff * this.productionWeight);
      blended.rating = Math.max(1, Math.min(5, blended.rating));
    }

    // Blend behavioral probabilities
    if (productionPatterns.exportRate !== null) {
      const baseProb = simulated.wasExported ? 0.7 : 0.3;
      const adjustedProb = baseProb + (productionPatterns.exportRate - 0.5) * this.productionWeight;
      blended.wasExported = Math.random() < Math.max(0, Math.min(1, adjustedProb));
    }

    if (productionPatterns.editRate !== null) {
      const baseProb = simulated.wasEdited ? 0.7 : 0.3;
      const adjustedProb = baseProb + (productionPatterns.editRate - 0.5) * this.productionWeight;
      blended.wasEdited = Math.random() < Math.max(0, Math.min(1, adjustedProb));
    }

    if (productionPatterns.regenerateRate !== null) {
      const baseProb = simulated.wasRegenerated ? 0.7 : 0.3;
      const adjustedProb = baseProb + (productionPatterns.regenerateRate - 0.5) * this.productionWeight;
      blended.wasRegenerated = Math.random() < Math.max(0, Math.min(1, adjustedProb));
    }

    // Blend thumbs up rate
    if (productionPatterns.thumbsUpRate !== null) {
      const baseProb = simulated.thumbsUp === true ? 0.7 : simulated.thumbsUp === false ? 0.3 : 0.5;
      const adjustedProb = baseProb + (productionPatterns.thumbsUpRate - 0.5) * this.productionWeight;
      blended.thumbsUp = Math.random() < Math.max(0, Math.min(1, adjustedProb));
    }

    return blended;
  }

  /**
   * Get production coverage status for all content types
   *
   * @returns {Object} Coverage status per content type
   */
  getProductionCoverage() {
    const coverage = {};

    for (const contentType of FEEDBACK_CONTENT_TYPES) {
      const aggregates = feedbackStore.getAggregates(contentType, 'default');
      coverage[contentType] = {
        hasSufficientData: aggregates !== null && aggregates.totalEvents >= this.minProductionSamples,
        sampleCount: aggregates?.totalEvents || 0,
        avgRating: aggregates?.avgRating || null,
        minRequiredSamples: this.minProductionSamples
      };
    }

    return coverage;
  }

  /**
   * Get statistics about feedback sources used
   *
   * @returns {Object} Source statistics
   */
  getSourceStats() {
    const totalEvents = feedbackStore.events.length;

    return {
      productionEvents: totalEvents,
      coverageByType: this.getProductionCoverage(),
      configuration: {
        productionWeight: this.productionWeight,
        minProductionSamples: this.minProductionSamples,
        fallbackEnabled: this.fallbackToSimulated
      }
    };
  }

  /**
   * Clear the pattern cache
   */
  clearCache() {
    this.patternCache = {};
  }

  /**
   * Update configuration
   *
   * @param {Object} options - New configuration options
   */
  configure(options) {
    if (options.productionWeight !== undefined) {
      this.productionWeight = Math.max(0, Math.min(1, options.productionWeight));
    }
    if (options.minProductionSamples !== undefined) {
      this.minProductionSamples = Math.max(1, options.minProductionSamples);
    }
    if (options.fallbackToSimulated !== undefined) {
      this.fallbackToSimulated = options.fallbackToSimulated;
    }
  }
}

// Singleton instance
export const hybridFeedback = new HybridFeedbackManager();

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 5 implementation
 *
 * @returns {Object} Validation results
 */
export async function validatePhase5() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: HybridFeedbackManager instantiation
  const manager = new HybridFeedbackManager({
    productionWeight: 0.8,
    minProductionSamples: 5
  });
  results.tests.push({
    name: 'HybridFeedbackManager instantiates with options',
    passed: manager.productionWeight === 0.8 && manager.minProductionSamples === 5,
    details: `productionWeight=${manager.productionWeight}, minProductionSamples=${manager.minProductionSamples}`
  });

  // Test 2: getFeedback returns simulated when no production data
  const feedback1 = await manager.getFeedback('nonexistent_gen', 'Roadmap', 0.7);
  results.tests.push({
    name: 'getFeedback falls back to simulated',
    passed: feedback1 !== null && feedback1.source === 'simulated',
    details: `source=${feedback1?.source}`
  });

  // Test 3: Simulated feedback has correct structure
  results.tests.push({
    name: 'Simulated feedback has correct structure',
    passed: feedback1.rating !== undefined && feedback1.wasExported !== undefined,
    details: `hasRating=${feedback1?.rating !== undefined}`
  });

  // Test 4: aggregateProductionFeedback works
  const mockEvents = [
    { rating: 4, thumbsUp: true, exported: true, edited: false, regenerated: false },
    { rating: 5, thumbsUp: true, exported: false, edited: true, regenerated: false },
    { rating: 4, thumbsUp: false, exported: false, edited: false, regenerated: true }
  ];
  const aggregated = manager.aggregateProductionFeedback(mockEvents);
  results.tests.push({
    name: 'aggregateProductionFeedback aggregates correctly',
    passed: aggregated.rating === 4 && aggregated.source === 'production' && aggregated.wasExported === true,
    details: `rating=${aggregated.rating}, wasExported=${aggregated.wasExported}`
  });

  // Test 5: Thumbs aggregation (majority vote)
  results.tests.push({
    name: 'Thumbs aggregation uses majority vote',
    passed: aggregated.thumbsUp === true,  // 2 up, 1 down
    details: `thumbsUp=${aggregated.thumbsUp}`
  });

  // Test 6: blendFeedback works
  const mockPatterns = {
    sampleCount: 20,
    avgRating: 4.5,
    exportRate: 0.8,
    editRate: 0.2,
    regenerateRate: 0.1,
    thumbsUpRate: 0.9
  };
  const blended = manager.blendFeedback(mockPatterns, 3, 'Slides');
  results.tests.push({
    name: 'blendFeedback produces blended result',
    passed: blended.source === 'blended' && blended.productionInfluence === 0.8,
    details: `source=${blended.source}, rating=${blended.rating}`
  });

  // Test 7: getProductionCoverage returns status for all types
  const coverage = manager.getProductionCoverage();
  results.tests.push({
    name: 'getProductionCoverage returns status for all types',
    passed: Object.keys(coverage).length === FEEDBACK_CONTENT_TYPES.length,
    details: `types=${Object.keys(coverage).join(', ')}`
  });

  // Test 8: Coverage correctly identifies insufficient data
  const roadmapCoverage = coverage.Roadmap;
  results.tests.push({
    name: 'Coverage identifies insufficient data',
    passed: roadmapCoverage.hasSufficientData === false || roadmapCoverage.sampleCount >= 5,
    details: `hasSufficientData=${roadmapCoverage.hasSufficientData}, samples=${roadmapCoverage.sampleCount}`
  });

  // Test 9: configure updates settings
  manager.configure({ productionWeight: 0.5, minProductionSamples: 15 });
  results.tests.push({
    name: 'configure updates settings',
    passed: manager.productionWeight === 0.5 && manager.minProductionSamples === 15,
    details: `weight=${manager.productionWeight}, min=${manager.minProductionSamples}`
  });

  // Test 10: getSourceStats returns comprehensive stats
  const stats = manager.getSourceStats();
  results.tests.push({
    name: 'getSourceStats returns comprehensive stats',
    passed: stats.configuration !== undefined && stats.coverageByType !== undefined,
    details: `hasConfig=${stats.configuration !== undefined}`
  });

  // Test 11: clearCache works
  manager.patternCache['test'] = { data: {}, timestamp: Date.now() };
  manager.clearCache();
  results.tests.push({
    name: 'clearCache clears the cache',
    passed: Object.keys(manager.patternCache).length === 0,
    details: `cacheSize=${Object.keys(manager.patternCache).length}`
  });

  // Test 12: Fallback disabled returns null
  const noFallbackManager = new HybridFeedbackManager({ fallbackToSimulated: false });
  const noFallbackResult = await noFallbackManager.getFeedback('nonexistent', 'Roadmap', 0.5);
  results.tests.push({
    name: 'Disabled fallback returns null',
    passed: noFallbackResult === null,
    details: `result=${noFallbackResult}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  validatePhase5().then(validation => {
    console.log('Hybrid Feedback Phase 5 Validation:', validation.passed ? 'PASSED' : 'FAILED');
    if (!validation.passed) {
      validation.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  FAILED: ${t.name} - ${t.details}`);
      });
    }
  });
}
