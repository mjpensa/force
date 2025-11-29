/**
 * Training API Routes
 *
 * Provides an HTTP endpoint to trigger PROMPT ML training.
 * Trains all content types: Roadmap, Slides, Document, ResearchAnalysis
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

// Content types to train
const CONTENT_TYPES = ['Roadmap', 'Slides', 'Document', 'ResearchAnalysis'];

// Training configuration with prompts for each content type
const TRAINING_CONFIG = {
  sampleSets: [
    {
      name: 'sample-set-1',
      path: join(PROJECT_ROOT, 'training', 'sample-set-1'),
      prompts: {
        Roadmap: 'Create a roadmap from 2025-2030',
        Slides: 'Create a presentation summarizing the key findings',
        Document: 'Create an executive summary document',
        ResearchAnalysis: 'Analyze the research and identify key themes'
      }
    },
    {
      name: 'sample-set-2',
      path: join(PROJECT_ROOT, 'training', 'sample-set-2'),
      prompts: {
        Roadmap: 'Create a timeline of key events',
        Slides: 'Create slides for a board presentation',
        Document: 'Create a strategic overview document',
        ResearchAnalysis: 'Provide a comprehensive research analysis'
      }
    },
    {
      name: 'sample-set-3',
      path: join(PROJECT_ROOT, 'training', 'sample-set-3'),
      prompts: {
        Roadmap: 'Create a roadmap with three swimlanes',
        Slides: 'Create a presentation with actionable recommendations',
        Document: 'Create a detailed briefing document',
        ResearchAnalysis: 'Analyze trends and provide insights'
      }
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
 * Calculate feedback for ROADMAP content type
 */
function calculateRoadmapFeedback(result, validationResult) {
  const data = result.data;
  const quality = validationResult?.quality;
  let score = 3;

  // Structural quality
  const hasTitle = data?.title && data.title.length > 5;
  const hasSwimlanes = data?.swimlanes?.length > 0;
  const hasTasks = data?.swimlanes?.some(s => s.tasks?.length > 0);
  const hasTimeRange = data?.timeRange?.start && data?.timeRange?.end;

  if (hasTitle) score += 0.3;
  if (hasSwimlanes) score += 0.3;
  if (hasTasks) score += 0.4;
  if (hasTimeRange) score += 0.3;

  // Content richness
  const taskCount = data?.swimlanes?.reduce((sum, s) => sum + (s.tasks?.length || 0), 0) || 0;
  const swimlaneCount = data?.swimlanes?.length || 0;
  const minTasksPerSwimlane = swimlaneCount > 0
    ? Math.min(...data.swimlanes.map(s => s.tasks?.length || 0))
    : 0;

  // Penalties for insufficient content
  if (swimlaneCount < 2) score -= 1;
  if (taskCount < 7) score -= 1;
  if (minTasksPerSwimlane < 2) score -= 0.5;

  // Bonuses for rich content
  if (taskCount >= 10) score += 0.3;
  if (taskCount >= 15) score += 0.3;
  if (swimlaneCount >= 3) score += 0.3;
  if (minTasksPerSwimlane >= 3) score += 0.2;

  // Validation quality
  if (validationResult?.valid !== false) score += 0.5;
  if (quality?.score > 0.6) score += 0.3;
  if (quality?.score > 0.8) score += 0.4;
  if (quality?.score > 0.9) score += 0.3;

  if (validationResult?.errors?.length > 0) score -= 0.5 * validationResult.errors.length;

  return score;
}

/**
 * Calculate feedback for SLIDES content type
 */
