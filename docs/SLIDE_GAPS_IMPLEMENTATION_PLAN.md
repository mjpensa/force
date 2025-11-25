# Slide Template Gaps - Implementation Plan

## Overview

This document outlines a detailed, phased implementation plan to address the gaps identified in the slide presentation template system. The plan is organized into 6 phases, progressing from critical fixes to polish items.

**Estimated Total Effort:** 4-6 development sessions
**Priority Order:** Schema → Prompt → Code Fixes → Testing → Documentation

---

## Gap Summary

| Gap | Severity | Phase |
|-----|----------|-------|
| AI Schema only supports 4 slide types | 🔴 Critical | Phase 1 |
| Schema missing data properties | 🔴 Critical | Phase 1 |
| AI Prompt doesn't teach slide type usage | 🟠 High | Phase 2 |
| Hardcoded "LOREM IPSUM" in 3 slides | 🟡 Medium | Phase 3 |
| Slide 15 vs 23 mapping inconsistency | 🟡 Medium | Phase 3 |
| Logo placeholder is text only | 🟢 Low | Phase 4 |
| Missing integration tests | 🟡 Medium | Phase 5 |

---

## Phase 1: Schema Expansion (Critical)

### Objective
Expand the AI generation schema to support all 35 slide types with proper data structures.

### File: `server/prompts/slides.js`

---

### Task 1.1: Expand Slide Type Enum

**Current State:**
```javascript
type: {
  type: "string",
  enum: ["title", "content", "bullets", "quote"],
  description: "Slide layout type"
}
```

**Target State:**
```javascript
type: {
  type: "string",
  enum: [
    // Title Slides (1-4)
    "title",
    "titleWithImage",
    "titleVariantA",
    "titleVariantB",

    // Table of Contents (5-6)
    "contentsNav",
    "tableOfContents",

    // Content Slides (7-12)
    "bullets",
    "contentMultiColumn",
    "bulletsFull",
    "quote",
    "cardGrid",
    "contentWithImage",

    // Grid/Feature Slides (13-14)
    "featureGrid",
    "featureGridRed",

    // Process/Timeline Slides (15, 27-31)
    "timelineNumbered",
    "processSteps5",
    "processStepsAlt",
    "processStepsVertical",
    "rolloutGrid",
    "rolloutTimeline",

    // Quote/Data Slides (16-19)
    "quoteTwoColumn",
    "quoteWithMetrics",
    "quoteDataA",
    "quoteDataB",

    // Chart/Table Slides (20-21)
    "dualChart",
    "table",

    // Timeline Slides (22-26)
    "timelineCards",
    "timelineNumberedMarkers",
    "timelineCardsAlt",
    "timelinePhases",
    "stepsVertical",

    // Schedule Slides (32-33)
    "ganttChart",
    "rolloutDescription",

    // Closing Slides (34-35)
    "thankYou",
    "thankYouAlt"
  ],
  description: "Slide layout type - choose based on content structure"
}
```

---

### Task 1.2: Add Missing Data Properties to Schema

Add new properties to the slide item schema:

```javascript
// Base properties (already exist)
title: { type: "string", description: "Slide title or heading" },
subtitle: { type: "string", description: "Subtitle (for title slides)" },
content: { type: "string", description: "Text content for content slides" },
bullets: { type: "array", items: { type: "string" }, description: "Bullet points" },
quote: { type: "string", description: "Quote text for quote slides" },
attribution: { type: "string", description: "Quote attribution" },

// NEW: Section label (used by many slide types)
section: {
  type: "string",
  description: "Section label displayed in red at top of slide (e.g., 'MARKET ANALYSIS')"
},
sectionLabel: {
  type: "string",
  description: "Alias for section label"
},

// NEW: For titleWithImage slide
tagline: { type: "string", description: "Tagline text for title slides" },
businessArea: { type: "string", description: "Business area label" },
date: { type: "string", description: "Date string (e.g., 'January 2025')" },
image: { type: "string", description: "Image path or URL" },

// NEW: For contentMultiColumn slide
columns: {
  type: "array",
  items: { type: "string" },
  description: "Array of 2 column contents for multi-column layout"
},

// NEW: For contentsNav and tableOfContents
sections: {
  type: "array",
  items: {
    type: "object",
    properties: {
      number: { type: "string" },
      title: { type: "string" }
    }
  },
  description: "Table of contents sections"
},
items: {
  type: "array",
  items: { type: "string" },
  description: "List items (TOC items, timeline items, etc.)"
},

// NEW: For cardGrid slide
cards: {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string", description: "Card title" },
      content: { type: "string", description: "Card content/description" }
    }
  },
  description: "Array of cards for card grid layout (max 9)"
},

// NEW: For featureGrid slides
features: {
  type: "array",
  items: {
    type: "object",
    properties: {
      icon: { type: "string", description: "Icon character or placeholder" },
      title: { type: "string", description: "Feature title" },
      description: { type: "string", description: "Feature description" }
    }
  },
  description: "Array of features for feature grid (max 10)"
},
variant: {
  type: "string",
  enum: ["white", "red"],
  description: "Color variant for feature grid"
},

// NEW: For quoteTwoColumn slide
leftQuote: {
  type: "object",
  properties: {
    title: { type: "string" },
    text: { type: "string" },
    attribution: { type: "string" }
  },
  description: "Left column quote"
},
rightQuote: {
  type: "object",
  properties: {
    title: { type: "string" },
    text: { type: "string" },
    attribution: { type: "string" }
  },
  description: "Right column quote"
},
quotes: {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      text: { type: "string" },
      attribution: { type: "string" }
    }
  },
  description: "Alternative: array of 2 quotes for two-column layout"
},

// NEW: For quoteWithMetrics, quoteDataA, quoteDataB slides
metrics: {
  type: "array",
  items: {
    type: "object",
    properties: {
      value: { type: "string", description: "Metric value (e.g., '85%', '$2.5M')" },
      label: { type: "string", description: "Metric label/description" }
    }
  },
  description: "Array of metrics/KPIs (max 4)"
},
data: {
  type: "array",
  items: { type: "object" },
  description: "Alias for metrics array"
},

// NEW: For process/steps slides
steps: {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string", description: "Step title" },
      description: { type: "string", description: "Step description/content" }
    }
  },
  description: "Array of process steps"
},
description: {
  type: "string",
  description: "Description text for process slides"
},

// NEW: For timeline slides
timeline: {
  type: "array",
  items: {
    type: "object",
    properties: {
      date: { type: "string", description: "Date or phase label" },
      phase: { type: "string", description: "Phase name" },
      title: { type: "string", description: "Item title" },
      content: { type: "string", description: "Item content" },
      description: { type: "string", description: "Item description" }
    }
  },
  description: "Timeline items for timeline slides"
},

// NEW: For rollout/phase slides
phases: {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string", description: "Phase title" },
      name: { type: "string", description: "Phase name (alias for title)" },
      description: { type: "string", description: "Phase description" },
      content: { type: "string", description: "Phase content" },
      items: { type: "array", items: { type: "string" }, description: "Phase bullet items" },
      bullets: { type: "array", items: { type: "string" }, description: "Alias for items" },
      note: { type: "string", description: "Note text (e.g., date range)" },
      date: { type: "string", description: "Phase date" },
      label: { type: "string", description: "Phase label" },
      details: { type: "array", items: { type: "string" }, description: "Detailed items" },
      bgColor: { type: "string", description: "Background color override (hex without #)" },
      textColor: { type: "string", description: "Text color override (hex without #)" }
    }
  },
  description: "Array of phases for rollout slides"
},

// NEW: For ganttChart slide
activities: {
  type: "array",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Activity name" },
      title: { type: "string", description: "Activity title (alias for name)" },
      startMonth: { type: "number", description: "Start month (0-11)" },
      endMonth: { type: "number", description: "End month (0-11)" },
      color: { type: "string", description: "Bar color (hex without #)" }
    }
  },
  description: "Gantt chart activities"
},
months: {
  type: "array",
  items: { type: "string" },
  description: "Month labels for Gantt chart (defaults to Jan-Dec)"
},

// NEW: For table slide
headers: {
  type: "array",
  items: { type: "string" },
  description: "Table header row"
},
rows: {
  type: "array",
  items: {
    type: "array",
    items: { type: "string" }
  },
  description: "Table data rows"
},
colWidths: {
  type: "array",
  items: { type: "number" },
  description: "Column widths in inches"
},

// NEW: For dualChart slide
leftChart: {
  type: "object",
  properties: {
    title: { type: "string", description: "Left chart title" },
    source: { type: "string", description: "Data source citation" }
  },
  description: "Left chart configuration"
},
rightChart: {
  type: "object",
  properties: {
    title: { type: "string", description: "Right chart title" },
    source: { type: "string", description: "Data source citation" }
  },
  description: "Right chart configuration"
},
charts: {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      source: { type: "string" }
    }
  },
  description: "Alternative: array of 2 charts for dual chart layout"
},
text: {
  type: "string",
  description: "Additional text content"
},

// NEW: For thankYouAlt slide
contact: { type: "string", description: "Contact information" },
email: { type: "string", description: "Email address" },
qrCode: { type: "string", description: "QR code image path" },

// NEW: For contentsNav preview
previewNumber: { type: "string", description: "Preview section number" },
previewTitle: { type: "string", description: "Preview section title" }
```

---

### Task 1.3: Create Type-Specific Sub-Schemas

Create helper schemas for complex slide types to improve validation:

```javascript
// Card schema (used by cardGrid)
const cardSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    content: { type: "string" }
  },
  required: ["title"]
};

// Feature schema (used by featureGrid)
const featureSchema = {
  type: "object",
  properties: {
    icon: { type: "string" },
    title: { type: "string" },
    description: { type: "string" }
  },
  required: ["title"]
};

// Step schema (used by process/timeline slides)
const stepSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" }
  },
  required: ["title"]
};

// Metric schema (used by quote+metrics slides)
const metricSchema = {
  type: "object",
  properties: {
    value: { type: "string" },
    label: { type: "string" }
  },
  required: ["value", "label"]
};

// Phase schema (used by rollout slides)
const phaseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    items: { type: "array", items: { type: "string" } },
    note: { type: "string" }
  },
  required: ["title"]
};

// Activity schema (used by ganttChart)
const activitySchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    startMonth: { type: "number", minimum: 0, maximum: 11 },
    endMonth: { type: "number", minimum: 0, maximum: 11 }
  },
  required: ["name", "startMonth", "endMonth"]
};
```

---

### Task 1.4: Update Required Fields Logic

Update the schema to have conditional required fields based on type:

