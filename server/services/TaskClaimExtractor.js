/**
 * Task Claim Extractor Service
 * Extracts atomic claims from BimodalGanttData tasks for validation
 *
 * Claim Types:
 * - duration: Task duration estimates
 * - startDate: Task start date specifications
 * - endDate: Task end date specifications
 * - dependency: Task dependency relationships
 * - resource: Resource allocation claims
 * - regulatory: Regulatory requirement claims
 * - financial: Financial impact claims
 */

export class TaskClaimExtractor {
  constructor() {
    this.claimTypes = [
      'duration',
      'startDate',
      'endDate',
      'dependency',
      'resource',
      'regulatory',
      'financial'
    ];
  }

  /**
   * Extract all claims from a bimodal task
   * @param {Object} bimodalTask - Task from BimodalGanttData
   * @returns {Promise<Array>} Array of extracted claims
   */
  async extractClaims(bimodalTask) {
    const claims = [];

    // Duration claim
    if (bimodalTask.duration) {
      claims.push({
        id: this.generateClaimId(bimodalTask.id, 'duration'),
        taskId: bimodalTask.id,
        taskName: bimodalTask.name,
        claim: `Duration is ${bimodalTask.duration.value} ${bimodalTask.duration.unit}`,
        claimType: 'duration',
        source: this.extractSource(bimodalTask),
        confidence: bimodalTask.duration.confidence || bimodalTask.confidence || 0.5,
        origin: bimodalTask.origin,
        contradictions: [],
        validatedAt: new Date().toISOString(),
        metadata: {
          value: bimodalTask.duration.value,
          unit: bimodalTask.duration.unit,
          justification: bimodalTask.duration.justification
        }
      });
    }

    // Start date claim
    if (bimodalTask.startDate) {
      claims.push({
        id: this.generateClaimId(bimodalTask.id, 'startDate'),
        taskId: bimodalTask.id,
        taskName: bimodalTask.name,
        claim: `Starts on ${bimodalTask.startDate.value}`,
        claimType: 'startDate',
        source: this.extractSource(bimodalTask),
        confidence: bimodalTask.startDate.confidence || bimodalTask.confidence || 0.5,
        origin: bimodalTask.origin,
        contradictions: [],
        validatedAt: new Date().toISOString(),
        metadata: {
          value: bimodalTask.startDate.value,
          justification: bimodalTask.startDate.justification
        }
      });
    }

    // End date claim
    if (bimodalTask.endDate) {
      claims.push({
        id: this.generateClaimId(bimodalTask.id, 'endDate'),
        taskId: bimodalTask.id,
        taskName: bimodalTask.name,
        claim: `Ends on ${bimodalTask.endDate.value}`,
        claimType: 'endDate',
        source: this.extractSource(bimodalTask),
        confidence: bimodalTask.endDate.confidence || bimodalTask.confidence || 0.5,
        origin: bimodalTask.origin,
        contradictions: [],
        validatedAt: new Date().toISOString(),
        metadata: {
          value: bimodalTask.endDate.value,
          justification: bimodalTask.endDate.justification
        }
      });
    }

    // Dependency claims
    if (bimodalTask.dependencies && Array.isArray(bimodalTask.dependencies)) {
      bimodalTask.dependencies.forEach((dep, idx) => {
        claims.push({
          id: this.generateClaimId(bimodalTask.id, `dependency-${idx}`),
          taskId: bimodalTask.id,
          taskName: bimodalTask.name,
          claim: `Depends on task "${dep}"`,
          claimType: 'dependency',
          source: this.extractSource(bimodalTask),
          confidence: bimodalTask.confidence || 0.5,
          origin: bimodalTask.origin,
          contradictions: [],
          validatedAt: new Date().toISOString(),
          metadata: {
            dependencyId: dep,
            dependencyIndex: idx
          }
        });
      });
    }

    // Regulatory requirement claim
    if (bimodalTask.regulatoryRequirement?.isRequired) {
      claims.push({
        id: this.generateClaimId(bimodalTask.id, 'regulatory'),
        taskId: bimodalTask.id,
        taskName: bimodalTask.name,
        claim: `Requires ${bimodalTask.regulatoryRequirement.regulation} approval by ${bimodalTask.regulatoryRequirement.authority}`,
        claimType: 'regulatory',
        source: this.extractSource(bimodalTask),
        confidence: bimodalTask.regulatoryRequirement.confidence || 0.9, // High confidence for regulatory
        origin: 'explicit', // Regulatory requirements are explicit
        contradictions: [],
        validatedAt: new Date().toISOString(),
        metadata: {
          regulation: bimodalTask.regulatoryRequirement.regulation,
          authority: bimodalTask.regulatoryRequirement.authority,
          deadline: bimodalTask.regulatoryRequirement.deadline,
          criticalityLevel: bimodalTask.regulatoryRequirement.criticalityLevel
        }
      });
    }

    // Financial impact claims
    if (bimodalTask.financialImpact) {
      const fi = bimodalTask.financialImpact;

      if (fi.totalCost !== undefined) {
        claims.push({
          id: this.generateClaimId(bimodalTask.id, 'financial-cost'),
          taskId: bimodalTask.id,
          taskName: bimodalTask.name,
          claim: `Total cost is $${fi.totalCost}`,
          claimType: 'financial',
          source: this.extractSource(bimodalTask),
          confidence: fi.confidence || bimodalTask.confidence || 0.5,
          origin: bimodalTask.origin,
          contradictions: [],
          validatedAt: new Date().toISOString(),
          metadata: {
            metricType: 'totalCost',
            value: fi.totalCost,
            breakdown: {
              laborCosts: fi.laborCosts,
              technologyCosts: fi.technologyCosts,
              vendorCosts: fi.vendorCosts
            }
          }
        });
      }

      if (fi.totalAnnualBenefit !== undefined) {
        claims.push({
          id: this.generateClaimId(bimodalTask.id, 'financial-benefit'),
          taskId: bimodalTask.id,
          taskName: bimodalTask.name,
          claim: `Annual benefit is $${fi.totalAnnualBenefit}`,
          claimType: 'financial',
          source: this.extractSource(bimodalTask),
          confidence: fi.confidence || bimodalTask.confidence || 0.5,
          origin: bimodalTask.origin,
          contradictions: [],
          validatedAt: new Date().toISOString(),
          metadata: {
            metricType: 'totalAnnualBenefit',
            value: fi.totalAnnualBenefit,
            breakdown: {
              revenueIncrease: fi.revenueIncrease,
              costSavings: fi.costSavings,
              riskReduction: fi.riskReduction
            }
          }
        });
      }

      if (fi.firstYearROI !== undefined) {
        claims.push({
          id: this.generateClaimId(bimodalTask.id, 'financial-roi'),
          taskId: bimodalTask.id,
          taskName: bimodalTask.name,
          claim: `First year ROI is ${fi.firstYearROI}%`,
          claimType: 'financial',
          source: this.extractSource(bimodalTask),
          confidence: fi.confidence || bimodalTask.confidence || 0.5,
          origin: bimodalTask.origin,
          contradictions: [],
          validatedAt: new Date().toISOString(),
          metadata: {
            metricType: 'firstYearROI',
            value: fi.firstYearROI,
            paybackPeriod: fi.paybackPeriod
          }
        });
      }
    }

    return claims;
  }

