/**
 * DOM Utilities for Optimized Rendering
 *
 * Performance optimizations:
 * - Batched DOM updates using DocumentFragment
 * - Virtual scrolling support for large lists
 * - Render timing profiling
 * - Debounced/throttled updates
 * - Layout thrashing prevention
 */

// ============================================================================
// RENDER PROFILING
// ============================================================================

const renderMetrics = {
  renders: [],
  maxSamples: 100
};

/**
 * Profile a render operation
 * @param {string} componentName - Name of the component
 * @param {Function} renderFn - The render function to profile
 * @returns {*} Result of the render function
 */
export function profileRender(componentName, renderFn) {
  const startTime = performance.now();

  try {
    const result = renderFn();
    const duration = performance.now() - startTime;

    // Track render timing
    renderMetrics.renders.push({
      component: componentName,
      duration,
      timestamp: Date.now()
    });

    // Trim old samples
    if (renderMetrics.renders.length > renderMetrics.maxSamples) {
      renderMetrics.renders.shift();
    }

    // Warn if render is slow (> 16ms = 60fps threshold)
    if (duration > 16) {
      console.warn(`[RenderPerf] Slow render: ${componentName} took ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    console.error(`[RenderPerf] Error in ${componentName}:`, error);
    throw error;
  }
}

/**
 * Get render metrics summary
 * @returns {object} Render metrics
 */
export function getRenderMetrics() {
  if (renderMetrics.renders.length === 0) {
    return { count: 0, avgDuration: 0, maxDuration: 0, slowRenders: 0 };
  }

  const durations = renderMetrics.renders.map(r => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);
  const slowRenders = durations.filter(d => d > 16).length;

  // Group by component
  const byComponent = {};
  for (const r of renderMetrics.renders) {
    if (!byComponent[r.component]) {
      byComponent[r.component] = { count: 0, totalTime: 0 };
    }
    byComponent[r.component].count++;
    byComponent[r.component].totalTime += r.duration;
  }

  return {
    count: renderMetrics.renders.length,
    avgDuration: avgDuration.toFixed(2),
    maxDuration: maxDuration.toFixed(2),
    slowRenders,
    byComponent
  };
}

// ============================================================================
// BATCHED DOM UPDATES
// ============================================================================

/**
 * Create elements in batch using DocumentFragment
 * More efficient than appending elements one by one
 *
 * @param {Array} items - Items to render
 * @param {Function} createElementFn - Function to create element from item
 * @returns {DocumentFragment} Fragment containing all elements
 */
export function batchCreateElements(items, createElementFn) {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < items.length; i++) {
    const element = createElementFn(items[i], i);
    if (element) {
      fragment.appendChild(element);
    }
  }

  return fragment;
}

/**
 * Update container contents efficiently
 * Clears and replaces content in a single reflow
 *
 * @param {HTMLElement} container - Container element
 * @param {DocumentFragment|HTMLElement|string} content - New content
 */
export function updateContainer(container, content) {
  // Use replaceChildren for atomic update (single reflow)
  if (typeof container.replaceChildren === 'function') {
    if (typeof content === 'string') {
      container.innerHTML = content;
    } else {
      container.replaceChildren(content);
    }
  } else {
    // Fallback for older browsers
    container.innerHTML = '';
    if (typeof content === 'string') {
      container.innerHTML = content;
    } else {
      container.appendChild(content);
    }
  }
}

/**
 * Schedule a DOM update for the next animation frame
 * Batches multiple updates into a single frame
 *
 * @param {Function} updateFn - Update function
 * @returns {number} Request ID for cancellation
 */
const pendingUpdates = new Map();
let frameRequested = false;

export function scheduleUpdate(key, updateFn) {
  pendingUpdates.set(key, updateFn);

  if (!frameRequested) {
    frameRequested = true;
    return requestAnimationFrame(() => {
      frameRequested = false;
      const updates = Array.from(pendingUpdates.values());
      pendingUpdates.clear();

      // Execute all pending updates
      for (const fn of updates) {
        try {
          fn();
        } catch (e) {
          console.error('[DOM] Update error:', e);
        }
      }
    });
  }
}

// ============================================================================
// VIRTUAL SCROLLING
// ============================================================================

/**
 * Virtual scroll renderer for large lists
 * Only renders items visible in viewport + buffer
 */
export class VirtualScroller {
  constructor(options) {
    this.container = options.container;
    this.itemHeight = options.itemHeight || 40;
    this.bufferSize = options.bufferSize || 5;
    this.items = options.items || [];
    this.renderItem = options.renderItem;

    this.scrollTop = 0;
    this.containerHeight = 0;
    this.renderedRange = { start: 0, end: 0 };

    this._scrollHandler = this._onScroll.bind(this);
    this._resizeObserver = null;
  }

  init() {
    // Create scroll container structure
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'virtual-scroll-container';
    this.scrollContainer.style.cssText = 'overflow-y: auto; height: 100%;';

    this.spacer = document.createElement('div');
    this.spacer.className = 'virtual-scroll-spacer';
    this.spacer.style.height = `${this.items.length * this.itemHeight}px`;

    this.viewport = document.createElement('div');
    this.viewport.className = 'virtual-scroll-viewport';
    this.viewport.style.cssText = 'position: relative;';

    this.spacer.appendChild(this.viewport);
    this.scrollContainer.appendChild(this.spacer);

    if (this.container) {
      this.container.appendChild(this.scrollContainer);
    }

    // Listen for scroll
    this.scrollContainer.addEventListener('scroll', this._scrollHandler, { passive: true });

    // Track container size changes
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => {
        this.containerHeight = this.scrollContainer.clientHeight;
        this.render();
      });
      this._resizeObserver.observe(this.scrollContainer);
    }

    this.containerHeight = this.scrollContainer.clientHeight;
    this.render();
  }

  setItems(items) {
    this.items = items;
    this.spacer.style.height = `${items.length * this.itemHeight}px`;
    this.render();
  }

  _onScroll() {
    this.scrollTop = this.scrollContainer.scrollTop;
    this.render();
  }

  render() {
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    const endIndex = Math.min(this.items.length, startIndex + visibleCount + this.bufferSize * 2);

    // Skip if range hasn't changed
    if (startIndex === this.renderedRange.start && endIndex === this.renderedRange.end) {
      return;
    }

    this.renderedRange = { start: startIndex, end: endIndex };

    // Render visible items
    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      const item = this.items[i];
      const element = this.renderItem(item, i);
      if (element) {
        element.style.position = 'absolute';
        element.style.top = `${i * this.itemHeight}px`;
        element.style.width = '100%';
        fragment.appendChild(element);
      }
    }

    this.viewport.replaceChildren(fragment);
  }

  destroy() {
    this.scrollContainer.removeEventListener('scroll', this._scrollHandler);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }
}

// ============================================================================
// LAYOUT THRASHING PREVENTION
// ============================================================================

/**
 * Read DOM properties in batch (before any writes)
 * Prevents layout thrashing by separating reads and writes
 *
 * @param {Array} readFns - Array of functions that read from DOM
 * @returns {Array} Array of read results
 */
export function batchRead(readFns) {
  return readFns.map(fn => fn());
}

/**
 * Write DOM properties in batch (after all reads)
 * @param {Array} writeFns - Array of functions that write to DOM
 */
export function batchWrite(writeFns) {
  for (const fn of writeFns) {
    fn();
  }
}

/**
 * Execute reads then writes to prevent layout thrashing
 * @param {Function} readFn - Function containing all DOM reads
 * @param {Function} writeFn - Function containing all DOM writes
 */
export function readThenWrite(readFn, writeFn) {
  const readResult = readFn();
  requestAnimationFrame(() => {
    writeFn(readResult);
  });
}

// ============================================================================
// DEBOUNCE AND THROTTLE
// ============================================================================

/**
 * Debounce a function - wait for pause in calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay = 100) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle a function - limit call frequency
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in ms
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit = 100) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ============================================================================
// INTERSECTION OBSERVER UTILITIES
// ============================================================================

/**
 * Create lazy loading observer for elements
 * @param {Function} onVisible - Callback when element becomes visible
 * @param {object} options - IntersectionObserver options
 * @returns {IntersectionObserver} Observer instance
 */
export function createLazyObserver(onVisible, options = {}) {
  const defaultOptions = {
    root: null,
    rootMargin: '100px',
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        onVisible(entry.target);
        observer.unobserve(entry.target);
      }
    }
  }, { ...defaultOptions, ...options });

  return observer;
}

// ============================================================================
// ELEMENT CREATION HELPERS
// ============================================================================

/**
 * Create element with attributes and children efficiently
 * @param {string} tag - Element tag name
 * @param {object} attrs - Attributes and properties
 * @param {Array|string} children - Child elements or text content
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  // Set attributes and properties
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(element.dataset, value);
    } else {
      element.setAttribute(key, value);
    }
  }

  // Add children
  if (typeof children === 'string') {
    element.textContent = children;
  } else if (Array.isArray(children)) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    }
  }

  return element;
}

export default {
  profileRender,
  getRenderMetrics,
  batchCreateElements,
  updateContainer,
  scheduleUpdate,
  VirtualScroller,
  batchRead,
  batchWrite,
  readThenWrite,
  debounce,
  throttle,
  createLazyObserver,
  createElement
};
