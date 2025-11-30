/**
 * Unified Content Quality Scoring Interface
 *
 * Provides a unified interface for scoring all content types with
 * consistent API and error handling.
 *
 * Implementation of Plan 04: Scoring Depth Parity - Phase 5
 */

import { scoreRoadmapQuality } from './roadmapScoring.js';
import { scoreSlidesQuality } from './slidesScoring.js';
import { scoreResearchAnalysisQuality } from './researchAnalysisScoring.js';
import {
  ALL_DIMENSIONS,
  getDimensions,
  getDimensionCount,
  getTotalWeight,
  getCategories,
  calculateWeightedScore
} from './qualityDimensions.js';

// ============================================================================
// Phase 5: Unified Scoring Interface
// ============================================================================

/**
 * Supported content types
 */
export const CONTENT_TYPES = ['Document', 'Roadmap', 'Slides', 'ResearchAnalysis'];

/**
 * Scoring functions by content type
 */
const SCORING_FUNCTIONS = {
  Roadmap: scoreRoadmapQuality,
  Slides: scoreSlidesQuality,
  ResearchAnalysis: scoreResearchAnalysisQuality,
  // Document scoring exists elsewhere - placeholder for integration
  Document: scoreDocumentQuality
};

/**
 * Score content quality for any content type
 *
 * @param {Object} data - Content data structure
 * @param {string} contentType - Content type (Document, Roadmap, Slides, ResearchAnalysis)
 * @returns {Object} { overall, dimensions, feedback, contentType, error? }
 */
export function scoreContentQuality(data, contentType) {
  // Validate content type
  if (!CONTENT_TYPES.includes(contentType)) {
    console.warn(`Unknown content type: ${contentType}`);
    return {
      overall: 0,
      dimensions: {},
      feedback: [],
      contentType,
      error: `Unknown content type: ${contentType}`
    };
  }

  const scoringFn = SCORING_FUNCTIONS[contentType];

  if (!scoringFn) {
    console.warn(`No scoring function for content type: ${contentType}`);
    return {
      overall: 0.5,
      dimensions: {},
      feedback: [],
      contentType,
      error: `No scoring function available for ${contentType}`
    };
  }

  try {
    const result = scoringFn(data);
    return {
      ...result,
      contentType
    };
  } catch (error) {
    console.error(`Scoring error for ${contentType}:`, error);
    return {
      overall: 0,
      dimensions: {},
      feedback: [],
      contentType,
      error: error.message
    };
  }
}

/**
 * Placeholder Document scoring function
 * This integrates with existing document scoring or provides basic scoring
 *
 * @param {Object} data - Document data
 * @returns {Object} Scoring result
 */
function scoreDocumentQuality(data) {
  // If no data, return zero
  if (!data || typeof data !== 'object') {
    return {
      overall: 0,
      dimensions: {},
      feedback: [{ dimension: 'data', score: 0, description: 'No data provided' }]
    };
  }

  // Basic structure check
  const hasContent = data.sections?.length > 0 ||
    data.content ||
    data.body ||
    data.executiveSummary;

  if (!hasContent) {
    return {
      overall: 0,
      dimensions: {},
      feedback: [{ dimension: 'structure', score: 0, description: 'No document content' }]
    };
  }

  // Basic dimension scoring for Document type
  // This can be replaced with more sophisticated scoring
  const scores = {};
  const content = extractDocumentContent(data);

  // Executive Summary Hook
  scores.executiveSummaryHook = data.executiveSummary ? 0.8 : 0.3;

  // Section Organization
  scores.sectionOrganization = data.sections?.length >= 3 ? 0.8 : 0.5;

  // Authority Markers
  scores.authorityMarkers = /expert|research|study|analysis|data shows/i.test(content) ? 0.7 : 0.4;

  // Forecast Citations
  scores.forecastCitations = /forecast|project|predict|estimate|expect/i.test(content) ? 0.6 : 0.3;

  // Tension Markers
  scores.tensionMarkers = /however|challenge|risk|concern|despite/i.test(content) ? 0.7 : 0.3;

  // Temporal Bridges
  scores.temporalBridges = /previously|currently|going forward|in the future/i.test(content) ? 0.6 : 0.3;

  // Infrastructure Metaphors
  scores.infrastructureMetaphors = /foundation|pillar|framework|platform|ecosystem/i.test(content) ? 0.5 : 0.3;

  // Quantification Density
  const numbers = content.match(/\d+%|\$[\d,]+|\d+\s*(million|billion)/gi) || [];
  scores.quantificationDensity = Math.min(1, numbers.length / 5);

  // Source Variety
  scores.sourceVariety = /source|according to|study|report|gartner|forrester/i.test(content) ? 0.6 : 0.3;

  // Actionable Recommendations
  scores.actionableRecommendations = /recommend|should|action|implement|strategy/i.test(content) ? 0.6 : 0.3;

  // Audience Awareness
  scores.audienceAwareness = 0.5;  // Neutral without more context

  return calculateWeightedScore(scores, ALL_DIMENSIONS.Document);
}

