/**
 * Unified Content Generation Routes
 * Handles synchronous generation of all three content types
 * (Roadmap, Slides, Document)
 *
 * Storage: Uses sessionStorage abstraction (Redis with in-memory fallback)
 *
 * Performance optimizations:
 * - Persistent session storage with Redis support
 * - Content compression for large sessions
 * - Efficient file processing with streaming
 * - Response caching headers
 */

import express from 'express';
import mammoth from 'mammoth';
import crypto from 'crypto';
import { generateAllContent, generateAllContentStreaming, regenerateContent, globalMetrics, apiQueue, getCacheMetrics, speculativeGenerator } from '../generators.js';
import { uploadMiddleware, handleUploadErrors } from '../middleware.js';
import { generatePptx } from '../templates/ppt-export-service.js';
import { PerformanceLogger, createTimer } from '../utils/performanceLogger.js';
import { generateETag, clearAllCaches, clearExpiredEntries } from '../cache/contentCache.js';
import { processFiles } from '../utils/fileProcessor.js';
import { cleanJsonResponse } from '../utils/networkOptimizer.js';
import { sessionStorage } from '../storage/sessionStorage.js';
import { getAdvancedOptimizationStats } from '../utils/advancedOptimizer.js';
import {
  metricsAggregator,
  alertEvaluator,
  featureFlags,
  getDashboardData
} from '../utils/monitoring.js';
import { generateSecureSessionId, verifyApiKey } from '../middleware/auth.js';
import { generateCsrfToken, getCsrfTokenHandler } from '../middleware/csrf.js';
import {
  validateSchema,
  isValidArrayIndex,
  isNonEmptyString,
  parseIntSafe,
  ValidationError,
  NotFoundError,
  handleRouteError
} from '../utils/validation.js';

const router = express.Router();

// Session TTL constant (used in storage abstraction)
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS, 10) || 60 * 60 * 1000; // Default 1 hour

// ============================================================================
// REGISTER METRIC COLLECTORS FOR MONITORING DASHBOARD
// ============================================================================

// Register generation metrics collector
metricsAggregator.register('generation', async () => {
  const metrics = globalMetrics.getAggregatedMetrics();
  return {
    requestCount: metrics.requestCount,
    latency: metrics.latency,
    lastUpdated: metrics.lastUpdated
  };
});

// Register queue metrics collector
metricsAggregator.register('queue', async () => {
  return apiQueue.getMetrics();
});

// Register cache metrics collector
metricsAggregator.register('cache', async () => {
  return getCacheMetrics();
});

// Register storage metrics collector
metricsAggregator.register('storage', async () => {
  return sessionStorage.getStats();
});

// Register advanced optimizers metrics collector
metricsAggregator.register('advanced', async () => {
  return getAdvancedOptimizationStats();
});

/**
 * Helper to touch session (update last accessed time)
 * @param {string} sessionId - Session ID
 */
async function touchSession(sessionId) {
  await sessionStorage.touch(sessionId);
}

/**
 * Generate a unique session ID
 * Uses cryptographically secure random bytes instead of UUID
 */
function generateSessionId() {
  return generateSecureSessionId();
}

/**
 * Sanitize error message for client response
 * In production, hide internal error details to prevent information disclosure
 * @param {Error|string} error - Error object or message
 * @param {string} context - Context description for generic message
 * @returns {string|null} Sanitized error message or null in production
 */
function sanitizeErrorForClient(error, context = 'operation') {
  const message = error?.message || String(error);

  // In production, don't expose internal error details
  if (process.env.NODE_ENV === 'production') {
    // Only return generic user-facing errors, not internal details
    console.error(`[${context}] Error:`, message); // Log full error server-side
    return null; // Don't include details in response
  }

  // In development, return truncated error for debugging
  return message.substring(0, 200);
}

/**
 * Create error response object with optional sanitized details
 * @param {string} errorMessage - User-facing error message
 * @param {Error|string} error - Original error for details (dev only)
 * @param {string} context - Context for logging
 * @returns {Object} Error response object
 */
function createErrorResponse(errorMessage, error = null, context = 'request') {
  const response = { error: errorMessage };
  const sanitizedDetails = error ? sanitizeErrorForClient(error, context) : null;

  if (sanitizedDetails) {
    response.details = sanitizedDetails;
  }

  return response;
}

