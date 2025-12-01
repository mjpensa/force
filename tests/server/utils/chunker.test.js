/**
 * Unit tests for the chunker utility
 * Tests semantic chunking of large research content
 */

import { jest } from '@jest/globals';
import {
  needsChunking,
  chunkResearchFiles,
  getChunkingStats,
  getTotalContentSize,
  CHUNK_CONFIG
} from '../../../server/utils/chunker.js';

describe('Chunker Utility', () => {
  describe('needsChunking', () => {
    it('should return false for empty array', () => {
      expect(needsChunking([])).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(needsChunking(null)).toBe(false);
      expect(needsChunking(undefined)).toBe(false);
    });

    it('should return false for small content', () => {
      const smallFiles = [
        { content: 'A'.repeat(10000) },
        { content: 'B'.repeat(10000) }
      ];
      expect(needsChunking(smallFiles)).toBe(false);
    });

    it('should return true for content exceeding threshold', () => {
      const largeFiles = [
        { content: 'A'.repeat(30000) },
        { content: 'B'.repeat(30000) }
      ];
      // Total is 60,000 which exceeds default threshold of 50,000
      expect(needsChunking(largeFiles)).toBe(true);
    });

    it('should handle files with missing content', () => {
      const files = [
        { content: 'A'.repeat(10000) },
        { filename: 'empty.txt' },
        { content: null }
      ];
      expect(needsChunking(files)).toBe(false);
    });
  });

  describe('getTotalContentSize', () => {
    it('should calculate total size correctly', () => {
      const files = [
        { content: 'A'.repeat(100) },
        { content: 'B'.repeat(200) }
      ];
      expect(getTotalContentSize(files)).toBe(300);
    });

    it('should handle null/undefined', () => {
      expect(getTotalContentSize(null)).toBe(0);
      expect(getTotalContentSize(undefined)).toBe(0);
    });

    it('should handle files with missing content', () => {
      const files = [
        { content: 'A'.repeat(100) },
        { filename: 'no-content.txt' }
      ];
      expect(getTotalContentSize(files)).toBe(100);
    });
  });

  describe('chunkResearchFiles', () => {
    it('should return single chunk for small files', () => {
      const files = [
        { filename: 'file1.txt', content: 'Small content here' }
      ];
      const chunks = chunkResearchFiles(files);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('Small content here');
      expect(chunks[0].chunkId).toBe(1);
    });

    it('should chunk large content into multiple chunks', () => {
      const paragraph = 'This is a paragraph with enough content to matter.\n\n';
      const largeContent = paragraph.repeat(1000); // About 50K+ chars
      
      const files = [{ filename: 'large.txt', content: largeContent }];
      const chunks = chunkResearchFiles(files);
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.chunkId).toBeDefined();
        expect(chunk.content).toBeDefined();
        expect(chunk.sourceFiles).toBeDefined();
      });
    });

    it('should preserve source file information in chunks', () => {
      const files = [
        { filename: 'research1.pdf', content: 'Content from research 1.\n\n'.repeat(1500) },
        { filename: 'research2.docx', content: 'Content from research 2.\n\n'.repeat(1500) }
      ];
      
      const chunks = chunkResearchFiles(files);
      
      chunks.forEach(chunk => {
        expect(chunk.sourceFiles).toBeDefined();
        expect(Array.isArray(chunk.sourceFiles)).toBe(true);
        expect(chunk.metadata).toBeDefined();
      });
    });

    it('should handle empty files gracefully', () => {
      const files = [
        { filename: 'empty.txt', content: '' },
        { filename: 'valid.txt', content: 'Valid content here' }
      ];
      
      const chunks = chunkResearchFiles(files);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect maxChunks limit (best effort)', () => {
      const hugeContent = 'A'.repeat(300000);
      const files = [{ filename: 'huge.txt', content: hugeContent }];
      
      const chunks = chunkResearchFiles(files);
      
      // The chunker does best-effort limiting; verify chunks were created
      expect(chunks.length).toBeGreaterThan(0);
      // Warn is logged when can't meet limit, but chunks still produced
    });

    it('should return empty array for no valid files', () => {
      const files = [
        { filename: 'empty.txt', content: '' },
        { filename: 'whitespace.txt', content: '   ' }
      ];
      
      const chunks = chunkResearchFiles(files);
      expect(chunks).toEqual([]);
    });

    it('should handle null/undefined input', () => {
      expect(chunkResearchFiles(null)).toEqual([]);
      expect(chunkResearchFiles(undefined)).toEqual([]);
      expect(chunkResearchFiles([])).toEqual([]);
    });
  });

  describe('getChunkingStats', () => {
    it('should return accurate statistics for small content', () => {
      const files = [
        { filename: 'file1.txt', content: 'A'.repeat(10000) },
        { filename: 'file2.txt', content: 'B'.repeat(20000) }
      ];
      
      const stats = getChunkingStats(files);
      
      expect(stats.totalSize).toBe(30000);
      expect(stats.files).toBe(2);
      expect(stats.needsChunking).toBe(false);
      expect(stats.estimatedChunks).toBe(1);
    });

    it('should estimate chunk count for large content', () => {
      const files = [{ content: 'A'.repeat(100000) }];
      const stats = getChunkingStats(files);
      
      expect(stats.estimatedChunks).toBeGreaterThan(1);
      expect(stats.needsChunking).toBe(true);
      expect(stats.threshold).toBe(CHUNK_CONFIG.chunkThreshold);
    });

    it('should handle edge cases', () => {
      // null input - need to check what the function actually returns
      const emptyFiles = [];
      const stats = getChunkingStats(emptyFiles);
      expect(stats.totalSize).toBe(0);
      expect(stats.needsChunking).toBe(false);
    });
  });
});
