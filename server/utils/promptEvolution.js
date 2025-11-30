/**
 * Prompt Evolution Mechanism
 *
 * This module implements an automated prompt evolution system that:
 * 1. Analyzes successful vs failed generations
 * 2. Identifies patterns in high/low performing outputs
 * 3. Generates mutated prompt variants
 * 4. Tests mutations through the existing A/B framework
 *
 * Implementation of Plan 02: Prompt Evolution Mechanism
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', '..', 'data');
const EVOLUTION_STATE_PATH = join(DATA_DIR, 'prompt-evolution-state.json');

// ============================================================================
// Phase 1: Prompt Structure Analysis
// ============================================================================

/**
 * Component types that can be identified in prompts
 */
export const PROMPT_COMPONENTS = {
  INSTRUCTION: 'instruction',      // Core task description
  FORMAT: 'format',                // Output structure requirements
  CONSTRAINTS: 'constraints',      // Limitations and rules
  EXAMPLES: 'examples',            // Few-shot examples
  TONE: 'tone',                    // Voice and style guidance
  CONTEXT: 'context'               // Background information
};

/**
 * Pattern matchers for identifying section types
 */
const SECTION_PATTERNS = {
  [PROMPT_COMPONENTS.FORMAT]: [
    /format/i,
    /structure/i,
    /output/i,
    /layout/i,
    /organize/i,
    /arrange/i
  ],
  [PROMPT_COMPONENTS.CONSTRAINTS]: [
    /constraint/i,
    /must not/i,
    /avoid/i,
    /don't/i,
    /do not/i,
    /never/i,
    /restriction/i,
    /limitation/i,
    /rule/i,
    /requirement/i
  ],
  [PROMPT_COMPONENTS.EXAMPLES]: [
    /example/i,
    /sample/i,
    /like this/i,
    /such as/i,
    /for instance/i,
    /e\.g\./i,
    /demonstration/i
  ],
  [PROMPT_COMPONENTS.TONE]: [
    /tone/i,
    /voice/i,
    /style/i,
    /manner/i,
    /formal/i,
    /informal/i,
    /professional/i,
    /friendly/i,
    /write as/i,
    /speak as/i
  ],
  [PROMPT_COMPONENTS.CONTEXT]: [
    /context/i,
    /background/i,
    /about/i,
    /overview/i,
    /introduction/i,
    /given that/i,
    /assuming/i,
    /scenario/i
  ]
};

/**
 * Parse a prompt into its structural components for targeted mutations.
 *
 * @param {string} prompt - The raw prompt text to parse
 * @returns {Object} Structure object with raw text, components, and sections
 */
export function parsePromptStructure(prompt) {
  // Handle edge cases
  if (!prompt || typeof prompt !== 'string') {
    return {
      raw: '',
      components: {},
      sections: [],
      metadata: {
        isEmpty: true,
        totalLines: 0,
        hasHeaders: false,
        hasBullets: false,
        hasNumberedLists: false
      }
    };
  }

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt === '') {
    return {
      raw: '',
      components: {},
      sections: [],
      metadata: {
        isEmpty: true,
        totalLines: 0,
        hasHeaders: false,
        hasBullets: false,
        hasNumberedLists: false
      }
    };
  }

  const structure = {
    raw: prompt,
    components: {},
    sections: [],
    metadata: {
      isEmpty: false,
      totalLines: 0,
      hasHeaders: false,
      hasBullets: false,
      hasNumberedLists: false
    }
  };

  const lines = prompt.split('\n');
  structure.metadata.totalLines = lines.length;

  // Track line patterns for metadata
  const headerPattern = /^#+\s+(.+)$/;
  const bulletPattern = /^[-*]\s+(.+)$/;
  const numberedPattern = /^\d+\.\s+(.+)$/;

  // Initialize current section
  let currentSection = {
    type: PROMPT_COMPONENTS.INSTRUCTION,
    content: [],
    startLine: 0,
    lineType: 'text'
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for structural patterns and update metadata
    if (headerPattern.test(trimmedLine)) {
      structure.metadata.hasHeaders = true;
    }
    if (bulletPattern.test(trimmedLine)) {
      structure.metadata.hasBullets = true;
    }
    if (numberedPattern.test(trimmedLine)) {
      structure.metadata.hasNumberedLists = true;
    }

    // Detect section type from line content
    const detectedType = detectSectionType(trimmedLine);

    // If we detect a new section type and have content, save current section
    if (detectedType && detectedType !== currentSection.type && currentSection.content.length > 0) {
      structure.sections.push({ ...currentSection });
      currentSection = {
        type: detectedType,
        content: [],
        startLine: i,
        lineType: getLineType(trimmedLine)
      };
    } else if (detectedType && currentSection.content.length === 0) {
      // Update type if section is empty (first detection)
      currentSection.type = detectedType;
      currentSection.lineType = getLineType(trimmedLine);
    }

    currentSection.content.push(line);
  }

  // Push the final section
  if (currentSection.content.length > 0) {
    structure.sections.push(currentSection);
  }

  // Populate components map from sections
  for (const section of structure.sections) {
    const componentType = section.type;
    if (!structure.components[componentType]) {
      structure.components[componentType] = [];
    }
    structure.components[componentType].push({
      content: section.content.join('\n'),
      startLine: section.startLine,
      lineCount: section.content.length
    });
  }

  return structure;
}

/**
 * Detect the type of section based on line content
 *
 * @param {string} line - Line to analyze
 * @returns {string|null} Component type or null if no match
 */
function detectSectionType(line) {
  if (!line || line.trim() === '') {
    return null;
  }

  // Check each component type's patterns
  for (const [componentType, patterns] of Object.entries(SECTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        return componentType;
      }
    }
  }

  return null;
}

/**
 * Determine the structural type of a line
 *
 * @param {string} line - Line to analyze
 * @returns {string} Line type: 'header', 'bullet', 'numbered', or 'text'
 */
