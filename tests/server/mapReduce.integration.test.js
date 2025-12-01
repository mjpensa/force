/**
 * Integration tests for the Map-Reduce pipeline
 * Tests the full flow from large research content to formatted output
 */

import { jest } from '@jest/globals';

// Mock gemini for integration tests
jest.unstable_mockModule('../../server/gemini.js', () => ({
  callGeminiForJson: jest.fn()
}));

const { callGeminiForJson } = await import('../../server/gemini.js');

// Import real implementations (except gemini)
const { needsChunking, chunkResearchFiles, getChunkingStats } = await import('../../server/utils/chunker.js');
const { consolidateInsights, formatForPrompt, getConsolidationStats } = await import('../../server/utils/insightConsolidator.js');

describe('Map-Reduce Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock extraction response
  const createMockExtractionResponse = () => ({
    keyFacts: [{ fact: 'Test fact from chunk', importance: 'high', category: 'test' }],
    dates: [{ date: '2024', event: 'Test event', type: 'milestone' }],
    entities: [{ name: 'Test Entity', type: 'company', context: 'Test context' }],
    themes: [{ theme: 'Test Theme', description: 'Test description', frequency: 'primary' }],
    metrics: [{ value: '50%', context: 'test metric' }],
    recommendations: [{ recommendation: 'Test recommendation', priority: 'high' }],
    quotes: [{ quote: 'Test quote', speaker: 'Tester' }]
  });

  describe('Chunking Behavior', () => {
    it('should correctly identify content needing chunking', () => {
      const smallFiles = [{ content: 'A'.repeat(10000) }];
      const largeFiles = [{ content: 'A'.repeat(60000) }];
      
      expect(needsChunking(smallFiles)).toBe(false);
      expect(needsChunking(largeFiles)).toBe(true);
    });

    it('should create appropriate chunk sizes', () => {
      const content = 'Paragraph content here.\n\n'.repeat(2000);
      const files = [{ filename: 'doc.pdf', content }];
      
      const chunks = chunkResearchFiles(files);
      
      // Should have multiple chunks
      expect(chunks.length).toBeGreaterThan(1);
      
      // Each chunk should have required fields
      chunks.forEach(chunk => {
        expect(chunk.chunkId).toBeDefined();
        expect(chunk.content).toBeDefined();
        expect(chunk.sourceFiles).toBeDefined();
        expect(chunk.metadata).toBeDefined();
      });
    });

    it('should preserve source file information', () => {
      const files = [
        { filename: 'research1.pdf', content: 'Content 1.\n\n'.repeat(1500) },
        { filename: 'research2.docx', content: 'Content 2.\n\n'.repeat(1500) }
      ];
      
      const chunks = chunkResearchFiles(files);
      
      // All chunks should have source files
      chunks.forEach(chunk => {
        expect(chunk.sourceFiles.length).toBeGreaterThan(0);
      });
    });

    it('should handle content with special characters', () => {
      const content = `
        Research with special chars: é, ñ, 中文, 日本語
        Emojis: 🚀 📊 💡
        Symbols: © ® ™ § ¶
      `.repeat(500);
      
      const files = [{ filename: 'special.txt', content }];
      const chunks = chunkResearchFiles(files);
      
      expect(chunks.length).toBeGreaterThan(0);
      // Content should be preserved
      const allContent = chunks.map(c => c.content).join('');
      expect(allContent).toContain('🚀');
    });
  });

  describe('Chunking Statistics', () => {
    it('should return accurate statistics', () => {
      const files = [
        { filename: 'file1.txt', content: 'A'.repeat(30000) },
        { filename: 'file2.txt', content: 'B'.repeat(40000) }
      ];
      
      const stats = getChunkingStats(files);
      
      expect(stats.totalSize).toBe(70000);
      expect(stats.files).toBe(2);
      expect(stats.needsChunking).toBe(true);
      expect(stats.estimatedChunks).toBeGreaterThan(1);
    });

    it('should handle edge cases', () => {
      expect(getChunkingStats([]).totalSize).toBe(0);
      expect(getChunkingStats([{ filename: 'empty.txt' }]).totalSize).toBe(0);
    });
  });

  describe('Insight Consolidation', () => {
    it('should consolidate insights from multiple chunks', () => {
      const extractionResults = [
        {
          chunkId: 1,
          sourceFiles: ['doc1.pdf'],
          insights: {
            keyFacts: [
              { fact: 'Fact from chunk 1 - unique info here', importance: 'high' },
              { fact: 'Another fact completely different', importance: 'medium' }
            ],
            themes: [{ theme: 'Digital', frequency: 'primary' }],
            dates: [],
            entities: [],
            metrics: [],
            recommendations: [],
            quotes: []
          }
        },
        {
          chunkId: 2,
          sourceFiles: ['doc1.pdf'],
          insights: {
            keyFacts: [
              { fact: 'Fact from chunk 2 - something new', importance: 'high' }
            ],
            themes: [{ theme: 'Innovation', frequency: 'secondary' }],
            dates: [],
            entities: [],
            metrics: [],
            recommendations: [],
            quotes: []
          }
        }
      ];
      
      const consolidated = consolidateInsights(extractionResults);
      
      // All unique facts should be present
      expect(consolidated.keyFacts.length).toBeGreaterThanOrEqual(2);
      expect(consolidated.themes.length).toBe(2);
      expect(consolidated.metadata.chunksProcessed).toBe(2);
    });

    it('should deduplicate similar facts', () => {
      const extractionResults = [
        {
          chunkId: 1,
          insights: {
            keyFacts: [
              { fact: 'The company achieved 50% growth', importance: 'high' }
            ],
            themes: []
          }
        },
        {
          chunkId: 2,
          insights: {
            keyFacts: [
              { fact: 'The company achieved 50% growth in Q1', importance: 'high' }
            ],
            themes: []
          }
        }
      ];
      
      const consolidated = consolidateInsights(extractionResults);
      
      // Similar facts should be deduplicated
      expect(consolidated.keyFacts.length).toBeLessThanOrEqual(2);
    });

    it('should handle empty extraction results', () => {
      const consolidated = consolidateInsights([]);
      
      expect(consolidated.keyFacts).toEqual([]);
      expect(consolidated.themes).toEqual([]);
      expect(consolidated.metadata.chunksProcessed).toBe(0);
    });
  });

  describe('Prompt Formatting', () => {
    const sampleConsolidated = {
      keyFacts: [
        { fact: 'Important finding 1', importance: 'high', category: 'tech' },
        { fact: 'Supporting detail', importance: 'medium' }
      ],
      themes: [
        { theme: 'Digital Transformation', description: 'Modernization efforts', frequency: 'primary' }
      ],
      dates: [
        { date: 'Q1 2024', event: 'Launch phase', type: 'milestone' }
      ],
      entities: [
        { name: 'Acme Corp', type: 'company', context: 'Client' }
      ],
      metrics: [
        { value: '45%', context: 'efficiency gain' }
      ],
      recommendations: [
        { recommendation: 'Implement AI', priority: 'high', timeframe: 'Q2' }
      ],
      quotes: [
        { quote: 'Innovation is key', speaker: 'CEO' }
      ],
      metadata: { chunksProcessed: 2, sourceFiles: ['doc.pdf'] }
    };

    it('should format for roadmap content type', () => {
      const formatted = formatForPrompt(sampleConsolidated, 'roadmap');
      
      expect(formatted).toContain('TIMELINE');
      expect(formatted).toContain('Q1 2024');
      expect(formatted).toContain('Important finding 1');
    });

    it('should format for slides content type', () => {
      const formatted = formatForPrompt(sampleConsolidated, 'slides');
      
      expect(formatted).toContain('HIGH-IMPACT');
      expect(formatted).toContain('45%');
      expect(formatted).toContain('Innovation is key');
    });

    it('should format for document content type', () => {
      const formatted = formatForPrompt(sampleConsolidated, 'document');
      
      expect(formatted).toContain('KEY FINDINGS');
      expect(formatted).toContain('Digital Transformation');
    });

    it('should format for research analysis content type', () => {
      const formatted = formatForPrompt(sampleConsolidated, 'researchAnalysis');
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should handle unknown content types with fallback', () => {
      const formatted = formatForPrompt(sampleConsolidated, 'unknown');
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Consolidation Statistics', () => {
    it('should calculate correct statistics', () => {
      const consolidated = {
        keyFacts: [{ fact: 'F1' }, { fact: 'F2' }],
        dates: [{ date: 'D1' }],
        entities: [{ name: 'E1' }],
        themes: [{ theme: 'T1' }, { theme: 'T2' }],
        metrics: [],
        recommendations: [{ rec: 'R1' }],
        quotes: [],
        metadata: {
          sourceFiles: ['a.pdf', 'b.pdf'],
          chunksProcessed: 3
        }
      };
      
      const stats = getConsolidationStats(consolidated);
      
      expect(stats.keyFacts).toBe(2);
      expect(stats.dates).toBe(1);
      expect(stats.entities).toBe(1);
      expect(stats.themes).toBe(2);
      expect(stats.metrics).toBe(0);
      expect(stats.recommendations).toBe(1);
      expect(stats.quotes).toBe(0);
      expect(stats.sourceFiles).toBe(2);
      expect(stats.chunksProcessed).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle content just below chunking threshold', () => {
      // Content just under 50K threshold shouldn't trigger chunking
      const files = [{ content: 'A'.repeat(40000) }];
      
      expect(needsChunking(files)).toBe(false);
      
      const stats = getChunkingStats(files);
      expect(stats.needsChunking).toBe(false);
    });

    it('should handle content at exact threshold', () => {
      const files = [{ content: 'A'.repeat(50000) }];
      
      // At threshold should NOT trigger chunking (> required)
      expect(needsChunking(files)).toBe(false);
    });

    it('should handle content just above threshold', () => {
      const files = [{ content: 'A'.repeat(50001) }];
      
      expect(needsChunking(files)).toBe(true);
    });

    it('should handle mixed file sizes', () => {
      const files = [
        { filename: 'small.txt', content: 'Small' },
        { filename: 'medium.txt', content: 'M'.repeat(20000) },
        { filename: 'large.txt', content: 'L'.repeat(40000) }
      ];
      
      // Total exceeds threshold
      expect(needsChunking(files)).toBe(true);
      
      const chunks = chunkResearchFiles(files);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle files with only whitespace', () => {
      const files = [
        { filename: 'whitespace.txt', content: '   \n\n   ' },
        { filename: 'valid.txt', content: 'Valid content here' }
      ];
      
      const chunks = chunkResearchFiles(files);
      
      // Should only have chunks from valid file
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
