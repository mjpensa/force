/**
 * BimodalGanttController - Semantic Overlay Frontend Controller
 * Phase 3: Frontend Components for Bimodal (Fact/Inference) Chart Rendering
 *
 * Features:
 * - Toggle between "Facts Only" and "AI Insights" modes
 * - Confidence threshold slider (filter by minimum confidence)
 * - Dependency chain management (preserve/bridge/break modes)
 * - Visual styling based on confidence levels
 * - Provenance tooltips with source citations
 *
 * Usage:
 *   const controller = new BimodalGanttController(ganttData, chartWrapper);
 *   controller.initialize();
 */

import { CONFIG } from './config.js';
import { GanttChart } from './GanttChart.js';

/**
 * BimodalGanttController Class
 * Manages the semantic overlay UI and data filtering for bimodal Gantt charts
 */
export class BimodalGanttController {
  /**
   * Creates a new BimodalGanttController instance
   * @param {Object} ganttData - The complete bimodal Gantt data structure
   * @param {HTMLElement} container - The DOM element to render controls into
   * @param {GanttChart} chartInstance - Reference to the GanttChart instance
   */
  constructor(ganttData, container, chartInstance) {
    this.ganttData = ganttData;
    this.container = container;
    this.chartInstance = chartInstance;

    // State management
    this.currentMode = 'all'; // 'facts' | 'all'
    this.confidenceThreshold = 0.7; // Default threshold
    this.dependencyMode = 'preserve'; // 'preserve' | 'bridge' | 'break'

    // Filtered data (updated when mode/threshold changes)
    this.filteredData = null;

    // UI elements (created in initialize)
    this.controlsContainer = null;
    this.modeToggle = null;
    this.confidenceSlider = null;
    this.dependencyModeSelector = null;
  }

  /**
   * Detects if the ganttData is semantic (has bimodal structure)
   * @param {Object} ganttData - The chart data to check
   * @returns {boolean} True if data has semantic structure
   */
  static isSemantic(ganttData) {
    // Check for semantic indicators
    if (!ganttData || !ganttData.tasks || !Array.isArray(ganttData.tasks)) {
      return false;
    }

    // Check if tasks have 'origin' and 'confidence' fields
    const hasBimodalFields = ganttData.tasks.some(task =>
      task.origin !== undefined && task.confidence !== undefined
    );

    // Check for semantic metadata
    const hasSemanticMetadata = ganttData.generatedAt && ganttData.determinismSeed !== undefined;

    return hasBimodalFields || hasSemanticMetadata;
  }

  /**
   * Initializes the controller and renders the semantic overlay UI
   * @returns {void}
   */
  initialize() {
    console.log('[BimodalController] Initializing semantic overlay controls');

    // Create controls container
    this._createControlsUI();

    // Apply initial filtering (show all by default)
    this._applyFiltering();

    // Attach event listeners
    this._attachEventListeners();

    console.log('[BimodalController] Initialized with mode:', this.currentMode, 'threshold:', this.confidenceThreshold);
  }

  /**
   * Creates the semantic overlay control panel UI
   * @private
   */
  _createControlsUI() {
    // Create container for semantic controls
    this.controlsContainer = document.createElement('div');
    this.controlsContainer.className = 'semantic-controls-panel';
    this.controlsContainer.setAttribute('role', 'region');
    this.controlsContainer.setAttribute('aria-label', 'Semantic overlay controls');

    // Header
    const header = document.createElement('div');
    header.className = 'semantic-controls-header';
    header.innerHTML = `
      <h3>🔬 Semantic Overlay Controls</h3>
      <p class="semantic-controls-subtitle">Toggle between facts and AI inferences</p>
    `;
    this.controlsContainer.appendChild(header);

    // Mode toggle (Facts Only ↔ AI Insights)
    const modeSection = this._createModeToggle();
    this.controlsContainer.appendChild(modeSection);

    // Confidence threshold slider
    const confidenceSection = this._createConfidenceSlider();
    this.controlsContainer.appendChild(confidenceSection);

    // Dependency mode selector
    const dependencySection = this._createDependencyModeSelector();
    this.controlsContainer.appendChild(dependencySection);

    // Statistics display
    const statsSection = this._createStatisticsDisplay();
    this.controlsContainer.appendChild(statsSection);

    // Insert controls before the chart grid
    const chartGrid = this.container.querySelector('.gantt-grid');
    if (chartGrid) {
      this.container.insertBefore(this.controlsContainer, chartGrid);
    } else {
      this.container.insertBefore(this.controlsContainer, this.container.firstChild);
    }
  }

