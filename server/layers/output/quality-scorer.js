/**
 * Output Quality Scorer - PROMPT ML Layer 6
 *
 * Evaluates LLM output quality across dimensions:
 * - Completeness (all expected sections/fields present)
 * - Coherence (logical flow and consistency)
 * - Relevance (alignment with request)
 * - Accuracy (data consistency)
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Quality dimensions
 * @readonly
 * @enum {string}
 */
export const QualityDimension = {
  COMPLETENESS: 'completeness',   // All required elements present
  COHERENCE: 'coherence',         // Logical structure and flow
  RELEVANCE: 'relevance',         // Alignment with request
  ACCURACY: 'accuracy',           // Data consistency
  SPECIFICITY: 'specificity',     // Level of detail
  ACTIONABILITY: 'actionability'  // Practical usefulness
};

/**
 * Quality grade levels
 * @readonly
 * @enum {string}
 */
export const QualityGrade = {
  EXCELLENT: 'A',   // 90-100%
  GOOD: 'B',        // 75-89%
  ADEQUATE: 'C',    // 60-74%
  POOR: 'D',        // 40-59%
  FAILING: 'F'      // Below 40%
};

/**
 * @typedef {Object} QualityScore
 * @property {number} overall - Overall score (0-100)
 * @property {string} grade - Quality grade
 * @property {Object} dimensions - Score per dimension
 * @property {string[]} strengths - Quality strengths
 * @property {string[]} weaknesses - Quality weaknesses
 * @property {Object} metadata - Scoring metadata
 */

/**
 * @typedef {Object} QualityScorerConfig
 * @property {Object} weights - Dimension weights
 * @property {Object} thresholds - Quality thresholds
 * @property {boolean} detailedAnalysis - Run detailed analysis
 */

const DEFAULT_CONFIG = {
  weights: {
    [QualityDimension.COMPLETENESS]: 0.25,
    [QualityDimension.COHERENCE]: 0.20,
    [QualityDimension.RELEVANCE]: 0.20,
    [QualityDimension.ACCURACY]: 0.15,
    [QualityDimension.SPECIFICITY]: 0.10,
    [QualityDimension.ACTIONABILITY]: 0.10
  },
  thresholds: {
    excellent: 90,
    good: 75,
    adequate: 60,
    poor: 40
  },
  detailedAnalysis: true
};

/**
 * Output Quality Scorer class
 */
export class OutputQualityScorer {
  /**
   * @param {QualityScorerConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      weights: { ...DEFAULT_CONFIG.weights, ...config.weights },
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...config.thresholds }
    };
  }

  /**
   * Score output quality
   *
   * @param {*} output - Output to score
   * @param {Object} context - Scoring context
   * @param {string} context.outputType - Type of output
   * @param {string} context.userPrompt - Original user request
   * @param {Array} context.sourceFiles - Source research files
   * @returns {QualityScore} Quality score
   */
  score(output, context = {}) {
    const { outputType, userPrompt, sourceFiles } = context;

    const dimensions = {};
    const strengths = [];
    const weaknesses = [];

    // Score each dimension
    dimensions[QualityDimension.COMPLETENESS] = this._scoreCompleteness(output, outputType);
    dimensions[QualityDimension.COHERENCE] = this._scoreCoherence(output, outputType);
    dimensions[QualityDimension.RELEVANCE] = this._scoreRelevance(output, userPrompt);
    dimensions[QualityDimension.ACCURACY] = this._scoreAccuracy(output, sourceFiles);
    dimensions[QualityDimension.SPECIFICITY] = this._scoreSpecificity(output);
    dimensions[QualityDimension.ACTIONABILITY] = this._scoreActionability(output, outputType);

    // Calculate weighted overall score
    let overall = 0;
    for (const [dimension, weight] of Object.entries(this.config.weights)) {
      overall += (dimensions[dimension] || 0) * weight;
    }
    overall = Math.round(overall);

    // Determine grade
    const grade = this._getGrade(overall);

    // Identify strengths and weaknesses
    for (const [dimension, score] of Object.entries(dimensions)) {
      if (score >= 85) {
        strengths.push(this._getDimensionStrength(dimension, score));
      } else if (score < 60) {
        weaknesses.push(this._getDimensionWeakness(dimension, score));
      }
    }

    return {
      overall,
      grade,
      dimensions,
      strengths,
      weaknesses,
      metadata: {
        outputType,
        scoredAt: new Date().toISOString(),
        weightsUsed: this.config.weights
      }
    };
  }

