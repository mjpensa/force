# Codebase Assessment Prompt for Opus 4.1

You are an expert software architect reviewing a codebase for maintainability and scalability. Please conduct a thorough assessment focusing on the feasibility of adding new features.

## Context

This is an **AI Roadmap Generator** web application with the following architecture:

### Current Tech Stack
- **Frontend**: Vanilla JavaScript (ES6 modules), no framework
- **UI**: Tailwind CSS + custom CSS
- **Backend**: Node.js with Express
- **Components**: Class-based OOP pattern
- **Routing**: Simple hash-based routing (`Router.js`)
- **State**: Local component state, no centralized state management
- **Storage**: In-memory (Maps), no database persistence
- **AI**: Gemini API integration for document analysis

### Current Features
- Document upload (.md, .txt, .docx)
- AI-powered Gantt chart generation from documents
- Interactive Gantt chart with drag-to-edit, resize, export (PNG/SVG)
- Task analysis with AI Q&A chat interface
- Single-page navigation with hamburger menu

### Current Architecture Patterns

**Component Structure:**
```javascript
export class ComponentName {
  constructor(dependencies) {
    // Dependency injection
  }

  render() {
    // DOM manipulation
  }

  // Event handlers and methods
}
```

**Data Flow:**
```
User Action → Component → API Call → Server → Gemini AI → Response → Component Update → DOM Update
```

**File Organization:**
```
Public/
├── index.html (upload form)
├── chart.html (chart display)
├── main.js (app orchestration)
├── chart-renderer.js (chart page orchestration)
├── Router.js (hash-based routing)
├── GanttChart.js (63KB - main chart component)
├── TaskAnalyzer.js (modal with AI chat)
├── ChatInterface.js (Q&A interface)
├── HamburgerMenu.js (navigation)
└── [other components...]

server/
├── server.js (Express app)
├── gemini.js (AI integration)
├── storage.js (in-memory Maps)
├── prompts.js (AI prompts)
└── routes/ (API endpoints)
```

### Existing Multi-View Plan

An `ARCHITECTURE_UPGRADE_PLAN.md` exists with a v2 data model:
```javascript
{
  version: 2,
  views: {
    roadmap: { timeColumns, data },
    documents: { files: [...] },
    slides: { files: [...] }
  }
}
```

## Assessment Request

### Primary Objective
Evaluate how easily this codebase can be extended to include:

1. **Document Viewer Screen**
   - Display uploaded documents (.docx, .pdf, .md, .txt)
   - Google Docs-like UI: clean, elegant, simple
   - Intuitive reading experience
   - Minimal but effective controls

2. **Slide Presentation Viewer Screen**
   - Display slide-based content
   - Google Slides-like UI: clean, modern, focused
   - Simple navigation (prev/next, thumbnails)
   - Presentation mode support

### Specific Questions to Address

#### 1. Architecture Compatibility
- Does the current vanilla JS + class-based component approach support building these new screens efficiently?
- Would the lack of a reactive framework (React/Vue) become a limitation?
- Is the hash-based routing system adequate for multiple views, or should it be upgraded?
- Can the current state management approach (local component state) scale to handle document/slide state?

#### 2. Code Maintainability
- Are the existing patterns (class-based components, dependency injection) maintainable as the app grows?
- Will adding 2-3 more major screens create maintenance burden?
- Is the component composition pattern (GanttChart → DraggableGantt, ResizableGantt, etc.) scalable?
- Are there code smells or anti-patterns that will cause issues?

#### 3. UI/UX Implementation Feasibility
- How difficult will it be to create a Google Docs-like document viewer with the current Tailwind + custom CSS approach?
- Can the existing component patterns support the interactive UI needed for document/slide viewing?
- Should PDF.js or similar libraries be integrated? How would they fit?
- Will the manual DOM manipulation become unwieldy for complex viewers?

#### 4. Data Layer Scalability
- Is in-memory storage sufficient for storing document/slide metadata and content?
- Should a database be introduced? When?
- How should uploaded documents be stored (filesystem, cloud storage)?
- Will the current session-based approach work for multi-view navigation?

#### 5. Performance Considerations
- Will loading large PDFs or presentations impact performance with vanilla JS?
- Are there optimizations needed (lazy loading, virtualization, caching)?
- How will the bundle size be affected (currently ~179KB frontend JS)?

#### 6. Backward Compatibility
- How can new screens be added without breaking existing Gantt chart functionality?
- Is the planned v2 data model (with `views` object) the right approach?
- Migration strategy assessment?

#### 7. Developer Experience
- How easy would it be for a new developer to add a third screen type (e.g., "Kanban Board")?
- Is the learning curve reasonable given the vanilla JS approach?
- Are there missing abstractions or utilities?

### Desired Assessment Format

Please provide:

1. **Executive Summary** (2-3 paragraphs)
   - Overall maintainability score (1-10)
   - Overall scalability score (1-10)
   - Can document/slide screens be easily added? (Yes/No/With Refactoring)

2. **Detailed Analysis**
   - Architecture strengths and weaknesses
   - Specific risks or blockers for adding new screens
   - Code patterns that help vs. hinder extensibility

3. **Recommendations**
   - Should the tech stack be modified? (e.g., introduce React, Vue, or stay vanilla?)
   - Refactoring priorities (if any)
   - Library recommendations for document/slide viewing
   - State management improvements needed

4. **Implementation Roadmap**
   - Step-by-step plan for adding document viewer screen
   - Step-by-step plan for adding slides viewer screen
   - Estimated complexity (hours/days)
   - Suggested order of implementation

5. **UI/UX Design Guidance**
   - How to achieve Google Docs-like simplicity and elegance
   - Component breakdown for document viewer
   - Component breakdown for slides viewer
   - Accessibility considerations

6. **Long-term Scalability**
   - What happens when we want to add 5+ more screen types?
   - When should we introduce a framework?
   - When should we add a database?
   - Architecture evolution strategy

### Success Criteria

The ideal codebase assessment will:
- Be pragmatic and actionable
- Identify real risks (not theoretical)
- Provide concrete code examples or patterns
- Balance "quick wins" vs. "proper refactoring"
- Consider developer velocity and maintainability together
- Address the Google Docs UI aspiration realistically

---

## Please Begin Your Assessment

Analyze the codebase architecture described above and provide your comprehensive assessment following the format outlined. Focus on practical insights that will help determine the best path forward for adding document and slide viewing capabilities while maintaining code quality and developer productivity.
