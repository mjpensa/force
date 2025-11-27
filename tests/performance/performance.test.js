/**
 * Performance Regression Tests
 *
 * Phase 10 implementation:
 * - Performance baseline verification
 * - Regression detection for critical paths
 * - Budget enforcement
 *
 * These tests verify that performance characteristics remain within
 * acceptable thresholds to prevent performance regressions.
 */

import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Performance budgets (milliseconds unless otherwise noted)
const PERFORMANCE_BUDGETS = {
  // File processing
  fileProcessing: {
    singleFile10KB: 100,       // 10KB file should process in <100ms
    singleFile100KB: 500,      // 100KB file should process in <500ms
    batchFiles10: 1000,        // 10 files should process in <1s
    textNormalization1MB: 200  // 1MB text normalization in <200ms
  },
  // Cache operations
  cache: {
    lookup: 5,            // Cache lookup in <5ms
    write: 10,            // Cache write in <10ms
    hitRateTarget: 0.3    // Target 30% cache hit rate
  },
  // Session storage
  storage: {
    get: 50,              // Session get in <50ms
    set: 100,             // Session set in <100ms
    compression: 200      // Compression operation in <200ms
  },
  // Monitoring overhead
  monitoring: {
    metricsCollection: 100,  // Metrics collection in <100ms
    alertEvaluation: 50      // Alert evaluation in <50ms
  }
};

// Mock performance timer
function measureTime(fn) {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return { result, duration };
}

