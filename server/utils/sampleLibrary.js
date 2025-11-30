/**
 * Sample Set Diversity Management
 *
 * This module implements a comprehensive sample generation and management system that:
 * 1. Expands sample coverage to 20+ diverse samples per content type
 * 2. Includes edge cases and challenging inputs
 * 3. Supports dynamic sample generation
 * 4. Enables domain-specific sample weighting
 *
 * Implementation of Plan 03: Sample Set Diversity
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', '..', 'data');
const SAMPLE_LIBRARY_PATH = join(DATA_DIR, 'sample-library.json');

// ============================================================================
// Phase 1: Sample Taxonomy Design
// ============================================================================

/**
 * Content types supported by the system
 */
export const CONTENT_TYPES = ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];

/**
 * Sample dimensions define the axes of diversity that samples should cover.
 * Each content type has domain dimensions, complexity dimensions, and edge cases.
 */
export const SAMPLE_DIMENSIONS = {
  Roadmap: {
    // Domain dimensions
    industry: ['technology', 'healthcare', 'finance', 'retail', 'manufacturing', 'education'],
    scope: ['strategic', 'tactical', 'operational'],
    timeframe: ['short-term (< 1 year)', 'medium-term (1-3 years)', 'long-term (3-5+ years)'],

    // Complexity dimensions
    swimlaneCount: ['few (2-3)', 'moderate (4-5)', 'many (6+)'],
    taskDensity: ['sparse', 'moderate', 'dense'],
    dependencies: ['none', 'some', 'complex'],

    // Edge cases (special scenarios to test)
    edgeCases: [
      'single swimlane',
      'very long timeframe (10+ years)',
      'past dates (historical roadmap)',
      'overlapping milestones',
      'seasonal/cyclical patterns'
    ]
  },

  Slides: {
    // Domain dimensions
    purpose: ['quarterly review', 'strategy presentation', 'investor pitch', 'training', 'project update'],
    audience: ['executive', 'technical', 'general', 'board'],
    industry: ['technology', 'healthcare', 'finance', 'retail', 'consulting'],

    // Complexity dimensions
    slideCount: ['brief (4-6)', 'standard (8-12)', 'comprehensive (15+)'],
    dataIntensity: ['narrative', 'balanced', 'data-heavy'],

    // Edge cases
    edgeCases: [
      'single key message',
      'heavily quantitative',
      'comparison/competitive analysis',
      'crisis communication',
      'vision/aspirational'
    ]
  },

  Document: {
    // Domain dimensions
    docType: ['strategic analysis', 'market research', 'white paper', 'policy brief', 'business case'],
    industry: ['technology', 'healthcare', 'finance', 'energy', 'government'],
    audience: ['executive', 'technical', 'policy makers', 'investors'],

    // Complexity dimensions
    depth: ['overview', 'detailed', 'comprehensive'],
    citations: ['minimal', 'moderate', 'heavily cited'],

    // Edge cases
    edgeCases: [
      'controversial topic',
      'highly technical subject',
      'emerging/uncertain topic',
      'multi-stakeholder perspective',
      'global/regional comparison'
    ]
  },

  ResearchAnalysis: {
    // Domain dimensions
    researchType: ['market analysis', 'competitive intelligence', 'trend analysis', 'due diligence', 'landscape review'],
    industry: ['technology', 'healthcare', 'finance', 'consumer', 'industrial'],

    // Complexity dimensions
    breadth: ['focused', 'broad', 'comprehensive'],
    recency: ['historical', 'current', 'forward-looking'],

    // Edge cases
    edgeCases: [
      'limited public data available',
      'rapidly changing market',
      'niche/emerging sector',
      'cross-industry analysis',
      'conflicting data sources'
    ]
  }
};

/**
 * Get all dimension names for a content type (excluding edgeCases)
 *
 * @param {string} contentType - Content type
 * @returns {Array<string>} Dimension names
 */
export function getDimensionNames(contentType) {
  const dimensions = SAMPLE_DIMENSIONS[contentType];
  if (!dimensions) return [];

  return Object.keys(dimensions).filter(key => key !== 'edgeCases');
}

/**
 * Get all possible values for a dimension
 *
 * @param {string} contentType - Content type
 * @param {string} dimensionName - Dimension name
 * @returns {Array<string>} Dimension values
 */
export function getDimensionValues(contentType, dimensionName) {
  const dimensions = SAMPLE_DIMENSIONS[contentType];
  if (!dimensions) return [];

  return dimensions[dimensionName] || [];
}

/**
 * Get edge cases for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Array<string>} Edge case descriptions
 */
export function getEdgeCases(contentType) {
  const dimensions = SAMPLE_DIMENSIONS[contentType];
  if (!dimensions) return [];

  return dimensions.edgeCases || [];
}

/**
 * Calculate the total number of dimension combinations for a content type
 *
 * @param {string} contentType - Content type
 * @returns {number} Total combinations
 */
export function getTotalCombinations(contentType) {
  const dimensionNames = getDimensionNames(contentType);
  if (dimensionNames.length === 0) return 0;

  return dimensionNames.reduce((total, dimName) => {
    const values = getDimensionValues(contentType, dimName);
    return total * values.length;
  }, 1);
}

/**
 * Validate taxonomy completeness
 *
 * @returns {Object} Validation results
 */
