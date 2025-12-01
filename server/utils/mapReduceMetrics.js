/**
 * Map-Reduce Metrics Collector
 * 
 * Phase 6: Monitoring and observability for map-reduce operations.
 * Tracks performance, usage patterns, and quality metrics.
 * 
 * Integrates with existing monitoring infrastructure.
 */

// ============================================================================
// METRICS CONFIGURATION
// ============================================================================

const METRICS_CONFIG = {
  retentionPeriodMs: 24 * 60 * 60 * 1000,  // 24 hours
  maxHistorySize: 1000,                     // Max requests to track
  aggregationIntervalMs: 60 * 1000          // 1 minute aggregation
};

// ============================================================================
// METRICS STORAGE
// ============================================================================

// Request-level metrics history
const requestHistory = [];

// Aggregated metrics
const aggregatedMetrics = {
  totalRequests: 0,
  mapReduceRequests: 0,
  directRequests: 0,
  
  // Timing aggregates
  avgMapReduceTimeMs: 0,
  avgDirectTimeMs: 0,
  avgChunksPerRequest: 0,
  avgInsightsPerRequest: 0,
  
  // Cache performance
  totalCacheHits: 0,
  totalCacheMisses: 0,
  cacheHitRate: '0%',
  
  // Quality metrics
  avgQualityScore: 0,
  validationPassRate: '0%',
  
  // Error tracking
  totalErrors: 0,
  errorRate: '0%',
  
  // Size distribution
  contentSizeDistribution: {
    small: 0,    // < 20K chars
    medium: 0,   // 20K - 50K chars
    large: 0,    // 50K - 100K chars
    xlarge: 0    // > 100K chars
  },
  
  lastUpdated: null
};

// ============================================================================
// REQUEST TRACKING
// ============================================================================

/**
 * Record a map-reduce processing request
 * @param {object} data - Request metrics
 */
export function recordMapReduceRequest(data) {
  const {
    sessionId,
    contentType,
    strategy,           // 'direct' | 'map-reduce'
    totalSize,
    chunksProcessed = 0,
    extractionTimeMs = 0,
    consolidationTimeMs = 0,
    totalTimeMs,
    insightsExtracted = {},
    cacheHits = 0,
    cacheMisses = 0,
    qualityScore = null,
    validationPassed = null,
    error = null
  } = data;
  
  const request = {
    timestamp: Date.now(),
    sessionId,
    contentType,
    strategy,
    totalSize,
    chunksProcessed,
    extractionTimeMs,
    consolidationTimeMs,
    totalTimeMs,
    insightsExtracted,
    cacheHits,
    cacheMisses,
    qualityScore,
    validationPassed,
    error
  };
  
  // Add to history
  requestHistory.push(request);
  
  // Trim old entries
  trimHistory();
  
  // Update aggregates
  updateAggregates(request);
  
  // Log the request
  logRequest(request);
  
  return request;
}

/**
 * Remove old entries from history
 */
function trimHistory() {
  const cutoff = Date.now() - METRICS_CONFIG.retentionPeriodMs;
  
  while (requestHistory.length > 0 && requestHistory[0].timestamp < cutoff) {
    requestHistory.shift();
  }
  
  while (requestHistory.length > METRICS_CONFIG.maxHistorySize) {
    requestHistory.shift();
  }
}

/**
 * Update aggregated metrics
 * @param {object} request - Latest request
 */
