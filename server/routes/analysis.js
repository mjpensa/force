/**
 * Analysis Routes Module
 * Phase 4 Enhancement: Extracted from server.js
 * Handles task analysis and Q&A endpoints
 */

import express from 'express';
import { CONFIG } from '../config.js';
import { getSession } from '../storage.js';
import { callGeminiForJson, callGeminiForText } from '../gemini.js';
import { TASK_ANALYSIS_SYSTEM_PROMPT, TASK_ANALYSIS_SCHEMA, getQASystemPrompt } from '../prompts.js';
import { apiLimiter } from '../middleware.js';
import { trackEvent } from '../database.js'; // FEATURE #9: Analytics tracking

const router = express.Router();

/**
 * POST /get-task-analysis
 * Generates detailed analysis for a specific task
 */
router.post('/get-task-analysis', apiLimiter, async (req, res) => {
  const { taskName, entity, sessionId } = req.body;

  if (!taskName || !entity) {
    return res.status(400).json({ error: CONFIG.ERRORS.MISSING_TASK_NAME });
  }

  if (!sessionId) {
    return res.status(400).json({ error: CONFIG.ERRORS.MISSING_SESSION_ID });
  }

  // Retrieve session data
  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: CONFIG.ERRORS.SESSION_NOT_FOUND });
  }

  const researchTextCache = session.researchText;

  // Build user query
  const geminiUserQuery = `**CRITICAL REMINDER:** You MUST escape all newlines (\\n) and double-quotes (\") found in the research content before placing them into the final JSON string values.

Research Content:
${researchTextCache}

**YOUR TASK:** Provide a full, detailed analysis for this specific task:
  - Entity: "${entity}"
  - Task Name: "${taskName}"`;

  // Define the payload
  const payload = {
    contents: [{ parts: [{ text: geminiUserQuery }] }],
    systemInstruction: { parts: [{ text: TASK_ANALYSIS_SYSTEM_PROMPT }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: TASK_ANALYSIS_SCHEMA,
      maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_ANALYSIS,
      temperature: CONFIG.API.TEMPERATURE_STRUCTURED,
      topP: CONFIG.API.TOP_P,
      topK: CONFIG.API.TOP_K
      // NOTE: thinkingConfig temporarily disabled for debugging
      // Re-enable after confirming it works with JSON schema
      // thinkingConfig: {
      //   thinkingBudget: CONFIG.API.THINKING_BUDGET_ANALYSIS
      // }
    }
  };

  // Call the API
  try {
    const analysisData = await callGeminiForJson(payload);

    // FEATURE #9: Track task analysis
    trackEvent('task_analysis', {
      taskName,
      entity,
      hasFinancialImpact: !!analysisData.financialImpact,
      riskCount: analysisData.risks?.length || 0
    }, null, sessionId);

    res.json(analysisData);
  } catch (e) {
    console.error("Task Analysis API error:", e);
    res.status(500).json({ error: `Error generating task analysis: ${e.message}` });
  }
});

/**
 * POST /ask-question
 * Answers a user's question about a specific task
 */
router.post('/ask-question', apiLimiter, async (req, res) => {
  const { taskName, entity, question, sessionId } = req.body;

  // Enhanced input validation
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: CONFIG.ERRORS.QUESTION_REQUIRED });
  }

  if (!entity || typeof entity !== 'string' || !entity.trim()) {
    return res.status(400).json({ error: CONFIG.ERRORS.ENTITY_REQUIRED });
  }

  if (!taskName || typeof taskName !== 'string' || !taskName.trim()) {
    return res.status(400).json({ error: CONFIG.ERRORS.TASK_NAME_REQUIRED });
  }

  if (!sessionId) {
    return res.status(400).json({ error: CONFIG.ERRORS.MISSING_SESSION_ID });
  }

  // Limit question length to prevent abuse
  if (question.trim().length > CONFIG.VALIDATION.MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: CONFIG.ERRORS.QUESTION_TOO_LONG });
  }

  // Retrieve session data
  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: CONFIG.ERRORS.SESSION_NOT_FOUND });
  }

  const researchTextCache = session.researchText;

  // Build user query
  const geminiUserQuery = `Research Content:\n${researchTextCache}\n\n**User Question:** ${question}`;

  // Define the payload (no schema, simple text generation)
  const payload = {
    contents: [{ parts: [{ text: geminiUserQuery }] }],
    systemInstruction: { parts: [{ text: getQASystemPrompt(taskName, entity) }] },
    generationConfig: {
      maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_QA,
      temperature: CONFIG.API.TEMPERATURE_QA,
      topP: CONFIG.API.TOP_P,
      topK: CONFIG.API.TOP_K
    }
  };

  // Call the API
  try {
    const textResponse = await callGeminiForText(payload);

    // FEATURE #9: Track Q&A interaction
    trackEvent('qa_question', {
      taskName,
      entity,
      questionLength: question.trim().length,
      answerLength: textResponse.length
    }, null, sessionId);

    res.json({ answer: textResponse });
  } catch (e) {
    console.error("Q&A API error:", e);
    res.status(500).json({ error: `Error generating answer: ${e.message}` });
  }
});

export default router;
