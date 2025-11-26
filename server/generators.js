/**
 * Parallel Content Generators
 * Phase 2: Handles parallel AI generation for all three content types
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { v4 as uuidv4 } from 'uuid';
import { ContentDB, JobDB, SessionDB } from './db.js';
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

// Global API queue instance - max 2 concurrent Gemini API calls
const apiQueue = new APIQueue(2);

/**
 * Generation config presets for different content types
 *
 * DOCUMENT_CREATIVE_CONFIG: Optimized for executive summaries
 * - Balanced creativity for captivating narratives
 * - Grounded through high thinking budget for fact-checking
 * - No seed to allow natural variation between generations
 */
const DOCUMENT_CREATIVE_CONFIG = {
  temperature: 0.4,      // Low-moderate: creative phrasing without hallucination risk
  topP: 0.6,             // Moderate: explores synonyms/phrasings while staying coherent
  topK: 15,              // Relaxed: allows richer vocabulary than greedy decoding
  thinkingBudget: 24576  // Maximum allowed for Gemini 2.5 Flash
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
 * Slides generation config - optimized for determinism with 3 slide types
 * - Very low temperature for consistent, reliable output
 * - Constrained exploration since only 3 slide types exist
 * - Reduced thinking budget since slide types are now simplified
 * - No seed parameter (not well supported by preview models)
 */
const SLIDES_CONFIG = {
  temperature: 0.1,      // Very low: maximum schema adherence (like Gantt chart)
  topP: 0.3,             // Constrained: follow rules exactly
  topK: 5,               // Minimal: only 3 slide types to choose from
  thinkingBudget: 8192   // Reduced: 3 simple slide types don't need max thinking
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
      responseSchema: schema,
      thinkingConfig: {
        thinkingBudget
      }
    };

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
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateRoadmap(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Roadmap] Starting generation for session ${sessionId}`);
    console.log(`[Roadmap] Using config: temp=${ROADMAP_CONFIG.temperature}, topP=${ROADMAP_CONFIG.topP}, topK=${ROADMAP_CONFIG.topK}, thinkingBudget=${ROADMAP_CONFIG.thinkingBudget}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateRoadmapPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG);

    // Store in database
    ContentDB.create(sessionId, 'roadmap', data);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[Roadmap] Successfully generated and stored`);
    return { success: true, data };

  } catch (error) {
    console.error('[Roadmap] Generation failed:', error);
    // Wrap database operations in try-catch to prevent cascade failures
    try {
      JobDB.updateStatus(jobId, 'error', error.message);
      ContentDB.create(sessionId, 'roadmap', null, error.message);
    } catch (dbError) {
      console.error('[Roadmap] Failed to update error status in database:', dbError);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Generate slides content
 * Uses SLIDES_CONFIG for optimal schema compliance + visual variety
 *
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateSlides(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Slides] Starting generation for session ${sessionId}`);
    console.log(`[Slides] Using config: temp=${SLIDES_CONFIG.temperature}, topP=${SLIDES_CONFIG.topP}, topK=${SLIDES_CONFIG.topK}, thinkingBudget=${SLIDES_CONFIG.thinkingBudget}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateSlidesPrompt(userPrompt, researchFiles);
    let data = await generateWithGemini(prompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    // Validate slides structure
    if (!validateSlidesStructure(data)) {
      console.warn('[Slides] Generated data has invalid structure, retrying once...');

      // Retry generation once with same config
      data = await generateWithGemini(prompt, slidesSchema, 'Slides', SLIDES_CONFIG);

      if (!validateSlidesStructure(data)) {
        throw new Error('Slides generation produced empty or invalid content after retry. The AI may need more detailed source material.');
      }
    }

    // Store in database
    ContentDB.create(sessionId, 'slides', data);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[Slides] Successfully generated and stored with ${data.slides.length} slides`);
    return { success: true, data };

  } catch (error) {
    console.error('[Slides] Generation failed:', error);
    // Wrap database operations in try-catch to prevent cascade failures
    try {
      JobDB.updateStatus(jobId, 'error', error.message);
      ContentDB.create(sessionId, 'slides', null, error.message);
    } catch (dbError) {
      console.error('[Slides] Failed to update error status in database:', dbError);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Validate document structure
 * @param {object} data - Generated document data
 * @returns {boolean} True if valid
 */
function validateDocumentStructure(data) {
  if (!data) return false;
  if (!data.sections || !Array.isArray(data.sections)) return false;
  if (data.sections.length === 0) return false;
  if (!data.title) return false;
  return true;
}

/**
 * Check if a slide has appropriate body content based on its type
 * @param {object} slide - The slide object
 * @returns {boolean} True if slide has body content
 */
function slideHasBodyContent(slide) {
  const type = slide.type;

  // ============================================
  // NEW SLIDE TYPES (3 types only)
  // ============================================

  // textTwoColumn - needs paragraphs array
  if (type === 'textTwoColumn') {
    return Array.isArray(slide.paragraphs) && slide.paragraphs.length > 0;
  }

  // textThreeColumn - needs columns array (exactly 3)
  if (type === 'textThreeColumn') {
    return Array.isArray(slide.columns) && slide.columns.length > 0;
  }

  // textWithCards - needs content and cards array
  if (type === 'textWithCards') {
    return !!(slide.content) && Array.isArray(slide.cards) && slide.cards.length > 0;
  }

  // ============================================
  // LEGACY SUPPORT (for backwards compatibility)
  // ============================================

  // Title slides, section dividers, and closing slides don't need body content
  const titleOnlyTypes = [
    'title', 'titleVariantA', 'titleVariantB', 'sectionDivider', 'section',
    'thankYou', 'thankYouAlt'
  ];

  if (titleOnlyTypes.includes(type)) {
    return true; // These types are valid with just a title
  }

  // Bullet slides (legacy)
  if (type === 'bullets' || type === 'bulletsFull') {
    return Array.isArray(slide.bullets) && slide.bullets.length > 0;
  }

  // Content slides (legacy)
  if (type === 'content' || type === 'contentWithImage') {
    return !!(slide.content || slide.text);
  }

  // Multi-column content (legacy)
  if (type === 'contentMultiColumn') {
    return Array.isArray(slide.columns) && slide.columns.length > 0;
  }

  // Card grid (legacy)
  if (type === 'cardGrid') {
    return Array.isArray(slide.cards) && slide.cards.length > 0;
  }

  // Feature grid (legacy)
  if (type === 'featureGrid' || type === 'featureGridRed') {
    return Array.isArray(slide.features) && slide.features.length > 0;
  }

  // Unknown type - be lenient but log it
  console.warn(`[Slides Validation] Unknown slide type: ${type}`);
  return true;
}

/**
 * Validate slides structure
 * @param {object} data - Generated slides data
 * @returns {boolean} True if valid
 */
function validateSlidesStructure(data) {
  if (!data) {
    console.warn('[Slides Validation] No data provided');
    return false;
  }
  if (!data.slides || !Array.isArray(data.slides)) {
    console.warn('[Slides Validation] slides is not an array');
    return false;
  }
  if (data.slides.length === 0) {
    console.warn('[Slides Validation] slides array is empty');
    return false;
  }

  // CRITICAL: Reject unreasonably large numbers of slides (indicates AI error)
  const MAX_SLIDES = 25; // Allow some buffer above the 15-slide guideline
  const MIN_SLIDES = 3;

  if (data.slides.length > MAX_SLIDES) {
    console.error(`[Slides Validation] REJECTED: Too many slides (${data.slides.length}). Maximum allowed: ${MAX_SLIDES}`);
    return false;
  }

  if (data.slides.length < MIN_SLIDES) {
    console.warn(`[Slides Validation] Too few slides (${data.slides.length}). Minimum expected: ${MIN_SLIDES}`);
    return false;
  }

  // Validate each slide has required properties AND body content
  let validSlides = 0;
  let slidesWithContent = 0;
  for (let i = 0; i < data.slides.length; i++) {
    const slide = data.slides[i];

    if (!slide || typeof slide !== 'object') {
      console.warn(`[Slides Validation] Slide ${i} is not an object`);
      continue;
    }

    if (!slide.type || typeof slide.type !== 'string') {
      console.warn(`[Slides Validation] Slide ${i} missing type property`);
      continue;
    }

    if (!slide.title || typeof slide.title !== 'string') {
      console.warn(`[Slides Validation] Slide ${i} missing title property`);
      continue;
    }

    validSlides++;

    // Check for body content
    if (slideHasBodyContent(slide)) {
      slidesWithContent++;
    } else {
      console.warn(`[Slides Validation] Slide ${i} (${slide.type}: "${slide.title}") is missing body content`);
    }
  }

  // At least 80% of slides should be valid (have type and title)
  const validRatio = validSlides / data.slides.length;
  if (validRatio < 0.8) {
    console.error(`[Slides Validation] REJECTED: Too many invalid slides (${validSlides}/${data.slides.length} valid)`);
    return false;
  }

  // CRITICAL: At least 70% of slides should have body content
  // This catches the "titles only" bug
  const contentRatio = slidesWithContent / data.slides.length;
  if (contentRatio < 0.7) {
    console.error(`[Slides Validation] REJECTED: Too many slides missing body content (${slidesWithContent}/${data.slides.length} have content, ${(contentRatio * 100).toFixed(0)}%)`);
    return false;
  }

  console.log(`[Slides Validation] Passed: ${data.slides.length} slides, ${validSlides} valid structure, ${slidesWithContent} with body content`);
  return true;
}

/**
 * Generate document content (executive summary)
 * Uses DOCUMENT_CREATIVE_CONFIG for captivating, insightful narratives
 * while staying grounded through high thinking budget
 *
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateDocument(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Document] Starting generation for session ${sessionId}`);
    console.log(`[Document] Using creative config: temp=${DOCUMENT_CREATIVE_CONFIG.temperature}, topP=${DOCUMENT_CREATIVE_CONFIG.topP}, topK=${DOCUMENT_CREATIVE_CONFIG.topK}, thinkingBudget=${DOCUMENT_CREATIVE_CONFIG.thinkingBudget}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateDocumentPrompt(userPrompt, researchFiles);
    let data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CREATIVE_CONFIG);

    // Validate document structure
    if (!validateDocumentStructure(data)) {
      console.warn('[Document] Generated data has invalid structure, retrying once...');

      // Retry generation once with same creative config
      data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CREATIVE_CONFIG);

      if (!validateDocumentStructure(data)) {
        throw new Error('Document generation produced empty or invalid content after retry. The AI may need more detailed source material.');
      }
    }

    // Store in database
    ContentDB.create(sessionId, 'document', data);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[Document] Successfully generated and stored with ${data.sections.length} sections`);
    return { success: true, data };

  } catch (error) {
    console.error('[Document] Generation failed:', error);
    // Wrap database operations in try-catch to prevent cascade failures
    try {
      JobDB.updateStatus(jobId, 'error', error.message);
      ContentDB.create(sessionId, 'document', null, error.message);
    } catch (dbError) {
      console.error('[Document] Failed to update error status in database:', dbError);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Generate research analysis content
 * Uses RESEARCH_ANALYSIS_CONFIG for balanced analytical output
 * - Requires judgment for quality scoring and gap identification
 * - Needs some creativity for insightful recommendations
 *
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateResearchAnalysis(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[ResearchAnalysis] Starting generation for session ${sessionId}`);
    console.log(`[ResearchAnalysis] Using config: temp=${RESEARCH_ANALYSIS_CONFIG.temperature}, topP=${RESEARCH_ANALYSIS_CONFIG.topP}, topK=${RESEARCH_ANALYSIS_CONFIG.topK}, thinkingBudget=${RESEARCH_ANALYSIS_CONFIG.thinkingBudget}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateResearchAnalysisPrompt(userPrompt, researchFiles);
    let data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);

    // Validate research analysis structure
    if (!validateResearchAnalysisStructure(data)) {
      console.warn('[ResearchAnalysis] Generated data has invalid structure, retrying once...');

      // Retry generation once with same config
      data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);

      if (!validateResearchAnalysisStructure(data)) {
        throw new Error('Research analysis generation produced empty or invalid content after retry. The AI may need more detailed source material.');
      }
    }

    // Store in database
    ContentDB.create(sessionId, 'research-analysis', data);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[ResearchAnalysis] Successfully generated and stored with ${data.themes.length} themes analyzed`);
    return { success: true, data };

  } catch (error) {
    console.error('[ResearchAnalysis] Generation failed:', error);
    // Wrap database operations in try-catch to prevent cascade failures
    try {
      JobDB.updateStatus(jobId, 'error', error.message);
      ContentDB.create(sessionId, 'research-analysis', null, error.message);
    } catch (dbError) {
      console.error('[ResearchAnalysis] Failed to update error status in database:', dbError);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Generate all four content types sequentially
 * Each artifact must complete before the next begins
 * Order: 1) Roadmap (Gantt) 2) Document (Executive Summary) 3) Slides 4) Research Analysis
 *
 * @param {string} sessionId - Session ID
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 * @param {object} jobIds - Job IDs for tracking { roadmap, slides, document, researchAnalysis }
 * @returns {Promise<object>} Results of all generations
 */
export async function generateAllContent(sessionId, userPrompt, researchFiles, jobIds) {
  const results = {
    roadmap: null,
    document: null,
    slides: null,
    researchAnalysis: null
  };

  try {
    console.log(`[Session ${sessionId}] Starting SEQUENTIAL content generation`);

    // Update session status
    try {
      SessionDB.updateStatus(sessionId, 'processing');
    } catch (dbError) {
      console.error(`[Session ${sessionId}] Failed to update initial status:`, dbError);
    }

    // ========================================
    // STEP 1: Generate Roadmap (Gantt Chart)
    // ========================================
    console.log(`[Session ${sessionId}] Step 1/4: Generating Roadmap...`);
    try {
      results.roadmap = await generateRoadmap(sessionId, jobIds.roadmap, userPrompt, researchFiles);
      console.log(`[Session ${sessionId}] Step 1/4: Roadmap ${results.roadmap.success ? 'COMPLETED' : 'FAILED'}`);
    } catch (error) {
      console.error(`[Session ${sessionId}] Step 1/4: Roadmap ERROR:`, error.message);
      results.roadmap = { success: false, error: error.message };
    }

    // ========================================
    // STEP 2: Generate Document (Executive Summary)
    // ========================================
    console.log(`[Session ${sessionId}] Step 2/4: Generating Document...`);
    try {
      results.document = await generateDocument(sessionId, jobIds.document, userPrompt, researchFiles);
      console.log(`[Session ${sessionId}] Step 2/4: Document ${results.document.success ? 'COMPLETED' : 'FAILED'}`);
    } catch (error) {
      console.error(`[Session ${sessionId}] Step 2/4: Document ERROR:`, error.message);
      results.document = { success: false, error: error.message };
    }

    // ========================================
    // STEP 3: Generate Slides
    // ========================================
    console.log(`[Session ${sessionId}] Step 3/4: Generating Slides...`);
    try {
      results.slides = await generateSlides(sessionId, jobIds.slides, userPrompt, researchFiles);
      console.log(`[Session ${sessionId}] Step 3/4: Slides ${results.slides.success ? 'COMPLETED' : 'FAILED'}`);
    } catch (error) {
      console.error(`[Session ${sessionId}] Step 3/4: Slides ERROR:`, error.message);
      results.slides = { success: false, error: error.message };
    }

    // ========================================
    // STEP 4: Generate Research Analysis (QA)
    // ========================================
    console.log(`[Session ${sessionId}] Step 4/4: Generating Research Analysis...`);
    try {
      results.researchAnalysis = await generateResearchAnalysis(sessionId, jobIds.researchAnalysis, userPrompt, researchFiles);
      console.log(`[Session ${sessionId}] Step 4/4: Research Analysis ${results.researchAnalysis.success ? 'COMPLETED' : 'FAILED'}`);
    } catch (error) {
      console.error(`[Session ${sessionId}] Step 4/4: Research Analysis ERROR:`, error.message);
      results.researchAnalysis = { success: false, error: error.message };
    }

    // ========================================
    // Update final session status
    // ========================================
    const allSuccessful = results.roadmap?.success && results.document?.success &&
                          results.slides?.success && results.researchAnalysis?.success;
    const anySuccessful = results.roadmap?.success || results.document?.success ||
                          results.slides?.success || results.researchAnalysis?.success;

    try {
      if (allSuccessful) {
        SessionDB.updateStatus(sessionId, 'completed');
        console.log(`[Session ${sessionId}] All 4 artifacts generated successfully`);
      } else if (anySuccessful) {
        SessionDB.updateStatus(sessionId, 'partial');
        console.log(`[Session ${sessionId}] Some artifacts generated, some failed`);
      } else {
        SessionDB.updateStatus(sessionId, 'error', 'All content generation failed');
        console.log(`[Session ${sessionId}] All content generation failed`);
      }
    } catch (dbError) {
      console.error(`[Session ${sessionId}] Failed to update final status:`, dbError);
    }

    return { sessionId, ...results };

  } catch (error) {
    console.error(`[Session ${sessionId}] Fatal error in generation:`, error);
    try {
      SessionDB.updateStatus(sessionId, 'error', error.message);
    } catch (dbError) {
      console.error(`[Session ${sessionId}] Failed to update error status:`, dbError);
    }
    throw error;
  }
}

/**
 * Regenerate a single content type
 * Uses APIQueue to respect concurrency limits
 *
 * @param {string} sessionId - Session ID
 * @param {string} viewType - 'roadmap', 'slides', 'document', or 'research-analysis'
 * @returns {Promise<object>} Generation result
 */
export async function regenerateContent(sessionId, viewType) {
  try {
    // Get session
    const session = SessionDB.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Note: SessionDB.get() already parses researchFiles, so use it directly
    const { prompt, researchFiles } = session;

    // Create new job (uuidv4 is imported at module level)
    const jobId = uuidv4();
    JobDB.create(jobId, sessionId, viewType);

    // Define the generation task
    const taskName = `Regenerate-${viewType}`;
    const task = async () => {
      switch (viewType) {
        case 'roadmap':
          return generateRoadmap(sessionId, jobId, prompt, researchFiles);
        case 'slides':
          return generateSlides(sessionId, jobId, prompt, researchFiles);
        case 'document':
          return generateDocument(sessionId, jobId, prompt, researchFiles);
        case 'research-analysis':
          return generateResearchAnalysis(sessionId, jobId, prompt, researchFiles);
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
