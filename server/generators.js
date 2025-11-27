/**
 * Parallel Content Generators
 * Phase 2: Handles parallel AI generation for all three content types
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, slidesSchema } from './prompts/slides.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema, validateResearchAnalysisStructure } from './prompts/research-analysis.js';

// Initialize Gemini API (using API_KEY from environment to match server/config.js)
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Timeout configuration for AI generation
const GENERATION_TIMEOUT_MS = 300000; // 5 minutes - slides with complex schemas need more time

// ============================================================================
// REQUEST QUEUE - Controls concurrent API calls to prevent overload
// ============================================================================

/**
 * API Request Queue with controlled concurrency
 * Prevents overwhelming the Gemini API with too many simultaneous requests
 */
class APIQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  /**
   * Add a task to the queue
   * @param {Function} task - Async function to execute
   * @param {string} name - Task name for logging
   * @returns {Promise} Result of the task
   */
  async add(task, name = 'unknown') {
    // If we're at capacity, wait in queue
    if (this.running >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }

    this.running++;

    try {
      const result = await task();
      return result;
    } finally {
      this.running--;

      // Release next waiting task
      const next = this.queue.shift();
      if (next) next();
    }
  }

  /**
   * Run multiple tasks with controlled concurrency
   * @param {Array<{task: Function, name: string}>} tasks - Tasks to run
   * @returns {Promise<Array>} Results in same order as input
   */
  async runAll(tasks) {
    return Promise.all(tasks.map(({ task, name }) => this.add(task, name)));
  }
}

// Global API queue instance - max 2 concurrent Gemini API calls
const apiQueue = new APIQueue(2);

/**
 * Generation config presets for different content types
 *
 * DOCUMENT_CONFIG: Optimized for SPEED - MVP executive summaries
 * - No thinking budget for instant generation
 * - Low temperature for consistent output
 */
const DOCUMENT_CONFIG = {
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0   // Zero: fast generation
};

/**
 * Default config for structured outputs
 * - Deterministic for consistent, reproducible results
 * - Used as fallback when no specific config is provided
 */
const STRUCTURED_DEFAULT_CONFIG = {
  thinkingBudget: 24576  // Standard deep reasoning
};

/**
 * Roadmap (Gantt chart) generation config - maximum determinism
 * - Prompt explicitly requires DETERMINISTIC output
 * - Complex rule-based logic for swimlanes, dates, colors
 * - Lowest temperature to ensure consistent rule following
 */
const ROADMAP_CONFIG = {
  temperature: 0.1,      // Lowest: maximum determinism for rule-based output
  topP: 0.3,             // Very constrained: follow explicit rules exactly
  topK: 5,               // Minimal exploration: pick most likely tokens
  thinkingBudget: 24576  // Maximum: complex date mapping and swimlane logic
};

/**
 * Research Analysis generation config - balanced for analytical tasks
 * - Requires judgment for quality scoring and gap identification
 * - Needs some creativity for recommendations
 * - Still schema-constrained output
 */
const RESEARCH_ANALYSIS_CONFIG = {
  temperature: 0.2,      // Low: reliable analysis without hallucination
  topP: 0.5,             // Moderate: allows varied recommendations
  topK: 10,              // Some exploration for insightful suggestions
  thinkingBudget: 24576  // Maximum: deep analysis of research quality
};

/**
 * Slides generation config - optimized for SPEED with 3 simple slide types
 * - NO thinking budget - simple JSON output needs no reasoning
 * - Low temperature for consistent schema adherence
 */
const SLIDES_CONFIG = {
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0   // Zero: no thinking needed for simple JSON
};


/**
 * Execute a promise with timeout
 * @param {Promise} promise - Promise to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error message
 * @returns {Promise} Result or timeout error
 */
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
 * Generate content using Gemini API with structured output
 * @param {string} prompt - The complete prompt
 * @param {object} schema - JSON schema for response
 * @param {string} contentType - Type of content being generated
 * @param {object} configOverrides - Optional config overrides (temperature, topP, topK, thinkingBudget)
 * @returns {Promise<object>} Generated content
 */
