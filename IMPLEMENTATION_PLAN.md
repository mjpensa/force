# Comprehensive Implementation & Integration Plan
## Three-Screen Architecture: Roadmap, Slides, Document

**Version:** 1.0
**Created:** 2025-11-24
**Estimated Timeline:** 6-7 weeks
**Complexity:** Medium-High

---

## Table of Contents

1. [Pre-Implementation Setup](#pre-implementation-setup)
2. [Phase 0: Foundation & Infrastructure](#phase-0-foundation--infrastructure)
3. [Phase 1: Design System Implementation](#phase-1-design-system-implementation)
4. [Phase 2: Unified Content Generation](#phase-2-unified-content-generation)
5. [Phase 3: Slides View Implementation](#phase-3-slides-view-implementation)
6. [Phase 4: Document View Implementation](#phase-4-document-view-implementation)
7. [Phase 5: Integration & Testing](#phase-5-integration--testing)
8. [Phase 6: Polish & Optimization](#phase-6-polish--optimization)
9. [Rollback Procedures](#rollback-procedures)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Checklist](#deployment-checklist)

---

## Pre-Implementation Setup

### Prerequisites Checklist

- [ ] Review all assessment documents thoroughly
- [ ] Set up development environment
- [ ] Create feature branch from main
- [ ] Back up current database/storage
- [ ] Document current API endpoints
- [ ] Create test data set (sample research files)

### Development Environment Setup

```bash
# 1. Ensure Node.js version
node --version  # Should be >= 16.x

# 2. Install dependencies
npm install

# 3. Create feature branch
git checkout -b feature/three-screen-architecture

# 4. Install additional dependencies for this feature
npm install better-sqlite3 --save
npm install -D vite  # Optional but recommended

# 5. Create backup of current state
git tag backup-before-three-screens
```

### File Structure Planning

```
/home/user/force/
├── Public/
│   ├── design-system.css          # NEW - Design tokens
│   ├── components/                 # NEW - Organized components
│   │   ├── views/
│   │   │   ├── RoadmapView.js     # REFACTOR from GanttChart
│   │   │   ├── SlidesView.js      # NEW
│   │   │   └── DocumentView.js    # NEW
│   │   ├── shared/
│   │   │   ├── StateManager.js    # NEW - Centralized state
│   │   │   ├── LoadingSpinner.js  # NEW
│   │   │   ├── ErrorBoundary.js   # NEW
│   │   │   └── ProgressBar.js     # NEW
│   │   └── ui/
│   │       ├── Button.js          # NEW - Reusable button
│   │       ├── Card.js            # NEW
│   │       └── Modal.js           # NEW
│   ├── styles/                     # NEW - Organized styles
│   │   ├── design-system.css
│   │   ├── app-shell.css
│   │   ├── roadmap-view.css
│   │   ├── slides-view.css
│   │   └── document-view.css
│   └── chart.html                  # REFACTOR - Multi-view shell
├── server/
│   ├── db.js                       # NEW - Database layer
│   ├── routes/
│   │   ├── content.js              # NEW - Unified content endpoints
│   │   └── sessions.js             # NEW - Session management
│   └── prompts/
│       ├── roadmap.js              # REFACTOR - Extract from prompts.js
│       ├── slides.js               # NEW
│       └── document.js             # NEW
└── tests/                          # NEW - Test suite
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Phase 0: Foundation & Infrastructure
**Duration:** 3-4 days
**Priority:** Critical
**Dependencies:** None

### Step 0.1: Database Setup (SQLite)

**Objective:** Replace in-memory storage with persistent SQLite database

#### Task 0.1.1: Create Database Module

Create `server/db.js`:

```javascript
/**
 * Database module using better-sqlite3
 * Provides persistent storage for sessions and content
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file location
const DB_PATH = path.join(__dirname, '..', 'data', 'force.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

/**
 * Initialize database schema
 */
export function initializeDatabase() {
  db.exec(`
    -- Sessions table: stores all generated content
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      research_files TEXT NOT NULL,  -- JSON array of files
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'processing',  -- processing, complete, error
      error_message TEXT
    );

    -- Content table: stores view-specific data
    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      view_type TEXT NOT NULL,  -- 'roadmap', 'slides', 'document'
      data TEXT NOT NULL,        -- JSON data for the view
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
      UNIQUE(session_id, view_type)
    );

    -- Jobs table: tracks async generation jobs
    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      session_id TEXT,
      status TEXT DEFAULT 'pending',  -- pending, processing, complete, error
      progress TEXT,  -- JSON: { roadmap: 'complete', slides: 'processing', ... }
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    );

    -- Indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_sessions_created
      ON sessions(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_content_session
      ON content(session_id, view_type);

    CREATE INDEX IF NOT EXISTS idx_jobs_status
      ON jobs(status, created_at DESC);
  `);

  console.log('✅ Database initialized successfully');
}

/**
 * Session operations
 */
export const SessionDB = {
  /**
   * Create a new session
   */
  create(sessionId, prompt, researchFiles) {
    const stmt = db.prepare(`
      INSERT INTO sessions (session_id, prompt, research_files, status)
      VALUES (?, ?, ?, 'processing')
    `);

    const result = stmt.run(
      sessionId,
      prompt,
      JSON.stringify(researchFiles)
    );

    return result.changes > 0;
  },

  /**
   * Get session by ID
   */
  get(sessionId) {
    const stmt = db.prepare(`
      SELECT * FROM sessions WHERE session_id = ?
    `);

    const row = stmt.get(sessionId);

    if (!row) return null;

    return {
      sessionId: row.session_id,
      prompt: row.prompt,
      researchFiles: JSON.parse(row.research_files),
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  /**
   * Update session status
   */
  updateStatus(sessionId, status, errorMessage = null) {
    const stmt = db.prepare(`
      UPDATE sessions
      SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `);

    return stmt.run(status, errorMessage, sessionId);
  },

  /**
   * Delete session and all related content
   */
  delete(sessionId) {
    const stmt = db.prepare('DELETE FROM sessions WHERE session_id = ?');
    return stmt.run(sessionId);
  },

  /**
   * List recent sessions
   */
  listRecent(limit = 50) {
    const stmt = db.prepare(`
      SELECT session_id, prompt, status, created_at, updated_at
      FROM sessions
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(limit);
  }
};

/**
 * Content operations
 */
export const ContentDB = {
  /**
   * Save content for a specific view
   */
  save(sessionId, viewType, data) {
    const stmt = db.prepare(`
      INSERT INTO content (session_id, view_type, data)
      VALUES (?, ?, ?)
      ON CONFLICT(session_id, view_type)
      DO UPDATE SET
        data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `);

    return stmt.run(sessionId, viewType, JSON.stringify(data));
  },

  /**
   * Get content for a specific view
   */
  get(sessionId, viewType) {
    const stmt = db.prepare(`
      SELECT data, created_at, updated_at
      FROM content
      WHERE session_id = ? AND view_type = ?
    `);

    const row = stmt.get(sessionId, viewType);

    if (!row) return null;

    return {
      data: JSON.parse(row.data),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  /**
   * Get all content for a session
   */
  getAll(sessionId) {
    const stmt = db.prepare(`
      SELECT view_type, data, created_at, updated_at
      FROM content
      WHERE session_id = ?
    `);

    const rows = stmt.all(sessionId);

    const result = {};
    rows.forEach(row => {
      result[row.view_type] = {
        data: JSON.parse(row.data),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });

    return result;
  },

  /**
   * Delete content for a view
   */
  delete(sessionId, viewType) {
    const stmt = db.prepare(`
      DELETE FROM content
      WHERE session_id = ? AND view_type = ?
    `);

    return stmt.run(sessionId, viewType);
  }
};

/**
 * Job operations
 */
export const JobDB = {
  /**
   * Create a new job
   */
  create(jobId, sessionId) {
    const initialProgress = JSON.stringify({
      roadmap: 'pending',
      slides: 'pending',
      document: 'pending'
    });

    const stmt = db.prepare(`
      INSERT INTO jobs (job_id, session_id, status, progress)
      VALUES (?, ?, 'processing', ?)
    `);

    return stmt.run(jobId, sessionId, initialProgress);
  },

  /**
   * Get job by ID
   */
  get(jobId) {
    const stmt = db.prepare('SELECT * FROM jobs WHERE job_id = ?');
    const row = stmt.get(jobId);

    if (!row) return null;

    return {
      jobId: row.job_id,
      sessionId: row.session_id,
      status: row.status,
      progress: JSON.parse(row.progress),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  /**
   * Update job progress
   */
  updateProgress(jobId, progress) {
    const stmt = db.prepare(`
      UPDATE jobs
      SET progress = ?, updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `);

    return stmt.run(JSON.stringify(progress), jobId);
  },

  /**
   * Update job status
   */
  updateStatus(jobId, status) {
    const stmt = db.prepare(`
      UPDATE jobs
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `);

    return stmt.run(status, jobId);
  },

  /**
   * Delete old completed jobs (cleanup)
   */
  deleteOld(daysOld = 7) {
    const stmt = db.prepare(`
      DELETE FROM jobs
      WHERE status IN ('complete', 'error')
      AND created_at < datetime('now', '-' || ? || ' days')
    `);

    return stmt.run(daysOld);
  }
};

/**
 * Cleanup tasks
 */
export const Cleanup = {
  /**
   * Delete sessions older than specified days
   */
  deleteOldSessions(daysOld = 30) {
    const stmt = db.prepare(`
      DELETE FROM sessions
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `);

    return stmt.run(daysOld);
  },

  /**
   * Get database statistics
   */
  getStats() {
    const stats = {
      sessions: db.prepare('SELECT COUNT(*) as count FROM sessions').get().count,
      content: db.prepare('SELECT COUNT(*) as count FROM content').get().count,
      jobs: db.prepare('SELECT COUNT(*) as count FROM jobs').get().count,
      dbSize: fs.statSync(DB_PATH).size
    };

    return stats;
  }
};

// Initialize database on module load
initializeDatabase();

export default db;
```

#### Task 0.1.2: Create Migration Script

Create `server/migrate-to-db.js`:

```javascript
/**
 * Migration script to move from in-memory storage to SQLite
 * Run once during deployment
 */

import { SessionDB, ContentDB } from './db.js';
import { sessionStore, chartStore } from './storage.js';

export function migrateToDatabase() {
  console.log('🔄 Starting migration to SQLite...');

  let migratedSessions = 0;
  let migratedContent = 0;

  // Migrate sessions
  for (const [sessionId, sessionData] of sessionStore.entries()) {
    try {
      // Create session
      SessionDB.create(
        sessionId,
        sessionData.prompt || '',
        sessionData.research || []
      );

      // If roadmap data exists, save it
      if (sessionData.ganttData) {
        ContentDB.save(sessionId, 'roadmap', sessionData.ganttData);
        migratedContent++;
      }

      migratedSessions++;
    } catch (error) {
      console.error(`Failed to migrate session ${sessionId}:`, error);
    }
  }

  console.log(`✅ Migrated ${migratedSessions} sessions`);
  console.log(`✅ Migrated ${migratedContent} content items`);
  console.log('🎉 Migration complete!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToDatabase();
  process.exit(0);
}
```

#### Task 0.1.3: Update server.js to use Database

Update `server.js`:

```javascript
// At the top, add database import
import { SessionDB, ContentDB, JobDB, Cleanup } from './server/db.js';

// Remove in-memory stores (keep as fallback during transition)
// import { sessionStore, chartStore, jobStore } from './server/storage.js';

// Add cleanup job (run daily)
setInterval(() => {
  Cleanup.deleteOldSessions(30);  // Delete sessions older than 30 days
  JobDB.deleteOld(7);             // Delete old jobs
  console.log('🧹 Cleanup completed');
}, 24 * 60 * 60 * 1000);  // Run once per day

// ... rest of server.js
```

**Testing Checklist:**
- [ ] Database file created successfully
- [ ] Tables created with correct schema
- [ ] Can create new sessions
- [ ] Can retrieve sessions
- [ ] Can save and retrieve content
- [ ] Migration script works with existing data
- [ ] Cleanup functions work correctly

---

### Step 0.2: State Management Setup

**Objective:** Create centralized state management for client-side

#### Task 0.2.1: Create StateManager

Create `Public/components/shared/StateManager.js`:

```javascript
/**
 * Centralized state management for the application
 * Provides reactive state updates across all views
 */

export class StateManager {
  constructor() {
    this.state = {
      // Session info
      sessionId: null,
      currentView: 'roadmap',  // 'roadmap' | 'slides' | 'document'

      // Content data
      content: {
        roadmap: null,
        slides: null,
        document: null
      },

      // Loading states
      loading: {
        roadmap: false,
        slides: false,
        document: false
      },

      // Error states
      errors: {
        roadmap: null,
        slides: null,
        document: null
      },

      // UI state
      ui: {
        menuOpen: false,
        fullscreen: false
      }
    };

    this.listeners = [];
    this.viewListeners = {};  // View-specific listeners
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update state and notify listeners
   */
  setState(updates) {
    const previousState = { ...this.state };
    this.state = this.deepMerge(this.state, updates);

    // Notify all listeners
    this.notifyListeners(previousState, this.state);
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Called with (newState, previousState)
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Subscribe to specific view changes
   */
  subscribeToView(viewName, listener) {
    if (!this.viewListeners[viewName]) {
      this.viewListeners[viewName] = [];
    }

    this.viewListeners[viewName].push(listener);

    return () => {
      this.viewListeners[viewName] = this.viewListeners[viewName].filter(
        l => l !== listener
      );
    };
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners(previousState, newState) {
    // Global listeners
    this.listeners.forEach(listener => {
      listener(newState, previousState);
    });

    // View-specific listeners
    for (const viewName in this.viewListeners) {
      if (newState.content[viewName] !== previousState.content[viewName]) {
        this.viewListeners[viewName].forEach(listener => {
          listener(newState.content[viewName], previousState.content[viewName]);
        });
      }
    }
  }

  /**
   * Load content for a specific view
   */
  async loadView(viewName) {
    // Check if already loaded
    if (this.state.content[viewName]) {
      console.log(`✅ ${viewName} already loaded from cache`);
      return this.state.content[viewName];
    }

    // Set loading state
    this.setState({
      loading: { ...this.state.loading, [viewName]: true },
      errors: { ...this.state.errors, [viewName]: null }
    });

    try {
      const response = await fetch(
        `/content/${this.state.sessionId}/${viewName}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load ${viewName}: ${response.statusText}`);
      }

      const data = await response.json();

      // Update state with loaded data
      this.setState({
        content: { ...this.state.content, [viewName]: data },
        loading: { ...this.state.loading, [viewName]: false }
      });

      return data;
    } catch (error) {
      console.error(`Error loading ${viewName}:`, error);

      this.setState({
        loading: { ...this.state.loading, [viewName]: false },
        errors: { ...this.state.errors, [viewName]: error.message }
      });

      throw error;
    }
  }

  /**
   * Switch to a different view
   */
  switchView(viewName) {
    if (this.state.currentView === viewName) {
      return;  // Already on this view
    }

    this.setState({ currentView: viewName });
    window.location.hash = viewName;
  }

  /**
   * Initialize state from URL
   */
  initializeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');
    const hash = window.location.hash.replace('#', '') || 'roadmap';

    if (!sessionId) {
      throw new Error('No session ID in URL');
    }

    this.setState({
      sessionId,
      currentView: hash
    });
  }

  /**
   * Prefetch other views in background
   */
  async prefetchOtherViews(currentView) {
    const views = ['roadmap', 'slides', 'document'];
    const otherViews = views.filter(v => v !== currentView);

    // Wait a bit, then prefetch
    setTimeout(async () => {
      for (const view of otherViews) {
        if (!this.state.content[view]) {
          try {
            await this.loadView(view);
            console.log(`✅ Prefetched ${view}`);
          } catch (error) {
            console.log(`⚠️ Failed to prefetch ${view}`);
          }
        }
      }
    }, 2000);
  }

  /**
   * Refresh a specific view
   */
  async refreshView(viewName) {
    // Clear cached data
    this.setState({
      content: { ...this.state.content, [viewName]: null }
    });

    // Reload
    return await this.loadView(viewName);
  }

  /**
   * Clear all state (logout/reset)
   */
  clear() {
    this.setState({
      sessionId: null,
      currentView: 'roadmap',
      content: { roadmap: null, slides: null, document: null },
      loading: { roadmap: false, slides: false, document: false },
      errors: { roadmap: null, slides: null, document: null }
    });
  }
}

// Export singleton instance
export const state = new StateManager();
```

**Testing Checklist:**
- [ ] StateManager can be instantiated
- [ ] setState updates state correctly
- [ ] Listeners receive state updates
- [ ] View-specific listeners work
- [ ] loadView fetches data correctly
- [ ] Caching works (doesn't refetch)
- [ ] Prefetching works in background

---

### Step 0.3: Project Restructuring

**Objective:** Reorganize files for better maintainability

#### Task 0.3.1: Create Directory Structure

```bash
# Create new directories
mkdir -p Public/components/views
mkdir -p Public/components/shared
mkdir -p Public/components/ui
mkdir -p Public/styles
mkdir -p server/prompts
mkdir -p server/routes
mkdir -p data
mkdir -p tests/unit
mkdir -p tests/integration
```

#### Task 0.3.2: Move and Refactor Files

```bash
# Move styles to styles directory
# (We'll do this in Phase 1)

# Create .gitignore entry for database
echo "data/*.db" >> .gitignore
echo "data/*.db-shm" >> .gitignore
echo "data/*.db-wal" >> .gitignore
```

**Testing Checklist:**
- [ ] New directories created
- [ ] .gitignore updated
- [ ] Server still runs after restructuring
- [ ] All imports still work

---

## Phase 1: Design System Implementation
**Duration:** 3-4 days
**Priority:** High
**Dependencies:** Phase 0

### Step 1.1: Create Design System

#### Task 1.1.1: Create Base Design Tokens

Create `Public/styles/design-system.css`:

```css
/**
 * Design System - Foundation
 * Google Docs-inspired design tokens
 */

:root {
  /* ========== COLORS ========== */

  /* Primary (Google Blue) */
  --color-primary: #1a73e8;
  --color-primary-hover: #1557b0;
  --color-primary-light: #e8f0fe;
  --color-primary-dark: #0d47a1;

  /* Surface & Background */
  --color-surface: #ffffff;
  --color-background: #f8f9fa;
  --color-background-alt: #f1f3f4;

  /* Borders */
  --color-border: #dadce0;
  --color-border-light: #e8eaed;
  --color-border-dark: #c4c7c9;

  /* Text */
  --color-text-primary: #202124;
  --color-text-secondary: #5f6368;
  --color-text-tertiary: #80868b;
  --color-text-disabled: #9aa0a6;

  /* Semantic Colors */
  --color-success: #34a853;
  --color-success-light: #e6f4ea;
  --color-warning: #fbbc04;
  --color-warning-light: #fef7e0;
  --color-error: #ea4335;
  --color-error-light: #fce8e6;
  --color-info: #4285f4;
  --color-info-light: #e8f0fe;

  /* Interactive States */
  --color-hover: #f1f3f4;
  --color-active: #e8eaed;
  --color-focus: rgba(26, 115, 232, 0.12);
  --color-selected: #e8f0fe;

  /* Overlays */
  --color-overlay: rgba(0, 0, 0, 0.32);
  --color-overlay-light: rgba(0, 0, 0, 0.08);

  /* ========== TYPOGRAPHY ========== */

  /* Font Families */
  --font-primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas,
    "Courier New", monospace;

  /* Font Sizes (rem-based, 16px base) */
  --text-xs: 0.75rem;     /* 12px */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */
  --text-3xl: 1.875rem;   /* 30px */
  --text-4xl: 2.25rem;    /* 36px */
  --text-5xl: 3rem;       /* 48px */
  --text-6xl: 3.75rem;    /* 60px */

  /* Font Weights */
  --weight-light: 300;
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* Line Heights */
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
  --leading-loose: 2;

  /* Letter Spacing */
  --tracking-tighter: -0.05em;
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;

  /* ========== SPACING (8px grid) ========== */

  --spacing-0: 0;
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-5: 1.25rem;   /* 20px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-7: 1.75rem;   /* 28px */
  --spacing-8: 2rem;      /* 32px */
  --spacing-10: 2.5rem;   /* 40px */
  --spacing-12: 3rem;     /* 48px */
  --spacing-16: 4rem;     /* 64px */
  --spacing-20: 5rem;     /* 80px */
  --spacing-24: 6rem;     /* 96px */

  /* ========== SHADOWS & ELEVATION ========== */

  --shadow-none: none;
  --shadow-sm: 0 1px 2px 0 rgba(60, 64, 67, 0.1),
    0 1px 3px 1px rgba(60, 64, 67, 0.05);
  --shadow-md: 0 1px 3px 0 rgba(60, 64, 67, 0.1),
    0 4px 8px 3px rgba(60, 64, 67, 0.05);
  --shadow-lg: 0 4px 6px 0 rgba(60, 64, 67, 0.1),
    0 10px 20px 3px rgba(60, 64, 67, 0.1);
  --shadow-xl: 0 8px 12px 0 rgba(60, 64, 67, 0.15),
    0 16px 24px 6px rgba(60, 64, 67, 0.1);
  --shadow-2xl: 0 16px 24px 0 rgba(60, 64, 67, 0.2),
    0 24px 48px 12px rgba(60, 64, 67, 0.15);

  /* Focus Shadow */
  --shadow-focus: 0 0 0 3px var(--color-focus);

  /* ========== BORDER RADIUS ========== */

  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* ========== TRANSITIONS ========== */

  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-bounce: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);

  /* ========== LAYOUT ========== */

  /* Container Widths */
  --container-xs: 640px;
  --container-sm: 768px;
  --container-md: 1024px;
  --container-lg: 1280px;
  --container-xl: 1536px;

  /* Content Width (optimal reading) */
  --content-width: 800px;

  /* Sidebar */
  --sidebar-width: 280px;
  --sidebar-collapsed: 64px;

  /* Header */
  --header-height: 64px;

  /* ========== Z-INDEX LAYERS ========== */

  --z-base: 0;
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-fixed: 1200;
  --z-modal-backdrop: 1300;
  --z-modal: 1400;
  --z-popover: 1500;
  --z-tooltip: 1600;
}

/* ========== GLOBAL RESETS ========== */

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--font-primary);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--color-text-primary);
  background: var(--color-background);
}

/* ========== ACCESSIBILITY ========== */

/* Focus visible (modern browsers) */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Remove focus outline for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}

/* Skip to content link */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-primary);
  color: white;
  padding: var(--spacing-2) var(--spacing-4);
  text-decoration: none;
  z-index: var(--z-tooltip);
  border-radius: var(--radius-sm);
}

.skip-link:focus {
  top: var(--spacing-2);
  left: var(--spacing-2);
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* ========== REDUCED MOTION ========== */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ========== HIGH CONTRAST MODE ========== */

@media (prefers-contrast: high) {
  :root {
    --color-border: #000;
    --shadow-sm: none;
    --shadow-md: 0 0 0 2px currentColor;
    --shadow-lg: 0 0 0 3px currentColor;
  }
}

/* ========== DARK MODE (future enhancement) ========== */

@media (prefers-color-scheme: dark) {
  /*
  :root {
    --color-surface: #202124;
    --color-background: #121212;
    --color-text-primary: #e8eaed;
    ... etc
  }
  */
}
```

Continue in next message due to length...

**Testing Checklist:**
- [ ] CSS variables defined correctly
- [ ] No console errors when loading
- [ ] Variables accessible in browser DevTools
- [ ] Fallback fonts work

---

### Step 1.2: Create App Shell Styles

Create `Public/styles/app-shell.css`:

```css
/**
 * Application Shell Styles
 * Main layout structure
 */

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
}

/* ========== HEADER ========== */

.app-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-4);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  box-shadow: var(--shadow-sm);
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex: 0 0 auto;
}

.header-center {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  padding: 0 var(--spacing-4);
}

.app-title {
  font-size: var(--text-xl);
  font-weight: var(--weight-normal);
  color: var(--color-text-primary);
  margin: 0;
  margin-left: var(--spacing-4);
}

.document-title {
  font-size: var(--text-base);
  color: var(--color-text-primary);
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--radius-sm);
  outline: none;
  transition: background var(--transition-fast);
  max-width: 400px;
  text-align: center;
  border: 1px solid transparent;
}

.document-title:hover {
  background: var(--color-hover);
}

.document-title:focus {
  background: var(--color-surface);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

/* Icon buttons */
.icon-button {
  width: 40px;
  height: 40px;
  border: none;
  background: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast);
  color: var(--color-text-secondary);
  position: relative;
}

.icon-button:hover {
  background: var(--color-hover);
}

.icon-button:active {
  background: var(--color-active);
}

.icon-button svg {
  fill: currentColor;
  width: 24px;
  height: 24px;
}

.icon-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.icon-button:disabled:hover {
  background: none;
}

/* ========== MAIN CONTENT ========== */

.app-main {
  flex: 1;
  padding: var(--spacing-8) 0;
  min-height: calc(100vh - var(--header-height));
}

.view-container {
  max-width: var(--container-xl);
  margin: 0 auto;
  padding: 0 var(--spacing-6);
}

/* ========== RESPONSIVE ========== */

@media (max-width: 768px) {
  .app-header {
    padding: 0 var(--spacing-2);
  }

  .header-center {
    display: none;
  }

  .app-main {
    padding: var(--spacing-4) 0;
  }

  .view-container {
    padding: 0 var(--spacing-4);
  }
}
```

Continue with more implementation steps in next response...
