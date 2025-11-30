/**
 * Scoring Validation & Testing
 *
 * Comprehensive tests to validate scoring parity across all content types.
 *
 * Implementation of Plan 04: Scoring Depth Parity - Phase 6
 */

import {
  scoreContentQuality,
  getScoringCapabilities,
  compareScores,
  getFeedbackSummary,
  CONTENT_TYPES,
  getDimensionCount
} from './contentQualityScoring.js';

// ============================================================================
// Phase 6: Scoring Validation & Testing
// ============================================================================

/**
 * Good mock data for each content type
 * These should score > 0.6
 */
export const GOOD_MOCKS = {
  Roadmap: {
    data: {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      swimlanes: [
        {
          name: 'Backend Development',
          tasks: [
            {
              id: 'task-1',
              name: 'Implement API Gateway',
              description: 'Build and deploy the main API gateway to enable secure service communication with OAuth integration',
              startDate: '2025-01-15',
              endDate: '2025-03-15',
              isMilestone: false
            },
            {
              id: 'task-2',
              name: 'Database Migration - Phase 1',
              description: 'Complete migration of legacy database to new schema, achieving 50% data transfer with validation',
              startDate: '2025-03-01',
              endDate: '2025-05-31',
              dependencies: ['task-1']
            },
            {
              id: 'task-3',
              name: 'Launch MVP Release v1.0',
              description: 'Complete MVP launch with core features enabled for production deployment',
              startDate: '2025-06-01',
              endDate: '2025-06-30',
              isMilestone: true
            }
          ]
        },
        {
          name: 'Frontend Development',
          tasks: [
            {
              id: 'task-4',
              name: 'Design System Implementation',
              description: 'Create reusable component library following design guidelines for consistent UX',
              startDate: '2025-02-01',
              endDate: '2025-04-30'
            },
            {
              id: 'task-5',
              name: 'Build User Dashboard',
              description: 'Develop main user dashboard with analytics and reporting features',
              startDate: '2025-04-15',
              endDate: '2025-07-31'
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
        }
      ]
    },
    expectedMinScore: 0.6
  },

  Slides: {
    data: {
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
          title: 'Agenda: What We Will Cover Today',
          content: `Today we will cover:
1. Market analysis and competitive positioning
2. Financial performance deep dive
3. Strategic recommendations for 2025
4. Next steps and action items`
        },
        {
          title: 'Market Analysis: Key Opportunities',
          content: `Our analysis reveals three major market opportunities:
- Digital transformation spending projected to reach $2.8 trillion by 2025
- Cloud migration services show 34% year-over-year growth
- AI/ML integration demand increased 45% in target segments
Source: Forrester Research, McKinsey Digital Report 2024`
        },
        {
          title: 'Financial Results Drive Strategic Confidence',
          content: `Q4 financial highlights demonstrate strong execution:
• Revenue: $45.2M (+23% QoQ)
• Gross margin: 68% (vs. 62% industry benchmark)
• Customer acquisition cost reduced by 18%
• Annual recurring revenue grew to $180M`
        },
        {
          title: 'Key Takeaways and Recommendations',
          content: `In summary:
• Market conditions favor aggressive growth strategy
• Financial performance validates current approach
• Three strategic initiatives recommended for Q1 2025

Action items for leadership team:
- Review and approve budget allocation by Jan 15
- Schedule quarterly strategy review sessions`
        }
      ]
    },
    expectedMinScore: 0.6
  },

  Document: {
    data: {
      executiveSummary: `This strategic analysis examines the evolving landscape of enterprise AI adoption
and provides actionable recommendations for technology leaders. Our research indicates that companies
investing in AI infrastructure today will achieve 3x ROI within 24 months. However, significant
challenges remain in talent acquisition and change management.`,
      sections: [
        {
          title: 'Market Overview',
          content: `The enterprise AI market has grown 45% year-over-year according to Gartner research.
Previously, adoption was limited to large enterprises, but currently mid-market companies are
accelerating investment. Going forward, we expect continued expansion into new verticals.`
        },
        {
          title: 'Key Findings',
          content: `Our analysis reveals three critical insights:
1. Early adopters show 2.5x productivity gains
2. Implementation timelines have decreased from 18 to 6 months
3. ROI visibility has improved significantly, reducing executive risk concerns`
        },
        {
          title: 'Recommendations',
          content: `We recommend the following strategic actions:
1. Establish an AI Center of Excellence by Q2 2025
2. Allocate 15% of IT budget to AI initiatives
3. Partner with leading cloud providers for infrastructure`
        }
      ]
    },
    expectedMinScore: 0.5
  },

  ResearchAnalysis: {
    data: {
      summary: `This comprehensive market analysis examines three key trends reshaping enterprise software.
Overall, our research indicates a shift toward AI-powered solutions, with market leaders demonstrating
3x faster adoption rates. The findings suggest companies prioritizing digital transformation will
capture disproportionate market share, though several risks merit consideration.`,
      themes: [
        {
          name: 'AI Integration Acceleration',
          description: 'Enterprise AI adoption has exceeded projections by 45%, driven by improved ROI.',
          evidence: [
            'Gartner reports 67% of enterprises deployed AI applications',
            'McKinsey study shows implementation time decreased from 18 to 6 months',
            'Survey of 500 CIOs indicates 78% plan increased AI spending'
          ],
          insight: 'Paradoxically, late adopters are now moving faster due to mature tooling'
        },
        {
          name: 'Cloud Cost Optimization',
          description: 'After rapid migration, enterprises now focus on FinOps with 62% reporting initiatives.',
          evidence: [
            'Forrester data shows 35% average cloud waste across accounts',
            'FinOps Foundation reports 2.5x increase in practitioners YoY'
          ]
        }
      ],
      recommendations: [
        'Establish AI Center of Excellence by Q2 2025 to coordinate adoption efforts',
        'Implement FinOps practices targeting 25% cost reduction within 12 months',
        'Conduct Zero Trust maturity assessment with 24-month roadmap'
      ]
    },
    expectedMinScore: 0.6
  }
};

