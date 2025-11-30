# Gap 15: Enhanced DSPy Signatures

## Problem Statement

Current DSPy signatures are **minimal and generic**, not matching the actual output structures expected by the generators:

**Current Roadmap Signature:**
```python
class RoadmapSignature(dspy.Signature):
    user_prompt = dspy.InputField()
    research_content = dspy.InputField()
    title = dspy.OutputField()
    time_columns = dspy.OutputField()
    rows = dspy.OutputField()
```

**Actual Generator Output:**
```javascript
{
  title: "Digital Transformation Roadmap",
  swimlanes: [
    { id: "tech", name: "Technology", color: "#3498db" },
    { id: "process", name: "Process", color: "#2ecc71" }
  ],
  timeRange: { start: "2025-01", end: "2030-12" },
  milestones: [
    { id: "m1", title: "Phase 1 Complete", date: "2025-06", swimlane: "tech" }
  ],
  items: [
    {
      id: "item1",
      title: "Cloud Migration",
      swimlane: "tech",
      startDate: "2025-01",
      endDate: "2025-06",
      progress: 0,
      dependencies: []
    }
  ]
}
```

**Problem:** The signature doesn't capture swimlanes, milestones, item structure, or date formats. This limits DSPy's ability to optimize prompt instructions for these specific output requirements.

## Goal

Create **comprehensive DSPy signatures** that match the exact output schemas of each content type, enabling more effective prompt optimization.

---

## Phase 1: Output Schema Analysis

### Objective
Document the exact output schemas for all content types.

### Tasks

#### 1.1 Roadmap Schema Documentation
```python
# dspy-service/schemas/roadmap.py

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date

class Swimlane(BaseModel):
    id: str = Field(description="Unique identifier for the swimlane")
    name: str = Field(description="Display name (e.g., 'Technology', 'Process')")
    color: str = Field(description="Hex color code for visualization")

class Milestone(BaseModel):
    id: str = Field(description="Unique identifier")
    title: str = Field(description="Milestone title")
    date: str = Field(description="Target date in YYYY-MM format")
    swimlane: str = Field(description="Which swimlane this milestone belongs to")
    description: Optional[str] = Field(description="Additional details")

class RoadmapItem(BaseModel):
    id: str = Field(description="Unique identifier")
    title: str = Field(description="Item title")
    description: Optional[str] = Field(description="Detailed description")
    swimlane: str = Field(description="Which swimlane this item belongs to")
    startDate: str = Field(description="Start date in YYYY-MM format")
    endDate: str = Field(description="End date in YYYY-MM format")
    progress: int = Field(description="Completion percentage 0-100", ge=0, le=100)
    dependencies: List[str] = Field(description="IDs of items this depends on")
    priority: Optional[str] = Field(description="high, medium, or low")

class TimeRange(BaseModel):
    start: str = Field(description="Start date in YYYY-MM format")
    end: str = Field(description="End date in YYYY-MM format")

class RoadmapOutput(BaseModel):
    title: str = Field(description="Roadmap title")
    description: Optional[str] = Field(description="Overall roadmap description")
    swimlanes: List[Swimlane] = Field(description="Categories for organizing items")
    timeRange: TimeRange = Field(description="Overall time range")
    milestones: List[Milestone] = Field(description="Key milestones to track")
    items: List[RoadmapItem] = Field(description="Individual roadmap items")
```

#### 1.2 Slides Schema Documentation
```python
# dspy-service/schemas/slides.py

class SlideContent(BaseModel):
    type: str = Field(description="Content type: text, bullet, image, chart")
    content: str = Field(description="The actual content")
    style: Optional[str] = Field(description="Styling hints")

class Slide(BaseModel):
    id: str = Field(description="Unique slide identifier")
    title: str = Field(description="Slide title")
    layout: str = Field(description="Layout type: title, content, two-column, image")
    content: List[SlideContent] = Field(description="Slide content elements")
    notes: Optional[str] = Field(description="Speaker notes")

class SlidesOutput(BaseModel):
    title: str = Field(description="Presentation title")
    subtitle: Optional[str] = Field(description="Presentation subtitle")
    author: Optional[str] = Field(description="Author name")
    theme: str = Field(description="Visual theme: professional, modern, minimal")
    slides: List[Slide] = Field(description="Individual slides")
    estimatedDuration: Optional[int] = Field(description="Estimated duration in minutes")
```

