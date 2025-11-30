# Implementation Plan: Redis Client Factory

## Problem Statement

The current codebase has fragmented Redis connectivity with multiple issues:

1. **Isolated Connections**: `sessionStorage.js` creates its own Redis client, not shared with other components
2. **No Centralized Configuration**: Redis settings scattered across modules instead of centralized in `config.js`
3. **Missing Connection Pooling**: Each component that needs Redis would create its own connection
4. **No Health Monitoring**: No unified way to check Redis health or collect connection metrics
5. **Inconsistent Error Handling**: No standard retry logic or graceful degradation pattern

This fragmentation prevents the implementation of LangGraph Checkpointer and DSPy Cache which require a shared, reliable Redis connection.

## Current State

```javascript
// sessionStorage.js - Creates isolated Redis client
class RedisStorage {
  async connect() {
    const { default: Redis } = await import('ioredis');
    this.client = new Redis(CONFIG.redis.url, {
      connectTimeout: CONFIG.redis.connectTimeout,
      // ... each module has its own configuration
    });
  }
}

// No centralized Redis config in server/config.js
// No shared client factory
// No connection health metrics
```

## Goal

Create a centralized Redis Client Factory that:

1. Provides a singleton Redis client with connection pooling
2. Centralizes all Redis configuration in `server/config.js`
3. Implements automatic reconnection with exponential backoff
4. Exposes health check and metrics APIs
5. Supports graceful shutdown for clean server termination
6. Enables other components (Checkpointer, DSPy Cache) to share the connection

---

## Phase 1: Centralized Configuration

### Objective
Add Redis configuration section to `server/config.js`.

### Implementation

```javascript
// server/config.js - Add REDIS section

export const CONFIG = {
  // ... existing config ...

  REDIS: {
    // Connection URL (null = disabled)
    url: process.env.REDIS_URL || null,
    enabled: !!process.env.REDIS_URL,

    // TLS support for production
    tls: process.env.REDIS_TLS === 'true',

    // Key namespace prefixes (isolation between features)
    keyPrefixes: {
      session: 'force:session:',
      cache: 'force:cache:',
      checkpoint: 'force:checkpoint:',
      dspy: 'force:dspy:',
      metrics: 'force:metrics:'
    },

    // TTL defaults (seconds)
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
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT, 10) || 2000,
      retryAttempts: parseInt(process.env.REDIS_MAX_RETRIES, 10) || 3,
      retryBaseDelay: 1000,          // Initial retry delay
      retryMaxDelay: 5000,           // Maximum retry delay
      lazyConnect: true              // Don't connect until first command
    },

    // Feature flags
    features: {
      compression: true,             // Compress large values
      compressionThreshold: 10240,   // 10KB threshold
      metricsEnabled: true,          // Track connection metrics
      healthCheckInterval: 30000     // Health check every 30s
    }
  }
};
```

### Validation Script

```javascript
// scripts/validate-redis-config.js
import { CONFIG } from '../server/config.js';

function validateRedisConfig() {
  const errors = [];

  if (CONFIG.REDIS.enabled && !CONFIG.REDIS.url) {
    errors.push('REDIS enabled but url is not set');
  }

  if (CONFIG.REDIS.connection.connectTimeout < 1000) {
    errors.push('connectTimeout should be at least 1000ms');
  }

  if (CONFIG.REDIS.connection.retryAttempts < 1) {
    errors.push('retryAttempts should be at least 1');
  }

  // Validate TTL values
  for (const [key, value] of Object.entries(CONFIG.REDIS.ttl)) {
    if (typeof value !== 'number' || value < 0) {
      errors.push(`Invalid TTL for ${key}: ${value}`);
    }
  }

  if (errors.length > 0) {
    console.error('Redis Config Validation FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
    return false;
  }

  console.log('Redis Config Validation: PASSED');
  return true;
}

validateRedisConfig();
```

---

## Phase 2: Redis Client Factory Implementation

### Objective
Create a singleton Redis client factory with connection management.

### Implementation

