/**
 * Variant Generator - Phase 4 of Auto-Improving Prompts
 *
 * Generates new prompt variants through mutation strategies.
 * Uses performance data to guide improvements.
 *
 * @module evolution/generator
 */

import { randomUUID } from 'crypto';
import { getVariantRegistry, VariantStatus } from '../variants/index.js';
import { getMetricsCollector } from '../metrics/index.js';

/**
 * Mutation strategies for prompt evolution
 */
export const MutationStrategy = {
  CONCISE: 'concise',           // Make prompt more concise
  DETAILED: 'detailed',         // Add more detail/examples
  STRUCTURED: 'structured',     // Add more structure/sections
  INSTRUCTIVE: 'instructive',   // Add explicit instructions
  EXAMPLE_BASED: 'example_based', // Add examples
  CONSTRAINT_FOCUSED: 'constraint_focused', // Emphasize constraints
  OUTPUT_FOCUSED: 'output_focused', // Focus on output format
  HYBRID: 'hybrid'              // Combine multiple strategies
};

/**
 * Prompt transformation patterns
 */
const TRANSFORMATIONS = {
  [MutationStrategy.CONCISE]: {
    name: 'Concise',
    description: 'Reduce token count while maintaining meaning',
    patterns: [
      { from: /You are an? /gi, to: '' },
      { from: /Please /gi, to: '' },
      { from: /MUST /gi, to: 'Must ' },
      { from: /\n\n+/g, to: '\n\n' },
      { from: /\s{2,}/g, to: ' ' },
      { from: /^[-*]\s*/gm, to: '- ' }
    ],
    sectionReduction: 0.8  // Target 80% of original length
  },

  [MutationStrategy.DETAILED]: {
    name: 'Detailed',
    description: 'Add clarifying details and examples',
    additions: [
      { trigger: /output/i, add: ' (ensure proper formatting)' },
      { trigger: /json/i, add: ' with valid syntax' },
      { trigger: /date/i, add: ' in ISO format when possible' }
    ]
  },

  [MutationStrategy.STRUCTURED]: {
    name: 'Structured',
    description: 'Add section headers and numbered steps',
    wrappers: {
      prefix: '## INSTRUCTIONS\n\nFollow these steps:\n\n',
      suffix: '\n\n## OUTPUT\nRespond with the requested format only.'
    }
  },

  [MutationStrategy.INSTRUCTIVE]: {
    name: 'Instructive',
    description: 'Add explicit do/don\'t instructions',
    additions: [
      '\n\n## DO:\n- Follow the schema exactly\n- Use factual information only\n- Be concise and clear',
      '\n\n## DON\'T:\n- Make up information\n- Include commentary\n- Deviate from the format'
    ]
  },

  [MutationStrategy.CONSTRAINT_FOCUSED]: {
    name: 'Constraint-Focused',
    description: 'Emphasize constraints and requirements',
    prefix: 'CRITICAL REQUIREMENTS:\n\n',
    highlight: [
      { pattern: /must/gi, wrapper: '**MUST**' },
      { pattern: /required/gi, wrapper: '**REQUIRED**' },
      { pattern: /never/gi, wrapper: '**NEVER**' }
    ]
  },

  [MutationStrategy.OUTPUT_FOCUSED]: {
    name: 'Output-Focused',
    description: 'Emphasize output format and structure',
    suffix: '\n\n## OUTPUT FORMAT\nRespond with ONLY the JSON object. No explanations, no markdown code blocks, just valid JSON.'
  }
};

/**
 * Apply a mutation strategy to a prompt template
 *
 * @param {string} template - Original prompt template
 * @param {string} strategy - Mutation strategy
 * @returns {string} Mutated template
 */
export function applyMutation(template, strategy) {
  const transform = TRANSFORMATIONS[strategy];
  if (!transform) {
    return template;
  }

  let result = template;

  // Apply pattern replacements
  if (transform.patterns) {
    for (const { from, to } of transform.patterns) {
      result = result.replace(from, to);
    }
  }

  // Apply prefix
  if (transform.prefix) {
    result = transform.prefix + result;
  }

  // Apply suffix
  if (transform.suffix) {
    result = result + transform.suffix;
  }

  // Apply wrappers
  if (transform.wrappers) {
    result = transform.wrappers.prefix + result + transform.wrappers.suffix;
  }

  // Apply additions
  if (transform.additions) {
    if (Array.isArray(transform.additions)) {
      for (const addition of transform.additions) {
        if (typeof addition === 'string') {
          result = result + addition;
        } else if (addition.trigger && addition.trigger.test(result)) {
          result = result.replace(addition.trigger, (match) => match + addition.add);
        }
      }
    }
  }

  // Apply highlighting
  if (transform.highlight) {
    for (const { pattern, wrapper } of transform.highlight) {
      // Replace matched text with the wrapper (e.g., "must" -> "**MUST**")
      result = result.replace(pattern, wrapper);
    }
  }

  return result.trim();
}

