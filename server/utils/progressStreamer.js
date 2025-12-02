/**
 * Map-Reduce Progress Streamer
 * 
 * Phase 4 Optimization: Real-time progress updates during map-reduce processing.
 * Uses Server-Sent Events (SSE) to push progress to the frontend.
 * 
 * Features:
 * - SSE-based progress streaming
 * - Progress state tracking per session
 * - Timeout and cleanup handling
 * - Heartbeat to keep connections alive
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const STREAM_CONFIG = {
  heartbeatIntervalMs: 15000,  // Send heartbeat every 15s to keep connection alive
  sessionTimeoutMs: 300000,    // 5 minute timeout for stale sessions
  maxConcurrentSessions: 100   // Limit concurrent streaming sessions
};

// Active progress sessions: sessionId -> { res, lastUpdate, state }
const activeSessions = new Map();

// Cleanup interval reference
let cleanupInterval = null;

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new progress streaming session
 * 
 * @param {string} sessionId - Unique session identifier
 * @param {Response} res - Express response object for SSE
 * @returns {boolean} Success status
 */
export function createProgressSession(sessionId, res) {
  if (activeSessions.size >= STREAM_CONFIG.maxConcurrentSessions) {
    console.warn(`[ProgressStream] Max sessions (${STREAM_CONFIG.maxConcurrentSessions}) reached`);
    return false;
  }
  
  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Create session
  const session = {
    res,
    lastUpdate: Date.now(),
    state: {
      phase: 'initialized',
      message: 'Starting...',
      current: 0,
      total: 0,
      percentage: 0
    },
    heartbeatTimer: null
  };
  
  activeSessions.set(sessionId, session);
  
  // Start heartbeat
  session.heartbeatTimer = setInterval(() => {
    sendHeartbeat(sessionId);
  }, STREAM_CONFIG.heartbeatIntervalMs);
  
  // Handle client disconnect
  res.on('close', () => {
    closeProgressSession(sessionId);
  });
  
  // Start cleanup interval if not running
  startCleanupInterval();
  
  // Send initial connection event
  sendProgressEvent(sessionId, 'connected', { sessionId });
  
  console.log(`[ProgressStream] Session ${sessionId} created. Active: ${activeSessions.size}`);
  return true;
}

/**
 * Close a progress streaming session
 * 
 * @param {string} sessionId - Session to close
 */
export function closeProgressSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  
  // Clear heartbeat timer
  if (session.heartbeatTimer) {
    clearInterval(session.heartbeatTimer);
  }
  
  // End response if still writable
  if (session.res && !session.res.writableEnded) {
    try {
      session.res.end();
    } catch (e) {
      // Ignore errors on close
    }
  }
  
  activeSessions.delete(sessionId);
  console.log(`[ProgressStream] Session ${sessionId} closed. Active: ${activeSessions.size}`);
}

/**
 * Check if a session exists
 * 
 * @param {string} sessionId - Session to check
 * @returns {boolean}
 */
export function hasProgressSession(sessionId) {
  return activeSessions.has(sessionId);
}

// ============================================================================
// PROGRESS UPDATES
// ============================================================================

/**
 * Send progress update to a session
 * 
 * @param {string} sessionId - Target session
 * @param {object} progress - Progress data
 * @param {string} progress.phase - Current phase (chunking, extraction, consolidation, complete)
 * @param {string} progress.message - Human-readable message
 * @param {number} progress.current - Current item being processed
 * @param {number} progress.total - Total items to process
 * @param {number} progress.percentage - Completion percentage (0-100)
 */
export function sendProgress(sessionId, progress) {
  const session = activeSessions.get(sessionId);
  if (!session) return false;
  
  // Update session state
  session.state = { ...session.state, ...progress };
  session.lastUpdate = Date.now();
  
  // Send SSE event
  return sendProgressEvent(sessionId, 'progress', session.state);
}

/**
 * Create a progress callback function for map-reduce processor
 * Wraps sendProgress with a specific session ID
 * 
 * @param {string} sessionId - Session to send updates to
 * @returns {Function} Progress callback function
 */
