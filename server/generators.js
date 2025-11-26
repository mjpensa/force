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
import { generateResearchAnalysisPrompt, researchAnalysisSchema, validateResearchAnalysisStructure } from './prompts/research-analysis.js';

// Initialize Gemini API (using API_KEY from environment to match server/config.js)
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Timeout configuration for AI generation
const GENERATION_TIMEOUT_MS = 180000; // 3 minutes - generous but not infinite

/**
 * Generation config presets for different content types
 *
 * DOCUMENT_CREATIVE_CONFIG: Optimized for executive summaries
 * - Balanced creativity for captivating narratives
 * - Grounded through high thinking budget for fact-checking
 * - No seed to allow natural variation between generations
 */
const DOCUMENT_CREATIVE_CONFIG = {
  temperature: 0.4,      // Low-moderate: creative phrasing without hallucination risk
  topP: 0.6,             // Moderate: explores synonyms/phrasings while staying coherent
  topK: 15,              // Relaxed: allows richer vocabulary than greedy decoding
  thinkingBudget: 24576  // Maximum allowed for Gemini 2.5 Flash
};

/**
 * Default config for structured outputs
 * - Deterministic for consistent, reproducible results
 * - Used as fallback when no specific config is provided
 */
const STRUCTURED_DEFAULT_CONFIG = {
  thinkingBudget: 24576  // Standard deep reasoning
};

/**
 * Roadmap (Gantt chart) generation config - maximum determinism
 * - Prompt explicitly requires DETERMINISTIC output
 * - Complex rule-based logic for swimlanes, dates, colors
 * - Lowest temperature to ensure consistent rule following
 */
const ROADMAP_CONFIG = {
  temperature: 0.1,      // Lowest: maximum determinism for rule-based output
  topP: 0.3,             // Very constrained: follow explicit rules exactly
  topK: 5,               // Minimal exploration: pick most likely tokens
  thinkingBudget: 24576  // Maximum: complex date mapping and swimlane logic
};

/**
 * Research Analysis generation config - balanced for analytical tasks
 * - Requires judgment for quality scoring and gap identification
 * - Needs some creativity for recommendations
 * - Still schema-constrained output
 */
const RESEARCH_ANALYSIS_CONFIG = {
  temperature: 0.2,      // Low: reliable analysis without hallucination
  topP: 0.5,             // Moderate: allows varied recommendations
  topK: 10,              // Some exploration for insightful suggestions
  thinkingBudget: 24576  // Maximum: deep analysis of research quality
};

/**
 * Slides generation config - optimized for schema compliance + visual variety
 * - Lower temperature for reliable JSON structure
 * - Moderate exploration for slide type variety
 * - Reduced thinking budget (prompt optimized from 35 to 15 types)
 */
const SLIDES_CONFIG = {
  temperature: 0.2,      // Low: prioritize schema adherence over creativity
  topP: 0.5,             // Moderate: allows variety in slide type selection
  topK: 10,              // Constrained: reliable type choices from 15 options
  thinkingBudget: 16384  // Reduced: simpler prompt with fewer slide types
};

/**
 * Enterprise tier configuration
 * - Multiple candidates with LLM ranking for highest quality output
 */
const ENTERPRISE_CONFIG = {
  candidateCount: 3,     // Generate 3 candidates for comparison
  rankingThinkingBudget: 24576  // Maximum thinking budget for thorough candidate evaluation
};

/**
 * Ranking evaluation schema for comparing document candidates
 */
