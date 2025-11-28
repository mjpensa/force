/**
 * Content Cache Module
 *
 * Implements intelligent caching to avoid redundant Gemini API calls:
 * - LRU (Least Recently Used) eviction policy
 * - Time-based expiration (TTL)
 * - Content hash-based deduplication
 * - Similarity-based matching for near-identical content
 * - Cache metrics for monitoring
 */

import crypto from 'crypto';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  maxSize: 100,                    // Maximum cache entries
  ttlMs: 24 * 60 * 60 * 1000,     // 24 hours default TTL
  hashSampleSize: 20000,           // Characters to sample for hash
  similarityThreshold: 0.9,        // 90% similarity for cache hit
  minGramSize: 3,                  // For similarity calculation
  enableSimilarity: true           // Toggle similarity matching
};

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================

/**
 * LRU Cache with TTL support
 */
class LRUCache {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.accessOrder = [];  // Track access order for LRU
    this.metrics = {
      hits: 0,
      misses: 0,
      exactHits: 0,
      similarityHits: 0,
      evictions: 0,
      expirations: 0,
      totalSaved: 0  // Estimated API calls saved
    };
  }

  /**
   * Generate a content hash for cache key
   * @param {string} content - Content to hash
   * @param {string} contentType - Type of content (roadmap, slides, etc.)
   * @param {string} prompt - User prompt
   * @returns {string} SHA-256 hash
   */
  generateHash(content, contentType, prompt = '') {
    // Sample content for efficiency (first N characters + last N/4)
    const sampleSize = this.config.hashSampleSize;
    let sample = content.substring(0, sampleSize);
    if (content.length > sampleSize) {
      sample += content.substring(content.length - Math.floor(sampleSize / 4));
    }

    // Include content type and prompt in hash for uniqueness
    const hashInput = `${contentType}:${prompt.substring(0, 500)}:${sample}`;

    return crypto.createHash('sha256')
      .update(hashInput)
      .digest('hex');
  }

  /**
   * Generate n-grams for similarity comparison
   * @param {string} text - Text to process
   * @param {number} n - Gram size
   * @returns {Set<string>} Set of n-grams
   */
  generateNGrams(text, n = this.config.minGramSize) {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const grams = new Set();

    // Sample for efficiency on large texts
    const sampleText = normalized.length > 10000
      ? normalized.substring(0, 5000) + normalized.substring(normalized.length - 5000)
      : normalized;

    for (let i = 0; i <= sampleText.length - n; i++) {
      grams.add(sampleText.substring(i, i + n));
    }
    return grams;
  }

  /**
   * Calculate Jaccard similarity between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(text1, text2) {
    const grams1 = this.generateNGrams(text1);
    const grams2 = this.generateNGrams(text2);

    let intersection = 0;
    for (const gram of grams1) {
      if (grams2.has(gram)) intersection++;
    }

    const union = grams1.size + grams2.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Find a similar entry in the cache
   * @param {string} content - Content to match
   * @param {string} contentType - Content type
   * @returns {object|null} Cached entry or null
   */
  findSimilar(content, contentType) {
    if (!this.config.enableSimilarity) return null;

    const now = Date.now();

    for (const [hash, entry] of this.cache) {
      // Skip different content types
      if (entry.contentType !== contentType) continue;

      // Skip expired entries
      if (now > entry.expiresAt) continue;

      // Calculate similarity
      const similarity = this.calculateSimilarity(content, entry.inputContent);

      if (similarity >= this.config.similarityThreshold) {
        return { hash, entry, similarity };
      }
    }

    return null;
  }

  /**
   * Get entry from cache
   * @param {string} hash - Cache key
   * @returns {object|null} Cached data or null
   */
  get(hash) {
    const entry = this.cache.get(hash);

    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(hash);
      this.metrics.expirations++;
      this.metrics.misses++;
      return null;
    }

    // Update access order (LRU)
    this._updateAccessOrder(hash);
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    this.metrics.hits++;
    this.metrics.exactHits++;
    this.metrics.totalSaved++;

    // Return deep copy to prevent cache mutation by callers
    // This is critical - returning reference would allow callers to corrupt cached data
    try {
      return JSON.parse(JSON.stringify(entry.data));
    } catch (error) {
      console.error('[Cache] Failed to clone cached data:', error.message);
      // If clone fails, delete potentially corrupted entry and return null
      this.cache.delete(hash);
      return null;
    }
  }

  /**
   * Get entry by content similarity
   * @param {string} content - Content to match
   * @param {string} contentType - Content type
   * @param {string} prompt - User prompt
   * @returns {object|null} Cached data or null
   */
  getByContent(content, contentType, prompt = '') {
    // First try exact match
    const hash = this.generateHash(content, contentType, prompt);
    const exactMatch = this.get(hash);
    if (exactMatch) return exactMatch;

    // Try similarity match
    const similar = this.findSimilar(content, contentType);
    if (similar) {
      this._updateAccessOrder(similar.hash);
      similar.entry.lastAccessed = Date.now();
      similar.entry.accessCount++;

      this.metrics.hits++;
      this.metrics.similarityHits++;
      this.metrics.totalSaved++;

      // Return deep copy to prevent mutation of cached data
      try {
        return JSON.parse(JSON.stringify(similar.entry.data));
      } catch (error) {
        console.error('[Cache] Failed to clone similarity match data:', error.message);
        return null;
      }
    }

    this.metrics.misses++;
    return null;
  }

  /**
   * Store entry in cache
   * @param {string} hash - Cache key
   * @param {object} data - Data to cache
   * @param {string} inputContent - Original input content (for similarity)
   * @param {string} contentType - Content type
   * @param {number} ttlMs - Time-to-live in milliseconds
   */
  set(hash, data, inputContent, contentType, ttlMs = this.config.ttlMs) {
    // Evict if at capacity
    while (this.cache.size >= this.config.maxSize) {
      this._evictLRU();
    }

    const entry = {
      data,
      inputContent: inputContent.substring(0, 30000), // Limit stored input size
      contentType,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + ttlMs,
      accessCount: 0,
      hash
    };

    this.cache.set(hash, entry);
    this._updateAccessOrder(hash);
  }

  /**
   * Store by content (auto-generates hash)
   * @param {string} content - Input content
   * @param {string} contentType - Content type
   * @param {string} prompt - User prompt
   * @param {object} data - Data to cache
   * @param {number} ttlMs - Time-to-live
   * @returns {string} Cache hash
   */
  setByContent(content, contentType, prompt, data, ttlMs = this.config.ttlMs) {
    const hash = this.generateHash(content, contentType, prompt);
    this.set(hash, data, content, contentType, ttlMs);
    return hash;
  }

  /**
   * Invalidate (delete) a cache entry
   * @param {string} hash - Cache key
   * @returns {boolean} True if entry was deleted
   */
  invalidate(hash) {
    const deleted = this.cache.delete(hash);
    if (deleted) {
      this.accessOrder = this.accessOrder.filter(h => h !== hash);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Clear expired entries
   * @returns {number} Number of entries cleared
   */
  clearExpired() {
    const now = Date.now();
    const expiredKeys = [];

    // Collect expired keys first (avoid modifying map while iterating)
    for (const [hash, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expiredKeys.push(hash);
      }
    }

    // Batch delete from cache
    for (const hash of expiredKeys) {
      this.cache.delete(hash);
      this.metrics.expirations++;
    }

    // Rebuild accessOrder once - O(n) instead of O(n*m) with repeated filter calls
    if (expiredKeys.length > 0) {
      const expiredSet = new Set(expiredKeys);
      this.accessOrder = this.accessOrder.filter(h => !expiredSet.has(h));
    }

    return expiredKeys.length;
  }

  /**
   * Update access order for LRU
   * @private
   */
  _updateAccessOrder(hash) {
    const index = this.accessOrder.indexOf(hash);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(hash);
  }

  /**
   * Evict least recently used entry
   * @private
   */
  _evictLRU() {
    if (this.accessOrder.length === 0) return;

    const lruHash = this.accessOrder.shift();
    this.cache.delete(lruHash);
    this.metrics.evictions++;
  }

  /**
   * Get cache statistics
   * @returns {object} Cache metrics
   */
  getMetrics() {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0
      ? (this.metrics.hits / totalRequests * 100).toFixed(2)
      : 0;

    return {
      ...this.metrics,
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: `${hitRate}%`,
      totalRequests
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      exactHits: 0,
      similarityHits: 0,
      evictions: 0,
      expirations: 0,
      totalSaved: 0
    };
  }

  /**
   * Get cache entry details (for debugging)
   * @param {string} hash - Cache key
   * @returns {object|null} Entry metadata
   */
  getEntryInfo(hash) {
    const entry = this.cache.get(hash);
    if (!entry) return null;

    return {
      hash,
      contentType: entry.contentType,
      createdAt: new Date(entry.createdAt).toISOString(),
      expiresAt: new Date(entry.expiresAt).toISOString(),
      lastAccessed: new Date(entry.lastAccessed).toISOString(),
      accessCount: entry.accessCount,
      dataSize: JSON.stringify(entry.data).length,
      inputSize: entry.inputContent.length,
      expired: Date.now() > entry.expiresAt
    };
  }

  /**
   * List all cache entries (metadata only)
   * @returns {Array} Array of entry metadata
   */
  listEntries() {
    return Array.from(this.cache.keys()).map(hash => this.getEntryInfo(hash));
  }
}

// ============================================================================
// GLOBAL CACHE INSTANCES
// ============================================================================

// Separate caches per content type for better eviction behavior
const caches = {
  roadmap: new LRUCache({ maxSize: 30, ttlMs: 12 * 60 * 60 * 1000 }),  // 12 hours
  slides: new LRUCache({ maxSize: 30, ttlMs: 12 * 60 * 60 * 1000 }),
  document: new LRUCache({ maxSize: 30, ttlMs: 12 * 60 * 60 * 1000 }),
  researchAnalysis: new LRUCache({ maxSize: 30, ttlMs: 12 * 60 * 60 * 1000 })
};

// Content type key mapping
const typeKeyMap = {
  'roadmap': 'roadmap',
  'slides': 'slides',
  'document': 'document',
  'research-analysis': 'researchAnalysis',
  'researchAnalysis': 'researchAnalysis'
};

/**
 * Get cached content for a specific type
 * @param {string} contentType - Content type
 * @param {string} inputContent - Combined input content
 * @param {string} prompt - User prompt
 * @returns {object|null} Cached data or null
 */
export function getCachedContent(contentType, inputContent, prompt = '') {
  const cacheKey = typeKeyMap[contentType] || contentType;
  const cache = caches[cacheKey];
  if (!cache) return null;

  return cache.getByContent(inputContent, cacheKey, prompt);
}

/**
 * Store content in cache
 * @param {string} contentType - Content type
 * @param {string} inputContent - Combined input content
 * @param {string} prompt - User prompt
 * @param {object} data - Generated data to cache
 * @returns {string} Cache hash
 */
export function setCachedContent(contentType, inputContent, prompt, data) {
  const cacheKey = typeKeyMap[contentType] || contentType;
  const cache = caches[cacheKey];
  if (!cache) return null;

  return cache.setByContent(inputContent, cacheKey, prompt, data);
}

/**
 * Generate ETag for content
 * @param {string} contentType - Content type
 * @param {string} inputContent - Input content
 * @param {string} prompt - User prompt
 * @returns {string} ETag string
 */
export function generateETag(contentType, inputContent, prompt = '') {
  const cacheKey = typeKeyMap[contentType] || contentType;
  const cache = caches[cacheKey];
  if (!cache) return null;

  const hash = cache.generateHash(inputContent, cacheKey, prompt);
  return `"${hash.substring(0, 16)}"`;
}

/**
 * Get aggregated cache metrics
 * @returns {object} Metrics for all caches
 */
export function getCacheMetrics() {
  const metrics = {};
  let totalHits = 0;
  let totalMisses = 0;
  let totalSaved = 0;

  for (const [type, cache] of Object.entries(caches)) {
    const m = cache.getMetrics();
    metrics[type] = m;
    totalHits += m.hits;
    totalMisses += m.misses;
    totalSaved += m.totalSaved;
  }

  const totalRequests = totalHits + totalMisses;

  return {
    byType: metrics,
    aggregate: {
      totalHits,
      totalMisses,
      totalRequests,
      hitRate: totalRequests > 0 ? `${(totalHits / totalRequests * 100).toFixed(2)}%` : '0%',
      estimatedApiCallsSaved: totalSaved,
      estimatedCostSavingsPercent: totalRequests > 0
        ? `${(totalSaved / totalRequests * 100).toFixed(1)}%`
        : '0%'
    }
  };
}

/**
 * Clear all caches
 */
export function clearAllCaches() {
  for (const cache of Object.values(caches)) {
    cache.clear();
  }
}

/**
 * Clear expired entries from all caches
 * @returns {number} Total entries cleared
 */
export function clearExpiredEntries() {
  let total = 0;
  for (const cache of Object.values(caches)) {
    total += cache.clearExpired();
  }
  return total;
}

/**
 * Reset all cache metrics
 */
export function resetCacheMetrics() {
  for (const cache of Object.values(caches)) {
    cache.resetMetrics();
  }
}

// Periodic cleanup of expired entries (every 5 minutes)
let cleanupIntervalId = setInterval(() => {
  clearExpiredEntries();
}, 5 * 60 * 1000);

/**
 * Stop the cleanup interval (for graceful shutdown)
 */
export function stopCleanupInterval() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

export { LRUCache, caches };
export default {
  getCachedContent,
  setCachedContent,
  generateETag,
  getCacheMetrics,
  clearAllCaches,
  clearExpiredEntries,
  resetCacheMetrics,
  stopCleanupInterval,
  LRUCache,
  caches
};
