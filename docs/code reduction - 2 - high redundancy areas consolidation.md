# Code Reduction Plan 2: High-Redundancy Areas Consolidation

**Estimated Reduction:** 4,000 - 8,000 LOC
**Risk Level:** Medium
**Priority:** High (Major Impact)

---

## Overview

This plan targets the four highest-redundancy areas identified in the codebase analysis:

1. **Feedback Systems** (5 files, ~3,125 LOC)
2. **Optimization Layer** (19 files, ~7,558 LOC)
3. **Training Utilities** (6+ files, ~3,267 LOC)
4. **Monolithic Files** (3 files, ~4,291 LOC)

---

## Target Area 1: Feedback Systems Consolidation

### Current State

| File | LOC | Purpose |
|------|-----|---------|
| `server/utils/feedbackAnalytics.js` | ~614 | Analytics and reporting |
| `server/utils/feedbackStorage.js` | ~653 | Persistence layer |
| `server/utils/feedbackSimulation.js` | ~958 | Test data generation |
| `server/utils/hybridFeedback.js` | ~438 | Combined approach |
| `server/utils/feedbackSchema.js` | ~462 | Schema definitions |

**Total:** ~3,125 LOC across 5 files with overlapping functionality

### Phase 1.1: Analysis (Day 1)

```bash
# Map all exports from feedback modules
grep -n "export" server/utils/feedback*.js server/utils/hybridFeedback.js

# Find all consumers
grep -rn "feedbackAnalytics\|feedbackStorage\|feedbackSimulation\|hybridFeedback" server/ --include="*.js"
```

### Phase 1.2: Design Unified Module (Day 1)

Create unified architecture:

```
server/utils/feedback/
├── index.js          # Public API (re-exports)
├── storage.js        # Core storage operations
├── analytics.js      # Analytics computations
├── types.js          # Shared types/constants
└── testing.js        # Test utilities (dev only)
```

### Phase 1.3: Implementation (Day 2-3)

**Step 1:** Create new unified module structure
**Step 2:** Migrate storage operations to `storage.js`
**Step 3:** Migrate analytics to `analytics.js`
**Step 4:** Update all imports across codebase
**Step 5:** Delete legacy files
**Step 6:** Run tests

### Phase 1.4: Verification

```bash
# Ensure no references to old modules
grep -rn "feedbackAnalytics\|feedbackStorage\|feedbackSimulation\|hybridFeedback\|feedbackSchema" server/ --include="*.js"
# Should return 0 results

npm test
```

**Expected Reduction:** 800-1,200 LOC (consolidation + deduplication)

---

## Target Area 2: Optimization Layer Consolidation

### Current State

```
server/layers/optimization/ (19 files, ~7,558 LOC)
├── index.js (408 LOC)
├── cache-optimizer.js (570 LOC)
├── performance-tuner.js (568 LOC)
├── prompt-optimizer.js (570 LOC)
├── metrics/ (4 files, 1,164 LOC)
│   ├── collector.js, index.js, schema.js, storage.js
├── dashboard/ (2 files, 623 LOC)
│   ├── aggregator.js, index.js
├── variants/ (4 files, 1,476 LOC)
│   ├── definitions.js, index.js, registry.js, data/variants.json
├── evolution/ (3 files, 1,191 LOC)
│   ├── generator.js, index.js, scheduler.js
└── experiments/ (2 files, 988 LOC)
    ├── index.js, manager.js
```

### Phase 2.1: Dependency Mapping (Day 1)

```bash
# Create dependency graph
for file in server/layers/optimization/**/*.js; do
  echo "=== $file ==="
  grep -h "import\|require" "$file"
done > reports/optimization-deps.txt
```

### Phase 2.2: Identify Consolidation Groups (Day 1-2)

