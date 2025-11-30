# Implementation Plan: LangGraph Checkpointer

## Problem Statement

The current system lacks state persistence for LangGraph workflow execution:

1. **No State Persistence**: Graph execution state lost on server restart or crash
2. **No Conversation Continuity**: Cannot resume interrupted workflows
3. **No Branching Support**: Cannot explore alternative paths from checkpoints
4. **No Audit Trail**: No history of state transitions for debugging
5. **Single-Instance Only**: Cannot share workflow state across server instances

The ARCHITECTURE specifies LangGraph Checkpointer as a core component of the Redis Memory Layer for workflow state persistence.

## Current State

```javascript
// No checkpointer implementation exists
// LangGraph workflows run without state persistence
// Workflow interruption = lost progress

// Example current workflow (no persistence)
const graph = new StateGraph(AgentState)
  .addNode("process", processNode)
  .addNode("generate", generateNode)
  .compile();  // No checkpointer attached

await graph.invoke({ input: "..." });  // State lost after completion
```

## Goal

Implement a Redis-backed LangGraph Checkpointer that:

1. Persists graph state after each node execution
2. Enables workflow resumption from any checkpoint
3. Supports state branching for alternative exploration
4. Maintains checkpoint history per thread
5. Integrates with LangGraph's `BaseCheckpointSaver` interface
6. Compresses large state payloads for storage efficiency

---

## Phase 1: Checkpoint Key Schema and ID Generation

### Objective
Design key schema and ID generation for checkpoints.

### Implementation

```javascript
// server/redis/checkpointer.js - Part 1: Key Schema

import crypto from 'crypto';
import { CONFIG } from '../config.js';

/**
 * LangGraph Checkpoint Key Schema
 *
 * Key Patterns:
 * - Checkpoint: force:checkpoint:{thread_id}:{checkpoint_id}
 * - Latest:     force:checkpoint:{thread_id}:latest
 * - Metadata:   force:checkpoint:{thread_id}:meta
 * - Index:      force:checkpoint:{thread_id}:index
 *
 * Thread ID: Unique identifier for a workflow thread (conversation/session)
 * Checkpoint ID: Unique identifier for a specific checkpoint in the thread
 */

// Key prefix from config
const PREFIX = () => CONFIG.REDIS.keyPrefixes.checkpoint;

/**
 * Generate a unique checkpoint ID
 *
 * Format: chk_{timestamp}_{random}
 * Ensures chronological ordering and uniqueness
 */
export function generateCheckpointId() {
  const timestamp = Date.now().toString(36);  // Base36 timestamp
  const random = crypto.randomBytes(4).toString('hex');
  return `chk_${timestamp}_${random}`;
}

/**
 * Generate a unique thread ID
 *
 * Format: thread_{userId}_{sessionId}_{random}
 * Or custom format if provided
 */
export function generateThreadId(userId, sessionId) {
  const random = crypto.randomBytes(4).toString('hex');
  return `thread_${userId || 'anon'}_${sessionId || Date.now().toString(36)}_${random}`;
}

/**
 * Build Redis key for checkpoint
 */
export function checkpointKey(threadId, checkpointId) {
  validateKeyComponent(threadId, 'threadId');
  validateKeyComponent(checkpointId, 'checkpointId');
  return `${PREFIX()}${threadId}:${checkpointId}`;
}

/**
 * Build Redis key for latest checkpoint pointer
 */
export function latestKey(threadId) {
  validateKeyComponent(threadId, 'threadId');
  return `${PREFIX()}${threadId}:latest`;
}

/**
 * Build Redis key for thread metadata
 */
export function metaKey(threadId) {
  validateKeyComponent(threadId, 'threadId');
  return `${PREFIX()}${threadId}:meta`;
}

/**
 * Build Redis key for checkpoint index (list of checkpoint IDs)
 */
export function indexKey(threadId) {
  validateKeyComponent(threadId, 'threadId');
  return `${PREFIX()}${threadId}:index`;
}

/**
 * Build pattern for all checkpoints in a thread
 */
export function threadPattern(threadId) {
  validateKeyComponent(threadId, 'threadId');
  return `${PREFIX()}${threadId}:*`;
}

/**
 * Validate key component to prevent injection
 */
function validateKeyComponent(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }

  if (value.length > 256) {
    throw new Error(`${name} exceeds maximum length of 256 characters`);
  }

  // Disallow special Redis characters and control characters
  if (/[:\*\?\[\]\n\r\0]/.test(value)) {
    throw new Error(`${name} contains invalid characters`);
  }

  return true;
}

/**
 * Parse checkpoint key to extract components
 */
export function parseCheckpointKey(key) {
  const prefix = PREFIX();
  if (!key.startsWith(prefix)) {
    return null;
  }

  const suffix = key.slice(prefix.length);
  const parts = suffix.split(':');

  if (parts.length !== 2) {
    return null;
  }

  const [threadId, checkpointId] = parts;

  // Identify key type
  let keyType = 'checkpoint';
  if (checkpointId === 'latest') keyType = 'latest';
  else if (checkpointId === 'meta') keyType = 'meta';
  else if (checkpointId === 'index') keyType = 'index';

  return {
    threadId,
    checkpointId: keyType === 'checkpoint' ? checkpointId : null,
    keyType
  };
}
```

