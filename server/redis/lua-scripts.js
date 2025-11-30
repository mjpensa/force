/**
 * Lua Script Manager
 *
 * Gap 05: Executes complex multi-step Redis operations atomically.
 *
 * Features:
 * - Pre-defined atomic operations
 * - Script caching via SHA
 * - Automatic script reloading on NOSCRIPT errors
 * - Rate limiting
 * - Atomic variant score updates
 *
 * Usage:
 *   import { luaScripts } from './lua-scripts.js';
 *
 *   await luaScripts.loadScripts();
 *   await luaScripts.updateVariantScore('variant-1', 4.5);
 *   const allowed = await luaScripts.checkRateLimit('user-123', 60, 100);
 */

import { getRedisClient } from './client.js';

// Pre-defined Lua scripts
const SCRIPTS = {
  /**
   * Increment counter and update timestamp atomically
   * KEYS[1] = hash key
   * ARGV[1] = counter field
   * ARGV[2] = timestamp field
   * ARGV[3] = current timestamp
   * Returns: new counter value
   */
  incrementWithTimestamp: `
    local count = redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
    redis.call('HSET', KEYS[1], ARGV[2], ARGV[3])
    return count
  `,

  /**
   * Get and set if greater (for tracking high scores)
   * KEYS[1] = key
   * ARGV[1] = new score
   * Returns: 1 if updated, 0 if not
   */
  setIfGreater: `
    local current = redis.call('GET', KEYS[1])
    if current == false or tonumber(ARGV[1]) > tonumber(current) then
      redis.call('SET', KEYS[1], ARGV[1])
      return 1
    end
    return 0
  `,

  /**
   * Atomic variant score update
   * KEYS[1] = scores sorted set
   * KEYS[2] = counts sorted set
   * KEYS[3] = metadata hash
   * ARGV[1] = variant ID
   * ARGV[2] = score
   * ARGV[3] = current timestamp
   * Returns: {totalScore, count, avgScore}
   */
  updateVariantScore: `
    -- Update total score
    redis.call('ZINCRBY', KEYS[1], ARGV[2], ARGV[1])

    -- Increment count
    local count = redis.call('ZINCRBY', KEYS[2], 1, ARGV[1])

    -- Get new total score
    local totalScore = redis.call('ZSCORE', KEYS[1], ARGV[1])

    -- Calculate and store average
    local avgScore = tonumber(totalScore) / tonumber(count)
    redis.call('HSET', KEYS[3], 'avgScore', string.format('%.4f', avgScore))
    redis.call('HSET', KEYS[3], 'lastUpdated', ARGV[3])
    redis.call('HSET', KEYS[3], 'sampleCount', count)

    return {totalScore, count, string.format('%.4f', avgScore)}
  `,

  /**
   * Rate limiting with sliding window
   * KEYS[1] = rate limit key
   * ARGV[1] = window size (seconds)
   * ARGV[2] = max requests
   * ARGV[3] = current timestamp (ms)
   * Returns: 1 if allowed, 0 if rate limited
   */
  rateLimitCheck: `
    local key = KEYS[1]
    local window = tonumber(ARGV[1]) * 1000
    local maxRequests = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local windowStart = now - window

    -- Remove old entries
    redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

    -- Count current requests
    local currentCount = redis.call('ZCARD', key)

    if currentCount < maxRequests then
      -- Add this request
      redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
      redis.call('EXPIRE', key, ARGV[1])
      return 1
    else
      return 0
    end
  `,

  /**
   * Cache with automatic metrics tracking
   * KEYS[1] = cache key
   * KEYS[2] = metadata key
   * ARGV[1] = value (if setting)
   * ARGV[2] = ttl (if setting)
   * ARGV[3] = timestamp
   * ARGV[4] = operation ('get' or 'set')
   * Returns: value on get, 'OK' on set
   */
  cacheWithMetrics: `
    if ARGV[4] == 'get' then
      local value = redis.call('GET', KEYS[1])
      if value then
        redis.call('HINCRBY', KEYS[2], 'hits', 1)
        redis.call('HSET', KEYS[2], 'lastHit', ARGV[3])
        return value
      else
        redis.call('HINCRBY', KEYS[2], 'misses', 1)
        return nil
      end
    else
      redis.call('SETEX', KEYS[1], ARGV[2], ARGV[1])
      redis.call('HINCRBY', KEYS[2], 'sets', 1)
      redis.call('HSET', KEYS[2], 'lastSet', ARGV[3])
      return 'OK'
    end
  `,

  /**
   * Conditional set with comparison
   * KEYS[1] = key
   * ARGV[1] = field to compare
   * ARGV[2] = expected value
   * ARGV[3] = field to set
   * ARGV[4] = new value
   * Returns: 1 if set, 0 if condition not met
   */
  conditionalSet: `
    local current = redis.call('HGET', KEYS[1], ARGV[1])
    if current == ARGV[2] then
      redis.call('HSET', KEYS[1], ARGV[3], ARGV[4])
      return 1
    end
    return 0
  `,

  /**
   * Move score between sorted sets (for variant promotion)
   * KEYS[1] = source sorted set
   * KEYS[2] = destination sorted set
   * ARGV[1] = member
   * Returns: score or nil
   */
  moveScore: `
    local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
    if score then
      redis.call('ZREM', KEYS[1], ARGV[1])
      redis.call('ZADD', KEYS[2], score, ARGV[1])
      return score
    end
    return nil
  `,

  /**
   * Atomic counter with max limit
   * KEYS[1] = counter key
   * ARGV[1] = max value
   * ARGV[2] = ttl (optional, 0 = no expiry)
   * Returns: new value or -1 if at limit
   */
  incrementWithLimit: `
    local current = tonumber(redis.call('GET', KEYS[1]) or '0')
    local maxVal = tonumber(ARGV[1])

    if current >= maxVal then
      return -1
    end

    local newVal = redis.call('INCR', KEYS[1])

    if tonumber(ARGV[2]) > 0 then
      redis.call('EXPIRE', KEYS[1], ARGV[2])
    end

    return newVal
  `,

  /**
   * Get multiple sorted set scores efficiently
   * KEYS[1..n] = sorted set keys
   * ARGV[1] = member
   * Returns: array of scores (nil for missing)
   */
  multiZScore: `
    local results = {}
    local member = ARGV[1]

    for i, key in ipairs(KEYS) do
      local score = redis.call('ZSCORE', key, member)
      table.insert(results, score)
    end

    return results
  `
};

