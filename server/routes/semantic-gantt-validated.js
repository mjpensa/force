/**
 * Validated Semantic Gantt Routes Module
 * Handles cross-validated bimodal (fact/inference) chart generation with full validation pipeline
 *
 * Key Features:
 * - Uses DeterministicGeminiClient (temp=0, topK=1)
 * - Two-pass generation (facts → inferences)
 * - Full validation pipeline (citation, contradiction, provenance, confidence)
 * - Quality gate enforcement
 * - Metrics collection
 * - Returns validated BimodalGanttData structure
 */

import express from 'express';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { CONFIG } from '../config.js';
import { sanitizePrompt, isValidChartId, isValidJobId } from '../utils.js';
import { createSession, storeChart, createJob, updateJob, completeJob, failJob } from '../storage.js';
import { getDeterministicClient } from '../gemini-deterministic.js';
import { semanticValidator } from '../validation/semantic-repair.js';
import { strictLimiter, apiLimiter, semanticUploadMiddleware } from '../middleware.js';
import { trackEvent, createSemanticChart } from '../database.js';
import { researchValidationService } from '../services/ResearchValidationService.js';
import { validationMetricsCollector } from '../services/ValidationMetricsCollector.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════
// VALIDATED SEMANTIC CHART GENERATION
// ═══════════════════════════════════════════════════════════

/**
 * Processes validated semantic chart generation asynchronously
 * Includes full cross-validation pipeline
 * @param {string} jobId - Job identifier
 * @param {Object} reqBody - Request body with prompt
 * @param {Array} files - Uploaded research files
 * @returns {Promise<void>}
 */
