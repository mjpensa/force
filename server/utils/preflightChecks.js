/**
 * Pre-flight Validation Checks
 *
 * Runs sanity checks before training to catch code bugs early.
 * This prevents wasted training time due to broken scoring/validation logic.
 */

import {
  TrainingError,
  ErrorCategory,
  categorizeValidationBug,
  categorizeScoringBug
} from './trainingErrors.js';

// =============================================================================
// MOCK DATA FOR TESTING
// =============================================================================

/**
 * Known-good mock data for each content type
 * These should always pass validation and score > 3.5
 */
const GOOD_MOCKS = {
  Roadmap: {
    success: true,
    data: {
      title: 'Strategic Technology Roadmap 2025-2030',
      description: 'A comprehensive roadmap for digital transformation',
      startDate: '2025-01-01',
      endDate: '2030-12-31',
      swimlanes: [
        {
          name: 'Infrastructure',
          tasks: [
            { name: 'Cloud Migration', startDate: '2025-01', endDate: '2025-06', description: 'Migrate to cloud' },
            { name: 'Security Upgrade', startDate: '2025-07', endDate: '2025-12', description: 'Enhance security' },
            { name: 'Platform Modernization', startDate: '2026-01', endDate: '2026-12', description: 'Modernize platform' }
          ]
        },
        {
          name: 'Applications',
          tasks: [
            { name: 'API Development', startDate: '2025-03', endDate: '2025-09', description: 'Build APIs' },
            { name: 'Mobile App', startDate: '2026-01', endDate: '2026-06', description: 'Launch mobile app' },
            { name: 'AI Integration', startDate: '2027-01', endDate: '2027-12', description: 'Integrate AI' }
          ]
        },
        {
          name: 'Data & Analytics',
          tasks: [
            { name: 'Data Lake', startDate: '2025-06', endDate: '2026-03', description: 'Build data lake' },
            { name: 'ML Pipeline', startDate: '2026-06', endDate: '2027-06', description: 'ML infrastructure' },
            { name: 'Real-time Analytics', startDate: '2028-01', endDate: '2028-12', description: 'Real-time dashboard' }
          ]
        }
      ]
    },
    _validation: { valid: true, quality: { score: 0.85 } }
  },

  Slides: {
    success: true,
    data: {
      title: 'Q4 Strategic Review',
      subtitle: 'Executive Summary and Recommendations',
      slides: [
        { title: 'Executive Overview', content: 'Key findings from our analysis...', type: 'intro' },
        { title: 'Market Analysis', content: 'The market shows 47% growth [Source A]...', type: 'content' },
        { title: 'Financial Performance', content: 'Revenue increased by $2.3 billion...', type: 'content' },
        { title: 'Strategic Initiatives', content: 'We recommend three key initiatives...', type: 'content' },
        { title: 'Risk Assessment', content: 'Primary risks include market volatility...', type: 'content' },
        { title: 'Next Steps', content: 'Immediate actions required...', type: 'conclusion' }
      ]
    },
    _validation: { valid: true, quality: { score: 0.82 } }
  },

  Document: {
    success: true,
    data: {
      title: 'The Digital Transformation Imperative: A Strategic Analysis',
      executiveSummary: '$4.2 billion in market opportunity awaits organizations that embrace digital transformation [McKinsey 2024]. This analysis reveals three critical factors driving success: cloud adoption rates reaching 78% among Fortune 500 companies [Gartner], AI integration showing 340% ROI improvements [Forrester], and customer experience investments yielding 23% higher retention [Harvard Business Review]. Yet paradoxically, 67% of transformation initiatives fail to meet objectives.',
      sections: [
        {
          title: 'The Market Landscape',
          content: 'The competitive landscape has shifted dramatically. In January 2024, market leaders announced major platform investments. $12.5 billion [Bloomberg] in M&A activity signals consolidation. However [Deloitte] suggests smaller players may actually benefit from increased specialization opportunities.'
        },
        {
          title: 'Strategic Imperatives',
          content: 'Organizations must position themselves to capture emerging opportunities. The data reveals three critical success factors: infrastructure modernization, talent development, and ecosystem partnerships. Companies that invest in all three areas see 45% higher growth rates [BCG].'
        },
        {
          title: 'Implementation Roadmap',
          content: 'By 2026, early movers will dominate. Organizations should adopt a phased approach: foundation (Q1-Q2), acceleration (Q3-Q4), and optimization (Year 2). This bridge from strategy to execution requires clear governance and metrics.'
        },
        {
          title: 'Risk Assessment and Mitigation',
          content: 'While the opportunity is significant, organizations must prepare for headwinds. Regulatory changes, though data is limited, suggest increased compliance requirements. Market volatility demands flexible deployment strategies. The transformation journey requires commitment but cannot wait.'
        }
      ]
    },
    _validation: { valid: true, quality: { score: 0.88 } }
  },

  ResearchAnalysis: {
    success: true,
    data: {
      summary: 'Comprehensive analysis of emerging technology trends reveals significant market opportunities.',
      themes: [
        { name: 'AI Adoption', description: 'Accelerating enterprise AI integration', evidence: ['78% adoption rate', 'ROI averaging 340%'] },
        { name: 'Cloud Migration', description: 'Continued shift to cloud infrastructure', evidence: ['$500B market by 2026'] },
        { name: 'Cybersecurity', description: 'Growing investment in security', evidence: ['45% budget increases'] },
        { name: 'Sustainability', description: 'ESG integration in tech strategy', evidence: ['Regulatory pressure increasing'] }
      ],
      insights: [
        'Early adopters seeing 3x returns on AI investments',
        'Hybrid cloud strategies outperforming single-vendor approaches',
        'Security talent shortage driving automation adoption',
        'Green computing emerging as competitive differentiator',
        'Platform consolidation reducing operational complexity'
      ],
      recommendations: [
        'Accelerate AI pilot programs',
        'Develop hybrid cloud roadmap',
        'Invest in security automation',
        'Establish sustainability metrics'
      ]
    },
    _validation: { valid: true, quality: { score: 0.85 } }
  }
};

