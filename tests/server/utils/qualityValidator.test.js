/**
 * Quality Validator Tests
 * 
 * Tests for Phase 5 validation of map-reduce output quality.
 */

import { jest } from '@jest/globals';

// Mock the dependent modules
jest.unstable_mockModule('../../../server/utils/chunker.js', () => ({
  chunkResearchFiles: jest.fn(),
  getChunkingStats: jest.fn()
}));

jest.unstable_mockModule('../../../server/utils/insightExtractor.js', () => ({
  processChunksParallel: jest.fn()
}));

jest.unstable_mockModule('../../../server/utils/insightConsolidator.js', () => ({
  consolidateInsights: jest.fn()
}));

// Import after mocking
const { chunkResearchFiles, getChunkingStats } = await import('../../../server/utils/chunker.js');
const { processChunksParallel } = await import('../../../server/utils/insightExtractor.js');
const { consolidateInsights } = await import('../../../server/utils/insightConsolidator.js');

const {
  validateMapReduceQuality,
  quickValidate,
  compareApproaches,
  calculateTextSimilarity,
  VALIDATION_CONFIG
} = await import('../../../server/utils/qualityValidator.js');

describe('Quality Validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTextSimilarity', () => {
    test('returns 1 for identical strings', () => {
      const similarity = calculateTextSimilarity('hello world', 'hello world');
      expect(similarity).toBe(1);
    });

    test('returns high similarity for similar strings', () => {
      const similarity = calculateTextSimilarity(
        'The company reported strong growth',
        'The company showed strong growth'
      );
      expect(similarity).toBeGreaterThan(0.6);  // 4/6 words match = 0.67
    });

    test('returns low similarity for different strings', () => {
      const similarity = calculateTextSimilarity(
        'AI transforms business operations',
        'The weather is nice today'
      );
      expect(similarity).toBeLessThan(0.3);
    });

    test('handles empty strings', () => {
      expect(calculateTextSimilarity('', 'test')).toBe(0);
      expect(calculateTextSimilarity('test', '')).toBe(0);
      expect(calculateTextSimilarity('', '')).toBe(0);
    });

    test('handles null/undefined', () => {
      expect(calculateTextSimilarity(null, 'test')).toBe(0);
      expect(calculateTextSimilarity('test', null)).toBe(0);
      expect(calculateTextSimilarity(undefined, undefined)).toBe(0);
    });

    test('is case insensitive', () => {
      const similarity = calculateTextSimilarity('Hello World', 'hello world');
      expect(similarity).toBe(1);
    });

    test('ignores punctuation', () => {
      const similarity = calculateTextSimilarity(
        'Hello, World!',
        'Hello World'
      );
      expect(similarity).toBe(1);
    });
  });

  describe('validateMapReduceQuality', () => {
    const mockResearchFiles = [
      {
        filename: 'research.txt',
        content: `
          The key strategic initiative focuses on digital transformation.
          Microsoft reported 15% revenue growth in Q3 2024.
          The company should implement AI-driven automation.
          Important: Customer experience improvements are essential.
          Google and Amazon are major competitors in the market.
          The growth strategy targets 20% market expansion.
        `
      }
    ];

    beforeEach(() => {
      // Setup default mocks
      chunkResearchFiles.mockReturnValue([
        { chunkId: 1, content: mockResearchFiles[0].content, sourceFiles: ['research.txt'] }
      ]);

      processChunksParallel.mockResolvedValue([
        {
          chunkId: 1,
          insights: {
            keyFacts: [
              { fact: 'Digital transformation is the key strategic initiative', importance: 'high' },
              { fact: 'Microsoft reported 15% revenue growth in Q3 2024', importance: 'high' },
              { fact: 'AI-driven automation should be implemented', importance: 'medium' },
              { fact: 'Customer experience improvements are essential', importance: 'high' },
              { fact: 'Growth strategy targets 20% market expansion', importance: 'high' }
            ],
            entities: [
              { name: 'Microsoft', type: 'company' },
              { name: 'Google', type: 'company' },
              { name: 'Amazon', type: 'company' }
            ],
            themes: [
              { theme: 'digital transformation', frequency: 'primary' },
              { theme: 'AI automation', frequency: 'secondary' },
              { theme: 'customer experience', frequency: 'secondary' },
              { theme: 'growth strategy', frequency: 'primary' }
            ],
            dates: [],
            metrics: [{ value: '15%', context: 'revenue growth' }],
            recommendations: [],
            quotes: []
          }
        }
      ]);

      consolidateInsights.mockReturnValue({
        keyFacts: [
          { fact: 'Digital transformation is the key strategic initiative', importance: 'high' },
          { fact: 'Microsoft reported 15% revenue growth in Q3 2024', importance: 'high' },
          { fact: 'AI-driven automation should be implemented', importance: 'medium' },
          { fact: 'Customer experience improvements are essential', importance: 'high' },
          { fact: 'Growth strategy targets 20% market expansion', importance: 'high' }
        ],
        entities: [
          { name: 'Microsoft', type: 'company' },
          { name: 'Google', type: 'company' },
          { name: 'Amazon', type: 'company' }
        ],
        themes: [
          { theme: 'digital transformation', frequency: 'primary' },
          { theme: 'AI automation', frequency: 'secondary' },
          { theme: 'customer experience', frequency: 'secondary' },
          { theme: 'growth strategy', frequency: 'primary' }
        ],
        dates: [],
        metrics: [{ value: '15%', context: 'revenue growth' }],
        recommendations: [],
        quotes: []
      });
    });

    test('returns validation results with quality score', async () => {
      const result = await validateMapReduceQuality(mockResearchFiles);
      
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('mapReduceStats');
      expect(result).toHaveProperty('timing');
    });

    test('includes coverage details for facts, entities, themes', async () => {
      const result = await validateMapReduceQuality(mockResearchFiles);
      
      expect(result.details).toHaveProperty('facts');
      expect(result.details).toHaveProperty('entities');
      expect(result.details).toHaveProperty('themes');
      
      expect(result.details.facts).toHaveProperty('coverage');
      expect(result.details.facts).toHaveProperty('threshold');
      expect(result.details.facts).toHaveProperty('matched');
      expect(result.details.facts).toHaveProperty('total');
    });

    test('includes map-reduce statistics', async () => {
      const result = await validateMapReduceQuality(mockResearchFiles);
      
      expect(result.mapReduceStats).toHaveProperty('chunksProcessed');
      expect(result.mapReduceStats).toHaveProperty('totalKeyFacts');
      expect(result.mapReduceStats).toHaveProperty('totalEntities');
      expect(result.mapReduceStats).toHaveProperty('totalThemes');
    });

    test('calls chunker and extractor', async () => {
      await validateMapReduceQuality(mockResearchFiles);
      
      expect(chunkResearchFiles).toHaveBeenCalledWith(mockResearchFiles);
      expect(processChunksParallel).toHaveBeenCalled();
      expect(consolidateInsights).toHaveBeenCalled();
    });
  });

  describe('quickValidate', () => {
    test('returns true for passing validation', async () => {
      chunkResearchFiles.mockReturnValue([{ chunkId: 1, content: 'test' }]);
      processChunksParallel.mockResolvedValue([{
        insights: {
          keyFacts: [{ fact: 'test', importance: 'high' }],
          entities: [],
          themes: [{ theme: 'test', frequency: 'primary' }],
          dates: [],
          metrics: [],
          recommendations: [],
          quotes: []
        }
      }]);
      consolidateInsights.mockReturnValue({
        keyFacts: [{ fact: 'test', importance: 'high' }],
        entities: [],
        themes: [{ theme: 'test', frequency: 'primary' }],
        dates: [],
        metrics: [],
        recommendations: [],
        quotes: []
      });

      const result = await quickValidate([{ filename: 'test.txt', content: 'Simple test content.' }]);
      
      expect(typeof result).toBe('boolean');
    });

    test('returns false on error', async () => {
      chunkResearchFiles.mockImplementation(() => {
        throw new Error('Chunking failed');
      });

      const result = await quickValidate([{ filename: 'test.txt', content: 'test' }]);
      
      expect(result).toBe(false);
    });
  });

  describe('compareApproaches', () => {
    test('returns not_applicable for small content', async () => {
      getChunkingStats.mockReturnValue({
        needsChunking: false,
        totalSize: 10000
      });

      const result = await compareApproaches([
        { filename: 'small.txt', content: 'Small content' }
      ]);

      expect(result.comparison).toBe('not_applicable');
      expect(result.reason).toContain('below chunking threshold');
    });

    test('runs validation for large content', async () => {
      getChunkingStats.mockReturnValue({
        needsChunking: true,
        totalSize: 60000
      });

      chunkResearchFiles.mockReturnValue([
        { chunkId: 1, content: 'chunk 1' },
        { chunkId: 2, content: 'chunk 2' }
      ]);

      processChunksParallel.mockResolvedValue([
        { insights: { keyFacts: [], entities: [], themes: [], dates: [], metrics: [], recommendations: [], quotes: [] } }
      ]);

      consolidateInsights.mockReturnValue({
        keyFacts: [],
        entities: [],
        themes: [],
        dates: [],
        metrics: [],
        recommendations: [],
        quotes: []
      });

      const result = await compareApproaches([
        { filename: 'large.txt', content: 'x'.repeat(60000) }
      ]);

      expect(['map_reduce_adequate', 'quality_concerns']).toContain(result.comparison);
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('recommendation');
    });
  });

  describe('VALIDATION_CONFIG', () => {
    test('has required thresholds', () => {
      expect(VALIDATION_CONFIG).toHaveProperty('minFactCoverage');
      expect(VALIDATION_CONFIG).toHaveProperty('minEntityCoverage');
      expect(VALIDATION_CONFIG).toHaveProperty('minThemeCoverage');
      expect(VALIDATION_CONFIG).toHaveProperty('factSimilarityThreshold');
    });

    test('has weights for scoring', () => {
      expect(VALIDATION_CONFIG.weights).toHaveProperty('factCoverage');
      expect(VALIDATION_CONFIG.weights).toHaveProperty('entityCoverage');
      expect(VALIDATION_CONFIG.weights).toHaveProperty('themeCoverage');
    });

    test('thresholds are between 0 and 1', () => {
      expect(VALIDATION_CONFIG.minFactCoverage).toBeGreaterThan(0);
      expect(VALIDATION_CONFIG.minFactCoverage).toBeLessThanOrEqual(1);
      expect(VALIDATION_CONFIG.minEntityCoverage).toBeGreaterThan(0);
      expect(VALIDATION_CONFIG.minEntityCoverage).toBeLessThanOrEqual(1);
      expect(VALIDATION_CONFIG.minThemeCoverage).toBeGreaterThan(0);
      expect(VALIDATION_CONFIG.minThemeCoverage).toBeLessThanOrEqual(1);
    });
  });
});
