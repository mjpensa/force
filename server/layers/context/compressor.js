/**
 * Content Compressor - PROMPT ML Layer 2
 *
 * Intelligent content compression techniques:
 * - Section extraction (keep most relevant sections)
 * - Redundancy removal (deduplicate similar content)
 * - Summarization hints (mark content for summarization)
 * - Structural compression (simplify formatting)
 *
 * Based on PROMPT ML design specification.
 */

import { getTokenCounter } from './token-counter.js';

/**
 * Compression strategies
 * @readonly
 * @enum {string}
 */
export const CompressionStrategy = {
  NONE: 'none',                    // No compression
  STRUCTURAL: 'structural',        // Remove formatting, simplify structure
  EXTRACTIVE: 'extractive',        // Keep key sections only
  REDUNDANCY: 'redundancy',        // Remove duplicate/similar content
  AGGRESSIVE: 'aggressive'         // Combine all strategies
};

/**
 * @typedef {Object} CompressionResult
 * @property {string} content - Compressed content
 * @property {number} originalTokens - Original token count
 * @property {number} compressedTokens - Compressed token count
 * @property {number} compressionRatio - Compression ratio (0-1)
 * @property {string[]} appliedStrategies - Strategies that were applied
 * @property {Object} metadata - Compression metadata
 */

/**
 * @typedef {Object} CompressorConfig
 * @property {number} targetRatio - Target compression ratio (default: 0.7)
 * @property {boolean} preserveHeadings - Keep heading structure
 * @property {boolean} preserveLists - Keep list items
 * @property {number} minParagraphLength - Minimum paragraph length to keep
 */

const DEFAULT_CONFIG = {
  targetRatio: 0.7,
  preserveHeadings: true,
  preserveLists: true,
  minParagraphLength: 50,
  prioritySections: [
    'summary', 'abstract', 'introduction', 'conclusion',
    'key findings', 'recommendations', 'overview', 'executive summary'
  ]
};

/**
 * Content Compressor class
 */
export class ContentCompressor {
  /**
   * @param {CompressorConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tokenCounter = getTokenCounter();
  }

  /**
   * Compress content to target token count
   *
   * @param {string} content - Content to compress
   * @param {number} targetTokens - Target token count
   * @param {Object} options - Compression options
   * @returns {CompressionResult} Compression result
   */
  compress(content, targetTokens, options = {}) {
    const { strategy = CompressionStrategy.AGGRESSIVE } = options;

    const originalTokens = this.tokenCounter.count(content).tokens;

    // If already under target, return as-is
    if (originalTokens <= targetTokens) {
      return {
        content,
        originalTokens,
        compressedTokens: originalTokens,
        compressionRatio: 1.0,
        appliedStrategies: [],
        metadata: { noCompressionNeeded: true }
      };
    }

    let result = content;
    const appliedStrategies = [];
    let currentTokens = originalTokens;

    // Apply strategies based on chosen approach
    if (strategy === CompressionStrategy.STRUCTURAL || strategy === CompressionStrategy.AGGRESSIVE) {
      result = this._applyStructuralCompression(result);
      currentTokens = this.tokenCounter.count(result).tokens;
      appliedStrategies.push('structural');

      if (currentTokens <= targetTokens) {
        return this._buildResult(content, result, originalTokens, appliedStrategies);
      }
    }

    if (strategy === CompressionStrategy.REDUNDANCY || strategy === CompressionStrategy.AGGRESSIVE) {
      result = this._removeRedundancy(result);
      currentTokens = this.tokenCounter.count(result).tokens;
      appliedStrategies.push('redundancy');

      if (currentTokens <= targetTokens) {
        return this._buildResult(content, result, originalTokens, appliedStrategies);
      }
    }

    if (strategy === CompressionStrategy.EXTRACTIVE || strategy === CompressionStrategy.AGGRESSIVE) {
      result = this._extractiveSummarization(result, targetTokens);
      currentTokens = this.tokenCounter.count(result).tokens;
      appliedStrategies.push('extractive');

      if (currentTokens <= targetTokens) {
        return this._buildResult(content, result, originalTokens, appliedStrategies);
      }
    }

    // Final fallback: hard truncation
    if (currentTokens > targetTokens) {
      result = this._hardTruncate(result, targetTokens);
      appliedStrategies.push('truncation');
    }

    return this._buildResult(content, result, originalTokens, appliedStrategies);
  }

