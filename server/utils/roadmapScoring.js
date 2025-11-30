/**
 * Roadmap Quality Scoring
 *
 * Comprehensive quality scoring for Roadmap/Gantt chart content.
 * Aligned with actual Gantt chart schema structure.
 *
 * Schema structure:
 * - data.data[] array with isSwimlane flags
 * - Swimlanes: { title, isSwimlane: true, entity }
 * - Tasks: { title, isSwimlane: false, entity, bar: { startCol, endCol, color }, taskType }
 * - timeColumns[] for temporal reference
 * - legend[] for color meanings
 * - researchAnalysis for research quality metrics
 *
 * Implementation of Plan 04: Scoring Depth Parity - Phase 2 (Updated)
 */

import { ROADMAP_DIMENSIONS, calculateWeightedScore } from './qualityDimensions.js';

// ============================================================================
// Phase 2: Roadmap Quality Scoring Implementation (Schema-Aligned)
// ============================================================================

/**
 * Score overall Roadmap quality across all dimensions
 *
 * @param {Object} data - Roadmap data structure (Gantt chart schema)
 * @returns {Object} { overall, dimensions, feedback }
 */
export function scoreRoadmapQuality(data) {
  // Handle invalid/empty data
  if (!data || typeof data !== 'object') {
    return {
      overall: 0,
      dimensions: {},
      feedback: [{ dimension: 'data', score: 0, description: 'No data provided' }]
    };
  }

  // Handle empty data array
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    return {
      overall: 0,
      dimensions: {},
      feedback: [{ dimension: 'structure', score: 0, description: 'No data array defined' }]
    };
  }

  // Parse structure
  const { swimlanes, tasks } = parseGanttData(data);

  // Handle no swimlanes
  if (swimlanes.length === 0) {
    return {
      overall: 0,
      dimensions: {},
      feedback: [{ dimension: 'structure', score: 0, description: 'No swimlanes defined (isSwimlane: true)' }]
    };
  }

  const scores = {};

  // 1. Swimlane Completeness - how well swimlanes cover the timeline
  scores.swimlaneCompleteness = scoreSwimlaneCompleteness(data, swimlanes, tasks);

  // 2. Task Title Quality (replaces taskDescriptionQuality - no description field)
  scores.taskTitleQuality = scoreTaskTitles(tasks);

  // 3. Temporal Distribution - how well tasks are spread across columns
  scores.temporalDistribution = scoreTemporalDistribution(data, tasks);

  // 4. Milestone Clarity - are milestones properly marked?
  scores.milestoneClarity = scoreMilestoneClarity(tasks);

  // 5. Task Type Distribution - variety of task/milestone/decision
  scores.taskTypeDistribution = scoreTaskTypeDistribution(tasks);

  // 6. Scope Alignment - are swimlanes distinct?
  scores.scopeAlignment = scoreScopeAlignment(swimlanes);

  // 7. Outcome Orientation - do task titles describe outcomes?
  scores.outcomeOrientation = scoreOutcomeOrientation(tasks);

  // 8. Legend Coherence - do legend colors match used colors?
  scores.legendCoherence = scoreLegendCoherence(data, tasks);

  // 9. Naming Consistency - consistent naming across tasks
  scores.namingConsistency = scoreNamingConsistency(tasks);

  // 10. Granularity Balance - balanced task durations
  scores.granularityBalance = scoreGranularityBalance(tasks);

  // Bonus dimensions (not weighted but tracked)
  scores.swimlaneMinimum = scoreSwimlaneMinimum(swimlanes);
  scores.researchFitness = scoreResearchFitness(data);

  return calculateWeightedScore(scores, ROADMAP_DIMENSIONS);
}

// ============================================================================
// Schema Parsing Helpers
// ============================================================================

/**
 * Parse Gantt chart data into swimlanes and tasks
 *
 * @param {Object} data - Gantt chart data
 * @returns {Object} { swimlanes, tasks }
 */
