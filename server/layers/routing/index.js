/**
 * Model Routing Layer - PROMPT ML Layer 5
 *
 * Unified export for all routing components:
 * - Complexity Classifier
 * - Model Router
 * - Fallback Manager
 *
 * Based on PROMPT ML design specification.
 */

// Classifier exports
export {
  ComplexityClassifier,
  ComplexityLevel,
  TaskType,
  createClassifier,
  getClassifier,
  classifyComplexity,
  analyzeComplexity
} from './classifier.js';

// Router exports
export {
  ModelRouter,
  ModelTier,
  createRouter,
  getRouter,
  routeToModel,
  routeRequest
} from './router.js';

// Fallback exports
export {
  FallbackManager,
  ErrorType,
  FallbackAction,
  createFallbackManager,
  getFallbackManager,
  getFallback
} from './fallback.js';

// Import for internal use
import { getRouter } from './router.js';
import { getFallbackManager } from './fallback.js';

/**
 * Convenience function for complete routing with fallback support
 *
 * @param {string} content - Content to process
 * @param {string} taskType - Task type
 * @param {Object} options - Options
 * @returns {Object} Complete routing decision
 */
export function routeWithFallback(content, taskType, options = {}) {
  const router = getRouter();
  const fallbackManager = getFallbackManager();

  const routingDecision = router.route(content, taskType, options);

  return {
    ...routingDecision,
    fallbackManager,
    // Helper to handle errors
    handleError: (requestId, error) => {
      return fallbackManager.getFallback(requestId, error, routingDecision.modelId);
    },
    // Helper to record success
    recordSuccess: (requestId) => {
      fallbackManager.recordSuccess(requestId);
    }
  };
}

/**
 * Initialize the routing layer with custom configuration
 *
 * @param {Object} config - Configuration
 * @param {Object} config.router - Router configuration
 * @param {Object} config.fallback - Fallback configuration
 */
export function initializeRoutingLayer(config = {}) {
  // Initialize with config (singletons will pick up config on first call)
  if (config.router) {
    getRouter(config.router);
  } else {
    getRouter();
  }

  if (config.fallback) {
    getFallbackManager(config.fallback);
  } else {
    getFallbackManager();
  }
}

export default {
  // Classifier
  ComplexityClassifier,
  ComplexityLevel,
  TaskType,
  createClassifier,
  getClassifier,
  classifyComplexity,
  analyzeComplexity,

  // Router
  ModelRouter,
  ModelTier,
  createRouter,
  getRouter,
  routeToModel,
  routeRequest,

  // Fallback
  FallbackManager,
  ErrorType,
  FallbackAction,
  createFallbackManager,
  getFallbackManager,
  getFallback,

  // Convenience
  routeWithFallback,
  initializeRoutingLayer
};