/**
 * Bad mock data for each content type
 * These should score < 0.4
 */
export const BAD_MOCKS = {
  Roadmap: {
    data: {
      swimlanes: [
        {
          name: 'Stuff',
          tasks: [
            { name: 'Do things' },
            { name: 'More stuff' }
          ]
        }
      ]
    },
    expectedMaxScore: 0.4
  },

  Slides: {
    data: {
      slides: [
        { title: 'Slide 1', content: 'Text here' },
        { title: 'Slide 2', content: 'More text' }
      ]
    },
    expectedMaxScore: 0.4
  },

  Document: {
    data: {
      content: 'This is a document about something important.'
    },
    expectedMaxScore: 0.4
  },

  ResearchAnalysis: {
    data: {
      themes: [
        { name: 'Topic', description: 'Some analysis' }
      ]
    },
    expectedMaxScore: 0.4
  }
};

/**
 * Validate scoring parity across all content types
 *
 * @returns {Object} Validation results
 */
export function validateScoringParity() {
  const results = {
    passed: true,
    contentTypes: {},
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0
    }
  };

  for (const contentType of CONTENT_TYPES) {
    const dimensions = getDimensionCount(contentType);

    // Test with good mock
    const goodMock = GOOD_MOCKS[contentType];
    const goodResult = goodMock ? scoreContentQuality(goodMock.data, contentType) : null;

    // Test with bad mock
    const badMock = BAD_MOCKS[contentType];
    const badResult = badMock ? scoreContentQuality(badMock.data, contentType) : null;

    const typeResult = {
      dimensionCount: dimensions,
      goodMockScore: goodResult?.overall?.toFixed(3) || 'N/A',
      badMockScore: badResult?.overall?.toFixed(3) || 'N/A',
      dimensionsScored: Object.keys(goodResult?.dimensions || {}).length,
      scoreDifferential: goodResult && badResult
        ? (goodResult.overall - badResult.overall).toFixed(3)
        : 'N/A',
      tests: []
    };

    // Test 1: Has enough dimensions (8-12)
    const dimTest = {
      name: 'Dimension count (8-12)',
      passed: dimensions >= 8 && dimensions <= 12,
      actual: dimensions
    };
    typeResult.tests.push(dimTest);
    results.summary.totalTests++;
    if (dimTest.passed) results.summary.passedTests++;
    else results.summary.failedTests++;

    // Test 2: Good mock scores > threshold
    if (goodResult) {
      const goodScoreTest = {
        name: 'Good mock score > ' + (goodMock.expectedMinScore || 0.6),
        passed: goodResult.overall > (goodMock.expectedMinScore || 0.6),
        actual: goodResult.overall.toFixed(3)
      };
      typeResult.tests.push(goodScoreTest);
      results.summary.totalTests++;
      if (goodScoreTest.passed) results.summary.passedTests++;
      else results.summary.failedTests++;
    }

    // Test 3: Bad mock scores < threshold
    if (badResult) {
      const badScoreTest = {
        name: 'Bad mock score < ' + (badMock.expectedMaxScore || 0.4),
        passed: badResult.overall < (badMock.expectedMaxScore || 0.4),
        actual: badResult.overall.toFixed(3)
      };
      typeResult.tests.push(badScoreTest);
      results.summary.totalTests++;
      if (badScoreTest.passed) results.summary.passedTests++;
      else results.summary.failedTests++;
    }

    // Test 4: Score differential > 0.2
    if (goodResult && badResult) {
      const diffTest = {
        name: 'Score differential > 0.2',
        passed: (goodResult.overall - badResult.overall) > 0.2,
        actual: (goodResult.overall - badResult.overall).toFixed(3)
      };
      typeResult.tests.push(diffTest);
      results.summary.totalTests++;
      if (diffTest.passed) results.summary.passedTests++;
      else results.summary.failedTests++;
    }

    // Test 5: All dimensions scored
    if (goodResult) {
      const allScoredTest = {
        name: 'All dimensions scored',
        passed: Object.keys(goodResult.dimensions || {}).length >= dimensions,
        actual: `${Object.keys(goodResult.dimensions || {}).length}/${dimensions}`
      };
      typeResult.tests.push(allScoredTest);
      results.summary.totalTests++;
      if (allScoredTest.passed) results.summary.passedTests++;
      else results.summary.failedTests++;
    }

    // Check if all tests passed for this type
    typeResult.allPassed = typeResult.tests.every(t => t.passed);
    if (!typeResult.allPassed) results.passed = false;

    results.contentTypes[contentType] = typeResult;
  }

  return results;
}

