# Codebase Scalability & Maintainability Assessment

## Executive Summary

**Overall Rating: 8/10** - Your codebase is well-architected for adding new screens (Slides & Documents). The modular component system, hash-based routing, and clean separation of concerns make horizontal scaling straightforward.

**Can you easily add Slides and Documents views?**
✅ **YES** - The architecture is already positioned for this expansion.

---

## Current Architecture Assessment

### Strengths ✅

1. **Modular Component System**
   - Class-based ES6 components with clear responsibilities
   - Each component is self-contained (GanttChart, TaskAnalyzer, ChatInterface)
   - Easy to add new view components following existing patterns

2. **Routing Infrastructure Ready**
   - Hash-based Router.js already implemented
   - HamburgerMenu navigation system in place
   - Just need to add new routes and menu items

3. **Consistent Data Flow Pattern**
   - Upload → AI Processing → Storage → Render
   - Same pattern can be reused for all three screens
   - Session-based data sharing already working

4. **Clean API Design**
   - RESTful endpoints with async job processing
   - Zod schema validation for data integrity
   - Easy to extend with new endpoints

5. **Shared Utilities**
   - Utils.js provides reusable helpers
   - Consistent error handling patterns
   - Configuration-driven approach

### Current Limitations ⚠️

1. **No Centralized State Management**
   - Each component manages own state
   - Could cause data synchronization issues across views
   - No single source of truth for research data on client

2. **In-Memory Storage Only**
   - Data lost after 1 hour TTL
   - No persistence between sessions
   - Will be problematic for document editing workflows

3. **Single Data Output Format**
   - Gemini currently only generates Gantt chart JSON
   - Need to extend AI prompts for Slides and Document formats
   - No unified content model

4. **No Build System**
   - Vanilla JS means no tree-shaking or optimization
   - Manual dependency management
   - Harder to share code between views

5. **Monolithic Components**
   - GanttChart.js is 1,945 lines
   - Could be broken into smaller sub-components
   - Would improve testability and reusability

---

## Three-Screen Architecture Design

### Proposed Screen Layout

```
┌─────────────────────────────────────────┐
│  [☰] Force - Project Research Platform  │  ← Header with HamburgerMenu
├─────────────────────────────────────────┤
│                                         │
│  Navigation (HamburgerMenu):            │
│  • 📊 Roadmap   (existing - Gantt)     │
│  • 📽️ Slides    (new - Presentation)   │
│  • 📄 Document  (new - Report)         │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │                                   │ │
│  │   [Active View Renders Here]     │ │
│  │                                   │ │
│  │   - RoadmapView (GanttChart)     │ │
│  │   - SlidesView                   │ │
│  │   - DocumentView                 │ │
│  │                                   │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Google Docs-like UI Principles

**Visual Design Goals:**
- Clean white background with subtle shadows
- Consistent typography hierarchy
- Generous whitespace
- Minimal chrome, maximum content
- Smooth transitions between views
- Responsive design (mobile-first)

**Implementation Approach:**
- Use TailwindCSS utility classes (already included)
- Create shared design tokens in CSS variables
- Implement card-based layouts for content sections
- Add subtle animations (fade-in, slide transitions)
- Use system fonts for fast loading (Inter, SF Pro, Segoe UI)

---

## Data Flow Architecture: Research → Three Screens

### Current Flow (Roadmap Only)

```
┌──────────────┐
│ User Uploads │
│ Research     │
│ Files +      │
│ Prompt       │
└──────┬───────┘
       │
       ↓
