import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateSlidesPrompt, slidesSchema } from './prompts/slides.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema } from './prompts/research-analysis.js';
import { PerformanceLogger, createTimer, globalMetrics } from './utils/performanceLogger.js';
import { getCachedContent, setCachedContent, getCacheMetrics } from './cache/contentCache.js';
import { connectionPrewarmer, speculativeGenerator } from './utils/advancedOptimizer.js';
import { CONFIG, isRoutingEnabled } from './config.js';
import { prepareResearchContext, willUseMapReduce } from './utils/mapReduceProcessor.js';
import {
  getRouter,
  TaskType
} from './layers/routing/index.js';
import {
  getMetricsCollector
} from './layers/optimization/metrics/index.js';
import {
  selectVariant,
  recordVariantPerformance
} from './layers/optimization/variants/index.js';
import {
  recordExperimentMetric
} from './layers/optimization/experiments/index.js';

// Feature flag for caching - can be disabled for testing
const ENABLE_CACHE = true;

// Master flag for PROMPT ML optimization system (enables all optimization features)
const ENABLE_PROMPT_ML = process.env.ENABLE_OPTIMIZATION === 'true';

// Feature flag for auto-optimization metrics collection
// Inherits from ENABLE_PROMPT_ML unless explicitly set
const ENABLE_AUTO_OPTIMIZATION = process.env.ENABLE_AUTO_OPTIMIZATION === 'true' || ENABLE_PROMPT_ML;

// Feature flag for variant selection (A/B testing)
// Inherits from ENABLE_PROMPT_ML unless explicitly set
const ENABLE_VARIANT_SELECTION = process.env.ENABLE_VARIANT_SELECTION === 'true' || ENABLE_PROMPT_ML;

// NOTE: Variant initialization is handled by server.js on startup
// to ensure proper configuration (persistPath, autoPersist).
// Do NOT initialize here to avoid race conditions with config.


// Feature flag for Map-Reduce processing of large research content
// When enabled, large research files are chunked and processed in parallel
// to ensure ALL content is analyzed regardless of size
const ENABLE_MAP_REDUCE = process.env.ENABLE_MAP_REDUCE !== 'false'; // Enabled by default


/**
 * Detects interval type from timeColumns
 * @param {string[]} timeColumns - Array of time column labels
 * @returns {'years'|'quarters'|'months'|'weeks'|'unknown'}
 */
function detectIntervalType(timeColumns) {
  if (!timeColumns || timeColumns.length === 0) return 'unknown';
  const sample = timeColumns[0].trim();
  // Case-insensitive matching with flexible separators
  if (/^Q[1-4][\s\-\/]*\d{4}$/i.test(sample)) return 'quarters';
  if (/^\d{4}$/.test(sample)) return 'years';
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-\/]*\d{4}$/i.test(sample)) return 'months';
  if (/^W\d+[\s\-\/]*\d{4}$/i.test(sample)) return 'weeks';
  return 'unknown';
}

/**
 * Extracts year range from timeColumns
 * @param {string[]} timeColumns - Array of time column labels
 * @returns {{startYear: number, endYear: number, yearSpan: number}}
 */
