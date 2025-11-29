# Implementation Plan: Sample Set Diversity

## Problem Statement

The current training system uses only 3 sample sets per content type. This limited diversity means:
1. The model may overfit to specific input patterns
2. Edge cases are never tested
3. Domain coverage is incomplete
4. Training signal is biased toward specific use cases

## Current State

```javascript
const SAMPLE_SETS = {
  Roadmap: [
    { name: "AI Implementation Roadmap", ... },
    { name: "Cloud Migration Strategy", ... },
    { name: "Digital Transformation Plan", ... }
  ],
  // Only 3 samples per type
};
```

## Goal

Create a comprehensive sample generation and management system that:
1. Expands sample coverage to 20+ diverse samples per content type
2. Includes edge cases and challenging inputs
3. Supports dynamic sample generation
4. Enables domain-specific sample weighting

---

## Phase 1: Sample Taxonomy Design

### Objective
Define the dimensions of diversity that samples should cover.

### Implementation

```javascript
const SAMPLE_DIMENSIONS = {
  Roadmap: {
    // Domain dimensions
    industry: ['technology', 'healthcare', 'finance', 'retail', 'manufacturing', 'education'],
    scope: ['strategic', 'tactical', 'operational'],
    timeframe: ['short-term (< 1 year)', 'medium-term (1-3 years)', 'long-term (3-5+ years)'],

    // Complexity dimensions
    swimlaneCount: ['few (2-3)', 'moderate (4-5)', 'many (6+)'],
    taskDensity: ['sparse', 'moderate', 'dense'],
    dependencies: ['none', 'some', 'complex'],

    // Edge cases
    edgeCases: [
      'single swimlane',
      'very long timeframe (10+ years)',
      'past dates (historical roadmap)',
      'overlapping milestones',
      'seasonal/cyclical patterns'
    ]
  },

  Slides: {
    // Domain dimensions
    purpose: ['quarterly review', 'strategy presentation', 'investor pitch', 'training', 'project update'],
    audience: ['executive', 'technical', 'general', 'board'],
    industry: ['technology', 'healthcare', 'finance', 'retail', 'consulting'],

    // Complexity dimensions
    slideCount: ['brief (4-6)', 'standard (8-12)', 'comprehensive (15+)'],
    dataIntensity: ['narrative', 'balanced', 'data-heavy'],

    // Edge cases
    edgeCases: [
      'single key message',
      'heavily quantitative',
      'comparison/competitive analysis',
      'crisis communication',
      'vision/aspirational'
    ]
  },

  Document: {
    // Domain dimensions
    docType: ['strategic analysis', 'market research', 'white paper', 'policy brief', 'business case'],
    industry: ['technology', 'healthcare', 'finance', 'energy', 'government'],
    audience: ['executive', 'technical', 'policy makers', 'investors'],

    // Complexity dimensions
    depth: ['overview', 'detailed', 'comprehensive'],
    citations: ['minimal', 'moderate', 'heavily cited'],

    // Edge cases
    edgeCases: [
      'controversial topic',
      'highly technical subject',
      'emerging/uncertain topic',
      'multi-stakeholder perspective',
      'global/regional comparison'
    ]
  },

  ResearchAnalysis: {
    // Domain dimensions
    researchType: ['market analysis', 'competitive intelligence', 'trend analysis', 'due diligence', 'landscape review'],
    industry: ['technology', 'healthcare', 'finance', 'consumer', 'industrial'],

    // Complexity dimensions
    breadth: ['focused', 'broad', 'comprehensive'],
    recency: ['historical', 'current', 'forward-looking'],

    // Edge cases
    edgeCases: [
      'limited public data available',
      'rapidly changing market',
      'niche/emerging sector',
      'cross-industry analysis',
      'conflicting data sources'
    ]
  }
};
```

---

## Phase 2: Sample Template Library

### Objective
Create parameterized sample templates that can generate diverse inputs.

### Implementation

