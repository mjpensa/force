# Bifurcation Style Test Suite

Automated testing infrastructure for validating the Great Bifurcation style implementation in executive summaries.

## Overview

This test suite automates the complete testing workflow for the bifurcation style enhancement:

1. **Test Execution** - Uploads research files, generates roadmaps, saves outputs
2. **Quality Scoring** - Analyzes outputs against 8-criteria rubric (1-5 scale)
3. **Reporting** - Generates comprehensive analysis and recommendations

**Target:** Average overall score ≥ 4.0 across all test cases

---

## Prerequisites

### 1. Install Dependencies

```bash
# From project root
cd test-cases/bifurcation
npm install
```

**Required packages:**
- `axios` - HTTP client for API calls
- `form-data` - Multipart form data for file uploads

### 2. Start Server

```bash
# From project root (in separate terminal)
npm start
```

Server must be running on `http://localhost:3000` before executing tests.

### 3. Verify Test Files

All test case files should exist in `test-cases/bifurcation/`:
- `TC-01-banking-simple.md`
- `TC-02-banking-multi-source-file1.md` through `file5.md`
- `TC-03-banking-complex-README.md`
- `TC-04-healthcare-simple.md`
- `TC-05-technology-medium-file1.md` through `file3.md`
- `TC-06-finance-simple.md`
- `TC-07-banking-pdf-note.md`
- `TC-08-mixed-industries-README.md`
- `TC-09-banking-sparse.md`
- `TC-10-banking-contradictions.md`

---

## Quick Start

### Run Complete Test Suite

```bash
node run-bifurcation-tests.js
```

This single command:
1. Executes all 10 test cases (~10-20 minutes)
2. Scores outputs against quality rubric
3. Generates comprehensive reports
4. Exits with code 0 if passed, 1 if iteration needed

**Output files:**
- `test-execution-results.json` - Raw execution data
- `test-scoring-analysis.md` - Detailed scoring analysis
- `test-results-bifurcation.csv` - Spreadsheet with all scores
- `BIFURCATION_TEST_REPORT.md` - Summary report
- `outputs/TC-*-output.json` - Individual test outputs (10 files)

---

## Individual Scripts

### 1. Test Executor (test-executor.js)

Executes all test cases and saves outputs.

```bash
node test-executor.js
```

**What it does:**
- Uploads research files via `/generate-chart` endpoint
- Polls for job completion (max 2 minutes per test)
- Fetches generated chart data
- Saves outputs to `outputs/` directory
- Generates `test-execution-results.json`

**Configuration:**
```javascript
const CONFIG = {
  API_BASE_URL: 'http://localhost:3000',
  POLL_INTERVAL: 2000, // 2 seconds
  MAX_POLL_ATTEMPTS: 60, // 2 minutes max
  OUTPUT_DIR: path.join(__dirname, 'outputs')
};
```

### 2. Test Scorer (test-scorer.js)

Scores outputs against quality rubric.

```bash
node test-scorer.js
```

**Prerequisites:** Run `test-executor.js` first to generate outputs.

**What it does:**
- Reads JSON outputs from `outputs/` directory
- Scores each executive summary against 8 criteria:
  1. **Opening Hook** (15%) - Paradox patterns, tension
  2. **Branded Concepts** (15%) - Memorable capitalized phrases
  3. **Specific Statistics** (15%) - Exact numbers, not rounded
  4. **Named Companies** (10%) - Real organizations
  5. **Quotable Moments** (15%) - Pull-quote ready sentences
  6. **Metaphor Consistency** (10%) - Single metaphorical system
  7. **Competitive Intel** (10%) - Battlefield analysis
  8. **Conclusion** (10%) - Transformation mandate with callback
- Calculates weighted overall score
- Updates `test-results-bifurcation.csv`
- Generates `test-scoring-analysis.md` with recommendations

**Scoring Scale:**
- **5** - Exceptional (exceeds expectations)
- **4** - Strong (meets expectations)
- **3** - Adequate (acceptable but improvable)
- **2** - Weak (needs improvement)
- **1** - Poor (major deficiencies)

