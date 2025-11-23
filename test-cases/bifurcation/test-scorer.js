#!/usr/bin/env node

/**
 * Automated Scoring Script for Bifurcation Style Executive Summaries
 *
 * This script analyzes generated executive summaries against the quality rubric:
 * 1. Reads JSON outputs from outputs/ directory
 * 2. Scores each summary against 8 criteria (1-5 scale)
 * 3. Calculates weighted overall scores
 * 4. Updates test-results-bifurcation.csv
 * 5. Generates analysis report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  OUTPUT_DIR: path.join(__dirname, 'outputs'),
  RESULTS_CSV: path.join(__dirname, 'test-results-bifurcation.csv'),
  ANALYSIS_REPORT: path.join(__dirname, 'test-scoring-analysis.md')
};

// Quality Rubric Criteria with Weights
const RUBRIC = {
  openingHook: {
    name: 'Opening Hook',
    weight: 0.15,
    description: 'Paradox pattern, tension, compelling opening'
  },
  brandedConcepts: {
    name: 'Branded Concepts',
    weight: 0.15,
    description: 'Memorable named concepts (capitalized phrases)'
  },
  specificStats: {
    name: 'Specific Statistics',
    weight: 0.15,
    description: 'Exact numbers, not rounded (260M not "millions")'
  },
  namedCompanies: {
    name: 'Named Companies',
    weight: 0.10,
    description: 'Real organizations mentioned'
  },
  quotableMoments: {
    name: 'Quotable Moments',
    weight: 0.15,
    description: 'Pull-quote ready sentences'
  },
  metaphorConsistency: {
    name: 'Metaphor Consistency',
    weight: 0.10,
    description: 'Single metaphorical system maintained'
  },
  competitiveIntel: {
    name: 'Competitive Intel',
    weight: 0.10,
    description: 'Battlefield analysis, competitive dynamics'
  },
  conclusion: {
    name: 'Conclusion',
    weight: 0.10,
    description: 'Transformation mandate with callback to opening'
  }
};

// Scoring Utilities
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = {
    'INFO': 'ℹ️',
    'SUCCESS': '✅',
    'ERROR': '❌',
    'WARN': '⚠️',
    'ANALYSIS': '📊'
  }[level] || 'ℹ️';

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// Pattern Detection Functions

/**
 * Score Opening Hook (1-5)
 * Looks for: paradox patterns, "while X...reality is Y", tension, drama
 */
function scoreOpeningHook(executiveSummary) {
  const narrative = executiveSummary.strategicNarrative || '';

  // Paradox patterns
  const paradoxPatterns = [
    /while\s+.*?\s+believes?\s+.*?,\s+the\s+reality\s+is/i,
    /conventional\s+wisdom\s+.*?\s+but\s+the\s+truth/i,
    /everyone\s+thinks\s+.*?\s+yet\s+the\s+data/i,
    /the\s+.*?\s+paradox/i,
    /on\s+the\s+surface\s+.*?\s+however/i
  ];

  // Dramatic/theatrical language
  const dramaticTerms = [
    /inflection\s+point/i,
    /tectonic\s+shift/i,
    /battlefield/i,
    /exodus/i,
    /transformation/i,
    /revolution/i,
    /disruption/i
  ];

  let score = 1; // Base score

  // Check for paradox patterns (+2 points)
  const hasParadox = paradoxPatterns.some(pattern => pattern.test(narrative));
  if (hasParadox) score += 2;

  // Check for dramatic language (+1 point)
  const hasDrama = dramaticTerms.some(term => term.test(narrative));
  if (hasDrama) score += 1;

  // Check for compelling first sentence (+1 point)
  const firstSentence = narrative.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length > 50) {
    score += 1;
  }

  return Math.min(score, 5);
}

/**
 * Score Branded Concepts (1-5)
 * Looks for: capitalized named concepts like "The European Mandate", "The APAC Leapfrog"
 */