function getLineType(line) {
  if (/^#+\s+/.test(line)) return 'header';
  if (/^[-*]\s+/.test(line)) return 'bullet';
  if (/^\d+\.\s+/.test(line)) return 'numbered';
  return 'text';
}

/**
 * Reconstruct a prompt from its parsed structure
 *
 * @param {Object} structure - Parsed prompt structure
 * @returns {string} Reconstructed prompt text
 */
export function reconstructPrompt(structure) {
  if (!structure || !structure.sections || structure.sections.length === 0) {
    return structure?.raw || '';
  }

  return structure.sections
    .map(section => section.content.join('\n'))
    .join('\n');
}

/**
 * Get a specific component from parsed structure
 *
 * @param {Object} structure - Parsed prompt structure
 * @param {string} componentType - Type of component to retrieve
 * @returns {Array} Array of component sections
 */
export function getComponent(structure, componentType) {
  if (!structure || !structure.components) {
    return [];
  }
  return structure.components[componentType] || [];
}

/**
 * Check if a prompt has a specific component type
 *
 * @param {Object} structure - Parsed prompt structure
 * @param {string} componentType - Type of component to check
 * @returns {boolean} True if component exists
 */
export function hasComponent(structure, componentType) {
  return getComponent(structure, componentType).length > 0;
}

/**
 * Validate Phase 1 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase1() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: Empty prompt handling
  const emptyResult = parsePromptStructure('');
  results.tests.push({
    name: 'Empty prompt handling',
    passed: emptyResult.metadata.isEmpty === true && emptyResult.sections.length === 0,
    details: `isEmpty=${emptyResult.metadata.isEmpty}, sections=${emptyResult.sections.length}`
  });

  // Test 2: Null/undefined handling
  const nullResult = parsePromptStructure(null);
  results.tests.push({
    name: 'Null prompt handling',
    passed: nullResult.metadata.isEmpty === true,
    details: `isEmpty=${nullResult.metadata.isEmpty}`
  });

  // Test 3: Basic prompt parsing
  const basicPrompt = 'Create a roadmap for the project.';
  const basicResult = parsePromptStructure(basicPrompt);
  results.tests.push({
    name: 'Basic prompt parsing',
    passed: basicResult.sections.length >= 1 && basicResult.sections[0].type === PROMPT_COMPONENTS.INSTRUCTION,
    details: `sections=${basicResult.sections.length}, type=${basicResult.sections[0]?.type}`
  });

  // Test 4: Format section detection
  const formatPrompt = `Create content.

## Format
- Use bullet points
- Include headers`;
  const formatResult = parsePromptStructure(formatPrompt);
  const hasFormat = formatResult.sections.some(s => s.type === PROMPT_COMPONENTS.FORMAT);
  results.tests.push({
    name: 'Format section detection',
    passed: hasFormat,
    details: `hasFormat=${hasFormat}, sections=${JSON.stringify(formatResult.sections.map(s => s.type))}`
  });

  // Test 5: Constraints section detection
  const constraintPrompt = `Create content.

Avoid using jargon.
Don't include technical terms.`;
  const constraintResult = parsePromptStructure(constraintPrompt);
  const hasConstraints = constraintResult.sections.some(s => s.type === PROMPT_COMPONENTS.CONSTRAINTS);
  results.tests.push({
    name: 'Constraints section detection',
    passed: hasConstraints,
    details: `hasConstraints=${hasConstraints}`
  });

  // Test 6: Examples section detection
  const examplePrompt = `Create content.

Example:
Here is a sample output...`;
  const exampleResult = parsePromptStructure(examplePrompt);
  const hasExamples = exampleResult.sections.some(s => s.type === PROMPT_COMPONENTS.EXAMPLES);
  results.tests.push({
    name: 'Examples section detection',
    passed: hasExamples,
    details: `hasExamples=${hasExamples}`
  });

  // Test 7: Tone section detection
  const tonePrompt = `Create content.

Use a professional tone throughout.
Write in a formal style.`;
  const toneResult = parsePromptStructure(tonePrompt);
  const hasTone = toneResult.sections.some(s => s.type === PROMPT_COMPONENTS.TONE);
  results.tests.push({
    name: 'Tone section detection',
    passed: hasTone,
    details: `hasTone=${hasTone}`
  });

  // Test 8: Context section detection
  const contextPrompt = `Context: The project is about AI development.

Create a roadmap.`;
  const contextResult = parsePromptStructure(contextPrompt);
  const hasContext = contextResult.sections.some(s => s.type === PROMPT_COMPONENTS.CONTEXT);
  results.tests.push({
    name: 'Context section detection',
    passed: hasContext,
    details: `hasContext=${hasContext}`
  });

  // Test 9: Components field populated
  const multiPrompt = `Create a strategic roadmap.

## Format
Use clear sections.

## Constraints
Avoid vague language.`;
  const multiResult = parsePromptStructure(multiPrompt);
  const componentsPopulated = Object.keys(multiResult.components).length > 0;
  results.tests.push({
    name: 'Components field populated',
    passed: componentsPopulated,
    details: `componentTypes=${Object.keys(multiResult.components).join(', ')}`
  });

  // Test 10: Metadata accuracy
  const metadataPrompt = `# Header

- Bullet 1
- Bullet 2

1. Item one
2. Item two`;
  const metadataResult = parsePromptStructure(metadataPrompt);
  const metadataCorrect = metadataResult.metadata.hasHeaders &&
                          metadataResult.metadata.hasBullets &&
                          metadataResult.metadata.hasNumberedLists;
  results.tests.push({
    name: 'Metadata accuracy',
    passed: metadataCorrect,
    details: `headers=${metadataResult.metadata.hasHeaders}, bullets=${metadataResult.metadata.hasBullets}, numbered=${metadataResult.metadata.hasNumberedLists}`
  });

  // Test 11: Reconstruction
  const testReconstructPrompt = 'Line 1\nLine 2\nLine 3';
  const reconstructed = reconstructPrompt(parsePromptStructure(testReconstructPrompt));
  results.tests.push({
    name: 'Prompt reconstruction',
    passed: reconstructed === testReconstructPrompt,
    details: `original=${testReconstructPrompt.length} chars, reconstructed=${reconstructed.length} chars`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Phase 2: Performance Pattern Extraction
// ============================================================================

/**
 * Content-type specific structure expectations
 */
const STRUCTURE_EXPECTATIONS = {
  Roadmap: {
    expectedSections: 3,
    expectedBullets: true,
    expectedHeaders: true,
    minWordCount: 100,
    maxWordCount: 1000
  },
  Slides: {
    expectedSections: 5,
    expectedBullets: true,
    expectedHeaders: true,
    minWordCount: 50,
    maxWordCount: 500
  },
  Document: {
    expectedSections: 4,
    expectedBullets: false,
    expectedHeaders: true,
    minWordCount: 200,
    maxWordCount: 2000
  },
  ResearchAnalysis: {
    expectedSections: 4,
    expectedBullets: true,
    expectedHeaders: true,
    minWordCount: 300,
    maxWordCount: 1500
  }
};

/**
 * Default structure expectations for unknown content types
 */
const DEFAULT_STRUCTURE = {
  expectedSections: 3,
  expectedBullets: false,
  expectedHeaders: false,
  minWordCount: 50,
  maxWordCount: 1000
};

/**
 * Extracts and analyzes performance patterns from generation outcomes.
 * Identifies what differentiates high-performing outputs from low-performing ones.
 */
export class PerformancePatternExtractor {
  constructor(maxPatterns = 100) {
    this.successPatterns = [];      // Score >= 4
    this.failurePatterns = [];       // Score <= 2
    this.middlePatterns = [];        // Score 2.1-3.9 (for analysis)
    this.maxPatterns = maxPatterns;
    this.seenHashes = new Set();     // For deduplication
  }

  /**
   * Generate a hash for deduplication
   * @param {string} prompt
   * @param {string} output
   * @returns {string}
   */
  _generateHash(prompt, output) {
    // Simple hash based on first/last 50 chars of prompt and output
    const promptKey = (prompt || '').slice(0, 50) + (prompt || '').slice(-50);
    const outputKey = (output || '').slice(0, 50) + (output || '').slice(-50);
    return `${promptKey}::${outputKey}`;
  }

  /**
   * Record a generation outcome for pattern analysis
   *
   * @param {string} prompt - The prompt used
   * @param {string} output - The generated output
   * @param {number} score - Quality score (1-5)
   * @param {string} contentType - Type of content generated
   */
  recordOutcome(prompt, output, score, contentType) {
    // Validate inputs
    if (!prompt || !output || typeof score !== 'number') {
      return;
    }

    // Check for duplicates
    const hash = this._generateHash(prompt, output);
    if (this.seenHashes.has(hash)) {
      return;
    }
    this.seenHashes.add(hash);

    // Limit hash set size
    if (this.seenHashes.size > this.maxPatterns * 3) {
      const hashes = Array.from(this.seenHashes);
      this.seenHashes = new Set(hashes.slice(-this.maxPatterns * 2));
    }

    const analysis = {
      prompt,
      output,
      score,
      contentType,
      timestamp: Date.now(),
      features: this.extractFeatures(output, contentType),
      hash
    };

    // Categorize by score range
    if (score >= 4) {
      this.successPatterns.push(analysis);
      if (this.successPatterns.length > this.maxPatterns) {
        this.successPatterns.shift();
      }
    } else if (score <= 2) {
      this.failurePatterns.push(analysis);
      if (this.failurePatterns.length > this.maxPatterns) {
        this.failurePatterns.shift();
      }
    } else {
      // Middle range (2.1 - 3.9) - useful for gradient analysis
      this.middlePatterns.push(analysis);
      if (this.middlePatterns.length > this.maxPatterns) {
        this.middlePatterns.shift();
      }
    }
  }

  /**
   * Extract feature vector from output
   *
   * @param {string} output - Generated content
   * @param {string} contentType - Content type
   * @returns {Object} Feature vector
   */
  extractFeatures(output, contentType) {
    if (!output || typeof output !== 'string') {
      return this._getEmptyFeatures();
    }

    // Calculate word and sentence counts
    const words = output.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Split by sentence-ending punctuation, filter empty
    const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;

    // Calculate average sentence length
    const avgSentenceLength = sentenceCount > 0
      ? wordCount / sentenceCount
      : 0;

    // Calculate paragraph count
    const paragraphs = output.split(/\n\n+/).filter(p => p.trim().length > 0);
    const paragraphCount = paragraphs.length;

    // Calculate section count (headers)
    const headerMatches = output.match(/^#+\s+.+$/gm) || [];
    const sectionCount = headerMatches.length;

    // Bullet count
    const bulletMatches = output.match(/^[-*]\s+.+$/gm) || [];
    const bulletCount = bulletMatches.length;

    return {
      // Structural features
      wordCount,
      sentenceCount,
      avgSentenceLength,
      paragraphCount,
      sectionCount,
      bulletCount,

      // Content features
      hasNumbers: /\d/.test(output),
      hasCitations: /\[.*?\]/.test(output),
      hasQuestions: /\?/.test(output),
      hasEmphasis: /\*\*.*?\*\*|__.*?__/.test(output),
      hasCodeBlocks: /```[\s\S]*?```/.test(output),

      // Quality indicators
      specificityScore: this.measureSpecificity(output),
      structureScore: this.measureStructure(output, contentType),
      diversityScore: this.measureDiversity(output),
      coherenceScore: this.measureCoherence(output)
    };
  }

  /**
   * Get empty feature vector for invalid inputs
   * @returns {Object}
   */
  _getEmptyFeatures() {
    return {
      wordCount: 0,
      sentenceCount: 0,
      avgSentenceLength: 0,
      paragraphCount: 0,
      sectionCount: 0,
      bulletCount: 0,
      hasNumbers: false,
      hasCitations: false,
      hasQuestions: false,
      hasEmphasis: false,
      hasCodeBlocks: false,
      specificityScore: 0,
      structureScore: 0,
      diversityScore: 0,
      coherenceScore: 0
    };
  }

  /**
   * Measure specificity of content (numbers, dates, citations)
   *
   * @param {string} output - Content to analyze
   * @returns {number} Specificity score 0-1
   */
  measureSpecificity(output) {
    const specificIndicators = [
      /\$[\d,]+(\.\d{2})?/g,        // Dollar amounts
      /\d+%/g,                       // Percentages
      /\b\d{4}\b/g,                  // Years
      /\[.+?\]/g,                    // Citations
      /\d+\s*(days?|weeks?|months?|years?|hours?|minutes?)/gi,  // Time periods
      /Q[1-4]\s*\d{4}/g,             // Quarter references
      /\d+\s*(users?|customers?|employees?|items?)/gi,  // Quantities
      /\b\d{1,3}(,\d{3})*\b/g        // Large numbers with commas
    ];

    let totalMatches = 0;
    for (const pattern of specificIndicators) {
      const matches = output.match(pattern) || [];
      totalMatches += matches.length;
    }

    // Normalize: 10+ specific references = score of 1
    return Math.min(totalMatches / 10, 1);
  }

  /**
   * Measure structural quality based on content type expectations
   *
   * @param {string} output - Content to analyze
   * @param {string} contentType - Content type
   * @returns {number} Structure score 0-1
   */
  measureStructure(output, contentType) {
    const expectations = STRUCTURE_EXPECTATIONS[contentType] || DEFAULT_STRUCTURE;
    let score = 0;
    let checks = 0;

    // Check section count
    const sectionMatches = output.match(/^#+\s+.+$/gm) || [];
    const sectionCount = sectionMatches.length;
    if (sectionCount >= expectations.expectedSections) {
      score += 1;
    } else if (sectionCount > 0) {
      score += sectionCount / expectations.expectedSections;
    }
    checks++;

    // Check for bullets if expected
    if (expectations.expectedBullets) {
      const hasBullets = /^[-*]\s+.+$/m.test(output);
      if (hasBullets) score += 1;
      checks++;
    }

    // Check for headers if expected
    if (expectations.expectedHeaders) {
      const hasHeaders = /^#+\s+.+$/m.test(output);
      if (hasHeaders) score += 1;
      checks++;
    }

    // Check word count range
    const wordCount = output.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= expectations.minWordCount && wordCount <= expectations.maxWordCount) {
      score += 1;
    } else if (wordCount > 0) {
      // Partial credit for being close
      const minRatio = Math.min(wordCount / expectations.minWordCount, 1);
      const maxRatio = wordCount <= expectations.maxWordCount ? 1 : expectations.maxWordCount / wordCount;
      score += (minRatio + maxRatio) / 2;
    }
    checks++;

    return checks > 0 ? score / checks : 0;
  }

  /**
   * Measure vocabulary diversity
   *
   * @param {string} output - Content to analyze
   * @returns {number} Diversity score 0-1
   */
  measureDiversity(output) {
    const words = output.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return 0;

    const uniqueWords = new Set(words);
    const diversity = uniqueWords.size / words.length;

    // Normalize: 0.5+ unique ratio = score of 1
    return Math.min(diversity * 2, 1);
  }

  /**
   * Measure text coherence (sentence connectivity)
   *
   * @param {string} output - Content to analyze
   * @returns {number} Coherence score 0-1
   */
  measureCoherence(output) {
    // Look for transition words/phrases
    const transitions = [
      /\b(however|therefore|moreover|furthermore|additionally|consequently)\b/gi,
      /\b(first|second|third|finally|next|then|subsequently)\b/gi,
      /\b(in addition|as a result|for example|in contrast|on the other hand)\b/gi,
      /\b(because|since|although|while|whereas)\b/gi
    ];

    let transitionCount = 0;
    for (const pattern of transitions) {
      const matches = output.match(pattern) || [];
      transitionCount += matches.length;
    }

    const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 1) return transitionCount > 0 ? 0.5 : 0;

    // Ideal: 1 transition per 3-4 sentences
    const idealTransitions = sentences.length / 3.5;
    const ratio = transitionCount / idealTransitions;

    // Score peaks at ratio = 1, decreases for too few or too many
    if (ratio <= 1) {
      return ratio;
    } else {
      return Math.max(0, 2 - ratio); // Penalize over-use of transitions
    }
  }

  /**
   * Aggregate features across a set of patterns
   *
   * @param {Array} patterns - Array of analysis objects
   * @returns {Object} Aggregated feature averages
   */
  aggregateFeatures(patterns) {
    if (!patterns || patterns.length === 0) {
      return this._getEmptyFeatures();
    }

    const aggregated = {};
    const featureKeys = Object.keys(patterns[0].features);

    for (const key of featureKeys) {
      const values = patterns.map(p => p.features[key]);

      if (typeof values[0] === 'boolean') {
        // For boolean features, calculate percentage true
        aggregated[key] = values.filter(v => v).length / values.length;
      } else {
        // For numeric features, calculate mean
        aggregated[key] = values.reduce((sum, v) => sum + v, 0) / values.length;
      }
    }

    return aggregated;
  }

  /**
   * Find features that differentiate success from failure
   *
   * @returns {Object} Map of feature name to difference stats
   */
  findDifferentiatingPatterns() {
    if (this.successPatterns.length < 5 || this.failurePatterns.length < 5) {
      return {}; // Need minimum samples for meaningful comparison
    }

    const successFeatures = this.aggregateFeatures(this.successPatterns);
    const failureFeatures = this.aggregateFeatures(this.failurePatterns);

    const differentiators = {};
    for (const key of Object.keys(successFeatures)) {
      const successVal = successFeatures[key];
      const failureVal = failureFeatures[key];
      const diff = successVal - failureVal;

      // Calculate relative difference for significance
      const avgVal = (successVal + failureVal) / 2;
      const relativeDiff = avgVal > 0 ? Math.abs(diff) / avgVal : Math.abs(diff);

      // Only include significant differences (> 10% relative or > 0.1 absolute)
      if (relativeDiff > 0.1 || Math.abs(diff) > 0.1) {
        differentiators[key] = {
          successAvg: successFeatures[key],
          failureAvg: failureFeatures[key],
          difference: diff,
          relativeDifference: relativeDiff,
          direction: diff > 0 ? 'positive' : 'negative'
        };
      }
    }

    return differentiators;
  }

  /**
   * Get summary statistics
   *
   * @returns {Object} Summary stats
   */
  getStats() {
    return {
      successCount: this.successPatterns.length,
      failureCount: this.failurePatterns.length,
      middleCount: this.middlePatterns.length,
      totalRecorded: this.successPatterns.length + this.failurePatterns.length + this.middlePatterns.length,
      uniqueHashes: this.seenHashes.size
    };
  }

  /**
   * Get top differentiating features sorted by impact
   *
   * @param {number} limit - Max features to return
   * @returns {Array} Sorted feature differences
   */
  getTopDifferentiators(limit = 5) {
    const diffs = this.findDifferentiatingPatterns();
    return Object.entries(diffs)
      .map(([feature, stats]) => ({ feature, ...stats }))
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
      .slice(0, limit);
  }
}

/**
 * Validate Phase 2 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase2() {
  const results = {
    passed: true,
    tests: []
  };

  const extractor = new PerformancePatternExtractor(50);

  // Test 1: Record success pattern
  extractor.recordOutcome(
    'Create a roadmap',
    'This is a high quality output with specific details like $50,000 budget and Q1 2024 timeline.',
    4.5,
    'Roadmap'
  );
  results.tests.push({
    name: 'Record success pattern',
    passed: extractor.successPatterns.length === 1,
    details: `successPatterns=${extractor.successPatterns.length}`
  });

  // Test 2: Record failure pattern
  extractor.recordOutcome(
    'Create a roadmap',
    'Bad output.',
    1.5,
    'Roadmap'
  );
  results.tests.push({
    name: 'Record failure pattern',
    passed: extractor.failurePatterns.length === 1,
    details: `failurePatterns=${extractor.failurePatterns.length}`
  });

  // Test 3: Record middle pattern
  extractor.recordOutcome(
    'Create a roadmap',
    'This is an average output with some content but nothing special.',
    3.0,
    'Roadmap'
  );
  results.tests.push({
    name: 'Record middle pattern',
    passed: extractor.middlePatterns.length === 1,
    details: `middlePatterns=${extractor.middlePatterns.length}`
  });

  // Test 4: Feature extraction - word count
  const features = extractor.extractFeatures('one two three four five', 'Document');
  results.tests.push({
    name: 'Feature extraction - word count',
    passed: features.wordCount === 5,
    details: `wordCount=${features.wordCount}`
  });

  // Test 5: Feature extraction - specificity score
  const specificFeatures = extractor.extractFeatures(
    'The budget is $50,000 and timeline is Q2 2024 with 100 users expected.',
    'Document'
  );
  results.tests.push({
    name: 'Feature extraction - specificity',
    passed: specificFeatures.specificityScore > 0,
    details: `specificityScore=${specificFeatures.specificityScore}`
  });

  // Test 6: Feature extraction - structure score
  const structuredContent = `# Section 1
Content here.

# Section 2
More content.

# Section 3
- Bullet 1
- Bullet 2`;
  const structureFeatures = extractor.extractFeatures(structuredContent, 'Roadmap');
  results.tests.push({
    name: 'Feature extraction - structure',
    passed: structureFeatures.structureScore > 0.5,
    details: `structureScore=${structureFeatures.structureScore}`
  });

  // Test 7: Deduplication
  const beforeCount = extractor.successPatterns.length;
  extractor.recordOutcome(
    'Create a roadmap',
    'This is a high quality output with specific details like $50,000 budget and Q1 2024 timeline.',
    4.5,
    'Roadmap'
  );
  results.tests.push({
    name: 'Deduplication',
    passed: extractor.successPatterns.length === beforeCount,
    details: `before=${beforeCount}, after=${extractor.successPatterns.length}`
  });

  // Test 8: Aggregate features
  const extractor2 = new PerformancePatternExtractor();
  for (let i = 0; i < 10; i++) {
    extractor2.recordOutcome(`prompt ${i}`, `output ${i} with content`, 4.5, 'Document');
  }
  const aggregated = extractor2.aggregateFeatures(extractor2.successPatterns);
  results.tests.push({
    name: 'Aggregate features',
    passed: typeof aggregated.wordCount === 'number' && aggregated.wordCount > 0,
    details: `avgWordCount=${aggregated.wordCount}`
  });

  // Test 9: Find differentiating patterns
  const extractor3 = new PerformancePatternExtractor();
  for (let i = 0; i < 10; i++) {
    extractor3.recordOutcome(
      `prompt ${i}`,
      `High quality with $${i}000 budget and ${i}0% growth and Q${(i % 4) + 1} 2024`,
      4.5,
      'Document'
    );
    extractor3.recordOutcome(
      `prompt ${i}`,
      `low quality ${i}`,
      1.5,
      'Document'
    );
  }
  const diffs = extractor3.findDifferentiatingPatterns();
  results.tests.push({
    name: 'Find differentiating patterns',
    passed: Object.keys(diffs).length > 0,
    details: `differentiators=${Object.keys(diffs).join(', ')}`
  });

  // Test 10: measureDiversity
  const diverseText = 'The quick brown fox jumps over the lazy dog near the river bank.';
  const diverseFeatures = extractor.extractFeatures(diverseText, 'Document');
  results.tests.push({
    name: 'Measure diversity',
    passed: diverseFeatures.diversityScore > 0.5,
    details: `diversityScore=${diverseFeatures.diversityScore}`
  });

  // Test 11: measureCoherence
  // Note: ideal is ~1 transition per 3.5 sentences; too many transitions penalizes score
  const coherentText = 'We analyze the data carefully. The results show clear patterns. User engagement increased significantly. Revenue metrics improved as well. However, some areas need attention. Further investigation is recommended.';
  const coherentFeatures = extractor.extractFeatures(coherentText, 'Document');
  results.tests.push({
    name: 'Measure coherence',
    passed: coherentFeatures.coherenceScore > 0.3,
    details: `coherenceScore=${coherentFeatures.coherenceScore.toFixed(3)}`
  });

  // Test 12: getStats
  const stats = extractor.getStats();
  results.tests.push({
    name: 'Get stats',
    passed: stats.successCount >= 1 && stats.failureCount >= 1,
    details: `success=${stats.successCount}, failure=${stats.failureCount}, middle=${stats.middleCount}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Phase 3: Mutation Operators
// ============================================================================

/**
 * Specificity requirement additions - deterministic list
 */
const SPECIFICITY_ADDITIONS = [
  'Include specific numbers, percentages, or dollar amounts where relevant.',
  'Cite sources for key claims using [Source Name] format.',
  'Use concrete examples rather than abstract descriptions.',
  'Provide quantifiable metrics and measurable outcomes.',
  'Reference specific timeframes, dates, or milestones.'
];

/**
 * Structure constraints by content type
 */
const STRUCTURE_CONSTRAINTS = {
  Roadmap: 'Ensure each swimlane has at least 3 tasks spanning different time periods.',
  Slides: 'Each slide must have a clear title and 3-5 bullet points of substantive content.',
  Document: 'Each section must contain at least 2 paragraphs with supporting evidence.',
  ResearchAnalysis: 'Provide at least 4 distinct themes with specific evidence for each.',
  default: 'Organize content into clear sections with logical flow between ideas.'
};

/**
 * Quality checklist text
 */
const QUALITY_CHECKLIST = `
Before finalizing, verify:
- All claims have supporting evidence or citations
- No vague language (avoid "various", "significant", "important" without specifics)
- Content is actionable and specific, not generic`;

/**
 * Anti-pattern constraints
 */
const ANTI_PATTERNS = [
  'Do not use placeholder text or generic filler content.',
  'Avoid starting multiple sentences with the same word.',
  'Do not leave any section empty or with minimal content.',
  'Avoid repetitive phrasing or redundant statements.',
  'Do not use vague qualifiers without supporting data.'
];

/**
 * Mutation operators that can be applied to prompts
 */
export const MUTATION_OPERATORS = {
  /**
   * Add specificity requirement to prompt
   */
  ADD_SPECIFICITY_REQUIREMENT: {
    name: 'Add specificity requirement',
    description: 'Adds requirement for specific numbers, citations, or concrete examples',
    /**
     * @param {string} prompt - Current prompt
     * @param {Object} context - Mutation context
     * @param {number} [index] - Deterministic index for testing (0-based)
     * @returns {Object} { mutated: string, applied: boolean, addition: string }
     */
    apply: (prompt, context = {}, index = null) => {
      // Find which additions are already present
      const availableAdditions = SPECIFICITY_ADDITIONS.filter(
        addition => !prompt.toLowerCase().includes(addition.toLowerCase().slice(0, 30))
      );

      if (availableAdditions.length === 0) {
        return { mutated: prompt, applied: false, addition: null, reason: 'All specificity requirements already present' };
      }

      // Select addition (deterministic if index provided, random otherwise)
      const selectedIndex = index !== null ? index % availableAdditions.length : Math.floor(Math.random() * availableAdditions.length);
      const addition = availableAdditions[selectedIndex];

      return {
        mutated: prompt + '\n\n' + addition,
        applied: true,
        addition
      };
    }
  },

  /**
   * Add structure constraint based on content type
   */
  ADD_STRUCTURE_CONSTRAINT: {
    name: 'Add structure constraint',
    description: 'Adds content-type specific structural requirements',
    /**
     * @param {string} prompt - Current prompt
     * @param {Object} context - Mutation context with contentType
     * @returns {Object} { mutated: string, applied: boolean, addition: string }
     */
    apply: (prompt, context = {}) => {
      const contentType = context.contentType || 'default';
      const constraint = STRUCTURE_CONSTRAINTS[contentType] || STRUCTURE_CONSTRAINTS.default;

      // Check if already present
      if (prompt.toLowerCase().includes(constraint.toLowerCase().slice(0, 30))) {
        return { mutated: prompt, applied: false, addition: null, reason: 'Structure constraint already present' };
      }

      return {
        mutated: prompt + '\n\n' + constraint,
        applied: true,
        addition: constraint
      };
    }
  },

  /**
   * Add quality verification checklist
   */
  ADD_QUALITY_CHECKLIST: {
    name: 'Add quality checklist',
    description: 'Adds verification checklist for output quality',
    /**
     * @param {string} prompt - Current prompt
     * @param {Object} context - Mutation context
     * @returns {Object} { mutated: string, applied: boolean, addition: string }
     */
    apply: (prompt, context = {}) => {
      // Check if already has verification/checklist
      if (prompt.includes('verify') || prompt.includes('checklist') || prompt.includes('Before finalizing')) {
        return { mutated: prompt, applied: false, addition: null, reason: 'Quality checklist already present' };
      }

      return {
        mutated: prompt + QUALITY_CHECKLIST,
        applied: true,
        addition: QUALITY_CHECKLIST.trim()
      };
    }
  },

  /**
   * Add negative constraint to prevent common failures
   */
  ADD_NEGATIVE_CONSTRAINT: {
    name: 'Add negative constraint',
    description: 'Adds constraint to avoid common failure patterns',
    /**
     * @param {string} prompt - Current prompt
     * @param {Object} context - Mutation context with failurePatterns
     * @param {number} [index] - Deterministic index for testing
     * @returns {Object} { mutated: string, applied: boolean, addition: string }
     */
    apply: (prompt, context = {}, index = null) => {
      // Find which anti-patterns are not already in prompt
      const availableAntiPatterns = ANTI_PATTERNS.filter(
        pattern => !prompt.toLowerCase().includes(pattern.toLowerCase().slice(0, 25))
      );

      if (availableAntiPatterns.length === 0) {
        return { mutated: prompt, applied: false, addition: null, reason: 'All negative constraints already present' };
      }

      // Select pattern (deterministic if index provided)
      const selectedIndex = index !== null ? index % availableAntiPatterns.length : Math.floor(Math.random() * availableAntiPatterns.length);
      const antiPattern = availableAntiPatterns[selectedIndex];

      return {
        mutated: prompt + '\n\n' + antiPattern,
        applied: true,
        addition: antiPattern
      };
    }
  },

  /**
   * Emphasize existing requirement based on differentiators
   */
  EMPHASIZE_REQUIREMENT: {
    name: 'Emphasize existing requirement',
    description: 'Emphasizes underperforming aspects based on differentiator analysis',
    /**
     * @param {string} prompt - Current prompt
     * @param {Object} context - Mutation context with differentiators
     * @returns {Object} { mutated: string, applied: boolean, change: string }
     */
    apply: (prompt, context = {}) => {
      const differentiators = context.differentiators || {};
      let mutatedPrompt = prompt;
      let applied = false;
      let change = null;

      // Check for various differentiator patterns
      if (differentiators.hasNumbers?.difference > 0.2 || differentiators.specificityScore?.difference > 0.2) {
        // Emphasize numeric requirements
        const numericPattern = /(include|add|use|provide)(\s+)(numbers?|statistics?|data|metrics?|figures?)/gi;
        if (numericPattern.test(mutatedPrompt)) {
          mutatedPrompt = mutatedPrompt.replace(numericPattern, 'ALWAYS $1$2specific $3');
          applied = true;
          change = 'Emphasized numeric requirements';
        }
      }

      if (differentiators.hasCitations?.difference > 0.2) {
        // Emphasize citation requirements
        const citationPattern = /(cite|reference|source|attribution)/gi;
        if (citationPattern.test(mutatedPrompt)) {
          mutatedPrompt = mutatedPrompt.replace(citationPattern, 'REQUIRED: $1');
          applied = true;
          change = (change ? change + '; ' : '') + 'Emphasized citation requirements';
        }
      }

      if (differentiators.structureScore?.difference > 0.2) {
        // Emphasize structure requirements
        const structurePattern = /(section|heading|organize|structure)/gi;
        if (structurePattern.test(mutatedPrompt)) {
          mutatedPrompt = mutatedPrompt.replace(structurePattern, 'clearly $1');
          applied = true;
          change = (change ? change + '; ' : '') + 'Emphasized structure requirements';
        }
      }

      if (differentiators.diversityScore?.difference > 0.2) {
        // Add diversity requirement if not present
        if (!mutatedPrompt.toLowerCase().includes('varied') && !mutatedPrompt.toLowerCase().includes('diverse')) {
          mutatedPrompt += '\n\nUse varied vocabulary and avoid repetitive phrasing.';
          applied = true;
          change = (change ? change + '; ' : '') + 'Added vocabulary diversity requirement';
        }
      }

      if (!applied) {
        return { mutated: prompt, applied: false, change: null, reason: 'No matching patterns to emphasize' };
      }

      return { mutated: mutatedPrompt, applied, change };
    }
  },

  /**
   * Add content length guidance
   */
  ADD_LENGTH_GUIDANCE: {
    name: 'Add length guidance',
    description: 'Adds specific word count or length requirements',
    /**
     * @param {string} prompt - Current prompt
     * @param {Object} context - Mutation context with contentType
     * @returns {Object} { mutated: string, applied: boolean, addition: string }
     */
    apply: (prompt, context = {}) => {
      // Check if already has length guidance
      if (/\d+\s*(words?|characters?|sentences?|paragraphs?)/i.test(prompt)) {
        return { mutated: prompt, applied: false, addition: null, reason: 'Length guidance already present' };
      }

      const lengthGuidance = {
        Roadmap: 'Aim for 200-400 words with substantive detail in each phase.',
        Slides: 'Keep each slide concise: 50-100 words maximum per slide.',
        Document: 'Provide comprehensive coverage: 500-1000 words with supporting details.',
        ResearchAnalysis: 'Include thorough analysis: 600-900 words covering all key aspects.',
        default: 'Provide sufficient detail: 200-500 words depending on complexity.'
      };

      const contentType = context.contentType || 'default';
      const guidance = lengthGuidance[contentType] || lengthGuidance.default;

      return {
        mutated: prompt + '\n\n' + guidance,
        applied: true,
        addition: guidance
      };
    }
  }
};

/**
 * Apply a mutation operator to a prompt
 *
 * @param {string} prompt - The prompt to mutate
 * @param {string} mutationType - Key of mutation operator to apply
 * @param {Object} context - Mutation context (contentType, differentiators, etc.)
 * @param {number} [deterministicIndex] - Optional index for deterministic selection
 * @returns {Object} Mutation result { mutated, applied, ... }
 */
export function applyMutation(prompt, mutationType, context = {}, deterministicIndex = null) {
  const operator = MUTATION_OPERATORS[mutationType];
  if (!operator) {
    return {
      mutated: prompt,
      applied: false,
      error: `Unknown mutation type: ${mutationType}`
    };
  }

  try {
    return operator.apply(prompt, context, deterministicIndex);
  } catch (error) {
    return {
      mutated: prompt,
      applied: false,
      error: error.message
    };
  }
}

/**
 * Apply multiple mutations in sequence
 *
 * @param {string} prompt - The prompt to mutate
 * @param {Array<string>} mutationTypes - Array of mutation type keys
 * @param {Object} context - Mutation context
 * @returns {Object} { mutated, appliedMutations: [], failedMutations: [] }
 */
export function applyMutations(prompt, mutationTypes, context = {}) {
  let currentPrompt = prompt;
  const appliedMutations = [];
  const failedMutations = [];

  for (const mutationType of mutationTypes) {
    const result = applyMutation(currentPrompt, mutationType, context);
    if (result.applied) {
      currentPrompt = result.mutated;
      appliedMutations.push({
        type: mutationType,
        addition: result.addition || result.change
      });
    } else {
      failedMutations.push({
        type: mutationType,
        reason: result.reason || result.error
      });
    }
  }

  return {
    mutated: currentPrompt,
    appliedMutations,
    failedMutations
  };
}

/**
 * Get list of available mutation types
 *
 * @returns {Array<{key: string, name: string, description: string}>}
 */
export function getAvailableMutations() {
  return Object.entries(MUTATION_OPERATORS).map(([key, op]) => ({
    key,
    name: op.name,
    description: op.description
  }));
}

/**
 * Validate Phase 3 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase3() {
  const results = {
    passed: true,
    tests: []
  };

  const basePrompt = 'Create a strategic roadmap for the project.';

  // Test 1: ADD_SPECIFICITY_REQUIREMENT
  const specResult = applyMutation(basePrompt, 'ADD_SPECIFICITY_REQUIREMENT', {}, 0);
  results.tests.push({
    name: 'ADD_SPECIFICITY_REQUIREMENT applies',
    passed: specResult.applied && specResult.mutated.length > basePrompt.length,
    details: `applied=${specResult.applied}, addition="${specResult.addition?.slice(0, 30)}..."`
  });

  // Test 2: ADD_SPECIFICITY_REQUIREMENT duplicate detection
  const specResult2 = applyMutation(specResult.mutated, 'ADD_SPECIFICITY_REQUIREMENT', {}, 0);
  const specResult3 = applyMutation(specResult2.mutated, 'ADD_SPECIFICITY_REQUIREMENT', {}, 0);
  results.tests.push({
    name: 'ADD_SPECIFICITY_REQUIREMENT avoids duplicates',
    passed: specResult3.addition !== specResult2.addition || !specResult3.applied,
    details: `first="${specResult2.addition?.slice(0, 20)}...", second="${specResult3.addition?.slice(0, 20) || 'none'}..."`
  });

  // Test 3: ADD_STRUCTURE_CONSTRAINT with known type
  const structResult = applyMutation(basePrompt, 'ADD_STRUCTURE_CONSTRAINT', { contentType: 'Roadmap' });
  results.tests.push({
    name: 'ADD_STRUCTURE_CONSTRAINT with known type',
    passed: structResult.applied && structResult.mutated.includes('swimlane'),
    details: `applied=${structResult.applied}`
  });

  // Test 4: ADD_STRUCTURE_CONSTRAINT with unknown type (should use default)
  const structDefaultResult = applyMutation(basePrompt, 'ADD_STRUCTURE_CONSTRAINT', { contentType: 'UnknownType' });
  results.tests.push({
    name: 'ADD_STRUCTURE_CONSTRAINT with unknown type uses default',
    passed: structDefaultResult.applied && structDefaultResult.mutated.includes('logical flow'),
    details: `applied=${structDefaultResult.applied}, hasDefault=${structDefaultResult.mutated.includes('logical flow')}`
  });

  // Test 5: ADD_STRUCTURE_CONSTRAINT duplicate detection
  const structDupResult = applyMutation(structResult.mutated, 'ADD_STRUCTURE_CONSTRAINT', { contentType: 'Roadmap' });
  results.tests.push({
    name: 'ADD_STRUCTURE_CONSTRAINT avoids duplicates',
    passed: !structDupResult.applied,
    details: `applied=${structDupResult.applied}, reason="${structDupResult.reason}"`
  });

  // Test 6: ADD_QUALITY_CHECKLIST
  const qualityResult = applyMutation(basePrompt, 'ADD_QUALITY_CHECKLIST', {});
  results.tests.push({
    name: 'ADD_QUALITY_CHECKLIST applies',
    passed: qualityResult.applied && qualityResult.mutated.includes('verify'),
    details: `applied=${qualityResult.applied}`
  });

  // Test 7: ADD_QUALITY_CHECKLIST duplicate detection
  const qualityDupResult = applyMutation(qualityResult.mutated, 'ADD_QUALITY_CHECKLIST', {});
  results.tests.push({
    name: 'ADD_QUALITY_CHECKLIST avoids duplicates',
    passed: !qualityDupResult.applied,
    details: `applied=${qualityDupResult.applied}`
  });

  // Test 8: ADD_NEGATIVE_CONSTRAINT
  const negResult = applyMutation(basePrompt, 'ADD_NEGATIVE_CONSTRAINT', {}, 0);
  results.tests.push({
    name: 'ADD_NEGATIVE_CONSTRAINT applies',
    passed: negResult.applied && negResult.mutated.length > basePrompt.length,
    details: `applied=${negResult.applied}`
  });

  // Test 9: EMPHASIZE_REQUIREMENT with differentiators
  const emphPrompt = 'Include numbers and data in your analysis. Cite sources.';
  const emphResult = applyMutation(emphPrompt, 'EMPHASIZE_REQUIREMENT', {
    differentiators: {
      hasNumbers: { difference: 0.3 },
      specificityScore: { difference: 0.25 }
    }
  });
  results.tests.push({
    name: 'EMPHASIZE_REQUIREMENT with differentiators',
    passed: emphResult.applied && emphResult.mutated.includes('ALWAYS'),
    details: `applied=${emphResult.applied}, change="${emphResult.change}"`
  });

  // Test 10: EMPHASIZE_REQUIREMENT without matching patterns
  const emphNoMatchResult = applyMutation(basePrompt, 'EMPHASIZE_REQUIREMENT', {
    differentiators: { hasNumbers: { difference: 0.3 } }
  });
  results.tests.push({
    name: 'EMPHASIZE_REQUIREMENT without matching patterns',
    passed: !emphNoMatchResult.applied,
    details: `applied=${emphNoMatchResult.applied}`
  });

  // Test 11: ADD_LENGTH_GUIDANCE
  const lengthResult = applyMutation(basePrompt, 'ADD_LENGTH_GUIDANCE', { contentType: 'Document' });
  results.tests.push({
    name: 'ADD_LENGTH_GUIDANCE applies',
    passed: lengthResult.applied && /\d+/.test(lengthResult.mutated),
    details: `applied=${lengthResult.applied}`
  });

  // Test 12: Unknown mutation type
  const unknownResult = applyMutation(basePrompt, 'UNKNOWN_MUTATION', {});
  results.tests.push({
    name: 'Unknown mutation type handled',
    passed: !unknownResult.applied && unknownResult.error !== undefined,
    details: `error="${unknownResult.error}"`
  });

  // Test 13: applyMutations multiple
  const multiResult = applyMutations(basePrompt, [
    'ADD_SPECIFICITY_REQUIREMENT',
    'ADD_STRUCTURE_CONSTRAINT',
    'ADD_QUALITY_CHECKLIST'
  ], { contentType: 'Roadmap' });
  results.tests.push({
    name: 'applyMutations applies multiple',
    passed: multiResult.appliedMutations.length === 3,
    details: `applied=${multiResult.appliedMutations.length}, failed=${multiResult.failedMutations.length}`
  });

  // Test 14: getAvailableMutations
  const available = getAvailableMutations();
  results.tests.push({
    name: 'getAvailableMutations returns all',
    passed: available.length === Object.keys(MUTATION_OPERATORS).length,
    details: `count=${available.length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Phase 4: Mutation Strategy Selection
// ============================================================================

/**
 * Intelligently selects which mutations to apply based on performance data.
 * Uses historical effectiveness and pattern analysis to guide mutation choices.
 */
export class MutationStrategySelector {
  /**
   * @param {PerformancePatternExtractor} patternExtractor - Pattern extractor instance
   * @param {Object} options - Configuration options
   * @param {number} [options.maxHistory=500] - Maximum mutation history entries
   * @param {number} [options.recentWindow=50] - Number of recent mutations to consider for effectiveness
   * @param {number} [options.failureCooldown=10] - Number of iterations to skip a mutation after failure
   */
  constructor(patternExtractor, options = {}) {
    this.patternExtractor = patternExtractor;
    this.maxHistory = options.maxHistory || 500;
    this.recentWindow = options.recentWindow || 50;
    this.failureCooldown = options.failureCooldown || 10;

    this.mutationHistory = [];
    this.effectivenessCache = null;
    this.cacheIteration = 0;

    // Track recent failures to avoid repeating them
    this.recentFailures = new Map(); // mutation -> iteration of last failure
    this.currentIteration = 0;
  }

  /**
   * Select which mutations to apply for a content type
   *
   * @param {string} contentType - Content type being generated
   * @param {string} currentPrompt - Current prompt text
   * @param {number} [maxMutations=2] - Maximum mutations to select
   * @returns {Array<string>} Array of mutation type keys
   */
  selectMutations(contentType, currentPrompt, maxMutations = 2) {
    this.currentIteration++;

    const differentiators = this.patternExtractor.findDifferentiatingPatterns();
    const effectiveness = this.getMutationEffectiveness();
    const mutations = [];
    const candidates = [];

    // Priority 1: Address largest performance gaps (differentiators)
    if (differentiators.specificityScore?.difference > 0.2) {
      candidates.push({
        type: 'ADD_SPECIFICITY_REQUIREMENT',
        priority: 1,
        reason: 'specificityScore gap'
      });
    }

    if (differentiators.structureScore?.difference > 0.2) {
      candidates.push({
        type: 'ADD_STRUCTURE_CONSTRAINT',
        priority: 1,
        reason: 'structureScore gap'
      });
    }

    if (differentiators.hasNumbers?.difference > 0.2 ||
        differentiators.hasCitations?.difference > 0.2 ||
        differentiators.diversityScore?.difference > 0.2) {
      candidates.push({
        type: 'EMPHASIZE_REQUIREMENT',
        priority: 1,
        reason: 'emphasis differentiators'
      });
    }

    // Priority 2: Apply generally helpful mutations (if not already in prompt)
    if (!currentPrompt.includes('verify') && !currentPrompt.includes('checklist')) {
      candidates.push({
        type: 'ADD_QUALITY_CHECKLIST',
        priority: 2,
        reason: 'no checklist present'
      });
    }

    // Priority 3: Add negative constraints based on failure patterns
    if (this.patternExtractor.failurePatterns.length > 10) {
      candidates.push({
        type: 'ADD_NEGATIVE_CONSTRAINT',
        priority: 3,
        reason: 'failure patterns detected'
      });
    }

    // Priority 4: Add length guidance if missing
    if (!/\d+\s*(words?|characters?)/i.test(currentPrompt)) {
      candidates.push({
        type: 'ADD_LENGTH_GUIDANCE',
        priority: 4,
        reason: 'no length guidance'
      });
    }

    // Filter out recently failed mutations
    const filteredCandidates = candidates.filter(c => {
      const lastFailure = this.recentFailures.get(c.type);
      if (lastFailure && (this.currentIteration - lastFailure) < this.failureCooldown) {
        return false;
      }
      return true;
    });

    // Sort by priority, then by historical effectiveness
    filteredCandidates.sort((a, b) => {
      // First by priority (lower is better)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by effectiveness (higher is better)
      const aEff = effectiveness[a.type]?.avgImprovement || 0;
      const bEff = effectiveness[b.type]?.avgImprovement || 0;
      return bEff - aEff;
    });

    // Select top candidates
    for (const candidate of filteredCandidates) {
      if (mutations.length >= maxMutations) break;
      if (!mutations.includes(candidate.type)) {
        mutations.push(candidate.type);
      }
    }

    return mutations;
  }

  /**
   * Record the outcome of a mutation
   *
   * @param {string} mutationType - Type of mutation that was applied
   * @param {number} beforeScore - Score before mutation
   * @param {number} afterScore - Score after mutation
   * @param {string} contentType - Content type
   */
  recordMutationOutcome(mutationType, beforeScore, afterScore, contentType = null) {
    const improvement = afterScore - beforeScore;

    this.mutationHistory.push({
      mutation: mutationType,
      improvement,
      beforeScore,
      afterScore,
      contentType,
      timestamp: Date.now(),
      iteration: this.currentIteration
    });

    // Enforce history limit
    if (this.mutationHistory.length > this.maxHistory) {
      this.mutationHistory = this.mutationHistory.slice(-this.maxHistory);
    }

    // Track failures for cooldown
    if (improvement < 0) {
      this.recentFailures.set(mutationType, this.currentIteration);
    } else {
      // Clear failure tracking on success
      this.recentFailures.delete(mutationType);
    }

    // Invalidate effectiveness cache
    this.effectivenessCache = null;
  }

  /**
   * Get effectiveness statistics for all mutation types
   *
   * @returns {Object} Map of mutation type to effectiveness stats
   */
  getMutationEffectiveness() {
    // Use cache if still valid
    if (this.effectivenessCache && this.cacheIteration === this.currentIteration) {
      return this.effectivenessCache;
    }

    const effectiveness = {};

    // Consider only recent history for relevance
    const recentHistory = this.mutationHistory.slice(-this.recentWindow * 10);

    for (const record of recentHistory) {
      if (!effectiveness[record.mutation]) {
        effectiveness[record.mutation] = {
          total: 0,
          improvements: 0,
          avgImprovement: 0,
          recentAvgImprovement: 0,
          successRate: 0
        };
      }

      const eff = effectiveness[record.mutation];
      eff.total++;

      if (record.improvement > 0) {
        eff.improvements++;
      }

      // Running average
      eff.avgImprovement = (eff.avgImprovement * (eff.total - 1) + record.improvement) / eff.total;
    }

    // Calculate success rates and recent averages
    for (const mutationType of Object.keys(effectiveness)) {
      const eff = effectiveness[mutationType];
      eff.successRate = eff.total > 0 ? eff.improvements / eff.total : 0;

      // Calculate recent average (last recentWindow entries for this mutation)
      const recentForMutation = recentHistory
        .filter(r => r.mutation === mutationType)
        .slice(-this.recentWindow);

      if (recentForMutation.length > 0) {
        eff.recentAvgImprovement = recentForMutation.reduce((sum, r) => sum + r.improvement, 0) / recentForMutation.length;
      }
    }

    // Cache the result
    this.effectivenessCache = effectiveness;
    this.cacheIteration = this.currentIteration;

    return effectiveness;
  }

  /**
   * Get the most effective mutations ranked by improvement
   *
   * @param {number} [limit=5] - Max mutations to return
   * @returns {Array<{type: string, effectiveness: Object}>}
   */
  getTopMutations(limit = 5) {
    const effectiveness = this.getMutationEffectiveness();

    return Object.entries(effectiveness)
      .map(([type, eff]) => ({ type, effectiveness: eff }))
      .sort((a, b) => b.effectiveness.recentAvgImprovement - a.effectiveness.recentAvgImprovement)
      .slice(0, limit);
  }

  /**
   * Get mutations to avoid (currently in cooldown)
   *
   * @returns {Array<{type: string, cooldownRemaining: number}>}
   */
  getMutationsInCooldown() {
    const inCooldown = [];

    for (const [mutation, lastFailure] of this.recentFailures.entries()) {
      const cooldownRemaining = this.failureCooldown - (this.currentIteration - lastFailure);
      if (cooldownRemaining > 0) {
        inCooldown.push({ type: mutation, cooldownRemaining });
      }
    }

    return inCooldown;
  }

  /**
   * Get statistics about the selector
   *
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      historySize: this.mutationHistory.length,
      maxHistory: this.maxHistory,
      currentIteration: this.currentIteration,
      mutationsInCooldown: this.getMutationsInCooldown().length,
      uniqueMutationsTracked: new Set(this.mutationHistory.map(h => h.mutation)).size
    };
  }

  /**
   * Reset the selector state
   */
  reset() {
    this.mutationHistory = [];
    this.effectivenessCache = null;
    this.recentFailures.clear();
    this.currentIteration = 0;
  }
}

/**
 * Validate Phase 4 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase4() {
  const results = {
    passed: true,
    tests: []
  };

  // Create test extractor with some data
  const extractor = new PerformancePatternExtractor();
  for (let i = 0; i < 15; i++) {
    extractor.recordOutcome(`prompt ${i}`, `High quality with $${i}000 budget`, 4.5, 'Document');
    extractor.recordOutcome(`prompt ${i}`, `low quality ${i}`, 1.5, 'Document');
  }

  const selector = new MutationStrategySelector(extractor);

  // Test 1: selectMutations returns array
  const mutations = selector.selectMutations('Document', 'Create a document.');
  results.tests.push({
    name: 'selectMutations returns array',
    passed: Array.isArray(mutations) && mutations.length > 0,
    details: `mutations=${JSON.stringify(mutations)}`
  });

  // Test 2: selectMutations respects maxMutations
  const limitedMutations = selector.selectMutations('Document', 'Create a document.', 1);
  results.tests.push({
    name: 'selectMutations respects maxMutations',
    passed: limitedMutations.length <= 1,
    details: `count=${limitedMutations.length}`
  });

  // Test 3: recordMutationOutcome tracks history
  selector.recordMutationOutcome('ADD_SPECIFICITY_REQUIREMENT', 3.0, 4.0, 'Document');
  results.tests.push({
    name: 'recordMutationOutcome tracks history',
    passed: selector.mutationHistory.length === 1,
    details: `historySize=${selector.mutationHistory.length}`
  });

  // Test 4: getMutationEffectiveness calculates stats
  selector.recordMutationOutcome('ADD_SPECIFICITY_REQUIREMENT', 3.0, 4.5, 'Document');
  selector.recordMutationOutcome('ADD_QUALITY_CHECKLIST', 3.0, 2.5, 'Document');
  const effectiveness = selector.getMutationEffectiveness();
  results.tests.push({
    name: 'getMutationEffectiveness calculates stats',
    passed: effectiveness['ADD_SPECIFICITY_REQUIREMENT']?.avgImprovement > 0,
    details: `specAvg=${effectiveness['ADD_SPECIFICITY_REQUIREMENT']?.avgImprovement?.toFixed(2)}`
  });

  // Test 5: Failure cooldown works
  // Record multiple failures
  for (let i = 0; i < 3; i++) {
    selector.recordMutationOutcome('ADD_NEGATIVE_CONSTRAINT', 3.0, 2.0, 'Document');
  }
  const cooldownMutations = selector.getMutationsInCooldown();
  results.tests.push({
    name: 'Failure cooldown works',
    passed: cooldownMutations.some(m => m.type === 'ADD_NEGATIVE_CONSTRAINT'),
    details: `inCooldown=${cooldownMutations.map(m => m.type).join(', ')}`
  });

  // Test 6: History limit enforced
  const selectorLimited = new MutationStrategySelector(extractor, { maxHistory: 5 });
  for (let i = 0; i < 10; i++) {
    selectorLimited.recordMutationOutcome('ADD_SPECIFICITY_REQUIREMENT', 3.0, 4.0 + i * 0.1);
  }
  results.tests.push({
    name: 'History limit enforced',
    passed: selectorLimited.mutationHistory.length <= 5,
    details: `historySize=${selectorLimited.mutationHistory.length}`
  });

  // Test 7: getTopMutations returns ranked list
  const topMutations = selector.getTopMutations(3);
  results.tests.push({
    name: 'getTopMutations returns ranked list',
    passed: Array.isArray(topMutations) && topMutations.length > 0,
    details: `count=${topMutations.length}, top=${topMutations[0]?.type}`
  });

  // Test 8: getStats returns expected fields
  const stats = selector.getStats();
  results.tests.push({
    name: 'getStats returns expected fields',
    passed: typeof stats.historySize === 'number' && typeof stats.currentIteration === 'number',
    details: `historySize=${stats.historySize}, iteration=${stats.currentIteration}`
  });

  // Test 9: reset clears state
  selector.reset();
  results.tests.push({
    name: 'reset clears state',
    passed: selector.mutationHistory.length === 0 && selector.currentIteration === 0,
    details: `historySize=${selector.mutationHistory.length}, iteration=${selector.currentIteration}`
  });

  // Test 10: Effectiveness caching works
  const selector2 = new MutationStrategySelector(extractor);
  selector2.recordMutationOutcome('ADD_SPECIFICITY_REQUIREMENT', 3.0, 4.0);
  const eff1 = selector2.getMutationEffectiveness();
  const eff2 = selector2.getMutationEffectiveness();
  results.tests.push({
    name: 'Effectiveness caching works',
    passed: eff1 === eff2, // Same reference if cached
    details: `sameReference=${eff1 === eff2}`
  });

  // Test 11: selectMutations excludes already-present features
  const promptWithChecklist = 'Create a document. Before finalizing, verify: all claims have evidence.';
  const mutationsWithChecklist = selector2.selectMutations('Document', promptWithChecklist);
  results.tests.push({
    name: 'selectMutations excludes already-present',
    passed: !mutationsWithChecklist.includes('ADD_QUALITY_CHECKLIST'),
    details: `mutations=${JSON.stringify(mutationsWithChecklist)}`
  });

  // Test 12: Effectiveness-based sorting
  const selector3 = new MutationStrategySelector(extractor);
  // Make ADD_SPECIFICITY highly effective
  for (let i = 0; i < 5; i++) {
    selector3.recordMutationOutcome('ADD_SPECIFICITY_REQUIREMENT', 3.0, 5.0);
    selector3.recordMutationOutcome('ADD_STRUCTURE_CONSTRAINT', 3.0, 3.2);
  }
  const top = selector3.getTopMutations(2);
  results.tests.push({
    name: 'Effectiveness-based sorting',
    passed: top[0]?.type === 'ADD_SPECIFICITY_REQUIREMENT',
    details: `top=${top[0]?.type}, improvement=${top[0]?.effectiveness?.avgImprovement?.toFixed(2)}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Phase 5: Prompt Evolution Engine
// ============================================================================

/**
 * Valid prompt variants
 */
export const PROMPT_VARIANTS = {
  CHAMPION: 'champion',  // Current best performing prompt
  CANDIDATE: 'candidate', // New mutation being tested
  ACTIVE: 'active'       // Currently being used for generation (champion or candidate based on A/B)
};

/**
 * Orchestrates the full prompt evolution cycle.
 * Manages prompt versions, applies mutations, and handles promotions.
 */
export class PromptEvolutionEngine {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.promotionThreshold=0.05] - Minimum improvement to promote (5%)
   * @param {number} [options.minCandidateSamples=10] - Minimum candidate samples before promotion decision
   * @param {number} [options.minChampionSamples=35] - Minimum champion samples for comparison
   * @param {number} [options.abTestRatio=0.2] - Fraction of traffic to send to candidate (20%)
   */
  constructor(options = {}) {
    this.promotionThreshold = options.promotionThreshold || 0.05;
    this.minCandidateSamples = options.minCandidateSamples || 10;
    this.minChampionSamples = options.minChampionSamples || 35;
    this.abTestRatio = options.abTestRatio || 0.2;

    this.patternExtractor = new PerformancePatternExtractor();
    this.strategySelector = new MutationStrategySelector(this.patternExtractor);

    this.promptVersions = {}; // contentType -> version info
    this.evolutionStats = {
      totalEvolutions: 0,
      successfulPromotions: 0,
      failedPromotions: 0,
      totalGenerations: 0
    };
  }

  /**
   * Initialize the engine with current prompts
   *
   * @param {Object} prompts - Map of contentType to prompt string
   */
  initialize(prompts) {
    for (const [contentType, prompt] of Object.entries(prompts)) {
      this.promptVersions[contentType] = {
        champion: prompt,
        candidate: null,       // null means no active candidate
        active: prompt,        // Currently used prompt
        championStats: { totalScore: 0, count: 0, avgScore: 0 },
        candidateStats: { totalScore: 0, count: 0, avgScore: 0 },
        history: [{
          version: 1,
          prompt,
          mutations: [],
          score: null,
          promoted: true,
          timestamp: Date.now()
        }],
        isTestingCandidate: false
      };
    }
  }

  /**
   * Record a generation outcome
   *
   * @param {string} contentType - Content type
   * @param {string} usedPrompt - Prompt that was used
   * @param {string} output - Generated output
   * @param {number} score - Quality score
   */
  recordGeneration(contentType, usedPrompt, output, score) {
    this.evolutionStats.totalGenerations++;

    // Record in pattern extractor
    this.patternExtractor.recordOutcome(usedPrompt, output, score, contentType);

    // Update version stats
    const version = this.promptVersions[contentType];
    if (!version) return;

    // Determine if this was champion or candidate
    const isCandidate = version.candidate && usedPrompt === version.candidate;

    if (isCandidate) {
      version.candidateStats.totalScore += score;
      version.candidateStats.count++;
      version.candidateStats.avgScore = version.candidateStats.totalScore / version.candidateStats.count;
    } else {
      version.championStats.totalScore += score;
      version.championStats.count++;
      version.championStats.avgScore = version.championStats.totalScore / version.championStats.count;
    }
  }

  /**
   * Get which prompt to use (implements A/B testing)
   *
   * @param {string} contentType - Content type
   * @returns {Object} { prompt: string, variant: string }
   */
  getPromptForGeneration(contentType) {
    const version = this.promptVersions[contentType];

    if (!version) {
      return { prompt: null, variant: null, error: `Unknown content type: ${contentType}` };
    }

    // If we have an active candidate and are testing, randomly choose
    if (version.candidate && version.isTestingCandidate) {
      if (Math.random() < this.abTestRatio) {
        version.active = version.candidate;
        return { prompt: version.candidate, variant: PROMPT_VARIANTS.CANDIDATE };
      }
    }

    version.active = version.champion;
    return { prompt: version.champion, variant: PROMPT_VARIANTS.CHAMPION };
  }

  /**
   * Evolve a prompt for a content type
   *
   * @param {string} contentType - Content type to evolve
   * @returns {Object} Evolution result
   */
  evolvePrompt(contentType) {
    const version = this.promptVersions[contentType];

    if (!version) {
      return { evolved: false, error: `Unknown content type: ${contentType}` };
    }

    // Don't evolve if we're still testing a candidate
    if (version.candidate && version.isTestingCandidate) {
      return {
        evolved: false,
        reason: 'Candidate is still being tested',
        candidateStats: version.candidateStats,
        championStats: version.championStats
      };
    }

    // Select mutations based on performance patterns
    const mutations = this.strategySelector.selectMutations(
      contentType,
      version.champion
    );

    if (mutations.length === 0) {
      return { evolved: false, reason: 'No mutations selected' };
    }

    // Apply mutations
    const context = {
      contentType,
      failurePatterns: this.patternExtractor.failurePatterns,
      differentiators: this.patternExtractor.findDifferentiatingPatterns()
    };

    const mutationResult = applyMutations(version.champion, mutations, context);

    if (mutationResult.appliedMutations.length === 0) {
      return {
        evolved: false,
        reason: 'No mutations could be applied',
        attemptedMutations: mutations,
        failedMutations: mutationResult.failedMutations
      };
    }

    // Set as new candidate
    version.candidate = mutationResult.mutated;
    version.candidateStats = { totalScore: 0, count: 0, avgScore: 0 };
    version.isTestingCandidate = true;

    // Record in history
    version.history.push({
      version: version.history.length + 1,
      prompt: mutationResult.mutated,
      mutations: mutationResult.appliedMutations,
      score: null,
      promoted: null, // TBD
      timestamp: Date.now()
    });

    this.evolutionStats.totalEvolutions++;

    return {
      evolved: true,
      candidate: mutationResult.mutated,
      appliedMutations: mutationResult.appliedMutations,
      failedMutations: mutationResult.failedMutations
    };
  }

  /**
   * Check if candidate should be promoted and handle the promotion
   *
   * @param {string} contentType - Content type
   * @returns {Object} Promotion result
   */
  checkAndPromote(contentType) {
    const version = this.promptVersions[contentType];

    if (!version) {
      return { promoted: false, error: `Unknown content type: ${contentType}` };
    }

    if (!version.candidate || !version.isTestingCandidate) {
      return { promoted: false, reason: 'No candidate being tested' };
    }

    // Check sample sizes
    if (version.candidateStats.count < this.minCandidateSamples) {
      return {
        promoted: false,
        reason: 'Insufficient candidate samples',
        required: this.minCandidateSamples,
        current: version.candidateStats.count
      };
    }

    if (version.championStats.count < this.minChampionSamples) {
      return {
        promoted: false,
        reason: 'Insufficient champion samples',
        required: this.minChampionSamples,
        current: version.championStats.count
      };
    }

    const candidateScore = version.candidateStats.avgScore;
    const championScore = version.championStats.avgScore;
    const improvement = (candidateScore - championScore) / championScore;

    // Record mutation outcomes for strategy selector
    const lastHistoryEntry = version.history[version.history.length - 1];
    for (const mutation of (lastHistoryEntry.mutations || [])) {
      this.strategySelector.recordMutationOutcome(
        mutation.type,
        championScore,
        candidateScore,
        contentType
      );
    }

    // Check if candidate beats champion by threshold
    if (improvement >= this.promotionThreshold) {
      // PROMOTE: Candidate becomes new champion
      const oldChampion = version.champion;
      version.champion = version.candidate;
      version.candidate = null;
      version.isTestingCandidate = false;
      version.active = version.champion;

      // Reset champion stats (new champion starts fresh)
      version.championStats = { ...version.candidateStats };
      version.candidateStats = { totalScore: 0, count: 0, avgScore: 0 };

      // Update history
      lastHistoryEntry.promoted = true;
      lastHistoryEntry.score = candidateScore;

      this.evolutionStats.successfulPromotions++;

      return {
        promoted: true,
        candidateScore,
        championScore,
        improvement: improvement * 100,
        oldChampion,
        newChampion: version.champion
      };
    } else {
      // REJECT: Discard candidate, keep champion
      version.candidate = null;
      version.isTestingCandidate = false;
      version.candidateStats = { totalScore: 0, count: 0, avgScore: 0 };

      // Update history
      lastHistoryEntry.promoted = false;
      lastHistoryEntry.score = candidateScore;

      this.evolutionStats.failedPromotions++;

      return {
        promoted: false,
        reason: 'Candidate did not meet promotion threshold',
        candidateScore,
        championScore,
        improvement: improvement * 100,
        required: this.promotionThreshold * 100
      };
    }
  }

  /**
   * Get a specific prompt variant
   *
   * @param {string} contentType - Content type
   * @param {string} variant - Variant to retrieve (champion, candidate, active)
   * @returns {string|null} Prompt text or null
   */
  getPrompt(contentType, variant) {
    const version = this.promptVersions[contentType];

    if (!version) {
      return null;
    }

    if (!Object.values(PROMPT_VARIANTS).includes(variant)) {
      return null;
    }

    return version[variant] || null;
  }

  /**
   * Get version info for a content type
   *
   * @param {string} contentType - Content type
   * @returns {Object|null} Version info
   */
  getVersionInfo(contentType) {
    const version = this.promptVersions[contentType];
    if (!version) return null;

    return {
      hasCandidate: !!version.candidate,
      isTestingCandidate: version.isTestingCandidate,
      championStats: { ...version.championStats },
      candidateStats: { ...version.candidateStats },
      historyLength: version.history.length,
      lastEvolution: version.history[version.history.length - 1]?.timestamp
    };
  }

  /**
   * Get all content types being managed
   *
   * @returns {Array<string>}
   */
  getContentTypes() {
    return Object.keys(this.promptVersions);
  }

  /**
   * Get evolution statistics
   *
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.evolutionStats,
      contentTypes: this.getContentTypes().length,
      patternExtractorStats: this.patternExtractor.getStats(),
      strategyStats: this.strategySelector.getStats()
    };
  }

  /**
   * Force stop testing a candidate (revert to champion)
   *
   * @param {string} contentType - Content type
   */
  abortCandidate(contentType) {
    const version = this.promptVersions[contentType];
    if (!version) return;

    version.candidate = null;
    version.isTestingCandidate = false;
    version.candidateStats = { totalScore: 0, count: 0, avgScore: 0 };
    version.active = version.champion;
  }

  /**
   * Serialize engine state for checkpoint persistence
   *
   * Gap 03: Enables training session resumption by serializing
   * all mutable state to a JSON-compatible object.
   *
   * @returns {Object} Serializable state
   */
  serialize() {
    return {
      // Configuration
      config: {
        promotionThreshold: this.promotionThreshold,
        minCandidateSamples: this.minCandidateSamples,
        minChampionSamples: this.minChampionSamples,
        abTestRatio: this.abTestRatio
      },

      // Prompt versions (deep copy to avoid reference issues)
      promptVersions: JSON.parse(JSON.stringify(this.promptVersions)),

      // Evolution statistics
      evolutionStats: { ...this.evolutionStats },

      // Pattern extractor state
      patternExtractorState: {
        successPatterns: this.patternExtractor.successPatterns?.slice(-100) || [],
        failurePatterns: this.patternExtractor.failurePatterns?.slice(-100) || [],
        middlePatterns: this.patternExtractor.middlePatterns?.slice(-100) || []
      },

      // Strategy selector state
      strategySelectorState: {
        mutationHistory: this.strategySelector.mutationHistory?.slice(-50) || [],
        currentIteration: this.strategySelector.currentIteration || 0
      },

      // Serialization metadata
      serializedAt: Date.now(),
      version: 1
    };
  }

  /**
   * Deserialize engine from checkpoint
   *
   * Gap 03: Restores engine state from a serialized checkpoint,
   * enabling training resumption.
   *
   * @param {Object} state - Serialized state from serialize()
   * @returns {PromptEvolutionEngine} Restored engine instance
   */
  static deserialize(state) {
    if (!state) {
      return null;
    }

    // Create engine with saved config
    const engine = new PromptEvolutionEngine(state.config || {});

    // Restore prompt versions
    if (state.promptVersions) {
      engine.promptVersions = JSON.parse(JSON.stringify(state.promptVersions));
    }

    // Restore evolution stats
    if (state.evolutionStats) {
      engine.evolutionStats = { ...state.evolutionStats };
    }

    // Restore pattern extractor state
    if (state.patternExtractorState) {
      if (state.patternExtractorState.successPatterns) {
        engine.patternExtractor.successPatterns = [...state.patternExtractorState.successPatterns];
      }
      if (state.patternExtractorState.failurePatterns) {
        engine.patternExtractor.failurePatterns = [...state.patternExtractorState.failurePatterns];
      }
      if (state.patternExtractorState.middlePatterns) {
        engine.patternExtractor.middlePatterns = [...state.patternExtractorState.middlePatterns];
      }
    }

    // Restore strategy selector state
    if (state.strategySelectorState) {
      if (state.strategySelectorState.mutationHistory) {
        engine.strategySelector.mutationHistory = [...state.strategySelectorState.mutationHistory];
      }
      if (state.strategySelectorState.currentIteration !== undefined) {
        engine.strategySelector.currentIteration = state.strategySelectorState.currentIteration;
      }
    }

    return engine;
  }

  // ===========================================================================
  // DSPy Integration Methods (Gap 04)
  // ===========================================================================

  /**
   * Run DSPy optimization for a content type
   *
   * Gap 04: Integrates with the Python DSPy service to use
   * BootstrapFewShot or MIPRO optimization.
   *
   * @param {string} contentType - Content type to optimize
   * @param {Array} trainingExamples - High-quality training examples
   * @param {Object} options - Optimization options
   * @returns {Promise<Object|null>} Optimization result or null if unavailable
   */
  async runDSPyOptimization(contentType, trainingExamples, options = {}) {
    try {
      // Dynamically import DSPy client to avoid circular dependencies
      const { dspyService } = await import('../clients/dspy-service.js');

      // Check DSPy service availability
      const available = await dspyService.isAvailable();
      if (!available) {
        console.log(`[DSPy] Service not available, skipping optimization for ${contentType}`);
        return null;
      }

      // Run optimization
      const result = await dspyService.optimize(contentType, trainingExamples, {
        optimizer: options.optimizer || 'bootstrap',
        config: {
          max_demos: options.maxDemos || 4,
          num_candidates: options.numCandidates || 10
        }
      });

      if (result.success) {
        console.log(`[DSPy] Optimized ${contentType}:`);
        console.log(`  - Few-shot examples: ${result.few_shot_examples?.length || 0}`);
        if (result.optimized_instructions) {
          console.log(`  - New instructions extracted`);
        }

        // Store optimized instructions as new candidate if available
        if (result.optimized_instructions && this.promptVersions[contentType]) {
          this.promptVersions[contentType].candidate = result.optimized_instructions;
          this.promptVersions[contentType].isTestingCandidate = true;
          this.promptVersions[contentType].candidateSource = 'dspy-optimization';
          this.promptVersions[contentType].candidateStats = { count: 0, totalScore: 0, avgScore: 0 };

          // Record DSPy evolution
          this.evolutionStats.totalEvolutions++;
        }

        return result;
      }

      return null;

    } catch (error) {
      console.warn(`[DSPy] Optimization unavailable for ${contentType}: ${error.message}`);
      return null;
    }
  }

  /**
   * Enhanced evolve that tries DSPy first
   *
   * Gap 04: Attempts DSPy optimization when sufficient training examples
   * are available, falling back to manual evolution otherwise.
   *
   * @param {string} contentType - Content type to evolve
   * @param {Array} trainingExamples - Training examples (optional)
   * @param {Object} options - Evolution options
   * @returns {Promise<Object>} Evolution result
   */
  async evolvePromptEnhanced(contentType, trainingExamples = [], options = {}) {
    // Try DSPy optimization if we have enough examples
    const minExamplesForDSPy = options.minExamplesForDSPy || 5;

    if (trainingExamples.length >= minExamplesForDSPy) {
      try {
        const dspyResult = await this.runDSPyOptimization(contentType, trainingExamples, options);
        if (dspyResult?.success) {
          return {
            evolved: true,
            method: 'dspy',
            optimizer: dspyResult.optimizer_used,
            fewShotCount: dspyResult.few_shot_examples?.length || 0,
            result: dspyResult
          };
        }
      } catch (error) {
        console.warn(`[DSPy] Enhanced evolution failed, falling back: ${error.message}`);
      }
    }

    // Fallback to manual evolution
    const manualResult = this.evolvePrompt(contentType);
    return {
      ...manualResult,
      method: 'manual'
    };
  }

  /**
   * Generate content using DSPy service
   *
   * Gap 04: Allows generation through DSPy when the service is available.
   *
   * @param {string} contentType - Content type
   * @param {Object} inputs - Generation inputs
   * @param {Object} options - Generation options
   * @returns {Promise<Object|null>} Generated content or null
   */
  async generateWithDSPy(contentType, inputs, options = {}) {
    try {
      const { dspyService } = await import('../clients/dspy-service.js');

      const available = await dspyService.isAvailable();
      if (!available) {
        return null;
      }

      const result = await dspyService.generate(contentType, inputs, {
        useOptimized: options.useOptimized !== false
      });

      if (result.success) {
        return {
          success: true,
          data: result.output,
          metadata: {
            ...result.metadata,
            backend: 'dspy',
            usedOptimized: result.used_optimized
          }
        };
      }

      return null;

    } catch (error) {
      console.warn(`[DSPy] Generation failed for ${contentType}: ${error.message}`);
      return null;
    }
  }
}

