/**
 * Slides Generation Prompt
 * Creates presentation slides from research content
 *
 * This module generates a structured slide deck suitable for presentation mode
 * Supports 35 slide types matching the BIP branded PowerPoint template
 */

// ============================================================================
// CANONICAL PROPERTY NAMES
// ============================================================================
/**
 * When generating slides, prefer these canonical property names over aliases:
 *
 * PROPERTY          | CANONICAL NAME | ALIASES (also accepted)
 * ----------------- | -------------- | -----------------------
 * Timeline items    | items          | timeline
 * Process steps     | steps          | items
 * Rollout phases    | phases         | items
 * Table rows        | rows           | data
 * Metrics/KPIs      | metrics        | data, cards
 * Content text      | content        | text
 * Quote text        | quote          | text
 * Section label     | section        | sectionLabel
 * Step description  | description    | content
 *
 * The renderers accept all aliases for flexibility, but the canonical names
 * should be preferred for consistency and clarity.
 */

// ============================================================================
// TYPE-SPECIFIC SUB-SCHEMAS
// ============================================================================

/**
 * Card schema (used by cardGrid)
 * @typedef {Object} Card
 * @property {string} title - Card title
 * @property {string} content - Card content/description
 */
const cardSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Card title" },
    content: { type: "string", description: "Card content/description" }
  },
  required: ["title"]
};

/**
 * Feature schema (used by featureGrid)
 * @typedef {Object} Feature
 * @property {string} icon - Icon character or number
 * @property {string} title - Feature title
 * @property {string} description - Feature description
 */
const featureSchema = {
  type: "object",
  properties: {
    icon: { type: "string", description: "Icon character or number (e.g., '1', '★')" },
    title: { type: "string", description: "Feature title" },
    description: { type: "string", description: "Feature description" }
  },
  required: ["title"]
};

/**
 * Step schema (used by process/timeline slides)
 * @typedef {Object} Step
 * @property {string} title - Step title
 * @property {string} description - Step description
 * @property {string} content - Alternative to description
 */
const stepSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Step title" },
    description: { type: "string", description: "Step description" },
    content: { type: "string", description: "Step content (alias for description)" }
  },
  required: ["title"]
};

/**
 * Metric schema (used by quote+metrics slides)
 * @typedef {Object} Metric
 * @property {string} value - Metric value (e.g., '85%', '$2.5M')
 * @property {string} label - Metric label/description
 * @property {string} title - Alternative to label
 */
const metricSchema = {
  type: "object",
  properties: {
    value: { type: "string", description: "Metric value (e.g., '85%', '$2.5M')" },
    label: { type: "string", description: "Metric label/description" },
    title: { type: "string", description: "Metric title (alias for label)" }
  },
  required: ["value"]
};

/**
 * Quote schema (used by quoteTwoColumn)
 * @typedef {Object} QuoteItem
 * @property {string} title - Quote section title
 * @property {string} text - Quote text
 * @property {string} quote - Alternative to text
 * @property {string} attribution - Quote source/author
 */
const quoteItemSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Quote section title" },
    text: { type: "string", description: "Quote text" },
    quote: { type: "string", description: "Quote text (alias for text)" },
    attribution: { type: "string", description: "Quote source/author" }
  },
  required: ["text"]
};

/**
 * Timeline item schema (used by timeline slides)
 * @typedef {Object} TimelineItem
 * @property {string} date - Date or time label
 * @property {string} phase - Phase name
 * @property {string} label - Item label
 * @property {string} title - Item title
 * @property {string} content - Item content
 * @property {string} description - Item description
 */
const timelineItemSchema = {
  type: "object",
  properties: {
    date: { type: "string", description: "Date or time label (e.g., 'Q1 2025')" },
    phase: { type: "string", description: "Phase name" },
    label: { type: "string", description: "Item label" },
    title: { type: "string", description: "Item title" },
    content: { type: "string", description: "Item content" },
    description: { type: "string", description: "Item description" }
  }
};

