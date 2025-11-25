/**
 * SlidesView Component
 * Phase 3: Presentation mode for generated slides
 *
 * Features:
 * - Slide rendering with multiple layouts (title, bullets, content, quote)
 * - Navigation controls (prev/next buttons, keyboard shortcuts)
 * - Slide counter and progress indicator
 * - Thumbnail navigator for quick jumping
 * - Fullscreen mode
 * - Keyboard shortcuts (arrow keys, space, Esc)
 */

export class SlidesView {
  /**
   * @param {object} slidesData - Slides data from API
   * @param {string} sessionId - Session ID for data fetching
   */
  constructor(slidesData = null, sessionId = null) {
    this.slidesData = slidesData;
    this.sessionId = sessionId;
    this.currentSlide = 0;
    this.isFullscreen = false;
    this.container = null;
    this.slideElement = null;
    this.keyboardHandler = null;
  }

  /**
   * Render the slides view
   * @returns {HTMLElement} Container element
   */
  render() {
    this.container = document.createElement('div');
    this.container.className = 'slides-view';

    if (!this.slidesData || !this.slidesData.slides || this.slidesData.slides.length === 0) {
      this.container.appendChild(this._renderEmptyState());
      return this.container;
    }

    // Create main structure
    const slidesContainer = document.createElement('div');
    slidesContainer.className = 'slides-container';

    // Slide display area
    const slideDisplay = document.createElement('div');
    slideDisplay.className = 'slide-display';
    this.slideElement = this._renderSlide(this.currentSlide);
    slideDisplay.appendChild(this.slideElement);

    // Navigation controls
    const controls = this._renderControls();

    // Thumbnail navigator
    const thumbnails = this._renderThumbnails();

    // Keyboard hint
    const keyboardHint = this._renderKeyboardHint();

    // Assemble view
    slidesContainer.appendChild(slideDisplay);
    slidesContainer.appendChild(controls);
    slidesContainer.appendChild(thumbnails);
    slidesContainer.appendChild(keyboardHint);

    this.container.appendChild(slidesContainer);

    // Setup keyboard navigation
    this._setupKeyboardNavigation();

    return this.container;
  }

  /**
   * Render a single slide
   * @param {number} index - Slide index
   * @returns {HTMLElement} Slide element
   */
  _renderSlide(index) {
    const slide = this.slidesData.slides[index];
    const slideEl = document.createElement('div');
    slideEl.className = 'slide';
    slideEl.setAttribute('data-slide-type', slide.type);
    slideEl.setAttribute('data-slide-index', index);

    const content = document.createElement('div');
    content.className = 'slide-content';

    switch (slide.type) {
      case 'title':
        content.appendChild(this._renderTitleSlide(slide));
        break;
      case 'bullets':
        content.appendChild(this._renderBulletsSlide(slide));
        break;
      case 'content':
        content.appendChild(this._renderContentSlide(slide));
        break;
      case 'quote':
        content.appendChild(this._renderQuoteSlide(slide));
        break;
      default:
        content.appendChild(this._renderBulletsSlide(slide));
    }

    slideEl.appendChild(content);
    return slideEl;
  }

  /**
   * Render title slide layout
   */
  _renderTitleSlide(slide) {
    const fragment = document.createDocumentFragment();

    const title = document.createElement('h1');
    title.className = 'slide-title';
    title.textContent = slide.title;
    fragment.appendChild(title);

    if (slide.subtitle) {
      const subtitle = document.createElement('p');
      subtitle.className = 'slide-subtitle';
      subtitle.textContent = slide.subtitle;
      fragment.appendChild(subtitle);
    }

    return fragment;
  }

  /**
   * Render bullets slide layout
   */
  _renderBulletsSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    if (slide.bullets && slide.bullets.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'slide-bullets';

      slide.bullets.forEach(bullet => {
        const li = document.createElement('li');
        li.textContent = bullet;
        ul.appendChild(li);
      });

      fragment.appendChild(ul);
    }

