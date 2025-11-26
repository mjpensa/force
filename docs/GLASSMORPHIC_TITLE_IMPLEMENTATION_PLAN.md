# Glassmorphic Title Implementation Plan

> Phase-by-phase implementation guide for applying glassmorphic styling to "AI Roadmap Generator" title sections across the application.

---

## Overview

**Objective:** Enhance all "AI Roadmap Generator" title sections with glassmorphic styling to complement the updated glassmorphic backgrounds.

**Reference:** `docs/GLASSMORPHIC_TITLE_SPEC.md`

**Affected Files:**
- `Public/styles/design-system.css` - Core styles
- `Public/styles/app-shell.css` - Header styles
- `Public/viewer.js` - Viewer header markup
- `Public/index.html` - Hero title section

**Estimated Phases:** 6
**Dependencies:** Existing glassmorphic design system tokens in `design-system.css`

---

## Phase 1: Core Title Styles

### Objective
Add foundational glassmorphic title classes to the design system.

### Tasks

#### 1.1 Add Base Title Class (`.title-glass`)
**File:** `Public/styles/design-system.css`
**Location:** After line ~1257 (after `.glass-live-region`)

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
```

#### 1.2 Add Gradient Title Class (`.title-glass-gradient`)
**File:** `Public/styles/design-system.css`

```css
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
```

#### 1.3 Add Glow Title Class (`.title-glass-glow`)
**File:** `Public/styles/design-system.css`

```css
/* Glow Glass Title */
.title-glass-glow {
    color: var(--glass-text-primary);
    text-shadow:
        0 0 20px rgba(255, 255, 255, 0.15),
        0 0 40px rgba(255, 255, 255, 0.05),
        0 2px 4px rgba(12, 35, 64, 0.20);
}
```

#### 1.4 Add Subtitle Class (`.subtitle-glass`)
**File:** `Public/styles/design-system.css`

```css
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
```

#### 1.5 Add Tagline Class (`.tagline-glass`)
**File:** `Public/styles/design-system.css`

```css
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
```

### Acceptance Criteria
- [ ] All 5 title classes added to `design-system.css`
- [ ] Classes use existing design tokens (no hardcoded values except shadows)
- [ ] CSS validates without errors
- [ ] Text shadows render correctly in Chrome, Firefox, Safari

### Testing
1. Create a test HTML file with sample titles using each class
2. Verify text shadow depth effect is visible
3. Verify gradient text renders correctly (Safari may need testing)
4. Check that text remains readable on glassmorphic background

---

## Phase 2: Container Styles

### Objective
Add glassmorphic container variants for title sections.

### Tasks

#### 2.1 Add Subtle Container Class (`.title-glass-container`)
**File:** `Public/styles/design-system.css`

```css
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
```

#### 2.2 Add Badge Container Class (`.title-glass-badge`)
**File:** `Public/styles/design-system.css`

```css
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
```

### Acceptance Criteria
- [ ] Both container classes added to `design-system.css`
- [ ] `backdrop-filter` has `-webkit-` prefix for Safari
- [ ] Container is subtle enough not to compete with form panel
- [ ] Badge hover effect animates smoothly

### Testing
1. Wrap test titles in containers
2. Verify blur effect is visible against gradient background
3. Test badge hover animation
4. Check Safari webkit prefix support

---

## Phase 3: Header Title Enhancement

### Objective
Apply glassmorphic styling to the viewer header title.

### Tasks

#### 3.1 Add Header Title Styles
**File:** `Public/styles/app-shell.css`
**Location:** After `.app-title` class (around line 135)

```css
/* Header Title - Glass Text Treatment */
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
```

#### 3.2 Update Viewer Header Markup
**File:** `Public/viewer.js`
**Location:** Lines 138-144 (inside `_buildUI()` method)

**Current:**
```javascript
header.innerHTML = `
    <div class="header-content">
        <h1 class="header-title">
            <a href="/" style="color: inherit; text-decoration: none;">
                AI Roadmap Generator
            </a>
        </h1>
```

