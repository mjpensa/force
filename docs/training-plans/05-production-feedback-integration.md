# Implementation Plan: Production Feedback Integration

## Problem Statement

The current training system uses simulated feedback, which can never truly represent real user preferences and behaviors. Without production feedback integration:
1. Quality scores may not correlate with actual user satisfaction
2. Edge cases that matter to users are unknown
3. Domain-specific preferences are not captured
4. Model improvements cannot be validated against real usage

## Current State

```javascript
// All feedback is simulated
const feedback = {
  rating: Math.floor(Math.random() * 5) + 1,
  wasExported: Math.random() > 0.7,
  wasEdited: Math.random() > 0.6,
  wasRegenerated: Math.random() > 0.85,
  thumbsUp: Math.random() > 0.5 ? (Math.random() > 0.3) : null
};
```

## Goal

Create a production feedback pipeline that:
1. Captures real user interactions with generated content
2. Stores feedback with generation context for training
3. Enables hybrid training (simulated + real feedback)
4. Provides analytics on quality-feedback correlations

---

## Phase 1: Feedback Event Schema

### Objective
Define the data model for capturing production feedback.

### Implementation

```javascript
// feedbackSchema.js

const FeedbackEventSchema = {
  // Core identifiers
  eventId: 'string',           // Unique event ID
  generationId: 'string',      // Links to original generation
  userId: 'string',            // Anonymized user ID
  sessionId: 'string',         // Session context

  // Timing
  timestamp: 'datetime',       // When feedback occurred
  generatedAt: 'datetime',     // When content was generated
  timeToFeedback: 'number',    // Seconds between generation and feedback

  // Content context
  contentType: 'enum',         // Roadmap, Slides, Document, ResearchAnalysis
  promptVariant: 'string',     // Which prompt variant was used
  inputSummary: 'string',      // Hashed/summarized user input

  // Explicit feedback
  rating: 'number|null',       // 1-5 explicit rating
  thumbsUp: 'boolean|null',    // Thumbs up/down
  feedbackText: 'string|null', // Optional written feedback

  // Implicit feedback (behavioral)
  exported: 'boolean',         // User exported content
  exportFormat: 'string|null', // PDF, PPTX, etc.
  edited: 'boolean',           // User made edits
  editCount: 'number',         // Number of edit operations
  editMagnitude: 'number',     // Percentage of content changed
  regenerated: 'boolean',      // User regenerated
  regenerateCount: 'number',   // Number of regenerations
  viewDuration: 'number',      // Seconds spent viewing
  scrollDepth: 'number',       // Percentage scrolled

  // Quality metrics (captured at generation time)
  qualityScore: 'number',      // Our quality score
  qualityDimensions: 'object', // Dimension breakdown

  // Generation metadata
  modelVersion: 'string',      // Which model was used
  promptVersion: 'string',     // Which prompt version
  generationLatency: 'number'  // How long generation took
};

const FeedbackEventValidation = {
  required: ['eventId', 'generationId', 'timestamp', 'contentType'],

  validate(event) {
    const errors = [];

    for (const field of this.required) {
      if (event[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (event.rating !== null && (event.rating < 1 || event.rating > 5)) {
      errors.push('Rating must be between 1 and 5');
    }

    if (event.editMagnitude && (event.editMagnitude < 0 || event.editMagnitude > 1)) {
      errors.push('editMagnitude must be between 0 and 1');
    }

    return { valid: errors.length === 0, errors };
  }
};
```

---

## Phase 2: Client-Side Event Capture

### Objective
Implement frontend tracking of user interactions with generated content.

### Implementation

