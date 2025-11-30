/**
 * Slides Quality Scoring
 *
 * Comprehensive quality scoring for Slides content with 10 dimensions.
 *
 * Implementation of Plan 04: Scoring Depth Parity - Phase 3
 */

import { SLIDES_DIMENSIONS, calculateWeightedScore } from './qualityDimensions.js';

// ============================================================================
// Phase 3: Slides Quality Scoring Implementation
// ============================================================================

/**
 * Score overall Slides quality across all dimensions
 *
 * @param {Object} data - Slides data structure
 * @returns {Object} { overall, dimensions, feedback }
 */
export function scoreSlidesQuality(data) {
  // Handle invalid/empty data
  if (!data || typeof data !== 'object') {
    return {
      overall: 0,
      dimensions: {},
      feedback: [{ dimension: 'data', score: 0, description: 'No data provided' }]
    };
  }

  // Handle empty slides
  if (!data.slides || data.slides.length === 0) {
    return {
      overall: 0,
      dimensions: {},
      feedback: [{ dimension: 'structure', score: 0, description: 'No slides defined' }]
    };
  }

  const scores = {};

  // 1. Narrative Flow
  scores.narrativeFlow = scoreNarrativeFlow(data);

  // 2. Slide Content Density
  scores.slideContentDensity = scoreContentDensity(data);

  // 3. Title Effectiveness
  scores.titleEffectiveness = scoreTitleEffectiveness(data);

  // 4. Evidence Integration
  scores.evidenceIntegration = scoreEvidenceIntegration(data);

  // 5. Audience Alignment
  scores.audienceAlignment = scoreAudienceAlignment(data);

  // 6. Visual Suggestions
  scores.visualSuggestions = scoreVisualSuggestions(data);

  // 7. Key Takeaways
  scores.keyTakeaways = scoreKeyTakeaways(data);

  // 8. Exec Summary Presence
  scores.execSummaryPresence = scoreExecSummaryPresence(data);

  // 9. Bullet Point Quality
  scores.bulletPointQuality = scoreBulletPointQuality(data);

  // 10. Transition Logic
  scores.transitionLogic = scoreTransitionLogic(data);

  return calculateWeightedScore(scores, SLIDES_DIMENSIONS);
}

/**
 * Score narrative flow - does presentation follow logical progression?
 *
 * @param {Object} data - Slides data
 * @returns {number} Score 0-1
 */
