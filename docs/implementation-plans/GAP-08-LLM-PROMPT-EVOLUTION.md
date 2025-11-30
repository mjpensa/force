# Gap 08: LLM-Based Prompt Evolution

## Problem Statement

The current prompt evolution system in `promptEvolution.js` uses **rule-based mutations** (add constraints, modify format, inject examples). This approach is limited because:

1. Mutations are predetermined and don't learn from context
2. No understanding of *why* certain prompts perform better
3. Cannot synthesize novel prompt improvements
4. DSPy's MIPRO optimizer exists but is never used for prompt evolution

## Goal

Replace rule-based mutations with **LLM-powered prompt optimization** using DSPy's MIPRO (Multi-task Instruction Prompt Optimization) to generate intelligent, context-aware prompt improvements.

---

## Phase 1: MIPRO Optimizer Integration (Foundation)

### Objective
Extend the DSPy service to support MIPRO-based prompt optimization.

### Tasks

#### 1.1 Add MIPRO Endpoint to DSPy Service
```python
# dspy-service/main.py

@app.post("/evolve-prompt")
async def evolve_prompt(request: EvolvePromptRequest):
    """
    Use MIPRO to generate improved prompt variants.

    Input:
    - current_prompt: The current best prompt
    - performance_history: List of (prompt, score) tuples
    - content_type: Type of content being generated
    - num_candidates: Number of variants to generate

    Output:
    - evolved_prompts: List of improved prompt variants
    - reasoning: Why each variant was generated
    """
```

#### 1.2 Create MIPRO Wrapper Module
```python
# dspy-service/optimizers/prompt_evolver.py

class PromptEvolver:
    """
    Uses MIPRO to evolve prompts based on performance history.

    Unlike BootstrapFewShot which optimizes examples,
    MIPRO optimizes the instruction text itself.
    """

    def evolve(self, current_prompt, history, num_candidates=3):
        # Analyze performance patterns
        # Generate candidate improvements
        # Rank by expected performance
        pass
```

#### 1.3 Define Evolution Signature
```python
# dspy-service/signatures/evolution.py

class PromptEvolutionSignature(dspy.Signature):
    """Evolve a prompt based on performance feedback."""

    current_prompt = dspy.InputField(desc="The current prompt being used")
    high_performers = dspy.InputField(desc="Examples of high-scoring outputs")
    low_performers = dspy.InputField(desc="Examples of low-scoring outputs")
    content_type = dspy.InputField(desc="Type: roadmap, slides, document, research")

    improved_prompt = dspy.OutputField(desc="An improved version of the prompt")
    changes_made = dspy.OutputField(desc="What was changed and why")
    expected_improvement = dspy.OutputField(desc="Expected improvement percentage")
```

### Deliverables
- [ ] `/evolve-prompt` endpoint in DSPy service
- [ ] `PromptEvolver` class with MIPRO integration
- [ ] `PromptEvolutionSignature` for structured evolution
- [ ] Unit tests for evolution logic

### Estimated Complexity: Medium

---

## Phase 2: Node.js Client Integration

### Objective
Create Node.js client methods to call the MIPRO evolution endpoint.

### Tasks

#### 2.1 Extend DSPy Service Client
```javascript
// server/clients/dspy-service.js

class DSPyServiceClient {
  // ... existing methods ...

  /**
   * Evolve a prompt using MIPRO
   * @param {string} contentType - Content type
   * @param {string} currentPrompt - Current prompt
   * @param {Array} performanceHistory - [{prompt, score, output}]
   * @param {number} numCandidates - Number of candidates
   */
  async evolvePrompt(contentType, currentPrompt, performanceHistory, numCandidates = 3) {
    return this._request('/evolve-prompt', 'POST', {
      content_type: contentType,
      current_prompt: currentPrompt,
      performance_history: performanceHistory,
      num_candidates: numCandidates
    });
  }
}
```

#### 2.2 Create Evolution Integration Module
```javascript
// server/utils/llmEvolution.js

/**
 * LLM-based prompt evolution using DSPy MIPRO.
 *
 * Replaces rule-based mutations with intelligent prompt synthesis.
 */
export class LLMPromptEvolver {
  constructor(dspyClient) {
    this.dspyClient = dspyClient;
    this.evolutionHistory = new Map(); // contentType -> history
  }

  async evolve(contentType, currentPrompt, recentResults) {
    // Extract high/low performers from results
    // Call DSPy evolution endpoint
    // Return ranked candidates
  }

  recordResult(contentType, prompt, output, score) {
    // Store for future evolution context
  }
}
```

### Deliverables
- [ ] `evolvePrompt()` method in DSPy client
- [ ] `LLMPromptEvolver` class
- [ ] Performance history management
- [ ] Integration tests

### Estimated Complexity: Low-Medium

---

## Phase 3: Evolution Engine Refactor

### Objective
Refactor `PromptEvolutionEngine` to use LLM evolution as the primary mutation strategy.

### Tasks

#### 3.1 Add LLM Evolution Mode
```javascript
// server/utils/promptEvolution.js

export class PromptEvolutionEngine {
  constructor(options = {}) {
    this.evolutionMode = options.evolutionMode || 'hybrid'; // 'rule', 'llm', 'hybrid'
    this.llmEvolver = options.llmEvolver || null;
    // ... existing constructor ...
  }

  async evolvePrompt(contentType) {
    switch (this.evolutionMode) {
      case 'llm':
        return this._evolveLLM(contentType);
      case 'hybrid':
        return this._evolveHybrid(contentType);
      default:
        return this._evolveRuleBased(contentType); // existing logic
    }
  }

  async _evolveLLM(contentType) {
    if (!this.llmEvolver) {
      console.warn('LLM evolver not available, falling back to rules');
      return this._evolveRuleBased(contentType);
    }

    const history = this._getPerformanceHistory(contentType);
    const currentPrompt = this.getChampion(contentType);

    const candidates = await this.llmEvolver.evolve(
      contentType,
      currentPrompt,
      history
    );

    // Select best candidate as new challenger
    return this._selectCandidate(candidates);
  }

  async _evolveHybrid(contentType) {
    // Try LLM evolution first
    // Fall back to rule-based if LLM fails
    // Occasionally use rule-based for diversity
  }
}
```

