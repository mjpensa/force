/**
 * ResearchAnalysis Quality Scoring
 *
 * Comprehensive quality scoring for ResearchAnalysis content with 10 dimensions.
 *
 * Implementation of Plan 04: Scoring Depth Parity - Phase 4
 */

import { RESEARCH_ANALYSIS_DIMENSIONS, calculateWeightedScore } from './qualityDimensions.js';

// ============================================================================
// Phase 4: ResearchAnalysis Quality Scoring Implementation
// ============================================================================

/**
 * Score overall ResearchAnalysis quality across all dimensions
 *
 * @param {Object} data - ResearchAnalysis data structure
 * @returns {Object} { overall, dimensions, feedback }
 */
export function scoreResearchAnalysisQuality(data) {
  // Handle invalid/empty data
  if (!data || typeof data !== 'object') {
    return {
      overall: 0,
      dimensions: {},
      feedback: [{ dimension: 'data', score: 0, description: 'No data provided' }]
    };
  }

  // Handle empty structure
  const hasContent = data.themes?.length > 0 ||
    data.insights?.length > 0 ||
    data.recommendations?.length > 0 ||
    data.summary ||
    data.findings?.length > 0;

  if (!hasContent) {
    return {
      overall: 0,
      dimensions: {},
      feedback: [{ dimension: 'structure', score: 0, description: 'No analysis content defined' }]
    };
  }

  const scores = {};

  // 1. Theme Coherence
  scores.themeCoherence = scoreThemeCoherence(data);

  // 2. Evidence Depth
  scores.evidenceDepth = scoreEvidenceDepth(data);

  // 3. Insight Novelty
  scores.insightNovelty = scoreInsightNovelty(data);

  // 4. Source Variety
  scores.sourceVariety = scoreSourceVariety(data);

  // 5. Quantification Level
  scores.quantificationLevel = scoreQuantificationLevel(data);

  // 6. Counterargument Awareness
  scores.counterargumentAwareness = scoreCounterargumentAwareness(data);

  // 7. Actionability Score
  scores.actionabilityScore = scoreActionability(data);

  // 8. Prioritization
  scores.prioritization = scorePrioritization(data);

  // 9. Synthesis Quality
  scores.synthesisQuality = scoreSynthesisQuality(data);

  // 10. Temporal Awareness
  scores.temporalAwareness = scoreTemporalAwareness(data);

  return calculateWeightedScore(scores, RESEARCH_ANALYSIS_DIMENSIONS);
}

/**
 * Score theme coherence - are themes distinct and mutually exclusive?
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {number} Score 0-1
 */
export function scoreThemeCoherence(data) {
  const themes = data.themes || data.findings || data.sections || [];
  if (themes.length === 0) return 0;
  if (themes.length === 1) return 0.6;  // Single theme is acceptable

  // Get theme names
  const themeNames = themes
    .map(t => (t.name || t.title || t.theme || '').toLowerCase())
    .filter(n => n.length > 0);

  if (themeNames.length < 2) return 0.5;

  let overlapScore = 1.0;

  // Check for word overlap between themes
  for (let i = 0; i < themeNames.length; i++) {
    const words1 = new Set(themeNames[i].split(/\s+/).filter(w => w.length > 3));

    for (let j = i + 1; j < themeNames.length; j++) {
      const words2 = new Set(themeNames[j].split(/\s+/).filter(w => w.length > 3));
      const intersection = [...words1].filter(w => words2.has(w));

      if (intersection.length > 0) {
        overlapScore -= 0.1 * intersection.length;
      }
    }
  }

  // Also check theme descriptions for distinctiveness
  const descriptions = themes
    .map(t => (t.description || t.summary || '').toLowerCase())
    .filter(d => d.length > 0);

  if (descriptions.length >= 2) {
    // Check semantic similarity via shared significant words
    const allSignificantWords = new Map();

    for (const desc of descriptions) {
      const words = desc.split(/\s+/).filter(w => w.length > 5);
      for (const word of words) {
        allSignificantWords.set(word, (allSignificantWords.get(word) || 0) + 1);
      }
    }

    // Many repeated words = less distinct themes
    const repeatedWords = [...allSignificantWords.values()].filter(c => c > 1).length;
    const repeatRatio = repeatedWords / Math.max(allSignificantWords.size, 1);

    if (repeatRatio > 0.3) overlapScore -= 0.2;
  }

  return Math.max(0, Math.min(1, overlapScore));
}

