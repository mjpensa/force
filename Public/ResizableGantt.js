import { CONFIG } from './config.js';
export class ResizableGantt {
  constructor(gridElement, ganttData, onTaskResize) {
    this.gridElement = gridElement;
    this.ganttData = ganttData;
    this.onTaskResize = onTaskResize;
    this.resizeState = null;
    this._handleMouseDown = this._handleMouseDown.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleMouseUp = this._handleMouseUp.bind(this);
  }
  enableResizing() {
    this.gridElement.addEventListener('mousedown', this._handleMouseDown);
    document.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('mouseup', this._handleMouseUp);
  }
  disableResizing() {
    this.gridElement.removeEventListener('mousedown', this._handleMouseDown);
    document.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('mouseup', this._handleMouseUp);
  }
  _handleMouseDown(event) {
    const target = event.target;
    const bar = target.closest('.gantt-bar');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const HANDLE_WIDTH = 10; // Updated to match new resize handle width
    if (x <= HANDLE_WIDTH) {
      this._startResize(bar, 'left', event);
    } else if (x >= rect.width - HANDLE_WIDTH) {
      this._startResize(bar, 'right', event);
    } else {
      bar.style.cursor = 'move';
    }
  }
  _startResize(bar, handle, event) {
    event.preventDefault();
    event.stopImmediatePropagation(); // Prevent other handlers (like drag) from also processing this event
    const barArea = bar.closest('.gantt-bar-area');
    const taskIndex = parseInt(barArea.getAttribute('data-task-index'));
    const rowId = barArea.getAttribute('data-row-id');
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
    bar.classList.add('resizing');
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('resizing');
      handle: handle,
      taskName: this.ganttData.data[taskIndex].title,
      originalStartCol: startCol,
      originalEndCol: endCol
    });
  }
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
      newStartCol = this.resizeState.originalStartCol + columnDelta;
      newStartCol = Math.max(1, newStartCol);
      newStartCol = Math.min(newStartCol, this.resizeState.originalEndCol - 1);
    } else {
      newEndCol = this.resizeState.originalEndCol + columnDelta;
      newEndCol = Math.min(this.ganttData.timeColumns.length + 1, newEndCol);
      newEndCol = Math.max(newEndCol, this.resizeState.originalStartCol + 1);
    }
    this.resizeState.bar.style.gridColumn = `${newStartCol} / ${newEndCol}`;
  }
  async _handleMouseUp(event) {
    if (!this.resizeState) return;
    const gridColumnStyle = this.resizeState.bar.style.gridColumn;
    const [newStartCol, newEndCol] = gridColumnStyle.split('/').map(v => parseInt(v.trim()));
      originalStartCol: this.resizeState.originalStartCol,
      originalEndCol: this.resizeState.originalEndCol,
      newStartCol: newStartCol,
      newEndCol: newEndCol
    });
    const hasChanged =
      newStartCol !== this.resizeState.originalStartCol ||
      newEndCol !== this.resizeState.originalEndCol;
    if (hasChanged) {
      this.ganttData.data[this.resizeState.taskIndex].bar.startCol = newStartCol;
      this.ganttData.data[this.resizeState.taskIndex].bar.endCol = newEndCol;
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
        } catch (error) {
          this.resizeState.bar.style.gridColumn = this.resizeState.originalGridColumn;
          this.ganttData.data[this.resizeState.taskIndex].bar.startCol = this.resizeState.originalStartCol;
          this.ganttData.data[this.resizeState.taskIndex].bar.endCol = this.resizeState.originalEndCol;
        }
      }
    }
    this.resizeState.bar.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.classList.remove('resizing');
    this.resizeState = null;
  }
}
