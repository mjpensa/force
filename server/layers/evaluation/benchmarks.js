/**
 * Benchmarks - PROMPT ML Layer 8
 *
 * Performance benchmarking for LLM operations:
 * - Latency benchmarks
 * - Quality benchmarks
 * - Regression testing
 * - A/B comparison
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Benchmark status
 * @readonly
 * @enum {string}
 */
export const BenchmarkStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Benchmark types
 * @readonly
 * @enum {string}
 */
export const BenchmarkType = {
  LATENCY: 'latency',           // Response time benchmarks
  QUALITY: 'quality',           // Output quality benchmarks
  THROUGHPUT: 'throughput',     // Requests per second
  REGRESSION: 'regression',     // Regression testing
  COMPARISON: 'comparison'      // A/B comparison
};

/**
 * @typedef {Object} BenchmarkConfig
 * @property {string} name - Benchmark name
 * @property {BenchmarkType} type - Benchmark type
 * @property {number} iterations - Number of iterations
 * @property {number} warmupIterations - Warmup iterations
 * @property {number} timeout - Timeout per iteration (ms)
 * @property {Object} thresholds - Pass/fail thresholds
 */

/**
 * @typedef {Object} BenchmarkResult
 * @property {string} name - Benchmark name
 * @property {BenchmarkStatus} status - Benchmark status
 * @property {number} iterations - Completed iterations
 * @property {Object} metrics - Benchmark metrics
 * @property {boolean} passed - Whether benchmark passed thresholds
 * @property {Array} failures - Failure details
 */

const DEFAULT_CONFIG = {
  iterations: 5,
  warmupIterations: 1,
  timeout: 120000,
  thresholds: {
    maxLatencyP95: 60000,   // 60 seconds
    minQualityScore: 0.7,
    maxErrorRate: 0.1
  }
};

/**
 * Statistics calculator
 */
class Stats {
  static calculate(values) {
    if (!values || values.length === 0) {
      return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0, stdDev: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;

    // Standard deviation
    const squareDiffs = sorted.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    const stdDev = Math.sqrt(avgSquareDiff);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: Math.round(avg * 100) / 100,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1],
      stdDev: Math.round(stdDev * 100) / 100,
      count: sorted.length
    };
  }
}

/**
 * Benchmark case class
 */
export class BenchmarkCase {
  /**
   * @param {string} name - Benchmark name
   * @param {Function} fn - Function to benchmark
   * @param {Object} config - Configuration
   */
  constructor(name, fn, config = {}) {
    this.name = name;
    this.fn = fn;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.results = [];
    this.status = BenchmarkStatus.PENDING;
  }

  /**
   * Run the benchmark
   * @param {Object} context - Benchmark context
   * @returns {BenchmarkResult}
   */
  async run(context = {}) {
    this.status = BenchmarkStatus.RUNNING;
    this.results = [];
    const failures = [];

    try {
      // Warmup iterations
      for (let i = 0; i < this.config.warmupIterations; i++) {
        await this._runIteration(context, true);
      }

      // Actual iterations
      for (let i = 0; i < this.config.iterations; i++) {
        const result = await this._runIteration(context, false);
        this.results.push(result);

        if (!result.success) {
          failures.push({
            iteration: i + 1,
            error: result.error
          });
        }
      }

      this.status = BenchmarkStatus.COMPLETED;

    } catch (error) {
      this.status = BenchmarkStatus.FAILED;
      failures.push({ error: error.message });
    }

    return this._buildResult(failures);
  }

  async _runIteration(context, isWarmup) {
    const startTime = Date.now();
    const result = {
      success: true,
      latency: 0,
      error: null,
      output: null,
      quality: null
    };

    try {
      // Run with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Benchmark timeout')), this.config.timeout)
      );

      result.output = await Promise.race([
        this.fn(context),
        timeoutPromise
      ]);

      result.latency = Date.now() - startTime;

      // Extract quality score if available
      if (result.output?._validation?.quality?.score) {
        result.quality = result.output._validation.quality.score;
      }

    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.latency = Date.now() - startTime;
    }

