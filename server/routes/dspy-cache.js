/**
 * DSPy Cache Management API Routes
 *
 * Plan 09: REST API endpoints for cache management and monitoring
 *
 * Endpoints:
 * - GET /api/cache/dspy/stats - Get cache statistics
 * - GET /api/cache/dspy/stats/:signatureType - Get stats for specific type
 * - DELETE /api/cache/dspy/invalidate - Invalidate cache entries
 * - GET /api/cache/dspy/health - Cache health check
 */

import express from 'express';
import { dspyCache, SIGNATURE_TYPES } from '../redis/dspy-cache.js';

const router = express.Router();

/**
 * GET /api/cache/dspy/stats
 * Get overall cache statistics
 */
router.get('/stats', async (req, res) => {
  const { signatureType } = req.query;

  // Validate signature type if provided
  if (signatureType && !SIGNATURE_TYPES.includes(signatureType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid signatureType. Must be one of: ${SIGNATURE_TYPES.join(', ')}`
    });
  }

  try {
    const stats = await dspyCache.getStats(signatureType || null);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cache/dspy/stats/:signatureType
 * Get statistics for specific signature type
 */
router.get('/stats/:signatureType', async (req, res) => {
  const { signatureType } = req.params;

  if (!SIGNATURE_TYPES.includes(signatureType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid signatureType. Must be one of: ${SIGNATURE_TYPES.join(', ')}`
    });
  }

  try {
    const stats = await dspyCache.getStats(signatureType);

    res.json({
      success: true,
      signatureType,
      timestamp: new Date().toISOString(),
      stats: {
        ...stats,
        signatureMetrics: stats.bySignature[signatureType]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/cache/dspy/invalidate
 * Invalidate cache entries
 *
 * Query params:
 * - signatureType: Filter by type (optional)
 * - key: Specific key to invalidate (optional)
 */
router.delete('/invalidate', async (req, res) => {
  const { signatureType, key } = req.query;

  // Validate signature type if provided
  if (signatureType && !SIGNATURE_TYPES.includes(signatureType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid signatureType. Must be one of: ${SIGNATURE_TYPES.join(', ')}`
    });
  }

  try {
    const count = await dspyCache.invalidate(signatureType || null, key || null);

    res.json({
      success: true,
      message: `Invalidated ${count} cache entries`,
      invalidated: count,
      filter: {
        signatureType: signatureType || 'all',
        key: key || null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cache/dspy/health
 * Cache health check
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await dspyCache.getStats();

    const health = {
      status: stats.connected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      redis: stats.connected,
      metrics: {
        hitRate: stats.hitRate,
        totalHits: stats.totalHits,
        totalMisses: stats.totalMisses,
        totalSets: stats.totalSets,
        errors: stats.errors
      }
    };

    if (stats.totalEntries !== undefined) {
      health.metrics.totalEntries = stats.totalEntries;
    }

    if (stats.estimatedSavings) {
      health.metrics.estimatedSavingsUSD = stats.estimatedSavings.estimatedUSD;
      health.metrics.callsAvoided = stats.estimatedSavings.callsAvoided;
    }

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/cache/dspy/types
 * Get available signature types
 */
router.get('/types', (req, res) => {
  res.json({
    success: true,
    signatureTypes: SIGNATURE_TYPES,
    descriptions: {
      'roadmap': 'Gantt chart roadmap generation',
      'slides': 'Presentation slides generation',
      'document': 'Document generation',
      'research-analysis': 'Research file analysis'
    }
  });
});

/**
 * POST /api/cache/dspy/reset-metrics
 * Reset cache metrics (for testing/debugging)
 */
router.post('/reset-metrics', (req, res) => {
  // Only allow in non-production
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Metrics reset not allowed in production'
    });
  }

  dspyCache.resetMetrics();

  res.json({
    success: true,
    message: 'Cache metrics reset'
  });
});

export default router;