```javascript
// Add to slidesSchema
allOf: [
  {
    if: { properties: { type: { const: "cardGrid" } } },
    then: { required: ["type", "title", "cards"] }
  },
  {
    if: { properties: { type: { const: "featureGrid" } } },
    then: { required: ["type", "title", "features"] }
  },
  {
    if: { properties: { type: { const: "table" } } },
    then: { required: ["type", "title", "headers", "rows"] }
  },
  {
    if: { properties: { type: { const: "ganttChart" } } },
    then: { required: ["type", "title", "activities"] }
  },
  {
    if: { properties: { type: { const: "quoteTwoColumn" } } },
    then: { required: ["type", "title"], anyOf: [
      { required: ["leftQuote", "rightQuote"] },
      { required: ["quotes"] }
    ]}
  },
  {
    if: { properties: { type: { const: "quoteWithMetrics" } } },
    then: { required: ["type", "quote", "metrics"] }
  },
  {
    if: { properties: { type: { enum: ["timelineCards", "timelineCardsAlt", "timelinePhases", "timelineNumberedMarkers"] } } },
    then: { required: ["type", "title"], anyOf: [
      { required: ["items"] },
      { required: ["timeline"] },
      { required: ["steps"] }
    ]}
  },
  {
    if: { properties: { type: { enum: ["processSteps5", "processStepsAlt", "stepsVertical", "processStepsVertical"] } } },
    then: { required: ["type", "title", "steps"] }
  },
  {
    if: { properties: { type: { enum: ["rolloutGrid", "rolloutTimeline", "rolloutDescription"] } } },
    then: { required: ["type", "title", "phases"] }
  },
  {
    if: { properties: { type: { enum: ["contentsNav", "tableOfContents"] } } },
    then: { required: ["type"], anyOf: [
      { required: ["sections"] },
      { required: ["items"] }
    ]}
  },
  {
    if: { properties: { type: { const: "dualChart" } } },
    then: { required: ["type"], anyOf: [
      { required: ["leftChart", "rightChart"] },
      { required: ["charts"] }
    ]}
  }
]
```

---

### Deliverables - Phase 1
- [ ] Updated `slidesSchema` with all 35 slide types in enum
- [ ] All new property definitions added
- [ ] Type-specific sub-schemas created
- [ ] Conditional required fields implemented
- [ ] Schema exports updated

---

## Phase 2: AI Prompt Enhancement

### Objective
Update the AI system prompt to teach proper slide type selection and data structure requirements.

### File: `server/prompts/slides.js`

---

### Task 2.1: Create Slide Type Reference Guide

Add a comprehensive guide for when to use each slide type:

```javascript
const slideTypeGuide = `
## SLIDE TYPE SELECTION GUIDE

Choose the appropriate slide type based on your content structure:

### TITLE & OPENING SLIDES
| Type | Use When | Data Needed |
|------|----------|-------------|
| title | Opening slide, main presentation title | title, subtitle |
| titleWithImage | Title with hero image (split layout) | title, tagline, businessArea, date |
| titleVariantA | Alternative title with geometric pattern | title, date |
| titleVariantB | Alternative title, different pattern | title, subtitle, date |

### NAVIGATION SLIDES
| Type | Use When | Data Needed |
|------|----------|-------------|
| tableOfContents | Numbered list of sections | title, items[] |
| contentsNav | Interactive TOC with preview | sections[], previewNumber, previewTitle |

### CONTENT SLIDES
| Type | Use When | Data Needed |
|------|----------|-------------|
| bullets | Key points (3-6 bullets) | title, section, bullets[] |
| bulletsFull | Full-width bullets (more items) | title, section, bullets[] |
| content | Narrative paragraphs | title, section, content |
| contentMultiColumn | Two-column text layout | title, section, columns[] |
| contentWithImage | Text + image side by side | title, section, content, image |

### QUOTE SLIDES
| Type | Use When | Data Needed |
|------|----------|-------------|
| quote | Single impactful quote | title, section, quote, attribution |
| quoteTwoColumn | Two contrasting quotes | title, section, leftQuote{}, rightQuote{} |
| quoteWithMetrics | Quote + supporting KPIs | title, section, quote, attribution, metrics[] |
| quoteDataA | Quote + data cards | title, section, quote, attribution, metrics[] |
| quoteDataB | Quote + chart + metrics | title, section, quote, metrics[] |

### GRID & FEATURE SLIDES
| Type | Use When | Data Needed |
|------|----------|-------------|
| cardGrid | 3x3 grid of content cards | title, section, cards[] |
| featureGrid | Icon-based feature list (white bg) | title, section, features[] |
| featureGridRed | Icon-based feature list (red bg) | title, features[] |

### PROCESS & TIMELINE SLIDES
| Type | Use When | Data Needed |
|------|----------|-------------|
| processSteps5 | 5-step horizontal process (navy bg) | title, steps[] |
| processStepsAlt | Horizontal process (white bg, circles) | title, section, steps[] |
| stepsVertical | Vertical numbered steps | title, section, steps[] |
| timelineNumbered | Horizontal numbered timeline | title, section, steps[] |
| timelineCards | Timeline with alternating cards | title, section, items[] or timeline[] |
| timelineCardsAlt | Timeline with cards below | title, section, items[] or timeline[] |
| timelinePhases | Timeline with phase bars | title, section, phases[] |
| timelineNumberedMarkers | Timeline with numbered circles | title, section, steps[] |

### PLANNING & SCHEDULE SLIDES
| Type | Use When | Data Needed |
|------|----------|-------------|
| rolloutGrid | Phase boxes in grid layout | title, phases[] |
| rolloutTimeline | Horizontal phase timeline | title, phases[] |
| rolloutDescription | Phase cards with descriptions | title, phases[] |
| ganttChart | Gantt-style schedule | title, activities[], months[] |

### DATA & TABLE SLIDES
| Type | Use When | Data Needed |
|------|----------|-------------|
| table | Data table with headers | title, headers[], rows[][] |
| dualChart | Side-by-side charts | leftChart{}, rightChart{}, content |

### CLOSING SLIDES
| Type | Use When | Data Needed |
|------|----------|-------------|
| thankYou | Standard closing slide | title, contact |
| thankYouAlt | Closing with QR code | title, contact, qrCode |
`;
```

---

### Task 2.2: Update Main System Prompt

Replace the existing SLIDE TYPES section with expanded guidance:

```javascript
export const slidesPrompt = `You are an expert presentation designer...

${slideTypeGuide}

## SLIDE TYPE USAGE RULES

