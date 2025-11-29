/**
 * Training Error Categorization System
 *
 * Distinguishes between LLM output failures, API issues, and system bugs
 * to ensure training data integrity and enable proper error handling.
 */

// =============================================================================
// ERROR CATEGORIES
// =============================================================================

export const ErrorCategory = {
  // LLM Output Errors (E0xx) - Problems with what the LLM returned
  LLM_PARSE_ERROR: 'LLM_PARSE_ERROR',         // E001: Invalid JSON returned
  LLM_SCHEMA_ERROR: 'LLM_SCHEMA_ERROR',       // E002: Missing required fields
  LLM_QUALITY_ERROR: 'LLM_QUALITY_ERROR',     // E003: Content quality below threshold
  LLM_EMPTY_ERROR: 'LLM_EMPTY_ERROR',         // E004: Empty or minimal content

  // API Errors (E1xx) - Problems with the API call itself
  API_RATE_LIMIT: 'API_RATE_LIMIT',           // E101: Rate limit exceeded
  API_TIMEOUT: 'API_TIMEOUT',                 // E102: Request timed out
  API_QUOTA_ERROR: 'API_QUOTA_ERROR',         // E103: Quota exhausted
  API_NETWORK_ERROR: 'API_NETWORK_ERROR',     // E104: Network connectivity issue
  API_AUTH_ERROR: 'API_AUTH_ERROR',           // E105: Authentication failed
  API_SERVER_ERROR: 'API_SERVER_ERROR',       // E106: 5xx server error

  // System Errors (E2xx) - Bugs in our code
  SYSTEM_VALIDATION_BUG: 'SYSTEM_VALIDATION_BUG',   // E201: Validation code threw
  SYSTEM_SCORING_BUG: 'SYSTEM_SCORING_BUG',         // E202: Scoring code threw
  SYSTEM_IO_ERROR: 'SYSTEM_IO_ERROR',               // E203: File system error
  SYSTEM_CONFIG_ERROR: 'SYSTEM_CONFIG_ERROR',       // E204: Configuration error

  // Unknown
  UNKNOWN: 'UNKNOWN'                          // E999: Unclassified error
};

export const ErrorCodes = {
  [ErrorCategory.LLM_PARSE_ERROR]: 'E001',
  [ErrorCategory.LLM_SCHEMA_ERROR]: 'E002',
  [ErrorCategory.LLM_QUALITY_ERROR]: 'E003',
  [ErrorCategory.LLM_EMPTY_ERROR]: 'E004',
  [ErrorCategory.API_RATE_LIMIT]: 'E101',
  [ErrorCategory.API_TIMEOUT]: 'E102',
  [ErrorCategory.API_QUOTA_ERROR]: 'E103',
  [ErrorCategory.API_NETWORK_ERROR]: 'E104',
  [ErrorCategory.API_AUTH_ERROR]: 'E105',
  [ErrorCategory.API_SERVER_ERROR]: 'E106',
  [ErrorCategory.SYSTEM_VALIDATION_BUG]: 'E201',
  [ErrorCategory.SYSTEM_SCORING_BUG]: 'E202',
  [ErrorCategory.SYSTEM_IO_ERROR]: 'E203',
  [ErrorCategory.SYSTEM_CONFIG_ERROR]: 'E204',
  [ErrorCategory.UNKNOWN]: 'E999'
};

// =============================================================================
// TRAINING ERROR CLASS
// =============================================================================

export class TrainingError extends Error {
  constructor(category, message, originalError = null, context = {}) {
    super(message);
    this.name = 'TrainingError';
    this.category = category;
    this.code = ErrorCodes[category] || 'E999';
    this.originalError = originalError;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.isRecoverable = this.determineRecoverability();
    this.retryStrategy = this.determineRetryStrategy();
  }

  determineRecoverability() {
    // System bugs are NOT recoverable - must halt
    if (this.category.startsWith('SYSTEM_')) {
      return false;
    }
    // API errors are generally recoverable with retry
    if (this.category.startsWith('API_')) {
      return this.category !== ErrorCategory.API_AUTH_ERROR;
    }
    // LLM errors - skip iteration but continue training
    return true;
  }

