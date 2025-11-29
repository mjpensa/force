/**
 * Evolution Scheduler - Phase 4 of Auto-Improving Prompts
 *
 * Orchestrates the automatic optimization loop:
 * - Periodically analyzes variant performance
 * - Generates new variant candidates
 * - Creates experiments for testing
 * - Promotes winning variants
 *
 * @module evolution/scheduler
 */

import { getVariantGenerator } from './generator.js';
import { getVariantRegistry } from '../variants/index.js';
import { getExperimentManager, ExperimentStatus, analyzeExperiment } from '../experiments/index.js';
import { getMetricsCollector } from '../metrics/index.js';

/**
 * Evolution scheduler states
 */
export const SchedulerState = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPED: 'stopped'
};

/**
 * Default scheduler configuration
 */
const DEFAULT_CONFIG = {
  // Run optimization cycle every hour
  intervalMs: 60 * 60 * 1000,

  // Minimum impressions before considering optimization
  minImpressionsThreshold: 100,

  // Minimum time between variant generations (per content type)
  cooldownMs: 24 * 60 * 60 * 1000, // 24 hours

  // Maximum concurrent experiments
  maxConcurrentExperiments: 2,

  // Auto-start experiments for new variants
  autoStartExperiments: true,

  // Content types to optimize
  contentTypes: ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis']
};

/**
 * Evolution Scheduler class
 *
 * Manages the automatic optimization loop.
 */
export class EvolutionScheduler {
  /**
   * Create a new EvolutionScheduler
   *
   * @param {Object} config - Scheduler configuration
   */
  constructor(config = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._state = SchedulerState.IDLE;
    this._intervalHandle = null;
    this._lastRunTime = null;
    this._lastGenerationByType = new Map();
    this._runHistory = [];
    this._maxHistorySize = 100;
    this._cycleInProgress = false;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this._state === SchedulerState.RUNNING) {
      return;
    }

    this._state = SchedulerState.RUNNING;

    // Schedule next cycle using recursive setTimeout to prevent concurrent execution
    const scheduleNext = () => {
      if (this._state !== SchedulerState.RUNNING) {
        return;
      }
      this._intervalHandle = setTimeout(async () => {
        await this._runCycleGuarded();
        scheduleNext();
      }, this._config.intervalMs);
    };

    // Run immediately, then schedule periodic runs
    this._runCycleGuarded().then(() => scheduleNext());

