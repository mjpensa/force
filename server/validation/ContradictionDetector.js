/**
 * Contradiction Detector
 * Detects contradictions between claims from different sources
 *
 * Contradiction Types:
 * 1. NUMERICAL - Different numerical values for same metric
 * 2. POLARITY - Opposite assertions (true vs false)
 * 3. TEMPORAL - Different dates for same event
 * 4. DEFINITIONAL - Different definitions/descriptions of same concept
 *
 * Resolution Strategy:
 * - Prefer explicit facts over inferences
 * - Prefer higher confidence sources
 * - Prefer more recent sources
 * - Prefer regulatory/authoritative sources
 */

export class ContradictionDetector {
  constructor(claimLedger = null) {
    this.claimLedger = claimLedger || new Map();
    this.resolutionMatrix = new ContradictionResolutionMatrix();
  }

  /**
   * Set or update the claim ledger
   * @param {Map} ledger - Map of claims
   */
  setClaimLedger(ledger) {
    this.claimLedger = ledger;
  }

  /**
   * Detect contradictions for a new claim against existing claims
   * @param {Object} newClaim - New claim to check
   * @returns {Promise<Array>} Array of detected contradictions
   */
  async detectContradictions(newClaim) {
    const contradictions = [];

    for (const [claimId, existingClaim] of this.claimLedger.entries()) {
      // Skip if same claim
      if (existingClaim.id === newClaim.id) {
        continue;
      }

      // Skip if same task (same task can have multiple claims)
      if (existingClaim.taskId === newClaim.taskId) {
        continue;
      }

      // Skip if different claim types
      if (existingClaim.claimType !== newClaim.claimType) {
        continue;
      }

      // Compare claims for contradictions
      const contradiction = await this.compareClaims(existingClaim, newClaim);

      if (contradiction) {
        const resolution = this.resolutionMatrix.resolve(contradiction, existingClaim, newClaim);

        contradictions.push({
          id: this.generateContradictionId(existingClaim.id, newClaim.id),
          type: contradiction.type,
          severity: contradiction.severity,
          claims: [existingClaim.id, newClaim.id],
          claimDetails: {
            claim1: {
              id: existingClaim.id,
              taskId: existingClaim.taskId,
              taskName: existingClaim.taskName,
              claim: existingClaim.claim,
              confidence: existingClaim.confidence,
              origin: existingClaim.origin,
              source: existingClaim.source
            },
            claim2: {
              id: newClaim.id,
              taskId: newClaim.taskId,
              taskName: newClaim.taskName,
              claim: newClaim.claim,
              confidence: newClaim.confidence,
              origin: newClaim.origin,
              source: newClaim.source
            }
          },
          values: contradiction.values,
          resolution: resolution,
          detectedAt: new Date().toISOString()
        });
      }
    }

    return contradictions;
  }

  /**
   * Compare two claims for contradictions
   * @param {Object} claim1 - First claim
   * @param {Object} claim2 - Second claim
   * @returns {Promise<Object|null>} Contradiction object or null
   */
  async compareClaims(claim1, claim2) {
    // Numerical contradiction
    const numericalContradiction = this.detectNumericalContradiction(claim1, claim2);
    if (numericalContradiction) {
      return numericalContradiction;
    }

    // Polarity contradiction
    const polarityContradiction = this.detectPolarityContradiction(claim1, claim2);
    if (polarityContradiction) {
      return polarityContradiction;
    }

    // Temporal contradiction
    const temporalContradiction = this.detectTemporalContradiction(claim1, claim2);
    if (temporalContradiction) {
      return temporalContradiction;
    }

    // Definitional contradiction
    const definitionalContradiction = this.detectDefinitionalContradiction(claim1, claim2);
    if (definitionalContradiction) {
      return definitionalContradiction;
    }

    return null;
  }

  /**
   * Detect numerical contradictions
   * @param {Object} claim1 - First claim
   * @param {Object} claim2 - Second claim
   * @returns {Object|null} Contradiction or null
   */
  detectNumericalContradiction(claim1, claim2) {
    const num1 = this.extractNumber(claim1.claim);
    const num2 = this.extractNumber(claim2.claim);

    if (!num1 || !num2) {
      return null;
    }

    // Check if numbers are significantly different
    const difference = Math.abs(num1.value - num2.value);
    const relativeDifference = difference / Math.max(num1.value, num2.value);

    // Consider it a contradiction if difference > 20%
    if (relativeDifference > 0.20) {
      return {
        type: 'NUMERICAL',
        severity: this.calculateSeverity(relativeDifference),
        values: [
          { value: num1.value, unit: num1.unit, claim: claim1.claim },
          { value: num2.value, unit: num2.unit, claim: claim2.claim }
        ],
        difference: difference,
        relativeDifference: Math.round(relativeDifference * 100)
      };
    }

    return null;
  }

