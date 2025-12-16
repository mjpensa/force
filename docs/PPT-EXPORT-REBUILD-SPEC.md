# PPT Export Rebuild Technical Specification

> **Status: IMPLEMENTED** - See `server/templates/ppt-export-service-v2.js`

## Overview

This document outlines the complete rebuild of the PowerPoint export functionality to match the browser preview rendering exactly.

## Implementation Summary

The new export service (`ppt-export-service-v2.js`) replaces the original service with:
- All positions calculated from browser CSS percentages
- Base64-embedded logo images for reliability
- Shape-based corner graphic (no external SVG dependency)
- Proper font handling (Work Sans with bold flag instead of font name variants)
- Correct line spacing using `lineSpacingMultiple` instead of percentage values

---

## 1. Slide Dimensions & Coordinate System

### Master Dimensions
```
Slide Width:  13.33 inches (960 points)
Slide Height:  7.50 inches (540 points)
Aspect Ratio: 16:9
```

### Percentage-to-Inch Conversion Formula
```javascript
x_inches = (percentage / 100) * 13.33
y_inches = (percentage / 100) * 7.50
```

---

## 2. Layout Specifications

### 2.1 Section Title Slide

| Element | Browser CSS | PPT Inches | Notes |
|---------|-------------|------------|-------|
| **Background** | `#0C2340` | `#0C2340` | Navy full-bleed |
| **Swimlane Label** | `top: 5%`, `left: 4%` | `x: 0.53`, `y: 0.375` | White text (changed from red) |
| **Main Title** | centered, `font-size: 8cqw` | centered, `60pt` | Work Sans Thin, white |
| **Red Line** | `width: 15%`, below title | `w: 2.0`, `h: 0.04` | Centered under title |
| **Corner Graphic** | `top: 0`, `right: 0`, `width: 10.9%` | `x: 11.88`, `y: 0`, `w: 1.45` | White/inverted, 30% opacity |
| **Logo** | `bottom: 3%`, `right: 2%`, `height: 4%` | `x: 11.83`, `y: 7.2`, `w: 1.0`, `h: 0.3` | Red BIP Logo |
| **Page Number** | `bottom: 3.43%`, `left: 2.11%` | `x: 0.28`, `y: 7.24` | White 60% opacity |

### 2.2 Two-Column Content Slide

| Element | Browser CSS | PPT Inches | Notes |
|---------|-------------|------------|-------|
| **Background** | `#FFFFFF` | `#FFFFFF` | White |
| **Tagline** | `top: 3.43%`, `left: 2.11%` | `x: 0.28`, `y: 0.26` | Red, 12pt semibold, uppercase |
| **Title** | `top: 7%`, `left: 1.87%`, `w: 44.59%`, `h: 40%` | `x: 0.25`, `y: 0.525`, `w: 5.94`, `h: 3.0` | Navy, 54pt thin |
| **Body Area** | `left: 50.59%`, `top: 57%`, `w: 44.30%` | `x: 6.74`, `y: 4.275`, `w: 5.91`, `h: 2.78` | Navy, 11pt regular |
| **Corner Graphic** | `top: 0`, `right: 0`, `width: 10.9%` | `x: 11.88`, `y: 0`, `w: 1.45` | Original colors |
| **Logo** | `bottom: 3%`, `right: 2%` | `x: 12.06`, `y: 7.2`, `w: 1.0`, `h: 0.3` | Red BIP Logo |
| **Page Number** | `bottom: 3.43%`, `left: 2.11%` | `x: 0.28`, `y: 7.24` | Navy, 10pt |

### 2.3 Three-Column Content Slide

| Element | Browser CSS | PPT Inches | Notes |
|---------|-------------|------------|-------|
| **Tagline** | `top: 3.47%`, `left: 2.10%` | `x: 0.28`, `y: 0.26` | Same as two-column |
| **Title** | `top: 7%`, `left: 1.87%`, `w: 20.70%`, `h: 40%` | `x: 0.25`, `y: 0.525`, `w: 2.76`, `h: 3.0` | Navy, 33pt, weight 300 |
| **Columns Area** | `left: 26.71%`, `top: 46.13%`, `w: 68.27%`, `h: 46.93%` | `x: 3.56`, `y: 3.46`, `w: 9.10`, `h: 3.52` | 3 equal columns |
| **Column Gap** | `gap: 4.43%` | `0.59"` between columns | Flexbox equivalent |
| **Each Column Width** | `flex: 1` | `2.64"` each | `(9.10 - 2*0.59) / 3` |