/**
 * Extract all text content from a document
 *
 * @param {Object} data - Document data
 * @returns {string} Combined content
 */
function extractDocumentContent(data) {
  const parts = [];

  if (data.executiveSummary) parts.push(data.executiveSummary);
  if (data.content) parts.push(data.content);
  if (data.body) parts.push(data.body);

  if (data.sections) {
    for (const section of data.sections) {
      if (section.title) parts.push(section.title);
      if (section.content) parts.push(section.content);
      if (section.body) parts.push(section.body);
    }
  }

  return parts.join(' ');
}

/**
 * Get dimensions for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Object} Dimension definitions
 */
export function getContentTypeDimensions(contentType) {
  return getDimensions(contentType);
}

/**
 * Get scoring summary for all content types
 *
 * @returns {Object} Summary of scoring capabilities
 */
export function getScoringCapabilities() {
  const capabilities = {};

  for (const contentType of CONTENT_TYPES) {
    capabilities[contentType] = {
      dimensionCount: getDimensionCount(contentType),
      totalWeight: getTotalWeight(contentType),
      categories: getCategories(contentType),
      hasScoringFunction: !!SCORING_FUNCTIONS[contentType]
    };
  }

  return capabilities;
}

/**
 * Score multiple content items in batch
 *
 * @param {Array<{data: Object, contentType: string}>} items - Items to score
 * @returns {Array<Object>} Scoring results
 */
export function scoreContentBatch(items) {
  return items.map(({ data, contentType }) => ({
    ...scoreContentQuality(data, contentType),
    contentType
  }));
}

/**
 * Compare scores across content types
 *
 * @param {Object} results - Scoring results keyed by content type
 * @returns {Object} Comparison analysis
 */
export function compareScores(results) {
  const analysis = {
    scores: {},
    averageScore: 0,
    lowestScore: { contentType: null, score: 1 },
    highestScore: { contentType: null, score: 0 },
    parityAchieved: true
  };

  let totalScore = 0;
  let count = 0;

  for (const [contentType, result] of Object.entries(results)) {
    const score = result.overall || 0;
    analysis.scores[contentType] = score;
    totalScore += score;
    count++;

    if (score < analysis.lowestScore.score) {
      analysis.lowestScore = { contentType, score };
    }
    if (score > analysis.highestScore.score) {
      analysis.highestScore = { contentType, score };
    }
  }

  analysis.averageScore = count > 0 ? totalScore / count : 0;

  // Check parity: no type should be > 0.3 above or below average
  for (const [contentType, score] of Object.entries(analysis.scores)) {
    if (Math.abs(score - analysis.averageScore) > 0.3) {
      analysis.parityAchieved = false;
    }
  }

  return analysis;
}

/**
 * Get feedback summary across all dimensions
 *
 * @param {Object} result - Scoring result
 * @returns {Object} Categorized feedback
 */
