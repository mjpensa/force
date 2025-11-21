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
      executiveSummary TEXT,
      presentationSlides TEXT,
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

  // Semantic charts table - stores bimodal (fact/inference) charts
  db.exec(`
    CREATE TABLE IF NOT EXISTS semantic_charts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chartId TEXT UNIQUE NOT NULL,
      sessionId TEXT NOT NULL,
      ganttData TEXT NOT NULL,
      semanticMetadata TEXT NOT NULL,
      repairLog TEXT,
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(sessionId)
    )
  `);

  // FEATURE #9: Analytics tables
  // Analytics events table - stores individual tracking events
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventType TEXT NOT NULL,
      eventData TEXT,
      chartId TEXT,
      sessionId TEXT,
      timestamp INTEGER NOT NULL
    )
  `);

  // Analytics summary table - stores daily aggregates
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      charts_generated INTEGER DEFAULT 0,
      charts_failed INTEGER DEFAULT 0,
      exports_png INTEGER DEFAULT 0,
      exports_pptx INTEGER DEFAULT 0,
      task_analyses INTEGER DEFAULT 0,
      url_shares INTEGER DEFAULT 0,
      feature_usage TEXT,
      avg_generation_time INTEGER,
      total_tasks INTEGER DEFAULT 0,
      updatedAt INTEGER NOT NULL
    )
  `);

  // Create indices for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_sessionId ON sessions(sessionId);
    CREATE INDEX IF NOT EXISTS idx_charts_chartId ON charts(chartId);
    CREATE INDEX IF NOT EXISTS idx_charts_sessionId ON charts(sessionId);
    CREATE INDEX IF NOT EXISTS idx_semantic_charts_chartId ON semantic_charts(chartId);
    CREATE INDEX IF NOT EXISTS idx_semantic_charts_sessionId ON semantic_charts(sessionId);
    CREATE INDEX IF NOT EXISTS idx_jobs_jobId ON jobs(jobId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_charts_expiresAt ON charts(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_semantic_charts_expiresAt ON semantic_charts(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_eventType ON analytics_events(eventType);
    CREATE INDEX IF NOT EXISTS idx_analytics_summary_date ON analytics_summary(date);
  `);

  console.log('✓ Database tables created');
}

/**
 * Database singleton instance
 */
let db = null;

/**
 * Get database instance (creates if doesn't exist)
 * @returns {Database}
 */
export function getDatabase() {
  if (!db) {
    db = initializeDatabase();
  }
  return db;
}

/**
 * SESSION OPERATIONS
 */

/**
 * Create a new session
 * @param {string} sessionId - Unique session ID
 * @param {string} research - Research content
 * @param {string[]} filenames - Array of filenames
 * @param {number} expirationDays - Days until expiration (default: 30)
 * @returns {object} Created session
 */
export function createSession(sessionId, research, filenames, expirationDays = DEFAULT_EXPIRATION_DAYS) {
  const db = getDatabase();
  const now = Date.now();
  const expiresAt = now + (expirationDays * 24 * 60 * 60 * 1000);

  console.log(`[Database] Creating session ${sessionId}, expiration: ${expirationDays} days`);

  try {
    const stmt = db.prepare(`
      INSERT INTO sessions (sessionId, research, filenames, createdAt, expiresAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(sessionId, research, JSON.stringify(filenames), now, expiresAt);

    console.log(`[Database] ✅ Session ${sessionId} inserted successfully`);

    return {
      sessionId,
      research,
      filenames,
      createdAt: new Date(now),
      expiresAt: new Date(expiresAt)
    };
  } catch (error) {
    console.error(`[Database] ❌ Failed to insert session ${sessionId}:`, error.message);
    console.error(`[Database] Error code:`, error.code);
    console.error(`[Database] Error stack:`, error.stack);
    throw error;
  }
}

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @returns {object|null} Session data or null if not found
 */
export function getSession(sessionId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM sessions WHERE sessionId = ?');
  const row = stmt.get(sessionId);

  if (!row) return null;

  return {
    sessionId: row.sessionId,
    research: row.research,
    filenames: JSON.parse(row.filenames),
    createdAt: new Date(row.createdAt)
  };
}

/**
 * CHART OPERATIONS
 */

/**
 * Save a chart to database
 * @param {string} chartId - Unique chart ID
 * @param {string} sessionId - Associated session ID
 * @param {object} ganttData - Gantt chart data
 * @param {object} executiveSummary - Executive summary data
 * @param {object} presentationSlides - Presentation slides data
 * @param {number} expirationDays - Days until expiration (default: 30)
 * @returns {object} Saved chart metadata
 */
export function saveChart(chartId, sessionId, ganttData, executiveSummary, presentationSlides, expirationDays = DEFAULT_EXPIRATION_DAYS) {
  const db = getDatabase();
  const now = Date.now();
  const expiresAt = now + (expirationDays * 24 * 60 * 60 * 1000);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO charts (chartId, sessionId, ganttData, executiveSummary, presentationSlides, createdAt, expiresAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    chartId,
    sessionId,
    JSON.stringify(ganttData),
    JSON.stringify(executiveSummary),
    JSON.stringify(presentationSlides),
    now,
    expiresAt
  );

  console.log(`✓ Chart saved to database: ${chartId}`);

  return {
    chartId,
    sessionId,
    createdAt: new Date(now),
    expiresAt: new Date(expiresAt)
  };
}

/**
 * Get chart by ID
 * @param {string} chartId - Chart ID
 * @returns {object|null} Chart data or null if not found
 */
export function getChart(chartId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM charts WHERE chartId = ?');
  const row = stmt.get(chartId);

  if (!row) return null;

  return {
    chartId: row.chartId,
    sessionId: row.sessionId,
    ganttData: JSON.parse(row.ganttData),
    executiveSummary: JSON.parse(row.executiveSummary),
    presentationSlides: JSON.parse(row.presentationSlides),
    createdAt: new Date(row.createdAt)
  };
}

/**
 * Get all charts for a session
 * @param {string} sessionId - Session ID
 * @returns {array} Array of chart metadata
 */
export function getChartsBySession(sessionId) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT chartId, createdAt, expiresAt
    FROM charts
    WHERE sessionId = ?
    ORDER BY createdAt DESC
  `);

  const rows = stmt.all(sessionId);
  return rows.map(row => ({
    chartId: row.chartId,
    createdAt: new Date(row.createdAt),
    expiresAt: new Date(row.expiresAt)
  }));
}

/**
 * JOB OPERATIONS
 */

/**
 * Create a new job
 * @param {string} jobId - Unique job ID
 * @param {string} status - Job status
 * @param {string} progress - Progress message
 * @returns {object} Created job
 */
export function createJob(jobId, status = 'queued', progress = 'Starting...') {
  const db = getDatabase();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO jobs (jobId, status, progress, createdAt)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(jobId, status, progress, now);

  return { jobId, status, progress, createdAt: new Date(now) };
}

/**
 * Update job status
 * @param {string} jobId - Job ID
 * @param {object} updates - Updates to apply
 */
export function updateJob(jobId, updates) {
  const db = getDatabase();

  const fields = [];
  const values = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.progress !== undefined) {
    fields.push('progress = ?');
    values.push(updates.progress);
  }
  if (updates.chartId !== undefined) {
    fields.push('chartId = ?');
    values.push(updates.chartId);
  }
  if (updates.error !== undefined) {
    fields.push('error = ?');
    values.push(updates.error);
  }

  if (fields.length === 0) return;

  values.push(jobId);

  const stmt = db.prepare(`
    UPDATE jobs
    SET ${fields.join(', ')}
    WHERE jobId = ?
  `);

  stmt.run(...values);
}

/**
 * Get job by ID
 * @param {string} jobId - Job ID
 * @returns {object|null} Job data or null if not found
 */
export function getJob(jobId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM jobs WHERE jobId = ?');
  const row = stmt.get(jobId);

  if (!row) return null;

  return {
    jobId: row.jobId,
    status: row.status,
    progress: row.progress,
    chartId: row.chartId,
    error: row.error,
    createdAt: new Date(row.createdAt)
  };
}

/**
 * Delete job by ID
 * @param {string} jobId - Job ID
 */
export function deleteJob(jobId) {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM jobs WHERE jobId = ?');
  stmt.run(jobId);
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

  // Step 2: Delete all semantic_charts (expired or not) that reference expired sessions
  const deleteSemanticChartsStmt = db.prepare(`
    DELETE FROM semantic_charts
    WHERE sessionId IN (SELECT sessionId FROM sessions WHERE expiresAt < ?)
  `);
  const semanticChartsResult = deleteSemanticChartsStmt.run(now);

  // Step 3: Now safe to delete expired sessions (no FK references remain)
  const deleteSessionsStmt = db.prepare('DELETE FROM sessions WHERE expiresAt < ?');
  const sessionsResult = deleteSessionsStmt.run(now);

  // Step 4: Delete old jobs (older than 1 hour)
  const oneHourAgo = now - (60 * 60 * 1000);
  const deleteJobsStmt = db.prepare('DELETE FROM jobs WHERE createdAt < ?');
  const jobsResult = deleteJobsStmt.run(oneHourAgo);

  const stats = {
    chartsDeleted: chartsResult.changes,
    semanticChartsDeleted: semanticChartsResult.changes,
    sessionsDeleted: sessionsResult.changes,
    jobsDeleted: jobsResult.changes
  };

  if (stats.chartsDeleted > 0 || stats.semanticChartsDeleted > 0 || stats.sessionsDeleted > 0 || stats.jobsDeleted > 0) {
    console.log('✓ Cleanup completed:', stats);
  }

  return stats;
}

/**
 * Get database statistics
 * @returns {object} Database statistics
 */
export function getStats() {
  const db = getDatabase();

  const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
  const chartCount = db.prepare('SELECT COUNT(*) as count FROM charts').get().count;
  const jobCount = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;

  // Get database file size
  let dbSize = 0;
  try {
    const stats = fs.statSync(DB_PATH);
    dbSize = Math.round(stats.size / 1024); // KB
  } catch (error) {
    console.error('Error getting database size:', error);
  }

  return {
    sessions: sessionCount,
    charts: chartCount,
    jobs: jobCount,
    dbSizeKB: dbSize
  };
}

/**
 * ANALYTICS OPERATIONS (FEATURE #9)
 */

/**
 * Track an analytics event
 * @param {string} eventType - Type of event (chart_generated, feature_used, export, etc.)
 * @param {object} eventData - Event data
 * @param {string} chartId - Optional chart ID
 * @param {string} sessionId - Optional session ID
 */
export function trackEvent(eventType, eventData = {}, chartId = null, sessionId = null) {
  const db = getDatabase();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO analytics_events (eventType, eventData, chartId, sessionId, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(eventType, JSON.stringify(eventData), chartId, sessionId, now);

  // Update daily summary
  updateDailySummary(eventType, eventData);
}

/**
 * Update daily analytics summary
 * @param {string} eventType - Type of event
 * @param {object} eventData - Event data
 * @private
 */
function updateDailySummary(eventType, eventData) {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const now = Date.now();

  // Get or create today's summary
  let summary = db.prepare('SELECT * FROM analytics_summary WHERE date = ?').get(today);

  if (!summary) {
    // Create new summary for today
    db.prepare(`
      INSERT INTO analytics_summary (date, charts_generated, charts_failed, exports_png, exports_pptx, task_analyses, url_shares, feature_usage, avg_generation_time, total_tasks, updatedAt)
      VALUES (?, 0, 0, 0, 0, 0, 0, '{}', 0, 0, ?)
    `).run(today, now);

    summary = db.prepare('SELECT * FROM analytics_summary WHERE date = ?').get(today);
  }

  // Update counters based on event type
  const updates = {};

  switch (eventType) {
    case 'chart_generated':
      updates.charts_generated = (summary.charts_generated || 0) + 1;
      if (eventData.taskCount) {
        updates.total_tasks = (summary.total_tasks || 0) + eventData.taskCount;
      }
      if (eventData.generationTime) {
        // Update average generation time
        const currentAvg = summary.avg_generation_time || 0;
        const currentCount = summary.charts_generated || 0;
        updates.avg_generation_time = Math.round((currentAvg * currentCount + eventData.generationTime) / (currentCount + 1));
      }
      break;

    case 'chart_failed':
      updates.charts_failed = (summary.charts_failed || 0) + 1;
      break;

    case 'export_png':
      updates.exports_png = (summary.exports_png || 0) + 1;
      break;

    case 'export_pptx':
      updates.exports_pptx = (summary.exports_pptx || 0) + 1;
      break;

    case 'task_analysis':
      updates.task_analyses = (summary.task_analyses || 0) + 1;
      break;

    case 'url_share':
      updates.url_shares = (summary.url_shares || 0) + 1;
      break;

    case 'feature_used':
      // Track feature usage
      const featureUsage = summary.feature_usage ? JSON.parse(summary.feature_usage) : {};
      const featureName = eventData.feature || 'unknown';
      featureUsage[featureName] = (featureUsage[featureName] || 0) + 1;
      updates.feature_usage = JSON.stringify(featureUsage);
      break;
  }

  // Update the summary
  if (Object.keys(updates).length > 0) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    fields.push('updatedAt = ?');
    values.push(now);
    values.push(today);

    const stmt = db.prepare(`
      UPDATE analytics_summary
      SET ${fields.join(', ')}
      WHERE date = ?
    `);

    stmt.run(...values);
  }
}

/**
 * Get analytics summary for a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {array} Array of daily summaries
 */
export function getAnalyticsSummary(startDate, endDate) {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM analytics_summary
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
  `);

  const rows = stmt.all(startDate, endDate);

  return rows.map(row => ({
    date: row.date,
    charts_generated: row.charts_generated,
    charts_failed: row.charts_failed,
    exports_png: row.exports_png,
    exports_pptx: row.exports_pptx,
    task_analyses: row.task_analyses,
    url_shares: row.url_shares,
    feature_usage: JSON.parse(row.feature_usage || '{}'),
    avg_generation_time: row.avg_generation_time,
    total_tasks: row.total_tasks
  }));
}

