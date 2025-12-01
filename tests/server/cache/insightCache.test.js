/**
 * Insight Cache Tests
 * 
 * Tests for Phase 4 caching optimization of extracted insights.
 */

import { jest } from '@jest/globals';

// Mock Redis client
jest.unstable_mockModule('../../../server/redis/client.js', () => ({
  getRedisClient: jest.fn().mockResolvedValue(null) // Default: Redis unavailable
}));

// Import after mocking
const { 
  generateContentHash,
  getCachedInsights,
  cacheInsights,
  hasCachedInsights,
  clearInsightCache,
  getInsightCacheMetrics,
  getInsightCacheConfig
} = await import('../../../server/cache/insightCache.js');

describe('Insight Cache', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await clearInsightCache();
  });

  describe('generateContentHash', () => {
    test('generates consistent hash for same content', () => {
      const content = 'This is test content for hashing.';
      const hash1 = generateContentHash(content);
      const hash2 = generateContentHash(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    test('generates different hash for different content', () => {
      const hash1 = generateContentHash('Content A');
      const hash2 = generateContentHash('Content B');
      
      expect(hash1).not.toBe(hash2);
    });

    test('returns null for null/undefined content', () => {
      expect(generateContentHash(null)).toBeNull();
      expect(generateContentHash(undefined)).toBeNull();
    });

    test('returns null for non-string content', () => {
      expect(generateContentHash(123)).toBeNull();
      expect(generateContentHash({ content: 'test' })).toBeNull();
    });

    test('handles empty string', () => {
      const hash = generateContentHash('');
      expect(hash).toBeNull();
    });

    test('handles large content efficiently', () => {
      const largeContent = 'x'.repeat(100000);
      const startTime = Date.now();
      const hash = generateContentHash(largeContent);
      const duration = Date.now() - startTime;
      
      expect(hash).toHaveLength(16);
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe('Memory Cache Operations', () => {
    test('caches and retrieves insights', async () => {
      const hash = generateContentHash('Test content for caching');
      const insights = {
        keyFacts: [{ fact: 'Test fact', importance: 'high' }],
        themes: [{ theme: 'Test theme', frequency: 'primary' }]
      };
      
      await cacheInsights(hash, insights);
      const retrieved = await getCachedInsights(hash);
      
      expect(retrieved).toEqual(insights);
    });

    test('returns null for non-existent cache entry', async () => {
      const hash = generateContentHash('Non-existent content');
      const result = await getCachedInsights(hash);
      
      expect(result).toBeNull();
    });

    test('hasCachedInsights returns correct status', async () => {
      const hash = generateContentHash('Content to check');
      
      expect(await hasCachedInsights(hash)).toBe(false);
      
      await cacheInsights(hash, { keyFacts: [] });
      
      expect(await hasCachedInsights(hash)).toBe(true);
    });

    test('clearInsightCache removes all entries', async () => {
      const hash1 = generateContentHash('Content 1');
      const hash2 = generateContentHash('Content 2');
      
      await cacheInsights(hash1, { keyFacts: [] });
      await cacheInsights(hash2, { themes: [] });
      
      expect(await hasCachedInsights(hash1)).toBe(true);
      expect(await hasCachedInsights(hash2)).toBe(true);
      
      await clearInsightCache();
      
      expect(await hasCachedInsights(hash1)).toBe(false);
      expect(await hasCachedInsights(hash2)).toBe(false);
    });

    test('handles null hash gracefully', async () => {
      const result = await getCachedInsights(null);
      expect(result).toBeNull();
      
      const cached = await cacheInsights(null, { keyFacts: [] });
      expect(cached).toBe(false);
    });

    test('handles null insights gracefully', async () => {
      const hash = generateContentHash('Test content');
      const cached = await cacheInsights(hash, null);
      expect(cached).toBe(false);
    });
  });

  describe('LRU Eviction', () => {
    test('evicts oldest entries when max size exceeded', async () => {
      const config = getInsightCacheConfig();
      const maxSize = config.memoryMaxSize;
      
      // Fill cache to capacity
      for (let i = 0; i < maxSize + 5; i++) {
        const hash = generateContentHash(`Content ${i}`);
        await cacheInsights(hash, { index: i });
      }
      
      // First entries should be evicted
      const firstHash = generateContentHash('Content 0');
      const lastHash = generateContentHash(`Content ${maxSize + 4}`);
      
      expect(await hasCachedInsights(firstHash)).toBe(false);
      expect(await hasCachedInsights(lastHash)).toBe(true);
    });
  });

  describe('Cache Metrics', () => {
    test('tracks hits and misses', async () => {
      await clearInsightCache(); // Reset metrics
      
      const hash = generateContentHash('Metrics test content');
      
      // Miss
      await getCachedInsights(hash);
      
      // Cache it
      await cacheInsights(hash, { keyFacts: [] });
      
      // Hit
      await getCachedInsights(hash);
      
      const metrics = getInsightCacheMetrics();
      
      expect(metrics.misses).toBeGreaterThanOrEqual(1);
      expect(metrics.hits).toBeGreaterThanOrEqual(1);
      expect(metrics.writes).toBeGreaterThanOrEqual(1);
    });

    test('calculates hit rate', async () => {
      await clearInsightCache(); // Reset metrics
      
      const hash = generateContentHash('Hit rate test');
      await cacheInsights(hash, { keyFacts: [] });
      
      // Generate some hits
      await getCachedInsights(hash);
      await getCachedInsights(hash);
      await getCachedInsights(hash);
      
      const metrics = getInsightCacheMetrics();
      expect(metrics.hitRate).not.toBe('0%');
    });

    test('tracks memory size', async () => {
      await clearInsightCache();
      
      const hash1 = generateContentHash('Size test 1');
      const hash2 = generateContentHash('Size test 2');
      
      await cacheInsights(hash1, { keyFacts: [] });
      await cacheInsights(hash2, { themes: [] });
      
      const metrics = getInsightCacheMetrics();
      expect(metrics.memorySize).toBe(2);
    });

    test('reports configuration', () => {
      const config = getInsightCacheConfig();
      
      expect(config).toHaveProperty('ttlSeconds');
      expect(config).toHaveProperty('hashSampleSize');
      expect(config).toHaveProperty('memoryMaxSize');
      expect(config).toHaveProperty('keyPrefix');
    });
  });
});