const RANKING_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "object",
      properties: {
        A: {
          type: "object",
          properties: {
            grounded: { type: "number", description: "Score 1-10: Every claim traceable to source material" },
            narrative: { type: "number", description: "Score 1-10: Clear story arc, not a list of facts" },
            executive: { type: "number", description: "Score 1-10: Would a busy CEO find this worth their time" },
            actionable: { type: "number", description: "Score 1-10: Reader knows what to do after reading" },
            memorable: { type: "number", description: "Score 1-10: Key concepts will stick with reader" },
            total: { type: "number", description: "Sum of all scores" }
          },
          required: ["grounded", "narrative", "executive", "actionable", "memorable", "total"]
        },
        B: {
          type: "object",
          properties: {
            grounded: { type: "number" },
            narrative: { type: "number" },
            executive: { type: "number" },
            actionable: { type: "number" },
            memorable: { type: "number" },
            total: { type: "number" }
          },
          required: ["grounded", "narrative", "executive", "actionable", "memorable", "total"]
        },
        C: {
          type: "object",
          properties: {
            grounded: { type: "number" },
            narrative: { type: "number" },
            executive: { type: "number" },
            actionable: { type: "number" },
            memorable: { type: "number" },
            total: { type: "number" }
          },
          required: ["grounded", "narrative", "executive", "actionable", "memorable", "total"]
        }
      },
      required: ["A", "B", "C"]
    },
    winner: { type: "string", enum: ["A", "B", "C"], description: "The best candidate" },
    reasoning: { type: "string", description: "1-2 sentence explanation of why the winner was chosen" }
  },
  required: ["scores", "winner", "reasoning"]
};

/**
 * Build the ranking prompt for evaluating document candidates
 * @param {Array} candidates - Array of document candidate objects
 * @returns {string} The ranking prompt
 */
function buildRankingPrompt(candidates) {
  const candidateLabels = ['A', 'B', 'C'];

  const candidateSections = candidates.map((candidate, index) => {
    // Serialize the document structure for evaluation
    const sections = candidate.sections.map(s => `### ${s.title}\n${s.content}`).join('\n\n');
    return `## Candidate ${candidateLabels[index]}:\n\n**Title:** ${candidate.title}\n\n${sections}`;
  }).join('\n\n---\n\n');

  return `You are an expert editor evaluating executive summaries for a Fortune 500 audience.

## Evaluation Criteria (in order of importance):

1. **Grounded in Research (Weight: Critical)**
   - Every claim must be traceable to source material
   - No fabricated statistics or unsupported assertions
   - Quotes and data points must feel authentic to the source

2. **Compelling Narrative (Weight: High)**
   - Clear story arc with beginning, middle, end
   - Not a bullet-point list disguised as prose
   - Logical flow that builds understanding

3. **Executive Value (Weight: High)**
   - Would a busy CEO find this worth their 5 minutes?
   - Focuses on strategic implications, not operational details
   - Highlights decisions and trade-offs clearly

4. **Actionable Insights (Weight: Medium)**
   - Reader knows what to do or decide after reading
   - Clear next steps or recommendations emerge
   - Connects analysis to concrete actions

5. **Memorable (Weight: Medium)**
   - 2-3 key concepts will stick with the reader
   - Uses vivid language or frameworks
   - Creates mental anchors for retention

---

## Candidates to Evaluate:

${candidateSections}

---

## Your Task:

1. Score each candidate 1-10 on each criterion (be discriminating - use the full range)
2. Calculate total score for each (sum of 5 criteria, max 50)
3. Select the BEST candidate overall
4. Explain your choice in 1-2 sentences focusing on the key differentiator

Be rigorous. A score of 7+ should be reserved for genuinely excellent work on that criterion.`;
}

/**
 * Ranking evaluation schema for comparing slides candidates
 */
const SLIDES_RANKING_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "object",
      properties: {
        A: {
          type: "object",
          properties: {
            schema: { type: "number", description: "Score 1-10: Valid JSON, correct slide types, proper data structures" },
            variety: { type: "number", description: "Score 1-10: Good mix of slide types, not repetitive" },
            balance: { type: "number", description: "Score 1-10: Visual balance, appropriate data density per slide" },
            flow: { type: "number", description: "Score 1-10: Logical narrative progression from start to end" },
            fidelity: { type: "number", description: "Score 1-10: Content grounded in source research" },
            total: { type: "number", description: "Sum of all scores" }
          },
          required: ["schema", "variety", "balance", "flow", "fidelity", "total"]
        },
        B: {
          type: "object",
          properties: {
            schema: { type: "number" },
            variety: { type: "number" },
            balance: { type: "number" },
            flow: { type: "number" },
            fidelity: { type: "number" },
            total: { type: "number" }
          },
          required: ["schema", "variety", "balance", "flow", "fidelity", "total"]
        },
        C: {
          type: "object",
          properties: {
            schema: { type: "number" },
            variety: { type: "number" },
            balance: { type: "number" },
            flow: { type: "number" },
            fidelity: { type: "number" },
            total: { type: "number" }
          },
          required: ["schema", "variety", "balance", "flow", "fidelity", "total"]
        }
      },
      required: ["A", "B", "C"]
    },
    winner: { type: "string", enum: ["A", "B", "C"], description: "The best candidate" },
    reasoning: { type: "string", description: "1-2 sentence explanation of why the winner was chosen" }
  },
  required: ["scores", "winner", "reasoning"]
};

