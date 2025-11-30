# Training Integration Gap 3: Checkpointer Integration for Resumable Training

## Executive Summary

**Gap**: The Redis checkpointer (`server/redis/checkpointer.js`) is fully implemented but not integrated with the training system. Training sessions cannot be paused, resumed, or recovered from crashes.

**Impact**:
- Lost progress if training crashes at iteration 150 of 500
- Cannot pause training for system maintenance
- No training session history or rollback capability
- 650 lines of checkpointer code unused

**Effort**: Low-Medium (4-6 hours)
**Priority**: High - Critical for reliability

**Note**: This plan can be implemented independently of Gap 2 (LangGraph). It provides resumable training using the existing checkpointer without requiring graph-based orchestration.

---

## Current State Analysis

### What Exists

1. **Redis Checkpointer** (`server/redis/checkpointer.js`)
   - `put(threadId, checkpoint, metadata)` - Store checkpoint
   - `get(threadId, version)` - Retrieve checkpoint
   - `getWithMetadata(threadId, version)` - Retrieve with metadata
   - `list(threadId, limit)` - List checkpoint history
   - `delete(threadId, version)` - Delete checkpoints
   - Version management (keeps last 10 versions)
   - Compression for large states
   - 24-hour TTL

2. **Training System** (`server/routes/training.js`)
   - Sequential iteration loop
   - In-memory state only
   - No checkpoint save/restore
   - State lost on crash/restart

### The Gap

```javascript
// Current training loop - NO checkpointing
for (let i = 0; i < iterations; i++) {
  // Process iteration
  // State exists ONLY in memory
  // If crash here, ALL progress lost
}
```

```javascript
// Available but unused (checkpointer.js)
await checkpointer.put('training:session123', {
  iteration: 150,
  evolutionState: { ... },
  results: [ ... ]
});

// Later: restore
const checkpoint = await checkpointer.get('training:session123');
// Resume from iteration 150
```

---

## Implementation Plan

### Phase 1: Define Checkpoint Schema

**Step 1.1: Create training checkpoint schema**

```javascript
// server/utils/trainingCheckpoint.js

/**
 * Training checkpoint schema
 * Defines what state is saved/restored
 */
export const TrainingCheckpointSchema = {
  // Session identification
  sessionId: String,
  startedAt: Number,
  lastCheckpointAt: Number,

  // Iteration progress
  currentIteration: Number,
  totalIterations: Number,
  completedSampleSets: Array,

  // Evolution engine state (serializable)
  evolutionState: Object,

  // Accumulated results
  results: Array,
  errors: Array,

  // Statistics
  stats: {
    successCount: Number,
    errorCount: Number,
    cacheHits: Number,
    cacheMisses: Number
  },

  // Configuration used
  config: {
    sampleSets: Array,
    contentTypes: Array,
    options: Object
  }
};

/**
 * Validate checkpoint before save
 */
export function validateCheckpoint(checkpoint) {
  const required = ['sessionId', 'currentIteration', 'totalIterations'];
  for (const field of required) {
    if (checkpoint[field] === undefined) {
      throw new Error(`Missing required checkpoint field: ${field}`);
    }
  }
  return true;
}

/**
 * Create initial checkpoint
 */
export function createInitialCheckpoint(sessionId, config) {
  return {
    sessionId,
    startedAt: Date.now(),
    lastCheckpointAt: Date.now(),
    currentIteration: 0,
    totalIterations: config.iterations,
    completedSampleSets: [],
    evolutionState: null,
    results: [],
    errors: [],
    stats: {
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    },
    config: {
      sampleSets: config.sampleSets.map(s => s.name),
      contentTypes: config.contentTypes,
      options: config.options || {}
    }
  };
}
```

### Phase 2: Add Checkpoint Manager

**Step 2.1: Create checkpoint manager utility**

