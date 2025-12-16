# CONSOLIDATED EXECUTION MANIFEST
## Priority 1 Implementations (1.1 - 1.5)

---

## QUICK REFERENCE TABLE

| ID | Name | File | Phase | Status | Depends On | Est. Lines |
|----|------|------|-------|--------|------------|------------|
| 1.2 | Source Extraction Enhancement | slides.js | 1 | ⬜ | None | +60 |
| 1.3 | synthesisNote Required | document.js | 1 | ⬜ | None | +30 |
| 1.1 | Temporal Context | slides.js | 2 | ⬜ | 1.2 | +30 |
| 1.4 | Threading Anti-Patterns | slides.js | 2 | ⬜ | 1.2 | +35 |
| 1.5 | Validation Checklist | slides.js | 3 | ⬜ | 1.1, 1.2, 1.4 | +46 |

**Status Legend:** ⬜ Pending | 🔄 In Progress | ✅ Complete | ❌ Failed

---

# PHASE 1: FOUNDATION (Independent)

---

## [1.2]: Source Extraction Enhancement (CORRECTED)

**File:** `server/prompts/slides.js`
**Prerequisites:** None - EXECUTE FIRST
**Current Lines:** 189-218

### Claude Code Prompt

```
I need you to replace the extractKeyStats function in server/prompts/slides.js with an enhanced version that returns an object with arrays instead of a string.

LOCATION: Lines 189-218 (the entire extractKeyStats function)

FIND THIS CODE (the entire function from JSDoc to closing brace):
/**
 * Extract key statistics from research content for prompt enhancement
 * Forces AI to use real data points from research
 * @param {string} content - Combined research content
 * @returns {string} - Comma-separated list of key data points
 */
function extractKeyStats(content) {
  if (!content) return '';

  const patterns = [
    /\d+\.?\d*\s*%/g,                          // Percentages: 23%, 4.5%
    /\$\d[\d,]*\.?\d*\s*[MBK]?(?:illion)?/gi,  // Currency: $4M, $2.5 billion
    /\d+x\b/gi,                                // Multipliers: 3x, 10x
    /\d{1,3}(?:,\d{3})+/g,                     // Large numbers with commas: 1,000,000
    /\b\d{4,}\b/g,                             // Plain large numbers: 50000, 100000
    /Q[1-4]\s*20\d{2}/gi,                      // Quarters: Q3 2024
    /\b20\d{2}\b/g,                            // Years: 2024, 2025 (word boundary)
    /\d+\s*bps\b/gi,                           // Basis points: 150 bps, 25bps
    /\b\d+:1\b/g,                               // Ratios: 3:1, 10:1 (X:1 format only, avoids times)
    /\d+\s*(?:months?|years?|days?|weeks?)\b/gi // Durations: 18 months, 3 years
  ];

  const matches = new Set();
  for (const pattern of patterns) {
    const found = content.match(pattern) || [];
    found.slice(0, 5).forEach(m => matches.add(m.trim()));
  }

  return Array.from(matches).slice(0, 15).join(', ');
}

REPLACE WITH THIS EXACT CODE:
/**
 * Extract key statistics, contextual sentences, and sources from research content
 * Enhanced version with source extraction for better citation support
 * @param {string} content - Combined research content
 * @returns {object} - Object with stats string, contextual stats array, and sources array
 */
function extractKeyStats(content) {
  if (!content) return { stats: '', sources: [], contextualStats: [] };

  // Statistical patterns (unchanged)
  const statPatterns = [
    /\d+\.?\d*\s*%/g,                          // Percentages: 23%, 4.5%
    /\$\d[\d,]*\.?\d*\s*[MBK]?(?:illion)?/gi,  // Currency: $4M, $2.5 billion
    /\d+x\b/gi,                                // Multipliers: 3x, 10x
    /\d{1,3}(?:,\d{3})+/g,                     // Large numbers with commas: 1,000,000
    /\b\d{4,}\b/g,                             // Plain large numbers: 50000, 100000
    /Q[1-4]\s*20\d{2}/gi,                      // Quarters: Q3 2024
    /\b20\d{2}\b/g,                            // Years: 2024, 2025 (word boundary)
    /\d+\s*bps\b/gi,                           // Basis points: 150 bps, 25bps
    /\b\d+:1\b/g,                              // Ratios: 3:1, 10:1
    /\d+\s*(?:months?|years?|days?|weeks?)\b/gi // Durations: 18 months, 3 years
  ];

  // Source extraction patterns (NEW)
  const sourcePatterns = [
    /according to ([^,.\n]+)/gi,
    /per ([^,.\n]+(?:report|study|analysis|survey|data)[^,.\n]*)/gi,
    /([A-Z][a-zA-Z]+ (?:Q[1-4] )?\d{4} (?:Annual |Quarterly )?Report)/g,
    /((?:Gartner|McKinsey|Forrester|Deloitte|BCG|Bain|Bloomberg|Reuters|ISDA|Federal Reserve)[^,.\n]{0,50})/gi,
    /\[([^\]]+(?:Report|Study|Analysis|Survey|Data)[^\]]*)\]/gi,
    /(?:published by|released by) ([^,.\n]+)/gi
  ];

  // Extract contextual stats (sentences containing numbers) - NEW
  const sentences = content.split(/(?<=[.!?])\s+/);
  const contextualStats = [];
  const seenSentences = new Set();

  for (const sentence of sentences) {
    if (seenSentences.has(sentence) || sentence.length < 20 || sentence.length > 300) continue;

    for (const pattern of statPatterns) {
      pattern.lastIndex = 0; // Reset regex state
      if (pattern.test(sentence)) {
        contextualStats.push(sentence.trim());
        seenSentences.add(sentence);
        break;
      }
    }
    if (contextualStats.length >= 15) break;
  }

  // Extract raw stats (original behavior)
  const rawMatches = new Set();
  for (const pattern of statPatterns) {
    pattern.lastIndex = 0;
    const found = content.match(pattern) || [];
    found.slice(0, 5).forEach(m => rawMatches.add(m.trim()));
  }

  // Extract sources - NEW
  const sources = new Set();
  for (const pattern of sourcePatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null && sources.size < 12) {
      const source = match[1]?.trim();
      if (source && source.length > 5 && source.length < 100) {
        // Filter out common false positives
        const lowerSource = source.toLowerCase();
        if (!lowerSource.includes('this') &&
            !lowerSource.includes('that') &&
            !lowerSource.includes('which') &&
            !lowerSource.startsWith('the ')) {
          sources.add(source);
        }
      }
    }
  }

  return {
    stats: Array.from(rawMatches).slice(0, 15).join(', '),
    sources: Array.from(sources),
    contextualStats: contextualStats.slice(0, 12)
  };
}

THEN update the two places that call extractKeyStats:

1. In generateSlidesOutlinePrompt (around line 255), find:
   const keyStats = extractKeyStats(researchContent);

   Replace with:
   const { stats, sources, contextualStats } = extractKeyStats(researchContent);

2. In generateSlidesPrompt (around line 421), find:
   const keyStats = extractKeyStats(researchContent);

   Replace with:
   const { stats, sources, contextualStats } = extractKeyStats(researchContent);

THEN update the template sections that use keyStats:

3. In generateSlidesOutlinePrompt template, find "KEY DATA POINTS FROM RESEARCH" section (around line 349):

   FIND:
   KEY DATA POINTS FROM RESEARCH (use these in your outlines):
   ${keyStats || 'Extract specific numbers, percentages, and dates from the research'}

   REPLACE WITH:
   KEY DATA POINTS FROM RESEARCH (use at least 2-3 per slide):
   ${stats || 'Extract specific numbers, percentages, and dates from the research text'}

   EXTRACTED SOURCES (cite these in your content):
   ${sources.length > 0 ? sources.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'No explicit sources identified - extract source names from the research content'}

   EVIDENCE SENTENCES (use these for supporting claims):
   ${contextualStats.length > 0 ? contextualStats.map((s, i) => `${i + 1}. "${s}"`).join('\n') : 'No contextual statistics extracted - use specific data points from research'}

4. In generateSlidesPrompt template, find "KEY DATA POINTS FROM RESEARCH" section (around line 779):

   FIND:
   KEY DATA POINTS FROM RESEARCH (use at least one per slide):
   ${keyStats || 'Extract specific numbers, percentages, and dates from the research text'}

   REPLACE WITH:
   KEY DATA POINTS FROM RESEARCH (use at least one per slide):
   ${stats || 'Extract specific numbers, percentages, and dates from the research text'}

   EXTRACTED SOURCES (cite these in your content):
   ${sources.length > 0 ? sources.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'No explicit sources identified - extract source names from the research content'}

   EVIDENCE SENTENCES (use these for supporting claims):
   ${contextualStats.length > 0 ? contextualStats.map((s, i) => `${i + 1}. "${s}"`).join('\n') : 'No contextual statistics extracted - use specific data points from research'}

After making changes, run: node --check server/prompts/slides.js
```