```javascript
// server/redis/client.js

import { CONFIG } from '../config.js';

/**
 * Redis Client Factory
 *
 * Provides a singleton Redis client with:
 * - Connection pooling via ioredis
 * - Automatic reconnection with exponential backoff
 * - Health monitoring and metrics
 * - Graceful shutdown support
 *
 * Usage:
 *   import { getRedisClient, isRedisHealthy } from './redis/client.js';
 *
 *   const client = await getRedisClient();
 *   if (client) {
 *     await client.set('key', 'value');
 *   }
 */

class RedisClientFactory {
  #client = null;
  #connectionPromise = null;
  #isConnected = false;
  #isShuttingDown = false;
  #healthCheckInterval = null;

  #metrics = {
    connectionAttempts: 0,
    reconnections: 0,
    commandsExecuted: 0,
    commandErrors: 0,
    lastError: null,
    lastErrorTime: null,
    connectedAt: null,
    lastHealthCheck: null,
    healthCheckFailures: 0
  };

  constructor() {
    // Register shutdown handler
    process.on('SIGTERM', () => this.#handleShutdown('SIGTERM'));
    process.on('SIGINT', () => this.#handleShutdown('SIGINT'));
  }

  /**
   * Get the shared Redis client instance
   * @returns {Promise<Redis|null>} Redis client or null if unavailable
   */
  async getClient() {
    // Redis disabled
    if (!CONFIG.REDIS.enabled) {
      return null;
    }

    // Shutting down
    if (this.#isShuttingDown) {
      return null;
    }

    // Already connected
    if (this.#isConnected && this.#client) {
      return this.#client;
    }

    // Connection in progress - wait for it
    if (this.#connectionPromise) {
      return this.#connectionPromise;
    }

    // Start new connection
    this.#connectionPromise = this.#connect();

    try {
      return await this.#connectionPromise;
    } finally {
      this.#connectionPromise = null;
    }
  }

  /**
   * Establish Redis connection with retry logic
   * @private
   */
  async #connect() {
    const { connection, url, tls, features } = CONFIG.REDIS;
    this.#metrics.connectionAttempts++;

    try {
      // Dynamic import of ioredis (optional dependency)
      const { default: Redis } = await import('ioredis');

      this.#client = new Redis(url, {
        connectTimeout: connection.connectTimeout,
        commandTimeout: connection.commandTimeout,
        maxRetriesPerRequest: connection.retryAttempts,

        // Exponential backoff retry strategy
        retryStrategy: (times) => {
          if (times > connection.retryAttempts) {
            console.error(`[Redis] Max retry attempts (${connection.retryAttempts}) exceeded`);
            return null; // Stop retrying
          }

          const delay = Math.min(
            connection.retryBaseDelay * Math.pow(2, times - 1),
            connection.retryMaxDelay
          );

          console.log(`[Redis] Retry attempt ${times}/${connection.retryAttempts} in ${delay}ms`);
          return delay;
        },

        lazyConnect: connection.lazyConnect,
        tls: tls ? {} : undefined,

        // Enable offline queue for resilience
        enableOfflineQueue: true,

        // Reconnect on error
        reconnectOnError: (err) => {
          const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
          return targetErrors.some(e => err.message.includes(e));
        }
      });

      // Register event handlers
      this.#client.on('connect', () => this.#onConnect());
      this.#client.on('ready', () => this.#onReady());
      this.#client.on('error', (err) => this.#onError(err));
      this.#client.on('close', () => this.#onClose());
      this.#client.on('reconnecting', () => this.#onReconnecting());
      this.#client.on('end', () => this.#onEnd());

      // Connect
      await this.#client.connect();

      // Verify connection
      await this.#client.ping();

      // Start health check interval
      if (features.metricsEnabled && features.healthCheckInterval > 0) {
        this.#startHealthCheck();
      }

      return this.#client;

    } catch (error) {
      console.error('[Redis] Connection failed:', error.message);
      this.#metrics.lastError = error.message;
      this.#metrics.lastErrorTime = Date.now();
      this.#isConnected = false;

      // Cleanup failed client
      if (this.#client) {
        try { await this.#client.quit(); } catch {}
        this.#client = null;
      }

      return null;
    }
  }

  /**
   * Event Handlers
   */
  #onConnect() {
    console.log('[Redis] Connecting...');
  }

  #onReady() {
    this.#isConnected = true;
    this.#metrics.connectedAt = Date.now();
    this.#metrics.healthCheckFailures = 0;
    console.log('[Redis] Connected and ready');
  }

  #onError(error) {
    this.#metrics.commandErrors++;
    this.#metrics.lastError = error.message;
    this.#metrics.lastErrorTime = Date.now();
    console.error('[Redis] Error:', error.message);
  }

  #onClose() {
    console.log('[Redis] Connection closed');
  }

  #onReconnecting() {
    this.#metrics.reconnections++;
    console.log('[Redis] Reconnecting...');
  }

  #onEnd() {
    this.#isConnected = false;
    console.log('[Redis] Connection ended');
  }

  /**
   * Start periodic health checks
   */
  #startHealthCheck() {
    if (this.#healthCheckInterval) {
      clearInterval(this.#healthCheckInterval);
    }

    this.#healthCheckInterval = setInterval(async () => {
      try {
        if (this.#client && this.#isConnected) {
          const start = Date.now();
          await this.#client.ping();
          this.#metrics.lastHealthCheck = {
            time: Date.now(),
            latencyMs: Date.now() - start,
            success: true
          };
          this.#metrics.healthCheckFailures = 0;
        }
      } catch (error) {
        this.#metrics.healthCheckFailures++;
        this.#metrics.lastHealthCheck = {
          time: Date.now(),
          success: false,
          error: error.message
        };

        console.warn(`[Redis] Health check failed (${this.#metrics.healthCheckFailures}):`, error.message);

        // Trigger reconnect after multiple failures
        if (this.#metrics.healthCheckFailures >= 3) {
          console.error('[Redis] Multiple health check failures, triggering reconnect');
          this.#isConnected = false;
        }
      }
    }, CONFIG.REDIS.features.healthCheckInterval);
  }

  /**
   * Handle process shutdown
   */
  async #handleShutdown(signal) {
    if (this.#isShuttingDown) return;

    console.log(`[Redis] Received ${signal}, shutting down...`);
    this.#isShuttingDown = true;

    await this.disconnect();
  }

  /**
   * Check if Redis is currently healthy
   * @returns {boolean} Connection health status
   */
  isHealthy() {
    if (!CONFIG.REDIS.enabled) return false;
    return this.#isConnected && this.#client !== null;
  }

  /**
   * Get connection metrics
   * @returns {Object} Connection statistics
   */
  getMetrics() {
    return {
      enabled: CONFIG.REDIS.enabled,
      connected: this.#isConnected,
      ...this.#metrics,
      uptime: this.#metrics.connectedAt
        ? Date.now() - this.#metrics.connectedAt
        : 0
    };
  }

  /**
   * Gracefully disconnect from Redis
   * @returns {Promise<void>}
   */
  async disconnect() {
    // Stop health checks
    if (this.#healthCheckInterval) {
      clearInterval(this.#healthCheckInterval);
      this.#healthCheckInterval = null;
    }

    // Disconnect client
    if (this.#client) {
      try {
        await this.#client.quit();
        console.log('[Redis] Disconnected gracefully');
      } catch (error) {
        console.error('[Redis] Disconnect error:', error.message);
        // Force destroy if quit fails
        try { this.#client.disconnect(); } catch {}
      }

      this.#client = null;
      this.#isConnected = false;
    }
  }

  /**
   * Execute a command with metrics tracking
   * @param {Function} operation - Async operation to execute
   * @returns {Promise<any>}
   */
  async execute(operation) {
    const client = await this.getClient();
    if (!client) {
      throw new Error('Redis unavailable');
    }

    try {
      const result = await operation(client);
      this.#metrics.commandsExecuted++;
      return result;
    } catch (error) {
      this.#metrics.commandErrors++;
      this.#metrics.lastError = error.message;
      this.#metrics.lastErrorTime = Date.now();
      throw error;
    }
  }
}

// Singleton instance
const factory = new RedisClientFactory();

// Export functions (not the class instance directly)
export const getRedisClient = () => factory.getClient();
export const isRedisHealthy = () => factory.isHealthy();
export const getRedisMetrics = () => factory.getMetrics();
export const disconnectRedis = () => factory.disconnect();
export const executeRedis = (op) => factory.execute(op);

export default factory;
```

---

## Phase 3: Index and Initialization Module

### Objective
Create unified exports and initialization helpers.

### Implementation

```javascript
// server/redis/index.js

/**
 * Redis Infrastructure Layer
 *
 * Unified exports for all Redis functionality.
 *
 * Usage:
 *   import { getRedisClient, initializeRedis } from './redis/index.js';
 *
 *   // During server startup
 *   await initializeRedis();
 *
 *   // In application code
 *   const client = await getRedisClient();
 */

export {
  getRedisClient,
  isRedisHealthy,
  getRedisMetrics,
  disconnectRedis,
  executeRedis
} from './client.js';

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

  return {
    status: metrics.connected ? 'healthy' : (CONFIG.REDIS.enabled ? 'degraded' : 'disabled'),
    connected: metrics.connected,
    enabled: CONFIG.REDIS.enabled,
    uptimeMs: metrics.uptime,
    lastHealthCheck: metrics.lastHealthCheck,
    errorCount: metrics.commandErrors,
    reconnections: metrics.reconnections
  };
}

