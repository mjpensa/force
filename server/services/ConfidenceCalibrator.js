/**
 * Confidence Calibrator Service
 * Calibrates confidence scores based on citation quality, contradictions, and consensus
 *
 * Calibration Factors:
 * 1. Citation Type (regulatory > peer_reviewed > internal > llm > uncited)
 * 2. Contradiction Severity (none > low > medium > high)
 * 3. Consensus Level (>90% > 70-90% > 50-70% > <50%)
 * 4. Provenance Score (from audit)
 * 5. Origin Type (explicit facts start higher)
 *
 * Output Range: 0.3 - 0.99 (never 0 or 1.0 to reflect uncertainty)
 */

export class ConfidenceCalibrator {
  constructor() {
    // Citation quality multipliers
    this.citationMultipliers = {
      'regulatory_doc': 1.20,      // Highest authority
      'peer_reviewed': 1.15,       // Academic/research
      'internal_doc': 1.00,        // Company docs (baseline)
      'llm_output': 0.85,          // LLM-generated (reduced trust)
      'uncited': 0.60              // No citation (significant reduction)
    };

    // Contradiction penalties
    this.contradictionPenalties = {
      'none': 1.00,
      'low': 0.95,
      'medium': 0.85,
      'high': 0.70
    };

    // Consensus bonuses
    this.consensusBonuses = {
      '>90%': 1.10,
      '70-90%': 1.05,
      '50-70%': 1.00,
      '<50%': 0.90
    };

    // Origin baseline confidence
    this.originBaseline = {
      'explicit': 0.85,
      'inferred': 0.60
    };
  }