1. **ALWAYS START WITH**: type: "title" for the opening slide
2. **USE NAVIGATION**: Add "tableOfContents" after title for presentations with 10+ slides
3. **VARY YOUR LAYOUTS**: Don't use the same type for more than 3 consecutive slides
4. **MATCH CONTENT TO TYPE**:
   - Use "bullets" for 3-6 key points
   - Use "cardGrid" for 6-9 related concepts
   - Use "featureGrid" for listing capabilities/features
   - Use "quote" or "quoteTwoColumn" for impactful statements
   - Use "quoteWithMetrics" when quotes need supporting data
   - Use process/timeline slides for sequential information
   - Use "table" for comparative data
   - Use "ganttChart" for project schedules
5. **END APPROPRIATELY**: Use "thankYou" or "thankYouAlt" as final slide

## DATA STRUCTURE EXAMPLES

### cardGrid Example:
{
  "type": "cardGrid",
  "title": "Our Core Capabilities",
  "section": "CAPABILITIES",
  "cards": [
    { "title": "Innovation", "content": "Leading R&D investments..." },
    { "title": "Scale", "content": "Global operations across..." },
    { "title": "Expertise", "content": "500+ specialists in..." }
  ]
}

### featureGrid Example:
{
  "type": "featureGrid",
  "title": "Platform Features",
  "section": "FEATURES",
  "features": [
    { "icon": "1", "title": "Real-time Analytics", "description": "Live dashboards..." },
    { "icon": "2", "title": "AI-Powered", "description": "Machine learning..." }
  ]
}

### quoteTwoColumn Example:
{
  "type": "quoteTwoColumn",
  "title": "Industry Perspectives",
  "section": "INSIGHTS",
  "leftQuote": {
    "title": "Market Leader View",
    "text": "The transformation is accelerating...",
    "attribution": "CEO, Industry Leader"
  },
  "rightQuote": {
    "title": "Analyst Perspective",
    "text": "Growth projections indicate...",
    "attribution": "Senior Analyst, Research Firm"
  }
}

### quoteWithMetrics Example:
{
  "type": "quoteWithMetrics",
  "title": "Impact Statement",
  "section": "RESULTS",
  "quote": "Our digital transformation delivered unprecedented results...",
  "attribution": "Chief Digital Officer",
  "metrics": [
    { "value": "45%", "label": "Cost Reduction" },
    { "value": "$2.5M", "label": "Annual Savings" },
    { "value": "3x", "label": "Productivity Gain" }
  ]
}

### processSteps5 Example:
{
  "type": "processSteps5",
  "title": "Implementation Roadmap",
  "steps": [
    { "title": "Discovery", "description": "Assess current state..." },
    { "title": "Design", "description": "Define target architecture..." },
    { "title": "Build", "description": "Develop core components..." },
    { "title": "Deploy", "description": "Roll out to production..." },
    { "title": "Optimize", "description": "Continuous improvement..." }
  ]
}

### timelineCards Example:
{
  "type": "timelineCards",
  "title": "Project Timeline",
  "section": "TIMELINE",
  "items": [
    { "date": "Q1 2025", "title": "Phase 1", "content": "Foundation setup..." },
    { "date": "Q2 2025", "title": "Phase 2", "content": "Core development..." },
    { "date": "Q3 2025", "title": "Phase 3", "content": "Integration..." },
    { "date": "Q4 2025", "title": "Launch", "content": "Go-live..." }
  ]
}

### rolloutGrid Example:
{
  "type": "rolloutGrid",
  "title": "Rollout Plan",
  "phases": [
    { "title": "Phase 1: Pilot", "items": ["Select pilot sites", "Train key users", "Gather feedback"] },
    { "title": "Phase 2: Regional", "items": ["Expand to regions", "Scale support", "Refine processes"] },
    { "title": "Phase 3: Global", "items": ["Full deployment", "24/7 support", "Continuous optimization"] }
  ]
}

### ganttChart Example:
{
  "type": "ganttChart",
  "title": "Project Schedule",
  "activities": [
    { "name": "Planning", "startMonth": 0, "endMonth": 1 },
    { "name": "Development", "startMonth": 1, "endMonth": 5 },
    { "name": "Testing", "startMonth": 4, "endMonth": 7 },
    { "name": "Deployment", "startMonth": 7, "endMonth": 9 },
    { "name": "Support", "startMonth": 9, "endMonth": 11 }
  ]
}

### table Example:
{
  "type": "table",
  "title": "Competitive Analysis",
  "headers": ["Feature", "Us", "Competitor A", "Competitor B"],
  "rows": [
    ["Speed", "Fast", "Medium", "Slow"],
    ["Price", "$$$", "$$$$", "$$"],
    ["Support", "24/7", "Business hours", "Email only"]
  ]
}

### dualChart Example:
{
  "type": "dualChart",
  "leftChart": {
    "title": "Revenue Growth",
    "source": "Company Financial Reports 2024"
  },
  "rightChart": {
    "title": "Market Share",
    "source": "Industry Analysis Q4 2024"
  },
  "content": "Both metrics show strong upward trends..."
}
`;
```

---

### Task 2.3: Add Presentation Flow Templates

Provide example presentation structures:

```javascript
const presentationTemplates = `
## RECOMMENDED PRESENTATION STRUCTURES

### Strategy Presentation (12-15 slides)
1. title - Opening
2. tableOfContents - Navigation
3. bullets - Executive Summary
4. quote - Vision Statement
5. cardGrid - Strategic Pillars
6. processSteps5 - Implementation Approach
7. timelineCards - Key Milestones
8. quoteWithMetrics - Expected Outcomes
9. rolloutGrid - Deployment Plan
10. ganttChart - Timeline
11. bullets - Next Steps
12. thankYou - Closing

### Research Findings Presentation (10-12 slides)
1. title - Opening
2. bullets - Research Objectives
3. featureGrid - Methodology
4. quoteTwoColumn - Key Findings
5. table - Data Comparison
6. quoteDataA - Insight with Data
7. bullets - Implications
8. stepsVertical - Recommendations
9. bullets - Conclusions
10. thankYou - Closing