```javascript
// feedbackCapture.js (client-side)

class FeedbackTracker {
  constructor(generationId, contentType) {
    this.generationId = generationId;
    this.contentType = contentType;
    this.sessionId = this.getSessionId();
    this.startTime = Date.now();
    this.events = [];
    this.editHistory = [];

    this.initializeTracking();
  }

  initializeTracking() {
    // Track scroll depth
    this.maxScrollDepth = 0;
    window.addEventListener('scroll', this.throttle(() => {
      const depth = this.calculateScrollDepth();
      this.maxScrollDepth = Math.max(this.maxScrollDepth, depth);
    }, 100));

    // Track visibility/view duration
    this.visibleDuration = 0;
    this.setupVisibilityTracking();

    // Track on page unload
    window.addEventListener('beforeunload', () => this.flush());
  }

  calculateScrollDepth() {
    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    return docHeight > 0 ? scrollTop / docHeight : 1;
  }

  setupVisibilityTracking() {
    let lastVisible = Date.now();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.visibleDuration += Date.now() - lastVisible;
      } else {
        lastVisible = Date.now();
      }
    });
  }

  // Explicit feedback methods
  recordRating(rating) {
    this.events.push({
      type: 'explicit_rating',
      rating,
      timestamp: Date.now()
    });
    this.sendEvent({ rating });
  }

  recordThumbs(isUp) {
    this.events.push({
      type: 'thumbs',
      thumbsUp: isUp,
      timestamp: Date.now()
    });
    this.sendEvent({ thumbsUp: isUp });
  }

  recordFeedbackText(text) {
    this.events.push({
      type: 'feedback_text',
      text: text.substring(0, 500),  // Limit length
      timestamp: Date.now()
    });
    this.sendEvent({ feedbackText: text });
  }

  // Implicit feedback methods
  recordExport(format) {
    this.events.push({
      type: 'export',
      format,
      timestamp: Date.now()
    });
    this.sendEvent({ exported: true, exportFormat: format });
  }

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

  recordRegenerate() {
    this.regenerateCount = (this.regenerateCount || 0) + 1;
    this.events.push({
      type: 'regenerate',
      count: this.regenerateCount,
      timestamp: Date.now()
    });
    this.sendEvent({ regenerated: true, regenerateCount: this.regenerateCount });
  }

  calculateEditMagnitude(original, modified) {
    // Simple diff-based magnitude calculation
    const originalWords = original.split(/\s+/);
    const modifiedWords = modified.split(/\s+/);

    const originalSet = new Set(originalWords);
    const modifiedSet = new Set(modifiedWords);

    let unchanged = 0;
    for (const word of modifiedWords) {
      if (originalSet.has(word)) unchanged++;
    }

    return 1 - (unchanged / Math.max(originalWords.length, modifiedWords.length));
  }

  getTotalEditMagnitude() {
    if (this.editHistory.length === 0) return 0;
    return this.editHistory.reduce((sum, e) => sum + e.magnitude, 0) / this.editHistory.length;
  }

  buildFeedbackEvent(overrides = {}) {
    return {
      eventId: this.generateEventId(),
      generationId: this.generationId,
      sessionId: this.sessionId,
      contentType: this.contentType,
      timestamp: new Date().toISOString(),
      timeToFeedback: (Date.now() - this.startTime) / 1000,
      viewDuration: this.visibleDuration / 1000,
      scrollDepth: this.maxScrollDepth,
      ...overrides
    };
  }

  async sendEvent(data) {
    const event = this.buildFeedbackEvent(data);

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    } catch (error) {
      // Queue for retry
      this.pendingEvents = this.pendingEvents || [];
      this.pendingEvents.push(event);
    }
  }

  flush() {
    // Send final summary on page leave
    this.sendEvent({
      type: 'session_end',
      finalViewDuration: (this.visibleDuration + (Date.now() - this.lastVisible || 0)) / 1000,
      finalScrollDepth: this.maxScrollDepth,
      totalEdits: this.editHistory.length
    });
  }

  throttle(fn, delay) {
    let lastCall = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    };
  }

  generateEventId() {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getSessionId() {
    let sessionId = sessionStorage.getItem('feedbackSessionId');
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('feedbackSessionId', sessionId);
    }
    return sessionId;
  }
}

// Usage
export function initFeedbackTracking(generationId, contentType) {
  return new FeedbackTracker(generationId, contentType);
}
```

---

## Phase 3: Server-Side Feedback Storage

### Objective
Build the API and storage layer for feedback events.

### Implementation