/**
 * Build the ranking prompt for evaluating slides candidates
 * @param {Array} candidates - Array of slides candidate objects
 * @returns {string} The ranking prompt
 */
function buildSlidesRankingPrompt(candidates) {
  const candidateLabels = ['A', 'B', 'C'];

  const candidateSections = candidates.map((candidate, index) => {
    // Summarize each slide deck for evaluation
    const slidesSummary = candidate.slides.map((slide, i) => {
      const dataKeys = Object.keys(slide).filter(k => !['type', 'title', 'section'].includes(k));
      return `  ${i + 1}. [${slide.type}] "${slide.title}" ${slide.section ? `(${slide.section})` : ''} - data: ${dataKeys.join(', ')}`;
    }).join('\n');

    return `## Candidate ${candidateLabels[index]}:

**Title:** ${candidate.title}
**Subtitle:** ${candidate.subtitle || 'N/A'}
**Total Slides:** ${candidate.slides.length}

**Slide Structure:**
${slidesSummary}`;
  }).join('\n\n---\n\n');

  return `You are an expert presentation designer evaluating slide decks for a Fortune 500 audience.

## Evaluation Criteria (in order of importance):

1. **Schema Compliance (Weight: Critical)**
   - Valid JSON structure with no errors
   - Correct slide types used appropriately
   - Required fields present for each slide type
   - Data structures match expected formats (arrays, objects, strings)

2. **Type Variety (Weight: High)**
   - Good mix of different slide types (not all bullets)
   - Appropriate type selection for content
   - No more than 3 consecutive slides of same type
   - Uses visual slides (cards, grids, timelines) where appropriate

3. **Visual Balance (Weight: High)**
   - Appropriate amount of content per slide
   - Not too text-heavy (bullets limited to 3-6 per slide)
   - Data density appropriate (not overloaded)
   - Good use of whitespace principles

4. **Narrative Flow (Weight: Medium)**
   - Logical progression from opening to closing
   - Clear story arc: intro → body → conclusion
   - Smooth transitions between topics
   - Strong opening and closing slides

5. **Source Fidelity (Weight: Medium)**
   - Content appears grounded in research
   - Statistics and claims feel authentic
   - No apparent fabricated data
   - Appropriate depth without over-extension

---

## Candidates to Evaluate:

${candidateSections}

---

## Your Task:

1. Score each candidate 1-10 on each criterion (be discriminating - use the full range)
2. Calculate total score for each (sum of 5 criteria, max 50)
3. Select the BEST candidate overall
4. Explain your choice in 1-2 sentences focusing on the key differentiator

Be rigorous. A score of 7+ should be reserved for genuinely excellent work on that criterion.
Pay special attention to schema compliance - a deck with invalid structure should score low.`;
}

/**
 * Rank slides candidates using LLM meta-evaluation
 * Evaluates candidates on: schema, variety, balance, flow, fidelity
 *
 * @param {Array} candidates - Array of slides candidate objects
 * @returns {Promise<object>} Ranking result with winner and scores
 */
