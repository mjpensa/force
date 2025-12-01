/**
 * Unit tests for the Map-Reduce processor
 * Tests the main orchestration of chunking, extraction, and consolidation
 * 
 * Note: These tests use real implementations of chunker and consolidator
 * but mock the gemini API for the extractor.
 */

import { jest } from '@jest/globals';

// Mock the gemini module before importing mapReduceProcessor
jest.unstable_mockModule('../../../server/gemini.js', () => ({
  callGeminiForJson: jest.fn()
}));

const { callGeminiForJson } = await import('../../../server/gemini.js');
const { 
  prepareResearchContext,
  willUseMapReduce,
  getProcessingEstimate
} = await import('../../../server/utils/mapReduceProcessor.js');

describe('Map-Reduce Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('willUseMapReduce', () => {
    it('should return true when content exceeds threshold', () => {
      const files = [{ content: 'A'.repeat(60000) }];
      const result = willUseMapReduce(files);
      
      expect(result).toBe(true);
    });

    it('should return false for small content', () => {
      const files = [{ content: 'Small content' }];
      const result = willUseMapReduce(files);
      
      expect(result).toBe(false);
    });
  });

  describe('prepareResearchContext', () => {
    it('should return original content when chunking not needed', async () => {
      const files = [
        { filename: 'doc.pdf', content: 'Original research content' }
      ];
      
      const result = await prepareResearchContext(files, 'roadmap');
      
      expect(result.context).toContain('Original research content');
      expect(result.metadata.strategy).toBe('direct');
      // Should NOT have called gemini since no map-reduce needed
      expect(callGeminiForJson).not.toHaveBeenCalled();
    });

    it('should orchestrate full pipeline when chunking needed', async () => {
      // Mock successful extraction responses
      callGeminiForJson.mockResolvedValue({
        keyFacts: [{ fact: 'Extracted fact', importance: 'high' }],
        dates: [],
        entities: [],
        themes: [{ theme: 'Test theme', frequency: 'primary' }],
        metrics: [],
        recommendations: [],
        quotes: []
      });
      
      // Create content that exceeds the 50K threshold (need > 50000 chars)
      const files = [{ filename: 'doc.pdf', content: 'A'.repeat(60000) }];
      const result = await prepareResearchContext(files, 'roadmap');
      
      // Should have used map-reduce
      expect(result.metadata.strategy).toBe('map-reduce');
      // Should have called gemini for each chunk
      expect(callGeminiForJson).toHaveBeenCalled();
      // Context should contain extracted info
      expect(result.context).toContain('Extracted fact');
    });

    it('should call progress callback at each stage', async () => {
      callGeminiForJson.mockResolvedValue({
        keyFacts: [],
        dates: [],
        entities: [],
        themes: [],
        metrics: [],
        recommendations: [],
        quotes: []
      });
      
      const onProgress = jest.fn();
      const files = [{ filename: 'doc.pdf', content: 'A'.repeat(60000) }];
      
      await prepareResearchContext(files, 'roadmap', { onProgress });
      
      expect(onProgress).toHaveBeenCalled();
      
      // Check for the different phases
      const phases = onProgress.mock.calls.map(call => call[0].phase);
      expect(phases).toContain('chunking');
      expect(phases).toContain('extraction');
      expect(phases).toContain('consolidation');
      expect(phases).toContain('complete');
    });

    it('should throw error for empty research files', async () => {
      await expect(prepareResearchContext([], 'roadmap'))
        .rejects.toThrow('RESEARCH CONTENT MISSING');
      
      await expect(prepareResearchContext(null, 'roadmap'))
        .rejects.toThrow('RESEARCH CONTENT MISSING');
    });

    it('should include comprehensive metadata', async () => {
      callGeminiForJson.mockResolvedValue({
        keyFacts: [{ fact: 'F1', importance: 'high' }],
        dates: [],
        entities: [],
        themes: [],
        metrics: [],
        recommendations: [],
        quotes: []
      });
      
      const files = [
        { filename: 'a.pdf', content: 'A'.repeat(60000) }
      ];
      const result = await prepareResearchContext(files, 'document');
      
      expect(result.metadata).toMatchObject({
        strategy: 'map-reduce',
        fileCount: expect.any(Number),
        chunksProcessed: expect.any(Number)
      });
      expect(result.metadata.extraction).toBeDefined();
      expect(result.metadata.consolidation).toBeDefined();
    });

    it('should handle partial extraction failures gracefully', async () => {
      let callCount = 0;
      callGeminiForJson.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Simulated API failure');
        }
        return {
          keyFacts: [{ fact: 'Success', importance: 'high' }],
          dates: [],
          entities: [],
          themes: [],
          metrics: [],
          recommendations: [],
          quotes: []
        };
      });
      
      // Create content large enough to trigger multiple chunks (>50K)
      const files = [{ filename: 'doc.pdf', content: 'A'.repeat(80000) }];
      const result = await prepareResearchContext(files, 'roadmap');
      
      // Should still complete despite one failure
      expect(result.context).toBeDefined();
      expect(result.metadata.strategy).toBe('map-reduce');
    });
  });

  describe('getProcessingEstimate', () => {
    it('should return direct strategy for small content', () => {
      const estimate = getProcessingEstimate([{ content: 'Small' }]);
      
      expect(estimate.strategy).toBe('direct');
      expect(estimate.chunks).toBe(1);
    });

    it('should return map-reduce strategy for large content', () => {
      const estimate = getProcessingEstimate([{ content: 'A'.repeat(100000) }]);
      
      expect(estimate.strategy).toBe('map-reduce');
      expect(estimate.chunks).toBeGreaterThan(1);
      expect(estimate.totalSize).toBe(100000);
      expect(estimate.estimatedTime).toBeDefined();
    });
  });
});