  /**
   * Compress multiple files with budget allocation
   *
   * @param {Object[]} files - Array of {filename, content}
   * @param {number} totalBudget - Total token budget for all files
   * @param {Object} options - Compression options
   * @returns {Object[]} Compressed files
   */
  compressMultiple(files, totalBudget, options = {}) {
    if (!files || files.length === 0) {
      return [];
    }

    // Calculate current totals
    const filesWithTokens = files.map(file => ({
      ...file,
      tokens: this.tokenCounter.count(file.content).tokens
    }));

    const totalTokens = filesWithTokens.reduce((sum, f) => sum + f.tokens, 0);

    // If under budget, return as-is
    if (totalTokens <= totalBudget) {
      return files;
    }

    // Calculate proportional budgets
    const compressionNeeded = totalBudget / totalTokens;

    return filesWithTokens.map(file => {
      const fileBudget = Math.floor(file.tokens * compressionNeeded);
      const compressed = this.compress(file.content, fileBudget, options);

      return {
        filename: file.filename,
        content: compressed.content,
        compressionApplied: compressed.appliedStrategies.length > 0,
        originalTokens: file.tokens,
        compressedTokens: compressed.compressedTokens
      };
    });
  }

  /**
   * Extract key sections from content
   *
   * @param {string} content - Content to extract from
   * @param {string[]} sectionNames - Section names to prioritize
   * @returns {Object} Extracted sections
   */
  extractKeySections(content, sectionNames = this.config.prioritySections) {
    const sections = this._parseSections(content);
    const extracted = [];
    const remaining = [];

    for (const section of sections) {
      const sectionNameLower = section.heading.toLowerCase();
      const isPriority = sectionNames.some(name =>
        sectionNameLower.includes(name.toLowerCase())
      );

      if (isPriority) {
        extracted.push(section);
      } else {
        remaining.push(section);
      }
    }

    return {
      prioritySections: extracted,
      otherSections: remaining,
      priorityContent: extracted.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n'),
      otherContent: remaining.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n')
    };
  }

  // ============================================================================
  // Compression Strategies
  // ============================================================================

  /**
   * Apply structural compression
   * @private
   */
  _applyStructuralCompression(content) {
    let result = content;

    // Remove excessive whitespace
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.replace(/[ \t]+/g, ' ');

    // Simplify markdown formatting
    result = result.replace(/\*\*([^*]+)\*\*/g, '$1');  // Remove bold
    result = result.replace(/__([^_]+)__/g, '$1');      // Remove bold alt
    result = result.replace(/\*([^*]+)\*/g, '$1');      // Remove italic
    result = result.replace(/_([^_]+)_/g, '$1');        // Remove italic alt

    // Remove horizontal rules
    result = result.replace(/^[-*_]{3,}$/gm, '');

    // Simplify headers to just ## level
    result = result.replace(/^#{4,}\s+/gm, '### ');

    // Remove empty list items
    result = result.replace(/^[-*•]\s*$/gm, '');

    // Collapse multiple blank lines
    result = result.replace(/\n\n\n+/g, '\n\n');

    // Remove trailing whitespace
    result = result.split('\n').map(line => line.trimEnd()).join('\n');

    return result.trim();
  }

  /**
   * Remove redundant/duplicate content
   * @private
   */
  _removeRedundancy(content) {
    const paragraphs = content.split(/\n\n+/);
    const seen = new Map(); // Hash -> index
    const unique = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed.length < this.config.minParagraphLength) {
        // Keep short paragraphs (likely headers or important)
        if (trimmed.length > 0) {
          unique.push(trimmed);
        }
        continue;
      }

      // Create a normalized hash for comparison
      const hash = this._hashParagraph(trimmed);

      if (!seen.has(hash)) {
        seen.set(hash, unique.length);
        unique.push(trimmed);
      }
      // Skip duplicates
    }

