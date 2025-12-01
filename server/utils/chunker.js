/**
 * Research Content Chunker
 * 
 * Splits large research content into semantically meaningful chunks
 * while preserving context and file boundaries.
 */

export const CHUNK_CONFIG = {
  targetChunkSize: 20000,      // ~5000 tokens per chunk
  overlapSize: 500,            // Context overlap between chunks
  minChunkSize: 5000,          // Don't create tiny chunks
  maxChunks: 10,               // Safety limit
  chunkThreshold: 50000        // Only chunk if total exceeds this
};

/**
 * Check if content needs chunking
 * @param {Array<{filename: string, content: string}>} files 
 * @returns {boolean}
 */
export function needsChunking(files) {
  if (!files || !Array.isArray(files)) return false;
  const totalChars = files.reduce((sum, f) => sum + (f.content?.length || 0), 0);
  return totalChars > CHUNK_CONFIG.chunkThreshold;
}

/**
 * Get total character count of research files
 * @param {Array<{filename: string, content: string}>} files 
 * @returns {number}
 */
export function getTotalContentSize(files) {
  if (!files || !Array.isArray(files)) return 0;
  return files.reduce((sum, f) => sum + (f.content?.length || 0), 0);
}

/**
 * Split text at a semantic boundary (paragraph, sentence, or word)
 * @param {string} text - Text to find split point in
 * @param {number} targetPosition - Ideal position to split
 * @param {number} searchRadius - How far to search for a good boundary
 * @returns {number} - Best split position
 */
function findSemanticBreak(text, targetPosition, searchRadius = 500) {
  const searchStart = Math.max(0, targetPosition - searchRadius);
  const searchEnd = Math.min(text.length, targetPosition + searchRadius);
  const searchRegion = text.substring(searchStart, searchEnd);
  
  // Priority 1: Paragraph break (double newline)
  const paragraphBreaks = [...searchRegion.matchAll(/\n\n/g)];
  if (paragraphBreaks.length > 0) {
    // Find the one closest to target
    let bestBreak = paragraphBreaks[0];
    let bestDistance = Math.abs((searchStart + bestBreak.index) - targetPosition);
    for (const match of paragraphBreaks) {
      const distance = Math.abs((searchStart + match.index) - targetPosition);
      if (distance < bestDistance) {
        bestBreak = match;
        bestDistance = distance;
      }
    }
    return searchStart + bestBreak.index + 2; // After the double newline
  }
  
  // Priority 2: Sentence break
  const sentenceBreaks = [...searchRegion.matchAll(/[.!?]\s+/g)];
  if (sentenceBreaks.length > 0) {
    let bestBreak = sentenceBreaks[0];
    let bestDistance = Math.abs((searchStart + bestBreak.index) - targetPosition);
    for (const match of sentenceBreaks) {
      const distance = Math.abs((searchStart + match.index) - targetPosition);
      if (distance < bestDistance) {
        bestBreak = match;
        bestDistance = distance;
      }
    }
    return searchStart + bestBreak.index + bestBreak[0].length;
  }
  
  // Priority 3: Any newline
  const lineBreaks = [...searchRegion.matchAll(/\n/g)];
  if (lineBreaks.length > 0) {
    let bestBreak = lineBreaks[0];
    let bestDistance = Math.abs((searchStart + bestBreak.index) - targetPosition);
    for (const match of lineBreaks) {
      const distance = Math.abs((searchStart + match.index) - targetPosition);
      if (distance < bestDistance) {
        bestBreak = match;
        bestDistance = distance;
      }
    }
    return searchStart + bestBreak.index + 1;
  }
  
  // Fallback: Just use target position
  return targetPosition;
}

/**
 * Split a single file's content into chunks
 * @param {string} content - File content
 * @param {string} filename - Source filename
 * @param {number} startChunkId - Starting chunk ID
 * @returns {Array<{chunkId: number, content: string, sourceFile: string, isPartial: boolean}>}
 */