┌──────────────────────────────────────┐
│ POST /generate-chart                 │
│ • Creates async job                  │
│ • Stores files + prompt              │
│ • Returns jobId                      │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ Server Processing (Gemini API)       │
│ • Analyzes research files            │
│ • Uses ganttPrompt template          │
│ • Returns ganttData JSON             │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ Storage (sessionStore + chartStore)  │
│ • sessionId → research data          │
│ • chartId → ganttData                │
│ • TTL: 1 hour                        │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ Frontend Rendering                   │
│ • GET /chart/:id                     │
│ • GanttChart.render()                │
│ • Interactive features               │
└──────────────────────────────────────┘
```

### Proposed Flow (Three Screens)

```
┌────────────────────────────────────────────────────────┐
│ User Uploads Research Files + Prompt                   │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│ POST /generate-content (NEW unified endpoint)          │
│ • Creates async job                                    │
│ • Stores research + prompt + sessionId                 │
│ • Returns jobId                                        │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│ Server Processing (Parallel AI Generation)             │
│                                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────┐│
│  │ Gemini API      │  │ Gemini API      │  │ Gemini  ││
│  │ roadmapPrompt   │  │ slidesPrompt    │  │ docPrompt││
│  │ ↓               │  │ ↓               │  │ ↓       ││
│  │ ganttData       │  │ slidesData      │  │ docData ││
│  └─────────────────┘  └─────────────────┘  └─────────┘│
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│ Unified Storage (contentStore)                         │
│                                                        │
│  sessionId → {                                         │
│    research: [...files],                              │
│    prompt: "...",                                      │
│    roadmap: { ganttData },     ← existing             │
│    slides: { slidesData },     ← new                  │
│    document: { docData },      ← new                  │
│    metadata: { createdAt, ... }                       │
│  }                                                     │
│                                                        │
│  TTL: Extended to 24 hours (or persistent DB)         │
└────────────────┬───────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────┐
│ Frontend Multi-View Rendering                          │
│                                                        │
│  Router.js handles hash navigation:                   │
│                                                        │
│  #roadmap → GET /content/:sessionId/roadmap           │
│             ↓                                         │
│             RoadmapView.render(ganttData)             │
│                                                        │
│  #slides  → GET /content/:sessionId/slides            │
│             ↓                                         │
│             SlidesView.render(slidesData)             │
│                                                        │
│  #document → GET /content/:sessionId/document         │
│             ↓                                         │
│             DocumentView.render(docData)              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Key Data Flow Improvements

1. **Unified Content Generation**
   - Single upload generates all three formats simultaneously
   - User sees progress for each view
   - All views share same research context

2. **Shared Session Context**
   - sessionId ties all views together
   - Easy navigation between views without re-uploading
   - Consistent data across all screens

3. **Parallel Processing**
   - Generate all formats at once (faster)
   - Show progress indicators for each
   - User can start viewing one while others load

4. **View-Specific Data Endpoints**
   - `/content/:sessionId/roadmap`
   - `/content/:sessionId/slides`
   - `/content/:sessionId/document`
   - Each returns only the data needed for that view

---

## Data Schemas for New Screens

### Slides Data Schema

```javascript
// slidesData structure
{
  title: string,
  subtitle: string,
  slides: [
    {
      slideNumber: number,
      type: "title" | "content" | "timeline" | "summary",
      title: string,
      content: {
        // For content slides:
        bullets?: string[],
        // For timeline slides:
        timeline?: {
          items: [
            {
              date: string,
              milestone: string,
              description: string
            }
          ]
        },
        // For summary slides:
        summary?: {
          keyPoints: string[],
          nextSteps: string[]
        }
      },
      notes?: string  // Speaker notes
    }
  ],
  theme: {
    primaryColor: string,
    secondaryColor: string,
    font: string
  }
}
```

**Gemini Prompt Strategy:**
```
Analyze the research files and create a presentation with:
- Executive summary slide
- Key findings (3-5 slides)
- Timeline/roadmap slide
- Recommendations slide
- Next steps slide

Format as JSON matching slidesData schema...
```

### Document Data Schema