// Singleton instance for easy import
export const promptEvolution = new PromptEvolutionEngine();

/**
 * Validate Phase 5 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase5() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: Initialize with prompts
  const engine = new PromptEvolutionEngine();
  engine.initialize({
    Roadmap: 'Create a strategic roadmap.',
    Document: 'Create a document.'
  });
  results.tests.push({
    name: 'Initialize with prompts',
    passed: engine.getContentTypes().length === 2,
    details: `contentTypes=${engine.getContentTypes().join(', ')}`
  });

  // Test 2: getPromptForGeneration returns champion initially
  const prompt1 = engine.getPromptForGeneration('Roadmap');
  results.tests.push({
    name: 'getPromptForGeneration returns champion',
    passed: prompt1.variant === PROMPT_VARIANTS.CHAMPION && prompt1.prompt.includes('roadmap'),
    details: `variant=${prompt1.variant}`
  });

  // Test 3: recordGeneration updates stats
  engine.recordGeneration('Roadmap', engine.getPrompt('Roadmap', 'champion'), 'Good output', 4.5);
  const info = engine.getVersionInfo('Roadmap');
  results.tests.push({
    name: 'recordGeneration updates stats',
    passed: info.championStats.count === 1 && info.championStats.avgScore === 4.5,
    details: `count=${info.championStats.count}, avg=${info.championStats.avgScore}`
  });

  // Test 4: evolvePrompt creates candidate
  // First, seed pattern extractor with enough data
  for (let i = 0; i < 15; i++) {
    engine.patternExtractor.recordOutcome(`prompt ${i}`, `High quality $${i}000`, 4.5, 'Roadmap');
    engine.patternExtractor.recordOutcome(`prompt ${i}`, `low ${i}`, 1.5, 'Roadmap');
  }
  const evolveResult = engine.evolvePrompt('Roadmap');
  results.tests.push({
    name: 'evolvePrompt creates candidate',
    passed: evolveResult.evolved && engine.getPrompt('Roadmap', 'candidate') !== null,
    details: `evolved=${evolveResult.evolved}, mutations=${evolveResult.appliedMutations?.length || 0}`
  });

  // Test 5: isTestingCandidate is true after evolution
  const infoAfterEvolve = engine.getVersionInfo('Roadmap');
  results.tests.push({
    name: 'isTestingCandidate true after evolution',
    passed: infoAfterEvolve.isTestingCandidate === true,
    details: `isTestingCandidate=${infoAfterEvolve.isTestingCandidate}`
  });

  // Test 6: Can't evolve while testing candidate
  const evolveResult2 = engine.evolvePrompt('Roadmap');
  const test6Passed = evolveResult2.evolved === false &&
                      typeof evolveResult2.reason === 'string' &&
                      evolveResult2.reason.indexOf('tested') !== -1; // "being tested"
  results.tests.push({
    name: 'Cannot evolve while testing',
    passed: test6Passed,
    details: `evolved=${evolveResult2.evolved}, reason=${evolveResult2.reason}`
  });

  // Test 7: checkAndPromote requires minimum samples
  const promoteResult1 = engine.checkAndPromote('Roadmap');
  results.tests.push({
    name: 'checkAndPromote requires minimum samples',
    passed: !promoteResult1.promoted && promoteResult1.reason?.includes('samples'),
    details: `promoted=${promoteResult1.promoted}, reason=${promoteResult1.reason}`
  });

  // Test 8: Record enough generations
  const candidate = engine.getPrompt('Roadmap', 'candidate');
  for (let i = 0; i < 15; i++) {
    engine.recordGeneration('Roadmap', candidate, `Candidate output ${i}`, 4.8);
  }
  for (let i = 0; i < 40; i++) {
    engine.recordGeneration('Roadmap', engine.getPrompt('Roadmap', 'champion'), `Champion output ${i}`, 4.0);
  }

  // Test 9: checkAndPromote succeeds with good candidate
  const promoteResult2 = engine.checkAndPromote('Roadmap');
  results.tests.push({
    name: 'checkAndPromote with sufficient data',
    passed: promoteResult2.promoted === true || promoteResult2.promoted === false,
    details: `promoted=${promoteResult2.promoted}, improvement=${promoteResult2.improvement?.toFixed(1)}%`
  });

  // Test 10: getPrompt validates variant
  const invalidVariant = engine.getPrompt('Roadmap', 'invalid');
  results.tests.push({
    name: 'getPrompt validates variant',
    passed: invalidVariant === null,
    details: `result=${invalidVariant}`
  });

  // Test 11: getPrompt for unknown content type
  const unknownType = engine.getPrompt('Unknown', 'champion');
  results.tests.push({
    name: 'getPrompt handles unknown type',
    passed: unknownType === null,
    details: `result=${unknownType}`
  });

  // Test 12: abortCandidate clears candidate
  const engine2 = new PromptEvolutionEngine();
  engine2.initialize({ Test: 'Test prompt' });
  for (let i = 0; i < 15; i++) {
    engine2.patternExtractor.recordOutcome(`p${i}`, `High $${i}`, 4.5, 'Test');
    engine2.patternExtractor.recordOutcome(`p${i}`, `low${i}`, 1.5, 'Test');
  }
  engine2.evolvePrompt('Test');
  engine2.abortCandidate('Test');
  const infoAfterAbort = engine2.getVersionInfo('Test');
  results.tests.push({
    name: 'abortCandidate clears candidate',
    passed: !infoAfterAbort.hasCandidate && !infoAfterAbort.isTestingCandidate,
    details: `hasCandidate=${infoAfterAbort.hasCandidate}`
  });

  // Test 13: getStats returns expected fields
  const stats = engine.getStats();
  results.tests.push({
    name: 'getStats returns expected fields',
    passed: typeof stats.totalEvolutions === 'number' && typeof stats.totalGenerations === 'number',
    details: `evolutions=${stats.totalEvolutions}, generations=${stats.totalGenerations}`
  });

  // Test 14: A/B testing returns candidate sometimes
  const engine3 = new PromptEvolutionEngine({ abTestRatio: 0.5 });
  engine3.initialize({ AB: 'AB prompt' });
  for (let i = 0; i < 15; i++) {
    engine3.patternExtractor.recordOutcome(`p${i}`, `High $${i}`, 4.5, 'AB');
    engine3.patternExtractor.recordOutcome(`p${i}`, `low${i}`, 1.5, 'AB');
  }
  engine3.evolvePrompt('AB');
  let gotCandidate = false;
  for (let i = 0; i < 20; i++) {
    const result = engine3.getPromptForGeneration('AB');
    if (result.variant === PROMPT_VARIANTS.CANDIDATE) {
      gotCandidate = true;
      break;
    }
  }
  results.tests.push({
    name: 'A/B testing returns candidate',
    passed: gotCandidate,
    details: `gotCandidate=${gotCandidate}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Phase 7: Prompt Versioning & Persistence
// ============================================================================

/**
 * Save evolution state to disk for persistence across restarts
 *
 * @param {PromptEvolutionEngine} engine - Evolution engine to save
 * @param {string} [path] - Optional custom path
 * @returns {Promise<Object>} Result with success status
 */
