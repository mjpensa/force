# Executive Summary Generator - Program Requirements Specification

## System Purpose
Transform raw research documents into compelling 1,500-word executive summaries using the "Great Bifurcation" narrative style - a methodology that combines McKinsey-level analysis with Hollywood storytelling techniques.

## Core Algorithm Flow

### Phase 1: Document Analysis & Data Extraction
**Input:** Raw research documents
**Process:**
1. Extract all statistics, metrics, and quantitative data
2. Identify company names, project names, and initiatives
3. Extract citations and sources
4. Identify stakeholder groups mentioned
5. Detect timeframes and deadlines
6. Map geographic regions and markets

**Required Extractions:**
- Minimum 20 specific statistics (never round to nearest million/billion)
- Minimum 10 company/organization names
- Minimum 5 project/initiative names
- All available citations with [source.com] format
- Date ranges and specific deadlines

### Phase 2: Narrative Structure Generation

#### 2.1 Title Generation
**Formula:** `"The [Dramatic Metaphor]: [Primary Stakeholder] at the [Inflection Point] of [Industry/Topic] ([Start Year]-[End Year])"`

**Metaphor Categories (select one and maintain throughout):**
- Infrastructure: bridges, rails, highways, corridors, roads
- Military: fortress, battles, insurgency, campaigns, fronts
- Geological: tectonic, fault lines, erosion, shifts
- Biological: evolution, mutation, ecosystem, adaptation

#### 2.2 Content Structure (Total: ~1,500 words)

**Executive Summary** (150-200 words)
- Opening: Paradox statement using formula: "While [conventional expectation], the reality is [surprising contradiction]"
- Metric: Include convergence/divergence score or similar quantitative anchor
- Preview: Transformation journey from current state → future state
- Stakes: Consequences of inaction

**Part I: The [Problem Metaphor]** (200-250 words)
- Label: Create memorable problem name (e.g., "The Broken Bridge")
- Transition: "To understand where we're going, we must understand..."
- Data: Include 3 most shocking statistics
- Climax: End with inflection point moment

**Part II: The [Forces of Change]** (300-350 words)
- Structure: Identify 3-4 major forces
- Naming: Each force gets branded name using pattern "The [Region/Group] [Action]"
- Format per force:
  - Lead with most shocking statistic
  - Explain mechanism of change
  - Connect to stakeholder impact

**Part III: The Technology/Operational Revolution** (300-350 words)
- Frame: "The [X] Stack Revolution" or "The [X] Imperative"
- Structure: 3 numbered initiatives with bold headers
- Per initiative:
  - Specific company examples (leaders vs laggards)
  - Investment figures or quantified impact
  - Actual project/platform names

**Part IV: Strategic Implications** (250-300 words)
- Format: Segment by stakeholder group
- Structure per group:
  - "For [Stakeholder Group]:"
  - Win/lose/survive positioning
  - Quantified market share shifts
  - Strategic response recommendation

**Part V: Strategic Imperatives** (200-250 words)
- Title: "Strategic Imperatives for [End Year]" or "The [Number] Critical Decisions"
- Structure: 5 numbered, bolded imperatives
- Language: Active, decisive verbs
- Include: Specific metrics, thresholds, or deadlines

**Conclusion: From [Current State] to [Future State]** (150-200 words)
- Callback: Reference opening metaphor
- Expansion: Show evolution (e.g., "not just bifurcation but multi-dimensional fragmentation")
- Multiplication: Extend original concept
- Final punch: Memorable closing sentence with existential stakes

### Phase 3: Language Processing & Enhancement

#### 3.1 Vocabulary Distribution Rules
- 60% Strategic business terminology (transformation, convergence, orchestrate, pivot)
- 20% Technical precision (specific technologies, standards, protocols)
- 15% Dramatic/theatrical (exodus, fortress, insurgency, liberation)
- 5% Unexpected/memorable (shadow rails, digital ferries, zombie systems)

#### 3.2 Data Integration Rules
- **Specific Numbers:** Always use exact figures (260 million, not "hundreds of millions")
- **Comparative Context:** Large numbers must include comparison: "[Number], equivalent to [relatable comparison]"
- **Growth Metrics:** Show rate of change: "[X]% growth in [timeframe], compared to [benchmark]"
- **Citation Placement:** Insert [source.com] immediately after claim, inline with text

#### 3.3 Sentence Construction Patterns
- Alternate between short punchy declarations and complex analyses
- Use colons and em-dashes for dramatic reveals
- Deploy parallel structure in lists
- Create 5+ quotable sentences per document

### Phase 4: Concept Branding & Memorability

#### 4.1 Branded Concept Creation
Generate 5-7 memorable branded concepts:
- Pattern 1: "The [Adjective] [Noun]" (The Broken Bridge, The Great Bifurcation)
- Pattern 2: "Shadow [Noun]" (Shadow Rails, Shadow Convergence)
- Pattern 3: "Operation/Project [Powerful Word]" (Project Hercules, Operation Liberation)

