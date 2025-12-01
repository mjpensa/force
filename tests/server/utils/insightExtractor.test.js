/**
 * Unit tests for the insight extractor utility
 * Tests parallel LLM extraction of structured insights from chunks
 */

import { jest } from '@jest/globals';

// Mock the Gemini client before importing
jest.unstable_mockModule('../../../server/gemini.js', () => ({
  callGeminiForJson: jest.fn()
}));

// Import after mocking
const { callGeminiForJson } = await import('../../../server/gemini.js');
const { 
  extractInsights, 
  processChunksParallel,
  getExtractionStats,
  generateExtractionPrompt,
  insightExtractionSchema
} = await import('../../../server/utils/insightExtractor.js');

describe('Insight Extractor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateExtractionPrompt', () => {
    it('should generate prompt with chunk context', () => {
      const prompt = generateExtractionPrompt(
        'Sample content',
        1,
        3,
        ['doc1.pdf', 'doc2.pdf']
      );
      
      expect(prompt).toContain('chunk 1 of 3');
      expect(prompt).toContain('doc1.pdf');
      expect(prompt).toContain('Sample content');
    });

    it('should handle empty source files', () => {
      const prompt = generateExtractionPrompt('Content', 1, 1, []);
      
      expect(prompt).toContain('Content');
      expect(prompt).not.toContain('Source files:');
    });
  });

  describe('extractInsights', () => {
    it('should extract structured insights from a chunk', async () => {
      const mockResponse = {
        keyFacts: [{ fact: 'Fact 1', importance: 'high', category: 'tech' }],
        dates: [{ date: '2024-01-15', event: 'Launch', type: 'milestone' }],
        entities: [{ name: 'Company A', type: 'company', context: 'Main subject' }],
        themes: [{ theme: 'Digital transformation', frequency: 'primary' }],
        metrics: [{ value: '50%', context: 'growth rate' }],
        recommendations: [{ recommendation: 'Implement solution X', priority: 'high' }],
        quotes: [{ quote: 'Important quote here', speaker: 'CEO' }]
      };
      
      callGeminiForJson.mockResolvedValue(mockResponse);
      
      const chunk = {
        content: 'Sample research content about digital transformation.',
        sourceFiles: ['research.pdf'],
        chunkId: 1
      };
      
      const result = await extractInsights(chunk, 3);
      
      expect(result.insights.keyFacts).toHaveLength(1);
      expect(result.insights.themes).toHaveLength(1);
      expect(result.chunkId).toBe(1);
      expect(callGeminiForJson).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      callGeminiForJson.mockRejectedValue(new Error('API rate limit'));
      
      const chunk = { content: 'Test content', chunkId: 1 };
      const result = await extractInsights(chunk, 1);
      
      expect(result.metadata.error).toBeDefined();
      expect(result.insights.keyFacts).toEqual([]);
    });

    it('should include metadata in result', async () => {
      callGeminiForJson.mockResolvedValue({
        keyFacts: [],
        dates: [],
        entities: [],
        themes: [],
        metrics: [],
        recommendations: [],
        quotes: []
      });
      
      const chunk = { 
        content: 'Test content here', 
        chunkId: 2,
        sourceFiles: ['test.pdf']
      };
      
      const result = await extractInsights(chunk, 5);
      
      expect(result.chunkId).toBe(2);
      expect(result.sourceFiles).toContain('test.pdf');
      expect(result.metadata.charCount).toBe(17);
    });
  });

  describe('processChunksParallel', () => {
    it('should process multiple chunks in parallel', async () => {
      callGeminiForJson.mockResolvedValue({
        keyFacts: [{ fact: 'Fact', importance: 'high' }],
        dates: [],
        entities: [],
        themes: [{ theme: 'Theme', frequency: 'primary' }],
        metrics: [],
        recommendations: [],
        quotes: []
      });
      
      const chunks = [
        { content: 'Chunk 1', chunkId: 1, sourceFiles: [] },
        { content: 'Chunk 2', chunkId: 2, sourceFiles: [] },
        { content: 'Chunk 3', chunkId: 3, sourceFiles: [] }
      ];
      
      const results = await processChunksParallel(chunks);
      
      expect(results).toHaveLength(3);
      expect(callGeminiForJson).toHaveBeenCalledTimes(3);
    });

    it('should call progress callback', async () => {
      callGeminiForJson.mockResolvedValue({
        keyFacts: [],
        dates: [],
        entities: [],
        themes: [],
        metrics: [],
        recommendations: [],
        quotes: []
      });
      
      const progressCallback = jest.fn();
      const chunks = [
        { content: 'Chunk 1', chunkId: 1, sourceFiles: [] },
        { content: 'Chunk 2', chunkId: 2, sourceFiles: [] }
      ];
      
      await processChunksParallel(chunks, progressCallback);
      
      expect(progressCallback).toHaveBeenCalled();
      // Should have been called with extraction progress
      const calls = progressCallback.mock.calls;
      expect(calls.some(c => c[0].phase === 'extraction')).toBe(true);
    });

    it('should continue processing even if some chunks fail', async () => {
      // Reset any cache state
      let callCount = 0;
      callGeminiForJson.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Chunk 2 failed');
        }
        return {
          keyFacts: [{ fact: `Success ${callCount}`, importance: 'high' }],
          dates: [],
          entities: [],
          themes: [],
          metrics: [],
          recommendations: [],
          quotes: []
        };
      });
      
      // Use unique content to avoid cache hits
      const uniqueId = Date.now();
      const chunks = [
        { content: `Chunk 1 unique ${uniqueId}`, chunkId: 1, sourceFiles: [] },
        { content: `Chunk 2 unique ${uniqueId}`, chunkId: 2, sourceFiles: [] },
        { content: `Chunk 3 unique ${uniqueId}`, chunkId: 3, sourceFiles: [] }
      ];
      
      const results = await processChunksParallel(chunks);
      
      expect(results).toHaveLength(3);
      // One should have an error - check that the error was properly recorded
      const failedResults = results.filter(r => r.metadata?.error);
      expect(failedResults.length).toBe(1);
      expect(failedResults[0].metadata.error).toContain('Chunk 2 failed');
    });

    it('should handle empty chunks array', async () => {
      const results = await processChunksParallel([]);
      expect(results).toEqual([]);
    });
  });

  describe('getExtractionStats', () => {
    it('should calculate correct statistics', () => {
      const results = [
        {
          chunkId: 1,
          insights: {
            keyFacts: [{ fact: 'F1' }, { fact: 'F2' }],
            dates: [{ date: '2024' }],
            entities: [{ name: 'E1' }],
            themes: [{ theme: 'T1' }, { theme: 'T2' }],
            metrics: [],
            recommendations: [{ recommendation: 'R1' }],
            quotes: []
          },
          metadata: { extractionTime: 100 }
        },
        {
          chunkId: 2,
          insights: {
            keyFacts: [{ fact: 'F3' }],
            dates: [],
            entities: [{ name: 'E2' }, { name: 'E3' }],
            themes: [],
            metrics: [{ value: '50%' }],
            recommendations: [],
            quotes: [{ quote: 'Q1' }]
          },
          metadata: { extractionTime: 150 }
        }
      ];
      
      const stats = getExtractionStats(results);
      
      expect(stats.totalChunks).toBe(2);
      expect(stats.successfulExtractions).toBe(2);
      expect(stats.totalKeyFacts).toBe(3);
      expect(stats.totalDates).toBe(1);
      expect(stats.totalEntities).toBe(3);
      expect(stats.totalThemes).toBe(2);
      expect(stats.totalMetrics).toBe(1);
      expect(stats.totalRecommendations).toBe(1);
      expect(stats.totalQuotes).toBe(1);
      expect(stats.totalExtractionTime).toBe(250);
    });

    it('should track failed extractions', () => {
      const results = [
        {
          chunkId: 1,
          insights: { keyFacts: [] },
          metadata: { error: 'API failed' }
        },
        {
          chunkId: 2,
          insights: { keyFacts: [{ fact: 'F1' }] },
          metadata: { extractionTime: 100 }
        }
      ];
      
      const stats = getExtractionStats(results);
      
      expect(stats.failedExtractions).toBe(1);
      expect(stats.successfulExtractions).toBe(1);
    });
  });

  describe('insightExtractionSchema', () => {
    it('should have all required fields', () => {
      expect(insightExtractionSchema.properties.keyFacts).toBeDefined();
      expect(insightExtractionSchema.properties.dates).toBeDefined();
      expect(insightExtractionSchema.properties.entities).toBeDefined();
      expect(insightExtractionSchema.properties.themes).toBeDefined();
      expect(insightExtractionSchema.properties.metrics).toBeDefined();
      expect(insightExtractionSchema.properties.recommendations).toBeDefined();
      expect(insightExtractionSchema.properties.quotes).toBeDefined();
    });
  });
});
