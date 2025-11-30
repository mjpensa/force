/**
 * Training Graph Nodes
 *
 * Gap 02: Node functions for the LangGraph training workflow.
 * Gap 06/07: DSPy service integration with optimization feedback loop.
 * Gap 10/11/12: Redis event integration for audit trail and metrics.
 *
 * Each node is a pure function that takes state and returns state updates.
 * Nodes handle specific phases of the training process:
 * - initialize: Set up evolution engine and validate config
 * - selectSample: Pick next sample set and content type
 * - generate: Run content generation with caching
 * - evaluate: Score output and record metrics
 * - checkEvolution: Periodic evolution cycle
 * - finalize: Compile results and summary
 */

import { PromptEvolutionEngine } from '../utils/promptEvolution.js';
import { executeWithCache } from '../utils/dspyExecutor.js';
import { scoreContentQuality } from '../utils/contentQualityScoring.js';
import { calculateCorrelatedFeedback } from '../utils/feedbackSimulation.js';
import { trainingEvents } from '../utils/trainingEvents.js';
import { dspyIntegration } from '../utils/dspyIntegration.js';

// Content type to signature mapping
const CONTENT_TYPE_TO_SIGNATURE = {
  'Roadmap': 'roadmap',
  'Document': 'document',
  'ResearchAnalysis': 'research-analysis'
};

// Evolution interval (run evolution every N iterations)
const EVOLUTION_INTERVAL = 50;

/**
 * Initialize Node
 *
 * Sets up the prompt evolution engine and prepares for training.
 *
 * @param {Object} state - Current graph state
 * @returns {Object} State updates
 */
export async function initializeNode(state) {
  console.log(`\n🚀 [Graph] Initializing training session: ${state.sessionId}`);
  console.log(`   Total iterations: ${state.totalIterations}`);
  console.log(`   Sample sets: ${state.sampleSets.length}`);
  console.log(`   Content types: ${state.contentTypes.join(', ')}`);

  // Log session start event (Gap 10/11) - non-blocking
  trainingEvents.onSessionStart(state.sessionId, {
    mode: 'graph',
    iterations: state.totalIterations,
    contentTypes: state.contentTypes,
    sampleSets: state.sampleSets
  }).catch(err => console.warn(`[Graph] Event logging error: ${err.message}`));

  // Check DSPy service status (Gap 06)
  let dspyStatus = { serviceAvailable: false };
  try {
    dspyStatus = await dspyIntegration.getStatus();
  } catch (err) {
    console.warn(`[Graph] DSPy status check failed: ${err.message}`);
  }
  if (dspyStatus.serviceAvailable) {
    console.log('   ✓ DSPy service available');
  } else {
    console.log('   ⚠️ DSPy service not available (using fallback generators)');
  }

  // Create and initialize evolution engine
  const engine = new PromptEvolutionEngine({
    promotionThreshold: 0.05,
    minCandidateSamples: 10,
    minChampionSamples: 35,
    abTestRatio: 0.2
  });

  // Initialize with prompts from first sample set
  const prompts = {};
  const firstSet = state.sampleSets[0];
  for (const type of state.contentTypes) {
    prompts[type] = firstSet?.prompts?.[type] || `Generate ${type} content`;
  }
  engine.initialize(prompts);

  console.log('   ✓ Evolution engine initialized');

  return {
    evolutionState: engine.serialize(),
    phase: 'select_sample',
    status: 'running',
    dspyServiceAvailable: dspyStatus.serviceAvailable
  };
}

/**
 * Select Sample Node
 *
 * Determines the next sample set and content type to process.
 * Cycles through all combinations of sample sets and content types.
 *
 * @param {Object} state - Current graph state
 * @returns {Object} State updates
 */
export async function selectSampleNode(state) {
  const { sampleSets, contentTypes, currentIteration, totalIterations, shouldStop } = state;

  // Check if we should stop
  if (shouldStop || currentIteration >= totalIterations) {
    console.log(`\n⏹️ [Graph] Training complete or stopped at iteration ${currentIteration}`);
    return {
      phase: 'finalize'
    };
  }

  // Calculate which sample set and content type to use
  const numContentTypes = contentTypes.length;
  const numSampleSets = sampleSets.length;
  const cycleSize = numContentTypes * numSampleSets;

  const cyclePosition = currentIteration % cycleSize;
  const sampleSetIndex = Math.floor(cyclePosition / numContentTypes);
  const contentTypeIndex = cyclePosition % numContentTypes;

  const currentSampleSet = sampleSets[sampleSetIndex];
  const currentContentType = contentTypes[contentTypeIndex];

  const progress = Math.round((currentIteration / totalIterations) * 100);
  console.log(`\n📊 [Graph] Iteration ${currentIteration + 1}/${totalIterations} (${progress}%)`);
  console.log(`   Sample: ${currentSampleSet.name}, Type: ${currentContentType}`);

  return {
    currentSampleSet,
    currentContentType,
    phase: 'generate'
  };
}