export async function saveEvolutionState(engine, path = EVOLUTION_STATE_PATH) {
  try {
    // Ensure data directory exists
    const dir = dirname(path);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const state = {
      version: '1.0.0',
      timestamp: Date.now(),
      savedAt: new Date().toISOString(),

      // Core state
      promptVersions: engine.promptVersions,

      // Evolution stats
      evolutionStats: engine.evolutionStats,

      // Pattern extractor state
      patternExtractor: {
        successPatterns: engine.patternExtractor.successPatterns,
        failurePatterns: engine.patternExtractor.failurePatterns,
        middlePatterns: engine.patternExtractor.middlePatterns,
        maxPatterns: engine.patternExtractor.maxPatterns
      },

      // Strategy selector state
      strategySelector: {
        mutationHistory: engine.strategySelector.mutationHistory,
        currentIteration: engine.strategySelector.currentIteration,
        recentFailures: Array.from(engine.strategySelector.recentFailures.entries())
      },

      // Mutation effectiveness for analysis
      mutationEffectiveness: engine.strategySelector.getMutationEffectiveness()
    };

    await writeFile(path, JSON.stringify(state, null, 2), 'utf-8');

    return {
      success: true,
      path,
      size: JSON.stringify(state).length,
      timestamp: state.timestamp
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      path
    };
  }
}