/**
 * Phase schema (used by rollout slides)
 * @typedef {Object} Phase
 * @property {string} title - Phase title
 * @property {string} name - Phase name (alias for title)
 * @property {string} description - Phase description
 * @property {string} content - Phase content
 * @property {string[]} items - Phase bullet items
 * @property {string[]} bullets - Alias for items
 * @property {string[]} details - Detailed items
 * @property {string} note - Note text (e.g., date range)
 * @property {string} date - Phase date
 * @property {string} label - Phase label
 * @property {string} bgColor - Background color override (hex without #)
 * @property {string} textColor - Text color override (hex without #)
 * @property {string} noteColor - Note color override (hex without #)
 */
const phaseSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Phase title" },
    name: { type: "string", description: "Phase name (alias for title)" },
    description: { type: "string", description: "Phase description" },
    content: { type: "string", description: "Phase content" },
    items: { type: "array", items: { type: "string" }, description: "Phase bullet items" },
    bullets: { type: "array", items: { type: "string" }, description: "Alias for items" },
    details: { type: "array", items: { type: "string" }, description: "Detailed items" },
    note: { type: "string", description: "Note text (e.g., date range)" },
    date: { type: "string", description: "Phase date" },
    label: { type: "string", description: "Phase label" },
    bgColor: { type: "string", description: "Background color override (hex without #)" },
    textColor: { type: "string", description: "Text color override (hex without #)" },
    noteColor: { type: "string", description: "Note color override (hex without #)" }
  }
};

/**
 * Activity schema (used by ganttChart)
 * @typedef {Object} Activity
 * @property {string} name - Activity name
 * @property {string} title - Activity title (alias for name)
 * @property {number} startMonth - Start month (0-11)
 * @property {number} endMonth - End month (0-11)
 * @property {string} color - Bar color (hex without #)
 */
const activitySchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Activity name" },
    title: { type: "string", description: "Activity title (alias for name)" },
    startMonth: { type: "number", minimum: 0, maximum: 11, description: "Start month (0=Jan, 11=Dec)" },
    endMonth: { type: "number", minimum: 0, maximum: 11, description: "End month (0=Jan, 11=Dec)" },
    color: { type: "string", description: "Bar color (hex without #)" }
  },
  required: ["name", "startMonth", "endMonth"]
};

/**
 * Chart config schema (used by dualChart)
 * @typedef {Object} ChartConfig
 * @property {string} title - Chart title
 * @property {string} source - Data source citation
 */
const chartConfigSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Chart title" },
    source: { type: "string", description: "Data source citation" }
  }
};

/**
 * Section schema (used by contentsNav)
 * @typedef {Object} Section
 * @property {string} number - Section number
 * @property {string} title - Section title
 */
const sectionSchema = {
  type: "object",
  properties: {
    number: { type: "string", description: "Section number" },
    title: { type: "string", description: "Section title" }
  },
  required: ["title"]
};

// ============================================================================
// MAIN SLIDES SCHEMA
// ============================================================================

/**
 * Complete Slides JSON Schema
 * Supports all 35 slide types from the BIP branded template
 */