### Return Type Reference

```javascript
{
  stats: string,            // Comma-separated raw statistics (e.g., "25%, $4M, Q3 2024")
  sources: string[],        // Array of extracted source names
  contextualStats: string[] // Array of full sentences containing stats
}
```

### Post-Execution Checklist

- [ ] `node --check server/prompts/slides.js` passes (no syntax errors)
- [ ] `extractKeyStats` function returns object with `{ stats, sources, contextualStats }`
- [ ] `stats` is a string (comma-separated)
- [ ] `sources` is an array of strings
- [ ] `contextualStats` is an array of strings
- [ ] Both `generateSlidesOutlinePrompt` and `generateSlidesPrompt` destructure correctly
- [ ] Template sections show `EXTRACTED SOURCES` and `EVIDENCE SENTENCES`
- [ ] Source patterns include Gartner, McKinsey, Forrester, etc.

### Validation Commands

```bash
# Syntax check
node --check server/prompts/slides.js

# Verify return structure
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('Returns correct object:', c.includes('return {') && c.includes('stats: Array.from(rawMatches)') && c.includes('sources: Array.from(sources)') && c.includes('contextualStats: contextualStats.slice') ? '✓' : '✗');"

# Verify destructuring pattern (should be 2 occurrences)
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); const count=(c.match(/const \{ stats, sources, contextualStats \} = extractKeyStats/g) || []).length; console.log('Destructuring count:', count, count===2 ? '✓' : '✗');"

# Verify EXTRACTED SOURCES in template (should be 2 occurrences)
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); const count=(c.match(/EXTRACTED SOURCES \(cite these/g) || []).length; console.log('EXTRACTED SOURCES sections:', count, count===2 ? '✓' : '✗');"

# Verify EVIDENCE SENTENCES in template (should be 2 occurrences)
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); const count=(c.match(/EVIDENCE SENTENCES \(use these/g) || []).length; console.log('EVIDENCE SENTENCES sections:', count, count===2 ? '✓' : '✗');"

# Verify source patterns include key vendors
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('Has Gartner/McKinsey pattern:', c.includes('Gartner|McKinsey|Forrester') ? '✓' : '✗');"

# Verify array handling in templates
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('Uses sources.length:', c.includes('sources.length > 0') ? '✓' : '✗'); console.log('Uses contextualStats.length:', c.includes('contextualStats.length > 0') ? '✓' : '✗');"

# Runtime test
node -e "
const { generateSlidesOutlinePrompt } = require('./server/prompts/slides.js');
const prompt = generateSlidesOutlinePrompt(
  'Test',
  [{filename:'research.md', content:'According to McKinsey Q4 2024 Report, costs dropped 50%. JPMorgan reduced reconciliation time by 60% per Bloomberg data.'}]
);
console.log('Has EXTRACTED SOURCES:', prompt.includes('EXTRACTED SOURCES') ? '✓' : '✗');
console.log('Has EVIDENCE SENTENCES:', prompt.includes('EVIDENCE SENTENCES') ? '✓' : '✗');
console.log('Extracted McKinsey:', prompt.includes('McKinsey') ? '✓' : '✗');
"
```

