# Implementation Plan: Temporal Performance Tracking

## Problem Statement

The current training system provides only aggregate metrics without any temporal context. This means:
1. Performance trends over time are invisible
2. Regressions may go unnoticed until significant damage occurs
3. Seasonal or time-based patterns cannot be identified
4. The impact of prompt changes cannot be tracked historically
5. No ability to correlate performance with external events

## Current State

```javascript
// Current stats are snapshots with no history
const stats = {
  champion: { count: 70, avgScore: 3.8 },
  candidate: { count: 20, avgScore: 3.9 }
};
// No information about when these scores occurred or how they changed over time
```

## Goal

Implement comprehensive temporal tracking that:
1. Stores timestamped performance data for all generations
2. Enables trend analysis and anomaly detection
3. Tracks performance before/after prompt changes
4. Provides visualizable historical data
5. Supports alerting on performance regressions

---

## Phase 1: Time-Series Data Model

### Objective
Design and implement the data structures for temporal storage.

### Implementation

```javascript
// temporalStorage.js

/**
 * Time-series data point for generation metrics
 */
const MetricDataPoint = {
  timestamp: 'datetime',
  contentType: 'string',
  variant: 'string',
  promptVersion: 'string',

  // Core metrics
  qualityScore: 'number',
  feedbackRating: 'number|null',

  // Dimension scores
  dimensions: 'object',

  // Generation metadata
  latency: 'number',
  tokenCount: 'number',
  success: 'boolean',
  errorCategory: 'string|null',

  // Context
  sampleId: 'string',
  sessionId: 'string'
};

/**
 * Aggregated metrics for time windows
 */
const AggregatedMetrics = {
  windowStart: 'datetime',
  windowEnd: 'datetime',
  windowSize: 'string',  // '1h', '1d', '1w'
  contentType: 'string',
  variant: 'string',

  // Statistics
  count: 'number',
  avgQualityScore: 'number',
  stdDevQualityScore: 'number',
  minQualityScore: 'number',
  maxQualityScore: 'number',
  p50QualityScore: 'number',
  p95QualityScore: 'number',

  avgFeedbackRating: 'number|null',
  avgLatency: 'number',

  successRate: 'number',
  errorBreakdown: 'object'
};

class TemporalStore {
  constructor() {
    this.dataPoints = [];
    this.aggregates = {};  // windowKey -> AggregatedMetrics
    this.indexByTime = {};  // hourKey -> dataPoint[]
    this.indexByType = {};  // contentType -> dataPoint[]
    this.maxDataPoints = 100000;  // Memory limit
    this.retentionDays = 30;
  }

  record(dataPoint) {
    // Add timestamp if not present
    dataPoint.timestamp = dataPoint.timestamp || new Date().toISOString();

    // Validate
    if (!dataPoint.contentType || dataPoint.qualityScore === undefined) {
      throw new Error('Invalid data point: missing required fields');
    }

    // Store
    this.dataPoints.push(dataPoint);

    // Index by time (hourly buckets)
    const hourKey = this.getHourKey(dataPoint.timestamp);
    if (!this.indexByTime[hourKey]) {
      this.indexByTime[hourKey] = [];
    }
    this.indexByTime[hourKey].push(dataPoint);

    // Index by content type
    if (!this.indexByType[dataPoint.contentType]) {
      this.indexByType[dataPoint.contentType] = [];
    }
    this.indexByType[dataPoint.contentType].push(dataPoint);

    // Cleanup if over limit
    if (this.dataPoints.length > this.maxDataPoints) {
      this.pruneOldData();
    }

    // Update rolling aggregates
    this.updateAggregates(dataPoint);

    return dataPoint;
  }

  getHourKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
  }

  getDayKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  updateAggregates(dataPoint) {
    // Update hourly aggregate
    const hourKey = `${dataPoint.contentType}_${dataPoint.variant}_${this.getHourKey(dataPoint.timestamp)}`;
    this.updateAggregate(hourKey, dataPoint, '1h');

    // Update daily aggregate
    const dayKey = `${dataPoint.contentType}_${dataPoint.variant}_${this.getDayKey(dataPoint.timestamp)}`;
    this.updateAggregate(dayKey, dataPoint, '1d');
  }

  updateAggregate(key, dataPoint, windowSize) {
    if (!this.aggregates[key]) {
      this.aggregates[key] = {
        windowStart: dataPoint.timestamp,
        windowEnd: dataPoint.timestamp,
        windowSize,
        contentType: dataPoint.contentType,
        variant: dataPoint.variant,
        count: 0,
        scores: [],
        ratings: [],
        latencies: [],
        successes: 0,
        errors: {}
      };
    }

    const agg = this.aggregates[key];
    agg.count++;
    agg.scores.push(dataPoint.qualityScore);
    agg.windowEnd = dataPoint.timestamp;

    if (dataPoint.feedbackRating != null) {
      agg.ratings.push(dataPoint.feedbackRating);
    }

    if (dataPoint.latency) {
      agg.latencies.push(dataPoint.latency);
    }

    if (dataPoint.success) {
      agg.successes++;
    }

    if (dataPoint.errorCategory) {
      agg.errors[dataPoint.errorCategory] = (agg.errors[dataPoint.errorCategory] || 0) + 1;
    }
  }

  getAggregate(key) {
    const raw = this.aggregates[key];
    if (!raw) return null;

    // Calculate statistics
    const sortedScores = [...raw.scores].sort((a, b) => a - b);

    return {
      windowStart: raw.windowStart,
      windowEnd: raw.windowEnd,
      windowSize: raw.windowSize,
      contentType: raw.contentType,
      variant: raw.variant,
      count: raw.count,
      avgQualityScore: mean(raw.scores),
      stdDevQualityScore: Math.sqrt(variance(raw.scores)),
      minQualityScore: Math.min(...raw.scores),
      maxQualityScore: Math.max(...raw.scores),
      p50QualityScore: percentile(sortedScores, 50),
      p95QualityScore: percentile(sortedScores, 95),
      avgFeedbackRating: raw.ratings.length > 0 ? mean(raw.ratings) : null,
      avgLatency: raw.latencies.length > 0 ? mean(raw.latencies) : null,
      successRate: raw.count > 0 ? raw.successes / raw.count : 0,
      errorBreakdown: raw.errors
    };
  }

  pruneOldData() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    this.dataPoints = this.dataPoints.filter(dp =>
      new Date(dp.timestamp) >= cutoff
    );

    // Rebuild indices
    this.rebuildIndices();
  }

  rebuildIndices() {
    this.indexByTime = {};
    this.indexByType = {};

    for (const dp of this.dataPoints) {
      const hourKey = this.getHourKey(dp.timestamp);
      if (!this.indexByTime[hourKey]) {
        this.indexByTime[hourKey] = [];
      }
      this.indexByTime[hourKey].push(dp);

      if (!this.indexByType[dp.contentType]) {
        this.indexByType[dp.contentType] = [];
      }
      this.indexByType[dp.contentType].push(dp);
    }
  }
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return null;
  const idx = Math.floor(sortedArr.length * p / 100);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

export const temporalStore = new TemporalStore();
```

