/**
 * Research Validation Service
 * Main orchestrator for the cross-validated semantic Gantt architecture
 *
 * Coordinates:
 * 1. Task claim extraction
 * 2. Citation verification
 * 3. Contradiction detection
 * 4. Provenance auditing
 * 5. Confidence calibration
 * 6. Quality gate enforcement
 * 7. Metrics collection
 *
 * This is the primary integration point between research synthesis and semantic Gantt generation
 */

import { taskClaimExtractor } from './TaskClaimExtractor.js';
import { citationVerifier } from '../validation/CitationVerifier.js';
import { contradictionDetector, ContradictionDetector } from '../validation/ContradictionDetector.js';
import { provenanceAuditor } from '../validation/ProvenanceAuditor.js';
import { confidenceCalibrator } from './ConfidenceCalibrator.js';
import { qualityGateManager } from '../validation/QualityGateManager.js';
import { validationMetricsCollector } from './ValidationMetricsCollector.js';

export class ResearchValidationService {
  constructor() {
    this.claimLedger = new Map();
    this.contradictionDetector = new ContradictionDetector(this.claimLedger);
    this.validationHistory = [];
  }

  /**
   * Main validation pipeline for BimodalGanttData
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Array} sourceDocuments - Original research documents [{name, content}]
   * @returns {Promise<Object>} Validation results with calibrated data
   */
  async validateGanttData(ganttData, sourceDocuments = []) {
    console.log('[ResearchValidation] Starting validation pipeline...');
    const startTime = Date.now();

    const validationResult = {
      success: true,
      timestamp: new Date().toISOString(),
      validationSteps: [],
      warnings: [],
      errors: [],
      calibratedData: null,
      metrics: {}
    };

    try {
      // Step 1: Extract claims from all tasks
      console.log('[ResearchValidation] Step 1: Extracting task claims...');
      const claimExtractionResult = await this.extractAllClaims(ganttData.tasks);
      validationResult.validationSteps.push({
        step: 1,
        name: 'Claim Extraction',
        status: 'completed',
        claims: claimExtractionResult.totalClaims
      });
      validationResult.totalClaims = claimExtractionResult.totalClaims;

      // Step 2: Verify citations for all claims
      console.log('[ResearchValidation] Step 2: Verifying citations...');
      const citationResults = await this.verifyCitations(
        claimExtractionResult.allClaims,
        sourceDocuments
      );
      validationResult.validationSteps.push({
        step: 2,
        name: 'Citation Verification',
        status: 'completed',
        verified: citationResults.verified,
        failed: citationResults.failed
      });

      // Step 3: Detect contradictions
      console.log('[ResearchValidation] Step 3: Detecting contradictions...');
      const contradictionResults = await this.detectAllContradictions(
        claimExtractionResult.allClaims
      );
      validationResult.validationSteps.push({
        step: 3,
        name: 'Contradiction Detection',
        status: 'completed',
        contradictions: contradictionResults.totalContradictions
      });
      validationResult.contradictions = contradictionResults.contradictions;

      // Step 4: Audit provenance
      console.log('[ResearchValidation] Step 4: Auditing provenance...');
      const provenanceResults = await provenanceAuditor.auditClaims(
        claimExtractionResult.allClaims,
        sourceDocuments
      );
      validationResult.validationSteps.push({
        step: 4,
        name: 'Provenance Audit',
        status: 'completed',
        averageScore: provenanceResults.summary.averageScore
      });
      validationResult.provenanceResults = provenanceResults;

      // Step 5: Prepare task validation results
      const taskValidations = this.aggregateTaskValidations(
        ganttData.tasks,
        claimExtractionResult.claimsByTask,
        citationResults.resultsByTask,
        contradictionResults.contradictionsByTask,
        provenanceResults.results
      );

      // Step 6: Calibrate confidence for all tasks
      console.log('[ResearchValidation] Step 6: Calibrating confidence scores...');
      const calibratedTasks = await this.calibrateTaskConfidences(
        ganttData.tasks,
        taskValidations
      );
      validationResult.validationSteps.push({
        step: 6,
        name: 'Confidence Calibration',
        status: 'completed',
        tasksCalibrated: calibratedTasks.length
      });

      // Step 7: Apply quality gates
      console.log('[ResearchValidation] Step 7: Applying quality gates...');
      const calibratedGanttData = {
        ...ganttData,
        tasks: calibratedTasks
      };

      const gateResults = await qualityGateManager.evaluateAllGates(
        calibratedGanttData,
        {
          contradictions: contradictionResults.contradictions,
          provenanceResults: provenanceResults,
          taskValidations: taskValidations
        }
      );

      validationResult.validationSteps.push({
        step: 7,
        name: 'Quality Gates',
        status: gateResults.passed ? 'passed' : 'failed',
        failures: gateResults.failures.length,
        warnings: gateResults.warnings.length
      });
      validationResult.qualityGateResults = gateResults;

      // Step 8: Handle quality gate failures
      if (!gateResults.passed) {
        console.warn('[ResearchValidation] Quality gates failed, attempting repair...');
        const repairResult = await this.attemptRepair(
          calibratedGanttData,
          gateResults,
          taskValidations
        );

        if (repairResult.success) {
          validationResult.calibratedData = repairResult.repairedData;
          validationResult.repairsApplied = repairResult.repairsApplied;
          validationResult.warnings.push(
            `Applied ${repairResult.repairsApplied} repairs to pass quality gates`
          );
        } else {
          validationResult.success = false;
          validationResult.errors.push('Quality gates failed and repairs unsuccessful');
          validationResult.calibratedData = calibratedGanttData; // Return calibrated but unrepaired
        }
      } else {
        validationResult.calibratedData = calibratedGanttData;
      }

      // Step 9: Collect metrics
      const validationTimeMs = Date.now() - startTime;
      validationMetricsCollector.recordValidation(
        validationResult.calibratedData,
        validationResult,
        { validationTimeMs }
      );

      validationResult.metrics = {
        validationTimeMs: validationTimeMs,
        healthScore: validationMetricsCollector.getHealthScore()
      };

      console.log(`[ResearchValidation] Validation completed in ${validationTimeMs}ms`);

      return validationResult;

    } catch (error) {
      console.error('[ResearchValidation] Validation pipeline error:', error);
      validationResult.success = false;
      validationResult.errors.push(error.message);
      validationResult.calibratedData = ganttData; // Return original data on error

      return validationResult;
    }
  }

