# Code Reduction Plan 3: Systematic Review Process

**Estimated Reduction:** 3,000 - 6,000 LOC
**Risk Level:** Medium
**Priority:** Medium (Thorough Analysis Required)

---

## Overview

This plan establishes a systematic, file-by-file review process to identify reduction opportunities that automated tools miss. It focuses on:

1. Export/Import analysis
2. Cross-layer duplicate detection
3. Consolidation opportunities
4. Verbose implementation cleanup
5. Legacy code removal

---

## Phase 1: Generate Comprehensive Reports (Day 1)

### 1.1 Export Analysis

Create a complete export inventory:

```bash
# Create reports directory
mkdir -p reports/systematic-review

# All exports from server
grep -rn "^export " server/ --include="*.js" > reports/systematic-review/server-exports.txt

# All exports from Public
grep -rn "^export " Public/ --include="*.js" > reports/systematic-review/public-exports.txt

# Count exports per file
for f in $(find server Public -name "*.js"); do
  count=$(grep -c "^export " "$f" 2>/dev/null || echo 0)
  echo "$count $f"
done | sort -rn > reports/systematic-review/exports-per-file.txt
```

### 1.2 Import Analysis

Map all dependencies:

```bash
# All imports in server
grep -rn "^import " server/ --include="*.js" > reports/systematic-review/server-imports.txt

# All imports in Public
grep -rn "^import " Public/ --include="*.js" > reports/systematic-review/public-imports.txt

# Find relative imports (internal dependencies)
grep -rh "from '\.\." server/ --include="*.js" | sort | uniq -c | sort -rn > reports/systematic-review/internal-deps.txt
```

### 1.3 Function Size Analysis

Identify overly large functions:

```bash
# This requires manual review or AST analysis
# Create a checklist of files to review for large functions
find server Public -name "*.js" -exec wc -l {} \; | sort -rn | head -30 > reports/systematic-review/large-files.txt
```

---

## Phase 2: Cross-Layer Duplicate Detection (Day 2)

### 2.1 Layer Comparison Matrix

Compare these layer pairs for duplicates:

| Layer A | Layer B | Check For |
|---------|---------|-----------|
| `optimization/` | `utils/` | Performance utilities |
| `monitoring/` | `observability/` | Metric collection |
| `evaluation/` | `output/` | Quality scoring |
| `input-safety/` | `middleware.js` | Validation logic |
| `routing/` | `routes/` | Request handling |

### 2.2 Functional Overlap Detection

```bash
# Find similar function names across layers
grep -rh "function \|const .* = " server/layers/ --include="*.js" | \
  sed 's/.*function //' | sed 's/(.*//' | sort | uniq -d > reports/systematic-review/duplicate-functions.txt

# Find similar class names
grep -rh "class " server/layers/ --include="*.js" | \
  sed 's/.*class //' | sed 's/ .*//' | sort | uniq -d >> reports/systematic-review/duplicate-functions.txt
```

### 2.3 Manual Comparison Checklist

For each layer pair, review:

- [ ] `server/layers/optimization/` vs `server/utils/networkOptimizer.js`
- [ ] `server/layers/monitoring/` vs `server/layers/observability/`
- [ ] `server/layers/evaluation/` vs `server/utils/qualityDimensions.js`
- [ ] `server/layers/output/` vs `server/utils/` output-related files
- [ ] `server/layers/context/` vs `server/prompts.js` context handling

---

## Phase 3: Consolidation Opportunity Analysis (Day 3)

### 3.1 Single-Use Module Detection

Find modules imported by only one file:

```bash
# For each module, count importers
for module in $(find server -name "*.js" -path "*/utils/*"); do
  name=$(basename "$module" .js)
  count=$(grep -rl "$name" server/ --include="*.js" | wc -l)
  echo "$count $module"
done | sort -n > reports/systematic-review/import-counts.txt
```

**Action for single-use modules:**
- Consider inlining into the consumer
- Or deleting if functionality is unused

### 3.2 Circular Dependency Detection

