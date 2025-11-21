# CLAUDE.md - AI Assistant Guide for AI Roadmap Generator

## Changelog

### Version 2.2.0 (2025-11-18) - Research Synthesis & Persistence Edition
- **MAJOR:** Cross-LLM Research Synthesis feature (8-step pipeline for multi-source analysis)
- **MAJOR:** Database persistence with SQLite (better-sqlite3)
- **Feature:** Research synthesis with claim extraction, contradiction detection, and provenance auditing
- **Feature:** Analytics & usage tracking with dashboard
- **Feature:** PDF file support for research uploads
- **Backend:** New modules: database.js (730 lines), prompts-research.js (744 lines)
- **Backend:** New routes: research.js (928 lines), analytics.js (157 lines)
- **Frontend:** New component: ResearchSynthesizer.js (1,836 lines)
- **Frontend:** New page: analytics.html for analytics dashboard
- **Dependencies:** Added better-sqlite3 (database), pdf-parse (PDF processing), chart.js (visualizations)
- **Architecture:** Hybrid storage (in-memory + SQLite for persistence)
- **Updated:** Codebase size metrics (backend: 6,409 lines, frontend: 10,620 lines)

### Version 2.1.0 (2025-11-18) - Testing Infrastructure Edition
- **MAJOR:** Comprehensive testing infrastructure implemented
- **Testing:** Jest 30.2.0 framework with ES module support
- **Testing:** 124 tests created (69 passing, focused on security)
- **Testing:** 100% coverage on critical security module (server/utils.js)
- **Testing:** Unit tests for storage, middleware, and utilities
- **Testing:** Integration tests for API routes (charts, analysis)
- **Testing:** Test scripts added to package.json (test, test:watch, test:unit, test:integration)
- **Configuration:** jest.config.js and jest.setup.js created
- **Configuration:** .env.test file for test environment
- **Documentation:** 5 new testing documentation files
- **Updated:** Directory structure corrected (documentation in root, not Documentation/ folder)
- **Updated:** Codebase size metrics (backend: 3,043 lines, frontend: 11,923 lines)

### Version 2.0.0 (2025-11-18) - Banking Executive Edition
- **MAJOR:** Implemented 5 banking-specific enhancements (1,306 lines of new code)
- **Feature:** Financial Impact Dashboard with ROI, payback period, NPV calculations
- **Feature:** Regulatory Alert Icons (🏛️) on Gantt chart with summary box
- **Feature:** Executive Light Mode Theme for presentations (200+ CSS overrides)
- **Feature:** Competitive Intelligence section in Executive Summary
- **Feature:** Industry Benchmarks comparison (Time to Market, Investment Level, Risk Profile)
- **Enhancement:** Updated AI prompts for banking industry context
- **Enhancement:** Added localStorage persistence for theme preferences
- **Documentation:** Created BANKING_ENHANCEMENTS_TEST_SUMMARY.md (comprehensive test plan)
- **Updated:** Codebase size metrics (backend: 2,952 lines, frontend: 11,926 lines)

### Version 1.1.0 (2025-11-18)
- Updated all file line counts to reflect current codebase state
- Corrected directory structure (documentation files are in root, not Documentation/ folder)
- Added 3 new documentation files: UX/Banking enhancements, Analysis gaps, and Quick wins guide
- Updated codebase size metrics (backend: 2,879 lines, frontend: 10,620 lines)
- Added missing PHASE_5_ENHANCEMENTS.md and TASK_ANALYSIS_ENHANCEMENT_RECOMMENDATIONS.md

### Version 1.0.0 (2025-11-18)
- Initial comprehensive documentation created
- Full architecture, conventions, and development guide established

---

## Project Overview

**AI Roadmap Generator** is a sophisticated web application that transforms unstructured research documents into interactive, AI-powered Gantt charts with executive summaries and presentation slides.

### Core Functionality
1. **File Upload**: Users upload research files (.md, .txt, .docx, .pdf) with project instructions
2. **AI Processing**: Google Gemini AI analyzes content and generates structured JSON
3. **Interactive Visualization**: Dynamic Gantt chart with drag-to-edit, resize, and color customization
4. **Strategic Intelligence**: Auto-generated executive summaries and presentation slides
5. **Task Analysis**: Detailed analysis with Q&A chat for individual tasks

### Research Synthesis Edition (NEW - v2.2.0)
6. **Cross-LLM Research Synthesis**: 8-step pipeline for analyzing research from multiple AI sources (GEMINI, GPT, CLAUDE, GROK)
   - **Claim Extraction**: Automatically extract atomic claims from each source
   - **Contradiction Detection**: Identify conflicts in numerical data, polarity, definitions, and temporal information
   - **Provenance Auditing**: Verify citations and detect hallucinations
   - **Dashboard Analytics**: Visual breakdowns of consensus levels and citation quality
7. **Database Persistence**: SQLite storage for charts, sessions, and analytics (30-day retention)
8. **Usage Analytics**: Track exports, feature usage, and URL shares with dashboard visualization

### Banking Executive Edition (v2.0.0)
9. **Financial Impact Dashboard**: ROI, payback period, NPV calculations with confidence levels
10. **Regulatory Intelligence**: Visual alerts (🏛️) for compliance checkpoints (OCC, FDIC, Federal Reserve)
11. **Competitive Intelligence**: Market positioning, competitor moves, competitive advantage analysis
12. **Industry Benchmarks**: Time to market, investment level, and risk profile comparisons
13. **Executive Light Mode**: Presentation-optimized theme for client meetings and board presentations

### Key Innovation
Uses Gemini AI's JSON schema validation for structured output, enabling complex project visualizations from unstructured research with minimal user intervention. **Now enhanced with cross-LLM research synthesis for rigorous, cited insights and banking-specific intelligence** for strategic decision-making.

---

## Architecture

### Backend (Node.js + Express)

**Modular Design** - Refactored from monolithic 959-line server.js to 139 lines with specialized modules:

```
server.js (entry point, 139 lines)
├── server/config.js (configuration hub, 196 lines)
├── server/middleware.js (security, rate limiting, file uploads, 143 lines)
├── server/storage.js (in-memory state management, 310 lines)
├── server/database.js (SQLite persistence, 730 lines) [NEW v2.2.0]
├── server/gemini.js (AI API integration, 358 lines)
├── server/prompts.js (roadmap AI instructions, 1,671 lines)
├── server/prompts-research.js (research synthesis prompts, 744 lines) [NEW v2.2.0]
├── server/utils.js (sanitization, validation, 96 lines)
└── server/routes/
    ├── charts.js (chart generation, updates, 783 lines)
    ├── analysis.js (task analysis, Q&A, 154 lines)
    ├── research.js (research synthesis pipeline, 928 lines) [NEW v2.2.0]
    └── analytics.js (usage tracking, 157 lines) [NEW v2.2.0]
```

**Key Architectural Decisions**:
- **Async job processing**: Chart generation and research synthesis return jobId immediately, process in background
- **Hybrid storage**: In-memory Maps for active sessions + SQLite for persistent storage (30-day retention)
- **Database persistence**: Sessions, charts, jobs, and analytics stored in `roadmap.db` with WAL mode
- **Stateless API**: No authentication, session-based for research context only
- **ES6 modules**: `"type": "module"` in package.json, native import/export

### Frontend (Vanilla JavaScript + ES6 Modules)

**Component-Based Architecture** - No framework, pure ES6 classes:

