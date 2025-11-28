/**
 * Network Optimization Utilities
 *
 * Performance optimizations:
 * - Enhanced compression with smart filtering
 * - JSON response size optimization
 * - Connection optimization (Keep-Alive)
 * - Resource preload hints
 */

import compression from 'compression';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Compression settings
  compression: {
    level: 6,  // Balance between compression ratio and CPU (1-9)
    threshold: 1024,  // Only compress responses > 1KB
    memLevel: 8,  // Memory usage for compression (1-9)
    // Content types to compress
    compressibleTypes: [
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'application/json',
      'text/xml',
      'application/xml',
      'text/plain',
      'image/svg+xml'
    ]
  },
  // Keep-Alive settings
  keepAlive: {
    timeout: 65,  // Keep connection open for 65 seconds (> typical 60s proxy timeout)
    max: 100  // Max requests per connection
  },
  // Critical resources for preloading
  // Note: JS files with cache-busting query params are excluded to avoid preload/use mismatch
  criticalResources: {
    // Main entry point preloads (CSS only - JS has cache-busting params)
    '/': [
      { href: '/styles/design-system.css', as: 'style' },
      { href: '/style.css', as: 'style' }
    ],
    // Viewer page preloads (CSS only - JS has cache-busting params)
    '/viewer.html': [
      { href: '/styles/design-system.css', as: 'style' },
      { href: '/style.css', as: 'style' }
    ]
  }
};

// ============================================================================
// ENHANCED COMPRESSION MIDDLEWARE
// ============================================================================

/**
 * Custom compression filter
 * Only compresses content types that benefit from compression
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @returns {boolean} Whether to compress
 */
function shouldCompress(req, res) {
  // Don't compress if explicitly requested not to
  if (req.headers['x-no-compression']) {
    return false;
  }

  // Skip compression for already compressed formats
  const contentType = res.getHeader('Content-Type');
  if (contentType) {
    const type = contentType.toString().split(';')[0].trim();

    // Skip already compressed formats (images, video, etc.)
    if (/^(image\/(jpeg|png|gif|webp)|video\/|audio\/|application\/(zip|gzip|pdf))/.test(type)) {
      return false;
    }

    // Check if type is in compressible list
    if (CONFIG.compression.compressibleTypes.some(t => type.includes(t))) {
      return true;
    }
  }

  // Fall back to compression's default filter
  return compression.filter(req, res);
}

/**
 * Create enhanced compression middleware
 * @returns {Function} Express middleware
 */
export function createCompressionMiddleware() {
  return compression({
    filter: shouldCompress,
    level: CONFIG.compression.level,
    threshold: CONFIG.compression.threshold,
    memLevel: CONFIG.compression.memLevel,
    // Use gzip as primary, deflate as fallback
    // Most browsers support gzip and it has good compression ratio
  });
}

// ============================================================================
// JSON RESPONSE OPTIMIZER
// ============================================================================

/**
 * Recursively remove null, undefined, and empty values from object
 * @param {*} obj - Object to clean
 * @param {object} options - Cleaning options
 * @returns {*} Cleaned object
 */
export function cleanJsonResponse(obj, options = {}) {
  const {
    removeNull = true,
    removeUndefined = true,
    removeEmptyStrings = false,
    removeEmptyArrays = false,
    removeEmptyObjects = false
  } = options;

  if (obj === null) return removeNull ? undefined : null;
  if (obj === undefined) return undefined;

  if (Array.isArray(obj)) {
    const cleaned = obj
      .map(item => cleanJsonResponse(item, options))
      .filter(item => item !== undefined);
    if (removeEmptyArrays && cleaned.length === 0) {
      return undefined;
    }
    return cleaned;
  }

  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanJsonResponse(value, options);
      if (cleanedValue !== undefined) {
        if (removeEmptyStrings && cleanedValue === '') continue;
        cleaned[key] = cleanedValue;
      }
    }
    if (removeEmptyObjects && Object.keys(cleaned).length === 0) {
      return undefined;
    }
    return cleaned;
  }

  return obj;
}

/**
 * Send optimized JSON response
 * Removes nulls and undefined values to reduce payload size
 * @param {Response} res - Express response
 * @param {*} data - Data to send
 * @param {object} options - Options
 */
export function sendOptimizedJson(res, data, options = {}) {
  const {
    statusCode = 200,
    cleanOptions = { removeNull: true, removeUndefined: true }
  } = options;

  const cleaned = cleanJsonResponse(data, cleanOptions);
  res.status(statusCode).json(cleaned);
}

