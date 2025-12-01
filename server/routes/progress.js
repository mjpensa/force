/**
 * Map-Reduce Progress Routes
 * 
 * Phase 4 Optimization: SSE endpoints for real-time progress updates
 * during map-reduce research processing.
 * 
 * Endpoints:
 * - GET /api/progress/:sessionId - SSE stream for progress updates
 * - GET /api/progress/stats - Get progress streaming statistics
 */

import express from 'express';
import {
  progressStreamHandler,
  getProgressStreamStats
} from '../utils/progressStreamer.js';
import { getInsightCacheMetrics } from '../cache/insightCache.js';

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

export default router;
