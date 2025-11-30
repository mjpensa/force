# Training Integration Gap 4: DSPy Library Integration

## Executive Summary

**Gap**: The codebase implements a custom DSPy-style signature system but does not use the actual DSPy library. This means missing out on DSPy's powerful optimizers, automatic few-shot learning, and programmatic prompt optimization.

**Impact**:
- No automatic few-shot optimization (BootstrapFewShot)
- No metric-driven signature optimization (MIPRO, SignatureOptimizer)
- Manual prompt evolution instead of automatic
- No built-in tracing and debugging
- Custom implementation maintenance burden

**Effort**: High (16-24 hours)
**Priority**: Medium - Enhances optimization capabilities

**Note**: DSPy is a Python library. This plan explores options for integrating DSPy capabilities into a Node.js environment.

---

## Current State Analysis

### What Exists (Custom Implementation)

1. **Signature System** (`server/layers/signatures/`)
   - Custom `Signature` class with `generatePrompt()`
   - `SignatureBuilder` for fluent API
   - Field types and validation
   - Content-specific signatures (Roadmap, Slides, Document, ResearchAnalysis)

2. **Prompt Evolution** (`server/utils/promptEvolution.js`)
   - Manual mutation strategies
   - A/B testing with champion/candidate
   - Statistical promotion logic

3. **Missing DSPy Features**:
   - `BootstrapFewShot` - Automatic few-shot example mining
   - `MIPRO` - Multi-stage instruction proposal
   - `SignatureOptimizer` - Metric-driven optimization
   - `ChainOfThought` - Built-in reasoning patterns
   - `ReAct` - Reasoning + Acting patterns
   - `Teleprompter` - Prompt compilation

### Current Signature Example

```javascript
// Current custom implementation (server/layers/signatures/roadmap.js)
export const RoadmapSignature = createSignature('RoadmapGeneration')
  .describe('Generate a Gantt chart/roadmap from research documents')
  .instruct(ROADMAP_INSTRUCTIONS)
  .input('userPrompt', FieldType.STRING, { required: true })
  .input('researchFiles', FieldType.ARRAY, { required: true })
  .output('title', FieldType.STRING, { required: true })
  .output('timeColumns', FieldType.ARRAY, { required: true })
  .configure({ outputFormat: 'json', deterministic: true })
  .build();
```

---

## Integration Options

### Option A: Python DSPy via HTTP Service (Recommended)

Run DSPy as a separate Python microservice that handles optimization tasks.

```
┌──────────────────────────────────────────────────────┐
│ Node.js Server                                        │
│ ┌──────────────────┐    ┌──────────────────────────┐ │
│ │ Training System  │───▶│ DSPy Service Client      │ │
│ │ (existing)       │    │ (HTTP calls to Python)   │ │
│ └──────────────────┘    └───────────┬──────────────┘ │
└─────────────────────────────────────┼────────────────┘
                                      │ HTTP
┌─────────────────────────────────────▼────────────────┐
│ Python DSPy Service (port 8001)                      │
│ ┌──────────────────┐    ┌──────────────────────────┐ │
│ │ FastAPI Server   │───▶│ DSPy Optimizers          │ │
│ │                  │    │ - BootstrapFewShot       │ │
│ │                  │    │ - MIPRO                  │ │
│ │                  │    │ - SignatureOptimizer     │ │
│ └──────────────────┘    └──────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Pros**:
- Full DSPy feature access
- Mature Python ecosystem
- Can use GPU for local models
- Clean separation of concerns

**Cons**:
- Additional service to deploy
- Network latency between services
- Python environment management

### Option B: Python DSPy via Subprocess

Call Python scripts directly from Node.js for optimization tasks.

**Pros**:
- No separate service needed
- Simpler deployment (single container)

**Cons**:
- Process startup overhead
- Limited communication patterns
- Harder to debug

### Option C: WebAssembly DSPy Port (Future)

Port DSPy core to WebAssembly for native Node.js execution.

**Pros**:
- Native integration
- No Python dependency

**Cons**:
- Does not exist yet
- Significant development effort
- May not support all features

**Recommendation**: Option A for best balance of features, maintainability, and performance.

---

## Implementation Plan

### Phase 1: Create Python DSPy Service

**Step 1.1: Set up Python project structure**

```
dspy-service/
├── requirements.txt
├── Dockerfile
├── main.py
├── signatures/
│   ├── __init__.py
│   ├── roadmap.py
│   ├── slides.py
│   ├── document.py
│   └── research.py
├── optimizers/
│   ├── __init__.py
│   ├── few_shot.py
│   └── mipro.py
└── tests/
    └── test_signatures.py
