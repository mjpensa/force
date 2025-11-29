/**
 * Variant Registry - Phase 2 of Auto-Improving Prompts
 *
 * Manages prompt variants for A/B testing and automatic optimization.
 * Provides weighted random selection, performance tracking, and variant lifecycle.
 *
 * @module variants/registry
 */

import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Variant status enum
 */
export const VariantStatus = {
  ACTIVE: 'active',           // Currently in rotation
  CANDIDATE: 'candidate',     // Being tested
  CHAMPION: 'champion',       // Current best performer
  RETIRED: 'retired',         // No longer in use
  PAUSED: 'paused'            // Temporarily disabled
};

/**
 * Default variant weights
 */
const DEFAULT_WEIGHTS = {
  [VariantStatus.CHAMPION]: 0.7,    // Champion gets 70% of traffic
  [VariantStatus.CANDIDATE]: 0.2,   // Candidate gets 20% of traffic
  [VariantStatus.ACTIVE]: 0.1       // Other active variants share 10%
};

/**
 * Variant definition structure
 *
 * @typedef {Object} Variant
 * @property {string} id - Unique variant ID
 * @property {string} name - Human-readable name
 * @property {string} contentType - Content type (Roadmap, Slides, Document, ResearchAnalysis)
 * @property {string} status - Variant status (active, candidate, champion, retired, paused)
 * @property {number} weight - Selection weight (0-1)
 * @property {string} promptTemplate - The prompt template
 * @property {Object} metadata - Additional metadata
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Object} performance - Performance metrics
 */

/**
 * Create a new variant object
 *
 * @param {Object} config - Variant configuration
 * @returns {Variant} New variant object
 */
export function createVariant(config) {
  const now = new Date();
  return {
    id: config.id || randomUUID(),
    name: config.name || 'Unnamed Variant',
    contentType: config.contentType,
    status: config.status || VariantStatus.ACTIVE,
    weight: config.weight ?? 0.5,
    promptTemplate: config.promptTemplate || '',
    metadata: {
      description: config.description || '',
      author: config.author || 'system',
      version: config.version || '1.0.0',
      tags: config.tags || [],
      parentVariantId: config.parentVariantId || null,
      ...config.metadata
    },
    createdAt: config.createdAt || now,
    updatedAt: config.updatedAt || now,
    performance: {
      impressions: 0,
      conversions: 0,        // Successful completions
      avgLatencyMs: 0,
      avgQualityScore: 0,
      feedbackSum: 0,
      feedbackCount: 0,
      errorCount: 0,
      ...config.performance
    }
  };
}

/**
 * Variant Registry class
 *
 * Manages the lifecycle and selection of prompt variants.
 */
export class VariantRegistry {
  /**
   * Create a new VariantRegistry
   *
   * @param {Object} config - Registry configuration
   */
  constructor(config = {}) {
    this._variants = new Map();          // variantId -> Variant
    this._byContentType = new Map();     // contentType -> Set<variantId>
    this._champions = new Map();         // contentType -> variantId
    this._weights = { ...DEFAULT_WEIGHTS, ...config.weights };
    this._persistPath = config.persistPath || join(__dirname, 'data', 'variants.json');
    this._autoPersist = config.autoPersist ?? false;
    this._selectionHistory = [];         // Track recent selections for debugging
    this._maxHistorySize = config.maxHistorySize || 1000;

    // Load persisted variants if available
    if (config.loadOnInit !== false) {
      this._loadFromDisk();
    }
  }

  /**
   * Register a new variant
   *
   * @param {Object} config - Variant configuration
   * @returns {Variant} Registered variant
   */
  register(config) {
    const variant = createVariant(config);

    // Store variant
    this._variants.set(variant.id, variant);

    // Index by content type
    if (!this._byContentType.has(variant.contentType)) {
      this._byContentType.set(variant.contentType, new Set());
    }
    this._byContentType.get(variant.contentType).add(variant.id);

    // Track champion
    if (variant.status === VariantStatus.CHAMPION) {
      this._champions.set(variant.contentType, variant.id);
    }

    // Auto-persist if enabled
    if (this._autoPersist) {
      this._saveToDisk();
    }

    return variant;
  }

  /**
   * Get a variant by ID
   *
   * @param {string} variantId - Variant ID
   * @returns {Variant|null} Variant or null
   */
  get(variantId) {
    return this._variants.get(variantId) || null;
  }