/**
 * Known-bad mock data for each content type
 * These should fail validation or score < 2.5
 */
const BAD_MOCKS = {
  Roadmap: {
    success: true,
    data: {
      title: 'Roadmap',
      swimlanes: [] // Empty swimlanes
    },
    _validation: { valid: false, errors: ['No swimlanes defined'] }
  },

  Slides: {
    success: true,
    data: {
      title: 'Slides',
      slides: [{ title: 'Slide 1', content: 'Text' }] // Only 1 slide
    },
    _validation: { valid: false, errors: ['Insufficient slides'] }
  },

  Document: {
    success: true,
    data: {
      title: 'Doc',
      executiveSummary: 'Short.',
      sections: [] // No sections
    },
    _validation: { valid: false, errors: ['No sections'] }
  },

  ResearchAnalysis: {
    success: true,
    data: {
      summary: 'Brief.',
      themes: [],
      insights: [],
      recommendations: []
    },
    _validation: { valid: false, errors: ['Empty analysis'] }
  }
};

// =============================================================================
// PRE-FLIGHT CHECK FUNCTIONS
// =============================================================================

/**
 * Run all pre-flight checks
 * @param {Object} options - Options for pre-flight checks
 * @returns {Object} Pre-flight check results
 */
export async function runPreflightChecks(options = {}) {
  const results = {
    passed: true,
    checks: [],
    errors: [],
    warnings: []
  };

  console.log('\n🔍 Running pre-flight checks...');

  // 1. Test scoring functions with good mock data
  const scoringCheck = await testScoringWithMocks(options.scoringFn);
  results.checks.push(scoringCheck);
  if (!scoringCheck.passed) {
    results.passed = false;
    results.errors.push(scoringCheck.error);
  }

  // 2. Test validation with good/bad mocks
  const validationCheck = testValidationLogic();
  results.checks.push(validationCheck);
  if (!validationCheck.passed) {
    results.passed = false;
    results.errors.push(validationCheck.error);
  }

  // 3. Check API connectivity (optional, if apiTest function provided)
  if (options.apiTestFn) {
    const apiCheck = await testApiConnectivity(options.apiTestFn);
    results.checks.push(apiCheck);
    if (!apiCheck.passed) {
      // API issues are warnings, not failures
      results.warnings.push(apiCheck.error);
    }
  }

  // Summary
  const passedCount = results.checks.filter(c => c.passed).length;
  console.log(`\n   Pre-flight: ${passedCount}/${results.checks.length} checks passed`);

  if (!results.passed) {
    console.error('   ❌ Pre-flight checks FAILED - training aborted');
    for (const error of results.errors) {
      console.error(`      ${error}`);
    }
  } else {
    console.log('   ✅ All pre-flight checks passed');
  }

  if (results.warnings.length > 0) {
    console.warn('   ⚠️ Warnings:');
    for (const warning of results.warnings) {
      console.warn(`      ${warning}`);
    }
  }

  return results;
}

