# Research QA Screen - Glassmorphic Design Specification

**Version:** 1.0
**Date:** 2025-11-26
**Status:** Approved for Implementation
**Target Files:**
- `Public/styles/analysis-view.css`
- `Public/components/views/ResearchAnalysisView.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Color & Token Reference](#3-color--token-reference)
4. [Component Specifications](#4-component-specifications)
   - 4.1 [Page Container](#41-page-container)
   - 4.2 [Header Card](#42-header-card)
   - 4.3 [Score Badges](#43-score-badges)
   - 4.4 [Section Cards](#44-section-cards)
   - 4.5 [Gantt Readiness Section](#45-gantt-readiness-section)
   - 4.6 [Stats Grid](#46-stats-grid)
   - 4.7 [Critical Gaps Alert](#47-critical-gaps-alert)
   - 4.8 [Theme Cards (Collapsible)](#48-theme-cards-collapsible)
   - 4.9 [Action Items (Step Cards)](#49-action-items-step-cards)
   - 4.10 [Data Completeness Section](#410-data-completeness-section)
   - 4.11 [Suggested Sources](#411-suggested-sources)
   - 4.12 [Empty State](#412-empty-state)
5. [Animation Specifications](#5-animation-specifications)
6. [Responsive Behavior](#6-responsive-behavior)
7. [Accessibility Requirements](#7-accessibility-requirements)
8. [Implementation Checklist](#8-implementation-checklist)

---

## 1. Overview

### 1.1 Purpose

This specification defines the glassmorphic design system for the Research QA screen, ensuring visual consistency with the file upload screen while maintaining excellent usability and accessibility.

### 1.2 Goals

- **Visual Cohesion:** Match the established glassmorphic design language from the upload screen
- **Information Hierarchy:** Create clear visual distinction between primary, secondary, and tertiary content
- **Interactivity:** Provide smooth, delightful interactions with appropriate feedback
- **Performance:** Maintain 60fps animations and minimal layout shifts
- **Accessibility:** Meet WCAG 2.1 AA compliance

### 1.3 Current State Analysis

| Aspect | Current | Target |
|--------|---------|--------|
| Entrance animations | None | Staggered fade-slide |
| Card depth consistency | Mixed (`glass-white-6` to `glass-white-8`) | Hierarchical (3 levels) |
| Interactive feedback | Basic hover | Lift + glow effects |
| Action items | Flat list | Numbered step cards |
| Theme cards | Basic accordion | Premium collapsible |

---

## 2. Design Principles

### 2.1 Glassmorphism Fundamentals

```
┌─────────────────────────────────────────────────────────────┐
│  GLASSMORPHIC LAYER COMPOSITION                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────┐                   │
│  │  LAYER 4: Content (text, icons)     │                   │
│  ├─────────────────────────────────────┤                   │
│  │  LAYER 3: Inner highlight           │  inset shadow     │
│  ├─────────────────────────────────────┤                   │
│  │  LAYER 2: Glass surface             │  rgba background  │
│  ├─────────────────────────────────────┤                   │
│  │  LAYER 1: Blur effect               │  backdrop-filter  │
│  ├─────────────────────────────────────┤                   │
│  │  LAYER 0: Drop shadow               │  box-shadow       │
│  └─────────────────────────────────────┘                   │
│                                                             │
│  Background gradient (navy)                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Elevation System

| Level | Use Case | Background | Shadow | Blur |
|-------|----------|------------|--------|------|
| **Level 1** | Tertiary content, nested elements | `glass-white-6` | `shadow-glass-1` | `blur-sm` (8px) |
| **Level 2** | Secondary sections, cards | `glass-white-8` | `shadow-glass-2` | `blur-md` (12px) |
| **Level 3** | Primary sections, header | `glass-white-10` | `shadow-glass-3` | `blur-xl` (20px) |
| **Level 4** | Modal overlays, dialogs | `glass-white-12` | `shadow-glass-4` | `blur-2xl` (32px) |

### 2.3 Interactive States

```
┌────────────────────────────────────────────────────────────┐
│  STATE TRANSITIONS                                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  DEFAULT ──────► HOVER ──────► ACTIVE ──────► FOCUS       │
│     │              │              │              │          │
│     ▼              ▼              ▼              ▼          │
│  glass-white-6   glass-white-10  glass-white-8   + outline │
│  translateY(0)   translateY(-2)  translateY(0)   + glow    │
│  shadow-1        shadow-2        shadow-1        shadow-2   │
│                                                            │
│  Timing: 0.2s ease (var(--ease-out-quad))                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Color & Token Reference

### 3.1 Glass Effect Colors

```css
/* Primary glass backgrounds */
--glass-white-5:  rgba(255, 255, 255, 0.05);  /* Subtle nested elements */
--glass-white-6:  rgba(255, 255, 255, 0.06);  /* Level 1 cards */
--glass-white-8:  rgba(255, 255, 255, 0.08);  /* Level 2 cards */
--glass-white-10: rgba(255, 255, 255, 0.10);  /* Level 3 cards, hover states */
--glass-white-12: rgba(255, 255, 255, 0.12);  /* Strong hover, active */
--glass-white-15: rgba(255, 255, 255, 0.15);  /* Borders, highlights */
--glass-white-20: rgba(255, 255, 255, 0.20);  /* Strong borders */
--glass-white-25: rgba(255, 255, 255, 0.25);  /* Active borders */
```

### 3.2 Text Colors

```css
--glass-text-primary:   #FFFFFF;                    /* Headings, emphasis */
--glass-text-secondary: rgba(255, 255, 255, 0.80);  /* Body text */
--glass-text-muted:     rgba(255, 255, 255, 0.60);  /* Labels, captions */
--glass-text-disabled:  rgba(255, 255, 255, 0.40);  /* Disabled states */
```

### 3.3 Semantic Colors

```css
/* Success (Green) */
--color-glass-success:       #50AF7B;
--color-glass-success-light: #6BC492;
--success-bg:    rgba(80, 175, 123, 0.15);
--success-border: rgba(80, 175, 123, 0.40);

/* Warning (Yellow/Amber) */
--warning-bg:    rgba(234, 179, 8, 0.15);
--warning-border: rgba(234, 179, 8, 0.40);
--warning-text:  #fbbf24;