function scoreBrandedConcepts(executiveSummary) {
  const fullText = JSON.stringify(executiveSummary);

  // Pattern: "The [Capitalized Phrase]" that looks like a branded concept
  const brandedPattern = /The\s+[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g;
  const matches = fullText.match(brandedPattern) || [];

  // Filter out common phrases that aren't branded concepts
  const commonPhrases = ['The United States', 'The Federal Reserve', 'The European Union'];
  const brandedConcepts = matches.filter(match => !commonPhrases.includes(match));

  const count = brandedConcepts.length;

  if (count === 0) return 1;
  if (count === 1) return 2;
  if (count === 2) return 3;
  if (count >= 3 && count <= 4) return 4;
  if (count >= 5) return 5;

  return 1;
}

/**
 * Score Specific Statistics (1-5)
 * Looks for: exact numbers (not rounded), percentages, dollar amounts with precision
 */
function scoreSpecificStats(executiveSummary) {
  const fullText = JSON.stringify(executiveSummary);

  // Patterns for specific statistics
  const specificNumberPatterns = [
    /\$[\d,]+(?:\.\d+)?\s*(?:million|billion|trillion)/gi, // $2.7 billion
    /\d{3,}(?:,\d{3})*(?:\.\d+)?%/g, // 2,727%
    /\d{3,}(?:,\d{3})*\s+(?:transactions|customers|users|accounts)/gi, // 260 million transactions
    /\d+\.\d+%/g, // 18.4%
    /\$\d+(?:,\d{3})+(?:\.\d+)?/g // $127,000,000
  ];

  let specificCount = 0;
  specificNumberPatterns.forEach(pattern => {
    const matches = fullText.match(pattern) || [];
    specificCount += matches.length;
  });

  // Check for rounded numbers (bad)
  const roundedPatterns = [
    /millions?\s+of/gi,
    /billions?\s+of/gi,
    /thousands?\s+of/gi,
    /hundreds?\s+of/gi,
    /around\s+\d+/gi,
    /approximately\s+\d+/gi,
    /roughly\s+\d+/gi
  ];

  let roundedCount = 0;
  roundedPatterns.forEach(pattern => {
    const matches = fullText.match(pattern) || [];
    roundedCount += matches.length;
  });

  // Scoring
  const ratio = roundedCount > 0 ? specificCount / roundedCount : specificCount;

  if (specificCount === 0) return 1;
  if (specificCount <= 3) return 2;
  if (specificCount <= 6 && roundedCount <= 1) return 3;
  if (specificCount >= 7 && roundedCount === 0) return 4;
  if (specificCount >= 10 && roundedCount === 0) return 5;

  return Math.max(1, Math.min(5, Math.floor(ratio + 1)));
}

/**
 * Score Named Companies (1-5)
 * Looks for: real organization names (JPMorgan, Wells Fargo, etc.)
 */
function scoreNamedCompanies(executiveSummary) {
  const fullText = JSON.stringify(executiveSummary);

  // Common company patterns
  const companyPatterns = [
    /JPMorgan\s+Chase/gi,
    /JPMorgan/gi,
    /Wells\s+Fargo/gi,
    /Bank\s+of\s+America/gi,
    /Goldman\s+Sachs/gi,
    /Morgan\s+Stanley/gi,
    /Citigroup/gi,
    /Citibank/gi,
    /HSBC/gi,
    /Barclays/gi,
    /Deutsche\s+Bank/gi,
    /UBS/gi,
    /Credit\s+Suisse/gi,
    /Stripe/gi,
    /PayPal/gi,
    /Square/gi,
    /Shopify/gi,
    /Amazon/gi,
    /Apple/gi,
    /Google/gi,
    /Microsoft/gi,
    /Meta/gi,
    /Tesla/gi,
    /Uber/gi,
    /Visa/gi,
    /Mastercard/gi
  ];

  const uniqueCompanies = new Set();
  companyPatterns.forEach(pattern => {
    const matches = fullText.match(pattern) || [];
    if (matches.length > 0) {
      uniqueCompanies.add(pattern.source.toLowerCase());
    }
  });

  const count = uniqueCompanies.size;

  if (count === 0) return 1;
  if (count === 1) return 2;
  if (count === 2) return 3;
  if (count >= 3 && count <= 4) return 4;
  if (count >= 5) return 5;

  return 1;
}

/**
 * Score Quotable Moments (1-5)
 * Looks for: pull-quote ready sentences (short, punchy, memorable)
 */
function scoreQuotableMoments(executiveSummary) {
  const narrative = executiveSummary.strategicNarrative || '';
  const insights = executiveSummary.expertInsights || [];

  // Combine all text
  const allText = narrative + ' ' + insights.map(i => i.insight || '').join(' ');
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Quotable characteristics:
  // - Length: 50-150 characters
  // - Contains power words
  // - Has specific numbers or names
  // - Dramatic/memorable phrasing

  const powerWords = [
    /inflection/i, /tectonic/i, /battlefield/i, /exodus/i,
    /transformation/i, /disruption/i, /revolution/i, /mandate/i,
    /window\s+closes/i, /race\s+to/i, /war\s+for/i, /shift\s+to/i
  ];

  let quotableCount = 0;

  sentences.forEach(sentence => {
    const trimmed = sentence.trim();
    const length = trimmed.length;

    if (length >= 50 && length <= 150) {
      // Check for power words
      const hasPowerWord = powerWords.some(word => word.test(trimmed));
      // Check for specific numbers
      const hasNumber = /\d{2,}/.test(trimmed);
      // Check for dramatic structure
      const hasDrama = /—/.test(trimmed) || trimmed.split(',').length >= 2;

      if ((hasPowerWord && hasNumber) || (hasPowerWord && hasDrama)) {
        quotableCount++;
      }
    }
  });

  if (quotableCount === 0) return 1;
  if (quotableCount === 1) return 2;
  if (quotableCount === 2) return 3;
  if (quotableCount >= 3 && quotableCount <= 4) return 4;
  if (quotableCount >= 5) return 5;

  return 1;
}

/**
 * Score Metaphor Consistency (1-5)
 * Looks for: single metaphorical system maintained throughout
 */
function scoreMetaphorConsistency(executiveSummary) {
  const fullText = JSON.stringify(executiveSummary).toLowerCase();

  // Common metaphor families
  const metaphorFamilies = {
    war: ['battlefield', 'combat', 'strategy', 'offensive', 'defensive', 'victory', 'defeat', 'weapons', 'arsenal'],
    journey: ['path', 'roadmap', 'journey', 'destination', 'milestone', 'waypoint', 'route', 'navigate'],
    building: ['foundation', 'architecture', 'blueprint', 'construct', 'pillar', 'framework', 'scaffold'],
    nature: ['ecosystem', 'evolution', 'organic', 'growth', 'seed', 'harvest', 'cultivate'],
    race: ['race', 'sprint', 'marathon', 'pace', 'velocity', 'acceleration', 'finish line'],
    ocean: ['waves', 'tide', 'current', 'navigate', 'storm', 'harbor', 'vessel', 'ferry', 'rails']
  };

  const familyCounts = {};

  Object.keys(metaphorFamilies).forEach(family => {
    const terms = metaphorFamilies[family];
    let count = 0;
    terms.forEach(term => {
      if (fullText.includes(term)) count++;
    });
    if (count > 0) familyCounts[family] = count;
  });

  const familiesUsed = Object.keys(familyCounts).length;
  const totalMetaphors = Object.values(familyCounts).reduce((a, b) => a + b, 0);

  // Scoring based on consistency
  if (totalMetaphors === 0) return 1; // No metaphors
  if (familiesUsed === 1) return 5; // Perfect consistency
  if (familiesUsed === 2 && totalMetaphors >= 4) return 4; // Mostly consistent
  if (familiesUsed === 2 && totalMetaphors < 4) return 3; // Some mixing
  if (familiesUsed === 3) return 2; // Too much mixing
  if (familiesUsed > 3) return 1; // Incoherent

  return 3;
}

/**
 * Score Competitive Intel (1-5)
 * Looks for: competitive intelligence section, battlefield analysis
 */
function scoreCompetitiveIntel(executiveSummary) {
  const compIntel = executiveSummary.competitiveIntelligence || {};

  let score = 1;

  // Check if competitive intelligence section exists
  if (Object.keys(compIntel).length === 0) return 1;

  // Check for key fields
  if (compIntel.marketTiming) score += 1;
  if (compIntel.competitorMoves && compIntel.competitorMoves.length > 0) score += 1;
  if (compIntel.competitiveAdvantage) score += 1;
  if (compIntel.marketWindow) score += 1;

  return Math.min(score, 5);
}

/**
 * Score Conclusion (1-5)
 * Looks for: transformation mandate with callback to opening
 */
function scoreConclusion(executiveSummary) {
  const narrative = executiveSummary.strategicNarrative || '';

  // Get last 2 paragraphs (conclusion)
  const paragraphs = narrative.split(/\n\n+/).filter(p => p.trim().length > 0);
  const conclusion = paragraphs.slice(-2).join(' ');

  let score = 1;

  if (conclusion.length === 0) return 1;

  // Check for transformation mandate language
  const mandatePatterns = [
    /must\s+(?:act|move|transform|adapt)/i,
    /imperative\s+to/i,
    /no\s+choice\s+but\s+to/i,
    /window\s+(?:closes|closing)/i,
    /time\s+to\s+(?:act|move|decide)/i,
    /deadline/i
  ];

  const hasMandate = mandatePatterns.some(pattern => pattern.test(conclusion));
  if (hasMandate) score += 2;

  // Check for callback (references to earlier themes)
  const callbackPatterns = [
    /as\s+(?:mentioned|discussed|noted)/i,
    /returning\s+to/i,
    /this\s+brings\s+us\s+back/i,
    /circle\s+back/i
  ];

  const hasCallback = callbackPatterns.some(pattern => pattern.test(conclusion));
  if (hasCallback) score += 1;

  // Check for specific action items
  const hasActions = /\d+[-–—]\s*[A-Z]/.test(conclusion); // Numbered list pattern
  if (hasActions) score += 1;

  return Math.min(score, 5);
}

/**
 * Score a single executive summary
 */
function scoreExecutiveSummary(executiveSummary, testCaseId) {
  log(`Scoring ${testCaseId}...`, 'ANALYSIS');

  const scores = {
    openingHook: scoreOpeningHook(executiveSummary),
    brandedConcepts: scoreBrandedConcepts(executiveSummary),
    specificStats: scoreSpecificStats(executiveSummary),
    namedCompanies: scoreNamedCompanies(executiveSummary),
    quotableMoments: scoreQuotableMoments(executiveSummary),
    metaphorConsistency: scoreMetaphorConsistency(executiveSummary),
    competitiveIntel: scoreCompetitiveIntel(executiveSummary),
    conclusion: scoreConclusion(executiveSummary)
  };

  // Calculate weighted overall score
  let overallScore = 0;
  Object.keys(scores).forEach(criterion => {
    const weight = RUBRIC[criterion].weight;
    overallScore += scores[criterion] * weight;
  });

  return {
    scores,
    overallScore: Math.round(overallScore * 100) / 100 // Round to 2 decimals
  };
}

/**
 * Read and score all test outputs
 */
async function scoreAllOutputs() {
  log('Starting automated scoring...', 'INFO');

  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    log('Outputs directory not found. Run test-executor.js first.', 'ERROR');
    process.exit(1);
  }

  const outputFiles = fs.readdirSync(CONFIG.OUTPUT_DIR)
    .filter(file => file.endsWith('-output.json'))
    .sort();

  if (outputFiles.length === 0) {
    log('No output files found. Run test-executor.js first.', 'ERROR');
    process.exit(1);
  }

  log(`Found ${outputFiles.length} output files to score`, 'INFO');

  const results = [];

  for (const filename of outputFiles) {
    const filePath = path.join(CONFIG.OUTPUT_DIR, filename);
    const testCaseId = filename.replace('-output.json', '');

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (!data.executiveSummary) {
        log(`${testCaseId}: No executive summary found`, 'WARN');
        results.push({
          testCaseId,
          error: 'No executive summary in output',
          scores: null,
          overallScore: 0
        });
        continue;
      }

      const result = scoreExecutiveSummary(data.executiveSummary, testCaseId);
      results.push({
        testCaseId,
        ...result
      });

      log(`${testCaseId}: Overall Score = ${result.overallScore.toFixed(2)}`, 'SUCCESS');

    } catch (error) {
      log(`${testCaseId}: Error scoring - ${error.message}`, 'ERROR');
      results.push({
        testCaseId,
        error: error.message,
        scores: null,
        overallScore: 0
      });
    }
  }

  return results;
}