  /**
   * Extract claims from all tasks
   * @param {Array} tasks - Array of BimodalGanttData tasks
   * @returns {Promise<Object>} Extraction results
   */
  async extractAllClaims(tasks) {
    const allClaims = [];
    const claimsByTask = new Map();

    for (const task of tasks) {
      const taskClaims = await taskClaimExtractor.extractClaims(task);
      allClaims.push(...taskClaims);
      claimsByTask.set(task.id, taskClaims);

      // Add claims to ledger
      taskClaims.forEach(claim => {
        this.claimLedger.set(claim.id, claim);
      });
    }

    return {
      allClaims: allClaims,
      claimsByTask: claimsByTask,
      totalClaims: allClaims.length,
      statistics: taskClaimExtractor.getClaimStatistics(allClaims)
    };
  }

  /**
   * Verify citations for all claims
   * @param {Array} claims - Array of claims
   * @param {Array} sourceDocuments - Source documents
   * @returns {Promise<Object>} Verification results
   */
  async verifyCitations(claims, sourceDocuments) {
    const results = [];
    const resultsByTask = new Map();

    for (const claim of claims) {
      const verification = await citationVerifier.verifyCitation(claim, sourceDocuments);
      results.push({
        claimId: claim.id,
        taskId: claim.taskId,
        verification: verification
      });

      // Group by task
      if (!resultsByTask.has(claim.taskId)) {
        resultsByTask.set(claim.taskId, []);
      }
      resultsByTask.get(claim.taskId).push(verification);
    }

    const verified = results.filter(r => r.verification.valid).length;
    const failed = results.length - verified;

    return {
      results: results,
      resultsByTask: resultsByTask,
      verified: verified,
      failed: failed
    };
  }

