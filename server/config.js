import 'dotenv/config';
function validateEnvironment() {
  if (process.env.NODE_ENV === 'test') {
    if (!process.env.API_KEY) {
      process.env.API_KEY = 'test_api_key_for_testing';
    }
    return;
  }
  const required = ['API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    missing.forEach(key => console.error(`  ${key}=your_value_here`));
    process.exit(1);
  }
  if (process.env.API_KEY && process.env.API_KEY.length < 10) {
  }
}
validateEnvironment();
export const CONFIG = {
  SERVER: {
    PORT: parseInt(process.env.PORT, 10) || 3000,
    TRUST_PROXY_HOPS: 1 // Railway uses single proxy layer
  },
  API: {
    GEMINI_MODEL: 'gemini-2.5-flash-preview-09-2025',
    BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
    RETRY_COUNT: 3,
    RETRY_BASE_DELAY_MS: 1000, // 1 second base delay
    MAX_OUTPUT_TOKENS_CHART: 65536,
    MAX_OUTPUT_TOKENS_ANALYSIS: 65536,
    MAX_OUTPUT_TOKENS_QA: 8192,
    THINKING_BUDGET_ANALYSIS: 24576, // Maximum thinking tokens for task analysis (complex reasoning)
    TEMPERATURE_STRUCTURED: 0,
    TEMPERATURE_QA: 0.1,
    TOP_P: 0.1,
    TOP_K: 1,
    SEED: 42 // Fixed seed for deterministic output - same inputs produce same outputs
  },
  FILES: {
    MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB per file
    MAX_COUNT: 500, // Increased to support folder uploads with many files
    MAX_FIELD_SIZE_BYTES: 200 * 1024 * 1024, // 200MB total - increased for folder uploads
    ALLOWED_MIMES: [
      'text/markdown',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', // Some browsers send .md files with this
      'application/pdf'
    ],
    ALLOWED_EXTENSIONS: ['md', 'txt', 'docx', 'pdf']
  },
  TIMEOUTS: {
    REQUEST_MS: 120000, // 2 minutes
    RESPONSE_MS: 120000
  },
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    STRICT_MAX_REQUESTS: 20 // For resource-intensive endpoints
  },
  CACHE: {
    STATIC_ASSETS_MAX_AGE: 86400 // 1 day in seconds
  },
  SECURITY: {
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
    ],
    PATTERNS: {
      CHART_ID: /^[a-f0-9]{32}$/i,
      JOB_ID: /^[a-f0-9]{32}$/i,
      SESSION_ID: /^[a-f0-9]{32}$/i
    }
  },
  VALIDATION: {
    MAX_QUESTION_LENGTH: 1000
  },
  ERRORS: {
    MISSING_TASK_NAME: 'Missing taskName or entity',
    MISSING_SESSION_ID: 'Missing sessionId',
    SESSION_NOT_FOUND: 'Session not found or expired. Please regenerate the chart.',
    QUESTION_REQUIRED: 'Question is required and must be non-empty',
    ENTITY_REQUIRED: 'Entity is required',
    TASK_NAME_REQUIRED: 'Task name is required',
    QUESTION_TOO_LONG: 'Question too long (max 1000 characters)',
    INVALID_CHART_ID: 'Invalid chart ID format',
    CHART_NOT_FOUND: 'Chart not found or expired. Charts are available for 30 days after generation.',
    INVALID_JOB_ID: 'Invalid job ID format',
    JOB_NOT_FOUND: 'Job not found or expired. Jobs are available for 1 hour.',
    FILE_TOO_LARGE: 'File too large. Maximum size is 10MB per file.',
    TOO_MANY_FILES: 'Too many files. Maximum is 500 files per upload.',
    FIELD_TOO_LARGE: 'Field value too large. Maximum total size is 200MB.',
    RATE_LIMIT_EXCEEDED: 'Too many requests from this IP, please try again later.',
    STRICT_RATE_LIMIT_EXCEEDED: 'Too many chart generation requests. Please try again in 15 minutes.',
    INVALID_FILE_EXTENSION: (ext) => `Invalid file extension: .${ext}. Only .md, .txt, and .docx files are allowed.`,
    INVALID_FILE_TYPE: (type) => `Invalid file type: ${type}. Only .md, .txt, and .docx files are allowed.`
  }
};
Object.freeze(CONFIG);
Object.freeze(CONFIG.SERVER);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.FILES);
Object.freeze(CONFIG.TIMEOUTS);
Object.freeze(CONFIG.RATE_LIMIT);
Object.freeze(CONFIG.CACHE);
Object.freeze(CONFIG.SECURITY);
Object.freeze(CONFIG.SECURITY.PATTERNS);
Object.freeze(CONFIG.VALIDATION);
Object.freeze(CONFIG.ERRORS);
export function getGeminiApiUrl() {
  return `${CONFIG.API.BASE_URL}/models/${CONFIG.API.GEMINI_MODEL}:generateContent?key=${process.env.API_KEY}`;
}
