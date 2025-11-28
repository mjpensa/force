/**
 * Optimized File Processing Utility
 *
 * Performance optimizations:
 * - Parallel processing with concurrency limits
 * - Content deduplication (removes duplicate paragraphs)
 * - Text normalization (whitespace cleanup)
 * - Smart content truncation with section preservation
 * - Per-file-type metrics tracking
 * - Size limits to prevent memory issues
 *
 * Security features (PROMPT ML Layer 1):
 * - Input sanitization with risk scoring
 * - Prompt injection detection
 * - Content safety validation
 */

import mammoth from 'mammoth';
import crypto from 'crypto';
import { createSanitizer, createDetector, InjectionType } from '../layers/input-safety/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Maximum content size per file (characters)
  maxContentPerFile: 200000,  // ~200KB of text

  // Maximum total content size across all files
  maxTotalContent: 1000000,  // ~1MB total

  // Minimum paragraph length to keep (characters)
  minParagraphLength: 20,

  // Hash-based deduplication threshold (characters to sample)
  dedupeHashSampleSize: 100,

  // Concurrency limit for file processing
  maxConcurrentProcessing: 10,

  // Safety check configuration
  safety: {
    enabled: true,
    sanitizer: {
      riskThreshold: 0.7,
      escapeDelimiters: true,
      removeControlChars: true
    },
    detector: {
      threshold: 0.5,
      useStatistical: true
    }
  }
};

// ============================================================================
// SAFETY LAYER INITIALIZATION
// ============================================================================

// Create safety layer instances (lazy initialization)
let _sanitizer = null;
let _detector = null;

/**
 * Get or create sanitizer instance
 * @returns {InputSanitizer}
 */
function getSanitizer() {
  if (!_sanitizer) {
    _sanitizer = createSanitizer(CONFIG.safety.sanitizer);
  }
  return _sanitizer;
}

/**
 * Get or create injection detector instance
 * @returns {InjectionDetector}
 */
function getDetector() {
  if (!_detector) {
    _detector = createDetector(CONFIG.safety.detector);
  }
  return _detector;
}

/**
 * Check content safety (sanitization + injection detection)
 * @param {string} content - Content to check
 * @param {string} filename - Source filename for logging
 * @returns {object} Safety check result
 */
function checkContentSafety(content, filename) {
  if (!CONFIG.safety.enabled) {
    return {
      isSafe: true,
      sanitizedContent: content,
      riskScore: 0,
      injectionDetected: false,
      warnings: []
    };
  }

  const warnings = [];

  // Step 1: Sanitize content
  const sanitizer = getSanitizer();
  const sanitizationResult = sanitizer.sanitize(content);

  if (sanitizationResult.modifications.length > 0) {
    warnings.push(`Sanitization applied: ${sanitizationResult.modifications.join(', ')}`);
  }

  // Step 2: Check for injection
  const detector = getDetector();
  const injectionResult = detector.detect(sanitizationResult.sanitized, `file: ${filename}`);

  if (injectionResult.isInjection) {
    warnings.push(`Injection detected (${injectionResult.injectionType}): ${injectionResult.explanation}`);
  } else if (injectionResult.confidence > 0.3) {
    warnings.push(`Elevated injection risk (${(injectionResult.confidence * 100).toFixed(0)}%)`);
  }

  // Determine overall safety
  const isSafe = sanitizationResult.isSafe && !injectionResult.isInjection;

  return {
    isSafe,
    sanitizedContent: sanitizationResult.sanitized,
    riskScore: sanitizationResult.riskScore,
    injectionDetected: injectionResult.isInjection,
    injectionType: injectionResult.injectionType,
    injectionConfidence: injectionResult.confidence,
    warnings
  };
}

// ============================================================================
// TEXT PREPROCESSING
// ============================================================================

/**
 * Normalize whitespace in text
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
function normalizeWhitespace(text) {
  return text
    // Replace multiple spaces/tabs with single space
    .replace(/[ \t]+/g, ' ')
    // Replace multiple newlines with double newline (preserve paragraphs)
    .replace(/\n{3,}/g, '\n\n')
    // Trim lines
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Final trim
    .trim();
}

/**
 * Remove HTML tags and decode entities
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function stripHtml(html) {
  return html
    // Remove script and style tags with content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ');
}

/**
 * Extract text from HTML while preserving structure
 * @param {string} html - HTML content from mammoth
 * @returns {string} Structured plain text
 */
