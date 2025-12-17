# Revised Implementation Plan: Low-Effort Sales Enablement Features

> Comprehensive technical plan incorporating architecture review corrections for seamless integration with Force's existing patterns.

**Status**: Revised based on codebase analysis
**Target Timeline**: 1-2 weeks
**Architecture Compatibility**: Verified against existing patterns

---

## Table of Contents

1. [Architecture Patterns Reference](#architecture-patterns-reference)
2. [Shared Infrastructure](#shared-infrastructure)
3. [Feature 1: Objection Anticipator](#feature-1-objection-anticipator)
4. [Feature 2: Executive Summary Generator](#feature-2-executive-summary-generator)
5. [Feature 3: Talking Points Export](#feature-3-talking-points-export)
6. [Feature 4: Meeting Duration Optimizer](#feature-4-meeting-duration-optimizer)
7. [Feature 5: Competitive Positioning](#feature-5-competitive-positioning)
8. [Implementation Order](#implementation-order)
9. [Testing Strategy](#testing-strategy)

---

## Architecture Patterns Reference

### Generator Pattern (MUST FOLLOW)

All generators must use the existing `generateWithGemini` wrapper:

```javascript
// ✓ CORRECT PATTERN - from generators.js
async function generateFeature(inputData, researchContent) {
  const prompt = generateFeaturePrompt(inputData, researchContent);

  const data = await generateWithGemini(
    prompt,
    featureSchema,
    'FeatureName',  // For logging
    FEATURE_CONFIG
  );

  return { success: true, data };
}
```

### Config Structure (MUST INCLUDE ALL FIELDS)

```javascript
// ✓ CORRECT - matches existing DOCUMENT_CONFIG, ROADMAP_CONFIG patterns
const FEATURE_CONFIG = {
  temperature: 0.4,
  topP: 0.8,        // REQUIRED
  topK: 30,         // REQUIRED
  thinkingBudget: 4096
};
```

### APIQueue Integration (REQUIRED)

```javascript
// ✓ CORRECT - use apiQueue for all Gemini calls
const result = await apiQueue.add(
  () => generateFeature(data, research),
  'FeatureName'
);
```

### View Component Pattern

```javascript
// ✓ CORRECT - matches DocumentView, SlidesView
export class FeatureView {
  constructor(data = null, sessionId = null) {
    this.data = data;
    this.sessionId = sessionId;
    this.container = null;
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'feature-view';

    if (!this.data) {
      this.container.appendChild(this._renderEmptyState());
      return this.container;
    }

    // Build content...
    return this.container;
  }

  _renderEmptyState() { /* ... */ }
  destroy() { /* cleanup */ }
}
```

---

## Shared Infrastructure

### 1. Enhancement Generator Pattern

Add to `/server/generators.js`:

```javascript
// ============================================================================
// ON-DEMAND ENHANCEMENT GENERATORS
// Generate additional content from existing session data
// ============================================================================

import { generateObjectionsPrompt, objectionsSchema } from './prompts/objections.js';
import { generateExecSummaryPrompt, executiveSummarySchema } from './prompts/executive-summary.js';
import { generateTalkingPointsPrompt, talkingPointsSchema } from './prompts/talking-points.js';
import { generateMeetingOptimizerPrompt, meetingOptimizerSchema } from './prompts/meeting-optimizer.js';

// Config objects matching existing pattern
const OBJECTIONS_CONFIG = {
  temperature: 0.4,
  topP: 0.8,
  topK: 30,
  thinkingBudget: 4096
};

const EXEC_SUMMARY_CONFIG = {
  temperature: 0.5,
  topP: 0.85,
  topK: 40,
  thinkingBudget: 8192
};

const TALKING_POINTS_CONFIG = {
  temperature: 0.6,
  topP: 0.9,
  topK: 40,
  thinkingBudget: 8192
};

const MEETING_OPTIMIZER_CONFIG = {
  temperature: 0.2,
  topP: 0.7,
  topK: 20,
  thinkingBudget: 4096
};

// Individual generators
async function generateObjections(roadmapData, documentData, researchContent) {
  const prompt = generateObjectionsPrompt(roadmapData, documentData, researchContent);
  const data = await generateWithGemini(prompt, objectionsSchema, 'Objections', OBJECTIONS_CONFIG);
  return { success: true, data };
}

async function generateExecutiveSummary(documentData, roadmapData, targetWords = 250) {
  const prompt = generateExecSummaryPrompt(documentData, roadmapData, targetWords);
  const data = await generateWithGemini(prompt, executiveSummarySchema, 'ExecutiveSummary', EXEC_SUMMARY_CONFIG);
  return { success: true, data };
}

async function generateTalkingPoints(slidesData) {
  const prompt = generateTalkingPointsPrompt(slidesData);
  const data = await generateWithGemini(prompt, talkingPointsSchema, 'TalkingPoints', TALKING_POINTS_CONFIG);
  return { success: true, data };
}

async function analyzeMeetingDuration(slidesData, roadmapData, targetMinutes = 30) {
  const prompt = generateMeetingOptimizerPrompt(slidesData, roadmapData, targetMinutes);
  const data = await generateWithGemini(prompt, meetingOptimizerSchema, 'MeetingOptimizer', MEETING_OPTIMIZER_CONFIG);
  return { success: true, data };
}

// Unified enhancement dispatcher
export async function generateEnhancement(type, sessionData, options = {}) {
  const { roadmap, document, slides } = sessionData.content;
  const researchContent = sessionData.researchFiles?.map(f => f.content).join('\n') || '';

  try {
    switch (type) {
      case 'objections':
        if (!roadmap?.success || !document?.success) {
          return { success: false, error: 'Requires roadmap and document to be generated first' };
        }
        return await apiQueue.add(
          () => generateObjections(roadmap.data, document.data, researchContent),
          'Objections'
        );

      case 'executive-summary':
        if (!document?.success || !roadmap?.success) {
          return { success: false, error: 'Requires document and roadmap to be generated first' };
        }
        const targetWords = [100, 250, 500].includes(options.targetWords) ? options.targetWords : 250;
        return await apiQueue.add(
          () => generateExecutiveSummary(document.data, roadmap.data, targetWords),
          'ExecutiveSummary'
        );

      case 'talking-points':
        if (!slides?.success) {
          return { success: false, error: 'Requires slides to be generated first' };
        }
        return await apiQueue.add(
          () => generateTalkingPoints(slides.data),
          'TalkingPoints'
        );

      case 'meeting-analysis':
        if (!slides?.success || !roadmap?.success) {
          return { success: false, error: 'Requires slides and roadmap to be generated first' };
        }
        const targetMinutes = [15, 30, 45, 60, 90].includes(options.targetMinutes) ? options.targetMinutes : 30;
        return await apiQueue.add(
          () => analyzeMeetingDuration(slides.data, roadmap.data, targetMinutes),
          'MeetingOptimizer'
        );

      default:
        return { success: false, error: `Unknown enhancement type: ${type}` };
    }
  } catch (error) {
    console.error(`Enhancement generation failed for ${type}:`, error);
    return { success: false, error: error.message };
  }
}
```

### 2. Unified Enhancement Route

Add to `/server/routes/content.js`:

```javascript
import { generateEnhancement } from '../generators.js';

// Unified enhancement endpoint
router.post('/:sessionId/enhance/:type', express.json(), strictLimiter, async (req, res) => {
  try {
    const { sessionId, type } = req.params;
    const options = req.body || {};

    // Validate session
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    touchSession(sessionId);

    // Generate enhancement
    const result = await generateEnhancement(type, session, options);

    // Cache result in session
    if (!session.enhancements) {
      session.enhancements = {};
    }
    session.enhancements[type] = result;

    res.json({
      type,
      status: result.success ? 'completed' : 'error',
      data: result.data || null,
      error: result.error || null
    });
  } catch (error) {
    console.error('Enhancement generation failed:', error);
    res.status(500).json({
      error: 'Enhancement generation failed',
      details: error.message
    });
  }
});

// Get cached enhancement
router.get('/:sessionId/enhance/:type', async (req, res) => {
  try {
    const { sessionId, type } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    touchSession(sessionId);

    const enhancement = session.enhancements?.[type];
    if (!enhancement) {
      return res.status(404).json({ error: `Enhancement '${type}' not generated yet` });
    }

    res.json({
      type,
      status: enhancement.success ? 'completed' : 'error',
      data: enhancement.data || null,
      error: enhancement.error || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve enhancement' });
  }
});
```

### 3. StateManager Updates

Modify `/Public/components/shared/StateManager.js`:

```javascript
constructor() {
  this.state = {
    sessionId: null,
    currentView: 'roadmap',
    content: {
      roadmap: null,
      slides: null,
      document: null,
      'research-analysis': null
    },
    // NEW: Enhancement content (on-demand generated)
    enhancements: {
      objections: null,
      'executive-summary': null,
      'talking-points': null,
      'meeting-analysis': null
    },
    loading: {
      roadmap: false,
      slides: false,
      document: false,
      'research-analysis': false,
      // NEW
      objections: false,
      'executive-summary': false,
      'talking-points': false,
      'meeting-analysis': false
    },
    errors: {
      roadmap: null,
      slides: null,
      document: null,
      'research-analysis': null,
      // NEW
      objections: null,
      'executive-summary': null,
      'talking-points': null,
      'meeting-analysis': null
    },
    ui: {
      menuOpen: false,
      fullscreen: false
    }
  };
  // ... rest of constructor
}

// Add enhancement loader method
async loadEnhancement(type, options = {}, forceRefresh = false) {
  // Return cached if available
  if (!forceRefresh && this.state.enhancements[type]) {
    return this.state.enhancements[type];
  }

  // Set loading state
  this.setState({
    loading: { ...this.state.loading, [type]: true },
    errors: { ...this.state.errors, [type]: null }
  });

  try {
    const response = await fetchWithRetry(
      `/api/content/${this.state.sessionId}/enhance/${type}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(options)
      }
    );

    if (!response.ok) {
      throw new AppError(`Failed to generate ${type}: ${response.statusText}`, ErrorTypes.API);
    }

    const result = await response.json();

    if (result.status === 'error') {
      throw new AppError(result.error || `Failed to generate ${type}`, ErrorTypes.API);
    }

    // Validate response based on type
    this._validateEnhancementData(type, result.data);

    // Update state
    this.setState({
      enhancements: { ...this.state.enhancements, [type]: result.data },
      loading: { ...this.state.loading, [type]: false }
    });

    return result.data;
  } catch (error) {
    this.setState({
      loading: { ...this.state.loading, [type]: false },
      errors: { ...this.state.errors, [type]: error.message }
    });
    throw error;
  }
}

_validateEnhancementData(type, data) {
  if (!data) {
    throw new AppError(`No data received for ${type}`, ErrorTypes.VALIDATION);
  }

  switch (type) {
    case 'objections':
      if (!data.categories || !Array.isArray(data.categories)) {
        throw new AppError('Invalid objections data structure', ErrorTypes.VALIDATION);
      }
      break;
    case 'executive-summary':
      if (!data.headline || !data.tldr) {
        throw new AppError('Invalid executive summary data structure', ErrorTypes.VALIDATION);
      }
      break;
    case 'talking-points':
      if (!data.slides || !Array.isArray(data.slides)) {
        throw new AppError('Invalid talking points data structure', ErrorTypes.VALIDATION);
      }
      break;
    case 'meeting-analysis':
      if (!data.sections || !Array.isArray(data.sections)) {
        throw new AppError('Invalid meeting analysis data structure', ErrorTypes.VALIDATION);
      }
      break;
  }
}
```

### 4. SidebarNav Updates

Modify `/Public/components/SidebarNav.js`:

```javascript
// Add to constructor, after existing navItems
this.navItems = [
  {
    id: 'roadmap',
    title: 'Roadmap',
    subtitle: 'Gantt Chart View',
    icon: this._getRoadmapIcon()
  },
  {
    id: 'document',
    title: 'Document',
    subtitle: 'Article View',
    icon: this._getDocumentIcon()
  },
  {
    id: 'slides',
    title: 'Slides',
    subtitle: 'Presentation View',
    icon: this._getSlidesIcon()
  },
  {
    id: 'research-analysis',
    title: 'Research QA',
    subtitle: 'Research Quality',
    icon: this._getAnalysisIcon()
  },
  // NEW ITEMS
  {
    id: 'objections',
    title: 'Objections',
    subtitle: 'Client Pushback Prep',
    icon: this._getObjectionsIcon()
  },
  {
    id: 'meeting-optimizer',
    title: 'Timing',
    subtitle: 'Duration Optimizer',
    icon: this._getTimingIcon()
  }
];

// Add new icon methods (add before closing brace of class)

_getObjectionsIcon() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 8v4"></path>
      <path d="M12 16h.01"></path>
    </svg>
  `;
}

_getTimingIcon() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  `;
}
```

---

## Feature 1: Objection Anticipator

### Prompt File: `/server/prompts/objections.js`

```javascript
/**
 * Objection Anticipator - Sales Meeting Preparation
 * Generates likely client objections with recommended responses
 */

export const objectionsSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "One-sentence summary of the proposal's risk profile from a client perspective"
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
            enum: ["low", "medium", "high"],
            description: "How likely objections in this category will arise"
          },
          objections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                objection: {
                  type: "string",
                  description: "The client objection phrased exactly as they would say it"
                },
                likelihood: {
                  type: "string",
                  enum: ["very_likely", "likely", "possible"]
                },
                stakeholder: {
                  type: "string",
                  description: "Role most likely to raise this (CFO, CTO, CEO, COO, etc.)"
                },
                response: {
                  type: "string",
                  description: "Recommended consultant response (2-3 sentences, confident but not dismissive)"
                },
                evidence: {
                  type: "string",
                  description: "Supporting data point or proof to cite from the research"
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
      description: "3-5 actionable preparation tips for the meeting"
    }
  },
  required: ["summary", "categories", "prepTips"]
};

export const OBJECTIONS_SYSTEM_PROMPT = `You are a seasoned management consultant with 20 years of experience preparing partners for client sales meetings. Your specialty is anticipating client pushback and preparing confident, evidence-backed responses.

## Your Task
Analyze the proposal content and generate likely client objections organized by category. For each objection:
1. Phrase it exactly as a skeptical client would say it (use their language, not consultant-speak)
2. Identify which stakeholder role typically raises this concern
3. Provide a confident, evidence-backed response that acknowledges the concern
4. Include a specific proof point from the research when available

## Objection Categories
- **Budget & ROI**: Cost concerns, unclear value proposition, competing budget priorities
- **Timeline & Feasibility**: Timeline too aggressive or too slow, resource constraints, dependencies
- **Methodology & Approach**: Why this approach vs. alternatives? What's the track record?
- **Risk & Mitigation**: What could go wrong? What are the contingency plans?
- **Alternatives & Competition**: Why not do this internally? Why not use [competitor]?
- **Team & Resources**: Who will do the work? What's the commitment required from us?

## Risk Level Guidelines
- **High**: Multiple stakeholders likely to raise; could derail the deal without good response
- **Medium**: Will come up; need solid response but manageable with preparation
- **Low**: Might come up; good to be prepared but not critical

## Response Style
- Lead with acknowledgment: "That's a fair concern..." or "I understand why you'd ask that..."
- Pivot to value or evidence within the same breath
- End with forward momentum, not defensiveness
- Keep responses to 2-3 sentences maximum - enough to be credible, short enough to invite dialogue

## Quality Standards
- Generate 8-12 total objections across categories
- At least 2 objections marked "very_likely"
- Include at least one objection per major proposal phase/workstream
- Prep tips should be specific and actionable, not generic advice`;

export function generateObjectionsPrompt(roadmapData, documentData, researchContent) {
  const swimlanes = roadmapData?.timeColumns?.[0]?.swimlanes || [];
  const phases = swimlanes.map(s => `${s.name} (${s.tasks?.length || 0} tasks)`).join(', ');

  const execSummary = documentData?.executiveSummary;
  const summaryText = execSummary
    ? `Situation: ${execSummary.situation || 'N/A'}\nInsight: ${execSummary.insight || 'N/A'}\nAction: ${execSummary.action || 'N/A'}`
    : 'Not available';

  const sections = documentData?.sections?.map(s => `- ${s.heading}: ${s.keyInsight || ''}`).join('\n') || 'Not available';

  return `${OBJECTIONS_SYSTEM_PROMPT}

## Proposal Context

**Phases/Workstreams**: ${phases || 'Not specified'}

**Executive Summary**:
${summaryText}

**Key Sections & Insights**:
${sections}

**Source Research** (for evidence points):
${researchContent?.substring(0, 10000) || 'Not available'}

Generate the objection analysis now. Ensure objections feel real - things actual executives would say in a meeting, not theoretical concerns.`;
}
```

### View Component: `/Public/components/views/ObjectionsView.js`

```javascript
/**
 * ObjectionsView Component
 * Displays anticipated client objections with expandable responses
 */

export class ObjectionsView {
  constructor(data = null, sessionId = null) {
    this.data = data;
    this.sessionId = sessionId;
    this.container = null;
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'objections-view';

    if (!this.data || !this.data.categories) {
      this.container.appendChild(this._renderEmptyState());
      return this.container;
    }

    // Header
    const header = document.createElement('header');
    header.className = 'objections-header';
    header.innerHTML = `
      <h1 class="objections-title">Anticipated Objections</h1>
      <p class="objections-summary">${this._escapeHtml(this.data.summary)}</p>
    `;
    this.container.appendChild(header);

    // Categories
    const categoriesContainer = document.createElement('div');
    categoriesContainer.className = 'objections-categories';

    this.data.categories.forEach(category => {
      categoriesContainer.appendChild(this._renderCategory(category));
    });

    this.container.appendChild(categoriesContainer);

    // Prep Tips
    if (this.data.prepTips?.length > 0) {
      this.container.appendChild(this._renderPrepTips());
    }

    return this.container;
  }

  _renderCategory(category) {
    const section = document.createElement('section');
    section.className = `objections-category risk-${category.riskLevel}`;

    const riskColors = {
      high: 'var(--color-error, #dc2626)',
      medium: 'var(--color-warning, #d97706)',
      low: 'var(--color-success, #059669)'
    };

    section.innerHTML = `
      <div class="category-header">
        <h2 class="category-name">${this._escapeHtml(category.name)}</h2>
        <span class="category-risk-badge" style="background: ${riskColors[category.riskLevel]}20; color: ${riskColors[category.riskLevel]}">
          ${category.riskLevel.toUpperCase()} RISK
        </span>
      </div>
      <div class="category-objections">
        ${category.objections.map(obj => this._renderObjection(obj)).join('')}
      </div>
    `;

    // Attach expand/collapse handlers
    section.querySelectorAll('.objection-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => this._toggleResponse(e));
    });

    return section;
  }

  _renderObjection(objection) {
    const likelihoodIcons = {
      very_likely: '<span class="likelihood-dot high" title="Very Likely"></span>',
      likely: '<span class="likelihood-dot medium" title="Likely"></span>',
      possible: '<span class="likelihood-dot low" title="Possible"></span>'
    };

    return `
      <div class="objection-card">
        <div class="objection-header">
          ${likelihoodIcons[objection.likelihood] || ''}
          <div class="objection-content">
            <p class="objection-text">"${this._escapeHtml(objection.objection)}"</p>
            <span class="objection-stakeholder">Likely from: ${this._escapeHtml(objection.stakeholder)}</span>
          </div>
        </div>

        <button class="objection-toggle" aria-expanded="false">
          Show response <span class="toggle-icon">▼</span>
        </button>

        <div class="objection-response" hidden>
          <div class="response-content">
            <p class="response-text">${this._escapeHtml(objection.response)}</p>
            ${objection.evidence ? `
              <div class="response-evidence">
                <strong>Evidence:</strong> ${this._escapeHtml(objection.evidence)}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  _renderPrepTips() {
    const section = document.createElement('section');
    section.className = 'prep-tips-section';

    section.innerHTML = `
      <h2 class="prep-tips-title">Meeting Preparation Tips</h2>
      <ul class="prep-tips-list">
        ${this.data.prepTips.map(tip => `
          <li class="prep-tip-item">
            <span class="prep-tip-icon">✓</span>
            <span class="prep-tip-text">${this._escapeHtml(tip)}</span>
          </li>
        `).join('')}
      </ul>
    `;

    return section;
  }

  _renderEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'objections-empty-state';
    empty.innerHTML = `
      <div class="empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 8v4M12 16h.01"></path>
        </svg>
      </div>
      <h2>No Objections Generated</h2>
      <p>Generate objections analysis after your roadmap and document are ready.</p>
      ${this.sessionId ? `
        <button class="generate-objections-btn" id="generate-objections-btn">
          Generate Objections
        </button>
      ` : ''}
    `;

    // Attach generate handler if sessionId present
    const btn = empty.querySelector('#generate-objections-btn');
    if (btn) {
      btn.addEventListener('click', () => this._handleGenerate());
    }

    return empty;
  }

  _toggleResponse(event) {
    const btn = event.currentTarget;
    const card = btn.closest('.objection-card');
    const response = card.querySelector('.objection-response');
    const icon = btn.querySelector('.toggle-icon');

    const isExpanded = btn.getAttribute('aria-expanded') === 'true';

    btn.setAttribute('aria-expanded', !isExpanded);
    response.hidden = isExpanded;
    icon.textContent = isExpanded ? '▼' : '▲';
    btn.innerHTML = btn.innerHTML.replace(
      isExpanded ? 'Hide response' : 'Show response',
      isExpanded ? 'Show response' : 'Hide response'
    );
  }

  async _handleGenerate() {
    const btn = this.container.querySelector('#generate-objections-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generating...';
    }

    try {
      const response = await fetch(`/api/content/${this.sessionId}/enhance/objections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.status === 'completed' && result.data) {
        this.data = result.data;
        // Re-render with new data
        const parent = this.container.parentNode;
        const newContainer = this.render();
        parent.replaceChild(newContainer, this.container);
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    } catch (error) {
      console.error('Objections generation failed:', error);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Retry Generation';
      }
      alert(`Failed to generate objections: ${error.message}`);
    }
  }

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

export default ObjectionsView;
```

### Styles: `/Public/styles/objections-view.css`

```css
/* Objections View Styles */
.objections-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.objections-header {
  margin-bottom: 2rem;
}

.objections-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--color-text-primary, #1a1a2e);
  margin-bottom: 0.5rem;
}

.objections-summary {
  color: var(--color-text-secondary, #64748b);
  font-size: 1rem;
  line-height: 1.6;
}

/* Categories */
.objections-categories {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.objections-category {
  background: var(--color-surface, #ffffff);
  border-radius: 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  overflow: hidden;
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: var(--color-surface-elevated, #f8fafc);
  border-bottom: 1px solid var(--color-border, #e2e8f0);
}

.category-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary, #1a1a2e);
  margin: 0;
}

.category-risk-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

/* Objection Cards */
.category-objections {
  padding: 0.5rem;
}

.objection-card {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  background: var(--color-background, #ffffff);
  transition: background 0.15s ease;
}

.objection-card:hover {
  background: var(--color-surface-hover, #f1f5f9);
}

.objection-header {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.likelihood-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 0.35rem;
}

.likelihood-dot.high { background: #dc2626; }
.likelihood-dot.medium { background: #d97706; }
.likelihood-dot.low { background: #059669; }

.objection-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text-primary, #1a1a2e);
  margin: 0 0 0.25rem 0;
  font-style: italic;
}

.objection-stakeholder {
  font-size: 0.875rem;
  color: var(--color-text-muted, #94a3b8);
}

.objection-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: none;
  color: var(--color-primary, #3b82f6);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.objection-toggle:hover {
  background: var(--color-primary-light, #eff6ff);
}

.toggle-icon {
  font-size: 0.75rem;
  transition: transform 0.2s ease;
}

/* Response Section */
.objection-response {
  margin-top: 0.75rem;
  padding: 1rem;
  background: var(--color-surface-elevated, #f8fafc);
  border-radius: 8px;
  border-left: 3px solid var(--color-primary, #3b82f6);
}

.response-text {
  color: var(--color-text-primary, #1a1a2e);
  line-height: 1.6;
  margin: 0 0 0.75rem 0;
}

.response-evidence {
  font-size: 0.875rem;
  color: var(--color-primary, #3b82f6);
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border, #e2e8f0);
}

/* Prep Tips */
.prep-tips-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: var(--color-info-light, #eff6ff);
  border-radius: 12px;
}

.prep-tips-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-info, #2563eb);
  margin: 0 0 1rem 0;
}

.prep-tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.prep-tip-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.5rem 0;
}

.prep-tip-icon {
  color: var(--color-info, #2563eb);
  font-weight: 600;
}

.prep-tip-text {
  color: var(--color-info-dark, #1e40af);
  line-height: 1.5;
}

/* Empty State */
.objections-empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.objections-empty-state .empty-icon {
  margin-bottom: 1.5rem;
  color: var(--color-text-muted, #94a3b8);
}

.objections-empty-state h2 {
  font-size: 1.25rem;
  color: var(--color-text-primary, #1a1a2e);
  margin: 0 0 0.5rem 0;
}

.objections-empty-state p {
  color: var(--color-text-secondary, #64748b);
  margin: 0 0 1.5rem 0;
}

.generate-objections-btn {
  padding: 0.75rem 1.5rem;
  background: var(--color-primary, #3b82f6);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.generate-objections-btn:hover {
  background: var(--color-primary-dark, #2563eb);
}

.generate-objections-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

---

## Feature 2: Executive Summary Generator

### Prompt File: `/server/prompts/executive-summary.js`

```javascript
/**
 * Executive Summary Generator
 * Creates standalone, shareable executive summaries with configurable length
 */

export const executiveSummarySchema = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "Bold, action-oriented headline (8-12 words) that captures the core message"
    },
    tldr: {
      type: "string",
      description: "One sentence a busy executive could tweet - the absolute essence"
    },
    situationContext: {
      type: "string",
      description: "Current state and why action is needed (2-3 sentences with specifics)"
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
          benefit: { type: "string", description: "The benefit statement" },
          metric: { type: "string", description: "Quantified impact if available" }
        },
        required: ["benefit"]
      },
      description: "3-5 key benefits with metrics where possible"
    },
    investmentRange: {
      type: "string",
      description: "Investment framing (e.g., '$X-Y over Z months') - optional"
    },
    timelineHighlight: {
      type: "string",
      description: "Key timeline message (e.g., 'First results in 6 weeks')"
    },
    callToAction: {
      type: "string",
      description: "Clear, specific next step (e.g., 'Schedule a 30-minute discovery call')"
    },
    wordCount: {
      type: "integer",
      description: "Actual word count of the generated summary content"
    }
  },
  required: ["headline", "tldr", "situationContext", "proposedSolution", "keyBenefits", "callToAction", "wordCount"]
};

