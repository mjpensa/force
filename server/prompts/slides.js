/**
 * Slides Generation - MVP
 */

export const slidesSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["textTwoColumn", "textThreeColumn", "textWithCards"] },
          title: { type: "string" },
          section: { type: "string" },
          paragraphs: { 
            type: "array", 
            items: { type: "string" },
            description: "Array of short bullet points (max 15 words each)"
          },
          columns: { 
            type: "array", 
            items: { type: "string" },
            description: "Array of 3 column contents (max 20 words each)"
          },
          content: { type: "string", description: "Brief intro text" },
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string", description: "Brief card content (max 15 words)" }
              },
              required: ["title"]
            }
          }
        },
        required: ["type", "title"]
      }
    }
  },
  required: ["title", "slides"]
};

export function generateSlidesPrompt(userPrompt, researchFiles) {
  // Combine content from all files, limited to 50k chars to fit context while providing detail
  const source = researchFiles
    .map(f => `--- ${f.filename} ---\n${f.content}`)
    .join('\n\n')
    .substring(0, 50000);

  return `You are an expert presentation designer. Create a 6-slide presentation JSON deck based on the provided source material.

Topic: ${userPrompt}

CRITICAL DESIGN RULES:
1. **MINIMAL TEXT**: Slides must be readable in 5 seconds. NO WALLS OF TEXT.
2. **BULLET POINTS**: Use short, punchy bullet points. Max 10-15 words per bullet.
3. **SUMMARIZE**: Do not copy-paste. Synthesize the content into key takeaways.
4. **VARIETY**: Use a mix of slide types.

Slide Types & Constraints:

1. **textTwoColumn**:
   - Usage: Main concepts with bullet points.
   - "paragraphs": Must contain 3-5 short bullet points. NEVER a single long paragraph.

2. **textThreeColumn**:
   - Usage: Comparing 3 items or showing 3 steps.
   - "columns": Exactly 3 text blocks. Each block max 20 words.

3. **textWithCards**:
   - Usage: Featuring 4 distinct items/metrics/pillars.
   - "content": A single short sentence (max 15 words).
   - "cards": Exactly 4 cards. Each "content" max 10 words.

Source Material:
${source}

Return strictly valid JSON matching the schema.`;
}

export default { slidesSchema, generateSlidesPrompt };