### Project Update Presentation (8-10 slides)
1. title - Opening
2. bullets - Agenda
3. processStepsAlt - Progress Overview
4. ganttChart - Schedule Status
5. quoteWithMetrics - Key Metrics
6. cardGrid - Achievements
7. bullets - Challenges & Mitigations
8. bullets - Next Steps
9. thankYou - Closing
`;
```

---

### Deliverables - Phase 2
- [ ] Slide type guide added to prompt
- [ ] Data structure examples for all complex types
- [ ] Presentation flow templates added
- [ ] Usage rules documented
- [ ] Examples cover all 35 slide types

---

## Phase 3: Code Fixes

### Objective
Fix hardcoded text, inconsistencies, and minor bugs in the export service.

### File: `server/templates/ppt-export-service.js`

---

### Task 3.1: Fix Hardcoded "LOREM IPSUM" in addBulletsSlide

**Location:** Line ~409

**Current:**
```javascript
slide.addText('LOREM IPSUM', {
  x: layout.elements.sectionLabel.x,
  // ...
```

**Fixed:**
```javascript
slide.addText(slideData.section?.toUpperCase() || slideData.sectionLabel?.toUpperCase() || '', {
  x: layout.elements.sectionLabel.x,
  // ...
```

---

### Task 3.2: Fix Hardcoded "LOREM IPSUM" in addContentSlide

**Location:** Line ~490

**Current:**
```javascript
slide.addText('LOREM IPSUM', {
  x: layout.elements.sectionLabel.x,
  // ...
```

**Fixed:**
```javascript
slide.addText(slideData.section?.toUpperCase() || slideData.sectionLabel?.toUpperCase() || '', {
  x: layout.elements.sectionLabel.x,
  // ...
```

---

### Task 3.3: Fix Hardcoded "LOREM IPSUM" in addQuoteSlide

**Location:** Line ~882

**Current:**
```javascript
slide.addText('LOREM IPSUM', {
  x: layout.elements.sectionLabel.x,
  // ...
```

**Fixed:**
```javascript
slide.addText(slideData.section?.toUpperCase() || slideData.sectionLabel?.toUpperCase() || '', {
  x: layout.elements.sectionLabel.x,
  // ...
```

---

### Task 3.4: Add Distinct timelineNumbered Implementation

**Issue:** Slide 15 (timelineNumbered) and Slide 23 (timelineNumberedMarkers) are treated as the same but have different layouts per spec.

**Solution:** Create separate implementation for timelineNumbered with its unique layout characteristics:

```javascript
// Add to switch statement (line ~161-163)
case 'timelineNumbered':
  addTimelineNumberedSlide(pptx, slideData, slideNumber);
  break;

// Add new function
function addTimelineNumberedSlide(pptx, slideData, slideNumber) {
  // Based on Slide 15 spec:
  // - Timeline with numbered steps
  // - Description text at top
  // - Different positioning than timelineNumberedMarkers
  const layout = LAYOUTS.steps; // Reuse steps layout as base
  const slide = pptx.addSlide();

  slide.background = { color: COLORS.white };

  // Title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 28,
      fontFace: FONTS.light,
      color: COLORS.navy,
      align: 'left'
    });
  }

  // Description
  if (slideData.description) {
    slide.addText(slideData.description, {
      x: 0.5, y: 1.2, w: 12, h: 1,
      fontSize: 11,
      fontFace: FONTS.regular,
      color: COLORS.navy
    });
  }

  // Steps with connecting lines
  const steps = slideData.steps || [];
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
      fontSize: 24,
      fontFace: FONTS.bold,
      color: COLORS.white,
      align: 'center'
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
    if (step.title) {
      slide.addText(step.title, {
        x: x - 0.5, y: startY + 1.3, w: 2, h: 0.5,
        fontSize: 12,
        fontFace: FONTS.semibold,
        color: COLORS.navy,
        align: 'center'
      });
    }

    // Step description
    if (step.description) {
      slide.addText(step.description, {
        x: x - 0.5, y: startY + 1.8, w: 2, h: 1.5,
        fontSize: 10,
        fontFace: FONTS.regular,
        color: COLORS.darkGray,
        align: 'center'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: 0.33, y: 7.15, w: 0.5, h: 0.2,
    fontSize: 8,
    fontFace: FONTS.regular,
    color: COLORS.darkGray,
    align: 'left'
  });

  addLogoPlaceholder(slide, { x: 12.5, y: 7.0, w: 0.69, h: 0.35 }, 'small');
}
```

---

### Task 3.5: Add sectionDivider to Switch Statement

**Issue:** sectionDivider layout exists but isn't accessible via type.

**Solution:** Add to switch:
```javascript
case 'sectionDivider':
case 'section':
  addSectionSlide(pptx, slideData, slideNumber);
  break;
```

---

### Deliverables - Phase 3
- [ ] Fixed 3 hardcoded "LOREM IPSUM" instances
- [ ] Added timelineNumbered as distinct implementation
- [ ] Added sectionDivider to switch statement
- [ ] All changes tested

---

## Phase 4: Logo Integration

### Objective
Replace text placeholder with actual logo image support.

### Files:
- `server/templates/ppt-export-service.js`
- New: `server/templates/assets/` directory

---

### Task 4.1: Create Assets Directory Structure

```
server/templates/
├── assets/
│   ├── logo-red.png       # Red logo for light backgrounds
│   ├── logo-white.png     # White logo for dark backgrounds
│   ├── logo-navy.png      # Navy logo variant
│   └── patterns/          # Geometric patterns (future)
│       ├── banner.png
│       └── accent.png
├── ppt-template-config.js
└── ppt-export-service.js
```

---

### Task 4.2: Update Logo Configuration

