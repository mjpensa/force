/**
 * Training Checkpoint Schema
 *
 * Gap 03: Defines the checkpoint schema for resumable training sessions.
 *
 * This module provides:
 * - Schema definition for training checkpoints
 * - Validation functions for checkpoint data
 * - Factory function for creating initial checkpoints
 *
 * Usage:
 *   import { createInitialCheckpoint, validateCheckpoint } from './trainingCheckpoint.js';
 *
 *   const checkpoint = createInitialCheckpoint('session123', config);
 *   validateCheckpoint(checkpoint);
 */

/**
 * Training checkpoint schema definition
 *
 * Documents the structure of checkpoint data stored in Redis.
 */
export const TrainingCheckpointSchema = {
  // Session identification
  sessionId: 'String - Unique session identifier',
  startedAt: 'Number - Timestamp when training started',
  lastCheckpointAt: 'Number - Timestamp of last checkpoint',

  // Iteration progress
  currentIteration: 'Number - Current iteration index (0-based)',
  totalIterations: 'Number - Total iterations to complete',
  completedSampleSets: 'Array - Names of completed sample sets',

  // Evolution engine state (serializable)
  evolutionState: 'Object - Serialized PromptEvolutionEngine state',

  // Accumulated results
  results: 'Array - All generation results',
  errors: 'Array - All error records',

  // Statistics
  stats: {
    totalGenerations: 'Number - Total generation attempts',
    successful: 'Number - Successful generations',
    failed: 'Number - Failed generations',
    cacheHits: 'Number - DSPy cache hits',
    cacheMisses: 'Number - DSPy cache misses',
    qualityScores: 'Array - All quality scores',
    feedbackDistribution: 'Object - Distribution of ratings 1-5'
  },

  // Configuration used for training
  config: {
    sampleSetNames: 'Array - Names of sample sets',
    contentTypes: 'Array - Content types being trained',
    delay: 'Number - Delay between iterations',
    options: 'Object - Additional options'
  },

  // Status
  status: 'String - pending | running | stopped | completed | failed',
  completedAt: 'Number - Timestamp when completed (if applicable)',
  failedAt: 'Number - Timestamp when failed (if applicable)',
  failureReason: 'String - Error message if failed'
};

/**
 * Required fields that must be present in a checkpoint
 */
const REQUIRED_FIELDS = [
  'sessionId',
  'currentIteration',
  'totalIterations'
];

/**
 * Validate checkpoint before save
 *
 * Ensures required fields are present and have valid types.
 *
 * @param {Object} checkpoint - Checkpoint to validate
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export function validateCheckpoint(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object') {
    throw new Error('Checkpoint must be a non-null object');
  }

  for (const field of REQUIRED_FIELDS) {
    if (checkpoint[field] === undefined) {
      throw new Error(`Missing required checkpoint field: ${field}`);
    }
  }

  // Type validations
  if (typeof checkpoint.sessionId !== 'string') {
    throw new Error('sessionId must be a string');
  }

  if (typeof checkpoint.currentIteration !== 'number' || checkpoint.currentIteration < 0) {
    throw new Error('currentIteration must be a non-negative number');
  }

  if (typeof checkpoint.totalIterations !== 'number' || checkpoint.totalIterations < 0) {
    throw new Error('totalIterations must be a non-negative number');
  }

  if (checkpoint.currentIteration > checkpoint.totalIterations) {
    throw new Error('currentIteration cannot exceed totalIterations');
  }

  return true;
}

/**
 * Create initial checkpoint for a new training session
 *
 * @param {string} sessionId - Unique session identifier
 * @param {Object} config - Training configuration
 * @param {Array} config.sampleSets - Sample sets to train on
 * @param {Array} config.contentTypes - Content types to generate
 * @param {number} config.iterations - Total iterations
 * @param {number} config.delay - Delay between iterations
 * @param {Object} config.options - Additional options
 * @returns {Object} Initial checkpoint state
 */
export function createInitialCheckpoint(sessionId, config) {
  const now = Date.now();

  return {
    // Session identification
    sessionId,
    startedAt: now,
    lastCheckpointAt: now,

    // Iteration progress
    currentIteration: 0,
    totalIterations: config.iterations || 0,
    completedSampleSets: [],

    // Evolution engine state
    evolutionState: null,

    // Accumulated results
    results: [],
    errors: [],

    // Statistics
    stats: {
      totalGenerations: 0,
      successful: 0,
      failed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      qualityScores: [],
      feedbackDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    },

    // Configuration
    config: {
      sampleSetNames: config.sampleSets?.map(s => s.name || s) || [],
      contentTypes: config.contentTypes || [],
      delay: config.delay || 1000,
      options: config.options || {}
    },

    // Status
    status: 'pending'
  };
}

