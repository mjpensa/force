/**
 * Centralized Configuration for AI Roadmap Generator
 * Phase 2 Enhancement: Consolidates magic strings and numbers for better maintainability
 * Phase 5 Enhancement: Added drag-to-edit color configurations
 */

export const CONFIG = {
  // Color scheme for the chart
  COLORS: {
    // Today line indicator
    TODAY_LINE: '#BA3930',

    // Task hover state
    TASK_HOVER: '#354259',

    // Swimlane background
    SWIMLANE_BG: '#0c2340',

    // Grid and borders
    GRID_BORDER: '#0D0D0D',

    // Phase 5: Drag-to-edit visual feedback
    DRAG_HOVER: 'rgba(186, 57, 48, 0.1)',
    PRIMARY: '#BA3930',

    // Available bar colors (in priority order)
    BAR_COLORS: {
      PRIORITY_RED: 'priority-red',
      MEDIUM_RED: 'medium-red',
      MID_GREY: 'mid-grey',
      LIGHT_GREY: 'light-grey',
      WHITE: 'white',
      DARK_BLUE: 'dark-blue'
    }
  },

  // Size constants
  SIZES: {
    // Chart element sizes
    BAR_HEIGHT: 20,
    POINT_RADIUS: 5,
    LOGO_HEIGHT: 70,

    // File upload limits (in MB)
    MAX_FILE_SIZE_MB: 10,
    MAX_TOTAL_SIZE_MB: 50,
    MAX_FILE_COUNT: 10,

    // Text limits
    MAX_QUESTION_LENGTH: 1000
  },

  // API configuration
  API: {
    // Timeout settings (in milliseconds)
    TIMEOUT_MS: 120000, // 2 minutes
    RETRY_COUNT: 3,

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 100,
    STRICT_RATE_LIMIT_MAX_REQUESTS: 20,

    // Session/Chart expiration
    SESSION_EXPIRATION_MS: 60 * 60 * 1000, // 1 hour
    CLEANUP_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes
  },

  // File type validation
  FILES: {
    SUPPORTED_MIMES: [
      'text/markdown',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream' // Some browsers send .md files with this MIME type
    ],
    SUPPORTED_EXTENSIONS: ['md', 'txt', 'docx']
  },

  // UI text constants
  UI: {
    ERROR_MESSAGES: {
      NO_CHART_DATA: 'No chart data found. Please close this tab and try generating the chart again.',
      CHART_NOT_FOUND: 'Chart Not Found',
      CHART_EXPIRED: 'This chart may have expired or the link is invalid.',
      CHART_AVAILABILITY: 'Charts are available for 30 days after generation.',
      SESSION_NOT_FOUND: 'Session not found or expired. Please regenerate the chart.',
      INVALID_CHART_ID: 'Invalid chart ID format',
      FILE_TOO_LARGE: 'File too large. Maximum size is 10MB per file.',
      TOO_MANY_FILES: 'Too many files. Maximum is 10 files per upload.',
      FIELD_TOO_LARGE: 'Field value too large. Maximum total size is 50MB.',
      RATE_LIMIT_EXCEEDED: 'Too many requests from this IP, please try again later.',
      STRICT_RATE_LIMIT_EXCEEDED: 'Too many chart generation requests. Please try again in 15 minutes.'
    },

    LOADING_MESSAGES: {
      GENERATING: 'Generating...',
      LOADING: 'Loading...'
    }
  },

  // Regular expressions for validation
  PATTERNS: {
    CHART_ID: /^[a-f0-9]{32}$/i,

    // Prompt injection patterns (for security)
    // IMPORTANT: These patterns must be kept in sync with server/config.js
    // Any changes in server config should be reflected here
    INJECTION_PATTERNS: [
      { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, replacement: '[REDACTED]' },
      { pattern: /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, replacement: '[REDACTED]' },
      { pattern: /forget\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, replacement: '[REDACTED]' },
      { pattern: /system\s*:/gi, replacement: '[REDACTED]' },
      { pattern: /\[SYSTEM\]/gi, replacement: '[REDACTED]' },
      { pattern: /\{SYSTEM\}/gi, replacement: '[REDACTED]' },
      { pattern: /new\s+instructions?\s*:/gi, replacement: '[REDACTED]' },
      { pattern: /override\s+instructions?/gi, replacement: '[REDACTED]' },
      { pattern: /you\s+are\s+now\s+/gi, replacement: '[REDACTED]' },
      { pattern: /act\s+as\s+if\s+you\s+are\s+/gi, replacement: '[REDACTED]' },
      { pattern: /pretend\s+(you\s+are|to\s+be)\s+/gi, replacement: '[REDACTED]' }
    ]
  }
};

// Freeze the config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.COLORS);
Object.freeze(CONFIG.COLORS.BAR_COLORS);
Object.freeze(CONFIG.SIZES);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.FILES);
Object.freeze(CONFIG.UI);
Object.freeze(CONFIG.UI.ERROR_MESSAGES);
Object.freeze(CONFIG.UI.LOADING_MESSAGES);
Object.freeze(CONFIG.PATTERNS);