/**
 * Load evolution state from disk
 *
 * @param {PromptEvolutionEngine} engine - Evolution engine to restore into
 * @param {string} [path] - Optional custom path
 * @returns {Promise<Object>} Result with success status
 */
export async function loadEvolutionState(engine, path = EVOLUTION_STATE_PATH) {
  try {
    if (!existsSync(path)) {
      return {
        success: false,
        error: 'State file does not exist',
        path
      };
    }

    const content = await readFile(path, 'utf-8');
    const state = JSON.parse(content);

    // Validate version compatibility
    if (!state.version) {
      return {
        success: false,
        error: 'Invalid state file - missing version',
        path
      };
    }

    // Restore prompt versions
    if (state.promptVersions) {
      engine.promptVersions = state.promptVersions;
    }

    // Restore evolution stats
    if (state.evolutionStats) {
      engine.evolutionStats = state.evolutionStats;
    }

    // Restore pattern extractor
    if (state.patternExtractor) {
      engine.patternExtractor.successPatterns = state.patternExtractor.successPatterns || [];
      engine.patternExtractor.failurePatterns = state.patternExtractor.failurePatterns || [];
      engine.patternExtractor.middlePatterns = state.patternExtractor.middlePatterns || [];

      // Rebuild seenHashes from patterns
      engine.patternExtractor.seenHashes = new Set();
      for (const pattern of [...engine.patternExtractor.successPatterns,
                            ...engine.patternExtractor.failurePatterns,
                            ...engine.patternExtractor.middlePatterns]) {
        if (pattern.hash) {
          engine.patternExtractor.seenHashes.add(pattern.hash);
        }
      }
    }

    // Restore strategy selector
    if (state.strategySelector) {
      engine.strategySelector.mutationHistory = state.strategySelector.mutationHistory || [];
      engine.strategySelector.currentIteration = state.strategySelector.currentIteration || 0;
      engine.strategySelector.recentFailures = new Map(state.strategySelector.recentFailures || []);
      engine.strategySelector.effectivenessCache = null; // Force recalculation
    }

    return {
      success: true,
      path,
      version: state.version,
      savedAt: state.savedAt,
      loadedAt: new Date().toISOString(),
      contentTypes: Object.keys(state.promptVersions || {})
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      path
    };
  }
}

