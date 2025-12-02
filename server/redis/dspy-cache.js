/**
 * DSPy Cache - LLM Call Result Caching
 *
 * Plan 09: DSPy Cache Implementation
 *
 * Caches DSPy signature execution results keyed by deterministic input hash.
 * Uses Redis for persistence with 7-day TTL.
 *
 * Features:
 * - Deterministic hash-based cache keys
 * - Signature-type namespacing (roadmap, slides, document, research-analysis)
 * - Compression for large payloads
 * - Cache analytics and cost savings tracking
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

import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { getRedisClient } from './client.js';
import { CONFIG } from '../config.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ============================================================================
// CONSTANTS
// ============================================================================

// Valid signature types
const SIGNATURE_TYPES = ['roadmap', 'slides', 'document', 'research-analysis'];

// Cost estimates per signature type (USD) for savings calculation
const COST_PER_CALL = {
  'roadmap': 0.02,           // ~2 cents per roadmap generation
  'slides': 0.015,           // ~1.5 cents per slides generation
  'document': 0.025,         // ~2.5 cents per document generation
  'research-analysis': 0.01  // ~1 cent per analysis
};

// ============================================================================
// HASH GENERATION
// ============================================================================

/**
 * Normalize prompt for consistent hashing
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Normalize quotes
 */
function normalizePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return '';

  return prompt
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // Collapse whitespace
    .replace(/['']/g, "'")          // Normalize single quotes
    .replace(/[""]/g, '"')          // Normalize double quotes
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
    (a.filename || a.name || '').localeCompare(b.filename || b.name || '')
  );

  for (const file of sortedFiles) {
    const content = file.content || file.text || '';
    const filename = file.filename || file.name || 'unnamed';

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
    totalSize: sortedFiles.reduce((sum, f) => sum + ((f.content || f.text || '').length), 0),
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
 * @returns {Object} { fullKey, hash, signatureType, components }
 */
export function generateCacheKey(signatureType, inputs) {
  // Validate signature type
  if (!SIGNATURE_TYPES.includes(signatureType)) {
    throw new Error(`Invalid signature type: ${signatureType}. Must be one of: ${SIGNATURE_TYPES.join(', ')}`);
  }

  // Build hash components
  const components = {
    type: signatureType,
    prompt: normalizePrompt(inputs.prompt || inputs.userPrompt),
    contentHash: hashResearchContent(inputs.researchFiles || inputs.research_files || []),
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

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize cache entry for storage
 * Compresses result if over threshold
 */
async function serializeEntry(entry) {
  const threshold = CONFIG.REDIS.features.compressionThreshold;
  const resultJson = JSON.stringify(entry.result);

  let serializedResult;
  let compressed = false;

  // Compress if large
  if (CONFIG.REDIS.features.compression && resultJson.length > threshold) {
    try {
      const compressedBuffer = await gzip(Buffer.from(resultJson, 'utf8'));
      // Only use compression if it actually saves space (>10%)
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
async function deserializeEntry(raw) {
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
function createEntry(keyInfo, result, metadata) {
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

// ============================================================================
// DSPY CACHE CLASS
// ============================================================================

/**
 * DSPyCache - LLM call result caching
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
    // Validate signature type
    if (!SIGNATURE_TYPES.includes(signatureType)) {
      console.warn(`[DSPyCache] Invalid signature type: ${signatureType}`);
      this.metrics.errors++;
      return null;
    }

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

      // Update entry in Redis (async, don't await - fire and forget)
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
    // Validate signature type
    if (!SIGNATURE_TYPES.includes(signatureType)) {
      console.warn(`[DSPyCache] Invalid signature type: ${signatureType}`);
      this.metrics.errors++;
      return null;
    }

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
        // Validate signature type
        if (!SIGNATURE_TYPES.includes(signatureType)) {
          throw new Error(`Invalid signature type: ${signatureType}`);
        }
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
          if (!SIGNATURE_TYPES.includes(signatureType)) {
            stats.error = `Invalid signature type: ${signatureType}`;
            return stats;
          }
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
   * Check if inputs would result in cache hit (without retrieving result)
   *
   * @param {string} signatureType - Signature type
   * @param {Object} inputs - Signature inputs
   * @returns {Promise<boolean>}
   */
  async exists(signatureType, inputs) {
    if (!SIGNATURE_TYPES.includes(signatureType)) {
      return false;
    }

    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    try {
      const keyInfo = generateCacheKey(signatureType, inputs);
      const exists = await client.exists(keyInfo.fullKey);
      return exists === 1;
    } catch {
      return false;
    }
  }

  /**
   * Update access metadata for entry (fire and forget)
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
    let totalSavings = 0;
    for (const [type, metrics] of Object.entries(this.metrics.bySignature)) {
      const cost = COST_PER_CALL[type] || 0.01;
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

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const dspyCache = new DSPyCache();

// Export for testing and direct usage
export {
  DSPyCache,
  SIGNATURE_TYPES,
  normalizePrompt,
  hashResearchContent
};

export default dspyCache;
