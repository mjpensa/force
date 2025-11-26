# Gantt Chart Scaling - Design Specification

> Comprehensive scaling specification for optimizing the AI Roadmap Generator Gantt chart to display at 100% browser zoom without requiring zoom-out.

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Design Principles](#design-principles)
4. [Typography Normalization](#typography-normalization)
5. [Layout Scaling Specifications](#layout-scaling-specifications)
6. [Component Specifications](#component-specifications)
7. [JavaScript Constants](#javascript-constants)
8. [Responsive Behavior](#responsive-behavior)
9. [Implementation Checklist](#implementation-checklist)
10. [Visual Reference](#visual-reference)

---

## 1. Overview

### Purpose

This specification defines the scaling adjustments required to make the Gantt chart viewable at 100% browser zoom. Previously, users needed to zoom out significantly (often to 25-50%) to view the entire chart, which degraded readability and user experience.

### Scope

The scaling affects:
- All text elements (normalized to 0.95rem)
- Grid layout dimensions
- Legend section
- Action buttons
- Title and header areas
- Gantt bars and rows
- Research Analysis section

### Target Outcome

```
Before: Chart requires 25-50% browser zoom to view completely
After:  Chart fits within viewport at 100% browser zoom
```

---

## 2. Problem Statement

### Current Issues

| Issue | Impact |
|-------|--------|
| Oversized legend elements | Forces horizontal scrolling |
| Large button padding | Excessive vertical space consumption |
| Inconsistent font sizes | Visual hierarchy unclear, sizes range from 6px to 44px |
| Large logo and title | Consumes excessive header space |
| Wide spacing/gaps | Inefficient use of screen real estate |

### Size Audit Summary

**Elements larger than target (0.95rem / ~15px):**

| Element | Current Size | Excess Factor |
|---------|--------------|---------------|
| Chart Title | 40px | 2.6x |
| Legend Title | 44px | 2.9x |
| Legend Labels | 32px | 2.1x |
| Buttons | 20px | 1.3x |
| Logo | 70px height | - |

**Elements smaller than target:**

| Element | Current Size | Scale Factor Needed |
|---------|--------------|---------------------|
| Timeline Headers | 6px | 2.5x |
| Task Row Labels | 6px | 2.5x |
| Swimlane Labels | 7px | 2.1x |

---

## 3. Design Principles

### Scaling Philosophy

| Principle | Description |
|-----------|-------------|
| **Uniform Typography** | All text at 0.95rem creates visual consistency |
| **Proportional Spacing** | Reduce padding/margins by ~50% across all elements |
| **Compact Density** | Prioritize information density over whitespace |
| **Viewport Fit** | Chart should fit 1920px viewport at 100% zoom |
| **Maintain Hierarchy** | Use weight and color for hierarchy instead of size |

### Visual Hierarchy (New Approach)

```
┌─────────────────────────────────────────────────────────────┐
│  HIERARCHY THROUGH WEIGHT & COLOR (not size)                │
│                                                             │
│  ████ Bold 700   = Titles, Headers (e.g., Chart Title)      │
│  ███  Semi 600   = Section headers (e.g., Legend:)          │
│  ██   Medium 500 = Primary content (e.g., Task labels)      │
│  █    Regular 400= Secondary content (e.g., Descriptions)   │
│                                                             │
│  All at 0.95rem - differentiated by weight & color          │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Typography Normalization

### Base Font Size

```css
/* Target: 0.95rem (~15.2px at default browser settings) */
--font-size-base: 0.95rem;
```

### Complete Typography Map

| Element | Previous | New | Weight | File Location |
|---------|----------|-----|--------|---------------|
| `.gantt-title` | 40px | 0.95rem | 700 | style.css:91 |
| `.gantt-header` | 6px | 0.95rem | 600 | style.css:130 |
| `.gantt-row-label` | 6px | 0.95rem | 500 | style.css:147 |
| `.gantt-row-label.swimlane` | 7px | 0.95rem | 700 | style.css:251 |
| `.gantt-row-label.task` | 6px | 0.95rem | 500 | style.css:266 |
| `.row-action-btn` | 12px | 0.95rem | 700 | style.css:194 |
| `.export-button` | 20px | 0.95rem | 700 | style.css:399 |
| `.edit-mode-toggle-button` | 20px | 0.95rem | 700 | style.css:424 |
| `.copy-url-button` | 20px | 0.95rem | 700 | style.css:444 |
| `.legend-title` | 44px | 0.95rem | 700 | style.css:1540 |
| `.legend-label` | 32px | 0.95rem | 600 | style.css:1582 |
| `.collapse-icon` | 0.75rem | 0.95rem | 400 | style.css:2572 |
| `.collapse-score` | 0.9rem | 0.95rem | 600 | style.css:2591 |
| `.research-analysis-table` | 0.875rem | 0.95rem | 400 | style.css:2630 |
| `.score-badge` | 0.85rem | 0.95rem | 600 | style.css:2714 |
| `.research-analysis-legend .legend-title` | 0.9rem | 0.95rem | 600 | style.css:2757 |
| `.research-analysis-legend .legend-item` | 0.8rem | 0.95rem | 400 | style.css:2770 |

### CSS Implementation

```css
/* Typography normalization - all Gantt chart text */
.gantt-title,
.gantt-header,
.gantt-row-label,
.gantt-row-label.swimlane,
.gantt-row-label.task,
.row-action-btn,
.export-button,
.edit-mode-toggle-button,
.copy-url-button,
.legend-title,
.legend-label,
.research-analysis-collapse-header,
.research-analysis-collapse-header .collapse-icon,
.research-analysis-collapse-header .collapse-score,
.research-analysis-table,
.research-analysis-summary,
.score-badge,
.research-analysis-legend .legend-title,
.research-analysis-legend .legend-item,
.research-analysis-legend .legend-item .score-badge {
  font-size: 0.95rem;
}
```

---

## 5. Layout Scaling Specifications

### Legend Section

**Current vs Proposed:**

| Property | Current | Proposed | Reduction |
|----------|---------|----------|-----------|
| Container padding | `32px 36px` | `16px 20px` | 50% |
| Item gap | `40px` | `16px` | 60% |
| Color-to-label gap | `18px` | `8px` | 56% |
| Color box size | `36px x 36px` | `20px x 20px` | 44% |
| Color box border | `2px` | `1px` | 50% |
| Title-to-list gap | `20px` | `12px` | 40% |

**CSS Specification:**

```css
/* Legend Container - SCALED */
.gantt-legend {
  padding: 16px 20px;                    /* Was: 32px 36px */
  font-family: 'Work Sans', sans-serif;
  background-color: #0c2340;
  border-radius: 6px;                    /* Was: 8px */
  margin-top: 16px;                      /* Was: 24px */
}

.legend-line {
  display: flex;
  align-items: center;
  gap: 12px;                             /* Was: 20px */
  flex-wrap: wrap;
}

.legend-title {
  font-size: 0.95rem;                    /* Was: 44px */
  font-weight: 700;
  margin: 0;
  color: #FFFFFF;
  flex-shrink: 0;
}

.legend-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;                             /* Was: 40px */
  align-items: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;                              /* Was: 18px */
}

.legend-color-box {
  width: 20px;                           /* Was: 36px */
  height: 20px;                          /* Was: 36px */
  border-radius: 3px;                    /* Was: 4px */
  border: 1px solid rgba(255, 255, 255, 0.3);  /* Was: 2px */
  flex-shrink: 0;
}

.legend-label {
  font-size: 0.95rem;                    /* Was: 32px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.2;
  padding: 2px 4px;                      /* Was: 4px 8px */
  margin: -2px -4px;                     /* Was: -4px -8px */
}
```

### Export Buttons Container

**Current vs Proposed:**

| Property | Current | Proposed | Reduction |
|----------|---------|----------|-----------|
| Container padding | `32px 0 24px 0` | `16px 0 12px 0` | 50% |
| Button gap | `16px` | `10px` | 38% |
| Button padding | `16px 48px` | `10px 24px` | 50% |
| Border radius | `8px` | `6px` | 25% |

**CSS Specification:**

```css
/* Export Buttons Container - SCALED */
.export-container {
  display: flex;
  justify-content: center;
  gap: 10px;                             /* Was: 16px */
  padding: 16px 0 12px 0;                /* Was: 32px 0 24px 0 */
  font-family: 'Work Sans', sans-serif;
}

.export-button,
.edit-mode-toggle-button,
.copy-url-button {
  font-family: 'Work Sans', sans-serif;
  font-size: 0.95rem;                    /* Was: 20px */
  font-weight: 700;
  color: #ffffff;
  border: none;
  border-radius: 6px;                    /* Was: 8px */
  padding: 10px 24px;                    /* Was: 16px 48px */
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3); /* Was: 0 4px 12px */
  transition: all 0.2s;
}

.export-button { background-color: #50AF7B; }
.edit-mode-toggle-button { background-color: #BA3930; }
.copy-url-button { background-color: #1976D2; }
```

### Grid Rows and Bars

**Current vs Proposed:**

| Property | Current | Proposed | Reduction |
|----------|---------|----------|-----------|
| Row min-height | `14px` | `10px` | 29% |
| Bar height | `20px` | `14px` | 30% |
| Bar margin | `6px 4px` | `4px 2px` | 33-50% |
| Bar border-radius | `4px` | `3px` | 25% |
| Header padding | `4px 3px` | `3px 2px` | 25-33% |
| Swimlane padding | `3px 5px` | `2px 4px` | 20-33% |
| Task padding | `2px 4px 2px 8px` | `2px 3px 2px 6px` | ~25% |

**CSS Specification:**

```css
/* Grid Row Labels - SCALED */
.gantt-row-label {
  padding: 0;
  font-size: 0.95rem;                    /* Was: 6px */
  border-bottom: 1px solid #0D0D0D;
  white-space: nowrap;
  overflow: visible;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 3px;                              /* Was: 4px */
  min-height: 10px;                      /* Was: 14px */
}

.gantt-row-label .label-content {
  min-width: 0;
  transition: all 0.2s;
  border-radius: 2px;
  padding: 1px 3px;                      /* Was: 2px 4px */
  display: block;
  line-height: 1.2;
}

.gantt-row-label.swimlane {
  font-weight: 700;
  color: #FFFFFF;
  background-color: #0C2340;
  font-size: 0.95rem;                    /* Was: 7px */
  padding: 0;
  line-height: 1.2;
}

.gantt-row-label.swimlane .label-content {
  padding: 2px 4px;                      /* Was: 3px 5px */
}

.gantt-row-label.task {
  padding: 0;
  font-weight: 500;
  color: #FFFFFF;
  border-bottom: 1px solid #0D0D0D;
  background-color: #354259;
  font-size: 0.95rem;                    /* Was: 6px */
  line-height: 1.2;
}

.gantt-row-label.task .label-content {
  padding: 2px 3px 2px 6px;              /* Was: 2px 4px 2px 8px */
}

/* Grid Header - SCALED */
.gantt-header {
  font-size: 0.95rem;                    /* Was: 6px */
  font-weight: 600;
  padding: 3px 2px;                      /* Was: 4px 3px */
  text-align: center;
  background-color: #0c2340;
  border-bottom: 1px solid #0D0D0D;
  border-left: 0.5px solid #0D0D0D;
  color: #FFFFFF;
}

/* Gantt Bars - SCALED */
.gantt-bar {
  height: 14px;                          /* Was: 20px */
  margin: 4px 2px;                       /* Was: 6px 4px */
  border-radius: 3px;                    /* Was: 4px */
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

/* Resize Handles - SCALED */
.resize-handle {
  position: absolute;
  top: 0;
  width: 6px;                            /* Was: 10px */
  height: 90%;
  cursor: ew-resize;
  background: transparent;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resize-handle::after {
  content: '⋮';
  font-size: 10px;                       /* Was: 14px */
  color: rgba(255, 255, 255, 0.6);
  opacity: 0;
  transition: opacity 0.2s ease;
}
```

### Row Action Buttons

**Current vs Proposed:**

| Property | Current | Proposed | Reduction |
|----------|---------|----------|-----------|
| Button size | `18px x 18px` | `14px x 14px` | 22% |
| Button gap | `6px` | `4px` | 33% |

**CSS Specification:**

```css
/* Row Action Buttons - SCALED */
.row-actions {
  display: none;
  gap: 4px;                              /* Was: 6px */
  align-items: center;
}

.row-action-btn {
  width: 14px;                           /* Was: 18px */
  height: 14px;                          /* Was: 18px */
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 3px;                    /* Was: 4px */
  font-size: 0.95rem;                    /* Was: 12px */
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  line-height: 1;
  padding: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);  /* Was: 0 1px 3px */
}
```

---

## 6. Component Specifications

### 6.1 Title Section

**Current vs Proposed:**

| Property | Current | Proposed | Location |
|----------|---------|----------|----------|
| Title padding | `29px` | `14px` | GanttChart.js:199 |
| Title-logo gap | `32px` | `16px` | GanttChart.js:198 |
| Logo height | `70px` | `40px` | config.js:42 |

**JavaScript Specification:**

```javascript
// GanttChart.js - Title container styling
titleContainer.style.cssText = `
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;                             // Was: 32px
  padding: 14px;                         // Was: 29px
  border-radius: 6px 6px 0 0;
  background: #0c2340;
`;

// config.js - Logo size
SIZES: {
  LOGO_HEIGHT: 40,                       // Was: 70
  BAR_HEIGHT: 14,                        // Was: 20
  POINT_RADIUS: 5
}
```

### 6.2 Header/Footer SVG Stripes

**Current vs Proposed:**

| Property | Current | Proposed | Location |
|----------|---------|----------|----------|
| Header stripe height | `30px` | `16px` | GanttChart.js:889 |
| Footer stripe height | `30px` | `16px` | GanttChart.js:910 |

### 6.3 Research Analysis Section

**Current vs Proposed:**

| Property | Current | Proposed | Reduction |
|----------|---------|----------|-----------|
| Wrapper margin-top | `32px` | `16px` | 50% |
| Header padding | `14px 20px` | `10px 14px` | ~30% |
| Content padding | `20px 24px` | `14px 16px` | ~33% |
| Summary padding | `12px 16px` | `8px 12px` | ~30% |
| Table cell padding | `12px 16px` | `8px 12px` | ~30% |
| Legend padding | `12px 16px` | `8px 12px` | ~30% |
| Legend item gap | `16px` | `10px` | 38% |

**CSS Specification:**

```css
/* Research Analysis Wrapper - SCALED */
.research-analysis-wrapper {
  margin-top: 16px;                      /* Was: 32px */
  font-family: 'Work Sans', sans-serif;
  border-radius: 6px;                    /* Was: 8px */
  overflow: hidden;
  border: 1px solid #d0d0d0;
  background: #f8f9fa;
}

/* Collapse Header - SCALED */
.research-analysis-collapse-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 14px;                    /* Was: 14px 20px */
  background: linear-gradient(to right, #e8ecef, #f4f6f7);
  border: none;
  cursor: pointer;
  font-family: 'Work Sans', sans-serif;
  font-size: 0.95rem;
  color: #0c2340;
  transition: background 0.2s ease;
  gap: 8px;                              /* Was: 12px */
}

/* Collapse Content - SCALED */
.research-analysis-content {
  padding: 14px 16px;                    /* Was: 20px 24px */
  background: #fff;
  max-height: 2000px;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.2s ease;
  opacity: 1;
}

/* Summary - SCALED */
.research-analysis-summary {
  font-size: 0.95rem;
  color: #444;
  line-height: 1.6;
  margin-bottom: 14px;                   /* Was: 20px */
  padding: 8px 12px;                     /* Was: 12px 16px */
  background: #f8f9fa;
  border-radius: 4px;                    /* Was: 6px */
  border-left: 3px solid #0c2340;        /* Was: 4px */
}

/* Table - SCALED */
.research-analysis-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
  background: #fff;
  border-radius: 4px;                    /* Was: 6px */
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);  /* Was: 0 1px 3px */
}

.research-analysis-table th,
.research-analysis-table td {
  padding: 8px 12px;                     /* Was: 12px 16px */
}

/* Score Badges - SCALED */
.score-badge {
  display: inline-block;
  padding: 3px 8px;                      /* Was: 4px 10px */
  border-radius: 3px;                    /* Was: 4px */
  font-weight: 600;
  font-size: 0.95rem;
  text-align: center;
  min-width: 40px;                       /* Was: 50px */
}

/* Score Legend - SCALED */
.research-analysis-legend {
  margin-top: 12px;                      /* Was: 16px */
  padding: 8px 12px;                     /* Was: 12px 16px */
  background: #fff;
  border-radius: 4px;                    /* Was: 6px */
  border: 1px solid #e0e0e0;
}

.research-analysis-legend .legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;                             /* Was: 16px */
}

.research-analysis-legend .legend-item {
  display: flex;
  align-items: center;
  gap: 4px;                              /* Was: 6px */
  font-size: 0.95rem;
  color: #666;
}

.research-analysis-legend .legend-item .score-badge {
  padding: 1px 6px;                      /* Was: 2px 8px */
  font-size: 0.95rem;
  min-width: 32px;                       /* Was: 40px */
}
```

---

## 7. JavaScript Constants

### GanttChart.js Updates

```javascript
// Line ~475: Virtualized row height
const ROW_HEIGHT = 24;                   // Was: 40

// Line ~284: Bar area minimum height
barArea.style.minHeight = '20px';        // Was: 32px

// Line ~198-199: Title container
gap: '16px',                             // Was: 32px
padding: '14px',                         // Was: 29px

// Line ~889: Header SVG stripe
height: 16,                              // Was: 30

// Line ~910: Footer SVG stripe
height: 16,                              // Was: 30
```

### config.js Updates

```javascript
// Public/config.js
const CONFIG = {
  SIZES: {
    BAR_HEIGHT: 14,                      // Was: 20
    LOGO_HEIGHT: 40,                     // Was: 70
    POINT_RADIUS: 5                      // Unchanged
  },
  // ... rest of config
};
```

---

## 8. Responsive Behavior

### Breakpoint Strategy

Since all text is now normalized to 0.95rem, the responsive breakpoints should **NOT** override font sizes back to larger values.

**Current responsive overrides to REMOVE or MODIFY:**

```css
/* REMOVE these overrides that increase font sizes */

/* @media (max-width: 1024px) - Lines 2171+ */
/* DELETE or modify these rules: */
/*
.gantt-title { font-size: 24px; }        // Remove
.gantt-row-label { font-size: 14px; }    // Remove
.gantt-header { font-size: 12px; }       // Remove
*/

/* @media (max-width: 768px) - Lines 2203+ */
/* DELETE or modify these rules: */
/*
.gantt-title { font-size: 20px; }        // Remove
.gantt-row-label { font-size: 13px; }    // Remove
.gantt-header { font-size: 11px; }       // Remove
.research-analysis-table { font-size: 0.8rem; }  // Change to 0.95rem
*/
```

### Updated Responsive Rules

```css
/* Responsive adjustments - SCALED (maintain 0.95rem typography) */

@media (max-width: 1024px) {
  /* Buttons - adjust padding only, not font size */
  .export-button,
  .edit-mode-toggle-button,
  .copy-url-button {
    min-width: 36px;                     /* Was: 44px */
    min-height: 36px;                    /* Was: 44px */
    padding: 8px 20px;                   /* Was: 12px 32px */
    /* font-size remains 0.95rem */
  }

  /* Legend - reduce spacing */
  .gantt-legend {
    padding: 12px 16px;
  }

  .legend-list {
    gap: 12px;
  }
}

@media (max-width: 768px) {
  /* Buttons - further reduce padding */
  .export-button,
  .edit-mode-toggle-button,
  .copy-url-button {
    min-height: 40px;                    /* Was: 48px */
    padding: 10px 16px;                  /* Was: 14px 24px */
    /* font-size remains 0.95rem */
  }

  /* Bars - slightly reduce for mobile */
  .gantt-bar {
    height: 12px;                        /* Was: 18px in original responsive */
    margin: 3px 2px;                     /* Was: 5px 3px */
  }

  /* Legend - compact for mobile */
  .gantt-legend {
    padding: 10px 12px;                  /* Was: 12px in original */
  }

  .legend-color-box {
    width: 16px;
    height: 16px;
  }

  /* Research Analysis - compact */
  .research-analysis-wrapper {
    margin-top: 12px;
  }

  .research-analysis-collapse-header {
    padding: 8px 12px;
    flex-wrap: wrap;
  }

  .research-analysis-content {
    padding: 10px 12px;
  }

  .research-analysis-table th,
  .research-analysis-table td {
    padding: 6px 8px;
  }
}
```

---

## 9. Implementation Checklist

### Phase 1: Typography (COMPLETED)

- [x] Normalize `.gantt-title` to 0.95rem
- [x] Normalize `.gantt-header` to 0.95rem
- [x] Normalize `.gantt-row-label` to 0.95rem
- [x] Normalize `.gantt-row-label.swimlane` to 0.95rem
- [x] Normalize `.gantt-row-label.task` to 0.95rem
- [x] Normalize `.row-action-btn` to 0.95rem
- [x] Normalize `.export-button` to 0.95rem
- [x] Normalize `.edit-mode-toggle-button` to 0.95rem
- [x] Normalize `.copy-url-button` to 0.95rem
- [x] Normalize `.legend-title` to 0.95rem
- [x] Normalize `.legend-label` to 0.95rem
- [x] Normalize all Research Analysis section text to 0.95rem

### Phase 2: Layout Scaling (PENDING)

- [ ] Scale legend container padding
- [ ] Scale legend item gaps
- [ ] Scale legend color boxes
- [ ] Scale export button container padding
- [ ] Scale export button padding
- [ ] Scale grid row min-height
- [ ] Scale gantt bar height and margins
- [ ] Scale resize handle dimensions
- [ ] Scale row action button dimensions

### Phase 3: JavaScript Constants (PENDING)

- [ ] Update ROW_HEIGHT constant in GanttChart.js
- [ ] Update bar area min-height
- [ ] Update title container gap and padding
- [ ] Update header/footer SVG heights
- [ ] Update LOGO_HEIGHT in config.js
- [ ] Update BAR_HEIGHT in config.js

### Phase 4: Responsive Updates (PENDING)

- [ ] Remove/modify tablet font-size overrides
- [ ] Remove/modify mobile font-size overrides
- [ ] Update responsive padding values
- [ ] Test at all breakpoints

### Phase 5: Testing (PENDING)

- [ ] Verify chart fits at 1920px viewport / 100% zoom
- [ ] Verify chart fits at 1440px viewport / 100% zoom
- [ ] Test text readability at normalized size
- [ ] Test edit mode functionality (resize handles, action buttons)
- [ ] Test legend editability
- [ ] Test Research Analysis section collapse/expand
- [ ] Cross-browser testing

---

## 10. Visual Reference

### Before vs After Comparison

```
BEFORE (requires ~50% zoom):
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│    ████████████████  VERY LARGE TITLE  ████████████████                  │
│                                                                          │
│ ┌────────────────────────────────────────────────────────────────────┐   │
│ │                        HUGE HEADER CELLS                           │   │
│ ├────┬────────────────────────────────────────────────────────────────   │
│ │SWIM│ ████████████████████████████████████████████████████████████  │   │
│ │LANE│                    (thick bars with lots of spacing)          │   │
│ ├────┼────────────────────────────────────────────────────────────────   │
│ │TASK│ ██████████████████████████████                                │   │
│ └────┴────────────────────────────────────────────────────────────────   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  LEGEND:    ██████ HUGE        ██████ HUGE        ██████ HUGE    │    │
│  │             BOXES  TEXT        BOXES  TEXT        BOXES  TEXT    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│      [    VERY WIDE BUTTON    ]   [    VERY WIDE BUTTON    ]             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

AFTER (fits at 100% zoom):
┌────────────────────────────────────────────────────────┐
│  Project Title                                    [Logo]│
│ ┌──────────────────────────────────────────────────────┤
│ │ Week 1 │ Week 2 │ Week 3 │ Week 4 │ Week 5 │ Week 6 ││
│ ├────────┼────────┼────────┼────────┼────────┼────────┤│
│ │Research│ ████████████████                           ││
│ │ Task 1 │ ██████████                                 ││
│ │ Task 2 │      ████████████                          ││
│ ├────────┼────────┼────────┼────────┼────────┼────────┤│
│ │Design  │              ██████████████████            ││
│ │ Task 1 │              ████████                      ││
│ └────────┴────────┴────────┴────────┴────────┴────────┘│
│                                                        │
│ Legend: ██ Red  ██ Orange  ██ Teal  ██ Purple  ██ Blue │
│                                                        │
│   [ Export PNG ]  [ Edit Mode ]  [ Copy URL ]          │
└────────────────────────────────────────────────────────┘
```

### Size Comparison Summary

| Category | Before (Total) | After (Total) | Reduction |
|----------|----------------|---------------|-----------|
| Title Section | ~130px height | ~70px height | 46% |
| Legend Section | ~120px height | ~50px height | 58% |
| Button Section | ~90px height | ~50px height | 44% |
| Per Row Height | ~40px | ~24px | 40% |
| **Overall Vertical** | **~380px + rows** | **~194px + rows** | **~50%** |

---

## Appendix: Quick Reference

### CSS Variables (Proposed)

```css
:root {
  /* Typography */
  --gantt-font-size: 0.95rem;

  /* Spacing */
  --gantt-spacing-xs: 2px;
  --gantt-spacing-sm: 4px;
  --gantt-spacing-md: 8px;
  --gantt-spacing-lg: 12px;
  --gantt-spacing-xl: 16px;

  /* Dimensions */
  --gantt-bar-height: 14px;
  --gantt-row-height: 24px;
  --gantt-button-padding: 10px 24px;
  --gantt-legend-box-size: 20px;
  --gantt-logo-height: 40px;
}
```

---

*Document Version: 1.0*
*Created: November 2024*
*Status: Phase 1 Complete, Phases 2-5 Pending*
