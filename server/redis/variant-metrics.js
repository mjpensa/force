/**
 * Variant Performance Metrics using Redis Sorted Sets
 *
 * Gap 05: Tracks and ranks prompt variants by performance score.
 * Uses Redis Sorted Sets for efficient ranking queries.
 *
 * Features:
 * - Record variant scores
 * - Get top/bottom performing variants
 * - Track performance trends
 * - Compare variants head-to-head
 *
 * Usage:
 *   import { variantMetrics } from './variant-metrics.js';
 *
 *   await variantMetrics.recordScore('roadmap-v1', 4.5, 'Roadmap');
 *   const top = await variantMetrics.getTopVariants(10);
 */

import { getRedisClient } from './client.js';

const VARIANT_KEYS = {
  scores: 'force:variants:scores',           // Total score (sorted set)
  counts: 'force:variants:counts',           // Sample count (sorted set)
  recentScores: 'force:variants:recent',     // Recent scores (sorted set by timestamp)
  byType: (type) => `force:variants:type:${type}`  // Per content type scores
};

/**
 * Variant Performance Tracker using Redis Sorted Sets
 */
export class VariantMetricsTracker {
  constructor() {
    this.client = null;
  }

  async _getClient() {
    if (!this.client) {
      this.client = await getRedisClient();
    }
    return this.client;
  }

  /**
   * Record a variant performance score
   *
   * @param {string} variantId - Variant identifier
   * @param {number} score - Quality score (0-5)
   * @param {string} contentType - Content type (optional)
   */
  async recordScore(variantId, score, contentType = null) {
    const client = await this._getClient();
    if (!client) return;

    try {
      const pipeline = client.pipeline();

      // Increment total score
      pipeline.zincrby(VARIANT_KEYS.scores, score, variantId);

      // Increment count
      pipeline.zincrby(VARIANT_KEYS.counts, 1, variantId);

      // Track by content type if provided
      if (contentType) {
        pipeline.zincrby(VARIANT_KEYS.byType(contentType), score, variantId);
      }

      // Add to recent scores (time-based sorted set)
      const timestamp = Date.now();
      pipeline.zadd(VARIANT_KEYS.recentScores, timestamp, `${variantId}:${timestamp}:${score}`);

      // Trim recent scores to last 1000 entries
      pipeline.zremrangebyrank(VARIANT_KEYS.recentScores, 0, -1001);

      await pipeline.exec();
    } catch (error) {
      console.error('[VariantMetrics] Error recording score:', error.message);
    }
  }

  /**
   * Get top performing variants
   *
   * @param {number} limit - Number of variants to return
   * @param {string} contentType - Filter by content type (optional)
   * @returns {Promise<Array>} Top variants with scores
   */
  async getTopVariants(limit = 10, contentType = null) {
    const client = await this._getClient();
    if (!client) return [];

    try {
      const key = contentType ? VARIANT_KEYS.byType(contentType) : VARIANT_KEYS.scores;

      // Get top variants by score (descending)
      const results = await client.zrevrange(key, 0, limit - 1, 'WITHSCORES');

      // Pair up results (zrevrange returns [member, score, member, score, ...])
      const variants = [];
      for (let i = 0; i < results.length; i += 2) {
        const variantId = results[i];
        const totalScore = parseFloat(results[i + 1]);

        // Get count to calculate average
        const count = await client.zscore(VARIANT_KEYS.counts, variantId);
        const countNum = parseInt(count) || 0;

        variants.push({
          variantId,
          totalScore,
          count: countNum,
          avgScore: countNum > 0 ? (totalScore / countNum).toFixed(2) : '0'
        });
      }

      return variants;
    } catch (error) {
      console.error('[VariantMetrics] Error getting top variants:', error.message);
      return [];
    }
  }

  /**
   * Get worst performing variants (candidates for retirement)
   *
   * @param {number} limit - Number of variants to return
   * @param {number} minSamples - Minimum samples required
   * @returns {Promise<Array>} Bottom variants
   */
  async getUnderperformers(limit = 10, minSamples = 10) {
    const client = await this._getClient();
    if (!client) return [];

    try {
      // Get all variants with counts
      const allVariants = await this.getTopVariants(100);

      // Filter by minimum samples and sort by average (ascending)
      return allVariants
        .filter(v => v.count >= minSamples)
        .sort((a, b) => parseFloat(a.avgScore) - parseFloat(b.avgScore))
        .slice(0, limit);
    } catch (error) {
      console.error('[VariantMetrics] Error getting underperformers:', error.message);
      return [];
    }
  }

