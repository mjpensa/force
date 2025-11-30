# Training Integration Gap 5: Redis Advanced Features

## Executive Summary

**Gap**: The Redis integration uses only basic string operations (~5% of Redis capabilities). Advanced data structures and features like Sorted Sets, Pub/Sub, Streams, Hashes, and Lua scripting are not utilized.

**Impact**:
- No cross-instance cache invalidation (Pub/Sub)
- No audit trail for training events (Streams)
- No variant performance ranking (Sorted Sets)
- Inefficient metadata access (Hashes)
- Non-atomic multi-step operations (Lua)

**Effort**: Medium (8-12 hours)
**Priority**: Low-Medium - Performance and observability enhancements

---

## Current State Analysis

### Redis Commands Currently Used

| Command | Usage | File |
|---------|-------|------|
| `GET` | Retrieve cache/checkpoint | dspy-cache.js, checkpointer.js |
| `SET` | Store values | All Redis files |
| `SETEX` | Set with TTL | dspy-cache.js, checkpointer.js |
| `DEL` | Delete keys | dspy-cache.js, checkpointer.js |
| `EXISTS` | Check key existence | dspy-cache.js |
| `KEYS` | Pattern matching | dspy-cache.js |
| `PIPELINE` | Batch operations | checkpointer.js |
| `PING` | Health check | client.js |

**Total**: ~8 commands out of 200+ available

### What's Missing

| Feature | Purpose | Potential Use |
|---------|---------|---------------|
| **Sorted Sets** | Ordered data with scores | Variant performance ranking |
| **Pub/Sub** | Message broadcasting | Cache invalidation |
| **Streams** | Append-only log | Training event audit |
| **Hashes** | Field-value pairs | Metadata storage |
| **Lua Scripts** | Atomic operations | Complex updates |
| **HyperLogLog** | Cardinality estimation | Unique user tracking |
| **Transactions** | WATCH/MULTI/EXEC | Optimistic locking |

---

## Implementation Plan

### Feature 1: Sorted Sets for Variant Performance

**Purpose**: Track and rank prompt variants by performance score

**Step 1.1: Create variant metrics module**