#### 4.2 Strategic Framing Devices
- **Paradoxes:** Create tension with "The [X] Paradox: [contradictory requirements]"
- **Spectrums:** Position on continuums (Winners/Losers/Survivors)
- **Scores:** Use convergence scores or maturity indices (58/100)

### Phase 5: Stakeholder Segmentation

**Required Stakeholder Categories:**
1. Primary affected group (e.g., US Banks)
2. Competitors/Alternatives (e.g., Fintechs)
3. End users (e.g., Consumers, Corporations)
4. Regulators/Government
5. Technology providers/Partners

**For each stakeholder, generate:**
- Current position/challenge
- Future state projection with quantified impact
- Strategic response/recommendation
- Win/lose/survive classification

### Phase 6: Quality Validation Checks

**Required Elements Checklist:**
- [ ] Opening paradox creates immediate tension
- [ ] Each section has memorable branded title
- [ ] Contains 20+ specific statistics
- [ ] Includes 15+ inline citations
- [ ] Names 10+ companies/initiatives
- [ ] Consistent metaphor system throughout
- [ ] 5 stakeholder groups addressed
- [ ] 5+ strategic imperatives listed
- [ ] Callback to opening in conclusion
- [ ] Word count: 1,400-1,600 words

### Phase 7: Output Formatting

**Markdown Structure:**
```markdown
# [Generated Title]

## Executive Summary
[Generated paradox opening...]

## Part I: The [Problem Name]
[Content...]

## Part II: The [Forces Title]
### [Force 1 Name]
[Content...]
### [Force 2 Name]
[Content...]

## Part III: The [Technology Title]
### 1. [Initiative Name]
[Content...]
### 2. [Initiative Name]
[Content...]

## Part IV: Strategic Implications
### For [Stakeholder 1]:
[Content...]
### For [Stakeholder 2]:
[Content...]

## Part V: Strategic Imperatives for [Year]
1. **[Imperative Name]:** [Description]
2. **[Imperative Name]:** [Description]

## Conclusion: From [Current] to [Future]
[Callback and expansion...]
```

## Implementation Rules

### Priority Rules (Must Never Violate)
1. Never use generic round numbers when specific data exists
2. Always maintain single metaphor system throughout document
3. Every major claim must have supporting statistic
4. Opening must contain paradox/contradiction
5. Conclusion must callback to opening metaphor

### Style Rules
1. Active voice > Passive voice
2. Specific examples > Abstract concepts
3. Named initiatives > Generic programs
4. Quantified impacts > Qualitative descriptions
5. Branded concepts > Common phrases

### Extraction Priorities
When processing raw research:
1. First priority: Shocking statistics and rate-of-change metrics
2. Second priority: Company names and specific initiatives
3. Third priority: Dates, deadlines, and timeframes
4. Fourth priority: Investment amounts and market sizes
5. Fifth priority: Geographic patterns and regional differences

### Conflict Resolution
When research documents contain conflicting data:
1. Use most recent source
2. Acknowledge conflict if material ("Sources disagree...")
3. Prefer specific over general
4. Prefer quantified over estimated

## Error Handling

If insufficient data for any section:
- Minimum viable: 10 statistics, 5 companies, 3 initiatives
- Flag sections that need enrichment
- Generate placeholder branded concepts
- Note where additional research needed

## Success Metrics

The generated summary should pass these tests:
1. **CEO Test:** Would clear calendar to read
2. **Board Test:** Would fund based on this
3. **Competitor Test:** Would worry after reading
4. **Journalist Test:** Contains 5+ quotable lines
5. **Memory Test:** Reader remembers 3+ branded concepts

## Example Patterns for Reference

**Paradox Openings:**
- "While technology enables [positive], regulation ensures [negative]"
- "As [Group A] accelerates, [Group B] retreats"
- "The same force that enables [X] prevents [Y]"

**Force Naming:**
- "The [Geographic] [Action]" (The European Mandate)
- "The [Technology] [Impact]" (The AI Disruption)
- "The [Industry] [Movement]" (The Fintech Insurgency)

**Memorable Closings:**
- "The transformation isn't optional—it's existential"
- "The bridge is broken, but the digital ferries are faster than the bridge ever was"
- "The future belongs not to the [old attribute], but to the [new attribute]"

---

## Program Flow Summary

```
1. INGEST documents → Extract data points
2. ANALYZE patterns → Identify paradox and forces
3. SELECT metaphor system → Maintain throughout
4. STRUCTURE narrative → Follow 5-part template
5. BRAND concepts → Create memorable phrases
6. INTEGRATE data → Weave statistics naturally
7. SEGMENT stakeholders → Address each group
8. VALIDATE output → Check requirements
9. FORMAT document → Apply markdown structure
10. RETURN executive summary
```

This specification enables systematic generation of compelling executive summaries that transform dry research into strategic narratives that executives will read, remember, and act upon.