| Group | Current Files | Current LOC | Target |
|-------|---------------|-------------|--------|
| **Caching** | cache-optimizer.js | 570 | `caching.js` |
| **Metrics** | metrics/* (4 files) | 1,164 | `metrics.js` |
| **Experiments** | experiments/* + variants/* (6 files) | 2,464 | `experiments.js` |
| **Performance** | performance-tuner.js + dashboard/* (3 files) | 1,191 | `performance.js` |
| **Prompts** | prompt-optimizer.js + evolution/* (4 files) | 1,761 | `prompts.js` |

### Phase 2.3: Consolidation Strategy (Day 2-4)

**Target Structure:**

```
server/layers/optimization/
├── index.js           # Public API
├── caching.js         # All caching logic (~800 LOC)
├── metrics.js         # Metrics collection (~600 LOC)
├── experiments.js     # A/B testing, variants (~700 LOC)
├── performance.js     # Performance monitoring (~600 LOC)
└── prompts.js         # Prompt optimization (~800 LOC)
```

**Consolidation Rules:**
1. Merge files with <200 LOC into parent module
2. Extract truly shared utilities to `server/utils/`
3. Remove duplicate metric collection code
4. Unify similar optimization strategies

### Phase 2.4: Implementation Order

1. Start with lowest-dependency module (likely metrics)
2. Update imports in consuming code
3. Move to next module
4. Repeat until all consolidated
5. Delete empty/unused files

**Expected Reduction:** 1,800-3,000 LOC

---

## Target Area 3: Training Utilities Consolidation

### Current State

| File | LOC | Purpose |
|------|-----|---------|
| `server/utils/statisticalTraining.js` | ~461 | Statistical methods |
| `server/utils/sequentialAnalysis.js` | ~404 | Sequential processing |
| `server/utils/scoringTests.js` | ~566 | Score validation |
| `server/utils/advancedOptimizer.js` | ~699 | Advanced optimization |
| `server/utils/trendAnalysis.js` | ~572 | Trend detection |
| `server/utils/qualityDimensions.js` | ~565 | Quality metrics |

**Total:** ~3,267 LOC with significant overlap

**Note:** Additional related files exist including statisticalUtils.js (403 LOC), hypothesisTesting.js (617 LOC), anomalyDetection.js (587 LOC), and others totaling 5,000+ additional lines.

### Phase 3.1: Functional Analysis (Day 1)

Map overlapping functionality:

```bash
# Find common patterns
grep -h "function\|const.*=.*=>" server/utils/statistical*.js server/utils/sequential*.js server/utils/scoring*.js server/utils/advanced*.js server/utils/trend*.js
```

### Phase 3.2: Design Unified Training Module (Day 1)

```
server/utils/training/
├── index.js          # Public API
├── statistics.js     # Statistical computations
├── analysis.js       # Sequential + trend analysis
├── scoring.js        # All scoring logic
└── optimization.js   # Advanced optimization
```

### Phase 3.3: Merge Strategy (Day 2-3)

| Current Files | Target File | Shared Logic |
|---------------|-------------|--------------|
| statisticalTraining.js | statistics.js | Mean, variance, distribution |
| sequentialAnalysis.js + trendAnalysis.js | analysis.js | Time-series processing |
| scoringTests.js + qualityDimensions.js | scoring.js | Score calculation |
| advancedOptimizer.js | optimization.js | Optimization algorithms |

### Phase 3.4: Implementation

1. Create new directory structure
2. Identify and extract common statistical functions
3. Merge analysis modules
4. Consolidate scoring logic
5. Update all imports
6. Delete legacy files

**Expected Reduction:** 1,000-1,600 LOC

---

## Target Area 4: Monolithic File Refactoring

### Current State

| File | Size | Issues |
|------|------|--------|
| `server/generators.js` | 84 KB (~2,610 LOC) | Multiple responsibilities |
| `Public/main.js` | 28 KB (~654 LOC) | UI + logic mixed |
| `Public/viewer.js` | 40 KB (~1,027 LOC) | Rendering + state |

### Phase 4.1: generators.js Analysis (Day 1)

```bash
# Identify logical sections
grep -n "// ==\|function\|class\|export" server/generators.js | head -50
```

Likely sections to extract:
- Chart generation logic
- Document processing
- Slide generation
- Research analysis
- Shared utilities

### Phase 4.2: generators.js Decomposition (Day 2-3)

**Target Structure:**

```
server/generators/
├── index.js           # Public API (re-exports)
├── charts.js          # Gantt chart generation
├── documents.js       # Document processing
├── slides.js          # Slide generation
├── research.js        # Research analysis
└── shared.js          # Common utilities
```

**Extraction Process:**
1. Identify function boundaries
2. Map internal dependencies
3. Extract to new files maintaining interfaces
4. Update imports in routes
5. Delete from monolith
6. Verify functionality

### Phase 4.3: main.js Decomposition (Day 3-4)

**Target Structure:**

```
Public/
├── main.js            # Slim entry point (~150 LOC)
├── app/
│   ├── init.js        # Initialization logic
│   ├── events.js      # Event handlers
│   ├── api.js         # API calls
│   └── ui.js          # UI manipulation
```

### Phase 4.4: viewer.js Decomposition (Day 4-5)

**Target Structure:**

```
Public/
├── viewer.js          # Slim entry point (~200 LOC)
├── viewer/
│   ├── renderer.js    # Rendering logic
│   ├── state.js       # State management
│   ├── controls.js    # User controls
│   └── export.js      # Export functionality
```

**Expected Reduction:** 1,000-2,000 LOC (through deduplication and removal of dead code within monoliths)

---

## Implementation Schedule

| Week | Target | Files | Est. Reduction |
|------|--------|-------|----------------|
| 1 | Feedback Systems | 5 → 4 (reorganized) | 800-1,200 LOC |
| 1-2 | Optimization Layer | 19 → 6 | 1,800-3,000 LOC |
| 2 | Training Utilities | 6 → 4 | 1,000-1,600 LOC |
| 2-3 | Monolithic Files | 3 → 12 (modular) | 1,000-2,000 LOC |

**Total Estimated Reduction:** 4,600-7,800 LOC

---

## Risk Mitigation

### Before Each Consolidation

1. **Create feature branch:**
   ```bash
   git checkout -b refactor/consolidate-<area>
   ```

2. **Ensure test coverage:**
   ```bash
   npm test -- --coverage --collectCoverageFrom="server/utils/feedback*.js"
   ```

3. **Document current behavior:**
   - List all exports
   - Document all consumers
   - Note any side effects

### During Consolidation

1. Keep old files until new ones verified
2. Use import aliases for gradual migration
3. Run tests after each file migration

### After Consolidation

1. Full test suite pass
2. Manual smoke testing
3. Code review before merge
4. Monitor for runtime errors

---

## Verification Checklist

For each consolidated area:

- [ ] All original functionality preserved
- [ ] All tests pass
- [ ] No orphaned imports
- [ ] New module properly exported
- [ ] Documentation updated
- [ ] Old files deleted
- [ ] Bundle size reduced

---

## Success Criteria

- [ ] Feedback systems: 5 files → unified module
- [ ] Optimization layer: 19 files → 6 files
- [ ] Training utilities: 6 files → 4 files
- [ ] Monolithic files: Each split into focused modules
- [ ] Minimum 4,600 LOC net reduction
- [ ] All tests passing
- [ ] No functionality regression