---

## Phase 2: Trend Analysis

### Objective
Implement algorithms to detect trends in performance over time.

### Implementation

```javascript
// trendAnalysis.js

class TrendAnalyzer {
  constructor(temporalStore) {
    this.store = temporalStore;
  }

  /**
   * Calculate linear regression for trend detection
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

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R-squared for trend strength
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;

    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * i;
      ssTotal += Math.pow(points[i].value - yMean, 2);
      ssResidual += Math.pow(points[i].value - predicted, 2);
    }

    const rSquared = 1 - (ssResidual / ssTotal);

    return {
      slope,
      intercept,
      rSquared,
      direction: slope > 0.001 ? 'improving' : slope < -0.001 ? 'declining' : 'stable',
      strength: Math.abs(rSquared) > 0.5 ? 'strong' : Math.abs(rSquared) > 0.2 ? 'moderate' : 'weak'
    };
  }

  /**
   * Calculate moving average for smoothing
   */
  movingAverage(points, window = 5) {
    if (points.length < window) return points;

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
   * Detect change points using CUSUM algorithm
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
          magnitude: cusumPos[i] > threshold ? cusumPos[i] : cusumNeg[i]
        });
      }
    }

    return changePoints;
  }

  /**
   * Analyze trend for a specific content type and time range
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
    const smoothed = this.movingAverage(series, 5);
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
      weekOverWeek = {
        recentAvg: recentAvg.toFixed(3),
        previousAvg: olderAvg.toFixed(3),
        change: ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1) + '%',
        direction: recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable'
      };
    }

    return {
      status: 'analyzed',
      dataPoints: series.length,
      timeRange: { start, end },
      trend,
      smoothedSeries: smoothed,
      changePoints,
      weekOverWeek,
      summary: this.generateTrendSummary(trend, changePoints, weekOverWeek)
    };
  }

  generateTrendSummary(trend, changePoints, weekOverWeek) {
    const parts = [];

    if (trend) {
      parts.push(`${trend.strength} ${trend.direction} trend (R²=${trend.rSquared.toFixed(2)})`);
    }

    if (changePoints.length > 0) {
      parts.push(`${changePoints.length} significant change point(s) detected`);
    }

    if (weekOverWeek) {
      parts.push(`Week-over-week: ${weekOverWeek.change} (${weekOverWeek.direction})`);
    }

    return parts.join('. ');
  }
}

export const trendAnalyzer = new TrendAnalyzer(temporalStore);
```

