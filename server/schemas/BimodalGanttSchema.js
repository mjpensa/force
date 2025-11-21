import { z } from 'zod';

// Task Origin Types
const OriginSchema = z.enum(['explicit', 'inference']);

// Confidence Score
const ConfidenceSchema = z.object({
  score: z.number().min(0).max(1),
  factors: z.array(z.string()).optional(),
  calibrationMethod: z.string().optional()
});

// Source Citation
const SourceCitationSchema = z.object({
  documentName: z.string(),
  provider: z.enum(['GEMINI', 'CLAUDE', 'OPENAI', 'INTERNAL']),
  startChar: z.number().int().positive(),
  endChar: z.number().int().positive(),
  exactQuote: z.string(),
  retrievedAt: z.string().datetime()
});

// Inference Rationale
const InferenceRationaleSchema = z.object({
  reasoning: z.string(),
  supportingFacts: z.array(z.string()),
  llmProvider: z.string(),
  temperature: z.number().min(0).max(2).optional()
});

// Duration
const DurationSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(['hours', 'days', 'weeks', 'months']),
  confidence: z.number().min(0).max(1),
  origin: OriginSchema,
  sourceCitations: z.array(SourceCitationSchema).optional(),
  inferenceRationale: InferenceRationaleSchema.optional()
});

// Regulatory Requirement
const RegulatoryRequirementSchema = z.object({
  isRequired: z.boolean(),
  regulation: z.string().optional(),
  confidence: z.number().min(0).max(1),
  origin: OriginSchema,
  sourceCitations: z.array(SourceCitationSchema).optional()
});

// Main BimodalTask Schema
export const BimodalTaskSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  origin: OriginSchema,
  confidence: z.number().min(0).max(1),
  duration: DurationSchema,
  startDate: z.object({
    value: z.string().datetime(),
    confidence: z.number().min(0).max(1),
    origin: OriginSchema,
    sourceCitations: z.array(SourceCitationSchema).optional()
  }).optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  regulatoryRequirement: RegulatoryRequirementSchema.optional(),
  validationMetadata: z.object({
    claims: z.array(z.any()),
    citationCoverage: z.number().min(0).max(1),
    contradictions: z.array(z.any()),
    provenanceScore: z.number().min(0).max(1),
    qualityGatesPassed: z.array(z.string())
  }).optional()
});

// BimodalGanttData
export const BimodalGanttDataSchema = z.object({
  id: z.string().uuid(),
  projectName: z.string(),
  tasks: z.array(BimodalTaskSchema),
  metadata: z.object({
    createdAt: z.string().datetime(),
    validatedAt: z.string().datetime().optional(),
    totalTasks: z.number().int().positive(),
    factRatio: z.number().min(0).max(1),
    avgConfidence: z.number().min(0).max(1)
  })
});

export const BimodalGanttData = {
  parse: (data) => BimodalGanttDataSchema.parse(data),
  safeParse: (data) => BimodalGanttDataSchema.safeParse(data)
};