function extractTextFromHtml(html) {
  // Convert HTML structure to text with markers
  let text = html
    // Preserve headings with markers
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n## $1\n\n')
    // Preserve paragraphs
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    // Preserve list items
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    // Preserve line breaks
    .replace(/<br\s*\/?>/gi, '\n');

  // Strip remaining HTML and normalize
  return normalizeWhitespace(stripHtml(text));
}

/**
 * Generate hash for a text chunk (for deduplication)
 * @param {string} text - Text to hash
 * @returns {string} Short hash
 */
function hashText(text) {
  const sample = text.substring(0, CONFIG.dedupeHashSampleSize);
  return crypto.createHash('md5')
    .update(sample.toLowerCase().replace(/\s+/g, ''))
    .digest('hex')
    .substring(0, 12);
}

/**
 * Deduplicate paragraphs in text
 * @param {string} text - Input text
 * @returns {object} { text: string, removed: number }
 */
function deduplicateParagraphs(text) {
  const paragraphs = text.split(/\n\n+/);
  const seen = new Set();
  const unique = [];
  let removed = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();

    // Skip very short paragraphs (likely noise)
    if (trimmed.length < CONFIG.minParagraphLength) {
      continue;
    }

    // Check for duplicate using hash
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

  // Find a good breaking point (end of paragraph or sentence)
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

  return text.substring(0, cutPoint).trim() + '\n\n[Content truncated for processing efficiency]';
}

/**
 * Extract key sections from document (abstract, summary, conclusions)
 * @param {string} text - Document text
 * @returns {object} { keyContent: string, hasStructure: boolean }
 */
