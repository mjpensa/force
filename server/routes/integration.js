/**
 * Integration API Routes
 *
 * Gap 06-12: Exposes DSPy integration, training metrics, and variant analysis.
 *
 * Endpoints:
 *   GET  /api/integration/status        - Overall integration status
 *   GET  /api/integration/dspy          - DSPy service status and optimization info
 *   GET  /api/integration/metrics       - Training metrics and analytics
 *   GET  /api/integration/variants      - Variant performance analysis
 *   POST /api/integration/optimize      - Trigger manual DSPy optimization
 */

import express from 'express';
import { dspyIntegration } from '../utils/dspyIntegration.js';
import { trainingEvents } from '../utils/trainingEvents.js';
import { variantMetrics } from '../redis/variant-metrics.js';
import { eventStream } from '../redis/event-stream.js';

const router = express.Router();

/**
 * GET /api/integration/status
 * Get overall integration status
 */
router.get('/status', async (req, res) => {
  try {
    const [dspyStatus, streamInfo] = await Promise.all([
      dspyIntegration.getStatus(),
      eventStream.getAllStreamInfo()
    ]);

    res.json({
      status: 'ok',
      integrations: {
        dspy: {
          serviceAvailable: dspyStatus.serviceAvailable,
          redisAvailable: dspyStatus.redisAvailable,
          signaturesConfigured: Object.keys(dspyStatus.signatures || {}).length
        },
        redis: {
          eventStreams: streamInfo,
          variantMetrics: await variantMetrics.getSummary()
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get integration status',
      message: error.message
    });
  }
});

/**
 * GET /api/integration/dspy
 * Get detailed DSPy integration status
 */
router.get('/dspy', async (req, res) => {
  try {
    const status = await dspyIntegration.getStatus();

    res.json({
      serviceAvailable: status.serviceAvailable,
      redisAvailable: status.redisAvailable,
      signatures: status.signatures,
      optimizationConfig: dspyIntegration.OPTIMIZATION_CONFIG,
      signatureTypes: dspyIntegration.SIGNATURE_TYPES
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get DSPy status',
      message: error.message
    });
  }
});

/**
 * GET /api/integration/dspy/examples/:signatureType
 * Get training examples for a signature type
 */
router.get('/dspy/examples/:signatureType', async (req, res) => {
  const { signatureType } = req.params;
  const limit = parseInt(req.query.limit) || 20;

  try {
    if (!dspyIntegration.SIGNATURE_TYPES.includes(signatureType)) {
      return res.status(400).json({
        error: 'Invalid signature type',
        validTypes: dspyIntegration.SIGNATURE_TYPES
      });
    }

    const examples = await dspyIntegration.getTrainingExamples(signatureType, limit);

    res.json({
      signatureType,
      count: examples.length,
      examples: examples.map(e => ({
        prompt: e.user_prompt?.slice(0, 100) + '...',
        qualityScore: e.quality_score,
        recordedAt: e.metadata?.recordedAt
          ? new Date(e.metadata.recordedAt).toISOString()
          : null
      }))
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get training examples',
      message: error.message
    });
  }
});

/**
 * POST /api/integration/dspy/optimize/:signatureType
 * Trigger manual DSPy optimization for a signature type
 */
router.post('/dspy/optimize/:signatureType', async (req, res) => {
  const secret = req.body.secret || req.query.secret;
  const expectedSecret = process.env.TRAIN_SECRET || 'train123';

  if (secret !== expectedSecret) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing secret.'
    });
  }

  const { signatureType } = req.params;
  const optimizer = req.body.optimizer || 'bootstrap';

  try {
    if (!dspyIntegration.SIGNATURE_TYPES.includes(signatureType)) {
      return res.status(400).json({
        error: 'Invalid signature type',
        validTypes: dspyIntegration.SIGNATURE_TYPES
      });
    }

    // Start optimization
    const result = await dspyIntegration.optimize(signatureType, { optimizer });

    res.json({
      signatureType,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Optimization failed',
      message: error.message
    });
  }
});

/**
 * GET /api/integration/metrics
 * Get training metrics and analytics
 */
router.get('/metrics', async (req, res) => {
  const sinceHours = parseInt(req.query.hours) || 24;
  const sinceMs = sinceHours * 3600000;

  try {
    const metrics = await trainingEvents.getTrainingMetrics({ sinceMs });

    res.json({
      period: {
        hours: sinceHours,
        ...metrics.period
      },
      sessions: metrics.sessions,
      generations: metrics.generations,
      cache: metrics.cache,
      evolution: metrics.evolution,
      variants: metrics.variants
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/integration/metrics/session/:sessionId
 * Get events for a specific training session
 */
router.get('/metrics/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const limit = parseInt(req.query.limit) || 100;

  try {
    const events = await trainingEvents.getSessionEvents(sessionId, { limit });

    res.json({
      sessionId,
      eventCount: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get session events',
      message: error.message
    });
  }
});

/**
 * GET /api/integration/variants
 * Get variant performance analysis
 */
router.get('/variants', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const contentType = req.query.contentType || null;

  try {
    const [topVariants, underperformers, summary] = await Promise.all([
      variantMetrics.getTopVariants(limit, contentType),
      variantMetrics.getUnderperformers(5, 10),
      variantMetrics.getSummary()
    ]);

    res.json({
      summary,
      topVariants,
      underperformers,
      contentTypeFilter: contentType
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get variant analysis',
      message: error.message
    });
  }
});

/**
 * GET /api/integration/variants/:variantId
 * Get details for a specific variant
 */
router.get('/variants/:variantId', async (req, res) => {
  const { variantId } = req.params;

  try {
    const [rank, trend] = await Promise.all([
      variantMetrics.getVariantRank(variantId),
      variantMetrics.getRecentTrend(variantId)
    ]);

    res.json({
      variantId,
      rank,
      trend
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get variant details',
      message: error.message
    });
  }
});

/**
 * GET /api/integration/variants/compare
 * Compare two variants head-to-head
 */
router.get('/variants/compare', async (req, res) => {
  const { a, b } = req.query;

  if (!a || !b) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'Provide both ?a=variantA&b=variantB'
    });
  }

  try {
    const comparison = await variantMetrics.compareVariants(a, b);

    if (!comparison) {
      return res.status(404).json({
        error: 'Variants not found',
        message: 'One or both variants have no recorded metrics'
      });
    }

    res.json(comparison);
  } catch (error) {
    res.status(500).json({
      error: 'Comparison failed',
      message: error.message
    });
  }
});

/**
 * GET /api/integration/events/:streamType
 * Get recent events from a specific stream
 */
router.get('/events/:streamType', async (req, res) => {
  const { streamType } = req.params;
  const limit = parseInt(req.query.limit) || 50;

  const validStreams = ['training', 'generation', 'evolution', 'errors'];
  if (!validStreams.includes(streamType)) {
    return res.status(400).json({
      error: 'Invalid stream type',
      validTypes: validStreams
    });
  }

  try {
    const events = await eventStream.getLatestEvents(streamType, limit);

    res.json({
      streamType,
      count: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get events',
      message: error.message
    });
  }
});

export default router;
