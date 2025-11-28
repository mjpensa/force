/**
 * Observability Layer - PROMPT ML Layer 7
 *
 * Unified export and orchestration for observability:
 * - Distributed tracing
 * - Structured event logging
 * - LLM metrics collection
 * - Combined observability pipeline
 *
 * Based on PROMPT ML design specification.
 */

// Tracer exports
export {
  Tracer,
  Trace,
  Span,
  SpanStatus,
  SpanKind,
  LayerSpan,
  Attributes,
  getTracer,
  resetTracer,
  createChildSpan,
  consoleExporter
} from './tracer.js';

// Event logger exports
export {
  EventLogger,
  LogLevel,
  EventCategory,
  getEventLogger,
  resetEventLogger,
  consoleHandler,
  jsonHandler
} from './event-logger.js';

// Metrics collector exports
export {
  LLMMetricsCollector,
  MetricType,
  getMetricsCollector,
  resetMetricsCollector,
  COST_RATES
} from './metrics-collector.js';

import { getTracer, SpanKind, SpanStatus, LayerSpan, Attributes, createChildSpan } from './tracer.js';
import { getEventLogger, EventCategory } from './event-logger.js';
import { getMetricsCollector, COST_RATES } from './metrics-collector.js';

/**
 * @typedef {Object} ObservabilityConfig
 * @property {boolean} enableTracing - Enable distributed tracing
 * @property {boolean} enableLogging - Enable event logging
 * @property {boolean} enableMetrics - Enable metrics collection
 * @property {number} samplingRate - Trace sampling rate (0-1)
 */

const DEFAULT_CONFIG = {
  enableTracing: true,
  enableLogging: true,
  enableMetrics: true,
  samplingRate: 1.0
};

/**
 * Observability Pipeline class
 * Orchestrates tracing, logging, and metrics collection
 */
export class ObservabilityPipeline {
  /**
   * @param {ObservabilityConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Lazy-load components
    this._tracer = null;
    this._logger = null;
    this._metrics = null;
  }

  /**
   * Get tracer instance
   */
  get tracer() {
    if (!this._tracer && this.config.enableTracing) {
      this._tracer = getTracer({ samplingRate: this.config.samplingRate });
    }
    return this._tracer;
  }

  /**
   * Get logger instance
   */
  get logger() {
    if (!this._logger && this.config.enableLogging) {
      this._logger = getEventLogger();
    }
    return this._logger;
  }

  /**
   * Get metrics collector instance
   */
  get metrics() {
    if (!this._metrics && this.config.enableMetrics) {
      this._metrics = getMetricsCollector();
    }
    return this._metrics;
  }

  /**
   * Start observing a generation request
   *
   * @param {Object} request - Request details
   * @returns {Object} Observation context
   */
  startRequest(request) {
    const { sessionId, contentTypes, userPrompt, fileCount } = request;

    // Start trace
    let trace = null;
    let rootSpan = null;

    if (this.config.enableTracing && this.tracer) {
      const result = this.tracer.startTrace('generate-content', {
        sessionId,
        kind: SpanKind.SERVER
      });
      trace = result.trace;
      rootSpan = result.rootSpan;

      if (rootSpan) {
        rootSpan.setAttributes({
          [Attributes.SESSION_ID]: sessionId,
          [Attributes.CONTENT_TYPE]: contentTypes?.join(',') || 'all',
          'request.file_count': fileCount,
          'request.prompt_length': userPrompt?.length || 0
        });
      }
    }

    // Log request start
    if (this.config.enableLogging && this.logger) {
      this.logger.logRequestStart({
        traceId: trace?.traceId,
        sessionId,
        contentTypes,
        fileCount,
        promptLength: userPrompt?.length || 0
      });
    }

    // Track active request in metrics
    if (this.config.enableMetrics && this.metrics) {
      for (const ct of (contentTypes || ['all'])) {
        this.metrics.startRequest(ct.toLowerCase());
      }
    }

    return {
      trace,
      rootSpan,
      traceId: trace?.traceId,
      sessionId,
      startTime: Date.now(),
      contentTypes: contentTypes || []
    };
  }