  /**
   * Detect polarity contradictions (opposite assertions)
   * @param {Object} claim1 - First claim
   * @param {Object} claim2 - Second claim
   * @returns {Object|null} Contradiction or null
   */
  detectPolarityContradiction(claim1, claim2) {
    const polarity1 = this.determinePolarity(claim1.claim);
    const polarity2 = this.determinePolarity(claim2.claim);

    if (polarity1 && polarity2 && polarity1 !== polarity2) {
      return {
        type: 'POLARITY',
        severity: 'high',
        values: [
          { polarity: polarity1, claim: claim1.claim },
          { polarity: polarity2, claim: claim2.claim }
        ]
      };
    }

    return null;
  }

  /**
   * Detect temporal contradictions (different dates)
   * @param {Object} claim1 - First claim
   * @param {Object} claim2 - Second claim
   * @returns {Object|null} Contradiction or null
   */
  detectTemporalContradiction(claim1, claim2) {
    const date1 = this.extractDate(claim1.claim);
    const date2 = this.extractDate(claim2.claim);

    if (!date1 || !date2) {
      return null;
    }

    // Check if dates are different
    const timeDifference = Math.abs(date1.getTime() - date2.getTime());
    const daysDifference = timeDifference / (1000 * 60 * 60 * 24);

    // Consider it a contradiction if difference > 7 days
    if (daysDifference > 7) {
      return {
        type: 'TEMPORAL',
        severity: daysDifference > 30 ? 'high' : 'medium',
        values: [
          { date: date1.toISOString(), claim: claim1.claim },
          { date: date2.toISOString(), claim: claim2.claim }
        ],
        daysDifference: Math.round(daysDifference)
      };
    }

    return null;
  }

  /**
   * Detect definitional contradictions
   * @param {Object} claim1 - First claim
   * @param {Object} claim2 - Second claim
   * @returns {Object|null} Contradiction or null
   */
  detectDefinitionalContradiction(claim1, claim2) {
    // This is more complex - requires semantic similarity analysis
    // For now, use simple keyword mismatch detection

    const keywords1 = this.extractKeywords(claim1.claim);
    const keywords2 = this.extractKeywords(claim2.claim);

    // Calculate keyword overlap
    const intersection = keywords1.filter(k => keywords2.includes(k));
    const union = [...new Set([...keywords1, ...keywords2])];

    const similarity = intersection.length / union.length;

    // If very low similarity but same claim type, might be definitional contradiction
    if (similarity < 0.3) {
      return {
        type: 'DEFINITIONAL',
        severity: 'medium',
        values: [
          { keywords: keywords1, claim: claim1.claim },
          { keywords: keywords2, claim: claim2.claim }
        ],
        similarity: Math.round(similarity * 100)
      };
    }

    return null;
  }

  /**
   * Extract number from claim text
   * @param {string} text - Claim text
   * @returns {Object|null} Extracted number with unit
   */
  extractNumber(text) {
    // Match patterns like "12 months", "$500", "45%", "3.5 weeks"
    const patterns = [
      /(\d+(?:\.\d+)?)\s*(months?|weeks?|days?|years?|quarters?)/i,
      /\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(million|billion|thousand|k|m|b)?/i,
      /(\d+(?:\.\d+)?)\s*%/,
      /(\d+(?:\.\d+)?)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let value = parseFloat(match[1].replace(/,/g, ''));
        const unit = match[2] || '';

        // Convert units to normalized form
        if (unit.toLowerCase().includes('million') || unit === 'm') {
          value *= 1000000;
        } else if (unit.toLowerCase().includes('billion') || unit === 'b') {
          value *= 1000000000;
        } else if (unit.toLowerCase().includes('thousand') || unit === 'k') {
          value *= 1000;
        }

        return { value, unit: unit.toLowerCase() };
      }
    }

