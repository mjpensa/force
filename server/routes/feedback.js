/**
 * Feedback API Routes - Auto-Improving Prompts Phase 1
 *
 * API endpoints for collecting user feedback on generated content.
 * Feedback is used for A/B testing and automatic prompt optimization.
 *
 * Enhanced with Plan 05: Production Feedback Integration - Phase 4
 */

import { Router } from 'express';
import { getMetricsCollector, FeedbackType } from '../layers/optimization/metrics/index.js';
import { feedbackStore } from '../utils/feedbackStorage.js';
import { FeedbackEventValidation, FEEDBACK_CONTENT_TYPES } from '../utils/feedbackSchema.js';

const router = Router();

/**
 * Record user rating (thumbs up/down or 1-5 stars)
 *
 * POST /api/feedback/rating
 * Body: { generationId, rating?, thumbsUp? }
 */
router.post('/rating', async (req, res) => {
  try {
    const { generationId, rating, thumbsUp } = req.body;

    if (!generationId) {
      return res.status(400).json({
        error: 'Missing required field: generationId'
      });
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        error: 'Rating must be between 1 and 5'
      });
    }

    const collector = getMetricsCollector();
    const success = await collector.updateFeedback(generationId, {
      rating: rating ?? (thumbsUp === true ? 5 : thumbsUp === false ? 1 : null),
      thumbsUp: thumbsUp ?? null
    });

    if (!success) {
      return res.status(404).json({
        error: 'Generation not found',
        generationId
      });
    }

    res.json({
      success: true,
      generationId,
      feedbackType: FeedbackType.RATING
    });
  } catch (error) {
    console.error('[Feedback] Rating error:', error.message);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

/**
 * Record that user edited the output
 *
 * POST /api/feedback/edit
 * Body: { generationId, originalLength?, editedLength?, editTime? }
 */
router.post('/edit', async (req, res) => {
  try {
    const { generationId, originalLength, editedLength, editTime } = req.body;

    if (!generationId) {
      return res.status(400).json({
        error: 'Missing required field: generationId'
      });
    }

    // Calculate edit distance if both lengths provided
    let editDistance = null;
    if (originalLength && editedLength) {
      editDistance = Math.abs(editedLength - originalLength) / Math.max(originalLength, 1);
    }

    const collector = getMetricsCollector();
    const success = await collector.updateFeedback(generationId, {
      wasEdited: true,
      editDistance,
      timeToFirstEdit: editTime ?? null
    });

    if (!success) {
      return res.status(404).json({
        error: 'Generation not found',
        generationId
      });
    }

    res.json({
      success: true,
      generationId,
      feedbackType: FeedbackType.EDIT,
      editDistance
    });
  } catch (error) {
    console.error('[Feedback] Edit error:', error.message);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

/**
 * Record that user exported/downloaded the output
 *
 * POST /api/feedback/export
 * Body: { generationId }
 */
router.post('/export', async (req, res) => {
  try {
    const { generationId } = req.body;

    if (!generationId) {
      return res.status(400).json({
        error: 'Missing required field: generationId'
      });
    }

    const collector = getMetricsCollector();
    const success = await collector.updateFeedback(generationId, {
      wasExported: true
    });

    if (!success) {
      return res.status(404).json({
        error: 'Generation not found',
        generationId
      });
    }

    res.json({
      success: true,
      generationId,
      feedbackType: FeedbackType.EXPORT
    });
  } catch (error) {
    console.error('[Feedback] Export error:', error.message);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

/**
 * Record that user requested regeneration
 *
 * POST /api/feedback/regenerate
 * Body: { generationId }
 */
router.post('/regenerate', async (req, res) => {
  try {
    const { generationId } = req.body;

    if (!generationId) {
      return res.status(400).json({
        error: 'Missing required field: generationId'
      });
    }

    const collector = getMetricsCollector();
    const success = await collector.updateFeedback(generationId, {
      wasRegenerated: true
    });

    if (!success) {
      return res.status(404).json({
        error: 'Generation not found',
        generationId
      });
    }

    res.json({
      success: true,
      generationId,
      feedbackType: FeedbackType.REGENERATE
    });
  } catch (error) {
    console.error('[Feedback] Regenerate error:', error.message);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

/**
 * Get feedback summary for a generation
 *
 * GET /api/feedback/:generationId
 */
router.get('/:generationId', async (req, res) => {
  try {
    const { generationId } = req.params;

    const collector = getMetricsCollector();
    const metric = await collector.getGeneration(generationId);

    if (!metric) {
      return res.status(404).json({
        error: 'Generation not found',
        generationId
      });
    }

    res.json({
      generationId,
      contentType: metric.promptVersion.contentType,
      variantId: metric.promptVersion.variantId,
      feedback: metric.feedback,
      quality: {
        score: metric.quality.qualityScore,
        grade: metric.quality.qualityGrade,
        validationPassed: metric.quality.validationPassed
      }
    });
  } catch (error) {
    console.error('[Feedback] Get error:', error.message);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

/**
 * Get metrics collector statistics
 *
 * GET /api/feedback/stats
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const collector = getMetricsCollector();
    const stats = await collector.getStats();

    res.json(stats);
  } catch (error) {
    console.error('[Feedback] Stats error:', error.message);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * Get variant metrics
 *
 * GET /api/feedback/variants/:contentType
 * Query: { startDate?, endDate? }
 */
router.get('/variants/:contentType', async (req, res) => {
  try {
    const { contentType } = req.params;
    const { startDate, endDate } = req.query;

    const collector = getMetricsCollector();
    const metrics = await collector.getContentTypeMetrics(contentType, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    res.json({
      contentType,
      metrics,
      timeRange: {
        startDate: startDate || 'all time',
        endDate: endDate || 'now'
      }
    });
  } catch (error) {
    console.error('[Feedback] Variants error:', error.message);
    res.status(500).json({ error: 'Failed to get variant metrics' });
  }
});

// ============================================================================
// Plan 05: Production Feedback Integration - Phase 4 Endpoints
// ============================================================================

/**
 * Receive unified feedback events from client-side tracking
 *
 * POST /api/feedback/event
 * Body: FeedbackEvent schema
 */
router.post('/event', async (req, res) => {
  try {
    const event = req.body;

    // Add request metadata
    event.clientIp = req.ip;
    event.userAgent = req.headers['user-agent'];

    // Store in production feedback store
    const stored = await feedbackStore.store(event);

    // Also update metrics collector if generation exists
    if (event.generationId) {
      try {
        const collector = getMetricsCollector();
        await collector.updateFeedback(event.generationId, {
          rating: event.rating,
          thumbsUp: event.thumbsUp,
          wasEdited: event.edited,
          wasExported: event.exported,
          wasRegenerated: event.regenerated
        });
      } catch {
        // Silently ignore if generation not in metrics collector
      }
    }

    res.json({
      success: true,
      eventId: stored.eventId
    });
  } catch (error) {
    console.error('[Feedback] Event storage error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get aggregated feedback metrics for a content type
 *
 * GET /api/feedback/aggregates/:contentType
 * Query: { variant? }
 */
router.get('/aggregates/:contentType', (req, res) => {
  try {
    const { contentType } = req.params;
    const { variant } = req.query;

    if (!FEEDBACK_CONTENT_TYPES.includes(contentType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid contentType. Must be one of: ${FEEDBACK_CONTENT_TYPES.join(', ')}`
      });
    }

    const aggregates = feedbackStore.getAggregates(contentType, variant || 'default');

    if (!aggregates) {
      return res.json({
        success: true,
        data: null,
        message: 'No feedback data yet for this content type'
      });
    }

    res.json({
      success: true,
      data: aggregates
    });
  } catch (error) {
    console.error('[Feedback] Aggregates error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get aggregates'
    });
  }
});

/**
 * Get all events for a specific generation
 *
 * GET /api/feedback/generation/:generationId/events
 */
router.get('/generation/:generationId/events', (req, res) => {
  try {
    const { generationId } = req.params;
    const events = feedbackStore.getEventsForGeneration(generationId);

    res.json({
      success: true,
      generationId,
      eventCount: events.length,
      events
    });
  } catch (error) {
    console.error('[Feedback] Generation events error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get generation events'
    });
  }
});

/**
 * Export feedback events for training
 *
 * GET /api/feedback/export
 * Query: { minRating?, contentType?, since?, hasExplicitFeedback?, limit? }
 */
router.get('/export', (req, res) => {
  try {
    const options = {
      minRating: req.query.minRating ? parseInt(req.query.minRating, 10) : undefined,
      contentType: req.query.contentType,
      sinceDate: req.query.since,
      hasExplicitFeedback: req.query.hasExplicitFeedback === 'true',
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined
    };

    const events = feedbackStore.exportForTraining(options);

    res.json({
      success: true,
      count: events.length,
      filters: options,
      events
    });
  } catch (error) {
    console.error('[Feedback] Export error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to export feedback'
    });
  }
});

/**
 * Get production feedback statistics dashboard
 *
 * GET /api/feedback/dashboard
 */
router.get('/dashboard', (req, res) => {
  try {
    const stats = feedbackStore.getStats();
    const recentEvents = feedbackStore.getRecentEvents(10);

    // Get aggregates for all content types
    const contentTypeAggregates = {};
    for (const contentType of FEEDBACK_CONTENT_TYPES) {
      contentTypeAggregates[contentType] = feedbackStore.getAggregates(contentType, 'default');
    }

    res.json({
      success: true,
      stats,
      contentTypeAggregates,
      recentEvents
    });
  } catch (error) {
    console.error('[Feedback] Dashboard error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
});

/**
 * Validate feedback event without storing
 *
 * POST /api/feedback/validate
 * Body: FeedbackEvent
 */
router.post('/validate', (req, res) => {
  try {
    const event = req.body;
    const validation = FeedbackEventValidation.validate(event);

    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    });
  } catch (error) {
    console.error('[Feedback] Validation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
});

export default router;
