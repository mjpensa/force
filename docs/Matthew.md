# Matthew

## V1 Build Specification Critical Risk Review


This document captures the top risks identified in the architectural review of the V1 Build Specification, focusing on high-risk intersections across RLS/connection pooling, delete workflows, and malware scanning.

## Top 3 Critical Risks

### 1) RLS Leakage via Pooled Connections
- **Scenario:** Request A sets `tenant_id` in `tenantContextMiddleware` with `SET LOCAL app.tenant_id` and returns the connection to the pool. Request B reuses the same connection before its own `SET LOCAL` executes, causing Request B's queries to inherit Request A's tenant context.
- **Impact:** Cross-tenant data leakage and incorrect reads/writes under the wrong RLS context.
- **Recommended Fix:** Acquire connections per transaction (`pool.connect()`), wrap each request in `BEGIN`/`COMMIT` with `SET LOCAL` executed inside, and scrub session state (`DISCARD ALL`/`RESET ALL`) on release. Alternatively, run pgbouncer in transaction pooling mode to enforce per-transaction isolation.

### 2) Zombie Vectors from Partial Deletes
- **Scenario:** Delete flow commits the Postgres delete first, then attempts Qdrant and blob deletions. If Qdrant fails or times out, vectors remain while the document row is gone, leaving search results pointing to missing documents.
- **Impact:** Data corruption/inconsistent search results and potential exposure of stale or sensitive embeddings.
- **Recommended Fix:** Implement a saga/transactional outbox: mark documents as `deleting`, enqueue Qdrant/blob deletions with retries and idempotency, and only finalize the Postgres removal once downstream deletes succeed (or apply compensating actions such as tombstones/retries until cleanup completes).

### 3) Malware-Scan Race During Streaming Uploads
- **Scenario:** Files stream directly to storage and become retrievable before malware scanning finishes. A malicious upload can be downloaded or processed immediately while the scan is still pending or fails.
- **Impact:** Security breach through distribution/ingestion of unscanned malware.
- **Recommended Fix:** Stream uploads into a quarantine path and gate availability on a "clean" scan result. Only move/promote the object to its public/consumable location after ClamAV (or equivalent) passes; block downloads/workers until the scan state is clean and tie signed URLs/tokens to that state.


## V4 Gap Remediation Plan


This plan closes the four critical gaps identified during the architectural red-team review of the V1 Build Specification. Each section states the risk, concrete implementation steps, ownership boundaries, and verification actions.

## 1) Tenant RLS Context Leakage via Connection Pooling
**Risk recap:** `tenantContextMiddleware` issues `SET LOCAL app.tenant_id` on pooled connections without a request-scoped transaction or session reset, so pooled connections can leak the previous tenant’s RLS context across requests.

**Implementation steps**
- Wrap every API request that executes database queries in a request-scoped transaction (e.g., `db.transaction(async trx => { ... })`) and run `SET LOCAL app.tenant_id = $1` on the transaction connection before any query executes. Ensure all downstream repositories receive the `trx` instance instead of the global pool handle.
- Add a `beforeRelease`/`afterRelease` hook (knex `pool.afterCreate` + `pool.destroy`) that issues `RESET ALL` to scrub session state when a connection returns to the pool. Guard with logging and metrics on failures to guarantee resets.
- If pgBouncer is used, enforce *transaction* pooling mode so session state cannot persist between requests; document this as a deployment invariant in ops runbooks.
- Add an integration test harness that spawns two simulated requests on the same connection: Request A sets tenant A, executes a query, releases; Request B sets tenant B and verifies it cannot read tenant A data, proving reset/transaction isolation works.

**Outcome:** RLS context is isolated per request; no cross-tenant leakage even under pool reuse. 【F:docs/V1_BUILD_SPEC.md†L4298-L4346】

## 2) Zombie Vectors from Partial Delete
**Risk recap:** Document delete currently removes Qdrant vectors and blob content after deleting from Postgres, so a failure midway leaves orphaned vectors or blobs that still appear in search.

**Implementation steps**
- Convert delete to an outbox-backed saga: mark the document row as `status='deleting'` in a DB transaction, emit a durable outbox event, and commit the transaction only after the outbox write. Keep the user-facing API idempotent and return 202 with a deletion job ID.
- Implement a worker handler that processes the deletion event with ordered steps: (1) delete vectors in Qdrant with retries/backoff; (2) delete blobs with retries; (3) hard-delete the Postgres row (or mark `deleted_at`). If any step fails, record the failure and leave the status as `delete_failed` for retries.
- Add periodic reconciliation jobs to reprocess stuck deletion events and to scan for blobs/vectors whose document rows are gone, cleaning or rebuilding as needed.
- Extend cache invalidation to fire only after the saga reaches the terminal `deleted` state; expose metrics on deletion success/failure counts.

**Outcome:** Deletions become eventually consistent and resilient; orphaned vectors or blobs are automatically cleared. 【F:docs/V1_BUILD_SPEC.md†L6454-L6485】

## 3) Worker OOM During Concurrent PDF Parsing
**Risk recap:** Worker containers are limited to 4Gi but must process up to 50MB PDFs with OCR/DOM parsing; five concurrent jobs can exceed heap and crash the pod.

**Implementation steps**
- Enforce a worker-level concurrency cap for heavy extractors (e.g., a semaphore limiting PDF extraction to 1–2 concurrent jobs per pod) and route other tasks to separate queues where feasible.
- Replace full-buffer parsing with streamed/page-chunked extraction where the library permits; for `pdf-parse` or equivalent, switch to an external managed OCR (Azure Document Intelligence) that returns paged results and avoid retaining full DOM in memory.
- Add pre-flight guards in the ingestion job to reject or downscale files exceeding safe thresholds when the OCR service is unavailable, and persist a user-visible `rejected_reason`.
- Instrument memory usage and job sizes; configure HPA/KEDA scaling thresholds on queue depth and RSS to prevent scheduling more concurrent PDF tasks than the node can support.

**Outcome:** Worker memory use is bounded and predictable; large-file ingestion cannot crash the pod through concurrent PDF parsing. 【F:docs/V1_BUILD_SPEC.md†L260-L312】【F:docs/V1_BUILD_SPEC.md†L6131-L6205】【F:docs/V1_BUILD_SPEC.md†L6575-L6638】