export const slidesSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Main presentation title"
    },
    subtitle: {
      type: "string",
      description: "Presentation subtitle or tagline"
    },
    slides: {
      type: "array",
      minItems: 3,
      maxItems: 15,
      items: {
        type: "object",
        properties: {
          // ================================================================
          // CORE PROPERTIES (used by most slide types)
          // ================================================================
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
              "content",

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
              "thankYouAlt",

              // Section divider
              "sectionDivider",

              // Aliases
              "toc",
              "steps",
              "process",
              "timeline",
              "gantt",
              "dataTable"
            ],
            description: "Slide layout type - choose based on content structure"
          },
          title: {
            type: "string",
            description: "Slide title or heading"
          },
          subtitle: {
            type: "string",
            description: "Subtitle (for title slides)"
          },

          // ================================================================
          // SECTION LABEL (displayed in red at top of many slides)
          // ================================================================
          section: {
            type: "string",
            description: "Section label displayed in red at top of slide (e.g., 'MARKET ANALYSIS')"
          },
          sectionLabel: {
            type: "string",
            description: "Alias for section label"
          },

          // ================================================================
          // BASIC CONTENT PROPERTIES
          // ================================================================
          content: {
            type: "string",
            description: "Text content for content slides"
          },
          text: {
            type: "string",
            description: "Alternative text content field"
          },
          description: {
            type: "string",
            description: "Description text (for process slides)"
          },
          bullets: {
            type: "array",
            items: { type: "string" },
            description: "Bullet points for bullet slides (3-6 items recommended)"
          },

          // ================================================================
          // QUOTE PROPERTIES
          // ================================================================
          quote: {
            type: "string",
            description: "Quote text for quote slides"
          },
          attribution: {
            type: "string",
            description: "Quote attribution (source/author)"
          },

          // ================================================================
          // TITLE SLIDE PROPERTIES (titleWithImage, titleVariantA/B)
          // ================================================================
          tagline: {
            type: "string",
            description: "Tagline text for title slides"
          },
          businessArea: {
            type: "string",
            description: "Business area label"
          },
          date: {
            type: "string",
            description: "Date string (e.g., 'January 2025')"
          },
          image: {
            type: "string",
            description: "Image path or URL for slides with images"
          },

          // ================================================================
          // MULTI-COLUMN CONTENT (contentMultiColumn)
          // ================================================================
          columns: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 2,
            description: "Array of 2 column contents for multi-column layout"
          },

          // ================================================================
          // TABLE OF CONTENTS (contentsNav, tableOfContents)
          // ================================================================
          sections: {
            type: "array",
            items: sectionSchema,
            description: "Table of contents sections with number and title"
          },
          items: {
            type: "array",
            items: {
              oneOf: [
                { type: "string" },
                timelineItemSchema
              ]
            },
            description: "List items (TOC items, timeline items, etc.)"
          },
          previewNumber: {
            type: "string",
            description: "Preview section number for contentsNav"
          },
          previewTitle: {
            type: "string",
            description: "Preview section title for contentsNav"
          },

          // ================================================================
          // CARD GRID (cardGrid)
          // ================================================================
          cards: {
            type: "array",
            items: cardSchema,
            maxItems: 9,
            description: "Array of cards for card grid layout (max 9, 3x3 grid)"
          },

          // ================================================================
          // FEATURE GRID (featureGrid, featureGridRed)
          // ================================================================
          features: {
            type: "array",
            items: featureSchema,
            maxItems: 10,
            description: "Array of features for feature grid (max 10)"
          },
          variant: {
            type: "string",
            enum: ["white", "red"],
            description: "Color variant for feature grid (white or red background)"
          },

          // ================================================================
          // QUOTE VARIATIONS (quoteTwoColumn, quoteWithMetrics, quoteDataA/B)
          // ================================================================
          leftQuote: {
            ...quoteItemSchema,
            description: "Left column quote for quoteTwoColumn"
          },
          rightQuote: {
            ...quoteItemSchema,
            description: "Right column quote for quoteTwoColumn"
          },
          quotes: {
            type: "array",
            items: quoteItemSchema,
            minItems: 2,
            maxItems: 2,
            description: "Array of 2 quotes for quoteTwoColumn layout"
          },

          // ================================================================
          // METRICS/DATA (quoteWithMetrics, quoteDataA, quoteDataB)
          // ================================================================
          metrics: {
            type: "array",
            items: metricSchema,
            maxItems: 4,
            description: "Array of metrics/KPIs (max 4)"
          },
          data: {
            type: "array",
            items: metricSchema,
            description: "Alias for metrics array"
          },

          // ================================================================
          // PROCESS/STEPS (processSteps5, processStepsAlt, stepsVertical, etc.)
          // ================================================================
          steps: {
            type: "array",
            items: stepSchema,
            description: "Array of process steps"
          },

          // ================================================================
          // TIMELINE (timelineCards, timelineCardsAlt, timelinePhases, etc.)
          // ================================================================
          timeline: {
            type: "array",
            items: timelineItemSchema,
            description: "Timeline items for timeline slides"
          },

          // ================================================================
          // PHASES/ROLLOUT (rolloutGrid, rolloutTimeline, rolloutDescription)
          // ================================================================
          phases: {
            type: "array",
            items: phaseSchema,
            description: "Array of phases for rollout slides"
          },

          // ================================================================
          // GANTT CHART (ganttChart)
          // ================================================================
          activities: {
            type: "array",
            items: activitySchema,
            description: "Gantt chart activities with start/end months"
          },
          months: {
            type: "array",
            items: { type: "string" },
            description: "Month labels for Gantt chart (defaults to Jan-Dec)"
          },

          // ================================================================
          // TABLE (table)
          // ================================================================
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
            description: "Table data rows (2D array)"
          },
          colWidths: {
            type: "array",
            items: { type: "number" },
            description: "Column widths in inches (optional)"
          },

          // ================================================================
          // DUAL CHART (dualChart)
          // ================================================================
          leftChart: {
            ...chartConfigSchema,
            description: "Left chart configuration"
          },
          rightChart: {
            ...chartConfigSchema,
            description: "Right chart configuration"
          },
          charts: {
            type: "array",
            items: chartConfigSchema,
            minItems: 2,
            maxItems: 2,
            description: "Array of 2 charts for dual chart layout"
          },

          // ================================================================
          // THANK YOU (thankYou, thankYouAlt)
          // ================================================================
          contact: {
            type: "string",
            description: "Contact information for closing slide"
          },
          email: {
            type: "string",
            description: "Email address for closing slide"
          },
          qrCode: {
            type: "string",
            description: "QR code image path for thankYouAlt slide"
          }
        },
        required: ["type", "title"]
      }
    },
    totalSlides: {
      type: "number",
      description: "Total number of slides"
    }
  },
  required: ["title", "slides", "totalSlides"]
};

