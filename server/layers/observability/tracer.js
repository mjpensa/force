/**
 * Distributed Tracer - PROMPT ML Layer 7
 *
 * Provides distributed tracing for LLM request flows:
 * - Trace context propagation
 * - Span management for each layer
 * - Parent-child span relationships
 * - Trace export for external systems
 *
 * Based on PROMPT ML design specification.
 */

import { randomUUID } from 'crypto';

/**
 * Span status codes
 * @readonly
 * @enum {string}
 */
export const SpanStatus = {
  UNSET: 'unset',
  OK: 'ok',
  ERROR: 'error'
};

/**
 * Span kinds for categorization
 * @readonly
 * @enum {string}
 */
export const SpanKind = {
  INTERNAL: 'internal',      // Internal operation
  CLIENT: 'client',          // Outbound request (e.g., to Gemini)
  SERVER: 'server',          // Inbound request
  PRODUCER: 'producer',      // Message producer
  CONSUMER: 'consumer'       // Message consumer
};

/**
 * @typedef {Object} SpanContext
 * @property {string} traceId - Unique trace identifier
 * @property {string} spanId - Unique span identifier
 * @property {string|null} parentSpanId - Parent span ID
 * @property {boolean} sampled - Whether trace is sampled
 */

/**
 * @typedef {Object} SpanData
 * @property {string} name - Span name
 * @property {SpanContext} context - Span context
 * @property {SpanKind} kind - Span kind
 * @property {number} startTime - Start timestamp (ms)
 * @property {number} endTime - End timestamp (ms)
 * @property {number} duration - Duration (ms)
 * @property {SpanStatus} status - Span status
 * @property {Object} attributes - Span attributes
 * @property {Array} events - Span events
 * @property {Array} links - Links to other spans
 */

/**
 * Span class - represents a unit of work
 */
export class Span {
  /**
   * @param {string} name - Span name
   * @param {SpanContext} context - Span context
   * @param {SpanKind} kind - Span kind
   */
  constructor(name, context, kind = SpanKind.INTERNAL) {
    this.name = name;
    this.context = context;
    this.kind = kind;
    this.startTime = Date.now();
    this.endTime = null;
    this.status = SpanStatus.UNSET;
    this.statusMessage = null;
    this.attributes = {};
    this.events = [];
    this.links = [];
    this._ended = false;
  }

  /**
   * Set an attribute on the span
   * @param {string} key - Attribute key
   * @param {*} value - Attribute value
   * @returns {Span} This span for chaining
   */
  setAttribute(key, value) {
    if (!this._ended) {
      this.attributes[key] = value;
    }
    return this;
  }

  /**
   * Set multiple attributes
   * @param {Object} attrs - Attributes object
   * @returns {Span} This span for chaining
   */
  setAttributes(attrs) {
    if (!this._ended) {
      Object.assign(this.attributes, attrs);
    }
    return this;
  }

  /**
   * Add an event to the span
   * @param {string} name - Event name
   * @param {Object} attributes - Event attributes
   * @returns {Span} This span for chaining
   */
  addEvent(name, attributes = {}) {
    if (!this._ended) {
      this.events.push({
        name,
        timestamp: Date.now(),
        attributes
      });
    }
    return this;
  }

  /**
   * Set span status
   * @param {SpanStatus} status - Status code
   * @param {string} message - Optional status message
   * @returns {Span} This span for chaining
   */
  setStatus(status, message = null) {
    if (!this._ended) {
      this.status = status;
      this.statusMessage = message;
    }
    return this;
  }

