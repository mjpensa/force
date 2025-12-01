/**
 * Insight Extractor
 * 
 * Extracts structured insights from research chunks
 * using targeted LLM prompts. Processes chunks in parallel
 * with rate limiting.
 * 
 * Phase 4 Enhancement: Integrated caching to avoid redundant LLM calls.
 */

import { SchemaType } from '@google/generative-ai';
import { callGeminiForJson } from '../gemini.js';
import { generateContentHash, getCachedInsights, cacheInsights, getInsightCacheMetrics } from '../cache/insightCache.js';
import { CONFIG } from '../config.js';

// Rate limiting configuration
const RATE_LIMIT = {
  maxConcurrent: 3,           // Max parallel extraction calls
  delayBetweenCalls: 100      // ms delay between starting calls
};

// Caching configuration
const CACHE_CONFIG = {
  enabled: true,              // Enable/disable insight caching
  logCacheOps: true           // Log cache hits/misses
};

/**
 * Schema for extracted insights
 */
export const insightExtractionSchema = {
  description: "Structured insights extracted from research content",
  type: SchemaType.OBJECT,
  properties: {
    keyFacts: {
      type: SchemaType.ARRAY,
      description: "Important factual statements, findings, and conclusions",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          fact: { type: SchemaType.STRING, description: "The factual statement" },
          importance: { type: SchemaType.STRING, enum: ["high", "medium", "low"], description: "Importance level" },
          category: { type: SchemaType.STRING, description: "Topic category (e.g., 'technology', 'strategy', 'market')" }
        },
        required: ["fact", "importance"]
      }
    },
    dates: {
      type: SchemaType.ARRAY,
      description: "Dates, timelines, deadlines, and milestones",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "The date or time period" },
          event: { type: SchemaType.STRING, description: "What happens on this date" },
          type: { type: SchemaType.STRING, enum: ["deadline", "milestone", "target", "historical", "ongoing"], description: "Type of date" }
        },
        required: ["date", "event"]
      }
    },
    entities: {
      type: SchemaType.ARRAY,
      description: "Companies, people, products, and technologies mentioned",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: "Entity name" },
          type: { type: SchemaType.STRING, enum: ["company", "person", "product", "technology", "organization", "other"], description: "Entity type" },
          context: { type: SchemaType.STRING, description: "Brief context about this entity's relevance" }
        },
        required: ["name", "type"]
      }
    },
    themes: {
      type: SchemaType.ARRAY,
      description: "Major topics, trends, and patterns discussed",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          theme: { type: SchemaType.STRING, description: "The theme or topic" },
          description: { type: SchemaType.STRING, description: "Brief description of this theme" },
          frequency: { type: SchemaType.STRING, enum: ["primary", "secondary", "mentioned"], description: "How prominently featured" }
        },
        required: ["theme", "frequency"]
      }
    },
    metrics: {
      type: SchemaType.ARRAY,
      description: "Numbers, statistics, percentages, and KPIs",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          value: { type: SchemaType.STRING, description: "The metric value" },
          context: { type: SchemaType.STRING, description: "What this metric measures" },
          trend: { type: SchemaType.STRING, enum: ["increasing", "decreasing", "stable", "unknown"], description: "Direction of change if applicable" }
        },
        required: ["value", "context"]
      }
    },
    recommendations: {
      type: SchemaType.ARRAY,
      description: "Suggested actions, next steps, and advice",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          recommendation: { type: SchemaType.STRING, description: "The recommended action" },
          priority: { type: SchemaType.STRING, enum: ["critical", "high", "medium", "low"], description: "Priority level" },
          timeframe: { type: SchemaType.STRING, description: "When this should be done (if specified)" }
        },
        required: ["recommendation", "priority"]
      }
    },
    quotes: {
      type: SchemaType.ARRAY,
      description: "Important direct quotes worth preserving",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          quote: { type: SchemaType.STRING, description: "The direct quote" },
          speaker: { type: SchemaType.STRING, description: "Who said it (if known)" },
          significance: { type: SchemaType.STRING, description: "Why this quote matters" }
        },
        required: ["quote"]
      }
    },
    tasks: {
      type: SchemaType.ARRAY,
      description: "Tasks, activities, projects, initiatives, phases, decisions, and action items - anything that could appear on a Gantt chart or timeline",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          task: { type: SchemaType.STRING, description: "The task, activity, or initiative name" },
          description: { type: SchemaType.STRING, description: "Brief description of the task" },
          type: { type: SchemaType.STRING, enum: ["task", "milestone", "decision", "phase", "initiative", "project", "activity"], description: "Type of item" },
          entity: { type: SchemaType.STRING, description: "Company, organization, or department responsible (if mentioned)" },
          timing: { type: SchemaType.STRING, description: "Any timing information mentioned (dates, durations, quarters, years, or 'unknown')" },
          status: { type: SchemaType.STRING, enum: ["planned", "in-progress", "completed", "unknown"], description: "Status if mentioned" }
        },
        required: ["task", "type"]
      }
    }
  },
  required: ["keyFacts", "themes", "tasks"]
};

