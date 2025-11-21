import { describe, it, expect, beforeEach } from '@jest/globals';
import { SemanticRepairEngine } from '../SemanticRepairEngine.js';
import { v4 as uuidv4 } from 'uuid';

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

describe('SemanticRepairEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new SemanticRepairEngine();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(engine.maxRepairAttempts).toBe(3);
      expect(engine.repairStrategies).toBeDefined();
    });

    it('should accept custom max repair attempts', () => {
      const customEngine = new SemanticRepairEngine({ maxRepairAttempts: 5 });
      expect(customEngine.maxRepairAttempts).toBe(5);
    });

    it('should initialize all 5 repair strategies', () => {
      expect(Object.keys(engine.repairStrategies)).toHaveLength(5);
      expect(engine.repairStrategies.CITATION_COVERAGE).toBeDefined();
      expect(engine.repairStrategies.CONTRADICTION_SEVERITY).toBeDefined();
      expect(engine.repairStrategies.CONFIDENCE_MINIMUM).toBeDefined();
      expect(engine.repairStrategies.SCHEMA_COMPLIANCE).toBeDefined();
      expect(engine.repairStrategies.REGULATORY_FLAGS).toBeDefined();
    });
  });

  describe('repair', () => {
    it('should repair citation coverage failure', async () => {
      const ganttData = createValidGanttData([
        createValidTask(),
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.7, origin: 'inference' } })
      ]);

      const failures = [{ gate: 'CITATION_COVERAGE', threshold: 0.75, score: 0.5 }];

      const result = await engine.repair(ganttData, failures);

      expect(result.repairLog.successfulRepairs).toHaveLength(1);
      expect(result.repairLog.failedRepairs).toHaveLength(0);
      expect(result.data.tasks[1].duration.inferenceRationale).toBeDefined();
    });

    it('should repair multiple failures', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ confidence: 0.3, duration: { value: 5, unit: 'days', confidence: 0.3, origin: 'inference' } }),
        createValidTask({ name: 'FDA 510(k) submission' })
      ]);

      const failures = [
        { gate: 'CONFIDENCE_MINIMUM', threshold: 0.5, score: 0.3 },
        { gate: 'REGULATORY_FLAGS', threshold: 1.0, score: 0.0 }
      ];

      const result = await engine.repair(ganttData, failures);

      expect(result.repairLog.attempts).toHaveLength(2);
      expect(result.repairLog.successfulRepairs.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle unknown repair strategy', async () => {
      const ganttData = createValidGanttData([createValidTask()]);
      const failures = [{ gate: 'UNKNOWN_GATE', threshold: 1.0 }];

      const result = await engine.repair(ganttData, failures);

      expect(result.repairLog.failedRepairs).toHaveLength(1);
      expect(result.repairLog.failedRepairs[0].reason).toBe('No repair strategy available');
    });

    it('should handle repair strategy errors gracefully', async () => {
      const ganttData = null; // Will cause error
      const failures = [{ gate: 'CITATION_COVERAGE', threshold: 0.75 }];

      const result = await engine.repair(ganttData, failures);

      expect(result.repairLog.failedRepairs).toHaveLength(1);
      expect(result.repairLog.failedRepairs[0].gate).toBe('CITATION_COVERAGE');
    });

    it('should return fullyRepaired: true when all repairs succeed', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ name: 'FDA 510(k) submission' })
      ]);

      const failures = [{ gate: 'REGULATORY_FLAGS', threshold: 1.0 }];

      const result = await engine.repair(ganttData, failures);

      expect(result.fullyRepaired).toBe(true);
    });

    it('should return fullyRepaired: false when any repair fails', async () => {
      const ganttData = createValidGanttData([createValidTask()]);
      const failures = [{ gate: 'UNKNOWN_GATE', threshold: 1.0 }];

      const result = await engine.repair(ganttData, failures);

      expect(result.fullyRepaired).toBe(false);
    });
  });

  describe('repairCitationCoverage', () => {
    it('should add inference rationale to uncited tasks', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.9, origin: 'explicit' } })
      ]);

      const failure = { gate: 'CITATION_COVERAGE', threshold: 0.75, score: 0.0 };
      const result = await engine.repairCitationCoverage(ganttData, failure);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].action).toBe('added_inference_rationale');
      expect(result.data.tasks[0].duration.inferenceRationale).toBeDefined();
      expect(result.data.tasks[0].duration.inferenceRationale.reasoning).toContain('typical project timelines');
    });

    it('should lower confidence for inferred durations', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.9, origin: 'explicit' } })
      ]);

      const failure = { gate: 'CITATION_COVERAGE', threshold: 0.75 };
      const result = await engine.repairCitationCoverage(ganttData, failure);

      expect(result.data.tasks[0].duration.confidence).toBe(0.7);
      expect(result.data.tasks[0].duration.origin).toBe('inference');
    });

    it('should not modify tasks that already have inference rationale', async () => {
      const ganttData = createValidGanttData([
        createValidTask({
          duration: {
            value: 5,
            unit: 'days',
            confidence: 0.7,
            origin: 'inference',
            inferenceRationale: {
              reasoning: 'Existing rationale',
              supportingFacts: [],
              llmProvider: 'CLAUDE',
              temperature: 0.5
            }
          }
        })
      ]);

      const failure = { gate: 'CITATION_COVERAGE', threshold: 0.75 };
      const result = await engine.repairCitationCoverage(ganttData, failure);

      expect(result.changes).toHaveLength(0);
      expect(result.data.tasks[0].duration.inferenceRationale.reasoning).toBe('Existing rationale');
    });

    it('should calculate new citation coverage score', async () => {
      const ganttData = createValidGanttData([
        createValidTask(), // has citation
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.9, origin: 'explicit' } }), // no citation
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.9, origin: 'explicit' } }) // no citation
      ]);

      const failure = { gate: 'CITATION_COVERAGE', threshold: 0.75 };
      const result = await engine.repairCitationCoverage(ganttData, failure);

      expect(result.newScore).toBe(1 / 3); // Still only 1 task with citations
    });
  });

  describe('repairContradictions', () => {
    it('should resolve contradictions by preferring explicit over inference', async () => {
      const claim1Id = uuidv4();
      const claim2Id = uuidv4();

      const task1 = createValidTask({
        validationMetadata: {
          claims: [{ id: claim1Id, taskId: 'task-1', origin: 'explicit', confidence: 0.8 }]
        }
      });
      const task2 = createValidTask({
        validationMetadata: {
          claims: [{ id: claim2Id, taskId: 'task-2', origin: 'inference', confidence: 0.8 }]
        }
      });

      const ganttData = createValidGanttData(
        [task1, task2],
        {
          validationMetadata: {
            contradictions: [
              { type: 'numerical', severity: 'high', claim1: claim1Id, claim2: claim2Id }
            ]
          }
        }
      );

      const failure = { gate: 'CONTRADICTION_SEVERITY' };
      const result = await engine.repairContradictions(ganttData, failure);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].resolution).toBe('Explicit source takes precedence');
    });

    it('should resolve contradictions by preferring higher confidence', async () => {
      const claim1Id = uuidv4();
      const claim2Id = uuidv4();

      const task1 = createValidTask({
        validationMetadata: {
          claims: [{ id: claim1Id, taskId: 'task-1', origin: 'explicit', confidence: 0.9 }]
        }
      });
      const task2 = createValidTask({
        validationMetadata: {
          claims: [{ id: claim2Id, taskId: 'task-2', origin: 'explicit', confidence: 0.6 }]
        }
      });

      const ganttData = createValidGanttData(
        [task1, task2],
        {
          validationMetadata: {
            contradictions: [
              { type: 'numerical', severity: 'high', claim1: claim1Id, claim2: claim2Id }
            ]
          }
        }
      );

      const failure = { gate: 'CONTRADICTION_SEVERITY' };
      const result = await engine.repairContradictions(ganttData, failure);

      expect(result.success).toBe(true);
      expect(result.changes[0].resolution).toBe('Higher confidence source retained');
    });

    it('should mark contradictions as resolved with timestamp', async () => {
      const claim1Id = uuidv4();
      const claim2Id = uuidv4();

      const ganttData = createValidGanttData(
        [
          createValidTask({
            validationMetadata: {
              claims: [{ id: claim1Id, taskId: 'task-1', origin: 'explicit', confidence: 0.8 }]
            }
          }),
          createValidTask({
            validationMetadata: {
              claims: [{ id: claim2Id, taskId: 'task-2', origin: 'inference', confidence: 0.8 }]
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

      const failure = { gate: 'CONTRADICTION_SEVERITY' };
      const result = await engine.repairContradictions(ganttData, failure);

      expect(result.data.validationMetadata.contradictions[0].resolvedAt).toBeDefined();
      expect(result.data.validationMetadata.contradictions[0].resolutionStrategy).toBe('AUTO_RESOLVED');
    });

    it('should handle contradictions with missing claims gracefully', async () => {
      const ganttData = createValidGanttData(
        [createValidTask()],
        {
          validationMetadata: {
            contradictions: [
              { type: 'numerical', severity: 'high', claim1: 'nonexistent-1', claim2: 'nonexistent-2' }
            ]
          }
        }
      );

      const failure = { gate: 'CONTRADICTION_SEVERITY' };
      const result = await engine.repairContradictions(ganttData, failure);

      expect(result.changes).toHaveLength(0);
    });

    it('should only process high severity contradictions', async () => {
      const ganttData = createValidGanttData(
        [createValidTask()],
        {
          validationMetadata: {
            contradictions: [
              { type: 'numerical', severity: 'medium', claim1: 'id1', claim2: 'id2' },
              { type: 'numerical', severity: 'low', claim1: 'id3', claim2: 'id4' }
            ]
          }
        }
      );

      const failure = { gate: 'CONTRADICTION_SEVERITY' };
      const result = await engine.repairContradictions(ganttData, failure);

      expect(result.changes).toHaveLength(0);
    });
  });

  describe('repairConfidence', () => {
    it('should boost confidence for tasks with citations', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ confidence: 0.3 }) // Has citation from createValidTask
      ]);

      const failure = { gate: 'CONFIDENCE_MINIMUM', threshold: 0.5 };
      const result = await engine.repairConfidence(ganttData, failure);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].action).toBe('confidence_boosted');
      expect(result.data.tasks[0].confidence).toBe(0.5);
    });

    it('should flag low confidence tasks without citations for review', async () => {
      const ganttData = createValidGanttData([
        createValidTask({
          confidence: 0.3,
          duration: { value: 5, unit: 'days', confidence: 0.3, origin: 'inference' }
        })
      ]);

      const failure = { gate: 'CONFIDENCE_MINIMUM', threshold: 0.5 };
      const result = await engine.repairConfidence(ganttData, failure);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].action).toBe('flagged_for_review');
      expect(result.data.tasks[0].reviewFlags).toHaveLength(1);
      expect(result.data.tasks[0].reviewFlags[0].type).toBe('LOW_CONFIDENCE');
    });

    it('should include confidence levels in review flags', async () => {
      const ganttData = createValidGanttData([
        createValidTask({
          confidence: 0.3,
          duration: { value: 5, unit: 'days', confidence: 0.3, origin: 'inference' }
        })
      ]);

      const failure = { gate: 'CONFIDENCE_MINIMUM', threshold: 0.5 };
      const result = await engine.repairConfidence(ganttData, failure);

      expect(result.data.tasks[0].reviewFlags[0].confidence).toBe(0.3);
      expect(result.data.tasks[0].reviewFlags[0].threshold).toBe(0.5);
      expect(result.data.tasks[0].reviewFlags[0].flaggedAt).toBeDefined();
    });

    it('should not modify tasks that meet confidence threshold', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ confidence: 0.9 })
      ]);

      const failure = { gate: 'CONFIDENCE_MINIMUM', threshold: 0.5 };
      const result = await engine.repairConfidence(ganttData, failure);

      expect(result.changes).toHaveLength(0);
    });
  });

  describe('repairSchema', () => {
    it('should return success if schema is already valid', async () => {
      const ganttData = createValidGanttData([createValidTask()]);

      const failure = { gate: 'SCHEMA_COMPLIANCE' };
      const result = await engine.repairSchema(ganttData, failure);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(0);
    });

    it('should generate UUID for tasks with invalid IDs', async () => {
      const ganttData = createValidGanttData([
        { ...createValidTask(), id: 'invalid-id' }
      ]);

      const failure = { gate: 'SCHEMA_COMPLIANCE' };
      const result = await engine.repairSchema(ganttData, failure);

      expect(result.changes.some(c => c.action === 'generated_uuid')).toBe(true);
      expect(engine.isValidUUID(result.data.tasks[0].id)).toBe(true);
    });

    it('should set default origin for tasks missing it', async () => {
      const task = createValidTask();
      delete task.origin;

      const ganttData = createValidGanttData([task]);

      const failure = { gate: 'SCHEMA_COMPLIANCE' };
      const result = await engine.repairSchema(ganttData, failure);

      expect(result.changes.some(c => c.action === 'set_default_origin')).toBe(true);
      expect(result.data.tasks[0].origin).toBe('inference');
    });

    it('should set default confidence for tasks missing it', async () => {
      const task = createValidTask();
      delete task.confidence;

      const ganttData = createValidGanttData([task]);

      const failure = { gate: 'SCHEMA_COMPLIANCE' };
      const result = await engine.repairSchema(ganttData, failure);

      expect(result.changes.some(c => c.action === 'set_default_confidence')).toBe(true);
      expect(result.data.tasks[0].confidence).toBe(0.5);
    });

    it('should clamp confidence values outside [0, 1] range', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ confidence: 1.5 }),
        createValidTask({ confidence: -0.2 })
      ]);

      const failure = { gate: 'SCHEMA_COMPLIANCE' };
      const result = await engine.repairSchema(ganttData, failure);

      expect(result.data.tasks[0].confidence).toBe(1);
      expect(result.data.tasks[1].confidence).toBe(0);
      expect(result.changes.filter(c => c.action === 'clamped_confidence')).toHaveLength(2);
    });

    it('should revalidate after repairs', async () => {
      const task = createValidTask();
      task.confidence = 1.5; // Invalid

      const ganttData = createValidGanttData([task]);

      const failure = { gate: 'SCHEMA_COMPLIANCE' };
      const result = await engine.repairSchema(ganttData, failure);

      expect(result.success).toBe(true);
      expect(result.validationErrors).toBeNull();
    });
  });

  describe('repairRegulatoryFlags', () => {
    it('should add regulatory requirements for FDA tasks', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ name: 'FDA 510(k) submission' })
      ]);

      const failure = { gate: 'REGULATORY_FLAGS' };
      const result = await engine.repairRegulatoryFlags(ganttData, failure);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].action).toBe('added_regulatory_requirement');
      expect(result.changes[0].regulation).toBe('FDA');
      expect(result.data.tasks[0].regulatoryRequirement.isRequired).toBe(true);
    });

    it('should add regulatory requirements for HIPAA tasks', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ name: 'HIPAA compliance review' })
      ]);

      const failure = { gate: 'REGULATORY_FLAGS' };
      const result = await engine.repairRegulatoryFlags(ganttData, failure);

      expect(result.changes[0].regulation).toBe('HIPAA');
    });

    it('should add regulatory requirements for SOX tasks', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ name: 'Sarbanes-Oxley audit' })
      ]);

      const failure = { gate: 'REGULATORY_FLAGS' };
      const result = await engine.repairRegulatoryFlags(ganttData, failure);

      expect(result.changes[0].regulation).toBe('SOX');
    });

    it('should not modify tasks without regulatory keywords', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ name: 'Regular development task' })
      ]);

      const failure = { gate: 'REGULATORY_FLAGS' };
      const result = await engine.repairRegulatoryFlags(ganttData, failure);

      expect(result.changes).toHaveLength(0);
    });

    it('should not modify tasks that already have regulatory requirements', async () => {
      const ganttData = createValidGanttData([
        createValidTask({
          name: 'FDA 510(k) submission',
          regulatoryRequirement: {
            isRequired: true,
            regulation: 'FDA',
            confidence: 0.95,
            origin: 'explicit'
          }
        })
      ]);

      const failure = { gate: 'REGULATORY_FLAGS' };
      const result = await engine.repairRegulatoryFlags(ganttData, failure);

      expect(result.changes).toHaveLength(0);
    });

    it('should set confidence and origin for regulatory requirements', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ name: 'FDA approval process' })
      ]);

      const failure = { gate: 'REGULATORY_FLAGS' };
      const result = await engine.repairRegulatoryFlags(ganttData, failure);

      expect(result.data.tasks[0].regulatoryRequirement.confidence).toBe(0.9);
      expect(result.data.tasks[0].regulatoryRequirement.origin).toBe('explicit');
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      const validUUID = uuidv4();
      expect(engine.isValidUUID(validUUID)).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(engine.isValidUUID('invalid-uuid')).toBe(false);
      expect(engine.isValidUUID('12345678')).toBe(false);
      expect(engine.isValidUUID('')).toBe(false);
    });

    it('should validate UUID format (version 4)', () => {
      expect(engine.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(engine.isValidUUID('550e8400-e29b-31d4-a716-446655440000')).toBe(false); // version 3
    });
  });

  describe('findClaimById', () => {
    it('should find claim by ID across tasks', () => {
      const claimId = uuidv4();
      const tasks = [
        createValidTask({
          validationMetadata: {
            claims: [{ id: claimId, taskId: 'task-1' }]
          }
        })
      ];

      const claim = engine.findClaimById(claimId, tasks);

      expect(claim).toBeDefined();
      expect(claim.id).toBe(claimId);
    });

    it('should return null if claim not found', () => {
      const tasks = [createValidTask()];

      const claim = engine.findClaimById('nonexistent-id', tasks);

      expect(claim).toBeNull();
    });

    it('should search multiple tasks', () => {
      const claimId = uuidv4();
      const tasks = [
        createValidTask(),
        createValidTask({
          validationMetadata: {
            claims: [{ id: claimId, taskId: 'task-2' }]
          }
        })
      ];

      const claim = engine.findClaimById(claimId, tasks);

      expect(claim).toBeDefined();
      expect(claim.taskId).toBe('task-2');
    });
  });
});
