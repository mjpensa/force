/**
 * Health Check Module - PROMPT ML Layer 10
 *
 * Comprehensive health monitoring for the PROMPT ML system:
 * - Component health checks
 * - Dependency status
 * - Resource utilization
 * - Readiness and liveness probes
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Health status levels
 * @readonly
 * @enum {string}
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown'
};

/**
 * @typedef {Object} HealthCheckResult
 * @property {string} name - Check name
 * @property {HealthStatus} status - Health status
 * @property {number} latency - Check latency in ms
 * @property {string} message - Status message
 * @property {Object} details - Additional details
 * @property {string} timestamp - Check timestamp
 */

/**
 * @typedef {Object} HealthConfig
 * @property {number} timeout - Check timeout in ms
 * @property {number} interval - Check interval in ms
 * @property {boolean} includeDetails - Include detailed info
 */

const DEFAULT_CONFIG = {
  timeout: 5000,
  interval: 30000,
  includeDetails: true
};

/**
 * Health check functions for each PROMPT ML layer
 */
const LAYER_CHECKS = {
  /**
   * Layer 1: Input Safety
   */
  async inputSafety() {
    try {
      // Check if input safety module is loaded and functional
      const { getInputValidator } = await import('../safety/input-validator.js').catch(() => null);

      if (!getInputValidator) {
        return {
          status: HealthStatus.UNKNOWN,
          message: 'Input safety module not available'
        };
      }

      return {
        status: HealthStatus.HEALTHY,
        message: 'Input safety operational'
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Input safety error: ${error.message}`
      };
    }
  },

  /**
   * Layer 2: Context Engineering
   */
  async contextEngineering() {
    try {
      const { getContextLayer } = await import('../context/index.js');
      const contextLayer = getContextLayer();

      if (!contextLayer) {
        return {
          status: HealthStatus.DEGRADED,
          message: 'Context layer not initialized'
        };
      }

      return {
        status: HealthStatus.HEALTHY,
        message: 'Context engineering operational',
        details: {
          strategies: Object.keys(contextLayer.strategies || {}).length
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Context engineering error: ${error.message}`
      };
    }
  },

  /**
   * Layer 3: DSPy Signatures
   */
  async signatures() {
    try {
      const { SignatureType } = await import('../signatures/index.js');

      return {
        status: HealthStatus.HEALTHY,
        message: 'Signatures module operational',
        details: {
          signatureTypes: Object.keys(SignatureType).length
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        message: `Signatures module error: ${error.message}`
      };
    }
  },

  /**
   * Layer 4: Model Routing
   */
  async routing() {
    try {
      const { getRouter, getFallbackManager } = await import('../routing/index.js');
      const router = getRouter();
      const fallbackManager = getFallbackManager();

      return {
        status: HealthStatus.HEALTHY,
        message: 'Model routing operational',
        details: {
          routerReady: !!router,
          fallbackReady: !!fallbackManager
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        message: `Model routing error: ${error.message}`
      };
    }
  },

  /**
   * Layer 5: Output Validation
   */
  async outputValidation() {
    try {
      const { getOutputProcessor } = await import('../output/index.js');
      const processor = getOutputProcessor();

      return {
        status: HealthStatus.HEALTHY,
        message: 'Output validation operational',
        details: {
          processorReady: !!processor
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        message: `Output validation error: ${error.message}`
      };
    }
  },

  /**
   * Layer 6: Observability
   */
  async observability() {
    try {
      const { getObservabilityPipeline } = await import('../observability/index.js');
      const pipeline = getObservabilityPipeline();

      if (!pipeline) {
        return {
          status: HealthStatus.DEGRADED,
          message: 'Observability pipeline not initialized'
        };
      }

      const summary = pipeline.getSummary();

      return {
        status: HealthStatus.HEALTHY,
        message: 'Observability operational',
        details: {
          activeTraces: summary.tracer?.activeTraces || 0,
          metricsCount: summary.metrics?.metricCount || 0
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        message: `Observability error: ${error.message}`
      };
    }
  },

  /**
   * Layer 7: Evaluation
   */
  async evaluation() {
    try {
      const { getEvaluationPipeline } = await import('../evaluation/index.js');
      const pipeline = getEvaluationPipeline();

      if (!pipeline) {
        return {
          status: HealthStatus.DEGRADED,
          message: 'Evaluation pipeline not initialized'
        };
      }

      return {
        status: HealthStatus.HEALTHY,
        message: 'Evaluation operational',
        details: {
          evaluatorsReady: !!pipeline.evaluator,
          feedbackCollectorReady: !!pipeline.feedbackCollector
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        message: `Evaluation error: ${error.message}`
      };
    }
  },

  /**
   * Layer 8: Optimization
   */
  async optimization() {
    try {
      const { getOptimizationPipeline } = await import('../optimization/index.js');
      const pipeline = getOptimizationPipeline();

      if (!pipeline) {
        return {
          status: HealthStatus.DEGRADED,
          message: 'Optimization pipeline not initialized'
        };
      }

      const summary = pipeline.getSummary();

      return {
        status: HealthStatus.HEALTHY,
        message: 'Optimization operational',
        details: {
          promptOptimizer: !!summary.prompt,
          cacheOptimizer: !!summary.cache,
          performanceTuner: !!summary.performance
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        message: `Optimization error: ${error.message}`
      };
    }
  }
};

/**
 * External dependency health checks
 */
const DEPENDENCY_CHECKS = {
  /**
   * Check Gemini API connectivity
   */
  async geminiApi() {
    try {
      // Check if API key is configured
      if (!process.env.API_KEY) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: 'Gemini API key not configured'
        };
      }

      return {
        status: HealthStatus.HEALTHY,
        message: 'Gemini API configured'
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Gemini API error: ${error.message}`
      };
    }
  },

  /**
   * Check memory usage
   */
  async memory() {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
    const utilization = used.heapUsed / used.heapTotal;

    let status = HealthStatus.HEALTHY;
    let message = 'Memory usage normal';

    if (utilization > 0.9) {
      status = HealthStatus.UNHEALTHY;
      message = 'Memory usage critical';
    } else if (utilization > 0.75) {
      status = HealthStatus.DEGRADED;
      message = 'Memory usage elevated';
    }

    return {
      status,
      message,
      details: {
        heapUsedMB,
        heapTotalMB,
        utilization: `${(utilization * 100).toFixed(1)}%`,
        rssMB: Math.round(used.rss / 1024 / 1024),
        externalMB: Math.round(used.external / 1024 / 1024)
      }
    };
  },

  /**
   * Check event loop lag
   */
  async eventLoop() {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms

        let status = HealthStatus.HEALTHY;
        let message = 'Event loop responsive';

        if (lag > 100) {
          status = HealthStatus.UNHEALTHY;
          message = 'Event loop severely lagging';
        } else if (lag > 50) {
          status = HealthStatus.DEGRADED;
          message = 'Event loop lagging';
        }

        resolve({
          status,
          message,
          details: {
            lagMs: lag.toFixed(2)
          }
        });
      });
    });
  }
};

/**
 * Health Check Manager
 */
export class HealthCheckManager {
  /**
   * @param {HealthConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lastResults = new Map();
    this.checkInterval = null;
  }

  /**
   * Run a single health check with timeout
   *
   * @param {string} name - Check name
   * @param {Function} checkFn - Check function
   * @returns {HealthCheckResult}
   */
  async runCheck(name, checkFn) {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout);
      });

      const result = await Promise.race([checkFn(), timeoutPromise]);
      const latency = Date.now() - startTime;

      const checkResult = {
        name,
        status: result.status || HealthStatus.UNKNOWN,
        latency,
        message: result.message || '',
        details: this.config.includeDetails ? result.details : undefined,
        timestamp: new Date().toISOString()
      };

      this.lastResults.set(name, checkResult);
      return checkResult;
    } catch (error) {
      const checkResult = {
        name,
        status: HealthStatus.UNHEALTHY,
        latency: Date.now() - startTime,
        message: error.message,
        timestamp: new Date().toISOString()
      };

      this.lastResults.set(name, checkResult);
      return checkResult;
    }
  }

  /**
   * Run all layer health checks
   *
   * @returns {Array<HealthCheckResult>}
   */
  async checkLayers() {
    const results = [];

    for (const [name, checkFn] of Object.entries(LAYER_CHECKS)) {
      const result = await this.runCheck(`layer:${name}`, checkFn);
      results.push(result);
    }

    return results;
  }

  /**
   * Run all dependency health checks
   *
   * @returns {Array<HealthCheckResult>}
   */
  async checkDependencies() {
    const results = [];

    for (const [name, checkFn] of Object.entries(DEPENDENCY_CHECKS)) {
      const result = await this.runCheck(`dependency:${name}`, checkFn);
      results.push(result);
    }

    return results;
  }

  /**
   * Run comprehensive health check
   *
   * @returns {Object} Comprehensive health report
   */
  async runFullHealthCheck() {
    const startTime = Date.now();

    const [layerResults, dependencyResults] = await Promise.all([
      this.checkLayers(),
      this.checkDependencies()
    ]);

    const allResults = [...layerResults, ...dependencyResults];

    // Calculate overall status
    const hasUnhealthy = allResults.some(r => r.status === HealthStatus.UNHEALTHY);
    const hasDegraded = allResults.some(r => r.status === HealthStatus.DEGRADED);

    let overallStatus = HealthStatus.HEALTHY;
    if (hasUnhealthy) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (hasDegraded) {
      overallStatus = HealthStatus.DEGRADED;
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      layers: layerResults,
      dependencies: dependencyResults,
      summary: {
        total: allResults.length,
        healthy: allResults.filter(r => r.status === HealthStatus.HEALTHY).length,
        degraded: allResults.filter(r => r.status === HealthStatus.DEGRADED).length,
        unhealthy: allResults.filter(r => r.status === HealthStatus.UNHEALTHY).length,
        unknown: allResults.filter(r => r.status === HealthStatus.UNKNOWN).length
      }
    };
  }

  /**
   * Kubernetes-style liveness probe
   * Returns true if the system is alive (not deadlocked)
   *
   * @returns {Object}
   */
  async livenessProbe() {
    const eventLoopCheck = await this.runCheck('liveness:eventLoop', DEPENDENCY_CHECKS.eventLoop);

    return {
      alive: eventLoopCheck.status !== HealthStatus.UNHEALTHY,
      status: eventLoopCheck.status,
      timestamp: new Date().toISOString(),
      details: eventLoopCheck
    };
  }

  /**
   * Kubernetes-style readiness probe
   * Returns true if the system is ready to accept traffic
   *
   * @returns {Object}
   */
  async readinessProbe() {
    const criticalChecks = await Promise.all([
      this.runCheck('readiness:memory', DEPENDENCY_CHECKS.memory),
      this.runCheck('readiness:geminiApi', DEPENDENCY_CHECKS.geminiApi)
    ]);

    const allHealthy = criticalChecks.every(
      c => c.status === HealthStatus.HEALTHY || c.status === HealthStatus.DEGRADED
    );

    return {
      ready: allHealthy,
      status: allHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      checks: criticalChecks
    };
  }

  /**
   * Start periodic health checks
   *
   * @param {Function} callback - Called with results
   */
  startPeriodicChecks(callback = null) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      const results = await this.runFullHealthCheck();

      if (callback) {
        callback(results);
      }
    }, this.config.interval);
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get last known results
   *
   * @returns {Object}
   */
  getLastResults() {
    const results = {};
    for (const [name, result] of this.lastResults) {
      results[name] = result;
    }
    return results;
  }
}

// Singleton instance
let _healthManager = null;

/**
 * Get or create singleton health manager
 * @param {HealthConfig} config - Configuration
 * @returns {HealthCheckManager}
 */
export function getHealthManager(config = {}) {
  if (!_healthManager) {
    _healthManager = new HealthCheckManager(config);
  }
  return _healthManager;
}

/**
 * Reset health manager (for testing)
 */
export function resetHealthManager() {
  if (_healthManager) {
    _healthManager.stopPeriodicChecks();
  }
  _healthManager = null;
}

export default HealthCheckManager;