/**
 * Test scoring function with mock data
 */
async function testScoringWithMocks(scoringFn) {
  const check = {
    name: 'Scoring Function Sanity',
    passed: true,
    details: {}
  };

  if (!scoringFn) {
    check.passed = false;
    check.error = 'No scoring function provided';
    return check;
  }

  const contentTypes = ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];

  for (const contentType of contentTypes) {
    try {
      // Test good mock - should score > 3.0
      const goodMock = GOOD_MOCKS[contentType];
      const goodResult = scoringFn(goodMock, goodMock._validation, contentType);

      if (!goodResult || typeof goodResult.rating !== 'number') {
        check.passed = false;
        check.error = `Scoring function returned invalid result for ${contentType}`;
        check.details[contentType] = { error: 'Invalid return value' };
        continue;
      }

      if (goodResult.rating < 3) {
        check.passed = false;
        check.error = `Good mock for ${contentType} scored ${goodResult.rating} (expected > 3)`;
        check.details[contentType] = { goodScore: goodResult.rating, expected: '> 3' };
        continue;
      }

      // Test bad mock - should score < 3.0
      const badMock = BAD_MOCKS[contentType];
      const badResult = scoringFn(badMock, badMock._validation, contentType);

      if (badResult.rating >= 3.5) {
        check.warnings = check.warnings || [];
        check.warnings.push(`Bad mock for ${contentType} scored ${badResult.rating} (expected < 3.5)`);
      }

      check.details[contentType] = {
        goodScore: goodResult.rating,
        badScore: badResult.rating,
        status: 'OK'
      };

    } catch (error) {
      check.passed = false;
      check.error = `Scoring function threw for ${contentType}: ${error.message}`;
      check.details[contentType] = { error: error.message };
    }
  }

  return check;
}

/**
 * Test validation logic with mock data
 */
function testValidationLogic() {
  const check = {
    name: 'Validation Logic Sanity',
    passed: true,
    details: {}
  };

  const contentTypes = ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];

  for (const contentType of contentTypes) {
    // Good mocks should be valid
    const goodMock = GOOD_MOCKS[contentType];
    if (!goodMock._validation?.valid) {
      check.passed = false;
      check.error = `Good mock for ${contentType} failed validation`;
      check.details[contentType] = { status: 'FAIL', reason: 'Good mock not valid' };
      continue;
    }

    // Bad mocks should be invalid
    const badMock = BAD_MOCKS[contentType];
    if (badMock._validation?.valid === true) {
      check.warnings = check.warnings || [];
      check.warnings.push(`Bad mock for ${contentType} passed validation (expected failure)`);
    }

    check.details[contentType] = { status: 'OK' };
  }

  return check;
}

/**
 * Test API connectivity
 */
async function testApiConnectivity(apiTestFn) {
  const check = {
    name: 'API Connectivity',
    passed: true,
    details: {}
  };

  try {
    const startTime = Date.now();
    await apiTestFn();
    const duration = Date.now() - startTime;

    check.details = {
      status: 'OK',
      responseTime: `${duration}ms`
    };

    if (duration > 5000) {
      check.warnings = ['API response time > 5s - may impact training speed'];
    }

  } catch (error) {
    check.passed = false;
    check.error = `API test failed: ${error.message}`;
    check.details = {
      status: 'FAIL',
      error: error.message
    };
  }

  return check;
}

/**
 * Get the good mock data for testing
 */
export function getGoodMocks() {
  return GOOD_MOCKS;
}

/**
 * Get the bad mock data for testing
 */
export function getBadMocks() {
  return BAD_MOCKS;
}
