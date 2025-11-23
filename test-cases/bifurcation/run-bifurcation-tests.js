#!/usr/bin/env node

/**
 * Master Test Runner for Bifurcation Style Implementation
 *
 * This script orchestrates the complete testing workflow:
 * 1. Executes all test cases (test-executor.js)
 * 2. Scores outputs against quality rubric (test-scorer.js)
 * 3. Generates comprehensive reports
 * 4. Provides progress updates and final summary
 *
 * Usage:
 *   npm install                    # Install dependencies first
 *   node run-bifurcation-tests.js  # Run complete test suite
 */

import { executeAllTestCases } from './test-executor.js';
import { scoreAllOutputs } from './test-scorer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  RESULTS_CSV: path.join(__dirname, 'test-results-bifurcation.csv'),
  EXECUTION_RESULTS: path.join(__dirname, 'test-execution-results.json'),
  SCORING_ANALYSIS: path.join(__dirname, 'test-scoring-analysis.md'),
  FINAL_REPORT: path.join(__dirname, 'BIFURCATION_TEST_REPORT.md')
};

// Utility functions
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = {
    'INFO': 'ℹ️',
    'SUCCESS': '✅',
    'ERROR': '❌',
    'WARN': '⚠️',
    'PROGRESS': '⏳',
    'ANALYSIS': '📊'
  }[level] || 'ℹ️';

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function printHeader(title) {
  const border = '='.repeat(80);
  console.log(`\n${border}`);
  console.log(`  ${title}`);
  console.log(`${border}\n`);
}

function printSection(title) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(80)}\n`);
}

/**
 * Check prerequisites before running tests
 */
function checkPrerequisites() {
  printSection('Checking Prerequisites');

  // Check if test case files exist
  const requiredFiles = [
    'TC-01-banking-simple.md',
    'TC-02-banking-multi-source-file1.md',
    'TC-04-healthcare-simple.md',
    'TC-06-finance-simple.md',
    'TC-09-banking-sparse.md'
  ];

  let allFilesExist = true;
  requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      log(`Missing test case file: ${file}`, 'ERROR');
      allFilesExist = false;
    }
  });

  if (!allFilesExist) {
    log('Some test case files are missing. Please create them first.', 'ERROR');
    return false;
  }

  log('All test case files found', 'SUCCESS');

  // Check if server is running (optional - test will fail gracefully if not)
  log('Note: Ensure server is running on http://localhost:3000', 'WARN');
  log('Start server with: npm start', 'INFO');

  return true;
}

/**
 * Generate final comprehensive report
 */
function generateFinalReport(executionSummary, scoringResults) {
  printSection('Generating Final Report');

  const validResults = scoringResults.filter(r => !r.error);
  const avgScore = validResults.length > 0
    ? validResults.reduce((sum, r) => sum + r.overallScore, 0) / validResults.length
    : 0;

  const passed = avgScore >= 4.0;

  const report = `# Bifurcation Style Implementation - Test Report

**Test Run Date:** ${new Date().toISOString()}
**Status:** ${passed ? '✅ PASSED' : '⚠️ NEEDS ITERATION'}

---

## Executive Summary

${passed ? `
The bifurcation style implementation has successfully achieved the target quality threshold.

**Overall Score:** ${avgScore.toFixed(2)} / 5.00 (Target: 4.0) ✅

**Recommendation:** Proceed to Phase 3 (Soft Launch)
` : `
The bifurcation style implementation requires further refinement to achieve the target quality threshold.

**Overall Score:** ${avgScore.toFixed(2)} / 5.00 (Target: 4.0) ⚠️

**Recommendation:** Iterate on prompt based on weaknesses identified in scoring analysis, then re-test.
`}

---

## Test Execution Summary

- **Total Test Cases:** ${executionSummary.totalTestCases}
- **Successful Executions:** ${executionSummary.successCount}
- **Failed Executions:** ${executionSummary.failureCount}
- **Success Rate:** ${executionSummary.successRate}

### Execution Results

| Test Case | Status | Generation Time | Summary Size |
|-----------|--------|-----------------|--------------|
${executionSummary.results.map(r => `| ${r.testCaseId} | ${r.success ? '✅' : '❌'} | ${r.generationTime || 'N/A'}s | ${r.summarySize ? (r.summarySize / 1024).toFixed(1) + ' KB' : 'N/A'} |`).join('\n')}

${executionSummary.failureCount > 0 ? `
### Failed Test Cases

${executionSummary.results.filter(r => !r.success).map(r => `- **${r.testCaseId}:** ${r.error}`).join('\n')}
` : ''}

---

## Quality Scoring Summary

- **Test Cases Scored:** ${validResults.length} / ${scoringResults.length}
- **Average Overall Score:** ${avgScore.toFixed(2)} / 5.00
- **Target:** 4.0 ${passed ? '✅' : '⚠️'}

### Individual Scores

| Test Case | Overall Score | Status | Notes |
|-----------|---------------|--------|-------|
${scoringResults.map(r => {
  const status = r.error ? '❌' : r.overallScore >= 4.0 ? '✅' : r.overallScore >= 3.5 ? '⚠️' : '❌';
  const notes = r.error || '';
  return `| ${r.testCaseId} | ${r.overallScore ? r.overallScore.toFixed(2) : 'N/A'} | ${status} | ${notes} |`;
}).join('\n')}

---

## Detailed Analysis

