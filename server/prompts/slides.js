/**
 * Slides Generation Prompt
 * Creates presentation slides from research content
 *
 * This module generates a structured slide deck suitable for presentation mode
 */

/**
 * Slides JSON Schema
 */
export const slidesSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Main presentation title"
    },
    subtitle: {
      type: "string",
      description: "Presentation subtitle or tagline"
    },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["title", "content", "bullets", "quote"],
            description: "Slide layout type"
          },
          title: {
            type: "string",
            description: "Slide title or heading"
          },
          subtitle: {
            type: "string",
            description: "Subtitle (for title slides)"
          },
          content: {
            type: "string",
            description: "Text content for content slides"
          },
          bullets: {
            type: "array",
            items: { type: "string" },
            description: "Bullet points for bullets slides"
          },
          quote: {
            type: "string",
            description: "Quote text for quote slides"
          },
          attribution: {
            type: "string",
            description: "Quote attribution"
          }
        },
        required: ["type", "title"]
      }
    },
    totalSlides: {
      type: "number",
      description: "Total number of slides"
    }
  },
  required: ["title", "slides", "totalSlides"]
};

/**
 * Slides Generation System Prompt
 */
export const slidesPrompt = `You are an expert presentation designer. Your job is to analyze research content and create a professional, engaging slide deck.

You MUST respond with *only* a valid JSON object matching the schema.

**CRITICAL GUIDELINES:**

1. **STRUCTURE:**
   - Start with a title slide (type: "title") with main title and subtitle
   - Create 8-15 content slides that tell a clear story
   - End with a summary or conclusion slide
   - Each slide should be focused on ONE key concept

2. **SLIDE TYPES:**
   - **title**: Opening slide with title and subtitle
   - **bullets**: Main slide type - use for key points (3-5 bullets max per slide)
   - **content**: For narrative text or detailed explanations (keep concise)
   - **quote**: For highlighting important quotes or insights

3. **CONTENT RULES:**
   - **Brevity**: Each bullet should be concise (1-2 lines max)
   - **Clarity**: Use clear, simple language - avoid jargon
   - **Hierarchy**: Organize from high-level concepts to details
   - **Impact**: Lead with the most important insights
   - **Balance**: Don't overload any single slide

4. **PRESENTATION FLOW:**
   - Slide 1: Title slide (type: "title")
   - Slides 2-3: Context/Background (type: "bullets")
   - Slides 4-8: Core insights organized by theme (type: "bullets" or "content")
   - Slides 9-10: Key takeaways or recommendations (type: "bullets")
   - Optional: Quote slides for emphasis (type: "quote")

5. **BULLET POINT BEST PRACTICES:**
   - Start with action verbs or key nouns
   - Keep parallel structure
   - 3-5 bullets per slide (never more than 6)
   - Each bullet is a complete thought
   - Use consistent formatting

6. **CONTENT EXTRACTION:**
   - Extract the most important insights from research
   - Focus on strategic insights, not operational details
   - Highlight key metrics, timelines, and decisions
   - Group related concepts together
   - Maintain logical narrative flow

7. **SANITIZATION:**
   - All strings must be valid JSON
   - Properly escape quotes and special characters
   - No raw newlines in strings

**OUTPUT REQUIREMENTS:**
- Set totalSlides to the length of the slides array
- Every slide must have at least a type and title
- Use appropriate slide types based on content
- Ensure smooth narrative progression`;

/**
 * Generate the complete slides prompt with user context
 * @param {string} userPrompt - The user's analysis request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @returns {string} Complete prompt for AI
 */
export function generateSlidesPrompt(userPrompt, researchFiles) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `${slidesPrompt}

**USER REQUEST:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Create a compelling slide deck that presents the key insights from this research.

Respond with ONLY the JSON object.`;
}
