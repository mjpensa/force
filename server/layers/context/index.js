/**
 * Context Engineering Layer - PROMPT ML Layer 2
 *
 * Unified export and orchestration for context engineering:
 * - Token counting and budgeting
 * - Content compression
 * - Context assembly
 * - Task-specific strategies
 *
 * Based on PROMPT ML design specification.
 */

// Token Counter exports
export {
  TokenCounter,
  createTokenCounter,
  getTokenCounter,
  countTokens,
  fitsInBudget
} from './token-counter.js';

// Assembler exports
export {
  ContextAssembler,
  ContextPriority,
  createAssembler,
  getAssembler,
  assembleContext
} from './assembler.js';

// Compressor exports
export {
  ContentCompressor,
  CompressionStrategy,
  createCompressor,
  getCompressor,
  compressContent
} from './compressor.js';

// Strategy exports
export {
  StrategyType,
  STRATEGIES,
  getStrategy,
  applyPreprocessing,
  getBudgetAllocation,
  getTaskInstructions,
  buildTaskDescription,
  ContextStrategyManager,
  getStrategyManager
} from './strategies.js';

/**
 * @typedef {Object} ContextEngineeringResult
 * @property {string} prompt - Final assembled prompt
 * @property {Object} context - Assembled context details
 * @property {Object} compression - Compression details if applied
 * @property {Object} strategy - Strategy used
 * @property {Object} tokenUsage - Token usage breakdown
 */

/**
 * Main Context Engineering Layer class
 * Orchestrates all context engineering operations
 */
export class ContextEngineeringLayer {
  constructor(config = {}) {
    this.config = {
      defaultBudget: 8000,
      autoCompress: true,
      useStrategies: true,
      ...config
    };

    // Lazy-load components
    this._tokenCounter = null;
    this._assembler = null;
    this._compressor = null;
    this._strategyManager = null;
  }

  /**
   * Get token counter instance
   */
  get tokenCounter() {
    if (!this._tokenCounter) {
      const { getTokenCounter } = require('./token-counter.js');
      this._tokenCounter = getTokenCounter();
    }
    return this._tokenCounter;
  }

  /**
   * Get assembler instance
   */
  get assembler() {
    if (!this._assembler) {
      const { getAssembler } = require('./assembler.js');
      this._assembler = getAssembler();
    }
    return this._assembler;
  }

  /**
   * Get compressor instance
   */
  get compressor() {
    if (!this._compressor) {
      const { getCompressor } = require('./compressor.js');
      this._compressor = getCompressor();
    }
    return this._compressor;
  }

  /**
   * Get strategy manager instance
   */
  get strategyManager() {
    if (!this._strategyManager) {
      const { getStrategyManager } = require('./strategies.js');
      this._strategyManager = getStrategyManager();
    }
    return this._strategyManager;
  }