```javascript
// server/redis/variant-metrics.js

import { getRedisClient } from './client.js';
import { CONFIG } from '../config.js';

const VARIANT_KEYS = {
  scores: 'force:variants:scores',           // Total score
  counts: 'force:variants:counts',           // Sample count
  avgScores: 'force:variants:avg',           // Average score
  recentScores: 'force:variants:recent',     // Recent performance
  byType: (type) => `force:variants:type:${type}`  // Per content type
};

/**
 * Variant Performance Tracker using Redis Sorted Sets
 */
export class VariantMetricsTracker {
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
   * Record a variant performance score
   *
   * @param {string} variantId - Variant identifier
   * @param {number} score - Quality score (0-5)
   * @param {string} contentType - Content type
   */
  async recordScore(variantId, score, contentType = null) {
    const client = await this._getClient();
    if (!client) return;

    const pipeline = client.pipeline();

    // Increment total score
    pipeline.zincrby(VARIANT_KEYS.scores, score, variantId);

    // Increment count
    pipeline.zincrby(VARIANT_KEYS.counts, 1, variantId);

    // Track by content type if provided
    if (contentType) {
      pipeline.zincrby(VARIANT_KEYS.byType(contentType), score, variantId);
    }

    // Add to recent scores (time-based sorted set)
    const timestamp = Date.now();
    pipeline.zadd(VARIANT_KEYS.recentScores, timestamp, `${variantId}:${timestamp}:${score}`);

    // Trim recent scores to last 1000 entries
    pipeline.zremrangebyrank(VARIANT_KEYS.recentScores, 0, -1001);

    await pipeline.exec();
  }

  /**
   * Get top performing variants
   *
   * @param {number} limit - Number of variants to return
   * @param {string} contentType - Filter by content type (optional)
   * @returns {Promise<Array>} Top variants with scores
   */
  async getTopVariants(limit = 10, contentType = null) {
    const client = await this._getClient();
    if (!client) return [];

    const key = contentType ? VARIANT_KEYS.byType(contentType) : VARIANT_KEYS.scores;

    // Get top variants by score
    const results = await client.zrevrange(key, 0, limit - 1, 'WITHSCORES');

    // Pair up results (zrevrange returns [member, score, member, score, ...])
    const variants = [];
    for (let i = 0; i < results.length; i += 2) {
      const variantId = results[i];
      const totalScore = parseFloat(results[i + 1]);

      // Get count to calculate average
      const count = await client.zscore(VARIANT_KEYS.counts, variantId);

      variants.push({
        variantId,
        totalScore,
        count: parseInt(count) || 0,
        avgScore: count ? (totalScore / parseInt(count)).toFixed(2) : 0
      });
    }

    return variants;
  }

  /**
   * Get worst performing variants (candidates for retirement)
   *
   * @param {number} limit - Number of variants to return
   * @param {number} minSamples - Minimum samples required
   * @returns {Promise<Array>} Bottom variants
   */
  async getUnderperformers(limit = 10, minSamples = 10) {
    const client = await this._getClient();
    if (!client) return [];

    // Get all variants with counts
    const allVariants = await this.getTopVariants(100);

    // Filter by minimum samples and sort by average
    return allVariants
      .filter(v => v.count >= minSamples)
      .sort((a, b) => parseFloat(a.avgScore) - parseFloat(b.avgScore))
      .slice(0, limit);
  }

  /**
   * Get recent performance trend for a variant
   *
   * @param {string} variantId - Variant to analyze
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Promise<Object>} Trend analysis
   */
  async getRecentTrend(variantId, windowMs = 3600000) {
    const client = await this._getClient();
    if (!client) return null;

    const now = Date.now();
    const windowStart = now - windowMs;

    // Get recent scores for this variant
    const recentAll = await client.zrangebyscore(
      VARIANT_KEYS.recentScores,
      windowStart,
      now
    );

    // Filter for this variant
    const variantScores = recentAll
      .filter(entry => entry.startsWith(`${variantId}:`))
      .map(entry => {
        const parts = entry.split(':');
        return {
          timestamp: parseInt(parts[1]),
          score: parseFloat(parts[2])
        };
      });

    if (variantScores.length < 2) {
      return { trend: 'insufficient_data', samples: variantScores.length };
    }

    // Calculate trend
    const avgScore = variantScores.reduce((sum, s) => sum + s.score, 0) / variantScores.length;
    const firstHalf = variantScores.slice(0, Math.floor(variantScores.length / 2));
    const secondHalf = variantScores.slice(Math.floor(variantScores.length / 2));

    const firstAvg = firstHalf.reduce((sum, s) => sum + s.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.score, 0) / secondHalf.length;

    const trendDirection = secondAvg > firstAvg ? 'improving' :
                          secondAvg < firstAvg ? 'declining' : 'stable';

    return {
      variantId,
      samples: variantScores.length,
      avgScore: avgScore.toFixed(2),
      trend: trendDirection,
      change: ((secondAvg - firstAvg) / firstAvg * 100).toFixed(1) + '%'
    };
  }

  /**
   * Get performance comparison between variants
   *
   * @param {string} variantA - First variant
   * @param {string} variantB - Second variant
   * @returns {Promise<Object>} Comparison result
   */
  async compareVariants(variantA, variantB) {
    const client = await this._getClient();
    if (!client) return null;

    const [scoreA, countA, scoreB, countB] = await Promise.all([
      client.zscore(VARIANT_KEYS.scores, variantA),
      client.zscore(VARIANT_KEYS.counts, variantA),
      client.zscore(VARIANT_KEYS.scores, variantB),
      client.zscore(VARIANT_KEYS.counts, variantB)
    ]);

    const avgA = countA ? (parseFloat(scoreA) / parseInt(countA)) : 0;
    const avgB = countB ? (parseFloat(scoreB) / parseInt(countB)) : 0;

    return {
      variantA: {
        id: variantA,
        totalScore: parseFloat(scoreA) || 0,
        count: parseInt(countA) || 0,
        avgScore: avgA.toFixed(2)
      },
      variantB: {
        id: variantB,
        totalScore: parseFloat(scoreB) || 0,
        count: parseInt(countB) || 0,
        avgScore: avgB.toFixed(2)
      },
      winner: avgA > avgB ? variantA : avgB > avgA ? variantB : 'tie',
      difference: Math.abs(avgA - avgB).toFixed(2),
      percentDiff: avgB ? (((avgA - avgB) / avgB) * 100).toFixed(1) + '%' : 'N/A'
    };
  }
}

export const variantMetrics = new VariantMetricsTracker();
```

