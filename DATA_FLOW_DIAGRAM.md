# Data Flow Architecture: Research → Three Screens

## Visual Data Flow Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                              │
│                                                                       │
│  User uploads research files + custom prompt                         │
│  (PDFs, Word docs, text files, etc.)                                │
└────────────────────────────┬──────────────────────────────────────────┘
                             │
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (index.html)                            │
│                                                                       │
│  FormData:                                                           │
│  • files: [file1.pdf, file2.docx, ...]                              │
│  • prompt: "Generate roadmap for Q1 2025 product launch"            │
│                                                                       │
│  → POST /generate-content                                            │
└────────────────────────────┬──────────────────────────────────────────┘
                             │
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                   BACKEND: Content Controller                         │
│                   (server/routes/content.js)                          │
│                                                                       │
│  1. Create unique IDs:                                               │
│     • jobId = UUID()       (for polling progress)                    │
│     • sessionId = UUID()   (for storing all content)                 │
│                                                                       │
│  2. Initialize job status:                                           │
│     jobStore.set(jobId, {                                            │
│       status: 'processing',                                          │
│       progress: {                                                    │
│         roadmap: 'pending',    ← 0%                                  │
│         slides: 'pending',     ← 0%                                  │
│         document: 'pending'    ← 0%                                  │
│       }                                                               │
│     });                                                               │
│                                                                       │
│  3. Respond immediately:                                             │
│     res.json({ jobId, sessionId })                                   │
│                                                                       │
│  4. Start async processing:                                          │
│     processContent(files, prompt, sessionId, jobId)                  │
│                                                                       │
└────────────────────────────┬──────────────────────────────────────────┘
                             │
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    FRONTEND: Progress Polling                         │
│                    (main.js)                                          │
│                                                                       │
│  setInterval(() => {                                                 │
│    GET /job/:jobId                                                   │
│                                                                       │
│    Response:                                                         │
│    {                                                                 │
│      status: 'processing',                                           │
│      progress: {                                                     │
│        roadmap: 'complete',     ← Show ✓                            │
│        slides: 'processing',    ← Show ⏳                           │
│        document: 'pending'      ← Show ⏸                            │
│      }                                                               │
│    }                                                                 │
│                                                                       │
│    When status === 'complete':                                       │
│      → Redirect to chart.html?session={sessionId}#roadmap            │
│  }, 1000);  // Poll every second                                     │
│                                                                       │
└────────────────────────────┬──────────────────────────────────────────┘
                             │
                             │ (Meanwhile, backend is processing...)
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                  BACKEND: Parallel AI Processing                     │
│                  (async function processContent)                     │
│                                                                       │
│  Extract and prepare research data:                                  │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ researchContext = {                                    │         │
│  │   files: [...],  // Parsed text from PDFs/docs        │         │
│  │   prompt: "...", // User's custom instructions        │         │
│  │   metadata: { uploadDate, fileCount, ... }            │         │
│  │ }                                                      │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  Launch 3 parallel AI generation tasks:                              │
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐    │
│  │ ROADMAP GEN     │  │ SLIDES GEN      │  │ DOCUMENT GEN     │    │
│  │                 │  │                 │  │                  │    │
│  │ Input:          │  │ Input:          │  │ Input:           │    │
│  │ • research      │  │ • research      │  │ • research       │    │
│  │ • roadmapPrompt │  │ • slidesPrompt  │  │ • docPrompt      │    │
│  │                 │  │                 │  │                  │    │
│  │ Gemini API      │  │ Gemini API      │  │ Gemini API       │    │
│  │ ↓               │  │ ↓               │  │ ↓                │    │
│  │ Returns:        │  │ Returns:        │  │ Returns:         │    │
│  │ ganttData ✓     │  │ slidesData ✓    │  │ docData ✓        │    │
│  │ (2-3 sec)       │  │ (3-4 sec)       │  │ (4-5 sec)        │    │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘    │
│           │                    │                     │               │
│           └────────────────────┴─────────────────────┘               │
│                                │                                     │
│                    await Promise.all([...])                          │
│                                │                                     │
└────────────────────────────────┼──────────────────────────────────────┘
                                 ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND: Unified Storage                           │