// Pre-compiled error message patterns (module-level constant for performance)
// Patterns are compiled once at module load instead of on every function call
const ERROR_PATTERNS = Object.freeze([
  { pattern: /JSON.*parse.*position/i, message: 'The AI response was malformed. Please try again.' },
  { pattern: /timeout|timed out/i, message: 'Generation took too long. Please try again with simpler content.' },
  { pattern: /rate limit/i, message: 'Too many requests. Please wait a moment and try again.' },
  { pattern: /empty.*content|no.*section|invalid.*content/i, message: 'The AI could not generate valid content. Try providing more detailed source material.' },
  { pattern: /network|connection|ECONNREFUSED/i, message: 'Network error occurred. Please check your connection and try again.' },
  { pattern: /quota|exceeded/i, message: 'API quota exceeded. Please try again later.' },
  { pattern: /invalid.*schema|validation.*failed/i, message: 'Generated content did not match expected format. Please try again.' },
  { pattern: /invalid.*data.*structure|expected.*received.*null/i, message: 'The AI returned invalid or empty data. Please try again with different source material.' }
]);

/**
 * Format raw error messages into user-friendly text
 * @param {string} rawError - Raw error message
 * @param {string} viewType - Content type (roadmap, slides, document)
 * @returns {string} User-friendly error message
 */
function formatUserError(rawError, viewType) {
  if (!rawError) return `Failed to generate ${viewType}. Please try again.`;

  for (const mapping of ERROR_PATTERNS) {
    if (mapping.pattern.test(rawError)) {
      return mapping.message;
    }
  }

  // Default: Return sanitized version of original error (limit length)
  const sanitized = rawError.substring(0, 150);
  return `Failed to generate ${viewType}: ${sanitized}${rawError.length > 150 ? '...' : ''}`;
}

/**
 * POST /api/content/generate
 * Generates all content types (roadmap, slides, document, research-analysis) synchronously
 *
 * Request (multipart/form-data):
 * - prompt: string (form field)
 * - researchFiles: File[] (uploaded files)
 *
 * Response:
 * {
 *   status: 'completed' | 'error',
 *   content: {
 *     roadmap: { success, data, error },
 *     slides: { success, data, error },
 *     document: { success, data, error },
 *     researchAnalysis: { success, data, error }
 *   }
 * }
 */
router.post('/generate', uploadMiddleware.array('researchFiles'), async (req, res) => {
  // Extend timeout for long-running generation (4 sequential AI calls, each up to 5 min)
  // Default timeout is 2 minutes which is insufficient
  const GENERATE_TIMEOUT_MS = 25 * 60 * 1000; // 25 minutes
  req.setTimeout(GENERATE_TIMEOUT_MS);
  res.setTimeout(GENERATE_TIMEOUT_MS);

  // Initialize performance logging for request lifecycle
  const requestPerf = new PerformanceLogger('content-generate-request', { enabled: true });

  try {
    const { prompt } = req.body;
    const files = req.files;

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request. Required: prompt (string)'
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'At least one research file is required'
      });
    }

    // Track file metadata
    requestPerf.setMetadata('fileCount', files.length);
    requestPerf.setMetadata('totalUploadSize', files.reduce((sum, f) => sum + f.size, 0));

    // Time file processing with optimized processor
    const fileProcessingTimer = createTimer(requestPerf, 'file-processing');

    // Use optimized file processor with deduplication and normalization
    const processingResult = await processFiles(files);
    const researchFiles = processingResult.researchFiles;
    fileProcessingTimer.stop();

    // Track processing metrics
    requestPerf.setMetadata('processedContentSize', processingResult.metrics.totalExtractedSize);
    requestPerf.setMetadata('duplicatesRemoved', processingResult.metrics.totalDuplicatesRemoved);
    requestPerf.setMetadata('fileProcessingMetrics', processingResult.metrics);

    // Warn about failed files (but continue with successful ones)
    if (processingResult.failed.length > 0) {
      requestPerf.setMetadata('failedFiles', processingResult.failed);
    }

    // Create session ID early so it can be included in generation metrics
    const sessionId = generateSessionId();
    requestPerf.setMetadata('sessionId', sessionId);

    // Time content generation
    const generationTimer = createTimer(requestPerf, 'content-generation');

    // Generate all content synchronously
    const results = await generateAllContent(prompt, researchFiles, { sessionId });
    generationTimer.stop();

    // Store content (including research for task analysis)
    const now = Date.now();
    await sessionStorage.set(sessionId, {
      prompt,
      researchFiles: researchFiles.map(f => f.filename),
      // Store research content for session-based task analysis (truncated to limit memory)
      researchContent: researchFiles.map(f => f.content).join('\n\n---\n\n').substring(0, 500000),
      content: {
        roadmap: results.roadmap,
        slides: results.slides,
        document: results.document,
        researchAnalysis: results.researchAnalysis
      },
      createdAt: now,
      lastAccessed: now
    }, SESSION_TTL_MS);

    // Complete request performance logging
    const requestReport = requestPerf.complete();
    requestPerf.logReport();

    // Return sessionId for frontend to poll/fetch content
    // Use cleanJsonResponse to remove null/undefined values and reduce payload size
    const responseData = cleanJsonResponse({
      status: 'completed',
      sessionId,
      prompt,
      researchFiles: researchFiles.map(f => f.filename),
      content: {
        roadmap: results.roadmap,
        slides: results.slides,
        document: results.document,
        researchAnalysis: results.researchAnalysis
      },
      // Include performance metrics in response (useful for debugging)
      _performance: {
        totalDuration: requestReport.totalDuration,
        fileProcessingTime: requestReport.measures['file-processing']?.duration,
        generationTime: requestReport.measures['content-generation']?.duration
      }
    }, { removeNull: true, removeUndefined: true });

    res.json(responseData);

  } catch (error) {
    requestPerf.setMetadata('error', error.message);
    requestPerf.complete();
    requestPerf.logReport();

    res.status(500).json(createErrorResponse('Internal server error', error, 'content-generate'));
  }
});

