/**
 * Unified Content Viewer
 * Phase 5: Integrates all four views (Roadmap, Slides, Document, Research Analysis)
 * Phase 6: Enhanced with performance monitoring and lazy loading
 * Phase 7: Automatic polling for processing content (v2)
 *
 * Handles:
 * - Session loading from URL
 * - View routing (#roadmap, #slides, #document, #research-analysis)
 * - State management with StateManager
 * - Component lifecycle
 * - Performance monitoring
 * - Lazy loading for optimal performance
 * - Automatic polling when content is processing
 */

// Version identifier for debugging cache issues
console.log('[Viewer] Version 2 - Automatic polling enabled');

import { StateManager } from './components/shared/StateManager.js';
import { SlidesView } from './components/views/SlidesView.js';
import { DocumentView } from './components/views/DocumentView.js';
import { ResearchAnalysisView } from './components/views/ResearchAnalysisView.js';
import { addLazyLoadingStyles, initLazyLoading } from './components/shared/LazyLoader.js';
import {
  markPerformance,
  measurePerformance,
  logPerformanceMetrics,
  reportWebVitals
} from './components/shared/Performance.js';
import {
  initAccessibility,
  announceToScreenReader,
  addKeyboardShortcuts
} from './components/shared/Accessibility.js';
import {
  showErrorNotification,
  logError
} from './components/shared/ErrorHandler.js';
import { loadFooterSVG } from './Utils.js'; // For GanttChart footer
import { TaskAnalyzer } from './TaskAnalyzer.js'; // For task clicks

class ContentViewer {
  constructor() {
    this.stateManager = new StateManager();
    this.sessionId = null;
    this.currentView = null;
    this.currentViewComponent = null;

    // DOM elements
    this.appRoot = document.getElementById('app-root');
    this.navContainer = null;
    this.contentContainer = null;

    // GanttChart dependencies (CRITICAL: same as original chart-renderer.js)
    this.footerSVG = '';
    this.taskAnalyzer = new TaskAnalyzer();
  }

  /**
   * Initialize the viewer
   */
  async init() {
    try {
      markPerformance('viewer-init-start');

      // Add lazy loading styles
      addLazyLoadingStyles();

      // CRITICAL: Load footer SVG for GanttChart (same as original chart-renderer.js)
      this.footerSVG = await loadFooterSVG();

      // Initialize accessibility features
      initAccessibility({
        skipLink: true,
        skipLinkTarget: 'main-content',
        announceRouteChanges: true,
        validateHeadings: true,
        validateImages: true,
        focusManagement: true
      });

      // Setup keyboard shortcuts
      this._setupKeyboardShortcuts();

      // Setup Web Vitals monitoring
      if (window.location.search.includes('debug=true')) {
        reportWebVitals((vital) => {
          console.log(`[Web Vitals] ${vital.name}:`, vital.value, `(${vital.rating})`);
        });
      }

      // Get session ID from URL
      this.sessionId = this._getSessionIdFromURL();
      if (!this.sessionId) {
        this._showError('No session ID provided', 'Please return to the home page and generate content first.');
        return;
      }

      // Set session in state manager
      this.stateManager.setState({ sessionId: this.sessionId });

      // Build UI structure
      this._buildUI();

      // Setup hash-based routing
      this._setupRouting();

      // Load initial view
      await this._handleRouteChange();

      // Start background polling for all view statuses
      this._startBackgroundStatusPolling();

      markPerformance('viewer-init-end');
      const initTime = measurePerformance('viewer-initialization', 'viewer-init-start', 'viewer-init-end');
      console.log(`[Performance] Viewer initialized in ${initTime.toFixed(2)}ms`);

    } catch (error) {
      console.error('Viewer initialization error:', error);
      this._showError('Failed to load content', error.message);
    }
  }