export const EXEC_SUMMARY_SYSTEM_PROMPT = `You are an expert at distilling complex consulting proposals into compelling executive summaries that drive action.

## Writing Principles
1. **Lead with impact**: What changes for the client? Why should they care?
2. **Be specific**: Numbers, timelines, outcomes > vague promises
3. **Respect their time**: Every word must earn its place
4. **Create momentum**: End with a clear, low-friction next step

## Tone Guidelines
- Confident but not arrogant
- Specific but not technical
- Urgent but not pushy
- Professional but human

## Length Guidance
Target the requested word count:
- 100 words: Headline + TL;DR + 3 benefit bullets + CTA only
- 250 words: Full structure with tight prose
- 500 words: Full structure with supporting detail and context`;

export function generateExecSummaryPrompt(documentData, roadmapData, targetWords = 250) {
  const swimlanes = roadmapData?.timeColumns?.[0]?.swimlanes || [];
  const phaseSummary = swimlanes.map(s => `- ${s.name}: ${s.tasks?.length || 0} activities`).join('\n');

  const existingSummary = documentData?.executiveSummary;
  const existingSummaryText = existingSummary
    ? `Situation: ${existingSummary.situation || 'N/A'}\nInsight: ${existingSummary.insight || 'N/A'}\nAction: ${existingSummary.action || 'N/A'}`
    : 'Not available';

  const sections = documentData?.sections?.slice(0, 5).map(s =>
    `### ${s.heading}\n${s.keyInsight || ''}\n${s.paragraphs?.[0] || ''}`
  ).join('\n\n') || 'Not available';

  return `${EXEC_SUMMARY_SYSTEM_PROMPT}

## Target Word Count: ${targetWords} words

## Source Content

**Current Executive Summary** (enhance this):
${existingSummaryText}

**Roadmap Phases**:
${phaseSummary || 'Not specified'}

**Document Sections** (extract key points):
${sections}

Generate a standalone executive summary targeting ${targetWords} words. Make it compelling enough to share with a C-suite executive who has 2 minutes to read it.`;
}
```

### Integration with DocumentView

Add to `/Public/components/views/DocumentView.js`:

```javascript
// Add to _createDocumentMenu() method, after exportWordItem