## 4) Malware Scanning Race on Streaming Uploads
**Risk recap:** Files are streamed straight to blob storage and marked with final paths before malware scanning, so malicious files could be downloadable before scans finish.

**Implementation steps**
- Introduce a quarantine container/path for new uploads. Stream the file to `quarantine/{tenant}/{kb}/{tempId}` and record the temp path in the DB with status `uploading`.
- Run malware scanning on the quarantined stream or blob. Only after a clean result should the blob be moved/renamed to the final `documents/...` path and the document status set to `pending`. If infected or scan fails, delete the quarantine blob, mark the document `rejected`, and emit an audit event.
- Gate downloads and downstream processing on `status='pending'|'processing'|'complete'`; deny access to any document not marked clean. Add signed URL generation to check status before issuing links.
- Add circuit-breaker metrics and alerts for scan failures; expose an admin retry endpoint to re-scan quarantined blobs.

**Outcome:** No document becomes available or processed before malware scans pass; infected uploads are quarantined and destroyed safely. 【F:docs/V1_BUILD_SPEC.md†L6131-L6205】【F:docs/V1_BUILD_SPEC.md†L7525-L7599】


## Codebase Cleanup Plan: Dead & Unused Code Removal


## Overview

This document outlines a comprehensive, phase-by-phase approach to identify and safely remove broken, unused, unfinished, or dead code from the Force codebase.

**Codebase Stats:**
- Frontend: ~7,678 lines JavaScript, ~5,058 lines CSS
- Backend: ~888 lines JavaScript
- Test Files: 3 files (~560 lines)
- Total Source Files: 76 files

---

## Phase 1: Setup & Tooling (Foundation)

### Step 1.1: Install Static Analysis Tools

```bash
# Install ESLint for JavaScript dead code detection
npm install --save-dev eslint eslint-plugin-unused-imports @eslint/js

# Install additional analysis tools
npm install --save-dev depcheck knip
```

### Step 1.2: Configure ESLint for Dead Code Detection

Create `.eslintrc.cjs`:
```javascript
module.exports = {
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['unused-imports'],
  rules: {
    'no-unused-vars': ['warn', {
      vars: 'all',
      args: 'after-used',
      ignoreRestSiblings: true,
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_'
    }],
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': ['warn', {
      vars: 'all',
      varsIgnorePattern: '^_',
      args: 'after-used',
      argsIgnorePattern: '^_'
    }],
    'no-unreachable': 'error',
    'no-constant-condition': 'warn'
  }
};
```

### Step 1.3: Create Knip Configuration for Comprehensive Analysis

Create `knip.json`:
```json
{
  "entry": [
    "server.js",
    "Public/main.js",
    "Public/viewer.js",
    "Public/chart-renderer.js"
  ],
  "project": [
    "server/**/*.js",
    "Public/**/*.js",
    "!Public/dist/**",
    "!node_modules/**"
  ],
  "ignore": [
    "coverage/**",
    "tests/**",
    "scripts/**"
  ],
  "ignoreDependencies": [
    "@types/jest"
  ]
}
```

### Step 1.4: Add NPM Scripts for Analysis

Add to `package.json`:
```json
{
  "scripts": {
    "lint": "eslint 'Public/**/*.js' 'server/**/*.js' --ignore-pattern 'Public/dist/**'",
    "lint:fix": "eslint 'Public/**/*.js' 'server/**/*.js' --fix --ignore-pattern 'Public/dist/**'",
    "analyze:deps": "depcheck",
    "analyze:dead-code": "knip",
    "analyze:all": "npm run lint && npm run analyze:deps && npm run analyze:dead-code"
  }
}
```

---

## Phase 2: Automated Dead Code Detection

### Step 2.1: Run ESLint Analysis

```bash
npm run lint > reports/eslint-report.txt 2>&1
```

**What to look for:**
- `no-unused-vars` warnings
- `unused-imports/no-unused-imports` warnings
- `no-unreachable` errors (code after return/throw)

### Step 2.2: Run Dependency Analysis

```bash
npm run analyze:deps > reports/depcheck-report.txt 2>&1
```

**Outputs to review:**
- Unused dependencies (installed but never imported)
- Missing dependencies (used but not in package.json)
- Unused devDependencies

### Step 2.3: Run Knip for Comprehensive Analysis

```bash
npm run analyze:dead-code > reports/knip-report.txt 2>&1
```

**Knip identifies:**
- Unused files (not imported anywhere)
- Unused exports (exported but never imported)
- Unused dependencies
- Unused class members
- Duplicate exports

### Step 2.4: CSS Dead Code Analysis

```bash
# Install PurgeCSS for analysis
npm install --save-dev purgecss

# Create purgecss.config.js
```

Create `purgecss.config.cjs`:
```javascript
module.exports = {
  content: ['Public/**/*.html', 'Public/**/*.js'],
  css: ['Public/styles/**/*.css'],
  output: 'reports/purgecss-report',
  rejected: true,  // Output rejected (unused) selectors
  safelist: {
    standard: [/^gantt-/, /^slide-/, /^modal-/, /^toast-/],
    deep: [/active$/, /visible$/, /hidden$/],
    greedy: [/data-/]
  }
};
```

Run analysis:
```bash
npx purgecss --config purgecss.config.cjs
```

---

## Phase 3: Manual Code Review - JavaScript

### Step 3.1: Review Entry Points & Import Trees

**Files to analyze:**

| Entry Point | Purpose | Review Focus |
|-------------|---------|--------------|
| `Public/main.js` | Upload page | Check all imports are used |
| `Public/viewer.js` | Viewer orchestrator | Verify view registrations |
| `Public/chart-renderer.js` | Chart page | Check chart component usage |
| `server.js` | Express entry | Verify all routes active |

**Action:** Create import dependency graph:
```bash
# Manual trace or use madge
npm install --save-dev madge
npx madge Public/main.js --image reports/main-deps.svg
npx madge Public/viewer.js --image reports/viewer-deps.svg
npx madge server.js --image reports/server-deps.svg
```