/* Error (Red) */
--error-bg:      rgba(239, 68, 68, 0.15);
--error-border:  rgba(239, 68, 68, 0.40);
--error-text:    #f87171;

/* Info (Blue) */
--info-bg:       rgba(59, 130, 246, 0.15);
--info-border:   rgba(59, 130, 246, 0.40);
--info-text:     #60a5fa;
```

### 3.4 Score Tier Colors

| Score Range | Rating | Background | Border | Badge Glow |
|-------------|--------|------------|--------|------------|
| 9-10 | Excellent | `rgba(80, 175, 123, 0.20)` | `rgba(80, 175, 123, 0.40)` | `0 0 20px rgba(80, 175, 123, 0.3)` |
| 7-8 | Good | `rgba(132, 204, 22, 0.20)` | `rgba(132, 204, 22, 0.40)` | `0 0 20px rgba(132, 204, 22, 0.3)` |
| 5-6 | Adequate | `rgba(234, 179, 8, 0.20)` | `rgba(234, 179, 8, 0.40)` | `0 0 20px rgba(234, 179, 8, 0.3)` |
| 3-4 | Poor | `rgba(249, 115, 22, 0.20)` | `rgba(249, 115, 22, 0.40)` | `0 0 20px rgba(249, 115, 22, 0.3)` |
| 0-2 | Inadequate | `rgba(239, 68, 68, 0.20)` | `rgba(239, 68, 68, 0.40)` | `0 0 20px rgba(239, 68, 68, 0.3)` |

---

## 4. Component Specifications

### 4.1 Page Container

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     RESEARCH QA SCREEN                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  .research-analysis-view                                  │  │
│  │  max-width: 1200px                                        │  │
│  │  padding: 24px (mobile) / 32px (tablet) / 48px (desktop)  │  │
│  │  margin: 0 auto                                           │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Header Card                                        │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                        ↓ 24px gap                         │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Section Cards (stacked)                            │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Background: bg-glass-gradient (inherited from body)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.research-analysis-view {
  /* Layout */
  padding: var(--spacing-6);
  max-width: 1200px;
  margin: 0 auto;

  /* Animation */
  animation: glassFadeSlideUp 0.6s var(--ease-out-expo) forwards;
  opacity: 0;
}

.analysis-main-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

/* Staggered entrance for child sections */
.research-analysis-view > .analysis-header {
  animation: glassFadeSlideUp 0.6s var(--ease-out-expo) 0.1s forwards;
  opacity: 0;
}

.analysis-main-content > *:nth-child(1) { animation-delay: 0.15s; }
.analysis-main-content > *:nth-child(2) { animation-delay: 0.20s; }
.analysis-main-content > *:nth-child(3) { animation-delay: 0.25s; }
.analysis-main-content > *:nth-child(4) { animation-delay: 0.30s; }
.analysis-main-content > *:nth-child(5) { animation-delay: 0.35s; }
.analysis-main-content > *:nth-child(6) { animation-delay: 0.40s; }
.analysis-main-content > *:nth-child(7) { animation-delay: 0.45s; }

.analysis-main-content > * {
  animation: glassFadeSlideUp 0.6s var(--ease-out-expo) forwards;
  opacity: 0;
}
```

---

### 4.2 Header Card

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER CARD (Level 3 Elevation)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ┌─────────────────────────────┐  ┌─────────────────┐  │   │
│  │  │  TITLE SECTION              │  │  SCORE SECTION  │  │   │
│  │  │                             │  │                 │  │   │
│  │  │  Research Quality Analysis  │  │   ┌─────────┐   │  │   │
│  │  │  ─────────────────────────  │  │   │  8.5/10 │   │  │   │
│  │  │  Generated: Nov 26, 2025    │  │   └─────────┘   │  │   │
│  │  │                             │  │  Overall Score  │  │   │
│  │  └─────────────────────────────┘  └─────────────────┘  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Background: glass-white-10 + gradient overlay                  │
│  Border: border-glass                                           │
│  Shadow: shadow-glass-3                                         │
│  Blur: blur-xl (20px)                                          │
│  Border-radius: radius-glass-xl (24px)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.analysis-header {
  /* Layout */
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-6);
  padding: var(--spacing-6);

  /* Glass Effect - Level 3 */
  background: var(--glass-white-10);
  backdrop-filter: blur(var(--blur-xl));
  -webkit-backdrop-filter: blur(var(--blur-xl));

  /* Border */
  border: var(--border-glass);
  border-radius: var(--radius-glass-xl);

  /* Shadow with inner highlight */
  box-shadow:
    var(--shadow-glass-3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  /* Gradient overlay for depth */
  position: relative;
  overflow: hidden;
}

.analysis-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.05) 0%,
    transparent 100%
  );
  pointer-events: none;
}

/* Title section */
.analysis-title-section {
  flex: 1;
  position: relative;
  z-index: 1;
}

.analysis-title {
  font-size: var(--text-3xl);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-2) 0;
  letter-spacing: -0.01em;
}

.analysis-timestamp {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.analysis-timestamp::before {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--color-glass-success);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

/* Score section */
.analysis-score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
  position: relative;
  z-index: 1;
}

.score-label {
  font-size: var(--text-sm);
  color: var(--glass-text-secondary);
  font-weight: var(--weight-medium);
}
```

---

### 4.3 Score Badges

#### Visual Design

```
┌───────────────────────────────────────────────────────────┐
│  SCORE BADGE VARIANTS                                      │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  SIZE: LARGE (Header)           SIZE: SMALL (Theme cards) │
│  ┌─────────────────────┐        ┌─────────────┐           │
│  │                     │        │             │           │
│  │    ╭─────────────╮  │        │  ╭───────╮  │           │
│  │    │    8.5      │  │        │  │  7.2  │  │           │
│  │    │    ───      │  │        │  │  ──   │  │           │
│  │    │    /10      │  │        │  │  /10  │  │           │
│  │    ╰─────────────╯  │        │  ╰───────╯  │           │
│  │                     │        │             │           │
│  │  Inner glow effect  │        │  Compact    │           │
│  │  Gradient shine     │        │             │           │
│  └─────────────────────┘        └─────────────┘           │
│                                                           │
│  Color varies by score tier (see Section 3.4)             │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.score-badge {
  /* Layout */
  display: flex;
  align-items: baseline;
  gap: 2px;
  padding: var(--spacing-2) var(--spacing-3);

  /* Glass effect */
  background: var(--glass-white-10);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: var(--border-glass);
  border-radius: var(--radius-glass-md);

  /* Inner highlight */
  position: relative;
  overflow: hidden;
}