**Add to ppt-template-config.js:**
```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ASSETS = {
  logos: {
    red: path.join(__dirname, 'assets', 'logo-red.png'),
    white: path.join(__dirname, 'assets', 'logo-white.png'),
    navy: path.join(__dirname, 'assets', 'logo-navy.png')
  },
  patterns: {
    banner: path.join(__dirname, 'assets', 'patterns', 'banner.png'),
    accent: path.join(__dirname, 'assets', 'patterns', 'accent.png')
  }
};

// Logo size presets
export const LOGO_SIZES = {
  small: { w: 0.69, h: 0.35 },
  medium: { w: 0.69, h: 0.48 },
  large: { w: 2.0, h: 1.4 }
};
```

---

### Task 4.3: Update addLogoPlaceholder Function

**Replace current function:**
```javascript
import { ASSETS, LOGO_SIZES } from './ppt-template-config.js';
import fs from 'fs';

/**
 * Add logo to slide
 * @param {Object} slide - pptxgenjs slide object
 * @param {Object} position - x, y, w, h position
 * @param {string} size - 'small', 'medium', or 'large'
 * @param {string} variant - 'red', 'white', or 'navy' (defaults based on background)
 */
function addLogoPlaceholder(slide, position, size = 'medium', variant = null) {
  // Determine logo variant based on slide background if not specified
  const slideBackground = slide.background?.color;
  const isDarkBackground = slideBackground === COLORS.navy || slideBackground === COLORS.red;
  const logoVariant = variant || (isDarkBackground ? 'white' : 'red');

  const logoPath = ASSETS.logos[logoVariant];
  const dimensions = LOGO_SIZES[size] || LOGO_SIZES.medium;

  // Check if logo file exists
  if (logoPath && fs.existsSync(logoPath)) {
    slide.addImage({
      path: logoPath,
      x: position.x,
      y: position.y,
      w: position.w || dimensions.w,
      h: position.h || dimensions.h
    });
  } else {
    // Fallback to text placeholder
    const fontSize = size === 'large' ? 48 : size === 'small' ? 18 : 24;
    const textColor = isDarkBackground ? COLORS.white : COLORS.red;

    slide.addText('bip.', {
      x: position.x,
      y: position.y,
      w: position.w || dimensions.w,
      h: position.h || dimensions.h,
      fontSize: fontSize,
      fontFace: FONTS.bold,
      color: textColor,
      align: 'left',
      valign: 'middle'
    });
  }
}
```

---

### Task 4.4: Add Pattern Support for Geometric Elements

**Add helper function:**
```javascript
/**
 * Add geometric pattern to slide
 * @param {Object} slide - pptxgenjs slide object
 * @param {Object} position - x, y, w, h position
 * @param {string} patternType - 'banner' or 'accent'
 */
function addPatternPlaceholder(slide, position, patternType = 'banner') {
  const patternPath = ASSETS.patterns[patternType];

  if (patternPath && fs.existsSync(patternPath)) {
    slide.addImage({
      path: patternPath,
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h
    });
  } else {
    // Fallback to solid color placeholder
    slide.addShape('rect', {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      fill: { color: '4A5568' }  // Gray placeholder
    });
  }
}
```

---

### Deliverables - Phase 4
- [ ] Assets directory created
- [ ] Logo variants placed (or placeholder files)
- [ ] addLogoPlaceholder updated to use images
- [ ] addPatternPlaceholder helper added
- [ ] Graceful fallback when images missing

---

## Phase 5: Testing & Validation

### Objective
Create comprehensive tests to validate all slide types work correctly.

### Files:
- New: `tests/slides/`

---

### Task 5.1: Create Test Data for Each Slide Type

**File: `tests/slides/test-data.js`**