│                    (sessionStore / Database)                          │
│                                                                       │
│  sessionStore.set(sessionId, {                                       │
│    ┌──────────────────────────────────────────────────────┐         │
│    │ SHARED RESEARCH CONTEXT                              │         │
│    │ ───────────────────────────────────────              │         │
│    │ research: {                                          │         │
│    │   files: [...],                                      │         │
│    │   rawText: "...",                                    │         │
│    │   metadata: {...}                                    │         │
│    │ },                                                   │         │
│    │ prompt: "Generate roadmap for Q1 2025...",          │         │
│    │ createdAt: "2025-11-24T10:30:00Z",                  │         │
│    │                                                      │         │
│    │ ─────────────────────────────────────────            │         │
│    │ VIEW 1: ROADMAP (Gantt Chart)                       │         │
│    │ ─────────────────────────────────────────            │         │
│    │ roadmap: {                                           │         │
│    │   title: "Q1 2025 Product Launch",                  │         │
│    │   timeColumns: ["Jan", "Feb", "Mar"],               │         │
│    │   data: [                                            │         │
│    │     {                                                │         │
│    │       title: "Phase 1: Research",                   │         │
│    │       entity: "Product Team",                       │         │
│    │       taskType: "task",                             │         │
│    │       bar: {                                         │         │
│    │         startCol: 0,                                 │         │
│    │         endCol: 1,                                   │         │
│    │         color: "priority-red"                        │         │
│    │       }                                              │         │
│    │     },                                               │         │
│    │     { ... more tasks ... }                          │         │
│    │   ],                                                 │         │
│    │   legend: [...]                                      │         │
│    │ },                                                   │         │
│    │                                                      │         │
│    │ ─────────────────────────────────────────            │         │
│    │ VIEW 2: SLIDES (Presentation)                       │         │
│    │ ─────────────────────────────────────────            │         │
│    │ slides: {                                            │         │
│    │   title: "Q1 2025 Product Launch Plan",            │         │
│    │   subtitle: "Strategic Overview",                   │         │
│    │   slides: [                                          │         │
│    │     {                                                │         │
│    │       slideNumber: 1,                                │         │
│    │       type: "title",                                 │         │
│    │       title: "Q1 2025 Product Launch",             │         │
│    │       content: {                                     │         │
│    │         subtitle: "Strategic Overview"              │         │
│    │       }                                              │         │
│    │     },                                               │         │
│    │     {                                                │         │
│    │       slideNumber: 2,                                │         │
│    │       type: "content",                               │         │
│    │       title: "Key Objectives",                      │         │
│    │       content: {                                     │         │
│    │         bullets: [                                   │         │
│    │           "Launch MVP by March 2025",               │         │
│    │           "Acquire 10K users in Q1",                │         │
│    │           "Achieve 95% uptime"                      │         │
│    │         ]                                            │         │
│    │       }                                              │         │
│    │     },                                               │         │
│    │     {                                                │         │
│    │       slideNumber: 3,                                │         │
│    │       type: "timeline",                              │         │
│    │       title: "Development Timeline",                │         │
│    │       content: {                                     │         │
│    │         timeline: {                                  │         │
│    │           items: [                                   │         │
│    │             {                                        │         │
│    │               date: "Jan 2025",                     │         │
│    │               milestone: "Research Complete",       │         │
│    │               description: "..."                    │         │
│    │             },                                       │         │
│    │             { ... more milestones ... }             │         │
│    │           ]                                          │         │
│    │         }                                            │         │
│    │       }                                              │         │
│    │     },                                               │         │
│    │     { ... 5-10 more slides ... }                   │         │
│    │   ],                                                 │         │
│    │   theme: {                                           │         │
│    │     primaryColor: "#1a73e8",                        │         │
│    │     secondaryColor: "#34a853"                       │         │
│    │   }                                                  │         │
│    │ },                                                   │         │
│    │                                                      │         │
│    │ ─────────────────────────────────────────            │         │
│    │ VIEW 3: DOCUMENT (Detailed Report)                  │         │
│    │ ─────────────────────────────────────────            │         │
│    │ document: {                                          │         │
│    │   title: "Q1 2025 Product Launch Plan",            │         │
│    │   subtitle: "Comprehensive Strategy Document",      │         │
│    │   authors: ["AI Generated from Research"],          │         │
│    │   date: "2025-11-24",                               │         │
│    │   tableOfContents: [                                │         │
│    │     { section: "1. Executive Summary", page: 1 },  │         │
│    │     { section: "2. Introduction", page: 2 },       │         │
│    │     {                                                │         │
│    │       section: "3. Market Analysis",                │         │
│    │       page: 3,                                       │         │
│    │       subsections: [                                 │         │
│    │         "3.1 Target Audience",                      │         │
│    │         "3.2 Competitive Landscape"                 │         │
│    │       ]                                              │         │
│    │     },                                               │         │
│    │     { ... more sections ... }                       │         │
│    │   ],                                                 │         │
│    │   sections: [                                        │         │
│    │     {                                                │         │
│    │       sectionNumber: "1",                           │         │
│    │       title: "Executive Summary",                   │         │
│    │       level: 1,                                      │         │
│    │       content: [                                     │         │
│    │         {                                            │         │
│    │           type: "paragraph",                         │         │
│    │           data: "This document outlines..."         │         │
│    │         },                                           │         │
│    │         {                                            │         │
│    │           type: "list",                              │         │
│    │           data: {                                    │         │
│    │             items: [                                 │         │
│    │               "Launch MVP by Q1 2025",              │         │
│    │               "Target 10K users",                   │         │
│    │               "..."                                  │         │
│    │             ]                                        │         │
│    │           }                                          │         │
│    │         }                                            │         │
│    │       ]                                              │         │
│    │     },                                               │         │
│    │     {                                                │         │
│    │       sectionNumber: "2",                           │         │
│    │       title: "Introduction",                        │         │
│    │       level: 1,                                      │         │
│    │       content: [...]                                 │         │
│    │     },                                               │         │
│    │     {                                                │         │
│    │       sectionNumber: "3.1",                         │         │
│    │       title: "Target Audience",                     │         │
│    │       level: 2,                                      │         │
│    │       content: [                                     │         │
│    │         {                                            │         │
│    │           type: "table",                             │         │
│    │           data: {                                    │         │
│    │             headers: ["Segment", "Size", "%"],      │         │
│    │             rows: [                                  │         │
│    │               ["Enterprise", "500", "45%"],         │         │
│    │               ["SMB", "300", "35%"],                │         │
│    │               ["Individual", "200", "20%"]          │         │
│    │             ]                                        │         │
│    │           }                                          │         │
│    │         }                                            │         │
│    │       ]                                              │         │
│    │     },                                               │         │
│    │     { ... 10-15 more sections ... }                │         │
│    │   ],                                                 │         │
│    │   appendices: [...]                                  │         │
│    │ }                                                    │         │
│    └──────────────────────────────────────────────────────┘         │
│  });                                                                 │
│                                                                       │
│  jobStore.set(jobId, { status: 'complete', sessionId });            │
│                                                                       │
└────────────────────────────┬──────────────────────────────────────────┘
                             │
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    FRONTEND: Multi-View App                           │
│                    (chart.html + Router.js)                           │
│                                                                       │
│  URL: chart.html?session={sessionId}#roadmap                         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ HEADER BAR                                             │         │
│  │ [☰] Force - Q1 2025 Product Launch    [⬇] [🔗]        │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ HAMBURGER MENU (when open)                             │         │
│  │                                                         │         │
│  │  📊 Roadmap      ← Currently active                    │         │
│  │  📽️ Slides                                             │         │
│  │  📄 Document                                            │         │
│  │                                                         │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ VIEW CONTAINER (content swaps based on hash)           │         │
│  │                                                         │         │
│  │  Router detects hash change → loads appropriate view:  │         │
│  │                                                         │         │
│  │  #roadmap   → RoadmapView.render(data.roadmap)        │         │
│  │  #slides    → SlidesView.render(data.slides)          │         │
│  │  #document  → DocumentView.render(data.document)      │         │
│  │                                                         │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
└────────────────────────────┬──────────────────────────────────────────┘
                             │
                             ↓
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ↓                  ↓                  ↓
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│ VIEW 1:         │ │ VIEW 2:         │ │ VIEW 3:          │
│ ROADMAP         │ │ SLIDES          │ │ DOCUMENT         │
│                 │ │                 │ │                  │
│ When active:    │ │ When active:    │ │ When active:     │
│                 │ │                 │ │                  │
│ GET /content/   │ │ GET /content/   │ │ GET /content/    │
│ {sessionId}/    │ │ {sessionId}/    │ │ {sessionId}/     │
│ roadmap         │ │ slides          │ │ document         │
│                 │ │                 │ │                  │
│ Returns:        │ │ Returns:        │ │ Returns:         │
│ { ganttData }   │ │ { slidesData }  │ │ { docData }      │
│                 │ │                 │ │                  │
│ Renders:        │ │ Renders:        │ │ Renders:         │
│ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌──────────────┐ │
│ │ Interactive │ │ │ │ Slide deck  │ │ │ │ Long-form    │ │
│ │ Gantt chart │ │ │ │ with nav    │ │ │ │ doc with TOC │ │
│ │             │ │ │ │             │ │ │ │              │ │
│ │ Features:   │ │ │ │ Features:   │ │ │ │ Features:    │ │
│ │ • Drag bars │ │ │ │ • Prev/Next │ │ │ │ • Sections   │ │
│ │ • Resize    │ │ │ │ • Keyboard  │ │ │ │ • Scroll spy │ │
│ │ • Colors    │ │ │ │ • Fullscr   │ │ │ │ • Export PDF │ │
│ │ • Export    │ │ │ │ • Print     │ │ │ │ • Search     │ │
│ │ • Chat AI   │ │ │ │ • Notes     │ │ │ │ • Print      │ │
│ └─────────────┘ │ │ └─────────────┘ │ │ └──────────────┘ │
└─────────────────┘ └─────────────────┘ └──────────────────┘
```

## Key Data Transformations

### Research Files → Structured Data

```javascript
// Input: Raw research files
[
  { name: "market-research.pdf", content: "..." },
  { name: "user-interviews.docx", content: "..." },
  { name: "competitor-analysis.txt", content: "..." }
]

