/**
 * SlideManager.js
 *
 * Handles slide creation, deletion, duplication, and reordering.
 * Features:
 * - Add new slides (any type)
 * - Delete slides with confirmation
 * - Duplicate slides
 * - Reorder slides (move up/down)
 * - Management modal UI
 *
 * Part of Phase 2: Slide Editing Capabilities
 */

import { createBlankSlide } from './SlideDataModel.js';

export class SlideManager {
  /**
   * Create a new SlideManager instance
   * @param {PresentationSlides} presentation - Reference to PresentationSlides instance
   */
  constructor(presentation) {
    this.presentation = presentation;
  }

  /**
   * Add new slide after current slide
   * @param {string} type - Slide type (title, bullets, two-column, etc.)
   */
  addSlide(type = 'bullets') {
    try {
      // Create blank slide of specified type
      const newSlide = createBlankSlide(type);

      // Insert after current slide
      const insertIndex = this.presentation.currentSlideIndex + 1;
      this.presentation.presentationData.slides.splice(insertIndex, 0, newSlide);

      // Update legacy reference
      this.presentation.slidesData.slides = this.presentation.presentationData.slides;

      // Navigate to new slide
      this.presentation._goToSlide(insertIndex);

      // Auto-save if editor is available
      if (this.presentation.editor) {
        this.presentation.editor.autoSave();
      }

      console.log(`[SlideManager] Added ${type} slide at index ${insertIndex}`);

      return insertIndex;
    } catch (error) {
      console.error('[SlideManager] Failed to add slide:', error);
      alert('Failed to add slide. Please try again.');
      return -1;
    }
  }

  /**
   * Delete current slide
   */
  deleteSlide() {
    const slides = this.presentation.presentationData.slides;

    // Prevent deleting the last slide
    if (slides.length <= 1) {
      alert('Cannot delete the last slide. Presentations must have at least one slide.');
      return false;
    }

    // Confirm deletion
    const currentSlideIndex = this.presentation.currentSlideIndex;
    const slideTitle = this.getSlideTitle(slides[currentSlideIndex]);
    const confirmDelete = confirm(
      `Delete slide ${currentSlideIndex + 1}?\n\n"${slideTitle}"\n\nThis cannot be undone.`
    );

    if (!confirmDelete) {
      return false;
    }

    try {
      // Remove slide
      slides.splice(currentSlideIndex, 1);

      // Update legacy reference
      this.presentation.slidesData.slides = slides;

      // Navigate to previous slide or stay at same index
      const newIndex = Math.min(currentSlideIndex, slides.length - 1);
      this.presentation._goToSlide(newIndex);

      // Auto-save if editor is available
      if (this.presentation.editor) {
        this.presentation.editor.autoSave();
      }

      console.log(`[SlideManager] Deleted slide at index ${currentSlideIndex}`);

      return true;
    } catch (error) {
      console.error('[SlideManager] Failed to delete slide:', error);
      alert('Failed to delete slide. Please try again.');
      return false;
    }
  }

