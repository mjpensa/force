/**
 * Context Strategies - PROMPT ML Layer 2
 *
 * Task-specific context assembly strategies that optimize:
 * - What content to include
 * - How to structure it
 * - Priority ordering
 * - Token allocation
 *
 * Based on PROMPT ML design specification.
 */

import { ContextPriority } from './assembler.js';

/**
 * Strategy types
 * @readonly
 * @enum {string}
 */
export const StrategyType = {
  ROADMAP: 'roadmap',
  SLIDES: 'slides',
  DOCUMENT: 'document',
  RESEARCH_ANALYSIS: 'research-analysis',
  QA: 'qa',
  DEFAULT: 'default'
};

/**
 * @typedef {Object} ContextStrategy
 * @property {string} name - Strategy name
 * @property {Object} budget - Token budget allocation
 * @property {Object} priorities - Component priorities
 * @property {Object} instructions - Task-specific instructions
 * @property {Function} preprocess - Content preprocessing function
 * @property {Function} postprocess - Result postprocessing function
 */

/**
 * Base strategy configuration
 */
const BASE_STRATEGY = {
  budget: {
    totalTokens: 8000,
    allocations: {
      task: 0.15,
      content: 0.50,
      examples: 0.15,
      meta: 0.10,
      buffer: 0.10  // Reserve for safety
    }
  },
  priorities: {
    task: ContextPriority.CRITICAL,
    content: ContextPriority.CRITICAL,
    examples: ContextPriority.HIGH,
    meta: ContextPriority.MEDIUM
  },
  instructions: {
    focus: 'Generate accurate, structured output',
    constraints: [],
    format: 'JSON'
  },
  preprocess: null,
  postprocess: null
};

/**
 * Strategy definitions for each task type
 */
