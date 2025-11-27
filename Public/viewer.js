import { StateManager } from './components/shared/StateManager.js';
import { SlidesView } from './components/views/SlidesView.js';
import { DocumentView } from './components/views/DocumentView.js';
import { ResearchAnalysisView } from './components/views/ResearchAnalysisView.js';
import { addLazyLoadingStyles, initLazyLoading } from './components/shared/LazyLoader.js';
import { SidebarNav } from './components/SidebarNav.js';
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
    this.appRoot = document.getElementById('app-root');
    this.navContainer = null;
    this.contentContainer = null;
    this.sidebarNav = null;
    this.footerSVG = '';
    this.taskAnalyzer = new TaskAnalyzer();
  }
  async init() {
    try {
      markPerformance('viewer-init-start');
      addLazyLoadingStyles();
      this.footerSVG = await loadFooterSVG();
      initAccessibility({
        skipLink: true,
        skipLinkTarget: 'main-content',
        announceRouteChanges: true,
        validateHeadings: true,
        validateImages: true,
        focusManagement: true
      });
      this._setupKeyboardShortcuts();
      if (window.location.search.includes('debug=true')) {
        reportWebVitals((vital) => {
        });
      }
      this.sessionId = this._getSessionIdFromURL();
      if (!this.sessionId) {
        this._showError('No session ID provided', 'Please return to the home page and generate content first.');
        return;
      }
      this.stateManager.setState({ sessionId: this.sessionId });
      this._buildUI();
      this._setupRouting();
      await this._handleRouteChange();
      this._startBackgroundStatusPolling();
      markPerformance('viewer-init-end');
      const initTime = measurePerformance('viewer-initialization', 'viewer-init-start', 'viewer-init-end');
    } catch (error) {
      this._showError('Failed to load content', error.message);
    }
  }
  _buildUI() {
    this.appRoot.innerHTML = '';
    const appShell = document.createElement('div');
    appShell.className = 'app-shell';
    const main = document.createElement('main');
    main.className = 'app-main';
    main.id = 'main-content';
    main.setAttribute('role', 'main');
    this.contentContainer = main;
    this._initSidebarNav();
    appShell.appendChild(main);
    this.appRoot.appendChild(appShell);
  }
  _initSidebarNav() {
    const hash = window.location.hash.slice(1);
    const initialView = hash || 'roadmap';
    this.sidebarNav = new SidebarNav({
      activeView: initialView,
      sessionId: this.sessionId,
      onNavigate: (view) => {
      }
    });
    const sidebarElement = this.sidebarNav.render();
    document.body.appendChild(sidebarElement);
    this.navContainer = sidebarElement;
  }
  _setupRouting() {
    window.addEventListener('hashchange', () => this._handleRouteChange());
  }
  _setupKeyboardShortcuts() {
    this.removeShortcuts = addKeyboardShortcuts({
      '1': () => window.location.hash = 'roadmap',
      '2': () => window.location.hash = 'slides',
      '3': () => window.location.hash = 'document',
      '4': () => window.location.hash = 'research-analysis',
      'ArrowLeft': () => this._navigateToPreviousView(),
      'ArrowRight': () => this._navigateToNextView(),
      '?': () => this._showKeyboardShortcutsHelp(),
      'Escape': () => {
        const activeElement = document.activeElement;
        if (activeElement && activeElement !== document.body) {
          activeElement.blur();
        }
      }
    });
  }
  _navigateToPreviousView() {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];
    const currentIndex = views.indexOf(this.currentView);
    const previousIndex = (currentIndex - 1 + views.length) % views.length;
    window.location.hash = views[previousIndex];
    announceToScreenReader(`Navigated to ${views[previousIndex]} view`);
  }
  _navigateToNextView() {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];
    const currentIndex = views.indexOf(this.currentView);
    const nextIndex = (currentIndex + 1) % views.length;
    window.location.hash = views[nextIndex];
    announceToScreenReader(`Navigated to ${views[nextIndex]} view`);
  }
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
  async _handleRouteChange() {
    const hash = window.location.hash.slice(1); // Remove '#'
    const view = hash || 'roadmap'; // Default to roadmap
    this._updateActiveTab(view);
    this._updateBodyViewClass(view);
    this.stateManager.setState({ currentView: view });
    await this._loadView(view);
  }
  _updateBodyViewClass(view) {
    document.body.classList.remove('view-roadmap', 'view-slides', 'view-document', 'view-research-analysis');
    document.body.classList.add(`view-${view}`);
  }
  _updateActiveTab(view) {
    if (this.sidebarNav) {
      this.sidebarNav.setActiveView(view);
    }
  }
  async _loadView(viewName) {
    try {
      markPerformance(`view-${viewName}-start`);
      if (this.currentViewComponent && this.currentViewComponent.destroy) {
        this.currentViewComponent.destroy();
      }
      this.currentViewComponent = null;
      this._showLoading(viewName);
      markPerformance(`api-${viewName}-start`);
      let viewData;
      try {
        viewData = await this.stateManager.loadView(viewName);
        markPerformance(`api-${viewName}-end`);
        const apiTime = measurePerformance(`api-${viewName}`, `api-${viewName}-start`, `api-${viewName}-end`);
      } catch (error) {
        const isProcessing = error.message.includes('processing') ||
                            error.message.includes('being generated') ||
                            error.details?.processing === true;
        const hasEmptyContent = error.details?.emptyContent === true || error.details?.emptyData === true;
        const canRetry = error.details?.canRetry === true || error.details?.emptyData === true;
        const isApiError = error.details?.apiError === true;
        if (isProcessing) {
          this._showProcessing(viewName);
          return;
        }
        if (isApiError) {
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
      this.currentView = viewName;
      markPerformance(`view-${viewName}-end`);
      const totalTime = measurePerformance(`view-${viewName}-total`, `view-${viewName}-start`, `view-${viewName}-end`);
      setTimeout(() => {
        initLazyLoading('img[data-src]');
      }, 0);
    } catch (error) {
      logError(error, { component: 'ContentViewer', action: 'loadView', viewName });
      const isLegacyLimitation = error.message && error.message.includes('not available for legacy charts');
      if (isLegacyLimitation) {
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
  async _renderSlidesView(data) {
    const slidesView = new SlidesView(data, this.sessionId);
    const container = slidesView.render();
    this.contentContainer.innerHTML = '';
    this.contentContainer.appendChild(container);
    this.currentViewComponent = slidesView;
  }
  async _renderDocumentView(data) {
    const documentView = new DocumentView(data, this.sessionId);
    const container = documentView.render();
    this.contentContainer.innerHTML = '';
    this.contentContainer.appendChild(container);
    this.currentViewComponent = documentView;
  }
  async _renderResearchAnalysisView(data) {
    const analysisView = new ResearchAnalysisView(data, this.sessionId);
    const container = analysisView.render();
    this.contentContainer.innerHTML = '';
    this.contentContainer.appendChild(container);
    this.currentViewComponent = analysisView;
  }
  async _renderRoadmapView(data) {
    this.contentContainer.innerHTML = '';
    const chartContainer = document.createElement('div');
    chartContainer.id = 'chart-root';
    chartContainer.style.cssText = 'width: 100%; height: 100%; overflow: auto;';
    this.contentContainer.appendChild(chartContainer);
    try {
      const { GanttChart } = await import('./GanttChart.js');
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid chart data structure');
      }
      if (!data.timeColumns || !Array.isArray(data.timeColumns)) {
        throw new Error('Invalid timeColumns in chart data');
      }
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid data array in chart data');
      }
      const handleTaskClick = (taskIdentifier) => {
        this.taskAnalyzer.showAnalysis(taskIdentifier);
      };
      const ganttChart = new GanttChart(
        chartContainer,      // container element
        data,                // ganttData object (with timeColumns and data)
        this.footerSVG,      // footerSVG decoration (CRITICAL!)
        handleTaskClick      // onTaskClick callback
      );
      ganttChart.render();
      this.currentViewComponent = ganttChart;
    } catch (error) {
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
  _showProcessing(viewName) {
    if (this._processingPollTimeouts) {
      Object.keys(this._processingPollTimeouts).forEach(key => {
        clearTimeout(this._processingPollTimeouts[key]);
        delete this._processingPollTimeouts[key];
      });
    } else {
      this._processingPollTimeouts = {};
    }
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
    this._pollForProcessingComplete(viewName);
  }
  async _pollForProcessingComplete(viewName, attempt = 0) {
    const MAX_ATTEMPTS = 120; // 5 minutes with increasing intervals
    const BASE_INTERVAL = 2000; // Start at 2 seconds
    const MAX_INTERVAL = 10000; // Cap at 10 seconds
    const EXPECTED_DURATION = 60000; // Expected 60 seconds for generation
    const interval = Math.min(BASE_INTERVAL * Math.pow(1.2, Math.floor(attempt / 5)), MAX_INTERVAL);
    if (attempt >= MAX_ATTEMPTS) {
      this._showGenerationTimeout(viewName);
      return;
    }
    const statusEl = document.getElementById('processing-status');
    const progressBar = document.getElementById('progress-bar');
    const startTime = this._processingStartTimes?.[viewName] || Date.now();
    const elapsedMs = Date.now() - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (statusEl) {
      statusEl.textContent = `Checking status... (${elapsedSeconds}s elapsed)`;
    }
    if (progressBar) {
      const progress = Math.min((elapsedMs / EXPECTED_DURATION) * 100, 95); // Cap at 95% until complete
      progressBar.style.width = `${progress}%`;
    }
    try {
      const response = await fetch(`/api/content/${this.sessionId}/${viewName}`);
      const data = await response.json();
      if (data.status === 'completed' && data.data) {
        if (this._processingPollTimeouts && this._processingPollTimeouts[viewName]) {
          delete this._processingPollTimeouts[viewName];
        }
        const progressBar = document.getElementById('progress-bar');
        const statusEl = document.getElementById('processing-status');
        if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.style.background = 'var(--color-success, #10b981)';
        }
        if (statusEl) {
          statusEl.textContent = 'Generation complete! Loading...';
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        this.stateManager.setState({
          content: { ...this.stateManager.state.content, [viewName]: data.data }
        });
        this._updateTabStatus(viewName, 'ready');
        await this._loadView(viewName);
        return;
      }
      if (data.status === 'error') {
        if (this._processingPollTimeouts && this._processingPollTimeouts[viewName]) {
          delete this._processingPollTimeouts[viewName];
        }
        this._updateTabStatus(viewName, 'failed');
        this._showGenerationFailed(viewName, data.error || 'Content generation failed. Please try again.');
        return;
      }
      this._processingPollTimeouts[viewName] = setTimeout(() => {
        this._pollForProcessingComplete(viewName, attempt + 1);
      }, interval);
    } catch (error) {
      this._processingPollTimeouts[viewName] = setTimeout(() => {
        this._pollForProcessingComplete(viewName, attempt + 1);
      }, interval * 2);
    }
  }
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
    const retryBtn = document.getElementById('retry-generation-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this._retryGeneration(viewName));
    }
  }
  async _retryGeneration(viewName) {
    const viewNameCapitalized = viewName.charAt(0).toUpperCase() + viewName.slice(1);
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
      await this._pollForRegeneration(viewName);
      this.stateManager.setState({
        content: { ...this.stateManager.state.content, [viewName]: null }
      });
      await this._loadView(viewName);
    } catch (error) {
      this._showGenerationFailed(viewName, `Regeneration failed: ${error.message}`);
    }
  }
  async _pollForRegeneration(viewName, maxAttempts = 120, intervalMs = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`/api/content/${this.sessionId}/${viewName}`);
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
  _getSessionIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sessionId');
  }
  _addStatusIndicatorStyles() {
    return;
  }
  _updateProgressLine() {
  }
  _updateTabStatus(viewName, status) {
    if (this.sidebarNav) {
      this.sidebarNav.updateStatus(viewName, status);
    }
    this._updateProgressLine();
  }
  _startBackgroundStatusPolling() {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];
    views.forEach(view => this._updateTabStatus(view, 'loading'));
    if (!this._backgroundPollTimeouts) {
      this._backgroundPollTimeouts = {};
    }
    const pollView = async (viewName, attempt = 0) => {
      const BASE_INTERVAL = 3000; // 3 seconds
      const MAX_INTERVAL = 15000; // 15 seconds max
      const MAX_ATTEMPTS = 100; // Stop polling after ~5 minutes
      const interval = Math.min(BASE_INTERVAL * Math.pow(1.3, Math.floor(attempt / 3)), MAX_INTERVAL);
      if (attempt >= MAX_ATTEMPTS) {
        this._updateTabStatus(viewName, 'failed');
        if (this._backgroundPollTimeouts[viewName]) {
          delete this._backgroundPollTimeouts[viewName];
        }
        return;
      }
      try {
        const response = await fetch(`/api/content/${this.sessionId}/${viewName}`);
        if (!response.ok) {
          this._updateTabStatus(viewName, 'failed');
          if (this._backgroundPollTimeouts[viewName]) {
            delete this._backgroundPollTimeouts[viewName];
          }
          return;
        }
        const data = await response.json();
        if (data.status === 'completed' && data.data) {
          this._updateTabStatus(viewName, 'ready');
          if (!this.stateManager.state.content[viewName]) {
            this.stateManager.setState({
              content: { ...this.stateManager.state.content, [viewName]: data.data }
            });
          }
          if (this._backgroundPollTimeouts[viewName]) {
            delete this._backgroundPollTimeouts[viewName];
          }
        } else if (data.status === 'error') {
          this._updateTabStatus(viewName, 'failed');
          if (this._backgroundPollTimeouts[viewName]) {
            delete this._backgroundPollTimeouts[viewName];
          }
        } else if (data.status === 'processing' || data.status === 'pending') {
          this._updateTabStatus(viewName, 'processing');
          this._backgroundPollTimeouts[viewName] = setTimeout(() => {
            pollView(viewName, attempt + 1);
          }, interval);
        } else {
          this._updateTabStatus(viewName, 'loading');
          this._backgroundPollTimeouts[viewName] = setTimeout(() => {
            pollView(viewName, attempt + 1);
          }, interval);
        }
      } catch (error) {
        this._backgroundPollTimeouts[viewName] = setTimeout(() => {
          pollView(viewName, attempt + 1);
        }, interval * 2);
      }
    };
    views.forEach(view => pollView(view, 0));
  }
  destroy() {
    if (this._processingPollTimeouts) {
      Object.values(this._processingPollTimeouts).forEach(timeout => clearTimeout(timeout));
      this._processingPollTimeouts = {};
    }
    if (this._backgroundPollTimeouts) {
      Object.values(this._backgroundPollTimeouts).forEach(timeout => clearTimeout(timeout));
      this._backgroundPollTimeouts = {};
    }
    if (this._processingStartTimes) {
      this._processingStartTimes = {};
    }
    if (this.removeShortcuts) {
      this.removeShortcuts();
    }
    if (this.sidebarNav) {
      this.sidebarNav.destroy();
      this.sidebarNav = null;
    }
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const viewer = new ContentViewer();
  viewer.init();
});