export function createProgressCallback(sessionId) {
  return (progress) => {
    sendProgress(sessionId, progress);
  };
}

/**
 * Send completion event
 * 
 * @param {string} sessionId - Target session
 * @param {object} result - Final result summary
 */
export function sendComplete(sessionId, result) {
  const session = activeSessions.get(sessionId);
  if (!session) return false;
  
  session.state = {
    phase: 'complete',
    message: 'Processing complete',
    percentage: 100,
    result
  };
  
  sendProgressEvent(sessionId, 'complete', session.state);
  
  // Close session after a short delay
  setTimeout(() => closeProgressSession(sessionId), 1000);
  return true;
}

/**
 * Send error event
 * 
 * @param {string} sessionId - Target session
 * @param {string} error - Error message
 */
export function sendError(sessionId, error) {
  const session = activeSessions.get(sessionId);
  if (!session) return false;
  
  session.state = {
    phase: 'error',
    message: error,
    error: true
  };
  
  sendProgressEvent(sessionId, 'error', session.state);
  
  // Close session after sending error
  setTimeout(() => closeProgressSession(sessionId), 1000);
  return true;
}

// ============================================================================
// SSE HELPERS
// ============================================================================

/**
 * Send an SSE event to a session
 * 
 * @param {string} sessionId - Target session
 * @param {string} eventType - Event type name
 * @param {object} data - Event data
 * @returns {boolean} Success status
 */
function sendProgressEvent(sessionId, eventType, data) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.res || session.res.writableEnded) {
    return false;
  }
  
  try {
    const eventData = JSON.stringify(data);
    session.res.write(`event: ${eventType}\n`);
    session.res.write(`data: ${eventData}\n\n`);
    return true;
  } catch (error) {
    console.error(`[ProgressStream] Error sending to ${sessionId}:`, error.message);
    closeProgressSession(sessionId);
    return false;
  }
}

/**
 * Send heartbeat to keep connection alive
 * 
 * @param {string} sessionId - Target session
 */
function sendHeartbeat(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  
  try {
    if (session.res && !session.res.writableEnded) {
      session.res.write(`: heartbeat\n\n`);
    }
  } catch (error) {
    closeProgressSession(sessionId);
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Start periodic cleanup of stale sessions
 */
function startCleanupInterval() {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of activeSessions) {
      if (now - session.lastUpdate > STREAM_CONFIG.sessionTimeoutMs) {
        console.log(`[ProgressStream] Cleaning stale session: ${sessionId}`);
        closeProgressSession(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[ProgressStream] Cleaned ${cleaned} stale sessions`);
    }
    
    // Stop cleanup interval if no sessions
    if (activeSessions.size === 0) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 60000); // Check every minute
}

// ============================================================================
// METRICS
// ============================================================================

/**
 * Get progress streaming statistics
 * 
 * @returns {object} Stats about active sessions
 */
export function getProgressStreamStats() {
  const sessions = [];
  
  for (const [sessionId, session] of activeSessions) {
    sessions.push({
      sessionId,
      phase: session.state.phase,
      lastUpdate: new Date(session.lastUpdate).toISOString(),
      age: Math.round((Date.now() - session.lastUpdate) / 1000) + 's'
    });
  }
  
  return {
    activeSessions: activeSessions.size,
    maxSessions: STREAM_CONFIG.maxConcurrentSessions,
    sessions
  };
}

// ============================================================================
// EXPRESS MIDDLEWARE / ROUTE HANDLER
// ============================================================================

/**
 * Express route handler for SSE progress endpoint
 * 
 * Usage: app.get('/api/progress/:sessionId', progressStreamHandler);
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
export function progressStreamHandler(req, res) {
  const { sessionId } = req.params;
  
  if (!sessionId) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }
  
  const success = createProgressSession(sessionId, res);
  
  if (!success) {
    res.status(503).json({ error: 'Too many active sessions' });
    
  }
  
  // Keep connection open - SSE will be managed by session
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createProgressSession,
  closeProgressSession,
  hasProgressSession,
  sendProgress,
  sendComplete,
  sendError,
  createProgressCallback,
  getProgressStreamStats,
  progressStreamHandler
};
