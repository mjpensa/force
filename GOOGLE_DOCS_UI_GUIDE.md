# Google Docs-like UI Implementation Guide

## Design Philosophy

Google Docs is known for:
- **Simplicity** - Minimal chrome, maximum content
- **Elegance** - Clean typography, generous whitespace
- **Intuitiveness** - Predictable interactions, clear hierarchy
- **Readability** - Optimized for long-form content consumption

---

## Visual Design Tokens

### Color Palette

```css
/* design-system.css */
:root {
  /* Primary Colors (Google blue inspired) */
  --color-primary: #1a73e8;           /* Links, primary actions */
  --color-primary-hover: #1557b0;     /* Hover state */
  --color-primary-light: #e8f0fe;     /* Backgrounds, highlights */

  /* Surface & Background */
  --color-surface: #ffffff;           /* Cards, modals, content */
  --color-background: #f8f9fa;        /* Page background */
  --color-background-alt: #f1f3f4;    /* Alternate sections */

  /* Borders */
  --color-border: #dadce0;            /* Default borders */
  --color-border-light: #e8eaed;      /* Subtle dividers */
  --color-border-dark: #c4c7c9;       /* Emphasized borders */

  /* Text */
  --color-text-primary: #202124;      /* Headings, body text */
  --color-text-secondary: #5f6368;    /* Captions, metadata */
  --color-text-tertiary: #80868b;     /* Disabled, placeholders */

  /* Semantic Colors */
  --color-success: #34a853;           /* Success states */
  --color-warning: #fbbc04;           /* Warning states */
  --color-error: #ea4335;             /* Error states */
  --color-info: #4285f4;              /* Info states */

  /* Interactive States */
  --color-hover: #f1f3f4;             /* Hover background */
  --color-active: #e8eaed;            /* Active/pressed state */
  --color-focus: rgba(26, 115, 232, 0.12); /* Focus ring */
}
```

### Typography

```css
:root {
  /* Font Families */
  --font-primary: -apple-system, BlinkMacSystemFont, "Segoe UI",
                  Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono",
               Consolas, monospace;

  /* Font Sizes (rem-based for accessibility) */
  --text-xs: 0.75rem;      /* 12px - Small labels */
  --text-sm: 0.875rem;     /* 14px - Body small, captions */
  --text-base: 1rem;       /* 16px - Body text */
  --text-lg: 1.125rem;     /* 18px - Large body */
  --text-xl: 1.25rem;      /* 20px - H4 */
  --text-2xl: 1.5rem;      /* 24px - H3 */
  --text-3xl: 1.875rem;    /* 30px - H2 */
  --text-4xl: 2.25rem;     /* 36px - H1 */
  --text-5xl: 3rem;        /* 48px - Display */

  /* Font Weights */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* Line Heights */
  --leading-tight: 1.25;   /* Headings */
  --leading-normal: 1.5;   /* Body text */
  --leading-relaxed: 1.75; /* Long-form reading */

  /* Letter Spacing */
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
}
```

### Spacing System (8px grid)

```css
:root {
  --spacing-0: 0;
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-5: 1.25rem;   /* 20px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-8: 2rem;      /* 32px */
  --spacing-10: 2.5rem;   /* 40px */
  --spacing-12: 3rem;     /* 48px */
  --spacing-16: 4rem;     /* 64px */
  --spacing-20: 5rem;     /* 80px */
  --spacing-24: 6rem;     /* 96px */
}
```

### Shadows & Elevation

```css
:root {
  /* Elevation levels (Material Design inspired) */
  --shadow-none: none;
  --shadow-sm: 0 1px 2px 0 rgba(60, 64, 67, 0.1),
               0 1px 3px 1px rgba(60, 64, 67, 0.05);
  --shadow-md: 0 1px 3px 0 rgba(60, 64, 67, 0.1),
               0 4px 8px 3px rgba(60, 64, 67, 0.05);
  --shadow-lg: 0 4px 6px 0 rgba(60, 64, 67, 0.1),
               0 10px 20px 3px rgba(60, 64, 67, 0.1);
  --shadow-xl: 0 8px 12px 0 rgba(60, 64, 67, 0.15),
               0 16px 24px 6px rgba(60, 64, 67, 0.1);

  /* Focus shadow */
  --shadow-focus: 0 0 0 3px var(--color-focus);
}
```

### Border Radius

```css
:root {
  --radius-none: 0;
  --radius-sm: 4px;    /* Buttons, inputs */
  --radius-md: 8px;    /* Cards, modals */
  --radius-lg: 12px;   /* Large containers */
  --radius-full: 9999px; /* Pills, avatars */
}
```

