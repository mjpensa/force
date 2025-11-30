/**
 * Trend Analysis
 *
 * Algorithms for detecting trends in performance metrics over time,
 * including linear regression, moving averages, and change point detection.
 *
 * Implementation of Plan 07: Temporal Performance Tracking - Phase 2
 */

import { TemporalStore, temporalStore } from './temporalStorage.js';

// ============================================================================
// Phase 2: Trend Analysis
// ============================================================================

/**
 * TrendAnalyzer - Analyzes performance trends over time
 */
export class TrendAnalyzer {
  /**
   * Create a TrendAnalyzer
   *
   * @param {TemporalStore} store - Temporal store instance
   */
  constructor(store = temporalStore) {
    this.store = store;
  }

  /**
   * Calculate linear regression for trend detection
   *
   * @param {Array<Object>} points - Array of {timestamp, value} objects
   * @returns {Object|null} Regression results
   */
  linearRegression(points) {
    const n = points.length;
    if (n < 3) return null;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;  // Time index
      const y = points[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return null;

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // R-squared for trend strength
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;

    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * i;
      ssTotal += Math.pow(points[i].value - yMean, 2);
      ssResidual += Math.pow(points[i].value - predicted, 2);
    }

    // Handle edge case where all values are the same
    const rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);

    return {
      slope,
      intercept,
      rSquared,
      direction: slope > 0.001 ? 'improving' : slope < -0.001 ? 'declining' : 'stable',
      strength: Math.abs(rSquared) > 0.5 ? 'strong' : Math.abs(rSquared) > 0.2 ? 'moderate' : 'weak',
      predictedNext: intercept + slope * n,
      slopePerUnit: slope
    };
  }

  /**
   * Calculate moving average for smoothing
   *
   * @param {Array<Object>} points - Array of {timestamp, value} objects
   * @param {number} window - Window size
   * @returns {Array<Object>} Smoothed series
   */
  movingAverage(points, window = 5) {
    if (points.length < window) return points.map(p => ({ ...p, smoothedValue: p.value }));

    const result = [];
    for (let i = window - 1; i < points.length; i++) {
      const windowPoints = points.slice(i - window + 1, i + 1);
      const avg = windowPoints.reduce((sum, p) => sum + p.value, 0) / window;
      result.push({
        timestamp: points[i].timestamp,
        value: avg,
        originalValue: points[i].value
      });
    }

    return result;
  }

  /**
   * Calculate exponential moving average
   *
   * @param {Array<Object>} points - Array of {timestamp, value} objects
   * @param {number} alpha - Smoothing factor (0-1)
   * @returns {Array<Object>} EMA series
   */
  exponentialMovingAverage(points, alpha = 0.3) {
    if (points.length === 0) return [];

    const result = [];
    let ema = points[0].value;

    for (const point of points) {
      ema = alpha * point.value + (1 - alpha) * ema;
      result.push({
        timestamp: point.timestamp,
        value: ema,
        originalValue: point.value
      });
    }

    return result;
  }

  /**
   * Detect change points using CUSUM algorithm
   *
   * @param {Array<Object>} points - Array of {timestamp, value} objects
   * @param {number} threshold - Detection threshold (std devs)
   * @returns {Array<Object>} Detected change points
   */
  detectChangePoints(points, threshold = 2) {
    if (points.length < 10) return [];

    const values = points.map(p => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );

    if (std === 0) return [];

    // CUSUM calculation
    const cusumPos = [];
    const cusumNeg = [];
    let sPos = 0, sNeg = 0;

    for (let i = 0; i < values.length; i++) {
      const z = (values[i] - mean) / std;
      sPos = Math.max(0, sPos + z - 0.5);
      sNeg = Math.max(0, sNeg - z - 0.5);
      cusumPos.push(sPos);
      cusumNeg.push(sNeg);
    }

    // Find change points where CUSUM exceeds threshold
    const changePoints = [];
    for (let i = 1; i < values.length; i++) {
      if ((cusumPos[i] > threshold && cusumPos[i - 1] <= threshold) ||
          (cusumNeg[i] > threshold && cusumNeg[i - 1] <= threshold)) {
        changePoints.push({
          index: i,
          timestamp: points[i].timestamp,
          type: cusumPos[i] > threshold ? 'increase' : 'decrease',
          magnitude: cusumPos[i] > threshold ? cusumPos[i] : cusumNeg[i],
          value: points[i].value
        });
      }
    }

    return changePoints;
  }

  /**
   * Analyze trend for a specific content type and time range
   *
   * @param {string} contentType - Content type
   * @param {string} variant - Variant
   * @param {Object} timeRange - { start, end } Date objects
   * @returns {Object} Trend analysis results
   */
  analyzeTrend(contentType, variant, timeRange) {
    const { start, end } = timeRange;

    // Get data points in range
    const allPoints = this.store.indexByType[contentType] || [];
    const filteredPoints = allPoints.filter(dp =>
      dp.variant === variant &&
      new Date(dp.timestamp) >= new Date(start) &&
      new Date(dp.timestamp) <= new Date(end)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (filteredPoints.length < 5) {
      return { status: 'insufficient_data', dataPoints: filteredPoints.length };
    }

    // Convert to time series
    const series = filteredPoints.map(dp => ({
      timestamp: dp.timestamp,
      value: dp.qualityScore
    }));

    // Calculate analyses
    const trend = this.linearRegression(series);
    const smoothed = this.movingAverage(series, Math.min(5, Math.floor(series.length / 2)));
    const changePoints = this.detectChangePoints(series);

    // Week-over-week comparison
    const weekAgo = new Date(end);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentPoints = series.filter(s => new Date(s.timestamp) >= weekAgo);
    const olderPoints = series.filter(s =>
      new Date(s.timestamp) < weekAgo &&
      new Date(s.timestamp) >= new Date(start)
    );

    let weekOverWeek = null;
    if (recentPoints.length >= 5 && olderPoints.length >= 5) {
      const recentAvg = recentPoints.reduce((s, p) => s + p.value, 0) / recentPoints.length;
      const olderAvg = olderPoints.reduce((s, p) => s + p.value, 0) / olderPoints.length;
      const changePercent = olderAvg !== 0 ? ((recentAvg - olderAvg) / olderAvg * 100) : 0;
      weekOverWeek = {
        recentAvg: parseFloat(recentAvg.toFixed(3)),
        previousAvg: parseFloat(olderAvg.toFixed(3)),
        change: changePercent.toFixed(1) + '%',
        direction: recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable'
      };
    }

    // Calculate statistics
    const values = series.map(s => s.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const sortedValues = [...values].sort((a, b) => a - b);

    return {
      status: 'analyzed',
      dataPoints: series.length,
      timeRange: {
        start: start.toISOString ? start.toISOString() : start,
        end: end.toISOString ? end.toISOString() : end
      },
      statistics: {
        mean: parseFloat(avg.toFixed(3)),
        min: sortedValues[0],
        max: sortedValues[sortedValues.length - 1],
        p50: sortedValues[Math.floor(sortedValues.length / 2)]
      },
      trend,
      smoothedSeries: smoothed,
      changePoints,
      weekOverWeek,
      summary: this.generateTrendSummary(trend, changePoints, weekOverWeek)
    };
  }

  /**
   * Generate human-readable trend summary
   *
   * @param {Object} trend - Trend regression results
   * @param {Array} changePoints - Detected change points
   * @param {Object} weekOverWeek - Week comparison
   * @returns {string} Summary text
   */
  generateTrendSummary(trend, changePoints, weekOverWeek) {
    const parts = [];

    if (trend) {
      parts.push(`${trend.strength} ${trend.direction} trend (R²=${trend.rSquared.toFixed(2)})`);
    }

    if (changePoints && changePoints.length > 0) {
      parts.push(`${changePoints.length} significant change point(s) detected`);
    }

    if (weekOverWeek) {
      parts.push(`Week-over-week: ${weekOverWeek.change} (${weekOverWeek.direction})`);
    }

    return parts.length > 0 ? parts.join('. ') : 'Insufficient data for trend analysis';
  }

  /**
   * Compare trends between two variants
   *
   * @param {string} contentType - Content type
   * @param {string} variant1 - First variant
   * @param {string} variant2 - Second variant
   * @param {Object} timeRange - { start, end } Date objects
   * @returns {Object} Comparison results
   */
  compareTrends(contentType, variant1, variant2, timeRange) {
    const trend1 = this.analyzeTrend(contentType, variant1, timeRange);
    const trend2 = this.analyzeTrend(contentType, variant2, timeRange);

    if (trend1.status !== 'analyzed' || trend2.status !== 'analyzed') {
      return {
        status: 'insufficient_data',
        variant1: trend1.status,
        variant2: trend2.status
      };
    }

    const meanDiff = trend1.statistics.mean - trend2.statistics.mean;
    const slopeDiff = (trend1.trend?.slope || 0) - (trend2.trend?.slope || 0);

    return {
      status: 'compared',
      contentType,
      timeRange,
      variant1: {
        name: variant1,
        mean: trend1.statistics.mean,
        trend: trend1.trend?.direction,
        dataPoints: trend1.dataPoints
      },
      variant2: {
        name: variant2,
        mean: trend2.statistics.mean,
        trend: trend2.trend?.direction,
        dataPoints: trend2.dataPoints
      },
      comparison: {
        meanDifference: parseFloat(meanDiff.toFixed(3)),
        slopeDifference: parseFloat(slopeDiff.toFixed(5)),
        betterVariant: meanDiff > 0.01 ? variant1 : meanDiff < -0.01 ? variant2 : 'similar',
        fasterImproving: slopeDiff > 0.0001 ? variant1 : slopeDiff < -0.0001 ? variant2 : 'similar'
      }
    };
  }

  /**
   * Forecast future values based on trend
   *
   * @param {string} contentType - Content type
   * @param {string} variant - Variant
   * @param {number} periods - Number of periods to forecast
   * @returns {Object} Forecast results
   */
  forecast(contentType, variant, periods = 5) {
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const analysis = this.analyzeTrend(contentType, variant, { start, end: now });

    if (analysis.status !== 'analyzed' || !analysis.trend) {
      return { status: 'insufficient_data' };
    }

    const { slope, intercept, rSquared } = analysis.trend;
    const currentN = analysis.dataPoints;

    const forecasts = [];
    for (let i = 1; i <= periods; i++) {
      const predictedValue = intercept + slope * (currentN + i);
      forecasts.push({
        period: i,
        predictedValue: parseFloat(predictedValue.toFixed(3)),
        confidence: rSquared > 0.5 ? 'high' : rSquared > 0.2 ? 'medium' : 'low'
      });
    }

    return {
      status: 'forecasted',
      contentType,
      variant,
      basedOnDataPoints: currentN,
      trendStrength: analysis.trend.strength,
      trendDirection: analysis.trend.direction,
      forecasts
    };
  }
}

// Singleton instance
export const trendAnalyzer = new TrendAnalyzer(temporalStore);

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 2 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase2() {
  const results = {
    passed: true,
    tests: []
  };

  // Create test store with data
  const store = new TemporalStore();
  const analyzer = new TrendAnalyzer(store);

  // Add test data with upward trend
  const baseTime = new Date('2024-03-01T00:00:00Z');
  for (let i = 0; i < 30; i++) {
    store.record({
      contentType: 'Roadmap',
      variant: 'champion',
      qualityScore: 3.5 + i * 0.02 + (Math.random() - 0.5) * 0.1,
      timestamp: new Date(baseTime.getTime() + i * 3600000).toISOString()
    });
  }

  // Test 1: Linear regression detects positive trend
  const points = store.indexByType['Roadmap'].map(dp => ({
    timestamp: dp.timestamp,
    value: dp.qualityScore
  }));
  const regression = analyzer.linearRegression(points);
  results.tests.push({
    name: 'Linear regression detects positive trend',
    passed: regression !== null && regression.slope > 0 && regression.direction === 'improving',
    details: `slope=${regression?.slope?.toFixed(4)}, direction=${regression?.direction}`
  });

  // Test 2: R-squared is reasonable
  results.tests.push({
    name: 'R-squared is reasonable',
    passed: regression !== null && regression.rSquared >= 0 && regression.rSquared <= 1,
    details: `rSquared=${regression?.rSquared?.toFixed(3)}`
  });

  // Test 3: Moving average smooths data
  const ma = analyzer.movingAverage(points, 5);
  results.tests.push({
    name: 'Moving average produces results',
    passed: ma.length === points.length - 4,
    details: `original=${points.length}, smoothed=${ma.length}`
  });

  // Test 4: EMA produces correct length
  const ema = analyzer.exponentialMovingAverage(points, 0.3);
  results.tests.push({
    name: 'Exponential moving average produces correct length',
    passed: ema.length === points.length,
    details: `ema.length=${ema.length}`
  });

  // Test 5: Analyze trend returns proper structure
  const analysis = analyzer.analyzeTrend('Roadmap', 'champion', {
    start: baseTime,
    end: new Date(baseTime.getTime() + 30 * 3600000)
  });
  results.tests.push({
    name: 'Analyze trend returns proper structure',
    passed: analysis.status === 'analyzed' && analysis.trend !== undefined,
    details: `status=${analysis.status}, hasTrend=${analysis.trend !== undefined}`
  });

  // Test 6: Summary is generated
  results.tests.push({
    name: 'Summary is generated',
    passed: analysis.summary !== undefined && analysis.summary.length > 0,
    details: `summary="${analysis.summary.substring(0, 50)}..."`
  });

  // Test 7: Change point detection works
  // Add data with a change point
  for (let i = 30; i < 40; i++) {
    store.record({
      contentType: 'Slides',
      variant: 'champion',
      qualityScore: i < 35 ? 3.5 : 4.2,  // Jump at i=35
      timestamp: new Date(baseTime.getTime() + i * 3600000).toISOString()
    });
  }
  const slidesPoints = store.indexByType['Slides'].map(dp => ({
    timestamp: dp.timestamp,
    value: dp.qualityScore
  }));
  const changePoints = analyzer.detectChangePoints(slidesPoints, 1.5);
  results.tests.push({
    name: 'Change point detection finds jump',
    passed: changePoints.length >= 1,
    details: `found=${changePoints.length} change points`
  });

  // Test 8: Insufficient data handled
  const tooFewAnalysis = analyzer.analyzeTrend('Empty', 'champion', {
    start: baseTime,
    end: new Date()
  });
  results.tests.push({
    name: 'Insufficient data handled',
    passed: tooFewAnalysis.status === 'insufficient_data',
    details: `status=${tooFewAnalysis.status}`
  });

  // Test 9: Compare trends works
  // Add candidate data
  for (let i = 0; i < 20; i++) {
    store.record({
      contentType: 'Roadmap',
      variant: 'candidate',
      qualityScore: 3.6 + i * 0.03 + (Math.random() - 0.5) * 0.1,
      timestamp: new Date(baseTime.getTime() + i * 3600000).toISOString()
    });
  }
  const comparison = analyzer.compareTrends('Roadmap', 'champion', 'candidate', {
    start: baseTime,
    end: new Date(baseTime.getTime() + 30 * 3600000)
  });
  results.tests.push({
    name: 'Compare trends works',
    passed: comparison.status === 'compared' && comparison.comparison !== undefined,
    details: `status=${comparison.status}`
  });

  // Test 10: Forecast produces predictions
  // Add recent data for forecast (within last 7 days)
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    store.record({
      contentType: 'Document',
      variant: 'champion',
      qualityScore: 3.6 + i * 0.02 + (Math.random() - 0.5) * 0.1,
      timestamp: new Date(now.getTime() - (24 - i) * 3600000).toISOString()
    });
  }
  const forecast = analyzer.forecast('Document', 'champion', 3);
  results.tests.push({
    name: 'Forecast produces predictions',
    passed: forecast.status === 'forecasted' && forecast.forecasts.length === 3,
    details: `status=${forecast.status}, forecasts=${forecast.forecasts?.length}`
  });

  // Test 11: Statistics are calculated
  results.tests.push({
    name: 'Statistics are calculated',
    passed: analysis.statistics !== undefined && analysis.statistics.mean > 0,
    details: `mean=${analysis.statistics?.mean}`
  });

  // Test 12: Handles null store gracefully
  const emptyAnalyzer = new TrendAnalyzer(new TemporalStore());
  const emptyResult = emptyAnalyzer.analyzeTrend('Roadmap', 'champion', {
    start: new Date(),
    end: new Date()
  });
  results.tests.push({
    name: 'Handles empty store',
    passed: emptyResult.status === 'insufficient_data',
    details: `status=${emptyResult.status}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase2();
  console.log('Trend Analysis Phase 2 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
