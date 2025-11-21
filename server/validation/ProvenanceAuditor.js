/**
 * Provenance Auditor
 * Audits claims for citation quality and detects common issues
 *
 * Audit Types:
 * 1. HALLUCINATION - Cited quote doesn't exist in source
 * 2. INCORRECT_ATTRIBUTION - Quote exists but in different document
 * 3. MISSING_CITATION - High-confidence claim without citation
 * 4. STALE_CITATION - Citation to outdated information
 * 5. CIRCULAR_REFERENCE - Citation to another LLM's output
 *
 * Scoring System:
 * - Perfect citation: 100 points
 * - Each issue deducts points based on severity
 * - Final score: 0-100
 */

export class ProvenanceAuditor {
  constructor() {
    this.auditCache = new Map();
    this.severityScores = {
      HALLUCINATION: -50,
      INCORRECT_ATTRIBUTION: -20,
      MISSING_CITATION: -30,
      STALE_CITATION: -15,
      CIRCULAR_REFERENCE: -25,
      WEAK_INFERENCE: -10
    };
  }

  /**
   * Audit a single claim for provenance quality
   * @param {Object} claim - Claim to audit
   * @param {Array} originalSources - Original source documents
   * @returns {Promise<Object>} Audit result
   */
  async auditClaim(claim, originalSources) {
    // Check cache
    const cacheKey = `${claim.id}-${claim.source.documentName}`;
    if (this.auditCache.has(cacheKey)) {
      return this.auditCache.get(cacheKey);
    }

    const auditResult = {
      claimId: claim.id,
      valid: true,
      issues: [],
      score: 100,
      recommendations: []
    };

    // Audit 1: Check for hallucination
    const hallucinationCheck = await this.checkHallucination(claim, originalSources);
    if (!hallucinationCheck.valid) {
      auditResult.valid = false;
      auditResult.issues.push(hallucinationCheck.issue);
      auditResult.score += this.severityScores.HALLUCINATION;
      auditResult.recommendations.push(hallucinationCheck.recommendation);
    }

    // Audit 2: Check for incorrect attribution
    const attributionCheck = await this.checkAttribution(claim, originalSources);
    if (!attributionCheck.valid) {
      auditResult.issues.push(attributionCheck.issue);
      auditResult.score += this.severityScores.INCORRECT_ATTRIBUTION;
      auditResult.recommendations.push(attributionCheck.recommendation);
    }

    // Audit 3: Check for missing citation
    const citationCheck = this.checkMissingCitation(claim);
    if (!citationCheck.valid) {
      auditResult.issues.push(citationCheck.issue);
      auditResult.score += this.severityScores.MISSING_CITATION;
      auditResult.recommendations.push(citationCheck.recommendation);
    }

    // Audit 4: Check for circular references (LLM citing LLM)
    const circularCheck = this.checkCircularReference(claim);
    if (!circularCheck.valid) {
      auditResult.issues.push(circularCheck.issue);
      auditResult.score += this.severityScores.CIRCULAR_REFERENCE;
      auditResult.recommendations.push(circularCheck.recommendation);
    }

    // Audit 5: Check inference quality
    if (claim.origin === 'inferred') {
      const inferenceCheck = this.checkInferenceQuality(claim);
      if (!inferenceCheck.valid) {
        auditResult.issues.push(inferenceCheck.issue);
        auditResult.score += this.severityScores.WEAK_INFERENCE;
        auditResult.recommendations.push(inferenceCheck.recommendation);
      }
    }

    // Ensure score is within valid range
    auditResult.score = Math.max(0, Math.min(100, auditResult.score));

    // Determine overall validity
    auditResult.valid = auditResult.score >= 50;

    // Cache result
    this.auditCache.set(cacheKey, auditResult);

    return auditResult;
  }

