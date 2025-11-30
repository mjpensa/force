/**
 * Redis Streams Manager for Event Logging
 *
 * Gap 05: Provides append-only event logging for training system auditing.
 *
 * Features:
 * - Add events to typed streams
 * - Read events with filtering
 * - Query events by time range
 * - Stream info and statistics
 * - Automatic stream trimming
 *
 * Usage:
 *   import { eventStream, logTrainingEvent } from './event-stream.js';
 *
 *   await logTrainingEvent({ event: 'started', sessionId: '123' });
 *   const events = await eventStream.readEvents('training', { count: 100 });
 */

import { getRedisClient } from './client.js';

const STREAM_KEYS = {
  training: 'force:stream:training',
  generation: 'force:stream:generation',
  evolution: 'force:stream:evolution',
  errors: 'force:stream:errors'
};

const MAX_STREAM_LENGTH = 10000; // Keep last 10k events per stream

/**
 * Redis Streams Manager for Event Logging
 */
export class EventStreamManager {
  constructor() {
    this.client = null;
  }

  async _getClient() {
    if (!this.client) {
      this.client = await getRedisClient();
    }
    return this.client;
  }

  /**
   * Get stream key for a type
   *
   * @param {string} streamType - Stream type
   * @returns {string} Redis key
   */
  _getStreamKey(streamType) {
    return STREAM_KEYS[streamType] || `force:stream:${streamType}`;
  }

  /**
   * Add event to stream
   *
   * @param {string} streamType - Stream type (training, generation, evolution, errors)
   * @param {Object} event - Event data
   * @returns {Promise<string|null>} Event ID or null if failed
   */
  async addEvent(streamType, event) {
    const client = await this._getClient();
    if (!client) return null;

    const streamKey = this._getStreamKey(streamType);

    try {
      // Flatten event for Redis stream (no nested objects allowed)
      const flatEvent = this._flattenEvent({
        ...event,
        timestamp: Date.now(),
        type: streamType
      });

      // Add to stream with auto-generated ID and trim
      const eventId = await client.xadd(
        streamKey,
        'MAXLEN', '~', MAX_STREAM_LENGTH, // Approximate trim for performance
        '*', // Auto-generate ID
        ...flatEvent
      );

      return eventId;

    } catch (error) {
      console.error(`[EventStream] Error adding event to ${streamType}:`, error.message);
      return null;
    }
  }

  /**
   * Read events from stream
   *
   * @param {string} streamType - Stream type
   * @param {Object} options - Query options
   * @param {string} options.start - Start ID (default: beginning '-')
   * @param {string} options.end - End ID (default: end '+')
   * @param {number} options.count - Max events to return
   * @param {boolean} options.reverse - Newest first (default: false)
   * @returns {Promise<Array>} Events
   */
  async readEvents(streamType, options = {}) {
    const client = await this._getClient();
    if (!client) return [];

    const {
      start = '-',
      end = '+',
      count = 100,
      reverse = false
    } = options;

    const streamKey = this._getStreamKey(streamType);

    try {
      let events;
      if (reverse) {
        events = await client.xrevrange(streamKey, end, start, 'COUNT', count);
      } else {
        events = await client.xrange(streamKey, start, end, 'COUNT', count);
      }

      // Parse events
      return events.map(([id, fields]) => ({
        id,
        ...this._parseFields(fields)
      }));

    } catch (error) {
      console.error(`[EventStream] Error reading ${streamType}:`, error.message);
      return [];
    }
  }

  /**
   * Read events since a timestamp
   *
   * @param {string} streamType - Stream type
   * @param {number} sinceMs - Milliseconds since epoch
   * @param {number} count - Max events to return
   * @returns {Promise<Array>} Events
   */
  async readEventsSince(streamType, sinceMs, count = 100) {
    return this.readEvents(streamType, {
      start: `${sinceMs}-0`,
      count
    });
  }

  /**
   * Read events in a time range
   *
   * @param {string} streamType - Stream type
   * @param {number} startMs - Start timestamp (ms)
   * @param {number} endMs - End timestamp (ms)
   * @param {number} count - Max events
   * @returns {Promise<Array>} Events
   */
  async readEventsInRange(streamType, startMs, endMs, count = 100) {
    return this.readEvents(streamType, {
      start: `${startMs}-0`,
      end: `${endMs}-99999`,
      count
    });
  }

  /**
   * Get latest N events from stream
   *
   * @param {string} streamType - Stream type
   * @param {number} count - Number of events
   * @returns {Promise<Array>} Events (newest first)
   */
  async getLatestEvents(streamType, count = 10) {
    return this.readEvents(streamType, {
      count,
      reverse: true
    });
  }

  /**
   * Get event count for stream
   *
   * @param {string} streamType - Stream type
   * @returns {Promise<number>} Event count
   */
  async getEventCount(streamType) {
    const client = await this._getClient();
    if (!client) return 0;

    const streamKey = this._getStreamKey(streamType);

    try {
      return await client.xlen(streamKey);
    } catch (error) {
      console.error(`[EventStream] Error getting count for ${streamType}:`, error.message);
      return 0;
    }
  }

