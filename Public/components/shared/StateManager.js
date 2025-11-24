/**
 * Centralized state management for the application
 * Provides reactive state updates across all views
 */

export class StateManager {
  constructor() {
    this.state = {
      // Session info
      sessionId: null,
      currentView: 'roadmap',  // 'roadmap' | 'slides' | 'document'

      // Content data
      content: {
        roadmap: null,
        slides: null,
        document: null
      },

      // Loading states
      loading: {
        roadmap: false,
        slides: false,
        document: false
      },

      // Error states
      errors: {
        roadmap: null,
        slides: null,
        document: null
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
   */
  async loadView(viewName) {
    // Check if already loaded
    if (this.state.content[viewName]) {
      console.log(`✅ ${viewName} already loaded from cache`);
      return this.state.content[viewName];
    }

    // Set loading state
    this.setState({
      loading: { ...this.state.loading, [viewName]: true },
      errors: { ...this.state.errors, [viewName]: null }
    });

    try {
      const response = await fetch(
        `/content/${this.state.sessionId}/${viewName}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load ${viewName}: ${response.statusText}`);
      }

      const data = await response.json();

      // Update state with loaded data
      this.setState({
        content: { ...this.state.content, [viewName]: data },
        loading: { ...this.state.loading, [viewName]: false }
      });

      return data;
    } catch (error) {
      console.error(`Error loading ${viewName}:`, error);

      this.setState({
        loading: { ...this.state.loading, [viewName]: false },
        errors: { ...this.state.errors, [viewName]: error.message }
      });

      throw error;
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
   */
  async prefetchOtherViews(currentView) {
    const views = ['roadmap', 'slides', 'document'];
    const otherViews = views.filter(v => v !== currentView);

    // Wait a bit, then prefetch
    setTimeout(async () => {
      for (const view of otherViews) {
        if (!this.state.content[view]) {
          try {
            await this.loadView(view);
            console.log(`✅ Prefetched ${view}`);
          } catch (error) {
            console.log(`⚠️ Failed to prefetch ${view}`);
          }
        }
      }
    }, 2000);
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
      content: { roadmap: null, slides: null, document: null },
      loading: { roadmap: false, slides: false, document: false },
      errors: { roadmap: null, slides: null, document: null }
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
