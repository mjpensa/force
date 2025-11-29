# Implementation Plan: Content-Type Scoring Parity

## Problem Statement

The Document content type has comprehensive quality scoring with 11 distinct dimensions, while other content types (Roadmap, Slides, ResearchAnalysis) have minimal or no content-specific quality scoring. This scoring imbalance means:
1. Training signal quality varies dramatically by content type
2. Document improvements are over-prioritized relative to other types
3. Quality regressions in other types may go undetected

## Current State

```javascript
// Document scoring: ~11 dimensions, ~200 lines of code
function scoreDocumentQuality(data) {
  // Executive Summary Hook, Authority Markers, Forecast Citations,
  // Tension Markers, Temporal Bridges, Infrastructure Metaphors,
  // Quantification Density, etc.
}

// Roadmap scoring: ~30 lines, basic structure only
function scoreRoadmapQuality(data) {
  // Checks: has swimlanes, has tasks, has dates
  // Missing: task descriptions, dependencies, time distribution, etc.
}

// Slides scoring: ~30 lines, basic structure only
// ResearchAnalysis scoring: ~30 lines, basic structure only
```

## Goal

Achieve scoring parity by implementing content-specific quality dimensions for all content types, targeting 8-12 dimensions per type with comparable depth to Document scoring.

---

## Phase 1: Quality Dimension Audit

### Objective
Define quality dimensions for each content type based on domain best practices.

### Roadmap Quality Dimensions

```javascript
const ROADMAP_DIMENSIONS = {
  // Structure dimensions
  swimlaneCompleteness: {
    description: 'Each swimlane has tasks that span the roadmap timeline',
    weight: 1.0
  },
  taskDescriptionQuality: {
    description: 'Tasks have meaningful descriptions, not just titles',
    weight: 0.8
  },
  temporalDistribution: {
    description: 'Tasks are distributed across timeline, not clustered',
    weight: 0.9
  },

  // Content quality dimensions
  milestoneClarity: {
    description: 'Key milestones are clearly identified and dated',
    weight: 1.0
  },
  dependencyLogic: {
    description: 'Task sequences make logical sense (prerequisites first)',
    weight: 0.8
  },
  scopeAlignment: {
    description: 'Swimlane names reflect distinct, non-overlapping domains',
    weight: 0.7
  },

  // Strategic dimensions
  outcomeOrientation: {
    description: 'Tasks describe outcomes, not just activities',
    weight: 0.9
  },
  resourceConsideration: {
    description: 'Implicit consideration of resource constraints',
    weight: 0.6
  },

  // Professional dimensions
  namingConsistency: {
    description: 'Consistent naming conventions across tasks',
    weight: 0.5
  },
  granularityBalance: {
    description: 'Task sizes are balanced (not too granular or coarse)',
    weight: 0.7
  }
};

const SLIDES_DIMENSIONS = {
  // Structure dimensions
  narrativeFlow: {
    description: 'Slides follow logical progression (intro → body → conclusion)',
    weight: 1.0
  },
  slideContentDensity: {
    description: 'Each slide has substantive content (not too sparse/dense)',
    weight: 0.9
  },
  titleEffectiveness: {
    description: 'Slide titles are action-oriented or insight-driven',
    weight: 0.8
  },

  // Content quality dimensions
  evidenceIntegration: {
    description: 'Claims supported by data, citations, or examples',
    weight: 1.0
  },
  audienceAlignment: {
    description: 'Language and depth appropriate for intended audience',
    weight: 0.8
  },
  visualSuggestions: {
    description: 'Content suggests appropriate visual elements',
    weight: 0.6
  },

  // Strategic dimensions
  keyTakeaways: {
    description: 'Clear takeaways or action items emerge',
    weight: 0.9
  },
  execSummaryPresence: {
    description: 'Executive summary or key points slide included',
    weight: 0.7
  },

  // Professional dimensions
  bulletPointQuality: {
    description: 'Bullets are parallel, concise, and substantive',
    weight: 0.7
  },
  transitionLogic: {
    description: 'Implicit transitions between slides make sense',
    weight: 0.6
  }
};

const RESEARCH_ANALYSIS_DIMENSIONS = {
  // Structure dimensions
  themeCoherence: {
    description: 'Themes are distinct and mutually exclusive',
    weight: 0.9
  },
  evidenceDepth: {
    description: 'Each theme has multiple supporting evidence points',
    weight: 1.0
  },
  insightNovelty: {
    description: 'Insights go beyond obvious observations',
    weight: 0.9
  },

  // Content quality dimensions
  sourceVariety: {
    description: 'Evidence draws from multiple source types',
    weight: 0.8
  },
  quantificationLevel: {
    description: 'Analysis includes specific numbers and metrics',
    weight: 0.8
  },
  counterargumentAwareness: {
    description: 'Acknowledges limitations or alternative views',
    weight: 0.7
  },

  // Strategic dimensions
  actionabilityScore: {
    description: 'Recommendations are specific and actionable',
    weight: 1.0
  },
  prioritization: {
    description: 'Themes/recommendations are prioritized or ranked',
    weight: 0.7
  },

  // Professional dimensions
  synthesisQuality: {
    description: 'Summary synthesizes themes into coherent narrative',
    weight: 0.8
  },
  temporalAwareness: {
    description: 'Analysis considers timing and trends',
    weight: 0.6
  }
};
```

