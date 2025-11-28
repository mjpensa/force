/**
 * Experiments Module - Phase 3 of Auto-Improving Prompts
 *
 * Provides A/B testing infrastructure for prompt optimization.
 *
 * @module experiments
 */

export {
  ExperimentManager,
  ExperimentStatus,
  createExperiment,
  analyzeExperiment,
  getExperimentManager,
  resetExperimentManager
} from './manager.js';

import { getExperimentManager, ExperimentStatus, analyzeExperiment } from './manager.js';
import { getVariantRegistry } from '../variants/index.js';

/**
 * Create and start an experiment between champion and candidate
 *
 * @param {string} contentType - Content type to experiment on
 * @param {Object} options - Experiment options
 * @returns {Object} Created experiment
 */
export function startExperiment(contentType, options = {}) {
  const registry = getVariantRegistry();
  const manager = getExperimentManager();

  // Get champion and candidate variants
  const champion = registry.getChampion(contentType);
  if (!champion) {
    throw new Error(`No champion variant found for ${contentType}`);
  }

  // Find a candidate variant
  const variants = registry.getByContentType(contentType, {
    status: ['candidate', 'active']
  });
  const candidate = variants.find(v => v.id !== champion.id);

  if (!candidate) {
    throw new Error(`No candidate variant found for ${contentType}`);
  }

  // Create experiment
  const experiment = manager.create({
    name: options.name || `${contentType} A/B Test - ${new Date().toISOString().split('T')[0]}`,
    description: options.description || `Testing ${candidate.name} against ${champion.name}`,
    controlVariantId: champion.id,
    treatmentVariantId: candidate.id,
    hypothesis: options.hypothesis || `${candidate.name} will outperform ${champion.name}`,
    successMetric: options.successMetric || 'qualityScore',
    trafficSplit: options.trafficSplit || { control: 0.7, treatment: 0.3 }
  });

  // Start the experiment
  manager.start(experiment.id);

  return experiment;
}

/**
 * Record a metric for variant performance (auto-routes to active experiment)
 *
 * @param {string} variantId - Variant that was used
 * @param {Object} metrics - Performance metrics
 */
export function recordExperimentMetric(variantId, metrics) {
  const manager = getExperimentManager();
  manager.recordMetric(variantId, metrics);
}

/**
 * Get active experiment for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Object|null} Active experiment or null
 */
export function getActiveExperiment(contentType) {
  const manager = getExperimentManager();
  return manager.getActive(contentType);
}

/**
 * Conclude an experiment and optionally promote winner
 *
 * @param {string} experimentId - Experiment ID
 * @param {Object} options - Conclusion options
 * @returns {Object} Conclusion results
 */
export function concludeExperiment(experimentId, options = {}) {
  const manager = getExperimentManager();
  return manager.conclude(experimentId, options.reason || 'manual');
}

/**
 * Get experiment summary with statistics
 *
 * @returns {Object} Experiment summary
 */
export function getExperimentSummary() {
  const manager = getExperimentManager();
  const stats = manager.getStats();

  // Get running experiments with their current analysis
  const activeExperiments = manager.getAll({ status: ExperimentStatus.RUNNING });
  const runningAnalysis = activeExperiments.map(exp => {
    return {
      id: exp.id,
      name: exp.name,
      contentType: exp.contentType,
      controlSamples: exp.controlMetrics.impressions,
      treatmentSamples: exp.treatmentMetrics.impressions,
      startedAt: exp.startedAt,
      analysis: analyzeExperiment(exp)
    };
  });

  // Get recent conclusions
  const concluded = manager.getAll({
    status: [ExperimentStatus.CONCLUDED, ExperimentStatus.PROMOTED]
  }).slice(0, 5);

  return {
    stats,
    running: runningAnalysis,
    recentConclusions: concluded.map(exp => ({
      id: exp.id,
      name: exp.name,
      contentType: exp.contentType,
      status: exp.status,
      winner: exp.conclusion?.winner,
      winnerVariantId: exp.conclusion?.winnerVariantId,
      concludedAt: exp.concludedAt
    }))
  };
}

/**
 * Check all running experiments and auto-conclude if ready
 *
 * @returns {Array} List of concluded experiments
 */
export function checkAndConcludeExperiments() {
  const manager = getExperimentManager();
  const running = manager.getAll({ status: ExperimentStatus.RUNNING });
  const concluded = [];

  for (const exp of running) {
    const daysSinceStart = exp.startedAt
      ? (Date.now() - exp.startedAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;

    // Check if should conclude
    if (daysSinceStart >= 14) {
      const result = manager.conclude(exp.id, 'max_duration');
      concluded.push({ experiment: exp, reason: 'max_duration', result });
    }
  }

  return concluded;
}

export default {
  // Manager
  getExperimentManager,
  ExperimentStatus,

  // Lifecycle
  startExperiment,
  concludeExperiment,
  getActiveExperiment,

  // Metrics
  recordExperimentMetric,

  // Analysis
  getExperimentSummary,
  checkAndConcludeExperiments
};
