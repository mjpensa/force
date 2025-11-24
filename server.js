/**
 * AI Roadmap Generator - Main Server
 * Phase 4 Enhancement: Refactored into modular architecture
 *
 * Previous size: 959 lines
 * Current size: ~100 lines (90% reduction)
 *
 * This file now serves as a lightweight orchestrator, coordinating between modules:
 * - server/config.js - Configuration and environment validation
 * - server/middleware.js - Security, rate limiting, file upload
 * - server/storage.js - Session, chart, and job management
 * - server/gemini.js - Gemini API integration
 * - server/prompts.js - AI prompts and schemas
 * - server/routes/charts.js - Chart generation endpoints
 * - server/routes/analysis.js - Task analysis and Q&A endpoints
 * - server/utils.js - Utility functions
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import cors from 'cors';

// Import configuration (validates environment on load)
import { CONFIG } from './server/config.js';

// Import middleware
import {
  configureHelmet,
  configureCacheControl,
  configureTimeout,
  uploadMiddleware,
  handleUploadErrors
} from './server/middleware.js';

// Import storage management
import { startCleanupInterval } from './server/storage.js';

// Import database (Phase 2)
import { initializeDatabase, getDatabaseInfo } from './server/db.js';

// Import routes
import chartRoutes from './server/routes/charts.js';
import analysisRoutes from './server/routes/analysis.js';
import contentRoutes from './server/routes/content.js';

// --- Server Setup ---
const app = express();
const port = CONFIG.SERVER.PORT;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure trust proxy for Railway deployment
app.set('trust proxy', CONFIG.SERVER.TRUST_PROXY_HOPS);

// --- Apply Middleware ---
// Compression middleware (gzip/deflate)
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Security headers
app.use(configureHelmet());

// Remove X-Powered-By header
app.disable('x-powered-by');

// Cache control
app.use(configureCacheControl);

// JSON parsing with size limit
app.use(express.json({ limit: '50mb' }));

// Static file serving
app.use(express.static(join(__dirname, 'Public')));

// Request timeout
app.use(configureTimeout);

// --- Health Check Endpoint ---
// Useful for diagnosing server restarts
let serverStartTime = null;
app.get('/api/health', (req, res) => {
  const dbInfo = getDatabaseInfo();
  res.json({
    status: 'healthy',
    startedAt: serverStartTime,
    uptime: serverStartTime ? Math.floor((Date.now() - new Date(serverStartTime).getTime()) / 1000) : 0,
    database: {
      isEmpty: dbInfo.isEmpty,
      sessions: dbInfo.sessions,
      content: dbInfo.content
    }
  });
});

// --- Mount Routes ---
// Mount routes without global upload middleware (upload middleware is applied per-route where needed)
app.use('/', chartRoutes);
app.use('/', analysisRoutes);
app.use('/api/content', contentRoutes);

// --- Error Handling ---
app.use(handleUploadErrors);

// --- Global Error Handlers (P2-3: Missing Error Boundaries Fix) ---
// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
  // In production, you might want to log to a monitoring service
  // For now, we log and continue (but this should be investigated)
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  // For uncaught exceptions, we should exit gracefully after logging
  // This prevents the app from running in an undefined state
  console.error('⚠️  Server will exit due to uncaught exception');
  process.exit(1);
});

// Handle SIGTERM gracefully (for deployment platforms like Railway)
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server gracefully');
  // In a production app, you'd close database connections, etc. here
  process.exit(0);
});

// Handle SIGINT gracefully (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT signal received: shutting down gracefully');
  process.exit(0);
});

// --- Initialize Database (Phase 2) ---
console.log('📦 Initializing SQLite database...');
initializeDatabase();

// Log database state to help diagnose restart issues
const dbInfo = getDatabaseInfo();
if (dbInfo.isEmpty) {
  console.log('⚠️  Database is empty (fresh start or data loss after restart)');
} else {
  console.log(`📊 Database has existing data: ${dbInfo.sessions} sessions, ${dbInfo.content} content records`);
}
console.log(`💾 Database path: ${dbInfo.path}`);

// --- Start Storage Cleanup ---
startCleanupInterval();

// --- Start Server ---
serverStartTime = new Date().toISOString();
app.listen(port, () => {
  console.log('🚀 AI Roadmap Generator Server');
  console.log(`📊 Server running at http://localhost:${port}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Server started at: ${serverStartTime}`);
  console.log('✅ All modules loaded successfully');
  console.log('💾 SQLite database ready');
  console.log('🔄 Unified content generation enabled');
  console.log('🛡️  Global error handlers enabled');
});