```javascript
export const testSlides = {
  // Title slides
  title: {
    type: 'title',
    title: 'Annual Strategy Review',
    subtitle: 'Building Tomorrow\'s Success'
  },

  titleWithImage: {
    type: 'titleWithImage',
    title: 'Market Expansion',
    tagline: 'GROWTH STRATEGY',
    businessArea: 'EMEA Region',
    date: 'January 2025'
  },

  // Content slides
  bullets: {
    type: 'bullets',
    title: 'Key Priorities',
    section: 'STRATEGIC PRIORITIES',
    bullets: [
      'Accelerate digital transformation',
      'Expand market presence',
      'Enhance customer experience',
      'Drive operational efficiency'
    ]
  },

  cardGrid: {
    type: 'cardGrid',
    title: 'Strategic Pillars',
    section: 'STRATEGY',
    cards: [
      { title: 'Innovation', content: 'Leading R&D investments...' },
      { title: 'Growth', content: 'Market expansion strategy...' },
      { title: 'Excellence', content: 'Operational improvements...' },
      { title: 'Talent', content: 'People development...' },
      { title: 'Sustainability', content: 'Environmental commitment...' },
      { title: 'Partnership', content: 'Strategic alliances...' }
    ]
  },

  featureGrid: {
    type: 'featureGrid',
    title: 'Platform Capabilities',
    section: 'FEATURES',
    features: [
      { icon: '1', title: 'Analytics', description: 'Real-time insights...' },
      { icon: '2', title: 'Automation', description: 'Workflow efficiency...' },
      { icon: '3', title: 'Integration', description: 'Seamless connectivity...' },
      { icon: '4', title: 'Security', description: 'Enterprise-grade...' },
      { icon: '5', title: 'Scalability', description: 'Global infrastructure...' }
    ]
  },

  quoteTwoColumn: {
    type: 'quoteTwoColumn',
    title: 'Leadership Perspectives',
    section: 'INSIGHTS',
    leftQuote: {
      title: 'CEO Statement',
      text: 'Our transformation journey has positioned us for unprecedented growth.',
      attribution: 'John Smith, CEO'
    },
    rightQuote: {
      title: 'CFO Analysis',
      text: 'Financial metrics confirm the success of our strategic initiatives.',
      attribution: 'Jane Doe, CFO'
    }
  },

  quoteWithMetrics: {
    type: 'quoteWithMetrics',
    title: 'Impact Summary',
    section: 'RESULTS',
    quote: 'The transformation delivered measurable results across all key performance indicators.',
    attribution: 'Chief Operating Officer',
    metrics: [
      { value: '35%', label: 'Efficiency Gain' },
      { value: '$4.2M', label: 'Cost Savings' },
      { value: '98%', label: 'Customer Satisfaction' },
      { value: '2x', label: 'Revenue Growth' }
    ]
  },

  processSteps5: {
    type: 'processSteps5',
    title: 'Implementation Framework',
    steps: [
      { title: 'Assess', description: 'Current state analysis' },
      { title: 'Design', description: 'Solution architecture' },
      { title: 'Build', description: 'Development & configuration' },
      { title: 'Test', description: 'Quality assurance' },
      { title: 'Deploy', description: 'Production rollout' }
    ]
  },

  timelineCards: {
    type: 'timelineCards',
    title: 'Project Milestones',
    section: 'TIMELINE',
    items: [
      { date: 'Q1', title: 'Phase 1', content: 'Foundation' },
      { date: 'Q2', title: 'Phase 2', content: 'Development' },
      { date: 'Q3', title: 'Phase 3', content: 'Testing' },
      { date: 'Q4', title: 'Launch', content: 'Go-Live' }
    ]
  },

  rolloutGrid: {
    type: 'rolloutGrid',
    title: 'Deployment Plan',
    phases: [
      { title: 'Pilot', items: ['Site A', 'Site B'], note: 'Month 1-2' },
      { title: 'Regional', items: ['EMEA', 'APAC'], note: 'Month 3-4' },
      { title: 'Global', items: ['Americas', 'All regions'], note: 'Month 5-6' }
    ]
  },

  ganttChart: {
    type: 'ganttChart',
    title: 'Project Schedule',
    activities: [
      { name: 'Planning', startMonth: 0, endMonth: 1 },
      { name: 'Design', startMonth: 1, endMonth: 3 },
      { name: 'Development', startMonth: 2, endMonth: 6 },
      { name: 'Testing', startMonth: 5, endMonth: 8 },
      { name: 'Deployment', startMonth: 8, endMonth: 10 },
      { name: 'Support', startMonth: 10, endMonth: 11 }
    ]
  },

  table: {
    type: 'table',
    title: 'Competitive Comparison',
    headers: ['Capability', 'Our Solution', 'Competitor A', 'Competitor B'],
    rows: [
      ['Performance', 'Excellent', 'Good', 'Average'],
      ['Scalability', 'Enterprise', 'Mid-market', 'SMB'],
      ['Support', '24/7', 'Business hours', 'Email only'],
      ['Price', '$$', '$$$', '$']
    ]
  },

  dualChart: {
    type: 'dualChart',
    leftChart: { title: 'Revenue Trend', source: 'Finance Report 2024' },
    rightChart: { title: 'Market Share', source: 'Industry Analysis Q4' },
    content: 'Both metrics demonstrate strong market position.'
  },

  thankYou: {
    type: 'thankYou',
    title: 'Thank You',
    contact: 'info@company.com | www.company.com'
  }
};
```

---

### Task 5.2: Create Export Test Suite

**File: `tests/slides/export.test.js`**

```javascript
import { generatePptx } from '../../server/templates/ppt-export-service.js';
import { testSlides } from './test-data.js';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './tests/slides/output';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

describe('PPT Export Service', () => {

  describe('Individual Slide Types', () => {
    Object.entries(testSlides).forEach(([slideType, slideData]) => {
      test(`generates ${slideType} slide`, async () => {
        const presentation = {
          title: `Test - ${slideType}`,
          slides: [slideData]
        };

        const buffer = await generatePptx(presentation);
        expect(buffer).toBeDefined();
        expect(buffer.length).toBeGreaterThan(0);

        // Save for manual inspection
        const outputPath = path.join(OUTPUT_DIR, `${slideType}.pptx`);
        fs.writeFileSync(outputPath, buffer);
      });
    });
  });

  describe('Full Presentation', () => {
    test('generates complete presentation with all slide types', async () => {
      const presentation = {
        title: 'Complete Template Test',
        slides: Object.values(testSlides)
      };

      const buffer = await generatePptx(presentation);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);

      const outputPath = path.join(OUTPUT_DIR, 'full-presentation.pptx');
      fs.writeFileSync(outputPath, buffer);
    });
  });

  describe('Edge Cases', () => {
    test('handles missing optional fields gracefully', async () => {
      const minimalSlide = {
        title: 'Minimal Test',
        slides: [
          { type: 'bullets', title: 'Test' }, // Missing bullets array
          { type: 'cardGrid', title: 'Cards' }, // Missing cards array
          { type: 'quote', title: 'Quote' } // Missing quote text
        ]
      };

      const buffer = await generatePptx(minimalSlide);
      expect(buffer).toBeDefined();
    });

    test('handles empty arrays', async () => {
      const emptyArrays = {
        title: 'Empty Arrays Test',
        slides: [
          { type: 'bullets', title: 'Empty Bullets', bullets: [] },
          { type: 'cardGrid', title: 'Empty Cards', cards: [] },
          { type: 'ganttChart', title: 'Empty Gantt', activities: [] }
        ]
      };

      const buffer = await generatePptx(emptyArrays);
      expect(buffer).toBeDefined();
    });

    test('handles very long text', async () => {
      const longText = {
        title: 'Long Text Test',
        slides: [{
          type: 'bullets',
          title: 'A'.repeat(200), // Very long title
          bullets: Array(10).fill('This is a very long bullet point that should wrap properly. '.repeat(3))
        }]
      };

      const buffer = await generatePptx(longText);
      expect(buffer).toBeDefined();
    });
  });
});
```

---

### Task 5.3: Create Schema Validation Tests

**File: `tests/slides/schema.test.js`**

