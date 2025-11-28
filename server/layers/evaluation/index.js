/**
 * Evaluation Layer - PROMPT ML Layer 8
 *
 * Unified export and orchestration for evaluation:
 * - Output evaluation
 * - Benchmarking
 * - Feedback collection
 * - Combined evaluation pipeline
 *
 * Based on PROMPT ML design specification.
 */

// Evaluator exports
export {
  CompositeEvaluator,
  BaseEvaluator,
  CorrectnessEvaluator,
  CompletenessEvaluator,
  ConsistencyEvaluator,
  RelevanceEvaluator,
  FormatEvaluator,
  EvalStatus,
  EvalDimension,
  getEvaluator,
  resetEvaluator,
  evaluateOutput
} from './evaluators.js';

// Benchmark exports
export {
  BenchmarkRunner,
  BenchmarkSuite,
  BenchmarkCase,
  RegressionBenchmark,
  ABComparisonBenchmark,
  BenchmarkStatus,
  BenchmarkType,
  getBenchmarkRunner,
  resetBenchmarkRunner
} from './benchmarks.js';

// Feedback exports
export {
  FeedbackCollector,
  FeedbackType,
  FeedbackSentiment,
  getFeedbackCollector,
  resetFeedbackCollector,
  recordRating,
  recordThumbs
} from './feedback.js';

import { getEvaluator, EvalDimension } from './evaluators.js';
import { getBenchmarkRunner } from './benchmarks.js';
import { getFeedbackCollector, FeedbackType } from './feedback.js';

/**
 * @typedef {Object} EvaluationConfig
 * @property {boolean} enableEvaluation - Enable output evaluation
 * @property {boolean} enableBenchmarks - Enable benchmarking
 * @property {boolean} enableFeedback - Enable feedback collection
 * @property {Array<string>} dimensions - Evaluation dimensions to use
 * @property {number} passingThreshold - Score threshold for passing
 */

const DEFAULT_CONFIG = {
  enableEvaluation: true,
  enableBenchmarks: true,
  enableFeedback: true,
  dimensions: [
    EvalDimension.CORRECTNESS,
    EvalDimension.COMPLETENESS,
    EvalDimension.RELEVANCE,
    EvalDimension.FORMAT
  ],
  passingThreshold: 0.7
};

/**
 * Evaluation Pipeline class
 * Orchestrates evaluation, benchmarking, and feedback
 */
export class EvaluationPipeline {
  /**
   * @param {EvaluationConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Lazy-load components
    this._evaluator = null;
    this._benchmarkRunner = null;
    this._feedbackCollector = null;
  }

  /**
   * Get evaluator instance
   */
  get evaluator() {
    if (!this._evaluator && this.config.enableEvaluation) {
      this._evaluator = getEvaluator({
        dimensions: this.config.dimensions,
        passingThreshold: this.config.passingThreshold
      });
    }
    return this._evaluator;
  }

  /**
   * Get benchmark runner instance
   */
  get benchmarkRunner() {
    if (!this._benchmarkRunner && this.config.enableBenchmarks) {
      this._benchmarkRunner = getBenchmarkRunner();
    }
    return this._benchmarkRunner;
  }

  /**
   * Get feedback collector instance
   */
  get feedbackCollector() {
    if (!this._feedbackCollector && this.config.enableFeedback) {
      this._feedbackCollector = getFeedbackCollector();
    }
    return this._feedbackCollector;
  }

  /**
   * Evaluate generated output
   *
   * @param {*} output - Output to evaluate
   * @param {Object} context - Evaluation context
   * @returns {Object} Evaluation result
   */
  evaluate(output, context = {}) {
    if (!this.config.enableEvaluation || !this.evaluator) {
      return { enabled: false };
    }

    return this.evaluator.evaluate(output, context);
  }

  /**
   * Run benchmarks for a generator function
   *
   * @param {string} name - Benchmark name
   * @param {Function} generator - Generator function
   * @param {Object} testCases - Test cases
   * @returns {Object} Benchmark results
   */
  async runBenchmarks(name, generator, testCases = {}) {
    if (!this.config.enableBenchmarks || !this.benchmarkRunner) {
      return { enabled: false };
    }

    // Create benchmark suite if not exists
    let suite = this.benchmarkRunner.getSuite(name);
    if (!suite) {
      suite = this.benchmarkRunner.createSuite(name);

      // Add test cases as benchmark cases
      for (const [caseName, testCase] of Object.entries(testCases)) {
        suite.add(caseName, async (ctx) => {
          return generator(testCase.prompt, testCase.files, ctx);
        }, testCase.config || {});
      }
    }

    return this.benchmarkRunner.runSuite(name, testCases.context || {});
  }

  /**
   * Record feedback for generated output
   *
   * @param {string} type - Feedback type
   * @param {string} contentType - Content type
   * @param {*} value - Feedback value
   * @param {Object} context - Additional context
   * @returns {Object} Feedback entry
   */
  recordFeedback(type, contentType, value, context = {}) {
    if (!this.config.enableFeedback || !this.feedbackCollector) {
      return { enabled: false };
    }

    switch (type) {
      case FeedbackType.RATING:
        return this.feedbackCollector.recordRating(contentType, value, context);
      case FeedbackType.THUMBS:
        return this.feedbackCollector.recordThumbs(contentType, value, context);
      case FeedbackType.COMMENT:
        return this.feedbackCollector.recordComment(contentType, value, context);
      case FeedbackType.CORRECTION:
        return this.feedbackCollector.recordCorrection(contentType, value, context);
      case FeedbackType.REGENERATE:
        return this.feedbackCollector.recordRegenerate(contentType, context);
      case FeedbackType.EXPORT:
        return this.feedbackCollector.recordExport(contentType, value, context);
      case FeedbackType.EDIT:
        return this.feedbackCollector.recordEdit(contentType, value, context);
      default:
        throw new Error(`Unknown feedback type: ${type}`);
    }
  }

