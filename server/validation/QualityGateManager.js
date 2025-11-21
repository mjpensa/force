/**
 * Quality Gate Manager
 * Enforces quality standards before finalizing semantic Gantt charts
 *
 * Quality Gates:
 * 1. CITATION_COVERAGE - ≥75% of explicit facts must have citations
 * 2. CONTRADICTION_SEVERITY - No high-severity unresolved contradictions
 * 3. CONFIDENCE_MINIMUM - All tasks must have confidence ≥0.50
 * 4. SCHEMA_COMPLIANCE - Must pass BimodalGanttData schema validation
 * 5. REGULATORY_FLAGS - Regulatory tasks must be properly flagged (non-blocking)
 *
 * Each gate can be:
 * - Blocker: Prevents chart finalization if failed
 * - Warning: Allows chart but logs warning
 */

import { validateBimodalData } from '../../types/SemanticGanttData.js';

export class QualityGateManager {
  constructor() {
    this.gates = [
      {
        name: 'CITATION_COVERAGE',
        description: 'Explicit facts must have source citations',
        threshold: 0.75,
        blocker: true,
        evaluate: this.evaluateCitationCoverage.bind(this)
      },
      {
        name: 'CONTRADICTION_SEVERITY',
        description: 'No high-severity contradictions allowed',
        threshold: 'none_high',
        blocker: true,
        evaluate: this.evaluateContradictions.bind(this)
      },
      {
        name: 'CONFIDENCE_MINIMUM',
        description: 'All tasks must meet minimum confidence threshold',
        threshold: 0.50,
        blocker: true,
        evaluate: this.evaluateConfidence.bind(this)
      },
      {
        name: 'SCHEMA_COMPLIANCE',
        description: 'Data must conform to BimodalGanttData schema',
        threshold: 1.00,
        blocker: true,
        evaluate: this.evaluateSchemaCompliance.bind(this)
      },
      {
        name: 'REGULATORY_FLAGS',
        description: 'Regulatory tasks must be properly flagged',
        threshold: 1.00,
        blocker: false,
        evaluate: this.evaluateRegulatoryFlags.bind(this)
      },
      {
        name: 'PROVENANCE_QUALITY',
        description: 'Average provenance score must be ≥70',
        threshold: 70,
        blocker: false,
        evaluate: this.evaluateProvenanceQuality.bind(this)
      }
    ];

    this.gateResults = [];
  }

  /**
   * Evaluate all quality gates for a Gantt chart
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Object} validationContext - Validation results context
   * @returns {Promise<Object>} Gate evaluation results
   */
  async evaluateAllGates(ganttData, validationContext = {}) {
    const results = {
      passed: true,
      timestamp: new Date().toISOString(),
      failures: [],
      warnings: [],
      summary: {
        totalGates: this.gates.length,
        passedGates: 0,
        failedBlockers: 0,
        warnings: 0
      }
    };

    this.gateResults = [];

    for (const gate of this.gates) {
      const gateResult = await this.evaluateGate(gate, ganttData, validationContext);

      this.gateResults.push(gateResult);

      if (gateResult.passed) {
        results.summary.passedGates++;
      } else {
        const failure = {
          gate: gate.name,
          description: gate.description,
          score: gateResult.score,
          threshold: gate.threshold,
          blocker: gate.blocker,
          details: gateResult.details
        };

        if (gate.blocker) {
          results.passed = false;
          results.failures.push(failure);
          results.summary.failedBlockers++;
        } else {
          results.warnings.push(failure);
          results.summary.warnings++;
        }
      }
    }

    return results;
  }

  /**
   * Evaluate a single quality gate
   * @param {Object} gate - Gate configuration
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Object} validationContext - Validation context
   * @returns {Promise<Object>} Gate result
   */
  async evaluateGate(gate, ganttData, validationContext) {
    console.log(`[QualityGate] Evaluating: ${gate.name}...`);

    const evaluation = await gate.evaluate(ganttData, validationContext);

    const passed = typeof gate.threshold === 'number'
      ? evaluation.score >= gate.threshold
      : evaluation.passed === true;

    console.log(`[QualityGate] ${gate.name}: ${passed ? 'PASS' : 'FAIL'} (score: ${evaluation.score})`);

    return {
      gateName: gate.name,
      passed: passed,
      score: evaluation.score,
      threshold: gate.threshold,
      details: evaluation.details
    };
  }