```

**Step 1.2: Create requirements.txt**

```
# dspy-service/requirements.txt
dspy-ai>=2.4.0
fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.5.0
google-generativeai>=0.3.0
redis>=5.0.0
python-dotenv>=1.0.0
```

**Step 1.3: Create Dockerfile**

```dockerfile
# dspy-service/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Phase 2: Implement DSPy Signatures

**Step 2.1: Create base signature patterns**

```python
# dspy-service/signatures/roadmap.py
import dspy

class RoadmapSignature(dspy.Signature):
    """Generate a Gantt chart roadmap from research documents."""

    user_prompt: str = dspy.InputField(desc="User's roadmap request")
    research_content: str = dspy.InputField(desc="Combined research file content")

    title: str = dspy.OutputField(desc="Roadmap title")
    time_columns: list = dspy.OutputField(desc="Array of time period columns")
    rows: list = dspy.OutputField(desc="Array of swimlane rows with tasks")

class RoadmapModule(dspy.Module):
    """DSPy module for roadmap generation with chain-of-thought."""

    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(RoadmapSignature)

    def forward(self, user_prompt: str, research_content: str):
        return self.generate(
            user_prompt=user_prompt,
            research_content=research_content
        )
```

**Step 2.2: Repeat for other content types**

```python
# dspy-service/signatures/slides.py
import dspy

class SlidesSignature(dspy.Signature):
    """Generate presentation slides from research documents."""

    user_prompt: str = dspy.InputField(desc="User's presentation request")
    research_content: str = dspy.InputField(desc="Combined research file content")

    title: str = dspy.OutputField(desc="Presentation title")
    slides: list = dspy.OutputField(desc="Array of slide objects")

class SlidesModule(dspy.Module):
    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(SlidesSignature)

    def forward(self, user_prompt: str, research_content: str):
        return self.generate(
            user_prompt=user_prompt,
            research_content=research_content
        )
```

### Phase 3: Implement DSPy Optimizers

**Step 3.1: Create few-shot optimizer**

```python
# dspy-service/optimizers/few_shot.py
import dspy
from dspy.teleprompt import BootstrapFewShot
import json

class FewShotOptimizer:
    """Wraps DSPy BootstrapFewShot for automatic few-shot example mining."""

    def __init__(self, module_class, metric_fn):
        self.module_class = module_class
        self.metric_fn = metric_fn
        self.optimized_module = None

    def optimize(self, trainset: list, max_bootstrapped_demos: int = 4):
        """
        Optimize module with training examples.

        Args:
            trainset: List of dspy.Example objects
            max_bootstrapped_demos: Number of few-shot examples to mine

        Returns:
            Optimized module
        """
        teleprompter = BootstrapFewShot(
            metric=self.metric_fn,
            max_bootstrapped_demos=max_bootstrapped_demos,
            max_labeled_demos=2
        )

        self.optimized_module = teleprompter.compile(
            self.module_class(),
            trainset=trainset
        )

        return self.optimized_module

    def save(self, path: str):
        """Save optimized module to JSON."""
        if self.optimized_module:
            self.optimized_module.save(path)

    def load(self, path: str):
        """Load optimized module from JSON."""
        module = self.module_class()
        module.load(path)
        self.optimized_module = module
        return module
```

**Step 3.2: Create MIPRO optimizer**

