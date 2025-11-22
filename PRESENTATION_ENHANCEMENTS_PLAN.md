# Presentation Enhancements Implementation Plan

## Overview

This document outlines the implementation plan for three major enhancements to the presentation system:

1. **Presenter Mode**: Professional speaker view with notes, timer, and preview
2. **Slide Editing Capabilities**: Inline editing, slide management, and theme customization
3. **Enhanced Export Capabilities**: PDF, PNG, and print-optimized formats

**Target Timeline**: 3 phases over 2-3 weeks
**Complexity**: Medium-High (adds ~1,500 lines of code)
**Dependencies**: jsPDF, html2canvas (already available)

---

## Phase 1: Presenter Mode (Week 1)

### 1.1 Architecture

**Dual-Window Design**:
- **Main Window (Audience View)**: Full-screen presentation display
- **Presenter Window (Speaker View)**: Control panel with current slide, next slide preview, notes, and timer

**Communication**: postMessage API for cross-window synchronization

```
┌─────────────────────────────────────┐
│     Main Window (Audience)          │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │     Current Slide             │  │
│  │     (Full Screen)             │  │
│  │                               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│         Presenter Window (Speaker)                      │
│  ┌─────────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │                 │  │            │  │             │  │
│  │  Current Slide  │  │ Next Slide │  │   Timer     │  │
│  │    (Large)      │  │  (Small)   │  │   Notes     │  │
│  │                 │  │            │  │   Controls  │  │
│  └─────────────────┘  └────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 1.2 File Structure

**New Files**:
- `Public/PresenterMode.js` (~400 lines) - Main presenter mode component
- `Public/presenter-view.html` (~150 lines) - Presenter window UI
- `Public/presenter-view.css` (~200 lines) - Presenter window styles

**Modified Files**:
- `Public/PresentationSlides.js` - Add "Start Presenter Mode" button and window management
- `Public/presentation-config.js` - Add presenter mode configuration

### 1.3 Implementation Details

#### 1.3.1 PresenterMode.js - Main Component

```javascript
/**
 * PresenterMode.js
 *
 * Manages dual-window presenter mode with synchronization.
 */

export class PresenterMode {
  constructor(presentation) {
    this.presentation = presentation; // Reference to PresentationSlides instance
    this.presenterWindow = null;
    this.currentSlideIndex = 0;
    this.startTime = null;
    this.timerInterval = null;
    this.isActive = false;
  }

  /**
   * Launch presenter mode - opens new window
   */
  launch() {
    if (this.isActive) {
      console.warn('[PresenterMode] Already active');
      return;
    }

    // Open presenter window (800x600, separate screen if available)
    const width = 1200;
    const height = 700;
    const left = window.screenX + window.outerWidth; // Position on second monitor
    const top = window.screenY;

    this.presenterWindow = window.open(
      'presenter-view.html',
      'presenter-view',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!this.presenterWindow) {
      alert('Please allow pop-ups to use Presenter Mode');
      return;
    }

    this.isActive = true;
    this.startTime = Date.now();
    this.setupMessageHandlers();
    this.startTimer();

    // Send initial data when presenter window loads
    this.presenterWindow.addEventListener('load', () => {
      this.syncPresenterWindow();
    });

    // Cleanup on window close
    window.addEventListener('beforeunload', () => this.cleanup());
  }

  /**
   * Setup postMessage communication
   */
  setupMessageHandlers() {
    // Listen for messages from presenter window
    window.addEventListener('message', (event) => {
      if (event.source !== this.presenterWindow) return;

      switch (event.data.type) {
        case 'NAVIGATE':
          this.navigateToSlide(event.data.slideIndex);
          break;
        case 'RESET_TIMER':
          this.resetTimer();
          break;
        case 'PRESENTER_READY':
          this.syncPresenterWindow();
          break;
      }
    });

    // Listen for slide changes in main window
    this.presentation.addEventListener('slideChange', (e) => {
      this.currentSlideIndex = e.detail.slideIndex;
      this.syncPresenterWindow();
    });
  }

  /**
   * Sync data to presenter window
   */
  syncPresenterWindow() {
    if (!this.presenterWindow || this.presenterWindow.closed) {
      this.cleanup();
      return;
    }

    const slides = this.presentation.getSlides();
    const currentSlide = slides[this.currentSlideIndex];
    const nextSlide = slides[this.currentSlideIndex + 1] || null;

    this.presenterWindow.postMessage({
      type: 'SYNC',
      data: {
        currentSlideIndex: this.currentSlideIndex,
        currentSlide: this._renderSlideHTML(currentSlide),
        nextSlide: nextSlide ? this._renderSlideHTML(nextSlide) : null,
        notes: currentSlide.notes || 'No notes for this slide',
        totalSlides: slides.length,
        elapsedTime: this.getElapsedTime()
      }
    }, '*');
  }