  /**
   * Get comprehensive evaluation summary
   *
   * @returns {Object} Evaluation summary
   */
  getSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      evaluation: null,
      benchmarks: null,
      feedback: null
    };

    // Get feedback aggregates
    if (this.feedbackCollector) {
      summary.feedback = {
        aggregates: this.feedbackCollector.getAggregates(),
        suggestions: this.feedbackCollector.getImprovementSuggestions()
      };
    }

    // Get benchmark history
    if (this.benchmarkRunner) {
      summary.benchmarks = {
        suites: this.benchmarkRunner.getSuiteNames(),
        recentRuns: this.benchmarkRunner.getHistory(5)
      };
    }

    return summary;
  }

  /**
   * Run full evaluation pipeline on output
   *
   * @param {*} output - Generated output
   * @param {Object} context - Full context
   * @returns {Object} Complete evaluation result
   */
  runFullEvaluation(output, context = {}) {
    const result = {
      timestamp: new Date().toISOString(),
      contentType: context.contentType,
      sessionId: context.sessionId,
      evaluation: null,
      passed: true,
      recommendations: []
    };

    // Run evaluation
    if (this.config.enableEvaluation && this.evaluator) {
      result.evaluation = this.evaluator.evaluate(output, context);
      result.passed = result.evaluation.passed;

      // Generate recommendations based on weak dimensions
      if (result.evaluation.summary?.weakestDimensions) {
        for (const weak of result.evaluation.summary.weakestDimensions) {
          if (weak.score < this.config.passingThreshold) {
            result.recommendations.push({
              dimension: weak.dimension,
              score: weak.score,
              suggestion: this._getSuggestionForDimension(weak.dimension)
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Get evaluation report for a session
   *
   * @param {string} sessionId - Session ID
   * @returns {Object} Session evaluation report
   */
  getSessionReport(sessionId) {
    const feedback = this.feedbackCollector?.getEntries({ sessionId }) || [];

    const report = {
      sessionId,
      timestamp: new Date().toISOString(),
      feedbackCount: feedback.length,
      sentimentBreakdown: {
        positive: 0,
        neutral: 0,
        negative: 0
      },
      contentTypeBreakdown: {},
      overallSatisfaction: null
    };

    for (const entry of feedback) {
      // Sentiment
      report.sentimentBreakdown[entry.sentiment]++;

      // Content type
      report.contentTypeBreakdown[entry.contentType] =
        (report.contentTypeBreakdown[entry.contentType] || 0) + 1;
    }

    // Calculate satisfaction
    if (feedback.length > 0) {
      const positiveRate = report.sentimentBreakdown.positive / feedback.length;
      report.overallSatisfaction = Math.round(positiveRate * 100);
    }

    return report;
  }

  _getSuggestionForDimension(dimension) {
    const suggestions = {
      correctness: 'Review source material and ensure claims are verifiable',
      completeness: 'Ensure all required sections and fields are populated',
      consistency: 'Check for contradictory statements or numbers',
      relevance: 'Focus output more closely on the user prompt',
      format: 'Verify output matches expected schema and structure',
      coherence: 'Improve logical flow between sections',
      groundedness: 'Ensure all statements are grounded in source material'
    };

    return suggestions[dimension] || 'Review and improve this dimension';
  }
}

// Singleton instance
let _pipeline = null;

/**
 * Get or create singleton evaluation pipeline
 * @param {EvaluationConfig} config - Configuration (only used on first call)
 * @returns {EvaluationPipeline}
 */
export function getEvaluationPipeline(config = {}) {
  if (!_pipeline) {
    _pipeline = new EvaluationPipeline(config);
  }
  return _pipeline;
}

/**
 * Reset pipeline instance (for testing)
 */
export function resetEvaluationPipeline() {
  _pipeline = null;
}

/**
 * Quick evaluate function
 *
 * @param {*} output - Output to evaluate
 * @param {Object} context - Evaluation context
 * @returns {Object} Evaluation result
 */
export function evaluate(output, context = {}) {
  return getEvaluationPipeline().evaluate(output, context);
}

/**
 * Quick feedback recording function
 *
 * @param {string} type - Feedback type
 * @param {string} contentType - Content type
 * @param {*} value - Feedback value
 * @param {Object} context - Additional context
 * @returns {Object} Feedback entry
 */
export function recordFeedback(type, contentType, value, context = {}) {
  return getEvaluationPipeline().recordFeedback(type, contentType, value, context);
}

/**
 * Create default benchmark suite for content generation
 *
 * @param {Function} generateFn - Generation function
 * @returns {BenchmarkSuite}
 */
export function createGeneratorBenchmarkSuite(generateFn) {
  const runner = getBenchmarkRunner();
  const suite = runner.createSuite('content-generation', {
    iterations: 3,
    warmupIterations: 1,
    thresholds: {
      maxLatencyP95: 120000, // 2 minutes
      minQualityScore: 0.6,
      maxErrorRate: 0.2
    }
  });

  // Add default test cases
  suite.add('simple-prompt', async (ctx) => {
    return generateFn('Create a simple overview', ctx.files || [], ctx);
  });

  suite.add('complex-prompt', async (ctx) => {
    return generateFn('Create a detailed analysis with timelines, metrics, and recommendations', ctx.files || [], ctx);
  });

  return suite;
}

export default EvaluationPipeline;
