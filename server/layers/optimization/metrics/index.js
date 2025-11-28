/**
 * Metrics Module - Auto-Improving Prompts Phase 1
 *
 * Exports all metrics collection functionality for prompt optimization.
 */

// Schema exports
export {
  MetricsSchema,
  ContentTypes,
  FeedbackType,
  createDefaultMetric,
  validateMetric
} from './schema.js';

// Storage exports
export {
  InMemoryStorage,
  FileStorage,
  createStorage
} from './storage.js';

// Collector exports
export {
  MetricsCollector,
  getMetricsCollector,
  resetMetricsCollector
} from './collector.js';

// Default export
export { getMetricsCollector as default } from './collector.js';
