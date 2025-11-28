/**
 * Roadmap Signature - PROMPT ML Layer 3
 *
 * DSPy-style signature for Gantt chart/roadmap generation.
 * Defines structured inputs, outputs, and task-specific instructions.
 *
 * Based on PROMPT ML design specification.
 */

import { createSignature, FieldType } from './base.js';

/**
 * Roadmap generation instructions
 * Extracted and structured from the original roadmap prompt
 */
const ROADMAP_INSTRUCTIONS = `You are a project management analyst creating Gantt chart JSON.
Output ONLY valid JSON matching the schema.

DETERMINISTIC OUTPUT REQUIRED - same inputs must produce identical outputs.

## RULES

### 1. TIME HORIZON
- Scan ALL dates (past/present/future) in research
- User-specified range: extend backward if research has earlier dates
- No range specified: earliest to latest date found
- INCLUDE historical/past events - they're essential context
- timeColumns starts from earliest date (column 1 = first period)

### 2. TIME INTERVAL (by duration)
- ≤90 days: Weeks ["W1 2026", "W2 2026"]
- 91-365 days: Months ["Jan 2026", "Feb 2026"]
- 366-1095 days: Quarters ["Q1 2026", "Q2 2026"]
- >1095 days: Years ["2020", "2021", "2022"]

### 3. SWIMLANES
Priority order:
1. Named entities (companies, organizations)
2. Departments: "IT/Technology", "Legal", "Business/Operations", "Finance", "Executive"

Sorting: Broad/industry-wide swimlanes first, then specific ones alphabetically.
Threshold: Include swimlanes with ≥3 tasks. Exclude both swimlane AND tasks if <3.

### 4. DATA STRUCTURE
- Swimlane row: {"title":"Name","isSwimlane":true,"entity":"Name"}
- Tasks follow their swimlane immediately
- Sort tasks by startCol (asc, nulls last), then title (A-Z)

### 5. BAR MAPPING
- startCol: 1-based index where task begins
- endCol: index where task ends + 1 (min duration = 1 column)
- Unknown dates: {"startCol":null,"endCol":null,"color":"..."}
- Early timeline events MUST have low startCol values

### 6. COLORS
Colors: "priority-red", "medium-red", "mid-grey", "light-grey", "white", "dark-blue"

IF cross-swimlane themes exist (2+ swimlanes, 2+ tasks/theme):
- Color by theme, populate legend with theme labels

ELSE (fallback):
- Color by swimlane position (alphabetical), legend=[]

### 7. TASK TYPES (case-insensitive keyword match)
- "decision": Approval, Decision, Gate, Go/No-Go, Sign-off, Review Board
- "milestone": Launch, Go Live, Complete, Deliver, Release, Deploy, Rollout, Cutover
- "task": default
- Priority: decision > milestone if both match

### 8. EXTRACTION (CRITICAL)
Extract ALL: tasks, milestones, decisions, events, deadlines, phases, historical events.
- Do NOT consolidate similar items
- Do NOT skip minor or past items
- Include everything with dates
- When in doubt, include it

### 9. RESEARCH ANALYSIS (REQUIRED)
For each topic (included or not), provide:
- fitnessScore (1-10): 9-10=excellent dates, 5-6=vague dates, 1-2=no dates
- taskCount, includedinChart, issues[], recommendation
- overallScore (weighted avg), summary (1-2 sentences)

Topics excluded due to <3 tasks must appear with includedinChart=false.`;

/**
 * Roadmap output schema (matching existing roadmapSchema)
 */
