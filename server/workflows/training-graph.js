/**
 * Training Graph Assembly
 *
 * Gap 02: Assembles the LangGraph training workflow.
 *
 * This module creates a StateGraph that orchestrates the training process:
 *
 *   ┌──────────────┐
 *   │  initialize  │
 *   └──────┬───────┘
 *          ↓
 *   ┌──────────────┐ ←─────────────────────────┐
 *   │ select_sample│                            │
 *   └──────┬───────┘                            │
 *          ↓                                    │
 *   ┌──────────────┐                            │
 *   │   generate   │                            │
 *   └──────┬───────┘                            │
 *          ↓                                    │
 *   ┌──────────────┐                            │
 *   │   evaluate   │                            │
 *   └──────┬───────┘                            │
 *          ↓                                    │
 *   ┌──────────────┐                            │
 *   │check_evolution│───→ (more iterations?) ──┘
 *   └──────┬───────┘
 *          ↓ (done)
 *   ┌──────────────┐
 *   │   finalize   │
 *   └──────────────┘
 *
 * Usage:
 *   import { runTrainingGraph, resumeTrainingGraph } from './workflows/training-graph.js';
 *
 *   // Start new training
 *   const result = await runTrainingGraph({
 *     sessionId: 'session123',
 *     sampleSets: [...],
 *     contentTypes: ['Roadmap', 'Slides'],
 *     iterations: 100,
 *     generators: { Roadmap: fn, Slides: fn }
 *   });
 *
 *   // Resume existing training
 *   const result = await resumeTrainingGraph('session123');
 */

import { StateGraph, END } from '@langchain/langgraph';
import { TrainingStateAnnotation, createInitialState } from './training-state.js';
import {
  initializeNode,
  selectSampleNode,
  generateNode,
  evaluateNode,
  checkEvolutionNode,
  finalizeNode
} from './training-nodes.js';
import { langGraphCheckpointer } from '../redis/langgraph-checkpointer.js';

/**
 * Route from select_sample node
 *
 * Determines whether to continue generating or finalize.
 *
 * @param {Object} state - Current state
 * @returns {string} Next node name or END
 */
function routeFromSelectSample(state) {
  if (state.phase === 'finalize') {
    return 'finalize';
  }
  return 'generate';
}

/**
 * Route from check_evolution node
 *
 * Continues training loop or finalizes.
 *
 * @param {Object} state - Current state
 * @returns {string} Next node name
 */
function routeFromCheckEvolution(state) {
  if (state.phase === 'finalize') {
    return 'finalize';
  }
  return 'select_sample';
}

/**
 * Create the training state graph
 *
 * Builds the graph structure with nodes and edges.
 *
 * @param {Object} config - Graph configuration
 * @param {Object} config.generators - Content type generators
 * @returns {Object} Compiled graph
 */
export function createTrainingGraph(config = {}) {
  const { generators = {} } = config;

  // Create graph with state annotation
  const graph = new StateGraph(TrainingStateAnnotation);

  // Add nodes
  graph.addNode('initialize', initializeNode);
  graph.addNode('select_sample', selectSampleNode);
  graph.addNode('generate', (state) => generateNode(state, { generators }));
  graph.addNode('evaluate', evaluateNode);
  graph.addNode('check_evolution', checkEvolutionNode);
  graph.addNode('finalize', finalizeNode);

  // Set entry point
  graph.setEntryPoint('initialize');

  // Add edges
  graph.addEdge('initialize', 'select_sample');

  // Conditional edge from select_sample
  graph.addConditionalEdges(
    'select_sample',
    routeFromSelectSample,
    {
      'generate': 'generate',
      'finalize': 'finalize'
    }
  );

  graph.addEdge('generate', 'evaluate');
  graph.addEdge('evaluate', 'check_evolution');

  // Conditional edge from check_evolution (loop back or finalize)
  graph.addConditionalEdges(
    'check_evolution',
    routeFromCheckEvolution,
    {
      'select_sample': 'select_sample',
      'finalize': 'finalize'
    }
  );

  // Finalize leads to END
  graph.addEdge('finalize', END);

  // Compile with checkpointer for persistence
  return graph.compile({
    checkpointer: langGraphCheckpointer
  });
}

/**
 * Run a new training session
 *
 * Starts a fresh training run with the given configuration.
 *
 * @param {Object} config - Training configuration
 * @param {string} config.sessionId - Unique session identifier
 * @param {Array} config.sampleSets - Sample sets to train on
 * @param {Array} config.contentTypes - Content types to generate
 * @param {number} config.iterations - Total iterations
 * @param {number} config.delay - Delay between iterations (ms)
 * @param {Object} config.generators - Generator functions by content type
 * @returns {Promise<Object>} Final state
 */
export async function runTrainingGraph(config) {
  const {
    sessionId,
    sampleSets,
    contentTypes,
    iterations,
    delay,
    generators
  } = config;

  console.log(`\n🎯 [TrainingGraph] Starting session: ${sessionId}`);

  // Create initial state
  const initialState = createInitialState({
    sessionId,
    sampleSets,
    contentTypes,
    iterations,
    delay
  });

  // Create and run graph
  const graph = createTrainingGraph({ generators });

  const result = await graph.invoke(initialState, {
    configurable: {
      thread_id: `training:${sessionId}`
    }
  });

  console.log(`\n✅ [TrainingGraph] Session ${sessionId} completed`);

  return result;
}

