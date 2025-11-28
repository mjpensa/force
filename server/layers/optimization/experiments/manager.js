/**
 * Experiment Manager - Phase 3 of Auto-Improving Prompts
 *
 * Manages A/B testing experiments for prompt variants.
 * Provides experiment lifecycle, statistical analysis, and auto-conclusion.
 *
 * @module experiments/manager
 */

import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getVariantRegistry, VariantStatus } from '../variants/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Experiment status enum
 */
export const ExperimentStatus = {
  DRAFT: 'draft',           // Not yet started
  RUNNING: 'running',       // Currently collecting data
  PAUSED: 'paused',         // Temporarily stopped
  CONCLUDED: 'concluded',   // Analysis complete
  PROMOTED: 'promoted'      // Winner has been promoted
};

/**
 * Statistical significance thresholds
 */
const SIGNIFICANCE_THRESHOLDS = {
  CONFIDENCE_LEVEL: 0.95,           // 95% confidence
  MIN_SAMPLE_SIZE: 30,              // Minimum samples per variant
  EFFECT_SIZE_THRESHOLD: 0.05,      // 5% minimum improvement
  MAX_DURATION_DAYS: 14             // Auto-conclude after 14 days
};

/**
 * Experiment metrics structure
 *
 * @typedef {Object} ExperimentMetrics
 * @property {number} impressions - Total variant selections
 * @property {number} successes - Successful generations
 * @property {number} failures - Failed generations
 * @property {number} totalLatency - Sum of latencies
 * @property {number} totalQuality - Sum of quality scores
 * @property {number} totalFeedback - Sum of feedback ratings
 * @property {number} feedbackCount - Number of feedback entries
 */

/**
 * Create default experiment metrics
 */
function createDefaultMetrics() {
  return {
    impressions: 0,
    successes: 0,
    failures: 0,
    totalLatency: 0,
    totalQuality: 0,
    totalFeedback: 0,
    feedbackCount: 0
  };
}

/**
 * Experiment definition
 *
 * @typedef {Object} Experiment
 * @property {string} id - Unique experiment ID
 * @property {string} name - Human-readable name
 * @property {string} contentType - Content type being tested
 * @property {string} status - Experiment status
 * @property {string} controlVariantId - Control (champion) variant ID
 * @property {string} treatmentVariantId - Treatment (candidate) variant ID
 * @property {Object} controlMetrics - Control variant metrics
 * @property {Object} treatmentMetrics - Treatment variant metrics
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} startedAt - Start timestamp
 * @property {Date} concludedAt - Conclusion timestamp
 * @property {Object} conclusion - Experiment conclusion data
 */

/**
 * Create a new experiment
 *
 * @param {Object} config - Experiment configuration
 * @returns {Experiment} New experiment object
 */
export function createExperiment(config) {
  const now = new Date();
  return {
    id: config.id || randomUUID(),
    name: config.name || 'Unnamed Experiment',
    description: config.description || '',
    contentType: config.contentType,
    status: ExperimentStatus.DRAFT,
    controlVariantId: config.controlVariantId,
    treatmentVariantId: config.treatmentVariantId,
    trafficSplit: config.trafficSplit || { control: 0.5, treatment: 0.5 },
    controlMetrics: createDefaultMetrics(),
    treatmentMetrics: createDefaultMetrics(),
    createdAt: now,
    startedAt: null,
    concludedAt: null,
    conclusion: null,
    metadata: {
      author: config.author || 'system',
      hypothesis: config.hypothesis || '',
      successMetric: config.successMetric || 'qualityScore',
      ...config.metadata
    }
  };
}

/**
 * Calculate conversion rate
 */
function calculateConversionRate(metrics) {
  if (metrics.impressions === 0) return 0;
  return metrics.successes / metrics.impressions;
}

/**
 * Calculate average latency
 */
function calculateAvgLatency(metrics) {
  if (metrics.successes === 0) return 0;
  return metrics.totalLatency / metrics.successes;
}

/**
 * Calculate average quality score
 */
function calculateAvgQuality(metrics) {
  if (metrics.successes === 0) return 0;
  return metrics.totalQuality / metrics.successes;
}

/**
 * Calculate average feedback
 */
function calculateAvgFeedback(metrics) {
  if (metrics.feedbackCount === 0) return 0;
  return metrics.totalFeedback / metrics.feedbackCount;
}

/**
 * Calculate Z-score for proportion comparison
 * Uses pooled proportion for two-sample z-test
 */