/* Gradient shine overlay */
.score-badge::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  animation: scoreShine 3s ease-in-out infinite;
}

@keyframes scoreShine {
  0%, 100% { left: -100%; }
  50% { left: 100%; }
}

/* Size variants */
.score-badge.size-large {
  padding: var(--spacing-4) var(--spacing-5);
  border-radius: var(--radius-glass-lg);
}

.score-badge.size-large .score-value {
  font-size: var(--text-4xl);
  font-weight: var(--weight-bold);
}

.score-badge.size-large .score-max {
  font-size: var(--text-lg);
}

.score-badge.size-small {
  padding: var(--spacing-1) var(--spacing-2);
}

.score-badge.size-small .score-value {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.score-badge.size-small .score-max {
  font-size: var(--text-xs);
}

/* Score tier colors with glow */
.score-badge.score-excellent {
  background: rgba(80, 175, 123, 0.20);
  border-color: rgba(80, 175, 123, 0.40);
  box-shadow:
    0 0 20px rgba(80, 175, 123, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.score-badge.score-good {
  background: rgba(132, 204, 22, 0.20);
  border-color: rgba(132, 204, 22, 0.40);
  box-shadow:
    0 0 20px rgba(132, 204, 22, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.score-badge.score-adequate {
  background: rgba(234, 179, 8, 0.20);
  border-color: rgba(234, 179, 8, 0.40);
  box-shadow:
    0 0 20px rgba(234, 179, 8, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.score-badge.score-poor {
  background: rgba(249, 115, 22, 0.20);
  border-color: rgba(249, 115, 22, 0.40);
  box-shadow:
    0 0 20px rgba(249, 115, 22, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.score-badge.score-inadequate {
  background: rgba(239, 68, 68, 0.20);
  border-color: rgba(239, 68, 68, 0.40);
  box-shadow:
    0 0 20px rgba(239, 68, 68, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* Text styling */
.score-value {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  color: var(--glass-text-primary);
  position: relative;
  z-index: 1;
}

.score-max {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
  position: relative;
  z-index: 1;
}
```

---

### 4.4 Section Cards

#### Elevation Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  SECTION CARD HIERARCHY                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LEVEL 3 - Primary Sections (Most important)                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Executive Summary                                     │   │
│  │  • Gantt Chart Readiness                                 │   │
│  │                                                         │   │
│  │  glass-white-10 | shadow-glass-3 | blur-xl              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  LEVEL 2 - Secondary Sections                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Theme Analysis                                        │   │
│  │  • Data Completeness                                     │   │
│  │                                                         │   │
│  │  glass-white-8 | shadow-glass-2 | blur-md               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  LEVEL 1 - Tertiary Sections                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Recommended Actions                                   │   │
│  │  • Suggested Sources                                     │   │
│  │                                                         │   │
│  │  glass-white-6 | shadow-glass-1 | blur-sm               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
/* Base section card */
.analysis-section {
  padding: var(--spacing-6);
  border: var(--border-glass);
  border-radius: var(--radius-glass-xl);
  transition: all 0.25s var(--ease-out-quad);
  position: relative;
  overflow: hidden;
}

/* Level 3 - Primary sections */
.analysis-section.section-primary,
.summary-section,
.gantt-readiness-section {
  background: var(--glass-white-10);
  backdrop-filter: blur(var(--blur-xl));
  -webkit-backdrop-filter: blur(var(--blur-xl));
  box-shadow: var(--shadow-glass-3);
}

/* Level 2 - Secondary sections */
.analysis-section.section-secondary,
.themes-section,
.data-completeness-section {
  background: var(--glass-white-8);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  box-shadow: var(--shadow-glass-2);
}

/* Level 1 - Tertiary sections */
.analysis-section.section-tertiary,
.action-items-section,
.suggested-sources-section {
  background: var(--glass-white-6);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  box-shadow: var(--shadow-glass-1);
}

/* Hover state for all sections */
.analysis-section:hover {
  background: var(--glass-white-12);
  border-color: var(--glass-white-25);
  transform: translateY(-2px);
}

.analysis-section.section-primary:hover,
.summary-section:hover,
.gantt-readiness-section:hover {
  box-shadow: var(--shadow-glass-4);
}

.analysis-section.section-secondary:hover,
.themes-section:hover,
.data-completeness-section:hover {
  box-shadow: var(--shadow-glass-3);
}

.analysis-section.section-tertiary:hover,
.action-items-section:hover,
.suggested-sources-section:hover {
  box-shadow: var(--shadow-glass-2);
}

/* Section title with icon */
.section-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: var(--border-glass);
}

.section-icon {
  width: 28px;
  height: 28px;
  background: var(--glass-white-10);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-base);
}
```

---

### 4.5 Gantt Readiness Section

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  GANTT READINESS SECTION                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📊 Gantt Chart Readiness                                │   │
│  │  ─────────────────────────────────────────────────────── │   │
│  │                                                         │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ ▌ ✅ Ready for Gantt Chart Creation               │  │   │
│  │  │ ▌                                                 │  │   │
│  │  │ ▌ Left accent bar indicates status color          │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │   │
│  │  │   4/5        │ │     12       │ │   Months     │    │   │
│  │  │ Ready Themes │ │ Est. Tasks   │ │ Rec. Interval│    │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘    │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.gantt-readiness-section {
  /* Inherits Level 3 styling */
}

/* Verdict banner */
.readiness-verdict {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-5);
  margin-bottom: var(--spacing-5);

  /* Glass container */
  background: var(--glass-white-8);
  backdrop-filter: blur(var(--blur-lg));
  -webkit-backdrop-filter: blur(var(--blur-lg));
  border: var(--border-glass);
  border-radius: var(--radius-glass-lg);

  /* Left accent bar */
  position: relative;
  overflow: hidden;
}

.readiness-verdict::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: var(--radius-glass-sm) 0 0 var(--radius-glass-sm);
}

/* Verdict status colors */
.readiness-verdict.verdict-ready {
  background: rgba(80, 175, 123, 0.10);
  border-color: rgba(80, 175, 123, 0.30);
}

.readiness-verdict.verdict-ready::before {
  background: linear-gradient(180deg,
    var(--color-glass-success) 0%,
    var(--color-glass-success-light) 100%
  );
}

.readiness-verdict.verdict-needs-improvement {
  background: rgba(234, 179, 8, 0.10);
  border-color: rgba(234, 179, 8, 0.30);
}

.readiness-verdict.verdict-needs-improvement::before {
  background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
}

.readiness-verdict.verdict-insufficient {
  background: rgba(239, 68, 68, 0.10);
  border-color: rgba(239, 68, 68, 0.30);
}

.readiness-verdict.verdict-insufficient::before {
  background: linear-gradient(180deg, #f87171 0%, #ef4444 100%);
}

.verdict-icon {
  font-size: var(--text-2xl);
  line-height: 1;
}

.verdict-text {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  color: var(--glass-text-primary);
}

/* Stats grid */
.readiness-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-4);
}
```

---

### 4.6 Stats Grid

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  STATS GRID (Matches upload screen stat-card-glass)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │                  │  │                  │  │              │  │
│  │      4/5         │  │       12         │  │   Months     │  │
│  │                  │  │                  │  │              │  │
│  │   Ready Themes   │  │  Estimated Tasks │  │  Interval    │  │
│  │                  │  │                  │  │              │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                 │
│  Hover: translateY(-2px) + shadow-glass-2                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.stat-card {
  /* Glass effect */
  background: var(--glass-white-8);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));

  /* Border */
  border: 1px solid var(--glass-white-12);
  border-radius: var(--radius-glass-md);

  /* Shadow */
  box-shadow: var(--shadow-glass-1);

  /* Layout */
  padding: var(--spacing-4);
  text-align: center;

  /* Interaction */
  transition: all 0.2s var(--ease-out-quad);
  cursor: default;
}

.stat-card:hover {
  background: var(--glass-white-12);
  border-color: var(--glass-white-20);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glass-2);
}

.stat-card .stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  color: var(--glass-text-primary);
  margin-bottom: var(--spacing-1);
  line-height: 1.2;
}

.stat-card .stat-label {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
  font-weight: var(--weight-medium);
}

/* Metric cards (data completeness) - 4 column variant */
.completeness-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-4);
}

.metric-card {
  /* Same as stat-card */
  background: var(--glass-white-8);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: 1px solid var(--glass-white-12);
  border-radius: var(--radius-glass-md);
  box-shadow: var(--shadow-glass-1);
  padding: var(--spacing-4);
  text-align: center;
  transition: all 0.2s var(--ease-out-quad);
}

.metric-card:hover {
  background: var(--glass-white-12);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glass-2);
}

.metric-card .metric-value {
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  color: var(--glass-text-primary);
  margin-bottom: var(--spacing-1);
}

.metric-card .metric-label {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
}
```

---

### 4.7 Critical Gaps Alert

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  CRITICAL GAPS ALERT                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ▌                                                       │   │
│  │ ▌  ⚠️ Critical Gaps to Address                          │   │
│  │ ▌  ───────────────────────────────────────────────────  │   │
│  │ ▌                                                       │   │
│  │ ▌  (!) Missing financial projections for Q3            │   │
│  │ ▌  (!) No timeline specified for Phase 2               │   │
│  │ ▌  (!) Resource allocation undefined                   │   │
│  │ ▌                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Left border: 4px solid error-red gradient                      │
│  Background: error-bg with glass effect                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.critical-gaps-alert {
  /* Glass container with error tint */
  background: rgba(239, 68, 68, 0.08);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));

  /* Border */
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--radius-glass-lg);

  /* Left accent */
  border-left: 4px solid;
  border-image: linear-gradient(180deg, #f87171 0%, #ef4444 100%) 1;

  /* Layout */
  padding: var(--spacing-5);
}

.alert-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.alert-icon {
  font-size: var(--text-xl);
  line-height: 1;
}

.alert-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
}

.gaps-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.gaps-list li {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-2) 0;
  color: var(--glass-text-secondary);
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
}

.gaps-list li::before {
  content: '!';
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: rgba(239, 68, 68, 0.20);
  border: 1px solid rgba(239, 68, 68, 0.40);
  border-radius: 50%;
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: #f87171;
  margin-top: 2px;
}
```

---

### 4.8 Theme Cards (Collapsible)

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  THEME CARD - COLLAPSED STATE                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ▶  Market Research Analysis     [7.5/10] [✓ In Gantt]  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  THEME CARD - EXPANDED STATE                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ▼  Market Research Analysis     [7.5/10] [✓ In Gantt]  │   │
│  │  ───────────────────────────────────────────────────── │   │
│  │                                                         │   │
│  │  Analysis of competitive landscape and market trends... │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  5 dates  │  8 tasks  │  Quality: Good          │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  Strengths                                              │   │
│  │  + Clear timeline for market entry                      │   │
│  │  + Well-defined competitor analysis                     │   │
│  │                                                         │   │
│  │  Gaps                                                   │   │
│  │  - Missing pricing strategy details                     │   │
│  │                                                         │   │
│  │  Sample Events                                          │   │
│  │  ┌───────────────────────────────────────────────┐     │   │
│  │  │ Event          │ Date Info    │ Quality      │     │   │
│  │  ├───────────────────────────────────────────────┤     │   │
│  │  │ Market Launch  │ Q2 2025      │ [Quarterly]  │     │   │
│  │  │ Beta Release   │ March 15     │ [Specific]   │     │   │
│  │  └───────────────────────────────────────────────┘     │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.themes-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.theme-card {
  /* Glass container */
  background: var(--glass-white-6);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));

  /* Border */
  border: var(--border-glass);
  border-radius: var(--radius-glass-lg);

  /* Shadow with inner highlight */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    var(--shadow-glass-1);

  overflow: hidden;
  transition: all 0.25s var(--ease-out-quad);
}

.theme-card:hover {
  background: var(--glass-white-8);
  border-color: var(--glass-white-20);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    var(--shadow-glass-2);
}

.theme-card[data-expanded="true"] {
  background: var(--glass-white-8);
  border-color: var(--glass-white-25);
}

/* Header button */
.theme-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: var(--spacing-4) var(--spacing-5);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--glass-text-primary);
  text-align: left;
  transition: background 0.2s ease;
}

.theme-card-header:hover {
  background: var(--glass-white-5);
}

.theme-card-header:focus-visible {
  outline: 3px solid var(--color-glass-success);
  outline-offset: -3px;
}

.theme-header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.expand-icon {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
  transition: transform 0.3s var(--ease-out-expo);
  width: 16px;
  text-align: center;
}

.theme-card[data-expanded="true"] .expand-icon {
  transform: rotate(90deg);
  color: var(--color-glass-success);
}

.theme-name {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--glass-text-primary);
}

.theme-header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

/* Inclusion badge */
.inclusion-badge {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-glass-sm);
}

.inclusion-badge.included {
  background: rgba(80, 175, 123, 0.15);
  color: var(--color-glass-success);
  border: 1px solid rgba(80, 175, 123, 0.30);
}

.inclusion-badge.excluded {
  background: rgba(239, 68, 68, 0.10);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

/* Collapsible content */
.theme-card-content {
  max-height: 0;
  overflow: hidden;
  transition:
    max-height 0.4s var(--ease-out-expo),
    padding 0.3s var(--ease-out-expo),
    opacity 0.3s ease;
  opacity: 0;
  padding: 0 var(--spacing-5);
}

.theme-card-content.expanded {
  max-height: 1500px;
  padding: 0 var(--spacing-5) var(--spacing-5);
  opacity: 1;
}

/* Description */
.theme-description {
  color: var(--glass-text-secondary);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  margin: 0 0 var(--spacing-4) 0;
  padding-top: var(--spacing-3);
  border-top: var(--border-glass);
}

/* Stats row */
.theme-stats-row {
  display: flex;
  gap: var(--spacing-4);
  flex-wrap: wrap;
  padding: var(--spacing-3);
  background: var(--glass-white-5);
  border: 1px solid var(--glass-white-8);
  border-radius: var(--radius-glass-sm);
  margin-bottom: var(--spacing-4);
}

.theme-stats-row .stat {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-sm);
  color: var(--glass-text-secondary);
}

.theme-stats-row .stat strong {
  color: var(--glass-text-primary);
  font-weight: var(--weight-semibold);
}

/* List sections (strengths, gaps, recommendations) */
.list-section {
  margin-bottom: var(--spacing-4);
}

.list-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-2) 0;
}

.list-items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.list-items li {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  font-size: var(--text-sm);
  color: var(--glass-text-secondary);
  padding: var(--spacing-1) 0;
  line-height: var(--leading-relaxed);
}

.list-strengths .list-items li::before {
  content: '+';
  color: var(--color-glass-success);
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}

.list-gaps .list-items li::before {
  content: '-';
  color: #f87171;
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}

.list-recommendations .list-items li::before {
  content: '>';
  color: var(--glass-text-muted);
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}

/* Sample events table */
.sample-events-container {
  margin-top: var(--spacing-4);
}

.events-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-2) 0;
}

.sample-events-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--glass-white-5);
  border: 1px solid var(--glass-white-10);
  border-radius: var(--radius-glass-md);
  overflow: hidden;
}

.sample-events-table th,
.sample-events-table td {
  padding: var(--spacing-3);
  text-align: left;
  font-size: var(--text-sm);
  border-bottom: var(--border-glass);
}

.sample-events-table th {
  background: var(--glass-white-8);
  color: var(--glass-text-primary);
  font-weight: var(--weight-semibold);
}

.sample-events-table td {
  color: var(--glass-text-secondary);
}

.sample-events-table tr:last-child td {
  border-bottom: none;
}

.sample-events-table tr:hover td {
  background: var(--glass-white-5);
}

/* Quality badges */
.quality-badge {
  display: inline-block;
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-glass-sm);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.quality-badge.quality-specific,
.quality-badge.quality-excellent {
  background: rgba(80, 175, 123, 0.15);
  color: var(--color-glass-success);
}

.quality-badge.quality-approximate,
.quality-badge.quality-good {
  background: rgba(132, 204, 22, 0.15);
  color: #a3e635;
}

.quality-badge.quality-adequate {
  background: rgba(234, 179, 8, 0.15);
  color: #fbbf24;
}

.quality-badge.quality-vague,
.quality-badge.quality-poor {
  background: rgba(249, 115, 22, 0.15);
  color: #fb923c;
}

.quality-badge.quality-missing,
.quality-badge.quality-inadequate {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}
```

---

### 4.9 Action Items (Step Cards)

**This is a critical component requiring careful formatting.**

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  ACTION ITEMS - STEP CARDS                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ┌───┐                                     ┌─────────┐  │   │
│  │  │ 1 │  Add specific dates for Phase 2     │HIGH     │  │   │
│  │  └───┘  deliverables and milestones        │IMPACT   │  │   │
│  │                                             ├─────────┤  │   │
│  │         This will significantly improve    │LOW      │  │   │
│  │         the Gantt chart accuracy...        │EFFORT   │  │   │
│  │                                             └─────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                        ↓ 16px gap                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ┌───┐                                     ┌─────────┐  │   │
│  │  │ 2 │  Define resource allocation for     │MEDIUM   │  │   │
│  │  └───┘  each workstream                    │IMPACT   │  │   │
│  │                                             ├─────────┤  │   │
│  │         Currently missing FTE estimates... │MEDIUM   │  │   │
│  │                                             │EFFORT   │  │   │
│  │                                             └─────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step number: Circular glass badge with auto-increment          │
│  High-impact items: Green accent on number badge                │
│  Hover: translateY(-2px) + shadow increase                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.action-items-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  counter-reset: action-counter;
}

.action-item {
  /* Layout: 3-column grid */
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--spacing-4);
  align-items: start;

  /* Glass card */
  padding: var(--spacing-5);
  background: var(--glass-white-6);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: var(--border-glass);
  border-radius: var(--radius-glass-lg);

  /* Shadow */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    var(--shadow-glass-1);

  /* Interaction */
  transition: all 0.25s var(--ease-out-quad);
  position: relative;
}

.action-item:hover {
  background: var(--glass-white-10);
  border-color: var(--glass-white-25);
  transform: translateY(-2px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    var(--shadow-glass-2);
}

/* Step number badge */
.action-item::before {
  counter-increment: action-counter;
  content: counter(action-counter);

  /* Glass circle */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--glass-white-10);
  border: 1px solid var(--glass-white-20);
  border-radius: 50%;

  /* Typography */
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
  color: var(--glass-text-primary);

  /* Prevent shrinking */
  flex-shrink: 0;
}

/* High-impact items get green accent */
.action-item.impact-high::before {
  background: rgba(80, 175, 123, 0.20);
  border-color: rgba(80, 175, 123, 0.40);
  color: var(--color-glass-success);
  box-shadow: 0 0 12px rgba(80, 175, 123, 0.2);
}

/* Medium-impact items get amber accent */
.action-item.impact-medium::before {
  background: rgba(234, 179, 8, 0.15);
  border-color: rgba(234, 179, 8, 0.35);
  color: #fbbf24;
}

/* Action content */
.action-content {
  flex: 1;
  min-width: 0;
}

.action-text {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--glass-text-primary);
  line-height: var(--leading-relaxed);
  margin: 0;
}

/* Badges container */
.action-badges {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: flex-end;
}

/* Impact and effort badges */
.impact-badge,
.effort-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-glass-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Impact badge colors */
.impact-badge.impact-high {
  background: rgba(80, 175, 123, 0.15);
  color: var(--color-glass-success);
  border: 1px solid rgba(80, 175, 123, 0.30);
}

.impact-badge.impact-medium {
  background: rgba(234, 179, 8, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(234, 179, 8, 0.30);
}

.impact-badge.impact-low {
  background: var(--glass-white-10);
  color: var(--glass-text-muted);
  border: 1px solid var(--glass-white-15);
}

/* Effort badge colors */
.effort-badge.effort-low {
  background: rgba(80, 175, 123, 0.10);
  color: var(--color-glass-success-light);
  border: 1px solid rgba(80, 175, 123, 0.25);
}

.effort-badge.effort-medium {
  background: rgba(234, 179, 8, 0.10);
  color: #fcd34d;
  border: 1px solid rgba(234, 179, 8, 0.25);
}

.effort-badge.effort-high {
  background: rgba(239, 68, 68, 0.10);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.25);
}
```

#### JavaScript Enhancement

```javascript
// In ResearchAnalysisView.js

_renderActionItems() {
  const section = document.createElement('section');
  section.className = 'analysis-section section-tertiary action-items-section';

  const sectionTitle = document.createElement('h2');
  sectionTitle.className = 'section-title';
  sectionTitle.innerHTML = `
    <span class="section-icon">📋</span>
    Recommended Actions
  `;
  section.appendChild(sectionTitle);

  const itemsList = document.createElement('div');
  itemsList.className = 'action-items-list';

  this.analysisData.actionItems.forEach((item, index) => {
    const itemEl = document.createElement('div');
    // Add impact class for styling
    itemEl.className = `action-item impact-${item.impact}`;

    // Note: The ::before pseudo-element handles the step number

    itemEl.innerHTML = `
      <div class="action-content">
        <p class="action-text">${DOMPurify.sanitize(item.action)}</p>
      </div>
      <div class="action-badges">
        <span class="impact-badge impact-${item.impact}">${item.impact} impact</span>
        <span class="effort-badge effort-${item.effort}">${item.effort} effort</span>
      </div>
    `;

    itemsList.appendChild(itemEl);
  });

  section.appendChild(itemsList);
  return section;
}
```

---

### 4.10 Data Completeness Section

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  DATA COMPLETENESS SECTION                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📈 Data Completeness                                    │   │
│  │  ─────────────────────────────────────────────────────── │   │
│  │                                                         │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │   │
│  │  │   24   │ │   18   │ │   15   │ │   3    │           │   │
│  │  │ Dates  │ │ Events │ │ w/Date │ │ w/o    │           │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘           │   │
│  │                                                         │   │
│  │  Date Specificity Breakdown                             │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │                                                         │   │
│  │  Specific    ████████████████████░░░░░░░  12 (50%)     │   │
│  │  Quarterly   ██████████░░░░░░░░░░░░░░░░░   5 (21%)     │   │
│  │  Monthly     ████████░░░░░░░░░░░░░░░░░░░   4 (17%)     │   │
│  │  Yearly      ████░░░░░░░░░░░░░░░░░░░░░░░   2 (8%)      │   │
│  │  Relative    ██░░░░░░░░░░░░░░░░░░░░░░░░░   1 (4%)      │   │
│  │  Vague       ░░░░░░░░░░░░░░░░░░░░░░░░░░░   0 (0%)      │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ Timeline: 18 months (Jan 2025 - Jun 2026)       │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
/* Date specificity chart */
.date-specificity-chart {
  margin-top: var(--spacing-5);
}

.chart-title {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-4) 0;
}

.chart-bars {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.bar-container {
  display: grid;
  grid-template-columns: 80px 1fr 100px;
  align-items: center;
  gap: var(--spacing-3);
}

.bar-label {
  font-size: var(--text-sm);
  color: var(--glass-text-secondary);
  text-align: right;
  font-weight: var(--weight-medium);
}

.bar-track {
  height: 12px;
  background: var(--glass-white-8);
  border: 1px solid var(--glass-white-10);
  border-radius: var(--radius-glass-full);
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.bar-fill {
  height: 100%;
  border-radius: var(--radius-glass-full);
  position: relative;
  transition: width 0.8s var(--ease-out-expo);

  /* Animated shine effect */
  overflow: hidden;
}

.bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: barShine 2s ease-in-out infinite;
}

@keyframes barShine {
  0% { left: -100%; }
  100% { left: 100%; }
}

.bar-value {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
  font-weight: var(--weight-medium);
}

/* Timeline span info */
.timeline-span-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  flex-wrap: wrap;
  margin-top: var(--spacing-5);
  padding: var(--spacing-4);
  background: var(--glass-white-6);
  border: 1px solid var(--glass-white-10);
  border-radius: var(--radius-glass-md);
}

.timeline-label {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
}

.timeline-value {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
}

.timeline-range {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
}
```

---

### 4.11 Suggested Sources

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  SUGGESTED SOURCES GRID                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │                          │  │                          │    │
│  │  📊 Financial Reports    │  │  📅 Project Schedule     │    │
│  │               [HIGH]     │  │               [MEDIUM]   │    │
│  │                          │  │                          │    │
│  │  Need quarterly revenue  │  │  Missing detailed task   │    │
│  │  projections to support  │  │  dependencies and        │    │
│  │  milestone planning...   │  │  resource assignments... │    │
│  │                          │  │                          │    │
│  │  ─────────────────────── │  │  ─────────────────────── │    │
│  │  Expected: +15% accuracy │  │  Expected: +20% accuracy │    │
│  │                          │  │                          │    │
│  └──────────────────────────┘  └──────────────────────────┘    │
│                                                                 │
│  Grid: auto-fill, minmax(300px, 1fr)                           │
│  Hover: translateY(-3px) + translateX(2px) + shadow increase   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.sources-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-4);
}