    return null;
  }

  /**
   * Extract date from claim text
   * @param {string} text - Claim text
   * @returns {Date|null} Extracted date
   */
  extractDate(text) {
    // Match ISO dates, common date formats
    const patterns = [
      /(\d{4}-\d{2}-\d{2})/,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /Q([1-4])\s+(\d{4})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Quarter handling
        if (match[0].startsWith('Q')) {
          const quarter = parseInt(match[1]);
          const year = parseInt(match[2]);
          const month = (quarter - 1) * 3;
          return new Date(year, month, 1);
        }

        const date = new Date(match[0]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }

  /**
   * Determine polarity of claim (positive/negative/neutral)
   * @param {string} text - Claim text
   * @returns {string|null} Polarity
   */
  determinePolarity(text) {
    const positiveKeywords = ['required', 'must', 'will', 'is', 'has', 'includes', 'contains'];
    const negativeKeywords = ['not required', 'must not', 'will not', 'is not', 'has no', 'excludes', 'without'];

    const lowerText = text.toLowerCase();

    for (const keyword of negativeKeywords) {
      if (lowerText.includes(keyword)) {
        return 'negative';
      }
    }

    for (const keyword of positiveKeywords) {
      if (lowerText.includes(keyword)) {
        return 'positive';
      }
    }

    return null;
  }

  /**
   * Extract keywords from claim
   * @param {string} text - Claim text
   * @returns {Array} Array of keywords
   */
  extractKeywords(text) {
    // Remove common stop words and extract meaningful words
    const stopWords = ['is', 'a', 'an', 'the', 'on', 'by', 'for', 'to', 'of', 'in', 'that', 'this'];

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));

    return [...new Set(words)];
  }

  /**
   * Calculate contradiction severity
   * @param {number} relativeDifference - Relative difference (0-1)
   * @returns {string} Severity level
   */
  calculateSeverity(relativeDifference) {
    if (relativeDifference > 0.5) {
      return 'high';
    } else if (relativeDifference > 0.3) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Generate unique contradiction ID
   * @param {string} claim1Id - First claim ID
   * @param {string} claim2Id - Second claim ID
   * @returns {string} Unique contradiction ID
   */
  generateContradictionId(claim1Id, claim2Id) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `contradiction-${timestamp}-${random}`;
  }

  /**
   * Batch detect contradictions for multiple claims
   * @param {Array} claims - Array of claims
   * @returns {Promise<Array>} Array of all contradictions
   */
  async detectAllContradictions(claims) {
    const allContradictions = [];

    for (const claim of claims) {
      const contradictions = await this.detectContradictions(claim);
      allContradictions.push(...contradictions);
    }

    return allContradictions;
  }
}

/**
 * Contradiction Resolution Matrix
 * Determines which claim to prefer when contradictions are detected
 */
class ContradictionResolutionMatrix {
  resolve(contradiction, claim1, claim2) {
    // Rule 1: Prefer explicit facts over inferences
    if (claim1.origin === 'explicit' && claim2.origin === 'inferred') {
      return {
        preferredClaim: claim1.id,
        reason: 'Explicit fact preferred over inference',
        confidence: 0.9,
        action: 'ACCEPT_CLAIM1_REDUCE_CLAIM2_CONFIDENCE'
      };
    } else if (claim2.origin === 'explicit' && claim1.origin === 'inferred') {
      return {
        preferredClaim: claim2.id,
        reason: 'Explicit fact preferred over inference',
        confidence: 0.9,
        action: 'ACCEPT_CLAIM2_REDUCE_CLAIM1_CONFIDENCE'
      };
    }

    // Rule 2: Prefer higher confidence sources
    if (claim1.confidence > claim2.confidence + 0.2) {
      return {
        preferredClaim: claim1.id,
        reason: `Higher confidence (${claim1.confidence} vs ${claim2.confidence})`,
        confidence: 0.8,
        action: 'ACCEPT_CLAIM1_FLAG_CLAIM2'
      };
    } else if (claim2.confidence > claim1.confidence + 0.2) {
      return {
        preferredClaim: claim2.id,
        reason: `Higher confidence (${claim2.confidence} vs ${claim1.confidence})`,
        confidence: 0.8,
        action: 'ACCEPT_CLAIM2_FLAG_CLAIM1'
      };
    }

    // Rule 3: Prefer regulatory sources for regulatory claims
    if (contradiction.type === 'regulatory') {
      const reg1 = claim1.source.documentName.toLowerCase().includes('regulation');
      const reg2 = claim2.source.documentName.toLowerCase().includes('regulation');

      if (reg1 && !reg2) {
        return {
          preferredClaim: claim1.id,
          reason: 'Regulatory source preferred',
          confidence: 0.95,
          action: 'ACCEPT_CLAIM1_REJECT_CLAIM2'
        };
      } else if (reg2 && !reg1) {
        return {
          preferredClaim: claim2.id,
          reason: 'Regulatory source preferred',
          confidence: 0.95,
          action: 'ACCEPT_CLAIM2_REJECT_CLAIM1'
        };
      }
    }

    // Rule 4: High severity - flag both for manual review
    if (contradiction.severity === 'high') {
      return {
        preferredClaim: null,
        reason: 'High severity contradiction requires manual review',
        confidence: 0.0,
        action: 'FLAG_BOTH_FOR_REVIEW'
      };
    }

    // Rule 5: Medium/Low severity - average values or flag
    return {
      preferredClaim: null,
      reason: 'No clear preference - both claims have similar authority',
      confidence: 0.5,
      action: 'AVERAGE_VALUES_OR_FLAG'
    };
  }
}

// Export singleton instance
export const contradictionDetector = new ContradictionDetector();
