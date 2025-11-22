/**
 * SlideEditor.js
 *
 * Enables inline editing of slide content with contenteditable.
 * Features:
 * - Inline text editing
 * - Undo/redo system (50-step stack)
 * - Auto-save to localStorage
 * - Visual edit mode indicator
 *
 * Part of Phase 2: Slide Editing Capabilities
 */

export class SlideEditor {
  /**
   * Create a new SlideEditor instance
   * @param {PresentationSlides} presentation - Reference to PresentationSlides instance
   */
  constructor(presentation) {
    this.presentation = presentation;
    this.isEditMode = false;
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = 50;
    this.autoSaveEnabled = true;
    this.autoSaveDelay = 1000; // 1 second debounce
    this.autoSaveTimer = null;

    // Bind event handlers
    this._handleContentChange = this._handleContentChange.bind(this);
  }

  /**
   * Toggle edit mode on/off
   */
  toggleEditMode() {
    this.isEditMode = !this.isEditMode;

    if (this.isEditMode) {
      this.enableEditing();
    } else {
      this.disableEditing();
    }

    this.updateEditButton();
    console.log(`[SlideEditor] Edit mode ${this.isEditMode ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable inline editing on current slide
   */
  enableEditing() {
    const currentSlideEl = this.getCurrentSlideElement();
    if (!currentSlideEl) {
      console.warn('[SlideEditor] No current slide element found');
      return;
    }

    // Make text elements editable
    const editableElements = this.getEditableElements(currentSlideEl);

    editableElements.forEach(el => {
      // Save original content before enabling editing
      if (!el.dataset.originalContent) {
        el.dataset.originalContent = el.textContent;
      }

      el.contentEditable = true;
      el.classList.add('editable-active');

      // Add event listeners
      el.addEventListener('blur', this._handleContentChange);
      el.addEventListener('input', this._handleInput.bind(this));

      // Prevent Enter key from creating new lines in single-line fields
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !el.classList.contains('allow-multiline')) {
          e.preventDefault();
          el.blur(); // Save changes
        }
      });
    });

    // Add visual indicator
    currentSlideEl.classList.add('edit-mode-active');

    console.log(`[SlideEditor] Enabled editing on ${editableElements.length} elements`);
  }

  /**
   * Disable inline editing on current slide
   */
  disableEditing() {
    const currentSlideEl = this.getCurrentSlideElement();
    if (!currentSlideEl) return;

    const editableElements = currentSlideEl.querySelectorAll('[contenteditable="true"]');

    editableElements.forEach(el => {
      el.contentEditable = false;
      el.classList.remove('editable-active');
      el.removeEventListener('blur', this._handleContentChange);
    });

    currentSlideEl.classList.remove('edit-mode-active');

    console.log('[SlideEditor] Disabled editing');
  }

  /**
   * Get editable elements from slide
   * @private
   */
  getEditableElements(slideElement) {
    // Select common editable elements based on slide structure
    const selectors = [
      '.slide-title',
      '.slide-subtitle',
      '.bullet-item',
      '.quote-text',
      '.quote-attribution',
      '.section-title',
      '.section-description',
      '.image-caption',
      '.comparison-label'
      // Note: Tables need special handling
    ];

    const elements = [];
    selectors.forEach(selector => {
      const matches = slideElement.querySelectorAll(selector);
      matches.forEach(el => elements.push(el));
    });

    return elements;
  }

  /**
   * Handle input events (for real-time feedback)
   * @private
   */
  _handleInput(event) {
    // Could add character count, validation, etc.
    const element = event.target;
    element.classList.add('editing');
  }

  /**
   * Handle content change (on blur)
   * @private
   */
  _handleContentChange(event) {
    const element = event.target;
    const newContent = element.textContent.trim();
    const originalContent = element.dataset.originalContent;

    // Check if content actually changed
    if (newContent === originalContent) {
      element.classList.remove('editing');
      return;
    }

    console.log('[SlideEditor] Content changed:', {
      original: originalContent,
      new: newContent
    });

    // Save current state to undo stack
    this.pushUndo();

    // Update slide data
    this.updateSlideData(element, newContent);

    // Update original content
    element.dataset.originalContent = newContent;
    element.classList.remove('editing');

    // Trigger auto-save
    if (this.autoSaveEnabled) {
      this.scheduleAutoSave();
    }
  }

  /**
   * Update slide data based on edited element
   * @private
   */
  updateSlideData(element, newContent) {
    const slideIndex = this.presentation.currentSlideIndex;
    const slide = this.presentation.presentationData.slides[slideIndex];

    if (!slide || !slide.content) {
      console.warn('[SlideEditor] No slide data found');
      return;
    }

    // Determine which field to update based on element class
    if (element.classList.contains('slide-title')) {
      if (slide.content.title) {
        slide.content.title.text = newContent;
      }
    } else if (element.classList.contains('slide-subtitle')) {
      if (slide.content.subtitle) {
        slide.content.subtitle.text = newContent;
      }
    } else if (element.classList.contains('bullet-item')) {
      // Find bullet index
      const bulletList = element.parentElement;
      const bulletIndex = Array.from(bulletList.children).indexOf(element);
      if (slide.content.bullets && slide.content.bullets[bulletIndex]) {
        slide.content.bullets[bulletIndex].text = newContent;
      }
    } else if (element.classList.contains('quote-text')) {
      if (slide.content.quote) {
        slide.content.quote.text = newContent;
      }
    } else if (element.classList.contains('quote-attribution')) {
      if (slide.content.attribution) {
        slide.content.attribution.text = newContent;
      }
    } else if (element.classList.contains('section-title')) {
      if (slide.content.sectionTitle) {
        slide.content.sectionTitle.text = newContent;
      }
    } else if (element.classList.contains('section-description')) {
      if (slide.content.description) {
        slide.content.description.text = newContent;
      }
    } else if (element.classList.contains('image-caption')) {
      if (slide.content.image) {
        slide.content.image.caption = newContent;
      }
    } else if (element.classList.contains('comparison-label')) {
      // Find item index
      const itemCard = element.closest('.comparison-item');
      const grid = itemCard.parentElement;
      const itemIndex = Array.from(grid.children).indexOf(itemCard);
      if (slide.content.items && slide.content.items[itemIndex]) {
        slide.content.items[itemIndex].label = newContent;
      }
    }

    console.log('[SlideEditor] Updated slide data:', slide);
  }

  /**
   * Get current slide DOM element
   * @private
   */
  getCurrentSlideElement() {
    return document.getElementById('slideContent');
  }

  /**
   * Undo/Redo System
   */

  /**
   * Push current state to undo stack
   */
  pushUndo() {
    const currentState = this.captureState();

    this.undoStack.push(currentState);

    // Limit stack size
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift(); // Remove oldest
    }

    // Clear redo stack on new action
    this.redoStack = [];

    console.log(`[SlideEditor] Pushed to undo stack (size: ${this.undoStack.length})`);
  }

  /**
   * Capture current presentation state
   * @private
   */
  captureState() {
    // Deep clone the entire presentation data
    return JSON.parse(JSON.stringify(this.presentation.presentationData));
  }

  /**
   * Restore presentation state
   * @private
   */
  restoreState(state) {
    this.presentation.presentationData = JSON.parse(JSON.stringify(state));

    // Re-render current slide
    this.presentation._updateViewer();

    // Re-enable editing if in edit mode
    if (this.isEditMode) {
      setTimeout(() => this.enableEditing(), 100);
    }
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.undoStack.length === 0) {
      console.log('[SlideEditor] Nothing to undo');
      return;
    }

    // Save current state to redo stack
    const currentState = this.captureState();
    this.redoStack.push(currentState);

    // Restore previous state
    const previousState = this.undoStack.pop();
    this.restoreState(previousState);

    // Auto-save after undo
    if (this.autoSaveEnabled) {
      this.scheduleAutoSave();
    }

    console.log(`[SlideEditor] Undo performed (undo: ${this.undoStack.length}, redo: ${this.redoStack.length})`);
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.redoStack.length === 0) {
      console.log('[SlideEditor] Nothing to redo');
      return;
    }

    // Save current state to undo stack
    const currentState = this.captureState();
    this.undoStack.push(currentState);

    // Restore next state
    const nextState = this.redoStack.pop();
    this.restoreState(nextState);

    // Auto-save after redo
    if (this.autoSaveEnabled) {
      this.scheduleAutoSave();
    }

    console.log(`[SlideEditor] Redo performed (undo: ${this.undoStack.length}, redo: ${this.redoStack.length})`);
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Auto-Save System
   */

  /**
   * Schedule auto-save with debounce
   */
  scheduleAutoSave() {
    // Clear existing timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Schedule new save
    this.autoSaveTimer = setTimeout(() => {
      this.autoSave();
    }, this.autoSaveDelay);
  }

  /**
   * Auto-save to localStorage
   */
  autoSave() {
    try {
      const presentationData = {
        slides: this.presentation.presentationData.slides,
        theme: this.presentation.presentationData.theme,
        metadata: this.presentation.presentationData.metadata,
        savedAt: Date.now()
      };

      localStorage.setItem('presentation-autosave', JSON.stringify(presentationData));

      console.log('[SlideEditor] Auto-saved to localStorage');

      // Show brief visual feedback
      this.showSaveIndicator();
    } catch (error) {
      console.error('[SlideEditor] Auto-save failed:', error);
    }
  }

  /**
   * Show save indicator
   * @private
   */
  showSaveIndicator() {
    const editButton = document.getElementById('editModeBtn');
    if (!editButton) return;

    const originalText = editButton.innerHTML;
    editButton.innerHTML = '<span class="viewer-btn-icon">💾</span>Saved';
    editButton.style.opacity = '0.7';

    setTimeout(() => {
      editButton.innerHTML = originalText;
      editButton.style.opacity = '1';
    }, 1000);
  }

  /**
   * Restore from auto-save
   * @static
   */
  static restoreAutoSave() {
    try {
      const saved = localStorage.getItem('presentation-autosave');
      if (!saved) return null;

      const data = JSON.parse(saved);
      const savedDate = new Date(data.savedAt);

      console.log('[SlideEditor] Found auto-save from:', savedDate.toLocaleString());

      return data;
    } catch (error) {
      console.error('[SlideEditor] Failed to restore auto-save:', error);
      return null;
    }
  }

  /**
   * Clear auto-save
   * @static
   */
  static clearAutoSave() {
    localStorage.removeItem('presentation-autosave');
    console.log('[SlideEditor] Auto-save cleared');
  }

  /**
   * Update edit button state
   */
  updateEditButton() {
    const btn = document.getElementById('editModeBtn');
    if (!btn) return;

    if (this.isEditMode) {
      btn.innerHTML = '<span class="viewer-btn-icon">✏️</span>Exit Edit Mode';
      btn.classList.add('active');
      btn.style.backgroundColor = '#10b981';
      btn.style.borderColor = '#059669';
    } else {
      btn.innerHTML = '<span class="viewer-btn-icon">✏️</span>Edit Slides';
      btn.classList.remove('active');
      btn.style.backgroundColor = '';
      btn.style.borderColor = '';
    }
  }

  /**
   * Get editor status
   */
  getStatus() {
    return {
      isEditMode: this.isEditMode,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
      autoSaveEnabled: this.autoSaveEnabled
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.isEditMode) {
      this.disableEditing();
    }

    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    console.log('[SlideEditor] Cleanup complete');
  }
}