function parseGanttData(data) {
  const items = data.data || [];

  const swimlanes = items.filter(item => item.isSwimlane === true);
  const tasks = items.filter(item => item.isSwimlane === false);

  return { swimlanes, tasks };
}

/**
 * Get tasks belonging to a specific swimlane (by entity match)
 *
 * @param {Array} tasks - All tasks
 * @param {Object} swimlane - Swimlane object
 * @returns {Array} Tasks belonging to this swimlane
 */
function getTasksForSwimlane(tasks, swimlane) {
  const swimlaneName = swimlane.entity || swimlane.title;
  return tasks.filter(task => task.entity === swimlaneName);
}

/**
 * Get the number of time columns
 *
 * @param {Object} data - Gantt chart data
 * @returns {number} Number of time columns
 */
function getColumnCount(data) {
  return data.timeColumns?.length || 0;
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Score swimlane completeness - how well swimlanes cover the timeline
 *
 * @param {Object} data - Gantt chart data
 * @param {Array} swimlanes - Parsed swimlanes
 * @param {Array} tasks - Parsed tasks
 * @returns {number} Score 0-1
 */
export function scoreSwimlaneCompleteness(data, swimlanes, tasks) {
  if (!swimlanes?.length) return 0;

  const columnCount = getColumnCount(data);
  if (columnCount === 0) {
    // No timeColumns - check if swimlanes have tasks
    const hasTasks = tasks.length > 0;
    return hasTasks ? 0.3 : 0;
  }

  const coverageScores = [];

  for (const swimlane of swimlanes) {
    const swimlaneTasks = getTasksForSwimlane(tasks, swimlane);

    if (swimlaneTasks.length === 0) {
      coverageScores.push(0);
      continue;
    }

    // Calculate covered columns for this swimlane
    const coveredColumns = new Set();

    for (const task of swimlaneTasks) {
      const bar = task.bar;
      if (bar && bar.startCol != null && bar.endCol != null) {
        for (let col = bar.startCol; col <= bar.endCol; col++) {
          coveredColumns.add(col);
        }
      }
    }

    // Score based on coverage (60% coverage = full score)
    const targetCoverage = Math.max(1, columnCount * 0.6);
    coverageScores.push(Math.min(1, coveredColumns.size / targetCoverage));
  }

  return coverageScores.length > 0
    ? coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length
    : 0;
}

/**
 * Score task title quality (schema has no description field)
 *
 * @param {Array} tasks - Parsed tasks
 * @returns {number} Score 0-1
 */
export function scoreTaskTitles(tasks) {
  if (tasks.length === 0) return 0;

  let totalScore = 0;

  for (const task of tasks) {
    const title = task.title || '';

    let taskScore = 0;

    // Has title at all
    if (title.length > 0) taskScore += 0.25;

    // Title is meaningful (> 10 chars)
    if (title.length > 10) taskScore += 0.25;

    // Title contains action/outcome words
    const actionWords = /\b(implement|develop|create|build|design|deploy|migrate|integrate|optimize|launch|deliver|establish|complete|enable|improve|release|rollout)\b/i;
    if (actionWords.test(title)) {
      taskScore += 0.25;
    }

    // Title is specific (contains numbers, versions, or proper nouns)
    const specificPatterns = /\d+|v\d|phase|stage|api|system|platform|service|module|feature/i;
    if (specificPatterns.test(title)) {
      taskScore += 0.25;
    }

    totalScore += taskScore;
  }

  return totalScore / tasks.length;
}

/**
 * Score temporal distribution - how well tasks are spread across timeline
 *
 * @param {Object} data - Gantt chart data
 * @param {Array} tasks - Parsed tasks
 * @returns {number} Score 0-1
 */
export function scoreTemporalDistribution(data, tasks) {
  if (tasks.length < 2) return 0.5;

  const columnCount = getColumnCount(data);
  if (columnCount === 0) return 0.5;

  // Get normalized start positions (0-1 scale)
  const positions = tasks
    .map(t => {
      if (!t.bar || t.bar.startCol == null) return null;
      return (t.bar.startCol - 1) / columnCount; // Normalize to 0-1
    })
    .filter(p => p !== null)
    .sort((a, b) => a - b);

  if (positions.length < 2) return 0.5;

  // Calculate distribution score (penalize clustering)
  const expectedGap = 1 / (positions.length + 1);
  let gapVariance = 0;

  // Check gaps between consecutive tasks
  for (let i = 0; i < positions.length - 1; i++) {
    const gap = positions[i + 1] - positions[i];
    gapVariance += Math.pow(gap - expectedGap, 2);
  }

  // Also check first and last gaps
  gapVariance += Math.pow(positions[0] - 0, 2);
  gapVariance += Math.pow(1 - positions[positions.length - 1], 2);

  const normalizedVariance = Math.sqrt(gapVariance / (positions.length + 1));

  // Convert variance to score (lower variance = higher score)
  return Math.max(0, Math.min(1, 1 - normalizedVariance * 2));
}

/**
 * Score milestone clarity - are milestones properly identified?
 *
 * @param {Array} tasks - Parsed tasks
 * @returns {number} Score 0-1
 */
export function scoreMilestoneClarity(tasks) {
  if (tasks.length === 0) return 0;

  // Count tasks explicitly marked as milestones
  const milestoneCount = tasks.filter(t => t.taskType === 'milestone').length;

  // Check for milestone-like keywords in titles
  const milestonePatterns = [
    /milestone/i,
    /launch/i,
    /release/i,
    /go.?live/i,
    /complete/i,
    /deliver/i,
    /deploy/i,
    /rollout/i,
    /cutover/i,
    /phase\s*\d/i,
    /v\d+\.\d+/i,
    /beta|alpha|ga\b/i,
    /mvp/i
  ];

  let keywordMilestones = 0;
  for (const task of tasks) {
    if (milestonePatterns.some(p => p.test(task.title || ''))) {
      keywordMilestones++;
    }
  }

  // Best case: explicit taskType matches keywords
  const alignedMilestones = tasks.filter(t =>
    t.taskType === 'milestone' &&
    milestonePatterns.some(p => p.test(t.title || ''))
  ).length;

  // Score:
  // - Having milestones at all (0.4)
  // - Reasonable count (0.3)
  // - Alignment between taskType and keywords (0.3)
  let score = 0;

  if (milestoneCount > 0) {
    score += 0.4;
  }

  // Expect at least 1-2 milestones per 10 tasks
  const expectedMilestones = Math.max(2, Math.ceil(tasks.length / 5));
  score += Math.min(0.3, (milestoneCount / expectedMilestones) * 0.3);

  // Alignment bonus
  if (milestoneCount > 0 && keywordMilestones > 0) {
    const alignmentRatio = alignedMilestones / Math.max(milestoneCount, keywordMilestones);
    score += alignmentRatio * 0.3;
  }

  return Math.min(1, score);
}

/**
 * Score task type distribution - variety of task/milestone/decision
 *
 * @param {Array} tasks - Parsed tasks
 * @returns {number} Score 0-1
 */
export function scoreTaskTypeDistribution(tasks) {
  if (tasks.length === 0) return 0;

  const typeCounts = {
    task: 0,
    milestone: 0,
    decision: 0
  };

  for (const task of tasks) {
    const type = task.taskType || 'task';
    if (typeCounts.hasOwnProperty(type)) {
      typeCounts[type]++;
    }
  }

  // Score based on variety and reasonable proportions
  let score = 0;

  // Having at least 2 different types
  const typesUsed = Object.values(typeCounts).filter(c => c > 0).length;
  score += (typesUsed / 3) * 0.4;

  // Majority should be "task" (60-90%)
  const taskRatio = typeCounts.task / tasks.length;
  if (taskRatio >= 0.5 && taskRatio <= 0.9) {
    score += 0.3;
  } else if (taskRatio > 0.3 && taskRatio < 0.5) {
    score += 0.2;
  }

  // Should have some milestones (5-25%)
  const milestoneRatio = typeCounts.milestone / tasks.length;
  if (milestoneRatio >= 0.05 && milestoneRatio <= 0.25) {
    score += 0.2;
  } else if (milestoneRatio > 0) {
    score += 0.1;
  }

  // Decisions are optional but nice to have
  if (typeCounts.decision > 0) {
    score += 0.1;
  }

  return Math.min(1, score);
}

/**
 * Score scope alignment - are swimlanes distinct and non-overlapping?
 *
 * @param {Array} swimlanes - Parsed swimlanes
 * @returns {number} Score 0-1
 */
export function scoreScopeAlignment(swimlanes) {
  if (!swimlanes?.length) return 0;
  if (swimlanes.length === 1) return 0.5; // Single swimlane is not ideal

  const swimlaneNames = swimlanes
    .map(s => (s.title || s.entity || '').toLowerCase())
    .filter(n => n.length > 0);

  if (swimlaneNames.length < 2) return 0.5;

  let score = 0.7; // Base score for having multiple swimlanes

  // Penalize overlapping names
  for (let i = 0; i < swimlaneNames.length; i++) {
    const words1 = new Set(swimlaneNames[i].split(/\s+/).filter(w => w.length > 3));

    for (let j = i + 1; j < swimlaneNames.length; j++) {
      const words2 = new Set(swimlaneNames[j].split(/\s+/).filter(w => w.length > 3));
      const intersection = [...words1].filter(w => words2.has(w));

      if (intersection.length > 0) {
        score -= 0.1 * intersection.length;
      }
    }
  }

  // Bonus for clear domain separation
  const domainPatterns = [
    /frontend|backend|infra|devops|data|security|product|design|marketing|sales|legal|finance|hr|operations/i,
    /q[1-4]|phase|stream|workstream|track/i,
    /it|technology|engineering|development/i
  ];

  const matchCount = swimlaneNames.filter(n =>
    domainPatterns.some(p => p.test(n))
  ).length;

  if (matchCount >= swimlaneNames.length * 0.5) {
    score += 0.2;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Score outcome orientation - do tasks describe outcomes vs activities?
 *
 * @param {Array} tasks - Parsed tasks
 * @returns {number} Score 0-1
 */
export function scoreOutcomeOrientation(tasks) {
  if (tasks.length === 0) return 0;

  const outcomePatterns = [
    /achieve/i, /deliver/i, /complete/i, /launch/i,
    /enable/i, /reduce/i, /increase/i, /improve/i,
    /\d+%/, /roi|revenue|cost|efficiency|kpi/i,
    /go.?live/i, /production/i, /release/i, /deploy/i,
    /rollout/i, /cutover/i
  ];

  const activityPatterns = [
    /work on/i, /continue/i, /ongoing/i,
    /research/i, /explore/i, /investigate/i,
    /meeting|discuss|review(?!.*board)/i, /analyze/i
  ];

  let totalScore = 0;

  for (const task of tasks) {
    const text = task.title || '';

    const hasOutcome = outcomePatterns.some(p => p.test(text));
    const hasActivity = activityPatterns.some(p => p.test(text));

    if (hasOutcome && !hasActivity) {
      totalScore += 1;
    } else if (hasOutcome && hasActivity) {
      totalScore += 0.6;
    } else if (!hasOutcome && !hasActivity) {
      totalScore += 0.4; // Neutral
    }
    // Pure activity = 0
  }

  return totalScore / tasks.length;
}

/**
 * Score legend coherence - do legend colors match used colors?
 *
 * @param {Object} data - Gantt chart data
 * @param {Array} tasks - Parsed tasks
 * @returns {number} Score 0-1
 */
export function scoreLegendCoherence(data, tasks) {
  const legend = data.legend || [];
  const usedColors = new Set();

  // Collect all colors used in tasks
  for (const task of tasks) {
    if (task.bar?.color) {
      usedColors.add(task.bar.color);
    }
  }

  if (usedColors.size === 0) return 0.5; // No colors used

  // If legend is empty but colors are used consistently
  if (legend.length === 0) {
    // Empty legend is acceptable if using position-based coloring
    return 0.6;
  }

  // Check if legend colors match used colors
  const legendColors = new Set(legend.map(l => l.color));
  const matchedColors = [...usedColors].filter(c => legendColors.has(c));

  // Score based on coverage
  let score = 0;

  // Legend covers used colors
  const coverageRatio = matchedColors.length / usedColors.size;
  score += coverageRatio * 0.5;

  // Legend has meaningful labels
  const hasLabels = legend.filter(l => l.label && l.label.length > 2).length;
  score += Math.min(0.3, (hasLabels / legend.length) * 0.3);

  // No extra unused legend entries (slight penalty)
  const unusedLegend = legend.filter(l => !usedColors.has(l.color)).length;
  if (unusedLegend > 0) {
    score -= 0.1 * Math.min(unusedLegend, 2);
  } else {
    score += 0.2;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Score naming consistency across tasks
 *
 * @param {Array} tasks - Parsed tasks
 * @returns {number} Score 0-1
 */
export function scoreNamingConsistency(tasks) {
  if (tasks.length < 3) return 0.5;

  const titles = tasks
    .map(t => t.title || '')
    .filter(n => n.length > 0);

  if (titles.length < 3) return 0.5;

  let score = 0.5;

  // Check for consistent casing
  const cases = titles.map(n => {
    if (n === n.toUpperCase()) return 'upper';
    if (n === n.toLowerCase()) return 'lower';
    if (n[0] === n[0].toUpperCase()) return 'title';
    return 'mixed';
  });

  const dominantCase = getMostFrequent(cases);
  const caseConsistency = cases.filter(c => c === dominantCase).length / cases.length;
  score += caseConsistency * 0.25;

  // Check for consistent prefixes/patterns
  const startsWithVerb = titles.filter(n =>
    /^(implement|develop|create|build|design|deploy|launch|enable|establish|complete|deliver)/i.test(n)
  ).length;

  if (startsWithVerb >= titles.length * 0.5) {
    score += 0.25; // Consistent verb-first naming
  }

  // Penalize very inconsistent lengths
  const lengths = titles.map(n => n.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const lengthVariance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
  const lengthCV = avgLength > 0 ? Math.sqrt(lengthVariance) / avgLength : 1;

  if (lengthCV < 0.5) score += 0.2;

  return Math.min(1, score);
}

/**
 * Score task granularity balance
 *
 * @param {Array} tasks - Parsed tasks
 * @returns {number} Score 0-1
 */
export function scoreGranularityBalance(tasks) {
  if (tasks.length < 2) return 0.5;

  // Calculate task durations in columns
  const durations = tasks
    .map(t => {
      if (!t.bar || t.bar.startCol == null || t.bar.endCol == null) return null;
      return t.bar.endCol - t.bar.startCol + 1; // Duration in columns
    })
    .filter(d => d !== null && d > 0);

  if (durations.length < 2) return 0.5;

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  let score = 0.5;

  // Penalize extreme variance (10x difference is concerning)
  const ratio = maxDuration / Math.max(minDuration, 1);
  if (ratio < 5) score += 0.3;
  else if (ratio < 10) score += 0.15;

  // Check that most tasks are in reasonable range (1-4 columns typical)
  const reasonableTasks = durations.filter(d => d >= 1 && d <= 5).length;
  const reasonableRatio = reasonableTasks / durations.length;
  score += reasonableRatio * 0.2;

  return Math.min(1, score);
}

/**
 * Score swimlane minimum - validates ≥2 swimlanes per prompt requirement
 *
 * @param {Array} swimlanes - Parsed swimlanes
 * @returns {number} Score 0-1
 */
export function scoreSwimlaneMinimum(swimlanes) {
  const count = swimlanes?.length || 0;

  if (count === 0) return 0;
  if (count === 1) return 0.3; // Below minimum
  if (count === 2) return 0.8; // Meets minimum
  if (count >= 3) return 1.0; // Exceeds minimum

  return 0;
}

/**
 * Score research fitness - uses researchAnalysis.overallScore if available
 *
 * @param {Object} data - Gantt chart data
 * @returns {number} Score 0-1
 */
export function scoreResearchFitness(data) {
  const analysis = data.researchAnalysis;

  if (!analysis || typeof analysis.overallScore !== 'number') {
    return 0.5; // No research analysis - neutral
  }

  // Convert 1-10 scale to 0-1
  const normalizedScore = (analysis.overallScore - 1) / 9;

  return Math.max(0, Math.min(1, normalizedScore));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get most frequent item in array
 *
 * @param {Array} arr - Array of items
 * @returns {*} Most frequent item
 */
function getMostFrequent(arr) {
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
 * Validate Phase 2 implementation (updated for new schema)
 *
 * @returns {Object} Validation results
 */
export function validatePhase2() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: scoreRoadmapQuality returns valid structure for empty
  const emptyResult = scoreRoadmapQuality({});
  results.tests.push({
    name: 'scoreRoadmapQuality handles empty data',
    passed: emptyResult.overall === 0 && emptyResult.feedback !== undefined,
    details: `overall=${emptyResult.overall}`
  });

  // Test 2: All core dimensions are scored
  const mockData = createMockGanttChart();
  const result = scoreRoadmapQuality(mockData);
  const dimensionCount = Object.keys(result.dimensions).length;
  results.tests.push({
    name: 'Core dimensions scored (10+)',
    passed: dimensionCount >= 10,
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
  const badMock = { data: [] };
  const badResult = scoreRoadmapQuality(badMock);
  results.tests.push({
    name: 'Good mock scores higher than bad',
    passed: result.overall > badResult.overall,
    details: `good=${result.overall.toFixed(3)}, bad=${badResult.overall.toFixed(3)}`
  });

  // Test 6: Parse Gantt data correctly
  const { swimlanes, tasks } = parseGanttData(mockData);
  results.tests.push({
    name: 'parseGanttData finds swimlanes',
    passed: swimlanes.length >= 2,
    details: `swimlanes=${swimlanes.length}`
  });

  // Test 7: Parse Gantt data finds tasks
  results.tests.push({
    name: 'parseGanttData finds tasks',
    passed: tasks.length >= 3,
    details: `tasks=${tasks.length}`
  });

  // Test 8: scoreMilestoneClarity uses taskType
  const milestoneScore = scoreMilestoneClarity(tasks);
  results.tests.push({
    name: 'scoreMilestoneClarity works with taskType',
    passed: typeof milestoneScore === 'number' && milestoneScore >= 0,
    details: `score=${milestoneScore.toFixed(3)}`
  });

  // Test 9: Handles null/undefined gracefully
  const nullResult = scoreRoadmapQuality(null);
  results.tests.push({
    name: 'Handles null gracefully',
    passed: nullResult.overall === 0,
    details: `overall=${nullResult.overall}`
  });

  // Test 10: scoreResearchFitness works
  const researchScore = scoreResearchFitness(mockData);
  results.tests.push({
    name: 'scoreResearchFitness works',
    passed: researchScore >= 0 && researchScore <= 1,
    details: `score=${researchScore.toFixed(3)}`
  });

  // Test 11: scoreSwimlaneMinimum validates count
  results.tests.push({
    name: 'scoreSwimlaneMinimum validates count',
    passed: scoreSwimlaneMinimum([]) === 0 && scoreSwimlaneMinimum([{}, {}]) >= 0.8,
    details: `0=${scoreSwimlaneMinimum([])}, 2=${scoreSwimlaneMinimum([{}, {}])}`
  });

  // Test 12: Feedback generated for low scores
  const lowScoreMock = { data: [{ title: 'Test', isSwimlane: true, entity: 'Test' }] };
  const lowResult = scoreRoadmapQuality(lowScoreMock);
  results.tests.push({
    name: 'Feedback generated for low scores',
    passed: Array.isArray(lowResult.feedback),
    details: `feedbackCount=${lowResult.feedback?.length}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

/**
 * Create a mock Gantt chart for testing (actual schema format)
 */
function createMockGanttChart() {
  return {
    title: 'Q1-Q4 2025 Roadmap',
    timeColumns: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
    data: [
      // Swimlane 1
      { title: 'Backend Development', isSwimlane: true, entity: 'Backend Development', taskType: 'task' },
      {
        title: 'Implement API Gateway',
        isSwimlane: false,
        entity: 'Backend Development',
        bar: { startCol: 1, endCol: 2, color: 'dark-blue' },
        taskType: 'task'
      },
      {
        title: 'Database Migration Complete',
        isSwimlane: false,
        entity: 'Backend Development',
        bar: { startCol: 2, endCol: 3, color: 'priority-red' },
        taskType: 'milestone'
      },
      {
        title: 'Launch MVP Release',
        isSwimlane: false,
        entity: 'Backend Development',
        bar: { startCol: 3, endCol: 4, color: 'priority-red' },
        taskType: 'milestone'
      },
      // Swimlane 2
      { title: 'Frontend Development', isSwimlane: true, entity: 'Frontend Development', taskType: 'task' },
      {
        title: 'Design System Implementation',
        isSwimlane: false,
        entity: 'Frontend Development',
        bar: { startCol: 1, endCol: 2, color: 'dark-blue' },
        taskType: 'task'
      },
      {
        title: 'User Dashboard Development',
        isSwimlane: false,
        entity: 'Frontend Development',
        bar: { startCol: 2, endCol: 3, color: 'dark-blue' },
        taskType: 'task'
      },
      {
        title: 'Go-Live Decision',
        isSwimlane: false,
        entity: 'Frontend Development',
        bar: { startCol: 3, endCol: 4, color: 'medium-red' },
        taskType: 'decision'
      },
      // Swimlane 3
      { title: 'DevOps & Infrastructure', isSwimlane: true, entity: 'DevOps & Infrastructure', taskType: 'task' },
      {
        title: 'CI/CD Pipeline Setup',
        isSwimlane: false,
        entity: 'DevOps & Infrastructure',
        bar: { startCol: 1, endCol: 1, color: 'mid-grey' },
        taskType: 'task'
      },
      {
        title: 'Kubernetes Migration',
        isSwimlane: false,
        entity: 'DevOps & Infrastructure',
        bar: { startCol: 2, endCol: 3, color: 'mid-grey' },
        taskType: 'task'
      },
      {
        title: 'Production Readiness Complete',
        isSwimlane: false,
        entity: 'DevOps & Infrastructure',
        bar: { startCol: 4, endCol: 4, color: 'priority-red' },
        taskType: 'milestone'
      }
    ],
    legend: [
      { color: 'priority-red', label: 'Milestones' },
      { color: 'dark-blue', label: 'Development' },
      { color: 'medium-red', label: 'Decisions' },
      { color: 'mid-grey', label: 'Infrastructure' }
    ],
    researchAnalysis: {
      topics: [
        {
          name: 'Backend Development',
          fitnessScore: 8,
          taskCount: 3,
          includedinChart: true,
          issues: [],
          recommendation: 'Good coverage of backend tasks'
        },
        {
          name: 'Frontend Development',
          fitnessScore: 7,
          taskCount: 3,
          includedinChart: true,
          issues: ['Some dates were vague'],
          recommendation: 'Add more specific timelines'
        }
      ],
      overallScore: 7.5,
      summary: 'Good research coverage with clear timelines for most initiatives'
    }
  };
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  const validation = validatePhase2();
  console.log('Roadmap Scoring Phase 2 Validation:', validation.passed ? 'PASSED' : 'FAILED');
  if (!validation.passed) {
    validation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }
}
