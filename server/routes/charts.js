/**
 * Chart Routes Module
 * Phase 4 Enhancement: Extracted from server.js
 * Phase 5 Enhancement: Added drag-to-edit task date update endpoint
 * Handles chart generation and retrieval endpoints
 */

import express from 'express';
import mammoth from 'mammoth';
import { CONFIG } from '../config.js';
import { sanitizePrompt, isValidChartId, isValidJobId } from '../utils.js';
import { createSession, storeChart, getChart, createJob, updateJob, getJob, completeJob, failJob } from '../storage.js';
import { callGeminiForJson } from '../gemini.js';
import { CHART_GENERATION_SYSTEM_PROMPT, GANTT_CHART_SCHEMA, EXECUTIVE_SUMMARY_GENERATION_PROMPT, EXECUTIVE_SUMMARY_SCHEMA } from '../prompts.js';
import { strictLimiter, apiLimiter, uploadMiddleware } from '../middleware.js';
import { trackEvent } from '../database.js'; // FEATURE #9: Analytics tracking

const router = express.Router();

/**
 * Processes chart generation asynchronously in the background
 * @param {string} jobId - The job ID
 * @param {Object} reqBody - Request body containing the prompt
 * @param {Array} files - Uploaded files
 * @returns {Promise<void>}
 */