  /**
   * Creates the mode toggle UI (Facts Only ↔ AI Insights)
   * @private
   * @returns {HTMLElement} The mode toggle section
   */
  _createModeToggle() {
    const section = document.createElement('div');
    section.className = 'semantic-control-section';

    const label = document.createElement('label');
    label.className = 'semantic-control-label';
    label.textContent = 'View Mode:';
    label.setAttribute('for', 'semantic-mode-toggle');

    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'mode-toggle-container';

    // Facts Only button
    const factsBtn = document.createElement('button');
    factsBtn.className = 'mode-toggle-btn';
    factsBtn.id = 'semantic-mode-facts';
    factsBtn.textContent = '📋 Facts Only';
    factsBtn.title = 'Show only explicitly stated information (100% confidence)';
    factsBtn.setAttribute('aria-label', 'Show facts only mode');
    factsBtn.setAttribute('aria-pressed', this.currentMode === 'facts' ? 'true' : 'false');

    // All Insights button
    const allBtn = document.createElement('button');
    allBtn.className = 'mode-toggle-btn active';
    allBtn.id = 'semantic-mode-all';
    allBtn.textContent = '🔮 AI Insights';
    allBtn.title = 'Show facts + AI inferences';
    allBtn.setAttribute('aria-label', 'Show all insights mode');
    allBtn.setAttribute('aria-pressed', this.currentMode === 'all' ? 'true' : 'false');

    toggleContainer.appendChild(factsBtn);
    toggleContainer.appendChild(allBtn);

    section.appendChild(label);
    section.appendChild(toggleContainer);

    // Store references
    this.modeToggle = { factsBtn, allBtn };

    return section;
  }

  /**
   * Creates the confidence threshold slider UI
   * @private
   * @returns {HTMLElement} The confidence slider section
   */
  _createConfidenceSlider() {
    const section = document.createElement('div');
    section.className = 'semantic-control-section';

    const labelRow = document.createElement('div');
    labelRow.className = 'slider-label-row';

    const label = document.createElement('label');
    label.className = 'semantic-control-label';
    label.textContent = 'Minimum Confidence:';
    label.setAttribute('for', 'semantic-confidence-slider');

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'confidence-value-display';
    valueDisplay.id = 'confidence-value-display';
    valueDisplay.textContent = `${Math.round(this.confidenceThreshold * 100)}%`;

    labelRow.appendChild(label);
    labelRow.appendChild(valueDisplay);

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'semantic-confidence-slider';
    slider.className = 'confidence-slider';
    slider.min = '0.5';
    slider.max = '1.0';
    slider.step = '0.05';
    slider.value = this.confidenceThreshold.toString();
    slider.setAttribute('aria-label', 'Minimum confidence threshold');
    slider.setAttribute('aria-valuemin', '50');
    slider.setAttribute('aria-valuemax', '100');
    slider.setAttribute('aria-valuenow', Math.round(this.confidenceThreshold * 100).toString());
    slider.setAttribute('aria-valuetext', `${Math.round(this.confidenceThreshold * 100)} percent`);

    // Confidence scale labels
    const scaleLabels = document.createElement('div');
    scaleLabels.className = 'confidence-scale-labels';
    scaleLabels.innerHTML = `
      <span>50%</span>
      <span>60%</span>
      <span>70%</span>
      <span>80%</span>
      <span>90%</span>
      <span>100%</span>
    `;

    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(scaleLabels);

    section.appendChild(labelRow);
    section.appendChild(sliderContainer);

    // Store reference
    this.confidenceSlider = slider;

    return section;
  }