**Step 1.2: Integrate with training loop**

```javascript
// In server/routes/training.js

import { variantMetrics } from '../redis/variant-metrics.js';

// After scoring a generation
await variantMetrics.recordScore(variantId, qualityScore, contentType);
```

**Step 1.3: Add API endpoints**

```javascript
// server/routes/variant-metrics.js

import express from 'express';
import { variantMetrics } from '../redis/variant-metrics.js';

const router = express.Router();

router.get('/top', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const contentType = req.query.contentType;

  const top = await variantMetrics.getTopVariants(limit, contentType);
  res.json({ variants: top });
});

router.get('/underperformers', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const minSamples = parseInt(req.query.minSamples) || 10;

  const bottom = await variantMetrics.getUnderperformers(limit, minSamples);
  res.json({ variants: bottom });
});

router.get('/trend/:variantId', async (req, res) => {
  const { variantId } = req.params;
  const windowHours = parseInt(req.query.hours) || 1;

  const trend = await variantMetrics.getRecentTrend(variantId, windowHours * 3600000);
  res.json(trend);
});

router.get('/compare', async (req, res) => {
  const { a, b } = req.query;

  if (!a || !b) {
    return res.status(400).json({ error: 'Provide variants a and b' });
  }

  const comparison = await variantMetrics.compareVariants(a, b);
  res.json(comparison);
});

export default router;
```

---

### Feature 2: Pub/Sub for Cache Invalidation

**Purpose**: Broadcast cache invalidation across multiple server instances

**Step 2.1: Create Pub/Sub manager**

```javascript
// server/redis/pubsub.js

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
  }

  async initialize() {
    if (this.isInitialized) return;

    const client = await getRedisClient();
    if (!client) {
      console.warn('[PubSub] Redis not available, pub/sub disabled');
      return;
    }

    // Create separate connections for pub and sub
    this.publisher = client;
    this.subscriber = client.duplicate();

    await this.subscriber.connect();

    // Set up message handler
    this.subscriber.on('message', (channel, message) => {
      this._handleMessage(channel, message);
    });

    this.isInitialized = true;
    console.log('[PubSub] Initialized');
  }

  /**
   * Subscribe to a channel
   *
   * @param {string} channel - Channel name
   * @param {Function} handler - Message handler
   */
  async subscribe(channel, handler) {
    if (!this.isInitialized) await this.initialize();
    if (!this.subscriber) return;

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }

    this.handlers.get(channel).add(handler);
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel, handler) {
    if (!this.handlers.has(channel)) return;

    const handlers = this.handlers.get(channel);
    handlers.delete(handler);

    if (handlers.size === 0) {
      this.handlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  /**
   * Publish a message
   *
   * @param {string} channel - Channel name
   * @param {Object} message - Message to publish
   */
  async publish(channel, message) {
    if (!this.isInitialized) await this.initialize();
    if (!this.publisher) return;

    const payload = JSON.stringify({
      ...message,
      timestamp: Date.now(),
      source: process.env.INSTANCE_ID || 'default'
    });

    await this.publisher.publish(channel, payload);
  }

  /**
   * Handle incoming message
   */
  _handleMessage(channel, message) {
    const handlers = this.handlers.get(channel);
    if (!handlers) return;

    try {
      const parsed = JSON.parse(message);

      // Skip messages from self (optional)
      if (parsed.source === (process.env.INSTANCE_ID || 'default')) {
        return;
      }

      for (const handler of handlers) {
        handler(parsed, channel);
      }
    } catch (error) {
      console.error('[PubSub] Error handling message:', error);
    }
  }

  /**
   * Shutdown pub/sub connections
   */
  async shutdown() {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    this.isInitialized = false;
  }
}

export const pubsub = new PubSubManager();

// Convenience functions for cache invalidation
export async function publishCacheInvalidation(signatureType, key = null) {
  await pubsub.publish(CHANNELS.cacheInvalidate, {
    event: 'invalidate',
    signatureType,
    key
  });
}

export async function subscribeToCacheInvalidation(handler) {
  await pubsub.subscribe(CHANNELS.cacheInvalidate, handler);
}

// Training event publishing
export async function publishTrainingEvent(event, data) {
  await pubsub.publish(CHANNELS.trainingEvents, {
    event,
    data
  });
}

export async function subscribeToTrainingEvents(handler) {
  await pubsub.subscribe(CHANNELS.trainingEvents, handler);
}
```