For detailed scoring analysis and recommendations, see:
- **Execution Details:** \`test-execution-results.json\`
- **Scoring Analysis:** \`test-scoring-analysis.md\`
- **Results Spreadsheet:** \`test-results-bifurcation.csv\`

---

## Next Steps

${passed ? `
### ✅ Phase 2 Complete - Proceed to Phase 3

1. **Code Review**: Review enhanced prompt and generated outputs
2. **Soft Launch**: Deploy to development environment
3. **User Testing**: Gather feedback from selected users
4. **Monitoring**: Track real-world usage metrics
5. **Production**: Deploy to production after 1-week soft launch

See \`COMPREHENSIVE_BIFURCATION_IMPLEMENTATION_PLAN.md\` for Phase 3 details.
` : `
### ⚠️ Prompt Iteration Required

1. **Review Scoring Analysis**: Read \`test-scoring-analysis.md\` for detailed recommendations
2. **Update Prompt**: Modify \`EXECUTIVE_SUMMARY_GENERATION_PROMPT\` in \`server/prompts.js\`
3. **Focus Areas**: Address lowest-scoring criteria identified in analysis
4. **Re-test Subset**: Run 3-5 test cases to validate improvements
5. **Re-run Full Suite**: If subset shows improvement, run full test suite again

**Key Areas to Improve:**
(See test-scoring-analysis.md for specific recommendations on weakest criteria)
`}

---

## Files Generated

- \`test-execution-results.json\` - Raw execution data
- \`test-scoring-analysis.md\` - Detailed scoring analysis and recommendations
- \`test-results-bifurcation.csv\` - Spreadsheet with all scores
- \`outputs/TC-*-output.json\` - Individual test case outputs (10 files)
- \`BIFURCATION_TEST_REPORT.md\` - This summary report

---

**Report End**
`;

  fs.writeFileSync(CONFIG.FINAL_REPORT, report);
  log(`Final report saved to: ${CONFIG.FINAL_REPORT}`, 'SUCCESS');

  return { passed, avgScore };
}

/**
 * Print final summary to console
 */
function printFinalSummary(executionSummary, scoringResults, finalResult) {
  printHeader('TEST RUN COMPLETE');

  console.log('📊 EXECUTION SUMMARY:');
  console.log(`   Total Test Cases: ${executionSummary.totalTestCases}`);
  console.log(`   Successful: ${executionSummary.successCount}`);
  console.log(`   Failed: ${executionSummary.failureCount}`);
  console.log(`   Success Rate: ${executionSummary.successRate}\n`);

  console.log('📈 QUALITY SCORING:');
  console.log(`   Average Score: ${finalResult.avgScore.toFixed(2)} / 5.00`);
  console.log(`   Target: 4.0`);
  console.log(`   Status: ${finalResult.passed ? '✅ PASSED' : '⚠️ NEEDS ITERATION'}\n`);

  console.log('📁 FILES GENERATED:');
  console.log(`   - ${CONFIG.EXECUTION_RESULTS}`);
  console.log(`   - ${CONFIG.SCORING_ANALYSIS}`);
  console.log(`   - ${CONFIG.RESULTS_CSV}`);
  console.log(`   - ${CONFIG.FINAL_REPORT}\n`);

  if (finalResult.passed) {
    console.log('✅ SUCCESS: Bifurcation style implementation meets quality threshold!');
    console.log('   Next: Proceed to Phase 3 (Soft Launch)\n');
  } else {
    console.log('⚠️  ITERATION NEEDED: Scores below target threshold');
    console.log('   Next: Review test-scoring-analysis.md for recommendations\n');
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * Main test runner
 */
async function runTests() {
  try {
    printHeader('BIFURCATION STYLE IMPLEMENTATION - AUTOMATED TEST SUITE');

    log('Starting automated test suite...', 'INFO');
    log('This will execute all 10 test cases and score outputs against quality rubric', 'INFO');

    // Step 1: Check prerequisites
    if (!checkPrerequisites()) {
      log('Prerequisites check failed. Aborting.', 'ERROR');
      process.exit(1);
    }

    log('Prerequisites check passed', 'SUCCESS');

    // Step 2: Execute all test cases
    printSection('Phase 1: Test Execution');
    log('Running test-executor.js...', 'PROGRESS');
    log('This may take 10-20 minutes depending on server load', 'INFO');

    const executionSummary = await executeAllTestCases();

    if (executionSummary.successCount === 0) {
      log('All test executions failed. Check server connectivity.', 'ERROR');
      process.exit(1);
    }

    log(`Test execution complete: ${executionSummary.successCount}/${executionSummary.totalTestCases} successful`, 'SUCCESS');

    // Step 3: Score outputs
    printSection('Phase 2: Quality Scoring');
    log('Running test-scorer.js...', 'PROGRESS');

    const scoringResults = await scoreAllOutputs();

    const validScores = scoringResults.filter(r => !r.error);
    log(`Scoring complete: ${validScores.length}/${scoringResults.length} outputs scored`, 'SUCCESS');

    // Step 4: Generate final report
    const finalResult = generateFinalReport(executionSummary, scoringResults);

    // Step 5: Print summary
    printFinalSummary(executionSummary, scoringResults, finalResult);

    // Exit with appropriate code
    process.exit(finalResult.passed ? 0 : 1);

  } catch (error) {
    log(`Fatal error: ${error.message}`, 'ERROR');
    console.error(error);
    process.exit(1);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