  /**
   * Creates the dependency mode selector UI
   * @private
   * @returns {HTMLElement} The dependency mode selector section
   */
  _createDependencyModeSelector() {
    const section = document.createElement('div');
    section.className = 'semantic-control-section';

    const label = document.createElement('label');
    label.className = 'semantic-control-label';
    label.textContent = 'Dependency Handling:';
    label.setAttribute('for', 'semantic-dependency-mode');

    const select = document.createElement('select');
    select.id = 'semantic-dependency-mode';
    select.className = 'dependency-mode-select';
    select.setAttribute('aria-label', 'Dependency handling mode');

    const modes = [
      { value: 'preserve', label: '🔗 Preserve All', description: 'Keep all dependencies intact' },
      { value: 'bridge', label: '🌉 Bridge Gaps', description: 'Auto-connect broken dependency chains' },
      { value: 'break', label: '✂️ Break Chains', description: 'Remove dependencies to hidden tasks' }
    ];

    modes.forEach(mode => {
      const option = document.createElement('option');
      option.value = mode.value;
      option.textContent = mode.label;
      option.title = mode.description;
      option.selected = mode.value === this.dependencyMode;
      select.appendChild(option);
    });

    const helpText = document.createElement('p');
    helpText.className = 'semantic-control-help';
    helpText.id = 'dependency-mode-help';
    helpText.textContent = 'How to handle dependencies when filtering tasks';

    section.appendChild(label);
    section.appendChild(select);
    section.appendChild(helpText);

    // Store reference
    this.dependencyModeSelector = select;

    return section;
  }

  /**
   * Creates the statistics display panel
   * @private
   * @returns {HTMLElement} The statistics section
   */
  _createStatisticsDisplay() {
    const section = document.createElement('div');
    section.className = 'semantic-statistics-section';

    const stats = this.ganttData.statistics || this._calculateStatistics();

    section.innerHTML = `
      <div class="semantic-stats-grid">
        <div class="stat-item">
          <span class="stat-label">Total Tasks:</span>
          <span class="stat-value">${stats.totalTasks || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Explicit Facts:</span>
          <span class="stat-value fact-count">${stats.explicitTasks || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">AI Inferences:</span>
          <span class="stat-value inference-count">${stats.inferredTasks || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Avg Confidence:</span>
          <span class="stat-value">${Math.round((stats.averageConfidence || 0) * 100)}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Data Quality:</span>
          <span class="stat-value quality-score">${Math.round((stats.dataQualityScore || 0) * 100)}%</span>
        </div>
      </div>
    `;

    return section;
  }

  /**
   * Calculates statistics from task data
   * @private
   * @returns {Object} Statistics object
   */
  _calculateStatistics() {
    const tasks = this.ganttData.tasks || [];
    const explicitTasks = tasks.filter(t => t.origin === 'explicit').length;
    const inferredTasks = tasks.filter(t => t.origin === 'inferred').length;
    const totalTasks = tasks.length;

    const avgConfidence = totalTasks > 0
      ? tasks.reduce((sum, t) => sum + (t.confidence || 0), 0) / totalTasks
      : 0;

    const dataQualityScore = totalTasks > 0 ? explicitTasks / totalTasks : 0;

    return {
      totalTasks,
      explicitTasks,
      inferredTasks,
      averageConfidence: avgConfidence,
      dataQualityScore
    };
  }

  /**
   * Attaches event listeners to control elements
   * @private
   */
  _attachEventListeners() {
    // Mode toggle buttons
    if (this.modeToggle) {
      this.modeToggle.factsBtn.addEventListener('click', () => this._handleModeChange('facts'));
      this.modeToggle.allBtn.addEventListener('click', () => this._handleModeChange('all'));
    }

    // Confidence slider
    if (this.confidenceSlider) {
      this.confidenceSlider.addEventListener('input', (e) => this._handleConfidenceChange(e.target.value));
    }

    // Dependency mode selector
    if (this.dependencyModeSelector) {
      this.dependencyModeSelector.addEventListener('change', (e) => this._handleDependencyModeChange(e.target.value));
    }
  }