---

## Phase 3: Anomaly Detection

### Objective
Implement real-time anomaly detection for performance metrics.

### Implementation

```javascript
// anomalyDetection.js

class AnomalyDetector {
  constructor(temporalStore) {
    this.store = temporalStore;
    this.thresholds = {
      zScore: 3.0,          // Standard deviations from mean
      percentDrop: 20,      // Percent drop from recent average
      consecutiveLow: 5     // Consecutive low scores
    };
    this.alerts = [];
    this.alertCallbacks = [];
  }

  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  emitAlert(alert) {
    this.alerts.push(alert);
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (e) {
        console.error('Alert callback error:', e);
      }
    }
  }

  /**
   * Check a new data point for anomalies
   */
  checkDataPoint(dataPoint) {
    const anomalies = [];

    // Get baseline statistics
    const baseline = this.getBaseline(dataPoint.contentType, dataPoint.variant);

    if (!baseline || baseline.count < 20) {
      return [];  // Not enough data for anomaly detection
    }

    // Z-score check
    const zScore = (dataPoint.qualityScore - baseline.mean) / baseline.stdDev;
    if (Math.abs(zScore) > this.thresholds.zScore) {
      anomalies.push({
        type: 'z_score_outlier',
        severity: zScore < -this.thresholds.zScore ? 'high' : 'medium',
        message: `Quality score ${dataPoint.qualityScore.toFixed(2)} is ${Math.abs(zScore).toFixed(1)} std devs from mean`,
        dataPoint,
        baseline: { mean: baseline.mean, stdDev: baseline.stdDev },
        zScore
      });
    }

    // Sudden drop check (compare to last hour)
    const recentAvg = this.getRecentAverage(dataPoint.contentType, dataPoint.variant, 1);
    if (recentAvg && dataPoint.qualityScore < recentAvg * (1 - this.thresholds.percentDrop / 100)) {
      anomalies.push({
        type: 'sudden_drop',
        severity: 'high',
        message: `Quality dropped ${((1 - dataPoint.qualityScore / recentAvg) * 100).toFixed(0)}% from recent average`,
        dataPoint,
        recentAvg
      });
    }

    // Consecutive low check
    const consecutiveLow = this.checkConsecutiveLow(dataPoint);
    if (consecutiveLow) {
      anomalies.push(consecutiveLow);
    }

    // Emit alerts for high-severity anomalies
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'high') {
        this.emitAlert({
          timestamp: new Date().toISOString(),
          ...anomaly
        });
      }
    }

    return anomalies;
  }

  getBaseline(contentType, variant, windowHours = 24) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - windowHours);

    const points = (this.store.indexByType[contentType] || [])
      .filter(dp =>
        dp.variant === variant &&
        new Date(dp.timestamp) >= cutoff
      )
      .map(dp => dp.qualityScore);

    if (points.length < 10) return null;

    const mean = points.reduce((a, b) => a + b, 0) / points.length;
    const stdDev = Math.sqrt(
      points.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / points.length
    );

    return { mean, stdDev, count: points.length };
  }

  getRecentAverage(contentType, variant, hours = 1) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const points = (this.store.indexByType[contentType] || [])
      .filter(dp =>
        dp.variant === variant &&
        new Date(dp.timestamp) >= cutoff
      )
      .map(dp => dp.qualityScore);

    if (points.length < 3) return null;

    return points.reduce((a, b) => a + b, 0) / points.length;
  }

  checkConsecutiveLow(dataPoint) {
    const baseline = this.getBaseline(dataPoint.contentType, dataPoint.variant);
    if (!baseline) return null;

    const lowThreshold = baseline.mean - baseline.stdDev;

    const recentPoints = (this.store.indexByType[dataPoint.contentType] || [])
      .filter(dp => dp.variant === dataPoint.variant)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, this.thresholds.consecutiveLow);

    if (recentPoints.length < this.thresholds.consecutiveLow) return null;

    const allLow = recentPoints.every(dp => dp.qualityScore < lowThreshold);

    if (allLow) {
      return {
        type: 'consecutive_low',
        severity: 'high',
        message: `Last ${this.thresholds.consecutiveLow} scores all below threshold (${lowThreshold.toFixed(2)})`,
        dataPoint,
        threshold: lowThreshold,
        recentScores: recentPoints.map(dp => dp.qualityScore.toFixed(2))
      };
    }

    return null;
  }

  /**
   * Detect distribution shift using Kolmogorov-Smirnov test
   */
  detectDistributionShift(contentType, variant, windowHours = 6) {
    const now = new Date();
    const recentCutoff = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const baselineCutoff = new Date(now.getTime() - windowHours * 2 * 60 * 60 * 1000);

    const allPoints = (this.store.indexByType[contentType] || [])
      .filter(dp => dp.variant === variant);

    const recentPoints = allPoints
      .filter(dp => new Date(dp.timestamp) >= recentCutoff)
      .map(dp => dp.qualityScore)
      .sort((a, b) => a - b);

    const baselinePoints = allPoints
      .filter(dp =>
        new Date(dp.timestamp) >= baselineCutoff &&
        new Date(dp.timestamp) < recentCutoff
      )
      .map(dp => dp.qualityScore)
      .sort((a, b) => a - b);

    if (recentPoints.length < 10 || baselinePoints.length < 10) {
      return null;
    }

    // Kolmogorov-Smirnov statistic
    const ksStatistic = this.ksTest(recentPoints, baselinePoints);

    // Critical value for alpha=0.05
    const n1 = recentPoints.length;
    const n2 = baselinePoints.length;
    const criticalValue = 1.36 * Math.sqrt((n1 + n2) / (n1 * n2));

    const isShifted = ksStatistic > criticalValue;

    return {
      shifted: isShifted,
      ksStatistic,
      criticalValue,
      recentSampleSize: n1,
      baselineSampleSize: n2,
      recentMean: mean(recentPoints).toFixed(3),
      baselineMean: mean(baselinePoints).toFixed(3)
    };
  }

  ksTest(sample1, sample2) {
    // Kolmogorov-Smirnov two-sample test
    const combined = [...sample1, ...sample2].sort((a, b) => a - b);
    const n1 = sample1.length;
    const n2 = sample2.length;

    let maxDiff = 0;
    let cdf1 = 0, cdf2 = 0;

    for (const value of combined) {
      while (cdf1 < n1 && sample1[cdf1] <= value) cdf1++;
      while (cdf2 < n2 && sample2[cdf2] <= value) cdf2++;

      const diff = Math.abs(cdf1 / n1 - cdf2 / n2);
      maxDiff = Math.max(maxDiff, diff);
    }

    return maxDiff;
  }

  getRecentAlerts(count = 20) {
    return this.alerts.slice(-count);
  }
}

function mean(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export const anomalyDetector = new AnomalyDetector(temporalStore);
```

