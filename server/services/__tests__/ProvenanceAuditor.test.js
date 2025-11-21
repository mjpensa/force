import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProvenanceAuditor } from '../ProvenanceAuditor.js';
import { v4 as uuidv4 } from 'uuid';

describe('ProvenanceAuditor', () => {
  let auditor;
  let sourceDocuments;

  beforeEach(() => {
    auditor = new ProvenanceAuditor({
      trustedProviders: ['INTERNAL', 'GEMINI', 'CLAUDE'],
      providerWeights: {
        'INTERNAL': 1.0,
        'CLAUDE': 0.95,
        'GEMINI': 0.9,
        'OPENAI': 0.9,
        'UNKNOWN': 0.5
      }
    });

    sourceDocuments = [
      {
        name: 'FDA_Guidelines.pdf',
        filename: 'FDA_Guidelines.pdf',
        size: 50000,
        type: 'application/pdf',
        content: 'FDA guidelines content...'
      },
      {
        name: 'project_plan.md',
        filename: 'project_plan.md',
        size: 10000,
        type: 'text/markdown',
        content: 'Project plan content...'
      }
    ];
  });

  describe('auditProvenance', () => {
    it('should audit claim with valid explicit source', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'FDA approval takes 90 days',
        claimType: 'duration',
        source: {
          documentName: 'FDA_Guidelines.pdf',
          provider: 'INTERNAL',
          citation: {
            startChar: 100,
            endChar: 130,
            exactQuote: 'Standard review time is 90 days',
            retrievedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
          }
        },
        confidence: 0.9,
        validatedAt: new Date().toISOString()
      };

      const result = await auditor.auditProvenance(claim, sourceDocuments);

      expect(result.score).toBeGreaterThan(0.7);
      expect(result.chainOfCustody).toHaveLength(4);
      expect(result.chainOfCustody[0].step).toBe('SOURCE_VERIFICATION');
      expect(result.chainOfCustody[0].verified).toBe(true);
      expect(result.chainOfCustody[1].step).toBe('PROVIDER_TRUST');
      expect(result.chainOfCustody[2].step).toBe('TIMESTAMP_VERIFICATION');
      expect(result.chainOfCustody[3].step).toBe('TAMPERING_CHECK');
      expect(result.issues).toHaveLength(0);
    });

    it('should handle inference-based claims', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Testing takes 5 days',
        claimType: 'duration',
        source: {
          documentName: 'inferred',
          provider: 'GEMINI',
          citation: null
        },
        confidence: 0.65,
        validatedAt: new Date().toISOString()
      };

      const result = await auditor.auditProvenance(claim, sourceDocuments);

      expect(result.chainOfCustody[0].sourceType).toBe('inference');
      expect(result.chainOfCustody[0].verified).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should detect missing source document', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Some claim',
        claimType: 'duration',
        source: {
          documentName: 'NonExistent.pdf',
          provider: 'INTERNAL'
        },
        confidence: 0.9,
        validatedAt: new Date().toISOString()
      };

      const result = await auditor.auditProvenance(claim, sourceDocuments);

      expect(result.score).toBe(0.2);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('high');
      expect(result.issues[0].issue).toContain('Source document not found');
      expect(result.chainOfCustody[0].verified).toBe(false);
    });

    it('should recommend re-validation for low scores', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Some claim',
        claimType: 'duration',
        source: {
          documentName: 'FDA_Guidelines.pdf', // Valid source
          provider: 'UNKNOWN', // Untrusted provider
          citation: {
            startChar: -1, // Invalid range - triggers tampering
            endChar: 100,
            exactQuote: 'Test quote'
          }
        },
        confidence: 0.5,
        validatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 400).toISOString() // Old claim
      };

      const result = await auditor.auditProvenance(claim, sourceDocuments);

      expect(result.score).toBeLessThan(0.7);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const invalidClaim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        // Missing source field
        validatedAt: new Date().toISOString()
      };

      const result = await auditor.auditProvenance(invalidClaim, sourceDocuments);

      // Missing source results in 0.2 score, not critical error
      expect(result.score).toBe(0.2);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].severity).toBe('high');
    });
  });

  describe('verifySource', () => {
    it('should verify existing source document', async () => {
      const claim = {
        source: {
          documentName: 'FDA_Guidelines.pdf',
          provider: 'INTERNAL'
        }
      };

      const result = await auditor.verifySource(claim, sourceDocuments);

      expect(result.step).toBe('SOURCE_VERIFICATION');
      expect(result.exists).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.sourceType).toBe('explicit');
      expect(result.documentMetadata).toBeDefined();
      expect(result.documentMetadata.name).toBe('FDA_Guidelines.pdf');
      expect(result.documentMetadata.size).toBe(50000);
    });

    it('should verify inferred claims', async () => {
      const claim = {
        source: {
          documentName: 'inferred',
          provider: 'GEMINI'
        }
      };

      const result = await auditor.verifySource(claim, sourceDocuments);

      expect(result.exists).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.sourceType).toBe('inference');
      expect(result.note).toContain('Inference-based claim');
    });

    it('should return false for non-existent document', async () => {
      const claim = {
        source: {
          documentName: 'Missing.pdf',
          provider: 'INTERNAL'
        }
      };

      const result = await auditor.verifySource(claim, sourceDocuments);

      expect(result.exists).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.documentMetadata).toBeNull();
    });

    it('should handle missing source field', async () => {
      const claim = {};

      const result = await auditor.verifySource(claim, sourceDocuments);

      expect(result.exists).toBe(false);
      expect(result.verified).toBe(false);
    });
  });

  describe('assessProviderTrust', () => {
    it('should assess INTERNAL provider as highly trusted', () => {
      const claim = {
        source: {
          provider: 'INTERNAL'
        }
      };

      const result = auditor.assessProviderTrust(claim);

      expect(result.step).toBe('PROVIDER_TRUST');
      expect(result.provider).toBe('INTERNAL');
      expect(result.trustScore).toBe(1.0);
      expect(result.trusted).toBe(true);
      expect(result.note).toContain('Trusted provider');
    });

    it('should assess CLAUDE provider as trusted', () => {
      const claim = {
        source: {
          provider: 'CLAUDE'
        }
      };

      const result = auditor.assessProviderTrust(claim);

      expect(result.provider).toBe('CLAUDE');
      expect(result.trustScore).toBe(0.95);
      expect(result.trusted).toBe(true);
    });

    it('should assess GEMINI provider as trusted', () => {
      const claim = {
        source: {
          provider: 'GEMINI'
        }
      };

      const result = auditor.assessProviderTrust(claim);

      expect(result.provider).toBe('GEMINI');
      expect(result.trustScore).toBe(0.9);
      expect(result.trusted).toBe(true);
    });

    it('should assess UNKNOWN provider with low trust', () => {
      const claim = {
        source: {
          provider: 'UNKNOWN'
        }
      };

      const result = auditor.assessProviderTrust(claim);

      expect(result.provider).toBe('UNKNOWN');
      expect(result.trustScore).toBe(0.5);
      expect(result.trusted).toBe(false);
      expect(result.note).toContain('Untrusted or unknown provider');
    });

    it('should handle missing provider', () => {
      const claim = {
        source: {}
      };

      const result = auditor.assessProviderTrust(claim);

      expect(result.provider).toBe('UNKNOWN');
      expect(result.trustScore).toBe(0.5);
      expect(result.trusted).toBe(false);
    });
  });

  describe('verifyTimestamps', () => {
    it('should verify valid timestamps', () => {
      const claim = {
        validatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        source: {
          citation: {
            retrievedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() // 2 days ago
          }
        }
      };

      const result = auditor.verifyTimestamps(claim, {});

      expect(result.step).toBe('TIMESTAMP_VERIFICATION');
      expect(result.valid).toBe(true);
      expect(result.daysSinceValidation).toBeGreaterThanOrEqual(0);
      expect(result.daysSinceValidation).toBeLessThan(2);
    });

    it('should detect future timestamps', () => {
      const claim = {
        validatedAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 1 day in future
        source: {}
      };

      const result = auditor.verifyTimestamps(claim, {});

      expect(result.valid).toBe(false);
      expect(result.issue).toContain('future');
    });

    it('should warn about old claims (>1 year)', () => {
      const claim = {
        validatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 400).toISOString(), // 400 days ago
        source: {}
      };

      const result = auditor.verifyTimestamps(claim, {});

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('over 1 year old');
      expect(result.daysSinceValidation).toBeGreaterThan(365);
    });

    it('should detect citation timestamp after claim timestamp', () => {
      const claim = {
        validatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        source: {
          citation: {
            retrievedAt: new Date().toISOString() // Now (after claim)
          }
        }
      };

      const result = auditor.verifyTimestamps(claim, {});

      expect(result.valid).toBe(false);
      expect(result.issue).toContain('Citation retrieved after claim validation');
    });

    it('should handle missing citation timestamp', () => {
      const claim = {
        validatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
        source: {}
      };

      const result = auditor.verifyTimestamps(claim, {});

      expect(result.valid).toBe(true);
    });
  });

  describe('checkForTampering', () => {
    it('should pass clean claims', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        confidence: 0.9,
        source: {
          citation: {
            startChar: 100,
            endChar: 130,
            exactQuote: '123456789012345678901234567890' // Exactly 30 characters
          }
        }
      };

      const result = await auditor.checkForTampering(claim, {});

      expect(result.step).toBe('TAMPERING_CHECK');
      expect(result.clean).toBe(true);
      expect(result.indicators).toHaveLength(0);
      expect(result.note).toContain('No tampering indicators');
    });

    it('should detect invalid character range', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        confidence: 0.9,
        source: {
          citation: {
            startChar: -1, // Invalid
            endChar: 100,
            exactQuote: 'Test quote'
          }
        }
      };

      const result = await auditor.checkForTampering(claim, {});

      expect(result.clean).toBe(false);
      expect(result.indicators).toContain('Invalid character range');
    });

    it('should detect quote length mismatch', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        confidence: 0.9,
        source: {
          citation: {
            startChar: 100,
            endChar: 130, // 30 chars expected
            exactQuote: 'Short quote' // But only 11 chars
          }
        }
      };

      const result = await auditor.checkForTampering(claim, {});

      expect(result.clean).toBe(false);
      expect(result.indicators).toContain('Quote length mismatch');
    });

    it('should detect invalid confidence score', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        confidence: 1.5, // Invalid (>1)
        source: {}
      };

      const result = await auditor.checkForTampering(claim, {});

      expect(result.clean).toBe(false);
      expect(result.indicators).toContain('Invalid confidence score');
    });

    it('should detect missing required fields', async () => {
      const claim = {
        // Missing id, taskId, claim
        confidence: 0.9,
        source: {}
      };

      const result = await auditor.checkForTampering(claim, {});

      expect(result.clean).toBe(false);
      expect(result.indicators).toContain('Missing required fields');
    });
  });

  describe('calculateProvenanceScore', () => {
    it('should give high score for perfect provenance', () => {
      const auditSteps = {
        sourceVerification: { verified: true },
        providerTrust: { trustScore: 1.0 },
        timestampCheck: { valid: true },
        tamperingCheck: { clean: true }
      };

      const score = auditor.calculateProvenanceScore(auditSteps);

      expect(score).toBeGreaterThan(0.9);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should penalize missing source (30%)', () => {
      const auditSteps = {
        sourceVerification: { verified: false },
        providerTrust: { trustScore: 1.0 },
        timestampCheck: { valid: true },
        tamperingCheck: { clean: true }
      };

      const score = auditor.calculateProvenanceScore(auditSteps);

      expect(score).toBeLessThan(0.75);
      expect(score).toBeGreaterThan(0.6);
    });

    it('should penalize untrusted provider (25%)', () => {
      const auditSteps = {
        sourceVerification: { verified: true },
        providerTrust: { trustScore: 0.5 },
        timestampCheck: { valid: true },
        tamperingCheck: { clean: true }
      };

      const score = auditor.calculateProvenanceScore(auditSteps);

      expect(score).toBeLessThan(0.9);
      expect(score).toBeGreaterThan(0.8);
    });

    it('should penalize invalid timestamps (20%)', () => {
      const auditSteps = {
        sourceVerification: { verified: true },
        providerTrust: { trustScore: 1.0 },
        timestampCheck: { valid: false },
        tamperingCheck: { clean: true }
      };

      const score = auditor.calculateProvenanceScore(auditSteps);

      expect(score).toBeLessThan(0.85);
      expect(score).toBeGreaterThan(0.75);
    });

    it('should penalize tampering (25%)', () => {
      const auditSteps = {
        sourceVerification: { verified: true },
        providerTrust: { trustScore: 1.0 },
        timestampCheck: { valid: true },
        tamperingCheck: { clean: false }
      };

      const score = auditor.calculateProvenanceScore(auditSteps);

      expect(score).toBeLessThan(0.8);
      expect(score).toBeGreaterThan(0.7);
    });

    it('should never return score below 0', () => {
      const auditSteps = {
        sourceVerification: { verified: false },
        providerTrust: { trustScore: 0 },
        timestampCheck: { valid: false },
        tamperingCheck: { clean: false }
      };

      const score = auditor.calculateProvenanceScore(auditSteps);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should apply timestamp warning penalty (10%)', () => {
      const auditSteps = {
        sourceVerification: { verified: true },
        providerTrust: { trustScore: 1.0 },
        timestampCheck: { valid: true, warning: 'Old claim' },
        tamperingCheck: { clean: true }
      };

      const score = auditor.calculateProvenanceScore(auditSteps);

      expect(score).toBeLessThan(0.95);
      expect(score).toBeGreaterThan(0.85);
    });
  });

  describe('batchAudit', () => {
    it('should audit multiple claims', async () => {
      const claims = [
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 1',
          claimType: 'duration',
          source: {
            documentName: 'FDA_Guidelines.pdf',
            provider: 'INTERNAL'
          },
          confidence: 0.9,
          validatedAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 2',
          claimType: 'duration',
          source: {
            documentName: 'project_plan.md',
            provider: 'GEMINI'
          },
          confidence: 0.8,
          validatedAt: new Date().toISOString()
        }
      ];

      const result = await auditor.batchAudit(claims, sourceDocuments);

      expect(result.results).toHaveLength(2);
      expect(result.avgProvenanceScore).toBeGreaterThan(0);
      expect(result.avgProvenanceScore).toBeLessThanOrEqual(1);
      expect(result.issuesCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle mixed valid and invalid claims', async () => {
      const claims = [
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Valid claim',
          claimType: 'duration',
          source: {
            documentName: 'FDA_Guidelines.pdf',
            provider: 'INTERNAL'
          },
          confidence: 0.9,
          validatedAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Invalid claim',
          claimType: 'duration',
          source: {
            documentName: 'Missing.pdf',
            provider: 'UNKNOWN'
          },
          confidence: 0.5,
          validatedAt: new Date().toISOString()
        }
      ];

      const result = await auditor.batchAudit(claims, sourceDocuments);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].score).toBeGreaterThan(result.results[1].score);
      expect(result.issuesCount).toBeGreaterThan(0);
    });

    it('should handle empty claims array', async () => {
      const result = await auditor.batchAudit([], sourceDocuments);

      expect(result.results).toHaveLength(0);
      expect(result.avgProvenanceScore).toBe(0);
      expect(result.issuesCount).toBe(0);
    });

    it('should handle errors in individual claims', async () => {
      const claims = [
        {
          // Invalid claim structure
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Test claim',
          // Missing source field - results in 0.2 score
          validatedAt: new Date().toISOString()
        }
      ];

      const result = await auditor.batchAudit(claims, sourceDocuments);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBe(0.2);
      expect(result.results[0].issues.length).toBeGreaterThan(0);
    });
  });
});
