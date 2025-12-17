# Implementation Plan: Low-Effort Sales Enablement Features

> Comprehensive technical plan for implementing 5 low-effort, high-impact features to transform Force into a consulting sales meeting enablement platform.

**Target Timeline**: 1-2 weeks
**Architecture Compatibility**: Express backend, Gemini 2.5 Flash, Vanilla JS frontend, existing session-based content flow

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Feature 1: Objection Anticipator](#feature-1-objection-anticipator)
3. [Feature 2: Executive Summary Generator](#feature-2-executive-summary-generator)
4. [Feature 3: Talking Points Export](#feature-3-talking-points-export)
5. [Feature 4: Meeting Duration Optimizer](#feature-4-meeting-duration-optimizer)
6. [Feature 5: Competitive Positioning](#feature-5-competitive-positioning)
7. [Shared Infrastructure](#shared-infrastructure)
8. [Implementation Order](#implementation-order)
9. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

### Current System Flow
```
User uploads files + prompt
        ↓
POST /api/content/generate
        ↓
generateAllContent() orchestrates parallel generation:
  Phase 0: Research Analysis (background)
  Phase 1: Roadmap + Slides Outline (parallel)
  Phase 2: Slides Pass 2 + Document (parallel, uses swimlanes)
        ↓
Session stores all content types
        ↓
Frontend polls via SSE, StateManager updates, Views render
```

### Key Integration Points

| Component | Location | Purpose |
|-----------|----------|---------|
| Prompts | `/server/prompts/*.js` | System prompts + schemas |
| Generators | `/server/generators.js` | Orchestration + Gemini calls |
| Routes | `/server/routes/content.js` | API endpoints |
| State | `/Public/components/shared/StateManager.js` | Frontend state |
| Views | `/Public/components/views/*.js` | UI rendering |
| Exports | `/server/templates/*-export-service.js` | File generation |

### New Content Types to Add
```javascript
content: {
  roadmap,
  slides,
  document,
  'research-analysis',
  // NEW:
  'objections',           // Feature 1
  'executive-summary',    // Feature 2
  'talking-points',       // Feature 3
  'meeting-metrics'       // Feature 4
}

// Feature 5 modifies existing generation, not a new content type
```

---

## Feature 1: Objection Anticipator

### Overview
Generate likely client objections with suggested responses, organized by category, based on proposal content.

### Data Schema

```javascript
// /server/prompts/objections.js

export const objectionsSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "One-sentence summary of the proposal's risk profile"
    },
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: ["Budget & ROI", "Timeline & Feasibility", "Methodology & Approach",
                   "Risk & Mitigation", "Alternatives & Competition", "Team & Resources"]
          },
          riskLevel: {
            type: "string",
            enum: ["low", "medium", "high"]
          },
          objections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                objection: {
                  type: "string",
                  description: "The client objection phrased as they would say it"
                },
                likelihood: {
                  type: "string",
                  enum: ["very_likely", "likely", "possible"]
                },
                stakeholder: {
                  type: "string",
                  description: "Who is most likely to raise this (CFO, CTO, CEO, etc.)"
                },
                response: {
                  type: "string",
                  description: "Recommended consultant response (2-3 sentences)"
                },
                evidence: {
                  type: "string",
                  description: "Supporting data point or proof to cite"
                }
              },
              required: ["objection", "likelihood", "stakeholder", "response"]
            }
          }
        },
        required: ["name", "riskLevel", "objections"]
      }
    },
    prepTips: {
      type: "array",
      items: { type: "string" },
      description: "3-5 preparation tips for the meeting"
    }
  },
  required: ["summary", "categories", "prepTips"]
};
```

### System Prompt

```javascript
// /server/prompts/objections.js

export const OBJECTIONS_SYSTEM_PROMPT = `You are a seasoned management consultant with 20 years of experience preparing partners for client sales meetings. Your specialty is anticipating client pushback and preparing airtight responses.

## Your Task
Analyze the proposal content and generate likely client objections organized by category. For each objection:
1. Phrase it exactly as a skeptical client would say it
2. Identify which stakeholder role typically raises this concern
3. Provide a confident, evidence-backed response
4. Include a specific proof point when available

## Objection Categories
- **Budget & ROI**: Cost concerns, unclear value, competing priorities
- **Timeline & Feasibility**: Too fast, too slow, resource constraints
- **Methodology & Approach**: Why this approach? Proven track record?
- **Risk & Mitigation**: What could go wrong? Contingency plans?
- **Alternatives & Competition**: Why not do this internally? Why not [competitor]?
- **Team & Resources**: Who will actually do the work? Commitment levels?

## Risk Level Guidelines
- **High**: Multiple stakeholders likely to raise; could derail the deal
- **Medium**: Will come up; need good response but manageable
- **Low**: Might come up; good to be prepared

## Response Style
- Lead with acknowledgment ("That's a fair concern...")
- Pivot to value or evidence
- End with forward momentum
- Keep responses to 2-3 sentences max

## Quality Standards
- Generate 8-12 total objections across categories
- At least 2 "very_likely" objections
- Include at least one objection per major proposal section
- Prep tips should be actionable and specific`;

export function generateObjectionsPrompt(roadmapData, documentData, researchContent) {
  const swimlanes = roadmapData?.timeColumns?.[0]?.swimlanes || [];
  const phases = swimlanes.map(s => s.name).join(', ');

  return `${OBJECTIONS_SYSTEM_PROMPT}

## Proposal Context

**Phases/Workstreams**: ${phases}

**Executive Summary**:
${documentData?.executiveSummary?.content || 'Not available'}

**Key Sections**:
${documentData?.sections?.map(s => `- ${s.title}`).join('\n') || 'Not available'}

**Source Research**:
${researchContent?.substring(0, 8000) || 'Not available'}

Generate the objection analysis now.`;
}
```

### Backend Implementation

```javascript
// Add to /server/generators.js

import { generateObjectionsPrompt, objectionsSchema } from './prompts/objections.js';

const OBJECTIONS_CONFIG = {
  temperature: 0.4,  // Some creativity for realistic objections
  thinkingBudget: 4096
};

async function generateObjections(roadmapData, documentData, researchContent) {
  const prompt = generateObjectionsPrompt(roadmapData, documentData, researchContent);

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: OBJECTIONS_CONFIG.temperature,
      maxOutputTokens: CONFIG.gemini.maxTokens.analysis,
      responseMimeType: 'application/json',
      responseSchema: objectionsSchema
    }
  };

  if (OBJECTIONS_CONFIG.thinkingBudget > 0) {
    payload.generationConfig.thinking = {
      type: 'enabled',
      budget_tokens: OBJECTIONS_CONFIG.thinkingBudget
    };
  }

  return await callGeminiForJson(payload);
}

// Modify generateAllContent() to include objections in Phase 2
// (after roadmap and document are available)

export async function generateAllContent(userPrompt, researchFiles) {
  // ... existing Phase 0 and Phase 1 ...

  // Phase 2: Now includes objections
  const phase2Tasks = [
    {
      task: () => generateSlidesFromOutline(slidesOutline, userPrompt, researchFiles, swimlanes),
      name: 'Slides'
    },
    {
      task: () => generateDocument(userPrompt, researchFiles, swimlanes),
      name: 'Document'
    }
  ];

  const [slidesResult, documentResult] = await Promise.all(
    phase2Tasks.map(({ task, name }) =>
      task().catch(error => ({ success: false, error: error.message, name }))
    )
  );

  // Phase 3: Objections (needs roadmap + document)
  let objectionsResult = { success: false, data: null };
  if (roadmapResult.success && documentResult.success) {
    try {
      const objectionsData = await generateObjections(
        roadmapResult.data,
        documentResult.data,
        researchContent
      );
      objectionsResult = { success: true, data: objectionsData };
    } catch (error) {
      objectionsResult = { success: false, error: error.message };
    }
  }

  return {
    roadmap: roadmapResult,
    slides: slidesResult,
    document: documentResult,
    researchAnalysis: researchAnalysisResult,
    objections: objectionsResult  // NEW
  };
}
```

### Frontend View

```javascript
// /Public/components/views/ObjectionsView.js

export class ObjectionsView {
  constructor(data = null, sessionId = null) {
    this.data = data;
    this.sessionId = sessionId;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'objections-view p-6 max-w-5xl mx-auto';

    if (!this.data) {
      container.innerHTML = this._renderEmptyState();
      return container;
    }

    container.innerHTML = `
      <header class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Anticipated Objections</h1>
        <p class="text-gray-600">${this.data.summary}</p>
      </header>

      <div class="grid gap-6">
        ${this.data.categories.map(cat => this._renderCategory(cat)).join('')}
      </div>

      <section class="mt-8 p-6 bg-blue-50 rounded-lg">
        <h2 class="text-lg font-semibold text-blue-900 mb-4">Meeting Prep Tips</h2>
        <ul class="space-y-2">
          ${this.data.prepTips.map(tip => `
            <li class="flex items-start gap-2">
              <span class="text-blue-500 mt-1">&#10003;</span>
              <span class="text-blue-800">${tip}</span>
            </li>
          `).join('')}
        </ul>
      </section>
    `;

    this._attachEventListeners(container);
    return container;
  }

  _renderCategory(category) {
    const riskColors = {
      high: 'border-red-200 bg-red-50',
      medium: 'border-yellow-200 bg-yellow-50',
      low: 'border-green-200 bg-green-50'
    };

    const riskBadge = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };

    return `
      <div class="border rounded-lg ${riskColors[category.riskLevel]} overflow-hidden">
        <div class="p-4 border-b flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">${category.name}</h2>
          <span class="px-3 py-1 rounded-full text-sm font-medium ${riskBadge[category.riskLevel]}">
            ${category.riskLevel.toUpperCase()} RISK
          </span>
        </div>
        <div class="divide-y">
          ${category.objections.map(obj => this._renderObjection(obj)).join('')}
        </div>
      </div>
    `;
  }

  _renderObjection(objection) {
    const likelihoodIcon = {
      very_likely: '🔴',
      likely: '🟡',
      possible: '🟢'
    };

    return `
      <div class="objection-card p-4 bg-white/50 hover:bg-white transition-colors">
        <div class="flex items-start gap-3">
          <span class="text-lg" title="${objection.likelihood}">${likelihoodIcon[objection.likelihood]}</span>
          <div class="flex-1">
            <p class="font-medium text-gray-900 mb-1">"${objection.objection}"</p>
            <p class="text-sm text-gray-500 mb-3">Likely from: ${objection.stakeholder}</p>

            <div class="response-section hidden mt-3 p-3 bg-gray-50 rounded-lg">
              <p class="text-sm font-medium text-gray-700 mb-1">Recommended Response:</p>
              <p class="text-gray-800">${objection.response}</p>
              ${objection.evidence ? `
                <p class="text-sm text-blue-600 mt-2">
                  <strong>Evidence:</strong> ${objection.evidence}
                </p>
              ` : ''}
            </div>

            <button class="toggle-response text-sm text-blue-600 hover:text-blue-800 mt-2">
              Show response ▼
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderEmptyState() {
    return `
      <div class="text-center py-12">
        <p class="text-gray-500">Objection analysis will appear here after content generation.</p>
      </div>
    `;
  }

  _attachEventListeners(container) {
    container.querySelectorAll('.toggle-response').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.objection-card');
        const response = card.querySelector('.response-section');
        const isHidden = response.classList.contains('hidden');

        response.classList.toggle('hidden');
        e.target.textContent = isHidden ? 'Hide response ▲' : 'Show response ▼';
      });
    });
  }
}
```

### Navigation Integration

```javascript
// Add to /Public/components/SidebarNav.js navItems array

{
  id: 'objections',
  title: 'Objections',
  subtitle: 'Client pushback prep',
  icon: this._getObjectionsIcon()
}

// Add icon method
_getObjectionsIcon() {
  return `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`;
}
```

### Files to Create/Modify

| Action | File | Changes |
|--------|------|---------|
| CREATE | `/server/prompts/objections.js` | Schema + prompt |
| MODIFY | `/server/generators.js` | Add `generateObjections()`, update `generateAllContent()` |
| MODIFY | `/server/routes/content.js` | Include objections in session content |
| CREATE | `/Public/components/views/ObjectionsView.js` | UI component |
| CREATE | `/Public/styles/objections-view.css` | Styling |
| MODIFY | `/Public/components/SidebarNav.js` | Add nav item |
| MODIFY | `/Public/components/shared/StateManager.js` | Add content type |
| MODIFY | `/Public/main.js` | Register view |

---

## Feature 2: Executive Summary Generator

### Overview
One-click generation of a standalone executive summary with configurable length, extracted from the full document content.

### Data Schema

```javascript
// /server/prompts/executive-summary.js

export const executiveSummarySchema = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "Bold, action-oriented headline (8-12 words)"
    },
    tldr: {
      type: "string",
      description: "One-sentence summary for extremely time-pressed readers"
    },
    situationContext: {
      type: "string",
      description: "Current state and why action is needed (2-3 sentences)"
    },
    proposedSolution: {
      type: "string",
      description: "What we're proposing and why it works (2-3 sentences)"
    },
    keyBenefits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          benefit: { type: "string" },
          metric: { type: "string", description: "Quantified impact if available" }
        },
        required: ["benefit"]
      },
      description: "3-5 key benefits with metrics where possible"
    },
    investmentRange: {
      type: "string",
      description: "Investment framing (e.g., '$X-Y over Z months')"
    },
    timelineHighlight: {
      type: "string",
      description: "Key timeline message (e.g., 'First results in 6 weeks')"
    },
    callToAction: {
      type: "string",
      description: "Clear next step (e.g., 'Schedule a 30-minute discovery call')"
    },
    wordCount: {
      type: "integer",
      description: "Actual word count of the summary"
    }
  },
  required: ["headline", "tldr", "situationContext", "proposedSolution",
             "keyBenefits", "callToAction", "wordCount"]
};
```

### System Prompt

```javascript
// /server/prompts/executive-summary.js

