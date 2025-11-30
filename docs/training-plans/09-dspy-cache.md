# Implementation Plan: DSPy Cache

## Problem Statement

The current training system lacks dedicated caching for DSPy signature executions (LLM calls):

1. **No LLM Call Deduplication**: Identical prompts with identical research files result in redundant LLM calls
2. **Cost Inefficiency**: Each roadmap/slides/document generation costs API tokens even for repeated inputs
3. **Training Slowdown**: Regenerating cached content wastes time during training loops
4. **No Cache Analytics**: No visibility into cache hit rates or estimated savings
5. **In-Memory Only**: Current `contentCache.js` is local memory, lost on restart

The ARCHITECTURE specifies DSPy Cache as part of the Redis Memory Layer for cost optimization and performance.

## Current State

```javascript
// contentCache.js - In-memory only, no DSPy-specific caching
class LRUCache {
  constructor() {
    this.cache = new Map();  // Lost on restart
    // No signature-type namespacing
    // No LLM call metadata tracking
  }
}

// Training generates content without checking for cached DSPy results
// Each generation = new LLM API call regardless of input similarity
```

## Goal

Implement a dedicated DSPy caching layer that:

1. Caches LLM call results keyed by deterministic input hashes
2. Namespaces entries by signature type (roadmap, slides, document, research-analysis)
3. Persists to Redis with 7-day TTL for extended reuse
4. Tracks cache hit/miss metrics and cost savings
5. Provides invalidation controls for cache management
6. Integrates seamlessly with DSPy signature execution flow

---

## Phase 1: Cache Key Generation

### Objective
Implement deterministic hash generation for cache keys.

### Implementation

```javascript
// server/redis/dspy-cache.js - Part 1: Hash Generation

import crypto from 'crypto';
import { CONFIG } from '../config.js';

/**
 * DSPy Cache Key Generation
 *
 * Generates deterministic cache keys based on:
 * - Signature type (roadmap, slides, document, research-analysis)
 * - User prompt (normalized)
 * - Research files content (sampled for efficiency)
 * - Model configuration (tier, temperature)
 *
 * Key format: force:dspy:{signatureType}:{hash}
 */

// Valid signature types
const SIGNATURE_TYPES = ['roadmap', 'slides', 'document', 'research-analysis'];

/**
 * Normalize prompt for consistent hashing
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Remove punctuation variations
 */
function normalizePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return '';

  return prompt
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // Collapse whitespace
    .replace(/['']/g, "'")          // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/[\r\n]+/g, ' ');      // Remove newlines
}

/**
 * Generate content hash for research files
 *
 * For large files, samples content to keep hashing fast:
 * - First 10KB
 * - Last 2.5KB
 * - Total file count and sizes
 */
function hashResearchContent(researchFiles) {
  if (!researchFiles || researchFiles.length === 0) {
    return 'empty';
  }

  const SAMPLE_HEAD = 10000;  // First 10KB
  const SAMPLE_TAIL = 2500;   // Last 2.5KB

  const contentParts = [];

  // Sort files by name for deterministic ordering
  const sortedFiles = [...researchFiles].sort((a, b) =>
    (a.filename || '').localeCompare(b.filename || '')
  );

  for (const file of sortedFiles) {
    const content = file.content || '';
    const filename = file.filename || 'unnamed';

    // Sample content for large files
    let sampledContent;
    if (content.length <= SAMPLE_HEAD + SAMPLE_TAIL) {
      sampledContent = content;
    } else {
      sampledContent =
        content.slice(0, SAMPLE_HEAD) +
        '...[SAMPLED]...' +
        content.slice(-SAMPLE_TAIL);
    }

    contentParts.push({
      filename,
      length: content.length,
      sample: sampledContent
    });
  }

  // Include metadata
  const hashInput = {
    fileCount: sortedFiles.length,
    totalSize: sortedFiles.reduce((sum, f) => sum + (f.content?.length || 0), 0),
    files: contentParts
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(hashInput))
    .digest('hex')
    .slice(0, 16);  // First 16 chars sufficient for uniqueness
}

/**
 * Generate cache key for DSPy signature execution
 *
 * @param {string} signatureType - Type of signature (roadmap, slides, etc.)
 * @param {Object} inputs - Signature inputs
 * @param {string} inputs.prompt - User prompt
 * @param {Array} inputs.researchFiles - Research files array
 * @param {string} inputs.modelTier - Model tier (fast, standard, advanced)
 * @param {number} inputs.temperature - Generation temperature
 * @returns {Object} { fullKey, hash, components }
 */
export function generateCacheKey(signatureType, inputs) {
  // Validate signature type
  if (!SIGNATURE_TYPES.includes(signatureType)) {
    throw new Error(`Invalid signature type: ${signatureType}. Must be one of: ${SIGNATURE_TYPES.join(', ')}`);
  }

  // Build hash components
  const components = {
    type: signatureType,
    prompt: normalizePrompt(inputs.prompt),
    contentHash: hashResearchContent(inputs.researchFiles),
    modelConfig: {
      tier: inputs.modelTier || 'standard',
      temperature: inputs.temperature ?? 0
    }
  };

  // Generate hash
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(components))
    .digest('hex');

  // Build full Redis key
  const prefix = CONFIG.REDIS.keyPrefixes.dspy;
  const fullKey = `${prefix}${signatureType}:${hash}`;

  return {
    fullKey,
    hash,
    signatureType,
    components
  };
}

/**
 * Validate cache key format
 */
export function isValidCacheKey(key) {
  const prefix = CONFIG.REDIS.keyPrefixes.dspy;
  if (!key.startsWith(prefix)) return false;

  const parts = key.slice(prefix.length).split(':');
  if (parts.length !== 2) return false;

  const [type, hash] = parts;
  return SIGNATURE_TYPES.includes(type) && hash.length === 64;
}

export { SIGNATURE_TYPES, normalizePrompt, hashResearchContent };
```

