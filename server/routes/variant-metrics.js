/**
 * Variant Metrics API Routes
 *
 * Gap 05: Exposes variant performance metrics via REST API.
 *
 * Endpoints:
 * - GET /top           - Get top performing variants
 * - GET /underperformers - Get worst performing variants
 * - GET /trend/:id     - Get performance trend for a variant
 * - GET /compare       - Compare two variants
 * - GET /rank/:id      - Get variant's rank
 * - GET /summary       - Get metrics summary
 * - POST /record       - Record a variant score (internal use)
 */

import express from 'express';
import { variantMetrics } from '../redis/variant-metrics.js';

const router = express.Router();

/**
 * GET /api/variants/top
 * Get top performing variants
 *
 * Query params:
 * - limit: Number of variants (default: 10, max: 100)
 * - contentType: Filter by content type (optional)
 */
router.get('/top', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const contentType = req.query.contentType || null;

    const variants = await variantMetrics.getTopVariants(limit, contentType);

    res.json({
      success: true,
      variants,
      count: variants.length,
      query: { limit, contentType }
    });

  } catch (error) {
    console.error('[VariantMetrics] Error getting top variants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get top variants'
    });
  }
});

/**
 * GET /api/variants/underperformers
 * Get worst performing variants (candidates for retirement)
 *
 * Query params:
 * - limit: Number of variants (default: 10, max: 50)
 * - minSamples: Minimum sample count required (default: 10)
 */
router.get('/underperformers', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const minSamples = parseInt(req.query.minSamples) || 10;

    const variants = await variantMetrics.getUnderperformers(limit, minSamples);

    res.json({
      success: true,
      variants,
      count: variants.length,
      query: { limit, minSamples }
    });

  } catch (error) {
    console.error('[VariantMetrics] Error getting underperformers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get underperformers'
    });
  }
});

/**
 * GET /api/variants/trend/:variantId
 * Get recent performance trend for a variant
 *
 * Query params:
 * - hours: Time window in hours (default: 1, max: 168 = 1 week)
 */
router.get('/trend/:variantId', async (req, res) => {
  try {
    const { variantId } = req.params;
    const hours = Math.min(parseInt(req.query.hours) || 1, 168);
    const windowMs = hours * 3600000;

    const trend = await variantMetrics.getRecentTrend(variantId, windowMs);

    if (!trend) {
      return res.status(404).json({
        success: false,
        error: 'Variant not found or no data available'
      });
    }

    res.json({
      success: true,
      ...trend,
      query: { hours, windowMs }
    });

  } catch (error) {
    console.error('[VariantMetrics] Error getting trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trend'
    });
  }
});

/**
 * GET /api/variants/compare
 * Compare two variants head-to-head
 *
 * Query params:
 * - a: First variant ID (required)
 * - b: Second variant ID (required)
 */
router.get('/compare', async (req, res) => {
  try {
    const { a, b } = req.query;

    if (!a || !b) {
      return res.status(400).json({
        success: false,
        error: 'Both variant IDs (a and b) are required'
      });
    }

    const comparison = await variantMetrics.compareVariants(a, b);

    if (!comparison) {
      return res.status(404).json({
        success: false,
        error: 'Failed to compare variants'
      });
    }

    res.json({
      success: true,
      ...comparison
    });

  } catch (error) {
    console.error('[VariantMetrics] Error comparing variants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare variants'
    });
  }
});

/**
 * GET /api/variants/rank/:variantId
 * Get a variant's rank (1 = highest score)
 */
router.get('/rank/:variantId', async (req, res) => {
  try {
    const { variantId } = req.params;

    const rank = await variantMetrics.getVariantRank(variantId);

    if (rank === null) {
      return res.status(404).json({
        success: false,
        error: 'Variant not found'
      });
    }

    res.json({
      success: true,
      variantId,
      rank
    });

  } catch (error) {
    console.error('[VariantMetrics] Error getting rank:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rank'
    });
  }
});

/**
 * GET /api/variants/summary
 * Get overall metrics summary
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await variantMetrics.getSummary();

    if (!summary) {
      return res.status(503).json({
        success: false,
        error: 'Redis not available'
      });
    }

    res.json({
      success: true,
      ...summary
    });

  } catch (error) {
    console.error('[VariantMetrics] Error getting summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get summary'
    });
  }
});

/**
 * POST /api/variants/record
 * Record a variant performance score (internal use)
 *
 * Body:
 * - variantId: Variant identifier (required)
 * - score: Quality score 0-5 (required)
 * - contentType: Content type (optional)
 */
router.post('/record', async (req, res) => {
  try {
    const { variantId, score, contentType } = req.body;

    if (!variantId) {
      return res.status(400).json({
        success: false,
        error: 'variantId is required'
      });
    }

    if (typeof score !== 'number' || score < 0 || score > 5) {
      return res.status(400).json({
        success: false,
        error: 'score must be a number between 0 and 5'
      });
    }

    await variantMetrics.recordScore(variantId, score, contentType);

    res.json({
      success: true,
      recorded: { variantId, score, contentType }
    });

  } catch (error) {
    console.error('[VariantMetrics] Error recording score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record score'
    });
  }
});

/**
 * DELETE /api/variants/clear
 * Clear all variant metrics (admin only, use with caution)
 */
router.delete('/clear', async (req, res) => {
  try {
    // Add authentication check here in production
    const confirm = req.query.confirm === 'true';

    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: 'Add ?confirm=true to confirm clearing all metrics'
      });
    }

    await variantMetrics.clearAll();

    res.json({
      success: true,
      message: 'All variant metrics cleared'
    });

  } catch (error) {
    console.error('[VariantMetrics] Error clearing metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear metrics'
    });
  }
});

export default router;