  /**
   * Record an exception
   * @param {Error} error - Exception to record
   * @returns {Span} This span for chaining
   */
  recordException(error) {
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack
    });
    this.setStatus(SpanStatus.ERROR, error.message);
    return this;
  }

  /**
   * End the span
   * @param {number} endTime - Optional end timestamp
   */
  end(endTime = null) {
    if (this._ended) return;

    this.endTime = endTime || Date.now();
    this._ended = true;

    // If status not set, mark as OK
    if (this.status === SpanStatus.UNSET) {
      this.status = SpanStatus.OK;
    }
  }

  /**
   * Get span duration
   * @returns {number} Duration in milliseconds
   */
  get duration() {
    if (this.endTime) {
      return this.endTime - this.startTime;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Check if span is recording
   * @returns {boolean}
   */
  isRecording() {
    return !this._ended;
  }

  /**
   * Export span data
   * @returns {SpanData}
   */
  toJSON() {
    return {
      name: this.name,
      context: this.context,
      kind: this.kind,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      status: this.status,
      statusMessage: this.statusMessage,
      attributes: this.attributes,
      events: this.events,
      links: this.links
    };
  }
}

/**
 * Trace class - represents a complete request flow
 */
export class Trace {
  /**
   * @param {string} traceId - Trace identifier
   */
  constructor(traceId = null) {
    this.traceId = traceId || randomUUID();
    this.spans = new Map();
    this.rootSpan = null;
    this.startTime = Date.now();
    this.metadata = {};
  }

  /**
   * Create a new span in this trace
   * @param {string} name - Span name
   * @param {Object} options - Span options
   * @returns {Span} New span
   */
  createSpan(name, options = {}) {
    const spanId = randomUUID();
    const context = {
      traceId: this.traceId,
      spanId,
      parentSpanId: options.parentSpanId || (this.rootSpan?.context.spanId) || null,
      sampled: true
    };

    const span = new Span(name, context, options.kind || SpanKind.INTERNAL);
    this.spans.set(spanId, span);

    // First span becomes root
    if (!this.rootSpan) {
      this.rootSpan = span;
    }

    return span;
  }

  /**
   * Get a span by ID
   * @param {string} spanId - Span ID
   * @returns {Span|null}
   */
  getSpan(spanId) {
    return this.spans.get(spanId) || null;
  }

  /**
   * Get all spans
   * @returns {Array<Span>}
   */
  getAllSpans() {
    return Array.from(this.spans.values());
  }

  /**
   * Set trace metadata
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   */
  setMetadata(key, value) {
    this.metadata[key] = value;
  }

  /**
   * Get trace duration
   * @returns {number} Duration in milliseconds
   */
  get duration() {
    if (this.rootSpan?.endTime) {
      return this.rootSpan.endTime - this.startTime;
    }
    return Date.now() - this.startTime;
  }

  /**
   * End the trace (ends all open spans)
   */
  end() {
    for (const span of this.spans.values()) {
      if (span.isRecording()) {
        span.end();
      }
    }
  }

  /**
   * Export trace data
   * @returns {Object}
   */
  toJSON() {
    return {
      traceId: this.traceId,
      startTime: this.startTime,
      duration: this.duration,
      metadata: this.metadata,
      spanCount: this.spans.size,
      spans: this.getAllSpans().map(s => s.toJSON())
    };
  }
}

/**
 * Tracer class - creates and manages traces
 */
export class Tracer {
  /**
   * @param {Object} config - Tracer configuration
   */
  constructor(config = {}) {
    this.serviceName = config.serviceName || 'force-api';
    this.version = config.version || '1.0.0';
    this.activeTraces = new Map();
    this.completedTraces = [];
    this.maxCompletedTraces = config.maxCompletedTraces || 100;
    this.exporters = [];
    this.samplingRate = config.samplingRate || 1.0; // 100% by default
  }

  /**
   * Start a new trace
   * @param {string} name - Root span name
   * @param {Object} options - Trace options
   * @returns {Object} {trace, rootSpan}
   */
  startTrace(name, options = {}) {
    // Check sampling
    if (Math.random() > this.samplingRate) {
      return { trace: null, rootSpan: null, sampled: false };
    }

    const trace = new Trace(options.traceId);
    trace.setMetadata('service.name', this.serviceName);
    trace.setMetadata('service.version', this.version);

    if (options.sessionId) {
      trace.setMetadata('session.id', options.sessionId);
    }

    const rootSpan = trace.createSpan(name, {
      kind: options.kind || SpanKind.SERVER
    });

    this.activeTraces.set(trace.traceId, trace);

    return { trace, rootSpan, sampled: true };
  }

  /**
   * Get an active trace
   * @param {string} traceId - Trace ID
   * @returns {Trace|null}
   */
  getTrace(traceId) {
    return this.activeTraces.get(traceId) || null;
  }

  /**
   * End a trace and export it
   * @param {string} traceId - Trace ID
   */
  async endTrace(traceId) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    trace.end();
    this.activeTraces.delete(traceId);

    // Store in completed traces
    this.completedTraces.push(trace.toJSON());
    if (this.completedTraces.length > this.maxCompletedTraces) {
      this.completedTraces.shift();
    }

    // Export to all registered exporters
    for (const exporter of this.exporters) {
      try {
        await exporter.export(trace.toJSON());
      } catch (error) {
        console.error(`[Tracer] Export failed: ${error.message}`);
      }
    }
  }

  /**
   * Register a trace exporter
   * @param {Object} exporter - Exporter with export(trace) method
   */
  registerExporter(exporter) {
    this.exporters.push(exporter);
  }

  /**
   * Get completed traces
   * @param {number} count - Number of traces to return
   * @returns {Array}
   */
  getCompletedTraces(count = 10) {
    return this.completedTraces.slice(-count);
  }

  /**
   * Get active trace count
   * @returns {number}
   */
  getActiveTraceCount() {
    return this.activeTraces.size;
  }

  /**
   * Get tracer statistics
   * @returns {Object}
   */
  getStats() {
    const completed = this.completedTraces;
    const durations = completed.map(t => t.duration);

    return {
      activeTraces: this.activeTraces.size,
      completedTraces: completed.length,
      samplingRate: this.samplingRate,
      stats: durations.length > 0 ? {
        avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        avgSpanCount: Math.round(
          completed.reduce((a, t) => a + t.spanCount, 0) / completed.length
        )
      } : null
    };
  }
}