function extractYearRange(timeColumns) {
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
 * Converts quarterly or monthly timeColumns to yearly when span > 3 years
 * Also remaps all task bar columns to match new yearly intervals
 * @param {object} ganttData - The gantt chart data object
 * @returns {object} - Corrected gantt data
 */
function enforceYearlyIntervalsForLongRanges(ganttData) {
  if (!ganttData || !ganttData.timeColumns) return ganttData;

  const intervalType = detectIntervalType(ganttData.timeColumns);
  const { startYear, endYear, yearSpan } = extractYearRange(ganttData.timeColumns);

  // Only convert if span > 3 years (threshold for yearly intervals)
  if (yearSpan <= 3) return ganttData;

  // Already yearly intervals - no conversion needed
  if (intervalType === 'years') return ganttData;

  // Check if we have more columns than years (indicating non-yearly intervals)
  const columnCount = ganttData.timeColumns.length;
  if (columnCount <= yearSpan) return ganttData;

  // Build mapping from old columns to new year columns
  const columnToYearMap = {};
  ganttData.timeColumns.forEach((col, index) => {
    const match = col.match(/(\d{4})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const newColIndex = year - startYear + 1; // 1-indexed
      columnToYearMap[index + 1] = newColIndex;
    }
  });

  // Generate new yearly timeColumns
  const newTimeColumns = [];
  for (let year = startYear; year <= endYear; year++) {
    newTimeColumns.push(year.toString());
  }

  // Calculate the number of new columns for bounds clamping
  const newNumCols = newTimeColumns.length;

  // Remap all task bar columns
  const newData = ganttData.data.map(item => {
    if (item.isSwimlane || !item.bar) return item;

    const newItem = { ...item, bar: { ...item.bar } };

    // Remap startCol - if not in map, clamp the old value proportionally
    if (item.bar.startCol !== null) {
      if (columnToYearMap[item.bar.startCol]) {
        newItem.bar.startCol = columnToYearMap[item.bar.startCol];
      } else {
        // Column not in map - clamp to valid range (1 to newNumCols)
        newItem.bar.startCol = Math.max(1, Math.min(newNumCols, item.bar.startCol));
      }
    }

    // Remap endCol - if not in map, calculate based on remapped startCol
    if (item.bar.endCol !== null) {
      if (columnToYearMap[item.bar.endCol]) {
        newItem.bar.endCol = columnToYearMap[item.bar.endCol];
      } else if (newItem.bar.startCol !== null) {
        // Calculate endCol based on remapped startCol, ensuring at least 1 column duration
        newItem.bar.endCol = Math.min(newNumCols + 1, newItem.bar.startCol + 1);
      }
    }

    // Ensure minimum duration of 1 column and clamp to valid bounds
    if (newItem.bar.startCol !== null && newItem.bar.endCol !== null) {
      // Clamp startCol to valid range
      newItem.bar.startCol = Math.max(1, Math.min(newNumCols, newItem.bar.startCol));
      // Ensure endCol is greater than startCol and within bounds
      if (newItem.bar.endCol <= newItem.bar.startCol) {
        newItem.bar.endCol = newItem.bar.startCol + 1;
      }
      // Clamp endCol to maximum valid value (numCols + 1 for CSS Grid)
      newItem.bar.endCol = Math.min(newNumCols + 1, newItem.bar.endCol);
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
 * Ensures all task rows have valid bar objects with startCol, endCol, and color.
 * Tasks missing bars or with invalid bar properties get default values.
 * @param {object} ganttData - The gantt chart data object
 * @returns {object} - Gantt data with all tasks having valid bars
 */
function ensureTaskBars(ganttData) {
  if (!ganttData || !ganttData.data || !ganttData.timeColumns) return ganttData;

  const numCols = ganttData.timeColumns.length;
  if (numCols === 0) return ganttData;

  const defaultColors = ['priority-red', 'medium-red', 'mid-grey', 'light-grey', 'dark-blue', 'white'];
  let colorIndex = 0;
  let taskIndex = 0;

  // Count non-swimlane tasks to distribute them if needed
  const taskCount = ganttData.data.filter(item => !item.isSwimlane).length;

  const newData = ganttData.data.map(item => {
    // Skip swimlanes - they don't have bars
    if (item.isSwimlane) return item;

    taskIndex++;

    // Check if bar exists with valid types
    const hasBarWithNumbers = item.bar &&
      typeof item.bar.startCol === 'number' &&
      typeof item.bar.endCol === 'number';

    if (hasBarWithNumbers) {
      // Clamp bar values to valid bounds
      let startCol = Math.max(1, Math.min(numCols, item.bar.startCol));
      let endCol = item.bar.endCol;

      // Ensure endCol is greater than startCol
      if (endCol <= startCol) {
        endCol = startCol + 1;
      }

      // Clamp endCol to valid range (max is numCols + 1 for CSS Grid)
      endCol = Math.min(numCols + 1, endCol);

      // After clamping, ensure we still have a valid bar
      if (endCol <= startCol) {
        // Edge case: startCol was at numCols, so shift both back
        startCol = Math.max(1, numCols - 1);
        endCol = startCol + 1;
      }

      const color = item.bar.color || defaultColors[colorIndex++ % defaultColors.length];

      return {
        ...item,
        bar: { startCol, endCol, color }
      };
    }

    // Generate default bar - distribute tasks across available columns
    const startCol = Math.max(1, Math.min(numCols, Math.ceil((taskIndex / taskCount) * numCols)));
    const endCol = Math.min(numCols + 1, startCol + 1);
    const color = item.bar?.color || defaultColors[colorIndex++ % defaultColors.length];

    return {
      ...item,
      bar: { startCol, endCol, color }
    };
  });

  return {
    ...ganttData,
    data: newData
  };
}

/**
 * Record generation metrics for auto-optimization
 *
 * Captures metrics about prompt performance for A/B testing
 * and automatic prompt improvement.
 *
 * @param {Object} data - Generation data to record
 * @returns {string|null} Generation ID for feedback tracking
 */
function recordGenerationMetrics(data) {
  if (!ENABLE_AUTO_OPTIMIZATION) {
    return null;
  }

  try {
    const collector = getMetricsCollector();
    const generationId = collector.recordGeneration({
      contentType: data.contentType,
      variantId: data.variantId || 'default',
      prompt: data.prompt,
      userPrompt: data.userPrompt,
      fileCount: data.fileCount || 0,
      complexity: data.complexity || 0,
      model: data.model || 'gemini-1.5-pro',
      latencyMs: data.latencyMs || 0,
      inputTokens: data.inputTokens || 0,
      outputTokens: data.outputTokens || 0,
      retryCount: data.retryCount || 0,
      cacheHit: data.cacheHit || false,
      validation: data.validation,
      topics: data.topics || []
    });

    return generationId;
  } catch (error) {
    console.warn('[AutoOptimization] Failed to record metrics:', error.message);
    return null;
  }
}

/**
 * Select and apply a variant's prompt template
 *
 * Uses variant selection for A/B testing when enabled,
 * falls back to traditional prompt generation when disabled.
 *
 * @param {string} contentType - Content type (Roadmap, Slides, Document, ResearchAnalysis)
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Research files
 * @param {Function} fallbackGenerator - Fallback prompt generator function
 * @returns {Object} {prompt, variantId, variantName, usedVariant}
 */
function selectAndApplyVariant(contentType, userPrompt, researchFiles, fallbackGenerator) {
  // CRITICAL: Validate research files are present and properly formatted
  // We must NEVER generate content without the user's research - this would produce
  // generic/random content that misleads the user into thinking their documents were processed
  if (!researchFiles || !Array.isArray(researchFiles) || researchFiles.length === 0) {
    throw new Error(
      `RESEARCH CONTENT MISSING: Cannot generate ${contentType} without research files. ` +
      `No documents were provided or processed successfully. Please upload your research documents and try again.`
    );
  }

  // Validate each file has required structure
  for (const file of researchFiles) {
    if (!file || !file.filename || !file.content) {
      throw new Error(
        `INVALID RESEARCH FILE: One or more uploaded files could not be processed. ` +
        `File structure is missing filename or content. Please re-upload your documents.`
      );
    }
  }

  // Validate that we actually have content (not just filenames with empty content)
  const totalContentLength = researchFiles.reduce((sum, f) => sum + (f.content?.length || 0), 0);
  if (totalContentLength < 100) {
    throw new Error(
      `RESEARCH CONTENT EMPTY: The uploaded files contain insufficient text content ` +
      `(${totalContentLength} characters). Please ensure your documents contain readable text ` +
      `and are not corrupted, password-protected, or image-only PDFs.`
    );
  }

  // All prompt generators now expect researchFiles as an array
  // They handle the conversion to string internally (consistent interface)
  if (!ENABLE_VARIANT_SELECTION) {
    return {
      prompt: fallbackGenerator(userPrompt, researchFiles),
      variantId: 'default',
      variantName: 'Default',
      usedVariant: false
    };
  }

  try {
    const variant = selectVariant(contentType);

    if (!variant || !variant.promptTemplate) {
      // Use default prompt generator - this is fine, just means A/B testing isn't configured
      return {
        prompt: fallbackGenerator(userPrompt, researchFiles),
        variantId: 'default',
        variantName: 'Default (no variant)',
        usedVariant: false
      };
    }

    // For variant templates, convert to string format
    const researchContent = researchFiles
      .map(file => `=== ${file.filename} ===\n${file.content}`)
      .join('\n\n');

    // Apply the variant template with user prompt and research
    const prompt = `${variant.promptTemplate}

**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Respond with ONLY the JSON object.`;

    return {
      prompt,
      variantId: variant.id,
      variantName: variant.name,
      usedVariant: true
    };
  } catch (error) {
    // If variant selection fails, that's a system error - do NOT silently continue
    // The user must know their research may not have been properly included
    throw new Error(
      `CONTENT GENERATION FAILED: Unable to process ${contentType} generation. ` +
      `Error: ${error.message}. Your research documents may not have been included. ` +
      `Please try again or contact support if the issue persists.`
    );
  }
}

/**
 * Async version of selectAndApplyVariant that uses Map-Reduce for large content
 * 
 * When research content exceeds the threshold, this function:
 * 1. Chunks the content into manageable pieces
 * 2. Extracts structured insights from each chunk in parallel
 * 3. Consolidates insights into a coherent context
 * 4. Generates the prompt using consolidated insights
 * 
 * This ensures ALL research content is analyzed regardless of size.
 * 
 * @param {string} contentType - Content type (Roadmap, Slides, Document, ResearchAnalysis)
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Research files array
 * @param {Function} fallbackGenerator - Fallback prompt generator function
 * @param {object} options - Options including perfLogger and onProgress
 * @returns {Promise<Object>} {prompt, variantId, variantName, usedVariant, mapReduceMetadata}
 */
async function selectAndApplyVariantAsync(contentType, userPrompt, researchFiles, fallbackGenerator, options = {}) {
  const { perfLogger = null, onProgress = null } = options;
  
  // CRITICAL: Validate research files first (same validation as sync version)
  if (!researchFiles || !Array.isArray(researchFiles) || researchFiles.length === 0) {
    throw new Error(
      `RESEARCH CONTENT MISSING: Cannot generate ${contentType} without research files. ` +
      `No documents were provided or processed successfully. Please upload your research documents and try again.`
    );
  }

  for (const file of researchFiles) {
    if (!file || !file.filename || !file.content) {
      throw new Error(
        `INVALID RESEARCH FILE: One or more uploaded files could not be processed. ` +
        `File structure is missing filename or content. Please re-upload your documents.`
      );
    }
  }

  const totalContentLength = researchFiles.reduce((sum, f) => sum + (f.content?.length || 0), 0);
  if (totalContentLength < 100) {
    throw new Error(
      `RESEARCH CONTENT EMPTY: The uploaded files contain insufficient text content ` +
      `(${totalContentLength} characters). Please ensure your documents contain readable text.`
    );
  }

  // Check if Map-Reduce should be used
  const shouldUseMapReduce = ENABLE_MAP_REDUCE && willUseMapReduce(researchFiles);
  
  if (shouldUseMapReduce) {
    console.log(`[MapReduce] Large content detected for ${contentType}, using map-reduce processing`);
    
    if (perfLogger) {
      perfLogger.setMetadata(`mapreduce-${contentType.toLowerCase()}`, true);
    }
    
    try {
      // Map content type to the format expected by prepareResearchContext
      const contentTypeMap = {
        'Roadmap': 'roadmap',
        'Slides': 'slides', 
        'Document': 'document',
        'ResearchAnalysis': 'researchAnalysis'
      };
      
      // Process through map-reduce pipeline
      const { context: extractedContext, metadata: mapReduceMetadata } = await prepareResearchContext(
        researchFiles,
        contentTypeMap[contentType] || 'document',
        { onProgress }
      );
      
      if (perfLogger) {
        perfLogger.setMetadata(`mapreduce-chunks-${contentType.toLowerCase()}`, mapReduceMetadata.chunksProcessed);
        perfLogger.setMetadata(`mapreduce-strategy-${contentType.toLowerCase()}`, mapReduceMetadata.strategy);
      }
      
      // Create a "virtual" research file with the consolidated insights
      // This allows us to use the existing prompt generators
      const consolidatedFiles = [{
        filename: 'consolidated-research-insights.txt',
        content: extractedContext
      }];
      
      // Now use the standard variant selection with consolidated content
      if (!ENABLE_VARIANT_SELECTION) {
        return {
          prompt: fallbackGenerator(userPrompt, consolidatedFiles),
          variantId: 'default',
          variantName: 'Default (map-reduce)',
          usedVariant: false,
          mapReduceMetadata
        };
      }
      
      try {
        const variant = selectVariant(contentType);
        
        if (!variant || !variant.promptTemplate) {
          return {
            prompt: fallbackGenerator(userPrompt, consolidatedFiles),
            variantId: 'default',
            variantName: 'Default (map-reduce)',
            usedVariant: false,
            mapReduceMetadata
          };
        }
        
        // Apply variant template with consolidated context
        const prompt = `${variant.promptTemplate}

**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT (Consolidated from ${mapReduceMetadata.fileCount} files, ${mapReduceMetadata.chunksProcessed} chunks):**
${extractedContext}

Respond with ONLY the JSON object.`;
        
        return {
          prompt,
          variantId: variant.id,
          variantName: `${variant.name} (map-reduce)`,
          usedVariant: true,
          mapReduceMetadata
        };
      } catch (variantError) {
        // Fall back to standard prompt with consolidated content
        console.warn(`[MapReduce] Variant selection failed, using fallback: ${variantError.message}`);
        return {
          prompt: fallbackGenerator(userPrompt, consolidatedFiles),
          variantId: 'default',
          variantName: 'Default (map-reduce fallback)',
          usedVariant: false,
          mapReduceMetadata
        };
      }
      
    } catch (mapReduceError) {
      // If map-reduce fails, fall through to standard processing
      console.error(`[MapReduce] Processing failed, falling back to standard: ${mapReduceError.message}`);
      if (perfLogger) {
        perfLogger.setMetadata(`mapreduce-error-${contentType.toLowerCase()}`, mapReduceError.message);
      }
      // Fall through to standard processing below
    }
  }
  
  // Standard processing (no map-reduce needed or map-reduce failed)
  // Use the synchronous version
  return {
    ...selectAndApplyVariant(contentType, userPrompt, researchFiles, fallbackGenerator),
    mapReduceMetadata: null
  };
}

/**
 * Validate research files are present and contain actual content
 * CRITICAL: This function ensures we NEVER generate content without user's research.
 * Generating without research would produce misleading generic content.
 * 
 * @param {Array} researchFiles - Array of { filename, content } objects
 * @throws {Error} If research files are missing, invalid, or empty
 */
function validateResearchFiles(researchFiles) {
  // Check array exists and has items
  if (!researchFiles || !Array.isArray(researchFiles) || researchFiles.length === 0) {
    throw new Error(
      `RESEARCH CONTENT MISSING: Cannot generate content without research files. ` +
      `No documents were provided or processed successfully. ` +
      `Please upload your research documents and try again.`
    );
  }

  // Validate each file has required structure
  for (let i = 0; i < researchFiles.length; i++) {
    const file = researchFiles[i];
    if (!file || typeof file !== 'object') {
      throw new Error(
        `INVALID RESEARCH FILE: File at position ${i + 1} is not a valid file object. ` +
        `Please re-upload your documents.`
      );
    }
    if (!file.filename || typeof file.filename !== 'string') {
      throw new Error(
        `INVALID RESEARCH FILE: File at position ${i + 1} is missing a filename. ` +
        `The file may have been corrupted during upload. Please re-upload your documents.`
      );
    }
    if (!file.content || typeof file.content !== 'string') {
      throw new Error(
        `INVALID RESEARCH FILE: "${file.filename}" has no readable content. ` +
        `The file may be corrupted, password-protected, or in an unsupported format. ` +
        `Please ensure your document contains extractable text.`
      );
    }
  }

  // Validate total content length
  const totalContentLength = researchFiles.reduce((sum, f) => sum + (f.content?.length || 0), 0);
  if (totalContentLength < 100) {
    const fileList = researchFiles.map(f => `"${f.filename}" (${f.content?.length || 0} chars)`).join(', ');
    throw new Error(
      `RESEARCH CONTENT EMPTY: Your uploaded files contain insufficient text content ` +
      `(${totalContentLength} total characters). Files: ${fileList}. ` +
      `Please ensure your documents contain readable text and are not ` +
      `image-only PDFs, scanned documents without OCR, or password-protected files.`
    );
  }
}

/**
 * Combine research files into a single content string for cache key
 * @param {Array} researchFiles - Array of { filename, content } objects
 * @returns {string} Combined content
 */
function combineResearchContent(researchFiles) {
  return researchFiles
    .map(f => `${f.filename}:${f.content}`)
    .sort() // Sort for consistent hashing regardless of file order
    .join('\n---\n');
}




// Initialize Gemini API (using API_KEY from environment to match server/config.js)
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Timeout configuration for AI generation
const GENERATION_TIMEOUT_MS = 360000; // 6 minutes - increased for complex content and API variability

// ============================================================================
// CONNECTION PREWARMING - Register Gemini API warmup callback
// ============================================================================

/**
 * Warm up the Gemini API connection by making a minimal request
 * This keeps the connection pool active and reduces cold start latency
 */
async function warmupGeminiConnection() {
  try {
    const model = genAI.getGenerativeModel({
      model: 'models/gemini-flash-latest',
      generationConfig: {
        maxOutputTokens: 10,
        temperature: 0
      }
    });

    // Minimal prompt to verify connection
    await model.generateContent('Say "ok"');
  } catch (error) {
    // Log but don't throw - warmup failure shouldn't block operation
    console.warn('[Warmup] Gemini connection warmup failed:', error.message);
  }
}

// Register warmup callback (will be started when initializeOptimizers() is called)
connectionPrewarmer.register('gemini-api', warmupGeminiConnection);

// ============================================================================
// REQUEST QUEUE - Controls concurrent API calls to prevent overload
// ============================================================================

/**
 * API Request Queue with controlled concurrency and priority support
 *
 * Features:
 * - Concurrency limit prevents rate limiting from Gemini API
 * - Priority queue ensures faster content types complete first
 * - Metrics tracking for performance analysis
 *
 * Priority levels (lower = higher priority):
 * - 1: Document, Slides (fast, simple)
 * - 2: Roadmap (complex but important)
 * - 3: ResearchAnalysis (detailed, can wait)
 */
class APIQueue {
  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];  // Priority queue: { resolve, priority, name }
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      queuedTasks: 0,
      peakConcurrency: 0
    };
  }

  // Priority mapping for content types
  static getPriority(name) {
    const priorities = {
      'Document': 1,
      'Slides': 1,
      'Roadmap': 2,
      'ResearchAnalysis': 3
    };
    return priorities[name] || 2;
  }

  async add(task, name = 'unknown') {
    this.metrics.totalTasks++;

    if (this.running >= this.maxConcurrent) {
      this.metrics.queuedTasks++;
      const priority = APIQueue.getPriority(name);
      await new Promise(resolve => {
        // Insert in priority order
        const entry = { resolve, priority, name };
        const insertIndex = this.queue.findIndex(e => e.priority > priority);
        if (insertIndex === -1) {
          this.queue.push(entry);
        } else {
          this.queue.splice(insertIndex, 0, entry);
        }
      });
    }

    this.running++;
    this.metrics.peakConcurrency = Math.max(this.metrics.peakConcurrency, this.running);

    try {
      const result = await task();
      return result;
    } finally {
      this.running--;
      this.metrics.completedTasks++;
      const next = this.queue.shift();
      if (next) next.resolve();
    }
  }

  async runAll(tasks) {
    return Promise.all(tasks.map(({ task, name }) => this.add(task, name)));
  }

  getMetrics() {
    return {
      ...this.metrics,
      currentlyRunning: this.running,
      currentlyQueued: this.queue.length
    };
  }

  resetMetrics() {
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      queuedTasks: 0,
      peakConcurrency: 0
    };
  }
}

// Global API queue instance - 6 concurrent Gemini API calls
// Increased from 4 for better throughput; monitor for rate limit errors
const apiQueue = new APIQueue(6);

/**
 * Generation config presets optimized for speed and determinism
 *
 * Performance tuning rationale:
 * - temperature: Low (0.1) for deterministic, consistent JSON output
 * - topP/topK: Constrained to reduce token exploration overhead
 * - thinkingBudget: 0 for all types (reasoning disabled = faster response)
 * - maxOutputTokens: Set per content type to prevent runaway generation
 */

// Base config for all structured JSON output
const STRUCTURED_DEFAULT_CONFIG = {
  thinkingBudget: 0  // Disabled for maximum speed
};

// Document: Simplest output, fastest generation
const DOCUMENT_CONFIG = {
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0,
  maxOutputTokens: 4096  // Executive summaries are concise
};

// Roadmap: Complex Gantt chart with many tasks
const ROADMAP_CONFIG = {
  temperature: 0.1,      // Maximum determinism for rule-based output
  topP: 0.3,             // Constrained: follow explicit rules exactly
  topK: 5,               // Minimal exploration
  thinkingBudget: 0,
  maxOutputTokens: 16384 // Large charts need more tokens
};

// Slides: Structured presentation content
const SLIDES_CONFIG = {
  temperature: 0.2,      // Balanced for creativity and structure
  topP: 0.4,
  topK: 10,
  thinkingBudget: 0,
  maxOutputTokens: 8192
};

// Research Analysis: Detailed quality assessment
const RESEARCH_ANALYSIS_CONFIG = {
  temperature: 0.15,     // Slightly higher for nuanced analysis
  topP: 0.4,             // Moderate: allows varied recommendations
  topK: 8,               // Some exploration for insights
  thinkingBudget: 0,
  maxOutputTokens: 8192  // Detailed reports
};
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
 * Map content types to TaskType for routing
 */
const CONTENT_TYPE_TO_TASK = {
  'Roadmap': TaskType.ROADMAP,
  'Document': TaskType.DOCUMENT,
  'ResearchAnalysis': TaskType.RESEARCH_ANALYSIS
};

/**
 * Generate content using Gemini API with optional model routing
 *
 * @param {string} prompt - The prompt to send
 * @param {object} schema - JSON schema for structured output
 * @param {string} contentType - Type of content being generated
 * @param {object} configOverrides - Generation config overrides
 * @param {object} perfLogger - Performance logger instance
 * @param {object} routingOptions - Optional routing configuration
 * @returns {object} Generated content
 */
async function generateWithGemini(prompt, schema, contentType, configOverrides = {}, perfLogger = null, routingOptions = {}) {
  const timer = perfLogger ? createTimer(perfLogger, `api-${contentType.toLowerCase()}`) : null;

  // Determine model to use (routing or default)
  let modelId = 'models/gemini-flash-latest'; // Default fallback
  let routingDecision = null;

  if (isRoutingEnabled() && routingOptions.content) {
    try {
      const router = getRouter();
      const taskType = CONTENT_TYPE_TO_TASK[contentType] || TaskType.DOCUMENT;

      routingDecision = router.route(routingOptions.content, taskType, {
        fileCount: routingOptions.fileCount || 1,
        estimatedOutputTokens: configOverrides.maxOutputTokens || 4000
      });

      modelId = `models/${routingDecision.modelId}`;

      // Log routing decision
      if (perfLogger) {
        perfLogger.setMetadata(`routing-${contentType.toLowerCase()}`, {
          modelId: routingDecision.modelId,
          tier: routingDecision.tier,
          complexity: routingDecision.complexity.level,
          estimatedCost: routingDecision.estimatedCost,
          reasoning: routingDecision.reasoning
        });
      }
    } catch (routingError) {
      // Routing failed, fall back to default
      console.warn(`[Routing] Failed for ${contentType}, using default:`, routingError.message);
    }
  }

  try {
    const {
      temperature,
      topP,
      topK,
      maxOutputTokens,
      thinkingBudget = STRUCTURED_DEFAULT_CONFIG.thinkingBudget
    } = configOverrides;
    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema
    };
    if (thinkingBudget > 0) {
      generationConfig.thinkingConfig = { thinkingBudget };
    }
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (topP !== undefined) generationConfig.topP = topP;
    if (topK !== undefined) generationConfig.topK = topK;
    if (maxOutputTokens !== undefined) generationConfig.maxOutputTokens = maxOutputTokens;
    // Add seed for deterministic output - same inputs produce same outputs
    if (CONFIG.API.SEED !== undefined) generationConfig.seed = CONFIG.API.SEED;

    const model = genAI.getGenerativeModel({
      model: modelId,
      generationConfig
    });

    // Track prompt size
    if (perfLogger) {
      perfLogger.setMetadata(`prompt-size-${contentType.toLowerCase()}`, prompt.length);
    }

    console.log(`[Gemini] Starting ${contentType} generation with model ${modelId}...`);
    const result = await withTimeout(
      model.generateContent(prompt),
      GENERATION_TIMEOUT_MS,
      `${contentType} generation`
    );
    console.log(`[Gemini] ${contentType} generation complete`);
    const response = result.response;

    // Track token usage if available
    if (perfLogger && response.usageMetadata) {
      perfLogger.trackTokenUsage(contentType.toLowerCase(), response.usageMetadata);
    }

    const text = response.text();

    // Track response size
    if (perfLogger) {
      perfLogger.setMetadata(`response-size-${contentType.toLowerCase()}`, text.length);
    }

    // Parse timing
    const parseStart = Date.now();
    try {
      const data = JSON.parse(text);
      if (perfLogger) {
        perfLogger.setMetadata(`parse-time-${contentType.toLowerCase()}`, Date.now() - parseStart);
      }
      if (timer) timer.stop();
      return data;
    } catch (parseError) {
      const positionMatch = parseError.message.match(/position (\d+)/);
      const errorPosition = positionMatch ? parseInt(positionMatch[1]) : 0;
      if (errorPosition > 0) {
        const contextStart = Math.max(0, errorPosition - 200);
        const contextEnd = Math.min(text.length, errorPosition + 200);
      }
      try {
        const repairedJsonText = jsonrepair(text);
        const repairedData = JSON.parse(repairedJsonText);
        if (perfLogger) {
          perfLogger.setMetadata(`parse-time-${contentType.toLowerCase()}`, Date.now() - parseStart);
          perfLogger.setMetadata(`json-repair-${contentType.toLowerCase()}`, true);
        }
        if (timer) timer.stop();
        return repairedData;
      } catch (repairError) {
        if (timer) timer.stop();
        throw parseError; // Throw the original parse error
      }
    }
  } catch (error) {
    if (timer) timer.stop();
    if (perfLogger) {
      perfLogger.setMetadata(`error-${contentType.toLowerCase()}`, error.message);
    }
    throw new Error(`Failed to generate ${contentType}: ${error.message}`);
  }
}
async function generateRoadmap(userPrompt, researchFiles, perfLogger = null, options = {}) {
  const contentType = 'roadmap';
  const combinedContent = combineResearchContent(researchFiles);
  const startTime = Date.now();

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        // Apply interval enforcement and ensure bars exist in cached data
        const intervalCorrected = enforceYearlyIntervalsForLongRanges(cached);
        const correctedCached = ensureTaskBars(intervalCorrected);
        // Record cache hit metrics
        const generationId = recordGenerationMetrics({
          contentType: 'Roadmap',
          variantId: 'default',
          userPrompt,
          fileCount: researchFiles.length,
          cacheHit: true,
          latencyMs: Date.now() - startTime
        });
        return { success: true, data: correctedCached, _cached: true, _generationId: generationId };
      }
    }

    // Select variant and generate prompt (A/B testing) - uses async version for map-reduce support
    const variantResult = await selectAndApplyVariantAsync('Roadmap', userPrompt, researchFiles, generateRoadmapPrompt, {
      perfLogger,
      onProgress: options.onProgress
    });

    // Log variant selection
    if (perfLogger && variantResult.usedVariant) {
      perfLogger.setMetadata('variant-roadmap', {
        id: variantResult.variantId,
        name: variantResult.variantName
      });
    }

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(variantResult.prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG, perfLogger, routingOptions);

    // Ensure we have valid data before returning success
    if (data === null || data === undefined) {
      throw new Error('Roadmap generation completed but returned no data. The AI response may have been malformed.');
    }

    // Enforce yearly intervals for long time ranges (5+ years)
    const intervalCorrectedData = enforceYearlyIntervalsForLongRanges(data);

    // Ensure all tasks have valid bar objects with bounds checking
    const correctedData = ensureTaskBars(intervalCorrectedData);

    // Store in cache
    if (ENABLE_CACHE && correctedData) {
      setCachedContent(contentType, combinedContent, userPrompt, correctedData);
    }

    const latencyMs = Date.now() - startTime;

    // Record variant performance for A/B testing
    if (variantResult.usedVariant) {
      const perfMetrics = {
        latencyMs,
        qualityScore: 0,
        success: true
      };
      recordVariantPerformance(variantResult.variantId, perfMetrics);
      recordExperimentMetric(variantResult.variantId, perfMetrics);
    }

    // Record generation metrics for auto-optimization
    const generationId = recordGenerationMetrics({
      contentType: 'Roadmap',
      variantId: variantResult.variantId,
      prompt: variantResult.prompt,
      userPrompt,
      fileCount: researchFiles.length,
      latencyMs,
      cacheHit: false
    });

    return {
      success: true,
      data: correctedData,
      _variant: variantResult.usedVariant ? { id: variantResult.variantId, name: variantResult.variantName } : null,
      _generationId: generationId,
      _mapReduce: variantResult.mapReduceMetadata
    };
  } catch (error) {
    // Re-throw research validation errors - these MUST bubble up to the user
    if (error.message.includes('RESEARCH CONTENT') || error.message.includes('INVALID RESEARCH')) {
      throw error;
    }
    return { success: false, error: error.message };
  }
}