### Step 3.2: Review Legacy Files

**High Priority Legacy Files:**

| File | Lines | Status | Action Required |
|------|-------|--------|-----------------|
| `Public/Utils.js` | ~410 | Legacy | Verify migration to `/utils/` complete |
| `Public/config.js` | 111 | Active? | Check if replaced by `/config/shared.js` |

**Review checklist for each file:**
- [ ] Is file imported anywhere?
- [ ] Are all exports used?
- [ ] Does functionality exist elsewhere?
- [ ] Can it be safely removed or consolidated?

### Step 3.3: Review Utility Modules

**Files in `Public/utils/`:**

| File | Lines | Review Focus |
|------|-------|--------------|
| `index.js` | - | Check re-exports match usage |
| `analysis-builders.js` | 412 | Verify all builders used |
| `dom.js` | 134 | Check DOM helper usage |
| `date.js` | 88 | Verify date functions used |
| `fetch.js` | - | Check API helper usage |
| `assets.js` | - | Verify asset helpers used |
| `performance.js` | - | Check perf util usage |

**Search pattern for each export:**
```bash
# For each exported function, search for usage
grep -r "functionName" Public/ --include="*.js" | grep -v "export"
```

### Step 3.4: Review Component Files

**Shared Components (`Public/components/shared/`):**

| Component | Lines | Review Focus |
|-----------|-------|--------------|
| `StateManager.js` | 335 | Check all methods called |
| `LazyLoader.js` | - | Verify lazy load active |
| `Performance.js` | - | Check monitoring enabled |
| `Accessibility.js` | - | Verify a11y features used |
| `ErrorHandler.js` | - | Check error handling active |

**View Components (`Public/components/views/`):**

| Component | Lines | Review Focus |
|-----------|-------|--------------|
| `SlidesView.js` | 458 | Check slide methods used |
| `DocumentView.js` | 69 | Verify document rendering |
| `ResearchAnalysisView.js` | 504 | Check analysis features |

### Step 3.5: Review Gantt Chart Module

**Files in `Public/gantt/`:**

| File | Lines | Review Focus |
|------|-------|--------------|
| `index.js` | - | Verify all re-exports used |
| `renderer.js` | 382 | Check render functions |
| `components.js` | 383 | Verify UI components |
| `analysis.js` | 172 | Check analysis features |
| `GanttExporter.js` | 326 | Verify export functionality |
| `GanttEditor.js` | 365 | Check editing features |
| `DraggableGantt.js` | 109 | Verify drag-drop active |
| `ResizableGantt.js` | 88 | Check resize functionality |
| `InteractiveGanttHandler.js` | 176 | Verify event handlers |
| `ContextMenu.js` | 135 | Check context menu usage |

**Key questions:**
- Are drag/drop features actually enabled?
- Is the context menu accessible?
- Are all export formats implemented and used?

### Step 3.6: Review Server Code

**Server Modules (`server/`):**

| File | Lines | Review Focus |
|------|-------|--------------|
| `config.js` | 134 | Check all config values used |
| `middleware.js` | 96 | Verify middleware active |
| `gemini.js` | 201 | Check API integration |
| `generators.js` | 221 | Verify generators called |
| `utils.js` | 31 | Check utility usage |
| `prompts.js` | 205 | Verify prompts referenced |

**Server Routes:**

| Route File | Lines | Review Focus |
|------------|-------|--------------|
| `routes/content.js` | 483 | Check all endpoints active |
| `routes/charts.js` | 211 | Verify chart routes used |
| `routes/analysis.js` | 145 | Check analysis endpoints |

**Legacy endpoint check:**
- `/generate-chart` - Is this still used or replaced?
- Are there duplicate endpoints?

---

## Phase 4: Manual Code Review - CSS

### Step 4.1: Review CSS Architecture

**CSS Files by size:**

| File | Lines | Review Focus |
|------|-------|--------------|
| `design-system.css` | 1,383 | Check design tokens used |
| `analysis-view.css` | 1,221 | Verify analysis styles |
| `gantt.css` | 593 | Check gantt selectors |
| `slides-view.css` | 514 | Verify slide styles |
| `analysis.css` | 506 | Check for duplicates with analysis-view.css |
| `app-shell.css` | 442 | Verify layout styles |
| `modal.css` | 197 | Check modal usage |
| `base.css` | 109 | Verify base styles |
| `responsive.css` | 53 | Check media queries |

### Step 4.2: Identify Duplicate/Overlapping CSS

**Potential duplicates to investigate:**
- `analysis-view.css` (1,221 lines) vs `analysis.css` (506 lines)
  - Do these overlap? Can they be consolidated?

**Search for unused class patterns:**
```bash
# For each CSS class, verify it exists in HTML/JS
grep -r "className" Public/styles/*.css | while read line; do
  class=$(echo $line | grep -oP '\.[\w-]+' | head -1)
  if ! grep -rq "$class" Public/*.html Public/**/*.js; then
    echo "Potentially unused: $class"
  fi
done
```

### Step 4.3: Review Tailwind Usage

- Check `tailwind.config.js` for unused plugins
- Verify custom utilities are actually used
- Check if generated `tailwind.css` can be optimized

---

## Phase 5: Find Unfinished Code (TODOs, FIXMEs)

### Step 5.1: Search for TODO/FIXME Comments

```bash
# Find all TODO comments
grep -rn "TODO" Public/ server/ --include="*.js" > reports/todos.txt

# Find all FIXME comments
grep -rn "FIXME" Public/ server/ --include="*.js" >> reports/todos.txt

# Find all HACK comments
grep -rn "HACK" Public/ server/ --include="*.js" >> reports/todos.txt

# Find all XXX comments
grep -rn "XXX" Public/ server/ --include="*.js" >> reports/todos.txt
```

### Step 5.2: Search for Incomplete Implementations

```bash
# Find throw "not implemented" patterns
grep -rn "not implemented" Public/ server/ --include="*.js"

# Find console.log debugging left behind
grep -rn "console\.log" Public/ server/ --include="*.js"

# Find commented-out code blocks
grep -rn "^[[:space:]]*//" Public/ server/ --include="*.js" | head -100
```

