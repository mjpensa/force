/**
 * DSPy Integration Module
 *
 * Gap 06 & 07: Full DSPy service integration for content generation
 * and automatic optimization feedback loop.
 *
 * This module:
 * 1. Routes content generation through the DSPy service
 * 2. Collects training examples from successful generations
 * 3. Triggers automatic optimization when sufficient examples are collected
 * 4. Uses optimized modules for subsequent generations
 *
 * Usage:
 *   import { dspyIntegration } from './utils/dspyIntegration.js';
 *
 *   // Generate content using DSPy
 *   const result = await dspyIntegration.generate('roadmap', prompt, research);
 *
 *   // Record training example for optimization
 *   await dspyIntegration.recordTrainingExample('roadmap', inputs, output, score);
 *
 *   // Trigger optimization
 *   await dspyIntegration.optimizeSignature('roadmap');
 */

import { getRedisClient } from '../redis/client.js';
import { dspyCache } from '../redis/dspy-cache.js';
import { logGenerationEvent, logEvolutionEvent } from '../redis/event-stream.js';
import { publishTrainingEvent } from '../redis/pubsub.js';
import { variantMetrics } from '../redis/variant-metrics.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const DSPY_SERVICE_URL = process.env.DSPY_SERVICE_URL || 'http://localhost:8001';

const SIGNATURE_TYPES = ['roadmap', 'slides', 'document', 'research-analysis'];

const CONTENT_TYPE_TO_SIGNATURE = {
  'Roadmap': 'roadmap',
  'Slides': 'slides',
  'Document': 'document',
  'ResearchAnalysis': 'research-analysis'
};

// Optimization thresholds
const OPTIMIZATION_CONFIG = {
  minExamplesForOptimization: 20,    // Minimum examples before optimizing
  minQualityScore: 3.5,              // Minimum quality to use as training example
  maxExamplesPerSignature: 100,      // Max examples to keep
  optimizationCooldownMs: 3600000,   // 1 hour between optimizations
  autoOptimizeThreshold: 50          // Auto-optimize after this many examples
};

// Redis keys for training examples
const REDIS_KEYS = {
  examples: (type) => `force:dspy:training:${type}:examples`,
  exampleCount: (type) => `force:dspy:training:${type}:count`,
  lastOptimized: (type) => `force:dspy:training:${type}:lastOptimized`,
  optimizationStats: (type) => `force:dspy:training:${type}:stats`
};

// ============================================================================
// DSPY SERVICE CLIENT
// ============================================================================

/**
 * Make HTTP request to DSPy service
 */