  determineRetryStrategy() {
    switch (this.category) {
      case ErrorCategory.API_RATE_LIMIT:
        return { shouldRetry: true, delays: [30000, 60000, 120000], maxRetries: 3 };
      case ErrorCategory.API_TIMEOUT:
        return { shouldRetry: true, delays: [5000], maxRetries: 1, doubleTimeout: true };
      case ErrorCategory.API_NETWORK_ERROR:
        return { shouldRetry: true, delays: [5000, 10000, 20000], maxRetries: 3 };
      case ErrorCategory.API_SERVER_ERROR:
        return { shouldRetry: true, delays: [10000, 30000], maxRetries: 2 };
      case ErrorCategory.LLM_PARSE_ERROR:
        return { shouldRetry: false, tryJsonRepair: true };
      default:
        return { shouldRetry: false };
    }
  }

  toJSON() {
    return {
      category: this.category,
      code: this.code,
      message: this.message,
      isRecoverable: this.isRecoverable,
      retryStrategy: this.retryStrategy,
      context: this.context,
      timestamp: this.timestamp,
      originalError: this.originalError?.message || null
    };
  }

  toString() {
    return `[${this.code}] ${this.category}: ${this.message}`;
  }
}

// =============================================================================
// ERROR DETECTION FUNCTIONS
// =============================================================================

/**
 * Categorize an error from the Gemini API
 */
export function categorizeApiError(error) {
  const message = error?.message?.toLowerCase() || '';
  const status = error?.status || error?.response?.status;

  // Rate limiting
  if (status === 429 || message.includes('rate limit') || message.includes('quota exceeded') || message.includes('too many requests')) {
    if (message.includes('quota')) {
      return new TrainingError(
        ErrorCategory.API_QUOTA_ERROR,
        'API quota exhausted',
        error,
        { status }
      );
    }
    return new TrainingError(
      ErrorCategory.API_RATE_LIMIT,
      'API rate limit exceeded',
      error,
      { status }
    );
  }

  // Authentication
  if (status === 401 || status === 403 || message.includes('api key') || message.includes('unauthorized') || message.includes('forbidden')) {
    return new TrainingError(
      ErrorCategory.API_AUTH_ERROR,
      'API authentication failed',
      error,
      { status }
    );
  }

  // Timeout
  if (message.includes('timeout') || message.includes('etimedout') || message.includes('timed out') || error?.code === 'ETIMEDOUT') {
    return new TrainingError(
      ErrorCategory.API_TIMEOUT,
      'API request timed out',
      error
    );
  }

  // Network errors
  if (message.includes('econnrefused') || message.includes('enotfound') || message.includes('network') ||
      error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || error?.code === 'ECONNRESET') {
    return new TrainingError(
      ErrorCategory.API_NETWORK_ERROR,
      'Network connectivity error',
      error,
      { errorCode: error?.code }
    );
  }

  // Server errors
  if (status >= 500 || message.includes('internal server error') || message.includes('service unavailable')) {
    return new TrainingError(
      ErrorCategory.API_SERVER_ERROR,
      `API server error (${status || 'unknown status'})`,
      error,
      { status }
    );
  }

  // Unknown API error
  return new TrainingError(
    ErrorCategory.UNKNOWN,
    `Unclassified API error: ${error?.message || 'Unknown error'}`,
    error
  );
}

/**
 * Categorize a JSON parsing error
 */
export function categorizeParseError(error, rawContent = '') {
  return new TrainingError(
    ErrorCategory.LLM_PARSE_ERROR,
    'LLM returned invalid JSON',
    error,
    {
      contentPreview: rawContent?.slice(0, 200),
      contentLength: rawContent?.length
    }
  );
}

/**
 * Categorize a schema validation error
 */
export function categorizeSchemaError(missingFields, data = null) {
  return new TrainingError(
    ErrorCategory.LLM_SCHEMA_ERROR,
    `Missing required fields: ${missingFields.join(', ')}`,
    null,
    {
      missingFields,
      receivedFields: data ? Object.keys(data) : []
    }
  );
}

/**
 * Categorize empty/minimal content
 */
export function categorizeEmptyError(contentType, details = {}) {
  return new TrainingError(
    ErrorCategory.LLM_EMPTY_ERROR,
    `LLM returned empty or minimal ${contentType} content`,
    null,
    details
  );
}

/**
 * Categorize low quality content
 */
export function categorizeQualityError(score, threshold, details = {}) {
  const safeScore = typeof score === 'number' ? score : 0;
  return new TrainingError(
    ErrorCategory.LLM_QUALITY_ERROR,
    `Quality score ${safeScore.toFixed(2)} below threshold ${threshold}`,
    null,
    { score: safeScore, threshold, ...details }
  );
}

/**
 * Categorize a system bug (validation code threw)
 */
export function categorizeValidationBug(error, context = {}) {
  return new TrainingError(
    ErrorCategory.SYSTEM_VALIDATION_BUG,
    `Validation code threw exception: ${error?.message}`,
    error,
    context
  );
}