    return fragment;
  }

  /**
   * Render content slide layout
   */
  _renderContentSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    if (slide.content) {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'slide-text';
      // Split by newlines and create paragraphs
      const paragraphs = slide.content.split('\n\n');
      paragraphs.forEach(para => {
        if (para.trim()) {
          const p = document.createElement('p');
          p.textContent = para.trim();
          contentDiv.appendChild(p);
        }
      });
      fragment.appendChild(contentDiv);
    }

    return fragment;
  }

  /**
   * Render quote slide layout
   */
  _renderQuoteSlide(slide) {
    const fragment = document.createDocumentFragment();

    if (slide.quote) {
      const blockquote = document.createElement('blockquote');
      blockquote.className = 'slide-quote';
      blockquote.textContent = slide.quote;
      fragment.appendChild(blockquote);
    }

    if (slide.attribution) {
      const attribution = document.createElement('p');
      attribution.className = 'slide-attribution';
      attribution.textContent = `— ${slide.attribution}`;
      fragment.appendChild(attribution);
    }

    return fragment;
  }

  /**
   * Render navigation controls
   */
  _renderControls() {
    const controls = document.createElement('div');
    controls.className = 'slide-controls';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'slide-nav-button';
    prevBtn.innerHTML = '←';
    prevBtn.setAttribute('aria-label', 'Previous slide');
    prevBtn.disabled = this.currentSlide === 0;
    prevBtn.addEventListener('click', () => this.previousSlide());

    // Counter
    const counter = document.createElement('div');
    counter.className = 'slide-counter';
    counter.innerHTML = `
      <span class="current-slide">${this.currentSlide + 1}</span>
      <span class="slide-divider">/</span>
      <span class="total-slides">${this.slidesData.slides.length}</span>
    `;

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'slide-nav-button';
    nextBtn.innerHTML = '→';
    nextBtn.setAttribute('aria-label', 'Next slide');
    nextBtn.disabled = this.currentSlide === this.slidesData.slides.length - 1;
    nextBtn.addEventListener('click', () => this.nextSlide());

    // Fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'slide-nav-button';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.setAttribute('aria-label', 'Toggle fullscreen');
    fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

    // Export to PowerPoint button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'slide-export-button';
    exportBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>Download PPT</span>
    `;
    exportBtn.setAttribute('aria-label', 'Download as PowerPoint');
    exportBtn.addEventListener('click', () => this.exportToPowerPoint());
    this.exportButton = exportBtn;

    controls.appendChild(prevBtn);
    controls.appendChild(counter);
    controls.appendChild(nextBtn);
    controls.appendChild(fullscreenBtn);
    controls.appendChild(exportBtn);

    // Store references for updates
    this.prevButton = prevBtn;
    this.nextButton = nextBtn;
    this.counterElement = counter;

    return controls;
  }

  /**
   * Export slides to PowerPoint
   */
  async exportToPowerPoint() {
    if (!this.sessionId) {
      console.error('No session ID available for export');
      return;
    }

    try {
      // Disable button and show loading state
      this.exportButton.disabled = true;
      this.exportButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
        </svg>
        <span>Exporting...</span>
      `;

      // Fetch the PowerPoint file
      const response = await fetch(`/api/content/${this.sessionId}/slides/export`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export slides');
      }

      // Get the blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'presentation.pptx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export error:', error);
      alert(`Failed to export: ${error.message}`);
    } finally {
      // Restore button state
      this.exportButton.disabled = false;
      this.exportButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>Download PPT</span>
      `;
    }
  }

  /**
   * Render thumbnail navigator
   */
  _renderThumbnails() {
    const thumbnailsContainer = document.createElement('div');
    thumbnailsContainer.className = 'slide-thumbnails';

    this.slidesData.slides.forEach((slide, index) => {
      const thumbnail = document.createElement('button');
      thumbnail.className = 'thumbnail';
      if (index === this.currentSlide) {
        thumbnail.classList.add('active');
      }

      const preview = document.createElement('div');
      preview.className = 'thumbnail-preview';
      preview.textContent = index + 1;

      thumbnail.appendChild(preview);
      thumbnail.setAttribute('aria-label', `Go to slide ${index + 1}`);
      thumbnail.addEventListener('click', () => this.goToSlide(index));

      thumbnailsContainer.appendChild(thumbnail);
    });

    this.thumbnailsContainer = thumbnailsContainer;

    return thumbnailsContainer;
  }

  /**
   * Render keyboard hint
   */
  _renderKeyboardHint() {
    const hint = document.createElement('div');
    hint.className = 'keyboard-hint';
    hint.innerHTML = `
      Use <kbd>←</kbd> <kbd>→</kbd> or <kbd>Space</kbd> to navigate
      • <kbd>F</kbd> for fullscreen
      • <kbd>Esc</kbd> to exit
    `;
    return hint;
  }

  /**
   * Render empty state
   */
  _renderEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="9" x2="15" y2="9"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="15" x2="13" y2="15"/>
      </svg>
      <h2>No Slides Available</h2>
      <p>Slides have not been generated yet for this session.</p>
    `;
    return emptyState;
  }

  /**
   * Navigate to next slide
   */
  nextSlide() {
    if (this.currentSlide < this.slidesData.slides.length - 1) {
      this.currentSlide++;
      this._updateSlideDisplay();
    }
  }

  /**
   * Navigate to previous slide
   */
  previousSlide() {
    if (this.currentSlide > 0) {
      this.currentSlide--;
      this._updateSlideDisplay();
    }
  }

  /**
   * Navigate to specific slide
   */
  goToSlide(index) {
    if (index >= 0 && index < this.slidesData.slides.length) {
      this.currentSlide = index;
      this._updateSlideDisplay();
    }
  }

  /**
   * Update slide display after navigation
   */
  _updateSlideDisplay() {
    // Update slide
    const newSlide = this._renderSlide(this.currentSlide);
    this.slideElement.replaceWith(newSlide);
    this.slideElement = newSlide;

    // Update buttons
    this.prevButton.disabled = this.currentSlide === 0;
    this.nextButton.disabled = this.currentSlide === this.slidesData.slides.length - 1;

    // Update counter
    this.counterElement.querySelector('.current-slide').textContent = this.currentSlide + 1;

    // Update thumbnails
    const thumbnails = this.thumbnailsContainer.querySelectorAll('.thumbnail');
    thumbnails.forEach((thumb, index) => {
      thumb.classList.toggle('active', index === this.currentSlide);
    });

    // Scroll thumbnail into view
    const activeThumbnail = thumbnails[this.currentSlide];
    if (activeThumbnail) {
      activeThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    this.container.classList.toggle('fullscreen', this.isFullscreen);

    if (this.isFullscreen) {
      // Request fullscreen API if available
      if (this.container.requestFullscreen) {
        this.container.requestFullscreen().catch(err => {
          console.warn('Fullscreen request failed:', err);
        });
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
  }

  /**
   * Setup keyboard navigation
   */
  _setupKeyboardNavigation() {
    this.keyboardHandler = (e) => {
      // Only handle keyboard events when slides view is active
      if (!this.container || !this.container.isConnected) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case ' ': // Space
          e.preventDefault();
          this.nextSlide();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.previousSlide();
          break;
        case 'Home':
          e.preventDefault();
          this.goToSlide(0);
          break;
        case 'End':
          e.preventDefault();
          this.goToSlide(this.slidesData.slides.length - 1);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case 'Escape':
          if (this.isFullscreen) {
            e.preventDefault();
            this.toggleFullscreen();
          }
          break;
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Cleanup and remove event listeners
   */
  destroy() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }

    // Exit fullscreen if active
    if (this.isFullscreen && document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen();
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  /**
   * Load slides data from API
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async loadData(sessionId) {
    try {
      const response = await fetch(`/api/content/${sessionId}/slides`);

      if (!response.ok) {
        throw new Error(`Failed to load slides: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.status === 'completed' && result.data) {
        this.slidesData = result.data;
        this.sessionId = sessionId;
      } else if (result.status === 'processing') {
        throw new Error('Slides are still being generated. Please wait...');
      } else if (result.status === 'error') {
        throw new Error(result.error || 'Failed to generate slides');
      }

    } catch (error) {
      console.error('Error loading slides:', error);
      throw error;
    }
  }
}