### Completion Notes

- Date completed: ____________
- Issues encountered: _________________________________________
- Line numbers after change: extractKeyStats ends at line ____
- Sources extracted in test: _________________________________________

---

## [1.3]: Make synthesisNote Required

**File:** `server/prompts/document.js`
**Prerequisites:** None - Can run in parallel with 1.2
**Current Lines:** 176-179 (schema), 208 (required array), 428-433 (template)

### Claude Code Prompt

```
I need you to make the synthesisNote field required in document.js with enhanced guidance.

STEP 1: Update synthesisNote schema description
LOCATION: Lines 176-179

FIND:
          synthesisNote: {
            type: "string",
            description: "How this section connects to or builds on other sections - creates narrative flow and coherence"
          },

REPLACE WITH:
          synthesisNote: {
            type: "string",
            description: "REQUIRED connection statement showing how this section relates to others. Format: '[CONNECTION_TYPE]: [explanation]' where CONNECTION_TYPE is one of: BUILDS_ON (extends previous section's point), DEEPENS (adds nuance to earlier claim), CHALLENGES (presents counterpoint), PIVOTS (shifts focus with clear bridge), RESOLVES (synthesizes prior tensions). Example: 'DEEPENS: The cost implications outlined above become acute when we examine implementation timelines.'"
          },

STEP 2: Add synthesisNote to required array
LOCATION: Line 208

FIND:
        required: ["heading", "keyInsight", "paragraphs"]

REPLACE WITH:
        required: ["heading", "keyInsight", "paragraphs", "synthesisNote"]

STEP 3: Expand TRANSITIONS & FLOW section in prompt template
LOCATION: Lines 428-433

FIND:
TRANSITIONS & FLOW:
- Connect sections with forward references: "This cost pressure intensifies when we examine..."
- Use bridge sentences that link evidence to next topic
- Avoid abrupt topic shifts - each paragraph should flow from the previous
- Fill the synthesisNote field to show how each section builds on others
- Patterns: "Building on this...", "This dynamic compounds in...", "The implications extend to..."

REPLACE WITH:
SYNTHESIS NOTE REQUIREMENTS (MANDATORY for each section):
The synthesisNote field is REQUIRED. Format: "[CONNECTION_TYPE]: [explanation]"

CONNECTION TYPES (choose the most accurate):
- BUILDS_ON: Extends or expands the previous section's main point
- DEEPENS: Adds nuance, detail, or complexity to an earlier claim
- CHALLENGES: Presents a counterpoint, tension, or complication
- PIVOTS: Shifts focus to a new dimension with explicit bridge
- RESOLVES: Synthesizes or reconciles tensions from prior sections

SECTION-SPECIFIC FORMATS:
- First section: "ESTABLISHES: [what foundation this section lays for the document]"
- Middle sections: "[CONNECTION_TYPE]: [how this connects to section X and advances the argument]"
- Final section: "RESOLVES: [how this synthesizes the preceding analysis into actionable conclusion]"

GOOD EXAMPLES:
- "BUILDS_ON: The cost pressures identified in Market Analysis become acute when we examine implementation timelines."
- "CHALLENGES: While the efficiency gains above appear compelling, regulatory constraints introduce significant friction."
- "PIVOTS: Having established the competitive landscape, we now examine the internal capabilities required to respond."
- "RESOLVES: The technology, cost, and competitive factors above converge on a single strategic imperative."

ANTI-PATTERNS (DO NOT USE):
- ❌ "This section discusses..." (describes, doesn't connect)
- ❌ "Moving on to..." (transition word without connection logic)
- ❌ "Another important topic..." (no relationship to prior content)
- ❌ "See above" or "As mentioned" (vague back-references)
- ❌ Empty or generic statements that could apply to any document

TRANSITIONS & FLOW:
- Connect sections with forward references: "This cost pressure intensifies when we examine..."
- Use bridge sentences that link evidence to next topic
- Avoid abrupt topic shifts - each paragraph should flow from the previous
- Patterns: "Building on this...", "This dynamic compounds in...", "The implications extend to..."

STEP 4: Update existing synthesisNote example for format consistency
LOCATION: Lines 474-476 in document.js

FIND:
Each section's synthesisNote must explicitly reference findings from previous sections:
- BAD: "This section covers technology implications"
- GOOD: "Building on the $2.3M quarterly cost gap identified above, technology modernization becomes not optional but existential"

REPLACE WITH:
Each section's synthesisNote must use the CONNECTION_TYPE format and reference specific findings:
- BAD: "This section covers technology implications" (no connection type, vague)
- GOOD: "BUILDS_ON: The $2.3M quarterly cost gap identified above makes technology modernization not optional but existential"

After making changes, run: node --check server/prompts/document.js
```

