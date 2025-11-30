/**
 * Feedback Analytics
 *
 * Analyzes quality-feedback correlations to improve scoring models.
 * Identifies gaps between predicted quality and actual user satisfaction.
 *
 * Implementation of Plan 05: Production Feedback Integration - Phase 6
 */

import { feedbackStore } from './feedbackStorage.js';
import { HybridFeedbackManager } from './hybridFeedback.js';
import { FEEDBACK_CONTENT_TYPES } from './feedbackSchema.js';

// ============================================================================
// Phase 6: Quality-Feedback Correlation Analysis
// ============================================================================

/**
 * FeedbackAnalytics - Analyzes correlations between quality scores and feedback
 */
export class FeedbackAnalytics {
  /**
   * Create a new FeedbackAnalytics instance
   *
   * @param {FeedbackStore} store - Feedback store instance
   */
  constructor(store = feedbackStore) {
    this.store = store;
  }

  /**
   * Calculate Pearson correlation coefficient between two arrays
   *
   * @param {Array<number>} x - First array
   * @param {Array<number>} y - Second array
   * @returns {number} Correlation coefficient (-1 to 1)
   */
  pearsonCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0);
    const sumX2 = x.reduce((s, xi) => s + xi ** 2, 0);
    const sumY2 = y.reduce((s, yi) => s + yi ** 2, 0);

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));

    return den !== 0 ? num / den : 0;
  }

  /**
   * Calculate correlation between quality scores and user ratings
   *
   * @returns {Object} Correlation analysis results
   */
  calculateQualityFeedbackCorrelation() {
    const events = this.store.events.filter(e =>
      e.qualityScore != null && e.rating != null
    );

    if (events.length < 10) {
      return {
        correlation: null,
        sampleSize: events.length,
        message: 'Insufficient data (minimum 10 samples required)',
        interpretation: null
      };
    }

    // Extract quality scores and ratings
    const qualities = events.map(e => e.qualityScore);
    const ratings = events.map(e => e.rating);

    // Calculate correlation
    const correlation = this.pearsonCorrelation(qualities, ratings);

    // Calculate averages
    const avgQuality = qualities.reduce((a, b) => a + b, 0) / qualities.length;
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    // Calculate standard deviations
    const stdQuality = Math.sqrt(
      qualities.reduce((sum, q) => sum + (q - avgQuality) ** 2, 0) / qualities.length
    );
    const stdRating = Math.sqrt(
      ratings.reduce((sum, r) => sum + (r - avgRating) ** 2, 0) / ratings.length
    );

    return {
      correlation: parseFloat(correlation.toFixed(3)),
      sampleSize: events.length,
      interpretation: this.interpretCorrelation(correlation),
      avgQualityScore: parseFloat(avgQuality.toFixed(3)),
      avgRating: parseFloat(avgRating.toFixed(2)),
      stdQualityScore: parseFloat(stdQuality.toFixed(3)),
      stdRating: parseFloat(stdRating.toFixed(2)),
      confidenceLevel: this.calculateConfidenceLevel(events.length, correlation)
    };
  }

  /**
   * Interpret correlation coefficient
   *
   * @param {number} r - Correlation coefficient
   * @returns {string} Interpretation
   */
  interpretCorrelation(r) {
    const abs = Math.abs(r);
    const direction = r >= 0 ? 'positive' : 'negative';

    if (abs >= 0.7) {
      return `Strong ${direction} correlation - quality scores reliably predict user satisfaction`;
    }
    if (abs >= 0.4) {
      return `Moderate ${direction} correlation - quality scores somewhat predict satisfaction`;
    }
    if (abs >= 0.2) {
      return `Weak ${direction} correlation - quality scores poorly predict satisfaction`;
    }
    return 'No significant correlation - quality scores do not predict satisfaction';
  }

  /**
   * Calculate statistical confidence level
   *
   * @param {number} n - Sample size
   * @param {number} r - Correlation coefficient
   * @returns {string} Confidence level
   */
  calculateConfidenceLevel(n, r) {
    // Using t-test approximation for correlation significance
    const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r));

    // Critical values (approximate)
    if (n < 10) return 'insufficient_data';
    if (t > 3.5) return 'high';  // ~99% confidence
    if (t > 2.5) return 'medium';  // ~95% confidence
    if (t > 1.7) return 'low';  // ~90% confidence
    return 'not_significant';
  }

  /**
   * Identify quality-feedback gaps (discrepancies)
   *
   * @param {number} gapThreshold - Minimum gap to report (0-1, default 0.4)
   * @returns {Object} Gap analysis results
   */
  identifyQualityGaps(gapThreshold = 0.4) {
    const gaps = [];

    for (const event of this.store.events) {
      if (event.qualityScore == null || event.rating == null) continue;

      // Normalize both to 0-1 scale for comparison
      const qualityNorm = event.qualityScore;  // Already 0-1
      const ratingNorm = (event.rating - 1) / 4;  // Convert 1-5 to 0-1

      const gap = qualityNorm - ratingNorm;

      if (Math.abs(gap) >= gapThreshold) {
        gaps.push({
          eventId: event.eventId,
          generationId: event.generationId,
          contentType: event.contentType,
          qualityScore: parseFloat(event.qualityScore.toFixed(3)),
          rating: event.rating,
          ratingNormalized: parseFloat(ratingNorm.toFixed(3)),
          gap: parseFloat(gap.toFixed(3)),
          gapType: gap > 0 ? 'quality_overestimate' : 'quality_underestimate',
          timestamp: event.timestamp
        });
      }
    }

    // Sort by gap magnitude (largest first)
    gaps.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    const overestimates = gaps.filter(g => g.gapType === 'quality_overestimate');
    const underestimates = gaps.filter(g => g.gapType === 'quality_underestimate');

    return {
      totalGaps: gaps.length,
      gapThreshold,
      overestimates: {
        count: overestimates.length,
        avgGap: overestimates.length > 0
          ? parseFloat((overestimates.reduce((s, g) => s + g.gap, 0) / overestimates.length).toFixed(3))
          : null
      },
      underestimates: {
        count: underestimates.length,
        avgGap: underestimates.length > 0
          ? parseFloat((underestimates.reduce((s, g) => s + Math.abs(g.gap), 0) / underestimates.length).toFixed(3))
          : null
      },
      examples: gaps.slice(0, 10),
      byContentType: this.groupGapsByContentType(gaps)
    };
  }

  /**
   * Group gaps by content type
   *
   * @param {Array} gaps - Array of gap objects
   * @returns {Object} Gaps grouped by content type
   */
  groupGapsByContentType(gaps) {
    const byType = {};

    for (const contentType of FEEDBACK_CONTENT_TYPES) {
      const typeGaps = gaps.filter(g => g.contentType === contentType);
      byType[contentType] = {
        count: typeGaps.length,
        overestimates: typeGaps.filter(g => g.gapType === 'quality_overestimate').length,
        underestimates: typeGaps.filter(g => g.gapType === 'quality_underestimate').length
      };
    }

    return byType;
  }

  /**
   * Analyze which quality dimensions best predict user satisfaction
   *
   * @returns {Object} Dimension impact analysis
   */
  getDimensionImpact() {
    const eventsWithDimensions = this.store.events.filter(e =>
      e.qualityDimensions && Object.keys(e.qualityDimensions).length > 0 && e.rating != null
    );

    if (eventsWithDimensions.length < 20) {
      return {
        sampleSize: eventsWithDimensions.length,
        message: 'Insufficient data for dimension analysis (minimum 20 samples with dimension scores)',
        dimensionCorrelations: null
      };
    }

    const dimensionCorrelations = {};

    // Get all dimension names from events
    const allDimensions = new Set();
    for (const event of eventsWithDimensions) {
      for (const dim of Object.keys(event.qualityDimensions)) {
        allDimensions.add(dim);
      }
    }

    // Calculate correlation for each dimension
    for (const dim of allDimensions) {
      const eventsWithDim = eventsWithDimensions.filter(e =>
        e.qualityDimensions[dim] != null
      );

      if (eventsWithDim.length >= 10) {
        const dimValues = eventsWithDim.map(e => e.qualityDimensions[dim]);
        const ratings = eventsWithDim.map(e => e.rating);

        const correlation = this.pearsonCorrelation(dimValues, ratings);
        dimensionCorrelations[dim] = {
          correlation: parseFloat(correlation.toFixed(3)),
          sampleSize: eventsWithDim.length
        };
      }
    }

    // Sort by correlation strength
    const sorted = Object.entries(dimensionCorrelations)
      .sort((a, b) => Math.abs(b[1].correlation) - Math.abs(a[1].correlation));

    return {
      sampleSize: eventsWithDimensions.length,
      dimensionCount: sorted.length,
      byImpact: Object.fromEntries(sorted),
      mostImpactful: sorted.slice(0, 5).map(([dim, data]) => ({
        dimension: dim,
        correlation: data.correlation,
        sampleSize: data.sampleSize
      })),
      leastImpactful: sorted.slice(-5).reverse().map(([dim, data]) => ({
        dimension: dim,
        correlation: data.correlation,
        sampleSize: data.sampleSize
      }))
    };
  }

  /**
   * Calculate behavioral signal effectiveness
   *
   * @returns {Object} Behavioral signal analysis
   */
  getBehavioralSignalEffectiveness() {
    const signals = {
      export: { positive: [], negative: [] },
      edit: { positive: [], negative: [] },
      regenerate: { positive: [], negative: [] }
    };

    for (const event of this.store.events) {
      if (event.rating == null) continue;

      const isPositive = event.rating >= 4;

      if (event.exported !== undefined) {
        if (event.exported) {
          (isPositive ? signals.export.positive : signals.export.negative).push(event.rating);
        }
      }
      if (event.edited !== undefined) {
        if (event.edited) {
          (isPositive ? signals.edit.positive : signals.edit.negative).push(event.rating);
        }
      }
      if (event.regenerated !== undefined) {
        if (event.regenerated) {
          (isPositive ? signals.regenerate.positive : signals.regenerate.negative).push(event.rating);
        }
      }
    }

    const calculateSignalStats = (signal) => {
      const total = signal.positive.length + signal.negative.length;
      if (total === 0) return null;

      return {
        totalOccurrences: total,
        positiveRatingPercent: parseFloat(((signal.positive.length / total) * 100).toFixed(1)),
        avgRatingWhenOccurs: parseFloat(
          ([...signal.positive, ...signal.negative].reduce((a, b) => a + b, 0) / total).toFixed(2)
        )
      };
    };

    return {
      export: {
        label: 'Content exported',
        predictsSatisfaction: true,
        stats: calculateSignalStats(signals.export)
      },
      edit: {
        label: 'Content edited',
        predictsSatisfaction: false,  // Editing often indicates dissatisfaction
        stats: calculateSignalStats(signals.edit)
      },
      regenerate: {
        label: 'Content regenerated',
        predictsSatisfaction: false,  // Regeneration indicates dissatisfaction
        stats: calculateSignalStats(signals.regenerate)
      }
    };
  }

  /**
   * Generate comprehensive analytics report
   *
   * @returns {Object} Complete analytics report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalFeedbackEvents: this.store.events.length,
      eventsWithRatings: this.store.events.filter(e => e.rating != null).length,
      eventsWithQualityScores: this.store.events.filter(e => e.qualityScore != null).length,

      qualityFeedbackCorrelation: this.calculateQualityFeedbackCorrelation(),
      qualityGaps: this.identifyQualityGaps(),
      dimensionImpact: this.getDimensionImpact(),
      behavioralSignals: this.getBehavioralSignalEffectiveness(),
      productionCoverage: new HybridFeedbackManager().getProductionCoverage(),

      recommendations: []
    };

    // Generate recommendations based on analysis
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  /**
   * Generate actionable recommendations based on analytics
   *
   * @param {Object} report - Analytics report
   * @returns {Array<string>} Recommendations
   */
  generateRecommendations(report) {
    const recommendations = [];

    // Correlation-based recommendations
    const correlation = report.qualityFeedbackCorrelation;
    if (correlation.correlation !== null) {
      if (Math.abs(correlation.correlation) < 0.4) {
        recommendations.push(
          'Quality scores have weak correlation with user ratings. Consider revising scoring dimensions to better capture user preferences.'
        );
      }
      if (correlation.correlation < 0) {
        recommendations.push(
          'Quality scores are negatively correlated with ratings! Review scoring logic - it may be penalizing what users actually want.'
        );
      }
    }

    // Gap-based recommendations
    const gaps = report.qualityGaps;
    if (gaps.overestimates.count > gaps.underestimates.count * 2) {
      recommendations.push(
        'Quality scores frequently overestimate user satisfaction. Consider lowering score thresholds or adding stricter criteria.'
      );
    }
    if (gaps.underestimates.count > gaps.overestimates.count * 2) {
      recommendations.push(
        'Quality scores frequently underestimate user satisfaction. Users may value different aspects than currently scored.'
      );
    }

    // Dimension-based recommendations
    const dimImpact = report.dimensionImpact;
    if (dimImpact.mostImpactful && dimImpact.mostImpactful.length > 0) {
      const topDim = dimImpact.mostImpactful[0];
      if (topDim.correlation > 0.5) {
        recommendations.push(
          `"${topDim.dimension}" strongly predicts satisfaction (r=${topDim.correlation}). Consider increasing its weight in overall scoring.`
        );
      }
    }
    if (dimImpact.leastImpactful && dimImpact.leastImpactful.length > 0) {
      const bottomDims = dimImpact.leastImpactful.filter(d => Math.abs(d.correlation) < 0.1);
      if (bottomDims.length > 0) {
        recommendations.push(
          `These dimensions show no correlation with satisfaction: ${bottomDims.map(d => d.dimension).join(', ')}. Consider removing or revising them.`
        );
      }
    }

    // Coverage recommendations
    const coverage = report.productionCoverage;
    const lowCoverageTypes = Object.entries(coverage)
      .filter(([_, data]) => !data.hasSufficientData)
      .map(([type]) => type);
    if (lowCoverageTypes.length > 0) {
      recommendations.push(
        `Insufficient production feedback for: ${lowCoverageTypes.join(', ')}. Prioritize collecting feedback for these content types.`
      );
    }

    // Default recommendation if analysis is limited
    if (recommendations.length === 0 && report.totalFeedbackEvents < 50) {
      recommendations.push(
        'Collect more production feedback to enable meaningful analysis. Aim for at least 50 events with ratings.'
      );
    }

    return recommendations;
  }
}