/**
 * Generate the extraction prompt for a chunk
 * @param {string} chunkContent - Content to analyze
 * @param {number} chunkId - Current chunk number
 * @param {number} totalChunks - Total number of chunks
 * @param {string[]} sourceFiles - Source file names
 * @returns {string}
 */
export function generateExtractionPrompt(chunkContent, chunkId, totalChunks, sourceFiles) {
  const sourceInfo = sourceFiles.length > 0 
    ? `Source files: ${sourceFiles.join(', ')}`
    : '';
    
  return `You are analyzing research document chunk ${chunkId} of ${totalChunks}.
${sourceInfo}

Your task is to extract ALL important information from this content into a structured format.
Be thorough and comprehensive - capture every key fact, date, entity, and insight.
Do not summarize or interpret - extract specific, concrete details.

CONTENT TO ANALYZE:
---
${chunkContent}
---

Extract information into these categories:

1. KEY FACTS: Important statements, findings, conclusions, and claims
   - Include specific details, not vague summaries
   - Mark importance as high/medium/low
   - Categorize by topic

2. DATES & TIMELINES: Any dates, deadlines, milestones, time periods
   - Include the specific date/timeframe
   - Describe what happens or is due
   - Classify the type (deadline, milestone, target, etc.)

3. ENTITIES: Companies, people, products, technologies mentioned
   - Capture the exact name
   - Classify the type
   - Note why they're relevant

4. THEMES: Major topics, trends, patterns being discussed
   - Identify core themes
   - Note if primary focus or just mentioned

5. METRICS: Numbers, statistics, percentages, KPIs
   - Include the exact value
   - Explain what it measures
   - Note if trending up/down/stable

6. RECOMMENDATIONS: Suggested actions, next steps, advice
   - Capture specific recommendations
   - Note priority and timeframe if mentioned

7. QUOTES: Important direct quotes worth preserving
   - Include the exact quote
   - Attribute to speaker if known

8. TASKS & ACTIVITIES: Extract ALL tasks, projects, initiatives, activities, phases, decisions
   - Include EVERY activity, project, or initiative mentioned
   - Capture the task/activity name
   - Note the type (task, milestone, decision, phase, initiative, project, activity)
   - Include the responsible entity/organization if mentioned
   - Include ANY timing info (dates, quarters, years, durations, or "unknown")
   - This is CRITICAL for Gantt chart generation - extract liberally

Be comprehensive. Extract as much structured data as possible.
IMPORTANT: For Gantt chart generation, extracting ALL tasks and activities is critical - when in doubt, include it.`;
}

/**
 * Extract insights from a single chunk
 * @param {object} chunk - Chunk object with content and metadata
 * @param {number} totalChunks - Total number of chunks being processed
 * @param {object} options - Extraction options
 * @param {boolean} options.useCache - Whether to use caching (default: true)
 * @returns {Promise<object>} Extracted insights
 */
export async function extractInsights(chunk, totalChunks, options = {}) {
  const { useCache = CACHE_CONFIG.enabled } = options;
  const startTime = Date.now();
  
  // Generate content hash for caching
  const contentHash = useCache ? generateContentHash(chunk.content) : null;
  
  // Check cache first
  if (useCache && contentHash) {
    const cached = await getCachedInsights(contentHash);
    if (cached) {
      const duration = Date.now() - startTime;
      if (CACHE_CONFIG.logCacheOps) {
        console.log(`[InsightExtractor] Chunk ${chunk.chunkId}/${totalChunks} CACHE HIT (${duration}ms)`);
      }
      
      return {
        chunkId: chunk.chunkId,
        sourceFiles: chunk.sourceFiles,
        insights: cached,
        metadata: {
          extractionTime: duration,
          charCount: chunk.content.length,
          cacheHit: true
        }
      };
    }
  }
  
  // Cache miss - call LLM
  const prompt = generateExtractionPrompt(
    chunk.content,
    chunk.chunkId,
    totalChunks,
    chunk.sourceFiles || []
  );

  // Construct proper API payload
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: insightExtractionSchema,
      maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_ANALYSIS,
      temperature: 0.1,  // Low temperature for factual extraction
      topP: CONFIG.API.TOP_P,
      topK: CONFIG.API.TOP_K,
      seed: CONFIG.API.SEED
    }
  };

  try {
    const llmStartTime = Date.now();

    const result = await callGeminiForJson(payload, 2); // 2 retries
    
    const llmDuration = Date.now() - llmStartTime;
    const totalDuration = Date.now() - startTime;
    console.log(`[InsightExtractor] Chunk ${chunk.chunkId}/${totalChunks} extracted in ${llmDuration}ms (total: ${totalDuration}ms)`);
    
    // Cache the result
    if (useCache && contentHash) {
      await cacheInsights(contentHash, result);
    }
    
    return {
      chunkId: chunk.chunkId,
      sourceFiles: chunk.sourceFiles,
      insights: result,
      metadata: {
        extractionTime: llmDuration,
        charCount: chunk.content.length,
        cacheHit: false
      }
    };
    
  } catch (error) {
    console.error(`[InsightExtractor] Failed to extract chunk ${chunk.chunkId}: ${error.message}`);
    
    // Return empty insights rather than failing completely
    return {
      chunkId: chunk.chunkId,
      sourceFiles: chunk.sourceFiles,
      insights: {
        keyFacts: [],
        dates: [],
        entities: [],
        themes: [],
        metrics: [],
        recommendations: [],
        quotes: [],
        tasks: []
      },
      metadata: {
        error: error.message,
        charCount: chunk.content.length
      }
    };
  }
}

