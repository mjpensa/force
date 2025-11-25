/**
 * Centralized state management for the application
 * Provides reactive state updates across all views
 * Phase 6: Enhanced with error handling and retry logic
 */

import { fetchWithRetry, AppError, ErrorTypes, ErrorSeverity } from './ErrorHandler.js';

export class StateManager {
  constructor() {
    this.state = {
      // Session info
      sessionId: null,
      currentView: 'roadmap',  // 'roadmap' | 'slides' | 'document' | 'research-analysis'

      // Content data
      content: {
        roadmap: null,
        slides: null,
        document: null,
        'research-analysis': null
      },

      // Loading states
      loading: {
        roadmap: false,
        slides: false,
        document: false,
        'research-analysis': false
      },

      // Error states
      errors: {
        roadmap: null,
        slides: null,
        document: null,
        'research-analysis': null
      },

      // UI state
      ui: {
        menuOpen: false,
        fullscreen: false
      }
    };

    this.listeners = [];
    this.viewListeners = {};  // View-specific listeners
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update state and notify listeners
   */
  setState(updates) {
    const previousState = { ...this.state };
    this.state = this.deepMerge(this.state, updates);

    // Notify all listeners
    this.notifyListeners(previousState, this.state);
  }

  /**
   * Deep merge objects
   */
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

  /**
   * Subscribe to state changes
   * @param {Function} listener - Called with (newState, previousState)
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Subscribe to specific view changes
   */
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

  /**
   * Notify all listeners of state change
   */
  notifyListeners(previousState, newState) {
    // Global listeners
    this.listeners.forEach(listener => {
      try {
        listener(newState, previousState);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });

    // View-specific listeners
    for (const viewName in this.viewListeners) {
      if (newState.content[viewName] !== previousState.content[viewName]) {
        this.viewListeners[viewName].forEach(listener => {
          try {
            listener(newState.content[viewName], previousState.content[viewName]);
          } catch (error) {
            console.error(`Error in ${viewName} listener:`, error);
          }
        });
      }
    }
  }

  /**
   * Load content for a specific view
   * Enhanced with retry logic and better error handling
   * @param {string} viewName - Name of view to load
   * @param {boolean} forceRefresh - If true, bypasses cache and fetches fresh data
   */
  async loadView(viewName, forceRefresh = false) {
    // Check if already loaded (skip if force refresh)
    if (!forceRefresh && this.state.content[viewName]) {
      console.log(`✅ ${viewName} already loaded from cache`);
      return this.state.content[viewName];
    }

    // Clear cached content and errors if force refreshing
    if (forceRefresh) {
      console.log(`🔄 Force refreshing ${viewName}...`);
      this.setState({
        content: { ...this.state.content, [viewName]: null },
        errors: { ...this.state.errors, [viewName]: null }
      });
    }

    // Set loading state
    this.setState({
      loading: { ...this.state.loading, [viewName]: true },
      errors: { ...this.state.errors, [viewName]: null }
    });

    try {
      // Use fetchWithRetry for automatic retry on failures
      const response = await fetchWithRetry(
        `/api/content/${this.state.sessionId}/${viewName}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        // Determine error type based on status code
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

      // Check status from Phase 2 API
      // Handle both 'processing' (generation in progress) and 'pending' (queued but not started)
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

      // Extract data from response
      const data = result.data;

      if (!data) {
        throw new AppError(
          `No data received for ${viewName}`,
          ErrorTypes.API,
          ErrorSeverity.MEDIUM,
          { viewName, emptyData: true }
        );
      }

      // Validate document-specific structure
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

      // Validate slides-specific structure
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

      // Validate research-analysis-specific structure
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

      // Update state with loaded data
      this.setState({
        content: { ...this.state.content, [viewName]: data },
        loading: { ...this.state.loading, [viewName]: false }
      });

      console.log(`✅ ${viewName} loaded successfully`);
      return data;

    } catch (error) {
      console.error(`❌ Error loading ${viewName}:`, error);

      // Convert to AppError if not already
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

  /**
   * Switch to a different view
   */
  switchView(viewName) {
    if (this.state.currentView === viewName) {
      return;  // Already on this view
    }

    this.setState({ currentView: viewName });
    window.location.hash = viewName;
  }

  /**
   * Initialize state from URL
   */
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

    console.log('✅ State initialized from URL');
    console.log('   Session ID:', sessionId);
    console.log('   Current view:', hash);
  }

  /**
   * Prefetch other views in background
   * Enhanced: Now runs prefetch in parallel for faster overall loading
   */
  async prefetchOtherViews(currentView) {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];
    const otherViews = views.filter(v => v !== currentView);

    // Wait a bit for current view to finish loading, then prefetch others in parallel
    setTimeout(async () => {
      // Filter to only views that aren't already cached
      const viewsToFetch = otherViews.filter(view => !this.state.content[view]);

      if (viewsToFetch.length === 0) {
        console.log('✅ All views already cached, no prefetch needed');
        return;
      }

      console.log(`🔄 Prefetching ${viewsToFetch.length} views in parallel: ${viewsToFetch.join(', ')}`);

      // Fetch all views in parallel using Promise.allSettled
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

      // Log results
      results.forEach((result, index) => {
        const view = viewsToFetch[index];
        if (result.status === 'fulfilled' && result.value.success) {
          console.log(`✅ Prefetched ${view}`);
        } else {
          const errorMsg = result.status === 'rejected' ? result.reason : result.value?.error;
          console.log(`⚠️ Failed to prefetch ${view}: ${errorMsg || 'unknown error'}`);
        }
      });
    }, 1500); // Reduced delay since we're fetching in parallel
  }

  /**
   * Refresh a specific view
   */
  async refreshView(viewName) {
    // Clear cached data
    this.setState({
      content: { ...this.state.content, [viewName]: null }
    });

    // Reload
    return await this.loadView(viewName);
  }

  /**
   * Clear all state (logout/reset)
   */
  clear() {
    this.setState({
      sessionId: null,
      currentView: 'roadmap',
      content: { roadmap: null, slides: null, document: null, 'research-analysis': null },
      loading: { roadmap: false, slides: false, document: false, 'research-analysis': false },
      errors: { roadmap: null, slides: null, document: null, 'research-analysis': null }
    });
  }

  /**
   * Toggle UI state
   */
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

// Export singleton instance
export const state = new StateManager();