  /**
   * Handles mode toggle (Facts Only ↔ AI Insights)
   * @private
   * @param {string} newMode - 'facts' or 'all'
   */
  _handleModeChange(newMode) {
    console.log('[BimodalController] Mode changed to:', newMode);
    this.currentMode = newMode;

    // Update button states
    if (this.modeToggle) {
      const { factsBtn, allBtn } = this.modeToggle;

      if (newMode === 'facts') {
        factsBtn.classList.add('active');
        factsBtn.setAttribute('aria-pressed', 'true');
        allBtn.classList.remove('active');
        allBtn.setAttribute('aria-pressed', 'false');

        // Disable confidence slider in Facts Only mode
        if (this.confidenceSlider) {
          this.confidenceSlider.disabled = true;
          this.confidenceSlider.style.opacity = '0.5';
        }
      } else {
        allBtn.classList.add('active');
        allBtn.setAttribute('aria-pressed', 'true');
        factsBtn.classList.remove('active');
        factsBtn.setAttribute('aria-pressed', 'false');

        // Enable confidence slider
        if (this.confidenceSlider) {
          this.confidenceSlider.disabled = false;
          this.confidenceSlider.style.opacity = '1';
        }
      }
    }

    // Apply filtering and re-render
    this._applyFiltering();
  }

  /**
   * Handles confidence slider change
   * @private
   * @param {string} value - New confidence threshold (0.5-1.0)
   */
  _handleConfidenceChange(value) {
    const threshold = parseFloat(value);
    this.confidenceThreshold = threshold;

    // Update display
    const display = document.getElementById('confidence-value-display');
    if (display) {
      display.textContent = `${Math.round(threshold * 100)}%`;
    }

    // Update ARIA attributes
    if (this.confidenceSlider) {
      this.confidenceSlider.setAttribute('aria-valuenow', Math.round(threshold * 100).toString());
      this.confidenceSlider.setAttribute('aria-valuetext', `${Math.round(threshold * 100)} percent`);
    }

    console.log('[BimodalController] Confidence threshold changed to:', threshold);

    // Apply filtering
    this._applyFiltering();
  }

  /**
   * Handles dependency mode change
   * @private
   * @param {string} newMode - 'preserve' | 'bridge' | 'break'
   */
  _handleDependencyModeChange(newMode) {
    console.log('[BimodalController] Dependency mode changed to:', newMode);
    this.dependencyMode = newMode;

    // Apply filtering
    this._applyFiltering();
  }

  /**
   * Applies filtering based on current mode and threshold
   * @private
   */
  _applyFiltering() {
    console.log('[BimodalController] Applying filtering - mode:', this.currentMode, 'threshold:', this.confidenceThreshold);

    // Filter tasks based on mode and confidence
    const filteredTasks = this._filterTasks();

    // Handle dependencies based on dependency mode
    const filteredDependencies = this._filterDependencies(filteredTasks);

    // Update filtered data
    this.filteredData = {
      ...this.ganttData,
      tasks: filteredTasks,
      dependencies: filteredDependencies
    };

    // Re-render chart with filtered data
    this._rerenderChart();
  }

  /**
   * Filters tasks based on current mode and confidence threshold
   * @private
   * @returns {Array} Filtered task array
   */
  _filterTasks() {
    const tasks = this.ganttData.tasks || [];

    if (this.currentMode === 'facts') {
      // Show only explicit facts (confidence = 1.0)
      return tasks.filter(task => task.origin === 'explicit' && task.confidence === 1.0);
    } else {
      // Show all tasks with confidence >= threshold
      return tasks.filter(task => task.confidence >= this.confidenceThreshold);
    }
  }

  /**
   * Filters dependencies based on dependency mode and visible tasks
   * @private
   * @param {Array} visibleTasks - The filtered task array
   * @returns {Array} Filtered dependency array
   */
  _filterDependencies(visibleTasks) {
    const dependencies = this.ganttData.dependencies || [];
    const visibleTaskIds = new Set(visibleTasks.map(t => t.id));

    switch (this.dependencyMode) {
      case 'preserve':
        // Keep all dependencies intact (even if source/target hidden)
        return dependencies;

      case 'break':
        // Remove dependencies where source or target is hidden
        return dependencies.filter(dep =>
          visibleTaskIds.has(dep.source) && visibleTaskIds.has(dep.target)
        );

      case 'bridge':
        // Bridge gaps by connecting visible tasks across hidden ones
        return this._bridgeDependencies(dependencies, visibleTaskIds);

      default:
        return dependencies;
    }
  }

