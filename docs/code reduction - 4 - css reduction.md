# Code Reduction Plan 4: CSS Reduction

**Estimated Reduction:** 2,000 - 4,000 LOC (CSS)
**Risk Level:** Low-Medium
**Priority:** Medium (Visual Impact Requires Testing)

---

## Overview

Current CSS footprint: **9,290 LOC across 12 files**

This plan targets:
1. Unused CSS removal with PurgeCSS
2. Duplicate style consolidation
3. TailwindCSS optimization
4. CSS file merging
5. Redundant selector cleanup

---

## Current CSS Inventory

| File | Size | Purpose |
|------|------|---------|
| `Public/style.css` | ~4,543 LOC | Combined main stylesheet |
| `Public/styles/design-system.css` | ~1,383 LOC | Primary design system |
| `Public/styles/analysis-view.css` | ~1,221 LOC | Analysis interface |
| `Public/styles/gantt.css` | ~788 LOC | Gantt chart styles |
| `Public/styles/analysis.css` | ~506 LOC | Additional analysis |
| `Public/styles/app-shell.css` | ~450 LOC | App shell/layout |
| `Public/styles/modal.css` | ~197 LOC | Modal dialogs |
| `Public/styles/base.css` | ~109 LOC | Base/reset styles |
| `Public/styles/responsive.css` | ~53 LOC | Responsive breakpoints |
| `Public/styles/index.css` | ~37 LOC | Index/entry point |
| `Public/styles/tailwind-source.css` | ~3 LOC | Tailwind source |
| `Public/styles/tailwind.css` | 0 LOC | Compiled TailwindCSS (empty) |

**Total:** ~9,290 LOC

**Note:** `tailwind.css` is currently empty (0 LOC). Tailwind styles may have been integrated into `style.css`.

---

## Phase 1: PurgeCSS Analysis (Day 1)

### 1.1 Verify PurgeCSS Configuration

```bash
# Check existing config
cat purgecss.config.cjs
```

### 1.2 Run PurgeCSS Dry Run

```bash
# Install if needed
npm install -D purgecss

# Create analysis script
cat > scripts/analyze-css.mjs << 'EOF'
import { PurgeCSS } from 'purgecss';
import fs from 'fs';

const results = await new PurgeCSS().purge({
  content: ['Public/**/*.html', 'Public/**/*.js'],
  css: ['Public/styles/**/*.css'],
  rejected: true,
  rejectedCss: true
});

// Write rejected selectors report
let report = '# Unused CSS Selectors\n\n';
for (const result of results) {
  if (result.rejected && result.rejected.length > 0) {
    report += `## ${result.file}\n`;
    report += `Unused selectors: ${result.rejected.length}\n\n`;
    report += result.rejected.slice(0, 50).join('\n') + '\n\n';
  }
}

fs.writeFileSync('reports/unused-css.md', report);
console.log('Report written to reports/unused-css.md');
EOF

node scripts/analyze-css.mjs
```

### 1.3 Generate Size Comparison

```bash
# Before sizes
wc -l Public/styles/*.css > reports/css-before.txt

# After PurgeCSS (estimate)
npx purgecss --css Public/styles/*.css --content Public/**/*.html Public/**/*.js --output temp-purged/
wc -l temp-purged/*.css > reports/css-after-purge.txt
```

---

## Phase 2: Duplicate Style Detection (Day 2)

### 2.1 Install CSS Analysis Tool

```bash
npm install -D csscss stylelint
```

### 2.2 Find Duplicate Declarations

```bash
# Using csscss (if available) or manual grep
# Find repeated property-value pairs

# Color duplicates
grep -rh "color:" Public/styles/*.css | sort | uniq -c | sort -rn | head -20 > reports/duplicate-colors.txt

# Margin/padding duplicates
grep -rh "margin:\|padding:" Public/styles/*.css | sort | uniq -c | sort -rn | head -20 > reports/duplicate-spacing.txt

# Font duplicates
grep -rh "font-" Public/styles/*.css | sort | uniq -c | sort -rn | head -20 > reports/duplicate-fonts.txt
```

### 2.3 Identify Redundant Selectors

```bash
# Find selectors defined multiple times
grep -rh "^\." Public/styles/*.css | sed 's/{.*//' | sort | uniq -d > reports/duplicate-selectors.txt

