/**
 * DSPy Service Client
 *
 * Gap 04: Node.js client for the Python DSPy optimization service.
 *
 * Provides methods to:
 * - Check service health
 * - Optimize signatures with training examples
 * - Generate content using optimized modules
 * - Query signature information
 *
 * Usage:
 *   import { dspyService } from './clients/dspy-service.js';
 *
 *   // Check health
 *   const health = await dspyService.health();
 *
 *   // Optimize a signature
 *   const result = await dspyService.optimize('roadmap', examples);
 *
 *   // Generate content
 *   const output = await dspyService.generate('roadmap', inputs);
 */

// Signature type mapping from Node.js content types to DSPy signature types
const SIGNATURE_TYPE_MAP = {
  'Roadmap': 'roadmap',
  'Slides': 'slides',
  'Document': 'document',
  'ResearchAnalysis': 'research-analysis'
};

/**
 * Client for DSPy Python service
 */
export class DSPyServiceClient {
  /**
   * Create a new DSPy service client
   *
   * @param {Object} options - Client options
   * @param {string} options.baseUrl - Base URL of DSPy service
   * @param {number} options.timeout - Request timeout in ms
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.DSPY_SERVICE_URL || 'http://localhost:8001';
    this.timeout = options.timeout || 60000; // 60s for optimization
    this.healthTimeout = options.healthTimeout || 5000;
    this._isAvailable = null;
    this._lastHealthCheck = 0;
    this._healthCheckInterval = 30000; // 30 seconds
  }

  /**
   * Check service health
   *
   * @returns {Promise<Object>} Health status
   * @throws {Error} If service is unhealthy
   */
  async health() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.healthTimeout);

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`DSPy service unhealthy: ${response.status}`);
      }

      const data = await response.json();
      this._isAvailable = true;
      this._lastHealthCheck = Date.now();
      return data;

    } catch (error) {
      this._isAvailable = false;
      this._lastHealthCheck = Date.now();
      throw new Error(`DSPy service unavailable: ${error.message}`);

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if service is available (with caching)
   *
   * @returns {Promise<boolean>} True if service is available
   */
  async isAvailable() {
    // Use cached result if recent
    if (this._isAvailable !== null &&
        Date.now() - this._lastHealthCheck < this._healthCheckInterval) {
      return this._isAvailable;
    }

    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert content type to DSPy signature type
   *
   * @param {string} contentType - Node.js content type
   * @returns {string} DSPy signature type
   */
  _toSignatureType(contentType) {
    return SIGNATURE_TYPE_MAP[contentType] || contentType.toLowerCase().replace('researchanalysis', 'research-analysis');
  }

  /**
   * Combine research files into single content string
   *
   * @param {Array} files - Research files
   * @returns {string} Combined content
   */
  _combineResearchFiles(files) {
    if (!files || !Array.isArray(files)) {
      return '';
    }

    return files.map(f => {
      if (typeof f === 'string') return f;
      return f.content || f.text || JSON.stringify(f);
    }).join('\n\n---\n\n');
  }

  /**
   * Optimize a signature with training examples
   *
   * @param {string} contentType - Content type (Roadmap, Slides, etc.)
   * @param {Array} examples - Training examples
   * @param {Object} options - Optimization options
   * @param {string} options.optimizer - 'bootstrap' or 'mipro'
   * @param {Object} options.config - Optimizer-specific config
   * @returns {Promise<Object>} Optimization result
   * @throws {Error} If optimization fails
   */
  async optimize(contentType, examples, options = {}) {
    const signatureType = this._toSignatureType(contentType);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_type: signatureType,
          examples: examples.map(ex => ({
            user_prompt: ex.userPrompt || ex.prompt,
            research_content: this._combineResearchFiles(ex.researchFiles || ex.files),
            expected_output: ex.expectedOutput || ex.output || {},
            quality_score: ex.qualityScore || ex.score || 0.8
          })),
          optimizer: options.optimizer || 'bootstrap',
          config: options.config
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`Optimization failed: ${error.detail}`);
      }

      return await response.json();

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Generate content using DSPy module
   *
   * @param {string} contentType - Content type
   * @param {Object} inputs - Generation inputs
   * @param {string} inputs.userPrompt - User's request
   * @param {Array} inputs.researchFiles - Research files
   * @param {Object} options - Generation options
   * @param {boolean} options.useOptimized - Use optimized module if available
   * @returns {Promise<Object>} Generated content
   * @throws {Error} If generation fails
   */
  async generate(contentType, inputs, options = {}) {
    const signatureType = this._toSignatureType(contentType);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_type: signatureType,
          user_prompt: inputs.userPrompt || inputs.prompt,
          research_content: this._combineResearchFiles(inputs.researchFiles || inputs.files),
          use_optimized: options.useOptimized !== false
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`Generation failed: ${error.detail}`);
      }

      return await response.json();

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get signature information
   *
   * @param {string} contentType - Content type
   * @returns {Promise<Object>} Signature info
   */
  async getSignatureInfo(contentType) {
    const signatureType = this._toSignatureType(contentType);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/signatures/${signatureType}`, {
        method: 'GET',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to get signature info: ${response.status}`);
      }

      return await response.json();

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * List all available signatures
   *
   * @returns {Promise<Object>} List of signatures
   */
  async listSignatures() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/signatures`, {
        method: 'GET',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to list signatures: ${response.status}`);
      }

      return await response.json();

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Clear cached optimization for a signature
   *
   * @param {string} contentType - Content type
   * @returns {Promise<Object>} Clear result
   */
  async clearCache(contentType) {
    const signatureType = this._toSignatureType(contentType);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/signatures/${signatureType}/cache`, {
        method: 'DELETE',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to clear cache: ${response.status}`);
      }

      return await response.json();

    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Export singleton instance
export const dspyService = new DSPyServiceClient();

export default DSPyServiceClient;