### Transitions

```css
:root {
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-bounce: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Layout Constants

```css
:root {
  /* Container widths */
  --container-xs: 640px;
  --container-sm: 768px;
  --container-md: 1024px;
  --container-lg: 1280px;
  --container-xl: 1536px;

  /* Content reading width (optimal) */
  --content-width: 800px;

  /* Sidebar widths */
  --sidebar-width: 280px;
  --sidebar-collapsed: 64px;

  /* Header height */
  --header-height: 64px;

  /* Z-index layers */
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-fixed: 1200;
  --z-modal-backdrop: 1300;
  --z-modal: 1400;
  --z-popover: 1500;
  --z-tooltip: 1600;
}
```

---

## Component Styles

### 1. Application Shell

```html
<!-- chart.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Force - Research Platform</title>
  <link rel="stylesheet" href="design-system.css">
  <link rel="stylesheet" href="app-shell.css">
</head>
<body>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <button class="icon-button" id="menu-button" aria-label="Menu">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
        <h1 class="app-title">Force</h1>
      </div>

      <div class="header-center">
        <span class="document-title" contenteditable="true">
          Q1 2025 Product Launch
        </span>
      </div>

      <div class="header-right">
        <button class="icon-button" title="Export">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2z"/>
            <path d="M13 12.67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/>
          </svg>
        </button>
        <button class="icon-button" title="Share">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Main content area -->
    <main class="app-main">
      <div id="view-container"></div>
    </main>
  </div>
</body>
</html>
```

```css
/* app-shell.css */
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
}

/* Header */
.app-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-4);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  box-shadow: var(--shadow-sm);
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex: 0 0 auto;
}

.header-center {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  padding: 0 var(--spacing-4);
}

.app-title {
  font-size: var(--text-xl);
  font-weight: var(--weight-normal);
  color: var(--color-text-primary);
  margin: 0;
  margin-left: var(--spacing-4);
}

.document-title {
  font-size: var(--text-base);
  color: var(--color-text-primary);
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--radius-sm);
  outline: none;
  transition: background var(--transition-fast);
  max-width: 400px;
  text-align: center;
}

.document-title:hover {
  background: var(--color-hover);
}

.document-title:focus {
  background: var(--color-surface);
  box-shadow: var(--shadow-focus);
}

.icon-button {
  width: 40px;
  height: 40px;
  border: none;
  background: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast);
  color: var(--color-text-secondary);
}

.icon-button:hover {
  background: var(--color-hover);
}

.icon-button:active {
  background: var(--color-active);
}

.icon-button svg {
  fill: currentColor;
}

/* Main content */
.app-main {
  flex: 1;
  padding: var(--spacing-8) 0;
}
```

### 2. Navigation Menu (HamburgerMenu)

```css
/* hamburger-menu.css */
.hamburger-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.32);
  z-index: var(--z-modal-backdrop);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-base);
}

.hamburger-overlay.open {
  opacity: 1;
  pointer-events: auto;
}

.hamburger-menu {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--color-surface);
  box-shadow: var(--shadow-xl);
  z-index: var(--z-modal);
  transform: translateX(-100%);
  transition: transform var(--transition-base);
  display: flex;
  flex-direction: column;
}

.hamburger-menu.open {
  transform: translateX(0);
}

.menu-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.menu-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  color: var(--color-text-primary);
  margin: 0;
}

.menu-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-4) 0;
}

.menu-section {
  padding: 0 var(--spacing-4);
  margin-bottom: var(--spacing-6);
}

.menu-section-title {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  margin: 0 0 var(--spacing-2) 0;
  padding: 0 var(--spacing-4);
}

.menu-nav {
  list-style: none;
  margin: 0;
  padding: 0;
}

.menu-nav-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  text-decoration: none;
  transition: background var(--transition-fast);
  cursor: pointer;
  gap: var(--spacing-4);
  font-size: var(--text-base);
}

.menu-nav-item:hover {
  background: var(--color-hover);
}

.menu-nav-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: var(--weight-medium);
}

.nav-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xl);
}