#### 1.3 Document Schema Documentation
```python
# dspy-service/schemas/document.py

class Section(BaseModel):
    id: str = Field(description="Section identifier")
    heading: str = Field(description="Section heading")
    level: int = Field(description="Heading level 1-6", ge=1, le=6)
    content: str = Field(description="Section content in markdown")
    subsections: Optional[List['Section']] = Field(description="Nested subsections")

class DocumentOutput(BaseModel):
    title: str = Field(description="Document title")
    abstract: Optional[str] = Field(description="Executive summary or abstract")
    keywords: List[str] = Field(description="Key terms for the document")
    sections: List[Section] = Field(description="Document sections")
    conclusions: Optional[str] = Field(description="Key conclusions")
    references: Optional[List[str]] = Field(description="Reference list")
```

#### 1.4 Research Analysis Schema Documentation
```python
# dspy-service/schemas/research.py

class Finding(BaseModel):
    id: str = Field(description="Finding identifier")
    title: str = Field(description="Finding title")
    description: str = Field(description="Detailed description")
    evidence: List[str] = Field(description="Supporting evidence")
    confidence: str = Field(description="high, medium, or low")
    implications: List[str] = Field(description="Business implications")

class Theme(BaseModel):
    name: str = Field(description="Theme name")
    description: str = Field(description="Theme description")
    relatedFindings: List[str] = Field(description="IDs of related findings")

class ResearchOutput(BaseModel):
    title: str = Field(description="Analysis title")
    executiveSummary: str = Field(description="Brief executive summary")
    methodology: str = Field(description="Analysis methodology used")
    themes: List[Theme] = Field(description="Major themes identified")
    findings: List[Finding] = Field(description="Individual findings")
    recommendations: List[str] = Field(description="Actionable recommendations")
    limitations: List[str] = Field(description="Analysis limitations")
    nextSteps: List[str] = Field(description="Suggested next steps")
```

### Deliverables
- [ ] `schemas/roadmap.py` with Pydantic models
- [ ] `schemas/slides.py` with Pydantic models
- [ ] `schemas/document.py` with Pydantic models
- [ ] `schemas/research.py` with Pydantic models
- [ ] JSON Schema exports for JavaScript validation

### Estimated Complexity: Medium

---

## Phase 2: Enhanced DSPy Signatures

### Objective
Create detailed DSPy signatures with structured output fields.

### Tasks

#### 2.1 Enhanced Roadmap Signature
```python
# dspy-service/signatures/roadmap.py

import dspy
from typing import List

class RoadmapSignature(dspy.Signature):
    """
    Generate a comprehensive project roadmap with swimlanes, milestones, and items.

    The roadmap should:
    - Organize work into logical swimlanes (e.g., Technology, Process, People)
    - Include key milestones with target dates
    - Break down work into specific items with dependencies
    - Use realistic date ranges based on the research content
    - Ensure items have clear start/end dates in YYYY-MM format
    """

    # Inputs
    user_prompt: str = dspy.InputField(
        desc="The user's request describing what kind of roadmap they need"
    )
    research_content: str = dspy.InputField(
        desc="Research material to base the roadmap on"
    )
    time_horizon: str = dspy.InputField(
        desc="Time range for the roadmap (e.g., '2025-2030')",
        default="2025-2030"
    )

    # Outputs - Structured for optimization
    title: str = dspy.OutputField(
        desc="A clear, descriptive title for the roadmap"
    )
    description: str = dspy.OutputField(
        desc="Brief description of the roadmap's purpose and scope"
    )
    swimlanes_json: str = dspy.OutputField(
        desc='JSON array of swimlanes: [{"id": "tech", "name": "Technology", "color": "#3498db"}]'
    )
    time_range_json: str = dspy.OutputField(
        desc='JSON object with start and end: {"start": "2025-01", "end": "2030-12"}'
    )
    milestones_json: str = dspy.OutputField(
        desc='JSON array of milestones with id, title, date, swimlane'
    )
    items_json: str = dspy.OutputField(
        desc='JSON array of roadmap items with id, title, swimlane, startDate, endDate, dependencies'
    )


class RoadmapModule(dspy.Module):
    """Roadmap generation module with structured parsing."""

    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(RoadmapSignature)

    def forward(self, user_prompt: str, research_content: str, time_horizon: str = "2025-2030"):
        result = self.generate(
            user_prompt=user_prompt,
            research_content=research_content,
            time_horizon=time_horizon
        )

        # Parse JSON outputs
        import json
        try:
            return {
                "title": result.title,
                "description": result.description,
                "swimlanes": json.loads(result.swimlanes_json),
                "timeRange": json.loads(result.time_range_json),
                "milestones": json.loads(result.milestones_json),
                "items": json.loads(result.items_json)
            }
        except json.JSONDecodeError as e:
            # Return raw outputs if parsing fails
            return {
                "title": result.title,
                "description": result.description,
                "_raw_swimlanes": result.swimlanes_json,
                "_raw_time_range": result.time_range_json,
                "_raw_milestones": result.milestones_json,
                "_raw_items": result.items_json,
                "_parse_error": str(e)
            }
```

