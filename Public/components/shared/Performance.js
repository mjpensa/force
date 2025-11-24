/**
 * Performance Monitoring and Optimization Utilities
 * Helps track and improve application performance
 *
 * @module Performance
 */

/**
 * Performance metrics storage
 * @private
 */
const metrics = {
  marks: new Map(),
  measures: new Map(),
  resourceTimings: []
};

/**
 * Mark a performance timestamp
 * Used to measure time between two points
 *
 * @param {string} name - Name of the mark
 * @returns {number} Timestamp in milliseconds
 *
 * @example
 * markPerformance('view-load-start');
 * // ... load view ...
 * markPerformance('view-load-end');
 * measurePerformance('view-load', 'view-load-start', 'view-load-end');
 */
export function markPerformance(name) {
  const timestamp = performance.now();
  metrics.marks.set(name, timestamp);

  // Also use native Performance API if available
  if (performance.mark) {
    performance.mark(name);
  }

  return timestamp;
}

/**
 * Measure performance between two marks
 *
 * @param {string} name - Name of the measurement
 * @param {string} startMark - Name of start mark
 * @param {string} endMark - Name of end mark
 * @returns {number} Duration in milliseconds
 *
 * @example
 * const duration = measurePerformance('api-call', 'api-start', 'api-end');
 * console.log(`API call took ${duration}ms`);
 */
export function measurePerformance(name, startMark, endMark) {
  const startTime = metrics.marks.get(startMark);
  const endTime = metrics.marks.get(endMark);

  if (!startTime || !endTime) {
    console.warn(`Cannot measure ${name}: missing marks`);
    return 0;
  }

  const duration = endTime - startTime;
  metrics.measures.set(name, duration);

  // Use native Performance API if available
  if (performance.measure) {
    try {
      performance.measure(name, startMark, endMark);
    } catch (e) {
      // Ignore if marks don't exist in native API
    }
  }

  return duration;
}

/**
 * Log performance metrics to console
 * Useful for debugging and monitoring
 *
 * @param {string} label - Label for the log group
 */
export function logPerformanceMetrics(label = 'Performance Metrics') {
  console.group(label);

  if (metrics.measures.size === 0) {
    console.log('No measurements recorded');
  } else {
    metrics.measures.forEach((duration, name) => {
      console.log(`${name}: ${duration.toFixed(2)}ms`);
    });
  }

  console.groupEnd();
}

/**
 * Get all performance metrics
 *
 * @returns {Object} Object containing all marks and measures
 */
export function getPerformanceMetrics() {
  return {
    marks: Object.fromEntries(metrics.marks),
    measures: Object.fromEntries(metrics.measures),
    navigation: getNavigationTiming(),
    resources: getResourceTiming()
  };
}

/**
 * Get navigation timing information
 * Shows page load performance
 *
 * @returns {Object} Navigation timing metrics
 */
export function getNavigationTiming() {
  if (!performance.timing) {
    return {};
  }

  const timing = performance.timing;
  const navigation = {
    // DNS lookup time
    dnsTime: timing.domainLookupEnd - timing.domainLookupStart,

    // TCP connection time
    tcpTime: timing.connectEnd - timing.connectStart,

    // Time to first byte
    ttfb: timing.responseStart - timing.navigationStart,

    // Download time
    downloadTime: timing.responseEnd - timing.responseStart,

    // DOM processing time
    domProcessing: timing.domComplete - timing.domLoading,

    // Total load time
    loadTime: timing.loadEventEnd - timing.navigationStart,

    // DOM ready time
    domReady: timing.domContentLoadedEventEnd - timing.navigationStart
  };

  return navigation;
}

/**
 * Get resource timing information
 * Shows loading time for scripts, stylesheets, images, etc.
 *
 * @returns {Array<Object>} Array of resource timing entries
 */
export function getResourceTiming() {
  if (!performance.getEntriesByType) {
    return [];
  }

  const resources = performance.getEntriesByType('resource');
  return resources.map(resource => ({
    name: resource.name,
    type: resource.initiatorType,
    duration: resource.duration,
    size: resource.transferSize || 0
  }));
}

