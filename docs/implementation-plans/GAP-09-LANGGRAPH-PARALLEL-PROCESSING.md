# Gap 09: LangGraph Parallel Content Type Processing

## Problem Statement

The current training workflow processes content types **sequentially**:

```
Iteration 1: Roadmap (sample-set-1)
Iteration 2: Slides (sample-set-1)
Iteration 3: Document (sample-set-1)
Iteration 4: ResearchAnalysis (sample-set-1)
Iteration 5: Roadmap (sample-set-2)
...
```

This approach is inefficient because:
1. Content types are independent - they don't depend on each other
2. LLM API calls could run in parallel
3. Training time scales linearly with content types
4. LangGraph supports subgraphs for parallel execution

## Goal

Implement **parallel content type processing** using LangGraph subgraphs to reduce training time by ~4x (for 4 content types).

---

## Phase 1: Subgraph Architecture Design

### Objective
Design the parallel processing architecture using LangGraph subgraphs.

### Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │         Main Training Graph          │
                    │                                      │
                    │  initialize                          │
                    │      │                               │
                    │      ▼                               │
                    │  select_batch (N sample sets)        │
                    │      │                               │
                    │      ▼                               │
                    │  ┌─────────────────────────────┐    │
                    │  │     Parallel Subgraph       │    │
                    │  │  ┌────┐ ┌────┐ ┌────┐ ┌───┐│    │
                    │  │  │Road│ │Slid│ │Doc │ │Res││    │
                    │  │  │map │ │es  │ │    │ │   ││    │
                    │  │  └──┬─┘ └──┬─┘ └──┬─┘ └─┬─┘│    │
                    │  │     └──────┴──────┴─────┘  │    │
                    │  │            merge           │    │
                    │  └─────────────────────────────┘    │
                    │      │                               │
                    │      ▼                               │
                    │  aggregate_results                   │
                    │      │                               │
                    │      ▼                               │
                    │  check_evolution                     │
                    │      │                               │
                    │      ▼                               │
                    │  checkpoint                          │
                    │      │                               │
                    │      ▼                               │
                    │  [loop or finalize]                  │
                    └─────────────────────────────────────┘
```

### Tasks

#### 1.1 Define Parallel State Schema
```javascript
// server/workflows/parallel-state.js

import { Annotation } from '@langchain/langgraph';

/**
 * State for parallel content type processing.
 * Each content type runs in its own branch.
 */
export const ParallelBatchAnnotation = Annotation.Root({
  // Batch identification
  batchId: Annotation({ reducer: (_, b) => b }),
  sampleSet: Annotation({ reducer: (_, s) => s }),

  // Per-content-type results (accumulated)
  contentResults: Annotation({
    reducer: (prev, curr) => ({ ...prev, ...curr }),
    default: () => ({})
  }),

  // Aggregated stats
  batchStats: Annotation({
    reducer: (prev, curr) => ({
      successful: (prev.successful || 0) + (curr.successful || 0),
      failed: (prev.failed || 0) + (curr.failed || 0),
      cacheHits: (prev.cacheHits || 0) + (curr.cacheHits || 0),
      cacheMisses: (prev.cacheMisses || 0) + (curr.cacheMisses || 0)
    }),
    default: () => ({ successful: 0, failed: 0, cacheHits: 0, cacheMisses: 0 })
  }),

  // Completion tracking
  completedTypes: Annotation({
    reducer: (prev, curr) => [...new Set([...prev, ...curr])],
    default: () => []
  })
});
```

#### 1.2 Design Content Type Subgraph
```javascript
// server/workflows/content-type-graph.js

/**
 * Subgraph for processing a single content type.
 * Runs in parallel with other content type subgraphs.
 */
export function createContentTypeGraph(contentType) {
  const graph = new StateGraph(ContentTypeAnnotation)
    .addNode('generate', generateContentNode)
    .addNode('evaluate', evaluateContentNode)
    .addNode('record', recordResultNode)
    .addEdge(START, 'generate')
    .addEdge('generate', 'evaluate')
    .addEdge('evaluate', 'record')
    .addEdge('record', END);

  return graph.compile();
}
```

### Deliverables
- [ ] `ParallelBatchAnnotation` state schema
- [ ] `ContentTypeAnnotation` subgraph state schema
- [ ] Architecture diagram documentation
- [ ] Design review with stakeholders

### Estimated Complexity: Medium

---

## Phase 2: Content Type Subgraph Implementation

### Objective
Implement the individual content type processing subgraph.

### Tasks

#### 2.1 Create Subgraph Nodes
```javascript
// server/workflows/content-type-nodes.js

/**
 * Generate content for a specific type.
 */
