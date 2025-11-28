/**
 * Input Sanitizer - PROMPT ML Layer 1
 *
 * Sanitizes user input before processing to protect against:
 * - Prompt injection attacks
 * - Encoding exploits
 * - Delimiter manipulation
 *
 * Based on PROMPT ML design specification.
 */

/**
 * @typedef {Object} SanitizationResult
 * @property {string} original - Original input text
 * @property {string} sanitized - Sanitized output text
 * @property {string[]} modifications - List of modifications made
 * @property {boolean} isSafe - Whether input passed safety checks
 * @property {number} riskScore - Risk score from 0.0 to 1.0
 * @property {Object} details - Detailed risk breakdown
 */

/**
 * @typedef {Object} SanitizerConfig
 * @property {number} riskThreshold - Maximum acceptable risk score (default: 0.7)
 * @property {number} maxLength - Maximum input length (default: 500000)
 * @property {boolean} escapeDelimiters - Whether to escape prompt delimiters
 * @property {boolean} removeControlChars - Whether to remove control characters
 */

const DEFAULT_CONFIG = {
  riskThreshold: 0.7,
  maxLength: 500000,
  escapeDelimiters: true,
  removeControlChars: true
};

/**
 * Delimiter patterns that could be used for prompt injection
 * Maps pattern to safe replacement
 */
