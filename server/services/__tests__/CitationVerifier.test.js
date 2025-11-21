import { describe, it, expect, beforeEach } from '@jest/globals';
import { CitationVerifier } from '../CitationVerifier.js';

describe('CitationVerifier', () => {
  let verifier;
  let sourceDocuments;

  beforeEach(() => {
    verifier = new CitationVerifier({
      maxLevenshteinDistance: 5,
      similarityThreshold: 0.85,
      contextWindowSize: 200
    });

    sourceDocuments = [
      {
        name: 'FDA_Guidelines.pdf',
        content: 'The FDA 510(k) submission process typically takes 90 days for review. ' +
                'This timeline is based on standard procedures and may vary depending on the ' +
                'complexity of the device. Additional information may be required during the review process.'
      },
      {
        name: 'project_plan.md',
        content: 'Project Timeline:\n\n' +
                'Phase 1: Requirements gathering - 2 weeks\n' +
                'Phase 2: Development - 8 weeks\n' +
                'Phase 3: Testing - 3 weeks\n' +
                'Total duration: 13 weeks'
      }
    ];
  });

  describe('verifyCitation', () => {
    it('should verify exact match citation', async () => {
      const citation = {
        documentName: 'FDA_Guidelines.pdf',
        exactQuote: 'typically takes 90 days for review',
        startChar: 43,
        endChar: 76,
        retrievedAt: new Date().toISOString()
      };

      const result = await verifier.verifyCitation(citation, sourceDocuments);

      expect(result.valid).toBe(true);
      expect(['exact', 'context']).toContain(result.matchType);
      expect(result.score).toBeGreaterThanOrEqual(0.9);
    });

    it('should handle quote with minor differences', async () => {
      // Test will find the quote in context even if extracted text doesn't match exactly
      const citation = {
        documentName: 'FDA_Guidelines.pdf',
        exactQuote: 'typically takes 90 days for review',
        startChar: 40, // Slightly off range
        endChar: 80,
        retrievedAt: new Date().toISOString()
      };

      const result = await verifier.verifyCitation(citation, sourceDocuments);

      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should fail when document not found', async () => {
      const citation = {
        documentName: 'NonExistent.pdf',
        exactQuote: 'some text',
        startChar: 0,
        endChar: 10,
        retrievedAt: new Date().toISOString()
      };

      const result = await verifier.verifyCitation(citation, sourceDocuments);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Document not found');
      expect(result.score).toBe(0);
      expect(result.details.documentFound).toBe(false);
    });

    it('should fail when character range is invalid', async () => {
      const citation = {
        documentName: 'FDA_Guidelines.pdf',
        exactQuote: 'some text',
        startChar: 1000,
        endChar: 2000, // Exceeds document length
        retrievedAt: new Date().toISOString()
      };

      const result = await verifier.verifyCitation(citation, sourceDocuments);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds document length');
    });

    it('should find quote in nearby context', async () => {
      const citation = {
        documentName: 'FDA_Guidelines.pdf',
        exactQuote: 'typically takes 90 days',
        startChar: 0, // Wrong range, but quote exists nearby
        endChar: 20,
        retrievedAt: new Date().toISOString()
      };

      const result = await verifier.verifyCitation(citation, sourceDocuments);

      expect(result.valid).toBe(true);
      expect(result.matchType).toBe('context');
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should handle quotes with special characters', async () => {
      const citation = {
        documentName: 'project_plan.md',
        exactQuote: 'Phase 1: Requirements gathering - 2 weeks',
        startChar: 20,
        endChar: 60,
        retrievedAt: new Date().toISOString()
      };

      const result = await verifier.verifyCitation(citation, sourceDocuments);

      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });
  });

  describe('verifyCharacterRange', () => {
    it('should validate correct character range', () => {
      const content = 'This is a test document';
      const result = verifier.verifyCharacterRange(0, 10, content);

      expect(result.valid).toBe(true);
      expect(result.extractedLength).toBe(10);
    });

    it('should reject negative start character', () => {
      const content = 'This is a test document';
      const result = verifier.verifyCharacterRange(-1, 10, content);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('negative');
    });

    it('should reject end character exceeding length', () => {
      const content = 'This is a test document';
      const result = verifier.verifyCharacterRange(0, 1000, content);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds document length');
    });

    it('should reject start >= end', () => {
      const content = 'This is a test document';
      const result = verifier.verifyCharacterRange(10, 5, content);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('must be less than');
    });
  });

  describe('checkExactMatch', () => {
    it('should match identical strings', () => {
      const result = verifier.checkExactMatch(
        'This is a test',
        'This is a test'
      );

      expect(result.isMatch).toBe(true);
    });

    it('should match with different whitespace', () => {
      const result = verifier.checkExactMatch(
        'This  is   a test',
        'This is a test'
      );

      expect(result.isMatch).toBe(true);
    });

    it('should match case-insensitive', () => {
      const result = verifier.checkExactMatch(
        'This Is A Test',
        'this is a test'
      );

      expect(result.isMatch).toBe(true);
    });

    it('should not match different strings', () => {
      const result = verifier.checkExactMatch(
        'This is a test',
        'This is different'
      );

      expect(result.isMatch).toBe(false);
    });
  });

  describe('checkFuzzyMatch', () => {
    it('should match similar strings above threshold', () => {
      const result = verifier.checkFuzzyMatch(
        'The FDA takes 90 days',
        'The FDA takes 90 dayz' // Minor typo
      );

      expect(result.isMatch).toBe(true);
      expect(result.similarity).toBeGreaterThan(0.85);
    });

    it('should not match dissimilar strings', () => {
      const result = verifier.checkFuzzyMatch(
        'The FDA takes 90 days',
        'Completely different text here'
      );

      expect(result.isMatch).toBe(false);
      expect(result.similarity).toBeLessThan(0.85);
    });

    it('should return similarity score', () => {
      const result = verifier.checkFuzzyMatch(
        'test',
        'test'
      );

      expect(result.similarity).toBe(1.0);
      expect(result.distance).toBe(0);
    });
  });

  describe('levenshteinDistance', () => {
    it('should calculate distance for identical strings', () => {
      const distance = verifier.levenshteinDistance('test', 'test');
      expect(distance).toBe(0);
    });

    it('should calculate distance for single substitution', () => {
      const distance = verifier.levenshteinDistance('test', 'tost');
      expect(distance).toBe(1);
    });

    it('should calculate distance for insertion', () => {
      const distance = verifier.levenshteinDistance('test', 'tests');
      expect(distance).toBe(1);
    });

    it('should calculate distance for deletion', () => {
      const distance = verifier.levenshteinDistance('test', 'tes');
      expect(distance).toBe(1);
    });

    it('should calculate distance for completely different strings', () => {
      const distance = verifier.levenshteinDistance('abc', 'xyz');
      expect(distance).toBe(3);
    });

    it('should handle empty strings', () => {
      const distance = verifier.levenshteinDistance('', 'test');
      expect(distance).toBe(4);
    });
  });

  describe('normalizeText', () => {
    it('should lowercase text', () => {
      const result = verifier.normalizeText('This Is A Test');
      expect(result).toBe('this is a test');
    });

    it('should normalize whitespace', () => {
      const result = verifier.normalizeText('This   is  a    test');
      expect(result).toBe('this is a test');
    });

    it('should remove punctuation', () => {
      const result = verifier.normalizeText('This, is! a? test.');
      expect(result).toBe('this is a test');
    });

    it('should trim whitespace', () => {
      const result = verifier.normalizeText('  This is a test  ');
      expect(result).toBe('this is a test');
    });
  });

  describe('searchInContext', () => {
    it('should find exact match in context window', () => {
      const content = 'The FDA 510(k) submission process typically takes 90 days for review.';
      const result = verifier.searchInContext(
        'typically takes 90 days',
        content,
        0, // Wrong range
        10,
      );

      expect(result.found).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it('should find partial match in context', () => {
      const content = 'The FDA 510(k) submission process typically takes 90 days for review.';
      const result = verifier.searchInContext(
        'The FDA 510(k) submission process typically',
        content,
        50, // Outside actual location
        60
      );

      expect(result.found).toBe(true);
    });

    it('should not find non-existent text', () => {
      const content = 'The FDA 510(k) submission process typically takes 90 days for review.';
      const result = verifier.searchInContext(
        'This text does not exist',
        content,
        0,
        10
      );

      expect(result.found).toBe(false);
    });
  });

  describe('batchVerify', () => {
    it('should verify multiple citations', async () => {
      const citations = [
        {
          documentName: 'FDA_Guidelines.pdf',
          exactQuote: 'typically takes 90 days',
          startChar: 43,
          endChar: 67,
          retrievedAt: new Date().toISOString()
        },
        {
          documentName: 'project_plan.md',
          exactQuote: 'Requirements gathering - 2 weeks',
          startChar: 29,
          endChar: 62,
          retrievedAt: new Date().toISOString()
        }
      ];

      const result = await verifier.batchVerify(citations, sourceDocuments);

      expect(result.results).toHaveLength(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.valid).toBeGreaterThan(0);
      expect(result.summary.averageScore).toBeGreaterThan(0);
    });

    it('should handle mix of valid and invalid citations', async () => {
      const citations = [
        {
          documentName: 'FDA_Guidelines.pdf',
          exactQuote: 'typically takes 90 days',
          startChar: 43,
          endChar: 67,
          retrievedAt: new Date().toISOString()
        },
        {
          documentName: 'NonExistent.pdf',
          exactQuote: 'fake text',
          startChar: 0,
          endChar: 10,
          retrievedAt: new Date().toISOString()
        }
      ];

      const result = await verifier.batchVerify(citations, sourceDocuments);

      expect(result.summary.valid).toBe(1);
      expect(result.summary.invalid).toBe(1);
    });

    it('should calculate correct average score', async () => {
      const citations = [
        {
          documentName: 'FDA_Guidelines.pdf',
          exactQuote: 'typically takes 90 days',
          startChar: 43,
          endChar: 67,
          retrievedAt: new Date().toISOString()
        },
        {
          documentName: 'FDA_Guidelines.pdf',
          exactQuote: 'typically takes 90 days',
          startChar: 43,
          endChar: 67,
          retrievedAt: new Date().toISOString()
        }
      ];

      const result = await verifier.batchVerify(citations, sourceDocuments);

      expect(result.summary.averageScore).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing citation fields', async () => {
      const citation = {
        documentName: 'FDA_Guidelines.pdf'
        // Missing required fields
      };

      const result = await verifier.verifyCitation(citation, sourceDocuments);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('error');
    });

    it('should handle null source documents', async () => {
      const citation = {
        documentName: 'FDA_Guidelines.pdf',
        exactQuote: 'test',
        startChar: 0,
        endChar: 10,
        retrievedAt: new Date().toISOString()
      };

      const result = await verifier.verifyCitation(citation, null);

      expect(result.valid).toBe(false);
    });

    it('should handle empty source documents array', async () => {
      const citation = {
        documentName: 'FDA_Guidelines.pdf',
        exactQuote: 'test',
        startChar: 0,
        endChar: 10,
        retrievedAt: new Date().toISOString()
      };

      const result = await verifier.verifyCitation(citation, []);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Document not found');
    });
  });
});
