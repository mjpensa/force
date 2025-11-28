# Redis Integration Design Specification

## Document Information

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Draft |
| Last Updated | 2025-11-28 |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Current State Analysis](#3-current-state-analysis)
4. [Architecture Overview](#4-architecture-overview)
5. [Detailed Component Design](#5-detailed-component-design)
6. [Data Models and Schemas](#6-data-models-and-schemas)
7. [API Specifications](#7-api-specifications)
8. [Configuration](#8-configuration)
9. [Error Handling](#9-error-handling)
10. [Performance Considerations](#10-performance-considerations)
11. [Security Considerations](#11-security-considerations)
12. [Testing Strategy](#12-testing-strategy)
13. [Migration Plan](#13-migration-plan)
14. [Monitoring and Observability](#14-monitoring-and-observability)
15. [Appendices](#15-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

This document specifies the design for fully integrating Redis into the Force application architecture as defined in the `ARCHITECTURE` file. Redis will serve as the unified persistence layer for:

- **LangGraph Checkpointer**: State persistence for graph execution workflows
- **DSPy Cache**: LLM call result caching for cost optimization
- **Session Storage**: User session data (existing, to be unified)
- **Content Cache**: Generated content caching (existing, to be upgraded)

### 1.2 Background

The current architecture specifies Redis as the "Memory" layer in the Gold Standard Stack:

```
Orchestrator: LangGraph (StateGraph)
Intelligence: DSPy (Signatures & Modules)
Memory: Redis (LangGraph Checkpointer & DSPy Cache)
Observability: LangSmith (Tracing)
```

Currently, the codebase has partial Redis support in `sessionStorage.js` but lacks:
- Centralized Redis configuration
- LangGraph checkpointer implementation
- DSPy-specific caching layer
- Unified connection management

### 1.3 Scope

This design covers:
- New Redis infrastructure layer (`server/redis/`)
- Updates to existing caching and storage modules
- Configuration centralization
- Integration patterns for LangGraph and DSPy components

---

## 2. Goals and Non-Goals

### 2.1 Goals

| ID | Goal | Priority |
|----|------|----------|
| G1 | Implement LangGraph-compatible checkpointer for state persistence | P0 |
| G2 | Implement DSPy cache for LLM call deduplication | P0 |
| G3 | Centralize all Redis configuration in `server/config.js` | P0 |
| G4 | Create shared Redis client with connection pooling | P0 |
| G5 | Maintain graceful degradation to in-memory when Redis unavailable | P1 |
| G6 | Support horizontal scaling (multiple server instances) | P1 |
| G7 | Provide comprehensive cache metrics and monitoring | P1 |
| G8 | Minimize breaking changes to existing APIs | P2 |

### 2.2 Non-Goals

| ID | Non-Goal | Rationale |
|----|----------|-----------|
| NG1 | Redis Cluster support | Single-node sufficient for current scale |
| NG2 | Redis Sentinel (HA) | Defer until production requirements demand |
| NG3 | Custom Redis commands/Lua scripts | Keep implementation simple |
| NG4 | Real-time pub/sub features | Not required by current architecture |
| NG5 | Full LangGraph implementation | Only checkpointer; graph logic is separate |

---

## 3. Current State Analysis

### 3.1 Existing Components

#### 3.1.1 Session Storage (`server/storage/sessionStorage.js`)

**Status**: Partially Redis-ready

| Aspect | Current Implementation |
|--------|----------------------|
| Redis Support | Yes, via `ioredis` dynamic import |
| Fallback | In-memory `MemoryStorage` class |
| Connection | Creates own Redis client |
| Key Prefix | `force:session:` |
| TTL | 1 hour default |
| Compression | gzip for entries > 10KB |

**Issues**:
- Creates isolated Redis connection (not shared)
- Configuration hardcoded in module
- No connection health metrics

#### 3.1.2 Content Cache (`server/cache/contentCache.js`)

**Status**: In-memory only

| Aspect | Current Implementation |
|--------|----------------------|
| Storage | In-memory `Map` with LRU eviction |
| TTL | 12 hours per content type |
| Features | Hash-based keys, similarity matching |
| Scaling | Single-instance only |

**Issues**:
- No Redis backend option
- Cache lost on server restart
- Cannot share across instances

#### 3.1.3 Configuration (`server/config.js`)

**Status**: No Redis configuration

| Aspect | Current Implementation |
|--------|----------------------|
| Redis URL | Read in `sessionStorage.js` only |
| Centralized Config | No |
| Feature Flags | No Redis-related flags |

### 3.2 Gap Analysis

| Requirement (from ARCHITECTURE) | Current State | Gap |
|--------------------------------|---------------|-----|
| LangGraph Checkpointer | Not implemented | Full implementation needed |
| DSPy Cache | Using contentCache (memory) | Redis backend needed |
| Redis Memory Layer | Partial (sessions only) | Expand to all components |
| Shared Connection | No | New client factory needed |
| Centralized Config | No | Config update needed |

---

## 4. Architecture Overview

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Layer                            │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│   Routes     │   LangGraph  │    DSPy      │   Session             │
│   (API)      │   (Graph)    │  (Signatures)│   Management          │
└──────┬───────┴──────┬───────┴──────┬───────┴───────────┬───────────┘
       │              │              │                   │
       ▼              ▼              ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Redis Infrastructure Layer                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    server/redis/                             │   │
│  ├─────────────┬─────────────┬─────────────┬──────────────────┤   │
│  │  client.js  │checkpointer │ dspy-cache  │   index.js       │   │
│  │  (Factory)  │    .js      │    .js      │   (Exports)      │   │
│  └──────┬──────┴──────┬──────┴──────┬──────┴────────┬─────────┘   │
│         │             │             │               │              │
│         └─────────────┴─────────────┴───────────────┘              │
│                              │                                      │
│                    ┌─────────▼─────────┐                           │
│                    │  Shared Redis     │                           │
│                    │  Connection Pool  │                           │
│                    └─────────┬─────────┘                           │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Redis         │
                    │   (External)        │
                    └─────────────────────┘
```

### 4.2 Directory Structure

```
server/
├── config.js                      # Updated: Add REDIS configuration
├── redis/                         # NEW: Redis infrastructure layer
│   ├── index.js                   # Unified exports
│   ├── client.js                  # Shared Redis client factory
│   ├── checkpointer.js            # LangGraph state checkpointer
│   └── dspy-cache.js              # DSPy LLM call cache
├── storage/
│   └── sessionStorage.js          # Updated: Use shared client
└── cache/
    └── contentCache.js            # Updated: Add Redis backend option
```

### 4.3 Data Flow

Per the ARCHITECTURE specification:

```
1. Frontend sends input → API Route
                              │
                              ▼
2. LangGraph loads State from Redis (thread_id)
   └── GET force:checkpoint:{thread_id}:latest
                              │
                              ▼
3. Graph executes step (Node)
                              │
                              ▼
4. Node calls DSPy Module
   ├── Generate input hash
   ├── GET force:dspy:{signature}:{hash}
   ├── Cache HIT → Return cached result
   └── Cache MISS → LLM Call → SET with TTL
                              │
                              ▼
5. LangGraph saves updated State → Redis
   └── SET force:checkpoint:{thread_id}:{checkpoint_id}
                              │
                              ▼
6. Response streamed to Frontend
```

---

## 5. Detailed Component Design

### 5.1 Redis Client Factory (`server/redis/client.js`)

#### 5.1.1 Purpose

Provides a singleton Redis client with:
- Connection pooling
- Automatic reconnection
- Health monitoring
- Graceful shutdown support

#### 5.1.2 Class Design

```javascript
/**
 * RedisClientFactory - Singleton pattern for shared Redis connection
 */
class RedisClientFactory {
  // Private state
  #client = null;
  #connectionPromise = null;
  #isConnected = false;
  #metrics = { /* connection stats */ };

  // Public interface
  async getClient()          // Get or create client
  async connect()            // Establish connection
  async disconnect()         // Graceful shutdown
  isHealthy()               // Connection health check
  getMetrics()              // Connection metrics

  // Event handlers
  #onConnect()
  #onError(error)
  #onReconnecting()
  #onEnd()
}
```

#### 5.1.3 Connection Strategy

```
┌─────────────────┐
│ getClient()     │
└────────┬────────┘
         │
         ▼
    ┌────────────┐     Yes    ┌─────────────────┐
    │ Connected? ├───────────►│ Return client   │
    └─────┬──────┘            └─────────────────┘
          │ No
          ▼
    ┌────────────┐     Yes    ┌─────────────────┐
    │ Connecting?├───────────►│ Await promise   │
    └─────┬──────┘            └─────────────────┘
          │ No
          ▼
    ┌─────────────────┐
    │ Create client   │
    │ with retry      │
    └────────┬────────┘
             │
             ▼
    ┌────────────────┐    Fail   ┌─────────────────┐
    │ Connect        ├──────────►│ Return null     │
    └────────┬───────┘           │ (fallback mode) │
             │ Success           └─────────────────┘
             ▼
    ┌─────────────────┐
    │ Return client   │
    └─────────────────┘
```

#### 5.1.4 Retry Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max Retries | 3 | Balance between resilience and fast failure |
| Initial Delay | 1000ms | Allow transient issues to resolve |
| Max Delay | 5000ms | Cap wait time |
| Backoff Factor | 2x | Exponential backoff |

### 5.2 LangGraph Checkpointer (`server/redis/checkpointer.js`)

#### 5.2.1 Purpose

Implements the LangGraph `BaseCheckpointSaver` interface for persisting graph execution state to Redis.

#### 5.2.2 Key Schema

```
Pattern: force:checkpoint:{thread_id}:{checkpoint_id}
Example: force:checkpoint:user_123_conv_456:chk_789

Metadata Key: force:checkpoint:{thread_id}:meta
Latest Key:   force:checkpoint:{thread_id}:latest
```

#### 5.2.3 Data Structure

```javascript
// Checkpoint Entry
{
  id: "chk_789",                    // Unique checkpoint ID
  thread_id: "user_123_conv_456",   // Thread identifier
  parent_id: "chk_788",             // Parent checkpoint (for branching)
  state: {                          // Serialized graph state
    messages: [...],
    context: {...},
    current_node: "process_input"
  },
  metadata: {
    created_at: 1701234567890,
    step: 5,
    source: "node:process_input"
  }
}
```

#### 5.2.4 Interface Specification

```javascript
class RedisCheckpointer {
  /**
   * Save a checkpoint
   * @param {Object} config - {thread_id, checkpoint_id}
   * @param {Object} checkpoint - State to persist
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Saved checkpoint config
   */
  async put(config, checkpoint, metadata)

  /**
   * Load the latest checkpoint for a thread
   * @param {Object} config - {thread_id, checkpoint_id?}
   * @returns {Promise<Object|null>} - Checkpoint or null
   */
  async get(config)

  /**
   * Load checkpoint with full metadata tuple
   * @param {Object} config - {thread_id, checkpoint_id?}
   * @returns {Promise<CheckpointTuple|null>}
   */
  async getTuple(config)

  /**
   * List all checkpoints for a thread
   * @param {Object} config - {thread_id}
   * @param {Object} options - {limit, before}
   * @returns {AsyncGenerator<CheckpointTuple>}
   */
  async *list(config, options)

  /**
   * Delete checkpoints for a thread
   * @param {Object} config - {thread_id}
   * @returns {Promise<void>}
   */
  async delete(config)
}
```

#### 5.2.5 State Serialization

```javascript
// Serialization Strategy
serialize(state) {
  const json = JSON.stringify(state);

  // Compress if large (> 10KB)
  if (json.length > 10240) {
    return {
      compressed: true,
      data: gzipSync(json).toString('base64')
    };
  }

  return {
    compressed: false,
    data: json
  };
}

deserialize(entry) {
  if (entry.compressed) {
    const buffer = Buffer.from(entry.data, 'base64');
    return JSON.parse(gunzipSync(buffer).toString());
  }
  return JSON.parse(entry.data);
}
```

### 5.3 DSPy Cache (`server/redis/dspy-cache.js`)

#### 5.3.1 Purpose

Dedicated caching layer for DSPy signature executions (LLM calls) with:
- Input hash-based deduplication
- Signature-type namespacing
- Long TTL for expensive operations
- Cache analytics

#### 5.3.2 Key Schema

```
Pattern: force:dspy:{signature_type}:{input_hash}
Example: force:dspy:roadmap:a1b2c3d4e5f6...

Metrics Key: force:dspy:metrics:{signature_type}
```

#### 5.3.3 Hash Generation

```javascript
/**
 * Generate deterministic hash for cache key
 *
 * Inputs considered:
 * - Signature type (roadmap, slides, document, research-analysis)
 * - User prompt (normalized)
 * - Research files content (sampled for efficiency)
 * - Model configuration (tier, temperature)
 */
generateCacheKey(signatureType, inputs) {
  const normalized = {
    type: signatureType,
    prompt: normalizePrompt(inputs.prompt),
    contentHash: hashContent(inputs.researchFiles),
    modelConfig: {
      tier: inputs.modelTier || 'standard',
      temperature: inputs.temperature || 0
    }
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}
```

#### 5.3.4 Interface Specification

```javascript
class DSPyCache {
  /**
   * Check cache for existing result
   * @param {string} signatureType - Signature type
   * @param {Object} inputs - Signature inputs
   * @returns {Promise<Object|null>} - Cached result or null
   */
  async get(signatureType, inputs)

  /**
   * Store result in cache
   * @param {string} signatureType - Signature type
   * @param {Object} inputs - Signature inputs
   * @param {Object} result - LLM response to cache
   * @param {Object} metadata - Execution metadata
   * @returns {Promise<string>} - Cache key
   */
  async set(signatureType, inputs, result, metadata)

  /**
   * Invalidate cache entries
   * @param {string} signatureType - Signature type (optional)
   * @param {string} cacheKey - Specific key (optional)
   * @returns {Promise<number>} - Entries removed
   */
  async invalidate(signatureType, cacheKey)

  /**
   * Get cache statistics
   * @param {string} signatureType - Filter by type (optional)
   * @returns {Promise<Object>} - Cache metrics
   */
  async getStats(signatureType)
}
```

#### 5.3.5 Cache Entry Structure

```javascript
{
  // Cache metadata
  key: "force:dspy:roadmap:a1b2c3d4...",
  signatureType: "roadmap",
  inputHash: "a1b2c3d4...",

  // Cached result
  result: {
    // LLM response (signature output)
  },

  // Execution metadata
  metadata: {
    model: "gemini-2.5-flash-preview-09-2025",
    modelTier: "standard",
    inputTokens: 1523,
    outputTokens: 2847,
    latencyMs: 3421,
    timestamp: 1701234567890
  },

  // Cache metadata
  cachedAt: 1701234567890,
  expiresAt: 1701838967890,  // 7 days
  hitCount: 0
}
```

### 5.4 Updated Content Cache (`server/cache/contentCache.js`)

#### 5.4.1 Changes Required

| Current | Updated |
|---------|---------|
| In-memory Map only | Redis as L2, memory as L1 |
| No shared state | Shared across instances |
| Lost on restart | Persisted in Redis |

#### 5.4.2 Two-Tier Caching Strategy

```
┌─────────────────────────────────────────────────────┐
│                   Cache Lookup                       │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  L1: Memory     │  ← Fast, local
              │  (LRU, 30 max)  │
              └────────┬────────┘
                       │
            ┌──────────┴──────────┐
            │ HIT                 │ MISS
            ▼                     ▼
    ┌───────────────┐    ┌─────────────────┐
    │ Return result │    │  L2: Redis      │  ← Shared, persistent
    └───────────────┘    │  (12hr TTL)     │
                         └────────┬────────┘
                                  │
                       ┌──────────┴──────────┐
                       │ HIT                 │ MISS
                       ▼                     ▼
               ┌───────────────┐    ┌───────────────┐
               │ Promote to L1 │    │ Return null   │
               │ Return result │    │ (cache miss)  │
               └───────────────┘    └───────────────┘
```

#### 5.4.3 Key Changes to LRUCache Class

```javascript
class LRUCache {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.localCache = new Map();      // L1: Local memory
    this.redisCache = null;           // L2: Redis (lazy init)
    this.metrics = { /* ... */ };
  }

  async initializeRedis(redisClient) {
    this.redisCache = redisClient;
  }

  async getByContent(content, contentType, prompt = '') {
    const hash = this.generateHash(content, contentType, prompt);

    // L1 check
    const localResult = this._getFromLocal(hash);
    if (localResult) {
      this.metrics.l1Hits++;
      return localResult;
    }

    // L2 check (if available)
    if (this.redisCache) {
      const redisResult = await this._getFromRedis(hash);
      if (redisResult) {
        this.metrics.l2Hits++;
        this._setLocal(hash, redisResult);  // Promote to L1
        return redisResult;
      }
    }

    this.metrics.misses++;
    return null;
  }
}
```

### 5.5 Updated Session Storage (`server/storage/sessionStorage.js`)

#### 5.5.1 Changes Required

| Current | Updated |
|---------|---------|
| Creates own Redis client | Uses shared client from factory |
| Self-contained config | Uses centralized REDIS config |
| Isolated connection | Shared connection pool |

#### 5.5.2 Integration Points

```javascript
// Before
class RedisStorage {
  async connect() {
    const { default: Redis } = await import('ioredis');
    this.client = new Redis(CONFIG.redis.url, { /* ... */ });
  }
}

// After
import { getRedisClient } from '../redis/client.js';

class RedisStorage {
  async connect() {
    this.client = await getRedisClient();
    this._connected = this.client !== null;
  }
}
```

---

## 6. Data Models and Schemas

### 6.1 Redis Key Namespace

| Prefix | Purpose | TTL | Example |
|--------|---------|-----|---------|
| `force:session:` | User session data | 1 hour | `force:session:sess_abc123` |
| `force:cache:` | Content cache (L2) | 12 hours | `force:cache:roadmap:hash123` |
| `force:checkpoint:` | LangGraph state | 24 hours | `force:checkpoint:thread_1:chk_5` |
| `force:dspy:` | DSPy LLM cache | 7 days | `force:dspy:slides:hash456` |
| `force:metrics:` | Cache/system metrics | 1 hour | `force:metrics:dspy:roadmap` |

### 6.2 Checkpoint Schema

```typescript
interface Checkpoint {
  id: string;                    // Unique checkpoint ID
  thread_id: string;             // Thread/conversation ID
  parent_id: string | null;      // Parent checkpoint for branching
  state: {
    messages: Message[];         // Conversation messages
    context: Record<string, any>; // Execution context
    current_node: string;        // Current graph node
    [key: string]: any;          // Additional state
  };
  metadata: {
    created_at: number;          // Unix timestamp
    step: number;                // Execution step number
    source: string;              // Source node/event
  };
}

interface CheckpointTuple {
  config: { thread_id: string; checkpoint_id: string };
  checkpoint: Checkpoint;
  metadata: Record<string, any>;
  parent_config: { thread_id: string; checkpoint_id: string } | null;
}
```

### 6.3 DSPy Cache Entry Schema

```typescript
interface DSPyCacheEntry {
  // Identification
  key: string;
  signatureType: 'roadmap' | 'slides' | 'document' | 'research-analysis';
  inputHash: string;

  // Cached data
  result: Record<string, any>;   // Signature output

  // Execution metadata
  metadata: {
    model: string;
    modelTier: 'fast' | 'standard' | 'advanced';
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    timestamp: number;
  };

  // Cache metadata
  cachedAt: number;
  expiresAt: number;
  hitCount: number;
  lastAccessedAt: number;
}
```

### 6.4 Session Entry Schema

```typescript
interface SessionEntry {
  // Session data
  data: {
    researchFiles: ResearchFile[];
    generatedContent: Record<string, any>;
    preferences: Record<string, any>;
  };

  // Metadata
  compressed: boolean;
  createdAt: number;
  lastAccessed: number;
  expiresAt: number;
}
```

---

## 7. API Specifications

### 7.1 Redis Client Factory API

```javascript
// server/redis/client.js

/**
 * Get the shared Redis client instance
 * @returns {Promise<Redis|null>} Redis client or null if unavailable
 */
export async function getRedisClient(): Promise<Redis | null>;

/**
 * Check if Redis is currently healthy
 * @returns {boolean} Connection health status
 */
export function isRedisHealthy(): boolean;

/**
 * Get connection metrics
 * @returns {Object} Connection statistics
 */
export function getRedisMetrics(): {
  connected: boolean;
  reconnections: number;
  commandsExecuted: number;
  lastError: string | null;
  uptime: number;
};

/**
 * Gracefully disconnect from Redis
 * @returns {Promise<void>}
 */
export async function disconnectRedis(): Promise<void>;
```

### 7.2 Checkpointer API

```javascript
// server/redis/checkpointer.js

export class RedisCheckpointer {
  /**
   * Create a new checkpointer instance
   * @param {Object} options - Configuration options
   */
  constructor(options?: {
    keyPrefix?: string;
    ttlSeconds?: number;
    compression?: boolean;
  });

  /**
   * Save checkpoint state
   */
  async put(
    config: { thread_id: string; checkpoint_id?: string },
    checkpoint: object,
    metadata?: object
  ): Promise<{ thread_id: string; checkpoint_id: string }>;

  /**
   * Load checkpoint state
   */
  async get(
    config: { thread_id: string; checkpoint_id?: string }
  ): Promise<object | null>;

  /**
   * Load checkpoint with metadata
   */
  async getTuple(
    config: { thread_id: string; checkpoint_id?: string }
  ): Promise<CheckpointTuple | null>;

  /**
   * List checkpoints for thread
   */
  async *list(
    config: { thread_id: string },
    options?: { limit?: number; before?: string }
  ): AsyncGenerator<CheckpointTuple>;

  /**
   * Delete thread checkpoints
   */
  async delete(
    config: { thread_id: string }
  ): Promise<void>;
}
```

### 7.3 DSPy Cache API

```javascript
// server/redis/dspy-cache.js

export class DSPyCache {
  /**
   * Create a new DSPy cache instance
   */
  constructor(options?: {
    keyPrefix?: string;
    defaultTtlSeconds?: number;
  });

  /**
   * Get cached result
   */
  async get(
    signatureType: string,
    inputs: {
      prompt: string;
      researchFiles?: Array<{ filename: string; content: string }>;
      modelTier?: string;
    }
  ): Promise<{ result: object; metadata: object } | null>;

  /**
   * Cache a result
   */
  async set(
    signatureType: string,
    inputs: object,
    result: object,
    metadata?: {
      model?: string;
      modelTier?: string;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs?: number;
    }
  ): Promise<string>;

  /**
   * Invalidate cache entries
   */
  async invalidate(
    signatureType?: string,
    cacheKey?: string
  ): Promise<number>;

  /**
   * Get cache statistics
   */
  async getStats(
    signatureType?: string
  ): Promise<{
    totalEntries: number;
    hitRate: string;
    totalHits: number;
    totalMisses: number;
    estimatedSavings: number;
    bySignature: Record<string, object>;
  }>;
}
```

### 7.4 Unified Exports

```javascript
// server/redis/index.js

export {
  getRedisClient,
  isRedisHealthy,
  getRedisMetrics,
  disconnectRedis
} from './client.js';

export { RedisCheckpointer } from './checkpointer.js';
export { DSPyCache } from './dspy-cache.js';

// Singleton instances for convenience
export const checkpointer: RedisCheckpointer;
export const dspyCache: DSPyCache;

// Initialization
export async function initializeRedis(): Promise<boolean>;
export async function shutdownRedis(): Promise<void>;
```

---

## 8. Configuration

### 8.1 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `null` | Redis connection URL |
| `REDIS_TLS` | No | `false` | Enable TLS for Redis |
| `REDIS_MAX_RETRIES` | No | `3` | Max connection retry attempts |
| `REDIS_CONNECT_TIMEOUT` | No | `5000` | Connection timeout (ms) |

### 8.2 Configuration Schema (`server/config.js`)

```javascript
export const CONFIG = {
  // ... existing config ...

  REDIS: {
    // Connection
    url: process.env.REDIS_URL || null,
    enabled: !!process.env.REDIS_URL,
    tls: process.env.REDIS_TLS === 'true',

    // Key prefixes (namespace isolation)
    keyPrefixes: {
      session: 'force:session:',
      cache: 'force:cache:',
      checkpoint: 'force:checkpoint:',
      dspy: 'force:dspy:',
      metrics: 'force:metrics:'
    },

    // TTL settings (seconds)
    ttl: {
      session: 60 * 60,              // 1 hour
      cache: 12 * 60 * 60,           // 12 hours
      checkpoint: 24 * 60 * 60,      // 24 hours
      dspy: 7 * 24 * 60 * 60,        // 7 days
      metrics: 60 * 60               // 1 hour
    },

    // Connection settings
    connection: {
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 5000,
      commandTimeout: 2000,
      retryAttempts: parseInt(process.env.REDIS_MAX_RETRIES, 10) || 3,
      retryBaseDelay: 1000,
      retryMaxDelay: 5000,
      lazyConnect: true
    },

    // Feature flags
    features: {
      compression: true,
      compressionThreshold: 10240,   // 10KB
      l1CacheEnabled: true,
      metricsEnabled: true
    }
  }
};
```

---

## 9. Error Handling

### 9.1 Error Categories

| Category | Examples | Handling Strategy |
|----------|----------|-------------------|
| Connection Errors | ECONNREFUSED, timeout | Retry with backoff, fallback to memory |
| Command Errors | WRONGTYPE, OOM | Log, return error to caller |
| Serialization Errors | JSON parse failure | Log, invalidate entry, return null |
| TTL/Expiry Errors | Key not found | Treat as cache miss |

### 9.2 Fallback Behavior

```javascript
// All Redis operations should gracefully degrade

async function withFallback(redisOp, fallbackOp) {
  if (!isRedisHealthy()) {
    return fallbackOp();
  }

  try {
    return await redisOp();
  } catch (error) {
    logError('Redis operation failed', error);
    metrics.recordError(error);
    return fallbackOp();
  }
}

// Example usage
async function getCachedResult(key) {
  return withFallback(
    () => redis.get(key),
    () => memoryCache.get(key)
  );
}
```

### 9.3 Error Codes

| Code | Name | Description |
|------|------|-------------|
| `REDIS_CONNECTION_FAILED` | Connection Failed | Unable to connect to Redis |
| `REDIS_COMMAND_TIMEOUT` | Command Timeout | Command exceeded timeout |
| `REDIS_SERIALIZATION_ERROR` | Serialization Error | Failed to serialize/deserialize |
| `REDIS_KEY_NOT_FOUND` | Key Not Found | Requested key does not exist |
| `REDIS_QUOTA_EXCEEDED` | Quota Exceeded | Memory/storage limit reached |

---

## 10. Performance Considerations

### 10.1 Connection Pooling

| Metric | Target | Rationale |
|--------|--------|-----------|
| Max Connections | 10 | Balance between concurrency and resources |
| Min Idle | 2 | Reduce cold-start latency |
| Idle Timeout | 30s | Release unused connections |

### 10.2 Caching Strategy

| Cache | L1 (Memory) | L2 (Redis) |
|-------|-------------|------------|
| Content | 30 entries, LRU | 12hr TTL |
| DSPy | 50 entries, LRU | 7 day TTL |
| Checkpoints | None | 24hr TTL |
| Sessions | None | 1hr TTL |

### 10.3 Serialization Optimization

```javascript
// Compression thresholds
const COMPRESSION_CONFIG = {
  enabled: true,
  threshold: 10240,      // 10KB
  algorithm: 'gzip',
  level: 6               // Balance speed/ratio
};

// Sampling for hash generation (large content)
const HASH_CONFIG = {
  sampleSize: 20000,     // Characters to sample
  sampleStrategy: 'head_tail'  // First N + Last N/4
};
```

### 10.4 Expected Performance

| Operation | Target Latency | Notes |
|-----------|---------------|-------|
| Redis GET | < 5ms | Local network |
| Redis SET | < 10ms | With compression if needed |
| L1 Cache Hit | < 1ms | Memory access |
| L2 Cache Hit | < 10ms | Redis + deserialize |
| Checkpoint Save | < 50ms | Larger payload |
| Checkpoint Load | < 30ms | Single key fetch |

---

## 11. Security Considerations

### 11.1 Data Protection

| Concern | Mitigation |
|---------|------------|
| Data at Rest | Enable Redis AUTH, use TLS |
| Data in Transit | TLS encryption (`REDIS_TLS=true`) |
| Key Enumeration | Use unpredictable thread/checkpoint IDs |
| Injection | Validate all key components |

### 11.2 Key Validation

```javascript
// Prevent key injection
function validateKeyComponent(component) {
  if (typeof component !== 'string') {
    throw new Error('Key component must be string');
  }

  // Disallow special Redis characters
  if (/[:\*\?\[\]\n\r]/.test(component)) {
    throw new Error('Invalid characters in key component');
  }

  // Reasonable length limit
  if (component.length > 256) {
    throw new Error('Key component too long');
  }

  return component;
}
```

### 11.3 Sensitive Data Handling

```javascript
// Exclude sensitive fields from caching
const SENSITIVE_FIELDS = ['api_key', 'password', 'token', 'secret'];

function sanitizeForCache(data) {
  const sanitized = { ...data };
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }
  return sanitized;
}
```

---

## 12. Testing Strategy

### 12.1 Test Categories

| Category | Scope | Tools |
|----------|-------|-------|
| Unit Tests | Individual functions | Jest, mocks |
| Integration Tests | Redis operations | Jest, redis-mock or testcontainers |
| Fallback Tests | Graceful degradation | Jest, connection simulation |
| Performance Tests | Latency, throughput | Custom benchmarks |

### 12.2 Test Cases

#### 12.2.1 Redis Client Factory

```javascript
describe('RedisClientFactory', () => {
  test('returns null when REDIS_URL not configured');
  test('establishes connection with valid URL');
  test('retries on transient connection failure');
  test('returns same instance on multiple getClient calls');
  test('reports healthy when connected');
  test('reports unhealthy after disconnect');
  test('gracefully handles disconnect');
});
```

#### 12.2.2 Checkpointer

```javascript
describe('RedisCheckpointer', () => {
  test('saves checkpoint with auto-generated ID');
  test('saves checkpoint with provided ID');
  test('loads latest checkpoint for thread');
  test('loads specific checkpoint by ID');
  test('lists checkpoints in reverse chronological order');
  test('respects limit parameter in list');
  test('deletes all checkpoints for thread');
  test('handles compression for large states');
  test('falls back gracefully when Redis unavailable');
});
```

#### 12.2.3 DSPy Cache

```javascript
describe('DSPyCache', () => {
  test('returns null for cache miss');
  test('returns cached result for cache hit');
  test('generates consistent hash for same inputs');
  test('generates different hash for different inputs');
  test('respects TTL expiration');
  test('increments hit count on access');
  test('invalidates by signature type');
  test('invalidates by specific key');
  test('provides accurate statistics');
});
```

### 12.3 Mock Strategy

```javascript
// Redis mock for unit tests
const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG')
};

// Usage in tests
jest.mock('../redis/client.js', () => ({
  getRedisClient: jest.fn().mockResolvedValue(redisMock),
  isRedisHealthy: jest.fn().mockReturnValue(true)
}));
```

---

## 13. Migration Plan

### 13.1 Implementation Phases

```
Phase 1: Foundation (Week 1)
├── Create server/redis/ directory structure
├── Implement client.js (connection factory)
├── Add REDIS config to server/config.js
├── Write unit tests for client
└── Verify graceful degradation

Phase 2: Checkpointer (Week 2)
├── Implement checkpointer.js
├── Define checkpoint data schema
├── Write unit + integration tests
├── Document API
└── Create usage examples

Phase 3: DSPy Cache (Week 3)
├── Implement dspy-cache.js
├── Define cache entry schema
├── Write unit + integration tests
├── Add metrics collection
└── Document API

Phase 4: Integration (Week 4)
├── Update contentCache.js for L2 caching
├── Update sessionStorage.js to use shared client
├── Update index.js exports
├── End-to-end testing
└── Performance benchmarking

Phase 5: Rollout (Week 5)
├── Staging deployment
├── Monitoring setup
├── Production deployment (behind feature flag)
├── Gradual rollout
└── Documentation finalization
```

### 13.2 Backward Compatibility

| Component | Strategy |
|-----------|----------|
| sessionStorage | Maintain existing API, internal refactor only |
| contentCache | Add Redis as optional L2, existing behavior unchanged |
| Config | New REDIS section, no changes to existing config |

### 13.3 Feature Flags

```javascript
// Gradual rollout flags
const FEATURE_FLAGS = {
  REDIS_CHECKPOINTER_ENABLED: process.env.FF_REDIS_CHECKPOINTER === 'true',
  REDIS_DSPY_CACHE_ENABLED: process.env.FF_REDIS_DSPY_CACHE === 'true',
  REDIS_CONTENT_CACHE_L2_ENABLED: process.env.FF_REDIS_CONTENT_L2 === 'true'
};
```

### 13.4 Rollback Plan

1. **Immediate**: Disable feature flags to fall back to memory
2. **Short-term**: Revert to previous code version
3. **Data**: No data migration needed (cache is regeneratable)

---

## 14. Monitoring and Observability

### 14.1 Metrics to Track

| Metric | Type | Description |
|--------|------|-------------|
| `redis.connection.status` | Gauge | 1=connected, 0=disconnected |
| `redis.connection.reconnects` | Counter | Reconnection attempts |
| `redis.commands.total` | Counter | Total commands executed |
| `redis.commands.errors` | Counter | Command errors |
| `redis.commands.latency` | Histogram | Command latency distribution |
| `cache.hits` | Counter | Cache hits (by type) |
| `cache.misses` | Counter | Cache misses (by type) |
| `cache.hit_rate` | Gauge | Hit rate percentage |
| `checkpoint.saves` | Counter | Checkpoint save operations |
| `checkpoint.loads` | Counter | Checkpoint load operations |
| `dspy.cache.savings` | Counter | Estimated API calls saved |

### 14.2 Health Check Endpoint

```javascript
// GET /health/redis
{
  "status": "healthy",  // or "degraded", "unhealthy"
  "redis": {
    "connected": true,
    "latency_ms": 2,
    "uptime_seconds": 3600
  },
  "caches": {
    "content": { "size": 45, "hitRate": "78.5%" },
    "dspy": { "size": 120, "hitRate": "85.2%" },
    "checkpoints": { "activeThreads": 15 }
  }
}
```

### 14.3 Alerting Rules

| Alert | Condition | Severity |
|-------|-----------|----------|
| Redis Disconnected | connection.status == 0 for 1m | Warning |
| High Error Rate | errors/total > 5% for 5m | Warning |
| High Latency | p99 latency > 100ms for 5m | Warning |
| Cache Hit Rate Low | hit_rate < 50% for 15m | Info |

### 14.4 Logging

```javascript
// Structured logging format
{
  "level": "info",
  "component": "redis",
  "operation": "checkpoint.save",
  "thread_id": "user_123_conv_456",
  "checkpoint_id": "chk_789",
  "latency_ms": 15,
  "compressed": true,
  "size_bytes": 4521
}
```

---

## 15. Appendices

### 15.1 Reference Implementation: Client Factory

```javascript
// server/redis/client.js
import Redis from 'ioredis';
import { CONFIG } from '../config.js';

class RedisClientFactory {
  #client = null;
  #connectionPromise = null;
  #isConnected = false;
  #metrics = {
    reconnections: 0,
    commandsExecuted: 0,
    errors: 0,
    lastError: null,
    connectedAt: null
  };

  async getClient() {
    if (!CONFIG.REDIS.enabled) {
      return null;
    }

    if (this.#isConnected && this.#client) {
      return this.#client;
    }

    if (this.#connectionPromise) {
      return this.#connectionPromise;
    }

    this.#connectionPromise = this.#connect();

    try {
      return await this.#connectionPromise;
    } finally {
      this.#connectionPromise = null;
    }
  }

  async #connect() {
    const { connection, url, tls } = CONFIG.REDIS;

    try {
      this.#client = new Redis(url, {
        connectTimeout: connection.connectTimeout,
        commandTimeout: connection.commandTimeout,
        maxRetriesPerRequest: connection.retryAttempts,
        retryStrategy: (times) => {
          if (times > connection.retryAttempts) {
            return null;
          }
          const delay = Math.min(
            connection.retryBaseDelay * Math.pow(2, times - 1),
            connection.retryMaxDelay
          );
          return delay;
        },
        lazyConnect: connection.lazyConnect,
        tls: tls ? {} : undefined
      });

      this.#client.on('connect', () => this.#onConnect());
      this.#client.on('error', (err) => this.#onError(err));
      this.#client.on('reconnecting', () => this.#onReconnecting());
      this.#client.on('end', () => this.#onEnd());

      await this.#client.connect();
      await this.#client.ping();

      return this.#client;
    } catch (error) {
      console.error('[Redis] Connection failed:', error.message);
      this.#metrics.lastError = error.message;
      this.#isConnected = false;

      if (this.#client) {
        try { await this.#client.quit(); } catch {}
        this.#client = null;
      }

      return null;
    }
  }

  #onConnect() {
    this.#isConnected = true;
    this.#metrics.connectedAt = Date.now();
    console.log('[Redis] Connected');
  }

  #onError(error) {
    this.#metrics.errors++;
    this.#metrics.lastError = error.message;
    console.error('[Redis] Error:', error.message);
  }

  #onReconnecting() {
    this.#metrics.reconnections++;
    console.log('[Redis] Reconnecting...');
  }

  #onEnd() {
    this.#isConnected = false;
    console.log('[Redis] Connection closed');
  }

  isHealthy() {
    return this.#isConnected && this.#client !== null;
  }

  getMetrics() {
    return {
      ...this.#metrics,
      connected: this.#isConnected,
      uptime: this.#metrics.connectedAt
        ? Date.now() - this.#metrics.connectedAt
        : 0
    };
  }

  async disconnect() {
    if (this.#client) {
      try {
        await this.#client.quit();
      } catch (error) {
        console.error('[Redis] Disconnect error:', error.message);
      }
      this.#client = null;
      this.#isConnected = false;
    }
  }
}

// Singleton instance
const factory = new RedisClientFactory();

export const getRedisClient = () => factory.getClient();
export const isRedisHealthy = () => factory.isHealthy();
export const getRedisMetrics = () => factory.getMetrics();
export const disconnectRedis = () => factory.disconnect();

export default factory;
```

### 15.2 Reference Implementation: Checkpointer

```javascript
// server/redis/checkpointer.js
import { getRedisClient, isRedisHealthy } from './client.js';
import { CONFIG } from '../config.js';
import { gzipSync, gunzipSync } from 'zlib';
import crypto from 'crypto';

export class RedisCheckpointer {
  constructor(options = {}) {
    this.keyPrefix = options.keyPrefix || CONFIG.REDIS.keyPrefixes.checkpoint;
    this.ttlSeconds = options.ttlSeconds || CONFIG.REDIS.ttl.checkpoint;
    this.compression = options.compression ?? CONFIG.REDIS.features.compression;
    this.compressionThreshold = CONFIG.REDIS.features.compressionThreshold;
  }

  #key(threadId, checkpointId) {
    return `${this.keyPrefix}${threadId}:${checkpointId}`;
  }

  #latestKey(threadId) {
    return `${this.keyPrefix}${threadId}:latest`;
  }

  #metaKey(threadId) {
    return `${this.keyPrefix}${threadId}:meta`;
  }

  #generateCheckpointId() {
    return `chk_${crypto.randomBytes(8).toString('hex')}`;
  }

  #serialize(data) {
    const json = JSON.stringify(data);

    if (this.compression && json.length > this.compressionThreshold) {
      return {
        compressed: true,
        data: gzipSync(Buffer.from(json)).toString('base64')
      };
    }

    return { compressed: false, data: json };
  }

  #deserialize(entry) {
    if (entry.compressed) {
      const buffer = Buffer.from(entry.data, 'base64');
      return JSON.parse(gunzipSync(buffer).toString());
    }
    return JSON.parse(entry.data);
  }

  async put(config, checkpoint, metadata = {}) {
    const client = await getRedisClient();
    if (!client) {
      throw new Error('Redis unavailable');
    }

    const threadId = config.thread_id;
    const checkpointId = config.checkpoint_id || this.#generateCheckpointId();

    const entry = {
      id: checkpointId,
      thread_id: threadId,
      parent_id: config.parent_id || null,
      checkpoint: this.#serialize(checkpoint),
      metadata: {
        ...metadata,
        created_at: Date.now()
      }
    };

    const key = this.#key(threadId, checkpointId);
    const latestKey = this.#latestKey(threadId);

    // Save checkpoint and update latest pointer
    await client.setex(key, this.ttlSeconds, JSON.stringify(entry));
    await client.setex(latestKey, this.ttlSeconds, checkpointId);

    return { thread_id: threadId, checkpoint_id: checkpointId };
  }

  async get(config) {
    const tuple = await this.getTuple(config);
    return tuple?.checkpoint || null;
  }

  async getTuple(config) {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    const threadId = config.thread_id;
    let checkpointId = config.checkpoint_id;

    // Get latest if no specific ID
    if (!checkpointId) {
      checkpointId = await client.get(this.#latestKey(threadId));
      if (!checkpointId) {
        return null;
      }
    }

    const raw = await client.get(this.#key(threadId, checkpointId));
    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw);

    return {
      config: { thread_id: threadId, checkpoint_id: checkpointId },
      checkpoint: this.#deserialize(entry.checkpoint),
      metadata: entry.metadata,
      parent_config: entry.parent_id
        ? { thread_id: threadId, checkpoint_id: entry.parent_id }
        : null
    };
  }

  async *list(config, options = {}) {
    const client = await getRedisClient();
    if (!client) {
      return;
    }

    const threadId = config.thread_id;
    const pattern = this.#key(threadId, '*');
    const limit = options.limit || 100;

    const keys = await client.keys(pattern);

    // Filter out meta and latest keys
    const checkpointKeys = keys.filter(k =>
      !k.endsWith(':meta') && !k.endsWith(':latest')
    );

    // Sort by checkpoint ID (assuming chronological)
    checkpointKeys.sort().reverse();

    let count = 0;
    for (const key of checkpointKeys) {
      if (count >= limit) break;

      const raw = await client.get(key);
      if (raw) {
        const entry = JSON.parse(raw);
        yield {
          config: { thread_id: threadId, checkpoint_id: entry.id },
          checkpoint: this.#deserialize(entry.checkpoint),
          metadata: entry.metadata,
          parent_config: entry.parent_id
            ? { thread_id: threadId, checkpoint_id: entry.parent_id }
            : null
        };
        count++;
      }
    }
  }

  async delete(config) {
    const client = await getRedisClient();
    if (!client) {
      return;
    }

    const threadId = config.thread_id;
    const pattern = `${this.keyPrefix}${threadId}:*`;
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(...keys);
    }
  }
}

export default RedisCheckpointer;
```

### 15.3 Glossary

| Term | Definition |
|------|------------|
| **Checkpointer** | Component that saves/loads graph execution state |
| **DSPy** | Framework for programming language models with signatures |
| **L1 Cache** | Local in-memory cache (fast, single-instance) |
| **L2 Cache** | Redis cache (shared, persistent across instances) |
| **LangGraph** | Framework for building stateful, multi-actor LLM applications |
| **LRU** | Least Recently Used - cache eviction policy |
| **Signature** | DSPy's declarative input/output specification for LLM tasks |
| **Thread ID** | Unique identifier for a conversation/workflow thread |
| **TTL** | Time To Live - automatic expiration period |

### 15.4 References

- [Redis Documentation](https://redis.io/documentation)
- [ioredis GitHub](https://github.com/redis/ioredis)
- [LangGraph Checkpointers](https://langchain-ai.github.io/langgraph/concepts/persistence/)
- [DSPy Documentation](https://dspy-docs.vercel.app/)
- Project ARCHITECTURE file

---

*End of Design Specification*