  /**
   * Process content through the full context engineering pipeline
   *
   * @param {Object} params - Processing parameters
   * @param {Object[]} params.researchFiles - Research files [{filename, content}]
   * @param {string} params.userPrompt - User's prompt
   * @param {string} params.taskType - Type of task
   * @param {number} params.tokenBudget - Optional token budget override
   * @returns {ContextEngineeringResult} Processed context
   */
  process(params) {
    const {
      researchFiles = [],
      userPrompt = '',
      taskType = 'document',
      tokenBudget = this.config.defaultBudget
    } = params;

    const startTime = Date.now();
    const result = {
      prompt: '',
      context: null,
      compression: null,
      strategy: null,
      tokenUsage: {
        budget: tokenBudget,
        used: 0,
        available: tokenBudget
      },
      metadata: {
        processingTimeMs: 0,
        taskType,
        fileCount: researchFiles.length
      }
    };

    // Step 1: Get strategy for task type
    if (this.config.useStrategies) {
      result.strategy = this.strategyManager.getStrategy(taskType);
    }

    // Step 2: Calculate budget allocation
    const { getBudgetAllocation } = require('./strategies.js');
    const budgetAllocation = getBudgetAllocation(taskType, tokenBudget);

    // Step 3: Preprocess content if strategy defines it
    let processedFiles = researchFiles;
    if (result.strategy?.preprocess) {
      processedFiles = researchFiles.map(file => ({
        filename: file.filename,
        content: result.strategy.preprocess(file.content)
      }));
    }

    // Step 4: Check if compression needed
    const totalContentTokens = processedFiles.reduce(
      (sum, f) => sum + this.tokenCounter.count(f.content).tokens,
      0
    );

    if (this.config.autoCompress && totalContentTokens > budgetAllocation.absolute.content) {
      // Apply compression
      const compressedFiles = this.compressor.compressMultiple(
        processedFiles,
        budgetAllocation.absolute.content
      );

      result.compression = {
        applied: true,
        originalTokens: totalContentTokens,
        compressedTokens: compressedFiles.reduce(
          (sum, f) => sum + (f.compressedTokens || this.tokenCounter.count(f.content).tokens),
          0
        ),
        filesCompressed: compressedFiles.filter(f => f.compressionApplied).length
      };

      processedFiles = compressedFiles;
    }

    // Step 5: Build task description with strategy guidance
    const { buildTaskDescription } = require('./strategies.js');
    const taskDescription = buildTaskDescription(taskType, userPrompt);

    // Step 6: Assemble context
    const assembled = this.assembler.assemble({
      taskDescription,
      researchFiles: processedFiles,
      userPrompt,
      taskType,
      budget: {
        totalTokens: tokenBudget,
        allocations: budgetAllocation.percentages,
        minimums: {
          task: 200,
          content: 500,
          meta: 50
        }
      }
    });

    result.context = assembled;

    // Step 7: Build final prompt
    result.prompt = this.assembler.buildPrompt(assembled);

    // Step 8: Calculate final token usage
    result.tokenUsage = {
      budget: tokenBudget,
      used: assembled.totalTokens,
      available: tokenBudget - assembled.totalTokens,
      utilization: assembled.budgetUsed
    };

    // Finalize metadata
    result.metadata.processingTimeMs = Date.now() - startTime;

    return result;
  }

  /**
   * Quick token count for content
   *
   * @param {string|string[]} content - Content to count
   * @returns {number} Token count
   */
  countTokens(content) {
    if (Array.isArray(content)) {
      return content.reduce(
        (sum, c) => sum + this.tokenCounter.count(c).tokens,
        0
      );
    }
    return this.tokenCounter.count(content).tokens;
  }

  /**
   * Check if content fits in budget
   *
   * @param {string} content - Content to check
   * @param {number} budget - Token budget
   * @returns {Object} Fit check result
   */
  checkBudget(content, budget) {
    return this.tokenCounter.fitsInBudget(content, budget);
  }

  /**
   * Compress content to target tokens
   *
   * @param {string} content - Content to compress
   * @param {number} targetTokens - Target token count
   * @returns {Object} Compression result
   */
  compress(content, targetTokens) {
    return this.compressor.compress(content, targetTokens);
  }

  /**
   * Get statistics about processed context
   *
   * @param {ContextEngineeringResult} result - Processing result
   * @returns {Object} Statistics
   */
  getStats(result) {
    const stats = {
      tokenBudget: result.tokenUsage.budget,
      tokensUsed: result.tokenUsage.used,
      utilization: `${(result.tokenUsage.utilization * 100).toFixed(1)}%`,
      taskType: result.metadata.taskType,
      filesProcessed: result.metadata.fileCount,
      processingTimeMs: result.metadata.processingTimeMs
    };

    if (result.compression?.applied) {
      stats.compression = {
        applied: true,
        originalTokens: result.compression.originalTokens,
        compressedTokens: result.compression.compressedTokens,
        savedTokens: result.compression.originalTokens - result.compression.compressedTokens,
        ratio: (result.compression.compressedTokens / result.compression.originalTokens).toFixed(2)
      };
    }

    if (result.context) {
      stats.components = this.assembler.getStats(result.context);
    }

    return stats;
  }
}

// Singleton instance
let _layer = null;

/**
 * Get or create singleton context engineering layer
 * @param {Object} config - Configuration (only used on first call)
 * @returns {ContextEngineeringLayer}
 */
export function getContextLayer(config = {}) {
  if (!_layer) {
    _layer = new ContextEngineeringLayer(config);
  }
  return _layer;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetContextLayer() {
  _layer = null;
}

/**
 * Quick process function
 *
 * @param {Object} params - Processing parameters
 * @returns {ContextEngineeringResult}
 */
export function processContext(params) {
  return getContextLayer().process(params);
}

export default ContextEngineeringLayer;
