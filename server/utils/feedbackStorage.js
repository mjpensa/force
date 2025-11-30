/**
 * Feedback Storage
 *
 * Server-side storage layer for feedback events with aggregation and indexing.
 *
 * Implementation of Plan 05: Production Feedback Integration - Phase 3
 */

import { FeedbackEventValidation, generateEventId, FEEDBACK_CONTENT_TYPES } from './feedbackSchema.js';

// ============================================================================
// Phase 3: Server-Side Feedback Storage
// ============================================================================

/**
 * FeedbackStore - In-memory storage with indexing and aggregation
 */
export class FeedbackStore {
  constructor() {
    // Primary storage
    this.events = [];

    // Indexes for fast lookup
    this.generationIndex = {};  // generationId -> events[]
    this.contentTypeIndex = {}; // contentType -> events[]
    this.sessionIndex = {};     // sessionId -> events[]

    // Pre-computed aggregates
    this.aggregates = {};

    // Configuration
    this.maxEvents = 100000;  // Memory limit
    this.aggregateUpdateInterval = 100;  // Update aggregates every N events
    this.eventsSinceLastAggregate = 0;
  }

  /**
   * Store a feedback event
   *
   * @param {Object} event - Feedback event to store
   * @returns {Object} Stored event with server-side enrichment
   */
  async store(event) {
    // Validate
    const validation = FeedbackEventValidation.validate(event);
    if (!validation.valid) {
      throw new Error(`Invalid feedback event: ${validation.errors.join(', ')}`);
    }

    // Sanitize
    const sanitizedEvent = FeedbackEventValidation.sanitize(event);

    // Enrich with server-side data
    const enrichedEvent = {
      ...sanitizedEvent,
      storedAt: new Date().toISOString(),
      eventId: sanitizedEvent.eventId || generateEventId(),
      serverProcessed: true
    };

    // Store
    this.events.push(enrichedEvent);

    // Manage memory limit
    if (this.events.length > this.maxEvents) {
      this.pruneOldEvents();
    }

    // Update indexes
    this.indexEvent(enrichedEvent);

    // Update aggregates periodically
    this.eventsSinceLastAggregate++;
    if (this.eventsSinceLastAggregate >= this.aggregateUpdateInterval) {
      this.rebuildAggregates();
      this.eventsSinceLastAggregate = 0;
    } else {
      // Incremental aggregate update
      this.updateAggregates(enrichedEvent);
    }

    return enrichedEvent;
  }

  /**
   * Index an event for fast lookup
   *
   * @param {Object} event - Event to index
   */
  indexEvent(event) {
    // Generation index
    if (event.generationId) {
      if (!this.generationIndex[event.generationId]) {
        this.generationIndex[event.generationId] = [];
      }
      this.generationIndex[event.generationId].push(event);
    }

    // Content type index
    if (event.contentType) {
      if (!this.contentTypeIndex[event.contentType]) {
        this.contentTypeIndex[event.contentType] = [];
      }
      this.contentTypeIndex[event.contentType].push(event);
    }

    // Session index
    if (event.sessionId) {
      if (!this.sessionIndex[event.sessionId]) {
        this.sessionIndex[event.sessionId] = [];
      }
      this.sessionIndex[event.sessionId].push(event);
    }
  }

  /**
   * Update aggregates incrementally
   *
   * @param {Object} event - New event to aggregate
   */
  updateAggregates(event) {
    const key = `${event.contentType}_${event.promptVariant || 'default'}`;

    if (!this.aggregates[key]) {
      this.aggregates[key] = this.createEmptyAggregate(event.contentType, event.promptVariant);
    }

    const agg = this.aggregates[key];
    agg.totalEvents++;
    agg.lastUpdated = new Date().toISOString();

    // Update rating aggregates
    if (event.rating !== null && event.rating !== undefined) {
      agg.ratings.sum += event.rating;
      agg.ratings.count++;
      agg.ratings.values.push(event.rating);
    }

    // Update behavioral aggregates
    if (event.exported !== undefined) {
      agg.exportRate.total++;
      if (event.exported) agg.exportRate.count++;
    }

    if (event.edited !== undefined) {
      agg.editRate.total++;
      if (event.edited) agg.editRate.count++;
    }

    if (event.regenerated !== undefined) {
      agg.regenerateRate.total++;
      if (event.regenerated) agg.regenerateRate.count++;
    }

    // Update thumbs aggregates
    if (event.thumbsUp !== null && event.thumbsUp !== undefined) {
      agg.thumbsUp.total++;
      if (event.thumbsUp) agg.thumbsUp.up++;
      else agg.thumbsUp.down++;
    }

    // Update duration aggregates
    if (event.viewDuration !== undefined && event.viewDuration !== null) {
      agg.viewDuration.sum += event.viewDuration;
      agg.viewDuration.count++;
    }

    // Update quality score aggregates
    if (event.qualityScore !== null && event.qualityScore !== undefined) {
      agg.qualityScore.sum += event.qualityScore;
      agg.qualityScore.count++;
    }

    // Update scroll depth aggregates
    if (event.scrollDepth !== undefined && event.scrollDepth !== null) {
      agg.scrollDepth.sum += event.scrollDepth;
      agg.scrollDepth.count++;
    }
  }

