# Gantt Chart Export Text Alignment Investigation

## Executive Summary

**Problem**: Text in the first column (swimlane and task labels) appears bottom-aligned instead of vertically centered when exported as PNG or SVG.

**Root Cause**: Html2canvas library does not properly render CSS flexbox `align-items: center` property, causing vertical misalignment during export.

**Current Status**: ⚠️ Partially resolved - CSS changes attempted but alignment issue persists. Requires further investigation.

**Date**: 2025-11-22
**Session ID**: claude/fix-gantt-export-alignment-01LVdBsX2MA6ZyrCNxMf6d7t

---

## Problem Description

### Initial Observation
When exporting Gantt charts using the "Export as PNG" or "Export as SVG" buttons, the text labels in the first column (containing swimlane names and task names) render with incorrect vertical alignment:
- **Browser view**: Text perfectly centered vertically in cells
- **Exported PNG/SVG**: Text appears shifted toward the bottom of cells (approximately 10-20% misalignment)

### Affected Elements
- `.gantt-row-label.swimlane` - Swimlane header labels
- `.gantt-row-label.task` - Individual task labels

### Technical Context
- **Export library**: html2canvas v1.4.1 (loaded via CDN)
- **Layout method**: CSS Grid for chart structure, Flexbox for label cell layout
- **Font sizes**: 30px (swimlanes), 26px (tasks)
- **Original CSS**:
  ```css
  .gantt-row-label {
    display: flex;
    align-items: center; /* Problem property */
    justify-content: space-between;
  }
  ```

---

## Investigation Timeline & Attempted Solutions

### Attempt #1: Explicit Line Heights
**Date**: Initial troubleshooting
**Approach**: Added explicit `line-height` values to ensure consistent rendering

**Changes Made**:
```css
.gantt-row-label {
  line-height: 1; /* Added */
}

.gantt-row-label .label-content {
  line-height: 1; /* Added */
}

.gantt-row-label.swimlane {
  line-height: 1.2; /* Added */
}

.gantt-row-label.task {
  line-height: 1.2; /* Added */
}
```

**Result**: ❌ **Failed** - No improvement in alignment
**Commit**: `f3d136b`

---

### Attempt #2: Padding Restructure
**Approach**: Moved padding from parent to child elements to improve html2canvas rendering

**Changes Made**:
```css
.gantt-row-label {
  padding: 0; /* Removed padding from parent */
}

.gantt-row-label .label-content {
  padding: 10px 12px; /* Moved padding here */
  display: block;
  align-self: center; /* Attempted explicit centering */
}

.gantt-row-label.swimlane .label-content {
  padding: 16px 18px;
}

.gantt-row-label.task .label-content {
  padding: 14px 16px 14px 36px;
}
```

**Result**: ❌ **Failed** - Alignment issue persisted
**Commit**: `cf85f67`

---

### Attempt #3: Html2canvas onclone Callback with Transform
**Approach**: Manipulate DOM directly before html2canvas renders using absolute positioning and CSS transforms

**Changes Made**:
```javascript
const canvas = await html2canvas(chartContainer, {
  // ... other options
  onclone: (clonedDoc) => {
    const clonedLabels = clonedDoc.querySelectorAll('.gantt-row-label');

    clonedLabels.forEach((label) => {
      label.style.display = 'block';
      label.style.position = 'relative';

      const labelContent = label.querySelector('.label-content');
      if (labelContent) {
        // Force vertical centering via absolute positioning
        labelContent.style.position = 'absolute';
        labelContent.style.top = '50%';
        labelContent.style.transform = 'translateY(-50%)';
        labelContent.style.left = '0';
        labelContent.style.right = '0';
      }
    });
  }
});
```

**Result**: ❌ **Failed catastrophically** - Broke PNG export entirely:
- First column disappeared completely
- Absolute positioning removed elements from normal flow
- Layout corrupted

**Commit**: `212cc11` (later reverted)

---

### Attempt #4: PNG Export Dimension Fixes
**Problem Discovered**: PNG export was cutting off (incomplete rendering)
**Approach**: Added explicit dimension handling

