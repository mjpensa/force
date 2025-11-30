import { SchemaType } from '@google/generative-ai';

export const slidesSchema = {
  description: "Presentation slides data (Standard 16:9 Aspect Ratio)",
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
          layout: {
            type: SchemaType.STRING,
            description: "Layout type: 'title', 'content', or 'grid'",
            enum: ["title", "content", "grid"],
            nullable: false
          },
          tagline: {
            type: SchemaType.STRING,
            description: "Small tagline (e.g. 'EXECUTIVE SUMMARY')",
            nullable: true
          },
          title: {
            type: SchemaType.STRING,
            description: "Slide title",
            nullable: false
          },
          body: {
            type: SchemaType.STRING,
            description: "Main body text (for title/content layouts)",
            nullable: true
          },
          intro: {
            type: SchemaType.STRING,
            description: "Introductory text (for grid layout)",
            nullable: true
          },
          gridItems: {
            type: SchemaType.ARRAY,
            description: "Items for grid layout (max 6)",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING, description: "Item title" },
                description: { type: SchemaType.STRING, description: "Item description" }
              }
            },
            nullable: true
          },
          notes: {
            type: SchemaType.STRING,
            description: "Speaker notes",
            nullable: true
          }
        },
        required: ["layout", "title"]
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
2. Keep text concise and professional.
3. Ensure the presentation flows logically.
4. Use 'title' layout for the first slide.
5. Use 'content' layout for text-heavy slides.
6. Use 'grid' layout for lists or structured data (max 6 items).
7. Always provide a 'tagline' for every slide (e.g. section name).

Output must be valid JSON matching the schema.
`;