/**
 * Print scoring parity report to console
 *
 * @param {Object} results - Validation results
 */
export function printParityReport(results) {
  console.log('\n========================================');
  console.log('SCORING PARITY VALIDATION REPORT');
  console.log('========================================\n');

  console.log('Summary:');
  console.log(`  Total Tests: ${results.summary.totalTests}`);
  console.log(`  Passed: ${results.summary.passedTests}`);
  console.log(`  Failed: ${results.summary.failedTests}`);
  console.log(`  Overall: ${results.passed ? 'PASSED' : 'FAILED'}\n`);

  console.log('Content Type Results:');
  console.log('----------------------------------------');

  for (const [contentType, typeResult] of Object.entries(results.contentTypes)) {
    console.log(`\n${contentType}:`);
    console.log(`  Dimensions: ${typeResult.dimensionCount}`);
    console.log(`  Good Mock Score: ${typeResult.goodMockScore}`);
    console.log(`  Bad Mock Score: ${typeResult.badMockScore}`);
    console.log(`  Differential: ${typeResult.scoreDifferential}`);
    console.log(`  Status: ${typeResult.allPassed ? 'PASSED' : 'FAILED'}`);

    if (!typeResult.allPassed) {
      console.log('  Failed Tests:');
      typeResult.tests.filter(t => !t.passed).forEach(t => {
        console.log(`    - ${t.name}: ${t.actual}`);
      });
    }
  }

  console.log('\n========================================\n');
}

/**
 * Run comprehensive scoring tests
 *
 * @returns {Object} Test results
 */
export function runScoringTests() {
  const results = {
    parity: validateScoringParity(),
    capabilities: getScoringCapabilities(),
    comparison: null
  };

  // Run comparison across all good mocks
  const goodResults = {};
  for (const contentType of CONTENT_TYPES) {
    const mock = GOOD_MOCKS[contentType];
    if (mock) {
      goodResults[contentType] = scoreContentQuality(mock.data, contentType);
    }
  }
  results.comparison = compareScores(goodResults);

  return results;
}

/**
 * Validate Phase 6 implementation
 *
 * @returns {Object} Validation results
 */
