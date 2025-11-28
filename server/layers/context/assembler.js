/**
 * Context Assembler - PROMPT ML Layer 2
 *
 * Assembles optimal context for each LLM call with:
 * - Token budget allocation by component type
 * - Priority-based inclusion/truncation
 * - Dynamic context assembly based on task type
 *
 * Based on PROMPT ML design specification.
 */

import { getTokenCounter } from './token-counter.js';

/**
 * Context component priority levels
 * @readonly
 * @enum {number}
 */
export const ContextPriority = {
  CRITICAL: 1,    // Must be included (task description, core content)
  HIGH: 2,        // Should be included (relevant examples, recent context)
  MEDIUM: 3,      // Include if space allows (older history, additional context)
  LOW: 4          // Include only if plenty of space (background info)
};

/**
 * @typedef {Object} ContextComponent
 * @property {string} name - Component identifier
 * @property {string} content - The actual content
 * @property {number} tokens - Token count for this component
 * @property {number} priority - Priority level (ContextPriority)
 * @property {boolean} truncatable - Whether this component can be truncated
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} ContextBudget
 * @property {number} totalTokens - Total available tokens
 * @property {Object} allocations - Allocation percentages by category
 * @property {Object} minimums - Minimum tokens per category
 */

/**
 * @typedef {Object} AssembledContext
 * @property {ContextComponent[]} components - Included components
 * @property {number} totalTokens - Total tokens used
 * @property {number} budgetUsed - Budget utilization (0.0 to 1.0)
 * @property {string[]} truncatedComponents - Components that were truncated
 * @property {string[]} excludedComponents - Components that didn't fit
 * @property {Object} metadata - Assembly metadata
 */

/**
 * @typedef {Object} AssemblerConfig
 * @property {ContextBudget} defaultBudget - Default token budget
 * @property {Object} categoryAllocations - Default allocation percentages
 */

const DEFAULT_BUDGET = {
  totalTokens: 8000,  // Conservative default for Gemini
  allocations: {
    task: 0.15,           // Core task description
    content: 0.50,        // Research content
    examples: 0.15,       // Few-shot examples (future)
    history: 0.10,        // Conversation history (future)
    meta: 0.10            // Meta-information, instructions
  },
  minimums: {
    task: 200,
    content: 1000,
    examples: 0,
    history: 0,
    meta: 100
  }
};

const DEFAULT_CONFIG = {
  defaultBudget: DEFAULT_BUDGET,
  preserveSections: true,
  smartTruncation: true
};

/**
 * Context Assembler class
 */
export class ContextAssembler {
  /**
   * @param {AssemblerConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tokenCounter = getTokenCounter();
  }

  /**
   * Assemble context for a generation task
   *
   * @param {Object} params - Assembly parameters
   * @param {string} params.taskDescription - Core task description
   * @param {Object[]} params.researchFiles - Research file contents
   * @param {string} params.userPrompt - User's prompt/instructions
   * @param {string} params.taskType - Type of task (roadmap, slides, etc.)
   * @param {ContextBudget} params.budget - Optional custom budget
   * @returns {AssembledContext} Assembled context
   */
  assemble(params) {
    const {
      taskDescription = '',
      researchFiles = [],
      userPrompt = '',
      taskType = 'document',
      budget = this.config.defaultBudget
    } = params;

    const components = [];
    const truncatedComponents = [];
    const excludedComponents = [];

    // Calculate token allocations
    const allocations = this._calculateAllocations(budget, taskType);

    // Step 1: Build task component (CRITICAL)
    const taskComponent = this._buildTaskComponent(
      taskDescription,
      userPrompt,
      allocations.task
    );
    components.push(taskComponent);

    // Step 2: Build research content component (CRITICAL)
    const contentComponent = this._buildContentComponent(
      researchFiles,
      allocations.content,
      truncatedComponents
    );
    components.push(contentComponent);

    // Step 3: Build meta component (HIGH)
    const metaComponent = this._buildMetaComponent(
      taskType,
      researchFiles.length,
      allocations.meta
    );
    if (metaComponent.tokens > 0) {
      components.push(metaComponent);
    }

    // Step 4: Check total and adjust if needed
    let totalTokens = components.reduce((sum, c) => sum + c.tokens, 0);

    if (totalTokens > budget.totalTokens) {
      // Need to truncate - start with lowest priority
      this._truncateToFit(components, budget.totalTokens, truncatedComponents);
      totalTokens = components.reduce((sum, c) => sum + c.tokens, 0);
    }

    const budgetUsed = totalTokens / budget.totalTokens;

    return {
      components,
      totalTokens,
      budgetUsed,
      truncatedComponents,
      excludedComponents,
      metadata: {
        taskType,
        fileCount: researchFiles.length,
        allocations,
        assembledAt: new Date().toISOString()
      }
    };
  }