async function measureTimeAsync(fn) {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

describe('Performance Regression Tests', () => {

  describe('Monitoring System Performance', () => {

    test('MetricsAggregator collection completes within budget', async () => {
      const { metricsAggregator } = await import('../../server/utils/monitoring.js');

      // Register a simple collector
      metricsAggregator.register('test', async () => ({
        value: 42,
        timestamp: Date.now()
      }));

      const { duration } = await measureTimeAsync(() =>
        metricsAggregator.collect()
      );

      expect(duration).toBeLessThan(PERFORMANCE_BUDGETS.monitoring.metricsCollection);
    });

    test('AlertEvaluator evaluation completes within budget', async () => {
      const { alertEvaluator } = await import('../../server/utils/monitoring.js');

      const mockMetrics = {
        collectors: {
          generation: {
            latency: { p95: 60000, p99: 90000 }
          },
          cache: {
            aggregate: { hits: 30, totalRequests: 100 }
          },
          queue: { currentlyQueued: 2 },
          storage: { sessionCount: 10, maxSessions: 100 }
        }
      };

      const { duration } = measureTime(() =>
        alertEvaluator.evaluate(mockMetrics)
      );

      expect(duration).toBeLessThan(PERFORMANCE_BUDGETS.monitoring.alertEvaluation);
    });

    test('FeatureFlags lookup is fast', async () => {
      const { featureFlags } = await import('../../server/utils/monitoring.js');

      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        featureFlags.isEnabled('cache_enabled', `session-${i}`);
      }

      const duration = performance.now() - start;
      const avgLookup = duration / iterations;

      // Average lookup should be <0.1ms
      expect(avgLookup).toBeLessThan(0.1);
    });
  });

  describe('Advanced Optimizer Performance', () => {

    test('PromptTemplateCache compilation is fast', async () => {
      const { promptCache } = await import('../../server/utils/advancedOptimizer.js');

      const template = 'Hello {{name}}, your score is {{score}}. Status: {{status}}';

      const { duration } = measureTime(() =>
        promptCache.compile(template)
      );

      // Compilation should be <5ms
      expect(duration).toBeLessThan(5);
    });

    test('PromptTemplateCache cached lookup is faster than compilation', async () => {
      const { promptCache } = await import('../../server/utils/advancedOptimizer.js');

      const template = 'Test {{var1}} and {{var2}} with {{var3}}';
      const key = 'perf-test-template';

      // First call - compilation
      const { duration: compileTime } = measureTime(() =>
        promptCache.getOrCompile(key, template)
      );

      // Second call - cached
      const { duration: cacheTime } = measureTime(() =>
        promptCache.getOrCompile(key, template)
      );

      // Cached lookup should be significantly faster
      expect(cacheTime).toBeLessThan(compileTime);
      expect(cacheTime).toBeLessThan(1); // <1ms for cache hit
    });

    test('SpeculativeGenerator recordView is fast', async () => {
      const { speculativeGenerator } = await import('../../server/utils/advancedOptimizer.js');

      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        speculativeGenerator.recordView(`session-${i}`, 'roadmap');
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      // Average record should be <0.1ms
      expect(avgTime).toBeLessThan(0.1);
    });

    test('SpeculativeGenerator getOptimalOrder is fast', async () => {
      const { speculativeGenerator } = await import('../../server/utils/advancedOptimizer.js');

      const { result, duration } = measureTime(() =>
        speculativeGenerator.getOptimalOrder()
      );

      expect(duration).toBeLessThan(5);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(4);
    });
  });

  describe('Session Storage Performance', () => {

    test('MemoryStorage get/set operations are fast', async () => {
      const { MemoryStorage } = await import('../../server/storage/sessionStorage.js');

      const storage = new MemoryStorage();
      const testData = {
        prompt: 'Test prompt',
        content: { roadmap: { data: 'test' } },
        researchContent: 'a'.repeat(5000)  // 5KB content
      };

      // Test set
      const { duration: setTime } = await measureTimeAsync(() =>
        storage.set('perf-test-session', testData)
      );
      expect(setTime).toBeLessThan(PERFORMANCE_BUDGETS.storage.set);

      // Test get
      const { duration: getTime } = await measureTimeAsync(() =>
        storage.get('perf-test-session')
      );
      expect(getTime).toBeLessThan(PERFORMANCE_BUDGETS.storage.get);

      // Cleanup
      storage.destroy();
    });

    test('Large session compression is within budget', async () => {
      const { MemoryStorage } = await import('../../server/storage/sessionStorage.js');

      const storage = new MemoryStorage();
      // Create large content that will trigger compression (>10KB)
      const largeContent = {
        prompt: 'Test prompt',
        content: { roadmap: { data: 'x'.repeat(50000) } },  // 50KB
        researchContent: 'y'.repeat(50000)  // Another 50KB
      };

      const { duration } = await measureTimeAsync(() =>
        storage.set('large-session', largeContent)
      );

      expect(duration).toBeLessThan(PERFORMANCE_BUDGETS.storage.compression);

      // Cleanup
      storage.destroy();
    });
  });

  describe('Network Optimizer Performance', () => {

    test('cleanJsonResponse is fast for typical payloads', async () => {
      const { cleanJsonResponse } = await import('../../server/utils/networkOptimizer.js');

      const typicalPayload = {
        status: 'completed',
        sessionId: 'test-123',
        content: {
          roadmap: { success: true, data: { tasks: Array(50).fill({ name: 'Task', duration: 5 }) } },
          slides: { success: true, data: { slides: Array(6).fill({ title: 'Slide', content: 'Text' }) } },
          document: { success: true, data: { sections: Array(10).fill({ heading: 'Section', body: 'Content' }) } },
          researchAnalysis: null  // Will be removed
        },
        nullField: null,
        undefinedField: undefined
      };

      const { result, duration } = measureTime(() =>
        cleanJsonResponse(typicalPayload, { removeNull: true, removeUndefined: true })
      );

      expect(duration).toBeLessThan(10);  // <10ms
      expect(result.nullField).toBeUndefined();
      expect(result.content.researchAnalysis).toBeUndefined();
    });
  });

  describe('Content Cache Performance', () => {

    test('Cache operations are within budget', async () => {
      const { getCachedContent, setCachedContent, getCacheMetrics } =
        await import('../../server/cache/contentCache.js');

      const testContent = 'Test research content for caching';
      const testPrompt = 'Test prompt';
      const testData = { test: 'data', items: Array(100).fill('item') };

      // Test cache write
      const { duration: writeTime } = measureTime(() =>
        setCachedContent('roadmap', testContent, testPrompt, testData)
      );
      expect(writeTime).toBeLessThan(PERFORMANCE_BUDGETS.cache.write);

      // Test cache read (hit)
      const { duration: hitTime } = measureTime(() =>
        getCachedContent('roadmap', testContent, testPrompt)
      );
      expect(hitTime).toBeLessThan(PERFORMANCE_BUDGETS.cache.lookup);

      // Test cache read (miss)
      const { duration: missTime } = measureTime(() =>
        getCachedContent('roadmap', 'different content', testPrompt)
      );
      expect(missTime).toBeLessThan(PERFORMANCE_BUDGETS.cache.lookup);
    });
  });

  describe('Performance Logger Overhead', () => {

    test('Performance logging has minimal overhead', async () => {
      const { PerformanceLogger, createTimer } =
        await import('../../server/utils/performanceLogger.js');

      const logger = new PerformanceLogger('perf-test', { enabled: true });

      // Measure overhead of creating timers
      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const timer = createTimer(logger, `operation-${i}`);
        timer.stop();
      }

      const duration = performance.now() - start;
      const avgOverhead = duration / iterations;

      // Logging overhead should be <1ms per operation
      expect(avgOverhead).toBeLessThan(1);

      // Complete should also be fast
      const { duration: completeTime } = measureTime(() =>
        logger.complete()
      );
      expect(completeTime).toBeLessThan(10);
    });
  });

});

describe('Performance Budget Verification', () => {

  test('All performance budgets are reasonable', () => {
    // Verify budgets are positive numbers
    const checkBudgets = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        if (typeof value === 'object') {
          checkBudgets(value, fullPath);
        } else if (typeof value === 'number') {
          expect(value).toBeGreaterThan(0);
        }
      }
    };

    checkBudgets(PERFORMANCE_BUDGETS);
  });

  test('Performance budgets document exists', () => {
    // This test documents the budgets for reference
    expect(PERFORMANCE_BUDGETS.fileProcessing.singleFile10KB).toBe(100);
    expect(PERFORMANCE_BUDGETS.cache.hitRateTarget).toBe(0.3);
    expect(PERFORMANCE_BUDGETS.storage.get).toBe(50);
    expect(PERFORMANCE_BUDGETS.monitoring.metricsCollection).toBe(100);
  });
});

// Export budgets for use in CI/CD
export { PERFORMANCE_BUDGETS };
