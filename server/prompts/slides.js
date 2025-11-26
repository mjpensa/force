/**
 * Slides Generation Prompt - Optimized Version
 * Creates presentation slides from research content
 *
 * OPTIMIZATION: Reduced from 35 slide types to 15 core types
 * Reduced prompt size by ~60% for faster, more reliable generation
 */

// ============================================================================
// TYPE-SPECIFIC SUB-SCHEMAS (Consolidated)
// ============================================================================

const cardSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Card title" },
    content: { type: "string", description: "Card content/description" }
  },
  required: ["title"]
};

const featureSchema = {
  type: "object",
  properties: {
    icon: { type: "string", description: "Icon character or number (e.g., '1', '★')" },
    title: { type: "string", description: "Feature title" },
    description: { type: "string", description: "Feature description" }
  },
  required: ["title"]
};

const stepSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Step title" },
    description: { type: "string", description: "Step description" }
  },
  required: ["title"]
};

const metricSchema = {
  type: "object",
  properties: {
    value: { type: "string", description: "Metric value (e.g., '85%', '$2.5M')" },
    label: { type: "string", description: "Metric label/description" }
  },
  required: ["value"]
};

const timelineItemSchema = {
  type: "object",
  properties: {
    date: { type: "string", description: "Date or time label (e.g., 'Q1 2025')" },
    title: { type: "string", description: "Item title" },
    content: { type: "string", description: "Item content" }
  },
  required: ["title"]
};

const phaseSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Phase title" },
    description: { type: "string", description: "Phase description" },
    items: { type: "array", items: { type: "string" }, description: "Phase bullet items" },
    note: { type: "string", description: "Note text (e.g., date range)" }
  },
  required: ["title"]
};

const activitySchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Activity name" },
    startMonth: { type: "number", description: "Start month (0=Jan, 11=Dec)" },
    endMonth: { type: "number", description: "End month (0=Jan, 11=Dec)" }
  },
  required: ["name", "startMonth", "endMonth"]
};

// ============================================================================
// MAIN SLIDES SCHEMA - 15 Core Types
// ============================================================================

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
      items: {
        type: "object",
        properties: {
          // Slide type - 15 core types
          type: {
            type: "string",
            enum: [
              // Opening (1)
              "title",

              // Navigation (1)
              "tableOfContents",

              // Content (2)
              "bullets",
              "content",

              // Quote (2)
              "quote",
              "quoteWithMetrics",

              // Grid (2)
              "cardGrid",
              "featureGrid",

              // Process (2)
              "processSteps",
              "stepsVertical",

              // Timeline (1)
              "timelineCards",

              // Planning (2)
              "rolloutGrid",
              "ganttChart",

              // Data (1)
              "table",

              // Closing (1)
              "thankYou"
            ],
            description: "Slide layout type"
          },
          title: { type: "string", description: "Slide title" },
          subtitle: { type: "string", description: "Subtitle (for title slides)" },
          section: { type: "string", description: "Section label (red text at top)" },

          // Content properties
          content: { type: "string", description: "Text content" },
          bullets: {
            type: "array",
            items: { type: "string" },
            description: "Bullet points (3-6 items)"
          },

          // Quote properties
          quote: { type: "string", description: "Quote text" },
          attribution: { type: "string", description: "Quote source" },
          metrics: {
            type: "array",
            items: metricSchema,
            description: "Metrics/KPIs (max 4)"
          },

          // Grid properties
          cards: {
            type: "array",
            items: cardSchema,
            description: "Cards for cardGrid (max 9)"
          },
          features: {
            type: "array",
            items: featureSchema,
            description: "Features for featureGrid (max 10)"
          },

          // Process properties
          steps: {
            type: "array",
            items: stepSchema,
            description: "Process steps (3-7 items)"
          },
          description: { type: "string", description: "Process description" },

          // Timeline properties
          items: {
            type: "array",
            items: timelineItemSchema,
            description: "Timeline items"
          },

          // Planning properties
          phases: {
            type: "array",
            items: phaseSchema,
            description: "Rollout phases"
          },
          activities: {
            type: "array",
            items: activitySchema,
            description: "Gantt chart activities"
          },

          // Table properties
          headers: {
            type: "array",
            items: { type: "string" },
            description: "Table headers"
          },
          rows: {
            type: "array",
            items: { type: "array", items: { type: "string" } },
            description: "Table rows (2D array)"
          },

          // TOC properties
          tocItems: {
            type: "array",
            items: { type: "string" },
            description: "Table of contents items"
          }
        },
        required: ["type", "title"]
      }
    },
    totalSlides: {
      type: "number",
      description: "Total slide count"
    }
  },
  required: ["title", "slides", "totalSlides"]
};

// ============================================================================
// CONDENSED SLIDE TYPE GUIDE
// ============================================================================