  /**
   * Build the UI structure
   */
  _buildUI() {
    this.appRoot.innerHTML = '';

    // Create app shell
    const appShell = document.createElement('div');
    appShell.className = 'app-shell';

    // Header with navigation - Timeline design (Concept B)
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
      <div class="header-content">
        <h1 class="header-title">
          <a href="/">AI Roadmap Generator</a>
        </h1>
        <nav class="view-tabs" role="navigation" aria-label="Main navigation">
          <button class="view-tab" data-view="roadmap" aria-label="Roadmap view">
            <div class="tab-node">
              <span class="tab-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="4" rx="1"></rect>
                  <rect x="3" y="10" width="12" height="4" rx="1"></rect>
                  <rect x="3" y="16" width="15" height="4" rx="1"></rect>
                </svg>
              </span>
              <span class="tab-status" id="status-roadmap" title="Loading..."></span>
            </div>
            <span class="tab-label">Roadmap</span>
          </button>
          <button class="view-tab" data-view="slides" aria-label="Slides view">
            <div class="tab-node">
              <span class="tab-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                  <path d="M8 21h8"></path>
                  <path d="M12 17v4"></path>
                  <path d="M7 8l3 2-3 2"></path>
                </svg>
              </span>
              <span class="tab-status" id="status-slides" title="Loading..."></span>
            </div>
            <span class="tab-label">Slides</span>
          </button>
          <button class="view-tab" data-view="document" aria-label="Document view">
            <div class="tab-node">
              <span class="tab-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <line x1="10" y1="9" x2="8" y2="9"></line>
                </svg>
              </span>
              <span class="tab-status" id="status-document" title="Loading..."></span>
            </div>
            <span class="tab-label">Document</span>
          </button>
          <button class="view-tab" data-view="research-analysis" aria-label="Analysis view">
            <div class="tab-node">
              <span class="tab-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="M21 21l-4.35-4.35"></path>
                  <path d="M11 8v6"></path>
                  <path d="M8 11h6"></path>
                </svg>
              </span>
              <span class="tab-status" id="status-research-analysis" title="Loading..."></span>
            </div>
            <span class="tab-label">Analysis</span>
          </button>
        </nav>
      </div>
    `;

    // Add status indicator styles
    this._addStatusIndicatorStyles();

    // Main content area
    const main = document.createElement('main');
    main.className = 'app-main';
    main.id = 'main-content';
    main.setAttribute('role', 'main');

    this.navContainer = header.querySelector('.view-tabs');
    this.contentContainer = main;

    // Setup navigation click handlers
    this.navContainer.querySelectorAll('.view-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        window.location.hash = view;
      });
    });

    appShell.appendChild(header);
    appShell.appendChild(main);
    this.appRoot.appendChild(appShell);
  }

  /**
   * Setup hash-based routing
   */
  _setupRouting() {
    window.addEventListener('hashchange', () => this._handleRouteChange());
  }

  /**
   * Setup keyboard shortcuts for accessibility
   */
  _setupKeyboardShortcuts() {
    this.removeShortcuts = addKeyboardShortcuts({
      // Navigate between views
      '1': () => window.location.hash = 'roadmap',
      '2': () => window.location.hash = 'slides',
      '3': () => window.location.hash = 'document',
      '4': () => window.location.hash = 'research-analysis',

      // Arrow key navigation
      'ArrowLeft': () => this._navigateToPreviousView(),
      'ArrowRight': () => this._navigateToNextView(),

      // Help
      '?': () => this._showKeyboardShortcutsHelp(),

      // Focus management
      'Escape': () => {
        // Close any open modals or dialogs
        const activeElement = document.activeElement;
        if (activeElement && activeElement !== document.body) {
          activeElement.blur();
        }
      }
    });
  }

  /**
   * Navigate to previous view
   * @private
   */
  _navigateToPreviousView() {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];
    const currentIndex = views.indexOf(this.currentView);
    const previousIndex = (currentIndex - 1 + views.length) % views.length;
    window.location.hash = views[previousIndex];
    announceToScreenReader(`Navigated to ${views[previousIndex]} view`);
  }

  /**
   * Navigate to next view
   * @private
   */
  _navigateToNextView() {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];
    const currentIndex = views.indexOf(this.currentView);
    const nextIndex = (currentIndex + 1) % views.length;
    window.location.hash = views[nextIndex];
    announceToScreenReader(`Navigated to ${views[nextIndex]} view`);
  }

  /**
   * Show keyboard shortcuts help dialog
   * @private
   */
  _showKeyboardShortcutsHelp() {
    const helpHtml = `
      <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 500px;">
        <h2 style="margin-top: 0;">Keyboard Shortcuts</h2>
        <dl style="line-height: 2;">
          <dt style="font-weight: 600;">1, 2, 3, 4</dt>
          <dd style="margin-left: 2rem; color: #666;">Navigate to Roadmap, Slides, Document, or Research QA view</dd>

          <dt style="font-weight: 600;">← →</dt>
          <dd style="margin-left: 2rem; color: #666;">Navigate between views</dd>

          <dt style="font-weight: 600;">?</dt>
          <dd style="margin-left: 2rem; color: #666;">Show this help dialog</dd>

          <dt style="font-weight: 600;">Esc</dt>
          <dd style="margin-left: 2rem; color: #666;">Close dialog or clear focus</dd>
        </dl>
        <button onclick="this.closest('.modal-overlay').remove()"
                style="margin-top: 1.5rem; padding: 0.5rem 1.5rem; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
          Close
        </button>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    overlay.innerHTML = helpHtml;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    document.body.appendChild(overlay);
    announceToScreenReader('Keyboard shortcuts dialog opened');
  }