```javascript
// server/utils/trainingCheckpointManager.js

import { checkpointer } from '../redis/checkpointer.js';
import { validateCheckpoint, createInitialCheckpoint } from './trainingCheckpoint.js';

const CHECKPOINT_PREFIX = 'training';
const CHECKPOINT_INTERVAL = 10; // Save every N iterations

/**
 * Training Checkpoint Manager
 * Handles save/restore of training state
 */
export class TrainingCheckpointManager {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.threadId = `${CHECKPOINT_PREFIX}:${sessionId}`;
    this.checkpointInterval = options.checkpointInterval || CHECKPOINT_INTERVAL;
    this.lastCheckpointIteration = 0;
  }

  /**
   * Generate thread ID for a session
   */
  static getThreadId(sessionId) {
    return `${CHECKPOINT_PREFIX}:${sessionId}`;
  }

  /**
   * Check if checkpoint exists for session
   */
  async exists() {
    const checkpoint = await checkpointer.get(this.threadId);
    return checkpoint !== null;
  }

  /**
   * Load checkpoint for session
   * @returns {Object|null} Checkpoint or null if not found
   */
  async load() {
    const result = await checkpointer.getWithMetadata(this.threadId);

    if (!result) {
      console.log(`[Checkpoint] No checkpoint found for session: ${this.sessionId}`);
      return null;
    }

    console.log(`[Checkpoint] Loaded checkpoint v${result.metadata?.version} for session: ${this.sessionId}`);
    console.log(`[Checkpoint] Resuming from iteration ${result.checkpoint.currentIteration}`);

    return result.checkpoint;
  }

  /**
   * Save checkpoint
   * @param {Object} state - Current training state
   * @param {boolean} force - Force save even if not at interval
   */
  async save(state, force = false) {
    // Check if we should save (at interval or forced)
    const iterationsSinceLastCheckpoint = state.currentIteration - this.lastCheckpointIteration;

    if (!force && iterationsSinceLastCheckpoint < this.checkpointInterval) {
      return null;
    }

    const checkpoint = {
      ...state,
      lastCheckpointAt: Date.now()
    };

    try {
      validateCheckpoint(checkpoint);

      const result = await checkpointer.put(this.threadId, checkpoint, {
        source: 'training-loop',
        iteration: state.currentIteration
      });

      this.lastCheckpointIteration = state.currentIteration;
      console.log(`[Checkpoint] Saved at iteration ${state.currentIteration} (v${result.version})`);

      return result;
    } catch (error) {
      console.error(`[Checkpoint] Failed to save: ${error.message}`);
      // Don't throw - checkpoint failure shouldn't stop training
      return null;
    }
  }

  /**
   * Save final checkpoint when training completes
   */
  async saveFinaI(state) {
    return this.save({
      ...state,
      status: 'completed',
      completedAt: Date.now()
    }, true);
  }

  /**
   * Save error checkpoint when training fails
   */
  async saveError(state, error) {
    return this.save({
      ...state,
      status: 'failed',
      failedAt: Date.now(),
      failureReason: error.message
    }, true);
  }

  /**
   * List checkpoint history
   */
  async listHistory(limit = 10) {
    return checkpointer.list(this.threadId, limit);
  }

  /**
   * Rollback to specific version
   */
  async rollback(version) {
    const checkpoint = await checkpointer.get(this.threadId, version);
    if (!checkpoint) {
      throw new Error(`Checkpoint version ${version} not found`);
    }
    return checkpoint;
  }

  /**
   * Delete all checkpoints for session
   */
  async clear() {
    return checkpointer.delete(this.threadId);
  }
}

/**
 * List all training sessions with checkpoints
 */
export async function listTrainingSessions(limit = 20) {
  // This would need a Redis SCAN implementation
  // For now, return empty - can be enhanced later
  return [];
}
```

### Phase 3: Integrate with Training Route

**Step 3.1: Add imports to training.js**

```javascript
// server/routes/training.js - Add imports
import { TrainingCheckpointManager } from '../utils/trainingCheckpointManager.js';
import { createInitialCheckpoint } from '../utils/trainingCheckpoint.js';
```