```javascript
const SAMPLE_TEMPLATES = {
  Roadmap: [
    // Template 1: Industry-specific digital transformation
    {
      id: 'digital-transform',
      template: (params) => ({
        name: `${params.industry} Digital Transformation Roadmap`,
        description: `Strategic plan for ${params.industry} sector digital modernization`,
        timeframe: params.timeframe,
        context: `${params.industry} company facing ${params.challenge}`,
        expectedComplexity: params.complexity
      }),
      params: {
        industry: ['Healthcare', 'Retail', 'Manufacturing', 'Financial Services'],
        timeframe: ['2024-2026', '2025-2028', '2024-2029'],
        challenge: ['legacy system modernization', 'customer experience gaps', 'operational inefficiency'],
        complexity: ['moderate', 'high']
      }
    },

    // Template 2: Product/Platform roadmap
    {
      id: 'product-roadmap',
      template: (params) => ({
        name: `${params.product} Platform Roadmap`,
        description: `Development roadmap for ${params.product} platform evolution`,
        timeframe: params.timeframe,
        context: `Building ${params.productType} with ${params.teamSize} team`,
        expectedComplexity: 'high'
      }),
      params: {
        product: ['AI/ML Platform', 'Data Analytics Suite', 'Customer Portal', 'Mobile Application'],
        productType: ['B2B SaaS', 'B2C application', 'internal tool', 'API platform'],
        timeframe: ['Q1-Q4 2024', '2024-2025', '2025-2027'],
        teamSize: ['small (5-10)', 'medium (15-30)', 'large (50+)']
      }
    },

    // Template 3: Operational excellence
    {
      id: 'ops-excellence',
      template: (params) => ({
        name: `${params.function} Operational Excellence Roadmap`,
        description: `Improving ${params.function} efficiency and quality`,
        timeframe: '12-18 months',
        context: `${params.orgSize} organization with ${params.maturity} maturity`,
        expectedComplexity: 'moderate'
      }),
      params: {
        function: ['Supply Chain', 'Customer Service', 'IT Operations', 'Finance', 'HR'],
        orgSize: ['startup', 'mid-market', 'enterprise'],
        maturity: ['early stage', 'developing', 'mature']
      }
    }
  ],

  // Similar templates for Slides, Document, ResearchAnalysis...
};

function generateSampleFromTemplate(template, paramValues) {
  return template.template(paramValues);
}

function generateAllCombinations(template) {
  const { params } = template;
  const keys = Object.keys(params);
  const combinations = [];

  function combine(index, current) {
    if (index === keys.length) {
      combinations.push({ ...current });
      return;
    }

    const key = keys[index];
    for (const value of params[key]) {
      current[key] = value;
      combine(index + 1, current);
    }
  }

  combine(0, {});
  return combinations.map(combo => generateSampleFromTemplate(template, combo));
}
```

---

## Phase 3: Edge Case Sample Generation

### Objective
Create samples specifically designed to test edge cases and failure modes.

### Implementation

```javascript
const EDGE_CASE_SAMPLES = {
  Roadmap: [
    // Edge case: Minimal input
    {
      id: 'edge-minimal',
      name: 'Roadmap',
      description: '',
      context: 'Create a roadmap',
      expectedBehavior: 'Should request more information or generate reasonable defaults',
      difficultyLevel: 'edge-low-input'
    },

    // Edge case: Extremely long timeframe
    {
      id: 'edge-long-term',
      name: '20-Year Technology Vision Roadmap',
      description: 'Long-term technology evolution from 2025 to 2045',
      context: 'Strategic planning for next two decades of technology investment',
      expectedBehavior: 'Should handle long timeframes with appropriate granularity',
      difficultyLevel: 'edge-timeframe'
    },

    // Edge case: Very constrained
    {
      id: 'edge-constrained',
      name: 'Q4 Sprint Roadmap',
      description: 'Micro-roadmap for single quarter',
      context: 'Need week-by-week breakdown for October-December',
      expectedBehavior: 'Should adjust granularity for short timeframe',
      difficultyLevel: 'edge-timeframe'
    },

    // Edge case: Conflicting requirements
    {
      id: 'edge-conflicting',
      name: 'Resource-Constrained Transformation',
      description: 'Major transformation with minimal budget',
      context: 'Complete digital transformation in 6 months with limited resources',
      expectedBehavior: 'Should acknowledge constraints and prioritize',
      difficultyLevel: 'edge-conflict'
    },

    // Edge case: Ambiguous domain
    {
      id: 'edge-ambiguous',
      name: 'Innovation Roadmap',
      description: 'General innovation planning',
      context: 'Make our company more innovative',
      expectedBehavior: 'Should provide structure despite vague input',
      difficultyLevel: 'edge-ambiguous'
    }
  ],

  // Similar edge cases for other content types...
};
```

---

## Phase 4: Sample Weighting System

### Objective
Weight samples based on training needs and performance data.

### Implementation