function calculateZScore(p1, n1, p2, n2) {
  if (n1 === 0 || n2 === 0) return 0;

  const pooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  if (pooled === 0 || pooled === 1) return 0;

  const se = Math.sqrt(pooled * (1 - pooled) * (1/n1 + 1/n2));
  if (se === 0) return 0;

  return (p1 - p2) / se;
}

/**
 * Calculate p-value from z-score (two-tailed)
 */
function calculatePValue(zScore) {
  // Standard normal CDF approximation
  const absZ = Math.abs(zScore);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989423 * Math.exp(-absZ * absZ / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 2 * p; // Two-tailed
}

/**
 * Calculate confidence interval for proportion
 */
function calculateConfidenceInterval(p, n, confidence = 0.95) {
  if (n === 0) return { lower: 0, upper: 0 };

  // Z-score for confidence level
  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  const se = Math.sqrt((p * (1 - p)) / n);

  return {
    lower: Math.max(0, p - z * se),
    upper: Math.min(1, p + z * se)
  };
}

/**
 * Analyze experiment results and determine winner
 *
 * @param {Experiment} experiment - Experiment to analyze
 * @returns {Object} Analysis results
 */
export function analyzeExperiment(experiment) {
  const control = experiment.controlMetrics;
  const treatment = experiment.treatmentMetrics;

  // Calculate success rates
  const controlRate = calculateConversionRate(control);
  const treatmentRate = calculateConversionRate(treatment);

  // Calculate z-score and p-value
  const zScore = calculateZScore(
    treatmentRate, treatment.impressions,
    controlRate, control.impressions
  );
  const pValue = calculatePValue(zScore);

  // Calculate confidence intervals
  const controlCI = calculateConfidenceInterval(controlRate, control.impressions);
  const treatmentCI = calculateConfidenceInterval(treatmentRate, treatment.impressions);

  // Calculate relative improvement
  const relativeImprovement = controlRate > 0
    ? (treatmentRate - controlRate) / controlRate
    : treatmentRate > 0 ? 1 : 0;

  // Calculate quality metrics
  const controlAvgQuality = calculateAvgQuality(control);
  const treatmentAvgQuality = calculateAvgQuality(treatment);
  const qualityImprovement = controlAvgQuality > 0
    ? (treatmentAvgQuality - controlAvgQuality) / controlAvgQuality
    : 0;

  // Calculate latency metrics
  const controlAvgLatency = calculateAvgLatency(control);
  const treatmentAvgLatency = calculateAvgLatency(treatment);
  const latencyChange = controlAvgLatency > 0
    ? (treatmentAvgLatency - controlAvgLatency) / controlAvgLatency
    : 0;

  // Determine statistical significance
  const isSignificant = pValue < (1 - SIGNIFICANCE_THRESHOLDS.CONFIDENCE_LEVEL);
  const hasSufficientSamples =
    control.impressions >= SIGNIFICANCE_THRESHOLDS.MIN_SAMPLE_SIZE &&
    treatment.impressions >= SIGNIFICANCE_THRESHOLDS.MIN_SAMPLE_SIZE;
  const hasMinimumEffect =
    Math.abs(relativeImprovement) >= SIGNIFICANCE_THRESHOLDS.EFFECT_SIZE_THRESHOLD;

  // Determine winner
  let winner = null;
  let winnerReason = '';

  if (hasSufficientSamples && isSignificant && hasMinimumEffect) {
    if (treatmentRate > controlRate) {
      winner = 'treatment';
      winnerReason = `Treatment outperforms control by ${(relativeImprovement * 100).toFixed(1)}% (p=${pValue.toFixed(4)})`;
    } else if (controlRate > treatmentRate) {
      winner = 'control';
      winnerReason = `Control outperforms treatment by ${(Math.abs(relativeImprovement) * 100).toFixed(1)}% (p=${pValue.toFixed(4)})`;
    }
  } else if (!hasSufficientSamples) {
    winnerReason = `Insufficient samples (control: ${control.impressions}, treatment: ${treatment.impressions}, required: ${SIGNIFICANCE_THRESHOLDS.MIN_SAMPLE_SIZE})`;
  } else if (!isSignificant) {
    winnerReason = `Not statistically significant (p=${pValue.toFixed(4)}, required: <${(1 - SIGNIFICANCE_THRESHOLDS.CONFIDENCE_LEVEL).toFixed(2)})`;
  } else if (!hasMinimumEffect) {
    winnerReason = `Effect size too small (${(Math.abs(relativeImprovement) * 100).toFixed(1)}%, required: ${SIGNIFICANCE_THRESHOLDS.EFFECT_SIZE_THRESHOLD * 100}%)`;
  }

  return {
    // Sample sizes
    controlSamples: control.impressions,
    treatmentSamples: treatment.impressions,
    totalSamples: control.impressions + treatment.impressions,

    // Success rates
    controlSuccessRate: controlRate,
    treatmentSuccessRate: treatmentRate,
    relativeImprovement,

    // Quality metrics
    controlAvgQuality,
    treatmentAvgQuality,
    qualityImprovement,

    // Latency metrics
    controlAvgLatency,
    treatmentAvgLatency,
    latencyChange,

    // Statistical analysis
    zScore,
    pValue,
    controlCI,
    treatmentCI,

    // Significance
    isSignificant,
    hasSufficientSamples,
    hasMinimumEffect,
    confidence: 1 - pValue,

    // Winner determination
    winner,
    winnerVariantId: winner === 'treatment'
      ? experiment.treatmentVariantId
      : winner === 'control'
        ? experiment.controlVariantId
        : null,
    winnerReason
  };
}

/**
 * Experiment Manager class
 *
 * Manages A/B testing experiments for prompt optimization.
 */
export class ExperimentManager {
  /**
   * Create a new ExperimentManager
   *
   * @param {Object} config - Manager configuration
   */
  constructor(config = {}) {
    this._experiments = new Map();           // experimentId -> Experiment
    this._byContentType = new Map();         // contentType -> Set<experimentId>
    this._activeByContentType = new Map();   // contentType -> experimentId (only one active per type)
    this._persistPath = config.persistPath || join(__dirname, 'data', 'experiments.json');
    this._autoPersist = config.autoPersist ?? false;
    this._autoPromote = config.autoPromote ?? true;

    // Load persisted experiments if available
    if (config.loadOnInit !== false) {
      this._loadFromDisk();
    }
  }

  /**
   * Create a new experiment
   *
   * @param {Object} config - Experiment configuration
   * @returns {Experiment} Created experiment
   */
  create(config) {
    // Validate variants exist
    const registry = getVariantRegistry();
    const control = registry.get(config.controlVariantId);
    const treatment = registry.get(config.treatmentVariantId);

    if (!control) {
      throw new Error(`Control variant not found: ${config.controlVariantId}`);
    }
    if (!treatment) {
      throw new Error(`Treatment variant not found: ${config.treatmentVariantId}`);
    }
    if (control.contentType !== treatment.contentType) {
      throw new Error('Control and treatment must be for the same content type');
    }

    const experiment = createExperiment({
      ...config,
      contentType: control.contentType
    });

    // Store experiment
    this._experiments.set(experiment.id, experiment);

    // Index by content type
    if (!this._byContentType.has(experiment.contentType)) {
      this._byContentType.set(experiment.contentType, new Set());
    }
    this._byContentType.get(experiment.contentType).add(experiment.id);

    if (this._autoPersist) {
      this._saveToDisk();
    }

    return experiment;
  }

  /**
   * Start an experiment
   *
   * @param {string} experimentId - Experiment ID
   * @returns {Experiment} Started experiment
   */
  start(experimentId) {
    const experiment = this._experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status !== ExperimentStatus.DRAFT && experiment.status !== ExperimentStatus.PAUSED) {
      throw new Error(`Cannot start experiment in status: ${experiment.status}`);
    }

    // Check for existing active experiment
    const activeId = this._activeByContentType.get(experiment.contentType);
    if (activeId && activeId !== experimentId) {
      throw new Error(`Another experiment is already active for ${experiment.contentType}: ${activeId}`);
    }

    // Set treatment variant as candidate
    const registry = getVariantRegistry();
    registry.setAsCandidate(experiment.treatmentVariantId);

    // Update experiment
    experiment.status = ExperimentStatus.RUNNING;
    experiment.startedAt = new Date();
    this._activeByContentType.set(experiment.contentType, experimentId);

    if (this._autoPersist) {
      this._saveToDisk();
    }

    return experiment;
  }

  /**
   * Pause an experiment
   *
   * @param {string} experimentId - Experiment ID
   * @returns {Experiment} Paused experiment
   */
  pause(experimentId) {
    const experiment = this._experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status !== ExperimentStatus.RUNNING) {
      throw new Error(`Cannot pause experiment in status: ${experiment.status}`);
    }

    experiment.status = ExperimentStatus.PAUSED;

    if (this._autoPersist) {
      this._saveToDisk();
    }

    return experiment;
  }

  /**
   * Record a metric for an experiment
   *
   * @param {string} variantId - Variant ID that was used
   * @param {Object} metrics - Metrics to record
   */
  recordMetric(variantId, metrics) {
    // Find active experiment containing this variant
    for (const experiment of this._experiments.values()) {
      if (experiment.status !== ExperimentStatus.RUNNING) continue;

      let targetMetrics = null;
      if (experiment.controlVariantId === variantId) {
        targetMetrics = experiment.controlMetrics;
      } else if (experiment.treatmentVariantId === variantId) {
        targetMetrics = experiment.treatmentMetrics;
      }

      if (targetMetrics) {
        targetMetrics.impressions++;

        if (metrics.success) {
          targetMetrics.successes++;
          if (metrics.latencyMs) {
            targetMetrics.totalLatency += metrics.latencyMs;
          }
          if (metrics.qualityScore) {
            targetMetrics.totalQuality += metrics.qualityScore;
          }
        } else {
          targetMetrics.failures++;
        }

        if (metrics.feedback !== undefined) {
          targetMetrics.totalFeedback += metrics.feedback;
          targetMetrics.feedbackCount++;
        }

        // Check if we should auto-conclude
        this._checkAutoConclusion(experiment);

        if (this._autoPersist) {
          this._saveToDisk();
        }

        break;
      }
    }
  }

  /**
   * Check if experiment should auto-conclude
   *
   * @private
   */
  _checkAutoConclusion(experiment) {
    // Check duration
    if (experiment.startedAt) {
      const daysSinceStart = (Date.now() - experiment.startedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceStart >= SIGNIFICANCE_THRESHOLDS.MAX_DURATION_DAYS) {
        this.conclude(experiment.id, 'max_duration');
        return;
      }
    }

    // Check for early conclusion with high confidence
    const analysis = analyzeExperiment(experiment);
    if (analysis.hasSufficientSamples && analysis.isSignificant && analysis.hasMinimumEffect) {
      // Require higher confidence for early conclusion
      if (analysis.confidence >= 0.99) {
        this.conclude(experiment.id, 'early_significance');
      }
    }
  }

  /**
   * Conclude an experiment
   *
   * @param {string} experimentId - Experiment ID
   * @param {string} reason - Conclusion reason
   * @returns {Object} Conclusion results
   */
  conclude(experimentId, reason = 'manual') {
    const experiment = this._experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status === ExperimentStatus.CONCLUDED || experiment.status === ExperimentStatus.PROMOTED) {
      return experiment.conclusion;
    }

    // Analyze results
    const analysis = analyzeExperiment(experiment);

    // Update experiment
    experiment.status = ExperimentStatus.CONCLUDED;
    experiment.concludedAt = new Date();
    experiment.conclusion = {
      reason,
      analysis,
      winner: analysis.winner,
      winnerVariantId: analysis.winnerVariantId,
      recommendedAction: analysis.winner
        ? `Promote ${analysis.winner} variant (${analysis.winnerVariantId})`
        : 'No clear winner - continue testing or modify variants'
    };

    // Remove from active
    if (this._activeByContentType.get(experiment.contentType) === experimentId) {
      this._activeByContentType.delete(experiment.contentType);
    }

    // Auto-promote winner if enabled
    if (this._autoPromote && analysis.winner === 'treatment') {
      this.promoteWinner(experimentId);
    }

    if (this._autoPersist) {
      this._saveToDisk();
    }

    return experiment.conclusion;
  }

  /**
   * Promote the winner of an experiment to champion
   *
   * @param {string} experimentId - Experiment ID
   * @returns {boolean} Success
   */
  promoteWinner(experimentId) {
    const experiment = this._experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (!experiment.conclusion || !experiment.conclusion.winnerVariantId) {
      throw new Error('Experiment has no winner to promote');
    }

    // Only promote if treatment won (champion is already champion)
    if (experiment.conclusion.winner !== 'treatment') {
      return false;
    }

    // Promote to champion
    const registry = getVariantRegistry();
    const success = registry.promoteToChampion(experiment.conclusion.winnerVariantId);

    if (success) {
      experiment.status = ExperimentStatus.PROMOTED;
      experiment.conclusion.promotedAt = new Date();

      if (this._autoPersist) {
        this._saveToDisk();
      }
    }

    return success;
  }

  /**
   * Get an experiment by ID
   *
   * @param {string} experimentId - Experiment ID
   * @returns {Experiment|null}
   */
  get(experimentId) {
    return this._experiments.get(experimentId) || null;
  }

  /**
   * Get active experiment for a content type
   *
   * @param {string} contentType - Content type
   * @returns {Experiment|null}
   */
  getActive(contentType) {
    const activeId = this._activeByContentType.get(contentType);
    return activeId ? this._experiments.get(activeId) : null;
  }

  /**
   * Get all experiments for a content type
   *
   * @param {string} contentType - Content type
   * @param {Object} options - Filter options
   * @returns {Array<Experiment>}
   */
  getByContentType(contentType, options = {}) {
    const ids = this._byContentType.get(contentType) || new Set();
    let experiments = Array.from(ids)
      .map(id => this._experiments.get(id))
      .filter(Boolean);

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      experiments = experiments.filter(e => statuses.includes(e.status));
    }

    return experiments.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get all experiments
   *
   * @param {Object} options - Filter options
   * @returns {Array<Experiment>}
   */
  getAll(options = {}) {
    let experiments = Array.from(this._experiments.values());

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      experiments = experiments.filter(e => statuses.includes(e.status));
    }

    return experiments.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get manager statistics
   *
   * @returns {Object}
   */
  getStats() {
    const experiments = Array.from(this._experiments.values());

    const stats = {
      total: experiments.length,
      byStatus: {},
      byContentType: {},
      activeExperiments: Array.from(this._activeByContentType.entries()).map(([type, id]) => ({
        contentType: type,
        experimentId: id
      }))
    };

    for (const exp of experiments) {
      stats.byStatus[exp.status] = (stats.byStatus[exp.status] || 0) + 1;

      if (!stats.byContentType[exp.contentType]) {
        stats.byContentType[exp.contentType] = { total: 0, active: null };
      }
      stats.byContentType[exp.contentType].total++;

      if (exp.status === ExperimentStatus.RUNNING) {
        stats.byContentType[exp.contentType].active = exp.id;
      }
    }

    return stats;
  }

  /**
   * Load experiments from disk
   *
   * @private
   */
  _loadFromDisk() {
    try {
      if (existsSync(this._persistPath)) {
        const data = JSON.parse(readFileSync(this._persistPath, 'utf8'));

        if (data.experiments && Array.isArray(data.experiments)) {
          for (const expData of data.experiments) {
            // Convert date strings
            expData.createdAt = new Date(expData.createdAt);
            if (expData.startedAt) expData.startedAt = new Date(expData.startedAt);
            if (expData.concludedAt) expData.concludedAt = new Date(expData.concludedAt);

            this._experiments.set(expData.id, expData);

            if (!this._byContentType.has(expData.contentType)) {
              this._byContentType.set(expData.contentType, new Set());
            }
            this._byContentType.get(expData.contentType).add(expData.id);

            if (expData.status === ExperimentStatus.RUNNING) {
              this._activeByContentType.set(expData.contentType, expData.id);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[ExperimentManager] Failed to load from disk:', error.message);
    }
  }

  /**
   * Save experiments to disk
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
        experiments: Array.from(this._experiments.values())
      };

      writeFileSync(this._persistPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.warn('[ExperimentManager] Failed to save to disk:', error.message);
    }
  }

  /**
   * Force save to disk
   */
  persist() {
    this._saveToDisk();
  }

  /**
   * Clear all experiments (for testing)
   */
  clear() {
    this._experiments.clear();
    this._byContentType.clear();
    this._activeByContentType.clear();
  }
}

// Singleton instance
let _managerInstance = null;

/**
 * Get the singleton ExperimentManager instance
 *
 * @param {Object} config - Configuration (only used on first call)
 * @returns {ExperimentManager}
 */
export function getExperimentManager(config = {}) {
  if (!_managerInstance) {
    _managerInstance = new ExperimentManager(config);
  }
  return _managerInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetExperimentManager() {
  if (_managerInstance) {
    _managerInstance.clear();
  }
  _managerInstance = null;
}

export default {
  ExperimentManager,
  ExperimentStatus,
  createExperiment,
  analyzeExperiment,
  getExperimentManager,
  resetExperimentManager
};
