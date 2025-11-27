/**
 * Performance Monitoring Module
 *
 * Provides comprehensive performance tracking for the Force application:
 * - Custom performance marks and measures
 * - Web Vitals (LCP, FID, CLS)
 * - Content generation timing (TTFC, TGWT)
 * - API request timing
 * - Render performance
 */

const metrics = {
  marks: new Map(),
  measures: new Map(),
  contentTimings: new Map(),
  apiTimings: []
};

// Generation timing thresholds (in ms) for rating
const GENERATION_THRESHOLDS = {
  TTFC: [30000, 60000],     // Time to First Content: good < 30s, needs-improvement < 60s
  TGWT: [120000, 300000],   // Total Generation Wait Time: good < 2min, needs-improvement < 5min
  API: [10000, 30000],      // Single API call: good < 10s, needs-improvement < 30s
  RENDER: [100, 500]        // Render time: good < 100ms, needs-improvement < 500ms
};

/**
 * Record a performance mark
 * @param {string} name - Mark name
 * @returns {number} Timestamp (performance.now())
 */
export function markPerformance(name) {
  const timestamp = performance.now();
  metrics.marks.set(name, timestamp);
  if (performance.mark) {
    try {
      performance.mark(name);
    } catch (e) {
      // Ignore duplicate mark errors
    }
  }
  return timestamp;
}

/**
 * Measure duration between two marks
 * @param {string} name - Measure name
 * @param {string} startMark - Start mark name
 * @param {string} endMark - End mark name
 * @returns {number} Duration in milliseconds
 */
export function measurePerformance(name, startMark, endMark) {
  const startTime = metrics.marks.get(startMark);
  const endTime = metrics.marks.get(endMark);
  if (!startTime || !endTime) return 0;
  const duration = endTime - startTime;
  metrics.measures.set(name, duration);

  // Also use native Performance API if available
  if (performance.measure) {
    try {
      performance.measure(name, startMark, endMark);
    } catch (e) {
      // Ignore errors (marks may not exist in native API)
    }
  }

  return duration;
}

/**
 * Track content generation timing
 * @param {string} contentType - Type of content (roadmap, slides, document, research-analysis)
 * @param {string} event - Event type (start, received, rendered)
 */
export function trackContentTiming(contentType, event) {
  const key = `${contentType}-${event}`;
  const timestamp = performance.now();
  metrics.contentTimings.set(key, timestamp);
  markPerformance(key);
  return timestamp;
}

/**
 * Get Time to First Content (TTFC) - time from generation start to first content rendered
 * @returns {object|null} TTFC metrics or null if not available
 */
export function getTimeToFirstContent() {
  const genStart = metrics.marks.get('generation-started') || metrics.marks.get('viewer-init-start');
  if (!genStart) return null;

  // Find the earliest content received
  const contentTypes = ['roadmap', 'slides', 'document', 'research-analysis'];
  let earliestReceived = Infinity;
  let firstContentType = null;

  for (const type of contentTypes) {
    const receivedTime = metrics.contentTimings.get(`${type}-received`);
    if (receivedTime && receivedTime < earliestReceived) {
      earliestReceived = receivedTime;
      firstContentType = type;
    }
  }

  if (earliestReceived === Infinity) return null;

  const duration = earliestReceived - genStart;
  return {
    name: 'TTFC',
    value: duration,
    firstContentType,
    rating: getRating(duration, GENERATION_THRESHOLDS.TTFC)
  };
}

/**
 * Get Total Generation Wait Time (TGWT) - time until all content is available
 * @returns {object|null} TGWT metrics or null if not available
 */
export function getTotalGenerationWaitTime() {
  const genStart = metrics.marks.get('generation-started') || metrics.marks.get('viewer-init-start');
  if (!genStart) return null;

  const allContentReady = metrics.marks.get('all-content-ready');
  if (!allContentReady) return null;

  const duration = allContentReady - genStart;
  return {
    name: 'TGWT',
    value: duration,
    rating: getRating(duration, GENERATION_THRESHOLDS.TGWT)
  };
}

/**
 * Track an API request timing
 * @param {string} endpoint - API endpoint
 * @param {number} duration - Request duration in ms
 * @param {boolean} success - Whether the request succeeded
 */