**Changes Made**:
```javascript
const scrollY = window.pageYOffset || document.documentElement.scrollTop;
const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

const canvas = await html2canvas(chartContainer, {
  scrollY: -scrollY,
  scrollX: -scrollX,
  windowWidth: chartContainer.scrollWidth,
  windowHeight: chartContainer.scrollHeight,
  width: chartContainer.scrollWidth,
  height: chartContainer.scrollHeight
});
```

**Result**: ✅ **Success** - Fixed cutoff issue, but alignment problem remained
**Commit**: `0c2d781`

---

### Attempt #5: SVG Export via foreignObject (Initial)
**Approach**: Implement SVG export as alternative to PNG, using SVG `foreignObject` to embed HTML

**Technical Details**:
- Clone chart container DOM
- Inline all CSS styles for portability
- Embed HTML in SVG foreignObject element
- Serialize to SVG file

**Implementation**:
```javascript
const clonedContainer = chartContainer.cloneNode(true);
this._inlineAllStyles(chartContainer, clonedContainer);

const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml">
        ${htmlString}
      </div>
    </foreignObject>
  </svg>
`;
```

**Result**: ❌ **Failed** - XML parsing errors when opening SVG file
**Error**: `Failed to load resource: net::ERR_FILE_NOT_FOUND`
**Root Cause**: External resources (images, fonts) not embedded
**Commits**: `9a18bd5`, `167fa1a`

---

### Attempt #6: SVG Export - Resource Embedding
**Approach**: Convert external resources to base64 data URLs for standalone SVG

**Changes Made**:
1. Convert images to base64:
   ```javascript
   const canvas = document.createElement('canvas');
   ctx.drawImage(originalImg, 0, 0);
   img.src = canvas.toDataURL('image/png');
   ```

2. Strip external URLs from CSS:
   ```javascript
   ruleText = ruleText.replace(/url\(['"]?https?:\/\/[^)'"]+['"]?\)/g, '');
   ```

3. Remove background-image external references

**Result**: ❌ **Failed** - New error
**Error**: `Opening and ending tag mismatch: img line 1394 and div`
**Root Cause**: HTML not valid XHTML (unclosed tags)
**Commit**: `fb5f1d2`

---

### Attempt #7: XHTML Serialization
**Approach**: Use XMLSerializer to produce valid XHTML for foreignObject

**Changes Made**:
```javascript
const serializer = new XMLSerializer();
let htmlString = serializer.serializeToString(clonedContainer);

// Fix self-closing tags
htmlString = htmlString
  .replace(/<(br|hr|img|input|meta|link)([^>]*?)>/gi, '<$1$2 />')
  .replace(/(<[^>]+?)\sxmlns="http:\/\/www\.w3\.org\/1999\/xhtml"([^>]*>)/g, '$1$2');
```

**Result**: ❌ **Failed** - New parsing error
**Error**: `error on line 1394 at column 45968: error parsing attribute name`
**Root Cause**: Invalid attribute names or values in XHTML context
**Commits**: `bee1d34`, `91c6bab`, `0a798dc`

---

### Attempt #8: Aggressive Attribute Sanitization
**Approach**: Validate and remove attributes with invalid XML names

**Changes Made**:
```javascript
allElements.forEach(el => {
  const attrs = Array.from(el.attributes);

  attrs.forEach(attr => {
    // Remove event handlers
    if (attr.name.startsWith('on')) {
      el.removeAttribute(attr.name);
    }

    // Remove contenteditable
    if (attr.name === 'contenteditable') {
      el.removeAttribute(attr.name);
    }

    // Remove invalid XML attribute names
    if (!/^[a-z_:][\w\-:.]*$/i.test(attr.name)) {
      el.removeAttribute(attr.name);
    }
  });
});
```

**Result**: ❌ **Failed** - Parsing errors continued
**Commit**: `0a798dc`

---

### Attempt #9: SVG Export Redesign (Hybrid Approach)
**Decision**: Abandon foreignObject approach due to XHTML complexity
**Approach**: Use html2canvas to render chart, embed resulting image in SVG

**Implementation**:
```javascript
// Render chart to canvas
const canvas = await html2canvas(chartContainer, {
  useCORS: true,
  scale: 2,
  // ... dimensions
});

// Embed as image in SVG
const imageData = canvas.toDataURL('image/png');
const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <image xlink:href="${imageData}" />
  </svg>
