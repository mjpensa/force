/**
 * Chart Routes Module
 * Handles chart generation endpoints
 *
 * Note: No persistence - charts are generated and returned directly
 */

import express from 'express';
import crypto from 'crypto';
import mammoth from 'mammoth';
import { CONFIG } from '../config.js';
import { sanitizePrompt } from '../utils.js';
import { callGeminiForJson } from '../gemini.js';
import { CHART_GENERATION_SYSTEM_PROMPT, GANTT_CHART_SCHEMA } from '../prompts.js';
import { strictLimiter, uploadMiddleware } from '../middleware.js';

const router = express.Router();

/**
 * Detects interval type from timeColumns
 * @param {string[]} timeColumns - Array of time column labels
 * @returns {'years'|'quarters'|'months'|'weeks'|'unknown'}
 */
function detectIntervalType(timeColumns) {
  if (!timeColumns || timeColumns.length === 0) return 'unknown';
  const sample = timeColumns[0];
  if (/^Q[1-4]\s+\d{4}$/.test(sample)) return 'quarters';
  if (/^\d{4}$/.test(sample)) return 'years';
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/.test(sample)) return 'months';
  if (/^W\d+\s+\d{4}$/.test(sample)) return 'weeks';
  return 'unknown';
}

/**
 * Extracts year range from timeColumns
 * @param {string[]} timeColumns - Array of time column labels
 * @param {'years'|'quarters'|'months'|'weeks'} intervalType
 * @returns {{startYear: number, endYear: number, yearSpan: number}}
 */
function extractYearRange(timeColumns, intervalType) {
  const years = timeColumns.map(col => {
    const match = col.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : null;
  }).filter(y => y !== null);

  if (years.length === 0) return { startYear: 0, endYear: 0, yearSpan: 0 };

  const startYear = Math.min(...years);
  const endYear = Math.max(...years);
  return { startYear, endYear, yearSpan: endYear - startYear + 1 };
}

/**
 * Converts quarterly timeColumns to yearly when span > 3 years
 * Also remaps all task bar columns to match new yearly intervals
 * @param {object} ganttData - The gantt chart data object
 * @returns {object} - Corrected gantt data
 */
function enforceYearlyIntervalsForLongRanges(ganttData) {
  const intervalType = detectIntervalType(ganttData.timeColumns);

  // Only process quarterly intervals
  if (intervalType !== 'quarters') return ganttData;

  const { startYear, endYear, yearSpan } = extractYearRange(ganttData.timeColumns, intervalType);

  // Only convert if span > 3 years (threshold for yearly intervals)
  if (yearSpan <= 3) return ganttData;

  // Build mapping from old quarter columns to new year columns
  // Old: ["Q1 2020", "Q2 2020", "Q3 2020", "Q4 2020", "Q1 2021", ...] (1-indexed)
  // New: ["2020", "2021", "2022", ...] (1-indexed)
  const quarterToYearMap = {};
  ganttData.timeColumns.forEach((col, index) => {
    const match = col.match(/Q[1-4]\s+(\d{4})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const newColIndex = year - startYear + 1; // 1-indexed
      quarterToYearMap[index + 1] = newColIndex; // old 1-indexed -> new 1-indexed
    }
  });

  // Generate new yearly timeColumns
  const newTimeColumns = [];
  for (let year = startYear; year <= endYear; year++) {
    newTimeColumns.push(year.toString());
  }

  // Remap all task bar columns
  const newData = ganttData.data.map(item => {
    if (item.isSwimlane || !item.bar) return item;

    const newItem = { ...item, bar: { ...item.bar } };

    if (item.bar.startCol !== null && quarterToYearMap[item.bar.startCol]) {
      newItem.bar.startCol = quarterToYearMap[item.bar.startCol];
    }
    if (item.bar.endCol !== null && quarterToYearMap[item.bar.endCol]) {
      newItem.bar.endCol = quarterToYearMap[item.bar.endCol];
    } else if (item.bar.endCol !== null && item.bar.startCol !== null) {
      // If endCol doesn't map directly, calculate based on startCol
      newItem.bar.endCol = newItem.bar.startCol + 1;
    }

    // Ensure minimum duration of 1 column
    if (newItem.bar.startCol !== null && newItem.bar.endCol !== null) {
      if (newItem.bar.endCol <= newItem.bar.startCol) {
        newItem.bar.endCol = newItem.bar.startCol + 1;
      }
    }

    return newItem;
  });

  return {
    ...ganttData,
    timeColumns: newTimeColumns,
    data: newData
  };
}