// Executive Summary Generator
const genExecSummaryItem = this._createDocMenuItem({
  id: 'gen-exec-summary-btn',
  icon: '✨',
  text: 'Generate Executive Summary',
  ariaLabel: 'Generate standalone executive summary'
});
genExecSummaryItem.addEventListener('click', () => this._showExecSummaryPanel());
dropdown.appendChild(genExecSummaryItem);


// Add new methods to DocumentView class

_showExecSummaryPanel() {
  // Remove existing panel if present
  const existing = this.container.querySelector('.exec-summary-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.className = 'exec-summary-panel';
  panel.innerHTML = `
    <div class="exec-summary-panel-header">
      <h3>Generate Executive Summary</h3>
      <button class="panel-close" aria-label="Close">&times;</button>
    </div>
    <div class="exec-summary-panel-body">
      <div class="exec-summary-options">
        <label>Word Count Target:</label>
        <div class="word-count-options">
          <button class="word-count-btn" data-words="100">100 words</button>
          <button class="word-count-btn active" data-words="250">250 words</button>
          <button class="word-count-btn" data-words="500">500 words</button>
        </div>
      </div>
      <button class="exec-summary-generate-btn">Generate</button>
      <div class="exec-summary-result"></div>
    </div>
  `;

  // Insert after document header
  const header = this.container.querySelector('.document-header');
  if (header) {
    header.after(panel);
  } else {
    this.container.prepend(panel);
  }

  // Attach handlers
  panel.querySelector('.panel-close').addEventListener('click', () => panel.remove());

  panel.querySelectorAll('.word-count-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      panel.querySelectorAll('.word-count-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    });
  });

  panel.querySelector('.exec-summary-generate-btn').addEventListener('click', () => {
    const activeBtn = panel.querySelector('.word-count-btn.active');
    const targetWords = parseInt(activeBtn?.dataset.words || '250');
    this._generateExecSummary(panel, targetWords);
  });
}

