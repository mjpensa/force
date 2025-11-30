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
          title: {
            type: SchemaType.STRING,
            description: "Slide title",
            nullable: false
          },
          content: {
            type: SchemaType.STRING,
            description: "Slide content",
            nullable: true
          },
          notes: {
            type: SchemaType.STRING,
            description: "Speaker notes",
            nullable: true
          }
        },
        required: ["title"]
      }
    }
  },
  required: ["title", "slides"]
};

export const generateSlidesPrompt = (userPrompt, researchContent) => \
You are an expert presentation designer. Create a professional presentation based on the user's request and the provided research content.

USER REQUEST: "\"

RESEARCH CONTENT:
\

INSTRUCTIONS:
1. Create a structured presentation that covers the key points from the research.
2. Keep text concise and professional.
3. Ensure the presentation flows logically.

Output must be valid JSON matching the schema.
\;
