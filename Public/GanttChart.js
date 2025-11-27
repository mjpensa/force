import { CONFIG } from './config.js';
import { safeGetElement, findTodayColumnPosition, buildLegend, PerformanceTimer } from './Utils.js';
import { DraggableGantt } from './DraggableGantt.js';
import { ResizableGantt } from './ResizableGantt.js';
import { ContextMenu } from './ContextMenu.js';
export class GanttChart {
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
  render() {
    const renderTimer = new PerformanceTimer('Gantt Chart Render');
    if (!this.container) {
      return;
    }
    this._sortTasksWithinSwimlanes();
    if (this._titleResizeObserver) {
      this._titleResizeObserver.disconnect();
      this._titleResizeObserver = null;
    }
    this.container.innerHTML = '';
    this.chartWrapper = document.createElement('div');
    this.chartWrapper.id = 'gantt-chart-container';
    renderTimer.mark('Container setup complete');
    this._addTitle();
    this._addLogo(); // Logo added after title so we can calculate proper alignment
    renderTimer.mark('Header components added');
    this._createGrid();
    renderTimer.mark('Grid created');
    this._addLegend();
    this._addFooterSVG();
    const exportContainer = document.createElement('div');
    exportContainer.className = 'export-container';
    const editModeBtn = document.createElement('button');
    editModeBtn.id = 'edit-mode-toggle-btn';
    editModeBtn.className = 'edit-mode-toggle-button';
    editModeBtn.textContent = this.isEditMode ? '🔓 Edit Mode: ON' : '🔒 Edit Mode: OFF';
    editModeBtn.title = 'Toggle edit mode to enable/disable chart customization';
    editModeBtn.setAttribute('aria-label', 'Toggle edit mode to enable or disable chart customization');
    editModeBtn.setAttribute('aria-pressed', this.isEditMode ? 'true' : 'false');
    editModeBtn.style.backgroundColor = this.isEditMode ? '#50AF7B' : '#BA3930';
    exportContainer.appendChild(editModeBtn);
    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-png-btn';
    exportBtn.className = 'export-button';
    exportBtn.textContent = 'Export as PNG';
    exportBtn.setAttribute('aria-label', 'Export Gantt chart as PNG image');
    exportContainer.appendChild(exportBtn);
    const svgExportBtn = document.createElement('button');
    svgExportBtn.id = 'export-svg-btn';
    svgExportBtn.className = 'export-button';
    svgExportBtn.textContent = 'Export as SVG';
    svgExportBtn.setAttribute('aria-label', 'Export Gantt chart as SVG vector image');
    exportContainer.appendChild(svgExportBtn);
    const copyUrlBtn = document.createElement('button');
    copyUrlBtn.id = 'copy-url-btn';
    copyUrlBtn.className = 'copy-url-button';
    copyUrlBtn.textContent = '🔗 Copy Share URL';
    copyUrlBtn.title = 'Copy shareable URL to clipboard (chart is saved to database)';
    copyUrlBtn.setAttribute('aria-label', 'Copy shareable URL to clipboard');
    exportContainer.appendChild(copyUrlBtn);
    this.container.appendChild(this.chartWrapper);
    this.container.appendChild(exportContainer);
    this._addResearchAnalysis();
    this._addEditModeToggleListener();
    this._addExportListener(); // PNG export
    this._addSvgExportListener(); // SVG export
    this._addCopyUrlListener(); // FEATURE #8: Copy share URL
    this._addKeyboardShortcuts(); // ADVANCED GANTT: Keyboard navigation
    const today = new Date();
    this.addTodayLine(today);
    this._updateStickyHeaderPosition();
    this._initializeDragToEdit();
    if (this.isEditMode) {
      this._enableAllEditFeatures();
    }
    renderTimer.mark('All components and listeners initialized');
    renderTimer.end();
  }
  _addLogo() {
    const logoImg = document.createElement('img');
    logoImg.src = '/bip_logo.png';
    logoImg.alt = 'BIP Logo';
    logoImg.className = 'gantt-logo';
    logoImg.style.height = `${CONFIG.SIZES.LOGO_HEIGHT}px`;
    logoImg.style.width = 'auto';
    logoImg.style.flexShrink = '0'; // Prevent logo from shrinking
    if (this.titleContainer && this.titleElement) {
      // Insert logo before title to position it on the left
      this.titleContainer.insertBefore(logoImg, this.titleElement);
    }
  }
  _addTitle() {
    this.titleContainer = document.createElement('div');
    this.titleContainer.className = 'gantt-title-container';
    this.titleContainer.style.display = 'flex';
    this.titleContainer.style.justifyContent = 'space-between';
    this.titleContainer.style.alignItems = 'center'; // Vertically center logo with title
    this.titleContainer.style.gap = '10px'; // SCALED: Was 16px - further reduced
    this.titleContainer.style.padding = '8px'; // SCALED: Was 14px - further reduced
    this.titleContainer.style.borderBottom = '1px solid #0D0D0D';
    this.titleContainer.style.backgroundColor = '#0c2340';
    this.titleContainer.style.borderRadius = '8px 8px 0 0';
    this.titleElement = document.createElement('div');
    this.titleElement.className = 'gantt-title';
    this.titleElement.textContent = this.ganttData.title;
    this.titleElement.style.flex = '1'; // Allow title to grow and wrap if needed
    this.titleElement.style.padding = '0'; // Remove padding since container has it
    this.titleElement.style.border = 'none'; // Remove border since container has it
    this.titleElement.style.background = 'none'; // Remove background since container has it
    this.titleElement.style.borderRadius = '0'; // Remove border radius since container has it
    this.titleElement.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.isEditMode) {
        this._makeChartTitleEditable();
      }
    });
    this.titleContainer.appendChild(this.titleElement);
    this.chartWrapper.appendChild(this.titleContainer);
  }
  _createGrid() {
    this.gridElement = document.createElement('div');
    this.gridElement.className = 'gantt-grid';
    this.gridElement.setAttribute('role', 'grid');
    this.gridElement.setAttribute('aria-label', 'Project timeline Gantt chart');
    this.gridElement.setAttribute('aria-readonly', 'true'); // Will be updated when edit mode is toggled
    const numCols = this.ganttData.timeColumns.length;
    this.gridElement.style.gridTemplateColumns = `max-content repeat(${numCols}, 1fr)`;
    this._createHeaderRow(numCols);
    this._createDataRows(numCols);
    this.chartWrapper.appendChild(this.gridElement);
  }
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
    this.gridElement.appendChild(headerFragment);
  }
  _updateStickyHeaderPosition() {
    if (!this.titleContainer || !this.chartWrapper) return;
    requestAnimationFrame(() => {
      this._applyStickyHeaderPosition();
      if (window.ResizeObserver && !this._titleResizeObserver) {
        this._titleResizeObserver = new ResizeObserver(() => {
          this._applyStickyHeaderPosition();
        });
        this._titleResizeObserver.observe(this.titleContainer);
      }
    });
  }
  _applyStickyHeaderPosition() {
    if (!this.titleContainer || !this.chartWrapper || !this.gridElement) return;
    const titleHeight = this.titleContainer.offsetHeight;
    this.chartWrapper.style.setProperty('--title-height', `${titleHeight}px`);
    const headerCells = this.gridElement.querySelectorAll('.gantt-header');
    headerCells.forEach(cell => {
      cell.style.top = `${titleHeight}px`;
    });
  }
  _createDataRows(numCols) {
    const totalRows = this.ganttData.data.length;
    const VIRTUALIZATION_THRESHOLD = 100;
    if (totalRows > VIRTUALIZATION_THRESHOLD) {
      this._createVirtualizedRows(numCols);
      return;
    }
    const rowsFragment = document.createDocumentFragment();
    this.ganttData.data.forEach((row, dataIndex) => {
      const isSwimlane = row.isSwimlane;
      const labelEl = document.createElement('div');
      labelEl.className = `gantt-row-label ${isSwimlane ? 'swimlane' : 'task'}`;
      const labelContent = document.createElement('span');
      labelContent.className = 'label-content';
      labelContent.textContent = row.title;
      labelEl.appendChild(labelContent);
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
      labelContent.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (this.isEditMode) {
          this._makeEditable(labelContent, dataIndex);
        }
      });
      const barAreaEl = this._createBarArea(row, numCols, isSwimlane, dataIndex);
      if (!isSwimlane && row.bar && row.bar.startCol != null && this.onTaskClick) {
        const taskIdentifier = {
          taskName: row.title,
          entity: row.entity,
          sessionId: this.ganttData.sessionId
        };
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
      if (!isSwimlane) {
        this._addHoverEffects(labelEl, barAreaEl);
      }
      rowsFragment.appendChild(labelEl);
      rowsFragment.appendChild(barAreaEl);
    });
    this.gridElement.appendChild(rowsFragment);
  }
  _createBarArea(row, numCols, isSwimlane, dataIndex) {
    const barAreaEl = document.createElement('div');
    barAreaEl.className = `gantt-bar-area ${isSwimlane ? 'swimlane' : 'task'}`;
    barAreaEl.style.gridColumn = `2 / span ${numCols}`;
    barAreaEl.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
    barAreaEl.style.position = 'relative';
    barAreaEl.style.display = 'grid';
    barAreaEl.setAttribute('data-row-id', `row-${dataIndex}`);
    barAreaEl.setAttribute('data-task-index', dataIndex);
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
  _createVirtualizedRows(numCols) {
    const ROW_HEIGHT = 18; // SCALED: Was 24 - further reduced for compact display
    const BUFFER_ROWS = 20; // Number of extra rows to render above/below viewport
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'gantt-virtualized-container';
    scrollContainer.style.height = `${this.ganttData.data.length * ROW_HEIGHT}px`;
    scrollContainer.style.position = 'relative';
    scrollContainer.style.overflow = 'auto';
    scrollContainer.style.maxHeight = '600px'; // Limit viewport height
    const viewport = document.createElement('div');
    viewport.className = 'gantt-virtualized-viewport';
    viewport.style.position = 'absolute';
    viewport.style.top = '0';
    viewport.style.left = '0';
    viewport.style.right = '0';
    this.virtualScroll = {
      container: scrollContainer,
      viewport: viewport,
      rowHeight: ROW_HEIGHT,
      bufferRows: BUFFER_ROWS,
      numCols: numCols,
      visibleStart: 0,
      visibleEnd: Math.min(50, this.ganttData.data.length) // Initial render
    };
    this._renderVisibleRows();
    scrollContainer.addEventListener('scroll', () => {
      this._handleVirtualScroll();
    });
    scrollContainer.appendChild(viewport);
    this.gridElement.appendChild(scrollContainer);
  }
  _renderVisibleRows() {
    if (!this.virtualScroll) return;
    const { viewport, visibleStart, visibleEnd, rowHeight, numCols } = this.virtualScroll;
    viewport.innerHTML = '';
    const rowsFragment = document.createDocumentFragment();
    for (let dataIndex = visibleStart; dataIndex < visibleEnd; dataIndex++) {
      const row = this.ganttData.data[dataIndex];
      if (!row) continue;
      const isSwimlane = row.isSwimlane;
      const rowContainer = document.createElement('div');
      rowContainer.className = 'gantt-virtual-row';
      rowContainer.style.position = 'absolute';
      rowContainer.style.top = `${dataIndex * rowHeight}px`;
      rowContainer.style.left = '0';
      rowContainer.style.right = '0';
      rowContainer.style.height = `${rowHeight}px`;
      rowContainer.style.display = 'grid';
      rowContainer.style.gridTemplateColumns = this.gridElement.style.gridTemplateColumns;
      const labelEl = this._createRowLabel(row, dataIndex, isSwimlane);
      const barAreaEl = this._createBarArea(row, numCols, isSwimlane, dataIndex);
      rowContainer.appendChild(labelEl);
      rowContainer.appendChild(barAreaEl);
      rowsFragment.appendChild(rowContainer);
    }
    viewport.appendChild(rowsFragment);
  }
  _handleVirtualScroll() {
    if (!this.virtualScroll) return;
    const { container, rowHeight, bufferRows } = this.virtualScroll;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const newVisibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
    const newVisibleEnd = Math.min(
      this.ganttData.data.length,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + bufferRows
    );
    if (newVisibleStart !== this.virtualScroll.visibleStart ||
        newVisibleEnd !== this.virtualScroll.visibleEnd) {
      this.virtualScroll.visibleStart = newVisibleStart;
      this.virtualScroll.visibleEnd = newVisibleEnd;
      if (this.virtualScrollTimeout) {
        clearTimeout(this.virtualScrollTimeout);
      }
      this.virtualScrollTimeout = setTimeout(() => {
        this._renderVisibleRows();
      }, 50); // 50ms debounce
    }
  }
  _createRowLabel(row, dataIndex, isSwimlane) {
    const labelEl = document.createElement('div');
    labelEl.className = `gantt-row-label ${isSwimlane ? 'swimlane' : 'task'}`;
    const labelContent = document.createElement('span');
    labelContent.className = 'label-content';
    labelContent.textContent = row.title;
    labelEl.appendChild(labelContent);
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
    labelContent.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.isEditMode) {
        this._makeEditable(labelContent, dataIndex);
      }
    });
    return labelEl;
  }
  _addHoverEffects(labelEl, barAreaEl) {
    labelEl.addEventListener('mouseenter', () => {
      barAreaEl.classList.add('row-hover');
    });
    labelEl.addEventListener('mouseleave', () => {
      barAreaEl.classList.remove('row-hover');
    });
    barAreaEl.addEventListener('mouseenter', () => {
      barAreaEl.classList.add('row-hover');
    });
    barAreaEl.addEventListener('mouseleave', () => {
      barAreaEl.classList.remove('row-hover');
    });
  }
  _addLegend() {
    if (!this.ganttData.legend) {
      this.ganttData.legend = [];
    }
    this._updateLegendWithUsedColors();
    if (this.ganttData.legend.length === 0) return;
    this.legendElement = document.createElement('div');
    this.legendElement.className = 'gantt-legend';
    const legendLine = document.createElement('div');
    legendLine.className = 'legend-line';
    const title = document.createElement('span');
    title.className = 'legend-title';
    title.textContent = 'Legend:';
    legendLine.appendChild(title);
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
  _sortTasksWithinSwimlanes() {
    if (!this.ganttData || !this.ganttData.data || this.ganttData.data.length === 0) {
      return;
    }
    const data = this.ganttData.data;
    const sortedData = [];
    let currentSwimlaneTasks = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const isSwimlaneRow = row.isSwimlane === true || row.isSwimlane === 'true';
      if (isSwimlaneRow) {
        if (currentSwimlaneTasks.length > 0) {
          this._sortTasksByStartDate(currentSwimlaneTasks);
          sortedData.push(...currentSwimlaneTasks);
          currentSwimlaneTasks = [];
        }
        sortedData.push(row);
      } else {
        currentSwimlaneTasks.push(row);
      }
    }
    if (currentSwimlaneTasks.length > 0) {
      this._sortTasksByStartDate(currentSwimlaneTasks);
      sortedData.push(...currentSwimlaneTasks);
    }
    this.ganttData.data = sortedData;
  }
  _sortTasksByStartDate(tasks) {
    if (!tasks || tasks.length <= 1) {
      return; // Nothing to sort
    }
    tasks.sort((a, b) => {
      const aStartCol = this._getStartCol(a);
      const bStartCol = this._getStartCol(b);
      if (aStartCol !== bStartCol) {
        return aStartCol - bStartCol;
      }
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      return aTitle.localeCompare(bTitle);
    });
  }
  _getStartCol(task) {
    if (!task || !task.bar) {
      return Infinity;
    }
    const startCol = task.bar.startCol;
    if (startCol == null || typeof startCol !== 'number' || isNaN(startCol)) {
      return Infinity;
    }
    return startCol;
  }
  _refreshLegend() {
    if (!this.legendElement) return;
    const originalLength = this.ganttData.legend.length;
    this._updateLegendWithUsedColors();
    if (this.ganttData.legend.length > originalLength) {
      const wasEditMode = this.isEditMode;
      this.legendElement.remove();
      this._addLegend();
      if (wasEditMode && this.legendElement) {
        this.legendElement.classList.add('edit-mode-enabled');
      }
    }
  }
  _addHeaderSVG() {
    if (!this.footerSVG) return;
    const encodedFooterSVG = encodeURIComponent(this.footerSVG.replace(/(\r\n|\n|\r)/gm, ''));
    const headerSvgEl = document.createElement('div');
    headerSvgEl.className = 'gantt-header-svg';
    headerSvgEl.style.height = '16px'; // SCALED: Was 30px
    headerSvgEl.style.backgroundImage = `url("data:image/svg+xml,${encodedFooterSVG}")`;
    headerSvgEl.style.backgroundRepeat = 'repeat-x';
    headerSvgEl.style.backgroundSize = 'auto 16px'; // SCALED: Was 30px
    this.chartWrapper.appendChild(headerSvgEl);
  }
  _addGanttFooterSVG() {
    if (!this.footerSVG) return;
    const encodedFooterSVG = encodeURIComponent(this.footerSVG.replace(/(\r\n|\n|\r)/gm, ''));
    const footerSvgEl = document.createElement('div');
    footerSvgEl.className = 'gantt-footer-svg';
    footerSvgEl.style.height = '16px'; // SCALED: Was 30px
    footerSvgEl.style.backgroundImage = `url("data:image/svg+xml,${encodedFooterSVG}")`;
    footerSvgEl.style.backgroundRepeat = 'repeat-x';
    footerSvgEl.style.backgroundSize = 'auto 16px'; // SCALED: Was 30px
    this.chartWrapper.appendChild(footerSvgEl);
  }
  _addFooterSVG() {
    if (!this.footerSVG) return;
    const encodedFooterSVG = encodeURIComponent(this.footerSVG.replace(/(\r\n|\n|\r)/gm, ''));
    const footerSvgEl = document.createElement('div');
    footerSvgEl.className = 'gantt-footer-svg';
    footerSvgEl.style.height = '16px'; // SCALED: Was 30px
    footerSvgEl.style.backgroundImage = `url("data:image/svg+xml,${encodedFooterSVG}")`;
    footerSvgEl.style.backgroundRepeat = 'repeat-x';
    footerSvgEl.style.backgroundSize = 'auto 16px'; // SCALED: Was 30px
    this.chartWrapper.appendChild(footerSvgEl);
  }
  _addResearchAnalysis() {
    if (!this.ganttData.researchAnalysis) {
      return;
    }
    const analysis = this.ganttData.researchAnalysis;
    const analysisWrapper = document.createElement('div');
    analysisWrapper.className = 'research-analysis-wrapper';
    analysisWrapper.id = 'research-analysis';
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
    const analysisContent = document.createElement('div');
    analysisContent.className = 'research-analysis-content collapsed';
    analysisContent.id = 'research-analysis-content';
    if (analysis.summary) {
      const summary = document.createElement('div');
      summary.className = 'research-analysis-summary';
      summary.textContent = analysis.summary;
      analysisContent.appendChild(summary);
    }
    if (analysis.topics && analysis.topics.length > 0) {
      const tableContainer = document.createElement('div');
      tableContainer.className = 'research-analysis-table-container';
      const table = document.createElement('table');
      table.className = 'research-analysis-table';
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
      const tbody = document.createElement('tbody');
      analysis.topics.forEach(topic => {
        const row = document.createElement('tr');
        const topicScoreClass = this._getScoreClass(topic.fitnessScore);
        const includedClass = topic.includedinChart ? 'included-yes' : 'included-no';
        const includedText = topic.includedinChart ? 'Yes' : 'No';
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
    collapseHeader.addEventListener('click', () => {
      const isExpanded = collapseHeader.getAttribute('aria-expanded') === 'true';
      collapseHeader.setAttribute('aria-expanded', !isExpanded);
      analysisContent.classList.toggle('collapsed');
      collapseHeader.classList.toggle('expanded');
    });
    analysisWrapper.appendChild(collapseHeader);
    analysisWrapper.appendChild(analysisContent);
    this.container.appendChild(analysisWrapper);
  }
  _getScoreClass(score) {
    if (score >= 9) return 'score-excellent';
    if (score >= 7) return 'score-good';
    if (score >= 5) return 'score-adequate';
    if (score >= 3) return 'score-poor';
    return 'score-inadequate';
  }
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  _addEditModeToggleListener() {
    const editModeBtn = document.getElementById('edit-mode-toggle-btn');
    if (!editModeBtn) {
      return;
    }
    editModeBtn.addEventListener('click', () => {
      this.isEditMode = !this.isEditMode;
      editModeBtn.textContent = this.isEditMode ? '🔓 Edit Mode: ON' : '🔒 Edit Mode: OFF';
      editModeBtn.style.backgroundColor = this.isEditMode ? '#50AF7B' : '#BA3930';
      editModeBtn.setAttribute('aria-pressed', this.isEditMode ? 'true' : 'false');
      if (this.isEditMode) {
        this._enableAllEditFeatures();
        this._announceToScreenReader('Edit mode enabled. You can now drag, resize, and customize chart elements.');
      } else {
        this._disableAllEditFeatures();
        this._announceToScreenReader('Edit mode disabled. Chart is now read-only.');
      }
    });
  }
  _addExportListener() {
    const exportBtn = document.getElementById('export-png-btn');
    const chartContainer = document.getElementById('gantt-chart-container');
    if (!exportBtn || !chartContainer) {
      return;
    }
    exportBtn.addEventListener('click', async () => {
      const startTime = performance.now();
      exportBtn.textContent = 'Exporting...';
      exportBtn.disabled = true;
      const loadingOverlay = this._createExportLoadingOverlay();
      document.body.appendChild(loadingOverlay);
      try {
        await new Promise(resolve => requestAnimationFrame(resolve));
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
        const link = document.createElement('a');
        link.download = 'gantt-chart.png';
        link.href = canvas.toDataURL('image/png');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        const duration = Math.round(performance.now() - startTime);
        exportBtn.textContent = 'Export as PNG';
        exportBtn.disabled = false;
        document.body.removeChild(loadingOverlay);
      } catch (err) {
        exportBtn.textContent = 'Export as PNG';
        exportBtn.disabled = false;
        if (loadingOverlay.parentNode) {
          document.body.removeChild(loadingOverlay);
        }
        alert('Error exporting chart. See console for details.');
      }
    });
  }
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
  _addSvgExportListener() {
    const exportBtn = document.getElementById('export-svg-btn');
    const chartContainer = document.getElementById('gantt-chart-container');
    if (!exportBtn || !chartContainer) {
      return;
    }
    exportBtn.addEventListener('click', async () => {
      const startTime = performance.now();
      exportBtn.textContent = 'Exporting...';
      exportBtn.disabled = true;
      const loadingOverlay = this._createSvgExportLoadingOverlay();
      document.body.appendChild(loadingOverlay);
      try {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const bbox = chartContainer.getBoundingClientRect();
        const width = bbox.width;
        const height = bbox.height;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
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
        const imageData = canvas.toDataURL('image/png');
        const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>Gantt Chart Export</title>
  <desc>AI-generated Gantt chart exported as SVG with embedded raster image</desc>
  <image x="0" y="0" width="${width}" height="${height}"
         xlink:href="${imageData}"
         preserveAspectRatio="xMidYMid meet"/>
</svg>`;
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
        const duration = Math.round(performance.now() - startTime);
        exportBtn.textContent = 'Export as SVG';
        exportBtn.disabled = false;
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
  _addCopyUrlListener() {
    const copyUrlBtn = document.getElementById('copy-url-btn');
    if (!copyUrlBtn) {
      return;
    }
    copyUrlBtn.addEventListener('click', async () => {
      const currentUrl = window.location.href;
      try {
        await navigator.clipboard.writeText(currentUrl);
        const originalText = copyUrlBtn.textContent;
        copyUrlBtn.textContent = '✓ URL Copied!';
        copyUrlBtn.style.backgroundColor = '#50AF7B'; // Green
        this._showNotification('Chart URL copied to clipboard! Share this link to give others access to this chart.', 'success');
        this._announceToScreenReader('Chart URL copied to clipboard');
        setTimeout(() => {
          copyUrlBtn.textContent = originalText;
          copyUrlBtn.style.backgroundColor = ''; // Reset to default
        }, 2000);
      } catch (err) {
        alert(`Copy this URL to share:\n\n${currentUrl}`);
        this._showNotification('Could not copy URL automatically. Please copy it from the address bar.', 'error');
      }
    });
  }
  _showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `chart-notification chart-notification-${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
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
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
  _addKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }
      const key = e.key.toLowerCase();
      switch (key) {
        case 't':
          if (this.router) {
            this.router.navigate('roadmap');
          }
          break;
        default:
          break;
      }
    });
  }
  _announceToScreenReader(message) {
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
    liveRegion.textContent = message;
    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = '';
      }
    }, 5000);
  }
  addTodayLine(today) {
    if (!this.gridElement) return;
    const position = findTodayColumnPosition(today, this.ganttData.timeColumns);
    if (!position) return; // Today is not in the chart's range
    try {
      const labelCol = this.gridElement.querySelector('.gantt-header-label');
      const headerRow = this.gridElement.querySelector('.gantt-header');
      if (!labelCol || !headerRow) return;
      const gridRect = this.gridElement.getBoundingClientRect();
      const containerRect = this.gridElement.parentElement.getBoundingClientRect();
      const leftMargin = gridRect.left - containerRect.left;
      const headerHeight = headerRow.offsetHeight;
      const gridClientWidth = this.gridElement.clientWidth;
      const labelColWidth = labelCol.offsetWidth;
      const timeColAreaWidth = gridClientWidth - labelColWidth;
      const oneColWidth = timeColAreaWidth / this.ganttData.timeColumns.length;
      const todayOffset = (position.index + position.percentage) * oneColWidth;
      const lineLeftPosition = labelColWidth + todayOffset;
      const todayLine = document.createElement('div');
      todayLine.className = 'gantt-today-line';
      todayLine.style.top = `${headerHeight}px`;
      todayLine.style.bottom = '0';
      todayLine.style.left = `${lineLeftPosition}px`;
      this.gridElement.appendChild(todayLine);
    } catch (e) {
    }
  }
  _initializeDragToEdit() {
    if (!this.gridElement) {
      return;
    }
    const onTaskUpdate = async (taskInfo) => {
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
    const onTaskResize = async (taskInfo) => {
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
    const onColorChange = async (taskInfo) => {
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
          this._refreshLegend();
        } catch (error) {
          throw error; // Re-throw to trigger rollback in ContextMenu
        }
      }
    };
    this.draggableGantt = new DraggableGantt(
      this.gridElement,
      this.ganttData,
      onTaskUpdate
    );
    this.resizableGantt = new ResizableGantt(
      this.gridElement,
      this.ganttData,
      onTaskResize
    );
    this.contextMenu = new ContextMenu(
      this.gridElement,
      this.ganttData,
      onColorChange
    );
    this._addCursorFeedback();
  }
  _addCursorFeedback() {
    this.gridElement.addEventListener('mousemove', (event) => {
      const bar = event.target.closest('.gantt-bar');
      if (!bar) return;
      if (!this.isEditMode) {
        bar.style.cursor = 'pointer';
        return;
      }
      if (document.body.classList.contains('dragging') ||
          document.body.classList.contains('resizing')) {
        return;
      }
      const rect = bar.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const HANDLE_WIDTH = 10; // Updated to match new resize handle width
      if (x <= HANDLE_WIDTH || x >= rect.width - HANDLE_WIDTH) {
        bar.style.cursor = 'ew-resize';
      } else {
        bar.style.cursor = 'move';
      }
    });
  }
  _enableAllEditFeatures() {
      draggable: !!this.draggableGantt,
      resizable: !!this.resizableGantt,
      contextMenu: !!this.contextMenu
    });
    if (this.draggableGantt) {
      this.draggableGantt.enableDragging();
    }
    if (this.resizableGantt) {
      this.resizableGantt.enableResizing();
    }
    if (this.contextMenu) {
      this.contextMenu.enable();
    }
    this.gridElement.classList.add('edit-mode-enabled');
    this.gridElement.setAttribute('aria-readonly', 'false');
    if (this.titleElement) {
      this.titleElement.classList.add('edit-mode-enabled');
    }
    if (this.legendElement) {
      this.legendElement.classList.add('edit-mode-enabled');
    }
  }
  _disableAllEditFeatures() {
    if (this.draggableGantt) {
      this.draggableGantt.disableDragging();
    }
    if (this.resizableGantt) {
      this.resizableGantt.disableResizing();
    }
    if (this.contextMenu) {
      this.contextMenu.disable();
    }
    this.gridElement.classList.remove('edit-mode-enabled');
    this.gridElement.setAttribute('aria-readonly', 'true');
    if (this.titleElement) {
      this.titleElement.classList.remove('edit-mode-enabled');
    }
    if (this.legendElement) {
      this.legendElement.classList.remove('edit-mode-enabled');
    }
    const bars = this.gridElement.querySelectorAll('.gantt-bar');
    bars.forEach(bar => {
      bar.style.cursor = 'pointer';
    });
  }
  enableDragToEdit() {
    if (this.draggableGantt) {
      this.draggableGantt.enableDragging();
    }
  }
  disableDragToEdit() {
    if (this.draggableGantt) {
      this.draggableGantt.disableDragging();
    }
  }
  addNewTaskRow(afterIndex) {
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
    this.ganttData.data.splice(afterIndex + 1, 0, newTask);
    this.render();
  }
  removeTaskRow(taskIndex) {
    const taskData = this.ganttData.data[taskIndex];
    if (!taskData) {
      return;
    }
    if (taskData.isSwimlane) {
      return;
    }
    if (!confirm(`Delete task "${taskData.title}"?`)) {
      return;
    }
    this.ganttData.data.splice(taskIndex, 1);
    this.render();
  }
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
  _makeEditable(labelElement, taskIndex) {
    const originalText = labelElement.textContent;
    labelElement.setAttribute('contenteditable', 'true');
    labelElement.classList.add('editing');
    labelElement.focus();
    const range = document.createRange();
    range.selectNodeContents(labelElement);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const saveChanges = async () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');
      const newText = labelElement.textContent.trim();
      labelElement.textContent = newText;
      if (newText && newText !== originalText) {
        this.ganttData.data[taskIndex].title = newText;
      } else {
        labelElement.textContent = originalText;
      }
    };
    const cancelEdit = () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');
      labelElement.textContent = originalText;
    };
    const blurHandler = () => {
      saveChanges();
      labelElement.removeEventListener('blur', blurHandler);
    };
    labelElement.addEventListener('blur', blurHandler);
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
  _makeChartTitleEditable() {
    if (!this.titleElement) return;
    const originalText = this.titleElement.textContent;
    this.titleElement.setAttribute('contenteditable', 'true');
    this.titleElement.classList.add('editing');
    this.titleElement.focus();
    const range = document.createRange();
    range.selectNodeContents(this.titleElement);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const saveChanges = async () => {
      this.titleElement.setAttribute('contenteditable', 'false');
      this.titleElement.classList.remove('editing');
      const newText = this.titleElement.textContent.trim();
      this.titleElement.textContent = newText;
      if (newText && newText !== originalText) {
        this.ganttData.title = newText;
      } else {
        this.titleElement.textContent = originalText;
      }
    };
    const cancelEdit = () => {
      this.titleElement.setAttribute('contenteditable', 'false');
      this.titleElement.classList.remove('editing');
      this.titleElement.textContent = originalText;
    };
    const blurHandler = () => {
      saveChanges();
      this.titleElement.removeEventListener('blur', blurHandler);
    };
    this.titleElement.addEventListener('blur', blurHandler);
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
  _updateLegendWithUsedColors() {
    const usedColors = new Set();
    this.ganttData.data.forEach(row => {
      if (row.bar && row.bar.color) {
        usedColors.add(row.bar.color);
      }
    });
    const legendColors = new Set(this.ganttData.legend.map(item => item.color));
    usedColors.forEach(color => {
      if (!legendColors.has(color)) {
        this.ganttData.legend.push({
          color: color,
          label: `[Define ${this._formatColorName(color)}]`
        });
      }
    });
  }
  _formatColorName(colorKey) {
    return colorKey
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  _makeLegendLabelEditable(labelElement, legendIndex) {
    const originalText = labelElement.textContent;
    labelElement.setAttribute('contenteditable', 'true');
    labelElement.classList.add('editing');
    labelElement.focus();
    const range = document.createRange();
    range.selectNodeContents(labelElement);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const saveChanges = async () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');
      const newText = labelElement.textContent.trim();
      labelElement.textContent = newText;
      if (newText && newText !== originalText) {
        this.ganttData.legend[legendIndex].label = newText;
      } else {
        labelElement.textContent = originalText;
      }
    };
    const cancelEdit = () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');
      labelElement.textContent = originalText;
    };
    const blurHandler = () => {
      saveChanges();
      labelElement.removeEventListener('blur', blurHandler);
    };
    labelElement.addEventListener('blur', blurHandler);
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