  /**
   * Navigate to specific slide
   */
  navigateToSlide(slideIndex) {
    this.presentation.goToSlide(slideIndex);
  }

  /**
   * Timer management
   */
  startTimer() {
    this.timerInterval = setInterval(() => {
      this.syncPresenterWindow(); // Update elapsed time
    }, 1000); // Update every second
  }

  resetTimer() {
    this.startTime = Date.now();
    this.syncPresenterWindow();
  }

  getElapsedTime() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000); // seconds
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Render slide to HTML string (for postMessage)
   */
  _renderSlideHTML(slide) {
    // Use WebRenderer to generate HTML
    const renderer = new WebRenderer(slide, this.presentation.theme);
    return renderer.render(this.currentSlideIndex, this.presentation.getTotalSlides());
  }

  /**
   * Cleanup on exit
   */
  cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (this.presenterWindow && !this.presenterWindow.closed) {
      this.presenterWindow.close();
    }
    this.isActive = false;
  }
}
```

#### 1.3.2 presenter-view.html - Presenter Window UI

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presenter View</title>
  <link rel="stylesheet" href="presenter-view.css">
</head>
<body>
  <div class="presenter-container">
    <!-- Top Bar: Timer and Controls -->
    <div class="presenter-topbar">
      <div class="timer-display">
        <span class="timer-label">Elapsed Time:</span>
        <span id="timer-value" class="timer-value">00:00</span>
        <button id="reset-timer-btn" class="btn-reset">Reset</button>
      </div>
      <div class="slide-counter">
        <span id="slide-counter">Slide 1 / 10</span>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="presenter-main">
      <!-- Current Slide (Large) -->
      <div class="current-slide-panel">
        <div class="panel-header">Current Slide</div>
        <div id="current-slide-content" class="slide-preview large">
          <!-- Slide HTML injected here -->
        </div>
      </div>

      <!-- Sidebar: Next Slide + Notes -->
      <div class="presenter-sidebar">
        <!-- Next Slide Preview (Small) -->
        <div class="next-slide-panel">
          <div class="panel-header">Next Slide</div>
          <div id="next-slide-content" class="slide-preview small">
            <!-- Next slide HTML injected here -->
          </div>
        </div>

        <!-- Speaker Notes -->
        <div class="notes-panel">
          <div class="panel-header">Speaker Notes</div>
          <div id="speaker-notes" class="notes-content">
            <!-- Notes text injected here -->
          </div>
        </div>

        <!-- Navigation Controls -->
        <div class="navigation-controls">
          <button id="prev-btn" class="nav-btn">← Previous</button>
          <button id="next-btn" class="nav-btn">Next →</button>
        </div>
      </div>
    </div>
  </div>

  <script type="module">
    // Presenter window script
    let currentSlideIndex = 0;

    // Listen for sync messages from main window
    window.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC') {
        updatePresenterView(event.data.data);
      }
    });

    function updatePresenterView(data) {
      currentSlideIndex = data.currentSlideIndex;

      // Update current slide
      document.getElementById('current-slide-content').innerHTML = data.currentSlide;

      // Update next slide
      const nextSlideEl = document.getElementById('next-slide-content');
      if (data.nextSlide) {
        nextSlideEl.innerHTML = data.nextSlide;
      } else {
        nextSlideEl.innerHTML = '<p class="end-message">End of Presentation</p>';
      }

      // Update notes
      document.getElementById('speaker-notes').textContent = data.notes;

      // Update timer
      document.getElementById('timer-value').textContent = formatTime(data.elapsedTime);

      // Update slide counter
      document.getElementById('slide-counter').textContent =
        `Slide ${data.currentSlideIndex + 1} / ${data.totalSlides}`;
    }

    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Navigation controls
    document.getElementById('prev-btn').addEventListener('click', () => {
      window.opener.postMessage({ type: 'NAVIGATE', slideIndex: currentSlideIndex - 1 }, '*');
    });

    document.getElementById('next-btn').addEventListener('click', () => {
      window.opener.postMessage({ type: 'NAVIGATE', slideIndex: currentSlideIndex + 1 }, '*');
    });

    document.getElementById('reset-timer-btn').addEventListener('click', () => {
      window.opener.postMessage({ type: 'RESET_TIMER' }, '*');
    });

    // Signal ready to main window
    window.opener.postMessage({ type: 'PRESENTER_READY' }, '*');
  </script>
</body>
</html>
```

#### 1.3.3 Integration into PresentationSlides.js