async function dspyRequest(endpoint, method = 'GET', body = null) {
  const url = `${DSPY_SERVICE_URL}${endpoint}`;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `DSPy service error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.warn('[DSPyIntegration] DSPy service not available, falling back');
      return null;
    }
    throw error;
  }
}

/**
 * Check if DSPy service is available
 */
async function isDspyServiceAvailable() {
  try {
    const health = await dspyRequest('/health');
    return health?.status === 'healthy' && health?.lm_configured;
  } catch {
    return false;
  }
}

// ============================================================================
// TRAINING EXAMPLE MANAGEMENT
// ============================================================================

/**
 * Record a training example for future optimization
 *
 * @param {string} signatureType - Signature type (roadmap, slides, etc.)
 * @param {Object} inputs - Generation inputs
 * @param {Object} output - Generation output
 * @param {number} qualityScore - Quality score (1-5)
 * @param {Object} metadata - Additional metadata
 */
async function recordTrainingExample(signatureType, inputs, output, qualityScore, metadata = {}) {
  // Validate signature type
  if (!SIGNATURE_TYPES.includes(signatureType)) {
    console.warn(`[DSPyIntegration] Invalid signature type: ${signatureType}`);
    return false;
  }

  // Only record high-quality examples
  if (qualityScore < OPTIMIZATION_CONFIG.minQualityScore) {
    console.log(`[DSPyIntegration] Skipping low-quality example (${qualityScore.toFixed(2)})`);
    return false;
  }

  const client = await getRedisClient();
  if (!client) {
    console.warn('[DSPyIntegration] Redis not available for training example storage');
    return false;
  }

  try {
    const example = {
      user_prompt: inputs.prompt || inputs.userPrompt,
      research_content: summarizeResearchContent(inputs.researchFiles || inputs.research_files || []),
      expected_output: output,
      quality_score: qualityScore,
      metadata: {
        ...metadata,
        recordedAt: Date.now(),
        contentType: inputs.contentType
      }
    };

    const exampleKey = REDIS_KEYS.examples(signatureType);

    // Add example to list (using LPUSH for newest first)
    await client.lpush(exampleKey, JSON.stringify(example));

    // Trim to max examples
    await client.ltrim(exampleKey, 0, OPTIMIZATION_CONFIG.maxExamplesPerSignature - 1);

    // Update count
    const count = await client.llen(exampleKey);
    await client.set(REDIS_KEYS.exampleCount(signatureType), count);

    console.log(`[DSPyIntegration] Recorded training example for ${signatureType} (${count} total)`);

    // Check if we should auto-optimize
    if (count >= OPTIMIZATION_CONFIG.autoOptimizeThreshold) {
      const lastOptimized = await client.get(REDIS_KEYS.lastOptimized(signatureType));
      const cooldownPassed = !lastOptimized ||
        (Date.now() - parseInt(lastOptimized)) > OPTIMIZATION_CONFIG.optimizationCooldownMs;

      if (cooldownPassed) {
        console.log(`[DSPyIntegration] Auto-optimization threshold reached for ${signatureType}`);
        // Trigger async optimization (don't await)
        optimizeSignature(signatureType).catch(err => {
          console.error(`[DSPyIntegration] Auto-optimization failed: ${err.message}`);
        });
      }
    }

    return true;

  } catch (error) {
    console.error(`[DSPyIntegration] Error recording training example:`, error.message);
    return false;
  }
}

/**
 * Get training examples for a signature type
 */
async function getTrainingExamples(signatureType, limit = 50) {
  const client = await getRedisClient();
  if (!client) return [];

  try {
    const exampleKey = REDIS_KEYS.examples(signatureType);
    const examples = await client.lrange(exampleKey, 0, limit - 1);
    return examples.map(e => JSON.parse(e));
  } catch (error) {
    console.error(`[DSPyIntegration] Error getting training examples:`, error.message);
    return [];
  }
}

/**
 * Summarize research content for DSPy training
 * (Full content is too large for training examples)
 */
function summarizeResearchContent(files) {
  if (!files || files.length === 0) return '';

  const MAX_CONTENT_LENGTH = 2000;
  const summaries = [];

  for (const file of files.slice(0, 3)) { // Max 3 files
    const content = file.content || file.text || '';
    const filename = file.filename || file.name || 'file';

    // Take first 500 chars of each file
    const excerpt = content.slice(0, 500);
    summaries.push(`[${filename}]: ${excerpt}...`);
  }

  const combined = summaries.join('\n\n');
  return combined.slice(0, MAX_CONTENT_LENGTH);
}

// ============================================================================
// OPTIMIZATION
// ============================================================================

/**
 * Trigger DSPy optimization for a signature type
 *
 * @param {string} signatureType - Signature type to optimize
 * @param {Object} options - Optimization options
 */
async function optimizeSignature(signatureType, options = {}) {
  const {
    optimizer = 'bootstrap',  // 'bootstrap' or 'mipro'
    maxDemos = 4
  } = options;

  console.log(`\n🧬 [DSPyIntegration] Starting optimization for ${signatureType}`);

  // Check if DSPy service is available
  if (!await isDspyServiceAvailable()) {
    console.warn('[DSPyIntegration] DSPy service not available for optimization');
    return { success: false, reason: 'service_unavailable' };
  }

  // Get training examples
  const examples = await getTrainingExamples(signatureType, 50);

  if (examples.length < OPTIMIZATION_CONFIG.minExamplesForOptimization) {
    console.log(`[DSPyIntegration] Not enough examples (${examples.length}/${OPTIMIZATION_CONFIG.minExamplesForOptimization})`);
    return { success: false, reason: 'insufficient_examples', count: examples.length };
  }

  try {
    // Log evolution event
    await logEvolutionEvent({
      event: 'optimization_started',
      signatureType,
      exampleCount: examples.length,
      optimizer
    });

    // Publish training event
    await publishTrainingEvent('optimization_started', {
      signatureType,
      exampleCount: examples.length
    });

    // Call DSPy optimization endpoint
    const result = await dspyRequest('/optimize', 'POST', {
      signature_type: signatureType,
      examples: examples.map(e => ({
        user_prompt: e.user_prompt,
        research_content: e.research_content,
        expected_output: e.expected_output,
        quality_score: e.quality_score
      })),
      optimizer,
      config: {
        max_demos: maxDemos
      }
    });

    if (result?.success) {
      // Update optimization timestamp
      const client = await getRedisClient();
      if (client) {
        await client.set(REDIS_KEYS.lastOptimized(signatureType), Date.now());
        await client.set(REDIS_KEYS.optimizationStats(signatureType), JSON.stringify({
          lastOptimized: new Date().toISOString(),
          examplesUsed: examples.length,
          optimizer,
          metrics: result.metrics
        }));
      }

      // Log success
      await logEvolutionEvent({
        event: 'optimization_completed',
        signatureType,
        success: true,
        metrics: result.metrics
      });

      await publishTrainingEvent('optimization_completed', {
        signatureType,
        success: true,
        metrics: result.metrics
      });

      console.log(`✅ [DSPyIntegration] Optimization completed for ${signatureType}`);
      console.log(`   Few-shot examples: ${result.metrics?.few_shot_count || 0}`);

      return {
        success: true,
        signatureType,
        metrics: result.metrics,
        optimizedInstructions: result.optimized_instructions
      };
    }

    return { success: false, reason: 'optimization_failed' };

  } catch (error) {
    console.error(`[DSPyIntegration] Optimization error:`, error.message);

    await logEvolutionEvent({
      event: 'optimization_failed',
      signatureType,
      error: error.message
    });

    return { success: false, reason: 'error', error: error.message };
  }
}

// ============================================================================
// CONTENT GENERATION THROUGH DSPY
// ============================================================================

/**
 * Generate content using DSPy service
 *
 * Falls back to direct generation if DSPy service is unavailable.
 *
 * @param {string} signatureType - Signature type
 * @param {string} prompt - User prompt
 * @param {Array} researchFiles - Research files
 * @param {Object} options - Generation options
 */
async function generateWithDspy(signatureType, prompt, researchFiles, options = {}) {
  const {
    useOptimized = true,
    fallbackGenerator = null,
    recordAsExample = true
  } = options;

  const startTime = Date.now();

  // Check cache first
  const cacheInputs = {
    prompt,
    researchFiles,
    modelTier: 'standard',
    temperature: 0
  };

  const cached = await dspyCache.get(signatureType, cacheInputs);
  if (cached) {
    console.log(`[DSPyIntegration] Cache hit for ${signatureType}`);

    // Log generation event
    await logGenerationEvent({
      signatureType,
      cacheHit: true,
      latencyMs: Date.now() - startTime
    });

    return {
      ...cached.result,
      __cacheHit: true,
      __source: 'cache'
    };
  }

  // Try DSPy service
  if (await isDspyServiceAvailable()) {
    try {
      const researchContent = researchFiles.map(f => f.content || f.text || '').join('\n\n');

      const result = await dspyRequest('/generate', 'POST', {
        signature_type: signatureType,
        user_prompt: prompt,
        research_content: researchContent.slice(0, 50000), // Limit size
        use_optimized: useOptimized
      });

      if (result?.success) {
        const output = {
          success: true,
          data: result.output,
          _variant: { id: result.used_optimized ? 'dspy_optimized' : 'dspy_base' },
          _generationId: `dspy_${Date.now()}`,
          _latencyMs: Date.now() - startTime
        };

        // Cache the result
        await dspyCache.set(signatureType, cacheInputs, output, {
          model: 'dspy',
          modelTier: 'standard',
          latencyMs: output._latencyMs
        });

        // Record variant metrics
        await variantMetrics.recordScore(
          result.used_optimized ? 'dspy_optimized' : 'dspy_base',
          4, // Assume quality score for now
          getContentTypeFromSignature(signatureType)
        );

        // Log generation event
        await logGenerationEvent({
          signatureType,
          cacheHit: false,
          source: 'dspy_service',
          usedOptimized: result.used_optimized,
          latencyMs: output._latencyMs
        });

        console.log(`[DSPyIntegration] Generated via DSPy service (${result.used_optimized ? 'optimized' : 'base'})`);

        return {
          ...output,
          __cacheHit: false,
          __source: result.used_optimized ? 'dspy_optimized' : 'dspy_base'
        };
      }
    } catch (error) {
      console.warn(`[DSPyIntegration] DSPy generation failed, using fallback: ${error.message}`);
    }
  }

  // Fallback to direct generator
  if (fallbackGenerator) {
    console.log(`[DSPyIntegration] Using fallback generator for ${signatureType}`);

    const result = await fallbackGenerator(prompt, researchFiles);

    // Log generation event
    await logGenerationEvent({
      signatureType,
      cacheHit: false,
      source: 'fallback',
      latencyMs: Date.now() - startTime
    });

    return {
      ...result,
      __cacheHit: false,
      __source: 'fallback'
    };
  }

  throw new Error(`DSPy service unavailable and no fallback generator provided for ${signatureType}`);
}

/**
 * Create a wrapped generator that uses DSPy with fallback
 */
function createDspyGenerator(signatureType, fallbackGenerator, options = {}) {
  return async function dspyWrappedGenerator(prompt, researchFiles) {
    return generateWithDspy(signatureType, prompt, researchFiles, {
      ...options,
      fallbackGenerator
    });
  };
}

// ============================================================================
// TRAINING INTEGRATION
// ============================================================================

/**
 * Process generation result for training
 *
 * Records high-quality generations as training examples for future optimization.
 *
 * @param {string} contentType - Content type (Roadmap, Slides, etc.)
 * @param {Object} inputs - Generation inputs
 * @param {Object} result - Generation result
 * @param {Object} feedback - Feedback with quality scores
 */
async function processForTraining(contentType, inputs, result, feedback) {
  if (!result?.success || !result?.data) {
    return false;
  }

  const signatureType = CONTENT_TYPE_TO_SIGNATURE[contentType];
  if (!signatureType) {
    console.warn(`[DSPyIntegration] Unknown content type: ${contentType}`);
    return false;
  }

  try {
    // Record as training example
    const recorded = await recordTrainingExample(
      signatureType,
      {
        prompt: inputs.prompt,
        researchFiles: inputs.researchFiles || inputs.research_files,
        contentType
      },
      result.data,
      feedback.rating || feedback.qualityScore || 3,
      {
        variant: result._variant?.id,
        generationId: result._generationId,
        source: result.__source
      }
    );

    // Record to variant metrics (non-blocking, catch errors silently)
    if (result._variant?.id) {
      variantMetrics.recordScore(
        result._variant.id,
        feedback.rating || feedback.qualityScore || 3,
        contentType
      ).catch(err => {
        console.warn(`[DSPyIntegration] Variant metrics error: ${err.message}`);
      });
    }

    return recorded;
  } catch (error) {
    console.error(`[DSPyIntegration] Error processing for training: ${error.message}`);
    return false;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getContentTypeFromSignature(signatureType) {
  const mapping = {
    'roadmap': 'Roadmap',
    'slides': 'Slides',
    'document': 'Document',
    'research-analysis': 'ResearchAnalysis'
  };
  return mapping[signatureType] || signatureType;
}

// ============================================================================
// STATUS AND STATISTICS
// ============================================================================

/**
 * Get DSPy integration status
 */
async function getStatus() {
  const serviceAvailable = await isDspyServiceAvailable();
  const client = await getRedisClient();

  const status = {
    serviceAvailable,
    redisAvailable: client !== null,
    signatures: {}
  };

  if (client) {
    for (const sigType of SIGNATURE_TYPES) {
      const count = await client.get(REDIS_KEYS.exampleCount(sigType));
      const lastOptimized = await client.get(REDIS_KEYS.lastOptimized(sigType));
      const stats = await client.get(REDIS_KEYS.optimizationStats(sigType));

      status.signatures[sigType] = {
        trainingExamples: parseInt(count) || 0,
        lastOptimized: lastOptimized ? new Date(parseInt(lastOptimized)).toISOString() : null,
        optimizationStats: stats ? JSON.parse(stats) : null
      };
    }
  }

  // Check if signatures are optimized in DSPy service
  if (serviceAvailable) {
    try {
      const signatures = await dspyRequest('/signatures');
      for (const sig of signatures?.signatures || []) {
        if (status.signatures[sig.signature_type]) {
          status.signatures[sig.signature_type].isOptimized = sig.is_optimized;
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return status;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const dspyIntegration = {
  // Generation
  generate: generateWithDspy,
  createGenerator: createDspyGenerator,

  // Training
  recordTrainingExample,
  getTrainingExamples,
  processForTraining,

  // Optimization
  optimize: optimizeSignature,

  // Status
  getStatus,
  isServiceAvailable: isDspyServiceAvailable,

  // Constants
  SIGNATURE_TYPES,
  CONTENT_TYPE_TO_SIGNATURE,
  OPTIMIZATION_CONFIG
};

export default dspyIntegration;