    console.log('[EvolutionScheduler] Started with interval:', this._config.intervalMs);
  }

  /**
   * Run cycle with concurrency guard
   *
   * @private
   */
  async _runCycleGuarded() {
    if (this._cycleInProgress) {
      console.log('[EvolutionScheduler] Cycle already in progress, skipping');
      return null;
    }
    this._cycleInProgress = true;
    try {
      return await this._runCycle();
    } finally {
      this._cycleInProgress = false;
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this._intervalHandle) {
      clearTimeout(this._intervalHandle);
      this._intervalHandle = null;
    }

    this._state = SchedulerState.STOPPED;
    console.log('[EvolutionScheduler] Stopped');
  }

  /**
   * Pause the scheduler
   */
  pause() {
    if (this._intervalHandle) {
      clearTimeout(this._intervalHandle);
      this._intervalHandle = null;
    }

    this._state = SchedulerState.PAUSED;
    console.log('[EvolutionScheduler] Paused');
  }

  /**
   * Resume the scheduler
   */
  resume() {
    if (this._state !== SchedulerState.PAUSED) {
      return;
    }

    this.start();
  }

  /**
   * Run a single optimization cycle
   *
   * @returns {Promise<Object>} Cycle results
   */
  async runOnce() {
    return await this._runCycle();
  }

  /**
   * Internal optimization cycle
   *
   * @private
   */
  async _runCycle() {
    const startTime = Date.now();
    const results = {
      timestamp: new Date(),
      actions: [],
      errors: []
    };

    try {
      // 1. Check and conclude running experiments
      const concluded = await this._checkExperiments();
      if (concluded.length > 0) {
        results.actions.push({
          type: 'conclude_experiments',
          count: concluded.length,
          experiments: concluded.map(e => e.id)
        });
      }

      // 2. Analyze each content type for improvements
      for (const contentType of this._config.contentTypes) {
        try {
          const typeResult = this._analyzeContentType(contentType);
          if (typeResult.action) {
            results.actions.push(typeResult);
          }
        } catch (error) {
          results.errors.push({
            contentType,
            error: error.message
          });
        }
      }

      // 3. Generate new variants if needed
      const generated = await this._generateNewVariants();
      if (generated.length > 0) {
        results.actions.push({
          type: 'generate_variants',
          count: generated.length,
          variants: generated.map(v => ({
            id: v.id,
            contentType: v.contentType,
            strategy: v.metadata?.strategy
          }))
        });
      }

    } catch (error) {
      results.errors.push({
        type: 'cycle_error',
        error: error.message
      });
    }

    results.durationMs = Date.now() - startTime;
    this._lastRunTime = new Date();

    // Record in history
    this._runHistory.push(results);
    while (this._runHistory.length > this._maxHistorySize) {
      this._runHistory.shift();
    }

    return results;
  }

  /**
   * Check running experiments and conclude if ready
   *
   * @private
   */
  async _checkExperiments() {
    // Flush metrics to ensure analysis uses fresh data
    try {
      const collector = getMetricsCollector();
      await collector.flush();
    } catch (error) {
      console.warn('[EvolutionScheduler] Failed to flush metrics:', error.message);
    }

    const manager = getExperimentManager();
    const running = manager.getAll({ status: ExperimentStatus.RUNNING });
    const concluded = [];

    for (const exp of running) {
      // Analyze the running experiment directly (not from conclusion field)
      const analysis = analyzeExperiment(exp);

      // Conclude if statistically significant with sufficient samples
      if (analysis?.hasSufficientSamples && analysis?.isSignificant) {
        try {
          manager.conclude(exp.id, 'scheduler_significant');
          concluded.push(exp);
        } catch (error) {
          console.warn(`[EvolutionScheduler] Failed to conclude ${exp.id}:`, error.message);
        }
      }
    }

    return concluded;
  }

  /**
   * Analyze a content type for optimization opportunities
   *
   * @private
   */
  _analyzeContentType(contentType) {
    const registry = getVariantRegistry();
    const manager = getExperimentManager();

    // Check if there's already an active experiment
    const activeExp = manager.getActive(contentType);
    if (activeExp) {
      return {
        contentType,
        action: 'skip',
        reason: 'experiment_running',
        experimentId: activeExp.id
      };
    }

    // Check cooldown
    const lastGenTime = this._lastGenerationByType.get(contentType);
    if (lastGenTime && Date.now() - lastGenTime < this._config.cooldownMs) {
      return {
        contentType,
        action: 'skip',
        reason: 'cooldown',
        nextGenerationIn: this._config.cooldownMs - (Date.now() - lastGenTime)
      };
    }

    // Get champion and check if it has enough data
    const champion = registry.getChampion(contentType);
    if (!champion) {
      return {
        contentType,
        action: 'skip',
        reason: 'no_champion'
      };
    }

    // Check impressions
    const impressions = champion.performance?.impressions || 0;
    if (impressions < this._config.minImpressionsThreshold) {
      return {
        contentType,
        action: 'skip',
        reason: 'insufficient_data',
        impressions,
        required: this._config.minImpressionsThreshold
      };
    }

    // Check for existing candidates
    const candidates = registry.getByContentType(contentType, {
      status: ['candidate', 'active']
    }).filter(v => v.id !== champion.id);

    if (candidates.length > 0) {
      // Start experiment with existing candidate
      const candidate = candidates[0];

      if (this._config.autoStartExperiments) {
        try {
          const exp = manager.create({
            name: `Auto: ${contentType} - ${new Date().toISOString().split('T')[0]}`,
            description: `Automated experiment testing ${candidate.name}`,
            controlVariantId: champion.id,
            treatmentVariantId: candidate.id,
            hypothesis: `${candidate.name} will outperform ${champion.name}`
          });
          manager.start(exp.id);

          return {
            contentType,
            action: 'start_experiment',
            experimentId: exp.id,
            control: champion.id,
            treatment: candidate.id
          };
        } catch (error) {
          return {
            contentType,
            action: 'error',
            error: error.message
          };
        }
      }
    }

    return {
      contentType,
      action: 'ready_for_generation',
      championId: champion.id,
      impressions
    };
  }

  /**
   * Generate new variants for content types that need them
   *
   * @private
   */
  async _generateNewVariants() {
    const generator = getVariantGenerator();
    const registry = getVariantRegistry();
    const generated = [];

    for (const contentType of this._config.contentTypes) {
      // Check if we need a new variant
      const candidates = registry.getByContentType(contentType, {
        status: ['candidate', 'active']
      });

      const champion = registry.getChampion(contentType);
      const nonChampionCandidates = candidates.filter(c => c.id !== champion?.id);

      if (nonChampionCandidates.length === 0 && champion) {
        // Generate a new variant
        try {
          const configs = await generator.analyzeAndGenerate(contentType);

          for (const config of configs) {
            const variant = registry.register(config);
            generated.push(variant);
            this._lastGenerationByType.set(contentType, Date.now());
          }
        } catch (error) {
          console.warn(`[EvolutionScheduler] Failed to generate for ${contentType}:`, error.message);
        }
      }
    }

    return generated;
  }

  /**
   * Get scheduler state
   *
   * @returns {string}
   */
  getState() {
    return this._state;
  }

  /**
   * Get scheduler configuration
   *
   * @returns {Object}
   */
  getConfig() {
    return { ...this._config };
  }

  /**
   * Update scheduler configuration
   *
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    const wasRunning = this._state === SchedulerState.RUNNING;

    if (wasRunning) {
      this.stop();
    }

    this._config = { ...this._config, ...config };

    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Get run history
   *
   * @param {Object} options - Filter options
   * @returns {Array}
   */
  getHistory(options = {}) {
    let history = [...this._runHistory];

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Get scheduler statistics
   *
   * @returns {Object}
   */
  getStats() {
    const totalRuns = this._runHistory.length;
    const recentRuns = this._runHistory.slice(-10);

    let totalActions = 0;
    let totalErrors = 0;
    const actionCounts = {};

    for (const run of this._runHistory) {
      for (const action of run.actions) {
        totalActions++;
        actionCounts[action.type] = (actionCounts[action.type] || 0) + 1;
      }
      totalErrors += run.errors.length;
    }

    return {
      state: this._state,
      totalRuns,
      lastRunTime: this._lastRunTime,
      nextRunTime: this._state === SchedulerState.RUNNING && this._lastRunTime
        ? new Date(this._lastRunTime.getTime() + this._config.intervalMs)
        : null,
      intervalMs: this._config.intervalMs,
      totalActions,
      totalErrors,
      actionCounts,
      recentRuns: recentRuns.map(r => ({
        timestamp: r.timestamp,
        actionCount: r.actions.length,
        errorCount: r.errors.length,
        durationMs: r.durationMs
      }))
    };
  }

  /**
   * Get optimization summary
   *
   * @returns {Object}
   */
  getSummary() {
    const registry = getVariantRegistry();
    const manager = getExperimentManager();
    const generator = getVariantGenerator();

    const summary = {
      scheduler: this.getStats(),
      variants: registry.getStats(),
      experiments: manager.getStats(),
      generator: generator.getStats(),
      contentTypeSummary: {}
    };

    for (const contentType of this._config.contentTypes) {
      const champion = registry.getChampion(contentType);
      const activeExp = manager.getActive(contentType);
      const variants = registry.getByContentType(contentType, { activeOnly: true });

      summary.contentTypeSummary[contentType] = {
        champion: champion ? {
          id: champion.id,
          name: champion.name,
          impressions: champion.performance?.impressions || 0
        } : null,
        activeExperiment: activeExp ? activeExp.id : null,
        variantCount: variants.length,
        lastGeneration: this._lastGenerationByType.get(contentType) || null
      };
    }

    return summary;
  }
}

// Singleton instance
let _schedulerInstance = null;

/**
 * Get the singleton EvolutionScheduler instance
 *
 * @param {Object} config - Configuration (only used on first call)
 * @returns {EvolutionScheduler}
 */
export function getEvolutionScheduler(config = {}) {
  if (!_schedulerInstance) {
    _schedulerInstance = new EvolutionScheduler(config);
  }
  return _schedulerInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetEvolutionScheduler() {
  if (_schedulerInstance) {
    _schedulerInstance.stop();
  }
  _schedulerInstance = null;
}

export default {
  EvolutionScheduler,
  SchedulerState,
  getEvolutionScheduler,
  resetEvolutionScheduler
};
