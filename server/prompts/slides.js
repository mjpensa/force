/**
 * Slides Generation Prompt
 * Creates presentation slides from research content
 *
 * Supports 3 slide layouts matching the BIP branded PowerPoint template:
 * 1. textTwoColumn - Title left, paragraphs right
 * 2. textThreeColumn - Title left, 3 text columns
 * 3. textWithCards - Title/text left, 2x3 numbered cards right
 */

// ============================================================================
// SLIDES SCHEMA
// ============================================================================

/**
 * Card schema (used by textWithCards)
 */
const cardSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Card title" },
    content: { type: "string", description: "Card content/description" }
  },
  required: ["title", "content"]
};

/**
 * Complete Slides JSON Schema - 3 slide types only
 */
export const slidesSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Main presentation title"
    },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["textTwoColumn", "textThreeColumn", "textWithCards"],
            description: "Slide layout type"
          },
          section: {
            type: "string",
            description: "Section label displayed in red at top of slide (e.g., 'MARKET ANALYSIS')"
          },
          title: {
            type: "string",
            description: "Slide title (displayed large on left side)"
          },
          // For textTwoColumn: paragraphs on the right
          paragraphs: {
            type: "array",
            items: { type: "string" },
            description: "Array of 1-3 paragraphs for textTwoColumn layout"
          },
          // For textThreeColumn: 3 columns of text
          columns: {
            type: "array",
            items: { type: "string" },
            description: "Array of exactly 3 text columns for textThreeColumn layout"
          },
          // For textWithCards: text content on left + cards on right
          content: {
            type: "string",
            description: "Body text for textWithCards layout (displayed below title on left)"
          },
          cards: {
            type: "array",
            items: cardSchema,
            description: "Array of exactly 6 cards for textWithCards layout (2x3 grid)"
          }
        },
        required: ["type", "section", "title"]
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
// SLIDE TYPE GUIDE
// ============================================================================

export const slideTypeGuide = `
## SLIDE TYPES (3 LAYOUTS ONLY)

You MUST use one of these 3 slide types for every slide:

### 1. textTwoColumn
Two-column layout with title on left and paragraphs on right.

| Property | Required | Description |
|----------|----------|-------------|
| type | Yes | "textTwoColumn" |
| section | Yes | Red section label at top (e.g., "EXECUTIVE SUMMARY") |
| title | Yes | Large italic title on the left side |
| paragraphs | Yes | Array of 1-3 paragraph strings displayed on the right |

Example:
{
  "type": "textTwoColumn",
  "section": "MARKET OVERVIEW",
  "title": "Industry dynamics are shifting rapidly",
  "paragraphs": [
    "The global market is experiencing unprecedented growth driven by digital adoption. Key players are investing heavily in technology infrastructure to maintain competitive advantage.",
    "Consumer behavior has shifted dramatically toward online channels. Organizations must adapt their strategies to meet evolving customer expectations and preferences."
  ]
}

### 2. textThreeColumn
Three-column text layout with title on left and flowing text across 3 columns.

| Property | Required | Description |
|----------|----------|-------------|
| type | Yes | "textThreeColumn" |
| section | Yes | Red section label at top |
| title | Yes | Large italic title on the left side |
| columns | Yes | Array of exactly 3 text strings, one per column |

Example:
{
  "type": "textThreeColumn",
  "section": "STRATEGIC ANALYSIS",
  "title": "Our comprehensive market assessment",
  "columns": [
    "The first column contains introductory context and background information about the market landscape and current trends.",
    "The second column expands on key findings and important insights discovered through our research and analysis process.",
    "The third column provides conclusions and forward-looking perspectives on market evolution and opportunities."
  ]
}

### 3. textWithCards
Split layout with title and text on left, 6 numbered cards (2x3 grid) on right.

| Property | Required | Description |
|----------|----------|-------------|
| type | Yes | "textWithCards" |
| section | Yes | Red section label at top |
| title | Yes | Large italic title on the left side |
| content | Yes | Body paragraph text below the title on the left |
| cards | Yes | Array of exactly 6 card objects with title and content |

Example:
{
  "type": "textWithCards",
  "section": "KEY CAPABILITIES",
  "title": "Our platform delivers comprehensive solutions",
  "content": "We have developed a suite of integrated capabilities designed to address the complex challenges facing modern enterprises. Each component works seamlessly together to deliver measurable results.",
  "cards": [
    { "title": "Data Analytics", "content": "Real-time insights and predictive modeling capabilities" },
    { "title": "Cloud Infrastructure", "content": "Scalable and secure enterprise hosting solutions" },
    { "title": "AI Integration", "content": "Machine learning models for automation" },
    { "title": "Security", "content": "Enterprise-grade protection and compliance" },
    { "title": "Support", "content": "24/7 dedicated technical assistance" },
    { "title": "Training", "content": "Comprehensive onboarding and education" }
  ]
}
`;

