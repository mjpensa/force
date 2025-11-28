/**
 * Session Storage Abstraction Layer
 *
 * Provides a unified interface for session storage with:
 * - Redis support for horizontal scaling and persistence
 * - In-memory fallback when Redis is unavailable
 * - Optional content compression for storage efficiency
 * - Automatic TTL management
 * - Connection health monitoring
 *
 * Usage:
 *   import { sessionStorage } from './storage/sessionStorage.js';
 *   await sessionStorage.set('sessionId', { data: ... });
 *   const session = await sessionStorage.get('sessionId');
 */

import { createHash } from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Redis connection settings
  redis: {
    url: process.env.REDIS_URL || null,
    keyPrefix: 'force:session:',
    connectTimeout: 5000,
    commandTimeout: 2000,
    retryAttempts: 3,
    retryDelay: 1000
  },
  // Session settings
  session: {
    ttlMs: 60 * 60 * 1000,  // 1 hour default TTL
    maxSessions: 100,  // Max sessions for in-memory storage
    compressionThreshold: 10000  // Compress content > 10KB
  },
  // Feature flags
  features: {
    compression: true,
    redisEnabled: process.env.REDIS_URL ? true : false
  }
};

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

/**
 * Compress data if it exceeds threshold
 * @param {object} data - Data to compress
 * @returns {Promise<{data: string|Buffer, compressed: boolean}>}
 */
async function maybeCompress(data) {
  const json = JSON.stringify(data);

  if (!CONFIG.features.compression || json.length < CONFIG.session.compressionThreshold) {
    return { data: json, compressed: false };
  }

  try {
    const compressed = await gzip(Buffer.from(json, 'utf8'));
    // Only use compressed if it's actually smaller
    if (compressed.length < json.length) {
      return { data: compressed.toString('base64'), compressed: true };
    }
  } catch {
    // Fall back to uncompressed on error
  }

  return { data: json, compressed: false };
}

/**
 * Decompress data if compressed
 * @param {string|Buffer} data - Data to decompress
 * @param {boolean} isCompressed - Whether data is compressed
 * @returns {Promise<object>}
 */