/**
 * Score evidence depth - does each theme have multiple supporting evidence?
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {number} Score 0-1
 */
export function scoreEvidenceDepth(data) {
  const themes = data.themes || data.findings || data.sections || [];
  if (themes.length === 0) return 0;

  const depthScores = [];

  for (const theme of themes) {
    const evidence = theme.evidence || theme.dataPoints || theme.sources || theme.support || [];
    const content = theme.description || theme.content || theme.summary || '';

    let score = 0;

    // Score based on explicit evidence count
    if (evidence.length >= 1) score += 0.2;
    if (evidence.length >= 2) score += 0.2;
    if (evidence.length >= 3) score += 0.2;

    // Check evidence quality
    for (const item of evidence) {
      const itemText = typeof item === 'string' ? item : (item.text || item.description || '');

      // Has numbers
      if (/\d/.test(itemText)) score += 0.05;
      // Has source attribution
      if (/\[|\]|source|according|study|report/i.test(itemText)) score += 0.05;
    }

    // Also check content for embedded evidence
    if (/\d+%|\$[\d,]+|million|billion/i.test(content)) score += 0.1;
    if (/according to|research shows|study found|data indicates/i.test(content)) score += 0.1;

    depthScores.push(Math.min(1, score));
  }

  return depthScores.reduce((a, b) => a + b, 0) / depthScores.length;
}

/**
 * Score insight novelty - do insights go beyond obvious observations?
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {number} Score 0-1
 */
export function scoreInsightNovelty(data) {
  const insights = data.insights || data.keyFindings || data.conclusions || [];

  // If no explicit insights, extract from themes
  let insightTexts = insights.map(i => typeof i === 'string' ? i : (i.text || i.description || ''));

  if (insightTexts.length === 0 && data.themes) {
    insightTexts = data.themes
      .map(t => t.insight || t.conclusion || t.keyFinding || '')
      .filter(i => i.length > 0);
  }

  if (insightTexts.length === 0) return 0.3;  // No insights = low but not zero

  const genericPatterns = [
    /is important/i,
    /should consider/i,
    /growing trend/i,
    /increasingly/i,
    /key factor/i,
    /plays a role/i,
    /is critical/i,
    /needs to focus/i
  ];

  const novelPatterns = [
    /however|paradoxically|surprisingly|contrary to/i,
    /\d+x|\d+%/,  // Quantified insights
    /outperform|underperform/i,
    /correlation|causation/i,
    /leading indicator|lagging/i,
    /counterintuitive|unexpected/i,
    /despite|although/i,
    /unique|differentiated|first/i
  ];

  const noveltyScores = [];

  for (const insight of insightTexts) {
    let score = 0.5;  // Base score

    // Penalize generic language
    for (const pattern of genericPatterns) {
      if (pattern.test(insight)) score -= 0.08;
    }

    // Reward novel framing
    for (const pattern of novelPatterns) {
      if (pattern.test(insight)) score += 0.1;
    }

    // Reward specificity (longer insights with details)
    const wordCount = insight.split(/\s+/).length;
    if (wordCount >= 15 && wordCount <= 50) score += 0.15;

    noveltyScores.push(Math.max(0, Math.min(1, score)));
  }

  return noveltyScores.reduce((a, b) => a + b, 0) / noveltyScores.length;
}

/**
 * Score source variety - does evidence draw from multiple source types?
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {number} Score 0-1
 */