// Gemini API Processing:
// 1. Extract key information
// 2. Identify timelines, tasks, milestones
// 3. Structure according to each view's schema

// Output 1: ROADMAP (Gantt structure)
{
  timeColumns: ["Jan 2025", "Feb 2025", "Mar 2025"],
  data: [
    {
      title: "Market Research",
      entity: "Research Team",
      taskType: "task",
      bar: { startCol: 0, endCol: 1, color: "priority-red" }
    },
    // ... derived from research content
  ]
}

// Output 2: SLIDES (Presentation structure)
{
  slides: [
    {
      slideNumber: 1,
      type: "title",
      title: "Product Launch Plan",
      content: { subtitle: "Based on market research" }
    },
    {
      slideNumber: 2,
      type: "content",
      title: "Key Findings",
      content: {
        bullets: [
          "Market size: $500M",
          "Target: Enterprise users",
          "Competition: 3 major players"
        ]
      }
    },
    // ... distilled from research
  ]
}

// Output 3: DOCUMENT (Detailed report structure)
{
  sections: [
    {
      sectionNumber: "1",
      title: "Executive Summary",
      level: 1,
      content: [
        {
          type: "paragraph",
          data: "Based on comprehensive market research..."
        }
      ]
    },
    {
      sectionNumber: "2",
      title: "Market Analysis",
      level: 1,
      content: [
        {
          type: "table",
          data: {
            headers: ["Competitor", "Market Share", "Key Feature"],
            rows: [
              ["Competitor A", "45%", "AI-powered"],
              ["Competitor B", "30%", "Enterprise focus"],
              ["Competitor C", "15%", "Low cost"]
            ]
          }
        }
      ]
    },
    // ... comprehensive analysis from research
  ]
}
```

## State Synchronization Pattern

```javascript
// Shared state manager keeps all views in sync
class ContentState {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.data = {
      roadmap: null,
      slides: null,
      document: null
    };
    this.currentView = 'roadmap';
  }

  async loadView(viewName) {
    // Check cache first
    if (this.data[viewName]) {
      return this.data[viewName];
    }

    // Fetch from server
    const response = await fetch(`/content/${this.sessionId}/${viewName}`);
    const data = await response.json();

    // Cache for instant view switching
    this.data[viewName] = data;

    return data;
  }

  switchView(viewName) {
    this.currentView = viewName;
    window.location.hash = viewName;
    // Router handles rendering
  }
}
```

## Performance Optimization

### Lazy Loading Strategy

```javascript
// Only load view data when needed
Router.on('roadmap', async () => {
  const data = await state.loadView('roadmap');  // Fetch on demand
  roadmapView.render(data);
});