### Step 5.3: Review Each Finding

For each TODO/FIXME:
- [ ] Is this still relevant?
- [ ] Can it be completed now?
- [ ] Should it become a GitHub issue?
- [ ] Can it be removed?

---

## Phase 6: Find Broken Code

### Step 6.1: Run Full Test Suite

```bash
npm test -- --coverage --verbose > reports/test-results.txt 2>&1
```

**Review:**
- Failing tests indicate broken code
- Low coverage areas may hide broken code

### Step 6.2: Check for Runtime Errors

```bash
# Start server and check logs
npm start 2>&1 | tee reports/runtime-log.txt

# In another terminal, test all endpoints
curl -X GET http://localhost:3000/api/health
# Test other critical endpoints...
```

### Step 6.3: Check for Missing Dependencies

```bash
# Look for imports that might fail
grep -rn "^import" Public/ server/ --include="*.js" | while read line; do
  # Extract module path and verify it exists
  echo "Checking: $line"
done
```

### Step 6.4: Browser Console Check

Manual testing in browser:
1. Open DevTools Console
2. Load each page: `/`, `/viewer.html`, `/chart.html`
3. Record any JavaScript errors
4. Check Network tab for failed requests

---

## Phase 7: Safe Removal Process

### Step 7.1: Create Backup Branch

```bash
git checkout -b cleanup/dead-code-removal
git push -u origin cleanup/dead-code-removal
```

### Step 7.2: Prioritize Removals

**Priority Matrix:**

| Priority | Type | Risk | Action |
|----------|------|------|--------|
| P1 | Unused imports | Very Low | Remove immediately |
| P1 | Commented code | Very Low | Remove immediately |
| P2 | Unused variables | Low | Remove after verification |
| P2 | Dead CSS classes | Low | Remove after PurgeCSS analysis |
| P3 | Unused functions | Medium | Test removal carefully |
| P3 | Unused files | Medium | Verify no dynamic imports |
| P4 | Unused dependencies | Medium | Test build after removal |
| P5 | Legacy modules | High | Gradual migration |

### Step 7.3: Incremental Removal Process

For each item to remove:

```bash
# 1. Create specific commit for tracability
git add -p  # Stage only related changes

# 2. Commit with descriptive message
git commit -m "chore(cleanup): Remove unused [specific item]

- What was removed
- Why it was safe to remove
- How it was verified"

# 3. Run tests after each removal
npm test

# 4. Build to verify no breaking changes
npm run build

# 5. If tests pass, continue
# 6. If tests fail, investigate or revert
git revert HEAD
```

### Step 7.4: Document Removals

Create `CLEANUP_LOG.md`:
```markdown
# Code Cleanup Log

## Session: [Date]

### Removed Items

| Item | Type | Location | Reason | Verified By |
|------|------|----------|--------|-------------|
| `unusedFunc` | Function | `utils.js:45` | No callers found | grep + tests |
| ... | ... | ... | ... | ... |

### Kept Items (False Positives)

| Item | Location | Reason Kept |
|------|----------|-------------|
| `_privateVar` | `module.js:12` | Used by closure |
| ... | ... | ... |
```

---

## Phase 8: Validation & Verification

### Step 8.1: Run Full Regression

```bash
# Run all tests
npm test -- --coverage

# Build production
npm run build:prod

# Start and smoke test
npm start
```

### Step 8.2: Coverage Comparison

Compare test coverage before and after:
- Coverage should stay same or improve
- No new untested code paths

### Step 8.3: Bundle Size Comparison

```bash
# Before cleanup
du -sh Public/dist/ > reports/bundle-before.txt

# After cleanup
du -sh Public/dist/ > reports/bundle-after.txt

# Compare
diff reports/bundle-before.txt reports/bundle-after.txt
```

### Step 8.4: Performance Validation

- Load time should stay same or improve
- No new console errors
- All features still work

---

## Phase 9: Final Review & Merge

### Step 9.1: Create Pull Request

```bash
git push -u origin cleanup/dead-code-removal
# Create PR with full description of changes
```

### Step 9.2: PR Checklist

- [ ] All tests pass
- [ ] Build succeeds
- [ ] No runtime errors
- [ ] Bundle size same or smaller
- [ ] Coverage maintained
- [ ] Changes documented
- [ ] No TODO items left unaddressed

### Step 9.3: Post-Merge Monitoring

After merging:
- Monitor error logs for 24-48 hours
- Verify production deployment works
- Address any issues immediately

---

## Appendix A: Quick Reference Commands

```bash
# Find unused exports
npx knip --include exports

# Find unused files
npx knip --include files

# Find unused dependencies
npx depcheck

# Find all console.log statements
grep -rn "console\.log" Public/ server/ --include="*.js"

# Find all TODO/FIXME
grep -rn "TODO\|FIXME" Public/ server/ --include="*.js"

# Check import usage for specific export
grep -r "importedName" Public/ server/ --include="*.js"

# List files by size (find large files to review)
find Public/ server/ -name "*.js" -exec wc -l {} \; | sort -rn | head -20

# Find potentially dead event listeners
grep -rn "addEventListener" Public/ --include="*.js"
```

---

## Appendix B: Known Areas Requiring Attention

Based on codebase analysis:

1. **`Public/Utils.js`** - Legacy file, verify migration complete
2. **`analysis-view.css` vs `analysis.css`** - Potential duplication
3. **Legacy routes** (`/generate-chart`) - May be deprecated
4. **Console.log statements** - Debug code may remain
5. **Gantt interactive features** - Verify all are enabled/used

---

## Appendix C: Estimated Effort

| Phase | Estimated Effort | Priority |
|-------|------------------|----------|
| Phase 1: Setup | 1-2 hours | High |
| Phase 2: Automated Analysis | 1 hour | High |
| Phase 3: JS Manual Review | 4-6 hours | High |
| Phase 4: CSS Manual Review | 2-3 hours | Medium |
| Phase 5: TODO/FIXME Review | 1-2 hours | Medium |
| Phase 6: Broken Code Check | 2-3 hours | High |
| Phase 7: Safe Removal | 4-8 hours | High |
| Phase 8: Validation | 2-3 hours | High |
| Phase 9: Final Review | 1-2 hours | High |