```
index.html (upload + research synthesis)
├── main.js (file upload)
└── ResearchSynthesizer.js (8-step pipeline) [NEW v2.2.0]

chart.html (roadmap visualization)
└── chart-renderer.js (orchestrator)
    ├── GanttChart.js (main component)
    │   ├── DraggableGantt.js
    │   ├── ResizableGantt.js
    │   ├── ContextMenu.js
    │   ├── ExecutiveSummary.js
    │   ├── PresentationSlides.js
    │   └── HamburgerMenu.js
    ├── TaskAnalyzer.js
    │   └── ChatInterface.js
    ├── Router.js
    ├── Utils.js
    └── config.js

analytics.html (usage dashboard) [NEW v2.2.0]
```

**Design Patterns**:
- **Dependency injection**: Components receive dependencies via constructor
- **Event delegation**: Single listeners on containers, not individual elements
- **Hash routing**: `#roadmap`, `#executive-summary`, `#presentation`
- **Frozen configuration**: Immutable config objects via `Object.freeze()`

---

## Directory Structure

```
/home/user/Roadmap-master/
├── server.js                    # Entry point (134 lines)
├── package.json                 # Dependencies, ES6 module config, test scripts
├── jest.config.js               # Jest testing configuration
├── jest.setup.js                # Jest global setup
├── readme.md                    # User documentation
├── .env                         # Environment variables (gitignored)
├── .env.test                    # Test environment variables
│
├── server/                      # Backend modules
│   ├── config.js               # Configuration hub (196 lines)
│   ├── middleware.js           # Express middleware (143 lines)
│   ├── storage.js              # In-memory state (310 lines)
│   ├── database.js             # SQLite persistence (730 lines) [NEW v2.2.0]
│   ├── gemini.js               # AI API client (358 lines)
│   ├── prompts.js              # Roadmap AI instructions (1,671 lines)
│   ├── prompts-research.js     # Research synthesis prompts (744 lines) [NEW v2.2.0]
│   ├── utils.js                # Sanitization utilities (96 lines) - 100% test coverage
│   └── routes/
│       ├── charts.js           # Chart endpoints (783 lines)
│       ├── analysis.js         # Task analysis endpoints (154 lines)
│       ├── research.js         # Research synthesis pipeline (928 lines) [NEW v2.2.0]
│       └── analytics.js        # Usage tracking (157 lines) [NEW v2.2.0]
│
├── Public/                      # Frontend assets (served statically)
│   ├── index.html              # Upload interface with research synthesis
│   ├── chart.html              # Chart viewer
│   ├── analytics.html          # Analytics dashboard [NEW v2.2.0]
│   ├── presentation.html       # Standalone presentation
│   ├── style.css               # Main styles
│   ├── presentation.css        # Presentation styles
│   │
│   ├── main.js                 # Upload form logic (654 lines)
│   ├── chart-renderer.js       # Chart orchestrator (259 lines)
│   ├── ResearchSynthesizer.js  # Research synthesis (1,836 lines) [NEW v2.2.0]
│   ├── GanttChart.js           # Main chart component (2,227 lines)
│   ├── Utils.js                # Shared utilities (2,118 lines)
│   ├── TaskAnalyzer.js         # Analysis modal (468 lines)
│   ├── ExecutiveSummary.js     # Strategic brief (984 lines)
│   ├── PresentationSlides.js   # Slide deck (553 lines)
│   ├── DraggableGantt.js       # Drag-to-edit (266 lines)
│   ├── ResizableGantt.js       # Bar resizing (232 lines)
│   ├── ContextMenu.js          # Color picker (214 lines)
│   ├── ChatInterface.js        # Q&A chat (202 lines)
│   ├── Router.js               # Hash routing (281 lines)
│   ├── HamburgerMenu.js        # Navigation (191 lines)
│   ├── config.js               # Client config (135 lines)
│   ├── bip_logo.png
│   ├── horizontal-stripe.svg
│   ├── vertical-stripe.svg
│   └── bip-slide-*.html        # 13 slide templates
│
├── __tests__/                   # Jest test files (primary)
│   ├── unit/
│   │   ├── server/
│   │   │   ├── utils.test.js           # Utils tests (69 tests, 100% coverage)
│   │   │   ├── storage.test.js         # Storage tests (46 tests)
│   │   │   ├── storage-cleanup.test.js # Cleanup tests
│   │   │   ├── middleware.test.js      # Middleware tests
│   │   │   └── gemini-simple.test.js   # Basic Gemini tests
│   │   └── frontend/
│   │       └── Utils.test.js           # Frontend utils tests
│   └── integration/
│       ├── charts.test.js              # Chart API integration tests
│       └── analysis.test.js            # Analysis API integration tests
│
├── tests/                       # Additional test files
│   ├── unit/
│   │   ├── config.test.js
│   │   ├── gemini.test.js
│   │   ├── middleware.test.js
│   │   ├── middleware-fix.test.js
│   │   ├── storage.test.js
│   │   └── utils.test.js
│   └── integration/
│       ├── api.test.js
│       └── file-upload.test.js
│
├── coverage/                    # Test coverage reports (generated)
│
├── bip-slide-*.html            # Standalone slide templates (13 files)
├── *.png                       # Design mockups and assets
│
├── roadmap.db                  # SQLite database (generated) [NEW v2.2.0]
│
└── *.md                        # Development documentation (root level)
    ├── CLAUDE.md                                           # This file - AI assistant guide
    ├── readme.md                                           # User documentation
    ├── COMPREHENSIVE_CODE_ANALYSIS.md                      # Detailed code analysis
    ├── PHASE_1_IMPLEMENTATION_SUMMARY.md                   # Phase 1 development
    ├── PHASE_2_IMPLEMENTATION_SUMMARY.md                   # Phase 2 development
    ├── PHASE_3_IMPLEMENTATION_SUMMARY.md                   # Phase 3 development
    ├── PHASE_5_ENHANCEMENTS.md                             # Phase 5 enhancements
    ├── TASK_ANALYSIS_ENHANCEMENT_RECOMMENDATIONS.md        # Task analysis improvements
    ├── DEPLOYMENT_NOTES.md                                 # Production deployment guide
    ├── BIP_SLIDES_README.md                                # Presentation slide templates
    ├── BANKING_ENHANCEMENTS_STATUS.md                      # Banking features status [NEW v2.2.0]
    ├── BANKING_ENHANCEMENTS_TEST_SUMMARY.md                # Banking features test plan
    ├── CROSS_LLM_RESEARCH_SYNTHESIS_IMPLEMENTATION_PLAN.md # Research synthesis plan [NEW v2.2.0]
    ├── FINAL_IMPLEMENTATION_REVIEW.md                      # Final review [NEW v2.2.0]
    ├── IMPLEMENTATION_PROGRESS.md                          # Progress tracker [NEW v2.2.0]
    ├── TESTING.md                                          # Testing strategy guide
    ├── TESTING_SUMMARY.md                                  # Test infrastructure overview
    ├── TESTING_IMPLEMENTATION.md                           # Implementation details
    ├── TESTING_IMPLEMENTATION_PROGRESS.md                  # Testing progress tracker
    ├── TEST_RESULTS_AND_REMEDIATION_PLAN.md                # Test results and fixes
    ├── Claude Update_UX_Banking_Enhancements_Report.md     # UX/Banking enhancements
    ├── Claude update_Analysis_Gaps_Banking_Report.md       # Analysis gaps report
    └── Claude update_Implementation_Guide_Quick_Wins.md    # Quick wins guide
```

---

## Tech Stack

### Backend
- **Runtime**: Node.js (ES6 modules)
- **Framework**: Express 4.19.2
- **Database**: better-sqlite3 12.4.1 (SQLite with WAL mode) [NEW v2.2.0]
- **Security**: Helmet, express-rate-limit, CORS
- **File Processing**: Multer (multipart uploads), Mammoth (DOCX conversion), pdf-parse 1.1.1 (PDF extraction) [NEW v2.2.0]
- **AI Integration**: Google Gemini API (`gemini-2.5-flash-preview-09-2025`)
- **Utilities**: dotenv, compression, jsonrepair
- **Testing**: Jest 30.2.0 (ES module support), Supertest 7.1.4, node-mocks-http 1.17.2