### Post-Execution Checklist

- [ ] `node --check server/prompts/document.js` passes (no syntax errors)
- [ ] `synthesisNote` is in required array (4 elements total)
- [ ] Schema description includes "REQUIRED" and "CONNECTION_TYPE"
- [ ] Template has "SYNTHESIS NOTE REQUIREMENTS" section
- [ ] Template has "ANTI-PATTERNS (DO NOT USE)" with 5 ❌ markers

### Validation Commands

```bash
# Syntax check
node --check server/prompts/document.js

# Verify required array
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/document.js','utf8'); const match=c.match(/required:\s*\[\"heading\",\s*\"keyInsight\",\s*\"paragraphs\"(?:,\s*\"synthesisNote\")?\]/); console.log('synthesisNote required:', match && match[0].includes('synthesisNote') ? '✓' : '✗');"

# Verify anti-patterns
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/document.js','utf8'); console.log('Anti-patterns count:', (c.match(/❌/g) || []).length);"

# Verify CONNECTION TYPES
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/document.js','utf8'); ['BUILDS_ON','DEEPENS','CHALLENGES','PIVOTS','RESOLVES'].forEach(t => console.log(t+':', c.includes(t) ? '✓' : '✗'));"
```

### Completion Notes

- Date completed: ____________
- Issues encountered: _________________________________________
- Breaking change note: This is intentional - new documents must include synthesisNote

---

## PHASE 1 CHECKPOINT

After completing 1.2 and 1.3, verify:

```bash
echo "=== PHASE 1 CHECKPOINT ==="

# 1.2 Verification
echo "--- 1.2: Source Extraction ---"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('Returns object with arrays:', c.includes('sources: Array.from(sources)') && c.includes('contextualStats: contextualStats.slice') ? '✓ PASS' : '✗ FAIL');"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('Destructuring (2x):', (c.match(/const \{ stats, sources, contextualStats \}/g)||[]).length===2 ? '✓ PASS (2)' : '✗ FAIL');"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('EXTRACTED SOURCES:', c.includes('EXTRACTED SOURCES') ? '✓ PASS' : '✗ FAIL');"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('EVIDENCE SENTENCES:', c.includes('EVIDENCE SENTENCES') ? '✓ PASS' : '✗ FAIL');"

# 1.3 Verification
echo "--- 1.3: synthesisNote Required ---"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/document.js','utf8'); console.log('synthesisNote in required array:', c.includes('\"paragraphs\", \"synthesisNote\"') ? '✓ PASS' : '✗ FAIL');"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/document.js','utf8'); console.log('SYNTHESIS NOTE REQUIREMENTS:', c.includes('SYNTHESIS NOTE REQUIREMENTS') ? '✓ PASS' : '✗ FAIL');"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/document.js','utf8'); console.log('Anti-pattern markers:', (c.match(/❌/g) || []).length >= 5 ? '✓ PASS' : '✗ FAIL');"

echo "=== END PHASE 1 CHECKPOINT ==="
```

> ⚠️ **DO NOT PROCEED TO PHASE 2 UNTIL ALL PHASE 1 CHECKS PASS**

---

# PHASE 2: DEPENDENT CHANGES

---

## [1.1]: Add Temporal Context

**File:** `server/prompts/slides.js`
**Prerequisites:** ✅ 1.2 must be complete
**Insert Location:** BEFORE extractKeyStats function (now at ~line 189 after 1.2 changes)

### Claude Code Prompt

```
PREREQUISITE CHECK: Before proceeding, verify 1.2 is complete:
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); if(!c.includes('sources: Array.from(sources)') || !c.includes('contextualStats: contextualStats.slice')) { console.log('ERROR: 1.2 not complete. Run 1.2 first.'); process.exit(1); } else { console.log('1.2 verified ✓'); }"

I need you to add temporal context functionality to slides.js.

STEP 1: Add getCurrentDateContext function
LOCATION: Insert BEFORE the extractKeyStats function (find the JSDoc comment that starts "Extract key statistics, contextual sentences, and sources")

FIND:
/**
 * Extract key statistics, contextual sentences, and sources from research content

INSERT BEFORE IT:
/**
 * Get current date context for time-aware recommendations
 * Enables temporally-aware framing in slide content
 * @returns {object} Object with formatted date strings and fiscal quarter info
 */
function getCurrentDateContext() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-indexed
  const quarter = Math.ceil(month / 3);
  const nextQuarter = quarter === 4 ? 1 : quarter + 1;
  const nextQuarterYear = quarter === 4 ? year + 1 : year;

  return {
    fullDate: now.toISOString().split('T')[0], // YYYY-MM-DD
    month: now.toLocaleString('en-US', { month: 'long' }),
    year,
    currentQuarter: `Q${quarter} ${year}`,
    nextQuarter: `Q${nextQuarter} ${nextQuarterYear}`,
    quarterPlusTwo: `Q${((quarter + 1) % 4) + 1} ${quarter >= 3 ? year + 1 : year}`,
    endOfYear: `Q4 ${year}`,
    nextYear: year + 1
  };
}

STEP 2: Add dateContext to generateSlidesOutlinePrompt
LOCATION: Find the destructuring line from 1.2:
  const { stats, sources, contextualStats } = extractKeyStats(researchContent);

INSERT AFTER IT:
  // Get current temporal context
  const dateContext = getCurrentDateContext();

STEP 3: Add TEMPORAL CONTEXT to outline prompt template
LOCATION: Find "KEY DATA POINTS FROM RESEARCH" section
INSERT BEFORE "KEY DATA POINTS FROM RESEARCH":

TEMPORAL CONTEXT (for time-aware framing):
- Today's date: ${dateContext.fullDate}
- Current quarter: ${dateContext.currentQuarter}
- Next quarter: ${dateContext.nextQuarter}
- Planning horizon: ${dateContext.quarterPlusTwo}

STEP 4: Add dateContext to generateSlidesPrompt
LOCATION: Find the destructuring line in generateSlidesPrompt:
  const { stats, sources, contextualStats } = extractKeyStats(researchContent);

INSERT AFTER IT:
  // Get current temporal context
  const dateContext = getCurrentDateContext();

STEP 5: Add TEMPORAL CONTEXT to content prompt template
LOCATION: Find "KEY DATA POINTS FROM RESEARCH" section in the content prompt
INSERT BEFORE "KEY DATA POINTS FROM RESEARCH":

TEMPORAL CONTEXT (for time-aware framing):
- Today's date: ${dateContext.fullDate}
- Current quarter: ${dateContext.currentQuarter}
- Next quarter: ${dateContext.nextQuarter}
- Planning horizon: ${dateContext.quarterPlusTwo}

After making changes, run: node --check server/prompts/slides.js
```

