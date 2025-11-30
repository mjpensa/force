# Training Integration Gap 2: LangGraph Installation & Integration

## Executive Summary

**Gap**: LangGraph is not installed as a package dependency, yet Plan 10 designed an entire Redis checkpointer system (650 lines) for it. The training system uses sequential layer processing instead of graph-based workflow orchestration.

**Impact**:
- No graph-based workflow control
- No conditional branching or dynamic routing
- Checkpointer infrastructure has no consumer
- Cannot leverage LangGraph's built-in state management

**Effort**: Medium-High (8-16 hours)
**Priority**: High - Architectural alignment

---

## Current State Analysis

### What Exists

1. **Redis Checkpointer** (`server/redis/checkpointer.js`)
   - LangGraph-compatible interface designed
   - `put()`, `get()`, `list()`, `delete()` methods
   - Version management and rollback
   - Compression and TTL support
   - 650 lines of code ready for LangGraph

2. **Sequential Processing** (`server/routes/training.js`)
   - Linear iteration through samples
   - No graph nodes or edges
   - Manual control flow

3. **Layer Architecture** (`server/layers/`)
   - Signatures, context, optimization, etc.
   - Function-based, not graph-based

### Package Status

```json
// package.json - CURRENT
{
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "ioredis": "^5.4.1"
    // NO LangGraph package
  }
}
```

### Architecture Mismatch

**Designed** (from REDIS_INTEGRATION_DESIGN.md):
```
Orchestrator: LangGraph (StateGraph)
Intelligence: DSPy (Signatures & Modules)
Memory: Redis (LangGraph Checkpointer & DSPy Cache)
```

**Implemented**:
```
Orchestrator: Sequential functions
Intelligence: Custom signatures (DSPy-style)
Memory: Redis (ready but disconnected)
```

---

## Technology Options

### Option A: LangGraph.js (Recommended)

**Package**: `@langchain/langgraph`

LangChain provides a JavaScript/TypeScript port of LangGraph that works in Node.js environments.

```bash
npm install @langchain/langgraph @langchain/core
```

**Pros**:
- Native Node.js integration
- TypeScript support
- Active development
- Compatible with existing Redis checkpointer design

**Cons**:
- Slightly behind Python version in features
- Requires LangChain core dependency

### Option B: Custom Graph Implementation

Build a lightweight graph orchestrator that uses the existing checkpointer.

**Pros**:
- No external dependencies
- Full control over implementation
- Tailored to training needs

**Cons**:
- More development effort
- No community support
- Must maintain ourselves

### Option C: Python LangGraph via Subprocess

Run Python LangGraph as a subprocess for orchestration.

**Pros**:
- Full LangGraph feature set
- Mature Python ecosystem

**Cons**:
- Complex architecture (Node.js + Python)
- Performance overhead
- Deployment complexity

**Recommendation**: Option A (LangGraph.js) for best balance of features and integration.

---

## Implementation Plan

### Phase 1: Install Dependencies

**Step 1.1: Add LangGraph packages**

```bash
npm install @langchain/langgraph @langchain/core
```

**Step 1.2: Update package.json**

```json
{
  "dependencies": {
    "@langchain/langgraph": "^0.2.0",
    "@langchain/core": "^0.3.0",
    // existing deps...
  }
}
```

**Step 1.3: Verify installation**

```javascript
// scripts/verify-langgraph.js
import { StateGraph, END } from '@langchain/langgraph';
import { BaseCheckpointSaver } from '@langchain/langgraph';

console.log('LangGraph installed successfully');
console.log('StateGraph:', typeof StateGraph);
console.log('BaseCheckpointSaver:', typeof BaseCheckpointSaver);
```

### Phase 2: Create LangGraph Adapter for Redis Checkpointer

**Step 2.1: Create adapter class**

