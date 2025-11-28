/**
 * Research Analysis Signature - PROMPT ML Layer 3
 *
 * DSPy-style signature for research quality assessment.
 * Evaluates research fitness for Gantt chart generation.
 *
 * Based on PROMPT ML design specification.
 */

import { createSignature, FieldType } from './base.js';

/**
 * Research analysis instructions
 */
const RESEARCH_ANALYSIS_INSTRUCTIONS = `You are a research analyst evaluating research quality for Gantt chart creation.
Output ONLY valid JSON matching the schema.

## SCORING CRITERIA (1-10)
- 9-10: Specific dates (day/month/year), clear milestones, deadlines
- 7-8: Month/year dates, some milestones, minor gaps
- 5-6: Approximate dates (quarters), limited detail
- 3-4: Narrative content, few specific dates
- 1-2: No dates/timelines, conceptual only

## THEME ANALYSIS
For each theme identified:
- Count all date references accurately
- Identify specific gaps in coverage
- Provide actionable recommendations

Theme is "Gantt-ready" if: 3+ tasks AND 2+ have dates.

## DATE CLASSIFICATION
- specific: "March 15, 2024" (exact day)
- quarterly: "Q2 2024"
- monthly: "June 2024"
- yearly: "2024"
- relative: "6 months after launch"
- vague: "soon", "later", "eventually"

## READINESS VERDICT
- ready: 3+ themes Gantt-ready, overall score >= 6
- needs-improvement: 1-2 themes ready OR score 4-5.9
- insufficient: 0 themes ready OR score < 4

## ANALYSIS REQUIREMENTS
- Analyze ALL themes found in research
- Cite specific examples from the content
- Recommendations must be actionable and specific
- Count dates accurately - don't estimate
- Be honest about insufficiencies
- Include sample events with their date quality`;

/**
 * Theme schema
 */
const THEME_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    fitnessScore: { type: 'number' },
    eventDataQuality: { type: 'string', enum: ['excellent', 'good', 'adequate', 'poor', 'inadequate'] },
    datesCounted: { type: 'number' },
    tasksPotential: { type: 'number' },
    includeableInGantt: { type: 'boolean' },
    strengths: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
    sampleEvents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          event: { type: 'string' },
          dateInfo: { type: 'string' },
          quality: { type: 'string', enum: ['specific', 'approximate', 'vague', 'missing'] }
        },
        required: ['event', 'dateInfo', 'quality']
      }
    }
  },
  required: ['name', 'fitnessScore', 'eventDataQuality', 'datesCounted', 'tasksPotential', 'includeableInGantt', 'gaps', 'recommendations']
};

/**
 * Data completeness schema
 */
const DATA_COMPLETENESS_SCHEMA = {
  type: 'object',
  properties: {
    totalDatesFound: { type: 'number' },
    totalEventsIdentified: { type: 'number' },
    eventsWithDates: { type: 'number' },
    eventsWithoutDates: { type: 'number' },
    dateSpecificityBreakdown: {
      type: 'object',
      properties: {
        specific: { type: 'number' },
        quarterly: { type: 'number' },
        monthly: { type: 'number' },
        yearly: { type: 'number' },
        relative: { type: 'number' },
        vague: { type: 'number' }
      },
      required: ['specific', 'quarterly', 'monthly', 'yearly', 'relative', 'vague']
    },
    timelineSpan: {
      type: 'object',
      properties: {
        earliestDate: { type: 'string' },
        latestDate: { type: 'string' },
        spanDescription: { type: 'string' }
      },
      required: ['earliestDate', 'latestDate', 'spanDescription']
    }
  },
  required: ['totalDatesFound', 'totalEventsIdentified', 'eventsWithDates', 'eventsWithoutDates', 'dateSpecificityBreakdown', 'timelineSpan']
};

/**
 * Gantt readiness schema
 */
const GANTT_READINESS_SCHEMA = {
  type: 'object',
  properties: {
    readyThemes: { type: 'number' },
    totalThemes: { type: 'number' },
    estimatedTasks: { type: 'number' },
    recommendedTimeInterval: { type: 'string', enum: ['weeks', 'months', 'quarters', 'years'] },
    readinessVerdict: { type: 'string', enum: ['ready', 'needs-improvement', 'insufficient'] }
  },
  required: ['readyThemes', 'totalThemes', 'estimatedTasks', 'recommendedTimeInterval', 'readinessVerdict']
};