// ============================================================================
// SLIDE TYPE GUIDE (for AI prompt)
// ============================================================================

export const slideTypeGuide = `
## SLIDE TYPE SELECTION GUIDE

Choose the appropriate slide type based on your content structure:

### TITLE & OPENING SLIDES
| Type | Use When | Required Data |
|------|----------|---------------|
| title | Opening slide, main presentation title | title, subtitle |
| titleWithImage | Title with hero image (split layout) | title, tagline, businessArea, date |
| titleVariantA | Alternative title with geometric pattern | title, date |
| titleVariantB | Alternative title, different pattern | title, subtitle |

### NAVIGATION SLIDES
| Type | Use When | Required Data |
|------|----------|---------------|
| tableOfContents | Numbered list of sections | title, items[] (strings) |
| contentsNav | Interactive TOC with preview | title, sections[] ({title}) |

### CONTENT SLIDES
| Type | Use When | Required Data |
|------|----------|---------------|
| bullets | Key points (3-6 bullets) | title, section, bullets[] |
| bulletsFull | Full-width bullets (more items) | title, section, bullets[] |
| content | Narrative paragraphs | title, section, content |
| contentMultiColumn | Two-column text layout | title, section, columns[] |
| contentWithImage | Text + image side by side | title, section, content, image |

### QUOTE SLIDES
| Type | Use When | Required Data |
|------|----------|---------------|
| quote | Single impactful quote | title, section, quote, attribution |
| quoteTwoColumn | Two contrasting quotes | title, section, leftQuote{}, rightQuote{} |
| quoteWithMetrics | Quote + supporting KPIs | title, section, quote, attribution, metrics[] |
| quoteDataA | Quote + data cards | title, section, quote, metrics[] |
| quoteDataB | Quote + chart area + metrics | title, section, quote, metrics[] |

### GRID & FEATURE SLIDES
| Type | Use When | Required Data |
|------|----------|---------------|
| cardGrid | 3x3 grid of content cards | title, section, cards[] ({title, content}) |
| featureGrid | Icon-based features (white bg) | title, section, features[] ({icon, title, description}) |
| featureGridRed | Icon-based features (red bg) | title, features[] |

### PROCESS & STEP SLIDES
| Type | Use When | Required Data |
|------|----------|---------------|
| steps | Horizontal process flow (red bg) | title, description, steps[] ({title, description}) |
| process | Alias for steps | title, description, steps[] ({title, description}) |
| processSteps5 | Horizontal 5-step process (navy bg) | title, steps[] ({title, description}) |
| processStepsAlt | Horizontal process (white bg) | title, section, steps[] |
| stepsVertical | Vertical numbered steps | title, section, steps[] |
| timelineNumbered | Horizontal numbered timeline | title, description, steps[] |

### TIMELINE SLIDES
| Type | Use When | Required Data |
|------|----------|---------------|
| timelineCards | Timeline with alternating cards | title, section, items[] ({date, title, content}) |
| timelineCardsAlt | Timeline with cards below | title, section, items[] |
| timelinePhases | Timeline with phase bars | title, section, phases[] ({label, details}) |
| timelineNumberedMarkers | Timeline with numbered circles | title, section, steps[] |

### PLANNING & SCHEDULE SLIDES
| Type | Use When | Required Data |
|------|----------|---------------|
| rolloutGrid | Phase boxes in grid layout | title, phases[] ({title, items[], note}) |
| rolloutTimeline | Horizontal phase timeline | title, phases[] ({title, details}) |
| rolloutDescription | Phase cards with descriptions | title, phases[] ({title, description, note}) |
| ganttChart | Gantt-style schedule | title, activities[] ({name, startMonth, endMonth}) |

### DATA & TABLE SLIDES
| Type | Use When | Required Data |
|------|----------|---------------|
| table | Data table with headers | title, headers[], rows[][] |
| dualChart | Side-by-side charts | leftChart{title, source}, rightChart{} |

### CLOSING SLIDES
| Type | Use When | Required Data |
|------|----------|---------------|
| thankYou | Standard closing slide | title |
| thankYouAlt | Closing with QR code | title, contact |

### SECTION DIVIDERS
| Type | Use When | Required Data |
|------|----------|---------------|
| sectionDivider | Break between major sections | title |
`;