  /**
   * Get recent performance trend for a variant
   *
   * @param {string} variantId - Variant to analyze
   * @param {number} windowMs - Time window in milliseconds (default: 1 hour)
   * @returns {Promise<Object>} Trend analysis
   */
  async getRecentTrend(variantId, windowMs = 3600000) {
    const client = await this._getClient();
    if (!client) return null;

    try {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get recent scores for this variant
      const recentAll = await client.zrangebyscore(
        VARIANT_KEYS.recentScores,
        windowStart,
        now
      );

      // Filter for this variant
      const variantScores = recentAll
        .filter(entry => entry.startsWith(`${variantId}:`))
        .map(entry => {
          const parts = entry.split(':');
          return {
            timestamp: parseInt(parts[1]),
            score: parseFloat(parts[2])
          };
        });

      if (variantScores.length < 2) {
        return { trend: 'insufficient_data', samples: variantScores.length };
      }

      // Calculate trend
      const avgScore = variantScores.reduce((sum, s) => sum + s.score, 0) / variantScores.length;
      const firstHalf = variantScores.slice(0, Math.floor(variantScores.length / 2));
      const secondHalf = variantScores.slice(Math.floor(variantScores.length / 2));

      const firstAvg = firstHalf.reduce((sum, s) => sum + s.score, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, s) => sum + s.score, 0) / secondHalf.length;

      const trendDirection = secondAvg > firstAvg ? 'improving' :
                            secondAvg < firstAvg ? 'declining' : 'stable';

      return {
        variantId,
        samples: variantScores.length,
        avgScore: avgScore.toFixed(2),
        trend: trendDirection,
        change: firstAvg > 0 ? (((secondAvg - firstAvg) / firstAvg) * 100).toFixed(1) + '%' : '0%'
      };
    } catch (error) {
      console.error('[VariantMetrics] Error getting trend:', error.message);
      return null;
    }
  }

  /**
   * Get performance comparison between variants
   *
   * @param {string} variantA - First variant
   * @param {string} variantB - Second variant
   * @returns {Promise<Object>} Comparison result
   */
  async compareVariants(variantA, variantB) {
    const client = await this._getClient();
    if (!client) return null;

    try {
      const [scoreA, countA, scoreB, countB] = await Promise.all([
        client.zscore(VARIANT_KEYS.scores, variantA),
        client.zscore(VARIANT_KEYS.counts, variantA),
        client.zscore(VARIANT_KEYS.scores, variantB),
        client.zscore(VARIANT_KEYS.counts, variantB)
      ]);

      const countANum = parseInt(countA) || 0;
      const countBNum = parseInt(countB) || 0;
      const avgA = countANum ? (parseFloat(scoreA) / countANum) : 0;
      const avgB = countBNum ? (parseFloat(scoreB) / countBNum) : 0;

      return {
        variantA: {
          id: variantA,
          totalScore: parseFloat(scoreA) || 0,
          count: countANum,
          avgScore: avgA.toFixed(2)
        },
        variantB: {
          id: variantB,
          totalScore: parseFloat(scoreB) || 0,
          count: countBNum,
          avgScore: avgB.toFixed(2)
        },
        winner: avgA > avgB ? variantA : avgB > avgA ? variantB : 'tie',
        difference: Math.abs(avgA - avgB).toFixed(2),
        percentDiff: avgB ? (((avgA - avgB) / avgB) * 100).toFixed(1) + '%' : 'N/A'
      };
    } catch (error) {
      console.error('[VariantMetrics] Error comparing variants:', error.message);
      return null;
    }
  }

  /**
   * Get variant rank
   *
   * @param {string} variantId - Variant to check
   * @returns {Promise<number|null>} Rank (0-based) or null
   */
  async getVariantRank(variantId) {
    const client = await this._getClient();
    if (!client) return null;

    try {
      // Get reverse rank (0 = highest score)
      const rank = await client.zrevrank(VARIANT_KEYS.scores, variantId);
      return rank !== null ? rank + 1 : null; // 1-based rank
    } catch (error) {
      console.error('[VariantMetrics] Error getting rank:', error.message);
      return null;
    }
  }

  /**
   * Clear all variant metrics
   */
  async clearAll() {
    const client = await this._getClient();
    if (!client) return;

    try {
      const keys = await client.keys('force:variants:*');
      if (keys.length > 0) {
        await client.del(...keys);
      }
      console.log(`[VariantMetrics] Cleared ${keys.length} keys`);
    } catch (error) {
      console.error('[VariantMetrics] Error clearing metrics:', error.message);
    }
  }

  /**
   * Get metrics summary
   */
  async getSummary() {
    const client = await this._getClient();
    if (!client) return null;

    try {
      const totalVariants = await client.zcard(VARIANT_KEYS.scores);
      const recentCount = await client.zcard(VARIANT_KEYS.recentScores);
      const top = await this.getTopVariants(1);

      return {
        totalVariants,
        recentScores: recentCount,
        topVariant: top[0] || null
      };
    } catch (error) {
      console.error('[VariantMetrics] Error getting summary:', error.message);
      return null;
    }
  }
}

export const variantMetrics = new VariantMetricsTracker();

export default VariantMetricsTracker;
