/**
 * Temporal Storage
 *
 * Time-series data storage for generation metrics with indexing,
 * aggregation, and retention management.
 *
 * Implementation of Plan 07: Temporal Performance Tracking - Phase 1
 */

// ============================================================================
// Phase 1: Time-Series Data Model
// ============================================================================

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

/**
 * Calculate variance of an array
 *
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Variance
 */
function variance(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1);
}

/**
 * Calculate percentile of a sorted array
 *
 * @param {Array<number>} sortedArr - Sorted array of numbers
 * @param {number} p - Percentile (0-100)
 * @returns {number|null} Percentile value
 */
function percentile(sortedArr, p) {
  if (!sortedArr || sortedArr.length === 0) return null;
  const idx = Math.floor(sortedArr.length * p / 100);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

/**
 * TemporalStore - Time-series storage for generation metrics
 */
export class TemporalStore {
  /**
   * Create a TemporalStore
   *
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.dataPoints = [];
    this.aggregates = {};  // windowKey -> AggregatedMetrics
    this.indexByTime = {};  // hourKey -> dataPoint[]
    this.indexByType = {};  // contentType -> dataPoint[]
    this.indexByVariant = {};  // variant -> dataPoint[]
    this.maxDataPoints = options.maxDataPoints || 100000;
    this.retentionDays = options.retentionDays || 30;
  }

  /**
   * Record a data point
   *
   * @param {Object} dataPoint - Metric data point
   * @returns {Object} Recorded data point
   */
  record(dataPoint) {
    // Add timestamp if not present
    dataPoint.timestamp = dataPoint.timestamp || new Date().toISOString();

    // Validate required fields
    if (!dataPoint.contentType || dataPoint.qualityScore === undefined) {
      throw new Error('Invalid data point: missing required fields (contentType, qualityScore)');
    }

    // Add ID for tracking
    dataPoint.id = dataPoint.id || `dp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    // Index by variant
    if (dataPoint.variant) {
      if (!this.indexByVariant[dataPoint.variant]) {
        this.indexByVariant[dataPoint.variant] = [];
      }
      this.indexByVariant[dataPoint.variant].push(dataPoint);
    }

    // Cleanup if over limit
    if (this.dataPoints.length > this.maxDataPoints) {
      this.pruneOldData();
    }

    // Update rolling aggregates
    this.updateAggregates(dataPoint);

    return dataPoint;
  }

  /**
   * Get hour key from timestamp
   *
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Hour key (YYYY-MM-DD-HH)
   */
  getHourKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
  }

  /**
   * Get day key from timestamp
   *
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Day key (YYYY-MM-DD)
   */
  getDayKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /**
   * Update aggregates for a data point
   *
   * @param {Object} dataPoint - Data point
   */
  updateAggregates(dataPoint) {
    // Update hourly aggregate
    const hourKey = `${dataPoint.contentType}_${dataPoint.variant || 'all'}_${this.getHourKey(dataPoint.timestamp)}`;
    this.updateAggregate(hourKey, dataPoint, '1h');

    // Update daily aggregate
    const dayKey = `${dataPoint.contentType}_${dataPoint.variant || 'all'}_${this.getDayKey(dataPoint.timestamp)}`;
    this.updateAggregate(dayKey, dataPoint, '1d');
  }

  /**
   * Update a single aggregate bucket
   *
   * @param {string} key - Aggregate key
   * @param {Object} dataPoint - Data point
   * @param {string} windowSize - Window size ('1h' or '1d')
   */
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

  /**
   * Get computed aggregate statistics
   *
   * @param {string} key - Aggregate key
   * @returns {Object|null} Aggregate statistics
   */
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
      minQualityScore: sortedScores.length > 0 ? sortedScores[0] : null,
      maxQualityScore: sortedScores.length > 0 ? sortedScores[sortedScores.length - 1] : null,
      p50QualityScore: percentile(sortedScores, 50),
      p95QualityScore: percentile(sortedScores, 95),
      avgFeedbackRating: raw.ratings.length > 0 ? mean(raw.ratings) : null,
      avgLatency: raw.latencies.length > 0 ? mean(raw.latencies) : null,
      successRate: raw.count > 0 ? raw.successes / raw.count : 0,
      errorBreakdown: raw.errors
    };
  }

  /**
   * Get aggregates for a time range
   *
   * @param {string} contentType - Content type
   * @param {string} variant - Variant
   * @param {string} windowSize - Window size ('1h' or '1d')
   * @param {Date} start - Start time
   * @param {Date} end - End time
   * @returns {Array<Object>} Aggregates in range
   */
  getAggregatesInRange(contentType, variant, windowSize, start, end) {
    const prefix = `${contentType}_${variant || 'all'}_`;
    const results = [];

    for (const [key, raw] of Object.entries(this.aggregates)) {
      if (!key.startsWith(prefix)) continue;
      if (raw.windowSize !== windowSize) continue;

      const aggStart = new Date(raw.windowStart);
      if (aggStart >= start && aggStart <= end) {
        results.push(this.getAggregate(key));
      }
    }

    return results.sort((a, b) =>
      new Date(a.windowStart) - new Date(b.windowStart)
    );
  }

  /**
   * Query data points with filters
   *
   * @param {Object} filters - Query filters
   * @returns {Array<Object>} Matching data points
   */
  query(filters = {}) {
    let results = this.dataPoints;

    if (filters.contentType) {
      results = this.indexByType[filters.contentType] || [];
    }

    if (filters.variant) {
      results = results.filter(dp => dp.variant === filters.variant);
    }

    if (filters.start) {
      const startDate = new Date(filters.start);
      results = results.filter(dp => new Date(dp.timestamp) >= startDate);
    }

    if (filters.end) {
      const endDate = new Date(filters.end);
      results = results.filter(dp => new Date(dp.timestamp) <= endDate);
    }

    if (filters.minScore !== undefined) {
      results = results.filter(dp => dp.qualityScore >= filters.minScore);
    }

    if (filters.maxScore !== undefined) {
      results = results.filter(dp => dp.qualityScore <= filters.maxScore);
    }

    // Sort by timestamp
    results = [...results].sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Prune old data beyond retention period
   */
  pruneOldData() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    const originalCount = this.dataPoints.length;
    this.dataPoints = this.dataPoints.filter(dp =>
      new Date(dp.timestamp) >= cutoff
    );

    // Prune old aggregates
    for (const key of Object.keys(this.aggregates)) {
      const agg = this.aggregates[key];
      if (new Date(agg.windowEnd) < cutoff) {
        delete this.aggregates[key];
      }
    }

    // Rebuild indices
    this.rebuildIndices();

    return originalCount - this.dataPoints.length;
  }

  /**
   * Rebuild all indices from data points
   */
  rebuildIndices() {
    this.indexByTime = {};
    this.indexByType = {};
    this.indexByVariant = {};

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

      if (dp.variant) {
        if (!this.indexByVariant[dp.variant]) {
          this.indexByVariant[dp.variant] = [];
        }
        this.indexByVariant[dp.variant].push(dp);
      }
    }
  }

  /**
   * Get storage statistics
   *
   * @returns {Object} Storage stats
   */
  getStats() {
    const contentTypes = Object.keys(this.indexByType);
    const variants = Object.keys(this.indexByVariant);
    const hourBuckets = Object.keys(this.indexByTime);

    let oldestTimestamp = null;
    let newestTimestamp = null;

    if (this.dataPoints.length > 0) {
      const sorted = [...this.dataPoints].sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      oldestTimestamp = sorted[0].timestamp;
      newestTimestamp = sorted[sorted.length - 1].timestamp;
    }

    return {
      totalDataPoints: this.dataPoints.length,
      aggregateBuckets: Object.keys(this.aggregates).length,
      contentTypes,
      variants,
      hourBuckets: hourBuckets.length,
      oldestTimestamp,
      newestTimestamp,
      maxDataPoints: this.maxDataPoints,
      retentionDays: this.retentionDays
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.dataPoints = [];
    this.aggregates = {};
    this.indexByTime = {};
    this.indexByType = {};
    this.indexByVariant = {};
  }

  /**
   * Export data for backup
   *
   * @returns {Object} Export data
   */
  export() {
    return {
      exportedAt: new Date().toISOString(),
      dataPoints: this.dataPoints,
      aggregates: this.aggregates
    };
  }

  /**
   * Import data from backup
   *
   * @param {Object} data - Import data
   * @returns {number} Number of points imported
   */
  import(data) {
    if (!data.dataPoints) {
      throw new Error('Invalid import data: missing dataPoints');
    }

    for (const dp of data.dataPoints) {
      this.record(dp);
    }

    return data.dataPoints.length;
  }
}

// Singleton instance
export const temporalStore = new TemporalStore();

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 1 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase1() {
  const results = {
    passed: true,
    tests: []
  };

  // Create test store
  const store = new TemporalStore({ maxDataPoints: 1000, retentionDays: 7 });

  // Test 1: Record a data point
  const dp1 = store.record({
    contentType: 'Roadmap',
    variant: 'champion',
    qualityScore: 3.8,
    latency: 150,
    success: true
  });
  results.tests.push({
    name: 'Record data point',
    passed: dp1.id !== undefined && dp1.timestamp !== undefined,
    details: `id=${dp1.id}`
  });

  // Test 2: Validation rejects invalid data
  let validationWorks = false;
  try {
    store.record({ qualityScore: 3.5 });  // Missing contentType
  } catch (e) {
    validationWorks = true;
  }
  results.tests.push({
    name: 'Validation rejects invalid data',
    passed: validationWorks,
    details: `validationWorks=${validationWorks}`
  });

  // Test 3: Index by content type
  store.record({ contentType: 'Roadmap', variant: 'candidate', qualityScore: 4.0 });
  store.record({ contentType: 'Slides', variant: 'champion', qualityScore: 3.5 });
  results.tests.push({
    name: 'Index by content type',
    passed: store.indexByType['Roadmap'].length === 2 && store.indexByType['Slides'].length === 1,
    details: `Roadmap=${store.indexByType['Roadmap'].length}, Slides=${store.indexByType['Slides'].length}`
  });

  // Test 4: Index by variant
  results.tests.push({
    name: 'Index by variant',
    passed: store.indexByVariant['champion'].length === 2 && store.indexByVariant['candidate'].length === 1,
    details: `champion=${store.indexByVariant['champion'].length}, candidate=${store.indexByVariant['candidate'].length}`
  });

  // Test 5: Hour key generation
  const hourKey = store.getHourKey('2024-03-15T14:30:00.000Z');
  results.tests.push({
    name: 'Hour key generation',
    passed: hourKey === '2024-03-15-14',
    details: `hourKey=${hourKey}`
  });

  // Test 6: Day key generation
  const dayKey = store.getDayKey('2024-03-15T14:30:00.000Z');
  results.tests.push({
    name: 'Day key generation',
    passed: dayKey === '2024-03-15',
    details: `dayKey=${dayKey}`
  });

  // Test 7: Aggregates are created
  results.tests.push({
    name: 'Aggregates are created',
    passed: Object.keys(store.aggregates).length > 0,
    details: `aggregates=${Object.keys(store.aggregates).length}`
  });

  // Test 8: Query with filters
  const roadmapPoints = store.query({ contentType: 'Roadmap' });
  results.tests.push({
    name: 'Query with contentType filter',
    passed: roadmapPoints.length === 2,
    details: `found=${roadmapPoints.length}`
  });

  // Test 9: Query with variant filter
  const championPoints = store.query({ contentType: 'Roadmap', variant: 'champion' });
  results.tests.push({
    name: 'Query with variant filter',
    passed: championPoints.length === 1,
    details: `found=${championPoints.length}`
  });

  // Test 10: Get stats
  const stats = store.getStats();
  results.tests.push({
    name: 'Get stats',
    passed: stats.totalDataPoints === 3 && stats.contentTypes.length === 2,
    details: `total=${stats.totalDataPoints}, types=${stats.contentTypes.length}`
  });

  // Test 11: Export and import
  const exported = store.export();
  const store2 = new TemporalStore();
  const imported = store2.import(exported);
  results.tests.push({
    name: 'Export and import',
    passed: imported === 3 && store2.dataPoints.length === 3,
    details: `imported=${imported}`
  });

  // Test 12: Clear works
  store.clear();
  results.tests.push({
    name: 'Clear works',
    passed: store.dataPoints.length === 0 && Object.keys(store.aggregates).length === 0,
    details: `dataPoints=${store.dataPoints.length}, aggregates=${Object.keys(store.aggregates).length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase1();
  console.log('Temporal Storage Phase 1 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