  /**
   * Get stream information
   *
   * @param {string} streamType - Stream type
   * @returns {Promise<Object|null>} Stream info
   */
  async getStreamInfo(streamType) {
    const client = await this._getClient();
    if (!client) return null;

    const streamKey = this._getStreamKey(streamType);

    try {
      const info = await client.xinfo('STREAM', streamKey);

      // Parse XINFO response (alternating key-value pairs)
      const infoObj = {};
      for (let i = 0; i < info.length; i += 2) {
        infoObj[info[i]] = info[i + 1];
      }

      return {
        length: infoObj.length,
        firstEntry: infoObj['first-entry']?.[0] || null,
        lastEntry: infoObj['last-entry']?.[0] || null,
        radixTreeKeys: infoObj['radix-tree-keys'],
        radixTreeNodes: infoObj['radix-tree-nodes']
      };

    } catch (error) {
      // Stream may not exist yet
      if (error.message.includes('no such key')) {
        return {
          length: 0,
          firstEntry: null,
          lastEntry: null,
          radixTreeKeys: 0,
          radixTreeNodes: 0
        };
      }
      console.error(`[EventStream] Error getting info for ${streamType}:`, error.message);
      return null;
    }
  }

  /**
   * Get summary of all streams
   *
   * @returns {Promise<Object>} Stream summaries
   */
  async getAllStreamInfo() {
    const summaries = {};

    for (const streamType of Object.keys(STREAM_KEYS)) {
      summaries[streamType] = await this.getStreamInfo(streamType);
    }

    return summaries;
  }

  /**
   * Delete old events
   *
   * @param {string} streamType - Stream type
   * @param {number} olderThanMs - Delete events older than this (ms ago)
   * @returns {Promise<number>} Number of deleted events
   */
  async trimOldEvents(streamType, olderThanMs) {
    const client = await this._getClient();
    if (!client) return 0;

    const streamKey = this._getStreamKey(streamType);
    const cutoffId = `${Date.now() - olderThanMs}-0`;

    try {
      // XTRIM with MINID trims entries with IDs lower than specified
      return await client.xtrim(streamKey, 'MINID', cutoffId);
    } catch (error) {
      console.error(`[EventStream] Error trimming ${streamType}:`, error.message);
      return 0;
    }
  }

  /**
   * Clear all events in a stream
   *
   * @param {string} streamType - Stream type
   * @returns {Promise<boolean>} Success
   */
  async clearStream(streamType) {
    const client = await this._getClient();
    if (!client) return false;

    const streamKey = this._getStreamKey(streamType);

    try {
      await client.del(streamKey);
      console.log(`[EventStream] Cleared ${streamType} stream`);
      return true;
    } catch (error) {
      console.error(`[EventStream] Error clearing ${streamType}:`, error.message);
      return false;
    }
  }

  /**
   * Flatten nested event object for Redis stream storage
   * Redis streams only support flat key-value pairs
   *
   * @param {Object} event - Event object
   * @param {string} prefix - Key prefix for nested objects
   * @returns {Array} Flat key-value array
   */
  _flattenEvent(event, prefix = '') {
    const result = [];

    for (const [key, value] of Object.entries(event)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Recursively flatten nested objects
        result.push(...this._flattenEvent(value, fullKey));
      } else if (Array.isArray(value)) {
        // Arrays stored as JSON
        result.push(fullKey, JSON.stringify(value));
      } else if (value instanceof Date) {
        result.push(fullKey, value.toISOString());
      } else if (typeof value === 'boolean') {
        result.push(fullKey, value ? '1' : '0');
      } else {
        result.push(fullKey, String(value));
      }
    }

    return result;
  }

  /**
   * Parse Redis stream fields back to object
   *
   * @param {Array} fields - Field array from Redis
   * @returns {Object} Parsed object
   */
  _parseFields(fields) {
    const result = {};

    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      let value = fields[i + 1];

      // Try to parse JSON arrays/objects
      if (value && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string
        }
      }

      // Parse booleans
      if (value === '1' || value === '0') {
        // Check if this looks like a boolean field
        if (key.startsWith('is') || key.startsWith('has') || key.includes('success') || key.includes('enabled')) {
          value = value === '1';
        }
      }

      // Handle nested keys (e.g., "data.field" -> { data: { field: value } })
      const parts = key.split('.');
      let current = result;

      for (let j = 0; j < parts.length - 1; j++) {
        if (!current[parts[j]]) {
          current[parts[j]] = {};
        }
        current = current[parts[j]];
      }

      current[parts[parts.length - 1]] = value;
    }

    return result;
  }
}

// Singleton instance
export const eventStream = new EventStreamManager();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Log a training event
 *
 * @param {Object} event - Event data
 * @returns {Promise<string|null>} Event ID
 */
export async function logTrainingEvent(event) {
  return eventStream.addEvent('training', event);
}

/**
 * Log a generation event
 *
 * @param {Object} event - Event data
 * @returns {Promise<string|null>} Event ID
 */
export async function logGenerationEvent(event) {
  return eventStream.addEvent('generation', event);
}

/**
 * Log an evolution event
 *
 * @param {Object} event - Event data
 * @returns {Promise<string|null>} Event ID
 */
export async function logEvolutionEvent(event) {
  return eventStream.addEvent('evolution', event);
}

/**
 * Log an error event
 *
 * @param {Object} event - Event data
 * @returns {Promise<string|null>} Event ID
 */
export async function logErrorEvent(event) {
  return eventStream.addEvent('errors', event);
}

// Export stream keys for reference
export { STREAM_KEYS };

export default EventStreamManager;
