/**
 * Evaluators - PROMPT ML Layer 8
 *
 * Automated evaluation of LLM outputs:
 * - Correctness evaluation
 * - Consistency checking
 * - Relevance scoring
 * - Comparative evaluation
 * - Ground truth comparison
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Evaluation result status
 * @readonly
 * @enum {string}
 */
export const EvalStatus = {
  PASS: 'pass',
  FAIL: 'fail',
  PARTIAL: 'partial',
  SKIP: 'skip',
  ERROR: 'error'
};

/**
 * Evaluation dimensions
 * @readonly
 * @enum {string}
 */
export const EvalDimension = {
  CORRECTNESS: 'correctness',     // Factual accuracy
  COMPLETENESS: 'completeness',   // Coverage of requirements
  CONSISTENCY: 'consistency',     // Internal consistency
  RELEVANCE: 'relevance',         // Relevance to prompt
  FORMAT: 'format',               // Format compliance
  COHERENCE: 'coherence',         // Logical flow
  GROUNDEDNESS: 'groundedness'    // Grounded in source material
};

/**
 * @typedef {Object} EvalResult
 * @property {string} dimension - Evaluation dimension
 * @property {EvalStatus} status - Pass/fail status
 * @property {number} score - Score (0-1)
 * @property {string} message - Result message
 * @property {Object} details - Detailed results
 * @property {number} confidence - Confidence in evaluation (0-1)
 */

/**
 * @typedef {Object} EvalConfig
 * @property {number} passingThreshold - Score threshold for passing
 * @property {boolean} strictMode - Fail on any issue
 * @property {Array<string>} dimensions - Dimensions to evaluate
 */

const DEFAULT_CONFIG = {
  passingThreshold: 0.7,
  strictMode: false,
  dimensions: Object.values(EvalDimension)
};

/**
 * Base Evaluator class
 */
export class BaseEvaluator {
  /**
   * @param {string} dimension - Evaluation dimension
   * @param {Object} config - Configuration
   */
  constructor(dimension, config = {}) {
    this.dimension = dimension;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate output
   * @param {*} output - Output to evaluate
   * @param {Object} context - Evaluation context
   * @returns {EvalResult} Evaluation result
   */
  evaluate(output, context = {}) {
    throw new Error('evaluate() must be implemented by subclass');
  }

  /**
   * Build evaluation result
   * @protected
   */
  _buildResult(score, details = {}, message = null) {
    const status = score >= this.config.passingThreshold ? EvalStatus.PASS
      : score >= this.config.passingThreshold * 0.5 ? EvalStatus.PARTIAL
      : EvalStatus.FAIL;

    return {
      dimension: this.dimension,
      status,
      score,
      message: message || this._getDefaultMessage(status, score),
      details,
      confidence: details.confidence || 0.8,
      timestamp: new Date().toISOString()
    };
  }

  _getDefaultMessage(status, score) {
    switch (status) {
      case EvalStatus.PASS:
        return `${this.dimension} evaluation passed (score: ${(score * 100).toFixed(1)}%)`;
      case EvalStatus.PARTIAL:
        return `${this.dimension} evaluation partially passed (score: ${(score * 100).toFixed(1)}%)`;
      case EvalStatus.FAIL:
        return `${this.dimension} evaluation failed (score: ${(score * 100).toFixed(1)}%)`;
      default:
        return `${this.dimension} evaluation completed`;
    }
  }
}

/**
 * Correctness Evaluator
 * Evaluates factual accuracy of output
 */
export class CorrectnessEvaluator extends BaseEvaluator {
  constructor(config = {}) {
    super(EvalDimension.CORRECTNESS, config);
  }