async function generateWithGemini(prompt, schema, contentType, configOverrides = {}) {
  try {
    // Merge default config with any overrides
    const {
      temperature,
      topP,
      topK,
      thinkingBudget = STRUCTURED_DEFAULT_CONFIG.thinkingBudget
    } = configOverrides;

    // Build generation config - only include optional params if specified
    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema
    };

    // Only add thinkingConfig if thinkingBudget > 0 (skip for fast generation)
    if (thinkingBudget > 0) {
      generationConfig.thinkingConfig = { thinkingBudget };
    }

    // Add optional creativity parameters if provided
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (topP !== undefined) generationConfig.topP = topP;
    if (topK !== undefined) generationConfig.topK = topK;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-09-2025',
      generationConfig
    });


    // Wrap the API call with timeout to prevent indefinite hangs
    const result = await withTimeout(
      model.generateContent(prompt),
      GENERATION_TIMEOUT_MS,
      `${contentType} generation`
    );

    const response = result.response;
    const text = response.text();


    try {
      const data = JSON.parse(text);
      return data;
    } catch (parseError) {
      // Log the parse error details
      const positionMatch = parseError.message.match(/position (\d+)/);
      const errorPosition = positionMatch ? parseInt(positionMatch[1]) : 0;

      if (errorPosition > 0) {
        const contextStart = Math.max(0, errorPosition - 200);
        const contextEnd = Math.min(text.length, errorPosition + 200);
      }

      // Try to repair the JSON using jsonrepair library
      try {
        const repairedJsonText = jsonrepair(text);
        const repairedData = JSON.parse(repairedJsonText);
        return repairedData;
      } catch (repairError) {
        throw parseError; // Throw the original parse error
      }
    }

  } catch (error) {
    throw new Error(`Failed to generate ${contentType}: ${error.message}`);
  }
}

/**
 * Generate roadmap content (Gantt chart)
 * Uses ROADMAP_CONFIG for maximum determinism - prompt requires DETERMINISTIC output
 *
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateRoadmap(userPrompt, researchFiles) {
  try {

    const prompt = generateRoadmapPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG);

    return { success: true, data };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate slides - simplified MVP
 */
async function generateSlides(userPrompt, researchFiles) {
  try {

    const prompt = generateSlidesPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate document content (executive summary) - MVP
 * Optimized for SPEED with no thinking budget
 */
async function generateDocument(userPrompt, researchFiles) {
  try {

    const prompt = generateDocumentPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG);

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate research analysis content
 * Uses RESEARCH_ANALYSIS_CONFIG for balanced analytical output
 * - Requires judgment for quality scoring and gap identification
 * - Needs some creativity for insightful recommendations
 *
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateResearchAnalysis(userPrompt, researchFiles) {
  try {

    const prompt = generateResearchAnalysisPrompt(userPrompt, researchFiles);
    let data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);

    // Validate research analysis structure
    if (!validateResearchAnalysisStructure(data)) {

      // Retry generation once with same config
      data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);

      if (!validateResearchAnalysisStructure(data)) {
        throw new Error('Research analysis generation produced empty or invalid content after retry. The AI may need more detailed source material.');
      }
    }

    return { success: true, data };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate all content types sequentially
 * Order: 1) Roadmap 2) Slides (fast) 3) Document 4) Research Analysis
 */
export async function generateAllContent(userPrompt, researchFiles) {
  const results = {
    roadmap: null,
    document: null,
    slides: null,
    researchAnalysis: null
  };

  try {

    // STEP 1: Roadmap
    results.roadmap = await generateRoadmap(userPrompt, researchFiles);

    // STEP 2: Slides (fast - no thinking)
    results.slides = await generateSlides(userPrompt, researchFiles);

    // STEP 3: Document
    results.document = await generateDocument(userPrompt, researchFiles);

    // STEP 4: Research Analysis
    results.researchAnalysis = await generateResearchAnalysis(userPrompt, researchFiles);


    return results;

  } catch (error) {
    throw error;
  }
}

/**
 * Regenerate a single content type
 * Uses APIQueue to respect concurrency limits
 *
 * @param {string} viewType - 'roadmap', 'slides', 'document', or 'research-analysis'
 * @param {string} prompt - User prompt
 * @param {Array} researchFiles - Research files
 * @returns {Promise<object>} Generation result
 */
export async function regenerateContent(viewType, prompt, researchFiles) {
  try {
    // Define the generation task
    const taskName = `Regenerate-${viewType}`;
    const task = async () => {
      switch (viewType) {
        case 'roadmap':
          return generateRoadmap(prompt, researchFiles);
        case 'slides':
          return generateSlides(prompt, researchFiles);
        case 'document':
          return generateDocument(prompt, researchFiles);
        case 'research-analysis':
          return generateResearchAnalysis(prompt, researchFiles);
        default:
          throw new Error(`Invalid view type: ${viewType}`);
      }
    };

    // Run through the queue to respect concurrency limits
    return await apiQueue.add(task, taskName);

  } catch (error) {
    throw error;
  }
}