  /**
   * Create empty aggregate structure
   *
   * @param {string} contentType - Content type
   * @param {string} promptVariant - Prompt variant
   * @returns {Object} Empty aggregate
   */
  createEmptyAggregate(contentType, promptVariant) {
    return {
      contentType,
      promptVariant: promptVariant || 'default',
      totalEvents: 0,
      lastUpdated: new Date().toISOString(),
      ratings: { sum: 0, count: 0, values: [] },
      exportRate: { count: 0, total: 0 },
      editRate: { count: 0, total: 0 },
      regenerateRate: { count: 0, total: 0 },
      thumbsUp: { up: 0, down: 0, total: 0 },
      viewDuration: { sum: 0, count: 0 },
      qualityScore: { sum: 0, count: 0 },
      scrollDepth: { sum: 0, count: 0 }
    };
  }

  /**
   * Rebuild all aggregates from scratch
   */
  rebuildAggregates() {
    this.aggregates = {};
    for (const event of this.events) {
      this.updateAggregates(event);
    }
  }

  /**
   * Prune old events to stay within memory limit
   */
  pruneOldEvents() {
    // Keep most recent events
    const pruneCount = Math.floor(this.maxEvents * 0.1);
    const removed = this.events.splice(0, pruneCount);

    // Rebuild indexes
    this.generationIndex = {};
    this.contentTypeIndex = {};
    this.sessionIndex = {};

    for (const event of this.events) {
      this.indexEvent(event);
    }

    // Rebuild aggregates
    this.rebuildAggregates();

    console.log(`Pruned ${removed.length} old feedback events`);
  }

  /**
   * Get computed aggregates for a content type/variant
   *
   * @param {string} contentType - Content type
   * @param {string} promptVariant - Prompt variant (optional)
   * @returns {Object|null} Computed aggregates
   */
  getAggregates(contentType, promptVariant) {
    const key = `${contentType}_${promptVariant || 'default'}`;
    const agg = this.aggregates[key];

    if (!agg) return null;

    // Compute derived metrics
    return {
      contentType: agg.contentType,
      promptVariant: agg.promptVariant,
      totalEvents: agg.totalEvents,
      lastUpdated: agg.lastUpdated,

      avgRating: agg.ratings.count > 0
        ? agg.ratings.sum / agg.ratings.count
        : null,
      ratingCount: agg.ratings.count,
      ratingDistribution: this.calculateRatingDistribution(agg.ratings.values),

      exportRate: agg.exportRate.total > 0
        ? agg.exportRate.count / agg.exportRate.total
        : null,
      exportCount: agg.exportRate.count,

      editRate: agg.editRate.total > 0
        ? agg.editRate.count / agg.editRate.total
        : null,
      editCount: agg.editRate.count,

      regenerateRate: agg.regenerateRate.total > 0
        ? agg.regenerateRate.count / agg.regenerateRate.total
        : null,
      regenerateCount: agg.regenerateRate.count,

      thumbsUpRate: agg.thumbsUp.total > 0
        ? agg.thumbsUp.up / agg.thumbsUp.total
        : null,
      thumbsUpCount: agg.thumbsUp.up,
      thumbsDownCount: agg.thumbsUp.down,

      avgViewDuration: agg.viewDuration.count > 0
        ? agg.viewDuration.sum / agg.viewDuration.count
        : null,

      avgQualityScore: agg.qualityScore.count > 0
        ? agg.qualityScore.sum / agg.qualityScore.count
        : null,

      avgScrollDepth: agg.scrollDepth.count > 0
        ? agg.scrollDepth.sum / agg.scrollDepth.count
        : null
    };
  }