---

## Phase 2: Roadmap Quality Scoring Implementation

### Objective
Implement comprehensive quality scoring for Roadmap content.

### Implementation

```javascript
function scoreRoadmapQuality(data) {
  const scores = {};
  const feedback = [];

  // 1. Swimlane Completeness
  scores.swimlaneCompleteness = scoreSwimlaneCompleteness(data);

  // 2. Task Description Quality
  scores.taskDescriptionQuality = scoreTaskDescriptions(data);

  // 3. Temporal Distribution
  scores.temporalDistribution = scoreTemporalDistribution(data);

  // 4. Milestone Clarity
  scores.milestoneClarity = scoreMilestoneClarity(data);

  // 5. Dependency Logic
  scores.dependencyLogic = scoreDependencyLogic(data);

  // 6. Scope Alignment
  scores.scopeAlignment = scoreScopeAlignment(data);

  // 7. Outcome Orientation
  scores.outcomeOrientation = scoreOutcomeOrientation(data);

  // 8. Resource Consideration
  scores.resourceConsideration = scoreResourceConsideration(data);

  // 9. Naming Consistency
  scores.namingConsistency = scoreNamingConsistency(data);

  // 10. Granularity Balance
  scores.granularityBalance = scoreGranularityBalance(data);

  // Calculate weighted average
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [dim, score] of Object.entries(scores)) {
    const weight = ROADMAP_DIMENSIONS[dim]?.weight || 1.0;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  return {
    overall: weightedSum / totalWeight,
    dimensions: scores,
    feedback
  };
}

// Individual dimension scorers

function scoreSwimlaneCompleteness(data) {
  if (!data.swimlanes?.length) return 0;

  const timelineStart = new Date(data.startDate);
  const timelineEnd = new Date(data.endDate);
  const totalMonths = (timelineEnd - timelineStart) / (1000 * 60 * 60 * 24 * 30);

  let coverageScores = [];

  for (const swimlane of data.swimlanes) {
    if (!swimlane.tasks?.length) {
      coverageScores.push(0);
      continue;
    }

    // Check what percentage of timeline is covered
    const taskDates = swimlane.tasks.map(t => ({
      start: new Date(t.startDate),
      end: new Date(t.endDate)
    }));

    // Calculate covered months
    const coveredMonths = new Set();
    for (const task of taskDates) {
      let current = new Date(task.start);
      while (current <= task.end) {
        coveredMonths.add(`${current.getFullYear()}-${current.getMonth()}`);
        current.setMonth(current.getMonth() + 1);
      }
    }

    coverageScores.push(Math.min(1, coveredMonths.size / (totalMonths * 0.6)));
  }

  return coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length;
}

function scoreTaskDescriptions(data) {
  if (!data.swimlanes?.length) return 0;

  let totalTasks = 0;
  let qualityTasks = 0;

  for (const swimlane of data.swimlanes) {
    for (const task of swimlane.tasks || []) {
      totalTasks++;

      const desc = task.description || '';

      // Quality criteria:
      // - Has description at all
      // - Description is meaningful (> 10 chars)
      // - Description differs from title
      // - Description contains action words

      let taskScore = 0;
      if (desc.length > 0) taskScore += 0.25;
      if (desc.length > 10) taskScore += 0.25;
      if (desc.toLowerCase() !== (task.name || '').toLowerCase()) taskScore += 0.25;
      if (/\b(implement|develop|create|build|design|deploy|migrate|integrate|optimize)\b/i.test(desc)) {
        taskScore += 0.25;
      }

      qualityTasks += taskScore;
    }
  }

  return totalTasks > 0 ? qualityTasks / totalTasks : 0;
}

function scoreTemporalDistribution(data) {
  if (!data.swimlanes?.length) return 0;

  const allTasks = data.swimlanes.flatMap(s => s.tasks || []);
  if (allTasks.length < 2) return 0.5;  // Can't assess distribution with few tasks

  // Convert to timeline positions
  const timelineStart = new Date(data.startDate).getTime();
  const timelineEnd = new Date(data.endDate).getTime();
  const totalDuration = timelineEnd - timelineStart;

  const positions = allTasks.map(t => {
    const taskStart = new Date(t.startDate).getTime();
    return (taskStart - timelineStart) / totalDuration;
  }).sort((a, b) => a - b);

  // Calculate distribution score (penalize clustering)
  const expectedGap = 1 / (positions.length + 1);
  let gapVariance = 0;

  for (let i = 0; i < positions.length - 1; i++) {
    const gap = positions[i + 1] - positions[i];
    gapVariance += Math.pow(gap - expectedGap, 2);
  }

  const normalizedVariance = Math.sqrt(gapVariance / positions.length);
  return Math.max(0, 1 - normalizedVariance * 2);
}

function scoreMilestoneClarity(data) {
  if (!data.swimlanes?.length) return 0;

  const allTasks = data.swimlanes.flatMap(s => s.tasks || []);

  // Look for milestone indicators
  const milestonePatterns = [
    /milestone/i,
    /launch/i,
    /release/i,
    /go.?live/i,
    /complete/i,
    /deliver/i,
    /phase\s*\d/i
  ];

  let milestoneCount = 0;
  for (const task of allTasks) {
    const text = `${task.name} ${task.description || ''}`;
    if (milestonePatterns.some(p => p.test(text))) {
      milestoneCount++;
    }
  }

  // Expect at least 1 milestone per swimlane, max credit at 3+ milestones
  const expectedMilestones = data.swimlanes.length;
  return Math.min(1, milestoneCount / expectedMilestones);
}

function scoreOutcomeOrientation(data) {
  if (!data.swimlanes?.length) return 0;

  const allTasks = data.swimlanes.flatMap(s => s.tasks || []);

  // Outcome-oriented language vs activity-oriented
  const outcomePatterns = [
    /achieve/i, /deliver/i, /complete/i, /launch/i,
    /enable/i, /reduce/i, /increase/i, /improve/i,
    /\d+%/,  // Quantified outcomes
    /roi|revenue|cost|efficiency/i
  ];

  const activityPatterns = [
    /work on/i, /continue/i, /ongoing/i,
    /research/i, /explore/i, /investigate/i
  ];

  let outcomeScore = 0;
  for (const task of allTasks) {
    const text = `${task.name} ${task.description || ''}`;

    const hasOutcome = outcomePatterns.some(p => p.test(text));
    const hasActivity = activityPatterns.some(p => p.test(text));

    if (hasOutcome && !hasActivity) outcomeScore += 1;
    else if (hasOutcome && hasActivity) outcomeScore += 0.5;
    else if (!hasOutcome && !hasActivity) outcomeScore += 0.3;
    // Pure activity = 0
  }

  return allTasks.length > 0 ? outcomeScore / allTasks.length : 0;
}

// Additional scorer functions: scopeAlignment, dependencyLogic,
// resourceConsideration, namingConsistency, granularityBalance
// (Similar pattern - examine task/swimlane properties)
```

