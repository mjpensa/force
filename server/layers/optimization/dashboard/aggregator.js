/**
 * Dashboard Aggregator - Phase 5 of Auto-Improving Prompts
 *
 * Aggregates data from all optimization components for visualization.
 * Provides trend analysis, insights, and recommendations.
 *
 * @module dashboard/aggregator
 */

import { getVariantRegistry } from '../variants/index.js';
import { getExperimentManager, analyzeExperiment, ExperimentStatus } from '../experiments/index.js';
import { getEvolutionScheduler } from '../evolution/index.js';
import { getMetricsCollector } from '../metrics/index.js';

/**
 * Time period definitions for trend analysis
 */
export const TimePeriod = {
  LAST_HOUR: 'last_hour',
  LAST_24H: 'last_24h',
  LAST_7D: 'last_7d',
  LAST_30D: 'last_30d',
  ALL_TIME: 'all_time'
};

/**
 * Calculate time window bounds
 */
function getTimeWindow(period) {
  const now = Date.now();
  const periods = {
    [TimePeriod.LAST_HOUR]: 60 * 60 * 1000,
    [TimePeriod.LAST_24H]: 24 * 60 * 60 * 1000,
    [TimePeriod.LAST_7D]: 7 * 24 * 60 * 60 * 1000,
    [TimePeriod.LAST_30D]: 30 * 24 * 60 * 60 * 1000,
    [TimePeriod.ALL_TIME]: now
  };

  return {
    start: new Date(now - (periods[period] || now)),
    end: new Date(now)
  };
}

/**
 * Dashboard Aggregator class
 *
 * Collects and aggregates data from all optimization components.
 */
export class DashboardAggregator {
  /**
   * Create a new DashboardAggregator
   */
  constructor() {
    this._cache = new Map();
    this._cacheMaxAge = 60 * 1000; // 1 minute cache
  }

  /**
   * Get comprehensive dashboard data
   *
   * @param {Object} options - Aggregation options
   * @returns {Object} Dashboard data
   */
  getDashboardData(options = {}) {
    const cacheKey = JSON.stringify(options);
    const cached = this._cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this._cacheMaxAge) {
      return cached.data;
    }

    const data = {
      timestamp: new Date(),
      summary: this._getSummary(),
      variants: this._getVariantsData(),
      experiments: this._getExperimentsData(),
      evolution: this._getEvolutionData(),
      metrics: this._getMetricsData(options.period || TimePeriod.LAST_24H),
      insights: this._generateInsights(),
      recommendations: this._generateRecommendations()
    };

    this._cache.set(cacheKey, { timestamp: Date.now(), data });