---

## Phase 2: State Serialization and Compression

### Objective
Implement efficient state serialization with compression.

### Implementation

```javascript
// server/redis/checkpointer.js - Part 2: Serialization

import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Checkpoint Entry Schema
 *
 * {
 *   id: string,                    // Checkpoint ID
 *   thread_id: string,             // Thread ID
 *   parent_id: string | null,      // Parent checkpoint for branching
 *
 *   // Serialized state
 *   state: {
 *     data: string,                // JSON or base64 compressed
 *     compressed: boolean
 *   },
 *
 *   // Metadata
 *   metadata: {
 *     created_at: number,          // Unix timestamp
 *     step: number,                // Execution step number
 *     source: string,              // Source node/event
 *     tags: string[]               // Optional tags
 *   },
 *
 *   // Channel values (LangGraph specific)
 *   channel_values: object,
 *   channel_versions: object
 * }
 */

/**
 * Serialize checkpoint state for storage
 *
 * @param {Object} state - Graph state object
 * @returns {Promise<{data: string, compressed: boolean}>}
 */
export async function serializeState(state) {
  const json = JSON.stringify(state);
  const threshold = CONFIG.REDIS.features.compressionThreshold;

  // Compress if large
  if (CONFIG.REDIS.features.compression && json.length > threshold) {
    try {
      const compressed = await gzip(Buffer.from(json, 'utf8'));

      // Only use if significantly smaller
      if (compressed.length < json.length * 0.8) {
        return {
          data: compressed.toString('base64'),
          compressed: true,
          originalSize: json.length,
          compressedSize: compressed.length
        };
      }
    } catch {
      // Fall through to uncompressed
    }
  }

  return {
    data: json,
    compressed: false,
    originalSize: json.length
  };
}

/**
 * Deserialize checkpoint state from storage
 *
 * @param {Object} serialized - {data, compressed}
 * @returns {Promise<Object>} Deserialized state
 */
export async function deserializeState(serialized) {
  if (serialized.compressed) {
    try {
      const buffer = Buffer.from(serialized.data, 'base64');
      const decompressed = await gunzip(buffer);
      return JSON.parse(decompressed.toString('utf8'));
    } catch (error) {
      throw new Error(`Failed to deserialize compressed state: ${error.message}`);
    }
  }

  return JSON.parse(serialized.data);
}

/**
 * Create checkpoint entry structure
 */
export function createCheckpointEntry(config, checkpoint, metadata = {}) {
  const now = Date.now();

  return {
    id: config.checkpoint_id || generateCheckpointId(),
    thread_id: config.thread_id,
    parent_id: config.parent_id || null,
    state: null,  // Set after serialization
    metadata: {
      created_at: now,
      step: metadata.step || 0,
      source: metadata.source || 'unknown',
      tags: metadata.tags || [],
      ...metadata
    },
    channel_values: checkpoint.channel_values || {},
    channel_versions: checkpoint.channel_versions || {}
  };
}

/**
 * Serialize full checkpoint entry for storage
 */
export async function serializeCheckpoint(entry) {
  // State should already be serialized
  return JSON.stringify(entry);
}

/**
 * Deserialize checkpoint entry from storage
 */
export async function deserializeCheckpoint(raw) {
  const entry = JSON.parse(raw);

  // Deserialize state if present
  if (entry.state) {
    entry.state = await deserializeState(entry.state);
  }

  return entry;
}
```