# Find selectors with same properties
# (Manual review required)
```

### 2.4 Create Deduplication Map

| Duplicate Pattern | Files | Action |
|-------------------|-------|--------|
| `.btn` styles | design-system.css, app-shell.css | Consolidate to design-system |
| Color definitions | Multiple | Extract to CSS variables |
| Spacing values | Multiple | Use CSS variables |
| Shadow definitions | Multiple | Create shadow utility classes |

---

## Phase 3: CSS Variable Consolidation (Day 3)

### 3.1 Audit Existing Variables

```bash
# Find all CSS custom properties
grep -rh "\-\-" Public/styles/*.css | sort | uniq > reports/css-variables.txt

# Find hardcoded values that should be variables
grep -rh "#[0-9a-fA-F]\{3,6\}" Public/styles/*.css | sort | uniq -c | sort -rn > reports/hardcoded-colors.txt
```

### 3.2 Design Token Standardization

Create/update `Public/styles/variables.css`:

```css
:root {
  /* Colors */
  --color-primary: #...;
  --color-secondary: #...;
  --color-success: #...;
  --color-warning: #...;
  --color-error: #...;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;

  /* Typography */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;

  /* Shadows */
  --shadow-sm: ...;
  --shadow-md: ...;
  --shadow-lg: ...;

  /* Borders */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
}
```

### 3.3 Replace Hardcoded Values

For each CSS file:
1. Replace hardcoded colors with `var(--color-*)`
2. Replace hardcoded spacing with `var(--space-*)`
3. Replace hardcoded shadows with `var(--shadow-*)`

**LOC Reduction:** Eliminates duplicate definitions

---

## Phase 4: TailwindCSS Optimization (Day 4)

### 4.1 Audit Tailwind Usage

```bash
# Find Tailwind classes in HTML/JS
grep -rho "class=\"[^\"]*\"" Public/ --include="*.html" --include="*.js" | \
  tr ' ' '\n' | grep -v "class=" | sort | uniq > reports/used-classes.txt

# Compare with generated tailwind.css
wc -l Public/styles/tailwind.css
```

### 4.2 Configure Tailwind Purge

Update `tailwind.config.js`:

```javascript
module.exports = {
  content: [
    './Public/**/*.html',
    './Public/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Minimize output
  corePlugins: {
    // Disable unused utilities
    float: false,
    clear: false,
    // Add others not used
  }
}
```

### 4.3 Rebuild Tailwind

```bash
# Rebuild with purge enabled
npx tailwindcss -i Public/styles/tailwind-source.css -o Public/styles/tailwind.css --minify
```

**Expected Reduction:** 1,000-2,000 LOC from Tailwind alone

---

## Phase 5: CSS File Consolidation (Day 5)

### 5.1 Current Structure Analysis

```
Public/
├── style.css            # Main stylesheet (4,543 LOC) - review for consolidation
└── styles/
    ├── design-system.css    # Keep - primary system (1,383 LOC)
    ├── analysis-view.css    # Merge candidate (1,221 LOC)
    ├── analysis.css         # Merge with analysis-view.css (506 LOC)
    ├── gantt.css           # Keep - component-specific (788 LOC)
    ├── app-shell.css       # Merge into design-system (450 LOC)
    ├── modal.css           # Merge into design-system (197 LOC)
    ├── responsive.css      # Merge into design-system (53 LOC)
    ├── base.css            # Merge into design-system (109 LOC)
    ├── index.css           # Entry point (37 LOC)
    ├── tailwind-source.css # Tailwind source (3 LOC)
    └── tailwind.css        # Empty - investigate (0 LOC)
```

### 5.2 Target Structure

```
Public/styles/
├── variables.css       # CSS custom properties (new)
├── design-system.css   # Core styles (expanded)
├── components/
│   ├── gantt.css      # Gantt-specific
│   ├── analysis.css   # Analysis-specific (merged)
│   └── slides.css     # Slides-specific
├── tailwind.css       # Optimized Tailwind
└── main.css           # Import aggregator
```

### 5.3 Merge Process

**Step 1: Merge base styles**
```bash
# Combine into design-system.css
cat Public/styles/base.css >> Public/styles/design-system.css
cat Public/styles/app-shell.css >> Public/styles/design-system.css
cat Public/styles/modal.css >> Public/styles/design-system.css
cat Public/styles/responsive.css >> Public/styles/design-system.css
```

**Step 2: Merge analysis styles**
```bash
cat Public/styles/analysis.css >> Public/styles/analysis-view.css
mv Public/styles/analysis-view.css Public/styles/components/analysis.css
```

**Step 3: Update imports**
```html
<!-- Before -->
<link rel="stylesheet" href="styles/base.css">
<link rel="stylesheet" href="styles/design-system.css">
<link rel="stylesheet" href="styles/app-shell.css">
<!-- ... many more -->

<!-- After -->
<link rel="stylesheet" href="styles/main.css">
```

**Step 4: Delete merged files**

---

## Phase 6: Redundant Selector Cleanup (Day 6)

### 6.1 Find Overridden Styles

```bash
# Find selectors that are completely overridden
# (Manual review with browser DevTools recommended)
```

### 6.2 Remove Dead Selectors

Selectors to check:
- [ ] Selectors for elements that no longer exist
- [ ] Selectors overridden by later rules
- [ ] Vendor-prefixed properties no longer needed
- [ ] IE/old browser fallbacks

### 6.3 Specificity Cleanup

Find overly specific selectors:

```bash
# Find deep nesting (potential simplification)
grep -rn "^\s*\S.*\s\S.*\s\S.*\s\S.*{" Public/styles/*.css > reports/deep-selectors.txt
```

**Before:**
```css
.app-container .main-content .analysis-view .results-panel .result-item .title {
  font-weight: bold;
}
```

**After:**
```css
.result-item-title {
  font-weight: bold;
}
```

---

## Phase 7: Minification & Build Pipeline (Day 7)

### 7.1 Set Up CSS Build Pipeline

Create `scripts/build-css.mjs`:

```javascript
import { PurgeCSS } from 'purgecss';
import cssnano from 'cssnano';
import postcss from 'postcss';
import fs from 'fs';

// 1. Run PurgeCSS
const purged = await new PurgeCSS().purge({
  content: ['Public/**/*.html', 'Public/**/*.js'],
  css: ['Public/styles/**/*.css'],
  safelist: ['active', 'hidden', 'visible', 'loading']
});