/**
 * Categorize a system bug (scoring code threw)
 */
export function categorizeScoringBug(error, context = {}) {
  return new TrainingError(
    ErrorCategory.SYSTEM_SCORING_BUG,
    `Scoring code threw exception: ${error?.message}`,
    error,
    context
  );
}

/**
 * Categorize a file system error
 */
export function categorizeIOError(error, path = '') {
  return new TrainingError(
    ErrorCategory.SYSTEM_IO_ERROR,
    `File system error: ${error?.message}`,
    error,
    { path }
  );
}

// =============================================================================
// ERROR STATISTICS COLLECTOR
// =============================================================================

export class ErrorStatsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.byCategory = {};
    this.byVariant = {};
    this.byContentType = {};
    this.timeline = [];
    this.totalIterations = 0;
    this.successfulIterations = 0;
  }

  recordSuccess(variant, contentType) {
    this.totalIterations++;
    this.successfulIterations++;

    // Track by variant
    if (!this.byVariant[variant]) {
      this.byVariant[variant] = { total: 0, successful: 0, errors: {} };
    }
    this.byVariant[variant].total++;
    this.byVariant[variant].successful++;

    // Track by content type
    if (!this.byContentType[contentType]) {
      this.byContentType[contentType] = { total: 0, successful: 0, errors: {} };
    }
    this.byContentType[contentType].total++;
    this.byContentType[contentType].successful++;
  }

  recordError(error, variant, contentType) {
    this.totalIterations++;

    const category = error.category || ErrorCategory.UNKNOWN;
    const code = error.code || 'E999';

    // By category
    if (!this.byCategory[category]) {
      this.byCategory[category] = { count: 0, variants: new Set(), contentTypes: new Set() };
    }
    this.byCategory[category].count++;
    this.byCategory[category].variants.add(variant);
    this.byCategory[category].contentTypes.add(contentType);

    // By variant
    if (!this.byVariant[variant]) {
      this.byVariant[variant] = { total: 0, successful: 0, errors: {} };
    }
    this.byVariant[variant].total++;
    if (!this.byVariant[variant].errors[category]) {
      this.byVariant[variant].errors[category] = 0;
    }
    this.byVariant[variant].errors[category]++;

    // By content type
    if (!this.byContentType[contentType]) {
      this.byContentType[contentType] = { total: 0, successful: 0, errors: {} };
    }
    this.byContentType[contentType].total++;
    if (!this.byContentType[contentType].errors[category]) {
      this.byContentType[contentType].errors[category] = 0;
    }
    this.byContentType[contentType].errors[category]++;

    // Timeline
    this.timeline.push({
      timestamp: new Date().toISOString(),
      category,
      code,
      variant,
      contentType,
      message: error.message
    });
  }

  /**
   * Detect anomalies that might indicate code bugs vs LLM issues
   */
  detectAnomalies() {
    const anomalies = [];
    const warnings = [];

    // Check for system bugs (should halt training)
    const systemBugCategories = [
      ErrorCategory.SYSTEM_VALIDATION_BUG,
      ErrorCategory.SYSTEM_SCORING_BUG,
      ErrorCategory.SYSTEM_IO_ERROR,
      ErrorCategory.SYSTEM_CONFIG_ERROR
    ];

    for (const category of systemBugCategories) {
      if (this.byCategory[category]?.count > 0) {
        anomalies.push({
          severity: 'CRITICAL',
          category,
          message: `System bug detected: ${category} (${this.byCategory[category].count} occurrences)`,
          action: 'HALT_TRAINING'
        });
      }
    }

    // Check if same error affects all variants equally (likely code bug or API issue)
    for (const [category, stats] of Object.entries(this.byCategory)) {
      if (category.startsWith('LLM_') && stats.count >= 5) {
        const variantCount = stats.variants.size;
        const totalVariants = Object.keys(this.byVariant).length;

        if (variantCount === totalVariants && totalVariants > 1) {
          // Error affects ALL variants equally
          const errorRate = stats.count / this.totalIterations;
          if (errorRate > 0.5) {
            warnings.push({
              severity: 'WARNING',
              category,
              message: `${category} affecting all variants (${(errorRate * 100).toFixed(1)}% error rate) - may indicate systemic issue`,
              action: 'INVESTIGATE'
            });
          }
        }
      }
    }

    // Check for variant-specific high error rates (valid signal for training)
    for (const [variant, stats] of Object.entries(this.byVariant)) {
      if (stats.total >= 5) {
        const errorRate = 1 - (stats.successful / stats.total);
        const avgErrorRate = 1 - (this.successfulIterations / this.totalIterations);

        if (errorRate > avgErrorRate * 2 && errorRate > 0.3) {
          warnings.push({
            severity: 'INFO',
            variant,
            message: `Variant "${variant}" has ${(errorRate * 100).toFixed(1)}% error rate (2x+ average) - valid training signal`,
            action: 'NONE'
          });
        }
      }
    }

    // Check for increasing rate limit errors
    const rateLimitErrors = this.timeline.filter(e => e.category === ErrorCategory.API_RATE_LIMIT);
    if (rateLimitErrors.length >= 3) {
      const recent = rateLimitErrors.slice(-5);
      if (recent.length >= 3) {
        warnings.push({
          severity: 'WARNING',
          category: ErrorCategory.API_RATE_LIMIT,
          message: `Frequent rate limiting detected (${rateLimitErrors.length} occurrences)`,
          action: 'SLOW_DOWN'
        });
      }
    }

    return { anomalies, warnings };
  }

  /**
   * Check if training should be halted
   */
  shouldHalt() {
    const { anomalies } = this.detectAnomalies();
    return anomalies.some(a => a.action === 'HALT_TRAINING');
  }

  /**
   * Get summary for reporting
   */
  getSummary() {
    const { anomalies, warnings } = this.detectAnomalies();

    // Convert Sets to arrays for JSON serialization
    const byCategorySerializable = {};
    for (const [cat, stats] of Object.entries(this.byCategory)) {
      byCategorySerializable[cat] = {
        count: stats.count,
        variants: Array.from(stats.variants),
        contentTypes: Array.from(stats.contentTypes)
      };
    }

    return {
      totalIterations: this.totalIterations,
      successfulIterations: this.successfulIterations,
      failedIterations: this.totalIterations - this.successfulIterations,
      successRate: this.totalIterations > 0
        ? ((this.successfulIterations / this.totalIterations) * 100).toFixed(1) + '%'
        : 'N/A',
      byCategory: byCategorySerializable,
      byVariant: this.byVariant,
      byContentType: this.byContentType,
      systemBugsDetected: Object.keys(this.byCategory)
        .filter(c => c.startsWith('SYSTEM_'))
        .reduce((sum, c) => sum + this.byCategory[c].count, 0),
      anomalies,
      warnings,
      shouldHalt: this.shouldHalt(),
      recentErrors: this.timeline.slice(-10)
    };
  }

  /**
   * Format summary for console output
   */
  formatForConsole() {
    const summary = this.getSummary();
    const lines = [
      '',
      '=== Error Summary ===',
      `Total Iterations: ${summary.totalIterations}`,
      `Successful: ${summary.successfulIterations} (${summary.successRate})`,
      `Failed: ${summary.failedIterations}`,
      ''
    ];

    if (Object.keys(summary.byCategory).length > 0) {
      lines.push('By Category:');
      for (const [category, stats] of Object.entries(summary.byCategory)) {
        const code = ErrorCodes[category] || 'E???';
        lines.push(`  ${code} ${category}: ${stats.count}`);
      }
      lines.push('');
    }

    if (summary.anomalies.length > 0) {
      lines.push('CRITICAL ISSUES:');
      for (const anomaly of summary.anomalies) {
        lines.push(`  [${anomaly.severity}] ${anomaly.message}`);
      }
      lines.push('');
    }

    if (summary.warnings.length > 0) {
      lines.push('Warnings:');
      for (const warning of summary.warnings) {
        lines.push(`  [${warning.severity}] ${warning.message}`);
      }
      lines.push('');
    }

    if (summary.systemBugsDetected === 0) {
      lines.push('No system bugs detected (E2xx = 0)');
    }

    return lines.join('\n');
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if an error is a system bug (code error, not LLM issue)
 */
export function isSystemBug(error) {
  if (error instanceof TrainingError) {
    return error.category.startsWith('SYSTEM_');
  }
  return false;
}

/**
 * Check if an error is recoverable (can retry or skip)
 */
export function isRecoverable(error) {
  if (error instanceof TrainingError) {
    return error.isRecoverable;
  }
  return true; // Assume unknown errors are recoverable
}

/**
 * Get retry delay for an error
 */
export function getRetryDelay(error, attemptNumber) {
  if (error instanceof TrainingError && error.retryStrategy?.shouldRetry) {
    const delays = error.retryStrategy.delays || [5000];
    return delays[Math.min(attemptNumber, delays.length - 1)];
  }
  return null; // No retry
}