  /**
   * Calculate rating distribution (1-5)
   *
   * @param {Array<number>} ratings - Array of ratings
   * @returns {Object} Distribution object
   */
  calculateRatingDistribution(ratings) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const rating of ratings) {
      const rounded = Math.round(rating);
      if (rounded >= 1 && rounded <= 5) {
        distribution[rounded]++;
      }
    }
    return distribution;
  }

  /**
   * Get events for a specific generation
   *
   * @param {string} generationId - Generation ID
   * @returns {Array} Events for this generation
   */
  getEventsForGeneration(generationId) {
    return this.generationIndex[generationId] || [];
  }

  /**
   * Get events for a content type
   *
   * @param {string} contentType - Content type
   * @returns {Array} Events for this content type
   */
  getEventsForContentType(contentType) {
    return this.contentTypeIndex[contentType] || [];
  }

  /**
   * Get events for a session
   *
   * @param {string} sessionId - Session ID
   * @returns {Array} Events for this session
   */
  getEventsForSession(sessionId) {
    return this.sessionIndex[sessionId] || [];
  }

  /**
   * Get recent events
   *
   * @param {number} count - Number of events to return
   * @returns {Array} Recent events
   */
  getRecentEvents(count = 100) {
    return this.events.slice(-count);
  }

  /**
   * Export events for training
   *
   * @param {Object} options - Filter options
   * @returns {Array} Filtered events
   */
  exportForTraining(options = {}) {
    const { minRating, contentType, sinceDate, hasExplicitFeedback, limit } = options;

    let filtered = this.events.filter(e => {
      // Filter by minimum rating
      if (minRating !== undefined && (e.rating === null || e.rating < minRating)) {
        return false;
      }

      // Filter by content type
      if (contentType && e.contentType !== contentType) {
        return false;
      }

      // Filter by date
      if (sinceDate && new Date(e.timestamp) < new Date(sinceDate)) {
        return false;
      }

      // Filter for explicit feedback only
      if (hasExplicitFeedback) {
        if (e.rating === null && e.thumbsUp === null && !e.feedbackText) {
          return false;
        }
      }

      return true;
    });

    // Apply limit
    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Get overall statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalEvents: this.events.length,
      totalGenerations: Object.keys(this.generationIndex).length,
      totalSessions: Object.keys(this.sessionIndex).length,
      byContentType: FEEDBACK_CONTENT_TYPES.reduce((acc, type) => {
        acc[type] = (this.contentTypeIndex[type] || []).length;
        return acc;
      }, {}),
      memoryUsage: {
        events: this.events.length,
        maxEvents: this.maxEvents,
        utilizationPercent: ((this.events.length / this.maxEvents) * 100).toFixed(1)
      }
    };
  }

  /**
   * Clear all stored data
   */
  clear() {
    this.events = [];
    this.generationIndex = {};
    this.contentTypeIndex = {};
    this.sessionIndex = {};
    this.aggregates = {};
    this.eventsSinceLastAggregate = 0;
  }

  /**
   * Export state for persistence
   *
   * @returns {Object} Serializable state
   */
  exportState() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      events: this.events,
      aggregates: this.aggregates
    };
  }

  /**
   * Import state from persistence
   *
   * @param {Object} state - Previously exported state
   */
  importState(state) {
    if (!state || state.version !== 1) {
      throw new Error('Invalid state version');
    }

    this.clear();
    this.events = state.events || [];
    this.aggregates = state.aggregates || {};

    // Rebuild indexes
    for (const event of this.events) {
      this.indexEvent(event);
    }
  }
}

// Singleton instance
export const feedbackStore = new FeedbackStore();

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 3 implementation
 *
 * @returns {Object} Validation results
 */
