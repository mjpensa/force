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
 * Implementation of Plan 04: Scoring Depth Parity - Phase 2 (Optimized)
 */

import { ROADMAP_DIMENSIONS, calculateWeightedScore } from './qualityDimensions.js';

// Valid color palette from prompt
const VALID_COLORS = ['priority-red', 'medium-red', 'mid-grey', 'light-grey', 'white', 'dark-blue'];

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

  // 1. Swimlane Completeness - timeline coverage per swimlane
  scores.swimlaneCompleteness = scoreSwimlaneCompleteness(data, swimlanes, tasks);

  // 2. Title Quality (consolidated: title + outcome + naming consistency)
  scores.titleQuality = scoreTitleQuality(tasks);

  // 3. Temporal Distribution - tasks spread across columns
  scores.temporalDistribution = scoreTemporalDistribution(data, tasks);

  // 4. Interval Appropriateness - timeColumns format matches duration (NEW)
  scores.intervalAppropriateness = scoreIntervalAppropriateness(data);

  // 5. Milestone Clarity - milestones properly marked with taskType
  scores.milestoneClarity = scoreMilestoneClarity(tasks);

  // 6. Task Type Variety - presence of decisions (reduced scope)
  scores.taskTypeVariety = scoreTaskTypeVariety(tasks);

  // 7. Scope Alignment - swimlanes distinct + minimum count (merged)
  scores.scopeAlignment = scoreScopeAlignment(swimlanes, tasks);

  // 8. Bar Validity - startCol/endCol/color validation (NEW)
  scores.barValidity = scoreBarValidity(data, tasks);

  // 9. Legend Coherence - legend matches used colors
  scores.legendCoherence = scoreLegendCoherence(data, tasks);

  // 10. Granularity Balance - balanced task durations
  scores.granularityBalance = scoreGranularityBalance(tasks);

  // 11. Research Fitness - uses researchAnalysis.overallScore
  scores.researchFitness = scoreResearchFitness(data);

  return calculateWeightedScore(scores, ROADMAP_DIMENSIONS);
}

// ============================================================================
// Schema Parsing Helpers
// ============================================================================

/**
 * Parse Gantt chart data into swimlanes and tasks
 */
function parseGanttData(data) {
  const items = data.data || [];
  const swimlanes = items.filter(item => item.isSwimlane === true);
  const tasks = items.filter(item => item.isSwimlane === false);
  return { swimlanes, tasks };
}

/**
 * Get tasks belonging to a specific swimlane (by entity match)
 */
function getTasksForSwimlane(tasks, swimlane) {
  const swimlaneName = swimlane.entity || swimlane.title;
  return tasks.filter(task => task.entity === swimlaneName);
}

/**
 * Get the number of time columns
 */