function splitFileContent(content, filename, startChunkId) {
  const chunks = [];
  const { targetChunkSize, overlapSize, minChunkSize } = CHUNK_CONFIG;
  
  // If content fits in one chunk, return as-is
  if (content.length <= targetChunkSize) {
    return [{
      chunkId: startChunkId,
      content: content,
      sourceFile: filename,
      isPartial: false
    }];
  }
  
  let position = 0;
  let chunkId = startChunkId;
  
  while (position < content.length) {
    const remaining = content.length - position;
    
    // If remaining content is small enough, include it all
    if (remaining <= targetChunkSize + minChunkSize) {
      chunks.push({
        chunkId: chunkId++,
        content: content.substring(position),
        sourceFile: filename,
        isPartial: chunks.length > 0
      });
      break;
    }
    
    // Find a good break point
    const targetEnd = position + targetChunkSize;
    const breakPoint = findSemanticBreak(content, targetEnd);
    
    chunks.push({
      chunkId: chunkId++,
      content: content.substring(position, breakPoint),
      sourceFile: filename,
      isPartial: true
    });
    
    // Move position, accounting for overlap
    position = Math.max(position + minChunkSize, breakPoint - overlapSize);
  }
  
  return chunks;
}

/**
 * Split research files into processable chunks
 * @param {Array<{filename: string, content: string}>} files 
 * @returns {Array<{chunkId: number, content: string, sourceFiles: string[], metadata: object}>}
 */
export function chunkResearchFiles(files) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    return [];
  }
  
  const allChunks = [];
  let currentChunkId = 1;
  
  // First pass: split each file individually
  const fileChunks = [];
  for (const file of files) {
    if (!file.content || file.content.trim().length === 0) continue;
    
    const chunks = splitFileContent(file.content, file.filename, currentChunkId);
    fileChunks.push(...chunks);
    currentChunkId += chunks.length;
  }
  
  // If we have too many chunks, merge smaller ones
  if (fileChunks.length > CHUNK_CONFIG.maxChunks) {
    return mergeSmallChunks(fileChunks, CHUNK_CONFIG.maxChunks);
  }
  
  // Format output with metadata
  return fileChunks.map((chunk, index) => ({
    chunkId: index + 1,
    content: chunk.content,
    sourceFiles: [chunk.sourceFile],
    metadata: {
      charCount: chunk.content.length,
      isPartial: chunk.isPartial,
      originalChunkId: chunk.chunkId
    }
  }));
}

/**
 * Merge smaller chunks to stay under maxChunks limit
 * @param {Array} chunks - Array of chunks
 * @param {number} maxChunks - Maximum allowed chunks
 * @returns {Array} - Merged chunks
 */
function mergeSmallChunks(chunks, maxChunks) {
  const { targetChunkSize } = CHUNK_CONFIG;
  const merged = [];
  let currentMerge = {
    content: '',
    sourceFiles: new Set(),
    charCount: 0
  };
  
  for (const chunk of chunks) {
    // If adding this chunk would exceed target, save current and start new
    if (currentMerge.charCount + chunk.content.length > targetChunkSize * 1.5 && currentMerge.charCount > 0) {
      merged.push({
        chunkId: merged.length + 1,
        content: currentMerge.content,
        sourceFiles: [...currentMerge.sourceFiles],
        metadata: {
          charCount: currentMerge.charCount,
          isMerged: true
        }
      });
      currentMerge = {
        content: '',
        sourceFiles: new Set(),
        charCount: 0
      };
    }
    
    // Add separator if merging
    if (currentMerge.content.length > 0) {
      currentMerge.content += '\n\n---\n\n';
    }
    
    currentMerge.content += `[Source: ${chunk.sourceFile}]\n${chunk.content}`;
    currentMerge.sourceFiles.add(chunk.sourceFile);
    currentMerge.charCount += chunk.content.length;
  }
  
  // Don't forget the last merge
  if (currentMerge.charCount > 0) {
    merged.push({
      chunkId: merged.length + 1,
      content: currentMerge.content,
      sourceFiles: [...currentMerge.sourceFiles],
      metadata: {
        charCount: currentMerge.charCount,
        isMerged: true
      }
    });
  }
  
  // If still too many, recursively merge
  if (merged.length > maxChunks) {
    console.warn(`[Chunker] Still have ${merged.length} chunks after merging, target was ${maxChunks}`);
  }
  
  return merged;
}

/**
 * Get chunking statistics for logging
 * @param {Array<{filename: string, content: string}>} files 
 * @returns {object}
 */
export function getChunkingStats(files) {
  const totalSize = getTotalContentSize(files);
  const needsChunk = needsChunking(files);
  
  if (!needsChunk) {
    return {
      totalSize,
      needsChunking: false,
      estimatedChunks: 1,
      files: files.length
    };
  }
  
  const estimatedChunks = Math.min(
    Math.ceil(totalSize / CHUNK_CONFIG.targetChunkSize),
    CHUNK_CONFIG.maxChunks
  );
  
  return {
    totalSize,
    needsChunking: true,
    estimatedChunks,
    files: files.length,
    threshold: CHUNK_CONFIG.chunkThreshold
  };
}