**Total Estimated Effort: 18-30 hours**

---

## Appendix D: Tools Summary

| Tool | Purpose | Install |
|------|---------|---------|
| ESLint | JS linting, unused vars | `npm i -D eslint` |
| eslint-plugin-unused-imports | Unused import detection | `npm i -D eslint-plugin-unused-imports` |
| depcheck | Unused npm dependencies | `npm i -D depcheck` |
| knip | Comprehensive dead code | `npm i -D knip` |
| PurgeCSS | Unused CSS detection | `npm i -D purgecss` |
| madge | Dependency visualization | `npm i -D madge` |

---

*Document Version: 1.0*
*Created: 2025-11-27*
*Last Updated: 2025-11-27*


## Performance Review Plan: Content Generation Latency Optimization


## Overview

This document outlines a comprehensive phase-by-phase plan to review and optimize the Force AI Research Platform for reduced content generation latency. The platform transforms research documents into interactive formats (Roadmap/Gantt, Slides, Document) using Google Gemini AI.

**Current State:**
- Total generation time: 2-5 minutes for all 4 content types
- Primary bottleneck: Gemini API response time
- Existing optimizations: Parallel generation, API queue, request deduplication

---

## Phase 1: Performance Baseline & Instrumentation

### Objective
Establish accurate performance metrics and implement comprehensive monitoring before making any optimizations.

### Step 1.1: Instrument Server-Side Timing
**Files to Review:**
- `server/routes/content.js:574 lines` - Main content generation endpoints
- `server/generators.js:225 lines` - Core generation orchestration

**Actions:**
1. Add timing markers at each generation stage:
   - File upload receipt → file processing complete
   - File processing complete → Gemini API call initiated
   - Gemini API call initiated → response received (per content type)
   - Response received → JSON parsing complete
   - JSON parsing complete → response sent to client

2. Log detailed timing for each content type:
   ```javascript
   const timings = {
     roadmap: { apiStart, apiEnd, parseTime },
     slides: { apiStart, apiEnd, parseTime },
     document: { apiStart, apiEnd, parseTime },
     researchAnalysis: { apiStart, apiEnd, parseTime }
   };
   ```

3. Track token consumption per request (input/output tokens)

### Step 1.2: Enhance Client-Side Performance Monitoring
**Files to Review:**
- `Public/components/shared/Performance.js:47 lines` - Web Vitals monitoring
- `Public/viewer.js:818 lines` - Main viewer with polling service

**Actions:**
1. Extend `reportWebVitals()` to capture:
   - Time to First Content (TTFC) - when first content type renders
   - Total Generation Wait Time (TGWT)
   - Polling overhead metrics

2. Add custom performance marks:
   ```javascript
   performance.mark('generation-started');
   performance.mark('roadmap-received');
   performance.mark('slides-received');
   performance.mark('document-received');
   performance.mark('all-content-ready');
   ```

### Step 1.3: Create Performance Dashboard/Logging
**Actions:**
1. Create a simple logging endpoint to aggregate timing data
2. Log to structured format for analysis:
   ```json
   {
     "sessionId": "uuid",
     "totalTime": 180000,
     "contentTimings": {...},
     "fileCount": 3,
     "totalInputSize": 50000,
     "tokenUsage": {...}
   }
   ```

### Deliverables
- [ ] Server-side timing instrumentation implemented
- [ ] Client-side performance marks added
- [ ] Baseline metrics document with P50/P95/P99 latencies
- [ ] Token usage tracking per content type

---

## Phase 2: Gemini API Optimization

### Objective
Reduce Gemini API response time through prompt engineering, model configuration, and request optimization.

### Step 2.1: Analyze Prompt Efficiency
**Files to Review:**
- `server/prompts/roadmapPrompt.js` - 16.3KB system prompt
- `server/prompts/slidesPrompt.js` - MVP prompt
- `server/prompts/documentPrompt.js` - 42 lines
- `server/prompts/researchAnalysisPrompt.js` - 16KB analysis prompt

**Actions:**
1. **Audit roadmap prompt (16.3KB):**
   - Identify redundant instructions
   - Remove verbose examples that don't improve output quality
   - Consider prompt compression techniques
   - Target: Reduce to <10KB without quality loss

2. **Audit research analysis prompt (16KB):**
   - Analyze if full analysis is needed for initial display
   - Consider splitting into "quick analysis" + "detailed analysis on demand"
   - Target: Reduce initial analysis prompt to <8KB

3. **Review JSON schema complexity:**
   - Simplify nested structures where possible
   - Remove optional fields from initial generation
   - Target: 20% reduction in output token requirements

### Step 2.2: Model Configuration Tuning
**Files to Review:**
- `server/generators.js` - Model parameters
- `server/config.js` - Configuration constants

**Actions:**
1. **Review temperature/topP/topK settings:**
   ```javascript
   // Current settings
   roadmap: { temperature: 0.1, topP: 0.3, topK: 5 }
   slides: { temperature: 0.1 }
   document: { temperature: 0.1, topP: 0.3, topK: 5 }
   ```
   - Test if lower topK (e.g., 3) reduces latency without quality impact
   - Benchmark different temperature values for speed vs quality

2. **Evaluate thinking budget:**
   - Current: `thinkingBudget: 0` (disabled for speed)
   - Verify this is optimal for each content type
   - Test minimal thinking budget (256) for complex roadmaps

3. **Test model variants:**
   - Current: `gemini-flash-latest`
   - Benchmark: `gemini-1.5-flash-8b` for simpler content types (slides, document)
   - Consider: Different models for different content types

### Step 2.3: Request Batching Optimization
**Files to Review:**
- `server/generators.js:APIQueue` - Concurrency control

**Actions:**
1. **Analyze current concurrency (4):**
   - Profile if increasing to 5-6 concurrent calls is safe
   - Check Gemini rate limits for your API tier
   - Monitor error rates at different concurrency levels

2. **Implement request priority:**
   - Prioritize most-viewed content type (e.g., roadmap first)
   - Return immediately when first content is ready
   - Background-generate remaining content types

