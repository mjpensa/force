# Bug Fix Implementation Plan

**Date:** 2025-11-28
**Total Issues:** 130 bugs across 5 categories
**Estimated Phases:** 6 phases over ~4-6 sprints

---

## Overview

This plan organizes bug fixes into 6 phases based on:
1. **Severity** - Critical/security issues first
2. **Dependencies** - Foundational fixes before dependent ones
3. **Risk** - Low-risk, high-impact changes prioritized
4. **Grouping** - Related fixes bundled together for efficiency

---

## Phase 1: Security Emergency Response
**Priority:** CRITICAL
**Estimated Effort:** 1-2 days
**Risk Level:** Low (mostly additive changes)

### Step 1.1: Revoke Exposed API Key (IMMEDIATE)
**File:** `.env.test`
```bash
# Actions:
1. Go to Google Cloud Console
2. Revoke API key: AIzaSyBmyPy6TEQvHIl_wzyA6ZYTR0cteiszmLQ
3. Generate new API key with proper restrictions
4. Remove .env.test from repository
5. Add to .gitignore: .env*, !.env.example
6. Scrub git history (optional but recommended):
   git filter-branch --force --index-filter \
   "git rm --cached --ignore-unmatch .env.test" \
   --prune-empty --tag-name-filter cat -- --all
```

### Step 1.2: Fix CORS Configuration
**File:** `server.js:80-86`
```javascript
// BEFORE (vulnerable):
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
}));

// AFTER (secure):
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
    throw new Error('ALLOWED_ORIGINS must be set in production');
  }
  return process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000']; // Dev only
};

app.use(cors({
  origin: (origin, callback) => {
    const allowed = getAllowedOrigins();
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));
```

### Step 1.3: Enable Content Security Policy
**File:** `server/middleware.js:6-10`
```javascript
// BEFORE:
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  });
}

// AFTER:
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "'unsafe-inline'" // TODO: Replace with nonces in Phase 3
        ],
        styleSrc: [
          "'self'",
          "https://cdn.tailwindcss.com",
          "'unsafe-inline'"
        ],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  });
}
```

### Step 1.4: Fix SRI Typo
**File:** `Public/index.html:16-21`
```html
<!-- BEFORE: -->
<script
  src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
  xintegrity="sha512-..."

<!-- AFTER: -->
<script
  src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
  integrity="sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu+cHio/BJLMBKSnQYjDRMvMMlPzgw6D/LIIXbaK3ddhiNRVbcC+WfcD+WjGg=="
  crossorigin="anonymous"
```

### Step 1.5: Sanitize Error Messages
**File:** `server/routes/content.js:249-252`
```javascript
// BEFORE:
res.status(500).json({
  error: 'Internal server error',
  details: error.message
});

// AFTER:
const sanitizeError = (error) => {
  if (process.env.NODE_ENV === 'production') {
    return 'An unexpected error occurred';
  }
  return error.message?.substring(0, 200) || 'Unknown error';
};

res.status(500).json({
  error: 'Internal server error',
  ...(process.env.NODE_ENV !== 'production' && { details: sanitizeError(error) })
});
```

### Step 1.6: Move API Key to Header
**File:** `server/config.js:177-179`
```javascript
// BEFORE:
export function getGeminiApiUrl() {
  return `${CONFIG.API.BASE_URL}/models/${CONFIG.API.GEMINI_MODEL}:generateContent?key=${process.env.API_KEY}`;
}

// AFTER:
export function getGeminiApiUrl() {
  return `${CONFIG.API.BASE_URL}/models/${CONFIG.API.GEMINI_MODEL}:generateContent`;
}

export function getGeminiHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': process.env.API_KEY
  };
}
```

**File:** `server/gemini.js` - Update all fetch calls:
```javascript
response = await fetch(getGeminiApiUrl(), {
  method: 'POST',
  headers: getGeminiHeaders(), // Use headers instead of URL param
  body: JSON.stringify(payload),
  signal: controller.signal
});
```

---

## Phase 2: Authentication & Authorization
**Priority:** CRITICAL
**Estimated Effort:** 3-5 days
**Risk Level:** Medium (significant new code)