```javascript
// server/redis/langgraph-checkpointer-adapter.js

import { BaseCheckpointSaver } from '@langchain/langgraph';
import { checkpointer } from './checkpointer.js';

/**
 * Adapter to make our Redis checkpointer compatible with LangGraph's interface
 */
export class RedisCheckpointerAdapter extends BaseCheckpointSaver {
  constructor() {
    super();
    this.checkpointer = checkpointer;
  }

  /**
   * Get a checkpoint tuple for a given config
   * @param {Object} config - Configuration with thread_id
   * @returns {Promise<CheckpointTuple|undefined>}
   */
  async getTuple(config) {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return undefined;

    const result = await this.checkpointer.getWithMetadata(threadId);
    if (!result) return undefined;

    return {
      checkpoint: result.checkpoint,
      metadata: result.metadata,
      config: {
        configurable: {
          thread_id: threadId,
          checkpoint_id: result.metadata?.version?.toString()
        }
      },
      parentConfig: result.metadata?.parentId ? {
        configurable: {
          thread_id: threadId,
          checkpoint_id: result.metadata.parentId
        }
      } : undefined
    };
  }

  /**
   * List checkpoints for a thread
   * @param {Object} config - Configuration
   * @param {Object} options - List options
   * @returns {AsyncGenerator<CheckpointTuple>}
   */
  async *list(config, options = {}) {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return;

    const limit = options.limit || 10;
    const history = await this.checkpointer.list(threadId, limit);

    for (const entry of history) {
      yield {
        checkpoint: entry.checkpoint,
        metadata: entry.metadata,
        config: {
          configurable: {
            thread_id: threadId,
            checkpoint_id: entry.version?.toString()
          }
        }
      };
    }
  }

  /**
   * Save a checkpoint
   * @param {Object} config - Configuration
   * @param {Object} checkpoint - Checkpoint data
   * @param {Object} metadata - Checkpoint metadata
   * @returns {Promise<Object>} Updated config
   */
  async put(config, checkpoint, metadata) {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error('thread_id required in config.configurable');
    }

    const result = await this.checkpointer.put(threadId, checkpoint, {
      ...metadata,
      parentId: config.configurable?.checkpoint_id
    });

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_id: result.version?.toString()
      }
    };
  }

  /**
   * Delete a checkpoint
   * @param {Object} config - Configuration
   */
  async delete(config) {
    const threadId = config.configurable?.thread_id;
    const version = config.configurable?.checkpoint_id;

    if (threadId) {
      await this.checkpointer.delete(threadId, version ? parseInt(version) : null);
    }
  }
}

// Export singleton instance
export const langGraphCheckpointer = new RedisCheckpointerAdapter();
```

### Phase 3: Define Training State Schema

**Step 3.1: Create state definition**

```javascript
// server/workflows/training-state.js

import { Annotation } from '@langchain/langgraph';

/**
 * Training workflow state schema
 * Defines all state channels for the training graph
 */
export const TrainingState = Annotation.Root({
  // Session identification
  sessionId: Annotation({
    reducer: (_, b) => b,
    default: () => null
  }),

  // Iteration tracking
  currentIteration: Annotation({
    reducer: (_, b) => b,
    default: () => 0
  }),

  totalIterations: Annotation({
    reducer: (_, b) => b,
    default: () => 0
  }),

  // Current sample being processed
  currentSample: Annotation({
    reducer: (_, b) => b,
    default: () => null
  }),

  currentContentType: Annotation({
    reducer: (_, b) => b,
    default: () => null
  }),

  // Training data
  sampleSets: Annotation({
    reducer: (_, b) => b,
    default: () => []
  }),

  contentTypes: Annotation({
    reducer: (_, b) => b,
    default: () => ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis']
  }),

  // Results accumulator
  results: Annotation({
    reducer: (a, b) => [...a, ...b],
    default: () => []
  }),

  // Error tracking
  errors: Annotation({
    reducer: (a, b) => [...a, ...b],
    default: () => []
  }),

  // Evolution engine state (serialized)
  evolutionState: Annotation({
    reducer: (_, b) => b,
    default: () => null
  }),

  // Cache statistics
  cacheStats: Annotation({
    reducer: (a, b) => ({
      hits: (a?.hits || 0) + (b?.hits || 0),
      misses: (a?.misses || 0) + (b?.misses || 0)
    }),
    default: () => ({ hits: 0, misses: 0 })
  }),

  // Control flags
  shouldStop: Annotation({
    reducer: (_, b) => b,
    default: () => false
  }),

  // Current phase
  phase: Annotation({
    reducer: (_, b) => b,
    default: () => 'initialize'
  })
});
```

### Phase 4: Create Graph Nodes

**Step 4.1: Initialize node**

```javascript
// server/workflows/nodes/initialize.js

import { PromptEvolutionEngine } from '../../utils/promptEvolution.js';

/**
 * Initialize training session
 * Sets up evolution engine and loads sample sets
 */
export async function initializeNode(state) {
  console.log('[Graph] Initializing training session...');

  // Create evolution engine
  const engine = new PromptEvolutionEngine({
    promotionThreshold: 0.05,
    minCandidateSamples: 10,
    minChampionSamples: 35,
    abTestRatio: 0.2
  });

  // Initialize with prompts
  const prompts = {};
  for (const type of state.contentTypes) {
    prompts[type] = state.sampleSets[0]?.prompts?.[type] || `Generate ${type} content`;
  }
  engine.initialize(prompts);

  return {
    evolutionState: engine.serialize(),
    phase: 'select_sample',
    currentIteration: 0
  };
}
```