**Step 2.2: Wire cache invalidation**

```javascript
// server/redis/dspy-cache.js - Add to DSPyCache class

import { publishCacheInvalidation, subscribeToCacheInvalidation } from './pubsub.js';

class DSPyCache {
  constructor() {
    // ... existing constructor ...

    // Subscribe to invalidation events from other instances
    this._setupInvalidationListener();
  }

  async _setupInvalidationListener() {
    await subscribeToCacheInvalidation((message) => {
      console.log(`[DSPyCache] Received invalidation event: ${message.signatureType}`);

      // Clear local metrics/state if needed
      if (message.key) {
        // Specific key invalidated
        this._localMetrics.invalidations++;
      } else {
        // Type-wide invalidation
        this._localMetrics.invalidations++;
      }
    });
  }

  async invalidate(signatureType = null, specificKey = null) {
    // ... existing invalidation logic ...

    // Broadcast to other instances
    await publishCacheInvalidation(signatureType, specificKey);

    return count;
  }
}
```

---

### Feature 3: Streams for Training Event Audit

**Purpose**: Create an append-only log of all training events for auditing and analytics

**Step 3.1: Create event stream manager**

```javascript
// server/redis/event-stream.js

import { getRedisClient } from './client.js';

const STREAM_KEYS = {
  training: 'force:stream:training',
  generation: 'force:stream:generation',
  evolution: 'force:stream:evolution',
  errors: 'force:stream:errors'
};

const MAX_STREAM_LENGTH = 10000;  // Keep last 10k events per stream

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
   * Add event to stream
   *
   * @param {string} streamType - Stream type (training, generation, evolution, errors)
   * @param {Object} event - Event data
   * @returns {Promise<string>} Event ID
   */
  async addEvent(streamType, event) {
    const client = await this._getClient();
    if (!client) return null;

    const streamKey = STREAM_KEYS[streamType] || `force:stream:${streamType}`;

    // Flatten event for Redis stream (no nested objects)
    const flatEvent = this._flattenEvent({
      ...event,
      timestamp: Date.now(),
      type: streamType
    });

    // Add to stream with auto-generated ID
    const eventId = await client.xadd(
      streamKey,
      'MAXLEN', '~', MAX_STREAM_LENGTH,  // Trim to approximate length
      '*',  // Auto-generate ID
      ...flatEvent
    );

    return eventId;
  }

  /**
   * Read events from stream
   *
   * @param {string} streamType - Stream type
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Events
   */
  async readEvents(streamType, options = {}) {
    const client = await this._getClient();
    if (!client) return [];

    const {
      start = '-',           // Start from beginning
      end = '+',             // Until end
      count = 100,           // Max events
      reverse = false        // Newest first
    } = options;

    const streamKey = STREAM_KEYS[streamType] || `force:stream:${streamType}`;

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
  }

  /**
   * Read events since a timestamp
   *
   * @param {string} streamType - Stream type
   * @param {number} sinceMs - Milliseconds since epoch
   * @param {number} count - Max events
   * @returns {Promise<Array>} Events
   */
  async readEventsSince(streamType, sinceMs, count = 100) {
    return this.readEvents(streamType, {
      start: `${sinceMs}-0`,
      count
    });
  }

  /**
   * Get event count for stream
   */
  async getEventCount(streamType) {
    const client = await this._getClient();
    if (!client) return 0;

    const streamKey = STREAM_KEYS[streamType] || `force:stream:${streamType}`;
    return client.xlen(streamKey);
  }

  /**
   * Get stream info
   */
  async getStreamInfo(streamType) {
    const client = await this._getClient();
    if (!client) return null;

    const streamKey = STREAM_KEYS[streamType] || `force:stream:${streamType}`;

    try {
      const info = await client.xinfo('STREAM', streamKey);

      // Parse XINFO response
      const infoObj = {};
      for (let i = 0; i < info.length; i += 2) {
        infoObj[info[i]] = info[i + 1];
      }

      return {
        length: infoObj.length,
        firstEntry: infoObj['first-entry']?.[0],
        lastEntry: infoObj['last-entry']?.[0],
        radixTreeKeys: infoObj['radix-tree-keys'],
        radixTreeNodes: infoObj['radix-tree-nodes']
      };
    } catch (error) {
      // Stream may not exist
      return null;
    }
  }

  /**
   * Delete old events
   *
   * @param {string} streamType - Stream type
   * @param {number} olderThanMs - Delete events older than this
   */
  async trimOldEvents(streamType, olderThanMs) {
    const client = await this._getClient();
    if (!client) return 0;

    const streamKey = STREAM_KEYS[streamType] || `force:stream:${streamType}`;
    const cutoffId = `${Date.now() - olderThanMs}-0`;

    // XTRIM with MINID
    return client.xtrim(streamKey, 'MINID', cutoffId);
  }

  /**
   * Flatten nested event object for Redis
   */
  _flattenEvent(event, prefix = '') {
    const result = [];

    for (const [key, value] of Object.entries(event)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        result.push(...this._flattenEvent(value, fullKey));
      } else if (Array.isArray(value)) {
        result.push(fullKey, JSON.stringify(value));
      } else {
        result.push(fullKey, String(value));
      }
    }

    return result;
  }

  /**
   * Parse Redis stream fields back to object
   */
  _parseFields(fields) {
    const result = {};

    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      let value = fields[i + 1];

      // Try to parse JSON arrays
      if (value.startsWith('[') || value.startsWith('{')) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Keep as string
        }
      }

      // Handle nested keys
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

export const eventStream = new EventStreamManager();

// Convenience functions
export async function logTrainingEvent(event) {
  return eventStream.addEvent('training', event);
}

export async function logGenerationEvent(event) {
  return eventStream.addEvent('generation', event);
}

export async function logEvolutionEvent(event) {
  return eventStream.addEvent('evolution', event);
}

export async function logErrorEvent(event) {
  return eventStream.addEvent('errors', event);
}
```