3. **Test request deduplication effectiveness:**
   - Review `StateManager._pendingRequests`
   - Ensure no duplicate Gemini calls for same session

### Deliverables
- [ ] Optimized prompts with size reduction metrics
- [ ] Model configuration benchmark results
- [ ] Concurrency tuning recommendations
- [ ] Token usage reduction measurements (target: 20% reduction)

---

## Phase 3: Response Streaming Implementation

### Objective
Implement streaming responses to show content progressively instead of waiting for complete generation.

### Step 3.1: Server-Side Streaming Setup
**Files to Modify:**
- `server/routes/content.js` - Add streaming endpoint
- `server/generators.js` - Implement streaming generation

**Actions:**
1. **Add streaming generation endpoint:**
   ```javascript
   // New endpoint: POST /api/content/generate-stream
   // Returns Server-Sent Events (SSE)
   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache');
   res.setHeader('Connection', 'keep-alive');
   ```

2. **Implement Gemini streaming:**
   ```javascript
   const result = await model.generateContentStream(prompt);
   for await (const chunk of result.stream) {
     res.write(`data: ${JSON.stringify(chunk.text())}\n\n`);
   }
   ```

3. **Stream content type completion events:**
   ```javascript
   // Stream events as each content type completes
   res.write(`data: {"type":"roadmap","status":"complete"}\n\n`);
   res.write(`data: {"type":"slides","status":"complete"}\n\n`);
   ```

### Step 3.2: Client-Side Streaming Integration
**Files to Modify:**
- `Public/viewer.js` - Add EventSource handling
- `Public/components/shared/StateManager.js` - Handle streaming updates

**Actions:**
1. **Replace polling with EventSource:**
   ```javascript
   const eventSource = new EventSource(`/api/content/generate-stream?sessionId=${id}`);
   eventSource.onmessage = (event) => {
     const data = JSON.parse(event.data);
     stateManager.setViewContent(data.type, data.content);
   };
   ```

2. **Implement progressive UI updates:**
   - Show loading skeleton for pending content
   - Render each content type immediately when received
   - Update progress indicator per content type

3. **Fallback to polling for SSE-unsupported clients:**
   - Detect EventSource support
   - Fall back to current polling mechanism if needed

### Step 3.3: Partial Content Rendering
**Files to Modify:**
- `Public/viewer.js` - View rendering logic
- `Public/components/` - Individual view components

**Actions:**
1. **Enable immediate view switching:**
   - Allow switching to a view as soon as its content is ready
   - Show "Generating..." state for incomplete views

2. **Implement content priority:**
   - Generate and stream current view first
   - Background-generate other views
   - User gets first content 60-70% faster

### Deliverables
- [ ] SSE streaming endpoint implemented
- [ ] Client EventSource integration complete
- [ ] Progressive loading UI states
- [ ] Perceived latency reduction measurement (target: 50%+ for first content)

---

## Phase 4: Caching Layer Implementation

### Objective
Implement intelligent caching to avoid redundant Gemini API calls for similar or identical requests.

### Step 4.1: Request Signature Caching
**Files to Modify:**
- `server/routes/content.js` - Add caching middleware
- New file: `server/cache/contentCache.js`

**Actions:**
1. **Create content hash function:**
   ```javascript
   function generateContentHash(researchContent, contentType) {
     return crypto.createHash('sha256')
       .update(researchContent.substring(0, 10000) + contentType)
       .digest('hex');
   }
   ```

2. **Implement LRU cache for generated content:**
   ```javascript
   const contentCache = new Map();
   const MAX_CACHE_SIZE = 50; // 50 unique content hashes
   const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
   ```

3. **Cache lookup before generation:**
   ```javascript
   const hash = generateContentHash(content, 'roadmap');
   if (contentCache.has(hash)) {
     return contentCache.get(hash);
   }
   // Generate and cache result
   ```

### Step 4.2: Similarity-Based Caching
**Actions:**
1. **Implement fuzzy content matching:**
   - For documents with >90% text similarity, reuse cached content
   - Use rolling hash or MinHash for similarity detection

2. **Cache invalidation strategy:**
   - Time-based expiry (24 hours)
   - Size-based eviction (LRU when cache full)
   - Manual invalidation endpoint for testing

### Step 4.3: Response Caching Headers
**Files to Review:**
- `server/routes/content.js` - Existing cache headers

**Actions:**
1. **Enhance Cache-Control headers:**
   ```javascript
   // Current: private, max-age=300 (5 min)
   // Consider: private, max-age=3600, stale-while-revalidate=86400
   ```

2. **Implement ETag for content:**
   - Generate ETag from content hash
   - Support conditional requests (If-None-Match)
   - Return 304 Not Modified for unchanged content

### Deliverables
- [ ] Content hash caching implemented
- [ ] Cache hit rate monitoring
- [ ] Cache size/eviction metrics
- [ ] Estimated API cost reduction (target: 30% fewer Gemini calls)

---

## Phase 5: Input Processing Optimization

### Objective
Optimize file processing and text preparation to reduce pre-generation latency.

### Step 5.1: File Processing Performance
**Files to Review:**
- `server/routes/content.js` - File processing logic
- Dependencies: `mammoth`, `pdf-parse`

**Actions:**
1. **Profile file processing:**
   - Measure time for DOCX → HTML conversion (mammoth)
   - Measure time for PDF text extraction
   - Identify slowest file types

2. **Optimize DOCX processing:**
   - Consider using mammoth with streaming
   - Pre-process common DOCX structures
   - Implement size-based processing limits

3. **Implement parallel processing:**
   - Current: `Promise.all()` for files (good)
   - Verify true parallelism with worker threads for CPU-intensive tasks

### Step 5.2: Text Preprocessing Optimization
**Files to Review:**
- `server/prompts/*.js` - Content preparation

**Actions:**
1. **Implement smart summarization:**
   - Current: First 1500 chars for slides
   - Enhance: Extract key sections (abstract, conclusions, methodology)
   - Use extractive summarization before sending to Gemini

2. **Optimize text chunking:**
   - Identify optimal chunk sizes for each content type
   - Remove redundant whitespace and formatting
   - Strip non-essential metadata

