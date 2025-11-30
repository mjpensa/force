/**
 * DSPy Executor with Caching
 *
 * Plan 09: Wrapper for DSPy signature execution with automatic caching
 *
 * Provides seamless integration between content generation and the DSPy cache.
 *
 * Usage:
 *   import { executeWithCache } from './utils/dspyExecutor.js';
 *
 *   const result = await executeWithCache('roadmap', inputs, async () => {
 *     return await generateContent(inputs);
 *   });
 */

import { dspyCache } from '../redis/dspy-cache.js';

/**
 * Execute content generation with caching
 *
 * @param {string} signatureType - Signature type (roadmap, document, research-analysis)
 * @param {Object} inputs - Generation inputs
 * @param {Function} executor - Async function that performs the actual generation
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Result with cache info
 */
export async function executeWithCache(signatureType, inputs, executor, options = {}) {
  const {
    skipCache = false,
    forceRefresh = false,
    modelTier = 'standard',
    temperature = 0,
    model = null
  } = options;

  // Normalize inputs for caching
  const cacheInputs = {
    prompt: inputs.prompt || inputs.userPrompt || inputs.taskName,
    researchFiles: inputs.researchFiles || inputs.research_files || inputs.files || [],
    modelTier,
    temperature
  };

  // Check cache first (unless skipping or forcing refresh)
  if (!skipCache && !forceRefresh) {
    const cached = await dspyCache.get(signatureType, cacheInputs);

    if (cached) {
      return {
        ...cached.result,
        __cacheHit: true,
        __cacheInfo: cached.cacheInfo,
        __metadata: cached.metadata
      };
    }
  }

  // Execute the actual generation
  const startTime = Date.now();
  let result;
  let executionMetadata = {};

  try {
    result = await executor();

    // Extract metadata from result if present
    executionMetadata = {
      model: result.__model || model || 'unknown',
      modelTier,
      inputTokens: result.__inputTokens || result.inputTokens || 0,
      outputTokens: result.__outputTokens || result.outputTokens || 0,
      latencyMs: Date.now() - startTime
    };

    // Clean internal fields from result before caching
    const cleanResult = { ...result };
    delete cleanResult.__model;
    delete cleanResult.__inputTokens;
    delete cleanResult.__outputTokens;
    delete cleanResult.__cacheHit;
    delete cleanResult.__cacheInfo;
    delete cleanResult.__metadata;
    delete cleanResult.__executionMetadata;

    // Cache result (unless skipping cache)
    if (!skipCache) {
      const cacheKey = await dspyCache.set(signatureType, cacheInputs, cleanResult, executionMetadata);
      if (cacheKey) {
        console.log(`[DSPyExecutor] Cached result for ${signatureType}`);
      }
    }

    return {
      ...cleanResult,
      __cacheHit: false,
      __executionMetadata: executionMetadata
    };

  } catch (error) {
    // Don't cache errors, just rethrow
    throw error;
  }
}

/**
 * Batch execute with caching
 * Useful for processing multiple prompts with potential cache hits
 *
 * @param {string} signatureType - Signature type
 * @param {Array} inputsArray - Array of inputs to process
 * @param {Function} executor - Function that takes inputs and returns result
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Results with summary
 */
export async function executeBatchWithCache(signatureType, inputsArray, executor, options = {}) {
  const results = [];

  for (const inputs of inputsArray) {
    try {
      const result = await executeWithCache(
        signatureType,
        inputs,
        () => executor(inputs),
        options
      );
      results.push({ success: true, result, inputs });
    } catch (error) {
      results.push({ success: false, error: error.message, inputs });
    }
  }

  const cacheHits = results.filter(r => r.success && r.result.__cacheHit).length;
  const cacheMisses = results.filter(r => r.success && !r.result.__cacheHit).length;
  const errors = results.filter(r => !r.success).length;

  return {
    results,
    summary: {
      total: inputsArray.length,
      cacheHits,
      cacheMisses,
      errors,
      cacheHitRate: inputsArray.length > 0
        ? ((cacheHits / inputsArray.length) * 100).toFixed(1) + '%'
        : '0%'
    }
  };
}

/**
 * Check if inputs would result in cache hit (without retrieving result)
 *
 * @param {string} signatureType - Signature type
 * @param {Object} inputs - Generation inputs
 * @param {Object} options - Options (modelTier, temperature)
 * @returns {Promise<boolean>}
 */
export async function wouldCacheHit(signatureType, inputs, options = {}) {
  const cacheInputs = {
    prompt: inputs.prompt || inputs.userPrompt || inputs.taskName,
    researchFiles: inputs.researchFiles || inputs.research_files || inputs.files || [],
    modelTier: options.modelTier || 'standard',
    temperature: options.temperature ?? 0
  };

  return dspyCache.exists(signatureType, cacheInputs);
}

/**
 * Invalidate cache for specific inputs
 *
 * @param {string} signatureType - Signature type (optional)
 * @param {Object} inputs - Specific inputs to invalidate (optional)
 * @returns {Promise<number>} Number of entries invalidated
 */
export async function invalidateCache(signatureType = null, inputs = null) {
  if (inputs) {
    // Generate the specific key and invalidate it
    const { generateCacheKey } = await import('../redis/dspy-cache.js');
    const cacheInputs = {
      prompt: inputs.prompt || inputs.userPrompt || inputs.taskName,
      researchFiles: inputs.researchFiles || inputs.research_files || inputs.files || [],
      modelTier: inputs.modelTier || 'standard',
      temperature: inputs.temperature ?? 0
    };
    const keyInfo = generateCacheKey(signatureType, cacheInputs);
    return dspyCache.invalidate(null, keyInfo.fullKey);
  }

  // Invalidate by type or all
  return dspyCache.invalidate(signatureType);
}

/**
 * Get cache statistics
 *
 * @param {string} signatureType - Filter by type (optional)
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats(signatureType = null) {
  return dspyCache.getStats(signatureType);
}

/**
 * Create a cached version of a generator function
 *
 * @param {string} signatureType - Signature type
 * @param {Function} generator - Generator function
 * @param {Object} defaultOptions - Default options
 * @returns {Function} Cached generator function
 */
export function createCachedGenerator(signatureType, generator, defaultOptions = {}) {
  return async function cachedGenerator(inputs, options = {}) {
    const mergedOptions = { ...defaultOptions, ...options };
    return executeWithCache(signatureType, inputs, () => generator(inputs), mergedOptions);
  };
}

export default {
  executeWithCache,
  executeBatchWithCache,
  wouldCacheHit,
  invalidateCache,
  getCacheStats,
  createCachedGenerator
};
