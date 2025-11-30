/**
 * Redis Client Factory
 *
 * Plan 08: Redis Client Factory Implementation
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

import { CONFIG } from '../config.js';

/**
 * RedisClientFactory - Singleton pattern for shared Redis connection
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
    // Register shutdown handlers
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

        // Reconnect on specific errors
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

      // Verify connection with ping
      await this.#client.ping();

      // Start health check interval if enabled
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
   * @private
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
          console.error('[Redis] Multiple health check failures, marking as disconnected');
          this.#isConnected = false;
        }
      }
    }, CONFIG.REDIS.features.healthCheckInterval);
  }

  /**
   * Handle process shutdown
   * @private
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

  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this.#metrics = {
      connectionAttempts: 0,
      reconnections: 0,
      commandsExecuted: 0,
      commandErrors: 0,
      lastError: null,
      lastErrorTime: null,
      connectedAt: this.#metrics.connectedAt,
      lastHealthCheck: null,
      healthCheckFailures: 0
    };
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
export const resetRedisMetrics = () => factory.resetMetrics();

// Export factory for testing
export { factory as redisFactory };

export default factory;