### Post-Execution Checklist

- [ ] `node --check server/prompts/slides.js` passes (no syntax errors)
- [ ] `getCurrentDateContext` function exists before `extractKeyStats`
- [ ] `dateContext` declared in both prompt functions
- [ ] `TEMPORAL CONTEXT` block in both prompt templates
- [ ] All 4 dateContext properties used (fullDate, currentQuarter, nextQuarter, quarterPlusTwo)

### Validation Commands

```bash
# Syntax check
node --check server/prompts/slides.js

# Verify function exists
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('getCurrentDateContext exists:', c.includes('function getCurrentDateContext()') ? '✓' : '✗');"

# Verify dateContext declarations (should be 2)
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('dateContext declarations:', (c.match(/const dateContext = getCurrentDateContext/g) || []).length);"

# Verify TEMPORAL CONTEXT in templates (should be 2)
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('TEMPORAL CONTEXT blocks:', (c.match(/TEMPORAL CONTEXT \(for time-aware framing\)/g) || []).length);"

# Test function output
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); const match=c.match(/function getCurrentDateContext\(\)[^}]+\{[\s\S]+?return \{[\s\S]+?\};[\s\S]+?\}/); if(match){const f=new Function('return '+match[0].replace('function ','function '))(); console.log(f());}"
```

### Completion Notes

- Date completed: ____________
- Issues encountered: _________________________________________
- Line number for getCurrentDateContext: starts at line ____

---

## [1.4]: Add Threading Anti-Patterns

**File:** `server/prompts/slides.js`
**Prerequisites:** ✅ 1.2 must be complete (1.1 recommended but not required)
**Locations:** connectsTo guidance (~line 328), CROSS-SLIDE section (~line 545)

### Claude Code Prompt

```
PREREQUISITE CHECK: Before proceeding, verify 1.2 is complete:
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); if(!c.includes('sources: Array.from(sources)') || !c.includes('contextualStats: contextualStats.slice')) { console.log('ERROR: 1.2 not complete. Run 1.2 first.'); process.exit(1); } else { console.log('1.2 verified ✓'); }"

I need you to add threading anti-patterns to slides.js.

STEP 1: Expand connectsTo guidance in outline prompt
LOCATION: Find this section (search for 'connectsTo": How this slide'):

FIND:
   d) "connectsTo": How this slide's IMPLICATION leads to the next slide's EVIDENCE
      This creates narrative threading between slides.
      EXAMPLE: "Cost pressure from delayed adoption → leads to → competitive disadvantage analysis"
      For the last slide in a section: "Section conclusion → creates tension for → next section's opening"

REPLACE WITH:
   d) "connectsTo": How this slide's IMPLICATION leads to the next slide's EVIDENCE
      This creates narrative threading between slides.

      GOOD EXAMPLES (specific, actionable connections):
      - "$2.3M cost gap from Section 1 → compounds into → competitive market share loss analyzed here"
      - "60% efficiency gain established above → enables → the pricing strategy examined next"
      - "Regulatory deadline pressure → forces → accelerated implementation timeline in next slide"

      CONNECTSTO ANTI-PATTERNS (DO NOT USE):
      - ❌ "Relates to next slide" (vague, no logical connection)
      - ❌ "Continues the analysis" (describes, doesn't connect)
      - ❌ "See next slide for more" (defers, doesn't link)
      - ❌ "Another important point" (no causal relationship)
      - ❌ "Moving on to..." (transition word without logic)
      - ❌ "" or omitted (breaks narrative thread entirely)
      - ❌ "Related to [topic]" (topic label, not logical connection)

      CONNECTSTO REQUIREMENTS:
      1. Must reference SPECIFIC content from current slide (data point, insight, or implication)
      2. Must specify WHAT in the next slide this connects to
      3. Must show LOGICAL RELATIONSHIP (causes, enables, compounds, challenges, resolves)

      For the last slide in a section: "Section conclusion → creates tension for → next section's opening"
      TEST: If you can't explain WHY slide N+1 follows slide N, your connectsTo is too weak.

STEP 2: Add Narrative Threading Validation section
LOCATION: Find this line (search for 'Isolated "islands" of analysis'):

FIND:
- ANTI-PATTERN: Isolated "islands" of analysis with no connection between slides

TRANSITION PATTERNS (use in paragraph endings to connect slides):

INSERT BETWEEN THEM (after ANTI-PATTERN, before TRANSITION PATTERNS):
- ANTI-PATTERN: Isolated "islands" of analysis with no connection between slides

NARRATIVE THREADING VALIDATION (apply to every connectsTo field):

SPECIFICITY TEST:
- ❌ FAIL: "Leads to next topic" (could apply to any presentation)
- ✓ PASS: "The $2.3M quarterly gap → compounds into → 15% annual market share erosion"

BIDIRECTIONAL TEST:
- From slide N: Can you identify exactly which element connects forward?
- From slide N+1: Can you trace back to the specific trigger from slide N?
- If either fails, the connection is too weak.

LOGICAL RELATIONSHIP TEST - connectsTo must express one of:
- CAUSES: "X directly causes Y" (cost pressure → margin compression)
- ENABLES: "X makes Y possible" (automation → speed advantage)
- COMPOUNDS: "X amplifies Y" (delay cost + opportunity cost → accelerating gap)
- CHALLENGES: "X creates tension with Y" (efficiency gains vs. implementation risk)
- RESOLVES: "X addresses tension from Y" (mitigation strategy → risk from Section 2)

TRANSITION PATTERNS (use in paragraph endings to connect slides):

After making changes, run: node --check server/prompts/slides.js
```