export async function generateContentNode(state, config) {
  const { contentType, sampleSet, generators } = state;
  const generator = generators[contentType];
  const prompt = sampleSet.prompts[contentType];

  const signatureType = CONTENT_TYPE_TO_SIGNATURE[contentType];

  try {
    const result = await executeWithCache(
      signatureType,
      { prompt, researchFiles: sampleSet.files },
      () => generator(prompt, sampleSet.files)
    );

    return {
      generationResult: result,
      cacheHit: result.__cacheHit || false,
      generationError: null
    };
  } catch (error) {
    return {
      generationResult: null,
      cacheHit: false,
      generationError: { message: error.message }
    };
  }
}

/**
 * Evaluate generated content quality.
 */
export async function evaluateContentNode(state) {
  const { generationResult, generationError, contentType } = state;

  if (generationError || !generationResult?.success) {
    return {
      evaluationResult: {
        success: false,
        error: generationError?.message || 'Generation failed'
      }
    };
  }

  const scoreResult = scoreContentQuality(generationResult.data, contentType);
  const qualityScore = 1 + scoreResult.overall * 4;
  const feedback = calculateCorrelatedFeedback(qualityScore, contentType);

  return {
    evaluationResult: {
      success: true,
      qualityScore,
      rating: feedback.rating,
      feedback
    }
  };
}

/**
 * Record result and return to parent graph.
 */
export async function recordResultNode(state) {
  const {
    contentType,
    generationResult,
    evaluationResult,
    cacheHit
  } = state;

  // Format result for parent graph aggregation
  return {
    contentResults: {
      [contentType]: {
        success: evaluationResult.success,
        qualityScore: evaluationResult.qualityScore,
        rating: evaluationResult.rating,
        cacheHit,
        data: generationResult?.data
      }
    },
    batchStats: {
      successful: evaluationResult.success ? 1 : 0,
      failed: evaluationResult.success ? 0 : 1,
      cacheHits: cacheHit ? 1 : 0,
      cacheMisses: cacheHit ? 0 : 1
    },
    completedTypes: [contentType]
  };
}
```

#### 2.2 Compile Subgraph
```javascript
// server/workflows/content-type-graph.js

import { StateGraph, START, END } from '@langchain/langgraph';
import { ContentTypeAnnotation } from './content-type-state.js';
import {
  generateContentNode,
  evaluateContentNode,
  recordResultNode
} from './content-type-nodes.js';

export function createContentTypeSubgraph() {
  const graph = new StateGraph(ContentTypeAnnotation)
    .addNode('generate', generateContentNode)
    .addNode('evaluate', evaluateContentNode)
    .addNode('record', recordResultNode)
    .addEdge(START, 'generate')
    .addEdge('generate', 'evaluate')
    .addEdge('evaluate', 'record')
    .addEdge('record', END);

  return graph.compile();
}
```

### Deliverables
- [ ] `content-type-nodes.js` with generate, evaluate, record nodes
- [ ] `content-type-graph.js` with compiled subgraph
- [ ] `content-type-state.js` with subgraph state schema
- [ ] Unit tests for subgraph nodes

### Estimated Complexity: Medium

---

## Phase 3: Parallel Orchestration

### Objective
Implement the parallel execution layer that spawns and merges subgraphs.

### Tasks

#### 3.1 Create Parallel Batch Node
```javascript
// server/workflows/parallel-nodes.js

import { RunnableParallel } from '@langchain/core/runnables';
import { createContentTypeSubgraph } from './content-type-graph.js';

/**
 * Execute all content types in parallel for a batch.
 */
export async function parallelBatchNode(state, config) {
  const { sampleSet, contentTypes, generators } = state;

  // Create parallel runnable for all content types
  const parallelBranches = {};

  for (const contentType of contentTypes) {
    parallelBranches[contentType] = createContentTypeSubgraph();
  }

  const parallel = RunnableParallel.from(parallelBranches);

  // Prepare inputs for each branch
  const inputs = {};
  for (const contentType of contentTypes) {
    inputs[contentType] = {
      contentType,
      sampleSet,
      generators
    };
  }

  // Execute in parallel
  const results = await parallel.invoke(inputs, config);

  // Merge results
  const mergedResults = {};
  const mergedStats = { successful: 0, failed: 0, cacheHits: 0, cacheMisses: 0 };

  for (const contentType of contentTypes) {
    const result = results[contentType];
    mergedResults[contentType] = result.contentResults[contentType];

    mergedStats.successful += result.batchStats.successful;
    mergedStats.failed += result.batchStats.failed;
    mergedStats.cacheHits += result.batchStats.cacheHits;
    mergedStats.cacheMisses += result.batchStats.cacheMisses;
  }

  return {
    contentResults: mergedResults,
    batchStats: mergedStats,
    completedTypes: contentTypes
  };
}
```

#### 3.2 Alternative: Promise.all Approach
```javascript
// Simpler approach without RunnableParallel