async function rankSlidesCandidates(candidates) {
  if (candidates.length === 0) {
    throw new Error('No valid candidates to rank');
  }

  if (candidates.length === 1) {
    console.log('[Enterprise-Slides] Only 1 candidate available, skipping ranking');
    return {
      winner: 'A',
      winnerIndex: 0,
      reasoning: 'Only one valid candidate was generated',
      scores: { A: { total: 'N/A' } }
    };
  }

  console.log(`[Enterprise-Slides] Ranking ${candidates.length} candidates...`);
  const startTime = Date.now();

  // Build ranking prompt
  const rankingPrompt = buildSlidesRankingPrompt(candidates);

  // Use deterministic settings for consistent evaluation
  const rankingConfig = {
    temperature: 0,
    thinkingBudget: ENTERPRISE_CONFIG.rankingThinkingBudget
  };

  const ranking = await generateWithGemini(
    rankingPrompt,
    SLIDES_RANKING_SCHEMA,
    'SlidesRanking',
    rankingConfig
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const winnerIndex = ranking.winner.charCodeAt(0) - 65; // 'A'->0, 'B'->1, 'C'->2

  console.log(`[Enterprise-Slides] Ranking complete in ${elapsed}s`);
  console.log(`[Enterprise-Slides] Winner: Candidate ${ranking.winner} (score: ${ranking.scores[ranking.winner].total}/50)`);
  console.log(`[Enterprise-Slides] Reasoning: ${ranking.reasoning}`);

  // Log all scores for transparency
  Object.entries(ranking.scores).forEach(([label, scores]) => {
    console.log(`[Enterprise-Slides] Candidate ${label}: schema=${scores.schema}, variety=${scores.variety}, balance=${scores.balance}, flow=${scores.flow}, fidelity=${scores.fidelity}, total=${scores.total}`);
  });

  return {
    ...ranking,
    winnerIndex
  };
}

/**
 * Generate slides content with enterprise tier LLM ranking
 * Generates multiple candidates and uses meta-evaluation to select the best
 *
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 * @returns {Promise<object>} Generation result with ranking metadata
 */
async function generateSlidesEnterprise(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Slides-Enterprise] Starting enterprise generation for session ${sessionId}`);
    console.log(`[Slides-Enterprise] Config: ${ENTERPRISE_CONFIG.candidateCount} candidates, temp=${SLIDES_CONFIG.temperature}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateSlidesPrompt(userPrompt, researchFiles);

    // Step 1: Generate multiple candidates in parallel
    const candidates = await generateMultipleCandidates(
      prompt,
      slidesSchema,
      ENTERPRISE_CONFIG.candidateCount,
      SLIDES_CONFIG
    );

    // Filter to only valid slides structures
    const validCandidates = candidates.filter(c => validateSlidesStructure(c));

    if (validCandidates.length === 0) {
      throw new Error('All slides candidates failed validation. Please try again with different source material.');
    }

    console.log(`[Slides-Enterprise] ${validCandidates.length}/${candidates.length} candidates passed validation`);

    // Step 2: Rank candidates using LLM meta-evaluation
    const ranking = await rankSlidesCandidates(validCandidates);

    // Step 3: Select winning candidate
    const winningSlides = validCandidates[ranking.winnerIndex];

    // Add ranking metadata to the slides
    winningSlides._enterprise = {
      candidatesGenerated: ENTERPRISE_CONFIG.candidateCount,
      candidatesValid: validCandidates.length,
      selectedCandidate: ranking.winner,
      score: ranking.scores[ranking.winner].total,
      reasoning: ranking.reasoning,
      allScores: ranking.scores
    };

    // Store in database
    ContentDB.create(sessionId, 'slides', winningSlides);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[Slides-Enterprise] Successfully generated and stored (winner: ${ranking.winner}, score: ${ranking.scores[ranking.winner].total}/50, ${winningSlides.slides.length} slides)`);
    return { success: true, data: winningSlides, ranking };

  } catch (error) {
    console.error('[Slides-Enterprise] Generation failed:', error);
    try {
      JobDB.updateStatus(jobId, 'error', error.message);
      ContentDB.create(sessionId, 'slides', null, error.message);
    } catch (dbError) {
      console.error('[Slides-Enterprise] Failed to update error status in database:', dbError);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Execute a promise with timeout
 * @param {Promise} promise - Promise to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error message
 * @returns {Promise} Result or timeout error
 */
function withTimeout(promise, timeoutMs, operationName) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Generate content using Gemini API with structured output
 * @param {string} prompt - The complete prompt
 * @param {object} schema - JSON schema for response
 * @param {string} contentType - Type of content being generated
 * @param {object} configOverrides - Optional config overrides (temperature, topP, topK, thinkingBudget)
 * @returns {Promise<object>} Generated content
 */
async function generateWithGemini(prompt, schema, contentType, configOverrides = {}) {
  try {
    // Merge default config with any overrides
    const {
      temperature,
      topP,
      topK,
      thinkingBudget = STRUCTURED_DEFAULT_CONFIG.thinkingBudget
    } = configOverrides;

    // Build generation config - only include optional params if specified
    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema,
      thinkingConfig: {
        thinkingBudget
      }
    };

    // Add optional creativity parameters if provided
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (topP !== undefined) generationConfig.topP = topP;
    if (topK !== undefined) generationConfig.topK = topK;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-09-2025',
      generationConfig
    });

    console.log(`[${contentType}] Starting generation (timeout: ${GENERATION_TIMEOUT_MS / 1000}s)...`);

    // Wrap the API call with timeout to prevent indefinite hangs
    const result = await withTimeout(
      model.generateContent(prompt),
      GENERATION_TIMEOUT_MS,
      `${contentType} generation`
    );

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
 * Generate multiple document candidates in parallel
 * Used for enterprise tier to enable LLM ranking
 *
 * @param {string} prompt - The document generation prompt
 * @param {object} schema - JSON schema for response
 * @param {number} count - Number of candidates to generate
 * @param {object} config - Generation config
 * @returns {Promise<Array>} Array of generated document candidates
 */
async function generateMultipleCandidates(prompt, schema, count, config) {
  console.log(`[Enterprise] Generating ${count} candidates in parallel...`);
  const startTime = Date.now();

  // Generate all candidates in parallel
  const promises = Array.from({ length: count }, (_, i) =>
    generateWithGemini(prompt, schema, `Document-Candidate-${i + 1}`, config)
      .then(data => ({ success: true, data, index: i }))
      .catch(error => ({ success: false, error: error.message, index: i }))
  );

  const results = await Promise.all(promises);

  // Filter successful candidates
  const successfulCandidates = results
    .filter(r => r.success && validateDocumentStructure(r.data))
    .map(r => r.data);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Enterprise] Generated ${successfulCandidates.length}/${count} valid candidates in ${elapsed}s`);

  // Log any failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    failures.forEach(f => {
      console.warn(`[Enterprise] Candidate ${f.index + 1} failed: ${f.error}`);
    });
  }

  return successfulCandidates;
}

