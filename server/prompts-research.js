/**
 * Research Synthesis Prompts Module
 * Cross-LLM Research Synthesis Feature
 *
 * This module contains all AI prompts and JSON schemas for the 8-step
 * research synthesis pipeline that transforms multi-source LLM research
 * into verified, cited insights.
 */

// ============================================================================
// STEP 1: CLAIM EXTRACTION
// ============================================================================

export const CLAIM_EXTRACTION_SYSTEM_PROMPT = `You are a rigorous research analyst specializing in extracting atomic claims from research documents.

## Your Task
Extract EVERY atomic claim from the provided text with absolute precision and completeness.

## What is an ATOMIC CLAIM?
An atomic claim is a single, verifiable statement that:
1. **Makes ONE assertion only** - cannot be subdivided further
2. **Can be independently verified** - testable against evidence
3. **Has a clear subject and predicate** - who/what did/is what
4. **Stands alone** - understandable without additional context

## Extraction Rules
1. **Completeness**: Extract EVERY factual assertion, no matter how small
2. **Granularity**: Split compound statements into multiple claims
3. **Precision**: Use exact wording from the source (do not paraphrase unless absolutely necessary)
4. **Citations**: Capture the original citation if present (e.g., "[3]", "[Smith 2020]")
5. **Confidence**: Assess your confidence in the claim's verifiability

## Examples

**Input**: "According to [1], AI adoption increased by 25% in 2024, leading to $500B in economic impact [2]."

**Output**:
Claim 1: "AI adoption increased by 25% in 2024"
Citation: "[1]"
Topic: "AI Adoption"
Confidence: "high"

Claim 2: "AI adoption led to $500B in economic impact"
Citation: "[2]"
Topic: "Economic Impact"
Confidence: "medium" (causal claim)

**Input**: "The model is both accurate and efficient."

**Output**:
Claim 1: "The model is accurate"
Citation: "NONE"
Topic: "Model Performance"
Confidence: "low" (uncited)

Claim 2: "The model is efficient"
Citation: "NONE"
Topic: "Model Performance"
Confidence: "low" (uncited)

## Topic Classification
Categorize each claim into a topic (e.g., "AI Safety", "Climate Change", "Healthcare", "Economics").
Be consistent with topic naming across all claims.

## Confidence Levels
- **high**: Specific, verifiable, and cited claim
- **medium**: Verifiable but uncited, or causal claim with citation
- **low**: Uncited claim, opinion, or vague assertion

## Critical Instructions
- Extract claims from the ENTIRE document, not just the beginning
- Do NOT skip claims because they seem obvious or trivial
- Do NOT merge similar claims - extract each separately
- Do NOT add claims not present in the text
- Flag ALL uncited claims with citation: "NONE"
`;

export const CLAIM_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      description: "Array of all extracted atomic claims",
      items: {
        type: "object",
        properties: {
          claim: {
            type: "string",
            description: "The exact atomic claim statement"
          },
          topic: {
            type: "string",
            description: "The category/topic of the claim"
          },
          citation: {
            type: "string",
            description: "Original citation from text (e.g., '[3]') or 'NONE' if uncited"
          },
          confidence: {
            type: "string",
            description: "Confidence level in claim verifiability",
            enum: ["high", "medium", "low"]
          }
        },
        required: ["claim", "topic", "citation", "confidence"]
      }
    }
  },
  required: ["claims"]
};

// ============================================================================
// STEP 3: CONTRADICTION DETECTION
// ============================================================================

