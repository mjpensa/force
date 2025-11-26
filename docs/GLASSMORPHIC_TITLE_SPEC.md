# Glassmorphic Title Section - Design Specification

> Design specification for enhancing "AI Roadmap Generator" title sections with glassmorphic styling to complement the updated glassmorphic backgrounds.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Philosophy](#2-design-philosophy)
3. [Affected Screens](#3-affected-screens)
4. [Title Text Treatment](#4-title-text-treatment)
5. [Title Container Variants](#5-title-container-variants)
6. [Header Title Enhancement](#6-header-title-enhancement)
7. [Subtitle & Tagline Styling](#7-subtitle--tagline-styling)
8. [Animation & Micro-interactions](#8-animation--micro-interactions)
9. [Responsive Behavior](#9-responsive-behavior)
10. [Accessibility Requirements](#10-accessibility-requirements)
11. [CSS Implementation](#11-css-implementation)
12. [Implementation Checklist](#12-implementation-checklist)

---

## 1. Overview

### Purpose

This specification defines glassmorphic styling enhancements for title sections containing "AI Roadmap Generator" across the application. The goal is to create visual cohesion with the newly updated glassmorphic backgrounds while maintaining readability and brand consistency.

### Scope

| Screen | Component | Enhancement Type |
|--------|-----------|------------------|
| Content Viewer | Header Title | Text treatment + hover effects |
| Content Viewer | Navigation area | Badge/pill styling |
| Index Page | Hero Title | Glass container + text effects |

### Design Tokens Reference

All implementations reference existing design tokens from `design-system.css`:

```css
/* Primary Glass Colors */
--glass-white-5: rgba(255, 255, 255, 0.05);
--glass-white-8: rgba(255, 255, 255, 0.08);
--glass-white-10: rgba(255, 255, 255, 0.10);
--glass-white-15: rgba(255, 255, 255, 0.15);

/* Glass Text Colors */
--glass-text-primary: #FFFFFF;
--glass-text-secondary: rgba(255, 255, 255, 0.80);

/* Navy Shadows */
--glass-navy-15: rgba(12, 35, 64, 0.15);
--glass-navy-25: rgba(12, 35, 64, 0.25);

/* Blur Values */
--blur-xs: 4px;
--blur-sm: 8px;
--blur-md: 12px;
```

---

## 2. Design Philosophy

### Core Principles

The glassmorphic title treatment follows these guiding principles:

| Principle | Description |
|-----------|-------------|
| **Subtle Depth** | Text shadows create perceived elevation without overwhelming |
| **Luminosity** | Slight glow effects suggest light passing through glass |
| **Consistency** | Title styling echoes the glass panels below |
| **Readability First** | All effects enhance, never diminish, legibility |
| **Brand Alignment** | White text on navy maintains brand identity |

### Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  BACKGROUND: Glassmorphic gradient with organic blobs       │
│                                                             │
│         ┌─────────────────────────────────────┐             │
│         │  TITLE: Glass text treatment        │  Layer 1    │
│         │  "AI Roadmap Generator"             │             │
│         └─────────────────────────────────────┘             │
│                                                             │
│         ┌─────────────────────────────────────┐             │
│         │  SUBTITLE: Muted glass text         │  Layer 1    │
│         │  Supporting description             │             │
│         └─────────────────────────────────────┘             │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  FORM PANEL: Full glassmorphic container              │  │
│  │  (Stronger blur, border, shadow)                      │  │  Layer 2
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Affected Screens

### 3.1 Content Viewer Header

**File:** `Public/viewer.js` (lines 136-144)
**File:** `Public/styles/app-shell.css`

**Current State:**
```html
<h1 class="header-title">
    <a href="/" style="color: inherit; text-decoration: none;">
        AI Roadmap Generator
    </a>
</h1>
```

**Enhancement Required:**
- Add `.header-title` class with glass text treatment
- Add hover glow effect for the link
- Improve visual prominence within glass header bar

---

### 3.2 Index Page Hero Title

**File:** `Public/index.html` (lines 193-200)

**Current State:**
```html
<div class="text-center mb-6 text-white" id="title-block">
    <h1 class="text-3xl md:text-4xl font-bold mb-3">
        AI Roadmap Generator
    </h1>
    <p class="text-lg md:text-xl opacity-90 max-w-3xl mx-auto font-light leading-relaxed">
        Transform your research documents into interactive Gantt charts...
    </p>
</div>
```

**Enhancement Required:**
- Apply glassmorphic text shadow to h1
- Optional: Wrap in subtle glass container
- Enhance subtitle with muted glass text styling

---

## 4. Title Text Treatment

### 4.1 Primary Title Style (`.title-glass`)

The foundational glass text treatment for all "AI Roadmap Generator" titles.

#### Visual Specification

| Property | Value | Purpose |
|----------|-------|---------|
| Color | `#FFFFFF` | Maximum contrast on dark backgrounds |
| Text Shadow (Layer 1) | `0 2px 4px rgba(12, 35, 64, 0.25)` | Creates depth/elevation |
| Text Shadow (Layer 2) | `0 1px 0 rgba(255, 255, 255, 0.08)` | Subtle highlight edge |
| Letter Spacing | `-0.01em` | Tighter spacing for display text |
| Font Weight | `600-700` | Bold presence |

#### CSS Implementation

```css
.title-glass {
    color: var(--glass-text-primary);
    text-shadow:
        0 2px 4px rgba(12, 35, 64, 0.25),
        0 1px 0 rgba(255, 255, 255, 0.08);
    letter-spacing: -0.01em;
    font-weight: var(--weight-semibold);
}
```

#### Visual Example

```
┌────────────────────────────────────────────┐
│                                            │
│      AI Roadmap Generator                  │
│      ↓ subtle shadow beneath text          │
│      ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔               │
│                                            │
└────────────────────────────────────────────┘
```

---

### 4.2 Gradient Title Style (`.title-glass-gradient`)

Optional premium treatment with gradient text effect.

#### Visual Specification

| Property | Value | Purpose |
|----------|-------|---------|
| Background | Linear gradient (white to 85% white) | Subtle shimmer effect |
| Background Clip | `text` | Apply gradient to text only |
| Filter | `drop-shadow()` | Maintain shadow with gradient |

#### CSS Implementation

```css
.title-glass-gradient {
    background: linear-gradient(
        135deg,
        #FFFFFF 0%,
        rgba(255, 255, 255, 0.85) 50%,
        #FFFFFF 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 2px 4px rgba(12, 35, 64, 0.20));
}
```

#### When to Use

- Hero sections with large display text
- Special emphasis moments
- NOT recommended for header bars (too prominent)

---

### 4.3 Glow Title Style (`.title-glass-glow`)

Adds a subtle luminous glow around the text.

#### Visual Specification

| Property | Value | Purpose |
|----------|-------|---------|
| Text Shadow (Glow) | `0 0 20px rgba(255, 255, 255, 0.15)` | Soft ambient glow |
| Text Shadow (Depth) | `0 2px 4px rgba(12, 35, 64, 0.20)` | Maintains depth |

#### CSS Implementation

```css
.title-glass-glow {
    color: var(--glass-text-primary);
    text-shadow:
        0 0 20px rgba(255, 255, 255, 0.15),
        0 0 40px rgba(255, 255, 255, 0.05),
        0 2px 4px rgba(12, 35, 64, 0.20);
}
```

---

## 5. Title Container Variants

### 5.1 Subtle Glass Container (`.title-glass-container`)

A minimal glass panel to frame the title section.

#### Visual Specification

```
┌─────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════╗  │
│  ║                                               ║  │
│  ║      AI Roadmap Generator                     ║  │
│  ║      Transform your research documents...     ║  │
│  ║                                               ║  │
│  ╚═══════════════════════════════════════════════╝  │
│         ↑ subtle glass container                    │
└─────────────────────────────────────────────────────┘
```

#### CSS Implementation

```css
.title-glass-container {
    /* Glass Effect - Very Subtle */
    background: var(--glass-white-5);
    backdrop-filter: blur(var(--blur-xs));
    -webkit-backdrop-filter: blur(var(--blur-xs));

    /* Border - Barely Visible */
    border: 1px solid var(--glass-white-8);
    border-radius: var(--radius-glass-lg);

    /* Shadow - Minimal */
    box-shadow:
        0 4px 16px rgba(12, 35, 64, 0.10),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);

    /* Spacing */
    padding: var(--spacing-6) var(--spacing-8);

    /* Centering */
    text-align: center;
}
```

#### Properties Table

| Property | Value | Notes |
|----------|-------|-------|
| Background | `rgba(255,255,255,0.05)` | Very subtle, doesn't compete with form panel |
| Backdrop Blur | `4px` | Minimal blur for separation |
| Border | `1px solid rgba(255,255,255,0.08)` | Barely visible edge |
| Border Radius | `16px` | Matches design system |
| Padding | `24px 32px` | Comfortable breathing room |

---

### 5.2 Badge/Pill Container (`.title-glass-badge`)

A more pronounced container for compact title displays.

#### Visual Specification

```
         ┌──────────────────────────────────┐
         │   AI Roadmap Generator   ←badge  │
         └──────────────────────────────────┘
```

#### CSS Implementation

```css
.title-glass-badge {
    display: inline-block;

    /* Glass Effect - Medium */
    background: var(--glass-white-10);
    backdrop-filter: blur(var(--blur-sm));
    -webkit-backdrop-filter: blur(var(--blur-sm));

    /* Border */
    border: 1px solid var(--glass-white-15);
    border-radius: var(--radius-glass-xl);

    /* Shadow */
    box-shadow:
        0 4px 16px rgba(12, 35, 64, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.10);

    /* Spacing */
    padding: var(--spacing-3) var(--spacing-6);

    /* Transition */
    transition: all 0.2s ease;
}

.title-glass-badge:hover {
    background: var(--glass-white-15);
    box-shadow:
        0 6px 20px rgba(12, 35, 64, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
}
```

---

## 6. Header Title Enhancement

### 6.1 Header Title Styling (`.header-title`)

Specific styling for the title within the app header bar.

#### Current State Analysis

The `.app-header` already has glassmorphic styling:
- `background: var(--glass-white-8)`
- `backdrop-filter: blur(20px)`
- `border-bottom: var(--border-glass)`
- `box-shadow: var(--shadow-glass-1)`

The title text needs complementary styling.

#### CSS Implementation

```css
/* Header Title - Glass Text Treatment */
.header-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-semibold);
    color: var(--glass-text-primary);
    margin: 0;

    /* Glass text shadow for depth */
    text-shadow: 0 1px 2px rgba(12, 35, 64, 0.15);

    /* Slight letter spacing adjustment */
    letter-spacing: -0.01em;
}

/* Header Title Link */
.header-title a {
    color: inherit;
    text-decoration: none;
    transition:
        text-shadow 0.2s ease,
        opacity 0.2s ease;
}

.header-title a:hover {
    text-shadow:
        0 1px 2px rgba(12, 35, 64, 0.15),
        0 0 12px rgba(255, 255, 255, 0.12);
}

.header-title a:active {
    opacity: 0.9;
}
```

#### Hover State Visual

```
Default:    AI Roadmap Generator
                   │
                   ▼ (subtle shadow)

Hover:      AI Roadmap Generator
            ~~~~~~~~~~~~~~~~~~~~~~~~ (soft glow appears)
```

---

### 6.2 Header Content Layout

Update the header content structure for better title presentation.

#### HTML Structure

```html
<header class="app-header">
    <div class="header-content">
        <h1 class="header-title">
            <a href="/">AI Roadmap Generator</a>
        </h1>
        <nav class="view-tabs" role="navigation" aria-label="Main navigation">
            <!-- tabs... -->
        </nav>
    </div>
</header>
```

#### CSS for Header Content

```css
.header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: var(--container-xl);
    margin: 0 auto;
    padding: 0 var(--spacing-4);
    gap: var(--spacing-4);
}
```

---

## 7. Subtitle & Tagline Styling

### 7.1 Glass Subtitle (`.subtitle-glass`)

For supporting text beneath main titles.

#### Visual Specification

| Property | Value | Purpose |
|----------|-------|---------|
| Color | `rgba(255, 255, 255, 0.85)` | Slightly muted |
| Text Shadow | `0 1px 2px rgba(12, 35, 64, 0.15)` | Subtle depth |
| Font Weight | `300-400` | Lighter than title |
| Line Height | `1.6` | Comfortable reading |

#### CSS Implementation

```css
.subtitle-glass {
    color: var(--glass-text-secondary);
    text-shadow: 0 1px 2px rgba(12, 35, 64, 0.12);
    font-weight: var(--weight-light);
    line-height: var(--leading-relaxed);
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}
```

---

### 7.2 Glass Tagline (`.tagline-glass`)

For short descriptive text or version indicators.

#### CSS Implementation

```css
.tagline-glass {
    display: inline-block;
    color: var(--glass-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;

    /* Optional pill background */
    background: var(--glass-white-5);
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-glass-full);
    border: 1px solid var(--glass-white-8);
}
```

---

## 8. Animation & Micro-interactions

### 8.1 Title Entrance Animation

Subtle fade-in with upward movement.

```css
@keyframes titleGlassFadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
        filter: blur(4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
        filter: blur(0);
    }
}

.title-glass-animate {
    animation: titleGlassFadeIn 0.6s var(--ease-out-expo) forwards;
}

/* Staggered subtitle */
.title-glass-animate + .subtitle-glass {
    animation: titleGlassFadeIn 0.6s var(--ease-out-expo) 0.1s forwards;
    opacity: 0;
}
```

### 8.2 Hover Glow Effect

For interactive title links.

```css
@keyframes titleGlowPulse {
    0%, 100% {
        text-shadow:
            0 1px 2px rgba(12, 35, 64, 0.15),
            0 0 0 rgba(255, 255, 255, 0);
    }
    50% {
        text-shadow:
            0 1px 2px rgba(12, 35, 64, 0.15),
            0 0 20px rgba(255, 255, 255, 0.15);
    }
}

.title-glass-pulse:hover {
    animation: titleGlowPulse 2s ease-in-out infinite;
}
```

### 8.3 Focus State

For keyboard navigation accessibility.

```css
.header-title a:focus-visible {
    outline: none;
    text-shadow:
        0 1px 2px rgba(12, 35, 64, 0.15),
        0 0 0 3px rgba(80, 175, 123, 0.4);
    border-radius: var(--radius-glass-sm);
}
```

---

## 9. Responsive Behavior

### 9.1 Breakpoints

| Breakpoint | Width | Title Adjustments |
|------------|-------|-------------------|
| Mobile | < 640px | Smaller font, reduced shadow, no container |
| Tablet | 640px - 1024px | Medium font, standard styling |
| Desktop | > 1024px | Full styling with all effects |

### 9.2 Responsive CSS

```css
/* Mobile: < 640px */
@media (max-width: 639px) {
    .title-glass {
        font-size: var(--text-2xl);
        text-shadow: 0 1px 2px rgba(12, 35, 64, 0.20);
    }

    .title-glass-container {
        padding: var(--spacing-4) var(--spacing-5);
        border-radius: var(--radius-glass-md);
        backdrop-filter: blur(var(--blur-xs));
    }

    .subtitle-glass {
        font-size: var(--text-base);
    }

    .header-title {
        font-size: var(--text-lg);
    }
}

/* Tablet: 640px - 1024px */
@media (min-width: 640px) and (max-width: 1023px) {
    .title-glass {
        font-size: var(--text-3xl);
    }

    .title-glass-container {
        padding: var(--spacing-5) var(--spacing-6);
    }
}

/* Desktop: >= 1024px */
@media (min-width: 1024px) {
    .title-glass {
        font-size: var(--text-4xl);
    }

    .title-glass-glow {
        text-shadow:
            0 0 30px rgba(255, 255, 255, 0.12),
            0 0 60px rgba(255, 255, 255, 0.05),
            0 2px 4px rgba(12, 35, 64, 0.20);
    }
}

/* Large Desktop: >= 1920px */
@media (min-width: 1920px) {
    .title-glass {
        font-size: var(--text-5xl);
        letter-spacing: -0.02em;
    }

    .title-glass-container {
        padding: var(--spacing-8) var(--spacing-10);
    }
}
```

---

## 10. Accessibility Requirements

### 10.1 WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Color Contrast** | White (#FFFFFF) on navy meets 4.5:1+ ratio |
| **Text Shadows** | Enhance, never reduce, contrast |
| **Focus Indicators** | Visible focus states on interactive titles |
| **Motion** | Respect `prefers-reduced-motion` |

### 10.2 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
    .title-glass-animate,
    .title-glass-animate + .subtitle-glass {
        animation: none;
        opacity: 1;
        transform: none;
        filter: none;
    }

    .title-glass-pulse:hover {
        animation: none;
    }

    .header-title a,
    .title-glass-badge {
        transition: none;
    }
}
```

### 10.3 High Contrast Mode

```css
@media (prefers-contrast: high) {
    .title-glass,
    .header-title {
        text-shadow: none;
        font-weight: var(--weight-bold);
    }

    .title-glass-container,
    .title-glass-badge {
        border-width: 2px;
        border-color: var(--glass-text-primary);
        background: transparent;
    }
}
```

### 10.4 Forced Colors Mode

```css
@media (forced-colors: active) {
    .title-glass,
    .subtitle-glass,
    .header-title {
        color: CanvasText;
        text-shadow: none;
    }

    .title-glass-container,
    .title-glass-badge {
        border: 2px solid CanvasText;
        background: Canvas;
    }
}
```

---

## 11. CSS Implementation

### 11.1 Complete CSS Module

Add to `Public/styles/design-system.css`:

```css
/* ========== GLASSMORPHIC TITLE STYLES ========== */

/* Base Glass Title */
.title-glass {
    color: var(--glass-text-primary);
    text-shadow:
        0 2px 4px rgba(12, 35, 64, 0.25),
        0 1px 0 rgba(255, 255, 255, 0.08);
    letter-spacing: -0.01em;
    font-weight: var(--weight-semibold);
}

/* Gradient Glass Title */
.title-glass-gradient {
    background: linear-gradient(
        135deg,
        #FFFFFF 0%,
        rgba(255, 255, 255, 0.85) 50%,
        #FFFFFF 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 2px 4px rgba(12, 35, 64, 0.20));
}

/* Glow Glass Title */
.title-glass-glow {
    color: var(--glass-text-primary);
    text-shadow:
        0 0 20px rgba(255, 255, 255, 0.15),
        0 0 40px rgba(255, 255, 255, 0.05),
        0 2px 4px rgba(12, 35, 64, 0.20);
}

/* Glass Title Container */
.title-glass-container {
    background: var(--glass-white-5);
    backdrop-filter: blur(var(--blur-xs));
    -webkit-backdrop-filter: blur(var(--blur-xs));
    border: 1px solid var(--glass-white-8);
    border-radius: var(--radius-glass-lg);
    box-shadow:
        0 4px 16px rgba(12, 35, 64, 0.10),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    padding: var(--spacing-6) var(--spacing-8);
    text-align: center;
}

/* Glass Badge */
.title-glass-badge {
    display: inline-block;
    background: var(--glass-white-10);
    backdrop-filter: blur(var(--blur-sm));
    -webkit-backdrop-filter: blur(var(--blur-sm));
    border: 1px solid var(--glass-white-15);
    border-radius: var(--radius-glass-xl);
    box-shadow:
        0 4px 16px rgba(12, 35, 64, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.10);
    padding: var(--spacing-3) var(--spacing-6);
    transition: all 0.2s ease;
}

.title-glass-badge:hover {
    background: var(--glass-white-15);
    box-shadow:
        0 6px 20px rgba(12, 35, 64, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
}

/* Glass Subtitle */
.subtitle-glass {
    color: var(--glass-text-secondary);
    text-shadow: 0 1px 2px rgba(12, 35, 64, 0.12);
    font-weight: var(--weight-light);
    line-height: var(--leading-relaxed);
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}

/* Glass Tagline */
.tagline-glass {
    display: inline-block;
    color: var(--glass-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    background: var(--glass-white-5);
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-glass-full);
    border: 1px solid var(--glass-white-8);
}

/* Header Title (App Shell) */
.header-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-semibold);
    color: var(--glass-text-primary);
    margin: 0;
    text-shadow: 0 1px 2px rgba(12, 35, 64, 0.15);
    letter-spacing: -0.01em;
}

.header-title a {
    color: inherit;
    text-decoration: none;
    transition:
        text-shadow 0.2s ease,
        opacity 0.2s ease;
}

.header-title a:hover {
    text-shadow:
        0 1px 2px rgba(12, 35, 64, 0.15),
        0 0 12px rgba(255, 255, 255, 0.12);
}

.header-title a:active {
    opacity: 0.9;
}

.header-title a:focus-visible {
    outline: none;
    text-shadow:
        0 1px 2px rgba(12, 35, 64, 0.15),
        0 0 0 3px rgba(80, 175, 123, 0.4);
    border-radius: var(--radius-glass-sm);
}

/* Title Animation */
@keyframes titleGlassFadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
        filter: blur(4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
        filter: blur(0);
    }
}

.title-glass-animate {
    animation: titleGlassFadeIn 0.6s var(--ease-out-expo) forwards;
}

.title-glass-animate + .subtitle-glass {
    animation: titleGlassFadeIn 0.6s var(--ease-out-expo) 0.1s forwards;
    opacity: 0;
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
    .title-glass-animate,
    .title-glass-animate + .subtitle-glass {
        animation: none;
        opacity: 1;
        transform: none;
        filter: none;
    }

    .header-title a,
    .title-glass-badge {
        transition: none;
    }
}

/* High Contrast Mode */
@media (prefers-contrast: high) {
    .title-glass,
    .header-title {
        text-shadow: none;
        font-weight: var(--weight-bold);
    }

    .title-glass-container,
    .title-glass-badge {
        border-width: 2px;
        border-color: var(--glass-text-primary);
    }
}

/* Responsive - Mobile */
@media (max-width: 639px) {
    .title-glass {
        font-size: var(--text-2xl);
        text-shadow: 0 1px 2px rgba(12, 35, 64, 0.20);
    }

    .title-glass-container {
        padding: var(--spacing-4) var(--spacing-5);
        border-radius: var(--radius-glass-md);
    }

    .subtitle-glass {
        font-size: var(--text-base);
    }

    .header-title {
        font-size: var(--text-lg);
    }
}

/* Responsive - Desktop */
@media (min-width: 1024px) {
    .title-glass {
        font-size: var(--text-4xl);
    }
}
```

---

## 12. Implementation Checklist

### Phase 1: Core Styles
- [ ] Add `.title-glass` base class to `design-system.css`
- [ ] Add `.subtitle-glass` class
- [ ] Add `.header-title` class with glass treatment
- [ ] Test text shadow rendering across browsers

### Phase 2: Containers
- [ ] Add `.title-glass-container` class
- [ ] Add `.title-glass-badge` class
- [ ] Verify blur effects on Safari (webkit prefix)

### Phase 3: Apply to Screens
- [ ] Update `viewer.js` header title with `.header-title` class
- [ ] Update `index.html` hero title with `.title-glass` class
- [ ] Update `index.html` subtitle with `.subtitle-glass` class

### Phase 4: Animations
- [ ] Add entrance animation keyframes
- [ ] Add hover glow effects
- [ ] Test reduced motion behavior

### Phase 5: Accessibility
- [ ] Verify color contrast ratios
- [ ] Test focus states with keyboard
- [ ] Test high contrast mode
- [ ] Test forced colors mode

### Phase 6: Responsive
- [ ] Test mobile (< 640px)
- [ ] Test tablet (640px - 1024px)
- [ ] Test desktop (> 1024px)
- [ ] Test large screens (> 1920px)

---

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 76+ | Full | Native text-shadow, backdrop-filter |
| Firefox 103+ | Full | Native support |
| Safari 9+ | Full | Requires -webkit- prefix for backdrop-filter |
| Edge 79+ | Full | Chromium-based |
| iOS Safari 9+ | Full | Requires -webkit- prefix |

---

*Document Version: 1.0*
*Created: November 2024*
*Related: GLASSMORPHIC_DESIGN_SPEC.md*