// ============================================================================
// DATA STRUCTURE EXAMPLES (for AI prompt)
// ============================================================================

export const dataStructureExamples = `
## DATA STRUCTURE EXAMPLES

### titleWithImage Example:
{
  "type": "titleWithImage",
  "title": "Digital Transformation Journey",
  "tagline": "INNOVATION STRATEGY",
  "businessArea": "Technology Division",
  "date": "January 2025"
}

### tableOfContents Example:
{
  "type": "tableOfContents",
  "title": "Agenda",
  "items": ["Executive Summary", "Market Analysis", "Strategic Priorities", "Implementation Plan", "Next Steps"]
}

### contentsNav Example:
{
  "type": "contentsNav",
  "title": "Contents",
  "sections": [
    { "title": "Introduction" },
    { "title": "Market Overview" },
    { "title": "Our Approach" },
    { "title": "Timeline" },
    { "title": "Conclusions" }
  ],
  "previewNumber": "01",
  "previewTitle": "Introduction"
}

### bullets Example:
{
  "type": "bullets",
  "title": "Key Strategic Priorities",
  "section": "STRATEGY",
  "bullets": [
    "Accelerate digital transformation across all business units",
    "Expand market presence in emerging regions",
    "Enhance customer experience through AI-driven personalization",
    "Drive operational efficiency with automation"
  ]
}

### contentMultiColumn Example:
{
  "type": "contentMultiColumn",
  "title": "Market Dynamics",
  "section": "ANALYSIS",
  "columns": [
    "The global market is experiencing unprecedented growth driven by digital adoption. Key players are investing heavily in technology infrastructure to maintain competitive advantage.",
    "Consumer behavior has shifted dramatically toward online channels. Organizations must adapt their strategies to meet evolving customer expectations and preferences."
  ]
}

### stepsVertical Example:
{
  "type": "stepsVertical",
  "title": "Implementation Approach",
  "section": "METHODOLOGY",
  "steps": [
    { "title": "Assessment", "description": "Evaluate current state and identify gaps" },
    { "title": "Planning", "description": "Define roadmap and resource requirements" },
    { "title": "Execution", "description": "Implement changes in phased approach" },
    { "title": "Validation", "description": "Test and verify outcomes against targets" }
  ]
}

### quoteDataA Example:
{
  "type": "quoteDataA",
  "title": "Market Insight",
  "section": "RESEARCH",
  "quote": "Organizations that embrace digital transformation see 2x revenue growth compared to laggards",
  "attribution": "Industry Research Report 2024",
  "metrics": [
    { "value": "67%", "label": "Adoption Rate" },
    { "value": "2.3x", "label": "ROI Improvement" },
    { "value": "45%", "label": "Cost Savings" }
  ]
}

### rolloutTimeline Example:
{
  "type": "rolloutTimeline",
  "title": "Deployment Roadmap",
  "phases": [
    { "title": "Phase 1", "details": ["Pilot launch", "Initial testing", "Feedback collection"] },
    { "title": "Phase 2", "details": ["Regional expansion", "Team training", "Process refinement"] },
    { "title": "Phase 3", "details": ["Global rollout", "Full integration", "Ongoing optimization"] }
  ]
}

### cardGrid Example:
{
  "type": "cardGrid",
  "title": "Our Core Capabilities",
  "section": "CAPABILITIES",
  "cards": [
    { "title": "Innovation", "content": "Leading R&D investments driving breakthrough solutions" },
    { "title": "Scale", "content": "Global operations across 50+ countries" },
    { "title": "Expertise", "content": "500+ specialists across key domains" }
  ]
}

### featureGrid Example:
{
  "type": "featureGrid",
  "title": "Platform Features",
  "section": "FEATURES",
  "features": [
    { "icon": "1", "title": "Real-time Analytics", "description": "Live dashboards with instant insights" },
    { "icon": "2", "title": "AI-Powered", "description": "Machine learning for predictive analysis" },
    { "icon": "3", "title": "Secure", "description": "Enterprise-grade security protocols" }
  ]
}

### quoteTwoColumn Example:
{
  "type": "quoteTwoColumn",
  "title": "Industry Perspectives",
  "section": "INSIGHTS",
  "leftQuote": {
    "title": "Market Leader View",
    "text": "The transformation is accelerating beyond expectations",
    "attribution": "CEO, Industry Leader"
  },
  "rightQuote": {
    "title": "Analyst Perspective",
    "text": "Growth projections indicate 40% CAGR through 2027",
    "attribution": "Senior Analyst, Research Firm"
  }
}

### quoteWithMetrics Example:
{
  "type": "quoteWithMetrics",
  "title": "Impact Statement",
  "section": "RESULTS",
  "quote": "Our digital transformation delivered unprecedented results across all key metrics",
  "attribution": "Chief Digital Officer",
  "metrics": [
    { "value": "45%", "label": "Cost Reduction" },
    { "value": "$2.5M", "label": "Annual Savings" },
    { "value": "3x", "label": "Productivity Gain" }
  ]
}

### steps Example (horizontal process flow with red background):
{
  "type": "steps",
  "title": "Our Approach",
  "description": "A proven methodology for successful transformation",
  "steps": [
    { "title": "Assess", "description": "Evaluate current state" },
    { "title": "Plan", "description": "Define strategy" },
    { "title": "Execute", "description": "Implement solutions" },
    { "title": "Measure", "description": "Track outcomes" },
    { "title": "Refine", "description": "Optimize results" }
  ]
}

### processSteps5 Example:
{
  "type": "processSteps5",
  "title": "Implementation Roadmap",
  "steps": [
    { "title": "Discovery", "description": "Assess current state and requirements" },
    { "title": "Design", "description": "Define target architecture" },
    { "title": "Build", "description": "Develop core components" },
    { "title": "Deploy", "description": "Roll out to production" },
    { "title": "Optimize", "description": "Continuous improvement" }
  ]
}

### timelineCards Example:
{
  "type": "timelineCards",
  "title": "Project Timeline",
  "section": "TIMELINE",
  "items": [
    { "date": "Q1 2025", "title": "Phase 1", "content": "Foundation and setup" },
    { "date": "Q2 2025", "title": "Phase 2", "content": "Core development" },
    { "date": "Q3 2025", "title": "Phase 3", "content": "Integration testing" },
    { "date": "Q4 2025", "title": "Launch", "content": "Production go-live" }
  ]
}

### rolloutGrid Example:
{
  "type": "rolloutGrid",
  "title": "Deployment Plan",
  "phases": [
    { "title": "Phase 1: Pilot", "items": ["Select pilot sites", "Train key users", "Gather feedback"], "note": "Month 1-2" },
    { "title": "Phase 2: Regional", "items": ["Expand to regions", "Scale support"], "note": "Month 3-4" },
    { "title": "Phase 3: Global", "items": ["Full deployment", "24/7 support"], "note": "Month 5-6" }
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
  "headers": ["Feature", "Our Solution", "Competitor A", "Competitor B"],
  "rows": [
    ["Performance", "Excellent", "Good", "Average"],
    ["Scalability", "Enterprise", "Mid-market", "SMB"],
    ["Support", "24/7", "Business hours", "Email only"],
    ["Price", "$$", "$$$", "$"]
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
  "content": "Both metrics demonstrate strong market positioning"
}
`;