### Step 2.1: Create Auth Middleware
**New File:** `server/middleware/auth.js`
```javascript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Generate secure session ID
export function generateSecureSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// JWT token generation
export function generateToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// JWT verification middleware
export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// API key authentication for server-to-server
export function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !isValidApiKey(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
}

// Session ownership validation
export async function verifySessionOwnership(req, res, next) {
  const { sessionId } = req.params;
  const userId = req.user?.id;

  // In Phase 2, we'll add session-to-user mapping
  // For now, validate session exists
  const session = await sessionStorage.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // TODO: Add ownership check when user system is implemented
  // if (session.userId && session.userId !== userId) {
  //   return res.status(403).json({ error: 'Access denied' });
  // }

  req.session = session;
  next();
}

// Admin-only middleware
export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
```

### Step 2.2: Protect Admin Endpoints
**File:** `server/routes/content.js`
```javascript
import { requireAdmin, verifyToken } from '../middleware/auth.js';

// Protect admin endpoints
router.post('/storage/clear', verifyToken, requireAdmin, async (req, res) => {
  // ... existing logic
});

router.post('/cache/clear', verifyToken, requireAdmin, async (req, res) => {
  // ... existing logic
});

router.get('/metrics', verifyToken, requireAdmin, async (req, res) => {
  // ... existing logic
});
```

### Step 2.3: Add CSRF Protection
**New File:** `server/middleware/csrf.js`
```javascript
import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const csrfTokens = new Map(); // In production, use Redis

export function generateCsrfToken(sessionId) {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  csrfTokens.set(sessionId, {
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
  });
  return token;
}

export function validateCsrf(req, res, next) {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const sessionId = req.headers['x-session-id'] || req.body?.sessionId;
  const csrfToken = req.headers['x-csrf-token'];

  if (!sessionId || !csrfToken) {
    return res.status(403).json({ error: 'CSRF token required' });
  }

  const stored = csrfTokens.get(sessionId);

  if (!stored || stored.token !== csrfToken || Date.now() > stored.expiresAt) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of csrfTokens) {
    if (now > value.expiresAt) {
      csrfTokens.delete(key);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

### Step 2.4: Update Session ID Generation
**File:** `server/routes/content.js:84-86`
```javascript
// BEFORE:
function generateSessionId() {
  return crypto.randomUUID();
}

// AFTER:
import { generateSecureSessionId } from '../middleware/auth.js';

function generateSessionId() {
  return generateSecureSessionId(); // Uses crypto.randomBytes(32)
}
```

---

## Phase 3: Critical Race Conditions & Memory Leaks
**Priority:** HIGH
**Estimated Effort:** 3-4 days
**Risk Level:** Medium (core functionality changes)

### Step 3.1: Fix Session Storage Race Condition
**File:** `server/storage/sessionStorage.js:131-138`
```javascript
// BEFORE:
async get(key) {
  const entry = this.store.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    this.store.delete(key);
    return null;
  }

  try {
    return maybeDecompress(entry.data, entry.compressed);
  } catch (error) {
    console.error(`[Storage] CRITICAL: Corrupted in-memory session ${key}: ${error.message}`);
    this.store.delete(key);
    return null;
  }
}

// AFTER:
async get(key) {
  const entry = this.store.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    this.store.delete(key);
    return null;
  }

  // Validate data integrity before decompression
  if (entry.compressed && (!entry.data || typeof entry.data !== 'string')) {
    console.error(`[Storage] Invalid compressed data for session ${key}`);
    this.store.delete(key);
    return null;
  }

  try {
    const data = maybeDecompress(entry.data, entry.compressed);

    // Validate decompressed data
    if (data === null || data === undefined) {
      throw new Error('Decompression returned null/undefined');
    }

    return data;
  } catch (error) {
    console.error(`[Storage] CRITICAL: Corrupted session ${key}: ${error.message}`);
    this.store.delete(key);

    // Emit event for monitoring
    this.emit?.('corruption', { key, error: error.message });

    return null;
  }
}
```

### Step 3.2: Fix Storage Manager Initialization Race
**File:** `server/storage/sessionStorage.js:488-510`
```javascript
// BEFORE:
async initialize() {
  if (this._initialized) return;
  // ... async operations
  this._initialized = true;
}

// AFTER:
class StorageManager {
  constructor() {
    this._initialized = false;
    this._initPromise = null;
    // ...
  }

