/**
 * Unified Content Generation Routes
 * Phase 2: Handles generation and retrieval of all three content types
 * (Roadmap, Slides, Document)
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SessionDB, ContentDB, JobDB } from '../db.js';
import { generateAllContent } from '../generators.js';

const router = express.Router();

/**
 * POST /api/content/generate
 * Generates all three content types (roadmap, slides, document) in parallel
 *
 * Request body:
 * {
 *   prompt: string,
 *   researchFiles: Array<{filename: string, content: string}>
 * }
 *
 * Response:
 * {
 *   sessionId: string,
 *   status: 'processing',
 *   message: 'Content generation started'
 * }
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, researchFiles } = req.body;

    // Validate input
    if (!prompt || !researchFiles || !Array.isArray(researchFiles)) {
      return res.status(400).json({
        error: 'Invalid request. Required: prompt (string), researchFiles (array)'
      });
    }

    if (researchFiles.length === 0) {
      return res.status(400).json({
        error: 'At least one research file is required'
      });
    }

    // Generate unique session ID
    const sessionId = uuidv4();

    // Create session record
    SessionDB.create(sessionId, prompt, researchFiles);

    // Create job records for tracking
    const jobIds = {
      roadmap: uuidv4(),
      slides: uuidv4(),
      document: uuidv4()
    };

    JobDB.create(jobIds.roadmap, sessionId, 'roadmap');
    JobDB.create(jobIds.slides, sessionId, 'slides');
    JobDB.create(jobIds.document, sessionId, 'document');

    // Start parallel generation (non-blocking)
    generateAllContent(sessionId, prompt, researchFiles, jobIds)
      .catch(error => {
        console.error('Content generation error:', error);
        SessionDB.updateStatus(sessionId, 'error', error.message);
      });

    // Return immediately with session ID
    res.json({
      sessionId,
      jobIds,
      status: 'processing',
      message: 'Content generation started for all three views'
    });

  } catch (error) {
    console.error('Generate endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /api/content/:sessionId/:viewType
 * Retrieves generated content for a specific view
 *
 * Parameters:
 * - sessionId: Session identifier
 * - viewType: 'roadmap', 'slides', or 'document'
 *
 * Response:
 * {
 *   sessionId: string,
 *   viewType: string,
 *   status: 'completed' | 'processing' | 'error',
 *   data: object | null,
 *   error: string | null
 * }
 */
router.get('/:sessionId/:viewType', async (req, res) => {
  try {
    const { sessionId, viewType } = req.params;

    // Validate view type
    const validViewTypes = ['roadmap', 'slides', 'document'];
    if (!validViewTypes.includes(viewType)) {
      return res.status(400).json({
        error: `Invalid view type. Must be one of: ${validViewTypes.join(', ')}`
      });
    }

    // Check if session exists
    const session = SessionDB.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId
      });
    }

    // Get content for this view
    const content = ContentDB.get(sessionId, viewType);

    if (!content) {
      // Content not yet generated - check job status
      const jobs = JobDB.getBySession(sessionId);
      const job = jobs.find(j => j.content_type === viewType);

      if (!job) {
        return res.status(404).json({
          error: 'No generation job found for this view',
          sessionId,
          viewType
        });
      }

      return res.json({
        sessionId,
        viewType,
        status: job.status,
        data: null,
        error: job.error_message
      });
    }

    // Content exists - return it
    res.json({
      sessionId,
      viewType,
      status: content.status,
      data: content.data,
      error: content.error_message,
      generatedAt: content.generated_at
    });

  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /api/content/:sessionId
 * Retrieves all generated content for a session
 *
 * Response:
 * {
 *   sessionId: string,
 *   status: string,
 *   prompt: string,
 *   content: {
 *     roadmap: { status, data, error },
 *     slides: { status, data, error },
 *     document: { status, data, error }
 *   }
 * }
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if session exists
    const session = SessionDB.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId
      });
    }

    // Get all content
    const roadmap = ContentDB.get(sessionId, 'roadmap');
    const slides = ContentDB.get(sessionId, 'slides');
    const document = ContentDB.get(sessionId, 'document');

    // Get job statuses for content that doesn't exist yet
    const jobs = JobDB.getBySession(sessionId);

    const response = {
      sessionId,
      status: session.status,
      prompt: session.prompt,
      createdAt: session.created_at,
      content: {
        roadmap: roadmap ? {
          status: roadmap.status,
          data: roadmap.data,
          error: roadmap.error_message,
          generatedAt: roadmap.generated_at
        } : {
          status: jobs.find(j => j.content_type === 'roadmap')?.status || 'pending',
          data: null,
          error: jobs.find(j => j.content_type === 'roadmap')?.error_message || null
        },
        slides: slides ? {
          status: slides.status,
          data: slides.data,
          error: slides.error_message,
          generatedAt: slides.generated_at
        } : {
          status: jobs.find(j => j.content_type === 'slides')?.status || 'pending',
          data: null,
          error: jobs.find(j => j.content_type === 'slides')?.error_message || null
        },
        document: document ? {
          status: document.status,
          data: document.data,
          error: document.error_message,
          generatedAt: document.generated_at
        } : {
          status: jobs.find(j => j.content_type === 'document')?.status || 'pending',
          data: null,
          error: jobs.find(j => j.content_type === 'document')?.error_message || null
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Get session content error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * DELETE /api/content/:sessionId
 * Deletes a session and all associated content
 *
 * Response:
 * {
 *   message: 'Session deleted successfully',
 *   sessionId: string
 * }
 */
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if session exists
    const session = SessionDB.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId
      });
    }

    // Delete content
    ContentDB.deleteBySession(sessionId);

    // Delete jobs
    JobDB.deleteBySession(sessionId);

    // Delete session
    SessionDB.delete(sessionId);

    res.json({
      message: 'Session deleted successfully',
      sessionId
    });

  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

export default router;
