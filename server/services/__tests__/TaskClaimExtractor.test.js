import { describe, it, expect, beforeEach } from '@jest/globals';
import { TaskClaimExtractor } from '../TaskClaimExtractor.js';
import { v4 as uuidv4 } from 'uuid';

describe('TaskClaimExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new TaskClaimExtractor();
  });

  describe('extractClaims', () => {
    it('should extract duration claim from task', async () => {
      const task = {
        id: uuidv4(),
        name: 'Test task',
        origin: 'explicit',
        confidence: 0.8,
        duration: {
          value: 10,
          unit: 'days',
          confidence: 0.8,
          origin: 'explicit',
          sourceCitations: [{
            documentName: 'test.pdf',
            provider: 'INTERNAL',
            startChar: 100,
            endChar: 200,
            exactQuote: 'Duration is 10 days',
            retrievedAt: new Date().toISOString()
          }]
        }
      };

      const claims = await extractor.extractClaims(task);

      expect(claims).toHaveLength(1);
      expect(claims[0].claimType).toBe('duration');
      expect(claims[0].claim).toContain('10 days');
      expect(claims[0].taskId).toBe(task.id);
      expect(claims[0].confidence).toBe(0.8);
      expect(claims[0].source.documentName).toBe('test.pdf');
    });

    it('should extract start date claim from task', async () => {
      const startDate = new Date().toISOString();
      const task = {
        id: uuidv4(),
        name: 'Test task',
        origin: 'explicit',
        confidence: 0.9,
        duration: {
          value: 5,
          unit: 'days',
          confidence: 0.9,
          origin: 'explicit'
        },
        startDate: {
          value: startDate,
          confidence: 0.95,
          origin: 'explicit',
          sourceCitations: [{
            documentName: 'schedule.md',
            provider: 'INTERNAL',
            startChar: 50,
            endChar: 150,
            exactQuote: 'Starts on...',
            retrievedAt: new Date().toISOString()
          }]
        }
      };

      const claims = await extractor.extractClaims(task);

      expect(claims.length).toBeGreaterThanOrEqual(2);
      const startDateClaim = claims.find(c => c.claimType === 'deadline');
      expect(startDateClaim).toBeDefined();
      expect(startDateClaim.claim).toContain(startDate);
      expect(startDateClaim.source.documentName).toBe('schedule.md');
    });

    it('should extract dependency claims from task', async () => {
      const dep1 = uuidv4();
      const dep2 = uuidv4();
      const task = {
        id: uuidv4(),
        name: 'Test task',
        origin: 'explicit',
        confidence: 0.8,
        duration: {
          value: 10,
          unit: 'days',
          confidence: 0.8,
          origin: 'explicit'
        },
        dependencies: [dep1, dep2]
      };

      const claims = await extractor.extractClaims(task);

      const dependencyClaims = claims.filter(c => c.claimType === 'dependency');
      expect(dependencyClaims).toHaveLength(2);
      expect(dependencyClaims[0].claim).toContain(dep1);
      expect(dependencyClaims[1].claim).toContain(dep2);
    });

    it('should extract regulatory requirement claim', async () => {
      const task = {
        id: uuidv4(),
        name: 'Compliance task',
        origin: 'explicit',
        confidence: 0.9,
        duration: {
          value: 30,
          unit: 'days',
          confidence: 0.9,
          origin: 'explicit'
        },
        regulatoryRequirement: {
          isRequired: true,
          regulation: 'FDA 510(k)',
          confidence: 1.0,
          origin: 'explicit',
          sourceCitations: [{
            documentName: 'regulations.pdf',
            provider: 'INTERNAL',
            startChar: 100,
            endChar: 200,
            exactQuote: 'FDA 510(k) required',
            retrievedAt: new Date().toISOString()
          }]
        }
      };

      const claims = await extractor.extractClaims(task);

      const regulatoryClaim = claims.find(c => c.claimType === 'requirement');
      expect(regulatoryClaim).toBeDefined();
      expect(regulatoryClaim.claim).toContain('FDA 510(k)');
      expect(regulatoryClaim.confidence).toBe(1.0);
    });

    it('should extract all claim types from complex task', async () => {
      const task = {
        id: uuidv4(),
        name: 'Complex task',
        origin: 'explicit',
        confidence: 0.85,
        duration: {
          value: 90,
          unit: 'days',
          confidence: 0.9,
          origin: 'explicit',
          sourceCitations: [{
            documentName: 'plan.pdf',
            provider: 'INTERNAL',
            startChar: 100,
            endChar: 200,
            exactQuote: '90 days',
            retrievedAt: new Date().toISOString()
          }]
        },
        startDate: {
          value: new Date().toISOString(),
          confidence: 0.95,
          origin: 'explicit'
        },
        dependencies: [uuidv4()],
        regulatoryRequirement: {
          isRequired: true,
          regulation: 'HIPAA',
          confidence: 1.0,
          origin: 'explicit'
        }
      };

      const claims = await extractor.extractClaims(task);

      expect(claims.length).toBeGreaterThanOrEqual(4);
      expect(claims.some(c => c.claimType === 'duration')).toBe(true);
      expect(claims.some(c => c.claimType === 'deadline')).toBe(true);
      expect(claims.some(c => c.claimType === 'dependency')).toBe(true);
      expect(claims.some(c => c.claimType === 'requirement')).toBe(true);
    });

    it('should handle task with inference-based claims', async () => {
      const task = {
        id: uuidv4(),
        name: 'Inferred task',
        origin: 'inference',
        confidence: 0.65,
        duration: {
          value: 5,
          unit: 'days',
          confidence: 0.65,
          origin: 'inference',
          inferenceRationale: {
            reasoning: 'Based on similar tasks',
            supportingFacts: ['fact1', 'fact2'],
            llmProvider: 'GEMINI',
            temperature: 0.7
          }
        }
      };

      const claims = await extractor.extractClaims(task);

      expect(claims).toHaveLength(1);
      expect(claims[0].source.documentName).toBe('inferred');
      expect(claims[0].source.provider).toBe('GEMINI');
      expect(claims[0].source.citation).toBeNull();
    });

    it('should skip regulatory claim if not required', async () => {
      const task = {
        id: uuidv4(),
        name: 'Non-regulatory task',
        origin: 'explicit',
        confidence: 0.8,
        duration: {
          value: 10,
          unit: 'days',
          confidence: 0.8,
          origin: 'explicit'
        },
        regulatoryRequirement: {
          isRequired: false,
          confidence: 1.0,
          origin: 'explicit'
        }
      };

      const claims = await extractor.extractClaims(task);

      const regulatoryClaim = claims.find(c => c.claimType === 'requirement');
      expect(regulatoryClaim).toBeUndefined();
    });

    it('should throw error for invalid task data', async () => {
      const invalidTask = {
        id: 'invalid-uuid', // Invalid UUID
        name: 'Test task',
        origin: 'explicit',
        confidence: 0.8,
        duration: {
          value: 10,
          unit: 'days',
          confidence: 0.8,
          origin: 'explicit'
        }
      };

      await expect(extractor.extractClaims(invalidTask)).rejects.toThrow();
    });
  });

  describe('createDurationClaim', () => {
    it('should create valid duration claim', () => {
      const task = {
        id: uuidv4(),
        name: 'Test',
        duration: {
          value: 15,
          unit: 'weeks',
          confidence: 0.75,
          origin: 'explicit'
        }
      };

      const claim = extractor.createDurationClaim(task);

      expect(claim.taskId).toBe(task.id);
      expect(claim.claim).toContain('15 weeks');
      expect(claim.claimType).toBe('duration');
      expect(claim.confidence).toBe(0.75);
      expect(claim.contradictions).toEqual([]);
    });
  });

  describe('createStartDateClaim', () => {
    it('should create valid start date claim', () => {
      const startDate = new Date().toISOString();
      const task = {
        id: uuidv4(),
        name: 'Test',
        startDate: {
          value: startDate,
          confidence: 0.95,
          origin: 'explicit'
        }
      };

      const claim = extractor.createStartDateClaim(task);

      expect(claim.taskId).toBe(task.id);
      expect(claim.claim).toContain(startDate);
      expect(claim.claimType).toBe('deadline');
      expect(claim.confidence).toBe(0.95);
    });
  });

  describe('createDependencyClaims', () => {
    it('should create dependency claims for all dependencies', () => {
      const deps = [uuidv4(), uuidv4(), uuidv4()];
      const task = {
        id: uuidv4(),
        name: 'Test',
        confidence: 0.8,
        dependencies: deps
      };

      const claims = extractor.createDependencyClaims(task);

      expect(claims).toHaveLength(3);
      claims.forEach((claim, index) => {
        expect(claim.claim).toContain(deps[index]);
        expect(claim.claimType).toBe('dependency');
        expect(claim.confidence).toBe(0.8);
      });
    });
  });

  describe('createRegulatoryClaim', () => {
    it('should create valid regulatory claim', () => {
      const task = {
        id: uuidv4(),
        name: 'Test',
        regulatoryRequirement: {
          isRequired: true,
          regulation: 'GDPR',
          confidence: 0.98,
          origin: 'explicit'
        }
      };

      const claim = extractor.createRegulatoryClaim(task);

      expect(claim.taskId).toBe(task.id);
      expect(claim.claim).toContain('GDPR');
      expect(claim.claimType).toBe('requirement');
      expect(claim.confidence).toBe(0.98);
    });
  });

  describe('extractSource', () => {
    it('should extract source from field with citations', () => {
      const task = {
        id: uuidv4()
      };
      const fieldData = {
        sourceCitations: [{
          documentName: 'doc.pdf',
          provider: 'CLAUDE',
          exactQuote: 'test'
        }]
      };

      const source = extractor.extractSource(task, fieldData);

      expect(source.documentName).toBe('doc.pdf');
      expect(source.provider).toBe('CLAUDE');
      expect(source.citation).toBeDefined();
    });

    it('should extract source from inference rationale', () => {
      const task = {
        id: uuidv4()
      };
      const fieldData = {
        inferenceRationale: {
          llmProvider: 'OPENAI',
          reasoning: 'Estimated'
        }
      };

      const source = extractor.extractSource(task, fieldData);

      expect(source.documentName).toBe('inferred');
      expect(source.provider).toBe('OPENAI');
      expect(source.citation).toBeNull();
    });

    it('should default to GEMINI when no provider info', () => {
      const task = {
        id: uuidv4()
      };
      const fieldData = {
        value: 10
      };

      const source = extractor.extractSource(task, fieldData);

      expect(source.documentName).toBe('inferred');
      expect(source.provider).toBe('GEMINI');
      expect(source.citation).toBeNull();
    });
  });

  describe('generateClaimId', () => {
    it('should generate valid UUID', () => {
      const taskId = uuidv4();
      const claimType = 'duration';

      const claimId = extractor.generateClaimId(taskId, claimType);

      // Verify it's a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(claimId)).toBe(true);
    });

    it('should generate unique IDs for different calls', () => {
      const taskId = uuidv4();
      const id1 = extractor.generateClaimId(taskId, 'duration');
      const id2 = extractor.generateClaimId(taskId, 'duration');

      expect(id1).not.toBe(id2);
    });
  });

  describe('extractBatchClaims', () => {
    it('should extract claims from multiple tasks', async () => {
      const tasks = [
        {
          id: uuidv4(),
          name: 'Task 1',
          origin: 'explicit',
          confidence: 0.8,
          duration: {
            value: 10,
            unit: 'days',
            confidence: 0.8,
            origin: 'explicit'
          }
        },
        {
          id: uuidv4(),
          name: 'Task 2',
          origin: 'explicit',
          confidence: 0.9,
          duration: {
            value: 5,
            unit: 'days',
            confidence: 0.9,
            origin: 'explicit'
          }
        }
      ];

      const results = await extractor.extractBatchClaims(tasks);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].claims).toBeDefined();
      expect(results[1].success).toBe(true);
      expect(results[1].claims).toBeDefined();
    });

    it('should handle errors gracefully in batch processing', async () => {
      const tasks = [
        {
          id: uuidv4(),
          name: 'Valid task',
          origin: 'explicit',
          confidence: 0.8,
          duration: {
            value: 10,
            unit: 'days',
            confidence: 0.8,
            origin: 'explicit'
          }
        },
        {
          id: 'invalid-uuid', // Invalid
          name: 'Invalid task',
          origin: 'explicit',
          confidence: 0.8,
          duration: {
            value: 5,
            unit: 'days',
            confidence: 0.8,
            origin: 'explicit'
          }
        }
      ];

      const results = await extractor.extractBatchClaims(tasks);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });
});
