# Implementation Plan: Prompt Evolution Mechanism

## Problem Statement

The current system tracks prompt performance but has no mechanism for prompts to actually evolve. Prompts are static strings that never change based on training outcomes. The A/B testing infrastructure exists, but there's no mutation/evolution engine to create improved prompt variants.

## Current State

```javascript
// Prompts are hardcoded and never change
const prompts = {
  Roadmap: {
    champion: "Create a strategic roadmap...",  // Static
    candidate: "Create a strategic roadmap...", // Identical to champion
    active: "Create a strategic roadmap..."     // Identical to champion
  }
};
```

## Goal

Create an automated prompt evolution system that:
1. Analyzes successful vs failed generations
2. Identifies patterns in high/low performing outputs
3. Generates mutated prompt variants
4. Tests mutations through the existing A/B framework

---

## Phase 1: Prompt Structure Analysis

### Objective
Parse prompts into modifiable components for targeted mutations.

### Implementation

```javascript
const PROMPT_COMPONENTS = {
  INSTRUCTION: 'instruction',      // Core task description
  FORMAT: 'format',                // Output structure requirements
  CONSTRAINTS: 'constraints',      // Limitations and rules
  EXAMPLES: 'examples',            // Few-shot examples
  TONE: 'tone',                    // Voice and style guidance
  CONTEXT: 'context'               // Background information
};

function parsePromptStructure(prompt) {
  const structure = {
    raw: prompt,
    components: {},
    sections: []
  };

  // Identify sections by common delimiters
  const sectionPatterns = [
    { pattern: /^#+\s*(.+)$/gm, type: 'header' },
    { pattern: /^[-*]\s+(.+)$/gm, type: 'bullet' },
    { pattern: /^\d+\.\s+(.+)$/gm, type: 'numbered' }
  ];

  // Classify each section
  const lines = prompt.split('\n');
  let currentSection = { type: 'instruction', content: [] };

  for (const line of lines) {
    // Detect section type changes
    if (line.match(/format|structure|output/i)) {
      structure.sections.push(currentSection);
      currentSection = { type: PROMPT_COMPONENTS.FORMAT, content: [] };
    } else if (line.match(/constraint|must not|avoid|don't/i)) {
      structure.sections.push(currentSection);
      currentSection = { type: PROMPT_COMPONENTS.CONSTRAINTS, content: [] };
    } else if (line.match(/example|sample|like this/i)) {
      structure.sections.push(currentSection);
      currentSection = { type: PROMPT_COMPONENTS.EXAMPLES, content: [] };
    }

    currentSection.content.push(line);
  }
  structure.sections.push(currentSection);

  return structure;
}
```

---

## Phase 2: Performance Pattern Extraction

### Objective
Analyze what differentiates high-performing outputs from low-performing ones.

### Implementation

```javascript
class PerformancePatternExtractor {
  constructor() {
    this.successPatterns = [];
    this.failurePatterns = [];
  }

  recordOutcome(prompt, output, score, contentType) {
    const analysis = {
      prompt,
      output,
      score,
      contentType,
      timestamp: Date.now(),
      features: this.extractFeatures(output, contentType)
    };

    if (score >= 4) {
      this.successPatterns.push(analysis);
    } else if (score <= 2) {
      this.failurePatterns.push(analysis);
    }

    // Keep last 100 of each
    if (this.successPatterns.length > 100) this.successPatterns.shift();
    if (this.failurePatterns.length > 100) this.failurePatterns.shift();
  }

  extractFeatures(output, contentType) {
    return {
      // Structural features
      wordCount: output.split(/\s+/).length,
      sentenceCount: output.split(/[.!?]+/).length,
      avgSentenceLength: 0,

      // Content features
      hasNumbers: /\d/.test(output),
      hasCitations: /\[.*?\]/.test(output),
      hasQuestions: /\?/.test(output),

      // Quality indicators
      specificityScore: this.measureSpecificity(output),
      structureScore: this.measureStructure(output, contentType)
    };
  }

  measureSpecificity(output) {
    const specificIndicators = [
      /\$[\d,]+/g,           // Dollar amounts
      /\d+%/g,               // Percentages
      /\d{4}/g,              // Years
      /\[.+?\]/g             // Citations
    ];

    let score = 0;
    for (const pattern of specificIndicators) {
      score += (output.match(pattern) || []).length;
    }
    return Math.min(score / 10, 1);  // Normalize to 0-1
  }

  findDifferentiatingPatterns() {
    const successFeatures = this.aggregateFeatures(this.successPatterns);
    const failureFeatures = this.aggregateFeatures(this.failurePatterns);

    const differentiators = {};
    for (const key of Object.keys(successFeatures)) {
      const diff = successFeatures[key] - failureFeatures[key];
      if (Math.abs(diff) > 0.1) {  // Significant difference
        differentiators[key] = {
          successAvg: successFeatures[key],
          failureAvg: failureFeatures[key],
          difference: diff
        };
      }
    }

    return differentiators;
  }
}
```

