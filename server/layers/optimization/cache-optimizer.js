/**
 * Cache Optimizer - PROMPT ML Layer 9
 *
 * Intelligent caching strategies for LLM operations:
 * - Adaptive TTL based on content type
 * - Cache warming for predictable requests
 * - Similarity-based cache lookup
 * - Cache eviction optimization
 *
 * Based on PROMPT ML design specification.
 */

import { createHash } from 'crypto';

/**
 * Cache eviction policies
 * @readonly
 * @enum {string}
 */
export const EvictionPolicy = {
  LRU: 'lru',           // Least Recently Used
  LFU: 'lfu',           // Least Frequently Used
  FIFO: 'fifo',         // First In First Out
  TTL: 'ttl',           // Time To Live based
  ADAPTIVE: 'adaptive'  // Adaptive based on value
};

/**
 * @typedef {Object} CacheEntry
 * @property {string} key - Cache key
 * @property {*} value - Cached value
 * @property {number} createdAt - Creation timestamp
 * @property {number} accessedAt - Last access timestamp
 * @property {number} accessCount - Access count
 * @property {number} ttl - Time to live (ms)
 * @property {number} size - Estimated size in bytes
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} CacheConfig
 * @property {number} maxSize - Maximum cache size (entries)
 * @property {number} maxMemory - Maximum memory usage (bytes)
 * @property {number} defaultTTL - Default TTL in ms
 * @property {EvictionPolicy} evictionPolicy - Eviction policy
 */

const DEFAULT_CONFIG = {
  maxSize: 100,
  maxMemory: 100 * 1024 * 1024, // 100MB
  defaultTTL: 3600000, // 1 hour
  evictionPolicy: EvictionPolicy.ADAPTIVE
};

/**
 * Adaptive TTL Calculator
 */
class AdaptiveTTLCalculator {
  constructor() {
    this.contentTypeTTLs = new Map();
    this.hitRates = new Map();
  }

  /**
   * Calculate optimal TTL for content type
   * @param {string} contentType - Content type
   * @param {Object} metrics - Cache metrics
   * @returns {number} Optimal TTL in ms
   */
  calculate(contentType, metrics = {}) {
    // Base TTLs by content type (different content changes at different rates)
    const baseTTLs = {
      roadmap: 7200000,            // 2 hours - timelines are relatively stable
      slides: 3600000,             // 1 hour - presentations may need updates
      document: 5400000,           // 1.5 hours - documents are moderately stable
      'research-analysis': 1800000 // 30 min - analysis may need frequent updates
    };

    let ttl = baseTTLs[contentType] || 3600000;

    // Adjust based on hit rate
    const hitRate = this.hitRates.get(contentType) || 0.5;
    if (hitRate > 0.7) {
      // High hit rate - content is accessed frequently, keep longer
      ttl *= 1.5;
    } else if (hitRate < 0.2) {
      // Low hit rate - reduce TTL to save memory
      ttl *= 0.5;
    }

    // Adjust based on regeneration rate
    if (metrics.regenerationRate > 0.3) {
      // High regeneration means cache is often stale
      ttl *= 0.7;
    }

    // Cap TTL
    return Math.min(Math.max(ttl, 300000), 86400000); // 5 min to 24 hours
  }

  /**
   * Update hit rate for content type
   * @param {string} contentType
   * @param {boolean} wasHit
   */
  recordAccess(contentType, wasHit) {
    const current = this.hitRates.get(contentType) || { hits: 0, total: 0 };
    current.total++;
    if (wasHit) current.hits++;

    // Calculate rolling hit rate
    this.hitRates.set(contentType, current.hits / current.total);
  }
}

/**
 * Similarity-based cache lookup
 */
class SimilarityMatcher {
  constructor(threshold = 0.8) {
    this.threshold = threshold;
  }

