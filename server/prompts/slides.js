import { SchemaType } from '@google/generative-ai';

export const slidesSchema = {
  description: "Presentation slides data",
  type: SchemaType.OBJECT,
  properties: {
    title: {
      type: SchemaType.STRING,
      description: "Title of the presentation",
      nullable: false
    },
    slides: {
      type: SchemaType.ARRAY,
      description: "Array of slides",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            description: "Type of slide layout. Must be one of: 'textTwoColumn', 'textThreeColumn', 'textWithCards'",
            nullable: false
          },
          section: {
            type: SchemaType.STRING,
            description: "Section label (e.g., 'INTRODUCTION', 'MARKET ANALYSIS')",
            nullable: true
          },
          title: {
            type: SchemaType.STRING,
            description: "Slide title",
            nullable: false
          },
          // For textTwoColumn
          paragraphs: {
            type: SchemaType.ARRAY,
            description: "Array of paragraphs for textTwoColumn layout",
            items: { type: SchemaType.STRING },
            nullable: true
          },
          // For textThreeColumn
          columns: {
            type: SchemaType.ARRAY,
            description: "Array of 3 column texts for textThreeColumn layout",
            items: { type: SchemaType.STRING },
            nullable: true
          },
          // For textWithCards
          content: {
            type: SchemaType.STRING,
            description: "Introductory content for textWithCards layout",
            nullable: true
          },
          cards: {
            type: SchemaType.ARRAY,
            description: "Array of cards (max 6) for textWithCards layout",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING },
                content: { type: SchemaType.STRING }
              }
            },
            nullable: true
          }
        },
        required: ["type", "title"]
      }
    }
  },
  required: ["title", "slides"]
};

export const generateSlidesPrompt = (userPrompt, researchContent) => `
You are an expert presentation designer. Create a professional presentation based on the user's request and the provided research content.

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

INSTRUCTIONS:
1. Create a structured presentation that covers the key points from the research.
2. Use ONLY the following three slide layouts. Choose the best layout for each slide's content:

   LAYOUT A: "textTwoColumn"
   - Use for general content, introductions, or detailed explanations.
   - Structure: Title on left, paragraphs on right.
   - Fields: type="textTwoColumn", section, title, paragraphs (array of strings).

   LAYOUT B: "textThreeColumn"
   - Use for comparing 3 distinct points, pillars, or phases.
   - Structure: Title on left, 3 distinct text columns on right.
   - Fields: type="textThreeColumn", section, title, columns (array of exactly 3 strings).

   LAYOUT C: "textWithCards"
   - Use for listing items, features, steps, or key takeaways (4-6 items).
   - Structure: Title + intro text on left, grid of numbered cards on right.
   - Fields: type="textWithCards", section, title, content (intro text), cards (array of objects with title and content).
   - Max 6 cards.

3. DESIGN GUIDELINES:
   - "section" should be a short, uppercase category (e.g., "EXECUTIVE SUMMARY", "STRATEGY").
   - Keep text concise and professional.
   - Ensure the presentation flows logically.
   - Generate at least 5 slides.

Output must be valid JSON matching the schema.
`;