.source-item {
  /* Glass card */
  padding: var(--spacing-5);
  background: var(--glass-white-6);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: var(--border-glass);
  border-radius: var(--radius-glass-lg);

  /* Shadow */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    var(--shadow-glass-1);

  /* Interaction */
  transition: all 0.25s var(--ease-out-quad);
}

.source-item:hover {
  background: var(--glass-white-10);
  border-color: var(--glass-white-25);
  transform: translateY(-3px) translateX(2px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    var(--shadow-glass-2);
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-3);
}

.source-type {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
}

.source-type::before {
  content: '📄';
  font-size: var(--text-lg);
}

/* Priority badges */
.priority-badge {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-glass-full);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.priority-badge.priority-high {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.30);
}

.priority-badge.priority-medium {
  background: rgba(234, 179, 8, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(234, 179, 8, 0.30);
}

.priority-badge.priority-low {
  background: var(--glass-white-10);
  color: var(--glass-text-muted);
  border: 1px solid var(--glass-white-15);
}

.source-reason {
  font-size: var(--text-sm);
  color: var(--glass-text-secondary);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--spacing-4);
}

.source-improvement {
  font-size: var(--text-sm);
  color: var(--glass-text-muted);
  padding-top: var(--spacing-3);
  border-top: var(--border-glass);
}