async function processChartGeneration(jobId, reqBody, files) {
  try {
    // Update job status to processing
    updateJob(jobId, {
      status: 'processing',
      progress: 'Analyzing your request...'
    });

    const userPrompt = reqBody.prompt;

    // Parse content generation preferences (default to true for backward compatibility)
    const generateExecutiveSummary = reqBody.generateExecutiveSummary !== 'false';

    console.log(`Job ${jobId}: Content generation preferences:`, {
      generateExecutiveSummary
    });

    // Sanitize user prompt to prevent prompt injection attacks
    const sanitizedPrompt = sanitizePrompt(userPrompt);

    // Create request-scoped storage (fixes global cache memory leak)
    let researchTextCache = "";
    let researchFilesCache = [];

    // Update progress
    updateJob(jobId, {
      status: 'processing',
      progress: `Processing ${files?.length || 0} uploaded file(s)...`
    });

    // Extract text from uploaded files (Sort for determinism, process in parallel)
    if (files && files.length > 0) {
      const sortedFiles = files.sort((a, b) => a.originalname.localeCompare(b.originalname));

      // Process files in parallel for better performance with large folders
      const fileProcessingPromises = sortedFiles.map(async (file) => {
        let content = '';

        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const result = await mammoth.convertToHtml({ buffer: file.buffer });
          content = result.value;
        } else {
          content = file.buffer.toString('utf8');
        }

        return {
          name: file.originalname,
          content: content
        };
      });

      // Wait for all files to be processed
      const processedFiles = await Promise.all(fileProcessingPromises);

      // Combine all file contents in order
      for (const processedFile of processedFiles) {
        researchTextCache += `\n\n--- Start of file: ${processedFile.name} ---\n`;
        researchFilesCache.push(processedFile.name);
        researchTextCache += processedFile.content;
        researchTextCache += `\n--- End of file: ${processedFile.name} ---\n`;
      }

      console.log(`Job ${jobId}: Processed ${processedFiles.length} files (${researchTextCache.length} characters total)`);
    }

    // Update progress
    updateJob(jobId, {
      status: 'processing',
      progress: 'Generating chart data with AI...'
    });

    // Build user query
    const geminiUserQuery = `${sanitizedPrompt}

**CRITICAL REMINDER:** You MUST escape all newlines (\\n) and double-quotes (\") found in the research content before placing them into the final JSON string values.

Research Content:
${researchTextCache}`;

    // Define the payload
    const payload = {
      contents: [{ parts: [{ text: geminiUserQuery }] }],
      systemInstruction: { parts: [{ text: CHART_GENERATION_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GANTT_CHART_SCHEMA,
        maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_CHART,
        temperature: CONFIG.API.TEMPERATURE_STRUCTURED,
        topP: CONFIG.API.TOP_P,
        topK: CONFIG.API.TOP_K
      }
    };

    // Call the API with retry callback to update job status
    const ganttData = await callGeminiForJson(
      payload,
      CONFIG.API.RETRY_COUNT,
      (attemptNum, error) => {
        // Update job status to show retry attempt
        updateJob(jobId, {
          status: 'processing',
          progress: `Retrying AI request (attempt ${attemptNum + 1}/${CONFIG.API.RETRY_COUNT})...`
        });
        console.log(`Job ${jobId}: Retrying due to error: ${error.message}`);
      }
    );

    // Debug: Log what we received from AI
    console.log(`Job ${jobId}: Received ganttData from AI with keys:`, Object.keys(ganttData || {}));
    console.log(`Job ${jobId}: Has timeColumns:`, !!ganttData?.timeColumns, 'Has data:', !!ganttData?.data);

    // Validate data structure before proceeding
    if (!ganttData || typeof ganttData !== 'object') {
      throw new Error('AI returned invalid data structure (not an object)');
    }

    if (!ganttData.timeColumns || !Array.isArray(ganttData.timeColumns)) {
      console.error(`Job ${jobId}: Invalid timeColumns. Type:`, typeof ganttData.timeColumns, 'Value:', ganttData.timeColumns);
      throw new Error('AI returned invalid timeColumns (not an array)');
    }

    if (!ganttData.data || !Array.isArray(ganttData.data)) {
      console.error(`Job ${jobId}: Invalid data. Type:`, typeof ganttData.data, 'Value:', ganttData.data);
      throw new Error('AI returned invalid data array (not an array)');
    }

    if (ganttData.timeColumns.length === 0) {
      throw new Error('AI returned empty timeColumns array');
    }

    if (ganttData.data.length === 0) {
      throw new Error('AI returned empty data array');
    }

    console.log(`Job ${jobId}: Data validation passed - timeColumns: ${ganttData.timeColumns.length} items, data: ${ganttData.data.length} tasks`);

    // NEW: Executive Summary Generation (conditional)
    let executiveSummary = null;
    if (generateExecutiveSummary) {
      // Update progress
      updateJob(jobId, {
        status: 'processing',
        progress: 'Generating executive summary...'
      });

      try {
      console.log(`Job ${jobId}: Generating executive summary from research data...`);

      const executiveSummaryQuery = `${sanitizedPrompt}

Analyze the following research content and generate a comprehensive executive summary that synthesizes strategic insights across all documents.

Research Content:
${researchTextCache}`;

      const executiveSummaryPayload = {
        contents: [{ parts: [{ text: executiveSummaryQuery }] }],
        systemInstruction: { parts: [{ text: EXECUTIVE_SUMMARY_GENERATION_PROMPT }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: EXECUTIVE_SUMMARY_SCHEMA,
          maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_CHART,
          temperature: 0.8,  // Increased from 0.7 for bifurcation style (more creative/theatrical output)
          topP: CONFIG.API.TOP_P,
          topK: CONFIG.API.TOP_K
          // NOTE: thinkingConfig temporarily disabled for chart generation
          // Re-enable after testing if it's causing JSON parsing issues
          // thinkingConfig: {
          //   thinkingBudget: CONFIG.API.THINKING_BUDGET_EXECUTIVE
          // }
        }
      };

      const summaryResponse = await callGeminiForJson(
        executiveSummaryPayload,
        CONFIG.API.RETRY_COUNT,
        (attemptNum, error) => {
          updateJob(jobId, {
            status: 'processing',
            progress: `Retrying executive summary generation (attempt ${attemptNum + 1}/${CONFIG.API.RETRY_COUNT})...`
          });
          console.log(`Job ${jobId}: Retrying executive summary due to error: ${error.message}`);
        }
      );

      // Extract the executiveSummary object from the response
      executiveSummary = summaryResponse.executiveSummary;

      // Add metadata
      if (executiveSummary && executiveSummary.metadata) {
        executiveSummary.metadata.lastUpdated = new Date().toISOString();
        executiveSummary.metadata.documentsCited = researchFilesCache.length;
      }

        console.log(`Job ${jobId}: Executive summary generated successfully`);
      } catch (summaryError) {
        console.error(`Job ${jobId}: Failed to generate executive summary:`, summaryError);
        // Don't fail the entire job if executive summary fails - just log it
        executiveSummary = null;
      }
    } else {
      console.log(`Job ${jobId}: Skipping executive summary generation (user disabled)`);
    }

    // Update progress
    updateJob(jobId, {
      status: 'processing',
      progress: 'Finalizing chart...'
    });

    // Create session to store research data for future requests
    const sessionId = createSession(researchTextCache, researchFilesCache);

    // Store chart data with unique ID for URL-based sharing (including executive summary)
    const chartDataWithEnhancements = {
      ...ganttData,
      executiveSummary: executiveSummary
    };
    const chartId = storeChart(chartDataWithEnhancements, sessionId);

    // Update job status to complete
    const completeData = {
      ...ganttData,
      executiveSummary: executiveSummary,
      sessionId,
      chartId
    };
    console.log(`Job ${jobId}: Setting complete status with data keys:`, Object.keys(completeData));
    console.log(`Job ${jobId}: Final data structure:`, {
      hasExecutiveSummary: !!executiveSummary
    });

    // Verify completeData before storing
    if (!completeData.timeColumns || !completeData.data) {
      console.error(`Job ${jobId}: Data corruption detected in completeData!`, {
        hasTimeColumns: !!completeData.timeColumns,
        hasData: !!completeData.data,
        keys: Object.keys(completeData)
      });
      throw new Error('Data corruption detected when creating completeData');
    }

    completeJob(jobId, completeData);

    // FEATURE #9: Track successful chart generation
    const taskCount = ganttData.data.length;
    const generationTime = Date.now() - (getJob(jobId)?.createdAt || Date.now());
    trackEvent('chart_generated', {
      taskCount,
      generationTime,
      hasExecutiveSummary: !!executiveSummary,
      fileCount: researchFilesCache.length
    }, chartId, sessionId);

    console.log(`Job ${jobId}: Successfully completed`);

  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);

    // FEATURE #9: Track failed chart generation
    trackEvent('chart_failed', {
      errorMessage: error.message,
      errorType: error.constructor.name
    }, null, null);

    failJob(jobId, error.message);
  }
}

/**
 * POST /generate-chart
 * Starts an async chart generation job
 */
router.post('/generate-chart', uploadMiddleware.array('researchFiles'), strictLimiter, async (req, res) => {
  // Generate unique job ID
  const jobId = createJob();

  console.log(`Creating new job ${jobId} with ${req.files?.length || 0} files`);
  console.log(`Request body:`, {
    generateExecutiveSummary: req.body.generateExecutiveSummary,
    prompt: req.body.prompt ? '(present)' : '(missing)'
  });

  // Return job ID immediately (< 100ms response time)
  res.json({
    jobId,
    status: 'processing',
    message: 'Chart generation started. Poll /job/:id for status updates.'
  });

  console.log(`Job ${jobId} queued, starting background processing...`);

  // Process the chart generation asynchronously in the background
  processChartGeneration(jobId, req.body, req.files)
    .catch(error => {
      console.error(`Background job ${jobId} encountered error:`, error);
    });
});

/**
 * GET /job/:id
 * Retrieves the status of a chart generation job
 * Note: No rate limiting applied since this is a lightweight status check
 * and clients poll frequently (every 1 second) during job processing
 */
router.get('/job/:id', (req, res) => {
  const jobId = req.params.id;

  // Validate job ID format
  if (!isValidJobId(jobId)) {
    console.log(`Invalid job ID format: ${jobId}`);
    return res.status(400).json({ error: CONFIG.ERRORS.INVALID_JOB_ID });
  }

  const job = getJob(jobId);
  if (!job) {
    console.log(`Job not found: ${jobId}`);
    return res.status(404).json({
      error: CONFIG.ERRORS.JOB_NOT_FOUND
    });
  }

  console.log(`Job ${jobId} status check: ${job.status}`);

  // Return job status
  if (job.status === 'complete') {
    console.log(`Job ${jobId} complete, returning data with keys:`, Object.keys(job.data || {}));

    // Verify data integrity before sending to client
    if (!job.data || typeof job.data !== 'object') {
      console.error(`Job ${jobId}: Invalid job.data structure. Type:`, typeof job.data);
      return res.status(500).json({ error: 'Internal server error: Invalid job data structure' });
    }

    if (!job.data.timeColumns || !Array.isArray(job.data.timeColumns)) {
      console.error(`Job ${jobId}: Invalid timeColumns in job.data. Type:`, typeof job.data.timeColumns);
      return res.status(500).json({ error: 'Internal server error: Invalid timeColumns' });
    }

    if (!job.data.data || !Array.isArray(job.data.data)) {
      console.error(`Job ${jobId}: Invalid data array in job.data. Type:`, typeof job.data.data);
      return res.status(500).json({ error: 'Internal server error: Invalid data array' });
    }

    console.log(`Job ${jobId}: Data validation passed before sending - timeColumns: ${job.data.timeColumns.length}, data: ${job.data.data.length}`);

    // Log the exact response structure being sent
    const response = {
      status: job.status,
      progress: job.progress,
      data: job.data
    };
    console.log(`Job ${jobId}: Sending response with structure:`, {
      status: response.status,
      progress: response.progress,
      dataKeys: Object.keys(response.data),
      dataHasTimeColumns: Array.isArray(response.data.timeColumns),
      dataHasData: Array.isArray(response.data.data),
      timeColumnsLength: response.data.timeColumns?.length,
      dataLength: response.data.data?.length
    });

    res.json(response);
  } else if (job.status === 'error') {
    console.log(`Job ${jobId} error: ${job.error}`);
    res.json({
      status: job.status,
      error: job.error
    });
  } else {
    // Processing or queued
    console.log(`Job ${jobId} still ${job.status}: ${job.progress}`);
    res.json({
      status: job.status,
      progress: job.progress
    });
  }
});

/**
 * GET /chart/:id
 * Retrieves a chart by its ID (in-memory only)
 */
router.get('/chart/:id', (req, res) => {
  const chartId = req.params.id;
  console.log(`📊 Chart request received for ID: ${chartId}`);

  // Validate chart ID format
  if (!isValidChartId(chartId)) {
    console.log(`❌ Invalid chart ID format: ${chartId}`);
    return res.status(400).json({ error: CONFIG.ERRORS.INVALID_CHART_ID });
  }

  // Get chart from in-memory storage
  const chart = getChart(chartId);

  if (!chart) {
    console.log(`❌ Chart not found in memory: ${chartId}`);
    return res.status(404).json({
      error: CONFIG.ERRORS.CHART_NOT_FOUND
    });
  }

  // Validate the chart data structure before sending
  if (!chart.data) {
    console.error(`❌ Chart ${chartId} has no data property`);
    return res.status(500).json({ error: 'Chart data is corrupted' });
  }

  if (!chart.data.timeColumns || !Array.isArray(chart.data.timeColumns)) {
    console.error(`❌ Chart ${chartId} has invalid timeColumns. Type:`, typeof chart.data.timeColumns);
    return res.status(500).json({ error: 'Chart data structure is invalid' });
  }

  if (!chart.data.data || !Array.isArray(chart.data.data)) {
    console.error(`❌ Chart ${chartId} has invalid data array. Type:`, typeof chart.data.data);
    return res.status(500).json({ error: 'Chart data structure is invalid' });
  }

  console.log(`✅ Chart ${chartId} found - returning ${chart.data.timeColumns.length} timeColumns and ${chart.data.data.length} tasks`);

  // FEATURE #9: Track chart view
  trackEvent('chart_viewed', {
    taskCount: chart.data.data.length,
    hasExecutiveSummary: !!chart.data.executiveSummary
  }, chartId, chart.sessionId);

  // Return chart data along with sessionId for subsequent requests
  const responseData = {
    ...chart.data,
    sessionId: chart.sessionId,
    chartId: chartId
  };

  console.log(`📤 Sending chart data with keys:`, Object.keys(responseData));

  res.json(responseData);
});

/**
 * POST /update-task-dates
 * Phase 5 Enhancement: Updates task dates when dragged in the Gantt chart
 */
router.post('/update-task-dates', express.json(), (req, res) => {
  try {
    const {
      taskName,
      entity,
      sessionId,
      oldStartCol,
      oldEndCol,
      newStartCol,
      newEndCol,
      startDate,
      endDate
    } = req.body;

    console.log(`🔄 Task date update request:`, {
      taskName,
      entity,
      sessionId,
      oldStartCol,
      oldEndCol,
      newStartCol,
      newEndCol,
      startDate,
      endDate
    });

    // Validate required fields
    if (!taskName || !sessionId || newStartCol === undefined || newEndCol === undefined) {
      console.log('❌ Missing required fields for task update');
      return res.status(400).json({
        error: 'Missing required fields: taskName, sessionId, newStartCol, newEndCol'
      });
    }

    // Note: In this implementation, we're acknowledging the update but not persisting it
    // to a database. The chart data is already updated in memory on the client side.
    // For production use, you would:
    // 1. Update the chart data in the chartStore
    // 2. Persist to a database if needed
    // 3. Trigger any necessary recalculations or notifications

    console.log(`✅ Task "${taskName}" dates updated successfully (client-side only)`);

    res.json({
      success: true,
      message: 'Task dates updated',
      taskName,
      newStartCol,
      newEndCol,
      startDate,
      endDate
    });
  } catch (error) {
    console.error('❌ Error updating task dates:', error);
    res.status(500).json({
      error: 'Failed to update task dates',
      details: error.message
    });
  }
});

/**
 * POST /update-task-color
 * Phase 6 Enhancement: Updates task bar color via context menu
 */
router.post('/update-task-color', express.json(), (req, res) => {
  try {
    const {
      taskName,
      entity,
      sessionId,
      taskIndex,
      oldColor,
      newColor
    } = req.body;

    console.log(`🎨 Task color update request:`, {
      taskName,
      taskIndex,
      oldColor,
      newColor
    });

    // Validate required fields
    if (!taskName || !sessionId || taskIndex === undefined || !newColor) {
      console.log('❌ Missing required fields for color update');
      return res.status(400).json({
        error: 'Missing required fields: taskName, sessionId, taskIndex, newColor'
      });
    }

    console.log(`✅ Task "${taskName}" color updated successfully`);

    res.json({
      success: true,
      message: 'Task color updated',
      taskName,
      newColor
    });
  } catch (error) {
    console.error('❌ Error updating task color:', error);
    res.status(500).json({
      error: 'Failed to update task color',
      details: error.message
    });
  }
});

export default router;
