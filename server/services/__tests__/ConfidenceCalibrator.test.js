import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConfidenceCalibrator } from '../ConfidenceCalibrator.js';
import { v4 as uuidv4 } from 'uuid';

describe('ConfidenceCalibrator', () => {
  let calibrator;

  beforeEach(() => {
    calibrator = new ConfidenceCalibrator({
      citationWeight: 0.3,
      contradictionWeight: 0.25,
      provenanceWeight: 0.25,
      originWeight: 0.2
    });
  });

  describe('calibrateConfidence', () => {
    it('should calibrate claim with perfect validation', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'FDA approval takes 90 days',
        confidence: 0.8,
        source: {
          documentName: 'FDA_Guidelines.pdf',
          citation: {
            startChar: 100,
            endChar: 130,
            exactQuote: 'Standard review is 90 days'
          }
        }
      };

      const citationResult = { valid: true, score: 0.95 };
      const contradictions = [];
      const provenance = { score: 0.9 };

      const result = await calibrator.calibrateConfidence(claim, citationResult, contradictions, provenance);

      expect(result.confidence).toBeGreaterThan(0.8); // Should increase from base
      expect(result.calibrationMetadata).toBeDefined();
      expect(result.calibrationMetadata.baseConfidence).toBe(0.8);
      expect(result.calibrationMetadata.factors.citation).toBe(0.95);
      expect(result.calibrationMetadata.factors.contradiction).toBe(1.0);
      expect(result.calibrationMetadata.factors.provenance).toBe(0.9);
      expect(result.calibrationMetadata.adjustmentReason).toContain('High confidence');
    });

    it('should penalize claim with weak citation', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Some claim',
        confidence: 0.9,
        source: {
          documentName: 'doc.pdf'
        }
      };

      const citationResult = { valid: false };
      const contradictions = [];
      const provenance = { score: 0.9 };

      const result = await calibrator.calibrateConfidence(claim, citationResult, contradictions, provenance);

      expect(result.confidence).toBeLessThan(0.9); // Should decrease
      expect(result.calibrationMetadata.factors.citation).toBe(0.3);
      expect(result.calibrationMetadata.adjustmentReason).toContain('Weak or missing citation');
    });

    it('should penalize claim with contradictions', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Duration is 90 days',
        confidence: 0.9,
        source: {
          documentName: 'doc.pdf',
          citation: { exactQuote: 'Test' }
        }
      };

      const citationResult = { valid: true, score: 0.9 };
      const contradictions = [
        { severity: 'high', type: 'numerical' },
        { severity: 'medium', type: 'numerical' }
      ];
      const provenance = { score: 0.9 };

      const result = await calibrator.calibrateConfidence(claim, citationResult, contradictions, provenance);

      expect(result.confidence).toBeLessThan(0.9);
      expect(result.calibrationMetadata.factors.contradiction).toBeLessThan(0.7);
      expect(result.calibrationMetadata.adjustmentReason).toContain('Contradictions detected');
    });

    it('should penalize claim with low provenance', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Some claim',
        confidence: 0.9,
        source: {
          documentName: 'doc.pdf',
          citation: { exactQuote: 'Test' }
        }
      };

      const citationResult = { valid: true, score: 0.9 };
      const contradictions = [];
      const provenance = { score: 0.4 };

      const result = await calibrator.calibrateConfidence(claim, citationResult, contradictions, provenance);

      expect(result.confidence).toBeLessThan(0.9);
      expect(result.calibrationMetadata.factors.provenance).toBe(0.4);
      expect(result.calibrationMetadata.adjustmentReason).toContain('Low provenance score');
    });

    it('should penalize inference-based claims', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Estimated duration',
        confidence: 0.9,
        source: {
          documentName: 'inferred',
          provider: 'GEMINI'
        }
      };

      const citationResult = {};
      const contradictions = [];
      const provenance = { score: 0.9 };

      const result = await calibrator.calibrateConfidence(claim, citationResult, contradictions, provenance);

      expect(result.confidence).toBeLessThan(0.9);
      expect(result.calibrationMetadata.factors.origin).toBe(0.6);
      expect(result.calibrationMetadata.adjustmentReason).toContain('Inference-based claim');
    });

    it('should handle missing confidence field', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        source: {
          documentName: 'doc.pdf',
          citation: { exactQuote: 'Test' }
        }
      };

      const citationResult = { valid: true, score: 0.9 };
      const contradictions = [];
      const provenance = { score: 0.9 };

      const result = await calibrator.calibrateConfidence(claim, citationResult, contradictions, provenance);

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.calibrationMetadata.baseConfidence).toBe(0.5);
    });

    it('should clamp confidence to [0, 1] range', async () => {
      const claim = {
        id: uuidv4(),
        taskId: uuidv4(),
        claim: 'Test claim',
        confidence: 0.1, // Low base
        source: {
          documentName: 'doc.pdf'
        }
      };

      const citationResult = { valid: false }; // Weak
      const contradictions = [
        { severity: 'high' },
        { severity: 'high' },
        { severity: 'high' }
      ]; // Many contradictions
      const provenance = { score: 0.1 }; // Low provenance

      const result = await calibrator.calibrateConfidence(claim, citationResult, contradictions, provenance);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateCitationFactor', () => {
    it('should return high score for valid citation with score', () => {
      const result = calibrator.calculateCitationFactor({ valid: true, score: 0.95 });
      expect(result).toBe(0.95);
    });

    it('should return high score for valid citation with confidence', () => {
      const result = calibrator.calculateCitationFactor({ valid: true, confidence: 0.88 });
      expect(result).toBe(0.88);
    });

    it('should return default high score for valid citation without score', () => {
      const result = calibrator.calculateCitationFactor({ valid: true });
      expect(result).toBe(0.9);
    });

    it('should return low score for invalid citation', () => {
      const result = calibrator.calculateCitationFactor({ valid: false });
      expect(result).toBe(0.3);
    });

    it('should return low score for missing citation', () => {
      const result = calibrator.calculateCitationFactor(null);
      expect(result).toBe(0.3);
    });

    it('should return low score for undefined citation', () => {
      const result = calibrator.calculateCitationFactor(undefined);
      expect(result).toBe(0.3);
    });
  });

  describe('calculateContradictionFactor', () => {
    it('should return 1.0 for no contradictions', () => {
      const result = calibrator.calculateContradictionFactor([]);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for null contradictions', () => {
      const result = calibrator.calculateContradictionFactor(null);
      expect(result).toBe(1.0);
    });

    it('should penalize high severity contradictions (-0.3 each)', () => {
      const contradictions = [
        { severity: 'high' },
        { severity: 'high' }
      ];

      const result = calibrator.calculateContradictionFactor(contradictions);

      expect(result).toBe(0.4); // 1.0 - (2 * 0.3) = 0.4
    });

    it('should penalize medium severity contradictions (-0.15 each)', () => {
      const contradictions = [
        { severity: 'medium' },
        { severity: 'medium' }
      ];

      const result = calibrator.calculateContradictionFactor(contradictions);

      expect(result).toBe(0.7); // 1.0 - (2 * 0.15) = 0.7
    });

    it('should penalize low severity contradictions (-0.05 each)', () => {
      const contradictions = [
        { severity: 'low' },
        { severity: 'low' }
      ];

      const result = calibrator.calculateContradictionFactor(contradictions);

      expect(result).toBe(0.9); // 1.0 - (2 * 0.05) = 0.9
    });

    it('should handle mixed severity contradictions', () => {
      const contradictions = [
        { severity: 'high' },
        { severity: 'medium' },
        { severity: 'low' }
      ];

      const result = calibrator.calculateContradictionFactor(contradictions);

      // 1.0 - (1*0.3 + 1*0.15 + 1*0.05) = 0.5
      expect(result).toBe(0.5);
    });

    it('should never return less than 0.1', () => {
      const contradictions = Array(10).fill({ severity: 'high' });

      const result = calibrator.calculateContradictionFactor(contradictions);

      expect(result).toBe(0.1);
    });
  });

  describe('calculateOriginFactor', () => {
    it('should return 0.95 for explicit citation', () => {
      const claim = {
        source: {
          documentName: 'doc.pdf',
          citation: { exactQuote: 'Test' }
        }
      };

      const result = calibrator.calculateOriginFactor(claim);

      expect(result).toBe(0.95);
    });

    it('should return 0.6 for inferred claims', () => {
      const claim = {
        source: {
          documentName: 'inferred',
          provider: 'GEMINI'
        }
      };

      const result = calibrator.calculateOriginFactor(claim);

      expect(result).toBe(0.6);
    });

    it('should return 0.7 for explicit without citation', () => {
      const claim = {
        source: {
          documentName: 'doc.pdf'
        }
      };

      const result = calibrator.calculateOriginFactor(claim);

      expect(result).toBe(0.7);
    });

    it('should handle missing source field', () => {
      const claim = {};

      const result = calibrator.calculateOriginFactor(claim);

      expect(result).toBe(0.7);
    });
  });

  describe('generateAdjustmentReason', () => {
    it('should generate "High confidence" for perfect factors', () => {
      const factors = {
        citation: 0.9,
        contradiction: 1.0,
        provenance: 0.9,
        origin: 0.95
      };

      const result = calibrator.generateAdjustmentReason(factors);

      expect(result).toBe('High confidence across all factors');
    });

    it('should list weak citation', () => {
      const factors = {
        citation: 0.3,
        contradiction: 1.0,
        provenance: 0.9,
        origin: 0.95
      };

      const result = calibrator.generateAdjustmentReason(factors);

      expect(result).toContain('Weak or missing citation');
    });

    it('should list contradictions', () => {
      const factors = {
        citation: 0.9,
        contradiction: 0.5,
        provenance: 0.9,
        origin: 0.95
      };

      const result = calibrator.generateAdjustmentReason(factors);

      expect(result).toContain('Contradictions detected');
    });

    it('should list low provenance', () => {
      const factors = {
        citation: 0.9,
        contradiction: 1.0,
        provenance: 0.5,
        origin: 0.95
      };

      const result = calibrator.generateAdjustmentReason(factors);

      expect(result).toContain('Low provenance score');
    });

    it('should list inference-based claim', () => {
      const factors = {
        citation: 0.9,
        contradiction: 1.0,
        provenance: 0.9,
        origin: 0.6
      };

      const result = calibrator.generateAdjustmentReason(factors);

      expect(result).toContain('Inference-based claim');
    });

    it('should combine multiple issues', () => {
      const factors = {
        citation: 0.3,
        contradiction: 0.5,
        provenance: 0.5,
        origin: 0.6
      };

      const result = calibrator.generateAdjustmentReason(factors);

      expect(result).toContain('Weak or missing citation');
      expect(result).toContain('Contradictions detected');
      expect(result).toContain('Low provenance score');
      expect(result).toContain('Inference-based claim');
    });
  });

  describe('calibrateTaskConfidence', () => {
    it('should calibrate task with high-quality claims', async () => {
      const task = {
        id: uuidv4(),
        name: 'Test task',
        confidence: 0.8
      };

      const validationResult = {
        claims: [
          { confidence: 0.9 },
          { confidence: 0.85 },
          { confidence: 0.88 }
        ],
        citationCoverage: 0.9,
        contradictions: [],
        provenanceScore: 0.85
      };

      const result = await calibrator.calibrateTaskConfidence(task, validationResult);

      expect(result).toBeGreaterThan(0.8);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should penalize low citation coverage', async () => {
      const task = {
        id: uuidv4(),
        name: 'Test task',
        confidence: 0.8
      };

      const validationResult = {
        claims: [
          { confidence: 0.9 }
        ],
        citationCoverage: 0.5, // Low coverage
        contradictions: [],
        provenanceScore: 0.9
      };

      const result = await calibrator.calibrateTaskConfidence(task, validationResult);

      expect(result).toBeLessThan(0.9); // Should be penalized
    });

    it('should penalize high-severity contradictions', async () => {
      const task = {
        id: uuidv4(),
        name: 'Test task',
        confidence: 0.9
      };

      const validationResult = {
        claims: [
          { confidence: 0.9 }
        ],
        citationCoverage: 0.9,
        contradictions: [
          { severity: 'high' },
          { severity: 'high' }
        ],
        provenanceScore: 0.9
      };

      const result = await calibrator.calibrateTaskConfidence(task, validationResult);

      expect(result).toBeLessThan(0.9); // Should be penalized for contradictions
    });

    it('should penalize low provenance score', async () => {
      const task = {
        id: uuidv4(),
        name: 'Test task',
        confidence: 0.9
      };

      const validationResult = {
        claims: [
          { confidence: 0.9 }
        ],
        citationCoverage: 0.9,
        contradictions: [],
        provenanceScore: 0.5 // Low provenance
      };

      const result = await calibrator.calibrateTaskConfidence(task, validationResult);

      expect(result).toBeLessThan(0.9);
    });

    it('should return default for empty claims', async () => {
      const task = {
        id: uuidv4(),
        name: 'Test task',
        confidence: 0.8
      };

      const validationResult = {
        claims: []
      };

      const result = await calibrator.calibrateTaskConfidence(task, validationResult);

      expect(result).toBe(0.8); // Returns task confidence
    });

    it('should clamp result to [0, 1] range', async () => {
      const task = {
        id: uuidv4(),
        name: 'Test task',
        confidence: 0.1
      };

      const validationResult = {
        claims: [
          { confidence: 0.05 }
        ],
        citationCoverage: 0.3,
        contradictions: [
          { severity: 'high' },
          { severity: 'high' },
          { severity: 'high' }
        ],
        provenanceScore: 0.2
      };

      const result = await calibrator.calibrateTaskConfidence(task, validationResult);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('batchCalibrate', () => {
    it('should calibrate multiple claims', async () => {
      const claims = [
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 1',
          confidence: 0.8,
          source: {
            documentName: 'doc.pdf',
            citation: { exactQuote: 'Test' }
          }
        },
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 2',
          confidence: 0.7,
          source: {
            documentName: 'doc.pdf',
            citation: { exactQuote: 'Test' }
          }
        }
      ];

      const validationResults = [
        {
          citation: { valid: true, score: 0.9 },
          contradictions: [],
          provenance: { score: 0.9 }
        },
        {
          citation: { valid: true, score: 0.85 },
          contradictions: [],
          provenance: { score: 0.85 }
        }
      ];

      const result = await calibrator.batchCalibrate(claims, validationResults);

      expect(result).toHaveLength(2);
      expect(result[0].calibrationMetadata).toBeDefined();
      expect(result[1].calibrationMetadata).toBeDefined();
    });

    it('should handle missing validation results', async () => {
      const claims = [
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 1',
          confidence: 0.8,
          source: { documentName: 'doc.pdf' }
        }
      ];

      const validationResults = []; // Empty

      const result = await calibrator.batchCalibrate(claims, validationResults);

      expect(result).toHaveLength(1);
      expect(result[0].calibrationMetadata).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const claims = [
        {
          id: uuidv4(),
          taskId: uuidv4(),
          claim: 'Claim 1',
          confidence: 0.8,
          source: null // Will cause error
        }
      ];

      const validationResults = [
        {
          citation: { valid: true },
          contradictions: [],
          provenance: { score: 0.9 }
        }
      ];

      const result = await calibrator.batchCalibrate(claims, validationResults);

      expect(result).toHaveLength(1);
      // Should return original claim on error
      expect(result[0].id).toBe(claims[0].id);
    });
  });
});
