/**
 * Semantic Gantt Data Type Definitions
 * Bimodal schema for distinguishing Facts vs. Inferences
 *
 * Uses Zod for runtime validation and TypeScript-like type safety
 * ES6 Module format (not TypeScript)
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════
// CORE ENUMS AND PRIMITIVES
// ═══════════════════════════════════════════════════════════

/**
 * Origin of a data point
 * - explicit: Directly stated in source documents (100% confidence)
 * - inferred: Derived by AI through logical reasoning (0-99% confidence)
 * - hybrid: Combination of explicit and inferred data
 */
export const DataOrigin = z.enum(['explicit', 'inferred', 'hybrid']);

/**
 * Confidence score for data accuracy
 * - 1.0 = 100% confident (explicit facts only)
 * - 0.0-0.99 = Varying confidence (inferences)
 */
export const ConfidenceScore = z.number()
  .min(0)
  .max(1)
  .describe('1.0 for explicit facts, 0.0-0.99 for inferences');

// ═══════════════════════════════════════════════════════════
// CITATION SCHEMA (For Explicit Facts)
// ═══════════════════════════════════════════════════════════

/**
 * Source citation linking data to original document
 * Required for all explicit facts
 */
export const Citation = z.object({
  documentId: z.string().optional().describe('Unique document identifier'),
  documentName: z.string().describe('Original filename'),
  pageNumber: z.number().optional().describe('Page number if applicable (PDF)'),
  paragraphIndex: z.number().describe('Paragraph index in document'),
  startChar: z.number().describe('Character offset where quote starts'),
  endChar: z.number().describe('Character offset where quote ends'),
  exactQuote: z.string().max(500).describe('Exact text from source document')
});

// ═══════════════════════════════════════════════════════════
// INFERENCE RATIONALE SCHEMA (For Inferences)
// ═══════════════════════════════════════════════════════════

/**
 * Inference method taxonomy
 * Describes how AI derived a conclusion
 */
export const InferenceMethod = z.enum([
  'temporal_logic',      // "A must complete before B starts"
  'industry_standard',   // "Banking projects typically require X"
  'dependency_chain',    // "C depends on B which depends on A"
  'regulatory_pattern',  // "OCC approval typically takes 3-6 months"
  'resource_constraint', // "Only 2 architects available"
  'buffer_padding'       // "Added 20% contingency for risk"
]);

/**
 * Rationale for AI-derived inferences
 * Required for all inferred data
 */
export const InferenceRationale = z.object({
  method: InferenceMethod.describe('Type of logical reasoning used'),
  explanation: z.string().describe('Human-readable explanation of inference'),
  supportingFacts: z.array(z.string()).describe('IDs of explicit facts used as evidence'),
  confidence: ConfidenceScore.describe('Confidence in this inference')
});

// ═══════════════════════════════════════════════════════════
// BIMODAL DATE/DURATION SCHEMAS
// ═══════════════════════════════════════════════════════════

/**
 * Date with provenance tracking
 * Every date knows if it's a fact or inference
 */
export const BimodalDate = z.object({
  value: z.string().describe('ISO 8601 datetime string'),
  origin: DataOrigin,
  confidence: ConfidenceScore,
  citation: Citation.optional().describe('Required if origin=explicit'),
  rationale: InferenceRationale.optional().describe('Required if origin=inferred')
});

/**
 * Duration with provenance tracking
 */
export const BimodalDuration = z.object({
  value: z.number().describe('Duration value'),
  unit: z.enum(['days', 'weeks', 'months', 'years']).describe('Time unit'),
  origin: DataOrigin,
  confidence: ConfidenceScore,
  citation: Citation.optional(),
  rationale: InferenceRationale.optional()
});

// ═══════════════════════════════════════════════════════════
// BIMODAL TASK SCHEMA
// ═══════════════════════════════════════════════════════════

/**
 * Resource assignment with provenance
 */
export const BimodalResource = z.object({
  name: z.string().describe('Resource name or role'),
  role: z.string().describe('Role on project'),
  allocation: z.number().min(0).max(1).describe('FTE allocation (0.0-1.0)'),
  origin: DataOrigin,
  confidence: ConfidenceScore
});

/**
 * Regulatory requirement tracking (banking-specific)
 */
