/**
 * Accessibility Utilities
 * Ensures WCAG 2.1 AA compliance and improves user experience for all users
 *
 * @module Accessibility
 */

/**
 * Announce message to screen readers using ARIA live regions
 *
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' (default) or 'assertive'
 *
 * @example
 * announceToScreenReader('Content loaded successfully');
 * announceToScreenReader('Error occurred', 'assertive');
 */
export function announceToScreenReader(message, priority = 'polite') {
  let liveRegion = document.getElementById('aria-live-region');

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-region';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    document.body.appendChild(liveRegion);
  }

  // Update priority if different
  liveRegion.setAttribute('aria-live', priority);

  // Clear and set new message (screen readers detect changes)
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 100);
}

/**
 * Trap focus within a modal or dialog
 * Ensures keyboard users can't tab out of modal
 *
 * @param {HTMLElement} container - Container element to trap focus within
 * @returns {Function} Function to remove focus trap
 *
 * @example
 * const modal = document.getElementById('modal');
 * const removeTrap = trapFocus(modal);
 * // Later: removeTrap();
 */
export function trapFocus(container) {
  const focusableElements = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleTabKey(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  container.addEventListener('keydown', handleTabKey);

  // Focus first element
  if (firstFocusable) {
    firstFocusable.focus();
  }

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * Add skip link for keyboard navigation
 * Allows users to skip to main content
 *
 * @param {string} targetId - ID of main content element
 * @param {string} label - Link label (default: 'Skip to main content')
 *
 * @example
 * addSkipLink('main-content', 'Skip to content');
 */
export function addSkipLink(targetId, label = 'Skip to main content') {
  if (document.getElementById('skip-link')) {
    return; // Already exists
  }

  const skipLink = document.createElement('a');
  skipLink.id = 'skip-link';
  skipLink.href = `#${targetId}`;
  skipLink.textContent = label;
  skipLink.className = 'skip-link';

  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--color-primary, #3b82f6);
    color: white;
    padding: 8px 16px;
    text-decoration: none;
    border-radius: 0 0 4px 0;
    z-index: 10000;
    transition: top 0.2s;
  `;

  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
  });

  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });

  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });

  document.body.insertBefore(skipLink, document.body.firstChild);
}

/**
 * Check color contrast ratio (WCAG 2.1 AA compliance)
 * AA requires 4.5:1 for normal text, 3:1 for large text
 *
 * @param {string} foreground - Foreground color (hex, rgb, or color name)
 * @param {string} background - Background color (hex, rgb, or color name)
 * @returns {Object} Object with ratio and compliance levels
 *
 * @example
 * const result = checkColorContrast('#000000', '#ffffff');
 * console.log(result.ratio); // 21
 * console.log(result.aaLarge); // true
 * console.log(result.aaNormal); // true
 */
export function checkColorContrast(foreground, background) {
  const fgLuminance = getRelativeLuminance(foreground);
  const bgLuminance = getRelativeLuminance(background);

  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);

  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio: ratio,
    aaLarge: ratio >= 3,    // WCAG AA for large text (18pt+)
    aaNormal: ratio >= 4.5,  // WCAG AA for normal text
    aaaLarge: ratio >= 4.5,  // WCAG AAA for large text
    aaaNormal: ratio >= 7    // WCAG AAA for normal text
  };
}

/**
 * Calculate relative luminance of a color
 * @private
 */
function getRelativeLuminance(color) {
  const rgb = parseColor(color);
  const [r, g, b] = rgb.map(val => {
    const channel = val / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Parse color to RGB array
 * @private
 */
function parseColor(color) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = color;
  const computed = ctx.fillStyle;

  // Parse rgb(r, g, b) or rgba(r, g, b, a)
  const match = computed.match(/\d+/g);
  if (match) {
    return match.slice(0, 3).map(Number);
  }

  return [0, 0, 0]; // Fallback
}

/**
 * Add keyboard shortcuts with accessibility
 *
 * @param {Object} shortcuts - Map of key combinations to handlers
 * @returns {Function} Function to remove all shortcuts
 *
 * @example
 * const removeShortcuts = addKeyboardShortcuts({
 *   'Escape': () => closeModal(),
 *   'Control+s': (e) => { e.preventDefault(); save(); }
 * });
 */
export function addKeyboardShortcuts(shortcuts) {
  function handleKeyPress(e) {
    const key = e.key;
    const combo = [
      e.ctrlKey && 'Control',
      e.altKey && 'Alt',
      e.shiftKey && 'Shift',
      key
    ].filter(Boolean).join('+');

    if (shortcuts[key]) {
      shortcuts[key](e);
    } else if (shortcuts[combo]) {
      shortcuts[combo](e);
    }
  }

  document.addEventListener('keydown', handleKeyPress);

  return () => {
    document.removeEventListener('keydown', handleKeyPress);
  };
}

/**
 * Ensure proper heading hierarchy
 * Warns if heading levels are skipped (e.g., h1 -> h3)
 *
 * @param {HTMLElement} container - Container to check (default: document.body)
 * @returns {Array} Array of issues found
 */
export function validateHeadingHierarchy(container = document.body) {
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const issues = [];
  let previousLevel = 0;

  headings.forEach((heading, index) => {
    const currentLevel = parseInt(heading.tagName[1]);

    if (index === 0 && currentLevel !== 1) {
      issues.push({
        element: heading,
        message: `First heading should be h1, found ${heading.tagName}`,
        severity: 'warning'
      });
    }

    if (currentLevel > previousLevel + 1) {
      issues.push({
        element: heading,
        message: `Heading level skipped from h${previousLevel} to ${heading.tagName}`,
        severity: 'warning'
      });
    }

    previousLevel = currentLevel;
  });

  return issues;
}

/**
 * Add accessible tooltip
 *
 * @param {HTMLElement} element - Element to add tooltip to
 * @param {string} text - Tooltip text
 * @param {string} position - Position ('top', 'bottom', 'left', 'right')
 */
export function addAccessibleTooltip(element, text, position = 'top') {
  const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  element.setAttribute('aria-describedby', tooltipId);
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');

  const tooltip = document.createElement('div');
  tooltip.id = tooltipId;
  tooltip.className = 'accessible-tooltip';
  tooltip.textContent = text;
  tooltip.setAttribute('role', 'tooltip');
  tooltip.style.cssText = `
    position: absolute;
    background: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.875rem;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 1000;
  `;

  document.body.appendChild(tooltip);

  function showTooltip() {
    const rect = element.getBoundingClientRect();
    tooltip.style.opacity = '1';

    switch (position) {
      case 'top':
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
        tooltip.style.transform = 'translateX(-50%)';
        break;
      case 'bottom':
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.bottom + 8}px`;
        tooltip.style.transform = 'translateX(-50%)';
        break;
      case 'left':
        tooltip.style.left = `${rect.left - tooltip.offsetWidth - 8}px`;
        tooltip.style.top = `${rect.top + rect.height / 2}px`;
        tooltip.style.transform = 'translateY(-50%)';
        break;
      case 'right':
        tooltip.style.left = `${rect.right + 8}px`;
        tooltip.style.top = `${rect.top + rect.height / 2}px`;
        tooltip.style.transform = 'translateY(-50%)';
        break;
    }
  }

  function hideTooltip() {
    tooltip.style.opacity = '0';
  }

  element.addEventListener('mouseenter', showTooltip);
  element.addEventListener('mouseleave', hideTooltip);
  element.addEventListener('focus', showTooltip);
  element.addEventListener('blur', hideTooltip);
}