export function validatePhase6() {
  const results = {
    passed: true,
    tests: []
  };

  // Test 1: GOOD_MOCKS exist for all content types
  const allHaveGoodMocks = CONTENT_TYPES.every(ct => GOOD_MOCKS[ct]);
  results.tests.push({
    name: 'All types have good mocks',
    passed: allHaveGoodMocks,
    details: `types=${CONTENT_TYPES.length}, mocks=${Object.keys(GOOD_MOCKS).length}`
  });

  // Test 2: BAD_MOCKS exist for all content types
  const allHaveBadMocks = CONTENT_TYPES.every(ct => BAD_MOCKS[ct]);
  results.tests.push({
    name: 'All types have bad mocks',
    passed: allHaveBadMocks,
    details: `types=${CONTENT_TYPES.length}, mocks=${Object.keys(BAD_MOCKS).length}`
  });

  // Test 3: validateScoringParity runs without error
  let parityResults = null;
  try {
    parityResults = validateScoringParity();
    results.tests.push({
      name: 'validateScoringParity runs',
      passed: parityResults !== null,
      details: `totalTests=${parityResults.summary.totalTests}`
    });
  } catch (error) {
    results.tests.push({
      name: 'validateScoringParity runs',
      passed: false,
      details: `error=${error.message}`
    });
  }

  // Test 4: Good mocks score reasonably
  if (parityResults) {
    const goodScoresOk = Object.values(parityResults.contentTypes).every(r =>
      parseFloat(r.goodMockScore) > 0.4
    );
    results.tests.push({
      name: 'Good mocks score > 0.4',
      passed: goodScoresOk,
      details: `scores=${Object.values(parityResults.contentTypes).map(r => r.goodMockScore).join(', ')}`
    });
  }

  // Test 5: Bad mocks score lower than good
  if (parityResults) {
    const differentiationOk = Object.values(parityResults.contentTypes).every(r =>
      parseFloat(r.scoreDifferential) > 0
    );
    results.tests.push({
      name: 'Good scores > bad scores',
      passed: differentiationOk,
      details: `diffs=${Object.values(parityResults.contentTypes).map(r => r.scoreDifferential).join(', ')}`
    });
  }

  // Test 6: runScoringTests works
  let testResults = null;
  try {
    testResults = runScoringTests();
    results.tests.push({
      name: 'runScoringTests works',
      passed: testResults !== null && testResults.parity !== null,
      details: `hasComparison=${!!testResults.comparison}`
    });
  } catch (error) {
    results.tests.push({
      name: 'runScoringTests works',
      passed: false,
      details: `error=${error.message}`
    });
  }

  // Test 7: Dimension parity (all types have 8-12 dimensions)
  const capabilitiesResult = getScoringCapabilities();
  const dimensionParity = Object.values(capabilitiesResult).every(c =>
    c.dimensionCount >= 8 && c.dimensionCount <= 12
  );
  results.tests.push({
    name: 'Dimension parity (8-12 each)',
    passed: dimensionParity,
    details: `dims=${Object.entries(capabilitiesResult).map(([t, c]) => `${t}:${c.dimensionCount}`).join(', ')}`
  });

  // Test 8: getFeedbackSummary works with test data
  const mockResult = {
    contentType: 'Roadmap',
    dimensions: { test1: 0.8, test2: 0.3 }
  };
  const feedback = getFeedbackSummary(mockResult);
  results.tests.push({
    name: 'getFeedbackSummary works',
    passed: feedback !== null && Array.isArray(feedback.strengths),
    details: `hasStrengths=${Array.isArray(feedback?.strengths)}`
  });

  // Calculate overall pass
  results.passed = results.tests.every(t => t.passed);

  return results;
}

// ============================================================================
// Development validation
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  // Run phase validation
  const phaseValidation = validatePhase6();
  console.log('Scoring Tests Phase 6 Validation:', phaseValidation.passed ? 'PASSED' : 'FAILED');
  if (!phaseValidation.passed) {
    phaseValidation.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  FAILED: ${t.name} - ${t.details}`);
    });
  }

  // Run full parity validation
  console.log('\nRunning full scoring parity validation...');
  const parityResults = validateScoringParity();
  printParityReport(parityResults);
}