/**
 * PROMPT ML Layer Names for spans
 */
export const LayerSpan = {
  INPUT_SAFETY: 'prompt-ml.input-safety',
  CONTEXT_ENGINEERING: 'prompt-ml.context-engineering',
  SIGNATURES: 'prompt-ml.signatures',
  MODEL_ROUTING: 'prompt-ml.model-routing',
  LLM_CALL: 'prompt-ml.llm-call',
  OUTPUT_VALIDATION: 'prompt-ml.output-validation',
  OBSERVABILITY: 'prompt-ml.observability'
};

/**
 * Standard attribute keys for PROMPT ML
 */
export const Attributes = {
  // Request attributes
  REQUEST_ID: 'request.id',
  SESSION_ID: 'session.id',
  USER_PROMPT: 'user.prompt',
  CONTENT_TYPE: 'content.type',

  // LLM attributes
  LLM_MODEL: 'llm.model',
  LLM_PROVIDER: 'llm.provider',
  LLM_PROMPT_TOKENS: 'llm.prompt_tokens',
  LLM_COMPLETION_TOKENS: 'llm.completion_tokens',
  LLM_TOTAL_TOKENS: 'llm.total_tokens',
  LLM_TEMPERATURE: 'llm.temperature',

  // Layer attributes
  LAYER_NAME: 'layer.name',
  LAYER_VERSION: 'layer.version',

  // Context attributes
  CONTEXT_TOKEN_BUDGET: 'context.token_budget',
  CONTEXT_TOKENS_USED: 'context.tokens_used',
  CONTEXT_COMPRESSION_APPLIED: 'context.compression_applied',

  // Validation attributes
  VALIDATION_VALID: 'validation.valid',
  VALIDATION_SAFE: 'validation.safe',
  VALIDATION_QUALITY_GRADE: 'validation.quality_grade',
  VALIDATION_QUALITY_SCORE: 'validation.quality_score',

  // Error attributes
  ERROR_TYPE: 'error.type',
  ERROR_MESSAGE: 'error.message'
};

// Singleton tracer instance
let _tracer = null;

/**
 * Get or create singleton tracer
 * @param {Object} config - Configuration (only used on first call)
 * @returns {Tracer}
 */
export function getTracer(config = {}) {
  if (!_tracer) {
    _tracer = new Tracer(config);
  }
  return _tracer;
}

/**
 * Reset tracer instance (for testing)
 */
export function resetTracer() {
  _tracer = null;
}

/**
 * Console exporter for development
 */
export const consoleExporter = {
  async export(trace) {
    console.log(JSON.stringify({
      type: 'trace',
      ...trace
    }, null, 2));
  }
};

/**
 * Create a child span helper
 * @param {Trace} trace - Parent trace
 * @param {Span} parentSpan - Parent span
 * @param {string} name - Child span name
 * @param {SpanKind} kind - Span kind
 * @returns {Span}
 */
export function createChildSpan(trace, parentSpan, name, kind = SpanKind.INTERNAL) {
  if (!trace) return null;

  return trace.createSpan(name, {
    parentSpanId: parentSpan?.context.spanId,
    kind
  });
}

export default Tracer;
