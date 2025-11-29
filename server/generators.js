import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, slidesSchema } from './prompts/slides.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema } from './prompts/research-analysis.js';
import { PerformanceLogger, createTimer, globalMetrics } from './utils/performanceLogger.js';
import { getCachedContent, setCachedContent, getCacheMetrics } from './cache/contentCache.js';
import { connectionPrewarmer, speculativeGenerator } from './utils/advancedOptimizer.js';
import { CONFIG, isRoutingEnabled } from './config.js';
import {
  getRouter,
  getFallbackManager,
  TaskType,
  analyzeComplexity
} from './layers/routing/index.js';
import {
  getContextLayer,
  StrategyType,
  countTokens
} from './layers/context/index.js';
import {
  SignatureType,
  generateSignaturePrompt,
  validateSignatureInputs
} from './layers/signatures/index.js';
import {
  getOutputProcessor,
  quickCheckOutput
} from './layers/output/index.js';
import {
  getObservabilityPipeline,
  LayerSpan
} from './layers/observability/index.js';
import {
  getEvaluationPipeline,
  FeedbackType
} from './layers/evaluation/index.js';
import {
  getOptimizationPipeline,
  TuningMode
} from './layers/optimization/index.js';
import {
  getMonitoringPipeline,
  quickHealthCheck,
  quickDashboard
} from './layers/monitoring/index.js';
import {
  getMetricsCollector
} from './layers/optimization/metrics/index.js';
import {
  selectVariant,
  recordVariantPerformance,
  initializeVariants,
  ContentType
} from './layers/optimization/variants/index.js';
import {
  recordExperimentMetric,
  getActiveExperiment
} from './layers/optimization/experiments/index.js';

// Feature flag for caching - can be disabled for testing
const ENABLE_CACHE = true;

// Feature flag for auto-optimization metrics collection
const ENABLE_AUTO_OPTIMIZATION = process.env.ENABLE_AUTO_OPTIMIZATION !== 'false';

// Feature flag for variant selection (A/B testing)
const ENABLE_VARIANT_SELECTION = process.env.ENABLE_VARIANT_SELECTION !== 'false';

// Initialize variants on module load if enabled
if (ENABLE_VARIANT_SELECTION) {
  try {
    const result = initializeVariants();
    if (result.initialized) {
      console.log(`[Variants] Initialized ${result.registered} variants`);
    }
  } catch (error) {
    console.warn('[Variants] Failed to initialize:', error.message);
  }
}

// Feature flag for context engineering layer
const ENABLE_CONTEXT_ENGINEERING = process.env.ENABLE_CONTEXT_ENGINEERING !== 'false';

// Feature flag for DSPy-style signatures
const ENABLE_SIGNATURES = process.env.ENABLE_SIGNATURES !== 'false';

// Feature flag for output validation (PROMPT ML Layer 6)
const ENABLE_OUTPUT_VALIDATION = process.env.ENABLE_OUTPUT_VALIDATION !== 'false';

// Feature flag for observability (PROMPT ML Layer 7)
const ENABLE_OBSERVABILITY = process.env.ENABLE_OBSERVABILITY !== 'false';

// Feature flag for evaluation (PROMPT ML Layer 8)
const ENABLE_EVALUATION = process.env.ENABLE_EVALUATION !== 'false';

// Feature flag for optimization (PROMPT ML Layer 9)
const ENABLE_OPTIMIZATION = process.env.ENABLE_OPTIMIZATION !== 'false';

// Feature flag for monitoring (PROMPT ML Layer 10)
const ENABLE_MONITORING = process.env.ENABLE_MONITORING !== 'false';

/**
 * Map content types to StrategyType for context engineering
 */
const CONTENT_TYPE_TO_STRATEGY = {
  'Roadmap': StrategyType.ROADMAP,
  'Slides': StrategyType.SLIDES,
  'Document': StrategyType.DOCUMENT,
  'ResearchAnalysis': StrategyType.RESEARCH_ANALYSIS
};

/**
 * Map content types to SignatureType for DSPy-style signatures
 */
const CONTENT_TYPE_TO_SIGNATURE = {
  'Roadmap': SignatureType.ROADMAP,
  'Slides': SignatureType.SLIDES,
  'Document': SignatureType.DOCUMENT,
  'ResearchAnalysis': SignatureType.RESEARCH_ANALYSIS
};

/**
 * Detects interval type from timeColumns
 * @param {string[]} timeColumns - Array of time column labels
 * @returns {'years'|'quarters'|'months'|'weeks'|'unknown'}
 */
function detectIntervalType(timeColumns) {
  if (!timeColumns || timeColumns.length === 0) return 'unknown';
  const sample = timeColumns[0].trim();
  // Case-insensitive matching with flexible separators
  if (/^Q[1-4][\s\-\/]*\d{4}$/i.test(sample)) return 'quarters';
  if (/^\d{4}$/.test(sample)) return 'years';
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-\/]*\d{4}$/i.test(sample)) return 'months';
  if (/^W\d+[\s\-\/]*\d{4}$/i.test(sample)) return 'weeks';
  return 'unknown';
}

/**
 * Extracts year range from timeColumns
 * @param {string[]} timeColumns - Array of time column labels
 * @returns {{startYear: number, endYear: number, yearSpan: number}}
 */
function extractYearRange(timeColumns) {
  const years = timeColumns.map(col => {
    const match = col.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : null;
  }).filter(y => y !== null);

  if (years.length === 0) return { startYear: 0, endYear: 0, yearSpan: 0 };

  const startYear = Math.min(...years);
  const endYear = Math.max(...years);
  return { startYear, endYear, yearSpan: endYear - startYear + 1 };
}

/**
 * Converts quarterly or monthly timeColumns to yearly when span > 3 years
 * Also remaps all task bar columns to match new yearly intervals
 * @param {object} ganttData - The gantt chart data object
 * @returns {object} - Corrected gantt data
 */
function enforceYearlyIntervalsForLongRanges(ganttData) {
  if (!ganttData || !ganttData.timeColumns) return ganttData;

  const intervalType = detectIntervalType(ganttData.timeColumns);
  const { startYear, endYear, yearSpan } = extractYearRange(ganttData.timeColumns);

  // Only convert if span > 3 years (threshold for yearly intervals)
  if (yearSpan <= 3) return ganttData;

  // Already yearly intervals - no conversion needed
  if (intervalType === 'years') return ganttData;

  // Check if we have more columns than years (indicating non-yearly intervals)
  const columnCount = ganttData.timeColumns.length;
  if (columnCount <= yearSpan) return ganttData;

  // Build mapping from old columns to new year columns
  const columnToYearMap = {};
  ganttData.timeColumns.forEach((col, index) => {
    const match = col.match(/(\d{4})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const newColIndex = year - startYear + 1; // 1-indexed
      columnToYearMap[index + 1] = newColIndex;
    }
  });

  // Generate new yearly timeColumns
  const newTimeColumns = [];
  for (let year = startYear; year <= endYear; year++) {
    newTimeColumns.push(year.toString());
  }

  // Remap all task bar columns
  const newData = ganttData.data.map(item => {
    if (item.isSwimlane || !item.bar) return item;

    const newItem = { ...item, bar: { ...item.bar } };

    if (item.bar.startCol !== null && columnToYearMap[item.bar.startCol]) {
      newItem.bar.startCol = columnToYearMap[item.bar.startCol];
    }
    if (item.bar.endCol !== null && columnToYearMap[item.bar.endCol]) {
      newItem.bar.endCol = columnToYearMap[item.bar.endCol];
    } else if (item.bar.endCol !== null && item.bar.startCol !== null) {
      newItem.bar.endCol = newItem.bar.startCol + 1;
    }

    // Ensure minimum duration of 1 column
    if (newItem.bar.startCol !== null && newItem.bar.endCol !== null) {
      if (newItem.bar.endCol <= newItem.bar.startCol) {
        newItem.bar.endCol = newItem.bar.startCol + 1;
      }
    }

    return newItem;
  });

  return {
    ...ganttData,
    timeColumns: newTimeColumns,
    data: newData
  };
}