// ============================================================================
// PRESENTATION FLOW TEMPLATES (for AI prompt)
// ============================================================================

export const presentationTemplates = `
## RECOMMENDED PRESENTATION STRUCTURES

### Strategy Presentation (12-15 slides)
1. title - Opening with main theme
2. tableOfContents - Navigation overview
3. bullets - Executive Summary
4. quote - Vision Statement
5. cardGrid - Strategic Pillars (3-6 items)
6. processSteps5 - Implementation Approach
7. timelineCards - Key Milestones
8. quoteWithMetrics - Expected Outcomes
9. rolloutGrid - Deployment Plan
10. ganttChart - Timeline/Schedule
11. bullets - Next Steps
12. thankYou - Closing

### Research Findings Presentation (10-12 slides)
1. title - Opening
2. bullets - Research Objectives
3. featureGrid - Methodology
4. quoteTwoColumn - Key Findings
5. table - Data Comparison
6. quoteDataA - Insight with Supporting Data
7. bullets - Implications
8. stepsVertical - Recommendations
9. bullets - Conclusions
10. thankYou - Closing

### Project Update Presentation (8-10 slides)
1. title - Opening
2. bullets - Agenda/Overview
3. processStepsAlt - Progress Status
4. ganttChart - Schedule Update
5. quoteWithMetrics - Key Metrics
6. cardGrid - Achievements
7. bullets - Challenges & Mitigations
8. bullets - Next Steps
9. thankYou - Closing

### Executive Summary (6-8 slides)
1. title - Opening
2. bullets - Key Points
3. quoteWithMetrics - Critical Metrics
4. cardGrid - Main Themes
5. bullets - Recommendations
6. thankYou - Closing
`;