function getColumnCount(data) {
  return data.timeColumns?.length || 0;
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Score swimlane completeness - how well swimlanes cover the timeline
 */
export function scoreSwimlaneCompleteness(data, swimlanes, tasks) {
  if (!swimlanes?.length) return 0;

  const columnCount = getColumnCount(data);
  if (columnCount === 0) {
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

    const coveredColumns = new Set();
    for (const task of swimlaneTasks) {
      const bar = task.bar;
      if (bar && bar.startCol != null && bar.endCol != null) {
        for (let col = bar.startCol; col <= bar.endCol; col++) {
          coveredColumns.add(col);
        }
      }
    }

    const targetCoverage = Math.max(1, columnCount * 0.6);
    coverageScores.push(Math.min(1, coveredColumns.size / targetCoverage));
  }

  return coverageScores.length > 0
    ? coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length
    : 0;
}

/**
 * Score title quality (CONSOLIDATED: taskTitleQuality + outcomeOrientation + namingConsistency)
 *
 * Components:
 * - Meaningfulness (25%): title length and specificity
 * - Outcome orientation (25%): outcomes vs activities
 * - Action words (25%): verbs and deliverables
 * - Consistency (25%): casing and patterns
 */
export function scoreTitleQuality(tasks) {
  if (tasks.length === 0) return 0;

  const titles = tasks.map(t => t.title || '').filter(t => t.length > 0);
  if (titles.length === 0) return 0;

  let meaningfulnessScore = 0;
  let outcomeScore = 0;
  let actionScore = 0;

  const outcomePatterns = [
    /achieve/i, /deliver/i, /complete/i, /launch/i, /enable/i,
    /reduce/i, /increase/i, /improve/i, /go.?live/i, /production/i,
    /release/i, /deploy/i, /rollout/i, /cutover/i, /\d+%/
  ];

  const activityPatterns = [
    /work on/i, /continue/i, /ongoing/i, /research/i,
    /explore/i, /investigate/i, /meeting/i, /discuss/i, /analyze/i
  ];

  const actionWords = /\b(implement|develop|create|build|design|deploy|migrate|integrate|optimize|launch|deliver|establish|complete|enable|improve|release|rollout)\b/i;
  const specificPatterns = /\d+|v\d|phase|stage|api|system|platform|service|module|feature/i;

  for (const title of titles) {
    // Meaningfulness
    if (title.length > 10) meaningfulnessScore += 0.5;
    if (specificPatterns.test(title)) meaningfulnessScore += 0.5;

    // Outcome orientation
    const hasOutcome = outcomePatterns.some(p => p.test(title));
    const hasActivity = activityPatterns.some(p => p.test(title));
    if (hasOutcome && !hasActivity) outcomeScore += 1;
    else if (hasOutcome && hasActivity) outcomeScore += 0.5;
    else if (!hasOutcome && !hasActivity) outcomeScore += 0.3;

    // Action words
    if (actionWords.test(title)) actionScore += 1;
  }

  meaningfulnessScore = meaningfulnessScore / titles.length;
  outcomeScore = outcomeScore / titles.length;
  actionScore = actionScore / titles.length;

  // Consistency scoring
  let consistencyScore = 0.5;
  if (titles.length >= 3) {
    // Check casing consistency
    const cases = titles.map(n => {
      if (n === n.toUpperCase()) return 'upper';
      if (n === n.toLowerCase()) return 'lower';
      if (n[0] === n[0].toUpperCase()) return 'title';
      return 'mixed';
    });
    const dominantCase = getMostFrequent(cases);
    const caseConsistency = cases.filter(c => c === dominantCase).length / cases.length;
    consistencyScore = caseConsistency;
  }

  // Weighted combination
  return (meaningfulnessScore * 0.25) + (outcomeScore * 0.25) +
         (actionScore * 0.25) + (consistencyScore * 0.25);
}

/**
 * Score temporal distribution - how well tasks are spread across timeline
 */
export function scoreTemporalDistribution(data, tasks) {
  if (tasks.length < 2) return 0.5;

  const columnCount = getColumnCount(data);
  if (columnCount === 0) return 0.5;

  const positions = tasks
    .map(t => {
      if (!t.bar || t.bar.startCol == null) return null;
      return (t.bar.startCol - 1) / columnCount;
    })
    .filter(p => p !== null)
    .sort((a, b) => a - b);

  if (positions.length < 2) return 0.5;

  const expectedGap = 1 / (positions.length + 1);
  let gapVariance = 0;

  for (let i = 0; i < positions.length - 1; i++) {
    const gap = positions[i + 1] - positions[i];
    gapVariance += Math.pow(gap - expectedGap, 2);
  }

  gapVariance += Math.pow(positions[0] - 0, 2);
  gapVariance += Math.pow(1 - positions[positions.length - 1], 2);

  const normalizedVariance = Math.sqrt(gapVariance / (positions.length + 1));
  return Math.max(0, Math.min(1, 1 - normalizedVariance * 2));
}

/**
 * Score interval appropriateness - validate timeColumns format matches duration
 *
 * Prompt requirements:
 * - ≤90 days: Weeks ["W1 2026", "W2 2026"]
 * - 91-365 days: Months ["Jan 2026", "Feb 2026"]
 * - 366-1095 days: Quarters ["Q1 2026", "Q2 2026"]
 * - >1095 days: Years ["2020", "2021", "2022"]
 */
export function scoreIntervalAppropriateness(data) {
  const timeColumns = data.timeColumns || [];
  if (timeColumns.length < 2) return 0.5;

  // Detect interval type from first column
  const sample = timeColumns[0];
  let detectedType = 'unknown';

  if (/^W\d+\s*\d{4}$/i.test(sample)) {
    detectedType = 'weeks';
  } else if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(sample)) {
    detectedType = 'months';
  } else if (/^Q[1-4]\s*\d{4}$/i.test(sample)) {
    detectedType = 'quarters';
  } else if (/^\d{4}$/.test(sample)) {
    detectedType = 'years';
  }

  if (detectedType === 'unknown') return 0.5;

  // Calculate implied duration based on column count and type
  const columnCount = timeColumns.length;
  let impliedDays;

  switch (detectedType) {
    case 'weeks':
      impliedDays = columnCount * 7;
      break;
    case 'months':
      impliedDays = columnCount * 30;
      break;
    case 'quarters':
      impliedDays = columnCount * 91;
      break;
    case 'years':
      impliedDays = columnCount * 365;
      break;
    default:
      impliedDays = 0;
  }

  // Check if interval type is appropriate for duration
  let score = 0;

  if (detectedType === 'weeks' && impliedDays <= 90) {
    score = 1.0;
  } else if (detectedType === 'months' && impliedDays > 60 && impliedDays <= 365) {
    score = 1.0;
  } else if (detectedType === 'quarters' && impliedDays > 270 && impliedDays <= 1095) {
    score = 1.0;
  } else if (detectedType === 'years' && impliedDays > 730) {
    score = 1.0;
  } else {
    // Partial credit for close matches
    score = 0.5;
  }

  // Bonus for consistent format across all columns
  const allMatch = timeColumns.every(col => {
    if (detectedType === 'weeks') return /^W\d+\s*\d{4}$/i.test(col);
    if (detectedType === 'months') return /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(col);
    if (detectedType === 'quarters') return /^Q[1-4]\s*\d{4}$/i.test(col);
    if (detectedType === 'years') return /^\d{4}$/.test(col);
    return false;
  });

  if (allMatch) score = Math.min(1, score + 0.1);

  return score;
}