**Step 4.2: Sample selection node**

```javascript
// server/workflows/nodes/select-sample.js

/**
 * Select next sample and content type for processing
 */
export async function selectSampleNode(state) {
  const { sampleSets, contentTypes, currentIteration, totalIterations } = state;

  if (currentIteration >= totalIterations) {
    return {
      phase: 'finalize',
      shouldStop: true
    };
  }

  // Calculate which sample set and content type
  const numContentTypes = contentTypes.length;
  const numSampleSets = sampleSets.length;
  const cycleSize = numContentTypes * numSampleSets;

  const cyclePosition = currentIteration % cycleSize;
  const sampleSetIndex = Math.floor(cyclePosition / numContentTypes);
  const contentTypeIndex = cyclePosition % numContentTypes;

  const currentSample = sampleSets[sampleSetIndex];
  const currentContentType = contentTypes[contentTypeIndex];

  console.log(`[Graph] Iteration ${currentIteration + 1}/${totalIterations}: ${currentContentType} from ${currentSample.name}`);

  return {
    currentSample,
    currentContentType,
    phase: 'generate'
  };
}
```

**Step 4.3: Generation node**

```javascript
// server/workflows/nodes/generate.js

import { executeWithCache } from '../../utils/dspyExecutor.js';
import { PromptEvolutionEngine } from '../../utils/promptEvolution.js';

/**
 * Generate content using current sample and content type
 */
export async function generateNode(state) {
  const { currentSample, currentContentType, evolutionState } = state;

  // Restore evolution engine
  const engine = PromptEvolutionEngine.deserialize(evolutionState);

  // Get prompt variant (A/B testing)
  const { prompt, variant } = engine.getPromptForGeneration(currentContentType);

  // Prepare inputs
  const signatureType = currentContentType.toLowerCase().replace('researchanalysis', 'research-analysis');
  const userPrompt = currentSample.prompts[currentContentType];
  const researchFiles = currentSample.files || [];

  try {
    // Execute with caching
    const result = await executeWithCache(
      signatureType,
      { prompt: userPrompt, researchFiles },
      async () => {
        // Actual generation logic here
        return await generateContent(currentContentType, userPrompt, researchFiles, prompt);
      }
    );

    const cacheHit = result.__cacheHit ? 1 : 0;

    return {
      results: [{
        iteration: state.currentIteration,
        contentType: currentContentType,
        sampleSet: currentSample.name,
        variant,
        success: true,
        cacheHit: !!result.__cacheHit
      }],
      cacheStats: {
        hits: cacheHit,
        misses: cacheHit ? 0 : 1
      },
      phase: 'evaluate'
    };

  } catch (error) {
    return {
      errors: [{
        iteration: state.currentIteration,
        contentType: currentContentType,
        error: error.message
      }],
      cacheStats: { hits: 0, misses: 1 },
      phase: 'evaluate'
    };
  }
}

async function generateContent(contentType, userPrompt, researchFiles, systemPrompt) {
  // Import and call appropriate generator
  // This would call existing generation functions
}
```

**Step 4.4: Evaluation node**

```javascript
// server/workflows/nodes/evaluate.js

import { scoreContentQuality } from '../../utils/contentQualityScoring.js';
import { PromptEvolutionEngine } from '../../utils/promptEvolution.js';

/**
 * Evaluate generation result and update evolution engine
 */
export async function evaluateNode(state) {
  const { results, evolutionState, currentIteration } = state;
  const latestResult = results[results.length - 1];

  if (!latestResult || !latestResult.success) {
    return {
      currentIteration: currentIteration + 1,
      phase: 'check_evolution'
    };
  }

  // Score quality
  const qualityScore = scoreContentQuality(latestResult.data, latestResult.contentType);

  // Update evolution engine
  const engine = PromptEvolutionEngine.deserialize(evolutionState);
  engine.recordGeneration(
    latestResult.contentType,
    latestResult.prompt,
    latestResult.data,
    qualityScore
  );

  return {
    evolutionState: engine.serialize(),
    currentIteration: currentIteration + 1,
    phase: 'check_evolution'
  };
}
```

**Step 4.5: Evolution check node**

