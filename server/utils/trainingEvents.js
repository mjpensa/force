/**
 * Training Events Integration
 *
 * Gap 10, 11, 12: Integrates Redis Pub/Sub, Event Streams, and Variant Metrics
 * into the training workflow for comprehensive event tracking and broadcasting.
 *
 * This module provides:
 * 1. Event logging to Redis Streams for audit trail
 * 2. Pub/Sub notifications for real-time updates
 * 3. Variant metrics tracking for performance analysis
 *
 * Usage:
 *   import { trainingEvents } from './utils/trainingEvents.js';
 *
 *   // In training workflow
 *   await trainingEvents.onSessionStart(sessionId, config);
 *   await trainingEvents.onGeneration(sessionId, result, metadata);
 *   await trainingEvents.onEvolutionCycle(sessionId, results);
 *   await trainingEvents.onSessionComplete(sessionId, summary);
 */

import {
  logTrainingEvent,
  logGenerationEvent,
  logEvolutionEvent,
  logErrorEvent,
  eventStream
} from '../redis/event-stream.js';

import {
  publishTrainingEvent,
  publishCacheInvalidation,
  pubsub
} from '../redis/pubsub.js';

import { variantMetrics } from '../redis/variant-metrics.js';
import { getRedisClient } from '../redis/client.js';

// ============================================================================
// SESSION LIFECYCLE EVENTS
// ============================================================================

/**
 * Called when a training session starts
 */
async function onSessionStart(sessionId, config = {}) {
  const eventData = {
    event: 'session_started',
    sessionId,
    mode: config.mode || 'standard',
    iterations: config.iterations,
    contentTypes: config.contentTypes,
    sampleSetCount: config.sampleSets?.length,
    timestamp: Date.now()
  };

  // Log to event stream
  const eventId = await logTrainingEvent(eventData);

  // Publish to subscribers
  await publishTrainingEvent('session_started', {
    sessionId,
    config: {
      iterations: config.iterations,
      contentTypes: config.contentTypes
    }
  });

  console.log(`[TrainingEvents] Session started: ${sessionId} (event: ${eventId})`);

  return eventId;
}

/**
 * Called when a training session completes
 */
async function onSessionComplete(sessionId, summary = {}) {
  const eventData = {
    event: 'session_completed',
    sessionId,
    totalGenerations: summary.totalGenerations,
    successful: summary.successful,
    failed: summary.failed,
    successRate: summary.successRate,
    avgQuality: summary.avgQuality,
    cacheHitRate: summary.cache?.hitRate,
    duration: summary.duration,
    timestamp: Date.now()
  };

  const eventId = await logTrainingEvent(eventData);

  await publishTrainingEvent('session_completed', {
    sessionId,
    summary: {
      iterations: summary.iterations,
      successRate: summary.successRate,
      avgQuality: summary.avgQuality,
      cacheHitRate: summary.cache?.hitRate
    }
  });

  console.log(`[TrainingEvents] Session completed: ${sessionId} (event: ${eventId})`);

  return eventId;
}

/**
 * Called when a training session stops (user-initiated or error)
 */
async function onSessionStop(sessionId, reason = 'user_stop', details = {}) {
  const eventData = {
    event: 'session_stopped',
    sessionId,
    reason,
    iteration: details.iteration,
    error: details.error,
    timestamp: Date.now()
  };

  const eventId = await logTrainingEvent(eventData);

  await publishTrainingEvent('session_stopped', {
    sessionId,
    reason,
    iteration: details.iteration
  });

  if (reason === 'error') {
    await logErrorEvent({
      sessionId,
      error: details.error,
      context: 'training_session'
    });
  }

  console.log(`[TrainingEvents] Session stopped: ${sessionId} - ${reason}`);

  return eventId;
}

// ============================================================================
// GENERATION EVENTS
// ============================================================================

/**
 * Called after each content generation
 */
