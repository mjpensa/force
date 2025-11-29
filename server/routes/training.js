/**
 * Training API Routes
 *
 * Provides an HTTP endpoint to trigger PROMPT ML training.
 * This allows training to be triggered via browser or curl without shell access.
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import mammoth from 'mammoth';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

// Training configuration
const TRAINING_CONFIG = {
  sampleSets: [
    {
      name: 'sample-set-1',
      path: join(PROJECT_ROOT, 'training', 'sample-set-1'),
      prompt: 'Create a roadmap from 2025-2030'
    },
    {
      name: 'sample-set-2',
      path: join(PROJECT_ROOT, 'training', 'sample-set-2'),
      prompt: 'Create a timeline of key events'
    },
    {
      name: 'sample-set-3',
      path: join(PROJECT_ROOT, 'training', 'sample-set-3'),
      prompt: 'Create a roadmap with three swimlanes'
    }
  ]
};

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.md', '.txt', '.docx'];

// Load research files from a directory
async function loadResearchFiles(dirPath) {
  if (!existsSync(dirPath)) {
    return [];
  }

  const files = await readdir(dirPath);
  const researchFiles = [];

  for (const filename of files) {
    if (filename.startsWith('.')) continue;

    const ext = extname(filename).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

    const filePath = join(dirPath, filename);
    try {
      let content;

      if (ext === '.docx') {
        const buffer = await readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } else {
        content = await readFile(filePath, 'utf8');
      }

      if (content && content.trim().length > 0) {
        researchFiles.push({ filename, content });
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return researchFiles;
}

/**
 * Calculate realistic feedback based on output quality
 * Returns an object with rating and simulated user behavior
 */
function calculateRealisticFeedback(result, validationResult) {
  const feedback = {
    rating: 3,
    wasExported: false,
    wasEdited: false,
    wasRegenerated: false,
    thumbsUp: null
  };

  // No result = bad
  if (!result || !result.success) {
    feedback.rating = 1;
    feedback.wasRegenerated = true;
    feedback.thumbsUp = false;
    return feedback;
  }

  const data = result.data;
  const quality = validationResult?.quality;

  // Start with base score
  let score = 3;

  // === STRUCTURAL QUALITY ===
  // Check if we have meaningful content
  const hasTitle = data?.title && data.title.length > 5;
  const hasSwimlanes = data?.swimlanes?.length > 0;
  const hasTasks = data?.swimlanes?.some(s => s.tasks?.length > 0);
  const hasTimeRange = data?.timeRange?.start && data?.timeRange?.end;

  if (hasTitle) score += 0.3;
  if (hasSwimlanes) score += 0.3;
  if (hasTasks) score += 0.4;
  if (hasTimeRange) score += 0.3;

  // === CONTENT RICHNESS ===
  const taskCount = data?.swimlanes?.reduce((sum, s) => sum + (s.tasks?.length || 0), 0) || 0;
  const swimlaneCount = data?.swimlanes?.length || 0;
  const minTasksPerSwimlane = swimlaneCount > 0
    ? Math.min(...data.swimlanes.map(s => s.tasks?.length || 0))
    : 0;

  // Penalties for insufficient content (bad)
  if (swimlaneCount < 2) score -= 1;        // Less than 2 swimlanes = bad
  if (taskCount < 7) score -= 1;            // Less than 7 tasks = bad
  if (minTasksPerSwimlane < 2) score -= 0.5; // Less than 2 tasks per swimlane = bad

  // Bonuses for rich content (good)
  if (taskCount >= 10) score += 0.3;
  if (taskCount >= 15) score += 0.3;
  if (swimlaneCount >= 3) score += 0.3;
  if (minTasksPerSwimlane >= 3) score += 0.2;

  // === VALIDATION QUALITY ===
  if (validationResult?.valid !== false) score += 0.5;
  if (quality?.score > 0.6) score += 0.3;
  if (quality?.score > 0.8) score += 0.4;
  if (quality?.score > 0.9) score += 0.3;

  // Penalties for validation errors
  if (validationResult?.errors?.length > 0) score -= 0.5 * validationResult.errors.length;

  // === LATENCY FACTOR ===
  // Very slow responses feel worse to users
  const latency = result._latencyMs || 0;
  if (latency > 30000) score -= 0.5;  // >30s feels bad
  if (latency > 60000) score -= 0.5;  // >60s feels really bad

  // Clamp to 1-5
  feedback.rating = Math.max(1, Math.min(5, Math.round(score)));

  // === SIMULATE USER BEHAVIOR ===
  // High quality = export, thumbs up
  if (feedback.rating >= 4) {
    feedback.wasExported = Math.random() > 0.2;  // 80% export good results
    feedback.thumbsUp = Math.random() > 0.3;     // 70% thumbs up
  } else if (feedback.rating === 3) {
    feedback.wasExported = Math.random() > 0.6;  // 40% export mediocre
    feedback.wasEdited = Math.random() > 0.5;    // 50% edit mediocre
    feedback.thumbsUp = Math.random() > 0.5 ? true : (Math.random() > 0.5 ? false : null);
  } else {
    feedback.wasRegenerated = Math.random() > 0.4;  // 60% regenerate bad
    feedback.thumbsUp = false;
  }

  return feedback;
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Training state (to prevent multiple concurrent runs)
let isTraining = false;
let trainingProgress = null;
let shouldStop = false;

/**
 * GET /api/train/status
 * Check training status
 */
router.get('/status', (req, res) => {
  res.json({
    isTraining,
    progress: trainingProgress
  });
});

/**
 * GET /api/train/stop
 * Stop current training run
 */
router.get('/stop', (req, res) => {
  const secret = req.query.secret;
  const expectedSecret = process.env.TRAIN_SECRET || 'train123';

  if (secret !== expectedSecret) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing secret.'
    });
  }

  if (!isTraining) {
    return res.json({
      message: 'No training in progress',
      isTraining: false
    });
  }

  shouldStop = true;
  res.json({
    message: 'Stop signal sent. Training will stop after current generation.',
    isTraining,
    progress: trainingProgress
  });
});

