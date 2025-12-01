/**
 * Map-Reduce Research Processor
 * 
 * Orchestrates the chunking, parallel extraction, and consolidation
 * of research content for artifact generation.
 * 
 * This ensures ALL research content is analyzed regardless of size.
 * 
 * Phase 6 Enhancement: Integrated metrics collection for monitoring.
 */

import { needsChunking, chunkResearchFiles, getChunkingStats } from './chunker.js';
import { processChunksParallel, getExtractionStats } from './insightExtractor.js';
import { consolidateInsights, formatForPrompt, getConsolidationStats } from './insightConsolidator.js';
import { recordMapReduceRequest, logExtractionStats, logConsolidationStats } from './mapReduceMetrics.js';

/**
 * Process research files and prepare context for generation
 * 
 * If content is small enough, returns formatted raw content.
 * If content is large, uses map-reduce to extract and consolidate insights.
 * 
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files
 * @param {string} contentType - 'roadmap' | 'slides' | 'document' | 'researchAnalysis'
 * @param {object} options - Processing options
 * @param {Function} options.onProgress - Progress callback
 * @param {boolean} options.forceMapReduce - Force map-reduce even for small content
 * @param {string} options.sessionId - Session ID for metrics tracking
 * @returns {Promise<{context: string, metadata: object}>}
 */
export async function prepareResearchContext(researchFiles, contentType, options = {}) {
  const { onProgress = null, forceMapReduce = false, sessionId = null } = options;
  const startTime = Date.now();
  
  // Validate input
  if (!researchFiles || !Array.isArray(researchFiles) || researchFiles.length === 0) {
    throw new Error('RESEARCH CONTENT MISSING: No research files provided');
  }
  
  const stats = getChunkingStats(researchFiles);
  console.log(`[MapReduce] Research stats:`, stats);
  
  // Check if map-reduce is needed
  if (!stats.needsChunking && !forceMapReduce) {
    console.log(`[MapReduce] Content size ${stats.totalSize} chars - using direct processing`);
    
    // Use direct formatting (existing approach)
    const context = researchFiles
      .map(file => `=== ${file.filename} ===\n${file.content}`)
      .join('\n\n');
    
    const totalTimeMs = Date.now() - startTime;
    
    // Record metrics for direct processing
    recordMapReduceRequest({
      sessionId,
      contentType,
      strategy: 'direct',
      totalSize: stats.totalSize,
      totalTimeMs
    });
    
    return {
      context,
      metadata: {
        strategy: 'direct',
        totalSize: stats.totalSize,
        fileCount: stats.files,
        processingTimeMs: totalTimeMs
      }
    };
  }
  
  // Map-Reduce processing
  console.log(`[MapReduce] Content size ${stats.totalSize} chars exceeds threshold - using map-reduce`);
  
  if (onProgress) {
    onProgress({ phase: 'chunking', message: 'Splitting research into chunks...' });
  }
  
  // Step 1: Chunk the content
  const chunks = chunkResearchFiles(researchFiles);
  console.log(`[MapReduce] Created ${chunks.length} chunks`);
  
  if (onProgress) {
    onProgress({ 
      phase: 'extraction', 
      message: `Analyzing ${chunks.length} content sections...`,
      current: 0,
      total: chunks.length 
    });
  }
  
  // Step 2: Extract insights in parallel
  const extractionStartTime = Date.now();
  const extractionResults = await processChunksParallel(chunks, onProgress);
  const extractionTimeMs = Date.now() - extractionStartTime;
  const extractionStats = getExtractionStats(extractionResults);
  logExtractionStats(extractionStats);
  
  if (onProgress) {
    onProgress({ phase: 'consolidation', message: 'Consolidating insights...' });
  }
  
  // Step 3: Consolidate insights
  const consolidationStartTime = Date.now();
  const consolidated = consolidateInsights(extractionResults);
  const consolidationTimeMs = Date.now() - consolidationStartTime;
  const consolidationStats = getConsolidationStats(consolidated);
  logConsolidationStats(consolidationStats);
  
  // Step 4: Format for the specific content type
  const context = formatForPrompt(consolidated, contentType);
  
  if (onProgress) {
    onProgress({ phase: 'complete', message: 'Research analysis complete' });
  }
  
  const totalTimeMs = Date.now() - startTime;
  
  // Record metrics for map-reduce processing
  recordMapReduceRequest({
    sessionId,
    contentType,
    strategy: 'map-reduce',
    totalSize: stats.totalSize,
    chunksProcessed: chunks.length,
    extractionTimeMs,
    consolidationTimeMs,
    totalTimeMs,
    insightsExtracted: {
      facts: extractionStats.totalKeyFacts,
      entities: extractionStats.totalEntities,
      themes: extractionStats.totalThemes
    },
    cacheHits: extractionStats.cacheHits || 0,
    cacheMisses: extractionStats.cacheMisses || 0
  });
  
  return {
    context,
    metadata: {
      strategy: 'map-reduce',
      totalSize: stats.totalSize,
      fileCount: stats.files,
      chunksProcessed: chunks.length,
      extraction: extractionStats,
      consolidation: consolidationStats,
      timing: {
        extractionTimeMs,
        consolidationTimeMs,
        totalTimeMs
      }
    }
  };
}

/**
 * Check if research files would trigger map-reduce processing
 * @param {Array<{filename: string, content: string}>} researchFiles 
 * @returns {boolean}
 */
export function willUseMapReduce(researchFiles) {
  return needsChunking(researchFiles);
}

/**
 * Get estimated processing info for research files
 * @param {Array<{filename: string, content: string}>} researchFiles 
 * @returns {object} Processing estimate
 */
export function getProcessingEstimate(researchFiles) {
  const stats = getChunkingStats(researchFiles);
  
  if (!stats.needsChunking) {
    return {
      strategy: 'direct',
      estimatedTime: '< 5 seconds',
      chunks: 1
    };
  }
  
  // Estimate: ~3 seconds per chunk for extraction + consolidation
  const estimatedSeconds = stats.estimatedChunks * 3 + 2;
  
  return {
    strategy: 'map-reduce',
    estimatedTime: `${estimatedSeconds}-${estimatedSeconds + 5} seconds`,
    chunks: stats.estimatedChunks,
    totalSize: stats.totalSize
  };
}

// Re-export utilities for direct access if needed
export { needsChunking, chunkResearchFiles, getChunkingStats } from './chunker.js';
export { processChunksParallel, extractInsights } from './insightExtractor.js';
export { consolidateInsights, formatForPrompt } from './insightConsolidator.js';
