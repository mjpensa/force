import { CONFIG } from './config.js';
export class DraggableGantt {
  constructor(gridElement, ganttData, onTaskUpdate) {
    this.gridElement = gridElement;
    this.ganttData = ganttData;
    this.onTaskUpdate = onTaskUpdate;
    this.dragState = null;
    this.dragIndicator = null;
    this._handleMouseDown = this._handleMouseDown.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleMouseUp = this._handleMouseUp.bind(this);
  }
  enableDragging() {
    this.gridElement.addEventListener('mousedown', this._handleMouseDown);
    document.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('mouseup', this._handleMouseUp);
  }
  _handleMouseDown(event) {
    const target = event.target;
    const bar = target.closest('.gantt-bar');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const HANDLE_WIDTH = 10; // Updated to match new resize handle width
    if (x <= HANDLE_WIDTH || x >= rect.width - HANDLE_WIDTH) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation(); // Prevent other handlers (like resize) from also processing this event
    const barArea = bar.closest('.gantt-bar-area');
    const gridColumnStyle = bar.style.gridColumn;
    const [startCol, endCol] = gridColumnStyle.split('/').map(v => parseInt(v.trim()));
    const duration = endCol - startCol;
    const rowId = barArea.getAttribute('data-row-id');
    const taskIndex = parseInt(barArea.getAttribute('data-task-index'));
    if (taskIndex === -1 || isNaN(taskIndex)) {
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
      taskName: this.dragState.taskData.title,
      rowId: rowId,
      originalStartCol: startCol,
      originalEndCol: endCol,
      duration: duration,
      taskIndex: taskIndex
    });
    bar.classList.add('dragging');
    bar.style.opacity = '0.5';
    document.body.style.cursor = 'move';
    document.body.classList.add('dragging');
    this._createDragIndicator();
  }
  _handleMouseMove(event) {
    if (!this.dragState) return;
    const deltaX = event.clientX - this.dragState.startX;
    const barArea = this.dragState.barArea;
    const rect = barArea.getBoundingClientRect();
    const columnWidth = rect.width / this.ganttData.timeColumns.length;
    const columnDelta = Math.round(deltaX / columnWidth);
    let newStartCol = this.dragState.originalStartCol + columnDelta;
    let newEndCol = newStartCol + this.dragState.duration;
    const numCols = this.ganttData.timeColumns.length;
    newStartCol = Math.max(1, Math.min(newStartCol, numCols - this.dragState.duration + 1));
    newEndCol = newStartCol + this.dragState.duration;
    this.dragState.bar.style.gridColumn = `${newStartCol} / ${newEndCol}`;
  }
  async _handleMouseUp(event) {
    if (!this.dragState) return;
    const gridColumnStyle = this.dragState.bar.style.gridColumn;
    const [newStartCol, newEndCol] = gridColumnStyle.split('/').map(v => parseInt(v.trim()));
      newStartCol,
      newEndCol,
      duration: this.dragState.duration,
      originalStartCol: this.dragState.originalStartCol,
      originalEndCol: this.dragState.originalEndCol
    });
    const hasChanged =
      newStartCol !== this.dragState.originalStartCol ||
      newEndCol !== this.dragState.originalEndCol;
    if (hasChanged) {
      this.ganttData.data[this.dragState.taskIndex].bar.startCol = newStartCol;
      this.ganttData.data[this.dragState.taskIndex].bar.endCol = newEndCol;
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
        } catch (error) {
          this.dragState.bar.style.gridColumn = this.dragState.originalGridColumn;
          this.ganttData.data[this.dragState.taskIndex].bar.startCol = this.dragState.originalStartCol;
          this.ganttData.data[this.dragState.taskIndex].bar.endCol = this.dragState.originalEndCol;
        }
      }
    }
    this.dragState.bar.classList.remove('dragging');
    this.dragState.bar.style.opacity = '1';
    document.body.style.cursor = '';
    document.body.classList.remove('dragging');
    this._removeDragIndicator();
    this.dragState = null;
  }
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
  _removeDragIndicator() {
    if (this.dragIndicator && this.dragIndicator.parentNode) {
      this.dragIndicator.parentNode.removeChild(this.dragIndicator);
      this.dragIndicator = null;
    }
  }
  disableDragging() {
    this.gridElement.removeEventListener('mousedown', this._handleMouseDown);
    document.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('mouseup', this._handleMouseUp);
  }
}