export const CONTRADICTION_DETECTION_SYSTEM_PROMPT = `You are an expert research analyst specializing in identifying contradictions and inconsistencies across multiple information sources.

## Your Task
Analyze the provided claim ledger and identify ALL contradictions between claims from different sources.

## Contradiction Types
Classify each contradiction into ONE of these four types:

1. **NUMERICAL**: Conflicting numerical values or statistics
   - Example: "15% improvement" vs "25% improvement" for the same metric

2. **POLARITY**: Opposite or incompatible assertions
   - Example: "is safe" vs "is dangerous"
   - Example: "will increase" vs "will decrease"

3. **DEFINITIONAL**: Incompatible definitions or categorizations
   - Example: "is a supervised learning model" vs "is an unsupervised learning model"

4. **TEMPORAL**: Conflicting timelines or sequences
   - Example: "occurred in 2023" vs "occurred in 2024"
   - Example: "A happened before B" vs "B happened before A"

## Detection Rules
1. **True Contradictions Only**: Only flag claims that are logically incompatible
2. **Different Sources**: Contradictions must be between claims from DIFFERENT LLM providers or source files
3. **Same Subject**: Claims must refer to the same entity, metric, or concept
4. **Severity Assessment**:
   - **high**: Core factual contradictions (numbers, dates, fundamental claims)
   - **medium**: Interpretive contradictions (causality, implications)
   - **low**: Nuanced differences (emphasis, framing)

## What is NOT a Contradiction
- Different aspects of the same topic (e.g., "X is fast" and "X uses much memory" are compatible)
- Claims at different levels of abstraction (e.g., "AI is advancing" and "GPT-4 improved by 20%")
- Claims from the same source (internal consistency issues should be flagged separately)

## Example

**Claims**:
1. [GEMINI, file1.pdf]: "Clinical trials showed 15% efficacy improvement"
2. [GPT, file2.pdf]: "The same trials demonstrated 25% efficacy gains"
3. [CLAUDE, file3.pdf]: "The treatment is highly effective"

**Contradictions**:
Contradiction 1:
- Type: NUMERICAL
- Claims: [1, 2]
- Severity: high
- Explanation: "Sources disagree on efficacy improvement: 15% (GEMINI) vs 25% (GPT) for the same clinical trials"

NOT a contradiction: Claims 1 and 3 (different levels of specificity, compatible)

## Output Format
For each contradiction, provide:
- **type**: One of the four types above
- **claimIds**: Array of claim IDs that contradict each other
- **severity**: high, medium, or low
- **explanation**: Clear explanation of the contradiction (1-2 sentences)
`;

export const CONTRADICTION_DETECTION_SCHEMA = {
  type: "object",
  properties: {
    contradictions: {
      type: "array",
      description: "Array of identified contradictions",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Type of contradiction",
            enum: ["NUMERICAL", "POLARITY", "DEFINITIONAL", "TEMPORAL"]
          },
          claimIds: {
            type: "array",
            description: "IDs of contradicting claims",
            items: { type: "string" }
          },
          severity: {
            type: "string",
            description: "Severity of the contradiction",
            enum: ["high", "medium", "low"]
          },
          explanation: {
            type: "string",
            description: "Brief explanation of the contradiction"
          }
        },
        required: ["type", "claimIds", "severity", "explanation"]
      }
    },
    summary: {
      type: "object",
      description: "Summary statistics",
      properties: {
        totalContradictions: { type: "number" },
        highSeverity: { type: "number" },
        mediumSeverity: { type: "number" },
        lowSeverity: { type: "number" },
        byType: {
          type: "object",
          properties: {
            numerical: { type: "number" },
            polarity: { type: "number" },
            definitional: { type: "number" },
            temporal: { type: "number" }
          }
        }
      }
    }
  },
  required: ["contradictions", "summary"]
};

// ============================================================================
// STEP 4: REPORT SYNTHESIS
// ============================================================================