---

## Phase 3: Slides Quality Scoring Implementation

### Objective
Implement comprehensive quality scoring for Slides content.

### Implementation

```javascript
function scoreSlidesQuality(data) {
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

  // 6. Key Takeaways
  scores.keyTakeaways = scoreKeyTakeaways(data);

  // 7. Exec Summary Presence
  scores.execSummaryPresence = scoreExecSummaryPresence(data);

  // 8. Bullet Point Quality
  scores.bulletPointQuality = scoreBulletPointQuality(data);

  // 9. Transition Logic
  scores.transitionLogic = scoreTransitionLogic(data);

  // 10. Visual Suggestions
  scores.visualSuggestions = scoreVisualSuggestions(data);

  // Calculate weighted average
  return calculateWeightedScore(scores, SLIDES_DIMENSIONS);
}

function scoreNarrativeFlow(data) {
  if (!data.slides?.length) return 0;

  const slideTypes = data.slides.map(s => {
    const title = (s.title || '').toLowerCase();
    const content = (s.content || '').toLowerCase();

    // Classify slide type
    if (/overview|introduction|agenda|executive/i.test(title)) return 'intro';
    if (/summary|conclusion|next steps|action|takeaway/i.test(title)) return 'conclusion';
    if (/appendix|backup|reference/i.test(title)) return 'appendix';
    return 'body';
  });

  // Check for proper flow: intro -> body -> conclusion
  let score = 0;

  // Starts with intro
  if (slideTypes[0] === 'intro') score += 0.3;

  // Ends with conclusion (before any appendix)
  const mainSlides = slideTypes.filter(t => t !== 'appendix');
  if (mainSlides[mainSlides.length - 1] === 'conclusion') score += 0.3;

  // Has body content
  const bodyCount = slideTypes.filter(t => t === 'body').length;
  if (bodyCount >= 2) score += 0.2;
  if (bodyCount >= 4) score += 0.2;

  return score;
}

function scoreContentDensity(data) {
  if (!data.slides?.length) return 0;

  let densityScores = [];

  for (const slide of data.slides) {
    const content = slide.content || '';
    const wordCount = content.split(/\s+/).length;

    // Ideal density: 50-150 words per slide
    if (wordCount < 20) {
      densityScores.push(0.3);  // Too sparse
    } else if (wordCount < 50) {
      densityScores.push(0.7);
    } else if (wordCount <= 150) {
      densityScores.push(1.0);  // Ideal
    } else if (wordCount <= 200) {
      densityScores.push(0.7);
    } else {
      densityScores.push(0.4);  // Too dense
    }
  }

  return densityScores.reduce((a, b) => a + b, 0) / densityScores.length;
}

function scoreTitleEffectiveness(data) {
  if (!data.slides?.length) return 0;

  let titleScores = [];

  for (const slide of data.slides) {
    const title = slide.title || '';
    let score = 0;

    // Has title
    if (title.length > 0) score += 0.2;

    // Reasonable length (3-10 words)
    const wordCount = title.split(/\s+/).length;
    if (wordCount >= 3 && wordCount <= 10) score += 0.2;

    // Contains action word or insight
    if (/\b(drive|enable|achieve|reveal|show|demonstrate|key|critical|how|why)\b/i.test(title)) {
      score += 0.3;
    }

    // Not generic
    if (!/^(slide|page|section)\s*\d*$/i.test(title)) {
      score += 0.3;
    }

    titleScores.push(score);
  }

  return titleScores.reduce((a, b) => a + b, 0) / titleScores.length;
}

function scoreEvidenceIntegration(data) {
  if (!data.slides?.length) return 0;

  let evidenceScores = [];

  for (const slide of data.slides) {
    const content = slide.content || '';
    let score = 0;

    // Check for different evidence types
    if (/\$[\d,]+|\d+%|\d+\s*(million|billion|thousand)/i.test(content)) {
      score += 0.3;  // Quantitative data
    }
    if (/\[.+?\]|according to|source:|study|research/i.test(content)) {
      score += 0.3;  // Citations/sources
    }
    if (/example:|for instance|such as|case study/i.test(content)) {
      score += 0.2;  // Examples
    }
    if (/compared to|versus|vs\.|relative to/i.test(content)) {
      score += 0.2;  // Comparisons
    }

    evidenceScores.push(Math.min(1, score));
  }

  return evidenceScores.reduce((a, b) => a + b, 0) / evidenceScores.length;
}

// Additional scorer functions for remaining dimensions...
```