/**
 * Record generation metrics for auto-optimization
 *
 * Captures metrics about prompt performance for A/B testing
 * and automatic prompt improvement.
 *
 * @param {Object} data - Generation data to record
 * @returns {string|null} Generation ID for feedback tracking
 */
function recordGenerationMetrics(data) {
  if (!ENABLE_AUTO_OPTIMIZATION) {
    return null;
  }

  try {
    const collector = getMetricsCollector();
    const generationId = collector.recordGeneration({
      contentType: data.contentType,
      variantId: data.variantId || 'default',
      prompt: data.prompt,
      userPrompt: data.userPrompt,
      fileCount: data.fileCount || 0,
      complexity: data.complexity || 0,
      model: data.model || 'gemini-1.5-pro',
      latencyMs: data.latencyMs || 0,
      inputTokens: data.inputTokens || 0,
      outputTokens: data.outputTokens || 0,
      retryCount: data.retryCount || 0,
      cacheHit: data.cacheHit || false,
      validation: data.validation,
      topics: data.topics || []
    });

    return generationId;
  } catch (error) {
    console.warn('[AutoOptimization] Failed to record metrics:', error.message);
    return null;
  }
}

/**
 * Select and apply a variant's prompt template
 *
 * Uses variant selection for A/B testing when enabled,
 * falls back to traditional prompt generation when disabled.
 *
 * @param {string} contentType - Content type (Roadmap, Slides, Document, ResearchAnalysis)
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Research files
 * @param {Function} fallbackGenerator - Fallback prompt generator function
 * @returns {Object} {prompt, variantId, variantName, usedVariant}
 */
function selectAndApplyVariant(contentType, userPrompt, researchFiles, fallbackGenerator) {
  if (!ENABLE_VARIANT_SELECTION) {
    return {
      prompt: fallbackGenerator(userPrompt, researchFiles),
      variantId: 'default',
      variantName: 'Default',
      usedVariant: false
    };
  }

  try {
    const variant = selectVariant(contentType);

    if (!variant || !variant.promptTemplate) {
      // Fallback if no variant found
      return {
        prompt: fallbackGenerator(userPrompt, researchFiles),
        variantId: 'default',
        variantName: 'Default (no variant)',
        usedVariant: false
      };
    }

    // Build the prompt using the variant template
    const researchContent = researchFiles
      .map(file => `=== ${file.filename} ===\n${file.content}`)
      .join('\n\n');

    // Apply the variant template with user prompt and research
    const prompt = `${variant.promptTemplate}

**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Respond with ONLY the JSON object.`;

    return {
      prompt,
      variantId: variant.id,
      variantName: variant.name,
      usedVariant: true
    };
  } catch (error) {
    console.warn(`[Variants] Selection failed for ${contentType}:`, error.message);
    return {
      prompt: fallbackGenerator(userPrompt, researchFiles),
      variantId: 'default',
      variantName: 'Default (error)',
      usedVariant: false,
      error: error.message
    };
  }
}

/**
 * Combine research files into a single content string for cache key
 * @param {Array} researchFiles - Array of { filename, content } objects
 * @returns {string} Combined content
 */
function combineResearchContent(researchFiles) {
  return researchFiles
    .map(f => `${f.filename}:${f.content}`)
    .sort() // Sort for consistent hashing regardless of file order
    .join('\n---\n');
}

/**
 * Process research files through context engineering layer
 *
 * Applies task-specific strategies, token budgeting, and compression
 * to optimize context for each generation type.
 *
 * @param {Array} researchFiles - Array of { filename, content } objects
 * @param {string} userPrompt - User's prompt
 * @param {string} contentType - Type of content being generated
 * @param {object} perfLogger - Performance logger instance
 * @returns {object} Processed context with files and metadata
 */
function processContextEngineering(researchFiles, userPrompt, contentType, perfLogger = null) {
  if (!ENABLE_CONTEXT_ENGINEERING) {
    return {
      files: researchFiles,
      applied: false,
      metadata: null
    };
  }

  const contextTimer = perfLogger ? createTimer(perfLogger, `context-${contentType.toLowerCase()}`) : null;

  try {
    const contextLayer = getContextLayer();
    const strategyType = CONTENT_TYPE_TO_STRATEGY[contentType] || StrategyType.DEFAULT;

    // Process through context engineering pipeline
    const result = contextLayer.process({
      researchFiles,
      userPrompt,
      taskType: strategyType,
      tokenBudget: getTokenBudgetForType(contentType)
    });

    // Log context metrics
    if (perfLogger) {
      perfLogger.setMetadata(`context-tokens-${contentType.toLowerCase()}`, result.tokenUsage.used);
      perfLogger.setMetadata(`context-budget-${contentType.toLowerCase()}`, result.tokenUsage.budget);
      perfLogger.setMetadata(`context-utilization-${contentType.toLowerCase()}`,
        `${(result.tokenUsage.utilization * 100).toFixed(1)}%`);

      if (result.compression?.applied) {
        perfLogger.setMetadata(`context-compression-${contentType.toLowerCase()}`, {
          originalTokens: result.compression.originalTokens,
          compressedTokens: result.compression.compressedTokens,
          saved: result.compression.originalTokens - result.compression.compressedTokens
        });
      }
    }

    if (contextTimer) contextTimer.stop();

    // Return processed files from context assembly
    const processedFiles = result.context?.components
      ?.find(c => c.name === 'content')?.metadata?.processedFiles || researchFiles;

    return {
      files: processedFiles,
      applied: true,
      result,
      metadata: {
        strategy: result.strategy?.name || 'default',
        tokensUsed: result.tokenUsage.used,
        compressionApplied: result.compression?.applied || false
      }
    };
  } catch (error) {
    // Context engineering failed - fall back to original files
    if (perfLogger) {
      perfLogger.setMetadata(`context-error-${contentType.toLowerCase()}`, error.message);
    }
    if (contextTimer) contextTimer.stop();

    return {
      files: researchFiles,
      applied: false,
      error: error.message,
      metadata: null
    };
  }
}

/**
 * Get token budget for content type
 * Different content types have different complexity and output requirements
 */
function getTokenBudgetForType(contentType) {
  const budgets = {
    'Roadmap': 12000,      // Complex timeline extraction
    'Slides': 6000,        // Concise executive content
    'Document': 10000,     // Comprehensive sections
    'ResearchAnalysis': 8000  // Quality assessment
  };
  return budgets[contentType] || 8000;
}

/**
 * Generate prompt using either traditional or signature-based method
 *
 * When ENABLE_SIGNATURES is true, uses DSPy-style structured signatures
 * for more consistent, typed prompt generation with validation.
 *
 * @param {string} contentType - Type of content (Roadmap, Slides, etc.)
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Research files
 * @param {Function} traditionalGenerator - Traditional prompt generator function
 * @param {object} perfLogger - Performance logger
 * @returns {object} {prompt, usedSignature, validationResult}
 */
function generatePromptWithSignature(contentType, userPrompt, researchFiles, traditionalGenerator, perfLogger = null) {
  if (ENABLE_SIGNATURES) {
    const signatureType = CONTENT_TYPE_TO_SIGNATURE[contentType];

    if (signatureType) {
      try {
        // Validate inputs first
        const validation = validateSignatureInputs(signatureType, userPrompt, researchFiles);

        if (!validation.valid) {
          // Log validation errors but continue with traditional prompt
          if (perfLogger) {
            perfLogger.setMetadata(`signature-validation-${contentType.toLowerCase()}`, {
              valid: false,
              errors: validation.errors
            });
          }
        }

        // Generate using signature
        const prompt = generateSignaturePrompt(signatureType, userPrompt, researchFiles);

        if (perfLogger) {
          perfLogger.setMetadata(`signature-used-${contentType.toLowerCase()}`, true);
        }

        return {
          prompt,
          usedSignature: true,
          signatureType,
          validationResult: validation
        };
      } catch (error) {
        // Fall back to traditional on signature error
        if (perfLogger) {
          perfLogger.setMetadata(`signature-error-${contentType.toLowerCase()}`, error.message);
        }
      }
    }
  }

  // Traditional prompt generation
  return {
    prompt: traditionalGenerator(userPrompt, researchFiles),
    usedSignature: false,
    signatureType: null,
    validationResult: null
  };
}

