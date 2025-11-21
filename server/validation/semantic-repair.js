/**
 * Semantic Data Validator with Soft Repair Strategy
 *
 * Multi-pass validation that NEVER throws errors - instead applies intelligent repairs:
 * 1. Structure validation (ensure all required fields exist)
 * 2. Citation repair (downgrade explicit→inferred if missing quotes)
 * 3. Confidence normalization (explicit=1.0, inferred<1.0)
 * 4. Dependency integrity (remove orphaned dependencies)
 * 5. Banking-specific validation (regulatory flags)
 * 6. Emergency repair (minimal viable structure as last resort)
 */

import { validateBimodalData, BimodalGanttData } from '../../types/SemanticGanttData.js';
import { ZodError } from 'zod';

// ═══════════════════════════════════════════════════════════
// SEMANTIC DATA VALIDATOR CLASS
// ═══════════════════════════════════════════════════════════

export class SemanticDataValidator {
  constructor() {
    this.repairLog = [];
    this.validationStats = {
      totalRepairs: 0,
      downgradedFacts: 0,
      addedDefaults: 0,
      removedOrphans: 0,
      bankingFlagsAdded: 0
    };
  }

  /**
   * Main validation and repair function
   * Implements multi-pass repair strategy - NEVER throws
   * @param {any} rawData - Unvalidated data from AI
   * @returns {Promise<Object>} Validation result with repaired data
   */
  async validateAndRepair(rawData) {
    console.log('[Validator] Starting validation and repair process...');
    this.repairLog = [];
    this.validationStats = {
      totalRepairs: 0,
      downgradedFacts: 0,
      addedDefaults: 0,
      removedOrphans: 0,
      bankingFlagsAdded: 0
    };

    try {
      // Pass 1: Ensure basic structure
      let data = this.ensureStructure(rawData);

      // Pass 2: Repair citations
      data = this.repairCitations(data);

      // Pass 3: Normalize confidence scores
      data = this.normalizeConfidences(data);

      // Pass 4: Validate dependencies
      data = this.validateDependencies(data);

      // Pass 5: Apply banking rules
      data = await this.validateBankingRequirements(data);

      // Pass 6: Calculate statistics
      data = this.calculateStatistics(data);

      // Final validation against Zod schema
      const result = validateBimodalData(data);

      if (result.success) {
        this.logRepairSummary();
        return {
          success: true,
          data: result.data,
          repairs: this.repairLog,
          stats: this.validationStats
        };
      } else {
        console.warn('[Validator] Schema validation failed, applying emergency repairs...');
        return this.emergencyRepair(data, result.errors);
      }

    } catch (error) {
      console.error('[Validator] Critical error during validation:', error);
      return this.emergencyRepair(rawData, [{ message: error.message }]);
    }
  }

  /**
   * PASS 1: Ensure basic structure exists
   * Adds default values for missing required fields
   */
  ensureStructure(data) {
    console.log('[Validator] Pass 1: Ensuring structure...');

    const repaired = {
      generatedAt: data.generatedAt || new Date().toISOString(),
      geminiVersion: data.geminiVersion || 'gemini-2.5-flash-preview',
      determinismSeed: data.determinismSeed || Date.now(),

      projectSummary: data.projectSummary || {
        name: 'Untitled Project',
        description: 'No description provided',
        origin: 'inferred',
        confidence: 0.5
      },

      statistics: data.statistics || {},

      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
      swimlanes: Array.isArray(data.swimlanes) ? data.swimlanes : [],
      risks: Array.isArray(data.risks) ? data.risks : [],
      regulatoryCheckpoints: Array.isArray(data.regulatoryCheckpoints) ? data.regulatoryCheckpoints : [],

      confidenceAnalysis: data.confidenceAnalysis || null
    };

    if (!data.generatedAt || !data.geminiVersion || !data.projectSummary) {
      this.addRepairLog('STRUCTURE_DEFAULTS', null, 'Added missing metadata fields');
      this.validationStats.addedDefaults++;
    }

    return repaired;
  }