const ROADMAP_OUTPUT_PROPERTIES = {
  title: {
    type: 'string',
    description: 'Title for the Gantt chart'
  },
  timeColumns: {
    type: 'array',
    items: { type: 'string' },
    description: 'Time period labels for columns'
  },
  data: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        isSwimlane: { type: 'boolean' },
        entity: { type: 'string' },
        bar: {
          type: 'object',
          properties: {
            startCol: { type: 'number' },
            endCol: { type: 'number' },
            color: { type: 'string' }
          }
        },
        taskType: {
          type: 'string',
          enum: ['milestone', 'decision', 'task']
        }
      },
      required: ['title', 'isSwimlane', 'entity', 'taskType']
    },
    description: 'Swimlanes and tasks data'
  },
  legend: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        color: { type: 'string' },
        label: { type: 'string' }
      },
      required: ['color', 'label']
    },
    description: 'Color legend for themes'
  },
  researchAnalysis: {
    type: 'object',
    properties: {
      topics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            fitnessScore: { type: 'number' },
            taskCount: { type: 'number' },
            includedinChart: { type: 'boolean' },
            issues: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' }
          },
          required: ['name', 'fitnessScore', 'taskCount', 'includedinChart', 'issues', 'recommendation']
        }
      },
      overallScore: { type: 'number' },
      summary: { type: 'string' }
    },
    required: ['topics', 'overallScore', 'summary'],
    description: 'Research quality analysis'
  }
};

/**
 * Build the Roadmap Signature
 */
export const RoadmapSignature = createSignature('RoadmapGeneration')
  .describe('Generate a Gantt chart/roadmap from research documents, extracting timeline, tasks, and milestones.')
  .instruct(ROADMAP_INSTRUCTIONS)

  // Input fields
  .input('userPrompt', FieldType.STRING, {
    description: 'User instructions and preferences for roadmap generation',
    required: true,
    constraints: { minLength: 1 }
  })
  .input('researchFiles', FieldType.ARRAY, {
    description: 'Array of research files with filename and content',
    required: true,
    constraints: { minItems: 1 }
  })
  .input('timeRange', FieldType.STRING, {
    description: 'Optional time range specification (e.g., "2024-2026")',
    required: false
  })

  // Output fields
  .output('title', FieldType.STRING, {
    description: 'Title for the Gantt chart',
    required: true
  })
  .output('timeColumns', FieldType.ARRAY, {
    description: 'Time period labels for chart columns',
    required: true,
    itemSchema: { type: 'string' }
  })
  .output('data', FieldType.ARRAY, {
    description: 'Swimlanes and tasks for the Gantt chart',
    required: true,
    itemSchema: ROADMAP_OUTPUT_PROPERTIES.data.items
  })
  .output('legend', FieldType.ARRAY, {
    description: 'Color legend for cross-swimlane themes',
    required: true,
    itemSchema: ROADMAP_OUTPUT_PROPERTIES.legend.items
  })
  .output('researchAnalysis', FieldType.OBJECT, {
    description: 'Analysis of research quality and fitness',
    required: true,
    properties: ROADMAP_OUTPUT_PROPERTIES.researchAnalysis.properties
  })

  // Configuration
  .configure({
    outputFormat: 'json',
    deterministic: true,
    taskType: 'roadmap'
  })

  .build();

/**
 * Generate roadmap prompt using the signature
 *
 * @param {string} userPrompt - User's instructions
 * @param {Array} researchFiles - Research files [{filename, content}]
 * @param {Object} options - Additional options
 * @returns {string} Generated prompt
 */
export function generateRoadmapSignaturePrompt(userPrompt, researchFiles, options = {}) {
  return RoadmapSignature.generatePrompt({
    userPrompt,
    researchFiles,
    timeRange: options.timeRange
  }, {
    includeExamples: options.includeExamples !== false,
    maxExamples: options.maxExamples || 0 // No examples by default for roadmap
  });
}

/**
 * Validate roadmap inputs
 */
export function validateRoadmapInputs(userPrompt, researchFiles) {
  return RoadmapSignature.validateInputs({
    userPrompt,
    researchFiles
  });
}

/**
 * Get roadmap output schema
 */
export function getRoadmapOutputSchema() {
  return RoadmapSignature.getOutputSchema();
}

export default RoadmapSignature;