  /**
   * Calibrate confidence for a single task
   * @param {Object} task - BimodalGanttData task
   * @param {Object} validationResults - Results from validation pipeline
   * @returns {Promise<number>} Calibrated confidence score
   */
  async calibrateTaskConfidence(task, validationResults) {
    // Start with origin baseline
    let confidence = this.originBaseline[task.origin] || 0.5;

    // Factor 1: Citation quality
    const citationType = this.determineCitationType(task.sourceCitations);
    confidence *= this.citationMultipliers[citationType];

    // Factor 2: Contradiction severity
    const contradictionSeverity = this.getHighestContradictionSeverity(
      validationResults.contradictions || []
    );
    confidence *= this.contradictionPenalties[contradictionSeverity];

    // Factor 3: Consensus level
    const consensusLevel = await this.calculateConsensus(task, validationResults);
    const consensusKey = this.getConsensusKey(consensusLevel);
    confidence *= this.consensusBonuses[consensusKey];

    // Factor 4: Provenance score
    if (validationResults.provenanceScore !== undefined) {
      const provenanceMultiplier = validationResults.provenanceScore / 100;
      confidence *= (0.8 + 0.2 * provenanceMultiplier); // Scale from 0.8 to 1.0
    }

    // Factor 5: Regulatory claims boost
    if (task.regulatoryRequirement?.isRequired) {
      confidence *= 1.1; // Regulatory claims get slight boost (high stakes)
    }

    // Factor 6: Financial claims with breakdown boost
    if (task.financialImpact?.totalCost && task.financialImpact.laborCosts !== undefined) {
      confidence *= 1.05; // Detailed breakdown increases confidence
    }

    // Clamp to valid range (0.3 - 0.99)
    confidence = Math.max(0.3, Math.min(0.99, confidence));

    // Round to 2 decimal places
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Calibrate confidence for multiple tasks
   * @param {Array} tasks - Array of BimodalGanttData tasks
   * @param {Object} validationResults - Validation results for all tasks
   * @returns {Promise<Array>} Tasks with calibrated confidence
   */
  async calibrateAllTasks(tasks, validationResults) {
    const calibratedTasks = [];

    for (const task of tasks) {
      // Find validation results for this task
      const taskValidation = validationResults.taskValidations?.find(
        v => v.taskId === task.id
      ) || {};

      const calibratedConfidence = await this.calibrateTaskConfidence(task, taskValidation);

      calibratedTasks.push({
        ...task,
        confidence: calibratedConfidence,
        confidenceMetadata: {
          originalConfidence: task.confidence,
          calibratedConfidence: calibratedConfidence,
          factors: {
            citationType: this.determineCitationType(task.sourceCitations),
            contradictionSeverity: this.getHighestContradictionSeverity(taskValidation.contradictions || []),
            consensusLevel: await this.calculateConsensus(task, taskValidation),
            provenanceScore: taskValidation.provenanceScore
          }
        }
      });
    }

    return calibratedTasks;
  }

  /**
   * Determine citation type from task citations
   * @param {Array} citations - Task citations
   * @returns {string} Citation type
   */
  determineCitationType(citations) {
    if (!citations || citations.length === 0) {
      return 'uncited';
    }

    const firstCitation = citations[0];
    const docName = firstCitation.documentName.toLowerCase();

    // Check for regulatory documents
    if (docName.includes('regulation') ||
        docName.includes('compliance') ||
        docName.includes('occ') ||
        docName.includes('fdic') ||
        docName.includes('federal reserve')) {
      return 'regulatory_doc';
    }

    // Check for peer-reviewed sources
    if (docName.includes('peer') ||
        docName.includes('journal') ||
        docName.includes('research') ||
        docName.includes('study')) {
      return 'peer_reviewed';
    }

    // Check for LLM output
    if (firstCitation.provider && ['GEMINI', 'GPT', 'CLAUDE', 'GROK'].includes(firstCitation.provider)) {
      return 'llm_output';
    }

    // Default to internal doc
    return 'internal_doc';
  }

  /**
   * Get highest contradiction severity for a task
   * @param {Array} contradictions - Array of contradictions
   * @returns {string} Highest severity level
   */
  getHighestContradictionSeverity(contradictions) {
    if (!contradictions || contradictions.length === 0) {
      return 'none';
    }

    const severities = contradictions.map(c => c.severity);

    if (severities.includes('high')) {
      return 'high';
    } else if (severities.includes('medium')) {
      return 'medium';
    } else if (severities.includes('low')) {
      return 'low';
    }

    return 'none';
  }

  /**
   * Calculate consensus level for a task claim
   * @param {Object} task - Task object
   * @param {Object} validationResults - Validation results
   * @returns {Promise<number>} Consensus percentage (0-100)
   */
  async calculateConsensus(task, validationResults) {
    // If no claims validation data, assume moderate consensus
    if (!validationResults.claims || validationResults.claims.length === 0) {
      return 70;
    }

    // Count supporting vs contradicting claims
    const supportingClaims = validationResults.claims.filter(c =>
      c.origin === 'explicit' && c.confidence >= 0.7
    ).length;

    const contradictingClaims = validationResults.contradictions?.length || 0;

    const totalClaims = supportingClaims + contradictingClaims;

    if (totalClaims === 0) {
      return 70; // Default moderate consensus
    }

    const consensusPercentage = (supportingClaims / totalClaims) * 100;
    return Math.round(consensusPercentage);
  }

  /**
   * Get consensus key for bonus lookup
   * @param {number} consensusPercentage - Consensus percentage
   * @returns {string} Consensus key
   */
  getConsensusKey(consensusPercentage) {
    if (consensusPercentage > 90) {
      return '>90%';
    } else if (consensusPercentage >= 70) {
      return '70-90%';
    } else if (consensusPercentage >= 50) {
      return '50-70%';
    } else {
      return '<50%';
    }
  }

  /**
   * Calibrate confidence for a single claim
   * @param {Object} claim - Claim object
   * @param {Object} citationVerification - Citation verification result
   * @param {Array} contradictions - Contradictions for this claim
   * @param {Object} provenanceAudit - Provenance audit result
   * @returns {Promise<number>} Calibrated confidence
   */
  async calibrateClaimConfidence(claim, citationVerification, contradictions, provenanceAudit) {
    let confidence = claim.confidence || 0.5;

    // Apply citation verification impact
    if (!citationVerification.valid) {
      if (citationVerification.severity === 'high') {
        confidence *= 0.6;
      } else if (citationVerification.severity === 'medium') {
        confidence *= 0.8;
      } else {
        confidence *= 0.9;
      }
    }

    // Apply contradiction impact
    const contradictionSeverity = this.getHighestContradictionSeverity(contradictions);
    confidence *= this.contradictionPenalties[contradictionSeverity];

    // Apply provenance audit impact
    if (provenanceAudit && provenanceAudit.score !== undefined) {
      const provenanceMultiplier = provenanceAudit.score / 100;
      confidence *= (0.7 + 0.3 * provenanceMultiplier);
    }

    // Clamp to valid range
    confidence = Math.max(0.3, Math.min(0.99, confidence));

    return Math.round(confidence * 100) / 100;
  }

  /**
   * Generate confidence analysis for entire chart
   * @param {Array} calibratedTasks - Tasks with calibrated confidence
   * @returns {Object} Confidence analysis summary
   */
  generateConfidenceAnalysis(calibratedTasks) {
    const analysis = {
      overallConfidence: 0,
      tasksByConfidence: {
        high: [],    // >= 0.8
        medium: [],  // 0.5 - 0.79
        low: []      // < 0.5
      },
      averageByOrigin: {
        explicit: 0,
        inferred: 0
      },
      calibrationImpact: {
        increased: 0,
        decreased: 0,
        unchanged: 0
      }
    };

    let totalConfidence = 0;
    let explicitCount = 0;
    let explicitConfidenceSum = 0;
    let inferredCount = 0;
    let inferredConfidenceSum = 0;

    for (const task of calibratedTasks) {
      const conf = task.confidence;
      totalConfidence += conf;

      // Categorize by confidence level
      if (conf >= 0.8) {
        analysis.tasksByConfidence.high.push(task.id);
      } else if (conf >= 0.5) {
        analysis.tasksByConfidence.medium.push(task.id);
      } else {
        analysis.tasksByConfidence.low.push(task.id);
      }

      // Track by origin
      if (task.origin === 'explicit') {
        explicitCount++;
        explicitConfidenceSum += conf;
      } else {
        inferredCount++;
        inferredConfidenceSum += conf;
      }

      // Track calibration impact
      if (task.confidenceMetadata) {
        const original = task.confidenceMetadata.originalConfidence;
        const calibrated = task.confidenceMetadata.calibratedConfidence;

        if (calibrated > original + 0.05) {
          analysis.calibrationImpact.increased++;
        } else if (calibrated < original - 0.05) {
          analysis.calibrationImpact.decreased++;
        } else {
          analysis.calibrationImpact.unchanged++;
        }
      }
    }

    // Calculate averages
    analysis.overallConfidence = Math.round((totalConfidence / calibratedTasks.length) * 100) / 100;

    if (explicitCount > 0) {
      analysis.averageByOrigin.explicit = Math.round((explicitConfidenceSum / explicitCount) * 100) / 100;
    }

    if (inferredCount > 0) {
      analysis.averageByOrigin.inferred = Math.round((inferredConfidenceSum / inferredCount) * 100) / 100;
    }

    return analysis;
  }
}

// Export singleton instance
export const confidenceCalibrator = new ConfidenceCalibrator();