---

## Phase 4: ResearchAnalysis Quality Scoring Implementation

### Objective
Implement comprehensive quality scoring for ResearchAnalysis content.

### Implementation

```javascript
function scoreResearchAnalysisQuality(data) {
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

function scoreThemeCoherence(data) {
  if (!data.themes?.length) return 0;

  // Check theme distinctiveness
  const themeNames = data.themes.map(t => (t.name || '').toLowerCase());

  // Penalize overlapping themes
  let overlapScore = 1;
  for (let i = 0; i < themeNames.length; i++) {
    for (let j = i + 1; j < themeNames.length; j++) {
      const words1 = new Set(themeNames[i].split(/\s+/));
      const words2 = new Set(themeNames[j].split(/\s+/));
      const intersection = [...words1].filter(w => words2.has(w) && w.length > 3);

      if (intersection.length > 0) {
        overlapScore -= 0.1;  // Penalize word overlap
      }
    }
  }

  // Check theme descriptions are distinct
  const descriptions = data.themes.map(t => t.description || '');
  // Similar analysis for descriptions...

  return Math.max(0, overlapScore);
}

function scoreEvidenceDepth(data) {
  if (!data.themes?.length) return 0;

  let depthScores = [];

  for (const theme of data.themes) {
    const evidence = theme.evidence || [];

    // Scoring based on evidence count and quality
    let score = 0;

    // Count-based scoring
    if (evidence.length >= 1) score += 0.2;
    if (evidence.length >= 2) score += 0.2;
    if (evidence.length >= 3) score += 0.2;

    // Quality-based scoring
    for (const item of evidence) {
      // Has numbers
      if (/\d/.test(item)) score += 0.1;
      // Has source attribution
      if (/\[|\]|source|according/i.test(item)) score += 0.1;
    }

    depthScores.push(Math.min(1, score));
  }

  return depthScores.reduce((a, b) => a + b, 0) / depthScores.length;
}

function scoreInsightNovelty(data) {
  if (!data.insights?.length) return 0;

  // Check for non-obvious insights
  const genericPatterns = [
    /is important/i,
    /should consider/i,
    /growing trend/i,
    /increasingly/i,
    /key factor/i,
    /plays a role/i
  ];

  const novelPatterns = [
    /however|paradoxically|surprisingly|contrary/i,
    /\d+x|\d+%/,  // Quantified insights
    /outperform|underperform/i,
    /correlation|causation/i,
    /leading indicator|lagging/i
  ];

  let noveltyScores = [];

  for (const insight of data.insights) {
    let score = 0.5;  // Base score

    // Penalize generic language
    for (const pattern of genericPatterns) {
      if (pattern.test(insight)) score -= 0.1;
    }

    // Reward novel framing
    for (const pattern of novelPatterns) {
      if (pattern.test(insight)) score += 0.15;
    }

    noveltyScores.push(Math.max(0, Math.min(1, score)));
  }

  return noveltyScores.reduce((a, b) => a + b, 0) / noveltyScores.length;
}

function scoreActionability(data) {
  if (!data.recommendations?.length) return 0;

  let actionScores = [];

  for (const rec of data.recommendations) {
    let score = 0;

    // Starts with action verb
    if (/^(implement|develop|create|establish|invest|deploy|hire|partner|acquire|launch|build|design)/i.test(rec)) {
      score += 0.3;
    }

    // Contains specifics
    if (/\d/.test(rec)) score += 0.2;  // Numbers
    if (/by\s+(q[1-4]|20\d{2}|january|february)/i.test(rec)) score += 0.2;  // Timeline
    if (/\$[\d,]+|budget|invest/i.test(rec)) score += 0.15;  // Resources

    // Not too vague
    const wordCount = rec.split(/\s+/).length;
    if (wordCount >= 8 && wordCount <= 30) score += 0.15;

    actionScores.push(Math.min(1, score));
  }

  return actionScores.reduce((a, b) => a + b, 0) / actionScores.length;
}

// Additional scorer functions for remaining dimensions...
```