#### 2.2 Enhanced Slides Signature
```python
# dspy-service/signatures/slides.py

import dspy

class SlidesSignature(dspy.Signature):
    """
    Generate a professional presentation with structured slides.

    The presentation should:
    - Start with a compelling title slide
    - Include an agenda/overview slide
    - Organize content into logical sections
    - Use appropriate layouts (title, bullet, two-column, etc.)
    - End with conclusions and next steps
    - Include speaker notes for each slide
    """

    # Inputs
    user_prompt: str = dspy.InputField(
        desc="Description of the presentation needed"
    )
    research_content: str = dspy.InputField(
        desc="Research material to base the presentation on"
    )
    target_audience: str = dspy.InputField(
        desc="Who will view this presentation (executives, technical team, etc.)",
        default="general business audience"
    )
    slide_count: int = dspy.InputField(
        desc="Target number of slides",
        default=10
    )

    # Outputs
    title: str = dspy.OutputField(
        desc="Presentation title"
    )
    subtitle: str = dspy.OutputField(
        desc="Presentation subtitle or tagline"
    )
    theme: str = dspy.OutputField(
        desc="Visual theme: 'professional', 'modern', 'minimal', or 'bold'"
    )
    slides_json: str = dspy.OutputField(
        desc='''JSON array of slides with structure:
        [{
            "id": "slide1",
            "title": "Slide Title",
            "layout": "title|content|two-column|image|quote",
            "content": [{"type": "text|bullet|image", "content": "..."}],
            "notes": "Speaker notes..."
        }]'''
    )
    estimated_duration: int = dspy.OutputField(
        desc="Estimated presentation duration in minutes"
    )
```

#### 2.3 Enhanced Document Signature
```python
# dspy-service/signatures/document.py

import dspy

class DocumentSignature(dspy.Signature):
    """
    Generate a well-structured business document.

    The document should:
    - Have a clear executive summary
    - Use hierarchical sections with proper heading levels
    - Include supporting evidence and data
    - Draw clear conclusions
    - Use professional business language
    """

    # Inputs
    user_prompt: str = dspy.InputField(
        desc="Description of the document needed"
    )
    research_content: str = dspy.InputField(
        desc="Research material to incorporate"
    )
    document_type: str = dspy.InputField(
        desc="Type: 'executive_summary', 'report', 'proposal', 'analysis'",
        default="executive_summary"
    )
    max_length: str = dspy.InputField(
        desc="Target length: 'brief', 'standard', 'comprehensive'",
        default="standard"
    )

    # Outputs
    title: str = dspy.OutputField(
        desc="Document title"
    )
    abstract: str = dspy.OutputField(
        desc="Executive summary (2-3 paragraphs)"
    )
    keywords: str = dspy.OutputField(
        desc="Comma-separated list of key terms"
    )
    sections_json: str = dspy.OutputField(
        desc='''JSON array of sections:
        [{
            "id": "s1",
            "heading": "Section Title",
            "level": 1,
            "content": "Markdown content...",
            "subsections": [...]
        }]'''
    )
    conclusions: str = dspy.OutputField(
        desc="Key conclusions and takeaways"
    )
    references_json: str = dspy.OutputField(
        desc="JSON array of reference strings"
    )
```