    return result;
  }

  _buildResult(failures) {
    const latencies = this.results.map(r => r.latency);
    const qualities = this.results.filter(r => r.quality !== null).map(r => r.quality);
    const successCount = this.results.filter(r => r.success).length;
    const errorRate = 1 - (successCount / this.results.length);

    const metrics = {
      latency: Stats.calculate(latencies),
      quality: qualities.length > 0 ? Stats.calculate(qualities) : null,
      successRate: successCount / this.results.length,
      errorRate
    };

    // Check thresholds
    const passed = this._checkThresholds(metrics);

    return {
      name: this.name,
      status: this.status,
      iterations: this.results.length,
      metrics,
      passed,
      failures,
      timestamp: new Date().toISOString()
    };
  }

  _checkThresholds(metrics) {
    const { thresholds } = this.config;

    if (thresholds.maxLatencyP95 && metrics.latency.p95 > thresholds.maxLatencyP95) {
      return false;
    }

    if (thresholds.minQualityScore && metrics.quality?.avg < thresholds.minQualityScore) {
      return false;
    }

    if (thresholds.maxErrorRate && metrics.errorRate > thresholds.maxErrorRate) {
      return false;
    }

    return true;
  }
}

/**
 * Benchmark Suite class
 */
export class BenchmarkSuite {
  /**
   * @param {string} name - Suite name
   * @param {Object} config - Configuration
   */
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.benchmarks = new Map();
    this.results = new Map();
    this.status = BenchmarkStatus.PENDING;
  }

  /**
   * Add a benchmark case
   * @param {string} name - Benchmark name
   * @param {Function} fn - Function to benchmark
   * @param {Object} config - Configuration
   */
  add(name, fn, config = {}) {
    this.benchmarks.set(name, new BenchmarkCase(name, fn, {
      ...this.config,
      ...config
    }));
  }

  /**
   * Run all benchmarks
   * @param {Object} context - Benchmark context
   * @returns {Object} Suite results
   */
  async run(context = {}) {
    this.status = BenchmarkStatus.RUNNING;
    this.results.clear();

    const startTime = Date.now();

    for (const [name, benchmark] of this.benchmarks) {
      const result = await benchmark.run(context);
      this.results.set(name, result);
    }

    this.status = BenchmarkStatus.COMPLETED;

    return this._buildSuiteResult(startTime);
  }

  /**
   * Run benchmarks in parallel
   * @param {Object} context - Benchmark context
   * @returns {Object} Suite results
   */
  async runParallel(context = {}) {
    this.status = BenchmarkStatus.RUNNING;
    this.results.clear();

    const startTime = Date.now();

    const promises = Array.from(this.benchmarks.entries()).map(
      async ([name, benchmark]) => {
        const result = await benchmark.run(context);
        return [name, result];
      }
    );

    const results = await Promise.all(promises);
    for (const [name, result] of results) {
      this.results.set(name, result);
    }

    this.status = BenchmarkStatus.COMPLETED;

    return this._buildSuiteResult(startTime);
  }

  _buildSuiteResult(startTime) {
    const results = Array.from(this.results.values());
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    // Aggregate metrics
    const allLatencies = results.flatMap(r =>
      r.metrics.latency ? [r.metrics.latency.avg] : []
    );
    const allQualities = results.flatMap(r =>
      r.metrics.quality ? [r.metrics.quality.avg] : []
    );

    return {
      suite: this.name,
      status: this.status,
      duration: Date.now() - startTime,
      totalBenchmarks: this.benchmarks.size,
      passed,
      failed,
      passRate: passed / this.benchmarks.size,
      aggregateMetrics: {
        avgLatency: allLatencies.length > 0
          ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
          : null,
        avgQuality: allQualities.length > 0
          ? Math.round(allQualities.reduce((a, b) => a + b, 0) / allQualities.length * 100) / 100
          : null
      },
      results: Object.fromEntries(this.results),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get result for a specific benchmark
   * @param {string} name - Benchmark name
   * @returns {BenchmarkResult|null}
   */
  getResult(name) {
    return this.results.get(name) || null;
  }
}

/**
 * Regression Benchmark
 * Compares current results against baseline
 */
export class RegressionBenchmark {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = {
      tolerancePercent: 10, // Allow 10% regression
      ...config
    };
    this.baselines = new Map();
  }

  /**
   * Set baseline for a metric
   * @param {string} name - Metric name
   * @param {Object} baseline - Baseline values
   */
  setBaseline(name, baseline) {
    this.baselines.set(name, baseline);
  }

  /**
   * Load baselines from object
   * @param {Object} baselines - Baselines object
   */
  loadBaselines(baselines) {
    for (const [name, value] of Object.entries(baselines)) {
      this.baselines.set(name, value);
    }
  }

  /**
   * Compare current results against baseline
   * @param {string} name - Metric name
   * @param {Object} current - Current values
   * @returns {Object} Comparison result
   */
  compare(name, current) {
    const baseline = this.baselines.get(name);
    if (!baseline) {
      return {
        name,
        hasBaseline: false,
        passed: true,
        message: 'No baseline to compare against'
      };
    }

    const regressions = [];
    const improvements = [];

    // Compare each metric
    for (const [metric, baselineValue] of Object.entries(baseline)) {
      const currentValue = current[metric];
      if (currentValue === undefined) continue;

      const change = ((currentValue - baselineValue) / baselineValue) * 100;

      // For latency metrics, increase is regression
      if (metric.includes('latency') || metric.includes('Latency')) {
        if (change > this.config.tolerancePercent) {
          regressions.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            changePercent: Math.round(change * 100) / 100
          });
        } else if (change < -this.config.tolerancePercent) {
          improvements.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            changePercent: Math.round(change * 100) / 100
          });
        }
      }
      // For quality metrics, decrease is regression
      else if (metric.includes('quality') || metric.includes('Quality') || metric.includes('score')) {
        if (change < -this.config.tolerancePercent) {
          regressions.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            changePercent: Math.round(change * 100) / 100
          });
        } else if (change > this.config.tolerancePercent) {
          improvements.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            changePercent: Math.round(change * 100) / 100
          });
        }
      }
    }

    return {
      name,
      hasBaseline: true,
      passed: regressions.length === 0,
      regressions,
      improvements,
      message: regressions.length > 0
        ? `${regressions.length} regression(s) detected`
        : 'No regressions detected'
    };
  }

  /**
   * Export current baselines
   * @returns {Object} Baselines object
   */
  exportBaselines() {
    return Object.fromEntries(this.baselines);
  }
}

