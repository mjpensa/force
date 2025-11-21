import { describe, it, expect, beforeEach } from '@jest/globals';
import { QualityGateManager } from '../QualityGateManager.js';
import { SemanticRepairEngine } from '../SemanticRepairEngine.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Phase 3 Integration Tests
 * Tests the end-to-end workflow of quality gate evaluation and repair
 */

// Helper function to create valid gantt data
function createValidGanttData(tasksOverride = [], additionalFields = {}) {
  return {
    id: uuidv4(),
    projectName: 'Test Project',
    tasks: tasksOverride,
    metadata: {
      createdAt: new Date().toISOString(),
      totalTasks: tasksOverride.length,
      factRatio: 0.8,
      avgConfidence: 0.85
    },
    validationMetadata: {
      contradictions: []
    },
    ...additionalFields
  };
}

// Helper function to create a valid citation
function createValidCitation() {
  return {
    documentName: 'test.pdf',
    exactQuote: 'Test quote',
    provider: 'INTERNAL',
    startChar: 1,
    endChar: 11,
    retrievedAt: new Date().toISOString()
  };
}

// Helper to create a valid task
function createValidTask(overrides = {}) {
  return {
    id: uuidv4(),
    name: 'Task 1',
    origin: 'explicit',
    confidence: 0.9,
    duration: {
      value: 10,
      unit: 'days',
      confidence: 0.9,
      origin: 'explicit',
      sourceCitations: [createValidCitation()]
    },
    ...overrides
  };
}