  /**
   * Gate 1: Evaluate citation coverage
   * @param {Object} ganttData - BimodalGanttData object
   * @returns {Object} Evaluation result
   */
  evaluateCitationCoverage(ganttData) {
    const explicitTasks = ganttData.tasks.filter(t => t.origin === 'explicit');

    if (explicitTasks.length === 0) {
      return {
        score: 1.0,
        passed: true,
        details: 'No explicit facts to validate'
      };
    }

    const citedTasks = explicitTasks.filter(t =>
      t.sourceCitations && t.sourceCitations.length > 0
    );

    const coverage = citedTasks.length / explicitTasks.length;

    return {
      score: coverage,
      passed: coverage >= 0.75,
      details: {
        totalExplicitTasks: explicitTasks.length,
        citedTasks: citedTasks.length,
        uncitedTasks: explicitTasks.length - citedTasks.length,
        coveragePercentage: Math.round(coverage * 100)
      }
    };
  }

  /**
   * Gate 2: Evaluate contradiction severity
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Object} validationContext - Validation context
   * @returns {Object} Evaluation result
   */
  evaluateContradictions(ganttData, validationContext) {
    const contradictions = validationContext.contradictions || [];

    const highSeverity = contradictions.filter(c => c.severity === 'high');
    const mediumSeverity = contradictions.filter(c => c.severity === 'medium');
    const lowSeverity = contradictions.filter(c => c.severity === 'low');

    const passed = highSeverity.length === 0;

    return {
      score: passed ? 1.0 : 0.0,
      passed: passed,
      details: {
        totalContradictions: contradictions.length,
        highSeverity: highSeverity.length,
        mediumSeverity: mediumSeverity.length,
        lowSeverity: lowSeverity.length,
        highSeverityList: highSeverity.map(c => ({
          type: c.type,
          claims: c.claimDetails
        }))
      }
    };
  }

  /**
   * Gate 3: Evaluate minimum confidence
   * @param {Object} ganttData - BimodalGanttData object
   * @returns {Object} Evaluation result
   */
  evaluateConfidence(ganttData) {
    const tasks = ganttData.tasks;

    if (tasks.length === 0) {
      return {
        score: 1.0,
        passed: true,
        details: 'No tasks to validate'
      };
    }

    const lowConfidenceTasks = tasks.filter(t => (t.confidence || 0) < 0.50);

    const passed = lowConfidenceTasks.length === 0;
    const averageConfidence = tasks.reduce((sum, t) => sum + (t.confidence || 0.5), 0) / tasks.length;

    return {
      score: passed ? 1.0 : 0.0,
      passed: passed,
      details: {
        totalTasks: tasks.length,
        lowConfidenceTasks: lowConfidenceTasks.length,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        lowConfidenceList: lowConfidenceTasks.map(t => ({
          id: t.id,
          name: t.name,
          confidence: t.confidence
        }))
      }
    };
  }