.nav-text {
  flex: 1;
}
```

### 3. Document View (Long-form Content)

```html
<div class="document-view">
  <div class="document-container">
    <!-- Table of Contents (sticky sidebar) -->
    <aside class="document-toc">
      <nav class="toc-nav">
        <h2 class="toc-title">Contents</h2>
        <ul class="toc-list">
          <li>
            <a href="#section-1" class="toc-link active">Executive Summary</a>
          </li>
          <li>
            <a href="#section-2" class="toc-link">Introduction</a>
            <ul class="toc-sublist">
              <li><a href="#section-2-1" class="toc-link">Background</a></li>
              <li><a href="#section-2-2" class="toc-link">Objectives</a></li>
            </ul>
          </li>
          <li>
            <a href="#section-3" class="toc-link">Market Analysis</a>
          </li>
        </ul>
      </nav>
    </aside>

    <!-- Main content -->
    <article class="document-content">
      <header class="document-header">
        <h1 class="document-title">Q1 2025 Product Launch Plan</h1>
        <p class="document-subtitle">Comprehensive Strategy Document</p>
        <div class="document-meta">
          <span class="meta-item">AI Generated</span>
          <span class="meta-divider">•</span>
          <span class="meta-item">November 24, 2025</span>
        </div>
      </header>

      <section id="section-1" class="document-section">
        <h2 class="section-heading">1. Executive Summary</h2>
        <p class="section-paragraph">
          This document outlines the comprehensive strategy for launching our new product
          in Q1 2025, based on extensive market research and competitive analysis.
        </p>
        <ul class="section-list">
          <li>Target launch date: March 31, 2025</li>
          <li>Primary market: Enterprise SaaS</li>
          <li>Expected revenue: $2.5M in first quarter</li>
        </ul>
      </section>

      <section id="section-2" class="document-section">
        <h2 class="section-heading">2. Introduction</h2>
        <!-- More content -->
      </section>
    </article>
  </div>
</div>
```

```css
/* document-view.css */
.document-view {
  background: var(--color-background);
  min-height: calc(100vh - var(--header-height));
}

.document-container {
  max-width: var(--container-lg);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--spacing-8);
  padding: var(--spacing-8);
}

/* Table of Contents */
.document-toc {
  position: sticky;
  top: calc(var(--header-height) + var(--spacing-8));
  height: fit-content;
  max-height: calc(100vh - var(--header-height) - var(--spacing-16));
  overflow-y: auto;
}

.toc-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-4) 0;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc-list li {
  margin-bottom: var(--spacing-1);
}

.toc-link {
  display: block;
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: var(--text-sm);
  transition: all var(--transition-fast);
  border-left: 2px solid transparent;
}

.toc-link:hover {
  background: var(--color-hover);
  color: var(--color-text-primary);
}

.toc-link.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: var(--weight-medium);
  border-left-color: var(--color-primary);
}

.toc-sublist {
  list-style: none;
  margin: var(--spacing-1) 0 0 var(--spacing-4);
  padding: 0;
}

/* Document Content */
.document-content {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-12);
  max-width: var(--content-width);
}

.document-header {
  margin-bottom: var(--spacing-12);
  padding-bottom: var(--spacing-8);
  border-bottom: 1px solid var(--color-border);
}

.document-title {
  font-size: var(--text-4xl);
  font-weight: var(--weight-normal);
  line-height: var(--leading-tight);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4) 0;
}

.document-subtitle {
  font-size: var(--text-xl);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-6) 0;
  font-weight: var(--weight-normal);
}

.document-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.meta-divider {
  color: var(--color-border);
}

/* Sections */
.document-section {
  margin-bottom: var(--spacing-12);
}

.section-heading {
  font-size: var(--text-3xl);
  font-weight: var(--weight-medium);
  line-height: var(--leading-tight);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-6) 0;
  scroll-margin-top: calc(var(--header-height) + var(--spacing-8));
}

.section-heading:not(:first-child) {
  margin-top: var(--spacing-12);
}

.section-paragraph {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4) 0;
}

.section-list {
  margin: var(--spacing-4) 0;
  padding-left: var(--spacing-6);
  color: var(--color-text-primary);
  line-height: var(--leading-relaxed);
}

.section-list li {
  margin-bottom: var(--spacing-2);
}