async function processValidatedSemanticGeneration(jobId, reqBody, files) {
  try {
    console.log(`[ValidatedSemantic Job ${jobId}] Starting validated semantic chart generation...`);

    // Update job status
    updateJob(jobId, {
      status: 'processing',
      progress: 'Initializing validated semantic analysis...'
    });

    const userPrompt = reqBody.prompt || 'Generate a project timeline';

    // Sanitize user prompt
    const sanitizedPrompt = sanitizePrompt(userPrompt);

    // Extract text from uploaded files
    let researchTextCache = "";
    let sourceDocuments = [];

    updateJob(jobId, {
      status: 'processing',
      progress: `Processing ${files?.length || 0} uploaded file(s)...`
    });

    if (files && files.length > 0) {
      const sortedFiles = files.sort((a, b) => a.originalname.localeCompare(b.originalname));

      // Process files in parallel
      const fileProcessingPromises = sortedFiles.map(async (file) => {
        let content = '';

        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          content = result.value;
        } else if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
          const data = await pdfParse(file.buffer);
          content = data.text;
        } else {
          content = file.buffer.toString('utf8');
        }

        return {
          name: file.originalname,
          content: content
        };
      });

      const processedFiles = await Promise.all(fileProcessingPromises);

      // Store source documents for validation
      sourceDocuments = processedFiles;

      // Combine all file contents with markers
      for (const processedFile of processedFiles) {
        researchTextCache += `\n\n--- Start of file: ${processedFile.name} ---\n`;
        researchTextCache += processedFile.content;
        researchTextCache += `\n--- End of file: ${processedFile.name} ---\n`;
      }

      console.log(`[ValidatedSemantic Job ${jobId}] Processed ${processedFiles.length} files (${researchTextCache.length} characters)`);
    }

    // Create session for research context
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const filenames = sourceDocuments.map(f => f.name);
    createSession(sessionId, researchTextCache, filenames);

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: SEMANTIC GANTT GENERATION
    // ═══════════════════════════════════════════════════════════

    updateJob(jobId, {
      status: 'processing',
      progress: 'Generating deterministic semantic Gantt chart...'
    });

    const deterministicClient = getDeterministicClient(process.env.API_KEY);

    // Generate semantic Gantt data
    const ganttData = await deterministicClient.generateStructuredGantt(
      researchTextCache,
      userPrompt
    );

    console.log(`[ValidatedSemantic Job ${jobId}] Generated Gantt with ${ganttData.tasks?.length || 0} tasks`);

    // Apply semantic validation and repair
    updateJob(jobId, {
      status: 'processing',
      progress: 'Applying semantic validation and repair...'
    });

    const semanticValidation = await semanticValidator.validateAndRepair(ganttData);

    if (!semanticValidation.success) {
      throw new Error('Semantic validation failed: ' + JSON.stringify(semanticValidation.errors));
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: CROSS-VALIDATION PIPELINE
    // ═══════════════════════════════════════════════════════════

    updateJob(jobId, {
      status: 'processing',
      progress: 'Running cross-validation pipeline (citation, contradiction, provenance)...'
    });

    const validationResult = await researchValidationService.validateGanttData(
      semanticValidation.data,
      sourceDocuments
    );

    if (!validationResult.success) {
      console.warn(`[ValidatedSemantic Job ${jobId}] Validation completed with errors:`, validationResult.errors);
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: FINALIZATION
    // ═══════════════════════════════════════════════════════════

    updateJob(jobId, {
      status: 'processing',
      progress: 'Finalizing validated chart...'
    });

    const finalData = validationResult.calibratedData;

    // Add validation metadata to the chart
    finalData.validationMetadata = {
      validationTimestamp: validationResult.timestamp,
      validationSteps: validationResult.validationSteps,
      qualityGateResults: validationResult.qualityGateResults,
      metrics: validationResult.metrics,
      warnings: validationResult.warnings,
      repairsApplied: validationResult.repairsApplied || 0
    };

    // Store the validated chart
    const chartId = `chart-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    storeChart(chartId, {
      ganttData: finalData,
      sessionId: sessionId
    });

    // Store in database
    try {
      await createSemanticChart({
        chartId: chartId,
        sessionId: sessionId,
        ganttData: finalData,
        validationResults: validationResult
      });
    } catch (dbError) {
      console.error(`[ValidatedSemantic Job ${jobId}] Database storage failed:`, dbError.message);
      // Continue anyway - in-memory storage succeeded
    }

    // Track analytics
    try {
      await trackEvent('validated_semantic_chart_generated', {
        chartId: chartId,
        sessionId: sessionId,
        taskCount: finalData.tasks.length,
        validationPassed: validationResult.success,
        qualityGatesPassed: validationResult.qualityGateResults?.passed,
        validationTimeMs: validationResult.metrics?.validationTimeMs
      });
    } catch (analyticsError) {
      console.error(`[ValidatedSemantic Job ${jobId}] Analytics tracking failed:`, analyticsError.message);
    }

    // Complete job
    completeJob(jobId, chartId);

    console.log(`[ValidatedSemantic Job ${jobId}] Completed successfully - Chart ID: ${chartId}`);

  } catch (error) {
    console.error(`[ValidatedSemantic Job ${jobId}] Error:`, error);
    failJob(jobId, error.message);
  }
}

// ═══════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════

/**
 * POST /generate-validated-semantic-chart
 * Creates async job for validated semantic chart generation
 */
router.post(
  '/generate-validated-semantic-chart',
  strictLimiter,
  semanticUploadMiddleware,
  async (req, res) => {
    try {
      console.log('[ValidatedSemantic] Received validated semantic chart generation request');

      // Create job
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      createJob(jobId);

      console.log(`[ValidatedSemantic] Created job ${jobId}`);

      // Process asynchronously (don't await)
      processValidatedSemanticGeneration(jobId, req.body, req.files).catch(err => {
        console.error(`[ValidatedSemantic] Background processing error for job ${jobId}:`, err);
      });

      // Return job ID immediately
      res.json({
        jobId: jobId,
        message: 'Validated semantic chart generation started',
        estimatedTime: '60-120 seconds'
      });

    } catch (error) {
      console.error('[ValidatedSemantic] Route error:', error);
      res.status(500).json({
        error: 'Failed to start validated semantic chart generation',
        details: error.message
      });
    }
  }
);

/**
 * GET /validation-metrics
 * Returns current validation metrics and health score
 */
router.get('/validation-metrics', apiLimiter, async (req, res) => {
  try {
    const healthScore = validationMetricsCollector.getHealthScore();
    const snapshot = validationMetricsCollector.getSnapshotMetrics();

    res.json({
      health: healthScore,
      metrics: snapshot,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ValidatedSemantic] Metrics endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve validation metrics',
      details: error.message
    });
  }
});

/**
 * GET /validation-metrics/export
 * Exports full metrics history for analysis
 */
router.get('/validation-metrics/export', apiLimiter, async (req, res) => {
  try {
    const exportData = validationMetricsCollector.exportMetrics();

    res.json(exportData);

  } catch (error) {
    console.error('[ValidatedSemantic] Metrics export error:', error);
    res.status(500).json({
      error: 'Failed to export validation metrics',
      details: error.message
    });
  }
});

/**
 * POST /validation-metrics/reset
 * Resets all validation metrics (admin/testing only)
 */
router.post('/validation-metrics/reset', strictLimiter, async (req, res) => {
  try {
    validationMetricsCollector.resetMetrics();

    res.json({
      success: true,
      message: 'Validation metrics reset successfully'
    });

  } catch (error) {
    console.error('[ValidatedSemantic] Metrics reset error:', error);
    res.status(500).json({
      error: 'Failed to reset validation metrics',
      details: error.message
    });
  }
});

export default router;
