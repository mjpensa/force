/**
 * Map-Reduce Metrics Tests
 * 
 * Tests for Phase 6 monitoring and metrics collection.
 */

import { jest } from '@jest/globals';

const {
  recordMapReduceRequest,
  getMapReduceMetrics,
  getRequestHistory,
  getPerformanceSummary,
  resetMetrics
} = await import('../../../server/utils/mapReduceMetrics.js');

describe('Map-Reduce Metrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('recordMapReduceRequest', () => {
    test('records a direct request', () => {
      const request = recordMapReduceRequest({
        sessionId: 'test-1',
        contentType: 'roadmap',
        strategy: 'direct',
        totalSize: 25000,
        totalTimeMs: 1500
      });
      
      expect(request).toHaveProperty('timestamp');
      expect(request.strategy).toBe('direct');
      expect(request.totalSize).toBe(25000);
    });

    test('records a map-reduce request', () => {
      const request = recordMapReduceRequest({
        sessionId: 'test-2',
        contentType: 'slides',
        strategy: 'map-reduce',
        totalSize: 75000,
        chunksProcessed: 4,
        extractionTimeMs: 3000,
        consolidationTimeMs: 500,
        totalTimeMs: 4000,
        cacheHits: 1,
        cacheMisses: 3
      });
      
      expect(request.strategy).toBe('map-reduce');
      expect(request.chunksProcessed).toBe(4);
      expect(request.cacheHits).toBe(1);
    });

    test('records error requests', () => {
      recordMapReduceRequest({
        sessionId: 'test-error',
        contentType: 'document',
        strategy: 'map-reduce',
        totalSize: 50000,
        totalTimeMs: 1000,
        error: 'Processing failed'
      });
      
      const metrics = getMapReduceMetrics();
      expect(metrics.totalErrors).toBe(1);
    });
  });

  describe('getMapReduceMetrics', () => {
    test('returns aggregated metrics', () => {
      // Record some requests
      recordMapReduceRequest({
        sessionId: 'test-1',
        contentType: 'roadmap',
        strategy: 'direct',
        totalSize: 20000,
        totalTimeMs: 1000
      });
      
      recordMapReduceRequest({
        sessionId: 'test-2',
        contentType: 'slides',
        strategy: 'map-reduce',
        totalSize: 80000,
        chunksProcessed: 4,
        totalTimeMs: 5000,
        cacheHits: 2,
        cacheMisses: 2
      });
      
      const metrics = getMapReduceMetrics();
      
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.directRequests).toBe(1);
      expect(metrics.mapReduceRequests).toBe(1);
      expect(metrics).toHaveProperty('avgMapReduceTimeMs');
      expect(metrics).toHaveProperty('avgDirectTimeMs');
      expect(metrics).toHaveProperty('cacheHitRate');
    });

    test('tracks content size distribution', () => {
      // Small
      recordMapReduceRequest({
        sessionId: 's1', contentType: 'roadmap', strategy: 'direct',
        totalSize: 10000, totalTimeMs: 500
      });
      
      // Medium
      recordMapReduceRequest({
        sessionId: 's2', contentType: 'roadmap', strategy: 'direct',
        totalSize: 35000, totalTimeMs: 800
      });
      
      // Large
      recordMapReduceRequest({
        sessionId: 's3', contentType: 'slides', strategy: 'map-reduce',
        totalSize: 75000, totalTimeMs: 3000, chunksProcessed: 3
      });
      
      // XLarge
      recordMapReduceRequest({
        sessionId: 's4', contentType: 'document', strategy: 'map-reduce',
        totalSize: 150000, totalTimeMs: 8000, chunksProcessed: 8
      });
      
      const metrics = getMapReduceMetrics();
      
      expect(metrics.contentSizeDistribution.small).toBe(1);
      expect(metrics.contentSizeDistribution.medium).toBe(1);
      expect(metrics.contentSizeDistribution.large).toBe(1);
      expect(metrics.contentSizeDistribution.xlarge).toBe(1);
    });

    test('calculates cache hit rate', () => {
      recordMapReduceRequest({
        sessionId: 'cache-test',
        contentType: 'roadmap',
        strategy: 'map-reduce',
        totalSize: 60000,
        totalTimeMs: 2000,
        chunksProcessed: 3,
        cacheHits: 2,
        cacheMisses: 1
      });
      
      const metrics = getMapReduceMetrics();
      expect(metrics.cacheHitRate).toBe('67%'); // 2/3 = 67%
    });

    test('includes requestsPerHour', () => {
      recordMapReduceRequest({
        sessionId: 'hourly-test',
        contentType: 'roadmap',
        strategy: 'direct',
        totalSize: 10000,
        totalTimeMs: 500
      });
      
      const metrics = getMapReduceMetrics();
      expect(metrics).toHaveProperty('requestsPerHour');
      expect(metrics.requestsPerHour).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getRequestHistory', () => {
    beforeEach(() => {
      // Add sample requests
      recordMapReduceRequest({
        sessionId: 'h1', contentType: 'roadmap', strategy: 'direct',
        totalSize: 10000, totalTimeMs: 500
      });
      recordMapReduceRequest({
        sessionId: 'h2', contentType: 'slides', strategy: 'map-reduce',
        totalSize: 60000, totalTimeMs: 3000, chunksProcessed: 3
      });
      recordMapReduceRequest({
        sessionId: 'h3', contentType: 'document', strategy: 'map-reduce',
        totalSize: 80000, totalTimeMs: 4000, chunksProcessed: 4, error: 'Failed'
      });
    });

    test('returns recent history', () => {
      const history = getRequestHistory();
      
      expect(history.length).toBe(3);
      // Most recent first
      expect(history[0].sessionId).toBe('h3');
    });

    test('filters by strategy', () => {
      const mapReduceOnly = getRequestHistory({ strategy: 'map-reduce' });
      
      expect(mapReduceOnly.length).toBe(2);
      expect(mapReduceOnly.every(r => r.strategy === 'map-reduce')).toBe(true);
    });

    test('filters by contentType', () => {
      const slidesOnly = getRequestHistory({ contentType: 'slides' });
      
      expect(slidesOnly.length).toBe(1);
      expect(slidesOnly[0].contentType).toBe('slides');
    });

    test('filters errors only', () => {
      const errorsOnly = getRequestHistory({ errorsOnly: true });
      
      expect(errorsOnly.length).toBe(1);
      expect(errorsOnly[0].error).toBe('Failed');
    });

    test('respects limit', () => {
      const limited = getRequestHistory({ limit: 2 });
      
      expect(limited.length).toBe(2);
    });
  });

  describe('getPerformanceSummary', () => {
    test('returns performance comparison', () => {
      // Add direct requests
      recordMapReduceRequest({
        sessionId: 'd1', contentType: 'roadmap', strategy: 'direct',
        totalSize: 15000, totalTimeMs: 1000
      });
      recordMapReduceRequest({
        sessionId: 'd2', contentType: 'slides', strategy: 'direct',
        totalSize: 20000, totalTimeMs: 1200
      });
      
      // Add map-reduce requests
      recordMapReduceRequest({
        sessionId: 'm1', contentType: 'roadmap', strategy: 'map-reduce',
        totalSize: 60000, totalTimeMs: 4000, chunksProcessed: 3
      });
      recordMapReduceRequest({
        sessionId: 'm2', contentType: 'document', strategy: 'map-reduce',
        totalSize: 80000, totalTimeMs: 5000, chunksProcessed: 4
      });
      
      const summary = getPerformanceSummary();
      
      expect(summary.direct.count).toBe(2);
      expect(summary.mapReduce.count).toBe(2);
      expect(summary.direct.avgTimeMs).toBe(1100); // (1000+1200)/2
      expect(summary.mapReduce.avgTimeMs).toBe(4500); // (4000+5000)/2
      expect(summary.mapReduce.avgChunks).toBe(3.5); // (3+4)/2
      expect(summary.comparison.mapReducePercentage).toBe('50%');
    });

    test('handles empty history', () => {
      const summary = getPerformanceSummary();
      
      expect(summary.direct.count).toBe(0);
      expect(summary.mapReduce.count).toBe(0);
      expect(summary.comparison.avgTimeRatio).toBeNull();
    });
  });

  describe('resetMetrics', () => {
    test('clears all metrics', () => {
      // Add some data
      recordMapReduceRequest({
        sessionId: 'reset-test',
        contentType: 'roadmap',
        strategy: 'direct',
        totalSize: 10000,
        totalTimeMs: 500
      });
      
      let metrics = getMapReduceMetrics();
      expect(metrics.totalRequests).toBe(1);
      
      // Reset
      resetMetrics();
      
      metrics = getMapReduceMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.directRequests).toBe(0);
      expect(metrics.mapReduceRequests).toBe(0);
      expect(getRequestHistory().length).toBe(0);
    });
  });
});