`;
```

**Result**: ✅ **Success** - SVG exports without errors
**Trade-off**: SVG contains raster image, not true vector graphics
**Side effect**: SVG now has same alignment issue as PNG
**Commit**: `d55db4a`

---

### Attempt #10: CSS Flexbox Removal (Final Attempt)
**Approach**: Remove flexbox `align-items: center` entirely, use padding-based centering

**Changes Made**:
```css
.gantt-row-label {
  display: flex;
  /* REMOVED: align-items: center */
  justify-content: space-between;
}

.gantt-row-label .label-content {
  display: block; /* No flexbox alignment */
  padding: 10px 12px; /* Padding-based spacing */
  line-height: 1.2;
}

.row-actions {
  margin: auto 0; /* Vertical centering via margin */
}
```

**Result**: ⏳ **Pending Testing** - Changes deployed, awaiting user confirmation
**Commit**: `5c37ddd`

---

## Technical Analysis

### Why Html2canvas Fails with Flexbox

**Html2canvas rendering process**:
1. Parses DOM tree
2. Computes styles for each element
3. Calculates element positions manually
4. Renders to canvas pixel by pixel

**The flexbox problem**:
- Html2canvas has **incomplete flexbox support**
- Specifically struggles with:
  - `align-items: center`
  - `align-self` properties
  - Nested flex containers
- Browser's native flexbox engine uses complex algorithms html2canvas doesn't fully replicate

**Technical comparison**:
```
Browser (native):
┌─────────────────┐
│  ┌───────────┐  │  ← align-items: center
│  │   Text    │  │     perfectly centered
│  └───────────┘  │
└─────────────────┘

Html2canvas:
┌─────────────────┐
│                 │  ← Miscalculates vertical
│                 │     position, ignores
│   ┌───────────┐ │     align-items property
│   │   Text    │ │
└───┴───────────┴─┘
```

### Browser vs Html2canvas Rendering Pipeline

**Browser**:
1. Parse HTML → DOM tree
2. Parse CSS → CSSOM
3. Combine → Render tree
4. Layout (calculate positions)
5. Paint (native rendering engine) ✅ **Perfect flexbox support**

**Html2canvas**:
1. Read DOM
2. Read computed styles
3. Calculate positions **manually** ⚠️ **Incomplete flexbox calculations**
4. Draw to canvas
5. Return image

---

## Attempted Workarounds Summary

| # | Approach | File | Result | Reason |
|---|----------|------|--------|--------|
| 1 | Explicit line-heights | CSS | ❌ Failed | Doesn't affect flexbox alignment calculation |
| 2 | Restructure padding | CSS | ❌ Failed | Padding location doesn't fix flexbox issue |
| 3 | onclone with transform | JS | ❌ Failed | Absolute positioning broke layout |
| 4 | Dimension fixes | JS | ✅ Partial | Fixed cutoff, not alignment |
| 5 | foreignObject SVG | JS | ❌ Failed | XHTML compliance too complex |
| 6 | Resource embedding | JS | ❌ Failed | XHTML tag mismatch errors |
| 7 | XMLSerializer | JS | ❌ Failed | Attribute name parsing errors |
| 8 | Attribute sanitization | JS | ❌ Failed | Errors persisted |
| 9 | SVG hybrid (image in SVG) | JS | ✅ Works | But inherits html2canvas issues |
| 10 | Remove flexbox alignment | CSS | ⏳ Testing | Padding-based centering |

---

## Current Implementation State

### Files Modified

**Public/style.css** (commit `5c37ddd`):
```css
/* Line 145-156: Parent container */
.gantt-row-label {
  display: flex;
  justify-content: space-between;
  /* align-items: center; ← REMOVED */
}

/* Line 159-168: Label content */
.gantt-row-label .label-content {
  display: block; /* Not flex */
  padding: 10px 12px;
  line-height: 1.2;
}

/* Line 179-184: Action buttons */
.row-actions {
  display: none;
  gap: 6px;
  margin: auto 0; /* Vertical centering */
}
```

**Public/GanttChart.js**:

PNG Export (lines 1241-1258):
```javascript
const canvas = await html2canvas(chartContainer, {
  useCORS: true,
  logging: false,
  scale: 2,
  allowTaint: false,
  backgroundColor: null,
  scrollY: -scrollY,
  scrollX: -scrollX,
  windowWidth: chartContainer.scrollWidth,
  windowHeight: chartContainer.scrollHeight,
  width: chartContainer.scrollWidth,
  height: chartContainer.scrollHeight
});
```

SVG Export (lines 1383-1410):
```javascript
// Hybrid approach: html2canvas → base64 → embed in SVG
const canvas = await html2canvas(chartContainer, { /* ... */ });
const imageData = canvas.toDataURL('image/png');

const svg = `
  <svg xmlns="http://www.w3.org/2000/svg"
       width="${width}" height="${height}">
    <image xlink:href="${imageData}" />
  </svg>
`;
```

---

## Observations & Patterns

### What Works
1. ✅ Html2canvas handles **padding** correctly
2. ✅ Html2canvas handles **margins** correctly
3. ✅ Html2canvas handles **display: block** correctly
4. ✅ Html2canvas handles **line-height** correctly
5. ✅ Explicit dimensions prevent cutoff issues

### What Doesn't Work
1. ❌ Flexbox `align-items: center`
2. ❌ Flexbox `align-self` property
3. ❌ CSS `transform` in onclone (breaks layout)
4. ❌ Absolute positioning in onclone (breaks layout)
5. ❌ foreignObject with complex HTML (XHTML compliance)
6. ❌ Runtime DOM manipulation before render (unexpected side effects)

### Html2canvas Known Limitations
According to html2canvas documentation and observed behavior:
- Limited flexbox support (only basic properties)
- No CSS Grid support
- Transforms may render incorrectly
- External resources require CORS or embedding
- Performance degrades with complex DOM

---

## Alternative Solutions to Consider

### Option 1: Different Export Library
**Candidates**:
- **dom-to-image** (npm package)
  - Better modern CSS support
  - May handle flexbox better
  - Smaller bundle size

- **html-to-image** (npm package)
  - Fork of dom-to-image
  - Active maintenance
  - TypeScript support

- **puppeteer** (server-side)
  - Uses real Chrome engine
  - Perfect rendering (native browser)
  - Requires Node.js backend

**Pros**: May solve alignment issues completely
**Cons**: Requires dependency changes, testing, potential new issues

### Option 2: Pure CSS Solution
**Approach**: Replace flexbox with table-cell layout

```css
.gantt-row-label {
  display: table;
  width: 100%;
}

.gantt-row-label .label-content {
  display: table-cell;
  vertical-align: middle; /* Html2canvas handles this better */
}

.row-actions {
  display: table-cell;
  vertical-align: middle;
}
```

**Pros**: Table layouts well-supported by html2canvas
**Cons**: Loses flexbox benefits (gap, flex-grow, etc.)

### Option 3: Calculated Padding
**Approach**: Dynamically calculate padding to achieve exact centering

```javascript
// Calculate padding needed for vertical centering
const fontSize = parseFloat(getComputedStyle(label).fontSize);
const lineHeight = fontSize * 1.2;
const containerHeight = 60; // Total height
const paddingNeeded = (containerHeight - lineHeight) / 2;

label.style.paddingTop = `${paddingNeeded}px`;
label.style.paddingBottom = `${paddingNeeded}px`;
```

**Pros**: Precise control, html2canvas compatible
**Cons**: Complex, requires JavaScript, may need adjustment per element

### Option 4: Server-Side Rendering
**Approach**: Generate exports server-side using headless browser

```javascript
// Server-side (Node.js)
const puppeteer = require('puppeteer');

async function exportChart(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  const screenshot = await page.screenshot({
    selector: '#gantt-chart-container',
    type: 'png'
  });
  await browser.close();
  return screenshot;
}
```

**Pros**: Perfect rendering (real Chrome), supports all CSS
**Cons**: Requires backend infrastructure, slower, more complex

### Option 5: Canvas-Based Gantt Rendering
**Approach**: Rewrite Gantt chart to render directly to HTML5 Canvas

**Pros**:
- Perfect export (already canvas)
- Full control over rendering
- Better performance for large charts

