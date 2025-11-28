/**
 * Model Router - PROMPT ML Layer 5
 *
 * Selects the optimal model for each request based on:
 * - Content complexity
 * - Task type
 * - Cost constraints
 * - Quality requirements
 *
 * Based on PROMPT ML design specification.
 */

import { getClassifier, ComplexityLevel, TaskType } from './classifier.js';

/**
 * Model tier definitions
 * @readonly
 * @enum {string}
 */
export const ModelTier = {
  FAST: 'fast',         // Cheapest, fastest, simpler tasks
  STANDARD: 'standard', // Balanced cost/quality
  ADVANCED: 'advanced'  // Most capable, highest cost
};

/**
 * @typedef {Object} ModelConfig
 * @property {string} id - Model identifier for API calls
 * @property {string} tier - Model tier (fast/standard/advanced)
 * @property {number} inputCostPer1M - Input cost per 1M tokens (USD)
 * @property {number} outputCostPer1M - Output cost per 1M tokens (USD)
 * @property {number} maxOutputTokens - Maximum output tokens
 * @property {number} contextWindow - Context window size
 * @property {number} qualityScore - Relative quality score (0-1)
 * @property {boolean} supportsStructuredOutput - Whether model supports JSON mode
 */

/**
 * @typedef {Object} RoutingDecision
 * @property {string} modelId - Selected model ID
 * @property {string} tier - Model tier
 * @property {Object} modelConfig - Full model configuration
 * @property {number} estimatedCost - Estimated cost for this request
 * @property {string} reasoning - Why this model was selected
 * @property {Object} alternatives - Alternative model options
 * @property {Object} complexity - Complexity analysis used for routing
 */

/**
 * @typedef {Object} RouterConfig
 * @property {Object} models - Model configurations
 * @property {Object} routing - Routing rules
 * @property {Object} constraints - Cost/quality constraints
 */

/**
 * Default model configurations
 */
const DEFAULT_MODELS = {
  // Fast tier - for simple tasks
  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    tier: ModelTier.FAST,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    maxOutputTokens: 8192,
    contextWindow: 1000000,
    qualityScore: 0.7,
    supportsStructuredOutput: true
  },

  // Standard tier - balanced
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    tier: ModelTier.STANDARD,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    maxOutputTokens: 65536,
    contextWindow: 1000000,
    qualityScore: 0.85,
    supportsStructuredOutput: true
  },

  // Also standard tier (preview version)
  'gemini-2.5-flash-preview-09-2025': {
    id: 'gemini-2.5-flash-preview-09-2025',
    tier: ModelTier.STANDARD,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    maxOutputTokens: 65536,
    contextWindow: 1000000,
    qualityScore: 0.88,
    supportsStructuredOutput: true
  },

  // Advanced tier - for complex tasks
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    tier: ModelTier.ADVANCED,
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.00,
    maxOutputTokens: 65536,
    contextWindow: 2000000,
    qualityScore: 0.95,
    supportsStructuredOutput: true
  }
};

/**
 * Default routing configuration
 */
const DEFAULT_CONFIG = {
  models: DEFAULT_MODELS,

  // Default model for each tier
  defaultModels: {
    [ModelTier.FAST]: 'gemini-2.0-flash-lite',
    [ModelTier.STANDARD]: 'gemini-2.5-flash-preview-09-2025',
    [ModelTier.ADVANCED]: 'gemini-2.5-pro'
  },

  // Task-specific model preferences
  taskPreferences: {
    [TaskType.ROADMAP]: ModelTier.STANDARD,      // Needs good reasoning
    [TaskType.SLIDES]: ModelTier.FAST,           // Simpler summarization
    [TaskType.DOCUMENT]: ModelTier.STANDARD,     // Comprehensive analysis
    [TaskType.RESEARCH_ANALYSIS]: ModelTier.STANDARD, // Quality assessment
    [TaskType.QA]: ModelTier.FAST                // Quick responses
  },

  // Complexity to tier mapping
  complexityMapping: {
    [ComplexityLevel.SIMPLE]: ModelTier.FAST,
    [ComplexityLevel.MEDIUM]: ModelTier.STANDARD,
    [ComplexityLevel.COMPLEX]: ModelTier.STANDARD,
    [ComplexityLevel.VERY_COMPLEX]: ModelTier.ADVANCED
  },

  // Constraints
  constraints: {
    maxCostPerRequest: 0.50,    // USD
    preferCostOverQuality: false,
    enableAdvancedTier: true
  }
};

/**
 * Model Router class
 */
export class ModelRouter {
  /**
   * @param {RouterConfig} config - Configuration options
   */
  constructor(config = {}) {
    this.config = this._mergeConfig(DEFAULT_CONFIG, config);
    this.classifier = getClassifier();

    // Statistics
    this._stats = {
      totalRoutes: 0,
      routesByTier: {
        [ModelTier.FAST]: 0,
        [ModelTier.STANDARD]: 0,
        [ModelTier.ADVANCED]: 0
      },
      totalEstimatedCost: 0,
      routesByTask: {}
    };
  }