```javascript
class SampleWeightManager {
  constructor() {
    this.weights = {};  // sampleId -> weight
    this.performance = {};  // sampleId -> { successes, failures, avgScore }
    this.usageCounts = {};  // sampleId -> count
  }

  initializeWeights(samples) {
    for (const sample of samples) {
      this.weights[sample.id] = 1.0;  // Equal initial weight
      this.performance[sample.id] = { successes: 0, failures: 0, avgScore: null };
      this.usageCounts[sample.id] = 0;
    }
  }

  recordOutcome(sampleId, score, success) {
    const perf = this.performance[sampleId];
    if (!perf) return;

    if (success) {
      perf.successes++;
    } else {
      perf.failures++;
    }

    // Update rolling average
    const total = perf.successes + perf.failures;
    perf.avgScore = perf.avgScore === null
      ? score
      : (perf.avgScore * (total - 1) + score) / total;

    this.usageCounts[sampleId]++;

    // Adjust weight based on performance
    this.recalculateWeight(sampleId);
  }

  recalculateWeight(sampleId) {
    const perf = this.performance[sampleId];
    const usage = this.usageCounts[sampleId];

    // Base weight on inverse of success rate (prioritize challenging samples)
    const successRate = perf.successes / (perf.successes + perf.failures || 1);

    // Weight components:
    // 1. Novelty bonus (less used = higher weight)
    const noveltyBonus = Math.max(0, 1 - usage / 100);

    // 2. Challenge value (lower success = higher training value)
    const challengeValue = 1 - successRate;

    // 3. Floor to ensure all samples get some usage
    const floorWeight = 0.2;

    this.weights[sampleId] = floorWeight + (noveltyBonus * 0.3) + (challengeValue * 0.5);
  }

  selectWeightedSample(samples) {
    // Build cumulative weight array
    let totalWeight = 0;
    const cumulative = [];

    for (const sample of samples) {
      const weight = this.weights[sample.id] || 1.0;
      totalWeight += weight;
      cumulative.push({ sample, cumWeight: totalWeight });
    }

    // Random selection based on weights
    const random = Math.random() * totalWeight;
    for (const { sample, cumWeight } of cumulative) {
      if (random <= cumWeight) {
        return sample;
      }
    }

    return samples[0];  // Fallback
  }

  getWeightDistribution() {
    return Object.entries(this.weights)
      .sort((a, b) => b[1] - a[1])
      .map(([id, weight]) => ({
        id,
        weight: weight.toFixed(3),
        usage: this.usageCounts[id],
        avgScore: this.performance[id]?.avgScore?.toFixed(2) || 'N/A'
      }));
  }
}
```

---

## Phase 5: Dynamic Sample Generation with LLM

### Objective
Use LLM to generate novel samples based on gaps in coverage.

### Implementation

```javascript
async function generateNovelSample(contentType, existingSamples, gaps) {
  const prompt = `Generate a novel sample input for ${contentType} content generation.

Current sample coverage gaps:
${gaps.map(g => `- ${g}`).join('\n')}

Existing samples (avoid similarity):
${existingSamples.slice(0, 5).map(s => `- ${s.name}`).join('\n')}

Generate a JSON sample with:
{
  "id": "unique-id",
  "name": "Sample name",
  "description": "What this sample is about",
  "context": "Background information for generation",
  "industry": "Industry sector",
  "complexity": "low|moderate|high",
  "uniqueAspects": ["What makes this sample different"]
}

Focus on filling the coverage gaps identified above.`;

  const response = await generateWithLLM(prompt);
  const sample = JSON.parse(response);

  // Validate sample
  if (!sample.id || !sample.name || !sample.description) {
    throw new Error('Invalid sample generated');
  }

  return sample;
}

async function identifyCoverageGaps(contentType, existingSamples, dimensions) {
  const gaps = [];

  // Check dimension coverage
  for (const [dimName, dimValues] of Object.entries(dimensions)) {
    const covered = new Set(existingSamples.map(s => s[dimName]).filter(Boolean));
    const missing = dimValues.filter(v => !covered.has(v));

    if (missing.length > 0) {
      gaps.push(`${dimName}: missing ${missing.join(', ')}`);
    }
  }

  // Check edge case coverage
  const edgeCases = EDGE_CASE_SAMPLES[contentType] || [];
  const existingEdgeTypes = new Set(existingSamples.map(s => s.difficultyLevel).filter(Boolean));
  const missingEdges = edgeCases
    .filter(e => !existingEdgeTypes.has(e.difficultyLevel))
    .map(e => e.difficultyLevel);

  if (missingEdges.length > 0) {
    gaps.push(`Edge cases: missing ${missingEdges.join(', ')}`);
  }

  return gaps;
}
```

---

## Phase 6: Sample Library Management

### Objective
Organize, persist, and manage the expanded sample library.

### Implementation

