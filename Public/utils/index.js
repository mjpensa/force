/**
 * Utils Index
 *
 * Re-exports all utility functions for backwards compatibility.
 * New code should prefer importing from specific modules:
 *
 * - utils/fetch.js - HTTP fetch utilities
 * - utils/dom.js - DOM manipulation utilities
 * - utils/date.js - Date calculation utilities
 * - utils/analysis-builders.js - Analysis HTML builders
 * - utils/performance.js - Performance measurement
 * - utils/assets.js - Asset loading
 */

// Fetch utilities
export { fetchJSON } from './fetch.js';

// DOM utilities
export {
  safeGetElement,
  safeQuerySelector,
  isSafeUrl,
  createModal
} from './dom.js';

// Date utilities
export {
  getWeek,
  findTodayColumnPosition
} from './date.js';

// Analysis builders
export {
  buildAnalysisSection,
  buildAnalysisList
} from './analysis-builders.js';

// Performance utilities
export {
  PerformanceTimer,
  measureAsync
} from './performance.js';

// Asset utilities
export { loadFooterSVG } from './assets.js';