  /**
   * Gate 4: Evaluate schema compliance
   * @param {Object} ganttData - BimodalGanttData object
   * @returns {Object} Evaluation result
   */
  evaluateSchemaCompliance(ganttData) {
    try {
      const result = validateBimodalData(ganttData);

      return {
        score: result.success ? 1.0 : 0.0,
        passed: result.success,
        details: result.success
          ? { message: 'Schema validation passed' }
          : {
              errors: result.errors?.map(e => ({
                path: e.path?.join('.'),
                message: e.message
              }))
            }
      };
    } catch (error) {
      return {
        score: 0.0,
        passed: false,
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Gate 5: Evaluate regulatory flags (non-blocking)
   * @param {Object} ganttData - BimodalGanttData object
   * @returns {Object} Evaluation result
   */
  evaluateRegulatoryFlags(ganttData) {
    const tasks = ganttData.tasks;

    // Detect tasks that should have regulatory flags
    const regulatoryKeywords = [
      'compliance', 'regulatory', 'audit', 'occ', 'fdic', 'federal reserve',
      'approval', 'license', 'certification', 'regulation'
    ];

    const potentialRegulatoryTasks = tasks.filter(t => {
      const taskText = `${t.name} ${t.description || ''}`.toLowerCase();
      return regulatoryKeywords.some(keyword => taskText.includes(keyword));
    });

    const properlyFlagged = potentialRegulatoryTasks.filter(t =>
      t.regulatoryRequirement?.isRequired === true
    );

    const coverage = potentialRegulatoryTasks.length > 0
      ? properlyFlagged.length / potentialRegulatoryTasks.length
      : 1.0;

    return {
      score: coverage,
      passed: coverage >= 1.0,
      details: {
        potentialRegulatoryTasks: potentialRegulatoryTasks.length,
        properlyFlagged: properlyFlagged.length,
        missingFlags: potentialRegulatoryTasks.length - properlyFlagged.length,
        coveragePercentage: Math.round(coverage * 100),
        unflaggedTasks: potentialRegulatoryTasks
          .filter(t => !t.regulatoryRequirement?.isRequired)
          .map(t => ({ id: t.id, name: t.name }))
      }
    };
  }

  /**
   * Gate 6: Evaluate provenance quality (non-blocking)
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Object} validationContext - Validation context
   * @returns {Object} Evaluation result
   */
  evaluateProvenanceQuality(ganttData, validationContext) {
    const provenanceResults = validationContext.provenanceResults || {};

    if (!provenanceResults.summary) {
      return {
        score: 70, // Default passing score
        passed: true,
        details: 'No provenance audit performed'
      };
    }

    const averageScore = provenanceResults.summary.averageScore || 0;

    return {
      score: averageScore,
      passed: averageScore >= 70,
      details: {
        averageScore: averageScore,
        totalClaims: provenanceResults.summary.totalClaims,
        validClaims: provenanceResults.summary.validClaims,
        invalidClaims: provenanceResults.summary.invalidClaims,
        issuesByType: provenanceResults.summary.issuesByType
      }
    };
  }

  /**
   * Get gate status summary
   * @returns {Object} Gate summary
   */
  getGateSummary() {
    if (this.gateResults.length === 0) {
      return null;
    }

    const summary = {
      totalGates: this.gateResults.length,
      passed: this.gateResults.filter(r => r.passed).length,
      failed: this.gateResults.filter(r => !r.passed).length,
      gates: this.gateResults.map(r => ({
        name: r.gateName,
        passed: r.passed,
        score: r.score
      }))
    };

    return summary;
  }

  /**
   * Generate repair suggestions for failed gates
   * @param {Object} gateResults - Results from evaluateAllGates
   * @returns {Array} Array of repair suggestions
   */
  generateRepairSuggestions(gateResults) {
    const suggestions = [];

    for (const failure of gateResults.failures) {
      switch (failure.gate) {
        case 'CITATION_COVERAGE':
          suggestions.push({
            gate: failure.gate,
            action: 'DOWNGRADE_UNCITED_FACTS',
            description: 'Convert uncited explicit facts to high-confidence inferences',
            targets: failure.details.uncitedTasks,
            priority: 'high'
          });
          break;

        case 'CONTRADICTION_SEVERITY':
          suggestions.push({
            gate: failure.gate,
            action: 'RESOLVE_CONTRADICTIONS',
            description: 'Apply contradiction resolution matrix to resolve conflicts',
            targets: failure.details.highSeverityList,
            priority: 'high'
          });
          break;

        case 'CONFIDENCE_MINIMUM':
          suggestions.push({
            gate: failure.gate,
            action: 'REMOVE_LOW_CONFIDENCE_TASKS',
            description: 'Remove tasks below confidence threshold or boost with additional evidence',
            targets: failure.details.lowConfidenceList,
            priority: 'high'
          });
          break;

        case 'SCHEMA_COMPLIANCE':
          suggestions.push({
            gate: failure.gate,
            action: 'APPLY_SEMANTIC_REPAIR',
            description: 'Run semantic repair to fix schema violations',
            targets: failure.details.errors,
            priority: 'critical'
          });
          break;

        default:
          suggestions.push({
            gate: failure.gate,
            action: 'MANUAL_REVIEW',
            description: 'Manual review required',
            priority: 'medium'
          });
      }
    }

    return suggestions;
  }
}

// Export singleton instance
export const qualityGateManager = new QualityGateManager();