/**
 * A/B Comparison Benchmark
 * Compares two implementations
 */
export class ABComparisonBenchmark {
  /**
   * @param {string} name - Comparison name
   * @param {Object} config - Configuration
   */
  constructor(name, config = {}) {
    this.name = name;
    this.config = {
      iterations: 5,
      ...config
    };
  }

  /**
   * Compare two implementations
   * @param {Function} implA - Implementation A
   * @param {Function} implB - Implementation B
   * @param {Object} context - Test context
   * @returns {Object} Comparison result
   */
  async compare(implA, implB, context = {}) {
    const resultsA = [];
    const resultsB = [];

    // Run alternating iterations
    for (let i = 0; i < this.config.iterations; i++) {
      // Run A first half the time, B first the other half
      if (i % 2 === 0) {
        resultsA.push(await this._runImpl(implA, context));
        resultsB.push(await this._runImpl(implB, context));
      } else {
        resultsB.push(await this._runImpl(implB, context));
        resultsA.push(await this._runImpl(implA, context));
      }
    }

    return this._analyzeComparison(resultsA, resultsB);
  }

  async _runImpl(impl, context) {
    const startTime = Date.now();
    try {
      const output = await impl(context);
      return {
        success: true,
        latency: Date.now() - startTime,
        quality: output?._validation?.quality?.score || null,
        output
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error.message
      };
    }
  }

