/**
 * Map-Reduce Quality Validator
 * 
 * Phase 5: Validates that map-reduce output maintains quality
 * compared to direct processing by checking:
 * - Key fact coverage
 * - Entity extraction completeness
 * - Theme consistency
 * - No significant information loss
 */

import { chunkResearchFiles, getChunkingStats } from './chunker.js';
import { processChunksParallel } from './insightExtractor.js';
import { consolidateInsights } from './insightConsolidator.js';

// ============================================================================
// VALIDATION CONFIGURATION
// ============================================================================

const VALIDATION_CONFIG = {
  // Minimum coverage thresholds
  minFactCoverage: 0.85,        // 85% of key facts should be captured
  minEntityCoverage: 0.80,      // 80% of entities should be captured
  minThemeCoverage: 0.90,       // 90% of themes should be captured
  
  // Similarity thresholds for matching
  factSimilarityThreshold: 0.6,  // 60% text similarity for fact matching
  entityMatchThreshold: 0.8,     // 80% for entity name matching
  
  // Quality scoring weights
  weights: {
    factCoverage: 0.4,
    entityCoverage: 0.2,
    themeCoverage: 0.2,
    metricCoverage: 0.1,
    dateCoverage: 0.1
  }
};

// ============================================================================
// TEXT COMPARISON UTILITIES
// ============================================================================

/**
 * Calculate similarity between two strings using Jaccard index
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Similarity score 0-1
 */