/**
 * Simple rate-limited parallel processor
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} maxConcurrent - Max concurrent operations
 * @returns {Promise<Array>} Results
 */
async function processWithRateLimit(items, processor, maxConcurrent) {
  const results = [];
  const inProgress = new Set();
  const queue = [...items];
  
  return new Promise((resolve, reject) => {
    const processNext = async () => {
      if (queue.length === 0 && inProgress.size === 0) {
        resolve(results);
        return;
      }
      
      while (queue.length > 0 && inProgress.size < maxConcurrent) {
        const item = queue.shift();
        const index = items.indexOf(item);
        inProgress.add(index);
        
        processor(item)
          .then(result => {
            results[index] = result;
            inProgress.delete(index);
            processNext();
          })
          .catch(error => {
            console.error(`[RateLimit] Processing failed:`, error);
            results[index] = { error: error.message };
            inProgress.delete(index);
            processNext();
          });
        
        // Small delay between starting calls
        if (queue.length > 0) {
          await new Promise(r => setTimeout(r, RATE_LIMIT.delayBetweenCalls));
        }
      }
    };
    
    processNext();
  });
}

/**
 * Process all chunks in parallel with rate limiting
 * @param {Array<object>} chunks - Array of chunk objects
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<Array<object>>} Array of extraction results
 */
export async function processChunksParallel(chunks, onProgress = null) {
  if (!chunks || chunks.length === 0) {
    return [];
  }
  
  console.log(`[InsightExtractor] Processing ${chunks.length} chunks with max ${RATE_LIMIT.maxConcurrent} concurrent`);
  const startTime = Date.now();
  
  let completed = 0;
  const totalChunks = chunks.length;
  
  const processor = async (chunk) => {
    const result = await extractInsights(chunk, totalChunks);
    completed++;
    
    if (onProgress) {
      onProgress({
        phase: 'extraction',
        current: completed,
        total: totalChunks,
        percentage: Math.round((completed / totalChunks) * 100)
      });
    }
    
    return result;
  };
  
  const results = await processWithRateLimit(chunks, processor, RATE_LIMIT.maxConcurrent);
  
  const totalTime = Date.now() - startTime;
  console.log(`[InsightExtractor] All ${chunks.length} chunks processed in ${totalTime}ms (avg ${Math.round(totalTime/chunks.length)}ms/chunk)`);
  
  return results;
}

/**
 * Get extraction statistics
 * @param {Array<object>} results - Extraction results
 * @returns {object} Statistics
 */
export function getExtractionStats(results) {
  const stats = {
    totalChunks: results.length,
    successfulExtractions: 0,
    failedExtractions: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalKeyFacts: 0,
    totalDates: 0,
    totalEntities: 0,
    totalThemes: 0,
    totalMetrics: 0,
    totalRecommendations: 0,
    totalQuotes: 0,
    totalTasks: 0,
    totalExtractionTime: 0
  };

  for (const result of results) {
    if (result.metadata?.error) {
      stats.failedExtractions++;
    } else {
      stats.successfulExtractions++;
    }

    // Track cache performance
    if (result.metadata?.cacheHit) {
      stats.cacheHits++;
    } else if (result.metadata?.cacheHit === false) {
      stats.cacheMisses++;
    }

    if (result.insights) {
      stats.totalKeyFacts += result.insights.keyFacts?.length || 0;
      stats.totalDates += result.insights.dates?.length || 0;
      stats.totalEntities += result.insights.entities?.length || 0;
      stats.totalThemes += result.insights.themes?.length || 0;
      stats.totalMetrics += result.insights.metrics?.length || 0;
      stats.totalRecommendations += result.insights.recommendations?.length || 0;
      stats.totalQuotes += result.insights.quotes?.length || 0;
      stats.totalTasks += result.insights.tasks?.length || 0;
    }

    if (result.metadata?.extractionTime) {
      stats.totalExtractionTime += result.metadata.extractionTime;
    }
  }

  // Add cache metrics summary
  stats.cacheHitRate = stats.totalChunks > 0
    ? Math.round((stats.cacheHits / stats.totalChunks) * 100) + '%'
    : '0%';

  return stats;
}

/**
 * Get global insight cache metrics
 * @returns {object} Cache statistics
 */
export { getInsightCacheMetrics };