  _analyzeComparison(resultsA, resultsB) {
    const metricsA = {
      latency: Stats.calculate(resultsA.map(r => r.latency)),
      quality: Stats.calculate(resultsA.filter(r => r.quality).map(r => r.quality)),
      successRate: resultsA.filter(r => r.success).length / resultsA.length
    };

    const metricsB = {
      latency: Stats.calculate(resultsB.map(r => r.latency)),
      quality: Stats.calculate(resultsB.filter(r => r.quality).map(r => r.quality)),
      successRate: resultsB.filter(r => r.success).length / resultsB.length
    };

    // Determine winner
    let latencyWinner = 'tie';
    let qualityWinner = 'tie';

    if (metricsA.latency.avg < metricsB.latency.avg * 0.9) {
      latencyWinner = 'A';
    } else if (metricsB.latency.avg < metricsA.latency.avg * 0.9) {
      latencyWinner = 'B';
    }

    if (metricsA.quality.avg > metricsB.quality.avg * 1.05) {
      qualityWinner = 'A';
    } else if (metricsB.quality.avg > metricsA.quality.avg * 1.05) {
      qualityWinner = 'B';
    }

    // Calculate statistical significance (simplified)
    const latencyDiff = Math.abs(metricsA.latency.avg - metricsB.latency.avg);
    const latencySignificant = latencyDiff > (metricsA.latency.stdDev + metricsB.latency.stdDev);

    return {
      name: this.name,
      iterations: this.config.iterations,
      metricsA,
      metricsB,
      comparison: {
        latencyWinner,
        qualityWinner,
        latencyDifference: Math.round(metricsA.latency.avg - metricsB.latency.avg),
        qualityDifference: Math.round((metricsA.quality.avg - metricsB.quality.avg) * 100) / 100,
        statisticallySignificant: latencySignificant
      },
      recommendation: this._getRecommendation(metricsA, metricsB, latencyWinner, qualityWinner),
      timestamp: new Date().toISOString()
    };
  }

  _getRecommendation(metricsA, metricsB, latencyWinner, qualityWinner) {
    if (latencyWinner === qualityWinner && latencyWinner !== 'tie') {
      return `Implementation ${latencyWinner} is recommended (better latency and quality)`;
    }

    if (latencyWinner === 'A' && qualityWinner === 'B') {
      return 'Trade-off: A is faster, B has better quality. Choose based on priority.';
    }

    if (latencyWinner === 'B' && qualityWinner === 'A') {
      return 'Trade-off: B is faster, A has better quality. Choose based on priority.';
    }

    return 'Implementations are comparable. Consider other factors.';
  }
}

/**
 * Benchmark Runner
 * Manages and runs benchmark suites
 */
export class BenchmarkRunner {
  constructor() {
    this.suites = new Map();
    this.history = [];
    this.maxHistory = 50;
  }

  /**
   * Create a new benchmark suite
   * @param {string} name - Suite name
   * @param {Object} config - Configuration
   * @returns {BenchmarkSuite}
   */
  createSuite(name, config = {}) {
    const suite = new BenchmarkSuite(name, config);
    this.suites.set(name, suite);
    return suite;
  }

  /**
   * Get a benchmark suite
   * @param {string} name - Suite name
   * @returns {BenchmarkSuite|null}
   */
  getSuite(name) {
    return this.suites.get(name) || null;
  }

  /**
   * Run a benchmark suite
   * @param {string} name - Suite name
   * @param {Object} context - Benchmark context
   * @returns {Object} Suite results
   */
  async runSuite(name, context = {}) {
    const suite = this.suites.get(name);
    if (!suite) {
      throw new Error(`Benchmark suite not found: ${name}`);
    }

    const result = await suite.run(context);

    // Store in history
    this.history.push({
      suite: name,
      result,
      timestamp: new Date().toISOString()
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return result;
  }

  /**
   * Run all benchmark suites
   * @param {Object} context - Benchmark context
   * @returns {Object} All results
   */
  async runAll(context = {}) {
    const results = {};

    for (const [name, suite] of this.suites) {
      results[name] = await suite.run(context);
    }

    return {
      timestamp: new Date().toISOString(),
      totalSuites: this.suites.size,
      results
    };
  }

  /**
   * Get benchmark history
   * @param {number} count - Number of records
   * @returns {Array}
   */
  getHistory(count = 10) {
    return this.history.slice(-count);
  }

  /**
   * Get all suite names
   * @returns {Array<string>}
   */
  getSuiteNames() {
    return Array.from(this.suites.keys());
  }
}

// Singleton instance
let _runner = null;

/**
 * Get or create singleton benchmark runner
 * @returns {BenchmarkRunner}
 */
export function getBenchmarkRunner() {
  if (!_runner) {
    _runner = new BenchmarkRunner();
  }
  return _runner;
}

/**
 * Reset benchmark runner (for testing)
 */
export function resetBenchmarkRunner() {
  _runner = null;
}

export default BenchmarkRunner;