**Updated:**
```javascript
header.innerHTML = `
    <div class="header-content">
        <h1 class="header-title">
            <a href="/">AI Roadmap Generator</a>
        </h1>
```

**Changes:**
- Remove inline styles (now handled by CSS)
- CSS class `.header-title a` handles color and text-decoration

### Acceptance Criteria
- [ ] `.header-title` class added to `app-shell.css`
- [ ] Inline styles removed from `viewer.js`
- [ ] Hover glow effect visible on title link
- [ ] Focus state visible for keyboard navigation
- [ ] Title link still navigates to home page

### Testing
1. Load viewer page at `/viewer.html?sessionId=test`
2. Verify title has subtle text shadow
3. Hover over title - verify glow appears
4. Tab to title link - verify focus ring appears
5. Click title - verify navigation to home

---

## Phase 4: Index Page Hero Title

### Objective
Apply glassmorphic styling to the main landing page title section.

### Tasks

#### 4.1 Update Hero Title Markup
**File:** `Public/index.html`
**Location:** Lines 193-200

**Current:**
```html
<div class="text-center mb-6 text-white" id="title-block">
    <h1 class="text-3xl md:text-4xl font-bold mb-3">
        AI Roadmap Generator
    </h1>
    <p class="text-lg md:text-xl opacity-90 max-w-3xl mx-auto font-light leading-relaxed">
        Transform your research documents into interactive Gantt charts with AI-powered analysis
    </p>
</div>
```

**Updated:**
```html
<div class="text-center mb-6" id="title-block">
    <h1 class="text-3xl md:text-4xl font-bold mb-3 title-glass title-glass-animate">
        AI Roadmap Generator
    </h1>
    <p class="text-lg md:text-xl max-w-3xl mx-auto subtitle-glass">
        Transform your research documents into interactive Gantt charts with AI-powered analysis
    </p>
</div>
```

**Changes:**
- Remove `text-white` (handled by `.title-glass`)
- Add `title-glass` class to h1
- Add `title-glass-animate` class for entrance animation
- Remove `opacity-90 font-light leading-relaxed` from p (handled by `.subtitle-glass`)
- Add `subtitle-glass` class to p

### Acceptance Criteria
- [ ] Title has glassmorphic text shadow effect
- [ ] Title animates in on page load
- [ ] Subtitle has muted glass styling
- [ ] Both elements remain readable on gradient background
- [ ] Styling matches form panel aesthetic

### Testing
1. Load index page
2. Verify title fade-in animation plays
3. Verify text shadow creates depth effect
4. Verify subtitle is slightly muted
5. Test on mobile viewport

---

## Phase 5: Animation & Micro-interactions

### Objective
Add entrance animations and interaction effects.

### Tasks

#### 5.1 Add Title Animation Keyframes
**File:** `Public/styles/design-system.css`
**Location:** After title container classes

```css
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
```

#### 5.2 Add Reduced Motion Support
**File:** `Public/styles/design-system.css`
**Location:** After animation keyframes

```css
/* Reduced Motion Support for Titles */
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
```

#### 5.3 Add High Contrast Mode Support
**File:** `Public/styles/design-system.css`

```css
/* High Contrast Mode for Titles */
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

/* Forced Colors Mode for Titles */
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

### Acceptance Criteria
- [ ] Title fades in with upward movement
- [ ] Subtitle animates with 100ms delay
- [ ] Animation disabled when `prefers-reduced-motion` is set
- [ ] Text shadows removed in high contrast mode
- [ ] Forced colors mode displays correctly

### Testing
1. Load page - verify animation plays
2. Enable reduced motion in OS settings - verify no animation
3. Enable high contrast mode - verify text shadows removed
4. Test in Windows High Contrast mode if available

---

## Phase 6: Responsive Behavior

### Objective
Ensure title styling adapts appropriately across viewport sizes.

### Tasks

#### 6.1 Add Mobile Responsive Styles
**File:** `Public/styles/design-system.css`
**Location:** After accessibility media queries