export function scoreNarrativeFlow(data) {
  if (!data.slides?.length) return 0;

  const slideTypes = data.slides.map(s => classifySlide(s));

  let score = 0;

  // Starts with intro-type slide
  if (slideTypes[0] === 'intro') score += 0.3;

  // Ends with conclusion (before any appendix)
  const mainSlides = slideTypes.filter(t => t !== 'appendix');
  if (mainSlides.length > 0 && mainSlides[mainSlides.length - 1] === 'conclusion') {
    score += 0.3;
  }

  // Has body content
  const bodyCount = slideTypes.filter(t => t === 'body').length;
  if (bodyCount >= 2) score += 0.2;
  if (bodyCount >= 4) score += 0.2;

  // Check for logical grouping (related slides together)
  // Simplified: check that intro slides are at start, conclusion at end
  const introIndex = slideTypes.indexOf('intro');
  const conclusionIndex = slideTypes.lastIndexOf('conclusion');
  const appendixIndex = slideTypes.indexOf('appendix');

  if (introIndex === 0 || introIndex === -1) {
    // Intro at start or no intro (acceptable)
  } else {
    score -= 0.1;
  }

  if (appendixIndex === -1 || appendixIndex > conclusionIndex) {
    // Appendix after conclusion or no appendix (acceptable)
  } else {
    score -= 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Score slide content density - appropriate amount of content per slide
 *
 * @param {Object} data - Slides data
 * @returns {number} Score 0-1
 */
export function scoreContentDensity(data) {
  if (!data.slides?.length) return 0;

  const densityScores = [];

  for (const slide of data.slides) {
    const content = getSlideContent(slide);
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

    // Ideal density: 40-150 words per slide
    let densityScore;
    if (wordCount < 15) {
      densityScore = 0.3;  // Too sparse
    } else if (wordCount < 40) {
      densityScore = 0.6;
    } else if (wordCount <= 150) {
      densityScore = 1.0;  // Ideal
    } else if (wordCount <= 200) {
      densityScore = 0.7;
    } else {
      densityScore = 0.4;  // Too dense
    }

    densityScores.push(densityScore);
  }

  return densityScores.reduce((a, b) => a + b, 0) / densityScores.length;
}

/**
 * Score title effectiveness - are titles action-oriented or insight-driven?
 *
 * @param {Object} data - Slides data
 * @returns {number} Score 0-1
 */
export function scoreTitleEffectiveness(data) {
  if (!data.slides?.length) return 0;

  const titleScores = [];

  for (const slide of data.slides) {
    const title = slide.title || slide.heading || '';
    let score = 0;

    // Has title
    if (title.length > 0) score += 0.2;

    // Reasonable length (2-12 words)
    const wordCount = title.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= 2 && wordCount <= 12) score += 0.2;

    // Contains action word or insight indicator
    const actionInsightWords = /\b(drive|enable|achieve|reveal|show|demonstrate|key|critical|how|why|what|impact|opportunity|challenge|strategy|results|recommendation)\b/i;
    if (actionInsightWords.test(title)) score += 0.3;

    // Not generic
    const genericTitles = /^(slide|page|section|overview|introduction|conclusion)\s*\d*$/i;
    if (!genericTitles.test(title) && title.length > 5) score += 0.3;

    titleScores.push(score);
  }

  return titleScores.reduce((a, b) => a + b, 0) / titleScores.length;
}

/**
 * Score evidence integration - are claims supported by data?
 *
 * @param {Object} data - Slides data
 * @returns {number} Score 0-1
 */
export function scoreEvidenceIntegration(data) {
  if (!data.slides?.length) return 0;

  const evidenceScores = [];

  for (const slide of data.slides) {
    const content = getSlideContent(slide);
    let score = 0;

    // Quantitative data (numbers, percentages, currencies)
    if (/\$[\d,]+|\d+%|\d+\s*(million|billion|thousand|k|m|b)\b/i.test(content)) {
      score += 0.3;
    }

    // Citations or sources
    if (/\[.+?\]|according to|source:|study|research|report|survey|gartner|forrester|mckinsey/i.test(content)) {
      score += 0.3;
    }

    // Examples
    if (/example:|for instance|such as|case study|e\.g\.|i\.e\./i.test(content)) {
      score += 0.2;
    }

    // Comparisons
    if (/compared to|versus|vs\.|relative to|benchmark|industry average/i.test(content)) {
      score += 0.2;
    }

    evidenceScores.push(Math.min(1, score));
  }

  return evidenceScores.reduce((a, b) => a + b, 0) / evidenceScores.length;
}

/**
 * Score audience alignment - is content appropriate for target audience?
 *
 * @param {Object} data - Slides data
 * @returns {number} Score 0-1
 */
export function scoreAudienceAlignment(data) {
  if (!data.slides?.length) return 0;

  const allContent = data.slides.map(s => getSlideContent(s)).join(' ');
  let score = 0.5;  // Base score

  // Check for audience indicators in metadata
  const targetAudience = (data.audience || data.targetAudience || '').toLowerCase();

  // Check content complexity markers
  const technicalTerms = /\b(api|sdk|kubernetes|microservices|database|algorithm|latency|throughput|scalability|architecture)\b/gi;
  const technicalCount = (allContent.match(technicalTerms) || []).length;

  const executiveTerms = /\b(roi|revenue|market share|competitive advantage|strategic|stakeholder|bottom line|growth|profit)\b/gi;
  const executiveCount = (allContent.match(executiveTerms) || []).length;

  const generalTerms = /\b(simple|easy|straightforward|basically|overview|summary)\b/gi;
  const generalCount = (allContent.match(generalTerms) || []).length;

  // Score based on consistency
  const wordCount = allContent.split(/\s+/).length;
  const technicalDensity = technicalCount / wordCount;
  const executiveDensity = executiveCount / wordCount;

  // If audience is specified, check alignment
  if (targetAudience.includes('technical') || targetAudience.includes('engineer')) {
    if (technicalDensity > 0.01) score += 0.3;
    if (executiveCount < technicalCount) score += 0.2;
  } else if (targetAudience.includes('executive') || targetAudience.includes('board')) {
    if (executiveDensity > 0.005) score += 0.3;
    if (technicalDensity < 0.02) score += 0.2;  // Not too technical
  } else {
    // No specific audience - check for balanced content
    if (generalCount > 0) score += 0.2;
    if (technicalDensity < 0.03) score += 0.15;
    if (executiveCount > 0) score += 0.15;
  }

  return Math.min(1, score);
}

/**
 * Score visual suggestions - does content suggest visualizations?
 *
 * @param {Object} data - Slides data
 * @returns {number} Score 0-1
 */
export function scoreVisualSuggestions(data) {
  if (!data.slides?.length) return 0;

  let visualScore = 0;
  let totalSlides = data.slides.length;

  for (const slide of data.slides) {
    const content = getSlideContent(slide);

    // Check for explicit visual references
    const visualPatterns = [
      /chart|graph|diagram|figure|table|image|visual|illustration/i,
      /as shown|see below|depicted|displayed/i,
      /timeline|roadmap|flowchart|matrix|quadrant/i
    ];

    if (visualPatterns.some(p => p.test(content))) {
      visualScore += 1;
      continue;
    }

    // Check for data that suggests visualization
    const numbersMatch = content.match(/\d+%|\$[\d,]+|\d+\s*(million|billion)/gi);
    if (numbersMatch && numbersMatch.length >= 3) {
      visualScore += 0.7;  // Multiple data points suggest chart
      continue;
    }

    // Check for lists (suggest bullet points or icons)
    const bulletMatch = content.match(/^[-•*]\s/gm) || content.match(/\d+\.\s/gm);
    if (bulletMatch && bulletMatch.length >= 3) {
      visualScore += 0.5;
    }
  }

  return visualScore / totalSlides;
}

/**
 * Score key takeaways - are clear takeaways present?
 *
 * @param {Object} data - Slides data
 * @returns {number} Score 0-1
 */
export function scoreKeyTakeaways(data) {
  if (!data.slides?.length) return 0;

  let score = 0;

  // Check for explicit takeaway sections
  const takeawayPatterns = [
    /key takeaway|takeaway|key point|key finding|bottom line/i,
    /in summary|to summarize|main point/i,
    /action item|next step|recommendation/i,
    /what this means|implication/i
  ];

  const allContent = data.slides.map(s => getSlideContent(s)).join(' ');

  for (const pattern of takeawayPatterns) {
    if (pattern.test(allContent)) {
      score += 0.2;
    }
  }

  // Check for a dedicated summary/takeaway slide
  for (const slide of data.slides) {
    const title = (slide.title || slide.heading || '').toLowerCase();
    if (/summary|takeaway|conclusion|key point|recommendation|next step/i.test(title)) {
      score += 0.3;
      break;
    }
  }

  return Math.min(1, score);
}

/**
 * Score executive summary presence
 *
 * @param {Object} data - Slides data
 * @returns {number} Score 0-1
 */
export function scoreExecSummaryPresence(data) {
  if (!data.slides?.length) return 0;

  let score = 0;

  // Check first few slides for executive summary
  const earlySlides = data.slides.slice(0, Math.min(3, data.slides.length));

  for (const slide of earlySlides) {
    const title = (slide.title || slide.heading || '').toLowerCase();
    const content = getSlideContent(slide).toLowerCase();

    // Executive summary indicators
    if (/executive summary|exec summary|overview|key highlights|at a glance/i.test(title)) {
      score += 0.5;
    }

    // Agenda/outline
    if (/agenda|outline|today|we will|we'll cover/i.test(title) || /agenda|outline/i.test(content)) {
      score += 0.3;
    }

    // Key points upfront
    if (/key point|highlight|main finding|summary/i.test(content)) {
      score += 0.2;
    }
  }

  return Math.min(1, score);
}

/**
 * Score bullet point quality - parallel, concise, substantive?
 *
 * @param {Object} data - Slides data
 * @returns {number} Score 0-1
 */
export function scoreBulletPointQuality(data) {
  if (!data.slides?.length) return 0;

  const bulletScores = [];

  for (const slide of data.slides) {
    const content = getSlideContent(slide);

    // Extract bullet points
    const bullets = extractBullets(content);

    if (bullets.length === 0) {
      bulletScores.push(0.5);  // No bullets - neutral
      continue;
    }

    let slideScore = 0;

    // Check for parallel structure (similar starting patterns)
    const startPatterns = bullets.map(b => {
      if (/^(implement|develop|create|build|establish)/i.test(b)) return 'verb';
      if (/^(the|a|an)\s/i.test(b)) return 'article';
      if (/^\d/.test(b)) return 'number';
      if (/^[A-Z]/.test(b)) return 'capital';
      return 'other';
    });

    const dominantPattern = getMostFrequent(startPatterns);
    const parallelRatio = startPatterns.filter(p => p === dominantPattern).length / startPatterns.length;
    slideScore += parallelRatio * 0.3;

    // Check for conciseness (5-20 words per bullet)
    const conciseBullets = bullets.filter(b => {
      const wordCount = b.split(/\s+/).length;
      return wordCount >= 3 && wordCount <= 25;
    }).length;
    slideScore += (conciseBullets / bullets.length) * 0.35;

    // Check for substance (not just single words)
    const substantiveBullets = bullets.filter(b => b.split(/\s+/).length >= 3).length;
    slideScore += (substantiveBullets / bullets.length) * 0.35;

    bulletScores.push(slideScore);
  }

  return bulletScores.reduce((a, b) => a + b, 0) / bulletScores.length;
}

/**
 * Score transition logic - do slides flow logically?
 *
 * @param {Object} data - Slides data
 * @returns {number} Score 0-1
 */
export function scoreTransitionLogic(data) {
  if (!data.slides || data.slides.length < 2) return 0.5;

  let transitionScore = 0;
  const slideCount = data.slides.length;

  for (let i = 1; i < slideCount; i++) {
    const prevSlide = data.slides[i - 1];
    const currSlide = data.slides[i];

    const prevContent = getSlideContent(prevSlide).toLowerCase();
    const prevTitle = (prevSlide.title || prevSlide.heading || '').toLowerCase();
    const currTitle = (currSlide.title || currSlide.heading || '').toLowerCase();
    const currContent = getSlideContent(currSlide).toLowerCase();

    let pairScore = 0;

    // Check for explicit transitions
    const transitionWords = /therefore|consequently|as a result|building on|following|next|moving to|now let's|turning to/i;
    if (transitionWords.test(currContent)) {
      pairScore += 0.3;
    }

    // Check for topic continuity (shared keywords)
    const prevWords = new Set(prevContent.split(/\s+/).filter(w => w.length > 4));
    const currWords = new Set(currContent.split(/\s+/).filter(w => w.length > 4));
    const shared = [...prevWords].filter(w => currWords.has(w)).length;
    const minSize = Math.min(prevWords.size, currWords.size);
    const continuity = minSize > 0 ? shared / minSize : 0;
    pairScore += Math.min(0.4, continuity);

    // Check for logical title progression
    if (prevTitle.includes('problem') && currTitle.includes('solution')) pairScore += 0.3;
    if (prevTitle.includes('current') && currTitle.includes('future')) pairScore += 0.3;
    if (prevTitle.includes('analysis') && currTitle.includes('recommendation')) pairScore += 0.3;
    if (/phase\s*1|step\s*1/i.test(prevTitle) && /phase\s*2|step\s*2/i.test(currTitle)) pairScore += 0.3;

    transitionScore += Math.min(1, pairScore);
  }

  return transitionScore / (slideCount - 1);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Classify a slide by its type
 *
 * @param {Object} slide - Slide object
 * @returns {string} Slide type
 */
function classifySlide(slide) {
  const title = (slide.title || slide.heading || '').toLowerCase();
  const content = getSlideContent(slide).toLowerCase();

  if (/overview|introduction|agenda|executive summary|about/i.test(title)) return 'intro';
  if (/summary|conclusion|next steps|action|takeaway|recommendation|thank you|q&a/i.test(title)) return 'conclusion';
  if (/appendix|backup|reference|additional|supporting/i.test(title)) return 'appendix';
  return 'body';
}

/**
 * Get all text content from a slide
 *
 * @param {Object} slide - Slide object
 * @returns {string} Combined content
 */
function getSlideContent(slide) {
  const parts = [
    slide.content || '',
    slide.body || '',
    slide.text || '',
    slide.notes || ''
  ];

  // Handle bullet arrays
  if (Array.isArray(slide.bullets)) {
    parts.push(slide.bullets.join(' '));
  }
  if (Array.isArray(slide.points)) {
    parts.push(slide.points.join(' '));
  }

  return parts.filter(p => p).join(' ');
}

/**
 * Extract bullet points from content
 *
 * @param {string} content - Slide content
 * @returns {Array<string>} Bullet points
 */
function extractBullets(content) {
  // Match common bullet patterns
  const lines = content.split(/\n/);
  const bullets = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Check for bullet markers
    if (/^[-•*]\s/.test(trimmed)) {
      bullets.push(trimmed.replace(/^[-•*]\s/, ''));
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      bullets.push(trimmed.replace(/^\d+[.)]\s/, ''));
    }
  }

  // If no explicit bullets found, try to split by common patterns
  if (bullets.length === 0 && content.includes(';')) {
    return content.split(';').map(s => s.trim()).filter(s => s.length > 0);
  }

  return bullets;
}

