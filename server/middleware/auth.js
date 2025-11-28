/**
 * Authentication Middleware
 *
 * Provides JWT-based authentication and session ownership validation.
 * Designed for future user authentication while currently supporting
 * API key authentication for admin endpoints.
 */

import crypto from 'crypto';

// Use environment variable or generate secure random secret
// In production, JWT_SECRET should be set in environment
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// API keys for admin access (should be set in environment)
const ADMIN_API_KEYS = process.env.ADMIN_API_KEYS
  ? process.env.ADMIN_API_KEYS.split(',').map(k => k.trim())
  : [];

// Warn if no admin keys configured in production
if (process.env.NODE_ENV === 'production' && ADMIN_API_KEYS.length === 0) {
  console.warn('[AUTH] No ADMIN_API_KEYS configured - admin endpoints will be inaccessible');
}

/**
 * Generate a cryptographically secure session ID
 * Uses crypto.randomBytes instead of UUID for stronger entropy
 * @returns {string} 64-character hex session ID
 */
export function generateSecureSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secure random token for CSRF, API keys, etc.
 * @param {number} bytes - Number of bytes of entropy (default 32)
 * @returns {string} Hex-encoded token
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Simple JWT implementation for future user authentication
 * Note: For production, consider using jsonwebtoken library
 */
class SimpleJWT {
  /**
   * Create a JWT token
   * @param {Object} payload - Data to encode
   * @param {string} expiresIn - Expiration time (e.g., '24h', '7d')
   * @returns {string} JWT token
   */
  static sign(payload, expiresIn = '24h') {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    // Calculate expiration
    const now = Math.floor(Date.now() / 1000);
    let exp = now + 24 * 60 * 60; // Default 24 hours

    if (expiresIn.endsWith('h')) {
      exp = now + parseInt(expiresIn) * 60 * 60;
    } else if (expiresIn.endsWith('d')) {
      exp = now + parseInt(expiresIn) * 24 * 60 * 60;
    } else if (expiresIn.endsWith('m')) {
      exp = now + parseInt(expiresIn) * 60;
    }

    const tokenPayload = {
      ...payload,
      iat: now,
      exp
    };

    const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadBase64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerBase64}.${payloadBase64}`)
      .digest('base64url');

    return `${headerBase64}.${payloadBase64}.${signature}`;
  }

  /**
   * Verify and decode a JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded payload
   * @throws {Error} If token is invalid or expired
   */
  static verify(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerBase64, payloadBase64, signature] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerBase64}.${payloadBase64}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    return payload;
  }
}

/**
 * Generate a JWT token for a user
 * @param {Object} payload - User data to encode
 * @param {string} expiresIn - Expiration time
 * @returns {string} JWT token
 */
export function generateToken(payload, expiresIn = '24h') {
  return SimpleJWT.sign(payload, expiresIn);
}

/**
 * Middleware to verify JWT token from Authorization header
 * Extracts user info and attaches to req.user
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide a valid Bearer token in the Authorization header'
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = SimpleJWT.verify(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      message: error.message
    });
  }
}

/**
 * Middleware to verify API key for admin endpoints
 * Checks X-API-Key header against configured admin keys
 */
export function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide an API key in the X-API-Key header'
    });
  }

  if (ADMIN_API_KEYS.length === 0) {
    // No admin keys configured - deny all
    console.warn('[AUTH] Admin endpoint accessed but no ADMIN_API_KEYS configured');
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Admin access is not configured'
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  const isValid = ADMIN_API_KEYS.some(key => {
    if (key.length !== apiKey.length) return false;
    try {
      return crypto.timingSafeEqual(
        Buffer.from(key),
        Buffer.from(apiKey)
      );
    } catch {
      return false;
    }
  });

  if (!isValid) {
    console.warn(`[AUTH] Invalid API key attempt from ${req.ip}`);
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  req.isAdmin = true;
  next();
}

/**
 * Middleware to require admin access
 * Can be used after verifyToken to check admin flag
 */
export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin && !req.isAdmin) {
    return res.status(403).json({
      error: 'Admin access required',
      message: 'This endpoint requires administrator privileges'
    });
  }
  next();
}

/**
 * Middleware to optionally authenticate
 * Attaches user if token present, but doesn't require it
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      req.user = SimpleJWT.verify(token);
    } catch {
      // Token invalid, but that's okay for optional auth
      req.user = null;
    }
  }

  next();
}

/**
 * Rate limiting key generator based on user/IP
 * @param {Request} req - Express request
 * @returns {string} Rate limit key
 */
export function getRateLimitKey(req) {
  // If authenticated, use user ID
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  // Otherwise use IP address
  return `ip:${req.ip}`;
}

export default {
  generateSecureSessionId,
  generateSecureToken,
  generateToken,
  verifyToken,
  verifyApiKey,
  requireAdmin,
  optionalAuth,
  getRateLimitKey
};
