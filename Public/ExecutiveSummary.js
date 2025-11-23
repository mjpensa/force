/**
 * Modern Executive Summary Viewer Module
 * 8.5x11 Document Format | Ultra Modern Design
 * Features: Multi-page navigation, zoom controls, TOC, print/export
 */

import { CONFIG } from './config.js';
import { ExportManagerDocument } from './ExportManagerDocument.js';

/**
 * ExecutiveSummary Class
 * Manages the modern document viewer for executive summary reports
 */
export class ExecutiveSummary {
  /**
   * Creates a new ExecutiveSummary instance
   * @param {Object} summaryData - The executive summary data from the API
   * @param {string} footerSVG - The SVG content for decorations (legacy, unused in modern viewer)
   */
  constructor(summaryData, footerSVG) {
    this.summaryData = summaryData;
    this.footerSVG = footerSVG;
    this.currentPageIndex = 0;
    this.container = null;
    this.zoomLevel = 1;
    this.isSidebarVisible = true;
    this.isFullscreen = false;
    this.tocVisible = false;
    this.shortcutsVisible = false;
    this.viewMode = 'continuous'; // 'continuous' or 'single'

    // Keyboard shortcuts binding
    this.handleKeyPress = this.handleKeyPress.bind(this);

    // Export manager
    this.exportManager = new ExportManagerDocument(this);

    // Generate multi-page document (for now, placeholder pages)
    this.pages = this._generatePages();
  }

  /**
   * Generates document pages from summary data
   * @private
   * @returns {Array} Array of page objects
   */
  _generatePages() {
    if (!this.summaryData) {
      return [{
        pageNumber: 1,
        title: 'Executive Summary',
        content: null
      }];
    }

    // Create pages with actual content sections
    const pages = [];

    // Page 1: Strategic Narrative + Key Metrics Dashboard
    pages.push({
      pageNumber: 1,
      title: 'Strategic Overview',
      sections: ['strategicNarrative', 'keyMetricsDashboard', 'strategicPriorities']
    });

    // Page 2: Drivers + Dependencies
    pages.push({
      pageNumber: 2,
      title: 'Strategic Drivers & Dependencies',
      sections: ['drivers', 'dependencies']
    });

    // Page 3: Risks + Insights + Competitive Intel
    pages.push({
      pageNumber: 3,
      title: 'Risk Intelligence & Competitive Landscape',
      sections: ['risks', 'keyInsights', 'competitiveIntelligence', 'industryBenchmarks']
    });

    return pages;
  }