/**
 * Merge checkpoint state with iteration update
 *
 * Creates a new checkpoint state with updated values from an iteration.
 *
 * @param {Object} checkpoint - Current checkpoint
 * @param {Object} update - Update values
 * @returns {Object} Merged checkpoint
 */
export function mergeCheckpointUpdate(checkpoint, update) {
  const merged = {
    ...checkpoint,
    lastCheckpointAt: Date.now()
  };

  // Simple field updates
  if (update.currentIteration !== undefined) {
    merged.currentIteration = update.currentIteration;
  }

  if (update.evolutionState !== undefined) {
    merged.evolutionState = update.evolutionState;
  }

  if (update.status !== undefined) {
    merged.status = update.status;
  }

  // Append results
  if (update.results && update.results.length > 0) {
    merged.results = [...(merged.results || []), ...update.results];
  }

  // Append errors
  if (update.errors && update.errors.length > 0) {
    merged.errors = [...(merged.errors || []), ...update.errors];
  }

  // Merge stats (additive)
  if (update.stats) {
    merged.stats = {
      totalGenerations: (merged.stats.totalGenerations || 0) + (update.stats.totalGenerations || 0),
      successful: (merged.stats.successful || 0) + (update.stats.successful || 0),
      failed: (merged.stats.failed || 0) + (update.stats.failed || 0),
      cacheHits: (merged.stats.cacheHits || 0) + (update.stats.cacheHits || 0),
      cacheMisses: (merged.stats.cacheMisses || 0) + (update.stats.cacheMisses || 0),
      qualityScores: [...(merged.stats.qualityScores || []), ...(update.stats.qualityScores || [])],
      feedbackDistribution: {
        1: (merged.stats.feedbackDistribution?.[1] || 0) + (update.stats.feedbackDistribution?.[1] || 0),
        2: (merged.stats.feedbackDistribution?.[2] || 0) + (update.stats.feedbackDistribution?.[2] || 0),
        3: (merged.stats.feedbackDistribution?.[3] || 0) + (update.stats.feedbackDistribution?.[3] || 0),
        4: (merged.stats.feedbackDistribution?.[4] || 0) + (update.stats.feedbackDistribution?.[4] || 0),
        5: (merged.stats.feedbackDistribution?.[5] || 0) + (update.stats.feedbackDistribution?.[5] || 0)
      }
    };
  }

  // Timestamps for completion/failure
  if (update.completedAt !== undefined) {
    merged.completedAt = update.completedAt;
  }

  if (update.failedAt !== undefined) {
    merged.failedAt = update.failedAt;
  }

  if (update.failureReason !== undefined) {
    merged.failureReason = update.failureReason;
  }

  return merged;
}

/**
 * Calculate checkpoint summary for status display
 *
 * @param {Object} checkpoint - Checkpoint to summarize
 * @returns {Object} Summary object
 */
export function getCheckpointSummary(checkpoint) {
  if (!checkpoint) {
    return null;
  }

  const progress = checkpoint.totalIterations > 0
    ? Math.round((checkpoint.currentIteration / checkpoint.totalIterations) * 100)
    : 0;

  const avgQuality = checkpoint.stats?.qualityScores?.length > 0
    ? (checkpoint.stats.qualityScores.reduce((a, b) => a + b, 0) /
       checkpoint.stats.qualityScores.length).toFixed(2)
    : 0;

  const cacheHitRate = (checkpoint.stats?.cacheHits + checkpoint.stats?.cacheMisses) > 0
    ? ((checkpoint.stats.cacheHits / (checkpoint.stats.cacheHits + checkpoint.stats.cacheMisses)) * 100).toFixed(1)
    : '0';

  return {
    sessionId: checkpoint.sessionId,
    status: checkpoint.status || 'unknown',
    progress: `${progress}%`,
    currentIteration: checkpoint.currentIteration,
    totalIterations: checkpoint.totalIterations,
    successful: checkpoint.stats?.successful || 0,
    failed: checkpoint.stats?.failed || 0,
    avgQuality,
    cacheHitRate: `${cacheHitRate}%`,
    startedAt: checkpoint.startedAt,
    lastCheckpointAt: checkpoint.lastCheckpointAt,
    completedAt: checkpoint.completedAt,
    failedAt: checkpoint.failedAt
  };
}

export default {
  TrainingCheckpointSchema,
  validateCheckpoint,
  createInitialCheckpoint,
  mergeCheckpointUpdate,
  getCheckpointSummary
};