function calculateSlidesFeedback(result, validationResult) {
  const data = result.data;
  const quality = validationResult?.quality;
  let score = 3;

  // Structural quality
  const hasTitle = data?.title && data.title.length > 5;
  const hasSlides = data?.slides?.length > 0;

  if (hasTitle) score += 0.3;
  if (hasSlides) score += 0.4;

  // Content richness
  const slideCount = data?.slides?.length || 0;
  const totalBullets = data?.slides?.reduce((sum, s) => sum + (s.bullets?.length || 0), 0) || 0;
  const avgBulletsPerSlide = slideCount > 0 ? totalBullets / slideCount : 0;

  // Penalties for insufficient content
  if (slideCount < 3) score -= 1;          // Less than 3 slides = bad
  if (totalBullets < 10) score -= 0.5;     // Less than 10 bullets = bad
  if (avgBulletsPerSlide < 2) score -= 0.5; // Less than 2 bullets per slide = bad

  // Bonuses for rich content
  if (slideCount >= 5) score += 0.3;
  if (slideCount >= 8) score += 0.3;
  if (totalBullets >= 20) score += 0.3;
  if (avgBulletsPerSlide >= 4) score += 0.2;

  // Validation quality
  if (validationResult?.valid !== false) score += 0.5;
  if (quality?.score > 0.6) score += 0.3;
  if (quality?.score > 0.8) score += 0.4;
  if (quality?.score > 0.9) score += 0.3;

  if (validationResult?.errors?.length > 0) score -= 0.5 * validationResult.errors.length;

  return score;
}

/**
 * Calculate feedback for DOCUMENT content type
 */
function calculateDocumentFeedback(result, validationResult) {
  const data = result.data;
  const quality = validationResult?.quality;
  let score = 3;

  // Structural quality
  const hasTitle = data?.title && data.title.length > 5;
  const hasSections = data?.sections?.length > 0;
  const hasExecutiveSummary = data?.executiveSummary && data.executiveSummary.length > 50;

  if (hasTitle) score += 0.3;
  if (hasSections) score += 0.4;
  if (hasExecutiveSummary) score += 0.3;

  // Content richness
  const sectionCount = data?.sections?.length || 0;
  const totalContentLength = data?.sections?.reduce((sum, s) => sum + (s.content?.length || 0), 0) || 0;

  // Penalties for insufficient content
  if (sectionCount < 3) score -= 1;           // Less than 3 sections = bad
  if (totalContentLength < 500) score -= 0.5; // Less than 500 chars = bad

  // Bonuses for rich content
  if (sectionCount >= 5) score += 0.3;
  if (sectionCount >= 7) score += 0.2;
  if (totalContentLength >= 1500) score += 0.3;
  if (totalContentLength >= 3000) score += 0.2;

  // Validation quality
  if (validationResult?.valid !== false) score += 0.5;
  if (quality?.score > 0.6) score += 0.3;
  if (quality?.score > 0.8) score += 0.4;
  if (quality?.score > 0.9) score += 0.3;

  if (validationResult?.errors?.length > 0) score -= 0.5 * validationResult.errors.length;

  return score;
}

/**
 * Calculate feedback for RESEARCH_ANALYSIS content type
 */
function calculateResearchAnalysisFeedback(result, validationResult) {
  const data = result.data;
  const quality = validationResult?.quality;
  let score = 3;

  // Structural quality
  const hasThemes = data?.themes?.length > 0;
  const hasInsights = data?.insights?.length > 0;
  const hasRecommendations = data?.recommendations?.length > 0;
  const hasSummary = data?.summary && data.summary.length > 50;

  if (hasThemes) score += 0.3;
  if (hasInsights) score += 0.4;
  if (hasRecommendations) score += 0.3;
  if (hasSummary) score += 0.3;

  // Content richness
  const themeCount = data?.themes?.length || 0;
  const insightCount = data?.insights?.length || 0;
  const recommendationCount = data?.recommendations?.length || 0;

  // Penalties for insufficient content
  if (themeCount < 2) score -= 0.5;           // Less than 2 themes = bad
  if (insightCount < 3) score -= 0.5;         // Less than 3 insights = bad
  if (recommendationCount < 2) score -= 0.5;  // Less than 2 recommendations = bad

  // Bonuses for rich content
  if (themeCount >= 4) score += 0.3;
  if (insightCount >= 5) score += 0.3;
  if (recommendationCount >= 4) score += 0.2;

  // Validation quality
  if (validationResult?.valid !== false) score += 0.5;
  if (quality?.score > 0.6) score += 0.3;
  if (quality?.score > 0.8) score += 0.4;
  if (quality?.score > 0.9) score += 0.3;

  if (validationResult?.errors?.length > 0) score -= 0.5 * validationResult.errors.length;

  return score;
}

