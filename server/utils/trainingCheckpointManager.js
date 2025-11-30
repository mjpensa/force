/**
 * Training Checkpoint Manager
 *
 * Gap 03: Manages save/restore of training state for resumable sessions.
 *
 * This class wraps the Redis checkpointer to provide training-specific
 * functionality including:
 * - Interval-based checkpointing
 * - Session state persistence
 * - Training resumption
 * - Checkpoint history and rollback
 *
 * Usage:
 *   import { TrainingCheckpointManager } from './trainingCheckpointManager.js';
 *
 *   const manager = new TrainingCheckpointManager('session123');
 *
 *   // Save checkpoint
 *   await manager.save(state);
 *
 *   // Load checkpoint
 *   const checkpoint = await manager.load();
 *
 *   // Resume from checkpoint
 *   if (checkpoint) {
 *     startIteration = checkpoint.currentIteration;
 *   }
 */

import { checkpointer } from '../redis/checkpointer.js';
import {
  validateCheckpoint,
  mergeCheckpointUpdate,
  getCheckpointSummary
} from './trainingCheckpoint.js';

const CHECKPOINT_PREFIX = 'training';
const DEFAULT_CHECKPOINT_INTERVAL = 10; // Save every N iterations

/**
 * Training Checkpoint Manager
 *
 * Handles save/restore of training state to Redis.
 */
