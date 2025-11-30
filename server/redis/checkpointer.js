/**
 * LangGraph Redis Checkpointer
 *
 * Plan 10: State persistence for multi-step workflows
 *
 * Provides LangGraph-compatible checkpoint storage using Redis with:
 * - Efficient serialization with compression for large states
 * - Checkpoint versioning for rollback capabilities
 * - TTL-based automatic cleanup
 * - In-memory fallback when Redis unavailable
 *
 * Usage:
 *   import { checkpointer } from './redis/checkpointer.js';
 *
 *   // Store checkpoint
 *   await checkpointer.put(threadId, checkpoint);
 *
 *   // Retrieve checkpoint
 *   const checkpoint = await checkpointer.get(threadId);
 *
 *   // List checkpoint history
 *   const history = await checkpointer.list(threadId);
 */

import { createHash } from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { getRedisClient, isRedisHealthy } from './client.js';
import { CONFIG } from '../config.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CHECKPOINT_CONFIG = {
  keyPrefix: CONFIG.REDIS.keyPrefixes.checkpoint,
  ttlSeconds: CONFIG.REDIS.ttl.checkpoint,
  maxVersions: parseInt(process.env.CHECKPOINT_MAX_VERSIONS, 10) || 10,
  compressionThreshold: CONFIG.REDIS.features.compressionThreshold,
  compressionEnabled: CONFIG.REDIS.features.compression
};

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize checkpoint state for storage
 * @param {Object} checkpoint - Checkpoint data
 * @returns {Promise<{data: string, compressed: boolean, checksum: string}>}
 */
async function serializeCheckpoint(checkpoint) {
  const json = JSON.stringify(checkpoint);
  const checksum = createHash('md5').update(json).digest('hex').slice(0, 8);

  // Only compress if enabled and above threshold
  if (CHECKPOINT_CONFIG.compressionEnabled &&
      json.length >= CHECKPOINT_CONFIG.compressionThreshold) {
    try {
      const compressed = await gzip(Buffer.from(json, 'utf8'));
      if (compressed.length < json.length) {
        return {
          data: compressed.toString('base64'),
          compressed: true,
          checksum
        };
      }
    } catch (error) {
      console.warn('[Checkpointer] Compression failed, storing uncompressed:', error.message);
    }
  }

  return {
    data: json,
    compressed: false,
    checksum
  };
}

/**
 * Deserialize checkpoint from storage
 * @param {string} data - Serialized data
 * @param {boolean} isCompressed - Whether data is compressed
 * @param {string} expectedChecksum - Expected checksum for verification
 * @returns {Promise<Object>} Deserialized checkpoint
 */
