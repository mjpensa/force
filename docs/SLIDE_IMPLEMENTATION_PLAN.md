# BIP PowerPoint Template - Detailed Implementation Plan

## Overview

This document provides a detailed implementation plan for all **35 slides** in the BIP branded PowerPoint template. Each slide type includes specifications for layout, positioning, typography, colors, and implementation approach using pptxgenjs.

---

## Brand Standards

### Colors
| Name | Hex | Usage |
|------|-----|-------|
| Navy | `#0C2340` | Primary backgrounds, headings |
| Red | `#DA291C` | Accents, bullets, highlights |
| White | `#FFFFFF` | Text on dark backgrounds |
| Light Gray | `#E8E8E8` | Alternative backgrounds |
| Dark Gray | `#6B7280` | Secondary text, page numbers |

### Typography (Work Sans Family)
| Weight | Usage | Fallback |
|--------|-------|----------|
| Thin (100) | Large watermark numbers, decorative | Arial |
| Light (300) | Main titles (48-54pt) | Arial |
| Regular (400) | Body text, bullets (10-14pt) | Arial |
| Medium (500) | Taglines, labels | Arial |
| SemiBold (600) | Section labels, emphasis | Arial |

### Slide Dimensions
- Width: 13.33 inches (16:9 widescreen)
- Height: 7.5 inches
- EMU conversion: 914400 EMUs = 1 inch

---

## SECTION 1: TITLE SLIDES (Slides 1-4)