/**
 * Update CSV with scores
 */
function updateCSV(results) {
  log('Updating test-results-bifurcation.csv...', 'INFO');

  // Read existing CSV
  let csvContent = '';
  if (fs.existsSync(CONFIG.RESULTS_CSV)) {
    csvContent = fs.readFileSync(CONFIG.RESULTS_CSV, 'utf-8');
  } else {
    // Create header
    csvContent = 'Test Case,Industry,File Count,Word Count,Complexity,Generation Time (s),Opening Hook,Branded Concepts,Specific Stats,Named Companies,Quotable Moments,Metaphor Consistency,Competitive Intel,Conclusion,Overall Score,Notes\n';
  }

  const lines = csvContent.split('\n').filter(line => line.trim());
  const header = lines[0];
  const dataLines = lines.slice(1);

  // Create lookup of existing rows
  const existingRows = {};
  dataLines.forEach(line => {
    const testCase = line.split(',')[0];
    existingRows[testCase] = line;
  });

  // Update with scores
  results.forEach(result => {
    const { testCaseId, scores, overallScore, error } = result;

    if (error) {
      // Add error note
      if (existingRows[testCaseId]) {
        const parts = existingRows[testCaseId].split(',');
        parts[parts.length - 1] = `ERROR: ${error}`;
        existingRows[testCaseId] = parts.join(',');
      }
    } else if (scores) {
      // Update scores
      if (existingRows[testCaseId]) {
        const parts = existingRows[testCaseId].split(',');
        // Insert scores at positions 6-13
        parts[6] = scores.openingHook;
        parts[7] = scores.brandedConcepts;
        parts[8] = scores.specificStats;
        parts[9] = scores.namedCompanies;
        parts[10] = scores.quotableMoments;
        parts[11] = scores.metaphorConsistency;
        parts[12] = scores.competitiveIntel;
        parts[13] = scores.conclusion;
        parts[14] = overallScore.toFixed(2);
        existingRows[testCaseId] = parts.join(',');
      }
    }
  });

  // Rebuild CSV
  const updatedLines = [header, ...Object.values(existingRows)];
  fs.writeFileSync(CONFIG.RESULTS_CSV, updatedLines.join('\n') + '\n');

  log('CSV updated successfully', 'SUCCESS');
}

