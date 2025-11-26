/**
 * Slides Generation - Extremely Simplified
 * 3 slide types with strict character limits
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

  return `Generate a JSON slide deck. Be EXTREMELY BRIEF - this is for slides, not a document.

THREE SLIDE TYPES:

TYPE 1 - textTwoColumn:
{"type":"textTwoColumn","section":"TOPIC","title":"Short title","paragraphs":["One brief sentence.","Another brief sentence."]}

TYPE 2 - textThreeColumn:
{"type":"textThreeColumn","section":"TOPIC","title":"Short title","columns":["Point one.","Point two.","Point three."]}

TYPE 3 - textWithCards:
{"type":"textWithCards","section":"TOPIC","title":"Short title","content":"Brief intro.","cards":[{"title":"A","content":"Few words"},{"title":"B","content":"Few words"},{"title":"C","content":"Few words"},{"title":"D","content":"Few words"},{"title":"E","content":"Few words"},{"title":"F","content":"Few words"}]}

STRICT LIMITS:
- 8-12 slides total
- Each paragraph/column: 1-2 sentences MAX
- Each card content: 5 words MAX
- section: UPPERCASE
- title: under 6 words

Topic: ${userPrompt}

Source material:
${research}

Output ONLY valid JSON: {"title":"...","slides":[...]}`;
}

export default { slidesSchema, generateSlidesPrompt };