// 2. Concatenate
let combined = purged.map(r => r.css).join('\n');

// 3. Minify
const result = await postcss([cssnano]).process(combined, { from: undefined });

// 4. Write output
fs.writeFileSync('Public/styles/dist/main.min.css', result.css);
```

### 7.2 Add to Package.json

```json
{
  "scripts": {
    "build:css": "node scripts/build-css.mjs",
    "build": "npm run build:css && npm run build:js"
  }
}
```

### 7.3 Production Optimization

```bash
# Final minified output
npm run build:css

# Check final size
wc -c Public/styles/dist/main.min.css
```

---

## Phase 8: Visual Verification (Day 8)

### 8.1 Create Visual Test Checklist

Test each view after CSS changes:

- [ ] **Home page** - Layout, colors, typography
- [ ] **Gantt chart view** - Chart rendering, colors, interactions
- [ ] **Analysis view** - Results display, charts, panels
- [ ] **Slides view** - Slide rendering, transitions
- [ ] **Document view** - Content display, formatting
- [ ] **Modal dialogs** - Positioning, animations
- [ ] **Responsive layouts** - Mobile, tablet, desktop
- [ ] **Dark/light themes** (if applicable)

### 8.2 Browser Testing

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### 8.3 Automated Visual Regression (Optional)

```bash
# Install BackstopJS for visual regression
npm install -D backstopjs

# Initialize
npx backstop init

# Configure scenarios in backstop.json
# Run tests
npx backstop test
```

---

## Summary: Before vs After

| Metric | Before | After (Est.) | Reduction |
|--------|--------|--------------|-----------|
| CSS Files | 12 | 4-5 | 7-8 files |
| Total LOC | 9,290 | 5,500-7,000 | 2,200-3,800 |
| Main style.css LOC | ~4,543 | ~3,000-3,500 | 1,000-1,500 |
| Component CSS LOC | ~4,747 | ~2,500-3,500 | 1,200-2,300 |
| HTTP Requests | 10+ | 1-2 | 8-9 requests |

---

## Files to Modify/Create

### New Files
- [ ] `Public/styles/variables.css`
- [ ] `Public/styles/main.css` (import aggregator)
- [ ] `scripts/build-css.mjs`

### Files to Merge & Delete
- [ ] `base.css` → merge into `design-system.css`
- [ ] `app-shell.css` → merge into `design-system.css`
- [ ] `modal.css` → merge into `design-system.css`
- [ ] `responsive.css` → merge into `design-system.css`
- [ ] `analysis.css` → merge into `analysis-view.css`
- [ ] `tailwind.css` → investigate (currently empty)
- [ ] `index.css` → merge into main entry point

### Files to Optimize
- [ ] `style.css` - deduplicate and optimize (largest file at 4,543 LOC)
- [ ] `design-system.css` - deduplicate
- [ ] All CSS - convert to CSS variables

---

## Success Criteria

- [ ] All visual tests pass
- [ ] No visual regressions
- [ ] CSS reduced by minimum 2,000 LOC
- [ ] HTTP requests reduced to 1-2 CSS files
- [ ] Build pipeline established
- [ ] CSS variables standardized
- [ ] Browser compatibility maintained