  /**
   * End observing a generation request
   *
   * @param {Object} context - Observation context from startRequest
   * @param {Object} result - Request result
   */
  async endRequest(context, result) {
    const { trace, rootSpan, traceId, sessionId, startTime, contentTypes } = context;
    const durationMs = Date.now() - startTime;

    // End root span
    if (rootSpan) {
      rootSpan.setAttributes({
        'request.duration_ms': durationMs,
        'request.success': result.success !== false
      });

      if (result.error) {
        rootSpan.recordException(new Error(result.error));
      } else {
        rootSpan.setStatus(SpanStatus.OK);
      }

      rootSpan.end();
    }

    // End trace
    if (trace && this.tracer) {
      await this.tracer.endTrace(traceId);
    }

    // Log request completion
    if (this.config.enableLogging && this.logger) {
      this.logger.logRequestComplete(
        { traceId, sessionId },
        {
          durationMs,
          success: result.success !== false,
          contentTypesGenerated: result.contentTypes || contentTypes,
          cached: result.cached
        }
      );
    }

    // Record request metrics
    if (this.config.enableMetrics && this.metrics) {
      for (const ct of contentTypes) {
        const ctLower = ct.toLowerCase();
        this.metrics.endRequest(ctLower);
        this.metrics.recordRequest({
          contentType: ctLower,
          status: result.success !== false ? 'success' : 'error',
          durationMs,
          cached: result.cached
        });
      }
    }
  }

  /**
   * Observe a PROMPT ML layer execution
   *
   * @param {string} layerName - Layer name from LayerSpan
   * @param {Object} context - Parent context
   * @param {Function} fn - Function to execute
   * @returns {Promise<Object>} Layer result with span
   */
  async observeLayer(layerName, context, fn) {
    const { trace, traceId } = context;
    let span = null;

    // Create child span
    if (trace) {
      span = createChildSpan(trace, context.currentSpan || context.rootSpan, layerName);
      span?.setAttribute(Attributes.LAYER_NAME, layerName);
    }

    // Log layer entry
    if (this.config.enableLogging && this.logger) {
      this.logger.logLayerEntry(layerName, { traceId, spanId: span?.context.spanId });
    }

    const layerStart = Date.now();

    try {
      // Execute layer function
      const result = await fn({ span, traceId });

      const durationMs = Date.now() - layerStart;

      // Record layer metrics
      if (this.config.enableMetrics && this.metrics) {
        this.metrics.recordLayerDuration(layerName, durationMs);
      }

      // End span successfully
      if (span) {
        span.setAttribute('layer.duration_ms', durationMs);
        span.setStatus(SpanStatus.OK);
        span.end();
      }

      // Log layer exit
      if (this.config.enableLogging && this.logger) {
        this.logger.logLayerExit(layerName, { traceId, spanId: span?.context.spanId }, {
          durationMs,
          success: true
        });
      }

      return { ...result, span, durationMs };

    } catch (error) {
      const durationMs = Date.now() - layerStart;

      // Record error in span
      if (span) {
        span.recordException(error);
        span.end();
      }

      // Log layer error
      if (this.config.enableLogging && this.logger) {
        this.logger.logError(error, {
          traceId,
          spanId: span?.context.spanId,
          operation: layerName
        });
      }

      throw error;
    }
  }

  /**
   * Observe an LLM call
   *
   * @param {Object} context - Parent context
   * @param {Object} details - Call details
   */
  observeLLMCall(context, details) {
    const { traceId } = context;
    const {
      model, contentType, durationMs,
      promptTokens, completionTokens, totalTokens,
      cached
    } = details;

    // Log LLM call
    if (this.config.enableLogging && this.logger) {
      this.logger.logLLMCall({
        traceId,
        model,
        contentType,
        promptTokens,
        completionTokens,
        totalTokens,
        durationMs,
        cached
      });
    }

    // Record token metrics
    if (this.config.enableMetrics && this.metrics) {
      this.metrics.recordTokens({
        contentType: contentType?.toLowerCase(),
        promptTokens,
        completionTokens,
        totalTokens
      });

      // Estimate cost
      const rate = COST_RATES[model] || COST_RATES['gemini-1.5-flash'];
      if (rate && totalTokens) {
        this.metrics.recordCost({
          contentType: contentType?.toLowerCase(),
          model,
          tokens: totalTokens,
          costPerMillionTokens: (rate.input + rate.output) / 2
        });
      }
    }
  }

