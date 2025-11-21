/**
 * BimodalDataAdapter - Converts Semantic (BimodalGanttData) to Standard Gantt Format
 *
 * Semantic charts generate BimodalGanttData with tasks/dependencies structure.
 * Standard Gantt renderer expects timeColumns/data arrays.
 * This adapter bridges the gap while preserving semantic metadata for the overlay.
 *
 * Usage:
 *   import { BimodalDataAdapter } from './BimodalDataAdapter.js';
 *   const adapter = new BimodalDataAdapter(bimodalData);
 *   const standardGantt = adapter.convert();
 */

export class BimodalDataAdapter {
  /**
   * Creates a new BimodalDataAdapter instance
   * @param {Object} bimodalData - The BimodalGanttData structure from semantic generation
   */
  constructor(bimodalData) {
    this.bimodalData = bimodalData;
    this.dateRange = null;
    this.timeColumns = [];
    this.taskMap = new Map(); // Map task IDs to converted tasks
  }

  /**
   * Main conversion method - transforms BimodalGanttData to Standard Gantt format
   * @returns {Object} Standard Gantt chart data structure
   */
  convert() {
    console.log('[BimodalAdapter] Converting BimodalGanttData to Standard Gantt format');
    console.log('[BimodalAdapter] Input tasks:', this.bimodalData.tasks?.length || 0);

    // Step 1: Calculate date range from all tasks
    this.dateRange = this._calculateDateRange();
    console.log('[BimodalAdapter] Date range:', this.dateRange);

    // Step 2: Generate time columns based on date range
    this.timeColumns = this._generateTimeColumns();
    console.log('[BimodalAdapter] Generated', this.timeColumns.length, 'time columns');

    // Step 3: Convert tasks to standard format
    const data = this._convertTasks();
    console.log('[BimodalAdapter] Converted', data.length, 'task rows');

    // Step 4: Generate title and legend
    const title = this.bimodalData.projectSummary?.name || 'Semantic Roadmap';
    const legend = this._generateLegend();

    // Step 5: Build standard structure while preserving semantic data
    const standardGantt = {
      title,
      timeColumns: this.timeColumns,
      data,
      legend,

      // Preserve semantic metadata for BimodalGanttController
      tasks: this.bimodalData.tasks,
      dependencies: this.bimodalData.dependencies,
      projectSummary: this.bimodalData.projectSummary,
      statistics: this.bimodalData.statistics,
      generatedAt: this.bimodalData.generatedAt,
      determinismSeed: this.bimodalData.determinismSeed,
      confidenceAnalysis: this.bimodalData.confidenceAnalysis,
      risks: this.bimodalData.risks,
      regulatoryCheckpoints: this.bimodalData.regulatoryCheckpoints,
      swimlanes: this.bimodalData.swimlanes
    };

    console.log('[BimodalAdapter] ✅ Conversion complete');
    return standardGantt;
  }

  /**
   * Calculates the overall date range from all tasks
   * @returns {Object} { start: Date, end: Date, durationDays: number }
   * @private
   */
  _calculateDateRange() {
    const tasks = this.bimodalData.tasks || [];

    if (tasks.length === 0) {
      // Fallback: use current date + 1 year
      const now = new Date();
      const oneYearLater = new Date(now);
      oneYearLater.setFullYear(now.getFullYear() + 1);

      return {
        start: now,
        end: oneYearLater,
        durationDays: 365
      };
    }

    let minDate = null;
    let maxDate = null;

    tasks.forEach(task => {
      // Extract date values (handle both BimodalDate objects and plain strings)
      const startDateValue = task.startDate?.value || task.startDate;
      const endDateValue = task.endDate?.value || task.endDate;

      if (startDateValue) {
        const startDate = new Date(startDateValue);
        if (!minDate || startDate < minDate) {
          minDate = startDate;
        }
      }

      if (endDateValue) {
        const endDate = new Date(endDateValue);
        if (!maxDate || endDate > maxDate) {
          maxDate = endDate;
        }
      }
    });

    // Add padding (10% on each side)
    if (minDate && maxDate) {
      const rangeDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
      const padding = Math.max(30, rangeDays * 0.1); // At least 30 days padding

      minDate.setDate(minDate.getDate() - padding);
      maxDate.setDate(maxDate.getDate() + padding);

      return {
        start: minDate,
        end: maxDate,
        durationDays: (maxDate - minDate) / (1000 * 60 * 60 * 24)
      };
    }

    // Fallback if no valid dates found
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(now.getFullYear() + 1);

    return {
      start: now,
      end: oneYearLater,
      durationDays: 365
    };
  }