```javascript
// server/workflows/nodes/check-evolution.js

import { PromptEvolutionEngine } from '../../utils/promptEvolution.js';

const EVOLUTION_INTERVAL = 50;

/**
 * Check if evolution cycle should run
 */
export async function checkEvolutionNode(state) {
  const { currentIteration, evolutionState, contentTypes } = state;

  // Only run evolution at intervals
  if (currentIteration % EVOLUTION_INTERVAL !== 0 || currentIteration === 0) {
    return { phase: 'select_sample' };
  }

  console.log(`[Graph] Running evolution cycle at iteration ${currentIteration}`);

  const engine = PromptEvolutionEngine.deserialize(evolutionState);

  for (const contentType of contentTypes) {
    // Check promotions
    const promoteResult = engine.checkAndPromote(contentType);
    if (promoteResult.promoted) {
      console.log(`   Promoted ${contentType} candidate (${promoteResult.improvement?.toFixed(1)}% improvement)`);
    }

    // Evolve new candidates
    const evolveResult = engine.evolvePrompt(contentType);
    if (evolveResult.evolved) {
      console.log(`   Evolved ${contentType} with: ${evolveResult.appliedMutations?.map(m => m.type).join(', ')}`);
    }
  }

  return {
    evolutionState: engine.serialize(),
    phase: 'select_sample'
  };
}
```

**Step 4.6: Finalize node**

```javascript
// server/workflows/nodes/finalize.js

/**
 * Finalize training and generate summary
 */
export async function finalizeNode(state) {
  const { results, errors, cacheStats, currentIteration } = state;

  const successCount = results.filter(r => r.success).length;
  const errorCount = errors.length;
  const hitRate = cacheStats.hits + cacheStats.misses > 0
    ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1)
    : '0';

  console.log('\n=== Training Complete ===');
  console.log(`Iterations: ${currentIteration}`);
  console.log(`Successes: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Cache Hit Rate: ${hitRate}%`);
  console.log(`Estimated Savings: $${(cacheStats.hits * 0.02).toFixed(2)}`);

  return {
    phase: 'complete',
    summary: {
      iterations: currentIteration,
      successes: successCount,
      errors: errorCount,
      cacheHitRate: hitRate + '%',
      estimatedSavings: cacheStats.hits * 0.02
    }
  };
}
```

### Phase 5: Assemble Training Graph

**Step 5.1: Create graph definition**

```javascript
// server/workflows/training-graph.js

import { StateGraph, END } from '@langchain/langgraph';
import { TrainingState } from './training-state.js';
import { langGraphCheckpointer } from '../redis/langgraph-checkpointer-adapter.js';

import { initializeNode } from './nodes/initialize.js';
import { selectSampleNode } from './nodes/select-sample.js';
import { generateNode } from './nodes/generate.js';
import { evaluateNode } from './nodes/evaluate.js';
import { checkEvolutionNode } from './nodes/check-evolution.js';
import { finalizeNode } from './nodes/finalize.js';

/**
 * Create the training workflow graph
 */
function createTrainingGraph() {
  const graph = new StateGraph(TrainingState)
    // Add nodes
    .addNode('initialize', initializeNode)
    .addNode('select_sample', selectSampleNode)
    .addNode('generate', generateNode)
    .addNode('evaluate', evaluateNode)
    .addNode('check_evolution', checkEvolutionNode)
    .addNode('finalize', finalizeNode)

    // Define edges
    .addEdge('__start__', 'initialize')
    .addEdge('initialize', 'select_sample')

    // Conditional edge from select_sample
    .addConditionalEdges(
      'select_sample',
      (state) => state.shouldStop ? 'finalize' : 'generate',
      {
        generate: 'generate',
        finalize: 'finalize'
      }
    )

    .addEdge('generate', 'evaluate')
    .addEdge('evaluate', 'check_evolution')
    .addEdge('check_evolution', 'select_sample')
    .addEdge('finalize', END);

  return graph;
}

/**
 * Compiled training graph with checkpointing
 */
export const trainingGraph = createTrainingGraph().compile({
  checkpointer: langGraphCheckpointer
});

/**
 * Run training with graph
 * @param {Object} config - Training configuration
 * @returns {Promise<Object>} Training result
 */
export async function runTrainingGraph(config) {
  const { sessionId, iterations, sampleSets } = config;

  const initialState = {
    sessionId,
    totalIterations: iterations,
    sampleSets,
    contentTypes: ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis']
  };

  // Run with thread_id for checkpointing
  const result = await trainingGraph.invoke(initialState, {
    configurable: {
      thread_id: `training:${sessionId}`
    }
  });

  return result;
}

/**
 * Resume training from checkpoint
 * @param {string} sessionId - Session to resume
 * @returns {Promise<Object>} Training result
 */
export async function resumeTrainingGraph(sessionId) {
  // Get latest checkpoint
  const checkpoint = await langGraphCheckpointer.getTuple({
    configurable: { thread_id: `training:${sessionId}` }
  });

  if (!checkpoint) {
    throw new Error(`No checkpoint found for session: ${sessionId}`);
  }

  console.log(`Resuming training from iteration ${checkpoint.checkpoint.currentIteration}`);

  // Resume from checkpoint
  const result = await trainingGraph.invoke(null, {
    configurable: {
      thread_id: `training:${sessionId}`,
      checkpoint_id: checkpoint.config.configurable.checkpoint_id
    }
  });

  return result;
}
```