  /**
   * PASS 2: Repair citation issues
   * Downgrades explicit→inferred if citations are missing
   */
  repairCitations(data) {
    console.log('[Validator] Pass 2: Repairing citations...');

    data.tasks = data.tasks.map(task => {
      // Check if explicit task has citations
      if (task.origin === 'explicit' && (!task.sourceCitations || task.sourceCitations.length === 0)) {
        this.addRepairLog(
          'DOWNGRADE_TO_INFERENCE',
          task.id,
          `Missing citation for explicit fact "${task.name}"`,
          'Downgraded to high-confidence inference'
        );

        this.validationStats.downgradedFacts++;

        // Downgrade to inference with high confidence
        return {
          ...task,
          origin: 'inferred',
          confidence: 0.85,
          inferenceRationale: {
            method: 'temporal_logic',
            explanation: 'Originally marked as explicit but lacking citation. High confidence due to initial classification.',
            supportingFacts: [],
            confidence: 0.85
          },
          sourceCitations: undefined
        };
      }

      // Validate citation format if present
      if (task.sourceCitations && task.sourceCitations.length > 0) {
        task.sourceCitations = task.sourceCitations.map(citation => {
          if (!citation.exactQuote) {
            citation.exactQuote = '[Citation missing - requires manual extraction]';
            this.addRepairLog(
              'CITATION_REPAIR',
              task.id,
              'Missing exactQuote in citation',
              'Placeholder added'
            );
          }
          if (citation.documentName === undefined) {
            citation.documentName = 'Unknown Document';
          }
          if (citation.paragraphIndex === undefined) {
            citation.paragraphIndex = 0;
          }
          if (citation.startChar === undefined) {
            citation.startChar = 0;
          }
          if (citation.endChar === undefined) {
            citation.endChar = 0;
          }
          return citation;
        });
      }

      // Ensure dates have proper structure
      if (task.startDate && typeof task.startDate === 'string') {
        task.startDate = {
          value: task.startDate,
          origin: task.origin || 'inferred',
          confidence: task.confidence || 0.7
        };
      }

      if (task.endDate && typeof task.endDate === 'string') {
        task.endDate = {
          value: task.endDate,
          origin: task.origin || 'inferred',
          confidence: task.confidence || 0.7
        };
      }

      // Ensure duration exists
      if (!task.duration) {
        task.duration = {
          value: 1,
          unit: 'weeks',
          origin: 'inferred',
          confidence: 0.5
        };
      }

      // Ensure visual style exists
      if (!task.visualStyle) {
        const opacity = task.origin === 'explicit' ? 1.0 : (0.3 + (task.confidence * 0.7));
        task.visualStyle = {
          color: task.origin === 'explicit' ? '#2E7D32' : '#1976D2',
          borderStyle: task.origin === 'explicit' ? 'solid' : 'dashed',
          opacity
        };
      }

      // Ensure resources array exists
      if (!task.resources) {
        task.resources = [];
      }

      return task;
    });

    return data;
  }

  /**
   * PASS 3: Normalize confidence scores
   * Ensures explicit=1.0, inferred<1.0
   */
  normalizeConfidences(data) {
    console.log('[Validator] Pass 3: Normalizing confidences...');

    data.tasks = data.tasks.map(task => {
      // Explicit tasks must have 1.0 confidence
      if (task.origin === 'explicit' && task.confidence !== 1.0) {
        this.addRepairLog(
          'CONFIDENCE_CORRECTION',
          task.id,
          `Explicit task had confidence ${task.confidence}`,
          'Corrected to 1.0'
        );
        task.confidence = 1.0;
      }

      // Inferred tasks cannot have 1.0 confidence
      if (task.origin === 'inferred' && task.confidence === 1.0) {
        this.addRepairLog(
          'CONFIDENCE_CAP',
          task.id,
          'Inference had 100% confidence',
          'Capped at 0.95'
        );
        task.confidence = 0.95;
      }

      // Ensure minimum confidence
      if (task.origin === 'inferred' && task.confidence < 0.3) {
        this.addRepairLog(
          'CONFIDENCE_FLOOR',
          task.id,
          `Low confidence ${task.confidence}`,
          'Raised to 0.3 minimum'
        );
        task.confidence = 0.3;
      }

      // Normalize nested confidence scores (dates, durations)
      if (task.startDate) {
        task.startDate = this.normalizeNestedConfidence(task.startDate, task.origin);
      }
      if (task.endDate) {
        task.endDate = this.normalizeNestedConfidence(task.endDate, task.origin);
      }
      if (task.duration) {
        task.duration = this.normalizeNestedConfidence(task.duration, task.origin);
      }

      return task;
    });

    // Apply same logic to dependencies
    data.dependencies = data.dependencies.map(dep => {
      if (dep.origin === 'explicit' && dep.confidence !== 1.0) {
        dep.confidence = 1.0;
      } else if (dep.origin === 'inferred' && dep.confidence === 1.0) {
        dep.confidence = 0.9;
      }

      // Ensure strength is set
      if (!dep.strength) {
        dep.strength = dep.origin === 'explicit' ? 'mandatory' : 'moderate';
      }

      // Ensure type is set
      if (!dep.type) {
        dep.type = 'finish-to-start';
      }

      return dep;
    });

    return data;
  }

