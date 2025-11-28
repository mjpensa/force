/**
 * Feedback API Routes - Auto-Improving Prompts Phase 1
 *
 * API endpoints for collecting user feedback on generated content.
 * Feedback is used for A/B testing and automatic prompt optimization.
 */

import { Router } from 'express';
import { getMetricsCollector, FeedbackType } from '../layers/optimization/metrics/index.js';

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

export default router;