  /**
   * Evaluate correctness
   * @param {*} output - Output to evaluate
   * @param {Object} context - Context with groundTruth, sourceFiles
   * @returns {EvalResult}
   */
  evaluate(output, context = {}) {
    const { groundTruth, sourceFiles } = context;
    const details = {
      factsClaimed: 0,
      factsVerified: 0,
      factsContradicted: 0,
      factsUnverifiable: 0
    };

    // Extract claims from output
    const claims = this._extractClaims(output);
    details.factsClaimed = claims.length;

    if (claims.length === 0) {
      return this._buildResult(1.0, { ...details, confidence: 0.5 },
        'No factual claims found to verify');
    }

    // Verify claims against ground truth or sources
    if (groundTruth) {
      const verification = this._verifyAgainstGroundTruth(claims, groundTruth);
      details.factsVerified = verification.verified;
      details.factsContradicted = verification.contradicted;
      details.factsUnverifiable = verification.unverifiable;
    } else if (sourceFiles) {
      const verification = this._verifyAgainstSources(claims, sourceFiles);
      details.factsVerified = verification.verified;
      details.factsContradicted = verification.contradicted;
      details.factsUnverifiable = verification.unverifiable;
      details.confidence = 0.6; // Lower confidence without ground truth
    } else {
      // No reference material - can only check internal consistency
      details.confidence = 0.3;
      return this._buildResult(0.5, details,
        'Unable to verify correctness without reference material');
    }

    // Calculate score
    const verifiableFacts = details.factsClaimed - details.factsUnverifiable;
    const score = verifiableFacts > 0
      ? details.factsVerified / verifiableFacts
      : 0.5;

    // Penalize contradictions heavily
    const adjustedScore = Math.max(0, score - (details.factsContradicted * 0.2));

    return this._buildResult(adjustedScore, details);
  }

  _extractClaims(output) {
    const text = typeof output === 'string' ? output : JSON.stringify(output);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

    // Look for factual claim indicators
    const claimPatterns = [
      /\b\d+%/,                    // Percentages
      /\b\d{4}\b/,                 // Years
      /\$[\d,]+/,                  // Dollar amounts
      /\b(will|must|is|are|was|were)\b/i,  // Declarative statements
      /\b(increased|decreased|grew|fell|rose)\b/i  // Trend claims
    ];

    return sentences.filter(sentence => {
      return claimPatterns.some(pattern => pattern.test(sentence));
    });
  }

  _verifyAgainstGroundTruth(claims, groundTruth) {
    const result = { verified: 0, contradicted: 0, unverifiable: 0 };
    const truthText = typeof groundTruth === 'string'
      ? groundTruth.toLowerCase()
      : JSON.stringify(groundTruth).toLowerCase();

    for (const claim of claims) {
      const claimLower = claim.toLowerCase();
      const claimWords = claimLower.split(/\W+/).filter(w => w.length > 3);

      // Calculate overlap with ground truth
      const overlap = claimWords.filter(w => truthText.includes(w)).length;
      const overlapRatio = overlap / claimWords.length;

      if (overlapRatio > 0.5) {
        result.verified++;
      } else if (overlapRatio < 0.2) {
        result.unverifiable++;
      } else {
        // Check for contradictions (negation patterns)
        const hasContradiction = this._checkContradiction(claimLower, truthText);
        if (hasContradiction) {
          result.contradicted++;
        } else {
          result.unverifiable++;
        }
      }
    }

    return result;
  }

  _verifyAgainstSources(claims, sourceFiles) {
    const sourceText = sourceFiles
      .map(f => f.content || '')
      .join('\n')
      .toLowerCase();

    return this._verifyAgainstGroundTruth(claims, sourceText);
  }