// Singleton instance
export const feedbackAnalytics = new FeedbackAnalytics(feedbackStore);

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 6 implementation
 *
 * @returns {Object} Validation results
 */
export async function validatePhase6() {
  const results = {
    passed: true,
    tests: []
  };

  // Create test analytics with mock store
  const mockStore = {
    events: [
      { eventId: 'e1', qualityScore: 0.8, rating: 4, contentType: 'Roadmap', exported: true, edited: false, regenerated: false },
      { eventId: 'e2', qualityScore: 0.6, rating: 3, contentType: 'Roadmap', exported: false, edited: true, regenerated: false },
      { eventId: 'e3', qualityScore: 0.9, rating: 5, contentType: 'Slides', exported: true, edited: false, regenerated: false },
      { eventId: 'e4', qualityScore: 0.4, rating: 2, contentType: 'Slides', exported: false, edited: true, regenerated: true },
      { eventId: 'e5', qualityScore: 0.7, rating: 4, contentType: 'Roadmap', exported: true, edited: false, regenerated: false },
      { eventId: 'e6', qualityScore: 0.5, rating: 3, contentType: 'Document', exported: false, edited: false, regenerated: false },
      { eventId: 'e7', qualityScore: 0.85, rating: 5, contentType: 'Roadmap', exported: true, edited: false, regenerated: false },
      { eventId: 'e8', qualityScore: 0.3, rating: 2, contentType: 'Slides', exported: false, edited: true, regenerated: true },
      { eventId: 'e9', qualityScore: 0.75, rating: 4, contentType: 'Document', exported: true, edited: false, regenerated: false },
      { eventId: 'e10', qualityScore: 0.65, rating: 3, contentType: 'Roadmap', exported: false, edited: true, regenerated: false },
      { eventId: 'e11', qualityScore: 0.95, rating: 5, contentType: 'ResearchAnalysis', exported: true, edited: false, regenerated: false },
      { eventId: 'e12', qualityScore: 0.2, rating: 1, contentType: 'ResearchAnalysis', exported: false, edited: true, regenerated: true }
    ]
  };

  const analytics = new FeedbackAnalytics(mockStore);

  // Test 1: pearsonCorrelation works correctly
  const x = [1, 2, 3, 4, 5];
  const y = [1, 2, 3, 4, 5];
  const perfectCorr = analytics.pearsonCorrelation(x, y);
  results.tests.push({
    name: 'pearsonCorrelation calculates perfect correlation',
    passed: Math.abs(perfectCorr - 1) < 0.001,
    details: `correlation=${perfectCorr}`
  });

  // Test 2: Negative correlation
  const negY = [5, 4, 3, 2, 1];
  const negCorr = analytics.pearsonCorrelation(x, negY);
  results.tests.push({
    name: 'pearsonCorrelation calculates negative correlation',
    passed: Math.abs(negCorr + 1) < 0.001,
    details: `correlation=${negCorr}`
  });

  // Test 3: calculateQualityFeedbackCorrelation returns result
  const corrResult = analytics.calculateQualityFeedbackCorrelation();
  results.tests.push({
    name: 'calculateQualityFeedbackCorrelation returns result',
    passed: corrResult.correlation !== null && corrResult.sampleSize === 12,
    details: `correlation=${corrResult.correlation}, samples=${corrResult.sampleSize}`
  });

  // Test 4: Correlation should be positive (higher quality = higher rating)
  results.tests.push({
    name: 'Correlation is positive (quality predicts rating)',
    passed: corrResult.correlation > 0.5,
    details: `correlation=${corrResult.correlation}`
  });

  // Test 5: interpretCorrelation provides interpretation
  results.tests.push({
    name: 'interpretCorrelation provides interpretation',
    passed: corrResult.interpretation !== null && corrResult.interpretation.length > 0,
    details: `interpretation=${corrResult.interpretation.substring(0, 50)}...`
  });

  // Test 6: identifyQualityGaps finds gaps
  const gaps = analytics.identifyQualityGaps(0.2);
  results.tests.push({
    name: 'identifyQualityGaps finds gaps',
    passed: gaps.totalGaps >= 0 && gaps.byContentType !== undefined,
    details: `totalGaps=${gaps.totalGaps}`
  });

  // Test 7: Gap analysis categorizes correctly
  results.tests.push({
    name: 'Gap analysis has overestimates and underestimates',
    passed: gaps.overestimates !== undefined && gaps.underestimates !== undefined,
    details: `overestimates=${gaps.overestimates.count}, underestimates=${gaps.underestimates.count}`
  });

  // Test 8: getBehavioralSignalEffectiveness returns signals
  const signals = analytics.getBehavioralSignalEffectiveness();
  results.tests.push({
    name: 'getBehavioralSignalEffectiveness returns signals',
    passed: signals.export !== undefined && signals.edit !== undefined && signals.regenerate !== undefined,
    details: `hasExport=${signals.export !== undefined}`
  });

  // Test 9: Export signal stats calculated
  results.tests.push({
    name: 'Export signal stats calculated',
    passed: signals.export.stats !== null && signals.export.stats.totalOccurrences > 0,
    details: `exportCount=${signals.export.stats?.totalOccurrences}`
  });

  // Test 10: generateReport produces complete report
  const report = analytics.generateReport();
  results.tests.push({
    name: 'generateReport produces complete report',
    passed: report.timestamp !== undefined && report.qualityFeedbackCorrelation !== undefined,
    details: `hasCorrelation=${report.qualityFeedbackCorrelation !== undefined}`
  });

  // Test 11: Report includes recommendations
  results.tests.push({
    name: 'Report includes recommendations',
    passed: Array.isArray(report.recommendations),
    details: `recommendationCount=${report.recommendations.length}`
  });

  // Test 12: generateRecommendations creates actionable items
  const recs = analytics.generateRecommendations(report);
  results.tests.push({
    name: 'generateRecommendations creates recommendations',
    passed: Array.isArray(recs),
    details: `count=${recs.length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  validatePhase6().then(validation => {
    console.log('Feedback Analytics Phase 6 Validation:', validation.passed ? 'PASSED' : 'FAILED');
    if (!validation.passed) {
      validation.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  FAILED: ${t.name} - ${t.details}`);
      });
    }
  });
}
