/**
 * ContradictionDetector - Detects contradictions between claims
 *
 * Features:
 * - Numerical contradiction detection
 * - Temporal contradiction detection
 * - Logical contradiction detection
 * - Polarity contradiction detection
 */

export class ContradictionDetector {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.config = {
      numericalTolerancePercent: options.numericalTolerancePercent || 0.10, // 10% tolerance
      temporalToleranceDays: options.temporalToleranceDays || 7,
      ...options
    };
  }

  /**
   * Detect contradictions between two claims
   * @param {Object} claim1 - First claim
   * @param {Object} claim2 - Second claim
   * @returns {Object|null} Contradiction if detected, null otherwise
   */
  async detectContradiction(claim1, claim2) {
    try {
      // Skip if claims are from the same task
      if (claim1.taskId === claim2.taskId) {
        return null;
      }

      // Skip if not related claim types
      if (claim1.claimType !== claim2.claimType) {
        return null;
      }

      // Check for numerical contradictions
      const numericalResult = this.detectNumericalContradiction(claim1, claim2);
      if (numericalResult) {
        return numericalResult;
      }

      // Check for temporal contradictions
      const temporalResult = this.detectTemporalContradiction(claim1, claim2);
      if (temporalResult) {
        return temporalResult;
      }

      // Check for logical contradictions
      const logicalResult = this.detectLogicalContradiction(claim1, claim2);
      if (logicalResult) {
        return logicalResult;
      }

      return null;

    } catch (error) {
      this.logger.error('Contradiction detection error:', error);
      return null;
    }
  }

  /**
   * Detect numerical contradictions (e.g., "90 days" vs "60 days")
   */
  detectNumericalContradiction(claim1, claim2) {
    const nums1 = this.extractNumbers(claim1.claim);
    const nums2 = this.extractNumbers(claim2.claim);

    if (nums1.length === 0 || nums2.length === 0) {
      return null;
    }

    // Compare each number pair
    for (const num1 of nums1) {
      for (const num2 of nums2) {
        const diff = Math.abs(num1 - num2);
        const tolerance = Math.max(num1, num2) * this.config.numericalTolerancePercent;

        if (diff > tolerance) {
          const severity = this.calculateNumericalSeverity(num1, num2);
          return {
            type: 'numerical',
            severity,
            claim1: claim1.id,
            claim2: claim2.id,
            description: `Numerical mismatch: ${num1} vs ${num2}`,
            details: {
              value1: num1,
              value2: num2,
              difference: diff,
              percentDifference: ((diff / Math.max(num1, num2)) * 100).toFixed(2)
            },
            detectedAt: new Date().toISOString()
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect temporal contradictions (e.g., date conflicts)
   */
  detectTemporalContradiction(claim1, claim2) {
    const dates1 = this.extractDates(claim1.claim);
    const dates2 = this.extractDates(claim2.claim);

    if (dates1.length === 0 || dates2.length === 0) {
      return null;
    }

    for (const date1 of dates1) {
      for (const date2 of dates2) {
        const diffDays = Math.abs((date1 - date2) / (1000 * 60 * 60 * 24));

        if (diffDays > this.config.temporalToleranceDays) {
          const severity = this.calculateTemporalSeverity(diffDays);
          return {
            type: 'temporal',
            severity,
            claim1: claim1.id,
            claim2: claim2.id,
            description: `Date mismatch: ${diffDays.toFixed(0)} days apart`,
            details: {
              date1: date1.toISOString(),
              date2: date2.toISOString(),
              daysDifference: diffDays
            },
            detectedAt: new Date().toISOString()
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect logical contradictions (e.g., "required" vs "optional")
   */
  detectLogicalContradiction(claim1, claim2) {
    const text1 = claim1.claim.toLowerCase();
    const text2 = claim2.claim.toLowerCase();

    // Check for opposite keywords
    const opposites = [
      ['required', 'optional'],
      ['mandatory', 'voluntary'],
      ['must', 'may'],
      ['will', 'might'],
      ['always', 'never'],
      ['true', 'false'],
      ['yes', 'no']
    ];

    for (const [word1, word2] of opposites) {
      const has1Word1 = text1.includes(word1);
      const has1Word2 = text1.includes(word2);
      const has2Word1 = text2.includes(word1);
      const has2Word2 = text2.includes(word2);

      if ((has1Word1 && has2Word2) || (has1Word2 && has2Word1)) {
        return {
          type: 'logical',
          severity: 'high',
          claim1: claim1.id,
          claim2: claim2.id,
          description: `Logical contradiction: ${word1} vs ${word2}`,
          details: {
            contradictingTerms: [word1, word2]
          },
          detectedAt: new Date().toISOString()
        };
      }
    }

    return null;
  }

  /**
   * Extract numbers from text
   */
  extractNumbers(text) {
    const matches = text.match(/\d+\.?\d*/g);
    return matches ? matches.map(Number) : [];
  }

  /**
   * Extract dates from text
   */
  extractDates(text) {
    const dates = [];

    // ISO date format
    const isoMatches = text.match(/\d{4}-\d{2}-\d{2}/g);
    if (isoMatches) {
      isoMatches.forEach(match => {
        const date = new Date(match);
        if (!isNaN(date.getTime())) {
          dates.push(date);
        }
      });
    }

    return dates;
  }

  /**
   * Calculate severity for numerical contradictions
   */
  calculateNumericalSeverity(num1, num2) {
    const diff = Math.abs(num1 - num2);
    const percentDiff = (diff / Math.min(num1, num2)) * 100;

    if (percentDiff > 50) return 'high';
    if (percentDiff > 25) return 'medium';
    return 'low';
  }

  /**
   * Calculate severity for temporal contradictions
   */
  calculateTemporalSeverity(daysDiff) {
    if (daysDiff > 90) return 'high';
    if (daysDiff > 30) return 'medium';
    return 'low';
  }

  /**
   * Batch detect contradictions among multiple claims
   */
  async batchDetect(claims) {
    const contradictions = [];

    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const contradiction = await this.detectContradiction(claims[i], claims[j]);
        if (contradiction) {
          contradictions.push(contradiction);
        }
      }
    }

    return {
      contradictions,
      summary: {
        total: contradictions.length,
        byType: this.groupByType(contradictions),
        bySeverity: this.groupBySeverity(contradictions)
      }
    };
  }

  groupByType(contradictions) {
    return contradictions.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {});
  }

  groupBySeverity(contradictions) {
    return contradictions.reduce((acc, c) => {
      acc[c.severity] = (acc[c.severity] || 0) + 1;
      return acc;
    }, {});
  }
}
