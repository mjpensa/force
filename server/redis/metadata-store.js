/**
 * Hash-based Metadata Store
 *
 * Gap 05: Efficient field-level access to metadata using Redis Hashes.
 *
 * Features:
 * - Set/get individual fields without loading entire object
 * - Atomic field increments
 * - Efficient multi-field access
 * - Auto-serialization of complex values
 * - TTL support
 *
 * Usage:
 *   import { variantMeta, sessionMeta } from './metadata-store.js';
 *
 *   await variantMeta.setFields('variant-1', { name: 'Test', score: 4.5 });
 *   const score = await variantMeta.getField('variant-1', 'score');
 *   await variantMeta.incrementField('variant-1', 'impressions');
 */

import { getRedisClient } from './client.js';

/**
 * Hash-based metadata store for efficient field access
 */
export class MetadataStore {
  /**
   * Create a metadata store with a key prefix
   *
   * @param {string} keyPrefix - Prefix for all keys in this store
   */
  constructor(keyPrefix = 'force:meta') {
    this.keyPrefix = keyPrefix;
    this.client = null;
  }

  async _getClient() {
    if (!this.client) {
      this.client = await getRedisClient();
    }
    return this.client;
  }

  /**
   * Build full key from ID
   *
   * @param {string} id - Entity ID
   * @returns {string} Full Redis key
   */
  _key(id) {
    return `${this.keyPrefix}:${id}`;
  }

  /**
   * Serialize a value for storage
   *
   * @param {*} value - Value to serialize
   * @returns {string} Serialized string
   */
  _serialize(value) {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Deserialize a value from storage
   *
   * @param {string} value - Stored value
   * @returns {*} Deserialized value
   */
  _deserialize(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Try to parse JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    // Try to parse numbers
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return num;
      }
    }