/**
 * Create a namespaced key
 * @param {string} namespace - Key namespace (session, cache, checkpoint, dspy)
 * @param {string} key - Key suffix
 * @returns {string} Full namespaced key
 */
export function createRedisKey(namespace, key) {
  const prefix = CONFIG.REDIS.keyPrefixes[namespace];
  if (!prefix) {
    throw new Error(`Unknown Redis namespace: ${namespace}`);
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
    throw new Error(`Unknown Redis namespace: ${namespace}`);
  }
  return ttl;
}
```

---

## Phase 4: Update Session Storage Integration

### Objective
Refactor sessionStorage.js to use the shared Redis client.

### Implementation

```javascript
// server/storage/sessionStorage.js - Updated RedisStorage class

import { getRedisClient, isRedisHealthy } from '../redis/client.js';
import { CONFIG } from '../config.js';

// ... keep existing imports and MemoryStorage class ...

/**
 * Redis storage implementation
 * Updated to use shared Redis client from factory
 */
class RedisStorage {
  constructor() {
    this.client = null;
    this.type = 'redis';
    this._connected = false;
  }

  async connect() {
    // Get shared client from factory
    this.client = await getRedisClient();
    this._connected = this.client !== null;

    if (this._connected) {
      console.log('[Storage] Using shared Redis client');
    }

    return this._connected;
  }