```javascript
// Add to PresentationSlides.js constructor
import { PresenterMode } from './PresenterMode.js';

constructor(containerId, slides, theme) {
  // ... existing code ...
  this.presenterMode = new PresenterMode(this);
}

// Add presenter mode button to controls
_buildControlButtons() {
  const controls = document.createElement('div');
  controls.className = 'presentation-controls';

  // ... existing buttons ...

  // Add Presenter Mode button
  const presenterBtn = document.createElement('button');
  presenterBtn.className = 'control-btn presenter-mode-btn';
  presenterBtn.innerHTML = '🎤 Presenter Mode';
  presenterBtn.title = 'Start presenter mode (opens new window)';
  presenterBtn.addEventListener('click', () => {
    this.presenterMode.launch();
  });
  controls.appendChild(presenterBtn);

  return controls;
}

// Add event dispatcher for slide changes
goToSlide(index) {
  // ... existing navigation code ...

  // Dispatch event for presenter mode
  const event = new CustomEvent('slideChange', {
    detail: { slideIndex: this.currentSlideIndex }
  });
  this.dispatchEvent(event);
}

// Make PresentationSlides an EventTarget
// Add this to the class:
addEventListener(type, listener) {
  if (!this._eventListeners) this._eventListeners = {};
  if (!this._eventListeners[type]) this._eventListeners[type] = [];
  this._eventListeners[type].push(listener);
}

dispatchEvent(event) {
  if (!this._eventListeners) return;
  const listeners = this._eventListeners[event.type] || [];
  listeners.forEach(listener => listener(event));
}
```

### 1.4 Success Criteria

- ✅ Presenter window opens on button click
- ✅ Current slide displays in main window and presenter window
- ✅ Next slide preview updates correctly
- ✅ Speaker notes display for each slide
- ✅ Timer counts up from presentation start
- ✅ Timer can be reset
- ✅ Navigation in presenter window controls main window
- ✅ Slide counter shows current position
- ✅ Windows stay synchronized
- ✅ Clean shutdown when main window closes

---

## Phase 2: Slide Editing Capabilities (Week 2)

### 2.1 Architecture

**Three Editing Layers**:
1. **Content Editing**: Inline editing of text content (contenteditable)
2. **Slide Management**: Add, delete, duplicate, reorder slides
3. **Theme Customization**: Switch between themes, customize colors/fonts

**Data Flow**:
```
User Edit → Update Slide Data → Re-render Slide → Auto-save to localStorage
```

### 2.2 File Structure

**New Files**:
- `Public/SlideEditor.js` (~500 lines) - Slide editing component
- `Public/SlideManager.js` (~300 lines) - Slide CRUD operations
- `Public/ThemeCustomizer.js` (~250 lines) - Theme editing UI

**Modified Files**:
- `Public/PresentationSlides.js` - Add edit mode toggle and integration
- `Public/presentation-config.js` - Add editor configuration
- `Public/style.css` - Add editor styles

### 2.3 Implementation Details

#### 2.3.1 SlideEditor.js - Content Editing