  /**
   * Handle route changes
   */
  async _handleRouteChange() {
    const hash = window.location.hash.slice(1); // Remove '#'
    const view = hash || 'roadmap'; // Default to roadmap

    console.log(`[Viewer] Route changed to: ${view}`);

    // Update active tab
    this._updateActiveTab(view);

    // Update body class for view-specific styling
    this._updateBodyViewClass(view);

    // Update state
    this.stateManager.setState({ currentView: view });

    // Load and render the view
    await this._loadView(view);
  }

  /**
   * Update body class for view-specific styling
   * Allows CSS to target specific views for background overrides
   */
  _updateBodyViewClass(view) {
    // Remove all view-specific classes
    document.body.classList.remove('view-roadmap', 'view-slides', 'view-document', 'view-research-analysis');
    // Add current view class
    document.body.classList.add(`view-${view}`);
  }

  /**
   * Update active tab styling
   */
  _updateActiveTab(view) {
    this.navContainer.querySelectorAll('.view-tab').forEach(tab => {
      if (tab.dataset.view === view) {
        tab.classList.add('active');
        tab.setAttribute('aria-current', 'page');
      } else {
        tab.classList.remove('active');
        tab.removeAttribute('aria-current');
      }
    });
  }

  /**
   * Load and render a specific view
   */
  async _loadView(viewName) {
    try {
      markPerformance(`view-${viewName}-start`);

      // Destroy previous view and clear reference
      if (this.currentViewComponent && this.currentViewComponent.destroy) {
        this.currentViewComponent.destroy();
      }
      this.currentViewComponent = null;

      // Show loading state
      this._showLoading(viewName);

      // Load view data using StateManager
      markPerformance(`api-${viewName}-start`);
      let viewData;
      try {
        viewData = await this.stateManager.loadView(viewName);
        markPerformance(`api-${viewName}-end`);
        const apiTime = measurePerformance(`api-${viewName}`, `api-${viewName}-start`, `api-${viewName}-end`);
        console.log(`[Performance] API call for ${viewName}: ${apiTime.toFixed(2)}ms`);
      } catch (error) {
        // Check error type and route to appropriate UI
        console.log(`[Viewer] _loadView error for ${viewName}:`, error.message);
        console.log(`[Viewer] Error details:`, error.details);

        const isProcessing = error.message.includes('processing') ||
                            error.message.includes('being generated') ||
                            error.details?.processing === true;

        // Check for both emptyContent and emptyData flags (emptyData is thrown when data is null)
        const hasEmptyContent = error.details?.emptyContent === true || error.details?.emptyData === true;
        const canRetry = error.details?.canRetry === true || error.details?.emptyData === true;
        const isApiError = error.details?.apiError === true;

        console.log(`[Viewer] isProcessing=${isProcessing}, hasEmptyContent=${hasEmptyContent}, canRetry=${canRetry}, isApiError=${isApiError}`);

        if (isProcessing) {
          console.log(`[Viewer] Showing processing state with automatic polling for ${viewName}`);
          this._showProcessing(viewName);
          return;
        }

        // Handle API errors (generation failures) - show retry UI
        if (isApiError) {
          console.log(`[Viewer] Showing generation failed state for ${viewName} due to API error`);
          this._updateTabStatus(viewName, 'failed');
          this._showGenerationFailed(viewName, error.message);
          return;
        }

        if (hasEmptyContent && canRetry) {
          this._showGenerationFailed(viewName, error.message);
          return;
        }

        throw error;
      }

      // Render the appropriate view
      markPerformance(`render-${viewName}-start`);
      switch (viewName) {
        case 'slides':
          await this._renderSlidesView(viewData);
          break;
        case 'document':
          await this._renderDocumentView(viewData);
          break;
        case 'research-analysis':
          await this._renderResearchAnalysisView(viewData);
          break;
        case 'roadmap':
        default:
          await this._renderRoadmapView(viewData);
          break;
      }
      markPerformance(`render-${viewName}-end`);
      const renderTime = measurePerformance(`render-${viewName}`, `render-${viewName}-start`, `render-${viewName}-end`);
      console.log(`[Performance] Render ${viewName}: ${renderTime.toFixed(2)}ms`);

      this.currentView = viewName;

      markPerformance(`view-${viewName}-end`);
      const totalTime = measurePerformance(`view-${viewName}-total`, `view-${viewName}-start`, `view-${viewName}-end`);
      console.log(`[Performance] Total ${viewName} load: ${totalTime.toFixed(2)}ms`);

      // Initialize lazy loading for any images in the view
      setTimeout(() => {
        initLazyLoading('img[data-src]');
      }, 0);

    } catch (error) {
      console.error(`Error loading ${viewName}:`, error);
      logError(error, { component: 'ContentViewer', action: 'loadView', viewName });

      // Show user-friendly error notification with retry option
      // Check if this is a legacy chart limitation
      const isLegacyLimitation = error.message && error.message.includes('not available for legacy charts');

      if (isLegacyLimitation) {
        // Special handling for legacy chart limitations
        this._showLegacyChartLimitation(viewName);
      } else {
        showErrorNotification(error, {
          onRetry: () => this._loadView(viewName),
          dismissible: true
        });
        this._showError(`Failed to load ${viewName}`, error.message);
      }
    }
  }