  /**
   * Build the final prompt string from assembled context
   *
   * @param {AssembledContext} assembled - Assembled context
   * @param {Object} options - Build options
   * @returns {string} Final prompt string
   */
  buildPrompt(assembled, options = {}) {
    const { includeMarkers = false } = options;

    const parts = [];

    // Sort by priority (lower number = higher priority)
    const sortedComponents = [...assembled.components].sort(
      (a, b) => a.priority - b.priority
    );

    for (const component of sortedComponents) {
      if (includeMarkers) {
        parts.push(`<!-- ${component.name} (${component.tokens} tokens) -->`);
      }
      parts.push(component.content);
    }

    return parts.join('\n\n');
  }

  /**
   * Get context statistics
   *
   * @param {AssembledContext} assembled - Assembled context
   * @returns {Object} Statistics
   */
  getStats(assembled) {
    const byPriority = {};
    const byName = {};

    for (const component of assembled.components) {
      // By priority
      const priorityKey = Object.keys(ContextPriority).find(
        k => ContextPriority[k] === component.priority
      ) || 'UNKNOWN';

      if (!byPriority[priorityKey]) {
        byPriority[priorityKey] = { count: 0, tokens: 0 };
      }
      byPriority[priorityKey].count++;
      byPriority[priorityKey].tokens += component.tokens;

      // By name
      byName[component.name] = component.tokens;
    }

    return {
      totalComponents: assembled.components.length,
      totalTokens: assembled.totalTokens,
      budgetUtilization: `${(assembled.budgetUsed * 100).toFixed(1)}%`,
      byPriority,
      byName,
      truncated: assembled.truncatedComponents.length,
      excluded: assembled.excludedComponents.length
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate token allocations based on task type
   * @private
   */
  _calculateAllocations(budget, taskType) {
    const baseAllocations = { ...budget.allocations };

    // Task-specific adjustments
    const adjustments = {
      roadmap: { content: 0.55, task: 0.15, meta: 0.15 },
      slides: { content: 0.45, task: 0.20, meta: 0.15 },
      document: { content: 0.55, task: 0.15, meta: 0.10 },
      'research-analysis': { content: 0.60, task: 0.15, meta: 0.10 }
    };

    const taskAdjustments = adjustments[taskType] || {};
    const merged = { ...baseAllocations, ...taskAdjustments };

    // Convert to absolute token counts
    const result = {};
    for (const [key, percentage] of Object.entries(merged)) {
      const minimum = budget.minimums[key] || 0;
      result[key] = Math.max(
        minimum,
        Math.floor(budget.totalTokens * percentage)
      );
    }

    return result;
  }

  /**
   * Build task description component
   * @private
   */
  _buildTaskComponent(taskDescription, userPrompt, tokenBudget) {
    let content = taskDescription;

    if (userPrompt) {
      content += `\n\nUser Instructions:\n${userPrompt}`;
    }

    // Truncate if needed
    const tokens = this.tokenCounter.count(content).tokens;
    if (tokens > tokenBudget) {
      content = this._smartTruncate(content, tokenBudget);
    }

    return {
      name: 'task',
      content,
      tokens: this.tokenCounter.count(content).tokens,
      priority: ContextPriority.CRITICAL,
      truncatable: false,
      metadata: {
        hasUserPrompt: !!userPrompt
      }
    };
  }

  /**
   * Build research content component
   * @private
   */
  _buildContentComponent(researchFiles, tokenBudget, truncatedList) {
    if (!researchFiles || researchFiles.length === 0) {
      return {
        name: 'content',
        content: '',
        tokens: 0,
        priority: ContextPriority.CRITICAL,
        truncatable: true,
        metadata: { fileCount: 0 }
      };
    }

    // Combine all research content
    let combinedContent = researchFiles.map(file => {
      return `## ${file.filename}\n\n${file.content}`;
    }).join('\n\n---\n\n');

    let tokens = this.tokenCounter.count(combinedContent).tokens;

    // Truncate if over budget
    if (tokens > tokenBudget) {
      truncatedList.push('content');

      if (researchFiles.length === 1) {
        // Single file - smart truncate
        combinedContent = this._smartTruncate(combinedContent, tokenBudget);
      } else {
        // Multiple files - proportional truncation
        combinedContent = this._truncateMultipleFiles(
          researchFiles,
          tokenBudget
        );
      }

      tokens = this.tokenCounter.count(combinedContent).tokens;
    }

    return {
      name: 'content',
      content: combinedContent,
      tokens,
      priority: ContextPriority.CRITICAL,
      truncatable: true,
      metadata: {
        fileCount: researchFiles.length,
        originalTokens: this.tokenCounter.count(
          researchFiles.map(f => f.content).join('\n')
        ).tokens
      }
    };
  }

  /**
   * Build meta information component
   * @private
   */
  _buildMetaComponent(taskType, fileCount, tokenBudget) {
    const metaInfo = [];

    // Add context about the task
    metaInfo.push(`Task type: ${taskType}`);
    metaInfo.push(`Source files: ${fileCount}`);

    // Task-specific meta instructions
    const taskInstructions = {
      roadmap: 'Generate a structured timeline with clear milestones and dependencies.',
      slides: 'Create a concise 6-slide presentation with key insights.',
      document: 'Produce a comprehensive document with clear sections.',
      'research-analysis': 'Analyze the research quality and provide recommendations.'
    };

    if (taskInstructions[taskType]) {
      metaInfo.push(`Goal: ${taskInstructions[taskType]}`);
    }

    const content = metaInfo.join('\n');
    const tokens = this.tokenCounter.count(content).tokens;

    return {
      name: 'meta',
      content,
      tokens: Math.min(tokens, tokenBudget),
      priority: ContextPriority.HIGH,
      truncatable: true,
      metadata: { taskType }
    };
  }

  /**
   * Smart truncate content preserving structure
   * @private
   */
  _smartTruncate(content, maxTokens) {
    const currentTokens = this.tokenCounter.count(content).tokens;

    if (currentTokens <= maxTokens) {
      return content;
    }

    // Try to preserve complete sections
    const sections = content.split(/(?=^##\s)/m);

    if (sections.length > 1 && this.config.preserveSections) {
      // Keep complete sections that fit
      let result = '';
      let usedTokens = 0;

      for (const section of sections) {
        const sectionTokens = this.tokenCounter.count(section).tokens;

        if (usedTokens + sectionTokens <= maxTokens) {
          result += section;
          usedTokens += sectionTokens;
        } else if (usedTokens === 0) {
          // First section doesn't fit - truncate it
          result = this._hardTruncate(section, maxTokens);
          break;
        } else {
          // Add truncation notice
          result += '\n\n[Content truncated for token budget]';
          break;
        }
      }

      return result;
    }

    // Fall back to hard truncation
    return this._hardTruncate(content, maxTokens);
  }

  /**
   * Hard truncate by character estimation
   * @private
   */
  _hardTruncate(content, maxTokens) {
    const capacity = this.tokenCounter.estimateCapacity(maxTokens);
    const maxChars = capacity.estimatedCharacters;

    if (content.length <= maxChars) {
      return content;
    }

    // Find a good break point
    let cutPoint = maxChars;

    // Try to break at paragraph
    const paragraphBreak = content.lastIndexOf('\n\n', maxChars);
    if (paragraphBreak > maxChars * 0.7) {
      cutPoint = paragraphBreak;
    } else {
      // Try to break at sentence
      const sentenceBreak = content.lastIndexOf('. ', maxChars);
      if (sentenceBreak > maxChars * 0.8) {
        cutPoint = sentenceBreak + 1;
      }
    }

    return content.slice(0, cutPoint).trim() + '\n\n[Content truncated]';
  }

  /**
   * Truncate multiple files proportionally
   * @private
   */
  _truncateMultipleFiles(researchFiles, tokenBudget) {
    // Calculate total tokens and per-file tokens
    const fileTokens = researchFiles.map(file => ({
      filename: file.filename,
      content: file.content,
      tokens: this.tokenCounter.count(file.content).tokens
    }));

    const totalTokens = fileTokens.reduce((sum, f) => sum + f.tokens, 0);

    // Reserve some tokens for headers and separators
    const overheadPerFile = 50; // Estimate for headers
    const availableForContent = tokenBudget - (fileTokens.length * overheadPerFile);

    // Proportionally allocate tokens
    const ratio = availableForContent / totalTokens;

    const truncatedParts = fileTokens.map(file => {
      const allocated = Math.floor(file.tokens * ratio);
      let content = file.content;

      if (file.tokens > allocated) {
        content = this._hardTruncate(content, allocated);
      }

      return `## ${file.filename}\n\n${content}`;
    });

    return truncatedParts.join('\n\n---\n\n');
  }

  /**
   * Truncate components to fit budget
   * @private
   */
  _truncateToFit(components, targetTokens, truncatedList) {
    // Sort by priority (highest number = lowest priority = truncate first)
    const sortedByPriority = [...components].sort(
      (a, b) => b.priority - a.priority
    );

    let currentTotal = components.reduce((sum, c) => sum + c.tokens, 0);
    const overage = currentTotal - targetTokens;

    if (overage <= 0) return;

    let toRemove = overage;

    for (const component of sortedByPriority) {
      if (toRemove <= 0) break;
      if (!component.truncatable) continue;

      // Find the component in the original array
      const originalIndex = components.findIndex(c => c.name === component.name);
      if (originalIndex === -1) continue;

      const maxReduction = component.tokens * 0.5; // Don't reduce more than 50%

      if (toRemove >= component.tokens) {
        // Remove entirely
        components.splice(originalIndex, 1);
        truncatedList.push(`${component.name} (removed)`);
        toRemove -= component.tokens;
      } else if (toRemove <= maxReduction) {
        // Partial truncation
        const newTokens = component.tokens - toRemove;
        const truncated = this._smartTruncate(component.content, newTokens);
        components[originalIndex].content = truncated;
        components[originalIndex].tokens = this.tokenCounter.count(truncated).tokens;
        truncatedList.push(component.name);
        toRemove = 0;
      }
    }
  }
}

/**
 * Create a context assembler with configuration
 * @param {AssemblerConfig} config - Configuration
 * @returns {ContextAssembler}
 */
export function createAssembler(config = {}) {
  return new ContextAssembler(config);
}

// Singleton instance
let _instance = null;

/**
 * Get or create singleton context assembler
 * @param {AssemblerConfig} config - Configuration (only used on first call)
 * @returns {ContextAssembler}
 */
export function getAssembler(config = {}) {
  if (!_instance) {
    _instance = new ContextAssembler(config);
  }
  return _instance;
}

/**
 * Quick assemble function
 * @param {Object} params - Assembly parameters
 * @returns {AssembledContext}
 */
export function assembleContext(params) {
  return getAssembler().assemble(params);
}

export default ContextAssembler;