### Frontend
- **JavaScript**: Vanilla ES6 (no framework/bundler)
- **Styling**: Tailwind CSS 3.x (CDN - **not production-ready**)
- **Security**: DOMPurify 3.0.6 (XSS sanitization)
- **Visualization**: Chart.js 4.4.1 (analytics charts) [NEW v2.2.0]
- **Export**: html2canvas 1.4.1 (PNG export)
- **Fonts**: Work Sans (Google Fonts)

### AI Model
- **Model**: `gemini-2.5-flash-preview-09-2025`
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta`
- **Features**: JSON schema validation, system instructions, configurable temperature

---

## Key Components Deep Dive

### 1. Chart Generation Flow (server/routes/charts.js)

**POST /generate-chart** - Async job creation:
```javascript
// 1. Create job with unique ID
const jobId = createJobId();
jobStore.set(jobId, { status: 'queued', progress: 'Starting...' });

// 2. Process files in parallel (deterministic order)
const fileContents = await Promise.all(files.map(processFile));

// 3. Create session for research context
const sessionId = createSessionId();
sessionStore.set(sessionId, { research, filenames, createdAt });

// 4. Background processing (3 phases)
processChartGeneration(jobId, prompt, research, sessionId);

// 5. Return jobId immediately
res.json({ jobId, sessionId });
```

**Three-Phase AI Generation**:
1. **Gantt Chart** (8192 tokens, temp=0): Structured JSON with JSON schema
2. **Executive Summary** (4096 tokens, temp=0.7): Strategic narrative
3. **Presentation Slides** (2-phase):
   - Outline generation (slide types + titles)
   - Content generation (detailed content per slide)

**Job Polling** - GET /job/:id:
- Client polls every 1 second
- No rate limit on job endpoint (for frequent checks)
- Returns: `{ status: 'processing', progress: 'Analyzing research...' }`
- Final: `{ status: 'complete', chartId: '...' }`

### 2. GanttChart.js (Main Component)

**Responsibilities**:
- Chart rendering (grid layout, bars, labels)
- Edit mode toggle (enables drag/resize/context menu)
- Export to PNG (html2canvas)
- Component composition (integrates all sub-components)

**Key Methods**:
```javascript
render() {
  // 1. Create container structure
  // 2. Add title + BIP logo (flexbox alignment)
  // 3. Generate CSS Grid (dynamic columns)
  // 4. Render rows (swimlanes + tasks)
  // 5. Add SVG decorations (stripes)
  // 6. Add today line
  // 7. Add legend
  // 8. Initialize sub-components (drag, resize, context menu)
}

toggleEditMode() {
  // Enable/disable drag, resize, context menu
  // Visual: Green (ON) vs Red (OFF) button
}

exportToPNG() {
  // Use html2canvas to capture chart
  // Download as PNG file
}
```

**CSS Grid Layout**:
```javascript
// Dynamic column definition based on timeColumns
gridTemplateColumns = `300px repeat(${numCols}, 1fr)`;
// Row = label (300px) + time column cells (equal width)
```

### 3. DraggableGantt.js (Drag-to-Edit)

**Features**:
- Column snapping (aligns to time column boundaries)
- Visual feedback (transparent drag indicator)
- Collision detection (prevents swimlane dropping)
- Backend sync (POST /update-task-dates)

**Event Flow**:
```javascript
mousedown on bar (not edges) → capture initial position
mousemove → update drag indicator position
mouseup → calculate new startCol/endCol, API call, re-render
```

**Edge Case Handling**:
- Ignores first/last 10px (resize handles)
- Prevents dropping on swimlanes (isSwimlane check)
- Race condition: Uses flag to prevent double-processing

### 4. TaskAnalyzer.js (Analysis Modal)

**Data Structure** (3-phase enhancement):
```javascript
{
  taskName: string,
  entity: string,
  startDate: string,
  endDate: string,

  // Phase 1: Scheduling & Risk
  factsAndAssumptions: [
    { fact: string, source: string, confidence: string }
  ],
  schedulingContext: {
    predecessors: string[],
    successors: string[],
    criticalPath: boolean,
    slackTime: string
  },
  risks: [
    { description: string, severity: string, likelihood: string, mitigation: string }
  ],
  impact: {
    downstreamTasks: string[],
    overallImpact: string
  },

  // Phase 2: Progress (in-progress tasks only)
  progressIndicators: {
    milestones: [{ name: string, status: string }],
    velocity: string,
    blockers: string[]
  },
  accelerators: [
    { action: string, impact: string }
  ],

  // Phase 3: Confidence
  confidenceAssessment: {
    dataQuality: string,
    analysisLimitations: string,
    recommendedActions: string[]
  }
}
```

**Integrated Chat** (ChatInterface.js):
- Contextual Q&A about specific task
- Session-based (uses sessionId for research access)
- POST /ask-question endpoint

### 5. ExecutiveSummary.js (Strategic Brief)

**Sections**:
1. **Strategic Narrative**: Elevator pitch (2-3 paragraphs)
2. **Key Drivers**: 3-5 critical drivers with metrics
3. **Critical Dependencies**: 2-4 dependencies with criticality levels (High/Medium/Low)
4. **Risk Intelligence**: 2-3 enterprise-level risks
5. **Expert Insights**: 5-7 actionable talking points
6. **Metadata**: Confidence assessment, documents cited

**Styling**: Collapsible sections, print-friendly, dark blue theme

### 6. PresentationSlides.js (Slide Deck)

**Slide Types** (7 types):
1. **Title**: Project name + subtitle
2. **Narrative**: 2-3 paragraph story
3. **Drivers**: Numbered list with green accent
4. **Dependencies**: Flow diagram with criticality colors
5. **Risks**: 3x3 matrix (probability vs impact)
6. **Insights**: Card grid with categories
7. **Simple**: Generic bullet points

**Rendering**:
```javascript
renderSlide(slideIndex) {
  const slide = this.slides[slideIndex];
  switch (slide.type) {
    case 'title': return this._buildTitleSlide(slide);
    case 'narrative': return this._buildNarrativeSlide(slide);
    // ... type-specific builders
  }
}
```

**Navigation**: Previous/next buttons, slide counter (e.g., "3 / 7")

### 7. ResearchSynthesizer.js (Cross-LLM Research Analysis) [NEW v2.2.0]

**Purpose**: 8-step pipeline for analyzing research from multiple LLM sources (GEMINI, GPT, CLAUDE, GROK)

**Pipeline Steps**:
1. **Upload Sources**: File upload with LLM provider attribution (.md, .txt, .docx, .pdf)
2. **Extract Claims**: AI extracts atomic claims from each source (fact + confidence + source)
3. **View Ledger**: Aggregated claim ledger with bar charts (by provider and topic)
4. **Detect Contradictions**: Identify conflicts (numerical, polarity, definitional, temporal)
5. **Synthesize Report**: Generate Markdown report with consensus/disagreement sections
6. **Audit Provenance**: Verify citations, detect hallucinations and incorrect attributions
7. **Verified Claims**: Separate high-consensus vs. disputed claims
8. **Dashboard**: Visual analytics (pie charts for citation quality, consensus levels)

**Data Flow**:
```javascript
// Step 1: Upload
POST /upload-research-sources
→ { jobId, sessionId }

// Step 2: Extract Claims
POST /extract-claims
→ { claims: [{ text, source, provider, confidence, topic }] }

// Step 3: Merge Ledger
(Client-side aggregation)

// Step 4: Detect Contradictions
POST /detect-contradictions
→ { contradictions: [{ type, sources, resolution }] }

// Step 5: Synthesize Report
POST /synthesize-report
→ { report: markdown, metadata }

