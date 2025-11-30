# Training Integration Gap 1: DSPy Cache Integration

## Executive Summary

**Gap**: The training system (`server/routes/training.js`) does not use the DSPy cache infrastructure (`server/utils/dspyExecutor.js` and `server/redis/dspy-cache.js`) that was implemented in Plan 09.

**Impact**: Every training iteration makes a fresh LLM API call, resulting in:
- Unnecessary API costs (estimated $0.015-$0.025 per call)
- Slower training cycles (no cache hits)
- Wasted Plan 09 infrastructure (639 lines of code unused)

**Effort**: Low (2-4 hours)
**Priority**: Critical - Immediate ROI

---

## Current State Analysis

### What Exists

1. **DSPy Cache System** (`server/redis/dspy-cache.js`)
   - Fully implemented Redis-backed cache
   - Deterministic hash-based key generation
   - Compression for payloads >10KB
   - 7-day TTL
   - Per-signature metrics tracking

2. **DSPy Executor** (`server/utils/dspyExecutor.js`)
   - `executeWithCache()` wrapper function
   - `executeBatchWithCache()` for batch operations
   - `wouldCacheHit()` for cache probing
   - `invalidateCache()` for cache management
   - `getCacheStats()` for monitoring

3. **Training System** (`server/routes/training.js`)
   - Calls `generateWithErrorHandling()` directly
   - No import of `dspyExecutor.js`
   - No cache lookup before LLM calls

### The Disconnect

```javascript
// Current flow (training.js:195-200)
async function generateWithErrorHandling(generatorFn, contentType, prompt, research, retryAttempt = 0) {
  try {
    const result = await generatorFn(prompt, research);  // Direct LLM call - NO CACHE
    // ...
  }
}
```

```javascript
// Available but unused (dspyExecutor.js:27-103)
export async function executeWithCache(signatureType, inputs, executor, options = {}) {
  // Check cache first
  const cached = await dspyCache.get(signatureType, cacheInputs);
  if (cached) {
    return { ...cached.result, __cacheHit: true };  // CACHE HIT - saves API call
  }
  // Execute and cache
  const result = await executor();
  await dspyCache.set(signatureType, cacheInputs, cleanResult, executionMetadata);
  return result;
}
```

---

## Implementation Plan

### Phase 1: Add Import and Prepare Integration

**Step 1.1: Add import statement to training.js**

```javascript
// server/routes/training.js - Add after line 30
import { executeWithCache, getCacheStats } from '../utils/dspyExecutor.js';
```

**Step 1.2: Create content type to signature type mapper**

```javascript
// server/routes/training.js - Add after line 38
const CONTENT_TYPE_TO_SIGNATURE = {
  'Roadmap': 'roadmap',
  'Slides': 'slides',
  'Document': 'document',
  'ResearchAnalysis': 'research-analysis'
};
```

### Phase 2: Modify Generation Function

**Step 2.1: Wrap generator with cache**

Modify `generateWithErrorHandling()` to use cache wrapper:

```javascript
/**
 * Wrap generator function with caching and error categorization
 * @param {Function} generatorFn - The actual generator function
 * @param {string} contentType - Content type (Roadmap, Slides, etc.)
 * @param {string} prompt - User prompt
 * @param {Array} research - Research files
 * @param {number} retryAttempt - Current retry attempt
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Generation result with cache info
 */
async function generateWithErrorHandling(generatorFn, contentType, prompt, research, retryAttempt = 0, options = {}) {
  const signatureType = CONTENT_TYPE_TO_SIGNATURE[contentType] || contentType.toLowerCase();
  const { skipCache = false, forceRefresh = false } = options;

  try {
    // Use cache wrapper
    const result = await executeWithCache(
      signatureType,
      {
        prompt,
        researchFiles: research
      },
      async () => {
        // This is the actual LLM call
        const generatorResult = await generatorFn(prompt, research);

        // Check for empty/minimal content (existing validation)
        if (!generatorResult.success && !generatorResult.data) {
          const error = categorizeEmptyError(contentType, generatorResult);
          throw new TrainingError(error.code, error.message, { contentType });
        }

        return generatorResult;
      },
      { skipCache, forceRefresh }
    );

    // Log cache hit/miss
    if (result.__cacheHit) {
      console.log(`   📦 [Cache HIT] ${contentType} - saved API call`);
    }

    return result;

  } catch (error) {
    // Existing error handling logic...
    if (error instanceof TrainingError) {
      throw error;
    }

    // Categorize API errors
    if (error.status || error.statusCode || error.code) {
      const categorized = categorizeApiError(error);
      throw new TrainingError(categorized.code, categorized.message, {
        contentType,
        originalError: error.message,
        retryAttempt
      });
    }

    throw error;
  }
}
```

### Phase 3: Add Cache Metrics to Training Status

**Step 3.1: Track cache statistics during training**

```javascript
// server/routes/training.js - Add to trainingState object
let trainingState = {
  isRunning: false,
  currentIteration: 0,
  totalIterations: 0,
  startTime: null,
  lastUpdate: null,
  errors: [],
  results: [],
  cacheStats: {          // NEW
    hits: 0,
    misses: 0,
    hitRate: '0%'
  }
};
```

**Step 3.2: Update cache stats after each generation**