---

## Phase 4: Prompt Change Impact Tracking

### Objective
Track and analyze the impact of prompt changes on performance.

### Implementation

```javascript
// promptImpactTracker.js

class PromptImpactTracker {
  constructor(temporalStore, trendAnalyzer) {
    this.store = temporalStore;
    this.trendAnalyzer = trendAnalyzer;
    this.promptChanges = [];  // Record of prompt change events
  }

  recordPromptChange(contentType, oldVersion, newVersion, metadata = {}) {
    const change = {
      id: `pc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      contentType,
      oldVersion,
      newVersion,
      metadata,
      impact: null  // Calculated after sufficient data
    };

    this.promptChanges.push(change);
    console.log(`Prompt change recorded for ${contentType}: ${oldVersion} -> ${newVersion}`);

    return change;
  }

  /**
   * Analyze the impact of a prompt change
   */
  analyzePromptChangeImpact(changeId, windowHours = 24) {
    const change = this.promptChanges.find(c => c.id === changeId);
    if (!change) return null;

    const changeTime = new Date(change.timestamp);
    const beforeStart = new Date(changeTime.getTime() - windowHours * 60 * 60 * 1000);
    const afterEnd = new Date(changeTime.getTime() + windowHours * 60 * 60 * 1000);

    // Get data before and after
    const allPoints = this.store.indexByType[change.contentType] || [];

    const beforePoints = allPoints
      .filter(dp =>
        new Date(dp.timestamp) >= beforeStart &&
        new Date(dp.timestamp) < changeTime
      )
      .map(dp => dp.qualityScore);

    const afterPoints = allPoints
      .filter(dp =>
        new Date(dp.timestamp) >= changeTime &&
        new Date(dp.timestamp) <= afterEnd
      )
      .map(dp => dp.qualityScore);

    if (beforePoints.length < 10 || afterPoints.length < 10) {
      return {
        status: 'insufficient_data',
        beforeCount: beforePoints.length,
        afterCount: afterPoints.length,
        requiredCount: 10
      };
    }

    // Statistical comparison
    const beforeMean = mean(beforePoints);
    const afterMean = mean(afterPoints);
    const effectSize = (afterMean - beforeMean) / Math.sqrt(
      (variance(beforePoints) + variance(afterPoints)) / 2
    );

    // T-test
    const tTest = welchTTest(afterPoints, beforePoints);

    const impact = {
      status: 'analyzed',
      changeId,
      contentType: change.contentType,
      changeTimestamp: change.timestamp,

      before: {
        count: beforePoints.length,
        mean: beforeMean.toFixed(3),
        stdDev: Math.sqrt(variance(beforePoints)).toFixed(3),
        p50: percentile(beforePoints.sort((a, b) => a - b), 50).toFixed(3)
      },

      after: {
        count: afterPoints.length,
        mean: afterMean.toFixed(3),
        stdDev: Math.sqrt(variance(afterPoints)).toFixed(3),
        p50: percentile(afterPoints.sort((a, b) => a - b), 50).toFixed(3)
      },

      comparison: {
        meanChange: (afterMean - beforeMean).toFixed(3),
        percentChange: ((afterMean - beforeMean) / beforeMean * 100).toFixed(1) + '%',
        effectSize: effectSize.toFixed(3),
        effectSizeInterpretation: interpretEffectSize(effectSize),
        statistically_significant: tTest.significant,
        pValue: tTest.pValue.toFixed(4)
      },

      verdict: this.getVerdict(effectSize, tTest.significant, afterMean - beforeMean)
    };

    // Store impact on the change record
    change.impact = impact;

    return impact;
  }

  getVerdict(effectSize, significant, meanChange) {
    if (!significant) {
      return {
        outcome: 'no_significant_change',
        recommendation: 'The prompt change did not produce a statistically significant difference'
      };
    }

    if (meanChange > 0 && effectSize > 0.3) {
      return {
        outcome: 'improvement',
        recommendation: 'Keep the new prompt - significant improvement detected'
      };
    }

    if (meanChange < 0 && effectSize < -0.3) {
      return {
        outcome: 'regression',
        recommendation: 'Consider reverting - significant regression detected'
      };
    }

    return {
      outcome: 'marginal_change',
      recommendation: 'Effect is statistically significant but practically small'
    };
  }

  /**
   * Get all prompt changes with their impacts
   */
  getPromptChangeHistory(contentType = null) {
    let changes = this.promptChanges;

    if (contentType) {
      changes = changes.filter(c => c.contentType === contentType);
    }

    return changes.map(c => ({
      ...c,
      impact: c.impact || 'pending_analysis'
    }));
  }

  /**
   * Analyze pending impacts (for changes with enough post-change data)
   */
  analyzeAllPendingImpacts(windowHours = 24) {
    const analyzed = [];

    for (const change of this.promptChanges) {
      if (change.impact) continue;  // Already analyzed

      const changeTime = new Date(change.timestamp);
      const timeSinceChange = (Date.now() - changeTime.getTime()) / (1000 * 60 * 60);

      // Only analyze if enough time has passed
      if (timeSinceChange >= windowHours) {
        const impact = this.analyzePromptChangeImpact(change.id, windowHours);
        if (impact && impact.status === 'analyzed') {
          analyzed.push(impact);
        }
      }
    }

    return analyzed;
  }
}

