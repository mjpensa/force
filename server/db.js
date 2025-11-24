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
      data TEXT,                 -- JSON data for the view (NULL if generation failed)
      status TEXT DEFAULT 'pending',  -- pending, completed, error
      error_message TEXT,
      generated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
      UNIQUE(session_id, view_type)
    );

    -- Jobs table: tracks async generation jobs (one per content type)
    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      content_type TEXT NOT NULL,  -- 'roadmap', 'slides', or 'document'
      status TEXT DEFAULT 'pending',  -- pending, processing, completed, error
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
      UNIQUE(session_id, content_type)
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
   * Create/update content for a specific view
   */
  create(sessionId, viewType, data, errorMessage = null) {
    const status = data ? 'completed' : 'error';
    const stmt = db.prepare(`
      INSERT INTO content (session_id, view_type, data, status, error_message, generated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id, view_type)
      DO UPDATE SET
        data = excluded.data,
        status = excluded.status,
        error_message = excluded.error_message,
        generated_at = excluded.generated_at,
        updated_at = CURRENT_TIMESTAMP
    `);

    return stmt.run(
      sessionId,
      viewType,
      data ? JSON.stringify(data) : null,
      status,
      errorMessage
    );
  },

  /**
   * Get content for a specific view
   */
  get(sessionId, viewType) {
    const stmt = db.prepare(`
      SELECT data, status, error_message, generated_at, created_at, updated_at
      FROM content
      WHERE session_id = ? AND view_type = ?
    `);

    const row = stmt.get(sessionId, viewType);

    if (!row) return null;

    return {
      data: row.data ? JSON.parse(row.data) : null,
      status: row.status,
      error_message: row.error_message,
      generated_at: row.generated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  /**
   * Get all content for a session
   */
  getAll(sessionId) {
    const stmt = db.prepare(`
      SELECT view_type, data, status, error_message, generated_at, created_at, updated_at
      FROM content
      WHERE session_id = ?
    `);

    const rows = stmt.all(sessionId);

    const result = {};
    rows.forEach(row => {
      result[row.view_type] = {
        data: row.data ? JSON.parse(row.data) : null,
        status: row.status,
        error_message: row.error_message,
        generated_at: row.generated_at,
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
  },

  /**
   * Delete all content for a session
   */
  deleteBySession(sessionId) {
    const stmt = db.prepare(`
      DELETE FROM content
      WHERE session_id = ?
    `);

    return stmt.run(sessionId);
  }
};

/**
 * Job operations
 */
export const JobDB = {
  /**
   * Create a new job for a specific content type
   */
  create(jobId, sessionId, contentType) {
    const stmt = db.prepare(`
      INSERT INTO jobs (job_id, session_id, content_type, status)
      VALUES (?, ?, ?, 'pending')
    `);

    return stmt.run(jobId, sessionId, contentType);
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
      contentType: row.content_type,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  /**
   * Get all jobs for a session
   */
  getBySession(sessionId) {
    const stmt = db.prepare(`
      SELECT * FROM jobs
      WHERE session_id = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(sessionId);

    return rows.map(row => ({
      jobId: row.job_id,
      sessionId: row.session_id,
      contentType: row.content_type,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },

  /**
   * Update job status
   */
  updateStatus(jobId, status, errorMessage = null) {
    const stmt = db.prepare(`
      UPDATE jobs
      SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `);

    return stmt.run(status, errorMessage, jobId);
  },

  /**
   * Delete old completed jobs (cleanup)
   */
  deleteOld(daysOld = 7) {
    const stmt = db.prepare(`
      DELETE FROM jobs
      WHERE status IN ('completed', 'error')
      AND created_at < datetime('now', '-' || ? || ' days')
    `);

    return stmt.run(daysOld);
  },

  /**
   * Delete all jobs for a session
   */
  deleteBySession(sessionId) {
    const stmt = db.prepare(`
      DELETE FROM jobs
      WHERE session_id = ?
    `);

    return stmt.run(sessionId);
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

/**
 * Get database startup info (helps diagnose restart issues)
 */
export function getDatabaseInfo() {
  try {
    const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
    const contentCount = db.prepare('SELECT COUNT(*) as count FROM content').get().count;
    const jobCount = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;
    const dbExists = fs.existsSync(DB_PATH);
    const dbSize = dbExists ? fs.statSync(DB_PATH).size : 0;

    return {
      path: DB_PATH,
      exists: dbExists,
      size: dbSize,
      sessions: sessionCount,
      content: contentCount,
      jobs: jobCount,
      isEmpty: sessionCount === 0 && contentCount === 0 && jobCount === 0
    };
  } catch (error) {
    return {
      path: DB_PATH,
      error: error.message
    };
  }
}

export default db;