**Step 3.2: Integrate with training**

```javascript
// In server/routes/training.js

import { logTrainingEvent, logGenerationEvent, logEvolutionEvent } from '../redis/event-stream.js';

// At training start
await logTrainingEvent({
  event: 'training_started',
  sessionId,
  iterations: totalIterations,
  sampleSets: sampleSets.map(s => s.name)
});

// After each generation
await logGenerationEvent({
  event: 'generation_completed',
  sessionId,
  iteration,
  contentType,
  variantId,
  success: result.success,
  qualityScore,
  cacheHit: result.__cacheHit,
  latencyMs
});

// During evolution
await logEvolutionEvent({
  event: 'candidate_promoted',
  sessionId,
  contentType,
  oldChampion: oldVariantId,
  newChampion: newVariantId,
  improvement: improvementPercent
});
```

**Step 3.3: Add stream API endpoints**

```javascript
// server/routes/event-stream.js

import express from 'express';
import { eventStream } from '../redis/event-stream.js';

const router = express.Router();

router.get('/training', async (req, res) => {
  const count = parseInt(req.query.count) || 100;
  const sinceMs = req.query.since ? parseInt(req.query.since) : null;

  const events = sinceMs
    ? await eventStream.readEventsSince('training', sinceMs, count)
    : await eventStream.readEvents('training', { count, reverse: true });

  res.json({ events });
});

router.get('/generation', async (req, res) => {
  const count = parseInt(req.query.count) || 100;
  const events = await eventStream.readEvents('generation', { count, reverse: true });
  res.json({ events });
});

router.get('/stats', async (req, res) => {
  const [training, generation, evolution, errors] = await Promise.all([
    eventStream.getStreamInfo('training'),
    eventStream.getStreamInfo('generation'),
    eventStream.getStreamInfo('evolution'),
    eventStream.getStreamInfo('errors')
  ]);

  res.json({
    training,
    generation,
    evolution,
    errors
  });
});

export default router;
```

---

### Feature 4: Hash Structures for Metadata

**Purpose**: Store complex metadata with field-level access

**Step 4.1: Create hash-based metadata store**

