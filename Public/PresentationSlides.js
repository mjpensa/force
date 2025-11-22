/**
 * Modern Presentation Viewer Module
 * Fixed 16:9 aspect ratio | Ultra modern design
 * Features: Thumbnail sidebar, grid view, fullscreen, keyboard shortcuts
 *
 * PPT-Export-First Architecture:
 * Uses WebRenderer to render structured slide data consistently
 * for both web display and PowerPoint export
 */

import { CONFIG } from './config.js';
import { WebRenderer } from './WebRenderer.js';
import { getDefaultTheme, migrateOldSlideData } from './SlideDataModel.js';
import { exportWithProgressDialog } from './PPTExporter.js';
import { PresenterMode } from './PresenterMode.js';
import { SlideEditor } from './SlideEditor.js';
import { SlideManager } from './SlideManager.js';
import { ExportManager } from './ExportManager.js';

/**
 * PresentationSlides Class
 * Manages the modern presentation viewer with advanced navigation
 */
export class PresentationSlides {
  /**
   * Creates a new PresentationSlides instance
   * @param {Object} slidesData - The presentation slides data (old format) or complete presentation data (new format)
   * @param {string} footerSVG - The SVG content for decorations (legacy, unused in modern viewer)
   */
  constructor(slidesData, footerSVG) {
    this.footerSVG = footerSVG;

    // Handle null or undefined input
    if (!slidesData) {
      console.warn('[PresentationSlides] No presentation data provided, using empty presentation');
      this.presentationData = {
        metadata: { title: 'Presentation', author: '', slideCount: 0 },
        theme: getDefaultTheme(),
        slides: []
      };
    } else if (slidesData.metadata && slidesData.theme && Array.isArray(slidesData.slides)) {
      // New structured format - use as-is
      this.presentationData = slidesData;
    } else if (slidesData.slides && Array.isArray(slidesData.slides)) {
      // Old format with slides array - migrate
      console.log('[PresentationSlides] Migrating old slide format to new structure');
      this.presentationData = migrateOldSlideData(slidesData);
    } else {
      // Unknown format - create empty presentation
      console.warn('[PresentationSlides] Unknown format, using empty presentation');
      this.presentationData = {
        metadata: { title: 'Presentation', author: '', slideCount: 0 },
        theme: getDefaultTheme(),
        slides: []
      };
    }

    // Create renderer with theme
    this.renderer = new WebRenderer(this.presentationData.theme);

    // Viewer state
    this.currentSlideIndex = 0;
    this.container = null;
    this.isGridView = false;
    this.isFullscreen = false;
    this.isSidebarVisible = true;
    this.shortcutsOverlayVisible = false;

    // Presenter mode
    this.presenterMode = new PresenterMode(this);

    // Slide editing and management
    this.editor = new SlideEditor(this);
    this.manager = new SlideManager(this);

    // Export manager
    this.exportManager = new ExportManager(this);

    // Check for auto-saved presentation
    this._checkAutoSave();

    // Keyboard shortcuts binding
    this.handleKeyPress = this.handleKeyPress.bind(this);

    // Legacy compatibility - keep reference to slides array
    this.slidesData = { slides: this.presentationData.slides };
  }

  /**
   * Check for auto-saved presentation
   * @private
   */
  _checkAutoSave() {
    const autoSaved = SlideEditor.restoreAutoSave();
    if (autoSaved) {
      const savedDate = new Date(autoSaved.savedAt);
      const restore = confirm(
        `Found auto-saved changes from ${savedDate.toLocaleString()}.\n\nRestore them?`
      );

      if (restore) {
        this.presentationData.slides = autoSaved.slides;
        this.presentationData.theme = autoSaved.theme;
        this.presentationData.metadata = autoSaved.metadata;
        this.slidesData.slides = autoSaved.slides;

        console.log('[PresentationSlides] Restored from auto-save');
      } else {
        SlideEditor.clearAutoSave();
        console.log('[PresentationSlides] Discarded auto-save');
      }
    }
  }

