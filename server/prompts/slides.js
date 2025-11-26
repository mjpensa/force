/**
 * Slides Generation - Simplified
 * 3 slide types: textTwoColumn, textThreeColumn, textWithCards
 */

const cardSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    content: { type: "string" }
  },
  required: ["title", "content"]
};

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
          section: { type: "string" },
          title: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
          columns: { type: "array", items: { type: "string" } },
          content: { type: "string" },
          cards: { type: "array", items: cardSchema }
        },
        required: ["type", "section", "title"]
      }
    }
  },
  required: ["title", "slides"]
};

export function generateSlidesPrompt(userPrompt, researchFiles) {
  const research = researchFiles.map(f => `=== ${f.filename} ===\n${f.content}`).join('\n\n');

  return `Create a slide deck from the research content below. Output valid JSON only.

SLIDE TYPES (use only these 3):

1. textTwoColumn: title left, paragraphs right
   {"type":"textTwoColumn", "section":"OVERVIEW", "title":"Main point here", "paragraphs":["First paragraph.", "Second paragraph."]}

2. textThreeColumn: title left, 3 text columns right
   {"type":"textThreeColumn", "section":"ANALYSIS", "title":"Detailed findings", "columns":["Column 1 text.", "Column 2 text.", "Column 3 text."]}

3. textWithCards: title+content left, 6 cards right
   {"type":"textWithCards", "section":"CAPABILITIES", "title":"Key features", "content":"Overview paragraph.", "cards":[{"title":"Card 1","content":"Description"},{"title":"Card 2","content":"Description"},{"title":"Card 3","content":"Description"},{"title":"Card 4","content":"Description"},{"title":"Card 5","content":"Description"},{"title":"Card 6","content":"Description"}]}

RULES:
- Generate 8-12 slides
- section: UPPERCASE (e.g., "MARKET ANALYSIS")
- title: sentence case, under 8 words
- textTwoColumn: 1-3 paragraphs
- textThreeColumn: exactly 3 columns
- textWithCards: exactly 6 cards
- Use ONLY information from the research content below - no external knowledge

USER REQUEST: ${userPrompt}

RESEARCH CONTENT:
${research}

Output JSON: {"title":"...", "slides":[...]}`;
}

export default { slidesSchema, generateSlidesPrompt };