```javascript
// In the training loop, after generation
if (result.__cacheHit) {
  trainingState.cacheStats.hits++;
} else {
  trainingState.cacheStats.misses++;
}

const total = trainingState.cacheStats.hits + trainingState.cacheStats.misses;
trainingState.cacheStats.hitRate = total > 0
  ? ((trainingState.cacheStats.hits / total) * 100).toFixed(1) + '%'
  : '0%';
```

**Step 3.3: Include cache stats in status endpoint**

```javascript
// GET /api/train/status response
router.get('/status', (req, res) => {
  res.json({
    ...trainingState,
    cacheStats: trainingState.cacheStats,
    estimatedSavings: `$${(trainingState.cacheStats.hits * 0.02).toFixed(2)}`
  });
});
```

### Phase 4: Add Cache Control Options

**Step 4.1: Add query parameters for cache control**

```javascript
// GET /api/train - Add cache options
router.get('/', async (req, res) => {
  const secret = req.query.secret;
  const iterations = parseInt(req.query.iterations) || 10;
  const skipCache = req.query.skipCache === 'true';      // NEW
  const forceRefresh = req.query.forceRefresh === 'true'; // NEW

  // Pass to training loop
  await runTraining({ iterations, skipCache, forceRefresh });
});
```

**Step 4.2: Add cache invalidation endpoint**

```javascript
// POST /api/train/cache/invalidate
router.post('/cache/invalidate', async (req, res) => {
  const { signatureType } = req.body;

  try {
    const count = await invalidateCache(signatureType);
    res.json({
      success: true,
      message: `Invalidated ${count} cache entries`,
      signatureType: signatureType || 'all'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Phase 5: Add Training Completion Summary

**Step 5.1: Log cache performance at end of training**

```javascript
// At end of training run
async function logTrainingSummary() {
  const stats = await getCacheStats();

  console.log('\n=== Training Cache Summary ===');
  console.log(`Cache Hits: ${trainingState.cacheStats.hits}`);
  console.log(`Cache Misses: ${trainingState.cacheStats.misses}`);
  console.log(`Hit Rate: ${trainingState.cacheStats.hitRate}`);
  console.log(`Estimated Savings: $${(trainingState.cacheStats.hits * 0.02).toFixed(2)}`);

  // Per-signature breakdown
  for (const type of ['roadmap', 'slides', 'document', 'research-analysis']) {
    const typeStats = await getCacheStats(type);
    if (typeStats) {
      console.log(`  ${type}: ${typeStats.hits} hits, ${typeStats.misses} misses`);
    }
  }
}
```

---

## File Changes Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `server/routes/training.js` | Modify | ~50-80 lines |
| `server/utils/dspyExecutor.js` | None | 0 |
| `server/redis/dspy-cache.js` | None | 0 |

---

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/training-cache.test.js

describe('Training with DSPy Cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should check cache before LLM call', async () => {
    const mockCache = { get: jest.fn().mockResolvedValue(null) };
    // ...
  });

  test('should return cached result on hit', async () => {
    const cachedResult = { data: { title: 'Cached' }, success: true };
    const mockCache = {
      get: jest.fn().mockResolvedValue({ result: cachedResult })
    };
    // ...
  });

  test('should cache new results', async () => {
    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('cache-key')
    };
    // ...
  });

  test('should skip cache when skipCache=true', async () => {
    // ...
  });

  test('should force refresh when forceRefresh=true', async () => {
    // ...
  });
});
```

### Integration Tests

```javascript
// tests/integration/training-cache.test.js

describe('Training Cache Integration', () => {
  test('second identical request should hit cache', async () => {
    const response1 = await request(app)
      .get('/api/train?iterations=1&secret=test');

    const response2 = await request(app)
      .get('/api/train?iterations=1&secret=test');

    expect(response2.body.cacheStats.hits).toBeGreaterThan(0);
  });
});
```

### Manual Testing Checklist

- [ ] Run training with `?iterations=5` and verify cache misses
- [ ] Run same training again and verify cache hits
- [ ] Test `?skipCache=true` bypasses cache
- [ ] Test `?forceRefresh=true` refreshes cache
- [ ] Verify `/api/train/status` shows cache stats
- [ ] Test `/api/train/cache/invalidate` clears cache
- [ ] Verify Redis keys are created with correct TTL

---

## Rollback Plan

If issues arise, rollback is straightforward:

1. Remove import statement
2. Revert `generateWithErrorHandling()` to direct call
3. Remove cache-related state tracking

No data migration required - cache entries will naturally expire.

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cache integration | Working | No errors in training loop |
| Cache hits on repeat | >80% | Status endpoint shows hit rate |
| API cost reduction | Measurable | Track savings in summary |
| Training time | Reduced | Compare with/without cache |
| Test coverage | >80% | Jest coverage report |

---

## Dependencies

- Redis server running and accessible
- `REDIS_URL` environment variable set
- No changes to `dspy-cache.js` or `dspyExecutor.js` required

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Import & Mapper | 15 min | None |
| Phase 2: Modify Generation | 45 min | Phase 1 |
| Phase 3: Add Metrics | 30 min | Phase 2 |
| Phase 4: Cache Control | 30 min | Phase 2 |
| Phase 5: Summary | 20 min | Phase 3 |
| Testing | 60 min | All phases |
| **Total** | **~3.5 hours** | |

---

## Notes

- This integration requires NO changes to the cache infrastructure
- The cache will auto-populate during training runs
- First training run will have 100% misses (expected)
- Subsequent runs with same samples will benefit from cache
- Consider pre-warming cache before production training runs