export const RegulatoryRequirement = z.object({
  isRequired: z.boolean(),
  regulation: z.string().optional().describe('Regulator name (OCC, FDIC, etc.)'),
  deadline: z.string().optional().describe('ISO 8601 deadline'),
  origin: DataOrigin,
  confidence: ConfidenceScore
});

/**
 * Visual styling based on confidence
 * Higher confidence = more solid appearance
 */
export const VisualStyle = z.object({
  color: z.string().describe('Hex color or CSS color name'),
  borderStyle: z.enum(['solid', 'dashed', 'dotted']).describe('Border styling'),
  opacity: z.number().min(0.3).max(1).describe('Opacity level')
});

/**
 * Complete bimodal task definition
 * Extends standard Gantt task with provenance metadata
 */
export const BimodalTask = z.object({
  // Core properties
  id: z.string().describe('Unique task identifier'),
  name: z.string().describe('Task name'),

  // Bimodal metadata
  origin: DataOrigin.describe('Data provenance'),
  confidence: ConfidenceScore.describe('Overall task confidence'),

  // Provenance (mutually exclusive based on origin)
  sourceCitations: z.array(Citation).optional()
    .describe('Required when origin=explicit'),
  inferenceRationale: InferenceRationale.optional()
    .describe('Required when origin=inferred'),

  // Temporal properties with provenance
  startDate: BimodalDate.describe('Task start date'),
  endDate: BimodalDate.describe('Task end date'),
  duration: BimodalDuration.describe('Task duration'),

  // Resources with provenance
  resources: z.array(BimodalResource).default([]),

  // Banking-specific fields
  regulatoryRequirement: RegulatoryRequirement.optional(),

  // Visual presentation
  visualStyle: VisualStyle.describe('Confidence-based styling'),

  // Optional fields for backward compatibility
  description: z.string().optional(),
  entity: z.string().optional().describe('Department or team'),
  swimlane: z.string().optional().describe('Swimlane assignment')
});

// ═══════════════════════════════════════════════════════════
// BIMODAL DEPENDENCY SCHEMA
// ═══════════════════════════════════════════════════════════

/**
 * Dependency type (standard project management)
 */
export const DependencyType = z.enum([
  'finish-to-start',
  'start-to-start',
  'finish-to-finish',
  'start-to-finish'
]);

/**
 * Dependency strength classification
 */
export const DependencyStrength = z.enum([
  'mandatory',  // Hard constraint (explicit dependencies)
  'strong',     // Highly recommended
  'moderate',   // Suggested
  'weak'        // Optional
]);

/**
 * Task dependency with provenance tracking
 */
export const BimodalDependency = z.object({
  id: z.string(),
  source: z.string().describe('Source task ID'),
  target: z.string().describe('Target task ID'),
  type: DependencyType.default('finish-to-start'),

  // Bimodal metadata
  origin: DataOrigin,
  confidence: ConfidenceScore,

  // Provenance
  sourceCitation: Citation.optional(),
  inferenceRationale: InferenceRationale.optional(),

  // Dependency properties
  strength: DependencyStrength.describe('Mandatory for explicit, varies for inferred'),
  lagTime: BimodalDuration.optional().describe('Delay between tasks')
});

// ═══════════════════════════════════════════════════════════
// SWIMLANE SCHEMA
// ═══════════════════════════════════════════════════════════

export const BimodalSwimlane = z.object({
  id: z.string(),
  name: z.string(),
  taskIds: z.array(z.string()),
  origin: DataOrigin,
  confidence: ConfidenceScore
});

// ═══════════════════════════════════════════════════════════
// RISK SCHEMA
// ═══════════════════════════════════════════════════════════

export const RiskImpact = z.enum(['low', 'medium', 'high', 'critical']);

export const BimodalRisk = z.object({
  id: z.string(),
  description: z.string(),
  impact: RiskImpact,
  probability: z.number().min(0).max(1).describe('Risk probability (0.0-1.0)'),
  affectedTaskIds: z.array(z.string()),
  origin: DataOrigin,
  confidence: ConfidenceScore,
  mitigationStrategy: z.string().optional()
});

// ═══════════════════════════════════════════════════════════
// REGULATORY CHECKPOINT SCHEMA (Banking-Specific)
// ═══════════════════════════════════════════════════════════

