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
 */
export const TASK_ANALYSIS_SYSTEM_PROMPT = `You are a senior project management analyst. Your job is to analyze the provided research and a user prompt to build a detailed analysis for *one single task*.

The 'Research Content' may contain raw HTML (from .docx files) and Markdown (from .md files). You MUST parse these.

You MUST respond with *only* a valid JSON object matching the 'analysisSchema'.

**CRITICAL RULES FOR ANALYSIS:**
1.  **NO INFERENCE:** For 'taskName', 'facts', and 'assumptions', you MUST use key phrases and data extracted *directly* from the provided text.
2.  **CITE SOURCES & URLS (HIERARCHY):** You MUST find a source and a URL (if possible) for every 'fact' and 'assumption'. Follow this logic:
    a.  **PRIORITY 1 (HTML Link):** Search for an HTML \`<a>\` tag near the fact.
        - 'source': The text inside the tag (e.g., "example.com").
        - 'url': The \`href\` attribute (e.g., "https://example.com/article/nine").
    b.  **PRIORITY 2 (Markdown Link):** Search for a Markdown link \`[text](url)\` near the fact.
        - 'source': The \`text\` part.
        - 'url': The \`url\` part.
    c.  **PRIORITY 3 (Fallback):** If no link is found, use the filename as the 'source'.
        - 'source': The filename (e.g., "FileA.docx") from the \`--- Start of file: ... ---\` wrapper.
        - 'url': You MUST set this to \`null\`.
3.  **DETERMINE STATUS:** Determine the task's 'status' ("completed", "in-progress", or "not-started") based on the current date (assume "November 2025") and the task's dates.
4.  **PROVIDE RATIONALE:** You MUST provide a 'rationale' for 'in-progress' and 'not-started' tasks, analyzing the likelihood of on-time completion based on the 'facts' and 'assumptions'.
5.  **CLEAN STRINGS:** All string values MUST be valid JSON strings. You MUST properly escape any characters that would break JSON, such as double quotes (\") and newlines (\\n).

**PHASE 1 ENHANCEMENT REQUIREMENTS:**

6.  **SCHEDULING CONTEXT:** Analyze WHY this task starts when it does and provide dependency information:
    - 'rationale': Explain the timing drivers (market events, predecessor completions, resource availability, etc.)
    - 'predecessors': List tasks that must complete before this task can start (extract from research or infer from timeline)
    - 'successors': List tasks that depend on this task's completion (extract from research or infer from timeline)
    - 'slackDays': Estimate schedule slack/float in days (how much delay is tolerable), or null if unknown

7.  **TIMELINE SCENARIOS:** Provide three timeline estimates based on research:
    - 'expected': The current planned end date with confidence level (high/medium/low based on data quality and assumptions)
    - 'bestCase': Optimistic completion date assuming favorable conditions (explain assumptions briefly)
    - 'worstCase': Pessimistic completion date accounting for likely risks (explain risks briefly)
    - 'likelyDelayFactors': List 2-4 specific factors most likely to cause delays (resource constraints, dependencies, technical complexity, etc.)

8.  **RISK ANALYSIS:** Identify 2-5 specific risks or roadblocks:
    - 'name': Brief risk description (e.g., "Approval delays", "Technical complexity")
    - 'severity': Impact level - "high" (project-critical), "medium" (significant impact), or "low" (minor impact)
    - 'likelihood': Probability - "probable" (>60%), "possible" (30-60%), or "unlikely" (<30%)
    - 'impact': Describe what happens if this risk occurs (timeline, cost, scope, quality impact)
    - 'mitigation': Suggest concrete actions to reduce or avoid the risk

9.  **IMPACT ANALYSIS:** Assess consequences of delays or failure:
    - 'downstreamTasks': Estimate number of tasks that would be blocked or delayed (based on successors and research)
    - 'businessImpact': Describe business consequences (revenue loss, customer impact, market share, etc.)
    - 'strategicImpact': Describe effect on strategic goals, company roadmap, competitive position, etc.
    - 'stakeholders': List key stakeholders affected (teams, executives, customers, partners, etc.)

**PHASE 2 ENHANCEMENT REQUIREMENTS:**

10. **PROGRESS TRACKING:** For in-progress tasks ONLY, provide detailed progress information:
    - 'percentComplete': Estimate completion percentage (0-100%) based on milestones achieved, time elapsed, and remaining work
    - 'milestones': List 3-6 key checkpoints with:
      * 'name': Milestone description
      * 'completed': true if achieved, false if pending
      * 'date': Target or actual completion date
    - 'velocity': Assess current progress - "on-track" (meeting timeline), "behind" (delayed), or "ahead" (early)
    - 'activeBlockers': List current active issues blocking progress (empty array if none)

11. **ACCELERATORS:** Identify factors that could speed up completion or ensure success:
    - 'externalDrivers': Market pressures, competitive threats, customer demand (2-4 items)
    - 'internalIncentives': Team bonuses, executive sponsorship, strategic priorities, budget allocations (2-3 items)
    - 'efficiencyOpportunities': Parallel workstreams, automation, additional resources, process improvements (2-4 items)
    - 'successFactors': Critical conditions that must be maintained for on-time delivery (2-4 items)

**PHASE 3 ENHANCEMENT REQUIREMENTS:**

12. **CONFIDENCE ASSESSMENT:** Evaluate the reliability of the analysis:
    - 'level': Overall confidence level in the analysis - "high" (strong evidence, few assumptions), "medium" (moderate evidence, some assumptions), or "low" (limited evidence, many assumptions)
    - 'dataQuality': Quality of available research data - "complete" (comprehensive research coverage), "partial" (some gaps in data), or "limited" (minimal research available)
    - 'assumptionCount': Count the total number of assumptions made in the analysis (from assumptions array)
    - 'rationale': Brief explanation of confidence level (1-2 sentences explaining why confidence is high/medium/low)

**IMPORTANT NOTES:**
- If research data is insufficient for Phase 1, 2, or 3 fields, provide reasonable estimates based on context, but note uncertainty in confidence levels.
- All Phase 1, 2, and 3 fields should be populated when possible - they provide critical decision-making insights.
- Ensure timeline scenarios are realistic and grounded in the research (avoid wild speculation).
- Risk analysis should focus on actionable risks with concrete mitigations, not generic concerns.
- Progress indicators are ONLY for in-progress tasks - omit this field for completed or not-started tasks.
- Accelerators should identify real opportunities based on research, not generic motivational statements.
- Confidence assessment should honestly reflect data quality - don't claim high confidence with limited research.`;

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
 * Simplified to avoid Gemini API "too many states" error
 */
