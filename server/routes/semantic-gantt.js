/**
 * Semantic Gantt Routes Module
 * Handles bimodal (fact/inference) chart generation endpoints
 *
 * Key Difference from charts.js:
 * - Uses DeterministicGeminiClient (temp=0, topK=1)
 * - Two-pass generation (facts → inferences)
 * - Semantic validation with soft repair
 * - Returns BimodalGanttData structure
 */

import express from 'express';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { CONFIG } from '../config.js';
import { sanitizePrompt, isValidChartId, isValidJobId, isValidSessionId } from '../utils.js';
import { createSession, storeChart, getChart, createJob, updateJob, completeJob, failJob, getJob } from '../storage.js';
import { getDeterministicClient } from '../gemini-deterministic.js';
import { semanticValidator } from '../validation/semantic-repair.js';
import { strictLimiter, apiLimiter, semanticUploadMiddleware } from '../middleware.js';
import { trackEvent } from '../database.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════
// SEMANTIC CHART GENERATION
// ═══════════════════════════════════════════════════════════

/**
 * Processes semantic chart generation asynchronously
 * Uses two-pass deterministic generation with validation
 * @param {string} jobId - Job identifier
 * @param {Object} reqBody - Request body with prompt
 * @param {Array} files - Uploaded research files
 * @returns {Promise<void>}
 */