export const EXEC_SUMMARY_SYSTEM_PROMPT = `You are an expert at distilling complex consulting proposals into compelling executive summaries that drive action.

## Writing Principles
1. **Lead with impact**: What changes for the client?
2. **Be specific**: Numbers, timelines, outcomes > vague promises
3. **Respect their time**: Every word must earn its place
4. **Create momentum**: End with a clear, low-friction next step

## Tone Guidelines
- Confident but not arrogant
- Specific but not technical
- Urgent but not pushy
- Professional but human

## Structure Requirements
- Headline: Action-oriented, benefit-focused
- TL;DR: One sentence a CEO could tweet
- Situation: Why now? What's at stake?
- Solution: What we do + why it works
- Benefits: Quantified where possible
- Investment: Frame value, not just cost
- Timeline: When they'll see results
- CTA: Specific, easy next step

## Length Guidance
Target the requested word count:
- 100 words: Headline + TL;DR + 3 bullets + CTA
- 250 words: Full structure, tight prose
- 500 words: Full structure with supporting detail`;

export function generateExecSummaryPrompt(documentData, roadmapData, targetWords = 250) {
  const swimlanes = roadmapData?.timeColumns?.[0]?.swimlanes || [];

  return `${EXEC_SUMMARY_SYSTEM_PROMPT}

## Target Word Count: ${targetWords} words

## Source Document

**Current Executive Summary**:
${documentData?.executiveSummary?.content || 'Not available'}

**Sections**:
${documentData?.sections?.map(s => `
### ${s.title}
${s.content?.substring(0, 1000) || ''}`).join('\n') || 'Not available'}

**Roadmap Phases**:
${swimlanes.map(s => `- ${s.name}: ${s.tasks?.length || 0} tasks`).join('\n')}

Generate the executive summary now, targeting ${targetWords} words.`;
}
```

### Backend Implementation

```javascript
// Add to /server/generators.js

