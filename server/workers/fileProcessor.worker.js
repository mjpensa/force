/**
 * File Processing Worker Thread
 *
 * Handles CPU-intensive file processing tasks off the main thread:
 * - Text normalization
 * - Content deduplication
 * - JSON parsing and validation
 */

import { parentPort } from 'worker_threads';
import crypto from 'crypto';

// ============================================================================
// TEXT PROCESSING UTILITIES
// ============================================================================

/**
 * Normalize whitespace in text
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
function normalizeWhitespace(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

/**
 * Generate hash for text chunk (for deduplication)
 * @param {string} text - Text to hash
 * @param {number} sampleSize - Size of text sample to hash
 * @returns {string} Short hash
 */
function hashText(text, sampleSize = 100) {
  const sample = text.substring(0, sampleSize);
  return crypto.createHash('md5')
    .update(sample.toLowerCase().replace(/\s+/g, ''))
    .digest('hex')
    .substring(0, 12);
}

/**
 * Deduplicate paragraphs in text
 * @param {string} text - Input text
 * @param {number} minLength - Minimum paragraph length to keep
 * @returns {object} { text: string, removed: number }
 */
function deduplicateParagraphs(text, minLength = 20) {
  const paragraphs = text.split(/\n\n+/);
  const seen = new Set();
  const unique = [];
  let removed = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();

    if (trimmed.length < minLength) {
      continue;
    }

    const hash = hashText(trimmed);
    if (seen.has(hash)) {
      removed++;
      continue;
    }

    seen.add(hash);
    unique.push(trimmed);
  }

  return {
    text: unique.join('\n\n'),
    removed
  };
}

/**
 * Smart truncation that preserves complete sections
 * @param {string} text - Input text
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function smartTruncate(text, maxLength) {
  if (text.length <= maxLength) return text;

  const breakPoint = Math.min(maxLength, text.length);

  // Look for paragraph break within last 500 chars
  let cutPoint = text.lastIndexOf('\n\n', breakPoint);
  if (cutPoint < breakPoint - 500) {
    // No paragraph break found, try sentence
    cutPoint = text.lastIndexOf('. ', breakPoint);
  }
  if (cutPoint < breakPoint - 500) {
    // No sentence break found, hard cut
    cutPoint = breakPoint;
  }

  return text.substring(0, cutPoint).trim() + '\n\n[Content truncated]';
}

/**
 * Parse and validate JSON with error recovery
 * @param {string} jsonString - JSON string to parse
 * @returns {object} { success: boolean, data?: any, error?: string }
 */
function safeJsonParse(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    return { success: true, data };
  } catch (error) {
    // Try to repair common JSON issues
    try {
      // Remove trailing commas
      const cleaned = jsonString
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      const data = JSON.parse(cleaned);
      return { success: true, data, repaired: true };
    } catch {
      return { success: false, error: error.message };
    }
  }
}

/**
 * Extract text content from HTML
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function extractTextFromHtml(html) {
  let text = html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n## $1\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ');

  return normalizeWhitespace(text);
}

// ============================================================================
// TASK HANDLERS
// ============================================================================

const taskHandlers = {
  /**
   * Process text content
   */
  processText: ({ content, options = {} }) => {
    const {
      normalize = true,
      deduplicate = true,
      truncateLength = null,
      minParagraphLength = 20
    } = options;

    let result = content;
    let metrics = { originalLength: content.length };

    if (normalize) {
      result = normalizeWhitespace(result);
      metrics.afterNormalize = result.length;
    }

    if (deduplicate) {
      const deduped = deduplicateParagraphs(result, minParagraphLength);
      result = deduped.text;
      metrics.duplicatesRemoved = deduped.removed;
    }

    if (truncateLength && result.length > truncateLength) {
      result = smartTruncate(result, truncateLength);
      metrics.truncated = true;
    }

    metrics.finalLength = result.length;
    metrics.reduction = ((metrics.originalLength - metrics.finalLength) / metrics.originalLength * 100).toFixed(1) + '%';

    return { content: result, metrics };
  },

  /**
   * Parse and validate JSON
   */
  parseJson: ({ jsonString }) => {
    return safeJsonParse(jsonString);
  },

  /**
   * Extract text from HTML
   */
  extractHtml: ({ html, options = {} }) => {
    const { truncateLength = null } = options;

    let result = extractTextFromHtml(html);

    if (truncateLength && result.length > truncateLength) {
      result = smartTruncate(result, truncateLength);
    }

    return { content: result, length: result.length };
  },

  /**
   * Deduplicate across multiple files
   */
  crossFileDedupe: ({ files, minParagraphLength = 20 }) => {
    const globalHashes = new Map();
    const results = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      const paragraphs = file.content.split(/\n\n+/);
      const unique = [];
      let removed = 0;

      for (const para of paragraphs) {
        if (para.length < minParagraphLength) continue;

        const hash = hashText(para);
        const firstSeenIn = globalHashes.get(hash);

        if (firstSeenIn !== undefined && firstSeenIn !== fileIndex) {
          removed++;
          continue;
        }

        if (firstSeenIn === undefined) {
          globalHashes.set(hash, fileIndex);
        }
        unique.push(para);
      }

      results.push({
        filename: file.filename,
        content: unique.join('\n\n'),
        crossFileDuplicatesRemoved: removed
      });
    }

    return { files: results, totalUniqueHashes: globalHashes.size };
  },

  /**
   * Compute content hash for caching
   */
  computeHash: ({ content, algorithm = 'sha256' }) => {
    const hash = crypto.createHash(algorithm)
      .update(content)
      .digest('hex');
    return { hash };
  }
};

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

parentPort.on('message', async (message) => {
  const { task, data, id } = message;

  try {
    const handler = taskHandlers[task];

    if (!handler) {
      parentPort.postMessage({
        id,
        success: false,
        error: `Unknown task: ${task}`
      });
      return;
    }

    const startTime = Date.now();
    const result = await handler(data);
    const duration = Date.now() - startTime;

    parentPort.postMessage({
      id,
      success: true,
      result,
      duration
    });

  } catch (error) {
    parentPort.postMessage({
      id,
      success: false,
      error: error.message
    });
  }
});

// Signal ready
parentPort.postMessage({ type: 'ready' });