### Slide 1: Title Slide with Banner Pattern
**Type:** `title`
**Background:** Navy (#0C2340)

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Banner Pattern | 0, 0 | 13.33" x 2.3" | - | - | Image placeholder |
| Date | 0.23", 2.7" | 4.74" x 0.4" | Work Sans Light | 18pt | White |
| Title | 0.23", 3.3" | 8.5" x 2.5" | Work Sans Light | 54pt | White |
| Logo | 0.29", 6.78" | 0.69" x 0.48" | - | - | Image placeholder |
| Tagline | 10.5", 7.0" | 2.5" x 0.3" | Work Sans Medium | 14pt | White |

#### Implementation:
```javascript
function addTitleSlide(pptx, data) {
  const slide = pptx.addSlide({ masterName: 'CUSTOM_16_9' });
  slide.bkgd = COLORS.navy;

  // Banner placeholder (geometric pattern)
  slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 2.3, fill: { color: '1a3a5c' } });

  // Date
  slide.addText(data.date || 'Month/Year', {
    x: 0.23, y: 2.7, w: 4.74, h: 0.4,
    fontSize: 18, fontFace: 'Work Sans Light', color: 'FFFFFF'
  });

  // Title
  slide.addText(data.title, {
    x: 0.23, y: 3.3, w: 8.5, h: 2.5,
    fontSize: 54, fontFace: 'Work Sans Light', color: 'FFFFFF',
    lineSpacingMultiple: 0.8
  });

  // Logo placeholder
  addLogoPlaceholder(slide, 0.29, 6.78, 'medium');

  // Tagline
  slide.addText('Here to Dare.', {
    x: 10.5, y: 7.0, w: 2.5, h: 0.3,
    fontSize: 14, fontFace: 'Work Sans Medium', color: 'FFFFFF', align: 'right'
  });
}
```

---

### Slide 2: Title with Image (Split Layout)
**Type:** `titleWithImage`
**Background:** Navy (left) / Image (right)

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Left Panel | 0, 0 | 5.22" x 7.5" | - | - | Navy fill |
| Tagline | 0.18", 0.36" | 4.74" x 0.34" | Work Sans SemiBold | 16pt | White |
| Title | 0.23", 1.1" | 4.74" x 1.46" | Work Sans Light | 54pt | White |
| Logo | 0.29", 6.78" | 0.69" x 0.48" | - | - | Image |
| Business Area | 1.39", 6.78" | 1.38" x 0.48" | Work Sans Regular | 16pt | White |
| Date | 3.08", 6.78" | 1.38" x 0.48" | Work Sans Regular | 16pt | White |
| Image | 5.21", 0 | 8.17" x 7.5" | - | - | Image placeholder |

#### Implementation:
```javascript
function addTitleWithImageSlide(pptx, data) {
  const slide = pptx.addSlide();

  // Left navy panel
  slide.addShape('rect', { x: 0, y: 0, w: 5.22, h: 7.5, fill: { color: COLORS.navy } });

  // Tagline
  slide.addText(data.tagline || 'TAGLINE', {
    x: 0.18, y: 0.36, w: 4.74, h: 0.34,
    fontSize: 16, fontFace: 'Work Sans SemiBold', color: 'FFFFFF'
  });

  // Title
  slide.addText(data.title, {
    x: 0.23, y: 1.1, w: 4.74, h: 1.46,
    fontSize: 54, fontFace: 'Work Sans Light', color: 'FFFFFF'
  });

  // Footer elements
  addLogoPlaceholder(slide, 0.29, 6.78, 'small');
  slide.addText(data.businessArea || 'Business Area', {
    x: 1.39, y: 6.78, w: 1.38, h: 0.48, fontSize: 16, color: 'FFFFFF'
  });
  slide.addText(data.date || 'Month Year', {
    x: 3.08, y: 6.78, w: 1.38, h: 0.48, fontSize: 16, color: 'FFFFFF'
  });

  // Right image placeholder
  slide.addShape('rect', { x: 5.21, y: 0, w: 8.17, h: 7.5, fill: { color: '4A5568' } });
  if (data.image) {
    slide.addImage({ path: data.image, x: 5.21, y: 0, w: 8.17, h: 7.5 });
  }
}
```

---

### Slide 3: Title Slide with Geometric Pattern (Variant A)
**Type:** `titleVariantA`
**Background:** Navy (#0C2340)

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Geometric Pattern | 0, 0 | Full width stripe | - | - | SVG/Image |
| Title | 0.5", 3.0" | 12" x 2" | Work Sans Light | 48pt | White |
| Date | 0.5", 5.5" | 4" x 0.5" | Work Sans Regular | 14pt | White |
| Logo | 12", 6.78" | 1" x 0.5" | - | - | Image |

#### Implementation Notes:
- Uses diagonal stripe pattern across top
- Title centered vertically
- Subtle animation-ready positioning

---

### Slide 4: Title Slide with Geometric Pattern (Variant B)
**Type:** `titleVariantB`
**Background:** Navy (#0C2340)

#### Elements:
- Similar to Slide 3 with different geometric accent placement
- Title positioned lower
- Date/subtitle in upper area

---

## SECTION 2: TABLE OF CONTENTS / NAVIGATION (Slides 5-6)

### Slide 5: Interactive Contents with Section Preview
**Type:** `contentsNav`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| "Contents" Title | 0.5", 0.3" | 3" x 0.8" | Work Sans Light | 36pt | Navy |
| Section Items (Left) | 0.5", 1.5" | 5" x 5.5" | Work Sans Regular | 14pt | Navy |
| Preview Area (Right) | 6", 1" | 7" x 6" | - | - | Light gray bg |
| Section Number | 6.5", 1.5" | 1" x 1" | Work Sans Thin | 72pt | Navy |
| Section Title | 7.5", 2" | 5" x 1" | Work Sans Light | 24pt | Navy |

#### Implementation:
```javascript
function addContentsNavSlide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = 'FFFFFF';

  // Contents title
  slide.addText('Contents', {
    x: 0.5, y: 0.3, w: 3, h: 0.8,
    fontSize: 36, fontFace: 'Work Sans Light', color: COLORS.navy
  });

  // Section items
  data.sections.forEach((section, i) => {
    slide.addText(`${section.number} ${section.title}`, {
      x: 0.5, y: 1.5 + (i * 0.6), w: 5, h: 0.5,
      fontSize: 14, fontFace: 'Work Sans Regular', color: COLORS.navy
    });
  });

  // Preview area
  slide.addShape('rect', { x: 6, y: 1, w: 7, h: 6, fill: { color: COLORS.lightGray } });
}
```

---

### Slide 6: Table of Contents (Numbered List)
**Type:** `tableOfContents`
**Background:** Light Gray (#E8E8E8)

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Logo (Top) | 0.33", 0.33" | 0.69" x 0.48" | - | - | Image |
| "Table of Contents" Watermark | 0.33", 3.0" | 6" x 4" | Work Sans Thin | 72pt | Navy |
| TOC Items | 7.5", 0.8" | 5.5" x 6" | Work Sans Regular | 14pt | Navy |
| Item Numbers | 7.5", 0.8" | 0.5" x 0.4" | Work Sans SemiBold | 14pt | Red |
| Logo (Bottom) | 12.5", 7.0" | 0.69" x 0.35" | - | - | Image |

#### Implementation:
```javascript
function addTableOfContentsSlide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = COLORS.lightGray;

  // Logo top
  addLogoPlaceholder(slide, 0.33, 0.33, 'medium');

  // Large watermark text
  slide.addText('Table of\nContents', {
    x: 0.33, y: 3.0, w: 6, h: 4,
    fontSize: 72, fontFace: 'Work Sans Thin', color: COLORS.navy,
    valign: 'bottom', lineSpacingMultiple: 0.75
  });

  // TOC items
  data.items.forEach((item, i) => {
    const y = 0.8 + (i * 0.6);
    // Number
    slide.addText(`${i + 1}`, {
      x: 7.5, y, w: 0.5, h: 0.4,
      fontSize: 14, fontFace: 'Work Sans SemiBold', color: COLORS.red
    });
    // Title
    slide.addText(item, {
      x: 8.1, y, w: 4.9, h: 0.4,
      fontSize: 14, fontFace: 'Work Sans Regular', color: COLORS.navy
    });
  });

  // Logo bottom
  addLogoPlaceholder(slide, 12.5, 7.0, 'small');
}
```

---

## SECTION 3: CONTENT SLIDES (Slides 7-12)

### Slide 7: Content with Left Title + Right Bullets
**Type:** `bullets`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Section Label | 0.33", 0.17" | 3" x 0.25" | Work Sans SemiBold | 10pt | Red |
| Title | 0.33", 0.42" | 5.5" x 1.5" | Work Sans Light | 32pt | Navy |
| Intro Text | 0.33", 2.0" | 5.5" x 1.5" | Work Sans Regular | 11pt | Navy |
| Bullets | 6.5", 1.5" | 6.5" x 5" | Work Sans Regular | 11pt | Navy |
| Geometric Accent | 11.33", 0 | 2" x 1.5" | - | - | Image |
| Page Number | 0.33", 7.15" | 0.5" x 0.2" | Work Sans Regular | 8pt | Dark Gray |
| Logo | 12.5", 7.0" | 0.69" x 0.35" | - | - | Image |

#### Implementation:
```javascript
function addBulletsSlide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = 'FFFFFF';

  // Section label
  slide.addText(data.section || 'SECTION', {
    x: 0.33, y: 0.17, w: 3, h: 0.25,
    fontSize: 10, fontFace: 'Work Sans SemiBold', color: COLORS.red
  });

  // Title
  slide.addText(data.title, {
    x: 0.33, y: 0.42, w: 5.5, h: 1.5,
    fontSize: 32, fontFace: 'Work Sans Light', color: COLORS.navy
  });

  // Intro
  if (data.intro) {
    slide.addText(data.intro, {
      x: 0.33, y: 2.0, w: 5.5, h: 1.5,
      fontSize: 11, fontFace: 'Work Sans Regular', color: COLORS.navy,
      lineSpacingMultiple: 1.4
    });
  }

  // Bullets
  const bulletItems = data.bullets.map(b => ({ text: b, options: { bullet: { color: COLORS.red } } }));
  slide.addText(bulletItems, {
    x: 6.5, y: 1.5, w: 6.5, h: 5,
    fontSize: 11, fontFace: 'Work Sans Regular', color: COLORS.navy,
    lineSpacingMultiple: 1.8
  });

  // Geometric accent placeholder
  slide.addShape('rect', { x: 11.33, y: 0, w: 2, h: 1.5, fill: { color: '4A5568' } });

  // Page number & logo
  slide.addText(data.pageNumber?.toString() || '', {
    x: 0.33, y: 7.15, w: 0.5, h: 0.2,
    fontSize: 8, fontFace: 'Work Sans Regular', color: COLORS.darkGray
  });
  addLogoPlaceholder(slide, 12.5, 7.0, 'small');
}
```

---

### Slide 8: Content with Title + Multi-Column Text
**Type:** `contentMultiColumn`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Section Label | 0.33", 0.17" | 3" x 0.25" | Work Sans SemiBold | 10pt | Red |
| Title | 0.33", 0.5" | 4.5" x 2.5" | Work Sans Thin | 48pt | Navy |
| Content (2 cols) | 5.5", 1.5" | 7.5" x 5" | Work Sans Regular | 10pt | Navy |
| Page Number | 0.33", 7.15" | 0.5" x 0.2" | Work Sans Regular | 8pt | Dark Gray |
| Logo | 12.5", 7.0" | 0.69" x 0.35" | - | - | Image |

---

### Slide 9: Content with Full-Width Bullets
**Type:** `bulletsFull`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Section Label | 0.33", 0.17" | 3" x 0.25" | Work Sans SemiBold | 10pt | Red |
| Title | 0.33", 0.42" | 12" x 1" | Work Sans Light | 32pt | Navy |
| Bullets (full width) | 0.33", 2.0" | 12.5" x 4.5" | Work Sans Regular | 11pt | Navy |
| Accent Shape | 11.33", 0 | 2" x 1.5" | - | - | Red shape |

---

### Slide 10: Quote Slide with Side Pattern
**Type:** `quote`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Geometric Pattern | 0, 0 | 3.5" x 7.5" | - | - | Image/SVG |
| Section Label | 4.0", 0.5" | 3" x 0.25" | Work Sans SemiBold | 10pt | Red |
| Quote Title | 4.0", 0.8" | 8.5" x 1.2" | Work Sans Light | 28pt | Navy |
| Quote Text | 4.0", 2.5" | 8.5" x 3.5" | Work Sans Regular | 14pt | Navy |
| Red Border Line | 3.9", 2.5" | 0.05" x 2" | - | - | Red (#DA291C) |
| Attribution | 4.0", 6.0" | 4" x 0.5" | Work Sans SemiBold | 12pt | Navy |
| Logo | 12.5", 7.0" | 0.69" x 0.35" | - | - | Image |

#### Implementation:
```javascript
function addQuoteSlide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = 'FFFFFF';

  // Geometric pattern placeholder (left side)
  slide.addShape('rect', { x: 0, y: 0, w: 3.5, h: 7.5, fill: { color: '4A5568' } });

  // Section label
  slide.addText(data.section || 'QUOTE', {
    x: 4.0, y: 0.5, w: 3, h: 0.25,
    fontSize: 10, fontFace: 'Work Sans SemiBold', color: COLORS.red
  });

  // Quote title
  if (data.title) {
    slide.addText(data.title, {
      x: 4.0, y: 0.8, w: 8.5, h: 1.2,
      fontSize: 28, fontFace: 'Work Sans Light', color: COLORS.navy
    });
  }

  // Red accent line
  slide.addShape('rect', {
    x: 3.9, y: 2.5, w: 0.05, h: 2,
    fill: { color: COLORS.red }
  });

  // Quote text (italic)
  slide.addText(data.quote, {
    x: 4.0, y: 2.5, w: 8.5, h: 3.5,
    fontSize: 14, fontFace: 'Work Sans Regular', color: COLORS.navy,
    italic: true, lineSpacingMultiple: 1.8
  });

  // Attribution
  if (data.attribution) {
    slide.addText(`— ${data.attribution}`, {
      x: 4.0, y: 6.0, w: 4, h: 0.5,
      fontSize: 12, fontFace: 'Work Sans SemiBold', color: COLORS.navy
    });
  }

  addLogoPlaceholder(slide, 12.5, 7.0, 'small');
}
```

---

### Slide 11: Card Grid Layout (3x3)
**Type:** `cardGrid`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Title Row 1 | 0.5", 0.5" | 12.5" x 0.5" | Work Sans Light | 18pt | Navy |
| Cards Row 1 | 0.5", 1.2" | 4"x1.8" each | - | - | Light gray bg |
| Cards Row 2 | 0.5", 3.2" | 4"x1.8" each | - | - | Light gray bg |
| Cards Row 3 | 0.5", 5.2" | 4"x1.8" each | - | - | Light gray bg |
| Section Label | Bottom left | - | Work Sans SemiBold | 10pt | Red |

#### Implementation:
```javascript
function addCardGridSlide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = 'FFFFFF';

  const cardWidth = 4;
  const cardHeight = 1.8;
  const gap = 0.2;
  const startX = 0.5;
  const startY = 1.2;

  data.cards.forEach((card, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = startX + (col * (cardWidth + gap));
    const y = startY + (row * (cardHeight + gap + 0.2));

    // Card background
    slide.addShape('rect', {
      x, y, w: cardWidth, h: cardHeight,
      fill: { color: COLORS.lightGray }
    });

    // Card title
    slide.addText(card.title, {
      x: x + 0.2, y: y + 0.2, w: cardWidth - 0.4, h: 0.4,
      fontSize: 14, fontFace: 'Work Sans SemiBold', color: COLORS.navy
    });

    // Card content
    slide.addText(card.content, {
      x: x + 0.2, y: y + 0.6, w: cardWidth - 0.4, h: 1,
      fontSize: 10, fontFace: 'Work Sans Regular', color: COLORS.navy
    });
  });
}
```

---

### Slide 12: Content with Image Placeholder
**Type:** `contentWithImage`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Title | 0.5", 0.5" | 6" x 1" | Work Sans Light | 32pt | Navy |
| Content | 0.5", 1.8" | 6" x 4.5" | Work Sans Regular | 11pt | Navy |
| Image Placeholder | 7", 1" | 5.5" x 5.5" | - | - | Gray placeholder |

---

## SECTION 4: GRID / FEATURE SLIDES (Slides 13-14)

### Slide 13: Icon Feature Grid (White Background)
**Type:** `featureGridWhite`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Title Row | 0.5", 0.5" | 12" x 0.8" | Work Sans Light | 28pt | Navy |
| Feature 1-5 | Grid layout | 2.4"x2.2" each | - | - | See below |
| Icon Circle | Center top | 0.8" diameter | - | - | Red/Navy |
| Feature Title | Below icon | 2" x 0.4" | Work Sans SemiBold | 12pt | Navy |
| Feature Desc | Below title | 2" x 1.2" | Work Sans Regular | 10pt | Dark Gray |

#### Implementation:
```javascript
function addFeatureGridSlide(pptx, data, variant = 'white') {
  const slide = pptx.addSlide();
  slide.bkgd = variant === 'white' ? 'FFFFFF' : COLORS.red;
  const textColor = variant === 'white' ? COLORS.navy : 'FFFFFF';

  // Title
  slide.addText(data.title, {
    x: 0.5, y: 0.3, w: 12, h: 0.8,
    fontSize: 28, fontFace: 'Work Sans Light', color: textColor
  });

  const featureWidth = 2.4;
  const featureHeight = 2.2;
  const gap = 0.3;
  const startX = 0.5;
  const startY = 1.5;

  data.features.forEach((feature, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = startX + (col * (featureWidth + gap));
    const y = startY + (row * (featureHeight + 0.5));

    // Icon circle placeholder
    slide.addShape('ellipse', {
      x: x + (featureWidth - 0.8) / 2,
      y: y,
      w: 0.8, h: 0.8,
      fill: { color: variant === 'white' ? COLORS.navy : 'FFFFFF' }
    });

    // Feature title
    slide.addText(feature.title, {
      x, y: y + 1, w: featureWidth, h: 0.4,
      fontSize: 12, fontFace: 'Work Sans SemiBold', color: textColor, align: 'center'
    });

    // Feature description
    slide.addText(feature.description, {
      x, y: y + 1.4, w: featureWidth, h: 1.2,
      fontSize: 10, fontFace: 'Work Sans Regular',
      color: variant === 'white' ? COLORS.darkGray : 'FFFFFF',
      align: 'center'
    });
  });
}
```

---

### Slide 14: Icon Feature Grid (Red Background)
**Type:** `featureGridRed`
**Background:** Red (#DA291C)

Same structure as Slide 13 but with:
- White text instead of navy
- White icon circles with red icons
- Red background fill

---

## SECTION 5: PROCESS / TIMELINE SLIDES (Slides 15, 27-31)

### Slide 15: Timeline with Numbered Steps (Horizontal)
**Type:** `timelineNumbered`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Title | 0.5", 0.3" | 12" x 0.8" | Work Sans Light | 28pt | Navy |
| Description | 0.5", 1.2" | 12" x 1" | Work Sans Regular | 11pt | Navy |
| Step Numbers | Horizontal row | 1"x1" circles | Work Sans Bold | 24pt | White on Red |
| Step Titles | Below numbers | 2"x0.5" | Work Sans SemiBold | 12pt | Navy |
| Connecting Lines | Between circles | - | - | Red (#DA291C) |

#### Implementation:
```javascript
function addTimelineNumberedSlide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = 'FFFFFF';

  // Title
  slide.addText(data.title, {
    x: 0.5, y: 0.3, w: 12, h: 0.8,
    fontSize: 28, fontFace: 'Work Sans Light', color: COLORS.navy
  });

  // Description
  slide.addText(data.description, {
    x: 0.5, y: 1.2, w: 12, h: 1,
    fontSize: 11, fontFace: 'Work Sans Regular', color: COLORS.navy
  });

  const steps = data.steps;
  const stepWidth = 12 / steps.length;
  const startY = 3.5;

  steps.forEach((step, i) => {
    const x = 0.5 + (i * stepWidth) + (stepWidth / 2) - 0.5;

    // Number circle
    slide.addShape('ellipse', {
      x, y: startY, w: 1, h: 1,
      fill: { color: COLORS.red }
    });

    // Number text
    slide.addText((i + 1).toString(), {
      x, y: startY + 0.25, w: 1, h: 0.5,
      fontSize: 24, fontFace: 'Work Sans Bold', color: 'FFFFFF', align: 'center'
    });

    // Connecting line
    if (i < steps.length - 1) {
      slide.addShape('line', {
        x: x + 1, y: startY + 0.5,
        w: stepWidth - 1, h: 0,
        line: { color: COLORS.red, width: 2 }
      });
    }

    // Step title
    slide.addText(step.title, {
      x: x - 0.5, y: startY + 1.3, w: 2, h: 0.5,
      fontSize: 12, fontFace: 'Work Sans SemiBold', color: COLORS.navy, align: 'center'
    });

    // Step description
    slide.addText(step.description, {
      x: x - 0.5, y: startY + 1.8, w: 2, h: 1.5,
      fontSize: 10, fontFace: 'Work Sans Regular', color: COLORS.darkGray, align: 'center'
    });
  });
}
```

---

### Slide 27: Horizontal Process Steps (5 Steps)
**Type:** `processSteps5`
**Background:** Navy (#0C2340)

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Step 1-5 Boxes | Horizontal | 2.4"x2.5" each | - | - | Navy boxes |
| Step Number | Top of box | - | Work Sans SemiBold | 18pt | Red |
| Step Title | Middle | - | Work Sans SemiBold | 14pt | White |
| Description | Lower | - | Work Sans Regular | 10pt | White |
| Arrows | Between boxes | - | - | White/Red |

#### Implementation:
```javascript
function addProcessSteps5Slide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = COLORS.navy;

  const stepWidth = 2.4;
  const stepHeight = 2.5;
  const gap = 0.2;
  const startX = 0.5;
  const startY = 2.5;

  data.steps.forEach((step, i) => {
    const x = startX + (i * (stepWidth + gap));

    // Step box
    slide.addShape('rect', {
      x, y: startY, w: stepWidth, h: stepHeight,
      fill: { color: '1a3a5c' },
      line: { color: COLORS.red, width: 2 }
    });

    // Step number
    slide.addText(`${i + 1}`, {
      x, y: startY + 0.2, w: stepWidth, h: 0.5,
      fontSize: 18, fontFace: 'Work Sans SemiBold', color: COLORS.red, align: 'center'
    });

    // Step title
    slide.addText(step.title, {
      x: x + 0.2, y: startY + 0.8, w: stepWidth - 0.4, h: 0.6,
      fontSize: 14, fontFace: 'Work Sans SemiBold', color: 'FFFFFF', align: 'center'
    });

    // Step description
    slide.addText(step.description, {
      x: x + 0.2, y: startY + 1.5, w: stepWidth - 0.4, h: 0.8,
      fontSize: 10, fontFace: 'Work Sans Regular', color: 'FFFFFF', align: 'center'
    });

    // Arrow (except last)
    if (i < data.steps.length - 1) {
      slide.addText('→', {
        x: x + stepWidth, y: startY + 1, w: gap, h: 0.5,
        fontSize: 24, color: COLORS.red, align: 'center'
      });
    }
  });
}
```

---

### Slide 28: Horizontal Process Steps (Alternative Style)
**Type:** `processStepsAlt`
**Background:** White

Similar to Slide 27 but:
- White background
- Navy text
- Red accent lines
- Different step indicator style (circles instead of boxes)

---

### Slide 29: Vertical Process Steps List
**Type:** `processStepsVertical`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Title | 0.5", 0.3" | 12" x 0.8" | Work Sans Light | 28pt | Navy |
| Step Items | Vertical list | Full width | - | - | See below |
| Step Number | Left aligned | 0.8" circle | Work Sans Bold | 18pt | White on Red |
| Step Title | Right of number | 3" x 0.5" | Work Sans SemiBold | 14pt | Navy |
| Step Description | Full width | 10" x 0.8" | Work Sans Regular | 11pt | Navy |

---

### Slide 30: Rollout Plan (Grid View)
**Type:** `rolloutGrid`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| "Rollout Plan" Title | 0.5", 0.3" | 4" x 1.2" | Work Sans Light | 48pt | Navy |
| Phase Boxes | 2x2 or 2x3 grid | 3.5"x2.5" | - | - | Various colors |
| Phase Title | Top of box | - | Work Sans SemiBold | 16pt | Navy/White |
| Phase Items | Below title | - | Work Sans Regular | 10pt | Navy/White |

---

### Slide 31: Rollout Plan (Timeline)
**Type:** `rolloutTimeline`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| "Rollout Plan" Title | 0.5", 0.3" | 4" x 1" | Work Sans Light | 36pt | Navy |
| Phase Markers | Horizontal | 0.8" circles | Work Sans Bold | 14pt | Numbers |
| Phase Titles | Below markers | 2" x 0.5" | Work Sans SemiBold | 12pt | Navy |
| Phase Details | Below titles | 2" x 1.5" | Work Sans Regular | 10pt | Dark Gray |
| Timeline Line | Connecting | Full width | - | Red line |

---

## SECTION 6: QUOTE / DATA SLIDES (Slides 16-19)

### Slide 16: Two-Column Quote Layout
**Type:** `quoteTwoColumn`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Left Quote | 0.5", 1.5" | 6" x 4" | - | - | See below |
| Quote Title (L) | 0.5", 1.5" | 5.5" x 0.6" | Work Sans SemiBold | 16pt | Navy |
| Quote Text (L) | 0.5", 2.2" | 5.5" x 3" | Work Sans Regular | 12pt | Navy |
| Right Quote | 6.8", 1.5" | 6" x 4" | - | - | See below |
| Quote Title (R) | 6.8", 1.5" | 5.5" x 0.6" | Work Sans SemiBold | 16pt | Navy |
| Quote Text (R) | 6.8", 2.2" | 5.5" x 3" | Work Sans Regular | 12pt | Navy |
| Red Accent Lines | Left of quotes | 0.03"x2" | - | - | Red |

---

### Slide 17: Full-Width Quote with Metrics
**Type:** `quoteWithMetrics`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Quote Text | 0.5", 1" | 12" x 3" | Work Sans Regular | 16pt | Navy |
| Red Border Line | 0.5", 1" | 0.05" x 3" | - | - | Red |
| Metrics Row | 0.5", 5" | 12" x 2" | - | - | See below |
| Metric Value | - | 2" x 1" | Work Sans Light | 48pt | Red |
| Metric Label | - | 2" x 0.5" | Work Sans Regular | 11pt | Navy |

---

### Slide 18: Quote with Data Visualization (Variant A)
**Type:** `quoteDataA`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Quote Section | Left half | 6" x 6" | - | - | Quote layout |
| Data Section | Right half | 6" x 6" | - | - | Metrics/charts |
| Section Label | 0.5", 0.3" | 3" x 0.3" | Work Sans SemiBold | 10pt | Red |
| Data Cards | 7", 1.5" | 2.5"x1.5" each | - | - | Light gray bg |

---

### Slide 19: Quote with Data Visualization (Variant B)
**Type:** `quoteDataB`
**Background:** White

Similar to Slide 18 with:
- Different data visualization layout
- Pie chart placeholder instead of cards
- Additional metrics row

---

## SECTION 7: CHART / TABLE SLIDES (Slides 20-21)

### Slide 20: Dual Chart Layout
**Type:** `dualChart`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Left Chart Title | 0.5", 0.5" | 6" x 0.5" | Work Sans SemiBold | 14pt | Navy |
| Left Chart Area | 0.5", 1.2" | 6" x 4.5" | - | - | Chart placeholder |
| Left Source | 0.5", 5.8" | 6" x 0.3" | Work Sans Regular | 8pt | Dark Gray |
| Right Chart Title | 6.8", 0.5" | 6" x 0.5" | Work Sans SemiBold | 14pt | Navy |
| Right Chart Area | 6.8", 1.2" | 6" x 4.5" | - | - | Chart placeholder |
| Right Source | 6.8", 5.8" | 6" x 0.3" | Work Sans Regular | 8pt | Dark Gray |
| Content Text | 0.5", 6.3" | 12" x 1" | Work Sans Regular | 11pt | Navy |

#### Implementation:
```javascript
function addDualChartSlide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = 'FFFFFF';

  // Left chart
  slide.addText(data.leftChart.title, {
    x: 0.5, y: 0.5, w: 6, h: 0.5,
    fontSize: 14, fontFace: 'Work Sans SemiBold', color: COLORS.navy
  });

  // Chart placeholder (or actual chart data)
  if (data.leftChart.chartData) {
    slide.addChart(pptx.ChartType.bar, data.leftChart.chartData, {
      x: 0.5, y: 1.2, w: 6, h: 4.5
    });
  } else {
    slide.addShape('rect', {
      x: 0.5, y: 1.2, w: 6, h: 4.5,
      fill: { color: COLORS.lightGray }
    });
  }

  slide.addText(`Source: ${data.leftChart.source}`, {
    x: 0.5, y: 5.8, w: 6, h: 0.3,
    fontSize: 8, fontFace: 'Work Sans Regular', color: COLORS.darkGray
  });

  // Right chart (similar structure)
  // ...
}
```

---

### Slide 21: Table Layout
**Type:** `table`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Title | 0.5", 0.3" | 12" x 0.6" | Work Sans Light | 28pt | Navy |
| Table | 0.5", 1.2" | 12" x 5.5" | - | - | See below |
| Header Row | - | - | Work Sans SemiBold | 11pt | White on Navy |
| Data Rows | - | - | Work Sans Regular | 10pt | Navy |
| Alternating Rows | - | - | - | - | White / Light Gray |

#### Implementation:
```javascript
function addTableSlide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = 'FFFFFF';

  // Title
  slide.addText(data.title, {
    x: 0.5, y: 0.3, w: 12, h: 0.6,
    fontSize: 28, fontFace: 'Work Sans Light', color: COLORS.navy
  });

  // Table
  const tableData = [data.headers, ...data.rows];

  slide.addTable(tableData, {
    x: 0.5, y: 1.2, w: 12,
    colW: data.colWidths || Array(data.headers.length).fill(12 / data.headers.length),
    fontFace: 'Work Sans Regular',
    fontSize: 10,
    color: COLORS.navy,
    border: { pt: 0.5, color: COLORS.lightGray },
    align: 'left',
    valign: 'middle',
    rowH: 0.5,
    fill: { color: 'FFFFFF' },
    // Header styling
    headRow: true,
    headRowFill: COLORS.navy,
    headRowColor: 'FFFFFF',
    headRowFontFace: 'Work Sans SemiBold',
    // Alternating rows
    autoPageRepeatRows: true
  });
}
```

---

## SECTION 8: HORIZONTAL TIMELINE SLIDES (Slides 22-26)

### Slide 22: Horizontal Timeline (Cards)
**Type:** `timelineCards`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Timeline Line | 0.5", 2.5" | 12" x 0.05" | - | - | Navy |
| Timeline Markers | On line | 0.5" circles | - | - | Red fill |
| Cards (above/below) | Alternating | 2.5"x1.8" | - | - | Light gray bg |
| Card Title | Top of card | 2.3" x 0.4" | Work Sans SemiBold | 12pt | Navy |
| Card Content | Below title | 2.3" x 1.2" | Work Sans Regular | 10pt | Dark Gray |

---

### Slide 23: Horizontal Timeline with Numbered Markers
**Type:** `timelineNumberedMarkers`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Main Title | 0.5", 0.3" | 12" x 0.6" | Work Sans Light | 28pt | Navy |
| Timeline Line | 1", 3.5" | 11" x 0.03" | - | - | Red |
| Step Numbers | On line | 0.8" circles | Work Sans Bold | 18pt | White on Red |
| Step Content | Below line | 2"x2" | - | - | Navy text |

---

### Slide 24: Horizontal Timeline (Alternative Card Style)
**Type:** `timelineCardsAlt`
**Background:** White

Similar to Slide 22 with:
- Cards all below the line
- Different card styling (navy border)
- Date/phase indicators above line

---

### Slide 25: Horizontal Timeline with Phase Labels
**Type:** `timelinePhases`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Phase Labels | Top row | 2.5" each | Work Sans SemiBold | 14pt | Red |
| Phase Bars | Below labels | 2.5"x0.3" | - | - | Navy fill |
| Phase Details | Below bars | 2.5"x3" | Work Sans Regular | 10pt | Navy |

---

### Slide 26: Vertical Numbered Steps
**Type:** `stepsVertical`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Step Number | Left column | 0.8" circles | Work Sans Bold | 18pt | White on Red |
| Step Title | Right of number | 10" x 0.5" | Work Sans SemiBold | 14pt | Navy |
| Step Description | Below title | 10" x 0.8" | Work Sans Regular | 11pt | Dark Gray |
| Connecting Line | Between steps | 0.03" wide | - | - | Light gray |

---

## SECTION 9: SCHEDULE / GANTT SLIDES (Slides 32-33)

### Slide 32: Gantt Chart / Schedule
**Type:** `ganttChart`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| "Rollout Schedule" Title | 0.5", 0.3" | 4" x 0.8" | Work Sans Light | 28pt | Navy |
| Month Headers | 2.5", 1.2" | Spanning | Work Sans SemiBold | 10pt | Navy |
| Activity Rows | Left column | 2" x 0.4" | Work Sans Regular | 10pt | Navy |
| Gantt Bars | In grid | Variable width | - | - | Red/Navy fill |
| Grid Lines | Full area | - | - | - | Light gray |

#### Implementation:
```javascript
function addGanttChartSlide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = 'FFFFFF';

  // Title
  slide.addText('Rollout Schedule', {
    x: 0.5, y: 0.3, w: 4, h: 0.8,
    fontSize: 28, fontFace: 'Work Sans Light', color: COLORS.navy
  });

  const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
                  'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  const chartStartX = 2.5;
  const chartWidth = 10.3;
  const monthWidth = chartWidth / 12;
  const rowHeight = 0.4;
  const headerY = 1.2;

  // Month headers
  months.forEach((month, i) => {
    slide.addText(month, {
      x: chartStartX + (i * monthWidth),
      y: headerY,
      w: monthWidth,
      h: 0.3,
      fontSize: 10,
      fontFace: 'Work Sans SemiBold',
      color: COLORS.navy,
      align: 'center'
    });
  });

  // Activity rows
  data.activities.forEach((activity, i) => {
    const y = headerY + 0.5 + (i * rowHeight);

    // Activity name
    slide.addText(activity.name, {
      x: 0.5, y, w: 2, h: rowHeight,
      fontSize: 10, fontFace: 'Work Sans Regular', color: COLORS.navy
    });

    // Gantt bar
    const startX = chartStartX + (activity.startMonth * monthWidth);
    const barWidth = (activity.endMonth - activity.startMonth + 1) * monthWidth;

    slide.addShape('rect', {
      x: startX, y: y + 0.05, w: barWidth, h: rowHeight - 0.1,
      fill: { color: activity.color || COLORS.red }
    });
  });

  // Grid lines
  for (let i = 0; i <= 12; i++) {
    slide.addShape('line', {
      x: chartStartX + (i * monthWidth),
      y: headerY,
      w: 0,
      h: data.activities.length * rowHeight + 0.5,
      line: { color: COLORS.lightGray, width: 0.5 }
    });
  }
}
```

---

### Slide 33: Rollout Schedule (Description View)
**Type:** `rolloutDescription`
**Background:** White

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| "Rollout Schedule" Title | 0.5", 0.3" | 4" x 0.8" | Work Sans Light | 28pt | Navy |
| Phase Cards | Grid layout | 3.5"x3" | - | - | See below |
| Card Title | Top of card | 3" x 0.5" | Work Sans SemiBold | 14pt | Navy/White |
| Card Description | Middle | 3" x 1" | Work Sans Regular | 10pt | Navy/White |
| Card Note | Bottom | 3" x 0.5" | Work Sans Regular | 9pt | Dark Gray |

---

## SECTION 10: THANK YOU SLIDES (Slides 34-35)

### Slide 34: Thank You (Navy Background)
**Type:** `thankYou`
**Background:** Navy (#0C2340)

#### Elements:
| Element | Position (x, y) | Size (w, h) | Font | Size | Color |
|---------|-----------------|-------------|------|------|-------|
| Geometric Pattern | 0, 0 | 13.33" x 4" | - | - | Image/SVG |
| "Thank You" | 0.5", 5.0" | 5" x 1.2" | Work Sans Light | 48pt | White |
| Website | 0.5", 6.3" | 3" x 0.3" | Work Sans Regular | 12pt | White |
| Social Media | 3.5", 6.3" | 3" x 0.3" | Work Sans Regular | 12pt | White |
| Large Logo | 10.5", 4.5" | 2" x 1.4" | - | - | Image |

#### Implementation:
```javascript
function addThankYouSlide(pptx, data) {
  const slide = pptx.addSlide();
  slide.bkgd = COLORS.navy;

  // Geometric pattern placeholder
  slide.addShape('rect', {
    x: 0, y: 0, w: 13.33, h: 4,
    fill: { color: '1a3a5c' }
  });

  // Thank You text
  slide.addText('Thank You', {
    x: 0.5, y: 5.0, w: 5, h: 1.2,
    fontSize: 48, fontFace: 'Work Sans Light', color: 'FFFFFF'
  });

  // Contact info
  slide.addText(data.website || 'Website', {
    x: 0.5, y: 6.3, w: 3, h: 0.3,
    fontSize: 12, fontFace: 'Work Sans Regular', color: 'FFFFFF'
  });

  slide.addText(data.socialMedia || 'Social Media', {
    x: 3.5, y: 6.3, w: 3, h: 0.3,
    fontSize: 12, fontFace: 'Work Sans Regular', color: 'FFFFFF'
  });

  // Large logo
  addLogoPlaceholder(slide, 10.5, 4.5, 'large');
}
```

---

### Slide 35: Thank You (Alternative Layout)
**Type:** `thankYouAlt`
**Background:** Navy (#0C2340)

Same structure as Slide 34 with:
- Different geometric pattern arrangement
- Contact information in different position
- QR code placeholder option

---

## IMPLEMENTATION PRIORITY

### Phase 1: Core Layouts (Already Implemented)
- [x] Title Slide (1)
- [x] Title with Image (2)
- [x] Section Divider (implicit in config)
- [x] Bullets (7)
- [x] Content (8)
- [x] Quote (10)
- [x] Table of Contents (6)
- [x] Process Steps (basic)
- [x] Thank You (34)

### Phase 2: Enhanced Content Slides
- [ ] Card Grid Layout (11)
- [ ] Feature Grid White (13)
- [ ] Feature Grid Red (14)
- [ ] Two-Column Quote (16)
- [ ] Quote with Metrics (17)

### Phase 3: Process & Timeline
- [ ] Timeline Numbered (15)
- [ ] Horizontal Timeline Cards (22)
- [ ] Timeline with Phases (25)
- [ ] Vertical Steps (26)
- [ ] Process Steps 5 (27)
- [ ] Process Steps Alt (28)
- [ ] Process Steps Vertical (29)

### Phase 4: Planning & Scheduling
- [ ] Rollout Grid (30)
- [ ] Rollout Timeline (31)
- [ ] Gantt Chart (32)
- [ ] Rollout Description (33)

### Phase 5: Data Visualization
- [ ] Dual Chart (20)
- [ ] Table Layout (21)
- [ ] Quote with Data (18, 19)

### Phase 6: Additional Variants
- [ ] Title Variant A (3)
- [ ] Title Variant B (4)
- [ ] Contents Nav (5)
- [ ] Thank You Alt (35)

---

## FILE STRUCTURE

```
server/templates/
├── ppt-template-config.js      # Layout configurations (to be expanded)
├── ppt-export-service.js       # Main export service (to be expanded)
├── layouts/                    # Individual layout implementations
│   ├── title-layouts.js        # Slides 1-4
│   ├── toc-layouts.js          # Slides 5-6
│   ├── content-layouts.js      # Slides 7-12
│   ├── grid-layouts.js         # Slides 13-14
│   ├── process-layouts.js      # Slides 15, 27-31
│   ├── quote-layouts.js        # Slides 16-19
│   ├── chart-layouts.js        # Slides 20-21
│   ├── timeline-layouts.js     # Slides 22-26
│   ├── schedule-layouts.js     # Slides 32-33
│   └── thankyou-layouts.js     # Slides 34-35
└── helpers/
    ├── logo-helper.js          # Logo placement utility
    ├── shape-helper.js         # Common shape utilities
    └── text-helper.js          # Text formatting utilities
```

---

## TESTING CHECKLIST

For each slide implementation:
- [ ] Correct positioning (x, y coordinates)
- [ ] Correct sizing (width, height)
- [ ] Typography matches spec (font, size, color)
- [ ] Brand colors applied correctly
- [ ] Logo placeholder renders
- [ ] Geometric accents render
- [ ] Page numbers (where applicable)
- [ ] Responsive content (handles variable text lengths)
- [ ] Export generates valid PPTX
- [ ] Opens correctly in PowerPoint/Google Slides

---

## NOTES

1. **EMU Conversion**: All measurements in the original PPTX are in EMUs. Use `emu / 914400` to convert to inches.

2. **Font Fallbacks**: Work Sans may not be available on all systems. Arial is used as fallback.

3. **Logo Integration**: Currently using text placeholders. Actual logo images need to be integrated.

4. **Geometric Patterns**: Currently using solid color placeholders. SVG/PNG pattern assets need to be created.

5. **Chart Support**: pptxgenjs supports native charts. Data format needs to be defined.

6. **Responsive Text**: Long titles/content may need text scaling or wrapping logic.