/**
 * Score milestone clarity - are milestones properly identified?
 */
export function scoreMilestoneClarity(tasks) {
  if (tasks.length === 0) return 0;

  const milestoneCount = tasks.filter(t => t.taskType === 'milestone').length;

  const milestonePatterns = [
    /milestone/i, /launch/i, /release/i, /go.?live/i, /complete/i,
    /deliver/i, /deploy/i, /rollout/i, /cutover/i, /phase\s*\d/i,
    /v\d+\.\d+/i, /beta|alpha|ga\b/i, /mvp/i
  ];

  let keywordMilestones = 0;
  for (const task of tasks) {
    if (milestonePatterns.some(p => p.test(task.title || ''))) {
      keywordMilestones++;
    }
  }

  const alignedMilestones = tasks.filter(t =>
    t.taskType === 'milestone' &&
    milestonePatterns.some(p => p.test(t.title || ''))
  ).length;

  let score = 0;

  // Having milestones
  if (milestoneCount > 0) score += 0.4;

  // Reasonable count (5-25% of tasks)
  const milestoneRatio = milestoneCount / tasks.length;
  if (milestoneRatio >= 0.05 && milestoneRatio <= 0.25) {
    score += 0.3;
  } else if (milestoneRatio > 0 && milestoneRatio < 0.4) {
    score += 0.15;
  }

  // Alignment between taskType and keywords
  if (milestoneCount > 0 && keywordMilestones > 0) {
    const alignmentRatio = alignedMilestones / Math.max(milestoneCount, keywordMilestones);
    score += alignmentRatio * 0.3;
  }

  return Math.min(1, score);
}

/**
 * Score task type variety - presence of decisions (focused scope)
 */
export function scoreTaskTypeVariety(tasks) {
  if (tasks.length === 0) return 0;

  const typeCounts = { task: 0, milestone: 0, decision: 0 };
  for (const task of tasks) {
    const type = task.taskType || 'task';
    if (typeCounts.hasOwnProperty(type)) {
      typeCounts[type]++;
    }
  }

  let score = 0.5; // Base score

  // Having at least 2 different types
  const typesUsed = Object.values(typeCounts).filter(c => c > 0).length;
  if (typesUsed >= 2) score += 0.2;
  if (typesUsed >= 3) score += 0.2;

  // Decisions present (the unique value of this dimension now)
  if (typeCounts.decision > 0) {
    score += 0.1;
    // Reasonable decision ratio (2-15%)
    const decisionRatio = typeCounts.decision / tasks.length;
    if (decisionRatio >= 0.02 && decisionRatio <= 0.15) {
      score += 0.1;
    }
  }

  return Math.min(1, score);
}