  /**
   * Renders the modern document viewer
   * @returns {HTMLElement} The rendered viewer container
   */
  render() {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'executive-summary-viewer';
    this.container.id = 'executiveSummaryViewer';

    // Check if summary data exists
    if (!this.summaryData) {
      this.container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #0a0e1a; color: #9ca3af;">
          <div style="text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
            <p style="font-size: 1.25rem; font-weight: 500;">No executive summary available</p>
            <p style="font-size: 0.875rem; margin-top: 0.5rem;">Summary will appear here once generated</p>
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

    this._buildFloatingNav();
    this._buildTOCOverlay();
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
    progress.className = 'doc-viewer-progress';

    const progressBar = document.createElement('div');
    progressBar.className = 'doc-viewer-progress-bar';
    progressBar.id = 'docProgressBar';
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
    const total = this.pages.length;
    const current = this.currentPageIndex + 1;
    return `${(current / total) * 100}%`;
  }

  /**
   * Builds the top bar with controls
   * @private
   */
  _buildTopBar() {
    const topbar = document.createElement('div');
    topbar.className = 'doc-viewer-topbar';

    // Left side
    const leftSide = document.createElement('div');
    leftSide.className = 'doc-viewer-topbar-left';

    const title = document.createElement('div');
    title.className = 'doc-viewer-title';
    title.innerHTML = `<span class="doc-viewer-title-icon">📋</span> Executive Summary`;

    const counter = document.createElement('div');
    counter.className = 'doc-page-counter';
    counter.id = 'docPageCounter';
    counter.innerHTML = `
      <span class="doc-page-counter-current">${this.currentPageIndex + 1}</span>
      <span>/</span>
      <span>${this.pages.length}</span>
    `;

    leftSide.appendChild(title);
    leftSide.appendChild(counter);

    // Center (zoom controls)
    const centerSide = document.createElement('div');
    centerSide.className = 'doc-viewer-topbar-center';

    const zoomControls = this._buildZoomControls();
    centerSide.appendChild(zoomControls);

    // Right side
    const rightSide = document.createElement('div');
    rightSide.className = 'doc-viewer-topbar-right';

    // Toggle pages button
    const pagesBtn = this._createButton('icon-only', '☰', 'Toggle Pages', () => this._toggleSidebar());
    pagesBtn.id = 'togglePagesBtn';
    if (this.isSidebarVisible) pagesBtn.classList.add('active');

    // Table of contents button
    const tocBtn = this._createButton('', '📑', 'Contents', () => this._toggleTOC());
    tocBtn.id = 'toggleTOCBtn';

    // Export dropdown
    const exportDropdown = this._createExportDropdown();

    // Fullscreen button
    const fullscreenBtn = this._createButton('', '⛶', 'Fullscreen', () => this._toggleFullscreen());
    fullscreenBtn.id = 'toggleFullscreenBtn';

    // Keyboard shortcuts button
    const shortcutsBtn = this._createButton('icon-only', '?', 'Keyboard Shortcuts', () => this._toggleShortcuts());

    rightSide.appendChild(pagesBtn);
    rightSide.appendChild(tocBtn);
    rightSide.appendChild(exportDropdown);
    rightSide.appendChild(fullscreenBtn);
    rightSide.appendChild(shortcutsBtn);

    topbar.appendChild(leftSide);
    topbar.appendChild(centerSide);
    topbar.appendChild(rightSide);
    this.container.appendChild(topbar);
  }

  /**
   * Builds zoom controls
   * @private
   */
  _buildZoomControls() {
    const controls = document.createElement('div');
    controls.className = 'doc-zoom-controls';

    const zoomOut = document.createElement('button');
    zoomOut.className = 'doc-zoom-btn';
    zoomOut.textContent = '−';
    zoomOut.setAttribute('aria-label', 'Zoom out');
    zoomOut.addEventListener('click', () => this._zoomOut());

    const zoomLevel = document.createElement('div');
    zoomLevel.className = 'doc-zoom-level';
    zoomLevel.id = 'docZoomLevel';
    zoomLevel.textContent = '100%';

    const zoomIn = document.createElement('button');
    zoomIn.className = 'doc-zoom-btn';
    zoomIn.textContent = '+';
    zoomIn.setAttribute('aria-label', 'Zoom in');
    zoomIn.addEventListener('click', () => this._zoomIn());

    const zoomReset = document.createElement('button');
    zoomReset.className = 'doc-zoom-btn';
    zoomReset.textContent = '⊙';
    zoomReset.setAttribute('aria-label', 'Reset zoom');
    zoomReset.addEventListener('click', () => this._zoomReset());

    controls.appendChild(zoomOut);
    controls.appendChild(zoomLevel);
    controls.appendChild(zoomIn);
    controls.appendChild(zoomReset);

    return controls;
  }

  /**
   * Creates a control button
   * @private
   */
  _createButton(additionalClass, icon, text, onClick) {
    const btn = document.createElement('button');
    btn.className = `doc-viewer-btn ${additionalClass}`;
    btn.innerHTML = `<span class="doc-viewer-btn-icon">${icon}</span>${text ? `<span>${text}</span>` : ''}`;
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
    container.id = 'docExportDropdownContainer';

    const button = document.createElement('button');
    button.className = 'doc-viewer-btn';
    button.id = 'docExportDropdownBtn';
    button.innerHTML = '<span class="doc-viewer-btn-icon">📥</span><span>Export</span><span class="dropdown-arrow">▼</span>';

    const menu = document.createElement('div');
    menu.className = 'export-dropdown-menu';
    menu.id = 'docExportDropdownMenu';

    const menuItems = [
      { icon: '📄', text: 'PDF Document', action: () => this._exportToPDF() },
      { icon: '🖼️', text: 'Current Page (PNG)', action: () => this._exportCurrentPageToPNG() },
      { icon: '🎞️', text: 'All Pages (PNG)', action: () => this._exportAllPagesToPNG() },
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
      const dropdown = document.getElementById('docExportDropdownContainer');
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
    const menu = document.getElementById('docExportDropdownMenu');
    const button = document.getElementById('docExportDropdownBtn');

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
    const menu = document.getElementById('docExportDropdownMenu');
    const button = document.getElementById('docExportDropdownBtn');

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
      console.log('[ExecutiveSummary] Exporting to PDF');
      await this.exportManager.exportToPDF();
    } catch (error) {
      console.error('[ExecutiveSummary] PDF export failed:', error);
      alert('Failed to export to PDF. Please try again.');
    }
  }

  /**
   * Export current page to PNG
   * @private
   */
  async _exportCurrentPageToPNG() {
    try {
      console.log('[ExecutiveSummary] Exporting current page to PNG');
      await this.exportManager.exportCurrentPageToPNG();
    } catch (error) {
      console.error('[ExecutiveSummary] PNG export failed:', error);
      alert('Failed to export to PNG. Please try again.');
    }
  }

  /**
   * Export all pages to PNG
   * @private
   */
  async _exportAllPagesToPNG() {
    try {
      console.log('[ExecutiveSummary] Exporting all pages to PNG');
      await this.exportManager.exportAllPagesToPNG();
    } catch (error) {
      console.error('[ExecutiveSummary] PNG export failed:', error);
      alert('Failed to export all pages to PNG. Please try again.');
    }
  }

  /**
   * Open print view
   * @private
   */
  _openPrintView() {
    try {
      console.log('[ExecutiveSummary] Opening print view');
      this.exportManager.openPrintView();
    } catch (error) {
      console.error('[ExecutiveSummary] Print view failed:', error);
      alert('Failed to open print view. Please try again.');
    }
  }

  /**
   * Builds the main content area (sidebar + document stage)
   * @private
   * @returns {HTMLElement} Main content container
   */
  _buildMainContent() {
    const main = document.createElement('div');
    main.className = 'doc-viewer-main';

    // Sidebar with page thumbnails
    const sidebar = this._buildSidebar();
    main.appendChild(sidebar);

    // Document stage
    const stage = this._buildStage();
    main.appendChild(stage);

    return main;
  }

  /**
   * Builds the page thumbnail sidebar
   * @private
   * @returns {HTMLElement} Sidebar container
   */
  _buildSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'doc-viewer-sidebar';
    sidebar.id = 'docViewerSidebar';
    if (!this.isSidebarVisible) sidebar.classList.add('hidden');

    const header = document.createElement('div');
    header.className = 'doc-sidebar-header';
    header.innerHTML = '<div class="doc-sidebar-title">Pages</div>';

    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'doc-page-thumbnails';
    thumbnailContainer.id = 'docPageThumbnails';

    // Generate thumbnails for all pages
    this.pages.forEach((page, index) => {
      const thumbnail = this._createThumbnail(page, index);
      thumbnailContainer.appendChild(thumbnail);
    });

    sidebar.appendChild(header);
    sidebar.appendChild(thumbnailContainer);

    return sidebar;
  }