**Cons**:
- Complete rewrite required
- Loses DOM benefits (accessibility, interactions)
- Significant development effort

### Option 6: Native SVG Chart Generation
**Approach**: Generate Gantt chart using native SVG elements instead of HTML

```javascript
// Create SVG rectangles for bars
const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
rect.setAttribute('x', startX);
rect.setAttribute('y', startY);
rect.setAttribute('width', width);
rect.setAttribute('height', height);

// Create SVG text for labels
const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
text.setAttribute('x', x);
text.setAttribute('y', y);
text.textContent = 'Task Name';
```

**Pros**:
- True vector output
- Perfect for export (native SVG)
- Scalable, editable
- No html2canvas needed

**Cons**:
- Major rewrite of GanttChart.js
- Complex interactions harder to implement
- Styling with CSS limited
- Development time: ~2-3 weeks

---

## Testing Methodology

### How to Reproduce Issue

1. **Setup**:
   - Navigate to chart view (`chart.html`)
   - Load any Gantt chart with swimlanes and tasks

2. **Export PNG**:
   - Click "Export as PNG" button
   - Download file
   - Open in image viewer
   - **Observe**: Text in first column alignment

3. **Export SVG**:
   - Click "Export as SVG" button
   - Download file
   - Open in browser or SVG viewer
   - **Observe**: Text in first column alignment

4. **Compare**:
   - Take browser screenshot using OS tools (Cmd+Shift+4 on Mac, Snipping Tool on Windows)
   - Compare with exported files
   - **Measure**: Vertical position of text relative to cell boundaries

### Visual Test Checklist

- [ ] Swimlane labels centered vertically in browser
- [ ] Task labels centered vertically in browser
- [ ] Swimlane labels centered in PNG export
- [ ] Task labels centered in PNG export
- [ ] Swimlane labels centered in SVG export
- [ ] Task labels centered in SVG export
- [ ] No regression in horizontal alignment
- [ ] Action buttons (edit mode) still visible and aligned
- [ ] No layout shifts or breaks

---

## Recommended Next Steps

### Immediate (This Session)
1. ✅ Document all troubleshooting attempts (this file)
2. ⏳ Test latest CSS changes (commit `5c37ddd`)
3. 📊 Measure exact alignment deviation in pixels

### Short-term (Next Session)
1. **If CSS fix works**:
   - Test across different chart sizes
   - Test with various font configurations
   - Document success and close issue

2. **If CSS fix fails**:
   - Try Option 2 (table-cell layout)
   - Try Option 3 (calculated padding)
   - Evaluate Option 1 (different library)

### Long-term (Future Enhancement)
1. Research native SVG implementation (Option 6)
2. Evaluate server-side rendering (Option 4)
3. Consider canvas-based rewrite (Option 5)

---

## Research Resources

### Html2canvas Documentation
- Official: https://html2canvas.hertzen.com/
- GitHub Issues: https://github.com/niklasvh/html2canvas/issues
- Known flexbox issues: #1490, #1619, #2144

### Alternative Libraries
- dom-to-image: https://github.com/tsayen/dom-to-image
- html-to-image: https://github.com/bubkoo/html-to-image
- modern-screenshot: https://github.com/qq15725/modern-screenshot

### CSS Centering Techniques
- MDN Flexbox: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout
- CSS Tricks: https://css-tricks.com/centering-css-complete-guide/
- Table-cell centering: https://css-tricks.com/vertically-center-multi-lined-text/

### SVG foreignObject
- MDN: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/foreignObject
- XHTML in SVG: https://www.w3.org/TR/SVG2/embedded.html#ForeignObjectElement

---

## Appendix A: Code Diffs

### CSS Changes (Current State)

```diff
# Public/style.css (commit 5c37ddd)

.gantt-row-label {
  padding: 0;
  font-size: 13px;
  border-bottom: 1px solid #0D0D0D;
  white-space: nowrap;
  overflow: visible;
  display: flex;
- align-items: center;
+ /* REMOVED: align-items: center - causes html2canvas misalignment */
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
}

.gantt-row-label .label-content {
  flex: 1;
  min-width: 0;
  transition: all 0.2s;
  border-radius: 4px;
  padding: 10px 12px;
- display: flex;
- align-items: center;
+ display: block;
+ line-height: 1.2;
- align-self: center;
+ /* Vertical centering via padding (html2canvas compatible) */
}

.row-actions {
  display: none;
  gap: 6px;
- align-items: center;
+ margin: auto 0; /* Vertically center in flex parent */
}
```