  /**
   * Renders the modern presentation viewer
   * @returns {HTMLElement} The rendered presentation viewer container
   */
  render() {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'presentation-viewer';
    this.container.id = 'presentationViewer';

    // Check if slides data exists
    if (!this.slidesData || !this.slidesData.slides || this.slidesData.slides.length === 0) {
      this.container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af;">
          <div style="text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">📊</div>
            <p style="font-size: 1.25rem; font-weight: 500;">No slides available</p>
            <p style="font-size: 0.875rem; margin-top: 0.5rem;">Slides will appear here once generated</p>
          </div>
        </div>
      `;
      return this.container;
    }

    // Build modern viewer structure
    this._buildProgressBar();
    this._buildTopBar();

    const mainContent = this._buildMainContent();
    this.container.appendChild(mainContent);

    this._buildBottomBar();
    this._buildShortcutsOverlay();

    // Add keyboard event listeners
    document.addEventListener('keydown', this.handleKeyPress);

    return this.container;
  }

  /**
   * Builds the progress bar
   * @private
   */
  _buildProgressBar() {
    const progress = document.createElement('div');
    progress.className = 'viewer-progress';

    const progressBar = document.createElement('div');
    progressBar.className = 'viewer-progress-bar';
    progressBar.id = 'viewerProgressBar';
    progressBar.style.width = this._calculateProgress();

    progress.appendChild(progressBar);
    this.container.appendChild(progress);
  }

  /**
   * Calculates progress percentage
   * @private
   * @returns {string} Progress percentage
   */
  _calculateProgress() {
    const total = this.slidesData.slides.length;
    const current = this.currentSlideIndex + 1;
    return `${(current / total) * 100}%`;
  }

  /**
   * Builds the top bar with controls
   * @private
   */
  _buildTopBar() {
    const topbar = document.createElement('div');
    topbar.className = 'viewer-topbar';

    // Left side
    const leftSide = document.createElement('div');
    leftSide.className = 'viewer-topbar-left';

    const title = document.createElement('div');
    title.className = 'viewer-title';
    title.innerHTML = `<span class="viewer-title-icon">🎯</span> Presentation`;

    const counter = document.createElement('div');
    counter.className = 'slide-counter';
    counter.id = 'slideCounter';
    counter.innerHTML = `
      <span class="slide-counter-current">${this.currentSlideIndex + 1}</span>
      <span>/</span>
      <span>${this.slidesData.slides.length}</span>
    `;

    leftSide.appendChild(title);
    leftSide.appendChild(counter);

    // Right side
    const rightSide = document.createElement('div');
    rightSide.className = 'viewer-topbar-right';

    // Toggle thumbnails button
    const thumbBtn = this._createButton('icon-only', '☰', 'Toggle Thumbnails', () => this._toggleSidebar());
    thumbBtn.id = 'toggleSidebarBtn';
    if (this.isSidebarVisible) thumbBtn.classList.add('active');

    // Grid view button
    const gridBtn = this._createButton('', '⊞', 'Grid View', () => this._toggleGridView());
    gridBtn.id = 'toggleGridBtn';

    // Fullscreen button
    const fullscreenBtn = this._createButton('', '⛶', 'Fullscreen', () => this._toggleFullscreen());
    fullscreenBtn.id = 'toggleFullscreenBtn';

    // Keyboard shortcuts button
    const shortcutsBtn = this._createButton('icon-only', '?', 'Keyboard Shortcuts', () => this._toggleShortcuts());

    // Edit Slides button
    const editBtn = this._createButton('', '✏️', 'Edit Slides', () => this._toggleEditMode());
    editBtn.id = 'editModeBtn';

    // Manage Slides button
    const manageBtn = this._createButton('', '📋', 'Manage Slides', () => this._showSlideManager());
    manageBtn.id = 'manageSlidesBtn';

    // Presenter Mode button
    const presenterBtn = this._createButton('', '🎤', 'Presenter Mode', () => this._launchPresenterMode());
    presenterBtn.id = 'presenterModeBtn';

    // Export dropdown
    const exportDropdown = this._createExportDropdown();

    rightSide.appendChild(thumbBtn);
    rightSide.appendChild(gridBtn);
    rightSide.appendChild(fullscreenBtn);
    rightSide.appendChild(shortcutsBtn);
    rightSide.appendChild(editBtn);
    rightSide.appendChild(manageBtn);
    rightSide.appendChild(presenterBtn);
    rightSide.appendChild(exportDropdown);

    topbar.appendChild(leftSide);
    topbar.appendChild(rightSide);
    this.container.appendChild(topbar);
  }

  /**
   * Creates a control button
   * @private
   */
  _createButton(additionalClass, icon, text, onClick) {
    const btn = document.createElement('button');
    btn.className = `viewer-btn ${additionalClass}`;
    btn.innerHTML = `<span class="viewer-btn-icon">${icon}</span>${text ? `<span>${text}</span>` : ''}`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * Creates export dropdown menu
   * @private
   */
  _createExportDropdown() {
    const container = document.createElement('div');
    container.className = 'export-dropdown-container';
    container.id = 'exportDropdownContainer';

    const button = document.createElement('button');
    button.className = 'viewer-btn primary';
    button.id = 'exportDropdownBtn';
    button.innerHTML = '<span class="viewer-btn-icon">📥</span><span>Export</span><span class="dropdown-arrow">▼</span>';

    const menu = document.createElement('div');
    menu.className = 'export-dropdown-menu';
    menu.id = 'exportDropdownMenu';

    const menuItems = [
      { icon: '📊', text: 'PowerPoint (.pptx)', action: () => this._exportToPowerPoint() },
      { icon: '📄', text: 'PDF Document', action: () => this._exportToPDF() },
      { icon: '🖼️', text: 'Current Slide (PNG)', action: () => this._exportCurrentSlideToPNG() },
      { icon: '🎞️', text: 'All Slides (PNG)', action: () => this._exportAllSlidesToPNG() },
      { icon: '🖨️', text: 'Print View', action: () => this._openPrintView() }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'export-dropdown-item';
      menuItem.innerHTML = `<span class="export-item-icon">${item.icon}</span><span>${item.text}</span>`;
      menuItem.addEventListener('click', () => {
        item.action();
        this._closeExportDropdown();
      });
      menu.appendChild(menuItem);
    });

    container.appendChild(button);
    container.appendChild(menu);

    // Toggle dropdown on button click
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleExportDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('exportDropdownContainer');
      if (dropdown && !dropdown.contains(e.target)) {
        this._closeExportDropdown();
      }
    });

    return container;
  }

  /**
   * Toggle export dropdown visibility
   * @private
   */
  _toggleExportDropdown() {
    const menu = document.getElementById('exportDropdownMenu');
    const button = document.getElementById('exportDropdownBtn');

    if (menu && button) {
      const isOpen = menu.classList.contains('open');
      if (isOpen) {
        menu.classList.remove('open');
        button.classList.remove('active');
      } else {
        menu.classList.add('open');
        button.classList.add('active');
      }
    }
  }

  /**
   * Close export dropdown
   * @private
   */
  _closeExportDropdown() {
    const menu = document.getElementById('exportDropdownMenu');
    const button = document.getElementById('exportDropdownBtn');

    if (menu && button) {
      menu.classList.remove('open');
      button.classList.remove('active');
    }
  }

  /**
   * Export to PDF
   * @private
   */
  async _exportToPDF() {
    try {
      console.log('[PresentationSlides] Exporting to PDF');
      await this.exportManager.exportToPDF();
    } catch (error) {
      console.error('[PresentationSlides] PDF export failed:', error);
      alert('Failed to export to PDF. Please try again.');
    }
  }

  /**
   * Export current slide to PNG
   * @private
   */
  async _exportCurrentSlideToPNG() {
    try {
      console.log('[PresentationSlides] Exporting current slide to PNG');
      await this.exportManager.exportCurrentSlideToPNG();
    } catch (error) {
      console.error('[PresentationSlides] PNG export failed:', error);
      alert('Failed to export to PNG. Please try again.');
    }
  }

  /**
   * Export all slides to PNG
   * @private
   */
  async _exportAllSlidesToPNG() {
    try {
      console.log('[PresentationSlides] Exporting all slides to PNG');
      await this.exportManager.exportAllSlidesToPNG();
    } catch (error) {
      console.error('[PresentationSlides] PNG export failed:', error);
      alert('Failed to export all slides to PNG. Please try again.');
    }
  }

  /**
   * Open print view
   * @private
   */
  _openPrintView() {
    try {
      console.log('[PresentationSlides] Opening print view');
      this.exportManager.openPrintView();
    } catch (error) {
      console.error('[PresentationSlides] Print view failed:', error);
      alert('Failed to open print view. Please try again.');
    }
  }

  /**
   * Builds the main content area (sidebar + stage)
   * @private
   * @returns {HTMLElement} Main content container
   */
  _buildMainContent() {
    const main = document.createElement('div');
    main.className = 'viewer-main';

    // Sidebar with thumbnails
    const sidebar = this._buildSidebar();
    main.appendChild(sidebar);

    // Stage area
    const stage = this._buildStage();
    main.appendChild(stage);

    return main;
  }

  /**
   * Builds the thumbnail sidebar
   * @private
   * @returns {HTMLElement} Sidebar container
   */
  _buildSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'viewer-sidebar';
    sidebar.id = 'viewerSidebar';
    if (!this.isSidebarVisible) sidebar.classList.add('hidden');

    const header = document.createElement('div');
    header.className = 'sidebar-header';
    header.innerHTML = '<div class="sidebar-title">Slides</div>';

    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'thumbnail-container';
    thumbnailContainer.id = 'thumbnailContainer';

    // Generate thumbnails for all slides
    this.slidesData.slides.forEach((slide, index) => {
      const thumbnail = this._createThumbnail(slide, index);
      thumbnailContainer.appendChild(thumbnail);
    });

    sidebar.appendChild(header);
    sidebar.appendChild(thumbnailContainer);

    return sidebar;
  }

  /**
   * Creates a thumbnail item
   * @private
   */
  _createThumbnail(slide, index) {
    const item = document.createElement('div');
    item.className = 'thumbnail-item';
    item.setAttribute('data-slide-index', index);
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Go to slide ${index + 1}`);

    if (index === this.currentSlideIndex) {
      item.classList.add('active');
    }

    const slidePreview = document.createElement('div');
    slidePreview.className = 'thumbnail-slide';
    slidePreview.innerHTML = `
      <div class="thumbnail-number">${String(index + 1).padStart(2, '0')}</div>
      <div class="thumbnail-placeholder">Slide ${index + 1}</div>
    `;

    item.appendChild(slidePreview);

    // Click handler
    item.addEventListener('click', () => this._goToSlide(index));
    item.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._goToSlide(index);
      }
    });

    return item;
  }

  /**
   * Builds the stage area (main slide display)
   * @private
   * @returns {HTMLElement} Stage container
   */
  _buildStage() {
    const stage = document.createElement('div');
    stage.className = 'viewer-stage';
    stage.id = 'viewerStage';

    // Create slide viewport with 16:9 aspect ratio
    const viewport = document.createElement('div');
    viewport.className = 'slide-viewport';
    viewport.id = 'slideViewport';

    // Navigation arrows
    const prevArrow = this._createNavArrow('prev');
    const nextArrow = this._createNavArrow('next');

    // Slide content
    const slideContent = this._buildSlideContent(this.currentSlideIndex);

    viewport.appendChild(prevArrow);
    viewport.appendChild(slideContent);
    viewport.appendChild(nextArrow);

    stage.appendChild(viewport);

    return stage;
  }

  /**
   * Creates navigation arrow button
   * @private
   */
  _createNavArrow(direction) {
    const arrow = document.createElement('button');
    arrow.className = `slide-nav-arrow ${direction}`;
    arrow.setAttribute('aria-label', direction === 'prev' ? 'Previous slide' : 'Next slide');
    arrow.innerHTML = direction === 'prev' ? '◀' : '▶';

    arrow.addEventListener('click', () => {
      if (direction === 'prev') {
        this._previousSlide();
      } else {
        this._nextSlide();
      }
    });

    // Update disabled state
    this._updateArrowState(arrow, direction);

    return arrow;
  }

  /**
   * Updates arrow button disabled state
   * @private
   */
  _updateArrowState(arrow, direction) {
    if (direction === 'prev') {
      arrow.disabled = this.currentSlideIndex === 0;
    } else {
      arrow.disabled = this.currentSlideIndex === this.slidesData.slides.length - 1;
    }
  }

  /**
   * Builds slide content using WebRenderer
   * @private
   */
  _buildSlideContent(index) {
    const slide = this.presentationData.slides[index];

    if (!slide) {
      // Fallback for missing slide
      const content = document.createElement('div');
      content.className = 'slide-content';
      content.id = 'slideContent';
      content.innerHTML = `
        <div class="slide-placeholder">
          <div class="slide-placeholder-icon">⚠️</div>
          <div class="slide-placeholder-text">Slide not found</div>
        </div>
      `;
      return content;
    }

    // Use WebRenderer to render the slide
    const totalSlides = this.presentationData.slides.length;
    const renderedSlide = this.renderer.render(slide, index + 1, totalSlides);

    // Ensure it has the correct ID for updates
    renderedSlide.id = 'slideContent';

    return renderedSlide;
  }

  /**
   * Builds the bottom navigation bar
   * @private
   */
  _buildBottomBar() {
    const bottombar = document.createElement('div');
    bottombar.className = 'viewer-bottombar';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'viewer-nav-btn';
    prevBtn.id = 'prevSlideBtn';
    prevBtn.innerHTML = '◀ Previous';
    prevBtn.addEventListener('click', () => this._previousSlide());
    prevBtn.disabled = this.currentSlideIndex === 0;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'viewer-nav-btn';
    nextBtn.id = 'nextSlideBtn';
    nextBtn.innerHTML = 'Next ▶';
    nextBtn.addEventListener('click', () => this._nextSlide());
    nextBtn.disabled = this.currentSlideIndex === this.slidesData.slides.length - 1;

    bottombar.appendChild(prevBtn);
    bottombar.appendChild(nextBtn);

    this.container.appendChild(bottombar);
  }

  /**
   * Builds keyboard shortcuts overlay
   * @private
   */
  _buildShortcutsOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'shortcuts-overlay';
    overlay.id = 'shortcutsOverlay';

    const modal = document.createElement('div');
    modal.className = 'shortcuts-modal';

    const header = document.createElement('div');
    header.className = 'shortcuts-header';
    header.innerHTML = `
      <h2 class="shortcuts-title">Keyboard Shortcuts</h2>
      <button class="shortcuts-close" aria-label="Close">×</button>
    `;

    const closeBtn = header.querySelector('.shortcuts-close');
    closeBtn.addEventListener('click', () => this._toggleShortcuts());

    const shortcuts = [
      { action: 'Next slide', keys: ['→', 'Space'] },
      { action: 'Previous slide', keys: ['←'] },
      { action: 'First slide', keys: ['Home'] },
      { action: 'Last slide', keys: ['End'] },
      { action: 'Toggle grid view', keys: ['G'] },
      { action: 'Toggle fullscreen', keys: ['F'] },
      { action: 'Toggle thumbnails', keys: ['T'] },
      { action: 'Edit slides', keys: ['E'] },
      { action: 'Manage slides', keys: ['S'] },
      { action: 'Undo', keys: ['Ctrl+Z'] },
      { action: 'Redo', keys: ['Ctrl+Shift+Z'] },
      { action: 'Presenter mode', keys: ['M'] },
      { action: 'Export menu', keys: ['P'] },
      { action: 'Show shortcuts', keys: ['?'] },
      { action: 'Close overlay', keys: ['Esc'] }
    ];

    const list = document.createElement('div');
    list.className = 'shortcuts-list';

    shortcuts.forEach(shortcut => {
      const item = document.createElement('div');
      item.className = 'shortcut-item';

      const action = document.createElement('div');
      action.className = 'shortcut-action';
      action.textContent = shortcut.action;

      const keys = document.createElement('div');
      keys.className = 'shortcut-keys';
      shortcut.keys.forEach(key => {
        const keyEl = document.createElement('span');
        keyEl.className = 'shortcut-key';
        keyEl.textContent = key;
        keys.appendChild(keyEl);
      });

      item.appendChild(action);
      item.appendChild(keys);
      list.appendChild(item);
    });

    modal.appendChild(header);
    modal.appendChild(list);
    overlay.appendChild(modal);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this._toggleShortcuts();
      }
    });

    this.container.appendChild(overlay);
  }

  /**
   * Navigation: Go to specific slide
   * @private
   */
  _goToSlide(index) {
    if (index < 0 || index >= this.slidesData.slides.length) return;

    this.currentSlideIndex = index;
    this._updateViewer();
  }

  /**
   * Navigation: Previous slide
   * @private
   */
  _previousSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this._updateViewer();
    }
  }

  /**
   * Navigation: Next slide
   * @private
   */
  _nextSlide() {
    if (this.currentSlideIndex < this.slidesData.slides.length - 1) {
      this.currentSlideIndex++;
      this._updateViewer();
    }
  }

  /**
   * Updates the viewer UI after slide change
   * @private
   */
  _updateViewer() {
    // Update slide content
    const slideContent = document.getElementById('slideContent');
    if (slideContent) {
      const newContent = this._buildSlideContent(this.currentSlideIndex);
      slideContent.replaceWith(newContent);
    }

    // Update counter
    const counter = document.getElementById('slideCounter');
    if (counter) {
      counter.innerHTML = `
        <span class="slide-counter-current">${this.currentSlideIndex + 1}</span>
        <span>/</span>
        <span>${this.slidesData.slides.length}</span>
      `;
    }

    // Update progress bar
    const progressBar = document.getElementById('viewerProgressBar');
    if (progressBar) {
      progressBar.style.width = this._calculateProgress();
    }

    // Update thumbnails
    const thumbnails = document.querySelectorAll('.thumbnail-item');
    thumbnails.forEach((thumb, index) => {
      thumb.classList.toggle('active', index === this.currentSlideIndex);
    });

    // Scroll active thumbnail into view
    const activeThumbnail = document.querySelector('.thumbnail-item.active');
    if (activeThumbnail) {
      activeThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Update navigation buttons
    const prevBtn = document.getElementById('prevSlideBtn');
    const nextBtn = document.getElementById('nextSlideBtn');
    if (prevBtn) prevBtn.disabled = this.currentSlideIndex === 0;
    if (nextBtn) nextBtn.disabled = this.currentSlideIndex === this.slidesData.slides.length - 1;

    // Update nav arrows
    const prevArrow = document.querySelector('.slide-nav-arrow.prev');
    const nextArrow = document.querySelector('.slide-nav-arrow.next');
    if (prevArrow) prevArrow.disabled = this.currentSlideIndex === 0;
    if (nextArrow) nextArrow.disabled = this.currentSlideIndex === this.slidesData.slides.length - 1;
  }

  /**
   * Toggle sidebar visibility
   * @private
   */
  _toggleSidebar() {
    this.isSidebarVisible = !this.isSidebarVisible;

    const sidebar = document.getElementById('viewerSidebar');
    const toggleBtn = document.getElementById('toggleSidebarBtn');

    if (sidebar) {
      sidebar.classList.toggle('hidden', !this.isSidebarVisible);
    }

    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.isSidebarVisible);
    }
  }

  /**
   * Toggle grid view
   * @private
   */
  _toggleGridView() {
    this.isGridView = !this.isGridView;

    const stage = document.getElementById('viewerStage');
    const toggleBtn = document.getElementById('toggleGridBtn');

    if (stage) {
      if (this.isGridView) {
        stage.classList.add('grid-view');
        stage.innerHTML = '';

        const grid = this._buildGridView();
        stage.appendChild(grid);
      } else {
        stage.classList.remove('grid-view');
        stage.innerHTML = '';

        const viewport = document.createElement('div');
        viewport.className = 'slide-viewport';
        viewport.id = 'slideViewport';

        const prevArrow = this._createNavArrow('prev');
        const nextArrow = this._createNavArrow('next');
        const slideContent = this._buildSlideContent(this.currentSlideIndex);

        viewport.appendChild(prevArrow);
        viewport.appendChild(slideContent);
        viewport.appendChild(nextArrow);

        stage.appendChild(viewport);
      }
    }

    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.isGridView);
    }
  }

  /**
   * Builds grid view layout
   * @private
   */
  _buildGridView() {
    const grid = document.createElement('div');
    grid.className = 'slide-grid';

    this.presentationData.slides.forEach((slide, index) => {
      const item = document.createElement('div');
      item.className = 'slide-grid-item';
      if (index === this.currentSlideIndex) item.classList.add('active');
      item.setAttribute('data-slide-index', index);

      // Render actual slide content using WebRenderer
      const slidePreview = document.createElement('div');
      slidePreview.className = 'slide-grid-slide';

      // Render the slide
      const renderedSlide = this.renderer.render(slide, index + 1, this.presentationData.slides.length);
      slidePreview.appendChild(renderedSlide);

      const footer = document.createElement('div');
      footer.className = 'slide-grid-footer';

      // Get slide type and title for footer
      const slideType = slide.type || 'slide';
      const slideTitle = slide.content?.title || `Slide ${index + 1}`;

      footer.innerHTML = `
        <div class="slide-grid-number">${index + 1}</div>
        <div class="slide-grid-title">${slideTitle}</div>
      `;

      item.appendChild(slidePreview);
      item.appendChild(footer);

      item.addEventListener('click', () => {
        this._goToSlide(index);
        this._toggleGridView(); // Exit grid view after selection
      });

      grid.appendChild(item);
    });

    return grid;
  }

  /**
   * Toggle fullscreen mode
   * @private
   */
  _toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;

    const viewer = this.container;
    const toggleBtn = document.getElementById('toggleFullscreenBtn');

    if (viewer) {
      viewer.classList.toggle('fullscreen', this.isFullscreen);

      // Update button text
      if (toggleBtn) {
        const icon = this.isFullscreen ? '⛶' : '⛶';
        const text = this.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
        toggleBtn.innerHTML = `<span class="viewer-btn-icon">${icon}</span><span>${text}</span>`;
        toggleBtn.classList.toggle('active', this.isFullscreen);
      }
    }
  }

  /**
   * Toggle keyboard shortcuts overlay
   * @private
   */
  _toggleShortcuts() {
    this.shortcutsOverlayVisible = !this.shortcutsOverlayVisible;

    const overlay = document.getElementById('shortcutsOverlay');
    if (overlay) {
      overlay.classList.toggle('visible', this.shortcutsOverlayVisible);
    }
  }

  /**
   * Handle keyboard shortcuts
   * @private
   */
  handleKeyPress(e) {
    // Don't handle if shortcuts overlay is visible (except Escape)
    if (this.shortcutsOverlayVisible && e.key !== 'Escape') return;

    // Undo/Redo shortcuts (Ctrl+Z, Ctrl+Shift+Z)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.editor.undo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      this.editor.redo();
      return;
    }

    switch(e.key) {
      case 'ArrowRight':
      case ' ':
        e.preventDefault();
        this._nextSlide();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this._previousSlide();
        break;
      case 'Home':
        e.preventDefault();
        this._goToSlide(0);
        break;
      case 'End':
        e.preventDefault();
        this._goToSlide(this.slidesData.slides.length - 1);
        break;
      case 'g':
      case 'G':
        e.preventDefault();
        this._toggleGridView();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        this._toggleFullscreen();
        break;
      case 't':
      case 'T':
        e.preventDefault();
        this._toggleSidebar();
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        this._toggleExportDropdown();
        break;
      case 'e':
      case 'E':
        e.preventDefault();
        this._toggleEditMode();
        break;
      case 's':
      case 'S':
        e.preventDefault();
        this._showSlideManager();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        this._launchPresenterMode();
        break;
      case '?':
        e.preventDefault();
        this._toggleShortcuts();
        break;
      case 'Escape':
        e.preventDefault();
        if (this.shortcutsOverlayVisible) {
          this._toggleShortcuts();
        } else if (this.isFullscreen) {
          this._toggleFullscreen();
        } else if (this.isGridView) {
          this._toggleGridView();
        }
        break;
    }
  }

  /**
   * Toggle edit mode
   * @private
   */
  _toggleEditMode() {
    try {
      this.editor.toggleEditMode();
    } catch (error) {
      console.error('[PresentationSlides] Failed to toggle edit mode:', error);
      alert('Failed to toggle edit mode. Please try again.');
    }
  }

  /**
   * Show slide manager modal
   * @private
   */
  _showSlideManager() {
    try {
      this.manager.showManagementPanel();
    } catch (error) {
      console.error('[PresentationSlides] Failed to show slide manager:', error);
      alert('Failed to show slide manager. Please try again.');
    }
  }

  /**
   * Launch presenter mode
   * @private
   */
  _launchPresenterMode() {
    try {
      console.log('[PresentationSlides] Launching presenter mode');
      this.presenterMode.launch();
    } catch (error) {
      console.error('[PresentationSlides] Failed to launch presenter mode:', error);
      alert('Failed to launch presenter mode. Please check your pop-up settings and try again.');
    }
  }

  /**
   * Export presentation to PowerPoint
   * @private
   */
  async _exportToPowerPoint() {
    try {
      const filename = this.presentationData.metadata?.title || 'presentation';
      console.log('[PresentationSlides] Exporting to PowerPoint:', filename);

      // Use the export utility with progress dialog
      await exportWithProgressDialog(this.presentationData, filename);

      console.log('[PresentationSlides] Export completed successfully');
    } catch (error) {
      console.error('[PresentationSlides] Export failed:', error);
      alert('Failed to export to PowerPoint. Please try again.');
    }
  }

  /**
   * Get current presentation data
   * @returns {Object} Complete presentation data
   */
  getPresentationData() {
    return this.presentationData;
  }

  /**
   * Update presentation theme
   * @param {Object} newTheme - New theme configuration
   */
  updateTheme(newTheme) {
    this.presentationData.theme = { ...this.presentationData.theme, ...newTheme };
    this.renderer.updateTheme(this.presentationData.theme);
    this._updateViewer(); // Re-render current slide
  }

  /**
   * Cleanup method to remove event listeners
   */
  destroy() {
    document.removeEventListener('keydown', this.handleKeyPress);

    // Cleanup presenter mode
    if (this.presenterMode) {
      this.presenterMode.cleanup();
    }

    // Cleanup editor
    if (this.editor) {
      this.editor.cleanup();
    }
  }
}