---

## Phase 5: Unified Scoring Interface

### Objective
Create a unified interface for all content type scoring.

### Implementation

```javascript
// contentQualityScoring.js

import { scoreDocumentQuality } from './documentScoring.js';
import { scoreRoadmapQuality } from './roadmapScoring.js';
import { scoreSlidesQuality } from './slidesScoring.js';
import { scoreResearchAnalysisQuality } from './researchAnalysisScoring.js';

const SCORING_FUNCTIONS = {
  Document: scoreDocumentQuality,
  Roadmap: scoreRoadmapQuality,
  Slides: scoreSlidesQuality,
  ResearchAnalysis: scoreResearchAnalysisQuality
};

export function scoreContentQuality(data, contentType) {
  const scoringFn = SCORING_FUNCTIONS[contentType];

  if (!scoringFn) {
    console.warn(`No scoring function for content type: ${contentType}`);
    return { overall: 0.5, dimensions: {}, feedback: [] };
  }

  try {
    return scoringFn(data);
  } catch (error) {
    console.error(`Scoring error for ${contentType}:`, error);
    return { overall: 0, dimensions: {}, feedback: [], error: error.message };
  }
}

export function getContentTypeDimensions(contentType) {
  const dimensions = {
    Document: DOCUMENT_DIMENSIONS,
    Roadmap: ROADMAP_DIMENSIONS,
    Slides: SLIDES_DIMENSIONS,
    ResearchAnalysis: RESEARCH_ANALYSIS_DIMENSIONS
  };

  return dimensions[contentType] || {};
}

export function calculateWeightedScore(scores, dimensions) {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [dim, score] of Object.entries(scores)) {
    const weight = dimensions[dim]?.weight || 1.0;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  return {
    overall: totalWeight > 0 ? weightedSum / totalWeight : 0,
    dimensions: scores
  };
}
```