/**
 * Ensure all images have alt text
 * Logs warnings for images without alt attributes
 *
 * @param {HTMLElement} container - Container to check (default: document.body)
 * @returns {Array} Array of images without alt text
 */
export function validateImageAltText(container = document.body) {
  const images = container.querySelectorAll('img');
  const issues = [];

  images.forEach(img => {
    if (!img.hasAttribute('alt')) {
      issues.push({
        element: img,
        message: 'Image missing alt attribute',
        severity: 'error'
      });
      console.warn('Image missing alt text:', img.src);
    } else if (img.alt.trim() === '' && !img.hasAttribute('role')) {
      // Empty alt is OK for decorative images, but they should have role="presentation"
      console.info('Image has empty alt text (consider adding role="presentation" if decorative):', img.src);
    }
  });

  return issues;
}

/**
 * Check if element is keyboard accessible
 *
 * @param {HTMLElement} element - Element to check
 * @returns {Object} Accessibility check results
 */
export function checkKeyboardAccessibility(element) {
  const isInteractive = element.matches('button, a, input, textarea, select, [tabindex]');
  const hasTabIndex = element.hasAttribute('tabindex');
  const tabIndexValue = element.getAttribute('tabindex');
  const hasFocusVisible = element.matches(':focus-visible');

  return {
    isInteractive,
    isKeyboardAccessible: isInteractive || (hasTabIndex && tabIndexValue !== '-1'),
    tabIndex: tabIndexValue,
    recommendations: []
  };
}

/**
 * Initialize accessibility features
 * Call this once when your application loads
 *
 * @param {Object} options - Configuration options
 */
export function initAccessibility(options = {}) {
  const defaults = {
    skipLink: true,
    skipLinkTarget: 'main-content',
    announceRouteChanges: true,
    validateHeadings: true,
    validateImages: true,
    focusManagement: true
  };

  const config = { ...defaults, ...options };

  // Add skip link
  if (config.skipLink) {
    addSkipLink(config.skipLinkTarget);
  }

  // Validate headings
  if (config.validateHeadings) {
    const headingIssues = validateHeadingHierarchy();
    if (headingIssues.length > 0) {
      console.warn('Heading hierarchy issues:', headingIssues);
    }
  }

  // Validate images
  if (config.validateImages) {
    const imageIssues = validateImageAltText();
    if (imageIssues.length > 0) {
      console.warn('Image alt text issues:', imageIssues);
    }
  }

  // Announce route changes to screen readers
  if (config.announceRouteChanges) {
    window.addEventListener('hashchange', () => {
      const view = window.location.hash.slice(1) || 'roadmap';
      announceToScreenReader(`Navigated to ${view} view`);
    });
  }

  // Focus management
  if (config.focusManagement) {
    // Ensure modals trap focus
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.hasAttribute('role')) {
            const role = node.getAttribute('role');
            if (role === 'dialog' || role === 'alertdialog') {
              trapFocus(node);
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  console.log('[Accessibility] Initialized with config:', config);
}

/**
 * Default export with all utilities
 */
export default {
  announceToScreenReader,
  trapFocus,
  addSkipLink,
  checkColorContrast,
  addKeyboardShortcuts,
  validateHeadingHierarchy,
  addAccessibleTooltip,
  validateImageAltText,
  checkKeyboardAccessibility,
  initAccessibility
};