/**
 * Generate analysis report
 */
function generateAnalysisReport(results) {
  log('Generating analysis report...', 'INFO');

  const validResults = results.filter(r => r.scores && !r.error);

  if (validResults.length === 0) {
    log('No valid results to analyze', 'WARN');
    return;
  }

  // Calculate statistics
  const avgScores = {};
  Object.keys(RUBRIC).forEach(criterion => {
    const scores = validResults.map(r => r.scores[criterion]);
    avgScores[criterion] = scores.reduce((a, b) => a + b, 0) / scores.length;
  });

  const overallScores = validResults.map(r => r.overallScore);
  const avgOverall = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;
  const minOverall = Math.min(...overallScores);
  const maxOverall = Math.max(...overallScores);

  // Identify strengths and weaknesses
  const criteriaByScore = Object.keys(avgScores)
    .map(key => ({ criterion: key, score: avgScores[key], name: RUBRIC[key].name }))
    .sort((a, b) => b.score - a.score);

  const strengths = criteriaByScore.slice(0, 3);
  const weaknesses = criteriaByScore.slice(-3);

  // Generate report
  const report = `# Bifurcation Style Test Scoring Analysis

**Generated:** ${new Date().toISOString()}

## Summary

- **Test Cases Scored:** ${validResults.length} / ${results.length}
- **Average Overall Score:** ${avgOverall.toFixed(2)} / 5.00
- **Score Range:** ${minOverall.toFixed(2)} - ${maxOverall.toFixed(2)}
- **Target:** 4.0 (${avgOverall >= 4.0 ? '✅ ACHIEVED' : '⚠️ NOT ACHIEVED'})

## Individual Test Case Scores

| Test Case | Overall Score | Status |
|-----------|---------------|--------|
${validResults.map(r => `| ${r.testCaseId} | ${r.overallScore.toFixed(2)} | ${r.overallScore >= 4.0 ? '✅' : r.overallScore >= 3.5 ? '⚠️' : '❌'} |`).join('\n')}

## Criteria Breakdown

### Average Scores by Criterion

| Criterion | Avg Score | Weight | Contribution |
|-----------|-----------|--------|--------------|
${Object.keys(RUBRIC).map(key => {
  const criterion = RUBRIC[key];
  const avgScore = avgScores[key];
  const contribution = (avgScore * criterion.weight).toFixed(2);
  return `| ${criterion.name} | ${avgScore.toFixed(2)} | ${(criterion.weight * 100).toFixed(0)}% | ${contribution} |`;
}).join('\n')}

### Top 3 Strengths

${strengths.map((s, idx) => `${idx + 1}. **${s.name}** - ${s.score.toFixed(2)} / 5.00
   - ${RUBRIC[s.criterion].description}`).join('\n\n')}

### Top 3 Weaknesses

${weaknesses.map((s, idx) => `${idx + 1}. **${s.name}** - ${s.score.toFixed(2)} / 5.00
   - ${RUBRIC[s.criterion].description}
   - **Recommendation:** ${getRecommendation(s.criterion, s.score)}`).join('\n\n')}

## Detailed Criterion Analysis

${Object.keys(RUBRIC).map(key => {
  const criterion = RUBRIC[key];
  const avgScore = avgScores[key];
  const scores = validResults.map(r => r.scores[key]);
  const distribution = [1, 2, 3, 4, 5].map(score => {
    const count = scores.filter(s => s === score).length;
    return `${score}: ${'█'.repeat(count)}${' '.repeat(validResults.length - count)} (${count})`;
  }).join('\n  ');

  return `### ${criterion.name}

**Average:** ${avgScore.toFixed(2)} / 5.00
**Weight:** ${(criterion.weight * 100).toFixed(0)}%
**Description:** ${criterion.description}

**Score Distribution:**
  ${distribution}
`;
}).join('\n')}

## Recommendations

${avgOverall >= 4.0 ? `
### ✅ Target Achieved

The bifurcation style implementation has successfully achieved the target overall score of 4.0+.

**Next Steps:**
1. Proceed to Phase 3: Soft Launch
2. Monitor real-world usage for edge cases
3. Gather user feedback on style effectiveness
` : `
### ⚠️ Prompt Iteration Required

The average overall score (${avgOverall.toFixed(2)}) is below the target of 4.0. Prompt refinement is recommended.

**Priority Areas for Improvement:**
${weaknesses.map(w => `- **${w.name}** (${w.score.toFixed(2)}): ${getRecommendation(w.criterion, w.score)}`).join('\n')}

**Action Plan:**
1. Update EXECUTIVE_SUMMARY_GENERATION_PROMPT in server/prompts.js
2. Focus on weakest criteria (listed above)
3. Re-test on subset (3-5 test cases)
4. Re-run full test suite if subset shows improvement
`}

## Error Cases

${results.filter(r => r.error).length > 0 ? `
The following test cases encountered errors:

${results.filter(r => r.error).map(r => `- **${r.testCaseId}:** ${r.error}`).join('\n')}
` : '_No errors encountered._'}

---

**Report End**
`;

  fs.writeFileSync(CONFIG.ANALYSIS_REPORT, report);
  log(`Analysis report saved to: ${CONFIG.ANALYSIS_REPORT}`, 'SUCCESS');
}