  /**
   * Generates time column headers based on date range
   * Uses quarters for long projects, months for medium, weeks for short
   * @returns {string[]} Array of column labels (e.g., ["Q1 2025", "Q2 2025"])
   * @private
   */
  _generateTimeColumns() {
    const { start, end, durationDays } = this.dateRange;

    // Determine granularity based on project duration
    if (durationDays > 365 * 2) {
      // Long project (>2 years): Use quarters
      return this._generateQuarterColumns(start, end);
    } else if (durationDays > 180) {
      // Medium project (6 months - 2 years): Use months
      return this._generateMonthColumns(start, end);
    } else {
      // Short project (<6 months): Use weeks
      return this._generateWeekColumns(start, end);
    }
  }

  /**
   * Generates quarterly time columns
   * @private
   */
  _generateQuarterColumns(start, end) {
    const columns = [];
    const current = new Date(start);

    while (current <= end) {
      const year = current.getFullYear();
      const quarter = Math.floor(current.getMonth() / 3) + 1;
      columns.push(`Q${quarter} ${year}`);

      // Move to next quarter
      current.setMonth(current.getMonth() + 3);
    }

    return columns;
  }

  /**
   * Generates monthly time columns
   * @private
   */
  _generateMonthColumns(start, end) {
    const columns = [];
    const current = new Date(start);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    while (current <= end) {
      const year = current.getFullYear();
      const month = monthNames[current.getMonth()];
      columns.push(`${month} ${year}`);

      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }

    return columns;
  }

  /**
   * Generates weekly time columns
   * @private
   */
  _generateWeekColumns(start, end) {
    const columns = [];
    const current = new Date(start);
    let weekNum = 1;

    while (current <= end) {
      const month = current.toLocaleDateString('en-US', { month: 'short' });
      const day = current.getDate();
      columns.push(`Week ${weekNum} (${month} ${day})`);

      weekNum++;
      current.setDate(current.getDate() + 7);
    }

    return columns;
  }

  /**
   * Converts BimodalTask array to standard task data rows
   * @returns {Array} Standard task row objects
   * @private
   */
  _convertTasks() {
    const tasks = this.bimodalData.tasks || [];
    const swimlanes = this.bimodalData.swimlanes || [];
    const data = [];

    // First, add swimlane rows if they exist
    swimlanes.forEach(swimlane => {
      data.push({
        name: swimlane.name,
        entity: '',
        startCol: 0,
        endCol: 0,
        startDate: '',
        endDate: '',
        color: 'mid-grey',
        isSwimlane: true,
        description: `Confidence: ${Math.round((swimlane.confidence || 0) * 100)}%`,
        _semanticId: swimlane.id,
        _origin: swimlane.origin
      });

      // Add tasks belonging to this swimlane
      const swimlaneTasks = tasks.filter(t => swimlane.taskIds.includes(t.id));
      swimlaneTasks.forEach(task => {
        data.push(this._convertTask(task));
      });
    });

    // Add tasks not in any swimlane
    const tasksInSwimlanes = new Set(
      swimlanes.flatMap(s => s.taskIds)
    );

    const unassignedTasks = tasks.filter(t => !tasksInSwimlanes.has(t.id));
    unassignedTasks.forEach(task => {
      data.push(this._convertTask(task));
    });

    return data;
  }

  /**
   * Converts a single BimodalTask to standard task row format
   * @param {Object} task - BimodalTask object
   * @returns {Object} Standard task row
   * @private
   */
  _convertTask(task) {
    // Extract dates (handle BimodalDate structure)
    const startDateValue = task.startDate?.value || task.startDate;
    const endDateValue = task.endDate?.value || task.endDate;

    // Calculate column positions
    const startCol = this._dateToColumn(startDateValue);
    const endCol = this._dateToColumn(endDateValue);

    // Determine color based on origin and confidence
    const color = this._getTaskColor(task);

    // Build description with semantic info
    const description = this._buildTaskDescription(task);

    // Get entity/resource info
    const entity = this._getTaskEntity(task);

    return {
      name: task.name,
      entity,
      startCol,
      endCol,
      startDate: startDateValue || '',
      endDate: endDateValue || '',
      color,
      isSwimlane: false,
      description,

      // Preserve semantic metadata for BimodalGanttController
      _semanticId: task.id,
      _origin: task.origin,
      _confidence: task.confidence,
      _sourceCitations: task.sourceCitations,
      _inferenceRationale: task.inferenceRationale,
      _bankingEnhancements: task.bankingEnhancements
    };
  }