  /**
   * Bridges dependency gaps by connecting visible tasks across hidden ones
   * @private
   * @param {Array} dependencies - All dependencies
   * @param {Set} visibleTaskIds - IDs of visible tasks
   * @returns {Array} Bridged dependency array
   */
  _bridgeDependencies(dependencies, visibleTaskIds) {
    const bridged = [];

    dependencies.forEach(dep => {
      const sourceVisible = visibleTaskIds.has(dep.source);
      const targetVisible = visibleTaskIds.has(dep.target);

      if (sourceVisible && targetVisible) {
        // Both visible - keep as-is
        bridged.push(dep);
      } else if (!sourceVisible && targetVisible) {
        // Source hidden - find upstream visible task
        const upstreamVisible = this._findUpstreamVisible(dep.source, dependencies, visibleTaskIds);
        if (upstreamVisible) {
          bridged.push({
            ...dep,
            source: upstreamVisible,
            origin: 'inferred',
            confidence: 0.75,
            inferenceRationale: {
              method: 'dependency_chain',
              explanation: 'Bridged from hidden upstream task',
              confidence: 0.75
            }
          });
        }
      } else if (sourceVisible && !targetVisible) {
        // Target hidden - find downstream visible task
        const downstreamVisible = this._findDownstreamVisible(dep.target, dependencies, visibleTaskIds);
        if (downstreamVisible) {
          bridged.push({
            ...dep,
            target: downstreamVisible,
            origin: 'inferred',
            confidence: 0.75,
            inferenceRationale: {
              method: 'dependency_chain',
              explanation: 'Bridged to hidden downstream task',
              confidence: 0.75
            }
          });
        }
      }
      // If both hidden, skip entirely
    });

    return bridged;
  }

  /**
   * Finds the nearest visible upstream task in the dependency chain
   * @private
   * @param {string} taskId - The hidden task ID
   * @param {Array} dependencies - All dependencies
   * @param {Set} visibleTaskIds - IDs of visible tasks
   * @returns {string|null} ID of visible upstream task, or null
   */
  _findUpstreamVisible(taskId, dependencies, visibleTaskIds) {
    const upstream = dependencies.filter(d => d.target === taskId);

    for (const dep of upstream) {
      if (visibleTaskIds.has(dep.source)) {
        return dep.source;
      } else {
        // Recursively search further upstream
        const furtherUpstream = this._findUpstreamVisible(dep.source, dependencies, visibleTaskIds);
        if (furtherUpstream) return furtherUpstream;
      }
    }

    return null;
  }

  /**
   * Finds the nearest visible downstream task in the dependency chain
   * @private
   * @param {string} taskId - The hidden task ID
   * @param {Array} dependencies - All dependencies
   * @param {Set} visibleTaskIds - IDs of visible tasks
   * @returns {string|null} ID of visible downstream task, or null
   */
  _findDownstreamVisible(taskId, dependencies, visibleTaskIds) {
    const downstream = dependencies.filter(d => d.source === taskId);

    for (const dep of downstream) {
      if (visibleTaskIds.has(dep.target)) {
        return dep.target;
      } else {
        // Recursively search further downstream
        const furtherDownstream = this._findDownstreamVisible(dep.target, dependencies, visibleTaskIds);
        if (furtherDownstream) return furtherDownstream;
      }
    }

    return null;
  }

  /**
   * Re-renders the chart with filtered data
   * @private
   */
  _rerenderChart() {
    console.log('[BimodalController] Re-rendering chart with filtered data');
    console.log('[BimodalController] Visible tasks:', this.filteredData.tasks.length, '/', this.ganttData.tasks.length);

    // Update the chart instance's ganttData
    this.chartInstance.ganttData = this.filteredData;

    // Re-render the chart
    this.chartInstance.render();

    // Apply visual styling to show confidence levels
    this._applyConfidenceVisualization();
  }

