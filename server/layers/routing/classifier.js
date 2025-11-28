/**
 * Complexity Classifier - PROMPT ML Layer 5
 *
 * Classifies the complexity of content/tasks to enable intelligent model routing.
 * Routes simple tasks to cheaper models and complex tasks to more capable models.
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Complexity levels
 * @readonly
 * @enum {string}
 */
export const ComplexityLevel = {
  SIMPLE: 'simple',       // Short content, straightforward task
  MEDIUM: 'medium',       // Moderate content, standard complexity
  COMPLEX: 'complex',     // Long content or nuanced task
  VERY_COMPLEX: 'very_complex'  // Multiple documents, requires advanced reasoning
};

/**
 * Task types that affect complexity assessment
 * @readonly
 * @enum {string}
 */
export const TaskType = {
  ROADMAP: 'roadmap',
  SLIDES: 'slides',
  DOCUMENT: 'document',
  RESEARCH_ANALYSIS: 'research-analysis',
  QA: 'qa'
};

/**
 * @typedef {Object} ComplexityAnalysis
 * @property {string} level - Complexity level
 * @property {number} score - Numerical score (0.0 to 1.0)
 * @property {Object} factors - Individual factor scores
 * @property {string} recommendedModel - Suggested model tier
 * @property {string} reasoning - Explanation of classification
 */

/**
 * @typedef {Object} ClassifierConfig
 * @property {Object} thresholds - Threshold values for complexity levels
 * @property {Object} weights - Weight values for different factors
 */

const DEFAULT_CONFIG = {
  thresholds: {
    simple: 0.3,        // Below this = simple
    medium: 0.6,        // Below this = medium
    complex: 0.85       // Below this = complex, above = very_complex
  },
  weights: {
    contentLength: 0.25,
    structuralComplexity: 0.20,
    entityDensity: 0.15,
    temporalComplexity: 0.15,
    technicalDensity: 0.10,
    taskInherentComplexity: 0.15
  }
};

/**
 * Task-specific base complexity (some tasks are inherently more complex)
 */
const TASK_BASE_COMPLEXITY = {
  [TaskType.ROADMAP]: 0.6,        // Complex: requires timeline reasoning
  [TaskType.SLIDES]: 0.3,         // Simpler: summarization task
  [TaskType.DOCUMENT]: 0.5,       // Medium: comprehensive analysis
  [TaskType.RESEARCH_ANALYSIS]: 0.7,  // Complex: quality assessment
  [TaskType.QA]: 0.2              // Simple: focused response
};

/**
 * Complexity Classifier class
 */