/**
 * Calculate improvement suggestions based on metrics
 *
 * @param {Object} metrics - Variant performance metrics
 * @returns {Array<{strategy: string, reason: string, priority: number}>}
 */
export function suggestImprovements(metrics) {
  const suggestions = [];

  // High error rate -> more structure
  if (metrics.errorRate > 0.1) {
    suggestions.push({
      strategy: MutationStrategy.STRUCTURED,
      reason: `High error rate (${(metrics.errorRate * 100).toFixed(1)}%) - add more structure`,
      priority: 1
    });
  }

  // Low quality score -> more detail
  if (metrics.avgQualityScore < 0.7) {
    suggestions.push({
      strategy: MutationStrategy.DETAILED,
      reason: `Low quality (${(metrics.avgQualityScore * 100).toFixed(1)}%) - add more detail`,
      priority: 2
    });
  }

  // High latency -> more concise
  if (metrics.avgLatencyMs > 5000) {
    suggestions.push({
      strategy: MutationStrategy.CONCISE,
      reason: `High latency (${(metrics.avgLatencyMs / 1000).toFixed(1)}s) - make more concise`,
      priority: 3
    });
  }

  // Low feedback -> instructive
  if (metrics.avgFeedback < 3) {
    suggestions.push({
      strategy: MutationStrategy.INSTRUCTIVE,
      reason: `Low feedback (${metrics.avgFeedback.toFixed(1)}/5) - add explicit instructions`,
      priority: 2
    });
  }

  // Sort by priority
  suggestions.sort((a, b) => a.priority - b.priority);

  return suggestions;
}

/**
 * Variant Generator class
 *
 * Generates new prompt variants based on performance data and mutation strategies.
 */
export class VariantGenerator {
  /**
   * Create a new VariantGenerator
   *
   * @param {Object} config - Generator configuration
   */
  constructor(config = {}) {
    this._maxVariantsPerType = config.maxVariantsPerType || 5;
    this._minImpressionsForAnalysis = config.minImpressionsForAnalysis || 50;
    this._generationHistory = [];
    this._maxHistorySize = config.maxHistorySize || 100;
  }

  /**
   * Generate a new variant from an existing one
   *
   * @param {string} parentVariantId - Parent variant ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated variant config
   */
  async generateVariant(parentVariantId, options = {}) {
    const registry = getVariantRegistry();
    const parent = registry.get(parentVariantId);

    if (!parent) {
      throw new Error(`Parent variant not found: ${parentVariantId}`);
    }

    // Determine mutation strategy
    const strategy = options.strategy || await this._selectStrategy(parent);

    // Apply mutation
    const mutatedTemplate = applyMutation(parent.promptTemplate, strategy);

    // Generate variant config
    const variantConfig = {
      id: `${parent.contentType.toLowerCase()}-${strategy}-${Date.now()}`,
      name: `${parent.name} (${TRANSFORMATIONS[strategy]?.name || strategy})`,
      contentType: parent.contentType,
      status: VariantStatus.CANDIDATE,
      weight: 0.3,  // Start with lower weight
      promptTemplate: mutatedTemplate,
      description: `Auto-generated from ${parent.name} using ${strategy} strategy`,
      author: 'system:evolution',
      version: '1.0.0',
      tags: ['auto-generated', strategy],
      parentVariantId: parent.id,
      metadata: {
        generatedAt: new Date().toISOString(),
        strategy,
        parentVersion: parent.metadata?.version || '1.0.0'
      }
    };

    // Record generation
    this._generationHistory.push({
      timestamp: new Date(),
      parentId: parentVariantId,
      variantId: variantConfig.id,
      strategy,
      reason: options.reason || 'manual'
    });

    // Trim history
    while (this._generationHistory.length > this._maxHistorySize) {
      this._generationHistory.shift();
    }

    return variantConfig;
  }