---

## Phase 6: Scoring Validation & Testing

### Objective
Ensure new scoring functions work correctly with test data.

### Implementation

```javascript
// scoringTests.js

import { scoreContentQuality, getContentTypeDimensions } from './contentQualityScoring.js';
import { GOOD_MOCKS, BAD_MOCKS } from './preflightChecks.js';

export function validateScoringParity() {
  const results = {};

  for (const contentType of ['Document', 'Roadmap', 'Slides', 'ResearchAnalysis']) {
    const dimensions = getContentTypeDimensions(contentType);
    const dimensionCount = Object.keys(dimensions).length;

    // Test with good mock
    const goodResult = scoreContentQuality(GOOD_MOCKS[contentType]?.data, contentType);

    // Test with bad mock
    const badResult = scoreContentQuality(BAD_MOCKS[contentType]?.data, contentType);

    results[contentType] = {
      dimensionCount,
      goodMockScore: goodResult.overall?.toFixed(3),
      badMockScore: badResult.overall?.toFixed(3),
      dimensionsScored: Object.keys(goodResult.dimensions || {}).length,
      scoreDifferential: (goodResult.overall - badResult.overall).toFixed(3),
      status: dimensionCount >= 8 ? 'PARITY' : 'NEEDS_WORK'
    };

    // Validate good scores higher than bad
    if (goodResult.overall <= badResult.overall) {
      results[contentType].warning = 'Good mock scored equal or lower than bad mock';
    }
  }

  console.log('\nScoring Parity Validation:');
  console.table(results);

  return results;
}

// Run validation
validateScoringParity();
```

---

## Success Criteria

1. **Dimension Count**: Each content type has 8-12 quality dimensions
2. **Discrimination Power**: Good mocks score > 0.7, bad mocks score < 0.4
3. **Score Differential**: Good mocks score at least 0.3 higher than bad mocks
4. **No Crashes**: All content types score without errors
5. **Training Integration**: New scoring functions work with existing training loop

---

## Files to Create/Modify

- `/server/utils/roadmapScoring.js` - New Roadmap scoring
- `/server/utils/slidesScoring.js` - New Slides scoring
- `/server/utils/researchAnalysisScoring.js` - New ResearchAnalysis scoring
- `/server/utils/contentQualityScoring.js` - Unified scoring interface
- `/server/utils/scoringTests.js` - Validation tests
- `/server/routes/training.js` - Integration

---

## Estimated Complexity

- Phase 1: Low (dimension definitions)
- Phase 2: High (Roadmap scorer implementation)
- Phase 3: High (Slides scorer implementation)
- Phase 4: High (ResearchAnalysis scorer implementation)
- Phase 5: Low (unified interface)
- Phase 6: Medium (testing/validation)