---

## Phase 2: Cache Entry Structure and Serialization

### Objective
Define cache entry schema with metadata and compression.

### Implementation

```javascript
// server/redis/dspy-cache.js - Part 2: Entry Structure

import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * DSPy Cache Entry Schema
 *
 * {
 *   // Identification
 *   key: string,                    // Full Redis key
 *   signatureType: string,          // roadmap, slides, etc.
 *   inputHash: string,              // SHA256 of inputs
 *
 *   // Cached result
 *   result: object,                 // LLM response (signature output)
 *   compressed: boolean,            // Whether result is compressed
 *
 *   // Execution metadata
 *   metadata: {
 *     model: string,                // Model name
 *     modelTier: string,            // fast, standard, advanced
 *     inputTokens: number,          // Input token count
 *     outputTokens: number,         // Output token count
 *     latencyMs: number,            // Generation latency
 *     timestamp: number             // Execution timestamp
 *   },
 *
 *   // Cache metadata
 *   cachedAt: number,               // When cached
 *   expiresAt: number,              // TTL expiration
 *   hitCount: number,               // Access count
 *   lastAccessedAt: number          // Last access time
 * }
 */

/**
 * Serialize cache entry for storage
 * Compresses result if over threshold
 */
export async function serializeEntry(entry) {
  const threshold = CONFIG.REDIS.features.compressionThreshold;
  const resultJson = JSON.stringify(entry.result);

  let serializedResult;
  let compressed = false;

  // Compress if large
  if (CONFIG.REDIS.features.compression && resultJson.length > threshold) {
    try {
      const compressedBuffer = await gzip(Buffer.from(resultJson, 'utf8'));
      // Only use compression if it actually saves space
      if (compressedBuffer.length < resultJson.length * 0.9) {
        serializedResult = compressedBuffer.toString('base64');
        compressed = true;
      } else {
        serializedResult = resultJson;
      }
    } catch {
      serializedResult = resultJson;
    }
  } else {
    serializedResult = resultJson;
  }

  return JSON.stringify({
    key: entry.key,
    signatureType: entry.signatureType,
    inputHash: entry.inputHash,
    result: serializedResult,
    compressed,
    metadata: entry.metadata,
    cachedAt: entry.cachedAt,
    expiresAt: entry.expiresAt,
    hitCount: entry.hitCount || 0,
    lastAccessedAt: entry.lastAccessedAt || entry.cachedAt
  });
}

/**
 * Deserialize cache entry from storage
 */
export async function deserializeEntry(raw) {
  const entry = JSON.parse(raw);

  // Decompress if needed
  if (entry.compressed) {
    try {
      const buffer = Buffer.from(entry.result, 'base64');
      const decompressed = await gunzip(buffer);
      entry.result = JSON.parse(decompressed.toString('utf8'));
    } catch (error) {
      throw new Error(`Failed to decompress cache entry: ${error.message}`);
    }
  } else {
    entry.result = JSON.parse(entry.result);
  }

  entry.compressed = false;  // Result is now decompressed
  return entry;
}

/**
 * Create new cache entry
 */
export function createEntry(keyInfo, result, metadata) {
  const now = Date.now();
  const ttlSeconds = CONFIG.REDIS.ttl.dspy;

  return {
    key: keyInfo.fullKey,
    signatureType: keyInfo.signatureType,
    inputHash: keyInfo.hash,
    result,
    metadata: {
      model: metadata.model || 'unknown',
      modelTier: metadata.modelTier || 'standard',
      inputTokens: metadata.inputTokens || 0,
      outputTokens: metadata.outputTokens || 0,
      latencyMs: metadata.latencyMs || 0,
      timestamp: now
    },
    cachedAt: now,
    expiresAt: now + (ttlSeconds * 1000),
    hitCount: 0,
    lastAccessedAt: now
  };
}
```

