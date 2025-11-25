/**
 * Unified Content Viewer
 * Phase 5: Integrates all three views (Roadmap, Slides, Document)
 * Phase 6: Enhanced with performance monitoring and lazy loading
 *
 * Handles:
 * - Session loading from URL
 * - View routing (#roadmap, #slides, #document)
 * - State management with StateManager
 * - Component lifecycle
 * - Performance monitoring
 * - Lazy loading for optimal performance
 */

import { StateManager } from './components/shared/StateManager.js';
import { SlidesView } from './components/views/SlidesView.js';
import { DocumentView } from './components/views/DocumentView.js';
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

    // Header with navigation
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
      <div class="header-content">
        <h1 class="header-title">
          <a href="/" style="color: inherit; text-decoration: none;">
            AI Roadmap Generator
          </a>
        </h1>
        <nav class="view-tabs" role="navigation" aria-label="Main navigation">
          <button class="view-tab" data-view="roadmap" aria-label="Roadmap view">
            <span class="tab-icon">📊</span>
            <span class="tab-label">Roadmap</span>
          </button>
          <button class="view-tab" data-view="slides" aria-label="Slides view">
            <span class="tab-icon">📽️</span>
            <span class="tab-label">Slides</span>
          </button>
          <button class="view-tab" data-view="document" aria-label="Document view">
            <span class="tab-icon">📄</span>
            <span class="tab-label">Document</span>
          </button>
        </nav>
      </div>
    `;

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
    const views = ['roadmap', 'slides', 'document'];
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
    const views = ['roadmap', 'slides', 'document'];
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
          <dt style="font-weight: 600;">1, 2, 3</dt>
          <dd style="margin-left: 2rem; color: #666;">Navigate to Roadmap, Slides, or Document view</dd>

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

    // Update state
    this.stateManager.setState({ currentView: view });

    // Load and render the view
    await this._loadView(view);
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
        // Check if it's a "still processing" error
        // Match both "processing" and "being generated" messages from StateManager
        if (error.message.includes('processing') || error.message.includes('being generated')) {
          this._showProcessing(viewName);
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
   * Show processing state (content still being generated)
   */
  _showProcessing(viewName) {
    this.contentContainer.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <h2>Content is being generated</h2>
        <p style="margin-top: 1rem; color: var(--color-text-secondary);">
          The ${viewName} is still being generated. Please wait a moment and refresh the page.
        </p>
        <button onclick="window.location.reload()" style="margin-top: 2rem; padding: 0.75rem 1.5rem; background: var(--color-primary); color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
          Refresh Page
        </button>
      </div>
    `;
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
}

// Initialize viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Viewer] Initializing content viewer');
  const viewer = new ContentViewer();
  viewer.init();
});