  /**
   * Detect contradictions for all claims
   * @param {Array} claims - Array of claims
   * @returns {Promise<Object>} Contradiction results
   */
  async detectAllContradictions(claims) {
    // Update contradiction detector with current claim ledger
    this.contradictionDetector.setClaimLedger(this.claimLedger);

    const allContradictions = [];
    const contradictionsByTask = new Map();

    for (const claim of claims) {
      const contradictions = await this.contradictionDetector.detectContradictions(claim);

      allContradictions.push(...contradictions);

      // Group by task
      if (!contradictionsByTask.has(claim.taskId)) {
        contradictionsByTask.set(claim.taskId, []);
      }
      contradictionsByTask.get(claim.taskId).push(...contradictions);
    }

    return {
      contradictions: allContradictions,
      contradictionsByTask: contradictionsByTask,
      totalContradictions: allContradictions.length
    };
  }

  /**
   * Aggregate validation results per task
   * @param {Array} tasks - Tasks
   * @param {Map} claimsByTask - Claims by task
   * @param {Map} citationResultsByTask - Citation results by task
   * @param {Map} contradictionsByTask - Contradictions by task
   * @param {Array} provenanceResults - Provenance audit results
   * @returns {Array} Task validation results
   */
  aggregateTaskValidations(
    tasks,
    claimsByTask,
    citationResultsByTask,
    contradictionsByTask,
    provenanceResults
  ) {
    return tasks.map(task => {
      const taskClaims = claimsByTask.get(task.id) || [];
      const citationResults = citationResultsByTask.get(task.id) || [];
      const contradictions = contradictionsByTask.get(task.id) || [];

      // Calculate citation coverage for this task
      const validCitations = citationResults.filter(r => r.valid).length;
      const citationCoverage = citationResults.length > 0
        ? validCitations / citationResults.length
        : 0;

      // Calculate average provenance score for this task's claims
      const taskProvenanceResults = provenanceResults.filter(r =>
        taskClaims.some(c => c.id === r.claimId)
      );
      const avgProvenanceScore = taskProvenanceResults.length > 0
        ? taskProvenanceResults.reduce((sum, r) => sum + r.score, 0) / taskProvenanceResults.length
        : 70;

      return {
        taskId: task.id,
        claims: taskClaims,
        citationCoverage: citationCoverage,
        contradictions: contradictions,
        provenanceScore: avgProvenanceScore
      };
    });
  }

  /**
   * Calibrate confidence for all tasks
   * @param {Array} tasks - Tasks
   * @param {Array} taskValidations - Validation results per task
   * @returns {Promise<Array>} Tasks with calibrated confidence
   */
  async calibrateTaskConfidences(tasks, taskValidations) {
    const calibratedTasks = [];

    for (const task of tasks) {
      const validation = taskValidations.find(v => v.taskId === task.id);

      if (!validation) {
        calibratedTasks.push(task);
        continue;
      }

      const calibratedConfidence = await confidenceCalibrator.calibrateTaskConfidence(
        task,
        validation
      );

      calibratedTasks.push({
        ...task,
        confidence: calibratedConfidence,
        validationMetadata: {
          originalConfidence: task.confidence,
          calibratedConfidence: calibratedConfidence,
          citationCoverage: validation.citationCoverage,
          contradictions: validation.contradictions.length,
          provenanceScore: validation.provenanceScore
        }
      });
    }

    return calibratedTasks;
  }