const slideTypeGuide = `
## SLIDE TYPES (Choose based on content)

| Type | When to Use | Key Properties |
|------|-------------|----------------|
| title | Opening slide | title, subtitle |
| tableOfContents | Agenda (10+ slides) | title, tocItems[] |
| bullets | Key points (3-6) | title, section, bullets[] |
| content | Paragraph text | title, section, content |
| quote | Impactful statement | title, section, quote, attribution |
| quoteWithMetrics | Quote + KPIs | quote, attribution, metrics[] |
| cardGrid | Related concepts (3-9) | title, section, cards[] |
| featureGrid | Features with icons | title, section, features[] |
| processSteps | Horizontal flow (3-5) | title, description, steps[] |
| stepsVertical | Vertical steps (4-8) | title, section, steps[] |
| timelineCards | Timeline with dates | title, section, items[] |
| rolloutGrid | Phase boxes | title, phases[] |
| ganttChart | Schedule | title, activities[] |
| table | Data comparison | title, headers[], rows[][] |
| thankYou | Closing | title |
`;

// ============================================================================
// ESSENTIAL EXAMPLES (8 core types)
// ============================================================================

const essentialExamples = `
## EXAMPLES

### title
{"type": "title", "title": "Digital Transformation Strategy", "subtitle": "Q1 2025 Initiative"}

### tableOfContents
{"type": "tableOfContents", "title": "Agenda", "tocItems": ["Executive Summary", "Market Analysis", "Strategy", "Timeline", "Next Steps"]}

### bullets
{"type": "bullets", "title": "Key Priorities", "section": "STRATEGY", "bullets": ["Accelerate digital adoption", "Expand market presence", "Enhance customer experience", "Drive operational efficiency"]}

### quoteWithMetrics
{"type": "quoteWithMetrics", "title": "Impact", "section": "RESULTS", "quote": "Digital transformation delivered unprecedented results", "attribution": "CEO Report 2024", "metrics": [{"value": "45%", "label": "Cost Reduction"}, {"value": "$2.5M", "label": "Annual Savings"}, {"value": "3x", "label": "Productivity Gain"}]}

### cardGrid
{"type": "cardGrid", "title": "Core Capabilities", "section": "OVERVIEW", "cards": [{"title": "Innovation", "content": "Leading R&D investments"}, {"title": "Scale", "content": "Global operations in 50+ countries"}, {"title": "Expertise", "content": "500+ domain specialists"}]}

### processSteps
{"type": "processSteps", "title": "Our Approach", "description": "Proven methodology for success", "steps": [{"title": "Assess", "description": "Evaluate current state"}, {"title": "Plan", "description": "Define strategy"}, {"title": "Execute", "description": "Implement solutions"}, {"title": "Measure", "description": "Track outcomes"}]}

### timelineCards
{"type": "timelineCards", "title": "Project Timeline", "section": "SCHEDULE", "items": [{"date": "Q1 2025", "title": "Foundation", "content": "Setup and planning"}, {"date": "Q2 2025", "title": "Development", "content": "Core implementation"}, {"date": "Q3 2025", "title": "Testing", "content": "Integration testing"}, {"date": "Q4 2025", "title": "Launch", "content": "Production go-live"}]}

### thankYou
{"type": "thankYou", "title": "Thank You"}
`;

// ============================================================================
// MAIN PROMPT (Condensed)
// ============================================================================

export const slidesPrompt = `You are an expert presentation designer. Create a professional slide deck from the research content.

RESPOND WITH ONLY VALID JSON matching the schema.

## CRITICAL RULES

1. **SOURCE RESTRICTION**: Use ONLY the provided research content. Do NOT invent data or use external knowledge.
2. **SLIDE COUNT**: Generate 7-12 slides. Never exceed 15.
3. **STRUCTURE**: Start with "title", end with "thankYou". Add "tableOfContents" for 10+ slides.
4. **VARIETY**: Don't repeat the same type more than 2 times consecutively.
5. **LIMITS**: Max 6 bullets, 9 cards, 4 metrics, 7 steps per slide.

${slideTypeGuide}

${essentialExamples}

## COMMON PATTERNS

**Strategy presentation**: title → tableOfContents → bullets (summary) → cardGrid (pillars) → processSteps → timelineCards → quoteWithMetrics → thankYou

**Research findings**: title → bullets (objectives) → quoteWithMetrics (findings) → table (data) → bullets (recommendations) → thankYou

**Project update**: title → bullets (overview) → processSteps (status) → ganttChart → quoteWithMetrics → thankYou

## TYPE SELECTION

- Simple points → bullets
- Related concepts with descriptions → cardGrid
- Features/capabilities → featureGrid
- Sequential process (3-5 steps) → processSteps
- Sequential process (6+ steps) → stepsVertical
- Timeline with dates → timelineCards
- Phase-based plan → rolloutGrid
- Monthly schedule → ganttChart
- Quote + numbers → quoteWithMetrics
- Comparison data → table`;

// ============================================================================
// PROMPT GENERATOR
// ============================================================================

/**
 * Generate the complete slides prompt
 * @param {string} userPrompt - The user's request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files
 * @returns {string} Complete prompt
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

Create a slide deck presenting key insights from this research. Use appropriate slide types for each content piece.

RESPOND WITH ONLY THE JSON OBJECT.`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  slidesSchema,
  slidesPrompt,
  generateSlidesPrompt
};