import { generateExecSummaryPrompt, executiveSummarySchema } from './prompts/executive-summary.js';

const EXEC_SUMMARY_CONFIG = {
  temperature: 0.5,
  thinkingBudget: 8192
};

export async function generateExecutiveSummary(documentData, roadmapData, targetWords = 250) {
  const prompt = generateExecSummaryPrompt(documentData, roadmapData, targetWords);

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: EXEC_SUMMARY_CONFIG.temperature,
      maxOutputTokens: CONFIG.gemini.maxTokens.analysis,
      responseMimeType: 'application/json',
      responseSchema: executiveSummarySchema
    }
  };

  if (EXEC_SUMMARY_CONFIG.thinkingBudget > 0) {
    payload.generationConfig.thinking = {
      type: 'enabled',
      budget_tokens: EXEC_SUMMARY_CONFIG.thinkingBudget
    };
  }

  return await callGeminiForJson(payload);
}
```

### API Endpoint

```javascript
// Add to /server/routes/content.js

router.post('/generate-executive-summary', express.json(), strictLimiter, async (req, res) => {
  try {
    const { sessionId, targetWords = 250 } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    touchSession(sessionId);

    const { document, roadmap } = session.content;
    if (!document?.success || !roadmap?.success) {
      return res.status(400).json({
        error: 'Document and roadmap must be generated first'
      });
    }

    const validWords = [100, 250, 500].includes(targetWords) ? targetWords : 250;

    const summary = await generateExecutiveSummary(
      document.data,
      roadmap.data,
      validWords
    );

    // Cache in session for export
    session.content['executive-summary'] = { success: true, data: summary };

    res.json({ status: 'success', data: summary });
  } catch (error) {
    console.error('Executive summary generation failed:', error);
    res.status(500).json({ error: 'Failed to generate executive summary' });
  }
});
```

### Frontend Integration

```javascript
// Add to /Public/components/views/DocumentView.js

// Add button in render() method, after TOC
_renderExecSummaryButton() {
  return `
    <div class="exec-summary-generator mt-6 p-4 border border-dashed border-gray-300 rounded-lg">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium text-gray-900">Generate Standalone Executive Summary</h3>
          <p class="text-sm text-gray-500">Create a polished summary for C-suite sharing</p>
        </div>
        <div class="flex items-center gap-3">
          <select id="exec-summary-length" class="border rounded px-3 py-2 text-sm">
            <option value="100">100 words</option>
            <option value="250" selected>250 words</option>
            <option value="500">500 words</option>
          </select>
          <button id="generate-exec-summary"
                  class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            Generate
          </button>
        </div>
      </div>
      <div id="exec-summary-output" class="hidden mt-4 p-4 bg-gray-50 rounded-lg"></div>
    </div>
  `;
}

// Event handler
async _handleGenerateExecSummary() {
  const btn = document.getElementById('generate-exec-summary');
  const output = document.getElementById('exec-summary-output');
  const lengthSelect = document.getElementById('exec-summary-length');

  btn.disabled = true;
  btn.textContent = 'Generating...';
  output.classList.remove('hidden');
  output.innerHTML = '<p class="text-gray-500">Generating executive summary...</p>';

  try {
    const response = await fetch('/api/content/generate-executive-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        targetWords: parseInt(lengthSelect.value)
      })
    });

    const result = await response.json();

    if (result.status === 'success') {
      output.innerHTML = this._renderExecSummaryResult(result.data);
    } else {
      output.innerHTML = `<p class="text-red-600">Error: ${result.error}</p>`;
    }
  } catch (error) {
    output.innerHTML = `<p class="text-red-600">Failed to generate summary</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate';
  }
}

_renderExecSummaryResult(data) {
  return `
    <div class="space-y-4">
      <div class="flex justify-between items-start">
        <h2 class="text-xl font-bold text-gray-900">${data.headline}</h2>
        <span class="text-sm text-gray-500">${data.wordCount} words</span>
      </div>

      <p class="text-lg font-medium text-blue-600 italic">${data.tldr}</p>

      <div class="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <h4 class="font-semibold text-gray-700 mb-1">The Situation</h4>
          <p class="text-gray-600">${data.situationContext}</p>
        </div>
        <div>
          <h4 class="font-semibold text-gray-700 mb-1">Our Approach</h4>
          <p class="text-gray-600">${data.proposedSolution}</p>
        </div>
      </div>

      <div>
        <h4 class="font-semibold text-gray-700 mb-2">Key Benefits</h4>
        <ul class="space-y-1">
          ${data.keyBenefits.map(b => `
            <li class="flex items-start gap-2">
              <span class="text-green-500">&#10003;</span>
              <span>${b.benefit}${b.metric ? ` <span class="text-blue-600">(${b.metric})</span>` : ''}</span>
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="flex justify-between text-sm border-t pt-4">
        ${data.investmentRange ? `<span><strong>Investment:</strong> ${data.investmentRange}</span>` : ''}
        ${data.timelineHighlight ? `<span><strong>Timeline:</strong> ${data.timelineHighlight}</span>` : ''}
      </div>

      <div class="p-3 bg-blue-100 rounded text-center">
        <strong>Next Step:</strong> ${data.callToAction}
      </div>

      <div class="flex gap-2 justify-end">
        <button onclick="navigator.clipboard.writeText(this.closest('.space-y-4').innerText)"
                class="px-3 py-1 text-sm border rounded hover:bg-gray-50">
          Copy Text
        </button>
        <button id="download-exec-summary-docx"
                class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">
          Download DOCX
        </button>
      </div>
    </div>
  `;
}
```

### Files to Create/Modify

| Action | File | Changes |
|--------|------|---------|
| CREATE | `/server/prompts/executive-summary.js` | Schema + prompt |
| MODIFY | `/server/generators.js` | Add `generateExecutiveSummary()` |
| MODIFY | `/server/routes/content.js` | Add endpoint |
| MODIFY | `/Public/components/views/DocumentView.js` | Add UI + handlers |
| MODIFY | `/Public/styles/document-view.css` | Summary styling |

---

## Feature 3: Talking Points Export

### Overview
Generate presenter-friendly talking points for each slide with verbal cues and transitions.

### Data Schema

```javascript
// /server/prompts/talking-points.js

export const talkingPointsSchema = {
  type: "object",
  properties: {
    meetingContext: {
      type: "object",
      properties: {
        totalDuration: { type: "string", description: "e.g., '25-30 minutes'" },
        audienceLevel: { type: "string", description: "e.g., 'Executive'" },
        keyObjective: { type: "string" }
      }
    },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slideNumber: { type: "integer" },
          slideTitle: { type: "string" },
          duration: { type: "string", description: "e.g., '2-3 min'" },
          openingLine: {
            type: "string",
            description: "Exact words to say when this slide appears"
          },
          keyPoints: {
            type: "array",
            items: { type: "string" },
            description: "3-5 verbal talking points (conversational, not slide text)"
          },
          probeQuestions: {
            type: "array",
            items: { type: "string" },
            description: "Questions to ask the audience to create engagement"
          },
          transitionToNext: {
            type: "string",
            description: "Bridge phrase to next slide"
          },
          ifAsked: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" }
              }
            },
            description: "Likely questions on this slide with prepared answers"
          }
        },
        required: ["slideNumber", "slideTitle", "keyPoints", "transitionToNext"]
      }
    },
    closingScript: {
      type: "string",
      description: "Final 2-3 sentences to close the presentation"
    }
  },
  required: ["slides", "closingScript"]
};
```

### System Prompt

```javascript
// /server/prompts/talking-points.js

