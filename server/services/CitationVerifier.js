/**
 * CitationVerifier - Verifies citations against source documents
 *
 * Features:
 * - Exact quote matching
 * - Fuzzy string matching (Levenshtein distance)
 * - Character range validation
 * - Citation quality scoring
 */

export class CitationVerifier {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.config = {
      maxLevenshteinDistance: options.maxLevenshteinDistance || 5,
      similarityThreshold: options.similarityThreshold || 0.85,
      contextWindowSize: options.contextWindowSize || 200,
      ...options
    };
  }

  /**
   * Verify a citation against source documents
   * @param {Object} citation - Citation object with documentName, exactQuote, startChar, endChar
   * @param {Array} sourceDocuments - Array of {name, content} objects
   * @returns {Object} Verification result
   */
  async verifyCitation(citation, sourceDocuments) {
    try {
      // Find the source document
      const sourceDoc = sourceDocuments.find(doc => doc.name === citation.documentName);

      if (!sourceDoc) {
        return {
          valid: false,
          reason: 'Document not found',
          score: 0,
          details: {
            documentFound: false
          }
        };
      }

      // Verify character range
      const rangeValid = this.verifyCharacterRange(
        citation.startChar,
        citation.endChar,
        sourceDoc.content
      );

      if (!rangeValid.valid) {
        return {
          valid: false,
          reason: rangeValid.reason,
          score: 0,
          details: rangeValid
        };
      }

      // Extract text at specified range
      const extractedText = sourceDoc.content.substring(
        citation.startChar,
        citation.endChar
      );

      // Check for exact match
      const exactMatch = this.checkExactMatch(citation.exactQuote, extractedText);

      if (exactMatch.isMatch) {
        return {
          valid: true,
          reason: 'Exact match found',
          score: 1.0,
          matchType: 'exact',
          details: exactMatch
        };
      }

      // Try fuzzy matching
      const fuzzyMatch = this.checkFuzzyMatch(citation.exactQuote, extractedText);

      if (fuzzyMatch.isMatch) {
        return {
          valid: true,
          reason: 'Fuzzy match found',
          score: fuzzyMatch.similarity,
          matchType: 'fuzzy',
          details: fuzzyMatch
        };
      }

      // Try searching in broader context
      const contextMatch = this.searchInContext(
        citation.exactQuote,
        sourceDoc.content,
        citation.startChar,
        citation.endChar
      );

      if (contextMatch.found) {
        return {
          valid: true,
          reason: 'Found in nearby context',
          score: contextMatch.score,
          matchType: 'context',
          details: contextMatch
        };
      }

      return {
        valid: false,
        reason: 'Quote not found in document',
        score: 0,
        matchType: 'none',
        details: {
          documentFound: true,
          rangeValid: true,
          extractedText: extractedText.substring(0, 100) + '...'
        }
      };

    } catch (error) {
      this.logger.error('Citation verification error:', error);
      return {
        valid: false,
        reason: `Verification error: ${error.message}`,
        score: 0
      };
    }
  }

  /**
   * Verify character range is valid
   */
  verifyCharacterRange(startChar, endChar, content) {
    if (startChar < 0) {
      return {
        valid: false,
        reason: 'Start character is negative'
      };
    }

    if (endChar > content.length) {
      return {
        valid: false,
        reason: 'End character exceeds document length'
      };
    }

    if (startChar >= endChar) {
      return {
        valid: false,
        reason: 'Start character must be less than end character'
      };
    }

    return {
      valid: true,
      extractedLength: endChar - startChar
    };
  }

  /**
   * Check for exact string match
   */
  checkExactMatch(quote, extractedText) {
    const normalized1 = this.normalizeText(quote);
    const normalized2 = this.normalizeText(extractedText);

    return {
      isMatch: normalized1 === normalized2,
      quote: quote,
      extractedText: extractedText
    };
  }

  /**
   * Check fuzzy match using Levenshtein distance
   */
  checkFuzzyMatch(quote, extractedText) {
    const normalized1 = this.normalizeText(quote);
    const normalized2 = this.normalizeText(extractedText);

    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = maxLength > 0 ? 1 - (distance / maxLength) : 0;

    return {
      isMatch: similarity >= this.config.similarityThreshold,
      similarity: similarity,
      distance: distance,
      threshold: this.config.similarityThreshold
    };
  }

  /**
   * Search for quote in context window around specified range
   */
  searchInContext(quote, content, startChar, endChar) {
    const windowSize = this.config.contextWindowSize;
    const contextStart = Math.max(0, startChar - windowSize);
    const contextEnd = Math.min(content.length, endChar + windowSize);
    const contextText = content.substring(contextStart, contextEnd);

    const normalizedQuote = this.normalizeText(quote);
    const normalizedContext = this.normalizeText(contextText);

    // Try to find exact match in context
    if (normalizedContext.includes(normalizedQuote)) {
      const index = normalizedContext.indexOf(normalizedQuote);
      return {
        found: true,
        score: 0.9, // Slightly lower than exact match at specified range
        actualStartChar: contextStart + index,
        distanceFromSpecified: Math.abs((contextStart + index) - startChar)
      };
    }

    // Try fuzzy search within context
    const words = normalizedQuote.split(/\s+/);
    if (words.length > 3) {
      // Look for substantial portion of quote
      const keyPhrase = words.slice(0, Math.floor(words.length / 2)).join(' ');
      if (normalizedContext.includes(keyPhrase)) {
        return {
          found: true,
          score: 0.75,
          matchType: 'partial'
        };
      }
    }

    return {
      found: false
    };
  }

  /**
   * Normalize text for comparison
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Batch verify multiple citations
   */
  async batchVerify(citations, sourceDocuments) {
    const results = [];

    for (const citation of citations) {
      const result = await this.verifyCitation(citation, sourceDocuments);
      results.push({
        citation,
        ...result
      });
    }

    return {
      results,
      summary: {
        total: results.length,
        valid: results.filter(r => r.valid).length,
        invalid: results.filter(r => !r.valid).length,
        averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length || 0
      }
    };
  }
}
