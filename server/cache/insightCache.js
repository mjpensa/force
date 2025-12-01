/**
 * Insight Cache Module
 * 
 * Phase 4 Optimization: Caches extracted insights from map-reduce processing
 * to avoid redundant LLM calls when reprocessing similar content.
 * 
 * Features:
 * - Content hash-based caching
 * - TTL-based expiration
 * - Redis-backed persistence (with in-memory fallback)
 * - Cache hit/miss metrics
 */

import crypto from 'crypto';
import { getRedisClient } from '../redis/client.js';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_CONFIG = {
  ttlSeconds: 3600,           // 1 hour TTL for cached insights
  hashSampleSize: 50000,      // Characters to sample for hash (full chunk)
  memoryMaxSize: 100,         // Max entries in memory fallback
  keyPrefix: 'force:insights:' // Redis key prefix
};

// In-memory LRU fallback when Redis is unavailable
const memoryCache = new Map();
const accessOrder = [];

// Cache metrics
const metrics = {
  hits: 0,
  misses: 0,
  redisHits: 0,
  memoryHits: 0,
  writes: 0,
  errors: 0
};

// ============================================================================
// HASH GENERATION
// ============================================================================

/**
 * Generate a content hash for cache key
 * Uses SHA-256 with truncation for a unique but compact key
 * 
 * @param {string} content - Chunk content to hash
 * @returns {string} 16-character hex hash
 */
export function generateContentHash(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  // Use full content up to sample size
  const sample = content.substring(0, CACHE_CONFIG.hashSampleSize);
  
  return crypto
    .createHash('sha256')
    .update(sample)
    .digest('hex')
    .substring(0, 16);
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get cached insights for a chunk
 * Tries Redis first, falls back to memory cache
 * 
 * @param {string} contentHash - Hash of chunk content
 * @returns {Promise<object|null>} Cached insights or null
 */
export async function getCachedInsights(contentHash) {
  if (!contentHash) return null;
  
  const cacheKey = `${CACHE_CONFIG.keyPrefix}${contentHash}`;
  
  // Try Redis first
  try {
    const redis = await getRedisClient();
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        metrics.hits++;
        metrics.redisHits++;
        console.log(`[InsightCache] Redis hit for ${contentHash.substring(0, 8)}...`);
        return JSON.parse(cached);
      }
    }
  } catch (error) {
    console.warn(`[InsightCache] Redis get error: ${error.message}`);
    metrics.errors++;
  }
  
  // Fallback to memory cache
  if (memoryCache.has(cacheKey)) {
    const entry = memoryCache.get(cacheKey);
    
    // Check TTL
    if (Date.now() < entry.expiresAt) {
      metrics.hits++;
      metrics.memoryHits++;
      updateAccessOrder(cacheKey);
      console.log(`[InsightCache] Memory hit for ${contentHash.substring(0, 8)}...`);
      return entry.data;
    } else {
      // Expired - remove it
      memoryCache.delete(cacheKey);
      removeFromAccessOrder(cacheKey);
    }
  }
  
  metrics.misses++;
  return null;
}

/**
 * Cache extracted insights
 * Writes to both Redis and memory cache
 * 
 * @param {string} contentHash - Hash of chunk content
 * @param {object} insights - Extracted insights to cache
 * @returns {Promise<boolean>} Success status
 */
export async function cacheInsights(contentHash, insights) {
  if (!contentHash || !insights) return false;
  
  const cacheKey = `${CACHE_CONFIG.keyPrefix}${contentHash}`;
  const serialized = JSON.stringify(insights);
  
  metrics.writes++;
  
  // Write to Redis
  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.setex(cacheKey, CACHE_CONFIG.ttlSeconds, serialized);
      console.log(`[InsightCache] Cached to Redis: ${contentHash.substring(0, 8)}...`);
    }
  } catch (error) {
    console.warn(`[InsightCache] Redis set error: ${error.message}`);
    metrics.errors++;
  }
  
  // Always write to memory cache as backup
  evictIfNeeded();
  memoryCache.set(cacheKey, {
    data: insights,
    expiresAt: Date.now() + (CACHE_CONFIG.ttlSeconds * 1000)
  });
  accessOrder.push(cacheKey);
  
  return true;
}

/**
 * Check if insights are cached for given content
 * Faster than getCachedInsights as it doesn't deserialize
 * 
 * @param {string} contentHash - Hash of chunk content
 * @returns {Promise<boolean>}
 */
export async function hasCachedInsights(contentHash) {
  if (!contentHash) return false;
  
  const cacheKey = `${CACHE_CONFIG.keyPrefix}${contentHash}`;
  
  // Check Redis
  try {
    const redis = await getRedisClient();
    if (redis) {
      const exists = await redis.exists(cacheKey);
      if (exists) return true;
    }
  } catch (error) {
    // Ignore Redis errors for existence check
  }
  
  // Check memory
  if (memoryCache.has(cacheKey)) {
    const entry = memoryCache.get(cacheKey);
    return Date.now() < entry.expiresAt;
  }
  
  return false;
}

/**
 * Clear all cached insights
 * Useful for testing or when content analysis logic changes
 * 
 * @returns {Promise<void>}
 */
export async function clearInsightCache() {
  // Clear memory cache
  memoryCache.clear();
  accessOrder.length = 0;
  
  // Clear Redis entries
  try {
    const redis = await getRedisClient();
    if (redis) {
      const keys = await redis.keys(`${CACHE_CONFIG.keyPrefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`[InsightCache] Cleared ${keys.length} Redis entries`);
      }
    }
  } catch (error) {
    console.warn(`[InsightCache] Redis clear error: ${error.message}`);
  }
  
  // Reset metrics
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.redisHits = 0;
  metrics.memoryHits = 0;
  metrics.writes = 0;
  metrics.errors = 0;
}

// ============================================================================
// LRU HELPERS
// ============================================================================

function updateAccessOrder(key) {
  const idx = accessOrder.indexOf(key);
  if (idx > -1) {
    accessOrder.splice(idx, 1);
  }
  accessOrder.push(key);
}

function removeFromAccessOrder(key) {
  const idx = accessOrder.indexOf(key);
  if (idx > -1) {
    accessOrder.splice(idx, 1);
  }
}

function evictIfNeeded() {
  while (memoryCache.size >= CACHE_CONFIG.memoryMaxSize && accessOrder.length > 0) {
    const oldest = accessOrder.shift();
    memoryCache.delete(oldest);
  }
}

// ============================================================================
// METRICS & STATS
// ============================================================================

/**
 * Get cache metrics
 * @returns {object} Cache statistics
 */
export function getInsightCacheMetrics() {
  const total = metrics.hits + metrics.misses;
  return {
    ...metrics,
    hitRate: total > 0 ? (metrics.hits / total * 100).toFixed(1) + '%' : '0%',
    memorySize: memoryCache.size,
    memoryMaxSize: CACHE_CONFIG.memoryMaxSize
  };
}

/**
 * Get cache configuration
 * @returns {object} Current configuration
 */
export function getInsightCacheConfig() {
  return { ...CACHE_CONFIG };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  generateContentHash,
  getCachedInsights,
  cacheInsights,
  hasCachedInsights,
  clearInsightCache,
  getInsightCacheMetrics,
  getInsightCacheConfig
};
