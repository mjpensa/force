/**
 * Error Handling Utilities
 * Provides comprehensive error handling, retry logic, and error logging
 *
 * @module ErrorHandler
 */

/**
 * Error types for categorization
 */
export const ErrorTypes = {
  NETWORK: 'NetworkError',
  API: 'APIError',
  VALIDATION: 'ValidationError',
  PERMISSION: 'PermissionError',
  NOT_FOUND: 'NotFoundError',
  TIMEOUT: 'TimeoutError',
  UNKNOWN: 'UnknownError'
};

/**
 * Error severity levels
 */
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Error log storage
 * @private
 */
const errorLog = [];

/**
 * Custom Application Error class
 */
export class AppError extends Error {
  constructor(message, type = ErrorTypes.UNKNOWN, severity = ErrorSeverity.MEDIUM, details = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Retry a function with exponential backoff
 *
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of the function
 *
 * @example
 * const data = await retryWithBackoff(
 *   () => fetch('/api/data'),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = (error) => true,
    onRetry = (error, attempt) => {}
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );

      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);
      onRetry(error, attempt + 1);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Fetch with retry logic
 * Automatically retries on network errors and 5xx responses
 *
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 *
 * @example
 * const response = await fetchWithRetry('/api/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ key: 'value' })
 * });
 */
export async function fetchWithRetry(url, options = {}) {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, options);

      // Retry on server errors (5xx) but not client errors (4xx)
      if (response.status >= 500) {
        throw new AppError(
          `Server error: ${response.status}`,
          ErrorTypes.API,
          ErrorSeverity.HIGH,
          { status: response.status, url }
        );
      }

      return response;
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      shouldRetry: (error) => {
        // Retry on network errors and server errors, but not client errors
        return (
          error.type === ErrorTypes.NETWORK ||
          (error.type === ErrorTypes.API && error.details?.status >= 500)
        );
      },
      onRetry: (error, attempt) => {
        logError(error, { retry: attempt });
      }
    }
  );
}

/**
 * Log error to console and storage
 *
 * @param {Error} error - Error to log
 * @param {Object} context - Additional context
 *
 * @example
 * try {
 *   // ... code ...
 * } catch (error) {
 *   logError(error, { component: 'SlidesView', action: 'render' });
 * }
 */
export function logError(error, context = {}) {
  const errorEntry = {
    message: error.message,
    type: error.type || ErrorTypes.UNKNOWN,
    severity: error.severity || ErrorSeverity.MEDIUM,
    timestamp: new Date().toISOString(),
    context,
    stack: error.stack
  };

  // Add to in-memory log
  errorLog.push(errorEntry);

  // Keep only last 100 errors (remove excess from start)
  while (errorLog.length > 100) {
    errorLog.shift();
  }

  // Log to console
  console.error('[Error]', errorEntry);

  // In production, you might want to send this to a logging service
  if (shouldSendToServer(error)) {
    sendErrorToServer(errorEntry).catch(e => {
      console.error('Failed to send error to server:', e);
    });
  }

  // Store in localStorage for debugging
  try {
    localStorage.setItem('app_last_error', JSON.stringify(errorEntry));
  } catch (e) {
    // Ignore localStorage errors
  }
}

/**
 * Determine if error should be sent to server
 * @private
 */
function shouldSendToServer(error) {
  // Only send high and critical severity errors
  return (
    error.severity === ErrorSeverity.HIGH ||
    error.severity === ErrorSeverity.CRITICAL
  );
}

/**
 * Send error to server for logging
 * @private
 */
async function sendErrorToServer(errorEntry) {
  try {
    await fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorEntry)
    });
  } catch (e) {
    // Silently fail - don't want error logging to break the app
  }
}

/**
 * Get error log
 *
 * @param {number} limit - Maximum number of errors to return
 * @returns {Array} Array of error entries
 */
export function getErrorLog(limit = 50) {
  return errorLog.slice(-limit);
}

/**
 * Clear error log
 */
export function clearErrorLog() {
  errorLog.length = 0;
  try {
    localStorage.removeItem('app_last_error');
  } catch (e) {
    // Ignore
  }
}

/**
 * Get user-friendly error message
 *
 * @param {Error} error - Error object
 * @returns {Object} Object with title and message
 *
 * @example
 * const { title, message } = getUserFriendlyError(error);
 * showNotification(title, message);
 */
export function getUserFriendlyError(error) {
  const errorType = error.type || ErrorTypes.UNKNOWN;

  const messages = {
    [ErrorTypes.NETWORK]: {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      action: 'Retry'
    },
    [ErrorTypes.API]: {
      title: 'Server Error',
      message: 'The server encountered an error. Please try again in a few moments.',
      action: 'Retry'
    },
    [ErrorTypes.VALIDATION]: {
      title: 'Invalid Input',
      message: error.message || 'Please check your input and try again.',
      action: 'OK'
    },
    [ErrorTypes.PERMISSION]: {
      title: 'Permission Denied',
      message: 'You don\'t have permission to perform this action.',
      action: 'OK'
    },
    [ErrorTypes.NOT_FOUND]: {
      title: 'Not Found',
      message: 'The requested content could not be found.',
      action: 'Go Back'
    },
    [ErrorTypes.TIMEOUT]: {
      title: 'Request Timeout',
      message: 'The request took too long to complete. Please try again.',
      action: 'Retry'
    },
    [ErrorTypes.UNKNOWN]: {
      title: 'An Error Occurred',
      message: 'Something went wrong. Please try again.',
      action: 'OK'
    }
  };

  return messages[errorType] || messages[ErrorTypes.UNKNOWN];
}