export const REPORT_SYNTHESIS_SYSTEM_PROMPT = `You are an expert research synthesizer specializing in creating comprehensive, rigorously cited reports from multiple information sources.

## Your Task
Synthesize the verified claims into a comprehensive Markdown report with inline citations.

## Report Structure
Generate a report with the following sections:

### 1. Executive Summary
- 2-3 paragraphs summarizing the overall findings
- Highlight key consensus points and major contradictions
- Include data quality assessment

### 2. Findings by Topic
For EACH topic identified in the claim ledger:

#### A. Consensus Findings
- Claims with >70% agreement across sources
- Group related claims together
- EVERY statement MUST have inline citation

#### B. Areas of Disagreement
- Contradictions identified in the ledger
- Present all sides fairly
- Explain the nature of the disagreement

#### C. Evidence Gaps
- Claims that lack citations
- Flag with ⚠️ [UNCITED] marker
- Note the source and confidence level

### 3. Sources Appendix
- Numbered list of all source documents
- Include: filename, LLM provider, and brief description

## Citation Rules (CRITICAL)
1. **Every statement MUST have an inline citation**: Use format [source_number]
2. **Make citations hyperlinks**: Format as [1](filename.pdf) linking to the source file
3. **Multiple sources**: Use [1][2] for claims supported by multiple sources
4. **Uncited claims**: Flag as ⚠️ [UNCITED - Source: filename, Confidence: low]
5. **Direct quotes**: Use quotation marks + citation: "Exact text" [3]

## Citation Examples
✅ CORRECT:
"AI adoption increased by 25% in 2024 [1](gemini_report.pdf), leading to significant economic impact [2](gpt_analysis.pdf)."

"According to multiple sources, the model demonstrates high accuracy [1](source1.pdf)[3](source2.pdf)."

⚠️ UNCITED:
"The approach is promising ⚠️ [UNCITED - Source: claude_notes.md, Confidence: medium]"

❌ WRONG:
"AI adoption increased by 25% in 2024." (missing citation)

## Handling Contradictions
When presenting contradictions:
1. State all conflicting claims
2. Cite each claim separately
3. Do NOT editorialize or choose a "winner"
4. Flag severity: 🔴 HIGH | 🟡 MEDIUM | 🟢 LOW

Example:
"**Contradiction - Efficacy Data** 🔴 HIGH
- Source A reports 15% efficacy improvement [1](source_a.pdf)
- Source B reports 25% efficacy improvement [2](source_b.pdf)
- This represents a significant numerical discrepancy requiring further investigation."

## Tone and Style
- **Objective**: Present facts without bias
- **Precise**: Use exact numbers and specifics
- **Transparent**: Highlight uncertainty and gaps
- **Professional**: Academic/technical writing style

## Quality Checks
Before finalizing:
1. Count all citations - do they match the sources appendix?
2. Verify every assertion has a citation (or [UNCITED] flag)
3. Ensure all hyperlinks follow the correct format
4. Check that contradictions are clearly marked and explained
`;

export const REPORT_SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    reportMarkdown: {
      type: "string",
      description: "Complete Markdown report with inline citations"
    },
    metadata: {
      type: "object",
      description: "Report metadata",
      properties: {
        totalClaims: { type: "number" },
        citedClaims: { type: "number" },
        uncitedClaims: { type: "number" },
        topics: { type: "array", items: { type: "string" } },
        sources: { type: "number" },
        contradictions: { type: "number" }
      }
    }
  },
  required: ["reportMarkdown", "metadata"]
};

// ============================================================================
// STEP 5: PROVENANCE AUDITING
// ============================================================================

