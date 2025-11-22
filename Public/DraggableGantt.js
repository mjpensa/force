/**
 * DraggableGantt Module
 * Phase 5 Enhancement: Drag-to-Edit Functionality
 * Enables interactive dragging of Gantt chart bars to update task dates
 */

import { CONFIG } from './config.js';

/**
 * DraggableGantt Class
 * Adds drag-and-drop functionality to Gantt chart bars
 */
export class DraggableGantt {
  /**
   * Creates a new DraggableGantt instance
   * @param {HTMLElement} gridElement - The gantt grid element containing bars
   * @param {Object} ganttData - The chart data
   * @param {Function} onTaskUpdate - Callback when a task is updated
   */
  constructor(gridElement, ganttData, onTaskUpdate) {
    this.gridElement = gridElement;
    this.ganttData = ganttData;
    this.onTaskUpdate = onTaskUpdate;
    this.dragState = null;
    this.dragIndicator = null;

    // Bind methods for event listeners
    this._handleMouseDown = this._handleMouseDown.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleMouseUp = this._handleMouseUp.bind(this);
  }

  /**
   * Enables dragging on all task bars using mouse events
   * @returns {void}
   */
  enableDragging() {
    // Use event delegation on the grid for mouse events
    this.gridElement.addEventListener('mousedown', this._handleMouseDown);
    document.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('mouseup', this._handleMouseUp);

    console.log('✓ Bar dragging enabled (mouse events)');
  }