---

## 3. Typography Specifications

### 3.1 Font Family Handling

PptxGenJS does not support font weights in the font name. Use:

```javascript
// WRONG - won't work correctly
fontFace: 'Work Sans Thin'

// CORRECT - use base font + bold flag
fontFace: 'Work Sans',
bold: false  // For thin/regular/light weights
```

### 3.2 Font Size & Line Spacing Conversion

| Context | Browser CSS | PptxGenJS |
|---------|-------------|-----------|
| **Title (2-col)** | `font-size: 8cqw`, `line-height: 0.85` | `fontSize: 54`, `lineSpacingMultiple: 0.85` |
| **Title (3-col)** | `font-size: 3.7cqw`, `line-height: 0.85` | `fontSize: 33`, `lineSpacingMultiple: 0.85` |
| **Body Text** | `font-size: 1.15cqw`, `line-height: 1.35` | `fontSize: 11`, `lineSpacingMultiple: 1.35` |
| **Tagline** | `font-size: 1.3cqw` | `fontSize: 12` |
| **Page Number** | `font-size: 1cqw` | `fontSize: 10` |

### 3.3 Text Box Options

```javascript
// Title text box (two-column)
{
  x: 0.25, y: 0.525, w: 5.94, h: 3.0,
  fontSize: 54,
  fontFace: 'Work Sans',
  bold: false,
  color: '0C2340',
  align: 'left',
  valign: 'top',
  lineSpacingMultiple: 0.85,
  wrap: true
}

// Body text box
{
  x: 6.74, y: 4.275, w: 5.91, h: 2.78,
  fontSize: 11,
  fontFace: 'Work Sans',
  bold: false,
  color: '0C2340',
  align: 'left',
  valign: 'top',
  lineSpacingMultiple: 1.35,
  paraSpaceAfter: 10,
  wrap: true
}
```

---

## 4. Color Palette

```javascript
const COLORS = {
  navy: '0C2340',      // Primary brand - titles, body text
  red: 'DA291C',       // Accent - taglines, decorative elements
  white: 'FFFFFF',     // Backgrounds, section title text
  darkGray: '6B7280',  // Page numbers on white backgrounds
  mutedWhite: 'AAAAAA' // Page numbers on dark backgrounds (60% white)
};
```

---

## 5. Image Assets

### 5.1 Logo Files

| File | Usage | Dimensions |
|------|-------|------------|
| `Public/Red BIP Logo.png` | All slides (browser uses this) | Variable |
| `Public/bip_logo.png` | Legacy reference | Variable |

### 5.2 Corner Graphic

**Problem**: PptxGenJS cannot apply CSS filters to SVG files.

**Solution Options**:

1. **Option A**: Convert SVG to PNG with two variants:
   - `bip-corner-graphic.png` - original colors
   - `bip-corner-graphic-white.png` - white version for dark backgrounds

2. **Option B**: Recreate corner graphic using PptxGenJS shapes:
   ```javascript
   // Draw corner triangle shapes programmatically
   slide.addShape(pptx.ShapeType.rtTriangle, {
     x: 12.0, y: 0, w: 1.33, h: 1.0,
     fill: { color: 'DA291C' },
     rotate: 0
   });
   ```

3. **Option C**: Embed images as base64 for reliability:
   ```javascript
   const logoBase64 = fs.readFileSync('Public/Red BIP Logo.png', 'base64');
   slide.addImage({
     data: `image/png;base64,${logoBase64}`,
     x: 12.06, y: 7.2, w: 1.0, h: 0.3
   });
   ```

**Recommendation**: Option C (base64 embedding) for logos, Option A or B for corner graphic.

---

## 6. Rebuilt Code Structure

### 6.1 New File: `ppt-export-service-v2.js`