export function trackApiTiming(endpoint, duration, success = true) {
  metrics.apiTimings.push({
    endpoint,
    duration,
    success,
    timestamp: Date.now()
  });

  // Keep only last 50 API timings
  if (metrics.apiTimings.length > 50) {
    metrics.apiTimings.shift();
  }
}

/**
 * Get aggregated API timing statistics
 * @returns {object} API timing stats
 */
export function getApiTimingStats() {
  if (metrics.apiTimings.length === 0) {
    return { count: 0, avg: 0, min: 0, max: 0, successRate: 0 };
  }

  const durations = metrics.apiTimings.map(t => t.duration);
  const successCount = metrics.apiTimings.filter(t => t.success).length;

  return {
    count: metrics.apiTimings.length,
    avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    min: Math.min(...durations),
    max: Math.max(...durations),
    successRate: Math.round((successCount / metrics.apiTimings.length) * 100)
  };
}

/**
 * Get rating based on value and thresholds
 * @param {number} value - The value to rate
 * @param {number[]} thresholds - [good, needs-improvement] thresholds
 * @returns {string} Rating: 'good', 'needs-improvement', or 'poor'
 */
function getRating(value, thresholds) {
  return value <= thresholds[0] ? 'good' : value <= thresholds[1] ? 'needs-improvement' : 'poor';
}

/**
 * Log all collected performance metrics
 * @param {string} label - Label for the log output
 */
export function logPerformanceMetrics(label = 'Performance Metrics') {
  const report = {
    label,
    timestamp: new Date().toISOString(),
    marks: Object.fromEntries(metrics.marks),
    measures: Object.fromEntries(metrics.measures),
    contentTimings: Object.fromEntries(metrics.contentTimings),
    ttfc: getTimeToFirstContent(),
    tgwt: getTotalGenerationWaitTime(),
    apiStats: getApiTimingStats()
  };

  console.log('[Performance]', JSON.stringify(report, null, 2));
  return report;
}

/**
 * Get all collected metrics
 * @returns {object} All metrics
 */
export function getAllMetrics() {
  return {
    marks: Object.fromEntries(metrics.marks),
    measures: Object.fromEntries(metrics.measures),
    contentTimings: Object.fromEntries(metrics.contentTimings),
    apiTimings: metrics.apiTimings,
    ttfc: getTimeToFirstContent(),
    tgwt: getTotalGenerationWaitTime(),
    apiStats: getApiTimingStats()
  };
}

/**
 * Clear all metrics (useful for testing or new sessions)
 */
export function clearMetrics() {
  metrics.marks.clear();
  metrics.measures.clear();
  metrics.contentTimings.clear();
  metrics.apiTimings.length = 0;
}

/**
 * Report Web Vitals (LCP, FID, CLS)
 * @param {Function} callback - Callback function receiving vital metrics
 */
export function reportWebVitals(callback) {
  if (!('PerformanceObserver' in window)) return;

  try {
    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      const value = last.renderTime || last.loadTime;
      callback({
        name: 'LCP',
        value,
        rating: getRating(value, [2500, 4000]),
        entries: entries.length
      });
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const value = entry.processingStart - entry.startTime;
        callback({
          name: 'FID',
          value,
          rating: getRating(value, [100, 300])
        });
      });
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      callback({
        name: 'CLS',
        value: clsValue,
        rating: getRating(clsValue, [0.1, 0.25])
      });
    }).observe({ entryTypes: ['layout-shift'] });

    // Long Tasks (tasks blocking main thread > 50ms)
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        callback({
          name: 'LongTask',
          value: entry.duration,
          rating: entry.duration > 100 ? 'poor' : 'needs-improvement'
        });
      });
    }).observe({ entryTypes: ['longtask'] });

  } catch (e) {
    // PerformanceObserver not supported for some entry types
  }
}

/**
 * Debounce function - delays execution until after wait ms of no calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function - limits execution to once per limit ms
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit time in ms
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export default {
  markPerformance,
  measurePerformance,
  trackContentTiming,
  getTimeToFirstContent,
  getTotalGenerationWaitTime,
  trackApiTiming,
  getApiTimingStats,
  logPerformanceMetrics,
  getAllMetrics,
  clearMetrics,
  reportWebVitals,
  debounce,
  throttle
};
