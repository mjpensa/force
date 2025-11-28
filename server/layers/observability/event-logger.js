/**
 * Event Logger - PROMPT ML Layer 7
 *
 * Structured event logging for LLM operations:
 * - Consistent event schema
 * - Log levels with filtering
 * - Event batching and buffering
 * - Multiple output destinations
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Log levels
 * @readonly
 * @enum {number}
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

/**
 * Log level names
 */
const LOG_LEVEL_NAMES = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL'
};

/**
 * Event categories for LLM operations
 * @readonly
 * @enum {string}
 */
export const EventCategory = {
  REQUEST: 'request',           // Incoming requests
  LAYER: 'layer',               // PROMPT ML layer events
  LLM: 'llm',                   // LLM API interactions
  VALIDATION: 'validation',     // Output validation
  SAFETY: 'safety',             // Safety checks
  PERFORMANCE: 'performance',   // Performance metrics
  ERROR: 'error',               // Errors and exceptions
  SYSTEM: 'system'              // System events
};

/**
 * @typedef {Object} LogEvent
 * @property {string} timestamp - ISO timestamp
 * @property {number} level - Log level
 * @property {string} levelName - Log level name
 * @property {string} category - Event category
 * @property {string} event - Event name
 * @property {string} message - Human-readable message
 * @property {Object} context - Event context (traceId, spanId, sessionId)
 * @property {Object} data - Event-specific data
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} EventLoggerConfig
 * @property {number} minLevel - Minimum log level to record
 * @property {boolean} includeStackTrace - Include stack traces for errors
 * @property {boolean} bufferEvents - Buffer events before flushing
 * @property {number} bufferSize - Max buffer size before auto-flush
 * @property {number} flushIntervalMs - Auto-flush interval
 */

const DEFAULT_CONFIG = {
  minLevel: LogLevel.INFO,
  includeStackTrace: true,
  bufferEvents: true,
  bufferSize: 100,
  flushIntervalMs: 5000
};

/**
 * Event Logger class
 */
export class EventLogger {
  /**
   * @param {EventLoggerConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.buffer = [];
    this.handlers = [];
    this.flushInterval = null;

    // Start auto-flush if buffering enabled
    if (this.config.bufferEvents && this.config.flushIntervalMs > 0) {
      this.startAutoFlush();
    }
  }

  /**
   * Log an event
   * @param {number} level - Log level
   * @param {string} category - Event category
   * @param {string} event - Event name
   * @param {string} message - Human-readable message
   * @param {Object} options - Additional options
   * @returns {LogEvent|null} The logged event or null if filtered
   */
  log(level, category, event, message, options = {}) {
    // Filter by minimum level
    if (level < this.config.minLevel) {
      return null;
    }

    const logEvent = {
      timestamp: new Date().toISOString(),
      level,
      levelName: LOG_LEVEL_NAMES[level],
      category,
      event,
      message,
      context: {
        traceId: options.traceId || null,
        spanId: options.spanId || null,
        sessionId: options.sessionId || null
      },
      data: options.data || {},
      metadata: {
        service: 'force-api',
        ...options.metadata
      }
    };

    // Add error info if present
    if (options.error) {
      logEvent.error = {
        name: options.error.name,
        message: options.error.message,
        stack: this.config.includeStackTrace ? options.error.stack : undefined
      };
    }

    // Buffer or dispatch immediately
    if (this.config.bufferEvents) {
      this.buffer.push(logEvent);
      if (this.buffer.length >= this.config.bufferSize) {
        this.flush();
      }
    } else {
      this._dispatch(logEvent);
    }

    return logEvent;
  }

  /**
   * Convenience methods for each log level
   */
  debug(category, event, message, options = {}) {
    return this.log(LogLevel.DEBUG, category, event, message, options);
  }

  info(category, event, message, options = {}) {
    return this.log(LogLevel.INFO, category, event, message, options);
  }

  warn(category, event, message, options = {}) {
    return this.log(LogLevel.WARN, category, event, message, options);
  }

  error(category, event, message, options = {}) {
    return this.log(LogLevel.ERROR, category, event, message, options);
  }

  fatal(category, event, message, options = {}) {
    return this.log(LogLevel.FATAL, category, event, message, options);
  }

  /**
   * Log a request start event
   * @param {Object} request - Request details
   * @returns {LogEvent}
   */
  logRequestStart(request) {
    return this.info(EventCategory.REQUEST, 'request.start', 'Request started', {
      traceId: request.traceId,
      sessionId: request.sessionId,
      data: {
        contentTypes: request.contentTypes,
        fileCount: request.fileCount,
        promptLength: request.promptLength
      }
    });
  }

  /**
   * Log a request completion event
   * @param {Object} request - Request details
   * @param {Object} result - Result details
   * @returns {LogEvent}
   */
  logRequestComplete(request, result) {
    return this.info(EventCategory.REQUEST, 'request.complete', 'Request completed', {
      traceId: request.traceId,
      sessionId: request.sessionId,
      data: {
        durationMs: result.durationMs,
        success: result.success,
        contentTypesGenerated: result.contentTypesGenerated,
        cached: result.cached || false
      }
    });
  }

  /**
   * Log a layer entry event
   * @param {string} layerName - Layer name
   * @param {Object} context - Context with traceId, spanId
   * @returns {LogEvent}
   */
  logLayerEntry(layerName, context = {}) {
    return this.debug(EventCategory.LAYER, 'layer.entry', `Entering ${layerName}`, {
      traceId: context.traceId,
      spanId: context.spanId,
      data: { layerName }
    });
  }

