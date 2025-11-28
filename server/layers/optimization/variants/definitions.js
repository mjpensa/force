/**
 * Initial Variant Definitions - Phase 2
 *
 * Contains the default/champion prompt variants for each content type.
 * These serve as the baseline for A/B testing and optimization.
 *
 * @module variants/definitions
 */

import { VariantStatus } from './registry.js';

/**
 * Content type identifiers
 */
export const ContentType = {
  ROADMAP: 'Roadmap',
  SLIDES: 'Slides',
  DOCUMENT: 'Document',
  RESEARCH_ANALYSIS: 'ResearchAnalysis'
};

/**
 * Roadmap/Gantt Chart Variant Templates
 *
 * These are the prompt system instructions for generating Gantt charts.
 * The champion is the current production prompt.
 */
export const ROADMAP_VARIANTS = [
  {
    id: 'roadmap-champion-v1',
    name: 'Roadmap Champion V1',
    contentType: ContentType.ROADMAP,
    status: VariantStatus.CHAMPION,
    weight: 1.0,
    description: 'Production Gantt chart prompt optimized for deterministic output',
    version: '1.0.0',
    tags: ['production', 'deterministic', 'structured'],
    promptTemplate: `You are a project management analyst creating Gantt chart JSON. Output ONLY valid JSON matching the schema.

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

Topics excluded due to <3 tasks must appear with includedinChart=false.`
  },
  {
    id: 'roadmap-concise-v1',
    name: 'Roadmap Concise V1',
    contentType: ContentType.ROADMAP,
    status: VariantStatus.CANDIDATE,
    weight: 0.8,
    description: 'Shortened prompt testing if fewer tokens maintains quality',
    version: '1.0.0',
    tags: ['experimental', 'concise', 'token-optimized'],
    promptTemplate: `Create Gantt chart JSON. DETERMINISTIC: same inputs = same outputs.

RULES:
1. TIME: Scan all dates, include historical. Column 1 = earliest.
2. INTERVAL: ≤90d=Weeks, ≤365d=Months, ≤1095d=Quarters, >1095d=Years
3. SWIMLANES: Named entities > Departments. Min 3 tasks. Sort: broad first, then A-Z.
4. STRUCTURE: Swimlane row, then tasks sorted by startCol, then title.
5. BARS: startCol=1-based start, endCol=end+1. Unknown={startCol:null,endCol:null}
6. COLORS: priority-red, medium-red, mid-grey, light-grey, white, dark-blue. Theme-based if cross-swimlane themes exist, else by position.
7. TYPES: decision(Approval,Gate,Sign-off) > milestone(Launch,Deploy,Complete) > task
8. EXTRACT ALL: tasks, milestones, decisions, events, deadlines, phases. Include everything.
9. ANALYSIS: Per topic - fitnessScore(1-10), taskCount, issues[], recommendation. overallScore, summary.`
  }
];

/**
 * Slides Variant Templates
 */
export const SLIDES_VARIANTS = [
  {
    id: 'slides-champion-v1',
    name: 'Slides Champion V1',
    contentType: ContentType.SLIDES,
    status: VariantStatus.CHAMPION,
    weight: 1.0,
    description: 'Production slides prompt - minimal and fast',
    version: '1.0.0',
    tags: ['production', 'minimal', 'fast'],
    promptTemplate: `Create 6 slides as JSON.

Slide types:
- textTwoColumn: {type,title,section,paragraphs:["p1","p2"]}
- textThreeColumn: {type,title,section,columns:["c1","c2","c3"]}
- textWithCards: {type,title,section,content,cards:[{title,content},...]}

Return: {"title":"...","slides":[...]}`
  },
  {
    id: 'slides-structured-v1',
    name: 'Slides Structured V1',
    contentType: ContentType.SLIDES,
    status: VariantStatus.CANDIDATE,
    weight: 0.8,
    description: 'More structured slides prompt with content guidance',
    version: '1.0.0',
    tags: ['experimental', 'structured', 'guided'],
    promptTemplate: `Create a 6-slide executive presentation as JSON.

SLIDE STRUCTURE:
1. Title slide (textTwoColumn): Overview and key message
2. Problem/Context (textWithCards): 3 cards summarizing the situation
3. Key Findings (textThreeColumn): 3 main insights
4. Analysis (textTwoColumn): Detailed examination
5. Recommendations (textWithCards): 3-4 action items
6. Next Steps (textTwoColumn): Timeline and responsibilities

TYPES:
- textTwoColumn: {type, title, section, paragraphs:["left paragraph", "right paragraph"]}
- textThreeColumn: {type, title, section, columns:["col1", "col2", "col3"]}
- textWithCards: {type, title, section, content, cards:[{title, content},...]}

OUTPUT: {"title":"Presentation Title","slides":[...]}`
  }
];

/**
 * Document Variant Templates
 */