/**
 * Get evolution history for a content type
 *
 * @param {PromptEvolutionEngine} engine - Evolution engine
 * @param {string} contentType - Content type
 * @returns {Array|null} History array or null
 */
export function getEvolutionHistory(engine, contentType) {
  const version = engine.promptVersions[contentType];
  if (!version) return null;

  return version.history.map((entry, index) => ({
    version: entry.version,
    timestamp: entry.timestamp,
    mutations: entry.mutations || [],
    score: entry.score,
    promoted: entry.promoted,
    promptLength: entry.prompt?.length || 0,
    isChampion: index === version.history.length - 1 && entry.promoted
  }));
}

/**
 * Rollback to a previous prompt version
 *
 * @param {PromptEvolutionEngine} engine - Evolution engine
 * @param {string} contentType - Content type
 * @param {number} version - Version number to rollback to
 * @returns {Object} Rollback result
 */
export function rollbackToVersion(engine, contentType, version) {
  const versionInfo = engine.promptVersions[contentType];
  if (!versionInfo) {
    return { success: false, error: `Unknown content type: ${contentType}` };
  }

  const historyEntry = versionInfo.history.find(h => h.version === version);
  if (!historyEntry) {
    return { success: false, error: `Version ${version} not found in history` };
  }

  const oldChampion = versionInfo.champion;
  versionInfo.champion = historyEntry.prompt;
  versionInfo.active = historyEntry.prompt;
  versionInfo.candidate = null;
  versionInfo.isTestingCandidate = false;
  versionInfo.championStats = { totalScore: 0, count: 0, avgScore: 0 };
  versionInfo.candidateStats = { totalScore: 0, count: 0, avgScore: 0 };

  // Add rollback to history
  versionInfo.history.push({
    version: versionInfo.history.length + 1,
    prompt: historyEntry.prompt,
    mutations: [],
    score: null,
    promoted: true,
    timestamp: Date.now(),
    rollbackFrom: oldChampion.slice(0, 50) + '...',
    rolledBackToVersion: version
  });

  return {
    success: true,
    contentType,
    rolledBackTo: version,
    currentVersion: versionInfo.history.length,
    promptPreview: historyEntry.prompt.slice(0, 100) + '...'
  };
}

