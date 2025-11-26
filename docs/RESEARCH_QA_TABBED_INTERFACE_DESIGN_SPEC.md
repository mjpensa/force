# Research QA Screen - Tabbed Interface Design Specification

**Version:** 2.0
**Date:** 2025-11-26
**Status:** Pending Implementation
**Supersedes:** RESEARCH_QA_GLASSMORPHIC_DESIGN_SPEC.md (v1.0)

**Target Files:**
- `Public/styles/analysis-view.css` (full rewrite)
- `Public/components/views/ResearchAnalysisView.js` (significant refactor)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Design Goals](#3-design-goals)
4. [Architecture Overview](#4-architecture-overview)
5. [Tab Structure & Navigation](#5-tab-structure--navigation)
6. [Component Specifications](#6-component-specifications)
   - 6.1 [Page Container](#61-page-container)
   - 6.2 [Header with Score](#62-header-with-score)
   - 6.3 [Tab Navigation Bar](#63-tab-navigation-bar)
   - 6.4 [Tab Content Container](#64-tab-content-container)
   - 6.5 [Overview Tab](#65-overview-tab)
   - 6.6 [Themes Tab](#66-themes-tab)
   - 6.7 [Data Quality Tab](#67-data-quality-tab)
   - 6.8 [Actions Tab](#68-actions-tab)
7. [Enhanced Glassmorphic Design System](#7-enhanced-glassmorphic-design-system)
8. [Animation Philosophy](#8-animation-philosophy)
9. [Typography & Readability](#9-typography--readability)
10. [Interactive States](#10-interactive-states)
11. [Responsive Behavior](#11-responsive-behavior)
12. [Accessibility Requirements](#12-accessibility-requirements)
13. [Implementation Guide](#13-implementation-guide)
14. [Migration Checklist](#14-migration-checklist)

---

## 1. Executive Summary

This specification defines a complete redesign of the Research QA screen using a **tabbed interface** approach. The redesign addresses critical usability issues with the current implementation while preserving the glassmorphic design language.

### Key Changes

| Aspect | Current (v1.0) | New (v2.0) |
|--------|---------------|------------|
| **Layout** | Single scrolling page | Tabbed interface with 4 focused views |
| **Animations** | Excessive (shine, pulse, stagger) | Purposeful and minimal |
| **Information Density** | Overwhelming | Progressive disclosure |
| **Card Structure** | Collapsed by default | Expanded, scannable |
| **Readability** | Low contrast (6-10% opacity) | High contrast (15-25% opacity) |
| **Typography** | Small (12-14px) | Comfortable (14-16px minimum) |

---

## 2. Problem Statement

### Current Issues Identified

#### 2.1 Animation Overload
```
PROBLEMATIC ANIMATIONS (TO BE REMOVED):
├── scoreShine          → Infinite shimmer on score badges
├── barShine            → Infinite shine on progress bars
├── pulse               → Continuous pulsing on indicators
├── glassFadeSlideUp    → 7+ staggered entrance animations
└── translateY(-2px)    → Hover transforms on every element
```

#### 2.2 Readability Problems
- Glass backgrounds at 6-10% opacity create insufficient contrast
- Text colors (`--glass-text-muted`, `--glass-text-secondary`) too faint
- Blur effects further reduce text clarity
- Small font sizes (many elements at 12px)

#### 2.3 Information Architecture
- All content on single scrolling page = cognitive overload
- Theme cards collapsed = critical information hidden
- No clear hierarchy between sections
- 7+ sections competing for attention

#### 2.4 Interaction Confusion
- Every element has hover effects = nothing feels important
- Collapse/expand behavior inconsistent
- No clear call-to-action pathway

---

## 3. Design Goals

### Primary Goals

1. **Reduce Cognitive Load**
   - Split content into 4 focused tabs
   - Show only relevant information per view
   - Clear navigation between sections

2. **Improve Readability**
   - Increase background opacity (15-25%)
   - Larger, more legible typography
   - Higher contrast text colors
   - Remove competing visual elements

3. **Eliminate Animation Noise**
   - Remove all infinite/looping animations
   - Keep only purposeful transitions
   - Single entrance animation per tab switch

4. **Enhance Information Hierarchy**
   - Clear visual priority system
   - Scannable at-a-glance summaries
   - Progressive disclosure of details

### Success Metrics

- User can identify overall score within 2 seconds
- User can navigate to any section within 1 click
- All body text meets WCAG AA contrast ratio (4.5:1)
- Zero infinite animations
- Page renders without layout shift

---

## 4. Architecture Overview

### 4.1 High-Level Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RESEARCH QA SCREEN (v2.0)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  HEADER                                         Score: 7.5/10 │  │
│  │  Research Quality Analysis                      ████████░░    │  │
│  │  Generated: Nov 26, 2025 at 2:30 PM                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  [Overview]    [Themes]    [Data Quality]    [Actions]        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │                                                               │  │
│  │                     TAB CONTENT AREA                          │  │
│  │                                                               │  │
│  │                     (Dynamic content based                    │  │
│  │                      on selected tab)                         │  │
│  │                                                               │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Hierarchy

```
ResearchAnalysisView
├── Header
│   ├── TitleSection
│   │   ├── Title
│   │   └── Timestamp
│   └── ScoreSection
│       ├── ScoreBadge (large)
│       ├── ScoreBar (visual)
│       └── RatingLabel
│
├── TabNavigation
│   ├── TabButton[Overview] (default active)
│   ├── TabButton[Themes]
│   ├── TabButton[Data Quality]
│   └── TabButton[Actions]
│
└── TabContentContainer
    ├── OverviewTab (shown when active)
    │   ├── ReadinessBanner
    │   ├── ExecutiveSummary
    │   ├── KeyFindings
    │   └── CriticalGapsAlert (conditional)
    │
    ├── ThemesTab (shown when active)
    │   ├── ThemeStatusSummary
    │   └── ThemeCardList
    │       └── ThemeCard[] (expanded by default)
    │
    ├── DataQualityTab (shown when active)
    │   ├── MetricsGrid
    │   ├── DateSpecificityChart
    │   └── TimelineSpan
    │
    └── ActionsTab (shown when active)
        ├── ActionsList
        │   └── ActionItem[]
        └── SuggestedSources
            └── SourceCard[]
```

---

## 5. Tab Structure & Navigation

### 5.1 Tab Definitions

| Tab | Icon | Purpose | Content Summary |
|-----|------|---------|-----------------|
| **Overview** | 📋 | Executive summary & readiness | Summary, findings, gaps, verdict |
| **Themes** | 🏷️ | Theme-by-theme analysis | All themes expanded with details |
| **Data Quality** | 📊 | Data completeness metrics | Stats, charts, timeline |
| **Actions** | ✅ | Recommended next steps | Action items, suggested sources |

### 5.2 Tab Navigation Behavior

```
TAB NAVIGATION RULES:
─────────────────────────────────────────────────────────────────────
1. Default tab: Overview (loads first)
2. Active tab: Highlighted with accent color + underline
3. Tab switching: Instant (no animation delay)
4. Content transition: Simple fade (200ms)
5. URL hash: Updates to #overview, #themes, #data-quality, #actions
6. Keyboard: Arrow keys navigate tabs, Enter/Space activates
7. Deep linking: Direct URL access to any tab supported
─────────────────────────────────────────────────────────────────────
```

### 5.3 Tab State Preservation

- Tab selection persists during session
- Scroll position within tabs is maintained
- Expanded/collapsed states within tabs are preserved
- No data re-fetching on tab switch

---

## 6. Component Specifications

### 6.1 Page Container

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PAGE CONTAINER                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  .research-analysis-view                                            │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Max-width: 1200px                                                  │
│  Padding: 32px (desktop) / 24px (tablet) / 16px (mobile)           │
│  Margin: 0 auto                                                     │
│  Background: Inherited from body (bg-glass-gradient)                │
│                                                                     │
│  Animation: SINGLE fade-in on initial load only                     │
│  Duration: 0.4s                                                     │
│  No staggered children animations                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.research-analysis-view {
  /* Layout */
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-8);
  min-height: calc(100vh - var(--header-height));

  /* Single entrance animation */
  animation: viewFadeIn 0.4s ease-out forwards;
}

@keyframes viewFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* NO staggered child animations */
```

---

### 6.2 Header with Score

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER COMPONENT                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────┐  ┌─────────────────────┐ │  │
│  │  │  Research Quality Analysis       │  │                     │ │  │
│  │  │  ────────────────────────────── │  │     ┌─────────┐     │ │  │
│  │  │  ● Generated Nov 26, 2025       │  │     │   7.5   │     │ │  │
│  │  │    2:30 PM                       │  │     │  ─────  │     │ │  │
│  │  │                                 │  │     │   /10   │     │ │  │
│  │  │                                 │  │     └─────────┘     │ │  │
│  │  │                                 │  │                     │ │  │
│  │  │                                 │  │   ████████████░░░   │ │  │
│  │  │                                 │  │      Good           │ │  │
│  │  └─────────────────────────────────┘  └─────────────────────┘ │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  STYLING:                                                           │
│  ─────────────────────────────────────────────────────────────────  │
│  Background: var(--glass-white-15)  ← Increased from 10%            │
│  Backdrop-filter: blur(20px)                                        │
│  Border: 1px solid var(--glass-white-20)                            │
│  Border-radius: 24px                                                │
│  Shadow: shadow-glass-3                                             │
│  Padding: 32px                                                      │
│                                                                     │
│  NO gradient overlay animation                                      │
│  NO timestamp pulse animation                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.analysis-header {
  /* Layout */
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-8);
  padding: var(--spacing-8);
  margin-bottom: var(--spacing-6);

  /* Enhanced Glass Effect - HIGHER OPACITY */
  background: var(--glass-white-15);
  backdrop-filter: blur(var(--blur-xl));
  -webkit-backdrop-filter: blur(var(--blur-xl));

  /* Border */
  border: 1px solid var(--glass-white-20);
  border-radius: var(--radius-glass-xl);

  /* Shadow */
  box-shadow: var(--shadow-glass-3);
}

/* NO ::before gradient overlay */
/* NO animations */

.analysis-title {
  font-size: var(--text-3xl);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-3) 0;
  letter-spacing: -0.01em;
}

.analysis-timestamp {
  font-size: var(--text-base);  /* Increased from sm */
  color: var(--glass-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

/* Static indicator - NO PULSE ANIMATION */
.analysis-timestamp::before {
  content: '';
  width: 8px;
  height: 8px;
  background: var(--color-glass-success);
  border-radius: 50%;
  /* NO animation */
}

/* Score section with visual bar */
.score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  min-width: 160px;
}

.score-badge-large {
  /* Enhanced visibility */
  padding: var(--spacing-5) var(--spacing-6);
  background: var(--glass-white-15);
  border: 2px solid;  /* Thicker border */
  border-radius: var(--radius-glass-lg);
  text-align: center;

  /* NO shine animation */
}

.score-badge-large .score-value {
  font-size: var(--text-4xl);
  font-weight: var(--weight-bold);
  color: var(--glass-text-primary);
  line-height: 1;
}

.score-badge-large .score-divider {
  font-size: var(--text-lg);
  color: var(--glass-text-muted);
}

.score-badge-large .score-max {
  font-size: var(--text-lg);
  color: var(--glass-text-muted);
}

/* Visual score bar */
.score-bar {
  width: 100%;
  height: 8px;
  background: var(--glass-white-10);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s ease-out;
  /* NO shine animation */
}

.score-rating-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

#### Score Tier Colors (Static - No Glow Animation)

```css
/* Excellent (9-10) */
.score-tier-excellent {
  border-color: rgba(80, 175, 123, 0.60);
  background: rgba(80, 175, 123, 0.20);
}
.score-tier-excellent .score-bar-fill { background: #50AF7B; }
.score-tier-excellent .score-rating-label { color: #50AF7B; }

/* Good (7-8) */
.score-tier-good {
  border-color: rgba(132, 204, 22, 0.60);
  background: rgba(132, 204, 22, 0.20);
}
.score-tier-good .score-bar-fill { background: #84cc16; }
.score-tier-good .score-rating-label { color: #84cc16; }

/* Adequate (5-6) */
.score-tier-adequate {
  border-color: rgba(234, 179, 8, 0.60);
  background: rgba(234, 179, 8, 0.20);
}
.score-tier-adequate .score-bar-fill { background: #eab308; }
.score-tier-adequate .score-rating-label { color: #eab308; }

/* Poor (3-4) */
.score-tier-poor {
  border-color: rgba(249, 115, 22, 0.60);
  background: rgba(249, 115, 22, 0.20);
}
.score-tier-poor .score-bar-fill { background: #f97316; }
.score-tier-poor .score-rating-label { color: #f97316; }

/* Inadequate (0-2) */
.score-tier-inadequate {
  border-color: rgba(239, 68, 68, 0.60);
  background: rgba(239, 68, 68, 0.20);
}
.score-tier-inadequate .score-bar-fill { background: #ef4444; }
.score-tier-inadequate .score-rating-label { color: #ef4444; }
```

---

### 6.3 Tab Navigation Bar

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  TAB NAVIGATION BAR                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │  │
│  │  │ 📋 Overview │ │ 🏷️ Themes   │ │ 📊 Data     │ │ ✅ Act- │ │  │
│  │  │   ══════   │ │             │ │   Quality   │ │   ions  │ │  │
│  │  │  (active)   │ │             │ │             │ │         │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  STYLING:                                                           │
│  ─────────────────────────────────────────────────────────────────  │
│  Container:                                                         │
│    Background: var(--glass-white-10)                                │
│    Border-radius: 16px                                              │
│    Padding: 8px                                                     │
│    Gap: 8px                                                         │
│                                                                     │
│  Tab Button (inactive):                                             │
│    Background: transparent                                          │
│    Color: var(--glass-text-secondary)                               │
│    Padding: 12px 24px                                               │
│    Border-radius: 12px                                              │
│                                                                     │
│  Tab Button (active):                                               │
│    Background: var(--glass-white-15)                                │
│    Color: var(--glass-text-primary)                                 │
│    Border-bottom: 3px solid var(--color-glass-success)              │
│                                                                     │
│  Tab Button (hover):                                                │
│    Background: var(--glass-white-10)                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.tab-navigation {
  display: flex;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  margin-bottom: var(--spacing-6);

  /* Glass container */
  background: var(--glass-white-10);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);
}

.tab-button {
  /* Reset */
  appearance: none;
  border: none;
  background: transparent;
  cursor: pointer;

  /* Layout */
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-5);

  /* Typography */
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--glass-text-secondary);

  /* Shape */
  border-radius: var(--radius-glass-md);

  /* Transition - SIMPLE, not elaborate */
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.tab-button:hover:not(.tab-button--active) {
  background: var(--glass-white-10);
  color: var(--glass-text-primary);
}

.tab-button--active {
  background: var(--glass-white-15);
  color: var(--glass-text-primary);
  font-weight: var(--weight-semibold);

  /* Active indicator */
  position: relative;
}

.tab-button--active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: var(--spacing-3);
  right: var(--spacing-3);
  height: 3px;
  background: var(--color-glass-success);
  border-radius: var(--radius-full);
}

.tab-button:focus-visible {
  outline: 3px solid var(--color-glass-success);
  outline-offset: 2px;
}

.tab-button__icon {
  font-size: var(--text-lg);
  line-height: 1;
}

.tab-button__label {
  /* Label text */
}

/* Badge for counts (optional) */
.tab-button__badge {
  background: var(--glass-white-15);
  color: var(--glass-text-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  margin-left: var(--spacing-2);
}

.tab-button--active .tab-button__badge {
  background: rgba(80, 175, 123, 0.20);
  color: var(--color-glass-success);
}
```

#### Tab Accessibility

```html
<!-- ARIA attributes for tabs -->
<div class="tab-navigation" role="tablist" aria-label="Research analysis sections">
  <button
    class="tab-button tab-button--active"
    role="tab"
    aria-selected="true"
    aria-controls="panel-overview"
    id="tab-overview"
    tabindex="0">
    <span class="tab-button__icon">📋</span>
    <span class="tab-button__label">Overview</span>
  </button>

  <button
    class="tab-button"
    role="tab"
    aria-selected="false"
    aria-controls="panel-themes"
    id="tab-themes"
    tabindex="-1">
    <span class="tab-button__icon">🏷️</span>
    <span class="tab-button__label">Themes</span>
    <span class="tab-button__badge">5</span>
  </button>

  <!-- ... other tabs -->
</div>
```

---

### 6.4 Tab Content Container

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  TAB CONTENT CONTAINER                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │                                                               │  │
│  │                                                               │  │
│  │                    TAB PANEL CONTENT                          │  │
│  │                                                               │  │
│  │              (Only active tab is visible)                     │  │
│  │                                                               │  │
│  │                                                               │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  BEHAVIOR:                                                          │
│  ─────────────────────────────────────────────────────────────────  │
│  - Only ONE panel visible at a time                                 │
│  - Content fade transition: 200ms                                   │
│  - Minimum height to prevent layout shift                           │
│  - Scroll position preserved per tab                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.tab-content-container {
  /* Prevent layout shift */
  min-height: 400px;
  position: relative;
}

.tab-panel {
  /* Hidden by default */
  display: none;
  opacity: 0;
}

.tab-panel--active {
  display: block;
  animation: tabFadeIn 0.2s ease-out forwards;
}

@keyframes tabFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ARIA-based hiding (for screen readers) */
.tab-panel[aria-hidden="true"] {
  display: none;
}

.tab-panel[aria-hidden="false"] {
  display: block;
}
```

---

### 6.5 Overview Tab

The Overview tab provides an executive summary of the research quality analysis.

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  OVERVIEW TAB                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  READINESS BANNER                                             │  │
│  │  ─────────────────────────────────────────────────────────── │  │
│  │  │                                                           │  │
│  │  │  ⚠️  NEEDS IMPROVEMENT                                    │  │
│  │  │      3 of 5 themes ready for Gantt chart                  │  │
│  │  │                                                           │  │
│  │  │  ████████████████████░░░░░░░░░░  60% Ready                │  │
│  │  │                                                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  EXECUTIVE SUMMARY                                            │  │
│  │  ─────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  Your research demonstrates strong coverage of product        │  │
│  │  development timelines but lacks specific dates for          │  │
│  │  marketing initiatives and financial projections. The        │  │
│  │  overall quality is sufficient to begin Gantt chart          │  │
│  │  creation with some gaps that should be addressed.           │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  KEY FINDINGS                                                 │  │
│  │  ─────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  ● Strong timeline data for product development phases       │  │
│  │  ● Marketing campaign dates need more specificity            │  │
│  │  ● Financial milestones are adequately documented           │  │
│  │  ● Resource allocation details are missing                   │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ⚠️ CRITICAL GAPS                                             │  │
│  │  ─────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  ! Missing Q3 financial projections                          │  │
│  │  ! No timeline specified for Phase 2 deliverables           │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │
│  │    12       │ │     5       │ │   Months    │                   │
│  │   Tasks     │ │   Themes    │ │  Interval   │                   │
│  │  Estimated  │ │   Analyzed  │ │ Recommended │                   │
│  └─────────────┘ └─────────────┘ └─────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
/* Readiness Banner */
.readiness-banner {
  padding: var(--spacing-6);
  margin-bottom: var(--spacing-6);

  /* Enhanced glass */
  background: var(--glass-white-12);
  border: 1px solid var(--glass-white-20);
  border-radius: var(--radius-glass-xl);

  /* Left accent bar */
  border-left: 5px solid;
}

.readiness-banner--ready {
  border-left-color: var(--color-glass-success);
  background: rgba(80, 175, 123, 0.10);
}

.readiness-banner--needs-improvement {
  border-left-color: #eab308;
  background: rgba(234, 179, 8, 0.10);
}

.readiness-banner--insufficient {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.10);
}

.readiness-banner__status {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.readiness-banner__icon {
  font-size: var(--text-2xl);
}

.readiness-banner__title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0;
}

.readiness-banner__subtitle {
  font-size: var(--text-base);
  color: var(--glass-text-secondary);
  margin: var(--spacing-2) 0 0 0;
}

/* Progress bar */
.readiness-progress {
  margin-top: var(--spacing-4);
}

.readiness-progress__track {
  height: 12px;
  background: var(--glass-white-10);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.readiness-progress__fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s ease-out;
  /* Color set by status class */
}

.readiness-progress__label {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--glass-text-secondary);
}

/* Summary Section */
.overview-section {
  padding: var(--spacing-6);
  margin-bottom: var(--spacing-5);

  background: var(--glass-white-12);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);
}

.overview-section__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

.overview-section__content {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--glass-text-secondary);
}

/* Key Findings List */
.key-findings-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.key-findings-list li {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-3) 0;
  font-size: var(--text-base);
  color: var(--glass-text-secondary);
  line-height: var(--leading-relaxed);
}

.key-findings-list li::before {
  content: '';
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  margin-top: 6px;
  background: var(--color-glass-success);
  border-radius: 50%;
  /* NO glow/shadow animation */
}

/* Critical Gaps Alert */
.critical-gaps-alert {
  padding: var(--spacing-5);
  margin-bottom: var(--spacing-5);

  background: rgba(239, 68, 68, 0.10);
  border: 1px solid rgba(239, 68, 68, 0.30);
  border-left: 5px solid #ef4444;
  border-radius: var(--radius-glass-lg);
}

.critical-gaps-alert__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.critical-gaps-alert__icon {
  font-size: var(--text-xl);
}

.critical-gaps-alert__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0;
}

.critical-gaps-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.critical-gaps-list li {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-2) 0;
  font-size: var(--text-base);
  color: var(--glass-text-secondary);
}

.critical-gaps-list li::before {
  content: '!';
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  background: rgba(239, 68, 68, 0.20);
  border: 1px solid rgba(239, 68, 68, 0.40);
  border-radius: 50%;
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: #f87171;
}

/* Quick Stats Grid */
.quick-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-4);
}

.quick-stat-card {
  padding: var(--spacing-5);
  text-align: center;

  background: var(--glass-white-12);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);

  /* Simple hover - NO transform */
  transition: background-color 0.15s ease;
}

.quick-stat-card:hover {
  background: var(--glass-white-15);
}

.quick-stat-card__value {
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  color: var(--glass-text-primary);
  line-height: 1.2;
}

.quick-stat-card__label {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
  margin-top: var(--spacing-2);
}
```

---

### 6.6 Themes Tab

The Themes tab displays all theme analyses with cards **expanded by default**.

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  THEMES TAB                                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  THEME STATUS SUMMARY                                         │  │
│  │  ─────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  ● Product Development    8/10  ✓ Ready                       │  │
│  │  ● Engineering            7/10  ✓ Ready                       │  │
│  │  ● HR & Hiring            7/10  ✓ Ready                       │  │
│  │  ○ Marketing Campaign     4/10  ✗ Needs work                  │  │
│  │  ○ Financial Planning     3/10  ✗ Needs work                  │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  THEME: Product Development                      8/10 ✓ Ready │  │
│  │  ─────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  Analysis of product roadmap and development milestones.      │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ 12 dates found  │  8 potential tasks  │  Quality: Good  │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  │  STRENGTHS                                                    │  │
│  │  + Clear milestone definitions with specific dates            │  │
│  │  + Well-documented dependencies between phases               │  │
│  │                                                               │  │
│  │  GAPS                                                         │  │
│  │  - Missing resource allocation details                        │  │
│  │  - Q4 planning incomplete                                     │  │
│  │                                                               │  │
│  │  RECOMMENDATIONS                                              │  │
│  │  > Add specific dates for Q4 milestones                       │  │
│  │  > Include resource requirements for each phase               │  │
│  │                                                               │  │
│  │  SAMPLE EVENTS                                                │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ Event              │ Date Info      │ Quality         │  │  │
│  │  ├────────────────────────────────────────────────────────┤  │  │
│  │  │ Beta Launch        │ March 15, 2025 │ ● Specific      │  │  │
│  │  │ GA Release         │ Q2 2025        │ ● Quarterly     │  │  │
│  │  │ Feature Freeze     │ Feb 28, 2025   │ ● Specific      │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │  [Collapse ▲]                                                 │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  THEME: Marketing Campaign                   4/10 ✗ Needs work│  │
│  │  ... (expanded by default)                                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Key Design Decisions

1. **Cards EXPANDED by default** - No hidden information
2. **Collapse is optional** - User can collapse if desired
3. **Status summary at top** - Quick scan of all themes
4. **No hover transform** - Static cards, focus on content

#### CSS Specification

```css
/* Theme Status Summary */
.theme-status-summary {
  padding: var(--spacing-5);
  margin-bottom: var(--spacing-6);

  background: var(--glass-white-12);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);
}

.theme-status-summary__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

.theme-status-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.theme-status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-3) 0;
  border-bottom: 1px solid var(--glass-white-10);
}

.theme-status-item:last-child {
  border-bottom: none;
}

.theme-status-item__name {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  font-size: var(--text-base);
  color: var(--glass-text-primary);
}

.theme-status-item__indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.theme-status-item__indicator--ready {
  background: var(--color-glass-success);
}

.theme-status-item__indicator--needs-work {
  background: transparent;
  border: 2px solid var(--glass-text-muted);
}

.theme-status-item__meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
}

.theme-status-item__score {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-secondary);
}

.theme-status-item__badge {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-full);
}

.theme-status-item__badge--ready {
  background: rgba(80, 175, 123, 0.15);
  color: var(--color-glass-success);
}

.theme-status-item__badge--needs-work {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* Theme Card - EXPANDED BY DEFAULT */
.theme-card {
  margin-bottom: var(--spacing-5);

  background: var(--glass-white-12);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-xl);

  overflow: hidden;

  /* NO hover transform */
  transition: border-color 0.15s ease;
}

.theme-card:hover {
  border-color: var(--glass-white-25);
}

.theme-card--ready {
  border-left: 4px solid var(--color-glass-success);
}

.theme-card--needs-work {
  border-left: 4px solid #f87171;
}

/* Theme Card Header */
.theme-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-5) var(--spacing-6);

  background: var(--glass-white-5);
  border-bottom: 1px solid var(--glass-white-10);
}

.theme-card__title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0;
}

.theme-card__meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.theme-card__score-badge {
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--glass-white-10);
  border: 1px solid var(--glass-white-20);
  border-radius: var(--radius-glass-md);

  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--glass-text-primary);
}

.theme-card__status-badge {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-glass-sm);
}

/* Theme Card Content - VISIBLE BY DEFAULT */
.theme-card__content {
  padding: var(--spacing-6);
}

.theme-card__description {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--glass-text-secondary);
  margin: 0 0 var(--spacing-5) 0;
}

/* Theme Stats Row */
.theme-stats-row {
  display: flex;
  gap: var(--spacing-6);
  padding: var(--spacing-4);
  margin-bottom: var(--spacing-5);

  background: var(--glass-white-8);
  border: 1px solid var(--glass-white-10);
  border-radius: var(--radius-glass-md);
}

.theme-stat {
  font-size: var(--text-base);
  color: var(--glass-text-secondary);
}

.theme-stat__value {
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
}

/* Theme Lists (Strengths, Gaps, Recommendations) */
.theme-list-section {
  margin-bottom: var(--spacing-5);
}

.theme-list-section__title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-3) 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.theme-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.theme-list li {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  padding: var(--spacing-2) 0;
  font-size: var(--text-base);
  color: var(--glass-text-secondary);
  line-height: var(--leading-relaxed);
}

.theme-list--strengths li::before {
  content: '+';
  color: var(--color-glass-success);
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}

.theme-list--gaps li::before {
  content: '-';
  color: #f87171;
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}

.theme-list--recommendations li::before {
  content: '>';
  color: var(--glass-text-muted);
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}

/* Sample Events Table */
.sample-events {
  margin-top: var(--spacing-5);
}

.sample-events__title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-3) 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sample-events-table {
  width: 100%;
  border-collapse: collapse;

  background: var(--glass-white-8);
  border: 1px solid var(--glass-white-10);
  border-radius: var(--radius-glass-md);
  overflow: hidden;
}

.sample-events-table th,
.sample-events-table td {
  padding: var(--spacing-3) var(--spacing-4);
  text-align: left;
  font-size: var(--text-base);
  border-bottom: 1px solid var(--glass-white-10);
}

.sample-events-table th {
  background: var(--glass-white-10);
  color: var(--glass-text-primary);
  font-weight: var(--weight-semibold);
}

.sample-events-table td {
  color: var(--glass-text-secondary);
}

.sample-events-table tr:last-child td {
  border-bottom: none;
}

/* Quality Indicator */
.quality-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-sm);
}

.quality-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.quality-indicator--specific .quality-indicator__dot { background: #50AF7B; }
.quality-indicator--quarterly .quality-indicator__dot { background: #84cc16; }
.quality-indicator--monthly .quality-indicator__dot { background: #eab308; }
.quality-indicator--yearly .quality-indicator__dot { background: #f97316; }
.quality-indicator--vague .quality-indicator__dot { background: #ef4444; }

/* Collapse Button */
.theme-card__collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  width: 100%;
  padding: var(--spacing-3);
  margin-top: var(--spacing-4);

  background: transparent;
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-md);

  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--glass-text-muted);

  cursor: pointer;
  transition: all 0.15s ease;
}

.theme-card__collapse-btn:hover {
  background: var(--glass-white-10);
  color: var(--glass-text-primary);
}

/* Collapsed State */
.theme-card--collapsed .theme-card__content {
  display: none;
}

.theme-card--collapsed .theme-card__collapse-btn {
  margin-top: 0;
}
```

---

### 6.7 Data Quality Tab

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  DATA QUALITY TAB                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │    24      │ │    18      │ │    15      │ │     3      │       │
│  │   Total    │ │   Total    │ │   Events   │ │   Events   │       │
│  │   Dates    │ │   Events   │ │ with Dates │ │  Missing   │       │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  DATE SPECIFICITY BREAKDOWN                                   │  │
│  │  ─────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  Specific    ██████████████████████░░░░░░░░  12 (50%)        │  │
│  │  Quarterly   ██████████░░░░░░░░░░░░░░░░░░░░   5 (21%)        │  │
│  │  Monthly     ████████░░░░░░░░░░░░░░░░░░░░░░   4 (17%)        │  │
│  │  Yearly      ████░░░░░░░░░░░░░░░░░░░░░░░░░░   2 (8%)         │  │
│  │  Relative    ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░   1 (4%)         │  │
│  │  Vague       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0 (0%)         │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  TIMELINE COVERAGE                                            │  │
│  │  ─────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  Span: 18 months                                              │  │
│  │  Range: January 2025 - June 2026                              │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ J F M A M J J A S O N D │ J F M A M J                   │ │  │
│  │  │ ●     ●   ●●    ●     ● │ ●   ●   ●●●                   │ │  │
│  │  │         2025            │     2026                      │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-6);
}

.metric-card {
  padding: var(--spacing-5);
  text-align: center;

  background: var(--glass-white-12);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);

  /* Simple hover */
  transition: background-color 0.15s ease;
}

.metric-card:hover {
  background: var(--glass-white-15);
}

.metric-card__value {
  font-size: var(--text-4xl);
  font-weight: var(--weight-bold);
  color: var(--glass-text-primary);
  line-height: 1;
}

.metric-card__label {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
  margin-top: var(--spacing-2);
}

/* Date Specificity Chart */
.specificity-chart {
  padding: var(--spacing-6);
  margin-bottom: var(--spacing-6);

  background: var(--glass-white-12);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-xl);
}

.specificity-chart__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-5) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

.specificity-bars {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.specificity-bar {
  display: grid;
  grid-template-columns: 100px 1fr 80px;
  align-items: center;
  gap: var(--spacing-4);
}

.specificity-bar__label {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--glass-text-secondary);
  text-align: right;
}

.specificity-bar__track {
  height: 16px;
  background: var(--glass-white-10);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.specificity-bar__fill {
  height: 100%;
  border-radius: var(--radius-full);
  /* NO shine animation */
  transition: width 0.6s ease-out;
}

/* Bar colors */
.specificity-bar--specific .specificity-bar__fill { background: #50AF7B; }
.specificity-bar--quarterly .specificity-bar__fill { background: #84cc16; }
.specificity-bar--monthly .specificity-bar__fill { background: #eab308; }
.specificity-bar--yearly .specificity-bar__fill { background: #f97316; }
.specificity-bar--relative .specificity-bar__fill { background: #f87171; }
.specificity-bar--vague .specificity-bar__fill { background: #ef4444; }

.specificity-bar__value {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--glass-text-muted);
}

/* Timeline Coverage */
.timeline-coverage {
  padding: var(--spacing-6);

  background: var(--glass-white-12);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-xl);
}

.timeline-coverage__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

.timeline-coverage__info {
  margin-bottom: var(--spacing-5);
}

.timeline-coverage__span {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin-bottom: var(--spacing-2);
}

.timeline-coverage__range {
  font-size: var(--text-base);
  color: var(--glass-text-secondary);
}

/* Timeline Visualization */
.timeline-visual {
  padding: var(--spacing-4);
  background: var(--glass-white-8);
  border: 1px solid var(--glass-white-10);
  border-radius: var(--radius-glass-md);
}

.timeline-visual__months {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-2);
}

.timeline-visual__month {
  font-size: var(--text-xs);
  color: var(--glass-text-muted);
  text-align: center;
  flex: 1;
}

.timeline-visual__events {
  display: flex;
  height: 24px;
  border-bottom: 1px solid var(--glass-white-15);
}

.timeline-visual__slot {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timeline-visual__dot {
  width: 10px;
  height: 10px;
  background: var(--color-glass-success);
  border-radius: 50%;
}

.timeline-visual__years {
  display: flex;
  margin-top: var(--spacing-2);
}

.timeline-visual__year {
  flex: 1;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-secondary);
  text-align: center;
}
```

---

### 6.8 Actions Tab

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  ACTIONS TAB                                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  RECOMMENDED ACTIONS                                          │  │
│  │  ─────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ 1 │ Add specific dates for Phase 2 deliverables        │ │  │
│  │  │   │ and milestones                                      │ │  │
│  │  │   │                               HIGH IMPACT │ LOW EFFORT│ │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ 2 │ Define resource allocation for each workstream      │ │  │
│  │  │   │                               MED IMPACT │ MED EFFORT│ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ 3 │ Include financial projections for Q3 and Q4        │ │  │
│  │  │   │                               HIGH IMPACT │ HIGH EFFORT│
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  SUGGESTED SOURCES                                            │  │
│  │  ─────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  ┌──────────────────────────┐  ┌──────────────────────────┐  │  │
│  │  │  Financial Reports       │  │  Project Schedule         │  │  │
│  │  │  HIGH PRIORITY           │  │  MEDIUM PRIORITY          │  │  │
│  │  │                          │  │                          │  │  │
│  │  │  Quarterly revenue       │  │  Detailed task            │  │  │
│  │  │  projections needed      │  │  dependencies needed      │  │  │
│  │  │  for milestone planning  │  │  for resource planning    │  │  │
│  │  │                          │  │                          │  │  │
│  │  │  Expected: +15% accuracy │  │  Expected: +20% accuracy │  │  │
│  │  └──────────────────────────┘  └──────────────────────────┘  │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
/* Actions Section */
.actions-section {
  margin-bottom: var(--spacing-8);
}

.actions-section__title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-5) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

/* Action Items List - SIMPLIFIED */
.action-items-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.action-item {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: var(--spacing-4);
  align-items: start;

  padding: var(--spacing-5);

  background: var(--glass-white-12);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);

  /* Simple hover - NO transform */
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.action-item:hover {
  background: var(--glass-white-15);
  border-color: var(--glass-white-25);
}

/* Step Number - STATIC, no animation */
.action-item__number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;

  background: var(--glass-white-12);
  border: 2px solid var(--glass-white-25);
  border-radius: 50%;

  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--glass-text-primary);
}

/* High-impact items get accent color */
.action-item--high-impact .action-item__number {
  background: rgba(80, 175, 123, 0.20);
  border-color: rgba(80, 175, 123, 0.50);
  color: var(--color-glass-success);
}

.action-item__content {
  flex: 1;
}

.action-item__text {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  color: var(--glass-text-primary);
  line-height: var(--leading-relaxed);
  margin: 0;
}

/* Badges - SIMPLIFIED */
.action-item__badges {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: flex-end;
}

.action-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-1) var(--spacing-3);

  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  border-radius: var(--radius-full);
  white-space: nowrap;
}

/* Impact Badges */
.action-badge--impact-high {
  background: rgba(80, 175, 123, 0.15);
  color: var(--color-glass-success);
}

.action-badge--impact-medium {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.action-badge--impact-low {
  background: var(--glass-white-12);
  color: var(--glass-text-muted);
}

/* Effort Badges */
.action-badge--effort-low {
  background: rgba(80, 175, 123, 0.10);
  color: var(--color-glass-success-light);
}

.action-badge--effort-medium {
  background: rgba(234, 179, 8, 0.10);
  color: #fbbf24;
}

.action-badge--effort-high {
  background: rgba(239, 68, 68, 0.10);
  color: #f87171;
}

/* Suggested Sources */
.sources-section {
  margin-top: var(--spacing-8);
}

.sources-section__title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-5) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

.sources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-4);
}

.source-card {
  padding: var(--spacing-5);

  background: var(--glass-white-12);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);

  /* Simple hover - NO transform */
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.source-card:hover {
  background: var(--glass-white-15);
  border-color: var(--glass-white-25);
}

.source-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-4);
}

.source-card__type {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
}

.source-card__priority {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
}

.source-card__priority--high {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.source-card__priority--medium {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.source-card__priority--low {
  background: var(--glass-white-12);
  color: var(--glass-text-muted);
}

.source-card__reason {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--glass-text-secondary);
  margin-bottom: var(--spacing-4);
}

.source-card__improvement {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
  padding-top: var(--spacing-3);
  border-top: 1px solid var(--glass-white-15);
}

.source-card__improvement strong {
  color: var(--glass-text-secondary);
}
```

---

## 7. Enhanced Glassmorphic Design System

### 7.1 Updated Glass Opacity Values

```css
/* INCREASED OPACITY for better readability */
:root {
  /* New baseline values - 50-100% more opaque */
  --glass-white-enhanced-8: rgba(255, 255, 255, 0.12);   /* Was 0.08 */
  --glass-white-enhanced-10: rgba(255, 255, 255, 0.15);  /* Was 0.10 */
  --glass-white-enhanced-12: rgba(255, 255, 255, 0.18);  /* Was 0.12 */
  --glass-white-enhanced-15: rgba(255, 255, 255, 0.22);  /* Was 0.15 */
}
```

### 7.2 Enhanced Text Colors

```css
:root {
  /* HIGHER CONTRAST text colors */
  --glass-text-primary-enhanced: #FFFFFF;
  --glass-text-secondary-enhanced: rgba(255, 255, 255, 0.88);  /* Was 0.80 */
  --glass-text-muted-enhanced: rgba(255, 255, 255, 0.72);      /* Was 0.60 */
}
```

### 7.3 Border Visibility

```css
:root {
  /* MORE VISIBLE borders */
  --border-glass-enhanced: 1px solid rgba(255, 255, 255, 0.20);    /* Was 0.15 */
  --border-glass-strong-enhanced: 1px solid rgba(255, 255, 255, 0.30); /* Was 0.25 */
}
```

---

## 8. Animation Philosophy

### 8.1 Animations to REMOVE

```
REMOVED ANIMATIONS:
─────────────────────────────────────────────────────────────────────
✗ scoreShine         - Infinite shimmer on score badges
✗ barShine           - Infinite shine on progress bars
✗ pulse              - Continuous pulsing on status indicators
✗ emptyIconPulse     - Pulsing on empty state icon
✗ staggered delays   - Different animation delays per child
✗ translateY(-2px)   - Hover lift effect on cards
✗ translateY(-3px)   - Aggressive hover effects
─────────────────────────────────────────────────────────────────────
```

### 8.2 Animations to KEEP (Simplified)

```
KEPT ANIMATIONS (PURPOSEFUL ONLY):
─────────────────────────────────────────────────────────────────────
✓ viewFadeIn         - Single 0.4s fade on page load
✓ tabFadeIn          - 0.2s fade on tab content switch
✓ expandCollapse     - 0.3s for theme card expand/collapse
✓ spinnerRotate      - For loading states only
─────────────────────────────────────────────────────────────────────
```

### 8.3 Transition Guidelines

| Element | Property | Duration | Easing | Notes |
|---------|----------|----------|--------|-------|
| Tab button | background, color | 0.15s | ease | Instant feel |
| Card hover | background, border | 0.15s | ease | Subtle feedback |
| Tab content | opacity | 0.2s | ease-out | Smooth switch |
| Progress bars | width | 0.6s | ease-out | One-time on load |
| Expand/collapse | height, opacity | 0.3s | ease-out | Smooth toggle |

---

## 9. Typography & Readability

### 9.1 Minimum Font Sizes

| Element Type | Minimum Size | Weight | Line Height |
|--------------|--------------|--------|-------------|
| Page title | 30px (--text-3xl) | Semibold | 1.2 |
| Section title | 20px (--text-xl) | Semibold | 1.3 |
| Subsection title | 18px (--text-lg) | Semibold | 1.4 |
| Body text | 16px (--text-base) | Normal | 1.75 |
| Labels | 14px (--text-sm) | Medium | 1.5 |
| Badges/Tags | 12px (--text-xs) | Semibold | 1.2 |

### 9.2 Contrast Requirements

```
WCAG 2.1 AA Compliance:
─────────────────────────────────────────────────────────────────────
Body text (secondary):  Minimum 4.5:1 contrast ratio
Large text (primary):   Minimum 3:1 contrast ratio
Interactive elements:   Minimum 3:1 contrast ratio (borders, focus)
─────────────────────────────────────────────────────────────────────

Current Implementation:
--glass-text-primary (#FFFFFF) on navy background: ~15:1 ✓
--glass-text-secondary (0.88 white) on navy: ~10:1 ✓
--glass-text-muted (0.72 white) on navy: ~7:1 ✓
```

---

## 10. Interactive States

### 10.1 State Definitions

```
SIMPLIFIED STATE TRANSITIONS:
─────────────────────────────────────────────────────────────────────

DEFAULT → HOVER
  background:  glass-white-12 → glass-white-15
  border:      glass-white-15 → glass-white-25
  NO transform (no lift effect)

DEFAULT → FOCUS
  outline: 3px solid var(--color-glass-success)
  outline-offset: 2px

DEFAULT → ACTIVE
  background: glass-white-10
  (pressed effect)

DEFAULT → DISABLED
  opacity: 0.5
  cursor: not-allowed

─────────────────────────────────────────────────────────────────────
```

### 10.2 Focus Indicators

```css
/* Universal focus style */
*:focus-visible {
  outline: 3px solid var(--color-glass-success);
  outline-offset: 2px;
}

/* Tab-specific focus */
.tab-button:focus-visible {
  outline-offset: -2px;
  background: var(--glass-white-15);
}

/* Card focus */
.theme-card:focus-within {
  border-color: var(--color-glass-success);
}
```

---

## 11. Responsive Behavior

### 11.1 Breakpoints

| Breakpoint | Name | Tab Navigation | Grid Columns |
|------------|------|----------------|--------------|
| < 480px | Mobile S | Stack vertically | 1 |
| 480-639px | Mobile L | Stack vertically | 1-2 |
| 640-767px | Tablet S | Horizontal, smaller | 2 |
| 768-1023px | Tablet L | Horizontal | 2-3 |
| 1024-1279px | Desktop | Horizontal | 3-4 |
| >= 1280px | Desktop L | Horizontal | 4 |

### 11.2 Mobile Adaptations

```css
@media (max-width: 639px) {
  /* Stack tab navigation vertically */
  .tab-navigation {
    flex-direction: column;
  }

  .tab-button {
    width: 100%;
    justify-content: flex-start;
  }

  /* Single column grids */
  .metrics-grid,
  .quick-stats-grid {
    grid-template-columns: 1fr;
  }

  .sources-grid {
    grid-template-columns: 1fr;
  }

  /* Action items stack badges */
  .action-item {
    grid-template-columns: 40px 1fr;
  }

  .action-item__badges {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: flex-start;
    margin-top: var(--spacing-3);
  }

  /* Reduce padding */
  .research-analysis-view {
    padding: var(--spacing-4);
  }

  .analysis-header {
    flex-direction: column;
    padding: var(--spacing-5);
  }

  .theme-card__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-3);
  }
}

@media (min-width: 640px) and (max-width: 1023px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .quick-stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## 12. Accessibility Requirements

### 12.1 ARIA Implementation

```html
<!-- Tab List -->
<div class="tab-navigation" role="tablist" aria-label="Research analysis sections">
  <button role="tab" aria-selected="true" aria-controls="panel-overview" id="tab-overview">
    Overview
  </button>
  <button role="tab" aria-selected="false" aria-controls="panel-themes" id="tab-themes">
    Themes
  </button>
  <!-- ... -->
</div>

<!-- Tab Panels -->
<div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" tabindex="0">
  <!-- Content -->
</div>

<div id="panel-themes" role="tabpanel" aria-labelledby="tab-themes" tabindex="0" hidden>
  <!-- Content -->
</div>

<!-- Expandable Sections -->
<div class="theme-card">
  <button aria-expanded="true" aria-controls="theme-content-1">
    Theme Name
  </button>
  <div id="theme-content-1">
    <!-- Content -->
  </div>
</div>

<!-- Score Badge -->
<div class="score-badge" role="img" aria-label="Score: 7.5 out of 10, rated Good">
  <span aria-hidden="true">7.5/10</span>
</div>
```

### 12.2 Keyboard Navigation

```
TAB NAVIGATION:
─────────────────────────────────────────────────────────────────────
Tab:           Move to next tab button
Shift+Tab:     Move to previous tab button
Arrow Left:    Move to previous tab (when in tablist)
Arrow Right:   Move to next tab (when in tablist)
Enter/Space:   Activate focused tab
Home:          Move to first tab
End:           Move to last tab
─────────────────────────────────────────────────────────────────────

WITHIN TAB PANEL:
─────────────────────────────────────────────────────────────────────
Tab:           Move through interactive elements
Enter/Space:   Activate buttons, expand/collapse cards
Escape:        Close expanded sections (optional)
─────────────────────────────────────────────────────────────────────
```

### 12.3 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable all animations */
  .research-analysis-view,
  .tab-panel,
  .theme-card__content {
    animation: none !important;
    transition: none !important;
  }

  /* Static progress bars */
  .score-bar-fill,
  .readiness-progress__fill,
  .specificity-bar__fill {
    transition: none !important;
  }

  /* Instant state changes */
  .tab-button,
  .action-item,
  .source-card,
  .theme-card {
    transition: none !important;
  }
}
```

### 12.4 Screen Reader Announcements

```javascript
// Live region for dynamic updates
const liveRegion = document.createElement('div');
liveRegion.setAttribute('aria-live', 'polite');
liveRegion.setAttribute('aria-atomic', 'true');
liveRegion.className = 'sr-only';
document.body.appendChild(liveRegion);

// Announce tab changes
function switchTab(tabId) {
  const tabName = tabs[tabId].label;
  liveRegion.textContent = `Now viewing ${tabName} tab`;
}

// Announce expand/collapse
function toggleThemeCard(card, isExpanded) {
  const themeName = card.querySelector('.theme-card__title').textContent;
  liveRegion.textContent = isExpanded
    ? `${themeName} expanded`
    : `${themeName} collapsed`;
}
```

---

## 13. Implementation Guide

### 13.1 JavaScript Architecture

```javascript
// ResearchAnalysisView.js - Refactored Structure

export class ResearchAnalysisView {
  constructor(analysisData, sessionId) {
    this.analysisData = analysisData;
    this.sessionId = sessionId;
    this.container = null;
    this.activeTab = 'overview';
    this.expandedThemes = new Set();

    // Initialize all themes as expanded
    if (analysisData?.themes) {
      analysisData.themes.forEach((_, index) => {
        this.expandedThemes.add(index);
      });
    }
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'research-analysis-view';

    if (!this.analysisData) {
      return this._renderEmptyState();
    }

    // Render components
    this.container.appendChild(this._renderHeader());
    this.container.appendChild(this._renderTabNavigation());
    this.container.appendChild(this._renderTabContent());

    // Initialize tab behavior
    this._initTabNavigation();

    return this.container;
  }

  // Tab switching
  _switchTab(tabId) {
    // Update active states
    this.activeTab = tabId;

    // Update tab buttons
    this.container.querySelectorAll('.tab-button').forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('tab-button--active', isActive);
      btn.setAttribute('aria-selected', isActive);
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    // Update tab panels
    this.container.querySelectorAll('.tab-panel').forEach(panel => {
      const isActive = panel.id === `panel-${tabId}`;
      panel.classList.toggle('tab-panel--active', isActive);
      panel.setAttribute('aria-hidden', !isActive);
      panel.hidden = !isActive;
    });

    // Update URL hash
    history.replaceState(null, '', `#${tabId}`);
  }

  // ... other methods
}
```

### 13.2 CSS File Structure

```
Public/styles/
├── design-system.css          (existing - no changes)
├── analysis-view.css          (FULL REWRITE)
│   ├── /* Variables override */
│   ├── /* Page container */
│   ├── /* Header */
│   ├── /* Tab navigation */
│   ├── /* Tab content */
│   ├── /* Overview tab components */
│   ├── /* Themes tab components */
│   ├── /* Data quality tab components */
│   ├── /* Actions tab components */
│   ├── /* Responsive styles */
│   └── /* Accessibility */
```

---

## 14. Migration Checklist

### Phase 1: Foundation (Day 1)

- [ ] Create new analysis-view.css with enhanced glass variables
- [ ] Implement page container with single fade animation
- [ ] Build header component (no animations)
- [ ] Build tab navigation bar with keyboard support

### Phase 2: Tab Structure (Day 2)

- [ ] Implement tab panel container
- [ ] Add tab switching logic with ARIA
- [ ] Implement URL hash routing
- [ ] Add reduced motion support

### Phase 3: Overview Tab (Day 3)

- [ ] Build readiness banner (no pulse)
- [ ] Build executive summary section
- [ ] Build key findings list (static bullets)
- [ ] Build critical gaps alert
- [ ] Build quick stats grid (no hover transform)

### Phase 4: Themes Tab (Day 4)

- [ ] Build theme status summary
- [ ] Build theme cards (expanded by default)
- [ ] Build sample events tables
- [ ] Add optional collapse functionality

### Phase 5: Data Quality Tab (Day 5)

- [ ] Build metrics grid
- [ ] Build date specificity chart (no bar shine)
- [ ] Build timeline coverage visualization

### Phase 6: Actions Tab (Day 6)

- [ ] Build action items list (simplified badges)
- [ ] Build suggested sources grid
- [ ] No hover transforms

### Phase 7: Polish & Testing (Day 7)

- [ ] Verify WCAG AA compliance
- [ ] Test keyboard navigation
- [ ] Test screen reader compatibility
- [ ] Test reduced motion preferences
- [ ] Cross-browser testing
- [ ] Responsive testing

---

## Appendix A: Animation Comparison

### Before (v1.0) - Excessive

```css
/* Score badge shimmer - INFINITE */
@keyframes scoreShine {
  0%, 100% { left: -100%; }
  50% { left: 100%; }
}
.score-badge::before { animation: scoreShine 3s ease-in-out infinite; }

/* Bar shine - INFINITE */
@keyframes barShine {
  0% { left: -100%; }
  100% { left: 100%; }
}
.bar-fill::after { animation: barShine 2s ease-in-out infinite; }

/* Timestamp pulse - INFINITE */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.analysis-timestamp::before { animation: pulse 2s ease-in-out infinite; }

/* Staggered entrances - 7 DIFFERENT DELAYS */
.analysis-main-content > *:nth-child(1) { animation-delay: 0.15s; }
.analysis-main-content > *:nth-child(2) { animation-delay: 0.20s; }
/* ... etc */

/* Hover transforms - ON EVERY CARD */
.theme-card:hover { transform: translateY(-2px); }
.action-item:hover { transform: translateY(-2px); }
.source-item:hover { transform: translateY(-3px) translateX(2px); }
```

### After (v2.0) - Minimal

```css
/* Single page entrance */
@keyframes viewFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.research-analysis-view { animation: viewFadeIn 0.4s ease-out; }

/* Tab content fade */
@keyframes tabFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.tab-panel--active { animation: tabFadeIn 0.2s ease-out; }

/* Simple hover - NO transform */
.theme-card:hover {
  background: var(--glass-white-15);
  border-color: var(--glass-white-25);
}

/* NO infinite animations */
/* NO staggered delays */
/* NO hover transforms */
```

---

## Appendix B: File Changes Summary

### Files to Modify

| File | Change Type | Scope |
|------|-------------|-------|
| `Public/styles/analysis-view.css` | Full rewrite | ~1500 lines |
| `Public/components/views/ResearchAnalysisView.js` | Major refactor | ~800 lines |

### New CSS Variables

```css
/* Add to design-system.css (optional) or analysis-view.css */
--glass-white-enhanced-12: rgba(255, 255, 255, 0.18);
--glass-text-secondary-enhanced: rgba(255, 255, 255, 0.88);
--glass-text-muted-enhanced: rgba(255, 255, 255, 0.72);
```

---

*End of Design Specification v2.0*
