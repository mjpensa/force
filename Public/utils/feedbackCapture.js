/**
 * Feedback Capture - Client-Side Event Tracking
 *
 * Tracks user interactions with generated content for training feedback.
 *
 * Implementation of Plan 05: Production Feedback Integration - Phase 2
 */

// ============================================================================
// Phase 2: Client-Side Event Capture
// ============================================================================

/**
 * FeedbackTracker - Captures user interactions with generated content
 */
export class FeedbackTracker {
  /**
   * Create a new FeedbackTracker
   *
   * @param {string} generationId - ID of the generated content
   * @param {string} contentType - Type of content (Roadmap, Slides, Document, ResearchAnalysis)
   * @param {Object} options - Configuration options
   */
  constructor(generationId, contentType, options = {}) {
    this.generationId = generationId;
    this.contentType = contentType;
    this.sessionId = this.getSessionId();
    this.startTime = Date.now();
    this.events = [];
    this.editHistory = [];
    this.regenerateCount = 0;
    this.pendingEvents = [];

    // Configuration
    this.apiEndpoint = options.apiEndpoint || '/api/feedback';
    this.batchSize = options.batchSize || 5;
    this.flushInterval = options.flushInterval || 30000; // 30 seconds
    this.enableScrollTracking = options.enableScrollTracking !== false;
    this.enableVisibilityTracking = options.enableVisibilityTracking !== false;

    // State
    this.maxScrollDepth = 0;
    this.visibleDuration = 0;
    this.lastVisible = Date.now();
    this.isVisible = true;
    this.destroyed = false;

    // Store original content for edit magnitude calculation
    this.originalContent = options.originalContent || null;

    this.initializeTracking();
  }