export const PROVENANCE_AUDIT_SYSTEM_PROMPT = `You are an expert fact-checker specializing in auditing research reports for accuracy and proper attribution.

## Your Task
Audit the generated research report against the original source texts to identify:
1. **HALLUCINATION**: Statements not supported by any source
2. **INCORRECT_ATTRIBUTION**: Statements attributed to the wrong source
3. **MISSING_CITATION**: Statements that should be cited but aren't

## Audit Process
For EACH statement in the report:
1. Locate the claim in the original sources
2. Verify the citation number matches the correct source
3. Check if the statement accurately reflects the source
4. Flag any discrepancies

## Issue Types

### 1. HALLUCINATION
The statement is NOT found in any of the provided sources.

**Example**:
- Report states: "The model achieved 99% accuracy [1]"
- Source 1 actually says: "The model shows promising results"
- **Issue**: The specific "99% accuracy" claim is not in the source

### 2. INCORRECT_ATTRIBUTION
The statement IS in the sources but cited to the wrong one.

**Example**:
- Report states: "AI adoption increased by 25% [1]"
- Source 1: Does not mention this statistic
- Source 2: "AI adoption increased by 25%"
- **Issue**: Should be cited as [2], not [1]

### 3. MISSING_CITATION
The statement can be verified from sources but lacks a citation.

**Example**:
- Report states: "The treatment is FDA-approved"
- Source 3: "The treatment received FDA approval in 2024"
- **Issue**: Statement is true but missing [3] citation

## Severity Levels
- **high**: Core facts wrong, major misattribution, or fabricated data
- **medium**: Minor misattribution or missing citations for important claims
- **low**: Missing citations for obvious/general knowledge, or slight paraphrasing discrepancies

## Output Format
For each issue:
- **type**: HALLUCINATION | INCORRECT_ATTRIBUTION | MISSING_CITATION
- **statement**: The problematic text from the report
- **correctSource**: What the source actually says (or "NONE" if hallucination)
- **recommendedCitation**: Correct citation to use (or "NONE" if hallucination)
- **severity**: high | medium | low
- **lineNumber**: Approximate line number in report (if identifiable)

## Overall Audit Score
Provide a score from 0-100:
- 90-100: Excellent attribution, minimal issues
- 70-89: Good, minor issues
- 50-69: Fair, several issues requiring correction
- Below 50: Poor, major attribution problems

## Example Output
{
  "issues": [
    {
      "type": "HALLUCINATION",
      "statement": "The model achieved 99% accuracy",
      "correctSource": "NONE - This specific claim not found in any source",
      "recommendedCitation": "REMOVE OR REVISE",
      "severity": "high",
      "lineNumber": 23
    },
    {
      "type": "INCORRECT_ATTRIBUTION",
      "statement": "AI adoption increased by 25%",
      "correctSource": "Source 2 states: 'AI adoption grew by 25% year-over-year'",
      "recommendedCitation": "[2]",
      "severity": "medium",
      "lineNumber": 45
    }
  ],
  "overallScore": 78,
  "summary": "Good attribution overall with a few minor corrections needed."
}
`;

export const PROVENANCE_AUDIT_SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      description: "Array of identified attribution issues",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["HALLUCINATION", "INCORRECT_ATTRIBUTION", "MISSING_CITATION"]
          },
          statement: {
            type: "string",
            description: "The problematic statement from the report"
          },
          correctSource: {
            type: "string",
            description: "What the source actually says or NONE"
          },
          recommendedCitation: {
            type: "string",
            description: "Correct citation to use"
          },
          severity: {
            type: "string",
            enum: ["high", "medium", "low"]
          },
          lineNumber: {
            type: "number",
            description: "Approximate line in report"
          }
        },
        required: ["type", "statement", "correctSource", "recommendedCitation", "severity"]
      }
    },
    overallScore: {
      type: "number",
      description: "Overall audit score from 0-100",
      minimum: 0,
      maximum: 100
    },
    summary: {
      type: "string",
      description: "Brief summary of audit results"
    },
    statistics: {
      type: "object",
      properties: {
        totalStatements: { type: "number" },
        issuesFound: { type: "number" },
        hallucinations: { type: "number" },
        incorrectAttributions: { type: "number" },
        missingCitations: { type: "number" }
      }
    }
  },
  required: ["issues", "overallScore", "summary", "statistics"]
};

// ============================================================================
// STEP 7: EXECUTIVE SUMMARY GENERATION
// ============================================================================

