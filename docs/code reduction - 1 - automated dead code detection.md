# Code Reduction Plan 1: Automated Dead Code Detection

**Estimated Reduction:** 2,000 - 5,000 LOC
**Risk Level:** Low
**Priority:** Highest (Run First)

---

## Overview

This plan uses automated tooling to identify and remove dead code with minimal manual review. Dead code includes unused exports, unreferenced files, orphaned dependencies, and duplicate code blocks.

---

## Phase 1: Tool Setup & Baseline (Day 1)

### 1.1 Verify Existing Tools

```bash
# Check knip is configured (already in knip.json)
cat knip.json

# Verify dependencies are installed
npm ls knip depcheck
```

### 1.2 Install Additional Tools

```bash
# Install duplicate code detector
npm install -D jscpd

# Install unused dependency checker (if not present)
npm install -D depcheck
```

### 1.3 Create Baseline Report

```bash
# Count current lines
find server Public -name "*.js" | xargs wc -l > docs/baseline-loc.txt

# Document current file count
find server Public -name "*.js" | wc -l >> docs/baseline-loc.txt
```

---

## Phase 2: Unused Export Analysis (Day 1-2)

### 2.1 Run Knip Analysis

```bash
# Generate full report
npx knip --reporter json > reports/knip-report.json

# Human-readable summary
npx knip
```

### 2.2 Categorize Findings

Create a triage document with these categories:

| Category | Action | Risk |
|----------|--------|------|
| Unused files | Delete after verification | Low |
| Unused exports | Remove export, keep if internal | Low |
| Unused dependencies | Remove from package.json | Low |
| Unused devDependencies | Remove from package.json | Very Low |

### 2.3 Safe Removal Checklist

For each unused item:

- [ ] Search entire codebase for references (including dynamic imports)
- [ ] Check if used in tests
- [ ] Check if referenced in documentation
- [ ] Verify not used via dynamic `require()` or `import()`
- [ ] Remove and run test suite

---

## Phase 3: Duplicate Code Detection (Day 2-3)

### 3.1 Run jscpd Analysis

```bash
# Server-side duplicates
npx jscpd server/ \
  --min-lines 10 \
  --min-tokens 50 \
  --reporters "json,console" \
  --output reports/duplicates-server

# Frontend duplicates
npx jscpd Public/ \
  --min-lines 10 \
  --min-tokens 50 \
  --reporters "json,console" \
  --output reports/duplicates-public
```

### 3.2 Analyze Duplicate Report

Focus on duplicates with:
- **Lines > 20**: High-value consolidation targets
- **Same directory**: Easy to extract to shared module
- **Cross-directory**: May indicate missing abstraction

### 3.3 Consolidation Patterns

| Pattern | Solution |
|---------|----------|
| Identical functions in multiple files | Extract to shared utility |
| Similar validation logic | Create generic validator factory |
| Repeated error handling | Create error handling middleware |
| Copy-pasted API calls | Create service layer abstraction |

---

## Phase 4: Dependency Audit (Day 3)

### 4.1 Run Depcheck

```bash
npx depcheck --json > reports/depcheck-report.json
npx depcheck
```

### 4.2 Review Unused Dependencies

For each unused dependency:

```bash
# Search for any usage pattern
grep -r "package-name" --include="*.js" --include="*.json" .
```

### 4.3 Safe Removal Process

```bash
# Remove one at a time
npm uninstall <package-name>

# Verify app still works
npm run build
npm test
npm start  # Quick smoke test
```

### 4.4 Document Removals

Keep a log of removed dependencies:

```markdown
## Removed Dependencies

| Package | Reason | Date | Verified By |
|---------|--------|------|-------------|
| example-pkg | No imports found | YYYY-MM-DD | knip + grep |
```

---

## Phase 5: Unreachable Code Detection (Day 4)

### 5.1 ESLint Dead Code Rules

Add to `eslint.config.js`:

```javascript
{
  rules: {
    'no-unreachable': 'error',
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-unused-expressions': 'error',
    'no-useless-return': 'error',
    'no-empty-function': 'warn'
  }
}
```

### 5.2 Run Enhanced Linting

```bash
npx eslint server/ Public/ --fix --report-unused-disable-directives
```

### 5.3 Manual Inspection Targets

Check for:
- Functions defined but never called
- Variables assigned but never read
- Imports that are never used
- Code after `return`, `throw`, `break`, `continue`

---

## Phase 6: Verification & Cleanup (Day 5)

### 6.1 Run Full Test Suite

```bash
npm test
```

### 6.2 Build Verification

```bash
npm run build
```

### 6.3 Smoke Test Application

```bash
npm start
# Test critical paths manually:
# - Chart generation
# - Document analysis
# - File upload
# - Export functionality
```

### 6.4 Generate Final Report

```bash
# New line count
find server Public -name "*.js" | xargs wc -l > docs/post-cleanup-loc.txt

# Calculate reduction
echo "=== LOC Reduction ===" >> docs/post-cleanup-loc.txt
```

---

## Expected Outcomes

| Metric | Before | After (Est.) | Reduction |
|--------|--------|--------------|-----------|
| JavaScript Files | 163 | 155-160 | 3-8 files |
| Total LOC | 71,122 | 66,000-69,000 | 2,000-5,000 |
| Dependencies | TBD | TBD | 2-5 packages |
| Duplicate Blocks | TBD | 0 critical | 100% critical |

---

## Rollback Plan

If issues arise:

```bash
# All changes should be committed incrementally
git log --oneline -20  # Find last good commit
git revert <commit-hash>  # Revert specific change
# OR
git reset --hard <commit-hash>  # Full rollback (destructive)
```

---

## Files to Create

- [ ] `reports/knip-report.json`
- [ ] `reports/duplicates-server/`
- [ ] `reports/duplicates-public/`
- [ ] `reports/depcheck-report.json`
- [ ] `docs/baseline-loc.txt`
- [ ] `docs/post-cleanup-loc.txt`
- [ ] `docs/removed-dependencies.md`

---

## Success Criteria

- [ ] All tests pass
- [ ] Application builds successfully
- [ ] No runtime errors in critical paths
- [ ] Minimum 2,000 LOC reduction achieved
- [ ] Zero unused dependencies remain
- [ ] No duplicate code blocks > 20 lines