  /**
   * Calculate similarity between two strings
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;

    // Normalize
    const normA = this._normalize(a);
    const normB = this._normalize(b);

    // Calculate Jaccard similarity on word sets
    const wordsA = new Set(normA.split(/\s+/));
    const wordsB = new Set(normB.split(/\s+/));

    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * Find similar entries in cache
   * @param {string} query - Query string
   * @param {Map} cache - Cache entries
   * @returns {Array} Similar entries sorted by similarity
   */
  findSimilar(query, cache) {
    const results = [];

    for (const [key, entry] of cache) {
      const similarity = this.calculateSimilarity(query, entry.metadata?.prompt || '');
      if (similarity >= this.threshold) {
        results.push({ key, entry, similarity });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  _normalize(str) {
    return str.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * Cache Optimizer class
 */
export class CacheOptimizer {
  /**
   * @param {CacheConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.ttlCalculator = new AdaptiveTTLCalculator();
    this.similarityMatcher = new SimilarityMatcher(0.85);
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      similarityHits: 0,
      totalSize: 0
    };
    this.warmingQueue = [];
  }

  /**
   * Generate cache key
   * @param {string} contentType - Content type
   * @param {string} prompt - User prompt
   * @param {string} contentHash - Content hash
   * @returns {string} Cache key
   */
  generateKey(contentType, prompt, contentHash) {
    const data = `${contentType}:${prompt}:${contentHash}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Get item from cache with optimization
   * @param {string} key - Cache key
   * @param {Object} options - Get options
   * @returns {*} Cached value or null
   */
  get(key, options = {}) {
    const entry = this.cache.get(key);

    if (entry) {
      // Check TTL
      if (Date.now() - entry.createdAt > entry.ttl) {
        this.cache.delete(key);
        this.metrics.evictions++;
        this.metrics.misses++;
        return null;
      }

      // Update access metadata
      entry.accessedAt = Date.now();
      entry.accessCount++;
      this.metrics.hits++;

      // Record for adaptive TTL
      this.ttlCalculator.recordAccess(entry.metadata?.contentType, true);

      return entry.value;
    }

    // Try similarity-based lookup if enabled
    if (options.allowSimilar && options.prompt) {
      const similar = this.similarityMatcher.findSimilar(options.prompt, this.cache);
      if (similar.length > 0 && similar[0].similarity > 0.9) {
        this.metrics.similarityHits++;
        const matchedEntry = similar[0].entry;
        matchedEntry.accessedAt = Date.now();
        matchedEntry.accessCount++;
        return matchedEntry.value;
      }
    }

    this.metrics.misses++;
    this.ttlCalculator.recordAccess(options.contentType, false);
    return null;
  }

  /**
   * Set item in cache with optimization
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} options - Set options
   */
  set(key, value, options = {}) {
    // Calculate optimal TTL
    const ttl = options.ttl || this.ttlCalculator.calculate(options.contentType, {
      regenerationRate: this._getRegenerationRate(options.contentType)
    });

    // Estimate size
    const size = this._estimateSize(value);

    // Check if we need to evict
    this._ensureCapacity(size);

    const entry = {
      key,
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
      ttl,
      size,
      metadata: {
        contentType: options.contentType,
        prompt: options.prompt,
        qualityScore: options.qualityScore
      }
    };

    this.cache.set(key, entry);
    this.metrics.totalSize += size;
  }

  /**
   * Invalidate cache entries
   * @param {Object} filter - Filter criteria
   * @returns {number} Number of entries invalidated
   */
  invalidate(filter = {}) {
    let invalidated = 0;

    for (const [key, entry] of this.cache) {
      let shouldInvalidate = false;

      if (filter.contentType && entry.metadata?.contentType === filter.contentType) {
        shouldInvalidate = true;
      }

      if (filter.olderThan && entry.createdAt < filter.olderThan) {
        shouldInvalidate = true;
      }

      if (filter.qualityBelow && entry.metadata?.qualityScore < filter.qualityBelow) {
        shouldInvalidate = true;
      }

      if (shouldInvalidate) {
        this.cache.delete(key);
        this.metrics.totalSize -= entry.size;
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Schedule cache warming for predictable requests
   * @param {Object} warmingTask - Task to warm
   */
  scheduleWarming(warmingTask) {
    this.warmingQueue.push({
      ...warmingTask,
      scheduledAt: Date.now()
    });
  }

  /**
   * Get next items to warm
   * @param {number} count - Number of items
   * @returns {Array} Warming tasks
   */
  getWarmingTasks(count = 5) {
    return this.warmingQueue.splice(0, count);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const hitRate = this.metrics.hits + this.metrics.misses > 0
      ? this.metrics.hits / (this.metrics.hits + this.metrics.misses)
      : 0;

    // Calculate size by content type
    const sizeByType = {};
    const countByType = {};
    for (const entry of this.cache.values()) {
      const ct = entry.metadata?.contentType || 'unknown';
      sizeByType[ct] = (sizeByType[ct] || 0) + entry.size;
      countByType[ct] = (countByType[ct] || 0) + 1;
    }

    return {
      entries: this.cache.size,
      maxSize: this.config.maxSize,
      totalSizeBytes: this.metrics.totalSize,
      maxMemory: this.config.maxMemory,
      memoryUtilization: (this.metrics.totalSize / this.config.maxMemory * 100).toFixed(1) + '%',
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate: (hitRate * 100).toFixed(1) + '%',
      similarityHits: this.metrics.similarityHits,
      evictions: this.metrics.evictions,
      sizeByType,
      countByType,
      warmingQueueSize: this.warmingQueue.length
    };
  }

  /**
   * Get optimization recommendations
   * @returns {Array} Recommendations
   */
  getRecommendations() {
    const recommendations = [];
    const stats = this.getStats();
    const hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses || 1);

    // Low hit rate
    if (hitRate < 0.3 && this.metrics.hits + this.metrics.misses > 100) {
      recommendations.push({
        type: 'low_hit_rate',
        message: 'Cache hit rate is low. Consider enabling similarity matching or increasing TTL.',
        metric: `Hit rate: ${(hitRate * 100).toFixed(1)}%`
      });
    }

    // High memory usage
    if (this.metrics.totalSize > this.config.maxMemory * 0.9) {
      recommendations.push({
        type: 'high_memory',
        message: 'Cache memory usage is high. Consider reducing TTL or cache size.',
        metric: `Memory: ${stats.memoryUtilization}`
      });
    }

    // Many evictions
    if (this.metrics.evictions > this.metrics.hits * 0.5) {
      recommendations.push({
        type: 'high_evictions',
        message: 'High eviction rate indicates cache is too small.',
        metric: `Evictions: ${this.metrics.evictions}`
      });
    }

    // Underutilized cache
    if (this.cache.size < this.config.maxSize * 0.2 && hitRate > 0.7) {
      recommendations.push({
        type: 'underutilized',
        message: 'Cache is underutilized. Consider increasing cache warming.',
        metric: `Utilization: ${(this.cache.size / this.config.maxSize * 100).toFixed(1)}%`
      });
    }

    return recommendations;
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
    this.metrics.totalSize = 0;
  }

  // Private methods

  _ensureCapacity(newSize) {
    // Check entry count
    while (this.cache.size >= this.config.maxSize) {
      this._evictOne();
    }

    // Check memory
    while (this.metrics.totalSize + newSize > this.config.maxMemory && this.cache.size > 0) {
      this._evictOne();
    }
  }

  _evictOne() {
    const evictionTarget = this._selectEvictionTarget();
    if (evictionTarget) {
      this.metrics.totalSize -= evictionTarget.size;
      this.cache.delete(evictionTarget.key);
      this.metrics.evictions++;
    }
  }

  _selectEvictionTarget() {
    if (this.cache.size === 0) return null;

    switch (this.config.evictionPolicy) {
      case EvictionPolicy.LRU:
        return this._selectLRU();
      case EvictionPolicy.LFU:
        return this._selectLFU();
      case EvictionPolicy.FIFO:
        return this._selectFIFO();
      case EvictionPolicy.ADAPTIVE:
      default:
        return this._selectAdaptive();
    }
  }

  _selectLRU() {
    let oldest = null;
    for (const entry of this.cache.values()) {
      if (!oldest || entry.accessedAt < oldest.accessedAt) {
        oldest = entry;
      }
    }
    return oldest;
  }

  _selectLFU() {
    let leastUsed = null;
    for (const entry of this.cache.values()) {
      if (!leastUsed || entry.accessCount < leastUsed.accessCount) {
        leastUsed = entry;
      }
    }
    return leastUsed;
  }

  _selectFIFO() {
    let oldest = null;
    for (const entry of this.cache.values()) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = entry;
      }
    }
    return oldest;
  }

  _selectAdaptive() {
    // Combine factors: age, access frequency, quality
    let bestTarget = null;
    let lowestScore = Infinity;

    const now = Date.now();

    for (const entry of this.cache.values()) {
      // Calculate eviction score (lower = more likely to evict)
      const age = now - entry.createdAt;
      const recency = now - entry.accessedAt;
      const frequency = entry.accessCount;
      const quality = entry.metadata?.qualityScore || 0.5;

      // Evict: old, not recently accessed, low frequency, low quality
      const score = (frequency * 10) + (quality * 5) - (recency / 60000) - (age / 600000);

      if (score < lowestScore) {
        lowestScore = score;
        bestTarget = entry;
      }
    }

    return bestTarget;
  }

  _estimateSize(value) {
    return JSON.stringify(value).length * 2; // Rough estimate for string storage
  }

  _getRegenerationRate(contentType) {
    // This would ideally come from feedback/metrics
    // For now, return default rates
    const rates = {
      roadmap: 0.1,
      slides: 0.15,
      document: 0.1,
      'research-analysis': 0.2
    };
    return rates[contentType] || 0.15;
  }
}

// Singleton instance
let _cacheOptimizer = null;

/**
 * Get or create singleton cache optimizer
 * @param {CacheConfig} config - Configuration
 * @returns {CacheOptimizer}
 */
export function getCacheOptimizer(config = {}) {
  if (!_cacheOptimizer) {
    _cacheOptimizer = new CacheOptimizer(config);
  }
  return _cacheOptimizer;
}

/**
 * Reset cache optimizer (for testing)
 */
export function resetCacheOptimizer() {
  _cacheOptimizer = null;
}

export default CacheOptimizer;
