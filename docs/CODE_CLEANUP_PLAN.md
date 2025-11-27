# Codebase Cleanup Plan: Dead & Unused Code Removal

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