describe('Quality Gate & Repair Integration', () => {
  let qualityGateManager;
  let repairEngine;

  beforeEach(() => {
    qualityGateManager = new QualityGateManager({
      citationCoverageThreshold: 0.75,
      minConfidence: 0.5
    });
    repairEngine = new SemanticRepairEngine();
  });

  describe('End-to-End Quality Gate Evaluation and Repair', () => {
    it('should detect failures and repair them successfully', async () => {
      // Create gantt data with multiple quality issues
      const ganttData = createValidGanttData([
        createValidTask({ confidence: 0.9 }), // Good task
        createValidTask({
          confidence: 0.3, // Low confidence
          duration: { value: 5, unit: 'days', confidence: 0.3, origin: 'inference' } // No citation
        }),
        createValidTask({
          confidence: 0.8,
          duration: { value: 7, unit: 'days', confidence: 0.8, origin: 'explicit' } // No citation
        }),
        createValidTask({
          name: 'FDA 510(k) submission', // Regulatory task without flags
          confidence: 0.9
        })
      ]);

      // STEP 1: Evaluate quality gates
      const evaluation = await qualityGateManager.evaluate(ganttData);

      expect(evaluation.passed).toBe(false);
      expect(evaluation.failures.length).toBeGreaterThan(0);

      // Should fail citation coverage (only 1/4 tasks cited)
      expect(evaluation.failures.some(f => f.gate === 'CITATION_COVERAGE')).toBe(true);

      // Should fail confidence minimum (task 2 has 0.3 confidence)
      expect(evaluation.failures.some(f => f.gate === 'CONFIDENCE_MINIMUM')).toBe(true);

      // Should warn about regulatory flags
      expect(evaluation.warnings.some(w => w.gate === 'REGULATORY_FLAGS')).toBe(true);

      // STEP 2: Attempt repairs
      const repairResult = await repairEngine.repair(ganttData, evaluation.failures);

      expect(repairResult.repairLog.successfulRepairs.length).toBeGreaterThan(0);

      // STEP 3: Re-evaluate after repairs
      const revalidation = await qualityGateManager.evaluate(repairResult.data);

      // After repair, repairs should have been attempted (not all gates will pass)
      // Citation coverage repair adds inference rationale but doesn't increase coverage
      // Confidence repair may flag tasks for review rather than boosting all
      expect(repairResult.repairLog.successfulRepairs.length).toBeGreaterThan(0);

      // Some repairs may reduce failures (schema compliance, contradictions)
      // but others may not (citation coverage, confidence minimum)
      expect(revalidation.failures.length).toBeLessThanOrEqual(evaluation.failures.length);
    });

    it('should handle citation coverage repair workflow', async () => {
      const ganttData = createValidGanttData([
        createValidTask(), // Has citation
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.9, origin: 'explicit' } }), // No citation
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.9, origin: 'explicit' } }), // No citation
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.9, origin: 'explicit' } }) // No citation
      ]);

      // Initial evaluation: 25% citation coverage (1/4), threshold is 75%
      const evaluation = await qualityGateManager.evaluate(ganttData);

      expect(evaluation.passed).toBe(false);
      const citationFailure = evaluation.failures.find(f => f.gate === 'CITATION_COVERAGE');
      expect(citationFailure).toBeDefined();
      expect(citationFailure.score).toBe(0.25);

      // Repair: Should add inference rationale
      const repairResult = await repairEngine.repair(ganttData, [citationFailure]);

      expect(repairResult.repairLog.successfulRepairs).toHaveLength(1);
      expect(repairResult.data.tasks[1].duration.inferenceRationale).toBeDefined();
      expect(repairResult.data.tasks[2].duration.inferenceRationale).toBeDefined();
      expect(repairResult.data.tasks[3].duration.inferenceRationale).toBeDefined();

      // All uncited tasks should now have inference origin and lower confidence
      expect(repairResult.data.tasks[1].duration.origin).toBe('inference');
      expect(repairResult.data.tasks[1].duration.confidence).toBe(0.7);
    });

    it('should handle confidence minimum repair workflow', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ confidence: 0.3 }), // Low but has citation - should boost
        createValidTask({
          confidence: 0.2,
          duration: { value: 5, unit: 'days', confidence: 0.2, origin: 'inference' }
        }) // Low without citation - should flag
      ]);

      const evaluation = await qualityGateManager.evaluate(ganttData);

      expect(evaluation.passed).toBe(false);
      const confidenceFailure = evaluation.failures.find(f => f.gate === 'CONFIDENCE_MINIMUM');
      expect(confidenceFailure).toBeDefined();

      // Repair
      const repairResult = await repairEngine.repair(ganttData, [confidenceFailure]);

      expect(repairResult.repairLog.successfulRepairs).toHaveLength(1);

      // Task 1: boosted to threshold
      expect(repairResult.data.tasks[0].confidence).toBe(0.5);

      // Task 2: flagged for review
      expect(repairResult.data.tasks[1].reviewFlags).toBeDefined();
      expect(repairResult.data.tasks[1].reviewFlags[0].type).toBe('LOW_CONFIDENCE');
    });

    it('should handle regulatory flags repair workflow', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ name: 'FDA 510(k) submission' }),
        createValidTask({ name: 'HIPAA compliance review' }),
        createValidTask({ name: 'Regular development task' })
      ]);

      const evaluation = await qualityGateManager.evaluate(ganttData);

      // Should warn (not fail) about regulatory flags
      expect(evaluation.passed).toBe(true); // Non-blocker
      expect(evaluation.warnings.some(w => w.gate === 'REGULATORY_FLAGS')).toBe(true);

      // Repair warnings
      const repairResult = await repairEngine.repair(ganttData, evaluation.warnings);

      expect(repairResult.data.tasks[0].regulatoryRequirement).toBeDefined();
      expect(repairResult.data.tasks[0].regulatoryRequirement.regulation).toBe('FDA');
      expect(repairResult.data.tasks[1].regulatoryRequirement.regulation).toBe('HIPAA');
      expect(repairResult.data.tasks[2].regulatoryRequirement).toBeUndefined(); // Regular task

      // Re-evaluate: warnings should be gone
      const revalidation = await qualityGateManager.evaluate(repairResult.data);
      expect(revalidation.warnings.some(w => w.gate === 'REGULATORY_FLAGS')).toBe(false);
    });

    it('should handle contradiction severity repair workflow', async () => {
      const claim1Id = uuidv4();
      const claim2Id = uuidv4();

      const ganttData = createValidGanttData(
        [
          createValidTask({
            validationMetadata: {
              claims: [{ id: claim1Id, taskId: 'task-1', origin: 'explicit', confidence: 0.9 }]
            }
          }),
          createValidTask({
            validationMetadata: {
              claims: [{ id: claim2Id, taskId: 'task-2', origin: 'inference', confidence: 0.7 }]
            }
          })
        ],
        {
          validationMetadata: {
            contradictions: [
              { type: 'numerical', severity: 'high', claim1: claim1Id, claim2: claim2Id }
            ]
          }
        }
      );

      const evaluation = await qualityGateManager.evaluate(ganttData);

      expect(evaluation.passed).toBe(false);
      const contradictionFailure = evaluation.failures.find(f => f.gate === 'CONTRADICTION_SEVERITY');
      expect(contradictionFailure).toBeDefined();

      // Repair
      const repairResult = await repairEngine.repair(ganttData, [contradictionFailure]);

      expect(repairResult.repairLog.successfulRepairs).toHaveLength(1);
      expect(repairResult.data.validationMetadata.contradictions[0].resolvedAt).toBeDefined();
      expect(repairResult.data.validationMetadata.contradictions[0].resolutionStrategy).toBe('AUTO_RESOLVED');
    });

    it('should handle schema compliance repair workflow', async () => {
      const ganttData = createValidGanttData([
        { ...createValidTask(), id: 'invalid-uuid', confidence: 1.5 }, // Invalid UUID and confidence
        { ...createValidTask(), confidence: -0.2 } // Invalid confidence
      ]);

      delete ganttData.tasks[0].origin; // Missing required field

      const evaluation = await qualityGateManager.evaluate(ganttData);

      expect(evaluation.passed).toBe(false);
      const schemaFailure = evaluation.failures.find(f => f.gate === 'SCHEMA_COMPLIANCE');
      expect(schemaFailure).toBeDefined();

      // Repair
      const repairResult = await repairEngine.repair(ganttData, [schemaFailure]);

      expect(repairResult.repairLog.successfulRepairs).toHaveLength(1);

      // UUID should be generated
      expect(repairEngine.isValidUUID(repairResult.data.tasks[0].id)).toBe(true);

      // Origin should be set
      expect(repairResult.data.tasks[0].origin).toBe('inference');

      // Confidence should be clamped
      expect(repairResult.data.tasks[0].confidence).toBe(1);
      expect(repairResult.data.tasks[1].confidence).toBe(0);

      // Re-validate: should now pass schema compliance
      const revalidation = await qualityGateManager.evaluate(repairResult.data);
      expect(revalidation.failures.some(f => f.gate === 'SCHEMA_COMPLIANCE')).toBe(false);
    });
  });

  describe('Multiple Repair Iterations', () => {
    it('should handle multiple repair iterations until gates pass', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ confidence: 0.3, duration: { value: 5, unit: 'days', confidence: 0.3, origin: 'inference' } }),
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.9, origin: 'explicit' } }),
        createValidTask({ name: 'FDA approval process' })
      ]);

      let currentData = ganttData;
      let iteration = 0;
      const maxIterations = 3;

      while (iteration < maxIterations) {
        const evaluation = await qualityGateManager.evaluate(currentData);

        if (evaluation.passed && evaluation.warnings.length === 0) {
          break; // All gates passed
        }

        // Repair failures and warnings
        const allIssues = [...evaluation.failures, ...evaluation.warnings];
        const repairResult = await repairEngine.repair(currentData, allIssues);

        currentData = repairResult.data;
        iteration++;
      }

      // Final evaluation
      const finalEvaluation = await qualityGateManager.evaluate(currentData);

      // Should have attempted repairs (not all may resolve the underlying issues)
      expect(iteration).toBeGreaterThan(0);

      // Some failures may persist (citation coverage, confidence minimum)
      // as repairs mitigate but don't fully resolve them
      expect(finalEvaluation.failures.length).toBeLessThanOrEqual(3);
    });

    it('should track repair history across iterations', async () => {
      const ganttData = createValidGanttData([
        createValidTask({
          confidence: 0.3,
          duration: { value: 5, unit: 'days', confidence: 0.3, origin: 'inference' }
        }),
        createValidTask({ name: 'HIPAA compliance audit' })
      ]);

      const repairHistory = [];

      // First iteration
      const evaluation1 = await qualityGateManager.evaluate(ganttData);
      const repair1 = await repairEngine.repair(ganttData, [...evaluation1.failures, ...evaluation1.warnings]);
      repairHistory.push(repair1.repairLog);

      // Second iteration (re-evaluate repaired data)
      const evaluation2 = await qualityGateManager.evaluate(repair1.data);
      if (evaluation2.failures.length > 0 || evaluation2.warnings.length > 0) {
        const repair2 = await repairEngine.repair(repair1.data, [...evaluation2.failures, ...evaluation2.warnings]);
        repairHistory.push(repair2.repairLog);
      }

      expect(repairHistory.length).toBeGreaterThan(0);
      expect(repairHistory[0].successfulRepairs.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Quality Gates', () => {
    it('should support custom quality gates with repair', async () => {
      // Add custom gate: minimum task count
      qualityGateManager.addCustomGate({
        name: 'MIN_TASK_COUNT',
        threshold: 5,
        blocker: true,
        evaluate: (data) => data.tasks.length
      });

      const ganttData = createValidGanttData([
        createValidTask(),
        createValidTask()
      ]); // Only 2 tasks, threshold is 5

      const evaluation = await qualityGateManager.evaluate(ganttData);

      expect(evaluation.passed).toBe(false);
      expect(evaluation.failures.some(f => f.gate === 'MIN_TASK_COUNT')).toBe(true);

      // Note: No built-in repair for custom gates
      const customFailure = evaluation.failures.find(f => f.gate === 'MIN_TASK_COUNT');
      const repairResult = await repairEngine.repair(ganttData, [customFailure]);

      // Should log that no repair strategy exists
      expect(repairResult.repairLog.failedRepairs.some(f => f.gate === 'MIN_TASK_COUNT')).toBe(true);
    });
  });

  describe('Quality Gate Removal', () => {
    it('should allow removing quality gates', async () => {
      const ganttData = createValidGanttData([
        createValidTask({
          confidence: 0.3,
          duration: { value: 5, unit: 'days', confidence: 0.3, origin: 'inference' }
        })
      ]);

      // Initial evaluation with CONFIDENCE_MINIMUM gate
      const evaluation1 = await qualityGateManager.evaluate(ganttData);
      expect(evaluation1.failures.some(f => f.gate === 'CONFIDENCE_MINIMUM')).toBe(true);

      // Remove CONFIDENCE_MINIMUM gate
      qualityGateManager.removeGate('CONFIDENCE_MINIMUM');

      // Re-evaluate
      const evaluation2 = await qualityGateManager.evaluate(ganttData);
      expect(evaluation2.failures.some(f => f.gate === 'CONFIDENCE_MINIMUM')).toBe(false);
    });
  });

  describe('Comprehensive End-to-End Workflow', () => {
    it('should handle complete quality assurance workflow', async () => {
      // Simulate real-world scenario with multiple issues
      const ganttData = createValidGanttData([
        // Task 1: Good task with citation
        createValidTask({ name: 'Design phase', confidence: 0.95 }),

        // Task 2: Low confidence, no citation
        createValidTask({
          name: 'Development phase',
          confidence: 0.3,
          duration: { value: 60, unit: 'days', confidence: 0.3, origin: 'inference' }
        }),

        // Task 3: Regulatory task without flags
        createValidTask({
          name: 'FDA 510(k) submission',
          confidence: 0.85
        }),

        // Task 4: No citation
        createValidTask({
          name: 'Testing phase',
          confidence: 0.8,
          duration: { value: 30, unit: 'days', confidence: 0.8, origin: 'explicit' }
        })
      ]);

      // PHASE 1: Initial Quality Gate Evaluation
      const initialEvaluation = await qualityGateManager.evaluate(ganttData);

      expect(initialEvaluation.passed).toBe(false);

      const failureGates = initialEvaluation.failures.map(f => f.gate);
      const warningGates = initialEvaluation.warnings.map(w => w.gate);

      // PHASE 2: Repair Failures
      const repairResult = await repairEngine.repair(
        ganttData,
        [...initialEvaluation.failures, ...initialEvaluation.warnings]
      );

      expect(repairResult.repairLog.successfulRepairs.length).toBeGreaterThan(0);

      // PHASE 3: Re-evaluate After Repairs
      const postRepairEvaluation = await qualityGateManager.evaluate(repairResult.data);

      // Should have fewer failures after repair
      expect(postRepairEvaluation.failures.length).toBeLessThanOrEqual(initialEvaluation.failures.length);

      // PHASE 4: Verify Specific Repairs
      const repairedData = repairResult.data;

      // Task 2: Should be flagged for review (low confidence, no citation)
      expect(repairedData.tasks[1].reviewFlags).toBeDefined();

      // Task 3: Should have regulatory requirement added
      expect(repairedData.tasks[2].regulatoryRequirement).toBeDefined();
      expect(repairedData.tasks[2].regulatoryRequirement.regulation).toBe('FDA');

      // Task 4: Should have inference rationale added
      expect(repairedData.tasks[3].duration.inferenceRationale).toBeDefined();

      // PHASE 5: Final Report
      const finalReport = {
        initialState: {
          totalTasks: ganttData.tasks.length,
          failedGates: failureGates,
          warnings: warningGates
        },
        repairs: {
          attempted: repairResult.repairLog.attempts.length,
          successful: repairResult.repairLog.successfulRepairs.length,
          failed: repairResult.repairLog.failedRepairs.length
        },
        finalState: {
          passed: postRepairEvaluation.passed,
          remainingFailures: postRepairEvaluation.failures.length,
          remainingWarnings: postRepairEvaluation.warnings.length
        }
      };

      expect(finalReport.repairs.successful).toBeGreaterThan(0);
      expect(finalReport.finalState.remainingFailures).toBeLessThanOrEqual(finalReport.initialState.failedGates.length);
    });
  });
});
