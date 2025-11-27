/**
 * Parallel Content Generators
 * Phase 2: Handles parallel AI generation for all three content types
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, slidesSchema } from './prompts/slides.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema } from './prompts/research-analysis.js';

// Initialize Gemini API (using API_KEY from environment to match server/config.js)
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Timeout configuration for AI generation
const GENERATION_TIMEOUT_MS = 120000; // 2 minutes - faster with thinking disabled

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
      console.log(`[APIQueue] ${name} queued (${this.running}/${this.maxConcurrent} running, ${this.queue.length} waiting)`);
      await new Promise(resolve => this.queue.push(resolve));
    }

    this.running++;
    console.log(`[APIQueue] ${name} starting (${this.running}/${this.maxConcurrent} running)`);

    try {
      const result = await task();
      return result;
    } finally {
      this.running--;
      console.log(`[APIQueue] ${name} completed (${this.running}/${this.maxConcurrent} running, ${this.queue.length} waiting)`);

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

// Global API queue instance - max 4 concurrent Gemini API calls
const apiQueue = new APIQueue(4);

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
  thinkingBudget: 0  // Disabled for speed
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
  thinkingBudget: 0      // Disabled for speed
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
  thinkingBudget: 0      // Disabled for speed
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

    console.log(`[${contentType}] Starting generation (timeout: ${GENERATION_TIMEOUT_MS / 1000}s)...`);

    // Wrap the API call with timeout to prevent indefinite hangs
    const result = await withTimeout(
      model.generateContent(prompt),
      GENERATION_TIMEOUT_MS,
      `${contentType} generation`
    );

    const response = result.response;
    const text = response.text();

    console.log(`[${contentType}] Generation complete, parsing JSON...`);
    console.log(`[${contentType}] Response text length: ${text.length}`);

    try {
      const data = JSON.parse(text);
      return data;
    } catch (parseError) {
      // Log the parse error details
      const positionMatch = parseError.message.match(/position (\d+)/);
      const errorPosition = positionMatch ? parseInt(positionMatch[1]) : 0;

      console.error(`[${contentType}] JSON Parse Error:`, parseError.message);
      console.error(`[${contentType}] Total JSON length:`, text.length);
      console.error(`[${contentType}] Problematic JSON (first 500 chars):`, text.substring(0, 500));
      if (errorPosition > 0) {
        const contextStart = Math.max(0, errorPosition - 200);
        const contextEnd = Math.min(text.length, errorPosition + 200);
        console.error(`[${contentType}] JSON around error position:`, text.substring(contextStart, contextEnd));
      }

      // Try to repair the JSON using jsonrepair library
      try {
        console.log(`[${contentType}] Attempting to repair JSON using jsonrepair library...`);
        const repairedJsonText = jsonrepair(text);
        const repairedData = JSON.parse(repairedJsonText);
        console.log(`[${contentType}] Successfully repaired and parsed JSON!`);
        return repairedData;
      } catch (repairError) {
        console.error(`[${contentType}] JSON repair failed:`, repairError.message);
        console.error(`[${contentType}] Full JSON response:`, text);
        throw parseError; // Throw the original parse error
      }
    }

  } catch (error) {
    console.error(`[${contentType}] Generation error:`, error);
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
    console.log(`[Roadmap] Starting generation`);
    console.log(`[Roadmap] Using config: temp=${ROADMAP_CONFIG.temperature}, topP=${ROADMAP_CONFIG.topP}, topK=${ROADMAP_CONFIG.topK}, thinkingBudget=${ROADMAP_CONFIG.thinkingBudget}`);

    const prompt = generateRoadmapPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG);

    console.log(`[Roadmap] Successfully generated`);
    return { success: true, data };

  } catch (error) {
    console.error('[Roadmap] Generation failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate slides - simplified MVP
 */
async function generateSlides(userPrompt, researchFiles) {
  try {
    console.log(`[Slides] Starting...`);

    const prompt = generateSlidesPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    console.log(`[Slides] Done: ${data?.slides?.length || 0} slides`);
    return { success: true, data };
  } catch (error) {
    console.error('[Slides] Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate document content (executive summary) - MVP
 * Optimized for SPEED with no thinking budget
 */
async function generateDocument(userPrompt, researchFiles) {
  try {
    console.log(`[Document] Starting...`);

    const prompt = generateDocumentPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG);

    console.log(`[Document] Done: ${data?.sections?.length || 0} sections`);
    return { success: true, data };
  } catch (error) {
    console.error('[Document] Failed:', error.message);
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
    console.log(`[ResearchAnalysis] Starting generation`);
    console.log(`[ResearchAnalysis] Using config: temp=${RESEARCH_ANALYSIS_CONFIG.temperature}, topP=${RESEARCH_ANALYSIS_CONFIG.topP}, topK=${RESEARCH_ANALYSIS_CONFIG.topK}, thinkingBudget=${RESEARCH_ANALYSIS_CONFIG.thinkingBudget}`);

    const prompt = generateResearchAnalysisPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);

    console.log(`[ResearchAnalysis] Successfully generated with ${data.themes?.length || 0} themes analyzed`);
    return { success: true, data };

  } catch (error) {
    console.error('[ResearchAnalysis] Generation failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate all content types in parallel
 */
export async function generateAllContent(userPrompt, researchFiles) {
  try {
    console.log(`[Generation] Starting all content generation in parallel`);

    const [roadmap, slides, document, researchAnalysis] = await Promise.all([
      generateRoadmap(userPrompt, researchFiles),
      generateSlides(userPrompt, researchFiles),
      generateDocument(userPrompt, researchFiles),
      generateResearchAnalysis(userPrompt, researchFiles)
    ]);

    console.log(`[Generation] Done`);

    return { roadmap, slides, document, researchAnalysis };

  } catch (error) {
    console.error(`[Generation] Error:`, error.message);
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
    console.error(`Regeneration error for ${viewType}:`, error);
    throw error;
  }
}