/**
 * Generate Node
 *
 * Runs content generation using the DSPy cache wrapper.
 *
 * @param {Object} state - Current graph state
 * @param {Object} config - Node config with generators
 * @returns {Object} State updates
 */
export async function generateNode(state, config) {
  const { currentSampleSet, currentContentType } = state;
  const { generators } = config || {};

  if (!generators || !generators[currentContentType]) {
    console.error(`   ✗ No generator for ${currentContentType}`);
    return {
      currentResult: null,
      currentError: { message: `No generator for ${currentContentType}` },
      currentCacheHit: false,
      phase: 'evaluate'
    };
  }

  const generator = generators[currentContentType];
  const prompt = currentSampleSet.prompts[currentContentType];
  const signatureType = CONTENT_TYPE_TO_SIGNATURE[currentContentType];

  try {
    // Use cache wrapper for generation
    const result = await executeWithCache(
      signatureType,
      {
        prompt,
        researchFiles: currentSampleSet.files
      },
      async () => {
        return await generator(prompt, currentSampleSet.files);
      }
    );

    const cacheHit = result.__cacheHit || false;
    if (cacheHit) {
      console.log(`   📦 [Cache HIT] ${currentContentType}`);
    }

    return {
      currentResult: result,
      currentError: null,
      currentCacheHit: cacheHit,
      phase: 'evaluate'
    };

  } catch (error) {
    console.error(`   ✗ Generation error: ${error.message}`);
    return {
      currentResult: null,
      currentError: { message: error.message, stack: error.stack },
      currentCacheHit: false,
      phase: 'evaluate'
    };
  }
}

/**
 * Evaluate Node
 *
 * Scores the generation result and records metrics.
 *
 * @param {Object} state - Current graph state
 * @returns {Object} State updates
 */
export async function evaluateNode(state) {
  const {
    currentResult,
    currentError,
    currentCacheHit,
    currentContentType,
    currentSampleSet,
    currentIteration,
    evolutionState,
    delay
  } = state;

  // Update cache stats
  const cacheStatsUpdate = {
    hits: currentCacheHit ? 1 : 0,
    misses: currentCacheHit ? 0 : 1
  };

  // Handle generation failure
  if (currentError || !currentResult?.success) {
    console.log(`   ✗ Generation failed`);

    // Log generation error event (Gap 10/11) - non-blocking
    trainingEvents.onGenerationError(state.sessionId, currentError, {
      iteration: currentIteration,
      contentType: currentContentType,
      sampleSet: currentSampleSet?.name
    }).catch(err => console.warn(`[Graph] Error logging failed: ${err.message}`));

    return {
      stats: {
        totalGenerations: 1,
        failed: 1
      },
      cacheStats: cacheStatsUpdate,
      errors: [{
        iteration: currentIteration,
        contentType: currentContentType,
        sampleSet: currentSampleSet?.name,
        error: currentError?.message || 'Unknown error',
        timestamp: Date.now()
      }],
      currentIteration: currentIteration + 1,
      phase: 'check_evolution'
    };
  }

  // Score the output
  let qualityScore = 3;
  try {
    const scoreResult = scoreContentQuality(currentResult.data, currentContentType);
    qualityScore = 1 + scoreResult.overall * 4; // Convert 0-1 to 1-5
  } catch (e) {
    console.warn(`   ⚠️ Scoring error: ${e.message}`);
  }

  // Generate correlated feedback
  const feedback = calculateCorrelatedFeedback(qualityScore, currentContentType);
  const rating = feedback.rating;

  console.log(`   ✓ Quality: ${qualityScore.toFixed(2)}/5, Rating: ${rating}⭐`);

  // Log generation event (Gap 10/11) - non-blocking to avoid training failures
  trainingEvents.onGeneration(state.sessionId, currentResult, {
    iteration: currentIteration,
    contentType: currentContentType,
    sampleSet: currentSampleSet?.name,
    cacheHit: currentCacheHit,
    latencyMs: currentResult?._latencyMs,
    feedback
  }).catch(err => console.warn(`[Graph] Event logging error: ${err.message}`));

  // Record for DSPy training (Gap 07 - Optimization Feedback Loop)
  // Only record high-quality examples (rating 4+)
  if (rating >= 4) {
    dspyIntegration.processForTraining(
      currentContentType,
      {
        prompt: currentSampleSet?.prompts?.[currentContentType] || '',
        researchFiles: currentSampleSet?.files || [],
        contentType: currentContentType
      },
      currentResult,
      feedback
    ).catch(err => console.warn(`[Graph] DSPy training record error: ${err.message}`));
  }

  // Record for evolution engine
  let updatedEvolutionState = evolutionState;
  if (evolutionState) {
    try {
      const engine = PromptEvolutionEngine.deserialize(evolutionState);
      const prompt = currentSampleSet.prompts[currentContentType];
      const output = JSON.stringify(currentResult.data || {});
      engine.recordGeneration(currentContentType, prompt, output, rating);
      updatedEvolutionState = engine.serialize();
    } catch (e) {
      console.warn(`   ⚠️ Evolution recording error: ${e.message}`);
    }
  }

  // Add delay between iterations
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return {
    stats: {
      totalGenerations: 1,
      successful: 1,
      qualityScores: [rating],
      feedbackDistribution: { [rating]: 1 }
    },
    cacheStats: cacheStatsUpdate,
    results: [{
      iteration: currentIteration,
      contentType: currentContentType,
      sampleSet: currentSampleSet?.name,
      qualityScore,
      rating,
      cacheHit: currentCacheHit,
      feedback,
      timestamp: Date.now()
    }],
    evolutionState: updatedEvolutionState,
    currentIteration: currentIteration + 1,
    phase: 'check_evolution'
  };
}