  /**
   * Initialize all tracking mechanisms
   */
  initializeTracking() {
    if (typeof window === 'undefined') return; // Skip in Node.js

    // Track scroll depth
    if (this.enableScrollTracking) {
      this.scrollHandler = this.throttle(() => {
        if (this.destroyed) return;
        const depth = this.calculateScrollDepth();
        this.maxScrollDepth = Math.max(this.maxScrollDepth, depth);
      }, 100);
      window.addEventListener('scroll', this.scrollHandler);
    }

    // Track visibility/view duration
    if (this.enableVisibilityTracking) {
      this.visibilityHandler = () => {
        if (this.destroyed) return;
        if (document.hidden) {
          this.visibleDuration += Date.now() - this.lastVisible;
          this.isVisible = false;
        } else {
          this.lastVisible = Date.now();
          this.isVisible = true;
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    // Track on page unload
    this.unloadHandler = () => this.flush();
    window.addEventListener('beforeunload', this.unloadHandler);

    // Periodic flush
    this.flushIntervalId = setInterval(() => this.flushPending(), this.flushInterval);
  }

  /**
   * Calculate current scroll depth (0-1)
   *
   * @returns {number} Scroll depth percentage
   */
  calculateScrollDepth() {
    if (typeof window === 'undefined') return 0;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    return docHeight > 0 ? Math.min(1, scrollTop / docHeight) : 1;
  }

  // ==========================================================================
  // Explicit Feedback Methods
  // ==========================================================================

  /**
   * Record explicit star rating (1-5)
   *
   * @param {number} rating - Rating value (1-5)
   */
  recordRating(rating) {
    const clampedRating = Math.max(1, Math.min(5, Math.round(rating)));
    this.events.push({
      type: 'explicit_rating',
      rating: clampedRating,
      timestamp: Date.now()
    });
    this.sendEvent({ rating: clampedRating });
  }

  /**
   * Record thumbs up/down
   *
   * @param {boolean} isUp - True for thumbs up, false for thumbs down
   */
  recordThumbs(isUp) {
    this.events.push({
      type: 'thumbs',
      thumbsUp: isUp,
      timestamp: Date.now()
    });
    this.sendEvent({ thumbsUp: isUp });
  }

  /**
   * Record written feedback text
   *
   * @param {string} text - Feedback text
   */
  recordFeedbackText(text) {
    const truncated = text.substring(0, 500);
    this.events.push({
      type: 'feedback_text',
      text: truncated,
      timestamp: Date.now()
    });
    this.sendEvent({ feedbackText: truncated });
  }

  // ==========================================================================
  // Implicit Feedback Methods (Behavioral)
  // ==========================================================================

  /**
   * Record content export
   *
   * @param {string} format - Export format (PDF, PPTX, etc.)
   */
  recordExport(format) {
    this.events.push({
      type: 'export',
      format,
      timestamp: Date.now()
    });
    this.sendEvent({ exported: true, exportFormat: format });
  }

  /**
   * Record content edit
   *
   * @param {string} originalContent - Content before edit
   * @param {string} newContent - Content after edit
   */
  recordEdit(originalContent, newContent) {
    const editMagnitude = this.calculateEditMagnitude(originalContent, newContent);
    this.editHistory.push({
      magnitude: editMagnitude,
      timestamp: Date.now()
    });

    this.sendEvent({
      edited: true,
      editCount: this.editHistory.length,
      editMagnitude: this.getTotalEditMagnitude()
    });
  }

  /**
   * Record content regeneration
   */
  recordRegenerate() {
    this.regenerateCount++;
    this.events.push({
      type: 'regenerate',
      count: this.regenerateCount,
      timestamp: Date.now()
    });
    this.sendEvent({
      regenerated: true,
      regenerateCount: this.regenerateCount
    });
  }

  /**
   * Record section collapse/expand
   *
   * @param {string} sectionId - ID of the section
   * @param {boolean} isExpanded - Whether section was expanded
   */
  recordSectionToggle(sectionId, isExpanded) {
    this.events.push({
      type: 'section_toggle',
      sectionId,
      isExpanded,
      timestamp: Date.now()
    });
  }

  /**
   * Record copy action
   *
   * @param {string} contentType - What was copied (text, section, etc.)
   */
  recordCopy(contentType) {
    this.events.push({
      type: 'copy',
      contentType,
      timestamp: Date.now()
    });
    this.sendEvent({ copiedContent: true });
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Calculate edit magnitude between two content strings
   *
   * @param {string} original - Original content
   * @param {string} modified - Modified content
   * @returns {number} Edit magnitude (0-1)
   */
  calculateEditMagnitude(original, modified) {
    if (!original || !modified) return 0;

    const originalWords = original.split(/\s+/).filter(w => w.length > 0);
    const modifiedWords = modified.split(/\s+/).filter(w => w.length > 0);

    if (originalWords.length === 0 && modifiedWords.length === 0) return 0;
    if (originalWords.length === 0) return 1;

    const originalSet = new Set(originalWords);
    let unchanged = 0;
    for (const word of modifiedWords) {
      if (originalSet.has(word)) unchanged++;
    }

    return 1 - (unchanged / Math.max(originalWords.length, modifiedWords.length));
  }

  /**
   * Get average edit magnitude across all edits
   *
   * @returns {number} Average edit magnitude
   */
  getTotalEditMagnitude() {
    if (this.editHistory.length === 0) return 0;
    return this.editHistory.reduce((sum, e) => sum + e.magnitude, 0) / this.editHistory.length;
  }

  /**
   * Get current visible duration in seconds
   *
   * @returns {number} Visible duration in seconds
   */
  getCurrentViewDuration() {
    let duration = this.visibleDuration;
    if (this.isVisible) {
      duration += Date.now() - this.lastVisible;
    }
    return duration / 1000;
  }

  /**
   * Build a feedback event with current state
   *
   * @param {Object} overrides - Additional fields to include
   * @returns {Object} Feedback event
   */
  buildFeedbackEvent(overrides = {}) {
    return {
      eventId: this.generateEventId(),
      generationId: this.generationId,
      sessionId: this.sessionId,
      contentType: this.contentType,
      timestamp: new Date().toISOString(),
      timeToFeedback: (Date.now() - this.startTime) / 1000,
      viewDuration: this.getCurrentViewDuration(),
      scrollDepth: this.maxScrollDepth,
      ...overrides
    };
  }

  /**
   * Send feedback event to server
   *
   * @param {Object} data - Event data
   */
  async sendEvent(data) {
    const event = this.buildFeedbackEvent(data);

    // Add to pending queue
    this.pendingEvents.push(event);

    // Flush if batch size reached
    if (this.pendingEvents.length >= this.batchSize) {
      await this.flushPending();
    }
  }

  /**
   * Flush pending events to server
   */
  async flushPending() {
    if (this.pendingEvents.length === 0) return;

    const eventsToSend = [...this.pendingEvents];
    this.pendingEvents = [];

    for (const event of eventsToSend) {
      try {
        if (typeof fetch !== 'undefined') {
          await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
          });
        }
      } catch (error) {
        // Queue for retry
        this.pendingEvents.push(event);
        console.warn('Failed to send feedback event:', error.message);
      }
    }
  }

  /**
   * Flush final state on page leave
   */
  flush() {
    if (this.destroyed) return;

    // Send final summary
    const finalEvent = this.buildFeedbackEvent({
      type: 'session_end',
      finalViewDuration: this.getCurrentViewDuration(),
      finalScrollDepth: this.maxScrollDepth,
      totalEdits: this.editHistory.length,
      totalRegenerates: this.regenerateCount
    });

    // Use sendBeacon for reliability on page unload
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        this.apiEndpoint,
        JSON.stringify(finalEvent)
      );
    } else {
      this.pendingEvents.push(finalEvent);
      this.flushPending();
    }
  }