async function onGeneration(sessionId, result, metadata = {}) {
  const {
    iteration,
    contentType,
    sampleSet,
    cacheHit,
    latencyMs
  } = metadata;

  const success = result?.success || false;
  const variantId = result?._variant?.id || 'unknown';
  const qualityScore = metadata.feedback?.rating || metadata.feedback?.qualityScore;

  // Log generation event
  const eventData = {
    event: 'generation',
    sessionId,
    iteration,
    contentType,
    sampleSet,
    success,
    variantId,
    cacheHit: cacheHit || false,
    qualityScore,
    latencyMs,
    timestamp: Date.now()
  };

  const eventId = await logGenerationEvent(eventData);

  // Record variant metrics
  if (success && qualityScore) {
    await variantMetrics.recordScore(variantId, qualityScore, contentType);
  }

  // Publish real-time update (throttled - only every 10 iterations)
  if (iteration % 10 === 0) {
    await publishTrainingEvent('generation_batch', {
      sessionId,
      iteration,
      lastContentType: contentType,
      batchSuccess: success
    });
  }

  return eventId;
}

/**
 * Called when generation fails
 */
async function onGenerationError(sessionId, error, metadata = {}) {
  const {
    iteration,
    contentType,
    sampleSet
  } = metadata;

  const eventData = {
    event: 'generation_error',
    sessionId,
    iteration,
    contentType,
    sampleSet,
    errorMessage: error?.message || String(error),
    errorCategory: error?.category,
    errorCode: error?.code,
    timestamp: Date.now()
  };

  const eventId = await logErrorEvent(eventData);

  // Publish if it's a critical error
  if (error?.category === 'SYSTEM_BUG' || error?.action === 'HALT_TRAINING') {
    await publishTrainingEvent('critical_error', {
      sessionId,
      iteration,
      error: error?.message
    });
  }

  return eventId;
}

// ============================================================================
// EVOLUTION EVENTS
// ============================================================================

/**
 * Called when an evolution cycle runs
 */
async function onEvolutionCycle(sessionId, iteration, results = {}) {
  const {
    promotions = [],
    evolutions = [],
    errors = []
  } = results;

  const eventData = {
    event: 'evolution_cycle',
    sessionId,
    iteration,
    promotionCount: promotions.length,
    evolutionCount: evolutions.length,
    errorCount: errors.length,
    promotions: promotions.map(p => ({
      contentType: p.contentType,
      improvement: p.improvement
    })),
    evolutions: evolutions.map(e => ({
      contentType: e.contentType,
      mutations: e.mutations
    })),
    timestamp: Date.now()
  };

  const eventId = await logEvolutionEvent(eventData);

  // Publish if there were promotions
  if (promotions.length > 0) {
    await publishTrainingEvent('variant_promoted', {
      sessionId,
      iteration,
      promotions: promotions.map(p => ({
        contentType: p.contentType,
        improvement: p.improvement
      }))
    });
  }

  console.log(`[TrainingEvents] Evolution cycle at iteration ${iteration}: ${promotions.length} promotions, ${evolutions.length} evolutions`);

  return eventId;
}

/**
 * Called when a DSPy optimization runs
 */
async function onOptimization(sessionId, signatureType, result = {}) {
  const eventData = {
    event: 'dspy_optimization',
    sessionId,
    signatureType,
    success: result.success,
    examplesUsed: result.metrics?.examples_used,
    fewShotCount: result.metrics?.few_shot_count,
    optimizer: result.optimizer || 'bootstrap',
    timestamp: Date.now()
  };

  const eventId = await logEvolutionEvent(eventData);

  if (result.success) {
    await publishTrainingEvent('optimization_completed', {
      sessionId,
      signatureType,
      fewShotCount: result.metrics?.few_shot_count
    });

    // Invalidate cache for this signature type to use new optimized module
    await publishCacheInvalidation(signatureType);
  }

  return eventId;
}

// ============================================================================
// CHECKPOINT EVENTS
// ============================================================================

/**
 * Called when a checkpoint is saved
 */
async function onCheckpointSaved(sessionId, checkpointInfo = {}) {
  const eventData = {
    event: 'checkpoint_saved',
    sessionId,
    version: checkpointInfo.version,
    iteration: checkpointInfo.iteration,
    timestamp: Date.now()
  };

  const eventId = await logTrainingEvent(eventData);

  return eventId;
}

/**
 * Called when training resumes from checkpoint
 */
async function onCheckpointResumed(sessionId, checkpointInfo = {}) {
  const eventData = {
    event: 'checkpoint_resumed',
    sessionId,
    version: checkpointInfo.version,
    resumeIteration: checkpointInfo.iteration,
    timestamp: Date.now()
  };

  const eventId = await logTrainingEvent(eventData);

  await publishTrainingEvent('session_resumed', {
    sessionId,
    fromIteration: checkpointInfo.iteration
  });

  console.log(`[TrainingEvents] Resumed from checkpoint: ${sessionId} at iteration ${checkpointInfo.iteration}`);

  return eventId;
}

