/**
 * LangGraph Checkpointer Adapter
 *
 * Gap 02: Adapts the existing Redis checkpointer to LangGraph's BaseCheckpointSaver interface.
 *
 * This adapter bridges our Redis-based checkpoint storage with LangGraph's
 * state persistence system, enabling:
 * - Workflow state persistence across sessions
 * - Training session resumption
 * - Checkpoint versioning and rollback
 *
 * Usage:
 *   import { langGraphCheckpointer } from './redis/langgraph-checkpointer.js';
 *
 *   const graph = new StateGraph(TrainingState)
 *     .addNode(...)
 *     .compile({ checkpointer: langGraphCheckpointer });
 *
 *   // Run with thread_id for persistence
 *   await graph.invoke(input, { configurable: { thread_id: 'training:session123' } });
 */

import { BaseCheckpointSaver } from '@langchain/langgraph';
import { checkpointer } from './checkpointer.js';

/**
 * Adapter to make our Redis checkpointer compatible with LangGraph's interface
 *
 * LangGraph expects:
 * - getTuple(config) -> CheckpointTuple | undefined
 * - list(config, options) -> AsyncGenerator<CheckpointTuple>
 * - put(config, checkpoint, metadata) -> config with checkpoint_id
 */
export class LangGraphCheckpointerAdapter extends BaseCheckpointSaver {
  constructor() {
    super();
    this.checkpointer = checkpointer;
  }

  /**
   * Extract thread_id from LangGraph config
   * @param {Object} config - LangGraph config object
   * @returns {string|null} Thread ID
   */
  _getThreadId(config) {
    return config?.configurable?.thread_id || null;
  }

  /**
   * Extract checkpoint_id (version) from LangGraph config
   * @param {Object} config - LangGraph config object
   * @returns {number|null} Checkpoint version
   */
  _getVersion(config) {
    const checkpointId = config?.configurable?.checkpoint_id;
    if (checkpointId) {
      return parseInt(checkpointId, 10);
    }
    return null;
  }

  /**
   * Get a checkpoint tuple for a given config
   *
   * LangGraph calls this to retrieve the current state for a thread.
   *
   * @param {Object} config - Configuration with thread_id
   * @returns {Promise<CheckpointTuple|undefined>} Checkpoint tuple or undefined
   */
  async getTuple(config) {
    const threadId = this._getThreadId(config);
    if (!threadId) {
      return undefined;
    }

    const version = this._getVersion(config);

    try {
      const result = await this.checkpointer.getWithMetadata(threadId, version);

      if (!result || !result.checkpoint) {
        return undefined;
      }

      // Convert to LangGraph CheckpointTuple format
      return {
        config: {
          configurable: {
            thread_id: threadId,
            checkpoint_id: String(result.metadata?.version || 1)
          }
        },
        checkpoint: result.checkpoint,
        metadata: result.metadata || {},
        parentConfig: result.metadata?.parentVersion ? {
          configurable: {
            thread_id: threadId,
            checkpoint_id: String(result.metadata.parentVersion)
          }
        } : undefined
      };
    } catch (error) {
      console.error(`[LangGraphCheckpointer] Error getting checkpoint: ${error.message}`);
      return undefined;
    }
  }

  /**
   * List checkpoints for a thread
   *
   * LangGraph uses this to retrieve checkpoint history.
   *
   * @param {Object} config - Configuration
   * @param {Object} options - List options (limit, before)
   * @yields {CheckpointTuple} Checkpoint tuples
   */
  async *list(config, options = {}) {
    const threadId = this._getThreadId(config);
    if (!threadId) {
      return;
    }

    const limit = options?.limit || 10;

    try {
      const history = await this.checkpointer.list(threadId, limit);

      for (const entry of history) {
        yield {
          config: {
            configurable: {
              thread_id: threadId,
              checkpoint_id: String(entry.version)
            }
          },
          checkpoint: entry.checkpoint,
          metadata: entry.metadata || {},
          parentConfig: entry.metadata?.parentVersion ? {
            configurable: {
              thread_id: threadId,
              checkpoint_id: String(entry.metadata.parentVersion)
            }
          } : undefined
        };
      }
    } catch (error) {
      console.error(`[LangGraphCheckpointer] Error listing checkpoints: ${error.message}`);
    }
  }

  /**
   * Save a checkpoint
   *
   * LangGraph calls this after each node execution to persist state.
   *
   * @param {Object} config - Configuration
   * @param {Object} checkpoint - Checkpoint data (channel_values, channel_versions, etc.)
   * @param {Object} metadata - Checkpoint metadata (step, source, etc.)
   * @returns {Promise<Object>} Updated config with new checkpoint_id
   */
  async put(config, checkpoint, metadata = {}) {
    const threadId = this._getThreadId(config);
    if (!threadId) {
      throw new Error('thread_id required in config.configurable');
    }

    const parentVersion = this._getVersion(config);

    try {
      // Store checkpoint with our Redis checkpointer
      const result = await this.checkpointer.put(threadId, checkpoint, {
        ...metadata,
        parentVersion,
        source: metadata?.source || 'langgraph',
        step: metadata?.step,
        writes: metadata?.writes
      });

      // Return config with new checkpoint_id
      return {
        configurable: {
          thread_id: threadId,
          checkpoint_id: String(result.version)
        }
      };
    } catch (error) {
      console.error(`[LangGraphCheckpointer] Error saving checkpoint: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a checkpoint (optional in LangGraph)
   *
   * @param {Object} config - Configuration
   */
  async delete(config) {
    const threadId = this._getThreadId(config);
    const version = this._getVersion(config);

    if (threadId) {
      try {
        await this.checkpointer.delete(threadId, version);
      } catch (error) {
        console.error(`[LangGraphCheckpointer] Error deleting checkpoint: ${error.message}`);
      }
    }
  }

  /**
   * Get metrics from underlying checkpointer
   * @returns {Object} Metrics
   */
  getMetrics() {
    return this.checkpointer.getMetrics();
  }
}

// Export singleton instance
export const langGraphCheckpointer = new LangGraphCheckpointerAdapter();

export default langGraphCheckpointer;