  /**
   * Clean up event listeners and timers
   */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    // Flush any pending events
    this.flush();

    // Remove event listeners
    if (typeof window !== 'undefined') {
      if (this.scrollHandler) {
        window.removeEventListener('scroll', this.scrollHandler);
      }
      if (this.unloadHandler) {
        window.removeEventListener('beforeunload', this.unloadHandler);
      }
    }
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }

    // Clear interval
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Throttle function calls
   *
   * @param {Function} fn - Function to throttle
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Throttled function
   */
  throttle(fn, delay) {
    let lastCall = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn.apply(this, args);
      }
    };
  }

  /**
   * Generate unique event ID
   *
   * @returns {string} Unique event ID
   */
  generateEventId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `fb_${timestamp}_${random}`;
  }

  /**
   * Get or create session ID
   *
   * @returns {string} Session ID
   */
  getSessionId() {
    if (typeof sessionStorage === 'undefined') {
      return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    let sessionId = sessionStorage.getItem('feedbackSessionId');
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('feedbackSessionId', sessionId);
    }
    return sessionId;
  }

  /**
   * Get summary of tracked events
   *
   * @returns {Object} Event summary
   */
  getSummary() {
    return {
      generationId: this.generationId,
      contentType: this.contentType,
      sessionId: this.sessionId,
      duration: this.getCurrentViewDuration(),
      scrollDepth: this.maxScrollDepth,
      editCount: this.editHistory.length,
      regenerateCount: this.regenerateCount,
      eventCount: this.events.length,
      pendingEvents: this.pendingEvents.length
    };
  }
}

/**
 * Initialize feedback tracking for a generation
 *
 * @param {string} generationId - ID of the generated content
 * @param {string} contentType - Type of content
 * @param {Object} options - Configuration options
 * @returns {FeedbackTracker} Tracker instance
 */
export function initFeedbackTracking(generationId, contentType, options = {}) {
  return new FeedbackTracker(generationId, contentType, options);
}

// ============================================================================
// React/Vue Integration Helpers
// ============================================================================

/**
 * Create a feedback tracker hook factory (for React)
 *
 * @param {string} generationId - Generation ID
 * @param {string} contentType - Content type
 * @returns {Object} Hook-compatible tracker methods
 */
