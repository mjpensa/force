/**
 * LazyLoader Utility
 * Provides lazy loading functionality for images and components
 * Improves initial page load performance
 *
 * @module LazyLoader
 */

/**
 * Initialize lazy loading for images using Intersection Observer
 * Automatically detects images with data-src attribute and loads them when visible
 *
 * @param {string} selector - CSS selector for images to lazy load (default: 'img[data-src]')
 * @param {Object} options - Intersection Observer options
 * @returns {IntersectionObserver} The observer instance
 *
 * @example
 * // HTML: <img data-src="image.jpg" alt="Description" class="lazy">
 * initLazyLoading('img.lazy');
 */
export function initLazyLoading(selector = 'img[data-src]', options = {}) {
  const defaultOptions = {
    root: null,
    rootMargin: '50px', // Start loading 50px before image enters viewport
    threshold: 0.01
  };

  const config = { ...defaultOptions, ...options };

  // Check for Intersection Observer support
  if (!('IntersectionObserver' in window)) {
    console.warn('Intersection Observer not supported. Loading all images immediately.');
    loadAllImages(selector);
    return null;
  }

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        loadImage(img);
        observer.unobserve(img);
      }
    });
  }, config);

  // Observe all images matching the selector
  const images = document.querySelectorAll(selector);
  images.forEach(img => imageObserver.observe(img));

  return imageObserver;
}

/**
 * Load a single image by replacing data-src with src
 *
 * @param {HTMLImageElement} img - The image element to load
 * @private
 */
function loadImage(img) {
  const src = img.getAttribute('data-src');
  const srcset = img.getAttribute('data-srcset');

  if (!src) {
    console.warn('Image missing data-src attribute:', img);
    return;
  }

  // Show loading state
  img.classList.add('loading');

  // Create a new image to preload
  const preloader = new Image();

  preloader.onload = () => {
    img.src = src;
    if (srcset) {
      img.srcset = srcset;
    }
    img.classList.remove('loading');
    img.classList.add('loaded');
  };

  preloader.onerror = () => {
    console.error('Failed to load image:', src);
    img.classList.remove('loading');
    img.classList.add('error');
    // Set a fallback image or placeholder
    img.alt = img.alt || 'Image failed to load';
  };

  preloader.src = src;
  if (srcset) {
    preloader.srcset = srcset;
  }
}

/**
 * Fallback: Load all images immediately (for browsers without Intersection Observer)
 *
 * @param {string} selector - CSS selector for images
 * @private
 */
function loadAllImages(selector) {
  const images = document.querySelectorAll(selector);
  images.forEach(img => loadImage(img));
}

/**
 * Lazy load a component/module when it becomes visible
 * Useful for code splitting and reducing initial bundle size
 *
 * @param {HTMLElement} element - Element to observe
 * @param {Function} loadCallback - Function to call when element is visible
 * @param {Object} options - Intersection Observer options
 * @returns {IntersectionObserver} The observer instance
 *
 * @example
 * const chart = document.getElementById('chart');
 * lazyLoadComponent(chart, async () => {
 *   const { GanttChart } = await import('./GanttChart.js');
 *   new GanttChart(chart).render();
 * });
 */
export function lazyLoadComponent(element, loadCallback, options = {}) {
  const defaultOptions = {
    root: null,
    rootMargin: '100px',
    threshold: 0.01
  };

  const config = { ...defaultOptions, ...options };

  if (!('IntersectionObserver' in window)) {
    // Load immediately if Intersection Observer not supported
    loadCallback();
    return null;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadCallback();
        obs.unobserve(element);
      }
    });
  }, config);

  observer.observe(element);
  return observer;
}

/**
 * Preload images in the background for better UX
 * Useful for preloading images for next slides, sections, etc.
 *
 * @param {string[]} urls - Array of image URLs to preload
 * @returns {Promise<void>} Resolves when all images are loaded
 *
 * @example
 * preloadImages(['/img/slide1.jpg', '/img/slide2.jpg'])
 *   .then(() => console.log('Images preloaded'));
 */
export function preloadImages(urls) {
  return Promise.all(
    urls.map(url => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => {
          console.warn('Failed to preload image:', url);
          resolve(url); // Resolve anyway to not block other images
        };
        img.src = url;
      });
    })
  );
}

/**
 * Add CSS styles for lazy loading states
 * Call this once in your application initialization
 */
export function addLazyLoadingStyles() {
  if (document.getElementById('lazy-loading-styles')) {
    return; // Already added
  }

  const style = document.createElement('style');
  style.id = 'lazy-loading-styles';
  style.textContent = `
    /* Lazy loading image states */
    img[data-src] {
      background: var(--color-background, #f3f4f6);
      min-height: 100px;
    }

    img[data-src].loading {
      opacity: 0.6;
      animation: pulse 1.5s ease-in-out infinite;
    }

    img[data-src].loaded {
      animation: fadeIn 0.3s ease-in;
    }

    img[data-src].error {
      background: var(--color-background, #f3f4f6);
      border: 2px dashed var(--color-border, #e5e7eb);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    img[data-src].error::after {
      content: '⚠️ Image unavailable';
      color: var(--color-text-tertiary, #9ca3af);
      font-size: 0.875rem;
      padding: 1rem;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 0.6;
      }
      50% {
        opacity: 0.4;
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;

  document.head.appendChild(style);
}

/**
 * Default export with all utilities
 */
export default {
  initLazyLoading,
  lazyLoadComponent,
  preloadImages,
  addLazyLoadingStyles
};