---

## Phase 3: DSPy Cache Class

### Objective
Implement the main DSPyCache class with get/set/invalidate methods.

### Implementation

```javascript
// server/redis/dspy-cache.js - Part 3: Main Cache Class

import { getRedisClient, isRedisHealthy } from './client.js';
import { CONFIG } from '../config.js';

/**
 * DSPy Cache - LLM call result caching
 *
 * Caches DSPy signature execution results keyed by deterministic input hash.
 * Uses Redis for persistence with 7-day TTL.
 *
 * Usage:
 *   import { dspyCache } from './redis/dspy-cache.js';
 *
 *   // Check cache before LLM call
 *   const cached = await dspyCache.get('roadmap', { prompt, researchFiles });
 *   if (cached) return cached.result;
 *
 *   // Cache result after LLM call
 *   const result = await llmCall(...);
 *   await dspyCache.set('roadmap', inputs, result, { model, tokens, latency });
 */

class DSPyCache {
  constructor() {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      errors: 0,
      bySignature: {}
    };

    // Initialize per-signature metrics
    for (const type of SIGNATURE_TYPES) {
      this.metrics.bySignature[type] = { hits: 0, misses: 0, sets: 0 };
    }
  }

  /**
   * Get cached result for signature execution
   *
   * @param {string} signatureType - Signature type
   * @param {Object} inputs - Signature inputs (prompt, researchFiles, etc.)
   * @returns {Promise<{result, metadata, cacheInfo}|null>}
   */
  async get(signatureType, inputs) {
    // Generate cache key
    const keyInfo = generateCacheKey(signatureType, inputs);

    // Check Redis
    const client = await getRedisClient();
    if (!client) {
      this.metrics.misses++;
      this.metrics.bySignature[signatureType].misses++;
      return null;
    }

    try {
      const raw = await client.get(keyInfo.fullKey);

      if (!raw) {
        this.metrics.misses++;
        this.metrics.bySignature[signatureType].misses++;
        return null;
      }

      // Deserialize entry
      const entry = await deserializeEntry(raw);

      // Check expiration (Redis TTL should handle this, but double-check)
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await client.del(keyInfo.fullKey);
        this.metrics.misses++;
        this.metrics.bySignature[signatureType].misses++;
        return null;
      }

      // Update access metadata
      entry.hitCount++;
      entry.lastAccessedAt = Date.now();

      // Update entry in Redis (async, don't await)
      this.#updateAccessMetadata(client, keyInfo.fullKey, entry).catch(() => {});

      // Record hit
      this.metrics.hits++;
      this.metrics.bySignature[signatureType].hits++;

      console.log(`[DSPyCache] HIT for ${signatureType} (hash: ${keyInfo.hash.slice(0, 8)}...)`);

      return {
        result: entry.result,
        metadata: entry.metadata,
        cacheInfo: {
          key: keyInfo.fullKey,
          cachedAt: new Date(entry.cachedAt).toISOString(),
          hitCount: entry.hitCount,
          ageMs: Date.now() - entry.cachedAt
        }
      };

    } catch (error) {
      console.error(`[DSPyCache] Get error:`, error.message);
      this.metrics.errors++;
      this.metrics.misses++;
      this.metrics.bySignature[signatureType].misses++;
      return null;
    }
  }

  /**
   * Cache a signature execution result
   *
   * @param {string} signatureType - Signature type
   * @param {Object} inputs - Signature inputs
   * @param {Object} result - LLM response to cache
   * @param {Object} metadata - Execution metadata
   * @returns {Promise<string|null>} Cache key or null on failure
   */
  async set(signatureType, inputs, result, metadata = {}) {
    // Generate cache key
    const keyInfo = generateCacheKey(signatureType, inputs);

    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    try {
      // Create entry
      const entry = createEntry(keyInfo, result, metadata);

      // Serialize
      const serialized = await serializeEntry(entry);

      // Store with TTL
      const ttlSeconds = CONFIG.REDIS.ttl.dspy;
      await client.setex(keyInfo.fullKey, ttlSeconds, serialized);

      // Record set
      this.metrics.sets++;
      this.metrics.bySignature[signatureType].sets++;

      console.log(`[DSPyCache] SET for ${signatureType} (hash: ${keyInfo.hash.slice(0, 8)}..., TTL: ${ttlSeconds}s)`);

      return keyInfo.fullKey;

    } catch (error) {
      console.error(`[DSPyCache] Set error:`, error.message);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Invalidate cache entries
   *
   * @param {string} signatureType - Filter by type (optional)
   * @param {string} specificKey - Specific key to invalidate (optional)
   * @returns {Promise<number>} Number of entries removed
   */
  async invalidate(signatureType = null, specificKey = null) {
    const client = await getRedisClient();
    if (!client) {
      return 0;
    }

    try {
      let keysToDelete = [];

      if (specificKey) {
        // Delete specific key
        keysToDelete = [specificKey];
      } else if (signatureType) {
        // Delete all for signature type
        const pattern = `${CONFIG.REDIS.keyPrefixes.dspy}${signatureType}:*`;
        keysToDelete = await client.keys(pattern);
      } else {
        // Delete all DSPy cache entries
        const pattern = `${CONFIG.REDIS.keyPrefixes.dspy}*`;
        keysToDelete = await client.keys(pattern);
      }

      if (keysToDelete.length === 0) {
        return 0;
      }

      await client.del(...keysToDelete);

      this.metrics.invalidations += keysToDelete.length;
      console.log(`[DSPyCache] Invalidated ${keysToDelete.length} entries`);

      return keysToDelete.length;

    } catch (error) {
      console.error(`[DSPyCache] Invalidate error:`, error.message);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Get cache statistics
   *
   * @param {string} signatureType - Filter by type (optional)
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats(signatureType = null) {
    const client = await getRedisClient();

    const stats = {
      connected: client !== null,
      totalHits: this.metrics.hits,
      totalMisses: this.metrics.misses,
      totalSets: this.metrics.sets,
      hitRate: this.metrics.hits + this.metrics.misses > 0
        ? ((this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100).toFixed(1) + '%'
        : '0%',
      errors: this.metrics.errors,
      invalidations: this.metrics.invalidations,
      bySignature: this.metrics.bySignature
    };

    // Get entry counts from Redis
    if (client) {
      try {
        const prefix = CONFIG.REDIS.keyPrefixes.dspy;

        if (signatureType) {
          const pattern = `${prefix}${signatureType}:*`;
          const keys = await client.keys(pattern);
          stats.entryCount = keys.length;
        } else {
          stats.entryCounts = {};
          for (const type of SIGNATURE_TYPES) {
            const pattern = `${prefix}${type}:*`;
            const keys = await client.keys(pattern);
            stats.entryCounts[type] = keys.length;
          }
          stats.totalEntries = Object.values(stats.entryCounts).reduce((a, b) => a + b, 0);
        }

        // Estimate cost savings
        stats.estimatedSavings = this.#estimateCostSavings();

      } catch (error) {
        stats.redisError = error.message;
      }
    }

    return stats;
  }

  /**
   * Update access metadata for entry
   * @private
   */
  async #updateAccessMetadata(client, key, entry) {
    try {
      const serialized = await serializeEntry(entry);
      const ttl = await client.ttl(key);
      if (ttl > 0) {
        await client.setex(key, ttl, serialized);
      }
    } catch {
      // Non-critical, ignore errors
    }
  }

  /**
   * Estimate cost savings from cache hits
   * @private
   */
  #estimateCostSavings() {
    // Rough cost estimates per signature type (in USD)
    const costPerCall = {
      'roadmap': 0.02,           // ~2 cents per roadmap generation
      'slides': 0.015,           // ~1.5 cents per slides generation
      'document': 0.025,         // ~2.5 cents per document generation
      'research-analysis': 0.01  // ~1 cent per analysis
    };

    let totalSavings = 0;
    for (const [type, metrics] of Object.entries(this.metrics.bySignature)) {
      const cost = costPerCall[type] || 0.01;
      totalSavings += metrics.hits * cost;
    }

    return {
      estimatedUSD: totalSavings.toFixed(2),
      callsAvoided: this.metrics.hits
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      errors: 0,
      bySignature: {}
    };

    for (const type of SIGNATURE_TYPES) {
      this.metrics.bySignature[type] = { hits: 0, misses: 0, sets: 0 };
    }
  }
}

// Singleton instance
export const dspyCache = new DSPyCache();

export default DSPyCache;
```