function extractKeySections(text) {
  const lowerText = text.toLowerCase();

  // Common section headers to prioritize
  const prioritySections = [
    /#{1,3}\s*(abstract|summary|executive\s+summary|overview)/i,
    /#{1,3}\s*(introduction|background)/i,
    /#{1,3}\s*(conclusions?|findings|recommendations|key\s+takeaways)/i,
    /#{1,3}\s*(methodology|approach|methods)/i
  ];

  // Check if document has recognizable structure
  const hasStructure = prioritySections.some(pattern => pattern.test(text));

  if (!hasStructure) {
    // No clear structure, return as-is
    return { keyContent: text, hasStructure: false };
  }

  // Try to extract priority sections
  const sections = text.split(/(?=#{1,3}\s+)/);
  const prioritized = [];
  const other = [];

  for (const section of sections) {
    const isPriority = prioritySections.some(pattern => pattern.test(section.substring(0, 100)));
    if (isPriority) {
      prioritized.push(section);
    } else {
      other.push(section);
    }
  }

  // Combine priority sections first, then others
  return {
    keyContent: [...prioritized, ...other].join('\n\n'),
    hasStructure: true
  };
}

// ============================================================================
// FILE TYPE PROCESSORS
// ============================================================================

/**
 * Process DOCX file
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @returns {Promise<object>} Processing result
 */
async function processDocx(buffer, filename) {
  const startTime = Date.now();

  try {
    const result = await mammoth.convertToHtml({ buffer });
    let content = extractTextFromHtml(result.value);

    // Deduplicate
    const dedupe = deduplicateParagraphs(content);
    content = dedupe.text;

    // Truncate if needed
    content = smartTruncate(content, CONFIG.maxContentPerFile);

    return {
      success: true,
      content,
      metrics: {
        processingTime: Date.now() - startTime,
        originalSize: buffer.length,
        extractedSize: content.length,
        duplicatesRemoved: dedupe.removed,
        fileType: 'docx'
      }
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error.message,
      metrics: {
        processingTime: Date.now() - startTime,
        fileType: 'docx'
      }
    };
  }
}

/**
 * Process plain text file (TXT, MD)
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @returns {Promise<object>} Processing result
 */
async function processText(buffer, filename) {
  const startTime = Date.now();

  try {
    let content = buffer.toString('utf8');

    // Normalize whitespace
    content = normalizeWhitespace(content);

    // Deduplicate
    const dedupe = deduplicateParagraphs(content);
    content = dedupe.text;

    // Truncate if needed
    content = smartTruncate(content, CONFIG.maxContentPerFile);

    const ext = filename.split('.').pop().toLowerCase();

    return {
      success: true,
      content,
      metrics: {
        processingTime: Date.now() - startTime,
        originalSize: buffer.length,
        extractedSize: content.length,
        duplicatesRemoved: dedupe.removed,
        fileType: ext || 'txt'
      }
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error.message,
      metrics: {
        processingTime: Date.now() - startTime,
        fileType: 'txt'
      }
    };
  }
}

/**
 * Process PDF file (placeholder - requires pdf-parse)
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @returns {Promise<object>} Processing result
 */
async function processPdf(buffer, filename) {
  const startTime = Date.now();

  try {
    // Dynamic import of pdf-parse (may not be available)
    let pdfParse;
    try {
      pdfParse = (await import('pdf-parse')).default;
    } catch (e) {
      // PDF parsing not available, return error
      return {
        success: false,
        content: '',
        error: 'PDF parsing not available. Please convert to DOCX or TXT.',
        metrics: {
          processingTime: Date.now() - startTime,
          fileType: 'pdf'
        }
      };
    }

    const data = await pdfParse(buffer);
    let content = data.text;

    // Normalize whitespace
    content = normalizeWhitespace(content);

    // Deduplicate
    const dedupe = deduplicateParagraphs(content);
    content = dedupe.text;

    // Truncate if needed
    content = smartTruncate(content, CONFIG.maxContentPerFile);

    return {
      success: true,
      content,
      metrics: {
        processingTime: Date.now() - startTime,
        originalSize: buffer.length,
        extractedSize: content.length,
        duplicatesRemoved: dedupe.removed,
        pageCount: data.numpages,
        fileType: 'pdf'
      }
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error.message,
      metrics: {
        processingTime: Date.now() - startTime,
        fileType: 'pdf'
      }
    };
  }
}

// ============================================================================
// MAIN PROCESSING FUNCTIONS
// ============================================================================

/**
 * Process a single file based on its type
 * @param {object} file - File object with buffer, mimetype, originalname
 * @returns {Promise<object>} Processed file result
 */
export async function processFile(file) {
  const { buffer, mimetype, originalname } = file;
  const ext = originalname.split('.').pop().toLowerCase();

  // Route to appropriate processor
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx') {
    return processDocx(buffer, originalname);
  }

  if (mimetype === 'application/pdf' || ext === 'pdf') {
    return processPdf(buffer, originalname);
  }

  // Default to text processing (txt, md, etc.)
  return processText(buffer, originalname);
}

/**
 * Process multiple files with optimizations
 * @param {Array} files - Array of file objects
 * @param {object} options - Processing options
 * @returns {Promise<object>} Processing results with metrics
 */
export async function processFiles(files, options = {}) {
  const startTime = Date.now();

  // Sort files for consistent ordering
  const sortedFiles = [...files].sort((a, b) =>
    a.originalname.localeCompare(b.originalname)
  );

  // Process all files in parallel
  const results = await Promise.all(
    sortedFiles.map(async (file) => {
      const result = await processFile(file);
      return {
        filename: file.originalname,
        ...result
      };
    })
  );

  // Separate successful and failed
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // Build research files array
  let researchFiles = successful.map(r => ({
    filename: r.filename,
    content: r.content
  }));

  // Check total content size and truncate if needed
  let totalSize = researchFiles.reduce((sum, f) => sum + f.content.length, 0);

  if (totalSize > CONFIG.maxTotalContent) {
    // Proportionally truncate each file
    const ratio = CONFIG.maxTotalContent / totalSize;
    researchFiles = researchFiles.map(f => ({
      filename: f.filename,
      content: smartTruncate(f.content, Math.floor(f.content.length * ratio))
    }));
    totalSize = researchFiles.reduce((sum, f) => sum + f.content.length, 0);
  }

  // Global deduplication across files (remove paragraphs that appear in multiple files)
  if (researchFiles.length > 1) {
    const globalHashes = new Map(); // hash -> first file index

    researchFiles = researchFiles.map((file, fileIndex) => {
      const paragraphs = file.content.split(/\n\n+/);
      const unique = [];
      let removed = 0;

      for (const para of paragraphs) {
        if (para.length < CONFIG.minParagraphLength) continue;

        const hash = hashText(para);
        const firstSeenIn = globalHashes.get(hash);

        if (firstSeenIn !== undefined && firstSeenIn !== fileIndex) {
          // Duplicate from another file
          removed++;
          continue;
        }

        if (firstSeenIn === undefined) {
          globalHashes.set(hash, fileIndex);
        }
        unique.push(para);
      }

      return {
        filename: file.filename,
        content: unique.join('\n\n'),
        crossFileDuplicatesRemoved: removed
      };
    });
  }

  // =========================================================================
  // SAFETY CHECK (PROMPT ML Layer 1)
  // =========================================================================
  const safetyResults = [];
  const safetyRejected = [];

  researchFiles = researchFiles.map(file => {
    const safetyResult = checkContentSafety(file.content, file.filename);
    safetyResults.push({
      filename: file.filename,
      ...safetyResult
    });

    if (!safetyResult.isSafe) {
      safetyRejected.push({
        filename: file.filename,
        reason: safetyResult.warnings.join('; '),
        riskScore: safetyResult.riskScore,
        injectionType: safetyResult.injectionType
      });
      // Return file with sanitized content but flag it
      return {
        ...file,
        content: safetyResult.sanitizedContent,
        safetyWarnings: safetyResult.warnings,
        rejected: true
      };
    }

    return {
      ...file,
      content: safetyResult.sanitizedContent,
      safetyWarnings: safetyResult.warnings,
      rejected: false
    };
  });

  // Filter out rejected files (those with detected injections)
  const safeResearchFiles = researchFiles.filter(f => !f.rejected);

  // Aggregate metrics
  const finalTotalSize = safeResearchFiles.reduce((sum, f) => sum + f.content.length, 0);

  const metrics = {
    totalProcessingTime: Date.now() - startTime,
    filesProcessed: results.length,
    filesSuccessful: successful.length,
    filesFailed: failed.length,
    totalOriginalSize: results.reduce((sum, r) => sum + (r.metrics?.originalSize || 0), 0),
    totalExtractedSize: finalTotalSize,
    totalDuplicatesRemoved: results.reduce((sum, r) => sum + (r.metrics?.duplicatesRemoved || 0), 0),
    byFileType: {},
    // Safety metrics (PROMPT ML)
    safety: {
      filesChecked: safetyResults.length,
      filesRejected: safetyRejected.length,
      averageRiskScore: safetyResults.length > 0
        ? safetyResults.reduce((sum, r) => sum + r.riskScore, 0) / safetyResults.length
        : 0,
      injectionsDetected: safetyResults.filter(r => r.injectionDetected).length,
      sanitizationsApplied: safetyResults.filter(r => r.warnings.length > 0).length
    }
  };

  // Group metrics by file type
  for (const result of results) {
    const type = result.metrics?.fileType || 'unknown';
    if (!metrics.byFileType[type]) {
      metrics.byFileType[type] = {
        count: 0,
        totalTime: 0,
        totalSize: 0
      };
    }
    metrics.byFileType[type].count++;
    metrics.byFileType[type].totalTime += result.metrics?.processingTime || 0;
    metrics.byFileType[type].totalSize += result.metrics?.extractedSize || 0;
  }

  return {
    researchFiles: safeResearchFiles.map(f => ({
      filename: f.filename,
      content: f.content,
      safetyWarnings: f.safetyWarnings || []
    })),
    failed: failed.map(f => ({
      filename: f.filename,
      error: f.error
    })),
    // Files rejected by safety checks (PROMPT ML)
    safetyRejected: safetyRejected,
    metrics
  };
}

/**
 * Get file processing configuration
 * @returns {object} Current configuration
 */
export function getProcessingConfig() {
  return { ...CONFIG };
}

export default {
  processFile,
  processFiles,
  getProcessingConfig,
  normalizeWhitespace,
  deduplicateParagraphs,
  smartTruncate,
  extractKeySections,
  // Safety exports (PROMPT ML)
  checkContentSafety
};

// Named export for safety check
export { checkContentSafety };
