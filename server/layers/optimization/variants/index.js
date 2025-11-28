/**
 * Variant Management Module - Phase 2 of Auto-Improving Prompts
 *
 * Provides prompt variant management for A/B testing and optimization.
 *
 * @module variants
 */

export {
  VariantRegistry,
  VariantStatus,
  createVariant,
  getVariantRegistry,
  resetVariantRegistry
} from './registry.js';

export {
  ContentType,
  ALL_VARIANTS,
  ROADMAP_VARIANTS,
  SLIDES_VARIANTS,
  DOCUMENT_VARIANTS,
  RESEARCH_ANALYSIS_VARIANTS,
  getAllVariants,
  getVariantsForType,
  getChampionForType
} from './definitions.js';

import { getVariantRegistry, VariantStatus } from './registry.js';
import { getAllVariants, ContentType } from './definitions.js';

/**
 * Initialize the variant registry with default variants
 *
 * This should be called once at application startup to populate
 * the registry with the initial champion and candidate variants.
 *
 * @param {Object} options - Initialization options
 * @returns {Object} Initialization result
 */
export function initializeVariants(options = {}) {
  const registry = getVariantRegistry(options.registryConfig);

  // Check if already initialized
  const stats = registry.getStats();
  if (stats.totalVariants > 0 && !options.force) {
    return {
      initialized: false,
      reason: 'already_initialized',
      stats
    };
  }

  // Clear if forcing re-initialization
  if (options.force) {
    registry.clear();
  }

  // Register all default variants
  const variants = getAllVariants();
  const registered = [];

  for (const variant of variants) {
    try {
      const result = registry.register(variant);
      registered.push({
        id: result.id,
        contentType: result.contentType,
        status: result.status
      });
    } catch (error) {
      console.warn(`[Variants] Failed to register variant ${variant.id}:`, error.message);
    }
  }

  // Persist to disk
  registry.persist();

  return {
    initialized: true,
    registered: registered.length,
    variants: registered,
    stats: registry.getStats()
  };
}

/**
 * Select a variant for a content type
 *
 * Uses weighted random selection based on variant status and weight.
 *
 * @param {string} contentType - Content type (Roadmap, Slides, Document, ResearchAnalysis)
 * @param {Object} options - Selection options
 * @returns {Object|null} Selected variant with prompt template
 */
export function selectVariant(contentType, options = {}) {
  const registry = getVariantRegistry();

  // Ensure variants are initialized
  const stats = registry.getStats();
  if (stats.totalVariants === 0) {
    initializeVariants();
  }

  // Select variant
  const variant = registry.select(contentType, options);

  if (!variant) {
    return null;
  }

  return {
    id: variant.id,
    name: variant.name,
    status: variant.status,
    promptTemplate: variant.promptTemplate,
    metadata: variant.metadata
  };
}

/**
 * Record variant performance after generation
 *
 * @param {string} variantId - Variant ID
 * @param {Object} metrics - Performance metrics
 */
export function recordVariantPerformance(variantId, metrics) {
  const registry = getVariantRegistry();
  registry.updatePerformance(variantId, metrics);
}

/**
 * Get variant by ID
 *
 * @param {string} variantId - Variant ID
 * @returns {Object|null} Variant or null
 */
export function getVariant(variantId) {
  const registry = getVariantRegistry();
  return registry.get(variantId);
}

/**
 * Get all variants for a content type
 *
 * @param {string} contentType - Content type
 * @param {Object} options - Filter options
 * @returns {Array} Variants
 */
export function getVariants(contentType, options = {}) {
  const registry = getVariantRegistry();
  return registry.getByContentType(contentType, options);
}

/**
 * Get the current champion for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Object|null} Champion variant
 */
export function getChampion(contentType) {
  const registry = getVariantRegistry();
  return registry.getChampion(contentType);
}

/**
 * Promote a variant to champion status
 *
 * @param {string} variantId - Variant to promote
 * @returns {boolean} Success
 */
export function promoteVariant(variantId) {
  const registry = getVariantRegistry();
  return registry.promoteToChampion(variantId);
}

/**
 * Register a new variant
 *
 * @param {Object} config - Variant configuration
 * @returns {Object} Registered variant
 */
export function registerVariant(config) {
  const registry = getVariantRegistry();
  return registry.register(config);
}

/**
 * Get variant registry statistics
 *
 * @returns {Object} Registry stats
 */
export function getVariantStats() {
  const registry = getVariantRegistry();
  return registry.getStats();
}

/**
 * Get selection history for debugging
 *
 * @param {Object} options - Filter options
 * @returns {Array} Selection history
 */
export function getSelectionHistory(options = {}) {
  const registry = getVariantRegistry();
  return registry.getSelectionHistory(options);
}

export default {
  // Registry
  getVariantRegistry,
  VariantStatus,

  // Content Types
  ContentType,

  // Initialization
  initializeVariants,

  // Selection
  selectVariant,
  getVariant,
  getVariants,
  getChampion,

  // Performance
  recordVariantPerformance,

  // Management
  promoteVariant,
  registerVariant,

  // Stats
  getVariantStats,
  getSelectionHistory
};