Router.on('slides', async () => {
  const data = await state.loadView('slides');   // Fetch on demand
  slidesView.render(data);
});

Router.on('document', async () => {
  const data = await state.loadView('document'); // Fetch on demand
  documentView.render(data);
});
```

### Prefetching Strategy (Optional Enhancement)

```javascript
// After roadmap loads, prefetch other views in background
async function prefetchOtherViews(currentView) {
  const otherViews = ['roadmap', 'slides', 'document'].filter(v => v !== currentView);

  // Low priority background fetch
  setTimeout(() => {
    otherViews.forEach(view => state.loadView(view));
  }, 2000);  // Wait 2 seconds, then prefetch
}

// Usage:
Router.on('roadmap', async () => {
  const data = await state.loadView('roadmap');
  roadmapView.render(data);
  prefetchOtherViews('roadmap');  // Fetch slides & document in background
});
```

## Error Handling Flow

```
┌──────────────────────────────────────┐
│ Error Scenarios                      │
├──────────────────────────────────────┤
│                                      │
│ 1. AI Generation Fails               │
│    ├─ Roadmap fails                  │
│    │  → Show error in roadmap view   │
│    │  → Slides & doc still work      │
│    │                                  │
│    ├─ All fail                        │
│    │  → Show friendly error page     │
│    │  → Offer retry button            │
│    │                                  │
│    └─ Partial failure                │
│       → Mark failed view              │
│       → Allow retry for failed only  │
│                                      │
│ 2. Network Errors                    │
│    → Retry with exponential backoff  │
│    → Show offline indicator          │
│    → Cache last successful load      │
│                                      │
│ 3. Session Expired (TTL)             │
│    → Redirect to upload page         │
│    → Show "Session expired" message  │
│    → Offer to upload again           │
│                                      │
└──────────────────────────────────────┘
```

## Data Persistence Options

### Option A: In-Memory (Current)
- ✅ Fast
- ✅ Simple
- ❌ Lost on restart
- ❌ 1-hour TTL

### Option B: SQLite (Recommended)
- ✅ Persistent
- ✅ Fast queries
- ✅ No external dependencies
- ✅ File-based (easy backup)

### Option C: PostgreSQL (Future Scale)
- ✅ Production-grade
- ✅ Multi-user support
- ✅ Advanced queries
- ❌ Requires separate service

## Recommended: SQLite Implementation

```javascript
// server/db.js
import Database from 'better-sqlite3';
const db = new Database('force.db');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    research_files TEXT,      -- JSON array
    prompt TEXT,
    roadmap_data TEXT,        -- JSON
    slides_data TEXT,         -- JSON
    document_data TEXT,       -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_created_at ON sessions(created_at);
