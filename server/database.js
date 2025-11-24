/**
 * Database Module
 * Handles persistent storage using SQLite
 * Feature #8: Data Persistence & Sharing
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path (parent directory of server/)
const DB_PATH = path.join(__dirname, '..', 'roadmap.db');

// Default expiration: 30 days
const DEFAULT_EXPIRATION_DAYS = 30;

/**
 * Initialize the database connection
 * @returns {Database} SQLite database instance
 */
function initializeDatabase() {
  console.log(`[Database] Initializing database at ${DB_PATH}`);

  // Create database file if it doesn't exist
  const db = new Database(DB_PATH, {
    verbose: console.log,
    timeout: 5000 // 5 second timeout to prevent hanging
  });

  // Use DELETE mode instead of WAL for ephemeral filesystems
  // WAL mode can cause issues on Railway due to additional files (-wal, -shm)
  db.pragma('journal_mode = DELETE');
  console.log('[Database] Journal mode set to DELETE (ephemeral filesystem compatible)');

  // Set busy timeout to prevent SQLITE_BUSY errors
  db.pragma('busy_timeout = 5000');

  // Create tables if they don't exist
  createTables(db);

  console.log(`✓ Database initialized at ${DB_PATH}`);

  // WARNING: Railway uses ephemeral filesystems
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.warn('⚠️  WARNING: Running on Railway with ephemeral filesystem!');
    console.warn('⚠️  SQLite database will be DELETED on every container restart!');
    console.warn('⚠️  For persistent storage, use Railway Postgres plugin or external database.');
    console.warn('⚠️  Charts will be lost on: deployments, crashes, scaling events.');
  }

  return db;
}

/**
 * Create database tables
 * @param {Database} db - SQLite database instance
 */
function createTables(db) {
  // Sessions table - stores research context for task analysis
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT UNIQUE NOT NULL,
      research TEXT NOT NULL,
      filenames TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL
    )
  `);

  // Charts table - stores generated charts
  db.exec(`
    CREATE TABLE IF NOT EXISTS charts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chartId TEXT UNIQUE NOT NULL,
      sessionId TEXT NOT NULL,
      ganttData TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(sessionId)
    )
  `);

  // Jobs table - stores async job status
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jobId TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      progress TEXT,
      chartId TEXT,
      error TEXT,
      createdAt INTEGER NOT NULL
    )
  `);

  // Create indices for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_sessionId ON sessions(sessionId);
    CREATE INDEX IF NOT EXISTS idx_charts_chartId ON charts(chartId);
    CREATE INDEX IF NOT EXISTS idx_charts_sessionId ON charts(sessionId);
    CREATE INDEX IF NOT EXISTS idx_jobs_jobId ON jobs(jobId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_charts_expiresAt ON charts(expiresAt);
  `);

  console.log('✓ Database tables created');
}

/**
 * Database singleton instance
 */
let db = null;

/**
 * Get database instance (creates if doesn't exist)
 * Internal use only - not exported
 * @returns {Database}
 */
function getDatabase() {
  if (!db) {
    db = initializeDatabase();
  }
  return db;
}


/**
 * CLEANUP OPERATIONS
 */

/**
 * Delete expired sessions and charts
 * @returns {object} Cleanup statistics
 */
export function cleanupExpired() {
  const db = getDatabase();
  const now = Date.now();

  // CRITICAL FIX: Delete charts that belong to expired sessions (not just expired charts)
  // This prevents foreign key violations when deleting expired sessions

  // Step 1: Delete all charts (expired or not) that reference expired sessions
  const deleteChartsStmt = db.prepare(`
    DELETE FROM charts
    WHERE sessionId IN (SELECT sessionId FROM sessions WHERE expiresAt < ?)
  `);
  const chartsResult = deleteChartsStmt.run(now);

  // Step 2: Now safe to delete expired sessions (no FK references remain)
  const deleteSessionsStmt = db.prepare('DELETE FROM sessions WHERE expiresAt < ?');
  const sessionsResult = deleteSessionsStmt.run(now);

  // Step 3: Delete old jobs (older than 1 hour)
  const oneHourAgo = now - (60 * 60 * 1000);
  const deleteJobsStmt = db.prepare('DELETE FROM jobs WHERE createdAt < ?');
  const jobsResult = deleteJobsStmt.run(oneHourAgo);

  const stats = {
    chartsDeleted: chartsResult.changes,
    sessionsDeleted: sessionsResult.changes,
    jobsDeleted: jobsResult.changes
  };

  if (stats.chartsDeleted > 0 || stats.sessionsDeleted > 0 || stats.jobsDeleted > 0) {
    console.log('✓ Cleanup completed:', stats);
  }

  return stats;
}

// Initialize database on module load
getDatabase();

// Export default cleanup interval (5 minutes)
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