/**
 * Build the Research Analysis Signature
 */
export const ResearchAnalysisSignature = createSignature('ResearchAnalysis')
  .describe('Analyze research quality and fitness for Gantt chart generation, identifying themes, gaps, and providing recommendations.')
  .instruct(RESEARCH_ANALYSIS_INSTRUCTIONS)

  // Input fields
  .input('userPrompt', FieldType.STRING, {
    description: 'User request for research analysis',
    required: true,
    constraints: { minLength: 1 }
  })
  .input('researchFiles', FieldType.ARRAY, {
    description: 'Array of research files with filename and content',
    required: true,
    constraints: { minItems: 1 }
  })
  .input('timestamp', FieldType.STRING, {
    description: 'Timestamp for the analysis',
    required: false
  })

  // Output fields - Primary
  .output('title', FieldType.STRING, {
    description: 'Analysis report title',
    required: true
  })
  .output('generatedAt', FieldType.STRING, {
    description: 'ISO timestamp of generation',
    required: false
  })
  .output('overallScore', FieldType.NUMBER, {
    description: 'Overall research fitness score (1-10)',
    required: true,
    constraints: { min: 1, max: 10 }
  })
  .output('overallRating', FieldType.STRING, {
    description: 'Overall quality rating',
    required: true,
    constraints: { enum: ['excellent', 'good', 'adequate', 'poor', 'inadequate'] }
  })
  .output('summary', FieldType.STRING, {
    description: 'Executive summary of research quality',
    required: true
  })
  .output('keyFindings', FieldType.ARRAY, {
    description: 'Key findings from analysis',
    required: false,
    itemSchema: { type: 'string' }
  })

  // Output fields - Themes
  .output('themes', FieldType.ARRAY, {
    description: 'Analysis of each identified theme',
    required: true,
    itemSchema: THEME_SCHEMA
  })

  // Output fields - Data Analysis
  .output('dataCompleteness', FieldType.OBJECT, {
    description: 'Data completeness metrics',
    required: true,
    properties: DATA_COMPLETENESS_SCHEMA.properties
  })
  .output('ganttReadiness', FieldType.OBJECT, {
    description: 'Gantt chart readiness assessment',
    required: true,
    properties: GANTT_READINESS_SCHEMA.properties
  })

  // Output fields - Recommendations
  .output('criticalGaps', FieldType.ARRAY, {
    description: 'Critical gaps that need addressing',
    required: true,
    itemSchema: { type: 'string' }
  })
  .output('suggestedSources', FieldType.ARRAY, {
    description: 'Suggested additional sources',
    required: false,
    itemSchema: {
      type: 'object',
      properties: {
        sourceType: { type: 'string' },
        reason: { type: 'string' },
        expectedImprovement: { type: 'string' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] }
      },
      required: ['sourceType', 'reason', 'priority']
    }
  })
  .output('actionItems', FieldType.ARRAY, {
    description: 'Recommended action items',
    required: true,
    itemSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        impact: { type: 'string', enum: ['high', 'medium', 'low'] },
        effort: { type: 'string', enum: ['low', 'medium', 'high'] }
      },
      required: ['action', 'impact', 'effort']
    }
  })

  // Configuration
  .configure({
    outputFormat: 'json',
    maxOutputLength: 8192,
    taskType: 'research-analysis'
  })

  .build();

/**
 * Generate research analysis prompt using the signature
 *
 * @param {string} userPrompt - User's analysis request
 * @param {Array} researchFiles - Research files [{filename, content}]
 * @param {Object} options - Additional options
 * @returns {string} Generated prompt
 */
export function generateResearchAnalysisSignaturePrompt(userPrompt, researchFiles, options = {}) {
  return ResearchAnalysisSignature.generatePrompt({
    userPrompt,
    researchFiles,
    timestamp: options.timestamp || new Date().toISOString()
  }, {
    includeExamples: options.includeExamples || false,
    maxExamples: 0
  });
}

/**
 * Validate research analysis inputs
 */
export function validateResearchAnalysisInputs(userPrompt, researchFiles) {
  return ResearchAnalysisSignature.validateInputs({
    userPrompt,
    researchFiles
  });
}

/**
 * Get research analysis output schema
 */
export function getResearchAnalysisOutputSchema() {
  return ResearchAnalysisSignature.getOutputSchema();
}

export default ResearchAnalysisSignature;
