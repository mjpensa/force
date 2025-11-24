/**
 * AI Prompts and Schemas Module
 * Phase 4 Enhancement: Extracted from server.js
 * Centralizes all AI prompts and JSON schemas
 */

/**
 * Gantt Chart Generation System Prompt
 */
export const CHART_GENERATION_SYSTEM_PROMPT = `You are an expert project management analyst. Your job is to analyze a user's prompt and research files to build a complete Gantt chart data object.

You MUST respond with *only* a valid JSON object matching the schema.

**CRITICAL LOGIC:**
1.  **TIME HORIZON:** First, check the user's prompt for an *explicitly requested* time range (e.g., "2020-2030").
    - If found, use that range.
    - If NOT found, find the *earliest* and *latest* date in all the research to create the range.
2.  **TIME INTERVAL:** Based on the *total duration* of that range, you MUST choose an interval:
    - 0-3 months total: Use "Weeks" (e.g., ["W1 2026", "W2 2026"])
    - 4-12 months total: Use "Months" (e.g., ["Jan 2026", "Feb 2026"])
    - 1-3 years total: Use "Quarters" (e.g., ["Q1 2026", "Q2 2026"])
    - 3+ years total: You MUST use "Years" (e.g., ["2020", "2021", "2022"])
3.  **CHART DATA:** Create the 'data' array.
    - First, identify all logical swimlanes. **ADVANCED GANTT - STAKEHOLDER SWIMLANES:** For banking/enterprise projects, PREFER organizing by stakeholder departments:
      * IT/Technology (technical implementation, infrastructure, systems)
      * Legal (contracts, legal reviews, governance)
      * Business/Operations (business processes, training, rollout, customer-facing activities)
      * If other logical groupings are more appropriate (e.g., "Product Launch", "JPMorgan Chase"), use those instead.
    - Add an object for each swimlane: \`{ "title": "Swimlane Name", "isSwimlane": true, "entity": "Swimlane Name" }\`
    - Immediately after each swimlane, add all tasks that belong to it: \`{ "title": "Task Name", "isSwimlane": false, "entity": "Swimlane Name", "bar": { ... } }\`
    - **DO NOT** create empty swimlanes.
4.  **BAR LOGIC:**
    - 'startCol' is the 1-based index of the 'timeColumns' array where the task begins.
    - 'endCol' is the 1-based index of the 'timeColumns' array where the task ends, **PLUS ONE**.
    - A task in "2022" has \`startCol: 3, endCol: 4\` (if 2020 is col 1).
    - If a date is "Q1 2024" and the interval is "Years", map it to the "2024" column index.
    - If a date is unknown ("null"), the 'bar' object must be \`{ "startCol": null, "endCol": null, "color": "..." }\`.
5.  **COLORS & LEGEND:** This is a two-step process to assign meaningful colors and create a clear legend.
    a.  **Step 1: Analyze for Cross-Swimlane Themes:** Examine ALL tasks from ALL swimlanes to identify logical thematic groupings that span across multiple swimlanes (e.g., "Product Launch", "Technical Implementation"). A valid theme must:
        - Appear in at least 2 different swimlanes
        - Have a clear, consistent conceptual relationship (not just similar words)
        - Include at least 2 tasks per theme
        - Result in 2-6 total distinct themes
    b.  **Step 2: Choose Coloring Strategy:**
        * **STRATEGY A (Theme-Based - PREFERRED):** If you identified 2-6 valid cross-swimlane themes in Step 1:
          - Assign one unique color to each theme from this priority-ordered list: "priority-red", "medium-red", "mid-grey", "light-grey", "white", "dark-blue"
          - Color ALL tasks belonging to a theme with that theme's color (even across different swimlanes)
          - Populate the 'legend' array with theme labels: \`"legend": [{ "color": "priority-red", "label": "Product Launch" }, { "color": "medium-red", "label": "Technical Implementation" }]\`
        * **STRATEGY B (Swimlane-Based - FALLBACK):** If you did NOT find 2-6 valid cross-swimlane themes:
          - Assign one unique color to each swimlane from this priority-ordered list: "priority-red", "medium-red", "mid-grey", "light-grey", "white", "dark-blue"
          - All tasks within the same swimlane get that swimlane's color
          - Populate the 'legend' array with swimlane names: \`"legend": [{ "color": "priority-red", "label": "Swimlane A Name" }, { "color": "medium-red", "label": "Swimlane B Name" }]\`
        * **CRITICAL:** The 'legend' array must NEVER be empty. It must always explain what the colors represent (either themes or swimlanes).
6.  **TASK TYPE (EXECUTIVE-FIRST ENHANCEMENT):** For each task, classify its type to enable Executive View filtering:
    - Set 'taskType' to one of these values:
      * "milestone": Key deliverable, phase completion, major launch, significant achievement (e.g., "Go Live", "Phase 1 Complete", "Product Launch")
      * "decision": Executive decision point, budget approval, go/no-go gate, steering committee review (e.g., "Executive Approval", "Budget Gate", "Go/No-Go Decision")
      * "task": Regular implementation work, development, testing, documentation (default for most tasks)
    - Use this logic:
      * If task title contains words like "Approval", "Decision", "Gate", "Review" (executive context) → taskType should be "decision"
      * If task title contains words like "Launch", "Complete", "Go Live", "Delivery", "Milestone" → taskType should be "milestone"
      * Otherwise → taskType should be "task"
    - **IMPORTANT:** Executive View will only show tasks where taskType is "milestone" or "decision"
7.  **SANITIZATION:** All string values MUST be valid JSON strings. You MUST properly escape any characters that would break JSON, such as double quotes (\") and newlines (\\n), within the string value itself.`;