  /**
   * Attempt to repair failed quality gates
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Object} gateResults - Quality gate results
   * @param {Array} taskValidations - Task validation results
   * @returns {Promise<Object>} Repair results
   */
  async attemptRepair(ganttData, gateResults, taskValidations) {
    const repairResult = {
      success: false,
      repairedData: { ...ganttData },
      repairsApplied: 0,
      repairLog: []
    };

    const suggestions = qualityGateManager.generateRepairSuggestions(gateResults);

    for (const suggestion of suggestions) {
      switch (suggestion.action) {
        case 'DOWNGRADE_UNCITED_FACTS':
          const downgradeResult = this.downgradedUncitedFacts(repairResult.repairedData);
          repairResult.repairsApplied += downgradeResult.count;
          repairResult.repairLog.push(downgradeResult.log);
          break;

        case 'RESOLVE_CONTRADICTIONS':
          const resolutionResult = this.resolveContradictions(
            repairResult.repairedData,
            suggestion.targets
          );
          repairResult.repairsApplied += resolutionResult.count;
          repairResult.repairLog.push(resolutionResult.log);
          break;

        case 'REMOVE_LOW_CONFIDENCE_TASKS':
          const removalResult = this.removeLowConfidenceTasks(repairResult.repairedData);
          repairResult.repairsApplied += removalResult.count;
          repairResult.repairLog.push(removalResult.log);
          break;

        default:
          console.warn(`[ResearchValidation] Unknown repair action: ${suggestion.action}`);
      }
    }

    // Re-evaluate quality gates after repairs
    const revalidationResults = await qualityGateManager.evaluateAllGates(
      repairResult.repairedData,
      { taskValidations }
    );

    repairResult.success = revalidationResults.passed;

    return repairResult;
  }

  /**
   * Downgrade uncited explicit facts to inferences
   * @param {Object} ganttData - BimodalGanttData object
   * @returns {Object} Repair result
   */
  downgradedUncitedFacts(ganttData) {
    let count = 0;

    ganttData.tasks = ganttData.tasks.map(task => {
      if (task.origin === 'explicit' &&
          (!task.sourceCitations || task.sourceCitations.length === 0)) {
        count++;
        return {
          ...task,
          origin: 'inferred',
          confidence: Math.min(task.confidence, 0.85) // Cap at 0.85 for downgraded facts
        };
      }
      return task;
    });

    return {
      count: count,
      log: `Downgraded ${count} uncited explicit facts to inferences`
    };
  }

  /**
   * Resolve contradictions using resolution matrix
   * @param {Object} ganttData - BimodalGanttData object
   * @param {Array} contradictions - Array of contradictions to resolve
   * @returns {Object} Repair result
   */
  resolveContradictions(ganttData, contradictions) {
    let count = 0;

    for (const contradiction of contradictions) {
      if (contradiction.resolution?.action) {
        // Apply resolution action
        const action = contradiction.resolution.action;

        if (action.includes('REDUCE') || action.includes('FLAG')) {
          // Find affected tasks and reduce confidence
          const taskIds = [
            contradiction.claimDetails.claim1.taskId,
            contradiction.claimDetails.claim2.taskId
          ];

          ganttData.tasks = ganttData.tasks.map(task => {
            if (taskIds.includes(task.id)) {
              count++;
              return {
                ...task,
                confidence: task.confidence * 0.85, // Reduce by 15%
                contradictionFlags: [
                  ...(task.contradictionFlags || []),
                  contradiction.id
                ]
              };
            }
            return task;
          });
        }
      }
    }

    return {
      count: count,
      log: `Resolved ${count} contradiction impacts`
    };
  }

  /**
   * Remove tasks below confidence threshold
   * @param {Object} ganttData - BimodalGanttData object
   * @returns {Object} Repair result
   */
  removeLowConfidenceTasks(ganttData) {
    const originalCount = ganttData.tasks.length;

    ganttData.tasks = ganttData.tasks.filter(task =>
      (task.confidence || 0) >= 0.50
    );

    const removed = originalCount - ganttData.tasks.length;

    return {
      count: removed,
      log: `Removed ${removed} tasks below confidence threshold`
    };
  }

  /**
   * Clear claim ledger and reset state
   */
  reset() {
    this.claimLedger.clear();
    this.contradictionDetector = new ContradictionDetector(this.claimLedger);
    citationVerifier.clearCache();
    provenanceAuditor.clearCache();

    console.log('[ResearchValidation] Service reset');
  }
}

// Export singleton instance
export const researchValidationService = new ResearchValidationService();