/**
 * Rank document candidates using LLM meta-evaluation
 * Evaluates candidates on: grounded, narrative, executive, actionable, memorable
 *
 * @param {Array} candidates - Array of document candidate objects
 * @returns {Promise<object>} Ranking result with winner and scores
 */
async function rankDocumentCandidates(candidates) {
  if (candidates.length === 0) {
    throw new Error('No valid candidates to rank');
  }

  if (candidates.length === 1) {
    console.log('[Enterprise] Only 1 candidate available, skipping ranking');
    return {
      winner: 'A',
      winnerIndex: 0,
      reasoning: 'Only one valid candidate was generated',
      scores: { A: { total: 'N/A' } }
    };
  }

  console.log(`[Enterprise] Ranking ${candidates.length} candidates...`);
  const startTime = Date.now();

  // Build ranking prompt
  const rankingPrompt = buildRankingPrompt(candidates);

  // Use deterministic settings for consistent evaluation
  const rankingConfig = {
    temperature: 0,
    thinkingBudget: ENTERPRISE_CONFIG.rankingThinkingBudget
  };

  const ranking = await generateWithGemini(
    rankingPrompt,
    RANKING_SCHEMA,
    'DocumentRanking',
    rankingConfig
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const winnerIndex = ranking.winner.charCodeAt(0) - 65; // 'A'->0, 'B'->1, 'C'->2

  console.log(`[Enterprise] Ranking complete in ${elapsed}s`);
  console.log(`[Enterprise] Winner: Candidate ${ranking.winner} (score: ${ranking.scores[ranking.winner].total}/50)`);
  console.log(`[Enterprise] Reasoning: ${ranking.reasoning}`);

  // Log all scores for transparency
  Object.entries(ranking.scores).forEach(([label, scores]) => {
    console.log(`[Enterprise] Candidate ${label}: grounded=${scores.grounded}, narrative=${scores.narrative}, executive=${scores.executive}, actionable=${scores.actionable}, memorable=${scores.memorable}, total=${scores.total}`);
  });

  return {
    ...ranking,
    winnerIndex
  };
}

/**
 * Generate document content with enterprise tier LLM ranking
 * Generates multiple candidates and uses meta-evaluation to select the best
 *
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 * @returns {Promise<object>} Generation result with ranking metadata
 */
async function generateDocumentEnterprise(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Document-Enterprise] Starting enterprise generation for session ${sessionId}`);
    console.log(`[Document-Enterprise] Config: ${ENTERPRISE_CONFIG.candidateCount} candidates, creative temp=${DOCUMENT_CREATIVE_CONFIG.temperature}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateDocumentPrompt(userPrompt, researchFiles);

    // Step 1: Generate multiple candidates in parallel
    const candidates = await generateMultipleCandidates(
      prompt,
      documentSchema,
      ENTERPRISE_CONFIG.candidateCount,
      DOCUMENT_CREATIVE_CONFIG
    );

    if (candidates.length === 0) {
      throw new Error('All document candidates failed to generate. Please try again with different source material.');
    }

    // Step 2: Rank candidates using LLM meta-evaluation
    const ranking = await rankDocumentCandidates(candidates);

    // Step 3: Select winning candidate
    const winningDocument = candidates[ranking.winnerIndex];

    // Add ranking metadata to the document
    winningDocument._enterprise = {
      candidatesGenerated: ENTERPRISE_CONFIG.candidateCount,
      candidatesValid: candidates.length,
      selectedCandidate: ranking.winner,
      score: ranking.scores[ranking.winner].total,
      reasoning: ranking.reasoning,
      allScores: ranking.scores
    };

    // Store in database
    ContentDB.create(sessionId, 'document', winningDocument);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[Document-Enterprise] Successfully generated and stored (winner: ${ranking.winner}, score: ${ranking.scores[ranking.winner].total}/50)`);
    return { success: true, data: winningDocument, ranking };

  } catch (error) {
    console.error('[Document-Enterprise] Generation failed:', error);
    try {
      JobDB.updateStatus(jobId, 'error', error.message);
      ContentDB.create(sessionId, 'document', null, error.message);
    } catch (dbError) {
      console.error('[Document-Enterprise] Failed to update error status in database:', dbError);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Generate roadmap content (Gantt chart)
 * Uses ROADMAP_CONFIG for maximum determinism - prompt requires DETERMINISTIC output
 *
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateRoadmap(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Roadmap] Starting generation for session ${sessionId}`);
    console.log(`[Roadmap] Using config: temp=${ROADMAP_CONFIG.temperature}, topP=${ROADMAP_CONFIG.topP}, topK=${ROADMAP_CONFIG.topK}, thinkingBudget=${ROADMAP_CONFIG.thinkingBudget}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateRoadmapPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG);

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
 * Uses SLIDES_CONFIG for optimal schema compliance + visual variety
 *
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateSlides(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Slides] Starting generation for session ${sessionId}`);
    console.log(`[Slides] Using config: temp=${SLIDES_CONFIG.temperature}, topP=${SLIDES_CONFIG.topP}, topK=${SLIDES_CONFIG.topK}, thinkingBudget=${SLIDES_CONFIG.thinkingBudget}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateSlidesPrompt(userPrompt, researchFiles);
    let data = await generateWithGemini(prompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    // Validate slides structure
    if (!validateSlidesStructure(data)) {
      console.warn('[Slides] Generated data has invalid structure, retrying once...');

      // Retry generation once with same config
      data = await generateWithGemini(prompt, slidesSchema, 'Slides', SLIDES_CONFIG);

      if (!validateSlidesStructure(data)) {
        throw new Error('Slides generation produced empty or invalid content after retry. The AI may need more detailed source material.');
      }
    }

    // Store in database
    ContentDB.create(sessionId, 'slides', data);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[Slides] Successfully generated and stored with ${data.slides.length} slides`);
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
 * Validate document structure
 * @param {object} data - Generated document data
 * @returns {boolean} True if valid
 */
