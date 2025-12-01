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

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

Generate JSON with "title" and "slides" array. Every slide must have tagline, title, body.
`;
