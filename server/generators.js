/**
 * Parallel Content Generators
 * Phase 2: Handles parallel AI generation for all three content types
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
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
    const data = JSON.parse(text);

    return data;

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
    JobDB.updateStatus(jobId, 'error', error.message);
    ContentDB.create(sessionId, 'roadmap', null, error.message);
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
    JobDB.updateStatus(jobId, 'error', error.message);
    ContentDB.create(sessionId, 'slides', null, error.message);
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
    JobDB.updateStatus(jobId, 'error', error.message);
    ContentDB.create(sessionId, 'document', null, error.message);
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

    // Update session status
    SessionDB.updateStatus(sessionId, 'processing');

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

    // Update session status based on results
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

    return {
      sessionId,
      roadmap: roadmapResult.status === 'fulfilled' ? roadmapResult.value : { success: false, error: roadmapResult.reason },
      slides: slidesResult.status === 'fulfilled' ? slidesResult.value : { success: false, error: slidesResult.reason },
      document: documentResult.status === 'fulfilled' ? documentResult.value : { success: false, error: documentResult.reason }
    };

  } catch (error) {
    console.error(`[Session ${sessionId}] Fatal error in parallel generation:`, error);
    SessionDB.updateStatus(sessionId, 'error', error.message);
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

    const { prompt, research_files } = session;
    const researchFiles = JSON.parse(research_files);

    // Create new job
    const { v4: uuidv4 } = await import('uuid');
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