export const DOCUMENT_VARIANTS = [
  {
    id: 'document-champion-v1',
    name: 'Document Champion V1',
    contentType: ContentType.DOCUMENT,
    status: VariantStatus.CHAMPION,
    weight: 1.0,
    description: 'Production document prompt - concise executive summary',
    version: '1.0.0',
    tags: ['production', 'concise', 'executive'],
    promptTemplate: `You are an expert analyst. Write a clear executive summary.

RULES:
- Use ONLY facts from the provided research
- Be concise and direct
- 4-6 sections maximum
- 2-4 paragraphs per section

OUTPUT: JSON with title and sections array. Each section has heading and paragraphs array.`
  },
  {
    id: 'document-detailed-v1',
    name: 'Document Detailed V1',
    contentType: ContentType.DOCUMENT,
    status: VariantStatus.CANDIDATE,
    weight: 0.8,
    description: 'More detailed document with specific section guidance',
    version: '1.0.0',
    tags: ['experimental', 'detailed', 'structured'],
    promptTemplate: `Create a comprehensive executive summary document.

REQUIRED SECTIONS:
1. Executive Overview - High-level summary (2 paragraphs)
2. Key Findings - Main discoveries from research (2-3 paragraphs)
3. Analysis - Detailed examination of findings (3-4 paragraphs)
4. Implications - What this means for stakeholders (2 paragraphs)
5. Recommendations - Actionable next steps (2-3 paragraphs)
6. Conclusion - Summary and call to action (1-2 paragraphs)

RULES:
- Ground ALL content in provided research
- Be specific with data and examples
- Use professional, clear language
- Each paragraph should be 2-4 sentences

OUTPUT: {"title":"...", "sections":[{"heading":"...", "paragraphs":["...",...]}, ...]}`
  }
];

/**
 * Research Analysis Variant Templates
 */
export const RESEARCH_ANALYSIS_VARIANTS = [
  {
    id: 'research-champion-v1',
    name: 'Research Analysis Champion V1',
    contentType: ContentType.RESEARCH_ANALYSIS,
    status: VariantStatus.CHAMPION,
    weight: 1.0,
    description: 'Production research analysis prompt',
    version: '1.0.0',
    tags: ['production', 'comprehensive', 'gantt-focused'],
    promptTemplate: `You are a research analyst evaluating research quality for Gantt chart creation. Output ONLY valid JSON.

## SCORING (1-10)
- 9-10: Specific dates (day/month/year), clear milestones, deadlines
- 7-8: Month/year dates, some milestones, minor gaps
- 5-6: Approximate dates (quarters), limited detail
- 3-4: Narrative content, few specific dates
- 1-2: No dates/timelines, conceptual only

## THEME ANALYSIS
For each theme: count dates, identify gaps, provide specific recommendations.
Theme is "Gantt-ready" if: 3+ tasks AND 2+ have dates.

## DATE COUNTING
- specific: "March 15, 2024"
- quarterly/monthly/yearly: "Q2 2024", "June 2024", "2024"
- relative: "6 months after launch"
- vague: "soon", "later"

## READINESS VERDICT
- ready: 3+ themes Gantt-ready, score >= 6
- needs-improvement: 1-2 themes ready OR score 4-5.9
- insufficient: 0 themes ready OR score < 4

## REQUIREMENTS
- Analyze ALL themes, cite specific examples
- Recommendations must be actionable and specific
- Count dates accurately
- Be honest about insufficiencies`
  },
  {
    id: 'research-brief-v1',
    name: 'Research Analysis Brief V1',
    contentType: ContentType.RESEARCH_ANALYSIS,
    status: VariantStatus.CANDIDATE,
    weight: 0.8,
    description: 'Condensed research analysis prompt for faster generation',
    version: '1.0.0',
    tags: ['experimental', 'brief', 'fast'],
    promptTemplate: `Evaluate research quality for Gantt chart creation. JSON output only.

SCORING 1-10: 9-10=specific dates, 7-8=monthly, 5-6=quarterly, 3-4=narrative, 1-2=no dates

PER THEME: fitnessScore, datesCounted, gaps[], recommendations[]
Gantt-ready = 3+ tasks with 2+ dated

DATE TYPES: specific, quarterly, monthly, yearly, relative, vague

VERDICT: ready(3+ themes, score>=6), needs-improvement(1-2 themes OR score 4-5.9), insufficient(0 themes OR score<4)

Be accurate. Cite examples. Actionable recommendations.`
  }
];

/**
 * All variant definitions grouped by content type
 */
export const ALL_VARIANTS = {
  [ContentType.ROADMAP]: ROADMAP_VARIANTS,
  [ContentType.SLIDES]: SLIDES_VARIANTS,
  [ContentType.DOCUMENT]: DOCUMENT_VARIANTS,
  [ContentType.RESEARCH_ANALYSIS]: RESEARCH_ANALYSIS_VARIANTS
};

/**
 * Get all initial variants as a flat array
 *
 * @returns {Array} All variant definitions
 */
export function getAllVariants() {
  return [
    ...ROADMAP_VARIANTS,
    ...SLIDES_VARIANTS,
    ...DOCUMENT_VARIANTS,
    ...RESEARCH_ANALYSIS_VARIANTS
  ];
}

/**
 * Get variants for a specific content type
 *
 * @param {string} contentType - Content type
 * @returns {Array} Variants for that content type
 */
export function getVariantsForType(contentType) {
  return ALL_VARIANTS[contentType] || [];
}

/**
 * Get the champion variant for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Object|null} Champion variant or null
 */
export function getChampionForType(contentType) {
  const variants = ALL_VARIANTS[contentType] || [];
  return variants.find(v => v.status === VariantStatus.CHAMPION) || null;
}

export default {
  ContentType,
  ALL_VARIANTS,
  ROADMAP_VARIANTS,
  SLIDES_VARIANTS,
  DOCUMENT_VARIANTS,
  RESEARCH_ANALYSIS_VARIANTS,
  getAllVariants,
  getVariantsForType,
  getChampionForType
};
