/**
 * Advanced Optimization Utilities
 *
 * Phase 9 optimizations:
 * - Connection prewarming for Gemini API
 * - Prompt template caching and pre-compilation
 * - Worker thread pool for CPU-intensive tasks
 * - Speculative generation hints
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Prompt caching settings
  promptCache: {
    enabled: true,
    maxSize: 50,  // Max cached templates
    ttlMs: 24 * 60 * 60 * 1000  // 24 hours
  },
  // Connection warming settings
  warmup: {
    enabled: true,
    intervalMs: 5 * 60 * 1000,  // Re-warm every 5 minutes
    retryDelayMs: 30000  // Retry on failure after 30 seconds
  },
  // Worker pool settings
  workerPool: {
    minWorkers: 1,
    maxWorkers: Math.max(2, cpus().length - 1),  // Leave one core for main thread
    idleTimeoutMs: 60000  // Terminate idle workers after 1 minute
  }
};

// ============================================================================
// PROMPT TEMPLATE CACHING
// ============================================================================

/**
 * Prompt Template Cache
 * Pre-compiles and caches prompt templates to reduce string concatenation overhead
 */
class PromptTemplateCache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      compilations: 0
    };
  }

  /**
   * Create a compiled template function
   * Replaces {{variable}} placeholders with actual values
   *
   * @param {string} template - Template string with {{variable}} placeholders
   * @returns {Function} Compiled template function
   */
  compile(template) {
    this.stats.compilations++;

    // Extract variable names from template
    const variableRegex = /\{\{(\w+)\}\}/g;
    const parts = [];
    const variables = [];
    let lastIndex = 0;
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      // Add static part before this variable
      if (match.index > lastIndex) {
        parts.push({ type: 'static', value: template.slice(lastIndex, match.index) });
      }
      // Add variable placeholder
      parts.push({ type: 'variable', name: match[1] });
      variables.push(match[1]);
      lastIndex = match.index + match[0].length;
    }

    // Add remaining static part
    if (lastIndex < template.length) {
      parts.push({ type: 'static', value: template.slice(lastIndex) });
    }

    // Return compiled function
    return (values) => {
      let result = '';
      for (const part of parts) {
        if (part.type === 'static') {
          result += part.value;
        } else {
          result += values[part.name] ?? '';
        }
      }
      return result;
    };
  }

  /**
   * Get or compile a cached template
   * @param {string} key - Cache key
   * @param {string} template - Template string
   * @returns {Function} Compiled template function
   */
  getOrCompile(key, template) {
    if (!CONFIG.promptCache.enabled) {
      return this.compile(template);
    }

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.createdAt < CONFIG.promptCache.ttlMs) {
      this.stats.hits++;
      return cached.fn;
    }

    this.stats.misses++;

    // Evict oldest entries if at capacity
    if (this.cache.size >= CONFIG.promptCache.maxSize) {
      const oldest = [...this.cache.entries()]
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }

    const fn = this.compile(template);
    this.cache.set(key, { fn, createdAt: Date.now() });

    return fn;
  }

  /**
   * Pre-compile common templates on startup
   * @param {Array} templates - Array of { key, template } objects
   */
  precompile(templates) {
    for (const { key, template } of templates) {
      this.getOrCompile(key, template);
    }
  }

  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  clear() {
    this.cache.clear();
  }
}

// ============================================================================
// CONNECTION PREWARMING
// ============================================================================

/**
 * Connection Prewarm Manager
 * Keeps API connections warm to reduce cold start latency
 */
class ConnectionPrewarmer {
  constructor() {
    this.lastWarmup = null;
    this.warmupInterval = null;
    this.isWarming = false;
    this.warmupCallbacks = [];
    this.stats = {
      warmups: 0,
      failures: 0,
      lastWarmupTime: null,
      lastWarmupDuration: null
    };
  }

  /**
   * Register a warmup callback
   * @param {string} name - Name of the service to warm
   * @param {Function} callback - Async function to call for warming
   */
  register(name, callback) {
    this.warmupCallbacks.push({ name, callback });
  }