function validateDocumentStructure(data) {
  if (!data) return false;
  if (!data.sections || !Array.isArray(data.sections)) return false;
  if (data.sections.length === 0) return false;
  if (!data.title) return false;
  return true;
}

/**
 * Validate slides structure
 * @param {object} data - Generated slides data
 * @returns {boolean} True if valid
 */
function validateSlidesStructure(data) {
  if (!data) {
    console.warn('[Slides Validation] No data provided');
    return false;
  }
  if (!data.slides || !Array.isArray(data.slides)) {
    console.warn('[Slides Validation] slides is not an array');
    return false;
  }
  if (data.slides.length === 0) {
    console.warn('[Slides Validation] slides array is empty');
    return false;
  }

  // CRITICAL: Reject unreasonably large numbers of slides (indicates AI error)
  const MAX_SLIDES = 25; // Allow some buffer above the 15-slide guideline
  const MIN_SLIDES = 3;

  if (data.slides.length > MAX_SLIDES) {
    console.error(`[Slides Validation] REJECTED: Too many slides (${data.slides.length}). Maximum allowed: ${MAX_SLIDES}`);
    return false;
  }

  if (data.slides.length < MIN_SLIDES) {
    console.warn(`[Slides Validation] Too few slides (${data.slides.length}). Minimum expected: ${MIN_SLIDES}`);
    return false;
  }

  // Validate each slide has required properties
  let validSlides = 0;
  for (let i = 0; i < data.slides.length; i++) {
    const slide = data.slides[i];

    if (!slide || typeof slide !== 'object') {
      console.warn(`[Slides Validation] Slide ${i} is not an object`);
      continue;
    }

    if (!slide.type || typeof slide.type !== 'string') {
      console.warn(`[Slides Validation] Slide ${i} missing type property`);
      continue;
    }

    if (!slide.title || typeof slide.title !== 'string') {
      console.warn(`[Slides Validation] Slide ${i} missing title property`);
      continue;
    }

    validSlides++;
  }

  // At least 80% of slides should be valid
  const validRatio = validSlides / data.slides.length;
  if (validRatio < 0.8) {
    console.error(`[Slides Validation] REJECTED: Too many invalid slides (${validSlides}/${data.slides.length} valid)`);
    return false;
  }

  console.log(`[Slides Validation] Passed: ${data.slides.length} slides, ${validSlides} valid`);
  return true;
}