  /**
   * Creates a page thumbnail
   * @private
   */
  _createThumbnail(page, index) {
    const item = document.createElement('div');
    item.className = 'doc-page-thumbnail';
    item.setAttribute('data-page-index', index);
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Go to page ${index + 1}`);

    if (index === this.currentPageIndex) {
      item.classList.add('active');
    }

    const preview = document.createElement('div');
    preview.className = 'doc-page-preview';
    preview.innerHTML = `
      <div class="doc-page-number">Page ${index + 1}</div>
      <div class="doc-page-placeholder">
        <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">📄</div>
        <div style="font-size: 0.625rem;">Page ${index + 1}</div>
      </div>
    `;

    item.appendChild(preview);

    // Click handler
    item.addEventListener('click', () => this._goToPage(index));
    item.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._goToPage(index);
      }
    });

    return item;
  }

  /**
   * Builds the document stage area
   * @private
   * @returns {HTMLElement} Stage container
   */
  _buildStage() {
    const stage = document.createElement('div');
    stage.className = 'doc-viewer-stage';
    stage.id = 'docViewerStage';
    if (this.viewMode === 'continuous') {
      stage.classList.add('continuous-scroll');
    } else {
      stage.classList.add('single-page-view');
    }

    const pagesContainer = document.createElement('div');
    pagesContainer.className = 'doc-pages-container';
    pagesContainer.id = 'docPagesContainer';

    // Render all pages (for continuous scroll) or just current page (for single page view)
    this.pages.forEach((page, index) => {
      const pageElement = this._buildPage(page, index);
      pagesContainer.appendChild(pageElement);
    });

    stage.appendChild(pagesContainer);

    return stage;
  }

  /**
   * Builds a document page with 8.5x11 aspect ratio
   * @private
   */
  _buildPage(page, index) {
    const viewport = document.createElement('div');
    viewport.className = 'doc-page-viewport';
    viewport.setAttribute('data-page-index', index);

    if (this.viewMode === 'single' && index === this.currentPageIndex) {
      viewport.classList.add('active');
    }

    if (this.viewMode === 'single') {
      viewport.classList.add('single-page');
    }

    const content = document.createElement('div');
    content.className = 'doc-page-content';

    // Render actual content if available
    if (this.summaryData && page.sections) {
      const contentHTML = this._renderPageContent(page);
      content.innerHTML = contentHTML;
    } else {
      // Fallback to placeholder
      content.innerHTML = `
        <div class="doc-page-content-placeholder">
          <div class="doc-page-icon">📋</div>
          <div class="doc-page-title">Executive Summary</div>
          <div class="doc-page-subtitle">No content available</div>
        </div>
        <div class="doc-page-footer">Page ${page.pageNumber} of ${this.pages.length}</div>
      `;
    }

    viewport.appendChild(content);

    return viewport;
  }

  /**
   * Renders the content for a specific page
   * @private
   * @param {Object} page - Page object with sections array
   * @returns {string} HTML content for the page
   */
  _renderPageContent(page) {
    let html = '<div class="executive-summary-page">';

    // Page title
    html += `<h1 class="page-title">${page.title}</h1>`;

    // Render each section
    page.sections.forEach(sectionName => {
      const sectionData = this.summaryData[sectionName];
      if (!sectionData) return;

      switch (sectionName) {
        case 'strategicNarrative':
          html += this._renderStrategicNarrative(sectionData);
          break;
        case 'keyMetricsDashboard':
          html += this._renderKeyMetricsDashboard(sectionData);
          break;
        case 'strategicPriorities':
          html += this._renderStrategicPriorities(sectionData);
          break;
        case 'drivers':
          html += this._renderDrivers(sectionData);
          break;
        case 'dependencies':
          html += this._renderDependencies(sectionData);
          break;
        case 'risks':
          html += this._renderRisks(sectionData);
          break;
        case 'keyInsights':
          html += this._renderKeyInsights(sectionData);
          break;
        case 'competitiveIntelligence':
          html += this._renderCompetitiveIntelligence(sectionData);
          break;
        case 'industryBenchmarks':
          html += this._renderIndustryBenchmarks(sectionData);
          break;
      }
    });

    // Page footer
    html += `<div class="doc-page-footer">Page ${page.pageNumber} of ${this.pages.length}</div>`;
    html += '</div>';

    return html;
  }

  /**
   * Builds floating page navigation
   * @private
   */
  _buildFloatingNav() {
    const nav = document.createElement('div');
    nav.className = 'doc-page-nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'doc-nav-btn';
    prevBtn.innerHTML = '◀';
    prevBtn.setAttribute('aria-label', 'Previous page');
    prevBtn.addEventListener('click', () => this._previousPage());
    prevBtn.id = 'prevPageBtn';
    prevBtn.disabled = this.currentPageIndex === 0;

    const separator1 = document.createElement('div');
    separator1.className = 'doc-nav-separator';

    const homeBtn = document.createElement('button');
    homeBtn.className = 'doc-nav-btn';
    homeBtn.innerHTML = '⇤';
    homeBtn.setAttribute('aria-label', 'First page');
    homeBtn.addEventListener('click', () => this._goToPage(0));

    const endBtn = document.createElement('button');
    endBtn.className = 'doc-nav-btn';
    endBtn.innerHTML = '⇥';
    endBtn.setAttribute('aria-label', 'Last page');
    endBtn.addEventListener('click', () => this._goToPage(this.pages.length - 1));

    const separator2 = document.createElement('div');
    separator2.className = 'doc-nav-separator';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'doc-nav-btn';
    nextBtn.innerHTML = '▶';
    nextBtn.setAttribute('aria-label', 'Next page');
    nextBtn.addEventListener('click', () => this._nextPage());
    nextBtn.id = 'nextPageBtn';
    nextBtn.disabled = this.currentPageIndex === this.pages.length - 1;

    nav.appendChild(prevBtn);
    nav.appendChild(separator1);
    nav.appendChild(homeBtn);
    nav.appendChild(endBtn);
    nav.appendChild(separator2);
    nav.appendChild(nextBtn);

    this.container.appendChild(nav);
  }

  /**
   * Builds table of contents overlay
   * @private
   */
  _buildTOCOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'doc-toc-overlay';
    overlay.id = 'docTOCOverlay';

    const modal = document.createElement('div');
    modal.className = 'doc-toc-modal';

    const header = document.createElement('div');
    header.className = 'doc-toc-header';
    header.innerHTML = `
      <h2 class="doc-toc-title">Table of Contents</h2>
      <button class="doc-toc-close" aria-label="Close">×</button>
    `;

    const closeBtn = header.querySelector('.doc-toc-close');
    closeBtn.addEventListener('click', () => this._toggleTOC());

    // Sample TOC items (will be populated from actual content later)
    const tocItems = [
      { title: 'Executive Summary', page: 1 },
      { title: 'Strategic Analysis', page: 2 },
      { title: 'Key Recommendations', page: 3 }
    ];

    const list = document.createElement('div');
    list.className = 'doc-toc-list';

    tocItems.forEach(item => {
      const tocItem = document.createElement('div');
      tocItem.className = 'doc-toc-item';
      tocItem.innerHTML = `
        <div class="doc-toc-item-title">${item.title}</div>
        <div class="doc-toc-item-page">Page ${item.page}</div>
      `;
      tocItem.addEventListener('click', () => {
        this._goToPage(item.page - 1);
        this._toggleTOC();
      });
      list.appendChild(tocItem);
    });

    modal.appendChild(header);
    modal.appendChild(list);
    overlay.appendChild(modal);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this._toggleTOC();
      }
    });

    this.container.appendChild(overlay);
  }

  /**
   * Builds keyboard shortcuts overlay
   * @private
   */
  _buildShortcutsOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'doc-shortcuts-overlay';
    overlay.id = 'docShortcutsOverlay';

    const modal = document.createElement('div');
    modal.className = 'doc-shortcuts-modal';

    const header = document.createElement('div');
    header.className = 'doc-shortcuts-header';
    header.innerHTML = `
      <h2 class="doc-shortcuts-title">Keyboard Shortcuts</h2>
      <button class="doc-shortcuts-close" aria-label="Close">×</button>
    `;

    const closeBtn = header.querySelector('.doc-shortcuts-close');
    closeBtn.addEventListener('click', () => this._toggleShortcuts());

    const shortcuts = [
      { action: 'Next page', keys: ['→', 'PageDown'] },
      { action: 'Previous page', keys: ['←', 'PageUp'] },
      { action: 'First page', keys: ['Home'] },
      { action: 'Last page', keys: ['End'] },
      { action: 'Zoom in', keys: ['+', '='] },
      { action: 'Zoom out', keys: ['−', '_'] },
      { action: 'Reset zoom', keys: ['0'] },
      { action: 'Toggle fullscreen', keys: ['F'] },
      { action: 'Print document', keys: ['Ctrl+P'] },
      { action: 'Table of contents', keys: ['C'] },
      { action: 'Show shortcuts', keys: ['?'] },
      { action: 'Close overlay', keys: ['Esc'] }
    ];

    const list = document.createElement('div');
    list.className = 'doc-shortcuts-list';

    shortcuts.forEach(shortcut => {
      const item = document.createElement('div');
      item.className = 'doc-shortcut-item';

      const action = document.createElement('div');
      action.className = 'doc-shortcut-action';
      action.textContent = shortcut.action;

      const keys = document.createElement('div');
      keys.className = 'doc-shortcut-keys';
      shortcut.keys.forEach(key => {
        const keyEl = document.createElement('span');
        keyEl.className = 'doc-shortcut-key';
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
   * Navigation: Go to specific page
   * @private
   */
  _goToPage(index) {
    if (index < 0 || index >= this.pages.length) return;

    this.currentPageIndex = index;
    this._updateViewer();

    // Scroll to page if in continuous mode
    if (this.viewMode === 'continuous') {
      const pageElement = document.querySelector(`[data-page-index="${index}"]`);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  /**
   * Navigation: Previous page
   * @private
   */
  _previousPage() {
    if (this.currentPageIndex > 0) {
      this._goToPage(this.currentPageIndex - 1);
    }
  }

  /**
   * Navigation: Next page
   * @private
   */
  _nextPage() {
    if (this.currentPageIndex < this.pages.length - 1) {
      this._goToPage(this.currentPageIndex + 1);
    }
  }

  /**
   * Updates the viewer UI after page/zoom change
   * @private
   */
  _updateViewer() {
    // Update counter
    const counter = document.getElementById('docPageCounter');
    if (counter) {
      counter.innerHTML = `
        <span class="doc-page-counter-current">${this.currentPageIndex + 1}</span>
        <span>/</span>
        <span>${this.pages.length}</span>
      `;
    }

    // Update progress bar
    const progressBar = document.getElementById('docProgressBar');
    if (progressBar) {
      progressBar.style.width = this._calculateProgress();
    }

    // Update thumbnails
    const thumbnails = document.querySelectorAll('.doc-page-thumbnail');
    thumbnails.forEach((thumb, index) => {
      thumb.classList.toggle('active', index === this.currentPageIndex);
    });

    // Scroll active thumbnail into view
    const activeThumbnail = document.querySelector('.doc-page-thumbnail.active');
    if (activeThumbnail) {
      activeThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Update navigation buttons
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if (prevBtn) prevBtn.disabled = this.currentPageIndex === 0;
    if (nextBtn) nextBtn.disabled = this.currentPageIndex === this.pages.length - 1;

    // Update page visibility in single page mode
    if (this.viewMode === 'single') {
      const pages = document.querySelectorAll('.doc-page-viewport');
      pages.forEach((page, index) => {
        page.classList.toggle('active', index === this.currentPageIndex);
      });
    }
  }

  /**
   * Zoom in
   * @private
   */
  _zoomIn() {
    if (this.zoomLevel < 2) {
      this.zoomLevel += 0.1;
      this._applyZoom();
    }
  }

  /**
   * Zoom out
   * @private
   */
  _zoomOut() {
    if (this.zoomLevel > 0.5) {
      this.zoomLevel -= 0.1;
      this._applyZoom();
    }
  }

  /**
   * Reset zoom
   * @private
   */
  _zoomReset() {
    this.zoomLevel = 1;
    this._applyZoom();
  }

  /**
   * Apply zoom level
   * @private
   */
  _applyZoom() {
    const pages = document.querySelectorAll('.doc-page-viewport');
    pages.forEach(page => {
      page.style.setProperty('--doc-zoom-level', this.zoomLevel);
    });

    const zoomDisplay = document.getElementById('docZoomLevel');
    if (zoomDisplay) {
      zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
  }

  /**
   * Toggle sidebar visibility
   * @private
   */
  _toggleSidebar() {
    this.isSidebarVisible = !this.isSidebarVisible;

    const sidebar = document.getElementById('docViewerSidebar');
    const toggleBtn = document.getElementById('togglePagesBtn');

    if (sidebar) {
      sidebar.classList.toggle('hidden', !this.isSidebarVisible);
    }

    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.isSidebarVisible);
    }
  }

  /**
   * Toggle table of contents
   * @private
   */
  _toggleTOC() {
    this.tocVisible = !this.tocVisible;

    const overlay = document.getElementById('docTOCOverlay');
    if (overlay) {
      overlay.classList.toggle('visible', this.tocVisible);
    }
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

      if (toggleBtn) {
        const text = this.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
        toggleBtn.innerHTML = `<span class="doc-viewer-btn-icon">⛶</span><span>${text}</span>`;
        toggleBtn.classList.toggle('active', this.isFullscreen);
      }
    }
  }

  /**
   * Toggle keyboard shortcuts overlay
   * @private
   */
  _toggleShortcuts() {
    this.shortcutsVisible = !this.shortcutsVisible;

    const overlay = document.getElementById('docShortcutsOverlay');
    if (overlay) {
      overlay.classList.toggle('visible', this.shortcutsVisible);
    }
  }

  /**
   * Handle keyboard shortcuts
   * @private
   */
  handleKeyPress(e) {
    // Don't handle if overlays are visible (except Escape)
    if ((this.shortcutsVisible || this.tocVisible) && e.key !== 'Escape') return;

    // Don't handle if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch(e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        this._nextPage();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        this._previousPage();
        break;
      case 'Home':
        e.preventDefault();
        this._goToPage(0);
        break;
      case 'End':
        e.preventDefault();
        this._goToPage(this.pages.length - 1);
        break;
      case '+':
      case '=':
        e.preventDefault();
        this._zoomIn();
        break;
      case '-':
      case '_':
        e.preventDefault();
        this._zoomOut();
        break;
      case '0':
        e.preventDefault();
        this._zoomReset();
        break;
      case 'f':
      case 'F':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this._toggleFullscreen();
        }
        break;
      case 'c':
      case 'C':
        e.preventDefault();
        this._toggleTOC();
        break;
      case '?':
        e.preventDefault();
        this._toggleShortcuts();
        break;
      case 'p':
        if (e.ctrlKey || e.metaKey) {
          // Let browser handle Ctrl+P for print
          return;
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (this.shortcutsVisible) {
          this._toggleShortcuts();
        } else if (this.tocVisible) {
          this._toggleTOC();
        } else if (this.isFullscreen) {
          this._toggleFullscreen();
        }
        break;
    }
  }

  /**
   * Renders Strategic Narrative section
   * @private
   */
  _renderStrategicNarrative(data) {
    return `
      <section class="summary-section strategic-narrative">
        <h2 class="section-title">Strategic Narrative</h2>
        <div class="narrative-content">
          <div class="elevator-pitch">
            <h3>Executive Summary</h3>
            <p>${data.elevatorPitch || ''}</p>
          </div>
          ${data.valueProposition ? `
          <div class="value-proposition">
            <h3>Value Proposition</h3>
            <p>${data.valueProposition}</p>
          </div>
          ` : ''}
          ${data.callToAction ? `
          <div class="call-to-action">
            <h3>Call to Action</h3>
            <p>${data.callToAction}</p>
          </div>
          ` : ''}
        </div>
      </section>
    `;
  }

  /**
   * Renders Key Metrics Dashboard section
   * @private
   */
  _renderKeyMetricsDashboard(data) {
    if (!data) return '';

    return `
      <section class="summary-section metrics-dashboard">
        <h2 class="section-title">Key Metrics Dashboard</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Total Investment</div>
            <div class="metric-value">${data.totalInvestment || 'TBD'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Time to Value</div>
            <div class="metric-value">${data.timeToValue || 'TBD'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Compliance Risk</div>
            <div class="metric-value">${data.complianceRisk || 'TBD'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">ROI Projection</div>
            <div class="metric-value">${data.roiProjection || 'TBD'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Critical Path Status</div>
            <div class="metric-value">${data.criticalPathStatus || 'TBD'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Vendor Lock-In</div>
            <div class="metric-value">${data.vendorLockIn || 'TBD'}</div>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Renders Strategic Priorities section
   * @private
   */
  _renderStrategicPriorities(data) {
    if (!Array.isArray(data) || data.length === 0) return '';

    return `
      <section class="summary-section strategic-priorities">
        <h2 class="section-title">Top 3 Strategic Priorities</h2>
        <div class="priorities-list">
          ${data.map((priority, index) => `
            <div class="priority-card">
              <div class="priority-number">${index + 1}</div>
              <div class="priority-content">
                <h3>${priority.title}</h3>
                <p class="priority-description">${priority.description}</p>
                ${priority.bankingContext ? `<p class="priority-context"><strong>Banking Context:</strong> ${priority.bankingContext}</p>` : ''}
                ${priority.dependencies ? `<p class="priority-dependencies"><strong>Dependencies:</strong> ${priority.dependencies}</p>` : ''}
                ${priority.deadline ? `<p class="priority-deadline"><strong>Deadline:</strong> ${priority.deadline}</p>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  /**
   * Renders Strategic Drivers section
   * @private
   */
  _renderDrivers(data) {
    if (!Array.isArray(data) || data.length === 0) return '';

    return `
      <section class="summary-section drivers">
        <h2 class="section-title">Strategic Drivers</h2>
        <div class="drivers-list">
          ${data.map(driver => `
            <div class="driver-card urgency-${driver.urgencyLevel || 'medium'}">
              <h3>${driver.title}</h3>
              <p>${driver.description}</p>
              <div class="driver-urgency">
                <span class="urgency-badge">${driver.urgencyLevel?.toUpperCase() || 'MEDIUM'} URGENCY</span>
              </div>
              ${driver.metrics && driver.metrics.length > 0 ? `
                <div class="driver-metrics">
                  <strong>Key Metrics:</strong>
                  <ul>
                    ${driver.metrics.map(metric => `<li>${metric}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  /**
   * Renders Dependencies section
   * @private
   */
  _renderDependencies(data) {
    if (!Array.isArray(data) || data.length === 0) return '';

    return `
      <section class="summary-section dependencies">
        <h2 class="section-title">Critical Dependencies</h2>
        <div class="dependencies-list">
          ${data.map(dep => `
            <div class="dependency-card criticality-${dep.criticality?.toLowerCase() || 'medium'}">
              <h3>${dep.name}</h3>
              <div class="dependency-criticality">
                <span class="criticality-badge">${dep.criticality || 'MEDIUM'} CRITICALITY</span>
              </div>
              ${dep.impactedPhases && dep.impactedPhases.length > 0 ? `
                <p><strong>Impacted Phases:</strong> ${dep.impactedPhases.join(', ')}</p>
              ` : ''}
              ${dep.mitigationStrategy ? `
                <p class="mitigation"><strong>Mitigation:</strong> ${dep.mitigationStrategy}</p>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  /**
   * Renders Risks section
   * @private
   */
  _renderRisks(data) {
    if (!Array.isArray(data) || data.length === 0) return '';

    return `
      <section class="summary-section risks">
        <h2 class="section-title">Risk Intelligence</h2>
        <div class="risks-list">
          ${data.map(risk => `
            <div class="risk-card risk-${risk.probability || 'medium'}">
              <div class="risk-header">
                <span class="risk-category">${risk.category?.toUpperCase() || 'GENERAL'}</span>
                <span class="risk-impact impact-${risk.impact || 'moderate'}">${risk.impact?.toUpperCase() || 'MODERATE'} IMPACT</span>
              </div>
              <p class="risk-description">${risk.description}</p>
              <div class="risk-probability">
                <strong>Probability:</strong> ${risk.probability?.toUpperCase() || 'MEDIUM'}
              </div>
              ${risk.earlyIndicators && risk.earlyIndicators.length > 0 ? `
                <div class="risk-indicators">
                  <strong>Early Warning Indicators:</strong>
                  <ul>
                    ${risk.earlyIndicators.map(indicator => `<li>${indicator}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  /**
   * Renders Key Insights section
   * @private
   */
  _renderKeyInsights(data) {
    if (!Array.isArray(data) || data.length === 0) return '';

    return `
      <section class="summary-section key-insights">
        <h2 class="section-title">Key Insights</h2>
        <div class="insights-list">
          ${data.map(insight => `
            <div class="insight-card">
              <div class="insight-category">${insight.category || 'General'}</div>
              <p class="insight-text">${insight.insight}</p>
              ${insight.talkingPoint ? `
                <p class="talking-point"><strong>💡 Talking Point:</strong> ${insight.talkingPoint}</p>
              ` : ''}
              ${insight.supportingData ? `
                <p class="supporting-data"><strong>📊 Data:</strong> ${insight.supportingData}</p>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  /**
   * Renders Competitive Intelligence section
   * @private
   */
  _renderCompetitiveIntelligence(data) {
    if (!data) return '';

    return `
      <section class="summary-section competitive-intel">
        <h2 class="section-title">Competitive Intelligence</h2>
        <div class="competitive-content">
          ${data.marketTiming ? `
            <div class="intel-block">
              <h3>Market Timing</h3>
              <p>${data.marketTiming}</p>
            </div>
          ` : ''}
          ${data.competitorMoves && data.competitorMoves.length > 0 ? `
            <div class="intel-block">
              <h3>Competitor Moves</h3>
              <ul>
                ${data.competitorMoves.map(move => `<li>${move}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${data.competitiveAdvantage ? `
            <div class="intel-block">
              <h3>Competitive Advantage</h3>
              <p>${data.competitiveAdvantage}</p>
            </div>
          ` : ''}
          ${data.marketWindow ? `
            <div class="intel-block market-window">
              <h3>⏰ Market Window</h3>
              <p>${data.marketWindow}</p>
            </div>
          ` : ''}
        </div>
      </section>
    `;
  }

  /**
   * Renders Industry Benchmarks section
   * @private
   */
  _renderIndustryBenchmarks(data) {
    if (!data) return '';

    return `
      <section class="summary-section industry-benchmarks">
        <h2 class="section-title">Industry Benchmarks</h2>
        <div class="benchmarks-grid">
          ${data.timeToMarket ? `
            <div class="benchmark-card">
              <h3>Time to Market</h3>
              <div class="benchmark-comparison">
                <div><strong>Your Plan:</strong> ${data.timeToMarket.yourPlan}</div>
                <div><strong>Industry Average:</strong> ${data.timeToMarket.industryAverage}</div>
                <div class="variance">${data.timeToMarket.variance}</div>
              </div>
              <p class="benchmark-insight">${data.timeToMarket.insight}</p>
            </div>
          ` : ''}
          ${data.investmentLevel ? `
            <div class="benchmark-card">
              <h3>Investment Level</h3>
              <div class="benchmark-comparison">
                <div><strong>Your Plan:</strong> ${data.investmentLevel.yourPlan}</div>
                <div><strong>Industry Median:</strong> ${data.investmentLevel.industryMedian}</div>
                <div class="variance">${data.investmentLevel.variance}</div>
              </div>
              <p class="benchmark-insight">${data.investmentLevel.insight}</p>
            </div>
          ` : ''}
          ${data.riskProfile ? `
            <div class="benchmark-card">
              <h3>Risk Profile</h3>
              <div class="benchmark-comparison">
                <div><strong>Your Plan:</strong> ${data.riskProfile.yourPlan}</div>
                <div><strong>Industry Comparison:</strong> ${data.riskProfile.industryComparison}</div>
              </div>
              <p class="benchmark-insight">${data.riskProfile.insight}</p>
            </div>
          ` : ''}
        </div>
      </section>
    `;
  }

  /**
   * Cleanup method to remove event listeners
   */
  destroy() {
    document.removeEventListener('keydown', this.handleKeyPress);
  }
}