/**
 * Map content types to output types for validation
 */
const CONTENT_TYPE_TO_OUTPUT_TYPE = {
  'Roadmap': 'roadmap',
  'Slides': 'slides',
  'Document': 'document',
  'ResearchAnalysis': 'research-analysis'
};

/**
 * Validate and process generated output
 *
 * Runs output through PROMPT ML Layer 6 validation pipeline:
 * - Schema validation
 * - Safety checking
 * - Quality scoring
 *
 * @param {*} data - Generated data to validate
 * @param {string} contentType - Type of content
 * @param {Object} schema - JSON schema for validation
 * @param {Object} context - Additional context (userPrompt, researchFiles)
 * @param {object} perfLogger - Performance logger
 * @returns {object} {data, validation}
 */
function validateGeneratedOutput(data, contentType, schema, context = {}, perfLogger = null) {
  if (!ENABLE_OUTPUT_VALIDATION || !data) {
    return {
      data,
      validation: null
    };
  }

  const validationTimer = perfLogger ? createTimer(perfLogger, `validation-${contentType.toLowerCase()}`) : null;

  try {
    const outputProcessor = getOutputProcessor();
    const outputType = CONTENT_TYPE_TO_OUTPUT_TYPE[contentType];

    // Process through validation pipeline
    const result = outputProcessor.process(data, {
      outputType,
      schema,
      userPrompt: context.userPrompt,
      sourceFiles: context.researchFiles
    });

    // Log validation metrics
    if (perfLogger) {
      perfLogger.setMetadata(`output-valid-${contentType.toLowerCase()}`, result.valid);
      perfLogger.setMetadata(`output-safe-${contentType.toLowerCase()}`, result.safe);

      if (result.quality) {
        perfLogger.setMetadata(`output-quality-${contentType.toLowerCase()}`, {
          grade: result.quality.grade,
          score: result.quality.overall
        });
      }

      if (result.validation?.errors?.length > 0) {
        perfLogger.setMetadata(`output-errors-${contentType.toLowerCase()}`, result.validation.errors.slice(0, 3));
      }

      if (result.safety?.concerns?.length > 0) {
        perfLogger.setMetadata(`output-concerns-${contentType.toLowerCase()}`, result.safety.concerns.length);
      }
    }

    if (validationTimer) validationTimer.stop();

    return {
      data: result.output,
      validation: {
        valid: result.valid,
        safe: result.safe,
        quality: result.quality ? {
          grade: result.quality.grade,
          score: result.quality.overall,
          strengths: result.quality.strengths,
          weaknesses: result.quality.weaknesses
        } : null,
        errors: result.validation?.errors || [],
        concerns: result.safety?.concerns || []
      }
    };
  } catch (error) {
    // Validation failed - return original data
    if (perfLogger) {
      perfLogger.setMetadata(`validation-error-${contentType.toLowerCase()}`, error.message);
    }
    if (validationTimer) validationTimer.stop();

    return {
      data,
      validation: {
        error: error.message
      }
    };
  }
}

/**
 * Get observability pipeline for request tracking
 *
 * Provides distributed tracing, structured logging, and metrics
 * collection for the entire generation pipeline.
 *
 * @returns {Object|null} Observability pipeline or null if disabled
 */
function getObservability() {
  if (!ENABLE_OBSERVABILITY) {
    return null;
  }
  return getObservabilityPipeline();
}

/**
 * Record LLM call metrics in observability
 *
 * @param {Object} context - Observability context
 * @param {Object} details - Call details
 */
function recordLLMMetrics(context, details) {
  if (!ENABLE_OBSERVABILITY || !context) return;

  const observability = getObservability();
  if (observability) {
    observability.observeLLMCall(context, details);
  }
}

/**
 * Record validation results in observability
 *
 * @param {Object} context - Observability context
 * @param {Object} validation - Validation result
 */
function recordValidationMetrics(context, validation) {
  if (!ENABLE_OBSERVABILITY || !context || !validation) return;

  const observability = getObservability();
  if (observability) {
    observability.observeValidation(context, validation);
  }
}

/**
 * Get evaluation pipeline for output evaluation
 *
 * @returns {Object|null} Evaluation pipeline or null if disabled
 */
function getEvaluation() {
  if (!ENABLE_EVALUATION) {
    return null;
  }
  return getEvaluationPipeline();
}

/**
 * Run evaluation on generated output
 *
 * @param {*} output - Generated output
 * @param {Object} context - Evaluation context
 * @returns {Object|null} Evaluation result
 */
function evaluateGeneratedOutput(output, context = {}) {
  if (!ENABLE_EVALUATION) return null;

  const evaluation = getEvaluation();
  if (!evaluation) return null;

  try {
    return evaluation.runFullEvaluation(output, context);
  } catch (error) {
    console.warn('[Evaluation] Failed:', error.message);
    return null;
  }
}

/**
 * Record user feedback
 *
 * @param {string} feedbackType - Type of feedback
 * @param {string} contentType - Content type
 * @param {*} value - Feedback value
 * @param {Object} context - Additional context
 */
function recordUserFeedback(feedbackType, contentType, value, context = {}) {
  if (!ENABLE_EVALUATION) return null;

  const evaluation = getEvaluation();
  if (!evaluation) return null;

  try {
    return evaluation.recordFeedback(feedbackType, contentType, value, context);
  } catch (error) {
    console.warn('[Feedback] Failed to record:', error.message);
    return null;
  }
}

/**
 * Get optimization pipeline for request optimization
 *
 * Provides prompt optimization, caching, and performance tuning
 * for the generation pipeline.
 *
 * @returns {Object|null} Optimization pipeline or null if disabled
 */
function getOptimization() {
  if (!ENABLE_OPTIMIZATION) {
    return null;
  }
  return getOptimizationPipeline();
}

/**
 * Optimize a request before execution
 *
 * @param {Object} request - Request details
 * @returns {Object} Optimized request
 */
function optimizeRequest(request) {
  if (!ENABLE_OPTIMIZATION) {
    return { ...request, optimizations: { applied: [] } };
  }

  const optimization = getOptimization();
  if (!optimization) {
    return { ...request, optimizations: { applied: [] } };
  }

  try {
    return optimization.optimizeRequest(request);
  } catch (error) {
    console.warn('[Optimization] Request optimization failed:', error.message);
    return { ...request, optimizations: { applied: [], error: error.message } };
  }
}

/**
 * Record optimization result for learning
 *
 * @param {Object} request - Original request
 * @param {Object} result - Request result
 */
function recordOptimizationResult(request, result) {
  if (!ENABLE_OPTIMIZATION) return;

  const optimization = getOptimization();
  if (!optimization) return;

  try {
    optimization.recordResult(request, result);
  } catch (error) {
    console.warn('[Optimization] Failed to record result:', error.message);
  }
}

/**
 * Get optimized timeout for content type
 *
 * @param {string} contentType - Content type
 * @returns {number} Timeout in ms
 */
function getOptimizedTimeout(contentType) {
  if (!ENABLE_OPTIMIZATION) {
    return GENERATION_TIMEOUT_MS;
  }

  const optimization = getOptimization();
  if (!optimization) {
    return GENERATION_TIMEOUT_MS;
  }

  return optimization.getOptimizedTimeout(contentType);
}

/**
 * Track request lifecycle for optimization
 */
