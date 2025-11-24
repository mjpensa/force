/**
 * Unified Content Viewer
 * Phase 5: Integrates all three views (Roadmap, Slides, Document)
 *
 * Handles:
 * - Session loading from URL
 * - View routing (#roadmap, #slides, #document)
 * - State management with StateManager
 * - Component lifecycle
 */

import { StateManager } from './components/shared/StateManager.js';
import { SlidesView } from './components/views/SlidesView.js';
import { DocumentView } from './components/views/DocumentView.js';

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
  }

  /**
   * Initialize the viewer
   */
  async init() {
    try {
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
      // Destroy previous view
      if (this.currentViewComponent && this.currentViewComponent.destroy) {
        this.currentViewComponent.destroy();
      }

      // Show loading state
      this._showLoading(viewName);

      // Load view data using StateManager
      let viewData;
      try {
        viewData = await this.stateManager.loadView(viewName);
      } catch (error) {
        // Check if it's a "still processing" error
        if (error.message.includes('processing')) {
          this._showProcessing(viewName);
          return;
        }
        throw error;
      }

      // Render the appropriate view
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

      this.currentView = viewName;

    } catch (error) {
      console.error(`Error loading ${viewName}:`, error);
      this._showError(`Failed to load ${viewName}`, error.message);
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
   */
  async _renderRoadmapView(data) {
    console.log('[Viewer] Rendering roadmap view');

    // For now, show a placeholder for roadmap
    // In a complete implementation, this would integrate the existing GanttChart component
    this.contentContainer.innerHTML = `
      <div class="empty-state">
        <h2>Roadmap View</h2>
        <p>Gantt chart integration coming soon.</p>
        <p>Session ID: ${this.sessionId}</p>
        <pre>${JSON.stringify(data, null, 2).substring(0, 500)}...</pre>
      </div>
    `;

    // TODO: Integrate existing GanttChart component
    // const ganttChart = new GanttChart(data);
    // this.contentContainer.appendChild(ganttChart.render());
    // this.currentViewComponent = ganttChart;
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