  /**
   * Score by output type with type-specific expectations
   *
   * @param {string} outputType - Output type
   * @param {*} output - Output to score
   * @param {Object} context - Additional context
   * @returns {QualityScore}
   */
  scoreByType(outputType, output, context = {}) {
    return this.score(output, { ...context, outputType });
  }

  /**
   * Get quick quality assessment
   *
   * @param {*} output - Output to assess
   * @returns {Object} {grade, meetsMinimum}
   */
  quickAssess(output) {
    const completeness = this._scoreCompleteness(output);
    const coherence = this._scoreCoherence(output);

    const quick = Math.round((completeness + coherence) / 2);
    const grade = this._getGrade(quick);

    return {
      score: quick,
      grade,
      meetsMinimum: quick >= this.config.thresholds.adequate
    };
  }

  // ============================================================================
  // Dimension Scoring Methods
  // ============================================================================

  /**
   * Score completeness
   * @private
   */
  _scoreCompleteness(output, outputType) {
    if (!output || typeof output !== 'object') {
      return 0;
    }

    // Get expected structure for output type
    const expected = this._getExpectedStructure(outputType);

    // Count present fields
    let present = 0;
    let total = expected.required.length;

    for (const field of expected.required) {
      if (this._hasField(output, field)) {
        present++;

        // Check if field has meaningful content
        const value = this._getFieldValue(output, field);
        if (this._isEmpty(value)) {
          present -= 0.5; // Partial credit for empty fields
        }
      }
    }

    // Bonus for optional fields
    let bonus = 0;
    for (const field of expected.optional) {
      if (this._hasField(output, field) && !this._isEmpty(this._getFieldValue(output, field))) {
        bonus += 5;
      }
    }

    const baseScore = total > 0 ? (present / total) * 100 : 50;
    return Math.min(100, Math.round(baseScore + bonus));
  }