  /**
   * Observe validation results
   *
   * @param {Object} context - Parent context
   * @param {Object} validation - Validation result
   */
  observeValidation(context, validation) {
    const { traceId, contentType } = context;

    // Log validation
    if (this.config.enableLogging && this.logger) {
      this.logger.logValidation({
        traceId,
        valid: validation.valid,
        safe: validation.safe,
        qualityGrade: validation.quality?.grade,
        qualityScore: validation.quality?.score,
        errors: validation.errors,
        concerns: validation.concerns
      });
    }

    // Record validation metrics
    if (this.config.enableMetrics && this.metrics) {
      const ct = contentType?.toLowerCase();

      this.metrics.recordValidation({
        contentType: ct,
        valid: validation.valid,
        errors: validation.errors
      });

      if (validation.quality) {
        this.metrics.recordQuality({
          contentType: ct,
          overall: validation.quality.score,
          grade: validation.quality.grade
        });
      }

      if (validation.safe !== undefined) {
        this.metrics.recordSafety({
          contentType: ct,
          safe: validation.safe,
          concerns: validation.concerns
        });
      }
    }
  }

  /**
   * Record an error
   *
   * @param {Object} context - Context
   * @param {Error} error - Error object
   */
  observeError(context, error) {
    const { traceId, sessionId, contentType } = context;

    // Log error
    if (this.config.enableLogging && this.logger) {
      this.logger.logError(error, {
        traceId,
        sessionId,
        contentType
      });
    }

    // Record error metric
    if (this.config.enableMetrics && this.metrics) {
      this.metrics.recordError(
        contentType?.toLowerCase() || 'unknown',
        error.name || 'Error'
      );
    }
  }

  /**
   * Get observability summary
   *
   * @returns {Object} Summary of all observability data
   */
  getSummary() {
    return {
      tracing: this.tracer ? this.tracer.getStats() : null,
      metrics: this.metrics ? this.metrics.getSummary() : null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get recent traces
   *
   * @param {number} count - Number of traces
   * @returns {Array} Recent traces
   */
  getRecentTraces(count = 10) {
    return this.tracer ? this.tracer.getCompletedTraces(count) : [];
  }

  /**
   * Get metrics in Prometheus format
   *
   * @returns {string} Prometheus-formatted metrics
   */
  getPrometheusMetrics() {
    return this.metrics ? this.metrics.toPrometheusFormat() : '';
  }

  /**
   * Shutdown observability pipeline
   */
  shutdown() {
    if (this._logger) {
      this._logger.shutdown();
    }
  }
}

// Singleton instance
let _pipeline = null;

/**
 * Get or create singleton observability pipeline
 * @param {ObservabilityConfig} config - Configuration (only used on first call)
 * @returns {ObservabilityPipeline}
 */
export function getObservabilityPipeline(config = {}) {
  if (!_pipeline) {
    _pipeline = new ObservabilityPipeline(config);
  }
  return _pipeline;
}

/**
 * Reset pipeline instance (for testing)
 */
export function resetObservabilityPipeline() {
  if (_pipeline) {
    _pipeline.shutdown();
  }
  _pipeline = null;
}

/**
 * Quick helper to start observing a request
 *
 * @param {Object} request - Request details
 * @returns {Object} Observation context
 */
export function startObserving(request) {
  return getObservabilityPipeline().startRequest(request);
}

/**
 * Quick helper to end observing a request
 *
 * @param {Object} context - Observation context
 * @param {Object} result - Request result
 */
export async function endObserving(context, result) {
  return getObservabilityPipeline().endRequest(context, result);
}

export default ObservabilityPipeline;