```bash
# Install madge for dependency analysis
npm install -D madge

# Generate circular dependency report
npx madge --circular server/ > reports/systematic-review/circular-deps.txt

# Generate dependency graph
npx madge --image reports/systematic-review/deps-graph.svg server/
```

### 3.3 Consolidation Candidates

Create consolidation matrix:

| Small Module (<100 LOC) | Potential Parent | Reason |
|------------------------|------------------|--------|
| List from analysis | Target module | Shared domain |

---

## Phase 4: Verbose Implementation Cleanup (Day 4-5)

### 4.1 Pattern Detection

Search for verbose patterns to simplify:

```bash
# Verbose null checks (can use optional chaining)
grep -rn "if.*!= null\|if.*!== null\|if.*!= undefined" server/ Public/ --include="*.js" > reports/systematic-review/verbose-null-checks.txt

# Verbose object property access
grep -rn "&&.*&&.*&&" server/ Public/ --include="*.js" > reports/systematic-review/chained-ands.txt

# Verbose array operations
grep -rn "\.forEach\|\.map\|\.filter\|\.reduce" server/ Public/ --include="*.js" | wc -l
```

### 4.2 Simplification Opportunities

| Pattern | Modern Alternative | LOC Saved |
|---------|-------------------|-----------|
| `if (x !== null && x !== undefined)` | `if (x != null)` or `x?.` | 1-2 per instance |
| `obj && obj.prop && obj.prop.value` | `obj?.prop?.value` | 2-3 per instance |
| Manual promise chains | async/await | 3-5 per chain |
| Verbose try-catch | Error boundary patterns | 2-4 per block |
| Repeated validation | Validation schemas | 10-20 per form |

### 4.3 Common Verbose Patterns to Fix

**Before:**
```javascript
let result;
if (data !== null && data !== undefined) {
  if (data.items !== null && data.items !== undefined) {
    result = data.items;
  } else {
    result = [];
  }
} else {
  result = [];
}
```

**After:**
```javascript
const result = data?.items ?? [];
```

**Savings:** 10 lines → 1 line

### 4.4 Review Checklist by File Type

**Utility Files (`server/utils/`):**
- [ ] Replace verbose conditionals with optional chaining
- [ ] Use nullish coalescing (`??`) instead of `||` for defaults
- [ ] Replace `forEach` with `for...of` where appropriate
- [ ] Inline single-use helper functions

**Route Handlers (`server/routes/`):**
- [ ] Extract repeated validation to middleware
- [ ] Consolidate similar error handling
- [ ] Use route-level try-catch wrappers

**Frontend Files (`Public/`):**
- [ ] Replace verbose DOM queries with cached references
- [ ] Consolidate repeated event handlers
- [ ] Use event delegation where possible

---

## Phase 5: Legacy Code Removal (Day 6-7)

### 5.1 Identify Legacy Markers

```bash
# Find TODO/FIXME/HACK comments
grep -rn "TODO\|FIXME\|HACK\|DEPRECATED\|XXX\|LEGACY" server/ Public/ --include="*.js" > reports/systematic-review/legacy-markers.txt

# Find commented-out code blocks
grep -rn "^[[:space:]]*//.*function\|^[[:space:]]*//.*const\|^[[:space:]]*//.*class" server/ Public/ --include="*.js" > reports/systematic-review/commented-code.txt

# Find old date references
grep -rn "2022\|2023" server/ Public/ --include="*.js" > reports/systematic-review/old-dates.txt
```

### 5.2 Legacy Code Categories

| Category | Action | Risk |
|----------|--------|------|
| Commented-out code | Delete | Very Low |
| TODO: never done | Delete or implement | Low |
| DEPRECATED functions | Remove if unused | Medium |
| Backwards-compat shims | Remove if not needed | Medium |
| Feature flags (always on) | Remove conditional | Low |
| Feature flags (always off) | Delete dead code | Low |

### 5.3 Backwards Compatibility Audit

Search for compatibility code:

```bash
# Find compatibility patterns
grep -rn "legacy\|compat\|deprecated\|old\|v1\|v2" server/ Public/ --include="*.js" -i > reports/systematic-review/compat-code.txt

# Find unused exports kept for compatibility
# Cross-reference with knip report
```

