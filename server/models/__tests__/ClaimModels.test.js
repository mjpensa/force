import { describe, it, expect, beforeEach } from '@jest/globals';
import { ClaimSchema, ContradictionSchema, ClaimLedger } from '../ClaimModels.js';
import { v4 as uuidv4 } from 'uuid';

describe('ClaimModels', () => {
  describe('ClaimSchema', () => {
    it('should validate a complete valid claim', () => {
      const validClaim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Task takes 90 days to complete',
        claimType: 'duration',
        source: {
          documentName: 'FDA_Guidelines.pdf',
          provider: 'INTERNAL',
          citation: {
            startChar: 100,
            endChar: 200,
            exactQuote: 'Standard review time is 90 days'
          }
        },
        confidence: 0.9,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      const result = ClaimSchema.safeParse(validClaim);
      expect(result.success).toBe(true);
    });

    it('should validate claim with contradictions', () => {
      const claimWithContradictions = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Task takes 60 days to complete',
        claimType: 'duration',
        source: {
          documentName: 'estimate.md',
          provider: 'GEMINI'
        },
        confidence: 0.7,
        contradictions: [
          {
            contradictingClaimId: uuidv4(),
            severity: 'medium',
            resolution: 'Use higher confidence source'
          }
        ],
        validatedAt: new Date().toISOString()
      };

      const result = ClaimSchema.safeParse(claimWithContradictions);
      expect(result.success).toBe(true);
    });

    it('should reject claim with invalid claim type', () => {
      const invalidClaim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        claimType: 'invalid-type',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.5,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      const result = ClaimSchema.safeParse(invalidClaim);
      expect(result.success).toBe(false);
    });

    it('should reject claim with confidence out of bounds', () => {
      const invalidClaim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        claimType: 'duration',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 1.5, // Invalid
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      const result = ClaimSchema.safeParse(invalidClaim);
      expect(result.success).toBe(false);
    });

    it('should reject claim with invalid UUID', () => {
      const invalidClaim = {
        id: 'not-a-uuid',
        taskId: uuidv4(),
        claim: 'Test claim',
        claimType: 'duration',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.5,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      const result = ClaimSchema.safeParse(invalidClaim);
      expect(result.success).toBe(false);
    });
  });

  describe('ContradictionSchema', () => {
    it('should validate a complete valid contradiction', () => {
      const validContradiction = {
        id: uuidv4(),
        claim1: uuidv4(),
        claim2: uuidv4(),
        severity: 'high',
        type: 'numerical',
        description: 'Duration estimates differ by 30 days',
        resolutionStrategy: 'Use explicit source over inference',
        resolvedAt: new Date().toISOString()
      };

      const result = ContradictionSchema.safeParse(validContradiction);
      expect(result.success).toBe(true);
    });

    it('should validate contradiction without optional fields', () => {
      const minimalContradiction = {
        id: uuidv4(),
        claim1: uuidv4(),
        claim2: uuidv4(),
        severity: 'low',
        type: 'temporal',
        description: 'Minor timeline conflict'
      };

      const result = ContradictionSchema.safeParse(minimalContradiction);
      expect(result.success).toBe(true);
    });

    it('should reject contradiction with invalid severity', () => {
      const invalidContradiction = {
        id: uuidv4(),
        claim1: uuidv4(),
        claim2: uuidv4(),
        severity: 'critical', // Invalid
        type: 'logical',
        description: 'Test contradiction'
      };

      const result = ContradictionSchema.safeParse(invalidContradiction);
      expect(result.success).toBe(false);
    });

    it('should reject contradiction with invalid type', () => {
      const invalidContradiction = {
        id: uuidv4(),
        claim1: uuidv4(),
        claim2: uuidv4(),
        severity: 'high',
        type: 'invalid-type', // Invalid
        description: 'Test contradiction'
      };

      const result = ContradictionSchema.safeParse(invalidContradiction);
      expect(result.success).toBe(false);
    });
  });

  describe('ClaimLedger', () => {
    let ledger;

    beforeEach(() => {
      ledger = new ClaimLedger();
    });

    it('should add and retrieve a claim', () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        claimType: 'duration',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.8,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      const addedClaim = ledger.addClaim(claim);
      expect(addedClaim).toEqual(claim);

      const retrievedClaim = ledger.getClaim(claim.id);
      expect(retrievedClaim).toEqual(claim);
    });

    it('should throw error when adding invalid claim', () => {
      const invalidClaim = {
        id: 'not-a-uuid',
        taskId: uuidv4(),
        claim: 'Test claim',
        claimType: 'duration',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.8,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      expect(() => ledger.addClaim(invalidClaim)).toThrow();
    });

    it('should get claims by task ID', () => {
      const taskId = uuidv4();
      const claim1 = {
        id: uuidv4(),
        taskId: taskId,
        claim: 'Claim 1',
        claimType: 'duration',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.8,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      const claim2 = {
        id: uuidv4(),
        taskId: taskId,
        claim: 'Claim 2',
        claimType: 'deadline',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.9,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      const claim3 = {
        id: uuidv4(),
        taskId: uuidv4(), // Different task ID
        claim: 'Claim 3',
        claimType: 'dependency',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.7,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      ledger.addClaim(claim1);
      ledger.addClaim(claim2);
      ledger.addClaim(claim3);

      const taskClaims = ledger.getClaimsByTask(taskId);
      expect(taskClaims).toHaveLength(2);
      expect(taskClaims).toContainEqual(claim1);
      expect(taskClaims).toContainEqual(claim2);
    });

    it('should add and retrieve a contradiction', () => {
      const contradiction = {
        id: uuidv4(),
        claim1: uuidv4(),
        claim2: uuidv4(),
        severity: 'high',
        type: 'numerical',
        description: 'Test contradiction'
      };

      const addedContradiction = ledger.addContradiction(contradiction);
      expect(addedContradiction).toEqual(contradiction);

      const retrievedContradiction = ledger.getContradiction(contradiction.id);
      expect(retrievedContradiction).toEqual(contradiction);
    });

    it('should export all claims and contradictions', () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        claimType: 'duration',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.8,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      const contradiction = {
        id: uuidv4(),
        claim1: uuidv4(),
        claim2: uuidv4(),
        severity: 'medium',
        type: 'logical',
        description: 'Test contradiction'
      };

      ledger.addClaim(claim);
      ledger.addContradiction(contradiction);

      const exported = ledger.export();
      expect(exported.claims).toHaveLength(1);
      expect(exported.contradictions).toHaveLength(1);
      expect(exported.claims[0]).toEqual(claim);
      expect(exported.contradictions[0]).toEqual(contradiction);
    });

    it('should get all claims', () => {
      const claim1 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Claim 1',
        claimType: 'duration',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.8,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      const claim2 = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Claim 2',
        claimType: 'deadline',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.9,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      ledger.addClaim(claim1);
      ledger.addClaim(claim2);

      const allClaims = ledger.getAllClaims();
      expect(allClaims).toHaveLength(2);
    });

    it('should clear all claims and contradictions', () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        claimType: 'duration',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.8,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      ledger.addClaim(claim);
      expect(ledger.size().claims).toBe(1);

      ledger.clear();
      expect(ledger.size().claims).toBe(0);
      expect(ledger.size().contradictions).toBe(0);
    });

    it('should return correct size', () => {
      expect(ledger.size()).toEqual({ claims: 0, contradictions: 0 });

      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        claimType: 'duration',
        source: {
          documentName: 'test.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.8,
        contradictions: [],
        validatedAt: new Date().toISOString()
      };

      const contradiction = {
        id: uuidv4(),
        claim1: uuidv4(),
        claim2: uuidv4(),
        severity: 'low',
        type: 'temporal',
        description: 'Test'
      };

      ledger.addClaim(claim);
      ledger.addContradiction(contradiction);

      expect(ledger.size()).toEqual({ claims: 1, contradictions: 1 });
    });

    it('should handle multiple claims for same task', () => {
      const taskId = uuidv4();

      for (let i = 0; i < 5; i++) {
        const claim = {
          id: uuidv4(),
          taskId: taskId,
          claim: `Claim ${i}`,
          claimType: 'duration',
          source: {
            documentName: 'test.pdf',
            provider: 'INTERNAL'
          },
          confidence: 0.8,
          contradictions: [],
          validatedAt: new Date().toISOString()
        };
        ledger.addClaim(claim);
      }

      const taskClaims = ledger.getClaimsByTask(taskId);
      expect(taskClaims).toHaveLength(5);
    });
  });
});