```javascript
// feedbackStorage.js

import { v4 as uuidv4 } from 'uuid';

class FeedbackStore {
  constructor() {
    this.events = [];  // In-memory for now
    this.aggregates = {};  // Pre-computed aggregates
    this.generationIndex = {};  // generationId -> events[]
  }

  async store(event) {
    // Validate
    const validation = FeedbackEventValidation.validate(event);
    if (!validation.valid) {
      throw new Error(`Invalid feedback event: ${validation.errors.join(', ')}`);
    }

    // Enrich with server-side data
    const enrichedEvent = {
      ...event,
      storedAt: new Date().toISOString(),
      eventId: event.eventId || uuidv4()
    };

    // Store
    this.events.push(enrichedEvent);

    // Index by generation
    if (!this.generationIndex[event.generationId]) {
      this.generationIndex[event.generationId] = [];
    }
    this.generationIndex[event.generationId].push(enrichedEvent);

    // Update aggregates
    this.updateAggregates(enrichedEvent);

    return enrichedEvent;
  }

  updateAggregates(event) {
    const key = `${event.contentType}_${event.promptVariant || 'unknown'}`;

    if (!this.aggregates[key]) {
      this.aggregates[key] = {
        contentType: event.contentType,
        promptVariant: event.promptVariant,
        totalEvents: 0,
        ratings: [],
        exportRate: { count: 0, total: 0 },
        editRate: { count: 0, total: 0 },
        regenerateRate: { count: 0, total: 0 },
        thumbsUp: { up: 0, down: 0, total: 0 },
        avgViewDuration: { sum: 0, count: 0 },
        avgQualityScore: { sum: 0, count: 0 }
      };
    }

    const agg = this.aggregates[key];
    agg.totalEvents++;

    if (event.rating !== null && event.rating !== undefined) {
      agg.ratings.push(event.rating);
    }

    if (event.exported !== undefined) {
      agg.exportRate.total++;
      if (event.exported) agg.exportRate.count++;
    }

    if (event.edited !== undefined) {
      agg.editRate.total++;
      if (event.edited) agg.editRate.count++;
    }

    if (event.regenerated !== undefined) {
      agg.regenerateRate.total++;
      if (event.regenerated) agg.regenerateRate.count++;
    }

    if (event.thumbsUp !== null && event.thumbsUp !== undefined) {
      agg.thumbsUp.total++;
      if (event.thumbsUp) agg.thumbsUp.up++;
      else agg.thumbsUp.down++;
    }

    if (event.viewDuration) {
      agg.avgViewDuration.sum += event.viewDuration;
      agg.avgViewDuration.count++;
    }

    if (event.qualityScore) {
      agg.avgQualityScore.sum += event.qualityScore;
      agg.avgQualityScore.count++;
    }
  }

  getAggregates(contentType, promptVariant) {
    const key = `${contentType}_${promptVariant || 'unknown'}`;
    const agg = this.aggregates[key];

    if (!agg) return null;

    return {
      ...agg,
      avgRating: agg.ratings.length > 0
        ? agg.ratings.reduce((a, b) => a + b, 0) / agg.ratings.length
        : null,
      exportRate: agg.exportRate.total > 0
        ? agg.exportRate.count / agg.exportRate.total
        : null,
      editRate: agg.editRate.total > 0
        ? agg.editRate.count / agg.editRate.total
        : null,
      regenerateRate: agg.regenerateRate.total > 0
        ? agg.regenerateRate.count / agg.regenerateRate.total
        : null,
      thumbsUpRate: agg.thumbsUp.total > 0
        ? agg.thumbsUp.up / agg.thumbsUp.total
        : null,
      avgViewDuration: agg.avgViewDuration.count > 0
        ? agg.avgViewDuration.sum / agg.avgViewDuration.count
        : null,
      avgQualityScore: agg.avgQualityScore.count > 0
        ? agg.avgQualityScore.sum / agg.avgQualityScore.count
        : null
    };
  }

  getEventsForGeneration(generationId) {
    return this.generationIndex[generationId] || [];
  }

  getRecentEvents(count = 100) {
    return this.events.slice(-count);
  }

  exportForTraining(options = {}) {
    const { minRating, contentType, sinceDate } = options;

    return this.events.filter(e => {
      if (minRating && (e.rating === null || e.rating < minRating)) return false;
      if (contentType && e.contentType !== contentType) return false;
      if (sinceDate && new Date(e.timestamp) < new Date(sinceDate)) return false;
      return true;
    });
  }
}

export const feedbackStore = new FeedbackStore();
```

---

## Phase 4: Feedback API Endpoint