### 5.4 Safe Removal Process

For each legacy item:

1. **Verify not in use:**
   ```bash
   grep -rn "function_name" . --include="*.js"
   ```

2. **Check git history for context:**
   ```bash
   git log -p --all -S "function_name" -- "*.js"
   ```

3. **Remove and test:**
   ```bash
   # Make change
   npm test
   npm run build
   ```

---

## Phase 6: File-by-File Review Protocol (Day 8-10)

### 6.1 Priority Review Order

1. **Largest files first** (most reduction potential)
2. **Utility files** (often accumulate cruft)
3. **Route handlers** (often have repeated patterns)
4. **Layer modules** (may have overlap)

### 6.2 Per-File Review Checklist

For each file, check:

- [ ] **Unused imports** - Remove any not referenced
- [ ] **Unused variables** - Delete or prefix with `_`
- [ ] **Unused functions** - Delete if not exported/called
- [ ] **Duplicate logic** - Extract to shared function
- [ ] **Verbose patterns** - Apply modern JS simplifications
- [ ] **Dead code paths** - Remove unreachable code
- [ ] **Commented code** - Delete (it's in git history)
- [ ] **Console.log statements** - Remove debug logging
- [ ] **Overly defensive code** - Trust internal APIs

### 6.3 Review Tracking Spreadsheet

Create tracking document:

| File | LOC Before | LOC After | Reduction | Reviewer | Date | Notes |
|------|------------|-----------|-----------|----------|------|-------|
| server/utils/file.js | 400 | 350 | 50 | - | - | - |

---

## Phase 7: Verification & Documentation (Day 11)

### 7.1 Full Verification

```bash
# Run all tests
npm test

# Build verification
npm run build

# Lint check
npm run lint

# Start application
npm start
```

### 7.2 Generate Final Report

```bash
# Count final LOC
find server Public -name "*.js" | xargs wc -l > reports/systematic-review/final-loc.txt

# Compare with baseline
diff reports/systematic-review/baseline-loc.txt reports/systematic-review/final-loc.txt
```

### 7.3 Document Changes

Create summary document with:
- Files modified
- Files deleted
- Total LOC reduction
- Patterns applied
- Lessons learned

---

## Tools & Scripts

### Automated Review Script

Create `scripts/review-file.sh`:

```bash
#!/bin/bash
FILE=$1

echo "=== Reviewing: $FILE ==="
echo "Lines: $(wc -l < "$FILE")"
echo ""
echo "Exports:"
grep -c "^export " "$FILE"
echo ""
echo "Imports:"
grep -c "^import " "$FILE"
echo ""
echo "Functions:"
grep -c "function \|=> {" "$FILE"
echo ""
echo "TODOs:"
grep -n "TODO\|FIXME" "$FILE"
echo ""
echo "Potential issues:"
grep -n "console.log\|debugger" "$FILE"
```

### Batch Analysis Script

Create `scripts/analyze-all.sh`:

```bash
#!/bin/bash
for file in $(find server Public -name "*.js"); do
  ./scripts/review-file.sh "$file" >> reports/systematic-review/all-files-analysis.txt
  echo "---" >> reports/systematic-review/all-files-analysis.txt
done
```

---

## Expected Outcomes

| Category | Est. Reduction |
|----------|---------------|
| Verbose patterns simplified | 500-1,000 LOC |
| Legacy/commented code removed | 300-500 LOC |
| Cross-layer duplicates merged | 800-1,500 LOC |
| Single-use modules inlined | 400-800 LOC |
| Unused code paths removed | 500-1,000 LOC |
| Console/debug statements removed | 100-200 LOC |
| **Total** | **2,600-5,000 LOC** |

---

## Success Criteria

- [ ] All files reviewed per checklist
- [ ] Reports generated for all phases
- [ ] Minimum 3,000 LOC reduction
- [ ] All tests passing
- [ ] No functionality regression
- [ ] Documentation updated
- [ ] Review findings documented for future reference