/**
 * Check Evolution Node
 *
 * Periodically runs the evolution cycle to promote candidates
 * and generate new prompt variants.
 *
 * @param {Object} state - Current graph state
 * @returns {Object} State updates
 */
export async function checkEvolutionNode(state) {
  const { currentIteration, evolutionState, contentTypes } = state;

  // Only run evolution at intervals
  if (currentIteration === 0 || currentIteration % EVOLUTION_INTERVAL !== 0) {
    return {
      phase: 'select_sample'
    };
  }

  console.log(`\n🧬 [Graph] Running evolution cycle at iteration ${currentIteration}`);

  if (!evolutionState) {
    return {
      phase: 'select_sample'
    };
  }

  const engine = PromptEvolutionEngine.deserialize(evolutionState);
  const evolutionResults = {
    promotions: [],
    evolutions: [],
    errors: []
  };

  for (const contentType of contentTypes) {
    try {
      // Check if current candidate should be promoted
      const promoteResult = engine.checkAndPromote(contentType);
      if (promoteResult.promoted) {
        evolutionResults.promotions.push({
          contentType,
          improvement: promoteResult.improvement
        });
        console.log(`   🎉 ${contentType} candidate promoted (+${promoteResult.improvement?.toFixed(1)}%)`);
      }

      // Try to evolve a new candidate
      const evolveResult = engine.evolvePrompt(contentType);
      if (evolveResult.evolved) {
        evolutionResults.evolutions.push({
          contentType,
          mutations: evolveResult.appliedMutations?.map(m => m.type) || []
        });
        console.log(`   🧬 ${contentType} evolved: ${evolveResult.appliedMutations?.map(m => m.type).join(', ')}`);
      }
    } catch (error) {
      evolutionResults.errors.push({
        contentType,
        error: error.message
      });
      console.error(`   ⚠️ Evolution error for ${contentType}: ${error.message}`);
    }
  }

  // Log evolution cycle event (Gap 10/11) - non-blocking
  trainingEvents.onEvolutionCycle(state.sessionId, currentIteration, evolutionResults)
    .catch(err => console.warn(`[Graph] Evolution event logging failed: ${err.message}`));

  // Check if we should trigger DSPy optimization (Gap 07)
  if (evolutionResults.promotions.length > 0) {
    // A variant was promoted - trigger DSPy optimization for that signature type
    for (const promotion of evolutionResults.promotions) {
      const signatureType = CONTENT_TYPE_TO_SIGNATURE[promotion.contentType];
      if (signatureType) {
        // Don't await - run optimization asynchronously
        dspyIntegration.optimize(signatureType).catch(err => {
          console.warn(`   ⚠️ DSPy optimization failed for ${signatureType}: ${err.message}`);
        });
      }
    }
  }

  return {
    evolutionState: engine.serialize(),
    lastEvolutionResult: evolutionResults,
    phase: 'select_sample'
  };
}