```python
# dspy-service/optimizers/mipro.py
import dspy
from dspy.teleprompt import MIPRO

class MIPROOptimizer:
    """Wraps DSPy MIPRO for multi-stage instruction proposal optimization."""

    def __init__(self, module_class, metric_fn):
        self.module_class = module_class
        self.metric_fn = metric_fn
        self.optimized_module = None

    def optimize(self, trainset: list, num_candidates: int = 10, num_threads: int = 4):
        """
        Optimize module with MIPRO.

        Args:
            trainset: List of dspy.Example objects
            num_candidates: Number of instruction candidates
            num_threads: Parallel evaluation threads

        Returns:
            Optimized module
        """
        teleprompter = MIPRO(
            metric=self.metric_fn,
            num_candidates=num_candidates,
            num_threads=num_threads,
            verbose=True
        )

        self.optimized_module = teleprompter.compile(
            self.module_class(),
            trainset=trainset
        )

        return self.optimized_module

    def get_optimized_instructions(self) -> str:
        """Extract optimized instructions from module."""
        if self.optimized_module and hasattr(self.optimized_module, 'generate'):
            return self.optimized_module.generate.extended_signature.instructions
        return None
```

### Phase 4: Create FastAPI Service

**Step 4.1: Main application**

```python
# dspy-service/main.py
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import dspy
import redis
from dotenv import load_dotenv

from signatures.roadmap import RoadmapModule
from signatures.slides import SlidesModule
from signatures.document import DocumentModule
from signatures.research import ResearchModule
from optimizers.few_shot import FewShotOptimizer
from optimizers.mipro import MIPROOptimizer

load_dotenv()

app = FastAPI(
    title="DSPy Optimization Service",
    description="DSPy optimization capabilities for Force training system",
    version="1.0.0"
)

# Configure DSPy with Gemini
gemini_lm = dspy.Google(
    model="gemini-1.5-flash",
    api_key=os.getenv("GEMINI_API_KEY")
)
dspy.settings.configure(lm=gemini_lm)

# Redis connection for caching optimized prompts
redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

# Module registry
MODULES = {
    "roadmap": RoadmapModule,
    "slides": SlidesModule,
    "document": DocumentModule,
    "research-analysis": ResearchModule
}

# Pydantic models
class TrainingExample(BaseModel):
    user_prompt: str
    research_content: str
    expected_output: Dict[str, Any]
    quality_score: float

class OptimizeRequest(BaseModel):
    signature_type: str
    examples: List[TrainingExample]
    optimizer: str = "bootstrap"  # "bootstrap" or "mipro"
    config: Optional[Dict] = None

class OptimizeResponse(BaseModel):
    success: bool
    signature_type: str
    optimizer_used: str
    optimized_instructions: Optional[str]
    few_shot_examples: Optional[List[Dict]]
    metrics: Dict[str, float]

class GenerateRequest(BaseModel):
    signature_type: str
    user_prompt: str
    research_content: str
    use_optimized: bool = True

class GenerateResponse(BaseModel):
    success: bool
    output: Dict[str, Any]
    used_optimized: bool
    metadata: Dict[str, Any]


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "dspy_version": dspy.__version__,
        "modules_available": list(MODULES.keys())
    }


@app.post("/optimize", response_model=OptimizeResponse)
async def optimize_signature(request: OptimizeRequest):
    """
    Optimize a signature using DSPy optimizers.

    Takes training examples and runs BootstrapFewShot or MIPRO
    to find optimal few-shot examples and instructions.
    """
    if request.signature_type not in MODULES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown signature type: {request.signature_type}"
        )

    module_class = MODULES[request.signature_type]
    config = request.config or {}

    # Convert examples to DSPy format
    trainset = []
    for ex in request.examples:
        dspy_example = dspy.Example(
            user_prompt=ex.user_prompt,
            research_content=ex.research_content,
            **ex.expected_output
        ).with_inputs("user_prompt", "research_content")
        trainset.append(dspy_example)

    # Define metric based on quality score
    def quality_metric(example, pred, trace=None):
        # Compare prediction to expected output
        # Return score 0-1
        if not pred:
            return 0.0

        # Check required fields exist
        expected_fields = list(example.expected_output.keys()) if hasattr(example, 'expected_output') else []
        present_fields = sum(1 for f in expected_fields if hasattr(pred, f) and getattr(pred, f))

        return present_fields / max(len(expected_fields), 1)

    # Run optimization
    if request.optimizer == "mipro":
        optimizer = MIPROOptimizer(module_class, quality_metric)
        optimized = optimizer.optimize(
            trainset,
            num_candidates=config.get("num_candidates", 10)
        )
        optimized_instructions = optimizer.get_optimized_instructions()
    else:
        optimizer = FewShotOptimizer(module_class, quality_metric)
        optimized = optimizer.optimize(
            trainset,
            max_bootstrapped_demos=config.get("max_demos", 4)
        )
        optimized_instructions = None

    # Extract few-shot examples if present
    few_shot_examples = []
    if hasattr(optimized, 'generate') and hasattr(optimized.generate, 'demos'):
        for demo in optimized.generate.demos:
            few_shot_examples.append({
                "user_prompt": demo.user_prompt,
                "research_content": demo.research_content[:500] + "...",  # Truncate
                "output": {k: getattr(demo, k) for k in demo._output_fields}
            })

    # Save optimized module to Redis
    cache_key = f"dspy:optimized:{request.signature_type}"
    optimizer.save(f"/tmp/{request.signature_type}_optimized.json")
    with open(f"/tmp/{request.signature_type}_optimized.json", "r") as f:
        redis_client.setex(cache_key, 86400 * 7, f.read())  # 7-day TTL

    return OptimizeResponse(
        success=True,
        signature_type=request.signature_type,
        optimizer_used=request.optimizer,
        optimized_instructions=optimized_instructions,
        few_shot_examples=few_shot_examples,
        metrics={
            "examples_used": len(trainset),
            "few_shot_count": len(few_shot_examples)
        }
    )


@app.post("/generate", response_model=GenerateResponse)
async def generate_content(request: GenerateRequest):
    """
    Generate content using DSPy module.

    Uses optimized module if available, falls back to base module.
    """
    if request.signature_type not in MODULES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown signature type: {request.signature_type}"
        )

    module_class = MODULES[request.signature_type]
    module = module_class()
    used_optimized = False

    # Try to load optimized module
    if request.use_optimized:
        cache_key = f"dspy:optimized:{request.signature_type}"
        cached = redis_client.get(cache_key)
        if cached:
            try:
                with open(f"/tmp/{request.signature_type}_optimized.json", "w") as f:
                    f.write(cached.decode())
                module.load(f"/tmp/{request.signature_type}_optimized.json")
                used_optimized = True
            except Exception as e:
                print(f"Failed to load optimized module: {e}")

    # Run generation
    try:
        result = module(
            user_prompt=request.user_prompt,
            research_content=request.research_content
        )

        # Extract output fields
        output = {}
        for field in result._output_fields:
            output[field] = getattr(result, field)

        return GenerateResponse(
            success=True,
            output=output,
            used_optimized=used_optimized,
            metadata={
                "signature_type": request.signature_type,
                "reasoning": result.rationale if hasattr(result, 'rationale') else None
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/signatures/{signature_type}")
async def get_signature_info(signature_type: str):
    """Get information about a signature."""
    if signature_type not in MODULES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown signature type: {signature_type}"
        )

    module = MODULES[signature_type]()

    return {
        "signature_type": signature_type,
        "description": module.generate.signature.__doc__,
        "input_fields": list(module.generate.signature.input_fields.keys()),
        "output_fields": list(module.generate.signature.output_fields.keys()),
        "is_optimized": redis_client.exists(f"dspy:optimized:{signature_type}") > 0
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
```