/**
 * Task Analysis System Prompt
 * Simplified to match the reduced schema complexity
 */
export const TASK_ANALYSIS_SYSTEM_PROMPT = `You are a senior project management analyst analyzing a specific task from research documents.

Respond with ONLY a valid JSON object matching the schema. Keep your analysis concise and factual.

**REQUIRED FIELDS:**
- taskName: The task name
- startDate: Start date if found (or "Unknown")
- endDate: End date if found (or "Unknown")
- status: "completed", "in-progress", or "not-started"
- rationale: Brief analysis of timeline likelihood (2-3 sentences)
- summary: Concise task summary (2-3 sentences)

**OPTIONAL FIELDS (provide if data available):**
- factsText: Key facts from research, formatted as a bulleted list
- assumptionsText: Key assumptions, formatted as a bulleted list
- expectedDate: Expected completion date
- bestCaseDate: Optimistic completion date
- worstCaseDate: Pessimistic completion date
- risksText: Top 3-5 risks, formatted as a bulleted list
- businessImpact: Business consequences of delay (1-2 sentences)
- strategicImpact: Strategic implications (1-2 sentences)
- percentComplete: Completion percentage (0-100) for in-progress tasks
- velocity: "on-track", "behind", or "ahead" for in-progress tasks
- totalCost: Total project cost estimate
- totalBenefit: Total annual benefit estimate
- roiSummary: ROI summary (payback period, first year ROI)
- stakeholderSummary: Key stakeholders and change management notes (2-3 sentences)
- changeReadiness: Organizational readiness assessment (1-2 sentences)
- keyMetrics: Top 3-5 success metrics, formatted as a bulleted list

**GUIDELINES:**
- Extract facts directly from research - no speculation
- Determine status based on current date (November 2025)
- Keep all text fields concise - use bullet points for lists
- Properly escape quotes and newlines in JSON strings`;

/**
 * Q&A System Prompt Template
 * @param {string} taskName - The task name
 * @param {string} entity - The entity/organization
 * @returns {string} The Q&A system prompt
 */
export function getQASystemPrompt(taskName, entity) {
  return `You are a project analyst. Your job is to answer a user's question about a specific task.

**CRITICAL RULES:**
1.  **GROUNDING:** You MUST answer the question *only* using the information in the provided 'Research Content'.
2.  **CONTEXT:** Your answer MUST be in the context of the task: "${taskName}" (for entity: "${entity}").
3.  **NO SPECULATION:** If the answer cannot be found in the 'Research Content', you MUST respond with "I'm sorry, I don't have enough information in the provided files to answer that question."
4.  **CONCISE:** Keep your answer concise and to the point.
5.  **NO PREAMBLE:** Do not start your response with "Based on the research..." just answer the question directly.`;
}

/**
 * Gantt Chart JSON Schema
 */
export const GANTT_CHART_SCHEMA = {
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
              startCol: { type: "number" },
              endCol: { type: "number" },
              color: { type: "string" }
            },
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
    }
  },
  required: ["title", "timeColumns", "data", "legend"]
};

/**
 * Task Analysis JSON Schema
 * Aggressively simplified to avoid Gemini API "too many states" error
 * Reduced nesting and complexity while keeping essential fields
 */
export const TASK_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    taskName: { type: "string" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    status: { type: "string" },
    rationale: { type: "string" },
    summary: { type: "string" },

    // Simplified facts and assumptions - reduced nesting
    factsText: { type: "string" },
    assumptionsText: { type: "string" },

    // Timeline information
    expectedDate: { type: "string" },
    bestCaseDate: { type: "string" },
    worstCaseDate: { type: "string" },

    // Risk and impact - simplified to strings
    risksText: { type: "string" },
    businessImpact: { type: "string" },
    strategicImpact: { type: "string" },

    // Progress (for in-progress tasks)
    percentComplete: { type: "number" },
    velocity: { type: "string" },

    // Financial impact - minimal fields
    totalCost: { type: "string" },
    totalBenefit: { type: "string" },
    roiSummary: { type: "string" },

    // Stakeholder and change management
    stakeholderSummary: { type: "string" },
    changeReadiness: { type: "string" },

    // Success metrics
    keyMetrics: { type: "string" }
  },
  required: ["taskName", "status"]
};