### 3. Master Test Runner (run-bifurcation-tests.js)

Orchestrates complete workflow.

```bash
node run-bifurcation-tests.js
```

**What it does:**
- Checks prerequisites
- Runs test executor
- Runs test scorer
- Generates final report (`BIFURCATION_TEST_REPORT.md`)
- Prints summary to console
- Exits with code 0 (passed) or 1 (needs iteration)

---

## Test Case Matrix

| ID | Name | Industry | Complexity | Files | Words |
|----|------|----------|------------|-------|-------|
| TC-01 | Banking - Simple (Mobile App) | Banking | Simple | 1 | 500 |
| TC-02 | Banking - Multi-source (Digital Lending) | Banking | Medium | 5 | 2,500 |
| TC-03 | Banking - Complex (Core Banking) | Banking | Complex | 1* | 600* |
| TC-04 | Healthcare - Simple (Telemedicine) | Healthcare | Simple | 1 | 600 |
| TC-05 | Technology - Medium (AI Customer Service) | Technology | Medium | 3 | 1,800 |
| TC-06 | Finance - Simple (ESG Fund) | Finance | Simple | 1 | 420 |
| TC-07 | Banking - PDF Format (Branch Optimization) | Banking | Medium | 1 | 1,200 |
| TC-08 | Mixed Industries - High Complexity | Mixed | High | 1* | 600* |
| TC-09 | Banking - Sparse Data (Credit Card) | Banking | Low | 1 | 200 |
| TC-10 | Banking - Contradictions (Small Biz) | Banking | Medium | 1 | 1,000 |

\* _Note: TC-03 and TC-08 have README files with instructions to create 10 and 7 files respectively for comprehensive testing. Currently using simplified single-file versions._

**Coverage:**
- **Industries:** Banking (60%), Healthcare (10%), Technology (10%), Finance (10%), Mixed (10%)
- **Complexity:** Simple (40%), Medium (30%), Complex/High (30%)
- **Edge Cases:** Multi-file synthesis, sparse data, contradictory research, PDF format

---

## Understanding Results

### Success Criteria

**Phase 2 (Testing) Passes if:**
- Average overall score ≥ 4.0
- No critical errors in execution
- All 8 criteria score ≥ 3.0 on average

**Phase 2 (Testing) Fails if:**
- Average overall score < 4.0
- Multiple test cases fail execution
- Any criteria scores < 2.0 on average

### Interpreting Scores

**Overall Score Ranges:**
- **4.5 - 5.0:** Exceptional - Exceeds expectations
- **4.0 - 4.4:** Strong - Meets target, proceed to Phase 3
- **3.5 - 3.9:** Good - Close to target, minor iteration recommended
- **3.0 - 3.4:** Adequate - Moderate iteration required
- **< 3.0:** Weak - Major iteration required

### Common Issues

**Low Opening Hook Scores:**
- Not enough paradox patterns ("While X believes Y, reality is Z")
- Missing dramatic language (inflection, tectonic, battlefield)
- First sentence too short or generic

**Low Branded Concepts Scores:**
- Using generic phrases instead of capitalized concepts
- Not creating memorable named concepts
- Solution: Add 3-5 "The [Capitalized Phrase]" constructs

**Low Specific Statistics Scores:**
- Using rounded numbers ("millions" instead of "2.7 million")
- Missing percentages with decimals
- Solution: Use exact numbers with precision

**Low Metaphor Consistency Scores:**
- Mixing multiple metaphor families (war + journey + race)
- Solution: Choose ONE system and maintain throughout

---

## Iteration Workflow

If average score < 4.0:

### 1. Review Analysis Report

```bash
cat test-scoring-analysis.md
```

Identify weakest criteria and read recommendations.

### 2. Update Prompt

Edit `server/prompts.js` (line 964):
```javascript
export const EXECUTIVE_SUMMARY_GENERATION_PROMPT = `
// Strengthen weak areas based on recommendations
// Example: Add more paradox pattern examples if Opening Hook is weak
`;
```

### 3. Test Subset (3-5 Cases)