/* Responsive */
@media (max-width: 1024px) {
  .document-container {
    grid-template-columns: 1fr;
  }

  .document-toc {
    position: static;
    max-height: none;
    margin-bottom: var(--spacing-6);
  }
}
```

### 4. Slides View (Presentation Mode)

```html
<div class="slides-view">
  <div class="slides-container">
    <!-- Current slide -->
    <div class="slide-display">
      <div class="slide" data-slide-number="1" data-slide-type="title">
        <div class="slide-content">
          <h1 class="slide-title">Q1 2025 Product Launch</h1>
          <p class="slide-subtitle">Strategic Overview</p>
        </div>
      </div>
    </div>

    <!-- Navigation controls -->
    <div class="slide-controls">
      <button class="slide-nav-button" id="prev-slide" aria-label="Previous">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </button>

      <div class="slide-counter">
        <span class="current-slide">1</span>
        <span class="slide-divider">/</span>
        <span class="total-slides">12</span>
      </div>

      <button class="slide-nav-button" id="next-slide" aria-label="Next">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </button>

      <button class="icon-button" id="fullscreen-toggle" title="Fullscreen">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
        </svg>
      </button>
    </div>

    <!-- Thumbnail navigator -->
    <div class="slide-thumbnails">
      <button class="thumbnail" data-slide="1">
        <div class="thumbnail-preview">1</div>
      </button>
      <button class="thumbnail active" data-slide="2">
        <div class="thumbnail-preview">2</div>
      </button>
      <!-- More thumbnails -->
    </div>
  </div>
</div>
```

```css
/* slides-view.css */
.slides-view {
  background: var(--color-background-alt);
  min-height: calc(100vh - var(--header-height));
  padding: var(--spacing-8);
}

.slides-container {
  max-width: var(--container-lg);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

/* Slide display */
.slide-display {
  background: var(--color-background-alt);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
}

.slide {
  background: var(--color-surface);
  width: 100%;
  max-width: 960px;
  aspect-ratio: 16 / 9;
  margin: 0 auto;
  box-shadow: var(--shadow-xl);
  border-radius: var(--radius-md);
  padding: var(--spacing-12);
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  transition: transform var(--transition-base);
}

.slide:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl);
}

/* Slide content types */
.slide[data-slide-type="title"] {
  text-align: center;
  justify-content: center;
}

.slide[data-slide-type="content"] {
  justify-content: flex-start;
}

.slide-title {
  font-size: var(--text-5xl);
  font-weight: var(--weight-normal);
  line-height: var(--leading-tight);
  color: var(--color-text-primary);
  margin: 0;
}

.slide-subtitle {
  font-size: var(--text-2xl);
  color: var(--color-text-secondary);
  margin: var(--spacing-4) 0 0 0;
  font-weight: var(--weight-normal);
}

.slide-heading {
  font-size: var(--text-3xl);
  font-weight: var(--weight-medium);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-8) 0;
}

.slide-bullets {
  list-style: none;
  margin: 0;
  padding: 0;
}

.slide-bullets li {
  font-size: var(--text-xl);
  line-height: var(--leading-relaxed);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-6);
  padding-left: var(--spacing-8);
  position: relative;
}

.slide-bullets li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--color-primary);
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
}

/* Navigation controls */
.slide-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-6);
  padding: var(--spacing-4);
}

.slide-nav-button {
  width: 48px;
  height: 48px;
  border: none;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-md);
}

.slide-nav-button:hover {
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-lg);
}

.slide-nav-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.slide-nav-button:disabled:hover {
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.slide-nav-button svg {
  fill: currentColor;
}

.slide-counter {
  background: var(--color-surface);
  padding: var(--spacing-3) var(--spacing-6);
  border-radius: var(--radius-full);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.slide-divider {
  color: var(--color-text-tertiary);
}

/* Thumbnail navigator */
.slide-thumbnails {
  display: flex;
  gap: var(--spacing-3);
  overflow-x: auto;
  padding: var(--spacing-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.thumbnail {
  flex: 0 0 auto;
  width: 120px;
  aspect-ratio: 16 / 9;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0;
  overflow: hidden;
}

.thumbnail:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.thumbnail.active {
  border-color: var(--color-primary);
  border-width: 3px;
  box-shadow: var(--shadow-md);
}

.thumbnail-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-2xl);
  color: var(--color-text-tertiary);
  font-weight: var(--weight-medium);
}

/* Fullscreen mode */
.slides-view.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-modal);
  background: var(--color-background-alt);
  padding: var(--spacing-8);
}

.slides-view.fullscreen .slide {
  max-width: 100%;
  max-height: calc(100vh - 200px);
}

.slides-view.fullscreen .slide-thumbnails {
  display: none;
}

/* Keyboard navigation hint */
.keyboard-hint {
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-4);
}

.keyboard-hint kbd {
  display: inline-block;
  padding: var(--spacing-1) var(--spacing-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  box-shadow: var(--shadow-sm);
}
```

### 5. Roadmap View (Enhanced Gantt Chart)

```css
/* roadmap-view.css */
.roadmap-view {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-6);
  max-width: var(--container-xl);
  margin: 0 auto;
}

.roadmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-6);
  padding-bottom: var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.roadmap-title {
  font-size: var(--text-3xl);
  font-weight: var(--weight-normal);
  color: var(--color-text-primary);
  margin: 0;
}

.roadmap-actions {
  display: flex;
  gap: var(--spacing-2);
}

.roadmap-button {
  padding: var(--spacing-2) var(--spacing-4);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.roadmap-button:hover {
  background: var(--color-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.roadmap-button.primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.roadmap-button.primary:hover {
  background: var(--color-primary-hover);
}

/* Gantt chart container */
#gantt-chart {
  width: 100%;
  overflow-x: auto;
  margin-top: var(--spacing-6);
}

/* Make existing Gantt chart match design system */
.gantt-container {
  font-family: var(--font-primary);
  color: var(--color-text-primary);
}

.gantt-row:hover {
  background: var(--color-hover);
}

.gantt-task-bar {
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.gantt-task-bar:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
```

---

## Responsive Design

```css
/* responsive.css */

/* Tablets and below (< 1024px) */
@media (max-width: 1024px) {
  .document-container {
    grid-template-columns: 1fr;
  }

  .document-toc {
    position: static;
    margin-bottom: var(--spacing-6);
  }

  .slide {
    max-width: 100%;
    padding: var(--spacing-8);
  }

  .slide-title {
    font-size: var(--text-4xl);
  }
}

/* Mobile (< 768px) */
@media (max-width: 768px) {
  .app-header {
    padding: 0 var(--spacing-2);
  }

  .header-center {
    display: none; /* Hide document title on mobile */
  }

  .document-content {
    padding: var(--spacing-6);
  }

  .document-title {
    font-size: var(--text-3xl);
  }

  .section-heading {
    font-size: var(--text-2xl);
  }

  .slide {
    padding: var(--spacing-6);
  }

  .slide-title {
    font-size: var(--text-3xl);
  }

  .slide-bullets li {
    font-size: var(--text-lg);
  }

  .slide-thumbnails {
    display: none;
  }
}

/* Print styles */
@media print {
  .app-header,
  .hamburger-menu,
  .slide-controls,
  .slide-thumbnails,
  .document-toc {
    display: none !important;
  }

  .document-content,
  .slide {
    box-shadow: none;
    page-break-inside: avoid;
  }

  .slide {
    page-break-after: always;
  }
}
```

---

## Animation & Interaction Polish

```css
/* animations.css */

/* Page transitions */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Apply to views */
.document-view,
.slides-view,
.roadmap-view {
  animation: fadeIn var(--transition-base);
}

.menu-nav-item {
  animation: slideIn var(--transition-base);
  animation-fill-mode: both;
}

.menu-nav-item:nth-child(1) { animation-delay: 50ms; }
.menu-nav-item:nth-child(2) { animation-delay: 100ms; }
.menu-nav-item:nth-child(3) { animation-delay: 150ms; }

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Focus visible (accessibility) */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Loading states */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.6s linear infinite;
}

/* Skeleton loading */
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-background) 0%,
    var(--color-hover) 50%,
    var(--color-background) 100%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
  border-radius: var(--radius-sm);
}
```

---

## Accessibility Checklist

```css
/* a11y.css */

/* Focus indicators */
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Skip to content link */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-primary);
  color: white;
  padding: var(--spacing-2) var(--spacing-4);
  text-decoration: none;
  z-index: var(--z-tooltip);
}

.skip-link:focus {
  top: 0;
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  html {
    scroll-behavior: auto;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  :root {
    --color-border: #000;
    --shadow-sm: none;
    --shadow-md: 0 0 0 2px currentColor;
  }
}
```

---

## Summary

This design system provides:

1. **Visual Consistency** - Shared design tokens across all views
2. **Clean Aesthetics** - Google Docs-inspired minimalism
3. **Excellent Readability** - Optimized typography and spacing
4. **Smooth Interactions** - Subtle animations and transitions
5. **Accessibility** - WCAG 2.1 AA compliant
6. **Responsive** - Works on all screen sizes
7. **Printable** - Clean print styles for all views

**Next Steps:**
1. Create `design-system.css` with all design tokens
2. Apply styles to existing GanttChart component
3. Build new SlidesView and DocumentView components
4. Test across browsers and devices
5. Validate with accessibility tools (axe, WAVE)

This will give you a professional, elegant, Google Docs-like UI that's simple, intuitive, and easy to read.