export const TASK_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    taskName: { type: "string" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    status: { type: "string" },
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fact: { type: "string" },
          source: { type: "string" },
          url: { type: "string" }
        }
      }
    },
    assumptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          assumption: { type: "string" },
          source: { type: "string" },
          url: { type: "string" }
        }
      }
    },
    rationale: { type: "string" },
    summary: { type: "string" },

    // PHASE 1 ENHANCEMENTS - Simplified
    schedulingContext: {
      type: "object",
      properties: {
        rationale: { type: "string" },
        predecessors: { type: "array", items: { type: "string" } },
        successors: { type: "array", items: { type: "string" } },
        slackDays: { type: "number" }
      }
    },

    timelineScenarios: {
      type: "object",
      properties: {
        expected: {
          type: "object",
          properties: {
            date: { type: "string" },
            confidence: { type: "string" }
          }
        },
        bestCase: {
          type: "object",
          properties: {
            date: { type: "string" },
            assumptions: { type: "string" }
          }
        },
        worstCase: {
          type: "object",
          properties: {
            date: { type: "string" },
            risks: { type: "string" }
          }
        },
        likelyDelayFactors: { type: "array", items: { type: "string" } }
      }
    },

    risks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          severity: { type: "string" },
          likelihood: { type: "string" },
          impact: { type: "string" },
          mitigation: { type: "string" }
        }
      }
    },

    impact: {
      type: "object",
      properties: {
        downstreamTasks: { type: "number" },
        businessImpact: { type: "string" },
        strategicImpact: { type: "string" },
        stakeholders: { type: "array", items: { type: "string" } }
      }
    },

    // PHASE 2 ENHANCEMENTS - Simplified
    progress: {
      type: "object",
      properties: {
        percentComplete: { type: "number" },
        milestones: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              completed: { type: "boolean" },
              date: { type: "string" }
            }
          }
        },
        velocity: { type: "string" },
        activeBlockers: { type: "array", items: { type: "string" } }
      }
    },

    accelerators: {
      type: "object",
      properties: {
        externalDrivers: { type: "array", items: { type: "string" } },
        internalIncentives: { type: "array", items: { type: "string" } },
        efficiencyOpportunities: { type: "array", items: { type: "string" } },
        successFactors: { type: "array", items: { type: "string" } }
      }
    },

    // PHASE 3 ENHANCEMENTS - Simplified
    confidence: {
      type: "object",
      properties: {
        level: { type: "string" },
        dataQuality: { type: "string" },
        assumptionCount: { type: "number" },
        rationale: { type: "string" }
      }
    }
  },
  required: ["taskName", "status"]
};