#### 3.2 Add Performance History Tracking
```javascript
// Track detailed performance for LLM context

_recordForLLMContext(contentType, prompt, output, score) {
  const key = `${contentType}:history`;

  if (!this.llmContext.has(key)) {
    this.llmContext.set(key, []);
  }

  const history = this.llmContext.get(key);
  history.push({
    prompt,
    output: this._summarizeOutput(output), // Keep manageable size
    score,
    timestamp: Date.now()
  });

  // Keep last 50 entries
  if (history.length > 50) {
    history.shift();
  }
}
```

### Deliverables
- [ ] Refactored `PromptEvolutionEngine` with LLM mode
- [ ] Performance history management
- [ ] Hybrid evolution strategy
- [ ] Migration guide for existing configs

### Estimated Complexity: Medium-High

---

## Phase 4: Training Workflow Integration

### Objective
Connect LLM evolution to the training graph workflow.

### Tasks

#### 4.1 Initialize LLM Evolver in Training Graph
```javascript
// server/workflows/training-nodes.js

export async function initializeNode(state) {
  // ... existing initialization ...

  // Initialize LLM evolver if DSPy service available
  let llmEvolver = null;
  if (dspyStatus.serviceAvailable) {
    const dspyClient = new DSPyServiceClient();
    llmEvolver = new LLMPromptEvolver(dspyClient);
  }

  const engine = new PromptEvolutionEngine({
    evolutionMode: llmEvolver ? 'hybrid' : 'rule',
    llmEvolver,
    // ... existing options ...
  });

  return {
    evolutionState: engine.serialize(),
    llmEvolverAvailable: !!llmEvolver,
    // ...
  };
}
```

#### 4.2 Async LLM Evolution in Check Node
```javascript
// server/workflows/training-nodes.js

export async function checkEvolutionNode(state) {
  // ... existing evolution logic ...

  // Try LLM evolution for promoted content types
  if (evolutionResults.promotions.length > 0 && state.llmEvolverAvailable) {
    for (const promotion of evolutionResults.promotions) {
      try {
        const llmResult = await engine.evolvePrompt(promotion.contentType);
        if (llmResult.evolved) {
          evolutionResults.llmEvolutions = evolutionResults.llmEvolutions || [];
          evolutionResults.llmEvolutions.push({
            contentType: promotion.contentType,
            reasoning: llmResult.reasoning,
            expectedImprovement: llmResult.expectedImprovement
          });
        }
      } catch (err) {
        console.warn(`LLM evolution failed: ${err.message}`);
      }
    }
  }
}
```

### Deliverables
- [ ] LLM evolver initialization in training graph
- [ ] Evolution node integration
- [ ] Graceful fallback when LLM unavailable
- [ ] Event logging for LLM evolutions

### Estimated Complexity: Medium

---

## Phase 5: Monitoring and Analytics

### Objective
Add monitoring to compare LLM vs rule-based evolution effectiveness.

### Tasks

#### 5.1 Evolution Source Tracking
```javascript
// Track which evolution method was used
await trainingEvents.onEvolutionCycle(sessionId, iteration, {
  ...evolutionResults,
  evolutionMethod: engine.evolutionMode,
  llmEvolutionsCount: evolutionResults.llmEvolutions?.length || 0,
  ruleEvolutionsCount: evolutionResults.evolutions?.length || 0
});
```

#### 5.2 Evolution Effectiveness Metrics
```javascript
// server/utils/evolutionMetrics.js

export class EvolutionMetrics {
  async compareEvolutionMethods(sinceMs = 86400000) {
    // Query Redis for evolution events
    // Calculate success rate by method
    // Return comparison stats
    return {
      llm: {
        attempts: 42,
        successfulPromotions: 8,
        avgImprovement: 12.5
      },
      rule: {
        attempts: 158,
        successfulPromotions: 23,
        avgImprovement: 5.2
      }
    };
  }
}
```

#### 5.3 API Endpoint for Evolution Stats
```javascript
// GET /api/integration/evolution/stats
router.get('/evolution/stats', async (req, res) => {
  const metrics = new EvolutionMetrics();
  const comparison = await metrics.compareEvolutionMethods();
  res.json(comparison);
});
```

### Deliverables
- [ ] Evolution method tracking in events
- [ ] `EvolutionMetrics` class
- [ ] Stats API endpoint
- [ ] Dashboard-ready metrics format

### Estimated Complexity: Low-Medium

---

## Success Metrics

| Metric | Current (Rule-based) | Target (LLM) |
|--------|---------------------|--------------|
| Promotion success rate | ~15% | >25% |
| Avg improvement per promotion | 5% | >10% |
| Time to first promotion | 100+ iterations | <50 iterations |
| Prompt quality ceiling | Plateaus | Continuous improvement |

## Dependencies

- DSPy service running with MIPRO support
- Redis for performance history storage
- Sufficient LLM API quota for evolution calls

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM latency slows training | Async evolution, don't block main loop |
| LLM generates invalid prompts | Validate before accepting as candidate |
| Higher API costs | Rate limit evolution calls, cache similar requests |
| Regression in performance | Keep rule-based as fallback, A/B test methods |
