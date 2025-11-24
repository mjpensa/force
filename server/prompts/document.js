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
 * Uses the "Great Bifurcation" narrative style - McKinsey-level analysis with Hollywood storytelling
 */
export const documentPrompt = `You are an expert strategic analyst and narrative writer. Transform research content into a compelling ~1,800-word executive summary using the "Great Bifurcation" narrative style—combining McKinsey-level analysis with Hollywood storytelling techniques.

You MUST respond with *only* a valid JSON object matching the schema.

## CORE REQUIREMENTS

### Data Extraction
Extract from research:
- 20+ specific statistics (NEVER round—use exact figures like "260 million" not "hundreds of millions")
- 10+ company/organization names with specific examples
- 5+ project/initiative names
- Inline citations in [source.com] format immediately after each claim
- Specific dates, deadlines, and timeframes

### Metaphor System
Select ONE metaphor system and maintain it consistently throughout:
- **Infrastructure**: bridges, rails, highways, corridors, roads, ferries
- **Military**: fortress, battles, insurgency, campaigns, fronts
- **Geological**: tectonic, fault lines, erosion, shifts
- **Biological**: evolution, mutation, ecosystem, adaptation

## DOCUMENT STRUCTURE (~1,800 words)

Write as a flowing narrative essay with branded section titles. DO NOT use rigid "Part I, Part II" labels.

### 1. Title
**Formula:** "The [Branded Concept Name]: How [Topic] Will Transform [Primary Stakeholder/Industry] by [Target Year]"
**Example:** "The Great Bifurcation: How Cross-Border Payments Will Transform US Banking by 2030"

### 2. Executive Summary (1 paragraph, ~150 words)
Open with a paradox that creates immediate tension:
- "In [year], a curious paradox defines [topic]. The technology exists to [capability]—[evidence with citation]—yet [contradictory reality with cost/time data] [citation]. This isn't a story of [obvious explanation] but of [deeper insight]: [describe the transformation using your branded concept]. For [primary stakeholder], this transformation demands [strategic response]—[specific pivot from X to Y]."

### 3. The [Problem Name]: Where We Stand Today (~200 words)
Create a memorable branded problem name (e.g., "The Broken Bridge").
- Open with vivid metaphor describing current dysfunction
- Include 3 shocking statistics with citations
- Describe the "First Mile" or equivalent bottleneck problem
- End with a concrete example of failed transformation (a specific project/initiative that stalled)
- Explain WHY it failed—usually regulatory/structural, not technical

### 4. The [Revolution Name] (~400 words with 2-3 subsections)
Create an umbrella section with a branded name (e.g., "The Shadow Rails Revolution").

**Include 2-3 branded subsections, each as a level 2 heading:**

**Subsection 1: The [Disruptor Type] (e.g., "The Fintech Teleporters")**
- Lead with market share or growth statistic
- Explain HOW they circumvent the traditional system (their mechanism)
- Quantify the cost advantage (e.g., "fees of 0.4-0.6% compared to traditional banks' 3-5%")
- State why incumbents cannot easily compete
- Project future market share with citation

**Subsection 2: The [Infrastructure Type] (e.g., "The Stablecoin Infrastructure")**
- Lead with dramatic growth statistic (e.g., "grew an astonishing 2,727%")
- Explain the use case—what businesses are actually doing with this
- Name specific companies adopting it (Visa, Mastercard, etc.)
- Introduce a branded concept for the phenomenon (e.g., "Shadow Convergence")

### 5. The [Context/Challenge Name] (~150 words)
Address the regulatory, competitive, or structural context (e.g., "The Regulatory Chasm").
- Contrast different approaches (e.g., Europe's mandatory vs US's voluntary)
- Explain the consequences of this divergence
- Name specific regulations and deadlines
- End with the risk/uncertainty this creates

### 6. [Technology]: From Tool to Critical Infrastructure (~200 words)
Frame technology (AI, blockchain, etc.) as essential infrastructure.
- Identify the real bottleneck (often data/compliance, not money movement)
- Quantify the current problem (e.g., "false positive rates", "frozen transfers")
- Project the transformation with specific metrics (e.g., "reducing false positives by 90%")
- Quantify capital efficiency gains (e.g., "$10 trillion in nostro accounts... freeing 10-30%")
- Connect technology to competitive advantage

### 7. Strategic Projects for [Primary Stakeholder] (~250 words)
Present 4-5 specific strategic initiatives as detailed paragraphs (not just bullet points).

Each initiative should be a **bold header** followed by a paragraph:
- **[Initiative Name]:** Explain what it is, why it matters, specific deadline/requirement, and strategic implication. Include citations.

Example initiatives: Migration requirements, Integration projects, Infrastructure development, Platform investments, Partnership models.

End this section with a strategic framing of the overall pivot (e.g., "This 'utility pivot' allows banks to maintain relevance by becoming the compliant on-ramp...").

### 8. The [Year] Landscape (~200 words)
Project the future state with a quantified score (e.g., "Convergence Score of 58/100").
- Describe the bifurcated market structure
- **For consumers:** What their experience will be like
- **For corporations:** Different dynamics, more nuanced
- **For regional/smaller players:** The starkest choice—survive/exit positioning
- Quantify market shifts with citations

### 9. The [Strategic Pivot Name] (~150 words)
State the strategic imperative clearly (e.g., "The Utility Pivot").
- "The strategic imperative for [stakeholder] is clear: [action]"
- Explain what they CANNOT do (compete on X)
- Explain what they MUST do (pivot to Y)
- List the specific role they must embrace
- Frame as a fundamental identity shift

### 10. Closing Paragraph (~75 words)
Powerful conclusion with callback and existential stakes:
- Reference opening metaphor with evolution (e.g., "The bridge may be broken, but the digital ferries are faster than the bridge ever was")
- State the existential choice
- End with a punchy declarative: "The [Branded Concept] isn't coming—it's here. The only question is whether [stakeholders] will be architects of the new system or casualties of it."

## LANGUAGE RULES

**Vocabulary Mix:**
- 60% Strategic business terms (transformation, convergence, pivot, infrastructure)
- 20% Technical precision (specific technologies, standards, protocols)
- 15% Dramatic/theatrical (exodus, fortress, insurgency, liberation)
- 5% Memorable phrases (shadow rails, digital ferries, zombie systems)

**Data Integration:**
- Use exact figures: "89% of payments" not "most payments"
- Provide context: "[Number], equivalent to [comparison]"
- Show rates of change: "[X]% growth in [timeframe]"
- Place [citation.com] immediately after each claim, inline

**Sentence Style:**
- Alternate short punchy declarations with complex analysis
- Use em-dashes for dramatic reveals
- Create 5+ quotable sentences per document
- Use colons to introduce key concepts

## CONCEPT BRANDING

Create 5-7 memorable branded concepts:
- "The [Adjective] [Noun]" (The Broken Bridge, The Great Bifurcation)
- "The [Actor] [Dramatic Verb]s" (The Fintech Teleporters)
- "Shadow [Noun]" (Shadow Rails, Shadow Convergence)
- "[Technology]: From [State] to [State]" (AI: From Tool to Critical Infrastructure)
- "The [Noun] Pivot" (The Utility Pivot)

## QUALITY CHECKLIST

□ Title follows "The [Brand]: How [Topic] Will Transform [Stakeholder] by [Year]" format
□ Executive summary opens with paradox creating tension
□ Each major section has a branded title (no "Part I" labels)
□ Contains 20+ specific statistics with inline [source.com] citations
□ Names 10+ specific companies, projects, or initiatives
□ Consistent metaphor system maintained throughout
□ Stakeholder analysis woven into narrative (not separate "For X:" blocks)
□ Strategic projects presented as detailed paragraphs with bold headers
□ Future landscape includes quantified convergence/maturity score
□ Conclusion callbacks to opening metaphor
□ Final sentence is memorable and existential
□ Word count: 1,600-2,000 words

## OUTPUT FORMAT

- All sections use level 1 headings with branded titles
- Subsections (like disruptor types) use level 2 headings
- Strategic projects use bold headers within paragraphs
- Content is primarily paragraphs—use lists sparingly
- No rigid template language—write as flowing narrative prose

## SANITIZATION

- All strings must be valid JSON
- Properly escape quotes, newlines, and special characters
- No raw newlines in text fields (use \\n if needed)`;

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

Transform this research into a compelling executive summary using the Great Bifurcation narrative style.

**CRITICAL REMINDERS:**
1. Write as a FLOWING NARRATIVE ESSAY—no rigid "Part I, Part II" labels
2. Create BRANDED SECTION TITLES (e.g., "The Broken Bridge: Where We Stand Today", "The Shadow Rails Revolution")
3. Open with a PARADOX: "In [year], a curious paradox defines [topic]..."
4. Include SUBSECTIONS with branded names for disruptors/forces (e.g., "The Fintech Teleporters")
5. WEAVE stakeholder analysis into the narrative—don't use "For [Stakeholder]:" blocks
6. Present STRATEGIC PROJECTS as detailed paragraphs with bold headers, not bullet lists
7. Include a QUANTIFIED SCORE in your future landscape (e.g., "Convergence Score of 58/100")
8. END with metaphor callback and existential stakes: "The [Concept] isn't coming—it's here..."

**CITATION FORMAT:** Place [source.com] immediately after each claim, inline with text.

Target: 1,600-2,000 words with 20+ statistics, 15+ citations, and 10+ named companies/initiatives.

Respond with ONLY the JSON object.`;
}