  async initialize() {
    // Return existing promise if initialization in progress
    if (this._initPromise) {
      return this._initPromise;
    }

    // Already initialized
    if (this._initialized) {
      return;
    }

    // Create and store the initialization promise
    this._initPromise = this._doInitialize();

    try {
      await this._initPromise;
      this._initialized = true;
    } finally {
      this._initPromise = null;
    }
  }

  async _doInitialize() {
    if (CONFIG.features.redisEnabled) {
      const redis = new RedisStorage();
      const connected = await redis.connect();

      if (connected) {
        this.primary = redis;
        this.fallback.destroy();
        console.log('[Storage] Using Redis as primary storage');
      } else {
        console.log('[Storage] Redis unavailable, using in-memory storage');
        this.primary = this.fallback;
      }
    } else {
      this.primary = this.fallback;
      console.log('[Storage] Using in-memory storage (Redis not configured)');
    }
  }
}
```

### Step 3.3: Fix Frontend Memory Leak - HashChange Listener
**File:** `Public/viewer.js:213, 973-999`
```javascript
// In constructor or init:
constructor() {
  // ...
  this._boundHashChangeHandler = () => this._handleRouteChange();
  window.addEventListener('hashchange', this._boundHashChangeHandler);
}

// In destroy():
destroy() {
  // Remove hash change listener
  if (this._boundHashChangeHandler) {
    window.removeEventListener('hashchange', this._boundHashChangeHandler);
    this._boundHashChangeHandler = null;
  }

  // ... rest of cleanup
}
```

### Step 3.4: Fix StateManager Shallow Copy
**File:** `Public/components/shared/StateManager.js:61-63`
```javascript
// BEFORE:
getState() {
  return { ...this.state };
}

// AFTER:
getState() {
  // Deep clone to prevent mutation
  return JSON.parse(JSON.stringify(this.state));
}

// Or for better performance with structuredClone (modern browsers):
getState() {
  try {
    return structuredClone(this.state);
  } catch {
    // Fallback for older browsers
    return JSON.parse(JSON.stringify(this.state));
  }
}
```

### Step 3.5: Fix Request Deduplication Race Condition
**File:** `Public/components/shared/StateManager.js:199-214`
```javascript
// BEFORE:
async loadView(viewName, forceRefresh = false) {
  const requestKey = `${this.state.sessionId}:${viewName}`;
  if (!forceRefresh && this._pendingRequests.has(requestKey)) {
    return this._pendingRequests.get(requestKey);
  }

  const requestPromise = this._executeLoadView(viewName, forceRefresh);
  this._pendingRequests.set(requestKey, requestPromise);
  // ...
}

// AFTER:
async loadView(viewName, forceRefresh = false) {
  const requestKey = `${this.state.sessionId}:${viewName}`;

  // Check-and-set atomically using a lock
  if (!forceRefresh) {
    const existingPromise = this._pendingRequests.get(requestKey);
    if (existingPromise) {
      return existingPromise;
    }
  }

  // Create promise immediately and set before any async work
  let resolveRequest, rejectRequest;
  const requestPromise = new Promise((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });

  this._pendingRequests.set(requestKey, requestPromise);

  try {
    const result = await this._executeLoadView(viewName, forceRefresh);
    resolveRequest(result);
    return result;
  } catch (error) {
    rejectRequest(error);
    throw error;
  } finally {
    this._pendingRequests.delete(requestKey);
  }
}
```

### Step 3.6: Fix MutationObserver Memory Leak
**File:** `Public/components/shared/Accessibility.js:62-67`
```javascript
// BEFORE:
new MutationObserver((mutations) => {
  // ...
}).observe(document.body, { childList: true, subtree: true });

// AFTER:
let focusTrapObserver = null;

export function initFocusTrapObserver() {
  if (focusTrapObserver) {
    return; // Already initialized
  }

  focusTrapObserver = new MutationObserver((mutations) => {
    mutations.forEach((m) => m.addedNodes.forEach((node) => {
      if (node.nodeType === 1 &&
          (node.getAttribute('role') === 'dialog' ||
           node.getAttribute('role') === 'alertdialog')) {
        trapFocus(node);
      }
    }));
  });

  focusTrapObserver.observe(document.body, { childList: true, subtree: true });
}