```javascript
// docData structure
{
  title: string,
  subtitle: string,
  authors: string[],
  date: string,
  tableOfContents: [
    {
      section: string,
      page: number,
      subsections?: string[]
    }
  ],
  sections: [
    {
      sectionNumber: string,  // "1", "1.1", "2.3.1"
      title: string,
      level: number,  // 1 = h1, 2 = h2, etc.
      content: [
        {
          type: "paragraph" | "list" | "table" | "quote" | "image",
          data: any
        }
      ]
    }
  ],
  appendices?: [
    {
      title: string,
      content: any
    }
  ],
  references?: string[]
}
```

**Gemini Prompt Strategy:**
```
Analyze the research files and create a comprehensive document with:
1. Executive Summary
2. Introduction
3. Methodology
4. Findings (with subsections)
5. Analysis
6. Recommendations
7. Conclusion
8. Appendices (if needed)

Format as structured JSON matching docData schema...
Include tables, lists, and quotes where appropriate.
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1) ✅ Mostly Done

- [x] Modular component architecture
- [x] Hash-based routing
- [x] HamburgerMenu navigation
- [x] Session-based storage
- [ ] **TODO: Extend storage to support multi-view data**
- [ ] **TODO: Create unified content generation endpoint**

### Phase 2: Slides View (Week 2-3)

1. **Create SlidesView Component** (`Public/SlidesView.js`)
   ```javascript
   export class SlidesView {
     constructor(container, slidesData, sessionId) {
       this.container = container;
       this.slidesData = slidesData;
       this.sessionId = sessionId;
       this.currentSlide = 0;
     }

     render() {
       // Create slide navigation (prev/next buttons)
       // Render current slide
       // Add keyboard navigation (arrow keys)
       // Fullscreen mode support
     }

     navigateToSlide(index) { ... }
     nextSlide() { ... }
     previousSlide() { ... }
     toggleFullscreen() { ... }
   }
   ```

2. **Add Slides Prompt** (`server/prompts.js`)
   - Define slidesPrompt with instructions
   - Define slidesSchema (Zod validation)
   - Test with sample research files

3. **Update Router** (`Public/Router.js`)
   ```javascript
   this.routes = {
     'roadmap': () => this.showSection('roadmap'),
     'slides': () => this.showSection('slides')  // NEW
   };
   ```

4. **Update HamburgerMenu** (`Public/HamburgerMenu.js`)
   - Add "📽️ Slides" menu item
   - Update active state logic

5. **Add API Endpoint** (`server/routes/content.js`)
   ```javascript
   router.get('/content/:sessionId/slides', async (req, res) => {
     const session = sessionStore.get(sessionId);
     const slidesData = session.slides;
     res.json(slidesData);
   });
   ```

6. **UI Design** (Google Docs style)
   - Clean slide templates with TailwindCSS
   - Slide counter (e.g., "3 / 12")
   - Subtle animations between slides
   - Print-friendly CSS

### Phase 3: Document View (Week 4-5)

1. **Create DocumentView Component** (`Public/DocumentView.js`)
   ```javascript
   export class DocumentView {
     constructor(container, docData, sessionId) {
       this.container = container;
       this.docData = docData;
       this.sessionId = sessionId;
     }

     render() {
       // Render table of contents (sticky sidebar)
       // Render sections with proper hierarchy
       // Add scroll spy for active section highlighting
       // Export to PDF functionality
     }

     scrollToSection(sectionId) { ... }
     exportToPDF() { ... }
   }
   ```

2. **Add Document Prompt** (`server/prompts.js`)
   - Define documentPrompt
   - Define documentSchema
   - Include rich formatting instructions

3. **Update Router & Menu**
   - Add "#document" route
   - Add "📄 Document" menu item

4. **Add API Endpoint**
   ```javascript
   router.get('/content/:sessionId/document', async (req, res) => {
     const session = sessionStore.get(sessionId);
     const docData = session.document;
     res.json(docData);
   });
   ```

5. **UI Design**
   - Google Docs-like reading experience
   - Max-width container (800px) for readability
   - Sticky table of contents sidebar
   - Typography optimized for long-form reading
   - Print styles for PDF export

### Phase 4: Unified Generation (Week 6)

1. **Replace `/generate-chart` with `/generate-content`**
   ```javascript
   router.post('/generate-content', async (req, res) => {
     const jobId = crypto.randomUUID();
     const sessionId = crypto.randomUUID();

     jobStore.set(jobId, {
       status: 'processing',
       progress: {
         roadmap: 'pending',
         slides: 'pending',
         document: 'pending'
       }
     });

     // Async processing
     processContent(files, prompt, sessionId, jobId);

     res.json({ jobId, sessionId });
   });

   async function processContent(files, prompt, sessionId, jobId) {
     // Generate all three in parallel
     const [roadmap, slides, document] = await Promise.all([
       generateRoadmap(files, prompt),
       generateSlides(files, prompt),
       generateDocument(files, prompt)
     ]);

     sessionStore.set(sessionId, {
       research: files,
       prompt,
       roadmap,
       slides,
       document,
       createdAt: new Date()
     });

     jobStore.set(jobId, { status: 'complete', sessionId });
   }
   ```

2. **Update Frontend** (`Public/main.js`)
   - Poll for all three generation statuses
   - Show progress for each view
   - Redirect to `chart.html?session={sessionId}#roadmap` when complete

