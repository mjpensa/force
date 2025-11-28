/**
 * Prompt Optimizer - PROMPT ML Layer 9
 *
 * Optimizes prompts based on feedback and evaluation:
 * - Prompt variations and A/B testing
 * - Automatic prompt tuning
 * - Template optimization
 * - Few-shot example selection
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Optimization strategy types
 * @readonly
 * @enum {string}
 */
export const OptimizationStrategy = {
  NONE: 'none',                     // No optimization
  TEMPLATE_TUNING: 'template',      // Adjust prompt templates
  FEW_SHOT: 'few_shot',             // Optimize few-shot examples
  INSTRUCTION: 'instruction',       // Refine instructions
  CONTEXT: 'context',               // Optimize context inclusion
  HYBRID: 'hybrid'                  // Combine strategies
};

/**
 * @typedef {Object} PromptVariant
 * @property {string} id - Variant ID
 * @property {string} name - Variant name
 * @property {string} template - Prompt template
 * @property {Object} config - Variant configuration
 * @property {Object} metrics - Performance metrics
 */

/**
 * @typedef {Object} OptimizationResult
 * @property {string} originalPrompt - Original prompt
 * @property {string} optimizedPrompt - Optimized prompt
 * @property {Array<string>} changes - List of changes made
 * @property {number} expectedImprovement - Expected improvement percentage
 */

/**
 * Prompt template with placeholders
 */
export class PromptTemplate {
  /**
   * @param {string} template - Template string with {{placeholders}}
   * @param {Object} config - Template configuration
   */
  constructor(template, config = {}) {
    this.template = template;
    this.config = {
      maxLength: config.maxLength || 10000,
      requiredVariables: config.requiredVariables || [],
      optionalVariables: config.optionalVariables || [],
      ...config
    };
    this.variables = this._extractVariables(template);
  }