  /**
   * Generate and register a new variant
   *
   * @param {string} parentVariantId - Parent variant ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Registered variant
   */
  async generateAndRegister(parentVariantId, options = {}) {
    const config = await this.generateVariant(parentVariantId, options);
    const registry = getVariantRegistry();
    return registry.register(config);
  }

  /**
   * Analyze a content type and generate improvement candidates
   *
   * @param {string} contentType - Content type to analyze
   * @returns {Promise<Array<Object>>} Generated variant configs
   */
  async analyzeAndGenerate(contentType) {
    const registry = getVariantRegistry();
    const champion = registry.getChampion(contentType);

    if (!champion) {
      return [];
    }

    // Get performance metrics
    const metrics = await this._getPerformanceMetrics(champion.id);

    if (metrics.impressions < this._minImpressionsForAnalysis) {
      return [];
    }

    // Get improvement suggestions
    const suggestions = suggestImprovements(metrics);

    if (suggestions.length === 0) {
      return [];
    }

    // Check if we already have too many variants
    const existingVariants = registry.getByContentType(contentType, { activeOnly: true });
    if (existingVariants.length >= this._maxVariantsPerType) {
      return [];
    }

    // Generate variants for top suggestions
    const generated = [];
    const slotsAvailable = this._maxVariantsPerType - existingVariants.length;

    for (const suggestion of suggestions.slice(0, slotsAvailable)) {
      // Check if we already have a variant with this strategy
      const existing = existingVariants.find(v =>
        v.metadata?.strategy === suggestion.strategy
      );

      if (!existing) {
        const config = await this.generateVariant(champion.id, {
          strategy: suggestion.strategy,
          reason: suggestion.reason
        });
        generated.push(config);
      }
    }

    return generated;
  }

  /**
   * Get performance metrics for a variant
   *
   * @private
   */
  async _getPerformanceMetrics(variantId) {
    try {
      const collector = getMetricsCollector();
      const stats = await collector.getVariantMetrics(variantId);

      return {
        impressions: stats?.count || 0,
        avgLatencyMs: stats?.avgLatency || 0,
        avgQualityScore: stats?.avgQuality || 0,
        avgFeedback: stats?.avgFeedback || 0,
        errorRate: stats?.count > 0
          ? 1 - (stats?.successCount || 0) / stats.count
          : 0
      };
    } catch {
      return {
        impressions: 0,
        avgLatencyMs: 0,
        avgQualityScore: 0,
        avgFeedback: 0,
        errorRate: 0
      };
    }
  }

  /**
   * Select best mutation strategy based on variant performance
   *
   * @private
   */
  async _selectStrategy(variant) {
    const metrics = await this._getPerformanceMetrics(variant.id);
    const suggestions = suggestImprovements(metrics);

    if (suggestions.length > 0) {
      return suggestions[0].strategy;
    }

    // Default to concise if no specific issues
    return MutationStrategy.CONCISE;
  }

  /**
   * Get generation history
   *
   * @param {Object} options - Filter options
   * @returns {Array}
   */
  getHistory(options = {}) {
    let history = [...this._generationHistory];

    if (options.contentType) {
      history = history.filter(h => {
        const registry = getVariantRegistry();
        const variant = registry.get(h.variantId);
        return variant?.contentType === options.contentType;
      });
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Get generator statistics
   *
   * @returns {Object}
   */
  getStats() {
    const byStrategy = {};
    for (const entry of this._generationHistory) {
      byStrategy[entry.strategy] = (byStrategy[entry.strategy] || 0) + 1;
    }

    return {
      totalGenerated: this._generationHistory.length,
      byStrategy,
      maxVariantsPerType: this._maxVariantsPerType,
      minImpressionsForAnalysis: this._minImpressionsForAnalysis
    };
  }
}

// Singleton instance
let _generatorInstance = null;

/**
 * Get the singleton VariantGenerator instance
 *
 * @param {Object} config - Configuration (only used on first call)
 * @returns {VariantGenerator}
 */
export function getVariantGenerator(config = {}) {
  if (!_generatorInstance) {
    _generatorInstance = new VariantGenerator(config);
  }
  return _generatorInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetVariantGenerator() {
  _generatorInstance = null;
}

export default {
  VariantGenerator,
  MutationStrategy,
  applyMutation,
  suggestImprovements,
  getVariantGenerator,
  resetVariantGenerator
};