  _checkContradiction(claim, reference) {
    // Simple contradiction detection using negation
    const negationPatterns = [
      { pos: /\bis\b/, neg: /\bis not\b|\bisn't\b/ },
      { pos: /\bwill\b/, neg: /\bwill not\b|\bwon't\b/ },
      { pos: /\bcan\b/, neg: /\bcannot\b|\bcan't\b/ },
      { pos: /\bincreased\b/, neg: /\bdecreased\b/ },
      { pos: /\bgrew\b/, neg: /\bfell\b|\bshrank\b/ }
    ];

    for (const pattern of negationPatterns) {
      const claimHasPos = pattern.pos.test(claim);
      const claimHasNeg = pattern.neg.test(claim);
      const refHasPos = pattern.pos.test(reference);
      const refHasNeg = pattern.neg.test(reference);

      if ((claimHasPos && refHasNeg) || (claimHasNeg && refHasPos)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Completeness Evaluator
 * Evaluates coverage of required elements
 */
export class CompletenessEvaluator extends BaseEvaluator {
  constructor(config = {}) {
    super(EvalDimension.COMPLETENESS, config);
  }

  /**
   * Evaluate completeness
   * @param {*} output - Output to evaluate
   * @param {Object} context - Context with requirements, schema
   * @returns {EvalResult}
   */
  evaluate(output, context = {}) {
    const { requirements, schema, contentType } = context;
    const details = {
      requiredElements: 0,
      presentElements: 0,
      missingElements: [],
      extraElements: []
    };

    // Get requirements based on content type or explicit requirements
    const reqs = requirements || this._getDefaultRequirements(contentType);

    if (!reqs || reqs.length === 0) {
      return this._buildResult(1.0, { ...details, confidence: 0.4 },
        'No requirements specified for completeness check');
    }

    details.requiredElements = reqs.length;

    // Check each requirement
    for (const req of reqs) {
      if (this._checkRequirement(output, req)) {
        details.presentElements++;
      } else {
        details.missingElements.push(req.name || req);
      }
    }

    // Check schema completeness if provided
    if (schema) {
      const schemaCheck = this._checkSchemaCompleteness(output, schema);
      details.schemaCompliance = schemaCheck;
    }

    const score = details.requiredElements > 0
      ? details.presentElements / details.requiredElements
      : 1.0;

    return this._buildResult(score, details);
  }

  _getDefaultRequirements(contentType) {
    const defaultReqs = {
      roadmap: [
        { name: 'title', path: 'title', type: 'string' },
        { name: 'timeColumns', path: 'timeColumns', type: 'array', minLength: 2 },
        { name: 'data', path: 'data', type: 'array', minLength: 1 },
        { name: 'legend', path: 'legend', type: 'array' },
        { name: 'researchAnalysis', path: 'researchAnalysis', type: 'object' }
      ],
      slides: [
        { name: 'title', path: 'title', type: 'string' },
        { name: 'slides', path: 'slides', type: 'array', minLength: 3 },
        { name: 'slideContent', path: 'slides[].content', type: 'array' }
      ],
      document: [
        { name: 'title', path: 'title', type: 'string' },
        { name: 'sections', path: 'sections', type: 'array', minLength: 2 },
        { name: 'sectionContent', path: 'sections[].content', type: 'string' }
      ],
      'research-analysis': [
        { name: 'title', path: 'title', type: 'string' },
        { name: 'overallScore', path: 'overallScore', type: 'number' },
        { name: 'themes', path: 'themes', type: 'array' },
        { name: 'dataCompleteness', path: 'dataCompleteness', type: 'object' }
      ]
    };

    return defaultReqs[contentType] || [];
  }

  _checkRequirement(output, requirement) {
    if (typeof requirement === 'string') {
      // Simple string requirement - check if present
      return this._hasPath(output, requirement);
    }

    const { path, type, minLength } = requirement;

    const value = this._getPath(output, path);
    if (value === undefined) return false;

    // Type check
    if (type === 'array' && !Array.isArray(value)) return false;
    if (type === 'object' && (typeof value !== 'object' || Array.isArray(value))) return false;
    if (type === 'string' && typeof value !== 'string') return false;
    if (type === 'number' && typeof value !== 'number') return false;

    // Length check
    if (minLength && Array.isArray(value) && value.length < minLength) return false;
    if (minLength && typeof value === 'string' && value.length < minLength) return false;

    return true;
  }

  _hasPath(obj, path) {
    return this._getPath(obj, path) !== undefined;
  }

  _getPath(obj, path) {
    // Handle array notation like "slides[].content"
    const parts = path.replace(/\[\]/g, '.0').split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }

    return current;
  }

  _checkSchemaCompleteness(output, schema) {
    const required = schema.required || [];
    const present = Object.keys(output || {});

    return {
      requiredFields: required.length,
      presentFields: required.filter(f => present.includes(f)).length,
      missingFields: required.filter(f => !present.includes(f))
    };
  }
}

/**
 * Consistency Evaluator
 * Evaluates internal consistency of output
 */
export class ConsistencyEvaluator extends BaseEvaluator {
  constructor(config = {}) {
    super(EvalDimension.CONSISTENCY, config);
  }

  /**
   * Evaluate consistency
   * @param {*} output - Output to evaluate
   * @param {Object} context - Context with previousOutputs
   * @returns {EvalResult}
   */
  evaluate(output, context = {}) {
    const { previousOutputs } = context;
    const details = {
      internalConsistency: 1.0,
      crossOutputConsistency: null,
      contradictions: []
    };

    // Check internal consistency
    const internalCheck = this._checkInternalConsistency(output);
    details.internalConsistency = internalCheck.score;
    details.contradictions.push(...internalCheck.contradictions);

    // Check consistency with previous outputs if available
    if (previousOutputs && previousOutputs.length > 0) {
      const crossCheck = this._checkCrossConsistency(output, previousOutputs);
      details.crossOutputConsistency = crossCheck.score;
      details.contradictions.push(...crossCheck.contradictions);
    }

    // Calculate overall score
    let score = details.internalConsistency;
    if (details.crossOutputConsistency !== null) {
      score = (details.internalConsistency + details.crossOutputConsistency) / 2;
    }

    return this._buildResult(score, details);
  }

  _checkInternalConsistency(output) {
    const result = { score: 1.0, contradictions: [] };
    const text = typeof output === 'string' ? output : JSON.stringify(output);

    // Extract numerical claims and check for conflicts
    const numbers = this._extractNumbers(text);
    const conflicts = this._findNumberConflicts(numbers);

    if (conflicts.length > 0) {
      result.contradictions.push(...conflicts.map(c => ({
        type: 'numerical',
        message: c
      })));
      result.score -= conflicts.length * 0.1;
    }

    // Check for contradictory statements
    const statements = this._extractStatements(text);
    const contradictions = this._findContradictions(statements);

    if (contradictions.length > 0) {
      result.contradictions.push(...contradictions.map(c => ({
        type: 'logical',
        message: c
      })));
      result.score -= contradictions.length * 0.15;
    }

    result.score = Math.max(0, result.score);
    return result;
  }

  _checkCrossConsistency(output, previousOutputs) {
    const result = { score: 1.0, contradictions: [] };

    const outputText = typeof output === 'string' ? output : JSON.stringify(output);
    const outputNumbers = this._extractNumbers(outputText);

    for (const prevOutput of previousOutputs) {
      const prevText = typeof prevOutput === 'string' ? prevOutput : JSON.stringify(prevOutput);
      const prevNumbers = this._extractNumbers(prevText);

      // Check for conflicting numbers
      for (const [key, value] of Object.entries(outputNumbers)) {
        if (prevNumbers[key] && prevNumbers[key] !== value) {
          result.contradictions.push(
            `Inconsistent value for "${key}": ${value} vs ${prevNumbers[key]}`
          );
          result.score -= 0.1;
        }
      }
    }

    result.score = Math.max(0, result.score);
    return result;
  }

  _extractNumbers(text) {
    const numbers = {};
    const patterns = [
      /(\w+)\s*(?:is|=|:)\s*(\d+(?:\.\d+)?%?)/gi,
      /(\d+(?:\.\d+)?%?)\s+(\w+)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const [, key, value] = match;
        numbers[key.toLowerCase()] = value;
      }
    }

    return numbers;
  }

  _extractStatements(text) {
    return text.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }

  _findNumberConflicts(numbers) {
    // Check for same entity with different values
    const conflicts = [];
    const seen = new Map();

    for (const [key, value] of Object.entries(numbers)) {
      if (seen.has(key) && seen.get(key) !== value) {
        conflicts.push(`Conflicting values for "${key}": ${seen.get(key)} vs ${value}`);
      }
      seen.set(key, value);
    }

    return conflicts;
  }

  _findContradictions(statements) {
    const contradictions = [];
    // Simple heuristic: look for opposing statements
    const opposites = [
      ['increase', 'decrease'],
      ['grow', 'shrink'],
      ['more', 'less'],
      ['higher', 'lower'],
      ['better', 'worse']
    ];

    for (let i = 0; i < statements.length; i++) {
      for (let j = i + 1; j < statements.length; j++) {
        const s1 = statements[i].toLowerCase();
        const s2 = statements[j].toLowerCase();

        // Check if statements are about the same topic but contradict
        for (const [pos, neg] of opposites) {
          if ((s1.includes(pos) && s2.includes(neg)) ||
              (s1.includes(neg) && s2.includes(pos))) {
            // Check if they share subject words
            const words1 = new Set(s1.split(/\W+/).filter(w => w.length > 4));
            const words2 = new Set(s2.split(/\W+/).filter(w => w.length > 4));
            const shared = [...words1].filter(w => words2.has(w));

            if (shared.length > 0) {
              contradictions.push(
                `Potential contradiction about "${shared[0]}": "${pos}" vs "${neg}"`
              );
            }
          }
        }
      }
    }

    return contradictions;
  }
}

/**
 * Relevance Evaluator
 * Evaluates relevance to the original prompt
 */
export class RelevanceEvaluator extends BaseEvaluator {
  constructor(config = {}) {
    super(EvalDimension.RELEVANCE, config);
  }

  /**
   * Evaluate relevance
   * @param {*} output - Output to evaluate
   * @param {Object} context - Context with userPrompt, keywords
   * @returns {EvalResult}
   */
  evaluate(output, context = {}) {
    const { userPrompt, keywords } = context;
    const details = {
      promptCoverage: 0,
      keywordMatches: 0,
      topicAlignment: 0,
      offTopicContent: []
    };

    if (!userPrompt) {
      return this._buildResult(0.5, { ...details, confidence: 0.3 },
        'Cannot evaluate relevance without user prompt');
    }

    const outputText = typeof output === 'string' ? output : JSON.stringify(output);

    // Extract key concepts from prompt
    const promptConcepts = this._extractConcepts(userPrompt);
    const outputConcepts = this._extractConcepts(outputText);

    // Calculate prompt coverage (how much of prompt is addressed)
    const coverage = this._calculateCoverage(promptConcepts, outputConcepts);
    details.promptCoverage = coverage;

    // Check keyword matches if provided
    if (keywords && keywords.length > 0) {
      const matches = keywords.filter(k =>
        outputText.toLowerCase().includes(k.toLowerCase())
      ).length;
      details.keywordMatches = matches / keywords.length;
    }

    // Calculate topic alignment
    details.topicAlignment = this._calculateTopicAlignment(promptConcepts, outputConcepts);

    // Identify off-topic content
    details.offTopicContent = this._identifyOffTopicContent(promptConcepts, outputConcepts);

    // Calculate overall score
    let score = details.promptCoverage * 0.4 + details.topicAlignment * 0.4;
    if (keywords && keywords.length > 0) {
      score = score * 0.8 + details.keywordMatches * 0.2;
    }

    // Penalize off-topic content
    score -= details.offTopicContent.length * 0.05;
    score = Math.max(0, Math.min(1, score));

    return this._buildResult(score, details);
  }

  _extractConcepts(text) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);

    // Remove common stop words
    const stopWords = new Set([
      'this', 'that', 'these', 'those', 'with', 'from', 'have', 'been',
      'were', 'what', 'when', 'where', 'which', 'while', 'would', 'could',
      'should', 'about', 'their', 'there', 'they', 'will', 'your', 'more'
    ]);

    return words.filter(w => !stopWords.has(w));
  }

  _calculateCoverage(promptConcepts, outputConcepts) {
    if (promptConcepts.length === 0) return 1.0;

    const outputSet = new Set(outputConcepts);
    const covered = promptConcepts.filter(c => outputSet.has(c)).length;

    return covered / promptConcepts.length;
  }

  _calculateTopicAlignment(promptConcepts, outputConcepts) {
    if (outputConcepts.length === 0) return 0;

    const promptSet = new Set(promptConcepts);
    const aligned = outputConcepts.filter(c => promptSet.has(c)).length;

    // Return ratio of aligned concepts in output
    return aligned / outputConcepts.length;
  }

  _identifyOffTopicContent(promptConcepts, outputConcepts) {
    const promptSet = new Set(promptConcepts);
    const offTopic = [];

    // Find concepts that appear frequently in output but not in prompt
    const conceptCounts = {};
    for (const concept of outputConcepts) {
      conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
    }

    for (const [concept, count] of Object.entries(conceptCounts)) {
      if (!promptSet.has(concept) && count > 3) {
        offTopic.push(concept);
      }
    }

    return offTopic.slice(0, 5); // Return top 5 off-topic concepts
  }
}

/**
 * Format Evaluator
 * Evaluates format compliance
 */
export class FormatEvaluator extends BaseEvaluator {
  constructor(config = {}) {
    super(EvalDimension.FORMAT, config);
  }

  /**
   * Evaluate format
   * @param {*} output - Output to evaluate
   * @param {Object} context - Context with schema, expectedFormat
   * @returns {EvalResult}
   */
  evaluate(output, context = {}) {
    const { schema, expectedFormat, contentType } = context;
    const details = {
      isValidJSON: false,
      schemaValid: null,
      structureValid: false,
      formatIssues: []
    };

    // Check JSON validity
    try {
      if (typeof output === 'string') {
        JSON.parse(output);
      }
      details.isValidJSON = true;
    } catch {
      details.isValidJSON = typeof output === 'object';
    }

    if (!details.isValidJSON) {
      details.formatIssues.push('Output is not valid JSON');
      return this._buildResult(0, details);
    }

    // Check schema compliance
    if (schema) {
      const schemaResult = this._validateSchema(output, schema);
      details.schemaValid = schemaResult.valid;
      details.formatIssues.push(...schemaResult.errors);
    }

    // Check expected structure based on content type
    const structureResult = this._validateStructure(output, contentType || expectedFormat);
    details.structureValid = structureResult.valid;
    details.formatIssues.push(...structureResult.issues);

    // Calculate score
    let score = 0.3; // Base score for valid JSON
    if (details.schemaValid !== false) score += 0.35;
    if (details.structureValid) score += 0.35;

    // Penalize format issues
    score -= details.formatIssues.length * 0.1;
    score = Math.max(0, Math.min(1, score));

    return this._buildResult(score, details);
  }

  _validateSchema(output, schema) {
    const errors = [];
    let valid = true;

    // Type check
    if (schema.type) {
      const actualType = Array.isArray(output) ? 'array' : typeof output;
      if (actualType !== schema.type) {
        errors.push(`Expected type ${schema.type}, got ${actualType}`);
        valid = false;
      }
    }

    // Required fields
    if (schema.required && typeof output === 'object') {
      for (const field of schema.required) {
        if (!(field in output)) {
          errors.push(`Missing required field: ${field}`);
          valid = false;
        }
      }
    }

    return { valid, errors };
  }

  _validateStructure(output, contentType) {
    const issues = [];
    let valid = true;

    const structures = {
      roadmap: ['title', 'timeColumns', 'data'],
      slides: ['title', 'slides'],
      document: ['title', 'sections'],
      'research-analysis': ['title', 'overallScore', 'themes']
    };

    const expectedFields = structures[contentType];
    if (expectedFields && typeof output === 'object') {
      for (const field of expectedFields) {
        if (!(field in output)) {
          issues.push(`Missing expected field for ${contentType}: ${field}`);
          valid = false;
        }
      }
    }

    return { valid, issues };
  }
}

/**
 * Composite Evaluator
 * Runs multiple evaluators and aggregates results
 */
export class CompositeEvaluator {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.evaluators = new Map();

    // Initialize default evaluators
    this._initializeEvaluators();
  }

  _initializeEvaluators() {
    this.evaluators.set(EvalDimension.CORRECTNESS, new CorrectnessEvaluator(this.config));
    this.evaluators.set(EvalDimension.COMPLETENESS, new CompletenessEvaluator(this.config));
    this.evaluators.set(EvalDimension.CONSISTENCY, new ConsistencyEvaluator(this.config));
    this.evaluators.set(EvalDimension.RELEVANCE, new RelevanceEvaluator(this.config));
    this.evaluators.set(EvalDimension.FORMAT, new FormatEvaluator(this.config));
  }

  /**
   * Add or replace an evaluator
   * @param {string} dimension - Dimension name
   * @param {BaseEvaluator} evaluator - Evaluator instance
   */
  setEvaluator(dimension, evaluator) {
    this.evaluators.set(dimension, evaluator);
  }

  /**
   * Evaluate output across all dimensions
   * @param {*} output - Output to evaluate
   * @param {Object} context - Evaluation context
   * @returns {Object} Composite evaluation result
   */
  evaluate(output, context = {}) {
    const results = {};
    const dimensions = this.config.dimensions || [...this.evaluators.keys()];

    for (const dimension of dimensions) {
      const evaluator = this.evaluators.get(dimension);
      if (evaluator) {
        try {
          results[dimension] = evaluator.evaluate(output, context);
        } catch (error) {
          results[dimension] = {
            dimension,
            status: EvalStatus.ERROR,
            score: 0,
            message: `Evaluation error: ${error.message}`,
            details: { error: error.message },
            confidence: 0
          };
        }
      }
    }

    // Calculate aggregate score
    const scores = Object.values(results).map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Determine overall status
    const statuses = Object.values(results).map(r => r.status);
    let overallStatus = EvalStatus.PASS;
    if (statuses.includes(EvalStatus.FAIL)) {
      overallStatus = this.config.strictMode ? EvalStatus.FAIL : EvalStatus.PARTIAL;
    } else if (statuses.includes(EvalStatus.PARTIAL)) {
      overallStatus = EvalStatus.PARTIAL;
    }

    return {
      overallStatus,
      overallScore: avgScore,
      passed: overallStatus === EvalStatus.PASS,
      results,
      summary: this._generateSummary(results),
      timestamp: new Date().toISOString()
    };
  }

  _generateSummary(results) {
    const passed = Object.values(results).filter(r => r.status === EvalStatus.PASS).length;
    const failed = Object.values(results).filter(r => r.status === EvalStatus.FAIL).length;
    const partial = Object.values(results).filter(r => r.status === EvalStatus.PARTIAL).length;

    const weakest = Object.entries(results)
      .sort((a, b) => a[1].score - b[1].score)
      .slice(0, 2)
      .map(([dim, result]) => ({ dimension: dim, score: result.score }));

    return {
      passed,
      failed,
      partial,
      total: Object.keys(results).length,
      weakestDimensions: weakest
    };
  }
}

// Singleton instance
let _evaluator = null;

/**
 * Get or create singleton composite evaluator
 * @param {Object} config - Configuration
 * @returns {CompositeEvaluator}
 */
export function getEvaluator(config = {}) {
  if (!_evaluator) {
    _evaluator = new CompositeEvaluator(config);
  }
  return _evaluator;
}

/**
 * Reset evaluator instance (for testing)
 */
export function resetEvaluator() {
  _evaluator = null;
}

/**
 * Quick evaluate function
 * @param {*} output - Output to evaluate
 * @param {Object} context - Evaluation context
 * @returns {Object} Evaluation result
 */
export function evaluateOutput(output, context = {}) {
  return getEvaluator().evaluate(output, context);
}

export default CompositeEvaluator;