/**
 * Lua Script Manager
 */
export class LuaScriptManager {
  constructor() {
    this.client = null;
    this.scriptShas = new Map();
    this.isLoaded = false;
  }

  async _getClient() {
    if (!this.client) {
      this.client = await getRedisClient();
    }
    return this.client;
  }

  /**
   * Load all scripts into Redis
   *
   * @returns {Promise<boolean>} Success
   */
  async loadScripts() {
    const client = await this._getClient();
    if (!client) {
      console.warn('[Lua] Redis not available, scripts disabled');
      return false;
    }

    try {
      for (const [name, script] of Object.entries(SCRIPTS)) {
        const sha = await client.script('LOAD', script);
        this.scriptShas.set(name, sha);
      }

      this.isLoaded = true;
      console.log(`[Lua] Loaded ${this.scriptShas.size} scripts`);
      return true;

    } catch (error) {
      console.error('[Lua] Error loading scripts:', error.message);
      return false;
    }
  }

  /**
   * Execute a script by name
   *
   * @param {string} scriptName - Script name
   * @param {Array<string>} keys - KEYS array
   * @param {Array<string|number>} args - ARGV array
   * @returns {Promise<*>} Script result
   */
  async execute(scriptName, keys = [], args = []) {
    const client = await this._getClient();
    if (!client) return null;

    // Ensure scripts are loaded
    if (!this.isLoaded) {
      await this.loadScripts();
    }

    let sha = this.scriptShas.get(scriptName);

    // Load script if not cached
    if (!sha) {
      const script = SCRIPTS[scriptName];
      if (!script) {
        throw new Error(`Unknown script: ${scriptName}`);
      }

      try {
        sha = await client.script('LOAD', script);
        this.scriptShas.set(scriptName, sha);
      } catch (error) {
        console.error(`[Lua] Error loading script ${scriptName}:`, error.message);
        return null;
      }
    }

    try {
      // Convert args to strings for Redis
      const stringArgs = args.map(a => String(a));
      return await client.evalsha(sha, keys.length, ...keys, ...stringArgs);

    } catch (error) {
      // Handle NOSCRIPT error (script not in Redis)
      if (error.message.includes('NOSCRIPT')) {
        const script = SCRIPTS[scriptName];
        if (script) {
          try {
            sha = await client.script('LOAD', script);
            this.scriptShas.set(scriptName, sha);
            const stringArgs = args.map(a => String(a));
            return await client.evalsha(sha, keys.length, ...keys, ...stringArgs);
          } catch (retryError) {
            console.error(`[Lua] Retry failed for ${scriptName}:`, retryError.message);
            return null;
          }
        }
      }

      console.error(`[Lua] Error executing ${scriptName}:`, error.message);
      return null;
    }
  }

