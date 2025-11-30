"""
DSPy Optimization Service

FastAPI service providing DSPy optimization capabilities for the Force training system.
Enables automatic few-shot learning, instruction optimization, and content generation
using DSPy's powerful optimization features.
"""

import os
import json
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import dspy
import redis
from dotenv import load_dotenv

from signatures.roadmap import RoadmapModule
from signatures.slides import SlidesModule
from signatures.document import DocumentModule
from signatures.research import ResearchModule
from optimizers.few_shot import FewShotOptimizer
from optimizers.mipro import MIPROOptimizer

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="DSPy Optimization Service",
    description="DSPy optimization capabilities for Force training system",
    version="1.0.0"
)

# Configure DSPy with Gemini
try:
    gemini_lm = dspy.Google(
        model="gemini-1.5-flash",
        api_key=os.getenv("GEMINI_API_KEY")
    )
    dspy.settings.configure(lm=gemini_lm)
    LM_CONFIGURED = True
except Exception as e:
    print(f"[DSPy] Warning: Could not configure LM: {e}")
    LM_CONFIGURED = False

# Redis connection for caching optimized prompts
try:
    redis_client = redis.Redis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379"),
        decode_responses=True
    )
    redis_client.ping()
    REDIS_CONNECTED = True
except Exception as e:
    print(f"[DSPy] Warning: Redis not available: {e}")
    redis_client = None
    REDIS_CONNECTED = False

# Module registry
MODULES = {
    "roadmap": RoadmapModule,
    "slides": SlidesModule,
    "document": DocumentModule,
    "research-analysis": ResearchModule
}

# Cache TTL (7 days)
CACHE_TTL = 86400 * 7


# Pydantic models for request/response
class TrainingExample(BaseModel):
    """A single training example for optimization."""
    user_prompt: str
    research_content: str
    expected_output: Dict[str, Any]
    quality_score: float = 0.8


class OptimizeRequest(BaseModel):
    """Request to optimize a signature."""
    signature_type: str
    examples: List[TrainingExample]
    optimizer: str = "bootstrap"  # "bootstrap" or "mipro"
    config: Optional[Dict] = None


class OptimizeResponse(BaseModel):
    """Response from optimization."""
    success: bool
    signature_type: str
    optimizer_used: str
    optimized_instructions: Optional[str] = None
    few_shot_examples: Optional[List[Dict]] = None
    metrics: Dict[str, Any]


class GenerateRequest(BaseModel):
    """Request to generate content."""
    signature_type: str
    user_prompt: str
    research_content: str
    use_optimized: bool = True


class GenerateResponse(BaseModel):
    """Response from generation."""
    success: bool
    output: Dict[str, Any]
    used_optimized: bool
    metadata: Dict[str, Any]


class SignatureInfo(BaseModel):
    """Information about a signature."""
    signature_type: str
    description: str
    input_fields: List[str]
    output_fields: List[str]
    is_optimized: bool


# Quality metric for optimization
def quality_metric(example, pred, trace=None) -> float:
    """
    Metric function for evaluating predictions.

    Compares prediction to expected output and returns a score 0-1.
    """
    if not pred:
        return 0.0

    # Check if required output fields are present and non-empty
    score = 0.0
    total_fields = 0

    # Get output fields from the prediction
    output_fields = []
    if hasattr(pred, '_output_fields'):
        output_fields = pred._output_fields
    elif hasattr(example, 'expected_output'):
        output_fields = list(example.expected_output.keys())

    for field in output_fields:
        total_fields += 1
        if hasattr(pred, field):
            value = getattr(pred, field)
            if value is not None and value != "" and value != []:
                score += 1.0

    return score / max(total_fields, 1)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "dspy_version": dspy.__version__,
        "lm_configured": LM_CONFIGURED,
        "redis_connected": REDIS_CONNECTED,
        "modules_available": list(MODULES.keys())
    }


