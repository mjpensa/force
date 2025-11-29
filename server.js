/**
 * AI Roadmap Generator - Main Server
 *
 * This file serves as a lightweight orchestrator, coordinating between modules:
 * - server/config.js - Configuration and environment validation
 * - server/middleware.js - Security, rate limiting, file upload
 * - server/gemini.js - Gemini API integration
 * - server/prompts.js - AI prompts and schemas
 * - server/routes/charts.js - Chart generation endpoints
 * - server/routes/analysis.js - Task analysis and Q&A endpoints
 * - server/utils.js - Utility functions
 *
 * Note: No persistence - all content is generated and returned directly
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';

// Import configuration (validates environment on load)
import { CONFIG } from './server/config.js';

// Import middleware
import {
  configureHelmet,
  configureCacheControl,
  configureTimeout,
  handleUploadErrors
} from './server/middleware.js';

// Import network optimization utilities
import {
  createCompressionMiddleware,
  createConnectionOptimizer,
  createPreloadHintsMiddleware,
  createJsonOptimizerMiddleware,
  createVaryMiddleware
} from './server/utils/networkOptimizer.js';

// Import routes
import chartRoutes from './server/routes/charts.js';
import analysisRoutes from './server/routes/analysis.js';
import contentRoutes from './server/routes/content.js';
import feedbackRoutes from './server/routes/feedback.js';
import autoOptimizeRoutes from './server/routes/auto-optimize.js';

// Import advanced optimizers
import { initializeOptimizers, shutdownOptimizers } from './server/utils/advancedOptimizer.js';

// Import cache management
import { clearAllCaches } from './server/cache/contentCache.js';

// Import monitoring system
import { initializeMonitoring, shutdownMonitoring } from './server/utils/monitoring.js';

// --- Server Setup ---
const app = express();
const port = CONFIG.SERVER.PORT;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure trust proxy for Railway deployment
app.set('trust proxy', CONFIG.SERVER.TRUST_PROXY_HOPS);

// --- Apply Middleware ---
// Enhanced compression middleware (gzip/deflate with smart filtering)
app.use(createCompressionMiddleware());

// Connection optimization (Keep-Alive headers)
app.use(createConnectionOptimizer());

// Vary headers for proper caching
app.use(createVaryMiddleware());

// JSON response optimizer (adds res.jsonOptimized method)
app.use(createJsonOptimizerMiddleware());

// Resource preload hints for critical assets
app.use(createPreloadHintsMiddleware());

// Security headers (apply early for all responses)
app.use(configureHelmet());

// Remove X-Powered-By header
app.disable('x-powered-by');

// Cache control
app.use(configureCacheControl);

// Static file serving with optimized options
// IMPORTANT: Static files are served BEFORE CORS middleware
// This ensures ES modules and other static assets load without CORS restrictions
// (they are same-origin by design since they're served from the same server)
app.use(express.static(join(__dirname, 'Public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true
}));

// Serve minified JS in production
if (process.env.NODE_ENV === 'production') {
  app.use('/dist', express.static(join(__dirname, 'Public', 'dist'), {
    maxAge: '7d',
    immutable: true
  }));
}

// JSON parsing with size limit (only needed for API routes)
const bodyLimit = process.env.REQUEST_BODY_LIMIT || '50mb';
app.use(express.json({ limit: bodyLimit }));

// CORS configuration - secure by default (only applies to API routes now)
const getAllowedOrigins = () => {
  // If explicitly configured, use that
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }

  // In production, auto-detect from Railway environment variables
  if (process.env.NODE_ENV === 'production') {
    const origins = [];

    // Railway provides RAILWAY_PUBLIC_DOMAIN for the deployed service
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      origins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
      console.log(`[CORS] Auto-detected Railway origin: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    }

    // Also check for custom domain if configured
    if (process.env.RAILWAY_STATIC_URL) {
      origins.push(process.env.RAILWAY_STATIC_URL);
    }

    if (origins.length > 0) {
      return origins;
    }

    console.warn('[SECURITY] ALLOWED_ORIGINS not set and Railway domain not detected - using restrictive default');
    return [];
  }

  // Development defaults
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
};

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    // Allow requests with no origin (same-origin, Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Session-Id'],
  credentials: true,
  maxAge: 86400 // 24 hours
}))

// Request timeout
app.use(configureTimeout);

// --- Health Check Endpoint ---
let serverStartTime = null;
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    startedAt: serverStartTime,
    uptime: serverStartTime ? Math.floor((Date.now() - new Date(serverStartTime).getTime()) / 1000) : 0
  });
});

// --- Mount Routes ---
app.use('/', chartRoutes);
app.use('/', analysisRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/auto-optimize', autoOptimizeRoutes);

// --- Error Handling ---
app.use(handleUploadErrors);

// --- Global Error Handlers ---
// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  console.error('Server will exit due to uncaught exception');
  process.exit(1);
});

// Handle SIGTERM gracefully (for deployment platforms like Railway)
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server gracefully');
  shutdownMonitoring();
  shutdownOptimizers();
  process.exit(0);
});

// Handle SIGINT gracefully (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: shutting down gracefully');
  shutdownMonitoring();
  shutdownOptimizers();
  process.exit(0);
});

// --- Start Server ---
serverStartTime = new Date().toISOString();
app.listen(port, () => {
  console.log('AI Roadmap Generator Server');
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server started at: ${serverStartTime}`);
  console.log('All modules loaded successfully');
  console.log('No persistence - content generated on demand');

  // Clear stale cache data on startup to ensure fresh generation with latest fixes
  clearAllCaches();
  console.log('Cache cleared on startup');

  // Initialize advanced optimizers (connection prewarming, etc.)
  initializeOptimizers();

  // Initialize monitoring system (metrics snapshots, alerting)
  initializeMonitoring();
});