.source-improvement strong {
  color: var(--glass-text-secondary);
  font-weight: var(--weight-medium);
}
```

---

### 4.12 Empty State

#### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  EMPTY STATE                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌───────────────────┐                        │
│                    │                   │                        │
│                    │       📊          │                        │
│                    │                   │                        │
│                    └───────────────────┘                        │
│                                                                 │
│                   No Analysis Available                         │
│                                                                 │
│         Research quality analysis has not been                  │
│         generated yet. This analysis evaluates                  │
│         how well your research supports Gantt                   │
│         chart creation.                                         │
│                                                                 │
│  Border: dashed glass border                                    │
│  Animation: glassFadeSlideUp on mount                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.analysis-empty-state {
  /* Layout */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  padding: var(--spacing-10);

  /* Glass panel effect */
  background: var(--glass-white-8);
  backdrop-filter: blur(var(--blur-xl));
  -webkit-backdrop-filter: blur(var(--blur-xl));

  /* Dashed border */
  border: var(--border-glass-dashed);
  border-radius: var(--radius-glass-xl);

  /* Shadow */
  box-shadow: var(--shadow-glass-2);

  /* Animation */
  animation: glassFadeSlideUp 0.6s var(--ease-out-expo) forwards;
  opacity: 0;
}

.empty-state-icon {
  /* Glass icon container */
  width: 80px;
  height: 80px;
  background: var(--glass-white-10);
  border: var(--border-glass);
  border-radius: var(--radius-glass-lg);

  /* Center icon */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;

  /* Spacing */
  margin-bottom: var(--spacing-6);

  /* Subtle animation */
  animation: emptyIconPulse 3s ease-in-out infinite;
}

@keyframes emptyIconPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: var(--shadow-glass-1);
  }
  50% {
    transform: scale(1.05);
    box-shadow: var(--shadow-glass-2);
  }
}

.analysis-empty-state h2 {
  font-size: var(--text-2xl);
  font-weight: var(--weight-semibold);
  color: var(--glass-text-primary);
  margin: 0 0 var(--spacing-3) 0;
}

.analysis-empty-state p {
  font-size: var(--text-base);
  color: var(--glass-text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0 0 var(--spacing-2) 0;
  max-width: 400px;
}
```

