/**
 * Signatures Layer - PROMPT ML Layer 3
 *
 * Unified export and orchestration for DSPy-style signatures:
 * - Base signature class and builder
 * - Task-specific signatures (roadmap, slides, document, research-analysis)
 * - Signature registry and management
 *
 * Based on PROMPT ML design specification.
 */

// Base exports
export {
  Signature,
  BoundSignature,
  SignatureBuilder,
  createSignature,
  FieldType
} from './base.js';

// Task-specific signatures
export {
  RoadmapSignature,
  generateRoadmapSignaturePrompt,
  validateRoadmapInputs,
  getRoadmapOutputSchema
} from './roadmap.js';

export {
  SlidesSignature,
  generateSlidesSignaturePrompt,
  validateSlidesInputs,
  getSlidesOutputSchema
} from './slides.js';

export {
  DocumentSignature,
  generateDocumentSignaturePrompt,
  validateDocumentInputs,
  getDocumentOutputSchema
} from './document.js';

export {
  ResearchAnalysisSignature,
  generateResearchAnalysisSignaturePrompt,
  validateResearchAnalysisInputs,
  getResearchAnalysisOutputSchema
} from './research-analysis.js';

/**
 * Signature types enum
 * @readonly
 * @enum {string}
 */
export const SignatureType = {
  ROADMAP: 'roadmap',
  SLIDES: 'slides',
  DOCUMENT: 'document',
  RESEARCH_ANALYSIS: 'research-analysis'
};

/**
 * Registry of all available signatures
 */
const SIGNATURE_REGISTRY = {
  [SignatureType.ROADMAP]: null,
  [SignatureType.SLIDES]: null,
  [SignatureType.DOCUMENT]: null,
  [SignatureType.RESEARCH_ANALYSIS]: null
};

/**
 * Lazy-load signatures to avoid circular dependencies
 */
function getSignatureFromRegistry(type) {
  if (!SIGNATURE_REGISTRY[type]) {
    switch (type) {
      case SignatureType.ROADMAP:
        SIGNATURE_REGISTRY[type] = require('./roadmap.js').RoadmapSignature;
        break;
      case SignatureType.SLIDES:
        SIGNATURE_REGISTRY[type] = require('./slides.js').SlidesSignature;
        break;
      case SignatureType.DOCUMENT:
        SIGNATURE_REGISTRY[type] = require('./document.js').DocumentSignature;
        break;
      case SignatureType.RESEARCH_ANALYSIS:
        SIGNATURE_REGISTRY[type] = require('./research-analysis.js').ResearchAnalysisSignature;
        break;
    }
  }
  return SIGNATURE_REGISTRY[type];
}

/**
 * Signature Manager class
 * Provides unified interface for working with signatures
 */
export class SignatureManager {
  constructor() {
    this.customSignatures = new Map();
  }

  /**
   * Get a signature by type
   *
   * @param {string} type - Signature type
   * @returns {Signature} The signature
   */
  getSignature(type) {
    // Check custom signatures first
    if (this.customSignatures.has(type)) {
      return this.customSignatures.get(type);
    }

    // Get from registry
    return getSignatureFromRegistry(type);
  }

  /**
   * Register a custom signature
   *
   * @param {string} name - Signature name
   * @param {Signature} signature - The signature instance
   */
  registerSignature(name, signature) {
    this.customSignatures.set(name, signature);
  }

  /**
   * Generate prompt for a given type
   *
   * @param {string} type - Signature type
   * @param {Object} inputs - Input values
   * @param {Object} options - Generation options
   * @returns {string} Generated prompt
   */
  generatePrompt(type, inputs, options = {}) {
    const signature = this.getSignature(type);
    if (!signature) {
      throw new Error(`Unknown signature type: ${type}`);
    }
    return signature.generatePrompt(inputs, options);
  }

