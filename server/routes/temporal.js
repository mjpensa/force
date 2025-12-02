/**
 * Temporal API Routes
 *
 * REST API endpoints for accessing temporal data, trend analysis,
 * anomaly detection, and prompt impact tracking.
 *
 * Implementation of Plan 07: Temporal Performance Tracking - Phase 5
 */

import express from 'express';
import { temporalStore } from '../utils/temporalStorage.js';
import { trendAnalyzer } from '../utils/trendAnalysis.js';
import { anomalyDetector } from '../utils/anomalyDetection.js';
import { promptImpactTracker } from '../utils/promptImpactTracker.js';

const router = express.Router();

// ============================================================================
// Time-Series Data Endpoints
// ============================================================================

/**
 * Get time-series data for a content type
 * GET /temporal/series/:contentType
 */
router.get('/series/:contentType', (req, res) => {
  try {
    const { contentType } = req.params;
    const { variant, hours = 24, aggregation = 'raw' } = req.query;

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - parseInt(hours));

    const points = (temporalStore.indexByType[contentType] || [])
      .filter(dp =>
        (!variant || dp.variant === variant) &&
        new Date(dp.timestamp) >= cutoff
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let series = points.map(dp => ({
      timestamp: dp.timestamp,
      qualityScore: dp.qualityScore,
      variant: dp.variant,
      id: dp.id
    }));

    if (aggregation === 'hourly') {
      series = aggregateByHour(points);
    } else if (aggregation === 'daily') {
      series = aggregateByDay(points);
    }

    res.json({
      success: true,
      contentType,
      variant: variant || 'all',
      hours: parseInt(hours),
      aggregation,
      dataPoints: series.length,
      series
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Record a data point
 * POST /temporal/record
 */
router.post('/record', (req, res) => {
  try {
    const { contentType, variant, qualityScore, ...rest } = req.body;

    if (!contentType || qualityScore === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: contentType, qualityScore'
      });
    }

    const dataPoint = temporalStore.record({
      contentType,
      variant,
      qualityScore,
      ...rest
    });

    // Check for anomalies
    const anomalies = anomalyDetector.checkDataPoint(dataPoint);

    res.json({
      success: true,
      dataPoint,
      anomalies
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get storage statistics
 * GET /temporal/stats
 */
router.get('/stats', (req, res) => {
  try {
    const stats = temporalStore.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Trend Analysis Endpoints
// ============================================================================

/**
 * Get trend analysis for a content type
 * GET /temporal/trend/:contentType
 */
router.get('/trend/:contentType', (req, res) => {
  try {
    const { contentType } = req.params;
    const { variant = 'champion', days = 7 } = req.query;

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(days));

    const analysis = trendAnalyzer.analyzeTrend(contentType, variant, { start, end });

    res.json({ success: true, ...analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Compare trends between variants
 * GET /temporal/trend/:contentType/compare
 */
router.get('/trend/:contentType/compare', (req, res) => {
  try {
    const { contentType } = req.params;
    const { variant1 = 'champion', variant2 = 'candidate', days = 7 } = req.query;

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(days));

    const comparison = trendAnalyzer.compareTrends(
      contentType,
      variant1,
      variant2,
      { start, end }
    );

    res.json({ success: true, ...comparison });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get forecast for a content type
 * GET /temporal/forecast/:contentType
 */
router.get('/forecast/:contentType', (req, res) => {
  try {
    const { contentType } = req.params;
    const { variant = 'champion', periods = 5 } = req.query;

    const forecast = trendAnalyzer.forecast(contentType, variant, parseInt(periods));

    res.json({ success: true, ...forecast });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Anomaly Detection Endpoints
// ============================================================================

/**
 * Get recent anomalies
 * GET /temporal/anomalies
 */
router.get('/anomalies', (req, res) => {
  try {
    const { contentType, severity, type, limit = 50 } = req.query;

    const filters = { limit: parseInt(limit) };
    if (contentType) filters.contentType = contentType;
    if (severity) filters.severity = severity;
    if (type) filters.type = type;

    const alerts = anomalyDetector.getAlerts(filters);

    res.json({
      success: true,
      alertCount: alerts.length,
      alerts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Check for distribution shift
 * GET /temporal/distribution-shift/:contentType
 */
router.get('/distribution-shift/:contentType', (req, res) => {
  try {
    const { contentType } = req.params;
    const { variant = 'champion', hours = 6 } = req.query;

    const result = anomalyDetector.detectDistributionShift(
      contentType,
      variant,
      parseInt(hours)
    );

    if (!result) {
      return res.json({
        success: true,
        status: 'insufficient_data',
        message: 'Not enough data for distribution shift analysis'
      });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get anomaly detection summary
 * GET /temporal/anomalies/summary
 */
router.get('/anomalies/summary', (req, res) => {
  try {
    const summary = anomalyDetector.getSummary();
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Prompt Impact Tracking Endpoints
// ============================================================================

/**
 * Get prompt change history
 * GET /temporal/prompt-changes
 */
router.get('/prompt-changes', (req, res) => {
  try {
    const { contentType } = req.query;
    const changes = promptImpactTracker.getPromptChangeHistory(contentType);

    res.json({
      success: true,
      changeCount: changes.length,
      changes
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Record a prompt change
 * POST /temporal/prompt-changes
 */
router.post('/prompt-changes', (req, res) => {
  try {
    const { contentType, oldVersion, newVersion, metadata } = req.body;

    if (!contentType || !oldVersion || !newVersion) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: contentType, oldVersion, newVersion'
      });
    }

    const change = promptImpactTracker.recordPromptChange(
      contentType,
      oldVersion,
      newVersion,
      metadata || {}
    );

    res.json({ success: true, change });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Analyze prompt change impact
 * GET /temporal/prompt-changes/:changeId/impact
 */
router.get('/prompt-changes/:changeId/impact', (req, res) => {
  try {
    const { changeId } = req.params;
    const { hours = 24 } = req.query;

    const impact = promptImpactTracker.analyzePromptChangeImpact(changeId, parseInt(hours));

    if (!impact) {
      return res.status(404).json({ success: false, error: 'Change not found' });
    }

    res.json({ success: true, ...impact });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Analyze all pending impacts
 * POST /temporal/prompt-changes/analyze-pending
 */
router.post('/prompt-changes/analyze-pending', (req, res) => {
  try {
    const { hours = 24 } = req.body;

    const analyzed = promptImpactTracker.analyzeAllPendingImpacts(parseInt(hours));

    res.json({
      success: true,
      analyzedCount: analyzed.length,
      impacts: analyzed
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get prompt impact summary
 * GET /temporal/prompt-changes/summary
 */
router.get('/prompt-changes/summary', (req, res) => {
  try {
    const summary = promptImpactTracker.getSummary();
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Dashboard Endpoint
// ============================================================================

/**
 * Get comprehensive dashboard summary
 * GET /temporal/dashboard
 */
router.get('/dashboard', (req, res) => {
  try {
    const contentTypes = ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];
    const summary = {
      timestamp: new Date().toISOString(),
      storage: temporalStore.getStats(),
      byContentType: {},
      anomalySummary: anomalyDetector.getSummary(),
      promptImpactSummary: promptImpactTracker.getSummary()
    };

    for (const contentType of contentTypes) {
      const last24h = trendAnalyzer.analyzeTrend(contentType, 'champion', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      const distributionShift = anomalyDetector.detectDistributionShift(contentType, 'champion');

      summary.byContentType[contentType] = {
        dataPoints: last24h.dataPoints || 0,
        trend: last24h.status === 'analyzed' ? {
          direction: last24h.trend?.direction,
          strength: last24h.trend?.strength,
          rSquared: last24h.trend?.rSquared
        } : null,
        statistics: last24h.statistics || null,
        weekOverWeek: last24h.weekOverWeek || null,
        distributionShift: distributionShift || null
      };
    }

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Aggregate data points by hour
 *
 * @param {Array<Object>} points - Data points
 * @returns {Array<Object>} Hourly aggregates
 */
function aggregateByHour(points) {
  const byHour = {};

  for (const dp of points) {
    const hourKey = temporalStore.getHourKey(dp.timestamp);
    if (!byHour[hourKey]) {
      byHour[hourKey] = { scores: [], timestamp: dp.timestamp };
    }
    byHour[hourKey].scores.push(dp.qualityScore);
  }

  return Object.entries(byHour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => ({
      hour: key,
      avgScore: mean(data.scores),
      count: data.scores.length,
      min: Math.min(...data.scores),
      max: Math.max(...data.scores)
    }));
}

/**
 * Aggregate data points by day
 *
 * @param {Array<Object>} points - Data points
 * @returns {Array<Object>} Daily aggregates
 */
function aggregateByDay(points) {
  const byDay = {};

  for (const dp of points) {
    const dayKey = temporalStore.getDayKey(dp.timestamp);
    if (!byDay[dayKey]) {
      byDay[dayKey] = { scores: [], timestamp: dp.timestamp };
    }
    byDay[dayKey].scores.push(dp.qualityScore);
  }

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => ({
      day: key,
      avgScore: mean(data.scores),
      count: data.scores.length,
      min: Math.min(...data.scores),
      max: Math.max(...data.scores)
    }));
}

/**
 * Calculate mean of an array
 *
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Mean value
 */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export default router;

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 5 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase5() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: Router is valid express router
  results.tests.push({
    name: 'Router is valid',
    passed: router !== undefined && typeof router.get === 'function',
    details: `type=${typeof router}`
  });

  // Test 2: Has series endpoint
  const hasSeriesRoute = router.stack.some(layer =>
    layer.route && layer.route.path === '/series/:contentType'
  );
  results.tests.push({
    name: 'Has series endpoint',
    passed: hasSeriesRoute,
    details: `found=${hasSeriesRoute}`
  });

  // Test 3: Has trend endpoint
  const hasTrendRoute = router.stack.some(layer =>
    layer.route && layer.route.path === '/trend/:contentType'
  );
  results.tests.push({
    name: 'Has trend endpoint',
    passed: hasTrendRoute,
    details: `found=${hasTrendRoute}`
  });

  // Test 4: Has anomalies endpoint
  const hasAnomaliesRoute = router.stack.some(layer =>
    layer.route && layer.route.path === '/anomalies'
  );
  results.tests.push({
    name: 'Has anomalies endpoint',
    passed: hasAnomaliesRoute,
    details: `found=${hasAnomaliesRoute}`
  });

  // Test 5: Has prompt-changes endpoint
  const hasPromptChangesRoute = router.stack.some(layer =>
    layer.route && layer.route.path === '/prompt-changes'
  );
  results.tests.push({
    name: 'Has prompt-changes endpoint',
    passed: hasPromptChangesRoute,
    details: `found=${hasPromptChangesRoute}`
  });

  // Test 6: Has dashboard endpoint
  const hasDashboardRoute = router.stack.some(layer =>
    layer.route && layer.route.path === '/dashboard'
  );
  results.tests.push({
    name: 'Has dashboard endpoint',
    passed: hasDashboardRoute,
    details: `found=${hasDashboardRoute}`
  });

  // Test 7: Has distribution-shift endpoint
  const hasDistShiftRoute = router.stack.some(layer =>
    layer.route && layer.route.path === '/distribution-shift/:contentType'
  );
  results.tests.push({
    name: 'Has distribution-shift endpoint',
    passed: hasDistShiftRoute,
    details: `found=${hasDistShiftRoute}`
  });

  // Test 8: Has forecast endpoint
  const hasForecastRoute = router.stack.some(layer =>
    layer.route && layer.route.path === '/forecast/:contentType'
  );
  results.tests.push({
    name: 'Has forecast endpoint',
    passed: hasForecastRoute,
    details: `found=${hasForecastRoute}`
  });

  // Test 9: Has record endpoint (POST)
  const hasRecordRoute = router.stack.some(layer =>
    layer.route && layer.route.path === '/record' && layer.route.methods.post
  );
  results.tests.push({
    name: 'Has record endpoint (POST)',
    passed: hasRecordRoute,
    details: `found=${hasRecordRoute}`
  });

  // Test 10: aggregateByHour works
  const testPoints = [
    { timestamp: '2024-03-15T10:00:00Z', qualityScore: 3.5 },
    { timestamp: '2024-03-15T10:30:00Z', qualityScore: 3.7 },
    { timestamp: '2024-03-15T11:00:00Z', qualityScore: 3.9 }
  ];
  const hourly = aggregateByHour(testPoints);
  results.tests.push({
    name: 'aggregateByHour works',
    passed: hourly.length === 2 && hourly[0].count === 2,
    details: `hours=${hourly.length}, firstCount=${hourly[0]?.count}`
  });

  // Test 11: aggregateByDay works
  const daily = aggregateByDay(testPoints);
  results.tests.push({
    name: 'aggregateByDay works',
    passed: daily.length === 1 && daily[0].count === 3,
    details: `days=${daily.length}, count=${daily[0]?.count}`
  });

  // Test 12: mean helper works
  results.tests.push({
    name: 'mean helper works',
    passed: mean([1, 2, 3, 4, 5]) === 3,
    details: `mean([1-5])=${mean([1, 2, 3, 4, 5])}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// Development validation
if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase5();
  console.log('Temporal API Phase 5 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