/**
 * Display error notification to user
 *
 * @param {Error} error - Error to display
 * @param {Object} options - Display options
 *
 * @example
 * try {
 *   await loadData();
 * } catch (error) {
 *   showErrorNotification(error, {
 *     onRetry: () => loadData(),
 *     dismissible: true
 *   });
 * }
 */
export function showErrorNotification(error, options = {}) {
  const {
    onRetry = null,
    onDismiss = null,
    dismissible = true,
    duration = 0 // 0 = don't auto-dismiss
  } = options;

  const { title, message, action } = getUserFriendlyError(error);

  // Remove existing error notification
  const existing = document.getElementById('error-notification');
  if (existing) {
    existing.remove();
  }

  // Create notification
  const notification = document.createElement('div');
  notification.id = 'error-notification';
  notification.className = 'error-notification';
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'assertive');

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    background: white;
    border-left: 4px solid var(--color-error, #ef4444);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 1rem;
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
  `;

  let buttonsHTML = '';
  if (action === 'Retry' && onRetry) {
    buttonsHTML = `
      <button class="error-action-btn retry-btn"
              style="background: var(--color-primary, #3b82f6); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-right: 0.5rem;">
        Retry
      </button>
    `;
  }
  if (dismissible) {
    buttonsHTML += `
      <button class="error-action-btn dismiss-btn"
              style="background: transparent; color: var(--color-text-secondary, #6b7280); border: 1px solid currentColor; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
        Dismiss
      </button>
    `;
  }

  notification.innerHTML = `
    <div style="display: flex; align-items: start;">
      <div style="flex: 1;">
        <h4 style="margin: 0 0 0.5rem 0; color: var(--color-error, #ef4444); font-size: 1rem;">
          ${title}
        </h4>
        <p style="margin: 0 0 1rem 0; color: var(--color-text-secondary, #6b7280); font-size: 0.875rem; line-height: 1.5;">
          ${message}
        </p>
        <div style="display: flex; gap: 0.5rem;">
          ${buttonsHTML}
        </div>
      </div>
      ${dismissible ? `
        <button class="close-btn" aria-label="Close notification"
                style="background: transparent; border: none; color: var(--color-text-tertiary, #9ca3af); cursor: pointer; font-size: 1.25rem; padding: 0; margin-left: 1rem;">
          ×
        </button>
      ` : ''}
    </div>
  `;

  // Add styles for animation
  if (!document.getElementById('error-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'error-notification-styles';
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Event handlers
  const retryBtn = notification.querySelector('.retry-btn');
  const dismissBtn = notification.querySelector('.dismiss-btn');
  const closeBtn = notification.querySelector('.close-btn');

  // Guard against multiple calls to removeNotification
  let isRemoving = false;

  function removeNotification() {
    if (isRemoving) return; // Prevent multiple calls
    isRemoving = true;

    notification.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => {
      notification.remove();
      if (onDismiss) onDismiss();
    }, 300);
  }

  if (retryBtn && onRetry) {
    retryBtn.addEventListener('click', () => {
      removeNotification();
      onRetry();
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', removeNotification);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', removeNotification);
  }

  document.body.appendChild(notification);

  // Auto-dismiss if duration is set
  if (duration > 0) {
    setTimeout(removeNotification, duration);
  }
}

/**
 * Wrap async function with error handling
 *
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Error handling options
 * @returns {Function} Wrapped function
 *
 * @example
 * const safeLoadData = withErrorHandling(loadData, {
 *   showNotification: true,
 *   logError: true,
 *   onError: (error) => console.log('Custom handler')
 * });
 */
export function withErrorHandling(fn, options = {}) {
  const {
    showNotification: shouldShowNotification = true,
    logError: shouldLogError = true,
    onError = null,
    context = {}
  } = options;

  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (shouldLogError) {
        logError(error, context);
      }

      if (shouldShowNotification) {
        showErrorNotification(error, {
          onRetry: () => fn(...args),
          dismissible: true
        });
      }

      if (onError) {
        onError(error);
      }

      throw error;
    }
  };
}

/**
 * Create a timeout promise
 * @private
 */
function timeoutPromise(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new AppError(message, ErrorTypes.TIMEOUT, ErrorSeverity.MEDIUM));
    }, ms);
  });
}

/**
 * Execute function with timeout
 *
 * @param {Function} fn - Function to execute
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<any>} Result of function
 *
 * @example
 * const data = await withTimeout(
 *   () => fetch('/api/slow'),
 *   5000
 * );
 */
export async function withTimeout(fn, timeout) {
  return Promise.race([
    fn(),
    timeoutPromise(timeout)
  ]);
}

/**
 * Default export with all utilities
 */
export default {
  ErrorTypes,
  ErrorSeverity,
  AppError,
  retryWithBackoff,
  fetchWithRetry,
  logError,
  getErrorLog,
  clearErrorLog,
  getUserFriendlyError,
  showErrorNotification,
  withErrorHandling,
  withTimeout
};