---

## 5. Animation Specifications

### 5.1 Entrance Animations

```css
/* Primary entrance animation */
@keyframes glassFadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Timing: 0.6s with ease-out-expo */
/* ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1) */

/* Stagger delays for sections */
.analysis-header                           { animation-delay: 0.10s; }
.analysis-main-content > *:nth-child(1)    { animation-delay: 0.15s; }
.analysis-main-content > *:nth-child(2)    { animation-delay: 0.20s; }
.analysis-main-content > *:nth-child(3)    { animation-delay: 0.25s; }
.analysis-main-content > *:nth-child(4)    { animation-delay: 0.30s; }
.analysis-main-content > *:nth-child(5)    { animation-delay: 0.35s; }
.analysis-main-content > *:nth-child(6)    { animation-delay: 0.40s; }
.analysis-main-content > *:nth-child(7)    { animation-delay: 0.45s; }
```

### 5.2 Interaction Animations

| Interaction | Property | Duration | Easing |
|-------------|----------|----------|--------|
| Card hover | transform, box-shadow, background | 0.25s | ease-out-quad |
| Badge shine | background-position | 3s | ease-in-out |
| Bar fill | width | 0.8s | ease-out-expo |
| Theme expand | max-height, opacity | 0.4s | ease-out-expo |
| Expand icon rotate | transform | 0.3s | ease-out-expo |