### Phase 6: Update Training Route

**Step 6.1: Modify training route to use graph**

```javascript
// server/routes/training.js - Updated

import { runTrainingGraph, resumeTrainingGraph } from '../workflows/training-graph.js';

router.get('/', async (req, res) => {
  const secret = req.query.secret;
  const iterations = parseInt(req.query.iterations) || 10;
  const sessionId = req.query.sessionId || `session_${Date.now()}`;
  const resume = req.query.resume === 'true';

  // Validate secret
  if (secret !== process.env.TRAINING_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  try {
    let result;

    if (resume) {
      // Resume from checkpoint
      result = await resumeTrainingGraph(sessionId);
    } else {
      // Start new training
      const sampleSets = await loadSampleSets();
      result = await runTrainingGraph({
        sessionId,
        iterations,
        sampleSets
      });
    }

    res.json({
      success: true,
      sessionId,
      summary: result.summary
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## File Structure After Implementation

```
server/
├── redis/
│   ├── checkpointer.js                    # Existing (no changes)
│   ├── langgraph-checkpointer-adapter.js  # NEW: LangGraph adapter
│   └── ...
├── workflows/                              # NEW: LangGraph workflows
│   ├── training-graph.js                  # Main graph definition
│   ├── training-state.js                  # State schema
│   └── nodes/
│       ├── initialize.js
│       ├── select-sample.js
│       ├── generate.js
│       ├── evaluate.js
│       ├── check-evolution.js
│       └── finalize.js
└── routes/
    └── training.js                        # Modified to use graph
```

---

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/langgraph-adapter.test.js

describe('RedisCheckpointerAdapter', () => {
  test('implements BaseCheckpointSaver interface', () => {
    expect(adapter.getTuple).toBeDefined();
    expect(adapter.list).toBeDefined();
    expect(adapter.put).toBeDefined();
    expect(adapter.delete).toBeDefined();
  });

  test('getTuple returns checkpoint in correct format', async () => {
    // ...
  });
});
```

### Integration Tests

```javascript
// tests/integration/training-graph.test.js

describe('Training Graph', () => {
  test('completes full training cycle', async () => {
    const result = await runTrainingGraph({
      sessionId: 'test-session',
      iterations: 5,
      sampleSets: mockSampleSets
    });

    expect(result.phase).toBe('complete');
    expect(result.summary.iterations).toBe(5);
  });

  test('can resume from checkpoint', async () => {
    // Start training
    // Interrupt
    // Resume and verify continuation
  });
});
```

---

## Rollback Plan

1. Keep existing `training.js` logic in separate functions
2. Add feature flag: `USE_LANGGRAPH_TRAINING=true/false`
3. Route can switch between old and new implementations
4. Checkpointer continues to work independently

---

## Success Criteria

| Metric | Target |
|--------|--------|
| LangGraph installed | Package in node_modules |
| Adapter passes tests | All unit tests green |
| Graph executes | Training completes via graph |
| Checkpointing works | Resume from any iteration |
| No regression | Same results as sequential |

---

## Estimated Timeline

| Phase | Duration |
|-------|----------|
| Phase 1: Installation | 30 min |
| Phase 2: Adapter | 2 hours |
| Phase 3: State Schema | 1 hour |
| Phase 4: Nodes | 4 hours |
| Phase 5: Graph Assembly | 2 hours |
| Phase 6: Route Update | 1 hour |
| Testing | 3 hours |
| **Total** | **~14 hours** |

---

## Dependencies

- Node.js 18+ (for LangGraph.js)
- Redis running for checkpointing
- Existing checkpointer.js (no modifications needed)
- DSPy cache integration (Gap 1) recommended first
