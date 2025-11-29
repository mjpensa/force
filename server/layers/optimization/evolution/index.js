/**
 * Evolution Module - Phase 4 of Auto-Improving Prompts
 *
 * Provides automatic prompt optimization through:
 * - Variant generation with mutation strategies
 * - Scheduled optimization cycles
 * - Performance-driven improvements
 *
 * @module evolution
 */

export {
  VariantGenerator,
  MutationStrategy,
  applyMutation,
  suggestImprovements,
  getVariantGenerator,
  resetVariantGenerator
} from './generator.js';

export {
  EvolutionScheduler,
  SchedulerState,
  getEvolutionScheduler,
  resetEvolutionScheduler
} from './scheduler.js';

import { getEvolutionScheduler } from './scheduler.js';
import { getVariantGenerator, MutationStrategy } from './generator.js';
import { getVariantRegistry } from '../variants/index.js';

/**
 * Start the evolution scheduler
 *
 * @param {Object} config - Scheduler configuration
 */
export function startEvolution(config = {}) {
  const scheduler = getEvolutionScheduler(config);
  scheduler.start();
  return scheduler.getStats();
}

/**
 * Stop the evolution scheduler
 */
export function stopEvolution() {
  const scheduler = getEvolutionScheduler();
  scheduler.stop();
}

/**
 * Run a single optimization cycle manually
 *
 * @returns {Promise<Object>} Cycle results
 */
export async function runOptimizationCycle() {
  const scheduler = getEvolutionScheduler();
  return await scheduler.runOnce();
}

/**
 * Generate a new variant manually
 *
 * @param {string} contentType - Content type
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated variant
 */
export async function generateVariant(contentType, options = {}) {
  const registry = getVariantRegistry();
  const generator = getVariantGenerator();

  // Get champion for content type
  const champion = registry.getChampion(contentType);
  if (!champion) {
    throw new Error(`No champion found for ${contentType}`);
  }

  // Generate and register
  return await generator.generateAndRegister(champion.id, options);
}

/**
 * Get available mutation strategies
 *
 * @returns {Object} Mutation strategies
 */
export function getMutationStrategies() {
  return { ...MutationStrategy };
}

/**
 * Get evolution summary
 *
 * @returns {Object} Evolution summary
 */
export function getEvolutionSummary() {
  const scheduler = getEvolutionScheduler();
  return scheduler.getSummary();
}

/**
 * Get evolution scheduler statistics
 *
 * @returns {Object} Scheduler stats
 */
export function getEvolutionStats() {
  const scheduler = getEvolutionScheduler();
  return scheduler.getStats();
}

/**
 * Get evolution history
 *
 * @param {Object} options - Filter options
 * @returns {Array} Run history
 */
export function getEvolutionHistory(options = {}) {
  const scheduler = getEvolutionScheduler();
  return scheduler.getHistory(options);
}

/**
 * Update evolution scheduler configuration
 *
 * @param {Object} config - New configuration
 */
export function updateEvolutionConfig(config) {
  const scheduler = getEvolutionScheduler();
  scheduler.updateConfig(config);
}

export default {
  // Scheduler
  startEvolution,
  stopEvolution,
  runOptimizationCycle,

  // Generation
  generateVariant,
  getMutationStrategies,

  // Stats
  getEvolutionSummary,
  getEvolutionStats,
  getEvolutionHistory,

  // Configuration
  updateEvolutionConfig
};
