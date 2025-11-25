/**
 * Unified Content Generation Routes
 * Phase 2: Handles generation and retrieval of all three content types
 * (Roadmap, Slides, Document)
 * Phase 6: Added compatibility layer for legacy chartId support
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';
import { SessionDB, ContentDB, JobDB } from '../db.js';
import { generateAllContent } from '../generators.js';
import { getChart } from '../storage.js'; // Import legacy chart getter for compatibility
import { uploadMiddleware, handleUploadErrors } from '../middleware.js'; // Phase 6: File upload support
import { generatePptx } from '../templates/ppt-export-service.js'; // PPT export service

const router = express.Router();

/**
 * POST /api/content/generate
 * Generates all three content types (roadmap, slides, document) in parallel
 *
 * Phase 6 Update: Now accepts multipart/form-data with file uploads
 *
 * Request (multipart/form-data):
 * - prompt: string (form field)
 * - researchFiles: File[] (uploaded files)
 *
 * Response:
 * {
 *   sessionId: string,
 *   jobIds: { roadmap: string, slides: string, document: string },
 *   status: 'processing',
 *   message: 'Content generation started'
 * }
 */
router.post('/generate', uploadMiddleware.array('researchFiles'), async (req, res) => {
  try {
    const { prompt } = req.body;
    const files = req.files;

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request. Required: prompt (string)'
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'At least one research file is required'
      });
    }

    // Process uploaded files to extract content
    console.log(`Processing ${files.length} uploaded files for content generation`);
    const sortedFiles = files.sort((a, b) => a.originalname.localeCompare(b.originalname));

    // Process files in parallel
    const fileProcessingPromises = sortedFiles.map(async (file) => {
      let content = '';

      // Handle DOCX files with mammoth
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.convertToHtml({ buffer: file.buffer });
        content = result.value;
      } else {
        // Handle text-based files (TXT, MD, etc.)
        content = file.buffer.toString('utf8');
      }

      return {
        filename: file.originalname,
        content: content
      };
    });

    // Wait for all files to be processed
    const researchFiles = await Promise.all(fileProcessingPromises);
    console.log(`Processed ${researchFiles.length} files (${researchFiles.reduce((sum, f) => sum + f.content.length, 0)} total characters)`);

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

    console.log(`[Content GET] Request for sessionId: ${sessionId}, viewType: ${viewType}`);

    // Validate view type
    const validViewTypes = ['roadmap', 'slides', 'document'];
    if (!validViewTypes.includes(viewType)) {
      return res.status(400).json({
        error: `Invalid view type. Must be one of: ${validViewTypes.join(', ')}`
      });
    }

    // **PHASE 6 COMPATIBILITY**: Check if this is a legacy chartId
    // Legacy chartIds are UUIDs from the old /generate-chart system
    const chart = getChart(sessionId);
    if (chart && viewType === 'roadmap') {
      // This is a legacy chartId - return the Gantt chart data as roadmap
      console.log(`[Compatibility] Serving legacy chart ${sessionId} as roadmap`);
      return res.json({
        sessionId,
        viewType: 'roadmap',
        status: 'completed',
        data: chart.data,
        generatedAt: chart.createdAt || new Date().toISOString()
      });
    }

    // If legacy chartId but requesting slides/document, return not available
    if (chart && (viewType === 'slides' || viewType === 'document')) {
      return res.json({
        sessionId,
        viewType,
        status: 'error',
        data: null,
        error: 'This content type is not available for legacy charts. Only roadmap view is supported.'
      });
    }

    // Check if session exists in Phase 2 database
    const session = SessionDB.get(sessionId);
    if (!session) {
      console.log(`[Content GET] Session not found: ${sessionId}`);
      // Provide a more helpful error message that explains potential causes
      return res.status(404).json({
        error: 'Session not found',
        message: 'This session may have been lost due to a server restart. Please try generating again.',
        sessionId,
        hint: 'If this error persists, check that your deployment platform has persistent storage configured for the data directory.'
      });
    }

    console.log(`[Content GET] Session found with status: ${session.status}`);

    // Get content for this view
    const content = ContentDB.get(sessionId, viewType);

    if (!content) {
      console.log(`[Content GET] Content not yet generated, checking job status...`);
      // Content not yet generated - check job status
      const jobs = JobDB.getBySession(sessionId);
      console.log(`[Content GET] Found ${jobs.length} jobs for session`);
      console.log(`[Content GET] Jobs:`, jobs.map(j => ({ contentType: j.contentType, status: j.status })));

      const job = jobs.find(j => j.contentType === viewType);

      if (!job) {
        console.error(`[Content GET] ERROR: No job found for viewType: ${viewType}`);
        console.error(`[Content GET] Available contentTypes:`, jobs.map(j => j.contentType));
        return res.status(404).json({
          error: 'No generation job found for this view',
          sessionId,
          viewType,
          debug: {
            availableJobs: jobs.map(j => j.contentType),
            requestedViewType: viewType
          }
        });
      }

      console.log(`[Content GET] Job found with status: ${job.status}`);
      return res.json({
        sessionId,
        viewType,
        status: job.status,
        data: null,
        error: job.errorMessage
      });
    }

    // Content exists - return it
    console.log(`[Content GET] Content exists with status: ${content.status}`);
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
          status: jobs.find(j => j.contentType === 'roadmap')?.status || 'pending',
          data: null,
          error: jobs.find(j => j.contentType === 'roadmap')?.errorMessage || null
        },
        slides: slides ? {
          status: slides.status,
          data: slides.data,
          error: slides.error_message,
          generatedAt: slides.generated_at
        } : {
          status: jobs.find(j => j.contentType === 'slides')?.status || 'pending',
          data: null,
          error: jobs.find(j => j.contentType === 'slides')?.errorMessage || null
        },
        document: document ? {
          status: document.status,
          data: document.data,
          error: document.error_message,
          generatedAt: document.generated_at
        } : {
          status: jobs.find(j => j.contentType === 'document')?.status || 'pending',
          data: null,
          error: jobs.find(j => j.contentType === 'document')?.errorMessage || null
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
 * GET /api/content/:sessionId/slides/export
 * Exports slides as a branded PowerPoint file
 *
 * Response: PowerPoint file (.pptx) download
 */
router.get('/:sessionId/slides/export', async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log(`[PPT Export] Request for sessionId: ${sessionId}`);

    // Check if session exists
    const session = SessionDB.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId
      });
    }

    // Get slides content
    const slides = ContentDB.get(sessionId, 'slides');

    if (!slides || slides.status !== 'completed' || !slides.data) {
      return res.status(400).json({
        error: 'Slides not available for export',
        message: slides?.status === 'processing'
          ? 'Slides are still being generated. Please wait and try again.'
          : 'Slides have not been generated for this session.',
        status: slides?.status || 'not_found'
      });
    }

    console.log(`[PPT Export] Generating PPTX for session: ${sessionId}`);

    // Generate the PowerPoint file
    const pptxBuffer = await generatePptx(slides.data, {
      author: 'BIP',
      company: 'BIP'
    });

    // Create filename from presentation title or session ID
    const title = slides.data.title || 'Presentation';
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    const filename = `${safeTitle}_${sessionId.substring(0, 8)}.pptx`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pptxBuffer.length);

    console.log(`[PPT Export] Sending PPTX file: ${filename} (${pptxBuffer.length} bytes)`);

    res.send(pptxBuffer);

  } catch (error) {
    console.error('PPT Export error:', error);
    res.status(500).json({
      error: 'Failed to generate PowerPoint file',
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

// Apply upload error handling middleware
router.use(handleUploadErrors);

export default router;
