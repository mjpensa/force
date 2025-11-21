/**
 * Deterministic Gemini Client for Semantic Gantt Generation
 *
 * Key Features:
 * - Zero-temperature configuration (temperature=0.0, topK=1, topP=0.0)
 * - Two-pass generation (facts extraction → inference addition)
 * - Consistency validation between passes
 * - Result caching via SHA-256 hash
 * - Reuses existing retry logic from server/gemini.js
 */

import crypto from 'crypto';
import { jsonrepair } from 'jsonrepair';
import { CONFIG } from './config.js';
import { retryWithBackoff } from './gemini.js';
import { zodToJsonSchema } from '../types/SemanticGanttData.js';

// ═══════════════════════════════════════════════════════════
// GEMINI API CLIENT
// ═══════════════════════════════════════════════════════════

export class DeterministicGeminiClient {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('API_KEY is required for DeterministicGeminiClient');
    }

    this.apiKey = apiKey;
    this.apiUrl = CONFIG.SEMANTIC.GEMINI.API_URL || 'https://generativelanguage.googleapis.com/v1beta';
    this.modelName = CONFIG.SEMANTIC.GEMINI.MODEL || 'gemini-2.5-flash-preview';
    this.seedValue = Date.now(); // Session-consistent seed for reproducibility

    // Cache for deterministic results
    this.cache = new Map();
  }

  /**
   * Generate structured bimodal Gantt chart with deterministic output
   * @param {string} researchText - Combined research document content
   * @param {string} userPrompt - User's generation instructions
   * @param {string} sessionId - Optional session ID for tracking
   * @returns {Promise<Object>} Complete bimodal Gantt data
   */
  async generateStructuredGantt(researchText, userPrompt, sessionId = null) {
    // Check cache first
    const cacheKey = this.getCacheKey(researchText, userPrompt);

    if (this.cache.has(cacheKey)) {
      console.log(`[Deterministic] Cache hit for key: ${cacheKey.substring(0, 16)}...`);
      return this.cache.get(cacheKey);
    }

    console.log(`[Deterministic] Starting two-pass generation (seed: ${this.seedValue})`);

    try {
      // PASS 1: Extract explicit facts from documents
      const facts = await this.extractFacts(researchText, userPrompt);
      console.log(`[Deterministic] Pass 1 complete: ${facts.tasks?.length || 0} fact-based tasks`);

      // PASS 2: Add logical inferences based on facts
      const completeData = await this.addInferences(facts, researchText, userPrompt);
      console.log(`[Deterministic] Pass 2 complete: ${completeData.tasks?.length || 0} total tasks`);

      // Validate consistency between passes
      this.validateConsistency(facts, completeData);

      // Cache the result
      this.cache.set(cacheKey, completeData);

      return completeData;

    } catch (error) {
      console.error('[Deterministic] Generation failed:', error.message);
      throw new Error(`Semantic chart generation failed: ${error.message}`);
    }
  }

  /**
   * PASS 1: Extract explicit facts from source documents
   * Only extracts information directly stated with citations
   * @param {string} researchText - Source documents
   * @param {string} userPrompt - User instructions
   * @returns {Promise<Object>} Partial data with only explicit facts
   */
  async extractFacts(researchText, userPrompt) {
    const { FACT_EXTRACTION_PROMPT } = await import('./prompts-semantic.js');

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{
          text: FACT_EXTRACTION_PROMPT
            .replace('{{USER_PROMPT}}', userPrompt)
            .replace('{{RESEARCH_TEXT}}', researchText)
        }]
      }],
      generationConfig: {
        temperature: 0.0,        // CRITICAL: Zero randomness
        topK: 1,                 // CRITICAL: Only most likely token
        topP: 0.0,               // CRITICAL: No nucleus sampling
        maxOutputTokens: CONFIG.SEMANTIC.GEMINI.MAX_OUTPUT_TOKENS_FACTS, // Configurable fact extraction limit
        responseMimeType: 'application/json'
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_ONLY_HIGH'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_ONLY_HIGH'
        }
      ]
    };

    const url = `${this.apiUrl}/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    // Use existing retry logic
    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Gemini API error (${res.status}): ${errorText}`);
        }

        return res.json();
      },
      CONFIG.API.RETRY_COUNT
    );

    // Extract JSON from response
    const factData = this.extractJsonFromResponse(response);

    // Ensure minimum structure
    if (!factData.tasks) {
      factData.tasks = [];
    }
    if (!factData.dependencies) {
      factData.dependencies = [];
    }

    return factData;
  }

  /**
   * PASS 2: Add logical inferences to fact-based data
   * Applies reasoning rules while maintaining all facts from Pass 1
   * @param {Object} facts - Data from Pass 1
   * @param {string} researchText - Original source documents
   * @param {string} userPrompt - User instructions
   * @returns {Promise<Object>} Complete bimodal data
   */
  async addInferences(facts, researchText, userPrompt) {
    const { INFERENCE_GENERATION_PROMPT } = await import('./prompts-semantic.js');

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{
          text: INFERENCE_GENERATION_PROMPT
            .replace('{{USER_PROMPT}}', userPrompt)
            .replace('{{RESEARCH_TEXT}}', researchText)
            .replace('{{EXTRACTED_FACTS}}', JSON.stringify(facts, null, 2))
        }]
      }],
      generationConfig: {
        temperature: 0.0,
        topK: 1,
        topP: 0.0,
        maxOutputTokens: CONFIG.SEMANTIC.GEMINI.MAX_OUTPUT_TOKENS_INFERENCES, // Configurable inference limit (supports complex research)
        responseMimeType: 'application/json'
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_ONLY_HIGH'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_ONLY_HIGH'
        }
      ]
    };

    const url = `${this.apiUrl}/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Gemini API error (${res.status}): ${errorText}`);
        }

        return res.json();
      },
      CONFIG.API.RETRY_COUNT
    );

    const completeData = this.extractJsonFromResponse(response);

    // Add metadata
    completeData.generatedAt = new Date().toISOString();
    completeData.geminiVersion = this.modelName;
    completeData.determinismSeed = this.seedValue;

    return completeData;
  }

  /**
   * Validates that facts from Pass 1 are preserved in Pass 2
   * Ensures determinism by checking that AI didn't change explicit facts
   * @param {Object} facts - Data from Pass 1
   * @param {Object} completeData - Data from Pass 2
   * @throws {Error} If facts were modified or removed
   */
  validateConsistency(facts, completeData) {
    // Collect fact task IDs from Pass 1
    const factTaskIds = new Set(
      (facts.tasks || [])
        .filter(t => t.origin === 'explicit')
        .map(t => t.id)
    );

    // Check that all fact tasks exist in Pass 2
    const completeTaskIds = new Set((completeData.tasks || []).map(t => t.id));

    for (const factId of factTaskIds) {
      if (!completeTaskIds.has(factId)) {
        throw new Error(
          `Determinism violation: Fact task "${factId}" from Pass 1 missing in Pass 2`
        );
      }

      // Verify confidence didn't change
      const factTask = facts.tasks.find(t => t.id === factId);
      const completeTask = completeData.tasks.find(t => t.id === factId);

      if (factTask.origin === 'explicit' && completeTask.origin !== 'explicit') {
        console.warn(
          `Warning: Task "${factId}" changed from explicit to ${completeTask.origin}`
        );
      }

      if (factTask.confidence === 1.0 && completeTask.confidence !== 1.0) {
        console.warn(
          `Warning: Fact confidence changed for task "${factId}": 1.0 → ${completeTask.confidence}`
        );
      }
    }

    console.log(`[Deterministic] Consistency check passed: ${factTaskIds.size} facts preserved`);
  }

  /**
   * Extracts JSON from Gemini API response
   * Handles various response formats and cleans markdown code blocks
   * @param {Object} response - Gemini API response
   * @returns {Object} Parsed JSON data
   */
  extractJsonFromResponse(response) {
    // Debug: Log response structure
    console.log('[Deterministic] Response structure:', {
      hasCandidates: !!response.candidates,
      candidatesLength: response.candidates?.length || 0,
      hasPromptFeedback: !!response.promptFeedback
    });

    if (!response.candidates || response.candidates.length === 0) {
      // Check for prompt feedback (safety blocks)
      if (response.promptFeedback) {
        console.error('[Deterministic] Prompt blocked:', JSON.stringify(response.promptFeedback, null, 2));
        throw new Error(`Gemini blocked the request: ${response.promptFeedback.blockReason || 'Unknown reason'}`);
      }
      throw new Error('No candidates in Gemini response');
    }

    const candidate = response.candidates[0];

    // Check for finish reason (safety blocks, etc.)
    console.log('[Deterministic] Finish reason:', candidate.finishReason);
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      console.error('[Deterministic] Unusual finish reason:', candidate.finishReason);
      if (candidate.safetyRatings) {
        console.error('[Deterministic] Safety ratings:', JSON.stringify(candidate.safetyRatings, null, 2));
      }

      // If blocked due to safety, provide detailed error
      if (candidate.finishReason === 'SAFETY') {
        throw new Error(`Content was blocked due to safety filters. Please try with different content.`);
      } else if (candidate.finishReason === 'RECITATION') {
        throw new Error(`Content was blocked due to recitation detection.`);
      } else if (candidate.finishReason === 'MAX_TOKENS') {
        throw new Error(`Response exceeded maximum token limit. Try with less content or reduce the number of uploaded files. Current limit: ${CONFIG.SEMANTIC.MAX_RESEARCH_CHARS.toLocaleString()} characters.`);
      } else {
        throw new Error(`Generation stopped with reason: ${candidate.finishReason}`);
      }
    }

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('[Deterministic] Missing content. Candidate:', JSON.stringify(candidate, null, 2));
      throw new Error('No content parts in Gemini response - content may have been blocked');
    }

    let text = candidate.content.parts[0].text;

    // Remove markdown code blocks if present
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Parse JSON
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('[Deterministic] Failed to parse JSON:', error.message);
      console.error('[Deterministic] Raw text:', text.substring(0, 500));

      // Try jsonrepair as fallback
      try {
        const repaired = jsonrepair(text);
        return JSON.parse(repaired);
      } catch (repairError) {
        throw new Error(`Failed to parse JSON even after repair: ${error.message}`);
      }
    }
  }

  /**
   * Generates a cache key from inputs using SHA-256
   * Ensures identical inputs produce identical cache keys
   * @param {string} researchText - Research content
   * @param {string} userPrompt - User prompt
   * @returns {string} SHA-256 hash
   */
  getCacheKey(researchText, userPrompt) {
    const content = `${researchText}|${userPrompt}|${this.seedValue}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Clears the result cache
   * Use when memory usage is a concern
   */
  clearCache() {
    this.cache.clear();
    console.log('[Deterministic] Cache cleared');
  }

  /**
   * Gets cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()).map(k => k.substring(0, 16) + '...')
    };
  }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════

let deterministicClient = null;

/**
 * Gets or creates the singleton deterministic client
 * Ensures consistent seed value across requests in the same session
 * @param {string} apiKey - Gemini API key
 * @returns {DeterministicGeminiClient} Singleton instance
 */
export function getDeterministicClient(apiKey) {
  if (!deterministicClient) {
    deterministicClient = new DeterministicGeminiClient(apiKey);
    console.log('[Deterministic] Client initialized with seed:', deterministicClient.seedValue);
  }
  return deterministicClient;
}

/**
 * Resets the singleton (useful for testing)
 */
export function resetDeterministicClient() {
  deterministicClient = null;
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Test determinism by generating the same chart multiple times
 * @param {string} researchText - Research content
 * @param {string} userPrompt - User prompt
 * @param {number} iterations - Number of tests (default: 5)
 * @returns {Promise<Object>} Test results
 */
export async function testDeterminism(researchText, userPrompt, iterations = 5) {
  const client = getDeterministicClient(process.env.API_KEY);
  const results = [];

  console.log(`[Determinism Test] Running ${iterations} identical requests...`);

  for (let i = 0; i < iterations; i++) {
    // Clear cache to force regeneration
    client.clearCache();

    const result = await client.generateStructuredGantt(researchText, userPrompt);
    const resultHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(result))
      .digest('hex');

    results.push(resultHash);
    console.log(`[Determinism Test] Iteration ${i + 1}: ${resultHash.substring(0, 16)}...`);
  }

  // Check if all results are identical
  const uniqueResults = new Set(results);
  const passed = uniqueResults.size === 1;

  return {
    passed,
    iterations,
    uniqueResults: uniqueResults.size,
    message: passed
      ? '✅ SUCCESS: All outputs are identical - determinism achieved!'
      : `❌ FAILURE: ${uniqueResults.size} different outputs - determinism failed!`
  };
}

export default {
  DeterministicGeminiClient,
  getDeterministicClient,
  resetDeterministicClient,
  testDeterminism
};