**Step 3.2: Add session management**

```javascript
// server/routes/training.js - Add session tracking
const activeSessions = new Map();

/**
 * Get or create checkpoint manager for session
 */
function getCheckpointManager(sessionId, options = {}) {
  if (!activeSessions.has(sessionId)) {
    activeSessions.set(sessionId, new TrainingCheckpointManager(sessionId, options));
  }
  return activeSessions.get(sessionId);
}
```

**Step 3.3: Modify main training function**

```javascript
// server/routes/training.js - Modified runTraining function

async function runTraining(config) {
  const {
    sessionId = `session_${Date.now()}`,
    iterations = 10,
    resume = false,
    checkpointInterval = 10
  } = config;

  const checkpointManager = getCheckpointManager(sessionId, { checkpointInterval });
  let state;

  // Check for resume
  if (resume) {
    const existingCheckpoint = await checkpointManager.load();
    if (existingCheckpoint) {
      state = existingCheckpoint;
      console.log(`Resuming training session ${sessionId} from iteration ${state.currentIteration}`);
    } else {
      console.log(`No checkpoint found for ${sessionId}, starting fresh`);
      state = createInitialCheckpoint(sessionId, config);
    }
  } else {
    // Check if session already exists
    if (await checkpointManager.exists()) {
      throw new Error(`Session ${sessionId} already exists. Use resume=true to continue or choose a new sessionId.`);
    }
    state = createInitialCheckpoint(sessionId, config);
  }

  // Initialize evolution engine
  const engine = state.evolutionState
    ? PromptEvolutionEngine.deserialize(state.evolutionState)
    : initializeEvolution();

  // Update state for running
  trainingState.isRunning = true;
  trainingState.sessionId = sessionId;
  trainingState.startTime = state.startedAt;

  try {
    // Main training loop
    for (let i = state.currentIteration; i < state.totalIterations; i++) {
      // Check for stop signal
      if (trainingState.shouldStop) {
        console.log('Training stopped by user');
        await checkpointManager.save(state, true);
        break;
      }

      // Process iteration
      const iterationResult = await processIteration(i, state, engine, config);

      // Update state
      state.currentIteration = i + 1;
      state.results.push(...iterationResult.results);
      state.errors.push(...iterationResult.errors);
      state.stats.successCount += iterationResult.successes;
      state.stats.errorCount += iterationResult.errors.length;
      state.stats.cacheHits += iterationResult.cacheHits;
      state.stats.cacheMisses += iterationResult.cacheMisses;
      state.evolutionState = engine.serialize();

      // Periodic checkpoint
      await checkpointManager.save(state);

      // Update live status
      trainingState.currentIteration = i + 1;
      trainingState.lastUpdate = Date.now();
    }

    // Training complete
    state.status = 'completed';
    state.completedAt = Date.now();
    await checkpointManager.saveFinal(state);

    trainingState.isRunning = false;
    return state;

  } catch (error) {
    // Save error checkpoint
    await checkpointManager.saveError(state, error);
    trainingState.isRunning = false;
    throw error;
  }
}
```

**Step 3.4: Add resume endpoint**

```javascript
// server/routes/training.js - Add resume endpoint

/**
 * Resume training session
 * GET /api/train/resume/:sessionId
 */
router.get('/resume/:sessionId', async (req, res) => {
  const secret = req.query.secret;
  const { sessionId } = req.params;

  // Validate secret
  if (secret !== process.env.TRAINING_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  // Check if training already running
  if (trainingState.isRunning) {
    return res.status(409).json({
      error: 'Training already in progress',
      sessionId: trainingState.sessionId
    });
  }

  try {
    const result = await runTraining({
      sessionId,
      resume: true
    });

    res.json({
      success: true,
      sessionId,
      resumed: true,
      summary: {
        iterations: result.currentIteration,
        successes: result.stats.successCount,
        errors: result.stats.errorCount,
        status: result.status
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

**Step 3.5: Add checkpoint management endpoints**

```javascript
// server/routes/training.js - Add checkpoint endpoints