/**
 * POST /api/content/generate/stream
 * Generates all content types with Server-Sent Events streaming
 * Results are emitted as each content type completes, reducing perceived latency
 *
 * Request (multipart/form-data):
 * - prompt: string (form field)
 * - researchFiles: File[] (uploaded files)
 *
 * SSE Events:
 * - event: progress, data: { message: string }
 * - event: content, data: { type: string, result: object }
 * - event: complete, data: { sessionId: string, results: object }
 * - event: error, data: { message: string }
 */
router.post('/generate/stream', uploadMiddleware.array('researchFiles'), async (req, res) => {
  // Early validation BEFORE setting SSE headers (allows proper HTTP status codes)
  const { prompt } = req.body;
  const files = req.files;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: ['prompt is required and must be a non-empty string'],
      code: 'VALIDATION_ERROR'
    });
  }

  if (!files || files.length === 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: ['At least one research file is required'],
      code: 'VALIDATION_ERROR'
    });
  }

  // Extend timeout for streaming (content types emit as they complete)
  const STREAM_TIMEOUT_MS = 25 * 60 * 1000; // 25 minutes
  req.setTimeout(STREAM_TIMEOUT_MS);
  res.setTimeout(STREAM_TIMEOUT_MS);

  // Initialize performance logging
  const requestPerf = new PerformanceLogger('content-generate-stream', { enabled: true });

  // Set SSE headers (only after validation passes)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=600'); // 10 minute keep-alive for proxies
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent content sniffing issues with SSE
  res.flushHeaders();

  // Track client connection state
  let clientConnected = true;

  // Handle client disconnect
  res.on('close', () => {
    clientConnected = false;
    console.log('[Streaming] Client disconnected');
  });

  res.on('error', (err) => {
    clientConnected = false;
    console.error('[Streaming] Response error:', err.message);
  });

  // Helper to send SSE events with optimized JSON
  const sendEvent = (event, data) => {
    // Don't send if client disconnected
    if (!clientConnected || !res.writable) {
      console.warn(`[Streaming] Cannot send ${event} event - client disconnected`);
      return false;
    }

    // Clean the data but preserve 'data' and 'error' fields even if null
    // This prevents the client from receiving responses with missing expected fields
    const cleanedData = cleanJsonResponse(data, { removeNull: true, removeUndefined: true });

    // Restore critical fields that should always be present in content events
    if (event === 'content') {
      if (!('data' in cleanedData) && 'data' in data) {
        cleanedData.data = null;
      }
      if (!('error' in cleanedData) && 'error' in data) {
        cleanedData.error = null;
      }
    }

    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(cleanedData)}\n\n`);
      return true;
    } catch (writeError) {
      console.error(`[Streaming] Failed to write ${event} event:`, writeError.message);
      clientConnected = false;
      return false;
    }
  };

  // Send initial heartbeat
  sendEvent('progress', { message: 'Connection established' });

  // Keep-alive heartbeat to prevent connection timeout (every 10 seconds)
  // Reduced from 15s to 10s for better compatibility with Railway/cloud proxy timeouts
  let heartbeatCount = 0;
  const heartbeatInterval = setInterval(() => {
    if (!clientConnected || !res.writable) {
      clearInterval(heartbeatInterval);
      return;
    }
    try {
      heartbeatCount++;
      // Send actual progress event every 3rd heartbeat (30s) to ensure proxies see activity
      // Use SSE comments for other heartbeats to minimize payload
      if (heartbeatCount % 3 === 0) {
        sendEvent('progress', { message: 'Generation in progress...', heartbeat: true });
      } else {
        res.write(': heartbeat\n\n');
      }
    } catch (err) {
      console.error('[Streaming] Heartbeat failed:', err.message);
      clientConnected = false;
      clearInterval(heartbeatInterval);
    }
  }, 10000);

  try {
    // Note: prompt and files already validated before SSE headers were set

    // Track file metadata
    requestPerf.setMetadata('fileCount', files.length);
    requestPerf.setMetadata('totalUploadSize', files.reduce((sum, f) => sum + f.size, 0));

    sendEvent('progress', { message: 'Processing uploaded files...' });

    // Time file processing with optimized processor
    const fileProcessingTimer = createTimer(requestPerf, 'file-processing');

    // Use optimized file processor with deduplication and normalization
    const processingResult = await processFiles(files);
    const researchFiles = processingResult.researchFiles;
    fileProcessingTimer.stop();

    // Track processing metrics
    requestPerf.setMetadata('processedContentSize', processingResult.metrics.totalExtractedSize);
    requestPerf.setMetadata('duplicatesRemoved', processingResult.metrics.totalDuplicatesRemoved);

    // Report any failed files via progress event
    if (processingResult.failed.length > 0) {
      sendEvent('progress', {
        message: `Warning: ${processingResult.failed.length} file(s) could not be processed`,
        failedFiles: processingResult.failed
      });
    }

    // Create session ID
    const sessionId = generateSessionId();
    requestPerf.setMetadata('sessionId', sessionId);

    sendEvent('progress', { message: 'Starting content generation...', sessionId });

    // Initialize session with empty content (will be populated as results stream in)
    const now = Date.now();
    const session = {
      prompt,
      researchFiles: researchFiles.map(f => f.filename),
      researchContent: researchFiles.map(f => f.content).join('\n\n---\n\n').substring(0, 500000),
      content: {
        roadmap: null,
        slides: null,
        document: null,
        researchAnalysis: null
      },
      createdAt: now,
      lastAccessed: now
    };

    // Store initial session
    await sessionStorage.set(sessionId, session, SESSION_TTL_MS);

    // Content type mapping for consistent naming
    const contentKeyMap = {
      'roadmap': 'roadmap',
      'slides': 'slides',
      'document': 'document',
      'research-analysis': 'researchAnalysis'
    };

    // Time content generation
    const generationTimer = createTimer(requestPerf, 'content-generation');

    // Generate with streaming callbacks
    await generateAllContentStreaming(prompt, researchFiles, {
      sessionId,

      onProgress: (message) => {
        sendEvent('progress', { message });
      },

      onContentReady: async (type, result) => {
        // Update session content incrementally
        const contentKey = contentKeyMap[type] || type;

        // Fix: If success is true but data is null/undefined, treat as error
        // This prevents confusing "success with no data" responses
        if (result.success && (result.data === null || result.data === undefined)) {
          result = {
            success: false,
            data: null,
            error: `${type} generation completed but returned no data. Please try again.`
          };
        }

        session.content[contentKey] = result;
        session.lastAccessed = Date.now();

        // Persist updated session to storage with error handling
        try {
          const storageSuccess = await sessionStorage.set(sessionId, session, SESSION_TTL_MS);
          if (!storageSuccess) {
            console.error(`[Streaming] Failed to persist ${type} for session ${sessionId}`);
            // Still send the content to client even if storage failed
            // but log for monitoring
          }
        } catch (storageError) {
          console.error(`[Streaming] Storage error for ${type}:`, storageError.message);
          // Continue - content is still in memory and can be sent to client
        }

        // Stream to client
        sendEvent('content', {
          type,
          success: result.success,
          data: result.data || null,
          error: result.error ? formatUserError(result.error, type) : null
        });
      },

      onComplete: (results) => {
        generationTimer.stop();

        // Complete performance logging
        const requestReport = requestPerf.complete();
        requestPerf.logReport();

        // Send completion event with all results
        sendEvent('complete', {
          sessionId,
          prompt,
          researchFiles: researchFiles.map(f => f.filename),
          _performance: {
            totalDuration: requestReport.totalDuration,
            fileProcessingTime: requestReport.measures['file-processing']?.duration,
            generationTime: requestReport.measures['content-generation']?.duration
          }
        });

        clearInterval(heartbeatInterval);
        res.end();
      },

      onError: (error) => {
        sendEvent('error', { message: error.message });
        requestPerf.setMetadata('fatalError', error.message);
        requestPerf.complete();
        requestPerf.logReport();
        clearInterval(heartbeatInterval);
        res.end();
      }
    });

  } catch (error) {
    requestPerf.setMetadata('error', error.message);
    requestPerf.complete();
    requestPerf.logReport();

    sendEvent('error', { message: 'Internal server error: ' + error.message });
    clearInterval(heartbeatInterval);
    res.end();
  }
});

/**
 * POST /api/content/regenerate/:viewType
 * Regenerates content for a specific view type
 *
 * Request (multipart/form-data):
 * - prompt: string (form field)
 * - researchFiles: File[] (uploaded files)
 * - viewType (URL param): 'roadmap', 'slides', 'document', or 'research-analysis'
 *
 * Response:
 * {
 *   viewType: string,
 *   status: 'completed' | 'error',
 *   data: object | null,
 *   error: string | null
 * }
 */
router.post('/regenerate/:viewType', uploadMiddleware.array('researchFiles'), async (req, res) => {
  // Extend timeout for long-running AI generation (up to 5 min per content type)
  const REGENERATE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  req.setTimeout(REGENERATE_TIMEOUT_MS);
  res.setTimeout(REGENERATE_TIMEOUT_MS);

  try {
    const { viewType } = req.params;
    const { prompt } = req.body;
    const files = req.files;

    // Validate view type
    const validViewTypes = ['roadmap', 'slides', 'document', 'research-analysis'];
    if (!validViewTypes.includes(viewType)) {
      return res.status(400).json({
        error: `Invalid view type. Must be one of: ${validViewTypes.join(', ')}`
      });
    }

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request. Required: prompt (string)'
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'At least one research file is required'
      });
    }

    // Use optimized file processor
    const processingResult = await processFiles(files);
    const researchFiles = processingResult.researchFiles;

    // Regenerate content
    const result = await regenerateContent(viewType, prompt, researchFiles);

    // Use cleanJsonResponse to reduce payload size
    const responseData = cleanJsonResponse({
      viewType,
      status: result.success ? 'completed' : 'error',
      data: result.data,
      error: result.error ? formatUserError(result.error, viewType) : null
    }, { removeNull: true, removeUndefined: true });

    res.json(responseData);

  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to regenerate content', error, 'content-regenerate'));
  }
});

/**
 * GET /api/content/:sessionId/slides/export
 * Exports slides from a session as a branded PowerPoint file
 *
 * NOTE: This route MUST be defined before /:sessionId/:viewType to avoid being shadowed
 *
 * URL params:
 * - sessionId: string - Session ID
 *
 * Response: PowerPoint file (.pptx) download
 */
router.get('/:sessionId/slides/export', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if session exists
    const session = await sessionStorage.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Session may have expired. Please generate new content.'
      });
    }

    const slidesResult = session.content.slides;
    if (!slidesResult || !slidesResult.success || !slidesResult.data) {
      return res.status(404).json({
        error: 'Slides not available',
        message: slidesResult?.error || 'Slides generation failed or not yet complete'
      });
    }

    const slides = slidesResult.data;

    // Generate the PowerPoint file
    const pptxBuffer = await generatePptx(slides, {
      author: 'BIP',
      company: 'BIP'
    });

    // Create filename from presentation title
    const title = slides.title || 'Presentation';
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    const filename = `${safeTitle}.pptx`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pptxBuffer.length);

    res.send(pptxBuffer);

  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to generate PowerPoint file', error, 'pptx-export'));
  }
});

/**
 * GET /api/content/:sessionId/:viewType
 * Retrieves content for a specific view type from a session
 *
 * URL params:
 * - sessionId: string - Session ID from /generate response
 * - viewType: 'roadmap' | 'slides' | 'document' | 'research-analysis'
 *
 * Response:
 * - For roadmap: Returns the gantt data directly
 * - For other views: Returns { success, data, error }
 */
router.get('/:sessionId/:viewType', async (req, res) => {
  try {
    const { sessionId, viewType } = req.params;

    // Check if session exists
    const session = await sessionStorage.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Session may have expired or does not exist. Please generate new content.',
        hint: 'Sessions expire after 1 hour'
      });
    }

    // Performance: Track access for LRU management
    await touchSession(sessionId);

    // Track view pattern for speculative generation optimization
    speculativeGenerator.recordView(sessionId, viewType);

    // Map viewType to content key
    const viewTypeMap = {
      'roadmap': 'roadmap',
      'slides': 'slides',
      'document': 'document',
      'research-analysis': 'researchAnalysis'
    };

    const contentKey = viewTypeMap[viewType];
    if (!contentKey) {
      return res.status(400).json({
        error: 'Invalid view type',
        message: `View type must be one of: ${Object.keys(viewTypeMap).join(', ')}`
      });
    }

    const contentResult = session.content[contentKey];
    if (!contentResult) {
      return res.status(404).json({
        error: 'Content not found',
        message: `No ${viewType} content available for this session`
      });
    }

    // Fix: Handle case where success is true but data is null/undefined
    // This should not happen after generator fixes, but provides defense in depth
    if (contentResult.success && (contentResult.data === null || contentResult.data === undefined)) {
      res.set('Cache-Control', 'no-store');
      return res.json({
        status: 'error',
        error: `${viewType} generation completed but returned no data. Please try regenerating.`
      });
    }

    // Performance: Add cache control headers for completed content
    if (contentResult.success && contentResult.data) {
      // Generate content-based ETag for reliable caching
      const dataHash = crypto.createHash('md5')
        .update(JSON.stringify(contentResult.data))
        .digest('hex')
        .substring(0, 16);
      const etag = `"${viewType}-${dataHash}"`;

      // Check for conditional request (If-None-Match)
      const clientEtag = req.get('If-None-Match');
      if (clientEtag === etag) {
        // Content unchanged - return 304 Not Modified
        res.set('ETag', etag);
        res.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=3600');
        return res.status(304).end();
      }

      // Cache successful responses with improved headers
      res.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=3600');
      res.set('ETag', etag);

      // Use cleanJsonResponse to remove null/undefined values and reduce payload size
      const originalData = {
        status: 'completed',
        data: contentResult.data,
        _cached: contentResult._cached || false  // Indicate if result was from cache
      };
      const responseData = cleanJsonResponse(originalData, { removeNull: true, removeUndefined: true });

      // Restore critical 'data' field if it was stripped by cleanJsonResponse
      // This prevents clients from receiving responses with missing expected fields
      if (!('data' in responseData) && 'data' in originalData) {
        responseData.data = null;
      }

      // CRITICAL: Never send completed status with null data - this causes client errors
      // This is a defense-in-depth check that should never trigger if earlier checks work
      if (responseData.data === null || responseData.data === undefined) {
        console.error(`[Content] CRITICAL: Attempted to send completed status with null data for ${viewType}`);
        return res.json({
          status: 'error',
          error: `${viewType} generation completed but produced no data. Please try again.`
        });
      }

      return res.json(responseData);
    } else {
      // Don't cache error responses
      res.set('Cache-Control', 'no-store');
      return res.json({
        status: 'error',
        error: formatUserError(contentResult.error, viewType)
      });
    }

  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to retrieve content', error, 'content-retrieve'));
  }
});

/**
 * POST /api/content/slides/export
 * Exports slides as a branded PowerPoint file (direct POST, no session)
 *
 * Request body:
 * - slides: object (slides data to export)
 *
 * Response: PowerPoint file (.pptx) download
 */
router.post('/slides/export', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { slides } = req.body;

    if (!slides || !slides.slides || !Array.isArray(slides.slides)) {
      return res.status(400).json({
        error: 'Invalid slides data',
        message: 'Request must include slides object with slides array'
      });
    }


    // Generate the PowerPoint file
    const pptxBuffer = await generatePptx(slides, {
      author: 'BIP',
      company: 'BIP'
    });

    // Create filename from presentation title
    const title = slides.title || 'Presentation';
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    const filename = `${safeTitle}.pptx`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pptxBuffer.length);


    res.send(pptxBuffer);

  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to generate PowerPoint file', error, 'pptx-export-direct'));
  }
});

/**
 * POST /api/content/update-task-dates
 * Updates task bar positions (start/end columns) in the session
 *
 * Request body:
 * - sessionId: string
 * - taskIndex: number (index in ganttData.data array)
 * - startCol: number (new start column)
 * - endCol: number (new end column)
 */
router.post('/update-task-dates', express.json(), async (req, res) => {
  try {
    const { sessionId, taskIndex, startCol, endCol } = req.body;

    // Comprehensive validation
    const errors = validateSchema(req.body, {
      sessionId: { required: true, type: 'string', minLength: 1 },
      taskIndex: { required: true, type: 'number', min: 0, integer: true },
      startCol: { type: 'number', min: 0, integer: true },
      endCol: { type: 'number', min: 0, integer: true }
    });

    if (errors) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    // Validate startCol <= endCol if both provided
    if (startCol !== undefined && endCol !== undefined && startCol > endCol) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['startCol must be less than or equal to endCol']
      });
    }

    const session = await sessionStorage.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update the task in roadmap data
    const roadmapData = session.content.roadmap?.data;
    if (!roadmapData || !Array.isArray(roadmapData.data)) {
      return res.status(400).json({ error: 'No roadmap data found' });
    }

    // Validate array bounds
    if (!isValidArrayIndex(taskIndex, roadmapData.data.length)) {
      return res.status(400).json({
        error: 'Invalid task index',
        details: [`taskIndex must be between 0 and ${roadmapData.data.length - 1}`]
      });
    }

    const task = roadmapData.data[taskIndex];
    if (!task.bar) {
      return res.status(400).json({ error: 'Task has no bar property' });
    }

    if (startCol !== undefined) task.bar.startCol = startCol;
    if (endCol !== undefined) task.bar.endCol = endCol;

    // Persist updated session
    session.lastAccessed = Date.now();
    await sessionStorage.set(sessionId, session, SESSION_TTL_MS);

    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to update task dates', error, 'update-task-dates'));
  }
});

/**
 * POST /api/content/update-task-color
 * Updates task bar color in the session
 *
 * Request body:
 * - sessionId: string
 * - taskIndex: number (index in ganttData.data array)
 * - color: string (new color class)
 */
router.post('/update-task-color', express.json(), async (req, res) => {
  try {
    const { sessionId, taskIndex, color } = req.body;

    // Comprehensive validation
    const errors = validateSchema(req.body, {
      sessionId: { required: true, type: 'string', minLength: 1 },
      taskIndex: { required: true, type: 'number', min: 0, integer: true },
      color: { required: true, type: 'string', minLength: 1, maxLength: 50 }
    });

    if (errors) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const session = await sessionStorage.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update the task in roadmap data
    const roadmapData = session.content.roadmap?.data;
    if (!roadmapData || !Array.isArray(roadmapData.data)) {
      return res.status(400).json({ error: 'No roadmap data found' });
    }

    // Validate array bounds
    if (!isValidArrayIndex(taskIndex, roadmapData.data.length)) {
      return res.status(400).json({
        error: 'Invalid task index',
        details: [`taskIndex must be between 0 and ${roadmapData.data.length - 1}`]
      });
    }

    const task = roadmapData.data[taskIndex];
    if (!task.bar) {
      return res.status(400).json({ error: 'Task has no bar property' });
    }

    task.bar.color = color;

    // Persist updated session
    session.lastAccessed = Date.now();
    await sessionStorage.set(sessionId, session, SESSION_TTL_MS);

    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to update task color', error, 'update-task-color'));
  }
});

/**
 * GET /api/content/metrics
 * Returns aggregated performance metrics for content generation
 *
 * Response:
 * {
 *   requestCount: number,
 *   latency: { min, max, avg, p50, p95, p99 },
 *   lastUpdated: string
 * }
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = globalMetrics.getAggregatedMetrics();
    const queueMetrics = apiQueue.getMetrics();
    const cacheMetrics = getCacheMetrics();
    const storageStats = await sessionStorage.getStats();

    res.json({
      status: 'ok',
      metrics,
      queue: queueMetrics,
      cache: cacheMetrics.aggregate,
      storage: storageStats
    });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to retrieve metrics', error, 'metrics'));
  }
});

/**
 * GET /api/content/metrics/cache
 * Returns detailed cache metrics by content type
 */
router.get('/metrics/cache', (req, res) => {
  try {
    const cacheMetrics = getCacheMetrics();
    res.json({
      status: 'ok',
      ...cacheMetrics
    });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to retrieve cache metrics', error, 'cache-metrics'));
  }
});

/**
 * POST /api/content/cache/clear
 * Clears all caches (admin endpoint - requires API key)
 */
router.post('/cache/clear', verifyApiKey, (req, res) => {
  try {
    clearAllCaches();
    console.log(`[Admin] Cache cleared by ${req.ip}`);
    res.json({ status: 'ok', message: 'All caches cleared' });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to clear caches', error, 'cache-clear'));
  }
});

/**
 * POST /api/content/cache/clear-expired
 * Clears only expired cache entries (admin endpoint - requires API key)
 */
router.post('/cache/clear-expired', verifyApiKey, (req, res) => {
  try {
    const cleared = clearExpiredEntries();
    console.log(`[Admin] Cleared ${cleared} expired cache entries by ${req.ip}`);
    res.json({ status: 'ok', message: `Cleared ${cleared} expired entries` });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to clear expired entries', error, 'cache-clear-expired'));
  }
});

/**
 * GET /api/content/metrics/recent
 * Returns the most recent performance reports (for debugging)
 *
 * Query params:
 * - limit: number (default 10, max 50)
 */
router.get('/metrics/recent', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const recentRequests = globalMetrics.requests.slice(-limit).reverse();
    res.json({
      status: 'ok',
      count: recentRequests.length,
      requests: recentRequests
    });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to retrieve recent metrics', error, 'metrics-recent'));
  }
});

/**
 * GET /api/content/metrics/advanced
 * Returns advanced optimization metrics (warmup, prefetch, speculative)
 */
router.get('/metrics/advanced', (req, res) => {
  try {
    const advancedStats = getAdvancedOptimizationStats();
    res.json({
      status: 'ok',
      ...advancedStats
    });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to retrieve advanced metrics', error, 'metrics-advanced'));
  }
});

/**
 * GET /api/content/dashboard
 * Returns comprehensive monitoring dashboard data
 * Includes health status, metrics, and alerts
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboard = await getDashboardData();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to retrieve dashboard', error, 'dashboard'));
  }
});

/**
 * GET /api/content/alerts
 * Returns current alerts and health status
 */
router.get('/alerts', (req, res) => {
  try {
    const health = alertEvaluator.getHealthStatus();
    const activeAlerts = alertEvaluator.getActiveAlerts();
    const history = alertEvaluator.getAlertHistory(20);

    res.json({
      status: 'ok',
      health,
      activeAlerts,
      recentHistory: history
    });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to retrieve alerts', error, 'alerts'));
  }
});

/**
 * GET /api/content/feature-flags
 * Returns all feature flags and their current state
 */
router.get('/feature-flags', (req, res) => {
  try {
    const flags = featureFlags.getAllFlags();
    res.json({
      status: 'ok',
      flags
    });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to retrieve feature flags', error, 'feature-flags'));
  }
});

/**
 * POST /api/content/feature-flags/:flagName
 * Update a feature flag's rollout percentage (admin endpoint - requires API key)
 *
 * Body: { rolloutPercentage: number }
 */
router.post('/feature-flags/:flagName', verifyApiKey, express.json(), (req, res) => {
  try {
    const { flagName } = req.params;
    const { rolloutPercentage } = req.body;

    if (typeof rolloutPercentage !== 'number' || rolloutPercentage < 0 || rolloutPercentage > 100) {
      return res.status(400).json({
        error: 'Invalid rolloutPercentage',
        message: 'Must be a number between 0 and 100'
      });
    }

    featureFlags.setRollout(flagName, rolloutPercentage);
    console.log(`[Admin] Feature flag ${flagName} set to ${rolloutPercentage}% by ${req.ip}`);

    res.json({
      status: 'ok',
      flagName,
      newRolloutPercentage: rolloutPercentage
    });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to update feature flag', error, 'feature-flag-update'));
  }
});

/**
 * GET /api/content/feature-flags/check/:flagName
 * Check if a feature flag is enabled for a session
 *
 * Query: sessionId (optional)
 */
router.get('/feature-flags/check/:flagName', (req, res) => {
  try {
    const { flagName } = req.params;
    const { sessionId } = req.query;

    const enabled = featureFlags.isEnabled(flagName, sessionId);

    res.json({
      status: 'ok',
      flagName,
      enabled,
      sessionId: sessionId || null
    });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to check feature flag', error, 'feature-flag-check'));
  }
});

/**
 * GET /api/content/storage/health
 * Returns storage health status and statistics
 */
router.get('/storage/health', async (req, res) => {
  try {
    const stats = await sessionStorage.getStats();
    const healthy = sessionStorage.isHealthy();

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      storage: stats
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * POST /api/content/storage/clear
 * Clears all session storage (admin endpoint - requires API key)
 */
router.post('/storage/clear', verifyApiKey, async (req, res) => {
  try {
    await sessionStorage.clear();
    console.log(`[Admin] Session storage cleared by ${req.ip}`);
    res.json({ status: 'ok', message: 'Session storage cleared' });
  } catch (error) {
    res.status(500).json(createErrorResponse('Failed to clear storage', error, 'storage-clear'));
  }
});

/**
 * GET /api/content/csrf-token
 * Get a CSRF token for the current session
 *
 * Query: sessionId (required)
 * Response: { csrfToken, expiresIn, headerName }
 */
router.get('/csrf-token', getCsrfTokenHandler);

// Apply upload error handling middleware
router.use(handleUploadErrors);

// Export sessionStorage for use by analysis routes
export { sessionStorage, touchSession };

export default router;