  /**
   * Check for hallucination (cited quote doesn't exist)
   * @param {Object} claim - Claim to check
   * @param {Array} originalSources - Original source documents
   * @returns {Promise<Object>} Check result
   */
  async checkHallucination(claim, originalSources) {
    // Only check explicit facts with citations
    if (claim.origin !== 'explicit' || !claim.source.citation) {
      return { valid: true };
    }

    const { documentName, exactQuote } = claim.source;

    // Find the source document
    const sourceDoc = originalSources.find(doc => doc.name === documentName);

    if (!sourceDoc) {
      return {
        valid: false,
        issue: {
          type: 'HALLUCINATION',
          severity: 'high',
          claim: claim.claim,
          reason: `Cited document "${documentName}" not found in sources`,
          location: `Claim ${claim.id}`
        },
        recommendation: 'REMOVE_CLAIM_OR_FIND_CORRECT_SOURCE'
      };
    }

    // Check if exact quote exists in document
    if (exactQuote) {
      const quoteExists = await this.verifyQuoteExists(exactQuote, sourceDoc.content);

      if (!quoteExists) {
        return {
          valid: false,
          issue: {
            type: 'HALLUCINATION',
            severity: 'high',
            claim: claim.claim,
            exactQuote: exactQuote,
            reason: 'Cited quote not found in source document',
            location: `Claim ${claim.id}`
          },
          recommendation: 'REMOVE_CLAIM_OR_UPDATE_QUOTE'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check for incorrect attribution (quote in different document)
   * @param {Object} claim - Claim to check
   * @param {Array} originalSources - Original source documents
   * @returns {Promise<Object>} Check result
   */
  async checkAttribution(claim, originalSources) {
    // Only check claims with citations
    if (!claim.source.citation || claim.source.documentName === 'inferred') {
      return { valid: true };
    }

    const { documentName, exactQuote } = claim.source;

    if (!exactQuote) {
      return { valid: true };
    }

    // Find the correct source
    const correctSource = await this.findCorrectSource(exactQuote, originalSources);

    if (correctSource && correctSource.name !== documentName) {
      return {
        valid: false,
        issue: {
          type: 'INCORRECT_ATTRIBUTION',
          severity: 'medium',
          claim: claim.claim,
          currentSource: documentName,
          correctSource: correctSource.name,
          reason: 'Quote found in different document',
          location: `Claim ${claim.id}`
        },
        recommendation: {
          action: 'UPDATE_CITATION',
          newDocumentName: correctSource.name
        }
      };
    }

    return { valid: true };
  }

  /**
   * Check for missing citation
   * @param {Object} claim - Claim to check
   * @returns {Object} Check result
   */
  checkMissingCitation(claim) {
    // Explicit facts should have citations
    if (claim.origin === 'explicit' && (!claim.source.citation || !claim.source.exactQuote)) {
      return {
        valid: false,
        issue: {
          type: 'MISSING_CITATION',
          severity: 'high',
          claim: claim.claim,
          reason: 'Explicit fact missing citation',
          location: `Claim ${claim.id}`
        },
        recommendation: 'ADD_CITATION_OR_DOWNGRADE_TO_INFERENCE'
      };
    }

    // High confidence inferences should have strong rationale
    if (claim.origin === 'inferred' && claim.confidence >= 0.9 && !claim.metadata?.inferenceRationale) {
      return {
        valid: false,
        issue: {
          type: 'MISSING_CITATION',
          severity: 'medium',
          claim: claim.claim,
          reason: 'High-confidence inference missing rationale',
          location: `Claim ${claim.id}`
        },
        recommendation: 'ADD_RATIONALE_OR_REDUCE_CONFIDENCE'
      };
    }

    return { valid: true };
  }

  /**
   * Check for circular references (LLM citing LLM output)
   * @param {Object} claim - Claim to check
   * @returns {Object} Check result
   */
  checkCircularReference(claim) {
    const llmProviders = ['GEMINI', 'GPT', 'CLAUDE', 'GROK', 'BARD'];
    const provider = claim.source.provider;

    // Check if citing another LLM's output
    if (llmProviders.includes(provider)) {
      // Additional check: is this from research synthesis or internal generation?
      const docName = claim.source.documentName.toLowerCase();

      if (docName.includes('output') || docName.includes('generated') || docName.includes('response')) {
        return {
          valid: false,
          issue: {
            type: 'CIRCULAR_REFERENCE',
            severity: 'medium',
            claim: claim.claim,
            provider: provider,
            reason: 'Citing LLM-generated output (circular reference)',
            location: `Claim ${claim.id}`
          },
          recommendation: 'FIND_PRIMARY_SOURCE_OR_REDUCE_CONFIDENCE'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check inference quality
   * @param {Object} claim - Claim to check
   * @returns {Object} Check result
   */
  checkInferenceQuality(claim) {
    // Check if inference has rationale
    const rationale = claim.metadata?.inferenceRationale;

    if (!rationale) {
      return {
        valid: false,
        issue: {
          type: 'WEAK_INFERENCE',
          severity: 'low',
          claim: claim.claim,
          reason: 'Inference missing rationale',
          location: `Claim ${claim.id}`
        },
        recommendation: 'ADD_INFERENCE_RATIONALE'
      };
    }

    // Check if rationale has supporting facts
    if (!rationale.supportingFacts || rationale.supportingFacts.length === 0) {
      return {
        valid: false,
        issue: {
          type: 'WEAK_INFERENCE',
          severity: 'low',
          claim: claim.claim,
          reason: 'Inference rationale missing supporting facts',
          location: `Claim ${claim.id}`
        },
        recommendation: 'ADD_SUPPORTING_FACTS'
      };
    }

    return { valid: true };
  }

  /**
   * Verify quote exists in document (with fuzzy matching)
   * @param {string} quote - Quote to find
   * @param {string} content - Document content
   * @returns {Promise<boolean>} True if found
   */
  async verifyQuoteExists(quote, content) {
    // Exact match
    if (content.includes(quote)) {
      return true;
    }

    // Normalized match (ignore whitespace/case)
    const normalizedQuote = quote.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedContent = content.toLowerCase().replace(/\s+/g, ' ').trim();

    if (normalizedContent.includes(normalizedQuote)) {
      return true;
    }

    // Fuzzy match (allow minor variations)
    const words = normalizedQuote.split(' ');
    if (words.length > 3) {
      // Check if most words are present in sequence
      const wordMatches = words.filter(word => normalizedContent.includes(word));
      if (wordMatches.length >= words.length * 0.8) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find the correct source for a quote
   * @param {string} quote - Quote to find
   * @param {Array} sources - Source documents
   * @returns {Promise<Object|null>} Source document or null
   */
  async findCorrectSource(quote, sources) {
    for (const source of sources) {
      const exists = await this.verifyQuoteExists(quote, source.content);
      if (exists) {
        return source;
      }
    }

    return null;
  }

  /**
   * Batch audit multiple claims
   * @param {Array} claims - Claims to audit
   * @param {Array} originalSources - Original source documents
   * @returns {Promise<Object>} Audit summary
   */
  async auditClaims(claims, originalSources) {
    const results = [];
    const summary = {
      totalClaims: claims.length,
      validClaims: 0,
      invalidClaims: 0,
      averageScore: 0,
      issuesByType: {},
      highSeverityIssues: [],
      mediumSeverityIssues: [],
      lowSeverityIssues: []
    };

    for (const claim of claims) {
      const auditResult = await this.auditClaim(claim, originalSources);
      results.push(auditResult);

      // Update summary
      if (auditResult.valid) {
        summary.validClaims++;
      } else {
        summary.invalidClaims++;
      }

      summary.averageScore += auditResult.score;

      // Categorize issues by type and severity
      for (const issue of auditResult.issues) {
        if (!summary.issuesByType[issue.type]) {
          summary.issuesByType[issue.type] = 0;
        }
        summary.issuesByType[issue.type]++;

        if (issue.severity === 'high') {
          summary.highSeverityIssues.push(issue);
        } else if (issue.severity === 'medium') {
          summary.mediumSeverityIssues.push(issue);
        } else {
          summary.lowSeverityIssues.push(issue);
        }
      }
    }

    summary.averageScore = Math.round(summary.averageScore / claims.length);

    return {
      results: results,
      summary: summary
    };
  }

  /**
   * Clear audit cache
   */
  clearCache() {
    this.auditCache.clear();
  }
}

// Export singleton instance
export const provenanceAuditor = new ProvenanceAuditor();
