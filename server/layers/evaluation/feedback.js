/**
 * Feedback Collector - PROMPT ML Layer 8
 *
 * Collects and analyzes user feedback:
 * - Explicit feedback (ratings, comments)
 * - Implicit feedback (usage patterns)
 * - Feedback aggregation
 * - Improvement suggestions
 *
 * Based on PROMPT ML design specification.
 */

/**
 * Feedback types
 * @readonly
 * @enum {string}
 */
export const FeedbackType = {
  RATING: 'rating',           // Numeric rating
  THUMBS: 'thumbs',           // Thumbs up/down
  COMMENT: 'comment',         // Text comment
  CORRECTION: 'correction',   // User correction
  REGENERATE: 'regenerate',   // User requested regeneration
  EXPORT: 'export',           // User exported content
  EDIT: 'edit'                // User edited output
};

/**
 * Feedback sentiment
 * @readonly
 * @enum {string}
 */
export const FeedbackSentiment = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative'
};

/**
 * @typedef {Object} FeedbackEntry
 * @property {string} id - Unique feedback ID
 * @property {FeedbackType} type - Feedback type
 * @property {string} contentType - Content type (roadmap, slides, etc.)
 * @property {string} sessionId - Session ID
 * @property {*} value - Feedback value
 * @property {FeedbackSentiment} sentiment - Derived sentiment
 * @property {Object} context - Additional context
 * @property {number} timestamp - Unix timestamp
 */

/**
 * @typedef {Object} FeedbackConfig
 * @property {number} maxEntries - Maximum entries to store
 * @property {boolean} persistToStorage - Persist feedback
 * @property {number} aggregationWindow - Aggregation window in ms
 */

const DEFAULT_CONFIG = {
  maxEntries: 1000,
  persistToStorage: false,
  aggregationWindow: 3600000 // 1 hour
};

/**
 * Generate unique ID
 */