async function maybeDecompress(data, isCompressed) {
  if (!isCompressed) {
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  try {
    const buffer = Buffer.from(data, 'base64');
    const decompressed = await gunzip(buffer);
    return JSON.parse(decompressed.toString('utf8'));
  } catch (error) {
    throw new Error(`Failed to decompress session data: ${error.message}`);
  }
}

// ============================================================================
// IN-MEMORY STORAGE BACKEND
// ============================================================================

/**
 * In-memory storage implementation using Map
 * Includes LRU eviction and TTL management
 */
class MemoryStorage {
  constructor() {
    this.store = new Map();
    this.type = 'memory';

    // Periodic cleanup of expired sessions
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check TTL expiry
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.lastAccessed = Date.now();

    // Decompress if needed - handle errors gracefully
    try {
      return maybeDecompress(entry.data, entry.compressed);
    } catch (error) {
      // Data corruption - log and delete
      console.error(`[Storage] CRITICAL: Corrupted in-memory session ${key}: ${error.message}`);
      this.store.delete(key);
      return null;
    }
  }

  async set(key, value, ttlMs = CONFIG.session.ttlMs) {
    // Enforce session limit with LRU eviction
    this._enforceSizeLimit();

    const { data, compressed } = await maybeCompress(value);

    this.store.set(key, {
      data,
      compressed,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : null
    });

    return true;
  }

  async delete(key) {
    return this.store.delete(key);
  }

  async exists(key) {
    const entry = this.store.get(key);
    if (!entry) return false;

    // Check TTL
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  async touch(key) {
    const entry = this.store.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      return true;
    }
    return false;
  }

  async size() {
    return this.store.size;
  }

  async keys() {
    return Array.from(this.store.keys());
  }

  async clear() {
    this.store.clear();
    return true;
  }

  async getStats() {
    let totalSize = 0;
    let compressedCount = 0;

    for (const entry of this.store.values()) {
      totalSize += typeof entry.data === 'string' ? entry.data.length : 0;
      if (entry.compressed) compressedCount++;
    }

    return {
      type: 'memory',
      sessionCount: this.store.size,
      maxSessions: CONFIG.session.maxSessions,
      totalStorageBytes: totalSize,
      compressedSessions: compressedCount
    };
  }

  isHealthy() {
    return true;  // Memory storage is always healthy
  }

  _enforceSizeLimit() {
    if (this.store.size < CONFIG.session.maxSessions) return;

    // Sort by lastAccessed (oldest first) and remove excess
    const sorted = [...this.store.entries()]
      .sort((a, b) => (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0));

    const toRemove = this.store.size - CONFIG.session.maxSessions + 1;
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.store.delete(sorted[i][0]);
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
  }
}

// ============================================================================
// REDIS STORAGE BACKEND
// ============================================================================

/**
 * Redis storage implementation
 * Requires ioredis package when enabled
 */
class RedisStorage {
  constructor() {
    this.client = null;
    this.type = 'redis';
    this._connected = false;
    this._connectPromise = null;  // Mutex for connection
  }

  async connect() {
    // Return existing connection
    if (this._connected) return true;

    // Return in-flight connection promise (prevents race condition)
    if (this._connectPromise) return this._connectPromise;

    // Create new connection attempt
    this._connectPromise = this._doConnect();
    try {
      return await this._connectPromise;
    } finally {
      this._connectPromise = null;
    }
  }

  async _doConnect() {
    try {
      // Dynamic import of ioredis (optional dependency)
      const { default: Redis } = await import('ioredis');

      this.client = new Redis(CONFIG.redis.url, {
        connectTimeout: CONFIG.redis.connectTimeout,
        commandTimeout: CONFIG.redis.commandTimeout,
        maxRetriesPerRequest: CONFIG.redis.retryAttempts,
        retryStrategy: (times) => {
          if (times > CONFIG.redis.retryAttempts) return null;
          return Math.min(times * CONFIG.redis.retryDelay, 5000);
        },
        lazyConnect: true
      });

      // Connect and verify
      await this.client.connect();
      await this.client.ping();

      this._connected = true;
      console.log('[Storage] Redis connected successfully');
      return true;

    } catch (error) {
      console.warn(`[Storage] Redis connection failed: ${error.message}`);
      this._connected = false;
      if (this.client) {
        try { await this.client.quit(); } catch {}
        this.client = null;
      }
      return false;
    }
  }

  _key(key) {
    return CONFIG.redis.keyPrefix + key;
  }

  async get(key) {
    if (!this._connected) return null;

    try {
      const raw = await this.client.get(this._key(key));
      if (!raw) return null;

      const entry = JSON.parse(raw);
      return maybeDecompress(entry.data, entry.compressed);
    } catch (error) {
      // Distinguish between "not found" errors and data corruption
      if (error.message.includes('decompress') || error.message.includes('JSON')) {
        // Data corruption - log critical error and delete corrupted entry
        console.error(`[Storage] CRITICAL: Corrupted session data for key ${key}: ${error.message}`);
        try {
          await this.client.del(this._key(key));
          console.log(`[Storage] Deleted corrupted session: ${key}`);
        } catch (delError) {
          console.error(`[Storage] Failed to delete corrupted session: ${delError.message}`);
        }
      } else {
        console.error(`[Storage] Redis get error for ${key}: ${error.message}`);
      }
      return null;
    }
  }

  async set(key, value, ttlMs = CONFIG.session.ttlMs) {
    if (!this._connected) return false;

    try {
      const { data, compressed } = await maybeCompress(value);
      const entry = JSON.stringify({ data, compressed, createdAt: Date.now() });

      if (ttlMs) {
        await this.client.setex(this._key(key), Math.ceil(ttlMs / 1000), entry);
      } else {
        await this.client.set(this._key(key), entry);
      }

      return true;
    } catch (error) {
      console.error(`[Storage] Redis set error: ${error.message}`);
      return false;
    }
  }

  async delete(key) {
    if (!this._connected) return false;

    try {
      await this.client.del(this._key(key));
      return true;
    } catch (error) {
      console.error(`[Storage] Redis delete error: ${error.message}`);
      return false;
    }
  }

  async exists(key) {
    if (!this._connected) return false;

    try {
      return await this.client.exists(this._key(key)) === 1;
    } catch {
      return false;
    }
  }

  async touch(key) {
    if (!this._connected) return false;

    try {
      // Refresh TTL
      const ttlSeconds = Math.ceil(CONFIG.session.ttlMs / 1000);
      return await this.client.expire(this._key(key), ttlSeconds) === 1;
    } catch {
      return false;
    }
  }

  async size() {
    if (!this._connected) return 0;

    try {
      const keys = await this.client.keys(this._key('*'));
      return keys.length;
    } catch {
      return 0;
    }
  }

  async keys() {
    if (!this._connected) return [];

    try {
      const keys = await this.client.keys(this._key('*'));
      const prefix = CONFIG.redis.keyPrefix;
      return keys.map(k => k.slice(prefix.length));
    } catch {
      return [];
    }
  }

  async clear() {
    if (!this._connected) return false;

    try {
      const keys = await this.client.keys(this._key('*'));
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch {
      return false;
    }
  }

  async getStats() {
    if (!this._connected) {
      return { type: 'redis', connected: false };
    }

    try {
      const keys = await this.client.keys(this._key('*'));
      const info = await this.client.info('memory');
      const usedMemory = info.match(/used_memory:(\d+)/)?.[1] || 0;

      return {
        type: 'redis',
        connected: true,
        sessionCount: keys.length,
        usedMemoryBytes: parseInt(usedMemory, 10)
      };
    } catch {
      return { type: 'redis', connected: true, error: 'Failed to get stats' };
    }
  }

  isHealthy() {
    return this._connected;
  }

  async destroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {}
      this.client = null;
      this._connected = false;
    }
  }
}