// ============================================================================
// MAIN SLIDES PROMPT
// ============================================================================

export const slidesPrompt = `You are an expert presentation designer. Your job is to analyze research content and create a professional slide deck using ONLY the 3 available slide types.

You MUST respond with *only* a valid JSON object matching the schema.

## CRITICAL SOURCE RESTRICTION

**You MUST base your slides EXCLUSIVELY on the user-uploaded research content provided below.**

- DO NOT include any information, statistics, or claims from external sources
- DO NOT use your training data or general knowledge to supplement the content
- DO NOT invent, fabricate, or extrapolate data beyond what is explicitly stated in the research
- EVERY statistic, company name, insight, and claim MUST be directly traceable to the provided research files
- If the research does not contain sufficient content for a section, reduce the number of slides rather than filling gaps with external knowledge

${slideTypeGuide}

## SLIDE SELECTION RULES

Choose the appropriate slide type based on content:

| Content Type | Use This Slide |
|--------------|----------------|
| Narrative explanation, analysis, context | textTwoColumn |
| Detailed text that needs more space | textThreeColumn |
| Listing 6 capabilities, features, or items | textWithCards |

## CONTENT RULES

1. **Section labels**: Always UPPERCASE, brief (1-3 words). Examples: "EXECUTIVE SUMMARY", "MARKET ANALYSIS", "KEY FINDINGS"

2. **Titles**: Write as statements or phrases, not questions. Keep under 8 words. Use sentence case.

3. **Paragraphs (textTwoColumn)**:
   - Use 1-3 paragraphs
   - Each paragraph should be 2-4 sentences
   - Present cohesive narrative content

4. **Columns (textThreeColumn)**:
   - Must have exactly 3 columns
   - Each column should be similar length
   - Content should flow logically across columns

5. **Cards (textWithCards)**:
   - Must have exactly 6 cards
   - Card titles: 1-3 words
   - Card content: 1 sentence, under 15 words
   - Cards are numbered automatically (1-6)

## OUTPUT REQUIREMENTS

- Generate 7-12 slides total
- Set totalSlides to the actual slide count
- Every slide MUST have: type, section, title, and appropriate body content
- Vary slide types - don't use the same type more than 3 times consecutively
- Ensure smooth narrative progression

## COMMON MISTAKES TO AVOID

1. DON'T leave paragraphs, columns, or cards empty
2. DON'T use more or fewer than 6 cards for textWithCards
3. DON'T use more or fewer than 3 columns for textThreeColumn
4. DON'T write section labels in lowercase
5. DON'T write overly long titles (max 8 words)
6. DON'T generate more than 12 slides

## SANITIZATION

- All strings must be valid JSON
- Properly escape quotes and special characters
- No raw newlines in strings`;

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

Create a compelling slide deck that presents the key insights from this research. Use only the 3 available slide types: textTwoColumn, textThreeColumn, and textWithCards.

**REQUIREMENTS:**
- Base slides EXCLUSIVELY on the research content above
- Every slide must have body content (paragraphs, columns, or cards)
- Use textWithCards when you need to present 6 related items
- Use textThreeColumn for detailed explanations needing more space
- Use textTwoColumn for focused narrative content

Respond with ONLY the JSON object.`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  slidesSchema,
  slidesPrompt,
  slideTypeGuide,
  generateSlidesPrompt
};
