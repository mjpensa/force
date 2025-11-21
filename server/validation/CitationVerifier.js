/**
 * Citation Verifier
 * Validates that explicit facts have proper citations and verifies citation accuracy
 *
 * Verification Types:
 * 1. Explicit fact citation - Verify exact quote exists in source document
 * 2. Character range validation - Verify startChar/endChar match exactQuote
 * 3. Supporting facts validation - For inferences, verify supporting facts exist
 * 4. Document availability - Ensure cited documents are in the source set
 */

export class CitationVerifier {
  constructor() {
    this.verificationCache = new Map();
  }

  /**
   * Verify a claim's citation against source documents
   * @param {Object} claim - Claim object with source citation
   * @param {Array} sourceDocuments - Array of {name, content} objects
   * @returns {Promise<Object>} Verification result
   */
  async verifyCitation(claim, sourceDocuments) {
    // Check cache first
    const cacheKey = `${claim.id}-${claim.source.documentName}`;
    if (this.verificationCache.has(cacheKey)) {
      return this.verificationCache.get(cacheKey);
    }

    let result;

    // For explicit facts with citations
    if (claim.source.citation && claim.origin === 'explicit') {
      result = await this.verifyExplicitCitation(claim, sourceDocuments);
    }
    // For inferences with rationale
    else if (claim.metadata?.inferenceRationale) {
      result = await this.verifySupportingFacts(claim, sourceDocuments);
    }
    // No citation or rationale
    else if (claim.origin === 'explicit') {
      result = {
        valid: false,
        reason: 'Explicit fact missing citation',
        suggestedAction: 'DOWNGRADE_TO_INFERENCE',
        severity: 'high'
      };
    }
    // Inferred claims without citations are acceptable
    else {
      result = {
        valid: true,
        reason: 'Inference does not require explicit citation',
        suggestedAction: null,
        severity: 'none'
      };
    }

    // Cache result
    this.verificationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Verify explicit citation (exact quote matching)
   * @param {Object} claim - Claim with explicit citation
   * @param {Array} sourceDocuments - Source documents
   * @returns {Promise<Object>} Verification result
   */
  async verifyExplicitCitation(claim, sourceDocuments) {
    const { documentName, exactQuote, startChar, endChar } = claim.source;

    // Find the source document
    const document = sourceDocuments.find(d => d.name === documentName);
    if (!document) {
      return {
        valid: false,
        reason: `Source document "${documentName}" not found`,
        suggestedAction: 'DOWNGRADE_TO_INFERENCE',
        severity: 'high',
        availableDocuments: sourceDocuments.map(d => d.name)
      };
    }

    // If no exact quote provided, cannot verify
    if (!exactQuote) {
      return {
        valid: false,
        reason: 'Citation missing exactQuote field',
        suggestedAction: 'ADD_EXACT_QUOTE_OR_DOWNGRADE',
        severity: 'medium'
      };
    }

    // Verify character range if provided
    if (startChar !== null && endChar !== null) {
      const extractedText = document.content.substring(startChar, endChar);

      if (extractedText === exactQuote) {
        return {
          valid: true,
          reason: 'Character range matches exact quote',
          suggestedAction: null,
          severity: 'none'
        };
      } else {
        // Character range mismatch - try to find quote elsewhere
        const quoteIndex = document.content.indexOf(exactQuote);
        if (quoteIndex !== -1) {
          return {
            valid: true,
            reason: 'Quote found but character range incorrect',
            suggestedAction: 'RECALCULATE_RANGE',
            severity: 'low',
            correctedRange: {
              startChar: quoteIndex,
              endChar: quoteIndex + exactQuote.length
            }
          };
        } else {
          return {
            valid: false,
            reason: 'Character range mismatch and quote not found elsewhere',
            suggestedAction: 'DOWNGRADE_TO_INFERENCE',
            severity: 'high'
          };
        }
      }
    }

    // No character range - search for exact quote in document
    const quoteIndex = document.content.indexOf(exactQuote);
    if (quoteIndex !== -1) {
      return {
        valid: true,
        reason: 'Exact quote found in document',
        suggestedAction: 'ADD_CHARACTER_RANGE',
        severity: 'none',
        suggestedRange: {
          startChar: quoteIndex,
          endChar: quoteIndex + exactQuote.length
        }
      };
    }

    // Try fuzzy matching (allow minor variations)
    const fuzzyMatch = this.fuzzyFindQuote(exactQuote, document.content);
    if (fuzzyMatch) {
      return {
        valid: true,
        reason: 'Fuzzy match found (minor variations)',
        suggestedAction: 'UPDATE_EXACT_QUOTE',
        severity: 'low',
        fuzzyMatch: fuzzyMatch
      };
    }

    // Quote not found
    return {
      valid: false,
      reason: 'Exact quote not found in source document',
      suggestedAction: 'DOWNGRADE_TO_INFERENCE',
      severity: 'high'
    };
  }

  /**
   * Verify supporting facts for inferences
   * @param {Object} claim - Claim with inference rationale
   * @param {Array} sourceDocuments - Source documents
   * @returns {Promise<Object>} Verification result
   */
  async verifySupportingFacts(claim, sourceDocuments) {
    const rationale = claim.metadata.inferenceRationale;

    if (!rationale || !rationale.supportingFacts) {
      return {
        valid: false,
        reason: 'Inference missing supporting facts',
        suggestedAction: 'ADD_RATIONALE',
        severity: 'medium'
      };
    }

    const invalidFacts = [];
    const validFacts = [];

    // Verify each supporting fact
    for (const fact of rationale.supportingFacts) {
      const factVerification = await this.verifySupportingFact(fact, sourceDocuments);

      if (factVerification.valid) {
        validFacts.push(fact);
      } else {
        invalidFacts.push({
          fact: fact,
          reason: factVerification.reason
        });
      }
    }

    const validRatio = validFacts.length / rationale.supportingFacts.length;

    if (validRatio === 1.0) {
      return {
        valid: true,
        reason: 'All supporting facts verified',
        suggestedAction: null,
        severity: 'none'
      };
    } else if (validRatio >= 0.75) {
      return {
        valid: true,
        reason: `${Math.round(validRatio * 100)}% of supporting facts verified`,
        suggestedAction: 'REDUCE_CONFIDENCE_SLIGHTLY',
        severity: 'low',
        invalidFacts: invalidFacts
      };
    } else if (validRatio >= 0.5) {
      return {
        valid: true,
        reason: `Only ${Math.round(validRatio * 100)}% of supporting facts verified`,
        suggestedAction: 'REDUCE_CONFIDENCE',
        severity: 'medium',
        invalidFacts: invalidFacts
      };
    } else {
      return {
        valid: false,
        reason: `Less than 50% of supporting facts verified (${Math.round(validRatio * 100)}%)`,
        suggestedAction: 'REMOVE_OR_REDUCE_CONFIDENCE_SEVERELY',
        severity: 'high',
        invalidFacts: invalidFacts
      };
    }
  }

  /**
   * Verify a single supporting fact
   * @param {string} fact - Supporting fact statement
   * @param {Array} sourceDocuments - Source documents
   * @returns {Promise<Object>} Verification result
   */
  async verifySupportingFact(fact, sourceDocuments) {
    // Search for fact in all documents
    for (const doc of sourceDocuments) {
      // Simple substring search (can be enhanced with semantic similarity)
      if (doc.content.toLowerCase().includes(fact.toLowerCase())) {
        return {
          valid: true,
          documentName: doc.name
        };
      }

      // Try fuzzy matching
      const fuzzyMatch = this.fuzzyFindQuote(fact, doc.content);
      if (fuzzyMatch && fuzzyMatch.similarity > 0.8) {
        return {
          valid: true,
          documentName: doc.name,
          fuzzyMatch: fuzzyMatch
        };
      }
    }

    return {
      valid: false,
      reason: 'Supporting fact not found in any source document'
    };
  }

  /**
   * Fuzzy find quote in text (handles minor variations)
   * @param {string} quote - Quote to find
   * @param {string} text - Text to search in
   * @returns {Object|null} Match result or null
   */
  fuzzyFindQuote(quote, text) {
    const normalizedQuote = quote.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();

    // Exact match after normalization
    const exactIndex = normalizedText.indexOf(normalizedQuote);
    if (exactIndex !== -1) {
      return {
        found: true,
        similarity: 1.0,
        matchedText: text.substring(exactIndex, exactIndex + normalizedQuote.length)
      };
    }

    // Sliding window for partial matches
    const quoteWords = normalizedQuote.split(' ');
    const textWords = normalizedText.split(' ');

    let bestMatch = null;
    let bestSimilarity = 0;

    for (let i = 0; i <= textWords.length - quoteWords.length; i++) {
      const window = textWords.slice(i, i + quoteWords.length).join(' ');
      const similarity = this.calculateSimilarity(normalizedQuote, window);

      if (similarity > bestSimilarity && similarity > 0.75) {
        bestSimilarity = similarity;
        bestMatch = {
          found: true,
          similarity: similarity,
          matchedText: window
        };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity (simple Levenshtein-based ratio)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity ratio (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + substitutionCost
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Batch verify multiple claims
   * @param {Array} claims - Array of claims to verify
   * @param {Array} sourceDocuments - Source documents
   * @returns {Promise<Array>} Array of verification results
   */
  async verifyClaims(claims, sourceDocuments) {
    const results = [];

    for (const claim of claims) {
      const verification = await this.verifyCitation(claim, sourceDocuments);
      results.push({
        claimId: claim.id,
        claim: claim.claim,
        verification: verification
      });
    }

    return results;
  }

  /**
   * Clear verification cache
   */
  clearCache() {
    this.verificationCache.clear();
  }
}

// Export singleton instance
export const citationVerifier = new CitationVerifier();