export function validateTaxonomy() {
  const results = {
    valid: true,
    contentTypes: {},
    issues: []
  };

  for (const contentType of CONTENT_TYPES) {
    const dimensions = SAMPLE_DIMENSIONS[contentType];

    if (!dimensions) {
      results.valid = false;
      results.issues.push(`Missing dimensions for ${contentType}`);
      continue;
    }

    const dimensionNames = getDimensionNames(contentType);
    const typeResult = {
      dimensionCount: dimensionNames.length,
      edgeCaseCount: dimensions.edgeCases?.length || 0,
      totalCombinations: getTotalCombinations(contentType),
      dimensions: {}
    };

    // Check each dimension
    for (const dimName of dimensionNames) {
      const values = dimensions[dimName];
      if (!Array.isArray(values) || values.length === 0) {
        results.valid = false;
        results.issues.push(`${contentType}.${dimName} is empty or invalid`);
      }
      typeResult.dimensions[dimName] = values.length;
    }

    // Check edge cases
    if (!dimensions.edgeCases || dimensions.edgeCases.length === 0) {
      results.issues.push(`${contentType} has no edge cases defined`);
    }

    results.contentTypes[contentType] = typeResult;
  }

  return results;
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

  // Test 1: All content types have dimensions
  const allHaveDimensions = CONTENT_TYPES.every(ct => SAMPLE_DIMENSIONS[ct] !== undefined);
  results.tests.push({
    name: 'All content types have dimensions',
    passed: allHaveDimensions,
    details: `contentTypes=${CONTENT_TYPES.length}, withDimensions=${CONTENT_TYPES.filter(ct => SAMPLE_DIMENSIONS[ct]).length}`
  });

  // Test 2: Each content type has at least 3 dimensions
  const minDimensions = CONTENT_TYPES.every(ct => getDimensionNames(ct).length >= 3);
  results.tests.push({
    name: 'Each type has at least 3 dimensions',
    passed: minDimensions,
    details: `dimensions=${CONTENT_TYPES.map(ct => `${ct}:${getDimensionNames(ct).length}`).join(', ')}`
  });

  // Test 3: Each dimension has at least 2 values
  let allDimensionsValid = true;
  for (const ct of CONTENT_TYPES) {
    for (const dim of getDimensionNames(ct)) {
      if (getDimensionValues(ct, dim).length < 2) {
        allDimensionsValid = false;
      }
    }
  }
  results.tests.push({
    name: 'Each dimension has at least 2 values',
    passed: allDimensionsValid,
    details: `valid=${allDimensionsValid}`
  });

  // Test 4: Each content type has edge cases
  const allHaveEdgeCases = CONTENT_TYPES.every(ct => getEdgeCases(ct).length > 0);
  results.tests.push({
    name: 'Each type has edge cases',
    passed: allHaveEdgeCases,
    details: `edgeCases=${CONTENT_TYPES.map(ct => `${ct}:${getEdgeCases(ct).length}`).join(', ')}`
  });

  // Test 5: getDimensionNames works
  const roadmapDims = getDimensionNames('Roadmap');
  results.tests.push({
    name: 'getDimensionNames works',
    passed: roadmapDims.length > 0 && !roadmapDims.includes('edgeCases'),
    details: `roadmapDims=${roadmapDims.join(', ')}`
  });

  // Test 6: getDimensionValues works
  const industries = getDimensionValues('Roadmap', 'industry');
  results.tests.push({
    name: 'getDimensionValues works',
    passed: industries.length > 0 && industries.includes('technology'),
    details: `industries=${industries.slice(0, 3).join(', ')}...`
  });

  // Test 7: getTotalCombinations calculates correctly
  const combos = getTotalCombinations('Roadmap');
  results.tests.push({
    name: 'getTotalCombinations calculates',
    passed: combos > 100, // Should be 6*3*3*3*3*3 = 1458
    details: `roadmapCombinations=${combos}`
  });

  // Test 8: validateTaxonomy returns valid structure
  const validation = validateTaxonomy();
  results.tests.push({
    name: 'validateTaxonomy works',
    passed: validation.valid && Object.keys(validation.contentTypes).length === 4,
    details: `valid=${validation.valid}, issues=${validation.issues.length}`
  });

  // Test 9: Invalid content type returns empty
  const invalidDims = getDimensionNames('InvalidType');
  results.tests.push({
    name: 'Invalid type returns empty',
    passed: invalidDims.length === 0,
    details: `invalidDims=${invalidDims.length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Phase 2: Sample Template Library
// ============================================================================

/**
 * Generate a unique ID for a sample
 *
 * @param {string} prefix - ID prefix
 * @param {Object} params - Parameters used in generation
 * @returns {string} Unique ID
 */
function generateSampleId(prefix, params) {
  const paramStr = Object.values(params)
    .map(v => String(v).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8))
    .join('-');
  return `${prefix}-${paramStr}-${Date.now().toString(36).slice(-4)}`;
}

/**
 * Sample templates that can generate diverse inputs through parameterization.
 * Each template has a generator function and parameter options.
 */
export const SAMPLE_TEMPLATES = {
  Roadmap: [
    // Template 1: Industry-specific digital transformation
    {
      id: 'digital-transform',
      name: 'Digital Transformation',
      template: (params) => ({
        id: generateSampleId('dt', params),
        name: `${params.industry} Digital Transformation Roadmap`,
        description: `Strategic plan for ${params.industry} sector digital modernization`,
        prompt: `Create a roadmap from ${params.timeframe} for digital transformation`,
        context: `${params.industry} company facing ${params.challenge}`,
        industry: params.industry.toLowerCase(),
        scope: 'strategic',
        timeframe: params.timeframe.includes('2026') ? 'medium-term (1-3 years)' : 'short-term (< 1 year)',
        expectedComplexity: params.complexity
      }),
      params: {
        industry: ['Healthcare', 'Retail', 'Manufacturing', 'Financial Services'],
        timeframe: ['2025-2026', '2025-2028', '2024-2027'],
        challenge: ['legacy system modernization', 'customer experience gaps', 'operational inefficiency'],
        complexity: ['moderate', 'high']
      }
    },

    // Template 2: Product/Platform roadmap
    {
      id: 'product-roadmap',
      name: 'Product Platform',
      template: (params) => ({
        id: generateSampleId('pr', params),
        name: `${params.product} Platform Roadmap`,
        description: `Development roadmap for ${params.product} platform evolution`,
        prompt: `Create a product roadmap for ${params.timeframe}`,
        context: `Building ${params.productType} with ${params.teamSize} team`,
        industry: 'technology',
        scope: 'tactical',
        timeframe: params.timeframe.includes('Q') ? 'short-term (< 1 year)' : 'medium-term (1-3 years)',
        expectedComplexity: 'high'
      }),
      params: {
        product: ['AI/ML Platform', 'Data Analytics Suite', 'Customer Portal', 'Mobile Application'],
        productType: ['B2B SaaS', 'B2C application', 'internal tool', 'API platform'],
        timeframe: ['Q1-Q4 2025', '2025-2026', '2025-2027'],
        teamSize: ['small (5-10)', 'medium (15-30)', 'large (50+)']
      }
    },

    // Template 3: Operational excellence
    {
      id: 'ops-excellence',
      name: 'Operational Excellence',
      template: (params) => ({
        id: generateSampleId('oe', params),
        name: `${params.function} Operational Excellence Roadmap`,
        description: `Improving ${params.function} efficiency and quality`,
        prompt: `Create an operational excellence roadmap for ${params.function}`,
        context: `${params.orgSize} organization with ${params.maturity} maturity`,
        industry: params.function === 'IT Operations' ? 'technology' : 'manufacturing',
        scope: 'operational',
        timeframe: 'medium-term (1-3 years)',
        expectedComplexity: 'moderate'
      }),
      params: {
        function: ['Supply Chain', 'Customer Service', 'IT Operations', 'Finance', 'HR'],
        orgSize: ['startup', 'mid-market', 'enterprise'],
        maturity: ['early stage', 'developing', 'mature']
      }
    }
  ],

  Slides: [
    // Template 1: Quarterly business review
    {
      id: 'quarterly-review',
      name: 'Quarterly Review',
      template: (params) => ({
        id: generateSampleId('qr', params),
        name: `${params.quarter} ${params.department} Review`,
        description: `Quarterly performance review for ${params.department}`,
        prompt: `Create a quarterly review presentation for ${params.audience} audience`,
        context: `Presenting ${params.quarter} results to ${params.audience}`,
        purpose: 'quarterly review',
        audience: params.audience.toLowerCase(),
        industry: 'technology',
        slideCount: params.depth === 'brief' ? 'brief (4-6)' : 'standard (8-12)',
        dataIntensity: params.focus === 'metrics' ? 'data-heavy' : 'balanced'
      }),
      params: {
        quarter: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
        department: ['Sales', 'Engineering', 'Marketing', 'Product'],
        audience: ['Executive', 'Board', 'Team'],
        depth: ['brief', 'detailed'],
        focus: ['metrics', 'narrative']
      }
    },

    // Template 2: Strategy presentation
    {
      id: 'strategy-deck',
      name: 'Strategy Presentation',
      template: (params) => ({
        id: generateSampleId('sd', params),
        name: `${params.topic} Strategy Presentation`,
        description: `Strategic overview of ${params.topic}`,
        prompt: `Create a strategy presentation about ${params.topic}`,
        context: `${params.industry} company planning ${params.horizon} strategy`,
        purpose: 'strategy presentation',
        audience: params.audience.toLowerCase(),
        industry: params.industry.toLowerCase(),
        slideCount: 'comprehensive (15+)',
        dataIntensity: 'balanced'
      }),
      params: {
        topic: ['Digital Transformation', 'Market Expansion', 'Product Innovation', 'Operational Excellence'],
        industry: ['Technology', 'Healthcare', 'Finance', 'Retail'],
        audience: ['Executive', 'Board', 'Investors'],
        horizon: ['annual', 'multi-year', 'long-term']
      }
    },

    // Template 3: Project update
    {
      id: 'project-update',
      name: 'Project Update',
      template: (params) => ({
        id: generateSampleId('pu', params),
        name: `${params.project} Project Update`,
        description: `Status update for ${params.project}`,
        prompt: `Create a project update presentation`,
        context: `${params.status} project at ${params.milestone} milestone`,
        purpose: 'project update',
        audience: params.audience.toLowerCase(),
        industry: 'technology',
        slideCount: 'brief (4-6)',
        dataIntensity: params.focus === 'progress' ? 'data-heavy' : 'balanced'
      }),
      params: {
        project: ['Platform Migration', 'New Feature Launch', 'System Integration', 'Process Improvement'],
        status: ['On Track', 'At Risk', 'Behind Schedule', 'Ahead of Plan'],
        milestone: ['kickoff', 'midpoint', 'pre-launch', 'post-mortem'],
        audience: ['Executive', 'Technical', 'General'],
        focus: ['progress', 'issues', 'achievements']
      }
    }
  ],

  Document: [
    // Template 1: Strategic analysis
    {
      id: 'strategic-analysis',
      name: 'Strategic Analysis',
      template: (params) => ({
        id: generateSampleId('sa', params),
        name: `${params.topic} Strategic Analysis`,
        description: `In-depth analysis of ${params.topic}`,
        prompt: `Create a strategic analysis document about ${params.topic}`,
        context: `${params.industry} sector analysis for ${params.audience}`,
        docType: 'strategic analysis',
        industry: params.industry.toLowerCase(),
        audience: params.audience.toLowerCase(),
        depth: params.depth,
        citations: params.citations
      }),
      params: {
        topic: ['Market Entry', 'Competitive Landscape', 'Growth Strategy', 'Risk Assessment'],
        industry: ['Technology', 'Healthcare', 'Finance', 'Energy'],
        audience: ['Executive', 'Investors', 'Board'],
        depth: ['overview', 'detailed', 'comprehensive'],
        citations: ['minimal', 'moderate', 'heavily cited']
      }
    },

    // Template 2: White paper
    {
      id: 'white-paper',
      name: 'White Paper',
      template: (params) => ({
        id: generateSampleId('wp', params),
        name: `${params.subject} White Paper`,
        description: `Technical white paper on ${params.subject}`,
        prompt: `Create a white paper about ${params.subject}`,
        context: `${params.purpose} document for ${params.audience} audience`,
        docType: 'white paper',
        industry: params.industry.toLowerCase(),
        audience: params.audience.toLowerCase(),
        depth: 'comprehensive',
        citations: 'heavily cited'
      }),
      params: {
        subject: ['AI Implementation', 'Cloud Architecture', 'Data Governance', 'Security Best Practices'],
        industry: ['Technology', 'Healthcare', 'Finance', 'Government'],
        audience: ['Technical', 'Executive', 'Policy Makers'],
        purpose: ['educational', 'thought leadership', 'vendor comparison']
      }
    },

    // Template 3: Business case
    {
      id: 'business-case',
      name: 'Business Case',
      template: (params) => ({
        id: generateSampleId('bc', params),
        name: `${params.initiative} Business Case`,
        description: `Business justification for ${params.initiative}`,
        prompt: `Create a business case document for ${params.initiative}`,
        context: `${params.investment} investment with ${params.risk} risk profile`,
        docType: 'business case',
        industry: params.industry.toLowerCase(),
        audience: 'executive',
        depth: 'detailed',
        citations: 'moderate'
      }),
      params: {
        initiative: ['System Modernization', 'Market Expansion', 'New Product Launch', 'Process Automation'],
        industry: ['Technology', 'Finance', 'Healthcare', 'Retail'],
        investment: ['low ($100K-500K)', 'medium ($500K-2M)', 'high ($2M+)'],
        risk: ['low', 'moderate', 'high']
      }
    }
  ],

  ResearchAnalysis: [
    // Template 1: Market analysis
    {
      id: 'market-analysis',
      name: 'Market Analysis',
      template: (params) => ({
        id: generateSampleId('ma', params),
        name: `${params.market} Market Analysis`,
        description: `Comprehensive analysis of ${params.market} market`,
        prompt: `Analyze the ${params.market} market`,
        context: `${params.scope} analysis with ${params.focus} focus`,
        researchType: 'market analysis',
        industry: params.industry.toLowerCase(),
        breadth: params.scope.toLowerCase(),
        recency: params.timeframe
      }),
      params: {
        market: ['Enterprise Software', 'Digital Health', 'Fintech', 'E-commerce', 'Cloud Services'],
        industry: ['Technology', 'Healthcare', 'Finance', 'Consumer'],
        scope: ['Focused', 'Broad', 'Comprehensive'],
        focus: ['size and growth', 'competitive dynamics', 'trends and drivers'],
        timeframe: ['historical', 'current', 'forward-looking']
      }
    },

    // Template 2: Competitive intelligence
    {
      id: 'competitive-intel',
      name: 'Competitive Intelligence',
      template: (params) => ({
        id: generateSampleId('ci', params),
        name: `${params.competitor} Competitive Analysis`,
        description: `Intelligence on ${params.competitor} and competitive landscape`,
        prompt: `Provide competitive intelligence on ${params.competitor}`,
        context: `Analyzing ${params.aspect} for ${params.purpose}`,
        researchType: 'competitive intelligence',
        industry: params.industry.toLowerCase(),
        breadth: 'focused',
        recency: 'current'
      }),
      params: {
        competitor: ['Major Player Analysis', 'Emerging Competitor Review', 'Industry Leaders', 'Direct Competitors'],
        industry: ['Technology', 'Healthcare', 'Finance', 'Industrial'],
        aspect: ['product strategy', 'pricing and positioning', 'go-to-market', 'technology stack'],
        purpose: ['strategic planning', 'product development', 'sales enablement']
      }
    },

    // Template 3: Trend analysis
    {
      id: 'trend-analysis',
      name: 'Trend Analysis',
      template: (params) => ({
        id: generateSampleId('ta', params),
        name: `${params.trend} Trend Analysis`,
        description: `Analysis of ${params.trend} trends`,
        prompt: `Analyze trends in ${params.trend}`,
        context: `${params.horizon} outlook for ${params.industry}`,
        researchType: 'trend analysis',
        industry: params.industry.toLowerCase(),
        breadth: 'broad',
        recency: params.horizon === 'long-term' ? 'forward-looking' : 'current'
      }),
      params: {
        trend: ['AI and Automation', 'Digital Transformation', 'Sustainability', 'Remote Work', 'Customer Experience'],
        industry: ['Technology', 'Healthcare', 'Finance', 'Consumer', 'Industrial'],
        horizon: ['short-term', 'medium-term', 'long-term'],
        depth: ['overview', 'detailed']
      }
    }
  ]
};

/**
 * Generate a sample from a template with specific parameter values
 *
 * @param {Object} template - Template object
 * @param {Object} paramValues - Parameter values to use
 * @returns {Object} Generated sample
 */
export function generateSampleFromTemplate(template, paramValues) {
  return template.template(paramValues);
}

/**
 * Generate all possible combinations of template parameters
 * Limits combinations to prevent exponential explosion
 *
 * @param {Object} template - Template object
 * @param {number} [maxCombinations=50] - Maximum combinations to generate
 * @returns {Array<Object>} Array of generated samples
 */
export function generateAllCombinations(template, maxCombinations = 50) {
  const { params } = template;
  const keys = Object.keys(params);
  const combinations = [];

  function combine(index, current) {
    // Stop if we've hit the limit
    if (combinations.length >= maxCombinations) return;

    if (index === keys.length) {
      combinations.push({ ...current });
      return;
    }

    const key = keys[index];
    for (const value of params[key]) {
      if (combinations.length >= maxCombinations) break;
      current[key] = value;
      combine(index + 1, current);
    }
  }

  combine(0, {});
  return combinations.map(combo => generateSampleFromTemplate(template, combo));
}

/**
 * Select a diverse subset of samples from a larger set
 * Uses stratified sampling to ensure coverage
 *
 * @param {Array<Object>} samples - Source samples
 * @param {number} count - Number to select
 * @returns {Array<Object>} Selected samples
 */
export function selectDiverseSubset(samples, count) {
  if (samples.length <= count) return samples;

  // Use step-based selection for even distribution
  const step = samples.length / count;
  const selected = [];

  for (let i = 0; i < count; i++) {
    const index = Math.floor(i * step);
    if (index < samples.length) {
      selected.push(samples[index]);
    }
  }

  return selected;
}

/**
 * Validate a template structure
 *
 * @param {Object} template - Template to validate
 * @returns {Object} Validation result
 */
export function validateTemplate(template) {
  const issues = [];

  if (!template.id) issues.push('Missing template id');
  if (!template.name) issues.push('Missing template name');
  if (typeof template.template !== 'function') issues.push('Template function missing');
  if (!template.params || Object.keys(template.params).length === 0) {
    issues.push('No parameters defined');
  }

  // Check that all params have at least one value
  if (template.params) {
    for (const [key, values] of Object.entries(template.params)) {
      if (!Array.isArray(values) || values.length === 0) {
        issues.push(`Parameter ${key} has no values`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Get all templates for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Array<Object>} Templates
 */
export function getTemplates(contentType) {
  return SAMPLE_TEMPLATES[contentType] || [];
}

/**
 * Count total possible samples from all templates for a content type
 *
 * @param {string} contentType - Content type
 * @returns {number} Total possible samples
 */
export function countTemplateCombinations(contentType) {
  const templates = getTemplates(contentType);
  let total = 0;

  for (const template of templates) {
    const keys = Object.keys(template.params || {});
    if (keys.length === 0) continue;

    const combos = keys.reduce((product, key) => {
      return product * (template.params[key]?.length || 1);
    }, 1);

    total += combos;
  }

  return total;
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

  // Test 1: All content types have templates
  const allHaveTemplates = CONTENT_TYPES.every(ct => getTemplates(ct).length > 0);
  results.tests.push({
    name: 'All content types have templates',
    passed: allHaveTemplates,
    details: `templates=${CONTENT_TYPES.map(ct => `${ct}:${getTemplates(ct).length}`).join(', ')}`
  });

  // Test 2: Each content type has at least 2 templates
  const minTemplates = CONTENT_TYPES.every(ct => getTemplates(ct).length >= 2);
  results.tests.push({
    name: 'Each type has at least 2 templates',
    passed: minTemplates,
    details: `counts=${CONTENT_TYPES.map(ct => getTemplates(ct).length).join(', ')}`
  });

  // Test 3: All templates are valid
  let allValid = true;
  let invalidCount = 0;
  for (const ct of CONTENT_TYPES) {
    for (const template of getTemplates(ct)) {
      const validation = validateTemplate(template);
      if (!validation.valid) {
        allValid = false;
        invalidCount++;
      }
    }
  }
  results.tests.push({
    name: 'All templates are valid',
    passed: allValid,
    details: `invalid=${invalidCount}`
  });

  // Test 4: generateSampleFromTemplate works
  const roadmapTemplates = getTemplates('Roadmap');
  if (roadmapTemplates.length > 0) {
    const template = roadmapTemplates[0];
    const firstParams = {};
    for (const [key, values] of Object.entries(template.params)) {
      firstParams[key] = values[0];
    }
    const sample = generateSampleFromTemplate(template, firstParams);
    results.tests.push({
      name: 'generateSampleFromTemplate works',
      passed: sample && sample.id && sample.name,
      details: `generated=${!!sample}, hasId=${!!sample?.id}, hasName=${!!sample?.name}`
    });
  } else {
    results.tests.push({
      name: 'generateSampleFromTemplate works',
      passed: false,
      details: 'No templates available'
    });
  }

  // Test 5: generateAllCombinations respects limit
  if (roadmapTemplates.length > 0) {
    const combinations = generateAllCombinations(roadmapTemplates[0], 10);
    results.tests.push({
      name: 'generateAllCombinations respects limit',
      passed: combinations.length <= 10,
      details: `count=${combinations.length}`
    });
  } else {
    results.tests.push({
      name: 'generateAllCombinations respects limit',
      passed: false,
      details: 'No templates available'
    });
  }

  // Test 6: Each generated sample has unique ID
  if (roadmapTemplates.length > 0) {
    const samples = generateAllCombinations(roadmapTemplates[0], 5);
    const ids = samples.map(s => s.id);
    const uniqueIds = new Set(ids);
    results.tests.push({
      name: 'Generated samples have unique IDs',
      passed: uniqueIds.size === ids.length,
      details: `total=${ids.length}, unique=${uniqueIds.size}`
    });
  } else {
    results.tests.push({
      name: 'Generated samples have unique IDs',
      passed: false,
      details: 'No templates available'
    });
  }

  // Test 7: selectDiverseSubset works
  const testSamples = Array.from({ length: 20 }, (_, i) => ({ id: i }));
  const subset = selectDiverseSubset(testSamples, 5);
  results.tests.push({
    name: 'selectDiverseSubset works',
    passed: subset.length === 5,
    details: `selected=${subset.length}`
  });

  // Test 8: countTemplateCombinations works
  const totalCombos = countTemplateCombinations('Roadmap');
  results.tests.push({
    name: 'countTemplateCombinations works',
    passed: totalCombos > 50, // Should be at least 50+ combinations
    details: `roadmapCombinations=${totalCombos}`
  });

  // Test 9: Samples have required fields
  if (roadmapTemplates.length > 0) {
    const template = roadmapTemplates[0];
    const firstParams = {};
    for (const [key, values] of Object.entries(template.params)) {
      firstParams[key] = values[0];
    }
    const sample = generateSampleFromTemplate(template, firstParams);
    const hasRequiredFields = sample.id && sample.name && sample.description && sample.prompt;
    results.tests.push({
      name: 'Samples have required fields',
      passed: hasRequiredFields,
      details: `fields=${Object.keys(sample).join(', ')}`
    });
  } else {
    results.tests.push({
      name: 'Samples have required fields',
      passed: false,
      details: 'No templates available'
    });
  }

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Phase 3: Edge Case Sample Generation
// ============================================================================

/**
 * Difficulty levels for edge cases
 */
export const EDGE_CASE_DIFFICULTY = {
  LOW_INPUT: 'edge-low-input',
  TIMEFRAME: 'edge-timeframe',
  CONFLICT: 'edge-conflict',
  AMBIGUOUS: 'edge-ambiguous',
  BOUNDARY: 'edge-boundary',
  SCALE: 'edge-scale',
  FORMAT: 'edge-format'
};

/**
 * Edge case samples designed to test system limits and failure modes.
 * Each sample includes expected behavior for validation.
 */
export const EDGE_CASE_SAMPLES = {
  Roadmap: [
    // Edge case: Minimal input
    {
      id: 'edge-roadmap-minimal',
      name: 'Roadmap',
      description: '',
      prompt: 'Create a roadmap',
      context: '',
      expectedBehavior: 'Should request more information or generate reasonable defaults',
      difficultyLevel: EDGE_CASE_DIFFICULTY.LOW_INPUT,
      industry: 'technology',
      scope: 'strategic',
      timeframe: 'medium-term (1-3 years)'
    },

    // Edge case: Extremely long timeframe
    {
      id: 'edge-roadmap-long-term',
      name: '20-Year Technology Vision Roadmap',
      description: 'Long-term technology evolution from 2025 to 2045',
      prompt: 'Create a comprehensive technology roadmap spanning the next 20 years',
      context: 'Strategic planning for next two decades of technology investment with major milestones',
      expectedBehavior: 'Should handle long timeframes with appropriate granularity (yearly/multi-year phases)',
      difficultyLevel: EDGE_CASE_DIFFICULTY.TIMEFRAME,
      industry: 'technology',
      scope: 'strategic',
      timeframe: 'long-term (3-5+ years)'
    },

    // Edge case: Very constrained (short timeframe)
    {
      id: 'edge-roadmap-constrained',
      name: 'Q4 Sprint Roadmap',
      description: 'Micro-roadmap for single quarter with weekly milestones',
      prompt: 'Create a detailed week-by-week roadmap for Q4 2025',
      context: 'Need week-by-week breakdown for October-December with specific deliverables',
      expectedBehavior: 'Should adjust granularity for short timeframe (weekly/bi-weekly)',
      difficultyLevel: EDGE_CASE_DIFFICULTY.TIMEFRAME,
      industry: 'technology',
      scope: 'operational',
      timeframe: 'short-term (< 1 year)'
    },

    // Edge case: Conflicting requirements
    {
      id: 'edge-roadmap-conflicting',
      name: 'Resource-Constrained Digital Transformation',
      description: 'Major transformation with minimal budget and tight timeline',
      prompt: 'Create a comprehensive digital transformation roadmap',
      context: 'Complete enterprise-wide digital transformation in 6 months with $50K budget and 2-person team',
      expectedBehavior: 'Should acknowledge constraints, prioritize, and suggest realistic scope adjustments',
      difficultyLevel: EDGE_CASE_DIFFICULTY.CONFLICT,
      industry: 'technology',
      scope: 'strategic',
      timeframe: 'short-term (< 1 year)'
    },

    // Edge case: Ambiguous domain
    {
      id: 'edge-roadmap-ambiguous',
      name: 'Innovation Roadmap',
      description: 'General innovation planning without specifics',
      prompt: 'Create an innovation roadmap',
      context: 'Make our company more innovative and forward-thinking',
      expectedBehavior: 'Should provide structure despite vague input, suggest clarifying dimensions',
      difficultyLevel: EDGE_CASE_DIFFICULTY.AMBIGUOUS,
      industry: 'technology',
      scope: 'strategic',
      timeframe: 'medium-term (1-3 years)'
    },

    // Edge case: Single swimlane (boundary)
    {
      id: 'edge-roadmap-single-swimlane',
      name: 'Single Department Roadmap',
      description: 'Roadmap for one team only',
      prompt: 'Create a roadmap for our QA team only',
      context: 'Small 3-person QA team needs their own focused roadmap',
      expectedBehavior: 'Should handle single swimlane gracefully without forcing multiple tracks',
      difficultyLevel: EDGE_CASE_DIFFICULTY.BOUNDARY,
      industry: 'technology',
      scope: 'operational',
      timeframe: 'short-term (< 1 year)'
    },

    // Edge case: Historical (past dates)
    {
      id: 'edge-roadmap-historical',
      name: 'Historical Technology Evolution',
      description: 'Document past technology roadmap from 2020-2024',
      prompt: 'Create a retrospective roadmap documenting our technology evolution',
      context: 'Need to document what actually happened over the past 5 years for stakeholder review',
      expectedBehavior: 'Should handle past dates and retrospective framing appropriately',
      difficultyLevel: EDGE_CASE_DIFFICULTY.TIMEFRAME,
      industry: 'technology',
      scope: 'strategic',
      timeframe: 'medium-term (1-3 years)'
    }
  ],

  Slides: [
    // Edge case: Minimal input
    {
      id: 'edge-slides-minimal',
      name: 'Presentation',
      description: '',
      prompt: 'Create a presentation',
      context: '',
      expectedBehavior: 'Should request more information about purpose and audience',
      difficultyLevel: EDGE_CASE_DIFFICULTY.LOW_INPUT,
      purpose: 'strategy presentation',
      audience: 'general',
      industry: 'technology',
      slideCount: 'standard (8-12)',
      dataIntensity: 'balanced'
    },

    // Edge case: Single key message
    {
      id: 'edge-slides-single-message',
      name: 'One-Point Presentation',
      description: 'Presentation with single core message',
      prompt: 'Create a presentation with one key takeaway',
      context: 'Need to convince executives to approve the project in 2 minutes',
      expectedBehavior: 'Should create focused, minimal deck around single point',
      difficultyLevel: EDGE_CASE_DIFFICULTY.BOUNDARY,
      purpose: 'investor pitch',
      audience: 'executive',
      industry: 'technology',
      slideCount: 'brief (4-6)',
      dataIntensity: 'narrative'
    },

    // Edge case: Heavily quantitative
    {
      id: 'edge-slides-data-heavy',
      name: 'Financial Performance Deep Dive',
      description: '50+ metrics and data points presentation',
      prompt: 'Create a presentation with all quarterly financial metrics',
      context: 'Board wants to see every KPI, metric, and financial data point for the quarter',
      expectedBehavior: 'Should organize dense data effectively with appropriate visualizations',
      difficultyLevel: EDGE_CASE_DIFFICULTY.SCALE,
      purpose: 'quarterly review',
      audience: 'board',
      industry: 'finance',
      slideCount: 'comprehensive (15+)',
      dataIntensity: 'data-heavy'
    },

    // Edge case: Crisis communication
    {
      id: 'edge-slides-crisis',
      name: 'Incident Response Briefing',
      description: 'Emergency communication about major incident',
      prompt: 'Create a crisis communication presentation',
      context: 'Major security breach discovered, need to brief executives and board immediately',
      expectedBehavior: 'Should prioritize clarity, action items, and appropriate tone',
      difficultyLevel: EDGE_CASE_DIFFICULTY.FORMAT,
      purpose: 'project update',
      audience: 'executive',
      industry: 'technology',
      slideCount: 'brief (4-6)',
      dataIntensity: 'balanced'
    },

    // Edge case: Conflicting audience
    {
      id: 'edge-slides-mixed-audience',
      name: 'Technical Strategy for Mixed Audience',
      description: 'Technical content for non-technical executives',
      prompt: 'Create a technical architecture presentation for the board',
      context: 'Board members have no technical background but need to approve technical decisions',
      expectedBehavior: 'Should balance technical accuracy with accessibility',
      difficultyLevel: EDGE_CASE_DIFFICULTY.CONFLICT,
      purpose: 'strategy presentation',
      audience: 'board',
      industry: 'technology',
      slideCount: 'standard (8-12)',
      dataIntensity: 'balanced'
    },

    // Edge case: Vision/aspirational
    {
      id: 'edge-slides-aspirational',
      name: '10-Year Vision Statement',
      description: 'Highly aspirational future vision presentation',
      prompt: 'Create a visionary presentation about where we will be in 2035',
      context: 'All-hands meeting to inspire employees about long-term company vision',
      expectedBehavior: 'Should balance inspiration with credibility, avoid over-promising',
      difficultyLevel: EDGE_CASE_DIFFICULTY.AMBIGUOUS,
      purpose: 'strategy presentation',
      audience: 'general',
      industry: 'technology',
      slideCount: 'standard (8-12)',
      dataIntensity: 'narrative'
    }
  ],

  Document: [
    // Edge case: Minimal input
    {
      id: 'edge-document-minimal',
      name: 'Document',
      description: '',
      prompt: 'Write a document',
      context: '',
      expectedBehavior: 'Should request more information about purpose and topic',
      difficultyLevel: EDGE_CASE_DIFFICULTY.LOW_INPUT,
      docType: 'strategic analysis',
      industry: 'technology',
      audience: 'executive',
      depth: 'overview',
      citations: 'minimal'
    },

    // Edge case: Controversial topic
    {
      id: 'edge-document-controversial',
      name: 'AI Ethics and Workforce Impact Analysis',
      description: 'Analysis of controversial AI job displacement topic',
      prompt: 'Create a strategic analysis on AI automation and workforce reduction',
      context: 'Board requested honest assessment of how AI will eliminate jobs at the company',
      expectedBehavior: 'Should present balanced view, acknowledge multiple perspectives',
      difficultyLevel: EDGE_CASE_DIFFICULTY.FORMAT,
      docType: 'strategic analysis',
      industry: 'technology',
      audience: 'executive',
      depth: 'comprehensive',
      citations: 'heavily cited'
    },

    // Edge case: Highly technical
    {
      id: 'edge-document-technical',
      name: 'Quantum Computing Architecture White Paper',
      description: 'Deeply technical quantum computing document',
      prompt: 'Write a technical white paper on quantum error correction algorithms',
      context: 'For research team and academic publication, needs mathematical rigor',
      expectedBehavior: 'Should handle deep technical content with appropriate formalism',
      difficultyLevel: EDGE_CASE_DIFFICULTY.SCALE,
      docType: 'white paper',
      industry: 'technology',
      audience: 'technical',
      depth: 'comprehensive',
      citations: 'heavily cited'
    },

    // Edge case: Emerging/uncertain topic
    {
      id: 'edge-document-emerging',
      name: 'Web4 Market Analysis',
      description: 'Analysis of undefined/emerging technology',
      prompt: 'Create market research on Web4 technology',
      context: 'Need to advise executives on investing in Web4 before it is defined',
      expectedBehavior: 'Should acknowledge uncertainty while providing useful framework',
      difficultyLevel: EDGE_CASE_DIFFICULTY.AMBIGUOUS,
      docType: 'market research',
      industry: 'technology',
      audience: 'investors',
      depth: 'detailed',
      citations: 'moderate'
    },

    // Edge case: Multi-stakeholder perspective
    {
      id: 'edge-document-multi-stakeholder',
      name: 'Healthcare AI Policy Brief',
      description: 'Policy document balancing patient, provider, payer, regulator views',
      prompt: 'Create a policy brief on AI in healthcare',
      context: 'Must address concerns of patients, doctors, insurers, and regulators',
      expectedBehavior: 'Should present multiple stakeholder viewpoints fairly',
      difficultyLevel: EDGE_CASE_DIFFICULTY.CONFLICT,
      docType: 'policy brief',
      industry: 'healthcare',
      audience: 'policy makers',
      depth: 'comprehensive',
      citations: 'heavily cited'
    },

    // Edge case: Global comparison
    {
      id: 'edge-document-global',
      name: 'Global Regulatory Comparison',
      description: 'Compare regulations across 10+ countries',
      prompt: 'Create an analysis comparing AI regulations across major markets',
      context: 'Need to understand regulatory landscape in US, EU, UK, China, Japan, India, Brazil',
      expectedBehavior: 'Should organize complex multi-region comparison clearly',
      difficultyLevel: EDGE_CASE_DIFFICULTY.SCALE,
      docType: 'strategic analysis',
      industry: 'government',
      audience: 'policy makers',
      depth: 'comprehensive',
      citations: 'heavily cited'
    }
  ],

  ResearchAnalysis: [
    // Edge case: Minimal input
    {
      id: 'edge-research-minimal',
      name: 'Analysis',
      description: '',
      prompt: 'Analyze the market',
      context: '',
      expectedBehavior: 'Should request more information about scope and focus',
      difficultyLevel: EDGE_CASE_DIFFICULTY.LOW_INPUT,
      researchType: 'market analysis',
      industry: 'technology',
      breadth: 'focused',
      recency: 'current'
    },

    // Edge case: Limited public data
    {
      id: 'edge-research-limited-data',
      name: 'Private Company Analysis',
      description: 'Competitive intelligence on private, secretive company',
      prompt: 'Provide competitive intelligence on Anthropic internal operations',
      context: 'Investor wants detailed analysis of private AI company with limited public information',
      expectedBehavior: 'Should acknowledge data limitations, use available sources responsibly',
      difficultyLevel: EDGE_CASE_DIFFICULTY.BOUNDARY,
      researchType: 'competitive intelligence',
      industry: 'technology',
      breadth: 'focused',
      recency: 'current'
    },

    // Edge case: Rapidly changing market
    {
      id: 'edge-research-volatile',
      name: 'Generative AI Market Analysis Q4 2025',
      description: 'Analysis of extremely fast-moving market',
      prompt: 'Provide current market analysis of generative AI landscape',
      context: 'Market is changing weekly with new models and players',
      expectedBehavior: 'Should provide point-in-time analysis with caveats about rapid change',
      difficultyLevel: EDGE_CASE_DIFFICULTY.TIMEFRAME,
      researchType: 'market analysis',
      industry: 'technology',
      breadth: 'comprehensive',
      recency: 'current'
    },

    // Edge case: Niche/emerging sector
    {
      id: 'edge-research-niche',
      name: 'Quantum-Safe Cryptography Market',
      description: 'Analysis of very niche emerging market',
      prompt: 'Analyze the post-quantum cryptography market',
      context: 'Need market sizing and competitive landscape for nascent market',
      expectedBehavior: 'Should handle limited data availability for emerging markets',
      difficultyLevel: EDGE_CASE_DIFFICULTY.AMBIGUOUS,
      researchType: 'landscape review',
      industry: 'technology',
      breadth: 'comprehensive',
      recency: 'forward-looking'
    },

    // Edge case: Cross-industry analysis
    {
      id: 'edge-research-cross-industry',
      name: 'Healthcare-Fintech Convergence Analysis',
      description: 'Analysis spanning multiple industries',
      prompt: 'Analyze the convergence of healthcare and fintech',
      context: 'Need to understand opportunities at the intersection of two industries',
      expectedBehavior: 'Should handle cross-industry complexity and interdependencies',
      difficultyLevel: EDGE_CASE_DIFFICULTY.SCALE,
      researchType: 'trend analysis',
      industry: 'healthcare',
      breadth: 'broad',
      recency: 'forward-looking'
    },

    // Edge case: Conflicting data sources
    {
      id: 'edge-research-conflicting',
      name: 'EV Market Size Reconciliation',
      description: 'Market analysis with wildly different source estimates',
      prompt: 'Provide EV market size and growth projections',
      context: 'Different analysts project market from $500B to $2T by 2030',
      expectedBehavior: 'Should acknowledge source conflicts, provide reasoned synthesis',
      difficultyLevel: EDGE_CASE_DIFFICULTY.CONFLICT,
      researchType: 'market analysis',
      industry: 'industrial',
      breadth: 'comprehensive',
      recency: 'forward-looking'
    },

    // Edge case: Historical trend analysis
    {
      id: 'edge-research-historical',
      name: '20-Year Technology Adoption Trends',
      description: 'Long-term historical analysis',
      prompt: 'Analyze technology adoption patterns over the past 20 years',
      context: 'Need to understand historical patterns to predict future adoption curves',
      expectedBehavior: 'Should handle long historical timeframes with appropriate data',
      difficultyLevel: EDGE_CASE_DIFFICULTY.TIMEFRAME,
      researchType: 'trend analysis',
      industry: 'technology',
      breadth: 'comprehensive',
      recency: 'historical'
    }
  ]
};

/**
 * Get all edge case samples for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Array<Object>} Edge case samples
 */
export function getEdgeCaseSamples(contentType) {
  return EDGE_CASE_SAMPLES[contentType] || [];
}

/**
 * Get edge case samples by difficulty level
 *
 * @param {string} contentType - Content type
 * @param {string} difficultyLevel - Difficulty level from EDGE_CASE_DIFFICULTY
 * @returns {Array<Object>} Matching edge case samples
 */
export function getEdgeCasesByDifficulty(contentType, difficultyLevel) {
  const samples = EDGE_CASE_SAMPLES[contentType] || [];
  return samples.filter(s => s.difficultyLevel === difficultyLevel);
}

/**
 * Get all unique difficulty levels used in edge cases
 *
 * @returns {Array<string>} Unique difficulty levels
 */
export function getUniqueDifficultyLevels() {
  const levels = new Set();
  for (const samples of Object.values(EDGE_CASE_SAMPLES)) {
    for (const sample of samples) {
      if (sample.difficultyLevel) {
        levels.add(sample.difficultyLevel);
      }
    }
  }
  return Array.from(levels);
}

/**
 * Validate an edge case sample has required fields
 *
 * @param {Object} sample - Edge case sample
 * @returns {Object} Validation result
 */
export function validateEdgeCaseSample(sample) {
  const issues = [];
  const requiredFields = ['id', 'name', 'expectedBehavior', 'difficultyLevel'];

  for (const field of requiredFields) {
    if (!sample[field]) {
      issues.push(`Missing required field: ${field}`);
    }
  }

  // Check difficulty level is valid
  if (sample.difficultyLevel && !Object.values(EDGE_CASE_DIFFICULTY).includes(sample.difficultyLevel)) {
    issues.push(`Invalid difficulty level: ${sample.difficultyLevel}`);
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Count edge cases by difficulty level for a content type
 *
 * @param {string} contentType - Content type
 * @returns {Object} Count by difficulty level
 */
export function countEdgeCasesByDifficulty(contentType) {
  const samples = EDGE_CASE_SAMPLES[contentType] || [];
  const counts = {};

  for (const level of Object.values(EDGE_CASE_DIFFICULTY)) {
    counts[level] = 0;
  }

  for (const sample of samples) {
    if (sample.difficultyLevel && counts[sample.difficultyLevel] !== undefined) {
      counts[sample.difficultyLevel]++;
    }
  }

  return counts;
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

  // Test 1: All content types have edge case samples
  const allHaveEdgeCases = CONTENT_TYPES.every(ct => getEdgeCaseSamples(ct).length > 0);
  results.tests.push({
    name: 'All content types have edge cases',
    passed: allHaveEdgeCases,
    details: `edgeCases=${CONTENT_TYPES.map(ct => `${ct}:${getEdgeCaseSamples(ct).length}`).join(', ')}`
  });

  // Test 2: Each content type has at least 5 edge cases
  const minEdgeCases = CONTENT_TYPES.every(ct => getEdgeCaseSamples(ct).length >= 5);
  results.tests.push({
    name: 'Each type has at least 5 edge cases',
    passed: minEdgeCases,
    details: `counts=${CONTENT_TYPES.map(ct => getEdgeCaseSamples(ct).length).join(', ')}`
  });

  // Test 3: All edge cases are valid
  let allValid = true;
  let invalidCount = 0;
  for (const ct of CONTENT_TYPES) {
    for (const sample of getEdgeCaseSamples(ct)) {
      const validation = validateEdgeCaseSample(sample);
      if (!validation.valid) {
        allValid = false;
        invalidCount++;
      }
    }
  }
  results.tests.push({
    name: 'All edge cases are valid',
    passed: allValid,
    details: `invalid=${invalidCount}`
  });

  // Test 4: Edge cases have unique IDs
  const allIds = [];
  for (const ct of CONTENT_TYPES) {
    for (const sample of getEdgeCaseSamples(ct)) {
      allIds.push(sample.id);
    }
  }
  const uniqueIds = new Set(allIds);
  results.tests.push({
    name: 'Edge cases have unique IDs',
    passed: uniqueIds.size === allIds.length,
    details: `total=${allIds.length}, unique=${uniqueIds.size}`
  });

  // Test 5: EDGE_CASE_DIFFICULTY enum is used
  const difficultyValues = Object.values(EDGE_CASE_DIFFICULTY);
  const usedDifficulties = getUniqueDifficultyLevels();
  results.tests.push({
    name: 'EDGE_CASE_DIFFICULTY values are used',
    passed: usedDifficulties.length >= 4,
    details: `used=${usedDifficulties.length}/${difficultyValues.length}`
  });

  // Test 6: getEdgeCasesByDifficulty works
  const lowInputCases = getEdgeCasesByDifficulty('Roadmap', EDGE_CASE_DIFFICULTY.LOW_INPUT);
  results.tests.push({
    name: 'getEdgeCasesByDifficulty works',
    passed: lowInputCases.length > 0,
    details: `lowInputRoadmapCases=${lowInputCases.length}`
  });

  // Test 7: Each content type has LOW_INPUT edge case
  const allHaveLowInput = CONTENT_TYPES.every(ct =>
    getEdgeCasesByDifficulty(ct, EDGE_CASE_DIFFICULTY.LOW_INPUT).length > 0
  );
  results.tests.push({
    name: 'Each type has LOW_INPUT edge case',
    passed: allHaveLowInput,
    details: `hasLowInput=${CONTENT_TYPES.map(ct =>
      `${ct}:${getEdgeCasesByDifficulty(ct, EDGE_CASE_DIFFICULTY.LOW_INPUT).length > 0}`
    ).join(', ')}`
  });

  // Test 8: countEdgeCasesByDifficulty works
  const roadmapCounts = countEdgeCasesByDifficulty('Roadmap');
  const totalCounted = Object.values(roadmapCounts).reduce((a, b) => a + b, 0);
  results.tests.push({
    name: 'countEdgeCasesByDifficulty works',
    passed: totalCounted === getEdgeCaseSamples('Roadmap').length,
    details: `counted=${totalCounted}, actual=${getEdgeCaseSamples('Roadmap').length}`
  });

  // Test 9: Edge cases have expectedBehavior
  let allHaveExpectedBehavior = true;
  for (const ct of CONTENT_TYPES) {
    for (const sample of getEdgeCaseSamples(ct)) {
      if (!sample.expectedBehavior || sample.expectedBehavior.length < 10) {
        allHaveExpectedBehavior = false;
      }
    }
  }
  results.tests.push({
    name: 'Edge cases have expectedBehavior',
    passed: allHaveExpectedBehavior,
    details: `allHaveExpectedBehavior=${allHaveExpectedBehavior}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Phase 4: Sample Weighting System
// ============================================================================

/**
 * Minimum number of uses before weight adjustments are applied
 */
const MIN_USAGE_FOR_WEIGHT_ADJUSTMENT = 3;

/**
 * Weight calculation constants
 */
const WEIGHT_CONFIG = {
  floorWeight: 0.2,      // Minimum weight to ensure all samples get some usage
  noveltyFactor: 0.3,    // Weight contribution from novelty
  challengeFactor: 0.5,  // Weight contribution from challenge value
  maxUsageForNovelty: 100 // Usage count at which novelty bonus reaches zero
};

/**
 * Manages sample weights based on training performance and usage patterns.
 * Implements adaptive weighting to prioritize challenging samples.
 */
export class SampleWeightManager {
  constructor() {
    this.weights = {};      // sampleId -> weight
    this.performance = {};  // sampleId -> { successes, failures, avgScore, scores }
    this.usageCounts = {};  // sampleId -> count
  }

  /**
   * Initialize weights for a set of samples
   *
   * @param {Array<Object>} samples - Samples to initialize
   */
  initializeWeights(samples) {
    for (const sample of samples) {
      if (!sample.id) continue;

      // Don't reinitialize existing samples
      if (this.weights[sample.id] !== undefined) continue;

      this.weights[sample.id] = 1.0;  // Equal initial weight
      this.performance[sample.id] = {
        successes: 0,
        failures: 0,
        avgScore: null,
        scores: []
      };
      this.usageCounts[sample.id] = 0;
    }
  }

  /**
   * Record a training outcome for a sample
   *
   * @param {string} sampleId - Sample ID
   * @param {number} score - Score achieved (0-1)
   * @param {boolean} success - Whether the generation was successful
   */
  recordOutcome(sampleId, score, success) {
    const perf = this.performance[sampleId];
    if (!perf) {
      // Initialize if not present
      this.weights[sampleId] = 1.0;
      this.performance[sampleId] = { successes: 0, failures: 0, avgScore: null, scores: [] };
      this.usageCounts[sampleId] = 0;
    }

    const currentPerf = this.performance[sampleId];

    if (success) {
      currentPerf.successes++;
    } else {
      currentPerf.failures++;
    }

    // Keep rolling window of scores (last 20)
    currentPerf.scores.push(score);
    if (currentPerf.scores.length > 20) {
      currentPerf.scores.shift();
    }

    // Update rolling average
    currentPerf.avgScore = currentPerf.scores.reduce((a, b) => a + b, 0) / currentPerf.scores.length;

    this.usageCounts[sampleId] = (this.usageCounts[sampleId] || 0) + 1;

    // Only recalculate weight after minimum usage
    if (this.usageCounts[sampleId] >= MIN_USAGE_FOR_WEIGHT_ADJUSTMENT) {
      this.recalculateWeight(sampleId);
    }
  }

  /**
   * Recalculate weight for a sample based on performance data
   *
   * @param {string} sampleId - Sample ID
   */
  recalculateWeight(sampleId) {
    const perf = this.performance[sampleId];
    const usage = this.usageCounts[sampleId] || 0;

    if (!perf) {
      this.weights[sampleId] = 1.0;
      return;
    }

    const totalAttempts = perf.successes + perf.failures;
    if (totalAttempts === 0) {
      this.weights[sampleId] = 1.0;
      return;
    }

    // Base weight on inverse of success rate (prioritize challenging samples)
    const successRate = perf.successes / totalAttempts;

    // Weight components:
    // 1. Novelty bonus (less used = higher weight)
    const noveltyBonus = Math.max(0, 1 - usage / WEIGHT_CONFIG.maxUsageForNovelty);

    // 2. Challenge value (lower success = higher training value)
    const challengeValue = 1 - successRate;

    // 3. Score-based adjustment (lower avg score = more challenging)
    const scoreAdjustment = perf.avgScore !== null ? (1 - perf.avgScore) * 0.2 : 0;

    // Combine factors with floor
    this.weights[sampleId] = WEIGHT_CONFIG.floorWeight +
      (noveltyBonus * WEIGHT_CONFIG.noveltyFactor) +
      (challengeValue * WEIGHT_CONFIG.challengeFactor) +
      scoreAdjustment;
  }

  /**
   * Get the current weight for a sample
   *
   * @param {string} sampleId - Sample ID
   * @returns {number} Current weight
   */
  getWeight(sampleId) {
    return this.weights[sampleId] || 1.0;
  }

  /**
   * Select a sample using weighted random selection
   *
   * @param {Array<Object>} samples - Available samples
   * @returns {Object|null} Selected sample
   */
  selectWeightedSample(samples) {
    if (!samples || samples.length === 0) return null;

    // Build cumulative weight array
    let totalWeight = 0;
    const cumulative = [];

    for (const sample of samples) {
      const weight = this.weights[sample.id] || 1.0;
      totalWeight += weight;
      cumulative.push({ sample, cumWeight: totalWeight });
    }

    // Random selection based on weights
    const random = Math.random() * totalWeight;
    for (const { sample, cumWeight } of cumulative) {
      if (random <= cumWeight) {
        return sample;
      }
    }

    return samples[0];  // Fallback
  }

  /**
   * Get the weight distribution for analysis
   *
   * @returns {Array<Object>} Weight distribution data
   */
  getWeightDistribution() {
    return Object.entries(this.weights)
      .sort((a, b) => b[1] - a[1])
      .map(([id, weight]) => ({
        id,
        weight: parseFloat(weight.toFixed(3)),
        usage: this.usageCounts[id] || 0,
        avgScore: this.performance[id]?.avgScore !== null
          ? parseFloat(this.performance[id].avgScore.toFixed(3))
          : null,
        successRate: this.getSuccessRate(id)
      }));
  }

  /**
   * Get the success rate for a sample
   *
   * @param {string} sampleId - Sample ID
   * @returns {number|null} Success rate or null if no data
   */
  getSuccessRate(sampleId) {
    const perf = this.performance[sampleId];
    if (!perf) return null;

    const total = perf.successes + perf.failures;
    if (total === 0) return null;

    return parseFloat((perf.successes / total).toFixed(3));
  }

  /**
   * Get performance data for a sample
   *
   * @param {string} sampleId - Sample ID
   * @returns {Object|null} Performance data
   */
  getPerformance(sampleId) {
    return this.performance[sampleId] || null;
  }

  /**
   * Check if any sample exceeds weight thresholds
   *
   * @param {number} [maxRatio=3] - Maximum allowed ratio to average weight
   * @returns {Array<Object>} Samples exceeding threshold
   */
  checkWeightBalance(maxRatio = 3) {
    const weights = Object.values(this.weights);
    if (weights.length === 0) return [];

    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
    const threshold = avgWeight * maxRatio;

    const exceeding = [];
    for (const [id, weight] of Object.entries(this.weights)) {
      if (weight > threshold) {
        exceeding.push({
          id,
          weight,
          ratio: parseFloat((weight / avgWeight).toFixed(2))
        });
      }
    }

    return exceeding;
  }

  /**
   * Reset weights to initial state
   */
  reset() {
    for (const id of Object.keys(this.weights)) {
      this.weights[id] = 1.0;
    }
  }

  /**
   * Export state for persistence
   *
   * @returns {Object} Serializable state
   */
  exportState() {
    return {
      weights: { ...this.weights },
      performance: JSON.parse(JSON.stringify(this.performance)),
      usageCounts: { ...this.usageCounts }
    };
  }

  /**
   * Import state from persistence
   *
   * @param {Object} state - Previously exported state
   */
  importState(state) {
    if (state.weights) this.weights = { ...state.weights };
    if (state.performance) this.performance = JSON.parse(JSON.stringify(state.performance));
    if (state.usageCounts) this.usageCounts = { ...state.usageCounts };
  }

  /**
   * Get statistics summary
   *
   * @returns {Object} Statistics
   */
  getStatistics() {
    const weights = Object.values(this.weights);
    const usages = Object.values(this.usageCounts);

    if (weights.length === 0) {
      return {
        sampleCount: 0,
        avgWeight: 0,
        minWeight: 0,
        maxWeight: 0,
        totalUsage: 0,
        avgUsage: 0
      };
    }

    return {
      sampleCount: weights.length,
      avgWeight: parseFloat((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(3)),
      minWeight: parseFloat(Math.min(...weights).toFixed(3)),
      maxWeight: parseFloat(Math.max(...weights).toFixed(3)),
      totalUsage: usages.reduce((a, b) => a + b, 0),
      avgUsage: parseFloat((usages.reduce((a, b) => a + b, 0) / usages.length).toFixed(1))
    };
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

  // Test 1: SampleWeightManager can be instantiated
  const manager = new SampleWeightManager();
  results.tests.push({
    name: 'SampleWeightManager instantiates',
    passed: manager !== null && typeof manager.initializeWeights === 'function',
    details: `hasInit=${typeof manager.initializeWeights === 'function'}`
  });

  // Test 2: initializeWeights works
  const testSamples = [
    { id: 'test-1', name: 'Test 1' },
    { id: 'test-2', name: 'Test 2' },
    { id: 'test-3', name: 'Test 3' }
  ];
  manager.initializeWeights(testSamples);
  results.tests.push({
    name: 'initializeWeights works',
    passed: Object.keys(manager.weights).length === 3,
    details: `initialized=${Object.keys(manager.weights).length}`
  });

  // Test 3: Initial weights are equal (1.0)
  const allEqualWeight = testSamples.every(s => manager.getWeight(s.id) === 1.0);
  results.tests.push({
    name: 'Initial weights are equal',
    passed: allEqualWeight,
    details: `weights=${testSamples.map(s => manager.getWeight(s.id)).join(', ')}`
  });

  // Test 4: recordOutcome works
  manager.recordOutcome('test-1', 0.8, true);
  const perf = manager.getPerformance('test-1');
  results.tests.push({
    name: 'recordOutcome works',
    passed: perf !== null && perf.successes === 1 && perf.scores.length === 1,
    details: `successes=${perf?.successes}, scores=${perf?.scores?.length}`
  });

  // Test 5: Weight doesn't change until MIN_USAGE
  // Record 2 more outcomes (total 3 = MIN_USAGE)
  const weightBefore = manager.getWeight('test-1');
  manager.recordOutcome('test-1', 0.9, true);
  const weightAfter2 = manager.getWeight('test-1');
  manager.recordOutcome('test-1', 0.7, true);  // This is the 3rd, should trigger recalc
  const weightAfter3 = manager.getWeight('test-1');
  results.tests.push({
    name: 'Weight stable until MIN_USAGE',
    passed: weightBefore === weightAfter2 && weightAfter3 !== weightBefore,
    details: `before=${weightBefore}, after2=${weightAfter2}, after3=${weightAfter3}`
  });

  // Test 6: selectWeightedSample returns valid sample
  const selected = manager.selectWeightedSample(testSamples);
  results.tests.push({
    name: 'selectWeightedSample works',
    passed: selected !== null && testSamples.some(s => s.id === selected.id),
    details: `selected=${selected?.id}`
  });

  // Test 7: Failing samples get higher weight
  const manager2 = new SampleWeightManager();
  manager2.initializeWeights([{ id: 'fail-test' }]);
  // Record failures to increase weight
  for (let i = 0; i < 5; i++) {
    manager2.recordOutcome('fail-test', 0.3, false);
  }
  const failWeight = manager2.getWeight('fail-test');
  results.tests.push({
    name: 'Failing samples get higher weight',
    passed: failWeight > 1.0,
    details: `failWeight=${failWeight.toFixed(3)}`
  });

  // Test 8: getWeightDistribution works
  const distribution = manager.getWeightDistribution();
  results.tests.push({
    name: 'getWeightDistribution works',
    passed: Array.isArray(distribution) && distribution.length > 0,
    details: `distributionLength=${distribution.length}`
  });

  // Test 9: checkWeightBalance works
  const balance = manager.checkWeightBalance(3);
  results.tests.push({
    name: 'checkWeightBalance works',
    passed: Array.isArray(balance),
    details: `exceeding=${balance.length}`
  });

  // Test 10: exportState/importState work
  const exported = manager.exportState();
  const manager3 = new SampleWeightManager();
  manager3.importState(exported);
  results.tests.push({
    name: 'export/import state works',
    passed: Object.keys(manager3.weights).length === Object.keys(manager.weights).length,
    details: `exported=${Object.keys(exported.weights).length}, imported=${Object.keys(manager3.weights).length}`
  });

  // Test 11: getStatistics works
  const stats = manager.getStatistics();
  results.tests.push({
    name: 'getStatistics works',
    passed: stats.sampleCount > 0 && stats.avgWeight > 0,
    details: `count=${stats.sampleCount}, avgWeight=${stats.avgWeight}`
  });

  // Test 12: reset works
  manager.reset();
  const allResetToOne = Object.values(manager.weights).every(w => w === 1.0);
  results.tests.push({
    name: 'reset works',
    passed: allResetToOne,
    details: `allOne=${allResetToOne}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Phase 5: Dynamic Sample Generation
// ============================================================================

/**
 * Configuration for dynamic sample generation
 */
const DYNAMIC_GENERATION_CONFIG = {
  maxSamplesPerGeneration: 5,
  maxRetries: 3,
  validateGenerated: true
};

/**
 * LLM provider interface for sample generation.
 * Can be set via setLLMProvider() to integrate with actual LLM.
 */
let llmProvider = null;

/**
 * Set the LLM provider for dynamic sample generation
 *
 * @param {Object} provider - Provider with generateText(prompt) method
 */
export function setLLMProvider(provider) {
  if (provider && typeof provider.generateText === 'function') {
    llmProvider = provider;
  }
}

/**
 * Check if LLM provider is available
 *
 * @returns {boolean} Whether LLM is available
 */
export function hasLLMProvider() {
  return llmProvider !== null;
}

/**
 * Identify coverage gaps in the sample set for a content type
 *
 * @param {string} contentType - Content type
 * @param {Array<Object>} existingSamples - Current samples
 * @returns {Array<string>} List of identified gaps
 */
export function identifyCoverageGaps(contentType, existingSamples) {
  const gaps = [];
  const dimensions = SAMPLE_DIMENSIONS[contentType];

  if (!dimensions) return gaps;

  // Check dimension coverage
  const dimensionNames = getDimensionNames(contentType);
  for (const dimName of dimensionNames) {
    const dimValues = getDimensionValues(contentType, dimName);
    const covered = new Set();

    // Check what values are covered in existing samples
    for (const sample of existingSamples) {
      if (sample[dimName]) {
        covered.add(sample[dimName]);
      }
    }

    // Find missing values
    const missing = dimValues.filter(v => !covered.has(v));
    if (missing.length > 0) {
      gaps.push(`${dimName}: missing ${missing.join(', ')}`);
    }
  }

  // Check edge case coverage
  const edgeCases = getEdgeCases(contentType);
  const edgeCaseSamples = getEdgeCaseSamples(contentType);

  const coveredDifficulties = new Set(existingSamples
    .filter(s => s.difficultyLevel)
    .map(s => s.difficultyLevel)
  );

  const missingEdges = edgeCaseSamples
    .filter(e => !coveredDifficulties.has(e.difficultyLevel))
    .map(e => e.difficultyLevel);

  if (missingEdges.length > 0) {
    const uniqueMissing = [...new Set(missingEdges)];
    gaps.push(`Edge cases: missing ${uniqueMissing.join(', ')}`);
  }

  // Check for industry diversity
  if (dimensions.industry) {
    const industries = new Set(existingSamples.map(s => s.industry).filter(Boolean));
    if (industries.size < dimensions.industry.length / 2) {
      const missing = dimensions.industry.filter(i => !industries.has(i));
      gaps.push(`Industry diversity: need more coverage of ${missing.slice(0, 3).join(', ')}`);
    }
  }

  return gaps;
}

/**
 * Build a prompt for generating a novel sample
 *
 * @param {string} contentType - Content type
 * @param {Array<Object>} existingSamples - Current samples
 * @param {Array<string>} gaps - Identified coverage gaps
 * @returns {string} Prompt for LLM
 */
export function buildSampleGenerationPrompt(contentType, existingSamples, gaps) {
  const dimensions = SAMPLE_DIMENSIONS[contentType];
  const dimensionNames = getDimensionNames(contentType);

  let prompt = `Generate a novel sample input for ${contentType} content generation.

## Current Sample Coverage Gaps
${gaps.length > 0 ? gaps.map(g => `- ${g}`).join('\n') : '- No specific gaps identified'}

## Available Dimensions
${dimensionNames.map(d => `- ${d}: ${getDimensionValues(contentType, d).join(', ')}`).join('\n')}

## Edge Cases to Consider
${getEdgeCases(contentType).map(e => `- ${e}`).join('\n')}

## Existing Samples (avoid similarity)
${existingSamples.slice(0, 5).map(s => `- ${s.name}: ${s.description || 'No description'}`).join('\n')}

## Required Output Format
Generate a valid JSON object with these fields:
{
  "id": "unique-id-string",
  "name": "Descriptive sample name",
  "description": "What this sample is about",
  "prompt": "The user prompt to generate this content",
  "context": "Background information for generation",
  "industry": "one of the industry values",
  "expectedComplexity": "low|moderate|high",
  "uniqueAspects": ["What makes this sample different"]
}

Focus on filling the coverage gaps identified above. The sample should be realistic and challenging.`;

  return prompt;
}

/**
 * Parse and validate LLM-generated sample
 *
 * @param {string} response - LLM response text
 * @param {string} contentType - Content type
 * @returns {Object|null} Parsed sample or null if invalid
 */
export function parseLLMSampleResponse(response, contentType) {
  if (!response) return null;

  try {
    // Try to extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = response;

    // Check for markdown code block
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const sample = JSON.parse(jsonStr);

    // Validate required fields
    const requiredFields = ['id', 'name', 'description'];
    for (const field of requiredFields) {
      if (!sample[field]) {
        console.warn(`Generated sample missing required field: ${field}`);
        return null;
      }
    }

    // Ensure ID is unique by appending timestamp and random suffix
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    sample.id = `generated-${contentType.toLowerCase()}-${Date.now().toString(36)}-${randomSuffix}`;

    // Add content type marker
    sample.isGenerated = true;
    sample.generatedAt = Date.now();

    return sample;
  } catch (error) {
    console.warn('Failed to parse LLM sample response:', error.message);
    return null;
  }
}

/**
 * Generate a novel sample using LLM (if available)
 *
 * @param {string} contentType - Content type
 * @param {Array<Object>} existingSamples - Current samples
 * @param {Array<string>} gaps - Coverage gaps to address
 * @returns {Promise<Object|null>} Generated sample or null
 */
export async function generateNovelSample(contentType, existingSamples, gaps) {
  // If no LLM provider, return null
  if (!llmProvider) {
    console.log('No LLM provider configured for dynamic sample generation');
    return null;
  }

  const prompt = buildSampleGenerationPrompt(contentType, existingSamples, gaps);

  for (let attempt = 0; attempt < DYNAMIC_GENERATION_CONFIG.maxRetries; attempt++) {
    try {
      const response = await llmProvider.generateText(prompt);
      const sample = parseLLMSampleResponse(response, contentType);

      if (sample) {
        return sample;
      }
    } catch (error) {
      console.warn(`Sample generation attempt ${attempt + 1} failed:`, error.message);
    }
  }

  return null;
}

/**
 * Generate multiple novel samples to fill coverage gaps
 *
 * @param {string} contentType - Content type
 * @param {Array<Object>} existingSamples - Current samples
 * @param {number} [count=3] - Number of samples to generate
 * @returns {Promise<Array<Object>>} Generated samples
 */
export async function generateNovelSamples(contentType, existingSamples, count = 3) {
  const generated = [];
  const gaps = identifyCoverageGaps(contentType, existingSamples);

  if (gaps.length === 0) {
    console.log(`No coverage gaps identified for ${contentType}`);
    return generated;
  }

  const maxToGenerate = Math.min(count, DYNAMIC_GENERATION_CONFIG.maxSamplesPerGeneration);

  for (let i = 0; i < maxToGenerate && gaps.length > 0; i++) {
    const sample = await generateNovelSample(contentType, existingSamples, gaps);

    if (sample) {
      generated.push(sample);
      existingSamples.push(sample); // Add to existing to avoid duplicates

      // Remove addressed gap (rough heuristic)
      gaps.shift();
    }
  }

  return generated;
}

/**
 * Create a mock/fallback sample when LLM is not available
 * Uses template-based generation as fallback
 *
 * @param {string} contentType - Content type
 * @param {Array<string>} gaps - Coverage gaps
 * @returns {Object|null} Generated sample
 */
export function createFallbackSample(contentType, gaps) {
  const templates = getTemplates(contentType);
  if (templates.length === 0) return null;

  // Pick a random template
  const template = templates[Math.floor(Math.random() * templates.length)];

  // Generate with random parameters
  const params = {};
  for (const [key, values] of Object.entries(template.params)) {
    params[key] = values[Math.floor(Math.random() * values.length)];
  }

  const sample = generateSampleFromTemplate(template, params);

  // Mark as fallback
  sample.isFallback = true;
  sample.generatedAt = Date.now();

  return sample;
}

/**
 * Get sample generation statistics
 *
 * @param {Array<Object>} samples - Samples to analyze
 * @returns {Object} Statistics
 */
export function getSampleGenerationStats(samples) {
  const generated = samples.filter(s => s.isGenerated);
  const fallback = samples.filter(s => s.isFallback);
  const templated = samples.filter(s => !s.isGenerated && !s.isFallback && s.id?.includes('-'));
  const edgeCases = samples.filter(s => s.difficultyLevel);

  return {
    total: samples.length,
    generated: generated.length,
    fallback: fallback.length,
    templated: templated.length,
    edgeCases: edgeCases.length,
    manual: samples.length - generated.length - fallback.length - templated.length - edgeCases.length
  };
}

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

  // Test 1: identifyCoverageGaps works
  const testSamples = [{ id: 'test', industry: 'technology' }];
  const gaps = identifyCoverageGaps('Roadmap', testSamples);
  results.tests.push({
    name: 'identifyCoverageGaps works',
    passed: Array.isArray(gaps) && gaps.length > 0,
    details: `gaps=${gaps.length}`
  });

  // Test 2: Gaps identify missing dimensions
  const hasDimensionGaps = gaps.some(g => g.includes(':'));
  results.tests.push({
    name: 'Gaps identify missing dimensions',
    passed: hasDimensionGaps,
    details: `hasDimensionGaps=${hasDimensionGaps}`
  });

  // Test 3: buildSampleGenerationPrompt works
  const prompt = buildSampleGenerationPrompt('Roadmap', testSamples, gaps);
  results.tests.push({
    name: 'buildSampleGenerationPrompt works',
    passed: prompt.includes('Roadmap') && prompt.includes('JSON'),
    details: `promptLength=${prompt.length}`
  });

  // Test 4: parseLLMSampleResponse handles valid JSON
  const validJson = '{"id": "test", "name": "Test", "description": "Test desc"}';
  const parsed = parseLLMSampleResponse(validJson, 'Roadmap');
  results.tests.push({
    name: 'parseLLMSampleResponse parses valid JSON',
    passed: parsed !== null && parsed.name === 'Test',
    details: `parsed=${!!parsed}`
  });

  // Test 5: parseLLMSampleResponse handles markdown code blocks
  const mdJson = '```json\n{"id": "test", "name": "Test", "description": "Test desc"}\n```';
  const parsedMd = parseLLMSampleResponse(mdJson, 'Slides');
  results.tests.push({
    name: 'parseLLMSampleResponse handles markdown',
    passed: parsedMd !== null && parsedMd.name === 'Test',
    details: `parsedMd=${!!parsedMd}`
  });

  // Test 6: parseLLMSampleResponse rejects invalid JSON
  const invalidJson = 'not json at all';
  const parsedInvalid = parseLLMSampleResponse(invalidJson, 'Document');
  results.tests.push({
    name: 'parseLLMSampleResponse rejects invalid',
    passed: parsedInvalid === null,
    details: `parsedInvalid=${parsedInvalid}`
  });

  // Test 7: parseLLMSampleResponse rejects incomplete JSON
  const incompleteJson = '{"id": "test"}';  // Missing name and description
  const parsedIncomplete = parseLLMSampleResponse(incompleteJson, 'ResearchAnalysis');
  results.tests.push({
    name: 'parseLLMSampleResponse rejects incomplete',
    passed: parsedIncomplete === null,
    details: `parsedIncomplete=${parsedIncomplete}`
  });

  // Test 8: hasLLMProvider returns boolean
  const providerState = hasLLMProvider();
  results.tests.push({
    name: 'hasLLMProvider works',
    passed: typeof providerState === 'boolean',  // Returns boolean state
    details: `hasProvider=${providerState}`
  });

  // Test 9: createFallbackSample works
  const fallback = createFallbackSample('Roadmap', ['test gap']);
  results.tests.push({
    name: 'createFallbackSample works',
    passed: fallback !== null && fallback.isFallback === true,
    details: `fallback=${!!fallback}, isFallback=${fallback?.isFallback}`
  });

  // Test 10: getSampleGenerationStats works
  const statsSamples = [
    { id: '1', isGenerated: true },
    { id: '2', isFallback: true },
    { id: 'dt-test-123', name: 'Templated' },
    { id: 'edge-test', difficultyLevel: 'edge-low-input' },
    { id: 'manual', name: 'Manual' }
  ];
  const stats = getSampleGenerationStats(statsSamples);
  results.tests.push({
    name: 'getSampleGenerationStats works',
    passed: stats.total === 5 && stats.generated === 1 && stats.fallback === 1,
    details: `total=${stats.total}, generated=${stats.generated}, fallback=${stats.fallback}`
  });

  // Test 11: setLLMProvider works
  const mockProvider = { generateText: async () => '{}' };
  setLLMProvider(mockProvider);
  const hasProviderNow = hasLLMProvider();
  setLLMProvider(null);  // Reset
  results.tests.push({
    name: 'setLLMProvider works',
    passed: hasProviderNow === true,
    details: `hasProviderAfterSet=${hasProviderNow}`
  });

  // Test 12: Generated samples get unique IDs
  const json1 = '{"id": "x", "name": "Test1", "description": "Desc1"}';
  const json2 = '{"id": "x", "name": "Test2", "description": "Desc2"}';
  const sample1 = parseLLMSampleResponse(json1, 'Roadmap');
  const sample2 = parseLLMSampleResponse(json2, 'Roadmap');
  results.tests.push({
    name: 'Generated samples get unique IDs',
    passed: sample1.id !== sample2.id && sample1.id.startsWith('generated-'),
    details: `id1=${sample1?.id}, id2=${sample2?.id}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Phase 6: Sample Library Management
// ============================================================================

/**
 * Configuration for sample library
 */
const LIBRARY_CONFIG = {
  minSamplesPerType: 20,
  maxSamplesPerType: 100,
  templatedSamplesPerTemplate: 5,
  autoPersistInterval: 5 * 60 * 1000  // 5 minutes
};

/**
 * Comprehensive sample library that manages all samples for all content types.
 * Handles loading, generation, weighting, and persistence.
 */
export class SampleLibrary {
  constructor() {
    this.samples = {};      // contentType -> samples[]
    this.metadata = {};     // sample stats and coverage
    this.weightManager = new SampleWeightManager();
    this.initialized = false;
    this.baseSamples = {};  // Store base samples separately for reference
  }

  /**
   * Initialize the sample library with all sample types
   *
   * @param {Object} [options] - Initialization options
   * @param {Object} [options.baseSamples] - Base samples keyed by content type
   * @param {boolean} [options.loadPersisted=true] - Whether to load persisted state
   */
  async initialize(options = {}) {
    const { baseSamples = {}, loadPersisted = true } = options;

    // Store base samples
    this.baseSamples = baseSamples;

    // Initialize samples for each content type
    for (const contentType of CONTENT_TYPES) {
      this.samples[contentType] = [];

      // 1. Add base samples
      const base = this.loadBaseSamples(contentType, baseSamples[contentType]);
      this.samples[contentType].push(...base);

      // 2. Add templated samples
      const templated = this.generateTemplatedSamples(contentType);
      this.samples[contentType].push(...templated);

      // 3. Add edge case samples
      const edgeCases = getEdgeCaseSamples(contentType);
      this.samples[contentType].push(...edgeCases);

      // Initialize weights for all samples
      this.weightManager.initializeWeights(this.samples[contentType]);

      // Update metadata
      this.metadata[contentType] = {
        baseSampleCount: base.length,
        templatedCount: templated.length,
        edgeCaseCount: edgeCases.length,
        totalSamples: this.samples[contentType].length,
        lastUpdated: Date.now()
      };
    }

    // Load persisted state if available
    if (loadPersisted) {
      await this.loadPersistedState();
    }

    this.initialized = true;

    console.log('Sample library initialized:');
    for (const [type, samples] of Object.entries(this.samples)) {
      console.log(`  ${type}: ${samples.length} samples`);
    }
  }

  /**
   * Load base samples for a content type
   *
   * @param {string} contentType - Content type
   * @param {Array<Object>} [provided] - Provided base samples
   * @returns {Array<Object>} Base samples
   */
  loadBaseSamples(contentType, provided) {
    if (provided && Array.isArray(provided)) {
      // Ensure each sample has an ID
      return provided.map((s, i) => ({
        ...s,
        id: s.id || `base-${contentType.toLowerCase()}-${i}`
      }));
    }
    return [];
  }

  /**
   * Generate samples from templates for a content type
   *
   * @param {string} contentType - Content type
   * @returns {Array<Object>} Generated samples
   */
  generateTemplatedSamples(contentType) {
    const templates = getTemplates(contentType);
    const samples = [];

    for (const template of templates) {
      // Generate subset of combinations
      const allCombos = generateAllCombinations(template, 20);
      const selected = selectDiverseSubset(allCombos, LIBRARY_CONFIG.templatedSamplesPerTemplate);
      samples.push(...selected);
    }

    return samples;
  }

  /**
   * Get a weighted random sample for a content type
   *
   * @param {string} contentType - Content type
   * @returns {Object|null} Selected sample
   */
  getSample(contentType) {
    const samples = this.samples[contentType];
    if (!samples || samples.length === 0) return null;

    return this.weightManager.selectWeightedSample(samples);
  }

  /**
   * Get multiple diverse samples for a content type
   *
   * @param {string} contentType - Content type
   * @param {number} count - Number of samples to get
   * @returns {Array<Object>} Selected samples
   */
  getSamples(contentType, count) {
    const samples = this.samples[contentType];
    if (!samples || samples.length === 0) return [];

    // Select diverse samples using weighted selection
    const selected = [];
    const usedIds = new Set();

    for (let i = 0; i < count && selected.length < Math.min(count, samples.length); i++) {
      const available = samples.filter(s => !usedIds.has(s.id));
      if (available.length === 0) break;

      const sample = this.weightManager.selectWeightedSample(available);
      if (sample) {
        selected.push(sample);
        usedIds.add(sample.id);
      }
    }

    return selected;
  }

  /**
   * Get all samples for a content type
   *
   * @param {string} contentType - Content type
   * @returns {Array<Object>} All samples
   */
  getAllSamples(contentType) {
    return this.samples[contentType] || [];
  }

  /**
   * Record a training outcome for a sample
   *
   * @param {string} contentType - Content type
   * @param {string} sampleId - Sample ID
   * @param {number} score - Score achieved
   * @param {boolean} success - Whether generation was successful
   */
  recordOutcome(contentType, sampleId, score, success) {
    this.weightManager.recordOutcome(sampleId, score, success);

    // Update metadata
    if (this.metadata[contentType]) {
      this.metadata[contentType].lastUpdated = Date.now();
    }
  }

  /**
   * Expand the library with new samples
   *
   * @param {string} contentType - Content type
   * @param {number} [targetCount] - Target sample count
   */
  async expandLibrary(contentType, targetCount) {
    const current = this.samples[contentType] || [];
    const target = targetCount || LIBRARY_CONFIG.minSamplesPerType;

    if (current.length >= target) return;

    const gaps = identifyCoverageGaps(contentType, current);
    let added = 0;

    while (current.length < target && added < 10) {
      // Try LLM generation first
      if (hasLLMProvider()) {
        const novel = await generateNovelSample(contentType, current, gaps);
        if (novel) {
          current.push(novel);
          this.weightManager.initializeWeights([novel]);
          added++;
          continue;
        }
      }

      // Fallback to template-based generation
      const fallback = createFallbackSample(contentType, gaps);
      if (fallback) {
        current.push(fallback);
        this.weightManager.initializeWeights([fallback]);
        added++;
      } else {
        break;  // Can't generate more
      }
    }

    // Update metadata
    if (this.metadata[contentType]) {
      this.metadata[contentType].totalSamples = current.length;
      this.metadata[contentType].lastUpdated = Date.now();
    }
  }

  /**
   * Add a custom sample to the library
   *
   * @param {string} contentType - Content type
   * @param {Object} sample - Sample to add
   * @returns {boolean} Success
   */
  addSample(contentType, sample) {
    if (!sample.id) {
      sample.id = `custom-${contentType.toLowerCase()}-${Date.now().toString(36)}`;
    }

    if (!this.samples[contentType]) {
      this.samples[contentType] = [];
    }

    // Check for duplicate ID
    if (this.samples[contentType].some(s => s.id === sample.id)) {
      return false;
    }

    this.samples[contentType].push(sample);
    this.weightManager.initializeWeights([sample]);

    // Update metadata
    if (this.metadata[contentType]) {
      this.metadata[contentType].totalSamples = this.samples[contentType].length;
      this.metadata[contentType].lastUpdated = Date.now();
    }

    return true;
  }

  /**
   * Remove a sample from the library
   *
   * @param {string} contentType - Content type
   * @param {string} sampleId - Sample ID
   * @returns {boolean} Success
   */
  removeSample(contentType, sampleId) {
    const samples = this.samples[contentType];
    if (!samples) return false;

    const index = samples.findIndex(s => s.id === sampleId);
    if (index === -1) return false;

    samples.splice(index, 1);

    // Update metadata
    if (this.metadata[contentType]) {
      this.metadata[contentType].totalSamples = samples.length;
      this.metadata[contentType].lastUpdated = Date.now();
    }

    return true;
  }

  /**
   * Save library state to file
   */
  async persist() {
    const state = {
      timestamp: Date.now(),
      version: 1,
      weightState: this.weightManager.exportState(),
      metadata: this.metadata,
      // Note: We don't persist samples themselves since they're regenerated
      // Only persist generated/custom samples
      customSamples: {}
    };

    // Save custom/generated samples
    for (const [contentType, samples] of Object.entries(this.samples)) {
      state.customSamples[contentType] = samples.filter(s =>
        s.isGenerated || s.isFallback || s.id?.startsWith('custom-')
      );
    }

    try {
      // Ensure data directory exists
      if (!existsSync(DATA_DIR)) {
        await mkdir(DATA_DIR, { recursive: true });
      }

      await writeFile(SAMPLE_LIBRARY_PATH, JSON.stringify(state, null, 2));
      console.log(`Sample library state saved to ${SAMPLE_LIBRARY_PATH}`);
    } catch (error) {
      console.error('Failed to persist sample library:', error.message);
    }
  }

  /**
   * Load persisted state from file
   */
  async loadPersistedState() {
    try {
      const data = await readFile(SAMPLE_LIBRARY_PATH, 'utf-8');
      const state = JSON.parse(data);

      // Import weight state
      if (state.weightState) {
        this.weightManager.importState(state.weightState);
      }

      // Add custom samples back
      if (state.customSamples) {
        for (const [contentType, samples] of Object.entries(state.customSamples)) {
          if (this.samples[contentType]) {
            // Add only if not already present
            for (const sample of samples) {
              if (!this.samples[contentType].some(s => s.id === sample.id)) {
                this.samples[contentType].push(sample);
              }
            }
            this.weightManager.initializeWeights(samples);
          }
        }
      }

      console.log('Sample library state loaded from', SAMPLE_LIBRARY_PATH);
    } catch (error) {
      // No persisted state or error reading
      if (error.code !== 'ENOENT') {
        console.warn('Failed to load persisted state:', error.message);
      }
    }
  }

  /**
   * Get coverage report for all content types
   *
   * @returns {Object} Coverage report
   */
  getCoverageReport() {
    const report = {};

    for (const contentType of CONTENT_TYPES) {
      const samples = this.samples[contentType] || [];
      const dimensions = SAMPLE_DIMENSIONS[contentType];

      report[contentType] = {
        totalSamples: samples.length,
        targetMet: samples.length >= LIBRARY_CONFIG.minSamplesPerType,
        dimensionCoverage: {},
        edgeCaseCoverage: {
          total: getEdgeCaseSamples(contentType).length,
          included: samples.filter(s => s.difficultyLevel).length
        },
        sampleTypes: getSampleGenerationStats(samples),
        weightStats: this.weightManager.getStatistics()
      };

      // Calculate dimension coverage
      if (dimensions) {
        const dimensionNames = getDimensionNames(contentType);
        for (const dimName of dimensionNames) {
          const values = getDimensionValues(contentType, dimName);
          const covered = new Set(samples.map(s => s[dimName]).filter(Boolean));
          report[contentType].dimensionCoverage[dimName] = {
            covered: covered.size,
            total: values.length,
            percentage: values.length > 0
              ? parseFloat(((covered.size / values.length) * 100).toFixed(1))
              : 0
          };
        }
      }
    }

    return report;
  }

  /**
   * Get weight distribution for a content type
   *
   * @param {string} contentType - Content type
   * @returns {Array<Object>} Weight distribution
   */
  getWeightDistribution(contentType) {
    const samples = this.samples[contentType] || [];
    const distribution = this.weightManager.getWeightDistribution();

    // Filter to only samples in this content type
    const sampleIds = new Set(samples.map(s => s.id));
    return distribution.filter(d => sampleIds.has(d.id));
  }

  /**
   * Reset the library to initial state
   */
  reset() {
    this.samples = {};
    this.metadata = {};
    this.weightManager = new SampleWeightManager();
    this.initialized = false;
  }
}

// Singleton instance
export const sampleLibrary = new SampleLibrary();

/**
 * Validate Phase 6 implementation
 *
 * @returns {Promise<Object>} Validation results
 */
export async function validatePhase6() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: SampleLibrary can be instantiated
  const library = new SampleLibrary();
  results.tests.push({
    name: 'SampleLibrary instantiates',
    passed: library !== null && typeof library.initialize === 'function',
    details: `hasInit=${typeof library.initialize === 'function'}`
  });

  // Test 2: Initialize with base samples
  await library.initialize({
    baseSamples: {
      Roadmap: [{ id: 'base-1', name: 'Base Sample 1' }]
    },
    loadPersisted: false
  });
  results.tests.push({
    name: 'Initialize with base samples',
    passed: library.initialized && library.samples.Roadmap.length > 0,
    details: `initialized=${library.initialized}, roadmapCount=${library.samples.Roadmap?.length}`
  });

  // Test 3: All content types have samples after init
  const allHaveSamples = CONTENT_TYPES.every(ct => library.samples[ct]?.length > 0);
  results.tests.push({
    name: 'All types have samples after init',
    passed: allHaveSamples,
    details: `counts=${CONTENT_TYPES.map(ct => library.samples[ct]?.length).join(', ')}`
  });

  // Test 4: getSample returns valid sample
  const sample = library.getSample('Roadmap');
  results.tests.push({
    name: 'getSample returns sample',
    passed: sample !== null && sample.id !== undefined,
    details: `sample=${sample?.id}`
  });

  // Test 5: getSamples returns multiple samples
  const samples = library.getSamples('Slides', 3);
  results.tests.push({
    name: 'getSamples returns multiple',
    passed: samples.length === 3,
    details: `count=${samples.length}`
  });

  // Test 6: recordOutcome works
  library.recordOutcome('Roadmap', 'base-1', 0.8, true);
  const perf = library.weightManager.getPerformance('base-1');
  results.tests.push({
    name: 'recordOutcome works',
    passed: perf !== null && perf.successes > 0,
    details: `successes=${perf?.successes}`
  });

  // Test 7: addSample works
  const added = library.addSample('Document', { name: 'Custom Sample' });
  results.tests.push({
    name: 'addSample works',
    passed: added && library.samples.Document.some(s => s.name === 'Custom Sample'),
    details: `added=${added}`
  });

  // Test 8: removeSample works
  const customSample = library.samples.Document.find(s => s.name === 'Custom Sample');
  const removed = library.removeSample('Document', customSample.id);
  results.tests.push({
    name: 'removeSample works',
    passed: removed && !library.samples.Document.some(s => s.name === 'Custom Sample'),
    details: `removed=${removed}`
  });

  // Test 9: getCoverageReport works
  const report = library.getCoverageReport();
  results.tests.push({
    name: 'getCoverageReport works',
    passed: report.Roadmap !== undefined && report.Roadmap.totalSamples > 0,
    details: `roadmapSamples=${report.Roadmap?.totalSamples}`
  });

  // Test 10: getWeightDistribution works
  const distribution = library.getWeightDistribution('Roadmap');
  results.tests.push({
    name: 'getWeightDistribution works',
    passed: Array.isArray(distribution) && distribution.length > 0,
    details: `distributionLength=${distribution.length}`
  });

  // Test 11: reset works
  library.reset();
  results.tests.push({
    name: 'reset works',
    passed: library.initialized === false && Object.keys(library.samples).length === 0,
    details: `initialized=${library.initialized}, samplesCount=${Object.keys(library.samples).length}`
  });

  // Test 12: Singleton exists
  results.tests.push({
    name: 'Singleton sampleLibrary exists',
    passed: sampleLibrary instanceof SampleLibrary,
    details: `isSampleLibrary=${sampleLibrary instanceof SampleLibrary}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation1 = validatePhase1();
  console.log('Sample Library Phase 1 Validation:', validation1.passed ? 'PASSED' : 'FAILED');
  if (!validation1.passed) {
    validation1.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  const validation2 = validatePhase2();
  console.log('Sample Library Phase 2 Validation:', validation2.passed ? 'PASSED' : 'FAILED');
  if (!validation2.passed) {
    validation2.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  const validation3 = validatePhase3();
  console.log('Sample Library Phase 3 Validation:', validation3.passed ? 'PASSED' : 'FAILED');
  if (!validation3.passed) {
    validation3.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  const validation4 = validatePhase4();
  console.log('Sample Library Phase 4 Validation:', validation4.passed ? 'PASSED' : 'FAILED');
  if (!validation4.passed) {
    validation4.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  const validation5 = validatePhase5();
  console.log('Sample Library Phase 5 Validation:', validation5.passed ? 'PASSED' : 'FAILED');
  if (!validation5.passed) {
    validation5.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  // Phase 6 validation is async
  validatePhase6().then(validation6 => {
    console.log('Sample Library Phase 6 Validation:', validation6.passed ? 'PASSED' : 'FAILED');
    if (!validation6.passed) {
      validation6.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  FAILED: ${t.name} - ${t.details}`);
      });
    }
  });
}