  /**
   * Execute warmup for all registered services
   */
  async warmup() {
    if (this.isWarming) return;
    this.isWarming = true;

    const startTime = Date.now();

    try {
      await Promise.all(
        this.warmupCallbacks.map(async ({ name, callback }) => {
          try {
            await callback();
          } catch (error) {
            console.warn(`[Warmup] ${name} failed:`, error.message);
          }
        })
      );

      this.stats.warmups++;
      this.stats.lastWarmupTime = new Date().toISOString();
      this.stats.lastWarmupDuration = Date.now() - startTime;
      this.lastWarmup = Date.now();

    } catch (error) {
      this.stats.failures++;
      console.error('[Warmup] Failed:', error.message);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Start periodic warmup
   */
  start() {
    if (!CONFIG.warmup.enabled) return;

    // Initial warmup
    this.warmup();

    // Schedule periodic warmups
    this.warmupInterval = setInterval(() => {
      this.warmup();
    }, CONFIG.warmup.intervalMs);

    console.log('[Warmup] Connection prewarmer started');
  }

  /**
   * Stop periodic warmup
   */
  stop() {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
    }
  }

  getStats() {
    return {
      ...this.stats,
      registeredServices: this.warmupCallbacks.map(c => c.name),
      isWarming: this.isWarming,
      timeSinceLastWarmup: this.lastWarmup
        ? `${Math.round((Date.now() - this.lastWarmup) / 1000)}s ago`
        : 'never'
    };
  }
}

// ============================================================================
// LIGHTWEIGHT WORKER POOL (WITHOUT PISCINA DEPENDENCY)
// ============================================================================

/**
 * Simple Worker Pool Implementation
 * Manages worker threads for CPU-intensive tasks without external dependencies
 */
class WorkerPool {
  constructor(workerPath, options = {}) {
    this.workerPath = workerPath;
    this.minWorkers = options.minWorkers || CONFIG.workerPool.minWorkers;
    this.maxWorkers = options.maxWorkers || CONFIG.workerPool.maxWorkers;
    this.idleTimeout = options.idleTimeoutMs || CONFIG.workerPool.idleTimeoutMs;

    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
    this.stats = {
      tasksCompleted: 0,
      tasksFailed: 0,
      workersCreated: 0,
      workersTerminated: 0
    };
  }

  /**
   * Create a new worker
   */
  _createWorker() {
    const worker = new Worker(this.workerPath);
    this.stats.workersCreated++;

    // Track if this worker has already been removed (prevents double-removal)
    let removed = false;

    worker.on('error', (error) => {
      console.error('[WorkerPool] Worker error:', error);
      if (!removed) {
        removed = true;
        this._removeWorker(worker);
      }
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`[WorkerPool] Worker exited with code ${code}`);
      }
      if (!removed) {
        removed = true;
        this._removeWorker(worker);
      }
    });