export function createFeedbackHook(generationId, contentType) {
  let tracker = null;

  return {
    init(options = {}) {
      if (!tracker) {
        tracker = new FeedbackTracker(generationId, contentType, options);
      }
      return tracker;
    },
    recordRating: (rating) => tracker?.recordRating(rating),
    recordThumbs: (isUp) => tracker?.recordThumbs(isUp),
    recordFeedbackText: (text) => tracker?.recordFeedbackText(text),
    recordExport: (format) => tracker?.recordExport(format),
    recordEdit: (original, newContent) => tracker?.recordEdit(original, newContent),
    recordRegenerate: () => tracker?.recordRegenerate(),
    getSummary: () => tracker?.getSummary(),
    destroy: () => {
      tracker?.destroy();
      tracker = null;
    }
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Phase 2 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase2() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: FeedbackTracker instantiation
  const tracker = new FeedbackTracker('gen_test', 'Roadmap', {
    enableScrollTracking: false,
    enableVisibilityTracking: false
  });
  results.tests.push({
    name: 'FeedbackTracker instantiates correctly',
    passed: tracker.generationId === 'gen_test' && tracker.contentType === 'Roadmap',
    details: `generationId=${tracker.generationId}, contentType=${tracker.contentType}`
  });

  // Test 2: Session ID generation
  const sessionId = tracker.sessionId;
  results.tests.push({
    name: 'Session ID is generated',
    passed: sessionId && sessionId.startsWith('sess_'),
    details: `sessionId=${sessionId}`
  });

  // Test 3: Event ID generation
  const eventId1 = tracker.generateEventId();
  const eventId2 = tracker.generateEventId();
  results.tests.push({
    name: 'Event IDs are unique',
    passed: eventId1 !== eventId2 && eventId1.startsWith('fb_'),
    details: `id1=${eventId1}, id2=${eventId2}`
  });

  // Test 4: Rating recording
  tracker.recordRating(4);
  results.tests.push({
    name: 'Rating is recorded',
    passed: tracker.events.some(e => e.type === 'explicit_rating' && e.rating === 4),
    details: `events=${tracker.events.length}`
  });

  // Test 5: Thumbs recording
  tracker.recordThumbs(true);
  results.tests.push({
    name: 'Thumbs is recorded',
    passed: tracker.events.some(e => e.type === 'thumbs' && e.thumbsUp === true),
    details: `thumbsEvent found`
  });

  // Test 6: Export recording
  tracker.recordExport('PDF');
  results.tests.push({
    name: 'Export is recorded',
    passed: tracker.events.some(e => e.type === 'export' && e.format === 'PDF'),
    details: `exportEvent found`
  });

  // Test 7: Regenerate recording
  tracker.recordRegenerate();
  tracker.recordRegenerate();
  results.tests.push({
    name: 'Regenerate is counted correctly',
    passed: tracker.regenerateCount === 2,
    details: `regenerateCount=${tracker.regenerateCount}`
  });

  // Test 8: Edit magnitude calculation
  const magnitude = tracker.calculateEditMagnitude(
    'The quick brown fox',
    'The slow brown fox'
  );
  results.tests.push({
    name: 'Edit magnitude calculates correctly',
    passed: magnitude > 0 && magnitude < 1,
    details: `magnitude=${magnitude.toFixed(3)}`
  });

  // Test 9: Edit recording
  tracker.recordEdit('original content', 'modified content');
  results.tests.push({
    name: 'Edit is recorded with magnitude',
    passed: tracker.editHistory.length === 1 && tracker.editHistory[0].magnitude > 0,
    details: `editCount=${tracker.editHistory.length}`
  });

  // Test 10: buildFeedbackEvent includes all fields
  const event = tracker.buildFeedbackEvent({ rating: 5 });
  results.tests.push({
    name: 'buildFeedbackEvent includes all fields',
    passed: event.eventId && event.generationId && event.sessionId && event.timestamp && event.rating === 5,
    details: `fields=${Object.keys(event).join(', ')}`
  });

  // Test 11: getSummary works
  const summary = tracker.getSummary();
  results.tests.push({
    name: 'getSummary returns correct data',
    passed: summary.editCount === 1 && summary.regenerateCount === 2 && summary.eventCount > 0,
    details: `editCount=${summary.editCount}, regenerateCount=${summary.regenerateCount}`
  });

  // Test 12: destroy works
  tracker.destroy();
  results.tests.push({
    name: 'destroy sets destroyed flag',
    passed: tracker.destroyed === true,
    details: `destroyed=${tracker.destroyed}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
  const validation = validatePhase2();
  console.log('Feedback Capture Phase 2 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