  /**
   * Validate inputs for a given type
   *
   * @param {string} type - Signature type
   * @param {Object} inputs - Input values
   * @returns {Object} Validation result
   */
  validateInputs(type, inputs) {
    const signature = this.getSignature(type);
    if (!signature) {
      throw new Error(`Unknown signature type: ${type}`);
    }
    return signature.validateInputs(inputs);
  }

  /**
   * Get output schema for a given type
   *
   * @param {string} type - Signature type
   * @returns {Object} JSON schema
   */
  getOutputSchema(type) {
    const signature = this.getSignature(type);
    if (!signature) {
      throw new Error(`Unknown signature type: ${type}`);
    }
    return signature.getOutputSchema();
  }

  /**
   * Get all available signature types
   *
   * @returns {string[]} Available types
   */
  getAvailableTypes() {
    const builtIn = Object.values(SignatureType);
    const custom = Array.from(this.customSignatures.keys());
    return [...builtIn, ...custom];
  }

  /**
   * Get signature metadata for all types
   *
   * @returns {Object} Metadata map
   */
  getAllMetadata() {
    const metadata = {};

    for (const type of this.getAvailableTypes()) {
      const signature = this.getSignature(type);
      if (signature) {
        metadata[type] = signature.getMetadata();
      }
    }

    return metadata;
  }
}

// Singleton manager instance
let _manager = null;

/**
 * Get signature manager instance
 * @returns {SignatureManager}
 */
export function getSignatureManager() {
  if (!_manager) {
    _manager = new SignatureManager();
  }
  return _manager;
}

/**
 * Quick generate prompt function
 *
 * @param {string} type - Signature type (roadmap, slides, document, research-analysis)
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Research files [{filename, content}]
 * @param {Object} options - Additional options
 * @returns {string} Generated prompt
 */
export function generateSignaturePrompt(type, userPrompt, researchFiles, options = {}) {
  switch (type) {
    case SignatureType.ROADMAP:
      return generateRoadmapSignaturePrompt(userPrompt, researchFiles, options);
    case SignatureType.SLIDES:
      return generateSlidesSignaturePrompt(userPrompt, researchFiles, options);
    case SignatureType.DOCUMENT:
      return generateDocumentSignaturePrompt(userPrompt, researchFiles, options);
    case SignatureType.RESEARCH_ANALYSIS:
      return generateResearchAnalysisSignaturePrompt(userPrompt, researchFiles, options);
    default:
      throw new Error(`Unknown signature type: ${type}`);
  }
}

/**
 * Validate inputs for any signature type
 *
 * @param {string} type - Signature type
 * @param {string} userPrompt - User's prompt
 * @param {Array} researchFiles - Research files
 * @returns {Object} Validation result {valid, errors}
 */
export function validateSignatureInputs(type, userPrompt, researchFiles) {
  switch (type) {
    case SignatureType.ROADMAP:
      return validateRoadmapInputs(userPrompt, researchFiles);
    case SignatureType.SLIDES:
      return validateSlidesInputs(userPrompt, researchFiles);
    case SignatureType.DOCUMENT:
      return validateDocumentInputs(userPrompt, researchFiles);
    case SignatureType.RESEARCH_ANALYSIS:
      return validateResearchAnalysisInputs(userPrompt, researchFiles);
    default:
      return { valid: false, errors: [`Unknown signature type: ${type}`] };
  }
}

/**
 * Get output schema for any signature type
 *
 * @param {string} type - Signature type
 * @returns {Object} JSON schema
 */
export function getSignatureOutputSchema(type) {
  switch (type) {
    case SignatureType.ROADMAP:
      return getRoadmapOutputSchema();
    case SignatureType.SLIDES:
      return getSlidesOutputSchema();
    case SignatureType.DOCUMENT:
      return getDocumentOutputSchema();
    case SignatureType.RESEARCH_ANALYSIS:
      return getResearchAnalysisOutputSchema();
    default:
      throw new Error(`Unknown signature type: ${type}`);
  }
}

export default {
  SignatureType,
  SignatureManager,
  getSignatureManager,
  generateSignaturePrompt,
  validateSignatureInputs,
  getSignatureOutputSchema
};