`);

// Save session
export function saveSession(sessionId, data) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sessions
    (session_id, research_files, prompt, roadmap_data, slides_data, document_data, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run(
    sessionId,
    JSON.stringify(data.research),
    data.prompt,
    JSON.stringify(data.roadmap),
    JSON.stringify(data.slides),
    JSON.stringify(data.document)
  );
}

// Get session
export function getSession(sessionId) {
  const stmt = db.prepare('SELECT * FROM sessions WHERE session_id = ?');
  const row = stmt.get(sessionId);

  if (!row) return null;

  return {
    sessionId: row.session_id,
    research: JSON.parse(row.research_files),
    prompt: row.prompt,
    roadmap: JSON.parse(row.roadmap_data),
    slides: JSON.parse(row.slides_data),
    document: JSON.parse(row.document_data),
    createdAt: row.created_at
  };
}

// Get specific view data
export function getViewData(sessionId, viewName) {
  const stmt = db.prepare(`SELECT ${viewName}_data FROM sessions WHERE session_id = ?`);
  const row = stmt.get(sessionId);

  return row ? JSON.parse(row[`${viewName}_data`]) : null;
}
```

---

## Summary: Data Flow Principles

1. **Single Upload, Multiple Outputs**
   - User uploads once
   - AI generates three formats in parallel
   - All views share same research context

2. **Lazy Loading**
   - Fetch view data only when navigating to it
   - Reduces initial load time
   - Smoother user experience

3. **Shared State**
   - sessionId ties everything together
   - Easy navigation between views
   - Consistent data across screens

4. **Progressive Enhancement**
   - Start with roadmap (existing)
   - Add slides next (simpler)
   - Add document last (most complex)

5. **Error Resilience**
   - Partial failures are okay
   - Each view independent
   - Retry mechanisms built in

This architecture ensures **clean data flow**, **excellent UX**, and **easy maintenance** as you scale to three screens.