/**
 * Score scope alignment - swimlanes distinct + minimum count (MERGED)
 */
export function scoreScopeAlignment(swimlanes, tasks) {
  if (!swimlanes?.length) return 0;

  let score = 0;

  // Minimum count check (was swimlaneMinimum)
  if (swimlanes.length === 1) {
    score = 0.3; // Below minimum - major penalty
  } else if (swimlanes.length === 2) {
    score = 0.6; // Meets minimum
  } else {
    score = 0.7; // Exceeds minimum
  }

  // Each swimlane should have ≥3 tasks
  let swimlanesWithEnoughTasks = 0;
  for (const swimlane of swimlanes) {
    const swimlaneTasks = getTasksForSwimlane(tasks, swimlane);
    if (swimlaneTasks.length >= 3) {
      swimlanesWithEnoughTasks++;
    }
  }
  const taskMinRatio = swimlanesWithEnoughTasks / swimlanes.length;
  score += taskMinRatio * 0.15;

  // Check for distinct names (original scopeAlignment logic)
  const swimlaneNames = swimlanes
    .map(s => (s.title || s.entity || '').toLowerCase())
    .filter(n => n.length > 0);

  if (swimlaneNames.length >= 2) {
    // Penalize overlapping names
    for (let i = 0; i < swimlaneNames.length; i++) {
      const words1 = new Set(swimlaneNames[i].split(/\s+/).filter(w => w.length > 3));
      for (let j = i + 1; j < swimlaneNames.length; j++) {
        const words2 = new Set(swimlaneNames[j].split(/\s+/).filter(w => w.length > 3));
        const intersection = [...words1].filter(w => words2.has(w));
        if (intersection.length > 0) {
          score -= 0.05 * intersection.length;
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
      score += 0.15;
    }
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Score bar validity - validate bar structure and values (NEW)
 *
 * Checks:
 * - startCol ≤ endCol
 * - Columns within timeColumns range
 * - Proper null handling for unknown dates
 * - Colors from valid palette
 */
export function scoreBarValidity(data, tasks) {
  if (tasks.length === 0) return 0.5;

  const columnCount = getColumnCount(data);
  let validBars = 0;
  let invalidBars = 0;
  let nullBars = 0;
  let validColors = 0;

  for (const task of tasks) {
    const bar = task.bar;

    if (!bar) {
      invalidBars++;
      continue;
    }

    // Check for properly handled null bars (unknown dates)
    if (bar.startCol === null && bar.endCol === null) {
      nullBars++;
      // Null bars are acceptable if color is still valid
      if (bar.color && VALID_COLORS.includes(bar.color)) {
        validColors++;
      }
      continue;
    }

    // Validate startCol ≤ endCol
    if (bar.startCol != null && bar.endCol != null) {
      if (bar.startCol <= bar.endCol) {
        validBars++;
      } else {
        invalidBars++;
        continue;
      }

      // Validate within range
      if (columnCount > 0) {
        if (bar.startCol >= 1 && bar.endCol <= columnCount) {
          // Still valid
        } else {
          validBars--; // Reduce score slightly
          invalidBars += 0.5;
        }
      }
    } else {
      invalidBars++;
      continue;
    }

    // Check color validity
    if (bar.color && VALID_COLORS.includes(bar.color)) {
      validColors++;
    }
  }

  const totalBars = tasks.length;
  const validRatio = (validBars + nullBars) / Math.max(1, totalBars);
  const colorRatio = validColors / Math.max(1, totalBars);

  // Weighted score: bar structure (60%) + color validity (40%)
  return (validRatio * 0.6) + (colorRatio * 0.4);
}

/**
 * Score legend coherence - do legend colors match used colors?
 */
export function scoreLegendCoherence(data, tasks) {
  const legend = data.legend || [];
  const usedColors = new Set();

  for (const task of tasks) {
    if (task.bar?.color) {
      usedColors.add(task.bar.color);
    }
  }

  if (usedColors.size === 0) return 0.5;

  if (legend.length === 0) {
    // Empty legend is acceptable for position-based coloring
    return 0.6;
  }

  const legendColors = new Set(legend.map(l => l.color));
  const matchedColors = [...usedColors].filter(c => legendColors.has(c));

  let score = 0;

  // Legend covers used colors
  const coverageRatio = matchedColors.length / usedColors.size;
  score += coverageRatio * 0.5;

  // Legend has meaningful labels
  const hasLabels = legend.filter(l => l.label && l.label.length > 2).length;
  score += Math.min(0.3, (hasLabels / legend.length) * 0.3);

  // No extra unused legend entries
  const unusedLegend = legend.filter(l => !usedColors.has(l.color)).length;
  if (unusedLegend > 0) {
    score -= 0.1 * Math.min(unusedLegend, 2);
  } else {
    score += 0.2;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Score task granularity balance
 */
export function scoreGranularityBalance(tasks) {
  if (tasks.length < 2) return 0.5;

  const durations = tasks
    .map(t => {
      if (!t.bar || t.bar.startCol == null || t.bar.endCol == null) return null;
      return t.bar.endCol - t.bar.startCol + 1;
    })
    .filter(d => d !== null && d > 0);

  if (durations.length < 2) return 0.5;

  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  let score = 0.5;

  const ratio = maxDuration / Math.max(minDuration, 1);
  if (ratio < 5) score += 0.3;
  else if (ratio < 10) score += 0.15;

  const reasonableTasks = durations.filter(d => d >= 1 && d <= 5).length;
  const reasonableRatio = reasonableTasks / durations.length;
  score += reasonableRatio * 0.2;

  return Math.min(1, score);
}

/**
 * Score research fitness - uses researchAnalysis.overallScore
 */
export function scoreResearchFitness(data) {
  const analysis = data.researchAnalysis;

  if (!analysis || typeof analysis.overallScore !== 'number') {
    return 0.5;
  }

  // Convert 1-10 scale to 0-1
  const normalizedScore = (analysis.overallScore - 1) / 9;
  return Math.max(0, Math.min(1, normalizedScore));
}

// ============================================================================
// Helper Functions
// ============================================================================

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
 * Validate Phase 2 implementation (optimized dimensions)
 */
export function validatePhase2() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: scoreRoadmapQuality handles empty data
  const emptyResult = scoreRoadmapQuality({});
  results.tests.push({
    name: 'scoreRoadmapQuality handles empty data',
    passed: emptyResult.overall === 0 && emptyResult.feedback !== undefined,
    details: `overall=${emptyResult.overall}`
  });

  // Test 2: All dimensions are scored
  const mockData = createMockGanttChart();
  const result = scoreRoadmapQuality(mockData);
  const dimensionCount = Object.keys(result.dimensions).length;
  results.tests.push({
    name: 'All 11 dimensions scored',
    passed: dimensionCount === 11,
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

  // Test 6: scoreTitleQuality works (consolidated dimension)
  const { tasks } = parseGanttData(mockData);
  const titleScore = scoreTitleQuality(tasks);
  results.tests.push({
    name: 'scoreTitleQuality works (consolidated)',
    passed: titleScore > 0 && titleScore <= 1,
    details: `score=${titleScore.toFixed(3)}`
  });

  // Test 7: scoreIntervalAppropriateness works (NEW)
  const intervalScore = scoreIntervalAppropriateness(mockData);
  results.tests.push({
    name: 'scoreIntervalAppropriateness works',
    passed: intervalScore >= 0 && intervalScore <= 1,
    details: `score=${intervalScore.toFixed(3)}`
  });

  // Test 8: scoreBarValidity works (NEW)
  const barScore = scoreBarValidity(mockData, tasks);
  results.tests.push({
    name: 'scoreBarValidity works',
    passed: barScore > 0.5, // Good mock should have valid bars
    details: `score=${barScore.toFixed(3)}`
  });

  // Test 9: scoreScopeAlignment includes minimum check (MERGED)
  const { swimlanes } = parseGanttData(mockData);
  const scopeScore = scoreScopeAlignment(swimlanes, tasks);
  results.tests.push({
    name: 'scoreScopeAlignment includes minimum check',
    passed: scopeScore >= 0.6, // 3 swimlanes should score well
    details: `score=${scopeScore.toFixed(3)}`
  });

  // Test 10: Single swimlane scores low on scopeAlignment
  const singleSwimlaneMock = { data: [{ title: 'Only', isSwimlane: true, entity: 'Only' }] };
  const { swimlanes: singleSwimlanes, tasks: noTasks } = parseGanttData(singleSwimlaneMock);
  const singleScore = scoreScopeAlignment(singleSwimlanes, noTasks);
  results.tests.push({
    name: 'Single swimlane scores low',
    passed: singleScore <= 0.4,
    details: `score=${singleScore.toFixed(3)}`
  });

  // Test 11: Invalid bar (startCol > endCol) is detected
  const badBarMock = {
    timeColumns: ['Q1', 'Q2', 'Q3', 'Q4'],
    data: [
      { title: 'Test', isSwimlane: true, entity: 'Test' },
      { title: 'Bad Task', isSwimlane: false, entity: 'Test', bar: { startCol: 3, endCol: 1, color: 'dark-blue' } }
    ]
  };
  const { tasks: badTasks } = parseGanttData(badBarMock);
  const badBarScore = scoreBarValidity(badBarMock, badTasks);
  results.tests.push({
    name: 'Invalid bar detected',
    passed: badBarScore < 0.7,
    details: `score=${badBarScore.toFixed(3)}`
  });

  // Test 12: Handles null gracefully
  const nullResult = scoreRoadmapQuality(null);
  results.tests.push({
    name: 'Handles null gracefully',
    passed: nullResult.overall === 0,
    details: `overall=${nullResult.overall}`
  });

  results.passed = results.tests.every(t => t.passed);
  return results;
}

/**
 * Create a mock Gantt chart for testing
 */
function createMockGanttChart() {
  return {
    title: 'Q1-Q4 2025 Roadmap',
    timeColumns: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
    data: [
      { title: 'Backend Development', isSwimlane: true, entity: 'Backend Development', taskType: 'task' },
      { title: 'Implement API Gateway', isSwimlane: false, entity: 'Backend Development', bar: { startCol: 1, endCol: 2, color: 'dark-blue' }, taskType: 'task' },
      { title: 'Database Migration Complete', isSwimlane: false, entity: 'Backend Development', bar: { startCol: 2, endCol: 3, color: 'priority-red' }, taskType: 'milestone' },
      { title: 'Launch MVP Release', isSwimlane: false, entity: 'Backend Development', bar: { startCol: 3, endCol: 4, color: 'priority-red' }, taskType: 'milestone' },

      { title: 'Frontend Development', isSwimlane: true, entity: 'Frontend Development', taskType: 'task' },
      { title: 'Design System Implementation', isSwimlane: false, entity: 'Frontend Development', bar: { startCol: 1, endCol: 2, color: 'dark-blue' }, taskType: 'task' },
      { title: 'User Dashboard Development', isSwimlane: false, entity: 'Frontend Development', bar: { startCol: 2, endCol: 3, color: 'dark-blue' }, taskType: 'task' },
      { title: 'Go-Live Decision', isSwimlane: false, entity: 'Frontend Development', bar: { startCol: 3, endCol: 4, color: 'medium-red' }, taskType: 'decision' },

      { title: 'DevOps & Infrastructure', isSwimlane: true, entity: 'DevOps & Infrastructure', taskType: 'task' },
      { title: 'CI/CD Pipeline Setup', isSwimlane: false, entity: 'DevOps & Infrastructure', bar: { startCol: 1, endCol: 1, color: 'mid-grey' }, taskType: 'task' },
      { title: 'Kubernetes Migration', isSwimlane: false, entity: 'DevOps & Infrastructure', bar: { startCol: 2, endCol: 3, color: 'mid-grey' }, taskType: 'task' },
      { title: 'Production Readiness Complete', isSwimlane: false, entity: 'DevOps & Infrastructure', bar: { startCol: 4, endCol: 4, color: 'priority-red' }, taskType: 'milestone' }
    ],
    legend: [
      { color: 'priority-red', label: 'Milestones' },
      { color: 'dark-blue', label: 'Development' },
      { color: 'medium-red', label: 'Decisions' },
      { color: 'mid-grey', label: 'Infrastructure' }
    ],
    researchAnalysis: {
      topics: [
        { name: 'Backend Development', fitnessScore: 8, taskCount: 3, includedinChart: true, issues: [], recommendation: 'Good coverage' },
        { name: 'Frontend Development', fitnessScore: 7, taskCount: 3, includedinChart: true, issues: ['Some dates vague'], recommendation: 'Add timelines' }
      ],
      overallScore: 7.5,
      summary: 'Good research coverage with clear timelines'
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