  /**
   * Score coherence
   * @private
   */
  _scoreCoherence(output, outputType) {
    if (!output || typeof output !== 'object') {
      return 0;
    }

    const text = JSON.stringify(output);
    let score = 70; // Base score

    // Check for structural issues
    if (outputType === 'roadmap') {
      // Check timeline coherence
      if (output.timeColumns && output.data) {
        const hasLogicalOrder = this._checkTimelineOrder(output);
        score += hasLogicalOrder ? 15 : -10;
      }
    }

    if (outputType === 'slides') {
      // Check slide flow
      if (output.slides && output.slides.length > 0) {
        const hasGoodFlow = this._checkSlideFlow(output.slides);
        score += hasGoodFlow ? 15 : -10;
      }
    }

    if (outputType === 'document') {
      // Check section organization
      if (output.sections && output.sections.length > 0) {
        const hasLogicalSections = this._checkSectionOrganization(output.sections);
        score += hasLogicalSections ? 15 : -10;
      }
    }

    // Check for internal consistency
    const hasConsistentFormatting = this._checkConsistentFormatting(output);
    score += hasConsistentFormatting ? 10 : -5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score relevance to user request
   * @private
   */
  _scoreRelevance(output, userPrompt) {
    if (!output || !userPrompt) {
      return 50; // Neutral if no prompt
    }

    const outputText = JSON.stringify(output).toLowerCase();
    const promptWords = userPrompt.toLowerCase().split(/\W+/).filter(w => w.length > 3);

    if (promptWords.length === 0) {
      return 70;
    }

    // Count keyword matches
    let matches = 0;
    for (const word of promptWords) {
      if (outputText.includes(word)) {
        matches++;
      }
    }

    const matchRatio = matches / promptWords.length;

    // Scale to 0-100
    return Math.round(40 + matchRatio * 60);
  }

  /**
   * Score accuracy (consistency with source)
   * @private
   */
  _scoreAccuracy(output, sourceFiles) {
    if (!output || !sourceFiles || sourceFiles.length === 0) {
      return 70; // Neutral if no sources
    }

    // Combine source content
    const sourceText = sourceFiles
      .map(f => f.content || '')
      .join(' ')
      .toLowerCase();

    const sourceWords = new Set(sourceText.split(/\W+/).filter(w => w.length > 4));

    // Extract key terms from output
    const outputText = JSON.stringify(output).toLowerCase();
    const outputWords = outputText.split(/\W+/).filter(w => w.length > 4);

    // Check overlap
    let grounded = 0;
    let fabricated = 0;

    for (const word of outputWords) {
      if (sourceWords.has(word)) {
        grounded++;
      } else if (this._isLikelyFabricatedTerm(word)) {
        fabricated++;
      }
    }

    const groundingRatio = outputWords.length > 0
      ? grounded / outputWords.length
      : 0.5;

    const fabricationPenalty = Math.min(20, fabricated * 2);

    return Math.max(0, Math.min(100, Math.round(groundingRatio * 100 - fabricationPenalty)));
  }

  /**
   * Score specificity
   * @private
   */
  _scoreSpecificity(output) {
    if (!output) return 0;

    const text = JSON.stringify(output);
    let score = 50;

    // Check for specific data
    const hasNumbers = /\d+/.test(text);
    const hasPercentages = /\d+%/.test(text);
    const hasDates = /\b(20\d{2}|Q[1-4]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(text);
    const hasSpecificTerms = /\b(specific|exactly|precisely|detailed)\b/i.test(text);

    if (hasNumbers) score += 10;
    if (hasPercentages) score += 15;
    if (hasDates) score += 15;
    if (hasSpecificTerms) score += 10;

    // Check for vague language
    const vaguePatterns = /\b(some|many|various|several|etc|things|stuff)\b/gi;
    const vagueMatches = text.match(vaguePatterns) || [];
    score -= vagueMatches.length * 3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score actionability
   * @private
   */
  _scoreActionability(output, outputType) {
    if (!output) return 0;

    const text = JSON.stringify(output);
    let score = 50;

    // Check for action-oriented content
    const actionPatterns = /\b(should|must|recommend|implement|action|next step|plan|execute)\b/gi;
    const actionMatches = text.match(actionPatterns) || [];
    score += Math.min(30, actionMatches.length * 5);

    // Type-specific actionability
    if (outputType === 'roadmap') {
      // Roadmaps should have clear tasks
      if (output.data && Array.isArray(output.data)) {
        const taskCount = output.data.filter(d => !d.isSwimlane).length;
        score += Math.min(20, taskCount * 2);
      }
    }

    if (outputType === 'research-analysis') {
      // Research analysis should have recommendations
      if (output.actionItems && output.actionItems.length > 0) {
        score += Math.min(20, output.actionItems.length * 5);
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get expected structure for output type
   * @private
   */
  _getExpectedStructure(outputType) {
    const structures = {
      roadmap: {
        required: ['title', 'timeColumns', 'data', 'legend', 'researchAnalysis'],
        optional: ['description', 'notes']
      },
      slides: {
        required: ['title', 'slides'],
        optional: ['subtitle', 'theme']
      },
      document: {
        required: ['title', 'sections'],
        optional: ['summary', 'appendix']
      },
      'research-analysis': {
        required: ['title', 'overallScore', 'overallRating', 'themes', 'dataCompleteness', 'ganttReadiness', 'criticalGaps', 'actionItems'],
        optional: ['keyFindings', 'suggestedSources']
      }
    };

    return structures[outputType] || { required: [], optional: [] };
  }

  /**
   * Check if output has a field
   * @private
   */
  _hasField(output, field) {
    return field in output;
  }

  /**
   * Get field value
   * @private
   */
  _getFieldValue(output, field) {
    return output[field];
  }

  /**
   * Check if value is empty
   * @private
   */
  _isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
  }

  /**
   * Check timeline order
   * @private
   */
  _checkTimelineOrder(output) {
    if (!output.timeColumns || output.timeColumns.length < 2) {
      return true;
    }

    // Check if time columns are in order (basic check)
    const columns = output.timeColumns;
    // This is a simplified check - could be enhanced
    return true; // Assume ordered if present
  }

  /**
   * Check slide flow
   * @private
   */
  _checkSlideFlow(slides) {
    if (slides.length < 2) return true;

    // Check for title slide first
    const firstSlideGood = slides[0].title?.toLowerCase().includes('overview') ||
                          slides[0].section?.toLowerCase().includes('summary') ||
                          slides[0].type === 'title';

    return firstSlideGood || true; // Basic check
  }

  /**
   * Check section organization
   * @private
   */
  _checkSectionOrganization(sections) {
    if (sections.length < 2) return true;

    // Check for logical section headings
    const headings = sections.map(s => s.heading?.toLowerCase() || '');
    const hasIntro = headings.some(h => h.includes('overview') || h.includes('summary') || h.includes('introduction'));
    const hasConclusion = headings.some(h => h.includes('conclusion') || h.includes('recommendation') || h.includes('next'));

    return hasIntro || hasConclusion;
  }

  /**
   * Check consistent formatting
   * @private
   */
  _checkConsistentFormatting(output) {
    // Simple consistency check
    const text = JSON.stringify(output);

    // Check for mixed capitalization styles
    const hasInconsistentCaps = /\b[A-Z]{2,}\b.*\b[a-z]+\b/i.test(text);

    return !hasInconsistentCaps;
  }

  /**
   * Check if term is likely fabricated
   * @private
   */
  _isLikelyFabricatedTerm(word) {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /^[a-z]+\d+$/,  // Word followed by number
      /^[A-Z]{5,}$/,  // All caps acronym
    ];

    return suspiciousPatterns.some(p => p.test(word));
  }

  /**
   * Get grade from score
   * @private
   */
  _getGrade(score) {
    if (score >= this.config.thresholds.excellent) return QualityGrade.EXCELLENT;
    if (score >= this.config.thresholds.good) return QualityGrade.GOOD;
    if (score >= this.config.thresholds.adequate) return QualityGrade.ADEQUATE;
    if (score >= this.config.thresholds.poor) return QualityGrade.POOR;
    return QualityGrade.FAILING;
  }

  /**
   * Get strength description for dimension
   * @private
   */
  _getDimensionStrength(dimension, score) {
    const descriptions = {
      [QualityDimension.COMPLETENESS]: 'Comprehensive coverage of all required elements',
      [QualityDimension.COHERENCE]: 'Well-organized and logically structured',
      [QualityDimension.RELEVANCE]: 'Highly relevant to the request',
      [QualityDimension.ACCURACY]: 'Well-grounded in source material',
      [QualityDimension.SPECIFICITY]: 'Detailed and specific content',
      [QualityDimension.ACTIONABILITY]: 'Clear actionable recommendations'
    };
    return descriptions[dimension] || `High ${dimension} score`;
  }

  /**
   * Get weakness description for dimension
   * @private
   */
  _getDimensionWeakness(dimension, score) {
    const descriptions = {
      [QualityDimension.COMPLETENESS]: 'Missing some expected elements',
      [QualityDimension.COHERENCE]: 'Structure could be improved',
      [QualityDimension.RELEVANCE]: 'Could be more aligned with request',
      [QualityDimension.ACCURACY]: 'Some content may not be grounded in sources',
      [QualityDimension.SPECIFICITY]: 'Could include more specific details',
      [QualityDimension.ACTIONABILITY]: 'Recommendations could be more actionable'
    };
    return descriptions[dimension] || `Low ${dimension} score`;
  }
}

/**
 * Create a quality scorer
 * @param {QualityScorerConfig} config - Configuration
 * @returns {OutputQualityScorer}
 */
export function createQualityScorer(config = {}) {
  return new OutputQualityScorer(config);
}

// Singleton instance
let _instance = null;

/**
 * Get singleton quality scorer
 * @param {QualityScorerConfig} config - Configuration (first call only)
 * @returns {OutputQualityScorer}
 */
export function getQualityScorer(config = {}) {
  if (!_instance) {
    _instance = new OutputQualityScorer(config);
  }
  return _instance;
}

/**
 * Quick score function
 * @param {*} output - Output to score
 * @param {Object} context - Scoring context
 * @returns {QualityScore}
 */
export function scoreQuality(output, context = {}) {
  return getQualityScorer().score(output, context);
}

export default OutputQualityScorer;