export const STRATEGIES = {
  [StrategyType.ROADMAP]: {
    ...BASE_STRATEGY,
    name: 'Roadmap Generation',
    budget: {
      totalTokens: 12000,  // Roadmaps need more context
      allocations: {
        task: 0.10,
        content: 0.60,     // Heavy on content analysis
        examples: 0.10,
        meta: 0.10,
        buffer: 0.10
      }
    },
    instructions: {
      focus: 'Extract timeline, milestones, and dependencies from research',
      constraints: [
        'Identify all dates and temporal references',
        'Group related tasks into swimlanes',
        'Maintain chronological accuracy',
        'Preserve entity relationships'
      ],
      format: 'Gantt chart JSON structure',
      outputGuidance: `
Focus on extracting:
- Key milestones and deadlines
- Project phases and their durations
- Dependencies between tasks
- Entity/stakeholder assignments
`
    },
    preprocess: (content) => {
      // Highlight temporal content for roadmap
      return content
        .replace(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g, '**DATE: $1**')
        .replace(/([QH][1-4]\s*\d{4})/gi, '**QUARTER: $1**')
        .replace(/(deadline|milestone|phase|stage)/gi, '**$1**');
    }
  },

  [StrategyType.SLIDES]: {
    ...BASE_STRATEGY,
    name: 'Slides Generation',
    budget: {
      totalTokens: 6000,   // Slides need concise input
      allocations: {
        task: 0.15,
        content: 0.45,     // More aggressive compression
        examples: 0.15,
        meta: 0.15,
        buffer: 0.10
      }
    },
    instructions: {
      focus: 'Extract key points and insights for executive presentation',
      constraints: [
        'Prioritize high-level insights over details',
        'Focus on actionable takeaways',
        'Maintain narrative flow',
        'Limit to 6 slides'
      ],
      format: '6-slide presentation structure',
      outputGuidance: `
Focus on extracting:
- Executive summary points
- Key findings (3-5 max)
- Recommendations
- Visual-friendly data points
`
    },
    preprocess: (content) => {
      // Extract executive-friendly content
      const priorityPatterns = [
        /summary/gi,
        /key\s*(finding|point|takeaway)/gi,
        /recommend/gi,
        /conclusion/gi,
        /\d+%/g,
        /\$[\d,]+/g
      ];

      // Highlight priority content
      let result = content;
      for (const pattern of priorityPatterns) {
        result = result.replace(pattern, '**$&**');
      }
      return result;
    }
  },

  [StrategyType.DOCUMENT]: {
    ...BASE_STRATEGY,
    name: 'Document Generation',
    budget: {
      totalTokens: 10000,
      allocations: {
        task: 0.12,
        content: 0.55,
        examples: 0.12,
        meta: 0.11,
        buffer: 0.10
      }
    },
    instructions: {
      focus: 'Create comprehensive document with structured sections',
      constraints: [
        'Maintain logical section flow',
        'Include supporting details',
        'Preserve important quotes and data',
        'Cross-reference related content'
      ],
      format: 'Multi-section document',
      outputGuidance: `
Structure should include:
- Executive summary
- Background/context
- Key findings with details
- Analysis and implications
- Recommendations
- Appendix (if needed)
`
    },
    preprocess: null
  },

  [StrategyType.RESEARCH_ANALYSIS]: {
    ...BASE_STRATEGY,
    name: 'Research Analysis',
    budget: {
      totalTokens: 8000,
      allocations: {
        task: 0.15,
        content: 0.55,
        examples: 0.10,
        meta: 0.10,
        buffer: 0.10
      }
    },
    instructions: {
      focus: 'Evaluate research quality and fitness for analysis',
      constraints: [
        'Assess source credibility',
        'Identify gaps in coverage',
        'Rate temporal relevance',
        'Evaluate data quality'
      ],
      format: 'Quality assessment report',
      outputGuidance: `
Evaluate:
- Completeness of information
- Currency/timeliness of data
- Source reliability
- Coverage breadth
- Actionability of content
`
    },
    preprocess: (content) => {
      // Add metadata markers for analysis
      const dateMatches = content.match(/\b(20\d{2})\b/g);
      const sourceMarkers = content.match(/source:|according to|cited from/gi);

      return content + `\n\n---\nMETADATA:\n- Year references found: ${dateMatches?.length || 0}\n- Source citations found: ${sourceMarkers?.length || 0}`;
    }
  },

  [StrategyType.QA]: {
    ...BASE_STRATEGY,
    name: 'Question Answering',
    budget: {
      totalTokens: 4000,   // QA needs focused context
      allocations: {
        task: 0.20,        // Question is important
        content: 0.50,     // Relevant content
        examples: 0.10,
        meta: 0.10,
        buffer: 0.10
      }
    },
    instructions: {
      focus: 'Answer specific question based on research context',
      constraints: [
        'Stay focused on the question',
        'Cite relevant sources',
        'Be concise but complete',
        'Acknowledge uncertainty'
      ],
      format: 'Direct answer with supporting context',
      outputGuidance: `
Response should:
- Directly address the question
- Provide supporting evidence
- Note any limitations
- Suggest follow-ups if relevant
`
    },
    preprocess: null
  },

  [StrategyType.DEFAULT]: {
    ...BASE_STRATEGY,
    name: 'Default Strategy',
    instructions: {
      focus: 'Process research content as requested',
      constraints: [],
      format: 'Structured output'
    }
  }
};

/**
 * Get strategy for a task type
 *
 * @param {string} taskType - Task type
 * @returns {ContextStrategy} Strategy configuration
 */
export function getStrategy(taskType) {
  return STRATEGIES[taskType] || STRATEGIES[StrategyType.DEFAULT];
}

/**
 * Apply strategy preprocessing to content
 *
 * @param {string} content - Content to preprocess
 * @param {string} taskType - Task type
 * @returns {string} Preprocessed content
 */
export function applyPreprocessing(content, taskType) {
  const strategy = getStrategy(taskType);

  if (strategy.preprocess && typeof strategy.preprocess === 'function') {
    return strategy.preprocess(content);
  }

  return content;
}