export const RegulatoryCheckpoint = z.object({
  id: z.string(),
  regulation: z.string().describe('Regulatory body (OCC, FDIC, Federal Reserve)'),
  deadline: z.string().describe('ISO 8601 deadline'),
  taskIds: z.array(z.string()).describe('Tasks impacted by this checkpoint'),
  origin: DataOrigin,
  confidence: ConfidenceScore,
  citation: Citation.optional()
});

// ═══════════════════════════════════════════════════════════
// CONFIDENCE ANALYSIS SCHEMA
// ═══════════════════════════════════════════════════════════

export const ConfidenceDistributionBucket = z.object({
  range: z.string().describe('Confidence range (e.g., "0.9-1.0")'),
  count: z.number().describe('Number of items in this range'),
  percentage: z.number().describe('Percentage of total')
});

export const WeakestLink = z.object({
  taskId: z.string(),
  taskName: z.string(),
  confidence: z.number(),
  reason: z.string().describe('Why confidence is low')
});

export const ConfidenceAnalysis = z.object({
  distribution: z.array(ConfidenceDistributionBucket),
  weakestLinks: z.array(WeakestLink).describe('Tasks with lowest confidence')
});

// ═══════════════════════════════════════════════════════════
// STATISTICS SCHEMA
// ═══════════════════════════════════════════════════════════

export const Statistics = z.object({
  totalTasks: z.number(),
  explicitTasks: z.number().describe('Number of fact-based tasks'),
  inferredTasks: z.number().describe('Number of AI-inferred tasks'),
  averageConfidence: z.number().describe('Mean confidence across all items'),
  dataQualityScore: z.number().describe('Ratio of facts to total (0.0-1.0)')
});

// ═══════════════════════════════════════════════════════════
// PROJECT SUMMARY SCHEMA
// ═══════════════════════════════════════════════════════════

export const ProjectSummary = z.object({
  name: z.string(),
  description: z.string(),
  origin: DataOrigin,
  confidence: ConfidenceScore
});

// ═══════════════════════════════════════════════════════════
// COMPLETE BIMODAL GANTT DATA STRUCTURE
// ═══════════════════════════════════════════════════════════

/**
 * Top-level bimodal Gantt chart data structure
 * This is the main data contract between backend and frontend
 */
export const BimodalGanttData = z.object({
  // Metadata
  generatedAt: z.string().describe('ISO 8601 generation timestamp'),
  geminiVersion: z.string().default('gemini-2.5-flash-preview'),
  determinismSeed: z.number().describe('Seed for reproducibility'),

  // Project overview
  projectSummary: ProjectSummary,

  // Statistics
  statistics: Statistics,

  // Core data
  tasks: z.array(BimodalTask),
  dependencies: z.array(BimodalDependency),

  // Organizational
  swimlanes: z.array(BimodalSwimlane).default([]),

  // Risk management
  risks: z.array(BimodalRisk).default([]),

  // Banking-specific
  regulatoryCheckpoints: z.array(RegulatoryCheckpoint).default([]),

  // Analytics
  confidenceAnalysis: ConfidenceAnalysis.optional()
});

// ═══════════════════════════════════════════════════════════
// TYPE EXPORTS (For IDE Autocomplete)
// ═══════════════════════════════════════════════════════════

// Export inferred TypeScript types from Zod schemas
// These can be imported for type hints in IDEs
export const BimodalGanttDataType = BimodalGanttData;
export const BimodalTaskType = BimodalTask;
export const BimodalDependencyType = BimodalDependency;

// ═══════════════════════════════════════════════════════════
// VALIDATION HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Validates raw data against BimodalGanttData schema
 * @param {any} data - Raw data to validate
 * @returns {Object} Validation result with success flag and data/errors
 */
export function validateBimodalData(data) {
  try {
    const validated = BimodalGanttData.parse(data);
    return {
      success: true,
      data: validated,
      errors: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.errors || [{ message: error.message }]
    };
  }
}

/**
 * Safe parse that returns validation result without throwing
 * @param {any} data - Raw data to validate
 * @returns {Object} Zod SafeParseResult
 */
export function safeParseBimodalData(data) {
  return BimodalGanttData.safeParse(data);
}

