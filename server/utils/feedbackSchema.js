/**
 * Feedback Event Schema
 *
 * Defines the data model for capturing production feedback events.
 *
 * Implementation of Plan 05: Production Feedback Integration - Phase 1
 */

// ============================================================================
// Phase 1: Feedback Event Schema
// ============================================================================

/**
 * Content types that can receive feedback
 */
export const FEEDBACK_CONTENT_TYPES = ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];

/**
 * Feedback event schema definition
 */
export const FeedbackEventSchema = {
  // Core identifiers
  eventId: 'string',           // Unique event ID (required)
  generationId: 'string',      // Links to original generation (required)
  userId: 'string',            // Anonymized user ID
  sessionId: 'string',         // Session context

  // Timing
  timestamp: 'datetime',       // When feedback occurred (required)
  generatedAt: 'datetime',     // When content was generated
  timeToFeedback: 'number',    // Seconds between generation and feedback

  // Content context
  contentType: 'enum',         // Roadmap, Slides, Document, ResearchAnalysis (required)
  promptVariant: 'string',     // Which prompt variant was used
  inputSummary: 'string',      // Hashed/summarized user input (for privacy)

  // Explicit feedback
  rating: 'number|null',       // 1-5 explicit rating
  thumbsUp: 'boolean|null',    // Thumbs up/down
  feedbackText: 'string|null', // Optional written feedback (max 500 chars)

  // Implicit feedback (behavioral)
  exported: 'boolean',         // User exported content
  exportFormat: 'string|null', // PDF, PPTX, etc.
  edited: 'boolean',           // User made edits
  editCount: 'number',         // Number of edit operations
  editMagnitude: 'number',     // Percentage of content changed (0-1)
  regenerated: 'boolean',      // User regenerated
  regenerateCount: 'number',   // Number of regenerations
  viewDuration: 'number',      // Seconds spent viewing
  scrollDepth: 'number',       // Percentage scrolled (0-1)

  // Quality metrics (captured at generation time)
  qualityScore: 'number',      // Our quality score (0-1)
  qualityDimensions: 'object', // Dimension breakdown

  // Generation metadata
  modelVersion: 'string',      // Which model was used
  promptVersion: 'string',     // Which prompt version
  generationLatency: 'number'  // How long generation took (ms)
};

/**
 * Required fields for a valid feedback event
 */
export const REQUIRED_FIELDS = ['eventId', 'generationId', 'timestamp', 'contentType'];

/**
 * Optional fields with defaults
 */
export const FIELD_DEFAULTS = {
  rating: null,
  thumbsUp: null,
  feedbackText: null,
  exported: false,
  exportFormat: null,
  edited: false,
  editCount: 0,
  editMagnitude: 0,
  regenerated: false,
  regenerateCount: 0,
  viewDuration: 0,
  scrollDepth: 0,
  qualityScore: null,
  qualityDimensions: null
};

/**
 * Feedback event validator
 */
