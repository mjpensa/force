/**
 * Quality Dimensions for Content-Type Scoring Parity
 *
 * This module defines quality dimensions for all content types to achieve
 * scoring parity across Roadmap, Slides, Document, and ResearchAnalysis.
 *
 * Implementation of Plan 04: Scoring Depth Parity - Phase 1
 */

// ============================================================================
// Phase 1: Quality Dimension Definitions
// ============================================================================

/**
 * Roadmap quality dimensions (11 dimensions - optimized)
 *
 * Aligned with actual Gantt chart schema structure:
 * - data.data[] with isSwimlane flags
 * - bar.startCol/endCol for temporal positions
 * - taskType: "milestone"|"decision"|"task"
 * - legend[] and researchAnalysis fields
 *
 * Consolidations made:
 * - titleQuality: merged taskTitleQuality + outcomeOrientation + namingConsistency
 * - scopeAlignment: merged swimlaneMinimum check
 *
 * New dimensions added:
 * - intervalAppropriateness: validates timeColumns format
 * - barValidity: validates bar structure and colors
 */
export const ROADMAP_DIMENSIONS = {
  // Structure dimensions
  swimlaneCompleteness: {
    description: 'Each swimlane has tasks that span the timeline columns',
    weight: 1.0,
    category: 'structure'
  },
  titleQuality: {
    description: 'Task titles are meaningful, outcome-oriented, and consistently named',
    weight: 1.0,
    category: 'structure'
  },
  temporalDistribution: {
    description: 'Tasks are distributed across timeline columns, not clustered',
    weight: 0.9,
    category: 'structure'
  },
  intervalAppropriateness: {
    description: 'Time interval (weeks/months/quarters/years) matches date span',
    weight: 0.8,
    category: 'structure'
  },

  // Content quality dimensions
  milestoneClarity: {
    description: 'Milestones are properly marked with taskType and clear titles',
    weight: 1.0,
    category: 'content'
  },
  taskTypeVariety: {
    description: 'Variety of task types including decisions when appropriate',
    weight: 0.6,
    category: 'content'
  },
  scopeAlignment: {
    description: 'At least 2 distinct swimlanes with 3+ tasks each',
    weight: 0.8,
    category: 'content'
  },

  // Validation dimensions
  barValidity: {
    description: 'Bar positions valid (startCol ≤ endCol) with valid colors',
    weight: 0.9,
    category: 'validation'
  },
  legendCoherence: {
    description: 'Legend colors match colors used in tasks',
    weight: 0.6,
    category: 'validation'
  },
  granularityBalance: {
    description: 'Task durations are balanced (not too short or long)',
    weight: 0.7,
    category: 'professional'
  },
  researchFitness: {
    description: 'Research quality score from researchAnalysis.overallScore',
    weight: 0.5,
    category: 'validation'
  }
};

/**
 * Slides quality dimensions (10 dimensions)
 */
export const SLIDES_DIMENSIONS = {
  // Structure dimensions
  narrativeFlow: {
    description: 'Slides follow logical progression (intro -> body -> conclusion)',
    weight: 1.0,
    category: 'structure'
  },
  slideContentDensity: {
    description: 'Each slide has substantive content (not too sparse/dense)',
    weight: 0.9,
    category: 'structure'
  },
  titleEffectiveness: {
    description: 'Slide titles are action-oriented or insight-driven',
    weight: 0.8,
    category: 'structure'
  },

  // Content quality dimensions
  evidenceIntegration: {
    description: 'Claims supported by data, citations, or examples',
    weight: 1.0,
    category: 'content'
  },
  audienceAlignment: {
    description: 'Language and depth appropriate for intended audience',
    weight: 0.8,
    category: 'content'
  },
  visualSuggestions: {
    description: 'Content suggests appropriate visual elements',
    weight: 0.6,
    category: 'content'
  },

  // Strategic dimensions
  keyTakeaways: {
    description: 'Clear takeaways or action items emerge',
    weight: 0.9,
    category: 'strategic'
  },
  execSummaryPresence: {
    description: 'Executive summary or key points slide included',
    weight: 0.7,
    category: 'strategic'
  },

  // Professional dimensions
  bulletPointQuality: {
    description: 'Bullets are parallel, concise, and substantive',
    weight: 0.7,
    category: 'professional'
  },
  transitionLogic: {
    description: 'Implicit transitions between slides make sense',
    weight: 0.6,
    category: 'professional'
  }
};

/**
 * Document quality dimensions (11 dimensions - existing)
 * Defined here for reference and consistency
 */