/**
 * Get budget allocation for a task type
 *
 * @param {string} taskType - Task type
 * @param {number} totalTokens - Override total tokens
 * @returns {Object} Budget allocation
 */
export function getBudgetAllocation(taskType, totalTokens = null) {
  const strategy = getStrategy(taskType);
  const budget = { ...strategy.budget };

  if (totalTokens) {
    budget.totalTokens = totalTokens;
  }

  // Calculate absolute token counts
  const absoluteAllocations = {};
  for (const [key, percentage] of Object.entries(budget.allocations)) {
    absoluteAllocations[key] = Math.floor(budget.totalTokens * percentage);
  }

  return {
    total: budget.totalTokens,
    percentages: budget.allocations,
    absolute: absoluteAllocations
  };
}

/**
 * Get task instructions for a strategy
 *
 * @param {string} taskType - Task type
 * @returns {Object} Task instructions
 */
export function getTaskInstructions(taskType) {
  const strategy = getStrategy(taskType);
  return strategy.instructions;
}

/**
 * Build task description with strategy-specific guidance
 *
 * @param {string} taskType - Task type
 * @param {string} userPrompt - User's custom prompt
 * @returns {string} Enhanced task description
 */
export function buildTaskDescription(taskType, userPrompt = '') {
  const instructions = getTaskInstructions(taskType);

  const parts = [
    `**Task Focus**: ${instructions.focus}`,
    ''
  ];

  if (instructions.constraints.length > 0) {
    parts.push('**Constraints**:');
    instructions.constraints.forEach(c => parts.push(`- ${c}`));
    parts.push('');
  }

  if (instructions.outputGuidance) {
    parts.push('**Output Guidance**:');
    parts.push(instructions.outputGuidance.trim());
    parts.push('');
  }

  if (userPrompt) {
    parts.push('**Additional Instructions**:');
    parts.push(userPrompt);
  }

  return parts.join('\n');
}

/**
 * Context Strategy Manager class
 */
export class ContextStrategyManager {
  constructor() {
    this.strategies = { ...STRATEGIES };
  }

  /**
   * Get strategy for task type
   * @param {string} taskType - Task type
   * @returns {ContextStrategy}
   */
  getStrategy(taskType) {
    return this.strategies[taskType] || this.strategies[StrategyType.DEFAULT];
  }

  /**
   * Register a custom strategy
   * @param {string} name - Strategy name
   * @param {ContextStrategy} strategy - Strategy configuration
   */
  registerStrategy(name, strategy) {
    this.strategies[name] = {
      ...BASE_STRATEGY,
      ...strategy
    };
  }

  /**
   * Get all available strategies
   * @returns {Object} All strategies
   */
  getAllStrategies() {
    return { ...this.strategies };
  }

  /**
   * Apply full strategy to context assembly
   *
   * @param {string} taskType - Task type
   * @param {Object} params - Assembly parameters
   * @returns {Object} Strategy-enhanced parameters
   */
  applyStrategy(taskType, params) {
    const strategy = this.getStrategy(taskType);

    // Apply preprocessing if available
    let processedContent = params.content;
    if (strategy.preprocess && params.content) {
      processedContent = strategy.preprocess(params.content);
    }

    // Build enhanced task description
    const taskDescription = buildTaskDescription(taskType, params.userPrompt);

    return {
      ...params,
      content: processedContent,
      taskDescription,
      budget: getBudgetAllocation(taskType, params.totalTokens),
      strategy: strategy.name
    };
  }
}

// Singleton instance
let _manager = null;

/**
 * Get strategy manager instance
 * @returns {ContextStrategyManager}
 */
export function getStrategyManager() {
  if (!_manager) {
    _manager = new ContextStrategyManager();
  }
  return _manager;
}

export default {
  StrategyType,
  STRATEGIES,
  getStrategy,
  applyPreprocessing,
  getBudgetAllocation,
  getTaskInstructions,
  buildTaskDescription,
  ContextStrategyManager,
  getStrategyManager
};