### Phase 5: Create Node.js Client

**Step 5.1: Create DSPy service client**

```javascript
// server/clients/dspy-service.js

/**
 * Client for DSPy Python service
 */
export class DSPyServiceClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.DSPY_SERVICE_URL || 'http://localhost:8001';
    this.timeout = options.timeout || 60000; // 60s for optimization
  }

  /**
   * Check service health
   */
  async health() {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`DSPy service unhealthy: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Optimize a signature with training examples
   *
   * @param {string} signatureType - roadmap, slides, document, research-analysis
   * @param {Array} examples - Training examples
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimization result
   */
  async optimize(signatureType, examples, options = {}) {
    const response = await fetch(`${this.baseUrl}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature_type: signatureType,
        examples: examples.map(ex => ({
          user_prompt: ex.userPrompt || ex.prompt,
          research_content: this._combineResearchFiles(ex.researchFiles),
          expected_output: ex.expectedOutput || ex.output,
          quality_score: ex.qualityScore || ex.score || 0.8
        })),
        optimizer: options.optimizer || 'bootstrap',
        config: options.config
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Optimization failed: ${error.detail}`);
    }

    return response.json();
  }

  /**
   * Generate content using DSPy module
   *
   * @param {string} signatureType - Signature type
   * @param {Object} inputs - Generation inputs
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated content
   */
  async generate(signatureType, inputs, options = {}) {
    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature_type: signatureType,
        user_prompt: inputs.userPrompt || inputs.prompt,
        research_content: this._combineResearchFiles(inputs.researchFiles),
        use_optimized: options.useOptimized !== false
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Generation failed: ${error.detail}`);
    }

    return response.json();
  }

  /**
   * Get signature information
   */
  async getSignatureInfo(signatureType) {
    const response = await fetch(`${this.baseUrl}/signatures/${signatureType}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Failed to get signature info: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Combine research files into single content string
   */
  _combineResearchFiles(files) {
    if (!files || !Array.isArray(files)) {
      return '';
    }

    return files.map(f => {
      if (typeof f === 'string') return f;
      return f.content || f.text || JSON.stringify(f);
    }).join('\n\n---\n\n');
  }
}