    this.workers.push(worker);
    return worker;
  }

  /**
   * Remove a worker from the pool
   */
  _removeWorker(worker) {
    const idx = this.workers.indexOf(worker);
    if (idx !== -1) {
      this.workers.splice(idx, 1);
    }
    const idleIdx = this.idleWorkers.indexOf(worker);
    if (idleIdx !== -1) {
      this.idleWorkers.splice(idleIdx, 1);
    }
    this.stats.workersTerminated++;
  }

  /**
   * Get an available worker or create one
   */
  _getWorker() {
    // Use idle worker if available
    if (this.idleWorkers.length > 0) {
      return this.idleWorkers.pop();
    }

    // Create new worker if under limit
    if (this.workers.length < this.maxWorkers) {
      return this._createWorker();
    }

    return null;
  }

  /**
   * Return worker to idle pool
   */
  _returnWorker(worker) {
    // Only add to idle pool if worker is still in main pool
    if (!this.workers.includes(worker)) {
      return;
    }

    this.idleWorkers.push(worker);

    // Set idle timeout
    setTimeout(() => {
      // Verify worker is still idle and still in pool before terminating
      const idleIdx = this.idleWorkers.indexOf(worker);
      const mainIdx = this.workers.indexOf(worker);

      if (idleIdx !== -1 && mainIdx !== -1 && this.workers.length > this.minWorkers) {
        this.idleWorkers.splice(idleIdx, 1);
        this.workers.splice(mainIdx, 1);
        this.stats.workersTerminated++;
        worker.terminate().catch(() => {});  // Gracefully handle termination errors
      }
    }, this.idleTimeout);
  }

  /**
   * Execute a task on a worker
   * @param {object} taskData - Data to send to worker
   * @returns {Promise} Result from worker
   */
  async run(taskData) {
    return new Promise((resolve, reject) => {
      const worker = this._getWorker();

      if (!worker) {
        // Queue the task
        this.taskQueue.push({ taskData, resolve, reject });
        return;
      }

      this._executeTask(worker, taskData, resolve, reject);
    });
  }

  /**
   * Execute task on specific worker
   */
  _executeTask(worker, taskData, resolve, reject) {
    const messageHandler = (result) => {
      worker.off('message', messageHandler);
      worker.off('error', errorHandler);

      this.stats.tasksCompleted++;

      // Return worker to pool
      this._returnWorker(worker);

      // Process queued task if any
      if (this.taskQueue.length > 0) {
        const { taskData: nextTask, resolve: nextResolve, reject: nextReject } = this.taskQueue.shift();
        const nextWorker = this._getWorker();
        if (nextWorker) {
          this._executeTask(nextWorker, nextTask, nextResolve, nextReject);
        }
      }

      resolve(result);
    };

    const errorHandler = (error) => {
      worker.off('message', messageHandler);
      worker.off('error', errorHandler);

      this.stats.tasksFailed++;
      reject(error);
    };

    worker.on('message', messageHandler);
    worker.on('error', errorHandler);
    worker.postMessage(taskData);
  }

  /**
   * Terminate all workers
   */
  async terminate() {
    await Promise.all(this.workers.map(w => w.terminate()));
    this.workers = [];
    this.idleWorkers = [];
  }

  getStats() {
    return {
      ...this.stats,
      activeWorkers: this.workers.length - this.idleWorkers.length,
      idleWorkers: this.idleWorkers.length,
      totalWorkers: this.workers.length,
      queuedTasks: this.taskQueue.length
    };
  }
}

// ============================================================================
// SPECULATIVE GENERATION HINTS
// ============================================================================

/**
 * Speculative Generation Manager
 * Tracks usage patterns to optimize generation order
 */
class SpeculativeGenerator {
  constructor() {
    this.viewStats = {
      roadmap: { views: 0, firstViews: 0 },
      slides: { views: 0, firstViews: 0 },
      document: { views: 0, firstViews: 0 },
      'research-analysis': { views: 0, firstViews: 0 }
    };
    this.sessionFirstViews = new Map();  // Track first view per session
  }

  /**
   * Record a view event
   * @param {string} sessionId - Session ID
   * @param {string} viewType - Type of view accessed
   */
  recordView(sessionId, viewType) {
    if (!this.viewStats[viewType]) return;

    this.viewStats[viewType].views++;

    // Track if this is the first view for this session
    if (!this.sessionFirstViews.has(sessionId)) {
      this.sessionFirstViews.set(sessionId, viewType);
      this.viewStats[viewType].firstViews++;

      // Limit session tracking memory - batch cleanup to prevent exceeding limit
      if (this.sessionFirstViews.size > 1000) {
        // Remove oldest 100 entries in batch to avoid frequent cleanup
        const keysToDelete = [...this.sessionFirstViews.keys()].slice(0, 100);
        for (const key of keysToDelete) {
          this.sessionFirstViews.delete(key);
        }
      }
    }
  }

