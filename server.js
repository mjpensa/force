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

// Import PROMPT ML optimization system
import { initializeVariants, getVariantRegistry } from './server/layers/optimization/variants/index.js';
import { startEvolution, stopEvolution } from './server/layers/optimization/evolution/index.js';
import { getMetricsCollector } from './server/layers/optimization/metrics/index.js';
import { getExperimentManager } from './server/layers/optimization/experiments/index.js';

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
  if (process.env.ENABLE_OPTIMIZATION === 'true') {
    stopEvolution();
    console.log('[PROMPT ML] Evolution scheduler stopped');
  }
  process.exit(0);
});

// Handle SIGINT gracefully (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: shutting down gracefully');
  shutdownMonitoring();
  shutdownOptimizers();
  if (process.env.ENABLE_OPTIMIZATION === 'true') {
    stopEvolution();
    console.log('[PROMPT ML] Evolution scheduler stopped');
  }
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

  // Initialize PROMPT ML optimization system if enabled
  if (process.env.ENABLE_OPTIMIZATION === 'true') {
    try {
      // Initialize variant registry with persistence
      const registry = getVariantRegistry({
        autoPersist: true,
        persistPath: join(__dirname, 'data', 'variants.json')
      });

      // Initialize default variants (champions for each content type)
      const variantResult = initializeVariants({
        registryConfig: { autoPersist: true }
      });

      if (variantResult.initialized) {
        console.log(`[PROMPT ML] Initialized ${variantResult.registered} variants`);
      } else {
        console.log(`[PROMPT ML] Variants already initialized (${variantResult.stats.totalVariants} variants)`);
      }

      // Initialize metrics collector with file persistence
      getMetricsCollector({
        storageConfig: {
          type: 'file',
          dataDir: join(__dirname, 'data', 'metrics')
        }
      });
      console.log('[PROMPT ML] Metrics collector initialized with file storage');

      // Initialize experiment manager with persistence
      getExperimentManager({
        autoPersist: true,
        persistPath: join(__dirname, 'data', 'experiments.json')
      });
      console.log('[PROMPT ML] Experiment manager initialized with file persistence');

      // Start evolution scheduler for auto-improving prompts
      const evolutionStats = startEvolution({
        intervalMs: 60 * 60 * 1000,  // Run every hour
        minImpressionsThreshold: 50,  // Need at least 50 impressions before evolving
        autoStartExperiments: true
      });
      console.log(`[PROMPT ML] Evolution scheduler started (interval: 1 hour)`);

    } catch (error) {
      console.warn('[PROMPT ML] Failed to initialize optimization system:', error.message);
    }
  } else {
    console.log('[PROMPT ML] Optimization disabled (set ENABLE_OPTIMIZATION=true to enable)');
  }
});