### Post-Execution Checklist

- [ ] `node --check server/prompts/slides.js` passes (no syntax errors)
- [ ] "CONNECTSTO ANTI-PATTERNS" section exists
- [ ] "NARRATIVE THREADING VALIDATION" section exists
- [ ] 7 or more ❌ markers total
- [ ] All 5 relationship types: CAUSES, ENABLES, COMPOUNDS, CHALLENGES, RESOLVES

### Validation Commands

```bash
# Syntax check
node --check server/prompts/slides.js

# Verify anti-patterns section
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('CONNECTSTO ANTI-PATTERNS:', c.includes('CONNECTSTO ANTI-PATTERNS') ? '✓' : '✗');"

# Verify validation section
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('NARRATIVE THREADING VALIDATION:', c.includes('NARRATIVE THREADING VALIDATION') ? '✓' : '✗');"

# Count anti-pattern markers
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('❌ markers:', (c.match(/❌/g) || []).length);"

# Verify relationship types
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); ['CAUSES','ENABLES','COMPOUNDS','CHALLENGES','RESOLVES'].forEach(t => console.log(t+':', c.includes('- '+t+':') ? '✓' : '✗'));"

# Verify tests
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); ['SPECIFICITY TEST','BIDIRECTIONAL TEST','LOGICAL RELATIONSHIP TEST'].forEach(t => console.log(t+':', c.includes(t) ? '✓' : '✗'));"
```

### Completion Notes

- Date completed: ____________
- Issues encountered: _________________________________________

---

## PHASE 2 CHECKPOINT

After completing 1.1 and 1.4, verify:

```bash
echo "=== PHASE 2 CHECKPOINT ==="

# 1.1 Verification
echo "--- 1.1: Temporal Context ---"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('getCurrentDateContext exists:', c.includes('function getCurrentDateContext()') ? '✓ PASS' : '✗ FAIL');"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('dateContext declarations:', (c.match(/const dateContext = getCurrentDateContext/g) || []).length === 2 ? '✓ PASS (2)' : '✗ FAIL');"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('TEMPORAL CONTEXT blocks:', (c.match(/TEMPORAL CONTEXT \(for time-aware framing\)/g) || []).length === 2 ? '✓ PASS (2)' : '✗ FAIL');"

# 1.4 Verification
echo "--- 1.4: Threading Anti-Patterns ---"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('CONNECTSTO ANTI-PATTERNS:', c.includes('CONNECTSTO ANTI-PATTERNS') ? '✓ PASS' : '✗ FAIL');"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('NARRATIVE THREADING VALIDATION:', c.includes('NARRATIVE THREADING VALIDATION') ? '✓ PASS' : '✗ FAIL');"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); const count=(c.match(/❌/g) || []).length; console.log('Anti-pattern markers (7+):', count >= 7 ? '✓ PASS ('+count+')' : '✗ FAIL ('+count+')');"

echo "=== END PHASE 2 CHECKPOINT ==="
```

> ⚠️ **DO NOT PROCEED TO PHASE 3 UNTIL ALL PHASE 2 CHECKS PASS**

---

# PHASE 3: INTEGRATION

---

## [1.5]: Add Validation Checklist

**File:** `server/prompts/slides.js`
**Prerequisites:** ✅ 1.1, 1.2, and 1.4 must all be complete
**Locations:** After JSON.stringify in outlineConstraint, Before OUTPUT FORMAT (CRITICAL)

### Claude Code Prompt

