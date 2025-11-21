import { describe, it, expect } from '@jest/globals';
import { BimodalTaskSchema, BimodalGanttDataSchema, BimodalGanttData } from '../BimodalGanttSchema.js';
import { v4 as uuidv4 } from 'uuid';

describe('BimodalGanttSchema', () => {
  describe('BimodalTaskSchema', () => {
    it('should validate a complete valid task with explicit origin', () => {
      const validTask = {
        id: uuidv4(),
        name: 'Complete FDA 510(k) submission',
        origin: 'explicit',
        confidence: 0.85,
        duration: {
          value: 90,
          unit: 'days',
          confidence: 0.9,
          origin: 'explicit',
          sourceCitations: [{
            documentName: 'FDA_Guidelines.pdf',
            provider: 'INTERNAL',
            startChar: 1200,
            endChar: 1350,
            exactQuote: 'Standard review time is 90 days',
            retrievedAt: new Date().toISOString()
          }]
        },
        startDate: {
          value: new Date().toISOString(),
          confidence: 0.95,
          origin: 'explicit',
          sourceCitations: [{
            documentName: 'Project_Plan.md',
            provider: 'INTERNAL',
            startChar: 500,
            endChar: 650,
            exactQuote: 'Project starts on January 1, 2025',
            retrievedAt: new Date().toISOString()
          }]
        },
        dependencies: [uuidv4()],
        regulatoryRequirement: {
          isRequired: true,
          regulation: 'FDA 510(k)',
          confidence: 1.0,
          origin: 'explicit'
        }
      };

      const result = BimodalTaskSchema.safeParse(validTask);
      expect(result.success).toBe(true);
    });

    it('should validate a task with inference origin', () => {
      const inferenceTask = {
        id: uuidv4(),
        name: 'Internal team review',
        origin: 'inference',
        confidence: 0.65,
        duration: {
          value: 5,
          unit: 'days',
          confidence: 0.65,
          origin: 'inference',
          inferenceRationale: {
            reasoning: 'Based on typical team review cycles',
            supportingFacts: ['fact-1', 'fact-2'],
            llmProvider: 'GEMINI',
            temperature: 0.7
          }
        }
      };

      const result = BimodalTaskSchema.safeParse(inferenceTask);
      expect(result.success).toBe(true);
    });

    it('should reject task with invalid UUID', () => {
      const invalidTask = {
        id: 'not-a-uuid',
        name: 'Test Task',
        origin: 'explicit',
        confidence: 0.5,
        duration: {
          value: 10,
          unit: 'days',
          confidence: 0.5,
          origin: 'explicit'
        }
      };

      const result = BimodalTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });

    it('should reject task with confidence out of bounds', () => {
      const invalidTask = {
        id: uuidv4(),
        name: 'Test Task',
        origin: 'explicit',
        confidence: 1.5, // Invalid: > 1
        duration: {
          value: 10,
          unit: 'days',
          confidence: 0.5,
          origin: 'explicit'
        }
      };

      const result = BimodalTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });

    it('should reject task with negative duration', () => {
      const invalidTask = {
        id: uuidv4(),
        name: 'Test Task',
        origin: 'explicit',
        confidence: 0.5,
        duration: {
          value: -10, // Invalid: negative
          unit: 'days',
          confidence: 0.5,
          origin: 'explicit'
        }
      };

      const result = BimodalTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });

    it('should reject task with invalid duration unit', () => {
      const invalidTask = {
        id: uuidv4(),
        name: 'Test Task',
        origin: 'explicit',
        confidence: 0.5,
        duration: {
          value: 10,
          unit: 'years', // Invalid: not in enum
          confidence: 0.5,
          origin: 'explicit'
        }
      };

      const result = BimodalTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });

    it('should reject task with empty name', () => {
      const invalidTask = {
        id: uuidv4(),
        name: '', // Invalid: empty string
        origin: 'explicit',
        confidence: 0.5,
        duration: {
          value: 10,
          unit: 'days',
          confidence: 0.5,
          origin: 'explicit'
        }
      };

      const result = BimodalTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });

    it('should validate task with optional fields omitted', () => {
      const minimalTask = {
        id: uuidv4(),
        name: 'Minimal Task',
        origin: 'explicit',
        confidence: 0.5,
        duration: {
          value: 10,
          unit: 'days',
          confidence: 0.5,
          origin: 'explicit'
        }
      };

      const result = BimodalTaskSchema.safeParse(minimalTask);
      expect(result.success).toBe(true);
    });

    it('should validate task with validation metadata', () => {
      const taskWithMetadata = {
        id: uuidv4(),
        name: 'Task with Metadata',
        origin: 'explicit',
        confidence: 0.8,
        duration: {
          value: 15,
          unit: 'days',
          confidence: 0.8,
          origin: 'explicit'
        },
        validationMetadata: {
          claims: [
            { claimId: '1', text: 'Duration is 15 days' }
          ],
          citationCoverage: 0.85,
          contradictions: [],
          provenanceScore: 0.9,
          qualityGatesPassed: ['CITATION_COVERAGE', 'CONFIDENCE_MINIMUM']
        }
      };

      const result = BimodalTaskSchema.safeParse(taskWithMetadata);
      expect(result.success).toBe(true);
    });

    it('should reject invalid provider in source citation', () => {
      const invalidTask = {
        id: uuidv4(),
        name: 'Test Task',
        origin: 'explicit',
        confidence: 0.5,
        duration: {
          value: 10,
          unit: 'days',
          confidence: 0.5,
          origin: 'explicit',
          sourceCitations: [{
            documentName: 'test.pdf',
            provider: 'INVALID_PROVIDER', // Invalid: not in enum
            startChar: 100,
            endChar: 200,
            exactQuote: 'test quote',
            retrievedAt: new Date().toISOString()
          }]
        }
      };

      const result = BimodalTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });
  });

  describe('BimodalGanttDataSchema', () => {
    it('should validate complete gantt data', () => {
      const validGanttData = {
        id: uuidv4(),
        projectName: 'Test Project',
        tasks: [
          {
            id: uuidv4(),
            name: 'Task 1',
            origin: 'explicit',
            confidence: 0.8,
            duration: {
              value: 10,
              unit: 'days',
              confidence: 0.8,
              origin: 'explicit'
            }
          },
          {
            id: uuidv4(),
            name: 'Task 2',
            origin: 'inference',
            confidence: 0.6,
            duration: {
              value: 5,
              unit: 'days',
              confidence: 0.6,
              origin: 'inference',
              inferenceRationale: {
                reasoning: 'Estimated based on similar tasks',
                supportingFacts: ['fact1'],
                llmProvider: 'GEMINI'
              }
            }
          }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          validatedAt: new Date().toISOString(),
          totalTasks: 2,
          factRatio: 0.5,
          avgConfidence: 0.7
        }
      };

      const result = BimodalGanttDataSchema.safeParse(validGanttData);
      expect(result.success).toBe(true);
    });

    it('should reject gantt data with invalid task array', () => {
      const invalidGanttData = {
        id: uuidv4(),
        projectName: 'Test Project',
        tasks: [
          {
            id: 'invalid-uuid', // Invalid
            name: 'Task 1',
            origin: 'explicit',
            confidence: 0.8,
            duration: {
              value: 10,
              unit: 'days',
              confidence: 0.8,
              origin: 'explicit'
            }
          }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          totalTasks: 1,
          factRatio: 1.0,
          avgConfidence: 0.8
        }
      };

      const result = BimodalGanttDataSchema.safeParse(invalidGanttData);
      expect(result.success).toBe(false);
    });

    it('should reject gantt data with negative totalTasks', () => {
      const invalidGanttData = {
        id: uuidv4(),
        projectName: 'Test Project',
        tasks: [],
        metadata: {
          createdAt: new Date().toISOString(),
          totalTasks: -1, // Invalid
          factRatio: 0.0,
          avgConfidence: 0.0
        }
      };

      const result = BimodalGanttDataSchema.safeParse(invalidGanttData);
      expect(result.success).toBe(false);
    });

    it('should validate gantt data with optional validatedAt omitted', () => {
      const validGanttData = {
        id: uuidv4(),
        projectName: 'Test Project',
        tasks: [
          {
            id: uuidv4(),
            name: 'Task 1',
            origin: 'explicit',
            confidence: 0.8,
            duration: {
              value: 10,
              unit: 'days',
              confidence: 0.8,
              origin: 'explicit'
            }
          }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          // validatedAt omitted (optional)
          totalTasks: 1,
          factRatio: 1.0,
          avgConfidence: 0.8
        }
      };

      const result = BimodalGanttDataSchema.safeParse(validGanttData);
      expect(result.success).toBe(true);
    });
  });

  describe('BimodalGanttData helper', () => {
    it('should parse valid data using parse method', () => {
      const validGanttData = {
        id: uuidv4(),
        projectName: 'Test Project',
        tasks: [
          {
            id: uuidv4(),
            name: 'Task 1',
            origin: 'explicit',
            confidence: 0.8,
            duration: {
              value: 10,
              unit: 'days',
              confidence: 0.8,
              origin: 'explicit'
            }
          }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          totalTasks: 1,
          factRatio: 1.0,
          avgConfidence: 0.8
        }
      };

      expect(() => BimodalGanttData.parse(validGanttData)).not.toThrow();
    });

    it('should throw error for invalid data using parse method', () => {
      const invalidGanttData = {
        id: 'not-a-uuid',
        projectName: 'Test Project',
        tasks: [],
        metadata: {
          createdAt: new Date().toISOString(),
          totalTasks: 0, // Invalid: must be positive
          factRatio: 1.0,
          avgConfidence: 0.8
        }
      };

      expect(() => BimodalGanttData.parse(invalidGanttData)).toThrow();
    });

    it('should return success=false for invalid data using safeParse method', () => {
      const invalidGanttData = {
        id: 'not-a-uuid',
        projectName: 'Test Project',
        tasks: [],
        metadata: {
          createdAt: new Date().toISOString(),
          totalTasks: 0,
          factRatio: 1.0,
          avgConfidence: 0.8
        }
      };

      const result = BimodalGanttData.safeParse(invalidGanttData);
      expect(result.success).toBe(false);
    });
  });
});