async function deserializeCheckpoint(data, isCompressed, expectedChecksum = null) {
  let json;

  if (isCompressed) {
    try {
      const buffer = Buffer.from(data, 'base64');
      const decompressed = await gunzip(buffer);
      json = decompressed.toString('utf8');
    } catch (error) {
      throw new Error(`Failed to decompress checkpoint: ${error.message}`);
    }
  } else {
    json = data;
  }

  // Verify checksum if provided
  if (expectedChecksum) {
    const actualChecksum = createHash('md5').update(json).digest('hex').slice(0, 8);
    if (actualChecksum !== expectedChecksum) {
      throw new Error(`Checkpoint checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
    }
  }

  return JSON.parse(json);
}

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate Redis key for checkpoint
 * @param {string} threadId - Thread/conversation identifier
 * @param {number|string} version - Checkpoint version (optional)
 * @returns {string} Redis key
 */
function checkpointKey(threadId, version = null) {
  const sanitized = threadId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  if (version !== null) {
    return `${CHECKPOINT_CONFIG.keyPrefix}${sanitized}:v${version}`;
  }
  return `${CHECKPOINT_CONFIG.keyPrefix}${sanitized}`;
}

/**
 * Generate Redis key for checkpoint metadata/index
 * @param {string} threadId - Thread identifier
 * @returns {string} Redis key for metadata
 */
function metadataKey(threadId) {
  const sanitized = threadId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return `${CHECKPOINT_CONFIG.keyPrefix}${sanitized}:meta`;
}

// ============================================================================
// IN-MEMORY FALLBACK
// ============================================================================

/**
 * In-memory checkpoint storage for when Redis is unavailable
 */
class MemoryCheckpointStore {
  constructor() {
    this.checkpoints = new Map();
    this.metadata = new Map();
    this._cleanupInterval = setInterval(() => this._cleanup(), 60 * 1000);
  }

  async get(threadId, version = null) {
    const meta = this.metadata.get(threadId);
    if (!meta) return null;

    const targetVersion = version !== null ? version : meta.currentVersion;
    const key = `${threadId}:v${targetVersion}`;
    const entry = this.checkpoints.get(key);

    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.checkpoints.delete(key);
      return null;
    }

    return entry.checkpoint;
  }

  async put(threadId, checkpoint, metadata = {}) {
    let meta = this.metadata.get(threadId);
    if (!meta) {
      meta = { currentVersion: 0, versions: [] };
    }

    // Increment version
    meta.currentVersion++;
    const version = meta.currentVersion;
    meta.versions.push(version);

    // Enforce max versions
    while (meta.versions.length > CHECKPOINT_CONFIG.maxVersions) {
      const oldVersion = meta.versions.shift();
      this.checkpoints.delete(`${threadId}:v${oldVersion}`);
    }

    // Store checkpoint
    const key = `${threadId}:v${version}`;
    this.checkpoints.set(key, {
      checkpoint,
      metadata: {
        ...metadata,
        version,
        createdAt: Date.now()
      },
      expiresAt: Date.now() + (CHECKPOINT_CONFIG.ttlSeconds * 1000)
    });

    this.metadata.set(threadId, meta);

    return { version, threadId };
  }

  async list(threadId, limit = 10) {
    const meta = this.metadata.get(threadId);
    if (!meta) return [];

    const results = [];
    const versions = [...meta.versions].reverse().slice(0, limit);

    for (const version of versions) {
      const entry = this.checkpoints.get(`${threadId}:v${version}`);
      if (entry) {
        results.push({
          version,
          threadId,
          metadata: entry.metadata,
          createdAt: entry.metadata.createdAt
        });
      }
    }

    return results;
  }

  async delete(threadId, version = null) {
    if (version !== null) {
      return this.checkpoints.delete(`${threadId}:v${version}`);
    }

    // Delete all versions
    const meta = this.metadata.get(threadId);
    if (meta) {
      for (const v of meta.versions) {
        this.checkpoints.delete(`${threadId}:v${v}`);
      }
      this.metadata.delete(threadId);
      return true;
    }
    return false;
  }

  async clear() {
    this.checkpoints.clear();
    this.metadata.clear();
    return true;
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.checkpoints) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.checkpoints.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this._cleanupInterval);
  }
}

// ============================================================================
// REDIS CHECKPOINTER
// ============================================================================

/**
 * Redis-based checkpoint storage implementing LangGraph-compatible interface
 */
class RedisCheckpointer {
  constructor() {
    this.fallback = new MemoryCheckpointStore();
    this._metrics = {
      puts: 0,
      gets: 0,
      hits: 0,
      misses: 0,
      errors: 0
    };
  }

  /**
   * Get Redis client with fallback handling
   * @returns {Promise<Object|null>}
   */
  async _getClient() {
    if (!isRedisHealthy()) {
      return null;
    }
    try {
      return await getRedisClient();
    } catch {
      return null;
    }
  }

  /**
   * Store a checkpoint
   *
   * @param {string} threadId - Thread identifier
   * @param {Object} checkpoint - Checkpoint state to store
   * @param {Object} metadata - Optional metadata (stepName, etc.)
   * @returns {Promise<{version: number, threadId: string}>}
   */
  async put(threadId, checkpoint, metadata = {}) {
    this._metrics.puts++;

    const client = await this._getClient();
    if (!client) {
      return this.fallback.put(threadId, checkpoint, metadata);
    }

    try {
      // Get or create metadata
      const metaKeyStr = metadataKey(threadId);
      let meta;

      const existingMeta = await client.get(metaKeyStr);
      if (existingMeta) {
        meta = JSON.parse(existingMeta);
      } else {
        meta = { currentVersion: 0, versions: [], threadId };
      }

      // Increment version
      meta.currentVersion++;
      const version = meta.currentVersion;
      meta.versions.push(version);
      meta.updatedAt = Date.now();

      // Enforce max versions
      const oldVersions = [];
      while (meta.versions.length > CHECKPOINT_CONFIG.maxVersions) {
        oldVersions.push(meta.versions.shift());
      }

      // Serialize checkpoint
      const { data, compressed, checksum } = await serializeCheckpoint(checkpoint);

      // Store checkpoint with version
      const ckptKey = checkpointKey(threadId, version);
      const entry = JSON.stringify({
        data,
        compressed,
        checksum,
        metadata: {
          ...metadata,
          version,
          threadId,
          createdAt: Date.now()
        }
      });

      // Use pipeline for atomic operations
      const pipeline = client.pipeline();
      pipeline.setex(ckptKey, CHECKPOINT_CONFIG.ttlSeconds, entry);
      pipeline.setex(metaKeyStr, CHECKPOINT_CONFIG.ttlSeconds, JSON.stringify(meta));

      // Delete old versions
      for (const oldVer of oldVersions) {
        pipeline.del(checkpointKey(threadId, oldVer));
      }

      await pipeline.exec();

      console.log(`[Checkpointer] Stored checkpoint v${version} for thread ${threadId}`);
      return { version, threadId };

    } catch (error) {
      this._metrics.errors++;
      console.error('[Checkpointer] Redis put error:', error.message);
      return this.fallback.put(threadId, checkpoint, metadata);
    }
  }

  /**
   * Retrieve a checkpoint
   *
   * @param {string} threadId - Thread identifier
   * @param {number|null} version - Specific version (null for latest)
   * @returns {Promise<Object|null>} Checkpoint or null if not found
   */
  async get(threadId, version = null) {
    this._metrics.gets++;

    const client = await this._getClient();
    if (!client) {
      return this.fallback.get(threadId, version);
    }

    try {
      // Get version to fetch
      let targetVersion = version;

      if (targetVersion === null) {
        const metaKeyStr = metadataKey(threadId);
        const metaStr = await client.get(metaKeyStr);
        if (!metaStr) {
          this._metrics.misses++;
          return null;
        }
        const meta = JSON.parse(metaStr);
        targetVersion = meta.currentVersion;
      }

      // Fetch checkpoint
      const ckptKey = checkpointKey(threadId, targetVersion);
      const entryStr = await client.get(ckptKey);

      if (!entryStr) {
        this._metrics.misses++;
        return null;
      }

      const entry = JSON.parse(entryStr);
      const checkpoint = await deserializeCheckpoint(
        entry.data,
        entry.compressed,
        entry.checksum
      );

      this._metrics.hits++;
      return checkpoint;

    } catch (error) {
      this._metrics.errors++;
      console.error('[Checkpointer] Redis get error:', error.message);
      return this.fallback.get(threadId, version);
    }
  }

  /**
   * Get checkpoint with metadata
   *
   * @param {string} threadId - Thread identifier
   * @param {number|null} version - Specific version
   * @returns {Promise<{checkpoint: Object, metadata: Object}|null>}
   */
  async getWithMetadata(threadId, version = null) {
    const client = await this._getClient();
    if (!client) {
      const checkpoint = await this.fallback.get(threadId, version);
      if (!checkpoint) return null;
      return { checkpoint, metadata: {} };
    }

    try {
      let targetVersion = version;

      if (targetVersion === null) {
        const metaStr = await client.get(metadataKey(threadId));
        if (!metaStr) return null;
        const meta = JSON.parse(metaStr);
        targetVersion = meta.currentVersion;
      }

      const entryStr = await client.get(checkpointKey(threadId, targetVersion));
      if (!entryStr) return null;

      const entry = JSON.parse(entryStr);
      const checkpoint = await deserializeCheckpoint(
        entry.data,
        entry.compressed,
        entry.checksum
      );

      return {
        checkpoint,
        metadata: entry.metadata
      };

    } catch (error) {
      console.error('[Checkpointer] Error fetching with metadata:', error.message);
      return null;
    }
  }

  /**
   * List checkpoint versions for a thread
   *
   * @param {string} threadId - Thread identifier
   * @param {number} limit - Maximum versions to return
   * @returns {Promise<Array<{version, threadId, createdAt}>>}
   */
  async list(threadId, limit = 10) {
    const client = await this._getClient();
    if (!client) {
      return this.fallback.list(threadId, limit);
    }

    try {
      const metaStr = await client.get(metadataKey(threadId));
      if (!metaStr) return [];

      const meta = JSON.parse(metaStr);
      const versions = [...meta.versions].reverse().slice(0, limit);

      const results = [];
      for (const ver of versions) {
        const entryStr = await client.get(checkpointKey(threadId, ver));
        if (entryStr) {
          const entry = JSON.parse(entryStr);
          results.push({
            version: ver,
            threadId,
            metadata: entry.metadata,
            createdAt: entry.metadata.createdAt
          });
        }
      }

      return results;

    } catch (error) {
      console.error('[Checkpointer] Error listing checkpoints:', error.message);
      return [];
    }
  }

  /**
   * Delete checkpoint(s) for a thread
   *
   * @param {string} threadId - Thread identifier
   * @param {number|null} version - Specific version or null for all
   * @returns {Promise<boolean>}
   */
  async delete(threadId, version = null) {
    const client = await this._getClient();
    if (!client) {
      return this.fallback.delete(threadId, version);
    }

    try {
      if (version !== null) {
        await client.del(checkpointKey(threadId, version));
        return true;
      }

      // Delete all versions
      const metaStr = await client.get(metadataKey(threadId));
      if (!metaStr) return false;

      const meta = JSON.parse(metaStr);
      const pipeline = client.pipeline();

      for (const ver of meta.versions) {
        pipeline.del(checkpointKey(threadId, ver));
      }
      pipeline.del(metadataKey(threadId));

      await pipeline.exec();
      return true;

    } catch (error) {
      console.error('[Checkpointer] Error deleting checkpoint:', error.message);
      return false;
    }
  }

  /**
   * Clear all checkpoints (for testing)
   * @returns {Promise<number>} Number of keys deleted
   */
  async clear() {
    const client = await this._getClient();
    if (!client) {
      await this.fallback.clear();
      return 0;
    }

    try {
      const pattern = `${CHECKPOINT_CONFIG.keyPrefix}*`;
      const keys = await client.keys(pattern);

      if (keys.length > 0) {
        await client.del(...keys);
      }

      await this.fallback.clear();
      return keys.length;

    } catch (error) {
      console.error('[Checkpointer] Error clearing checkpoints:', error.message);
      return 0;
    }
  }

  /**
   * Get checkpoint statistics
   * @returns {Object}
   */
  getStats() {
    const hitRate = this._metrics.gets > 0
      ? ((this._metrics.hits / this._metrics.gets) * 100).toFixed(1)
      : '0.0';

    return {
      ...this._metrics,
      hitRate: `${hitRate}%`,
      redisHealthy: isRedisHealthy(),
      maxVersions: CHECKPOINT_CONFIG.maxVersions,
      ttlSeconds: CHECKPOINT_CONFIG.ttlSeconds
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this._metrics = {
      puts: 0,
      gets: 0,
      hits: 0,
      misses: 0,
      errors: 0
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.fallback.destroy();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Singleton instance
export const checkpointer = new RedisCheckpointer();

// Export classes for testing
export {
  RedisCheckpointer,
  MemoryCheckpointStore,
  serializeCheckpoint,
  deserializeCheckpoint,
  checkpointKey,
  metadataKey,
  CHECKPOINT_CONFIG
};

export default checkpointer;
