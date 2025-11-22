# PowerPoint-Export-First Presentation Architecture
## Detailed Implementation Plan

**Version**: 1.0
**Date**: 2025-11-22
**Status**: Planning Phase
**Objective**: Redesign presentation system with PPT export as the primary architectural concern

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Architectural Vision](#architectural-vision)
4. [Data Model Design](#data-model-design)
5. [Slide Type Library](#slide-type-library)
6. [Dual Rendering System](#dual-rendering-system)
7. [PowerPoint Export Engine](#powerpoint-export-engine)
8. [Web Viewer Integration](#web-viewer-integration)
9. [Implementation Phases](#implementation-phases)
10. [Testing Strategy](#testing-strategy)
11. [Migration Path](#migration-path)
12. [Success Criteria](#success-criteria)

---

## 1. Executive Summary

### Problem Statement
The current presentation viewer is designed for **web-first viewing** with no consideration for PowerPoint export. This creates a fundamental architectural mismatch where:
- Slides are HTML/CSS visual elements with no structured data
- No export functionality exists
- Formatting cannot be preserved in PowerPoint
- Content is not structured for programmatic export

### Solution Overview
Redesign the presentation system with a **data-first, dual-rendering** architecture where:
1. **AI generates structured slide data** (JSON format)
2. **Dual renderers** create both web views and PowerPoint files
3. **Export function** generates pixel-perfect PPTX files
4. **Web viewer** remains modern and feature-rich
5. **Single source of truth** (structured data) drives both outputs

### Key Benefits
- ✅ **Perfect PowerPoint export** with formatting preservation
- ✅ **Structured data model** enables future enhancements
- ✅ **Dual rendering** maintains web viewer quality
- ✅ **AI-ready** for generating proper slide content
- ✅ **Brand consistency** across web and PowerPoint
- ✅ **Future-proof** architecture for PDF export, animations, etc.

---

## 2. Current State Analysis

### Current Architecture
```
AI Backend → generates presentationSlides object
                ↓
PresentationSlides.js → creates HTML elements for viewing
                ↓
Modern Web Viewer → displays slides (no export)
```

### Current Data Structure
```javascript
// Current (inadequate for export)
{
  slides: [
    {
      type: 'title',
      title: 'Some Title',
      subtitle: 'Some Subtitle'
      // Loosely structured, web-oriented
    }
  ]
}
```

### Identified Gaps
1. ❌ **No structured content model** (just HTML-focused fields)
2. ❌ **No slide layout definitions** (no PowerPoint layout mapping)
3. ❌ **No formatting specifications** (fonts, colors, sizes undefined)
4. ❌ **No image handling** (no base64, URLs, or positioning data)
5. ❌ **No export engine** (PptxGenJS loaded but unused)
6. ❌ **No content validation** (no schema for AI to follow)
7. ❌ **No brand theming** (colors/fonts not standardized)

---

## 3. Architectural Vision

### New Architecture
```
                    ┌─────────────────────┐
                    │   AI Backend        │
                    │  (Gemini API)       │
                    └──────────┬──────────┘
                               │ Generates structured JSON
                               ↓
                    ┌─────────────────────┐
                    │  Slide Data Model   │
                    │  (Structured JSON)  │
                    └──────────┬──────────┘
                               │ Single Source of Truth
                    ┌──────────┴──────────┐
                    ↓                     ↓
        ┌───────────────────┐   ┌───────────────────┐
        │  Web Renderer     │   │  PPT Exporter     │
        │  (HTML/CSS)       │   │  (PptxGenJS)      │
        └─────────┬─────────┘   └─────────┬─────────┘
                  ↓                       ↓
        ┌───────────────────┐   ┌───────────────────┐
        │  Modern Viewer    │   │  PowerPoint File  │
        │  (Browser)        │   │  (.pptx download) │
        └───────────────────┘   └───────────────────┘
```

### Core Principles

#### 1. **Data-First Design**
- Structured JSON is the single source of truth
- All renderers consume the same data model
- No renderer-specific logic in data layer

#### 2. **Separation of Concerns**
```
Data Layer:     SlideData.js (schema, validation)
Render Layer:   WebRenderer.js, PPTRenderer.js
View Layer:     PresentationViewer.js (UI controls)
Export Layer:   PPTExporter.js (PptxGenJS wrapper)
```

#### 3. **Type Safety**
- Define TypeScript-like interfaces (JSDoc)
- Schema validation for AI-generated content
- Type checking at runtime

#### 4. **Formatting Consistency**
- Theme object defines all styling
- Renderers translate theme to their format
- No hardcoded styles in slide content

---

## 4. Data Model Design

### Core Data Structure

```javascript
/**
 * Complete Presentation Data Model
 * This is the single source of truth for both web and PPT rendering
 */
const PresentationDataModel = {
  // Metadata
  metadata: {
    title: String,           // "Q4 2025 Roadmap"
    author: String,          // "AI Roadmap Generator"
    company: String,         // "BIP Company"
    date: String,            // ISO date string
    version: String,         // "1.0"
    slideCount: Number       // Auto-calculated
  },

  // Theme configuration (applies to all slides)
  theme: {
    // Master slide settings
    aspectRatio: '16:9',     // Fixed
    width: 10,               // PowerPoint inches
    height: 5.625,           // PowerPoint inches (16:9)

    // Color palette
    colors: {
      primary: '#3b82f6',    // Blue
      secondary: '#8b5cf6',  // Purple
      accent: '#10b981',     // Green
      danger: '#ef4444',     // Red
      warning: '#f59e0b',    // Amber
      background: '#ffffff', // White
      text: {
        primary: '#1f2937',  // Dark gray
        secondary: '#6b7280',// Medium gray
        muted: '#9ca3af'     // Light gray
      }
    },

    // Typography
    fonts: {
      title: {
        family: 'Work Sans',
        size: 44,            // Points
        weight: 700,         // Bold
        color: '#1f2937'
      },
      subtitle: {
        family: 'Work Sans',
        size: 24,
        weight: 400,
        color: '#6b7280'
      },
      body: {
        family: 'Work Sans',
        size: 18,
        weight: 400,
        color: '#1f2937',
        lineHeight: 1.6
      },
      bullet: {
        family: 'Work Sans',
        size: 16,
        weight: 400,
        color: '#1f2937'
      }
    },

    // Spacing (in PowerPoint units)
    spacing: {
      slideMargin: 0.5,      // Inches from edge
      titleTop: 0.75,        // Title position from top
      contentTop: 1.5,       // Content start position
      bulletIndent: 0.5,     // Bullet indentation per level
      lineSpacing: 1.2       // Line height multiplier
    },

    // Branding
    branding: {
      logo: {
        enabled: true,
        position: 'top-right', // top-left, top-right, bottom-left, bottom-right
        width: 1,            // Inches
        height: 0.5,         // Inches
        padding: 0.25,       // Inches from edge
        imageData: String    // Base64 or URL
      },
      footer: {
        enabled: true,
        text: 'Confidential',
        fontSize: 10,
        color: '#9ca3af',
        position: 'bottom-center'
      }
    }
  },

  // Slide definitions
  slides: [
    {
      // Unique slide identifier
      id: String,            // 'slide-001'

      // Slide type (determines layout and rendering)
      type: 'title' | 'content' | 'two-column' | 'bullets' |
            'image' | 'quote' | 'section' | 'table' | 'comparison',

      // Layout configuration
      layout: {
        name: String,        // PowerPoint layout name
        variant: String      // Layout variant (if applicable)
      },

      // Slide-specific content (type-dependent)
      content: {
        // See detailed type definitions below
      },

      // Slide-specific overrides (optional)
      overrides: {
        backgroundColor: String,  // Override theme background
        titleColor: String,       // Override theme title color
        titleSize: Number,        // Override theme title size
        // ... other overrides
      },

      // Speaker notes (for PowerPoint only)
      notes: String,         // Markdown-formatted notes

      // Animations (future enhancement)
      animations: [
        {
          element: String,   // Element selector
          type: String,      // 'fade', 'slide', 'zoom'
          duration: Number,  // Milliseconds
          delay: Number      // Milliseconds
        }
      ],

      // Transitions (future enhancement)
      transition: {
        type: String,        // 'fade', 'push', 'wipe'
        duration: Number     // Milliseconds
      }
    }
  ]
};
```

### Slide Type Content Structures

#### Type: 'title'
```javascript
{
  type: 'title',
  layout: {
    name: 'Title Slide',
    variant: 'default'
  },
  content: {
    title: {
      text: String,          // "AI-Powered Strategic Intelligence"
      alignment: 'center',   // left, center, right
      verticalAlign: 'middle' // top, middle, bottom
    },
    subtitle: {
      text: String,          // "Strategic Intelligence Brief"
      alignment: 'center'
    },
    // Optional accent element
    accent: {
      type: 'line',          // line, box, gradient
      color: String,         // Theme color or hex
      height: Number,        // Inches
      position: 'below-title' // above-title, below-title, below-subtitle
    }
  },
  notes: "Opening slide. Set the stage for the presentation."
}
```

#### Type: 'bullets'
```javascript
{
  type: 'bullets',
  layout: {
    name: 'Content',
    variant: 'bullets'
  },
  content: {
    title: {
      text: String,          // "Key Strategic Drivers"
      alignment: 'left'
    },
    bullets: [
      {
        text: String,        // "Market Intelligence Automation"
        level: 1,            // 1-5 (indentation level)
        bullet: 'number',    // number, bullet, dash, arrow, none
        color: String,       // Optional: override bullet color
        bold: Boolean,       // Emphasis
        italic: Boolean
      },
      {
        text: String,
        level: 2,            // Sub-bullet
        bullet: 'bullet'
      }
    ],
    // Optional footer
    footer: {
      text: String,
      fontSize: Number,
      color: String
    }
  }
}
```

#### Type: 'two-column'
```javascript
{
  type: 'two-column',
  layout: {
    name: 'Two Content',
    variant: 'equal' // equal, left-heavy, right-heavy
  },
  content: {
    title: {
      text: String,
      alignment: 'left'
    },
    leftColumn: {
      type: 'text' | 'image' | 'bullets' | 'chart',
      // Type-specific content
      text: String,          // If type: 'text'
      image: {               // If type: 'image'
        src: String,         // Base64 or URL
        alt: String,
        width: Number,       // Percentage (0-100)
        height: Number,      // Percentage (0-100)
        position: 'center'   // top, center, bottom
      },
      bullets: Array         // If type: 'bullets'
    },
    rightColumn: {
      type: 'text' | 'image' | 'bullets' | 'chart',
      // Same structure as leftColumn
    },
    // Column ratio (optional)
    ratio: '50:50' // '40:60', '60:40', '30:70', etc.
  }
}
```

#### Type: 'image'
```javascript
{
  type: 'image',
  layout: {
    name: 'Picture with Caption',
    variant: 'full' // full, large, medium
  },
  content: {
    title: {
      text: String,
      alignment: 'left'
    },
    image: {
      src: String,           // Base64 encoded or URL
      alt: String,           // Accessibility text
      width: Number,         // Percentage (0-100) or 'auto'
      height: Number,        // Percentage (0-100) or 'auto'
      position: 'center',    // center, top, bottom, left, right
      caption: String,       // Optional caption below image
      border: {              // Optional border
        enabled: Boolean,
        color: String,
        width: Number        // Points
      }
    }
  }
}
```

#### Type: 'table'
```javascript
{
  type: 'table',
  layout: {
    name: 'Table',
    variant: 'default'
  },
  content: {
    title: {
      text: String,
      alignment: 'left'
    },
    table: {
      headers: [
        {
          text: String,
          width: Number,     // Percentage
          alignment: 'left', // left, center, right
          backgroundColor: String,
          textColor: String
        }
      ],
      rows: [
        [
          {
            text: String,
            alignment: 'left',
            backgroundColor: String,
            textColor: String,
            bold: Boolean,
            italic: Boolean
          }
        ]
      ],
      // Table styling
      style: {
        borderColor: String,
        borderWidth: Number, // Points
        alternateRowColors: Boolean,
        headerBackgroundColor: String,
        headerTextColor: String
      }
    }
  }
}
```

#### Type: 'quote'
```javascript
{
  type: 'quote',
  layout: {
    name: 'Quote',
    variant: 'centered'
  },
  content: {
    quote: {
      text: String,          // The quote text
      fontSize: Number,      // Optional override
      fontStyle: 'italic',
      color: String,
      alignment: 'center'
    },
    attribution: {
      text: String,          // "- John Doe, CEO"
      fontSize: Number,
      color: String,
      alignment: 'right'
    },
    // Optional accent
    quoteMarks: {
      enabled: Boolean,
      style: 'decorative',   // decorative, simple
      color: String
    }
  }
}
```

#### Type: 'section'
```javascript
{
  type: 'section',
  layout: {
    name: 'Section Header',
    variant: 'default'
  },
  content: {
    sectionNumber: String,   // "01", "02", etc.
    sectionTitle: {
      text: String,          // "Strategic Overview"
      alignment: 'center',
      fontSize: Number,      // Optional override
      color: String
    },
    description: {
      text: String,          // Optional description
      alignment: 'center',
      fontSize: Number,
      color: String
    },
    // Background styling
    background: {
      type: 'gradient',      // solid, gradient, image
      color: String,         // If solid
      gradient: {            // If gradient
        type: 'linear',      // linear, radial
        angle: Number,       // Degrees
        colors: [String]     // Array of colors
      }
    }
  }
}
```

#### Type: 'comparison'
```javascript
{
  type: 'comparison',
  layout: {
    name: 'Comparison',
    variant: 'two-side' // two-side, three-side
  },
  content: {
    title: {
      text: String,
      alignment: 'left'
    },
    items: [
      {
        label: String,       // "Option A"
        icon: String,        // Emoji or icon identifier
        bullets: [
          {
            text: String,
            type: 'pro' | 'con' | 'neutral',
            icon: String     // ✓, ✗, •
          }
        ],
        backgroundColor: String,
        borderColor: String
      }
    ]
  }
}
```

---

## 5. Slide Type Library

### Supported Slide Types (Phase 1)

| Type | Layout | Use Case | Priority |
|------|--------|----------|----------|
| `title` | Title Slide | Opening/closing slides | High |
| `bullets` | Content | Lists, key points | High |
| `two-column` | Two Content | Text + image, comparisons | High |
| `image` | Picture | Screenshots, diagrams | Medium |
| `section` | Section Header | Chapter breaks | Medium |
| `quote` | Quote | Executive quotes | Low |
| `table` | Table | Data comparison | Low |
| `comparison` | Comparison | Pros/cons, options | Low |

### Layout Mapping (PowerPoint ↔ Web)

```javascript
const LAYOUT_MAPPING = {
  'title': {
    powerpoint: 'LAYOUT_TITLE',
    webClass: 'slide-title',
    elements: ['title', 'subtitle', 'accent']
  },
  'bullets': {
    powerpoint: 'LAYOUT_TEXT',
    webClass: 'slide-bullets',
    elements: ['title', 'bullets', 'footer']
  },
  'two-column': {
    powerpoint: 'LAYOUT_TWO_OBJECTS',
    webClass: 'slide-two-column',
    elements: ['title', 'leftColumn', 'rightColumn']
  },
  'image': {
    powerpoint: 'LAYOUT_PICTURE',
    webClass: 'slide-image',
    elements: ['title', 'image', 'caption']
  },
  'section': {
    powerpoint: 'LAYOUT_SECTION_HEADER',
    webClass: 'slide-section',
    elements: ['sectionNumber', 'sectionTitle', 'description']
  },
  'quote': {
    powerpoint: 'LAYOUT_BLANK',
    webClass: 'slide-quote',
    elements: ['quote', 'attribution', 'quoteMarks']
  },
  'table': {
    powerpoint: 'LAYOUT_TABLE',
    webClass: 'slide-table',
    elements: ['title', 'table']
  },
  'comparison': {
    powerpoint: 'LAYOUT_COMPARISON',
    webClass: 'slide-comparison',
    elements: ['title', 'items']
  }
};
```

---

## 6. Dual Rendering System

### Architecture

```
                    Slide Data (JSON)
                           │
                ┌──────────┴──────────┐
                ↓                     ↓
        WebRenderer.js        PPTRenderer.js
                │                     │
        ┌───────┴───────┐     ┌──────┴──────┐
        ↓               ↓     ↓             ↓
    HTML/CSS        Canvas   Shapes      Text
    Elements        Images   Images      Tables
```

### WebRenderer.js (New)

```javascript
/**
 * WebRenderer - Converts slide data to HTML/CSS
 * Optimized for modern web viewing
 */
class WebRenderer {
  constructor(slideData, theme) {
    this.slideData = slideData;
    this.theme = theme;
  }

  /**
   * Render slide to HTML element
   * @param {Object} slide - Slide data object
   * @returns {HTMLElement} - Rendered slide
   */
  renderSlide(slide) {
    const container = document.createElement('div');
    container.className = `slide slide-${slide.type}`;
    container.setAttribute('data-slide-id', slide.id);

    // Apply theme
    this._applyTheme(container);

    // Render based on type
    switch(slide.type) {
      case 'title':
        return this._renderTitleSlide(container, slide);
      case 'bullets':
        return this._renderBulletsSlide(container, slide);
      case 'two-column':
        return this._renderTwoColumnSlide(container, slide);
      case 'image':
        return this._renderImageSlide(container, slide);
      case 'section':
        return this._renderSectionSlide(container, slide);
      case 'quote':
        return this._renderQuoteSlide(container, slide);
      case 'table':
        return this._renderTableSlide(container, slide);
      case 'comparison':
        return this._renderComparisonSlide(container, slide);
      default:
        console.warn(`Unknown slide type: ${slide.type}`);
        return this._renderBlankSlide(container, slide);
    }
  }

  /**
   * Apply theme styling to container
   * @private
   */
  _applyTheme(container) {
    // Set CSS custom properties from theme
    container.style.setProperty('--primary-color', this.theme.colors.primary);
    container.style.setProperty('--secondary-color', this.theme.colors.secondary);
    container.style.setProperty('--text-color', this.theme.colors.text.primary);
    container.style.setProperty('--font-family', this.theme.fonts.body.family);
    // ... set all theme properties
  }

  /**
   * Render title slide
   * @private
   */
  _renderTitleSlide(container, slide) {
    const { content } = slide;

    // Create title
    const title = document.createElement('h1');
    title.className = 'slide-title';
    title.textContent = content.title.text;
    title.style.textAlign = content.title.alignment;
    title.style.fontSize = `${this.theme.fonts.title.size}pt`;
    title.style.fontWeight = this.theme.fonts.title.weight;
    title.style.color = this.theme.fonts.title.color;

    // Create subtitle
    const subtitle = document.createElement('p');
    subtitle.className = 'slide-subtitle';
    subtitle.textContent = content.subtitle.text;
    subtitle.style.textAlign = content.subtitle.alignment;
    subtitle.style.fontSize = `${this.theme.fonts.subtitle.size}pt`;
    subtitle.style.color = this.theme.fonts.subtitle.color;

    // Create accent (if defined)
    if (content.accent) {
      const accent = this._createAccent(content.accent);
      container.appendChild(title);
      container.appendChild(accent);
      container.appendChild(subtitle);
    } else {
      container.appendChild(title);
      container.appendChild(subtitle);
    }

    return container;
  }

  /**
   * Render bullets slide
   * @private
   */
  _renderBulletsSlide(container, slide) {
    const { content } = slide;

    // Title
    const title = document.createElement('h2');
    title.className = 'slide-title';
    title.textContent = content.title.text;
    title.style.textAlign = content.title.alignment;

    // Bullets container
    const bulletsContainer = document.createElement('div');
    bulletsContainer.className = 'bullets-container';

    // Create nested list structure
    const bulletsList = this._createBulletList(content.bullets);
    bulletsContainer.appendChild(bulletsList);

    container.appendChild(title);
    container.appendChild(bulletsContainer);

    return container;
  }

  /**
   * Create hierarchical bullet list
   * @private
   */
  _createBulletList(bullets) {
    const ul = document.createElement('ul');
    ul.className = 'bullet-list';

    let currentLevel = 1;
    let currentList = ul;
    let listStack = [ul];

    bullets.forEach(bullet => {
      const li = document.createElement('li');
      li.className = `bullet-item level-${bullet.level}`;
      li.textContent = bullet.text;

      // Apply styling
      if (bullet.bold) li.style.fontWeight = 'bold';
      if (bullet.italic) li.style.fontStyle = 'italic';
      if (bullet.color) li.style.color = bullet.color;

      // Handle nesting
      if (bullet.level > currentLevel) {
        // Create nested list
        const nestedUl = document.createElement('ul');
        nestedUl.className = 'bullet-list nested';
        const lastLi = currentList.lastElementChild;
        if (lastLi) lastLi.appendChild(nestedUl);
        listStack.push(nestedUl);
        currentList = nestedUl;
      } else if (bullet.level < currentLevel) {
        // Go back up levels
        for (let i = currentLevel; i > bullet.level; i--) {
          listStack.pop();
        }
        currentList = listStack[listStack.length - 1];
      }

      currentList.appendChild(li);
      currentLevel = bullet.level;
    });

    return ul;
  }

  /**
   * Render two-column slide
   * @private
   */
  _renderTwoColumnSlide(container, slide) {
    const { content } = slide;

    // Title
    const title = document.createElement('h2');
    title.className = 'slide-title';
    title.textContent = content.title.text;

    // Columns container
    const columnsContainer = document.createElement('div');
    columnsContainer.className = 'two-columns';
    columnsContainer.style.display = 'grid';
    columnsContainer.style.gridTemplateColumns = this._parseRatio(content.ratio);
    columnsContainer.style.gap = '2rem';

    // Left column
    const leftColumn = this._renderColumn(content.leftColumn);
    leftColumn.className = 'column left-column';

    // Right column
    const rightColumn = this._renderColumn(content.rightColumn);
    rightColumn.className = 'column right-column';

    columnsContainer.appendChild(leftColumn);
    columnsContainer.appendChild(rightColumn);

    container.appendChild(title);
    container.appendChild(columnsContainer);

    return container;
  }

  /**
   * Render column content based on type
   * @private
   */
  _renderColumn(columnData) {
    const column = document.createElement('div');

    switch(columnData.type) {
      case 'text':
        column.innerHTML = `<p class="column-text">${columnData.text}</p>`;
        break;
      case 'image':
        const img = document.createElement('img');
        img.src = columnData.image.src;
        img.alt = columnData.image.alt;
        img.style.width = `${columnData.image.width}%`;
        img.style.height = 'auto';
        column.appendChild(img);
        break;
      case 'bullets':
        const bulletList = this._createBulletList(columnData.bullets);
        column.appendChild(bulletList);
        break;
    }

    return column;
  }

  // Additional rendering methods for other slide types...
}
```

### PPTRenderer.js (New)

```javascript
/**
 * PPTRenderer - Converts slide data to PowerPoint using PptxGenJS
 * Pixel-perfect export with formatting preservation
 */
class PPTRenderer {
  constructor(slideData, theme) {
    this.slideData = slideData;
    this.theme = theme;
    this.pptx = new PptxGenJS();

    // Configure presentation
    this._configurePowerPoint();
  }

  /**
   * Configure PowerPoint presentation settings
   * @private
   */
  _configurePowerPoint() {
    // Set layout
    this.pptx.layout = 'LAYOUT_16x9';

    // Set metadata
    this.pptx.author = this.slideData.metadata.author;
    this.pptx.company = this.slideData.metadata.company;
    this.pptx.subject = this.slideData.metadata.title;

    // Define master slide (branding)
    this._configureMasterSlide();

    // Define theme colors
    this._configureThemeColors();
  }

  /**
   * Configure master slide with branding
   * @private
   */
  _configureMasterSlide() {
    const { branding } = this.theme;

    // Add logo to master if enabled
    if (branding.logo.enabled) {
      // Logo will be added to each slide
      this.logoConfig = {
        data: branding.logo.imageData,
        x: this._getLogoX(branding.logo.position),
        y: this._getLogoY(branding.logo.position),
        w: branding.logo.width,
        h: branding.logo.height
      };
    }

    // Footer configuration
    if (branding.footer.enabled) {
      this.footerConfig = {
        text: branding.footer.text,
        fontSize: branding.footer.fontSize,
        color: branding.footer.color
      };
    }
  }

  /**
   * Configure theme colors for PowerPoint
   * @private
   */
  _configureThemeColors() {
    // PptxGenJS supports theme colors
    // These can be referenced in slides
    this.colorScheme = {
      primary: this.theme.colors.primary,
      secondary: this.theme.colors.secondary,
      accent: this.theme.colors.accent,
      text: this.theme.colors.text.primary
    };
  }

  /**
   * Render all slides to PowerPoint
   * @returns {PptxGenJS} - Configured presentation
   */
  renderPresentation() {
    this.slideData.slides.forEach((slideData, index) => {
      this.renderSlide(slideData, index);
    });

    return this.pptx;
  }

  /**
   * Render single slide to PowerPoint
   * @param {Object} slideData - Slide data object
   * @param {Number} index - Slide index
   */
  renderSlide(slideData, index) {
    const slide = this.pptx.addSlide();

    // Add branding elements
    if (this.logoConfig) {
      slide.addImage(this.logoConfig);
    }

    if (this.footerConfig) {
      slide.addText(this.footerConfig.text, {
        x: 0.5,
        y: 5.25,
        w: 9,
        h: 0.25,
        fontSize: this.footerConfig.fontSize,
        color: this.footerConfig.color,
        align: 'center'
      });
    }

    // Add slide number
    slide.addText(`${index + 1}`, {
      x: 9.25,
      y: 5.25,
      w: 0.5,
      h: 0.25,
      fontSize: 10,
      color: this.theme.colors.text.muted,
      align: 'right'
    });

    // Render content based on type
    switch(slideData.type) {
      case 'title':
        this._renderTitleSlide(slide, slideData);
        break;
      case 'bullets':
        this._renderBulletsSlide(slide, slideData);
        break;
      case 'two-column':
        this._renderTwoColumnSlide(slide, slideData);
        break;
      case 'image':
        this._renderImageSlide(slide, slideData);
        break;
      case 'section':
        this._renderSectionSlide(slide, slideData);
        break;
      case 'quote':
        this._renderQuoteSlide(slide, slideData);
        break;
      case 'table':
        this._renderTableSlide(slide, slideData);
        break;
      case 'comparison':
        this._renderComparisonSlide(slide, slideData);
        break;
    }

    // Add speaker notes
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  /**
   * Render title slide
   * @private
   */
  _renderTitleSlide(slide, slideData) {
    const { content } = slideData;
    const { fonts, spacing } = this.theme;

    // Title
    slide.addText(content.title.text, {
      x: spacing.slideMargin,
      y: 2.0, // Center vertically
      w: 10 - (2 * spacing.slideMargin),
      h: 1.5,
      fontSize: fonts.title.size,
      fontFace: fonts.title.family,
      bold: true,
      color: fonts.title.color,
      align: content.title.alignment,
      valign: 'middle'
    });

    // Accent line (if defined)
    if (content.accent && content.accent.type === 'line') {
      slide.addShape(this.pptx.ShapeType.rect, {
        x: 4.5,
        y: 3.0,
        w: 1.0,
        h: 0.05,
        fill: { color: content.accent.color || this.theme.colors.primary }
      });
    }

    // Subtitle
    slide.addText(content.subtitle.text, {
      x: spacing.slideMargin,
      y: 3.2,
      w: 10 - (2 * spacing.slideMargin),
      h: 0.75,
      fontSize: fonts.subtitle.size,
      fontFace: fonts.subtitle.family,
      color: fonts.subtitle.color,
      align: content.subtitle.alignment,
      valign: 'top'
    });
  }

  /**
   * Render bullets slide
   * @private
   */
  _renderBulletsSlide(slide, slideData) {
    const { content } = slideData;
    const { fonts, spacing } = this.theme;

    // Title
    slide.addText(content.title.text, {
      x: spacing.slideMargin,
      y: spacing.titleTop,
      w: 10 - (2 * spacing.slideMargin),
      h: 0.75,
      fontSize: fonts.title.size,
      fontFace: fonts.title.family,
      bold: true,
      color: fonts.title.color,
      align: content.title.alignment
    });

    // Bullets
    const bulletOptions = {
      x: spacing.slideMargin,
      y: spacing.contentTop,
      w: 10 - (2 * spacing.slideMargin),
      h: 3.5,
      fontSize: fonts.bullet.size,
      fontFace: fonts.bullet.family,
      color: fonts.bullet.color,
      bullet: true,
      lineSpacing: spacing.lineSpacing * 100
    };

    // Convert bullets to PptxGenJS format
    const bulletText = this._convertBulletsToPPT(content.bullets);

    slide.addText(bulletText, bulletOptions);
  }

  /**
   * Convert bullets array to PptxGenJS bullet format
   * @private
   */
  _convertBulletsToPPT(bullets) {
    return bullets.map(bullet => {
      const bulletObj = {
        text: bullet.text,
        options: {
          indentLevel: bullet.level - 1, // 0-based in PptxGenJS
          bullet: this._getBulletType(bullet.bullet)
        }
      };

      // Apply text formatting
      if (bullet.bold) bulletObj.options.bold = true;
      if (bullet.italic) bulletObj.options.italic = true;
      if (bullet.color) bulletObj.options.color = bullet.color;

      return bulletObj;
    });
  }

  /**
   * Get PowerPoint bullet type
   * @private
   */
  _getBulletType(bulletStyle) {
    const mapping = {
      'number': { type: 'number' },
      'bullet': { type: 'bullet' },
      'dash': { code: '2013' }, // En-dash
      'arrow': { code: '27A4' }, // Arrow
      'none': false
    };

    return mapping[bulletStyle] || mapping['bullet'];
  }

  /**
   * Render two-column slide
   * @private
   */
  _renderTwoColumnSlide(slide, slideData) {
    const { content } = slideData;
    const { spacing } = this.theme;

    // Title
    slide.addText(content.title.text, {
      x: spacing.slideMargin,
      y: spacing.titleTop,
      w: 10 - (2 * spacing.slideMargin),
      h: 0.75,
      fontSize: this.theme.fonts.title.size,
      fontFace: this.theme.fonts.title.family,
      bold: true,
      color: this.theme.fonts.title.color,
      align: content.title.alignment
    });

    // Parse ratio (e.g., "50:50" -> [50, 50])
    const ratio = this._parseRatioToPPT(content.ratio);
    const totalWidth = 10 - (2 * spacing.slideMargin);
    const leftWidth = (totalWidth * ratio[0]) / 100;
    const rightWidth = (totalWidth * ratio[1]) / 100;
    const gap = 0.5; // Gap between columns

    // Left column
    this._renderColumnContent(slide, content.leftColumn, {
      x: spacing.slideMargin,
      y: spacing.contentTop,
      w: leftWidth - (gap / 2),
      h: 3.5
    });

    // Right column
    this._renderColumnContent(slide, content.rightColumn, {
      x: spacing.slideMargin + leftWidth + (gap / 2),
      y: spacing.contentTop,
      w: rightWidth - (gap / 2),
      h: 3.5
    });
  }

  /**
   * Render column content (text, image, bullets)
   * @private
   */
  _renderColumnContent(slide, columnData, bounds) {
    switch(columnData.type) {
      case 'text':
        slide.addText(columnData.text, {
          ...bounds,
          fontSize: this.theme.fonts.body.size,
          fontFace: this.theme.fonts.body.family,
          color: this.theme.fonts.body.color,
          valign: 'top'
        });
        break;

      case 'image':
        slide.addImage({
          data: columnData.image.src,
          x: bounds.x,
          y: bounds.y,
          w: bounds.w,
          h: bounds.h,
          sizing: { type: 'contain', w: bounds.w, h: bounds.h }
        });
        break;

      case 'bullets':
        const bulletText = this._convertBulletsToPPT(columnData.bullets);
        slide.addText(bulletText, {
          ...bounds,
          fontSize: this.theme.fonts.bullet.size,
          fontFace: this.theme.fonts.bullet.family,
          color: this.theme.fonts.bullet.color,
          bullet: true
        });
        break;
    }
  }

  /**
   * Render image slide
   * @private
   */
  _renderImageSlide(slide, slideData) {
    const { content } = slideData;
    const { spacing } = this.theme;

    // Title
    slide.addText(content.title.text, {
      x: spacing.slideMargin,
      y: spacing.titleTop,
      w: 10 - (2 * spacing.slideMargin),
      h: 0.75,
      fontSize: this.theme.fonts.title.size,
      fontFace: this.theme.fonts.title.family,
      bold: true,
      color: this.theme.fonts.title.color,
      align: content.title.alignment
    });

    // Image
    const imageWidth = (10 - (2 * spacing.slideMargin)) * (content.image.width / 100);
    const imageHeight = 3.5; // Available height

    slide.addImage({
      data: content.image.src,
      x: spacing.slideMargin + ((10 - (2 * spacing.slideMargin) - imageWidth) / 2),
      y: spacing.contentTop,
      w: imageWidth,
      h: imageHeight,
      sizing: { type: 'contain', w: imageWidth, h: imageHeight }
    });

    // Caption (if present)
    if (content.image.caption) {
      slide.addText(content.image.caption, {
        x: spacing.slideMargin,
        y: spacing.contentTop + imageHeight + 0.1,
        w: 10 - (2 * spacing.slideMargin),
        h: 0.5,
        fontSize: 14,
        fontFace: this.theme.fonts.body.family,
        color: this.theme.colors.text.secondary,
        align: 'center',
        italic: true
      });
    }
  }

  /**
   * Render table slide
   * @private
   */
  _renderTableSlide(slide, slideData) {
    const { content } = slideData;
    const { spacing } = this.theme;

    // Title
    slide.addText(content.title.text, {
      x: spacing.slideMargin,
      y: spacing.titleTop,
      w: 10 - (2 * spacing.slideMargin),
      h: 0.75,
      fontSize: this.theme.fonts.title.size,
      fontFace: this.theme.fonts.title.family,
      bold: true,
      color: this.theme.fonts.title.color
    });

    // Prepare table data
    const tableData = [
      // Headers
      content.table.headers.map(h => ({
        text: h.text,
        options: {
          fill: { color: h.backgroundColor || content.table.style.headerBackgroundColor },
          color: h.textColor || content.table.style.headerTextColor,
          bold: true,
          align: h.alignment
        }
      })),
      // Rows
      ...content.table.rows.map(row =>
        row.map(cell => ({
          text: cell.text,
          options: {
            fill: { color: cell.backgroundColor || 'FFFFFF' },
            color: cell.textColor || this.theme.colors.text.primary,
            bold: cell.bold,
            italic: cell.italic,
            align: cell.alignment
          }
        }))
      )
    ];

    // Add table
    slide.addTable(tableData, {
      x: spacing.slideMargin,
      y: spacing.contentTop,
      w: 10 - (2 * spacing.slideMargin),
      h: 3.5,
      border: {
        pt: content.table.style.borderWidth || 1,
        color: content.table.style.borderColor || this.theme.colors.text.muted
      },
      fontSize: this.theme.fonts.body.size,
      fontFace: this.theme.fonts.body.family,
      autoPage: true
    });
  }

  // Additional methods for section, quote, comparison slides...

  /**
   * Export presentation to file
   * @param {String} filename - Output filename
   * @returns {Promise} - Download promise
   */
  async export(filename = 'Presentation.pptx') {
    return this.pptx.writeFile({ fileName: filename });
  }

  // Utility methods
  _parseRatioToPPT(ratio) {
    const [left, right] = ratio.split(':').map(Number);
    return [left, right];
  }

  _getLogoX(position) {
    const positions = {
      'top-left': 0.5,
      'top-right': 9.0,
      'bottom-left': 0.5,
      'bottom-right': 9.0
    };
    return positions[position] || 0.5;
  }

  _getLogoY(position) {
    const positions = {
      'top-left': 0.25,
      'top-right': 0.25,
      'bottom-left': 5.0,
      'bottom-right': 5.0
    };
    return positions[position] || 0.25;
  }
}
```

---

## 7. PowerPoint Export Engine

### PPTExporter.js (Main Export Controller)

```javascript
/**
 * PPTExporter - Main export controller
 * Orchestrates the PowerPoint export process
 */
class PPTExporter {
  constructor(presentationData) {
    this.presentationData = presentationData;
    this.renderer = null;
  }

  /**
   * Export presentation to PowerPoint
   * @param {String} filename - Output filename
   * @returns {Promise} - Export promise
   */
  async exportToPowerPoint(filename = 'Presentation.pptx') {
    try {
      // Validate data
      this._validateData();

      // Create renderer
      this.renderer = new PPTRenderer(
        this.presentationData,
        this.presentationData.theme
      );

      // Render all slides
      const pptx = this.renderer.renderPresentation();

      // Export to file
      await pptx.writeFile({ fileName: filename });

      console.log(`✅ Presentation exported: ${filename}`);
      return { success: true, filename };

    } catch (error) {
      console.error('❌ Export failed:', error);
      throw new Error(`PowerPoint export failed: ${error.message}`);
    }
  }

  /**
   * Validate presentation data
   * @private
   */
  _validateData() {
    if (!this.presentationData) {
      throw new Error('No presentation data provided');
    }

    if (!this.presentationData.slides || this.presentationData.slides.length === 0) {
      throw new Error('No slides found in presentation data');
    }

    if (!this.presentationData.theme) {
      throw new Error('No theme found in presentation data');
    }

    // Validate each slide
    this.presentationData.slides.forEach((slide, index) => {
      if (!slide.type) {
        throw new Error(`Slide ${index + 1}: Missing slide type`);
      }

      if (!slide.content) {
        throw new Error(`Slide ${index + 1}: Missing slide content`);
      }
    });
  }

  /**
   * Get export progress (for async exports)
   * @returns {Number} - Progress percentage
   */
  getProgress() {
    // For future implementation: track rendering progress
    return 100;
  }

  /**
   * Cancel export (for async exports)
   */
  cancel() {
    // For future implementation: cancel rendering
  }
}
```

---

## 8. Web Viewer Integration

### Updated PresentationSlides.js

```javascript
/**
 * Modern Presentation Viewer Module (Updated)
 * Now consumes structured slide data and uses WebRenderer
 */
import { CONFIG } from './config.js';
import { WebRenderer } from './WebRenderer.js';
import { PPTExporter } from './PPTExporter.js';

export class PresentationSlides {
  constructor(slidesData, footerSVG) {
    // slidesData is now the full structured presentation object
    this.presentationData = slidesData;
    this.footerSVG = footerSVG;
    this.currentSlideIndex = 0;
    this.container = null;
    this.isGridView = false;
    this.isFullscreen = false;
    this.isSidebarVisible = true;
    this.shortcutsOverlayVisible = false;

    // Create renderer
    this.renderer = new WebRenderer(
      this.presentationData,
      this.presentationData.theme
    );

    // Keyboard shortcuts binding
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  // ... existing viewer methods remain ...

  /**
   * Builds slide content using WebRenderer
   * @private
   */
  _buildSlideContent(index) {
    const slideData = this.presentationData.slides[index];

    // Use WebRenderer to create slide element
    const slideElement = this.renderer.renderSlide(slideData);
    slideElement.id = 'slideContent';

    return slideElement;
  }

  /**
   * Export to PowerPoint
   * NEW METHOD
   */
  async exportToPowerPoint() {
    try {
      // Show loading state
      this._showExportLoading();

      // Create exporter
      const exporter = new PPTExporter(this.presentationData);

      // Generate filename
      const filename = `${this.presentationData.metadata.title || 'Presentation'}.pptx`;

      // Export
      await exporter.exportToPowerPoint(filename);

      // Hide loading state
      this._hideExportLoading();

      // Show success message
      this._showExportSuccess(filename);

    } catch (error) {
      console.error('Export failed:', error);
      this._showExportError(error.message);
    }
  }

  /**
   * Add export button to top bar
   * @private
   */
  _buildTopBar() {
    // ... existing top bar code ...

    // Add PowerPoint export button
    const exportBtn = this._createButton('', '📥', 'Export PPT', () => this.exportToPowerPoint());
    exportBtn.id = 'exportPPTBtn';

    rightSide.appendChild(exportBtn);

    // ... rest of top bar code ...
  }

  // Export UI helper methods
  _showExportLoading() {
    // Show loading spinner/modal
  }

  _hideExportLoading() {
    // Hide loading spinner/modal
  }

  _showExportSuccess(filename) {
    // Show success toast notification
  }

  _showExportError(message) {
    // Show error toast notification
  }
}
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Establish core data model and basic rendering

#### Tasks:
1. **Data Model** (2 days)
   - [ ] Define complete data structure (JSON schema)
   - [ ] Create TypeScript definitions (JSDoc)
   - [ ] Build validation functions
   - [ ] Create sample data for testing

2. **WebRenderer** (2 days)
   - [ ] Create WebRenderer.js class
   - [ ] Implement title slide rendering
   - [ ] Implement bullets slide rendering
   - [ ] Implement two-column slide rendering
   - [ ] Add theme application logic

3. **PPTRenderer** (3 days)
   - [ ] Create PPTRenderer.js class
   - [ ] Configure PptxGenJS settings
   - [ ] Implement title slide export
   - [ ] Implement bullets slide export
   - [ ] Implement two-column slide export
   - [ ] Test export accuracy

**Deliverables**:
- ✅ Data model JSON schema
- ✅ WebRenderer with 3 slide types
- ✅ PPTRenderer with 3 slide types
- ✅ Basic export functionality

---

### Phase 2: Slide Type Library (Week 2)
**Goal**: Implement remaining slide types

#### Tasks:
1. **Image Slides** (1 day)
   - [ ] Web rendering
   - [ ] PPT export
   - [ ] Image handling (base64, URLs)

2. **Section Slides** (1 day)
   - [ ] Web rendering
   - [ ] PPT export
   - [ ] Background styling

3. **Quote Slides** (1 day)
   - [ ] Web rendering
   - [ ] PPT export
   - [ ] Decorative elements

4. **Table Slides** (1 day)
   - [ ] Web rendering
   - [ ] PPT export
   - [ ] Table formatting

5. **Comparison Slides** (1 day)
   - [ ] Web rendering
   - [ ] PPT export
   - [ ] Multi-column layout

**Deliverables**:
- ✅ All 8 slide types implemented
- ✅ Web + PPT rendering for each type
- ✅ Comprehensive slide library

---

### Phase 3: Viewer Integration (Week 3)
**Goal**: Integrate new architecture with existing viewer

#### Tasks:
1. **Update PresentationSlides.js** (2 days)
   - [ ] Consume structured data
   - [ ] Use WebRenderer for display
   - [ ] Add export button
   - [ ] Update thumbnail generation

2. **Export UI** (1 day)
   - [ ] Export button in top bar
   - [ ] Loading state modal
   - [ ] Success/error notifications
   - [ ] Export options (filename, format)

3. **Backend Updates** (2 days)
   - [ ] Update AI prompts to generate structured data
   - [ ] Update JSON schema validation
   - [ ] Test AI-generated slides
   - [ ] Fix any formatting issues

**Deliverables**:
- ✅ Integrated viewer with export
- ✅ Updated AI generation
- ✅ End-to-end working system

---

### Phase 4: Polish & Testing (Week 4)
**Goal**: Ensure quality and accuracy

#### Tasks:
1. **Export Accuracy** (2 days)
   - [ ] Test all slide types
   - [ ] Verify formatting preservation
   - [ ] Test with PowerPoint desktop app
   - [ ] Test with PowerPoint Online
   - [ ] Fix any rendering issues

2. **Web Viewer Polish** (1 day)
   - [ ] Refine slide templates
   - [ ] Add animations (optional)
   - [ ] Responsive design fixes
   - [ ] Accessibility improvements

3. **Documentation** (2 days)
   - [ ] Data model documentation
   - [ ] Slide type guide
   - [ ] Export guide
   - [ ] Developer documentation
   - [ ] User documentation

**Deliverables**:
- ✅ Pixel-perfect exports
- ✅ Polished web viewer
- ✅ Complete documentation
- ✅ Production-ready system

---

## 10. Testing Strategy

### Unit Tests

```javascript
// WebRenderer.test.js
describe('WebRenderer', () => {
  describe('renderTitleSlide', () => {
    it('should render title with correct text', () => {
      const slideData = {
        type: 'title',
        content: {
          title: { text: 'Test Title', alignment: 'center' },
          subtitle: { text: 'Test Subtitle', alignment: 'center' }
        }
      };

      const renderer = new WebRenderer(samplePresentation, sampleTheme);
      const element = renderer.renderSlide(slideData);

      expect(element.querySelector('.slide-title').textContent).toBe('Test Title');
      expect(element.querySelector('.slide-subtitle').textContent).toBe('Test Subtitle');
    });

    it('should apply theme colors', () => {
      // Test theme application
    });
  });
});

// PPTRenderer.test.js
describe('PPTRenderer', () => {
  describe('renderTitleSlide', () => {
    it('should create slide with correct text', () => {
      const slideData = {
        type: 'title',
        content: {
          title: { text: 'Test Title', alignment: 'center' },
          subtitle: { text: 'Test Subtitle', alignment: 'center' }
        }
      };

      const renderer = new PPTRenderer(samplePresentation, sampleTheme);
      const pptx = renderer.renderPresentation();

      // Verify slide was created
      expect(pptx.slides.length).toBe(1);
    });
  });
});
```

### Integration Tests

```javascript
describe('End-to-End Export', () => {
  it('should export complete presentation', async () => {
    const exporter = new PPTExporter(samplePresentation);
    const result = await exporter.exportToPowerPoint('test.pptx');

    expect(result.success).toBe(true);
    expect(result.filename).toBe('test.pptx');
  });

  it('should preserve formatting', async () => {
    // Test formatting preservation
  });
});
```

### Visual Regression Tests

```javascript
describe('Visual Regression', () => {
  it('should match web snapshot', () => {
    // Compare rendered HTML to baseline
  });

  it('should match PPT snapshot', () => {
    // Compare exported PPTX to baseline
  });
});
```

### Manual Testing Checklist

- [ ] Export all slide types
- [ ] Open in PowerPoint Desktop (Windows)
- [ ] Open in PowerPoint Desktop (Mac)
- [ ] Open in PowerPoint Online
- [ ] Open in Google Slides (import)
- [ ] Verify text formatting
- [ ] Verify colors
- [ ] Verify images
- [ ] Verify tables
- [ ] Verify bullets/numbering
- [ ] Verify slide numbers
- [ ] Verify speaker notes
- [ ] Verify branding (logo, footer)

---

## 11. Migration Path

### Backward Compatibility

```javascript
/**
 * Migrate old slide data to new structured format
 */
function migrateOldSlideData(oldData) {
  return {
    metadata: {
      title: 'Untitled Presentation',
      author: 'AI Roadmap Generator',
      company: 'BIP',
      date: new Date().toISOString(),
      version: '1.0',
      slideCount: oldData.slides.length
    },
    theme: DEFAULT_THEME,
    slides: oldData.slides.map(oldSlide => migrateSlide(oldSlide))
  };
}

function migrateSlide(oldSlide) {
  // Convert old format to new format
  switch(oldSlide.type) {
    case 'title':
      return {
        id: generateId(),
        type: 'title',
        layout: { name: 'Title Slide', variant: 'default' },
        content: {
          title: {
            text: oldSlide.title || '',
            alignment: 'center',
            verticalAlign: 'middle'
          },
          subtitle: {
            text: oldSlide.subtitle || '',
            alignment: 'center'
          }
        },
        notes: ''
      };

    // ... other slide type migrations
  }
}
```

### Deployment Strategy

1. **Phase 1**: Deploy alongside existing system
   - New code doesn't break old functionality
   - Feature flag for new export

2. **Phase 2**: Gradual migration
   - Update AI to generate new format
   - Old data auto-migrates on load
   - Both formats supported

3. **Phase 3**: Full switchover
   - All new presentations use new format
   - Legacy support remains
   - Export available for all

4. **Phase 4**: Deprecate old format
   - After 3 months of stability
   - Migration utility for old data
   - Remove legacy code

---

## 12. Success Criteria

### Functional Requirements
- ✅ **Export Accuracy**: 100% of slide types export correctly
- ✅ **Formatting Preservation**: 95%+ visual accuracy in PowerPoint
- ✅ **Performance**: Export completes in <5 seconds for 20-slide deck
- ✅ **Reliability**: 99%+ success rate on exports
- ✅ **Compatibility**: Works in PowerPoint 2016+, PowerPoint Online, Google Slides

### Quality Requirements
- ✅ **Code Coverage**: 80%+ unit test coverage
- ✅ **Documentation**: Complete JSDoc for all public methods
- ✅ **Type Safety**: TypeScript definitions for all data structures
- ✅ **Accessibility**: WCAG 2.1 AA compliance for web viewer
- ✅ **Performance**: Web viewer loads in <2 seconds

### User Experience Requirements
- ✅ **Export UI**: Clear, intuitive export flow
- ✅ **Error Handling**: Graceful errors with helpful messages
- ✅ **Loading States**: Progress feedback during export
- ✅ **Success Feedback**: Clear confirmation of export
- ✅ **Web Viewer**: No degradation from current viewer

---

## Appendix A: Sample Data

```javascript
const SAMPLE_PRESENTATION = {
  metadata: {
    title: 'Q4 2025 Strategic Roadmap',
    author: 'AI Roadmap Generator',
    company: 'BIP Company',
    date: '2025-11-22',
    version: '1.0',
    slideCount: 5
  },

  theme: {
    aspectRatio: '16:9',
    width: 10,
    height: 5.625,
    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#10b981',
      background: '#ffffff',
      text: {
        primary: '#1f2937',
        secondary: '#6b7280',
        muted: '#9ca3af'
      }
    },
    fonts: {
      title: {
        family: 'Work Sans',
        size: 44,
        weight: 700,
        color: '#1f2937'
      },
      body: {
        family: 'Work Sans',
        size: 18,
        weight: 400,
        color: '#1f2937'
      }
    },
    // ... rest of theme
  },

  slides: [
    {
      id: 'slide-001',
      type: 'title',
      layout: { name: 'Title Slide', variant: 'default' },
      content: {
        title: {
          text: 'Q4 2025 Strategic Roadmap',
          alignment: 'center',
          verticalAlign: 'middle'
        },
        subtitle: {
          text: 'Executive Intelligence Brief',
          alignment: 'center'
        },
        accent: {
          type: 'line',
          color: '#3b82f6',
          height: 0.05,
          position: 'below-title'
        }
      },
      notes: 'Opening slide for Q4 roadmap presentation.'
    },

    {
      id: 'slide-002',
      type: 'bullets',
      layout: { name: 'Content', variant: 'bullets' },
      content: {
        title: {
          text: 'Key Strategic Initiatives',
          alignment: 'left'
        },
        bullets: [
          {
            text: 'Digital Transformation Program',
            level: 1,
            bullet: 'number',
            bold: true
          },
          {
            text: 'Cloud migration completed Q3',
            level: 2,
            bullet: 'bullet'
          },
          {
            text: 'AI integration roadmap finalized',
            level: 2,
            bullet: 'bullet'
          },
          {
            text: 'Customer Experience Enhancement',
            level: 1,
            bullet: 'number',
            bold: true
          },
          {
            text: 'Mobile app redesign launch',
            level: 2,
            bullet: 'bullet'
          }
        ]
      },
      notes: 'Overview of major initiatives for Q4.'
    }

    // ... more slides
  ]
};
```

---

## Appendix B: File Structure

```
Public/
├── PresentationSlides.js         (Updated: Main viewer)
├── presentation-viewer.css       (Existing: Viewer styles)
├── WebRenderer.js                (NEW: Web slide renderer)
├── PPTRenderer.js                (NEW: PowerPoint renderer)
├── PPTExporter.js                (NEW: Export controller)
├── SlideDataModel.js             (NEW: Data validation)
└── presentation-config.js        (NEW: Theme defaults)

server/
└── prompts.js                    (Updated: AI slide generation)

Documentation/
└── PPT_EXPORT_IMPLEMENTATION_PLAN.md  (This file)
```

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Approve data model** structure
3. **Begin Phase 1** implementation
4. **Set up testing infrastructure**
5. **Create sample presentations** for testing

---

**End of Implementation Plan**