/**
 * Debounce function to limit rate of function execution
 * Improves performance by reducing unnecessary calls
 *
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 *
 * @example
 * const debouncedSearch = debounce((query) => {
 *   console.log('Searching:', query);
 * }, 300);
 *
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 */
export function debounce(func, wait) {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit rate of function execution
 * Ensures function runs at most once per specified time period
 *
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 *
 * @example
 * const throttledScroll = throttle(() => {
 *   console.log('Scrolling...');
 * }, 100);
 *
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle(func, limit) {
  let inThrottle;

  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Check if user prefers reduced motion
 * Use this to disable animations for accessibility
 *
 * @returns {boolean} True if user prefers reduced motion
 *
 * @example
 * if (!prefersReducedMotion()) {
 *   element.classList.add('animated');
 * }
 */
export function prefersReducedMotion() {
  if (!window.matchMedia) {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Monitor frame rate and detect performance issues
 * Useful for identifying jank and optimization opportunities
 *
 * @param {Function} callback - Called with FPS value
 * @param {number} interval - Check interval in milliseconds (default: 1000)
 * @returns {Function} Stop monitoring function
 *
 * @example
 * const stopMonitoring = monitorFrameRate((fps) => {
 *   console.log(`FPS: ${fps}`);
 *   if (fps < 30) {
 *     console.warn('Performance degradation detected');
 *   }
 * });
 *
 * // Later: stopMonitoring();
 */
export function monitorFrameRate(callback, interval = 1000) {
  let frames = 0;
  let lastTime = performance.now();
  let rafId;
  let intervalId;

  function countFrame() {
    frames++;
    rafId = requestAnimationFrame(countFrame);
  }

  intervalId = setInterval(() => {
    const currentTime = performance.now();
    const delta = currentTime - lastTime;
    const fps = Math.round((frames * 1000) / delta);

    callback(fps);

    frames = 0;
    lastTime = currentTime;
  }, interval);

  rafId = requestAnimationFrame(countFrame);

  return () => {
    cancelAnimationFrame(rafId);
    clearInterval(intervalId);
  };
}

/**
 * Report Web Vitals metrics
 * Core Web Vitals: LCP, FID, CLS
 *
 * @param {Function} callback - Called with vitals data
 *
 * @example
 * reportWebVitals((vital) => {
 *   console.log(vital.name, vital.value);
 * });
 */
export function reportWebVitals(callback) {
  // Largest Contentful Paint (LCP)
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        callback({
          name: 'LCP',
          value: lastEntry.renderTime || lastEntry.loadTime,
          rating: getRating(lastEntry.renderTime || lastEntry.loadTime, [2500, 4000])
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          callback({
            name: 'FID',
            value: entry.processingStart - entry.startTime,
            rating: getRating(entry.processingStart - entry.startTime, [100, 300])
          });
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
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
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('Web Vitals monitoring not supported:', e);
    }
  }
}

/**
 * Get rating (good/needs-improvement/poor) based on thresholds
 * @private
 */
function getRating(value, thresholds) {
  if (value <= thresholds[0]) return 'good';
  if (value <= thresholds[1]) return 'needs-improvement';
  return 'poor';
}

/**
 * Clear all performance metrics
 */
export function clearPerformanceMetrics() {
  metrics.marks.clear();
  metrics.measures.clear();
  metrics.resourceTimings = [];

  if (performance.clearMarks) {
    performance.clearMarks();
  }
  if (performance.clearMeasures) {
    performance.clearMeasures();
  }
}

/**
 * Default export with all utilities
 */
export default {
  markPerformance,
  measurePerformance,
  logPerformanceMetrics,
  getPerformanceMetrics,
  getNavigationTiming,
  getResourceTiming,
  debounce,
  throttle,
  prefersReducedMotion,
  monitorFrameRate,
  reportWebVitals,
  clearPerformanceMetrics
};