export class TrainingCheckpointManager {
  /**
   * Create a checkpoint manager for a session
   *
   * @param {string} sessionId - Unique session identifier
   * @param {Object} options - Manager options
   * @param {number} options.checkpointInterval - Iterations between checkpoints (default: 10)
   */
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.threadId = `${CHECKPOINT_PREFIX}:${sessionId}`;
    this.checkpointInterval = options.checkpointInterval || DEFAULT_CHECKPOINT_INTERVAL;
    this.lastCheckpointIteration = 0;
    this.lastCheckpointTime = 0;
  }

  /**
   * Generate thread ID for a session
   *
   * @param {string} sessionId - Session identifier
   * @returns {string} Thread ID for checkpointer
   */
  static getThreadId(sessionId) {
    return `${CHECKPOINT_PREFIX}:${sessionId}`;
  }

  /**
   * Check if checkpoint exists for this session
   *
   * @returns {Promise<boolean>} True if checkpoint exists
   */
  async exists() {
    try {
      const checkpoint = await checkpointer.get(this.threadId);
      return checkpoint !== null;
    } catch (error) {
      console.error(`[Checkpoint] Error checking existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Load checkpoint for session
   *
   * Retrieves the latest checkpoint from Redis.
   *
   * @returns {Promise<Object|null>} Checkpoint data or null if not found
   */
  async load() {
    try {
      const result = await checkpointer.getWithMetadata(this.threadId);

      if (!result || !result.checkpoint) {
        console.log(`[Checkpoint] No checkpoint found for session: ${this.sessionId}`);
        return null;
      }

      console.log(`[Checkpoint] Loaded v${result.metadata?.version || '?'} for session: ${this.sessionId}`);
      console.log(`[Checkpoint] Resuming from iteration ${result.checkpoint.currentIteration}/${result.checkpoint.totalIterations}`);

      // Set last checkpoint iteration to allow immediate saving if needed
      this.lastCheckpointIteration = result.checkpoint.currentIteration;
      this.lastCheckpointTime = result.checkpoint.lastCheckpointAt || Date.now();

      return result.checkpoint;
    } catch (error) {
      console.error(`[Checkpoint] Error loading: ${error.message}`);
      return null;
    }
  }

  /**
   * Load checkpoint at specific version
   *
   * @param {number} version - Version number to load
   * @returns {Promise<Object|null>} Checkpoint data or null
   */
  async loadVersion(version) {
    try {
      const checkpoint = await checkpointer.get(this.threadId, version);

      if (!checkpoint) {
        console.log(`[Checkpoint] Version ${version} not found for session: ${this.sessionId}`);
        return null;
      }

      console.log(`[Checkpoint] Loaded v${version} for session: ${this.sessionId}`);
      return checkpoint;
    } catch (error) {
      console.error(`[Checkpoint] Error loading version ${version}: ${error.message}`);
      return null;
    }
  }

  /**
   * Save checkpoint
   *
   * Saves training state to Redis. By default, only saves at intervals
   * unless force is true.
   *
   * @param {Object} state - Current training state
   * @param {boolean} force - Force save even if not at interval
   * @returns {Promise<Object|null>} Save result or null if skipped
   */
  async save(state, force = false) {
    // Check if we should save based on interval
    const iterationsSinceLastCheckpoint = state.currentIteration - this.lastCheckpointIteration;

    if (!force && iterationsSinceLastCheckpoint < this.checkpointInterval) {
      return null;
    }

    // Prepare checkpoint with timestamp
    const checkpoint = {
      ...state,
      lastCheckpointAt: Date.now()
    };

    try {
      // Validate before saving
      validateCheckpoint(checkpoint);

      // Save to Redis
      const result = await checkpointer.put(this.threadId, checkpoint, {
        source: 'training-loop',
        iteration: state.currentIteration,
        status: state.status || 'running'
      });

      // Update tracking
      this.lastCheckpointIteration = state.currentIteration;
      this.lastCheckpointTime = checkpoint.lastCheckpointAt;

      console.log(`[Checkpoint] Saved at iteration ${state.currentIteration} (v${result.version})`);

      return result;
    } catch (error) {
      console.error(`[Checkpoint] Failed to save: ${error.message}`);
      // Don't throw - checkpoint failure shouldn't stop training
      return null;
    }
  }

  /**
   * Save final checkpoint when training completes successfully
   *
   * @param {Object} state - Final training state
   * @returns {Promise<Object|null>} Save result
   */
  async saveFinal(state) {
    return this.save({
      ...state,
      status: 'completed',
      completedAt: Date.now()
    }, true);
  }

  /**
   * Save checkpoint when training is stopped by user
   *
   * @param {Object} state - Current training state
   * @returns {Promise<Object|null>} Save result
   */
  async saveStopped(state) {
    return this.save({
      ...state,
      status: 'stopped',
      stoppedAt: Date.now()
    }, true);
  }

  /**
   * Save error checkpoint when training fails
   *
   * @param {Object} state - Current training state
   * @param {Error} error - Error that caused failure
   * @returns {Promise<Object|null>} Save result
   */
  async saveError(state, error) {
    return this.save({
      ...state,
      status: 'failed',
      failedAt: Date.now(),
      failureReason: error.message,
      failureStack: error.stack
    }, true);
  }

  /**
   * Update checkpoint with incremental changes
   *
   * Merges updates with existing checkpoint state.
   *
   * @param {Object} update - Updates to merge
   * @param {boolean} force - Force save
   * @returns {Promise<Object|null>} Save result
   */
  async update(update, force = false) {
    const existing = await this.load();
    if (!existing) {
      throw new Error(`No existing checkpoint to update for session: ${this.sessionId}`);
    }

    const merged = mergeCheckpointUpdate(existing, update);
    return this.save(merged, force);
  }

  /**
   * List checkpoint history for this session
   *
   * @param {number} limit - Maximum entries to return
   * @returns {Promise<Array>} Checkpoint history entries
   */
  async listHistory(limit = 10) {
    try {
      const history = await checkpointer.list(this.threadId, limit);

      return history.map(entry => ({
        version: entry.version,
        iteration: entry.checkpoint?.currentIteration,
        totalIterations: entry.checkpoint?.totalIterations,
        status: entry.checkpoint?.status,
        createdAt: entry.metadata?.createdAt,
        source: entry.metadata?.source
      }));
    } catch (error) {
      console.error(`[Checkpoint] Error listing history: ${error.message}`);
      return [];
    }
  }

  /**
   * Rollback to specific version
   *
   * Loads a specific checkpoint version for resumption.
   *
   * @param {number} version - Version to rollback to
   * @returns {Promise<Object>} Checkpoint at specified version
   * @throws {Error} If version not found
   */
  async rollback(version) {
    const checkpoint = await this.loadVersion(version);

    if (!checkpoint) {
      throw new Error(`Checkpoint version ${version} not found for session: ${this.sessionId}`);
    }

    return checkpoint;
  }

  /**
   * Delete all checkpoints for this session
   *
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      await checkpointer.delete(this.threadId);
      console.log(`[Checkpoint] Cleared all checkpoints for session: ${this.sessionId}`);
    } catch (error) {
      console.error(`[Checkpoint] Error clearing: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get summary of current checkpoint status
   *
   * @returns {Promise<Object|null>} Summary or null if no checkpoint
   */
  async getSummary() {
    const checkpoint = await this.load();
    return getCheckpointSummary(checkpoint);
  }

  /**
   * Check if training can be resumed
   *
   * @returns {Promise<boolean>} True if resumable
   */
  async canResume() {
    const checkpoint = await this.load();

    if (!checkpoint) {
      return false;
    }

    // Can resume if not completed or failed
    const status = checkpoint.status || 'unknown';
    return status !== 'completed' && status !== 'failed';
  }

  /**
   * Get checkpoint metrics
   *
   * @returns {Object} Metrics about checkpoint operations
   */
  getMetrics() {
    return {
      sessionId: this.sessionId,
      threadId: this.threadId,
      checkpointInterval: this.checkpointInterval,
      lastCheckpointIteration: this.lastCheckpointIteration,
      lastCheckpointTime: this.lastCheckpointTime,
      timeSinceLastCheckpoint: this.lastCheckpointTime
        ? Date.now() - this.lastCheckpointTime
        : null
    };
  }
}

/**
 * List all training sessions with checkpoints
 *
 * Note: This requires scanning Redis keys which can be expensive.
 * Use sparingly in production.
 *
 * @param {number} limit - Maximum sessions to return
 * @returns {Promise<Array>} List of session summaries
 */
export async function listTrainingSessions(limit = 20) {
  // This would require Redis SCAN which isn't directly exposed
  // by the current checkpointer. For now, return empty array.
  // Can be enhanced later with Redis key pattern scanning.
  console.warn('[Checkpoint] listTrainingSessions not fully implemented - requires Redis SCAN');
  return [];
}

/**
 * Get checkpoint status for multiple sessions
 *
 * @param {Array<string>} sessionIds - Session IDs to check
 * @returns {Promise<Object>} Map of sessionId to summary
 */
export async function getMultipleCheckpointStatus(sessionIds) {
  const results = {};

  for (const sessionId of sessionIds) {
    const manager = new TrainingCheckpointManager(sessionId);
    results[sessionId] = await manager.getSummary();
  }

  return results;
}

export default TrainingCheckpointManager;