export function scoreSourceVariety(data) {
  const allContent = extractAllContent(data);

  const sourceTypes = {
    academic: /journal|study|research|university|professor|peer.?review/i,
    industry: /gartner|forrester|mckinsey|deloitte|accenture|bain|bcg/i,
    news: /reuters|bloomberg|wsj|wall street|nyt|times|forbes|economist/i,
    company: /annual report|earnings call|10-k|sec filing|investor|quarterly/i,
    survey: /survey|poll|respondent|sample size|n=\d+/i,
    data: /database|dataset|statistics|census|bureau/i,
    expert: /analyst|expert|ceo|cto|executive|interview/i
  };

  const foundTypes = new Set();

  for (const [type, pattern] of Object.entries(sourceTypes)) {
    if (pattern.test(allContent)) {
      foundTypes.add(type);
    }
  }

  // Also check for explicit source references
  const sourceCount = (allContent.match(/\[.+?\]|source:|according to/gi) || []).length;

  let score = 0;

  // Score based on variety
  if (foundTypes.size >= 1) score += 0.3;
  if (foundTypes.size >= 2) score += 0.25;
  if (foundTypes.size >= 3) score += 0.25;
  if (foundTypes.size >= 4) score += 0.2;

  return Math.min(1, score);
}

/**
 * Score quantification level - does analysis include specific numbers?
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {number} Score 0-1
 */
export function scoreQuantificationLevel(data) {
  const allContent = extractAllContent(data);
  const wordCount = allContent.split(/\s+/).length;

  if (wordCount < 50) return 0;

  // Count different types of quantification
  const patterns = {
    percentage: /\d+%/g,
    currency: /\$[\d,.]+\s*(million|billion|thousand|m|b|k)?/gi,
    multiplier: /\d+x|\d+\s*times/gi,
    absolute: /\d+\s*(million|billion|thousand|users|customers|companies)/gi,
    growth: /grew|increased|decreased|declined\s+\d+/gi,
    comparison: /\d+%?\s*(higher|lower|more|less|better|worse)/gi,
    ratio: /\d+:\d+|\d+\s*out of\s*\d+/gi
  };

  let totalMatches = 0;
  const typesFound = new Set();

  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = allContent.match(pattern) || [];
    if (matches.length > 0) {
      typesFound.add(type);
      totalMatches += matches.length;
    }
  }

  // Calculate density-based score
  const density = totalMatches / (wordCount / 100);  // Matches per 100 words

  let score = 0;
  if (density >= 0.5) score += 0.3;
  if (density >= 1) score += 0.2;
  if (density >= 2) score += 0.2;

  // Bonus for variety of quantification types
  if (typesFound.size >= 2) score += 0.15;
  if (typesFound.size >= 3) score += 0.15;

  return Math.min(1, score);
}

/**
 * Score counterargument awareness - does analysis acknowledge limitations?
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {number} Score 0-1
 */
export function scoreCounterargumentAwareness(data) {
  const allContent = extractAllContent(data);

  const awarenessPatterns = {
    limitation: /limitation|caveat|however|nevertheless|on the other hand/i,
    uncertainty: /uncertain|unknown|unclear|ambiguous|may|might|could/i,
    risk: /risk|challenge|concern|threat|downside/i,
    alternative: /alternative|alternatively|another view|some argue|critics/i,
    acknowledge: /acknowledge|recognize|note that|important to consider/i,
    conditional: /assuming|if|provided that|depends on|contingent/i
  };

  let score = 0;
  const patternsFound = new Set();

  for (const [type, pattern] of Object.entries(awarenessPatterns)) {
    if (pattern.test(allContent)) {
      patternsFound.add(type);
      score += 0.15;
    }
  }

  // Check for dedicated limitations/risks section
  const themes = data.themes || data.sections || [];
  const hasLimitationSection = themes.some(t => {
    const name = (t.name || t.title || '').toLowerCase();
    return /limitation|risk|challenge|consideration|caveat/i.test(name);
  });

  if (hasLimitationSection) score += 0.2;

  return Math.min(1, score);
}

/**
 * Score actionability - are recommendations specific and actionable?
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {number} Score 0-1
 */