---

## Phase 4: DSPy Integration Wrapper

### Objective
Create wrapper functions for DSPy signature execution with caching.

### Implementation

```javascript
// server/utils/dspyExecutor.js

import { dspyCache } from '../redis/dspy-cache.js';

/**
 * DSPy Executor with Caching
 *
 * Wraps DSPy signature execution with automatic cache lookup and storage.
 *
 * Usage:
 *   import { executeWithCache } from './utils/dspyExecutor.js';
 *
 *   const result = await executeWithCache('roadmap', inputs, async () => {
 *     return await dspySignature.forward(inputs);
 *   });
 */

/**
 * Execute DSPy signature with caching
 *
 * @param {string} signatureType - Signature type (roadmap, slides, etc.)
 * @param {Object} inputs - Signature inputs
 * @param {Function} executor - Async function that executes the signature
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Result with cache info
 */
export async function executeWithCache(signatureType, inputs, executor, options = {}) {
  const {
    skipCache = false,
    forceRefresh = false,
    modelTier = 'standard',
    temperature = 0
  } = options;

  // Normalize inputs for caching
  const cacheInputs = {
    prompt: inputs.prompt || inputs.userPrompt,
    researchFiles: inputs.researchFiles || inputs.research_files || [],
    modelTier,
    temperature
  };

  // Check cache first (unless skipping or forcing refresh)
  if (!skipCache && !forceRefresh) {
    const cached = await dspyCache.get(signatureType, cacheInputs);

    if (cached) {
      return {
        ...cached.result,
        __cacheHit: true,
        __cacheInfo: cached.cacheInfo
      };
    }
  }

  // Execute signature
  const startTime = Date.now();
  let result;
  let executionMetadata = {};

  try {
    result = await executor();

    executionMetadata = {
      model: result.__model || options.model || 'unknown',
      modelTier,
      inputTokens: result.__inputTokens || 0,
      outputTokens: result.__outputTokens || 0,
      latencyMs: Date.now() - startTime
    };

    // Clean internal fields from result before caching
    const cleanResult = { ...result };
    delete cleanResult.__model;
    delete cleanResult.__inputTokens;
    delete cleanResult.__outputTokens;

    // Cache result (unless skipping cache)
    if (!skipCache) {
      await dspyCache.set(signatureType, cacheInputs, cleanResult, executionMetadata);
    }

    return {
      ...cleanResult,
      __cacheHit: false,
      __executionMetadata: executionMetadata
    };

  } catch (error) {
    // Don't cache errors
    throw error;
  }
}

/**
 * Batch execute with caching
 * Useful for processing multiple prompts with potential cache hits
 */
export async function executeBatchWithCache(signatureType, inputsArray, executor) {
  const results = [];

  for (const inputs of inputsArray) {
    try {
      const result = await executeWithCache(signatureType, inputs, () => executor(inputs));
      results.push({ success: true, result });
    } catch (error) {
      results.push({ success: false, error: error.message, inputs });
    }
  }

  const cacheHits = results.filter(r => r.success && r.result.__cacheHit).length;
  const cacheMisses = results.filter(r => r.success && !r.result.__cacheHit).length;
  const errors = results.filter(r => !r.success).length;

  return {
    results,
    summary: {
      total: inputsArray.length,
      cacheHits,
      cacheMisses,
      errors,
      cacheHitRate: inputsArray.length > 0
        ? ((cacheHits / inputsArray.length) * 100).toFixed(1) + '%'
        : '0%'
    }
  };
}

/**
 * Check if inputs would result in cache hit (without retrieving result)
 */
export async function wouldCacheHit(signatureType, inputs) {
  const cacheInputs = {
    prompt: inputs.prompt || inputs.userPrompt,
    researchFiles: inputs.researchFiles || [],
    modelTier: inputs.modelTier || 'standard',
    temperature: inputs.temperature ?? 0
  };

  const cached = await dspyCache.get(signatureType, cacheInputs);
  return cached !== null;
}
```