  /**
   * Helper: Normalize confidence in nested objects (dates, durations)
   */
  normalizeNestedConfidence(obj, parentOrigin) {
    if (!obj || typeof obj !== 'object') return obj;

    if (!obj.origin) {
      obj.origin = parentOrigin;
    }

    if (!obj.confidence) {
      obj.confidence = obj.origin === 'explicit' ? 1.0 : 0.7;
    }

    if (obj.origin === 'explicit' && obj.confidence !== 1.0) {
      obj.confidence = 1.0;
    } else if (obj.origin === 'inferred' && obj.confidence === 1.0) {
      obj.confidence = 0.95;
    }

    return obj;
  }

  /**
   * PASS 4: Validate dependency integrity
   * Removes orphaned dependencies, checks for circular references
   */
  validateDependencies(data) {
    console.log('[Validator] Pass 4: Validating dependencies...');

    const taskIds = new Set(data.tasks.map(t => t.id));

    // Filter out dependencies referencing non-existent tasks
    const validDependencies = data.dependencies.filter(dep => {
      if (!taskIds.has(dep.source) || !taskIds.has(dep.target)) {
        this.addRepairLog(
          'DEPENDENCY_REMOVED',
          dep.id,
          `References missing task (${dep.source} → ${dep.target})`,
          'Removed'
        );
        this.validationStats.removedOrphans++;
        return false;
      }

      // Prevent self-dependencies
      if (dep.source === dep.target) {
        this.addRepairLog(
          'SELF_DEPENDENCY',
          dep.id,
          `Task depends on itself (${dep.source})`,
          'Removed'
        );
        return false;
      }

      return true;
    });

    data.dependencies = validDependencies;

    // Detect orphan tasks (no dependencies)
    const connectedTasks = new Set();
    data.dependencies.forEach(dep => {
      connectedTasks.add(dep.source);
      connectedTasks.add(dep.target);
    });

    const orphanTasks = data.tasks.filter(t => !connectedTasks.has(t.id));
    if (orphanTasks.length > 0 && data.tasks.length > 1) {
      this.addRepairLog(
        'ORPHAN_TASKS_DETECTED',
        null,
        `${orphanTasks.length} tasks without dependencies`,
        'May need manual connection'
      );
    }

    return data;
  }

  /**
   * PASS 5: Apply banking-specific validation
   * Detects regulatory keywords, applies domain rules
   */
  async validateBankingRequirements(data) {
    console.log('[Validator] Pass 5: Applying banking rules...');

    const { applyBankingRules } = await import('../banking-semantic-rules.js');

    data.tasks = data.tasks.map(task => {
      const enhanced = applyBankingRules(task);

      if (enhanced.bankingEnhancements) {
        this.validationStats.bankingFlagsAdded++;
      }

      return enhanced;
    });

    return data;
  }

  /**
   * PASS 6: Calculate statistics
   * Ensures accurate metadata about the dataset
   */
  calculateStatistics(data) {
    console.log('[Validator] Pass 6: Calculating statistics...');

    const tasks = data.tasks || [];
    const totalTasks = tasks.length;
    const explicitTasks = tasks.filter(t => t.origin === 'explicit').length;
    const inferredTasks = tasks.filter(t => t.origin === 'inferred').length;

    const avgConfidence = totalTasks > 0
      ? tasks.reduce((sum, t) => sum + (t.confidence || 0), 0) / totalTasks
      : 0;

    const dataQualityScore = totalTasks > 0 ? explicitTasks / totalTasks : 0;

    data.statistics = {
      totalTasks,
      explicitTasks,
      inferredTasks,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      dataQualityScore: Math.round(dataQualityScore * 100) / 100
    };

    // Calculate confidence distribution
    const distribution = {
      '1.0': 0,
      '0.9-0.99': 0,
      '0.8-0.89': 0,
      '0.7-0.79': 0,
      '0.6-0.69': 0,
      '< 0.6': 0
    };

    tasks.forEach(task => {
      const conf = task.confidence;
      if (conf === 1.0) distribution['1.0']++;
      else if (conf >= 0.9) distribution['0.9-0.99']++;
      else if (conf >= 0.8) distribution['0.8-0.89']++;
      else if (conf >= 0.7) distribution['0.7-0.79']++;
      else if (conf >= 0.6) distribution['0.6-0.69']++;
      else distribution['< 0.6']++;
    });

    const weakestLinks = tasks
      .filter(t => t.confidence < 0.8)
      .sort((a, b) => a.confidence - b.confidence)
      .slice(0, 5)
      .map(task => ({
        taskId: task.id,
        taskName: task.name,
        confidence: task.confidence,
        reason: task.inferenceRationale?.method || 'unknown'
      }));

    data.confidenceAnalysis = {
      distribution: Object.entries(distribution).map(([range, count]) => ({
        range,
        count,
        percentage: totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0
      })),
      weakestLinks
    };

    return data;
  }