export function calculateTextSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const normalize = (s) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const words1 = new Set(normalize(str1).split(/\s+/));
  const words2 = new Set(normalize(str2).split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Check if an item from source is present in target array
 * @param {string} sourceItem - Item to find
 * @param {Array<string>} targetItems - Array to search
 * @param {number} threshold - Minimum similarity for match
 * @returns {boolean}
 */
function findMatch(sourceItem, targetItems, threshold) {
  for (const target of targetItems) {
    if (calculateTextSimilarity(sourceItem, target) >= threshold) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// EXTRACTION VALIDATORS
// ============================================================================

/**
 * Extract reference facts from raw research content
 * Simple extraction for baseline comparison
 * @param {string} content - Raw research content
 * @returns {Array<string>} Key statements
 */
function extractReferenceStatements(content) {
  const statements = [];
  
  // Split into sentences
  const sentences = content
    .replace(/\n+/g, ' ')
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 500);
  
  // Look for important patterns
  const importantPatterns = [
    /\b(key|important|critical|essential|significant|major)\b/i,
    /\b(should|must|need to|require|recommend)\b/i,
    /\b(increase|decrease|grow|decline|rise|fall)\s+\d/i,
    /\b\d+%/,
    /\b(million|billion|thousand)\b/i,
    /\b(Q[1-4]|20\d{2})\b/,
    /\b(strategy|initiative|goal|objective|target)\b/i
  ];
  
  for (const sentence of sentences) {
    for (const pattern of importantPatterns) {
      if (pattern.test(sentence)) {
        statements.push(sentence);
        break;
      }
    }
  }
  
  return [...new Set(statements)].slice(0, 100); // Limit for performance
}

/**
 * Extract reference entities from raw content
 * @param {string} content 
 * @returns {Array<string>} Entity names
 */
function extractReferenceEntities(content) {
  const entities = new Set();
  
  // Company/organization patterns (capitalized multi-word names)
  const orgPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let match;
  while ((match = orgPattern.exec(content)) !== null) {
    if (match[1].length > 3) {
      entities.add(match[1]);
    }
  }
  
  // Known tech companies and products
  const techNames = content.match(/\b(Google|Microsoft|Apple|Amazon|Meta|OpenAI|AWS|Azure|Gemini|GPT|AI|ML)\b/gi) || [];
  techNames.forEach(name => entities.add(name));
  
  return [...entities].slice(0, 50);
}

/**
 * Extract reference themes from raw content
 * @param {string} content 
 * @returns {Array<string>} Theme keywords
 */
function extractReferenceThemes(content) {
  const themes = new Set();
  
  // Common business/tech themes
  const themePatterns = [
    /\b(digital transformation|cloud migration|automation|innovation)\b/gi,
    /\b(customer experience|user experience|UX)\b/gi,
    /\b(market expansion|growth strategy|competitive advantage)\b/gi,
    /\b(cost reduction|efficiency|optimization)\b/gi,
    /\b(security|compliance|governance|risk management)\b/gi,
    /\b(AI|machine learning|data analytics|big data)\b/gi,
    /\b(sustainability|ESG|carbon neutral)\b/gi
  ];
  
  for (const pattern of themePatterns) {
    const matches = content.match(pattern) || [];
    matches.forEach(m => themes.add(m.toLowerCase()));
  }
  
  return [...themes];
}

// ============================================================================
// COVERAGE CALCULATION
// ============================================================================

/**
 * Calculate coverage of reference items in extracted insights
 * @param {Array<string>} referenceItems - Items from original content
 * @param {Array<object>} extractedItems - Extracted insight items
 * @param {string} textField - Field name containing text to compare
 * @param {number} threshold - Similarity threshold for match
 * @returns {object} Coverage statistics
 */
function calculateCoverage(referenceItems, extractedItems, textField, threshold) {
  if (referenceItems.length === 0) {
    return { coverage: 1, matched: 0, total: 0, missing: [] };
  }
  
  const extractedTexts = extractedItems.map(item => 
    typeof item === 'string' ? item : (item[textField] || '')
  );
  
  let matched = 0;
  const missing = [];
  
  for (const ref of referenceItems) {
    if (findMatch(ref, extractedTexts, threshold)) {
      matched++;
    } else {
      missing.push(ref);
    }
  }
  
  return {
    coverage: matched / referenceItems.length,
    matched,
    total: referenceItems.length,
    missing: missing.slice(0, 10) // Limit for readability
  };
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate map-reduce quality against reference extraction
 * @param {Array<{filename: string, content: string}>} researchFiles 
 * @returns {Promise<object>} Validation results
 */
export async function validateMapReduceQuality(researchFiles) {
  const startTime = Date.now();
  
  // Get raw content for reference extraction
  const rawContent = researchFiles.map(f => f.content).join('\n\n');
  
  // Extract reference items from raw content
  const referenceStatements = extractReferenceStatements(rawContent);
  const referenceEntities = extractReferenceEntities(rawContent);
  const referenceThemes = extractReferenceThemes(rawContent);
  
  console.log(`[Validator] Reference extraction: ${referenceStatements.length} statements, ${referenceEntities.length} entities, ${referenceThemes.length} themes`);
  
  // Run map-reduce extraction
  const chunks = chunkResearchFiles(researchFiles);
  const extractionResults = await processChunksParallel(chunks);
  const consolidated = consolidateInsights(extractionResults);
  
  // Calculate coverage for each category
  const factCoverage = calculateCoverage(
    referenceStatements,
    consolidated.keyFacts,
    'fact',
    VALIDATION_CONFIG.factSimilarityThreshold
  );
  
  const entityCoverage = calculateCoverage(
    referenceEntities,
    consolidated.entities,
    'name',
    VALIDATION_CONFIG.entityMatchThreshold
  );
  
  const themeCoverage = calculateCoverage(
    referenceThemes,
    consolidated.themes,
    'theme',
    VALIDATION_CONFIG.factSimilarityThreshold
  );
  
  // Calculate overall quality score
  const { weights } = VALIDATION_CONFIG;
  const qualityScore = (
    factCoverage.coverage * weights.factCoverage +
    entityCoverage.coverage * weights.entityCoverage +
    themeCoverage.coverage * weights.themeCoverage
  ) / (weights.factCoverage + weights.entityCoverage + weights.themeCoverage);
  
  // Determine pass/fail
  const passed = 
    factCoverage.coverage >= VALIDATION_CONFIG.minFactCoverage &&
    entityCoverage.coverage >= VALIDATION_CONFIG.minEntityCoverage &&
    themeCoverage.coverage >= VALIDATION_CONFIG.minThemeCoverage;
  
  const validationTime = Date.now() - startTime;
  
  return {
    passed,
    qualityScore: Math.round(qualityScore * 100) + '%',
    details: {
      facts: {
        coverage: Math.round(factCoverage.coverage * 100) + '%',
        threshold: Math.round(VALIDATION_CONFIG.minFactCoverage * 100) + '%',
        matched: factCoverage.matched,
        total: factCoverage.total,
        passed: factCoverage.coverage >= VALIDATION_CONFIG.minFactCoverage,
        sampleMissing: factCoverage.missing.slice(0, 3)
      },
      entities: {
        coverage: Math.round(entityCoverage.coverage * 100) + '%',
        threshold: Math.round(VALIDATION_CONFIG.minEntityCoverage * 100) + '%',
        matched: entityCoverage.matched,
        total: entityCoverage.total,
        passed: entityCoverage.coverage >= VALIDATION_CONFIG.minEntityCoverage,
        sampleMissing: entityCoverage.missing.slice(0, 3)
      },
      themes: {
        coverage: Math.round(themeCoverage.coverage * 100) + '%',
        threshold: Math.round(VALIDATION_CONFIG.minThemeCoverage * 100) + '%',
        matched: themeCoverage.matched,
        total: themeCoverage.total,
        passed: themeCoverage.coverage >= VALIDATION_CONFIG.minThemeCoverage,
        sampleMissing: themeCoverage.missing.slice(0, 3)
      }
    },
    mapReduceStats: {
      chunksProcessed: chunks.length,
      totalKeyFacts: consolidated.keyFacts.length,
      totalEntities: consolidated.entities.length,
      totalThemes: consolidated.themes.length,
      totalDates: consolidated.dates.length,
      totalMetrics: consolidated.metrics.length
    },
    timing: {
      validationTimeMs: validationTime
    }
  };
}

/**
 * Quick validation check - returns pass/fail without full details
 * @param {Array<{filename: string, content: string}>} researchFiles 
 * @returns {Promise<boolean>}
 */
export async function quickValidate(researchFiles) {
  try {
    const result = await validateMapReduceQuality(researchFiles);
    return result.passed;
  } catch (error) {
    console.error(`[Validator] Quick validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Compare direct vs map-reduce output for the same content
 * @param {Array<{filename: string, content: string}>} researchFiles 
 * @returns {Promise<object>} Comparison results
 */
export async function compareApproaches(researchFiles) {
  const stats = getChunkingStats(researchFiles);
  
  // If content is small, map-reduce isn't needed
  if (!stats.needsChunking) {
    return {
      comparison: 'not_applicable',
      reason: 'Content size below chunking threshold',
      contentSize: stats.totalSize,
      threshold: 50000
    };
  }
  
  // Run validation
  const validation = await validateMapReduceQuality(researchFiles);
  
  return {
    comparison: validation.passed ? 'map_reduce_adequate' : 'quality_concerns',
    validation,
    recommendation: validation.passed 
      ? 'Map-reduce approach maintains acceptable quality'
      : 'Review missing items - may need extraction prompt tuning'
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  validateMapReduceQuality,
  quickValidate,
  compareApproaches,
  calculateTextSimilarity,
  VALIDATION_CONFIG
};

export { VALIDATION_CONFIG };
