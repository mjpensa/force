import { describe, it, expect, beforeEach } from '@jest/globals';
import { ResearchValidationService } from '../ResearchValidationService.js';
import { v4 as uuidv4 } from 'uuid';

describe('ResearchValidationService', () => {
  let service;

  beforeEach(() => {
    service = new ResearchValidationService({
      minConfidenceThreshold: 0.5,
      citationCoverageThreshold: 0.75
    });
  });

  describe('extractTaskClaims', () => {
    it('should extract duration claim from task', async () => {
      const task = {
        id: uuidv4(),
        name: 'Complete FDA 510(k) submission',
        origin: 'explicit',
        confidence: 0.85,
        duration: {
          value: 90,
          unit: 'days',
          confidence: 0.9,
          origin: 'explicit',
          sourceCitations: [{
            documentName: 'FDA_Guidelines.pdf',
            provider: 'INTERNAL',
            startChar: 1200,
            endChar: 1350,
            exactQuote: 'Standard review time is 90 days',
            retrievedAt: new Date().toISOString()
          }]
        }
      };

      const claims = await service.extractTaskClaims(task);

      expect(claims).toHaveLength(1);
      expect(claims[0].claimType).toBe('duration');
      expect(claims[0].claim).toContain('90 days');
      expect(claims[0].taskId).toBe(task.id);
      expect(claims[0].source.documentName).toBe('FDA_Guidelines.pdf');
    });

    it('should extract start date claim from task', async () => {
      const taskId = uuidv4();
      const startDate = new Date().toISOString();
      const task = {
        id: taskId,
        name: 'Project kickoff',
        origin: 'explicit',
        confidence: 0.95,
        duration: {
          value: 1,
          unit: 'days',
          confidence: 0.9,
          origin: 'explicit'
        },
        startDate: {
          value: startDate,
          confidence: 0.95,
          origin: 'explicit',
          sourceCitations: [{
            documentName: 'Project_Plan.md',
            provider: 'INTERNAL',
            startChar: 500,
            endChar: 650,
            exactQuote: 'Project starts on January 1, 2025',
            retrievedAt: new Date().toISOString()
          }]
        }
      };

      const claims = await service.extractTaskClaims(task);

      expect(claims.length).toBeGreaterThanOrEqual(2); // duration + startDate
      const startDateClaim = claims.find(c => c.claimType === 'deadline');
      expect(startDateClaim).toBeDefined();
      expect(startDateClaim.claim).toContain(startDate);
    });

    it('should extract dependency claims from task', async () => {
      const taskId = uuidv4();
      const dep1 = uuidv4();
      const dep2 = uuidv4();
      const task = {
        id: taskId,
        name: 'Integration testing',
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

      const claims = await service.extractTaskClaims(task);

      const dependencyClaims = claims.filter(c => c.claimType === 'dependency');
      expect(dependencyClaims).toHaveLength(2);
      expect(dependencyClaims[0].claim).toContain(dep1);
      expect(dependencyClaims[1].claim).toContain(dep2);
    });

    it('should extract regulatory requirement claim from task', async () => {
      const task = {
        id: uuidv4(),
        name: 'Compliance review',
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
            documentName: 'Regulatory_Requirements.pdf',
            provider: 'INTERNAL',
            startChar: 100,
            endChar: 200,
            exactQuote: 'FDA 510(k) approval required',
            retrievedAt: new Date().toISOString()
          }]
        }
      };

      const claims = await service.extractTaskClaims(task);

      const regulatoryClaim = claims.find(c => c.claimType === 'requirement');
      expect(regulatoryClaim).toBeDefined();
      expect(regulatoryClaim.claim).toContain('FDA 510(k)');
      expect(regulatoryClaim.source.documentName).toBe('Regulatory_Requirements.pdf');
    });

    it('should handle task with inference-based duration', async () => {
      const task = {
        id: uuidv4(),
        name: 'Internal review',
        origin: 'inference',
        confidence: 0.65,
        duration: {
          value: 5,
          unit: 'days',
          confidence: 0.65,
          origin: 'inference',
          inferenceRationale: {
            reasoning: 'Based on typical team review cycles',
            supportingFacts: ['fact-1', 'fact-2'],
            llmProvider: 'GEMINI',
            temperature: 0.7
          }
        },
        inferenceRationale: {
          reasoning: 'Estimated based on similar tasks',
          supportingFacts: ['fact-1'],
          llmProvider: 'GEMINI'
        }
      };

      const claims = await service.extractTaskClaims(task);

      expect(claims).toHaveLength(1);
      expect(claims[0].source.documentName).toBe('inferred');
      expect(claims[0].source.provider).toBe('GEMINI');
      expect(claims[0].source.citation).toBeNull();
    });

    it('should extract multiple claims from complex task', async () => {
      const task = {
        id: uuidv4(),
        name: 'FDA submission and approval',
        origin: 'explicit',
        confidence: 0.85,
        duration: {
          value: 90,
          unit: 'days',
          confidence: 0.9,
          origin: 'explicit',
          sourceCitations: [{
            documentName: 'FDA_Guidelines.pdf',
            provider: 'INTERNAL',
            startChar: 1200,
            endChar: 1350,
            exactQuote: 'Standard review time is 90 days',
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
          regulation: 'FDA 510(k)',
          confidence: 1.0,
          origin: 'explicit'
        }
      };

      const claims = await service.extractTaskClaims(task);

      expect(claims.length).toBeGreaterThanOrEqual(4); // duration + startDate + dependency + regulatory
      expect(claims.some(c => c.claimType === 'duration')).toBe(true);
      expect(claims.some(c => c.claimType === 'deadline')).toBe(true);
      expect(claims.some(c => c.claimType === 'dependency')).toBe(true);
      expect(claims.some(c => c.claimType === 'requirement')).toBe(true);
    });
  });

  // extractSource is now internal to TaskClaimExtractor - tested in TaskClaimExtractor.test.js

  describe('aggregateValidationResults', () => {
    it('should calculate citation coverage correctly', () => {
      const claims = [
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 1',
          claimType: 'duration',
          source: { documentName: 'test.pdf', provider: 'INTERNAL', citation: { exactQuote: 'test' } },
          confidence: 0.9,
          contradictions: [],
          validatedAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 2',
          claimType: 'duration',
          source: { documentName: 'test.pdf', provider: 'INTERNAL', citation: { exactQuote: 'test' } },
          confidence: 0.8,
          contradictions: [],
          validatedAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 3',
          claimType: 'duration',
          source: { documentName: 'inferred', provider: 'GEMINI', citation: null },
          confidence: 0.7,
          contradictions: [],
          validatedAt: new Date().toISOString()
        }
      ];

      const result = service.aggregateValidationResults(claims, []);

      expect(result.citationCoverage).toBeCloseTo(2 / 3, 2);
      expect(result.qualityGates.citationCoverage).toBe(false); // 0.67 < 0.75
    });

    it('should detect high severity contradictions', () => {
      const contradictions = [
        {
          id: uuidv4(),
          claim1: uuidv4(),
          claim2: uuidv4(),
          severity: 'high',
          type: 'numerical',
          description: 'Test contradiction'
        },
        {
          id: uuidv4(),
          claim1: uuidv4(),
          claim2: uuidv4(),
          severity: 'low',
          type: 'temporal',
          description: 'Minor issue'
        }
      ];

      const result = service.aggregateValidationResults([], contradictions);

      expect(result.qualityGates.noHighContradictions).toBe(false);
    });

    it('should pass quality gates when thresholds met', () => {
      const claims = [
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 1',
          claimType: 'duration',
          source: { documentName: 'test.pdf', provider: 'INTERNAL', citation: { exactQuote: 'test' } },
          confidence: 0.9,
          contradictions: [],
          validatedAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 2',
          claimType: 'duration',
          source: { documentName: 'test.pdf', provider: 'INTERNAL', citation: { exactQuote: 'test' } },
          confidence: 0.8,
          contradictions: [],
          validatedAt: new Date().toISOString()
        }
      ];

      const result = service.aggregateValidationResults(claims, []);

      expect(result.citationCoverage).toBe(1.0);
      expect(result.qualityGates.citationCoverage).toBe(true);
      expect(result.qualityGates.noHighContradictions).toBe(true);
      expect(result.qualityGates.confidenceThreshold).toBe(true);
    });

    it('should handle empty claims array', () => {
      const result = service.aggregateValidationResults([], []);

      expect(result.citationCoverage).toBe(0);
      expect(result.provenanceScore).toBeCloseTo(1.0, 2);
    });
  });

  describe('validateTaskClaims', () => {
    it('should validate task and return aggregated results', async () => {
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

      const sourceDocuments = [
        {
          name: 'test.pdf',
          content: 'Some content here'
        }
      ];

      const result = await service.validateTaskClaims(task, sourceDocuments);

      expect(result.claims).toBeDefined();
      expect(result.contradictions).toBeDefined();
      expect(result.citationCoverage).toBeDefined();
      expect(result.provenanceScore).toBeDefined();
      expect(result.qualityGates).toBeDefined();
    });

    it('should throw error when validation fails', async () => {
      // Mock extractTaskClaims to throw error
      service.extractTaskClaims = async () => {
        throw new Error('Extraction failed');
      };

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
        }
      };

      await expect(service.validateTaskClaims(task, [])).rejects.toThrow('Extraction failed');
    });
  });
});