function updateAggregates(request) {
  aggregatedMetrics.totalRequests++;
  
  if (request.strategy === 'map-reduce') {
    aggregatedMetrics.mapReduceRequests++;
    
    // Update map-reduce timing average
    const prevTotal = aggregatedMetrics.avgMapReduceTimeMs * (aggregatedMetrics.mapReduceRequests - 1);
    aggregatedMetrics.avgMapReduceTimeMs = Math.round(
      (prevTotal + request.totalTimeMs) / aggregatedMetrics.mapReduceRequests
    );
    
    // Update chunks average
    const prevChunks = aggregatedMetrics.avgChunksPerRequest * (aggregatedMetrics.mapReduceRequests - 1);
    aggregatedMetrics.avgChunksPerRequest = Math.round(
      (prevChunks + request.chunksProcessed) / aggregatedMetrics.mapReduceRequests * 10
    ) / 10;
    
  } else {
    aggregatedMetrics.directRequests++;
    
    // Update direct timing average
    const prevTotal = aggregatedMetrics.avgDirectTimeMs * (aggregatedMetrics.directRequests - 1);
    aggregatedMetrics.avgDirectTimeMs = Math.round(
      (prevTotal + request.totalTimeMs) / aggregatedMetrics.directRequests
    );
  }
  
  // Cache metrics
  aggregatedMetrics.totalCacheHits += request.cacheHits;
  aggregatedMetrics.totalCacheMisses += request.cacheMisses;
  const totalCacheOps = aggregatedMetrics.totalCacheHits + aggregatedMetrics.totalCacheMisses;
  aggregatedMetrics.cacheHitRate = totalCacheOps > 0
    ? Math.round((aggregatedMetrics.totalCacheHits / totalCacheOps) * 100) + '%'
    : '0%';
  
  // Quality metrics
  if (request.qualityScore !== null) {
    const prevQuality = aggregatedMetrics.avgQualityScore;
    const qualityCount = requestHistory.filter(r => r.qualityScore !== null).length;
    aggregatedMetrics.avgQualityScore = Math.round(
      ((prevQuality * (qualityCount - 1)) + parseFloat(request.qualityScore)) / qualityCount
    );
  }
  
  if (request.validationPassed !== null) {
    const passedCount = requestHistory.filter(r => r.validationPassed === true).length;
    const validatedCount = requestHistory.filter(r => r.validationPassed !== null).length;
    aggregatedMetrics.validationPassRate = validatedCount > 0
      ? Math.round((passedCount / validatedCount) * 100) + '%'
      : '0%';
  }
  
  // Error tracking
  if (request.error) {
    aggregatedMetrics.totalErrors++;
  }
  aggregatedMetrics.errorRate = aggregatedMetrics.totalRequests > 0
    ? Math.round((aggregatedMetrics.totalErrors / aggregatedMetrics.totalRequests) * 100) + '%'
    : '0%';
  
  // Content size distribution
  if (request.totalSize < 20000) {
    aggregatedMetrics.contentSizeDistribution.small++;
  } else if (request.totalSize < 50000) {
    aggregatedMetrics.contentSizeDistribution.medium++;
  } else if (request.totalSize < 100000) {
    aggregatedMetrics.contentSizeDistribution.large++;
  } else {
    aggregatedMetrics.contentSizeDistribution.xlarge++;
  }
  
  aggregatedMetrics.lastUpdated = new Date().toISOString();
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Log request details
 * @param {object} request 
 */
function logRequest(request) {
  const { strategy, contentType, totalSize, chunksProcessed, totalTimeMs, error } = request;
  
  if (error) {
    console.error(`[MapReduce] ERROR: ${contentType} - ${error}`);
    return;
  }
  
  const sizeKb = Math.round(totalSize / 1024);
  
  if (strategy === 'map-reduce') {
    console.log(
      `[MapReduce] ${contentType.toUpperCase()} | ` +
      `${sizeKb}KB → ${chunksProcessed} chunks | ` +
      `${totalTimeMs}ms total`
    );
  } else {
    console.log(
      `[MapReduce] ${contentType.toUpperCase()} | ` +
      `${sizeKb}KB (direct) | ` +
      `${totalTimeMs}ms`
    );
  }
}

/**
 * Log detailed extraction stats
 * @param {object} stats - Extraction statistics
 */
export function logExtractionStats(stats) {
  console.log(`[MapReduce] Extraction stats:`, {
    chunks: stats.totalChunks,
    success: stats.successfulExtractions,
    failed: stats.failedExtractions,
    cacheHits: stats.cacheHits || 0,
    facts: stats.totalKeyFacts,
    entities: stats.totalEntities,
    themes: stats.totalThemes,
    timeMs: stats.totalExtractionTime
  });
}

/**
 * Log consolidation stats
 * @param {object} stats - Consolidation statistics
 */
export function logConsolidationStats(stats) {
  console.log(`[MapReduce] Consolidation stats:`, {
    facts: stats.keyFactCount,
    entities: stats.entityCount,
    themes: stats.themeCount,
    dates: stats.dateCount,
    metrics: stats.metricCount,
    deduplicated: stats.duplicatesRemoved
  });
}

// ============================================================================
// METRICS RETRIEVAL
// ============================================================================

/**
 * Get aggregated metrics
 * @returns {object}
 */
export function getMapReduceMetrics() {
  return {
    ...aggregatedMetrics,
    recentRequests: requestHistory.length,
    requestsPerHour: calculateRequestsPerHour()
  };
}

/**
 * Get detailed request history
 * @param {object} options - Filter options
 * @returns {Array}
 */
export function getRequestHistory(options = {}) {
  const { 
    limit = 50, 
    strategy = null,
    contentType = null,
    errorsOnly = false 
  } = options;
  
  let filtered = [...requestHistory];
  
  if (strategy) {
    filtered = filtered.filter(r => r.strategy === strategy);
  }
  
  if (contentType) {
    filtered = filtered.filter(r => r.contentType === contentType);
  }
  
  if (errorsOnly) {
    filtered = filtered.filter(r => r.error !== null);
  }
  
  return filtered.slice(-limit).reverse();
}

/**
 * Calculate requests per hour
 * @returns {number}
 */
function calculateRequestsPerHour() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const recentCount = requestHistory.filter(r => r.timestamp > oneHourAgo).length;
  return recentCount;
}