  /**
   * Handles mouse down to initiate drag
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  _handleMouseDown(event) {
    const target = event.target;
    const bar = target.closest('.gantt-bar');
    if (!bar) return;

    // Check if clicking on resize handle (within 10px of edge) - if so, let ResizableGantt handle it
    const rect = bar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const HANDLE_WIDTH = 10; // Updated to match new resize handle width

    if (x <= HANDLE_WIDTH || x >= rect.width - HANDLE_WIDTH) {
      // This is a resize operation, not a drag - let ResizableGantt handle it
      return;
    }

    // This is a drag operation (clicking in the middle of the bar)
    event.preventDefault();
    event.stopImmediatePropagation(); // Prevent other handlers (like resize) from also processing this event

    const barArea = bar.closest('.gantt-bar-area');
    const gridColumnStyle = bar.style.gridColumn;

    console.log('🚀 Drag started! Bar gridColumn:', gridColumnStyle);

    // Parse grid column (e.g., "2 / 5" -> startCol: 2, endCol: 5)
    const [startCol, endCol] = gridColumnStyle.split('/').map(v => parseInt(v.trim()));
    const duration = endCol - startCol;

    const rowId = barArea.getAttribute('data-row-id');
    const taskIndex = parseInt(barArea.getAttribute('data-task-index'));

    if (taskIndex === -1 || isNaN(taskIndex)) {
      console.error('Could not find task for dragged bar');
      return;
    }

    this.dragState = {
      bar: bar,
      barArea: barArea,
      rowId: rowId,
      startX: event.clientX,
      startY: event.clientY,
      originalStartCol: startCol,
      originalEndCol: endCol,
      duration: duration,
      taskIndex: taskIndex,
      taskData: this.ganttData.data[taskIndex],
      originalGridColumn: gridColumnStyle
    };

    console.log('📦 Dragged task info:', {
      taskName: this.dragState.taskData.title,
      rowId: rowId,
      originalStartCol: startCol,
      originalEndCol: endCol,
      duration: duration,
      taskIndex: taskIndex
    });

    // Add visual feedback
    bar.classList.add('dragging');
    bar.style.opacity = '0.5';
    document.body.style.cursor = 'move';
    document.body.classList.add('dragging');

    // Create drag indicator
    this._createDragIndicator();
  }

  /**
   * Handles mouse move during drag
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  _handleMouseMove(event) {
    if (!this.dragState) return;

    const deltaX = event.clientX - this.dragState.startX;
    const barArea = this.dragState.barArea;
    const rect = barArea.getBoundingClientRect();
    const columnWidth = rect.width / this.ganttData.timeColumns.length;
    const columnDelta = Math.round(deltaX / columnWidth);

    let newStartCol = this.dragState.originalStartCol + columnDelta;
    let newEndCol = newStartCol + this.dragState.duration;

    // Clamp to valid range
    const numCols = this.ganttData.timeColumns.length;
    newStartCol = Math.max(1, Math.min(newStartCol, numCols - this.dragState.duration + 1));
    newEndCol = newStartCol + this.dragState.duration;

    // Live update the bar visual
    this.dragState.bar.style.gridColumn = `${newStartCol} / ${newEndCol}`;
  }

  /**
   * Handles mouse up to complete drag
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  async _handleMouseUp(event) {
    if (!this.dragState) return;

    console.log('🎯 Drag completed!');

    // Parse final grid column
    const gridColumnStyle = this.dragState.bar.style.gridColumn;
    const [newStartCol, newEndCol] = gridColumnStyle.split('/').map(v => parseInt(v.trim()));

    console.log('📍 Final position:', {
      newStartCol,
      newEndCol,
      duration: this.dragState.duration,
      originalStartCol: this.dragState.originalStartCol,
      originalEndCol: this.dragState.originalEndCol
    });

    // Check if anything actually changed
    const hasChanged =
      newStartCol !== this.dragState.originalStartCol ||
      newEndCol !== this.dragState.originalEndCol;

    if (hasChanged) {
      // Update the data model
      this.ganttData.data[this.dragState.taskIndex].bar.startCol = newStartCol;
      this.ganttData.data[this.dragState.taskIndex].bar.endCol = newEndCol;

      // Notify callback with updated task info
      if (this.onTaskUpdate) {
        const taskInfo = {
          taskName: this.dragState.taskData.title,
          entity: this.dragState.taskData.entity,
          sessionId: this.ganttData.sessionId,
          taskIndex: this.dragState.taskIndex,
          oldStartCol: this.dragState.originalStartCol,
          oldEndCol: this.dragState.originalEndCol,
          newStartCol: newStartCol,
          newEndCol: newEndCol,
          startDate: this.ganttData.timeColumns[newStartCol - 1],
          endDate: this.ganttData.timeColumns[newEndCol - 2] // -2 because endCol is exclusive
        };

        try {
          await this.onTaskUpdate(taskInfo);
          console.log('✓ Task position updated successfully:', taskInfo);
        } catch (error) {
          console.error('Failed to persist task update:', error);
          // Rollback on error
          this.dragState.bar.style.gridColumn = this.dragState.originalGridColumn;
          this.ganttData.data[this.dragState.taskIndex].bar.startCol = this.dragState.originalStartCol;
          this.ganttData.data[this.dragState.taskIndex].bar.endCol = this.dragState.originalEndCol;
        }
      }
    }

    // Clean up visual feedback
    this.dragState.bar.classList.remove('dragging');
    this.dragState.bar.style.opacity = '1';
    document.body.style.cursor = '';
    document.body.classList.remove('dragging');

    // Remove drag indicator
    this._removeDragIndicator();

    this.dragState = null;
  }



  /**
   * Creates a visual indicator during drag
   * @private
   */
  _createDragIndicator() {
    this.dragIndicator = document.createElement('div');
    this.dragIndicator.className = 'drag-indicator';
    this.dragIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${CONFIG.COLORS.PRIMARY || '#BA3930'};
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    this.dragIndicator.textContent = '↔ Drag to reschedule task';
    document.body.appendChild(this.dragIndicator);
  }

  /**
   * Removes the drag indicator
   * @private
   */
  _removeDragIndicator() {
    if (this.dragIndicator && this.dragIndicator.parentNode) {
      this.dragIndicator.parentNode.removeChild(this.dragIndicator);
      this.dragIndicator = null;
    }
  }

  /**
   * Disables dragging on all task bars
   * @returns {void}
   */
  disableDragging() {
    this.gridElement.removeEventListener('mousedown', this._handleMouseDown);
    document.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('mouseup', this._handleMouseUp);

    console.log('✓ Bar dragging disabled');
  }
}