function generateId() {
  return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Feedback Entry class
 */
export class FeedbackEntryImpl {
  constructor(type, contentType, value, context = {}) {
    this.id = generateId();
    this.type = type;
    this.contentType = contentType;
    this.sessionId = context.sessionId || null;
    this.traceId = context.traceId || null;
    this.value = value;
    this.sentiment = this._deriveSentiment(type, value);
    this.context = context;
    this.timestamp = Date.now();
  }

  _deriveSentiment(type, value) {
    switch (type) {
      case FeedbackType.RATING:
        if (value >= 4) return FeedbackSentiment.POSITIVE;
        if (value >= 3) return FeedbackSentiment.NEUTRAL;
        return FeedbackSentiment.NEGATIVE;

      case FeedbackType.THUMBS:
        return value ? FeedbackSentiment.POSITIVE : FeedbackSentiment.NEGATIVE;

      case FeedbackType.REGENERATE:
        return FeedbackSentiment.NEGATIVE; // User wasn't satisfied

      case FeedbackType.EXPORT:
        return FeedbackSentiment.POSITIVE; // User found it useful

      case FeedbackType.EDIT:
        return FeedbackSentiment.NEUTRAL; // Needs adjustment but usable

      case FeedbackType.CORRECTION:
        return FeedbackSentiment.NEGATIVE; // Output was wrong

      default:
        return FeedbackSentiment.NEUTRAL;
    }
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      contentType: this.contentType,
      sessionId: this.sessionId,
      traceId: this.traceId,
      value: this.value,
      sentiment: this.sentiment,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}

/**
 * Feedback Collector class
 */
export class FeedbackCollector {
  /**
   * @param {FeedbackConfig} config - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.entries = [];
    this.aggregates = new Map();
    this.listeners = [];
  }

  /**
   * Record explicit rating feedback
   * @param {string} contentType - Content type
   * @param {number} rating - Rating (1-5)
   * @param {Object} context - Additional context
   * @returns {FeedbackEntry}
   */
  recordRating(contentType, rating, context = {}) {
    const clampedRating = Math.max(1, Math.min(5, rating));
    return this._addEntry(FeedbackType.RATING, contentType, clampedRating, context);
  }

  /**
   * Record thumbs up/down feedback
   * @param {string} contentType - Content type
   * @param {boolean} isPositive - True for thumbs up
   * @param {Object} context - Additional context
   * @returns {FeedbackEntry}
   */
  recordThumbs(contentType, isPositive, context = {}) {
    return this._addEntry(FeedbackType.THUMBS, contentType, isPositive, context);
  }

  /**
   * Record text comment
   * @param {string} contentType - Content type
   * @param {string} comment - Comment text
   * @param {Object} context - Additional context
   * @returns {FeedbackEntry}
   */
  recordComment(contentType, comment, context = {}) {
    return this._addEntry(FeedbackType.COMMENT, contentType, comment, {
      ...context,
      sentiment: this._analyzeCommentSentiment(comment)
    });
  }

  /**
   * Record user correction
   * @param {string} contentType - Content type
   * @param {Object} correction - Correction details
   * @param {Object} context - Additional context
   * @returns {FeedbackEntry}
   */
  recordCorrection(contentType, correction, context = {}) {
    return this._addEntry(FeedbackType.CORRECTION, contentType, correction, context);
  }

  /**
   * Record regeneration request (implicit negative feedback)
   * @param {string} contentType - Content type
   * @param {Object} context - Additional context
   * @returns {FeedbackEntry}
   */
  recordRegenerate(contentType, context = {}) {
    return this._addEntry(FeedbackType.REGENERATE, contentType, true, context);
  }

  /**
   * Record export action (implicit positive feedback)
   * @param {string} contentType - Content type
   * @param {string} format - Export format
   * @param {Object} context - Additional context
   * @returns {FeedbackEntry}
   */
  recordExport(contentType, format, context = {}) {
    return this._addEntry(FeedbackType.EXPORT, contentType, format, context);
  }

  /**
   * Record user edit (implicit neutral/negative feedback)
   * @param {string} contentType - Content type
   * @param {Object} editDetails - Edit details
   * @param {Object} context - Additional context
   * @returns {FeedbackEntry}
   */
  recordEdit(contentType, editDetails, context = {}) {
    return this._addEntry(FeedbackType.EDIT, contentType, editDetails, context);
  }

  /**
   * Add a feedback listener
   * @param {Function} listener - Callback function
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * Remove a feedback listener
   * @param {Function} listener - Listener to remove
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get feedback entries
   * @param {Object} filter - Filter criteria
   * @returns {Array<FeedbackEntry>}
   */
  getEntries(filter = {}) {
    let entries = [...this.entries];

    if (filter.contentType) {
      entries = entries.filter(e => e.contentType === filter.contentType);
    }

    if (filter.type) {
      entries = entries.filter(e => e.type === filter.type);
    }

    if (filter.sentiment) {
      entries = entries.filter(e => e.sentiment === filter.sentiment);
    }

    if (filter.sessionId) {
      entries = entries.filter(e => e.sessionId === filter.sessionId);
    }

    if (filter.since) {
      entries = entries.filter(e => e.timestamp >= filter.since);
    }

    return entries;
  }

  /**
   * Get aggregated feedback statistics
   * @param {string} contentType - Optional content type filter
   * @returns {Object} Aggregated statistics
   */
  getAggregates(contentType = null) {
    const entries = contentType
      ? this.entries.filter(e => e.contentType === contentType)
      : this.entries;

    if (entries.length === 0) {
      return {
        totalFeedback: 0,
        message: 'No feedback collected yet'
      };
    }

    // Sentiment distribution
    const sentiments = {
      [FeedbackSentiment.POSITIVE]: 0,
      [FeedbackSentiment.NEUTRAL]: 0,
      [FeedbackSentiment.NEGATIVE]: 0
    };

    for (const entry of entries) {
      sentiments[entry.sentiment]++;
    }

    // Ratings statistics
    const ratings = entries
      .filter(e => e.type === FeedbackType.RATING)
      .map(e => e.value);

    const ratingStats = ratings.length > 0 ? {
      average: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100,
      count: ratings.length,
      distribution: {
        1: ratings.filter(r => r === 1).length,
        2: ratings.filter(r => r === 2).length,
        3: ratings.filter(r => r === 3).length,
        4: ratings.filter(r => r === 4).length,
        5: ratings.filter(r => r === 5).length
      }
    } : null;

    // Type distribution
    const typeDistribution = {};
    for (const entry of entries) {
      typeDistribution[entry.type] = (typeDistribution[entry.type] || 0) + 1;
    }

    // Content type distribution
    const contentTypeDistribution = {};
    for (const entry of entries) {
      contentTypeDistribution[entry.contentType] = (contentTypeDistribution[entry.contentType] || 0) + 1;
    }

    // Calculate satisfaction score (0-100)
    const totalSentiment = entries.length;
    const satisfactionScore = Math.round(
      ((sentiments[FeedbackSentiment.POSITIVE] * 100) +
       (sentiments[FeedbackSentiment.NEUTRAL] * 50) +
       (sentiments[FeedbackSentiment.NEGATIVE] * 0)) / totalSentiment
    );

    return {
      totalFeedback: entries.length,
      satisfactionScore,
      sentiments,
      sentimentRate: {
        positive: Math.round((sentiments[FeedbackSentiment.POSITIVE] / totalSentiment) * 100),
        neutral: Math.round((sentiments[FeedbackSentiment.NEUTRAL] / totalSentiment) * 100),
        negative: Math.round((sentiments[FeedbackSentiment.NEGATIVE] / totalSentiment) * 100)
      },
      ratings: ratingStats,
      typeDistribution,
      contentTypeDistribution,
      recentTrend: this._calculateTrend(entries),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get improvement suggestions based on feedback
   * @returns {Array} Improvement suggestions
   */
  getImprovementSuggestions() {
    const suggestions = [];
    const aggregates = this.getAggregates();

    // Check for low satisfaction
    if (aggregates.satisfactionScore < 60) {
      suggestions.push({
        priority: 'high',
        area: 'overall',
        suggestion: 'Overall satisfaction is low. Review recent negative feedback for common issues.',
        metric: `Satisfaction: ${aggregates.satisfactionScore}%`
      });
    }

    // Check by content type
    const contentTypes = ['roadmap', 'slides', 'document', 'research-analysis'];
    for (const ct of contentTypes) {
      const ctAggregates = this.getAggregates(ct);
      if (ctAggregates.totalFeedback > 5 && ctAggregates.satisfactionScore < 50) {
        suggestions.push({
          priority: 'high',
          area: ct,
          suggestion: `${ct} content has low satisfaction. Consider reviewing the generation prompt and output quality.`,
          metric: `${ct} satisfaction: ${ctAggregates.satisfactionScore}%`
        });
      }
    }

    // Check for high regeneration rate
    const regenerations = this.entries.filter(e => e.type === FeedbackType.REGENERATE).length;
    const totalRequests = this.entries.length;
    if (totalRequests > 10 && (regenerations / totalRequests) > 0.3) {
      suggestions.push({
        priority: 'medium',
        area: 'regeneration',
        suggestion: 'High regeneration rate indicates initial outputs may not meet expectations.',
        metric: `Regeneration rate: ${Math.round((regenerations / totalRequests) * 100)}%`
      });
    }

    // Check for correction patterns
    const corrections = this.entries.filter(e => e.type === FeedbackType.CORRECTION);
    if (corrections.length > 5) {
      // Analyze correction patterns
      const correctionTypes = this._analyzeCorrections(corrections);
      if (correctionTypes.length > 0) {
        suggestions.push({
          priority: 'medium',
          area: 'accuracy',
          suggestion: `Common corrections detected: ${correctionTypes.join(', ')}. Consider adjusting prompts.`,
          metric: `Total corrections: ${corrections.length}`
        });
      }
    }

    // Check for low export rate (users not finding content useful)
    const exports = this.entries.filter(e => e.type === FeedbackType.EXPORT).length;
    if (totalRequests > 20 && (exports / totalRequests) < 0.1) {
      suggestions.push({
        priority: 'low',
        area: 'utility',
        suggestion: 'Low export rate may indicate content is not meeting user needs.',
        metric: `Export rate: ${Math.round((exports / totalRequests) * 100)}%`
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Clear all feedback
   */
  clear() {
    this.entries = [];
    this.aggregates.clear();
  }

  /**
   * Export feedback data
   * @returns {Object} Export data
   */
  export() {
    return {
      entries: this.entries.map(e => e.toJSON()),
      aggregates: this.getAggregates(),
      suggestions: this.getImprovementSuggestions(),
      exportedAt: new Date().toISOString()
    };
  }

  // Private methods

  _addEntry(type, contentType, value, context) {
    const entry = new FeedbackEntryImpl(type, contentType, value, context);
    this.entries.push(entry);

    // Enforce max entries
    if (this.entries.length > this.config.maxEntries) {
      this.entries.shift();
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch (error) {
        console.error('[Feedback] Listener error:', error.message);
      }
    }

    // Update aggregates
    this._updateAggregates(entry);

    return entry;
  }

  _updateAggregates(entry) {
    const key = `${entry.contentType}_${this._getAggregationBucket()}`;
    const aggregate = this.aggregates.get(key) || {
      contentType: entry.contentType,
      bucket: this._getAggregationBucket(),
      count: 0,
      positiveCount: 0,
      negativeCount: 0
    };

    aggregate.count++;
    if (entry.sentiment === FeedbackSentiment.POSITIVE) {
      aggregate.positiveCount++;
    } else if (entry.sentiment === FeedbackSentiment.NEGATIVE) {
      aggregate.negativeCount++;
    }

    this.aggregates.set(key, aggregate);
  }

  _getAggregationBucket() {
    const now = Date.now();
    return Math.floor(now / this.config.aggregationWindow);
  }

  _analyzeCommentSentiment(comment) {
    const lowerComment = comment.toLowerCase();

    const positiveWords = ['great', 'good', 'excellent', 'perfect', 'helpful', 'useful', 'love', 'amazing'];
    const negativeWords = ['bad', 'poor', 'wrong', 'incorrect', 'useless', 'terrible', 'hate', 'awful'];

    let positiveScore = 0;
    let negativeScore = 0;

    for (const word of positiveWords) {
      if (lowerComment.includes(word)) positiveScore++;
    }

    for (const word of negativeWords) {
      if (lowerComment.includes(word)) negativeScore++;
    }

    if (positiveScore > negativeScore) return FeedbackSentiment.POSITIVE;
    if (negativeScore > positiveScore) return FeedbackSentiment.NEGATIVE;
    return FeedbackSentiment.NEUTRAL;
  }

  _calculateTrend(entries) {
    if (entries.length < 10) {
      return { direction: 'insufficient_data', change: 0 };
    }

    // Compare recent half to older half
    const midpoint = Math.floor(entries.length / 2);
    const olderEntries = entries.slice(0, midpoint);
    const newerEntries = entries.slice(midpoint);

    const olderPositiveRate = olderEntries.filter(e => e.sentiment === FeedbackSentiment.POSITIVE).length / olderEntries.length;
    const newerPositiveRate = newerEntries.filter(e => e.sentiment === FeedbackSentiment.POSITIVE).length / newerEntries.length;

    const change = Math.round((newerPositiveRate - olderPositiveRate) * 100);

    return {
      direction: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
      change
    };
  }

  _analyzeCorrections(corrections) {
    const patterns = [];
    const correctionValues = corrections.map(c => c.value);

    // Look for common correction patterns
    const factualCorrections = correctionValues.filter(v =>
      v?.type === 'factual' || v?.reason?.includes('incorrect') || v?.reason?.includes('wrong')
    );
    if (factualCorrections.length > 2) {
      patterns.push('factual errors');
    }

    const formatCorrections = correctionValues.filter(v =>
      v?.type === 'format' || v?.reason?.includes('format')
    );
    if (formatCorrections.length > 2) {
      patterns.push('formatting issues');
    }

    const missingContent = correctionValues.filter(v =>
      v?.type === 'missing' || v?.reason?.includes('missing')
    );
    if (missingContent.length > 2) {
      patterns.push('missing content');
    }

    return patterns;
  }
}

// Singleton instance
let _collector = null;

/**
 * Get or create singleton feedback collector
 * @param {FeedbackConfig} config - Configuration
 * @returns {FeedbackCollector}
 */
export function getFeedbackCollector(config = {}) {
  if (!_collector) {
    _collector = new FeedbackCollector(config);
  }
  return _collector;
}

/**
 * Reset feedback collector (for testing)
 */
export function resetFeedbackCollector() {
  _collector = null;
}

/**
 * Quick record rating
 * @param {string} contentType - Content type
 * @param {number} rating - Rating
 * @param {Object} context - Context
 */
export function recordRating(contentType, rating, context = {}) {
  return getFeedbackCollector().recordRating(contentType, rating, context);
}

/**
 * Quick record thumbs
 * @param {string} contentType - Content type
 * @param {boolean} isPositive - Thumbs up/down
 * @param {Object} context - Context
 */
export function recordThumbs(contentType, isPositive, context = {}) {
  return getFeedbackCollector().recordThumbs(contentType, isPositive, context);
}

export default FeedbackCollector;