function interpretEffectSize(d) {
  const abs = Math.abs(d);
  if (abs < 0.2) return 'negligible';
  if (abs < 0.5) return 'small';
  if (abs < 0.8) return 'medium';
  return 'large';
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return null;
  const idx = Math.floor(sortedArr.length * p / 100);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1);
}

export const promptImpactTracker = new PromptImpactTracker(temporalStore, trendAnalyzer);
```

---

## Phase 5: Temporal API and Dashboard Data

### Objective
Create API endpoints for accessing temporal data.

### Implementation

```javascript
// routes/temporal.js

import express from 'express';
import { temporalStore } from '../utils/temporalStorage.js';
import { trendAnalyzer } from '../utils/trendAnalysis.js';
import { anomalyDetector } from '../utils/anomalyDetection.js';
import { promptImpactTracker } from '../utils/promptImpactTracker.js';

const router = express.Router();

// Get time-series data for charting
router.get('/series/:contentType', (req, res) => {
  const { contentType } = req.params;
  const { variant, hours = 24, aggregation = 'hourly' } = req.query;

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - parseInt(hours));

  const points = (temporalStore.indexByType[contentType] || [])
    .filter(dp =>
      (!variant || dp.variant === variant) &&
      new Date(dp.timestamp) >= cutoff
    )
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Aggregate if requested
  let series = points.map(dp => ({
    timestamp: dp.timestamp,
    qualityScore: dp.qualityScore,
    variant: dp.variant
  }));

  if (aggregation === 'hourly') {
    series = aggregateByHour(points);
  }

  res.json({
    success: true,
    contentType,
    variant,
    dataPoints: series.length,
    series
  });
});

