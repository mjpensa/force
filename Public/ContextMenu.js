/**
 * ContextMenu Module
 * Phase 5 Enhancement: Context Menu for Changing Gantt Bar Colors
 * Provides a right-click context menu to change bar colors
 */

/**
 * ContextMenu Class
 * Creates and manages a context menu for changing bar colors
 */
export class ContextMenu {
  /**
   * Creates a new ContextMenu instance
   * @param {HTMLElement} gridElement - The gantt grid element
   * @param {Object} ganttData - The chart data
   * @param {Function} onColorChange - Callback when color is changed
   */
  constructor(gridElement, ganttData, onColorChange) {
    this.gridElement = gridElement;
    this.ganttData = ganttData;
    this.onColorChange = onColorChange;
    this.menu = null;
    this.targetBar = null;
    this.targetTaskIndex = null;

    this._handleContextMenu = this._handleContextMenu.bind(this);
    this._handleDocumentClick = this._handleDocumentClick.bind(this);
  }

  /**
   * Enables context menu on all bars
   * @returns {void}
   */
  enable() {
    // Add context menu listener to grid (event delegation)
    this.gridElement.addEventListener('contextmenu', this._handleContextMenu);
    console.log('✓ Context menu enabled');
  }

  /**
   * Disables context menu
   * @returns {void}
   */
  disable() {
    this.gridElement.removeEventListener('contextmenu', this._handleContextMenu);
    this.hide();
    console.log('✓ Context menu disabled');
  }

  /**
   * Handles right-click on bars
   * @param {MouseEvent} event - The context menu event
   * @private
   */
  _handleContextMenu(event) {
    const bar = event.target.closest('.gantt-bar');
    if (!bar) return;

    event.preventDefault();
    event.stopPropagation();

    // Get task index from bar area
    const barArea = bar.closest('.gantt-bar-area');
    const taskIndex = parseInt(barArea.getAttribute('data-task-index'));

    this.show(event, bar, taskIndex);
  }

  /**
   * Shows the context menu
   * @param {MouseEvent} event - The mouse event
   * @param {HTMLElement} bar - The bar element
   * @param {number} taskIndex - The task index
   * @public
   */
  show(event, bar, taskIndex) {
    this.targetBar = bar;
    this.targetTaskIndex = taskIndex;

    // Create menu if doesn't exist
    if (!this.menu) {
      this.menu = this._createMenu();
    }

    // Position near cursor
    this.menu.style.left = `${event.pageX}px`;
    this.menu.style.top = `${event.pageY}px`;
    this.menu.style.display = 'block';

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', this._handleDocumentClick);
    }, 0);
  }

  /**
   * Hides the context menu
   * @public
   */
  hide() {
    if (this.menu) {
      this.menu.style.display = 'none';
    }
    document.removeEventListener('click', this._handleDocumentClick);
    this.targetBar = null;
    this.targetTaskIndex = null;
  }

  /**
   * Handles document click to close menu
   * @param {MouseEvent} event - The click event
   * @private
   */
  _handleDocumentClick(event) {
    // Don't close if clicking inside the menu
    if (this.menu && this.menu.contains(event.target)) {
      return;
    }
    this.hide();
  }

  /**
   * Creates the context menu DOM element
   * @returns {HTMLElement} The menu element
   * @private
   */
  _createMenu() {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <div class="context-menu-title">Change Color</div>
      <div class="color-option" data-color="priority-red">
        <span class="color-preview" style="background-color: #EF4444;"></span>
        <span class="color-label">High Priority</span>
      </div>
      <div class="color-option" data-color="medium-red">
        <span class="color-preview" style="background-color: #FB923C;"></span>
        <span class="color-label">Medium Priority</span>
      </div>
      <div class="color-option" data-color="mid-grey">
        <span class="color-preview" style="background-color: #14B8A6;"></span>
        <span class="color-label">Teal</span>
      </div>
      <div class="color-option" data-color="light-grey">
        <span class="color-preview" style="background-color: #E879F9;"></span>
        <span class="color-label">Pink-Purple</span>
      </div>
      <div class="color-option" data-color="white">
        <span class="color-preview" style="background-color: #FFFFFF;"></span>
        <span class="color-label">White</span>
      </div>
      <div class="color-option" data-color="dark-blue">
        <span class="color-preview" style="background-color: #3B82F6;"></span>
        <span class="color-label">Blue</span>
      </div>
    `;

    menu.addEventListener('click', (e) => {
      const option = e.target.closest('.color-option');
      if (option) {
        const newColor = option.dataset.color;
        this._changeColor(newColor);
      }
    });

    document.body.appendChild(menu);
    return menu;
  }

  /**
   * Changes the color of the target bar
   * @param {string} newColor - The new color value
   * @private
   */
  async _changeColor(newColor) {
    if (!this.targetBar || this.targetTaskIndex === null) {
      console.error('No target bar for color change');
      return;
    }

    const oldColor = this.targetBar.getAttribute('data-color');

    // Update DOM
    this.targetBar.setAttribute('data-color', newColor);

    // Update data model
    this.ganttData.data[this.targetTaskIndex].bar.color = newColor;

    console.log(`✓ Color changed from "${oldColor}" to "${newColor}"`);

    // Trigger update callback
    if (this.onColorChange) {
      const taskInfo = {
        taskName: this.ganttData.data[this.targetTaskIndex].title,
        entity: this.ganttData.data[this.targetTaskIndex].entity,
        sessionId: this.ganttData.sessionId,
        taskIndex: this.targetTaskIndex,
        oldColor: oldColor,
        newColor: newColor
      };

      try {
        await this.onColorChange(taskInfo);
      } catch (error) {
        console.error('Failed to persist color change:', error);
        // Rollback on error
        this.targetBar.setAttribute('data-color', oldColor);
        this.ganttData.data[this.targetTaskIndex].bar.color = oldColor;
      }
    }

    this.hide();
  }
}
