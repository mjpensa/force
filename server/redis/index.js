/**
 * Redis Infrastructure Layer
 *
 * Plan 08: Unified exports for Redis functionality
 * Plan 09: DSPy cache exports
 * Plan 10: LangGraph Checkpointer exports
 * Gap 05: Redis Advanced Features (Sorted Sets, Pub/Sub, Streams, Hashes, Lua)
 *
 * Usage:
 *   import { getRedisClient, initializeRedis } from './redis/index.js';
 *
 *   // During server startup
 *   await initializeRedis();
 *
 *   // In application code
 *   const client = await getRedisClient();
 *
 *   // DSPy caching (Plan 09)
 *   import { dspyCache } from './redis/index.js';
 *   const cached = await dspyCache.get('roadmap', inputs);
 *
 *   // LangGraph checkpointing (Plan 10)
 *   import { checkpointer } from './redis/index.js';
 *   await checkpointer.put(threadId, checkpoint);
 *   const state = await checkpointer.get(threadId);
 *
 *   // Variant metrics (Gap 05)
 *   import { variantMetrics } from './redis/index.js';
 *   await variantMetrics.recordScore('variant-1', 4.5);
 *
 *   // Pub/Sub (Gap 05)
 *   import { pubsub, publishCacheInvalidation } from './redis/index.js';
 *   await publishCacheInvalidation('roadmap');
 *
 *   // Event streams (Gap 05)
 *   import { eventStream, logTrainingEvent } from './redis/index.js';
 *   await logTrainingEvent({ event: 'started', sessionId: '123' });
 *
 *   // Metadata store (Gap 05)
 *   import { variantMeta, sessionMeta } from './redis/index.js';
 *   await variantMeta.setFields('id', { name: 'Test' });
 *
 *   // Lua scripts (Gap 05)
 *   import { luaScripts } from './redis/index.js';
 *   await luaScripts.checkRateLimit('user-123', 60, 100);
 */

export {
  getRedisClient,
  isRedisHealthy,
  getRedisMetrics,
  disconnectRedis,
  executeRedis,
  resetRedisMetrics,
  redisFactory
} from './client.js';

// Plan 09: DSPy Cache exports
export {
  dspyCache,
  DSPyCache,
  SIGNATURE_TYPES,
  generateCacheKey
} from './dspy-cache.js';

// Plan 10: LangGraph Checkpointer exports
export {
  checkpointer,
  RedisCheckpointer,
  MemoryCheckpointStore,
  CHECKPOINT_CONFIG
} from './checkpointer.js';

// Gap 05: Variant Metrics (Sorted Sets)
export {
  variantMetrics,
  VariantMetricsTracker
} from './variant-metrics.js';

// Gap 05: Pub/Sub for cache invalidation
export {
  pubsub,
  PubSubManager,
  publishCacheInvalidation,
  subscribeToCacheInvalidation,
  publishTrainingEvent,
  subscribeToTrainingEvents,
  publishSystemNotification,
  subscribeToSystemNotifications,
  CHANNELS
} from './pubsub.js';

// Gap 05: Event Streams for audit logging
export {
  eventStream,
  EventStreamManager,
  logTrainingEvent,
  logGenerationEvent,
  logEvolutionEvent,
  logErrorEvent,
  STREAM_KEYS
} from './event-stream.js';

// Gap 05: Hash-based Metadata Store
export {
  MetadataStore,
  variantMeta,
  sessionMeta,
  cacheMeta,
  requestMeta
} from './metadata-store.js';

// Gap 05: Lua Script Manager
export {
  luaScripts,
  LuaScriptManager,
  SCRIPT_NAMES
} from './lua-scripts.js';

import { getRedisClient, isRedisHealthy, getRedisMetrics } from './client.js';
import { CONFIG } from '../config.js';

/**
 * Initialize Redis connection
 *
 * Call during server startup to establish connection early.
 * Non-blocking - returns false if Redis unavailable but doesn't throw.
 *
 * @returns {Promise<boolean>} True if connected successfully
 */
