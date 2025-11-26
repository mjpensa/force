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
const GENERATION_TIMEOUT_MS = 180000; // 3 minutes - generous but not infinite

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
  thinkingBudget: 32768  // High: deeper analysis, better insights, stronger fact-checking
};

/**
 * Default config for structured outputs (roadmap, slides, research-analysis)
 * - Deterministic for consistent, reproducible results
 * - Lower thinking budget sufficient for structured extraction
 */
const STRUCTURED_DEFAULT_CONFIG = {
  thinkingBudget: 24576  // Standard deep reasoning
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
 * Generate roadmap content
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateRoadmap(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Roadmap] Starting generation for session ${sessionId}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateRoadmapPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, roadmapSchema, 'Roadmap');

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
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateSlides(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Slides] Starting generation for session ${sessionId}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateSlidesPrompt(userPrompt, researchFiles);
    let data = await generateWithGemini(prompt, slidesSchema, 'Slides');

    // Validate slides structure
    if (!validateSlidesStructure(data)) {
      console.warn('[Slides] Generated data has invalid structure, retrying once...');

      // Retry generation once
      data = await generateWithGemini(prompt, slidesSchema, 'Slides');

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

  // Validate each slide has required properties
  let validSlides = 0;
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
  }

  // At least 80% of slides should be valid
  const validRatio = validSlides / data.slides.length;
  if (validRatio < 0.8) {
    console.error(`[Slides Validation] REJECTED: Too many invalid slides (${validSlides}/${data.slides.length} valid)`);
    return false;
  }

  console.log(`[Slides Validation] Passed: ${data.slides.length} slides, ${validSlides} valid`);
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
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateResearchAnalysis(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[ResearchAnalysis] Starting generation for session ${sessionId}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateResearchAnalysisPrompt(userPrompt, researchFiles);
    let data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis');

    // Validate research analysis structure
    if (!validateResearchAnalysisStructure(data)) {
      console.warn('[ResearchAnalysis] Generated data has invalid structure, retrying once...');

      // Retry generation once
      data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis');

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
 * Generate all four content types in parallel
 * @param {string} sessionId - Session ID
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 * @param {object} jobIds - Job IDs for tracking { roadmap, slides, document, researchAnalysis }
 * @returns {Promise<object>} Results of all generations
 */
export async function generateAllContent(sessionId, userPrompt, researchFiles, jobIds) {
  try {
    console.log(`[Session ${sessionId}] Starting parallel generation of all content types`);

    // Update session status - wrapped in try-catch to prevent early failures
    try {
      SessionDB.updateStatus(sessionId, 'processing');
    } catch (dbError) {
      console.error(`[Session ${sessionId}] Failed to update initial status:`, dbError);
      // Continue anyway - the session was already created
    }

    // Generate all four in parallel
    const results = await Promise.allSettled([
      generateRoadmap(sessionId, jobIds.roadmap, userPrompt, researchFiles),
      generateSlides(sessionId, jobIds.slides, userPrompt, researchFiles),
      generateDocument(sessionId, jobIds.document, userPrompt, researchFiles),
      generateResearchAnalysis(sessionId, jobIds.researchAnalysis, userPrompt, researchFiles)
    ]);

    // Check results
    const [roadmapResult, slidesResult, documentResult, researchAnalysisResult] = results;

    const allSuccessful = results.every(r => r.status === 'fulfilled' && r.value.success);
    const anySuccessful = results.some(r => r.status === 'fulfilled' && r.value.success);

    // Update session status based on results - wrapped in try-catch
    try {
      if (allSuccessful) {
        SessionDB.updateStatus(sessionId, 'completed');
        console.log(`[Session ${sessionId}] All content generated successfully`);
      } else if (anySuccessful) {
        SessionDB.updateStatus(sessionId, 'partial');
        console.log(`[Session ${sessionId}] Some content generated, some failed`);
      } else {
        SessionDB.updateStatus(sessionId, 'error', 'All content generation failed');
        console.log(`[Session ${sessionId}] All content generation failed`);
      }
    } catch (dbError) {
      console.error(`[Session ${sessionId}] Failed to update final status:`, dbError);
    }

    return {
      sessionId,
      roadmap: roadmapResult.status === 'fulfilled' ? roadmapResult.value : { success: false, error: roadmapResult.reason },
      slides: slidesResult.status === 'fulfilled' ? slidesResult.value : { success: false, error: slidesResult.reason },
      document: documentResult.status === 'fulfilled' ? documentResult.value : { success: false, error: documentResult.reason },
      researchAnalysis: researchAnalysisResult.status === 'fulfilled' ? researchAnalysisResult.value : { success: false, error: researchAnalysisResult.reason }
    };

  } catch (error) {
    console.error(`[Session ${sessionId}] Fatal error in parallel generation:`, error);
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
 * @param {string} sessionId - Session ID
 * @param {string} viewType - 'roadmap', 'slides', or 'document'
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

    // Generate based on type
    let result;
    switch (viewType) {
      case 'roadmap':
        result = await generateRoadmap(sessionId, jobId, prompt, researchFiles);
        break;
      case 'slides':
        result = await generateSlides(sessionId, jobId, prompt, researchFiles);
        break;
      case 'document':
        result = await generateDocument(sessionId, jobId, prompt, researchFiles);
        break;
      case 'research-analysis':
        result = await generateResearchAnalysis(sessionId, jobId, prompt, researchFiles);
        break;
      default:
        throw new Error(`Invalid view type: ${viewType}`);
    }

    return result;

  } catch (error) {
    console.error(`Regeneration error for ${viewType}:`, error);
    throw error;
  }
}