async function generateSlides(userPrompt, researchFiles, perfLogger = null, options = {}) {
  const contentType = 'slides';
  const combinedContent = combineResearchContent(researchFiles);
  const startTime = Date.now();

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        // Record cache hit metrics
        const generationId = recordGenerationMetrics({
          contentType: 'Slides',
          variantId: 'default',
          userPrompt,
          fileCount: researchFiles.length,
          cacheHit: true,
          latencyMs: Date.now() - startTime
        });
        return { success: true, data: cached, _cached: true, _generationId: generationId };
      }
    }

    // Select variant and generate prompt (A/B testing) - uses async version for map-reduce support
    const variantResult = await selectAndApplyVariantAsync('Slides', userPrompt, researchFiles, generateSlidesPrompt, {
      perfLogger,
      onProgress: options.onProgress
    });

    // Log variant selection
    if (perfLogger && variantResult.usedVariant) {
      perfLogger.setMetadata('variant-slides', {
        id: variantResult.variantId,
        name: variantResult.variantName
      });
    }

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(variantResult.prompt, slidesSchema, 'Slides', SLIDES_CONFIG, perfLogger, routingOptions);

    // Ensure we have valid data before returning success
    if (data === null || data === undefined) {
      throw new Error('Slides generation completed but returned no data. The AI response may have been malformed.');
    }

    // Store in cache
    if (ENABLE_CACHE && data) {
      setCachedContent(contentType, combinedContent, userPrompt, data);
    }

    const latencyMs = Date.now() - startTime;

    // Record variant performance for A/B testing
    if (variantResult.usedVariant) {
      const perfMetrics = {
        latencyMs,
        qualityScore: 0,
        success: true
      };
      recordVariantPerformance(variantResult.variantId, perfMetrics);
      recordExperimentMetric(variantResult.variantId, perfMetrics);
    }

    // Record generation metrics for auto-optimization
    const generationId = recordGenerationMetrics({
      contentType: 'Slides',
      variantId: variantResult.variantId,
      prompt: variantResult.prompt,
      userPrompt,
      fileCount: researchFiles.length,
      latencyMs,
      cacheHit: false
    });

    return {
      success: true,
      data,
      _variant: variantResult.usedVariant ? { id: variantResult.variantId, name: variantResult.variantName } : null,
      _generationId: generationId,
      _mapReduce: variantResult.mapReduceMetadata
    };
  } catch (error) {
    // Re-throw research validation errors - these MUST bubble up to the user
    if (error.message.includes('RESEARCH CONTENT') || error.message.includes('INVALID RESEARCH')) {
      throw error;
    }
    return { success: false, error: error.message };
  }
}