### 5.3 Continuous Animations

```css
/* Score badge shine */
@keyframes scoreShine {
  0%, 100% { left: -100%; }
  50% { left: 100%; }
}
/* Duration: 3s, infinite */

/* Bar fill shine */
@keyframes barShine {
  0% { left: -100%; }
  100% { left: 100%; }
}
/* Duration: 2s, infinite */

/* Timestamp pulse */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
/* Duration: 2s, infinite */

/* Empty state icon pulse */
@keyframes emptyIconPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
/* Duration: 3s, infinite */
```

---

## 6. Responsive Behavior

### 6.1 Breakpoints

| Breakpoint | Name | Container Padding |
|------------|------|-------------------|
| < 480px | Mobile S | 16px |
| 480-639px | Mobile L | 20px |
| 640-767px | Tablet S | 24px |
| 768-1023px | Tablet L | 32px |
| 1024-1279px | Desktop | 40px |
| >= 1280px | Desktop L | 48px |

### 6.2 Component Adaptations

```css
/* Mobile (< 640px) */
@media (max-width: 639px) {
  .research-analysis-view {
    padding: var(--spacing-4);
  }

  .analysis-header {
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .analysis-score-section {
    align-self: flex-start;
    flex-direction: row;
    align-items: center;
  }

  .readiness-stats-grid {
    grid-template-columns: 1fr;
  }

  .completeness-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .bar-container {
    grid-template-columns: 60px 1fr 70px;
  }

  .action-item {
    grid-template-columns: auto 1fr;
    gap: var(--spacing-3);
  }

  .action-badges {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: flex-start;
    margin-top: var(--spacing-2);
  }

  .sources-list {
    grid-template-columns: 1fr;
  }
}

/* Tablet (640-1023px) */
@media (min-width: 640px) and (max-width: 1023px) {
  .completeness-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop (>= 1024px) */
@media (min-width: 1024px) {
  .completeness-metrics-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

---

## 7. Accessibility Requirements

### 7.1 Focus States

```css
/* All interactive elements */
.theme-card-header:focus-visible,
.action-item:focus-visible,
.source-item:focus-visible,
.stat-card:focus-visible,
.metric-card:focus-visible {
  outline: 3px solid var(--color-glass-success);
  outline-offset: 2px;
  box-shadow: 0 0 0 6px rgba(80, 175, 123, 0.15);
}
```

### 7.2 ARIA Requirements

| Component | ARIA Attributes |
|-----------|-----------------|
| Theme card header | `aria-expanded`, `aria-controls` |
| Theme card content | `id` (matching controls) |
| Score badge | `aria-label="Score X out of 10"` |
| Action items list | `role="list"` |
| Action item | `role="listitem"` |

### 7.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .research-analysis-view,
  .analysis-header,
  .analysis-main-content > *,
  .analysis-empty-state {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .analysis-section,
  .stat-card,
  .metric-card,
  .theme-card,
  .action-item,
  .source-item,
  .theme-card-content,
  .bar-fill,
  .expand-icon {
    transition: none;
  }

  .score-badge::before,
  .bar-fill::after,
  .empty-state-icon {
    animation: none;
  }
}
```