// ============================================================================
// MAIN SLIDES PROMPT
// ============================================================================

/**
 * Slides Generation System Prompt
 */
export const slidesPrompt = `You are an expert presentation designer. Your job is to analyze research content and create a professional, engaging slide deck using the appropriate slide types.

You MUST respond with *only* a valid JSON object matching the schema.

## CRITICAL SOURCE RESTRICTION

**You MUST base your slides EXCLUSIVELY on the user-uploaded research content provided below.**

- DO NOT include any information, statistics, or claims from external sources
- DO NOT use your training data or general knowledge to supplement the content
- DO NOT invent, fabricate, or extrapolate data beyond what is explicitly stated in the research
- EVERY statistic, company name, insight, and claim MUST be directly traceable to the provided research files
- If the research does not contain sufficient content for a section, reduce the number of slides rather than filling gaps with external knowledge

${slideTypeGuide}

${dataStructureExamples}

${presentationTemplates}

## SLIDE TYPE USAGE RULES

1. **ALWAYS START WITH**: type: "title" for the opening slide
2. **USE NAVIGATION**: Add "tableOfContents" after title for presentations with 10+ slides
3. **VARY YOUR LAYOUTS**: Don't use the same type for more than 3 consecutive slides
4. **MATCH CONTENT TO TYPE**:
   - Use "bullets" for 3-6 key points
   - Use "cardGrid" for 6-9 related concepts that can be displayed as cards
   - Use "featureGrid" for listing capabilities/features with icons
   - Use "quote" or "quoteTwoColumn" for impactful statements
   - Use "quoteWithMetrics" when quotes need supporting numerical data
   - Use process/timeline slides for sequential information
   - Use "table" for comparative data with multiple columns
   - Use "ganttChart" for project schedules with time-based activities
5. **END APPROPRIATELY**: Use "thankYou" as final slide
6. **USE SECTION LABELS**: Include "section" field for content slides (displayed in red at top)

## COMMON MISTAKES TO AVOID

1. **DON'T use "bullets" for everything** - Vary your slide types to keep the presentation engaging
2. **DON'T overload slides** - Max 6 bullets, 9 cards, 4 metrics, 7 steps per slide
3. **DON'T use complex types for simple content** - Use "bullets" for basic lists, not "cardGrid"
4. **DON'T forget section labels** - Include "section" for content slides to show context
5. **DON'T use timeline slides without dates** - Timeline items should have date/phase labels
6. **DON'T use ganttChart without proper month data** - Activities need startMonth and endMonth (0-11)
7. **DON'T mix incompatible data** - Each slide type expects specific data structures
8. **DON'T use "content" type when "bullets" would work** - Bullets are more scannable

## CHOOSING BETWEEN SIMILAR TYPES

| If you have... | Use this type | Not this |
|----------------|---------------|----------|
| 3-6 simple points | bullets | cardGrid |
| 6-9 themed concepts with descriptions | cardGrid | bullets |
| Capabilities with icons | featureGrid | cardGrid |
| Sequential steps (3-5) | processSteps5 | stepsVertical |
| Sequential steps (4-8) | stepsVertical | processSteps5 |
| Timeline with details | timelineCards | timelineNumberedMarkers |
| Simple timeline | timelineNumberedMarkers | timelineCards |
| Quote + numbers | quoteWithMetrics | quote |
| Two contrasting quotes | quoteTwoColumn | quote (twice) |
| Phase-based plan | rolloutGrid | bullets |
| Monthly schedule | ganttChart | rolloutTimeline |
| Comparison data | table | bullets |

## EDGE CASES

1. **Empty arrays**: If you have no items for cards/features/steps, use a simpler slide type instead
2. **Single item**: Don't use grid layouts for just 1 item - use bullets or content instead
3. **Too many items**: Split across multiple slides rather than exceeding limits
4. **No metrics available**: Use "quote" instead of "quoteWithMetrics"
5. **No timeline dates**: Use "processSteps5" or "stepsVertical" instead of timeline types
6. **Simple vs complex**: When in doubt, use simpler types (bullets, content, quote)

## CONTENT RULES

- **Brevity**: Each bullet should be concise (1-2 lines max)
- **Clarity**: Use clear, simple language - avoid jargon
- **Hierarchy**: Organize from high-level concepts to details
- **Impact**: Lead with the most important insights
- **Balance**: Don't overload any single slide
- Cards: Max 9 items for cardGrid, max 10 for featureGrid
- Metrics: Max 4 items for metric displays
- Steps: 3-7 steps for process slides work best
- Tables: Keep to 4-6 columns and 5-8 rows max

## SANITIZATION

- All strings must be valid JSON
- Properly escape quotes and special characters
- No raw newlines in strings (use \\n if needed)

## OUTPUT REQUIREMENTS

- **CRITICAL: Generate between 7-12 slides total. NEVER exceed 15 slides.**
- Set totalSlides to the length of the slides array
- Every slide must have at least a type and title
- Every content slide must have content (bullets, cards, steps, etc.) - never leave slides empty
- Use appropriate slide types based on content structure
- Ensure smooth narrative progression
- Include "section" labels for content slides

## SLIDE COUNT GUIDELINES

- Executive summaries: 6-8 slides
- Standard presentations: 8-12 slides
- Detailed presentations: 12-15 slides max
- **NEVER generate more than 15 slides - consolidate information instead**
- If you have too much content, prioritize and combine related topics into single slides`;

/**
 * Generate the complete slides prompt with user context
 * @param {string} userPrompt - The user's analysis request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @returns {string} Complete prompt for AI
 */
export function generateSlidesPrompt(userPrompt, researchFiles) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `${slidesPrompt}

**USER REQUEST:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Create a compelling slide deck that presents the key insights from this research. Choose the most appropriate slide types for each piece of content.

**ABSOLUTE REQUIREMENT - SOURCE RESTRICTION:**
- Your slides MUST be based EXCLUSIVELY on the research content provided above
- DO NOT use any external knowledge, training data, or information not present in the research
- ALL statistics, insights, and claims MUST come directly from the uploaded research
- If the research lacks sufficient content, create fewer slides rather than inventing information

Respond with ONLY the JSON object.`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  slidesSchema,
  slidesPrompt,
  slideTypeGuide,
  dataStructureExamples,
  presentationTemplates,
  generateSlidesPrompt
};