/**
 * Calculate realistic feedback based on output quality and content type
 */
function calculateRealisticFeedback(result, validationResult, contentType) {
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

  // Calculate content-type-specific score
  let score;
  switch (contentType) {
    case 'Roadmap':
      score = calculateRoadmapFeedback(result, validationResult);
      break;
    case 'Slides':
      score = calculateSlidesFeedback(result, validationResult);
      break;
    case 'Document':
      score = calculateDocumentFeedback(result, validationResult);
      break;
    case 'ResearchAnalysis':
      score = calculateResearchAnalysisFeedback(result, validationResult);
      break;
    default:
      score = 3;
  }

  // Latency factor (applies to all types)
  const latency = result._latencyMs || 0;
  if (latency > 30000) score -= 0.5;
  if (latency > 60000) score -= 0.5;

  // Clamp to 1-5
  feedback.rating = Math.max(1, Math.min(5, Math.round(score)));

  // Simulate user behavior
  if (feedback.rating >= 4) {
    feedback.wasExported = Math.random() > 0.2;
    feedback.thumbsUp = Math.random() > 0.3;
  } else if (feedback.rating === 3) {
    feedback.wasExported = Math.random() > 0.6;
    feedback.wasEdited = Math.random() > 0.5;
    feedback.thumbsUp = Math.random() > 0.5 ? true : (Math.random() > 0.5 ? false : null);
  } else {
    feedback.wasRegenerated = Math.random() > 0.4;
    feedback.thumbsUp = false;
  }

  return feedback;
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Training state
let isTraining = false;
let trainingProgress = null;
let shouldStop = false;

/**
 * GET /api/train/status
 */
router.get('/status', (req, res) => {
  res.json({
    isTraining,
    progress: trainingProgress
  });
});

/**
 * GET /api/train/stop
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
 *   - secret: Required auth token
 *   - iterations: Number of iterations per sample set (default: 10)
 *   - delay: Delay between generations in ms (default: 1000)
 *   - types: Comma-separated content types to train (default: all)
 */
router.get('/', async (req, res) => {
  const secret = req.query.secret;
  const expectedSecret = process.env.TRAIN_SECRET || 'train123';

  if (secret !== expectedSecret) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing secret. Add ?secret=YOUR_SECRET to the URL.'
    });
  }

  if (isTraining) {
    return res.status(409).json({
      error: 'Training in progress',
      progress: trainingProgress
    });
  }

  const iterations = parseInt(req.query.iterations) || 10;
  const delay = parseInt(req.query.delay) || 1000;

  // Parse content types to train
  let typesToTrain = CONTENT_TYPES;
  if (req.query.types) {
    typesToTrain = req.query.types.split(',').filter(t => CONTENT_TYPES.includes(t));
    if (typesToTrain.length === 0) typesToTrain = CONTENT_TYPES;
  }

  isTraining = true;
  shouldStop = false;
  trainingProgress = {
    status: 'starting',
    iterations,
    delay,
    contentTypes: typesToTrain,
    startedAt: new Date().toISOString()
  };

  res.json({
    message: 'Training started',
    progress: trainingProgress,
    statusUrl: '/api/train/status'
  });

  runTraining(iterations, delay, typesToTrain).catch(err => {
    console.error('[Training] Error:', err);
    trainingProgress.status = 'error';
    trainingProgress.error = err.message;
  }).finally(() => {
    isTraining = false;
  });
});

/**
 * Run the training process for all content types
 */