export function getFeedbackSummary(result) {
  const summary = {
    strengths: [],
    improvements: [],
    critical: []
  };

  if (!result.dimensions) return summary;

  const dimensions = getContentTypeDimensions(result.contentType);

  for (const [dimName, score] of Object.entries(result.dimensions)) {
    const dim = dimensions[dimName];
    const entry = {
      dimension: dimName,
      score,
      description: dim?.description || dimName,
      category: dim?.category
    };

    if (score >= 0.7) {
      summary.strengths.push(entry);
    } else if (score >= 0.4) {
      summary.improvements.push(entry);
    } else {
      summary.critical.push(entry);
    }
  }

  // Sort by score within each category
  summary.strengths.sort((a, b) => b.score - a.score);
  summary.improvements.sort((a, b) => a.score - b.score);
  summary.critical.sort((a, b) => a.score - b.score);

  return summary;
}

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

  // Test 1: All content types have scoring functions
  const allHaveFunctions = CONTENT_TYPES.every(ct => SCORING_FUNCTIONS[ct]);
  results.tests.push({
    name: 'All content types have scoring functions',
    passed: allHaveFunctions,
    details: `types=${CONTENT_TYPES.length}, withFunctions=${Object.keys(SCORING_FUNCTIONS).length}`
  });

  // Test 2: scoreContentQuality works for each type
  const testData = { swimlanes: [{ name: 'Test', tasks: [] }] };
  const roadmapResult = scoreContentQuality(testData, 'Roadmap');
  results.tests.push({
    name: 'scoreContentQuality works for Roadmap',
    passed: roadmapResult.contentType === 'Roadmap' && typeof roadmapResult.overall === 'number',
    details: `overall=${roadmapResult.overall}`
  });

  // Test 3: scoreContentQuality handles unknown type
  const unknownResult = scoreContentQuality({}, 'UnknownType');
  results.tests.push({
    name: 'Handles unknown content type',
    passed: unknownResult.error !== undefined,
    details: `error=${unknownResult.error}`
  });

  // Test 4: getContentTypeDimensions works
  const roadmapDims = getContentTypeDimensions('Roadmap');
  results.tests.push({
    name: 'getContentTypeDimensions works',
    passed: Object.keys(roadmapDims).length >= 8,
    details: `dimensions=${Object.keys(roadmapDims).length}`
  });

  // Test 5: getScoringCapabilities works
  const capabilities = getScoringCapabilities();
  results.tests.push({
    name: 'getScoringCapabilities works',
    passed: Object.keys(capabilities).length === 4,
    details: `types=${Object.keys(capabilities).length}`
  });

  // Test 6: scoreContentBatch works
  const batchItems = [
    { data: { slides: [{ title: 'Test' }] }, contentType: 'Slides' },
    { data: { themes: [{ name: 'Test' }] }, contentType: 'ResearchAnalysis' }
  ];
  const batchResults = scoreContentBatch(batchItems);
  results.tests.push({
    name: 'scoreContentBatch works',
    passed: batchResults.length === 2 && batchResults.every(r => r.contentType),
    details: `results=${batchResults.length}`
  });

  // Test 7: compareScores works
  const mockResults = {
    Roadmap: { overall: 0.6 },
    Slides: { overall: 0.7 },
    Document: { overall: 0.65 },
    ResearchAnalysis: { overall: 0.68 }
  };
  const comparison = compareScores(mockResults);
  results.tests.push({
    name: 'compareScores works',
    passed: comparison.averageScore > 0 && comparison.parityAchieved !== undefined,
    details: `avgScore=${comparison.averageScore.toFixed(3)}, parity=${comparison.parityAchieved}`
  });

  // Test 8: getFeedbackSummary works
  const mockResult = {
    contentType: 'Roadmap',
    dimensions: {
      swimlaneCompleteness: 0.8,
      taskDescriptionQuality: 0.3,
      temporalDistribution: 0.5
    }
  };
  const feedback = getFeedbackSummary(mockResult);
  results.tests.push({
    name: 'getFeedbackSummary works',
    passed: feedback.strengths.length > 0 && feedback.critical.length > 0,
    details: `strengths=${feedback.strengths.length}, critical=${feedback.critical.length}`
  });

  // Test 9: Document scoring works
  const docResult = scoreContentQuality({ executiveSummary: 'Test summary', sections: [] }, 'Document');
  results.tests.push({
    name: 'Document scoring works',
    passed: typeof docResult.overall === 'number' && docResult.contentType === 'Document',
    details: `overall=${docResult.overall.toFixed(3)}`
  });

  // Test 10: Error handling in scoreContentQuality
  const errorResult = scoreContentQuality(null, 'Roadmap');
  results.tests.push({
    name: 'Error handling works',
    passed: errorResult.overall === 0 && errorResult.feedback !== undefined,
    details: `overall=${errorResult.overall}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// Re-export key functions from qualityDimensions
export { getDimensions, getDimensionCount, getTotalWeight, getCategories, calculateWeightedScore };

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase5();
  console.log('Unified Scoring Phase 5 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