Modify `test-executor.js` to run subset:
```javascript
const TEST_CASES = [
  TEST_CASES[0],  // TC-01
  TEST_CASES[3],  // TC-04
  TEST_CASES[8]   // TC-09
];
```

Run:
```bash
node test-executor.js
node test-scorer.js
```

### 4. Validate Improvement

If subset scores improve (avg ≥ 4.0):
- Restore full TEST_CASES array
- Run full suite: `node run-bifurcation-tests.js`

If subset scores don't improve:
- Review prompt changes
- Try different approach
- Consult BIFURCATION_STYLE_COMPARISON.md for examples

### 5. Repeat Until Success

Continue iteration until average overall score ≥ 4.0.

---

## Troubleshooting

### Server Connection Errors

**Symptom:** "Failed to upload: ECONNREFUSED"

**Solution:**
```bash
# Start server in separate terminal
npm start

# Verify server is running
curl http://localhost:3000/health
```

### Test Timeout Errors

**Symptom:** "Timeout waiting for job completion"

**Solution:**
- Increase `MAX_POLL_ATTEMPTS` in `test-executor.js`
- Check server logs for AI API errors
- Verify API_KEY is set in `.env`

### Missing Output Files

**Symptom:** "No output files found"

**Solution:**
- Ensure `test-executor.js` completed successfully
- Check `outputs/` directory exists and has JSON files
- Review `test-execution-results.json` for errors

### Scoring Errors

**Symptom:** "No executive summary in output"

**Solution:**
- Check if test execution completed successfully
- Verify `executiveSummary` field exists in output JSON
- Review server logs for AI generation errors

---

## File Structure

```
test-cases/bifurcation/
├── README.md                           # This file
├── run-bifurcation-tests.js           # Master test runner
├── test-executor.js                   # Test execution script
├── test-scorer.js                     # Quality scoring script
├── test-results-bifurcation.csv       # Results spreadsheet
├── package.json                       # Dependencies
│
├── TC-01-banking-simple.md            # Test case files (17 total)
├── TC-02-banking-multi-source-*.md
├── TC-03-banking-complex-README.md
├── TC-04-healthcare-simple.md
├── TC-05-technology-medium-*.md
├── TC-06-finance-simple.md
├── TC-07-banking-pdf-note.md
├── TC-08-mixed-industries-README.md
├── TC-09-banking-sparse.md
├── TC-10-banking-contradictions.md
│
└── outputs/                           # Generated outputs (created by executor)
    ├── TC-01-output.json
    ├── TC-02-output.json
    └── ... (10 files total)
```

---

## Next Steps After Testing

### If Tests Pass (avg score ≥ 4.0):

1. **Review Outputs** - Manually review 2-3 generated summaries for quality
2. **Proceed to Phase 3** - Follow `COMPREHENSIVE_BIFURCATION_IMPLEMENTATION_PLAN.md`
3. **Soft Launch** - Deploy to development environment
4. **User Testing** - Gather feedback from selected users
5. **Production** - Deploy after 1-week soft launch

### If Tests Fail (avg score < 4.0):

1. **Read Analysis** - Review `test-scoring-analysis.md` recommendations
2. **Iterate Prompt** - Update `EXECUTIVE_SUMMARY_GENERATION_PROMPT`
3. **Re-test Subset** - Validate improvements on 3-5 cases
4. **Re-run Full Suite** - Execute complete test suite again
5. **Repeat** - Continue until target achieved

---

## Support

**Documentation:**
- `COMPREHENSIVE_BIFURCATION_IMPLEMENTATION_PLAN.md` - Full implementation guide
- `EXECUTIVE_SUMMARY_BIFURCATION_STRATEGY.md` - Style guide
- `BIFURCATION_STYLE_COMPARISON.md` - Before/after examples
- `PHASE_1_VERIFICATION_REPORT.md` - Phase 1 completion report

**Issues:**
- Check server logs for API errors
- Review `.env` file for correct API_KEY
- Verify all test case files exist
- Ensure npm packages are installed

---

**Last Updated:** 2025-11-23
**Version:** 1.0.0
**Status:** Ready for execution
