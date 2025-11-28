// Module-level state for announcement queue (prevents race conditions)
let announcementQueue = [];
let announcementTimeoutId = null;
let isAnnouncing = false;

/**
 * Announce message to screen readers using ARIA live region
 * Uses a queue system to prevent overlapping announcements
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
export function announceToScreenReader(message, priority = 'polite') {
  let liveRegion = document.getElementById('aria-live-region');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-region';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(liveRegion);
  }

  // Queue the announcement
  announcementQueue.push({ message, priority });

  // Process queue if not already processing
  if (!isAnnouncing) {
    processAnnouncementQueue(liveRegion);
  }
}

/**
 * Process the announcement queue sequentially
 * @param {HTMLElement} liveRegion - The ARIA live region element
 */
function processAnnouncementQueue(liveRegion) {
  if (announcementQueue.length === 0) {
    isAnnouncing = false;
    return;
  }

  isAnnouncing = true;
  const { message, priority } = announcementQueue.shift();

  // Clear any pending timeout
  if (announcementTimeoutId) {
    clearTimeout(announcementTimeoutId);
  }

  // Update priority and clear content
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.textContent = '';

  // Set message after brief delay (allows screen reader to notice the change)
  announcementTimeoutId = setTimeout(() => {
    liveRegion.textContent = message;

    // Process next announcement after giving screen reader time to read
    announcementTimeoutId = setTimeout(() => {
      processAnnouncementQueue(liveRegion);
    }, 500); // Wait for screen reader to finish before next announcement
  }, 100);
}

/**
 * Clear all pending announcements (call on cleanup)
 */
export function clearAnnouncements() {
  if (announcementTimeoutId) {
    clearTimeout(announcementTimeoutId);
    announcementTimeoutId = null;
  }
  announcementQueue = [];
  isAnnouncing = false;
}
export function trapFocus(container) {
  const focusable = container.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])');
  const first = focusable[0], last = focusable[focusable.length - 1];
  function handleTab(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  container.addEventListener('keydown', handleTab);
  if (first) first.focus();
  return () => container.removeEventListener('keydown', handleTab);
}
export function addSkipLink(targetId, label = 'Skip to main content') {
  if (document.getElementById('skip-link')) return;
  const link = document.createElement('a');
  link.id = 'skip-link';
  link.href = `#${targetId}`;
  link.textContent = label;
  link.style.cssText = 'position:absolute;top:-40px;left:0;background:#3b82f6;color:white;padding:8px 16px;text-decoration:none;border-radius:0 0 4px 0;z-index:10000;transition:top 0.2s;';
  link.addEventListener('focus', () => { link.style.top = '0'; });
  link.addEventListener('blur', () => { link.style.top = '-40px'; });
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) { target.setAttribute('tabindex', '-1'); target.focus(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
  document.body.insertBefore(link, document.body.firstChild);
}
export function addKeyboardShortcuts(shortcuts) {
  function handleKey(e) {
    const combo = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.key].filter(Boolean).join('+');
    if (shortcuts[e.key]) shortcuts[e.key](e);
    else if (shortcuts[combo]) shortcuts[combo](e);
  }
  document.addEventListener('keydown', handleKey);
  return () => document.removeEventListener('keydown', handleKey);
}

// Module-level references for cleanup (prevents memory leaks)
let focusTrapObserver = null;
let hashChangeHandler = null;

/**
 * Initialize focus trap observer for dialogs
 * Stores reference for cleanup
 */
function initFocusTrapObserver() {
  if (focusTrapObserver) {
    return; // Already initialized
  }

  focusTrapObserver = new MutationObserver((mutations) => {
    mutations.forEach((m) => m.addedNodes.forEach((node) => {
      if (node.nodeType === 1 &&
          (node.getAttribute('role') === 'dialog' ||
           node.getAttribute('role') === 'alertdialog')) {
        trapFocus(node);
      }
    }));
  });

  focusTrapObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Destroy focus trap observer
 * Call this on cleanup to prevent memory leaks
 */
export function destroyFocusTrapObserver() {
  if (focusTrapObserver) {
    focusTrapObserver.disconnect();
    focusTrapObserver = null;
  }
}

/**
 * Destroy hashchange listener
 * Call this on cleanup to prevent memory leaks
 */
export function destroyHashChangeHandler() {
  if (hashChangeHandler) {
    window.removeEventListener('hashchange', hashChangeHandler);
    hashChangeHandler = null;
  }
}

/**
 * Cleanup all accessibility features
 * Call this before page unload or component destruction
 */
export function destroyAccessibility() {
  destroyFocusTrapObserver();
  destroyHashChangeHandler();
  clearAnnouncements();
}

export function initAccessibility(options = {}) {
  const config = { skipLink: true, skipLinkTarget: 'main-content', announceRouteChanges: true, focusManagement: true, ...options };
  if (config.skipLink) addSkipLink(config.skipLinkTarget);
  if (config.announceRouteChanges) {
    // Store reference for cleanup
    hashChangeHandler = () => {
      announceToScreenReader(`Navigated to ${window.location.hash.slice(1) || 'roadmap'} view`);
    };
    window.addEventListener('hashchange', hashChangeHandler);
  }
  if (config.focusManagement) {
    initFocusTrapObserver();
  }

  // Return cleanup function
  return destroyAccessibility;
}
export default { announceToScreenReader, clearAnnouncements, trapFocus, addSkipLink, addKeyboardShortcuts, initAccessibility, destroyAccessibility, destroyFocusTrapObserver, destroyHashChangeHandler };