  /**
   * Render slides view
   */
  async _renderSlidesView(data) {
    console.log('[Viewer] Rendering slides view');

    const slidesView = new SlidesView(data, this.sessionId);
    const container = slidesView.render();

    this.contentContainer.innerHTML = '';
    this.contentContainer.appendChild(container);

    this.currentViewComponent = slidesView;
  }

  /**
   * Render document view
   */
  async _renderDocumentView(data) {
    console.log('[Viewer] Rendering document view');

    const documentView = new DocumentView(data, this.sessionId);
    const container = documentView.render();

    this.contentContainer.innerHTML = '';
    this.contentContainer.appendChild(container);

    this.currentViewComponent = documentView;
  }

  /**
   * Render research analysis view
   */
  async _renderResearchAnalysisView(data) {
    console.log('[Viewer] Rendering research analysis view');

    const analysisView = new ResearchAnalysisView(data, this.sessionId);
    const container = analysisView.render();

    this.contentContainer.innerHTML = '';
    this.contentContainer.appendChild(container);

    this.currentViewComponent = analysisView;
  }

  /**
   * Render roadmap view (Gantt chart)
   * CRITICAL: Uses EXACT SAME logic and parameters as original chart-renderer.js
   */
  async _renderRoadmapView(data) {
    console.log('[Viewer] Rendering roadmap view with original GanttChart component');

    // Clear container
    this.contentContainer.innerHTML = '';

    // Create a container div for the chart
    const chartContainer = document.createElement('div');
    chartContainer.id = 'chart-root';
    chartContainer.style.cssText = 'width: 100%; height: 100%; overflow: auto;';
    this.contentContainer.appendChild(chartContainer);

    // Dynamically import and render the GanttChart
    try {
      const { GanttChart } = await import('./GanttChart.js');

      // Validate data structure (EXACT same validation as original)
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid chart data structure');
      }

      if (!data.timeColumns || !Array.isArray(data.timeColumns)) {
        throw new Error('Invalid timeColumns in chart data');
      }

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid data array in chart data');
      }

      console.log('✅ Chart data validation passed - timeColumns:', data.timeColumns.length, 'data:', data.data.length);

      // Task click handler (EXACT same as original chart-renderer.js)
      const handleTaskClick = (taskIdentifier) => {
        this.taskAnalyzer.showAnalysis(taskIdentifier);
      };

      // CRITICAL: Create GanttChart with EXACT SAME parameters as original
      // Signature: new GanttChart(container, ganttData, footerSVG, onTaskClick)
      const ganttChart = new GanttChart(
        chartContainer,      // container element
        data,                // ganttData object (with timeColumns and data)
        this.footerSVG,      // footerSVG decoration (CRITICAL!)
        handleTaskClick      // onTaskClick callback
      );

      // Render the chart (EXACT same as original)
      ganttChart.render();