---

## Phase 3: Mutation Operators

### Objective
Define atomic operations that can modify prompts in targeted ways.

### Implementation

```javascript
const MUTATION_OPERATORS = {
  // Specificity mutations
  ADD_SPECIFICITY_REQUIREMENT: {
    name: 'Add specificity requirement',
    apply: (prompt) => {
      const additions = [
        'Include specific numbers, percentages, or dollar amounts where relevant.',
        'Cite sources for key claims using [Source Name] format.',
        'Use concrete examples rather than abstract descriptions.'
      ];
      return prompt + '\n\n' + additions[Math.floor(Math.random() * additions.length)];
    }
  },

  // Structure mutations
  ADD_STRUCTURE_CONSTRAINT: {
    name: 'Add structure constraint',
    apply: (prompt, contentType) => {
      const constraints = {
        Roadmap: 'Ensure each swimlane has at least 3 tasks spanning different time periods.',
        Slides: 'Each slide must have a clear title and 3-5 bullet points of substantive content.',
        Document: 'Each section must contain at least 2 paragraphs with supporting evidence.',
        ResearchAnalysis: 'Provide at least 4 distinct themes with specific evidence for each.'
      };
      return prompt + '\n\n' + (constraints[contentType] || '');
    }
  },

  // Quality mutations
  ADD_QUALITY_CHECKLIST: {
    name: 'Add quality checklist',
    apply: (prompt) => {
      return prompt + `

Before finalizing, verify:
- All claims have supporting evidence or citations
- No vague language (avoid "various", "significant", "important" without specifics)
- Content is actionable and specific, not generic`;
    }
  },

  // Anti-pattern mutations
  ADD_NEGATIVE_CONSTRAINT: {
    name: 'Add negative constraint',
    apply: (prompt, _, failurePatterns) => {
      // Learn from failures
      const antiPatterns = [
        'Do not use placeholder text or generic filler content.',
        'Avoid starting multiple sentences with the same word.',
        'Do not leave any section empty or with minimal content.'
      ];
      return prompt + '\n\n' + antiPatterns[Math.floor(Math.random() * antiPatterns.length)];
    }
  },

  // Emphasis mutations
  EMPHASIZE_REQUIREMENT: {
    name: 'Emphasize existing requirement',
    apply: (prompt, contentType, _, differentiators) => {
      // Find underperforming aspect and emphasize it
      if (differentiators?.hasNumbers?.difference > 0.2) {
        return prompt.replace(
          /(include|add|use)(\s+)(numbers?|statistics?|data)/gi,
          'ALWAYS $1$2specific $3'
        );
      }
      return prompt;
    }
  }
};

function applyMutation(prompt, mutationType, context) {
  const operator = MUTATION_OPERATORS[mutationType];
  if (!operator) return prompt;

  return operator.apply(
    prompt,
    context.contentType,
    context.failurePatterns,
    context.differentiators
  );
}
```