function trackOptimizationRequestStart() {
  if (!ENABLE_OPTIMIZATION) return;

  const optimization = getOptimization();
  if (optimization) {
    optimization.trackRequestStart();
  }
}

function trackOptimizationRequestEnd() {
  if (!ENABLE_OPTIMIZATION) return;

  const optimization = getOptimization();
  if (optimization) {
    optimization.trackRequestEnd();
  }
}

/**
 * Get monitoring pipeline for system monitoring
 *
 * Provides health checks, metrics dashboard, and alerting
 * for the PROMPT ML system.
 *
 * @returns {Object|null} Monitoring pipeline or null if disabled
 */
function getMonitoring() {
  if (!ENABLE_MONITORING) {
    return null;
  }
  return getMonitoringPipeline();
}

/**
 * Record request metrics for monitoring dashboard
 *
 * @param {Object} data - Request metrics
 */
function recordMonitoringMetrics(data) {
  if (!ENABLE_MONITORING) return;

  const monitoring = getMonitoring();
  if (monitoring) {
    monitoring.recordRequest(data);
  }
}

/**
 * Start monitoring system
 */
function startMonitoring() {
  if (!ENABLE_MONITORING) return;

  const monitoring = getMonitoring();
  if (monitoring) {
    monitoring.start();
  }
}

/**
 * Stop monitoring system
 */
function stopMonitoring() {
  if (!ENABLE_MONITORING) return;

  const monitoring = getMonitoring();
  if (monitoring) {
    monitoring.stop();
  }
}

// Initialize Gemini API (using API_KEY from environment to match server/config.js)
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Timeout configuration for AI generation
const GENERATION_TIMEOUT_MS = 360000; // 6 minutes - increased for complex content and API variability

// ============================================================================
// CONNECTION PREWARMING - Register Gemini API warmup callback
// ============================================================================

/**
 * Warm up the Gemini API connection by making a minimal request
 * This keeps the connection pool active and reduces cold start latency
 */
async function warmupGeminiConnection() {
  try {
    const model = genAI.getGenerativeModel({
      model: 'models/gemini-flash-latest',
      generationConfig: {
        maxOutputTokens: 10,
        temperature: 0
      }
    });

    // Minimal prompt to verify connection
    await model.generateContent('Say "ok"');
  } catch (error) {
    // Log but don't throw - warmup failure shouldn't block operation
    console.warn('[Warmup] Gemini connection warmup failed:', error.message);
  }
}

// Register warmup callback (will be started when initializeOptimizers() is called)
connectionPrewarmer.register('gemini-api', warmupGeminiConnection);

// ============================================================================
// REQUEST QUEUE - Controls concurrent API calls to prevent overload
// ============================================================================

/**
 * API Request Queue with controlled concurrency and priority support
 *
 * Features:
 * - Concurrency limit prevents rate limiting from Gemini API
 * - Priority queue ensures faster content types complete first
 * - Metrics tracking for performance analysis
 *
 * Priority levels (lower = higher priority):
 * - 1: Document, Slides (fast, simple)
 * - 2: Roadmap (complex but important)
 * - 3: ResearchAnalysis (detailed, can wait)
 */
class APIQueue {
  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];  // Priority queue: { resolve, priority, name }
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      queuedTasks: 0,
      peakConcurrency: 0
    };
  }

  // Priority mapping for content types
  static getPriority(name) {
    const priorities = {
      'Document': 1,
      'Slides': 1,
      'Roadmap': 2,
      'ResearchAnalysis': 3
    };
    return priorities[name] || 2;
  }

  async add(task, name = 'unknown') {
    this.metrics.totalTasks++;

    if (this.running >= this.maxConcurrent) {
      this.metrics.queuedTasks++;
      const priority = APIQueue.getPriority(name);
      await new Promise(resolve => {
        // Insert in priority order
        const entry = { resolve, priority, name };
        const insertIndex = this.queue.findIndex(e => e.priority > priority);
        if (insertIndex === -1) {
          this.queue.push(entry);
        } else {
          this.queue.splice(insertIndex, 0, entry);
        }
      });
    }

    this.running++;
    this.metrics.peakConcurrency = Math.max(this.metrics.peakConcurrency, this.running);

    try {
      const result = await task();
      return result;
    } finally {
      this.running--;
      this.metrics.completedTasks++;
      const next = this.queue.shift();
      if (next) next.resolve();
    }
  }

  async runAll(tasks) {
    return Promise.all(tasks.map(({ task, name }) => this.add(task, name)));
  }

  getMetrics() {
    return {
      ...this.metrics,
      currentlyRunning: this.running,
      currentlyQueued: this.queue.length
    };
  }

  resetMetrics() {
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      queuedTasks: 0,
      peakConcurrency: 0
    };
  }
}

// Global API queue instance - 6 concurrent Gemini API calls
// Increased from 4 for better throughput; monitor for rate limit errors
const apiQueue = new APIQueue(6);

/**
 * Generation config presets optimized for speed and determinism
 *
 * Performance tuning rationale:
 * - temperature: Low (0.1) for deterministic, consistent JSON output
 * - topP/topK: Constrained to reduce token exploration overhead
 * - thinkingBudget: 0 for all types (reasoning disabled = faster response)
 * - maxOutputTokens: Set per content type to prevent runaway generation
 */

// Base config for all structured JSON output
const STRUCTURED_DEFAULT_CONFIG = {
  thinkingBudget: 0  // Disabled for maximum speed
};

// Document: Simplest output, fastest generation
const DOCUMENT_CONFIG = {
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0,
  maxOutputTokens: 4096  // Executive summaries are concise
};

// Slides: Simple 6-slide structure
const SLIDES_CONFIG = {
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0,
  maxOutputTokens: 4096  // 6 slides with limited content
};

// Roadmap: Complex Gantt chart with many tasks
const ROADMAP_CONFIG = {
  temperature: 0.1,      // Maximum determinism for rule-based output
  topP: 0.3,             // Constrained: follow explicit rules exactly
  topK: 5,               // Minimal exploration
  thinkingBudget: 0,
  maxOutputTokens: 16384 // Large charts need more tokens
};

// Research Analysis: Detailed quality assessment
const RESEARCH_ANALYSIS_CONFIG = {
  temperature: 0.15,     // Slightly higher for nuanced analysis
  topP: 0.4,             // Moderate: allows varied recommendations
  topK: 8,               // Some exploration for insights
  thinkingBudget: 0,
  maxOutputTokens: 8192  // Detailed reports
};
function withTimeout(promise, timeoutMs, operationName) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
/**
 * Map content types to TaskType for routing
 */
const CONTENT_TYPE_TO_TASK = {
  'Roadmap': TaskType.ROADMAP,
  'Slides': TaskType.SLIDES,
  'Document': TaskType.DOCUMENT,
  'ResearchAnalysis': TaskType.RESEARCH_ANALYSIS
};

/**
 * Generate content using Gemini API with optional model routing
 *
 * @param {string} prompt - The prompt to send
 * @param {object} schema - JSON schema for structured output
 * @param {string} contentType - Type of content being generated
 * @param {object} configOverrides - Generation config overrides
 * @param {object} perfLogger - Performance logger instance
 * @param {object} routingOptions - Optional routing configuration
 * @returns {object} Generated content
 */