  /**
   * Route a request to the optimal model
   *
   * @param {string} content - Content to process
   * @param {string} taskType - Type of task
   * @param {Object} options - Routing options
   * @param {number} options.estimatedOutputTokens - Expected output tokens
   * @param {number} options.maxCost - Maximum acceptable cost
   * @param {boolean} options.preferQuality - Prefer quality over cost
   * @param {string} options.forceTier - Force a specific tier
   * @param {number} options.fileCount - Number of source files
   * @returns {RoutingDecision} Routing decision
   */
  route(content, taskType = TaskType.DOCUMENT, options = {}) {
    const {
      estimatedOutputTokens = this._estimateOutputTokens(taskType),
      maxCost = this.config.constraints.maxCostPerRequest,
      preferQuality = !this.config.constraints.preferCostOverQuality,
      forceTier = null,
      fileCount = 1
    } = options;

    // Step 1: Analyze complexity
    const complexity = this.classifier.classify(content, taskType, { fileCount });

    // Step 2: Determine initial tier
    let targetTier;
    if (forceTier && Object.values(ModelTier).includes(forceTier)) {
      targetTier = forceTier;
    } else {
      targetTier = this._determineTier(complexity, taskType, preferQuality);
    }

    // Step 3: Check cost constraints
    const estimatedInputTokens = Math.ceil(content.length / 4);
    let modelId = this.config.defaultModels[targetTier];
    let modelConfig = this.config.models[modelId];

    let estimatedCost = this._estimateCost(modelConfig, estimatedInputTokens, estimatedOutputTokens);

    // If over budget, try to downgrade
    if (estimatedCost > maxCost && !forceTier) {
      const downgradeResult = this._tryDowngrade(
        targetTier,
        estimatedInputTokens,
        estimatedOutputTokens,
        maxCost
      );
      if (downgradeResult) {
        targetTier = downgradeResult.tier;
        modelId = downgradeResult.modelId;
        modelConfig = downgradeResult.modelConfig;
        estimatedCost = downgradeResult.cost;
      }
    }

    // Step 4: Build alternatives
    const alternatives = this._buildAlternatives(
      targetTier,
      estimatedInputTokens,
      estimatedOutputTokens
    );

    // Step 5: Generate reasoning
    const reasoning = this._generateReasoning(
      complexity,
      taskType,
      targetTier,
      estimatedCost,
      forceTier
    );

    // Update stats
    this._updateStats(targetTier, taskType, estimatedCost);

    return {
      modelId,
      tier: targetTier,
      modelConfig,
      estimatedCost,
      reasoning,
      alternatives,
      complexity
    };
  }

  /**
   * Quick route without full complexity analysis
   *
   * @param {string} content - Content to process
   * @param {string} taskType - Type of task
   * @returns {string} Model ID
   */
  quickRoute(content, taskType = TaskType.DOCUMENT) {
    const complexityLevel = this.classifier.quickClassify(content, taskType);
    const tier = this.config.complexityMapping[complexityLevel];
    return this.config.defaultModels[tier];
  }

  /**
   * Get model configuration by ID
   *
   * @param {string} modelId - Model identifier
   * @returns {ModelConfig|null} Model configuration
   */
  getModel(modelId) {
    return this.config.models[modelId] || null;
  }

  /**
   * Get all available models
   *
   * @returns {Object} All model configurations
   */
  getModels() {
    return { ...this.config.models };
  }

