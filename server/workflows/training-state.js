/**
 * Training Workflow State Schema
 *
 * Gap 02: Defines the state channels for the LangGraph training workflow.
 *
 * This schema specifies all state that flows through the training graph,
 * including iteration tracking, sample data, results, and evolution state.
 *
 * Usage:
 *   import { TrainingStateAnnotation } from './training-state.js';
 *
 *   const graph = new StateGraph(TrainingStateAnnotation)
 *     .addNode(...)
 *     .compile();
 */

import { Annotation } from '@langchain/langgraph';

/**
 * Training workflow state annotation
 *
 * Defines all state channels that flow through the training graph.
 * Each channel has a reducer that determines how updates are merged.
 */
export const TrainingStateAnnotation = Annotation.Root({
  // =========================================================================
  // Session Identification
  // =========================================================================

  /**
   * Unique session identifier for this training run
   */
  sessionId: Annotation({
    reducer: (_, update) => update,
    default: () => null
  }),

  /**
   * Timestamp when training started
   */
  startedAt: Annotation({
    reducer: (_, update) => update,
    default: () => null
  }),

  // =========================================================================
  // Iteration Tracking
  // =========================================================================

  /**
   * Current iteration index (0-based)
   */
  currentIteration: Annotation({
    reducer: (_, update) => update,
    default: () => 0
  }),

  /**
   * Total number of iterations to run
   */
  totalIterations: Annotation({
    reducer: (_, update) => update,
    default: () => 0
  }),

  /**
   * Current sample set being processed
   */
  currentSampleSet: Annotation({
    reducer: (_, update) => update,
    default: () => null
  }),

  /**
   * Current content type being processed
   */
  currentContentType: Annotation({
    reducer: (_, update) => update,
    default: () => null
  }),

  // =========================================================================
  // Training Configuration
  // =========================================================================

  /**
   * All sample sets loaded for training
   */
  sampleSets: Annotation({
    reducer: (_, update) => update,
    default: () => []
  }),

  /**
   * Content types to train
   */
  contentTypes: Annotation({
    reducer: (_, update) => update,
    default: () => ['Roadmap', 'Document', 'ResearchAnalysis']
  }),

  /**
   * Delay between generations in ms
   */
  delay: Annotation({
    reducer: (_, update) => update,
    default: () => 1000
  }),

  // =========================================================================
  // Results Accumulation
  // =========================================================================

  /**
   * Successful generation results
   * Reducer appends new results to existing array
   */
  results: Annotation({
    reducer: (existing, update) => {
      if (!update || update.length === 0) return existing;
      return [...existing, ...update];
    },
    default: () => []
  }),

  /**
   * Error records
   * Reducer appends new errors to existing array
   */
  errors: Annotation({
    reducer: (existing, update) => {
      if (!update || update.length === 0) return existing;
      return [...existing, ...update];
    },
    default: () => []
  }),

  // =========================================================================
  // Statistics
  // =========================================================================

  /**
   * Aggregate statistics
   */
  stats: Annotation({
    reducer: (existing, update) => {
      if (!update) return existing;
      return {
        totalGenerations: (existing.totalGenerations || 0) + (update.totalGenerations || 0),
        successful: (existing.successful || 0) + (update.successful || 0),
        failed: (existing.failed || 0) + (update.failed || 0),
        qualityScores: [...(existing.qualityScores || []), ...(update.qualityScores || [])],
        feedbackDistribution: {
          1: (existing.feedbackDistribution?.[1] || 0) + (update.feedbackDistribution?.[1] || 0),
          2: (existing.feedbackDistribution?.[2] || 0) + (update.feedbackDistribution?.[2] || 0),
          3: (existing.feedbackDistribution?.[3] || 0) + (update.feedbackDistribution?.[3] || 0),
          4: (existing.feedbackDistribution?.[4] || 0) + (update.feedbackDistribution?.[4] || 0),
          5: (existing.feedbackDistribution?.[5] || 0) + (update.feedbackDistribution?.[5] || 0)
        }
      };
    },
    default: () => ({
      totalGenerations: 0,
      successful: 0,
      failed: 0,
      qualityScores: [],
      feedbackDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    })
  }),

  /**
   * Cache statistics
   */
  cacheStats: Annotation({
    reducer: (existing, update) => {
      if (!update) return existing;
      return {
        hits: (existing.hits || 0) + (update.hits || 0),
        misses: (existing.misses || 0) + (update.misses || 0)
      };
    },
    default: () => ({ hits: 0, misses: 0 })
  }),

  // =========================================================================
  // Evolution Engine State
  // =========================================================================

  /**
   * Serialized prompt evolution engine state
   * Allows resuming evolution across graph invocations
   */
  evolutionState: Annotation({
    reducer: (_, update) => update,
    default: () => null
  }),

  /**
   * Last evolution cycle results
   */
  lastEvolutionResult: Annotation({
    reducer: (_, update) => update,
    default: () => null
  }),

  // =========================================================================
  // Current Generation Context
  // =========================================================================

  /**
   * Current generation result (temporary, for passing between nodes)
   */
  currentResult: Annotation({
    reducer: (_, update) => update,
    default: () => null
  }),

  /**
   * Current generation error (temporary)
   */
  currentError: Annotation({
    reducer: (_, update) => update,
    default: () => null
  }),

  /**
   * Whether current generation was a cache hit
   */
  currentCacheHit: Annotation({
    reducer: (_, update) => update,
    default: () => false
  }),

  // =========================================================================
  // Control Flags
  // =========================================================================

  /**
   * Whether training should stop
   */
  shouldStop: Annotation({
    reducer: (_, update) => update,
    default: () => false
  }),

  /**
   * Current phase of training
   */
  phase: Annotation({
    reducer: (_, update) => update,
    default: () => 'initialize'
  }),

  /**
   * Final status when training completes
   */
  status: Annotation({
    reducer: (_, update) => update,
    default: () => 'pending'
  }),

  // =========================================================================
  // Summary (populated at end)
  // =========================================================================

  /**
   * Final training summary
   */
  summary: Annotation({
    reducer: (_, update) => update,
    default: () => null
  })
});

/**
 * Initial state factory
 *
 * Creates the initial state for a training run.
 *
 * @param {Object} config - Training configuration
 * @returns {Object} Initial state
 */
export function createInitialState(config) {
  return {
    sessionId: config.sessionId || `training_${Date.now()}`,
    startedAt: Date.now(),
    currentIteration: 0,
    totalIterations: config.iterations || 10,
    currentSampleSet: null,
    currentContentType: null,
    sampleSets: config.sampleSets || [],
    contentTypes: config.contentTypes || ['Roadmap', 'Document', 'ResearchAnalysis'],
    delay: config.delay || 1000,
    results: [],
    errors: [],
    stats: {
      totalGenerations: 0,
      successful: 0,
      failed: 0,
      qualityScores: [],
      feedbackDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    },
    cacheStats: { hits: 0, misses: 0 },
    evolutionState: null,
    lastEvolutionResult: null,
    currentResult: null,
    currentError: null,
    currentCacheHit: false,
    shouldStop: false,
    phase: 'initialize',
    status: 'pending',
    summary: null
  };
}

export default TrainingStateAnnotation;