  /**
   * EMERGENCY REPAIR: Last resort to create minimal valid structure
   * Used when validation fails even after all repair passes
   */
  emergencyRepair(data, errors) {
    console.warn('[Validator] EMERGENCY REPAIR TRIGGERED');
    console.warn('[Validator] Errors:', errors);

    this.addRepairLog(
      'EMERGENCY_REPAIR',
      null,
      `Validation failed with ${errors.length} errors`,
      'Creating minimal valid structure'
    );

    const emergencyData = {
      generatedAt: new Date().toISOString(),
      geminiVersion: 'gemini-2.5-flash-preview',
      determinismSeed: Date.now(),

      projectSummary: {
        name: data.projectSummary?.name || 'Emergency Repair - Partial Data',
        description: data.projectSummary?.description || 'Data validation failed, minimal structure created',
        origin: 'inferred',
        confidence: 0.3
      },

      statistics: {
        totalTasks: 0,
        explicitTasks: 0,
        inferredTasks: 0,
        averageConfidence: 0.3,
        dataQualityScore: 0
      },

      tasks: [],
      dependencies: [],
      swimlanes: [],
      risks: [],
      regulatoryCheckpoints: [],

      confidenceAnalysis: {
        distribution: [],
        weakestLinks: []
      }
    };

    // Try to salvage some tasks
    if (data.tasks && Array.isArray(data.tasks)) {
      emergencyData.tasks = data.tasks.slice(0, 10).map((task, idx) => ({
        id: task.id || `EMERGENCY-${idx}`,
        name: task.name || `Task ${idx + 1}`,
        origin: 'inferred',
        confidence: 0.5,
        startDate: {
          value: new Date().toISOString(),
          origin: 'inferred',
          confidence: 0.5
        },
        endDate: {
          value: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          origin: 'inferred',
          confidence: 0.5
        },
        duration: {
          value: 7,
          unit: 'days',
          origin: 'inferred',
          confidence: 0.5
        },
        resources: [],
        visualStyle: {
          color: '#999999',
          borderStyle: 'dotted',
          opacity: 0.5
        }
      }));

      emergencyData.statistics.totalTasks = emergencyData.tasks.length;
      emergencyData.statistics.inferredTasks = emergencyData.tasks.length;
    }

    return {
      success: true,
      data: emergencyData,
      repairs: this.repairLog,
      stats: this.validationStats,
      emergency: true,
      originalErrors: errors
    };
  }

  /**
   * Helper: Add entry to repair log
   */
  addRepairLog(type, itemId, reason, action) {
    this.repairLog.push({
      type,
      itemId,
      reason,
      action,
      timestamp: new Date().toISOString()
    });
    this.validationStats.totalRepairs++;
  }

  /**
   * Log repair summary to console
   */
  logRepairSummary() {
    console.log('═════════════════════════════════════════════════════');
    console.log('  SEMANTIC VALIDATION SUMMARY');
    console.log('═════════════════════════════════════════════════════');
    console.log(`Total repairs:         ${this.validationStats.totalRepairs}`);
    console.log(`Downgraded facts:      ${this.validationStats.downgradedFacts}`);
    console.log(`Defaults added:        ${this.validationStats.addedDefaults}`);
    console.log(`Orphans removed:       ${this.validationStats.removedOrphans}`);
    console.log(`Banking flags added:   ${this.validationStats.bankingFlagsAdded}`);
    console.log(`Repair log entries:    ${this.repairLog.length}`);

    if (this.repairLog.length > 0) {
      console.log('\nRecent repairs (last 5):');
      this.repairLog.slice(-5).forEach((repair, idx) => {
        console.log(`  ${idx + 1}. [${repair.type}] ${repair.reason || repair.action}`);
      });
    }
    console.log('═════════════════════════════════════════════════════');
  }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════

export const semanticValidator = new SemanticDataValidator();

// Default export
export default SemanticDataValidator;