export const DOCUMENT_DIMENSIONS = {
  // Structure dimensions
  executiveSummaryHook: {
    description: 'Executive summary captures attention and frames the document',
    weight: 1.0,
    category: 'structure'
  },
  sectionOrganization: {
    description: 'Sections are logically organized and well-structured',
    weight: 0.9,
    category: 'structure'
  },

  // Content quality dimensions
  authorityMarkers: {
    description: 'Content demonstrates expertise through authoritative language',
    weight: 0.8,
    category: 'content'
  },
  forecastCitations: {
    description: 'Forward-looking statements are supported by evidence',
    weight: 0.9,
    category: 'content'
  },
  tensionMarkers: {
    description: 'Acknowledges challenges, risks, or competing viewpoints',
    weight: 0.7,
    category: 'content'
  },

  // Narrative dimensions
  temporalBridges: {
    description: 'Smooth transitions between past, present, and future',
    weight: 0.6,
    category: 'narrative'
  },
  infrastructureMetaphors: {
    description: 'Uses effective metaphors and analogies',
    weight: 0.5,
    category: 'narrative'
  },

  // Evidence dimensions
  quantificationDensity: {
    description: 'Appropriate use of numbers, metrics, and data',
    weight: 0.9,
    category: 'evidence'
  },
  sourceVariety: {
    description: 'Multiple source types referenced',
    weight: 0.7,
    category: 'evidence'
  },

  // Strategic dimensions
  actionableRecommendations: {
    description: 'Clear, specific recommendations for action',
    weight: 1.0,
    category: 'strategic'
  },
  audienceAwareness: {
    description: 'Tone and depth appropriate for target audience',
    weight: 0.8,
    category: 'strategic'
  }
};

/**
 * ResearchAnalysis quality dimensions (10 dimensions)
 */
export const RESEARCH_ANALYSIS_DIMENSIONS = {
  // Structure dimensions
  themeCoherence: {
    description: 'Themes are distinct and mutually exclusive',
    weight: 0.9,
    category: 'structure'
  },
  evidenceDepth: {
    description: 'Each theme has multiple supporting evidence points',
    weight: 1.0,
    category: 'structure'
  },
  insightNovelty: {
    description: 'Insights go beyond obvious observations',
    weight: 0.9,
    category: 'structure'
  },

  // Content quality dimensions
  sourceVariety: {
    description: 'Evidence draws from multiple source types',
    weight: 0.8,
    category: 'content'
  },
  quantificationLevel: {
    description: 'Analysis includes specific numbers and metrics',
    weight: 0.8,
    category: 'content'
  },
  counterargumentAwareness: {
    description: 'Acknowledges limitations or alternative views',
    weight: 0.7,
    category: 'content'
  },

  // Strategic dimensions
  actionabilityScore: {
    description: 'Recommendations are specific and actionable',
    weight: 1.0,
    category: 'strategic'
  },
  prioritization: {
    description: 'Themes/recommendations are prioritized or ranked',
    weight: 0.7,
    category: 'strategic'
  },

  // Professional dimensions
  synthesisQuality: {
    description: 'Summary synthesizes themes into coherent narrative',
    weight: 0.8,
    category: 'professional'
  },
  temporalAwareness: {
    description: 'Analysis considers timing and trends',
    weight: 0.6,
    category: 'professional'
  }
};

/**
 * All dimensions by content type
 */
export const ALL_DIMENSIONS = {
  Roadmap: ROADMAP_DIMENSIONS,
  Slides: SLIDES_DIMENSIONS,
  Document: DOCUMENT_DIMENSIONS,
  ResearchAnalysis: RESEARCH_ANALYSIS_DIMENSIONS
};

/**
 * Get dimensions for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Object} Dimensions object
 */
export function getDimensions(contentType) {
  return ALL_DIMENSIONS[contentType] || {};
}

/**
 * Get dimension names for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Array<string>} Dimension names
 */
export function getDimensionNames(contentType) {
  const dims = ALL_DIMENSIONS[contentType];
  return dims ? Object.keys(dims) : [];
}

/**
 * Get dimension count for a content type
 *
 * @param {string} contentType - Content type
 * @returns {number} Number of dimensions
 */
export function getDimensionCount(contentType) {
  return getDimensionNames(contentType).length;
}

/**
 * Get total weight for a content type
 *
 * @param {string} contentType - Content type
 * @returns {number} Sum of all dimension weights
 */
export function getTotalWeight(contentType) {
  const dims = ALL_DIMENSIONS[contentType];
  if (!dims) return 0;

  return Object.values(dims).reduce((sum, d) => sum + (d.weight || 1.0), 0);
}

/**
 * Get dimensions by category for a content type
 *
 * @param {string} contentType - Content type
 * @param {string} category - Category to filter by
 * @returns {Object} Filtered dimensions
 */
export function getDimensionsByCategory(contentType, category) {
  const dims = ALL_DIMENSIONS[contentType];
  if (!dims) return {};

  const result = {};
  for (const [name, dim] of Object.entries(dims)) {
    if (dim.category === category) {
      result[name] = dim;
    }
  }
  return result;
}

/**
 * Get all categories used in dimensions for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Array<string>} Unique categories
 */
export function getCategories(contentType) {
  const dims = ALL_DIMENSIONS[contentType];
  if (!dims) return [];

  const categories = new Set();
  for (const dim of Object.values(dims)) {
    if (dim.category) {
      categories.add(dim.category);
    }
  }
  return Array.from(categories);
}