export async function parallelBatchNodeSimple(state, config) {
  const { sampleSet, contentTypes, generators } = state;

  const subgraph = createContentTypeSubgraph();

  // Run all content types in parallel using Promise.all
  const promises = contentTypes.map(contentType =>
    subgraph.invoke({
      contentType,
      sampleSet,
      generators
    }, config)
  );

  const results = await Promise.all(promises);

  // Merge results...
}
```

#### 3.3 Concurrency Control
```javascript
// server/workflows/parallel-config.js

export const PARALLEL_CONFIG = {
  // Maximum concurrent content type generations
  maxConcurrency: 4,

  // Timeout per content type (ms)
  perTypeTimeout: 60000,

  // Whether to fail batch if any type fails
  failFast: false,

  // Retry failed types
  retryOnFailure: true,
  maxRetries: 1
};

/**
 * Execute with concurrency limit using p-limit.
 */
import pLimit from 'p-limit';

export async function parallelWithLimit(state, config) {
  const limit = pLimit(PARALLEL_CONFIG.maxConcurrency);
  const { sampleSet, contentTypes, generators } = state;

  const subgraph = createContentTypeSubgraph();

  const promises = contentTypes.map(contentType =>
    limit(() => subgraph.invoke({
      contentType,
      sampleSet,
      generators
    }, config))
  );

  return Promise.all(promises);
}
```

### Deliverables
- [ ] `parallelBatchNode` with result merging
- [ ] Concurrency configuration
- [ ] Timeout handling per content type
- [ ] Error isolation (one failure doesn't fail all)

### Estimated Complexity: High

---

## Phase 4: Main Graph Refactor

### Objective
Refactor the main training graph to use batch-based parallel processing.

### Tasks

#### 4.1 Update Main Graph Structure
```javascript
// server/workflows/training-graph-parallel.js

import { StateGraph, START, END } from '@langchain/langgraph';
import { TrainingStateAnnotation } from './training-state.js';
import {
  initializeNode,
  selectBatchNode,
  parallelBatchNode,
  aggregateResultsNode,
  checkEvolutionNode,
  checkpointNode,
  shouldContinueNode,
  finalizeNode
} from './training-nodes-parallel.js';

export function createParallelTrainingGraph() {
  const graph = new StateGraph(TrainingStateAnnotation)
    // Initialization
    .addNode('initialize', initializeNode)

    // Batch selection (picks next sample set)
    .addNode('select_batch', selectBatchNode)

    // Parallel processing of all content types
    .addNode('parallel_batch', parallelBatchNode)

    // Aggregate results from parallel batch
    .addNode('aggregate', aggregateResultsNode)

    // Evolution check (runs after each batch)
    .addNode('check_evolution', checkEvolutionNode)

    // Checkpoint state
    .addNode('checkpoint', checkpointNode)

    // Finalization
    .addNode('finalize', finalizeNode)

    // Edges
    .addEdge(START, 'initialize')
    .addEdge('initialize', 'select_batch')
    .addEdge('select_batch', 'parallel_batch')
    .addEdge('parallel_batch', 'aggregate')
    .addEdge('aggregate', 'check_evolution')
    .addEdge('check_evolution', 'checkpoint')
    .addConditionalEdges('checkpoint', shouldContinueNode, {
      continue: 'select_batch',
      stop: 'finalize'
    })
    .addEdge('finalize', END);

  return graph;
}
```

#### 4.2 Batch Selection Node
```javascript
// server/workflows/training-nodes-parallel.js

/**
 * Select next batch (sample set) for parallel processing.
 */
export async function selectBatchNode(state) {
  const {
    sampleSets,
    currentBatch,
    totalBatches,
    shouldStop
  } = state;

  if (shouldStop || currentBatch >= totalBatches) {
    return { phase: 'finalize' };
  }

  const sampleSetIndex = currentBatch % sampleSets.length;
  const currentSampleSet = sampleSets[sampleSetIndex];

  console.log(`\n📦 [Graph] Batch ${currentBatch + 1}/${totalBatches}`);
  console.log(`   Sample Set: ${currentSampleSet.name}`);
  console.log(`   Processing ${state.contentTypes.length} content types in parallel`);

  return {
    currentSampleSet,
    batchId: `batch_${currentBatch}`,
    phase: 'parallel_batch'
  };
}
```

#### 4.3 Aggregate Results Node
```javascript
/**
 * Aggregate results from parallel batch execution.
 */