  /**
   * Get routing statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Estimate cost for a request
   *
   * @param {string} modelId - Model to use
   * @param {number} inputTokens - Input token count
   * @param {number} outputTokens - Output token count
   * @returns {number} Estimated cost in USD
   */
  estimateCost(modelId, inputTokens, outputTokens) {
    const modelConfig = this.config.models[modelId];
    if (!modelConfig) return 0;
    return this._estimateCost(modelConfig, inputTokens, outputTokens);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Merge configurations
   * @private
   */
  _mergeConfig(defaults, overrides) {
    return {
      models: { ...defaults.models, ...(overrides.models || {}) },
      defaultModels: { ...defaults.defaultModels, ...(overrides.defaultModels || {}) },
      taskPreferences: { ...defaults.taskPreferences, ...(overrides.taskPreferences || {}) },
      complexityMapping: { ...defaults.complexityMapping, ...(overrides.complexityMapping || {}) },
      constraints: { ...defaults.constraints, ...(overrides.constraints || {}) }
    };
  }

  /**
   * Determine target tier based on complexity and task
   * @private
   */
  _determineTier(complexity, taskType, preferQuality) {
    // Start with complexity-based tier
    let tier = this.config.complexityMapping[complexity.level];

    // Consider task preferences
    const taskPreference = this.config.taskPreferences[taskType];
    if (taskPreference) {
      // Use higher of complexity and task preference if preferQuality
      if (preferQuality) {
        const tierRank = { [ModelTier.FAST]: 1, [ModelTier.STANDARD]: 2, [ModelTier.ADVANCED]: 3 };
        if (tierRank[taskPreference] > tierRank[tier]) {
          tier = taskPreference;
        }
      }
    }

    // Check if advanced tier is enabled
    if (tier === ModelTier.ADVANCED && !this.config.constraints.enableAdvancedTier) {
      tier = ModelTier.STANDARD;
    }

    return tier;
  }

  /**
   * Try to downgrade to cheaper tier
   * @private
   */
  _tryDowngrade(currentTier, inputTokens, outputTokens, maxCost) {
    const tierOrder = [ModelTier.ADVANCED, ModelTier.STANDARD, ModelTier.FAST];
    const currentIndex = tierOrder.indexOf(currentTier);

    // Try each lower tier
    for (let i = currentIndex + 1; i < tierOrder.length; i++) {
      const tier = tierOrder[i];
      const modelId = this.config.defaultModels[tier];
      const modelConfig = this.config.models[modelId];

      if (!modelConfig) continue;

      const cost = this._estimateCost(modelConfig, inputTokens, outputTokens);
      if (cost <= maxCost) {
        return { tier, modelId, modelConfig, cost };
      }
    }

    return null;
  }

  /**
   * Build alternative model options
   * @private
   */
  _buildAlternatives(selectedTier, inputTokens, outputTokens) {
    const alternatives = {};

    for (const tier of Object.values(ModelTier)) {
      if (tier === selectedTier) continue;

      const modelId = this.config.defaultModels[tier];
      const modelConfig = this.config.models[modelId];

      if (modelConfig) {
        alternatives[tier] = {
          modelId,
          estimatedCost: this._estimateCost(modelConfig, inputTokens, outputTokens),
          qualityScore: modelConfig.qualityScore
        };
      }
    }

    return alternatives;
  }

  /**
   * Estimate output tokens for task type
   * @private
   */
  _estimateOutputTokens(taskType) {
    const estimates = {
      [TaskType.ROADMAP]: 4000,
      [TaskType.SLIDES]: 3000,
      [TaskType.DOCUMENT]: 5000,
      [TaskType.RESEARCH_ANALYSIS]: 2500,
      [TaskType.QA]: 500
    };
    return estimates[taskType] || 3000;
  }

  /**
   * Calculate cost estimate
   * @private
   */
  _estimateCost(modelConfig, inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1000000) * modelConfig.inputCostPer1M;
    const outputCost = (outputTokens / 1000000) * modelConfig.outputCostPer1M;
    return inputCost + outputCost;
  }

  /**
   * Generate routing reasoning
   * @private
   */
  _generateReasoning(complexity, taskType, tier, cost, forceTier) {
    const parts = [];

    if (forceTier) {
      parts.push(`Tier forced to ${tier}`);
    } else {
      parts.push(`Complexity: ${complexity.level} (${(complexity.score * 100).toFixed(0)}%)`);
      parts.push(`Task: ${taskType}`);
      parts.push(`Selected tier: ${tier}`);
    }

    parts.push(`Estimated cost: $${cost.toFixed(4)}`);

    return parts.join('. ');
  }

  /**
   * Update statistics
   * @private
   */
  _updateStats(tier, taskType, cost) {
    this._stats.totalRoutes++;
    this._stats.routesByTier[tier]++;
    this._stats.totalEstimatedCost += cost;

    if (!this._stats.routesByTask[taskType]) {
      this._stats.routesByTask[taskType] = 0;
    }
    this._stats.routesByTask[taskType]++;
  }
}

/**
 * Create a model router with configuration
 * @param {RouterConfig} config - Configuration
 * @returns {ModelRouter}
 */
export function createRouter(config = {}) {
  return new ModelRouter(config);
}

// Singleton instance
let _instance = null;

/**
 * Get or create singleton router instance
 * @param {RouterConfig} config - Configuration (only used on first call)
 * @returns {ModelRouter}
 */
export function getRouter(config = {}) {
  if (!_instance) {
    _instance = new ModelRouter(config);
  }
  return _instance;
}

/**
 * Quick routing function
 * @param {string} content - Content to process
 * @param {string} taskType - Task type
 * @returns {string} Model ID
 */
export function routeToModel(content, taskType = TaskType.DOCUMENT) {
  return getRouter().quickRoute(content, taskType);
}

/**
 * Full routing function
 * @param {string} content - Content to process
 * @param {string} taskType - Task type
 * @param {Object} options - Options
 * @returns {RoutingDecision} Routing decision
 */
export function routeRequest(content, taskType = TaskType.DOCUMENT, options = {}) {
  return getRouter().route(content, taskType, options);
}

export default ModelRouter;