async function generateDocument(userPrompt, researchFiles, perfLogger = null, options = {}) {
  const contentType = 'document';
  const combinedContent = combineResearchContent(researchFiles);
  const startTime = Date.now();

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        // Record cache hit metrics
        const generationId = recordGenerationMetrics({
          contentType: 'Document',
          variantId: 'default',
          userPrompt,
          fileCount: researchFiles.length,
          cacheHit: true,
          latencyMs: Date.now() - startTime
        });
        return { success: true, data: cached, _cached: true, _generationId: generationId };
      }
    }

    // Select variant and generate prompt (A/B testing) - uses async version for map-reduce support
    const variantResult = await selectAndApplyVariantAsync('Document', userPrompt, researchFiles, generateDocumentPrompt, {
      perfLogger,
      onProgress: options.onProgress
    });

    // Log variant selection
    if (perfLogger && variantResult.usedVariant) {
      perfLogger.setMetadata('variant-document', {
        id: variantResult.variantId,
        name: variantResult.variantName
      });
    }

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(variantResult.prompt, documentSchema, 'Document', DOCUMENT_CONFIG, perfLogger, routingOptions);

    // Ensure we have valid data before returning success
    if (data === null || data === undefined) {
      throw new Error('Document generation completed but returned no data. The AI response may have been malformed.');
    }

    // Store in cache
    if (ENABLE_CACHE && data) {
      setCachedContent(contentType, combinedContent, userPrompt, data);
    }

    const latencyMs = Date.now() - startTime;

    // Record variant performance for A/B testing
    if (variantResult.usedVariant) {
      const perfMetrics = {
        latencyMs,
        qualityScore: 0,
        success: true
      };
      recordVariantPerformance(variantResult.variantId, perfMetrics);
      recordExperimentMetric(variantResult.variantId, perfMetrics);
    }

    // Record generation metrics for auto-optimization
    const generationId = recordGenerationMetrics({
      contentType: 'Document',
      variantId: variantResult.variantId,
      prompt: variantResult.prompt,
      userPrompt,
      fileCount: researchFiles.length,
      latencyMs,
      cacheHit: false
    });

    return {
      success: true,
      data,
      _variant: variantResult.usedVariant ? { id: variantResult.variantId, name: variantResult.variantName } : null,
      _generationId: generationId,
      _mapReduce: variantResult.mapReduceMetadata
    };
  } catch (error) {
    // Re-throw research validation errors - these MUST bubble up to the user
    if (error.message.includes('RESEARCH CONTENT') || error.message.includes('INVALID RESEARCH')) {
      throw error;
    }
    return { success: false, error: error.message };
  }
}