export async function aggregateResultsNode(state) {
  const { contentResults, batchStats, currentBatch, evolutionState } = state;

  // Log batch results
  const successCount = Object.values(contentResults)
    .filter(r => r.success).length;
  const avgQuality = Object.values(contentResults)
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.qualityScore, 0) / successCount || 0;

  console.log(`   ✓ Batch complete: ${successCount}/${Object.keys(contentResults).length} successful`);
  console.log(`   Avg Quality: ${avgQuality.toFixed(2)}/5`);
  console.log(`   Cache: ${batchStats.cacheHits} hits, ${batchStats.cacheMisses} misses`);

  // Record for evolution engine
  let updatedEvolutionState = evolutionState;
  if (evolutionState) {
    const engine = PromptEvolutionEngine.deserialize(evolutionState);

    for (const [contentType, result] of Object.entries(contentResults)) {
      if (result.success) {
        const prompt = state.currentSampleSet.prompts[contentType];
        engine.recordGeneration(contentType, prompt, JSON.stringify(result.data), result.rating);
      }
    }

    updatedEvolutionState = engine.serialize();
  }

  return {
    stats: {
      totalGenerations: Object.keys(contentResults).length,
      successful: batchStats.successful,
      failed: batchStats.failed,
      qualityScores: Object.values(contentResults)
        .filter(r => r.success)
        .map(r => r.rating)
    },
    cacheStats: {
      hits: batchStats.cacheHits,
      misses: batchStats.cacheMisses
    },
    results: Object.entries(contentResults).map(([type, result]) => ({
      contentType: type,
      ...result,
      batch: currentBatch,
      timestamp: Date.now()
    })),
    evolutionState: updatedEvolutionState,
    currentBatch: currentBatch + 1,
    phase: 'check_evolution'
  };
}
```

### Deliverables
- [ ] `training-graph-parallel.js` with new graph structure
- [ ] Updated node implementations
- [ ] Batch-based iteration tracking
- [ ] Backward-compatible fallback to sequential

### Estimated Complexity: High

---

## Phase 5: API and Configuration

### Objective
Expose parallel processing configuration and monitoring via API.

### Tasks

#### 5.1 Training API Updates
```javascript
// POST /api/train/graph
{
  "secret": "train123",
  "iterations": 10,  // Now means "batches" (each batch = all content types)
  "parallelMode": true,
  "maxConcurrency": 4,
  "contentTypes": ["Roadmap", "Slides", "Document", "ResearchAnalysis"]
}
```

#### 5.2 Status Endpoint Enhancement
```javascript
// GET /api/train/graph/status/:sessionId

{
  "status": "running",
  "mode": "parallel",
  "progress": {
    "currentBatch": 5,
    "totalBatches": 10,
    "percent": 50,
    "currentSampleSet": "sample-set-2",
    "parallelStats": {
      "avgBatchDuration": 4500,  // ms
      "avgSequentialEquivalent": 18000,  // ms
      "speedup": "4x"
    }
  },
  "lastBatch": {
    "Roadmap": { "success": true, "quality": 4.2, "cacheHit": false },
    "Slides": { "success": true, "quality": 3.8, "cacheHit": true },
    "Document": { "success": true, "quality": 4.1, "cacheHit": false },
    "ResearchAnalysis": { "success": false, "error": "Parse error" }
  }
}
```

#### 5.3 Configuration Options
```javascript
// server/config.js

TRAINING: {
  // ... existing config ...

  PARALLEL: {
    enabled: process.env.TRAINING_PARALLEL !== 'false',
    maxConcurrency: parseInt(process.env.TRAINING_MAX_CONCURRENCY) || 4,
    perTypeTimeoutMs: parseInt(process.env.TRAINING_TYPE_TIMEOUT) || 60000,
    failFast: process.env.TRAINING_FAIL_FAST === 'true'
  }
}
```

### Deliverables
- [ ] Updated API endpoints for parallel mode
- [ ] Enhanced status with parallel metrics
- [ ] Environment variable configuration
- [ ] Documentation updates

### Estimated Complexity: Low-Medium

---

## Performance Expectations

| Metric | Sequential | Parallel (4 types) |
|--------|------------|-------------------|
| Time per batch | ~20s | ~6s |
| 100 iteration training | ~33 min | ~10 min |
| API call efficiency | 1x | ~4x |
| Cache hit benefit | 1 call saved | 4 calls/batch potential |

## Migration Strategy

1. **Phase 1**: Deploy parallel graph alongside existing sequential
2. **Phase 2**: Feature flag to enable parallel (`?parallelMode=true`)
3. **Phase 3**: A/B test parallel vs sequential for quality parity
4. **Phase 4**: Make parallel default, sequential as fallback

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API rate limits | Configurable concurrency limit |
| Memory pressure | Stream results, don't hold all in memory |
| Partial batch failures | Isolate failures, aggregate what succeeds |
| Debugging complexity | Enhanced logging with batch/type context |
