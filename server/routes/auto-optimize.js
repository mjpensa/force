/**
 * Auto-Optimization API Routes - Phase 5
 *
 * Provides REST API endpoints for the auto-improving prompts system.
 *
 * Endpoints:
 *   GET  /api/auto-optimize/dashboard     - Full dashboard data
 *   GET  /api/auto-optimize/summary       - Summary statistics
 *   GET  /api/auto-optimize/insights      - Active insights
 *   GET  /api/auto-optimize/recommendations - Recommendations
 *   GET  /api/auto-optimize/variants      - Variant performance
 *   GET  /api/auto-optimize/variants/:contentType - Variant by type
 *   GET  /api/auto-optimize/experiments   - Experiment status
 *   GET  /api/auto-optimize/evolution     - Evolution status
 *   POST /api/auto-optimize/evolution/start - Start scheduler
 *   POST /api/auto-optimize/evolution/stop  - Stop scheduler
 *   POST /api/auto-optimize/evolution/run   - Run single cycle
 *   POST /api/auto-optimize/experiments/start - Start experiment
 *   POST /api/auto-optimize/experiments/:id/conclude - Conclude experiment
 *   POST /api/auto-optimize/variants/generate - Generate variant
 */

import express from 'express';
import {
  getDashboardData,
  getDashboardSummary,
  getInsights,
  getRecommendations,
  getVariantPerformance,
  getExperimentStatus,
  getEvolutionStatus,
  getTrends,
  TimePeriod
} from '../layers/optimization/dashboard/index.js';
import {
  startEvolution,
  stopEvolution,
  runOptimizationCycle,
  generateVariant,
  getMutationStrategies
} from '../layers/optimization/evolution/index.js';
import {
  startExperiment,
  concludeExperiment
} from '../layers/optimization/experiments/index.js';

const router = express.Router();

// ============================================================================
// DASHBOARD ENDPOINTS
// ============================================================================

/**
 * GET /api/auto-optimize/dashboard
 * Get full dashboard data
 */
router.get('/dashboard', (req, res) => {
  try {
    const period = req.query.period || TimePeriod.LAST_24H;
    const data = getDashboardData({ period });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auto-optimize/summary
 * Get summary statistics
 */
router.get('/summary', (req, res) => {
  try {
    const data = getDashboardSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auto-optimize/insights
 * Get active insights
 */
router.get('/insights', (req, res) => {
  try {
    const insights = getInsights();
    res.json({ success: true, data: insights });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auto-optimize/recommendations
 * Get recommendations
 */
router.get('/recommendations', (req, res) => {
  try {
    const recommendations = getRecommendations();
    res.json({ success: true, data: recommendations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// VARIANT ENDPOINTS
// ============================================================================

/**
 * GET /api/auto-optimize/variants
 * Get all variant performance data
 */
router.get('/variants', (req, res) => {
  try {
    const data = getVariantPerformance();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auto-optimize/variants/:contentType
 * Get variant performance for specific content type
 */
router.get('/variants/:contentType', (req, res) => {
  try {
    const { contentType } = req.params;
    const data = getVariantPerformance(contentType);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auto-optimize/variants/generate
 * Generate a new variant
 */
router.post('/variants/generate', async (req, res) => {
  try {
    const { contentType, strategy } = req.body;

    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: 'contentType is required'
      });
    }

    const variant = await generateVariant(contentType, { strategy });
    res.json({ success: true, data: variant });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auto-optimize/mutation-strategies
 * Get available mutation strategies
 */
router.get('/mutation-strategies', (req, res) => {
  try {
    const strategies = getMutationStrategies();
    res.json({ success: true, data: strategies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// EXPERIMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/auto-optimize/experiments
 * Get experiment status
 */
router.get('/experiments', (req, res) => {
  try {
    const data = getExperimentStatus();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auto-optimize/experiments/start
 * Start a new experiment
 */
router.post('/experiments/start', (req, res) => {
  try {
    const { contentType, name, hypothesis, trafficSplit } = req.body;

    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: 'contentType is required'
      });
    }

    const experiment = startExperiment(contentType, {
      name,
      hypothesis,
      trafficSplit
    });

    res.json({ success: true, data: experiment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auto-optimize/experiments/:id/conclude
 * Conclude an experiment
 */
router.post('/experiments/:id/conclude', (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const conclusion = concludeExperiment(id, { reason });
    res.json({ success: true, data: conclusion });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// EVOLUTION ENDPOINTS
// ============================================================================

/**
 * GET /api/auto-optimize/evolution
 * Get evolution status
 */
router.get('/evolution', (req, res) => {
  try {
    const data = getEvolutionStatus();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auto-optimize/evolution/start
 * Start the evolution scheduler
 */
router.post('/evolution/start', (req, res) => {
  try {
    const config = req.body || {};
    const result = startEvolution(config);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auto-optimize/evolution/stop
 * Stop the evolution scheduler
 */
router.post('/evolution/stop', (req, res) => {
  try {
    stopEvolution();
    res.json({ success: true, message: 'Evolution scheduler stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auto-optimize/evolution/run
 * Run a single optimization cycle
 */
router.post('/evolution/run', async (req, res) => {
  try {
    const result = await runOptimizationCycle();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// TREND ENDPOINTS
// ============================================================================

/**
 * GET /api/auto-optimize/trends/:contentType
 * Get trend data for content type
 */
router.get('/trends/:contentType', (req, res) => {
  try {
    const { contentType } = req.params;
    const period = req.query.period || TimePeriod.LAST_7D;
    const data = getTrends(contentType, period);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
