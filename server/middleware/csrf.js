/**
 * CSRF Token Generation
 *
 * Provides CSRF token generation for client requests.
 * Note: Full CSRF protection middleware is not currently applied to routes.
 */

import crypto from 'crypto';

// CSRF token configuration
const CSRF_CONFIG = {
  tokenLength: 32,
  tokenTTL: 60 * 60 * 1000, // 1 hour in milliseconds
  maxTokensPerSession: 10
};

// In-memory token storage
const csrfTokens = new Map();

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

  if (!csrfTokens.has(sessionId)) {
    csrfTokens.set(sessionId, new Map());
  }

  const sessionTokens = csrfTokens.get(sessionId);

  if (sessionTokens.size >= CSRF_CONFIG.maxTokensPerSession) {
    const oldestKey = sessionTokens.keys().next().value;
    sessionTokens.delete(oldestKey);
  }

  sessionTokens.set(token, {
    createdAt: now,
    expiresAt: now + CSRF_CONFIG.tokenTTL
  });

  return token;
}

/**
 * Get CSRF token endpoint handler
 * Returns a new CSRF token for the given session
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
    expiresIn: CSRF_CONFIG.tokenTTL / 1000,
    headerName: 'x-csrf-token'
  });
}

export default {
  generateCsrfToken,
  getCsrfTokenHandler
};