```javascript
// server/redis/metadata-store.js

import { getRedisClient } from './client.js';

/**
 * Hash-based metadata store for efficient field access
 */
export class MetadataStore {
  constructor(keyPrefix = 'force:meta') {
    this.keyPrefix = keyPrefix;
    this.client = null;
  }

  async _getClient() {
    if (!this.client) {
      this.client = await getRedisClient();
    }
    return this.client;
  }

  _key(id) {
    return `${this.keyPrefix}:${id}`;
  }

  /**
   * Set multiple fields on a hash
   */
  async setFields(id, fields) {
    const client = await this._getClient();
    if (!client) return;

    const flatFields = {};
    for (const [key, value] of Object.entries(fields)) {
      flatFields[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }

    await client.hset(this._key(id), flatFields);
  }

  /**
   * Get specific field
   */
  async getField(id, field) {
    const client = await this._getClient();
    if (!client) return null;

    const value = await client.hget(this._key(id), field);

    // Try to parse JSON
    if (value && (value.startsWith('{') || value.startsWith('['))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }

    return value;
  }

  /**
   * Get multiple fields
   */
  async getFields(id, fields) {
    const client = await this._getClient();
    if (!client) return {};

    const values = await client.hmget(this._key(id), ...fields);

    const result = {};
    fields.forEach((field, i) => {
      let value = values[i];
      if (value && (value.startsWith('{') || value.startsWith('['))) {
        try {
          value = JSON.parse(value);
        } catch (e) {}
      }
      result[field] = value;
    });

    return result;
  }

  /**
   * Get all fields
   */
  async getAll(id) {
    const client = await this._getClient();
    if (!client) return {};

    const data = await client.hgetall(this._key(id));

    // Parse JSON values
    for (const key of Object.keys(data)) {
      if (data[key].startsWith('{') || data[key].startsWith('[')) {
        try {
          data[key] = JSON.parse(data[key]);
        } catch (e) {}
      }
    }

    return data;
  }

  /**
   * Increment numeric field
   */
  async incrementField(id, field, amount = 1) {
    const client = await this._getClient();
    if (!client) return 0;

    if (Number.isInteger(amount)) {
      return client.hincrby(this._key(id), field, amount);
    } else {
      return client.hincrbyfloat(this._key(id), field, amount);
    }
  }

  /**
   * Check if field exists
   */
  async fieldExists(id, field) {
    const client = await this._getClient();
    if (!client) return false;

    return client.hexists(this._key(id), field);
  }

  /**
   * Delete specific fields
   */
  async deleteFields(id, fields) {
    const client = await this._getClient();
    if (!client) return 0;

    return client.hdel(this._key(id), ...fields);
  }

  /**
   * Delete entire hash
   */
  async delete(id) {
    const client = await this._getClient();
    if (!client) return 0;

    return client.del(this._key(id));
  }

  /**
   * Set TTL on hash
   */
  async setExpiry(id, seconds) {
    const client = await this._getClient();
    if (!client) return;

    await client.expire(this._key(id), seconds);
  }
}

// Pre-configured stores
export const variantMeta = new MetadataStore('force:variant:meta');
export const sessionMeta = new MetadataStore('force:session:meta');
export const cacheMeta = new MetadataStore('force:cache:meta');
```

**Step 4.2: Use for variant metadata**

```javascript
// Example usage in variant registry
import { variantMeta } from '../redis/metadata-store.js';

// Store variant metadata efficiently
await variantMeta.setFields(variantId, {
  name: 'Roadmap Champion V1',
  contentType: 'Roadmap',
  status: 'champion',
  createdAt: Date.now(),
  performance: { impressions: 0, avgScore: 0 }
});

// Access single field without loading entire object
const status = await variantMeta.getField(variantId, 'status');

// Increment metrics atomically
await variantMeta.incrementField(variantId, 'impressions');
```

---

### Feature 5: Lua Scripts for Atomic Operations

**Purpose**: Execute complex multi-step operations atomically

**Step 5.1: Create Lua script manager**