```
PREREQUISITE CHECK: Before proceeding, verify all dependencies:
node -e "
const fs=require('fs');
const c=fs.readFileSync('./server/prompts/slides.js','utf8');
const checks = [
  ['1.2 Source Extraction', c.includes('sources: Array.from(sources)') && c.includes('contextualStats: contextualStats.slice')],
  ['1.1 Temporal Context', c.includes('function getCurrentDateContext()')],
  ['1.4 Threading Anti-Patterns', c.includes('CONNECTSTO ANTI-PATTERNS')]
];
let allPass = true;
checks.forEach(([name, pass]) => {
  console.log(name + ':', pass ? '✓' : '✗ MISSING');
  if (!pass) allPass = false;
});
if (!allPass) { console.log('ERROR: Prerequisites not met. Complete missing items first.'); process.exit(1); }
console.log('All prerequisites verified ✓');
"

I need you to add the outline fidelity checklist to slides.js.

STEP 1: Add OUTLINE FIELD REFERENCE after JSON.stringify
LOCATION: Find this section in the outlineConstraint (search for 'JSON.stringify(outline, null, 2)'):

FIND:
${JSON.stringify(outline, null, 2)}

PRIMARY FRAMEWORK ENFORCEMENT:

REPLACE WITH:
${JSON.stringify(outline, null, 2)}

OUTLINE FIELD REFERENCE (use these to verify compliance):
- Total sections: ${outline.sections?.length || 0}
- Slides per section: ${outline.sections?.map((s, i) => `Section ${i+1}: ${s.slides?.length || 0} slides`).join(', ') || 'See outline'}
- Primary framework: ${outline.reasoning?.primaryFramework || 'See outline'}
- Evidence chains to include: ${outline.reasoning?.keyEvidenceChains?.length || 0}

PRIMARY FRAMEWORK ENFORCEMENT:

STEP 2: Add OUTLINE FIDELITY CHECKLIST before OUTPUT FORMAT
LOCATION: Find "OUTPUT FORMAT (CRITICAL):" section

FIND:
${researchContent}

OUTPUT FORMAT (CRITICAL):

REPLACE WITH:
${researchContent}

${outline ? `
═══════════════════════════════════════════════════════════════════════════════
                        OUTLINE FIDELITY CHECKLIST
        Before generating output, verify each checkpoint against the outline
═══════════════════════════════════════════════════════════════════════════════

CHECKPOINT 1: TAGLINE FIDELITY
Each slide MUST use the EXACT tagline from the outline (or minor rewording for impact only).
Outline specifies these taglines - verify each appears in your output.

CHECKPOINT 2: KEY DATA POINT INCLUSION
Each slide specifies a keyDataPoint that MUST appear as PRIMARY evidence.
Verify these data points are prominently featured (not buried or paraphrased away).

CHECKPOINT 3: ANALYTICAL LENS CONSISTENCY
Primary framework: ${outline.reasoning?.primaryFramework || 'Not specified'}
At least 50% of slides must use this framework's signal phrases.

CHECKPOINT 4: CONNECTION THREADING
Each slide's connectsTo field defines how it leads to the next slide.
Your content must create this logical flow - verify paragraph endings match connectsTo.

CHECKPOINT 5: SECTION ARC COMPLIANCE
Each section must follow its narrativeArc. Verify:
- Phase 1 slides (1-2): CONTEXT - what IS happening
- Phase 2 slides (3-5): ANALYSIS - why it matters
- Phase 3 slides (final): IMPLICATIONS - what to DO

═══════════════════════════════════════════════════════════════════════════════
                          END CHECKLIST - NOW GENERATE
═══════════════════════════════════════════════════════════════════════════════
` : ''}
OUTPUT FORMAT (CRITICAL):

After making changes, run: node --check server/prompts/slides.js
```

### Post-Execution Checklist

- [ ] `node --check server/prompts/slides.js` passes (no syntax errors)
- [ ] "OUTLINE FIELD REFERENCE" section exists
- [ ] 5 CHECKPOINT sections (1-5) exist
- [ ] Box drawing characters (═══) present
- [ ] Checklist only renders when outline is provided
- [ ] Conditional `${outline ? ... : ''}` wrapping works correctly

### Validation Commands

```bash
# Syntax check
node --check server/prompts/slides.js

# Verify field reference
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('OUTLINE FIELD REFERENCE:', c.includes('OUTLINE FIELD REFERENCE') ? '✓' : '✗');"

# Verify all 5 checkpoints
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); for(let i=1;i<=5;i++) console.log('CHECKPOINT '+i+':', c.includes('CHECKPOINT '+i+':') ? '✓' : '✗');"

# Verify box drawing
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('Box borders:', (c.match(/═{20,}/g) || []).length >= 2 ? '✓' : '✗');"

# Conditional rendering test
node -e "
const { generateSlidesPrompt } = require('./server/prompts/slides.js');
const promptNoOutline = generateSlidesPrompt('Test', [{filename:'t.md', content:'25% growth'}]);
console.log('Without outline - no checklist:', !promptNoOutline.includes('OUTLINE FIDELITY') ? '✓' : '✗');
const testOutline = {reasoning:{primaryFramework:'COMPETITIVE_DYNAMICS'},sections:[{swimlane:'Test',slides:[{tagline:'TEST'}]}]};
const promptWithOutline = generateSlidesPrompt('Test', [{filename:'t.md', content:'25% growth'}], [], testOutline);
console.log('With outline - has checklist:', promptWithOutline.includes('OUTLINE FIDELITY') ? '✓' : '✗');
"
```

### Completion Notes

- Date completed: ____________
- Issues encountered: _________________________________________
- Template escaping issues: _________________________________________

---

# FINAL CHECKPOINT

After completing all 5 recommendations:

```bash
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "                    PRIORITY 1 FINAL VERIFICATION"
echo "═══════════════════════════════════════════════════════════════════════════════"

# Syntax checks
echo ""
echo "--- SYNTAX CHECKS ---"
node --check server/prompts/slides.js && echo "slides.js: ✓ PASS" || echo "slides.js: ✗ FAIL"
node --check server/prompts/document.js && echo "document.js: ✓ PASS" || echo "document.js: ✗ FAIL"

# 1.2 Source Extraction
echo ""
echo "--- 1.2: Source Extraction ---"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('Returns object with arrays:', c.includes('sources: Array.from(sources)') ? '✓' : '✗'); console.log('Destructuring (2x):', (c.match(/const \{ stats, sources, contextualStats \}/g)||[]).length===2 ? '✓' : '✗'); console.log('EXTRACTED SOURCES:', c.includes('EXTRACTED SOURCES') ? '✓' : '✗'); console.log('EVIDENCE SENTENCES:', c.includes('EVIDENCE SENTENCES') ? '✓' : '✗');"

# 1.3 synthesisNote
echo ""
echo "--- 1.3: synthesisNote Required ---"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/document.js','utf8'); console.log('In required array:', c.includes('\"synthesisNote\"') && c.includes('required:') ? '✓' : '✗'); console.log('SYNTHESIS NOTE REQUIREMENTS:', c.includes('SYNTHESIS NOTE REQUIREMENTS') ? '✓' : '✗'); console.log('Anti-patterns (5+):', (c.match(/❌/g)||[]).length>=5 ? '✓' : '✗');"

# 1.1 Temporal Context
echo ""
echo "--- 1.1: Temporal Context ---"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('Function exists:', c.includes('function getCurrentDateContext()') ? '✓' : '✗'); console.log('dateContext (2x):', (c.match(/const dateContext = getCurrentDateContext/g)||[]).length===2 ? '✓' : '✗'); console.log('TEMPORAL CONTEXT (2x):', (c.match(/TEMPORAL CONTEXT \(for time-aware/g)||[]).length===2 ? '✓' : '✗');"

# 1.4 Threading Anti-Patterns
echo ""
echo "--- 1.4: Threading Anti-Patterns ---"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('CONNECTSTO ANTI-PATTERNS:', c.includes('CONNECTSTO ANTI-PATTERNS') ? '✓' : '✗'); console.log('NARRATIVE THREADING VALIDATION:', c.includes('NARRATIVE THREADING VALIDATION') ? '✓' : '✗'); console.log('Anti-patterns (7+):', (c.match(/❌/g)||[]).length>=7 ? '✓' : '✗');"

# 1.5 Validation Checklist
echo ""
echo "--- 1.5: Validation Checklist ---"
node -e "const fs=require('fs'); const c=fs.readFileSync('./server/prompts/slides.js','utf8'); console.log('OUTLINE FIELD REFERENCE:', c.includes('OUTLINE FIELD REFERENCE') ? '✓' : '✗'); console.log('CHECKPOINT 1-5:', [1,2,3,4,5].every(i=>c.includes('CHECKPOINT '+i+':')) ? '✓' : '✗'); console.log('Box borders:', (c.match(/═{20,}/g)||[]).length>=2 ? '✓' : '✗');"

# Integration test
echo ""
echo "--- INTEGRATION TEST ---"
node -e "
const { generateSlidesPrompt, generateSlidesOutlinePrompt } = require('./server/prompts/slides.js');
try {
  const outlinePrompt = generateSlidesOutlinePrompt('Test', [{filename:'research.md', content:'JPMorgan reduced costs 50% in Q4 2024. Market growing 25% annually. According to McKinsey Report.'}]);
  console.log('Outline prompt generates:', outlinePrompt.length > 1000 ? '✓' : '✗');
  console.log('Has temporal context:', outlinePrompt.includes('TEMPORAL CONTEXT') ? '✓' : '✗');
  console.log('Has extracted sources:', outlinePrompt.includes('EXTRACTED SOURCES') ? '✓' : '✗');

  const contentPrompt = generateSlidesPrompt('Test', [{filename:'research.md', content:'JPMorgan reduced costs 50%'}], [], {reasoning:{primaryFramework:'COMPETITIVE_DYNAMICS'},sections:[{swimlane:'Test',slides:[{tagline:'COST'}]}]});
  console.log('Content prompt generates:', contentPrompt.length > 1000 ? '✓' : '✗');
  console.log('Has checklist:', contentPrompt.includes('OUTLINE FIDELITY CHECKLIST') ? '✓' : '✗');
} catch(e) {
  console.log('ERROR:', e.message);
}
"

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "                         END FINAL VERIFICATION"
echo "═══════════════════════════════════════════════════════════════════════════════"
```

---

# EXECUTION SUMMARY

| Phase | ID | Name | Status | Completed |
|-------|-----|------|--------|-----------|
| 1 | 1.2 | Source Extraction | ⬜ | __________ |
| 1 | 1.3 | synthesisNote Required | ⬜ | __________ |
| 2 | 1.1 | Temporal Context | ⬜ | __________ |
| 2 | 1.4 | Threading Anti-Patterns | ⬜ | __________ |
| 3 | 1.5 | Validation Checklist | ⬜ | __________ |

**Total estimated changes:**
- `slides.js`: ~160 lines added
- `document.js`: ~30 lines added

**Execution time estimate:** 30-60 minutes for all 5 recommendations

---

**Ready to begin execution. Start with 1.2 and 1.3 in parallel (Phase 1).**