```javascript
/**
 * SlideEditor.js
 *
 * Enables inline editing of slide content.
 */

export class SlideEditor {
  constructor(presentation) {
    this.presentation = presentation;
    this.isEditMode = false;
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = 50;
  }

  /**
   * Toggle edit mode
   */
  toggleEditMode() {
    this.isEditMode = !this.isEditMode;

    if (this.isEditMode) {
      this.enableEditing();
    } else {
      this.disableEditing();
    }

    this.updateEditButton();
  }

  /**
   * Enable inline editing
   */
  enableEditing() {
    const currentSlideEl = this.presentation.getCurrentSlideElement();
    if (!currentSlideEl) return;

    // Make all text elements editable
    const editableElements = currentSlideEl.querySelectorAll(
      '.slide-title, .slide-subtitle, .slide-content, .bullet-item, .table-cell, .quote-text'
    );

    editableElements.forEach(el => {
      el.contentEditable = true;
      el.classList.add('editable-active');

      // Save changes on blur
      el.addEventListener('blur', (e) => this.handleContentChange(e.target));

      // Prevent Enter key from creating new lines (except in specific cases)
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !el.classList.contains('allow-multiline')) {
          e.preventDefault();
        }
      });
    });

    // Add visual indicator
    currentSlideEl.classList.add('edit-mode-active');

    console.log('[SlideEditor] Edit mode enabled');
  }

  /**
   * Disable inline editing
   */
  disableEditing() {
    const currentSlideEl = this.presentation.getCurrentSlideElement();
    if (!currentSlideEl) return;

    const editableElements = currentSlideEl.querySelectorAll('[contenteditable="true"]');
    editableElements.forEach(el => {
      el.contentEditable = false;
      el.classList.remove('editable-active');
    });

    currentSlideEl.classList.remove('edit-mode-active');

    console.log('[SlideEditor] Edit mode disabled');
  }

  /**
   * Handle content change (update slide data)
   */
  handleContentChange(element) {
    const slideIndex = this.presentation.currentSlideIndex;
    const slide = this.presentation.slides[slideIndex];

    // Save current state to undo stack
    this.pushUndo(slideIndex, { ...slide });

    // Update slide data based on element type
    if (element.classList.contains('slide-title')) {
      slide.title = element.textContent.trim();
    } else if (element.classList.contains('slide-subtitle')) {
      slide.subtitle = element.textContent.trim();
    } else if (element.classList.contains('bullet-item')) {
      // Find bullet index and update
      const bulletIndex = Array.from(element.parentElement.children).indexOf(element);
      if (slide.bullets && slide.bullets[bulletIndex]) {
        slide.bullets[bulletIndex] = element.textContent.trim();
      }
    } else if (element.classList.contains('quote-text')) {
      slide.quote = element.textContent.trim();
    }
    // Add more element types as needed...

    // Auto-save to localStorage
    this.autoSave();

    console.log('[SlideEditor] Content updated:', slide);
  }

  /**
   * Undo/Redo system
   */
  pushUndo(slideIndex, slideData) {
    this.undoStack.push({ slideIndex, data: slideData });
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift(); // Remove oldest
    }
    this.redoStack = []; // Clear redo stack on new action
  }

  undo() {
    if (this.undoStack.length === 0) return;

    const state = this.undoStack.pop();
    this.redoStack.push({
      slideIndex: state.slideIndex,
      data: { ...this.presentation.slides[state.slideIndex] }
    });

    // Restore slide data
    this.presentation.slides[state.slideIndex] = state.data;
    this.presentation.renderCurrentSlide();
    this.autoSave();

    console.log('[SlideEditor] Undo performed');
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const state = this.redoStack.pop();
    this.pushUndo(state.slideIndex, { ...this.presentation.slides[state.slideIndex] });

    // Restore slide data
    this.presentation.slides[state.slideIndex] = state.data;
    this.presentation.renderCurrentSlide();
    this.autoSave();

    console.log('[SlideEditor] Redo performed');
  }

  /**
   * Auto-save to localStorage
   */
  autoSave() {
    try {
      const presentationData = {
        slides: this.presentation.slides,
        theme: this.presentation.theme,
        metadata: this.presentation.metadata,
        savedAt: Date.now()
      };

      localStorage.setItem('presentation-autosave', JSON.stringify(presentationData));
      console.log('[SlideEditor] Auto-saved to localStorage');
    } catch (error) {
      console.error('[SlideEditor] Auto-save failed:', error);
    }
  }

  /**
   * Restore from auto-save
   */
  static restoreAutoSave() {
    try {
      const saved = localStorage.getItem('presentation-autosave');
      if (!saved) return null;

      const data = JSON.parse(saved);
      console.log('[SlideEditor] Restored from auto-save:', new Date(data.savedAt));
      return data;
    } catch (error) {
      console.error('[SlideEditor] Restore failed:', error);
      return null;
    }
  }

  /**
   * Update edit button state
   */
  updateEditButton() {
    const btn = document.querySelector('.edit-mode-btn');
    if (!btn) return;

    if (this.isEditMode) {
      btn.textContent = '✏️ Exit Edit Mode';
      btn.classList.add('active');
    } else {
      btn.textContent = '✏️ Edit Slides';
      btn.classList.remove('active');
    }
  }
}
```

#### 2.3.2 SlideManager.js - Slide CRUD Operations