    return value;
  }

  /**
   * Set multiple fields on a hash
   *
   * @param {string} id - Entity ID
   * @param {Object} fields - Field-value pairs
   * @returns {Promise<boolean>} Success
   */
  async setFields(id, fields) {
    const client = await this._getClient();
    if (!client) return false;

    try {
      const flatFields = {};
      for (const [key, value] of Object.entries(fields)) {
        flatFields[key] = this._serialize(value);
      }

      await client.hset(this._key(id), flatFields);
      return true;

    } catch (error) {
      console.error(`[MetadataStore] Error setting fields for ${id}:`, error.message);
      return false;
    }
  }

  /**
   * Set a single field
   *
   * @param {string} id - Entity ID
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @returns {Promise<boolean>} Success
   */
  async setField(id, field, value) {
    return this.setFields(id, { [field]: value });
  }

  /**
   * Get a specific field
   *
   * @param {string} id - Entity ID
   * @param {string} field - Field name
   * @returns {Promise<*>} Field value or null
   */
  async getField(id, field) {
    const client = await this._getClient();
    if (!client) return null;

    try {
      const value = await client.hget(this._key(id), field);
      return this._deserialize(value);

    } catch (error) {
      console.error(`[MetadataStore] Error getting field ${field} for ${id}:`, error.message);
      return null;
    }
  }

  /**
   * Get multiple specific fields
   *
   * @param {string} id - Entity ID
   * @param {Array<string>} fields - Field names
   * @returns {Promise<Object>} Field-value object
   */
  async getFields(id, fields) {
    const client = await this._getClient();
    if (!client) return {};

    try {
      const values = await client.hmget(this._key(id), ...fields);

      const result = {};
      fields.forEach((field, i) => {
        result[field] = this._deserialize(values[i]);
      });

      return result;

    } catch (error) {
      console.error(`[MetadataStore] Error getting fields for ${id}:`, error.message);
      return {};
    }
  }

  /**
   * Get all fields
   *
   * @param {string} id - Entity ID
   * @returns {Promise<Object>} All field-value pairs
   */
  async getAll(id) {
    const client = await this._getClient();
    if (!client) return {};

    try {
      const data = await client.hgetall(this._key(id));

      if (!data || Object.keys(data).length === 0) {
        return {};
      }

      // Deserialize all values
      const result = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this._deserialize(value);
      }

      return result;

    } catch (error) {
      console.error(`[MetadataStore] Error getting all fields for ${id}:`, error.message);
      return {};
    }
  }

  /**
   * Increment a numeric field
   *
   * @param {string} id - Entity ID
   * @param {string} field - Field name
   * @param {number} amount - Amount to increment (default: 1)
   * @returns {Promise<number>} New value
   */
  async incrementField(id, field, amount = 1) {
    const client = await this._getClient();
    if (!client) return 0;

    try {
      if (Number.isInteger(amount)) {
        return await client.hincrby(this._key(id), field, amount);
      } else {
        const result = await client.hincrbyfloat(this._key(id), field, amount);
        return parseFloat(result);
      }

    } catch (error) {
      console.error(`[MetadataStore] Error incrementing ${field} for ${id}:`, error.message);
      return 0;
    }
  }

  /**
   * Check if a field exists
   *
   * @param {string} id - Entity ID
   * @param {string} field - Field name
   * @returns {Promise<boolean>} Whether field exists
   */
  async fieldExists(id, field) {
    const client = await this._getClient();
    if (!client) return false;

    try {
      const exists = await client.hexists(this._key(id), field);
      return exists === 1;

    } catch (error) {
      console.error(`[MetadataStore] Error checking field ${field} for ${id}:`, error.message);
      return false;
    }
  }

  /**
   * Check if hash exists
   *
   * @param {string} id - Entity ID
   * @returns {Promise<boolean>} Whether hash exists
   */
  async exists(id) {
    const client = await this._getClient();
    if (!client) return false;

    try {
      const exists = await client.exists(this._key(id));
      return exists === 1;

    } catch (error) {
      console.error(`[MetadataStore] Error checking existence for ${id}:`, error.message);
      return false;
    }
  }

  /**
   * Get number of fields in hash
   *
   * @param {string} id - Entity ID
   * @returns {Promise<number>} Field count
   */
  async getFieldCount(id) {
    const client = await this._getClient();
    if (!client) return 0;

    try {
      return await client.hlen(this._key(id));

    } catch (error) {
      console.error(`[MetadataStore] Error getting field count for ${id}:`, error.message);
      return 0;
    }
  }

  /**
   * Get all field names
   *
   * @param {string} id - Entity ID
   * @returns {Promise<Array<string>>} Field names
   */
  async getFieldNames(id) {
    const client = await this._getClient();
    if (!client) return [];

    try {
      return await client.hkeys(this._key(id));

    } catch (error) {
      console.error(`[MetadataStore] Error getting field names for ${id}:`, error.message);
      return [];
    }
  }

  /**
   * Delete specific fields
   *
   * @param {string} id - Entity ID
   * @param {Array<string>|string} fields - Field(s) to delete
   * @returns {Promise<number>} Number of fields deleted
   */
  async deleteFields(id, fields) {
    const client = await this._getClient();
    if (!client) return 0;

    try {
      const fieldArray = Array.isArray(fields) ? fields : [fields];
      return await client.hdel(this._key(id), ...fieldArray);

    } catch (error) {
      console.error(`[MetadataStore] Error deleting fields for ${id}:`, error.message);
      return 0;
    }
  }

  /**
   * Delete entire hash
   *
   * @param {string} id - Entity ID
   * @returns {Promise<boolean>} Success
   */
  async delete(id) {
    const client = await this._getClient();
    if (!client) return false;

    try {
      await client.del(this._key(id));
      return true;

    } catch (error) {
      console.error(`[MetadataStore] Error deleting ${id}:`, error.message);
      return false;
    }
  }

  /**
   * Set TTL on hash
   *
   * @param {string} id - Entity ID
   * @param {number} seconds - TTL in seconds
   * @returns {Promise<boolean>} Success
   */
  async setExpiry(id, seconds) {
    const client = await this._getClient();
    if (!client) return false;

    try {
      await client.expire(this._key(id), seconds);
      return true;

    } catch (error) {
      console.error(`[MetadataStore] Error setting expiry for ${id}:`, error.message);
      return false;
    }
  }

  /**
   * Get TTL for hash
   *
   * @param {string} id - Entity ID
   * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if not exists)
   */
  async getTTL(id) {
    const client = await this._getClient();
    if (!client) return -2;

    try {
      return await client.ttl(this._key(id));

    } catch (error) {
      console.error(`[MetadataStore] Error getting TTL for ${id}:`, error.message);
      return -2;
    }
  }

  /**
   * Set fields with expiry
   *
   * @param {string} id - Entity ID
   * @param {Object} fields - Field-value pairs
   * @param {number} ttlSeconds - TTL in seconds
   * @returns {Promise<boolean>} Success
   */
  async setFieldsWithExpiry(id, fields, ttlSeconds) {
    const client = await this._getClient();
    if (!client) return false;

    try {
      const pipeline = client.pipeline();

      const flatFields = {};
      for (const [key, value] of Object.entries(fields)) {
        flatFields[key] = this._serialize(value);
      }

      pipeline.hset(this._key(id), flatFields);
      pipeline.expire(this._key(id), ttlSeconds);

      await pipeline.exec();
      return true;

    } catch (error) {
      console.error(`[MetadataStore] Error setting fields with expiry for ${id}:`, error.message);
      return false;
    }
  }

  /**
   * List all IDs in this store (use sparingly in production)
   *
   * @param {string} pattern - Optional pattern to match (default: all)
   * @returns {Promise<Array<string>>} Entity IDs
   */
  async listIds(pattern = '*') {
    const client = await this._getClient();
    if (!client) return [];

    try {
      const fullPattern = `${this.keyPrefix}:${pattern}`;
      const keys = await client.keys(fullPattern);

      // Strip prefix to get IDs
      const prefixLength = this.keyPrefix.length + 1;
      return keys.map(key => key.slice(prefixLength));

    } catch (error) {
      console.error(`[MetadataStore] Error listing IDs:`, error.message);
      return [];
    }
  }
}

// =============================================================================
// Pre-configured Stores
// =============================================================================

/** Variant metadata store */
export const variantMeta = new MetadataStore('force:variant:meta');

/** Training session metadata store */
export const sessionMeta = new MetadataStore('force:session:meta');

/** Cache metadata store */
export const cacheMeta = new MetadataStore('force:cache:meta');

/** User/request metadata store */
export const requestMeta = new MetadataStore('force:request:meta');

export default MetadataStore;