async function generateWithGemini(prompt, schema, contentType, configOverrides = {}, perfLogger = null, routingOptions = {}) {
  const timer = perfLogger ? createTimer(perfLogger, `api-${contentType.toLowerCase()}`) : null;

  // Determine model to use (routing or default)
  let modelId = 'models/gemini-flash-latest'; // Default fallback
  let routingDecision = null;

  if (isRoutingEnabled() && routingOptions.content) {
    try {
      const router = getRouter();
      const taskType = CONTENT_TYPE_TO_TASK[contentType] || TaskType.DOCUMENT;

      routingDecision = router.route(routingOptions.content, taskType, {
        fileCount: routingOptions.fileCount || 1,
        estimatedOutputTokens: configOverrides.maxOutputTokens || 4000
      });

      modelId = `models/${routingDecision.modelId}`;

      // Log routing decision
      if (perfLogger) {
        perfLogger.setMetadata(`routing-${contentType.toLowerCase()}`, {
          modelId: routingDecision.modelId,
          tier: routingDecision.tier,
          complexity: routingDecision.complexity.level,
          estimatedCost: routingDecision.estimatedCost,
          reasoning: routingDecision.reasoning
        });
      }
    } catch (routingError) {
      // Routing failed, fall back to default
      console.warn(`[Routing] Failed for ${contentType}, using default:`, routingError.message);
    }
  }

  try {
    const {
      temperature,
      topP,
      topK,
      maxOutputTokens,
      thinkingBudget = STRUCTURED_DEFAULT_CONFIG.thinkingBudget
    } = configOverrides;
    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema
    };
    if (thinkingBudget > 0) {
      generationConfig.thinkingConfig = { thinkingBudget };
    }
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (topP !== undefined) generationConfig.topP = topP;
    if (topK !== undefined) generationConfig.topK = topK;
    if (maxOutputTokens !== undefined) generationConfig.maxOutputTokens = maxOutputTokens;

    const model = genAI.getGenerativeModel({
      model: modelId,
      generationConfig
    });

    // Track prompt size
    if (perfLogger) {
      perfLogger.setMetadata(`prompt-size-${contentType.toLowerCase()}`, prompt.length);
    }

    console.log(`[Gemini] Starting ${contentType} generation with model ${modelId}...`);
    const result = await withTimeout(
      model.generateContent(prompt),
      GENERATION_TIMEOUT_MS,
      `${contentType} generation`
    );
    console.log(`[Gemini] ${contentType} generation complete`);
    const response = result.response;

    // Track token usage if available
    if (perfLogger && response.usageMetadata) {
      perfLogger.trackTokenUsage(contentType.toLowerCase(), response.usageMetadata);
    }

    const text = response.text();

    // Track response size
    if (perfLogger) {
      perfLogger.setMetadata(`response-size-${contentType.toLowerCase()}`, text.length);
    }

    // Parse timing
    const parseStart = Date.now();
    try {
      const data = JSON.parse(text);
      if (perfLogger) {
        perfLogger.setMetadata(`parse-time-${contentType.toLowerCase()}`, Date.now() - parseStart);
      }
      if (timer) timer.stop();
      return data;
    } catch (parseError) {
      const positionMatch = parseError.message.match(/position (\d+)/);
      const errorPosition = positionMatch ? parseInt(positionMatch[1]) : 0;
      if (errorPosition > 0) {
        const contextStart = Math.max(0, errorPosition - 200);
        const contextEnd = Math.min(text.length, errorPosition + 200);
      }
      try {
        const repairedJsonText = jsonrepair(text);
        const repairedData = JSON.parse(repairedJsonText);
        if (perfLogger) {
          perfLogger.setMetadata(`parse-time-${contentType.toLowerCase()}`, Date.now() - parseStart);
          perfLogger.setMetadata(`json-repair-${contentType.toLowerCase()}`, true);
        }
        if (timer) timer.stop();
        return repairedData;
      } catch (repairError) {
        if (timer) timer.stop();
        throw parseError; // Throw the original parse error
      }
    }
  } catch (error) {
    if (timer) timer.stop();
    if (perfLogger) {
      perfLogger.setMetadata(`error-${contentType.toLowerCase()}`, error.message);
    }
    throw new Error(`Failed to generate ${contentType}: ${error.message}`);
  }
}
async function generateRoadmap(userPrompt, researchFiles, perfLogger = null) {
  const contentType = 'roadmap';
  const combinedContent = combineResearchContent(researchFiles);
  const startTime = Date.now();

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        // Apply interval enforcement to cached data (in case old cache entries exist)
        const correctedCached = enforceYearlyIntervalsForLongRanges(cached);
        // Record cache hit metrics
        const generationId = recordGenerationMetrics({
          contentType: 'Roadmap',
          variantId: 'default',
          userPrompt,
          fileCount: researchFiles.length,
          cacheHit: true,
          latencyMs: Date.now() - startTime
        });
        return { success: true, data: correctedCached, _cached: true, _generationId: generationId };
      }
    }

    // Apply context engineering for optimized prompt assembly
    const contextResult = processContextEngineering(researchFiles, userPrompt, 'Roadmap', perfLogger);
    const processedFiles = contextResult.files;

    // Select variant and generate prompt (A/B testing)
    const variantResult = selectAndApplyVariant('Roadmap', userPrompt, processedFiles, generateRoadmapPrompt);

    // Log variant selection
    if (perfLogger && variantResult.usedVariant) {
      perfLogger.setMetadata('variant-roadmap', {
        id: variantResult.variantId,
        name: variantResult.variantName
      });
    }

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(variantResult.prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG, perfLogger, routingOptions);

    // Validate generated output (PROMPT ML Layer 6)
    const validationResult = validateGeneratedOutput(data, 'Roadmap', roadmapSchema, {
      userPrompt,
      researchFiles: processedFiles
    }, perfLogger);
    const validatedData = validationResult.data;

    // Fix: Ensure we have valid data before returning success
    if (validatedData === null || validatedData === undefined) {
      throw new Error('Roadmap generation completed but returned no data. The AI response may have been malformed.');
    }

    // Enforce yearly intervals for long time ranges (5+ years)
    // This corrects AI-generated quarterly/monthly intervals to yearly when appropriate
    const correctedData = enforceYearlyIntervalsForLongRanges(validatedData);

    // Store in cache (use corrected data so cached results also have yearly intervals)
    if (ENABLE_CACHE && correctedData) {
      setCachedContent(contentType, combinedContent, userPrompt, correctedData);
    }

    const latencyMs = Date.now() - startTime;

    // Record variant performance for A/B testing
    if (variantResult.usedVariant) {
      const perfMetrics = {
        latencyMs,
        qualityScore: validationResult.validation?.quality?.score || 0,
        success: validationResult.validation?.valid !== false
      };
      recordVariantPerformance(variantResult.variantId, perfMetrics);

      // Also record to active experiment if one exists
      recordExperimentMetric(variantResult.variantId, perfMetrics);
    }

    // Record generation metrics for auto-optimization
    const generationId = recordGenerationMetrics({
      contentType: 'Roadmap',
      variantId: variantResult.variantId,
      prompt: variantResult.prompt,
      userPrompt,
      fileCount: researchFiles.length,
      complexity: contextResult.metadata?.complexity || 0,
      latencyMs,
      inputTokens: contextResult.metadata?.tokensUsed || 0,
      cacheHit: false,
      validation: validationResult.validation
    });

    return {
      success: true,
      data: correctedData,
      _contextEngineering: contextResult.metadata,
      _variant: variantResult.usedVariant ? { id: variantResult.variantId, name: variantResult.variantName } : null,
      _validation: validationResult.validation,
      _generationId: generationId
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateSlides(userPrompt, researchFiles, perfLogger = null) {
  const contentType = 'slides';
  const combinedContent = combineResearchContent(researchFiles);
  const startTime = Date.now();

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        // Record cache hit metrics
        const generationId = recordGenerationMetrics({
          contentType: 'Slides',
          variantId: 'default',
          userPrompt,
          fileCount: researchFiles.length,
          cacheHit: true,
          latencyMs: Date.now() - startTime
        });
        return { success: true, data: cached, _cached: true, _generationId: generationId };
      }
    }

    // Apply context engineering for optimized prompt assembly
    const contextResult = processContextEngineering(researchFiles, userPrompt, 'Slides', perfLogger);
    const processedFiles = contextResult.files;

    // Select variant and generate prompt (A/B testing)
    const variantResult = selectAndApplyVariant('Slides', userPrompt, processedFiles, generateSlidesPrompt);

    // Log variant selection
    if (perfLogger && variantResult.usedVariant) {
      perfLogger.setMetadata('variant-slides', {
        id: variantResult.variantId,
        name: variantResult.variantName
      });
    }

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(variantResult.prompt, slidesSchema, 'Slides', SLIDES_CONFIG, perfLogger, routingOptions);

    // Validate generated output (PROMPT ML Layer 6)
    const validationResult = validateGeneratedOutput(data, 'Slides', slidesSchema, {
      userPrompt,
      researchFiles: processedFiles
    }, perfLogger);
    const validatedData = validationResult.data;

    // Fix: Ensure we have valid data before returning success
    if (validatedData === null || validatedData === undefined) {
      throw new Error('Slides generation completed but returned no data. The AI response may have been malformed.');
    }

    // Store in cache
    if (ENABLE_CACHE && validatedData) {
      setCachedContent(contentType, combinedContent, userPrompt, validatedData);
    }

    const latencyMs = Date.now() - startTime;

    // Record variant performance for A/B testing
    if (variantResult.usedVariant) {
      const perfMetrics = {
        latencyMs,
        qualityScore: validationResult.validation?.quality?.score || 0,
        success: validationResult.validation?.valid !== false
      };
      recordVariantPerformance(variantResult.variantId, perfMetrics);

      // Also record to active experiment if one exists
      recordExperimentMetric(variantResult.variantId, perfMetrics);
    }

    // Record generation metrics for auto-optimization
    const generationId = recordGenerationMetrics({
      contentType: 'Slides',
      variantId: variantResult.variantId,
      prompt: variantResult.prompt,
      userPrompt,
      fileCount: researchFiles.length,
      complexity: contextResult.metadata?.complexity || 0,
      latencyMs,
      inputTokens: contextResult.metadata?.tokensUsed || 0,
      cacheHit: false,
      validation: validationResult.validation
    });

    return {
      success: true,
      data: validatedData,
      _contextEngineering: contextResult.metadata,
      _variant: variantResult.usedVariant ? { id: variantResult.variantId, name: variantResult.variantName } : null,
      _validation: validationResult.validation,
      _generationId: generationId
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateDocument(userPrompt, researchFiles, perfLogger = null) {
  const contentType = 'document';
  const combinedContent = combineResearchContent(researchFiles);
  const startTime = Date.now();

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        // Record cache hit metrics
        const generationId = recordGenerationMetrics({
          contentType: 'Document',
          variantId: 'default',
          userPrompt,
          fileCount: researchFiles.length,
          cacheHit: true,
          latencyMs: Date.now() - startTime
        });
        return { success: true, data: cached, _cached: true, _generationId: generationId };
      }
    }

    // Apply context engineering for optimized prompt assembly
    const contextResult = processContextEngineering(researchFiles, userPrompt, 'Document', perfLogger);
    const processedFiles = contextResult.files;

    // Select variant and generate prompt (A/B testing)
    const variantResult = selectAndApplyVariant('Document', userPrompt, processedFiles, generateDocumentPrompt);

    // Log variant selection
    if (perfLogger && variantResult.usedVariant) {
      perfLogger.setMetadata('variant-document', {
        id: variantResult.variantId,
        name: variantResult.variantName
      });
    }

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(variantResult.prompt, documentSchema, 'Document', DOCUMENT_CONFIG, perfLogger, routingOptions);

    // Validate generated output (PROMPT ML Layer 6)
    const validationResult = validateGeneratedOutput(data, 'Document', documentSchema, {
      userPrompt,
      researchFiles: processedFiles
    }, perfLogger);
    const validatedData = validationResult.data;

    // Fix: Ensure we have valid data before returning success
    if (validatedData === null || validatedData === undefined) {
      throw new Error('Document generation completed but returned no data. The AI response may have been malformed.');
    }

    // Store in cache
    if (ENABLE_CACHE && validatedData) {
      setCachedContent(contentType, combinedContent, userPrompt, validatedData);
    }

    const latencyMs = Date.now() - startTime;

    // Record variant performance for A/B testing
    if (variantResult.usedVariant) {
      const perfMetrics = {
        latencyMs,
        qualityScore: validationResult.validation?.quality?.score || 0,
        success: validationResult.validation?.valid !== false
      };
      recordVariantPerformance(variantResult.variantId, perfMetrics);

      // Also record to active experiment if one exists
      recordExperimentMetric(variantResult.variantId, perfMetrics);
    }

    // Record generation metrics for auto-optimization
    const generationId = recordGenerationMetrics({
      contentType: 'Document',
      variantId: variantResult.variantId,
      prompt: variantResult.prompt,
      userPrompt,
      fileCount: researchFiles.length,
      complexity: contextResult.metadata?.complexity || 0,
      latencyMs,
      inputTokens: contextResult.metadata?.tokensUsed || 0,
      cacheHit: false,
      validation: validationResult.validation
    });

    return {
      success: true,
      data: validatedData,
      _contextEngineering: contextResult.metadata,
      _variant: variantResult.usedVariant ? { id: variantResult.variantId, name: variantResult.variantName } : null,
      _validation: validationResult.validation,
      _generationId: generationId
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateResearchAnalysis(userPrompt, researchFiles, perfLogger = null) {
  const contentType = 'researchAnalysis';
  const combinedContent = combineResearchContent(researchFiles);
  const startTime = Date.now();

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        // Record cache hit metrics
        const generationId = recordGenerationMetrics({
          contentType: 'ResearchAnalysis',
          variantId: 'default',
          userPrompt,
          fileCount: researchFiles.length,
          cacheHit: true,
          latencyMs: Date.now() - startTime
        });
        return { success: true, data: cached, _cached: true, _generationId: generationId };
      }
    }

    // Apply context engineering for optimized prompt assembly
    const contextResult = processContextEngineering(researchFiles, userPrompt, 'ResearchAnalysis', perfLogger);
    const processedFiles = contextResult.files;

    // Select variant and generate prompt (A/B testing)
    const variantResult = selectAndApplyVariant('ResearchAnalysis', userPrompt, processedFiles, generateResearchAnalysisPrompt);

    // Log variant selection
    if (perfLogger && variantResult.usedVariant) {
      perfLogger.setMetadata('variant-researchanalysis', {
        id: variantResult.variantId,
        name: variantResult.variantName
      });
    }

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(variantResult.prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG, perfLogger, routingOptions);

    // Validate generated output (PROMPT ML Layer 6)
    const validationResult = validateGeneratedOutput(data, 'ResearchAnalysis', researchAnalysisSchema, {
      userPrompt,
      researchFiles: processedFiles
    }, perfLogger);
    const validatedData = validationResult.data;

    // Fix: Ensure we have valid data before returning success
    if (validatedData === null || validatedData === undefined) {
      throw new Error('Research analysis generation completed but returned no data. The AI response may have been malformed.');
    }

    // Store in cache
    if (ENABLE_CACHE && validatedData) {
      setCachedContent(contentType, combinedContent, userPrompt, validatedData);
    }

    const latencyMs = Date.now() - startTime;

    // Record variant performance for A/B testing
    if (variantResult.usedVariant) {
      const perfMetrics = {
        latencyMs,
        qualityScore: validationResult.validation?.quality?.score || 0,
        success: validationResult.validation?.valid !== false
      };
      recordVariantPerformance(variantResult.variantId, perfMetrics);

      // Also record to active experiment if one exists
      recordExperimentMetric(variantResult.variantId, perfMetrics);
    }

    // Record generation metrics for auto-optimization
    const generationId = recordGenerationMetrics({
      contentType: 'ResearchAnalysis',
      variantId: variantResult.variantId,
      prompt: variantResult.prompt,
      userPrompt,
      fileCount: researchFiles.length,
      complexity: contextResult.metadata?.complexity || 0,
      latencyMs,
      inputTokens: contextResult.metadata?.tokensUsed || 0,
      cacheHit: false,
      validation: validationResult.validation
    });

    return {
      success: true,
      data: validatedData,
      _contextEngineering: contextResult.metadata,
      _variant: variantResult.usedVariant ? { id: variantResult.variantId, name: variantResult.variantName } : null,
      _validation: validationResult.validation,
      _generationId: generationId
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate all content types with controlled concurrency via API queue
 * This prevents overwhelming the Gemini API with too many simultaneous requests
 *
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Array of research file objects
 * @param {object} options - Options including sessionId for logging
 * @returns {object} Results with performance metrics
 */
export async function generateAllContent(userPrompt, researchFiles, options = {}) {
  // Initialize performance logger
  const perfLogger = new PerformanceLogger('generate-all-content', {
    sessionId: options.sessionId,
    enabled: true
  });

  // Track input metadata
  perfLogger.setMetadata('fileCount', researchFiles.length);
  perfLogger.setMetadata('totalInputSize', researchFiles.reduce((sum, f) => sum + (f.content?.length || 0), 0));
  perfLogger.setMetadata('promptLength', userPrompt.length);

  // Start observability tracking (PROMPT ML Layer 7)
  const observability = getObservability();
  const obsContext = observability?.startRequest({
    sessionId: options.sessionId,
    contentTypes: ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'],
    userPrompt,
    fileCount: researchFiles.length
  });

  try {
    // Use apiQueue.runAll to control concurrency and prevent rate limiting
    const tasks = [
      { task: () => generateRoadmap(userPrompt, researchFiles, perfLogger), name: 'Roadmap' },
      { task: () => generateSlides(userPrompt, researchFiles, perfLogger), name: 'Slides' },
      { task: () => generateDocument(userPrompt, researchFiles, perfLogger), name: 'Document' },
      { task: () => generateResearchAnalysis(userPrompt, researchFiles, perfLogger), name: 'ResearchAnalysis' }
    ];

    const [roadmap, slides, document, researchAnalysis] = await apiQueue.runAll(tasks);

    // Record validation metrics for each content type
    if (obsContext) {
      if (roadmap._validation) {
        recordValidationMetrics({ ...obsContext, contentType: 'Roadmap' }, roadmap._validation);
      }
      if (slides._validation) {
        recordValidationMetrics({ ...obsContext, contentType: 'Slides' }, slides._validation);
      }
      if (document._validation) {
        recordValidationMetrics({ ...obsContext, contentType: 'Document' }, document._validation);
      }
      if (researchAnalysis._validation) {
        recordValidationMetrics({ ...obsContext, contentType: 'ResearchAnalysis' }, researchAnalysis._validation);
      }
    }

    // Complete performance logging
    const perfReport = perfLogger.complete();

    // Store in global metrics for aggregation
    globalMetrics.addRequest(perfReport);

    // Log performance report
    perfLogger.logReport();

    // End observability tracking
    if (observability && obsContext) {
      await observability.endRequest(obsContext, {
        success: true,
        contentTypes: ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'],
        cached: roadmap._cached || slides._cached || document._cached || researchAnalysis._cached
      });
    }

    return {
      roadmap,
      slides,
      document,
      researchAnalysis,
      _performanceMetrics: perfReport,
      _observability: obsContext ? { traceId: obsContext.traceId } : null
    };
  } catch (error) {
    perfLogger.setMetadata('fatalError', error.message);
    perfLogger.complete();
    perfLogger.logReport();

    // Record error in observability
    if (observability && obsContext) {
      observability.observeError(obsContext, error);
      await observability.endRequest(obsContext, { success: false, error: error.message });
    }

    throw error;
  }
}
export async function regenerateContent(viewType, prompt, researchFiles, options = {}) {
  const perfLogger = new PerformanceLogger(`regenerate-${viewType}`, {
    sessionId: options.sessionId,
    enabled: true
  });

  try {
    const taskName = `Regenerate-${viewType}`;
    const task = async () => {
      switch (viewType) {
        case 'roadmap':
          return generateRoadmap(prompt, researchFiles, perfLogger);
        case 'slides':
          return generateSlides(prompt, researchFiles, perfLogger);
        case 'document':
          return generateDocument(prompt, researchFiles, perfLogger);
        case 'research-analysis':
          return generateResearchAnalysis(prompt, researchFiles, perfLogger);
        default:
          throw new Error(`Invalid view type: ${viewType}`);
      }
    };
    const result = await apiQueue.add(task, taskName);

    // Complete performance logging
    const perfReport = perfLogger.complete();
    globalMetrics.addRequest(perfReport);
    perfLogger.logReport();

    return { ...result, _performanceMetrics: perfReport };
  } catch (error) {
    perfLogger.setMetadata('error', error.message);
    perfLogger.complete();
    perfLogger.logReport();
    throw error;
  }
}

// Export metrics for monitoring endpoints
export { globalMetrics, apiQueue, getCacheMetrics, speculativeGenerator };

// Export interval enforcement for use in content retrieval
export { enforceYearlyIntervalsForLongRanges };

// Export variant management functions
export {
  selectVariant,
  recordVariantPerformance,
  initializeVariants,
  getVariantStats,
  getSelectionHistory,
  promoteVariant,
  registerVariant,
  getVariant,
  getVariants,
  getChampion,
  ContentType as VariantContentType
} from './layers/optimization/variants/index.js';

// Export experiment management functions
export {
  startExperiment,
  concludeExperiment,
  getActiveExperiment,
  getExperimentSummary,
  checkAndConcludeExperiments,
  ExperimentStatus
} from './layers/optimization/experiments/index.js';

// Export evolution/auto-optimization functions
export {
  startEvolution,
  stopEvolution,
  runOptimizationCycle,
  generateVariant,
  getMutationStrategies,
  getEvolutionSummary,
  getEvolutionStats,
  getEvolutionHistory,
  updateEvolutionConfig,
  MutationStrategy,
  SchedulerState
} from './layers/optimization/evolution/index.js';

// Export dashboard functions
export {
  getDashboardData,
  getDashboardSummary,
  getInsights,
  getRecommendations,
  getVariantPerformance,
  getExperimentStatus,
  getEvolutionStatus,
  getTrends,
  clearDashboardCache,
  TimePeriod
} from './layers/optimization/dashboard/index.js';

/**
 * Get observability metrics summary
 * Returns tracing stats, LLM metrics, and recent traces
 *
 * @returns {Object} Observability summary
 */
export function getObservabilityMetrics() {
  const observability = getObservability();
  if (!observability) {
    return { enabled: false };
  }

  return {
    enabled: true,
    ...observability.getSummary()
  };
}

/**
 * Get recent traces for debugging
 *
 * @param {number} count - Number of traces to return
 * @returns {Array} Recent traces
 */
export function getRecentTraces(count = 10) {
  const observability = getObservability();
  if (!observability) {
    return [];
  }

  return observability.getRecentTraces(count);
}

/**
 * Get metrics in Prometheus format
 *
 * @returns {string} Prometheus-formatted metrics
 */
export function getPrometheusMetrics() {
  const observability = getObservability();
  if (!observability) {
    return '# Observability disabled\n';
  }

  return observability.getPrometheusMetrics();
}

/**
 * Get evaluation summary including feedback and suggestions
 *
 * @returns {Object} Evaluation summary
 */
export function getEvaluationSummary() {
  const evaluation = getEvaluation();
  if (!evaluation) {
    return { enabled: false };
  }

  return {
    enabled: true,
    ...evaluation.getSummary()
  };
}

/**
 * Record user feedback for generated content
 *
 * @param {string} feedbackType - Type of feedback (rating, thumbs, comment, etc.)
 * @param {string} contentType - Content type (roadmap, slides, document, research-analysis)
 * @param {*} value - Feedback value
 * @param {Object} context - Additional context (sessionId, traceId)
 * @returns {Object|null} Feedback entry
 */
export function submitFeedback(feedbackType, contentType, value, context = {}) {
  return recordUserFeedback(feedbackType, contentType, value, context);
}

/**
 * Get improvement suggestions based on collected feedback
 *
 * @returns {Array} Improvement suggestions
 */
export function getImprovementSuggestions() {
  const evaluation = getEvaluation();
  if (!evaluation || !evaluation.feedbackCollector) {
    return [];
  }

  return evaluation.feedbackCollector.getImprovementSuggestions();
}

/**
 * Get optimization summary including prompt, cache, and performance optimization
 *
 * @returns {Object} Optimization summary
 */
export function getOptimizationSummary() {
  const optimization = getOptimization();
  if (!optimization) {
    return { enabled: false };
  }

  return {
    enabled: true,
    ...optimization.getSummary()
  };
}

/**
 * Get all optimization recommendations
 *
 * @returns {Array} Optimization recommendations
 */
export function getOptimizationRecommendations() {
  const optimization = getOptimization();
  if (!optimization) {
    return [];
  }

  return optimization.getAllRecommendations();
}

/**
 * Run auto-tuning cycle for optimization
 *
 * @returns {Object} Tuning results
 */
export function runAutoTuning() {
  const optimization = getOptimization();
  if (!optimization) {
    return { enabled: false };
  }

  return optimization.autoTune();
}

/**
 * Set optimization tuning mode
 *
 * @param {string} mode - Tuning mode (conservative, balanced, aggressive, auto)
 */
export function setOptimizationMode(mode) {
  const optimization = getOptimization();
  if (!optimization) return;

  const modeMap = {
    'conservative': TuningMode.CONSERVATIVE,
    'balanced': TuningMode.BALANCED,
    'aggressive': TuningMode.AGGRESSIVE,
    'auto': TuningMode.AUTO
  };

  const tuningMode = modeMap[mode] || TuningMode.BALANCED;
  optimization.setTuningMode(tuningMode);
}

/**
 * Get monitoring health report
 *
 * @returns {Object} Health report
 */
export async function getHealthReport() {
  const monitoring = getMonitoring();
  if (!monitoring) {
    return { enabled: false };
  }

  return {
    enabled: true,
    ...(await monitoring.getHealthReport())
  };
}

/**
 * Get monitoring liveness status (for Kubernetes probes)
 *
 * @returns {Object} Liveness status
 */
export async function getLiveness() {
  const monitoring = getMonitoring();
  if (!monitoring) {
    return { alive: true, status: 'unknown' };
  }

  return monitoring.getLiveness();
}

/**
 * Get monitoring readiness status (for Kubernetes probes)
 *
 * @returns {Object} Readiness status
 */
export async function getReadiness() {
  const monitoring = getMonitoring();
  if (!monitoring) {
    return { ready: true, status: 'unknown' };
  }

  return monitoring.getReadiness();
}

/**
 * Get monitoring dashboard data
 *
 * @returns {Object} Dashboard data
 */
export function getMonitoringDashboard() {
  const monitoring = getMonitoring();
  if (!monitoring) {
    return { enabled: false };
  }

  return {
    enabled: true,
    ...monitoring.getDashboardData()
  };
}

/**
 * Get active alerts from monitoring
 *
 * @param {string} minSeverity - Minimum severity filter
 * @returns {Array} Active alerts
 */
export function getMonitoringAlerts(minSeverity = null) {
  const monitoring = getMonitoring();
  if (!monitoring) {
    return [];
  }

  return monitoring.getActiveAlerts(minSeverity);
}

/**
 * Get monitoring summary including health, metrics, and alerts
 *
 * @returns {Object} Comprehensive monitoring summary
 */
export async function getMonitoringSummary() {
  const monitoring = getMonitoring();
  if (!monitoring) {
    return { enabled: false };
  }

  return {
    enabled: true,
    ...(await monitoring.getSummary())
  };
}

/**
 * Export monitoring metrics in Prometheus format
 *
 * @returns {string} Prometheus-formatted metrics
 */
export function getMonitoringMetrics() {
  const monitoring = getMonitoring();
  if (!monitoring) {
    return '# Monitoring disabled\n';
  }

  return monitoring.exportMetrics('prometheus');
}

/**
 * Acknowledge a monitoring alert
 *
 * @param {string} alertId - Alert ID
 * @param {string} by - Acknowledger
 * @returns {Object|null} Updated alert
 */
export function acknowledgeAlert(alertId, by = 'user') {
  const monitoring = getMonitoring();
  if (!monitoring) return null;

  return monitoring.acknowledgeAlert(alertId, by);
}

/**
 * Resolve a monitoring alert
 *
 * @param {string} alertId - Alert ID
 * @param {string} resolution - Resolution note
 * @returns {Object|null} Updated alert
 */
export function resolveAlert(alertId, resolution = '') {
  const monitoring = getMonitoring();
  if (!monitoring) return null;

  return monitoring.resolveAlert(alertId, resolution);
}

/**
 * Generate all content types with streaming - emits results as each completes
 * Uses callbacks to stream results to the client via SSE
 *
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Array of research file objects
 * @param {object} options - Options including sessionId and callbacks
 * @param {Function} options.onContentReady - Called when a content type completes: (type, result) => void
 * @param {Function} options.onProgress - Called for progress updates: (message) => void
 * @param {Function} options.onComplete - Called when all content is ready: (results) => void
 * @param {Function} options.onError - Called on fatal error: (error) => void
 * @returns {Promise<object>} Final results object
 */
export async function generateAllContentStreaming(userPrompt, researchFiles, options = {}) {
  const {
    sessionId,
    onContentReady = () => {},
    onProgress = () => {},
    onComplete = () => {},
    onError = () => {}
  } = options;

  // Initialize performance logger
  const perfLogger = new PerformanceLogger('generate-all-content-streaming', {
    sessionId,
    enabled: true
  });

  // Track input metadata
  perfLogger.setMetadata('fileCount', researchFiles.length);
  perfLogger.setMetadata('totalInputSize', researchFiles.reduce((sum, f) => sum + (f.content?.length || 0), 0));
  perfLogger.setMetadata('promptLength', userPrompt.length);

  const results = {
    roadmap: null,
    slides: null,
    document: null,
    researchAnalysis: null
  };

  // Content type mapping for consistent naming
  const typeMapping = {
    'Slides': 'slides',
    'Document': 'document',
    'Roadmap': 'roadmap',
    'ResearchAnalysis': 'research-analysis'
  };

  try {
    onProgress('Starting content generation...');

    // Create tasks that emit results as they complete
    const createStreamingTask = (generator, name, viewType) => async () => {
      onProgress(`Generating ${name}...`);
      const result = await generator(userPrompt, researchFiles, perfLogger);
      const mappedType = typeMapping[name] || viewType;

      // Store result
      results[viewType] = result;

      // Emit to callback immediately
      onContentReady(mappedType, result);
      onProgress(`${name} complete`);

      return result;
    };

    // Define tasks with priority (Document and Slides are fastest, emit first)
    const tasks = [
      { task: createStreamingTask(generateDocument, 'Document', 'document'), name: 'Document' },
      { task: createStreamingTask(generateSlides, 'Slides', 'slides'), name: 'Slides' },
      { task: createStreamingTask(generateRoadmap, 'Roadmap', 'roadmap'), name: 'Roadmap' },
      { task: createStreamingTask(generateResearchAnalysis, 'ResearchAnalysis', 'researchAnalysis'), name: 'ResearchAnalysis' }
    ];

    // Run all tasks (they'll emit as they complete due to queue priority)
    await apiQueue.runAll(tasks);

    // Complete performance logging
    const perfReport = perfLogger.complete();
    globalMetrics.addRequest(perfReport);
    perfLogger.logReport();

    // Add performance metrics to results
    results._performanceMetrics = perfReport;

    // Signal completion
    onComplete(results);

    return results;

  } catch (error) {
    perfLogger.setMetadata('fatalError', error.message);
    perfLogger.complete();
    perfLogger.logReport();
    onError(error);
    throw error;
  }
}
