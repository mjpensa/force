/**
 * ProvenanceAuditor - Audits the provenance and quality of claim sources
 *
 * Features:
 * - Source document verification
 * - Provider trust assessment
 * - Timestamp validation
 * - Tampering detection
 * - Overall provenance scoring
 */

export class ProvenanceAuditor {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.trustedProviders = options.trustedProviders || ['INTERNAL', 'GEMINI', 'CLAUDE'];
    this.providerWeights = {
      'INTERNAL': 1.0,
      'CLAUDE': 0.95,
      'GEMINI': 0.9,
      'OPENAI': 0.9,
      'UNKNOWN': 0.5,
      ...options.providerWeights
    };
  }

  /**
   * Audit the provenance of a claim
   * @param {Object} claim - The claim to audit
   * @param {Array} sourceDocuments - Available source documents
   * @returns {Object} Provenance audit result
   */
  async auditProvenance(claim, sourceDocuments) {
    const audit = {
      score: 0,
      issues: [],
      chainOfCustody: [],
      recommendations: []
    };

    try {
      // Step 1: Verify source exists
      const sourceVerification = await this.verifySource(claim, sourceDocuments);
      audit.chainOfCustody.push(sourceVerification);

      if (!sourceVerification.exists) {
        audit.issues.push({
          severity: 'high',
          issue: 'Source document not found',
          recommendation: 'Verify document availability'
        });
        audit.score = 0.2;
        return audit;
      }

      // Step 2: Check provider trust level
      const providerTrust = this.assessProviderTrust(claim);
      audit.chainOfCustody.push(providerTrust);

      // Step 3: Verify timestamp validity
      const timestampCheck = this.verifyTimestamps(claim, sourceVerification);
      audit.chainOfCustody.push(timestampCheck);

      // Step 4: Check for tampering indicators
      const tamperingCheck = await this.checkForTampering(claim, sourceVerification);
      audit.chainOfCustody.push(tamperingCheck);

      // Step 5: Calculate overall provenance score
      audit.score = this.calculateProvenanceScore({
        sourceVerification,
        providerTrust,
        timestampCheck,
        tamperingCheck
      });

      // Step 6: Generate recommendations
      if (audit.score < 0.7) {
        audit.recommendations.push('Consider re-validating with primary source');
      }

      if (providerTrust.trustScore < 0.8) {
        audit.recommendations.push('Cross-reference with trusted provider');
      }

      return audit;

    } catch (error) {
      this.logger.error(`Provenance audit failed for claim ${claim.id}:`, error);
      return {
        score: 0,
        issues: [{ severity: 'critical', issue: error.message }],
        chainOfCustody: audit.chainOfCustody,
        recommendations: []
      };
    }
  }

  /**
   * Verify source document exists
   */
  async verifySource(claim, sourceDocuments) {
    const sourceName = claim.source?.documentName || 'unknown';

    if (sourceName === 'inferred') {
      return {
        step: 'SOURCE_VERIFICATION',
        exists: true,
        sourceType: 'inference',
        verified: true,
        note: 'Inference-based claim, no direct source'
      };
    }

    const document = sourceDocuments.find(d =>
      d.name === sourceName || d.filename === sourceName
    );

    return {
      step: 'SOURCE_VERIFICATION',
      exists: !!document,
      sourceType: 'explicit',
      verified: !!document,
      documentMetadata: document ? {
        name: document.name,
        size: document.size || 0,
        type: document.type || 'unknown'
      } : null
    };
  }

  /**
   * Assess provider trustworthiness
   */
  assessProviderTrust(claim) {
    const provider = claim.source?.provider || 'UNKNOWN';
    const trustScore = this.providerWeights[provider] || this.providerWeights.UNKNOWN;

    const trusted = this.trustedProviders.includes(provider);

    return {
      step: 'PROVIDER_TRUST',
      provider,
      trustScore,
      trusted,
      note: trusted ? 'Trusted provider' : 'Untrusted or unknown provider'
    };
  }

  /**
   * Verify timestamp validity
   */
  verifyTimestamps(claim, sourceVerification) {
    const claimTimestamp = new Date(claim.validatedAt);
    const now = new Date();

    // Check if claim timestamp is in the future
    if (claimTimestamp > now) {
      return {
        step: 'TIMESTAMP_VERIFICATION',
        valid: false,
        issue: 'Claim timestamp is in the future',
        claimTimestamp: claim.validatedAt
      };
    }

    // Check if claim is too old (>1 year)
    const daysSinceValidation = (now - claimTimestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceValidation > 365) {
      return {
        step: 'TIMESTAMP_VERIFICATION',
        valid: true,
        warning: 'Claim is over 1 year old',
        daysSinceValidation: Math.floor(daysSinceValidation)
      };
    }

    // Check if citation timestamp matches
    if (claim.source?.citation?.retrievedAt) {
      const citationTimestamp = new Date(claim.source.citation.retrievedAt);
      if (citationTimestamp > claimTimestamp) {
        return {
          step: 'TIMESTAMP_VERIFICATION',
          valid: false,
          issue: 'Citation retrieved after claim validation',
          claimTimestamp: claim.validatedAt,
          citationTimestamp: claim.source.citation.retrievedAt
        };
      }
    }

    return {
      step: 'TIMESTAMP_VERIFICATION',
      valid: true,
      daysSinceValidation: Math.floor(daysSinceValidation)
    };
  }

  /**
   * Check for data tampering indicators
   */
  async checkForTampering(claim, sourceVerification) {
    // Check for tampering indicators
    const indicators = [];

    // Check 1: Citation character range integrity
    if (claim.source?.citation) {
      const { startChar, endChar, exactQuote } = claim.source.citation;

      if (startChar < 0 || endChar < startChar) {
        indicators.push('Invalid character range');
      }

      if (exactQuote && exactQuote.length !== (endChar - startChar)) {
        indicators.push('Quote length mismatch');
      }
    }

    // Check 2: Confidence score consistency
    if (claim.confidence < 0 || claim.confidence > 1) {
      indicators.push('Invalid confidence score');
    }

    // Check 3: Required fields presence
    if (!claim.id || !claim.taskId || !claim.claim) {
      indicators.push('Missing required fields');
    }

    return {
      step: 'TAMPERING_CHECK',
      clean: indicators.length === 0,
      indicators,
      note: indicators.length === 0 ? 'No tampering indicators found' : 'Potential integrity issues'
    };
  }

  /**
   * Calculate overall provenance score
   */
  calculateProvenanceScore(auditSteps) {
    let score = 1.0;

    // Source verification (30% weight)
    if (!auditSteps.sourceVerification.verified) {
      score -= 0.3;
    }

    // Provider trust (25% weight)
    score *= (0.75 + 0.25 * auditSteps.providerTrust.trustScore);

    // Timestamp validity (20% weight)
    if (!auditSteps.timestampCheck.valid) {
      score -= 0.2;
    } else if (auditSteps.timestampCheck.warning) {
      score -= 0.1;
    }

    // Tampering check (25% weight)
    if (!auditSteps.tamperingCheck.clean) {
      score -= 0.25;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Batch audit provenance for multiple claims
   */
  async batchAudit(claims, sourceDocuments) {
    const results = [];

    for (const claim of claims) {
      try {
        const audit = await this.auditProvenance(claim, sourceDocuments);
        results.push({
          claimId: claim.id,
          ...audit
        });
      } catch (error) {
        results.push({
          claimId: claim.id,
          score: 0,
          issues: [{ severity: 'critical', issue: error.message }],
          chainOfCustody: [],
          recommendations: []
        });
      }
    }

    return {
      results,
      avgProvenanceScore: results.length > 0
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length
        : 0,
      issuesCount: results.filter(r => r.issues.length > 0).length
    };
  }
}