/**
 * GET /api/train
 * Start training (protected by secret)
 *
 * Query params:
 *   - secret: Required auth token (must match TRAIN_SECRET env var)
 *   - iterations: Number of iterations per sample set (default: 10)
 *   - delay: Delay between generations in ms (default: 1000)
 */
router.get('/', async (req, res) => {
  // Check secret
  const secret = req.query.secret;
  const expectedSecret = process.env.TRAIN_SECRET || 'train123';

  if (secret !== expectedSecret) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing secret. Add ?secret=YOUR_SECRET to the URL.'
    });
  }

  // Check if already training
  if (isTraining) {
    return res.status(409).json({
      error: 'Training in progress',
      progress: trainingProgress
    });
  }

  // Parse options
  const iterations = parseInt(req.query.iterations) || 10;
  const delay = parseInt(req.query.delay) || 1000;

  // Start training in background
  isTraining = true;
  shouldStop = false;  // Reset stop flag
  trainingProgress = {
    status: 'starting',
    iterations,
    delay,
    startedAt: new Date().toISOString()
  };

  // Return immediately with status
  res.json({
    message: 'Training started',
    progress: trainingProgress,
    statusUrl: '/api/train/status'
  });

  // Run training in background
  runTraining(iterations, delay).catch(err => {
    console.error('[Training] Error:', err);
    trainingProgress.status = 'error';
    trainingProgress.error = err.message;
  }).finally(() => {
    isTraining = false;
  });
});

/**
 * Run the training process
 */