  /**
   * Get optimal generation order based on usage patterns
   * @returns {Array} Ordered array of view types
   */
  getOptimalOrder() {
    // Sort by first view frequency (what users look at first)
    const sorted = Object.entries(this.viewStats)
      .sort((a, b) => b[1].firstViews - a[1].firstViews)
      .map(([type]) => type);

    // Default order if no data
    if (sorted.every(type => this.viewStats[type].firstViews === 0)) {
      return ['roadmap', 'slides', 'document', 'research-analysis'];
    }

    return sorted;
  }

  /**
   * Get priority for a specific content type
   * @param {string} viewType - Content type
   * @returns {number} Priority (1 = highest)
   */
  getPriority(viewType) {
    const order = this.getOptimalOrder();
    const index = order.indexOf(viewType);
    return index === -1 ? 4 : index + 1;
  }

  getStats() {
    return {
      viewStats: this.viewStats,
      optimalOrder: this.getOptimalOrder(),
      trackedSessions: this.sessionFirstViews.size
    };
  }

  reset() {
    this.viewStats = {
      roadmap: { views: 0, firstViews: 0 },
      slides: { views: 0, firstViews: 0 },
      document: { views: 0, firstViews: 0 },
      'research-analysis': { views: 0, firstViews: 0 }
    };
    this.sessionFirstViews.clear();
  }
}

// ============================================================================
// REQUEST PREFETCHER
// ============================================================================

/**
 * Request Prefetcher
 * Anticipates likely requests and preloads data
 */
class RequestPrefetcher {
  constructor() {
    this.prefetchCache = new Map();
    this.maxCacheSize = 20;
    this.ttlMs = 30000;  // 30 second TTL for prefetched data
    this.stats = {
      prefetches: 0,
      hits: 0,
      misses: 0,
      expired: 0
    };
  }

  /**
   * Prefetch data for a likely request
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch data
   */
  async prefetch(key, fetchFn) {
    if (this.prefetchCache.has(key)) return;

    // Enforce cache size limit
    if (this.prefetchCache.size >= this.maxCacheSize) {
      const oldest = [...this.prefetchCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) {
        this.prefetchCache.delete(oldest[0]);
      }
    }

    this.stats.prefetches++;

    try {
      const data = await fetchFn();
      this.prefetchCache.set(key, {
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn(`[Prefetch] Failed for ${key}:`, error.message);
    }
  }

  /**
   * Get prefetched data if available
   * @param {string} key - Cache key
   * @returns {*} Prefetched data or null
   */
  get(key) {
    const entry = this.prefetchCache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.prefetchCache.delete(key);
      this.stats.expired++;
      return null;
    }

    this.stats.hits++;
    this.prefetchCache.delete(key);  // One-time use
    return entry.data;
  }

  getStats() {
    return {
      ...this.stats,
      cacheSize: this.prefetchCache.size,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  clear() {
    this.prefetchCache.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const promptCache = new PromptTemplateCache();
export const connectionPrewarmer = new ConnectionPrewarmer();
export const speculativeGenerator = new SpeculativeGenerator();
export const requestPrefetcher = new RequestPrefetcher();

// Note: WorkerPool requires a worker script path, so it's exported as a class
export { WorkerPool };

/**
 * Get aggregated stats from all optimizers
 */
export function getAdvancedOptimizationStats() {
  return {
    promptCache: promptCache.getStats(),
    warmup: connectionPrewarmer.getStats(),
    speculative: speculativeGenerator.getStats(),
    prefetch: requestPrefetcher.getStats()
  };
}

/**
 * Initialize all optimizers
 */
export function initializeOptimizers() {
  // Start connection prewarmer
  connectionPrewarmer.start();

  console.log('[AdvancedOptimizer] Initialized');
}

/**
 * Shutdown all optimizers gracefully
 */
export function shutdownOptimizers() {
  connectionPrewarmer.stop();
  promptCache.clear();
  requestPrefetcher.clear();
}

export default {
  promptCache,
  connectionPrewarmer,
  speculativeGenerator,
  requestPrefetcher,
  WorkerPool,
  getAdvancedOptimizationStats,
  initializeOptimizers,
  shutdownOptimizers
};