// Get trend analysis
router.get('/trend/:contentType', (req, res) => {
  const { contentType } = req.params;
  const { variant = 'champion', days = 7 } = req.query;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - parseInt(days));

  const analysis = trendAnalyzer.analyzeTrend(contentType, variant, { start, end });

  res.json({ success: true, ...analysis });
});

// Get recent anomalies
router.get('/anomalies', (req, res) => {
  const { contentType, severity, limit = 50 } = req.query;

  let alerts = anomalyDetector.getRecentAlerts(parseInt(limit));

  if (contentType) {
    alerts = alerts.filter(a => a.dataPoint?.contentType === contentType);
  }

  if (severity) {
    alerts = alerts.filter(a => a.severity === severity);
  }

  res.json({
    success: true,
    alertCount: alerts.length,
    alerts
  });
});

// Check for distribution shift
router.get('/distribution-shift/:contentType', (req, res) => {
  const { contentType } = req.params;
  const { variant = 'champion', hours = 6 } = req.query;

  const result = anomalyDetector.detectDistributionShift(
    contentType,
    variant,
    parseInt(hours)
  );

  res.json({ success: true, ...result });
});

// Get prompt change history
router.get('/prompt-changes', (req, res) => {
  const { contentType } = req.query;
  const changes = promptImpactTracker.getPromptChangeHistory(contentType);

  res.json({
    success: true,
    changeCount: changes.length,
    changes
  });
});

// Record a prompt change
router.post('/prompt-changes', (req, res) => {
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
    metadata
  );

  res.json({ success: true, change });
});

// Analyze prompt change impact
router.get('/prompt-changes/:changeId/impact', (req, res) => {
  const { changeId } = req.params;
  const { hours = 24 } = req.query;

  const impact = promptImpactTracker.analyzePromptChangeImpact(changeId, parseInt(hours));

  if (!impact) {
    return res.status(404).json({ success: false, error: 'Change not found' });
  }

  res.json({ success: true, ...impact });
});

