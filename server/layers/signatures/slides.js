/**
 * Slides Signature - PROMPT ML Layer 3
 *
 * DSPy-style signature for presentation slide generation.
 * Optimized for executive-level content extraction.
 *
 * Based on PROMPT ML design specification.
 */

import { createSignature, FieldType } from './base.js';

/**
 * Slides generation instructions
 */
const SLIDES_INSTRUCTIONS = `You are an executive presentation designer creating concise, impactful slides.
Output ONLY valid JSON matching the schema.

## SLIDE DESIGN PRINCIPLES

### 1. CONTENT FOCUS
- Extract the most important insights from research
- Prioritize actionable takeaways over details
- Use clear, executive-friendly language
- Keep text concise - bullet points over paragraphs

### 2. SLIDE COUNT
- Generate exactly 6 slides
- Each slide must have a clear purpose
- Maintain narrative flow between slides

### 3. SLIDE STRUCTURE
Recommended flow:
1. Title/Overview slide
2. Key Findings or Problem Statement
3. Analysis or Data highlights
4. Main Insight or Solution
5. Recommendations or Action Items
6. Summary or Next Steps

### 4. SLIDE TYPES
Use the appropriate type for content:
- textTwoColumn: For comparing/contrasting two concepts
- textThreeColumn: For listing 3 key points or phases
- textWithCards: For detailed breakdowns with sub-items

### 5. TEXT GUIDELINES
- Titles: 3-7 words, action-oriented
- Paragraphs: 1-3 sentences each
- Columns: 2-4 bullet points each
- Cards: Short title + 1-2 sentence content

### 6. EXTRACTION PRIORITY
Focus on extracting:
- Key statistics and metrics
- Critical decisions or milestones
- Recommendations and action items
- Risk factors and mitigations
- Timeline highlights`;

/**
 * Slide item schema
 */
const SLIDE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['textTwoColumn', 'textThreeColumn', 'textWithCards'],
      description: 'Slide layout type'
    },
    title: {
      type: 'string',
      description: 'Slide title'
    },
    section: {
      type: 'string',
      description: 'Section header for the slide'
    },
    paragraphs: {
      type: 'array',
      items: { type: 'string' },
      description: 'Two paragraphs for textTwoColumn layout'
    },
    columns: {
      type: 'array',
      items: { type: 'string' },
      description: 'Three columns for textThreeColumn layout'
    },
    content: {
      type: 'string',
      description: 'Main content for textWithCards layout'
    },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['title']
      },
      description: 'Card items for textWithCards layout'
    }
  },
  required: ['type', 'title']
};

/**
 * Build the Slides Signature
 */
export const SlidesSignature = createSignature('SlidesGeneration')
  .describe('Generate a 6-slide executive presentation from research documents, extracting key insights and recommendations.')
  .instruct(SLIDES_INSTRUCTIONS)

  // Input fields
  .input('userPrompt', FieldType.STRING, {
    description: 'Topic and user instructions for slide generation',
    required: true,
    constraints: { minLength: 1 }
  })
  .input('researchFiles', FieldType.ARRAY, {
    description: 'Array of research files with filename and content',
    required: true,
    constraints: { minItems: 1 }
  })
  .input('slideCount', FieldType.NUMBER, {
    description: 'Number of slides to generate (default: 6)',
    required: false,
    default: 6,
    constraints: { min: 3, max: 12 }
  })

  // Output fields
  .output('title', FieldType.STRING, {
    description: 'Presentation title',
    required: true
  })
  .output('slides', FieldType.ARRAY, {
    description: 'Array of slide objects',
    required: true,
    itemSchema: SLIDE_ITEM_SCHEMA,
    constraints: { minItems: 3, maxItems: 12 }
  })

  // Few-shot example
  .example(
    {
      userPrompt: 'Digital Transformation Strategy',
      researchContent: 'Company plans to modernize systems by Q3 2025...'
    },
    {
      title: 'Digital Transformation Strategy',
      slides: [
        {
          type: 'textTwoColumn',
          title: 'Overview',
          section: 'Executive Summary',
          paragraphs: [
            'Company-wide digital transformation initiative targeting Q3 2025 completion.',
            'Focus areas: cloud migration, process automation, and customer experience.'
          ]
        }
      ]
    }
  )

  // Configuration
  .configure({
    outputFormat: 'json',
    maxOutputLength: 4096,
    taskType: 'slides'
  })

  .build();

/**
 * Generate slides prompt using the signature
 *
 * @param {string} userPrompt - Topic/instructions
 * @param {Array} researchFiles - Research files [{filename, content}]
 * @param {Object} options - Additional options
 * @returns {string} Generated prompt
 */
export function generateSlidesSignaturePrompt(userPrompt, researchFiles, options = {}) {
  return SlidesSignature.generatePrompt({
    userPrompt,
    researchFiles,
    slideCount: options.slideCount || 6
  }, {
    includeExamples: options.includeExamples || false,
    maxExamples: 1
  });
}

/**
 * Validate slides inputs
 */
export function validateSlidesInputs(userPrompt, researchFiles) {
  return SlidesSignature.validateInputs({
    userPrompt,
    researchFiles
  });
}

/**
 * Get slides output schema
 */
export function getSlidesOutputSchema() {
  return SlidesSignature.getOutputSchema();
}

export default SlidesSignature;