3. **Update chart.html**
   - Read sessionId from URL instead of chartId
   - Load appropriate view based on hash route
   - Handle view switching seamlessly

### Phase 5: Polish & UX (Week 7)

1. **Shared UI Components**
   - Create `LoadingSpinner.js`
   - Create `ErrorMessage.js`
   - Create `ProgressIndicator.js`

2. **Animations & Transitions**
   - Fade in/out between views
   - Slide animations for navigation
   - Smooth scrolling

3. **Responsive Design**
   - Mobile-friendly layouts
   - Touch gestures for slides (swipe)
   - Collapsible table of contents

4. **Accessibility**
   - ARIA labels
   - Keyboard navigation
   - Screen reader support
   - Focus management

5. **Export Features**
   - Roadmap: PNG/SVG (already exists)
   - Slides: PDF export
   - Document: PDF export
   - All: JSON data download

---

## Recommended Architecture Improvements

### 1. Add Persistent Storage

**Problem:** In-memory storage loses data after 1 hour

**Solution:** Add SQLite or PostgreSQL
```javascript
// server/db.js
import Database from 'better-sqlite3';
const db = new Database('force.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    research TEXT,
    prompt TEXT,
    roadmap TEXT,
    slides TEXT,
    document TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export function saveSession(sessionId, data) {
  const stmt = db.prepare(`
    INSERT INTO sessions (session_id, research, prompt, roadmap, slides, document)
    VALUES (?, ?, ?, ?, ?, ?)
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

