/**
 * GanttChart Module
 * Phase 3 Enhancement: Extracted from chart-renderer.js
 * Phase 5 Enhancement: Integrated drag-to-edit functionality
 * Handles core Gantt chart rendering, layout, and export functionality
 */

import { CONFIG } from './config.js';
import { safeGetElement, findTodayColumnPosition, buildLegend, PerformanceTimer, trackEvent } from './Utils.js';
import { DraggableGantt } from './DraggableGantt.js';
import { ResizableGantt } from './ResizableGantt.js';
import { ContextMenu } from './ContextMenu.js';
import { ExecutiveSummary } from './ExecutiveSummary.js';
import { PresentationSlides } from './PresentationSlides.js';
import { HamburgerMenu } from './HamburgerMenu.js';
import { BimodalGanttController } from './BimodalGanttController.js';

// Import Router (loaded as global from Router.js)
// Note: Router.js is loaded via script tag in chart.html and exposed as window.Router

/**
 * GanttChart Class
 * Responsible for rendering and managing the Gantt chart visualization
 */
export class GanttChart {
  /**
   * Creates a new GanttChart instance
   * @param {HTMLElement} container - The DOM element to render the chart into
   * @param {Object} ganttData - The chart configuration and data
   * @param {string} footerSVG - The SVG content for the footer decoration
   * @param {Function} onTaskClick - Callback function when a task is clicked
   * @param {Object} researchSynthesizer - The ResearchSynthesizer instance for research analysis
   */
  constructor(container, ganttData, footerSVG, onTaskClick, researchSynthesizer = null) {
    this.container = container;
    this.ganttData = ganttData;
    this.footerSVG = footerSVG;
    this.onTaskClick = onTaskClick;
    this.researchSynthesizer = researchSynthesizer; // Research synthesis component
    this.chartWrapper = null;
    this.gridElement = null;
    this.draggableGantt = null; // Phase 5: Drag-to-edit functionality
    this.resizableGantt = null; // Phase 2: Bar resizing functionality
    this.contextMenu = null; // Phase 5: Context menu for color changing
    this.isEditMode = false; // Edit mode toggle - default is read-only
    this.isExecutiveView = false; // EXECUTIVE-FIRST: Executive View toggle - shows only milestones/decisions
    this.isCriticalPathView = false; // ADVANCED GANTT: Critical Path View toggle - shows only critical path tasks
    this.titleElement = null; // Reference to the title element for edit mode
    this.legendElement = null; // Reference to the legend element for edit mode
    this.hamburgerMenu = null; // Hamburger menu for section navigation
    this.executiveSummary = null; // Reference to ExecutiveSummary component
    this.presentationSlides = null; // Reference to PresentationSlides component
    this.router = null; // Router for navigation between sections
    this.bimodalController = null; // Semantic overlay controller (Phase 3: Semantic Overlay)
  }

  /**
   * Renders the complete Gantt chart
   * @returns {void}
   */
  render() {
    // PERFORMANCE: Start timing chart render
    const renderTimer = new PerformanceTimer('Gantt Chart Render');

    if (!this.container) {
      console.error('Could not find chart container!');
      return;
    }

    // Clear container
    this.container.innerHTML = '';

    // Create the main chart wrapper
    this.chartWrapper = document.createElement('div');
    this.chartWrapper.id = 'gantt-chart-container';

    renderTimer.mark('Container setup complete');

    // Build chart components
    // Add stripe above Gantt chart
    this._addHeaderSVG();

    this._addTitle();
    this._addLogo(); // Logo added after title so we can calculate proper alignment

    renderTimer.mark('Header components added');

    this._createGrid();

    renderTimer.mark('Grid created');

    // PHASE 3 SEMANTIC OVERLAY: Initialize bimodal controller if data is semantic
    if (BimodalGanttController.isSemantic(this.ganttData)) {
      console.log('[GanttChart] 🔬 Semantic data detected - initializing BimodalGanttController');
      this.bimodalController = new BimodalGanttController(
        this.ganttData,
        this.chartWrapper,
        this
      );
      this.bimodalController.initialize();
      renderTimer.mark('Semantic overlay initialized');
    } else {
      console.log('[GanttChart] Standard roadmap data - semantic overlay not applicable');
    }

    this._addLegend();

    // Add Executive Summary - Always create component, it will handle missing data gracefully
    this._addExecutiveSummary();

    // Add Presentation Slides - Always create component, it will handle missing data gracefully
    console.log('🎭 Presentation Slides Data Check:', {
      exists: !!this.ganttData.presentationSlides,
      hasSlides: this.ganttData.presentationSlides?.slides?.length || 0,
      data: this.ganttData.presentationSlides ? 'Present' : 'Missing'
    });

    console.log('✓ Rendering presentation slides component...');
    this._addPresentationSlides();

    // Add footer stripe after Executive Summary and Presentation Slides
    this._addFooterSVG();

    // Add export and edit mode toggle buttons
    const exportContainer = document.createElement('div');
    exportContainer.className = 'export-container';

    // EXECUTIVE-FIRST: Executive View toggle button
    const executiveViewBtn = document.createElement('button');
    executiveViewBtn.id = 'executive-view-toggle-btn';
    executiveViewBtn.className = 'executive-view-toggle-button';
    executiveViewBtn.textContent = this.isExecutiveView ? '👔 Executive View: ON' : '📋 Detail View: ON';
    executiveViewBtn.title = 'Toggle Executive View (show only milestones and decisions)';
    executiveViewBtn.setAttribute('aria-label', 'Toggle Executive View to show only strategic-level tasks');
    executiveViewBtn.setAttribute('aria-pressed', this.isExecutiveView ? 'true' : 'false');
    executiveViewBtn.style.backgroundColor = this.isExecutiveView ? '#1976D2' : '#555555';
    exportContainer.appendChild(executiveViewBtn);

    // ADVANCED GANTT: Critical Path View toggle button
    const criticalPathBtn = document.createElement('button');
    criticalPathBtn.id = 'critical-path-toggle-btn';
    criticalPathBtn.className = 'critical-path-toggle-button';
    criticalPathBtn.textContent = this.isCriticalPathView ? '🔴 Critical Path: ON' : '🔵 All Tasks: ON';
    criticalPathBtn.title = 'Toggle Critical Path View (show only tasks on critical path)';
    criticalPathBtn.setAttribute('aria-label', 'Toggle Critical Path View to show only time-sensitive tasks');
    criticalPathBtn.setAttribute('aria-pressed', this.isCriticalPathView ? 'true' : 'false');
    criticalPathBtn.style.backgroundColor = this.isCriticalPathView ? '#DC3545' : '#6C757D';
    exportContainer.appendChild(criticalPathBtn);

    // Edit mode toggle button
    const editModeBtn = document.createElement('button');
    editModeBtn.id = 'edit-mode-toggle-btn';
    editModeBtn.className = 'edit-mode-toggle-button';
    editModeBtn.textContent = this.isEditMode ? '🔓 Edit Mode: ON' : '🔒 Edit Mode: OFF';
    editModeBtn.title = 'Toggle edit mode to enable/disable chart customization';
    editModeBtn.setAttribute('aria-label', 'Toggle edit mode to enable or disable chart customization');
    editModeBtn.setAttribute('aria-pressed', this.isEditMode ? 'true' : 'false');
    editModeBtn.style.backgroundColor = this.isEditMode ? '#50AF7B' : '#BA3930';
    exportContainer.appendChild(editModeBtn);

    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-png-btn';
    exportBtn.className = 'export-button';
    exportBtn.textContent = 'Export as PNG';
    exportBtn.setAttribute('aria-label', 'Export Gantt chart as PNG image');
    exportContainer.appendChild(exportBtn);

    // BANKING ENHANCEMENT: Theme toggle button (for presentations)
    const themeToggleBtn = document.createElement('button');
    themeToggleBtn.id = 'theme-toggle-btn';
    themeToggleBtn.className = 'theme-toggle-btn';
    themeToggleBtn.title = 'Toggle between dark and light theme';
    themeToggleBtn.setAttribute('aria-label', 'Toggle between dark and light theme for presentations');
    themeToggleBtn.setAttribute('aria-pressed', 'false');
    themeToggleBtn.innerHTML = '<span class="theme-icon">☀️</span><span class="theme-label">Light Mode</span>';
    exportContainer.appendChild(themeToggleBtn);

    // FEATURE #8: Copy Share URL button (persistent database storage)
    const copyUrlBtn = document.createElement('button');
    copyUrlBtn.id = 'copy-url-btn';
    copyUrlBtn.className = 'copy-url-button';
    copyUrlBtn.textContent = '🔗 Copy Share URL';
    copyUrlBtn.title = 'Copy shareable URL to clipboard (chart is saved to database)';
    copyUrlBtn.setAttribute('aria-label', 'Copy shareable URL to clipboard');
    exportContainer.appendChild(copyUrlBtn);

    // Append to container
    this.container.appendChild(this.chartWrapper);
    this.container.appendChild(exportContainer);

    // Add hamburger menu for navigation
    this._addHamburgerMenu();

    // Add listeners
    this._addExecutiveViewToggleListener(); // EXECUTIVE-FIRST: Executive View toggle
    this._addCriticalPathViewToggleListener(); // ADVANCED GANTT: Critical Path View toggle
    this._addEditModeToggleListener();
    this._addExportListener();
    this._addThemeToggleListener(); // BANKING ENHANCEMENT: Theme toggle
    this._addCopyUrlListener(); // FEATURE #8: Copy share URL
    this._addKeyboardShortcuts(); // ADVANCED GANTT: Keyboard navigation

    // Add "Today" line
    const today = new Date();
    this.addTodayLine(today);

    // Phase 5: Initialize drag-to-edit functionality
    this._initializeDragToEdit();

    // Restore edit mode state if it was enabled before rendering
    console.log('🔧 Checking edit mode state after render:', this.isEditMode);
    if (this.isEditMode) {
      console.log('🔧 Restoring edit mode features after re-render');
      this._enableAllEditFeatures();
    }

    // PERFORMANCE: End timing
    renderTimer.mark('All components and listeners initialized');
    renderTimer.end();
  }