export function destroyFocusTrapObserver() {
  if (focusTrapObserver) {
    focusTrapObserver.disconnect();
    focusTrapObserver = null;
  }
}
```

### Step 3.7: Fix GanttChart Event Listener Accumulation
**File:** `Public/GanttChart.js:298, 440`
```javascript
class GanttChart {
  constructor() {
    this._boundKeyboardHandler = null;
    this._boundCursorFeedbackHandler = null;
  }

  _initializeDragToEdit() {
    // Remove existing listeners before adding new ones
    this._removeEventListeners();

    // Create bound handlers
    this._boundKeyboardHandler = (e) => this._handleKeyboard(e);
    this._boundCursorFeedbackHandler = (e) => this._handleCursorFeedback(e);

    // Add listeners
    document.addEventListener('keydown', this._boundKeyboardHandler);
    if (this.gridElement) {
      this.gridElement.addEventListener('mousemove', this._boundCursorFeedbackHandler);
    }
  }

  _removeEventListeners() {
    if (this._boundKeyboardHandler) {
      document.removeEventListener('keydown', this._boundKeyboardHandler);
    }
    if (this._boundCursorFeedbackHandler && this.gridElement) {
      this.gridElement.removeEventListener('mousemove', this._boundCursorFeedbackHandler);
    }
  }

  destroy() {
    this._removeEventListeners();
    // ... rest of cleanup
  }
}
```

---

## Phase 4: Input Validation & Error Handling
**Priority:** HIGH
**Estimated Effort:** 3-4 days
**Risk Level:** Low (defensive additions)

### Step 4.1: Create Input Validation Utilities
**New File:** `server/utils/validation.js`
```javascript
/**
 * Validation utility functions
 */

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositiveInteger(value) {
  return typeof value === 'number' &&
         Number.isInteger(value) &&
         value >= 0;
}

export function isValidArrayIndex(value, arrayLength) {
  return isPositiveInteger(value) && value < arrayLength;
}

export function isValidPort(value) {
  const port = parseInt(value, 10);
  return !isNaN(port) && port >= 1 && port <= 65535;
}