---

## Phase 3: RedisCheckpointer Class

### Objective
Implement the main checkpointer class with LangGraph interface.

### Implementation

```javascript
// server/redis/checkpointer.js - Part 3: Main Checkpointer Class

import { getRedisClient, isRedisHealthy } from './client.js';
import { CONFIG } from '../config.js';

/**
 * RedisCheckpointer - LangGraph state persistence
 *
 * Implements the LangGraph BaseCheckpointSaver interface for Redis.
 *
 * Usage:
 *   import { RedisCheckpointer } from './redis/checkpointer.js';
 *
 *   const checkpointer = new RedisCheckpointer();
 *
 *   const graph = new StateGraph(AgentState)
 *     .addNode("process", processNode)
 *     .compile({ checkpointer });
 *
 *   // Invoke with thread_id for persistence
 *   await graph.invoke(input, { configurable: { thread_id: "my-thread" } });
 */

export class RedisCheckpointer {
  /**
   * Create a new checkpointer instance
   *
   * @param {Object} options Configuration options
   * @param {number} options.ttlSeconds TTL for checkpoints (default: 24 hours)
   * @param {boolean} options.compression Enable compression (default: true)
   * @param {number} options.maxCheckpointsPerThread Max checkpoints to keep (default: 100)
   */
  constructor(options = {}) {
    this.ttlSeconds = options.ttlSeconds ?? CONFIG.REDIS.ttl.checkpoint;
    this.compression = options.compression ?? CONFIG.REDIS.features.compression;
    this.maxCheckpointsPerThread = options.maxCheckpointsPerThread ?? 100;

    this.metrics = {
      puts: 0,
      gets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Save a checkpoint
   *
   * LangGraph Interface: put(config, checkpoint, metadata)
   *
   * @param {Object} config - {thread_id, checkpoint_id?, parent_id?}
   * @param {Object} checkpoint - State to persist
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - {thread_id, checkpoint_id}
   */
  async put(config, checkpoint, metadata = {}) {
    const client = await getRedisClient();
    if (!client) {
      throw new Error('Redis unavailable - cannot save checkpoint');
    }

    try {
      const entry = createCheckpointEntry(config, checkpoint, metadata);

      // Serialize state
      entry.state = await serializeState(checkpoint);

      // Build keys
      const chkKey = checkpointKey(entry.thread_id, entry.id);
      const ltKey = latestKey(entry.thread_id);
      const idxKey = indexKey(entry.thread_id);

      // Serialize entry
      const serialized = await serializeCheckpoint(entry);

      // Use pipeline for atomic operations
      const pipeline = client.pipeline();

      // Store checkpoint
      pipeline.setex(chkKey, this.ttlSeconds, serialized);

      // Update latest pointer
      pipeline.setex(ltKey, this.ttlSeconds, entry.id);

      // Add to index (sorted set with timestamp as score)
      pipeline.zadd(idxKey, entry.metadata.created_at, entry.id);
      pipeline.expire(idxKey, this.ttlSeconds);

      // Execute pipeline
      await pipeline.exec();

      // Prune old checkpoints if needed
      await this.#pruneCheckpoints(client, entry.thread_id);

      this.metrics.puts++;

      console.log(`[Checkpointer] Saved checkpoint ${entry.id} for thread ${entry.thread_id}`);

      return {
        thread_id: entry.thread_id,
        checkpoint_id: entry.id
      };

    } catch (error) {
      this.metrics.errors++;
      console.error('[Checkpointer] Put error:', error.message);
      throw error;
    }
  }

  /**
   * Load a checkpoint
   *
   * LangGraph Interface: get(config)
   *
   * @param {Object} config - {thread_id, checkpoint_id?}
   * @returns {Promise<Object|null>} - Checkpoint state or null
   */
  async get(config) {
    const tuple = await this.getTuple(config);
    return tuple?.checkpoint || null;
  }

  /**
   * Load checkpoint with full metadata
   *
   * LangGraph Interface: getTuple(config)
   *
   * @param {Object} config - {thread_id, checkpoint_id?}
   * @returns {Promise<CheckpointTuple|null>}
   */
  async getTuple(config) {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    try {
      const threadId = config.thread_id;
      let checkpointId = config.checkpoint_id;

      // Get latest if no specific ID
      if (!checkpointId) {
        checkpointId = await client.get(latestKey(threadId));
        if (!checkpointId) {
          return null;
        }
      }

      // Get checkpoint
      const raw = await client.get(checkpointKey(threadId, checkpointId));
      if (!raw) {
        return null;
      }

      // Deserialize
      const entry = await deserializeCheckpoint(raw);

      this.metrics.gets++;

      return {
        config: {
          thread_id: threadId,
          checkpoint_id: checkpointId
        },
        checkpoint: entry.state,
        metadata: entry.metadata,
        parent_config: entry.parent_id ? {
          thread_id: threadId,
          checkpoint_id: entry.parent_id
        } : null,
        channel_values: entry.channel_values,
        channel_versions: entry.channel_versions
      };

    } catch (error) {
      this.metrics.errors++;
      console.error('[Checkpointer] Get error:', error.message);
      return null;
    }
  }

  /**
   * List checkpoints for a thread
   *
   * LangGraph Interface: list(config, options)
   *
   * @param {Object} config - {thread_id}
   * @param {Object} options - {limit?, before?}
   * @returns {AsyncGenerator<CheckpointTuple>}
   */
  async *list(config, options = {}) {
    const client = await getRedisClient();
    if (!client) {
      return;
    }

    const threadId = config.thread_id;
    const limit = options.limit || 100;
    const before = options.before;

    try {
      // Get checkpoint IDs from sorted set (newest first)
      let checkpointIds;

      if (before) {
        // Get score of 'before' checkpoint
        const beforeScore = await client.zscore(indexKey(threadId), before);
        if (beforeScore) {
          checkpointIds = await client.zrevrangebyscore(
            indexKey(threadId),
            `(${beforeScore}`,  // Exclusive
            '-inf',
            'LIMIT', 0, limit
          );
        } else {
          checkpointIds = [];
        }
      } else {
        checkpointIds = await client.zrevrange(indexKey(threadId), 0, limit - 1);
      }

      // Yield checkpoint tuples
      for (const checkpointId of checkpointIds) {
        const tuple = await this.getTuple({
          thread_id: threadId,
          checkpoint_id: checkpointId
        });

        if (tuple) {
          yield tuple;
        }
      }

    } catch (error) {
      this.metrics.errors++;
      console.error('[Checkpointer] List error:', error.message);
    }
  }

  /**
   * Delete checkpoints for a thread
   *
   * @param {Object} config - {thread_id, checkpoint_id?}
   * @returns {Promise<number>} Number of checkpoints deleted
   */
  async delete(config) {
    const client = await getRedisClient();
    if (!client) {
      return 0;
    }

    try {
      const threadId = config.thread_id;

      if (config.checkpoint_id) {
        // Delete specific checkpoint
        const deleted = await client.del(checkpointKey(threadId, config.checkpoint_id));
        await client.zrem(indexKey(threadId), config.checkpoint_id);

        this.metrics.deletes++;
        return deleted;
      }

      // Delete all checkpoints for thread
      const pattern = threadPattern(threadId);
      const keys = await client.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const deleted = await client.del(...keys);

      this.metrics.deletes += deleted;
      console.log(`[Checkpointer] Deleted ${deleted} checkpoints for thread ${threadId}`);

      return deleted;

    } catch (error) {
      this.metrics.errors++;
      console.error('[Checkpointer] Delete error:', error.message);
      return 0;
    }
  }

  /**
   * Get checkpoint count for a thread
   */
  async getCheckpointCount(threadId) {
    const client = await getRedisClient();
    if (!client) return 0;

    try {
      return await client.zcard(indexKey(threadId));
    } catch {
      return 0;
    }
  }

  /**
   * Prune old checkpoints to stay within limit
   * @private
   */
  async #pruneCheckpoints(client, threadId) {
    try {
      const count = await client.zcard(indexKey(threadId));

      if (count > this.maxCheckpointsPerThread) {
        // Get oldest checkpoint IDs to remove
        const toRemove = count - this.maxCheckpointsPerThread;
        const oldestIds = await client.zrange(indexKey(threadId), 0, toRemove - 1);

        if (oldestIds.length > 0) {
          // Remove from sorted set
          await client.zrem(indexKey(threadId), ...oldestIds);

          // Delete checkpoint entries
          const keysToDelete = oldestIds.map(id => checkpointKey(threadId, id));
          await client.del(...keysToDelete);

          console.log(`[Checkpointer] Pruned ${oldestIds.length} old checkpoints for thread ${threadId}`);
        }
      }
    } catch (error) {
      console.warn('[Checkpointer] Prune error:', error.message);
    }
  }

  /**
   * Get checkpointer metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      healthy: isRedisHealthy()
    };
  }
}

// Singleton instance
export const checkpointer = new RedisCheckpointer();

export default RedisCheckpointer;
```

---

## Phase 4: In-Memory Fallback Checkpointer

### Objective
Implement in-memory fallback when Redis unavailable.

### Implementation

```javascript
// server/redis/checkpointer.js - Part 4: Memory Fallback

/**
 * MemoryCheckpointer - In-memory fallback
 *
 * Used when Redis is unavailable. State is lost on restart.
 */
export class MemoryCheckpointer {
  constructor(options = {}) {
    this.checkpoints = new Map();  // threadId -> Map<checkpointId, entry>
    this.latest = new Map();       // threadId -> checkpointId
    this.maxCheckpointsPerThread = options.maxCheckpointsPerThread ?? 100;

    this.metrics = {
      puts: 0,
      gets: 0,
      deletes: 0
    };
  }

  async put(config, checkpoint, metadata = {}) {
    const threadId = config.thread_id;
    const checkpointId = config.checkpoint_id || generateCheckpointId();

    // Initialize thread storage
    if (!this.checkpoints.has(threadId)) {
      this.checkpoints.set(threadId, new Map());
    }

    const entry = {
      id: checkpointId,
      thread_id: threadId,
      parent_id: config.parent_id || null,
      state: checkpoint,
      metadata: {
        created_at: Date.now(),
        step: metadata.step || 0,
        source: metadata.source || 'unknown',
        ...metadata
      },
      channel_values: checkpoint.channel_values || {},
      channel_versions: checkpoint.channel_versions || {}
    };

    // Store checkpoint
    this.checkpoints.get(threadId).set(checkpointId, entry);
    this.latest.set(threadId, checkpointId);

    // Prune if needed
    this.#pruneCheckpoints(threadId);

    this.metrics.puts++;

    return {
      thread_id: threadId,
      checkpoint_id: checkpointId
    };
  }

  async get(config) {
    const tuple = await this.getTuple(config);
    return tuple?.checkpoint || null;
  }

  async getTuple(config) {
    const threadId = config.thread_id;
    const threadCheckpoints = this.checkpoints.get(threadId);

    if (!threadCheckpoints) {
      return null;
    }

    let checkpointId = config.checkpoint_id;
    if (!checkpointId) {
      checkpointId = this.latest.get(threadId);
      if (!checkpointId) return null;
    }

    const entry = threadCheckpoints.get(checkpointId);
    if (!entry) return null;

    this.metrics.gets++;

    return {
      config: { thread_id: threadId, checkpoint_id: checkpointId },
      checkpoint: entry.state,
      metadata: entry.metadata,
      parent_config: entry.parent_id ? {
        thread_id: threadId,
        checkpoint_id: entry.parent_id
      } : null,
      channel_values: entry.channel_values,
      channel_versions: entry.channel_versions
    };
  }

  async *list(config, options = {}) {
    const threadId = config.thread_id;
    const threadCheckpoints = this.checkpoints.get(threadId);

    if (!threadCheckpoints) return;

    const limit = options.limit || 100;

    // Get entries sorted by creation time (newest first)
    const entries = Array.from(threadCheckpoints.values())
      .sort((a, b) => b.metadata.created_at - a.metadata.created_at)
      .slice(0, limit);

    for (const entry of entries) {
      yield {
        config: { thread_id: threadId, checkpoint_id: entry.id },
        checkpoint: entry.state,
        metadata: entry.metadata,
        parent_config: entry.parent_id ? {
          thread_id: threadId,
          checkpoint_id: entry.parent_id
        } : null
      };
    }
  }

  async delete(config) {
    const threadId = config.thread_id;

    if (config.checkpoint_id) {
      const threadCheckpoints = this.checkpoints.get(threadId);
      if (threadCheckpoints) {
        const deleted = threadCheckpoints.delete(config.checkpoint_id);
        if (deleted) {
          this.metrics.deletes++;
          return 1;
        }
      }
      return 0;
    }

    // Delete all for thread
    const deleted = this.checkpoints.get(threadId)?.size || 0;
    this.checkpoints.delete(threadId);
    this.latest.delete(threadId);
    this.metrics.deletes += deleted;
    return deleted;
  }

  #pruneCheckpoints(threadId) {
    const threadCheckpoints = this.checkpoints.get(threadId);
    if (!threadCheckpoints || threadCheckpoints.size <= this.maxCheckpointsPerThread) {
      return;
    }

    // Sort by creation time and remove oldest
    const entries = Array.from(threadCheckpoints.entries())
      .sort((a, b) => a[1].metadata.created_at - b[1].metadata.created_at);

    const toRemove = entries.length - this.maxCheckpointsPerThread;
    for (let i = 0; i < toRemove; i++) {
      threadCheckpoints.delete(entries[i][0]);
    }
  }

  getMetrics() {
    let totalCheckpoints = 0;
    for (const threadMap of this.checkpoints.values()) {
      totalCheckpoints += threadMap.size;
    }

    return {
      ...this.metrics,
      type: 'memory',
      threads: this.checkpoints.size,
      totalCheckpoints
    };
  }

  clear() {
    this.checkpoints.clear();
    this.latest.clear();
  }
}
```

---

## Phase 5: Checkpointer Manager with Fallback

### Objective
Create a manager that handles Redis/memory fallback.

### Implementation

```javascript
// server/redis/checkpointer.js - Part 5: Manager with Fallback

import { isRedisHealthy } from './client.js';

/**
 * CheckpointerManager - Manages primary and fallback checkpointers
 *
 * Automatically falls back to memory when Redis unavailable.
 */
export class CheckpointerManager {
  constructor(options = {}) {
    this.primary = new RedisCheckpointer(options);
    this.fallback = new MemoryCheckpointer(options);
    this._useFallback = false;
  }

  /**
   * Get the active checkpointer
   */
  #getActive() {
    // Check Redis health
    if (!isRedisHealthy()) {
      if (!this._useFallback) {
        console.warn('[Checkpointer] Redis unavailable, using memory fallback');
        this._useFallback = true;
      }
      return this.fallback;
    }

    // Redis recovered
    if (this._useFallback) {
      console.log('[Checkpointer] Redis recovered, switching back to primary');
      this._useFallback = false;
    }

    return this.primary;
  }

  async put(config, checkpoint, metadata) {
    return this.#getActive().put(config, checkpoint, metadata);
  }

  async get(config) {
    return this.#getActive().get(config);
  }

  async getTuple(config) {
    return this.#getActive().getTuple(config);
  }

  async *list(config, options) {
    yield* this.#getActive().list(config, options);
  }

  async delete(config) {
    return this.#getActive().delete(config);
  }

  getMetrics() {
    const active = this.#getActive();
    return {
      ...active.getMetrics(),
      usingFallback: this._useFallback
    };
  }

  getActiveType() {
    return this._useFallback ? 'memory' : 'redis';
  }
}

// Export managed singleton
export const managedCheckpointer = new CheckpointerManager();
```

---

## Phase 6: LangGraph Integration

### Objective
Integrate checkpointer with LangGraph graph compilation.

### Implementation

```javascript
// server/utils/langraphSetup.js

import { StateGraph } from '@langchain/langgraph';
import { managedCheckpointer } from '../redis/checkpointer.js';

/**
 * Create a LangGraph StateGraph with checkpointing enabled
 *
 * Usage:
 *   const graph = createCheckpointedGraph(AgentState)
 *     .addNode("process", processNode)
 *     .addNode("generate", generateNode)
 *     .addEdge("process", "generate")
 *     .compile();
 *
 *   // Invoke with thread_id for persistence
 *   await graph.invoke(input, { configurable: { thread_id: "user-123" } });
 */
export function createCheckpointedGraph(stateSchema) {
  return new StateGraph(stateSchema);
}

/**
 * Compile graph with checkpointer
 */
export function compileWithCheckpointer(graph, options = {}) {
  return graph.compile({
    checkpointer: managedCheckpointer,
    ...options
  });
}

/**
 * Get thread history
 */
export async function getThreadHistory(threadId, limit = 10) {
  const history = [];

  for await (const checkpoint of managedCheckpointer.list({ thread_id: threadId }, { limit })) {
    history.push({
      checkpointId: checkpoint.config.checkpoint_id,
      createdAt: new Date(checkpoint.metadata.created_at).toISOString(),
      step: checkpoint.metadata.step,
      source: checkpoint.metadata.source
    });
  }

  return history;
}

/**
 * Resume workflow from checkpoint
 */
export async function resumeFromCheckpoint(graph, threadId, checkpointId = null) {
  const config = {
    configurable: {
      thread_id: threadId,
      checkpoint_id: checkpointId  // null = latest
    }
  };

  // Get current state
  const state = await managedCheckpointer.get({ thread_id: threadId, checkpoint_id: checkpointId });

  if (!state) {
    throw new Error(`No checkpoint found for thread ${threadId}`);
  }

  return { state, config };
}

/**
 * Branch from existing checkpoint
 */
export async function branchFromCheckpoint(threadId, checkpointId, newThreadId) {
  // Get source checkpoint
  const sourceTuple = await managedCheckpointer.getTuple({
    thread_id: threadId,
    checkpoint_id: checkpointId
  });

  if (!sourceTuple) {
    throw new Error(`Source checkpoint not found: ${threadId}:${checkpointId}`);
  }

  // Create new checkpoint in branched thread
  const branchConfig = await managedCheckpointer.put(
    {
      thread_id: newThreadId,
      parent_id: checkpointId
    },
    sourceTuple.checkpoint,
    {
      source: 'branch',
      branched_from: { thread_id: threadId, checkpoint_id: checkpointId },
      step: sourceTuple.metadata.step
    }
  );

  console.log(`[LangGraph] Branched ${threadId}:${checkpointId} -> ${newThreadId}`);

  return branchConfig;
}
```

---

## Phase 7: Checkpointer API Routes

### Objective
Create REST API endpoints for checkpoint management.

### Implementation

```javascript
// server/routes/checkpoints.js

import express from 'express';
import { managedCheckpointer, generateThreadId } from '../redis/checkpointer.js';
import { getThreadHistory, branchFromCheckpoint } from '../utils/langraphSetup.js';

const router = express.Router();

/**
 * GET /api/checkpoints/:threadId
 * List checkpoints for a thread
 */
router.get('/:threadId', async (req, res) => {
  const { threadId } = req.params;
  const { limit = 20 } = req.query;

  try {
    const history = await getThreadHistory(threadId, parseInt(limit));

    res.json({
      success: true,
      threadId,
      checkpoints: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/checkpoints/:threadId/:checkpointId
 * Get specific checkpoint details
 */
router.get('/:threadId/:checkpointId', async (req, res) => {
  const { threadId, checkpointId } = req.params;

  try {
    const tuple = await managedCheckpointer.getTuple({
      thread_id: threadId,
      checkpoint_id: checkpointId
    });

    if (!tuple) {
      return res.status(404).json({
        success: false,
        error: 'Checkpoint not found'
      });
    }

    res.json({
      success: true,
      checkpoint: {
        id: tuple.config.checkpoint_id,
        threadId: tuple.config.thread_id,
        parentId: tuple.parent_config?.checkpoint_id || null,
        createdAt: new Date(tuple.metadata.created_at).toISOString(),
        step: tuple.metadata.step,
        source: tuple.metadata.source,
        metadata: tuple.metadata
      },
      // Include state summary (not full state for large payloads)
      stateSummary: {
        hasState: !!tuple.checkpoint,
        channelCount: Object.keys(tuple.channel_values || {}).length
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
 * DELETE /api/checkpoints/:threadId
 * Delete all checkpoints for a thread
 */
router.delete('/:threadId', async (req, res) => {
  const { threadId } = req.params;

  try {
    const deleted = await managedCheckpointer.delete({ thread_id: threadId });

    res.json({
      success: true,
      threadId,
      deleted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/checkpoints/:threadId/branch
 * Branch from a checkpoint to a new thread
 */
router.post('/:threadId/branch', async (req, res) => {
  const { threadId } = req.params;
  const { checkpointId, newThreadId } = req.body;

  if (!checkpointId) {
    return res.status(400).json({
      success: false,
      error: 'checkpointId is required'
    });
  }

  try {
    const actualNewThreadId = newThreadId || generateThreadId();
    const branchConfig = await branchFromCheckpoint(threadId, checkpointId, actualNewThreadId);

    res.json({
      success: true,
      branch: {
        sourceThread: threadId,
        sourceCheckpoint: checkpointId,
        newThread: actualNewThreadId,
        newCheckpoint: branchConfig.checkpoint_id
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
 * GET /api/checkpoints/health
 * Checkpointer health status
 */
router.get('/health', async (req, res) => {
  const metrics = managedCheckpointer.getMetrics();

  res.json({
    status: metrics.healthy ? 'healthy' : 'degraded',
    type: metrics.usingFallback ? 'memory' : 'redis',
    metrics: {
      puts: metrics.puts,
      gets: metrics.gets,
      deletes: metrics.deletes,
      errors: metrics.errors
    }
  });
});

export default router;
```

---

## Success Criteria

1. **State Persistence**: Checkpoints survive server restart (with Redis)
2. **Workflow Resume**: Can resume from any checkpoint successfully
3. **Branching**: Can create new threads from existing checkpoints
4. **Performance**: Checkpoint save < 50ms, load < 30ms
5. **Compression**: Large states compressed effectively
6. **TTL Management**: Old checkpoints expire correctly
7. **Fallback**: Graceful degradation to memory when Redis fails
8. **API Coverage**: All checkpoint operations exposed via REST

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `server/redis/checkpointer.js` | Create | Main checkpointer implementation |
| `server/utils/langraphSetup.js` | Create | LangGraph integration helpers |
| `server/routes/checkpoints.js` | Create | Checkpoint management API |
| `server/redis/index.js` | Modify | Export checkpointer |

---

## Testing Checklist

- [ ] Checkpoint saved successfully to Redis
- [ ] Checkpoint loaded with correct state
- [ ] Latest pointer updated correctly
- [ ] List returns checkpoints in correct order
- [ ] Delete removes checkpoints and index entries
- [ ] Pruning limits checkpoints per thread
- [ ] Compression reduces size for large states
- [ ] Memory fallback works when Redis unavailable
- [ ] Branch creates independent thread
- [ ] TTL expiration works (24-hour entries expire)
- [ ] API endpoints return expected responses
- [ ] LangGraph graph compiles with checkpointer
- [ ] Workflow resumes from saved checkpoint

---

## Estimated Complexity

- Phase 1: Low (key schema design)
- Phase 2: Medium (serialization with compression)
- Phase 3: High (main checkpointer class)
- Phase 4: Medium (memory fallback)
- Phase 5: Low (manager wrapper)
- Phase 6: Medium (LangGraph integration)
- Phase 7: Low (REST API)

**Total**: High complexity, ~4-5 days implementation

---

## Dependencies

- Requires **Plan 08: Redis Client Factory** to be implemented first
- Uses shared Redis client from `server/redis/client.js`
- Uses configuration from `server/config.js` REDIS section
- Requires `@langchain/langgraph` package for LangGraph integration

---

## Integration with Training System

The checkpointer enables:

1. **Training Session Recovery**: Resume interrupted training runs
2. **A/B State Comparison**: Branch to compare different generation approaches
3. **Debugging**: Inspect state at any step for troubleshooting
4. **Audit Trail**: Track how state evolved through training iterations

```javascript
// Example: Training with checkpointing
const graph = compileWithCheckpointer(trainingGraph);

// Each iteration saves state
for (const sample of trainingSamples) {
  await graph.invoke(sample, {
    configurable: {
      thread_id: `training_${sessionId}_${sample.id}`
    }
  });
}

// Resume after crash
const { state, config } = await resumeFromCheckpoint(graph, lastThreadId);
await graph.invoke(state, config);
```
