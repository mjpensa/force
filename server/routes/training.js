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

// Calculate quality score from validation result
function calculateFeedbackScore(validationResult) {
  if (!validationResult) return 3;

  let score = 3;
  if (validationResult.valid !== false) score += 1;
  if (validationResult.quality?.score > 0.7) score += 1;
  if (validationResult.quality?.score > 0.9) score += 0.5;
  if (validationResult.errors?.length > 0) score -= 1;

  return Math.max(1, Math.min(5, Math.round(score)));
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Training state (to prevent multiple concurrent runs)
let isTraining = false;
let trainingProgress = null;

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
    errors: []
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
    for (const sampleSet of sampleSets) {
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

          const feedbackScore = calculateFeedbackScore(result._validation);
          stats.qualityScores.push(feedbackScore);

          if (result._generationId) {
            await collector.updateFeedback(result._generationId, {
              rating: feedbackScore,
              wasExported: feedbackScore >= 4
            });
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
  trainingProgress.status = 'completed';
  trainingProgress.completedAt = new Date().toISOString();
  trainingProgress.results = {
    totalGenerations: stats.totalGenerations,
    successful: stats.successful,
    failed: stats.failed,
    successRate: stats.totalGenerations > 0
      ? Math.round((stats.successful / stats.totalGenerations) * 100)
      : 0,
    avgQuality: avgQuality.toFixed(2),
    variantUsage: stats.variantUsage,
    errors: stats.errors.slice(-10) // Last 10 errors
  };

  console.log('\n✅ [API] Training Complete');
  console.log(`   Success: ${stats.successful}/${stats.totalGenerations}`);
  console.log(`   Avg Quality: ${avgQuality.toFixed(2)}/5`);
}

export default router;
