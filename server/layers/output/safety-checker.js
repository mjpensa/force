/**
 * Output Safety Checker - PROMPT ML Layer 6
 *
 * Validates LLM outputs for safety concerns:
 * - PII detection in outputs
 * - Harmful content detection
 * - Hallucination indicators
 * - Content policy compliance
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Safety check result levels
 * @readonly
 * @enum {string}
 */
export const SafetyLevel = {
  SAFE: 'safe',             // No safety concerns
  CAUTION: 'caution',       // Minor concerns, review recommended
  UNSAFE: 'unsafe',         // Safety issues detected
  BLOCKED: 'blocked'        // Must not be returned to user
};

/**
 * Safety concern categories
 * @readonly
 * @enum {string}
 */
export const SafetyCategory = {
  PII: 'pii',                       // Personal identifiable information
  HARMFUL: 'harmful',               // Harmful content
  HALLUCINATION: 'hallucination',   // Likely fabricated content
  BIAS: 'bias',                     // Biased content
  SENSITIVE: 'sensitive',           // Sensitive topics
  INJECTION: 'injection'            // Prompt injection in output
};

/**
 * @typedef {Object} SafetyCheckResult
 * @property {string} level - Overall safety level
 * @property {boolean} safe - Whether output is safe to return
 * @property {Object[]} concerns - Array of safety concerns
 * @property {Object} scores - Category-specific scores
 * @property {string[]} recommendations - Recommended actions
 */

/**
 * @typedef {Object} SafetyConfig
 * @property {boolean} checkPII - Check for PII
 * @property {boolean} checkHallucination - Check for hallucination
 * @property {boolean} checkHarmful - Check for harmful content
 * @property {boolean} checkInjection - Check for injections in output
 * @property {number} hallucinationThreshold - Threshold for hallucination detection
 */

const DEFAULT_CONFIG = {
  checkPII: true,
  checkHallucination: true,
  checkHarmful: true,
  checkInjection: true,
  hallucinationThreshold: 0.5
};

/**
 * PII patterns for detection
 */
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
};

/**
 * Harmful content patterns
 */
const HARMFUL_PATTERNS = {
  violence: /\b(kill|murder|attack|weapon|bomb|terrorist)\b/gi,
  hate: /\b(hate|racist|sexist|discriminat)\b/gi,
  selfHarm: /\b(suicide|self-harm|cut myself)\b/gi,
  illegal: /\b(illegal|crime|fraud|hack|exploit)\b/gi
};

/**
 * Injection patterns in output
 */