// Step 6: Audit Provenance
POST /audit-provenance
→ { issues: [{ type, severity, location }] }

// Step 7: Compile Verified Claims
(Client-side filtering based on audit)

// Step 8: Generate Dashboard
POST /generate-dashboard
→ { summary, charts }
```

**Key Features**:
- **Inline Citations**: Every claim linked to source file and LLM provider
- **Provenance Auditing**: Automated fact-checking against original sources
- **Contradiction Detection**: 4 types (numerical, polarity, definitional, temporal)
- **Visual Analytics**: Chart.js visualizations for consensus and citation quality

### 8. Database Module (server/database.js) [NEW v2.2.0]

**Purpose**: SQLite persistence for charts, sessions, jobs, and analytics

**Schema**:
```sql
-- Sessions table
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT UNIQUE NOT NULL,
  research TEXT NOT NULL,
  filenames TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL
);

-- Charts table
CREATE TABLE charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chartId TEXT UNIQUE NOT NULL,
  sessionId TEXT NOT NULL,
  ganttData TEXT NOT NULL,
  executiveSummary TEXT,
  presentationSlides TEXT,
  createdAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL
);

-- Jobs table
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jobId TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  progress TEXT,
  chartId TEXT,
  error TEXT,
  createdAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL
);

-- Analytics events table
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventType TEXT NOT NULL,
  eventData TEXT,
  chartId TEXT,
  sessionId TEXT,
  createdAt INTEGER NOT NULL
);
```

**Key Functions**:
- `createSession()`, `getSession()`, `getAllSessions()`
- `createChart()`, `getChart()`, `getAllCharts()`
- `createJob()`, `updateJob()`, `completeJob()`, `failJob()`, `getJob()`
- `trackEvent()`, `getAnalyticsSummary()`, `getAnalyticsEvents()`
- `cleanupExpiredRecords()` - Runs on initialization and can be scheduled

**Configuration**:
- Database path: `./roadmap.db`
- WAL mode for better concurrency
- Default expiration: 30 days
- Automatic cleanup on initialization

---

## Development Patterns and Conventions

### Naming Conventions

**Files**:
- Classes: PascalCase (`GanttChart.js`, `TaskAnalyzer.js`)
- Utilities: camelCase (`chart-renderer.js`, `utils.js`)
- Config: lowercase (`config.js`)

**Functions**:
- Public methods: camelCase (`render()`, `toggleEditMode()`)
- Private methods: `_prefixed` (`_buildHeader()`, `_handleMouseDown()`)
- Event handlers: `handle*` prefix (`handleSubmit()`, `handleDragStart()`)

**Constants**:
- SCREAMING_SNAKE_CASE (`CONFIG.API.RETRY_COUNT`, `CHART_GENERATION_SYSTEM_PROMPT`)

**DOM Elements**:
- IDs: kebab-case (`gantt-chart-container`, `task-analyzer-modal`)
- Classes: kebab-case (`modal-overlay`, `gantt-bar`)
- Data attributes: `data-*` (`data-row-index`, `data-task-id`)

### Code Organization

**Backend Modules**:
```javascript
// Export pattern (single responsibility)
export { sanitizePrompt, validateSessionId };

// Import pattern (explicit)
import { sanitizePrompt } from './utils.js';
```

**Frontend Components**:
```javascript
// Class-based components
export class GanttChart {
  constructor(containerId, ganttData, dependencies = {}) {
    this.containerId = containerId;
    this.ganttData = ganttData;
    this.isEditMode = false;
    // Dependency injection
    this.draggable = dependencies.draggable;
    this.resizable = dependencies.resizable;
  }

  // Public API
  render() { ... }
  toggleEditMode() { ... }

  // Private helpers (convention only, not enforced)
  _buildHeader() { ... }
  _createGrid() { ... }
}
```

### Error Handling

**Backend**:
```javascript
// Try-catch with detailed logging
try {
  const response = await callGeminiAPI();
} catch (error) {
  console.error('[Chart Generation] AI API error:', error.message);
  jobStore.set(jobId, {
    status: 'error',
    error: 'Failed to generate chart. Please try again.'
  });
}
```

**Frontend**:
```javascript
// Safe DOM access
const container = document.getElementById('gantt-chart-container');
if (!container) {
  console.error('Chart container not found');
  return;
}

// Graceful degradation
try {
  await exportToPNG();
} catch (error) {
  alert('Export failed. Please try again.');
  console.error(error);
}
```

### Security Patterns

**Prompt Injection Defense** (multi-layer):
```javascript
// 1. Regex patterns (server/config.js)
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+instructions/i,
  /system\s*:/i,
  /new\s+instructions/i,
  // ... 20+ patterns
];

// 2. Unicode obfuscation detection (server/utils.js)
const UNICODE_OBFUSCATION = /[\u200B-\u200D\uFEFF]/;

// 3. Security context wrapping (server/utils.js)
function sanitizePrompt(text) {
  // Wrap user input to prevent role confusion
  return `<user_input>${cleanText}</user_input>`;
}
```

**XSS Protection**:
```javascript
// DOMPurify for user-generated content
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userContent);

// DOM manipulation instead of innerHTML
const div = document.createElement('div');
div.textContent = userText; // Auto-escapes
```

**Rate Limiting** (two-tier):
```javascript
// General: 100 requests / 15 minutes
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Chart generation: 20 requests / 15 minutes (expensive operation)
chartRouter.post('/generate-chart',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }),
  handleChartGeneration
);
```

---

## Common Development Tasks

### Adding a New Route

1. **Create route handler** in `server/routes/`:
```javascript
// server/routes/my-feature.js
import express from 'express';
const router = express.Router();