export const FeedbackEventValidation = {
  required: REQUIRED_FIELDS,

  /**
   * Validate a feedback event
   *
   * @param {Object} event - Feedback event to validate
   * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
   */
  validate(event) {
    const errors = [];
    const warnings = [];

    // Check required fields
    for (const field of this.required) {
      if (event[field] === undefined || event[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate eventId format
    if (event.eventId && typeof event.eventId !== 'string') {
      errors.push('eventId must be a string');
    }

    // Validate generationId format
    if (event.generationId && typeof event.generationId !== 'string') {
      errors.push('generationId must be a string');
    }

    // Validate contentType
    if (event.contentType && !FEEDBACK_CONTENT_TYPES.includes(event.contentType)) {
      errors.push(`Invalid contentType: ${event.contentType}. Must be one of: ${FEEDBACK_CONTENT_TYPES.join(', ')}`);
    }

    // Validate rating (1-5 if provided)
    if (event.rating !== null && event.rating !== undefined) {
      if (typeof event.rating !== 'number' || event.rating < 1 || event.rating > 5) {
        errors.push('Rating must be a number between 1 and 5');
      }
      if (!Number.isInteger(event.rating)) {
        warnings.push('Rating should be an integer; will be rounded');
      }
    }

    // Validate thumbsUp (boolean if provided)
    if (event.thumbsUp !== null && event.thumbsUp !== undefined) {
      if (typeof event.thumbsUp !== 'boolean') {
        errors.push('thumbsUp must be a boolean');
      }
    }

    // Validate editMagnitude (0-1 if provided)
    if (event.editMagnitude !== undefined) {
      if (typeof event.editMagnitude !== 'number' || event.editMagnitude < 0 || event.editMagnitude > 1) {
        errors.push('editMagnitude must be a number between 0 and 1');
      }
    }

    // Validate scrollDepth (0-1 if provided)
    if (event.scrollDepth !== undefined) {
      if (typeof event.scrollDepth !== 'number' || event.scrollDepth < 0 || event.scrollDepth > 1) {
        errors.push('scrollDepth must be a number between 0 and 1');
      }
    }

    // Validate qualityScore (0-1 if provided)
    if (event.qualityScore !== null && event.qualityScore !== undefined) {
      if (typeof event.qualityScore !== 'number' || event.qualityScore < 0 || event.qualityScore > 1) {
        errors.push('qualityScore must be a number between 0 and 1');
      }
    }

    // Validate timestamp format
    if (event.timestamp) {
      const date = new Date(event.timestamp);
      if (isNaN(date.getTime())) {
        errors.push('timestamp must be a valid datetime string');
      }
    }

    // Validate feedbackText length
    if (event.feedbackText && event.feedbackText.length > 500) {
      warnings.push('feedbackText exceeds 500 characters; will be truncated');
    }

    // Validate numeric fields are non-negative
    const nonNegativeFields = ['timeToFeedback', 'editCount', 'regenerateCount', 'viewDuration', 'generationLatency'];
    for (const field of nonNegativeFields) {
      if (event[field] !== undefined && event[field] !== null) {
        if (typeof event[field] !== 'number' || event[field] < 0) {
          errors.push(`${field} must be a non-negative number`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  },

  /**
   * Sanitize and normalize a feedback event
   *
   * @param {Object} event - Raw feedback event
   * @returns {Object} Sanitized event
   */
  sanitize(event) {
    const sanitized = { ...event };

    // Apply defaults for missing optional fields
    for (const [field, defaultValue] of Object.entries(FIELD_DEFAULTS)) {
      if (sanitized[field] === undefined) {
        sanitized[field] = defaultValue;
      }
    }

    // Round rating to integer
    if (sanitized.rating !== null) {
      sanitized.rating = Math.round(sanitized.rating);
      sanitized.rating = Math.max(1, Math.min(5, sanitized.rating));
    }

    // Clamp values to valid ranges
    if (sanitized.editMagnitude !== null) {
      sanitized.editMagnitude = Math.max(0, Math.min(1, sanitized.editMagnitude));
    }
    if (sanitized.scrollDepth !== null) {
      sanitized.scrollDepth = Math.max(0, Math.min(1, sanitized.scrollDepth));
    }
    if (sanitized.qualityScore !== null) {
      sanitized.qualityScore = Math.max(0, Math.min(1, sanitized.qualityScore));
    }

    // Truncate feedbackText
    if (sanitized.feedbackText && sanitized.feedbackText.length > 500) {
      sanitized.feedbackText = sanitized.feedbackText.substring(0, 500);
    }

    // Ensure non-negative values
    const nonNegativeFields = ['timeToFeedback', 'editCount', 'regenerateCount', 'viewDuration', 'generationLatency'];
    for (const field of nonNegativeFields) {
      if (sanitized[field] !== undefined && sanitized[field] !== null) {
        sanitized[field] = Math.max(0, sanitized[field]);
      }
    }

    // Normalize timestamp
    if (sanitized.timestamp && typeof sanitized.timestamp === 'string') {
      sanitized.timestamp = new Date(sanitized.timestamp).toISOString();
    }

    return sanitized;
  }
};

/**
 * Create a minimal valid feedback event
 *
 * @param {string} generationId - Generation ID
 * @param {string} contentType - Content type
 * @returns {Object} Minimal feedback event
 */
export function createFeedbackEvent(generationId, contentType) {
  return {
    eventId: generateEventId(),
    generationId,
    contentType,
    timestamp: new Date().toISOString(),
    ...FIELD_DEFAULTS
  };
}

/**
 * Generate a unique event ID
 *
 * @returns {string} Unique event ID
 */
export function generateEventId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `fb_${timestamp}_${random}`;
}

/**
 * Anonymize user ID for privacy
 *
 * @param {string} userId - Original user ID
 * @param {string} salt - Optional salt for hashing
 * @returns {string} Anonymized user ID
 */
export function anonymizeUserId(userId, salt = 'feedback-salt') {
  if (!userId) return null;

  // Simple hash function (in production, use crypto.subtle.digest)
  let hash = 0;
  const combined = userId + salt;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `anon_${Math.abs(hash).toString(36)}`;
}

/**
 * Summarize user input for privacy (hash-based)
 *
 * @param {string} input - User input text
 * @returns {string} Input summary
 */
export function summarizeInput(input) {
  if (!input) return null;

  // Extract key characteristics without storing actual content
  const wordCount = input.split(/\s+/).length;
  const charCount = input.length;
  const hasNumbers = /\d/.test(input);
  const hasUrls = /https?:\/\//.test(input);

  return `words:${wordCount},chars:${charCount},hasNum:${hasNumbers},hasUrl:${hasUrls}`;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 1 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase1() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: Required fields defined
  results.tests.push({
    name: 'Required fields defined',
    passed: REQUIRED_FIELDS.length === 4,
    details: `fields=${REQUIRED_FIELDS.join(', ')}`
  });

  // Test 2: Validation catches missing required fields
  const invalidEvent = { rating: 5 };
  const validation1 = FeedbackEventValidation.validate(invalidEvent);
  results.tests.push({
    name: 'Validation catches missing required fields',
    passed: !validation1.valid && validation1.errors.length === 4,
    details: `errors=${validation1.errors.length}`
  });

  // Test 3: Validation passes for valid event
  const validEvent = {
    eventId: 'fb_test_123',
    generationId: 'gen_123',
    contentType: 'Roadmap',
    timestamp: new Date().toISOString()
  };
  const validation2 = FeedbackEventValidation.validate(validEvent);
  results.tests.push({
    name: 'Validation passes for valid event',
    passed: validation2.valid,
    details: `valid=${validation2.valid}, errors=${validation2.errors.length}`
  });

  // Test 4: Rating validation (1-5 range)
  const badRatingEvent = { ...validEvent, rating: 10 };
  const validation3 = FeedbackEventValidation.validate(badRatingEvent);
  results.tests.push({
    name: 'Rating validation enforces 1-5 range',
    passed: !validation3.valid && validation3.errors.some(e => e.includes('Rating')),
    details: `errors=${validation3.errors.join('; ')}`
  });

  // Test 5: contentType validation
  const badTypeEvent = { ...validEvent, contentType: 'Invalid' };
  const validation4 = FeedbackEventValidation.validate(badTypeEvent);
  results.tests.push({
    name: 'contentType validation enforces valid types',
    passed: !validation4.valid && validation4.errors.some(e => e.includes('contentType')),
    details: `errors=${validation4.errors.join('; ')}`
  });

  // Test 6: Sanitize applies defaults
  const minimalEvent = { ...validEvent };
  const sanitized = FeedbackEventValidation.sanitize(minimalEvent);
  results.tests.push({
    name: 'Sanitize applies defaults',
    passed: sanitized.rating === null && sanitized.exported === false && sanitized.editCount === 0,
    details: `rating=${sanitized.rating}, exported=${sanitized.exported}, editCount=${sanitized.editCount}`
  });

  // Test 7: Sanitize clamps values
  const outOfRangeEvent = { ...validEvent, rating: 10, editMagnitude: 2, scrollDepth: -0.5 };
  const sanitized2 = FeedbackEventValidation.sanitize(outOfRangeEvent);
  results.tests.push({
    name: 'Sanitize clamps out-of-range values',
    passed: sanitized2.rating === 5 && sanitized2.editMagnitude === 1 && sanitized2.scrollDepth === 0,
    details: `rating=${sanitized2.rating}, editMagnitude=${sanitized2.editMagnitude}, scrollDepth=${sanitized2.scrollDepth}`
  });

  // Test 8: generateEventId creates unique IDs
  const id1 = generateEventId();
  const id2 = generateEventId();
  results.tests.push({
    name: 'generateEventId creates unique IDs',
    passed: id1 !== id2 && id1.startsWith('fb_'),
    details: `id1=${id1}, id2=${id2}`
  });

  // Test 9: createFeedbackEvent creates valid event
  const created = createFeedbackEvent('gen_test', 'Slides');
  const validation5 = FeedbackEventValidation.validate(created);
  results.tests.push({
    name: 'createFeedbackEvent creates valid event',
    passed: validation5.valid,
    details: `valid=${validation5.valid}`
  });

  // Test 10: anonymizeUserId produces consistent results
  const anon1 = anonymizeUserId('user123');
  const anon2 = anonymizeUserId('user123');
  const anon3 = anonymizeUserId('user456');
  results.tests.push({
    name: 'anonymizeUserId is consistent and different for different users',
    passed: anon1 === anon2 && anon1 !== anon3 && anon1.startsWith('anon_'),
    details: `same=${anon1 === anon2}, different=${anon1 !== anon3}`
  });

  // Test 11: summarizeInput extracts characteristics
  const summary = summarizeInput('This is a test with 123 numbers and https://example.com');
  results.tests.push({
    name: 'summarizeInput extracts characteristics',
    passed: summary.includes('words:') && summary.includes('hasNum:true') && summary.includes('hasUrl:true'),
    details: `summary=${summary}`
  });

  // Test 12: Validation warns but doesn't fail on truncation
  const longFeedback = { ...validEvent, feedbackText: 'x'.repeat(600) };
  const validation6 = FeedbackEventValidation.validate(longFeedback);
  results.tests.push({
    name: 'Validation warns on long feedbackText',
    passed: validation6.valid && validation6.warnings.length > 0,
    details: `valid=${validation6.valid}, warnings=${validation6.warnings.length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase1();
  console.log('Feedback Schema Phase 1 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