      this.currentViewComponent = ganttChart;
      console.log('✅ Gantt chart rendered successfully using ORIGINAL component and logic');

    } catch (error) {
      console.error('❌ Error rendering Gantt chart:', error);

      // Show error state
      this.contentContainer.innerHTML = `
        <div class="empty-state" style="padding: 2rem; text-align: center;">
          <h2 style="color: var(--color-error);">Failed to Load Roadmap</h2>
          <p style="color: var(--color-text-secondary); margin: 1rem 0;">
            ${error.message}
          </p>
          <button onclick="window.location.reload()"
                  style="padding: 0.75rem 1.5rem; background: var(--color-primary); color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
            Reload Page
          </button>
        </div>
      `;
    }
  }

  /**
   * Show loading state
   */
  _showLoading(viewName) {
    this.contentContainer.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <p style="margin-top: 1rem; color: var(--color-text-secondary);">
          Loading ${viewName}...
        </p>
      </div>
    `;
  }

  /**
   * Show processing state with automatic polling
   * Instead of requiring manual refresh, automatically polls for completion
   */
  _showProcessing(viewName) {
    // Clear any existing polling for this view
    if (this._processingPollTimeouts && this._processingPollTimeouts[viewName]) {
      clearTimeout(this._processingPollTimeouts[viewName]);
    }
    if (!this._processingPollTimeouts) {
      this._processingPollTimeouts = {};
    }

    // Track start time for accurate elapsed time display
    if (!this._processingStartTimes) {
      this._processingStartTimes = {};
    }
    this._processingStartTimes[viewName] = Date.now();

    const viewNameCapitalized = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    this.contentContainer.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <h2>Generating ${viewNameCapitalized}</h2>
        <p style="margin-top: 1rem; color: var(--color-text-secondary);">
          Your ${viewName} content is being generated. This usually takes 30-60 seconds.
        </p>
        <p id="processing-status" style="margin-top: 0.5rem; color: var(--color-text-tertiary); font-size: 0.875rem;">
          Checking status...
        </p>
        <div id="processing-progress" style="margin-top: 1rem; width: 200px; height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden;">
          <div id="progress-bar" style="width: 0%; height: 100%; background: var(--color-primary); transition: width 0.3s ease;"></div>
        </div>
        <div style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: center;">
          <button id="cancel-generation-btn" style="padding: 0.75rem 1.5rem; background: transparent; color: var(--color-text-secondary); border: 1px solid var(--color-border); border-radius: 0.5rem; cursor: pointer;">
            Cancel
          </button>
        </div>
      </div>
    `;

    // Add cancel button handler
    const cancelBtn = document.getElementById('cancel-generation-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (this._processingPollTimeouts[viewName]) {
          clearTimeout(this._processingPollTimeouts[viewName]);
          delete this._processingPollTimeouts[viewName];
        }
        window.location.href = '/';
      });
    }

    // Start automatic polling
    this._pollForProcessingComplete(viewName);
  }

  /**
   * Poll for content generation completion
   * Uses exponential backoff to reduce server load
   */
  async _pollForProcessingComplete(viewName, attempt = 0) {
    const MAX_ATTEMPTS = 120; // 5 minutes with increasing intervals
    const BASE_INTERVAL = 2000; // Start at 2 seconds
    const MAX_INTERVAL = 10000; // Cap at 10 seconds
    const EXPECTED_DURATION = 60000; // Expected 60 seconds for generation

    // Calculate interval with exponential backoff (capped)
    const interval = Math.min(BASE_INTERVAL * Math.pow(1.2, Math.floor(attempt / 5)), MAX_INTERVAL);

    if (attempt >= MAX_ATTEMPTS) {
      console.log(`[Viewer] Polling timeout for ${viewName} after ${MAX_ATTEMPTS} attempts`);
      this._showGenerationTimeout(viewName);
      return;
    }

    // Update status message with accurate elapsed time
    const statusEl = document.getElementById('processing-status');
    const progressBar = document.getElementById('progress-bar');
    const startTime = this._processingStartTimes?.[viewName] || Date.now();
    const elapsedMs = Date.now() - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    if (statusEl) {
      statusEl.textContent = `Checking status... (${elapsedSeconds}s elapsed)`;
    }

    // Update progress bar (estimate based on expected duration)
    if (progressBar) {
      const progress = Math.min((elapsedMs / EXPECTED_DURATION) * 100, 95); // Cap at 95% until complete
      progressBar.style.width = `${progress}%`;
    }

    try {
      const response = await fetch(`/api/content/${this.sessionId}/${viewName}`);
      const data = await response.json();

      console.log(`[Viewer] Poll attempt ${attempt + 1} for ${viewName}: status=${data.status}`);

      if (data.status === 'completed' && data.data) {
        // Content is ready! Clear polling and load the view
        if (this._processingPollTimeouts && this._processingPollTimeouts[viewName]) {
          delete this._processingPollTimeouts[viewName];
        }

        // Show completion in progress bar
        const progressBar = document.getElementById('progress-bar');
        const statusEl = document.getElementById('processing-status');
        if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.style.background = 'var(--color-success, #10b981)';
        }
        if (statusEl) {
          statusEl.textContent = 'Generation complete! Loading...';
        }

        // Brief delay to show completion state
        await new Promise(resolve => setTimeout(resolve, 300));

        // Update cache in state manager
        this.stateManager.setState({
          content: { ...this.stateManager.state.content, [viewName]: data.data }
        });

        // Update tab status
        this._updateTabStatus(viewName, 'ready');

        // Re-load the view (will use cached data)
        await this._loadView(viewName);
        return;
      }

      if (data.status === 'error') {
        // Generation failed
        if (this._processingPollTimeouts && this._processingPollTimeouts[viewName]) {
          delete this._processingPollTimeouts[viewName];
        }
        this._updateTabStatus(viewName, 'failed');
        this._showGenerationFailed(viewName, data.error || 'Content generation failed. Please try again.');
        return;
      }

      // Still processing - schedule next poll
      this._processingPollTimeouts[viewName] = setTimeout(() => {
        this._pollForProcessingComplete(viewName, attempt + 1);
      }, interval);

    } catch (error) {
      console.error(`[Viewer] Error polling ${viewName}:`, error);

      // On network error, retry with backoff
      this._processingPollTimeouts[viewName] = setTimeout(() => {
        this._pollForProcessingComplete(viewName, attempt + 1);
      }, interval * 2);
    }
  }

  /**
   * Show timeout state when generation takes too long
   */
  _showGenerationTimeout(viewName) {
    const viewNameCapitalized = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    this.contentContainer.innerHTML = `
      <div style="padding: 3rem; text-align: center; max-width: 600px; margin: 0 auto;">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: var(--color-warning, #f59e0b); margin-bottom: 1.5rem;">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <polyline points="12 6 12 12 16 14" stroke-width="2"/>
        </svg>
        <h2 style="margin-bottom: 1rem; color: var(--color-text-primary);">
          ${viewNameCapitalized} Generation Taking Too Long
        </h2>
        <p style="color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 2rem;">
          The content is still being generated but it's taking longer than expected.
          This could be due to complex source material or server load.
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button id="continue-waiting-btn"
                  style="padding: 0.75rem 1.5rem; background: var(--color-primary); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 500;">
            Continue Waiting
          </button>
          <button id="retry-generation-btn"
                  style="padding: 0.75rem 1.5rem; background: transparent; color: var(--color-text-primary); border: 2px solid var(--color-border); border-radius: 0.5rem; cursor: pointer; font-weight: 500;">
            🔄 Retry Generation
          </button>
        </div>
      </div>
    `;

    // Add button handlers
    const continueBtn = document.getElementById('continue-waiting-btn');
    const retryBtn = document.getElementById('retry-generation-btn');

    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        this._showProcessing(viewName);
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', () => this._retryGeneration(viewName));
    }
  }

  /**
   * Show generation failed state with retry option
   */
  _showGenerationFailed(viewName, errorMessage) {
    const viewNameCapitalized = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    this.contentContainer.innerHTML = `
      <div style="padding: 3rem; text-align: center; max-width: 600px; margin: 0 auto;">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: var(--color-error, #ef4444); margin-bottom: 1.5rem;">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <line x1="15" y1="9" x2="9" y2="15" stroke-width="2"/>
          <line x1="9" y1="9" x2="15" y2="15" stroke-width="2"/>
        </svg>
        <h2 style="margin-bottom: 1rem; color: var(--color-text-primary);">
          ${viewNameCapitalized} Generation Failed
        </h2>
        <p style="color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 2rem;">
          ${errorMessage}
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button id="retry-generation-btn"
                  style="padding: 0.75rem 1.5rem; background: var(--color-primary); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 500;">
            🔄 Retry Generation
          </button>
          <button onclick="window.location.href='/'"
                  style="padding: 0.75rem 1.5rem; background: transparent; color: var(--color-text-primary); border: 2px solid var(--color-border); border-radius: 0.5rem; cursor: pointer; font-weight: 500;">
            Generate New Content
          </button>
        </div>
        <p style="margin-top: 2rem; font-size: 0.875rem; color: var(--color-text-tertiary);">
          If the problem persists, try generating new content with different source files.
        </p>
      </div>
    `;

    // Add click handler for retry button
    const retryBtn = document.getElementById('retry-generation-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this._retryGeneration(viewName));
    }
  }

  /**
   * Retry content generation for a specific view
   */
  async _retryGeneration(viewName) {
    const viewNameCapitalized = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    // Show loading state
    this.contentContainer.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <h2>Regenerating ${viewNameCapitalized}</h2>
        <p style="margin-top: 1rem; color: var(--color-text-secondary);">
          Please wait while we regenerate the content...
        </p>
      </div>
    `;

    try {
      // Call regeneration API
      const response = await fetch(`/api/content/${this.sessionId}/${viewName}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to start regeneration: ${response.statusText}`);
      }

      // Poll for completion
      await this._pollForRegeneration(viewName);

      // Clear state cache and reload view
      this.stateManager.setState({
        content: { ...this.stateManager.state.content, [viewName]: null }
      });

      await this._loadView(viewName);

    } catch (error) {
      console.error(`Error regenerating ${viewName}:`, error);
      this._showGenerationFailed(viewName, `Regeneration failed: ${error.message}`);
    }
  }

  /**
   * Poll for regeneration completion
   */
  async _pollForRegeneration(viewName, maxAttempts = 120, intervalMs = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`/api/content/${this.sessionId}/${viewName}`);

        // Handle HTTP errors (404, 500, etc.)
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'completed' && data.data) {
          return data;
        }

        if (data.status === 'error') {
          throw new Error(data.error || 'Generation failed');
        }

        // Still processing, wait and try again
        await new Promise(resolve => setTimeout(resolve, intervalMs));

      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    throw new Error('Regeneration timed out. Please try again.');
  }

  /**
   * Show legacy chart limitation message
   * For charts generated before the three-view system
   */
  _showLegacyChartLimitation(viewName) {
    this.contentContainer.innerHTML = `
      <div style="padding: 3rem; text-align: center; max-width: 600px; margin: 0 auto;">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: var(--color-warning, #f59e0b); margin-bottom: 1.5rem;">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke-width="2"/>
          <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2"/>
        </svg>
        <h2 style="margin-bottom: 1rem; color: var(--color-text-primary);">
          ${viewName.charAt(0).toUpperCase() + viewName.slice(1)} View Not Available
        </h2>
        <p style="color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 2rem;">
          This chart was generated using the older system and only supports the <strong>Roadmap view</strong>.
          The ${viewName} view is only available for newly generated content.
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button onclick="window.location.hash='roadmap'"
                  style="padding: 0.75rem 1.5rem; background: var(--color-primary); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 500;">
            📊 View Roadmap
          </button>
          <button onclick="window.location.href='/'"
                  style="padding: 0.75rem 1.5rem; background: transparent; color: var(--color-text-primary); border: 2px solid var(--color-border); border-radius: 0.5rem; cursor: pointer; font-weight: 500;">
            Generate New Content
          </button>
        </div>
        <p style="margin-top: 2rem; font-size: 0.875rem; color: var(--color-text-tertiary);">
          💡 Tip: Generate new content to access all three views (Roadmap, Slides, and Document)
        </p>
      </div>
    `;
  }

  /**
   * Show error state
   */
  _showError(title, message) {
    this.appRoot.innerHTML = `
      <div class="error-screen">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: var(--color-error);">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <h1>${title}</h1>
        <p>${message}</p>
        <button onclick="window.location.href='/'">Return to Home</button>
      </div>
    `;
  }

  /**
   * Get session ID from URL query parameters
   */
  _getSessionIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sessionId');
  }

  /**
   * Add CSS styles for status indicators
   * Note: Most styles are now in navigation-tabs.css
   * This method is kept for backwards compatibility but is essentially a no-op
   */
  _addStatusIndicatorStyles() {
    // Styles are now in /styles/navigation-tabs.css
    // This method is kept for backwards compatibility
    return;
  }

  /**
   * Update the progress line based on completed views
   * The line grows to show progression through the timeline
   */
  _updateProgressLine() {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];
    const navContainer = this.navContainer;
    if (!navContainer) return;

    // Count how many views are ready (completed)
    let completedCount = 0;
    views.forEach(view => {
      const statusEl = document.getElementById(`status-${view}`);
      if (statusEl && statusEl.classList.contains('ready')) {
        completedCount++;
      }
    });

    // Calculate progress percentage (0%, 33%, 66%, 100%)
    // We use 3 segments between 4 nodes
    const progressPercent = completedCount > 0
      ? Math.min(((completedCount - 1) / 3) * 100 + (completedCount > 0 ? 10 : 0), 100)
      : 0;

    // Update the CSS custom property for progress width
    navContainer.style.setProperty('--progress-width', `${progressPercent}%`);

    // Also update completed class on tabs
    views.forEach((view, index) => {
      const tab = navContainer.querySelector(`[data-view="${view}"]`);
      if (!tab) return;

      const statusEl = document.getElementById(`status-${view}`);
      const isReady = statusEl && statusEl.classList.contains('ready');

      if (isReady && !tab.classList.contains('active')) {
        tab.classList.add('completed');
      } else {
        tab.classList.remove('completed');
      }
    });
  }

  /**
   * Update status indicator for a specific tab
   * Note: Visual indicators are now handled via CSS pseudo-elements
   */
  _updateTabStatus(viewName, status) {
    const statusEl = document.getElementById(`status-${viewName}`);
    if (!statusEl) return;

    // Remove all status classes
    statusEl.classList.remove('loading', 'ready', 'failed', 'processing');

    switch (status) {
      case 'loading':
        statusEl.classList.add('loading');
        statusEl.title = 'Checking status...';
        break;
      case 'processing':
        statusEl.classList.add('processing');
        statusEl.title = 'Generating...';
        break;
      case 'ready':
        statusEl.classList.add('ready');
        statusEl.title = 'Ready';
        break;
      case 'failed':
        statusEl.classList.add('failed');
        statusEl.title = 'Failed - click to retry';
        break;
      default:
        statusEl.title = '';
    }

    // Update the progress line to reflect the new status
    this._updateProgressLine();
  }

  /**
   * Start background polling to check status of all views
   * Enhanced: Now caches content when ready for instant view switching
   */
  _startBackgroundStatusPolling() {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];

    // Initial state - all loading
    views.forEach(view => this._updateTabStatus(view, 'loading'));

    // Track active polling to avoid duplicates
    if (!this._backgroundPollTimeouts) {
      this._backgroundPollTimeouts = {};
    }

    // Poll each view with exponential backoff
    const pollView = async (viewName, attempt = 0) => {
      // Calculate polling interval with backoff
      const BASE_INTERVAL = 3000; // 3 seconds
      const MAX_INTERVAL = 15000; // 15 seconds max
      const MAX_ATTEMPTS = 100; // Stop polling after ~5 minutes
      const interval = Math.min(BASE_INTERVAL * Math.pow(1.3, Math.floor(attempt / 3)), MAX_INTERVAL);

      // Stop polling if we've exceeded max attempts
      if (attempt >= MAX_ATTEMPTS) {
        console.warn(`[Background Poll] Max attempts reached for ${viewName}, stopping poll`);
        this._updateTabStatus(viewName, 'failed');
        if (this._backgroundPollTimeouts[viewName]) {
          delete this._backgroundPollTimeouts[viewName];
        }
        return;
      }

      try {
        const response = await fetch(`/api/content/${this.sessionId}/${viewName}`);

        // Handle HTTP errors (404, 500, etc.)
        if (!response.ok) {
          console.error(`[Background Poll] HTTP error ${response.status} for ${viewName}`);
          this._updateTabStatus(viewName, 'failed');
          // Stop polling on HTTP errors - session may not exist
          if (this._backgroundPollTimeouts[viewName]) {
            delete this._backgroundPollTimeouts[viewName];
          }
          return;
        }

        const data = await response.json();

        if (data.status === 'completed' && data.data) {
          this._updateTabStatus(viewName, 'ready');

          // Cache the content in StateManager for instant view switching
          // Only cache if not already cached
          if (!this.stateManager.state.content[viewName]) {
            console.log(`[Background Poll] Caching ${viewName} content for instant access`);
            this.stateManager.setState({
              content: { ...this.stateManager.state.content, [viewName]: data.data }
            });
          }

          // Stop polling for this view - it's done
          if (this._backgroundPollTimeouts[viewName]) {
            delete this._backgroundPollTimeouts[viewName];
          }

        } else if (data.status === 'error') {
          this._updateTabStatus(viewName, 'failed');
          // Stop polling on error
          if (this._backgroundPollTimeouts[viewName]) {
            delete this._backgroundPollTimeouts[viewName];
          }

        } else if (data.status === 'processing' || data.status === 'pending') {
          this._updateTabStatus(viewName, 'processing');
          // Still processing, poll again with backoff
          this._backgroundPollTimeouts[viewName] = setTimeout(() => {
            pollView(viewName, attempt + 1);
          }, interval);

        } else {
          // Unknown status - continue polling
          this._updateTabStatus(viewName, 'loading');
          this._backgroundPollTimeouts[viewName] = setTimeout(() => {
            pollView(viewName, attempt + 1);
          }, interval);
        }

      } catch (error) {
        console.error(`[Background Poll] Error polling ${viewName}:`, error);
        // On error, retry with longer interval
        this._backgroundPollTimeouts[viewName] = setTimeout(() => {
          pollView(viewName, attempt + 1);
        }, interval * 2);
      }
    };

    // Start polling all views
    views.forEach(view => pollView(view, 0));
  }

  /**
   * Cleanup polling on viewer destroy
   */
  destroy() {
    // Clear all processing poll timeouts
    if (this._processingPollTimeouts) {
      Object.values(this._processingPollTimeouts).forEach(timeout => clearTimeout(timeout));
      this._processingPollTimeouts = {};
    }

    // Clear all background poll timeouts
    if (this._backgroundPollTimeouts) {
      Object.values(this._backgroundPollTimeouts).forEach(timeout => clearTimeout(timeout));
      this._backgroundPollTimeouts = {};
    }

    // Clear start time tracking
    if (this._processingStartTimes) {
      this._processingStartTimes = {};
    }

    // Remove keyboard shortcuts
    if (this.removeShortcuts) {
      this.removeShortcuts();
    }
  }
}

// Initialize viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Viewer] Initializing content viewer');
  const viewer = new ContentViewer();
  viewer.init();
});