// ============================================================================
// STORAGE MANAGER (WITH FALLBACK)
// ============================================================================

/**
 * Storage manager with automatic fallback
 * Uses Redis if available, falls back to memory storage
 */
class StorageManager {
  constructor() {
    this.primary = null;
    this.fallback = new MemoryStorage();
    this._initialized = false;
    this._initPromise = null; // Mutex for concurrent initialization
  }

  async initialize() {
    // Return existing promise if initialization in progress (prevents race condition)
    if (this._initPromise) {
      return this._initPromise;
    }

    // Already initialized
    if (this._initialized) {
      return;
    }

    // Create and store the initialization promise
    this._initPromise = this._doInitialize();

    try {
      await this._initPromise;
      this._initialized = true;
    } finally {
      this._initPromise = null;
    }
  }

  async _doInitialize() {
    if (CONFIG.features.redisEnabled) {
      const redis = new RedisStorage();
      const connected = await redis.connect();

      if (connected) {
        this.primary = redis;
        // Stop fallback cleanup interval since we're using Redis
        this.fallback.destroy();
        console.log('[Storage] Using Redis as primary storage');
      } else {
        console.log('[Storage] Redis unavailable, using in-memory storage');
        this.primary = this.fallback;
      }
    } else {
      this.primary = this.fallback;
      console.log('[Storage] Using in-memory storage (Redis not configured)');
    }
  }

  _getStorage() {
    // Use primary if healthy, otherwise fallback
    if (this.primary && this.primary.isHealthy()) {
      return this.primary;
    }
    return this.fallback;
  }

  async get(key) {
    await this.initialize();
    return this._getStorage().get(key);
  }

  async set(key, value, ttlMs) {
    await this.initialize();
    return this._getStorage().set(key, value, ttlMs);
  }

  async delete(key) {
    await this.initialize();
    return this._getStorage().delete(key);
  }

  async exists(key) {
    await this.initialize();
    return this._getStorage().exists(key);
  }

  async touch(key) {
    await this.initialize();
    return this._getStorage().touch(key);
  }

  async size() {
    await this.initialize();
    return this._getStorage().size();
  }

  async keys() {
    await this.initialize();
    return this._getStorage().keys();
  }

  async clear() {
    await this.initialize();
    return this._getStorage().clear();
  }

  async getStats() {
    await this.initialize();
    const storage = this._getStorage();
    const stats = await storage.getStats();

    return {
      ...stats,
      storageType: storage.type,
      redisConfigured: CONFIG.features.redisEnabled,
      compressionEnabled: CONFIG.features.compression,
      compressionThreshold: CONFIG.session.compressionThreshold
    };
  }

  isHealthy() {
    return this._getStorage().isHealthy();
  }

  getStorageType() {
    return this._getStorage().type;
  }

  async destroy() {
    if (this.primary && this.primary !== this.fallback) {
      await this.primary.destroy();
    }
    this.fallback.destroy();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const sessionStorage = new StorageManager();

// Export classes for testing
export { MemoryStorage, RedisStorage, StorageManager, CONFIG as STORAGE_CONFIG };

export default sessionStorage;