```javascript
/**
 * SlideManager.js
 *
 * Handles slide creation, deletion, duplication, and reordering.
 */

import { SlideDataModel } from './SlideDataModel.js';

export class SlideManager {
  constructor(presentation) {
    this.presentation = presentation;
  }

  /**
   * Add new slide after current slide
   */
  addSlide(type = 'bullets') {
    const newSlide = SlideDataModel.createBlankSlide(type);
    const insertIndex = this.presentation.currentSlideIndex + 1;

    this.presentation.slides.splice(insertIndex, 0, newSlide);
    this.presentation.goToSlide(insertIndex);
    this.presentation.editor.autoSave();

    console.log(`[SlideManager] Added ${type} slide at index ${insertIndex}`);
  }

  /**
   * Delete current slide
   */
  deleteSlide() {
    if (this.presentation.slides.length <= 1) {
      alert('Cannot delete the last slide');
      return;
    }

    const confirmDelete = confirm('Delete this slide?');
    if (!confirmDelete) return;

    const deletedIndex = this.presentation.currentSlideIndex;
    this.presentation.slides.splice(deletedIndex, 1);

    // Navigate to previous slide or first slide
    const newIndex = Math.max(0, deletedIndex - 1);
    this.presentation.goToSlide(newIndex);
    this.presentation.editor.autoSave();

    console.log(`[SlideManager] Deleted slide at index ${deletedIndex}`);
  }

  /**
   * Duplicate current slide
   */
  duplicateSlide() {
    const currentSlide = this.presentation.slides[this.presentation.currentSlideIndex];
    const duplicate = JSON.parse(JSON.stringify(currentSlide)); // Deep clone

    const insertIndex = this.presentation.currentSlideIndex + 1;
    this.presentation.slides.splice(insertIndex, 0, duplicate);
    this.presentation.goToSlide(insertIndex);
    this.presentation.editor.autoSave();

    console.log(`[SlideManager] Duplicated slide at index ${insertIndex}`);
  }

  /**
   * Move slide up (swap with previous)
   */
  moveSlideUp() {
    const currentIndex = this.presentation.currentSlideIndex;
    if (currentIndex === 0) return; // Already at top

    const slides = this.presentation.slides;
    [slides[currentIndex], slides[currentIndex - 1]] =
      [slides[currentIndex - 1], slides[currentIndex]];

    this.presentation.goToSlide(currentIndex - 1);
    this.presentation.editor.autoSave();

    console.log(`[SlideManager] Moved slide up from ${currentIndex} to ${currentIndex - 1}`);
  }

  /**
   * Move slide down (swap with next)
   */
  moveSlideDown() {
    const currentIndex = this.presentation.currentSlideIndex;
    if (currentIndex === this.presentation.slides.length - 1) return; // Already at bottom

    const slides = this.presentation.slides;
    [slides[currentIndex], slides[currentIndex + 1]] =
      [slides[currentIndex + 1], slides[currentIndex]];

    this.presentation.goToSlide(currentIndex + 1);
    this.presentation.editor.autoSave();

    console.log(`[SlideManager] Moved slide down from ${currentIndex} to ${currentIndex + 1}`);
  }

  /**
   * Show slide management panel
   */
  showManagementPanel() {
    // Create modal with slide management UI
    const modal = document.createElement('div');
    modal.className = 'slide-manager-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Manage Slides</h2>

        <div class="slide-actions">
          <h3>Add Slide</h3>
          <div class="slide-type-buttons">
            ${this.getSlideTypeButtons()}
          </div>
        </div>

        <div class="slide-actions">
          <h3>Current Slide Actions</h3>
          <button class="action-btn" data-action="duplicate">📋 Duplicate Slide</button>
          <button class="action-btn" data-action="delete">🗑️ Delete Slide</button>
          <button class="action-btn" data-action="move-up">⬆️ Move Up</button>
          <button class="action-btn" data-action="move-down">⬇️ Move Down</button>
        </div>

        <button class="close-modal-btn">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.close-modal-btn').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelectorAll('.slide-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.addSlide(btn.dataset.type);
        modal.remove();
      });
    });

    modal.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        switch (action) {
          case 'duplicate': this.duplicateSlide(); break;
          case 'delete': this.deleteSlide(); break;
          case 'move-up': this.moveSlideUp(); break;
          case 'move-down': this.moveSlideDown(); break;
        }
        modal.remove();
      });
    });
  }

  /**
   * Generate slide type buttons HTML
   */
  getSlideTypeButtons() {
    const types = [
      { type: 'title', label: '📄 Title Slide' },
      { type: 'bullets', label: '• Bullet Points' },
      { type: 'two-column', label: '⚏ Two Column' },
      { type: 'image', label: '🖼️ Image Slide' },
      { type: 'section', label: '📑 Section Break' },
      { type: 'quote', label: '💬 Quote' },
      { type: 'table', label: '📊 Table' },
      { type: 'comparison', label: '⚖️ Comparison' }
    ];

    return types.map(t =>
      `<button class="slide-type-btn" data-type="${t.type}">${t.label}</button>`
    ).join('');
  }
}
```

#### 2.3.3 Integration into PresentationSlides.js

```javascript
// Add to PresentationSlides.js constructor
import { SlideEditor } from './SlideEditor.js';
import { SlideManager } from './SlideManager.js';

constructor(containerId, slides, theme) {
  // ... existing code ...

  this.editor = new SlideEditor(this);
  this.manager = new SlideManager(this);

  // Check for auto-saved presentation
  const autoSaved = SlideEditor.restoreAutoSave();
  if (autoSaved) {
    const restore = confirm('Found auto-saved changes. Restore them?');
    if (restore) {
      this.slides = autoSaved.slides;
      this.theme = autoSaved.theme;
      this.metadata = autoSaved.metadata;
    }
  }
}

// Add editing buttons to controls
_buildControlButtons() {
  const controls = document.createElement('div');
  controls.className = 'presentation-controls';

  // ... existing buttons ...

  // Edit Mode button
  const editBtn = document.createElement('button');
  editBtn.className = 'control-btn edit-mode-btn';
  editBtn.innerHTML = '✏️ Edit Slides';
  editBtn.addEventListener('click', () => {
    this.editor.toggleEditMode();
  });
  controls.appendChild(editBtn);

  // Manage Slides button
  const manageBtn = document.createElement('button');
  manageBtn.className = 'control-btn manage-slides-btn';
  manageBtn.innerHTML = '📋 Manage Slides';
  manageBtn.addEventListener('click', () => {
    this.manager.showManagementPanel();
  });
  controls.appendChild(manageBtn);

  return controls;
}

// Add keyboard shortcuts for undo/redo
_setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.editor.undo();
    }

    // Ctrl/Cmd + Shift + Z = Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      this.editor.redo();
    }

    // ... existing keyboard shortcuts ...
  });
}
```