```javascript
import Ajv from 'ajv';
import { slidesSchema } from '../../server/prompts/slides.js';
import { testSlides } from './test-data.js';

const ajv = new Ajv({ allErrors: true });

describe('Slides Schema Validation', () => {

  const validate = ajv.compile(slidesSchema);

  describe('Valid Slide Data', () => {
    Object.entries(testSlides).forEach(([slideType, slideData]) => {
      test(`validates ${slideType} slide data`, () => {
        const presentation = {
          title: 'Test',
          slides: [slideData],
          totalSlides: 1
        };

        const valid = validate(presentation);
        if (!valid) {
          console.log(`Validation errors for ${slideType}:`, validate.errors);
        }
        expect(valid).toBe(true);
      });
    });
  });

  describe('Invalid Slide Data', () => {
    test('rejects slide without type', () => {
      const invalid = {
        title: 'Test',
        slides: [{ title: 'Missing Type' }],
        totalSlides: 1
      };

      expect(validate(invalid)).toBe(false);
    });

    test('rejects invalid slide type', () => {
      const invalid = {
        title: 'Test',
        slides: [{ type: 'nonexistent', title: 'Invalid' }],
        totalSlides: 1
      };

      expect(validate(invalid)).toBe(false);
    });
  });
});
```

---

### Deliverables - Phase 5
- [ ] Test data for all 35 slide types
- [ ] Export test suite with individual slide tests
- [ ] Edge case tests (empty, long text, missing fields)
- [ ] Schema validation tests
- [ ] All tests passing

---

## Phase 6: Documentation & Cleanup

### Objective
Update documentation and clean up any remaining issues.

---

### Task 6.1: Update SLIDE_IMPLEMENTATION_PLAN.md

Update the implementation checklist to mark all phases complete:

```markdown
### Phase 1: Core Layouts (Already Implemented)
- [x] Title Slide (1)
- [x] Title with Image (2)
...

### Phase 6: Additional Variants
- [x] Title Variant A (3)
- [x] Title Variant B (4)
- [x] Contents Nav (5)
- [x] Thank You Alt (35)

### AI Integration (NEW)
- [x] Schema expanded to support all 35 types
- [x] AI prompt includes type selection guide
- [x] Data structure examples provided
```

---

### Task 6.2: Add JSDoc Comments to Schema

**In slides.js:**
```javascript
/**
 * @typedef {Object} SlideData
 * @property {string} type - Slide type (one of 35 supported types)
 * @property {string} title - Slide title
 * @property {string} [section] - Section label (displayed in red)
 * @property {string} [subtitle] - Subtitle for title slides
 * @property {string} [content] - Text content
 * @property {string[]} [bullets] - Bullet points array
 * @property {string} [quote] - Quote text
 * @property {string} [attribution] - Quote attribution
 * @property {Card[]} [cards] - Cards for cardGrid
 * @property {Feature[]} [features] - Features for featureGrid
 * @property {Step[]} [steps] - Steps for process slides
 * @property {Phase[]} [phases] - Phases for rollout slides
 * @property {Activity[]} [activities] - Activities for ganttChart
 * @property {string[]} [headers] - Table headers
 * @property {string[][]} [rows] - Table rows
 * @property {Metric[]} [metrics] - Metrics for data slides
 */
```

---

### Task 6.3: Create Developer README

**File: `server/templates/README.md`**

```markdown
# PPT Template System

## Overview
This system generates branded PowerPoint presentations from JSON slide data.

## Supported Slide Types
See `docs/SLIDE_IMPLEMENTATION_PLAN.md` for full list of 35 slide types.

## Quick Start

```javascript
import { generatePptx } from './ppt-export-service.js';

const slides = {
  title: 'My Presentation',
  slides: [
    { type: 'title', title: 'Welcome', subtitle: 'Introduction' },
    { type: 'bullets', title: 'Key Points', bullets: ['Point 1', 'Point 2'] },
    { type: 'thankYou', title: 'Thank You' }
  ]
};

const buffer = await generatePptx(slides);
```

## Adding New Slide Types
1. Add layout config to `ppt-template-config.js`
2. Add implementation to `ppt-export-service.js`
3. Add type to enum in `server/prompts/slides.js`
4. Add example to AI prompt
5. Add test data and tests

## Asset Integration
Place logo files in `server/templates/assets/`:
- `logo-red.png` - For light backgrounds
- `logo-white.png` - For dark backgrounds
- `logo-navy.png` - Alternative variant
```

---

### Deliverables - Phase 6
- [ ] SLIDE_IMPLEMENTATION_PLAN.md updated
- [ ] JSDoc comments added
- [ ] Developer README created
- [ ] Code cleanup complete

---

## Implementation Timeline

| Phase | Description | Estimated Effort |
|-------|-------------|-----------------|
| Phase 1 | Schema Expansion | 1 session |
| Phase 2 | AI Prompt Enhancement | 1 session |
| Phase 3 | Code Fixes | 0.5 session |
| Phase 4 | Logo Integration | 0.5 session |
| Phase 5 | Testing | 1-2 sessions |
| Phase 6 | Documentation | 0.5 session |

**Total: 4-6 sessions**

---

## Success Criteria

1. ✅ AI can generate all 35 slide types
2. ✅ All slide types render correctly in PowerPoint
3. ✅ No hardcoded placeholder text
4. ✅ Logo images display (when provided)
5. ✅ All tests pass
6. ✅ Documentation complete

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI doesn't use new types | Add explicit examples and usage rules to prompt |
| Schema too complex | Keep base fields simple, make advanced fields optional |
| Breaking existing functionality | Run existing tests after each change |
| Logo assets not available | Maintain text fallback for graceful degradation |

---

## Next Steps

1. Review this plan with stakeholders
2. Prioritize phases based on business need
3. Begin Phase 1: Schema Expansion
4. Track progress against deliverables