/**
 * Calculate weighted average from dimension scores
 *
 * @param {Object} scores - Dimension name -> score (0-1)
 * @param {Object} dimensions - Dimension definitions with weights
 * @returns {Object} { overall, dimensions, feedback }
 */
export function calculateWeightedScore(scores, dimensions) {
  let totalWeight = 0;
  let weightedSum = 0;
  const feedback = [];

  for (const [dimName, score] of Object.entries(scores)) {
    const dim = dimensions[dimName];
    const weight = dim?.weight || 1.0;

    weightedSum += score * weight;
    totalWeight += weight;

    // Generate feedback for low scores
    if (score < 0.5 && dim) {
      feedback.push({
        dimension: dimName,
        score,
        description: dim.description,
        category: dim.category
      });
    }
  }

  return {
    overall: totalWeight > 0 ? weightedSum / totalWeight : 0,
    dimensions: scores,
    feedback
  };
}

/**
 * Validate dimension structure
 *
 * @param {Object} dimensions - Dimension definitions
 * @returns {Object} Validation result
 */
export function validateDimensionStructure(dimensions) {
  const issues = [];

  for (const [name, dim] of Object.entries(dimensions)) {
    if (!dim.description) {
      issues.push(`${name}: missing description`);
    }
    if (typeof dim.weight !== 'number' || dim.weight < 0 || dim.weight > 2) {
      issues.push(`${name}: invalid weight (${dim.weight})`);
    }
    if (!dim.category) {
      issues.push(`${name}: missing category`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    dimensionCount: Object.keys(dimensions).length
  };
}

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

  const contentTypes = ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];

  // Test 1: All content types have dimensions
  const allHaveDimensions = contentTypes.every(ct => getDimensionCount(ct) > 0);
  results.tests.push({
    name: 'All content types have dimensions',
    passed: allHaveDimensions,
    details: `counts=${contentTypes.map(ct => `${ct}:${getDimensionCount(ct)}`).join(', ')}`
  });

  // Test 2: Each content type has 8-14 dimensions (target parity)
  const allHaveEnoughDimensions = contentTypes.every(ct => {
    const count = getDimensionCount(ct);
    return count >= 8 && count <= 14;
  });
  results.tests.push({
    name: 'Each type has 8-14 dimensions',
    passed: allHaveEnoughDimensions,
    details: `counts=${contentTypes.map(ct => getDimensionCount(ct)).join(', ')}`
  });

  // Test 3: All dimensions have valid structure
  let allValid = true;
  for (const ct of contentTypes) {
    const validation = validateDimensionStructure(getDimensions(ct));
    if (!validation.valid) {
      allValid = false;
    }
  }
  results.tests.push({
    name: 'All dimensions have valid structure',
    passed: allValid,
    details: `valid=${allValid}`
  });

  // Test 4: Weights are reasonable (total 5-15 per type)
  const weightsReasonable = contentTypes.every(ct => {
    const total = getTotalWeight(ct);
    return total >= 5 && total <= 15;
  });
  results.tests.push({
    name: 'Weights are reasonable (5-15 total)',
    passed: weightsReasonable,
    details: `weights=${contentTypes.map(ct => `${ct}:${getTotalWeight(ct).toFixed(1)}`).join(', ')}`
  });

  // Test 5: Each content type has multiple categories
  const hasCategories = contentTypes.every(ct => getCategories(ct).length >= 2);
  results.tests.push({
    name: 'Each type has multiple categories',
    passed: hasCategories,
    details: `categories=${contentTypes.map(ct => `${ct}:${getCategories(ct).length}`).join(', ')}`
  });

  // Test 6: getDimensions returns correct type
  const roadmapDims = getDimensions('Roadmap');
  results.tests.push({
    name: 'getDimensions returns object',
    passed: typeof roadmapDims === 'object' && roadmapDims.swimlaneCompleteness !== undefined,
    details: `hasSwimlaneDim=${!!roadmapDims.swimlaneCompleteness}`
  });

  // Test 7: getDimensionsByCategory works
  const structureDims = getDimensionsByCategory('Roadmap', 'structure');
  results.tests.push({
    name: 'getDimensionsByCategory works',
    passed: Object.keys(structureDims).length > 0,
    details: `structureDims=${Object.keys(structureDims).length}`
  });

  // Test 8: calculateWeightedScore works
  const testScores = { swimlaneCompleteness: 0.8, titleQuality: 0.6 };
  const result = calculateWeightedScore(testScores, ROADMAP_DIMENSIONS);
  results.tests.push({
    name: 'calculateWeightedScore works',
    passed: result.overall > 0 && result.overall <= 1,
    details: `overall=${result.overall.toFixed(3)}`
  });

  // Test 9: Invalid content type returns empty
  const invalidDims = getDimensions('InvalidType');
  results.tests.push({
    name: 'Invalid type returns empty',
    passed: Object.keys(invalidDims).length === 0,
    details: `keys=${Object.keys(invalidDims).length}`
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
  console.log('Quality Dimensions Phase 1 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