  /**
   * Execute raw Lua script (for one-off scripts)
   *
   * @param {string} script - Lua script
   * @param {Array<string>} keys - KEYS array
   * @param {Array<string|number>} args - ARGV array
   * @returns {Promise<*>} Script result
   */
  async executeRaw(script, keys = [], args = []) {
    const client = await this._getClient();
    if (!client) return null;

    try {
      const stringArgs = args.map(a => String(a));
      return await client.eval(script, keys.length, ...keys, ...stringArgs);

    } catch (error) {
      console.error('[Lua] Error executing raw script:', error.message);
      return null;
    }
  }

  /**
   * Check if scripts are loaded
   *
   * @returns {boolean} Loaded status
   */
  areScriptsLoaded() {
    return this.isLoaded && this.scriptShas.size > 0;
  }

  /**
   * Get loaded script names
   *
   * @returns {Array<string>} Script names
   */
  getLoadedScripts() {
    return Array.from(this.scriptShas.keys());
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  /**
   * Update variant score atomically
   *
   * @param {string} variantId - Variant ID
   * @param {number} score - Score to add
   * @returns {Promise<Object|null>} { totalScore, count, avgScore }
   */
  async updateVariantScore(variantId, score) {
    const result = await this.execute('updateVariantScore', [
      'force:variants:scores',
      'force:variants:counts',
      `force:variant:meta:${variantId}`
    ], [
      variantId,
      score,
      Date.now()
    ]);

    if (result && Array.isArray(result)) {
      return {
        totalScore: parseFloat(result[0]),
        count: parseInt(result[1]),
        avgScore: parseFloat(result[2])
      };
    }

    return null;
  }

  /**
   * Check rate limit
   *
   * @param {string} key - Rate limit key (e.g., user ID or IP)
   * @param {number} windowSeconds - Window size in seconds
   * @param {number} maxRequests - Maximum requests in window
   * @returns {Promise<boolean>} True if allowed, false if rate limited
   */
  async checkRateLimit(key, windowSeconds, maxRequests) {
    const result = await this.execute('rateLimitCheck', [
      `force:ratelimit:${key}`
    ], [
      windowSeconds,
      maxRequests,
      Date.now()
    ]);

    return result === 1;
  }

  /**
   * Increment counter with timestamp
   *
   * @param {string} hashKey - Hash key
   * @param {string} counterField - Counter field name
   * @param {string} timestampField - Timestamp field name
   * @returns {Promise<number>} New counter value
   */
  async incrementWithTimestamp(hashKey, counterField, timestampField = 'lastUpdated') {
    const result = await this.execute('incrementWithTimestamp', [
      hashKey
    ], [
      counterField,
      timestampField,
      Date.now()
    ]);

    return result ? parseInt(result) : 0;
  }

  /**
   * Set value if greater than current
   *
   * @param {string} key - Key
   * @param {number} value - New value
   * @returns {Promise<boolean>} True if updated
   */
  async setIfGreater(key, value) {
    const result = await this.execute('setIfGreater', [key], [value]);
    return result === 1;
  }

  /**
   * Cache get with metrics tracking
   *
   * @param {string} cacheKey - Cache key
   * @param {string} metaKey - Metadata key
   * @returns {Promise<string|null>} Cached value
   */
  async cacheGet(cacheKey, metaKey) {
    return await this.execute('cacheWithMetrics', [
      cacheKey,
      metaKey
    ], [
      '', // value (unused for get)
      0,  // ttl (unused for get)
      Date.now(),
      'get'
    ]);
  }

  /**
   * Cache set with metrics tracking
   *
   * @param {string} cacheKey - Cache key
   * @param {string} metaKey - Metadata key
   * @param {string} value - Value to cache
   * @param {number} ttl - TTL in seconds
   * @returns {Promise<boolean>} Success
   */
  async cacheSet(cacheKey, metaKey, value, ttl) {
    const result = await this.execute('cacheWithMetrics', [
      cacheKey,
      metaKey
    ], [
      value,
      ttl,
      Date.now(),
      'set'
    ]);

    return result === 'OK';
  }

  /**
   * Increment with max limit
   *
   * @param {string} key - Counter key
   * @param {number} maxValue - Maximum value
   * @param {number} ttl - TTL in seconds (0 = no expiry)
   * @returns {Promise<number>} New value or -1 if at limit
   */
  async incrementWithLimit(key, maxValue, ttl = 0) {
    const result = await this.execute('incrementWithLimit', [key], [maxValue, ttl]);
    return result !== null ? parseInt(result) : -1;
  }
}

// Singleton instance
export const luaScripts = new LuaScriptManager();

// Export script names for reference
export const SCRIPT_NAMES = Object.keys(SCRIPTS);

export default LuaScriptManager;
