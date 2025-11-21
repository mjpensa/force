import { describe, it, expect, beforeEach } from '@jest/globals';
import { QualityGateManager } from '../QualityGateManager.js';
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

describe('QualityGateManager', () => {
  let manager;

  beforeEach(() => {
    manager = new QualityGateManager({
      citationCoverageThreshold: 0.75,
      minConfidence: 0.5
    });
  });

  describe('evaluate', () => {
    it('should pass all quality gates for valid data', async () => {
      const ganttData = createValidGanttData([createValidTask()]);

      const result = await manager.evaluate(ganttData);

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should fail CITATION_COVERAGE when coverage is low', async () => {
      const ganttData = createValidGanttData([
        createValidTask(),
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.7, origin: 'inference' } }),
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.7, origin: 'inference' } }),
        createValidTask({ duration: { value: 5, unit: 'days', confidence: 0.6, origin: 'inference' } })
      ]);

      const result = await manager.evaluate(ganttData);

      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.gate === 'CITATION_COVERAGE')).toBe(true);
      const citationFailure = result.failures.find(f => f.gate === 'CITATION_COVERAGE');
      expect(citationFailure.score).toBe(0.25); // 1/4 tasks cited
      expect(citationFailure.threshold).toBe(0.75);
      expect(citationFailure.blocker).toBe(true);
    });

    it('should fail CONTRADICTION_SEVERITY when high-severity contradictions exist', async () => {
      const ganttData = createValidGanttData(
        [createValidTask()],
        {
          validationMetadata: {
            contradictions: [
              {
                type: 'numerical',
                severity: 'high',
                claim1: uuidv4(),
                claim2: uuidv4()
              }
            ]
          }
        }
      );

      const result = await manager.evaluate(ganttData);

      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.gate === 'CONTRADICTION_SEVERITY')).toBe(true);
    });

    it('should pass CONTRADICTION_SEVERITY when only low/medium contradictions exist', async () => {
      const ganttData = createValidGanttData(
        [createValidTask()],
        {
          validationMetadata: {
            contradictions: [
              {
                type: 'numerical',
                severity: 'medium',
                claim1: uuidv4(),
                claim2: uuidv4()
              },
              {
                type: 'numerical',
                severity: 'low',
                claim1: uuidv4(),
                claim2: uuidv4()
              }
            ]
          }
        }
      );

      const result = await manager.evaluate(ganttData);

      expect(result.passed).toBe(true);
      expect(result.failures.some(f => f.gate === 'CONTRADICTION_SEVERITY')).toBe(false);
    });

    it('should fail CONFIDENCE_MINIMUM when tasks have low confidence', async () => {
      const ganttData = createValidGanttData([
        createValidTask(),
        createValidTask({ confidence: 0.3, duration: { value: 5, unit: 'days', confidence: 0.3, origin: 'inference' } })
      ]);

      const result = await manager.evaluate(ganttData);

      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.gate === 'CONFIDENCE_MINIMUM')).toBe(true);
    });

    it('should fail SCHEMA_COMPLIANCE when data is invalid', async () => {
      const ganttData = {
        projectName: 'Test Project',
        tasks: [
          {
            // Missing required fields: id, origin, confidence, duration
            name: 'Task 1'
          }
        ]
      };

      const result = await manager.evaluate(ganttData);

      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.gate === 'SCHEMA_COMPLIANCE')).toBe(true);
    });

    it('should warn for REGULATORY_FLAGS when regulatory tasks lack flags', async () => {
      const ganttData = createValidGanttData([
        createValidTask({ name: 'FDA 510(k) submission' })
      ]);

      const result = await manager.evaluate(ganttData);

      // Should warn but not fail (blocker: false)
      expect(result.passed).toBe(true);
      expect(result.warnings.some(w => w.gate === 'REGULATORY_FLAGS')).toBe(true);
    });

    it('should handle evaluation errors gracefully', async () => {
      const ganttData = null; // Will cause error

      const result = await manager.evaluate(ganttData);

      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      // Note: Not all failures will have error field, schema compliance will just return false
    });

    it('should pass REGULATORY_FLAGS when regulatory tasks are properly flagged', async () => {
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

      const result = await manager.evaluate(ganttData);

      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('detectRegulation', () => {
    it('should detect FDA regulation', () => {
      expect(manager.detectRegulation('FDA 510(k) submission')).toBe('FDA');
      expect(manager.detectRegulation('Premarket approval process')).toBe('FDA');
      expect(manager.detectRegulation('Clinical trial initiation')).toBe('FDA');
    });

    it('should detect HIPAA regulation', () => {
      expect(manager.detectRegulation('HIPAA compliance review')).toBe('HIPAA');
      expect(manager.detectRegulation('Protected health information audit')).toBe('HIPAA');
      expect(manager.detectRegulation('PHI security assessment')).toBe('HIPAA');
    });

    it('should detect SOX regulation', () => {
      expect(manager.detectRegulation('Sarbanes-Oxley compliance')).toBe('SOX');
      expect(manager.detectRegulation('SOX financial audit')).toBe('SOX');
    });

    it('should detect GDPR regulation', () => {
      expect(manager.detectRegulation('GDPR data protection review')).toBe('GDPR');
      expect(manager.detectRegulation('Privacy regulation compliance')).toBe('GDPR');
    });

    it('should detect PCI regulation', () => {
      expect(manager.detectRegulation('PCI DSS compliance audit')).toBe('PCI');
      expect(manager.detectRegulation('Payment card security review')).toBe('PCI');
    });

    it('should return General Compliance for non-regulatory tasks', () => {
      expect(manager.detectRegulation('Regular development task')).toBe('General Compliance');
      expect(manager.detectRegulation('Project planning')).toBe('General Compliance');
    });
  });

  describe('addCustomGate', () => {
    it('should add a custom quality gate', () => {
      const customGate = {
        name: 'CUSTOM_GATE',
        threshold: 0.8,
        blocker: true,
        evaluate: (data) => data.tasks.length > 0
      };

      manager.addCustomGate(customGate);

      const gates = manager.getGates();
      expect(gates.some(g => g.name === 'CUSTOM_GATE')).toBe(true);
    });

    it('should evaluate custom gates', async () => {
      const customGate = {
        name: 'MIN_TASKS',
        threshold: 3,
        blocker: true,
        evaluate: (data) => data.tasks.length
      };

      manager.addCustomGate(customGate);

      const ganttData = createValidGanttData([createValidTask()]);

      const result = await manager.evaluate(ganttData);

      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.gate === 'MIN_TASKS')).toBe(true);
    });
  });

  describe('removeGate', () => {
    it('should remove a quality gate by name', () => {
      manager.removeGate('REGULATORY_FLAGS');

      const gates = manager.getGates();
      expect(gates.some(g => g.name === 'REGULATORY_FLAGS')).toBe(false);
    });

    it('should not affect other gates when removing one', () => {
      const initialCount = manager.getGates().length;

      manager.removeGate('REGULATORY_FLAGS');

      expect(manager.getGates().length).toBe(initialCount - 1);
      expect(manager.getGates().some(g => g.name === 'CITATION_COVERAGE')).toBe(true);
    });
  });

  describe('getGates', () => {
    it('should return all configured gates', () => {
      const gates = manager.getGates();

      expect(gates).toHaveLength(5);
      expect(gates.every(g => g.name && g.threshold !== undefined && typeof g.blocker === 'boolean')).toBe(true);
    });

    it('should return gate metadata without evaluate functions', () => {
      const gates = manager.getGates();

      expect(gates.every(g => !g.evaluate)).toBe(true);
    });
  });

  describe('constructor options', () => {
    it('should use custom citation coverage threshold', () => {
      const customManager = new QualityGateManager({
        citationCoverageThreshold: 0.9
      });

      const gates = customManager.getGates();
      const citationGate = gates.find(g => g.name === 'CITATION_COVERAGE');

      expect(citationGate.threshold).toBe(0.9);
    });

    it('should use custom min confidence threshold', () => {
      const customManager = new QualityGateManager({
        minConfidence: 0.7
      });

      const gates = customManager.getGates();
      const confidenceGate = gates.find(g => g.name === 'CONFIDENCE_MINIMUM');

      expect(confidenceGate.threshold).toBe(0.7);
    });
  });
});
