/**
 * Metrics Storage Backends - Auto-Improving Prompts Phase 1
 *
 * Provides storage implementations for metrics data:
 * - InMemoryStorage: Fast, volatile storage for development
 * - FileStorage: Persistent JSON file storage for production
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Base storage interface
 * @interface
 */
class StorageBackend {
  async batchInsert(metrics) { throw new Error('Not implemented'); }
  async updateFeedback(generationId, feedback) { throw new Error('Not implemented'); }
  async queryByVariant(variantId, options) { throw new Error('Not implemented'); }
  async queryByContentType(contentType, options) { throw new Error('Not implemented'); }
  async getById(generationId) { throw new Error('Not implemented'); }
  async getStats() { throw new Error('Not implemented'); }
}

/**
 * In-memory storage for development and testing
 */
export class InMemoryStorage extends StorageBackend {
  constructor() {
    super();
    this._data = new Map();
    this._byVariant = new Map();      // variantId -> Set<generationId>
    this._byContentType = new Map();  // contentType -> Set<generationId>
  }

  async batchInsert(metrics) {
    for (const metric of metrics) {
      this._data.set(metric.generationId, metric);

      // Index by variant
      const variantId = metric.promptVersion.variantId;
      if (!this._byVariant.has(variantId)) {
        this._byVariant.set(variantId, new Set());
      }
      this._byVariant.get(variantId).add(metric.generationId);

      // Index by content type
      const contentType = metric.promptVersion.contentType;
      if (!this._byContentType.has(contentType)) {
        this._byContentType.set(contentType, new Set());
      }
      this._byContentType.get(contentType).add(metric.generationId);
    }

    return metrics.length;
  }

  async updateFeedback(generationId, feedback) {
    const metric = this._data.get(generationId);
    if (metric) {
      metric.feedback = { ...metric.feedback, ...feedback };
      metric.feedbackUpdatedAt = new Date();
      return true;
    }
    return false;
  }

  async queryByVariant(variantId, options = {}) {
    const { startDate, endDate, limit } = options;
    const ids = this._byVariant.get(variantId) || new Set();
    const results = [];

    for (const id of ids) {
      const metric = this._data.get(id);
      if (!metric) continue;

      if (startDate && metric.timestamp < startDate) continue;
      if (endDate && metric.timestamp > endDate) continue;

      results.push(metric);

      if (limit && results.length >= limit) break;
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  async queryByContentType(contentType, options = {}) {
    const { startDate, endDate, limit } = options;
    const ids = this._byContentType.get(contentType) || new Set();
    const results = [];

    for (const id of ids) {
      const metric = this._data.get(id);
      if (!metric) continue;

      if (startDate && metric.timestamp < startDate) continue;
      if (endDate && metric.timestamp > endDate) continue;

      results.push(metric);

      if (limit && results.length >= limit) break;
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getById(generationId) {
    return this._data.get(generationId) || null;
  }

  async getStats() {
    const stats = {
      totalMetrics: this._data.size,
      byVariant: {},
      byContentType: {}
    };

    for (const [variantId, ids] of this._byVariant) {
      stats.byVariant[variantId] = ids.size;
    }

    for (const [contentType, ids] of this._byContentType) {
      stats.byContentType[contentType] = ids.size;
    }

    return stats;
  }

  async clear() {
    this._data.clear();
    this._byVariant.clear();
    this._byContentType.clear();
  }
}

/**
 * File-based storage for persistence
 */
export class FileStorage extends StorageBackend {
  constructor(config = {}) {
    super();
    this.dataDir = config.dataDir || './data/metrics';
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.flushIntervalMs = config.flushIntervalMs || 60000;    // 1 minute

    this._cache = new InMemoryStorage();  // Memory cache for reads
    this._dirty = false;
    this._initialized = false;
  }

  async initialize() {
    if (this._initialized) return;

    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await this._loadFromDisk();
      this._startAutoFlush();
      this._initialized = true;
    } catch (error) {
      console.error('[FileStorage] Initialization error:', error.message);
      throw error;
    }
  }

  async batchInsert(metrics) {
    await this._ensureInitialized();
    const count = await this._cache.batchInsert(metrics);
    this._dirty = true;
    return count;
  }

  async updateFeedback(generationId, feedback) {
    await this._ensureInitialized();
    const result = await this._cache.updateFeedback(generationId, feedback);
    if (result) {
      this._dirty = true;
    }
    return result;
  }

  async queryByVariant(variantId, options = {}) {
    await this._ensureInitialized();
    return this._cache.queryByVariant(variantId, options);
  }

  async queryByContentType(contentType, options = {}) {
    await this._ensureInitialized();
    return this._cache.queryByContentType(contentType, options);
  }

  async getById(generationId) {
    await this._ensureInitialized();
    return this._cache.getById(generationId);
  }

  async getStats() {
    await this._ensureInitialized();
    return this._cache.getStats();
  }

  async flush() {
    if (!this._dirty) return;

    try {
      const stats = await this._cache.getStats();

      // Group metrics by content type for organized storage
      for (const contentType of Object.keys(stats.byContentType)) {
        const metrics = await this._cache.queryByContentType(contentType, {});
        const filePath = path.join(this.dataDir, `${contentType.toLowerCase()}.json`);

        // Write with date partitioning for large datasets
        const data = {
          contentType,
          updatedAt: new Date().toISOString(),
          count: metrics.length,
          metrics: metrics.map(m => this._serializeMetric(m))
        };

        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      }

      this._dirty = false;
      console.log('[FileStorage] Flushed metrics to disk');
    } catch (error) {
      console.error('[FileStorage] Flush error:', error.message);
    }
  }

  async _loadFromDisk() {
    try {
      const files = await fs.readdir(this.dataDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.dataDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (data.metrics && Array.isArray(data.metrics)) {
          const metrics = data.metrics.map(m => this._deserializeMetric(m));
          await this._cache.batchInsert(metrics);
        }
      }

      const stats = await this._cache.getStats();
      console.log(`[FileStorage] Loaded ${stats.totalMetrics} metrics from disk`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('[FileStorage] Load error:', error.message);
      }
    }
  }

  _serializeMetric(metric) {
    return {
      ...metric,
      timestamp: metric.timestamp?.toISOString(),
      promptVersion: {
        ...metric.promptVersion,
        timestamp: metric.promptVersion?.timestamp?.toISOString()
      },
      feedbackUpdatedAt: metric.feedbackUpdatedAt?.toISOString()
    };
  }

  _deserializeMetric(data) {
    return {
      ...data,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      promptVersion: {
        ...data.promptVersion,
        timestamp: data.promptVersion?.timestamp
          ? new Date(data.promptVersion.timestamp)
          : new Date()
      },
      feedbackUpdatedAt: data.feedbackUpdatedAt
        ? new Date(data.feedbackUpdatedAt)
        : null
    };
  }

  _startAutoFlush() {
    this._flushInterval = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  async _ensureInitialized() {
    if (!this._initialized) {
      await this.initialize();
    }
  }

  async shutdown() {
    if (this._flushInterval) {
      clearInterval(this._flushInterval);
    }
    await this.flush();
  }
}

/**
 * Create storage backend based on configuration
 * @param {Object} config - Storage configuration
 * @returns {StorageBackend}
 */
export function createStorage(config = {}) {
  const type = config.type || process.env.METRICS_STORAGE || 'memory';

  switch (type) {
    case 'file':
      return new FileStorage(config);
    case 'memory':
    default:
      return new InMemoryStorage();
  }
}

export default {
  InMemoryStorage,
  FileStorage,
  createStorage
};
