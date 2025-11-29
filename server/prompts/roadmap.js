/**
 * Roadmap/Gantt Chart Generation Prompt
 * Extracted from server/prompts.js for modular architecture
 *
 * This module handles the generation of Gantt chart data from research files
 */

import { truncateResearchFiles, TRUNCATION_LIMITS } from '../utils.js';

/**
 * Gantt Chart JSON Schema
 */
export const roadmapSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    timeColumns: {
      type: "array",
      items: { type: "string" }
    },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          isSwimlane: { type: "boolean" },
          entity: { type: "string" },
          bar: {
            type: "object",
            properties: {
              startCol: { type: "integer" },
              endCol: { type: "integer" },
              color: { type: "string" }
            },
            required: ["startCol", "endCol", "color"]
          },
          taskType: {
            type: "string",
            enum: ["milestone", "decision", "task"],
            description: "Task classification for Executive View filtering"
          }
        },
        required: ["title", "isSwimlane", "entity", "taskType"]
      }
    },
    legend: {
      type: "array",
      items: {
        type: "object",
        properties: {
          color: { type: "string" },
          label: { type: "string" }
        },
        required: ["color", "label"]
      }
    },
    researchAnalysis: {
      type: "object",
      description: "Analysis of research quality for Gantt chart creation",
      properties: {
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Name of the topic/theme identified" },
              fitnessScore: { type: "number", description: "Score from 1-10 rating research fitness for Gantt chart" },
              taskCount: { type: "number", description: "Number of tasks identified for this topic" },
              includedinChart: { type: "boolean", description: "Whether this topic was included as a swimlane" },
              issues: {
                type: "array",
                items: { type: "string" },
                description: "List of specific issues with the research for this topic"
              },
              recommendation: { type: "string", description: "Suggestion for improving research quality" }
            },
            required: ["name", "fitnessScore", "taskCount", "includedinChart", "issues", "recommendation"]
          }
        },
        overallScore: { type: "number", description: "Overall research fitness score (1-10)" },
        summary: { type: "string", description: "Brief summary of research quality and recommendations" }
      },
      required: ["topics", "overallScore", "summary"]
    }
  },
  required: ["title", "timeColumns", "data", "legend", "researchAnalysis"]
};

/**
 * Gantt Chart Generation System Prompt
 * Optimized for reduced token usage while maintaining output quality
 */
export const roadmapPrompt = `You are a project management analyst creating Gantt chart JSON. Output ONLY valid JSON matching the schema.

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

**MANDATORY INTERVAL CHECK:**
- Calculate: end_year - start_year + 1 = total_years
- If total_years > 3: MUST use "Years" (NON-NEGOTIABLE)
- WRONG: Quarters for 5-year range (too granular)
- RIGHT: Years for 5-year range ["2026","2027","2028","2029","2030"]

### 3. SWIMLANES (MUST CREATE MULTIPLE)
**CRITICAL: You MUST create MULTIPLE swimlanes. A chart with only 1 swimlane is INVALID.**
Priority order:
1. Named entities (companies, organizations) - create SEPARATE swimlane for EACH entity
2. Departments: "IT/Technology", "Legal", "Business/Operations", "Finance", "Executive" - use at least 2-3 categories

Sorting: Broad/industry-wide swimlanes first, then specific ones alphabetically.
Threshold: Swimlanes need ≥3 tasks. Redistribute orphan tasks to nearest swimlane.
VALIDATION: Must have AT LEAST 2 swimlanes. Re-analyze if only 1.

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
 * Generate the complete roadmap prompt with user context
 * Applies truncation to reduce token usage and improve latency
 * @param {string} userPrompt - The user's analysis request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @returns {string} Complete prompt for AI
 */
export function generateRoadmapPrompt(userPrompt, researchFiles) {
  // Apply truncation - roadmap needs substantial context for date extraction
  const truncatedFiles = truncateResearchFiles(researchFiles, TRUNCATION_LIMITS.roadmap);

  const researchContent = truncatedFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `${roadmapPrompt}

**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Respond with ONLY the JSON object.`;
}