    return data;
  }

  /**
   * Get summary statistics
   *
   * @private
   */
  _getSummary() {
    const registry = getVariantRegistry();
    const manager = getExperimentManager();
    const scheduler = getEvolutionScheduler();

    const variantStats = registry.getStats();
    const expStats = manager.getStats();
    const schedStats = scheduler.getStats();

    return {
      totalVariants: variantStats.totalVariants,
      activeVariants: Object.values(variantStats.byContentType).reduce(
        (sum, t) => sum + t.active, 0
      ),
      champions: Object.keys(variantStats.champions).length,
      runningExperiments: expStats.byStatus?.[ExperimentStatus.RUNNING] || 0,
      completedExperiments: (expStats.byStatus?.[ExperimentStatus.CONCLUDED] || 0) +
        (expStats.byStatus?.[ExperimentStatus.PROMOTED] || 0),
      schedulerState: schedStats.state,
      lastOptimizationRun: schedStats.lastRunTime,
      totalOptimizationRuns: schedStats.totalRuns
    };
  }

  /**
   * Get variants data for display
   *
   * @private
   */
  _getVariantsData() {
    const registry = getVariantRegistry();
    const stats = registry.getStats();

    const byContentType = {};

    for (const contentType of Object.keys(stats.byContentType)) {
      const variants = registry.getByContentType(contentType);
      const champion = registry.getChampion(contentType);

      byContentType[contentType] = {
        champion: champion ? {
          id: champion.id,
          name: champion.name,
          impressions: champion.performance?.impressions || 0,
          avgLatency: champion.performance?.avgLatencyMs || 0,
          avgQuality: champion.performance?.avgQualityScore || 0,
          successRate: champion.performance?.impressions > 0
            ? champion.performance.conversions / champion.performance.impressions
            : 0
        } : null,
        variants: variants.map(v => ({
          id: v.id,
          name: v.name,
          status: v.status,
          weight: v.weight,
          impressions: v.performance?.impressions || 0,
          avgLatency: v.performance?.avgLatencyMs || 0,
          avgQuality: v.performance?.avgQualityScore || 0,
          successRate: v.performance?.impressions > 0
            ? v.performance.conversions / v.performance.impressions
            : 0,
          createdAt: v.createdAt
        }))
      };
    }

    return {
      stats,
      byContentType
    };
  }

  /**
   * Get experiments data for display
   *
   * @private
   */
  _getExperimentsData() {
    const manager = getExperimentManager();
    const running = manager.getAll({ status: ExperimentStatus.RUNNING });
    const concluded = manager.getAll({
      status: [ExperimentStatus.CONCLUDED, ExperimentStatus.PROMOTED]
    }).slice(0, 10);

    return {
      running: running.map(exp => {
        const analysis = analyzeExperiment(exp);
        return {
          id: exp.id,
          name: exp.name,
          contentType: exp.contentType,
          control: {
            id: exp.controlVariantId,
            samples: exp.controlMetrics.impressions,
            successRate: analysis.controlSuccessRate
          },
          treatment: {
            id: exp.treatmentVariantId,
            samples: exp.treatmentMetrics.impressions,
            successRate: analysis.treatmentSuccessRate
          },
          improvement: analysis.relativeImprovement,
          confidence: analysis.confidence,
          isSignificant: analysis.isSignificant,
          startedAt: exp.startedAt
        };
      }),
      recentConclusions: concluded.map(exp => ({
        id: exp.id,
        name: exp.name,
        contentType: exp.contentType,
        winner: exp.conclusion?.winner,
        winnerVariantId: exp.conclusion?.winnerVariantId,
        improvement: exp.conclusion?.analysis?.relativeImprovement || 0,
        status: exp.status,
        concludedAt: exp.concludedAt
      })),
      stats: manager.getStats()
    };
  }

  /**
   * Get evolution data for display
   *
   * @private
   */
  _getEvolutionData() {
    const scheduler = getEvolutionScheduler();
    const stats = scheduler.getStats();
    const history = scheduler.getHistory({ limit: 20 });

    return {
      state: stats.state,
      intervalMs: stats.intervalMs,
      lastRunTime: stats.lastRunTime,
      nextRunTime: stats.nextRunTime,
      recentRuns: history.map(run => ({
        timestamp: run.timestamp,
        actions: run.actions,
        errors: run.errors.length,
        durationMs: run.durationMs
      })),
      actionCounts: stats.actionCounts
    };
  }

  /**
   * Get metrics data with trend analysis
   *
   * @private
   */
  _getMetricsData(period) {
    try {
      const collector = getMetricsCollector();
      const stats = collector.getStats();

      return {
        period,
        totalRecorded: stats.totalRecorded,
        totalFlushed: stats.totalFlushed,
        bufferSize: stats.bufferSize
      };
    } catch {
      return {
        period,
        totalRecorded: 0,
        totalFlushed: 0,
        bufferSize: 0
      };
    }
  }

  /**
   * Generate insights from data
   *
   * @private
   */
  _generateInsights() {
    const insights = [];
    const registry = getVariantRegistry();
    const manager = getExperimentManager();

    // Check for variants with poor performance
    for (const contentType of ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis']) {
      const variants = registry.getByContentType(contentType, { activeOnly: true });

      for (const variant of variants) {
        const perf = variant.performance || {};

        // High error rate
        if (perf.impressions > 50 && perf.errorCount / perf.impressions > 0.15) {
          insights.push({
            type: 'warning',
            category: 'performance',
            contentType,
            variantId: variant.id,
            message: `High error rate (${((perf.errorCount / perf.impressions) * 100).toFixed(1)}%) for ${variant.name}`,
            suggestion: 'Consider pausing this variant or generating an improved version'
          });
        }

        // Low feedback
        if (perf.feedbackCount > 20 && (perf.feedbackSum / perf.feedbackCount) < 3) {
          insights.push({
            type: 'info',
            category: 'feedback',
            contentType,
            variantId: variant.id,
            message: `Low user feedback (${(perf.feedbackSum / perf.feedbackCount).toFixed(1)}/5) for ${variant.name}`,
            suggestion: 'Analyze user feedback patterns and consider prompt improvements'
          });
        }
      }
    }

    // Check for stale experiments
    const running = manager.getAll({ status: ExperimentStatus.RUNNING });
    for (const exp of running) {
      if (exp.startedAt) {
        const daysRunning = (Date.now() - exp.startedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysRunning > 7) {
          insights.push({
            type: 'info',
            category: 'experiment',
            experimentId: exp.id,
            message: `Experiment "${exp.name}" has been running for ${daysRunning.toFixed(0)} days`,
            suggestion: daysRunning > 14
              ? 'Consider manually concluding if results are sufficient'
              : 'Continue collecting data for statistical significance'
          });
        }
      }
    }

    // Check for winning experiments not yet promoted
    const concluded = manager.getAll({ status: ExperimentStatus.CONCLUDED });
    for (const exp of concluded) {
      if (exp.conclusion?.winner === 'treatment') {
        insights.push({
          type: 'success',
          category: 'experiment',
          experimentId: exp.id,
          message: `Experiment "${exp.name}" has a winning variant ready for promotion`,
          suggestion: `Promote ${exp.conclusion.winnerVariantId} to champion status`
        });
      }
    }

    return insights;
  }

  /**
   * Generate recommendations
   *
   * @private
   */
  _generateRecommendations() {
    const recommendations = [];
    const registry = getVariantRegistry();
    const manager = getExperimentManager();
    const scheduler = getEvolutionScheduler();

    // Check if evolution is running
    if (scheduler.getState() !== 'running') {
      recommendations.push({
        priority: 'high',
        action: 'start_evolution',
        title: 'Start Automatic Optimization',
        description: 'The evolution scheduler is not running. Start it to enable automatic prompt optimization.',
        impact: 'Enables continuous improvement without manual intervention'
      });
    }

    // Check for content types without experiments
    for (const contentType of ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis']) {
      const activeExp = manager.getActive(contentType);
      const champion = registry.getChampion(contentType);

      if (!activeExp && champion) {
        const candidates = registry.getByContentType(contentType, { activeOnly: true })
          .filter(v => v.id !== champion.id);

        if (candidates.length > 0) {
          recommendations.push({
            priority: 'medium',
            action: 'start_experiment',
            contentType,
            title: `Start ${contentType} Experiment`,
            description: `There are ${candidates.length} candidate variant(s) waiting to be tested against the champion.`,
            candidateId: candidates[0].id,
            championId: champion.id
          });
        } else if (champion.performance?.impressions > 100) {
          recommendations.push({
            priority: 'low',
            action: 'generate_variant',
            contentType,
            title: `Generate New ${contentType} Variant`,
            description: 'Consider generating a new variant to test improvements against the current champion.',
            championId: champion.id
          });
        }
      }
    }

    // Check for experiments ready to conclude
    const running = manager.getAll({ status: ExperimentStatus.RUNNING });
    for (const exp of running) {
      const analysis = analyzeExperiment(exp);
      if (analysis.hasSufficientSamples && analysis.isSignificant) {
        recommendations.push({
          priority: 'high',
          action: 'conclude_experiment',
          experimentId: exp.id,
          title: `Conclude ${exp.name}`,
          description: `Experiment has reached statistical significance with ${(analysis.confidence * 100).toFixed(1)}% confidence.`,
          winner: analysis.winner,
          improvement: analysis.relativeImprovement
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get trend data for charting
   *
   * @param {string} contentType - Content type to analyze
   * @param {string} period - Time period
   * @returns {Object} Trend data
   */
  getTrends(contentType, period = TimePeriod.LAST_7D) {
    const window = getTimeWindow(period);

    // This would normally query the metrics storage
    // For now, return placeholder structure
    return {
      contentType,
      period,
      window,
      dataPoints: [],
      summary: {
        avgLatency: 0,
        avgQuality: 0,
        totalImpressions: 0,
        successRate: 0
      }
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this._cache.clear();
  }
}

// Singleton instance
let _aggregatorInstance = null;

/**
 * Get the singleton DashboardAggregator instance
 *
 * @returns {DashboardAggregator}
 */
export function getDashboardAggregator() {
  if (!_aggregatorInstance) {
    _aggregatorInstance = new DashboardAggregator();
  }
  return _aggregatorInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetDashboardAggregator() {
  _aggregatorInstance = null;
}

export default {
  DashboardAggregator,
  TimePeriod,
  getDashboardAggregator,
  resetDashboardAggregator
};