export const TALKING_POINTS_SYSTEM_PROMPT = `You are a presentation coach for top-tier management consultants. Your job is to transform slide content into compelling verbal delivery scripts.

## Core Principles
1. **Slides are not scripts**: Talking points should ADD to what's on screen, not repeat it
2. **Conversational tone**: Write for speaking, not reading
3. **Strategic pauses**: Include "[pause]" where emphasis matters
4. **Audience engagement**: Every few slides, include a probe question

## Talking Point Style
- Use "you" and "your" language (client-centric)
- Lead with the "so what" before the details
- Use analogies and concrete examples
- Avoid jargon unless defined
- Keep each point to 1-2 sentences when spoken

## Opening Lines
- Never start with "So, on this slide..."
- Instead: Lead with insight, question, or story
- Examples:
  - "Here's where things get interesting..."
  - "The data surprised us too..."
  - "This is the question we kept hearing..."

## Transitions
- Connect the WHY, not just the WHAT
- Examples:
  - "Now that we've seen the challenge, let's look at our approach..."
  - "These capabilities are great, but you're probably wondering about timeline..."
  - "Before we dive into implementation, I want to address the elephant in the room..."

## Duration Guidelines
- Title/section slides: 30 sec - 1 min
- Content slides: 2-3 min
- Data-heavy slides: 3-4 min
- Discussion/Q&A pauses: 2-5 min`;

export function generateTalkingPointsPrompt(slidesData) {
  const slideList = slidesData.map((slide, i) => `
Slide ${i + 1}: ${slide.title}
Layout: ${slide.layout}
Content: ${JSON.stringify(slide.content || slide)}
`).join('\n---\n');

  return `${TALKING_POINTS_SYSTEM_PROMPT}

## Slides to Script

${slideList}

Generate talking points for each slide with verbal delivery guidance.`;
}
```

### Backend Implementation

```javascript
// Add to /server/generators.js

import { generateTalkingPointsPrompt, talkingPointsSchema } from './prompts/talking-points.js';

const TALKING_POINTS_CONFIG = {
  temperature: 0.6,  // More conversational variation
  thinkingBudget: 8192
};

export async function generateTalkingPoints(slidesData) {
  const prompt = generateTalkingPointsPrompt(slidesData);

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: TALKING_POINTS_CONFIG.temperature,
      maxOutputTokens: CONFIG.gemini.maxTokens.analysis,
      responseMimeType: 'application/json',
      responseSchema: talkingPointsSchema
    }
  };

  return await callGeminiForJson(payload);
}
```

### Export Service (DOCX)

```javascript
// Add to /server/templates/docx-export-service.js

