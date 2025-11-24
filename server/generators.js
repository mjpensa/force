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

// Initialize Gemini API (using API_KEY from environment to match server/config.js)
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

/**
 * Generate content using Gemini API with structured output
 * @param {string} prompt - The complete prompt
 * @param {object} schema - JSON schema for response
 * @param {string} contentType - Type of content being generated
 * @returns {Promise<object>} Generated content
 */
async function generateWithGemini(prompt, schema, contentType) {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-09-2025',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });

    console.log(`[${contentType}] Starting generation...`);
    const result = await model.generateContent(prompt);
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
    const data = await generateWithGemini(prompt, slidesSchema, 'Slides');

    // Store in database
    ContentDB.create(sessionId, 'slides', data);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[Slides] Successfully generated and stored`);
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
 * Generate document content
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateDocument(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Document] Starting generation for session ${sessionId}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateDocumentPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, documentSchema, 'Document');

    // Store in database
    ContentDB.create(sessionId, 'document', data);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[Document] Successfully generated and stored`);
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
 * Generate all three content types in parallel
 * @param {string} sessionId - Session ID
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 * @param {object} jobIds - Job IDs for tracking { roadmap, slides, document }
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

    // Generate all three in parallel
    const results = await Promise.allSettled([
      generateRoadmap(sessionId, jobIds.roadmap, userPrompt, researchFiles),
      generateSlides(sessionId, jobIds.slides, userPrompt, researchFiles),
      generateDocument(sessionId, jobIds.document, userPrompt, researchFiles)
    ]);

    // Check results
    const [roadmapResult, slidesResult, documentResult] = results;

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
      document: documentResult.status === 'fulfilled' ? documentResult.value : { success: false, error: documentResult.reason }
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
      default:
        throw new Error(`Invalid view type: ${viewType}`);
    }

    return result;

  } catch (error) {
    console.error(`Regeneration error for ${viewType}:`, error);
    throw error;
  }
}