/**
 * Get most frequent item in array
 *
 * @param {Array} arr - Array of items
 * @returns {*} Most frequent item
 */
function getMostFrequent(arr) {
  if (arr.length === 0) return null;

  const counts = {};
  let maxCount = 0;
  let mostFrequent = arr[0];

  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      mostFrequent = item;
    }
  }

  return mostFrequent;
}

// ============================================================================
// Validation
// ============================================================================

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

  // Test 1: scoreSlidesQuality returns valid structure
  const emptyResult = scoreSlidesQuality({});
  results.tests.push({
    name: 'scoreSlidesQuality handles empty data',
    passed: emptyResult.overall === 0 && emptyResult.feedback !== undefined,
    details: `overall=${emptyResult.overall}`
  });

  // Test 2: All 10 dimensions are scored
  const mockData = createMockSlides();
  const result = scoreSlidesQuality(mockData);
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
  const badMock = { slides: [] };
  const badResult = scoreSlidesQuality(badMock);
  results.tests.push({
    name: 'Good mock scores higher than bad',
    passed: result.overall > badResult.overall,
    details: `good=${result.overall.toFixed(3)}, bad=${badResult.overall.toFixed(3)}`
  });

  // Test 6: scoreNarrativeFlow works
  results.tests.push({
    name: 'scoreNarrativeFlow works',
    passed: typeof scoreNarrativeFlow(mockData) === 'number',
    details: `score=${scoreNarrativeFlow(mockData).toFixed(3)}`
  });

  // Test 7: scoreContentDensity works
  results.tests.push({
    name: 'scoreContentDensity works',
    passed: typeof scoreContentDensity(mockData) === 'number',
    details: `score=${scoreContentDensity(mockData).toFixed(3)}`
  });

  // Test 8: scoreTitleEffectiveness works
  results.tests.push({
    name: 'scoreTitleEffectiveness works',
    passed: typeof scoreTitleEffectiveness(mockData) === 'number',
    details: `score=${scoreTitleEffectiveness(mockData).toFixed(3)}`
  });

  // Test 9: Handles null gracefully
  const nullResult = scoreSlidesQuality(null);
  results.tests.push({
    name: 'Handles null gracefully',
    passed: nullResult.overall === 0,
    details: `overall=${nullResult.overall}`
  });

  // Test 10: Feedback generated for low scores
  const lowScoreMock = { slides: [{ title: 'Slide', content: 'x' }] };
  const lowResult = scoreSlidesQuality(lowScoreMock);
  results.tests.push({
    name: 'Feedback generated',
    passed: Array.isArray(lowResult.feedback),
    details: `feedbackCount=${lowResult.feedback?.length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

/**
 * Create mock slides for testing
 */
function createMockSlides() {
  return {
    audience: 'executive',
    slides: [
      {
        title: 'Executive Summary: Q4 Strategic Priorities',
        content: `Key highlights from our Q4 performance analysis:
- Revenue growth of 23% compared to Q3, exceeding industry average by 5%
- Customer satisfaction score reached 4.5/5, according to Gartner survey
- Three strategic initiatives launched successfully
This overview sets the stage for the detailed findings that follow.`
      },
      {
        title: 'Agenda',
        content: `Today we will cover:
1. Market analysis and competitive positioning
2. Financial performance deep dive
3. Strategic recommendations for 2025
4. Next steps and action items`
      },
      {
        title: 'Market Analysis: Key Opportunities',
        content: `Our analysis reveals three major market opportunities:
- Digital transformation spending is projected to reach $2.8 trillion by 2025
- Cloud migration services show 34% year-over-year growth
- AI/ML integration demand increased 45% in our target segments
Source: Forrester Research, McKinsey Digital Report 2024`
      },
      {
        title: 'Financial Results Drive Strategic Confidence',
        content: `Q4 financial highlights demonstrate strong execution:
• Revenue: $45.2M (+23% QoQ)
• Gross margin: 68% (vs. 62% industry benchmark)
• Customer acquisition cost reduced by 18%
• Annual recurring revenue grew to $180M
These results position us well for aggressive 2025 targets.`
      },
      {
        title: 'Strategic Recommendations',
        content: `Based on our analysis, we recommend three priority initiatives:
1. Invest $5M in AI-powered product features (ROI: 3.2x projected)
2. Expand enterprise sales team by 40% to capture market opportunity
3. Establish strategic partnership with leading cloud provider
Timeline: Implementation to begin Q1 2025 with full rollout by Q3.`
      },
      {
        title: 'Key Takeaways and Next Steps',
        content: `In summary:
• Market conditions favor aggressive growth strategy
• Financial performance validates current approach
• Three strategic initiatives will drive competitive advantage

Action items for leadership team:
- Review and approve budget allocation by Jan 15
- Identify partnership candidates for due diligence
- Schedule quarterly strategy review sessions`
      }
    ]
  };
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase3();
  console.log('Slides Scoring Phase 3 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