3. **Implement content deduplication:**
   - Detect and merge duplicate paragraphs
   - Remove repeated headers/footers
   - Compress repeated phrases

### Step 5.3: Upload Optimization
**Files to Review:**
- `Public/main.js` - Client-side upload handling
- `server/middleware.js` - multer configuration

**Actions:**
1. **Client-side preprocessing:**
   - Validate and compress files before upload
   - Extract text client-side for supported formats
   - Show immediate feedback during upload

2. **Optimize multer configuration:**
   ```javascript
   // Consider memory vs disk storage tradeoffs
   // Implement streaming upload processing
   ```

### Deliverables
- [ ] File processing timing breakdown
- [ ] Optimized text preprocessing pipeline
- [ ] Upload performance improvements
- [ ] Input processing latency reduction (target: 30% faster preprocessing)

---

## Phase 6: Frontend Rendering Optimization

### Objective
Optimize client-side rendering to reduce time-to-interactive after content is received.

### Step 6.1: Component Rendering Analysis
**Files to Review:**
- `Public/viewer.js` - View orchestration
- `Public/components/roadmap/` - Gantt chart rendering
- `Public/components/slides/` - Slides rendering
- `Public/components/document/` - Document rendering

**Actions:**
1. **Profile render times:**
   - Measure time from content receipt to DOM complete
   - Identify slow rendering components
   - Target: <100ms for initial render

2. **Implement virtualization for large content:**
   - Gantt charts with many tasks: virtualize rows
   - Long documents: virtualize sections
   - Use Intersection Observer for on-demand rendering

3. **Optimize DOM operations:**
   - Batch DOM updates
   - Use DocumentFragment for multiple insertions
   - Minimize layout thrashing

### Step 6.2: State Management Optimization
**Files to Review:**
- `Public/components/shared/StateManager.js:335 lines`

**Actions:**
1. **Implement memoization:**
   ```javascript
   // Cache computed content
   getMemoizedContent(viewType) {
     if (this._memoCache[viewType]?.hash === this._contentHash[viewType]) {
       return this._memoCache[viewType].value;
     }
     // Recompute and cache
   }
   ```

2. **Optimize listener notifications:**
   - Current: All listeners notified on any change
   - Improve: Only notify relevant view listeners
   - Use shallow comparison for unchanged content

3. **Reduce re-renders:**
   - Review `batchSetState()` usage
   - Ensure batch updates are working correctly
   - Profile render count per user action

### Step 6.3: Code Splitting and Lazy Loading
**Files to Review:**
- `Public/viewer.js` - Module loading
- Build configuration

**Actions:**
1. **Implement view-based code splitting:**
   ```javascript
   // Load view modules on demand
   async function loadView(viewType) {
     const module = await import(`./components/${viewType}/index.js`);
     return module.default;
   }
   ```

2. **Lazy load heavy dependencies:**
   - Gantt chart library: load only when roadmap view selected
   - Export functionality: load on demand
   - Analytics: defer loading

3. **Optimize initial bundle:**
   - Review esbuild configuration
   - Implement tree shaking
   - Target: <100KB initial JS payload

### Deliverables
- [ ] Component render time profiling report
- [ ] State management optimizations
- [ ] Code splitting implementation
- [ ] Time-to-interactive improvement (target: <100ms after content received)

---

## Phase 7: Network Optimization

### Objective
Reduce network latency and improve request/response efficiency.

### Step 7.1: Request/Response Compression
**Files to Review:**
- `server/server.js` - Express middleware
- `server/middleware.js` - Compression settings

**Actions:**
1. **Verify compression effectiveness:**
   - Current: `compression()` middleware enabled
   - Measure compression ratios for content responses
   - Test Brotli vs gzip for JSON responses

2. **Optimize JSON response size:**
   - Remove null/undefined fields from responses
   - Use shorter property names for large arrays
   - Consider response minification

3. **Implement response chunking:**
   - For large content responses (>100KB)
   - Enable HTTP/2 server push if supported

### Step 7.2: Connection Optimization
**Files to Review:**
- `server/server.js` - Server configuration

**Actions:**
1. **Enable HTTP/2:**
   - Check Railway HTTP/2 support
   - Implement HTTP/2 push for critical resources

2. **Optimize Keep-Alive:**
   ```javascript
   // Verify Keep-Alive settings
   server.keepAliveTimeout = 65000;
   server.headersTimeout = 66000;
   ```

3. **Reduce round trips:**
   - Bundle related requests
   - Prefetch predictable resources
   - Implement connection warming

### Step 7.3: CDN Integration
**Actions:**
1. **Evaluate CDN for static assets:**
   - CSS, JS, images already have long cache times
   - Consider Cloudflare or AWS CloudFront
   - Estimated latency reduction: 20-50ms for global users

2. **Edge caching strategy:**
   - Cache static content at edge
   - Session-specific content remains at origin
   - Consider edge functions for validation

### Deliverables
- [ ] Compression optimization report
- [ ] HTTP/2 implementation (if feasible)
- [ ] CDN integration plan
- [ ] Network latency reduction (target: 20% improvement)

---

## Phase 8: Database & Persistence Layer

### Objective
Implement persistent storage to enable horizontal scaling and improve session reliability.

### Step 8.1: Evaluate Storage Options
**Current State:**
- In-memory session storage (Map)
- Lost on server restart
- MAX_SESSIONS = 100 limit

**Actions:**
1. **Evaluate database options:**
   | Option | Pros | Cons | Latency |
   |--------|------|------|---------|
   | Redis | Fast, built-in TTL | Additional service | <1ms |
   | PostgreSQL | ACID, complex queries | Slower for K-V | 5-10ms |
   | SQLite | Simple, file-based | Single server | <1ms |
   | MongoDB | Document model fits content | Additional service | 2-5ms |

2. **Recommendation:** Redis for session storage
   - Sub-millisecond latency
   - Built-in TTL for session expiry
   - Supports horizontal scaling
   - Works well with Railway

### Step 8.2: Implement Redis Session Storage
**Files to Modify:**
- New file: `server/storage/redisStorage.js`
- `server/routes/content.js` - Replace Map with Redis