  /**
   * Applies visual styling based on task confidence levels
   * @private
   */
  _applyConfidenceVisualization() {
    console.log('[BimodalController] Applying confidence visualization');

    // Find all task bars in the chart
    const bars = document.querySelectorAll('.gantt-bar');

    bars.forEach(bar => {
      const taskId = bar.getAttribute('data-task-id');
      const task = this.filteredData.tasks.find(t => t.id === taskId);

      if (!task) return;

      // Apply opacity based on confidence
      const opacity = this._calculateOpacity(task.confidence);
      bar.style.opacity = opacity;

      // Apply border style based on origin
      if (task.origin === 'explicit') {
        bar.style.borderStyle = 'solid';
        bar.style.borderWidth = '2px';
        bar.style.borderColor = '#50AF7B'; // Green for facts
      } else {
        bar.style.borderStyle = 'dashed';
        bar.style.borderWidth = '2px';
        bar.style.borderColor = '#1976D2'; // Blue for inferences
      }

      // Add confidence badge
      this._addConfidenceBadge(bar, task);

      // Add provenance tooltip
      this._addProvenanceTooltip(bar, task);
    });
  }

  /**
   * Calculates opacity based on confidence score
   * @private
   * @param {number} confidence - Confidence score (0.0-1.0)
   * @returns {number} Opacity value (0.6-1.0)
   */
  _calculateOpacity(confidence) {
    // Map confidence to opacity range 0.6-1.0
    // 1.0 confidence → 1.0 opacity
    // 0.5 confidence → 0.6 opacity
    return 0.6 + (confidence - 0.5) * 0.8;
  }

  /**
   * Adds a confidence badge to a task bar
   * @private
   * @param {HTMLElement} bar - The task bar element
   * @param {Object} task - The task data
   */
  _addConfidenceBadge(bar, task) {
    // Remove existing badge if present
    const existingBadge = bar.querySelector('.confidence-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    const badge = document.createElement('span');
    badge.className = 'confidence-badge';
    badge.textContent = `${Math.round(task.confidence * 100)}%`;
    badge.title = `Confidence: ${Math.round(task.confidence * 100)}%`;

    // Position badge in top-right corner of bar
    badge.style.position = 'absolute';
    badge.style.top = '2px';
    badge.style.right = '4px';
    badge.style.fontSize = '10px';
    badge.style.fontWeight = 'bold';
    badge.style.color = task.origin === 'explicit' ? '#50AF7B' : '#1976D2';
    badge.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    badge.style.padding = '2px 4px';
    badge.style.borderRadius = '3px';
    badge.style.pointerEvents = 'none'; // Don't block click events

    bar.style.position = 'relative'; // Ensure bar is positioned
    bar.appendChild(badge);
  }

  /**
   * Adds a provenance tooltip to a task bar
   * @private
   * @param {HTMLElement} bar - The task bar element
   * @param {Object} task - The task data
   */
  _addProvenanceTooltip(bar, task) {
    let tooltipContent = '';

    if (task.origin === 'explicit' && task.sourceCitations && task.sourceCitations.length > 0) {
      // Explicit fact with citations
      const citation = task.sourceCitations[0]; // Show first citation
      tooltipContent = `📋 FACT (100% confidence)
Source: ${citation.documentName}
Paragraph ${citation.paragraphIndex}
"${citation.exactQuote.substring(0, 100)}${citation.exactQuote.length > 100 ? '...' : ''}"`;
    } else if (task.origin === 'inferred' && task.inferenceRationale) {
      // AI inference with rationale
      const rationale = task.inferenceRationale;
      tooltipContent = `🔮 INFERENCE (${Math.round(task.confidence * 100)}% confidence)
Method: ${rationale.method.replace(/_/g, ' ')}
${rationale.explanation}`;
    } else {
      // Fallback
      tooltipContent = `Origin: ${task.origin}
Confidence: ${Math.round(task.confidence * 100)}%`;
    }

    bar.title = tooltipContent;
  }
}

export default BimodalGanttController;