async function generateResearchAnalysis(userPrompt, researchFiles, perfLogger = null, options = {}) {
  const contentType = 'researchAnalysis';
  const combinedContent = combineResearchContent(researchFiles);
  const startTime = Date.now();

  try {
    // Check cache first
    if (ENABLE_CACHE) {
      const cached = getCachedContent(contentType, combinedContent, userPrompt);
      if (cached) {
        if (perfLogger) {
          perfLogger.setMetadata(`cache-hit-${contentType}`, true);
        }
        // Record cache hit metrics
        const generationId = recordGenerationMetrics({
          contentType: 'ResearchAnalysis',
          variantId: 'default',
          userPrompt,
          fileCount: researchFiles.length,
          cacheHit: true,
          latencyMs: Date.now() - startTime
        });
        return { success: true, data: cached, _cached: true, _generationId: generationId };
      }
    }

    // Select variant and generate prompt (A/B testing) - uses async version for map-reduce support
    const variantResult = await selectAndApplyVariantAsync('ResearchAnalysis', userPrompt, researchFiles, generateResearchAnalysisPrompt, {
      perfLogger,
      onProgress: options.onProgress
    });

    // Log variant selection
    if (perfLogger && variantResult.usedVariant) {
      perfLogger.setMetadata('variant-researchanalysis', {
        id: variantResult.variantId,
        name: variantResult.variantName
      });
    }

    // Build routing options for model selection
    const routingOptions = {
      content: combinedContent,
      fileCount: researchFiles.length
    };

    const data = await generateWithGemini(variantResult.prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG, perfLogger, routingOptions);

    // Ensure we have valid data before returning success
    if (data === null || data === undefined) {
      throw new Error('Research analysis generation completed but returned no data. The AI response may have been malformed.');
    }

    // Store in cache
    if (ENABLE_CACHE && data) {
      setCachedContent(contentType, combinedContent, userPrompt, data);
    }

    const latencyMs = Date.now() - startTime;

    // Record variant performance for A/B testing
    if (variantResult.usedVariant) {
      const perfMetrics = {
        latencyMs,
        qualityScore: 0,
        success: true
      };
      recordVariantPerformance(variantResult.variantId, perfMetrics);
      recordExperimentMetric(variantResult.variantId, perfMetrics);
    }

    // Record generation metrics for auto-optimization
    const generationId = recordGenerationMetrics({
      contentType: 'ResearchAnalysis',
      variantId: variantResult.variantId,
      prompt: variantResult.prompt,
      userPrompt,
      fileCount: researchFiles.length,
      latencyMs,
      cacheHit: false
    });

    return {
      success: true,
      data,
      _variant: variantResult.usedVariant ? { id: variantResult.variantId, name: variantResult.variantName } : null,
      _generationId: generationId,
      _mapReduce: variantResult.mapReduceMetadata
    };
  } catch (error) {
    // Re-throw research validation errors - these MUST bubble up to the user
    if (error.message.includes('RESEARCH CONTENT') || error.message.includes('INVALID RESEARCH')) {
      throw error;
    }
    return { success: false, error: error.message };
  }
}