/**
 * Converts Zod schema to JSON Schema format for Gemini
 * Simplified version - Gemini accepts a subset of JSON Schema
 * @param {z.ZodType} zodSchema - Zod schema to convert
 * @returns {Object} JSON Schema object
 */
export function zodToJsonSchema(zodSchema) {
  // For now, return a basic structure
  // Full conversion would require a library like zod-to-json-schema
  // Gemini's responseSchema accepts basic JSON Schema format

  return {
    type: "object",
    properties: {
      generatedAt: { type: "string" },
      geminiVersion: { type: "string" },
      determinismSeed: { type: "number" },
      projectSummary: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          origin: { type: "string", enum: ["explicit", "inferred", "hybrid"] },
          confidence: { type: "number" }
        },
        required: ["name", "description", "origin", "confidence"]
      },
      statistics: {
        type: "object",
        properties: {
          totalTasks: { type: "number" },
          explicitTasks: { type: "number" },
          inferredTasks: { type: "number" },
          averageConfidence: { type: "number" },
          dataQualityScore: { type: "number" }
        },
        required: ["totalTasks", "explicitTasks", "inferredTasks", "averageConfidence", "dataQualityScore"]
      },
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            origin: { type: "string", enum: ["explicit", "inferred", "hybrid"] },
            confidence: { type: "number" },
            startDate: {
              type: "object",
              properties: {
                value: { type: "string" },
                origin: { type: "string" },
                confidence: { type: "number" }
              }
            },
            endDate: {
              type: "object",
              properties: {
                value: { type: "string" },
                origin: { type: "string" },
                confidence: { type: "number" }
              }
            },
            duration: {
              type: "object",
              properties: {
                value: { type: "number" },
                unit: { type: "string" },
                origin: { type: "string" },
                confidence: { type: "number" }
              }
            },
            resources: { type: "array" },
            visualStyle: {
              type: "object",
              properties: {
                color: { type: "string" },
                borderStyle: { type: "string" },
                opacity: { type: "number" }
              }
            }
          },
          required: ["id", "name", "origin", "confidence", "startDate", "endDate", "duration", "visualStyle"]
        }
      },
      dependencies: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            source: { type: "string" },
            target: { type: "string" },
            type: { type: "string" },
            origin: { type: "string" },
            confidence: { type: "number" },
            strength: { type: "string" }
          },
          required: ["id", "source", "target", "type", "origin", "confidence", "strength"]
        }
      },
      swimlanes: { type: "array" },
      risks: { type: "array" },
      regulatoryCheckpoints: { type: "array" }
    },
    required: ["generatedAt", "geminiVersion", "determinismSeed", "projectSummary", "statistics", "tasks", "dependencies"]
  };
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Checks if data has semantic (bimodal) structure
 * Used for backward compatibility detection
 * @param {any} data - Data to check
 * @returns {boolean} True if data has bimodal structure
 */
export function isSemanticData(data) {
  if (!data || !data.tasks || !Array.isArray(data.tasks)) {
    return false;
  }

  // Check if first task has 'origin' field (signature of semantic data)
  return data.tasks.length > 0 && data.tasks[0].origin !== undefined;
}

/**
 * Calculates data quality metrics from bimodal data
 * @param {Object} data - Validated bimodal data
 * @returns {Object} Quality metrics
 */
export function calculateDataQuality(data) {
  const tasks = data.tasks || [];
  const totalTasks = tasks.length;

  if (totalTasks === 0) {
    return {
      factRatio: 0,
      averageConfidence: 0,
      qualityScore: 0
    };
  }

  const explicitTasks = tasks.filter(t => t.origin === 'explicit').length;
  const totalConfidence = tasks.reduce((sum, t) => sum + t.confidence, 0);
  const averageConfidence = totalConfidence / totalTasks;
  const factRatio = explicitTasks / totalTasks;

  // Quality score: 60% weight on fact ratio, 40% on average confidence
  const qualityScore = (factRatio * 0.6) + (averageConfidence * 0.4);

  return {
    factRatio,
    averageConfidence,
    qualityScore,
    totalTasks,
    explicitTasks,
    inferredTasks: totalTasks - explicitTasks
  };
}

// Default export for convenience
export default BimodalGanttData;