### 2.4 Success Criteria

- ✅ Toggle edit mode enables contenteditable on text elements
- ✅ Changes to text update slide data immediately
- ✅ Auto-save to localStorage after each change
- ✅ Restore auto-saved presentation on page reload
- ✅ Undo/redo system works correctly (Ctrl+Z, Ctrl+Shift+Z)
- ✅ Add new slides of any type after current slide
- ✅ Delete slides with confirmation
- ✅ Duplicate slides creates exact copy
- ✅ Move slides up/down reorders presentation
- ✅ Slide management panel shows all options

---

## Phase 3: Enhanced Export Capabilities (Week 2-3)

### 3.1 Architecture

**Three Export Formats**:
1. **PDF Export**: Full presentation as PDF document (using jsPDF + html2canvas)
2. **PNG Export**: Individual slides as PNG images
3. **Print View**: Print-optimized HTML layout

**Export Flow**:
```
User clicks export → Show progress indicator → Render slides → Generate file → Download
```

### 3.2 File Structure

**New Files**:
- `Public/ExportManager.js` (~400 lines) - Handles all export formats
- `Public/PrintView.js` (~150 lines) - Print-optimized rendering

**Modified Files**:
- `Public/PresentationSlides.js` - Add export buttons
- `Public/style.css` - Add print styles

### 3.3 Implementation Details

#### 3.3.1 ExportManager.js - Multi-Format Export

