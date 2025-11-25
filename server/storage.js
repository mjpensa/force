/**
 * Storage Management Module
 * In-Memory Storage (No Database Persistence)
 *
 * IMPORTANT: Data is stored in memory only and will be lost on server restart.
 * Charts and sessions expire after 1 hour.
 *
 * For persistent storage across restarts, consider:
 * - Railway Postgres plugin
 * - External database (Supabase, Neon, Turso)
 */

import crypto from 'crypto';
import { CONFIG } from './config.js';

// In-memory storage maps
const sessionStore = new Map();
const chartStore = new Map();
const jobStore = new Map();

// Store interval ID for cleanup on shutdown
let cleanupIntervalId = null;

/**
 * Starts the cleanup interval for expired sessions, charts, and jobs
 */
export function startCleanupInterval() {
  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    let sessionsDeleted = 0;
    let chartsDeleted = 0;
    let jobsDeleted = 0;

    // Clean expired sessions
    for (const [sessionId, session] of sessionStore.entries()) {
      if (now > session.expiresAt) {
        sessionStore.delete(sessionId);
        sessionsDeleted++;
      }
    }

    // Clean expired charts
    for (const [chartId, chart] of chartStore.entries()) {
      if (now > chart.expiresAt) {
        chartStore.delete(chartId);
        chartsDeleted++;
      }
    }

    // Clean old jobs (older than 1 hour)
    const oneHourAgo = now - CONFIG.STORAGE.EXPIRATION_MS;
    for (const [jobId, job] of jobStore.entries()) {
      if (job.createdAt < oneHourAgo) {
        jobStore.delete(jobId);
        jobsDeleted++;
      }
    }

    // Log cleanup results
    if (sessionsDeleted > 0 || chartsDeleted > 0 || jobsDeleted > 0) {
      console.log('\n📊 Cleanup Summary:');
      console.log(`  - Expired sessions: ${sessionsDeleted}`);
      console.log(`  - Expired charts: ${chartsDeleted}`);
      console.log(`  - Expired jobs: ${jobsDeleted}`);
      console.log(`  - Total items cleaned: ${chartsDeleted + sessionsDeleted + jobsDeleted}`);
    }

    // Log current storage state
    console.log('\n💾 In-Memory Storage State:');
    console.log(`  - Active sessions: ${sessionStore.size}`);
    console.log(`  - Active charts: ${chartStore.size}`);
    console.log(`  - Active jobs: ${jobStore.size}`);
    console.log(`  - Storage health: ✅ Good\n`);

  }, CONFIG.STORAGE.CLEANUP_INTERVAL_MS);

  console.log(`✅ Storage cleanup interval started (every ${CONFIG.STORAGE.CLEANUP_INTERVAL_MS / 1000 / 60} minutes)`);
}

/**
 * SESSION MANAGEMENT
 */

/**
 * Creates a new session with research data
 * @param {string} researchText - The combined research text
 * @param {Array<string>} researchFiles - Array of filename strings
 * @returns {string} The session ID
 */
export function createSession(researchText, researchFiles) {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + CONFIG.STORAGE.EXPIRATION_MS;

  console.log(`[Storage] Creating in-memory session ${sessionId} with ${researchFiles.length} files`);
  console.log(`[Storage] Research text length: ${researchText.length} characters`);
  console.log(`[Storage] Expires in: ${CONFIG.STORAGE.EXPIRATION_MS / 1000 / 60} minutes`);

  sessionStore.set(sessionId, {
    researchText,
    researchFiles,
    createdAt: now,
    expiresAt
  });

  console.log(`✅ Session ${sessionId} created in memory`);

  return sessionId;
}

/**
 * Retrieves session data by ID
 * @param {string} sessionId - The session ID
 * @returns {Object|null} The session data or null if not found
 */