  _key(key) {
    return CONFIG.REDIS.keyPrefixes.session + key;
  }

  async get(key) {
    if (!this._connected) return null;

    try {
      const raw = await this.client.get(this._key(key));
      if (!raw) return null;

      const entry = JSON.parse(raw);
      return maybeDecompress(entry.data, entry.compressed);
    } catch (error) {
      if (error.message.includes('decompress') || error.message.includes('JSON')) {
        console.error(`[Storage] CRITICAL: Corrupted session data for key ${key}: ${error.message}`);
        try {
          await this.client.del(this._key(key));
        } catch {}
      } else {
        console.error(`[Storage] Redis get error for ${key}: ${error.message}`);
      }
      return null;
    }
  }

  async set(key, value, ttlMs = CONFIG.REDIS.ttl.session * 1000) {
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

  // ... rest of methods remain largely the same but use this.client ...

  isHealthy() {
    return this._connected && isRedisHealthy();
  }

  async destroy() {
    // Don't disconnect - client is shared
    // Just clear local reference
    this.client = null;
    this._connected = false;
  }
}

// Update StorageManager to use shared initialization
class StorageManager {
  // ... existing code ...

  async _doInitialize() {
    if (CONFIG.REDIS.enabled) {
      const redis = new RedisStorage();
      const connected = await redis.connect();

      if (connected) {
        this.primary = redis;
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
}
```

---

## Phase 5: Health Check Endpoint

### Objective
Add Redis health check to server routes.

### Implementation

```javascript
// server/routes/health.js - Add Redis health endpoint

import express from 'express';
import { getRedisStatus, getRedisMetrics } from '../redis/index.js';

const router = express.Router();

// Existing health checks...

/**
 * GET /health/redis
 * Redis-specific health check with metrics
 */
router.get('/redis', async (req, res) => {
  const status = getRedisStatus();
  const metrics = getRedisMetrics();

  const httpStatus = status.status === 'healthy' ? 200 :
                     status.status === 'degraded' ? 503 : 200;

  res.status(httpStatus).json({
    status: status.status,
    timestamp: new Date().toISOString(),
    redis: {
      connected: status.connected,
      enabled: status.enabled,
      uptimeSeconds: Math.floor(status.uptimeMs / 1000),
      lastHealthCheck: status.lastHealthCheck
    },
    metrics: {
      connectionAttempts: metrics.connectionAttempts,
      reconnections: metrics.reconnections,
      commandsExecuted: metrics.commandsExecuted,
      commandErrors: metrics.commandErrors,
      errorRate: metrics.commandsExecuted > 0
        ? (metrics.commandErrors / metrics.commandsExecuted * 100).toFixed(2) + '%'
        : '0%'
    },
    lastError: metrics.lastError ? {
      message: metrics.lastError,
      time: metrics.lastErrorTime ? new Date(metrics.lastErrorTime).toISOString() : null
    } : null
  });
});

/**
 * GET /health
 * Include Redis in overall health summary
 */
router.get('/', async (req, res) => {
  const redisStatus = getRedisStatus();

  const overall = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      server: 'healthy',
      redis: redisStatus.status
    }
  };

  // Degrade overall if Redis is degraded (not disabled)
  if (redisStatus.status === 'degraded') {
    overall.status = 'degraded';
    overall.message = 'Redis unavailable, running in fallback mode';
  }

  res.status(overall.status === 'healthy' ? 200 : 503).json(overall);
});

export default router;
```

---

## Phase 6: Server Startup Integration

### Objective
Integrate Redis initialization into server startup.

### Implementation

```javascript
// server/index.js - Add Redis initialization

import express from 'express';
import { initializeRedis, getRedisStatus } from './redis/index.js';
import healthRouter from './routes/health.js';

const app = express();

// ... existing middleware setup ...

// Register routes
app.use('/health', healthRouter);

/**
 * Server startup with Redis initialization
 */
async function startServer() {
  // Initialize Redis (non-blocking)
  const redisConnected = await initializeRedis();

  if (redisConnected) {
    console.log('✓ Redis connected');
  } else if (process.env.REDIS_URL) {
    console.warn('⚠ Redis configured but unavailable - using fallback mode');
  } else {
    console.log('ℹ Redis not configured - using in-memory storage');
  }

  // Start HTTP server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Redis status: ${getRedisStatus().status}`);
  });
}

