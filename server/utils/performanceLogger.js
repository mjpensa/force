/**
 * Performance Logger for Content Generation
 *
 * Provides detailed timing instrumentation for:
 * - File processing
 * - Gemini API calls
 * - JSON parsing
 * - Overall generation pipeline
 *
 * Usage:
 *   const perf = new PerformanceLogger('generate-content');
 *   perf.mark('file-processing-start');
 *   // ... do work ...
 *   perf.mark('file-processing-end');
 *   perf.measure('file-processing', 'file-processing-start', 'file-processing-end');
 *   const report = perf.getReport();
 */

class PerformanceLogger {
  constructor(operationName, options = {}) {
    this.operationName = operationName;
    this.sessionId = options.sessionId || null;
    this.marks = new Map();
    this.measures = new Map();
    this.metadata = new Map();
    this.startTime = Date.now();
    this.enabled = options.enabled !== false; // Enabled by default

    // Auto-mark start
    this.mark('operation-start');
  }

  /**
   * Record a timing mark
   * @param {string} name - Mark name
   * @returns {number} Timestamp
   */
  mark(name) {
    if (!this.enabled) return Date.now();

    const timestamp = Date.now();
    const relativeTime = timestamp - this.startTime;
    this.marks.set(name, { timestamp, relativeTime });
    return timestamp;
  }

  /**
   * Measure duration between two marks
   * @param {string} name - Measure name
   * @param {string} startMark - Start mark name
   * @param {string} endMark - End mark name (optional, uses current time if not provided)
   * @returns {number} Duration in milliseconds
   */
  measure(name, startMark, endMark) {
    if (!this.enabled) return 0;

    const start = this.marks.get(startMark);
    let end = endMark ? this.marks.get(endMark) : null;

    if (!start) {
      console.warn(`[PerfLogger] Start mark "${startMark}" not found`);
      return 0;
    }

    if (!end) {
      // If no end mark, use current time
      const now = Date.now();
      end = { timestamp: now, relativeTime: now - this.startTime };
    }

    const duration = end.timestamp - start.timestamp;
    this.measures.set(name, {
      duration,
      startMark,
      endMark: endMark || 'now',
      startTime: start.relativeTime,
      endTime: end.relativeTime
    });

    return duration;
  }

  /**
   * Add metadata to the performance report
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   */
  setMetadata(key, value) {
    if (!this.enabled) return;
    this.metadata.set(key, value);
  }

  /**
   * Track token usage from Gemini response
   * @param {string} contentType - Content type (roadmap, slides, etc.)
   * @param {object} usageMetadata - Token usage from Gemini response
   */
  trackTokenUsage(contentType, usageMetadata) {
    if (!this.enabled || !usageMetadata) return;

    const tokenKey = `tokens-${contentType}`;
    this.metadata.set(tokenKey, {
      promptTokens: usageMetadata.promptTokenCount || 0,
      candidatesTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0
    });
  }

  /**
   * Get elapsed time since operation start
   * @returns {number} Elapsed time in milliseconds
   */
  getElapsedTime() {
    return Date.now() - this.startTime;
  }

  /**
   * Mark operation complete and generate report
   * @returns {object} Performance report
   */
  complete() {
    this.mark('operation-end');
    this.measure('total-duration', 'operation-start', 'operation-end');
    return this.getReport();
  }

  /**
   * Generate performance report
   * @returns {object} Detailed performance report
   */
  getReport() {
    const report = {
      operationName: this.operationName,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      totalDuration: this.getElapsedTime(),
      marks: Object.fromEntries(this.marks),
      measures: Object.fromEntries(this.measures),
      metadata: Object.fromEntries(this.metadata)
    };

    // Calculate summary statistics
    const contentTypes = ['roadmap', 'slides', 'document', 'research-analysis'];
    const apiTimings = {};
    let totalApiTime = 0;

    contentTypes.forEach(type => {
      const apiMeasure = this.measures.get(`api-${type}`);
      if (apiMeasure) {
        apiTimings[type] = apiMeasure.duration;
        totalApiTime += apiMeasure.duration;
      }
    });

    report.summary = {
      totalDuration: report.totalDuration,
      apiTimings,
      totalApiTime,
      fileProcessingTime: this.measures.get('file-processing')?.duration || 0,
      overheadTime: report.totalDuration - totalApiTime - (this.measures.get('file-processing')?.duration || 0)
    };

    // Token usage summary
    const tokenSummary = { total: 0, byContentType: {} };
    contentTypes.forEach(type => {
      const tokens = this.metadata.get(`tokens-${type}`);
      if (tokens) {
        tokenSummary.byContentType[type] = tokens;
        tokenSummary.total += tokens.totalTokens || 0;
      }
    });
    if (tokenSummary.total > 0) {
      report.summary.tokenUsage = tokenSummary;
    }

    return report;
  }

  /**
   * Log report to console (structured for production logging)
   */
  logReport() {
    if (!this.enabled) return;

    const report = this.getReport();

    // Log structured data for production monitoring
    console.log(JSON.stringify({
      type: 'performance',
      ...report
    }));

    return report;
  }
}

/**
 * Create a scoped timer for measuring a specific operation
 * @param {PerformanceLogger} logger - Parent logger
 * @param {string} name - Timer name
 * @returns {object} Timer with stop() method
 */
function createTimer(logger, name) {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  logger.mark(startMark);

  return {
    stop() {
      logger.mark(endMark);
      return logger.measure(name, startMark, endMark);
    }
  };
}

/**
 * Wrap an async function with automatic timing
 * @param {PerformanceLogger} logger - Parent logger
 * @param {string} name - Operation name
 * @param {Function} fn - Async function to wrap
 * @returns {Promise} Result of the function
 */
async function withTiming(logger, name, fn) {
  const timer = createTimer(logger, name);
  try {
    const result = await fn();
    timer.stop();
    return result;
  } catch (error) {
    timer.stop();
    logger.setMetadata(`${name}-error`, error.message);
    throw error;
  }
}

// Singleton for global metrics aggregation
const globalMetrics = {
  requests: [],
  maxStoredRequests: 100,

  addRequest(report) {
    this.requests.push(report);
    // Keep only last N requests to prevent memory leak
    if (this.requests.length > this.maxStoredRequests) {
      this.requests.shift();
    }
  },

  getAggregatedMetrics() {
    if (this.requests.length === 0) {
      return { message: 'No requests recorded yet' };
    }

    const durations = this.requests.map(r => r.totalDuration).sort((a, b) => a - b);
    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      requestCount: this.requests.length,
      latency: {
        min: durations[0],
        max: durations[durations.length - 1],
        avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        p50: durations[p50Index],
        p95: durations[p95Index] || durations[durations.length - 1],
        p99: durations[p99Index] || durations[durations.length - 1]
      },
      lastUpdated: new Date().toISOString()
    };
  },

  clear() {
    this.requests = [];
  }
};

export {
  PerformanceLogger,
  createTimer,
  withTiming,
  globalMetrics
};