#### 2.4 Enhanced Research Signature
```python
# dspy-service/signatures/research.py

import dspy

class ResearchAnalysisSignature(dspy.Signature):
    """
    Analyze research content and extract structured insights.

    The analysis should:
    - Identify major themes across the research
    - Extract specific findings with evidence
    - Assess confidence levels for each finding
    - Provide actionable recommendations
    - Note limitations and next steps
    """

    # Inputs
    user_prompt: str = dspy.InputField(
        desc="Analysis focus or specific questions"
    )
    research_content: str = dspy.InputField(
        desc="Research material to analyze"
    )
    analysis_depth: str = dspy.InputField(
        desc="Depth: 'quick_scan', 'standard', 'deep_dive'",
        default="standard"
    )

    # Outputs
    title: str = dspy.OutputField(
        desc="Analysis title"
    )
    executive_summary: str = dspy.OutputField(
        desc="Brief executive summary (2-3 sentences)"
    )
    methodology: str = dspy.OutputField(
        desc="Brief description of analysis methodology"
    )
    themes_json: str = dspy.OutputField(
        desc='''JSON array of themes:
        [{
            "name": "Theme Name",
            "description": "Theme description",
            "relatedFindings": ["f1", "f2"]
        }]'''
    )
    findings_json: str = dspy.OutputField(
        desc='''JSON array of findings:
        [{
            "id": "f1",
            "title": "Finding Title",
            "description": "Detailed description",
            "evidence": ["Quote 1", "Quote 2"],
            "confidence": "high|medium|low",
            "implications": ["Implication 1"]
        }]'''
    )
    recommendations_json: str = dspy.OutputField(
        desc="JSON array of recommendation strings"
    )
    limitations_json: str = dspy.OutputField(
        desc="JSON array of limitation strings"
    )
    next_steps_json: str = dspy.OutputField(
        desc="JSON array of next step strings"
    )
```

### Deliverables
- [ ] Enhanced `RoadmapSignature` with all output fields
- [ ] Enhanced `SlidesSignature` with structured content
- [ ] Enhanced `DocumentSignature` with sections
- [ ] Enhanced `ResearchAnalysisSignature` with findings
- [ ] Module wrappers with JSON parsing
- [ ] Unit tests for each signature

### Estimated Complexity: Medium-High

---

## Phase 3: Output Validation & Parsing

### Objective
Add robust validation and parsing for structured outputs.

### Tasks