### Objective
Create the REST API for receiving and querying feedback.

### Implementation

```javascript
// routes/feedback.js

import express from 'express';
import { feedbackStore } from '../utils/feedbackStorage.js';

const router = express.Router();

// Receive feedback events
router.post('/', async (req, res) => {
  try {
    const event = req.body;

    // Add request metadata
    event.clientIp = req.ip;
    event.userAgent = req.headers['user-agent'];

    const stored = await feedbackStore.store(event);

    res.json({ success: true, eventId: stored.eventId });
  } catch (error) {
    console.error('Feedback storage error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get aggregates for a content type/variant
router.get('/aggregates/:contentType', (req, res) => {
  const { contentType } = req.params;
  const { variant } = req.query;

  const aggregates = feedbackStore.getAggregates(contentType, variant);

  if (!aggregates) {
    return res.json({ success: true, data: null, message: 'No data yet' });
  }

  res.json({ success: true, data: aggregates });
});

// Get events for a specific generation
router.get('/generation/:generationId', (req, res) => {
  const { generationId } = req.params;
  const events = feedbackStore.getEventsForGeneration(generationId);

  res.json({ success: true, events });
});

// Export feedback for training
router.get('/export', (req, res) => {
  const options = {
    minRating: req.query.minRating ? parseInt(req.query.minRating) : null,
    contentType: req.query.contentType,
    sinceDate: req.query.since
  };

  const events = feedbackStore.exportForTraining(options);

  res.json({
    success: true,
    count: events.length,
    events
  });
});

// Dashboard stats
router.get('/stats', (req, res) => {
  const stats = {
    totalEvents: feedbackStore.events.length,
    byContentType: {},
    recentEvents: feedbackStore.getRecentEvents(10)
  };

  for (const contentType of ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis']) {
    stats.byContentType[contentType] = feedbackStore.getAggregates(contentType);
  }

  res.json({ success: true, stats });
});

export default router;
```

---

## Phase 5: Hybrid Training Integration

### Objective
Enable training loop to use both simulated and real feedback.

### Implementation