const INJECTION_PATTERNS = {
  systemPrompt: /system\s*prompt|you\s*are\s*an?\s*ai|ignore\s*(previous|all)\s*instructions/gi,
  rolePlay: /pretend\s*to\s*be|act\s*as\s*if|roleplay\s*as/gi,
  codeExecution: /```(bash|sh|python|javascript)[\s\S]*?(rm\s+-rf|sudo|exec|eval)/gi
};

/**
 * Output Safety Checker class
 */
export class OutputSafetyChecker {
  /**
   * @param {SafetyConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check output for safety concerns
   *
   * @param {*} output - Output to check (string or object)
   * @param {Object} options - Check options
   * @returns {SafetyCheckResult} Safety check result
   */
  check(output, options = {}) {
    const concerns = [];
    const scores = {
      [SafetyCategory.PII]: 0,
      [SafetyCategory.HARMFUL]: 0,
      [SafetyCategory.HALLUCINATION]: 0,
      [SafetyCategory.BIAS]: 0,
      [SafetyCategory.SENSITIVE]: 0,
      [SafetyCategory.INJECTION]: 0
    };
    const recommendations = [];

    // Convert output to searchable text
    const text = this._outputToText(output);

    // Run safety checks
    if (this.config.checkPII) {
      const piiResult = this._checkPII(text);
      scores[SafetyCategory.PII] = piiResult.score;
      concerns.push(...piiResult.concerns);
      recommendations.push(...piiResult.recommendations);
    }

    if (this.config.checkHarmful) {
      const harmfulResult = this._checkHarmful(text);
      scores[SafetyCategory.HARMFUL] = harmfulResult.score;
      concerns.push(...harmfulResult.concerns);
      recommendations.push(...harmfulResult.recommendations);
    }

    if (this.config.checkInjection) {
      const injectionResult = this._checkInjection(text);
      scores[SafetyCategory.INJECTION] = injectionResult.score;
      concerns.push(...injectionResult.concerns);
      recommendations.push(...injectionResult.recommendations);
    }

    if (this.config.checkHallucination && options.sourceContent) {
      const hallucinationResult = this._checkHallucination(output, options.sourceContent);
      scores[SafetyCategory.HALLUCINATION] = hallucinationResult.score;
      concerns.push(...hallucinationResult.concerns);
      recommendations.push(...hallucinationResult.recommendations);
    }

    // Determine overall safety level
    const level = this._determineSafetyLevel(scores, concerns);

    return {
      level,
      safe: level === SafetyLevel.SAFE || level === SafetyLevel.CAUTION,
      concerns,
      scores,
      recommendations: [...new Set(recommendations)] // Deduplicate
    };
  }

  /**
   * Quick check if output is safe
   *
   * @param {*} output - Output to check
   * @returns {boolean} Whether output is safe
   */
  isSafe(output) {
    const result = this.check(output);
    return result.safe;
  }

  /**
   * Sanitize output by removing detected PII
   *
   * @param {*} output - Output to sanitize
   * @returns {Object} {sanitized: output, removed: count}
   */
  sanitizePII(output) {
    const text = this._outputToText(output);
    let sanitized = text;
    let removed = 0;

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      const matches = text.match(pattern) || [];
      removed += matches.length;
      sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
    }

    // If output was object, try to reconstruct
    if (typeof output === 'object') {
      try {
        return {
          sanitized: JSON.parse(sanitized),
          removed
        };
      } catch {
        return { sanitized, removed };
      }
    }

    return { sanitized, removed };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Convert output to searchable text
   * @private
   */
  _outputToText(output) {
    if (typeof output === 'string') {
      return output;
    }
    if (typeof output === 'object') {
      return JSON.stringify(output, null, 2);
    }
    return String(output);
  }

  /**
   * Check for PII in text
   * @private
   */
  _checkPII(text) {
    const concerns = [];
    const recommendations = [];
    let totalMatches = 0;

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      const matches = text.match(pattern) || [];
      if (matches.length > 0) {
        totalMatches += matches.length;
        concerns.push({
          category: SafetyCategory.PII,
          type,
          count: matches.length,
          severity: 'high',
          message: `Detected ${matches.length} potential ${type}(s) in output`
        });
      }
    }

    if (totalMatches > 0) {
      recommendations.push('Review output for PII before displaying to user');
      recommendations.push('Consider using sanitizePII() to redact sensitive information');
    }

    const score = Math.min(1, totalMatches * 0.2);
    return { score, concerns, recommendations };
  }

  /**
   * Check for harmful content
   * @private
   */
  _checkHarmful(text) {
    const concerns = [];
    const recommendations = [];
    let totalScore = 0;

    for (const [type, pattern] of Object.entries(HARMFUL_PATTERNS)) {
      const matches = text.match(pattern) || [];
      if (matches.length > 0) {
        const severity = type === 'selfHarm' ? 'critical' : 'medium';
        totalScore += matches.length * (severity === 'critical' ? 0.3 : 0.1);

        concerns.push({
          category: SafetyCategory.HARMFUL,
          type,
          count: matches.length,
          severity,
          message: `Detected ${matches.length} ${type}-related term(s)`
        });
      }
    }

    if (totalScore > 0.3) {
      recommendations.push('Review output for potentially harmful content');
    }

    return {
      score: Math.min(1, totalScore),
      concerns,
      recommendations
    };
  }

  /**
   * Check for prompt injection in output
   * @private
   */
  _checkInjection(text) {
    const concerns = [];
    const recommendations = [];
    let totalScore = 0;

    for (const [type, pattern] of Object.entries(INJECTION_PATTERNS)) {
      const matches = text.match(pattern) || [];
      if (matches.length > 0) {
        totalScore += matches.length * 0.3;

        concerns.push({
          category: SafetyCategory.INJECTION,
          type,
          count: matches.length,
          severity: 'high',
          message: `Detected ${type} pattern in output that may indicate injection attempt`
        });
      }
    }

    if (totalScore > 0) {
      recommendations.push('Output may contain injection patterns - verify content integrity');
    }

    return {
      score: Math.min(1, totalScore),
      concerns,
      recommendations
    };
  }

  /**
   * Check for hallucination (fabricated content)
   * @private
   */
  _checkHallucination(output, sourceContent) {
    const concerns = [];
    const recommendations = [];

    // Extract claims from output
    const outputText = this._outputToText(output);
    const claims = this._extractClaims(outputText);

    // Check claims against source content
    let unsupportedClaims = 0;
    const sourceWords = new Set(sourceContent.toLowerCase().split(/\W+/));

    for (const claim of claims) {
      const claimWords = claim.toLowerCase().split(/\W+/);
      const overlap = claimWords.filter(w => w.length > 3 && sourceWords.has(w)).length;
      const overlapRatio = overlap / claimWords.length;

      if (overlapRatio < 0.3) {
        unsupportedClaims++;
      }
    }

    const hallucinationRate = claims.length > 0 ? unsupportedClaims / claims.length : 0;

    if (hallucinationRate > this.config.hallucinationThreshold) {
      concerns.push({
        category: SafetyCategory.HALLUCINATION,
        type: 'unsupported_claims',
        severity: 'medium',
        message: `${Math.round(hallucinationRate * 100)}% of claims may not be supported by source content`,
        details: {
          totalClaims: claims.length,
          unsupportedClaims
        }
      });

      recommendations.push('Verify factual claims against source material');
    }

    return {
      score: hallucinationRate,
      concerns,
      recommendations
    };
  }

  /**
   * Extract factual claims from text
   * @private
   */
  _extractClaims(text) {
    // Simple claim extraction - sentences with factual indicators
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

    const factualIndicators = [
      /\b\d+%/,              // Percentages
      /\b\d{4}\b/,           // Years
      /\$[\d,]+/,            // Dollar amounts
      /\b(will|must|should)\b/i, // Strong claims
      /\b(increased|decreased|grew|fell)\b/i // Trend claims
    ];

    return sentences.filter(sentence => {
      return factualIndicators.some(pattern => pattern.test(sentence));
    });
  }

  /**
   * Determine overall safety level
   * @private
   */
  _determineSafetyLevel(scores, concerns) {
    // Check for blocking conditions
    const criticalConcerns = concerns.filter(c => c.severity === 'critical');
    if (criticalConcerns.length > 0) {
      return SafetyLevel.BLOCKED;
    }

    // Calculate weighted score
    const weights = {
      [SafetyCategory.PII]: 0.3,
      [SafetyCategory.HARMFUL]: 0.25,
      [SafetyCategory.INJECTION]: 0.25,
      [SafetyCategory.HALLUCINATION]: 0.15,
      [SafetyCategory.BIAS]: 0.05
    };

    let weightedScore = 0;
    for (const [category, weight] of Object.entries(weights)) {
      weightedScore += (scores[category] || 0) * weight;
    }

    // Determine level
    if (weightedScore >= 0.7) {
      return SafetyLevel.UNSAFE;
    } else if (weightedScore >= 0.3) {
      return SafetyLevel.CAUTION;
    }

    return SafetyLevel.SAFE;
  }
}

/**
 * Create a safety checker
 * @param {SafetyConfig} config - Configuration
 * @returns {OutputSafetyChecker}
 */
export function createSafetyChecker(config = {}) {
  return new OutputSafetyChecker(config);
}

// Singleton instance
let _instance = null;

/**
 * Get singleton safety checker
 * @param {SafetyConfig} config - Configuration (first call only)
 * @returns {OutputSafetyChecker}
 */
export function getSafetyChecker(config = {}) {
  if (!_instance) {
    _instance = new OutputSafetyChecker(config);
  }
  return _instance;
}

/**
 * Quick safety check
 * @param {*} output - Output to check
 * @param {Object} options - Check options
 * @returns {SafetyCheckResult}
 */
export function checkSafety(output, options = {}) {
  return getSafetyChecker().check(output, options);
}

export default OutputSafetyChecker;