const DELIMITER_PATTERNS = [
  // System message delimiters
  { pattern: /```\s*system/gi, replacement: '` ` ` system' },
  { pattern: /```\s*assistant/gi, replacement: '` ` ` assistant' },
  { pattern: /```\s*user/gi, replacement: '` ` ` user' },

  // Chat ML delimiters
  { pattern: /<\|im_start\|>/gi, replacement: '< |im_start| >' },
  { pattern: /<\|im_end\|>/gi, replacement: '< |im_end| >' },
  { pattern: /<\|system\|>/gi, replacement: '< |system| >' },
  { pattern: /<\|user\|>/gi, replacement: '< |user| >' },
  { pattern: /<\|assistant\|>/gi, replacement: '< |assistant| >' },

  // Llama/Mistral delimiters
  { pattern: /\[INST\]/gi, replacement: '[ INST ]' },
  { pattern: /\[\/INST\]/gi, replacement: '[ /INST ]' },
  { pattern: /<<SYS>>/gi, replacement: '< <SYS> >' },
  { pattern: /<\/SYS>>/gi, replacement: '< /SYS> >' },

  // Role markers
  { pattern: /^Human:/gmi, replacement: 'Human :' },
  { pattern: /^Assistant:/gmi, replacement: 'Assistant :' },
  { pattern: /^System:/gmi, replacement: 'System :' },

  // Section markers that could confuse models
  { pattern: /###\s*(system|instruction|prompt)/gi, replacement: '# # # $1' }
];

/**
 * Suspicious patterns that increase risk score
 * Each pattern has a weight contributing to total risk
 */
const SUSPICIOUS_PATTERNS = [
  // Direct instruction override attempts
  { pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i, weight: 0.25, category: 'override' },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i, weight: 0.25, category: 'override' },
  { pattern: /forget\s+(all\s+)?(your|the)\s+(instructions?|rules?|training)/i, weight: 0.25, category: 'override' },
  { pattern: /override\s+(system|safety)\s+(prompt|instructions?)/i, weight: 0.3, category: 'override' },
  { pattern: /new\s+instructions?\s*:/i, weight: 0.2, category: 'override' },

  // Persona/roleplay attacks
  { pattern: /you\s+are\s+(now\s+)?(?:a|an|the)\s+\w+\s+(named|called)/i, weight: 0.2, category: 'persona' },
  { pattern: /pretend\s+(to\s+be|you\s+are|that\s+you)/i, weight: 0.2, category: 'persona' },
  { pattern: /roleplay\s+as/i, weight: 0.15, category: 'persona' },
  { pattern: /act\s+as\s+(if|though)/i, weight: 0.15, category: 'persona' },
  { pattern: /from\s+now\s+on,?\s+you\s+(are|will)/i, weight: 0.2, category: 'persona' },

  // Known jailbreak terms
  { pattern: /\bDAN\s+(mode|prompt)\b/i, weight: 0.3, category: 'jailbreak' },
  { pattern: /\bdeveloper\s+mode\b/i, weight: 0.25, category: 'jailbreak' },
  { pattern: /\bjailbreak\b/i, weight: 0.2, category: 'jailbreak' },
  { pattern: /\bbypass\s+(filters?|safety|restrictions?)\b/i, weight: 0.3, category: 'jailbreak' },
  { pattern: /\benable\s+unrestricted\s+mode\b/i, weight: 0.25, category: 'jailbreak' },

  // System prompt extraction
  { pattern: /what\s+(is|are)\s+your\s+(system\s+)?instructions?/i, weight: 0.15, category: 'extraction' },
  { pattern: /reveal\s+(your\s+)?(system\s+)?prompt/i, weight: 0.2, category: 'extraction' },
  { pattern: /show\s+me\s+(your\s+)?(hidden|system)\s+(prompt|instructions?)/i, weight: 0.2, category: 'extraction' },
  { pattern: /repeat\s+(everything|all)\s+(above|before)/i, weight: 0.15, category: 'extraction' }
];

/**
 * Input Sanitizer class
 */
export class InputSanitizer {
  /**
   * @param {SanitizerConfig} config - Configuration options
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main sanitization entry point
   *
   * @param {string} text - Input text to sanitize
   * @returns {SanitizationResult} Sanitization result
   */
  sanitize(text) {
    if (!text || typeof text !== 'string') {
      return {
        original: text || '',
        sanitized: '',
        modifications: [],
        isSafe: true,
        riskScore: 0,
        details: { categories: {} }
      };
    }

    const modifications = [];
    let sanitized = text;

    // Step 1: Normalize encoding (UTF-8)
    const [afterEncoding, encodingMod] = this._normalizeEncoding(sanitized);
    sanitized = afterEncoding;
    if (encodingMod) modifications.push(encodingMod);

    // Step 2: Remove null bytes and control characters
    if (this.config.removeControlChars) {
      const [afterControl, controlMod] = this._removeControlChars(sanitized);
      sanitized = afterControl;
      if (controlMod) modifications.push(controlMod);
    }

    // Step 3: Normalize whitespace
    const [afterWhitespace, whitespaceMod] = this._normalizeWhitespace(sanitized);
    sanitized = afterWhitespace;
    if (whitespaceMod) modifications.push(whitespaceMod);

    // Step 4: Escape prompt delimiters
    if (this.config.escapeDelimiters) {
      const [afterDelimiters, delimiterMod] = this._escapeDelimiters(sanitized);
      sanitized = afterDelimiters;
      if (delimiterMod) modifications.push(delimiterMod);
    }

    // Step 5: Truncate to max length
    const [afterTruncate, truncateMod] = this._truncate(sanitized);
    sanitized = afterTruncate;
    if (truncateMod) modifications.push(truncateMod);

    // Step 6: Calculate risk score
    const riskDetails = this._calculateRiskScore(text, sanitized, modifications);

    return {
      original: text,
      sanitized,
      modifications,
      isSafe: riskDetails.totalScore < this.config.riskThreshold,
      riskScore: riskDetails.totalScore,
      details: riskDetails
    };
  }

  /**
   * Normalize text encoding to UTF-8
   * @private
   */
  _normalizeEncoding(text) {
    try {
      // Attempt to detect and fix encoding issues
      const normalized = text
        // Remove BOM
        .replace(/^\uFEFF/, '')
        // Replace common encoding artifacts
        .replace(/\uFFFD/g, '') // Replacement character
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Control chars except tab, newline, CR

      if (normalized !== text) {
        return [normalized, 'Normalized text encoding'];
      }
      return [text, null];
    } catch (e) {
      return [text, null];
    }
  }

  /**
   * Remove control characters except whitespace
   * @private
   */
  _removeControlChars(text) {
    // Keep tabs, newlines, carriage returns
    const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    if (cleaned !== text) {
      const removedCount = text.length - cleaned.length;
      return [cleaned, `Removed ${removedCount} control character(s)`];
    }
    return [text, null];
  }

  /**
   * Normalize whitespace
   * @private
   */
  _normalizeWhitespace(text) {
    const normalized = text
      // Replace multiple spaces/tabs with single space (preserve newlines)
      .replace(/[^\S\n]+/g, ' ')
      // Replace more than 2 consecutive newlines with 2
      .replace(/\n{3,}/g, '\n\n')
      // Trim each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Final trim
      .trim();

    if (normalized !== text) {
      return [normalized, 'Normalized whitespace'];
    }
    return [text, null];
  }

  /**
   * Escape prompt delimiter sequences
   * @private
   */
  _escapeDelimiters(text) {
    let result = text;
    let modified = false;
    const escapedPatterns = [];

    for (const { pattern, replacement } of DELIMITER_PATTERNS) {
      // Reset regex lastIndex BEFORE test() to ensure all matches are found
      pattern.lastIndex = 0;
      if (pattern.test(result)) {
        pattern.lastIndex = 0; // Reset again before replace()
        result = result.replace(pattern, replacement);
        modified = true;
        escapedPatterns.push(pattern.source);
      }
    }

    if (modified) {
      return [result, `Escaped ${escapedPatterns.length} delimiter pattern(s)`];
    }
    return [text, null];
  }

  /**
   * Truncate text to maximum length
   * @private
   */
  _truncate(text) {
    if (text.length > this.config.maxLength) {
      const truncated = text.slice(0, this.config.maxLength);
      return [truncated, `Truncated from ${text.length} to ${this.config.maxLength} characters`];
    }
    return [text, null];
  }

  /**
   * Calculate comprehensive risk score
   * @private
   */
  _calculateRiskScore(original, sanitized, modifications) {
    let totalScore = 0;
    const categories = {};
    const matchedPatterns = [];

    // Factor 1: Suspicious pattern detection (up to 0.6)
    for (const { pattern, weight, category } of SUSPICIOUS_PATTERNS) {
      pattern.lastIndex = 0; // Reset for global patterns
      const matches = original.match(pattern);
      if (matches) {
        totalScore += weight;
        matchedPatterns.push({ pattern: pattern.source, category, weight });

        if (!categories[category]) {
          categories[category] = { score: 0, matches: [] };
        }
        categories[category].score += weight;
        categories[category].matches.push(...matches);
      }
    }

    // Factor 2: Modification ratio (up to 0.2)
    if (original.length > 0) {
      const modRatio = Math.abs(original.length - sanitized.length) / original.length;
      const modScore = Math.min(0.2, modRatio * 0.5);
      if (modScore > 0.05) {
        totalScore += modScore;
        categories['modification'] = {
          score: modScore,
          ratio: modRatio,
          details: modifications
        };
      }
    }

    // Factor 3: Unusual character distribution (up to 0.1)
    const charDistScore = this._analyzeCharDistribution(original);
    if (charDistScore > 0) {
      totalScore += charDistScore;
      categories['charDistribution'] = { score: charDistScore };
    }

    // Factor 4: Excessive special characters (up to 0.1)
    const specialCharRatio = (original.match(/[^\w\s.,!?;:'"()-]/g) || []).length / Math.max(1, original.length);
    if (specialCharRatio > 0.15) {
      const specialScore = Math.min(0.1, (specialCharRatio - 0.15) * 0.5);
      totalScore += specialScore;
      categories['specialChars'] = { score: specialScore, ratio: specialCharRatio };
    }

    return {
      totalScore: Math.min(1.0, totalScore),
      categories,
      matchedPatterns,
      modificationCount: modifications.length
    };
  }

  /**
   * Analyze character distribution for anomalies
   * @private
   */
  _analyzeCharDistribution(text) {
    if (text.length < 100) return 0;

    // Check for unusual Unicode character concentration
    const nonAsciiRatio = (text.match(/[^\x00-\x7F]/g) || []).length / text.length;

    // Check for homoglyph attacks (lookalike characters)
    const homoglyphs = /[\u0430\u0435\u043E\u0440\u0441\u0443\u0445\u0456\u0458]/g; // Cyrillic lookalikes
    const homoglyphCount = (text.match(homoglyphs) || []).length;

    // Check for zero-width characters (often used in obfuscation)
    const zeroWidth = /[\u200B\u200C\u200D\uFEFF]/g;
    const zeroWidthCount = (text.match(zeroWidth) || []).length;

    let score = 0;

    // High non-ASCII in what looks like English text
    const looksEnglish = /^[a-zA-Z\s.,!?]+/.test(text.slice(0, 100));
    if (looksEnglish && nonAsciiRatio > 0.05) {
      score += Math.min(0.05, nonAsciiRatio * 0.5);
    }

    if (homoglyphCount > 0) {
      score += Math.min(0.05, homoglyphCount * 0.01);
    }

    if (zeroWidthCount > 0) {
      score += Math.min(0.05, zeroWidthCount * 0.02);
    }

    return Math.min(0.1, score);
  }
}

/**
 * Create a sanitizer with default configuration
 * @param {SanitizerConfig} config - Optional configuration
 * @returns {InputSanitizer}
 */
export function createSanitizer(config = {}) {
  return new InputSanitizer(config);
}

/**
 * Quick sanitize function for simple use cases
 * @param {string} text - Input text
 * @param {SanitizerConfig} config - Optional configuration
 * @returns {SanitizationResult}
 */
export function sanitize(text, config = {}) {
  const sanitizer = new InputSanitizer(config);
  return sanitizer.sanitize(text);
}

export default InputSanitizer;