```javascript
/**
 * ExportManager.js
 *
 * Handles PDF, PNG, and print exports.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export class ExportManager {
  constructor(presentation) {
    this.presentation = presentation;
    this.isExporting = false;
  }

  /**
   * Export entire presentation as PDF
   */
  async exportToPDF() {
    if (this.isExporting) {
      alert('Export already in progress');
      return;
    }

    this.isExporting = true;
    this.showProgress('Generating PDF...', 0);

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'in',
        format: [10, 5.625] // 16:9 aspect ratio
      });

      const slides = this.presentation.slides;
      const totalSlides = slides.length;

      for (let i = 0; i < totalSlides; i++) {
        this.updateProgress(`Rendering slide ${i + 1} of ${totalSlides}...`,
          (i / totalSlides) * 100);

        // Render slide to temporary container
        const slideHTML = await this.renderSlideForExport(slides[i], i);
        const canvas = await html2canvas(slideHTML, {
          width: 1920,
          height: 1080,
          scale: 2
        });

        const imgData = canvas.toDataURL('image/png');

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'PNG', 0, 0, 10, 5.625);
      }

      this.updateProgress('Finalizing PDF...', 100);

      const filename = `${this.presentation.metadata.title || 'presentation'}.pdf`;
      pdf.save(filename);

      this.hideProgress();
      console.log('[ExportManager] PDF exported successfully');
    } catch (error) {
      console.error('[ExportManager] PDF export failed:', error);
      alert('PDF export failed. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Export current slide as PNG
   */
  async exportCurrentSlideToPNG() {
    if (this.isExporting) {
      alert('Export already in progress');
      return;
    }

    this.isExporting = true;
    this.showProgress('Generating PNG...', 50);

    try {
      const currentSlideEl = this.presentation.getCurrentSlideElement();
      const canvas = await html2canvas(currentSlideEl, {
        width: 1920,
        height: 1080,
        scale: 2,
        backgroundColor: '#ffffff'
      });

      const filename = `slide-${this.presentation.currentSlideIndex + 1}.png`;
      this.downloadCanvas(canvas, filename);

      this.hideProgress();
      console.log('[ExportManager] PNG exported successfully');
    } catch (error) {
      console.error('[ExportManager] PNG export failed:', error);
      alert('PNG export failed. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Export all slides as individual PNGs (ZIP)
   */
  async exportAllSlidesToPNG() {
    if (this.isExporting) {
      alert('Export already in progress');
      return;
    }

    this.isExporting = true;
    this.showProgress('Generating PNGs...', 0);

    try {
      const slides = this.presentation.slides;
      const totalSlides = slides.length;
      const images = [];

      for (let i = 0; i < totalSlides; i++) {
        this.updateProgress(`Rendering slide ${i + 1} of ${totalSlides}...`,
          (i / totalSlides) * 100);

        const slideHTML = await this.renderSlideForExport(slides[i], i);
        const canvas = await html2canvas(slideHTML, {
          width: 1920,
          height: 1080,
          scale: 2
        });

        images.push({
          filename: `slide-${i + 1}.png`,
          data: canvas.toDataURL('image/png')
        });
      }

      // Download all images (browser will prompt for each)
      images.forEach((img, idx) => {
        setTimeout(() => {
          const link = document.createElement('a');
          link.download = img.filename;
          link.href = img.data;
          link.click();
        }, idx * 500); // Stagger downloads to avoid browser blocking
      });

      this.hideProgress();
      console.log('[ExportManager] All PNGs exported successfully');
    } catch (error) {
      console.error('[ExportManager] PNG export failed:', error);
      alert('PNG export failed. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Open print-optimized view
   */
  openPrintView() {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');

    const printHTML = this.generatePrintHTML();
    printWindow.document.write(printHTML);
    printWindow.document.close();

    // Trigger print dialog after content loads
    printWindow.onload = () => {
      printWindow.print();
    };

    console.log('[ExportManager] Print view opened');
  }

  /**
   * Generate print-optimized HTML
   */
  generatePrintHTML() {
    const slides = this.presentation.slides;
    const slidesHTML = slides.map((slide, idx) => {
      const renderer = new WebRenderer(slide, this.presentation.theme);
      return `
        <div class="print-slide" data-slide="${idx + 1}">
          ${renderer.render(idx, slides.length)}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${this.presentation.metadata.title} - Print View</title>
        <link rel="stylesheet" href="style.css">
        <style>
          @media print {
            .print-slide {
              page-break-after: always;
              width: 10in;
              height: 5.625in;
            }
            .print-slide:last-child {
              page-break-after: auto;
            }
          }
          @media screen {
            .print-slide {
              margin: 20px auto;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
          }
        </style>
      </head>
      <body>
        ${slidesHTML}
      </body>
      </html>
    `;
  }

  /**
   * Render slide to temporary container for export
   */
  async renderSlideForExport(slide, slideIndex) {
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '1920px';
    tempContainer.style.height = '1080px';
    document.body.appendChild(tempContainer);

    const renderer = new WebRenderer(slide, this.presentation.theme);
    tempContainer.innerHTML = renderer.render(slideIndex, this.presentation.slides.length);

    return tempContainer;
  }

  /**
   * Download canvas as PNG
   */
  downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /**
   * Progress indicator
   */
  showProgress(message, percent) {
    let modal = document.getElementById('export-progress-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'export-progress-modal';
      modal.className = 'export-progress-modal';
      modal.innerHTML = `
        <div class="progress-content">
          <div class="progress-message"></div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="progress-percent"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.querySelector('.progress-message').textContent = message;
    modal.querySelector('.progress-fill').style.width = `${percent}%`;
    modal.querySelector('.progress-percent').textContent = `${Math.round(percent)}%`;
    modal.style.display = 'flex';
  }

  updateProgress(message, percent) {
    this.showProgress(message, percent);
  }

  hideProgress() {
    const modal = document.getElementById('export-progress-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
}
```

#### 3.3.2 Integration into PresentationSlides.js

```javascript
// Add to PresentationSlides.js constructor
import { ExportManager } from './ExportManager.js';

constructor(containerId, slides, theme) {
  // ... existing code ...
  this.exportManager = new ExportManager(this);
}

// Add export dropdown to controls
_buildControlButtons() {
  const controls = document.createElement('div');
  controls.className = 'presentation-controls';

  // ... existing buttons ...

  // Export dropdown
  const exportDropdown = document.createElement('div');
  exportDropdown.className = 'export-dropdown';
  exportDropdown.innerHTML = `
    <button class="control-btn export-btn">💾 Export ▾</button>
    <div class="export-menu">
      <button class="export-option" data-format="pptx">📊 PowerPoint (.pptx)</button>
      <button class="export-option" data-format="pdf">📄 PDF Document</button>
      <button class="export-option" data-format="png">🖼️ Current Slide (PNG)</button>
      <button class="export-option" data-format="png-all">🖼️ All Slides (PNG)</button>
      <button class="export-option" data-format="print">🖨️ Print View</button>
    </div>
  `;

  // Toggle dropdown
  exportDropdown.querySelector('.export-btn').addEventListener('click', () => {
    exportDropdown.classList.toggle('open');
  });

  // Export options
  exportDropdown.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format;
      this.handleExport(format);
      exportDropdown.classList.remove('open');
    });
  });

  controls.appendChild(exportDropdown);
  return controls;
}