```javascript
/**
 * PPT Export Service v2
 * Rebuilt to match browser preview exactly
 */

import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';

// ============================================================================
// CONSTANTS - Derived from browser CSS percentages
// ============================================================================

const SLIDE = {
  WIDTH: 13.33,
  HEIGHT: 7.5
};

// Convert percentage to inches
const pct = (p, axis) => (p / 100) * (axis === 'x' ? SLIDE.WIDTH : SLIDE.HEIGHT);

const COLORS = {
  navy: '0C2340',
  red: 'DA291C',
  white: 'FFFFFF',
  darkGray: '6B7280',
  mutedWhite: 'AAAAAA'
};

// Base64 encoded assets (loaded at startup)
let ASSETS = {};

// ============================================================================
// LAYOUTS - Exact browser measurements converted to inches
// ============================================================================

const LAYOUTS = {
  sectionTitle: {
    swimlaneLabel: { x: pct(4, 'x'), y: pct(5, 'y'), w: 5, h: 0.4 },
    title: { x: 0.5, y: 2.5, w: SLIDE.WIDTH - 1, h: 2 },
    redLine: { x: (SLIDE.WIDTH - 2) / 2, y: 4.7, w: 2, h: 0.04 },
    cornerGraphic: { x: SLIDE.WIDTH - 1.45, y: 0, w: 1.45 },
    logo: { x: SLIDE.WIDTH - 1.27, y: SLIDE.HEIGHT - 0.6, w: 1.0, h: 0.3 },
    pageNumber: { x: pct(2.11, 'x'), y: pct(96.57, 'y'), w: 0.5, h: 0.3 }
  },

  twoColumn: {
    tagline: { x: pct(2.11, 'x'), y: pct(3.43, 'y'), w: 2.2, h: 0.3 },
    title: { x: pct(1.87, 'x'), y: pct(7, 'y'), w: pct(44.59, 'x'), h: pct(40, 'y') },
    body: { x: pct(50.59, 'x'), y: pct(57, 'y'), w: pct(44.30, 'x'), h: pct(37, 'y') },
    cornerGraphic: { x: SLIDE.WIDTH - 1.45, y: 0, w: 1.45 },
    logo: { x: SLIDE.WIDTH - 1.27, y: SLIDE.HEIGHT - 0.5, w: 1.0, h: 0.3 },
    pageNumber: { x: pct(2.11, 'x'), y: pct(96.57, 'y'), w: 0.5, h: 0.3 }
  },

  threeColumn: {
    tagline: { x: pct(2.10, 'x'), y: pct(3.47, 'y'), w: 2.2, h: 0.3 },
    title: { x: pct(1.87, 'x'), y: pct(7, 'y'), w: pct(20.70, 'x'), h: pct(40, 'y') },
    columns: { x: pct(26.71, 'x'), y: pct(46.13, 'y'), w: pct(68.27, 'x'), h: pct(46.93, 'y') },
    columnGap: pct(4.43, 'x'),
    cornerGraphic: { x: SLIDE.WIDTH - 1.45, y: 0, w: 1.45 },
    logo: { x: SLIDE.WIDTH - 1.27, y: SLIDE.HEIGHT - 0.5, w: 1.0, h: 0.3 },
    pageNumber: { x: pct(2.11, 'x'), y: pct(96.57, 'y'), w: 0.5, h: 0.3 }
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function loadAssets() {
  const publicDir = path.join(process.cwd(), 'Public');

  // Load logo as base64
  const logoPath = path.join(publicDir, 'Red BIP Logo.png');
  if (fs.existsSync(logoPath)) {
    ASSETS.logo = `image/png;base64,${fs.readFileSync(logoPath, 'base64')}`;
  }

  // Load corner graphic (if PNG version exists)
  const cornerPath = path.join(publicDir, 'bip-corner-graphic.png');
  if (fs.existsSync(cornerPath)) {
    ASSETS.cornerGraphic = `image/png;base64,${fs.readFileSync(cornerPath, 'base64')}`;
  }
}

// ============================================================================
// SLIDE RENDERERS
// ============================================================================

function addSectionTitleSlide(pptx, data, slideNumber) {
  const L = LAYOUTS.sectionTitle;
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.navy };

  // Swimlane label (white on dark background - per updated CSS)
  if (data.swimlane) {
    slide.addText(data.swimlane.toUpperCase(), {
      x: L.swimlaneLabel.x,
      y: L.swimlaneLabel.y,
      w: L.swimlaneLabel.w,
      h: L.swimlaneLabel.h,
      fontSize: 14,
      fontFace: 'Work Sans',
      bold: true,
      color: COLORS.white,
      align: 'left'
    });
  }

  // Main title (centered)
  slide.addText(data.sectionTitle || data.swimlane || '', {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 60,
    fontFace: 'Work Sans',
    bold: false,
    color: COLORS.white,
    align: 'center',
    valign: 'middle'
  });

  // Red decorative line
  slide.addShape(pptx.ShapeType.rect, {
    x: L.redLine.x,
    y: L.redLine.y,
    w: L.redLine.w,
    h: L.redLine.h,
    fill: { color: COLORS.red },
    line: { color: COLORS.red, width: 0 }
  });

  // Logo
  if (ASSETS.logo) {
    slide.addImage({
      data: ASSETS.logo,
      x: L.logo.x,
      y: L.logo.y,
      w: L.logo.w,
      h: L.logo.h
    });
  }

  // Page number (muted white)
  slide.addText(String(slideNumber), {
    x: L.pageNumber.x,
    y: L.pageNumber.y,
    w: L.pageNumber.w,
    h: L.pageNumber.h,
    fontSize: 10,
    fontFace: 'Work Sans',
    color: COLORS.mutedWhite,
    align: 'left'
  });
}

function addTwoColumnSlide(pptx, data, slideNumber) {
  const L = LAYOUTS.twoColumn;
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };

  // Tagline
  const tagline = data.tagline || data.section || '';
  if (tagline) {
    slide.addText(tagline.toUpperCase(), {
      x: L.tagline.x,
      y: L.tagline.y,
      w: L.tagline.w,
      h: L.tagline.h,
      fontSize: 12,
      fontFace: 'Work Sans',
      bold: true,
      color: COLORS.red,
      align: 'left'
    });
  }

  // Title (4 lines, sentence case)
  const titleText = formatTitle(data.title);
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 54,
    fontFace: 'Work Sans',
    bold: false,
    color: COLORS.navy,
    align: 'left',
    valign: 'top',
    lineSpacingMultiple: 0.85
  });

  // Body (two paragraphs)
  const bodyText = formatBody(data.paragraph1, data.paragraph2);
  slide.addText(bodyText, {
    x: L.body.x,
    y: L.body.y,
    w: L.body.w,
    h: L.body.h,
    fontSize: 11,
    fontFace: 'Work Sans',
    bold: false,
    color: COLORS.navy,
    align: 'left',
    valign: 'top',
    lineSpacingMultiple: 1.35,
    paraSpaceAfter: 12
  });

  // Corner graphic (if available)
  if (ASSETS.cornerGraphic) {
    slide.addImage({
      data: ASSETS.cornerGraphic,
      x: L.cornerGraphic.x,
      y: L.cornerGraphic.y,
      w: L.cornerGraphic.w
    });
  }

  // Logo
  if (ASSETS.logo) {
    slide.addImage({
      data: ASSETS.logo,
      x: L.logo.x,
      y: L.logo.y,
      w: L.logo.w,
      h: L.logo.h
    });
  }

  // Page number
  slide.addText(String(slideNumber), {
    x: L.pageNumber.x,
    y: L.pageNumber.y,
    w: L.pageNumber.w,
    h: L.pageNumber.h,
    fontSize: 10,
    fontFace: 'Work Sans',
    color: COLORS.darkGray,
    align: 'left'
  });
}

function addThreeColumnSlide(pptx, data, slideNumber) {
  const L = LAYOUTS.threeColumn;
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };

  // Tagline
  const tagline = data.tagline || data.section || '';
  if (tagline) {
    slide.addText(tagline.toUpperCase(), {
      x: L.tagline.x,
      y: L.tagline.y,
      w: L.tagline.w,
      h: L.tagline.h,
      fontSize: 12,
      fontFace: 'Work Sans',
      bold: true,
      color: COLORS.red,
      align: 'left'
    });
  }

  // Title (narrower, heavier weight)
  const titleText = formatTitle(data.title);
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 33,
    fontFace: 'Work Sans',
    bold: false,  // Weight 300 approximated
    color: COLORS.navy,
    align: 'left',
    valign: 'top',
    lineSpacingMultiple: 0.85
  });

  // Three columns
  const totalWidth = L.columns.w;
  const gapWidth = L.columnGap;
  const colWidth = (totalWidth - (2 * gapWidth)) / 3;

  const columns = [data.paragraph1, data.paragraph2, data.paragraph3];
  columns.forEach((text, i) => {
    if (text) {
      const colX = L.columns.x + (i * (colWidth + gapWidth));
      slide.addText(text.trim(), {
        x: colX,
        y: L.columns.y,
        w: colWidth,
        h: L.columns.h,
        fontSize: 11,
        fontFace: 'Work Sans',
        bold: false,
        color: COLORS.navy,
        align: 'left',
        valign: 'top',
        lineSpacingMultiple: 1.30
      });
    }
  });

  // Corner graphic
  if (ASSETS.cornerGraphic) {
    slide.addImage({
      data: ASSETS.cornerGraphic,
      x: L.cornerGraphic.x,
      y: L.cornerGraphic.y,
      w: L.cornerGraphic.w
    });
  }

  // Logo
  if (ASSETS.logo) {
    slide.addImage({
      data: ASSETS.logo,
      x: L.logo.x,
      y: L.logo.y,
      w: L.logo.w,
      h: L.logo.h
    });
  }

  // Page number
  slide.addText(String(slideNumber), {
    x: L.pageNumber.x,
    y: L.pageNumber.y,
    w: L.pageNumber.w,
    h: L.pageNumber.h,
    fontSize: 10,
    fontFace: 'Work Sans',
    color: COLORS.darkGray,
    align: 'left'
  });
}

// ============================================================================
// TEXT FORMATTING HELPERS
// ============================================================================

function formatTitle(title) {
  // Convert to sentence case, preserve acronyms, enforce 4 lines
  // ... implementation
}

function formatBody(p1, p2) {
  // Combine paragraphs with proper spacing
  const parts = [];
  if (p1) parts.push(p1.trim());
  if (p2) parts.push(p2.trim());
  return parts.join('\n\n');
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export async function generatePptx(slidesData, options = {}) {
  // Load assets on first call
  if (!ASSETS.logo) loadAssets();

  const pptx = new PptxGenJS();

  // Metadata
  pptx.author = options.author || 'BIP';
  pptx.company = options.company || 'BIP';
  pptx.title = slidesData.title || 'Presentation';

  // Layout
  pptx.defineLayout({ name: 'CUSTOM_16_9', width: SLIDE.WIDTH, height: SLIDE.HEIGHT });
  pptx.layout = 'CUSTOM_16_9';

  // Flatten sections to slides
  const slides = flattenSections(slidesData.sections || []);

  // Render each slide
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const slideNum = i + 1;

    if (slide.layout === 'sectionTitle') {
      addSectionTitleSlide(pptx, slide, slideNum);
    } else if (slide.layout === 'threeColumn') {
      addThreeColumnSlide(pptx, slide, slideNum);
    } else {
      addTwoColumnSlide(pptx, slide, slideNum);
    }
  }

  return await pptx.write({ outputType: 'nodebuffer' });
}
```