export async function validatePhase3() {
  const results = {
    passed: true,
    tests: []
  };

  // Create test store
  const store = new FeedbackStore();

  // Test 1: Store valid event
  const validEvent = {
    eventId: 'fb_test_1',
    generationId: 'gen_1',
    contentType: 'Roadmap',
    timestamp: new Date().toISOString(),
    rating: 4
  };

  let stored;
  try {
    stored = await store.store(validEvent);
    results.tests.push({
      name: 'Store valid event',
      passed: stored.eventId === 'fb_test_1' && stored.serverProcessed === true,
      details: `eventId=${stored.eventId}`
    });
  } catch (error) {
    results.tests.push({
      name: 'Store valid event',
      passed: false,
      details: `error=${error.message}`
    });
  }

  // Test 2: Reject invalid event
  let invalidError = null;
  try {
    await store.store({ rating: 4 });  // Missing required fields
  } catch (error) {
    invalidError = error;
  }
  results.tests.push({
    name: 'Reject invalid event',
    passed: invalidError !== null,
    details: `error=${invalidError?.message || 'none'}`
  });

  // Test 3: Index by generation
  results.tests.push({
    name: 'Index by generation',
    passed: store.getEventsForGeneration('gen_1').length === 1,
    details: `events=${store.getEventsForGeneration('gen_1').length}`
  });

  // Test 4: Index by content type
  results.tests.push({
    name: 'Index by content type',
    passed: store.getEventsForContentType('Roadmap').length === 1,
    details: `events=${store.getEventsForContentType('Roadmap').length}`
  });

  // Test 5: Add more events and check aggregates
  await store.store({
    eventId: 'fb_test_2',
    generationId: 'gen_2',
    contentType: 'Roadmap',
    timestamp: new Date().toISOString(),
    rating: 5,
    exported: true
  });

  await store.store({
    eventId: 'fb_test_3',
    generationId: 'gen_3',
    contentType: 'Roadmap',
    timestamp: new Date().toISOString(),
    rating: 3,
    exported: false,
    thumbsUp: true
  });

  const aggregates = store.getAggregates('Roadmap', 'default');
  results.tests.push({
    name: 'Aggregates calculated correctly',
    passed: aggregates !== null && aggregates.avgRating === 4 && aggregates.ratingCount === 3,
    details: `avgRating=${aggregates?.avgRating}, count=${aggregates?.ratingCount}`
  });

  // Test 6: Export rate calculation
  results.tests.push({
    name: 'Export rate calculated',
    passed: aggregates.exportRate !== null,
    details: `exportRate=${aggregates?.exportRate?.toFixed(2)}`
  });

  // Test 7: Thumbs up rate calculation
  results.tests.push({
    name: 'Thumbs up rate calculated',
    passed: aggregates.thumbsUpRate === 1.0,  // Only one thumbs vote, and it was up
    details: `thumbsUpRate=${aggregates?.thumbsUpRate}`
  });

  // Test 8: Export for training with filters
  const highRatedEvents = store.exportForTraining({ minRating: 4 });
  results.tests.push({
    name: 'Export with filters works',
    passed: highRatedEvents.length === 2,  // Only ratings 4 and 5
    details: `filtered=${highRatedEvents.length}`
  });

  // Test 9: Get stats
  const stats = store.getStats();
  results.tests.push({
    name: 'Stats calculated',
    passed: stats.totalEvents === 3 && stats.byContentType.Roadmap === 3,
    details: `totalEvents=${stats.totalEvents}`
  });

  // Test 10: Export/import state
  const exportedState = store.exportState();
  const newStore = new FeedbackStore();
  newStore.importState(exportedState);
  results.tests.push({
    name: 'Export/import state preserves data',
    passed: newStore.events.length === 3,
    details: `importedEvents=${newStore.events.length}`
  });

  // Test 11: Clear works
  store.clear();
  results.tests.push({
    name: 'Clear removes all data',
    passed: store.events.length === 0 && Object.keys(store.aggregates).length === 0,
    details: `events=${store.events.length}`
  });

  // Test 12: Rating distribution
  const testStore = new FeedbackStore();
  for (let i = 0; i < 5; i++) {
    await testStore.store({
      eventId: `fb_dist_${i}`,
      generationId: `gen_dist_${i}`,
      contentType: 'Slides',
      timestamp: new Date().toISOString(),
      rating: (i % 5) + 1
    });
  }
  const distAgg = testStore.getAggregates('Slides', 'default');
  results.tests.push({
    name: 'Rating distribution calculated',
    passed: distAgg.ratingDistribution[1] === 1 && distAgg.ratingDistribution[5] === 1,
    details: `distribution=${JSON.stringify(distAgg.ratingDistribution)}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  validatePhase3().then(validation => {
    console.log('Feedback Storage Phase 3 Validation:', validation.passed ? 'PASSED' : 'FAILED');
    if (!validation.passed) {
      validation.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  FAILED: ${t.name} - ${t.details}`);
      });
    }
  });
}
