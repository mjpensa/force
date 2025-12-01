import { SchemaType } from '@google/generative-ai';

/**
 * Single Template Slide Schema
 * Every slide uses the SAME layout: tagline + title (left), body (right)
 * No variations. No options. No grid. No bullets. No layouts.
 */
export const slidesSchema = {
  description: "Presentation slides - single two-column template only",
  type: SchemaType.OBJECT,
  properties: {
    title: {
      type: SchemaType.STRING,
      description: "Title of the presentation",
      nullable: false
    },
    slides: {
      type: SchemaType.ARRAY,
      description: "Array of slides - all use identical two-column layout",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          tagline: {
            type: SchemaType.STRING,
            description: "Small uppercase tagline in red (top-left, e.g. 'EXECUTIVE SUMMARY')",
            nullable: false
          },
          title: {
            type: SchemaType.STRING,
            description: "Large title text (left column, thin font weight)",
            nullable: false
          },
          body: {
            type: SchemaType.STRING,
            description: "Body paragraphs (right column). Use newlines to separate paragraphs.",
            nullable: false
          }
        },
        required: ["tagline", "title", "body"]
      }
    }
  },
  required: ["title", "slides"]
};

export const generateSlidesPrompt = (userPrompt, researchContent) => `
You are creating presentation slides. Every slide MUST use this EXACT layout:
- LEFT SIDE: Small red uppercase tagline + Large navy title (thin font)
- RIGHT SIDE: Body text paragraphs

Each slide object must have exactly three fields:
- tagline: Short uppercase label (e.g., "EXECUTIVE SUMMARY", "KEY FINDINGS", "NEXT STEPS")
- title: Multi-line title text that can wrap (this is the main headline)
- body: 2-3 paragraphs of body text. Separate paragraphs with newlines.

CRITICAL TITLE TYPOGRAPHY RULES:
The slide title uses very tight line spacing (70% line-height). To prevent letter overlap between lines, you MUST follow these rules:

1. DESCENDER letters (g, y, p, q, j) have parts that hang BELOW the baseline
2. ASCENDER letters (b, d, f, h, k, l, t) and CAPITALS have parts that extend ABOVE lowercase letters
3. NEVER place a word ending in a descender (g, y, p, q, j) directly above a word starting with an ascender (b, d, f, h, k, l, t) or capital letter

SAFE combinations (line above → line below):
- Words ending in: a, c, e, i, m, n, o, r, s, u, v, w, x, z → Any word below is OK
- Words ending in: g, y, p, q, j → Next line must start with: a, c, e, i, m, n, o, r, s, u, v, w, x, z (lowercase only)

UNSAFE combinations to AVOID:
- "Leading" above "Through" (g above T) ❌
- "Strategy" above "For" (y above F) ❌
- "Develop" above "Better" (p above B) ❌

SAFE examples:
- "Innovation" above "drives" (n above d) ✓
- "Success" above "through" (s above t) ✓
- "Building" above "on core" (g above o) ✓

Reword titles to avoid unsafe letter combinations. Keep titles impactful and concise (3-5 words per line, 2-4 lines total).

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

Generate JSON with "title" and "slides" array. Every slide must have tagline, title, body.
`;