export function isValidDate(value) {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

export function sanitizeForLog(value, maxLength = 100) {
  if (typeof value !== 'string') {
    value = String(value);
  }
  return value.substring(0, maxLength).replace(/[\n\r]/g, ' ');
}

// Validation schema helper
export function validateSchema(data, schema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value !== undefined && value !== null) {
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be a ${rules.type}`);
      }

      if (rules.type === 'string' && rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      if (rules.type === 'number' && rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }

      if (rules.type === 'number' && rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }

      if (rules.validator && !rules.validator(value)) {
        errors.push(rules.message || `${field} is invalid`);
      }
    }
  }

  return errors.length > 0 ? errors : null;
}
```

### Step 4.2: Fix Array Bounds Validation
**File:** `server/routes/content.js:834-851`
```javascript
import { isValidArrayIndex, validateSchema } from '../utils/validation.js';

router.post('/update-task-dates', express.json(), async (req, res) => {
  const { sessionId, taskIndex, startCol, endCol } = req.body;

  // Comprehensive validation
  const errors = validateSchema(req.body, {
    sessionId: { required: true, type: 'string', minLength: 1 },
    taskIndex: { required: true, type: 'number', min: 0 },
    startCol: { type: 'number', min: 0 },
    endCol: { type: 'number', min: 0 }
  });

  if (errors) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const session = await sessionStorage.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const roadmapData = session.content.roadmap?.data;

  if (!roadmapData || !Array.isArray(roadmapData.data)) {
    return res.status(400).json({ error: 'No roadmap data found' });
  }

  // Validate array bounds
  if (!isValidArrayIndex(taskIndex, roadmapData.data.length)) {
    return res.status(400).json({
      error: 'Invalid task index',
      details: `taskIndex must be between 0 and ${roadmapData.data.length - 1}`
    });
  }

  const task = roadmapData.data[taskIndex];

  if (!task.bar) {
    return res.status(400).json({ error: 'Task has no bar property' });
  }

  // ... rest of update logic
});
```

### Step 4.3: Fix HTTP Status Code Handling
**File:** `server/routes/content.js` - Create error handler
```javascript
// Custom error classes
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
  }
}

// Error response handler
function handleRouteError(res, error) {
  const statusCode = error.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  // Log server errors
  if (!isClientError) {
    console.error('[Route Error]', error);
  }

  res.status(statusCode).json({
    error: error.message || 'An unexpected error occurred',
    ...(error.details && { details: error.details }),
    ...(process.env.NODE_ENV !== 'production' && !isClientError && {
      stack: error.stack
    })
  });
}

// Usage in routes:
router.get('/:sessionId/:viewType', async (req, res) => {
  try {
    // ... route logic
    if (!session) {
      throw new NotFoundError('Session not found');
    }
  } catch (error) {
    handleRouteError(res, error);
  }
});
```

### Step 4.4: Fix SSE Error Status Codes
**File:** `server/routes/content.js:357-367`
```javascript
// BEFORE:
if (!prompt || typeof prompt !== 'string') {
  sendEvent('error', { message: 'Invalid request...' });
  clearInterval(heartbeatInterval);
  return res.end();
}

// AFTER:
if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
  // Set status before sending events
  res.status(400);
  sendEvent('error', {
    message: 'Invalid request. Required: prompt (non-empty string)',
    code: 'VALIDATION_ERROR'
  });
  clearInterval(heartbeatInterval);
  return res.end();
}
```

### Step 4.5: Add Comprehensive parseInt Validation
**File:** `server/routes/content.js:993` and other locations
```javascript
// Create helper function
function parseIntSafe(value, defaultValue, min = 0, max = Infinity) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  return Math.min(Math.max(parsed, min), max);
}

// Usage:
const limit = parseIntSafe(req.query.limit, 10, 1, 50);
const offset = parseIntSafe(req.query.offset, 0, 0, 1000);
```

---

## Phase 5: Cache & State Management Fixes
**Priority:** MEDIUM
**Estimated Effort:** 2-3 days
**Risk Level:** Medium

### Step 5.1: Fix Cache Defensive Copy
**File:** `server/cache/contentCache.js:208`
```javascript
// BEFORE:
getByContent(content) {
  // ...
  return similar.entry.data; // Direct reference!
}

// AFTER:
getByContent(content) {
  const similar = this._findSimilar(content);
  if (!similar) return null;

  // Return deep copy to prevent mutation
  try {
    return JSON.parse(JSON.stringify(similar.entry.data));
  } catch (error) {
    console.error('[Cache] Failed to clone similar data:', error.message);
    return null;
  }
}
```

### Step 5.2: Fix TTL Extension on Touch
**File:** `server/storage/sessionStorage.js:175-182`
```javascript
// BEFORE:
async touch(key) {
  const entry = this.store.get(key);
  if (entry) {
    entry.lastAccessed = Date.now();
    return true;
  }
  return false;
}

// AFTER:
async touch(key, extendTtl = true) {
  const entry = this.store.get(key);
  if (entry) {
    const now = Date.now();
    entry.lastAccessed = now;

    // Extend TTL if requested (sliding expiration)
    if (extendTtl && entry.ttl) {
      entry.expiresAt = now + entry.ttl;
    }

    return true;
  }
  return false;
}
```

### Step 5.3: Fix Memoization Cache Cleanup
**File:** `Public/components/shared/StateManager.js`
```javascript
constructor() {
  this._memoCache = new Map();
  this._contentHashes = new Map();
  this._maxMemoSize = 100;

  // Start periodic cleanup
  this._cleanupInterval = setInterval(() => this._cleanupMemoCache(), 60000);
}

_cleanupMemoCache() {
  // Limit cache size with LRU eviction
  if (this._memoCache.size > this._maxMemoSize) {
    const keysToDelete = [...this._memoCache.keys()]
      .slice(0, this._memoCache.size - this._maxMemoSize);

    for (const key of keysToDelete) {
      this._memoCache.delete(key);
    }
  }
}

// Invalidate on content change
setState(newState) {
  const previousState = this.state;

  // Check if content changed
  if (newState.content && previousState.content !== newState.content) {
    // Invalidate affected memoization entries
    for (const viewName of Object.keys(newState.content)) {
      this.invalidateMemo(viewName);
    }
  }

  // ... rest of setState
}

destroy() {
  clearInterval(this._cleanupInterval);
  this._memoCache.clear();
  this._contentHashes.clear();
  // ... rest of cleanup
}
```

### Step 5.4: Fix Cache Expiration Cleanup Performance
**File:** `server/cache/contentCache.js:284-298`
```javascript
// BEFORE:
clearExpired() {
  const now = Date.now();
  let cleared = 0;

  for (const [hash, entry] of this.cache) {
    if (now > entry.expiresAt) {
      this.cache.delete(hash);
      this.accessOrder = this.accessOrder.filter(h => h !== hash); // O(n) each time!
      this.metrics.expirations++;
      cleared++;
    }
  }
  return cleared;
}

// AFTER:
clearExpired() {
  const now = Date.now();
  const expiredKeys = [];

  // Collect expired keys first
  for (const [hash, entry] of this.cache) {
    if (now > entry.expiresAt) {
      expiredKeys.push(hash);
    }
  }

  // Batch delete from cache
  for (const hash of expiredKeys) {
    this.cache.delete(hash);
    this.metrics.expirations++;
  }

  // Rebuild accessOrder once (O(n) instead of O(n*m))
  if (expiredKeys.length > 0) {
    const expiredSet = new Set(expiredKeys);
    this.accessOrder = this.accessOrder.filter(h => !expiredSet.has(h));
  }

  return expiredKeys.length;
}
```

### Step 5.5: Add Cache Size Limits
**File:** `server/layers/optimization/cache-optimizer.js`
```javascript
constructor(config = {}) {
  this.maxQueueSize = config.maxQueueSize || 100;
  this.warmingQueue = [];
  // ...
}

scheduleWarming(warmingTask) {
  // Enforce queue size limit
  if (this.warmingQueue.length >= this.maxQueueSize) {
    // Remove oldest task
    this.warmingQueue.shift();
    console.warn('[CacheOptimizer] Warming queue full, dropped oldest task');
  }

  this.warmingQueue.push({
    ...warmingTask,
    scheduledAt: Date.now()
  });
}
```

---

## Phase 6: Browser Compatibility & Polish
**Priority:** MEDIUM
**Estimated Effort:** 2-3 days
**Risk Level:** Low

### Step 6.1: Add queueMicrotask Polyfill
**File:** `Public/components/shared/StateManager.js:76`
```javascript
// Add at top of file
const queueTask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (callback) => Promise.resolve().then(callback);

// Usage:
batchSetState(updates) {
  this._pendingStateUpdates.push(updates);
  if (!this._updateScheduled) {
    this._updateScheduled = true;
    queueTask(() => this._flushStateUpdates());
  }
}
```

### Step 6.2: Add replaceChildren Polyfill
**File:** `Public/components/shared/DomUtils.js:272`
```javascript
// BEFORE:
this.viewport.replaceChildren(fragment);

// AFTER:
function replaceChildrenSafe(parent, ...newChildren) {
  if (typeof parent.replaceChildren === 'function') {
    parent.replaceChildren(...newChildren);
  } else {
    // Fallback for older browsers
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }
    for (const child of newChildren) {
      parent.appendChild(child);
    }
  }
}

// Usage:
replaceChildrenSafe(this.viewport, fragment);
```

### Step 6.3: Fix Screen Reader Announcement Race Condition
**File:** `Public/components/shared/Accessibility.js:13-14`
```javascript
// BEFORE:
export function announceToScreenReader(message, priority = 'polite') {
  const liveRegion = document.getElementById('sr-live-region') || createLiveRegion();
  liveRegion.textContent = '';
  setTimeout(() => { liveRegion.textContent = message; }, 100);
}

// AFTER:
let announcementQueue = [];
let isAnnouncing = false;

export function announceToScreenReader(message, priority = 'polite') {
  announcementQueue.push({ message, priority });
  processAnnouncementQueue();
}

async function processAnnouncementQueue() {
  if (isAnnouncing || announcementQueue.length === 0) {
    return;
  }

  isAnnouncing = true;
  const liveRegion = document.getElementById('sr-live-region') || createLiveRegion();

  while (announcementQueue.length > 0) {
    const { message, priority } = announcementQueue.shift();

    liveRegion.setAttribute('aria-live', priority);
    liveRegion.textContent = '';

    // Wait for DOM update
    await new Promise(resolve => setTimeout(resolve, 50));

    liveRegion.textContent = message;

    // Wait for screen reader to process
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  isAnnouncing = false;
}
```

### Step 6.4: Add Progress Timer Cleanup on Page Unload
**File:** `Public/main.js`
```javascript
let progressInterval = null;

const startProgressTimer = () => {
  progressInterval = setInterval(() => {
    elapsedSeconds++;
    generateBtn.textContent = `Generating... (${formatElapsed(elapsedSeconds)})`;
  }, 1000);
};

const stopProgressTimer = () => {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
};

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopProgressTimer();
});

// Also clean up on visibility change (tab hidden)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && progressInterval) {
    // Optionally pause or cleanup
    console.log('[Timer] Page hidden, timer still running');
  }
});
```

### Step 6.5: Fix Tooltip Timeout Cleanup
**File:** `Public/components/SidebarNav.js:379-398`
```javascript
destroy() {
  // Clear any pending timeouts
  if (this.tooltipTimeout) {
    clearTimeout(this.tooltipTimeout);
    this.tooltipTimeout = null;
  }

  // Remove tooltip from DOM
  if (this.tooltip?.parentNode) {
    this.tooltip.remove();
    this.tooltip = null;
  }

  // ... rest of cleanup
}
```

---

## Testing Strategy

### Unit Tests to Add
```javascript
// test/unit/validation.test.js
describe('Validation Utils', () => {
  test('isValidArrayIndex rejects negative numbers', () => {
    expect(isValidArrayIndex(-1, 10)).toBe(false);
  });

  test('isValidArrayIndex rejects out of bounds', () => {
    expect(isValidArrayIndex(10, 10)).toBe(false);
  });

  test('validateSchema catches missing required fields', () => {
    const errors = validateSchema({}, { name: { required: true } });
    expect(errors).toContain('name is required');
  });
});

// test/unit/storage.test.js
describe('Session Storage', () => {
  test('handles concurrent initialization safely', async () => {
    const storage = new StorageManager();

    // Concurrent init calls
    const results = await Promise.all([
      storage.initialize(),
      storage.initialize(),
      storage.initialize()
    ]);

    // Should all succeed without creating multiple connections
    expect(storage._initialized).toBe(true);
  });
});
```

### Integration Tests to Add
```javascript
// test/integration/api.test.js
describe('API Validation', () => {
  test('rejects invalid taskIndex', async () => {
    const response = await request(app)
      .post('/api/content/update-task-dates')
      .send({ sessionId: 'test', taskIndex: -1 });

    expect(response.status).toBe(400);
  });

  test('returns 404 for missing session', async () => {
    const response = await request(app)
      .get('/api/content/nonexistent/roadmap');

    expect(response.status).toBe(404);
  });
});
```

---

## Rollback Plan

For each phase, prepare rollback procedures:

1. **Phase 1 (Security)**: Keep backup of old config files
2. **Phase 2 (Auth)**: Feature flag for auth requirement
3. **Phase 3 (Race Conditions)**: A/B test with old code path
4. **Phase 4 (Validation)**: Validation can be toggled off if too strict
5. **Phase 5 (Cache)**: Monitor cache hit rates before/after
6. **Phase 6 (Compat)**: Feature detection with fallbacks

---

## Monitoring & Verification

After each phase, verify:

1. **Error rates** - Should decrease or stay stable
2. **Memory usage** - Should stabilize or decrease
3. **Response times** - Should not significantly increase
4. **Cache hit rates** - Should remain stable or improve
5. **Test coverage** - Should increase

---

## Summary

| Phase | Focus | Days | Risk |
|-------|-------|------|------|
| 1 | Security Emergency | 1-2 | Low |
| 2 | Authentication | 3-5 | Medium |
| 3 | Race Conditions & Memory | 3-4 | Medium |
| 4 | Input Validation | 3-4 | Low |
| 5 | Cache & State | 2-3 | Medium |
| 6 | Browser Compatibility | 2-3 | Low |
| **Total** | | **14-21** | |

---

*Implementation plan generated by Claude Code - 2025-11-28*