// Export singleton
export const dspyService = new DSPyServiceClient();
```

### Phase 6: Integrate with Training System

**Step 6.1: Add DSPy optimization to evolution cycle**

```javascript
// server/utils/promptEvolution.js - Add DSPy integration

import { dspyService } from '../clients/dspy-service.js';

/**
 * Enhanced PromptEvolutionEngine with DSPy optimization
 */
export class PromptEvolutionEngine {
  // ... existing code ...

  /**
   * Run DSPy optimization for a content type
   *
   * @param {string} contentType - Content type to optimize
   * @param {Array} trainingExamples - High-quality training examples
   * @returns {Promise<Object>} Optimization result
   */
  async runDSPyOptimization(contentType, trainingExamples) {
    const signatureType = contentType.toLowerCase().replace('researchanalysis', 'research-analysis');

    try {
      // Check DSPy service availability
      await dspyService.health();

      // Run optimization
      const result = await dspyService.optimize(signatureType, trainingExamples, {
        optimizer: 'bootstrap',
        config: {
          max_demos: 4
        }
      });

      if (result.success) {
        console.log(`[DSPy] Optimized ${contentType}:`);
        console.log(`  - Few-shot examples: ${result.few_shot_examples?.length || 0}`);
        if (result.optimized_instructions) {
          console.log(`  - New instructions extracted`);
        }

        // Store optimized instructions as new candidate
        if (result.optimized_instructions) {
          this.promptVersions[contentType].candidate = result.optimized_instructions;
          this.promptVersions[contentType].isTestingCandidate = true;
          this.promptVersions[contentType].candidateSource = 'dspy-mipro';
        }
      }

      return result;

    } catch (error) {
      console.warn(`[DSPy] Optimization unavailable: ${error.message}`);
      // Fallback to manual evolution
      return null;
    }
  }

  /**
   * Enhanced evolve that tries DSPy first
   */
  async evolvePromptEnhanced(contentType, trainingExamples = []) {
    // Try DSPy optimization if we have enough examples
    if (trainingExamples.length >= 5) {
      const dspyResult = await this.runDSPyOptimization(contentType, trainingExamples);
      if (dspyResult?.success) {
        return {
          evolved: true,
          method: 'dspy',
          result: dspyResult
        };
      }
    }

    // Fallback to manual evolution
    return this.evolvePrompt(contentType);
  }
}
```

**Step 6.2: Add DSPy generation option**

```javascript
// server/routes/generate.js - Add DSPy generation path

import { dspyService } from '../clients/dspy-service.js';

/**
 * Generate content with optional DSPy backend
 */