/**
 * Finalize Node
 *
 * Compiles final results and generates training summary.
 *
 * @param {Object} state - Current graph state
 * @returns {Object} State updates
 */
export async function finalizeNode(state) {
  const {
    stats,
    cacheStats,
    results,
    errors,
    evolutionState,
    currentIteration,
    startedAt,
    shouldStop
  } = state;

  console.log(`\n${shouldStop ? '⛔' : '✅'} [Graph] Training ${shouldStop ? 'stopped' : 'completed'}`);

  // Calculate averages
  const avgQuality = stats.qualityScores.length > 0
    ? stats.qualityScores.reduce((a, b) => a + b, 0) / stats.qualityScores.length
    : 0;

  const successRate = stats.totalGenerations > 0
    ? Math.round((stats.successful / stats.totalGenerations) * 100)
    : 0;

  // Calculate cache statistics
  const totalCacheOps = cacheStats.hits + cacheStats.misses;
  const cacheHitRate = totalCacheOps > 0
    ? ((cacheStats.hits / totalCacheOps) * 100).toFixed(1)
    : '0';
  const estimatedSavings = (cacheStats.hits * 0.02).toFixed(2);

  // Get evolution stats
  let evolStats = { totalEvolutions: 0, successfulPromotions: 0, failedPromotions: 0 };
  if (evolutionState) {
    try {
      const engine = PromptEvolutionEngine.deserialize(evolutionState);
      evolStats = engine.getStats();
    } catch (e) {
      console.warn(`   ⚠️ Could not get evolution stats: ${e.message}`);
    }
  }

  const duration = Date.now() - startedAt;
  const durationMins = (duration / 60000).toFixed(1);

  // Print summary
  console.log(`   Iterations: ${currentIteration}`);
  console.log(`   Success: ${stats.successful}/${stats.totalGenerations} (${successRate}%)`);
  console.log(`   Avg Quality: ${avgQuality.toFixed(2)}/5`);
  console.log(`   Cache: ${cacheStats.hits} hits, ${cacheStats.misses} misses (${cacheHitRate}% hit rate)`);
  if (cacheStats.hits > 0) {
    console.log(`   💰 Estimated Savings: $${estimatedSavings}`);
  }
  console.log(`   Evolution: ${evolStats.totalEvolutions} evolutions, ${evolStats.successfulPromotions} promotions`);
  console.log(`   Duration: ${durationMins} minutes`);

  const summary = {
    iterations: currentIteration,
    totalGenerations: stats.totalGenerations,
    successful: stats.successful,
    failed: stats.failed,
    successRate: `${successRate}%`,
    avgQuality: avgQuality.toFixed(2),
    feedbackDistribution: stats.feedbackDistribution,
    cache: {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      hitRate: `${cacheHitRate}%`,
      estimatedSavings: `$${estimatedSavings}`
    },
    evolution: evolStats,
    duration: `${durationMins} minutes`,
    completedAt: new Date().toISOString()
  };

  // Log session completion event (Gap 10/11) - non-blocking
  const completionPromise = shouldStop
    ? trainingEvents.onSessionStop(state.sessionId, 'user_stop', { iteration: currentIteration })
    : trainingEvents.onSessionComplete(state.sessionId, summary);
  completionPromise.catch(err => console.warn(`[Graph] Session event logging failed: ${err.message}`));

  // Log cache stats (Gap 10/11) - non-blocking
  trainingEvents.onCacheStats(state.sessionId, {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: `${cacheHitRate}%`,
    estimatedSavings: `$${estimatedSavings}`
  }).catch(err => console.warn(`[Graph] Cache stats logging failed: ${err.message}`));

  // Get DSPy integration status for summary (with fallback)
  try {
    const dspyStatus = await dspyIntegration.getStatus();
    summary.dspyIntegration = {
      serviceAvailable: dspyStatus.serviceAvailable,
      signatures: dspyStatus.signatures
    };
  } catch (err) {
    summary.dspyIntegration = { serviceAvailable: false, error: err.message };
  }

  // Get variant metrics summary (Gap 12) - with fallback
  try {
    const topVariants = await trainingEvents.getTopVariants(5);
    if (topVariants.length > 0) {
      summary.topVariants = topVariants;
    }
  } catch (err) {
    console.warn(`[Graph] Failed to get top variants: ${err.message}`);
  }

  return {
    status: shouldStop ? 'stopped' : 'completed',
    phase: 'done',
    summary
  };
}

export default {
  initializeNode,
  selectSampleNode,
  generateNode,
  evaluateNode,
  checkEvolutionNode,
  finalizeNode
};