/**
 * Get analytics events for a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} eventType - Optional event type filter
 * @param {number} limit - Maximum number of events to return
 * @returns {array} Array of events
 */
export function getAnalyticsEvents(startDate, endDate, eventType = null, limit = 100) {
  const db = getDatabase();

  const startTimestamp = new Date(startDate).getTime();
  const endTimestamp = new Date(endDate).getTime() + (24 * 60 * 60 * 1000); // End of day

  let query = `
    SELECT * FROM analytics_events
    WHERE timestamp >= ? AND timestamp < ?
  `;

  const params = [startTimestamp, endTimestamp];

  if (eventType) {
    query += ' AND eventType = ?';
    params.push(eventType);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);

  return rows.map(row => ({
    id: row.id,
    eventType: row.eventType,
    eventData: JSON.parse(row.eventData || '{}'),
    chartId: row.chartId,
    sessionId: row.sessionId,
    timestamp: new Date(row.timestamp)
  }));
}

/**
 * Get overall analytics statistics
 * @returns {object} Overall statistics
 */
export function getOverallAnalytics() {
  const db = getDatabase();

  // Get total counts
  const totalCharts = db.prepare('SELECT COUNT(*) as count FROM charts').get().count;
  const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;

  // Get aggregated analytics
  const aggregated = db.prepare(`
    SELECT
      SUM(charts_generated) as total_generated,
      SUM(charts_failed) as total_failed,
      SUM(exports_png) as total_png,
      SUM(exports_pptx) as total_pptx,
      SUM(task_analyses) as total_analyses,
      SUM(url_shares) as total_shares,
      AVG(avg_generation_time) as avg_time,
      SUM(total_tasks) as total_tasks
    FROM analytics_summary
  `).get();

  // Get feature usage (combine all daily feature usage)
  const summaries = db.prepare('SELECT feature_usage FROM analytics_summary').all();
  const combinedFeatures = {};

  summaries.forEach(row => {
    const features = JSON.parse(row.feature_usage || '{}');
    for (const [feature, count] of Object.entries(features)) {
      combinedFeatures[feature] = (combinedFeatures[feature] || 0) + count;
    }
  });

  // Get recent activity (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysDate = thirtyDaysAgo.toISOString().split('T')[0];

  const recentActivity = db.prepare(`
    SELECT
      SUM(charts_generated) as recent_charts,
      SUM(url_shares) as recent_shares
    FROM analytics_summary
    WHERE date >= ?
  `).get(thirtyDaysAgo);

  return {
    totalCharts,
    totalSessions,
    chartsGenerated: aggregated.total_generated || 0,
    chartsFailed: aggregated.total_failed || 0,
    exportsPng: aggregated.total_png || 0,
    exportsPptx: aggregated.total_pptx || 0,
    taskAnalyses: aggregated.total_analyses || 0,
    urlShares: aggregated.total_shares || 0,
    avgGenerationTime: Math.round(aggregated.avg_time || 0),
    totalTasks: aggregated.total_tasks || 0,
    featureUsage: combinedFeatures,
    recentActivity: {
      last30Days: {
        chartsGenerated: recentActivity.recent_charts || 0,
        urlShares: recentActivity.recent_shares || 0
      }
    }
  };
}