/**
 * POST /generate-chart
 * Generates a chart synchronously and returns it directly
 */
router.post('/generate-chart', uploadMiddleware.array('researchFiles'), strictLimiter, async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');

  try {

    const userPrompt = req.body.prompt;

    // Sanitize user prompt to prevent prompt injection attacks
    const sanitizedPrompt = sanitizePrompt(userPrompt);

    // Process files
    let researchText = "";
    let researchFiles = [];

    if (req.files && req.files.length > 0) {
      const sortedFiles = req.files.sort((a, b) => a.originalname.localeCompare(b.originalname));

      // Process files in parallel
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

      const processedFiles = await Promise.all(fileProcessingPromises);

      // Build research text using array join (more efficient than string concatenation in loops)
      researchFiles = processedFiles.map(f => f.name);
      const researchParts = processedFiles.map(processedFile =>
        `\n\n--- Start of file: ${processedFile.name} ---\n${processedFile.content}\n--- End of file: ${processedFile.name} ---\n`
      );
      researchText = researchParts.join('');

    }

    // Build user query
    const geminiUserQuery = `${sanitizedPrompt}

**CRITICAL REMINDER:** You MUST escape all newlines (\\n) and double-quotes (") found in the research content before placing them into the final JSON string values.

Research Content:
${researchText}`;

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
        topK: CONFIG.API.TOP_K,
        seed: CONFIG.API.SEED,
        thinkingConfig: {
          thinkingBudget: CONFIG.API.THINKING_BUDGET_ANALYSIS
        }
      }
    };

    // Call the API
    const ganttData = await callGeminiForJson(
      payload,
      CONFIG.API.RETRY_COUNT,
      (attemptNum, error) => {
      }
    );

    // Validate data structure
    if (!ganttData || typeof ganttData !== 'object') {
      throw new Error('AI returned invalid data structure (not an object)');
    }

    if (!ganttData.timeColumns || !Array.isArray(ganttData.timeColumns)) {
      throw new Error('AI returned invalid timeColumns (not an array)');
    }

    if (!ganttData.data || !Array.isArray(ganttData.data)) {
      throw new Error('AI returned invalid data array (not an array)');
    }

    if (ganttData.timeColumns.length === 0) {
      throw new Error('AI returned empty timeColumns array');
    }

    if (ganttData.data.length === 0) {
      throw new Error('AI returned empty data array');
    }

    // Enforce yearly intervals for time ranges > 3 years
    // This corrects AI mistakes where quarters are used for long time horizons
    const correctedData = enforceYearlyIntervalsForLongRanges(ganttData);

    // Return chart data directly
    res.json({
      status: 'complete',
      data: correctedData
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * POST /update-task-dates
 * Acknowledges task date updates (client-side only)
 */
router.post('/update-task-dates', express.json(), (req, res) => {
  try {
    const {
      taskName,
      newStartCol,
      newEndCol,
      startDate,
      endDate
    } = req.body;

    // Validate required fields
    if (!taskName || newStartCol === undefined || newEndCol === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: taskName, newStartCol, newEndCol'
      });
    }


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
    res.status(500).json({
      error: 'Failed to update task dates',
      details: error.message
    });
  }
});

/**
 * POST /update-task-color
 * Acknowledges task color updates (client-side only)
 */
router.post('/update-task-color', express.json(), (req, res) => {
  try {
    const {
      taskName,
      taskIndex,
      newColor
    } = req.body;

    // Validate required fields
    if (!taskName || taskIndex === undefined || !newColor) {
      return res.status(400).json({
        error: 'Missing required fields: taskName, taskIndex, newColor'
      });
    }


    res.json({
      success: true,
      message: 'Task color updated',
      taskName,
      newColor
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update task color',
      details: error.message
    });
  }
});

export default router;
