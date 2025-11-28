/**
 * Token Counter - PROMPT ML Layer 2
 *
 * Estimates token counts for text content to enable token budgeting.
 * Uses character-based estimation with model-specific adjustments.
 *
 * Based on PROMPT ML design specification.
 */

/**
 * @typedef {Object} TokenCountResult
 * @property {number} tokens - Estimated token count
 * @property {number} characters - Character count
 * @property {number} words - Word count
 * @property {string} method - Estimation method used
 */

/**
 * @typedef {Object} TokenCounterConfig
 * @property {string} model - Model family for estimation adjustments
 * @property {number} charsPerToken - Base characters per token ratio
 * @property {boolean} countWhitespace - Whether to count whitespace
 */

const DEFAULT_CONFIG = {
  model: 'gemini',
  charsPerToken: 4,      // Gemini averages ~4 chars per token for English
  countWhitespace: true
};

/**
 * Model-specific adjustment factors
 * Different models tokenize differently
 */
const MODEL_ADJUSTMENTS = {
  'gemini': 1.0,
  'gpt': 0.9,       // GPT tends to have slightly more tokens
  'claude': 0.95,
  'default': 1.0
};

/**
 * Content type adjustments
 * Some content types tokenize differently
 */
const CONTENT_TYPE_ADJUSTMENTS = {
  'code': 0.7,        // Code has more symbols, fewer tokens per char
  'json': 0.75,       // JSON has structure overhead
  'markdown': 0.9,    // Markdown has formatting tokens
  'prose': 1.0,       // Standard prose
  'technical': 0.85   // Technical content has more acronyms
};

/**
 * Token Counter class
 */
export class TokenCounter {
  /**
   * @param {TokenCounterConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Count tokens in text
   *
   * @param {string} text - Text to count
   * @param {Object} options - Counting options
   * @param {string} options.contentType - Type of content for adjustments
   * @returns {TokenCountResult} Token count result
   */
  count(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return {
        tokens: 0,
        characters: 0,
        words: 0,
        method: 'empty'
      };
    }

    const { contentType = 'prose' } = options;

    // Basic counts
    const characters = text.length;
    const words = this._countWords(text);

    // Estimate tokens
    const baseTokens = this._estimateTokens(text);

    // Apply adjustments
    const modelAdjustment = MODEL_ADJUSTMENTS[this.config.model] || MODEL_ADJUSTMENTS.default;
    const contentAdjustment = CONTENT_TYPE_ADJUSTMENTS[contentType] || 1.0;

    const tokens = Math.ceil(baseTokens * modelAdjustment * contentAdjustment);