  /**
   * Log a layer exit event
   * @param {string} layerName - Layer name
   * @param {Object} context - Context
   * @param {Object} result - Layer result
   * @returns {LogEvent}
   */
  logLayerExit(layerName, context = {}, result = {}) {
    return this.debug(EventCategory.LAYER, 'layer.exit', `Exiting ${layerName}`, {
      traceId: context.traceId,
      spanId: context.spanId,
      data: {
        layerName,
        durationMs: result.durationMs,
        success: result.success !== false
      }
    });
  }

  /**
   * Log an LLM call event
   * @param {Object} details - Call details
   * @returns {LogEvent}
   */
  logLLMCall(details) {
    return this.info(EventCategory.LLM, 'llm.call', `LLM call to ${details.model}`, {
      traceId: details.traceId,
      spanId: details.spanId,
      data: {
        model: details.model,
        provider: details.provider || 'gemini',
        contentType: details.contentType,
        promptTokens: details.promptTokens,
        completionTokens: details.completionTokens,
        totalTokens: details.totalTokens,
        durationMs: details.durationMs,
        cached: details.cached || false
      }
    });
  }

  /**
   * Log a validation result event
   * @param {Object} details - Validation details
   * @returns {LogEvent}
   */
  logValidation(details) {
    const level = details.valid ? LogLevel.INFO : LogLevel.WARN;
    return this.log(level, EventCategory.VALIDATION, 'validation.result',
      details.valid ? 'Validation passed' : 'Validation issues detected', {
        traceId: details.traceId,
        spanId: details.spanId,
        data: {
          valid: details.valid,
          safe: details.safe,
          qualityGrade: details.qualityGrade,
          qualityScore: details.qualityScore,
          errorCount: details.errors?.length || 0,
          concernCount: details.concerns?.length || 0
        }
      });
  }

  /**
   * Log a safety check event
   * @param {Object} details - Safety check details
   * @returns {LogEvent}
   */
  logSafetyCheck(details) {
    const level = details.safe ? LogLevel.INFO : LogLevel.WARN;
    return this.log(level, EventCategory.SAFETY, 'safety.check',
      details.safe ? 'Safety check passed' : 'Safety concerns detected', {
        traceId: details.traceId,
        spanId: details.spanId,
        data: {
          safe: details.safe,
          level: details.level,
          concernCategories: details.concernCategories,
          piiDetected: details.piiDetected || false
        }
      });
  }

  /**
   * Log a performance metric event
   * @param {Object} details - Performance details
   * @returns {LogEvent}
   */
  logPerformance(details) {
    return this.info(EventCategory.PERFORMANCE, 'performance.metric', 'Performance recorded', {
      traceId: details.traceId,
      data: {
        operation: details.operation,
        durationMs: details.durationMs,
        tokensUsed: details.tokensUsed,
        cacheHit: details.cacheHit,
        contentType: details.contentType
      }
    });
  }

  /**
   * Log an error event
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {LogEvent}
   */
  logError(error, context = {}) {
    return this.error(EventCategory.ERROR, 'error.occurred', error.message, {
      traceId: context.traceId,
      spanId: context.spanId,
      sessionId: context.sessionId,
      error,
      data: {
        errorType: error.name,
        operation: context.operation,
        contentType: context.contentType
      }
    });
  }

  /**
   * Register an event handler
   * @param {Function} handler - Handler function (event) => void
   */
  addHandler(handler) {
    this.handlers.push(handler);
  }

  /**
   * Remove an event handler
   * @param {Function} handler - Handler to remove
   */
  removeHandler(handler) {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Flush buffered events
   */
  flush() {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    for (const event of events) {
      this._dispatch(event);
    }
  }

  /**
   * Start automatic flush interval
   */
  startAutoFlush() {
    if (this.flushInterval) return;

    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop automatic flush interval
   */
  stopAutoFlush() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Shutdown logger (flush and stop)
   */
  shutdown() {
    this.flush();
    this.stopAutoFlush();
  }

  /**
   * Dispatch event to handlers
   * @private
   */
  _dispatch(event) {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[EventLogger] Handler error:', error.message);
      }
    }
  }
}

/**
 * Console handler for development
 * @param {LogEvent} event - Event to log
 */
export function consoleHandler(event) {
  const prefix = `[${event.levelName}] [${event.category}]`;
  const contextStr = event.context.traceId
    ? ` (trace: ${event.context.traceId.substring(0, 8)}...)`
    : '';

  const line = `${event.timestamp} ${prefix}${contextStr} ${event.event}: ${event.message}`;

  switch (event.level) {
    case LogLevel.DEBUG:
      console.debug(line);
      break;
    case LogLevel.INFO:
      console.info(line);
      break;
    case LogLevel.WARN:
      console.warn(line);
      break;
    case LogLevel.ERROR:
    case LogLevel.FATAL:
      console.error(line);
      if (event.error?.stack) {
        console.error(event.error.stack);
      }
      break;
  }
}

/**
 * JSON handler for structured logging
 * @param {LogEvent} event - Event to log
 */
export function jsonHandler(event) {
  console.log(JSON.stringify(event));
}

// Singleton instance
let _logger = null;

/**
 * Get or create singleton event logger
 * @param {EventLoggerConfig} config - Configuration (only used on first call)
 * @returns {EventLogger}
 */
export function getEventLogger(config = {}) {
  if (!_logger) {
    _logger = new EventLogger(config);

    // Add default console handler in development
    if (process.env.NODE_ENV !== 'production') {
      _logger.addHandler(consoleHandler);
    } else {
      _logger.addHandler(jsonHandler);
    }
  }
  return _logger;
}

/**
 * Reset logger instance (for testing)
 */
export function resetEventLogger() {
  if (_logger) {
    _logger.shutdown();
  }
  _logger = null;
}

export default EventLogger;
