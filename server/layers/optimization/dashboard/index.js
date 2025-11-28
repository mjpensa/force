/**
 * Dashboard Module - Phase 5 of Auto-Improving Prompts
 *
 * Provides visualization and insights for the auto-optimization system.
 *
 * @module dashboard
 */

export {
  DashboardAggregator,
  TimePeriod,
  getDashboardAggregator,
  resetDashboardAggregator
} from './aggregator.js';

import { getDashboardAggregator, TimePeriod } from './aggregator.js';

/**
 * Get full dashboard data
 *
 * @param {Object} options - Dashboard options
 * @returns {Object} Dashboard data
 */
export function getDashboardData(options = {}) {
  const aggregator = getDashboardAggregator();
  return aggregator.getDashboardData(options);
}

/**
 * Get dashboard summary only
 *
 * @returns {Object} Summary data
 */
export function getDashboardSummary() {
  const data = getDashboardData();
  return {
    summary: data.summary,
    timestamp: data.timestamp
  };
}

/**
 * Get active insights
 *
 * @returns {Array} Active insights
 */
export function getInsights() {
  const data = getDashboardData();
  return data.insights;
}

/**
 * Get recommendations
 *
 * @returns {Array} Recommendations
 */
export function getRecommendations() {
  const data = getDashboardData();
  return data.recommendations;
}

/**
 * Get variant performance data
 *
 * @param {string} contentType - Optional content type filter
 * @returns {Object} Variant data
 */
export function getVariantPerformance(contentType = null) {
  const data = getDashboardData();

  if (contentType) {
    return {
      [contentType]: data.variants.byContentType[contentType]
    };
  }

  return data.variants;
}

/**
 * Get experiment status
 *
 * @returns {Object} Experiment data
 */
export function getExperimentStatus() {
  const data = getDashboardData();
  return data.experiments;
}

/**
 * Get evolution status
 *
 * @returns {Object} Evolution data
 */
export function getEvolutionStatus() {
  const data = getDashboardData();
  return data.evolution;
}

/**
 * Get trend data
 *
 * @param {string} contentType - Content type
 * @param {string} period - Time period
 * @returns {Object} Trend data
 */
export function getTrends(contentType, period = TimePeriod.LAST_7D) {
  const aggregator = getDashboardAggregator();
  return aggregator.getTrends(contentType, period);
}

/**
 * Clear dashboard cache
 */
export function clearDashboardCache() {
  const aggregator = getDashboardAggregator();
  aggregator.clearCache();
}

export default {
  // Data
  getDashboardData,
  getDashboardSummary,

  // Insights
  getInsights,
  getRecommendations,

  // Components
  getVariantPerformance,
  getExperimentStatus,
  getEvolutionStatus,

  // Trends
  getTrends,
  TimePeriod,

  // Utility
  clearDashboardCache
};