**Actions:**
1. **Create Redis storage abstraction:**
   ```javascript
   class SessionStorage {
     async get(sessionId) { /* Redis GET with JSON parse */ }
     async set(sessionId, data, ttl) { /* Redis SETEX */ }
     async delete(sessionId) { /* Redis DEL */ }
     async exists(sessionId) { /* Redis EXISTS */ }
   }
   ```

2. **Implement connection pooling:**
   - Use ioredis with connection pool
   - Implement retry logic for connection failures
   - Add health check endpoint

3. **Migration strategy:**
   - Support both in-memory and Redis (feature flag)
   - Gradual rollout with monitoring
   - Fallback to in-memory if Redis unavailable

### Step 8.3: Content Storage Optimization
**Actions:**
1. **Compress stored content:**
   - Compress JSON before storing in Redis
   - Use LZ4 or gzip for content compression
   - Target: 60-70% size reduction

2. **Implement lazy loading from storage:**
   - Store content types separately
   - Load only requested view type
   - Reduces memory and transfer time

### Deliverables
- [ ] Storage option evaluation document
- [ ] Redis integration implementation
- [ ] Session reliability improvements
- [ ] Horizontal scaling capability

---

## Phase 9: Advanced Optimization Techniques

### Objective
Implement advanced techniques for further latency reduction.

### Step 9.1: Predictive Generation
**Actions:**
1. **Implement prefetch for likely actions:**
   - When user selects file, begin background analysis
   - Pre-warm Gemini connection
   - Cache common prompt templates

2. **Speculative generation:**
   - Generate most common content type first
   - Background-generate others based on usage patterns
   - A/B test different generation orders

### Step 9.2: Prompt Caching (Gemini Feature)
**Actions:**
1. **Research Gemini prompt caching:**
   - Check if Gemini supports context/prompt caching
   - Implement cached prompts for system instructions
   - Estimated token reduction: 30-50%

2. **Implement prompt templates:**
   - Pre-compile static portions of prompts
   - Cache compiled prompts in memory
   - Reduce string concatenation overhead

### Step 9.3: Worker Thread Optimization
**Actions:**
1. **Offload CPU-intensive tasks:**
   - File processing → worker thread
   - JSON parsing/validation → worker thread
   - Response compression → worker thread

2. **Implement worker pool:**
   ```javascript
   const workerPool = new Piscina({
     filename: './workers/processFile.js',
     maxThreads: 4
   });
   ```

### Deliverables
- [ ] Predictive generation implementation
- [ ] Prompt caching investigation results
- [ ] Worker thread optimization
- [ ] Additional latency reduction (target: 10-20%)

---

## Phase 10: Monitoring & Continuous Optimization

### Objective
Implement ongoing monitoring and establish processes for continuous performance improvement.

### Step 10.1: Performance Monitoring Dashboard
**Actions:**
1. **Implement metrics collection:**
   - Request latency histograms
   - Content generation times by type
   - Cache hit rates
   - Error rates and types

2. **Create alerting rules:**
   - P95 latency exceeds threshold
   - Cache hit rate drops below target
   - Error rate spike detection

### Step 10.2: A/B Testing Framework
**Actions:**
1. **Implement feature flags:**
   - Toggle optimizations on/off
   - Gradual rollout capability
   - Quick rollback support

2. **Create A/B testing capability:**
   - Route percentage of traffic to variants
   - Measure impact on latency
   - Statistical significance testing

### Step 10.3: Performance Regression Prevention
**Actions:**
1. **Add performance tests:**
   ```javascript
   test('roadmap generation completes under 30s', async () => {
     const start = Date.now();
     await generateRoadmap(testContent);
     expect(Date.now() - start).toBeLessThan(30000);
   });
   ```

2. **CI/CD performance gates:**
   - Block deploys that regress performance
   - Automatic benchmark comparison
   - Performance budget enforcement

### Deliverables
- [ ] Monitoring dashboard deployed
- [ ] Alerting rules configured
- [ ] Performance regression tests
- [ ] Continuous optimization process documented

---

## Implementation Timeline Summary

| Phase | Description | Priority | Complexity |
|-------|-------------|----------|------------|
| 1 | Baseline & Instrumentation | Critical | Low |
| 2 | Gemini API Optimization | Critical | Medium |
| 3 | Response Streaming | High | High |
| 4 | Caching Layer | High | Medium |
| 5 | Input Processing | Medium | Low |
| 6 | Frontend Rendering | Medium | Medium |
| 7 | Network Optimization | Medium | Low |
| 8 | Database & Persistence | Medium | High |
| 9 | Advanced Techniques | Low | High |
| 10 | Monitoring & CI | Ongoing | Medium |

---

## Expected Outcomes

### Latency Reduction Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Time to First Content | 60-120s | 15-30s | 75% |
| Total Generation Time | 2-5 min | 1-2 min | 50% |
| API Token Usage | Baseline | -30% | Cost savings |
| Cache Hit Rate | 0% | 30%+ | API savings |
| Frontend Render Time | Unknown | <100ms | Instant feel |

### Success Criteria

1. **Time to First Content (TTFC):** <30 seconds for first view ready
2. **Total Generation:** <2 minutes for all 4 content types
3. **Cache Hit Rate:** >30% for repeat/similar requests
4. **API Cost:** 30% reduction in Gemini API calls
5. **User Satisfaction:** Perceived instant response after upload

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Streaming complexity | High | Fallback to polling, feature flag |
| Cache invalidation bugs | Medium | Conservative TTL, manual purge endpoint |
| Redis unavailability | High | In-memory fallback, health checks |
| Prompt changes break output | High | Version prompts, A/B test changes |
| Performance regression | Medium | CI gates, automated benchmarks |

---

## Next Steps

1. **Immediate:** Implement Phase 1 instrumentation to establish baseline
2. **Week 1-2:** Focus on Phase 2 (Gemini optimization) for quick wins
3. **Week 3-4:** Implement Phase 3 (streaming) for perceived latency improvement
4. **Ongoing:** Phases 4-10 based on measured impact and priorities

---

*Document Version: 1.0*
*Created: Performance Review Planning Phase*
*Last Updated: Initial Creation*
