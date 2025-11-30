/**
 * Roadmap Quality Scoring
 *
 * Comprehensive quality scoring for Roadmap content with 10 dimensions.
 *
 * Implementation of Plan 04: Scoring Depth Parity - Phase 2
 */

import { ROADMAP_DIMENSIONS, calculateWeightedScore } from './qualityDimensions.js';

// ============================================================================
// Phase 2: Roadmap Quality Scoring Implementation
// ============================================================================

/**
 * Score overall Roadmap quality across all dimensions
 *
 * @param {Object} data - Roadmap data structure
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

  // Handle empty swimlanes
  if (!data.swimlanes || data.swimlanes.length === 0) {
    return {
      overall: 0,
      dimensions: {},
      feedback: [{ dimension: 'structure', score: 0, description: 'No swimlanes defined' }]
    };
  }

  const scores = {};

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

  return calculateWeightedScore(scores, ROADMAP_DIMENSIONS);
}

/**
 * Score swimlane completeness - how well swimlanes cover the timeline
 *
 * @param {Object} data - Roadmap data
 * @returns {number} Score 0-1
 */
export function scoreSwimlaneCompleteness(data) {
  if (!data.swimlanes?.length) return 0;

  // Parse timeline dates
  const timelineStart = parseDate(data.startDate);
  const timelineEnd = parseDate(data.endDate);

  if (!timelineStart || !timelineEnd || timelineStart >= timelineEnd) {
    // If no timeline, check if swimlanes have tasks
    const hasTasks = data.swimlanes.some(s => s.tasks?.length > 0);
    return hasTasks ? 0.3 : 0;
  }

  const totalMonths = monthsBetween(timelineStart, timelineEnd);
  const coverageScores = [];

  for (const swimlane of data.swimlanes) {
    if (!swimlane.tasks?.length) {
      coverageScores.push(0);
      continue;
    }

    // Calculate covered months for this swimlane
    const coveredMonths = new Set();

    for (const task of swimlane.tasks) {
      const taskStart = parseDate(task.startDate);
      const taskEnd = parseDate(task.endDate);

      if (taskStart && taskEnd) {
        let current = new Date(taskStart);
        while (current <= taskEnd) {
          coveredMonths.add(`${current.getFullYear()}-${current.getMonth()}`);
          current.setMonth(current.getMonth() + 1);
        }
      }
    }

    // Score based on coverage (60% coverage = full score)
    const targetCoverage = Math.max(1, totalMonths * 0.6);
    coverageScores.push(Math.min(1, coveredMonths.size / targetCoverage));
  }

  return coverageScores.length > 0
    ? coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length
    : 0;
}

/**
 * Score task description quality
 *
 * @param {Object} data - Roadmap data
 * @returns {number} Score 0-1
 */
export function scoreTaskDescriptions(data) {
  const allTasks = getAllTasks(data);
  if (allTasks.length === 0) return 0;

  let totalScore = 0;

  for (const task of allTasks) {
    const desc = task.description || '';
    const name = task.name || task.title || '';

    let taskScore = 0;

    // Has description at all
    if (desc.length > 0) taskScore += 0.25;

    // Description is meaningful (> 15 chars)
    if (desc.length > 15) taskScore += 0.25;

    // Description differs from title
    if (desc.toLowerCase() !== name.toLowerCase() && desc.length > 0) {
      taskScore += 0.25;
    }

    // Description contains action/outcome words
    const actionWords = /\b(implement|develop|create|build|design|deploy|migrate|integrate|optimize|launch|deliver|establish|complete|enable|improve)\b/i;
    if (actionWords.test(desc) || actionWords.test(name)) {
      taskScore += 0.25;
    }

    totalScore += taskScore;
  }

  return totalScore / allTasks.length;
}

/**
 * Score temporal distribution - how well tasks are spread across timeline
 *
 * @param {Object} data - Roadmap data
 * @returns {number} Score 0-1
 */