export async function generateTalkingPointsDocx(talkingPointsData) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
          BorderStyle, WidthType, HeadingLevel } = await import('docx');

  const children = [];

  // Title
  children.push(
    new Paragraph({
      text: 'Presentation Talking Points',
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 }
    })
  );

  // Meeting context
  if (talkingPointsData.meetingContext) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Duration: ', bold: true }),
          new TextRun(talkingPointsData.meetingContext.totalDuration || 'TBD'),
          new TextRun({ text: '  |  Audience: ', bold: true }),
          new TextRun(talkingPointsData.meetingContext.audienceLevel || 'TBD')
        ],
        spacing: { after: 300 }
      })
    );
  }

  // Each slide
  for (const slide of talkingPointsData.slides) {
    // Slide header
    children.push(
      new Paragraph({
        text: `Slide ${slide.slideNumber}: ${slide.slideTitle}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    );

    if (slide.duration) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Target: ${slide.duration}`, italics: true, color: '666666' })
          ],
          spacing: { after: 200 }
        })
      );
    }

    // Opening line
    if (slide.openingLine) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'OPENING: ', bold: true, color: '0066CC' }),
            new TextRun({ text: `"${slide.openingLine}"`, italics: true })
          ],
          spacing: { after: 200 }
        })
      );
    }

    // Key points as bullets
    children.push(
      new Paragraph({
        text: 'Key Points:',
        bold: true,
        spacing: { after: 100 }
      })
    );

    for (const point of slide.keyPoints) {
      children.push(
        new Paragraph({
          text: `• ${point}`,
          spacing: { after: 100 },
          indent: { left: 360 }
        })
      );
    }

    // Transition
    if (slide.transitionToNext) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'TRANSITION: ', bold: true, color: '009900' }),
            new TextRun({ text: `"${slide.transitionToNext}"`, italics: true })
          ],
          spacing: { before: 200, after: 100 }
        })
      );
    }

    // If Asked section
    if (slide.ifAsked?.length > 0) {
      children.push(
        new Paragraph({
          text: 'If Asked:',
          bold: true,
          color: '990000',
          spacing: { before: 200, after: 100 }
        })
      );

      for (const qa of slide.ifAsked) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Q: ${qa.question}`, bold: true })
            ],
            indent: { left: 360 },
            spacing: { after: 50 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `A: ${qa.answer}` })
            ],
            indent: { left: 360 },
            spacing: { after: 150 }
          })
        );
      }
    }
  }

  // Closing script
  children.push(
    new Paragraph({
      text: 'Closing Script',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `"${talkingPointsData.closingScript}"`, italics: true })
      ]
    })
  );

  const doc = new Document({
    sections: [{ children }]
  });

  return await Packer.toBuffer(doc);
}
```

### API Endpoint

```javascript
// Add to /server/routes/content.js

router.post('/generate-talking-points', express.json(), strictLimiter, async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = sessions.get(sessionId);
    if (!session?.content?.slides?.success) {
      return res.status(400).json({ error: 'Slides must be generated first' });
    }

    touchSession(sessionId);

    const talkingPoints = await generateTalkingPoints(session.content.slides.data);

    session.content['talking-points'] = { success: true, data: talkingPoints };

    res.json({ status: 'success', data: talkingPoints });
  } catch (error) {
    console.error('Talking points generation failed:', error);
    res.status(500).json({ error: 'Failed to generate talking points' });
  }
});

router.post('/export-talking-points', express.json(), async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = sessions.get(sessionId);
    if (!session?.content?.['talking-points']?.success) {
      return res.status(400).json({ error: 'Generate talking points first' });
    }

    const buffer = await generateTalkingPointsDocx(session.content['talking-points'].data);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="talking-points.docx"');
    res.send(buffer);
  } catch (error) {
    console.error('Talking points export failed:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});
```

### Frontend Integration

```javascript
// Add to /Public/components/views/SlidesView.js

_renderTalkingPointsButton() {
  return `
    <div class="talking-points-section p-4 bg-gray-50 border-t">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium">Talking Points</h3>
          <p class="text-sm text-gray-500">Generate presenter notes for rehearsal</p>
        </div>
        <div class="flex gap-2">
          <button id="generate-talking-points"
                  class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Generate
          </button>
          <button id="export-talking-points"
                  class="px-4 py-2 border rounded hover:bg-gray-100 hidden">
            Export DOCX
          </button>
        </div>
      </div>
    </div>
  `;
}
```

### Files to Create/Modify

| Action | File | Changes |
|--------|------|---------|
| CREATE | `/server/prompts/talking-points.js` | Schema + prompt |
| MODIFY | `/server/generators.js` | Add `generateTalkingPoints()` |
| MODIFY | `/server/routes/content.js` | Add endpoints |
| MODIFY | `/server/templates/docx-export-service.js` | Add `generateTalkingPointsDocx()` |
| MODIFY | `/Public/components/views/SlidesView.js` | Add UI + handlers |

---

## Feature 4: Meeting Duration Optimizer

### Overview
Analyze content against specified meeting duration and recommend pacing, cuts, and emphasis.

### Data Schema

```javascript
// /server/prompts/meeting-optimizer.js

export const meetingOptimizerSchema = {
  type: "object",
  properties: {
    requestedDuration: { type: "integer", description: "Minutes" },
    estimatedDuration: { type: "integer", description: "Minutes" },
    status: {
      type: "string",
      enum: ["on_track", "slightly_over", "significantly_over", "under_time"]
    },
    overageMinutes: { type: "integer" },
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          slideCount: { type: "integer" },
          estimatedMinutes: { type: "integer" },
          allocatedMinutes: { type: "integer" },
          status: {
            type: "string",
            enum: ["ok", "compress", "expand", "cut_candidate"]
          },
          recommendation: { type: "string" }
        },
        required: ["name", "estimatedMinutes", "status", "recommendation"]
      }
    },
    mustKeep: {
      type: "array",
      items: { type: "string" },
      description: "Critical slides/sections that should never be cut"
    },
    cutCandidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          minutesSaved: { type: "integer" },
          impact: { type: "string", enum: ["low", "medium", "high"] },
          rationale: { type: "string" }
        }
      }
    },
    pacingTips: {
      type: "array",
      items: { type: "string" }
    },
    alternativeFormats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          format: { type: "string", description: "e.g., '15-min version'" },
          includes: { type: "array", items: { type: "string" } },
          cuts: { type: "array", items: { type: "string" } }
        }
      }
    }
  },
  required: ["requestedDuration", "estimatedDuration", "status", "sections", "pacingTips"]
};
```

### System Prompt

```javascript
// /server/prompts/meeting-optimizer.js

export const MEETING_OPTIMIZER_SYSTEM_PROMPT = `You are a presentation timing expert who helps consultants fit their content to meeting slots.

## Timing Estimation Rules
- Title/section slides: 30-60 seconds
- Simple content slides: 2 minutes
- Data/chart slides: 3-4 minutes
- Discussion slides: 3-5 minutes
- Add 20% buffer for questions/transitions

## Status Thresholds
- on_track: Within 10% of target
- slightly_over: 10-25% over
- significantly_over: >25% over
- under_time: >20% under target

## Prioritization for Cuts
1. NEVER cut: Executive summary, key recommendations, pricing, next steps
2. CUT FIRST: Background context, detailed methodology, appendix items
3. COMPRESS: Can condense detailed sections to highlights

## Format Recommendations
Always provide alternative formats:
- 15-min: Exec summary + recommendations + discussion
- 30-min: Full story, compressed detail
- 45-min: Standard presentation
- 60-min: Presentation + deep Q&A`;

export function generateMeetingOptimizerPrompt(slidesData, roadmapData, targetMinutes) {
  const slidesSummary = slidesData.map((s, i) =>
    `${i + 1}. ${s.title} (${s.layout})`
  ).join('\n');

  const swimlanes = roadmapData?.timeColumns?.[0]?.swimlanes || [];
  const phaseSummary = swimlanes.map(s =>
    `- ${s.name}: ${s.tasks?.length || 0} items`
  ).join('\n');

  return `${MEETING_OPTIMIZER_SYSTEM_PROMPT}

## Target Meeting Duration: ${targetMinutes} minutes

## Slides (${slidesData.length} total)
${slidesSummary}

## Roadmap Phases
${phaseSummary}

Analyze the content and provide duration optimization recommendations.`;
}
```

### Backend Implementation

```javascript
// Add to /server/generators.js

import { generateMeetingOptimizerPrompt, meetingOptimizerSchema } from './prompts/meeting-optimizer.js';

const MEETING_OPTIMIZER_CONFIG = {
  temperature: 0.2,  // More deterministic analysis
  thinkingBudget: 4096
};

export async function analyzeMeetingDuration(slidesData, roadmapData, targetMinutes) {
  const prompt = generateMeetingOptimizerPrompt(slidesData, roadmapData, targetMinutes);

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: MEETING_OPTIMIZER_CONFIG.temperature,
      maxOutputTokens: CONFIG.gemini.maxTokens.analysis,
      responseMimeType: 'application/json',
      responseSchema: meetingOptimizerSchema
    }
  };

  return await callGeminiForJson(payload);
}
```

### API Endpoint

```javascript
// Add to /server/routes/content.js

router.post('/analyze-meeting-duration', express.json(), strictLimiter, async (req, res) => {
  try {
    const { sessionId, targetMinutes = 30 } = req.body;

    const session = sessions.get(sessionId);
    if (!session?.content?.slides?.success || !session?.content?.roadmap?.success) {
      return res.status(400).json({ error: 'Slides and roadmap must be generated first' });
    }

    touchSession(sessionId);

    const validMinutes = [15, 30, 45, 60, 90].includes(targetMinutes) ? targetMinutes : 30;

    const analysis = await analyzeMeetingDuration(
      session.content.slides.data,
      session.content.roadmap.data,
      validMinutes
    );

    session.content['meeting-metrics'] = { success: true, data: analysis };

    res.json({ status: 'success', data: analysis });
  } catch (error) {
    console.error('Meeting duration analysis failed:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});
```

### Frontend View

```javascript
// /Public/components/views/MeetingOptimizerView.js

export class MeetingOptimizerView {
  constructor(data = null, sessionId = null) {
    this.data = data;
    this.sessionId = sessionId;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'meeting-optimizer-view p-6 max-w-4xl mx-auto';

    container.innerHTML = `
      <header class="mb-6">
        <h1 class="text-2xl font-bold mb-2">Meeting Duration Optimizer</h1>
        <div class="flex items-center gap-4">
          <label class="text-sm text-gray-600">Target Duration:</label>
          <select id="meeting-duration-select" class="border rounded px-3 py-2">
            <option value="15">15 minutes</option>
            <option value="30" selected>30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
          </select>
          <button id="analyze-duration" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Analyze
          </button>
        </div>
      </header>

      <div id="optimizer-results">
        ${this.data ? this._renderResults(this.data) : this._renderEmptyState()}
      </div>
    `;

    this._attachEventListeners(container);
    return container;
  }

  _renderResults(data) {
    const statusColors = {
      on_track: 'bg-green-100 text-green-800 border-green-200',
      slightly_over: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      significantly_over: 'bg-red-100 text-red-800 border-red-200',
      under_time: 'bg-blue-100 text-blue-800 border-blue-200'
    };

    const statusLabels = {
      on_track: 'On Track',
      slightly_over: 'Slightly Over',
      significantly_over: 'Significantly Over',
      under_time: 'Under Time'
    };

    return `
      <div class="space-y-6">
        <!-- Status Banner -->
        <div class="p-4 rounded-lg border ${statusColors[data.status]}">
          <div class="flex justify-between items-center">
            <div>
              <span class="font-bold text-lg">${statusLabels[data.status]}</span>
              <p class="text-sm mt-1">${data.summary}</p>
            </div>
            <div class="text-right">
              <div class="text-3xl font-bold">${data.estimatedDuration} min</div>
              <div class="text-sm opacity-75">Target: ${data.requestedDuration} min</div>
            </div>
          </div>
        </div>

        <!-- Section Breakdown -->
        <div class="border rounded-lg overflow-hidden">
          <div class="bg-gray-50 px-4 py-3 border-b">
            <h2 class="font-semibold">Section Breakdown</h2>
          </div>
          <table class="w-full">
            <thead class="bg-gray-50 text-sm text-gray-600">
              <tr>
                <th class="px-4 py-2 text-left">Section</th>
                <th class="px-4 py-2 text-center">Slides</th>
                <th class="px-4 py-2 text-center">Est. Time</th>
                <th class="px-4 py-2 text-center">Status</th>
                <th class="px-4 py-2 text-left">Recommendation</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${data.sections.map(s => `
                <tr class="${s.status === 'cut_candidate' ? 'bg-red-50' : ''}">
                  <td class="px-4 py-3 font-medium">${s.name}</td>
                  <td class="px-4 py-3 text-center">${s.slideCount || '-'}</td>
                  <td class="px-4 py-3 text-center">${s.estimatedMinutes} min</td>
                  <td class="px-4 py-3 text-center">
                    <span class="px-2 py-1 rounded text-xs font-medium ${this._getSectionStatusColor(s.status)}">
                      ${s.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600">${s.recommendation}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Cut Candidates -->
        ${data.cutCandidates?.length ? `
          <div class="border border-red-200 rounded-lg overflow-hidden">
            <div class="bg-red-50 px-4 py-3 border-b border-red-200">
              <h2 class="font-semibold text-red-800">Suggested Cuts</h2>
            </div>
            <div class="divide-y">
              ${data.cutCandidates.map(c => `
                <div class="px-4 py-3 flex justify-between items-center">
                  <div>
                    <span class="font-medium">${c.item}</span>
                    <p class="text-sm text-gray-600">${c.rationale}</p>
                  </div>
                  <div class="text-right">
                    <span class="text-green-600 font-medium">-${c.minutesSaved} min</span>
                    <div class="text-xs text-gray-500">Impact: ${c.impact}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Pacing Tips -->
        <div class="bg-blue-50 rounded-lg p-4">
          <h2 class="font-semibold text-blue-900 mb-3">Pacing Tips</h2>
          <ul class="space-y-2">
            ${data.pacingTips.map(tip => `
              <li class="flex items-start gap-2 text-blue-800">
                <span class="text-blue-500 mt-1">&#8226;</span>
                <span>${tip}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <!-- Alternative Formats -->
        ${data.alternativeFormats?.length ? `
          <div class="border rounded-lg overflow-hidden">
            <div class="bg-gray-50 px-4 py-3 border-b">
              <h2 class="font-semibold">Alternative Formats</h2>
            </div>
            <div class="grid md:grid-cols-2 gap-4 p-4">
              ${data.alternativeFormats.map(f => `
                <div class="border rounded p-3">
                  <h3 class="font-medium mb-2">${f.format}</h3>
                  <div class="text-sm">
                    <p class="text-green-700 mb-1">Include: ${f.includes.join(', ')}</p>
                    <p class="text-red-700">Cut: ${f.cuts.join(', ')}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _getSectionStatusColor(status) {
    const colors = {
      ok: 'bg-green-100 text-green-800',
      compress: 'bg-yellow-100 text-yellow-800',
      expand: 'bg-blue-100 text-blue-800',
      cut_candidate: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  _renderEmptyState() {
    return `
      <div class="text-center py-12 text-gray-500">
        <p>Select a meeting duration and click "Analyze" to optimize your presentation.</p>
      </div>
    `;
  }

  _attachEventListeners(container) {
    const btn = container.querySelector('#analyze-duration');
    const select = container.querySelector('#meeting-duration-select');
    const results = container.querySelector('#optimizer-results');

    btn?.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Analyzing...';
      results.innerHTML = '<p class="text-center py-8 text-gray-500">Analyzing presentation timing...</p>';

      try {
        const response = await fetch('/api/content/analyze-meeting-duration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: this.sessionId,
            targetMinutes: parseInt(select.value)
          })
        });

        const result = await response.json();
        if (result.status === 'success') {
          this.data = result.data;
          results.innerHTML = this._renderResults(result.data);
        } else {
          results.innerHTML = `<p class="text-center py-8 text-red-600">Error: ${result.error}</p>`;
        }
      } catch (error) {
        results.innerHTML = '<p class="text-center py-8 text-red-600">Analysis failed</p>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Analyze';
      }
    });
  }
}
```

### Files to Create/Modify

| Action | File | Changes |
|--------|------|---------|
| CREATE | `/server/prompts/meeting-optimizer.js` | Schema + prompt |
| MODIFY | `/server/generators.js` | Add `analyzeMeetingDuration()` |
| MODIFY | `/server/routes/content.js` | Add endpoint |
| CREATE | `/Public/components/views/MeetingOptimizerView.js` | UI component |
| CREATE | `/Public/styles/meeting-optimizer.css` | Styling |
| MODIFY | `/Public/components/SidebarNav.js` | Add nav item |

---

## Feature 5: Competitive Positioning

### Overview
Inject competitor context into generation prompts and auto-create differentiation content.

### Implementation Approach

Unlike other features, competitive positioning modifies **existing generation** rather than creating new outputs. It works by:

1. Adding competitor input fields to the project setup
2. Injecting competitor context into existing prompts
3. Auto-generating a "Why Us" slide in Slides View
4. Adding differentiation callouts in Document View

### Schema Updates

```javascript
// Add to session schema in /server/routes/content.js

const projectSettings = {
  competitors: {
    type: "array",
    items: {
      type: "object",
      properties: {
        name: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        weaknesses: { type: "array", items: { type: "string" } }
      }
    }
  },
  differentiators: {
    type: "array",
    items: { type: "string" },
    description: "Our key differentiators"
  }
};
```

### Prompt Injection Layer

```javascript
// /server/prompts/competitive-context.js

export function injectCompetitiveContext(basePrompt, competitors = [], differentiators = []) {
  if (!competitors.length && !differentiators.length) {
    return basePrompt;
  }

  const competitorSection = competitors.length ? `
## Competitive Context
The client is also considering these alternatives:
${competitors.map(c => `
**${c.name}**
- Known strengths: ${c.strengths?.join(', ') || 'N/A'}
- Known weaknesses: ${c.weaknesses?.join(', ') || 'N/A'}
`).join('\n')}

When relevant, subtly differentiate our approach without directly attacking competitors.
` : '';

  const differentiatorSection = differentiators.length ? `
## Our Key Differentiators
Weave these proof points into the narrative where natural:
${differentiators.map((d, i) => `${i + 1}. ${d}`).join('\n')}
` : '';

  return `${basePrompt}

${competitorSection}
${differentiatorSection}`;
}
```

### Modify Existing Generators

```javascript
// Update /server/generators.js

import { injectCompetitiveContext } from './prompts/competitive-context.js';

// Modify generateDocument to accept settings
async function generateDocument(userPrompt, researchFiles, swimlanes, settings = {}) {
  let prompt = generateDocumentPrompt(userPrompt, researchFiles, swimlanes);

  // Inject competitive context if provided
  if (settings.competitors?.length || settings.differentiators?.length) {
    prompt = injectCompetitiveContext(prompt, settings.competitors, settings.differentiators);
  }

  // ... rest of existing generation logic
}

// Modify generateSlidesFromOutline to add "Why Us" slide
async function generateSlidesFromOutline(outline, userPrompt, researchFiles, swimlanes, settings = {}) {
  let prompt = generateSlidesPass2Prompt(outline, userPrompt, researchFiles, swimlanes);

  if (settings.competitors?.length || settings.differentiators?.length) {
    prompt = injectCompetitiveContext(prompt, settings.competitors, settings.differentiators);

    // Add instruction to include "Why Us" slide
    prompt += `

IMPORTANT: Include a "Why [Our Firm]" slide as the second-to-last slide (before the closing/next steps slide).
This slide should:
- Use a two-column or three-column layout
- Highlight 3-4 key differentiators
- Include proof points or metrics where available
- Be confident but not arrogant`;
  }

  // ... rest of existing generation logic
}
```

### API Updates

```javascript
// Modify /server/routes/content.js POST /generate

router.post('/generate', uploadMiddleware.array('researchFiles'), async (req, res) => {
  try {
    const { prompt } = req.body;

    // Parse settings from request (as JSON string field)
    let settings = {};
    if (req.body.settings) {
      try {
        settings = JSON.parse(req.body.settings);
      } catch (e) {
        // Ignore parse errors, use empty settings
      }
    }

    const sessionId = crypto.randomUUID();

    // Store settings in session
    sessions.set(sessionId, {
      prompt,
      settings,  // NEW: Store project settings
      researchContent: extractedText,
      content: {
        roadmap: { success: false, data: null },
        slides: { success: false, data: null },
        document: { success: false, data: null },
        'research-analysis': { success: false, data: null }
      },
      createdAt: Date.now(),
      lastAccessed: Date.now()
    });

    // Pass settings to generateAllContent
    const content = await generateAllContent(prompt, files, settings);

    // ... rest of existing logic
  } catch (error) {
    // ... error handling
  }
});
```

### Frontend: Project Settings Form

```javascript
// Add to /Public/main.js or create /Public/components/ProjectSettings.js

function renderCompetitorInputs() {
  return `
    <div class="competitor-settings mt-6 p-4 border rounded-lg bg-gray-50">
      <h3 class="font-medium text-gray-900 mb-3">Competitive Context (Optional)</h3>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Competitors</label>
          <div id="competitor-list" class="space-y-2">
            <!-- Dynamic competitor inputs -->
          </div>
          <button type="button" id="add-competitor"
                  class="mt-2 text-sm text-blue-600 hover:text-blue-800">
            + Add Competitor
          </button>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Our Differentiators</label>
          <textarea id="differentiators" rows="3"
                    class="w-full border rounded px-3 py-2 text-sm"
                    placeholder="Enter key differentiators, one per line..."></textarea>
        </div>
      </div>
    </div>
  `;
}

function collectProjectSettings() {
  const competitors = [];
  document.querySelectorAll('.competitor-entry').forEach(entry => {
    const name = entry.querySelector('.competitor-name')?.value;
    if (name) {
      competitors.push({
        name,
        strengths: entry.querySelector('.competitor-strengths')?.value?.split(',').map(s => s.trim()).filter(Boolean) || [],
        weaknesses: entry.querySelector('.competitor-weaknesses')?.value?.split(',').map(s => s.trim()).filter(Boolean) || []
      });
    }
  });

  const differentiators = document.getElementById('differentiators')?.value
    ?.split('\n').map(d => d.trim()).filter(Boolean) || [];

  return { competitors, differentiators };
}

// Modify form submission to include settings
async function handleChartGenerate(event) {
  // ... existing file collection logic

  const settings = collectProjectSettings();
  formData.append('settings', JSON.stringify(settings));

  // ... rest of submission logic
}
```

### Files to Create/Modify

| Action | File | Changes |
|--------|------|---------|
| CREATE | `/server/prompts/competitive-context.js` | Context injection function |
| MODIFY | `/server/generators.js` | Update generators to accept/use settings |
| MODIFY | `/server/routes/content.js` | Parse settings, store in session |
| MODIFY | `/Public/main.js` | Add competitor input UI |
| CREATE | `/Public/components/ProjectSettings.js` | Settings form component |
| MODIFY | `/Public/styles/main.css` | Settings form styling |

---

## Shared Infrastructure

### State Manager Updates

```javascript
// /Public/components/shared/StateManager.js

// Update initial state
const initialState = {
  sessionId: null,
  currentView: 'roadmap',
  content: {
    roadmap: null,
    slides: null,
    document: null,
    'research-analysis': null,
    // NEW content types
    objections: null,
    'executive-summary': null,
    'talking-points': null,
    'meeting-metrics': null
  },
  loading: {
    roadmap: false,
    slides: false,
    document: false,
    'research-analysis': false,
    // NEW loading states
    objections: false,
    'executive-summary': false,
    'talking-points': false,
    'meeting-metrics': false
  },
  errors: {
    roadmap: null,
    slides: null,
    document: null,
    'research-analysis': null,
    objections: null,
    'executive-summary': null,
    'talking-points': null,
    'meeting-metrics': null
  },
  // NEW: Project settings
  settings: {
    competitors: [],
    differentiators: [],
    meetingDuration: 30
  },
  ui: {
    menuOpen: false,
    fullscreen: false
  }
};
```

### Navigation Updates

```javascript
// /Public/components/SidebarNav.js

// Full navItems array with new features
const navItems = [
  { id: 'roadmap', title: 'Roadmap', subtitle: 'Gantt timeline', icon: this._getRoadmapIcon() },
  { id: 'document', title: 'Document', subtitle: 'Long-form report', icon: this._getDocumentIcon() },
  { id: 'slides', title: 'Slides', subtitle: 'Presentation deck', icon: this._getSlidesIcon() },
  { id: 'research-analysis', title: 'Research QA', subtitle: 'Quality assessment', icon: this._getResearchIcon() },
  // NEW navigation items
  { id: 'objections', title: 'Objections', subtitle: 'Client pushback prep', icon: this._getObjectionsIcon() },
  { id: 'meeting-optimizer', title: 'Timing', subtitle: 'Duration optimizer', icon: this._getTimingIcon() }
];
```

### View Registration

```javascript
// /Public/main.js

import { ObjectionsView } from './components/views/ObjectionsView.js';
import { MeetingOptimizerView } from './components/views/MeetingOptimizerView.js';

function renderView(viewId, content, sessionId) {
  switch (viewId) {
    case 'roadmap':
      return new RoadmapView(content.roadmap, sessionId).render();
    case 'document':
      return new DocumentView(content.document, sessionId).render();
    case 'slides':
      return new SlidesView(content.slides, sessionId).render();
    case 'research-analysis':
      return new ResearchAnalysisView(content['research-analysis'], sessionId).render();
    // NEW views
    case 'objections':
      return new ObjectionsView(content.objections, sessionId).render();
    case 'meeting-optimizer':
      return new MeetingOptimizerView(content['meeting-metrics'], sessionId).render();
    default:
      return document.createElement('div');
  }
}
```

---

## Implementation Order

### Week 1: Foundation + Quick Wins

| Day | Tasks | Outputs |
|-----|-------|---------|
| **Day 1** | Set up shared infrastructure | StateManager updates, nav items, view registration |
| **Day 2** | Feature 2: Executive Summary | Prompt, generator, API endpoint, UI in DocumentView |
| **Day 3** | Feature 1: Objection Anticipator | Prompt, generator, API endpoint, ObjectionsView |
| **Day 4** | Feature 3: Talking Points | Prompt, generator, API endpoint, DOCX export |
| **Day 5** | Testing + Polish | Integration testing, bug fixes, UX refinements |

### Week 2: Advanced Features

| Day | Tasks | Outputs |
|-----|-------|---------|
| **Day 1** | Feature 4: Meeting Optimizer | Prompt, generator, MeetingOptimizerView |
| **Day 2** | Feature 5: Competitive Positioning | Context injection, settings form, prompt modifications |
| **Day 3** | Integration | End-to-end flow with all features |
| **Day 4** | Testing | Full test suite, edge cases |
| **Day 5** | Documentation + Deploy | README updates, deployment |

---

## Testing Strategy

### Unit Tests

```javascript
// /tests/prompts/objections.test.js

import { generateObjectionsPrompt, objectionsSchema } from '../../server/prompts/objections.js';

describe('Objections Prompt', () => {
  test('generates valid prompt with roadmap data', () => {
    const roadmap = { timeColumns: [{ swimlanes: [{ name: 'Phase 1' }] }] };
    const document = { executiveSummary: { content: 'Test summary' } };

    const prompt = generateObjectionsPrompt(roadmap, document, 'Research text');

    expect(prompt).toContain('Phase 1');
    expect(prompt).toContain('Test summary');
  });

  test('schema validates required fields', () => {
    const validOutput = {
      summary: 'Test',
      categories: [],
      prepTips: []
    };

    // Use JSON schema validator
    expect(validateSchema(validOutput, objectionsSchema)).toBe(true);
  });
});
```

### Integration Tests

```javascript
// /tests/integration/sales-features.test.js

describe('Sales Enablement Features', () => {
  let sessionId;

  beforeAll(async () => {
    // Create session with test content
    const response = await request(app)
      .post('/api/content/generate')
      .attach('researchFiles', 'tests/fixtures/sample.docx')
      .field('prompt', 'Test proposal');

    sessionId = response.body.sessionId;
  });

  test('generates objections from session', async () => {
    const response = await request(app)
      .post('/api/content/generate-objections')
      .send({ sessionId });

    expect(response.status).toBe(200);
    expect(response.body.data.categories).toBeDefined();
    expect(response.body.data.categories.length).toBeGreaterThan(0);
  });

  test('generates executive summary with word count', async () => {
    const response = await request(app)
      .post('/api/content/generate-executive-summary')
      .send({ sessionId, targetWords: 250 });

    expect(response.status).toBe(200);
    expect(response.body.data.wordCount).toBeLessThanOrEqual(300);
  });

  test('analyzes meeting duration', async () => {
    const response = await request(app)
      .post('/api/content/analyze-meeting-duration')
      .send({ sessionId, targetMinutes: 30 });

    expect(response.status).toBe(200);
    expect(response.body.data.estimatedDuration).toBeDefined();
    expect(response.body.data.sections.length).toBeGreaterThan(0);
  });

  test('exports talking points as DOCX', async () => {
    // First generate talking points
    await request(app)
      .post('/api/content/generate-talking-points')
      .send({ sessionId });

    // Then export
    const response = await request(app)
      .post('/api/content/export-talking-points')
      .send({ sessionId });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/vnd.openxmlformats');
  });
});
```

### E2E Tests

```javascript
// /tests/e2e/sales-workflow.test.js

describe('Sales Meeting Prep Workflow', () => {
  test('full workflow: upload → generate → review objections → export talking points', async () => {
    // 1. Upload and generate content
    await page.goto('/');
    await page.setInputFiles('#file-upload', 'tests/fixtures/proposal.docx');
    await page.fill('#prompt', 'Sales proposal for enterprise client');
    await page.click('#generate-btn');

    // 2. Wait for generation
    await page.waitForSelector('[data-view="objections"]:not([disabled])');

    // 3. Navigate to objections
    await page.click('[data-view="objections"]');
    await page.waitForSelector('.objection-card');

    // 4. Verify objections loaded
    const objections = await page.$$('.objection-card');
    expect(objections.length).toBeGreaterThan(5);

    // 5. Navigate to slides and generate talking points
    await page.click('[data-view="slides"]');
    await page.click('#generate-talking-points');
    await page.waitForSelector('#export-talking-points:not([disabled])');

    // 6. Export talking points
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-talking-points')
    ]);

    expect(download.suggestedFilename()).toBe('talking-points.docx');
  });
});
```

---

## Summary

This implementation plan covers 5 low-effort, high-impact features:

| Feature | New Files | Modified Files | API Endpoints | Effort |
|---------|-----------|----------------|---------------|--------|
| Objection Anticipator | 3 | 5 | 1 | Low |
| Executive Summary | 1 | 4 | 1 | Low |
| Talking Points Export | 1 | 4 | 2 | Low |
| Meeting Optimizer | 3 | 4 | 1 | Low |
| Competitive Positioning | 2 | 4 | 0 (modifies existing) | Low-Med |

**Total New Files**: 10
**Total Modified Files**: 12 (some overlap)
**Total New API Endpoints**: 5

All features leverage existing architecture patterns and integrate seamlessly with the session-based content flow.