async _generateExecSummary(panel, targetWords) {
  const generateBtn = panel.querySelector('.exec-summary-generate-btn');
  const resultDiv = panel.querySelector('.exec-summary-result');

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating...';
  resultDiv.innerHTML = '<p class="loading">Generating executive summary...</p>';

  try {
    const response = await fetch(`/api/content/${this.sessionId}/enhance/executive-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetWords })
    });

    const result = await response.json();

    if (result.status === 'completed' && result.data) {
      resultDiv.innerHTML = this._renderExecSummaryResult(result.data);
    } else {
      throw new Error(result.error || 'Generation failed');
    }
  } catch (error) {
    resultDiv.innerHTML = `<p class="error">Failed: ${error.message}</p>`;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Regenerate';
  }
}

_renderExecSummaryResult(data) {
  return `
    <div class="exec-summary-content">
      <div class="exec-summary-header-row">
        <h2 class="exec-headline">${this._escapeHtml(data.headline)}</h2>
        <span class="word-count-badge">${data.wordCount} words</span>
      </div>

      <p class="exec-tldr">${this._escapeHtml(data.tldr)}</p>

      <div class="exec-sections">
        <div class="exec-section">
          <h4>The Situation</h4>
          <p>${this._escapeHtml(data.situationContext)}</p>
        </div>
        <div class="exec-section">
          <h4>Our Approach</h4>
          <p>${this._escapeHtml(data.proposedSolution)}</p>
        </div>
      </div>

      <div class="exec-benefits">
        <h4>Key Benefits</h4>
        <ul>
          ${data.keyBenefits.map(b => `
            <li>
              ${this._escapeHtml(b.benefit)}
              ${b.metric ? `<span class="benefit-metric">(${this._escapeHtml(b.metric)})</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="exec-footer">
        ${data.investmentRange ? `<span><strong>Investment:</strong> ${this._escapeHtml(data.investmentRange)}</span>` : ''}
        ${data.timelineHighlight ? `<span><strong>Timeline:</strong> ${this._escapeHtml(data.timelineHighlight)}</span>` : ''}
      </div>

      <div class="exec-cta">
        <strong>Next Step:</strong> ${this._escapeHtml(data.callToAction)}
      </div>

      <div class="exec-actions">
        <button class="copy-exec-summary-btn" onclick="navigator.clipboard.writeText(this.closest('.exec-summary-content').innerText)">
          Copy to Clipboard
        </button>
      </div>
    </div>
  `;
}

_escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

---

## Feature 3: Talking Points Export

### Prompt File: `/server/prompts/talking-points.js`

```javascript
/**
 * Talking Points Generator
 * Creates presenter-friendly verbal notes for each slide
 */

export const talkingPointsSchema = {
  type: "object",
  properties: {
    meetingContext: {
      type: "object",
      properties: {
        totalDuration: { type: "string", description: "e.g., '25-30 minutes'" },
        audienceLevel: { type: "string", description: "e.g., 'Executive', 'Technical'" },
        keyObjective: { type: "string", description: "What success looks like" }
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
            description: "Exact words to say when slide appears - never start with 'So, on this slide...'"
          },
          keyPoints: {
            type: "array",
            items: { type: "string" },
            description: "3-5 verbal talking points - conversational, not slide text"
          },
          probeQuestions: {
            type: "array",
            items: { type: "string" },
            description: "1-2 questions to ask the audience for engagement"
          },
          transitionToNext: {
            type: "string",
            description: "Bridge phrase connecting to next slide's topic"
          },
          ifAsked: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" }
              },
              required: ["question", "answer"]
            },
            description: "2-3 likely questions with prepared answers"
          }
        },
        required: ["slideNumber", "slideTitle", "keyPoints", "transitionToNext"]
      }
    },
    closingScript: {
      type: "string",
      description: "Final 2-3 sentences to close the presentation with impact"
    }
  },
  required: ["slides", "closingScript"]
};

