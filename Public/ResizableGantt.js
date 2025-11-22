/**
 * ResizableGantt Module
 * Phase 2 Enhancement: Bar Resizing for Start/End Dates
 * Enables interactive resizing of Gantt chart bars via mouse drag
 */

import { CONFIG } from './config.js';

/**
 * ResizableGantt Class
 * Adds resize handles to Gantt chart bars for adjusting start and end dates
 */
export class ResizableGantt {
  /**
   * Creates a new ResizableGantt instance
   * @param {HTMLElement} gridElement - The gantt grid element containing bars
   * @param {Object} ganttData - The chart data
   * @param {Function} onTaskResize - Callback when a task is resized
   */
  constructor(gridElement, ganttData, onTaskResize) {
    this.gridElement = gridElement;
    this.ganttData = ganttData;
    this.onTaskResize = onTaskResize;
    this.resizeState = null;

    // Bind methods for event listeners
    this._handleMouseDown = this._handleMouseDown.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleMouseUp = this._handleMouseUp.bind(this);
  }

  /**
   * Enables resizing on all task bars
   * @returns {void}
   */
  enableResizing() {
    // Use event delegation on the grid
    this.gridElement.addEventListener('mousedown', this._handleMouseDown);
    document.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('mouseup', this._handleMouseUp);

    console.log('✓ Bar resizing enabled');
  }

  /**
   * Disables resizing functionality
   * @returns {void}
   */
  disableResizing() {
    this.gridElement.removeEventListener('mousedown', this._handleMouseDown);
    document.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('mouseup', this._handleMouseUp);

    console.log('✓ Bar resizing disabled');
  }

  /**
   * Handles mouse down on bars to detect resize handle clicks or drag initiation
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  _handleMouseDown(event) {
    const target = event.target;
    const bar = target.closest('.gantt-bar');
    if (!bar) return;

    // Detect if clicking on resize handle (within 10px of edge)
    const rect = bar.getBoundingClientRect();
    const x = event.clientX - rect.left;

    const HANDLE_WIDTH = 10; // Updated to match new resize handle width

    if (x <= HANDLE_WIDTH) {
      // Resizing from left (start date)
      this._startResize(bar, 'left', event);
    } else if (x >= rect.width - HANDLE_WIDTH) {
      // Resizing from right (end date)
      this._startResize(bar, 'right', event);
    } else {
      // Clicking in the middle - trigger drag mode
      // Set cursor to indicate dragging is possible
      bar.style.cursor = 'move';
    }
  }

  /**
   * Starts a resize operation
   * @param {HTMLElement} bar - The bar element being resized
   * @param {string} handle - 'left' or 'right'
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  _startResize(bar, handle, event) {
    event.preventDefault();
    event.stopImmediatePropagation(); // Prevent other handlers (like drag) from also processing this event

    const barArea = bar.closest('.gantt-bar-area');
    const taskIndex = parseInt(barArea.getAttribute('data-task-index'));
    const rowId = barArea.getAttribute('data-row-id');

    // Parse current grid column
    const gridColumnStyle = bar.style.gridColumn;
    const [startCol, endCol] = gridColumnStyle.split('/').map(v => parseInt(v.trim()));

    this.resizeState = {
      bar: bar,
      barArea: barArea,
      handle: handle,
      taskIndex: taskIndex,
      rowId: rowId,
      startX: event.clientX,
      originalStartCol: startCol,
      originalEndCol: endCol,
      originalGridColumn: gridColumnStyle
    };

    // Add visual feedback
    bar.classList.add('resizing');
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('resizing');

    console.log('🔧 Resize started:', {
      handle: handle,
      taskName: this.ganttData.data[taskIndex].title,
      originalStartCol: startCol,
      originalEndCol: endCol
    });
  }

  /**
   * Handles mouse move during resize
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  _handleMouseMove(event) {
    if (!this.resizeState) return;

    const deltaX = event.clientX - this.resizeState.startX;
    const barArea = this.resizeState.barArea;
    const rect = barArea.getBoundingClientRect();
    const columnWidth = rect.width / this.ganttData.timeColumns.length;
    const columnDelta = Math.round(deltaX / columnWidth);

    let newStartCol = this.resizeState.originalStartCol;
    let newEndCol = this.resizeState.originalEndCol;

    if (this.resizeState.handle === 'left') {
      // Resize from left (change start date)
      newStartCol = this.resizeState.originalStartCol + columnDelta;
      // Clamp to valid range
      newStartCol = Math.max(1, newStartCol);
      // Prevent start from going past end (minimum 1 column width)
      newStartCol = Math.min(newStartCol, this.resizeState.originalEndCol - 1);
    } else {
      // Resize from right (change end date)
      newEndCol = this.resizeState.originalEndCol + columnDelta;
      // Clamp to valid range
      newEndCol = Math.min(this.ganttData.timeColumns.length + 1, newEndCol);
      // Prevent end from going before start (minimum 1 column width)
      newEndCol = Math.max(newEndCol, this.resizeState.originalStartCol + 1);
    }

    // Live update the bar visual
    this.resizeState.bar.style.gridColumn = `${newStartCol} / ${newEndCol}`;
  }

  /**
   * Handles mouse up to complete resize
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  async _handleMouseUp(event) {
    if (!this.resizeState) return;

    // Parse final grid column
    const gridColumnStyle = this.resizeState.bar.style.gridColumn;
    const [newStartCol, newEndCol] = gridColumnStyle.split('/').map(v => parseInt(v.trim()));

    console.log('🔧 Resize completed:', {
      originalStartCol: this.resizeState.originalStartCol,
      originalEndCol: this.resizeState.originalEndCol,
      newStartCol: newStartCol,
      newEndCol: newEndCol
    });

    // Check if anything actually changed
    const hasChanged =
      newStartCol !== this.resizeState.originalStartCol ||
      newEndCol !== this.resizeState.originalEndCol;

    if (hasChanged) {
      // Update the data model
      this.ganttData.data[this.resizeState.taskIndex].bar.startCol = newStartCol;
      this.ganttData.data[this.resizeState.taskIndex].bar.endCol = newEndCol;

      // Notify callback with updated task info
      if (this.onTaskResize) {
        const taskInfo = {
          taskName: this.ganttData.data[this.resizeState.taskIndex].title,
          entity: this.ganttData.data[this.resizeState.taskIndex].entity,
          sessionId: this.ganttData.sessionId,
          taskIndex: this.resizeState.taskIndex,
          oldStartCol: this.resizeState.originalStartCol,
          oldEndCol: this.resizeState.originalEndCol,
          newStartCol: newStartCol,
          newEndCol: newEndCol,
          startDate: this.ganttData.timeColumns[newStartCol - 1],
          endDate: this.ganttData.timeColumns[newEndCol - 2], // -2 because endCol is exclusive
          resizeHandle: this.resizeState.handle
        };

        try {
          await this.onTaskResize(taskInfo);
          console.log('✓ Task resize persisted to server:', taskInfo);
        } catch (error) {
          console.error('Failed to persist task resize:', error);
          // Rollback on error
          this.resizeState.bar.style.gridColumn = this.resizeState.originalGridColumn;
          this.ganttData.data[this.resizeState.taskIndex].bar.startCol = this.resizeState.originalStartCol;
          this.ganttData.data[this.resizeState.taskIndex].bar.endCol = this.resizeState.originalEndCol;
        }
      }
    }

    // Clean up visual feedback
    this.resizeState.bar.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.classList.remove('resizing');

    this.resizeState = null;
  }
}
