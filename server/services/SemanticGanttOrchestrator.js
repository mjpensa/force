/**
 * SemanticGanttOrchestrator - Master orchestrator for semantic gantt generation
 *
 * Integrates all validation, quality gate, and repair services into
 * a single end-to-end pipeline for generating validated gantt charts.
 *
 * Pipeline:
 * 1. Generate initial gantt data (from existing LLM or mock)
 * 2. Extract claims from all tasks
 * 3. Validate claims (citation, contradiction, provenance, confidence)
 * 4. Attach validation metadata to tasks
 * 5. Apply quality gates
 * 6. Attempt repairs if needed
 * 7. Final schema validation
 * 8. Store and return result
 */

import { ResearchValidationService } from './ResearchValidationService.js';
import { TaskClaimExtractor } from './TaskClaimExtractor.js';
import { QualityGateManager } from '../validation/QualityGateManager.js';
import { SemanticRepairEngine } from '../validation/SemanticRepairEngine.js';
import { BimodalGanttDataSchema } from '../schemas/BimodalGanttSchema.js';
import { v4 as uuidv4 } from 'uuid';

export class SemanticGanttOrchestrator {
  constructor(options = {}) {
    this.logger = options.logger || console;

    // Initialize all services
    this.researchValidator = new ResearchValidationService({
      logger: this.logger,
      minConfidenceThreshold: options.minConfidenceThreshold || 0.5,
      citationCoverageThreshold: options.citationCoverageThreshold || 0.75
    });

    this.taskClaimExtractor = new TaskClaimExtractor({ logger: this.logger });

    this.qualityGateManager = new QualityGateManager({
      logger: this.logger,
      citationCoverageThreshold: options.citationCoverageThreshold || 0.75,
      minConfidence: options.minConfidenceThreshold || 0.5
    });

    this.repairEngine = new SemanticRepairEngine({
      logger: this.logger,
      maxRepairAttempts: options.maxRepairAttempts || 3
    });

    // Job tracking
    this.jobs = new Map();
  }

  /**
   * Main entry point: Generate and validate semantic gantt chart
   * @param {string} userPrompt - User's project description
   * @param {Array} sourceDocuments - Source documents for validation
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Generated and validated gantt chart
   */
  async generateValidatedGanttChart(userPrompt, sourceDocuments, options = {}) {
    const jobId = options.jobId || uuidv4();

    this.jobs.set(jobId, {
      status: 'started',
      progress: 0,
      startedAt: new Date().toISOString()
    });

    try {
      // STEP 1: Generate initial gantt data (from existing LLM or mock)
      this.updateJob(jobId, { progress: 10, status: 'Generating initial gantt...' });
      const initialGanttData = await this.generateInitialGantt(userPrompt, sourceDocuments, options);

      // STEP 2: Extract claims from all tasks
      this.updateJob(jobId, { progress: 25, status: 'Extracting claims...' });
      const allClaims = [];
      for (const task of initialGanttData.tasks) {
        const claims = await this.taskClaimExtractor.extractClaims(task);
        allClaims.push(...claims);
      }

      // STEP 3: Run validation pipeline on each task
      this.updateJob(jobId, { progress: 40, status: 'Validating claims...' });
      const validatedTasks = [];

      for (const task of initialGanttData.tasks) {
        const validationResult = await this.researchValidator.validateTaskClaims(task, sourceDocuments);

        // Attach validation metadata to task
        task.validationMetadata = {
          claims: validationResult.claims,
          citationCoverage: validationResult.citationCoverage,
          contradictions: validationResult.contradictions,
          provenanceScore: validationResult.provenanceScore,
          qualityGatesPassed: [] // Will be populated after quality gate evaluation
        };

        // Update task confidence based on validation
        task.confidence = await this.calibrateTaskConfidence(task, validationResult);

        validatedTasks.push(task);
      }

      initialGanttData.tasks = validatedTasks;

      // Aggregate contradictions at gantt level
      const allContradictions = validatedTasks.flatMap(t => t.validationMetadata?.contradictions || []);

      initialGanttData.validationMetadata = {
        contradictions: allContradictions,
        totalClaims: allClaims.length,
        avgCitationCoverage: this.calculateAvgCitationCoverage(validatedTasks),
        avgProvenanceScore: this.calculateAvgProvenance(validatedTasks)
      };

      // STEP 4: Apply quality gates
      this.updateJob(jobId, { progress: 70, status: 'Applying quality gates...' });
      let ganttData = initialGanttData;
      const qualityGateResults = await this.qualityGateManager.evaluate(ganttData);

      // STEP 5: Attempt repairs if needed
      if (!qualityGateResults.passed) {
        this.updateJob(jobId, { progress: 80, status: 'Attempting repairs...' });

        const repairResult = await this.repairEngine.repair(
          ganttData,
          qualityGateResults.failures
        );

        ganttData = repairResult.data;
        ganttData.repairLog = repairResult.repairLog;

        // Re-evaluate after repairs
        const revalidation = await this.qualityGateManager.evaluate(ganttData);
        ganttData.finalQualityGates = revalidation;
      } else {
        ganttData.finalQualityGates = qualityGateResults;
      }

      // STEP 6: Final schema validation
      this.updateJob(jobId, { progress: 90, status: 'Final validation...' });
      const finalValidation = BimodalGanttDataSchema.safeParse(ganttData);

      if (!finalValidation.success) {
        throw new Error(`Schema validation failed: ${JSON.stringify(finalValidation.error.issues || finalValidation.error)}`);
      }

      // STEP 7: Store and complete
      this.updateJob(jobId, { progress: 100, status: 'Complete' });
      const chartId = await this.storeChart(ganttData, jobId);

      this.completeJob(jobId, chartId);

      return {
        chartId,
        jobId,
        data: ganttData, // Use original data, not parsed (to preserve extra fields)
        metadata: {
          qualityGates: ganttData.finalQualityGates,
          repairLog: ganttData.repairLog,
          validationSummary: {
            totalClaims: allClaims.length,
            avgCitationCoverage: ganttData.validationMetadata.avgCitationCoverage,
            avgProvenanceScore: ganttData.validationMetadata.avgProvenanceScore,
            contradictions: allContradictions.length
          }
        }
      };

    } catch (error) {
      this.logger.error(`Job ${jobId} failed:`, error);
      this.failJob(jobId, error.message);
      throw error;
    }
  }