export class ComplexityClassifier {
  /**
   * @param {ClassifierConfig} config - Configuration options
   */
  constructor(config = {}) {
    this.config = {
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...config.thresholds },
      weights: { ...DEFAULT_CONFIG.weights, ...config.weights }
    };
  }

  /**
   * Classify content/task complexity
   *
   * @param {string} content - Content to analyze
   * @param {string} taskType - Type of task to perform
   * @param {Object} options - Additional options
   * @param {number} options.fileCount - Number of source files
   * @param {string} options.userPrompt - Optional user prompt
   * @returns {ComplexityAnalysis} Complexity analysis result
   */
  classify(content, taskType = TaskType.DOCUMENT, options = {}) {
    const { fileCount = 1, userPrompt = '' } = options;

    // Calculate individual factors
    const factors = {
      contentLength: this._analyzeContentLength(content),
      structuralComplexity: this._analyzeStructuralComplexity(content),
      entityDensity: this._analyzeEntityDensity(content),
      temporalComplexity: this._analyzeTemporalComplexity(content),
      technicalDensity: this._analyzeTechnicalDensity(content),
      taskInherentComplexity: this._getTaskComplexity(taskType, fileCount, userPrompt)
    };

    // Calculate weighted score
    const { weights } = this.config;
    let totalScore = 0;

    for (const [factor, value] of Object.entries(factors)) {
      totalScore += value * (weights[factor] || 0);
    }

    // Normalize score
    totalScore = Math.min(1.0, Math.max(0, totalScore));

    // Determine level
    const level = this._scoreToLevel(totalScore);

    // Determine recommended model
    const recommendedModel = this._getRecommendedModel(level, taskType);

    // Generate reasoning
    const reasoning = this._generateReasoning(factors, level, taskType);

    return {
      level,
      score: totalScore,
      factors,
      recommendedModel,
      reasoning
    };
  }

  /**
   * Quick classification for performance-critical paths
   *
   * @param {string} content - Content to analyze
   * @param {string} taskType - Type of task
   * @returns {string} Complexity level
   */
  quickClassify(content, taskType = TaskType.DOCUMENT) {
    // Fast heuristics
    const length = content.length;
    const baseComplexity = TASK_BASE_COMPLEXITY[taskType] || 0.5;

    // Simple length-based scoring
    let lengthScore;
    if (length < 5000) lengthScore = 0.2;
    else if (length < 20000) lengthScore = 0.4;
    else if (length < 50000) lengthScore = 0.6;
    else if (length < 100000) lengthScore = 0.8;
    else lengthScore = 1.0;

    const quickScore = (baseComplexity + lengthScore) / 2;

    return this._scoreToLevel(quickScore);
  }

  // ============================================================================
  // Factor Analysis Methods
  // ============================================================================

  /**
   * Analyze content length factor
   * @private
   */
  _analyzeContentLength(content) {
    const length = content.length;

    // Scoring curve: exponential growth with ceiling
    if (length < 2000) return 0.1;
    if (length < 5000) return 0.2;
    if (length < 10000) return 0.3;
    if (length < 20000) return 0.4;
    if (length < 35000) return 0.5;
    if (length < 50000) return 0.6;
    if (length < 75000) return 0.7;
    if (length < 100000) return 0.8;
    if (length < 150000) return 0.9;
    return 1.0;
  }

  /**
   * Analyze structural complexity (headings, sections, lists)
   * @private
   */
  _analyzeStructuralComplexity(content) {
    // Count structural elements
    const headings = (content.match(/^#{1,6}\s+/gm) || []).length;
    const lists = (content.match(/^[\s]*[-*•]\s+/gm) || []).length;
    const numberedLists = (content.match(/^[\s]*\d+\.\s+/gm) || []).length;
    const paragraphs = (content.match(/\n\n+/g) || []).length;
    const tables = (content.match(/\|.*\|/g) || []).length;

    // Calculate structural density
    const totalElements = headings + lists + numberedLists + tables;
    const contentLength = content.length;

    // More structure = more complex to transform
    const structuralDensity = totalElements / Math.max(1, contentLength / 1000);

    // Normalize to 0-1 range
    let score = 0;
    if (structuralDensity > 0.5) score = 0.3;
    if (structuralDensity > 1.0) score = 0.5;
    if (structuralDensity > 2.0) score = 0.7;
    if (structuralDensity > 3.0) score = 0.9;

    // Deep nesting increases complexity
    const deepHeadings = (content.match(/^#{4,6}\s+/gm) || []).length;
    if (deepHeadings > 5) score += 0.1;

    return Math.min(1.0, score);
  }

  /**
   * Analyze entity density (names, organizations, places)
   * @private
   */
  _analyzeEntityDensity(content) {
    // Simple entity detection using capitalization patterns
    // (Real NER would be more accurate but too expensive for routing)

    // Capitalized word sequences (potential names/orgs)
    const capitalizedSequences = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];

    // ALL CAPS words (acronyms, abbreviations)
    const acronyms = content.match(/\b[A-Z]{2,}\b/g) || [];

    // Numbers (dates, quantities, metrics)
    const numbers = content.match(/\b\d+(?:,\d{3})*(?:\.\d+)?(?:\s*%|M|B|K)?\b/g) || [];

    // Calculate entity density
    const totalEntities = capitalizedSequences.length + acronyms.length;
    const contentWords = content.split(/\s+/).length;
    const entityDensity = totalEntities / Math.max(1, contentWords);

    // Many unique entities = complex content
    const uniqueEntities = new Set([...capitalizedSequences, ...acronyms]).size;

    let score = 0;
    if (uniqueEntities > 10) score = 0.2;
    if (uniqueEntities > 25) score = 0.4;
    if (uniqueEntities > 50) score = 0.6;
    if (uniqueEntities > 100) score = 0.8;
    if (uniqueEntities > 200) score = 1.0;

    return score;
  }

  /**
   * Analyze temporal complexity (dates, timelines, sequences)
   * @private
   */
  _analyzeTemporalComplexity(content) {
    // Date patterns
    const explicitDates = content.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g) || [];
    const monthYearDates = content.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/gi) || [];
    const quarterDates = content.match(/\b[QH][1-4]\s*\d{4}\b/gi) || [];
    const yearReferences = content.match(/\b20[0-3]\d\b/g) || [];

    // Temporal keywords
    const temporalKeywords = content.match(/\b(?:before|after|during|until|since|deadline|milestone|phase|stage|timeline|schedule|quarter|fiscal|annual)\b/gi) || [];

    // Sequence indicators
    const sequenceIndicators = content.match(/\b(?:first|second|third|then|next|finally|subsequently|following|prior|previous)\b/gi) || [];

    const totalTemporalRefs = explicitDates.length + monthYearDates.length +
                              quarterDates.length + temporalKeywords.length +
                              sequenceIndicators.length;

    // More temporal references = harder to create accurate timeline
    let score = 0;
    if (totalTemporalRefs > 5) score = 0.2;
    if (totalTemporalRefs > 15) score = 0.4;
    if (totalTemporalRefs > 30) score = 0.6;
    if (totalTemporalRefs > 50) score = 0.8;
    if (totalTemporalRefs > 100) score = 1.0;

    // Explicit dates make timelines easier
    if (explicitDates.length > 10) score = Math.max(0.3, score - 0.1);

    return score;
  }

  /**
   * Analyze technical density (jargon, specialized terms)
   * @private
   */
  _analyzeTechnicalDensity(content) {
    // Technical indicators
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
    const inlineCode = (content.match(/`[^`]+`/g) || []).length;
    const mathExpressions = (content.match(/\$[^$]+\$/g) || []).length;
    const urls = (content.match(/https?:\/\/[^\s]+/g) || []).length;
    const fileExtensions = (content.match(/\.\w{2,4}\b/g) || []).length;

    // Technical terms (common patterns)
    const technicalTerms = (content.match(/\b(?:API|SDK|ML|AI|NLP|SQL|JSON|XML|HTTP|REST|GraphQL|Docker|Kubernetes|AWS|GCP|Azure|OAuth|JWT|TCP|UDP|DNS|SSL|TLS|HTTPS|CI|CD|DevOps|microservice|serverless|blockchain|cryptocurrency|neural|algorithm|database|repository|deployment|infrastructure)\b/gi) || []).length;

    const totalTechnical = codeBlocks * 3 + inlineCode + mathExpressions + urls + technicalTerms;
    const contentLength = content.length;
    const technicalDensity = totalTechnical / Math.max(1, contentLength / 1000);

    let score = 0;
    if (technicalDensity > 0.5) score = 0.3;
    if (technicalDensity > 1.0) score = 0.5;
    if (technicalDensity > 2.0) score = 0.7;
    if (technicalDensity > 4.0) score = 0.9;

    // Code blocks significantly increase complexity
    if (codeBlocks > 5) score = Math.min(1.0, score + 0.2);

    return Math.min(1.0, score);
  }

  /**
   * Get task-specific complexity contribution
   * @private
   */
  _getTaskComplexity(taskType, fileCount, userPrompt) {
    let baseComplexity = TASK_BASE_COMPLEXITY[taskType] || 0.5;

    // Multiple files increase complexity
    if (fileCount > 1) {
      baseComplexity += Math.min(0.3, fileCount * 0.05);
    }

    // User prompt might add complexity
    if (userPrompt) {
      // Long or detailed prompts suggest more specific requirements
      if (userPrompt.length > 100) baseComplexity += 0.1;
      if (userPrompt.length > 300) baseComplexity += 0.1;

      // Specific instructions keywords
      if (/\b(?:detailed|comprehensive|thorough|specific|exact|precise)\b/i.test(userPrompt)) {
        baseComplexity += 0.1;
      }
    }

    return Math.min(1.0, baseComplexity);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Convert score to complexity level
   * @private
   */
  _scoreToLevel(score) {
    const { thresholds } = this.config;

    if (score < thresholds.simple) return ComplexityLevel.SIMPLE;
    if (score < thresholds.medium) return ComplexityLevel.MEDIUM;
    if (score < thresholds.complex) return ComplexityLevel.COMPLEX;
    return ComplexityLevel.VERY_COMPLEX;
  }

  /**
   * Get recommended model for complexity level
   * @private
   */
  _getRecommendedModel(level, taskType) {
    // Model tiers
    const models = {
      fast: 'gemini-2.0-flash-lite',
      standard: 'gemini-2.5-flash',
      advanced: 'gemini-2.5-pro'
    };

    // Task-specific overrides
    if (taskType === TaskType.QA) {
      // QA is always fast unless very complex
      return level === ComplexityLevel.VERY_COMPLEX ? models.standard : models.fast;
    }

    // General mapping
    switch (level) {
      case ComplexityLevel.SIMPLE:
        return models.fast;
      case ComplexityLevel.MEDIUM:
        return models.standard;
      case ComplexityLevel.COMPLEX:
        return models.standard; // Standard can handle most complex tasks
      case ComplexityLevel.VERY_COMPLEX:
        return models.advanced;
      default:
        return models.standard;
    }
  }

  /**
   * Generate human-readable reasoning
   * @private
   */
  _generateReasoning(factors, level, taskType) {
    const reasons = [];

    // Identify dominant factors
    const sortedFactors = Object.entries(factors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    for (const [factor, value] of sortedFactors) {
      if (value > 0.5) {
        const factorNames = {
          contentLength: 'content length',
          structuralComplexity: 'structural complexity',
          entityDensity: 'number of entities',
          temporalComplexity: 'temporal references',
          technicalDensity: 'technical content',
          taskInherentComplexity: 'task requirements'
        };
        reasons.push(`High ${factorNames[factor] || factor} (${(value * 100).toFixed(0)}%)`);
      }
    }

    if (reasons.length === 0) {
      reasons.push('Standard complexity across all factors');
    }

    return `Classification: ${level} for ${taskType}. ${reasons.join(', ')}.`;
  }
}

/**
 * Create a complexity classifier with default configuration
 * @param {ClassifierConfig} config - Optional configuration
 * @returns {ComplexityClassifier}
 */
export function createClassifier(config = {}) {
  return new ComplexityClassifier(config);
}

// Singleton instance
let _instance = null;

/**
 * Get or create singleton classifier instance
 * @param {ClassifierConfig} config - Configuration (only used on first call)
 * @returns {ComplexityClassifier}
 */
export function getClassifier(config = {}) {
  if (!_instance) {
    _instance = new ComplexityClassifier(config);
  }
  return _instance;
}

/**
 * Quick complexity classification function
 * @param {string} content - Content to classify
 * @param {string} taskType - Task type
 * @returns {string} Complexity level
 */
export function classifyComplexity(content, taskType = TaskType.DOCUMENT) {
  return getClassifier().quickClassify(content, taskType);
}

/**
 * Full complexity analysis function
 * @param {string} content - Content to analyze
 * @param {string} taskType - Task type
 * @param {Object} options - Additional options
 * @returns {ComplexityAnalysis} Full analysis
 */
export function analyzeComplexity(content, taskType = TaskType.DOCUMENT, options = {}) {
  return getClassifier().classify(content, taskType, options);
}

export default ComplexityClassifier;