/**
 * Get recommendation for improving a criterion
 */
function getRecommendation(criterion, score) {
  const recommendations = {
    openingHook: 'Add more paradox patterns ("While X believes Y, the reality is Z"). Start with tension or surprise.',
    brandedConcepts: 'Create 3-5 memorable capitalized phrases (e.g., "The European Mandate", "The APAC Leapfrog").',
    specificStats: 'Use exact numbers, not rounded. "260 million" not "millions". Include percentages with decimals.',
    namedCompanies: 'Reference real organizations (JPMorgan, Wells Fargo, etc.) instead of "a major bank".',
    quotableMoments: 'Craft 3-5 pull-quote ready sentences (50-150 chars) with dramatic language and specific data.',
    metaphorConsistency: 'Choose ONE metaphorical system (war, journey, race, ocean) and maintain it throughout.',
    competitiveIntel: 'Ensure competitive intelligence section has all 4 fields: marketTiming, competitorMoves, competitiveAdvantage, marketWindow.',
    conclusion: 'End with transformation mandate and callback to opening. Include specific deadlines and action items.'
  };

  return recommendations[criterion] || 'Review rubric criteria and strengthen this area.';
}

/**
 * Main execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  scoreAllOutputs()
    .then(results => {
      updateCSV(results);
      generateAnalysisReport(results);

      const validResults = results.filter(r => !r.error);
      const avgScore = validResults.length > 0
        ? validResults.reduce((sum, r) => sum + r.overallScore, 0) / validResults.length
        : 0;

      log(`\n${'='.repeat(80)}`, 'INFO');
      log('SCORING COMPLETE', 'SUCCESS');
      log(`${'='.repeat(80)}`, 'INFO');
      log(`Average Overall Score: ${avgScore.toFixed(2)} / 5.00`, avgScore >= 4.0 ? 'SUCCESS' : 'WARN');
      log(`Target: 4.0 - ${avgScore >= 4.0 ? '✅ ACHIEVED' : '⚠️ NOT ACHIEVED'}`, avgScore >= 4.0 ? 'SUCCESS' : 'WARN');
      log(`Results: ${CONFIG.RESULTS_CSV}`, 'INFO');
      log(`Analysis: ${CONFIG.ANALYSIS_REPORT}`, 'INFO');
      log(`${'='.repeat(80)}\n`, 'INFO');

      process.exit(avgScore >= 4.0 ? 0 : 1);
    })
    .catch(error => {
      log(`Fatal error: ${error.message}`, 'ERROR');
      console.error(error);
      process.exit(1);
    });
}

export { scoreExecutiveSummary, scoreAllOutputs };