// ============================================================================
// CACHE EVENTS
// ============================================================================

/**
 * Called to report cache statistics
 */
async function onCacheStats(sessionId, cacheStats = {}) {
  const eventData = {
    event: 'cache_stats',
    sessionId,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: cacheStats.hitRate,
    estimatedSavings: cacheStats.estimatedSavings,
    timestamp: Date.now()
  };

  await logTrainingEvent(eventData);
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get recent training events for a session
 */
async function getSessionEvents(sessionId, options = {}) {
  const { limit = 100, types = ['training', 'generation', 'evolution'] } = options;

  const events = [];

  for (const type of types) {
    const typeEvents = await eventStream.getLatestEvents(type, limit);
    const sessionEvents = typeEvents.filter(e => e.sessionId === sessionId);
    events.push(...sessionEvents);
  }

  // Sort by timestamp descending
  events.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return events.slice(0, limit);
}

/**
 * Get training metrics summary
 */
async function getTrainingMetrics(options = {}) {
  const { sinceMs = 86400000 } = options; // Default: last 24 hours
  const since = Date.now() - sinceMs;

  const [
    trainingEvents,
    generationEvents,
    evolutionEvents,
    variantSummary
  ] = await Promise.all([
    eventStream.readEventsSince('training', since, 1000),
    eventStream.readEventsSince('generation', since, 5000),
    eventStream.readEventsSince('evolution', since, 500),
    variantMetrics.getSummary()
  ]);

  const sessions = new Set(trainingEvents.map(e => e.sessionId).filter(Boolean));
  const completedSessions = trainingEvents.filter(e => e.event === 'session_completed');
  const successfulGenerations = generationEvents.filter(e => e.success);
  const cacheHits = generationEvents.filter(e => e.cacheHit);
  const promotions = evolutionEvents.filter(e => e.event === 'evolution_cycle' && e.promotionCount > 0);

  return {
    period: {
      since: new Date(since).toISOString(),
      until: new Date().toISOString()
    },
    sessions: {
      total: sessions.size,
      completed: completedSessions.length
    },
    generations: {
      total: generationEvents.length,
      successful: successfulGenerations.length,
      successRate: generationEvents.length > 0
        ? ((successfulGenerations.length / generationEvents.length) * 100).toFixed(1) + '%'
        : '0%'
    },
    cache: {
      hits: cacheHits.length,
      misses: generationEvents.length - cacheHits.length,
      hitRate: generationEvents.length > 0
        ? ((cacheHits.length / generationEvents.length) * 100).toFixed(1) + '%'
        : '0%'
    },
    evolution: {
      cycles: evolutionEvents.filter(e => e.event === 'evolution_cycle').length,
      promotions: promotions.reduce((sum, e) => sum + (e.promotionCount || 0), 0)
    },
    variants: variantSummary
  };
}

/**
 * Get top performing variants
 */
async function getTopVariants(limit = 10, contentType = null) {
  return variantMetrics.getTopVariants(limit, contentType);
}

/**
 * Compare variant performance
 */
async function compareVariants(variantA, variantB) {
  return variantMetrics.compareVariants(variantA, variantB);
}

// ============================================================================
// SUBSCRIPTION HELPERS
// ============================================================================

/**
 * Subscribe to training events for real-time updates
 */
async function subscribeToSession(sessionId, handler) {
  return pubsub.subscribe('force:training:events', (message) => {
    if (!sessionId || message.data?.sessionId === sessionId) {
      handler(message);
    }
  });
}

/**
 * Unsubscribe from training events
 */
async function unsubscribeFromSession(handler) {
  return pubsub.unsubscribe('force:training:events', handler);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const trainingEvents = {
  // Session lifecycle
  onSessionStart,
  onSessionComplete,
  onSessionStop,

  // Generation events
  onGeneration,
  onGenerationError,

  // Evolution events
  onEvolutionCycle,
  onOptimization,

  // Checkpoint events
  onCheckpointSaved,
  onCheckpointResumed,

  // Cache events
  onCacheStats,

  // Query functions
  getSessionEvents,
  getTrainingMetrics,
  getTopVariants,
  compareVariants,

  // Subscriptions
  subscribeToSession,
  unsubscribeFromSession
};

export default trainingEvents;