    return unique.join('\n\n');
  }

  /**
   * Extractive summarization - keep most important sentences
   * @private
   */
  _extractiveSummarization(content, targetTokens) {
    // Parse into sections
    const sections = this._parseSections(content);

    if (sections.length === 0) {
      // No sections, do sentence-level extraction
      return this._extractTopSentences(content, targetTokens);
    }

    // Score sections by importance
    const scoredSections = sections.map(section => ({
      ...section,
      score: this._scoreSectionImportance(section)
    }));

    // Sort by score (descending)
    scoredSections.sort((a, b) => b.score - a.score);

    // Build result by adding sections until budget reached
    let result = '';
    let currentTokens = 0;

    for (const section of scoredSections) {
      const sectionText = `## ${section.heading}\n\n${section.content}`;
      const sectionTokens = this.tokenCounter.count(sectionText).tokens;

      if (currentTokens + sectionTokens <= targetTokens) {
        result += (result ? '\n\n' : '') + sectionText;
        currentTokens += sectionTokens;
      } else if (currentTokens === 0) {
        // First section doesn't fit - compress it
        const compressed = this._extractTopSentences(section.content, targetTokens - 100);
        result = `## ${section.heading}\n\n${compressed}`;
        break;
      }
    }

    if (!result) {
      // Fallback to sentence extraction
      return this._extractTopSentences(content, targetTokens);
    }

    return result;
  }

  /**
   * Extract top sentences by importance
   * @private
   */
  _extractTopSentences(content, targetTokens) {
    // Split into sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];

    // Score sentences
    const scored = sentences.map((sentence, index) => ({
      text: sentence.trim(),
      index,
      score: this._scoreSentenceImportance(sentence, index, sentences.length)
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Select top sentences that fit
    const selected = [];
    let currentTokens = 0;

    for (const item of scored) {
      const sentenceTokens = this.tokenCounter.count(item.text).tokens;

      if (currentTokens + sentenceTokens <= targetTokens) {
        selected.push(item);
        currentTokens += sentenceTokens;
      }
    }

    // Re-sort by original order for coherence
    selected.sort((a, b) => a.index - b.index);

    return selected.map(s => s.text).join(' ');
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Build compression result object
   * @private
   */
  _buildResult(original, compressed, originalTokens, strategies) {
    const compressedTokens = this.tokenCounter.count(compressed).tokens;

    return {
      content: compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
      appliedStrategies: strategies,
      metadata: {
        tokensSaved: originalTokens - compressedTokens,
        percentReduction: ((1 - compressedTokens / originalTokens) * 100).toFixed(1) + '%'
      }
    };
  }

  /**
   * Parse content into sections
   * @private
   */
  _parseSections(content) {
    const sections = [];
    const parts = content.split(/(?=^##?\s+)/m);

    for (const part of parts) {
      const match = part.match(/^(#{1,3})\s+(.+?)(?:\n|$)/);
      if (match) {
        sections.push({
          level: match[1].length,
          heading: match[2].trim(),
          content: part.slice(match[0].length).trim()
        });
      } else if (part.trim() && sections.length === 0) {
        // Content before first heading
        sections.push({
          level: 0,
          heading: 'Introduction',
          content: part.trim()
        });
      }
    }

    return sections;
  }

  /**
   * Score section importance
   * @private
   */
  _scoreSectionImportance(section) {
    let score = 0;

    // Priority sections get higher base score
    const headingLower = section.heading.toLowerCase();
    for (const priority of this.config.prioritySections) {
      if (headingLower.includes(priority)) {
        score += 10;
        break;
      }
    }

    // Higher level headings (## vs ###) are more important
    score += (4 - section.level) * 2;

    // Longer content might be more substantial
    const contentLength = section.content.length;
    if (contentLength > 500) score += 2;
    if (contentLength > 1000) score += 2;

    // Content with data indicators
    if (/\d+%|\$[\d,]+|\d+\.\d+/g.test(section.content)) {
      score += 3; // Contains numbers/metrics
    }

    return score;
  }

  /**
   * Score sentence importance
   * @private
   */
  _scoreSentenceImportance(sentence, index, totalSentences) {
    let score = 0;

    // Position bonus (first and last sentences often important)
    if (index < 3) score += 3;
    if (index >= totalSentences - 3) score += 2;

    // Length bonus (medium length usually best)
    const words = sentence.split(/\s+/).length;
    if (words >= 10 && words <= 30) score += 2;

    // Contains important indicators
    if (/\b(important|key|main|significant|conclusion|result|finding)\b/i.test(sentence)) {
      score += 3;
    }

    // Contains data
    if (/\d+%|\d+\.\d+|\$[\d,]+/.test(sentence)) {
      score += 2;
    }

    // Is a definition or statement
    if (/\b(is|are|was|were|will be)\b/i.test(sentence)) {
      score += 1;
    }

    return score;
  }

  /**
   * Create hash for paragraph deduplication
   * @private
   */
  _hashParagraph(text) {
    // Normalize for comparison
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100); // Use first 100 chars for hash

    // Simple hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Hard truncate to token limit
   * @private
   */
  _hardTruncate(content, targetTokens) {
    const capacity = this.tokenCounter.estimateCapacity(targetTokens);
    let result = content.slice(0, capacity.estimatedCharacters);

    // Find good break point
    const lastPara = result.lastIndexOf('\n\n');
    if (lastPara > result.length * 0.7) {
      result = result.slice(0, lastPara);
    } else {
      const lastSentence = result.lastIndexOf('. ');
      if (lastSentence > result.length * 0.8) {
        result = result.slice(0, lastSentence + 1);
      }
    }

    return result.trim() + '\n\n[Content compressed]';
  }
}

/**
 * Create a content compressor with configuration
 * @param {CompressorConfig} config - Configuration
 * @returns {ContentCompressor}
 */
export function createCompressor(config = {}) {
  return new ContentCompressor(config);
}

// Singleton instance
let _instance = null;

/**
 * Get or create singleton compressor
 * @param {CompressorConfig} config - Configuration (only used on first call)
 * @returns {ContentCompressor}
 */
export function getCompressor(config = {}) {
  if (!_instance) {
    _instance = new ContentCompressor(config);
  }
  return _instance;
}

/**
 * Quick compress function
 * @param {string} content - Content to compress
 * @param {number} targetTokens - Target token count
 * @returns {CompressionResult}
 */
export function compressContent(content, targetTokens) {
  return getCompressor().compress(content, targetTokens);
}

export default ContentCompressor;