---

## 7. Testing Checklist

### Visual Comparison Tests

- [ ] Section title slide background color matches
- [ ] Section title text is centered vertically and horizontally
- [ ] Swimlane label is white (not red) on section title slides
- [ ] Two-column title position matches browser
- [ ] Two-column body text position matches browser
- [ ] Three-column title width is narrower than two-column
- [ ] Three-column columns have correct gap spacing
- [ ] Logo appears in correct position on all slides
- [ ] Page numbers appear in correct position
- [ ] Corner graphic renders (or placeholder shape)
- [ ] Font weights appear correct (thin for titles)
- [ ] Line spacing matches browser preview

### Content Tests

- [ ] Title truncation to 4 lines works correctly
- [ ] Acronyms are preserved in sentence case
- [ ] Paragraph text doesn't overflow text boxes
- [ ] Section flattening produces correct slide order

---

## 8. Migration Path

1. Create new `ppt-export-service-v2.js` alongside existing file
2. Test new export with sample presentations
3. Compare output side-by-side with browser preview
4. Once validated, replace old service
5. Remove deprecated code

---

## 9. Open Questions

1. **Corner Graphic**: Should we create PNG versions or use shapes?
2. **Font Embedding**: Does target environment have Work Sans installed?
3. **Backward Compatibility**: Keep legacy flat slides support?
4. **AI Title Rewording**: Keep Gemini integration or simplify?