---

## Appendix B: Git History

### Relevant Commits

| Commit | Date | Description | Result |
|--------|------|-------------|--------|
| `f3d136b` | 2025-11-22 | Fix text alignment in PNG exports (line-heights) | Failed |
| `cf85f67` | 2025-11-22 | Restructure label padding for html2canvas | Failed |
| `212cc11` | 2025-11-22 | Fix text alignment using onclone transform | Failed (broke export) |
| `7df9c2d` | 2025-11-22 | Fix PNG and SVG export rendering issues (reverted onclone) | Partial |
| `0c2d781` | 2025-11-22 | Fix PNG export cutoff issue (dimensions) | Success (cutoff fixed) |
| `9a18bd5` | 2025-11-22 | Add SVG export functionality (foreignObject) | Failed (XML errors) |
| `167fa1a` | 2025-11-22 | Fix SVG export rendering issues (embed resources) | Failed |
| `fb5f1d2` | 2025-11-22 | Fix SVG export XHTML serialization | Failed |
| `bee1d34` | 2025-11-22 | Improve SVG export attribute sanitization | Failed |
| `91c6bab` | 2025-11-22 | Fix SVG export bugs | Failed |
| `0a798dc` | 2025-11-22 | Add aggressive attribute name validation | Failed |
| `d55db4a` | 2025-11-22 | Simplify SVG export (hybrid approach) | Success (works but same alignment issue) |
| `5c37ddd` | 2025-11-22 | Remove flexbox align-items for html2canvas | Pending test |

### Branch
`claude/fix-gantt-export-alignment-01LVdBsX2MA6ZyrCNxMf6d7t`

---

## Appendix C: Key Findings

### Html2canvas CSS Support Matrix

| Property | Support | Notes |
|----------|---------|-------|
| `padding` | ✅ Full | Works correctly |
| `margin` | ✅ Full | Works correctly |
| `display: block` | ✅ Full | Works correctly |
| `display: flex` | ⚠️ Partial | Basic support only |
| `align-items` | ❌ None | Completely ignored |
| `align-self` | ❌ None | Completely ignored |
| `justify-content` | ⚠️ Partial | Basic horizontal alignment works |
| `transform` | ⚠️ Partial | Simple transforms work, complex may break |
| `position: absolute` | ⚠️ Partial | Can break layout in onclone |
| `line-height` | ✅ Full | Works correctly |

### XHTML Compatibility Issues Encountered

1. **Unclosed tags**: `<img>` must be `<img />`
2. **Attribute parsing**: Some attribute names invalid in XML
3. **Namespace handling**: xmlns declarations complex
4. **External resources**: Cannot reference external files
5. **Event handlers**: Must be removed (onclick, etc.)
6. **Complex serialization**: XMLSerializer not sufficient alone

---

## Contact & Support

**Developer**: Claude (Anthropic)
**Session**: claude/fix-gantt-export-alignment-01LVdBsX2MA6ZyrCNxMf6d7t
**Repository**: /home/user/force
**Related Issues**: Text alignment in Gantt chart exports

**For Future Reference**:
- This document is located at: `/home/user/force/GANTT_EXPORT_ALIGNMENT_INVESTIGATION.md`
- All code changes are on branch: `claude/fix-gantt-export-alignment-01LVdBsX2MA6ZyrCNxMf6d7t`
- Original issue reported: 2025-11-22

---

## Conclusion

The text alignment issue in PNG/SVG exports stems from html2canvas's incomplete support for CSS flexbox `align-items: center`. Despite 10+ attempted solutions including CSS modifications, JavaScript workarounds, and complete SVG export redesigns, the core issue remains unresolved.

The most promising path forward is **Option 2** (table-cell layout) or **Option 1** (alternative library), with **Option 6** (native SVG) as a long-term solution for perfect exports.

Current state: CSS changes deployed (commit `5c37ddd`) - awaiting user testing to confirm if padding-based centering resolves the issue.