---

## Phase 4: Mutation Strategy Selection

### Objective
Intelligently choose which mutations to apply based on performance data.

### Implementation

```javascript
class MutationStrategySelector {
  constructor(patternExtractor) {
    this.patternExtractor = patternExtractor;
    this.mutationHistory = [];  // Track which mutations helped
  }

  selectMutations(contentType, currentPrompt) {
    const differentiators = this.patternExtractor.findDifferentiatingPatterns();
    const mutations = [];

    // Priority 1: Address largest performance gaps
    if (differentiators.specificityScore?.difference > 0.2) {
      mutations.push('ADD_SPECIFICITY_REQUIREMENT');
    }

    if (differentiators.structureScore?.difference > 0.2) {
      mutations.push('ADD_STRUCTURE_CONSTRAINT');
    }

    // Priority 2: Apply generally helpful mutations
    if (!currentPrompt.includes('verify') && !currentPrompt.includes('checklist')) {
      mutations.push('ADD_QUALITY_CHECKLIST');
    }

    // Priority 3: Add negative constraints based on failure patterns
    if (this.patternExtractor.failurePatterns.length > 10) {
      mutations.push('ADD_NEGATIVE_CONSTRAINT');
    }

    // Limit to 2 mutations per evolution cycle
    return mutations.slice(0, 2);
  }

  recordMutationOutcome(mutationType, beforeScore, afterScore) {
    this.mutationHistory.push({
      mutation: mutationType,
      improvement: afterScore - beforeScore,
      timestamp: Date.now()
    });
  }

  getMutationEffectiveness() {
    const effectiveness = {};
    for (const record of this.mutationHistory) {
      if (!effectiveness[record.mutation]) {
        effectiveness[record.mutation] = { total: 0, improvements: 0, avgImprovement: 0 };
      }
      effectiveness[record.mutation].total++;
      if (record.improvement > 0) {
        effectiveness[record.mutation].improvements++;
      }
      effectiveness[record.mutation].avgImprovement =
        (effectiveness[record.mutation].avgImprovement * (effectiveness[record.mutation].total - 1) + record.improvement)
        / effectiveness[record.mutation].total;
    }
    return effectiveness;
  }
}
```

---

## Phase 5: Prompt Evolution Engine

### Objective
Orchestrate the full evolution cycle.

### Implementation

```javascript
class PromptEvolutionEngine {
  constructor() {
    this.patternExtractor = new PerformancePatternExtractor();
    this.strategySelector = new MutationStrategySelector(this.patternExtractor);
    this.promptVersions = {};  // contentType -> { champion, candidate, active, history }
  }

  initialize(prompts) {
    for (const [contentType, prompt] of Object.entries(prompts)) {
      this.promptVersions[contentType] = {
        champion: prompt,
        candidate: prompt,
        active: prompt,
        history: [{ version: 1, prompt, score: null, timestamp: Date.now() }]
      };
    }
  }

  recordGeneration(contentType, prompt, output, score) {
    this.patternExtractor.recordOutcome(prompt, output, score, contentType);
  }

  evolvePrompt(contentType) {
    const current = this.promptVersions[contentType];
    const mutations = this.strategySelector.selectMutations(contentType, current.champion);

    if (mutations.length === 0) {
      console.log(`No mutations selected for ${contentType}`);
      return null;
    }

    // Apply mutations to create candidate
    let evolvedPrompt = current.champion;
    for (const mutation of mutations) {
      evolvedPrompt = applyMutation(evolvedPrompt, mutation, {
        contentType,
        failurePatterns: this.patternExtractor.failurePatterns,
        differentiators: this.patternExtractor.findDifferentiatingPatterns()
      });
    }

    // Store as new candidate
    current.candidate = evolvedPrompt;
    current.history.push({
      version: current.history.length + 1,
      prompt: evolvedPrompt,
      mutations,
      score: null,
      timestamp: Date.now()
    });

    console.log(`Evolved ${contentType} prompt with mutations:`, mutations);
    return evolvedPrompt;
  }

  promoteCandidateToChampion(contentType, candidateScore, championScore) {
    const current = this.promptVersions[contentType];

    // Require 5% improvement with statistical significance
    if (candidateScore > championScore * 1.05) {
      console.log(`Promoting ${contentType} candidate (${candidateScore}) over champion (${championScore})`);
      current.champion = current.candidate;
      current.candidate = current.champion;  // Reset candidate to new champion
      return true;
    }

    // Candidate failed - revert
    console.log(`${contentType} candidate (${candidateScore}) did not beat champion (${championScore})`);
    current.candidate = current.champion;
    return false;
  }

  getPrompt(contentType, variant) {
    return this.promptVersions[contentType]?.[variant] || null;
  }
}

// Singleton instance
export const promptEvolution = new PromptEvolutionEngine();
```