/**
 * SEMANTIC CHART OPERATIONS
 */

/**
 * Create a new semantic chart
 * @param {string} chartId - Unique chart identifier
 * @param {string} sessionId - Associated session ID
 * @param {Object} ganttData - BimodalGanttData structure
 * @param {Object} metadata - Semantic metadata (fact/inference stats)
 * @param {Array} repairLog - Validation repair log
 * @param {number} expirationDays - Days until expiration
 * @returns {Object} Created chart record
 */
export function createSemanticChart(chartId, sessionId, ganttData, metadata, repairLog = [], expirationDays = DEFAULT_EXPIRATION_DAYS) {
  const db = getDatabase();
  const now = Date.now();
  const expiresAt = now + (expirationDays * 24 * 60 * 60 * 1000);

  const stmt = db.prepare(`
    INSERT INTO semantic_charts (chartId, sessionId, ganttData, semanticMetadata, repairLog, createdAt, expiresAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    chartId,
    sessionId,
    JSON.stringify(ganttData),
    JSON.stringify(metadata),
    JSON.stringify(repairLog),
    now,
    expiresAt
  );

  console.log(`[Database] Semantic chart created: ${chartId}`);
  return { chartId, sessionId, createdAt: now, expiresAt };
}

/**
 * Get semantic chart by ID
 * @param {string} chartId - Chart identifier
 * @returns {Object|null} Chart data or null if not found
 */
export function getSemanticChart(chartId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM semantic_charts WHERE chartId = ?');
  const row = stmt.get(chartId);

  if (!row) {
    return null;
  }

  return {
    ...row,
    ganttData: row.ganttData,  // Keep as string for now
    semanticMetadata: JSON.parse(row.semanticMetadata),
    repairLog: JSON.parse(row.repairLog || '[]')
  };
}

/**
 * Get all semantic charts for a session
 * @param {string} sessionId - Session identifier
 * @returns {Array} Array of semantic charts
 */
export function getSemanticChartsBySession(sessionId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM semantic_charts WHERE sessionId = ?');
  const rows = stmt.all(sessionId);

  return rows.map(row => ({
    ...row,
    semanticMetadata: JSON.parse(row.semanticMetadata),
    repairLog: JSON.parse(row.repairLog || '[]')
  }));
}

/**
 * Get semantic chart statistics
 * @returns {Object} Statistics about semantic charts
 */
export function getSemanticChartStats() {
  const db = getDatabase();

  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM semantic_charts');
  const total = totalStmt.get().count;

  const activeStmt = db.prepare('SELECT COUNT(*) as count FROM semantic_charts WHERE expiresAt > ?');
  const active = activeStmt.get(Date.now()).count;

  return {
    total,
    active,
    expired: total - active
  };
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('✓ Database connection closed');
  }
}

// Initialize database on module load
getDatabase();

// Export default cleanup interval (5 minutes)
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