  /**
   * Extract source information from task
   * @param {Object} task - BimodalGanttData task
   * @returns {Object} Source metadata
   */
  extractSource(task) {
    if (task.sourceCitations && task.sourceCitations.length > 0) {
      const citation = task.sourceCitations[0];
      return {
        documentName: citation.documentName,
        provider: citation.provider || 'INTERNAL',
        citation: citation,
        exactQuote: citation.exactQuote || null,
        startChar: citation.startChar,
        endChar: citation.endChar
      };
    }

    // No explicit citation - mark as inferred
    return {
      documentName: 'inferred',
      provider: 'GEMINI',
      citation: null,
      exactQuote: null,
      startChar: null,
      endChar: null
    };
  }

  /**
   * Generate unique claim ID
   * @param {string} taskId - Task identifier
   * @param {string} claimType - Type of claim
   * @returns {string} Unique claim ID
   */
  generateClaimId(taskId, claimType) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `claim-${taskId}-${claimType}-${timestamp}-${random}`;
  }

  /**
   * Extract all claims from multiple tasks
   * @param {Array} tasks - Array of BimodalGanttData tasks
   * @returns {Promise<Array>} Array of all claims
   */
  async extractAllClaims(tasks) {
    const allClaims = [];

    for (const task of tasks) {
      const taskClaims = await this.extractClaims(task);
      allClaims.push(...taskClaims);
    }

    return allClaims;
  }

  /**
   * Get claim statistics
   * @param {Array} claims - Array of claims
   * @returns {Object} Statistics summary
   */
  getClaimStatistics(claims) {
    const stats = {
      totalClaims: claims.length,
      byType: {},
      byOrigin: { explicit: 0, inferred: 0 },
      byConfidence: { high: 0, medium: 0, low: 0 },
      cited: 0,
      uncited: 0
    };

    // Count by type
    this.claimTypes.forEach(type => {
      stats.byType[type] = claims.filter(c => c.claimType === type).length;
    });

    // Count by origin
    claims.forEach(claim => {
      if (claim.origin === 'explicit') {
        stats.byOrigin.explicit++;
      } else {
        stats.byOrigin.inferred++;
      }

      // Count by confidence level
      if (claim.confidence >= 0.8) {
        stats.byConfidence.high++;
      } else if (claim.confidence >= 0.5) {
        stats.byConfidence.medium++;
      } else {
        stats.byConfidence.low++;
      }

      // Count cited vs uncited
      if (claim.source.citation) {
        stats.cited++;
      } else {
        stats.uncited++;
      }
    });

    return stats;
  }
}

// Export singleton instance
export const taskClaimExtractor = new TaskClaimExtractor();