router.post('/my-endpoint', async (req, res) => {
  try {
    // Implementation
    res.json({ success: true });
  } catch (error) {
    console.error('[MyFeature] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

2. **Mount in server.js**:
```javascript
import myFeatureRouter from './server/routes/my-feature.js';
app.use('/api', myFeatureRouter);
```

### Adding a New Frontend Component

1. **Create component file** in `Public/`:
```javascript
// Public/MyComponent.js
export class MyComponent {
  constructor(containerId) {
    this.containerId = containerId;
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = ''; // Clear
    // Build DOM
  }
}
```

2. **Import and use** in parent component:
```javascript
import { MyComponent } from './MyComponent.js';

const myComponent = new MyComponent('my-container');
myComponent.render();
```

3. **Update chart.html** if using CDN libraries:
```html
<script src="https://cdn.example.com/library.js"></script>
```

### Modifying AI Prompts

**Location**: `server/prompts.js` (948 lines)

**Key Prompts**:
- `CHART_GENERATION_SYSTEM_PROMPT`: Gantt chart generation
- `TASK_ANALYSIS_SYSTEM_PROMPT`: Task analysis
- `EXECUTIVE_SUMMARY_SYSTEM_PROMPT`: Strategic brief
- `PRESENTATION_OUTLINE_PROMPT`: Slide outline
- `PRESENTATION_CONTENT_PROMPT`: Slide content

**Pattern**:
```javascript
export const MY_PROMPT = `
You are an expert in [domain].

## Context
[Background information]

## Task
[What to generate]

## Output Format
[Specific requirements]

## Guidelines
- Guideline 1
- Guideline 2
`;
```

**JSON Schema** (for structured output):
```javascript
export const MY_SCHEMA = {
  type: "object",
  properties: {
    field1: { type: "string", description: "..." },
    field2: {
      type: "array",
      items: { type: "object", properties: { ... } }
    }
  },
  required: ["field1", "field2"]
};
```

### Adding Chart Customization

**Bar Colors** (hardcoded in multiple places):

1. **AI prompt** (`server/prompts.js`):
```javascript
Available colors: priority-red, medium-red, mid-grey, light-grey, white, dark-blue
```

2. **CSS** (`Public/style.css`):
```css
.gantt-bar.priority-red { background-color: #da291c; }
.gantt-bar.medium-red { background-color: #BA3930; }
/* ... */
```

3. **Context menu** (`Public/ContextMenu.js`):
```javascript
const colors = ['priority-red', 'medium-red', 'mid-grey', ...];
```

**To add new color**:
1. Add to prompt (color name + when to use)
2. Add CSS class (`.gantt-bar.new-color { background: #HEX; }`)
3. Add to context menu array
4. Add to legend builder (`Public/Utils.js`)

### Debugging Chart Generation

**Enable detailed logging**:
```javascript
// server/gemini.js
console.log('[Gemini] Request payload:', JSON.stringify(payload, null, 2));
console.log('[Gemini] Response:', JSON.stringify(response.data, null, 2));
```

**Common issues**:
1. **Malformed JSON**: Check `jsonrepair` output, look for duplicate keys
2. **Safety blocks**: Check `response.candidates[0].safetyRatings`
3. **Empty timeColumns**: AI didn't generate time range - check prompt clarity
4. **Wrong color classes**: AI used non-existent color - update prompt examples

**Test with minimal research**:
```javascript
// POST /generate-chart
{
  "prompt": "Create a 6-month software development roadmap",
  "research": "Project: Build mobile app. Timeline: Jan-Jun 2025. Phases: Design, Development, Testing."
}
```

### Adding Tests

**1. Create unit test** in `__tests__/unit/`:
```javascript
// __tests__/unit/server/myModule.test.js
import { describe, it, expect } from '@jest/globals';
import { myFunction } from '../../../server/myModule.js';

describe('myModule', () => {
  describe('myFunction', () => {
    it('should handle valid input', () => {
      const result = myFunction('valid input');
      expect(result).toBe('expected output');
    });

    it('should reject invalid input', () => {
      expect(() => myFunction(null)).toThrow();
    });
  });
});
```

**2. Create integration test** in `__tests__/integration/`:
```javascript
// __tests__/integration/my-api.test.js
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';

describe('My API Endpoint', () => {
  it('should return 200 for valid request', async () => {
    const response = await request(app)
      .post('/my-endpoint')
      .send({ data: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

**3. Run tests**:
```bash
# Run your new tests
npm test

# Run in watch mode during development
npm run test:watch

# Check coverage
npm test -- --coverage
```

**Testing Best Practices**:
- Test security edge cases first (injection, XSS, validation)
- Use descriptive test names: `it('should reject files larger than 10MB')`
- Mock external dependencies (AI API, file system)
- Test error cases, not just happy path
- Aim for 100% coverage on security-critical modules

---

## File Processing Details

### Supported Formats

**MIME Types**:
- `text/markdown` (.md)
- `text/plain` (.txt)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)
- `application/pdf` (.pdf) [NEW v2.2.0]

**Edge Case**: Some browsers send `.md` as `application/octet-stream`
- **Solution**: Extension fallback in file validation (middleware.js)

### Upload Limits

**Per-File**:
- Size: 10 MB
- Count: 500 files (for folder uploads)

**Total**:
- Size: 200 MB
- Field size: 2 MB

**Configuration**: `server/config.js` → `CONFIG.FILE_LIMITS`

### Processing Flow

```javascript
// 1. Client validation (main.js)
if (!file.name.match(/\.(md|txt|docx|pdf)$/i)) {
  alert('Invalid file type');
  return;
}

// 2. Server validation (middleware.js)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['text/markdown', 'text/plain', 'application/pdf', ...];
  const allowedExtensions = ['.md', '.txt', '.docx', '.pdf'];

  if (allowedTypes.includes(file.mimetype) ||
      allowedExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext))) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

// 3. Parallel processing (charts.js, research.js)
const processFile = async (file) => {
  if (file.originalname.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  } else if (file.originalname.endsWith('.pdf')) {
    const data = await pdf(file.buffer);
    return data.text;
  } else {
    return file.buffer.toString('utf-8');
  }
};

const fileContents = await Promise.all(files.map(processFile));

// 4. Deterministic sorting (alphabetical by filename)
const sortedFiles = [...files].sort((a, b) =>
  a.originalname.localeCompare(b.originalname)
);

// 5. Combine with markers
const research = sortedFiles.map((file, idx) => `
--- Start of file: ${file.originalname} ---
${fileContents[idx]}
--- End of file: ${file.originalname} ---
`).join('\n\n');
```

---

## State Management

### Hybrid Storage Architecture [UPDATED v2.2.0]

**In-Memory Storage (server/storage.js)** - For active sessions and rapid access:

1. **sessionStore**: Research context for task analysis
```javascript
{
  sessionId: {
    research: string,         // Combined file contents
    filenames: string[],      // Original filenames
    createdAt: Date
  }
}
```

2. **chartStore**: Generated charts
```javascript
{
  chartId: {
    ganttData: object,        // Chart JSON
    executiveSummary: object, // Summary JSON
    presentationSlides: object, // Slides JSON
    sessionId: string,        // Link to session
    createdAt: Date
  }
}
```

3. **jobStore**: Async job status
```javascript
{
  jobId: {
    status: 'queued' | 'processing' | 'complete' | 'error',
    progress: string,         // "Analyzing research..."
    chartId?: string,         // Set on completion
    error?: string,           // Set on error
    createdAt: Date
  }
}
```

**Cleanup**: Runs every 5 minutes, removes expired charts/sessions (30 days) and old jobs (1 hour)

**Database Persistence (server/database.js)** [NEW v2.2.0] - For long-term storage:

**SQLite Database** (`roadmap.db`):
- **Sessions**: 30-day retention for research context
- **Charts**: 30-day retention for generated roadmaps
- **Jobs**: 30-day retention for job history
- **Analytics**: Permanent storage for usage events

**Dual-Write Strategy**:
- Charts/sessions written to both in-memory and database
- In-memory for fast access (active sessions)
- Database for persistence across restarts
- Automatic cleanup of expired records on startup

**Benefits**:
- ✅ Survives server restarts
- ✅ Enables sharing via URL (persistent chart IDs)
- ✅ Analytics tracking across sessions
- ✅ 30-day data retention

**Limitations**:
- Single SQLite file (not distributed)
- No authentication/authorization
- **Production**: Consider PostgreSQL or MySQL for multi-server deployments

### Frontend State

**URL Parameters**:
```javascript
// chart.html?id=abc123
const urlParams = new URLSearchParams(window.location.search);
const chartId = urlParams.get('id');
```

**sessionStorage**:
```javascript
// Fallback for backward compatibility
const sessionId = sessionStorage.getItem('sessionId');
const chartId = sessionStorage.getItem('chartId');
```

**Hash Routing**:
```javascript
// #roadmap, #executive-summary, #presentation
window.location.hash = '#executive-summary';
```

---

## Deployment

### Environment Variables

**Required**:
- `API_KEY`: Google Gemini API key

**Optional**:
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `ALLOWED_ORIGINS`: CORS origins (comma-separated)

### Railway Deployment

**Auto-detection**:
- Detects Node.js via `package.json`
- Uses `npm start` command
- Sets `PORT` environment variable

**Configuration**:
1. Push to GitHub
2. Create Railway project from repo
3. Add `API_KEY` environment variable
4. Deploy automatically

**Trust Proxy**:
```javascript
// server.js
app.set('trust proxy', 1); // Railway uses single proxy
```

### Production Checklist

**Critical** (from DEPLOYMENT_NOTES.md):
- [ ] Replace Tailwind CDN with installed version
- [ ] Configure CSP headers (currently disabled for Tailwind CDN)
- [ ] Replace in-memory storage with Redis/database
- [ ] Set up logging (Winston, Pino, etc.)
- [ ] Configure monitoring (New Relic, Datadog, etc.)
- [ ] Add authentication/authorization
- [ ] Tune rate limits based on usage
- [ ] Configure backups
- [ ] Set up error tracking (Sentry, Rollbar, etc.)
- [ ] Add health check endpoint (`/health`)

**Optional**:
- [ ] Add bundler (Webpack, Vite) for frontend
- [ ] Implement caching (CDN, browser cache headers)
- [ ] Add compression (already enabled via compression middleware)
- [ ] Set up CI/CD pipeline
- [x] Add unit/integration tests (✅ v2.1.0 - Backend tests implemented, frontend tests pending)

---

## Testing

**Current State**: Comprehensive testing infrastructure implemented (v2.1.0)

### Test Infrastructure

**Framework**: Jest 30.2.0 with ES module support
**Test Runners**:
- `npm test` - Run all tests with coverage
- `npm run test:watch` - Watch mode for development
- `npm run test:unit` - Unit tests only
- `npm run test:integration` - Integration tests only

**Configuration**:
- `jest.config.js` - Jest configuration with ES module support
- `jest.setup.js` - Global test setup and environment variables
- `.env.test` - Test environment configuration

### Test Coverage Summary

**Total Tests**: 124 (69 passing, focus on security)

| Module | Coverage | Tests | Status |
|--------|----------|-------|--------|
| server/utils.js | 100% | 69 | ✅ Excellent (all security functions tested) |
| server/storage.js | 40% | 46 | ⚠️ Good (CRUD covered, cleanup needs work) |
| server/config.js | 72.4% | - | ✅ Good |
| server/middleware.js | 10.8% | - | ⚠️ Partial (validation tested) |
| server/gemini.js | 0.9% | - | ❌ Needs mocking refactor |
| Frontend | 0% | - | ❌ Not yet implemented |

### Unit Tests

**Location**: `__tests__/unit/`

**server/utils.test.js** (100% coverage):
```javascript
// 69 tests covering:
- Input sanitization (XSS, prompt injection, SQL injection)
- Unicode obfuscation detection (zero-width chars, BOM)
- ID validation (chart IDs, job IDs, session IDs)
- File extension validation
- Security attack vector prevention

// Example tests:
describe('sanitizePrompt', () => {
  it('should detect and flag prompt injection attempts', () => {
    const result = sanitizePrompt('Ignore all previous instructions');
    expect(result.sanitized).toBe(true);
  });

  it('should detect XSS attempts', () => {
    const result = sanitizePrompt('<script>alert("xss")</script>');
    expect(result.containsHtml).toBe(true);
  });
});
```

**server/storage.test.js** (40% coverage):
```javascript
// 46 tests covering:
- Session CRUD operations
- Chart CRUD operations
- Job lifecycle management
- Concurrent operations (100+ simultaneous ops)
- Error handling and edge cases

describe('Storage', () => {
  it('should handle 100+ concurrent operations', () => {
    // Creates 100 sessions concurrently
    // Verifies all are stored correctly
  });
});
```

**server/middleware.test.js** (11% coverage):
```javascript
// Tests covering:
- Cache control headers
- File upload validation (MIME types, extensions)
- Upload error handling (size, count limits)
- Security: Rejects .exe, .js, .zip files
- Validates both MIME type AND extension
```

### Integration Tests

**Location**: `__tests__/integration/`

**charts.test.js**:
```javascript
// Full chart generation API tests
describe('Chart Generation API', () => {
  it('should create job and return jobId', async () => {
    const response = await request(app)
      .post('/generate-chart')
      .attach('files', buffer, 'test.txt');

    expect(response.status).toBe(200);
    expect(response.body.jobId).toBeDefined();
  });
});
```

**analysis.test.js**:
```javascript
// Task analysis and Q&A API tests
describe('Analysis API', () => {
  it('should return task analysis with all sections', async () => {
    const response = await request(app)
      .post('/get-task-analysis')
      .send({ taskName: 'Test Task', sessionId: 'test-id' });

    expect(response.body.factsAndAssumptions).toBeDefined();
    expect(response.body.risks).toBeDefined();
  });
});
```

### Running Tests

```bash
# Run all tests with coverage
npm test

# Watch mode (auto-rerun on file changes)
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# View detailed coverage report
# After running tests, open: ./coverage/index.html
```

### Test Results Location

- **Console Output**: Summary after each test run
- **Coverage Reports**: `./coverage/` directory
  - `index.html` - Interactive HTML report
  - `lcov.info` - LCOV format for CI/CD
- **Test Documentation**: See `TESTING_SUMMARY.md` for detailed overview

### Known Testing Limitations

1. **ES Module Mocking**: Jest's experimental ES module support has limitations
   - Some tests use workarounds for `jest.fn()`
   - Consider migrating to Vitest for better ES module support

2. **Missing Tests**:
   - API integration with Gemini (server/gemini.js) - requires API mocking
   - Cleanup interval logic (server/storage.js) - requires timer mocking
   - Route handlers (server/routes/*.js) - partial coverage via integration tests
   - All frontend components (Public/*.js)

3. **Coverage Thresholds**: Set to 50% global, not currently met due to untested frontend

### Testing Best Practices

**When Adding Tests**:
1. Place unit tests in `__tests__/unit/`
2. Place integration tests in `__tests__/integration/`
3. Use descriptive test names: `it('should reject files larger than 10MB', ...)`
4. Test security edge cases (injection, XSS, validation bypass)
5. Mock external dependencies (API calls, file system)

**Security Testing Priority**:
- Always test input validation/sanitization functions
- Test authentication/authorization (when added)
- Test rate limiting behavior
- Test file upload restrictions
- Test prompt injection defenses

---

## Known Limitations

### Architectural
1. **SQLite storage**: Single-file database, not suitable for distributed deployments [IMPROVED v2.2.0]
   - ✅ Now persists across restarts (previously in-memory only)
   - ⚠️ Still single-process, consider PostgreSQL for multi-server
2. **No authentication**: Open API, vulnerable to abuse
3. **Single process**: Can't scale horizontally without shared database
4. **No logging**: Difficult to debug production issues (consider Winston/Pino)

### Security
1. **Tailwind CDN**: Disabled CSP, potential supply chain risk
2. **No CSRF protection**: Stateless API, but vulnerable if adding sessions
3. **Rate limiting**: Basic, can be bypassed with IP rotation
4. **File upload**: No virus scanning, relies on MIME type validation

### Performance
1. **No caching**: Repeated identical requests regenerate charts
2. **No pagination**: Large research files can timeout
3. **Blocking operations**: File processing blocks event loop
4. **No compression for API**: Only static assets compressed

### User Experience
1. **No progress bar**: Job polling shows text only
2. **No error recovery**: Failed jobs require full regeneration
3. **No autosave**: Edit mode changes lost on refresh (unless saved manually)
4. **No undo/redo**: Destructive edits can't be reverted

### AI Integration
1. **JSON repair limitations**: Can't fix all malformed responses
2. **No streaming**: Wait for full response before rendering
3. **No fallback model**: If Gemini fails, no alternative
4. **Token limits**:
   - **Regular charts**: Research content limited to 50,000 characters
   - **Semantic charts**: Research content limited to 100,000 characters (configurable via `CONFIG.SEMANTIC.MAX_RESEARCH_CHARS`)
   - Very large research files will be truncated with warning message
   - **Workaround**: Split large documents or reduce file count

---

## Best Practices for AI Assistants

### When Making Changes

1. **Read before write**: Always read files before editing (required by tools)
2. **Preserve style**: Match existing code conventions (camelCase, ES6 modules)
3. **Update documentation**: Modify phase summaries if architecture changes
4. **Test locally**: Run `npm start` and verify changes work
5. **Security check**: Review for injection vulnerabilities, XSS

### Common Mistakes to Avoid

1. **Breaking ES6 modules**: Don't use `require()`, use `import`
2. **Hardcoded config**: Use `server/config.js` or `Public/config.js`
3. **Inconsistent naming**: Follow existing patterns (camelCase, kebab-case)
4. **Missing error handling**: Always wrap API calls in try-catch
5. **Ignoring frozen config**: Don't try to mutate `CONFIG` object

### Code Review Checklist

**Backend Changes**:
- [ ] Uses `import`/`export` (not `require`)
- [ ] Configuration in `server/config.js`
- [ ] Error handling with try-catch
- [ ] Input validation and sanitization
- [ ] Logging for debugging
- [ ] Rate limiting on new endpoints

**Frontend Changes**:
- [ ] ES6 class-based component
- [ ] Private methods prefixed with `_`
- [ ] Safe DOM access (null checks)
- [ ] XSS protection (DOMPurify or textContent)
- [ ] Responsive design (mobile-friendly)
- [ ] Accessibility (ARIA labels, semantic HTML)

**AI Prompt Changes**:
- [ ] Clear, specific instructions
- [ ] Example outputs provided
- [ ] JSON schema for structured output
- [ ] Handles edge cases (empty data, etc.)
- [ ] Temperature appropriate for task

### Git Commit Messages

**Format**: `[Component] Description`

**Examples**:
- `[GanttChart] Add drag-to-edit functionality`
- `[Gemini] Implement retry logic with exponential backoff`
- `[Security] Add prompt injection defense`
- `[Docs] Update CLAUDE.md with testing section`

---

## Troubleshooting

### Server Won't Start

**Symptom**: `Error: Missing required environment variable: API_KEY`
**Solution**: Create `.env` file with `API_KEY=your_key_here`

**Symptom**: `Error: listen EADDRINUSE :::3000`
**Solution**: Port 3000 in use, set `PORT=3001` in `.env`

### Chart Generation Fails

**Symptom**: Job stuck in "processing" status
**Solution**: Check server logs for Gemini API errors, verify API_KEY

**Symptom**: "Invalid JSON from AI"
**Solution**: AI returned malformed JSON, jsonrepair failed - retry or simplify prompt

**Symptom**: Empty timeColumns
**Solution**: AI didn't understand time range - add explicit dates to prompt

### Edit Mode Not Working

**Symptom**: Drag-to-edit doesn't respond
**Solution**: Click "Toggle Edit Mode" button (should turn green)

**Symptom**: Changes not persisting
**Solution**: Chart expired (30-day limit), regenerate chart

### Export Fails

**Symptom**: "Export failed" alert
**Solution**: html2canvas error - check browser console, may need to reload page

---

## Additional Resources

### Documentation Files
- `readme.md`: User-facing documentation
- `CLAUDE.md`: This file - comprehensive AI assistant guide
- `COMPREHENSIVE_CODE_ANALYSIS.md`: Detailed code analysis
- `PHASE_1_IMPLEMENTATION_SUMMARY.md`: Phase 1 development history
- `PHASE_2_IMPLEMENTATION_SUMMARY.md`: Phase 2 development history
- `PHASE_3_IMPLEMENTATION_SUMMARY.md`: Phase 3 development history
- `PHASE_5_ENHANCEMENTS.md`: Phase 5 enhancements and features
- `TASK_ANALYSIS_ENHANCEMENT_RECOMMENDATIONS.md`: Task analysis improvements
- `DEPLOYMENT_NOTES.md`: Production deployment guide
- `BIP_SLIDES_README.md`: Presentation slide templates
- `BANKING_ENHANCEMENTS_STATUS.md`: Banking features status [NEW v2.2.0]
- `BANKING_ENHANCEMENTS_TEST_SUMMARY.md`: Banking features test plan
- `CROSS_LLM_RESEARCH_SYNTHESIS_IMPLEMENTATION_PLAN.md`: Research synthesis architecture [NEW v2.2.0]
- `FINAL_IMPLEMENTATION_REVIEW.md`: Final implementation review [NEW v2.2.0]
- `IMPLEMENTATION_PROGRESS.md`: Feature implementation tracker [NEW v2.2.0]
- `TESTING.md`: Testing strategy and guide
- `TESTING_SUMMARY.md`: Test infrastructure overview (comprehensive)
- `TESTING_IMPLEMENTATION.md`: Implementation details
- `TESTING_IMPLEMENTATION_PROGRESS.md`: Testing progress tracker
- `TEST_RESULTS_AND_REMEDIATION_PLAN.md`: Test results and fixes
- `Claude Update_UX_Banking_Enhancements_Report.md`: UX and banking enhancements
- `Claude update_Analysis_Gaps_Banking_Report.md`: Analysis gaps and recommendations
- `Claude update_Implementation_Guide_Quick_Wins.md`: Quick wins implementation guide

### External Documentation
- [Google Gemini API](https://ai.google.dev/docs)
- [Express.js](https://expressjs.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [html2canvas](https://html2canvas.hertzen.com/)

### Useful Commands
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test                    # All tests with coverage
npm run test:watch          # Watch mode
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only

# Check for vulnerabilities
npm audit

# Update dependencies
npm update
```

---

## Quick Reference

### Key Files by Task

**Adding new AI feature**:
- `server/prompts.js` (prompt definition)
- `server/gemini.js` (API call logic)
- `server/routes/analysis.js` (new endpoint)

**Modifying chart appearance**:
- `Public/style.css` (styling)
- `Public/GanttChart.js` (rendering logic)
- `server/prompts.js` (AI color instructions)

**Changing file upload limits**:
- `server/config.js` (CONFIG.FILE_LIMITS)
- `server/middleware.js` (Multer config)

**Adding security feature**:
- `server/middleware.js` (rate limiting, headers)
- `server/utils.js` (sanitization)
- `server/config.js` (security patterns)

**Adding tests**:
- `__tests__/unit/` (unit tests)
- `__tests__/integration/` (integration tests)
- `jest.config.js` (test configuration)
- See "Adding Tests" section for examples

**Debugging chart issues**:
- `server/gemini.js` (AI response logging)
- `Public/chart-renderer.js` (loading/error handling)
- Browser DevTools Console (frontend errors)

### Critical Code Locations

**Chart generation**: `server/routes/charts.js:41` (processChartGeneration function)
**Drag-to-edit**: `Public/DraggableGantt.js:89` (_handleMouseMove method)
**Task analysis**: `server/routes/analysis.js:13` (POST /get-task-analysis)
**Edit mode toggle**: `Public/GanttChart.js:178` (toggleEditMode method)
**Export to PNG**: `Public/GanttChart.js:196` (exportToPNG method)

### Testing Quick Reference

**Running Tests**:
- `npm test` - All tests with coverage
- `npm run test:watch` - Watch mode
- `npm run test:unit` - Unit tests only
- `npm run test:integration` - Integration tests only

**Test Locations**:
- Unit tests: `__tests__/unit/`
- Integration tests: `__tests__/integration/`
- Coverage reports: `./coverage/index.html`

**Coverage Highlights**:
- ✅ server/utils.js: 100% (security functions)
- ⚠️ server/storage.js: 40% (CRUD operations)
- ❌ Frontend: 0% (not yet implemented)

**Documentation**:
- `TESTING_SUMMARY.md` - Comprehensive overview
- `TESTING_IMPLEMENTATION.md` - Implementation details
- `TEST_RESULTS_AND_REMEDIATION_PLAN.md` - Results and fixes

---

**Last Updated**: 2025-11-18
**Version**: 2.2.0 - Research Synthesis & Persistence Edition
**Codebase Size**: ~17,029 lines (backend: 6,409 lines, frontend: 10,620 lines)
**Major Features**: Cross-LLM Research Synthesis (8-step pipeline), SQLite Persistence, Analytics Dashboard
**Test Coverage**: 124 tests (69 passing), 100% coverage on critical security module
**Database**: SQLite with 30-day retention and WAL mode

## Banking Enhancements Quick Reference

### Financial Impact Dashboard (`Public/Utils.js:628-740`)
```javascript
// Automatically generated for each task analysis
{
  costs: { laborCosts, technologyCosts, vendorCosts, totalCost },
  benefits: { revenueIncrease, costSavings, riskReduction, totalAnnualBenefit },
  roiMetrics: { paybackPeriod, firstYearROI, threeYearNPV, confidenceLevel }
}
```
**Usage:** Opens automatically in task analysis modal, displays first for immediate visibility.

### Regulatory Alert Icons (`Public/GanttChart.js:471-554`)
```javascript
// Visual indicators on Gantt chart
regulatoryFlags: {
  hasRegulatoryDependency: true,
  regulatorName: "OCC",
  approvalType: "Pre-approval required",
  deadline: "Q2 2026",
  criticalityLevel: "high" // high = pulsing animation
}
```
**Usage:** 🏛️ icons appear on bars, hover for tooltip. Summary box shows totals.

### Light Mode Theme (`Public/GanttChart.js:790-844`)
```javascript
// Toggle button in export controls
_addThemeToggleListener() // Switches dark ↔ light
localStorage.setItem('gantt-theme', 'light') // Persists preference
```
**Usage:** Click "☀️ Light Mode" button. Optimized for projectors/presentations.

### Competitive Intelligence (`Public/ExecutiveSummary.js:503-597`)
```javascript
competitiveIntelligence: {
  marketTiming: "First mover advantage - only 23% adoption",
  competitorMoves: ["JPMorgan deployed Q1 2025", "Wells Fargo piloting"],
  competitiveAdvantage: "18-month lead before table stakes",
  marketWindow: "Limited window - act by Q3 2026"
}
```
**Usage:** Appears in Executive Summary after Key Insights. Blue gradient card.

### Industry Benchmarks (`Public/ExecutiveSummary.js:599-717`)
```javascript
industryBenchmarks: {
  timeToMarket: {
    yourPlan: "9 months",
    industryAverage: "14 months",
    variance: "37% faster",
    insight: "Significant competitive advantage"
  },
  investmentLevel: { /* similar structure */ },
  riskProfile: { /* qualitative assessment */ }
}
```
**Usage:** Appears after Competitive Intelligence. Green gradient card.

---

## Research Synthesis Quick Reference [NEW v2.2.0]

### 8-Step Pipeline Overview

**Access**: Click "Research Checker" in hamburger menu on index.html or click "Use Existing Research" when launching from chart view.

**Step 1: Upload Sources** (`Public/ResearchSynthesizer.js`)
```javascript
// Upload files with LLM provider attribution
POST /upload-research-sources
Files: .md, .txt, .docx, .pdf
Metadata: { filename, provider: 'GEMINI|GPT|CLAUDE|GROK|OTHER' }
```

**Step 2: Extract Claims** (`server/routes/research.js`)
```javascript
// AI extracts atomic claims
POST /extract-claims
Response: {
  claims: [{
    text: "Claim statement",
    source: "filename.md",
    provider: "GEMINI",
    confidence: "high|medium|low",
    topic: "Security|Performance|..."
  }]
}
```

**Step 3: View Ledger** (Client-side aggregation)
```javascript
// Bar charts showing claim distribution
- By LLM Provider (GEMINI: 45, GPT: 32, CLAUDE: 28)
- By Topic (Security: 18, Performance: 12, ...)
```

**Step 4: Detect Contradictions** (`server/prompts-research.js`)
```javascript
// AI identifies conflicts
POST /detect-contradictions
Response: {
  contradictions: [{
    type: "numerical|polarity|definitional|temporal",
    sources: ["GEMINI: 99.9% uptime", "GPT: 99.5% uptime"],
    resolution: "GEMINI source is more recent (2025 vs 2024)"
  }]
}
```

**Step 5: Synthesize Report** (`server/prompts-research.js`)
```markdown
# Research Synthesis Report

## Executive Summary
[AI-generated overview]

## Findings by Topic

### Security
**Consensus**: [High-agreement claims]
**Disagreement**: [Conflicting claims with sources]

## Evidence Gaps
- Claims without citations

## Sources
1. GEMINI - research_gemini.md
2. GPT - research_gpt.md
```

**Step 6: Audit Provenance** (`server/prompts-research.js`)
```javascript
// Verify all citations
POST /audit-provenance
Response: {
  issues: [{
    type: "hallucination|incorrect_attribution|missing_citation",
    severity: "critical|warning|info",
    location: "Section 3, Paragraph 2",
    description: "Claim not found in any source"
  }]
}
```

**Step 7: Verified Claims** (Client-side filtering)
```javascript
// Separate by consensus level
highConsensus: claims with 3+ sources agreeing
disputed: claims with contradictions
uncited: claims without provenance
```

**Step 8: Dashboard** (`Chart.js` visualizations)
```javascript
// Pie charts
- Citation Quality (95% cited, 5% uncited)
- Consensus Level (80% high, 15% medium, 5% disputed)
- Source Distribution by provider
```

### Key API Endpoints

```javascript
// Research Synthesis Routes (server/routes/research.js)
POST /upload-research-sources     // Step 1
POST /extract-claims              // Step 2
POST /detect-contradictions       // Step 4
POST /synthesize-report           // Step 5
POST /audit-provenance            // Step 6
POST /generate-dashboard          // Step 8

// Analytics Routes (server/routes/analytics.js)
POST /track-event                 // Track user actions
GET /analytics/summary            // Get usage summary
GET /analytics/events             // Get event history
```

### Database Schema

```sql
-- Analytics tracking
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY,
  eventType TEXT,              -- 'export_png', 'feature_executive_view', etc.
  eventData TEXT,              -- JSON metadata
  chartId TEXT,
  sessionId TEXT,
  createdAt INTEGER
);

-- Persistent storage
CREATE TABLE sessions (sessionId, research, filenames, createdAt, expiresAt);
CREATE TABLE charts (chartId, sessionId, ganttData, executiveSummary, ...);
CREATE TABLE jobs (jobId, status, progress, chartId, error, ...);
```

### Usage Patterns

**From Chart View**:
```javascript
// Auto-populate with existing research
1. View generated roadmap
2. Click hamburger menu → "Research Checker"
3. Click "Use Existing Research from Current Roadmap"
4. Skips Step 1 (upload), goes directly to Step 2 (extract claims)
```

**From Scratch**:
```javascript
1. Navigate to index.html
2. Click hamburger menu → "Research Checker"
3. Upload files from multiple LLM sessions
4. Assign provider to each file (GEMINI, GPT, CLAUDE, GROK)
5. Run through all 8 steps
```

### Prompts Location

All research synthesis prompts in `server/prompts-research.js`:
- `CLAIM_EXTRACTION_SYSTEM_PROMPT` + `CLAIM_EXTRACTION_SCHEMA`
- `CONTRADICTION_DETECTION_SYSTEM_PROMPT` + `CONTRADICTION_DETECTION_SCHEMA`
- `REPORT_SYNTHESIS_SYSTEM_PROMPT` + `REPORT_SYNTHESIS_SCHEMA`
- `PROVENANCE_AUDIT_SYSTEM_PROMPT` + `PROVENANCE_AUDIT_SCHEMA`
- `EXECUTIVE_SUMMARY_SYSTEM_PROMPT` + `EXECUTIVE_SUMMARY_SCHEMA`

All prompts use **temperature=0** for deterministic, structured outputs.