// Dashboard summary
router.get('/dashboard', (req, res) => {
  const summary = {
    timestamp: new Date().toISOString(),
    byContentType: {}
  };

  for (const contentType of ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis']) {
    const last24h = trendAnalyzer.analyzeTrend(contentType, 'champion', {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date()
    });

    const distributionShift = anomalyDetector.detectDistributionShift(contentType, 'champion');

    summary.byContentType[contentType] = {
      trend: last24h.status === 'analyzed' ? {
        direction: last24h.trend?.direction,
        weekOverWeek: last24h.weekOverWeek
      } : null,
      distributionShift,
      dataPoints: last24h.dataPoints
    };
  }

  summary.recentAlerts = anomalyDetector.getRecentAlerts(5);
  summary.pendingImpacts = promptImpactTracker.analyzeAllPendingImpacts().length;

  res.json({ success: true, summary });
});

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

function mean(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export default router;
```

---

## Phase 6: Training Loop Integration

### Objective
Integrate temporal tracking with the training loop.

### Implementation

```javascript
// In training.js - additions

import { temporalStore } from '../utils/temporalStorage.js';
import { anomalyDetector } from '../utils/anomalyDetection.js';
import { promptImpactTracker } from '../utils/promptImpactTracker.js';

// After each generation
function recordGenerationMetrics(result, contentType, variant, promptVersion) {
  const dataPoint = {
    timestamp: new Date().toISOString(),
    contentType,
    variant,
    promptVersion,
    qualityScore: result.score,
    feedbackRating: result.feedback?.rating,
    dimensions: result.dimensions,
    latency: result.latency,
    tokenCount: result.tokenCount,
    success: result.success,
    errorCategory: result.errorCategory,
    sampleId: result.sampleId,
    sessionId: trainingSessionId
  };

  // Store in temporal store
  temporalStore.record(dataPoint);

  // Check for anomalies
  const anomalies = anomalyDetector.checkDataPoint(dataPoint);
  if (anomalies.length > 0) {
    console.warn('Anomalies detected:', anomalies);
  }

  return dataPoint;
}

// When prompt is changed
function onPromptChange(contentType, oldPrompt, newPrompt, reason) {
  const oldVersion = `v${Date.now() - 1000}`;  // Or use actual versioning
  const newVersion = `v${Date.now()}`;

  promptImpactTracker.recordPromptChange(contentType, oldVersion, newVersion, {
    reason,
    oldPromptHash: hashPrompt(oldPrompt),
    newPromptHash: hashPrompt(newPrompt)
  });
}

// Setup alert handling
anomalyDetector.onAlert((alert) => {
  console.error('🚨 ANOMALY ALERT:', alert.type, alert.message);

  // Could also:
  // - Send to monitoring system
  // - Pause training for investigation
  // - Trigger automatic rollback
});

// Periodic trend check during training
function periodicTrendCheck(iteration) {
  if (iteration % 100 !== 0) return;

  for (const contentType of contentTypes) {
    const trend = trendAnalyzer.analyzeTrend(contentType, 'champion', {
      start: new Date(Date.now() - 3600000),  // Last hour
      end: new Date()
    });

    if (trend.status === 'analyzed' && trend.trend?.direction === 'declining') {
      console.warn(`⚠️ Declining trend detected for ${contentType}:`, trend.summary);
    }
  }
}
```

---

## Success Criteria

1. **Data Collection**: All generations logged with full context
2. **Trend Detection**: Trends identified with statistical backing
3. **Anomaly Detection**: False positive rate < 5%, catches 90%+ of real issues
4. **Prompt Impact**: Before/after comparisons available within 24h
5. **API Response Time**: Dashboard endpoints respond < 500ms
6. **Storage Efficiency**: 30-day retention with < 1GB storage

---

## Files to Create/Modify

- `/server/utils/temporalStorage.js` - Time-series storage
- `/server/utils/trendAnalysis.js` - Trend detection
- `/server/utils/anomalyDetection.js` - Anomaly detection
- `/server/utils/promptImpactTracker.js` - Prompt change tracking
- `/server/routes/temporal.js` - Temporal API endpoints
- `/server/routes/training.js` - Integration with training loop

---

## Estimated Complexity

- Phase 1: Medium (data model design)
- Phase 2: High (trend algorithms)
- Phase 3: High (anomaly detection)
- Phase 4: Medium (impact tracking)
- Phase 5: Medium (API development)
- Phase 6: Low (integration)
