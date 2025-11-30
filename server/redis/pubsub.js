/**
 * Redis Pub/Sub Manager
 *
 * Gap 05: Enables cross-instance cache invalidation and event broadcasting.
 *
 * Features:
 * - Subscribe to channels with handlers
 * - Publish messages to channels
 * - Cache invalidation broadcast
 * - Training event notifications
 *
 * Usage:
 *   import { pubsub, publishCacheInvalidation } from './pubsub.js';
 *
 *   await pubsub.subscribe('channel', handler);
 *   await pubsub.publish('channel', { data: 'value' });
 *   await publishCacheInvalidation('roadmap');
 */

import { getRedisClient } from './client.js';

const CHANNELS = {
  cacheInvalidate: 'force:cache:invalidate',
  trainingEvents: 'force:training:events',
  systemNotifications: 'force:system:notifications'
};

/**
 * Redis Pub/Sub Manager
 */
export class PubSubManager {
  constructor() {
    this.publisher = null;
    this.subscriber = null;
    this.handlers = new Map();
    this.isInitialized = false;
    this.instanceId = process.env.INSTANCE_ID || `instance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Initialize pub/sub connections
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      const client = await getRedisClient();
      if (!client) {
        console.warn('[PubSub] Redis not available, pub/sub disabled');
        return false;
      }

      // Publisher uses the main client
      this.publisher = client;

      // Subscriber needs a duplicate connection
      this.subscriber = client.duplicate();
      await this.subscriber.connect();

      // Set up message handler
      this.subscriber.on('message', (channel, message) => {
        this._handleMessage(channel, message);
      });

      this.isInitialized = true;
      console.log(`[PubSub] Initialized (instance: ${this.instanceId.slice(0, 12)}...)`);
      return true;

    } catch (error) {
      console.error('[PubSub] Initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Subscribe to a channel
   *
   * @param {string} channel - Channel name
   * @param {Function} handler - Message handler function(message, channel)
   * @returns {Promise<boolean>} Success status
   */
  async subscribe(channel, handler) {
    if (!this.isInitialized) {
      const success = await this.initialize();
      if (!success) return false;
    }
    if (!this.subscriber) return false;

    try {
      if (!this.handlers.has(channel)) {
        this.handlers.set(channel, new Set());
        await this.subscriber.subscribe(channel);
        console.log(`[PubSub] Subscribed to: ${channel}`);
      }

      this.handlers.get(channel).add(handler);
      return true;

    } catch (error) {
      console.error(`[PubSub] Subscribe error for ${channel}:`, error.message);
      return false;
    }
  }

  /**
   * Unsubscribe from a channel
   *
   * @param {string} channel - Channel name
   * @param {Function} handler - Handler to remove (optional, removes all if not specified)
   * @returns {Promise<boolean>} Success status
   */
  async unsubscribe(channel, handler = null) {
    if (!this.handlers.has(channel)) return true;

    try {
      if (handler) {
        const handlers = this.handlers.get(channel);
        handlers.delete(handler);

        if (handlers.size === 0) {
          this.handlers.delete(channel);
          if (this.subscriber) {
            await this.subscriber.unsubscribe(channel);
          }
        }
      } else {
        // Remove all handlers for channel
        this.handlers.delete(channel);
        if (this.subscriber) {
          await this.subscriber.unsubscribe(channel);
        }
      }

      return true;

    } catch (error) {
      console.error(`[PubSub] Unsubscribe error for ${channel}:`, error.message);
      return false;
    }
  }

  /**
   * Publish a message to a channel
   *
   * @param {string} channel - Channel name
   * @param {Object} message - Message to publish
   * @returns {Promise<number>} Number of subscribers that received the message
   */
  async publish(channel, message) {
    if (!this.isInitialized) {
      const success = await this.initialize();
      if (!success) return 0;
    }
    if (!this.publisher) return 0;

    try {
      const payload = JSON.stringify({
        ...message,
        timestamp: Date.now(),
        source: this.instanceId
      });

      const receiverCount = await this.publisher.publish(channel, payload);
      return receiverCount;

    } catch (error) {
      console.error(`[PubSub] Publish error for ${channel}:`, error.message);
      return 0;
    }
  }

  /**
   * Handle incoming message
   *
   * @param {string} channel - Channel the message came from
   * @param {string} message - Raw message string
   */
  _handleMessage(channel, message) {
    const handlers = this.handlers.get(channel);
    if (!handlers || handlers.size === 0) return;

    try {
      const parsed = JSON.parse(message);

      // Skip messages from self to avoid loops
      if (parsed.source === this.instanceId) {
        return;
      }

      // Call all handlers for this channel
      for (const handler of handlers) {
        try {
          handler(parsed, channel);
        } catch (handlerError) {
          console.error(`[PubSub] Handler error on ${channel}:`, handlerError.message);
        }
      }

    } catch (error) {
      console.error('[PubSub] Error parsing message:', error.message);
    }
  }

  /**
   * Get list of subscribed channels
   *
   * @returns {Array<string>} Channel names
   */
  getSubscribedChannels() {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handler count for a channel
   *
   * @param {string} channel - Channel name
   * @returns {number} Number of handlers
   */
  getHandlerCount(channel) {
    const handlers = this.handlers.get(channel);
    return handlers ? handlers.size : 0;
  }

  /**
   * Check if connected and ready
   *
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.isInitialized && this.publisher !== null && this.subscriber !== null;
  }

  /**
   * Shutdown pub/sub connections
   */
  async shutdown() {
    try {
      if (this.subscriber) {
        // Unsubscribe from all channels
        for (const channel of this.handlers.keys()) {
          await this.subscriber.unsubscribe(channel);
        }
        await this.subscriber.quit();
        this.subscriber = null;
      }

      this.handlers.clear();
      this.isInitialized = false;
      console.log('[PubSub] Shutdown complete');

    } catch (error) {
      console.error('[PubSub] Shutdown error:', error.message);
    }
  }
}

// Singleton instance
export const pubsub = new PubSubManager();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Publish cache invalidation event
 *
 * @param {string} signatureType - Content type being invalidated (or null for all)
 * @param {string} key - Specific key (optional)
 */
export async function publishCacheInvalidation(signatureType = null, key = null) {
  await pubsub.publish(CHANNELS.cacheInvalidate, {
    event: 'invalidate',
    signatureType,
    key
  });
}

/**
 * Subscribe to cache invalidation events
 *
 * @param {Function} handler - Handler function(message)
 * @returns {Promise<boolean>} Success status
 */
export async function subscribeToCacheInvalidation(handler) {
  return pubsub.subscribe(CHANNELS.cacheInvalidate, handler);
}

/**
 * Publish training event
 *
 * @param {string} event - Event type (started, completed, error, etc.)
 * @param {Object} data - Event data
 */
export async function publishTrainingEvent(event, data = {}) {
  await pubsub.publish(CHANNELS.trainingEvents, {
    event,
    data
  });
}

/**
 * Subscribe to training events
 *
 * @param {Function} handler - Handler function(message)
 * @returns {Promise<boolean>} Success status
 */
export async function subscribeToTrainingEvents(handler) {
  return pubsub.subscribe(CHANNELS.trainingEvents, handler);
}

/**
 * Publish system notification
 *
 * @param {string} type - Notification type
 * @param {Object} payload - Notification payload
 */
export async function publishSystemNotification(type, payload = {}) {
  await pubsub.publish(CHANNELS.systemNotifications, {
    type,
    payload
  });
}

/**
 * Subscribe to system notifications
 *
 * @param {Function} handler - Handler function(message)
 * @returns {Promise<boolean>} Success status
 */
export async function subscribeToSystemNotifications(handler) {
  return pubsub.subscribe(CHANNELS.systemNotifications, handler);
}

// Export channels for external use
export { CHANNELS };

export default PubSubManager;