#### 3.1 Create Output Parser Module
```python
# dspy-service/utils/output_parser.py

import json
import re
from typing import Any, Dict, Optional
from pydantic import ValidationError

class OutputParser:
    """Parse and validate DSPy module outputs."""

    @staticmethod
    def parse_json_field(raw: str, default: Any = None) -> Any:
        """
        Parse a JSON field that might be wrapped in markdown code blocks.
        """
        if not raw:
            return default

        # Remove markdown code blocks if present
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip())
        cleaned = re.sub(r'\s*```$', '', cleaned)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to extract JSON from mixed content
            json_match = re.search(r'[\[{].*[\]}]', raw, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            return default

    @staticmethod
    def validate_roadmap(output: Dict) -> Dict:
        """Validate and clean roadmap output."""
        from ..schemas.roadmap import RoadmapOutput

        try:
            validated = RoadmapOutput(**output)
            return validated.model_dump()
        except ValidationError as e:
            # Return partial output with errors
            return {
                **output,
                "_validation_errors": e.errors()
            }

    @staticmethod
    def repair_json(broken_json: str) -> Optional[str]:
        """
        Attempt to repair common JSON issues:
        - Missing quotes around keys
        - Trailing commas
        - Single quotes instead of double
        """
        # Replace single quotes with double
        fixed = broken_json.replace("'", '"')

        # Remove trailing commas
        fixed = re.sub(r',\s*}', '}', fixed)
        fixed = re.sub(r',\s*]', ']', fixed)

        try:
            json.loads(fixed)
            return fixed
        except:
            return None
```

#### 3.2 Integrate Validation into Modules
```python
# dspy-service/signatures/roadmap.py

class RoadmapModule(dspy.Module):
    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(RoadmapSignature)
        self.parser = OutputParser()

    def forward(self, user_prompt: str, research_content: str, time_horizon: str = "2025-2030"):
        result = self.generate(
            user_prompt=user_prompt,
            research_content=research_content,
            time_horizon=time_horizon
        )

        # Parse each JSON field
        output = {
            "title": result.title,
            "description": result.description,
            "swimlanes": self.parser.parse_json_field(result.swimlanes_json, []),
            "timeRange": self.parser.parse_json_field(result.time_range_json, {}),
            "milestones": self.parser.parse_json_field(result.milestones_json, []),
            "items": self.parser.parse_json_field(result.items_json, [])
        }

        # Validate against schema
        return self.parser.validate_roadmap(output)
```

#### 3.3 Add Fallback Parsing Strategies
```python
# dspy-service/utils/fallback_parser.py

class FallbackParser:
    """
    Multiple parsing strategies when primary parsing fails.
    """

    @staticmethod
    def extract_from_markdown(content: str) -> Dict:
        """Extract structured data from markdown-formatted output."""
        sections = {}
        current_section = None
        current_content = []

        for line in content.split('\n'):
            if line.startswith('## '):
                if current_section:
                    sections[current_section] = '\n'.join(current_content)
                current_section = line[3:].strip().lower().replace(' ', '_')
                current_content = []
            else:
                current_content.append(line)

        if current_section:
            sections[current_section] = '\n'.join(current_content)

        return sections

    @staticmethod
    def extract_bullets_as_list(content: str) -> List[str]:
        """Extract bullet points as a list."""
        bullets = []
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('- ') or line.startswith('* '):
                bullets.append(line[2:])
            elif re.match(r'^\d+\.\s', line):
                bullets.append(re.sub(r'^\d+\.\s', '', line))
        return bullets
```

### Deliverables
- [ ] `OutputParser` class with JSON parsing
- [ ] `FallbackParser` for non-JSON outputs
- [ ] Pydantic validation integration
- [ ] Repair strategies for broken JSON
- [ ] Comprehensive parsing tests

### Estimated Complexity: Medium

---

## Phase 4: Node.js Integration

### Objective
Update Node.js generators to use enhanced DSPy signatures.

### Tasks

#### 4.1 Update DSPy Client
```javascript
// server/clients/dspy-service.js

class DSPyServiceClient {
  // ... existing methods ...

  /**
   * Generate with enhanced signature
   */
  async generateEnhanced(contentType, inputs, options = {}) {
    const signatureType = this._mapContentTypeToSignature(contentType);

    return this._request('/generate/enhanced', 'POST', {
      signature_type: signatureType,
      inputs: {
        user_prompt: inputs.prompt,
        research_content: inputs.researchContent,
        ...inputs.additionalInputs
      },
      options: {
        use_optimized: options.useOptimized ?? true,
        validate_output: options.validateOutput ?? true,
        repair_json: options.repairJson ?? true
      }
    });
  }

  /**
   * Get schema for a content type
   */
  async getSchema(contentType) {
    const signatureType = this._mapContentTypeToSignature(contentType);
    return this._request(`/schemas/${signatureType}`, 'GET');
  }

  _mapContentTypeToSignature(contentType) {
    const mapping = {
      'Roadmap': 'roadmap',
      'Slides': 'slides',
      'Document': 'document',
      'ResearchAnalysis': 'research-analysis'
    };
    return mapping[contentType] || contentType.toLowerCase();
  }
}
```

#### 4.2 Add Client-Side Validation
```javascript
// server/utils/outputValidation.js

import Ajv from 'ajv';

// JSON schemas exported from Python Pydantic models
import roadmapSchema from '../schemas/roadmap.json';
import slidesSchema from '../schemas/slides.json';
import documentSchema from '../schemas/document.json';
import researchSchema from '../schemas/research.json';

const ajv = new Ajv({ allErrors: true });

const validators = {
  roadmap: ajv.compile(roadmapSchema),
  slides: ajv.compile(slidesSchema),
  document: ajv.compile(documentSchema),
  'research-analysis': ajv.compile(researchSchema)
};

export function validateOutput(contentType, output) {
  const signatureType = contentType.toLowerCase().replace('researchanalysis', 'research-analysis');
  const validate = validators[signatureType];

  if (!validate) {
    return { valid: true, errors: [], warning: 'No validator for type' };
  }

  const valid = validate(output);

  return {
    valid,
    errors: validate.errors || [],
    errorMessages: (validate.errors || []).map(e =>
      `${e.instancePath} ${e.message}`
    )
  };
}
```

### Deliverables
- [ ] Updated `DSPyServiceClient` with enhanced methods
- [ ] JSON Schema exports from Python
- [ ] Client-side AJV validation
- [ ] Error message formatting
- [ ] Integration tests

### Estimated Complexity: Medium

---

## Phase 5: Documentation & Examples

### Objective
Document the new signatures and provide usage examples.

### Tasks

#### 5.1 Create Signature Documentation
```markdown
# DSPy Signature Reference

## Roadmap Signature

### Inputs
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_prompt | string | Yes | What kind of roadmap is needed |
| research_content | string | Yes | Research material to use |
| time_horizon | string | No | Time range (default: "2025-2030") |

### Outputs
| Field | Type | Description |
|-------|------|-------------|
| title | string | Roadmap title |
| description | string | Purpose and scope |
| swimlanes_json | JSON | Array of {id, name, color} |
| time_range_json | JSON | {start, end} in YYYY-MM |
| milestones_json | JSON | Array of milestone objects |
| items_json | JSON | Array of roadmap items |

### Example Output
```json
{
  "title": "Digital Transformation Roadmap",
  "description": "Three-year plan for enterprise digitalization",
  "swimlanes": [
    {"id": "tech", "name": "Technology", "color": "#3498db"},
    {"id": "people", "name": "People & Culture", "color": "#9b59b6"}
  ],
  "timeRange": {"start": "2025-01", "end": "2027-12"},
  "milestones": [
    {"id": "m1", "title": "Cloud Foundation", "date": "2025-06", "swimlane": "tech"}
  ],
  "items": [
    {
      "id": "i1",
      "title": "Cloud Infrastructure Setup",
      "swimlane": "tech",
      "startDate": "2025-01",
      "endDate": "2025-06",
      "progress": 0,
      "dependencies": []
    }
  ]
}
```
```

#### 5.2 Create Training Example Templates
```python
# dspy-service/examples/roadmap_examples.py

"""
High-quality training examples for roadmap generation.
Used by BootstrapFewShot optimizer.
"""

ROADMAP_EXAMPLES = [
    dspy.Example(
        user_prompt="Create a 5-year technology modernization roadmap",
        research_content="[Research about legacy systems, cloud migration, etc.]",
        title="Enterprise Technology Modernization Roadmap 2025-2030",
        description="Comprehensive plan for modernizing legacy infrastructure",
        swimlanes_json='''[
            {"id": "infra", "name": "Infrastructure", "color": "#3498db"},
            {"id": "apps", "name": "Applications", "color": "#2ecc71"},
            {"id": "data", "name": "Data & Analytics", "color": "#e74c3c"}
        ]''',
        time_range_json='{"start": "2025-01", "end": "2030-12"}',
        milestones_json='''[
            {"id": "m1", "title": "Cloud Foundation Complete", "date": "2026-06", "swimlane": "infra"},
            {"id": "m2", "title": "Legacy Sunset", "date": "2028-12", "swimlane": "apps"}
        ]''',
        items_json='''[
            {"id": "i1", "title": "Cloud Platform Selection", "swimlane": "infra", "startDate": "2025-01", "endDate": "2025-03", "progress": 0, "dependencies": []},
            {"id": "i2", "title": "Foundation Services", "swimlane": "infra", "startDate": "2025-04", "endDate": "2025-12", "progress": 0, "dependencies": ["i1"]}
        ]'''
    ).with_inputs("user_prompt", "research_content"),
    # ... more examples
]
```

### Deliverables
- [ ] Complete signature documentation
- [ ] API reference for all content types
- [ ] High-quality training examples
- [ ] Migration guide from old signatures
- [ ] Troubleshooting guide

### Estimated Complexity: Low-Medium

---

## Migration Plan

### Step 1: Deploy New Signatures (Non-Breaking)
- Add enhanced signatures alongside existing
- New endpoint: `/generate/enhanced`
- Existing `/generate` continues to work

### Step 2: Update Training to Use Enhanced
- Training workflow uses enhanced signatures
- Collect optimization data for new format
- Monitor output quality

### Step 3: Migrate Generators
- Update `generators.js` to use enhanced outputs
- Add client-side validation
- Update tests

### Step 4: Deprecate Old Signatures
- Mark old signatures as deprecated
- Migration warning in logs
- Documentation update

### Step 5: Remove Old Signatures
- Remove deprecated code
- Clean up unused schemas
- Final documentation update

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Schema match rate | ~60% | >95% |
| JSON parse failures | ~15% | <2% |
| Validation errors | Not tracked | <5% |
| Optimization effectiveness | Limited | Significantly improved |