@app.post("/optimize", response_model=OptimizeResponse)
async def optimize_signature(request: OptimizeRequest):
    """
    Optimize a signature using DSPy optimizers.

    Takes training examples and runs BootstrapFewShot or MIPRO
    to find optimal few-shot examples and instructions.
    """
    if not LM_CONFIGURED:
        raise HTTPException(
            status_code=503,
            detail="Language model not configured. Set GEMINI_API_KEY."
        )

    if request.signature_type not in MODULES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown signature type: {request.signature_type}. "
                   f"Available: {list(MODULES.keys())}"
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

    if len(trainset) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 training examples required for optimization"
        )

    # Run optimization
    try:
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
        if hasattr(optimizer, 'get_demos'):
            demos = optimizer.get_demos()
            for demo in demos:
                demo_dict = {
                    "user_prompt": getattr(demo, 'user_prompt', ''),
                    "research_content": getattr(demo, 'research_content', '')[:500] + "...",
                }
                # Add output fields
                if hasattr(demo, '_output_fields'):
                    for field in demo._output_fields:
                        demo_dict[field] = getattr(demo, field, None)
                few_shot_examples.append(demo_dict)

        # Cache optimized module if Redis available
        if redis_client:
            cache_key = f"dspy:optimized:{request.signature_type}"
            save_path = f"/tmp/{request.signature_type}_optimized.json"
            optimizer.save(save_path)
            with open(save_path, "r") as f:
                redis_client.setex(cache_key, CACHE_TTL, f.read())

        return OptimizeResponse(
            success=True,
            signature_type=request.signature_type,
            optimizer_used=request.optimizer,
            optimized_instructions=optimized_instructions,
            few_shot_examples=few_shot_examples,
            metrics={
                "examples_used": len(trainset),
                "few_shot_count": len(few_shot_examples),
                **optimizer.get_optimization_stats()
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Optimization failed: {str(e)}"
        )


@app.post("/generate", response_model=GenerateResponse)
async def generate_content(request: GenerateRequest):
    """
    Generate content using DSPy module.

    Uses optimized module if available, falls back to base module.
    """
    if not LM_CONFIGURED:
        raise HTTPException(
            status_code=503,
            detail="Language model not configured. Set GEMINI_API_KEY."
        )

    if request.signature_type not in MODULES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown signature type: {request.signature_type}"
        )

    module_class = MODULES[request.signature_type]
    module = module_class()
    used_optimized = False

    # Try to load optimized module from cache
    if request.use_optimized and redis_client:
        cache_key = f"dspy:optimized:{request.signature_type}"
        cached = redis_client.get(cache_key)
        if cached:
            try:
                save_path = f"/tmp/{request.signature_type}_optimized.json"
                with open(save_path, "w") as f:
                    f.write(cached)
                module.load(save_path)
                used_optimized = True
            except Exception as e:
                print(f"[DSPy] Failed to load optimized module: {e}")

    # Run generation
    try:
        result = module(
            user_prompt=request.user_prompt,
            research_content=request.research_content
        )

        # Extract output fields
        output = {}
        if hasattr(result, '_output_fields'):
            for field in result._output_fields:
                output[field] = getattr(result, field, None)
        else:
            # Try common output fields
            for field in ['title', 'slides', 'sections', 'rows', 'time_columns',
                          'subtitle', 'summary', 'key_findings', 'analysis',
                          'recommendations']:
                if hasattr(result, field):
                    output[field] = getattr(result, field)

        return GenerateResponse(
            success=True,
            output=output,
            used_optimized=used_optimized,
            metadata={
                "signature_type": request.signature_type,
                "reasoning": getattr(result, 'rationale', None)
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Generation failed: {str(e)}"
        )


@app.get("/signatures/{signature_type}", response_model=SignatureInfo)
async def get_signature_info(signature_type: str):
    """Get information about a signature."""
    if signature_type not in MODULES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown signature type: {signature_type}"
        )

    module = MODULES[signature_type]()
    sig = module.generate.signature

    # Check if optimized version is cached
    is_optimized = False
    if redis_client:
        cache_key = f"dspy:optimized:{signature_type}"
        is_optimized = redis_client.exists(cache_key) > 0

    return SignatureInfo(
        signature_type=signature_type,
        description=sig.__doc__ or "",
        input_fields=list(sig.input_fields.keys()) if hasattr(sig, 'input_fields') else [],
        output_fields=list(sig.output_fields.keys()) if hasattr(sig, 'output_fields') else [],
        is_optimized=is_optimized
    )


@app.get("/signatures")
async def list_signatures():
    """List all available signatures."""
    signatures = []
    for sig_type in MODULES:
        module = MODULES[sig_type]()
        sig = module.generate.signature

        is_optimized = False
        if redis_client:
            cache_key = f"dspy:optimized:{sig_type}"
            is_optimized = redis_client.exists(cache_key) > 0

        signatures.append({
            "signature_type": sig_type,
            "description": sig.__doc__ or "",
            "is_optimized": is_optimized
        })

    return {"signatures": signatures}


@app.delete("/signatures/{signature_type}/cache")
async def clear_signature_cache(signature_type: str):
    """Clear cached optimization for a signature."""
    if signature_type not in MODULES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown signature type: {signature_type}"
        )

    if not redis_client:
        return {"success": False, "message": "Redis not available"}

    cache_key = f"dspy:optimized:{signature_type}"
    deleted = redis_client.delete(cache_key)

    return {
        "success": True,
        "signature_type": signature_type,
        "was_cached": deleted > 0
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
