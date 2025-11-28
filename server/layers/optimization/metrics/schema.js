/**
 * Metrics Schema - Auto-Improving Prompts Phase 1
 *
 * Defines the structure for capturing prompt performance metrics
 * used for A/B testing and automatic optimization.
 */

/**
 * @typedef {Object} PromptVersion
 * @property {string} contentType - Type of content (Roadmap, Slides, Document, ResearchAnalysis)
 * @property {string} variantId - Variant identifier (e.g., 'roadmap-v2-concise')
 * @property {string} promptHash - SHA256 hash of actual prompt text (first 16 chars)
 * @property {Date} timestamp - When this version was used
 */

/**
 * @typedef {Object} InputMetrics
 * @property {number} userPromptLength - Length of user's prompt in characters
 * @property {number} userPromptComplexity - Complexity score 0-1 from classifier
 * @property {number} fileCount - Number of research files provided
 * @property {number} totalInputTokens - Estimated input tokens
 * @property {string[]} topicsDetected - Topics identified in input
 */

/**
 * @typedef {Object} ExecutionMetrics
 * @property {string} model - Model used for generation
 * @property {number} latencyMs - Total generation time in milliseconds
 * @property {number} inputTokens - Actual input tokens used
 * @property {number} outputTokens - Output tokens generated
 * @property {number} retryCount - Number of retries needed
 * @property {boolean} cacheHit - Whether result was from cache
 */

/**
 * @typedef {Object} QualityDimensions
 * @property {number} completeness - How complete the output is (0-1)
 * @property {number} accuracy - How accurate the output is (0-1)
 * @property {number} structure - How well structured the output is (0-1)
 * @property {number} relevance - How relevant to the request (0-1)
 */

/**
 * @typedef {Object} QualityMetrics
 * @property {boolean} validationPassed - Whether schema validation passed
 * @property {string[]} validationErrors - List of validation errors
 * @property {boolean} safetyPassed - Whether safety checks passed
 * @property {string[]} safetyConcerns - List of safety concerns
 * @property {number} qualityScore - Overall quality score 0-1
 * @property {string} qualityGrade - Letter grade (A, B, C, D, F)
 * @property {QualityDimensions} dimensions - Breakdown by dimension
 */

/**
 * @typedef {Object} FeedbackMetrics
 * @property {number|null} rating - User rating 1-5
 * @property {boolean|null} thumbsUp - Thumbs up/down feedback
 * @property {boolean|null} wasEdited - Whether user edited output
 * @property {number|null} editDistance - How much user changed output (0-1)
 * @property {number|null} timeToFirstEdit - Ms until user started editing
 * @property {boolean|null} wasExported - Whether user exported/used output
 * @property {boolean|null} wasRegenerated - Whether user asked to regenerate
 */

/**
 * @typedef {Object} GenerationMetric
 * @property {string} generationId - Unique identifier for this generation
 * @property {Date} timestamp - When generation occurred
 * @property {PromptVersion} promptVersion - Prompt version details
 * @property {InputMetrics} input - Input characteristics
 * @property {ExecutionMetrics} execution - Execution metrics
 * @property {QualityMetrics} quality - Quality metrics from validation
 * @property {FeedbackMetrics} feedback - User feedback (updated later)
 */

/**
 * Schema definition for validation
 */
export const MetricsSchema = {
  generationId: { type: 'string', required: true },
  timestamp: { type: 'date', required: true },

  promptVersion: {
    type: 'object',
    required: true,
    properties: {
      contentType: { type: 'string', required: true },
      variantId: { type: 'string', required: true },
      promptHash: { type: 'string', required: true },
      timestamp: { type: 'date', required: true }
    }
  },

  input: {
    type: 'object',
    required: true,
    properties: {
      userPromptLength: { type: 'number', default: 0 },
      userPromptComplexity: { type: 'number', default: 0 },
      fileCount: { type: 'number', default: 0 },
      totalInputTokens: { type: 'number', default: 0 },
      topicsDetected: { type: 'array', default: [] }
    }
  },

  execution: {
    type: 'object',
    required: true,
    properties: {
      model: { type: 'string', default: 'unknown' },
      latencyMs: { type: 'number', default: 0 },
      inputTokens: { type: 'number', default: 0 },
      outputTokens: { type: 'number', default: 0 },
      retryCount: { type: 'number', default: 0 },
      cacheHit: { type: 'boolean', default: false }
    }
  },

  quality: {
    type: 'object',
    required: true,
    properties: {
      validationPassed: { type: 'boolean', default: true },
      validationErrors: { type: 'array', default: [] },
      safetyPassed: { type: 'boolean', default: true },
      safetyConcerns: { type: 'array', default: [] },
      qualityScore: { type: 'number', default: 0 },
      qualityGrade: { type: 'string', default: 'N/A' },
      dimensions: {
        type: 'object',
        default: {},
        properties: {
          completeness: { type: 'number' },
          accuracy: { type: 'number' },
          structure: { type: 'number' },
          relevance: { type: 'number' }
        }
      }
    }
  },

  feedback: {
    type: 'object',
    required: true,
    properties: {
      rating: { type: 'number', default: null },
      thumbsUp: { type: 'boolean', default: null },
      wasEdited: { type: 'boolean', default: null },
      editDistance: { type: 'number', default: null },
      timeToFirstEdit: { type: 'number', default: null },
      wasExported: { type: 'boolean', default: null },
      wasRegenerated: { type: 'boolean', default: null }
    }
  }
};

/**
 * Content types supported
 */
export const ContentTypes = {
  ROADMAP: 'Roadmap',
  SLIDES: 'Slides',
  DOCUMENT: 'Document',
  RESEARCH_ANALYSIS: 'ResearchAnalysis'
};

/**
 * Feedback types for categorization
 */
export const FeedbackType = {
  RATING: 'rating',
  THUMBS: 'thumbs',
  EDIT: 'edit',
  EXPORT: 'export',
  REGENERATE: 'regenerate'
};

/**
 * Create a default metric object
 * @returns {GenerationMetric}
 */
export function createDefaultMetric() {
  return {
    generationId: '',
    timestamp: new Date(),
    promptVersion: {
      contentType: '',
      variantId: 'default',
      promptHash: '',
      timestamp: new Date()
    },
    input: {
      userPromptLength: 0,
      userPromptComplexity: 0,
      fileCount: 0,
      totalInputTokens: 0,
      topicsDetected: []
    },
    execution: {
      model: 'unknown',
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      retryCount: 0,
      cacheHit: false
    },
    quality: {
      validationPassed: true,
      validationErrors: [],
      safetyPassed: true,
      safetyConcerns: [],
      qualityScore: 0,
      qualityGrade: 'N/A',
      dimensions: {}
    },
    feedback: {
      rating: null,
      thumbsUp: null,
      wasEdited: null,
      editDistance: null,
      timeToFirstEdit: null,
      wasExported: null,
      wasRegenerated: null
    }
  };
}

/**
 * Validate a metric object against schema
 * @param {Object} metric - Metric to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateMetric(metric) {
  const errors = [];

  if (!metric.generationId) {
    errors.push('generationId is required');
  }

  if (!metric.promptVersion?.contentType) {
    errors.push('promptVersion.contentType is required');
  }

  if (!metric.promptVersion?.variantId) {
    errors.push('promptVersion.variantId is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  MetricsSchema,
  ContentTypes,
  FeedbackType,
  createDefaultMetric,
  validateMetric
};