/**
 * Generate all content types with controlled concurrency via API queue
 * This prevents overwhelming the Gemini API with too many simultaneous requests
 *
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Array of research file objects
 * @param {object} options - Options including sessionId for logging
 * @returns {object} Results with performance metrics
 */
export async function generateAllContent(userPrompt, researchFiles, options = {}) {
  // CRITICAL: Validate research files FIRST - fail fast with clear error
  // We must NEVER generate content without user's research documents
  validateResearchFiles(researchFiles);

  // Initialize performance logger
  const perfLogger = new PerformanceLogger('generate-all-content', {
    sessionId: options.sessionId,
    enabled: true
  });

  // Track input metadata
  perfLogger.setMetadata('fileCount', researchFiles.length);
  perfLogger.setMetadata('totalInputSize', researchFiles.reduce((sum, f) => sum + (f.content?.length || 0), 0));
  perfLogger.setMetadata('promptLength', userPrompt.length);

  try {
    // Use apiQueue.runAll to control concurrency and prevent rate limiting
    const tasks = [
      { task: () => generateRoadmap(userPrompt, researchFiles, perfLogger), name: 'Roadmap' },
      { task: () => generateSlides(userPrompt, researchFiles, perfLogger), name: 'Slides' },
      { task: () => generateDocument(userPrompt, researchFiles, perfLogger), name: 'Document' },
      { task: () => generateResearchAnalysis(userPrompt, researchFiles, perfLogger), name: 'ResearchAnalysis' }
    ];

    const [roadmap, slides, document, researchAnalysis] = await apiQueue.runAll(tasks);

    // Complete performance logging
    const perfReport = perfLogger.complete();
    globalMetrics.addRequest(perfReport);
    perfLogger.logReport();

    return {
      roadmap,
      slides,
      document,
      researchAnalysis,
      _performanceMetrics: perfReport
    };
  } catch (error) {
    perfLogger.setMetadata('fatalError', error.message);
    perfLogger.complete();
    perfLogger.logReport();
    throw error;
  }
}
export async function regenerateContent(viewType, prompt, researchFiles, options = {}) {
  // CRITICAL: Validate research files - defense in depth
  // Even though individual generators validate, we validate here too
  // to catch issues early and provide clear error messages
  validateResearchFiles(researchFiles);

  const perfLogger = new PerformanceLogger(`regenerate-${viewType}`, {
    sessionId: options.sessionId,
    enabled: true
  });

  try {
    const taskName = `Regenerate-${viewType}`;
    const task = async () => {
      switch (viewType) {
        case 'roadmap':
          return generateRoadmap(prompt, researchFiles, perfLogger);
        case 'slides':
          return generateSlides(prompt, researchFiles, perfLogger);
        case 'document':
          return generateDocument(prompt, researchFiles, perfLogger);
        case 'research-analysis':
          return generateResearchAnalysis(prompt, researchFiles, perfLogger);
        default:
          throw new Error(`Invalid view type: ${viewType}`);
      }
    };
    const result = await apiQueue.add(task, taskName);

    // Complete performance logging
    const perfReport = perfLogger.complete();
    globalMetrics.addRequest(perfReport);
    perfLogger.logReport();

    return { ...result, _performanceMetrics: perfReport };
  } catch (error) {
    perfLogger.setMetadata('error', error.message);
    perfLogger.complete();
    perfLogger.logReport();
    throw error;
  }
}

