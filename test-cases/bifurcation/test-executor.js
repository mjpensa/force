#!/usr/bin/env node

/**
 * Automated Test Executor for Bifurcation Style Executive Summaries
 *
 * This script automates the execution of all test cases:
 * 1. Reads test research files
 * 2. Uploads to /generate-chart endpoint
 * 3. Polls for completion
 * 4. Saves outputs and metrics
 * 5. Generates execution report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  API_BASE_URL: 'http://localhost:3000',
  POLL_INTERVAL: 2000, // 2 seconds
  MAX_POLL_ATTEMPTS: 60, // 2 minutes max
  OUTPUT_DIR: path.join(__dirname, 'outputs'),
  RESULTS_FILE: path.join(__dirname, 'test-execution-results.json')
};

// Test case definitions
const TEST_CASES = [
  {
    id: 'TC-01',
    name: 'Banking - Simple (Mobile App)',
    files: ['TC-01-banking-simple.md'],
    prompt: 'Create a strategic roadmap for mobile banking app redesign 2026-2027',
    industry: 'Banking',
    complexity: 'Simple'
  },
  {
    id: 'TC-02',
    name: 'Banking - Multi-source (Digital Lending)',
    files: [
      'TC-02-banking-multi-source-file1.md',
      'TC-02-banking-multi-source-file2.md',
      'TC-02-banking-multi-source-file3.md',
      'TC-02-banking-multi-source-file4.md',
      'TC-02-banking-multi-source-file5.md'
    ],
    prompt: 'Create a strategic roadmap for digital lending platform launch 2026-2028',
    industry: 'Banking',
    complexity: 'Medium'
  },
  {
    id: 'TC-03',
    name: 'Banking - Complex (Core Banking Modernization)',
    files: ['TC-03-banking-complex-README.md'], // Note: Simplified for testing
    prompt: 'Create a strategic roadmap for core banking system modernization 2026-2028',
    industry: 'Banking',
    complexity: 'Complex',
    note: 'Using README as single file - create 10 files for comprehensive test'
  },
  {
    id: 'TC-04',
    name: 'Healthcare - Simple (Telemedicine)',
    files: ['TC-04-healthcare-simple.md'],
    prompt: 'Create a strategic roadmap for telemedicine platform expansion 2026-2027',
    industry: 'Healthcare',
    complexity: 'Simple'
  },
  {
    id: 'TC-05',
    name: 'Technology - Medium (AI Customer Service)',
    files: [
      'TC-05-technology-medium-file1.md',
      'TC-05-technology-medium-file2.md',
      'TC-05-technology-medium-file3.md'
    ],
    prompt: 'Create a strategic roadmap for AI customer service platform launch 2026-2028',
    industry: 'Technology',
    complexity: 'Medium'
  },
  {
    id: 'TC-06',
    name: 'Finance - Simple (ESG Fund)',
    files: ['TC-06-finance-simple.md'],
    prompt: 'Create a strategic roadmap for ESG investment fund launch 2026-2027',
    industry: 'Finance',
    complexity: 'Simple'
  },
  {
    id: 'TC-07',
    name: 'Banking - PDF Format (Branch Optimization)',
    files: ['TC-07-banking-pdf-note.md'], // Using .md for now - convert to PDF for real test
    prompt: 'Create a strategic roadmap for branch network optimization 2026-2028',
    industry: 'Banking',
    complexity: 'Medium',
    note: 'Convert to PDF for actual PDF format testing'
  },
  {
    id: 'TC-08',
    name: 'Mixed Industries - High Complexity (Embedded Finance)',
    files: ['TC-08-mixed-industries-README.md'], // Note: Simplified for testing
    prompt: 'Create a strategic roadmap for embedded finance platform 2026-2028',
    industry: 'Mixed',
    complexity: 'High',
    note: 'Using README as single file - create 7 files for comprehensive test'
  },
  {
    id: 'TC-09',
    name: 'Banking - Sparse Data (Credit Card Rewards)',
    files: ['TC-09-banking-sparse.md'],
    prompt: 'Create a strategic roadmap for credit card rewards program update 2026',
    industry: 'Banking',
    complexity: 'Low (Sparse)'
  },
  {
    id: 'TC-10',
    name: 'Banking - Contradictions (Small Business Lending)',
    files: ['TC-10-banking-contradictions.md'],
    prompt: 'Create a strategic roadmap for small business lending platform 2026-2027',
    industry: 'Banking',
    complexity: 'Medium (Contradictions)'
  }
];

// Utility functions
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = {
    'INFO': 'ℹ️',
    'SUCCESS': '✅',
    'ERROR': '❌',
    'WARN': '⚠️',
    'PROGRESS': '⏳'
  }[level] || 'ℹ️';

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create outputs directory
function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
    log(`Created outputs directory: ${CONFIG.OUTPUT_DIR}`, 'SUCCESS');
  }
}

// Upload files and create chart generation job
async function uploadAndGenerate(testCase) {
  log(`Uploading files for ${testCase.id}...`, 'PROGRESS');

  const form = new FormData();
  form.append('prompt', testCase.prompt);

  // Read and attach all files for this test case
  for (const filename of testCase.files) {
    const filePath = path.join(__dirname, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath);
    form.append('researchFiles', fileContent, filename);
  }

  try {
    const response = await axios.post(
      `${CONFIG.API_BASE_URL}/generate-chart`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 30000 // 30 second timeout for upload
      }
    );

    if (response.data.jobId) {
      log(`Job created: ${response.data.jobId}`, 'SUCCESS');
      return {
        jobId: response.data.jobId
      };
    } else {
      throw new Error('Invalid response: missing jobId');
    }
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

// Poll job status until complete
async function pollJobStatus(jobId) {
  let attempts = 0;

  while (attempts < CONFIG.MAX_POLL_ATTEMPTS) {
    try {
      const response = await axios.get(
        `${CONFIG.API_BASE_URL}/job/${jobId}`,
        { timeout: 10000 }
      );

      const { status, progress, data, error } = response.data;

      if (status === 'complete' && data) {
        log(`Job completed successfully`, 'SUCCESS');
        return { success: true, data };
      } else if (status === 'error') {
        return { success: false, error: error || 'Unknown error' };
      } else {
        // Still processing
        log(`Job status: ${status} - ${progress || 'Processing...'}`, 'PROGRESS');
        await sleep(CONFIG.POLL_INTERVAL);
        attempts++;
      }
    } catch (error) {
      log(`Error polling job: ${error.message}`, 'WARN');
      await sleep(CONFIG.POLL_INTERVAL);
      attempts++;
    }
  }

  return { success: false, error: 'Timeout waiting for job completion' };
}

// Save output to file
function saveOutput(testCaseId, chartData) {
  const outputFile = path.join(CONFIG.OUTPUT_DIR, `${testCaseId}-output.json`);
  fs.writeFileSync(outputFile, JSON.stringify(chartData, null, 2));
  log(`Saved output to: ${outputFile}`, 'SUCCESS');
}

// Execute a single test case
async function executeTestCase(testCase) {
  const startTime = Date.now();
  const result = {
    testCaseId: testCase.id,
    name: testCase.name,
    industry: testCase.industry,
    complexity: testCase.complexity,
    fileCount: testCase.files.length,
    startTime: new Date().toISOString(),
    success: false,
    generationTime: null,
    chartId: null,
    error: null,
    note: testCase.note || null
  };

  try {
    log(`\n${'='.repeat(80)}`, 'INFO');
    log(`Starting test case: ${testCase.id} - ${testCase.name}`, 'INFO');
    log(`${'='.repeat(80)}`, 'INFO');

    // Step 1: Upload and generate
    const { jobId } = await uploadAndGenerate(testCase);
    result.jobId = jobId;

    // Step 2: Poll for completion
    const pollResult = await pollJobStatus(jobId);

    if (!pollResult.success) {
      result.error = pollResult.error;
      log(`Test case failed: ${pollResult.error}`, 'ERROR');
      return result;
    }

    result.generationTime = Math.round((Date.now() - startTime) / 1000);
    const chartData = pollResult.data;

    // Step 3: Save output
    saveOutput(testCase.id, chartData);

    // Step 4: Validate executive summary exists
    if (chartData.executiveSummary) {
      result.success = true;
      result.hasSummary = true;
      result.summarySize = JSON.stringify(chartData.executiveSummary).length;
      log(`Test case completed successfully in ${result.generationTime}s`, 'SUCCESS');
    } else {
      result.error = 'Executive summary not generated';
      log(`Test case failed: No executive summary in response`, 'ERROR');
    }

  } catch (error) {
    result.error = error.message;
    result.generationTime = Math.round((Date.now() - startTime) / 1000);
    log(`Test case failed: ${error.message}`, 'ERROR');
  }

  result.endTime = new Date().toISOString();
  return result;
}

// Execute all test cases
async function executeAllTestCases() {
  log('Starting automated test execution...', 'INFO');
  log(`Total test cases: ${TEST_CASES.length}`, 'INFO');
  log(`API Base URL: ${CONFIG.API_BASE_URL}`, 'INFO');
  log(`Output directory: ${CONFIG.OUTPUT_DIR}\n`, 'INFO');

  ensureOutputDir();

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    log(`\nExecuting test ${i + 1}/${TEST_CASES.length}...`, 'INFO');

    const result = await executeTestCase(testCase);
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }

    // Brief pause between test cases to avoid overwhelming the server
    if (i < TEST_CASES.length - 1) {
      log('Waiting 3 seconds before next test case...', 'INFO');
      await sleep(3000);
    }
  }

  // Save results summary
  const summary = {
    executionDate: new Date().toISOString(),
    totalTestCases: TEST_CASES.length,
    successCount,
    failureCount,
    successRate: ((successCount / TEST_CASES.length) * 100).toFixed(2) + '%',
    results
  };

  fs.writeFileSync(CONFIG.RESULTS_FILE, JSON.stringify(summary, null, 2));

  // Print summary
  log(`\n${'='.repeat(80)}`, 'INFO');
  log('TEST EXECUTION SUMMARY', 'INFO');
  log(`${'='.repeat(80)}`, 'INFO');
  log(`Total test cases: ${TEST_CASES.length}`, 'INFO');
  log(`Successful: ${successCount} (${summary.successRate})`, successCount === TEST_CASES.length ? 'SUCCESS' : 'WARN');
  log(`Failed: ${failureCount}`, failureCount > 0 ? 'ERROR' : 'SUCCESS');
  log(`Results saved to: ${CONFIG.RESULTS_FILE}`, 'SUCCESS');
  log(`Outputs saved to: ${CONFIG.OUTPUT_DIR}`, 'SUCCESS');

  // List failures
  if (failureCount > 0) {
    log('\nFailed test cases:', 'ERROR');
    results.filter(r => !r.success).forEach(r => {
      log(`  - ${r.testCaseId}: ${r.error}`, 'ERROR');
    });
  }

  log(`\n${'='.repeat(80)}\n`, 'INFO');

  return summary;
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  executeAllTestCases()
    .then(summary => {
      if (summary.successCount === summary.totalTestCases) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      log(`Fatal error: ${error.message}`, 'ERROR');
      console.error(error);
      process.exit(1);
    });
}

export { executeAllTestCases, executeTestCase };
