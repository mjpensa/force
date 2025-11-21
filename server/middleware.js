/**
 * Middleware Configuration Module
 * Phase 4 Enhancement: Extracted from server.js
 * Centralizes security, rate limiting, and file upload configuration
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import { CONFIG } from './config.js';
import { getFileExtension } from './utils.js';

/**
 * Configure security headers using Helmet
 */
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: false, // Disabled to allow Tailwind CDN (will be removed in production)
    crossOriginEmbedderPolicy: false // Required for some external resources
  });
}

/**
 * Configure cache control headers
 */
export function configureCacheControl(req, res, next) {
  // Cache static assets for 1 day
  if (req.path.match(/\.(jpg|jpeg|png|gif|ico|css|js|svg)$/)) {
    res.set('Cache-Control', `public, max-age=${CONFIG.CACHE.STATIC_ASSETS_MAX_AGE}`);
  } else {
    // Don't cache HTML pages
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
}

/**
 * Configure request timeout middleware
 */
export function configureTimeout(req, res, next) {
  req.setTimeout(CONFIG.TIMEOUTS.REQUEST_MS);
  res.setTimeout(CONFIG.TIMEOUTS.RESPONSE_MS);
  next();
}

/**
 * Configure general API rate limiting
 */
export const apiLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT.WINDOW_MS,
  max: CONFIG.RATE_LIMIT.MAX_REQUESTS,
  message: {
    error: CONFIG.ERRORS.RATE_LIMIT_EXCEEDED
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: CONFIG.ERRORS.RATE_LIMIT_EXCEEDED
    });
  }
});

/**
 * Configure strict rate limiting for resource-intensive endpoints
 */
export const strictLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT.WINDOW_MS,
  max: CONFIG.RATE_LIMIT.STRICT_MAX_REQUESTS,
  message: {
    error: CONFIG.ERRORS.STRICT_RATE_LIMIT_EXCEEDED
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Strict rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: CONFIG.ERRORS.STRICT_RATE_LIMIT_EXCEEDED
    });
  }
});

/**
 * Configure multer for file uploads with security limits
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CONFIG.FILES.MAX_SIZE_BYTES,
    files: CONFIG.FILES.MAX_COUNT,
    fieldSize: CONFIG.FILES.MAX_FIELD_SIZE_BYTES
  },
  fileFilter: (req, file, cb) => {
    // Validate file types - check both MIME type and extension
    const allowedMimes = CONFIG.FILES.ALLOWED_MIMES;
    const fileExtension = getFileExtension(file.originalname);
    const allowedExtensions = CONFIG.FILES.ALLOWED_EXTENSIONS;

    // Check if MIME type is allowed
    if (allowedMimes.includes(file.mimetype)) {
      // For application/octet-stream, verify the extension
      if (file.mimetype === 'application/octet-stream') {
        if (allowedExtensions.includes(fileExtension)) {
          cb(null, true);
        } else {
          cb(new Error(CONFIG.ERRORS.INVALID_FILE_EXTENSION(fileExtension)));
        }
      } else {
        cb(null, true);
      }
    } else {
      cb(new Error(CONFIG.ERRORS.INVALID_FILE_TYPE(file.mimetype)));
    }
  }
});

/**
 * Configure multer for semantic routes
 * Accepts any fields (files and text) to support both 'files' and 'prompt' fields
 */
export const semanticUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CONFIG.FILES.MAX_SIZE_BYTES,
    files: CONFIG.FILES.MAX_COUNT,
    fieldSize: CONFIG.FILES.MAX_FIELD_SIZE_BYTES
  },
  fileFilter: (req, file, cb) => {
    // Validate file types - check both MIME type and extension
    const allowedMimes = CONFIG.FILES.ALLOWED_MIMES;
    const fileExtension = getFileExtension(file.originalname);
    const allowedExtensions = CONFIG.FILES.ALLOWED_EXTENSIONS;

    // Check if MIME type is allowed
    if (allowedMimes.includes(file.mimetype)) {
      // For application/octet-stream, verify the extension
      if (file.mimetype === 'application/octet-stream') {
        if (allowedExtensions.includes(fileExtension)) {
          cb(null, true);
        } else {
          cb(new Error(CONFIG.ERRORS.INVALID_FILE_EXTENSION(fileExtension)));
        }
      } else {
        cb(null, true);
      }
    } else {
      cb(new Error(CONFIG.ERRORS.INVALID_FILE_TYPE(file.mimetype)));
    }
  }
}).any(); // .any() accepts any field names (both 'files' and 'prompt')

/**
 * Error handling middleware for file upload errors
 */
export function handleUploadErrors(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    // Multer-specific errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: CONFIG.ERRORS.FILE_TOO_LARGE });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: CONFIG.ERRORS.TOO_MANY_FILES });
    }
    if (error.code === 'LIMIT_FIELD_VALUE') {
      return res.status(400).json({ error: CONFIG.ERRORS.FIELD_TOO_LARGE });
    }
    return res.status(400).json({ error: `Upload error: ${error.message}` });
  }

  // Other errors (including fileFilter errors)
  if (error) {
    console.error('Server error:', error);
    return res.status(400).json({ error: error.message || 'An error occurred processing your request.' });
  }

  next();
}