// Export metrics for monitoring endpoints
export { globalMetrics, apiQueue, getCacheMetrics, speculativeGenerator };

// Export interval enforcement for use in content retrieval
export { enforceYearlyIntervalsForLongRanges };

// Export generation functions for training script
export { generateRoadmap, generateSlides, generateDocument, generateResearchAnalysis };

// Export variant management functions
export {
  selectVariant,
  recordVariantPerformance,
  initializeVariants,
  getVariantStats,
  getSelectionHistory,
  promoteVariant,
  registerVariant,
  getVariant,
  getVariants,
  getChampion,
  ContentType as VariantContentType
} from './layers/optimization/variants/index.js';

// Export experiment management functions
export {
  startExperiment,
  concludeExperiment,
  getActiveExperiment,
  getExperimentSummary,
  checkAndConcludeExperiments,
  ExperimentStatus
} from './layers/optimization/experiments/index.js';

// Export evolution/auto-optimization functions
export {
  startEvolution,
  stopEvolution,
  runOptimizationCycle,
  generateVariant,
  getMutationStrategies,
  getEvolutionSummary,
  getEvolutionStats,
  getEvolutionHistory,
  updateEvolutionConfig,
  MutationStrategy,
  SchedulerState
} from './layers/optimization/evolution/index.js';

