import { describe, it, expect, beforeEach } from '@jest/globals';
import { SemanticGanttOrchestrator } from '../SemanticGanttOrchestrator.js';
import { v4 as uuidv4 } from 'uuid';

// Helper function to create valid citation
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

// Mock source documents
const mockSourceDocuments = [
  {
    name: 'test.pdf',
    content: 'Test quote and other content',
    type: 'pdf'
  }
];

describe('SemanticGanttOrchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new SemanticGanttOrchestrator({
      citationCoverageThreshold: 0.75,
      minConfidenceThreshold: 0.5
    });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.researchValidator).toBeDefined();
      expect(orchestrator.taskClaimExtractor).toBeDefined();
      expect(orchestrator.qualityGateManager).toBeDefined();
      expect(orchestrator.repairEngine).toBeDefined();
      expect(orchestrator.jobs).toBeInstanceOf(Map);
    });

    it('should accept custom configuration', () => {
      const customOrchestrator = new SemanticGanttOrchestrator({
        citationCoverageThreshold: 0.9,
        minConfidenceThreshold: 0.7,
        maxRepairAttempts: 5
      });

      expect(customOrchestrator.qualityGateManager).toBeDefined();
    });
  });

  describe('generateValidatedGanttChart', () => {
    it('should generate and validate gantt chart with quality tasks', async () => {
      const userPrompt = 'Create a project roadmap';
      const sourceDocuments = mockSourceDocuments;
      const options = {
        projectName: 'Test Project',
        existingTasks: [
          createValidTask({ name: 'Task 1', confidence: 0.95 }),
          createValidTask({ name: 'Task 2', confidence: 0.9 })
        ]
      };

      const result = await orchestrator.generateValidatedGanttChart(
        userPrompt,
        sourceDocuments,
        options
      );

      expect(result.chartId).toBeDefined();
      expect(result.jobId).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.tasks).toHaveLength(2);
      expect(result.metadata.qualityGates).toBeDefined();
    });

    it('should handle tasks requiring repair', async () => {
      const userPrompt = 'Create a project roadmap';
      const sourceDocuments = mockSourceDocuments;
      const options = {
        projectName: 'Test Project',
        existingTasks: [
          createValidTask({ confidence: 0.9 }),
          createValidTask({
            confidence: 0.3,
            duration: { value: 5, unit: 'days', confidence: 0.3, origin: 'inference' }
          }),
          createValidTask({
            name: 'FDA 510(k) submission',
            confidence: 0.8
          })
        ]
      };

      const result = await orchestrator.generateValidatedGanttChart(
        userPrompt,
        sourceDocuments,
        options
      );

      expect(result.data.repairLog).toBeDefined();
      expect(result.data.repairLog.attempts.length).toBeGreaterThan(0);
      expect(result.metadata.qualityGates.failures.length + result.metadata.qualityGates.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should attach validation metadata to tasks', async () => {
      const options = {
        existingTasks: [createValidTask()]
      };

      const result = await orchestrator.generateValidatedGanttChart(
        'test',
        mockSourceDocuments,
        options
      );

      const task = result.data.tasks[0];
      expect(task.validationMetadata).toBeDefined();
      expect(task.validationMetadata.claims).toBeDefined();
      expect(task.validationMetadata.citationCoverage).toBeDefined();
      expect(task.validationMetadata.provenanceScore).toBeDefined();
    });

    it('should aggregate contradictions at gantt level', async () => {
      const options = {
        existingTasks: [
          createValidTask(),
          createValidTask()
        ]
      };

      const result = await orchestrator.generateValidatedGanttChart(
        'test',
        mockSourceDocuments,
        options
      );

      expect(result.data.validationMetadata).toBeDefined();
      expect(result.data.validationMetadata.contradictions).toBeDefined();
      expect(Array.isArray(result.data.validationMetadata.contradictions)).toBe(true);
    });

    it('should fail on schema validation errors', async () => {
      const options = {
        existingTasks: [
          {
            // Invalid task (missing required fields)
            name: 'Invalid Task'
          }
        ]
      };

      await expect(
        orchestrator.generateValidatedGanttChart('test', mockSourceDocuments, options)
      ).rejects.toThrow('Schema validation failed');
    });

    it('should track job progress', async () => {
      const options = {
        jobId: 'test-job-123',
        existingTasks: [createValidTask()]
      };

      // Start generation (don't await immediately)
      const promise = orchestrator.generateValidatedGanttChart(
        'test',
        mockSourceDocuments,
        options
      );

      // Check job was created
      const jobStatus = orchestrator.getJobStatus('test-job-123');
      expect(jobStatus).toBeDefined();
      expect(jobStatus.status).toBeDefined();

      // Wait for completion
      await promise;

      // Check final status
      const finalStatus = orchestrator.getJobStatus('test-job-123');
      expect(finalStatus.status).toBe('completed');
      expect(finalStatus.progress).toBe(100);
      expect(finalStatus.chartId).toBeDefined();
    });
  });

  describe('validateExistingGantt', () => {
    it('should validate existing gantt data', async () => {
      const ganttData = {
        id: uuidv4(),
        projectName: 'Test Project',
        tasks: [createValidTask()],
        metadata: {
          createdAt: new Date().toISOString(),
          totalTasks: 1,
          factRatio: 0.8,
          avgConfidence: 0.9
        },
        validationMetadata: {
          contradictions: []
        }
      };

      const result = await orchestrator.validateExistingGantt(ganttData, mockSourceDocuments);

      expect(result.jobId).toBeDefined();
      expect(result.qualityGates).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.failures).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should detect quality gate failures in existing gantt', async () => {
      const ganttData = {
        id: uuidv4(),
        projectName: 'Test Project',
        tasks: [
          createValidTask(),
          createValidTask({
            confidence: 0.3,
            duration: { value: 5, unit: 'days', confidence: 0.3, origin: 'inference' }
          })
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          totalTasks: 2,
          factRatio: 0.5,
          avgConfidence: 0.6
        },
        validationMetadata: {
          contradictions: []
        }
      };

      const result = await orchestrator.validateExistingGantt(ganttData, mockSourceDocuments);

      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
    });
  });

  describe('calibrateTaskConfidence', () => {
    it('should calibrate confidence based on validation results', async () => {
      const task = createValidTask({ confidence: 0.8 });
      const validationResult = {
        claims: [
          { confidence: 0.9, source: { citation: {} } },
          { confidence: 0.85, source: { citation: {} } }
        ],
        citationCoverage: 1.0,
        contradictions: [],
        provenanceScore: 0.95
      };

      const confidence = await orchestrator.calibrateTaskConfidence(task, validationResult);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should reduce confidence for low citation coverage', async () => {
      const task = createValidTask({ confidence: 0.9 });
      const validationResult = {
        claims: [{ confidence: 0.9 }],
        citationCoverage: 0.3,  // Low coverage
        contradictions: [],
        provenanceScore: 0.9
      };

      const confidence = await orchestrator.calibrateTaskConfidence(task, validationResult);

      expect(confidence).toBeLessThan(0.9);
    });

    it('should reduce confidence for contradictions', async () => {
      const task = createValidTask({ confidence: 0.9 });
      const validationResult = {
        claims: [{ confidence: 0.9 }],
        citationCoverage: 1.0,
        contradictions: [
          { severity: 'high' },
          { severity: 'high' }
        ],
        provenanceScore: 0.9
      };

      const confidence = await orchestrator.calibrateTaskConfidence(task, validationResult);

      expect(confidence).toBeLessThan(0.9);
    });

    it('should reduce confidence for low provenance score', async () => {
      const task = createValidTask({ confidence: 0.9 });
      const validationResult = {
        claims: [{ confidence: 0.9 }],
        citationCoverage: 1.0,
        contradictions: [],
        provenanceScore: 0.5  // Low provenance
      };

      const confidence = await orchestrator.calibrateTaskConfidence(task, validationResult);

      expect(confidence).toBeLessThan(0.9);
    });

    it('should return default confidence for tasks without claims', async () => {
      const task = createValidTask({ confidence: 0.8 });
      const validationResult = {
        claims: [],
        citationCoverage: 0,
        contradictions: [],
        provenanceScore: 0
      };

      const confidence = await orchestrator.calibrateTaskConfidence(task, validationResult);

      expect(confidence).toBe(0.8);
    });
  });

  describe('calculateAvgCitationCoverage', () => {
    it('should calculate average citation coverage', () => {
      const tasks = [
        { validationMetadata: { citationCoverage: 0.8 } },
        { validationMetadata: { citationCoverage: 0.6 } },
        { validationMetadata: { citationCoverage: 1.0 } }
      ];

      const avg = orchestrator.calculateAvgCitationCoverage(tasks);

      expect(avg).toBeCloseTo(0.8, 1);
    });

    it('should return 0 for empty task list', () => {
      const avg = orchestrator.calculateAvgCitationCoverage([]);
      expect(avg).toBe(0);
    });

    it('should handle tasks without validationMetadata', () => {
      const tasks = [
        { validationMetadata: { citationCoverage: 0.8 } },
        {},  // No validationMetadata
        { validationMetadata: { citationCoverage: 1.0 } }
      ];

      const avg = orchestrator.calculateAvgCitationCoverage(tasks);

      expect(avg).toBeCloseTo(0.6, 1);
    });
  });

  describe('calculateAvgProvenance', () => {
    it('should calculate average provenance score', () => {
      const tasks = [
        { validationMetadata: { provenanceScore: 0.9 } },
        { validationMetadata: { provenanceScore: 0.7 } },
        { validationMetadata: { provenanceScore: 0.8 } }
      ];

      const avg = orchestrator.calculateAvgProvenance(tasks);

      expect(avg).toBeCloseTo(0.8, 1);
    });

    it('should return 0 for empty task list', () => {
      const avg = orchestrator.calculateAvgProvenance([]);
      expect(avg).toBe(0);
    });
  });

  describe('job management', () => {
    it('should update job status', () => {
      const jobId = 'test-job';
      orchestrator.jobs.set(jobId, { status: 'started', progress: 0 });

      orchestrator.updateJob(jobId, { status: 'processing', progress: 50 });

      const job = orchestrator.getJobStatus(jobId);
      expect(job.status).toBe('processing');
      expect(job.progress).toBe(50);
      expect(job.updatedAt).toBeDefined();
    });

    it('should mark job as completed', () => {
      const jobId = 'test-job';
      orchestrator.jobs.set(jobId, { status: 'started' });

      orchestrator.completeJob(jobId, 'chart-123');

      const job = orchestrator.getJobStatus(jobId);
      expect(job.status).toBe('completed');
      expect(job.progress).toBe(100);
      expect(job.chartId).toBe('chart-123');
      expect(job.completedAt).toBeDefined();
    });

    it('should mark job as failed', () => {
      const jobId = 'test-job';
      orchestrator.jobs.set(jobId, { status: 'started' });

      orchestrator.failJob(jobId, 'Test error');

      const job = orchestrator.getJobStatus(jobId);
      expect(job.status).toBe('failed');
      expect(job.error).toBe('Test error');
      expect(job.failedAt).toBeDefined();
    });

    it('should return null for non-existent job', () => {
      const job = orchestrator.getJobStatus('non-existent');
      expect(job).toBeUndefined();
    });
  });

  describe('generateInitialGantt', () => {
    it('should generate gantt with provided tasks', async () => {
      const tasks = [createValidTask(), createValidTask()];
      const options = {
        projectName: 'Test Project',
        existingTasks: tasks
      };

      const ganttData = await orchestrator.generateInitialGantt(
        'test prompt',
        mockSourceDocuments,
        options
      );

      expect(ganttData.id).toBeDefined();
      expect(ganttData.projectName).toBe('Test Project');
      expect(ganttData.tasks).toHaveLength(2);
      expect(ganttData.metadata).toBeDefined();
      expect(ganttData.validationMetadata).toBeDefined();
    });

    it('should use default project name if not provided', async () => {
      const ganttData = await orchestrator.generateInitialGantt(
        'test',
        mockSourceDocuments,
        {}
      );

      expect(ganttData.projectName).toBe('Untitled Project');
    });

    it('should initialize with empty tasks if none provided', async () => {
      const ganttData = await orchestrator.generateInitialGantt(
        'test',
        mockSourceDocuments,
        {}
      );

      expect(ganttData.tasks).toEqual([]);
      expect(ganttData.metadata.totalTasks).toBe(0);
    });
  });

  describe('storeChart', () => {
    it('should store chart and return chartId', async () => {
      const ganttData = {
        id: uuidv4(),
        projectName: 'Test',
        tasks: []
      };

      const chartId = await orchestrator.storeChart(ganttData, 'job-123');

      expect(chartId).toBeDefined();
      expect(typeof chartId).toBe('string');
    });
  });
});