  /**
   * Get all variants for a content type
   *
   * @param {string} contentType - Content type
   * @param {Object} options - Filter options
   * @returns {Array<Variant>} Matching variants
   */
  getByContentType(contentType, options = {}) {
    const variantIds = this._byContentType.get(contentType) || new Set();
    let variants = Array.from(variantIds)
      .map(id => this._variants.get(id))
      .filter(Boolean);

    // Filter by status
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      variants = variants.filter(v => statuses.includes(v.status));
    }

    // Filter active only
    if (options.activeOnly) {
      variants = variants.filter(v =>
        v.status === VariantStatus.ACTIVE ||
        v.status === VariantStatus.CHAMPION ||
        v.status === VariantStatus.CANDIDATE
      );
    }

    // Sort by weight descending
    if (options.sortByWeight) {
      variants.sort((a, b) => b.weight - a.weight);
    }

    return variants;
  }

  /**
   * Get the champion variant for a content type
   *
   * @param {string} contentType - Content type
   * @returns {Variant|null} Champion variant or null
   */
  getChampion(contentType) {
    const championId = this._champions.get(contentType);
    return championId ? this._variants.get(championId) : null;
  }

  /**
   * Select a variant using weighted random selection
   *
   * Implements Thompson Sampling-inspired selection:
   * - Champion gets majority of traffic (default 70%)
   * - Candidate(s) get exploration traffic (default 20%)
   * - Other active variants share remaining (default 10%)
   *
   * @param {string} contentType - Content type
   * @param {Object} options - Selection options
   * @returns {Variant|null} Selected variant
   */
  select(contentType, options = {}) {
    const variants = this.getByContentType(contentType, { activeOnly: true });

    if (variants.length === 0) {
      return null;
    }

    // Force specific variant if requested (for testing)
    if (options.forceVariantId) {
      const forced = variants.find(v => v.id === options.forceVariantId);
      if (forced) {
        this._recordSelection(forced, 'forced');
        return forced;
      }
    }

    // Calculate selection weights
    const weighted = this._calculateWeights(variants);

    // Weighted random selection
    const random = Math.random();
    let cumulative = 0;

    for (const { variant, normalizedWeight } of weighted) {
      cumulative += normalizedWeight;
      if (random <= cumulative) {
        this._recordSelection(variant, 'weighted');
        return variant;
      }
    }

    // Fallback to last variant (shouldn't happen)
    const fallback = weighted[weighted.length - 1]?.variant || variants[0];
    this._recordSelection(fallback, 'fallback');
    return fallback;
  }

  /**
   * Calculate normalized weights for selection
   *
   * @private
   * @param {Array<Variant>} variants - Variants to weight
   * @returns {Array<{variant: Variant, normalizedWeight: number}>}
   */
  _calculateWeights(variants) {
    // Group by status
    const champions = variants.filter(v => v.status === VariantStatus.CHAMPION);
    const candidates = variants.filter(v => v.status === VariantStatus.CANDIDATE);
    const actives = variants.filter(v => v.status === VariantStatus.ACTIVE);

    const result = [];

    // Champion weight allocation - use v.weight to distribute among multiple champions
    const championWeight = this._weights[VariantStatus.CHAMPION];
    if (champions.length > 0) {
      const totalChampionWeight = champions.reduce((sum, v) => sum + v.weight, 0);
      for (const v of champions) {
        const share = totalChampionWeight > 0
          ? (v.weight / totalChampionWeight) * championWeight
          : championWeight / champions.length;
        result.push({ variant: v, normalizedWeight: share });
      }
    }

    // Candidate weight allocation - use v.weight to distribute among multiple candidates
    const candidateWeight = this._weights[VariantStatus.CANDIDATE];
    if (candidates.length > 0) {
      const totalCandidateWeight = candidates.reduce((sum, v) => sum + v.weight, 0);
      for (const v of candidates) {
        const share = totalCandidateWeight > 0
          ? (v.weight / totalCandidateWeight) * candidateWeight
          : candidateWeight / candidates.length;
        result.push({ variant: v, normalizedWeight: share });
      }
    }

    // Active weight allocation (shared pool)
    const activeWeight = this._weights[VariantStatus.ACTIVE];
    if (actives.length > 0) {
      const totalActiveWeight = actives.reduce((sum, v) => sum + v.weight, 0);
      for (const v of actives) {
        const share = totalActiveWeight > 0 ? (v.weight / totalActiveWeight) * activeWeight : activeWeight / actives.length;
        result.push({ variant: v, normalizedWeight: share });
      }
    }

    // If no variants in standard categories, use all with equal weight
    if (result.length === 0) {
      const perVariant = 1 / variants.length;
      for (const v of variants) {
        result.push({ variant: v, normalizedWeight: perVariant });
      }
    }

    // Normalize to sum = 1
    const total = result.reduce((sum, r) => sum + r.normalizedWeight, 0);
    if (total > 0 && total !== 1) {
      for (const r of result) {
        r.normalizedWeight /= total;
      }
    }

    return result;
  }

  /**
   * Record a selection for history/debugging
   *
   * @private
   */
  _recordSelection(variant, reason) {
    this._selectionHistory.push({
      timestamp: new Date(),
      variantId: variant.id,
      contentType: variant.contentType,
      status: variant.status,
      reason
    });

    // Trim history
    while (this._selectionHistory.length > this._maxHistorySize) {
      this._selectionHistory.shift();
    }

    // Update impression count
    variant.performance.impressions++;
    variant.updatedAt = new Date();
  }

  /**
   * Update variant performance metrics
   *
   * @param {string} variantId - Variant ID
   * @param {Object} metrics - Metrics to update
   */
  updatePerformance(variantId, metrics) {
    const variant = this._variants.get(variantId);
    if (!variant) return;

    const perf = variant.performance;

    // Update latency (moving average)
    if (metrics.latencyMs !== undefined) {
      const n = perf.impressions || 1;
      perf.avgLatencyMs = ((perf.avgLatencyMs * (n - 1)) + metrics.latencyMs) / n;
    }

    // Update quality score (moving average)
    if (metrics.qualityScore !== undefined) {
      const n = perf.impressions || 1;
      perf.avgQualityScore = ((perf.avgQualityScore * (n - 1)) + metrics.qualityScore) / n;
    }

    // Track feedback
    if (metrics.feedback !== undefined) {
      perf.feedbackSum += metrics.feedback;
      perf.feedbackCount++;
    }

    // Track conversions
    if (metrics.success) {
      perf.conversions++;
    }

    // Track errors
    if (metrics.error) {
      perf.errorCount++;
    }

    variant.updatedAt = new Date();

    // Auto-persist if enabled
    if (this._autoPersist) {
      this._saveToDisk();
    }
  }

  /**
   * Promote a variant to champion status
   *
   * @param {string} variantId - Variant to promote
   * @returns {boolean} Success
   */
  promoteToChampion(variantId) {
    const variant = this._variants.get(variantId);
    if (!variant) return false;

    // Demote current champion
    const currentChampionId = this._champions.get(variant.contentType);
    if (currentChampionId && currentChampionId !== variantId) {
      const currentChampion = this._variants.get(currentChampionId);
      if (currentChampion) {
        currentChampion.status = VariantStatus.RETIRED;
        currentChampion.updatedAt = new Date();
      }
    }

    // Promote new champion
    variant.status = VariantStatus.CHAMPION;
    variant.updatedAt = new Date();
    this._champions.set(variant.contentType, variantId);

    // Auto-persist if enabled
    if (this._autoPersist) {
      this._saveToDisk();
    }

    return true;
  }

  /**
   * Set a variant as candidate for testing
   *
   * @param {string} variantId - Variant to set as candidate
   * @returns {boolean} Success
   */
  setAsCandidate(variantId) {
    const variant = this._variants.get(variantId);
    if (!variant) return false;

    variant.status = VariantStatus.CANDIDATE;
    variant.updatedAt = new Date();

    if (this._autoPersist) {
      this._saveToDisk();
    }

    return true;
  }

  /**
   * Pause a variant (temporarily disable)
   *
   * @param {string} variantId - Variant to pause
   * @returns {boolean} Success
   */
  pause(variantId) {
    const variant = this._variants.get(variantId);
    if (!variant) return false;

    variant.status = VariantStatus.PAUSED;
    variant.updatedAt = new Date();

    if (this._autoPersist) {
      this._saveToDisk();
    }

    return true;
  }

  /**
   * Resume a paused variant
   *
   * @param {string} variantId - Variant to resume
   * @returns {boolean} Success
   */
  resume(variantId) {
    const variant = this._variants.get(variantId);
    if (!variant || variant.status !== VariantStatus.PAUSED) return false;

    variant.status = VariantStatus.ACTIVE;
    variant.updatedAt = new Date();

    if (this._autoPersist) {
      this._saveToDisk();
    }

    return true;
  }

  /**
   * Retire a variant (permanent removal from rotation)
   *
   * @param {string} variantId - Variant to retire
   * @returns {boolean} Success
   */
  retire(variantId) {
    const variant = this._variants.get(variantId);
    if (!variant) return false;

    variant.status = VariantStatus.RETIRED;
    variant.updatedAt = new Date();

    // Remove from champion if applicable
    if (this._champions.get(variant.contentType) === variantId) {
      this._champions.delete(variant.contentType);
    }

    if (this._autoPersist) {
      this._saveToDisk();
    }

    return true;
  }

  /**
   * Update variant weight
   *
   * @param {string} variantId - Variant ID
   * @param {number} weight - New weight (0-1)
   * @returns {boolean} Success
   */
  updateWeight(variantId, weight) {
    const variant = this._variants.get(variantId);
    if (!variant) return false;

    variant.weight = Math.max(0, Math.min(1, weight));
    variant.updatedAt = new Date();

    if (this._autoPersist) {
      this._saveToDisk();
    }

    return true;
  }

  /**
   * Get selection history
   *
   * @param {Object} options - Filter options
   * @returns {Array} Selection history
   */
  getSelectionHistory(options = {}) {
    let history = [...this._selectionHistory];

    if (options.contentType) {
      history = history.filter(h => h.contentType === options.contentType);
    }

    if (options.variantId) {
      history = history.filter(h => h.variantId === options.variantId);
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Get registry statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    const stats = {
      totalVariants: this._variants.size,
      byStatus: {},
      byContentType: {},
      champions: {},
      selectionHistorySize: this._selectionHistory.length
    };

    // Count by status
    for (const variant of this._variants.values()) {
      stats.byStatus[variant.status] = (stats.byStatus[variant.status] || 0) + 1;

      // Count by content type
      if (!stats.byContentType[variant.contentType]) {
        stats.byContentType[variant.contentType] = {
          total: 0,
          active: 0,
          champion: null
        };
      }
      stats.byContentType[variant.contentType].total++;
      if ([VariantStatus.ACTIVE, VariantStatus.CHAMPION, VariantStatus.CANDIDATE].includes(variant.status)) {
        stats.byContentType[variant.contentType].active++;
      }
    }

    // Champions
    for (const [contentType, variantId] of this._champions.entries()) {
      stats.champions[contentType] = variantId;
      if (stats.byContentType[contentType]) {
        stats.byContentType[contentType].champion = variantId;
      }
    }

    return stats;
  }

  /**
   * Load variants from disk
   *
   * @private
   */
  _loadFromDisk() {
    try {
      if (existsSync(this._persistPath)) {
        const data = JSON.parse(readFileSync(this._persistPath, 'utf8'));

        // Restore variants
        if (data.variants && Array.isArray(data.variants)) {
          for (const variantData of data.variants) {
            // Convert date strings back to Date objects
            variantData.createdAt = new Date(variantData.createdAt);
            variantData.updatedAt = new Date(variantData.updatedAt);

            // Use register to properly index
            this._variants.set(variantData.id, variantData);

            if (!this._byContentType.has(variantData.contentType)) {
              this._byContentType.set(variantData.contentType, new Set());
            }
            this._byContentType.get(variantData.contentType).add(variantData.id);

            if (variantData.status === VariantStatus.CHAMPION) {
              this._champions.set(variantData.contentType, variantData.id);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[VariantRegistry] Failed to load from disk:', error.message);
    }
  }

  /**
   * Save variants to disk
   *
   * @private
   */
  _saveToDisk() {
    try {
      const dir = dirname(this._persistPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data = {
        version: '1.0.0',
        savedAt: new Date().toISOString(),
        variants: Array.from(this._variants.values())
      };

      writeFileSync(this._persistPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.warn('[VariantRegistry] Failed to save to disk:', error.message);
    }
  }

  /**
   * Force save to disk
   */
  persist() {
    this._saveToDisk();
  }

  /**
   * Clear all variants (for testing)
   */
  clear() {
    this._variants.clear();
    this._byContentType.clear();
    this._champions.clear();
    this._selectionHistory = [];
  }
}

// Singleton instance
let _registryInstance = null;

/**
 * Get the singleton VariantRegistry instance
 *
 * @param {Object} config - Configuration (only used on first call)
 * @returns {VariantRegistry}
 */
export function getVariantRegistry(config = {}) {
  if (!_registryInstance) {
    _registryInstance = new VariantRegistry(config);
  }
  return _registryInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetVariantRegistry() {
  if (_registryInstance) {
    _registryInstance.clear();
  }
  _registryInstance = null;
}

export default {
  VariantRegistry,
  VariantStatus,
  createVariant,
  getVariantRegistry,
  resetVariantRegistry
};