export function scoreActionability(data) {
  const recommendations = data.recommendations ||
    data.actionItems ||
    data.nextSteps ||
    [];

  // Extract from themes if not explicit
  let recTexts = recommendations.map(r =>
    typeof r === 'string' ? r : (r.text || r.description || r.recommendation || '')
  ).filter(r => r.length > 0);

  if (recTexts.length === 0 && data.themes) {
    recTexts = data.themes
      .flatMap(t => t.recommendations || t.actions || [])
      .map(r => typeof r === 'string' ? r : (r.text || ''))
      .filter(r => r.length > 0);
  }

  if (recTexts.length === 0) return 0.2;  // No recommendations

  const actionScores = [];

  for (const rec of recTexts) {
    let score = 0;

    // Starts with action verb
    const actionVerbs = /^(implement|develop|create|establish|invest|deploy|hire|partner|acquire|launch|build|design|evaluate|assess|conduct|initiate|expand|reduce|improve|optimize)/i;
    if (actionVerbs.test(rec)) score += 0.3;

    // Contains specifics
    if (/\d/.test(rec)) score += 0.15;  // Numbers
    if (/by\s+(q[1-4]|20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)/i.test(rec)) {
      score += 0.2;  // Timeline
    }
    if (/\$[\d,]+|budget|invest|\d+%/i.test(rec)) score += 0.15;  // Resources

    // Not too vague
    const wordCount = rec.split(/\s+/).length;
    if (wordCount >= 8 && wordCount <= 40) score += 0.2;

    actionScores.push(Math.min(1, score));
  }

  return actionScores.reduce((a, b) => a + b, 0) / actionScores.length;
}

/**
 * Score prioritization - are themes/recommendations prioritized?
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {number} Score 0-1
 */
export function scorePrioritization(data) {
  const allContent = extractAllContent(data);
  let score = 0;

  // Check for explicit prioritization
  const priorityPatterns = [
    /priority|priorities|prioritize/i,
    /most important|critical|essential|key/i,
    /first|second|third|primary|secondary/i,
    /high.?priority|medium.?priority|low.?priority/i,
    /rank|ranking|order of importance/i,
    /top\s+\d+|top\s+three|top\s+five/i
  ];

  for (const pattern of priorityPatterns) {
    if (pattern.test(allContent)) {
      score += 0.15;
    }
  }

  // Check themes/recommendations for explicit ordering
  const themes = data.themes || data.findings || [];
  const recommendations = data.recommendations || [];

  // Check if items have priority fields
  const hasExplicitPriority = themes.some(t => t.priority !== undefined) ||
    recommendations.some(r => r.priority !== undefined);

  if (hasExplicitPriority) score += 0.3;

  // Check for numbered or ordered lists in content
  if (/\b(1\.|2\.|3\.|\(1\)|\(2\)|\(3\)|first|second|third)\b/i.test(allContent)) {
    score += 0.15;
  }

  return Math.min(1, score);
}

/**
 * Score synthesis quality - does summary synthesize themes effectively?
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {number} Score 0-1
 */
export function scoreSynthesisQuality(data) {
  const summary = data.summary || data.executiveSummary || data.conclusion || '';

  if (!summary || summary.length < 50) return 0.2;

  let score = 0;

  // Check summary length (not too short, not too long)
  const wordCount = summary.split(/\s+/).length;
  if (wordCount >= 50 && wordCount <= 300) score += 0.25;
  else if (wordCount >= 30 && wordCount <= 500) score += 0.15;

  // Check for synthesis language
  const synthesisPatterns = [
    /overall|in summary|to summarize|in conclusion/i,
    /key finding|main insight|primary conclusion/i,
    /together|combined|collectively/i,
    /across|throughout|consistently/i,
    /theme|pattern|trend/i
  ];

  for (const pattern of synthesisPatterns) {
    if (pattern.test(summary)) score += 0.1;
  }

  // Check if summary references multiple themes
  const themes = data.themes || data.findings || [];
  const themeNames = themes.map(t =>
    (t.name || t.title || '').toLowerCase()
  ).filter(n => n.length > 3);

  let themesReferenced = 0;
  for (const name of themeNames) {
    if (summary.toLowerCase().includes(name)) {
      themesReferenced++;
    }
  }

  if (themesReferenced >= 2) score += 0.2;
  else if (themesReferenced >= 1) score += 0.1;

  return Math.min(1, score);
}

/**
 * Score temporal awareness - does analysis consider timing and trends?
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {number} Score 0-1
 */
