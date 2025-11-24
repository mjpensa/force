/**
 * Document Generation Prompt
 * Creates long-form documents from research content
 *
 * This module generates structured documents with table of contents,
 * sections, and comprehensive analysis suitable for reading mode
 */

/**
 * Document JSON Schema
 */
export const documentSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Document main title"
    },
    subtitle: {
      type: "string",
      description: "Document subtitle or description"
    },
    meta: {
      type: "object",
      properties: {
        author: { type: "string" },
        date: { type: "string" },
        version: { type: "string" }
      },
      description: "Document metadata"
    },
    tableOfContents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Section anchor ID" },
          title: { type: "string", description: "Section title" },
          level: { type: "number", description: "Heading level (1-3)" },
          subsections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                level: { type: "number" }
              }
            }
          }
        },
        required: ["id", "title", "level"]
      },
      description: "Table of contents structure"
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique section ID for TOC linking"
          },
          heading: {
            type: "string",
            description: "Section heading"
          },
          level: {
            type: "number",
            description: "Heading level (1, 2, or 3)"
          },
          content: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["paragraph", "list", "table", "quote"],
                  description: "Content block type"
                },
                text: {
                  type: "string",
                  description: "Text content for paragraphs and quotes"
                },
                items: {
                  type: "array",
                  items: { type: "string" },
                  description: "List items"
                },
                ordered: {
                  type: "boolean",
                  description: "Whether list is ordered (numbered)"
                },
                headers: {
                  type: "array",
                  items: { type: "string" },
                  description: "Table column headers"
                },
                rows: {
                  type: "array",
                  items: {
                    type: "array",
                    items: { type: "string" }
                  },
                  description: "Table rows"
                },
                attribution: {
                  type: "string",
                  description: "Quote attribution"
                }
              },
              required: ["type"]
            },
            description: "Array of content blocks within section"
          }
        },
        required: ["id", "heading", "level", "content"]
      },
      description: "Document sections"
    }
  },
  required: ["title", "tableOfContents", "sections"]
};

/**
 * Document Generation System Prompt
 */
export const documentPrompt = `You are an expert technical writer and analyst. Your job is to transform research content into a comprehensive, well-structured long-form document.

You MUST respond with *only* a valid JSON object matching the schema.

**CRITICAL GUIDELINES:**

1. **DOCUMENT STRUCTURE:**
   - Create a clear, hierarchical structure with 4-8 major sections (level 1)
   - Each major section should have 2-4 subsections (level 2)
   - Use level 3 headings sparingly for detailed breakdowns
   - Maintain logical flow from introduction to conclusion

2. **TABLE OF CONTENTS:**
   - Must include ALL sections with their IDs
   - IDs should be kebab-case (e.g., "executive-summary", "key-findings")
   - Include subsections for major sections
   - Levels: 1 (major sections), 2 (subsections), 3 (detailed subsections)

3. **SECTION TYPES (RECOMMENDED):**
   - **Executive Summary** (level 1): High-level overview, key insights
   - **Background/Context** (level 1): Situational context, problem statement
   - **Analysis** (level 1): Core findings organized by theme
   - **Timeline/Roadmap** (level 1): Key dates, milestones, phases
   - **Recommendations** (level 1): Actionable next steps
   - **Conclusion** (level 1): Summary and final thoughts
   - **Appendix** (optional, level 1): Supporting data, references

4. **CONTENT BLOCK TYPES:**
   - **paragraph**: Main narrative content (2-4 sentences per paragraph)
   - **list**: Bullet points or numbered lists (use for enumerations)
   - **table**: Structured data (use for comparisons, timelines, metrics)
   - **quote**: Important quotes or callouts (use sparingly for emphasis)

5. **CONTENT WRITING RULES:**
   - **Clarity**: Use clear, professional language
   - **Depth**: Provide comprehensive analysis, not superficial summaries
   - **Evidence**: Ground all statements in the research content
   - **Structure**: Each section should have 3-6 content blocks
   - **Variety**: Mix paragraphs, lists, and tables for readability
   - **Flow**: Ensure smooth transitions between sections

6. **PARAGRAPH GUIDELINES:**
   - 2-4 sentences per paragraph
   - One main idea per paragraph
   - Use topic sentences
   - Justify text alignment (will be applied in CSS)

7. **LIST GUIDELINES:**
   - Use unordered lists (ordered: false) for features, benefits, points
   - Use ordered lists (ordered: true) for steps, procedures, sequences
   - 3-8 items per list
   - Keep items parallel in structure
   - Each item should be concise but complete

8. **TABLE GUIDELINES:**
   - Use for comparing options, showing timelines, metrics
   - Keep headers clear and concise
   - 2-5 columns maximum
   - 3-10 rows for readability
   - Ensure data is well-formatted

9. **QUOTE GUIDELINES:**
   - Use for key insights, important findings, or strategic statements
   - Always include attribution if source is known
   - Keep quotes impactful and relevant

10. **METADATA:**
    - Set author to "AI Analysis" or extract from research if available
    - Use current date in format "November 2025"
    - Set version to "1.0" or appropriate version

11. **SANITIZATION:**
    - All strings must be valid JSON
    - Properly escape quotes, newlines, and special characters
    - No raw newlines in text fields (use \\n if needed)

**CONTENT EXTRACTION STRATEGY:**
1. Identify the main themes and topics in research
2. Organize into logical sections (introduction → analysis → conclusion)
3. Within each section, create comprehensive content blocks
4. Extract specific data points for tables
5. Highlight key insights in lists
6. Use quotes for emphasis on critical points
7. Ensure every section adds value to the document

**OUTPUT REQUIREMENTS:**
- Title must be clear and descriptive
- Table of contents must match section structure exactly
- Every section must have unique ID matching TOC
- Each section must have 3-6 content blocks
- Mix content types for engaging reading experience
- Maintain professional, analytical tone throughout`;

/**
 * Generate the complete document prompt with user context
 * @param {string} userPrompt - The user's analysis request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @returns {string} Complete prompt for AI
 */
export function generateDocumentPrompt(userPrompt, researchFiles) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `${documentPrompt}

**USER REQUEST:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Create a comprehensive analytical document that thoroughly examines this research.

Respond with ONLY the JSON object.`;
}