async function runTraining(iterations, delay, contentTypes) {
  console.log('\n🚀 [API] PROMPT ML Training Started');
  console.log(`   Iterations: ${iterations}, Delay: ${delay}ms`);
  console.log(`   Content Types: ${contentTypes.join(', ')}`);

  process.env.ENABLE_OPTIMIZATION = 'true';

  // Dynamic imports for all generators
  const {
    generateRoadmap,
    generateSlides,
    generateDocument,
    generateResearchAnalysis
  } = await import('../generators.js');
  const { getMetricsCollector } = await import('../layers/optimization/metrics/index.js');
  const { getVariantRegistry } = await import('../layers/optimization/variants/index.js');

  const generators = {
    Roadmap: generateRoadmap,
    Slides: generateSlides,
    Document: generateDocument,
    ResearchAnalysis: generateResearchAnalysis
  };

  const collector = getMetricsCollector();
  const registry = getVariantRegistry();

  // Stats per content type
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
    thumbsDown: 0,
    byContentType: {}
  };

  // Initialize per-type stats
  for (const type of contentTypes) {
    stats.byContentType[type] = {
      total: 0,
      successful: 0,
      failed: 0,
      avgQuality: 0,
      qualityScores: []
    };
  }

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

  // Total iterations = iterations × sample sets × content types
  const totalIterations = iterations * sampleSets.length * contentTypes.length;
  let currentIteration = 0;

  trainingProgress.status = 'running';
  trainingProgress.total = totalIterations;
  trainingProgress.current = 0;

  for (let i = 0; i < iterations; i++) {
    if (shouldStop) {
      console.log('\n⛔ [API] Training stopped by user');
      trainingProgress.status = 'stopped';
      trainingProgress.stoppedAt = new Date().toISOString();
      break;
    }

    for (const sampleSet of sampleSets) {
      if (shouldStop) break;

      for (const contentType of contentTypes) {
        if (shouldStop) break;

        currentIteration++;
        trainingProgress.current = currentIteration;
        trainingProgress.percent = Math.round((currentIteration / totalIterations) * 100);
        trainingProgress.currentSet = sampleSet.name;
        trainingProgress.currentType = contentType;

        const prompt = sampleSet.prompts[contentType];
        const generator = generators[contentType];

        try {
          const result = await generator(prompt, sampleSet.files);
          stats.totalGenerations++;
          stats.byContentType[contentType].total++;

          if (result.success) {
            stats.successful++;
            stats.byContentType[contentType].successful++;

            if (result._variant?.id) {
              stats.variantUsage[result._variant.id] =
                (stats.variantUsage[result._variant.id] || 0) + 1;
            }

            const feedback = calculateRealisticFeedback(result, result._validation, contentType);
            stats.qualityScores.push(feedback.rating);
            stats.byContentType[contentType].qualityScores.push(feedback.rating);
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
            stats.byContentType[contentType].failed++;
            stats.errors.push({
              iteration: currentIteration,
              contentType,
              error: result.error
            });
          }
        } catch (error) {
          stats.failed++;
          stats.byContentType[contentType].failed++;
          stats.errors.push({
            iteration: currentIteration,
            contentType,
            error: error.message
          });
        }

        await sleep(delay);
      }
    }
  }

  await collector.flush();

  // Calculate averages
  const avgQuality = stats.qualityScores.length > 0
    ? stats.qualityScores.reduce((a, b) => a + b, 0) / stats.qualityScores.length
    : 0;

  // Calculate per-type averages
  for (const type of contentTypes) {
    const typeStats = stats.byContentType[type];
    typeStats.avgQuality = typeStats.qualityScores.length > 0
      ? (typeStats.qualityScores.reduce((a, b) => a + b, 0) / typeStats.qualityScores.length).toFixed(2)
      : 0;
    delete typeStats.qualityScores; // Don't include raw scores in output
  }

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
    byContentType: stats.byContentType,
    variantUsage: stats.variantUsage,
    errors: stats.errors.slice(-10)
  };

  const statusMsg = shouldStop ? '⛔ Stopped' : '✅ Complete';
  console.log(`\n${statusMsg} [API] Training`);
  console.log(`   Success: ${stats.successful}/${stats.totalGenerations}`);
  console.log(`   Avg Quality: ${avgQuality.toFixed(2)}/5`);
  console.log(`   By Type:`);
  for (const type of contentTypes) {
    const ts = stats.byContentType[type];
    console.log(`     ${type}: ${ts.successful}/${ts.total} (avg: ${ts.avgQuality})`);
  }
  console.log(`   Ratings: 5⭐=${stats.feedbackDistribution[5]} 4⭐=${stats.feedbackDistribution[4]} 3⭐=${stats.feedbackDistribution[3]} 2⭐=${stats.feedbackDistribution[2]} 1⭐=${stats.feedbackDistribution[1]}`);
}

export default router;
