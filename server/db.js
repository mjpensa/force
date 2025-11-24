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
      status TEXT DEFAULT 'processing',  -- processing, complete, partial, error
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
      status TEXT DEFAULT 'pending',  -- pending, processing, complete, partial, error
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
      WHERE status IN ('complete', 'error', 'partial')
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