  /**
   * Render template with values
   * @param {Object} values - Variable values
   * @returns {string} Rendered prompt
   */
  render(values = {}) {
    let result = this.template;

    for (const variable of this.variables) {
      const value = values[variable] ?? '';
      const placeholder = new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`, 'g');
      result = result.replace(placeholder, value);
    }

    // Truncate if needed
    if (result.length > this.config.maxLength) {
      result = result.substring(0, this.config.maxLength) + '...';
    }

    return result;
  }

  /**
   * Validate that required variables are provided
   * @param {Object} values - Variable values
   * @returns {Object} Validation result
   */
  validate(values = {}) {
    const missing = this.config.requiredVariables.filter(v => !values[v]);
    return {
      valid: missing.length === 0,
      missing,
      provided: Object.keys(values)
    };
  }

  _extractVariables(template) {
    const matches = template.match(/\{\{\s*(\w+)\s*\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '').trim()))];
  }
}

/**
 * Prompt Variant for A/B testing
 */
export class PromptVariant {
  /**
   * @param {string} id - Variant ID
   * @param {string} name - Variant name
   * @param {PromptTemplate} template - Prompt template
   * @param {Object} config - Variant configuration
   */
  constructor(id, name, template, config = {}) {
    this.id = id;
    this.name = name;
    this.template = template instanceof PromptTemplate ? template : new PromptTemplate(template);
    this.config = config;
    this.metrics = {
      impressions: 0,
      successes: 0,
      totalLatency: 0,
      totalQuality: 0,
      feedbackPositive: 0,
      feedbackNegative: 0
    };
    this.active = true;
  }

  /**
   * Record a result for this variant
   * @param {Object} result - Result data
   */
  recordResult(result) {
    this.metrics.impressions++;

    if (result.success) {
      this.metrics.successes++;
    }

    if (result.latency) {
      this.metrics.totalLatency += result.latency;
    }

    if (result.quality !== undefined) {
      this.metrics.totalQuality += result.quality;
    }

    if (result.feedback === 'positive') {
      this.metrics.feedbackPositive++;
    } else if (result.feedback === 'negative') {
      this.metrics.feedbackNegative++;
    }
  }

  /**
   * Get variant performance score
   * @returns {number} Score (0-1)
   */
  getScore() {
    if (this.metrics.impressions === 0) return 0.5; // Neutral for new variants

    const successRate = this.metrics.successes / this.metrics.impressions;
    const avgQuality = this.metrics.totalQuality / this.metrics.impressions;
    const feedbackScore = this.metrics.feedbackPositive /
      (this.metrics.feedbackPositive + this.metrics.feedbackNegative || 1);

    // Weighted score
    return (successRate * 0.3) + (avgQuality * 0.4) + (feedbackScore * 0.3);
  }

  /**
   * Get variant statistics
   * @returns {Object}
   */
  getStats() {
    const impressions = this.metrics.impressions || 1;
    return {
      id: this.id,
      name: this.name,
      impressions: this.metrics.impressions,
      successRate: (this.metrics.successes / impressions * 100).toFixed(1) + '%',
      avgLatency: Math.round(this.metrics.totalLatency / impressions),
      avgQuality: (this.metrics.totalQuality / impressions).toFixed(2),
      feedbackRatio: `${this.metrics.feedbackPositive}:${this.metrics.feedbackNegative}`,
      score: this.getScore().toFixed(3),
      active: this.active
    };
  }
}

/**
 * Multi-Armed Bandit for variant selection
 */
class MultiArmedBandit {
  /**
   * @param {number} explorationRate - Exploration rate (0-1)
   */
  constructor(explorationRate = 0.1) {
    this.explorationRate = explorationRate;
    this.variants = new Map();
  }

  /**
   * Add a variant
   * @param {PromptVariant} variant
   */
  addVariant(variant) {
    this.variants.set(variant.id, variant);
  }

  /**
   * Remove a variant
   * @param {string} variantId
   */
  removeVariant(variantId) {
    this.variants.delete(variantId);
  }

  /**
   * Select a variant using epsilon-greedy strategy
   * @returns {PromptVariant}
   */
  selectVariant() {
    const activeVariants = Array.from(this.variants.values()).filter(v => v.active);

    if (activeVariants.length === 0) {
      throw new Error('No active variants available');
    }

    if (activeVariants.length === 1) {
      return activeVariants[0];
    }

    // Exploration: random selection
    if (Math.random() < this.explorationRate) {
      return activeVariants[Math.floor(Math.random() * activeVariants.length)];
    }

    // Exploitation: select best performing
    return activeVariants.reduce((best, current) =>
      current.getScore() > best.getScore() ? current : best
    );
  }

  /**
   * Get all variant statistics
   * @returns {Array}
   */
  getAllStats() {
    return Array.from(this.variants.values()).map(v => v.getStats());
  }

  /**
   * Get the best performing variant
   * @returns {PromptVariant}
   */
  getBestVariant() {
    const activeVariants = Array.from(this.variants.values()).filter(v => v.active);
    if (activeVariants.length === 0) return null;

    return activeVariants.reduce((best, current) =>
      current.getScore() > best.getScore() ? current : best
    );
  }
}

/**
 * Prompt Optimizer class
 */
export class PromptOptimizer {
  /**
   * @param {Object} config - Configuration
   */
  constructor(config = {}) {
    this.config = {
      explorationRate: 0.1,
      minImpressionsForDecision: 10,
      autoDisableThreshold: 0.3, // Disable variants scoring below this
      ...config
    };
    this.experiments = new Map(); // contentType -> MultiArmedBandit
    this.optimizationHistory = [];
  }

  /**
   * Register a prompt variant for A/B testing
   *
   * @param {string} contentType - Content type
   * @param {string} variantId - Variant ID
   * @param {string} variantName - Variant name
   * @param {string|PromptTemplate} template - Prompt template
   * @param {Object} config - Variant configuration
   */
  registerVariant(contentType, variantId, variantName, template, config = {}) {
    if (!this.experiments.has(contentType)) {
      this.experiments.set(contentType, new MultiArmedBandit(this.config.explorationRate));
    }

    const bandit = this.experiments.get(contentType);
    const variant = new PromptVariant(variantId, variantName, template, config);
    bandit.addVariant(variant);
  }

  /**
   * Select optimal prompt variant for content type
   *
   * @param {string} contentType - Content type
   * @returns {PromptVariant|null}
   */
  selectVariant(contentType) {
    const bandit = this.experiments.get(contentType);
    if (!bandit) return null;

    return bandit.selectVariant();
  }

  /**
   * Record result for a variant
   *
   * @param {string} contentType - Content type
   * @param {string} variantId - Variant ID
   * @param {Object} result - Result data
   */
  recordResult(contentType, variantId, result) {
    const bandit = this.experiments.get(contentType);
    if (!bandit) return;

    const variant = bandit.variants.get(variantId);
    if (variant) {
      variant.recordResult(result);

      // Auto-disable poorly performing variants
      if (variant.metrics.impressions >= this.config.minImpressionsForDecision) {
        if (variant.getScore() < this.config.autoDisableThreshold) {
          variant.active = false;
          this.optimizationHistory.push({
            action: 'variant_disabled',
            contentType,
            variantId,
            reason: 'Low performance score',
            score: variant.getScore(),
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  /**
   * Optimize a prompt based on feedback patterns
   *
   * @param {string} prompt - Original prompt
   * @param {Object} feedback - Feedback data
   * @returns {OptimizationResult}
   */
  optimizePrompt(prompt, feedback = {}) {
    const changes = [];
    let optimizedPrompt = prompt;

    // Strategy 1: Add specificity if outputs are too generic
    if (feedback.tooGeneric) {
      optimizedPrompt = this._addSpecificity(optimizedPrompt);
      changes.push('Added specificity markers');
    }

    // Strategy 2: Simplify if outputs are too complex
    if (feedback.tooComplex) {
      optimizedPrompt = this._simplifyInstructions(optimizedPrompt);
      changes.push('Simplified instructions');
    }

    // Strategy 3: Add format reinforcement if structure issues
    if (feedback.formatIssues) {
      optimizedPrompt = this._reinforceFormat(optimizedPrompt);
      changes.push('Added format reinforcement');
    }

    // Strategy 4: Add examples if correctness issues
    if (feedback.correctnessIssues) {
      optimizedPrompt = this._addExamples(optimizedPrompt, feedback.examples);
      changes.push('Added clarifying examples');
    }

    // Strategy 5: Adjust length guidance
    if (feedback.tooLong || feedback.tooShort) {
      optimizedPrompt = this._adjustLengthGuidance(optimizedPrompt, feedback);
      changes.push('Adjusted length guidance');
    }

    return {
      originalPrompt: prompt,
      optimizedPrompt,
      changes,
      expectedImprovement: changes.length * 5 // Rough estimate
    };
  }

  /**
   * Get experiment statistics
   *
   * @param {string} contentType - Optional content type filter
   * @returns {Object}
   */
  getExperimentStats(contentType = null) {
    if (contentType) {
      const bandit = this.experiments.get(contentType);
      return bandit ? {
        contentType,
        variants: bandit.getAllStats(),
        bestVariant: bandit.getBestVariant()?.getStats()
      } : null;
    }

    const stats = {};
    for (const [ct, bandit] of this.experiments) {
      stats[ct] = {
        variants: bandit.getAllStats(),
        bestVariant: bandit.getBestVariant()?.getStats()
      };
    }
    return stats;
  }

  /**
   * Get optimization recommendations
   *
   * @returns {Array} Recommendations
   */
  getRecommendations() {
    const recommendations = [];

    for (const [contentType, bandit] of this.experiments) {
      const stats = bandit.getAllStats();

      // Check for underperforming variants
      const underperforming = stats.filter(s => parseFloat(s.score) < 0.4);
      if (underperforming.length > 0) {
        recommendations.push({
          contentType,
          type: 'underperforming_variants',
          message: `${underperforming.length} variant(s) underperforming for ${contentType}`,
          variants: underperforming.map(v => v.id)
        });
      }

      // Check for clear winner
      const best = bandit.getBestVariant();
      if (best && best.metrics.impressions > 50 && best.getScore() > 0.8) {
        recommendations.push({
          contentType,
          type: 'clear_winner',
          message: `Consider standardizing on "${best.name}" for ${contentType}`,
          variantId: best.id,
          score: best.getScore()
        });
      }

      // Check for insufficient data
      const needsData = stats.filter(s => s.impressions < 20);
      if (needsData.length > 0) {
        recommendations.push({
          contentType,
          type: 'needs_data',
          message: `${needsData.length} variant(s) need more data for ${contentType}`,
          variants: needsData.map(v => v.id)
        });
      }
    }

    return recommendations;
  }

  /**
   * Get optimization history
   *
   * @param {number} count - Number of entries
   * @returns {Array}
   */
  getHistory(count = 20) {
    return this.optimizationHistory.slice(-count);
  }

  // Private optimization methods

  _addSpecificity(prompt) {
    const specificityMarkers = [
      '\n\nBe specific and detailed in your response.',
      '\n\nInclude concrete examples and data points.',
      '\n\nProvide actionable, specific recommendations.'
    ];

    // Add if not already present
    for (const marker of specificityMarkers) {
      if (!prompt.includes(marker.trim())) {
        return prompt + marker;
      }
    }
    return prompt;
  }

  _simplifyInstructions(prompt) {
    // Remove complex nested instructions
    let simplified = prompt
      .replace(/\(([^)]{100,})\)/g, '') // Remove long parentheticals
      .replace(/,\s*including[^,.]*/gi, '') // Remove "including..." clauses
      .replace(/\s+/g, ' '); // Normalize whitespace

    return simplified.trim();
  }

  _reinforceFormat(prompt) {
    const formatReminder = `

IMPORTANT: Respond ONLY with valid JSON matching the specified schema. Do not include any explanatory text outside the JSON structure.`;

    if (!prompt.includes('ONLY with valid JSON')) {
      return prompt + formatReminder;
    }
    return prompt;
  }

  _addExamples(prompt, examples = []) {
    if (examples.length === 0) {
      return prompt;
    }

    const exampleSection = `

Here are examples of good outputs:
${examples.map((ex, i) => `Example ${i + 1}: ${JSON.stringify(ex, null, 2)}`).join('\n\n')}`;

    return prompt + exampleSection;
  }

  _adjustLengthGuidance(prompt, feedback) {
    if (feedback.tooLong) {
      return prompt + '\n\nKeep responses concise and focused. Aim for brevity.';
    }
    if (feedback.tooShort) {
      return prompt + '\n\nProvide comprehensive, detailed responses with thorough explanations.';
    }
    return prompt;
  }
}

// Singleton instance
let _optimizer = null;

/**
 * Get or create singleton prompt optimizer
 * @param {Object} config - Configuration
 * @returns {PromptOptimizer}
 */
export function getPromptOptimizer(config = {}) {
  if (!_optimizer) {
    _optimizer = new PromptOptimizer(config);
  }
  return _optimizer;
}

/**
 * Reset optimizer instance (for testing)
 */
export function resetPromptOptimizer() {
  _optimizer = null;
}

export default PromptOptimizer;