```javascript
class SampleLibrary {
  constructor() {
    this.samples = {};  // contentType -> samples[]
    this.metadata = {};  // sample stats and coverage
    this.weightManager = new SampleWeightManager();
  }

  async initialize() {
    // Load base samples
    for (const contentType of ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis']) {
      this.samples[contentType] = [
        ...this.loadBaseSamples(contentType),
        ...this.generateTemplatedSamples(contentType),
        ...(EDGE_CASE_SAMPLES[contentType] || [])
      ];

      this.weightManager.initializeWeights(this.samples[contentType]);
    }

    // Load persisted weights if available
    await this.loadPersistedState();

    console.log('Sample library initialized:');
    for (const [type, samples] of Object.entries(this.samples)) {
      console.log(`  ${type}: ${samples.length} samples`);
    }
  }

  loadBaseSamples(contentType) {
    // Original hardcoded samples
    return SAMPLE_SETS[contentType] || [];
  }

  generateTemplatedSamples(contentType) {
    const templates = SAMPLE_TEMPLATES[contentType] || [];
    const samples = [];

    for (const template of templates) {
      // Generate subset of combinations (not all)
      const allCombos = generateAllCombinations(template);
      const selectedCombos = this.selectDiverseSubset(allCombos, 5);
      samples.push(...selectedCombos);
    }

    return samples;
  }

  selectDiverseSubset(samples, count) {
    // Simple diversity selection - spread across parameter space
    if (samples.length <= count) return samples;

    const step = Math.floor(samples.length / count);
    return samples.filter((_, i) => i % step === 0).slice(0, count);
  }

  getSample(contentType) {
    const samples = this.samples[contentType];
    if (!samples || samples.length === 0) return null;

    return this.weightManager.selectWeightedSample(samples);
  }

  recordOutcome(contentType, sampleId, score, success) {
    this.weightManager.recordOutcome(sampleId, score, success);
  }

  async expandLibrary(contentType, targetCount) {
    const current = this.samples[contentType];
    if (current.length >= targetCount) return;

    const dimensions = SAMPLE_DIMENSIONS[contentType];
    const gaps = await identifyCoverageGaps(contentType, current, dimensions);

    while (current.length < targetCount && gaps.length > 0) {
      try {
        const newSample = await generateNovelSample(contentType, current, gaps);
        current.push(newSample);
        this.weightManager.initializeWeights([newSample]);
        gaps.shift();  // Remove addressed gap
      } catch (error) {
        console.error('Failed to generate novel sample:', error);
        break;
      }
    }
  }

  async persist() {
    const state = {
      timestamp: Date.now(),
      samples: this.samples,
      weights: this.weightManager.weights,
      performance: this.weightManager.performance,
      usageCounts: this.weightManager.usageCounts
    };

    await fs.writeFile('./data/sample-library.json', JSON.stringify(state, null, 2));
  }

  async loadPersistedState() {
    try {
      const data = await fs.readFile('./data/sample-library.json', 'utf-8');
      const state = JSON.parse(data);
      this.weightManager.weights = state.weights || {};
      this.weightManager.performance = state.performance || {};
      this.weightManager.usageCounts = state.usageCounts || {};
    } catch {
      // No persisted state, use defaults
    }
  }

  getCoverageReport() {
    const report = {};

    for (const contentType of Object.keys(this.samples)) {
      const samples = this.samples[contentType];
      const dimensions = SAMPLE_DIMENSIONS[contentType];

      report[contentType] = {
        totalSamples: samples.length,
        dimensionCoverage: {},
        edgeCaseCoverage: 0,
        weightDistribution: this.weightManager.getWeightDistribution()
          .filter(w => samples.some(s => s.id === w.id))
      };

      // Calculate dimension coverage
      for (const [dim, values] of Object.entries(dimensions)) {
        if (dim === 'edgeCases') continue;
        const covered = new Set(samples.map(s => s[dim]).filter(Boolean));
        report[contentType].dimensionCoverage[dim] = {
          covered: covered.size,
          total: values.length,
          percentage: ((covered.size / values.length) * 100).toFixed(1) + '%'
        };
      }
    }

    return report;
  }
}

// Singleton
export const sampleLibrary = new SampleLibrary();
```

---

## Success Criteria

1. **Sample Count**: Minimum 20 samples per content type
2. **Dimension Coverage**: > 80% coverage of each dimension
3. **Edge Case Coverage**: All defined edge cases included
4. **Weight Distribution**: No sample > 3x average weight (prevents overuse)
5. **Training Improvement**: Score variance decreases as coverage increases

---

## Files to Create/Modify

- `/server/utils/sampleLibrary.js` - New sample management system
- `/server/utils/sampleTemplates.js` - Template definitions
- `/server/utils/edgeCaseSamples.js` - Edge case definitions
- `/server/routes/training.js` - Integration with training loop
- `/data/sample-library.json` - Persisted sample state

---

## Estimated Complexity

- Phase 1: Low (taxonomy definition)
- Phase 2: Medium (template system)
- Phase 3: Low (edge case definition)
- Phase 4: Medium (weighting algorithm)
- Phase 5: High (LLM integration)
- Phase 6: Medium (library management)