startServer().catch(console.error);
```

---

## Success Criteria

1. **Singleton Pattern**: Only one Redis connection exists regardless of consumers
2. **Graceful Fallback**: System operates normally when Redis unavailable
3. **Auto-Reconnect**: Connection recovers automatically after network issues
4. **Health Monitoring**: `/health/redis` returns accurate status within 1s
5. **Metrics Tracking**: Connection stats accurately reflect actual operations
6. **Clean Shutdown**: No connection leaks on SIGTERM/SIGINT
7. **Configuration**: All Redis settings centralized in `config.js`

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `server/config.js` | Modify | Add REDIS configuration section |
| `server/redis/client.js` | Create | Redis client factory |
| `server/redis/index.js` | Create | Unified exports and helpers |
| `server/storage/sessionStorage.js` | Modify | Use shared client |
| `server/routes/health.js` | Modify | Add Redis health endpoint |
| `server/index.js` | Modify | Initialize Redis on startup |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `null` | Redis connection URL (e.g., `redis://localhost:6379`) |
| `REDIS_TLS` | No | `false` | Enable TLS for Redis connections |
| `REDIS_CONNECT_TIMEOUT` | No | `5000` | Connection timeout in milliseconds |
| `REDIS_COMMAND_TIMEOUT` | No | `2000` | Command timeout in milliseconds |
| `REDIS_MAX_RETRIES` | No | `3` | Maximum connection retry attempts |

---

## Testing Checklist

- [ ] Client returns null when REDIS_URL not configured
- [ ] Client connects successfully with valid REDIS_URL
- [ ] Retry logic works with exponential backoff
- [ ] Same client instance returned on multiple calls
- [ ] Health check reports accurate status
- [ ] Metrics track commands and errors correctly
- [ ] Graceful shutdown closes connection cleanly
- [ ] Session storage works with shared client
- [ ] Fallback to memory works when Redis fails

---

## Estimated Complexity

- Phase 1: Low (configuration)
- Phase 2: High (client factory with event handling)
- Phase 3: Low (exports and helpers)
- Phase 4: Medium (integration with existing code)
- Phase 5: Low (health endpoint)
- Phase 6: Low (startup integration)

**Total**: Medium-High complexity, ~2-3 days implementation