export const TALKING_POINTS_SYSTEM_PROMPT = `You are a presentation coach for top-tier management consultants. Transform slide content into compelling verbal delivery scripts.

## Core Principles
1. **Slides are not scripts**: Talking points ADD to what's on screen, never repeat it
2. **Conversational tone**: Write for speaking, not reading
3. **Strategic pauses**: Include "[pause]" where emphasis matters
4. **Audience engagement**: Include probe questions to create dialogue

## Talking Point Style
- Use "you" and "your" language (client-centric)
- Lead with "so what" before details
- Use analogies and concrete examples
- Keep each point to 1-2 sentences when spoken

## Opening Lines (NEVER start with these)
- "So, on this slide..."
- "What we're looking at here is..."
- "This slide shows..."

## Good Opening Lines
- "Here's where things get interesting..."
- "The data surprised us too..."
- "This is the question we kept hearing..."
- "Let me share what [Company X] discovered..."

## Transitions
Connect the WHY, not just the WHAT:
- "Now that we've seen the challenge, let's look at our approach..."
- "These capabilities are great, but you're wondering about timeline..."
- "Before we dive into implementation, let me address the elephant in the room..."`;

export function generateTalkingPointsPrompt(slidesData) {
  const slideList = slidesData.sections?.flatMap((section, sIdx) =>
    section.slides?.map((slide, slideIdx) => `
Slide ${sIdx + slideIdx + 1}: ${slide.title || section.title}
Layout: ${slide.layout || 'unknown'}
Content: ${JSON.stringify(slide.content || slide).substring(0, 500)}
`) || []
  ).join('\n---\n') || 'No slides available';

  return `${TALKING_POINTS_SYSTEM_PROMPT}

## Slides to Script (${slidesData.sections?.reduce((acc, s) => acc + (s.slides?.length || 0), 0) || 0} total)

${slideList}

Generate talking points for each slide with:
1. A strong opening line
2. 3-5 verbal key points (what to SAY, not what's ON the slide)
3. 1-2 probe questions for audience engagement
4. A transition to the next slide
5. 2-3 "if asked" Q&As for common questions`;
}
```

### DOCX Export: Add to `/server/templates/docx-export-service.js`

```javascript
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export async function generateTalkingPointsDocx(talkingPointsData) {
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
    const ctx = talkingPointsData.meetingContext;
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Duration: ', bold: true }),
          new TextRun(ctx.totalDuration || 'TBD'),
          new TextRun('  |  '),
          new TextRun({ text: 'Audience: ', bold: true }),
          new TextRun(ctx.audienceLevel || 'TBD'),
          new TextRun('  |  '),
          new TextRun({ text: 'Objective: ', bold: true }),
          new TextRun(ctx.keyObjective || 'TBD')
        ],
        spacing: { after: 400 }
      })
    );
  }

  // Each slide
  for (const slide of (talkingPointsData.slides || [])) {
    // Slide header
    children.push(
      new Paragraph({
        text: `Slide ${slide.slideNumber}: ${slide.slideTitle}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    );

    // Duration
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

    // Key points
    children.push(
      new Paragraph({
        text: 'Key Points:',
        bold: true,
        spacing: { after: 100 }
      })
    );

    for (const point of (slide.keyPoints || [])) {
      children.push(
        new Paragraph({
          text: `• ${point}`,
          spacing: { after: 80 },
          indent: { left: 360 }
        })
      );
    }

    // Probe questions
    if (slide.probeQuestions?.length > 0) {
      children.push(
        new Paragraph({
          text: 'Ask the Audience:',
          bold: true,
          color: '006600',
          spacing: { before: 150, after: 100 }
        })
      );
      for (const q of slide.probeQuestions) {
        children.push(
          new Paragraph({
            text: `→ "${q}"`,
            indent: { left: 360 },
            spacing: { after: 80 }
          })
        );
      }
    }

    // Transition
    if (slide.transitionToNext) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'TRANSITION: ', bold: true, color: '009900' }),
            new TextRun({ text: `"${slide.transitionToNext}"`, italics: true })
          ],
          spacing: { before: 150, after: 100 }
        })
      );
    }

    // If Asked
    if (slide.ifAsked?.length > 0) {
      children.push(
        new Paragraph({
          text: 'If Asked:',
          bold: true,
          color: '990000',
          spacing: { before: 150, after: 100 }
        })
      );

      for (const qa of slide.ifAsked) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `Q: ${qa.question}`, bold: true })],
            indent: { left: 360 },
            spacing: { after: 50 }
          }),
          new Paragraph({
            children: [new TextRun({ text: `A: ${qa.answer}` })],
            indent: { left: 360 },
            spacing: { after: 120 }
          })
        );
      }
    }
  }

  // Closing script
  if (talkingPointsData.closingScript) {
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
  }

  const doc = new Document({
    sections: [{ children }]
  });

  return await Packer.toBuffer(doc);
}
```

### Export Route: Add to `/server/routes/content.js`

```javascript
import { generateTalkingPointsDocx } from '../templates/docx-export-service.js';

router.get('/:sessionId/talking-points/export', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const talkingPoints = session.enhancements?.['talking-points'];
    if (!talkingPoints?.success) {
      return res.status(400).json({ error: 'Generate talking points first' });
    }

    const buffer = await generateTalkingPointsDocx(talkingPoints.data);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Talking_Points.docx"');
    res.send(buffer);
  } catch (error) {
    console.error('Talking points export failed:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});
```

---

## Feature 4: Meeting Duration Optimizer

### Prompt File: `/server/prompts/meeting-optimizer.js`

```javascript
/**
 * Meeting Duration Optimizer
 * Analyzes content against meeting time constraints
 */

export const meetingOptimizerSchema = {
  type: "object",
  properties: {
    requestedDuration: { type: "integer", description: "Target minutes" },
    estimatedDuration: { type: "integer", description: "Estimated actual minutes" },
    status: {
      type: "string",
      enum: ["on_track", "slightly_over", "significantly_over", "under_time"]
    },
    summary: { type: "string", description: "One-sentence assessment" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          slideCount: { type: "integer" },
          estimatedMinutes: { type: "integer" },
          status: {
            type: "string",
            enum: ["ok", "compress", "expand", "cut_candidate"]
          },
          recommendation: { type: "string" }
        },
        required: ["name", "estimatedMinutes", "status", "recommendation"]
      }
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
    }
  },
  required: ["requestedDuration", "estimatedDuration", "status", "sections", "pacingTips"]
};

export const MEETING_OPTIMIZER_SYSTEM_PROMPT = `You are a presentation timing expert. Analyze content against meeting duration constraints.

## Timing Estimation Rules
- Title/section slides: 30-60 seconds
- Simple content slides: 2 minutes
- Data-heavy slides: 3-4 minutes
- Discussion slides: 3-5 minutes
- Add 20% buffer for Q&A and transitions

## Status Thresholds
- on_track: Within 10% of target
- slightly_over: 10-25% over
- significantly_over: >25% over
- under_time: >20% under target

## Cut Prioritization
1. NEVER cut: Executive summary, key recommendations, pricing, next steps
2. CUT FIRST: Background context, detailed methodology, appendix
3. COMPRESS: Detailed sections can become highlights`;

export function generateMeetingOptimizerPrompt(slidesData, roadmapData, targetMinutes) {
  const sections = slidesData.sections?.map((s, i) => ({
    name: s.title || `Section ${i + 1}`,
    slideCount: s.slides?.length || 0
  })) || [];

  const sectionSummary = sections.map(s => `- ${s.name}: ${s.slideCount} slides`).join('\n');
  const totalSlides = sections.reduce((acc, s) => acc + s.slideCount, 0);

  return `${MEETING_OPTIMIZER_SYSTEM_PROMPT}

## Target Duration: ${targetMinutes} minutes
## Total Slides: ${totalSlides}

## Sections:
${sectionSummary}

Analyze timing and provide optimization recommendations.`;
}
```

### View Component: `/Public/components/views/MeetingOptimizerView.js`

```javascript
/**
 * MeetingOptimizerView Component
 * Displays meeting duration analysis and recommendations
 */

export class MeetingOptimizerView {
  constructor(data = null, sessionId = null) {
    this.data = data;
    this.sessionId = sessionId;
    this.container = null;
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'meeting-optimizer-view';

    // Header with duration selector
    const header = document.createElement('header');
    header.className = 'optimizer-header';
    header.innerHTML = `
      <h1>Meeting Duration Optimizer</h1>
      <div class="optimizer-controls">
        <label>Target Duration:</label>
        <select id="duration-select" class="duration-select">
          <option value="15">15 minutes</option>
          <option value="30" selected>30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">60 minutes</option>
          <option value="90">90 minutes</option>
        </select>
        <button id="analyze-btn" class="analyze-btn">Analyze</button>
      </div>
    `;
    this.container.appendChild(header);

    // Results area
    const results = document.createElement('div');
    results.id = 'optimizer-results';
    results.className = 'optimizer-results';

    if (this.data) {
      results.innerHTML = this._renderResults(this.data);
    } else {
      results.innerHTML = this._renderEmptyState();
    }

    this.container.appendChild(results);

    // Attach handlers
    this._attachEventListeners();

    return this.container;
  }

  _renderResults(data) {
    const statusConfig = {
      on_track: { label: 'On Track', class: 'status-success' },
      slightly_over: { label: 'Slightly Over', class: 'status-warning' },
      significantly_over: { label: 'Significantly Over', class: 'status-error' },
      under_time: { label: 'Under Time', class: 'status-info' }
    };

    const status = statusConfig[data.status] || statusConfig.on_track;

    return `
      <div class="optimizer-content">
        <!-- Status Banner -->
        <div class="status-banner ${status.class}">
          <div class="status-info">
            <span class="status-label">${status.label}</span>
            <p class="status-summary">${this._escapeHtml(data.summary)}</p>
          </div>
          <div class="status-time">
            <span class="time-estimate">${data.estimatedDuration} min</span>
            <span class="time-target">Target: ${data.requestedDuration} min</span>
          </div>
        </div>

        <!-- Section Breakdown -->
        <section class="sections-breakdown">
          <h2>Section Breakdown</h2>
          <table class="sections-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Slides</th>
                <th>Est. Time</th>
                <th>Status</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              ${data.sections.map(s => `
                <tr class="section-row ${s.status === 'cut_candidate' ? 'cut-candidate' : ''}">
                  <td class="section-name">${this._escapeHtml(s.name)}</td>
                  <td class="section-slides">${s.slideCount || '-'}</td>
                  <td class="section-time">${s.estimatedMinutes} min</td>
                  <td><span class="section-status section-status-${s.status}">${s.status.replace('_', ' ')}</span></td>
                  <td class="section-rec">${this._escapeHtml(s.recommendation)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>

        <!-- Cut Candidates -->
        ${data.cutCandidates?.length > 0 ? `
          <section class="cut-candidates">
            <h2>Suggested Cuts</h2>
            <div class="cut-list">
              ${data.cutCandidates.map(c => `
                <div class="cut-item">
                  <div class="cut-info">
                    <span class="cut-name">${this._escapeHtml(c.item)}</span>
                    <span class="cut-rationale">${this._escapeHtml(c.rationale)}</span>
                  </div>
                  <div class="cut-savings">
                    <span class="savings-time">-${c.minutesSaved} min</span>
                    <span class="savings-impact impact-${c.impact}">Impact: ${c.impact}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <!-- Pacing Tips -->
        <section class="pacing-tips">
          <h2>Pacing Tips</h2>
          <ul class="tips-list">
            ${data.pacingTips.map(tip => `
              <li class="tip-item">${this._escapeHtml(tip)}</li>
            `).join('')}
          </ul>
        </section>
      </div>
    `;
  }

  _renderEmptyState() {
    return `
      <div class="optimizer-empty">
        <p>Select a meeting duration and click "Analyze" to optimize your presentation timing.</p>
      </div>
    `;
  }

  _attachEventListeners() {
    const analyzeBtn = this.container.querySelector('#analyze-btn');
    const durationSelect = this.container.querySelector('#duration-select');
    const results = this.container.querySelector('#optimizer-results');

    analyzeBtn?.addEventListener('click', async () => {
      const targetMinutes = parseInt(durationSelect.value);

      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Analyzing...';
      results.innerHTML = '<p class="loading">Analyzing presentation timing...</p>';

      try {
        const response = await fetch(`/api/content/${this.sessionId}/enhance/meeting-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetMinutes })
        });

        const result = await response.json();

        if (result.status === 'completed' && result.data) {
          this.data = result.data;
          results.innerHTML = this._renderResults(result.data);
        } else {
          throw new Error(result.error || 'Analysis failed');
        }
      } catch (error) {
        results.innerHTML = `<p class="error">Analysis failed: ${error.message}</p>`;
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze';
      }
    });
  }

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

export default MeetingOptimizerView;
```

---

## Feature 5: Competitive Positioning

### Prompt Context Injection: `/server/prompts/competitive-context.js`

```javascript
/**
 * Competitive Context Injection
 * Modifies existing prompts to include competitive differentiation
 */

export function injectCompetitiveContext(basePrompt, settings = {}) {
  const { competitors = [], differentiators = [] } = settings;

  if (!competitors.length && !differentiators.length) {
    return basePrompt;
  }

  const competitorSection = competitors.length > 0 ? `

## Competitive Context
The client is also considering these alternatives:
${competitors.map(c => `
**${c.name}**
${c.strengths?.length ? `- Known strengths: ${c.strengths.join(', ')}` : ''}
${c.weaknesses?.length ? `- Known weaknesses: ${c.weaknesses.join(', ')}` : ''}
`).join('\n')}

When relevant, subtly differentiate our approach. Don't attack competitors directly - position our strengths where they have gaps.
` : '';

  const differentiatorSection = differentiators.length > 0 ? `

## Our Key Differentiators
Weave these proof points into the narrative where natural:
${differentiators.map((d, i) => `${i + 1}. ${d}`).join('\n')}
` : '';

  return `${basePrompt}
${competitorSection}
${differentiatorSection}`;
}
```

### Session Settings Storage

Modify `/server/routes/content.js` POST `/generate`:

```javascript
router.post('/generate', uploadMiddleware.array('researchFiles'), async (req, res) => {
  try {
    const { prompt } = req.body;

    // Parse project settings (includes competitors, differentiators)
    let settings = {};
    if (req.body.settings) {
      try {
        settings = JSON.parse(req.body.settings);
      } catch (e) {
        console.warn('Failed to parse settings:', e);
      }
    }

    const sessionId = crypto.randomUUID();
    const now = Date.now();

    // Store research files for later enhancement generation
    const researchFiles = req.files?.map(file => ({
      filename: file.originalname,
      content: file.buffer.toString('utf-8')
    })) || [];

    const sessionData = {
      prompt,
      settings,  // Store competitive settings
      researchFiles,  // Store for enhancements
      content: {
        roadmap: { success: false, data: null },
        slides: { success: false, data: null },
        document: { success: false, data: null },
        'research-analysis': { success: false, data: null }
      },
      enhancements: {},
      createdAt: now,
      lastAccessed: now
    };

    sessions.set(sessionId, sessionData);

    // Pass settings to generators
    const results = await generateAllContent(prompt, researchFiles, settings);

    // Update session with results
    sessionData.content = results;

    res.json({
      status: 'completed',
      sessionId,
      content: results
    });
  } catch (error) {
    console.error('Generation failed:', error);
    res.status(500).json({ error: 'Generation failed', details: error.message });
  }
});
```

### Modify Generators to Accept Settings

In `/server/generators.js`, modify `generateAllContent`:

```javascript
import { injectCompetitiveContext } from './prompts/competitive-context.js';

export async function generateAllContent(userPrompt, researchFiles, settings = {}) {
  // Inject competitive context into prompts that support it
  const enhancedSettings = {
    ...settings,
    injectContext: (prompt) => injectCompetitiveContext(prompt, settings)
  };

  // Phase 1: Roadmap + Slides Outline (parallel)
  // ... existing code, but pass settings to generators

  // For slides: Auto-add "Why Us" slide if competitors defined
  if (settings.competitors?.length > 0 || settings.differentiators?.length > 0) {
    // The slides prompt will include instruction to add differentiation slide
  }

  // ... rest of existing logic
}
```

---

## Implementation Order

| Day | Focus | Deliverables |
|-----|-------|--------------|
| **Day 1** | Shared Infrastructure | Enhancement pattern in generators.js, unified route, StateManager updates |
| **Day 2** | Objections | Prompt, schema, generator, ObjectionsView, styles |
| **Day 3** | Executive Summary | Prompt, schema, generator, DocumentView integration |
| **Day 4** | Talking Points | Prompt, schema, generator, DOCX export, SlidesView integration |
| **Day 5** | Meeting Optimizer | Prompt, schema, generator, MeetingOptimizerView, styles |
| **Day 6** | Competitive Positioning | Context injection, settings storage, frontend settings form |
| **Day 7** | SidebarNav + Integration | Add nav items, register views, test navigation flow |
| **Day 8-9** | Testing + Polish | Unit tests, integration tests, UX refinements |

---

## Testing Strategy

### Unit Tests

```javascript
// tests/generators/enhancements.test.js
describe('Enhancement Generators', () => {
  describe('generateEnhancement', () => {
    it('returns error for missing dependencies', async () => {
      const sessionData = { content: { roadmap: null, document: null } };
      const result = await generateEnhancement('objections', sessionData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Requires');
    });

    it('generates objections with valid session', async () => {
      const sessionData = mockSessionWithContent();
      const result = await generateEnhancement('objections', sessionData);
      expect(result.success).toBe(true);
      expect(result.data.categories).toBeDefined();
    });
  });
});
```

### Integration Tests

```javascript
// tests/routes/enhancements.test.js
describe('Enhancement Routes', () => {
  let sessionId;

  beforeAll(async () => {
    // Create session with generated content
    const response = await request(app)
      .post('/api/content/generate')
      .attach('researchFiles', 'tests/fixtures/sample.docx')
      .field('prompt', 'Test proposal');
    sessionId = response.body.sessionId;
  });

  it('POST /:sessionId/enhance/objections generates objections', async () => {
    const response = await request(app)
      .post(`/api/content/${sessionId}/enhance/objections`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('completed');
    expect(response.body.data.categories.length).toBeGreaterThan(0);
  });

  it('GET /:sessionId/enhance/objections returns cached data', async () => {
    const response = await request(app)
      .get(`/api/content/${sessionId}/enhance/objections`);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });
});
```

---

## Summary

This revised plan corrects the 7 pattern misalignments identified in the review:

1. **Generator pattern**: Uses `generateWithGemini()` wrapper correctly
2. **APIQueue**: All Gemini calls go through `apiQueue.add()`
3. **Config structure**: Includes required `topP` and `topK` fields
4. **Phase integration**: Uses on-demand enhancement pattern, not Phase 3
5. **StateManager validation**: Includes `_validateEnhancementData()`
6. **SidebarNav icons**: Adds icon methods before referencing in navItems
7. **Unified route**: Single `/enhance/:type` endpoint pattern

The estimated effort remains **Low** with cleaner, more maintainable code through the unified enhancement pattern.
