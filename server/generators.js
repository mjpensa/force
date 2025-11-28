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

// Feature flag for caching - can be disabled for testing
const ENABLE_CACHE = true;

// Feature flag for context engineering layer
const ENABLE_CONTEXT_ENGINEERING = process.env.ENABLE_CONTEXT_ENGINEERING !== 'false';

// Feature flag for DSPy-style signatures (experimental)
const ENABLE_SIGNATURES = process.env.ENABLE_SIGNATURES === 'true';

// Feature flag for output validation (PROMPT ML Layer 6)
const ENABLE_OUTPUT_VALIDATION = process.env.ENABLE_OUTPUT_VALIDATION !== 'false';

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

    const result = await withTimeout(
      model.generateContent(prompt),
      GENERATION_TIMEOUT_MS,
      `${contentType} generation`
    );
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

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        return { success: true, data: cached, _cached: true };
      }
    }

    // Apply context engineering for optimized prompt assembly
    const contextResult = processContextEngineering(researchFiles, userPrompt, 'Roadmap', perfLogger);
    const processedFiles = contextResult.files;

    // Generate prompt (optionally using signatures)
    const promptResult = generatePromptWithSignature(
      'Roadmap', userPrompt, processedFiles, generateRoadmapPrompt, perfLogger
    );

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(promptResult.prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG, perfLogger, routingOptions);

    // Validate generated output (PROMPT ML Layer 6)
    const validationResult = validateGeneratedOutput(data, 'Roadmap', roadmapSchema, {
      userPrompt,
      researchFiles: processedFiles
    }, perfLogger);
    const validatedData = validationResult.data;

    // Store in cache
    if (ENABLE_CACHE && validatedData) {
      setCachedContent(contentType, combinedContent, userPrompt, validatedData);
    }

    return {
      success: true,
      data: validatedData,
      _contextEngineering: contextResult.metadata,
      _signature: promptResult.usedSignature ? promptResult.signatureType : null,
      _validation: validationResult.validation
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateSlides(userPrompt, researchFiles, perfLogger = null) {
  const contentType = 'slides';
  const combinedContent = combineResearchContent(researchFiles);

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        return { success: true, data: cached, _cached: true };
      }
    }

    // Apply context engineering for optimized prompt assembly
    const contextResult = processContextEngineering(researchFiles, userPrompt, 'Slides', perfLogger);
    const processedFiles = contextResult.files;

    // Generate prompt (optionally using signatures)
    const promptResult = generatePromptWithSignature(
      'Slides', userPrompt, processedFiles, generateSlidesPrompt, perfLogger
    );

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(promptResult.prompt, slidesSchema, 'Slides', SLIDES_CONFIG, perfLogger, routingOptions);

    // Validate generated output (PROMPT ML Layer 6)
    const validationResult = validateGeneratedOutput(data, 'Slides', slidesSchema, {
      userPrompt,
      researchFiles: processedFiles
    }, perfLogger);
    const validatedData = validationResult.data;

    // Store in cache
    if (ENABLE_CACHE && validatedData) {
      setCachedContent(contentType, combinedContent, userPrompt, validatedData);
    }

    return {
      success: true,
      data: validatedData,
      _contextEngineering: contextResult.metadata,
      _signature: promptResult.usedSignature ? promptResult.signatureType : null,
      _validation: validationResult.validation
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateDocument(userPrompt, researchFiles, perfLogger = null) {
  const contentType = 'document';
  const combinedContent = combineResearchContent(researchFiles);

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        return { success: true, data: cached, _cached: true };
      }
    }

    // Apply context engineering for optimized prompt assembly
    const contextResult = processContextEngineering(researchFiles, userPrompt, 'Document', perfLogger);
    const processedFiles = contextResult.files;

    // Generate prompt (optionally using signatures)
    const promptResult = generatePromptWithSignature(
      'Document', userPrompt, processedFiles, generateDocumentPrompt, perfLogger
    );

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(promptResult.prompt, documentSchema, 'Document', DOCUMENT_CONFIG, perfLogger, routingOptions);

    // Validate generated output (PROMPT ML Layer 6)
    const validationResult = validateGeneratedOutput(data, 'Document', documentSchema, {
      userPrompt,
      researchFiles: processedFiles
    }, perfLogger);
    const validatedData = validationResult.data;

    // Store in cache
    if (ENABLE_CACHE && validatedData) {
      setCachedContent(contentType, combinedContent, userPrompt, validatedData);
    }

    return {
      success: true,
      data: validatedData,
      _contextEngineering: contextResult.metadata,
      _signature: promptResult.usedSignature ? promptResult.signatureType : null,
      _validation: validationResult.validation
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateResearchAnalysis(userPrompt, researchFiles, perfLogger = null) {
  const contentType = 'researchAnalysis';
  const combinedContent = combineResearchContent(researchFiles);

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        return { success: true, data: cached, _cached: true };
      }
    }

    // Apply context engineering for optimized prompt assembly
    const contextResult = processContextEngineering(researchFiles, userPrompt, 'ResearchAnalysis', perfLogger);
    const processedFiles = contextResult.files;

    // Generate prompt (optionally using signatures)
    const promptResult = generatePromptWithSignature(
      'ResearchAnalysis', userPrompt, processedFiles, generateResearchAnalysisPrompt, perfLogger
    );

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(promptResult.prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG, perfLogger, routingOptions);

    // Validate generated output (PROMPT ML Layer 6)
    const validationResult = validateGeneratedOutput(data, 'ResearchAnalysis', researchAnalysisSchema, {
      userPrompt,
      researchFiles: processedFiles
    }, perfLogger);
    const validatedData = validationResult.data;

    // Store in cache
    if (ENABLE_CACHE && validatedData) {
      setCachedContent(contentType, combinedContent, userPrompt, validatedData);
    }

    return {
      success: true,
      data: validatedData,
      _contextEngineering: contextResult.metadata,
      _signature: promptResult.usedSignature ? promptResult.signatureType : null,
      _validation: validationResult.validation
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

  try {
    // Use apiQueue.runAll to control concurrency and prevent rate limiting
    const tasks = [
      { task: () => generateRoadmap(userPrompt, researchFiles, perfLogger), name: 'Roadmap' },
      { task: () => generateSlides(userPrompt, researchFiles, perfLogger), name: 'Slides' },
      { task: () => generateDocument(userPrompt, researchFiles, perfLogger), name: 'Document' },
      { task: () => generateResearchAnalysis(userPrompt, researchFiles, perfLogger), name: 'ResearchAnalysis' }
    ];

    const [roadmap, slides, document, researchAnalysis] = await apiQueue.runAll(tasks);

    // Complete performance logging
    const perfReport = perfLogger.complete();

    // Store in global metrics for aggregation
    globalMetrics.addRequest(perfReport);

    // Log performance report
    perfLogger.logReport();

    return {
      roadmap,
      slides,
      document,
      researchAnalysis,
      _performanceMetrics: perfReport
    };
  } catch (error) {
    perfLogger.setMetadata('fatalError', error.message);
    perfLogger.complete();
    perfLogger.logReport();
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