export function getSession(sessionId) {
  const session = sessionStore.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if expired
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(sessionId);
    return null;
  }

  return {
    researchText: session.researchText,
    researchFiles: session.researchFiles,
    createdAt: session.createdAt
  };
}

/**
 * CHART MANAGEMENT
 */

/**
 * Stores a chart with a unique ID
 * @param {Object} ganttData - The chart data
 * @param {string} sessionId - Associated session ID
 * @returns {string} The chart ID
 */
export function storeChart(ganttData, sessionId) {
  const chartId = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + CONFIG.STORAGE.EXPIRATION_MS;

  console.log(`💾 Storing chart in memory with ID: ${chartId}`);
  console.log(`📊 Chart data keys:`, Object.keys(ganttData || {}));
  console.log(`📊 TimeColumns count:`, ganttData?.ganttData?.timeColumns?.length || 0);
  console.log(`📊 Tasks count:`, ganttData?.ganttData?.data?.length || 0);

  // Extract components from the chart data
  const gantt = ganttData.ganttData || ganttData;

  chartStore.set(chartId, {
    data: {
      ...gantt
    },
    sessionId,
    createdAt: now,
    expiresAt
  });

  console.log(`✅ Chart ${chartId} stored successfully in memory (expires in 1 hour)`);

  return chartId;
}

/**
 * Retrieves chart data by ID
 * @param {string} chartId - The chart ID
 * @returns {Object|null} The chart data or null if not found
 */
export function getChart(chartId) {
  const chart = chartStore.get(chartId);

  if (!chart) {
    console.log(`❌ Chart ${chartId} not found in memory`);
    return null;
  }

  // Check if expired
  if (Date.now() > chart.expiresAt) {
    chartStore.delete(chartId);
    console.log(`❌ Chart ${chartId} has expired`);
    return null;
  }

  console.log(`📊 Retrieved chart ${chartId} from memory`);
  console.log(`  - ganttData has timeColumns:`, chart.data?.timeColumns ? 'yes' : 'no');
  console.log(`  - ganttData has data:`, chart.data?.data ? 'yes' : 'no');

  return chart;
}

/**
 * JOB MANAGEMENT
 */

/**
 * Creates a new job with queued status
 * @returns {string} The job ID
 */
export function createJob() {
  const jobId = crypto.randomBytes(16).toString('hex');
  const now = Date.now();

  jobStore.set(jobId, {
    status: 'queued',
    progress: 'Request received, starting processing...',
    createdAt: now
  });

  return jobId;
}

/**
 * Updates job status and progress
 * @param {string} jobId - The job ID
 * @param {Object} updates - Object with status, progress, data, or error fields
 */
export function updateJob(jobId, updates) {
  const existingJob = jobStore.get(jobId);

  if (!existingJob) {
    console.warn(`Attempted to update non-existent job: ${jobId}`);
    return;
  }

  jobStore.set(jobId, {
    ...existingJob,
    ...updates
  });
}

/**
 * Retrieves job data by ID
 * @param {string} jobId - The job ID
 * @returns {Object|null} The job data or null if not found
 */
export function getJob(jobId) {
  const job = jobStore.get(jobId);

  if (!job) {
    return null;
  }

  return job;
}

/**
 * Marks a job as complete with result data
 * @param {string} jobId - The job ID
 * @param {Object} data - The result data
 */
export function completeJob(jobId, data) {
  updateJob(jobId, {
    status: 'complete',
    progress: 'Chart generated successfully!',
    data: data
  });
}

/**
 * Marks a job as failed with error message
 * @param {string} jobId - The job ID
 * @param {string} errorMessage - The error message
 */
export function failJob(jobId, errorMessage) {
  updateJob(jobId, {
    status: 'error',
    error: errorMessage || 'Unknown error occurred'
  });
}

/**
 * Stops the cleanup interval (call on server shutdown)
 */
export function stopCleanupInterval() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('✅ Storage cleanup interval stopped');
  }
}

