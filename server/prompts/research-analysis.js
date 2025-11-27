/**
 * Research Quality Analysis Prompt
 * Optimized schema with minimal descriptions for reduced token usage
 */

// ============================================================================
// STREAMLINED SCHEMA DEFINITIONS
// ============================================================================

/**
 * Complete Research Analysis Schema - Optimized
 */
export const researchAnalysisSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    generatedAt: { type: "string" },
    overallScore: { type: "number" },
    overallRating: { type: "string", enum: ["excellent", "good", "adequate", "poor", "inadequate"] },
    summary: { type: "string" },
    keyFindings: { type: "array", items: { type: "string" } },
    themes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          fitnessScore: { type: "number" },
          eventDataQuality: { type: "string", enum: ["excellent", "good", "adequate", "poor", "inadequate"] },
          datesCounted: { type: "number" },
          tasksPotential: { type: "number" },
          includeableInGantt: { type: "boolean" },
          strengths: { type: "array", items: { type: "string" } },
          gaps: { type: "array", items: { type: "string" } },
          recommendations: { type: "array", items: { type: "string" } },
          sampleEvents: {
            type: "array",
            items: {
              type: "object",
              properties: {
                event: { type: "string" },
                dateInfo: { type: "string" },
                quality: { type: "string", enum: ["specific", "approximate", "vague", "missing"] }
              },
              required: ["event", "dateInfo", "quality"]
            }
          }
        },
        required: ["name", "fitnessScore", "eventDataQuality", "datesCounted", "tasksPotential", "includeableInGantt", "gaps", "recommendations"]
      }
    },
    dataCompleteness: {
      type: "object",
      properties: {
        totalDatesFound: { type: "number" },
        totalEventsIdentified: { type: "number" },
        eventsWithDates: { type: "number" },
        eventsWithoutDates: { type: "number" },
        dateSpecificityBreakdown: {
          type: "object",
          properties: {
            specific: { type: "number" },
            quarterly: { type: "number" },
            monthly: { type: "number" },
            yearly: { type: "number" },
            relative: { type: "number" },
            vague: { type: "number" }
          },
          required: ["specific", "quarterly", "monthly", "yearly", "relative", "vague"]
        },
        timelineSpan: {
          type: "object",
          properties: {
            earliestDate: { type: "string" },
            latestDate: { type: "string" },
            spanDescription: { type: "string" }
          },
          required: ["earliestDate", "latestDate", "spanDescription"]
        }
      },
      required: ["totalDatesFound", "totalEventsIdentified", "eventsWithDates", "eventsWithoutDates", "dateSpecificityBreakdown", "timelineSpan"]
    },
    ganttReadiness: {
      type: "object",
      properties: {
        readyThemes: { type: "number" },
        totalThemes: { type: "number" },
        estimatedTasks: { type: "number" },
        recommendedTimeInterval: { type: "string", enum: ["weeks", "months", "quarters", "years"] },
        readinessVerdict: { type: "string", enum: ["ready", "needs-improvement", "insufficient"] }
      },
      required: ["readyThemes", "totalThemes", "estimatedTasks", "recommendedTimeInterval", "readinessVerdict"]
    },
    criticalGaps: { type: "array", items: { type: "string" } },
    suggestedSources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sourceType: { type: "string" },
          reason: { type: "string" },
          expectedImprovement: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["sourceType", "reason", "priority"]
      }
    },
    actionItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          impact: { type: "string", enum: ["high", "medium", "low"] },
          effort: { type: "string", enum: ["low", "medium", "high"] }
        },
        required: ["action", "impact", "effort"]
      }
    }
  },
  required: ["title", "overallScore", "overallRating", "summary", "themes", "dataCompleteness", "ganttReadiness", "criticalGaps", "actionItems"]
};

// ============================================================================
// SYSTEM PROMPT - Optimized for reduced tokens
// ============================================================================

export const researchAnalysisPrompt = `You are a research analyst evaluating research quality for Gantt chart creation. Output ONLY valid JSON.

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
- Be honest about insufficiencies`;

// ============================================================================
// PROMPT GENERATOR
// ============================================================================

/**
 * Generate the research analysis prompt
 */
export function generateResearchAnalysisPrompt(userPrompt, researchFiles) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `${researchAnalysisPrompt}

REQUEST: ${userPrompt}

RESEARCH:
${researchContent}

TIMESTAMP: ${new Date().toISOString()}

Analyze and return JSON. Use ONLY provided content. Set generatedAt to timestamp above.`;
}

export default { researchAnalysisSchema, researchAnalysisPrompt, generateResearchAnalysisPrompt };