export function getSession(sessionId) {
  const stmt = db.prepare('SELECT * FROM sessions WHERE session_id = ?');
  const row = stmt.get(sessionId);
  return row ? {
    research: JSON.parse(row.research),
    prompt: row.prompt,
    roadmap: JSON.parse(row.roadmap),
    slides: JSON.parse(row.slides),
    document: JSON.parse(row.document)
  } : null;
}
```

### 2. Add Client-Side State Management

**Problem:** No single source of truth for data across views

**Solution:** Implement simple reactive state manager
```javascript
// Public/StateManager.js
export class StateManager {
  constructor() {
    this.state = {
      sessionId: null,
      currentView: 'roadmap',
      data: {
        roadmap: null,
        slides: null,
        document: null
      },
      loading: {
        roadmap: false,
        slides: false,
        document: false
      }
    };
    this.listeners = [];
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  async loadView(viewName) {
    this.setState({
      loading: { ...this.state.loading, [viewName]: true }
    });

    try {
      const response = await fetch(`/content/${this.state.sessionId}/${viewName}`);
      const data = await response.json();

      this.setState({
        data: { ...this.state.data, [viewName]: data },
        loading: { ...this.state.loading, [viewName]: false }
      });
    } catch (error) {
      console.error(`Failed to load ${viewName}:`, error);
      this.setState({
        loading: { ...this.state.loading, [viewName]: false }
      });
    }
  }
}

// Usage in components
const state = new StateManager();
state.subscribe((newState) => {
  if (newState.data.roadmap) {
    ganttChart.render(newState.data.roadmap);
  }
});
```

### 3. Add Build System (Optional but Recommended)

**Problem:** Manual module management, no optimization

**Solution:** Add Vite for development
```bash
npm install -D vite
```

```javascript
// vite.config.js
export default {
  root: 'Public',
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: {
        main: 'Public/index.html',
        chart: 'Public/chart.html'
      }
    }
  }
};
```

**Benefits:**
- Hot module replacement (HMR)
- Automatic dependency bundling
- Tree-shaking for smaller builds
- TypeScript support if desired
- CSS preprocessing

### 4. Component Refactoring

**Problem:** GanttChart.js is 1,945 lines

**Solution:** Break into smaller components
```
GanttChart.js (orchestrator - 300 lines)
├── GanttHeader.js (title, legend - 100 lines)
├── GanttGrid.js (columns, rows - 200 lines)
├── GanttBars.js (task bars - 150 lines)
├── GanttSwimlanes.js (swimlane rendering - 100 lines)
├── GanttInteractions.js (drag, resize, context - 400 lines)
├── GanttExport.js (PNG, SVG export - 200 lines)
└── GanttTimeline.js (date calculations - 150 lines)
```

**Benefits:**
- Easier testing
- Better reusability
- Clearer responsibilities
- Simpler debugging

### 5. Design System

**Problem:** Inconsistent styling across views

**Solution:** Create design tokens
```css
/* Public/design-system.css */
:root {
  /* Colors (Google Docs inspired) */
  --color-primary: #1a73e8;
  --color-surface: #ffffff;
  --color-background: #f8f9fa;
  --color-border: #e0e0e0;
  --color-text-primary: #202124;
  --color-text-secondary: #5f6368;

  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

  /* Layout */
  --container-max-width: 1200px;
  --content-max-width: 800px;
  --sidebar-width: 240px;

  /* Animations */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 350ms ease;
}

/* Shared component styles */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  padding: var(--spacing-sm) var(--spacing-lg);
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.btn-primary:hover {
  opacity: 0.9;
}

.container {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.content {
  max-width: var(--content-max-width);
  margin: 0 auto;
}
```

---

## Google Docs-like UI Implementation Guide

### Layout Structure

```html
<!-- chart.html updated structure -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Force - Research Platform</title>
  <link href="design-system.css" rel="stylesheet">
  <link href="style.css" rel="stylesheet">
</head>
<body class="bg-background">
  <!-- Header -->
  <header class="header-bar">
    <div class="header-content">
      <button id="hamburger-btn" class="hamburger-trigger">
        <span class="hamburger-icon">☰</span>
      </button>
      <h1 class="header-title">Force</h1>
      <div class="header-actions">
        <button class="btn-icon" title="Export">
          <span>⬇</span>
        </button>
        <button class="btn-icon" title="Share">
          <span>🔗</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content Area -->
  <main class="main-content">
    <!-- View Container (swapped by Router) -->
    <div id="view-container" class="view-container">
      <!-- RoadmapView, SlidesView, or DocumentView renders here -->
    </div>
  </main>

  <!-- HamburgerMenu Overlay -->
  <div id="hamburger-menu"></div>

  <script type="module" src="chart-renderer.js"></script>
</body>
</html>
```

### Styles for Google Docs Feel

```css
/* Header bar (like Google Docs top bar) */
.header-bar {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-sm);
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-lg);
  max-width: 100%;
}