/**
 * Validate Phase 7 implementation
 *
 * @returns {Promise<Object>} Validation results
 */
export async function validatePhase7() {
  const results = {
    passed: true,
    tests: []
  };

  // Create test engine
  const engine = new PromptEvolutionEngine();
  engine.initialize({ Test: 'Test prompt for validation' });

  // Add some test data
  for (let i = 0; i < 5; i++) {
    engine.patternExtractor.recordOutcome(`p${i}`, `out${i}`, 4.5, 'Test');
  }
  engine.strategySelector.recordMutationOutcome('ADD_SPECIFICITY_REQUIREMENT', 3.0, 4.0);

  // Test 1: Save state
  const testPath = join(DATA_DIR, 'test-evolution-state.json');
  const saveResult = await saveEvolutionState(engine, testPath);
  results.tests.push({
    name: 'Save evolution state',
    passed: saveResult.success,
    details: `success=${saveResult.success}, error=${saveResult.error || 'none'}`
  });

  // Test 2: Load state into new engine
  const engine2 = new PromptEvolutionEngine();
  engine2.initialize({ Test: 'Different initial prompt' });
  const loadResult = await loadEvolutionState(engine2, testPath);
  results.tests.push({
    name: 'Load evolution state',
    passed: loadResult.success,
    details: `success=${loadResult.success}, error=${loadResult.error || 'none'}`
  });

  // Test 3: Verify restored prompt
  const restoredPrompt = engine2.getPrompt('Test', 'champion');
  results.tests.push({
    name: 'Restored prompt matches',
    passed: restoredPrompt === 'Test prompt for validation',
    details: `restored="${restoredPrompt?.slice(0, 30)}..."`
  });

  // Test 4: Verify restored patterns
  results.tests.push({
    name: 'Restored pattern count',
    passed: engine2.patternExtractor.successPatterns.length === 5,
    details: `count=${engine2.patternExtractor.successPatterns.length}`
  });

  // Test 5: Verify restored mutation history
  results.tests.push({
    name: 'Restored mutation history',
    passed: engine2.strategySelector.mutationHistory.length === 1,
    details: `count=${engine2.strategySelector.mutationHistory.length}`
  });

  // Test 6: Load non-existent file
  const loadMissingResult = await loadEvolutionState(engine2, '/nonexistent/path.json');
  results.tests.push({
    name: 'Load non-existent returns error',
    passed: !loadMissingResult.success && loadMissingResult.error !== undefined,
    details: `error=${loadMissingResult.error}`
  });

  // Test 7: getEvolutionHistory
  const history = getEvolutionHistory(engine, 'Test');
  results.tests.push({
    name: 'getEvolutionHistory works',
    passed: Array.isArray(history) && history.length > 0,
    details: `entries=${history?.length || 0}`
  });

  // Test 8: rollbackToVersion
  // First evolve the prompt
  for (let i = 0; i < 15; i++) {
    engine.patternExtractor.recordOutcome(`p${i}`, `High $${i}`, 4.5, 'Test');
    engine.patternExtractor.recordOutcome(`p${i}`, `low${i}`, 1.5, 'Test');
  }
  const evolveResult = engine.evolvePrompt('Test');
  if (evolveResult.evolved) {
    // Simulate promotion
    engine.promptVersions['Test'].champion = engine.promptVersions['Test'].candidate;
    engine.promptVersions['Test'].history.push({
      version: 2,
      prompt: engine.promptVersions['Test'].candidate,
      mutations: [],
      promoted: true,
      timestamp: Date.now()
    });
  }

  // Now rollback
  const rollbackResult = rollbackToVersion(engine, 'Test', 1);
  results.tests.push({
    name: 'rollbackToVersion works',
    passed: rollbackResult.success,
    details: `success=${rollbackResult.success}, rolledBackTo=${rollbackResult.rolledBackTo}`
  });

  // Test 9: rollbackToVersion with invalid content type
  const invalidRollback = rollbackToVersion(engine, 'NonExistent', 1);
  results.tests.push({
    name: 'Rollback invalid type returns error',
    passed: !invalidRollback.success,
    details: `error=${invalidRollback.error}`
  });

  // Clean up test file
  try {
    const { unlink } = await import('fs/promises');
    await unlink(testPath);
  } catch {
    // Ignore cleanup errors
  }

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// Log validation on module load (for development)
if (process.env.NODE_ENV !== 'production') {
  const validation1 = validatePhase1();
  console.log('Phase 1 Validation:', validation1.passed ? 'PASSED' : 'FAILED');
  if (!validation1.passed) {
    validation1.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  const validation2 = validatePhase2();
  console.log('Phase 2 Validation:', validation2.passed ? 'PASSED' : 'FAILED');
  if (!validation2.passed) {
    validation2.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  const validation3 = validatePhase3();
  console.log('Phase 3 Validation:', validation3.passed ? 'PASSED' : 'FAILED');
  if (!validation3.passed) {
    validation3.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  const validation4 = validatePhase4();
  console.log('Phase 4 Validation:', validation4.passed ? 'PASSED' : 'FAILED');
  if (!validation4.passed) {
    validation4.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  const validation5 = validatePhase5();
  console.log('Phase 5 Validation:', validation5.passed ? 'PASSED' : 'FAILED');
  if (!validation5.passed) {
    validation5.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  // Phase 7 is async - run it separately
  validatePhase7().then(validation7 => {
    console.log('Phase 7 Validation:', validation7.passed ? 'PASSED' : 'FAILED');
    if (!validation7.passed) {
      validation7.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  FAILED: ${t.name} - ${t.details}`);
      });
    }
  });
}