export async function initializeRedis() {
  if (!CONFIG.REDIS.enabled) {
    console.log('[Redis] Disabled (REDIS_URL not configured)');
    return false;
  }

  console.log('[Redis] Initializing connection...');

  try {
    const client = await getRedisClient();

    if (client) {
      // Verify with ping
      await client.ping();
      console.log('[Redis] Initialization successful');
      return true;
    } else {
      console.warn('[Redis] Initialization failed - running in fallback mode');
      return false;
    }
  } catch (error) {
    console.error('[Redis] Initialization error:', error.message);
    return false;
  }
}

/**
 * Get Redis status summary for health endpoints
 * @returns {Object} Status summary
 */
export function getRedisStatus() {
  const metrics = getRedisMetrics();

  let status;
  if (!CONFIG.REDIS.enabled) {
    status = 'disabled';
  } else if (metrics.connected) {
    status = 'healthy';
  } else {
    status = 'degraded';
  }

  return {
    status,
    connected: metrics.connected,
    enabled: CONFIG.REDIS.enabled,
    uptimeMs: metrics.uptime,
    lastHealthCheck: metrics.lastHealthCheck,
    errorCount: metrics.commandErrors,
    reconnections: metrics.reconnections
  };
}

/**
 * Create a namespaced Redis key
 * @param {string} namespace - Key namespace (session, cache, checkpoint, dspy, metrics)
 * @param {string} key - Key suffix
 * @returns {string} Full namespaced key
 */
export function createRedisKey(namespace, key) {
  const prefix = CONFIG.REDIS.keyPrefixes[namespace];
  if (!prefix) {
    throw new Error(`Unknown Redis namespace: ${namespace}. Valid namespaces: ${Object.keys(CONFIG.REDIS.keyPrefixes).join(', ')}`);
  }
  return `${prefix}${key}`;
}

/**
 * Get TTL for a namespace
 * @param {string} namespace - Key namespace
 * @returns {number} TTL in seconds
 */
export function getRedisTTL(namespace) {
  const ttl = CONFIG.REDIS.ttl[namespace];
  if (ttl === undefined) {
    throw new Error(`Unknown Redis namespace: ${namespace}. Valid namespaces: ${Object.keys(CONFIG.REDIS.ttl).join(', ')}`);
  }
  return ttl;
}

/**
 * Validate key component to prevent injection
 * @param {string} value - Value to validate
 * @param {string} name - Parameter name for error messages
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export function validateKeyComponent(value, name = 'key') {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }

  if (value.length > 256) {
    throw new Error(`${name} exceeds maximum length of 256 characters`);
  }

  // Disallow special Redis characters and control characters
  if (/[:\*\?\[\]\n\r\0]/.test(value)) {
    throw new Error(`${name} contains invalid characters (no :, *, ?, [, ], or control chars)`);
  }

  return true;
}

/**
 * Execute Redis operation with graceful fallback
 *
 * @param {Function} redisOp - Async function to execute with Redis
 * @param {Function} fallbackOp - Fallback function if Redis unavailable
 * @returns {Promise<any>} Result from Redis or fallback
 */
export async function withRedisFallback(redisOp, fallbackOp) {
  if (!isRedisHealthy()) {
    return fallbackOp();
  }

  try {
    return await redisOp();
  } catch (error) {
    console.warn('[Redis] Operation failed, using fallback:', error.message);
    return fallbackOp();
  }
}

/**
 * Get all Redis key prefixes
 * @returns {Object} Key prefix mappings
 */
export function getKeyPrefixes() {
  return { ...CONFIG.REDIS.keyPrefixes };
}

/**
 * Check if Redis is configured (even if not connected)
 * @returns {boolean} True if REDIS_URL is set
 */
export function isRedisConfigured() {
  return CONFIG.REDIS.enabled;
}
