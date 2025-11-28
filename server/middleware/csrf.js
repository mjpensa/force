/**
 * CSRF Protection Middleware
 *
 * Implements double-submit cookie pattern for CSRF protection.
 * Tokens are tied to sessions and expire after a configurable time.
 */

import crypto from 'crypto';

// CSRF token configuration
const CSRF_CONFIG = {
  tokenLength: 32, // bytes
  tokenTTL: 60 * 60 * 1000, // 1 hour in milliseconds
  headerName: 'x-csrf-token',
  cookieName: 'csrf-token',
  maxTokensPerSession: 10, // Limit stored tokens per session
  cleanupInterval: 5 * 60 * 1000 // Cleanup every 5 minutes
};

// In-memory token storage (use Redis in production for multi-server deployments)
// Map<sessionId, Map<token, { createdAt, expiresAt }>>
const csrfTokens = new Map();

// Cleanup interval reference
let cleanupIntervalId = null;

/**
 * Generate a CSRF token for a session
 * @param {string} sessionId - Session identifier
 * @returns {string} CSRF token
 */
export function generateCsrfToken(sessionId) {
  if (!sessionId) {
    throw new Error('Session ID required for CSRF token generation');
  }

  const token = crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
  const now = Date.now();

  // Get or create session token map
  if (!csrfTokens.has(sessionId)) {
    csrfTokens.set(sessionId, new Map());
  }

  const sessionTokens = csrfTokens.get(sessionId);

  // Limit tokens per session to prevent memory exhaustion
  if (sessionTokens.size >= CSRF_CONFIG.maxTokensPerSession) {
    // Remove oldest token
    const oldestKey = sessionTokens.keys().next().value;
    sessionTokens.delete(oldestKey);
  }

  // Store token with expiration
  sessionTokens.set(token, {
    createdAt: now,
    expiresAt: now + CSRF_CONFIG.tokenTTL
  });

  return token;
}

/**
 * Validate a CSRF token for a session
 * @param {string} sessionId - Session identifier
 * @param {string} token - CSRF token to validate
 * @returns {boolean} Whether token is valid
 */
export function validateCsrfToken(sessionId, token) {
  if (!sessionId || !token) {
    return false;
  }

  const sessionTokens = csrfTokens.get(sessionId);
  if (!sessionTokens) {
    return false;
  }

  const tokenData = sessionTokens.get(token);
  if (!tokenData) {
    return false;
  }

  const now = Date.now();

  // Check expiration
  if (now > tokenData.expiresAt) {
    sessionTokens.delete(token);
    return false;
  }

  // Token is valid - optionally consume it (single-use tokens)
  // Uncomment the next line for single-use tokens:
  // sessionTokens.delete(token);

  return true;
}

/**
 * Invalidate all CSRF tokens for a session
 * Call this on logout or session invalidation
 * @param {string} sessionId - Session identifier
 */
export function invalidateSessionTokens(sessionId) {
  csrfTokens.delete(sessionId);
}

/**
 * Cleanup expired tokens
 * @returns {number} Number of expired tokens removed
 */
export function cleanupExpiredTokens() {
  const now = Date.now();
  let removed = 0;

  for (const [sessionId, sessionTokens] of csrfTokens) {
    for (const [token, data] of sessionTokens) {
      if (now > data.expiresAt) {
        sessionTokens.delete(token);
        removed++;
      }
    }

    // Remove empty session entries
    if (sessionTokens.size === 0) {
      csrfTokens.delete(sessionId);
    }
  }

  if (removed > 0) {
    console.log(`[CSRF] Cleaned up ${removed} expired tokens`);
  }

  return removed;
}

/**
 * Start periodic cleanup of expired tokens
 */
export function startCleanupInterval() {
  if (cleanupIntervalId) {
    return; // Already running
  }

  cleanupIntervalId = setInterval(cleanupExpiredTokens, CSRF_CONFIG.cleanupInterval);

  // Don't prevent process exit
  if (cleanupIntervalId.unref) {
    cleanupIntervalId.unref();
  }
}

/**
 * Stop periodic cleanup
 */
export function stopCleanupInterval() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

/**
 * Express middleware to validate CSRF token
 * Skips GET, HEAD, OPTIONS requests (safe methods)
 *
 * Usage:
 *   app.use(csrfProtection);
 *   // or on specific routes:
 *   router.post('/update', csrfProtection, handler);
 */
export function csrfProtection(req, res, next) {
  // Skip safe methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get session ID from header or body
  const sessionId = req.headers['x-session-id'] || req.body?.sessionId;

  if (!sessionId) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Session ID required for this operation'
    });
  }

  // Get CSRF token from header
  const csrfToken = req.headers[CSRF_CONFIG.headerName];

  if (!csrfToken) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'CSRF token required. Include it in the X-CSRF-Token header.'
    });
  }

  // Validate token
  if (!validateCsrfToken(sessionId, csrfToken)) {
    console.warn(`[CSRF] Invalid token for session ${sessionId.substring(0, 8)}...`);
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid or expired CSRF token. Please refresh and try again.'
    });
  }

  next();
}

/**
 * Express middleware to generate and attach CSRF token to response
 * Adds token to response header and optionally to JSON response
 *
 * Usage:
 *   router.get('/session', attachCsrfToken, (req, res) => {
 *     res.json({ sessionId: req.sessionId, csrfToken: req.csrfToken });
 *   });
 */
export function attachCsrfToken(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.body?.sessionId || req.query?.sessionId;

  if (sessionId) {
    const token = generateCsrfToken(sessionId);
    req.csrfToken = token;
    res.setHeader('X-CSRF-Token', token);
  }

  next();
}

/**
 * Get CSRF token endpoint handler
 * Returns a new CSRF token for the given session
 *
 * Usage:
 *   router.get('/csrf-token', getCsrfTokenHandler);
 */
export function getCsrfTokenHandler(req, res) {
  const sessionId = req.headers['x-session-id'] || req.query?.sessionId;

  if (!sessionId) {
    return res.status(400).json({
      error: 'Session ID required',
      message: 'Please provide session ID in X-Session-Id header or sessionId query parameter'
    });
  }

  const token = generateCsrfToken(sessionId);

  res.json({
    csrfToken: token,
    expiresIn: CSRF_CONFIG.tokenTTL / 1000, // seconds
    headerName: CSRF_CONFIG.headerName
  });
}

// Start cleanup on module load
startCleanupInterval();

export default {
  generateCsrfToken,
  validateCsrfToken,
  invalidateSessionTokens,
  cleanupExpiredTokens,
  csrfProtection,
  attachCsrfToken,
  getCsrfTokenHandler,
  startCleanupInterval,
  stopCleanupInterval,
  CSRF_CONFIG
};