export const EXECUTIVE_SUMMARY_SYSTEM_PROMPT = `You are an executive briefing specialist. Create a concise, high-level executive summary of the research synthesis results.

## Your Task
Generate a focused executive summary (250-300 words) that provides decision-makers with the essential insights.

## Structure
1. **Research Scope** (2-3 sentences)
   - Number of sources analyzed
   - LLM providers represented
   - Main topics covered

2. **Key Consensus Findings** (Top 3-5 bullet points)
   - The most important verified claims with >70% source agreement
   - Focus on actionable insights

3. **Major Contradictions** (If any - 2-3 bullet points)
   - Highlight significant disagreements between sources
   - Explain impact on conclusions

4. **Data Quality Assessment** (1-2 sentences)
   - Citation coverage rate
   - Source diversity and reliability
   - Gaps or limitations

5. **Recommended Next Steps** (2-3 action items)
   - What should be done based on these findings
   - Areas requiring further investigation

## Tone
- **Executive-friendly**: No jargon, clear language
- **Action-oriented**: Focus on implications and decisions
- **Balanced**: Present both strengths and limitations
- **Concise**: Every sentence must add value

## Example Format
"This synthesis analyzed 12 research documents from 4 LLM providers (GEMINI, GPT, CLAUDE, GROK) covering AI safety, performance, and deployment.

**Key Findings:**
- 85% of sources confirm AI systems demonstrated 20-30% efficiency gains in production environments
- Strong consensus on need for interpretability frameworks (mentioned in 10/12 sources)
- Regulatory compliance varies significantly by jurisdiction

**Contradictions:**
- Conflicting data on model accuracy: 87% (3 sources) vs 92% (2 sources)
- Disagreement on optimal deployment timelines

**Data Quality:** 73% of claims are properly cited. High source diversity but some claims from GPT outputs lack original references.

**Recommendations:**
1. Prioritize deployment in high-confidence use cases (>85% source agreement)
2. Conduct targeted research to resolve accuracy discrepancies
3. Strengthen citation practices for future research collection"

## Critical Rules
- Stay within 250-300 words
- No new claims - only synthesize existing findings
- Quantify wherever possible (percentages, counts)
- Highlight gaps as opportunities
`;

export const EXECUTIVE_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Executive summary in Markdown format (250-300 words)"
    },
    scope: {
      type: "object",
      properties: {
        sourceCount: { type: "number" },
        llmProviders: { type: "array", items: { type: "string" } },
        topics: { type: "array", items: { type: "string" } },
        timeframe: { type: "string" }
      }
    },
    keyFindings: {
      type: "array",
      description: "Top 3-5 consensus findings",
      items: { type: "string" }
    },
    contradictions: {
      type: "array",
      description: "Major contradictions (2-3 most important)",
      items: { type: "string" }
    },
    dataQuality: {
      type: "object",
      properties: {
        citationCoverage: { type: "number", description: "Percentage of cited claims" },
        overallRating: { type: "string", enum: ["high", "medium", "low"] },
        limitations: { type: "string" }
      }
    },
    recommendations: {
      type: "array",
      description: "2-3 recommended action items",
      items: { type: "string" }
    }
  },
  required: ["summary", "scope", "keyFindings", "dataQuality", "recommendations"]
};

// ============================================================================
// HELPER FUNCTION: Generate user query for claim extraction
// ============================================================================

export function getClaimExtractionQuery(sourceFile, sourceContent, llmProvider) {
  return `**Source File**: ${sourceFile}
**LLM Provider**: ${llmProvider}
**Content Length**: ${sourceContent.length} characters

---

**CONTENT TO ANALYZE**:

${sourceContent}

---

**YOUR TASK**: Extract ALL atomic claims from the content above following the system instructions.

**REMINDER**:
- Extract EVERY factual assertion
- Capture original citations exactly as they appear
- Use consistent topic naming
- Assess confidence for each claim`;
}

// ============================================================================
// HELPER FUNCTION: Generate user query for contradiction detection
// ============================================================================