```javascript
// server/redis/lua-scripts.js

import { getRedisClient } from './client.js';
import { createHash } from 'crypto';

// Pre-defined Lua scripts
const SCRIPTS = {
  /**
   * Increment counter and update timestamp atomically
   * KEYS[1] = hash key
   * ARGV[1] = counter field
   * ARGV[2] = timestamp field
   */
  incrementWithTimestamp: `
    local count = redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
    redis.call('HSET', KEYS[1], ARGV[2], ARGV[3])
    return count
  `,

  /**
   * Get and set if greater (for tracking high scores)
   * KEYS[1] = key
   * ARGV[1] = new score
   * Returns: 1 if updated, 0 if not
   */
  setIfGreater: `
    local current = redis.call('GET', KEYS[1])
    if current == false or tonumber(ARGV[1]) > tonumber(current) then
      redis.call('SET', KEYS[1], ARGV[1])
      return 1
    end
    return 0
  `,

  /**
   * Atomic variant score update
   * KEYS[1] = scores sorted set
   * KEYS[2] = counts sorted set
   * KEYS[3] = metadata hash
   * ARGV[1] = variant ID
   * ARGV[2] = score
   * ARGV[3] = current timestamp
   */
  updateVariantScore: `
    -- Update total score
    redis.call('ZINCRBY', KEYS[1], ARGV[2], ARGV[1])

    -- Increment count
    local count = redis.call('ZINCRBY', KEYS[2], 1, ARGV[1])

    -- Get new total score
    local totalScore = redis.call('ZSCORE', KEYS[1], ARGV[1])

    -- Calculate and store average
    local avgScore = tonumber(totalScore) / tonumber(count)
    redis.call('HSET', KEYS[3], 'avgScore', avgScore)
    redis.call('HSET', KEYS[3], 'lastUpdated', ARGV[3])
    redis.call('HSET', KEYS[3], 'sampleCount', count)

    return {totalScore, count, avgScore}
  `,

  /**
   * Rate limiting with sliding window
   * KEYS[1] = rate limit key
   * ARGV[1] = window size (seconds)
   * ARGV[2] = max requests
   * ARGV[3] = current timestamp (ms)
   * Returns: 1 if allowed, 0 if rate limited
   */
  rateLimitCheck: `
    local key = KEYS[1]
    local window = tonumber(ARGV[1]) * 1000
    local maxRequests = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local windowStart = now - window

    -- Remove old entries
    redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

    -- Count current requests
    local currentCount = redis.call('ZCARD', key)

    if currentCount < maxRequests then
      -- Add this request
      redis.call('ZADD', key, now, now .. '-' .. math.random())
      redis.call('EXPIRE', key, ARGV[1])
      return 1
    else
      return 0
    end
  `,

  /**
   * Cache with automatic refresh tracking
   * KEYS[1] = cache key
   * KEYS[2] = metadata key
   * ARGV[1] = value (if setting)
   * ARGV[2] = ttl
   * ARGV[3] = timestamp
   * ARGV[4] = operation ('get' or 'set')
   */
  cacheWithMetrics: `
    if ARGV[4] == 'get' then
      local value = redis.call('GET', KEYS[1])
      if value then
        redis.call('HINCRBY', KEYS[2], 'hits', 1)
        redis.call('HSET', KEYS[2], 'lastHit', ARGV[3])
        return value
      else
        redis.call('HINCRBY', KEYS[2], 'misses', 1)
        return nil
      end
    else
      redis.call('SETEX', KEYS[1], ARGV[2], ARGV[1])
      redis.call('HINCRBY', KEYS[2], 'sets', 1)
      redis.call('HSET', KEYS[2], 'lastSet', ARGV[3])
      return 'OK'
    end
  `
};

/**
 * Lua Script Manager
 */
export class LuaScriptManager {
  constructor() {
    this.client = null;
    this.scriptShas = new Map();
  }

  async _getClient() {
    if (!this.client) {
      this.client = await getRedisClient();
    }
    return this.client;
  }

  /**
   * Load all scripts into Redis
   */
  async loadScripts() {
    const client = await this._getClient();
    if (!client) return;

    for (const [name, script] of Object.entries(SCRIPTS)) {
      const sha = await client.script('LOAD', script);
      this.scriptShas.set(name, sha);
      console.log(`[Lua] Loaded script: ${name} (${sha.slice(0, 8)}...)`);
    }
  }

  /**
   * Execute a script by name
   */
  async execute(scriptName, keys, args) {
    const client = await this._getClient();
    if (!client) return null;

    let sha = this.scriptShas.get(scriptName);

    // Load script if not cached
    if (!sha) {
      const script = SCRIPTS[scriptName];
      if (!script) {
        throw new Error(`Unknown script: ${scriptName}`);
      }
      sha = await client.script('LOAD', script);
      this.scriptShas.set(scriptName, sha);
    }

    try {
      return await client.evalsha(sha, keys.length, ...keys, ...args);
    } catch (error) {
      if (error.message.includes('NOSCRIPT')) {
        // Script not in Redis, reload
        const script = SCRIPTS[scriptName];
        sha = await client.script('LOAD', script);
        this.scriptShas.set(scriptName, sha);
        return client.evalsha(sha, keys.length, ...keys, ...args);
      }
      throw error;
    }
  }

  /**
   * Convenience: Update variant score atomically
   */
  async updateVariantScore(variantId, score) {
    return this.execute('updateVariantScore', [
      'force:variants:scores',
      'force:variants:counts',
      `force:variant:meta:${variantId}`
    ], [
      variantId,
      score,
      Date.now()
    ]);
  }

  /**
   * Convenience: Check rate limit
   */
  async checkRateLimit(key, windowSeconds, maxRequests) {
    const result = await this.execute('rateLimitCheck', [
      `force:ratelimit:${key}`
    ], [
      windowSeconds,
      maxRequests,
      Date.now()
    ]);

    return result === 1;
  }
}

export const luaScripts = new LuaScriptManager();
```