.header-title {
  font-size: var(--font-size-xl);
  font-weight: 400;
  color: var(--color-text-primary);
  margin: 0;
  flex-grow: 1;
}

.hamburger-trigger {
  background: none;
  border: none;
  padding: var(--spacing-sm);
  cursor: pointer;
  border-radius: 50%;
  transition: background var(--transition-fast);
}

.hamburger-trigger:hover {
  background: var(--color-background);
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn-icon {
  background: none;
  border: none;
  padding: var(--spacing-sm);
  cursor: pointer;
  border-radius: 4px;
  transition: background var(--transition-fast);
}

.btn-icon:hover {
  background: var(--color-background);
}

/* Main content area */
.main-content {
  min-height: calc(100vh - 60px);
  background: var(--color-background);
  padding: var(--spacing-2xl) 0;
}

.view-container {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 var(--spacing-lg);
}

/* Document view specific (reading mode) */
.document-view {
  max-width: var(--content-max-width);
  background: var(--color-surface);
  margin: 0 auto;
  padding: var(--spacing-2xl);
  box-shadow: var(--shadow-md);
  border-radius: 8px;
  line-height: 1.6;
}

.document-view h1 {
  font-size: var(--font-size-3xl);
  font-weight: 400;
  margin-bottom: var(--spacing-xl);
  color: var(--color-text-primary);
}

.document-view h2 {
  font-size: var(--font-size-2xl);
  font-weight: 500;
  margin-top: var(--spacing-xl);
  margin-bottom: var(--spacing-md);
  color: var(--color-text-primary);
}

.document-view p {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
}

/* Slides view (presentation mode) */
.slides-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

.slide {
  background: var(--color-surface);
  width: 100%;
  max-width: 960px;
  aspect-ratio: 16 / 9;
  box-shadow: var(--shadow-lg);
  border-radius: 8px;
  padding: var(--spacing-2xl);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.slide-title {
  font-size: var(--font-size-3xl);
  font-weight: 300;
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-primary);
}

.slide-content {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
}

.slide-navigation {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.slide-counter {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Roadmap view (existing Gantt chart) */
.roadmap-view {
  background: var(--color-surface);
  border-radius: 8px;
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-md);
}
```

---

## Final Recommendations

### ✅ DO These Now

1. **Extend storage model** to support multi-view data structure
2. **Create unified `/generate-content` endpoint** for parallel processing
3. **Add SlidesView component** following existing patterns
4. **Add DocumentView component** with Google Docs styling
5. **Implement design system** with CSS variables
6. **Add persistent storage** (SQLite at minimum)

### ⚠️ Consider for Future

1. **Build system** (Vite) for better DX and optimization
2. **TypeScript migration** for type safety
3. **Component testing** (Vitest + Testing Library)
4. **User authentication** if making this multi-tenant
5. **Real-time collaboration** (like Google Docs) using WebSockets
6. **Version history** for documents

### ❌ Don't Do (Anti-patterns)

1. Don't add React/Vue/Angular - vanilla JS is working well
2. Don't over-engineer - keep it simple
3. Don't create abstractions prematurely
4. Don't add features nobody asked for
5. Don't break existing GanttChart functionality

---

## Summary

Your codebase is **well-positioned for scaling to three screens**. The modular architecture, routing infrastructure, and clean separation of concerns make this expansion straightforward. Focus on:

1. **Data flow unification** - Generate all three formats from single upload
2. **Consistent UI patterns** - Google Docs-like design system
3. **Shared state management** - Single source of truth
4. **Persistent storage** - Don't lose user data

The existing component patterns (class-based ES6) should be maintained for consistency. Each new view follows the same structure as GanttChart, making the learning curve minimal for future developers.

**Estimated effort:** 6-7 weeks for full three-screen implementation with polish.

**Next steps:** Start with Phase 2 (Slides View) to validate the architecture, then proceed to Document View once patterns are proven.
