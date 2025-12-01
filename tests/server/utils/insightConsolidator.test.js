/**
 * Unit tests for the insight consolidator utility
 * Tests merging, deduplication, and formatting of insights
 */

import { jest } from '@jest/globals';
import {
  consolidateInsights,
  formatForPrompt,
  formatForRoadmap,
  formatForSlides,
  formatForDocument,
  getConsolidationStats
} from '../../../server/utils/insightConsolidator.js';

describe('Insight Consolidator', () => {
  describe('consolidateInsights', () => {
    it('should merge insights from multiple extraction results', () => {
      const extractionResults = [
        {
          chunkId: 1,
          sourceFiles: ['doc1.pdf'],
          insights: {
            keyFacts: [
              { fact: 'Fact A', importance: 'high', category: 'tech' },
              { fact: 'Fact B', importance: 'medium' }
            ],
            themes: [{ theme: 'Theme 1', frequency: 'primary' }],
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
              { fact: 'Fact C', importance: 'high' },
              { fact: 'Fact A', importance: 'high' } // Duplicate
            ],
            themes: [{ theme: 'Theme 2', frequency: 'secondary' }],
            dates: [],
            entities: [],
            metrics: [],
            recommendations: [],
            quotes: []
          }
        }
      ];
      
      const result = consolidateInsights(extractionResults);
      
      // Should deduplicate
      expect(result.keyFacts.length).toBeLessThan(4);
      expect(result.themes.length).toBe(2);
      expect(result.metadata.chunksProcessed).toBe(2);
    });

    it('should track source files in metadata', () => {
      const extractionResults = [
        {
          chunkId: 1,
          sourceFiles: ['doc1.pdf', 'doc2.pdf'],
          insights: { keyFacts: [{ fact: 'F1', importance: 'high' }], themes: [] }
        },
        {
          chunkId: 2,
          sourceFiles: ['doc3.pdf'],
          insights: { keyFacts: [], themes: [] }
        }
      ];
      
      const result = consolidateInsights(extractionResults);
      
      expect(result.metadata.sourceFiles).toContain('doc1.pdf');
      expect(result.metadata.sourceFiles).toContain('doc2.pdf');
      expect(result.metadata.sourceFiles).toContain('doc3.pdf');
    });

    it('should handle empty extraction results', () => {
      const result = consolidateInsights([]);
      
      expect(result.keyFacts).toEqual([]);
      expect(result.themes).toEqual([]);
      expect(result.metadata.chunksProcessed).toBe(0);
    });

    it('should handle extraction errors in results', () => {
      const extractionResults = [
        {
          chunkId: 1,
          insights: { keyFacts: [{ fact: 'Valid fact', importance: 'high' }], themes: [] }
        },
        {
          chunkId: 2,
          metadata: { error: 'API failed' },
          insights: { keyFacts: [], themes: [] }
        },
        {
          chunkId: 3,
          insights: { keyFacts: [{ fact: 'Another fact', importance: 'medium' }], themes: [{ theme: 'Theme', frequency: 'primary' }] }
        }
      ];
      
      const result = consolidateInsights(extractionResults);
      
      expect(result.keyFacts.length).toBe(2);
      expect(result.themes.length).toBe(1);
    });

    it('should sort key facts by importance', () => {
      const extractionResults = [
        {
          chunkId: 1,
          insights: {
            keyFacts: [
              { fact: 'Low importance fact here', importance: 'low' },
              { fact: 'High importance fact here', importance: 'high' },
              { fact: 'Medium importance fact here', importance: 'medium' }
            ],
            themes: []
          }
        }
      ];
      
      const result = consolidateInsights(extractionResults);
      
      // Find high and low facts - should be sorted
      const highFactIndex = result.keyFacts.findIndex(f => f.importance === 'high');
      const lowFactIndex = result.keyFacts.findIndex(f => f.importance === 'low');
      
      // High importance should come before low importance
      expect(highFactIndex).toBeLessThan(lowFactIndex);
    });

    it('should consolidate entities by name and count mentions', () => {
      const extractionResults = [
        {
          chunkId: 1,
          insights: {
            keyFacts: [],
            themes: [],
            entities: [
              { name: 'Acme Corp', type: 'company', context: 'Brief context' },
              { name: 'TechGiant', type: 'company' }
            ]
          }
        },
        {
          chunkId: 2,
          insights: {
            keyFacts: [],
            themes: [],
            entities: [
              { name: 'Acme Corp', type: 'company', context: 'More detailed context here' },
              { name: 'John Smith', type: 'person' }
            ]
          }
        }
      ];
      
      const result = consolidateInsights(extractionResults);
      
      // Should have 3 unique entities
      expect(result.entities.length).toBe(3);
      
      // Acme Corp should have 2 mentions and better context
      const acme = result.entities.find(e => e.name === 'Acme Corp');
      expect(acme.mentions).toBe(2);
      expect(acme.context).toBe('More detailed context here');
    });

    it('should upgrade theme frequency to primary if mentioned as primary in any chunk', () => {
      const extractionResults = [
        {
          chunkId: 1,
          insights: {
            keyFacts: [],
            themes: [{ theme: 'AI', frequency: 'secondary' }]
          }
        },
        {
          chunkId: 2,
          insights: {
            keyFacts: [],
            themes: [{ theme: 'AI', frequency: 'primary' }]
          }
        }
      ];
      
      const result = consolidateInsights(extractionResults);
      
      const aiTheme = result.themes.find(t => t.theme === 'AI');
      expect(aiTheme.frequency).toBe('primary');
    });
  });

  describe('formatForPrompt', () => {
    const sampleInsights = {
      keyFacts: [
        { fact: 'Important fact 1', importance: 'high', category: 'tech' },
        { fact: 'Important fact 2', importance: 'medium' }
      ],
      themes: [
        { theme: 'Digital transformation', description: 'Modernizing operations', frequency: 'primary' },
        { theme: 'Innovation', frequency: 'secondary' }
      ],
      metrics: [
        { value: '50%', context: 'improvement rate', trend: 'increasing' },
        { value: '100', context: 'users' }
      ],
      recommendations: [
        { recommendation: 'Implement AI', priority: 'critical', timeframe: 'Q1' },
        { recommendation: 'Train staff', priority: 'high' }
      ],
      quotes: [{ quote: 'This is key', speaker: 'CEO' }],
      dates: [{ date: 'Q1 2024', event: 'Launch', type: 'milestone' }],
      entities: [{ name: 'Acme Corp', type: 'company', context: 'Main client' }],
      metadata: { chunksProcessed: 2, sourceFiles: ['doc.pdf'] }
    };

    it('should format for roadmap content type', () => {
      const formatted = formatForPrompt(sampleInsights, 'roadmap');
      
      expect(formatted).toContain('Important fact 1');
      expect(formatted).toContain('Q1 2024');
      expect(formatted).toContain('Digital transformation');
      expect(typeof formatted).toBe('string');
    });

    it('should format for slides content type', () => {
      const formatted = formatForPrompt(sampleInsights, 'slides');
      
      expect(formatted).toContain('HIGH-IMPACT');
      expect(formatted).toContain('50%');
      expect(formatted).toContain('This is key');
    });

    it('should format for document content type', () => {
      const formatted = formatForPrompt(sampleInsights, 'document');
      
      expect(formatted).toContain('KEY FINDINGS');
      expect(formatted).toContain('TIMELINE');
    });

    it('should format for research analysis content type', () => {
      const formatted = formatForPrompt(sampleInsights, 'researchAnalysis');
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should handle unknown content type with fallback', () => {
      const formatted = formatForPrompt(sampleInsights, 'unknown-type');
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should handle empty insights', () => {
      const emptyInsights = {
        keyFacts: [],
        themes: [],
        metrics: [],
        recommendations: [],
        quotes: [],
        dates: [],
        entities: [],
        metadata: {}
      };
      
      const formatted = formatForPrompt(emptyInsights, 'slides');
      
      expect(typeof formatted).toBe('string');
    });
  });

  describe('formatForRoadmap', () => {
    it('should emphasize dates and milestones', () => {
      const insights = {
        dates: [
          { date: 'Q1 2024', event: 'Phase 1 Launch', type: 'milestone' },
          { date: 'Q2 2024', event: 'Feature Release', type: 'target' }
        ],
        keyFacts: [{ fact: 'Test fact', importance: 'high' }],
        themes: [],
        recommendations: [],
        entities: []
      };
      
      const formatted = formatForRoadmap(insights);
      
      expect(formatted).toContain('TIMELINE & MILESTONES');
      expect(formatted).toContain('Q1 2024');
      expect(formatted).toContain('Phase 1 Launch');
      expect(formatted).toContain('[milestone]');
    });

    it('should include recommendations with timeframes', () => {
      const insights = {
        dates: [],
        keyFacts: [],
        themes: [],
        recommendations: [
          { recommendation: 'Start migration', priority: 'high', timeframe: 'Q1' }
        ],
        entities: []
      };
      
      const formatted = formatForRoadmap(insights);
      
      expect(formatted).toContain('RECOMMENDATIONS');
      expect(formatted).toContain('(Q1)');
    });
  });

  describe('formatForSlides', () => {
    it('should separate high-impact from supporting facts', () => {
      const insights = {
        keyFacts: [
          { fact: 'High impact finding', importance: 'high' },
          { fact: 'Supporting detail', importance: 'medium' }
        ],
        themes: [],
        metrics: [],
        quotes: []
      };
      
      const formatted = formatForSlides(insights);
      
      expect(formatted).toContain('HIGH-IMPACT FINDINGS');
      expect(formatted).toContain('SUPPORTING FACTS');
    });

    it('should include notable quotes', () => {
      const insights = {
        keyFacts: [],
        themes: [],
        metrics: [],
        quotes: [
          { quote: 'The future is digital', speaker: 'CEO' }
        ]
      };
      
      const formatted = formatForSlides(insights);
      
      expect(formatted).toContain('NOTABLE QUOTES');
      expect(formatted).toContain('The future is digital');
      expect(formatted).toContain('CEO');
    });
  });

  describe('getConsolidationStats', () => {
    it('should return correct statistics', () => {
      const consolidated = {
        keyFacts: [{ fact: 'F1' }, { fact: 'F2' }],
        dates: [{ date: 'D1' }],
        entities: [{ name: 'E1' }, { name: 'E2' }, { name: 'E3' }],
        themes: [{ theme: 'T1' }],
        metrics: [],
        recommendations: [{ recommendation: 'R1' }],
        quotes: [{ quote: 'Q1' }, { quote: 'Q2' }],
        metadata: {
          sourceFiles: ['a.pdf', 'b.pdf'],
          chunksProcessed: 5
        }
      };
      
      const stats = getConsolidationStats(consolidated);
      
      expect(stats.keyFacts).toBe(2);
      expect(stats.dates).toBe(1);
      expect(stats.entities).toBe(3);
      expect(stats.themes).toBe(1);
      expect(stats.metrics).toBe(0);
      expect(stats.recommendations).toBe(1);
      expect(stats.quotes).toBe(2);
      expect(stats.sourceFiles).toBe(2);
      expect(stats.chunksProcessed).toBe(5);
    });

    it('should handle missing fields', () => {
      const consolidated = {
        keyFacts: [{ fact: 'F1' }]
      };
      
      const stats = getConsolidationStats(consolidated);
      
      expect(stats.keyFacts).toBe(1);
      expect(stats.dates).toBe(0);
      expect(stats.sourceFiles).toBe(0);
    });
  });
});
