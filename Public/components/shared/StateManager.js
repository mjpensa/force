import { fetchWithRetry, AppError, ErrorTypes, ErrorSeverity } from './ErrorHandler.js';
export class StateManager {
  constructor() {
    this.state = {
      sessionId: null,
      currentView: 'roadmap',  // 'roadmap' | 'slides' | 'document' | 'research-analysis'
      content: {
        roadmap: null,
        slides: null,
        document: null,
        'research-analysis': null
      },
      loading: {
        roadmap: false,
        slides: false,
        document: false,
        'research-analysis': false
      },
      errors: {
        roadmap: null,
        slides: null,
        document: null,
        'research-analysis': null
      },
      ui: {
        menuOpen: false,
        fullscreen: false
      }
    };
    this.listeners = [];
    this.viewListeners = {};  // View-specific listeners
  }
  getState() {
    return { ...this.state };
  }
  setState(updates) {
    const previousState = { ...this.state };
    this.state = this.deepMerge(this.state, updates);
    this.notifyListeners(previousState, this.state);
  }
  deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  subscribeToView(viewName, listener) {
    if (!this.viewListeners[viewName]) {
      this.viewListeners[viewName] = [];
    }
    this.viewListeners[viewName].push(listener);
    return () => {
      this.viewListeners[viewName] = this.viewListeners[viewName].filter(
        l => l !== listener
      );
    };
  }
  notifyListeners(previousState, newState) {
    this.listeners.forEach(listener => {
      try {
        listener(newState, previousState);
      } catch (error) {
      }
    });
    for (const viewName in this.viewListeners) {
      if (newState.content[viewName] !== previousState.content[viewName]) {
        this.viewListeners[viewName].forEach(listener => {
          try {
            listener(newState.content[viewName], previousState.content[viewName]);
          } catch (error) {
          }
        });
      }
    }
  }
  async loadView(viewName, forceRefresh = false) {
    if (!forceRefresh && this.state.content[viewName]) {
      return this.state.content[viewName];
    }
    if (forceRefresh) {
      this.setState({
        content: { ...this.state.content, [viewName]: null },
        errors: { ...this.state.errors, [viewName]: null }
      });
    }
    this.setState({
      loading: { ...this.state.loading, [viewName]: true },
      errors: { ...this.state.errors, [viewName]: null }
    });
    try {
      const response = await fetchWithRetry(
        `/api/content/${this.state.sessionId}/${viewName}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      if (!response.ok) {
        let errorType = ErrorTypes.API;
        let severity = ErrorSeverity.MEDIUM;
        if (response.status === 404) {
          errorType = ErrorTypes.NOT_FOUND;
        } else if (response.status === 403) {
          errorType = ErrorTypes.PERMISSION;
        } else if (response.status >= 500) {
          severity = ErrorSeverity.HIGH;
        }
        throw new AppError(
          `Failed to load ${viewName}: ${response.statusText}`,
          errorType,
          severity,
          { status: response.status, viewName }
        );
      }
      const result = await response.json();
      if (result.status === 'processing' || result.status === 'pending') {
        throw new AppError(
          `${viewName} is still being generated. Please wait...`,
          ErrorTypes.API,
          ErrorSeverity.LOW,
          { viewName, processing: true }
        );
      }
      if (result.status === 'error') {
        throw new AppError(
          result.error || `Failed to generate ${viewName}`,
          ErrorTypes.API,
          ErrorSeverity.HIGH,
          { viewName, apiError: true }
        );
      }
      const data = result.data;
      if (!data) {
        throw new AppError(
          `No data received for ${viewName}`,
          ErrorTypes.API,
          ErrorSeverity.MEDIUM,
          { viewName, emptyData: true }
        );
      }
      if (viewName === 'document') {
        if (!data.sections || !Array.isArray(data.sections) || data.sections.length === 0) {
          throw new AppError(
            `Document generation completed but produced empty content. Please try regenerating.`,
            ErrorTypes.VALIDATION,
            ErrorSeverity.MEDIUM,
            { viewName, emptyContent: true, canRetry: true }
          );
        }
      }
      if (viewName === 'slides') {
        if (!data.slides || !Array.isArray(data.slides) || data.slides.length === 0) {
          throw new AppError(
            `Slides generation completed but produced empty content. Please try regenerating.`,
            ErrorTypes.VALIDATION,
            ErrorSeverity.MEDIUM,
            { viewName, emptyContent: true, canRetry: true }
          );
        }
      }
      if (viewName === 'research-analysis') {
        if (!data.themes || !Array.isArray(data.themes) || data.themes.length === 0) {
          throw new AppError(
            `Research analysis generation completed but produced empty content. Please try regenerating.`,
            ErrorTypes.VALIDATION,
            ErrorSeverity.MEDIUM,
            { viewName, emptyContent: true, canRetry: true }
          );
        }
      }
      this.setState({
        content: { ...this.state.content, [viewName]: data },
        loading: { ...this.state.loading, [viewName]: false }
      });
      return data;
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError(
            error.message || `Failed to load ${viewName}`,
            ErrorTypes.UNKNOWN,
            ErrorSeverity.MEDIUM,
            { viewName, originalError: error }
          );
      this.setState({
        loading: { ...this.state.loading, [viewName]: false },
        errors: { ...this.state.errors, [viewName]: appError.message }
      });
      throw appError;
    }
  }
  switchView(viewName) {
    if (this.state.currentView === viewName) {
      return;  // Already on this view
    }
    this.setState({ currentView: viewName });
    window.location.hash = viewName;
  }
  initializeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session') || params.get('id'); // Support both
    const hash = window.location.hash.replace('#', '') || 'roadmap';
    if (!sessionId) {
      throw new Error('No session ID in URL');
    }
    this.setState({
      sessionId,
      currentView: hash
    });
  }
  async prefetchOtherViews(currentView) {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];
    const otherViews = views.filter(v => v !== currentView);
    setTimeout(async () => {
      const viewsToFetch = otherViews.filter(view => !this.state.content[view]);
      if (viewsToFetch.length === 0) {
        return;
      }
      const results = await Promise.allSettled(
        viewsToFetch.map(async (view) => {
          try {
            await this.loadView(view);
            return { view, success: true };
          } catch (error) {
            return { view, success: false, error: error.message };
          }
        })
      );
      results.forEach((result, index) => {
        const view = viewsToFetch[index];
        if (result.status === 'fulfilled' && result.value.success) {
        } else {
          const errorMsg = result.status === 'rejected' ? result.reason : result.value?.error;
        }
      });
    }, 1500); // Reduced delay since we're fetching in parallel
  }
  async refreshView(viewName) {
    this.setState({
      content: { ...this.state.content, [viewName]: null }
    });
    return await this.loadView(viewName);
  }
  clear() {
    this.setState({
      sessionId: null,
      currentView: 'roadmap',
      content: { roadmap: null, slides: null, document: null, 'research-analysis': null },
      loading: { roadmap: false, slides: false, document: false, 'research-analysis': false },
      errors: { roadmap: null, slides: null, document: null, 'research-analysis': null }
    });
  }
  toggleMenu() {
    this.setState({
      ui: { ...this.state.ui, menuOpen: !this.state.ui.menuOpen }
    });
  }
  toggleFullscreen() {
    this.setState({
      ui: { ...this.state.ui, fullscreen: !this.state.ui.fullscreen }
    });
  }
}
export const state = new StateManager();