export function scoreTemporalDistribution(data) {
  const allTasks = getAllTasks(data);
  if (allTasks.length < 2) return 0.5;  // Can't assess with few tasks

  const timelineStart = parseDate(data.startDate);
  const timelineEnd = parseDate(data.endDate);

  if (!timelineStart || !timelineEnd) return 0.5;

  const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
  if (totalDuration <= 0) return 0.5;

  // Get normalized start positions
  const positions = allTasks
    .map(t => {
      const taskStart = parseDate(t.startDate);
      if (!taskStart) return null;
      return (taskStart.getTime() - timelineStart.getTime()) / totalDuration;
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
 * Score milestone clarity - are key milestones identified?
 *
 * @param {Object} data - Roadmap data
 * @returns {number} Score 0-1
 */
export function scoreMilestoneClarity(data) {
  const allTasks = getAllTasks(data);
  if (allTasks.length === 0) return 0;

  const milestonePatterns = [
    /milestone/i,
    /launch/i,
    /release/i,
    /go.?live/i,
    /complete/i,
    /deliver/i,
    /phase\s*\d/i,
    /v\d+\.\d+/i,
    /beta|alpha|ga\b/i,
    /mvp/i
  ];

  let milestoneCount = 0;
  for (const task of allTasks) {
    const text = `${task.name || ''} ${task.description || ''} ${task.title || ''}`;
    if (milestonePatterns.some(p => p.test(text))) {
      milestoneCount++;
    }
  }

  // Also check if task has milestone flag
  const flaggedMilestones = allTasks.filter(t => t.isMilestone || t.milestone).length;
  milestoneCount = Math.max(milestoneCount, flaggedMilestones);

  // Expect at least 1 milestone per swimlane, max credit at 3+ milestones
  const swimlaneCount = data.swimlanes?.length || 1;
  const expectedMilestones = Math.max(swimlaneCount, 2);

  return Math.min(1, milestoneCount / expectedMilestones);
}

/**
 * Score dependency logic - do task sequences make sense?
 *
 * @param {Object} data - Roadmap data
 * @returns {number} Score 0-1
 */
export function scoreDependencyLogic(data) {
  const allTasks = getAllTasks(data);
  if (allTasks.length < 2) return 0.5;

  let score = 0.5;  // Base score

  // Check explicit dependencies
  const hasDependencies = allTasks.some(t =>
    t.dependencies?.length > 0 || t.dependsOn?.length > 0 || t.prerequisite
  );

  if (hasDependencies) {
    score += 0.3;

    // Validate dependency order (dependent tasks should start after prerequisites)
    const taskById = new Map(allTasks.map(t => [t.id, t]));
    let validDeps = 0;
    let totalDeps = 0;

    for (const task of allTasks) {
      const deps = task.dependencies || task.dependsOn || [];
      for (const depId of deps) {
        totalDeps++;
        const depTask = taskById.get(depId);
        if (depTask) {
          const taskStart = parseDate(task.startDate);
          const depEnd = parseDate(depTask.endDate);
          if (taskStart && depEnd && taskStart >= depEnd) {
            validDeps++;
          }
        }
      }
    }

    if (totalDeps > 0) {
      score += (validDeps / totalDeps) * 0.2;
    }
  } else {
    // Check implicit logical ordering via naming patterns
    const phases = allTasks.filter(t =>
      /phase\s*[1-9]|step\s*[1-9]|stage\s*[1-9]/i.test(t.name || t.title || '')
    );
    if (phases.length >= 2) {
      score += 0.2;
    }
  }

  return Math.min(1, score);
}

/**
 * Score scope alignment - are swimlanes distinct and non-overlapping?
 *
 * @param {Object} data - Roadmap data
 * @returns {number} Score 0-1
 */
export function scoreScopeAlignment(data) {
  if (!data.swimlanes?.length) return 0;
  if (data.swimlanes.length === 1) return 0.7;  // Single swimlane is acceptable

  const swimlaneNames = data.swimlanes
    .map(s => (s.name || s.title || '').toLowerCase())
    .filter(n => n.length > 0);

  if (swimlaneNames.length < 2) return 0.5;

  let score = 1.0;

  // Penalize overlapping names
  for (let i = 0; i < swimlaneNames.length; i++) {
    const words1 = new Set(swimlaneNames[i].split(/\s+/).filter(w => w.length > 3));

    for (let j = i + 1; j < swimlaneNames.length; j++) {
      const words2 = new Set(swimlaneNames[j].split(/\s+/).filter(w => w.length > 3));
      const intersection = [...words1].filter(w => words2.has(w));

      if (intersection.length > 0) {
        score -= 0.15 * intersection.length;
      }
    }
  }

  // Bonus for clear domain separation
  const domainPatterns = [
    /frontend|backend|infra|devops|data|security|product|design|marketing|sales/i,
    /q[1-4]|phase|stream|workstream|track/i
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
 * @param {Object} data - Roadmap data
 * @returns {number} Score 0-1
 */
export function scoreOutcomeOrientation(data) {
  const allTasks = getAllTasks(data);
  if (allTasks.length === 0) return 0;

  const outcomePatterns = [
    /achieve/i, /deliver/i, /complete/i, /launch/i,
    /enable/i, /reduce/i, /increase/i, /improve/i,
    /\d+%/, /roi|revenue|cost|efficiency|kpi/i,
    /go.?live/i, /production/i, /release/i
  ];

  const activityPatterns = [
    /work on/i, /continue/i, /ongoing/i,
    /research/i, /explore/i, /investigate/i,
    /meeting|discuss|review|analyze/i
  ];

  let totalScore = 0;

  for (const task of allTasks) {
    const text = `${task.name || ''} ${task.description || ''} ${task.title || ''}`;

    const hasOutcome = outcomePatterns.some(p => p.test(text));
    const hasActivity = activityPatterns.some(p => p.test(text));

    if (hasOutcome && !hasActivity) {
      totalScore += 1;
    } else if (hasOutcome && hasActivity) {
      totalScore += 0.6;
    } else if (!hasOutcome && !hasActivity) {
      totalScore += 0.4;  // Neutral
    }
    // Pure activity = 0
  }

  return totalScore / allTasks.length;
}

/**
 * Score resource consideration - does the roadmap consider resources?
 *
 * @param {Object} data - Roadmap data
 * @returns {number} Score 0-1
 */
export function scoreResourceConsideration(data) {
  const allTasks = getAllTasks(data);
  if (allTasks.length === 0) return 0;

  let score = 0;

  // Check for resource fields
  const hasResourceFields = allTasks.some(t =>
    t.assignee || t.owner || t.team || t.resources || t.effort || t.estimate
  );
  if (hasResourceFields) score += 0.4;

  // Check for resource mentions in text
  const resourcePatterns = [
    /\d+\s*(fte|person|engineer|developer|designer|resource)/i,
    /team|squad|group/i,
    /budget|\$|cost/i,
    /capacity|bandwidth|availability/i,
    /hire|recruit|contractor/i
  ];

  const hasResourceMentions = allTasks.some(t => {
    const text = `${t.name || ''} ${t.description || ''}`;
    return resourcePatterns.some(p => p.test(text));
  });
  if (hasResourceMentions) score += 0.3;

  // Check for balanced task distribution (implicit resource consideration)
  if (data.swimlanes?.length > 1) {
    const taskCounts = data.swimlanes.map(s => s.tasks?.length || 0);
    const avgTasks = taskCounts.reduce((a, b) => a + b, 0) / taskCounts.length;
    const variance = taskCounts.reduce((sum, c) => sum + Math.pow(c - avgTasks, 2), 0) / taskCounts.length;
    const cv = avgTasks > 0 ? Math.sqrt(variance) / avgTasks : 1;

    if (cv < 0.5) score += 0.3;  // Well-balanced
    else if (cv < 1.0) score += 0.15;
  }

  return Math.min(1, score);
}

/**
 * Score naming consistency across tasks
 *
 * @param {Object} data - Roadmap data
 * @returns {number} Score 0-1
 */
export function scoreNamingConsistency(data) {
  const allTasks = getAllTasks(data);
  if (allTasks.length < 3) return 0.5;

  const names = allTasks
    .map(t => t.name || t.title || '')
    .filter(n => n.length > 0);

  if (names.length < 3) return 0.5;

  let score = 0.5;

  // Check for consistent casing
  const cases = names.map(n => {
    if (n === n.toUpperCase()) return 'upper';
    if (n === n.toLowerCase()) return 'lower';
    if (n[0] === n[0].toUpperCase()) return 'title';
    return 'mixed';
  });

  const dominantCase = getMostFrequent(cases);
  const caseConsistency = cases.filter(c => c === dominantCase).length / cases.length;
  score += caseConsistency * 0.25;

  // Check for consistent prefixes/patterns
  const startsWithVerb = names.filter(n =>
    /^(implement|develop|create|build|design|deploy|launch|enable|establish)/i.test(n)
  ).length;

  if (startsWithVerb >= names.length * 0.5) {
    score += 0.25;  // Consistent verb-first naming
  }

  // Penalize very inconsistent lengths
  const lengths = names.map(n => n.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const lengthVariance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
  const lengthCV = Math.sqrt(lengthVariance) / avgLength;

  if (lengthCV < 0.5) score += 0.2;

  return Math.min(1, score);
}

/**
 * Score task granularity balance
 *
 * @param {Object} data - Roadmap data
 * @returns {number} Score 0-1
 */
export function scoreGranularityBalance(data) {
  const allTasks = getAllTasks(data);
  if (allTasks.length < 2) return 0.5;

  // Calculate task durations
  const durations = allTasks
    .map(t => {
      const start = parseDate(t.startDate);
      const end = parseDate(t.endDate);
      if (start && end) {
        return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);  // Days
      }
      return null;
    })
    .filter(d => d !== null && d > 0);

  if (durations.length < 2) return 0.5;

  // Check for balanced durations
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  let score = 0.5;

  // Penalize extreme variance (100x difference is too much)
  const ratio = maxDuration / Math.max(minDuration, 1);
  if (ratio < 10) score += 0.3;
  else if (ratio < 50) score += 0.15;

  // Check that most tasks are in reasonable range (1 week to 3 months)
  const reasonableTasks = durations.filter(d => d >= 7 && d <= 90).length;
  const reasonableRatio = reasonableTasks / durations.length;
  score += reasonableRatio * 0.2;

  return Math.min(1, score);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all tasks from all swimlanes
 *
 * @param {Object} data - Roadmap data
 * @returns {Array<Object>} All tasks
 */
function getAllTasks(data) {
  if (!data.swimlanes) return [];
  return data.swimlanes.flatMap(s => s.tasks || []);
}

/**
 * Parse a date string into a Date object
 *
 * @param {string|Date} dateStr - Date string or object
 * @returns {Date|null} Parsed date or null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;

  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Calculate months between two dates
 *
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {number} Number of months
 */
function monthsBetween(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) + 1;
}

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
 * Validate Phase 2 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase2() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: scoreRoadmapQuality returns valid structure
  const emptyResult = scoreRoadmapQuality({});
  results.tests.push({
    name: 'scoreRoadmapQuality handles empty data',
    passed: emptyResult.overall === 0 && emptyResult.feedback !== undefined,
    details: `overall=${emptyResult.overall}`
  });

  // Test 2: All 10 dimensions are scored
  const mockData = createMockRoadmap();
  const result = scoreRoadmapQuality(mockData);
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

  // Test 4: Overall score is weighted average
  results.tests.push({
    name: 'Overall score is reasonable',
    passed: result.overall >= 0 && result.overall <= 1,
    details: `overall=${result.overall.toFixed(3)}`
  });

  // Test 5: Good mock scores higher than bad mock
  const badMock = { swimlanes: [] };
  const badResult = scoreRoadmapQuality(badMock);
  results.tests.push({
    name: 'Good mock scores higher than bad',
    passed: result.overall > badResult.overall,
    details: `good=${result.overall.toFixed(3)}, bad=${badResult.overall.toFixed(3)}`
  });

  // Test 6: Individual scorer functions work
  results.tests.push({
    name: 'scoreSwimlaneCompleteness works',
    passed: typeof scoreSwimlaneCompleteness(mockData) === 'number',
    details: `score=${scoreSwimlaneCompleteness(mockData).toFixed(3)}`
  });

  // Test 7: scoreTaskDescriptions works
  results.tests.push({
    name: 'scoreTaskDescriptions works',
    passed: typeof scoreTaskDescriptions(mockData) === 'number',
    details: `score=${scoreTaskDescriptions(mockData).toFixed(3)}`
  });

  // Test 8: scoreTemporalDistribution works
  results.tests.push({
    name: 'scoreTemporalDistribution works',
    passed: typeof scoreTemporalDistribution(mockData) === 'number',
    details: `score=${scoreTemporalDistribution(mockData).toFixed(3)}`
  });

  // Test 9: Handles null/undefined gracefully
  const nullResult = scoreRoadmapQuality(null);
  results.tests.push({
    name: 'Handles null gracefully',
    passed: nullResult.overall === 0,
    details: `overall=${nullResult.overall}`
  });

  // Test 10: Feedback generated for low scores
  const lowScoreMock = { swimlanes: [{ name: 'Test', tasks: [] }] };
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
 * Create a mock roadmap for testing
 */
function createMockRoadmap() {
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-12-31');

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    swimlanes: [
      {
        name: 'Backend Development',
        tasks: [
          {
            id: 'task-1',
            name: 'Implement API Gateway',
            description: 'Build and deploy the main API gateway to enable service communication',
            startDate: '2025-01-15',
            endDate: '2025-03-15',
            isMilestone: false
          },
          {
            id: 'task-2',
            name: 'Database Migration - Phase 1',
            description: 'Migrate legacy database to new schema, achieving 50% data transfer',
            startDate: '2025-03-01',
            endDate: '2025-05-31',
            dependencies: ['task-1']
          },
          {
            id: 'task-3',
            name: 'Launch MVP Release',
            description: 'Complete MVP launch with core features enabled for production',
            startDate: '2025-06-01',
            endDate: '2025-06-30',
            isMilestone: true,
            dependencies: ['task-2']
          }
        ]
      },
      {
        name: 'Frontend Development',
        tasks: [
          {
            id: 'task-4',
            name: 'Design System Implementation',
            description: 'Create reusable component library following design guidelines',
            startDate: '2025-02-01',
            endDate: '2025-04-30'
          },
          {
            id: 'task-5',
            name: 'User Dashboard Development',
            description: 'Build main user dashboard with analytics and reporting features',
            startDate: '2025-04-15',
            endDate: '2025-07-31',
            dependencies: ['task-4']
          },
          {
            id: 'task-6',
            name: 'Go-Live Preparation',
            description: 'Complete final testing and deploy to production environment',
            startDate: '2025-08-01',
            endDate: '2025-09-30',
            isMilestone: true
          }
        ]
      },
      {
        name: 'DevOps & Infrastructure',
        tasks: [
          {
            id: 'task-7',
            name: 'CI/CD Pipeline Setup',
            description: 'Establish automated deployment pipeline with testing integration',
            startDate: '2025-01-01',
            endDate: '2025-02-28'
          },
          {
            id: 'task-8',
            name: 'Kubernetes Migration',
            description: 'Migrate services to Kubernetes for improved scalability',
            startDate: '2025-03-01',
            endDate: '2025-06-30',
            assignee: 'DevOps Team'
          },
          {
            id: 'task-9',
            name: 'Production Readiness Complete',
            description: 'Achieve 99.9% uptime target with full monitoring in place',
            startDate: '2025-10-01',
            endDate: '2025-12-15',
            isMilestone: true
          }
        ]
      }
    ]
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