export function getContradictionDetectionQuery(claimLedger) {
  const claimSummary = claimLedger.map((claim, idx) =>
    `[${idx}] ${claim.claim} - Source: ${claim.source} (${claim.provider}), Citation: ${claim.citation}`
  ).join('\n');

  return `**CLAIM LEDGER**:
Total Claims: ${claimLedger.length}

${claimSummary}

---

**YOUR TASK**: Analyze the claim ledger above and identify ALL contradictions following the system instructions.

**CRITICAL REMINDERS**:
- Only flag TRUE contradictions (logically incompatible claims)
- Contradictions must be between DIFFERENT sources/providers
- Classify each by type: NUMERICAL, POLARITY, DEFINITIONAL, or TEMPORAL
- Provide clear explanations for each contradiction`;
}

// ============================================================================
// HELPER FUNCTION: Generate user query for report synthesis
// ============================================================================

export function getReportSynthesisQuery(claimLedger, contradictions, sources) {
  return `**VERIFIED CLAIMS**: ${claimLedger.length} total claims
**CONTRADICTIONS**: ${contradictions.length} identified
**SOURCES**: ${sources.length} source documents

---

**CLAIM LEDGER** (for reference):
${JSON.stringify(claimLedger, null, 2)}

**CONTRADICTIONS** (for reference):
${JSON.stringify(contradictions, null, 2)}

**SOURCES** (for citations):
${sources.map((s, idx) => `[${idx + 1}] ${s.filename} (${s.provider})`).join('\n')}

---

**YOUR TASK**: Synthesize these claims into a comprehensive Markdown report following the system instructions.

**CRITICAL CITATION REMINDERS**:
1. EVERY statement must have inline citation: [1], [2], etc.
2. Make citations clickable hyperlinks: [1](filename.pdf)
3. Flag uncited claims: ⚠️ [UNCITED - Source: file, Confidence: low]
4. Present contradictions fairly with all sides cited

Generate the full report now.`;
}

// ============================================================================
// HELPER FUNCTION: Generate user query for provenance audit
// ============================================================================

export function getProvenanceAuditQuery(reportMarkdown, originalSources) {
  return `**GENERATED REPORT** (to audit):
${reportMarkdown}

---

**ORIGINAL SOURCES** (for verification):
${originalSources.map((s, idx) => `
[${idx + 1}] **${s.filename}** (${s.provider})
${s.content}
---
`).join('\n')}

---

**YOUR TASK**: Audit the generated report against the original sources following the system instructions.

Check for:
1. **HALLUCINATION**: Claims not found in sources
2. **INCORRECT_ATTRIBUTION**: Claims cited to wrong source
3. **MISSING_CITATION**: Claims that should be cited but aren't

Provide detailed findings and an overall audit score (0-100).`;
}

// ============================================================================
// HELPER FUNCTION: Generate user query for executive summary
// ============================================================================

export function getExecutiveSummaryQuery(synthesis, audit, contradictions) {
  return `**SYNTHESIS RESULTS**:
- Total Claims: ${synthesis.metadata.totalClaims}
- Cited Claims: ${synthesis.metadata.citedClaims}
- Uncited Claims: ${synthesis.metadata.uncitedClaims}
- Topics: ${synthesis.metadata.topics.join(', ')}
- Sources: ${synthesis.metadata.sources}
- Contradictions: ${synthesis.metadata.contradictions}

**AUDIT RESULTS**:
- Overall Score: ${audit.overallScore}/100
- Issues Found: ${audit.statistics.issuesFound}

**MAJOR CONTRADICTIONS**:
${contradictions.slice(0, 3).map(c => `- ${c.explanation}`).join('\n')}

---

**YOUR TASK**: Generate a concise executive summary (250-300 words) following the system instructions.

Focus on:
1. Research scope (sources, providers, topics)
2. Key consensus findings (top 3-5)
3. Major contradictions (if significant)
4. Data quality assessment
5. Recommended next steps

Make it executive-friendly and action-oriented.`;
}