---

## Phase 6: Integration with Training Loop

### Objective
Connect evolution engine to the training cycle.

### Implementation

```javascript
// In training.js
import { promptEvolution } from './promptEvolution.js';

// Initialize with current prompts
promptEvolution.initialize(getSystemPrompts());

// After each generation
promptEvolution.recordGeneration(contentType, usedPrompt, output, score);

// After each training batch (e.g., every 50 iterations)
if (iteration % 50 === 0) {
  for (const contentType of contentTypes) {
    const stats = getVariantStats(contentType);

    // Check if candidate should be promoted
    if (stats.candidate.count >= 10 && stats.champion.count >= 35) {
      promptEvolution.promoteCandidateToChampion(
        contentType,
        stats.candidate.avgScore,
        stats.champion.avgScore
      );
    }

    // Evolve new candidate
    promptEvolution.evolvePrompt(contentType);
  }
}
```

---

## Phase 7: Prompt Versioning & Persistence

### Objective
Store prompt evolution history for analysis and rollback.

### Implementation

```javascript
// Save evolution state
function saveEvolutionState() {
  const state = {
    timestamp: Date.now(),
    versions: promptEvolution.promptVersions,
    mutationEffectiveness: promptEvolution.strategySelector.getMutationEffectiveness(),
    patternCounts: {
      success: promptEvolution.patternExtractor.successPatterns.length,
      failure: promptEvolution.patternExtractor.failurePatterns.length
    }
  };

  fs.writeFileSync(
    './data/prompt-evolution-state.json',
    JSON.stringify(state, null, 2)
  );
}

// Load previous state
function loadEvolutionState() {
  try {
    const state = JSON.parse(fs.readFileSync('./data/prompt-evolution-state.json'));
    promptEvolution.promptVersions = state.versions;
    return true;
  } catch {
    return false;
  }
}
```

---

## Success Criteria

1. **Mutation Application**: Each evolution cycle produces valid, parseable prompts
2. **Performance Tracking**: Mutation effectiveness scores accurately reflect improvements
3. **Promotion Logic**: Candidates only promoted when statistically better
4. **Evolution Velocity**: At least 1 successful promotion per 500 training iterations
5. **Quality Improvement**: Average quality score increases by 0.1+ over 1000 iterations

---

## Files to Create/Modify

- `/server/utils/promptEvolution.js` - New file with evolution engine
- `/server/utils/mutationOperators.js` - New file with mutation definitions
- `/server/routes/training.js` - Integration with training loop
- `/data/prompt-evolution-state.json` - Persistence file (auto-generated)

---

## Estimated Complexity

- Phase 1: Medium (parsing logic)
- Phase 2: Medium (pattern extraction)
- Phase 3: Low (mutation definitions)
- Phase 4: Medium (strategy logic)
- Phase 5: High (orchestration)
- Phase 6: Medium (integration)
- Phase 7: Low (file I/O)