**Step 5.2: Initialize on startup**

```javascript
// server.js

import { luaScripts } from './redis/lua-scripts.js';

// During startup
await luaScripts.loadScripts();
```

---

## File Structure After Implementation

```
server/redis/
├── client.js               # Existing (no changes)
├── checkpointer.js         # Existing (no changes)
├── dspy-cache.js           # Modified (add pub/sub)
├── index.js                # Modified (add exports)
├── variant-metrics.js      # NEW: Sorted sets
├── pubsub.js               # NEW: Pub/Sub
├── event-stream.js         # NEW: Streams
├── metadata-store.js       # NEW: Hashes
└── lua-scripts.js          # NEW: Lua scripts

server/routes/
├── variant-metrics.js      # NEW: Metrics API
└── event-stream.js         # NEW: Events API
```

---

## API Reference After Implementation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/variants/top` | GET | Get top performing variants |
| `/api/variants/underperformers` | GET | Get worst performing variants |
| `/api/variants/trend/:id` | GET | Get performance trend |
| `/api/variants/compare` | GET | Compare two variants |
| `/api/events/training` | GET | Get training events |
| `/api/events/generation` | GET | Get generation events |
| `/api/events/stats` | GET | Get event stream stats |

---

## Testing Requirements

```javascript
// tests/unit/variant-metrics.test.js
describe('VariantMetricsTracker', () => {
  test('records scores correctly', async () => {
    await variantMetrics.recordScore('test-variant', 4.5, 'Roadmap');
    const top = await variantMetrics.getTopVariants(1, 'Roadmap');
    expect(top[0].variantId).toBe('test-variant');
  });
});

// tests/unit/pubsub.test.js
describe('PubSubManager', () => {
  test('publishes and receives messages', async () => {
    const received = [];
    await pubsub.subscribe('test-channel', (msg) => received.push(msg));
    await pubsub.publish('test-channel', { data: 'test' });
    await new Promise(r => setTimeout(r, 100));
    expect(received).toHaveLength(1);
  });
});

// tests/unit/event-stream.test.js
describe('EventStreamManager', () => {
  test('adds and retrieves events', async () => {
    await eventStream.addEvent('training', { action: 'start' });
    const events = await eventStream.readEvents('training', { count: 1 });
    expect(events[0].action).toBe('start');
  });
});
```

---

## Rollback Plan

Each feature is independent and can be disabled individually:

1. **Sorted Sets**: Remove variant-metrics imports
2. **Pub/Sub**: Disable in config, pub/sub degrades gracefully
3. **Streams**: Remove event logging calls
4. **Hashes**: Revert to JSON string storage
5. **Lua**: Fall back to individual commands

---

## Success Criteria

| Feature | Metric | Target |
|---------|--------|--------|
| Sorted Sets | Query time | <10ms for top 10 |
| Pub/Sub | Message latency | <50ms |
| Streams | Event logging | <5ms per event |
| Hashes | Field access | 2x faster than GET/parse |
| Lua | Atomic ops | No race conditions |

---

## Estimated Timeline

| Feature | Duration |
|---------|----------|
| Sorted Sets | 2 hours |
| Pub/Sub | 2 hours |
| Streams | 2 hours |
| Hashes | 1.5 hours |
| Lua Scripts | 2 hours |
| Integration | 1.5 hours |
| Testing | 2 hours |
| **Total** | **~13 hours** |

---

## Dependencies

- Redis 6.0+ (for XREAD improvements)
- ioredis supports all features
- No additional packages needed
