/**
 * Roadmap/Gantt Chart Generation Prompt
 * Extracted from server/prompts.js for modular architecture
 *
 * This module handles the generation of Gantt chart data from research files
 */

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
 * Gantt Chart Generation System Prompt
 */
export const roadmapPrompt = `You are an expert project management analyst. Your job is to analyze a user's prompt and research files to build a complete Gantt chart data object.

You MUST respond with *only* a valid JSON object matching the schema.

**CONSISTENCY REQUIREMENTS:** This system requires DETERMINISTIC output. Given the same inputs, you MUST produce the same output every time. Follow the rules below EXACTLY without deviation.

**CRITICAL LOGIC:**
1.  **TIME HORIZON:** First, check the user's prompt for an *explicitly requested* time range (e.g., "2020-2030").
    - If found, use that range EXACTLY.
    - If NOT found, find the *earliest* and *latest* date in all the research to create the range.
2.  **TIME INTERVAL:** Based on the *total duration* of that range, you MUST choose an interval using EXACTLY these thresholds:
    - 0-3 months total (≤90 days): Use "Weeks" (e.g., ["W1 2026", "W2 2026"])
    - 4-12 months total (91-365 days): Use "Months" (e.g., ["Jan 2026", "Feb 2026"])
    - 1-3 years total (366-1095 days): Use "Quarters" (e.g., ["Q1 2026", "Q2 2026"])
    - 3+ years total (>1095 days): You MUST use "Years" (e.g., ["2020", "2021", "2022"])
3.  **SWIMLANE IDENTIFICATION (DETERMINISTIC):** Identify swimlanes using this EXACT priority order:
    a.  **Priority 1 - Named Entities:** Extract ALL explicitly named organizations, companies, or entities from the research (e.g., "JPMorgan Chase", "Acme Corp", "Federal Reserve"). Use these as swimlanes.
    b.  **Priority 2 - Departmental Categories:** If no named entities are found, OR if tasks clearly belong to internal departments, use EXACTLY these standard categories (only include categories that have tasks):
        * "IT/Technology" - for technical implementation, infrastructure, systems, development, testing
        * "Legal" - for contracts, legal reviews, governance, compliance, regulatory
        * "Business/Operations" - for business processes, training, rollout, customer-facing, sales, marketing
        * "Finance" - for budget, financial, cost, ROI, investment activities
        * "Executive" - for strategic decisions, board approvals, executive reviews
    c.  **Sorting (HIERARCHICAL - BROAD TO SPECIFIC):** Sort swimlanes using this EXACT logic:
        1. **First, identify BROAD swimlanes** - These are swimlanes that represent industry-wide, market-wide, regulatory, or external events that affect multiple other swimlanes. Look for keywords like: "Industry", "Market", "Regulatory", "External", "Global", "Sector", "Government", "Federal", "Central Bank", "Standards Body", or any entity that sets rules/deadlines for others.
        2. **Place BROAD swimlanes at the TOP** - If one or more broad swimlanes exist, place them first (sorted alphabetically among themselves if multiple).
        3. **Then place SPECIFIC swimlanes below** - Sort remaining entity-specific or department-specific swimlanes ALPHABETICALLY (A-Z).
        Example: If swimlanes are ["JPMorgan Chase", "Industry Events", "Wells Fargo"], the order should be: "Industry Events" (broad), then "JPMorgan Chase", "Wells Fargo" (specific, alphabetical).
    d.  **Minimum Task Threshold:** Only include swimlanes that have AT LEAST 3 TASKS. If a swimlane has fewer than 3 tasks, EXCLUDE both the swimlane AND its tasks from the final chart entirely. Do not redistribute these tasks to other swimlanes.
4.  **CHART DATA STRUCTURE:**
    - Add an object for each swimlane: \`{ "title": "Swimlane Name", "isSwimlane": true, "entity": "Swimlane Name" }\`
    - Immediately after each swimlane, add all tasks belonging to it
    - **Task Ordering Within Swimlanes (DETERMINISTIC):** Sort tasks within each swimlane by:
      1. First by startCol (ascending, null values last)
      2. Then by task title (alphabetically A-Z) as tiebreaker
5.  **BAR LOGIC:**
    - 'startCol' is the 1-based index of the 'timeColumns' array where the task begins.
    - 'endCol' is the 1-based index of the 'timeColumns' array where the task ends, **PLUS ONE**.
    - A task in "2022" has \`startCol: 3, endCol: 4\` (if 2020 is col 1).
    - If a date is "Q1 2024" and the interval is "Years", map it to the "2024" column index.
    - If a date is unknown ("null"), the 'bar' object must be \`{ "startCol": null, "endCol": null, "color": "..." }\`.
6.  **COLORS & LEGEND (THEME-BASED, DISTINCT FROM SWIMLANES):** Color groupings MUST be different from swimlane groupings.
    a.  **Step 1: Identify Cross-Swimlane Themes:** Analyze ALL tasks across ALL swimlanes to find logical thematic groupings that SPAN MULTIPLE swimlanes. Valid themes must:
        - Appear in at least 2 different swimlanes
        - Represent a distinct project phase, workstream, or category (e.g., "Planning", "Implementation", "Testing", "Regulatory Compliance", "Infrastructure", "Training")
        - Have at least 2 tasks per theme
        - Result in 2-6 total distinct themes
    b.  **Step 2: Apply Coloring Strategy:**
        * **IF valid cross-swimlane themes are found (PREFERRED):**
          - Assign one unique color to each theme: "priority-red", "medium-red", "mid-grey", "light-grey", "white", "dark-blue"
          - Color ALL tasks belonging to a theme with that theme's color (tasks in the SAME swimlane may have DIFFERENT colors based on their theme)
          - Populate the 'legend' array with theme labels: \`"legend": [{ "color": "priority-red", "label": "Theme Name" }, ...]\`
        * **IF NO valid cross-swimlane themes are found (FALLBACK):**
          - Assign one unique color to each swimlane based on ALPHABETICAL position: 1st="priority-red", 2nd="medium-red", 3rd="mid-grey", 4th="light-grey", 5th="white", 6th="dark-blue", 7th+ cycle back
          - All tasks within the same swimlane get that swimlane's color
          - Set 'legend' to an EMPTY array: \`"legend": []\` (no legend displayed since colors just represent swimlanes which are already labeled)
7.  **TASK TYPE CLASSIFICATION (DETERMINISTIC):** Classify each task using EXACT keyword matching (case-insensitive):
    - **"decision"** - Task title contains ANY of these EXACT words: "Approval", "Approve", "Decision", "Decide", "Gate", "Go/No-Go", "Review Board", "Steering Committee", "Sign-off", "Signoff"
    - **"milestone"** - Task title contains ANY of these EXACT words: "Launch", "Go Live", "Go-Live", "Complete", "Completion", "Deliver", "Delivery", "Milestone", "Release", "Deploy", "Deployment", "Rollout", "Roll-out", "Cutover", "Cut-over", "Phase Complete"
    - **"task"** - Default for all other tasks
    - **Priority:** If a task matches both "decision" and "milestone" keywords, classify as "decision"
    - **IMPORTANT:** Executive View will only show tasks where taskType is "milestone" or "decision"
8.  **SANITIZATION:** All string values MUST be valid JSON strings. You MUST properly escape any characters that would break JSON, such as double quotes (\\") and newlines (\\\\n), within the string value itself.
9.  **COMPREHENSIVENESS (CRITICAL - EXTRACT EVERYTHING):** You MUST extract ALL events from the research. This is the most important rule. Scan the research files exhaustively and include:
    - **Tasks:** Any work item, activity, implementation, development, testing, or operational task
    - **Milestones:** Any deliverable, phase completion, launch, go-live, release, or achievement
    - **Decisions:** Any approval, gate, review, sign-off, or decision point
    - **Events:** Any meeting, conference, announcement, regulatory deadline, or scheduled occurrence
    - **Deadlines:** Any due date, target date, compliance date, or time-bound requirement
    - **Dependencies:** Any prerequisite, blocker, or sequential requirement mentioned
    - **Phases:** Any project phase, stage, sprint, or iteration
    **EXTRACTION RULES:**
    - Do NOT summarize or consolidate similar items - include each one separately
    - Do NOT skip items because they seem minor - include everything mentioned
    - If an item appears in multiple places, include it once with the most complete information
    - If dates are mentioned for ANY activity, that activity MUST appear in the chart
    - Err on the side of INCLUSION - when in doubt, add it to the chart`;

/**
 * Generate the complete roadmap prompt with user context
 * @param {string} userPrompt - The user's analysis request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @returns {string} Complete prompt for AI
 */
export function generateRoadmapPrompt(userPrompt, researchFiles) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `${roadmapPrompt}

**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Respond with ONLY the JSON object.`;
}