async function generateContent(contentType, inputs, options = {}) {
  const { useDSPy = false } = options;
  const signatureType = contentType.toLowerCase().replace('researchanalysis', 'research-analysis');

  if (useDSPy) {
    try {
      const result = await dspyService.generate(signatureType, inputs, {
        useOptimized: true
      });

      if (result.success) {
        return {
          success: true,
          data: result.output,
          metadata: {
            ...result.metadata,
            backend: 'dspy',
            usedOptimized: result.used_optimized
          }
        };
      }
    } catch (error) {
      console.warn(`DSPy generation failed, falling back: ${error.message}`);
    }
  }

  // Fallback to existing generation
  return generateWithExistingSystem(contentType, inputs);
}
```

---

## Deployment Configuration

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  force-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DSPY_SERVICE_URL=http://dspy-service:8001
      - REDIS_URL=redis://redis:6379
    depends_on:
      - dspy-service
      - redis

  dspy-service:
    build: ./dspy-service
    ports:
      - "8001:8001"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

### Environment Variables

```bash
# .env additions
DSPY_SERVICE_URL=http://localhost:8001
GEMINI_API_KEY=your-gemini-key

# For dspy-service/.env
GEMINI_API_KEY=your-gemini-key
REDIS_URL=redis://localhost:6379
```

---

## File Structure After Implementation

```
project/
├── server/
│   ├── clients/
│   │   └── dspy-service.js         # NEW: Node.js client
│   ├── utils/
│   │   └── promptEvolution.js      # MODIFIED: DSPy integration
│   └── routes/
│       └── generate.js             # MODIFIED: DSPy generation option
│
├── dspy-service/                    # NEW: Python service
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── signatures/
│   │   ├── roadmap.py
│   │   ├── slides.py
│   │   ├── document.py
│   │   └── research.py
│   └── optimizers/
│       ├── few_shot.py
│       └── mipro.py
│
└── docker-compose.yml               # NEW/MODIFIED
```

---

## Testing Requirements

### Python Service Tests

```python
# dspy-service/tests/test_signatures.py
import pytest
from signatures.roadmap import RoadmapModule

def test_roadmap_module_initialization():
    module = RoadmapModule()
    assert module.generate is not None

def test_roadmap_generation():
    module = RoadmapModule()
    result = module(
        user_prompt="Create a 3-month roadmap",
        research_content="Project details..."
    )
    assert result.title is not None
    assert isinstance(result.time_columns, list)
```

### Node.js Client Tests

```javascript
// tests/unit/dspy-client.test.js
describe('DSPyServiceClient', () => {
  test('health check works', async () => {
    const result = await dspyService.health();
    expect(result.status).toBe('healthy');
  });

  test('optimize returns result', async () => {
    const result = await dspyService.optimize('roadmap', mockExamples);
    expect(result.success).toBe(true);
  });
});
```

---

## Rollback Plan

1. DSPy service is optional - can be disabled via feature flag
2. All existing generation paths remain unchanged
3. Evolution engine falls back to manual evolution if DSPy unavailable
4. No data migration required

---

## Success Criteria

| Metric | Target |
|--------|--------|
| DSPy service running | Health endpoint returns OK |
| Optimization works | Can optimize each signature type |
| Few-shot mining | Extracts relevant examples |
| Integration works | Node.js can call Python service |
| No regression | Existing generation unaffected |

---

## Estimated Timeline

| Phase | Duration |
|-------|----------|
| Phase 1: Python project setup | 1 hour |
| Phase 2: DSPy signatures | 3 hours |
| Phase 3: Optimizers | 2 hours |
| Phase 4: FastAPI service | 3 hours |
| Phase 5: Node.js client | 2 hours |
| Phase 6: Integration | 3 hours |
| Docker setup | 1 hour |
| Testing | 4 hours |
| **Total** | **~20 hours** |

---

## Dependencies

- Python 3.11+
- DSPy library (pip install dspy-ai)
- FastAPI + Uvicorn
- Docker for containerization
- Redis for caching optimized modules
- Gemini API key shared with main service

---

## Future Enhancements

1. **Add MIPRO optimization** - Multi-stage instruction proposal
2. **Implement signature compiler** - Pre-compile optimized prompts
3. **Add tracing** - DSPy's built-in tracing for debugging
4. **GPU support** - For local model inference
5. **Batch optimization** - Optimize all signatures together
