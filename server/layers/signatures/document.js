/**
 * Document Signature - PROMPT ML Layer 3
 *
 * DSPy-style signature for executive document generation.
 * Focused on comprehensive, structured document output.
 *
 * Based on PROMPT ML design specification.
 */

import { createSignature, FieldType } from './base.js';

/**
 * Document generation instructions
 */
const DOCUMENT_INSTRUCTIONS = `You are an expert analyst creating an executive summary document.
Output ONLY valid JSON matching the schema.

## DOCUMENT GUIDELINES

### 1. CONTENT PRINCIPLES
- Use ONLY facts from the provided research
- Be concise and direct
- Maintain professional, executive-level tone
- Support claims with data when available

### 2. STRUCTURE
- 4-6 sections maximum
- 2-4 paragraphs per section
- Logical flow from overview to details to recommendations

### 3. RECOMMENDED SECTIONS
Consider including these section types:
1. Executive Summary / Overview
2. Background / Context
3. Key Findings
4. Analysis / Implications
5. Recommendations
6. Next Steps / Action Items

### 4. PARAGRAPH GUIDELINES
- Each paragraph should focus on one main idea
- Lead with the most important information
- Keep paragraphs 2-4 sentences each
- Use specific data and examples where available

### 5. WRITING STYLE
- Active voice preferred
- Avoid jargon unless domain-specific
- Define acronyms on first use
- Use quantitative data when available

### 6. QUALITY REQUIREMENTS
- All content must be traceable to source research
- Do not invent facts or statistics
- Acknowledge gaps or limitations if relevant
- Maintain consistency throughout document`;

/**
 * Section schema
 */
const SECTION_SCHEMA = {
  type: 'object',
  properties: {
    heading: {
      type: 'string',
      description: 'Section heading'
    },
    paragraphs: {
      type: 'array',
      items: { type: 'string' },
      description: 'Section paragraphs'
    }
  },
  required: ['heading', 'paragraphs']
};

/**
 * Build the Document Signature
 */
export const DocumentSignature = createSignature('DocumentGeneration')
  .describe('Generate an executive summary document from research files, with clear sections and structured content.')
  .instruct(DOCUMENT_INSTRUCTIONS)

  // Input fields
  .input('userPrompt', FieldType.STRING, {
    description: 'User request and instructions for document generation',
    required: true,
    constraints: { minLength: 1 }
  })
  .input('researchFiles', FieldType.ARRAY, {
    description: 'Array of research files with filename and content',
    required: true,
    constraints: { minItems: 1 }
  })
  .input('sectionCount', FieldType.NUMBER, {
    description: 'Target number of sections (default: 4-6)',
    required: false,
    default: 5,
    constraints: { min: 2, max: 10 }
  })
  .input('documentType', FieldType.STRING, {
    description: 'Type of document (summary, report, brief)',
    required: false,
    default: 'summary',
    constraints: { enum: ['summary', 'report', 'brief', 'analysis'] }
  })

  // Output fields
  .output('title', FieldType.STRING, {
    description: 'Document title',
    required: true
  })
  .output('sections', FieldType.ARRAY, {
    description: 'Document sections with headings and paragraphs',
    required: true,
    itemSchema: SECTION_SCHEMA,
    constraints: { minItems: 2, maxItems: 10 }
  })

  // Few-shot example
  .example(
    {
      userPrompt: 'Analyze Q3 market trends',
      researchContent: 'Market grew 15% in Q3...'
    },
    {
      title: 'Q3 2024 Market Analysis Summary',
      sections: [
        {
          heading: 'Executive Overview',
          paragraphs: [
            'The market demonstrated strong growth in Q3 2024, with a 15% increase over the previous quarter.',
            'Key drivers included increased consumer demand and favorable regulatory changes.'
          ]
        },
        {
          heading: 'Key Findings',
          paragraphs: [
            'Consumer spending increased across all major segments.',
            'Technology sector led growth with 22% quarterly gains.'
          ]
        }
      ]
    }
  )

  // Configuration
  .configure({
    outputFormat: 'json',
    maxOutputLength: 4096,
    taskType: 'document'
  })

  .build();

/**
 * Generate document prompt using the signature
 *
 * @param {string} userPrompt - User request/instructions
 * @param {Array} researchFiles - Research files [{filename, content}]
 * @param {Object} options - Additional options
 * @returns {string} Generated prompt
 */
export function generateDocumentSignaturePrompt(userPrompt, researchFiles, options = {}) {
  return DocumentSignature.generatePrompt({
    userPrompt,
    researchFiles,
    sectionCount: options.sectionCount || 5,
    documentType: options.documentType || 'summary'
  }, {
    includeExamples: options.includeExamples || false,
    maxExamples: 1
  });
}

/**
 * Validate document inputs
 */
export function validateDocumentInputs(userPrompt, researchFiles) {
  return DocumentSignature.validateInputs({
    userPrompt,
    researchFiles
  });
}

/**
 * Get document output schema
 */
export function getDocumentOutputSchema() {
  return DocumentSignature.getOutputSchema();
}

export default DocumentSignature;