/**
 * Get checkpoint history for session
 * GET /api/train/checkpoints/:sessionId
 */
router.get('/checkpoints/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const manager = new TrainingCheckpointManager(sessionId);
    const history = await manager.listHistory(limit);

    res.json({
      sessionId,
      checkpoints: history.map(h => ({
        version: h.version,
        iteration: h.checkpoint?.currentIteration,
        createdAt: h.metadata?.createdAt,
        status: h.checkpoint?.status || 'in_progress'
      }))
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get specific checkpoint
 * GET /api/train/checkpoints/:sessionId/:version
 */
router.get('/checkpoints/:sessionId/:version', async (req, res) => {
  const { sessionId, version } = req.params;

  try {
    const manager = new TrainingCheckpointManager(sessionId);
    const checkpoint = await manager.rollback(parseInt(version));

    if (!checkpoint) {
      return res.status(404).json({ error: 'Checkpoint not found' });
    }

    res.json({
      sessionId,
      version: parseInt(version),
      checkpoint: {
        iteration: checkpoint.currentIteration,
        totalIterations: checkpoint.totalIterations,
        status: checkpoint.status,
        stats: checkpoint.stats,
        createdAt: checkpoint.lastCheckpointAt
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete session checkpoints
 * DELETE /api/train/checkpoints/:sessionId
 */
router.delete('/checkpoints/:sessionId', async (req, res) => {
  const secret = req.query.secret;
  const { sessionId } = req.params;

  if (secret !== process.env.TRAINING_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  try {
    const manager = new TrainingCheckpointManager(sessionId);
    await manager.clear();

    res.json({
      success: true,
      message: `Checkpoints deleted for session: ${sessionId}`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Phase 4: Add Evolution Engine Serialization

**Step 4.1: Add serialize/deserialize to PromptEvolutionEngine**

```javascript
// server/utils/promptEvolution.js - Add to PromptEvolutionEngine class

/**
 * Serialize engine state for checkpoint
 * @returns {Object} Serializable state
 */
serialize() {
  return {
    promptVersions: JSON.parse(JSON.stringify(this.promptVersions)),
    evolutionStats: { ...this.evolutionStats },
    config: { ...this.config }
  };
}

/**
 * Deserialize engine from checkpoint
 * @param {Object} state - Serialized state
 * @returns {PromptEvolutionEngine}
 */
static deserialize(state) {
  if (!state) return null;

  const engine = new PromptEvolutionEngine(state.config);
  engine.promptVersions = state.promptVersions;
  engine.evolutionStats = state.evolutionStats;

  return engine;
}
```

### Phase 5: Update Status Endpoint

**Step 5.1: Include checkpoint info in status**

```javascript
// server/routes/training.js - Updated status endpoint

router.get('/status', async (req, res) => {
  const { sessionId } = req.query;

  let checkpointInfo = null;

  if (sessionId || trainingState.sessionId) {
    const sid = sessionId || trainingState.sessionId;
    const manager = new TrainingCheckpointManager(sid);

    if (await manager.exists()) {
      const history = await manager.listHistory(1);
      if (history.length > 0) {
        checkpointInfo = {
          lastCheckpoint: history[0].metadata?.createdAt,
          version: history[0].version,
          canResume: !trainingState.isRunning
        };
      }
    }
  }

  res.json({
    isRunning: trainingState.isRunning,
    sessionId: trainingState.sessionId,
    currentIteration: trainingState.currentIteration,
    totalIterations: trainingState.totalIterations,
    startTime: trainingState.startTime,
    lastUpdate: trainingState.lastUpdate,
    checkpoint: checkpointInfo
  });
});
```

---

## API Reference After Implementation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/train?sessionId=x` | GET | Start new training with session ID |
| `/api/train/resume/:sessionId` | GET | Resume from checkpoint |
| `/api/train/status?sessionId=x` | GET | Get status with checkpoint info |
| `/api/train/checkpoints/:sessionId` | GET | List checkpoint history |
| `/api/train/checkpoints/:sessionId/:version` | GET | Get specific checkpoint |
| `/api/train/checkpoints/:sessionId` | DELETE | Delete session checkpoints |

---

## File Changes Summary

| File | Action | Lines |
|------|--------|-------|
| `server/utils/trainingCheckpoint.js` | NEW | ~60 |
| `server/utils/trainingCheckpointManager.js` | NEW | ~150 |
| `server/utils/promptEvolution.js` | MODIFY | ~30 |
| `server/routes/training.js` | MODIFY | ~150 |

---

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/training-checkpoint.test.js

describe('TrainingCheckpointManager', () => {
  let manager;

  beforeEach(() => {
    manager = new TrainingCheckpointManager('test-session');
  });

  test('save creates checkpoint', async () => {
    const state = {
      sessionId: 'test-session',
      currentIteration: 10,
      totalIterations: 100
    };

    const result = await manager.save(state, true);
    expect(result).toBeDefined();
    expect(result.version).toBeDefined();
  });

  test('load retrieves checkpoint', async () => {
    // Save first
    await manager.save({ currentIteration: 50 }, true);

    // Load
    const checkpoint = await manager.load();
    expect(checkpoint.currentIteration).toBe(50);
  });

  test('respects checkpoint interval', async () => {
    const state = { currentIteration: 5 };

    // Should not save (interval is 10)
    const result = await manager.save(state, false);
    expect(result).toBeNull();
  });
});
```

### Integration Tests

```javascript
// tests/integration/training-resume.test.js

describe('Training Resume', () => {
  test('can resume from checkpoint', async () => {
    // Start training
    const response1 = await request(app)
      .get('/api/train?iterations=20&sessionId=resume-test&secret=test');

    // Stop at some point
    await request(app).get('/api/train/stop?secret=test');

    // Wait for checkpoint save
    await sleep(1000);

    // Resume
    const response2 = await request(app)
      .get('/api/train/resume/resume-test?secret=test');

    expect(response2.body.resumed).toBe(true);
    expect(response2.body.summary.iterations).toBeGreaterThan(0);
  });

  test('resume fails for non-existent session', async () => {
    const response = await request(app)
      .get('/api/train/resume/nonexistent?secret=test');

    expect(response.status).toBe(500);
  });
});
```

### Manual Testing Checklist

- [ ] Start training with explicit sessionId
- [ ] Verify checkpoints created in Redis
- [ ] Stop training mid-run
- [ ] Resume training and verify continuation
- [ ] Check checkpoint history endpoint
- [ ] Test rollback to specific version
- [ ] Verify final checkpoint on completion
- [ ] Test error checkpoint on failure

---

## Rollback Plan

1. Remove checkpoint manager imports
2. Revert runTraining to original loop
3. Remove new endpoints
4. Existing checkpointer.js remains unchanged

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Checkpoint saving | Every 10 iterations |
| Resume accuracy | Exact iteration continuation |
| No data loss | All results preserved |
| Rollback works | Can restore to any version |
| Minimal overhead | <100ms checkpoint save |

---

## Estimated Timeline

| Phase | Duration |
|-------|----------|
| Phase 1: Schema | 30 min |
| Phase 2: Manager | 1.5 hours |
| Phase 3: Route Integration | 2 hours |
| Phase 4: Evolution Serialization | 30 min |
| Phase 5: Status Update | 30 min |
| Testing | 1.5 hours |
| **Total** | **~6 hours** |

---

## Dependencies

- Redis server running
- Existing checkpointer.js (no modifications needed)
- Independent of LangGraph (Gap 2)
- Can combine with DSPy cache (Gap 1)