/**
 * Generate document content (executive summary)
 * Uses DOCUMENT_CREATIVE_CONFIG for captivating, insightful narratives
 * while staying grounded through high thinking budget
 *
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateDocument(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[Document] Starting generation for session ${sessionId}`);
    console.log(`[Document] Using creative config: temp=${DOCUMENT_CREATIVE_CONFIG.temperature}, topP=${DOCUMENT_CREATIVE_CONFIG.topP}, topK=${DOCUMENT_CREATIVE_CONFIG.topK}, thinkingBudget=${DOCUMENT_CREATIVE_CONFIG.thinkingBudget}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateDocumentPrompt(userPrompt, researchFiles);
    let data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CREATIVE_CONFIG);

    // Validate document structure
    if (!validateDocumentStructure(data)) {
      console.warn('[Document] Generated data has invalid structure, retrying once...');

      // Retry generation once with same creative config
      data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CREATIVE_CONFIG);

      if (!validateDocumentStructure(data)) {
        throw new Error('Document generation produced empty or invalid content after retry. The AI may need more detailed source material.');
      }
    }

    // Store in database
    ContentDB.create(sessionId, 'document', data);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[Document] Successfully generated and stored with ${data.sections.length} sections`);
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
 * Generate research analysis content
 * Uses RESEARCH_ANALYSIS_CONFIG for balanced analytical output
 * - Requires judgment for quality scoring and gap identification
 * - Needs some creativity for insightful recommendations
 *
 * @param {string} sessionId - Session ID
 * @param {string} jobId - Job ID for tracking
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 */
async function generateResearchAnalysis(sessionId, jobId, userPrompt, researchFiles) {
  try {
    console.log(`[ResearchAnalysis] Starting generation for session ${sessionId}`);
    console.log(`[ResearchAnalysis] Using config: temp=${RESEARCH_ANALYSIS_CONFIG.temperature}, topP=${RESEARCH_ANALYSIS_CONFIG.topP}, topK=${RESEARCH_ANALYSIS_CONFIG.topK}, thinkingBudget=${RESEARCH_ANALYSIS_CONFIG.thinkingBudget}`);
    JobDB.updateStatus(jobId, 'processing');

    const prompt = generateResearchAnalysisPrompt(userPrompt, researchFiles);
    let data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);

    // Validate research analysis structure
    if (!validateResearchAnalysisStructure(data)) {
      console.warn('[ResearchAnalysis] Generated data has invalid structure, retrying once...');

      // Retry generation once with same config
      data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);

      if (!validateResearchAnalysisStructure(data)) {
        throw new Error('Research analysis generation produced empty or invalid content after retry. The AI may need more detailed source material.');
      }
    }

    // Store in database
    ContentDB.create(sessionId, 'research-analysis', data);
    JobDB.updateStatus(jobId, 'completed');

    console.log(`[ResearchAnalysis] Successfully generated and stored with ${data.themes.length} themes analyzed`);
    return { success: true, data };

  } catch (error) {
    console.error('[ResearchAnalysis] Generation failed:', error);
    // Wrap database operations in try-catch to prevent cascade failures
    try {
      JobDB.updateStatus(jobId, 'error', error.message);
      ContentDB.create(sessionId, 'research-analysis', null, error.message);
    } catch (dbError) {
      console.error('[ResearchAnalysis] Failed to update error status in database:', dbError);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Generate all four content types in parallel
 * @param {string} sessionId - Session ID
 * @param {string} userPrompt - User's request
 * @param {Array} researchFiles - Research files
 * @param {object} jobIds - Job IDs for tracking { roadmap, slides, document, researchAnalysis }
 * @param {object} options - Optional settings { enterpriseMode: boolean }
 * @returns {Promise<object>} Results of all generations
 */
export async function generateAllContent(sessionId, userPrompt, researchFiles, jobIds, options = {}) {
  const { enterpriseMode = false } = options;

  try {
    console.log(`[Session ${sessionId}] Starting parallel generation of all content types`);
    if (enterpriseMode) {
      console.log(`[Session ${sessionId}] Enterprise mode ENABLED for document and slides generation`);
    }

    // Update session status - wrapped in try-catch to prevent early failures
    try {
      SessionDB.updateStatus(sessionId, 'processing');
    } catch (dbError) {
      console.error(`[Session ${sessionId}] Failed to update initial status:`, dbError);
      // Continue anyway - the session was already created
    }

    // Select generators based on enterprise mode
    const documentGenerator = enterpriseMode
      ? generateDocumentEnterprise(sessionId, jobIds.document, userPrompt, researchFiles)
      : generateDocument(sessionId, jobIds.document, userPrompt, researchFiles);

    const slidesGenerator = enterpriseMode
      ? generateSlidesEnterprise(sessionId, jobIds.slides, userPrompt, researchFiles)
      : generateSlides(sessionId, jobIds.slides, userPrompt, researchFiles);

    // Generate all four in parallel
    const results = await Promise.allSettled([
      generateRoadmap(sessionId, jobIds.roadmap, userPrompt, researchFiles),
      slidesGenerator,
      documentGenerator,
      generateResearchAnalysis(sessionId, jobIds.researchAnalysis, userPrompt, researchFiles)
    ]);

    // Check results
    const [roadmapResult, slidesResult, documentResult, researchAnalysisResult] = results;

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
      document: documentResult.status === 'fulfilled' ? documentResult.value : { success: false, error: documentResult.reason },
      researchAnalysis: researchAnalysisResult.status === 'fulfilled' ? researchAnalysisResult.value : { success: false, error: researchAnalysisResult.reason }
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
 * @param {string} viewType - 'roadmap', 'slides', 'document', or 'research-analysis'
 * @param {object} options - Optional settings { enterpriseMode: boolean }
 * @returns {Promise<object>} Generation result
 */
export async function regenerateContent(sessionId, viewType, options = {}) {
  const { enterpriseMode = false } = options;

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
        // Use enterprise mode if enabled
        if (enterpriseMode) {
          console.log(`[Regenerate] Using enterprise mode for slides regeneration`);
          result = await generateSlidesEnterprise(sessionId, jobId, prompt, researchFiles);
        } else {
          result = await generateSlides(sessionId, jobId, prompt, researchFiles);
        }
        break;
      case 'document':
        // Use enterprise mode if enabled
        if (enterpriseMode) {
          console.log(`[Regenerate] Using enterprise mode for document regeneration`);
          result = await generateDocumentEnterprise(sessionId, jobId, prompt, researchFiles);
        } else {
          result = await generateDocument(sessionId, jobId, prompt, researchFiles);
        }
        break;
      case 'research-analysis':
        result = await generateResearchAnalysis(sessionId, jobId, prompt, researchFiles);
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
