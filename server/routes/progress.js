/**
 * Map-Reduce Progress and Metrics Routes
 * 
 * Phase 4: SSE endpoints for real-time progress updates
 * Phase 6: Metrics and monitoring endpoints
 * 
 * Endpoints:
 * - GET /api/progress/:sessionId - SSE stream for progress updates
 * - GET /api/progress/stats - Get progress streaming statistics
 * - GET /api/progress/metrics - Get map-reduce processing metrics
 * - GET /api/progress/performance - Get performance summary
 */

import express from 'express';
import {
  progressStreamHandler,
  getProgressStreamStats
} from '../utils/progressStreamer.js';
import { getInsightCacheMetrics } from '../cache/insightCache.js';
import {
  getMapReduceMetrics,
  getRequestHistory,
  getPerformanceSummary
} from '../utils/mapReduceMetrics.js';

const router = express.Router();

// ============================================================================
// SSE PROGRESS ENDPOINT
// ============================================================================

/**
 * GET /api/progress/:sessionId
 * 
 * Server-Sent Events endpoint for receiving real-time progress updates
 * during map-reduce processing.
 * 
 * The client should connect to this endpoint before starting a generation
 * that uses map-reduce (large research content). Progress events will be
 * pushed as the processing proceeds.
 * 
 * Event types:
 * - connected: Connection established
 * - progress: Processing progress update
 * - complete: Processing finished
 * - error: An error occurred
 * 
 * Example client usage:
 *   const source = new EventSource('/api/progress/session123');
 *   source.addEventListener('progress', (e) => {
 *     const data = JSON.parse(e.data);
 *     console.log(`${data.phase}: ${data.percentage}%`);
 *   });
 */
router.get('/:sessionId', progressStreamHandler);

// ============================================================================
// STATS ENDPOINTS
// ============================================================================

/**
 * GET /api/progress/stats
 * 
 * Get statistics about active progress streaming sessions
 * and insight cache performance.
 */
router.get('/stats', (req, res) => {
  try {
    const progressStats = getProgressStreamStats();
    const cacheStats = getInsightCacheMetrics();
    
    res.json({
      success: true,
      data: {
        progress: progressStats,
        cache: cacheStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// METRICS ENDPOINTS (Phase 6)
// ============================================================================

/**
 * GET /api/progress/metrics
 * 
 * Get aggregated map-reduce processing metrics.
 * Includes request counts, timing averages, cache performance, and error rates.
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = getMapReduceMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/progress/performance
 * 
 * Get performance comparison between direct and map-reduce processing.
 */
router.get('/performance', (req, res) => {
  try {
    const performance = getPerformanceSummary();
    
    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/progress/history
 * 
 * Get recent request history with optional filters.
 * Query params: limit, strategy, contentType, errorsOnly
 */
router.get('/history', (req, res) => {
  try {
    const { limit, strategy, contentType, errorsOnly } = req.query;
    
    const history = getRequestHistory({
      limit: limit ? parseInt(limit, 10) : 50,
      strategy: strategy || null,
      contentType: contentType || null,
      errorsOnly: errorsOnly === 'true'
    });
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