```javascript
// hybridFeedback.js

import { feedbackStore } from './feedbackStorage.js';
import { calculateRealisticFeedback } from './feedbackSimulation.js';

class HybridFeedbackManager {
  constructor(options = {}) {
    this.productionWeight = options.productionWeight || 0.7;
    this.minProductionSamples = options.minProductionSamples || 10;
    this.fallbackToSimulated = options.fallbackToSimulated !== false;
  }

  async getFeedback(generationId, contentType, qualityScore, promptVariant) {
    // Check for production feedback
    const productionEvents = feedbackStore.getEventsForGeneration(generationId);

    if (productionEvents.length > 0) {
      // Use actual production feedback
      return this.aggregateProductionFeedback(productionEvents);
    }

    // Check for similar productions with feedback
    const similarFeedback = await this.findSimilarFeedback(contentType, promptVariant, qualityScore);

    if (similarFeedback && similarFeedback.sampleCount >= this.minProductionSamples) {
      // Blend production patterns with simulated
      return this.blendFeedback(similarFeedback, qualityScore, contentType);
    }

    // Fall back to simulated
    if (this.fallbackToSimulated) {
      return calculateRealisticFeedback(qualityScore, contentType);
    }

    return null;
  }

  aggregateProductionFeedback(events) {
    const result = {
      rating: null,
      qualityScore: null,
      wasExported: false,
      wasEdited: false,
      wasRegenerated: false,
      thumbsUp: null,
      source: 'production'
    };

    const ratings = events.filter(e => e.rating != null).map(e => e.rating);
    if (ratings.length > 0) {
      result.rating = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
    }

    result.wasExported = events.some(e => e.exported);
    result.wasEdited = events.some(e => e.edited);
    result.wasRegenerated = events.some(e => e.regenerated);

    const thumbs = events.filter(e => e.thumbsUp != null);
    if (thumbs.length > 0) {
      const upCount = thumbs.filter(e => e.thumbsUp).length;
      result.thumbsUp = upCount / thumbs.length > 0.5;
    }

    const qualities = events.filter(e => e.qualityScore != null).map(e => e.qualityScore);
    if (qualities.length > 0) {
      result.qualityScore = qualities.reduce((a, b) => a + b, 0) / qualities.length;
    }

    return result;
  }

  async findSimilarFeedback(contentType, promptVariant, qualityScore) {
    const aggregates = feedbackStore.getAggregates(contentType, promptVariant);

    if (!aggregates) return null;

    return {
      sampleCount: aggregates.totalEvents,
      avgRating: aggregates.avgRating,
      exportRate: aggregates.exportRate,
      editRate: aggregates.editRate,
      regenerateRate: aggregates.regenerateRate,
      thumbsUpRate: aggregates.thumbsUpRate
    };
  }

  blendFeedback(productionPatterns, qualityScore, contentType) {
    // Start with simulated
    const simulated = calculateRealisticFeedback(qualityScore, contentType);

    // Blend with production patterns
    const blended = { ...simulated, source: 'blended' };

    // Adjust rating toward production average
    if (productionPatterns.avgRating !== null) {
      const diff = productionPatterns.avgRating - simulated.rating;
      blended.rating = Math.round(simulated.rating + diff * this.productionWeight);
      blended.rating = Math.max(1, Math.min(5, blended.rating));
    }

    // Adjust behavioral probabilities
    if (productionPatterns.exportRate !== null) {
      const baseProb = simulated.wasExported ? 0.7 : 0.3;
      const adjustedProb = baseProb + (productionPatterns.exportRate - 0.5) * this.productionWeight;
      blended.wasExported = Math.random() < adjustedProb;
    }

    if (productionPatterns.editRate !== null) {
      const baseProb = simulated.wasEdited ? 0.7 : 0.3;
      const adjustedProb = baseProb + (productionPatterns.editRate - 0.5) * this.productionWeight;
      blended.wasEdited = Math.random() < adjustedProb;
    }

    if (productionPatterns.regenerateRate !== null) {
      const baseProb = simulated.wasRegenerated ? 0.7 : 0.3;
      const adjustedProb = baseProb + (productionPatterns.regenerateRate - 0.5) * this.productionWeight;
      blended.wasRegenerated = Math.random() < adjustedProb;
    }

    return blended;
  }

  getProductionCoverage() {
    const coverage = {};

    for (const contentType of ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis']) {
      const agg = feedbackStore.getAggregates(contentType);
      coverage[contentType] = {
        hasSufficientData: agg && agg.totalEvents >= this.minProductionSamples,
        sampleCount: agg?.totalEvents || 0,
        avgRating: agg?.avgRating || null
      };
    }

    return coverage;
  }
}

export const hybridFeedback = new HybridFeedbackManager();
```

---

## Phase 6: Quality-Feedback Correlation Analysis

### Objective
Analyze how well our quality scores predict user satisfaction.

### Implementation