/**
 * Get performance summary
 * @returns {object}
 */
export function getPerformanceSummary() {
  const mapReduceRequests = requestHistory.filter(r => r.strategy === 'map-reduce');
  const directRequests = requestHistory.filter(r => r.strategy === 'direct');
  
  return {
    mapReduce: {
      count: mapReduceRequests.length,
      avgTimeMs: mapReduceRequests.length > 0
        ? Math.round(mapReduceRequests.reduce((sum, r) => sum + r.totalTimeMs, 0) / mapReduceRequests.length)
        : 0,
      avgChunks: mapReduceRequests.length > 0
        ? Math.round(mapReduceRequests.reduce((sum, r) => sum + r.chunksProcessed, 0) / mapReduceRequests.length * 10) / 10
        : 0
    },
    direct: {
      count: directRequests.length,
      avgTimeMs: directRequests.length > 0
        ? Math.round(directRequests.reduce((sum, r) => sum + r.totalTimeMs, 0) / directRequests.length)
        : 0
    },
    comparison: {
      mapReducePercentage: requestHistory.length > 0
        ? Math.round((mapReduceRequests.length / requestHistory.length) * 100) + '%'
        : '0%',
      avgTimeRatio: directRequests.length > 0 && mapReduceRequests.length > 0
        ? Math.round(
            (mapReduceRequests.reduce((sum, r) => sum + r.totalTimeMs, 0) / mapReduceRequests.length) /
            (directRequests.reduce((sum, r) => sum + r.totalTimeMs, 0) / directRequests.length) * 10
          ) / 10
        : null
    }
  };
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics() {
  requestHistory.length = 0;
  
  aggregatedMetrics.totalRequests = 0;
  aggregatedMetrics.mapReduceRequests = 0;
  aggregatedMetrics.directRequests = 0;
  aggregatedMetrics.avgMapReduceTimeMs = 0;
  aggregatedMetrics.avgDirectTimeMs = 0;
  aggregatedMetrics.avgChunksPerRequest = 0;
  aggregatedMetrics.avgInsightsPerRequest = 0;
  aggregatedMetrics.totalCacheHits = 0;
  aggregatedMetrics.totalCacheMisses = 0;
  aggregatedMetrics.cacheHitRate = '0%';
  aggregatedMetrics.avgQualityScore = 0;
  aggregatedMetrics.validationPassRate = '0%';
  aggregatedMetrics.totalErrors = 0;
  aggregatedMetrics.errorRate = '0%';
  aggregatedMetrics.contentSizeDistribution = { small: 0, medium: 0, large: 0, xlarge: 0 };
  aggregatedMetrics.lastUpdated = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  recordMapReduceRequest,
  logExtractionStats,
  logConsolidationStats,
  getMapReduceMetrics,
  getRequestHistory,
  getPerformanceSummary,
  resetMetrics
};