async function processSemanticChartGeneration(jobId, reqBody, files) {
  try {
    console.log(`[Semantic Job ${jobId}] Starting semantic chart generation...`);

    // Update job status
    updateJob(jobId, {
      status: 'processing',
      progress: 'Initializing semantic analysis...'
    });

    const userPrompt = reqBody.prompt || 'Generate a project timeline';

    // Sanitize user prompt (reuse existing security)
    const sanitizedPrompt = sanitizePrompt(userPrompt);

    // Extract text from uploaded files (same as charts.js)
    let researchTextCache = "";
    let researchFilesCache = [];

    updateJob(jobId, {
      status: 'processing',
      progress: `Processing ${files?.length || 0} uploaded file(s)...`
    });

    if (files && files.length > 0) {
      const sortedFiles = files.sort((a, b) => a.originalname.localeCompare(b.originalname));

      // Process files in parallel (supports DOCX and PDF)
      const fileProcessingPromises = sortedFiles.map(async (file) => {
        let content = '';

        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // DOCX processing
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          content = result.value;
        } else if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
          // PDF processing
          const data = await pdfParse(file.buffer);
          content = data.text;
        } else {
          // Plain text/markdown
          content = file.buffer.toString('utf8');
        }

        return {
          name: file.originalname,
          content: content
        };
      });

      const processedFiles = await Promise.all(fileProcessingPromises);

      // Combine all file contents with markers
      for (const processedFile of processedFiles) {
        researchTextCache += `\n\n--- Start of file: ${processedFile.name} ---\n`;
        researchFilesCache.push(processedFile.name);
        researchTextCache += processedFile.content;
        researchTextCache += `\n--- End of file: ${processedFile.name} ---\n`;
      }

      console.log(`[Semantic Job ${jobId}] Processed ${processedFiles.length} files (${researchTextCache.length} characters)`);
    }

    // Create session for research context (reuse existing pattern)
    // Note: createSession generates its own sessionId and returns it
    console.log(`[Semantic Job ${jobId}] About to create session with ${researchFilesCache.length} files`);
    let sessionId;
    try {
      sessionId = createSession(researchTextCache, researchFilesCache);
      console.log(`[Semantic Job ${jobId}] ✅ Created session: ${sessionId}`);
    } catch (sessionError) {
      console.error(`[Semantic Job ${jobId}] ❌ Session creation failed:`, sessionError.message);
      console.error(`[Semantic Job ${jobId}] Session error stack:`, sessionError.stack);
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }

    // PASS 1: Extract Facts
    updateJob(jobId, {
      status: 'processing',
      progress: 'PASS 1: Extracting explicit facts from documents...'
    });

    const geminiClient = getDeterministicClient(process.env.API_KEY);

    // Truncate research content to avoid token limits
    // Semantic generation uses more tokens due to two-pass system
    // Use configured limit (default: 100,000 chars ≈ 25,000 tokens)
    let truncatedResearch = researchTextCache;

    if (researchTextCache.length > CONFIG.SEMANTIC.MAX_RESEARCH_CHARS) {
      console.log(`[Semantic Job ${jobId}] Research content truncated from ${researchTextCache.length} to ${CONFIG.SEMANTIC.MAX_RESEARCH_CHARS} characters`);
      truncatedResearch = researchTextCache.substring(0, CONFIG.SEMANTIC.MAX_RESEARCH_CHARS) +
        '\n\n[... Content truncated due to length. Please reduce the amount of research files for complete analysis ...]';
    }

    // Generate bimodal data (two-pass: facts → inferences)
    updateJob(jobId, {
      status: 'processing',
      progress: 'PASS 2: Generating logical inferences...'
    });

    const rawData = await geminiClient.generateStructuredGantt(
      truncatedResearch,
      sanitizedPrompt,
      sessionId
    );

    console.log(`[Semantic Job ${jobId}] Two-pass generation complete`);

    // Validate and repair data
    updateJob(jobId, {
      status: 'processing',
      progress: 'Validating and repairing data...'
    });

    const validationResult = await semanticValidator.validateAndRepair(rawData);

    if (!validationResult.success) {
      throw new Error(`Validation failed: ${validationResult.error || 'Unknown error'}`);
    }

    const semanticData = validationResult.data;
    console.log(`[Semantic Job ${jobId}] Validation complete - ${validationResult.stats.totalRepairs} repairs applied`);

    // Store chart data with unique ID for URL-based sharing
    // Note: storeChart generates its own chartId and returns it
    const chartDataWithEnhancements = {
      ganttData: semanticData,
      executiveSummary: null, // Can be generated later
      presentationSlides: null // Can be generated later
    };

    console.log(`[Semantic Job ${jobId}] About to call storeChart with sessionId: ${sessionId}`);
    const chartId = storeChart(chartDataWithEnhancements, sessionId);
    console.log(`[Semantic Job ${jobId}] ✅ storeChart succeeded, chartId: ${chartId} (in-memory, 1-hour expiration)`);
    console.log(`[Semantic Job ${jobId}] Semantic metadata:`, {
      factCount: semanticData.statistics.explicitTasks,
      inferenceCount: semanticData.statistics.inferredTasks,
      averageConfidence: semanticData.statistics.averageConfidence,
      dataQualityScore: semanticData.statistics.dataQualityScore,
      repairsApplied: validationResult.repairs?.length || 0
    });

    // Track analytics event
    try {
      console.log(`[Semantic Job ${jobId}] About to call trackEvent`);
      trackEvent('semantic_chart_generated', {
        chartId,
        sessionId,
        jobId,
        factCount: semanticData.statistics.explicitTasks,
        inferenceCount: semanticData.statistics.inferredTasks,
        fileCount: researchFilesCache.length
      }, chartId, sessionId);
      console.log(`[Semantic Job ${jobId}] trackEvent succeeded`);
    } catch (analyticsError) {
      console.error(`[Semantic Job ${jobId}] Analytics tracking failed:`, analyticsError.message);
      console.error(`[Semantic Job ${jobId}] Analytics error stack:`, analyticsError.stack);
    }

    // Mark job as complete with full chart data
    const completeData = {
      ...semanticData,  // Spread the semantic chart data (tasks, dependencies, projectSummary, etc.)
      sessionId,
      chartId
    };
    completeJob(jobId, completeData);
    console.log(`[Semantic Job ${jobId}] ✅ COMPLETE - Chart ID: ${chartId}`);

  } catch (error) {
    console.error(`[Semantic Job ${jobId}] ❌ FAILED:`, error.message);
    console.error(error.stack);

    // Mark job as failed
    failJob(jobId, `Semantic chart generation failed: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/generate-semantic-gantt
 * Generate bimodal (fact/inference) Gantt chart
 *
 * Request:
 * - prompt: User instructions (form field)
 * - files: Research documents (multipart upload)
 *
 * Response:
 * - jobId: Job identifier for polling
 * - sessionId: Session identifier for context
 */
router.post('/api/generate-semantic-gantt', semanticUploadMiddleware, strictLimiter, (req, res) => {
  try {
    console.log('[Semantic API] Received semantic chart generation request');

    // Create job immediately (createJob generates its own ID)
    const jobId = createJob();

    // Get files from multer
    const files = req.files || [];
    const reqBody = req.body;

    console.log(`[Semantic API] Created job ${jobId} with ${files.length} files`);

    // Start background processing
    processSemanticChartGeneration(jobId, reqBody, files)
      .catch(error => {
        console.error(`[Semantic API] Background processing error for job ${jobId}:`, error);
      });

    // Return jobId immediately
    res.json({
      jobId,
      message: 'Semantic chart generation started',
      mode: 'bimodal',
      deterministic: true
    });

  } catch (error) {
    console.error('[Semantic API] Error creating job:', error);
    res.status(500).json({
      error: 'Failed to start semantic chart generation',
      details: error.message
    });
  }
});

/**
 * GET /api/semantic-gantt/:chartId
 * Retrieve semantic chart by ID
 *
 * Response:
 * - ganttData: Complete BimodalGanttData structure
 * - metadata: Statistics and quality metrics
 */
router.get('/api/semantic-gantt/:chartId', apiLimiter, async (req, res) => {
  try {
    const { chartId } = req.params;

    // Validate chart ID
    if (!chartId || typeof chartId !== 'string') {
      return res.status(400).json({ error: 'Invalid chart ID' });
    }

    console.log(`[Semantic API] Retrieving chart from in-memory storage: ${chartId}`);

    // Get chart from in-memory storage
    const chart = getChart(chartId);

    if (!chart) {
      console.log(`[Semantic API] Chart not found in memory: ${chartId}`);
      return res.status(404).json({ error: 'Chart not found' });
    }

    // Track view event
    try {
      trackEvent('semantic_chart_viewed', { chartId }, chartId, chart.sessionId);
    } catch (analyticsError) {
      console.error('[Semantic API] Analytics tracking failed:', analyticsError.message);
    }

    // Return chart data (chart.data contains the ganttData from storeChart)
    res.json({
      chartId,
      ganttData: chart.data,
      metadata: {
        mode: 'semantic',
        deterministic: true,
        factCount: chart.data?.statistics?.explicitTasks || 0,
        inferenceCount: chart.data?.statistics?.inferredTasks || 0,
        averageConfidence: chart.data?.statistics?.averageConfidence || 0,
        dataQualityScore: chart.data?.statistics?.dataQualityScore || 0,
        sessionId: chart.sessionId
      }
    });

  } catch (error) {
    console.error('[Semantic API] Error retrieving chart:', error);
    res.status(500).json({
      error: 'Failed to retrieve chart',
      details: error.message
    });
  }
});

/**
 * GET /api/semantic-job/:jobId
 * Poll job status (reuses existing job store)
 *
 * Response:
 * - status: queued|processing|complete|error
 * - progress: Human-readable status message
 * - chartId: Chart ID (if complete)
 * - error: Error message (if failed)
 */
router.get('/api/semantic-job/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId || !isValidJobId(jobId)) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const job = getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);

  } catch (error) {
    console.error('[Semantic API] Error retrieving job:', error);
    res.status(500).json({
      error: 'Failed to retrieve job status',
      details: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// UTILITY ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/semantic/info
 * Get semantic engine information and status
 */
router.get('/api/semantic/info', (req, res) => {
  const client = getDeterministicClient(process.env.API_KEY);
  const cacheStats = client.getCacheStats();

  res.json({
    version: '1.0.0',
    mode: 'bimodal',
    features: [
      'Fact/Inference separation',
      'Deterministic output (temp=0)',
      'Source citation tracking',
      'Soft repair validation',
      'Banking domain intelligence'
    ],
    configuration: {
      temperature: 0.0,
      topK: 1,
      topP: 0.0,
      model: 'gemini-2.5-flash-preview'
    },
    cache: cacheStats,
    enabled: CONFIG.SEMANTIC?.ENABLE_DETERMINISTIC_MODE !== false
  });
});

export default router;