---

## Phase 5: Cache Management API

### Objective
Create REST API endpoints for cache management and monitoring.

### Implementation

```javascript
// server/routes/dspy-cache.js

import express from 'express';
import { dspyCache, SIGNATURE_TYPES } from '../redis/dspy-cache.js';

const router = express.Router();

/**
 * GET /api/cache/dspy/stats
 * Get cache statistics
 */
router.get('/stats', async (req, res) => {
  const { signatureType } = req.query;

  // Validate signature type if provided
  if (signatureType && !SIGNATURE_TYPES.includes(signatureType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid signatureType. Must be one of: ${SIGNATURE_TYPES.join(', ')}`
    });
  }

  try {
    const stats = await dspyCache.getStats(signatureType);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cache/dspy/stats/:signatureType
 * Get statistics for specific signature type
 */
router.get('/stats/:signatureType', async (req, res) => {
  const { signatureType } = req.params;

  if (!SIGNATURE_TYPES.includes(signatureType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid signatureType. Must be one of: ${SIGNATURE_TYPES.join(', ')}`
    });
  }

  try {
    const stats = await dspyCache.getStats(signatureType);

    res.json({
      success: true,
      signatureType,
      stats: {
        ...stats,
        signatureMetrics: stats.bySignature[signatureType]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/cache/dspy/invalidate
 * Invalidate cache entries
 */
router.delete('/invalidate', async (req, res) => {
  const { signatureType, key } = req.query;

  // Validate signature type if provided
  if (signatureType && !SIGNATURE_TYPES.includes(signatureType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid signatureType. Must be one of: ${SIGNATURE_TYPES.join(', ')}`
    });
  }

  try {
    const count = await dspyCache.invalidate(signatureType, key);

    res.json({
      success: true,
      message: `Invalidated ${count} cache entries`,
      invalidated: count,
      filter: { signatureType, key }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cache/dspy/warmup
 * Warm up cache with common inputs (optional)
 */
router.post('/warmup', async (req, res) => {
  const { signatureType, inputs } = req.body;

  if (!signatureType || !SIGNATURE_TYPES.includes(signatureType)) {
    return res.status(400).json({
      success: false,
      error: `signatureType required and must be one of: ${SIGNATURE_TYPES.join(', ')}`
    });
  }

  // Note: Actual warmup would require executing signatures
  // This is a placeholder for future implementation

  res.json({
    success: true,
    message: 'Cache warmup is not yet implemented',
    signatureType
  });
});

/**
 * GET /api/cache/dspy/health
 * Cache health check
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await dspyCache.getStats();

    const health = {
      status: stats.connected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      redis: stats.connected,
      metrics: {
        hitRate: stats.hitRate,
        totalHits: stats.totalHits,
        totalMisses: stats.totalMisses,
        errors: stats.errors
      }
    };

    if (stats.totalEntries !== undefined) {
      health.metrics.totalEntries = stats.totalEntries;
    }

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

export default router;
```

---

## Phase 6: Training Loop Integration

### Objective
Integrate DSPy cache with the training generation pipeline.

### Implementation

```javascript
// In server/routes/training.js or generation modules

import { executeWithCache } from '../utils/dspyExecutor.js';
import { dspyCache } from '../redis/dspy-cache.js';

/**
 * Generate content with DSPy caching
 */
async function generateContent(contentType, userPrompt, researchFiles, options = {}) {
  const signatureType = contentType.toLowerCase();

  const inputs = {
    prompt: userPrompt,
    researchFiles,
    modelTier: options.modelTier || 'standard',
    temperature: options.temperature || 0
  };

  // Use cached execution
  const result = await executeWithCache(
    signatureType,
    inputs,
    async () => {
      // Actual DSPy signature execution
      return await executeSignature(signatureType, inputs, options);
    },
    {
      skipCache: options.skipCache || false,
      forceRefresh: options.forceRefresh || false,
      modelTier: options.modelTier,
      temperature: options.temperature
    }
  );

  // Log cache usage for training metrics
  if (result.__cacheHit) {
    console.log(`[Training] Cache HIT for ${signatureType} - saved LLM call`);
    trainingMetrics.recordCacheHit(signatureType);
  } else {
    console.log(`[Training] Cache MISS for ${signatureType} - executed LLM call`);
    trainingMetrics.recordCacheMiss(signatureType);
  }

  return result;
}

/**
 * Training loop with cache awareness
 */
async function runTrainingIteration(sample, variant) {
  const { contentType, prompt, researchFiles } = sample;

  // Training typically wants fresh generations for evaluation
  // But can use cache for baseline comparisons
  const useCache = variant === 'champion';  // Use cache for champion, fresh for candidate

  const result = await generateContent(contentType, prompt, researchFiles, {
    skipCache: !useCache,
    modelTier: variant === 'champion' ? 'standard' : 'standard'
  });

  return {
    ...result,
    variant,
    fromCache: result.__cacheHit || false
  };
}

/**
 * Log cache statistics at end of training session
 */
function logCacheStats() {
  dspyCache.getStats().then(stats => {
    console.log('\n=== DSPy Cache Statistics ===');
    console.log(`Hit Rate: ${stats.hitRate}`);
    console.log(`Total Hits: ${stats.totalHits}`);
    console.log(`Total Misses: ${stats.totalMisses}`);
    console.log(`Estimated Savings: $${stats.estimatedSavings?.estimatedUSD || '0.00'}`);
    console.log('By Signature Type:');
    for (const [type, metrics] of Object.entries(stats.bySignature)) {
      console.log(`  ${type}: ${metrics.hits} hits, ${metrics.misses} misses`);
    }
    console.log('==============================\n');
  });
}
```

---

## Success Criteria

1. **Hash Determinism**: Same inputs always produce same cache key
2. **Cache Hit Rate**: > 30% hit rate during typical training runs
3. **Cost Savings**: Measurable reduction in LLM API costs
4. **Performance**: Cache lookup < 10ms (Redis local)
5. **TTL Management**: Entries expire correctly after 7 days
6. **Metrics Accuracy**: Hit/miss counts match actual behavior
7. **Invalidation**: Ability to clear cache by type or entirely
8. **Integration**: Seamless integration with existing generation code

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `server/redis/dspy-cache.js` | Create | Main DSPy cache implementation |
| `server/utils/dspyExecutor.js` | Create | Execution wrapper with caching |
| `server/routes/dspy-cache.js` | Create | Cache management API |
| `server/routes/training.js` | Modify | Integrate cache with training |
| `server/redis/index.js` | Modify | Export DSPy cache |

---

## Testing Checklist

- [ ] Same inputs produce identical cache keys
- [ ] Different inputs produce different cache keys
- [ ] Cache hit returns stored result correctly
- [ ] Cache miss triggers LLM call and stores result
- [ ] Compressed entries decompress correctly
- [ ] TTL expiration works (7-day entries expire)
- [ ] Metrics accurately track hits/misses/sets
- [ ] Invalidation removes correct entries
- [ ] API endpoints return expected responses
- [ ] Works correctly when Redis unavailable (graceful degradation)

---

## Estimated Complexity

- Phase 1: Medium (hash algorithm design)
- Phase 2: Medium (serialization with compression)
- Phase 3: High (main cache class with all features)
- Phase 4: Medium (execution wrapper)
- Phase 5: Low (REST API)
- Phase 6: Medium (training integration)

**Total**: Medium-High complexity, ~3-4 days implementation

---

## Dependencies

- Requires **Plan 08: Redis Client Factory** to be implemented first
- Uses shared Redis client from `server/redis/client.js`
- Uses configuration from `server/config.js` REDIS section