### 7.4 High Contrast Mode

```css
@media (prefers-contrast: high) {
  .analysis-section,
  .theme-card,
  .action-item,
  .source-item,
  .stat-card,
  .metric-card {
    border-width: 2px;
    border-color: rgba(255, 255, 255, 0.5);
  }

  .score-badge,
  .impact-badge,
  .effort-badge,
  .priority-badge,
  .inclusion-badge,
  .quality-badge {
    border-width: 2px;
  }
}
```

---

## 8. Implementation Checklist

### Phase 1: Foundation (CSS Updates)

- [ ] Add staggered entrance animations to `.research-analysis-view`
- [ ] Implement 3-tier elevation hierarchy for sections
- [ ] Update header card with gradient overlay and enhanced styling
- [ ] Enhance score badges with glow effects per tier

### Phase 2: Section Cards

- [ ] Update summary section (Level 3)
- [ ] Update Gantt readiness section with accent bar
- [ ] Update stats grid to match upload screen
- [ ] Style critical gaps alert with left accent

### Phase 3: Theme Cards

- [ ] Implement enhanced collapsible behavior
- [ ] Add expand/collapse animation
- [ ] Style theme stats row
- [ ] Update list sections (strengths, gaps, recommendations)
- [ ] Enhance sample events table

### Phase 4: Action Items (Step Cards)

- [ ] Implement numbered step cards with CSS counters
- [ ] Add impact-based coloring for step numbers
- [ ] Style impact and effort badges
- [ ] Add hover lift effects

### Phase 5: Data & Sources

- [ ] Enhance bar chart with shine animation
- [ ] Style timeline span info
- [ ] Update suggested sources grid
- [ ] Add hover effects to source cards

### Phase 6: Polish & Accessibility

- [ ] Implement empty state styling
- [ ] Add all focus-visible states
- [ ] Test reduced motion preferences
- [ ] Test high contrast mode
- [ ] Verify ARIA attributes
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

### Phase 7: JavaScript Updates

- [ ] Add section icons to `_renderSummarySection()`
- [ ] Add impact class to action items in `_renderActionItems()`
- [ ] Update theme card data-expanded attribute handling
- [ ] Ensure all animations respect user preferences

---

## Appendix A: File Changes Summary

### Files to Modify

| File | Changes |
|------|---------|
| `Public/styles/analysis-view.css` | Full CSS rewrite per specifications |
| `Public/components/views/ResearchAnalysisView.js` | Add classes, ARIA attributes, icons |

### New CSS Variables (if needed)

None required - all variables exist in `design-system.css`

### Estimated Implementation Time

| Phase | Estimated Hours |
|-------|-----------------|
| Phase 1 | 2-3 |
| Phase 2 | 2-3 |
| Phase 3 | 3-4 |
| Phase 4 | 2-3 |
| Phase 5 | 2-3 |
| Phase 6 | 2-3 |
| Phase 7 | 1-2 |
| **Total** | **14-21 hours** |

---

*End of Design Specification*