    return {
      tokens,
      characters,
      words,
      method: 'char-ratio'
    };
  }

  /**
   * Count tokens in multiple text segments
   *
   * @param {string[]} texts - Array of texts
   * @param {Object} options - Options passed to count()
   * @returns {Object} Combined result with breakdown
   */
  countMultiple(texts, options = {}) {
    const results = texts.map(text => this.count(text, options));

    return {
      total: {
        tokens: results.reduce((sum, r) => sum + r.tokens, 0),
        characters: results.reduce((sum, r) => sum + r.characters, 0),
        words: results.reduce((sum, r) => sum + r.words, 0)
      },
      breakdown: results
    };
  }

  /**
   * Check if text fits within token budget
   *
   * @param {string} text - Text to check
   * @param {number} budget - Token budget
   * @param {Object} options - Options passed to count()
   * @returns {Object} Fit check result
   */
  fitsInBudget(text, budget, options = {}) {
    const result = this.count(text, options);

    return {
      fits: result.tokens <= budget,
      tokens: result.tokens,
      budget,
      overage: Math.max(0, result.tokens - budget),
      utilizationPercent: (result.tokens / budget) * 100
    };
  }

  /**
   * Estimate how much text can fit in a token budget
   *
   * @param {number} tokenBudget - Available tokens
   * @param {string} contentType - Type of content
   * @returns {Object} Capacity estimates
   */
  estimateCapacity(tokenBudget, contentType = 'prose') {
    const contentAdjustment = CONTENT_TYPE_ADJUSTMENTS[contentType] || 1.0;
    const modelAdjustment = MODEL_ADJUSTMENTS[this.config.model] || 1.0;

    const effectiveCharsPerToken = this.config.charsPerToken / (modelAdjustment * contentAdjustment);
    const estimatedChars = Math.floor(tokenBudget * effectiveCharsPerToken);
    const estimatedWords = Math.floor(estimatedChars / 5); // Average word length

    return {
      tokenBudget,
      estimatedCharacters: estimatedChars,
      estimatedWords,
      contentType
    };
  }

  /**
   * Split text to fit within token budget
   *
   * @param {string} text - Text to split
   * @param {number} maxTokens - Maximum tokens per chunk
   * @param {Object} options - Options
   * @returns {string[]} Array of text chunks
   */
  splitToFit(text, maxTokens, options = {}) {
    const { preserveParagraphs = true, overlap = 0 } = options;

    const chunks = [];
    const capacity = this.estimateCapacity(maxTokens);

    if (preserveParagraphs) {
      // Split by paragraphs and group them
      const paragraphs = text.split(/\n\n+/);
      let currentChunk = '';
      let currentTokens = 0;

      for (const para of paragraphs) {
        const paraTokens = this.count(para).tokens;

        if (currentTokens + paraTokens > maxTokens && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = overlap > 0 ? this._getOverlapText(currentChunk, overlap) : '';
          currentTokens = this.count(currentChunk).tokens;
        }

        currentChunk += (currentChunk ? '\n\n' : '') + para;
        currentTokens += paraTokens;
      }

      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    } else {
      // Simple character-based splitting
      const charsPerChunk = capacity.estimatedCharacters;
      for (let i = 0; i < text.length; i += charsPerChunk) {
        chunks.push(text.slice(i, i + charsPerChunk));
      }
    }

    return chunks;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Estimate tokens using character ratio method
   * @private
   */
  _estimateTokens(text) {
    // Base estimation
    let tokens = text.length / this.config.charsPerToken;

    // Adjust for special characters (they often become separate tokens)
    const specialChars = (text.match(/[^\w\s]/g) || []).length;
    tokens += specialChars * 0.3; // Special chars add ~30% extra tokens

    // Adjust for numbers (often tokenized as individual digits)
    const numbers = (text.match(/\d+/g) || []);
    const numberDigits = numbers.reduce((sum, n) => sum + n.length, 0);
    tokens += numberDigits * 0.2; // Numbers add ~20% overhead

    // Adjust for code blocks (syntax tokens)
    const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
    tokens += codeBlocks * 5; // Code blocks add delimiter tokens

    // Adjust for URLs (usually tokenized heavily)
    const urls = (text.match(/https?:\/\/[^\s]+/g) || []).length;
    tokens += urls * 10; // URLs add many tokens

    return Math.ceil(tokens);
  }

  /**
   * Count words in text
   * @private
   */
  _countWords(text) {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  }

  /**
   * Get overlap text from end of chunk
   * @private
   */
  _getOverlapText(text, overlapTokens) {
    const capacity = this.estimateCapacity(overlapTokens);
    return text.slice(-capacity.estimatedCharacters);
  }
}

/**
 * Create a token counter with configuration
 * @param {TokenCounterConfig} config - Configuration
 * @returns {TokenCounter}
 */
export function createTokenCounter(config = {}) {
  return new TokenCounter(config);
}

// Singleton instance
let _instance = null;

/**
 * Get or create singleton token counter
 * @param {TokenCounterConfig} config - Configuration (only used on first call)
 * @returns {TokenCounter}
 */
export function getTokenCounter(config = {}) {
  if (!_instance) {
    _instance = new TokenCounter(config);
  }
  return _instance;
}

/**
 * Quick token count function
 * @param {string} text - Text to count
 * @param {Object} options - Options
 * @returns {number} Token count
 */
export function countTokens(text, options = {}) {
  return getTokenCounter().count(text, options).tokens;
}

/**
 * Check if text fits in budget
 * @param {string} text - Text to check
 * @param {number} budget - Token budget
 * @returns {boolean} Whether text fits
 */
export function fitsInBudget(text, budget) {
  return getTokenCounter().fitsInBudget(text, budget).fits;
}

export default TokenCounter;