  /**
   * Adds the BIP logo to the chart
   * @private
   */
  _addLogo() {
    const logoImg = document.createElement('img');
    logoImg.src = '/bip_logo.png';
    logoImg.alt = 'BIP Logo';
    logoImg.className = 'gantt-logo';
    logoImg.style.height = `${CONFIG.SIZES.LOGO_HEIGHT}px`;
    logoImg.style.width = 'auto';
    logoImg.style.flexShrink = '0'; // Prevent logo from shrinking

    // Add logo to the title container (if it exists)
    if (this.titleContainer) {
      this.titleContainer.appendChild(logoImg);
    }
  }

  /**
   * Adds the chart title
   * @private
   */
  _addTitle() {
    // Create a container for the title row that will hold both title and logo
    this.titleContainer = document.createElement('div');
    this.titleContainer.className = 'gantt-title-container';

    // Use flexbox to align title and logo
    this.titleContainer.style.display = 'flex';
    this.titleContainer.style.justifyContent = 'space-between';
    this.titleContainer.style.alignItems = 'center'; // Vertically center logo with title
    this.titleContainer.style.gap = '32px'; // Space between title and logo
    this.titleContainer.style.padding = '29px'; // Match original title padding
    this.titleContainer.style.borderBottom = '1px solid #0D0D0D';
    this.titleContainer.style.backgroundColor = '#0c2340';
    this.titleContainer.style.borderRadius = '8px 8px 0 0';

    // Create the title text element
    this.titleElement = document.createElement('div');
    this.titleElement.className = 'gantt-title';
    this.titleElement.textContent = this.ganttData.title;
    this.titleElement.style.flex = '1'; // Allow title to grow and wrap if needed
    this.titleElement.style.padding = '0'; // Remove padding since container has it
    this.titleElement.style.border = 'none'; // Remove border since container has it
    this.titleElement.style.background = 'none'; // Remove background since container has it
    this.titleElement.style.borderRadius = '0'; // Remove border radius since container has it

    // Add double-click to edit title (only in edit mode)
    this.titleElement.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.isEditMode) {
        this._makeChartTitleEditable();
      }
    });

    this.titleContainer.appendChild(this.titleElement);
    this.chartWrapper.appendChild(this.titleContainer);
  }

  /**
   * Adds the executive summary component to the chart
   * @private
   */
  _addExecutiveSummary() {
    this.executiveSummary = new ExecutiveSummary(this.ganttData.executiveSummary, this.footerSVG);
    const summaryElement = this.executiveSummary.render();
    this.chartWrapper.appendChild(summaryElement);
  }

  /**
   * Adds the presentation slides component to the chart
   * @private
   */
  _addPresentationSlides() {
    this.presentationSlides = new PresentationSlides(this.ganttData.presentationSlides, this.footerSVG);
    const slidesElement = this.presentationSlides.render();
    this.chartWrapper.appendChild(slidesElement);
  }

  /**
   * Adds the hamburger menu for navigation
   * @private
   */
  _addHamburgerMenu() {
    // Remove any existing hamburger menu first to prevent duplicates
    const existingMenu = document.querySelector('.hamburger-menu-container');
    if (existingMenu) {
      existingMenu.remove();
    }

    // Create Router instance if not already created
    if (!this.router && window.Router) {
      this.router = new window.Router();
    }

    // Create hamburger menu instance with router
    this.hamburgerMenu = new HamburgerMenu(this.router);
    const menuElement = this.hamburgerMenu.render();

    // Append directly to the document body so it stays fixed on screen
    document.body.appendChild(menuElement);

    // Initialize the router with component references
    if (this.router) {
      this.router.init(this, this.executiveSummary, this.presentationSlides, this.researchSynthesizer);
    }
  }

  /**
   * Creates the main chart grid with timeline and tasks
   * @private
   */
  _createGrid() {
    this.gridElement = document.createElement('div');
    this.gridElement.className = 'gantt-grid';
    // ACCESSIBILITY: Add ARIA role for grid
    this.gridElement.setAttribute('role', 'grid');
    this.gridElement.setAttribute('aria-label', 'Project timeline Gantt chart');
    this.gridElement.setAttribute('aria-readonly', 'true'); // Will be updated when edit mode is toggled

    const numCols = this.ganttData.timeColumns.length;
    // Use max-content for first column to auto-expand and fit all text on single line
    this.gridElement.style.gridTemplateColumns = `max-content repeat(${numCols}, 1fr)`;

    // Create header row
    this._createHeaderRow(numCols);

    // Create data rows
    this._createDataRows(numCols);

    this.chartWrapper.appendChild(this.gridElement);
  }

  /**
   * Creates the header row with time column labels
   * @param {number} numCols - Number of time columns
   * @private
   */
  _createHeaderRow(numCols) {
    const headerFragment = document.createDocumentFragment();

    const headerLabel = document.createElement('div');
    headerLabel.className = 'gantt-header gantt-header-label';
    headerFragment.appendChild(headerLabel);

    for (const colName of this.ganttData.timeColumns) {
      const headerCell = document.createElement('div');
      headerCell.className = 'gantt-header';
      headerCell.textContent = colName;
      headerFragment.appendChild(headerCell);
    }

    // Append all header cells at once (single reflow)
    this.gridElement.appendChild(headerFragment);
  }

  /**
   * Creates data rows (swimlanes and tasks)
   * @param {number} numCols - Number of time columns
   * @private
   */
  _createDataRows(numCols) {
    // PERFORMANCE: Check if we need virtualization for large datasets (100+ rows)
    const totalRows = this.ganttData.data.length;
    const VIRTUALIZATION_THRESHOLD = 100;

    if (totalRows > VIRTUALIZATION_THRESHOLD) {
      console.log(`📊 Large dataset detected (${totalRows} rows). Enabling virtualization for better performance.`);
      this._createVirtualizedRows(numCols);
      return;
    }

    // Use DocumentFragment to batch DOM operations for better performance
    const rowsFragment = document.createDocumentFragment();

    this.ganttData.data.forEach((row, dataIndex) => {
      const isSwimlane = row.isSwimlane;

      // Create label cell
      const labelEl = document.createElement('div');
      labelEl.className = `gantt-row-label ${isSwimlane ? 'swimlane' : 'task'}`;

      // Phase 3: Add row action buttons container
      const labelContent = document.createElement('span');
      labelContent.className = 'label-content';
      labelContent.textContent = row.title;
      labelEl.appendChild(labelContent);

      // Phase 3: Add action buttons for tasks (not swimlanes)
      if (!isSwimlane) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'row-actions';

        const addBtn = document.createElement('button');
        addBtn.className = 'row-action-btn add-task';
        addBtn.title = 'Add task below';
        addBtn.textContent = '+';
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.addNewTaskRow(dataIndex);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'row-action-btn delete-task';
        deleteBtn.title = 'Delete this row';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeTaskRow(dataIndex);
        });

        actionsDiv.appendChild(addBtn);
        actionsDiv.appendChild(deleteBtn);
        labelEl.appendChild(actionsDiv);
      }

      // Phase 1 Enhancement: Add unique row identifier
      labelEl.setAttribute('data-row-id', `row-${dataIndex}`);
      labelEl.setAttribute('data-task-index', dataIndex);

      // Phase 4: Add double-click to edit title (only in edit mode, for both tasks and swimlanes)
      labelContent.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (this.isEditMode) {
          this._makeEditable(labelContent, dataIndex);
        }
      });

      // Create bar area
      const barAreaEl = this._createBarArea(row, numCols, isSwimlane, dataIndex);

      // Add click listeners for tasks (only active when edit mode is OFF)
      if (!isSwimlane && row.bar && row.bar.startCol != null && this.onTaskClick) {
        const taskIdentifier = {
          taskName: row.title,
          entity: row.entity,
          sessionId: this.ganttData.sessionId
        };
        // Wrap click handlers to check edit mode - analysis screen only accessible when edit mode is OFF
        labelEl.addEventListener('click', () => {
          if (!this.isEditMode) {
            this.onTaskClick(taskIdentifier);
          }
        });
        barAreaEl.addEventListener('click', () => {
          if (!this.isEditMode) {
            this.onTaskClick(taskIdentifier);
          }
        });
        labelEl.style.cursor = 'pointer';
        barAreaEl.style.cursor = 'pointer';
      }

      // Add synchronized hover effect for task rows
      if (!isSwimlane) {
        this._addHoverEffects(labelEl, barAreaEl);
      }

      // Add both label and bar area to the fragment
      rowsFragment.appendChild(labelEl);
      rowsFragment.appendChild(barAreaEl);
    });

    // Append all rows at once (single reflow) - major performance improvement
    this.gridElement.appendChild(rowsFragment);
  }

  /**
   * Creates the bar area for a single row
   * @param {Object} row - Row data
   * @param {number} numCols - Number of time columns
   * @param {boolean} isSwimlane - Whether this is a swimlane row
   * @param {number} dataIndex - The index of this row in the data array
   * @returns {HTMLElement} The bar area element
   * @private
   */
  _createBarArea(row, numCols, isSwimlane, dataIndex) {
    const barAreaEl = document.createElement('div');
    barAreaEl.className = `gantt-bar-area ${isSwimlane ? 'swimlane' : 'task'}`;
    barAreaEl.style.gridColumn = `2 / span ${numCols}`;
    barAreaEl.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
    barAreaEl.style.position = 'relative';
    barAreaEl.style.display = 'grid';

    // Phase 1 Enhancement: Add unique row identifiers
    barAreaEl.setAttribute('data-row-id', `row-${dataIndex}`);
    barAreaEl.setAttribute('data-task-index', dataIndex);

    // Create individual cell divs within the bar area for proper grid lines
    const cellsFragment = document.createDocumentFragment();
    for (let colIndex = 1; colIndex <= numCols; colIndex++) {
      const cellEl = document.createElement('div');
      cellEl.className = 'gantt-time-cell';
      cellEl.style.gridColumn = colIndex;
      cellEl.style.borderLeft = colIndex > 1 ? `1px solid ${CONFIG.COLORS.GRID_BORDER}` : 'none';
      cellEl.style.borderBottom = `1px solid ${CONFIG.COLORS.GRID_BORDER}`;
      cellEl.style.height = '100%';
      cellsFragment.appendChild(cellEl);
    }
    barAreaEl.appendChild(cellsFragment);

    // Add the bar if it's a task and has bar data
    if (!isSwimlane && row.bar && row.bar.startCol != null) {
      const bar = row.bar;

      const barEl = document.createElement('div');
      barEl.className = 'gantt-bar';
      barEl.setAttribute('data-color', bar.color || 'default');
      barEl.style.gridColumn = `${bar.startCol} / ${bar.endCol}`;

      // ADVANCED GANTT: Add critical path styling
      // REMOVED: Critical path styling with pulsing outline
      // if (row.isCriticalPath) {
      //   barEl.classList.add('critical-path');
      //   barEl.setAttribute('data-critical-path', 'true');
      // }

      // ADVANCED GANTT: Add milestone marker based on task type
      // REMOVED: Milestone markers (icons on bars)
      // if (row.taskType) {
      //   this._addMilestoneMarker(barEl, row.taskType, row.title);
      // }

      barAreaEl.appendChild(barEl);
    }

    return barAreaEl;
  }

  /**
   * PERFORMANCE: Creates virtualized data rows for large datasets (100+ rows)
   * Only renders visible rows to improve performance
   * @param {number} numCols - Number of time columns
   * @private
   */
  _createVirtualizedRows(numCols) {
    const ROW_HEIGHT = 40; // Approximate height of each row in pixels
    const BUFFER_ROWS = 20; // Number of extra rows to render above/below viewport

    // Create a scroll container
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'gantt-virtualized-container';
    scrollContainer.style.height = `${this.ganttData.data.length * ROW_HEIGHT}px`;
    scrollContainer.style.position = 'relative';
    scrollContainer.style.overflow = 'auto';
    scrollContainer.style.maxHeight = '600px'; // Limit viewport height

    // Create viewport for visible rows
    const viewport = document.createElement('div');
    viewport.className = 'gantt-virtualized-viewport';
    viewport.style.position = 'absolute';
    viewport.style.top = '0';
    viewport.style.left = '0';
    viewport.style.right = '0';

    // Store references for scroll handling
    this.virtualScroll = {
      container: scrollContainer,
      viewport: viewport,
      rowHeight: ROW_HEIGHT,
      bufferRows: BUFFER_ROWS,
      numCols: numCols,
      visibleStart: 0,
      visibleEnd: Math.min(50, this.ganttData.data.length) // Initial render
    };

    // Render initial visible rows
    this._renderVisibleRows();

    // Add scroll listener for dynamic rendering
    scrollContainer.addEventListener('scroll', () => {
      this._handleVirtualScroll();
    });

    scrollContainer.appendChild(viewport);
    this.gridElement.appendChild(scrollContainer);

    console.log(`✓ Virtualization enabled: Rendering ${this.virtualScroll.visibleEnd} of ${this.ganttData.data.length} rows initially`);
  }

  /**
   * PERFORMANCE: Renders only the visible rows in the viewport
   * @private
   */
  _renderVisibleRows() {
    if (!this.virtualScroll) return;

    const { viewport, visibleStart, visibleEnd, rowHeight, numCols } = this.virtualScroll;

    // Clear existing rows
    viewport.innerHTML = '';

    // Create document fragment for batch rendering
    const rowsFragment = document.createDocumentFragment();

    // Render visible rows
    for (let dataIndex = visibleStart; dataIndex < visibleEnd; dataIndex++) {
      const row = this.ganttData.data[dataIndex];
      if (!row) continue;

      const isSwimlane = row.isSwimlane;

      // Create row container
      const rowContainer = document.createElement('div');
      rowContainer.className = 'gantt-virtual-row';
      rowContainer.style.position = 'absolute';
      rowContainer.style.top = `${dataIndex * rowHeight}px`;
      rowContainer.style.left = '0';
      rowContainer.style.right = '0';
      rowContainer.style.height = `${rowHeight}px`;
      rowContainer.style.display = 'grid';
      rowContainer.style.gridTemplateColumns = this.gridElement.style.gridTemplateColumns;

      // Create label and bar area (reuse existing logic)
      const labelEl = this._createRowLabel(row, dataIndex, isSwimlane);
      const barAreaEl = this._createBarArea(row, numCols, isSwimlane, dataIndex);

      rowContainer.appendChild(labelEl);
      rowContainer.appendChild(barAreaEl);
      rowsFragment.appendChild(rowContainer);
    }

    viewport.appendChild(rowsFragment);
  }

  /**
   * PERFORMANCE: Handles scroll events for virtual rendering
   * @private
   */
  _handleVirtualScroll() {
    if (!this.virtualScroll) return;

    const { container, rowHeight, bufferRows } = this.virtualScroll;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    // Calculate visible range
    const newVisibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
    const newVisibleEnd = Math.min(
      this.ganttData.data.length,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + bufferRows
    );

    // Only re-render if range changed significantly
    if (newVisibleStart !== this.virtualScroll.visibleStart ||
        newVisibleEnd !== this.virtualScroll.visibleEnd) {
      this.virtualScroll.visibleStart = newVisibleStart;
      this.virtualScroll.visibleEnd = newVisibleEnd;

      // Debounce rendering for better performance
      if (this.virtualScrollTimeout) {
        clearTimeout(this.virtualScrollTimeout);
      }

      this.virtualScrollTimeout = setTimeout(() => {
        this._renderVisibleRows();
      }, 50); // 50ms debounce
    }
  }

  /**
   * PERFORMANCE: Creates a row label element (extracted for virtualization)
   * @param {Object} row - Row data
   * @param {number} dataIndex - Row index
   * @param {boolean} isSwimlane - Whether this is a swimlane
   * @returns {HTMLElement} Label element
   * @private
   */
  _createRowLabel(row, dataIndex, isSwimlane) {
    const labelEl = document.createElement('div');
    labelEl.className = `gantt-row-label ${isSwimlane ? 'swimlane' : 'task'}`;

    const labelContent = document.createElement('span');
    labelContent.className = 'label-content';
    labelContent.textContent = row.title;
    labelEl.appendChild(labelContent);

    // Add action buttons for tasks (not swimlanes)
    if (!isSwimlane) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'row-actions';

      const addBtn = document.createElement('button');
      addBtn.className = 'row-action-btn add-task';
      addBtn.title = 'Add task below';
      addBtn.textContent = '+';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addNewTaskRow(dataIndex);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'row-action-btn delete-task';
      deleteBtn.title = 'Delete this row';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTaskRow(dataIndex);
      });

      actionsDiv.appendChild(addBtn);
      actionsDiv.appendChild(deleteBtn);
      labelEl.appendChild(actionsDiv);
    }

    labelEl.setAttribute('data-row-id', `row-${dataIndex}`);
    labelEl.setAttribute('data-task-index', dataIndex);

    // Add double-click to edit
    labelContent.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.isEditMode) {
        this._makeEditable(labelContent, dataIndex);
      }
    });

    return labelEl;
  }

  /**
   * Adds synchronized hover effects between label and bar area
   * @param {HTMLElement} labelEl - The label element
   * @param {HTMLElement} barAreaEl - The bar area element
   * @private
   */
  _addHoverEffects(labelEl, barAreaEl) {
    // When hovering over the label, highlight the bar area
    labelEl.addEventListener('mouseenter', () => {
      barAreaEl.classList.add('row-hover');
    });
    labelEl.addEventListener('mouseleave', () => {
      barAreaEl.classList.remove('row-hover');
    });

    // When hovering over the bar area, keep it highlighted
    barAreaEl.addEventListener('mouseenter', () => {
      barAreaEl.classList.add('row-hover');
    });
    barAreaEl.addEventListener('mouseleave', () => {
      barAreaEl.classList.remove('row-hover');
    });
  }

  /**
   * ADVANCED GANTT: Adds milestone marker icon based on task type
   * @param {HTMLElement} barEl - The bar element to add the marker to
   * @param {string} taskType - The type of task (milestone, decision, task)
   * @param {string} title - The task title for tooltip
   * @private
   */
  _addMilestoneMarker(barEl, taskType, title) {
    // Only add markers for strategic task types (not regular tasks)
    if (taskType === 'task') return;

    const marker = document.createElement('span');
    marker.className = `milestone-marker ${taskType}-marker`;

    // Set icon and tooltip based on task type
    switch (taskType) {
      case 'milestone':
        marker.textContent = '💰';
        marker.title = `Milestone: ${title}`;
        break;
      case 'decision':
        marker.textContent = '★';
        marker.title = `Decision Point: ${title}`;
        break;
      default:
        return; // Unknown type, don't add marker
    }

    // Position marker at end of bar (right side)
    marker.style.position = 'absolute';
    marker.style.right = '4px';
    marker.style.top = '50%';
    marker.style.transform = 'translateY(-50%)';
    marker.style.zIndex = '10';
    marker.style.fontSize = '16px';
    marker.style.lineHeight = '1';
    marker.style.cursor = 'help';

    barEl.style.position = 'relative'; // Ensure bar is positioned for absolute child
    barEl.appendChild(marker);
  }

  /**
   * Adds the legend if present in data
   * @private
   */
  _addLegend() {
    if (!this.ganttData.legend) {
      this.ganttData.legend = [];
    }

    // Ensure legend includes all colors used in the chart
    this._updateLegendWithUsedColors();

    if (this.ganttData.legend.length === 0) return;

    // Build legend with editable labels (inline format)
    this.legendElement = document.createElement('div');
    this.legendElement.className = 'gantt-legend';

    // Create a single-line container for "Legend:" and items
    const legendLine = document.createElement('div');
    legendLine.className = 'legend-line';

    // Add "Legend:" prefix
    const title = document.createElement('span');
    title.className = 'legend-title';
    title.textContent = 'Legend:';
    legendLine.appendChild(title);

    // Create list container for items
    const list = document.createElement('div');
    list.className = 'legend-list';

    this.ganttData.legend.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'legend-item';
      itemEl.setAttribute('data-legend-index', index);

      const colorBox = document.createElement('div');
      colorBox.className = 'legend-color-box';
      colorBox.setAttribute('data-color', item.color);

      const labelWrapper = document.createElement('span');
      labelWrapper.className = 'legend-label-wrapper';

      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = item.label;

      // Add double-click to edit legend label (only in edit mode)
      label.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (this.isEditMode) {
          this._makeLegendLabelEditable(label, index);
        }
      });

      labelWrapper.appendChild(label);
      itemEl.appendChild(colorBox);
      itemEl.appendChild(labelWrapper);
      list.appendChild(itemEl);
    });

    legendLine.appendChild(list);
    this.legendElement.appendChild(legendLine);
    this.chartWrapper.appendChild(this.legendElement);
  }

  /**
   * Refreshes the legend to include any new colors
   * @private
   */
  _refreshLegend() {
    if (!this.legendElement) return;

    // Check if any new colors need to be added
    const originalLength = this.ganttData.legend.length;
    this._updateLegendWithUsedColors();

    // If new colors were added, rebuild the legend
    if (this.ganttData.legend.length > originalLength) {
      const wasEditMode = this.isEditMode;

      // Remove old legend
      this.legendElement.remove();

      // Rebuild legend
      this._addLegend();

      // Restore edit mode class if needed
      if (wasEditMode && this.legendElement) {
        this.legendElement.classList.add('edit-mode-enabled');
      }
    }
  }

  /**
   * Adds the header SVG decoration above the Gantt chart
   * @private
   */
  _addHeaderSVG() {
    if (!this.footerSVG) return;

    const encodedFooterSVG = encodeURIComponent(this.footerSVG.replace(/(\r\n|\n|\r)/gm, ''));

    const headerSvgEl = document.createElement('div');
    headerSvgEl.className = 'gantt-header-svg';

    // Apply all styles inline
    headerSvgEl.style.height = '30px';
    headerSvgEl.style.backgroundImage = `url("data:image/svg+xml,${encodedFooterSVG}")`;
    headerSvgEl.style.backgroundRepeat = 'repeat-x';
    headerSvgEl.style.backgroundSize = 'auto 30px';

    this.chartWrapper.appendChild(headerSvgEl);
  }

  /**
   * Adds the footer SVG decoration after the Gantt chart
   * @private
   */
  _addGanttFooterSVG() {
    if (!this.footerSVG) return;

    const encodedFooterSVG = encodeURIComponent(this.footerSVG.replace(/(\r\n|\n|\r)/gm, ''));

    const footerSvgEl = document.createElement('div');
    footerSvgEl.className = 'gantt-footer-svg';

    // Apply all styles inline
    footerSvgEl.style.height = '30px';
    footerSvgEl.style.backgroundImage = `url("data:image/svg+xml,${encodedFooterSVG}")`;
    footerSvgEl.style.backgroundRepeat = 'repeat-x';
    footerSvgEl.style.backgroundSize = 'auto 30px';

    this.chartWrapper.appendChild(footerSvgEl);
  }

  /**
   * Adds the footer SVG decoration after the Executive Summary
   * @private
   */
  _addFooterSVG() {
    if (!this.footerSVG) return;

    const encodedFooterSVG = encodeURIComponent(this.footerSVG.replace(/(\r\n|\n|\r)/gm, ''));

    const footerSvgEl = document.createElement('div');
    footerSvgEl.className = 'gantt-footer-svg';

    // Apply all styles inline
    footerSvgEl.style.height = '30px';
    footerSvgEl.style.backgroundImage = `url("data:image/svg+xml,${encodedFooterSVG}")`;
    footerSvgEl.style.backgroundRepeat = 'repeat-x';
    footerSvgEl.style.backgroundSize = 'auto 30px';

    this.chartWrapper.appendChild(footerSvgEl);
  }

  /**
   * EXECUTIVE-FIRST: Adds Executive View toggle functionality
   * Filters chart to show only milestones and decisions
   * @private
   */
  _addExecutiveViewToggleListener() {
    const executiveViewBtn = document.getElementById('executive-view-toggle-btn');

    if (!executiveViewBtn) {
      console.warn('Executive view toggle button not found.');
      return;
    }

    executiveViewBtn.addEventListener('click', () => {
      this.isExecutiveView = !this.isExecutiveView;
      executiveViewBtn.textContent = this.isExecutiveView ? '👔 Executive View: ON' : '📋 Detail View: ON';
      executiveViewBtn.style.backgroundColor = this.isExecutiveView ? '#1976D2' : '#555555';
      executiveViewBtn.setAttribute('aria-pressed', this.isExecutiveView ? 'true' : 'false');

      // Re-render the grid with filtered data
      this._updateGridForExecutiveView();

      // ACCESSIBILITY: Announce view change to screen readers
      this._announceToScreenReader(`${this.isExecutiveView ? 'Executive' : 'Detail'} view enabled`);

      // FEATURE #9: Track feature usage
      trackEvent('feature_executive_view', {
        enabled: this.isExecutiveView,
        taskCount: this.ganttData.data.length
      });

      console.log(`✓ ${this.isExecutiveView ? 'Executive View' : 'Detail View'} enabled`);
    });
  }

  /**
   * EXECUTIVE-FIRST: Updates the grid to show/hide tasks based on Executive View
   * Shows only milestones and decisions when enabled
   * @private
   */
  _updateGridForExecutiveView() {
    if (!this.gridElement) {
      console.warn('Grid element not found for Executive View update');
      return;
    }

    // Get all row labels - each row has a label and a corresponding bar area
    const allRowLabels = this.gridElement.querySelectorAll('.gantt-row-label');

    allRowLabels.forEach((labelElement, index) => {
      const dataItem = this.ganttData.data[index];

      // Skip swimlanes - always show them
      if (dataItem && dataItem.isSwimlane) {
        labelElement.style.display = '';
        // Also show corresponding bar area
        const barArea = this.gridElement.querySelector(`.gantt-bar-area[data-task-index="${index}"]`);
        if (barArea) {
          barArea.style.display = '';
        }
        return;
      }

      // For tasks, check taskType
      if (this.isExecutiveView) {
        // Show only milestone and decision tasks
        const taskType = dataItem?.taskType || 'task';
        const isExecutiveTask = ['milestone', 'decision'].includes(taskType);

        if (isExecutiveTask) {
          labelElement.style.display = '';
          // Also show corresponding bar area
          const barArea = this.gridElement.querySelector(`.gantt-bar-area[data-task-index="${index}"]`);
          if (barArea) {
            barArea.style.display = '';
          }
        } else {
          labelElement.style.display = 'none';
          // Also hide corresponding bar area
          const barArea = this.gridElement.querySelector(`.gantt-bar-area[data-task-index="${index}"]`);
          if (barArea) {
            barArea.style.display = 'none';
          }
        }
      } else {
        // Show all tasks in detail view
        labelElement.style.display = '';
        // Also show corresponding bar area
        const barArea = this.gridElement.querySelector(`.gantt-bar-area[data-task-index="${index}"]`);
        if (barArea) {
          barArea.style.display = '';
        }
      }
    });
  }

  /**
   * ADVANCED GANTT: Adds Critical Path View toggle functionality
   * Filters chart to show only tasks on the critical path
   * @private
   */
  _addCriticalPathViewToggleListener() {
    const criticalPathBtn = document.getElementById('critical-path-toggle-btn');

    if (!criticalPathBtn) {
      console.warn('Critical Path View toggle button not found.');
      return;
    }

    criticalPathBtn.addEventListener('click', () => {
      this.isCriticalPathView = !this.isCriticalPathView;
      criticalPathBtn.textContent = this.isCriticalPathView ? '🔴 Critical Path: ON' : '🔵 All Tasks: ON';
      criticalPathBtn.style.backgroundColor = this.isCriticalPathView ? '#DC3545' : '#6C757D';
      criticalPathBtn.setAttribute('aria-pressed', this.isCriticalPathView ? 'true' : 'false');

      // Re-render the grid with filtered data
      this._updateGridForCriticalPathView();

      // ACCESSIBILITY: Announce view change to screen readers
      this._announceToScreenReader(`${this.isCriticalPathView ? 'Critical path' : 'All tasks'} view enabled`);

      // FEATURE #9: Track feature usage
      trackEvent('feature_critical_path', {
        enabled: this.isCriticalPathView,
        taskCount: this.ganttData.data.length
      });

      console.log(`✓ ${this.isCriticalPathView ? 'Critical Path View' : 'All Tasks View'} enabled`);
    });
  }

  /**
   * ADVANCED GANTT: Updates the grid to show/hide tasks based on Critical Path View
   * Shows only tasks on the critical path when enabled
   * @private
   */
  _updateGridForCriticalPathView() {
    if (!this.gridElement) {
      console.warn('Grid element not found for Critical Path View update');
      return;
    }

    // Get all row labels - each row has a label and a corresponding bar area
    const allRowLabels = this.gridElement.querySelectorAll('.gantt-row-label');

    allRowLabels.forEach((labelElement, index) => {
      const dataItem = this.ganttData.data[index];

      // Skip swimlanes - always show them
      if (dataItem && dataItem.isSwimlane) {
        labelElement.style.display = '';
        // Also show corresponding bar area
        const barArea = this.gridElement.querySelector(`.gantt-bar-area[data-task-index="${index}"]`);
        if (barArea) {
          barArea.style.display = '';
        }
        return;
      }

      // For tasks, check isCriticalPath
      if (this.isCriticalPathView) {
        // Show only critical path tasks
        const isCriticalPath = dataItem?.isCriticalPath || false;

        if (isCriticalPath) {
          labelElement.style.display = '';
          // Also show corresponding bar area
          const barArea = this.gridElement.querySelector(`.gantt-bar-area[data-task-index="${index}"]`);
          if (barArea) {
            barArea.style.display = '';
          }
        } else {
          labelElement.style.display = 'none';
          // Also hide corresponding bar area
          const barArea = this.gridElement.querySelector(`.gantt-bar-area[data-task-index="${index}"]`);
          if (barArea) {
            barArea.style.display = 'none';
          }
        }
      } else {
        // Show all tasks
        labelElement.style.display = '';
        // Also show corresponding bar area
        const barArea = this.gridElement.querySelector(`.gantt-bar-area[data-task-index="${index}"]`);
        if (barArea) {
          barArea.style.display = '';
        }
      }
    });
  }

  /**
   * Adds edit mode toggle functionality
   * @private
   */
  _addEditModeToggleListener() {
    const editModeBtn = document.getElementById('edit-mode-toggle-btn');

    if (!editModeBtn) {
      console.warn('Edit mode toggle button not found.');
      return;
    }

    editModeBtn.addEventListener('click', () => {
      this.isEditMode = !this.isEditMode;
      editModeBtn.textContent = this.isEditMode ? '🔓 Edit Mode: ON' : '🔒 Edit Mode: OFF';
      // Change button color based on state (green when on, red when off)
      editModeBtn.style.backgroundColor = this.isEditMode ? '#50AF7B' : '#BA3930';
      editModeBtn.setAttribute('aria-pressed', this.isEditMode ? 'true' : 'false');

      if (this.isEditMode) {
        this._enableAllEditFeatures();
        // ACCESSIBILITY: Announce mode change to screen readers
        this._announceToScreenReader('Edit mode enabled. You can now drag, resize, and customize chart elements.');

        // FEATURE #9: Track feature usage
        trackEvent('feature_edit_mode', {
          enabled: true
        });

        console.log('✓ Edit mode enabled');
      } else {
        this._disableAllEditFeatures();
        // ACCESSIBILITY: Announce mode change to screen readers
        this._announceToScreenReader('Edit mode disabled. Chart is now read-only.');

        // FEATURE #9: Track feature usage
        trackEvent('feature_edit_mode', {
          enabled: false
        });

        console.log('✓ Edit mode disabled');
      }
    });
  }

  /**
   * PERFORMANCE: Adds export to PNG functionality with loading indicator and timing
   * @private
   */
  _addExportListener() {
    const exportBtn = document.getElementById('export-png-btn');
    const chartContainer = document.getElementById('gantt-chart-container');

    if (!exportBtn || !chartContainer) {
      console.warn('Export button or chart container not found.');
      return;
    }

    exportBtn.addEventListener('click', async () => {
      // Performance timing
      const startTime = performance.now();

      // Update button state
      exportBtn.textContent = 'Exporting...';
      exportBtn.disabled = true;

      // Create loading overlay
      const loadingOverlay = this._createExportLoadingOverlay();
      document.body.appendChild(loadingOverlay);

      try {
        // Use requestAnimationFrame to prevent UI blocking
        await new Promise(resolve => requestAnimationFrame(resolve));

        const canvas = await html2canvas(chartContainer, {
          useCORS: true,
          logging: false,
          scale: 2, // Render at 2x resolution for quality
          allowTaint: false,
          backgroundColor: null
        });

        // Create download link
        const link = document.createElement('a');
        link.download = 'gantt-chart.png';
        link.href = canvas.toDataURL('image/png');
        link.click();

        // Performance logging
        const duration = Math.round(performance.now() - startTime);
        console.log(`✓ PNG export completed in ${duration}ms`);

        // FEATURE #9: Track PNG export
        trackEvent('export_png', {
          taskCount: this.ganttData.data.length,
          exportTime: duration,
          isExecutiveView: this.isExecutiveView,
          isCriticalPathView: this.isCriticalPathView
        });

        // Update button state
        exportBtn.textContent = 'Export as PNG';
        exportBtn.disabled = false;

        // Remove loading overlay
        document.body.removeChild(loadingOverlay);
      } catch (err) {
        console.error('Error exporting canvas:', err);
        exportBtn.textContent = 'Export as PNG';
        exportBtn.disabled = false;

        // Remove loading overlay
        if (loadingOverlay.parentNode) {
          document.body.removeChild(loadingOverlay);
        }

        alert('Error exporting chart. See console for details.');
      }
    });
  }

  /**
   * PERFORMANCE: Creates a loading overlay for export operations
   * @returns {HTMLElement} Loading overlay element
   * @private
   */
  _createExportLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'export-loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      color: white;
      font-family: 'Work Sans', sans-serif;
    `;

    const spinner = document.createElement('div');
    spinner.className = 'export-spinner';
    spinner.style.cssText = `
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: #50AF7B;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    `;

    const message = document.createElement('div');
    message.textContent = 'Generating high-resolution PNG...';
    message.style.cssText = `
      font-size: 16px;
      font-weight: 500;
    `;

    overlay.appendChild(spinner);
    overlay.appendChild(message);

    return overlay;
  }

  /**
   * BANKING ENHANCEMENT: Adds theme toggle button event listener
   * Switches between dark (developer) and light (executive/presentation) themes
   * @private
   */
  _addThemeToggleListener() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (!toggleBtn) return;

    // Check for saved preference (persist across page loads)
    const savedTheme = localStorage.getItem('gantt-theme') || 'dark';
    if (savedTheme === 'light') {
      this._applyLightTheme();
      toggleBtn.querySelector('.theme-icon').textContent = '🌙';
      toggleBtn.querySelector('.theme-label').textContent = 'Dark Mode';
      toggleBtn.setAttribute('aria-pressed', 'true');
    }

    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';

      if (currentTheme === 'dark') {
        this._applyLightTheme();
        localStorage.setItem('gantt-theme', 'light');
        toggleBtn.querySelector('.theme-icon').textContent = '🌙';
        toggleBtn.querySelector('.theme-label').textContent = 'Dark Mode';
        toggleBtn.setAttribute('aria-pressed', 'true');
        // ACCESSIBILITY: Announce theme change to screen readers
        this._announceToScreenReader('Light theme enabled for presentations');

        // FEATURE #9: Track theme toggle
        trackEvent('feature_theme_toggle', {
          theme: 'light'
        });
      } else {
        this._applyDarkTheme();
        localStorage.setItem('gantt-theme', 'dark');
        toggleBtn.querySelector('.theme-icon').textContent = '☀️';
        toggleBtn.querySelector('.theme-label').textContent = 'Light Mode';
        toggleBtn.setAttribute('aria-pressed', 'false');
        // ACCESSIBILITY: Announce theme change to screen readers
        this._announceToScreenReader('Dark theme enabled');

        // FEATURE #9: Track theme toggle
        trackEvent('feature_theme_toggle', {
          theme: 'dark'
        });
      }
    });
  }

  /**
   * FEATURE #8: Adds Copy Share URL button functionality
   * Copies the current chart URL to clipboard for sharing
   * @private
   */
  _addCopyUrlListener() {
    const copyUrlBtn = document.getElementById('copy-url-btn');
    if (!copyUrlBtn) {
      console.warn('Copy URL button not found.');
      return;
    }

    copyUrlBtn.addEventListener('click', async () => {
      // Get current URL (chart.html?id=abc123)
      const currentUrl = window.location.href;

      try {
        // Copy to clipboard
        await navigator.clipboard.writeText(currentUrl);

        // Visual feedback
        const originalText = copyUrlBtn.textContent;
        copyUrlBtn.textContent = '✓ URL Copied!';
        copyUrlBtn.style.backgroundColor = '#50AF7B'; // Green

        // Show notification
        this._showNotification('Chart URL copied to clipboard! Share this link to give others access to this chart.', 'success');

        // ACCESSIBILITY: Announce to screen readers
        this._announceToScreenReader('Chart URL copied to clipboard');

        // FEATURE #9: Track URL sharing
        trackEvent('url_share', {
          url: currentUrl,
          taskCount: this.ganttData.data.length
        });

        // Reset button after 2 seconds
        setTimeout(() => {
          copyUrlBtn.textContent = originalText;
          copyUrlBtn.style.backgroundColor = ''; // Reset to default
        }, 2000);

        console.log('✓ Chart URL copied to clipboard:', currentUrl);
      } catch (err) {
        console.error('Failed to copy URL:', err);

        // Fallback: Show URL in alert
        alert(`Copy this URL to share:\n\n${currentUrl}`);

        // Show error notification
        this._showNotification('Could not copy URL automatically. Please copy it from the address bar.', 'error');
      }
    });
  }

  /**
   * FEATURE #8: Shows a temporary notification message
   * @param {string} message - The message to display
   * @param {string} type - The notification type ('success', 'error', 'info')
   * @private
   */
  _showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `chart-notification chart-notification-${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');

    // Style notification
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? '#50AF7B' : type === 'error' ? '#DC3545' : '#1976D2'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      max-width: 400px;
      font-family: 'Work Sans', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      animation: slideInRight 0.3s ease-out;
    `;

    // Add to body
    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }

  /**
   * ADVANCED GANTT: Adds keyboard shortcuts for quick navigation
   * E = Executive View, T = Timeline (Roadmap), D = Detail View, P = Presentation
   * @private
   */
  _addKeyboardShortcuts() {
    // Add keyboard event listener to document
    document.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Ignore if modifier keys are pressed (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const key = e.key.toLowerCase();

      switch (key) {
        case 'e':
          // E = Executive View (toggle ON)
          if (!this.isExecutiveView) {
            const executiveViewBtn = document.getElementById('executive-view-toggle-btn');
            if (executiveViewBtn) {
              executiveViewBtn.click();
              console.log('⌨️ Keyboard shortcut: E (Executive View)');
            }
          }
          break;

        case 'd':
          // D = Detail View (toggle Executive View OFF)
          if (this.isExecutiveView) {
            const executiveViewBtn = document.getElementById('executive-view-toggle-btn');
            if (executiveViewBtn) {
              executiveViewBtn.click();
              console.log('⌨️ Keyboard shortcut: D (Detail View)');
            }
          }
          break;

        case 't':
          // T = Timeline (navigate to roadmap view)
          if (this.router) {
            this.router.navigate('roadmap');
            console.log('⌨️ Keyboard shortcut: T (Timeline/Roadmap)');
          }
          break;

        case 'p':
          // P = Presentation (navigate to presentation view)
          if (this.router) {
            this.router.navigate('presentation');
            console.log('⌨️ Keyboard shortcut: P (Presentation)');
          }
          break;

        case 's':
          // S = Summary (navigate to executive summary view)
          if (this.router) {
            this.router.navigate('executive-summary');
            console.log('⌨️ Keyboard shortcut: S (Summary)');
          }
          break;

        default:
          // No action for other keys
          break;
      }
    });

    console.log('⌨️ Keyboard shortcuts enabled: E=Executive, D=Detail, T=Timeline, P=Presentation, S=Summary');
  }

  /**
   * BANKING ENHANCEMENT: Applies light theme for executive presentations
   * @private
   */
  _applyLightTheme() {
    document.body.classList.add('light-theme');
    if (this.chartWrapper) {
      this.chartWrapper.classList.add('light-theme');
    }
  }

  /**
   * BANKING ENHANCEMENT: Applies dark theme (default developer mode)
   * @private
   */
  _applyDarkTheme() {
    document.body.classList.remove('light-theme');
    if (this.chartWrapper) {
      this.chartWrapper.classList.remove('light-theme');
    }
  }

  /**
   * ACCESSIBILITY: Announces messages to screen readers via ARIA live region
   * @param {string} message - The message to announce
   * @private
   */
  _announceToScreenReader(message) {
    // Create live region if it doesn't exist
    let liveRegion = document.getElementById('gantt-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'gantt-live-region';
      liveRegion.className = 'sr-only'; // Screen reader only (visually hidden)
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.setAttribute('role', 'status');
      document.body.appendChild(liveRegion);
    }

    // Update the message (screen readers will announce it)
    liveRegion.textContent = message;

    // Clear after 5 seconds to avoid clutter
    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = '';
      }
    }, 5000);
  }

  /**
   * Adds the "Today" line to the chart
   * @param {Date} today - The current date
   * @returns {void}
   */
  addTodayLine(today) {
    if (!this.gridElement) return;

    const position = findTodayColumnPosition(today, this.ganttData.timeColumns);
    if (!position) return; // Today is not in the chart's range

    try {
      // Get element dimensions for calculation
      const labelCol = this.gridElement.querySelector('.gantt-header-label');
      const headerRow = this.gridElement.querySelector('.gantt-header');

      if (!labelCol || !headerRow) return;

      const gridRect = this.gridElement.getBoundingClientRect();
      const containerRect = this.gridElement.parentElement.getBoundingClientRect();
      const leftMargin = gridRect.left - containerRect.left;

      const headerHeight = headerRow.offsetHeight;
      const gridClientWidth = this.gridElement.clientWidth;
      const labelColWidth = labelCol.offsetWidth;

      // Calculate pixel position
      const timeColAreaWidth = gridClientWidth - labelColWidth;
      const oneColWidth = timeColAreaWidth / this.ganttData.timeColumns.length;
      const todayOffset = (position.index + position.percentage) * oneColWidth;

      const lineLeftPosition = labelColWidth + todayOffset;

      // Create and append the line
      const todayLine = document.createElement('div');
      todayLine.className = 'gantt-today-line';
      todayLine.style.top = `${headerHeight}px`;
      todayLine.style.bottom = '0';
      todayLine.style.left = `${lineLeftPosition}px`;

      this.gridElement.appendChild(todayLine);

    } catch (e) {
      console.error("Error calculating 'Today' line position:", e);
    }
  }

  /**
   * Phase 5: Initializes drag-to-edit functionality
   * Phase 2: Initializes bar resizing functionality
   * @private
   */
  _initializeDragToEdit() {
    if (!this.gridElement) {
      console.warn('Cannot initialize drag-to-edit: gridElement not found');
      return;
    }

    // Create callback for task updates (drag)
    const onTaskUpdate = async (taskInfo) => {
      console.log('Task updated via drag:', taskInfo);

      // Persist to server if sessionId is available
      if (taskInfo.sessionId) {
        try {
          const response = await fetch('/update-task-dates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskInfo)
          });

          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }

          const result = await response.json();
          console.log('✓ Task update persisted to server:', result);
        } catch (error) {
          console.error('Failed to persist task update:', error);
          throw error; // Re-throw to trigger rollback in DraggableGantt
        }
      }
    };

    // Phase 2: Create callback for task resize
    const onTaskResize = async (taskInfo) => {
      console.log('Task resized:', taskInfo);

      // Persist to server if sessionId is available
      if (taskInfo.sessionId) {
        try {
          const response = await fetch('/update-task-dates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskInfo)
          });

          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }

          const result = await response.json();
          console.log('✓ Task resize persisted to server:', result);
        } catch (error) {
          console.error('Failed to persist task resize:', error);
          throw error; // Re-throw to trigger rollback in ResizableGantt
        }
      }
    };

    // Phase 5: Create callback for color change
    const onColorChange = async (taskInfo) => {
      console.log('Bar color changed:', taskInfo);

      // Persist to server if sessionId is available
      if (taskInfo.sessionId) {
        try {
          const response = await fetch('/update-task-color', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskInfo)
          });

          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }

          const result = await response.json();
          console.log('✓ Color change persisted to server:', result);

          // Refresh legend to include new color if needed
          this._refreshLegend();
        } catch (error) {
          console.error('Failed to persist color change:', error);
          throw error; // Re-throw to trigger rollback in ContextMenu
        }
      }
    };

    // Initialize DraggableGantt
    this.draggableGantt = new DraggableGantt(
      this.gridElement,
      this.ganttData,
      onTaskUpdate
    );

    // Phase 2: Initialize ResizableGantt
    this.resizableGantt = new ResizableGantt(
      this.gridElement,
      this.ganttData,
      onTaskResize
    );

    // Phase 5: Initialize ContextMenu
    this.contextMenu = new ContextMenu(
      this.gridElement,
      this.ganttData,
      onColorChange
    );

    // Add cursor feedback (will only be active when edit mode is enabled)
    this._addCursorFeedback();

    // Edit features are disabled by default (edit mode is off)
    // They will be enabled when user toggles edit mode
    console.log('✓ Drag-to-edit, bar resizing, and context menu functionality initialized (disabled by default)');
  }

  /**
   * Adds dynamic cursor feedback based on mouse position over bars
   * @private
   */
  _addCursorFeedback() {
    this.gridElement.addEventListener('mousemove', (event) => {
      const bar = event.target.closest('.gantt-bar');
      if (!bar) return;

      // Only show edit cursors when in edit mode
      if (!this.isEditMode) {
        bar.style.cursor = 'pointer';
        return;
      }

      // Don't change cursor if actively dragging or resizing
      if (document.body.classList.contains('dragging') ||
          document.body.classList.contains('resizing')) {
        return;
      }

      const rect = bar.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const HANDLE_WIDTH = 10; // Updated to match new resize handle width

      if (x <= HANDLE_WIDTH || x >= rect.width - HANDLE_WIDTH) {
        // Hovering over resize handle
        bar.style.cursor = 'ew-resize';
      } else {
        // Hovering over middle (drag area)
        bar.style.cursor = 'move';
      }
    });
  }

  /**
   * Enables all editing features
   * @private
   */
  _enableAllEditFeatures() {
    console.log('🔧 _enableAllEditFeatures called, instances:', {
      draggable: !!this.draggableGantt,
      resizable: !!this.resizableGantt,
      contextMenu: !!this.contextMenu
    });

    // Enable drag, resize, and context menu
    if (this.draggableGantt) {
      this.draggableGantt.enableDragging();
    }
    if (this.resizableGantt) {
      this.resizableGantt.enableResizing();
    }
    if (this.contextMenu) {
      this.contextMenu.enable();
    }

    // Add edit-mode class to grid, title, and legend to enable CSS-based features
    this.gridElement.classList.add('edit-mode-enabled');
    // ACCESSIBILITY: Update aria-readonly to false when edit mode is enabled
    this.gridElement.setAttribute('aria-readonly', 'false');

    if (this.titleElement) {
      this.titleElement.classList.add('edit-mode-enabled');
    }
    if (this.legendElement) {
      this.legendElement.classList.add('edit-mode-enabled');
    }
  }

  /**
   * Disables all editing features
   * @private
   */
  _disableAllEditFeatures() {
    // Disable drag, resize, and context menu
    if (this.draggableGantt) {
      this.draggableGantt.disableDragging();
    }
    if (this.resizableGantt) {
      this.resizableGantt.disableResizing();
    }
    if (this.contextMenu) {
      this.contextMenu.disable();
    }

    // Remove edit-mode class from grid, title, and legend to disable CSS-based features
    this.gridElement.classList.remove('edit-mode-enabled');
    // ACCESSIBILITY: Update aria-readonly to true when edit mode is disabled
    this.gridElement.setAttribute('aria-readonly', 'true');

    if (this.titleElement) {
      this.titleElement.classList.remove('edit-mode-enabled');
    }
    if (this.legendElement) {
      this.legendElement.classList.remove('edit-mode-enabled');
    }

    // Reset all bar cursors to pointer
    const bars = this.gridElement.querySelectorAll('.gantt-bar');
    bars.forEach(bar => {
      bar.style.cursor = 'pointer';
    });
  }

  /**
   * Phase 5: Enables drag-to-edit functionality
   * @public
   */
  enableDragToEdit() {
    if (this.draggableGantt) {
      this.draggableGantt.enableDragging();
      console.log('Drag-to-edit enabled');
    }
  }

  /**
   * Phase 5: Disables drag-to-edit functionality
   * @public
   */
  disableDragToEdit() {
    if (this.draggableGantt) {
      this.draggableGantt.disableDragging();
      console.log('Drag-to-edit disabled');
    }
  }

  /**
   * Phase 3: Adds a new task row after the specified index
   * @param {number} afterIndex - Index to insert after
   * @public
   */
  addNewTaskRow(afterIndex) {
    // Create new task data with default values
    const newTask = {
      title: 'New Task',
      entity: 'New Entity',
      isSwimlane: false,
      bar: {
        startCol: 2,
        endCol: 4,
        color: 'mid-grey'
      }
    };

    // Insert into data model
    this.ganttData.data.splice(afterIndex + 1, 0, newTask);

    // Re-render the chart to show the new row
    this.render();

    console.log(`✓ Added new task row after index ${afterIndex}`);
  }

  /**
   * Phase 3: Removes a task row at the specified index
   * @param {number} taskIndex - Index of the task to remove
   * @public
   */
  removeTaskRow(taskIndex) {
    const taskData = this.ganttData.data[taskIndex];

    if (!taskData) {
      console.error('Cannot remove task: invalid index');
      return;
    }

    // Don't allow removing swimlanes
    if (taskData.isSwimlane) {
      console.warn('Cannot remove swimlane rows');
      return;
    }

    // Confirm deletion
    if (!confirm(`Delete task "${taskData.title}"?`)) {
      return;
    }

    // Remove from data model
    this.ganttData.data.splice(taskIndex, 1);

    // Re-render the chart
    this.render();

    console.log(`✓ Removed task row at index ${taskIndex}`);
  }

  /**
   * Phase 3: Updates the data-task-index attributes after row changes
   * @private
   */
  _updateRowIndices() {
    const allLabels = Array.from(this.gridElement.querySelectorAll('.gantt-row-label'));
    const allBarAreas = Array.from(this.gridElement.querySelectorAll('.gantt-bar-area'));

    allLabels.forEach((label, index) => {
      label.setAttribute('data-task-index', index);
      label.setAttribute('data-row-id', `row-${index}`);
    });

    allBarAreas.forEach((barArea, index) => {
      barArea.setAttribute('data-task-index', index);
      barArea.setAttribute('data-row-id', `row-${index}`);
    });
  }

  /**
   * Phase 4: Makes a label editable with contenteditable
   * @param {HTMLElement} labelElement - The label content element to make editable
   * @param {number} taskIndex - The index of the task in the data array
   * @private
   */
  _makeEditable(labelElement, taskIndex) {
    const originalText = labelElement.textContent;

    // Make editable
    labelElement.setAttribute('contenteditable', 'true');
    labelElement.classList.add('editing');
    labelElement.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(labelElement);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const saveChanges = async () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');

      // Sanitize input - use textContent to prevent XSS
      const newText = labelElement.textContent.trim();

      // Set as text, not HTML (prevents XSS)
      labelElement.textContent = newText;

      // Only update if text actually changed
      if (newText && newText !== originalText) {
        // Update data model
        this.ganttData.data[taskIndex].title = newText;

        console.log(`✓ Title updated: "${originalText}" -> "${newText}"`);

        // TODO: Persist to server in Phase 6
        // await this._persistTitleChange(taskIndex, newText);
      } else {
        // Revert if empty or unchanged
        labelElement.textContent = originalText;
      }
    };

    const cancelEdit = () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');
      labelElement.textContent = originalText;
    };

    // Save on blur
    const blurHandler = () => {
      saveChanges();
      labelElement.removeEventListener('blur', blurHandler);
    };
    labelElement.addEventListener('blur', blurHandler);

    // Handle keyboard events
    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        labelElement.blur(); // Trigger save
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        labelElement.removeEventListener('blur', blurHandler);
        cancelEdit();
        labelElement.removeEventListener('keydown', keyHandler);
      }
    };
    labelElement.addEventListener('keydown', keyHandler);
  }

  /**
   * Makes the chart title editable with contenteditable
   * @private
   */
  _makeChartTitleEditable() {
    if (!this.titleElement) return;

    const originalText = this.titleElement.textContent;

    // Make editable
    this.titleElement.setAttribute('contenteditable', 'true');
    this.titleElement.classList.add('editing');
    this.titleElement.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(this.titleElement);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const saveChanges = async () => {
      this.titleElement.setAttribute('contenteditable', 'false');
      this.titleElement.classList.remove('editing');

      // Sanitize input - use textContent to prevent XSS
      const newText = this.titleElement.textContent.trim();

      // Set as text, not HTML (prevents XSS)
      this.titleElement.textContent = newText;

      // Only update if text actually changed
      if (newText && newText !== originalText) {
        // Update data model
        this.ganttData.title = newText;

        console.log(`✓ Chart title updated: "${originalText}" -> "${newText}"`);

        // TODO: Persist to server if needed
      } else {
        // Revert if empty or unchanged
        this.titleElement.textContent = originalText;
      }
    };

    const cancelEdit = () => {
      this.titleElement.setAttribute('contenteditable', 'false');
      this.titleElement.classList.remove('editing');
      this.titleElement.textContent = originalText;
    };

    // Save on blur
    const blurHandler = () => {
      saveChanges();
      this.titleElement.removeEventListener('blur', blurHandler);
    };
    this.titleElement.addEventListener('blur', blurHandler);

    // Handle keyboard events
    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.titleElement.blur(); // Trigger save
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.titleElement.removeEventListener('blur', blurHandler);
        cancelEdit();
        this.titleElement.removeEventListener('keydown', keyHandler);
      }
    };
    this.titleElement.addEventListener('keydown', keyHandler);
  }

  /**
   * Updates the legend to include all colors used in the gantt chart
   * @private
   */
  _updateLegendWithUsedColors() {
    // Get all unique colors used in the gantt chart
    const usedColors = new Set();
    this.ganttData.data.forEach(row => {
      if (row.bar && row.bar.color) {
        usedColors.add(row.bar.color);
      }
    });

    // Check which colors are missing from the legend
    const legendColors = new Set(this.ganttData.legend.map(item => item.color));

    // Add missing colors to the legend with placeholder labels
    usedColors.forEach(color => {
      if (!legendColors.has(color)) {
        this.ganttData.legend.push({
          color: color,
          label: `[Define ${this._formatColorName(color)}]`
        });
        console.log(`✓ Added new color "${color}" to legend`);
      }
    });
  }

  /**
   * Formats a color name for display
   * @param {string} colorKey - The color key (e.g., "priority-red")
   * @returns {string} Formatted color name (e.g., "Priority Red")
   * @private
   */
  _formatColorName(colorKey) {
    return colorKey
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Makes a legend label editable with contenteditable
   * @param {HTMLElement} labelElement - The legend label element to make editable
   * @param {number} legendIndex - The index of the legend item in the data array
   * @private
   */
  _makeLegendLabelEditable(labelElement, legendIndex) {
    const originalText = labelElement.textContent;

    // Make editable
    labelElement.setAttribute('contenteditable', 'true');
    labelElement.classList.add('editing');
    labelElement.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(labelElement);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const saveChanges = async () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');

      // Sanitize input - use textContent to prevent XSS
      const newText = labelElement.textContent.trim();

      // Set as text, not HTML (prevents XSS)
      labelElement.textContent = newText;

      // Only update if text actually changed
      if (newText && newText !== originalText) {
        // Update data model
        this.ganttData.legend[legendIndex].label = newText;

        console.log(`✓ Legend label updated: "${originalText}" -> "${newText}"`);

        // TODO: Persist to server if needed
      } else {
        // Revert if empty or unchanged
        labelElement.textContent = originalText;
      }
    };

    const cancelEdit = () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');
      labelElement.textContent = originalText;
    };

    // Save on blur
    const blurHandler = () => {
      saveChanges();
      labelElement.removeEventListener('blur', blurHandler);
    };
    labelElement.addEventListener('blur', blurHandler);

    // Handle keyboard events
    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        labelElement.blur(); // Trigger save
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        labelElement.removeEventListener('blur', blurHandler);
        cancelEdit();
        labelElement.removeEventListener('keydown', keyHandler);
      }
    };
    labelElement.addEventListener('keydown', keyHandler);
  }
}
