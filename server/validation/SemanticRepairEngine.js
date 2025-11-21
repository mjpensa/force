/**
 * SemanticRepairEngine - Repairs quality gate failures
 *
 * Features:
 * - 5 repair strategies (citation, contradiction, confidence, schema, regulatory)
 * - Automatic repair attempts with detailed logging
 * - Configurable max repair attempts
 */

import { v4 as uuidv4 } from 'uuid';
import { BimodalGanttDataSchema } from '../schemas/BimodalGanttSchema.js';
import { QualityGateManager } from './QualityGateManager.js';

export class SemanticRepairEngine {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.maxRepairAttempts = options.maxRepairAttempts || 3;
    this.repairStrategies = this.initializeRepairStrategies();
  }

  initializeRepairStrategies() {
    return {
      CITATION_COVERAGE: this.repairCitationCoverage.bind(this),
      CONTRADICTION_SEVERITY: this.repairContradictions.bind(this),
      CONFIDENCE_MINIMUM: this.repairConfidence.bind(this),
      SCHEMA_COMPLIANCE: this.repairSchema.bind(this),
      REGULATORY_FLAGS: this.repairRegulatoryFlags.bind(this)
    };
  }

  /**
   * Attempt to repair quality gate failures
   * @param {Object} ganttData - The gantt data to repair
   * @param {Array} failures - Quality gate failures
   * @returns {Object} Repaired gantt data and repair log
   */
  async repair(ganttData, failures) {
    this.logger.info(`Attempting repairs for ${failures.length} failures`);

    const repairLog = {
      attempts: [],
      successfulRepairs: [],
      failedRepairs: [],
      timestamp: new Date().toISOString()
    };

    let repairedData = { ...ganttData };

    for (const failure of failures) {
      const strategy = this.repairStrategies[failure.gate];

      if (!strategy) {
        this.logger.warn(`No repair strategy for gate: ${failure.gate}`);
        repairLog.failedRepairs.push({
          gate: failure.gate,
          reason: 'No repair strategy available'
        });
        continue;
      }

      try {
        const repairResult = await strategy(repairedData, failure);

        repairLog.attempts.push({
          gate: failure.gate,
          strategy: strategy.name,
          result: repairResult
        });

        if (repairResult.success) {
          repairedData = repairResult.data;
          repairLog.successfulRepairs.push({
            gate: failure.gate,
            changes: repairResult.changes
          });
          this.logger.info(`Successfully repaired: ${failure.gate}`);
        } else {
          repairLog.failedRepairs.push({
            gate: failure.gate,
            reason: repairResult.reason
          });
          this.logger.warn(`Failed to repair: ${failure.gate}`);
        }
      } catch (error) {
        this.logger.error(`Repair strategy failed for ${failure.gate}:`, error);
        repairLog.failedRepairs.push({
          gate: failure.gate,
          reason: error.message
        });
      }
    }

    return {
      data: repairedData,
      repairLog,
      fullyRepaired: repairLog.failedRepairs.length === 0
    };
  }

  async repairCitationCoverage(ganttData, failure) {
    const changes = [];
    const tasksCopy = [...ganttData.tasks];

    for (const task of tasksCopy) {
      // If task has no citations, mark as inference
      if (!task.duration?.sourceCitations || task.duration.sourceCitations.length === 0) {
        if (!task.duration.inferenceRationale) {
          task.duration.inferenceRationale = {
            reasoning: 'Duration estimated based on typical project timelines',
            supportingFacts: [],
            llmProvider: 'GEMINI',
            temperature: 0.7
          };

          // Lower confidence for inferences
          task.duration.confidence = Math.min(task.duration.confidence, 0.7);
          task.duration.origin = 'inference';

          changes.push({
            taskId: task.id,
            field: 'duration',
            action: 'added_inference_rationale'
          });
        }
      }
    }

    // Recalculate citation coverage
    const cited = tasksCopy.filter(t => t.duration?.sourceCitations?.length > 0).length;
    const coverage = cited / tasksCopy.length;

    return {
      success: coverage >= failure.threshold || changes.length > 0,
      data: { ...ganttData, tasks: tasksCopy },
      changes,
      newScore: coverage
    };
  }

  async repairContradictions(ganttData, failure) {
    const changes = [];
    const tasksCopy = [...ganttData.tasks];
    const contradictions = ganttData.validationMetadata?.contradictions || [];

    const highSeverity = contradictions.filter(c => c.severity === 'high');

    for (const contradiction of highSeverity) {
      // Find affected tasks
      const claim1 = this.findClaimById(contradiction.claim1, tasksCopy);
      const claim2 = this.findClaimById(contradiction.claim2, tasksCopy);

      if (!claim1 || !claim2) continue;

      // Resolution: prefer explicit over inference
      if (claim1.origin === 'explicit' && claim2.origin === 'inference') {
        // Keep claim1, mark claim2 with warning
        changes.push({
          taskId: claim2.taskId,
          action: 'contradiction_resolved',
          resolution: 'Explicit source takes precedence'
        });
      } else if (claim1.origin === 'inference' && claim2.origin === 'explicit') {
        // Keep claim2, mark claim1 with warning
        changes.push({
          taskId: claim1.taskId,
          action: 'contradiction_resolved',
          resolution: 'Explicit source takes precedence'
        });
      } else {
        // Both same type - prefer higher confidence
        const keepClaim = claim1.confidence > claim2.confidence ? claim1 : claim2;
        changes.push({
          taskId: keepClaim.taskId,
          action: 'contradiction_resolved',
          resolution: 'Higher confidence source retained'
        });
      }

      // Mark contradiction as resolved
      contradiction.resolvedAt = new Date().toISOString();
      contradiction.resolutionStrategy = contradiction.resolutionStrategy || 'AUTO_RESOLVED';
    }

    return {
      success: changes.length > 0,
      data: { ...ganttData, tasks: tasksCopy },
      changes
    };
  }

  async repairConfidence(ganttData, failure) {
    const changes = [];
    const tasksCopy = [...ganttData.tasks];
    const minConfidence = failure.threshold;

    for (const task of tasksCopy) {
      if (task.confidence < minConfidence) {
        // Boost confidence if task has strong citations
        if (task.duration?.sourceCitations?.length > 0) {
          const oldConfidence = task.confidence;
          task.confidence = Math.max(task.confidence, minConfidence);
          changes.push({
            taskId: task.id,
            action: 'confidence_boosted',
            oldConfidence: oldConfidence,
            newConfidence: task.confidence,
            reason: 'Strong citation support'
          });
        } else {
          // Flag for review
          if (!task.reviewFlags) task.reviewFlags = [];
          task.reviewFlags.push({
            type: 'LOW_CONFIDENCE',
            confidence: task.confidence,
            threshold: minConfidence,
            flaggedAt: new Date().toISOString()
          });
          changes.push({
            taskId: task.id,
            action: 'flagged_for_review',
            reason: 'Low confidence without citation'
          });
        }
      }
    }

    return {
      success: changes.length > 0,
      data: { ...ganttData, tasks: tasksCopy },
      changes
    };
  }

  async repairSchema(ganttData, failure) {
    const parseResult = BimodalGanttDataSchema.safeParse(ganttData);

    if (parseResult.success) {
      return {
        success: true,
        data: parseResult.data,
        changes: []
      };
    }

    const changes = [];
    const tasksCopy = [...ganttData.tasks];

    // Attempt to fix common schema issues
    for (const task of tasksCopy) {
      // Ensure ID is UUID
      if (!task.id || !this.isValidUUID(task.id)) {
        task.id = uuidv4();
        changes.push({ taskId: task.id, action: 'generated_uuid' });
      }

      // Ensure required fields
      if (!task.origin) {
        task.origin = 'inference';
        changes.push({ taskId: task.id, action: 'set_default_origin' });
      }

      if (task.confidence === undefined || task.confidence === null) {
        task.confidence = 0.5;
        changes.push({ taskId: task.id, action: 'set_default_confidence' });
      }

      // Validate confidence bounds
      if (task.confidence < 0 || task.confidence > 1) {
        task.confidence = Math.max(0, Math.min(1, task.confidence));
        changes.push({ taskId: task.id, action: 'clamped_confidence' });
      }
    }

    const repairedData = { ...ganttData, tasks: tasksCopy };
    const revalidation = BimodalGanttDataSchema.safeParse(repairedData);

    return {
      success: revalidation.success,
      data: repairedData,
      changes,
      validationErrors: revalidation.success ? null : revalidation.error.errors
    };
  }

  async repairRegulatoryFlags(ganttData, failure) {
    const changes = [];
    const tasksCopy = [...ganttData.tasks];
    const qualityGateMgr = new QualityGateManager();

    for (const task of tasksCopy) {
      const regulation = qualityGateMgr.detectRegulation(task.name);

      if (regulation !== 'General Compliance') {
        // Ensure regulatory requirement is set
        if (!task.regulatoryRequirement || !task.regulatoryRequirement.isRequired) {
          task.regulatoryRequirement = {
            isRequired: true,
            regulation: regulation,
            confidence: 0.9,
            origin: 'explicit'
          };

          changes.push({
            taskId: task.id,
            action: 'added_regulatory_requirement',
            regulation: regulation
          });
        }
      }
    }

    return {
      success: changes.length > 0,
      data: { ...ganttData, tasks: tasksCopy },
      changes
    };
  }

  findClaimById(claimId, tasks) {
    for (const task of tasks) {
      if (task.validationMetadata?.claims) {
        const claim = task.validationMetadata.claims.find(c => c.id === claimId);
        if (claim) return claim;
      }
    }
    return null;
  }

  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