  /**
   * Duplicate current slide
   */
  duplicateSlide() {
    try {
      const currentSlide = this.presentation.presentationData.slides[this.presentation.currentSlideIndex];

      // Deep clone the slide
      const duplicate = JSON.parse(JSON.stringify(currentSlide));

      // Generate new ID
      duplicate.id = `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Insert after current slide
      const insertIndex = this.presentation.currentSlideIndex + 1;
      this.presentation.presentationData.slides.splice(insertIndex, 0, duplicate);

      // Update legacy reference
      this.presentation.slidesData.slides = this.presentation.presentationData.slides;

      // Navigate to duplicate
      this.presentation._goToSlide(insertIndex);

      // Auto-save if editor is available
      if (this.presentation.editor) {
        this.presentation.editor.autoSave();
      }

      console.log(`[SlideManager] Duplicated slide at index ${insertIndex}`);

      return insertIndex;
    } catch (error) {
      console.error('[SlideManager] Failed to duplicate slide:', error);
      alert('Failed to duplicate slide. Please try again.');
      return -1;
    }
  }

  /**
   * Move slide up (swap with previous)
   */
  moveSlideUp() {
    const currentIndex = this.presentation.currentSlideIndex;

    // Check if already at top
    if (currentIndex === 0) {
      console.log('[SlideManager] Already at top');
      return false;
    }

    try {
      const slides = this.presentation.presentationData.slides;

      // Swap with previous slide
      [slides[currentIndex], slides[currentIndex - 1]] =
        [slides[currentIndex - 1], slides[currentIndex]];

      // Update legacy reference
      this.presentation.slidesData.slides = slides;

      // Navigate to new position
      this.presentation._goToSlide(currentIndex - 1);

      // Auto-save if editor is available
      if (this.presentation.editor) {
        this.presentation.editor.autoSave();
      }

      console.log(`[SlideManager] Moved slide up from ${currentIndex} to ${currentIndex - 1}`);

      return true;
    } catch (error) {
      console.error('[SlideManager] Failed to move slide up:', error);
      alert('Failed to move slide. Please try again.');
      return false;
    }
  }

  /**
   * Move slide down (swap with next)
   */
  moveSlideDown() {
    const currentIndex = this.presentation.currentSlideIndex;
    const slides = this.presentation.presentationData.slides;

    // Check if already at bottom
    if (currentIndex === slides.length - 1) {
      console.log('[SlideManager] Already at bottom');
      return false;
    }

    try {
      // Swap with next slide
      [slides[currentIndex], slides[currentIndex + 1]] =
        [slides[currentIndex + 1], slides[currentIndex]];

      // Update legacy reference
      this.presentation.slidesData.slides = slides;

      // Navigate to new position
      this.presentation._goToSlide(currentIndex + 1);

      // Auto-save if editor is available
      if (this.presentation.editor) {
        this.presentation.editor.autoSave();
      }

      console.log(`[SlideManager] Moved slide down from ${currentIndex} to ${currentIndex + 1}`);

      return true;
    } catch (error) {
      console.error('[SlideManager] Failed to move slide down:', error);
      alert('Failed to move slide. Please try again.');
      return false;
    }
  }

  /**
   * Get slide title for display
   * Handles both string and object formats for title fields (BIP slides compatibility)
   * @private
   */
  getSlideTitle(slide) {
    if (!slide || !slide.content) return 'Untitled Slide';

    // Try different title fields based on slide type
    // Handle both string and object formats (e.g., "Title" vs { text: "Title" })
    if (slide.content.title) {
      const titleText = typeof slide.content.title === 'string'
        ? slide.content.title
        : slide.content.title?.text;
      if (titleText) return titleText;
    }

    if (slide.content.sectionTitle) {
      const sectionText = typeof slide.content.sectionTitle === 'string'
        ? slide.content.sectionTitle
        : slide.content.sectionTitle?.text;
      if (sectionText) return sectionText;
    }

    if (slide.content.quote) {
      const quoteText = typeof slide.content.quote === 'string'
        ? slide.content.quote
        : slide.content.quote?.text;
      if (quoteText) return quoteText.substring(0, 50) + '...';
    }

    return `${slide.type.charAt(0).toUpperCase() + slide.type.slice(1)} Slide`;
  }

  /**
   * Show slide management modal
   */
  showManagementPanel() {
    // Remove existing modal if present
    const existing = document.getElementById('slide-manager-modal');
    if (existing) {
      existing.remove();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'slide-manager-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = this._buildModalHTML();

    document.body.appendChild(modal);

    // Add event listeners
    this._attachModalListeners(modal);

    console.log('[SlideManager] Management panel opened');
  }

  /**
   * Build modal HTML
   * @private
   */
  _buildModalHTML() {
    const currentSlide = this.presentation.presentationData.slides[this.presentation.currentSlideIndex];
    const slideTitle = this.getSlideTitle(currentSlide);

    return `
      <div class="modal-content slide-manager-content">
        <div class="modal-header">
          <h2 class="modal-title">📋 Manage Slides</h2>
          <button class="modal-close-btn" data-action="close" title="Close">×</button>
        </div>

        <div class="modal-body">
          <!-- Current Slide Info -->
          <div class="current-slide-info">
            <h3>Current Slide</h3>
            <p class="slide-info-text">
              <strong>Slide ${this.presentation.currentSlideIndex + 1}</strong> of ${this.presentation.presentationData.slides.length}
              <br>
              <em>"${slideTitle}"</em>
            </p>
          </div>

          <!-- Add Slide Section -->
          <div class="manager-section">
            <h3>➕ Add New Slide</h3>
            <p class="section-description">Choose a slide type to insert after the current slide:</p>
            <div class="slide-type-grid">
              ${this._getSlideTypeButtons()}
            </div>
          </div>

          <!-- Current Slide Actions -->
          <div class="manager-section">
            <h3>✏️ Current Slide Actions</h3>
            <div class="action-buttons">
              <button class="action-btn" data-action="duplicate" title="Duplicate current slide">
                📋 Duplicate Slide
              </button>
              <button class="action-btn danger" data-action="delete" title="Delete current slide">
                🗑️ Delete Slide
              </button>
            </div>
          </div>

          <!-- Reorder Section -->
          <div class="manager-section">
            <h3>↕️ Reorder Slides</h3>
            <div class="action-buttons">
              <button class="action-btn" data-action="move-up" title="Move slide up" ${this.presentation.currentSlideIndex === 0 ? 'disabled' : ''}>
                ⬆️ Move Up
              </button>
              <button class="action-btn" data-action="move-down" title="Move slide down" ${this.presentation.currentSlideIndex === this.presentation.presentationData.slides.length - 1 ? 'disabled' : ''}>
                ⬇️ Move Down
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="modal-btn modal-btn-secondary" data-action="close">Close</button>
        </div>
      </div>
    `;
  }

  /**
   * Generate slide type buttons HTML
   * @private
   */
  _getSlideTypeButtons() {
    const types = [
      { type: 'title', label: '📄 Title Slide', description: 'Main title with subtitle' },
      { type: 'bullets', label: '• Bullet Points', description: 'Bullet list' },
      { type: 'two-column', label: '⚏ Two Column', description: 'Side-by-side content' },
      { type: 'image', label: '🖼️ Image', description: 'Image with caption' },
      { type: 'section', label: '📑 Section', description: 'Section break with gradient' },
      { type: 'quote', label: '💬 Quote', description: 'Centered quote' },
      { type: 'table', label: '📊 Table', description: 'Data table' },
      { type: 'comparison', label: '⚖️ Comparison', description: 'Side-by-side comparison' }
    ];

    return types.map(t => `
      <button class="slide-type-btn" data-type="${t.type}" title="${t.description}">
        <div class="slide-type-label">${t.label}</div>
        <div class="slide-type-desc">${t.description}</div>
      </button>
    `).join('');
  }

  /**
   * Attach event listeners to modal
   * @private
   */
  _attachModalListeners(modal) {
    // Close buttons
    modal.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Slide type buttons
    modal.querySelectorAll('.slide-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        this.addSlide(type);
        modal.remove();
      });
    });

    // Action buttons
    modal.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        let success = false;

        switch (action) {
          case 'duplicate':
            success = this.duplicateSlide() !== -1;
            break;
          case 'delete':
            success = this.deleteSlide();
            break;
          case 'move-up':
            success = this.moveSlideUp();
            break;
          case 'move-down':
            success = this.moveSlideDown();
            break;
        }

        // Close modal after successful action (except delete which has confirmation)
        if (success || action === 'delete') {
          modal.remove();
        }
      });
    });

    // ESC key to close
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }

  /**
   * Get manager status
   */
  getStatus() {
    return {
      totalSlides: this.presentation.presentationData.slides.length,
      currentSlideIndex: this.presentation.currentSlideIndex,
      canMoveUp: this.presentation.currentSlideIndex > 0,
      canMoveDown: this.presentation.currentSlideIndex < this.presentation.presentationData.slides.length - 1,
      canDelete: this.presentation.presentationData.slides.length > 1
    };
  }
}