// Export dashboard functions
export {
  getDashboardData,
  getDashboardSummary,
  getInsights,
  getRecommendations,
  getVariantPerformance,
  getExperimentStatus,
  getEvolutionStatus,
  getTrends,
  clearDashboardCache,
  TimePeriod
} from './layers/optimization/dashboard/index.js';

/**
 * Generate all content types with streaming - emits results as each completes
 * Uses callbacks to stream results to the client via SSE
 *
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Array of research file objects
 * @param {object} options - Options including sessionId and callbacks
 * @param {Function} options.onContentReady - Called when a content type completes: (type, result) => void
 * @param {Function} options.onProgress - Called for progress updates: (message) => void
 * @param {Function} options.onComplete - Called when all content is ready: (results) => void
 * @param {Function} options.onError - Called on fatal error: (error) => void
 * @returns {Promise<object>} Final results object
 */
export async function generateAllContentStreaming(userPrompt, researchFiles, options = {}) {
  const {
    sessionId,
    onContentReady = () => {},
    onProgress = () => {},
    onComplete = () => {},
    onError = () => {}
  } = options;

  // CRITICAL: Validate research files FIRST - fail fast with clear error
  // We must NEVER generate content without user's research documents
  validateResearchFiles(researchFiles);

  // Initialize performance logger
  const perfLogger = new PerformanceLogger('generate-all-content-streaming', {
    sessionId,
    enabled: true
  });

  // Track input metadata
  perfLogger.setMetadata('fileCount', researchFiles.length);
  perfLogger.setMetadata('totalInputSize', researchFiles.reduce((sum, f) => sum + (f.content?.length || 0), 0));
  perfLogger.setMetadata('promptLength', userPrompt.length);

  const results = {
    roadmap: null,
    slides: null,
    document: null,
    researchAnalysis: null
  };

  // Content type mapping for consistent naming
  const typeMapping = {
    'Slides': 'slides',
    'Document': 'document',
    'Roadmap': 'roadmap',
    'ResearchAnalysis': 'research-analysis'
  };

  try {
    onProgress('Starting content generation...');

    // Create tasks that emit results as they complete
    const createStreamingTask = (generator, name, viewType) => async () => {
      onProgress(`Generating ${name}...`);
      const result = await generator(userPrompt, researchFiles, perfLogger);
      const mappedType = typeMapping[name] || viewType;

      // Store result
      results[viewType] = result;

      // Emit to callback immediately
      onContentReady(mappedType, result);
      onProgress(`${name} complete`);

      return result;
    };

    // Define tasks with priority (Document and Slides are fastest, emit first)
    const tasks = [
      { task: createStreamingTask(generateDocument, 'Document', 'document'), name: 'Document' },
      { task: createStreamingTask(generateSlides, 'Slides', 'slides'), name: 'Slides' },
      { task: createStreamingTask(generateRoadmap, 'Roadmap', 'roadmap'), name: 'Roadmap' },
      { task: createStreamingTask(generateResearchAnalysis, 'ResearchAnalysis', 'researchAnalysis'), name: 'ResearchAnalysis' }
    ];

    // Run all tasks (they'll emit as they complete due to queue priority)
    await apiQueue.runAll(tasks);

    // Complete performance logging
    const perfReport = perfLogger.complete();
    globalMetrics.addRequest(perfReport);
    perfLogger.logReport();

    // Add performance metrics to results
    results._performanceMetrics = perfReport;

    // Signal completion
    onComplete(results);

    return results;

  } catch (error) {
    perfLogger.setMetadata('fatalError', error.message);
    perfLogger.complete();
    perfLogger.logReport();
    onError(error);
    throw error;
  }
}