// Handle export format selection
handleExport(format) {
  switch (format) {
    case 'pptx':
      this.exportToPowerPoint(); // Existing functionality
      break;
    case 'pdf':
      this.exportManager.exportToPDF();
      break;
    case 'png':
      this.exportManager.exportCurrentSlideToPNG();
      break;
    case 'png-all':
      this.exportManager.exportAllSlidesToPNG();
      break;
    case 'print':
      this.exportManager.openPrintView();
      break;
  }
}
```

### 3.4 Success Criteria

- ✅ PDF export generates multi-page document with all slides
- ✅ PDF maintains 16:9 aspect ratio
- ✅ PNG export of current slide downloads correctly
- ✅ PNG export of all slides downloads multiple files
- ✅ Print view opens in new window with print-optimized layout
- ✅ Print view triggers browser print dialog
- ✅ Progress indicator shows during export
- ✅ Export dropdown menu works correctly
- ✅ All export formats maintain visual fidelity

---

## Testing Strategy

### Unit Tests
- SlideEditor: Content editing, undo/redo, auto-save
- SlideManager: Add, delete, duplicate, reorder operations
- ExportManager: PDF generation, PNG generation, print HTML

### Integration Tests
- Presenter Mode: Window synchronization, navigation, timer
- Edit Mode: Full edit-save-restore cycle
- Export: End-to-end export for all formats

### Manual Testing Checklist
- [ ] Presenter mode opens on second monitor
- [ ] Presenter window stays synchronized with main window
- [ ] Timer counts up correctly and can be reset
- [ ] Edit mode enables contenteditable
- [ ] Changes persist after page reload
- [ ] Undo/redo works correctly
- [ ] Add slide creates new slide after current
- [ ] Delete slide removes and reorders correctly
- [ ] Duplicate slide creates exact copy
- [ ] Move up/down reorders slides
- [ ] PDF export generates correct number of pages
- [ ] PNG export downloads image file
- [ ] Print view opens with all slides

---

## Implementation Timeline

### Week 1: Presenter Mode
- Days 1-2: PresenterMode.js, presenter-view.html
- Days 3-4: Integration, window synchronization
- Day 5: Testing and bug fixes

### Week 2: Slide Editing
- Days 1-2: SlideEditor.js (contenteditable, undo/redo)
- Days 3-4: SlideManager.js (CRUD operations)
- Day 5: Testing and bug fixes

### Week 3: Enhanced Exports
- Days 1-2: ExportManager.js (PDF, PNG)
- Days 3-4: Print view, progress indicators
- Day 5: Final testing and polish

---

## Dependencies

### Required Libraries
- **jsPDF**: PDF generation (already available via CDN)
- **html2canvas**: HTML to canvas conversion (already available)
- **PptxGenJS**: PowerPoint export (already integrated)

### Browser APIs
- **postMessage**: Cross-window communication
- **localStorage**: Auto-save persistence
- **contenteditable**: Inline editing
- **window.open**: Presenter window creation

---

## File Size Impact

**New Code**:
- PresenterMode.js: ~400 lines
- presenter-view.html: ~150 lines
- presenter-view.css: ~200 lines
- SlideEditor.js: ~500 lines
- SlideManager.js: ~300 lines
- ThemeCustomizer.js: ~250 lines
- ExportManager.js: ~400 lines
- PrintView.js: ~150 lines

**Total New Code**: ~2,350 lines
**Modified Files**: PresentationSlides.js (+200 lines), style.css (+150 lines)

**Grand Total**: ~2,700 lines of new/modified code

---

## Backwards Compatibility

All enhancements are **additive** - existing functionality remains unchanged:
- ✅ Current presentation viewer works without changes
- ✅ Existing PowerPoint export continues to work
- ✅ No breaking changes to SlideDataModel
- ✅ Auto-save is opt-in (only activates in edit mode)

---

## Future Enhancements (Out of Scope)

These features could be added in future phases:
- Real-time collaboration (WebSockets)
- Cloud storage integration (Google Drive, Dropbox)
- Video/audio embedding in slides
- Slide transitions and animations
- Remote control via mobile app
- Analytics (slide view tracking)
- AI-powered slide suggestions

---

## Success Metrics

**Presenter Mode**:
- Successfully launches on 95%+ of modern browsers
- Window synchronization < 100ms latency
- Zero crashes during 30-minute presentations

**Slide Editing**:
- Auto-save recovery rate: 100%
- Undo/redo accuracy: 100%
- Edit mode performance: No visible lag on 20-slide presentations

**Enhanced Exports**:
- PDF generation success rate: 95%+
- PNG export fidelity: 100% visual match
- Print view compatibility: All major browsers

---

## Conclusion

This implementation plan delivers three high-value features that transform the presentation system into a professional-grade tool:

1. **Presenter Mode**: Enables confident public speaking with speaker notes and preview
2. **Slide Editing**: Allows quick iterations without regenerating entire presentations
3. **Enhanced Exports**: Provides flexibility for different distribution channels

**Estimated Effort**: 2-3 weeks for full implementation
**Risk Level**: Low (all dependencies already available, no breaking changes)
**Value Proposition**: High (addresses top user requests for presentation tools)