  /**
   * Generate initial gantt data
   * This is a placeholder - in production, this would call your LLM-based generation
   */
  async generateInitialGantt(userPrompt, sourceDocuments, options) {
    const tasks = options.existingTasks || [];

    return {
      id: uuidv4(),
      projectName: options.projectName || 'Untitled Project',
      tasks: tasks,
      metadata: {
        createdAt: new Date().toISOString(),
        totalTasks: tasks.length,
        factRatio: 0,
        avgConfidence: 0
      },
      validationMetadata: {
        contradictions: []
      }
    };
  }

  /**
   * Calibrate task confidence based on validation results
   */
  async calibrateTaskConfidence(task, validationResult) {
    if (validationResult.claims.length === 0) {
      return task.confidence || 0.5;
    }

    // Average confidence across all claims
    const avgClaimConfidence = validationResult.claims.reduce(
      (sum, claim) => sum + (claim.confidence || 0),
      0
    ) / validationResult.claims.length;

    // Adjust based on citation coverage
    let adjustment = 0;
    if (validationResult.citationCoverage < 0.5) {
      adjustment -= 0.1;
    }

    // Adjust based on contradictions
    if (validationResult.contradictions.length > 0) {
      const highSeverity = validationResult.contradictions.filter(c => c.severity === 'high').length;
      adjustment -= highSeverity * 0.15;
    }

    // Adjust based on provenance
    if (validationResult.provenanceScore < 0.7) {
      adjustment -= 0.1;
    }

    const finalConfidence = Math.max(0, Math.min(1, avgClaimConfidence + adjustment));
    return finalConfidence;
  }

  /**
   * Calculate average citation coverage across tasks
   */
  calculateAvgCitationCoverage(tasks) {
    if (tasks.length === 0) return 0;

    const total = tasks.reduce((sum, t) =>
      sum + (t.validationMetadata?.citationCoverage || 0), 0
    );

    return total / tasks.length;
  }

  /**
   * Calculate average provenance score across tasks
   */
  calculateAvgProvenance(tasks) {
    if (tasks.length === 0) return 0;

    const total = tasks.reduce((sum, t) =>
      sum + (t.validationMetadata?.provenanceScore || 0), 0
    );

    return total / tasks.length;
  }

  /**
   * Store chart in database or file system
   */
  async storeChart(ganttData, jobId) {
    // Placeholder - implement based on your storage system
    const chartId = uuidv4();
    this.logger.info(`Stored chart ${chartId} for job ${jobId}`);
    return chartId;
  }

  /**
   * Update job status
   */
  updateJob(jobId, update) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, update, { updatedAt: new Date().toISOString() });
      this.logger.info(`Job ${jobId}: ${update.status} (${update.progress}%)`);
    }
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId, chartId) {
    this.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      chartId,
      completedAt: new Date().toISOString()
    });
  }

  /**
   * Mark job as failed
   */
  failJob(jobId, error) {
    this.updateJob(jobId, {
      status: 'failed',
      error,
      failedAt: new Date().toISOString()
    });
  }

  /**
   * Get job status
   */
  getJobStatus(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Validate existing gantt data (without generation)
   */
  async validateExistingGantt(ganttData, sourceDocuments) {
    const jobId = uuidv4();

    this.updateJob(jobId, { status: 'validating', progress: 0 });

    try {
      // Run quality gates
      const qualityGateResults = await this.qualityGateManager.evaluate(ganttData);

      this.updateJob(jobId, { status: 'completed', progress: 100 });

      return {
        jobId,
        qualityGates: qualityGateResults,
        passed: qualityGateResults.passed,
        failures: qualityGateResults.failures,
        warnings: qualityGateResults.warnings
      };

    } catch (error) {
      this.failJob(jobId, error.message);
      throw error;
    }
  }
}