/**
 * Create middleware that adds optimized JSON method to response
 * @returns {Function} Express middleware
 */
export function createJsonOptimizerMiddleware() {
  return (req, res, next) => {
    // Add optimized JSON sender to response
    res.jsonOptimized = function(data, options) {
      sendOptimizedJson(res, data, options);
    };
    next();
  };
}

// ============================================================================
// CONNECTION OPTIMIZATION MIDDLEWARE
// ============================================================================

/**
 * Create connection optimization middleware
 * Sets Keep-Alive headers for persistent connections
 * @returns {Function} Express middleware
 */
export function createConnectionOptimizer() {
  return (req, res, next) => {
    // Set Keep-Alive header for HTTP/1.1
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', `timeout=${CONFIG.keepAlive.timeout}, max=${CONFIG.keepAlive.max}`);

    // Add timing info for debugging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('X-Request-Start', Date.now().toString());
    }

    next();
  };
}

// ============================================================================
// RESOURCE PRELOAD HINTS MIDDLEWARE
// ============================================================================

/**
 * Build Link header value for preload hints
 * @param {Array} resources - Array of resource objects
 * @returns {string} Link header value
 */
function buildPreloadLinks(resources) {
  return resources.map(resource => {
    let link = `<${resource.href}>; rel=preload; as=${resource.as}`;
    if (resource.crossorigin) {
      link += `; crossorigin=${resource.crossorigin}`;
    }
    if (resource.type) {
      link += `; type=${resource.type}`;
    }
    return link;
  }).join(', ');
}

/**
 * Create preload hints middleware
 * Adds Link headers for critical resources
 * @returns {Function} Express middleware
 */
export function createPreloadHintsMiddleware() {
  return (req, res, next) => {
    const path = req.path;

    // Check for HTML requests
    const acceptHeader = req.headers.accept || '';
    const isHtmlRequest = acceptHeader.includes('text/html') ||
                          path.endsWith('.html') ||
                          path === '/';

    if (isHtmlRequest) {
      // Get resources for this path (or default)
      const resources = CONFIG.criticalResources[path] ||
                        CONFIG.criticalResources['/'];

      if (resources && resources.length > 0) {
        const linkHeader = buildPreloadLinks(resources);
        res.setHeader('Link', linkHeader);
      }

      // Add Early Hints status for HTTP/2+ (103 Early Hints)
      // Note: This requires HTTP/2 server support
      // res.writeEarlyHints is not available in standard Express
    }

    next();
  };
}

// ============================================================================
// RESPONSE SIZE TRACKING MIDDLEWARE
// ============================================================================

/**
 * Create middleware that tracks response sizes for monitoring
 * @param {Function} onResponse - Callback with size info
 * @returns {Function} Express middleware
 */
export function createResponseSizeTracker(onResponse) {
  return (req, res, next) => {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Track JSON responses
    res.json = function(data) {
      const json = JSON.stringify(data);
      const size = Buffer.byteLength(json, 'utf8');

      if (onResponse) {
        onResponse({
          path: req.path,
          method: req.method,
          size,
          duration: Date.now() - startTime,
          type: 'json'
        });
      }

      return originalJson(data);
    };

    // Track other responses
    res.send = function(data) {
      const size = typeof data === 'string'
        ? Buffer.byteLength(data, 'utf8')
        : (Buffer.isBuffer(data) ? data.length : 0);

      if (onResponse) {
        onResponse({
          path: req.path,
          method: req.method,
          size,
          duration: Date.now() - startTime,
          type: 'send'
        });
      }

      return originalSend(data);
    };

    next();
  };
}

// ============================================================================
// VARY HEADER MIDDLEWARE
// ============================================================================

/**
 * Create middleware that sets proper Vary headers for caching
 * @returns {Function} Express middleware
 */
export function createVaryMiddleware() {
  return (req, res, next) => {
    // Add Vary header for proper cache invalidation
    // This tells CDNs/browsers to cache different versions based on these headers
    res.vary('Accept-Encoding');  // Different cached versions for gzip/deflate/none
    res.vary('Accept');  // Different cached versions for different content types
    next();
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createCompressionMiddleware,
  cleanJsonResponse,
  sendOptimizedJson,
  createJsonOptimizerMiddleware,
  createConnectionOptimizer,
  createPreloadHintsMiddleware,
  createResponseSizeTracker,
  createVaryMiddleware,
  CONFIG
};