export function scoreTemporalAwareness(data) {
  const allContent = extractAllContent(data);

  const temporalPatterns = {
    timeline: /20\d{2}|q[1-4]\s*20\d{2}|last\s+year|next\s+year|this\s+year/i,
    trend: /trend|trending|trajectory|momentum|growth|decline/i,
    historical: /historically|in the past|previously|before|was|were/i,
    future: /will|forecast|project|predict|expect|anticipate|outlook/i,
    comparison: /year.?over.?year|yoy|compared to\s+\d+|vs\.\s*\d+/i,
    period: /monthly|quarterly|annually|weekly|daily/i
  };

  let score = 0;
  const patternsFound = new Set();

  for (const [type, pattern] of Object.entries(temporalPatterns)) {
    if (pattern.test(allContent)) {
      patternsFound.add(type);
      score += 0.15;
    }
  }

  // Bonus for multiple types of temporal awareness
  if (patternsFound.size >= 3) score += 0.15;

  return Math.min(1, score);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract all text content from research analysis
 *
 * @param {Object} data - ResearchAnalysis data
 * @returns {string} Combined content
 */
function extractAllContent(data) {
  const parts = [];

  // Add summary
  if (data.summary) parts.push(data.summary);
  if (data.executiveSummary) parts.push(data.executiveSummary);
  if (data.conclusion) parts.push(data.conclusion);

  // Add theme content
  const themes = data.themes || data.findings || data.sections || [];
  for (const theme of themes) {
    if (theme.name) parts.push(theme.name);
    if (theme.title) parts.push(theme.title);
    if (theme.description) parts.push(theme.description);
    if (theme.content) parts.push(theme.content);
    if (theme.summary) parts.push(theme.summary);

    // Add evidence
    const evidence = theme.evidence || theme.dataPoints || [];
    for (const e of evidence) {
      if (typeof e === 'string') parts.push(e);
      else if (e.text) parts.push(e.text);
    }
  }

  // Add insights
  const insights = data.insights || data.keyFindings || [];
  for (const insight of insights) {
    if (typeof insight === 'string') parts.push(insight);
    else if (insight.text) parts.push(insight.text);
  }

  // Add recommendations
  const recommendations = data.recommendations || data.actionItems || [];
  for (const rec of recommendations) {
    if (typeof rec === 'string') parts.push(rec);
    else if (rec.text) parts.push(rec.text);
  }

  return parts.join(' ');
}

// ============================================================================
// Validation
// ============================================================================

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

  // Test 1: scoreResearchAnalysisQuality returns valid structure
  const emptyResult = scoreResearchAnalysisQuality({});
  results.tests.push({
    name: 'scoreResearchAnalysisQuality handles empty data',
    passed: emptyResult.overall === 0 && emptyResult.feedback !== undefined,
    details: `overall=${emptyResult.overall}`
  });

  // Test 2: All 10 dimensions are scored
  const mockData = createMockResearchAnalysis();
  const result = scoreResearchAnalysisQuality(mockData);
  const dimensionCount = Object.keys(result.dimensions).length;
  results.tests.push({
    name: 'All 10 dimensions scored',
    passed: dimensionCount === 10,
    details: `dimensions=${dimensionCount}`
  });

  // Test 3: Scores are in valid range (0-1)
  const allScoresValid = Object.values(result.dimensions).every(s => s >= 0 && s <= 1);
  results.tests.push({
    name: 'All scores in 0-1 range',
    passed: allScoresValid,
    details: `scores=${Object.values(result.dimensions).map(s => s.toFixed(2)).join(', ')}`
  });

  // Test 4: Overall score is reasonable
  results.tests.push({
    name: 'Overall score is reasonable',
    passed: result.overall >= 0 && result.overall <= 1,
    details: `overall=${result.overall.toFixed(3)}`
  });

  // Test 5: Good mock scores higher than bad mock
  const badMock = { themes: [] };
  const badResult = scoreResearchAnalysisQuality(badMock);
  results.tests.push({
    name: 'Good mock scores higher than bad',
    passed: result.overall > badResult.overall,
    details: `good=${result.overall.toFixed(3)}, bad=${badResult.overall.toFixed(3)}`
  });

  // Test 6: scoreThemeCoherence works
  results.tests.push({
    name: 'scoreThemeCoherence works',
    passed: typeof scoreThemeCoherence(mockData) === 'number',
    details: `score=${scoreThemeCoherence(mockData).toFixed(3)}`
  });

  // Test 7: scoreEvidenceDepth works
  results.tests.push({
    name: 'scoreEvidenceDepth works',
    passed: typeof scoreEvidenceDepth(mockData) === 'number',
    details: `score=${scoreEvidenceDepth(mockData).toFixed(3)}`
  });

  // Test 8: scoreActionability works
  results.tests.push({
    name: 'scoreActionability works',
    passed: typeof scoreActionability(mockData) === 'number',
    details: `score=${scoreActionability(mockData).toFixed(3)}`
  });

  // Test 9: Handles null gracefully
  const nullResult = scoreResearchAnalysisQuality(null);
  results.tests.push({
    name: 'Handles null gracefully',
    passed: nullResult.overall === 0,
    details: `overall=${nullResult.overall}`
  });

  // Test 10: Feedback generated
  results.tests.push({
    name: 'Feedback generated',
    passed: Array.isArray(result.feedback),
    details: `feedbackCount=${result.feedback?.length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

/**
 * Create mock research analysis for testing
 */
function createMockResearchAnalysis() {
  return {
    summary: `This comprehensive market analysis examines three key trends reshaping the enterprise software landscape in 2025.
Overall, our research indicates a significant shift toward AI-powered solutions, with market leaders demonstrating 3x faster adoption rates than industry averages.
The findings suggest that companies prioritizing digital transformation will capture disproportionate market share, though several risks and uncertainties merit consideration.`,

    themes: [
      {
        name: 'AI Integration Acceleration',
        title: 'Enterprise AI Integration Accelerates Beyond Expectations',
        description: 'Enterprise adoption of AI tools has exceeded analyst projections by 45% in 2024, driven by improved ROI visibility and reduced implementation costs.',
        evidence: [
          'Gartner reports 67% of enterprises have deployed at least one AI application, up from 42% in 2023',
          'McKinsey study shows average implementation time decreased from 18 months to 6 months',
          'Survey of 500 CIOs indicates 78% plan increased AI spending in 2025'
        ],
        insight: 'Paradoxically, companies that delayed AI adoption are now moving faster than early adopters due to mature tooling'
      },
      {
        name: 'Cloud Cost Optimization',
        title: 'Cloud Spending Rationalization Becomes Priority',
        description: 'After years of rapid cloud migration, enterprises are now focusing on cost optimization, with 62% reporting FinOps initiatives.',
        evidence: [
          'Forrester data shows 35% average cloud waste across enterprise accounts',
          'FinOps Foundation reports 2.5x increase in certified practitioners YoY',
          'AWS, Azure, and GCP all launched enhanced cost management tools in 2024'
        ],
        insight: 'Companies achieving 20%+ cost reduction share common patterns: centralized governance, automated rightsizing, and commitment-based pricing'
      },
      {
        name: 'Security Posture Evolution',
        title: 'Zero Trust Architecture Becomes Standard',
        description: 'Zero Trust security frameworks have moved from aspirational to mandatory, with regulatory requirements driving adoption.',
        evidence: [
          'SEC cybersecurity disclosure rules now require board-level reporting',
          '73% of breaches in 2024 involved credential compromise, driving passwordless adoption',
          'Zero Trust market projected to reach $51.6B by 2026 according to Markets and Markets'
        ],
        insight: 'Despite increased security spending, breach costs continue rising, suggesting that technology alone is insufficient without cultural change'
      }
    ],

    insights: [
      'AI adoption has reached an inflection point where non-adoption carries greater risk than adoption challenges',
      'Cloud cost optimization represents a $100B+ opportunity as enterprises mature their cloud strategies',
      'Security investment is shifting from perimeter defense to identity-centric approaches',
      'The convergence of these trends creates opportunities for integrated platform plays'
    ],

    recommendations: [
      'Establish an AI Center of Excellence by Q2 2025 to coordinate adoption efforts and share best practices',
      'Implement FinOps practices with a target of 25% cost reduction within 12 months through automated optimization',
      'Conduct a Zero Trust maturity assessment and develop a 24-month roadmap aligned with regulatory requirements',
      'Evaluate platform consolidation opportunities to reduce vendor complexity and improve security posture',
      'Allocate 15% of IT budget to emerging technology experimentation with clear success metrics'
    ],

    limitations: 'This analysis is based on publicly available data and may not reflect industry-specific dynamics. Market projections assume continued economic stability.'
  };
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase4();
  console.log('ResearchAnalysis Scoring Phase 4 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