async function runTraining(iterations, delay) {
  console.log('\n🚀 [API] PROMPT ML Training Started');
  console.log(`   Iterations: ${iterations}, Delay: ${delay}ms`);

  // Enable optimization
  process.env.ENABLE_OPTIMIZATION = 'true';

  // Dynamic imports
  const { generateRoadmap } = await import('../generators.js');
  const { getMetricsCollector } = await import('../layers/optimization/metrics/index.js');
  const { getVariantRegistry } = await import('../layers/optimization/variants/index.js');

  const collector = getMetricsCollector();
  const registry = getVariantRegistry();

  // Stats
  const stats = {
    totalGenerations: 0,
    successful: 0,
    failed: 0,
    qualityScores: [],
    variantUsage: {},
    errors: [],
    feedbackDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    exports: 0,
    edits: 0,
    regenerations: 0,
    thumbsUp: 0,
    thumbsDown: 0
  };

  // Load sample sets
  const sampleSets = [];
  for (const setConfig of TRAINING_CONFIG.sampleSets) {
    const files = await loadResearchFiles(setConfig.path);
    if (files.length > 0) {
      sampleSets.push({ ...setConfig, files });
      console.log(`   ✓ ${setConfig.name}: ${files.length} files`);
    }
  }

  if (sampleSets.length === 0) {
    trainingProgress.status = 'error';
    trainingProgress.error = 'No sample sets found';
    throw new Error('No sample sets with files found');
  }

  // Run iterations
  const totalIterations = iterations * sampleSets.length;
  let currentIteration = 0;

  trainingProgress.status = 'running';
  trainingProgress.total = totalIterations;
  trainingProgress.current = 0;

  for (let i = 0; i < iterations; i++) {
    // Check for stop signal
    if (shouldStop) {
      console.log('\n⛔ [API] Training stopped by user');
      trainingProgress.status = 'stopped';
      trainingProgress.stoppedAt = new Date().toISOString();
      break;
    }

    for (const sampleSet of sampleSets) {
      // Check for stop signal
      if (shouldStop) break;

      currentIteration++;
      trainingProgress.current = currentIteration;
      trainingProgress.percent = Math.round((currentIteration / totalIterations) * 100);
      trainingProgress.currentSet = sampleSet.name;

      try {
        const result = await generateRoadmap(sampleSet.prompt, sampleSet.files);
        stats.totalGenerations++;

        if (result.success) {
          stats.successful++;

          if (result._variant?.id) {
            stats.variantUsage[result._variant.id] =
              (stats.variantUsage[result._variant.id] || 0) + 1;
          }

          // Calculate realistic feedback based on output quality
          const feedback = calculateRealisticFeedback(result, result._validation);
          stats.qualityScores.push(feedback.rating);
          stats.feedbackDistribution[feedback.rating]++;
          if (feedback.wasExported) stats.exports++;
          if (feedback.wasEdited) stats.edits++;
          if (feedback.wasRegenerated) stats.regenerations++;
          if (feedback.thumbsUp === true) stats.thumbsUp++;
          if (feedback.thumbsUp === false) stats.thumbsDown++;

          if (result._generationId) {
            await collector.updateFeedback(result._generationId, feedback);
          }
        } else {
          stats.failed++;
          stats.errors.push({ iteration: currentIteration, error: result.error });
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push({ iteration: currentIteration, error: error.message });
      }

      await sleep(delay);
    }
  }

  // Flush metrics
  await collector.flush();

  // Calculate averages
  const avgQuality = stats.qualityScores.length > 0
    ? stats.qualityScores.reduce((a, b) => a + b, 0) / stats.qualityScores.length
    : 0;

  // Update progress with final results
  if (!shouldStop) {
    trainingProgress.status = 'completed';
    trainingProgress.completedAt = new Date().toISOString();
  }
  trainingProgress.results = {
    totalGenerations: stats.totalGenerations,
    successful: stats.successful,
    failed: stats.failed,
    successRate: stats.totalGenerations > 0
      ? Math.round((stats.successful / stats.totalGenerations) * 100)
      : 0,
    avgQuality: avgQuality.toFixed(2),
    feedbackDistribution: stats.feedbackDistribution,
    userBehavior: {
      exports: stats.exports,
      edits: stats.edits,
      regenerations: stats.regenerations,
      thumbsUp: stats.thumbsUp,
      thumbsDown: stats.thumbsDown
    },
    variantUsage: stats.variantUsage,
    errors: stats.errors.slice(-10) // Last 10 errors
  };

  const statusMsg = shouldStop ? '⛔ Stopped' : '✅ Complete';
  console.log(`\n${statusMsg} [API] Training`);
  console.log(`   Success: ${stats.successful}/${stats.totalGenerations}`);
  console.log(`   Avg Quality: ${avgQuality.toFixed(2)}/5`);
  console.log(`   Ratings: 5⭐=${stats.feedbackDistribution[5]} 4⭐=${stats.feedbackDistribution[4]} 3⭐=${stats.feedbackDistribution[3]} 2⭐=${stats.feedbackDistribution[2]} 1⭐=${stats.feedbackDistribution[1]}`);
  console.log(`   Exports: ${stats.exports}, Edits: ${stats.edits}, 👍: ${stats.thumbsUp}, 👎: ${stats.thumbsDown}`);
}

export default router;