```css
/* Responsive Title Styles - Mobile */
@media (max-width: 639px) {
    .title-glass {
        font-size: var(--text-2xl);
        text-shadow: 0 1px 2px rgba(12, 35, 64, 0.20);
    }

    .title-glass-container {
        padding: var(--spacing-4) var(--spacing-5);
        border-radius: var(--radius-glass-md);
        backdrop-filter: blur(var(--blur-xs));
        -webkit-backdrop-filter: blur(var(--blur-xs));
    }

    .subtitle-glass {
        font-size: var(--text-base);
    }

    .header-title {
        font-size: var(--text-lg);
    }
}
```

#### 6.2 Add Tablet Responsive Styles
**File:** `Public/styles/design-system.css`

```css
/* Responsive Title Styles - Tablet */
@media (min-width: 640px) and (max-width: 1023px) {
    .title-glass {
        font-size: var(--text-3xl);
    }

    .title-glass-container {
        padding: var(--spacing-5) var(--spacing-6);
    }
}
```

#### 6.3 Add Desktop Responsive Styles
**File:** `Public/styles/design-system.css`

```css
/* Responsive Title Styles - Desktop */
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

/* Responsive Title Styles - Large Desktop */
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

### Acceptance Criteria
- [ ] Title scales down appropriately on mobile
- [ ] Text shadow intensity reduced on smaller screens
- [ ] Container padding adjusts for viewport
- [ ] Header title remains readable at all sizes
- [ ] No horizontal scrolling introduced

### Testing
1. Test at 320px width (small mobile)
2. Test at 768px width (tablet)
3. Test at 1024px width (desktop)
4. Test at 1920px width (large desktop)
5. Verify smooth transitions between breakpoints

---

## Implementation Order

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
  │           │           │           │           │           │
  │           │           │           │           │           │
  ▼           ▼           ▼           ▼           ▼           ▼
Core CSS   Containers  Header     Index Page  Animations  Responsive
Styles                 Update     Update
```

### Dependencies
- Phase 2 depends on Phase 1 (uses base title classes)
- Phase 3 depends on Phase 1 (header uses title class patterns)
- Phase 4 depends on Phase 1 (index uses title classes)
- Phase 5 depends on Phases 1-4 (animations apply to all)
- Phase 6 depends on Phases 1-5 (responsive adjusts all)

---

## File Changes Summary

| File | Phase | Changes |
|------|-------|---------|
| `design-system.css` | 1, 2, 5, 6 | Add ~150 lines of new CSS |
| `app-shell.css` | 3 | Add ~35 lines for header title |
| `viewer.js` | 3 | Remove inline styles (~1 line change) |
| `index.html` | 4 | Update 2 class attributes |

---

## Rollback Plan

If issues are discovered after implementation:

1. **Phase 6 Rollback:** Remove responsive media queries
2. **Phase 5 Rollback:** Remove animation keyframes and accessibility queries
3. **Phase 4 Rollback:** Restore original `index.html` title block
4. **Phase 3 Rollback:** Restore inline styles in `viewer.js`, remove header CSS
5. **Phase 2 Rollback:** Remove container classes
6. **Phase 1 Rollback:** Remove base title classes

Each phase can be rolled back independently without affecting prior phases.

---

## Post-Implementation Verification

### Visual Checklist
- [ ] Title text has visible depth/shadow effect
- [ ] Title matches overall glassmorphic aesthetic
- [ ] Text remains highly readable
- [ ] Hover effects are subtle but noticeable
- [ ] Animations are smooth (60fps)

### Cross-Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] iOS Safari
- [ ] Chrome Android

### Accessibility Testing
- [ ] Screen reader announces titles correctly
- [ ] Keyboard navigation works
- [ ] Focus states are visible
- [ ] Reduced motion respected
- [ ] High contrast mode works

### Performance Testing
- [ ] No layout shift (CLS) from animations
- [ ] Animation runs at 60fps
- [ ] No jank on mobile devices
- [ ] Backdrop-filter doesn't cause lag

---

*Document Version: 1.0*
*Created: November 2024*
*Reference: GLASSMORPHIC_TITLE_SPEC.md*