  /**
   * Converts a date string to column index
   * @param {string} dateValue - ISO date string
   * @returns {number} Column index (0-based)
   * @private
   */
  _dateToColumn(dateValue) {
    if (!dateValue) return 0;

    const date = new Date(dateValue);
    const { start, durationDays } = this.dateRange;

    // Calculate position as percentage of total range
    const daysSinceStart = (date - start) / (1000 * 60 * 60 * 24);
    const percentageOfRange = daysSinceStart / durationDays;

    // Map to column index
    const columnIndex = Math.floor(percentageOfRange * this.timeColumns.length);

    // Clamp to valid range
    return Math.max(0, Math.min(columnIndex, this.timeColumns.length - 1));
  }

  /**
   * Determines task bar color based on origin and confidence
   * @param {Object} task - BimodalTask object
   * @returns {string} Color class name
   * @private
   */
  _getTaskColor(task) {
    // Explicit facts: Green shades
    if (task.origin === 'explicit') {
      return 'dark-blue'; // Solid color for facts
    }

    // Inferences: Blue shades based on confidence
    const confidence = task.confidence || 0;

    if (confidence >= 0.9) {
      return 'priority-red'; // High confidence inference
    } else if (confidence >= 0.8) {
      return 'medium-red'; // Medium-high confidence
    } else if (confidence >= 0.7) {
      return 'mid-grey'; // Medium confidence
    } else {
      return 'light-grey'; // Low confidence
    }
  }

  /**
   * Builds task description with semantic metadata
   * @param {Object} task - BimodalTask object
   * @returns {string} Description text
   * @private
   */
  _buildTaskDescription(task) {
    const parts = [];

    // Origin and confidence
    if (task.origin === 'explicit') {
      parts.push(`✓ Explicit Fact (100% confidence)`);
    } else {
      const confidencePct = Math.round((task.confidence || 0) * 100);
      parts.push(`⚡ AI Inference (${confidencePct}% confidence)`);
    }

    // Inference method if available
    if (task.inferenceRationale?.method) {
      const methodLabels = {
        'temporal_logic': 'Temporal Logic',
        'industry_standard': 'Industry Standard',
        'dependency_chain': 'Dependency Chain',
        'regulatory_pattern': 'Regulatory Pattern',
        'resource_constraint': 'Resource Constraint',
        'buffer_padding': 'Buffer Padding'
      };
      const methodLabel = methodLabels[task.inferenceRationale.method] || task.inferenceRationale.method;
      parts.push(`Method: ${methodLabel}`);
    }

    // Banking enhancements if present
    if (task.bankingEnhancements?.hasRegulatoryFlag) {
      parts.push(`🏛️ Regulatory: ${task.bankingEnhancements.regulatorName}`);
    }

    return parts.join(' | ');
  }

  /**
   * Extracts entity/resource info from task
   * @param {Object} task - BimodalTask object
   * @returns {string} Entity name
   * @private
   */
  _getTaskEntity(task) {
    if (task.resources && task.resources.length > 0) {
      return task.resources.map(r => r.name).join(', ');
    }
    return '';
  }

  /**
   * Generates legend array based on semantic data
   * @returns {Array} Legend items
   * @private
   */
  _generateLegend() {
    const stats = this.bimodalData.statistics || {};

    return [
      {
        color: 'dark-blue',
        label: `Explicit Facts (${stats.explicitTasks || 0})`,
        description: 'Directly stated in source documents'
      },
      {
        color: 'priority-red',
        label: `High Confidence (90%+)`,
        description: 'AI inferences with high certainty'
      },
      {
        color: 'medium-red',
        label: `Medium Confidence (80-89%)`,
        description: 'AI inferences with moderate certainty'
      },
      {
        color: 'mid-grey',
        label: `Lower Confidence (70-79%)`,
        description: 'AI inferences requiring validation'
      }
    ];
  }

  /**
   * Static helper: Detects if data is BimodalGanttData
   * @param {Object} data - Data to check
   * @returns {boolean} True if bimodal/semantic structure
   */
  static isBimodal(data) {
    return !!(
      data &&
      Array.isArray(data.tasks) &&
      (data.generatedAt || data.determinismSeed !== undefined)
    );
  }

  /**
   * Static helper: Converts bimodal data if needed, otherwise returns as-is
   * @param {Object} data - Chart data (bimodal or standard)
   * @returns {Object} Standard Gantt format
   */
  static ensureStandardFormat(data) {
    if (BimodalDataAdapter.isBimodal(data)) {
      console.log('[BimodalAdapter] Converting bimodal data to standard format');
      const adapter = new BimodalDataAdapter(data);
      return adapter.convert();
    }

    console.log('[BimodalAdapter] Data is already in standard format');
    return data;
  }
}

export default BimodalDataAdapter;