/**
 * Resume an existing training session
 *
 * Loads checkpoint from Redis and continues training.
 *
 * @param {string} sessionId - Session to resume
 * @param {Object} options - Resume options
 * @param {Object} options.generators - Generator functions
 * @returns {Promise<Object>} Final state
 */
export async function resumeTrainingGraph(sessionId, options = {}) {
  const { generators = {} } = options;

  console.log(`\n🔄 [TrainingGraph] Resuming session: ${sessionId}`);

  // Create graph
  const graph = createTrainingGraph({ generators });

  const threadId = `training:${sessionId}`;

  // Check if checkpoint exists
  const checkpoint = await langGraphCheckpointer.getTuple({
    configurable: { thread_id: threadId }
  });

  if (!checkpoint) {
    throw new Error(`No checkpoint found for session: ${sessionId}`);
  }

  console.log(`   Found checkpoint at iteration ${checkpoint.checkpoint?.currentIteration || 0}`);

  // Resume from checkpoint
  const result = await graph.invoke(null, {
    configurable: {
      thread_id: threadId,
      checkpoint_id: checkpoint.config?.configurable?.checkpoint_id
    }
  });

  console.log(`\n✅ [TrainingGraph] Session ${sessionId} resumed and completed`);

  return result;
}

/**
 * Stop a running training session
 *
 * Sets shouldStop flag in checkpoint to gracefully stop training.
 *
 * @param {string} sessionId - Session to stop
 * @returns {Promise<boolean>} Whether stop was successful
 */
export async function stopTrainingGraph(sessionId) {
  const threadId = `training:${sessionId}`;

  console.log(`\n⏹️ [TrainingGraph] Stopping session: ${sessionId}`);

  try {
    // Get current checkpoint
    const checkpoint = await langGraphCheckpointer.getTuple({
      configurable: { thread_id: threadId }
    });

    if (!checkpoint) {
      console.log(`   No checkpoint found for session: ${sessionId}`);
      return false;
    }

    // Update checkpoint with shouldStop flag
    const updatedCheckpoint = {
      ...checkpoint.checkpoint,
      shouldStop: true
    };

    await langGraphCheckpointer.put(
      { configurable: { thread_id: threadId } },
      updatedCheckpoint,
      { ...checkpoint.metadata, source: 'user_stop' }
    );

    console.log(`   ✓ Stop flag set for session: ${sessionId}`);
    return true;
  } catch (error) {
    console.error(`   ✗ Failed to stop session: ${error.message}`);
    return false;
  }
}

/**
 * Get training session status
 *
 * Retrieves current state from checkpoint.
 *
 * @param {string} sessionId - Session to check
 * @returns {Promise<Object|null>} Current state or null
 */
export async function getTrainingStatus(sessionId) {
  const threadId = `training:${sessionId}`;

  try {
    const checkpoint = await langGraphCheckpointer.getTuple({
      configurable: { thread_id: threadId }
    });

    if (!checkpoint) {
      return null;
    }

    const state = checkpoint.checkpoint;

    return {
      sessionId,
      status: state.status || 'unknown',
      phase: state.phase,
      currentIteration: state.currentIteration || 0,
      totalIterations: state.totalIterations || 0,
      progress: state.totalIterations > 0
        ? Math.round((state.currentIteration / state.totalIterations) * 100)
        : 0,
      stats: state.stats,
      cacheStats: state.cacheStats,
      shouldStop: state.shouldStop || false,
      startedAt: state.startedAt,
      summary: state.summary
    };
  } catch (error) {
    console.error(`[TrainingGraph] Error getting status: ${error.message}`);
    return null;
  }
}

/**
 * List checkpoint history for a session
 *
 * @param {string} sessionId - Session to list history for
 * @param {number} limit - Max entries to return
 * @returns {Promise<Array>} Checkpoint history
 */
export async function getTrainingHistory(sessionId, limit = 10) {
  const threadId = `training:${sessionId}`;
  const history = [];

  try {
    for await (const tuple of langGraphCheckpointer.list(
      { configurable: { thread_id: threadId } },
      { limit }
    )) {
      history.push({
        checkpointId: tuple.config?.configurable?.checkpoint_id,
        iteration: tuple.checkpoint?.currentIteration,
        phase: tuple.checkpoint?.phase,
        status: tuple.checkpoint?.status,
        metadata: tuple.metadata
      });
    }
  } catch (error) {
    console.error(`[TrainingGraph] Error listing history: ${error.message}`);
  }

  return history;
}

/**
 * Stream training progress
 *
 * Returns an async generator that yields state updates during training.
 *
 * @param {Object} config - Training configuration
 * @yields {Object} State updates
 */
export async function* streamTrainingGraph(config) {
  const {
    sessionId,
    sampleSets,
    contentTypes,
    iterations,
    delay,
    generators
  } = config;

  console.log(`\n🎯 [TrainingGraph] Streaming session: ${sessionId}`);

  const initialState = createInitialState({
    sessionId,
    sampleSets,
    contentTypes,
    iterations,
    delay
  });

  const graph = createTrainingGraph({ generators });

  // Use stream method for incremental updates
  const stream = await graph.stream(initialState, {
    configurable: {
      thread_id: `training:${sessionId}`
    }
  });

  for await (const update of stream) {
    yield update;
  }

  console.log(`\n✅ [TrainingGraph] Stream completed for ${sessionId}`);
}

export default {
  createTrainingGraph,
  runTrainingGraph,
  resumeTrainingGraph,
  stopTrainingGraph,
  getTrainingStatus,
  getTrainingHistory,
  streamTrainingGraph
};