```javascript
// feedbackAnalytics.js

class FeedbackAnalytics {
  constructor(feedbackStore) {
    this.store = feedbackStore;
  }

  calculateQualityFeedbackCorrelation() {
    const events = this.store.events.filter(e =>
      e.qualityScore != null && e.rating != null
    );

    if (events.length < 10) {
      return { correlation: null, message: 'Insufficient data' };
    }

    // Calculate Pearson correlation
    const n = events.length;
    const sumX = events.reduce((s, e) => s + e.qualityScore, 0);
    const sumY = events.reduce((s, e) => s + e.rating, 0);
    const sumXY = events.reduce((s, e) => s + e.qualityScore * e.rating, 0);
    const sumX2 = events.reduce((s, e) => s + e.qualityScore ** 2, 0);
    const sumY2 = events.reduce((s, e) => s + e.rating ** 2, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2)
    );

    const correlation = denominator !== 0 ? numerator / denominator : 0;

    return {
      correlation: correlation.toFixed(3),
      sampleSize: n,
      interpretation: this.interpretCorrelation(correlation),
      avgQualityScore: (sumX / n).toFixed(2),
      avgRating: (sumY / n).toFixed(2)
    };
  }

  interpretCorrelation(r) {
    const abs = Math.abs(r);
    if (abs >= 0.7) return 'Strong correlation - quality scores predict user satisfaction well';
    if (abs >= 0.4) return 'Moderate correlation - quality scores somewhat predict satisfaction';
    if (abs >= 0.2) return 'Weak correlation - quality scores poorly predict satisfaction';
    return 'No correlation - quality scores do not predict satisfaction';
  }

  identifyQualityGaps() {
    // Find cases where quality was high but feedback was poor (or vice versa)
    const gaps = [];

    for (const event of this.store.events) {
      if (event.qualityScore == null || event.rating == null) continue;

      const qualityNorm = (event.qualityScore - 1) / 4;  // Normalize to 0-1
      const ratingNorm = (event.rating - 1) / 4;
      const gap = qualityNorm - ratingNorm;

      if (Math.abs(gap) > 0.4) {  // Significant discrepancy
        gaps.push({
          generationId: event.generationId,
          contentType: event.contentType,
          qualityScore: event.qualityScore,
          rating: event.rating,
          gap: gap.toFixed(2),
          type: gap > 0 ? 'quality_overestimate' : 'quality_underestimate'
        });
      }
    }

    return {
      totalGaps: gaps.length,
      overestimates: gaps.filter(g => g.type === 'quality_overestimate').length,
      underestimates: gaps.filter(g => g.type === 'quality_underestimate').length,
      examples: gaps.slice(0, 10)
    };
  }

  getDimensionImpact() {
    // Analyze which quality dimensions best predict user satisfaction
    const dimensionCorrelations = {};

    const eventsWithDimensions = this.store.events.filter(e =>
      e.qualityDimensions && e.rating != null
    );

    if (eventsWithDimensions.length < 20) {
      return { message: 'Insufficient data for dimension analysis' };
    }

    // Get all dimension names from first event
    const dimensions = Object.keys(eventsWithDimensions[0].qualityDimensions);

    for (const dim of dimensions) {
      const dimValues = eventsWithDimensions.map(e => e.qualityDimensions[dim]);
      const ratings = eventsWithDimensions.map(e => e.rating);

      const correlation = this.pearsonCorrelation(dimValues, ratings);
      dimensionCorrelations[dim] = correlation.toFixed(3);
    }

    // Sort by correlation strength
    const sorted = Object.entries(dimensionCorrelations)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    return {
      sampleSize: eventsWithDimensions.length,
      byImpact: Object.fromEntries(sorted),
      mostImpactful: sorted.slice(0, 3).map(([dim, corr]) => ({ dimension: dim, correlation: corr })),
      leastImpactful: sorted.slice(-3).map(([dim, corr]) => ({ dimension: dim, correlation: corr }))
    };
  }

  pearsonCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0);
    const sumX2 = x.reduce((s, xi) => s + xi ** 2, 0);
    const sumY2 = y.reduce((s, yi) => s + yi ** 2, 0);

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));

    return den !== 0 ? num / den : 0;
  }

  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      totalFeedbackEvents: this.store.events.length,
      qualityFeedbackCorrelation: this.calculateQualityFeedbackCorrelation(),
      qualityGaps: this.identifyQualityGaps(),
      dimensionImpact: this.getDimensionImpact(),
      coverage: new HybridFeedbackManager().getProductionCoverage()
    };
  }
}

export const feedbackAnalytics = new FeedbackAnalytics(feedbackStore);
```

---

## Success Criteria

1. **Event Capture**: All user interactions captured without impacting UX
2. **Data Quality**: > 90% of events pass validation
3. **Latency**: Feedback submission < 100ms
4. **Correlation Analysis**: Quality-feedback correlation calculable with 50+ events
5. **Hybrid Training**: Seamless fallback between production and simulated feedback
6. **Privacy**: No PII stored, user IDs anonymized

---

## Files to Create/Modify

- `/client/utils/feedbackCapture.js` - Client-side tracking
- `/server/utils/feedbackStorage.js` - Feedback storage
- `/server/utils/feedbackSchema.js` - Event schema
- `/server/utils/hybridFeedback.js` - Hybrid feedback manager
- `/server/utils/feedbackAnalytics.js` - Correlation analysis
- `/server/routes/feedback.js` - Feedback API
- `/server/routes/training.js` - Integration with training loop

---

## Estimated Complexity

- Phase 1: Low (schema design)
- Phase 2: High (client-side tracking)
- Phase 3: Medium (storage layer)
- Phase 4: Low (API routes)
- Phase 5: High (hybrid integration)
- Phase 6: Medium (analytics)
