/**
 * GanttChart Module
 * Phase 3 Enhancement: Extracted from chart-renderer.js
 * Phase 5 Enhancement: Integrated drag-to-edit functionality
 * Handles core Gantt chart rendering, layout, and export functionality
 */

import { CONFIG } from './config.js';
import { safeGetElement, findTodayColumnPosition, buildLegend, PerformanceTimer } from './Utils.js';
import { DraggableGantt } from './DraggableGantt.js';
import { ResizableGantt } from './ResizableGantt.js';
import { ContextMenu } from './ContextMenu.js';
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
   */
  constructor(container, ganttData, footerSVG, onTaskClick) {
    this.container = container;
    this.ganttData = ganttData;
    this.footerSVG = footerSVG;
    this.onTaskClick = onTaskClick;
    this.chartWrapper = null;
    this.gridElement = null;
    this.draggableGantt = null; // Phase 5: Drag-to-edit functionality
    this.resizableGantt = null; // Phase 2: Bar resizing functionality
    this.contextMenu = null; // Phase 5: Context menu for color changing
    this.isEditMode = false; // Edit mode toggle - default is read-only
    this.titleElement = null; // Reference to the title element for edit mode
    this.legendElement = null; // Reference to the legend element for edit mode
  }

  /**
   * Renders the complete Gantt chart
   * @returns {void}
   */
  render() {
    // PERFORMANCE: Start timing chart render
    const renderTimer = new PerformanceTimer('Gantt Chart Render');

    if (!this.container) {
      return;
    }

    // Sort tasks within swimlanes by start date (earliest first)
    this._sortTasksWithinSwimlanes();

    // Clean up previous ResizeObserver if it exists (prevents memory leaks)
    if (this._titleResizeObserver) {
      this._titleResizeObserver.disconnect();
      this._titleResizeObserver = null;
    }

    // Clear container
    this.container.innerHTML = '';

    // Create the main chart wrapper
    this.chartWrapper = document.createElement('div');
    this.chartWrapper.id = 'gantt-chart-container';

    renderTimer.mark('Container setup complete');

    // Build chart components
    this._addTitle();
    this._addLogo(); // Logo added after title so we can calculate proper alignment

    renderTimer.mark('Header components added');

    this._createGrid();

    renderTimer.mark('Grid created');

    this._addLegend();

    // Add footer stripe
    this._addFooterSVG();

    // Add export and edit mode toggle buttons
    const exportContainer = document.createElement('div');
    exportContainer.className = 'export-container';

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

    // PNG Export button
    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-png-btn';
    exportBtn.className = 'export-button';
    exportBtn.textContent = 'Export as PNG';
    exportBtn.setAttribute('aria-label', 'Export Gantt chart as PNG image');
    exportContainer.appendChild(exportBtn);

    // SVG Export button
    const svgExportBtn = document.createElement('button');
    svgExportBtn.id = 'export-svg-btn';
    svgExportBtn.className = 'export-button';
    svgExportBtn.textContent = 'Export as SVG';
    svgExportBtn.setAttribute('aria-label', 'Export Gantt chart as SVG vector image');
    exportContainer.appendChild(svgExportBtn);

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

    // Add research analysis section (if available) - below everything, collapsible
    this._addResearchAnalysis();

    // Add listeners
    this._addEditModeToggleListener();
    this._addExportListener(); // PNG export
    this._addSvgExportListener(); // SVG export
    this._addCopyUrlListener(); // FEATURE #8: Copy share URL
    this._addKeyboardShortcuts(); // ADVANCED GANTT: Keyboard navigation

    // Add "Today" line
    const today = new Date();
    this.addTodayLine(today);

    // Update sticky header positioning based on actual title container height
    this._updateStickyHeaderPosition();

    // Phase 5: Initialize drag-to-edit functionality
    this._initializeDragToEdit();

    // Restore edit mode state if it was enabled before rendering
    if (this.isEditMode) {
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
    this.titleContainer.style.gap = '10px'; // SCALED: Was 16px - further reduced
    this.titleContainer.style.padding = '8px'; // SCALED: Was 14px - further reduced
    this.titleContainer.style.borderBottom = '1px solid #0D0D0D';
    this.titleContainer.style.backgroundColor = '#0c2340';
    this.titleContainer.style.borderRadius = '8px 8px 0 0';

    // Sticky positioning is handled via CSS, but we need to measure height for header positioning
    // This will be set after the title is rendered in _updateStickyHeaderPosition()

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
   * Updates the sticky header position based on the actual title container height
   * This ensures the date interval header is positioned correctly below the title
   * @private
   */
  _updateStickyHeaderPosition() {
    if (!this.titleContainer || !this.chartWrapper) return;

    // Use requestAnimationFrame to ensure the DOM has rendered
    requestAnimationFrame(() => {
      this._applyStickyHeaderPosition();

      // Set up ResizeObserver to handle dynamic title container size changes
      if (window.ResizeObserver && !this._titleResizeObserver) {
        this._titleResizeObserver = new ResizeObserver(() => {
          this._applyStickyHeaderPosition();
        });
        this._titleResizeObserver.observe(this.titleContainer);
      }
    });
  }

  /**
   * Applies the sticky header position based on current title container height
   * @private
   */
  _applyStickyHeaderPosition() {
    if (!this.titleContainer || !this.chartWrapper || !this.gridElement) return;

    // Get the actual height of the title container
    const titleHeight = this.titleContainer.offsetHeight;

    // Set CSS custom property on the chart container for header positioning
    this.chartWrapper.style.setProperty('--title-height', `${titleHeight}px`);

    // Update all header cells to use the calculated top position
    const headerCells = this.gridElement.querySelectorAll('.gantt-header');
    headerCells.forEach(cell => {
      cell.style.top = `${titleHeight}px`;
    });

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
    const ROW_HEIGHT = 18; // SCALED: Was 24 - further reduced for compact display
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
   * Sorts tasks within each swimlane by start date (earliest first)
   * Tasks with the same start date are sorted alphabetically by title
   * This ensures consistent chronological ordering within each swimlane
   * @private
   */
  _sortTasksWithinSwimlanes() {
    if (!this.ganttData || !this.ganttData.data || this.ganttData.data.length === 0) {
      return;
    }

    const data = this.ganttData.data;
    const sortedData = [];
    let currentSwimlaneTasks = [];

    // Process data and group tasks by swimlane
    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Use strict boolean check to handle cases where isSwimlane might be string "false"
      const isSwimlaneRow = row.isSwimlane === true || row.isSwimlane === 'true';

      if (isSwimlaneRow) {
        // If we have accumulated tasks from a previous swimlane, sort and add them
        if (currentSwimlaneTasks.length > 0) {
          this._sortTasksByStartDate(currentSwimlaneTasks);
          sortedData.push(...currentSwimlaneTasks);
          currentSwimlaneTasks = [];
        }

        // Add the swimlane row
        sortedData.push(row);
      } else {
        // Accumulate tasks for the current swimlane
        currentSwimlaneTasks.push(row);
      }
    }

    // Don't forget to sort and add tasks from the last swimlane
    if (currentSwimlaneTasks.length > 0) {
      this._sortTasksByStartDate(currentSwimlaneTasks);
      sortedData.push(...currentSwimlaneTasks);
    }

    // Replace the original data with sorted data
    this.ganttData.data = sortedData;

  }

  /**
   * Sorts an array of tasks by startCol (ascending), then by title (alphabetically)
   * Tasks with null/undefined startCol are placed at the end
   * @param {Array} tasks - Array of task objects to sort in place
   * @private
   */
  _sortTasksByStartDate(tasks) {
    if (!tasks || tasks.length <= 1) {
      return; // Nothing to sort
    }

    tasks.sort((a, b) => {
      // Get startCol values, defaulting to Infinity for missing/null values
      const aStartCol = this._getStartCol(a);
      const bStartCol = this._getStartCol(b);

      // Primary sort: by startCol (ascending, null values last)
      if (aStartCol !== bStartCol) {
        return aStartCol - bStartCol;
      }

      // Secondary sort: by title (alphabetically A-Z) as tiebreaker
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      return aTitle.localeCompare(bTitle);
    });
  }

  /**
   * Extracts the startCol value from a task, handling various data formats
   * @param {Object} task - The task object
   * @returns {number} The startCol value, or Infinity if not available
   * @private
   */
  _getStartCol(task) {
    if (!task || !task.bar) {
      return Infinity;
    }

    const startCol = task.bar.startCol;

    // Handle null, undefined, or non-numeric values
    if (startCol == null || typeof startCol !== 'number' || isNaN(startCol)) {
      return Infinity;
    }

    return startCol;
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
    headerSvgEl.style.height = '16px'; // SCALED: Was 30px
    headerSvgEl.style.backgroundImage = `url("data:image/svg+xml,${encodedFooterSVG}")`;
    headerSvgEl.style.backgroundRepeat = 'repeat-x';
    headerSvgEl.style.backgroundSize = 'auto 16px'; // SCALED: Was 30px

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
    footerSvgEl.style.height = '16px'; // SCALED: Was 30px
    footerSvgEl.style.backgroundImage = `url("data:image/svg+xml,${encodedFooterSVG}")`;
    footerSvgEl.style.backgroundRepeat = 'repeat-x';
    footerSvgEl.style.backgroundSize = 'auto 16px'; // SCALED: Was 30px

    this.chartWrapper.appendChild(footerSvgEl);
  }

  /**
   * Adds the footer SVG decoration
   * @private
   */
  _addFooterSVG() {
    if (!this.footerSVG) return;

    const encodedFooterSVG = encodeURIComponent(this.footerSVG.replace(/(\r\n|\n|\r)/gm, ''));

    const footerSvgEl = document.createElement('div');
    footerSvgEl.className = 'gantt-footer-svg';

    // Apply all styles inline
    footerSvgEl.style.height = '16px'; // SCALED: Was 30px
    footerSvgEl.style.backgroundImage = `url("data:image/svg+xml,${encodedFooterSVG}")`;
    footerSvgEl.style.backgroundRepeat = 'repeat-x';
    footerSvgEl.style.backgroundSize = 'auto 16px'; // SCALED: Was 30px

    this.chartWrapper.appendChild(footerSvgEl);
  }

  /**
   * Adds the research analysis section below the Gantt chart
   * Shows topic fitness ratings and recommendations in a collapsible panel
   * @private
   */
  _addResearchAnalysis() {
    // Check if research analysis data exists
    if (!this.ganttData.researchAnalysis) {
      return;
    }

    const analysis = this.ganttData.researchAnalysis;

    // Create outer wrapper for the collapsible section
    const analysisWrapper = document.createElement('div');
    analysisWrapper.className = 'research-analysis-wrapper';
    analysisWrapper.id = 'research-analysis';

    // Create collapsible header (always visible)
    const collapseHeader = document.createElement('button');
    collapseHeader.className = 'research-analysis-collapse-header';
    collapseHeader.setAttribute('aria-expanded', 'false');
    collapseHeader.setAttribute('aria-controls', 'research-analysis-content');

    const scoreClass = this._getScoreClass(analysis.overallScore);
    collapseHeader.innerHTML = `
      <span class="collapse-icon">&#9654;</span>
      <span class="collapse-title">Research Quality Analysis</span>
      <span class="collapse-score ${scoreClass}">${analysis.overallScore}/10</span>
    `;

    // Create collapsible content container
    const analysisContent = document.createElement('div');
    analysisContent.className = 'research-analysis-content collapsed';
    analysisContent.id = 'research-analysis-content';

    // Add summary
    if (analysis.summary) {
      const summary = document.createElement('div');
      summary.className = 'research-analysis-summary';
      summary.textContent = analysis.summary;
      analysisContent.appendChild(summary);
    }

    // Create topics table
    if (analysis.topics && analysis.topics.length > 0) {
      const tableContainer = document.createElement('div');
      tableContainer.className = 'research-analysis-table-container';

      const table = document.createElement('table');
      table.className = 'research-analysis-table';

      // Table header
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th>Topic</th>
          <th>Fitness Score</th>
          <th>Tasks Found</th>
          <th>In Chart</th>
          <th>Issues</th>
          <th>Recommendation</th>
        </tr>
      `;
      table.appendChild(thead);

      // Table body
      const tbody = document.createElement('tbody');
      analysis.topics.forEach(topic => {
        const row = document.createElement('tr');
        const topicScoreClass = this._getScoreClass(topic.fitnessScore);
        const includedClass = topic.includedinChart ? 'included-yes' : 'included-no';
        const includedText = topic.includedinChart ? 'Yes' : 'No';

        // Format issues as a list
        const issuesList = topic.issues && topic.issues.length > 0
          ? topic.issues.map(issue => `<li>${this._escapeHtml(issue)}</li>`).join('')
          : '<li>None</li>';

        row.innerHTML = `
          <td class="topic-name">${this._escapeHtml(topic.name)}</td>
          <td class="topic-score"><span class="score-badge ${topicScoreClass}">${topic.fitnessScore}/10</span></td>
          <td class="topic-task-count">${topic.taskCount}</td>
          <td class="topic-included ${includedClass}">${includedText}</td>
          <td class="topic-issues"><ul>${issuesList}</ul></td>
          <td class="topic-recommendation">${this._escapeHtml(topic.recommendation)}</td>
        `;
        tbody.appendChild(row);
      });
      table.appendChild(tbody);

      tableContainer.appendChild(table);
      analysisContent.appendChild(tableContainer);
    }

    // Add legend explaining the scores
    const legend = document.createElement('div');
    legend.className = 'research-analysis-legend';
    legend.innerHTML = `
      <div class="legend-title">Score Guide:</div>
      <div class="legend-items">
        <span class="legend-item"><span class="score-badge score-excellent">9-10</span> Excellent - Clear dates & milestones</span>
        <span class="legend-item"><span class="score-badge score-good">7-8</span> Good - Some gaps in timeline</span>
        <span class="legend-item"><span class="score-badge score-adequate">5-6</span> Adequate - Vague dates</span>
        <span class="legend-item"><span class="score-badge score-poor">3-4</span> Poor - Lacks specific dates</span>
        <span class="legend-item"><span class="score-badge score-inadequate">1-2</span> Inadequate - No timeline data</span>
      </div>
    `;
    analysisContent.appendChild(legend);

    // Add toggle functionality
    collapseHeader.addEventListener('click', () => {
      const isExpanded = collapseHeader.getAttribute('aria-expanded') === 'true';
      collapseHeader.setAttribute('aria-expanded', !isExpanded);
      analysisContent.classList.toggle('collapsed');
      collapseHeader.classList.toggle('expanded');
    });

    // Assemble the wrapper
    analysisWrapper.appendChild(collapseHeader);
    analysisWrapper.appendChild(analysisContent);

    // Append to container (after chart wrapper and export buttons)
    this.container.appendChild(analysisWrapper);

  }

  /**
   * Gets the CSS class for a fitness score
   * @param {number} score - The fitness score (1-10)
   * @returns {string} CSS class name
   * @private
   */
  _getScoreClass(score) {
    if (score >= 9) return 'score-excellent';
    if (score >= 7) return 'score-good';
    if (score >= 5) return 'score-adequate';
    if (score >= 3) return 'score-poor';
    return 'score-inadequate';
  }

  /**
   * Escapes HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   * @private
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Adds edit mode toggle functionality
   * @private
   */
  _addEditModeToggleListener() {
    const editModeBtn = document.getElementById('edit-mode-toggle-btn');

    if (!editModeBtn) {
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

      } else {
        this._disableAllEditFeatures();
        // ACCESSIBILITY: Announce mode change to screen readers
        this._announceToScreenReader('Edit mode disabled. Chart is now read-only.');

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

        // Get the full dimensions of the chart container
        const rect = chartContainer.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        const canvas = await html2canvas(chartContainer, {
          useCORS: true,
          logging: false,
          scale: 2, // Render at 2x resolution for quality
          allowTaint: false,
          backgroundColor: null,
          scrollY: -scrollY,
          scrollX: -scrollX,
          windowWidth: chartContainer.scrollWidth,
          windowHeight: chartContainer.scrollHeight,
          width: chartContainer.scrollWidth,
          height: chartContainer.scrollHeight
        });

        // Create download link and append to DOM (required for some browsers)
        const link = document.createElement('a');
        link.download = 'gantt-chart.png';
        link.href = canvas.toDataURL('image/png');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Performance logging
        const duration = Math.round(performance.now() - startTime);

        // Update button state
        exportBtn.textContent = 'Export as PNG';
        exportBtn.disabled = false;

        // Remove loading overlay
        document.body.removeChild(loadingOverlay);
      } catch (err) {
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
   * Adds SVG export button event listener
   * Exports the Gantt chart as SVG (vector format, perfect alignment)
   * @private
   */
  _addSvgExportListener() {
    const exportBtn = document.getElementById('export-svg-btn');
    const chartContainer = document.getElementById('gantt-chart-container');

    if (!exportBtn || !chartContainer) {
      return;
    }

    exportBtn.addEventListener('click', async () => {
      const startTime = performance.now();

      // Update button state
      exportBtn.textContent = 'Exporting...';
      exportBtn.disabled = true;

      // Create loading overlay
      const loadingOverlay = this._createSvgExportLoadingOverlay();
      document.body.appendChild(loadingOverlay);

      try {
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Get the computed dimensions of the chart
        const bbox = chartContainer.getBoundingClientRect();
        const width = bbox.width;
        const height = bbox.height;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        // Use html2canvas to render the chart (more reliable than foreignObject)
        const canvas = await html2canvas(chartContainer, {
          useCORS: true,
          logging: false,
          scale: 2,
          allowTaint: false,
          backgroundColor: null,
          scrollY: -scrollY,
          scrollX: -scrollX,
          windowWidth: chartContainer.scrollWidth,
          windowHeight: chartContainer.scrollHeight,
          width: chartContainer.scrollWidth,
          height: chartContainer.scrollHeight
        });

        // Convert canvas to base64
        const imageData = canvas.toDataURL('image/png');

        // Create SVG with embedded image (hybrid approach)
        const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>Gantt Chart Export</title>
  <desc>AI-generated Gantt chart exported as SVG with embedded raster image</desc>
  <image x="0" y="0" width="${width}" height="${height}"
         xlink:href="${imageData}"
         preserveAspectRatio="xMidYMid meet"/>
</svg>`;

        // Create blob and download (append to DOM for browser compatibility)
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'gantt-chart.svg';
        link.href = url;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Performance logging
        const duration = Math.round(performance.now() - startTime);

        // Update button state
        exportBtn.textContent = 'Export as SVG';
        exportBtn.disabled = false;

        // Remove loading overlay
        document.body.removeChild(loadingOverlay);
      } catch (err) {
        exportBtn.textContent = 'Export as SVG';
        exportBtn.disabled = false;

        if (loadingOverlay.parentNode) {
          document.body.removeChild(loadingOverlay);
        }

        alert('Error exporting chart as SVG. See console for details.');
      }
    });
  }

  /**
   * Creates a loading overlay for SVG export operations
   * @returns {HTMLElement} Loading overlay element
   * @private
   */
  _createSvgExportLoadingOverlay() {
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
    message.textContent = 'Generating vector SVG...';
    message.style.cssText = `
      font-size: 16px;
      font-weight: 500;
    `;

    overlay.appendChild(spinner);
    overlay.appendChild(message);

    return overlay;
  }
  /**
   * FEATURE #8: Adds Copy Share URL button functionality
   * Copies the current chart URL to clipboard for sharing
   * @private
   */
  _addCopyUrlListener() {
    const copyUrlBtn = document.getElementById('copy-url-btn');
    if (!copyUrlBtn) {
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

        // Reset button after 2 seconds
        setTimeout(() => {
          copyUrlBtn.textContent = originalText;
          copyUrlBtn.style.backgroundColor = ''; // Reset to default
        }, 2000);

      } catch (err) {

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
   * T = Timeline (Roadmap)
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
        case 't':
          // T = Timeline (navigate to roadmap view)
          if (this.router) {
            this.router.navigate('roadmap');
          }
          break;

        default:
          // No action for other keys
          break;
      }
    });

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
    }
  }

  /**
   * Phase 5: Initializes drag-to-edit functionality
   * Phase 2: Initializes bar resizing functionality
   * @private
   */
  _initializeDragToEdit() {
    if (!this.gridElement) {
      return;
    }

    // Create callback for task updates (drag)
    const onTaskUpdate = async (taskInfo) => {

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
        } catch (error) {
          throw error; // Re-throw to trigger rollback in DraggableGantt
        }
      }
    };

    // Phase 2: Create callback for task resize
    const onTaskResize = async (taskInfo) => {

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
        } catch (error) {
          throw error; // Re-throw to trigger rollback in ResizableGantt
        }
      }
    };

    // Phase 5: Create callback for color change
    const onColorChange = async (taskInfo) => {

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

          // Refresh legend to include new color if needed
          this._refreshLegend();
        } catch (error) {
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
    }
  }

  /**
   * Phase 5: Disables drag-to-edit functionality
   * @public
   */
  disableDragToEdit() {
    if (this.draggableGantt) {
      this.draggableGantt.disableDragging();
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

  }

  /**
   * Phase 3: Removes a task row at the specified index
   * @param {number} taskIndex - Index of the task to remove
   * @public
   */
  removeTaskRow(taskIndex) {
    const taskData = this.ganttData.data[taskIndex];

    if (!taskData) {
      return;
    }

    // Don't allow removing swimlanes
    if (taskData.isSwimlane) {
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
