#!/usr/bin/env node
/**
 * PROMPT ML Training Script
 *
 * Simulates many generations to train the self-improving prompt system.
 * Uses sample research files and prompts to generate content, validate quality,
 * and provide automated feedback.
 *
 * Usage:
 *   node scripts/train-prompts.js [options]
 *
 * Options:
 *   --iterations=N    Number of training iterations per sample set (default: 50)
 *   --delay=MS        Delay between generations in ms (default: 1000)
 *   --dry-run         Show what would be done without generating
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    iterations: 50,
    delay: 1000,
    dryRun: false
  };

  for (const arg of args) {
    if (arg.startsWith('--iterations=')) {
      config.iterations = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--delay=')) {
      config.delay = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    }
  }

  return config;
}

// Load research files from a directory
async function loadResearchFiles(dirPath) {
  if (!existsSync(dirPath)) {
    console.warn(`  Directory not found: ${dirPath}`);
    return [];
  }

  const files = await readdir(dirPath);
  const researchFiles = [];

  for (const filename of files) {
    if (filename.startsWith('.')) continue;

    const filePath = join(dirPath, filename);
    try {
      const content = await readFile(filePath, 'utf8');
      researchFiles.push({ filename, content });
    } catch (error) {
      console.warn(`  Failed to read ${filename}: ${error.message}`);
    }
  }

  return researchFiles;
}

// Calculate quality score from validation result
function calculateFeedbackScore(validationResult) {
  if (!validationResult) return 3; // Neutral

  let score = 3;

  // Boost for valid output
  if (validationResult.valid !== false) score += 1;

  // Boost for quality metrics
  if (validationResult.quality?.score > 0.7) score += 1;
  if (validationResult.quality?.score > 0.9) score += 0.5;

  // Penalty for errors
  if (validationResult.errors?.length > 0) score -= 1;

  return Math.max(1, Math.min(5, Math.round(score)));
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main training function
async function runTraining(config) {
  console.log('\n🚀 PROMPT ML Training Script');
  console.log('=' .repeat(50));
  console.log(`Iterations per set: ${config.iterations}`);
  console.log(`Delay between generations: ${config.delay}ms`);
  console.log(`Dry run: ${config.dryRun}`);
  console.log('=' .repeat(50));

  // Set environment for PROMPT ML
  process.env.ENABLE_OPTIMIZATION = 'true';

  // Dynamic imports after setting env
  const { generateRoadmap } = await import('../server/generators.js');
  const { getMetricsCollector } = await import('../server/layers/optimization/metrics/index.js');
  const { getVariantRegistry } = await import('../server/layers/optimization/variants/index.js');

  const collector = getMetricsCollector();
  const registry = getVariantRegistry();

  console.log('\n📊 Initial variant stats:');
  const initialStats = registry.getStats();
  console.log(`  Total variants: ${initialStats.totalVariants}`);
  console.log(`  Champions: ${initialStats.champions}`);

  // Training statistics
  const stats = {
    totalGenerations: 0,
    successful: 0,
    failed: 0,
    avgQuality: 0,
    qualityScores: [],
    variantUsage: {}
  };

  // Load all sample sets
  console.log('\n📁 Loading sample sets...');
  const sampleSets = [];

  for (const setConfig of TRAINING_CONFIG.sampleSets) {
    const files = await loadResearchFiles(setConfig.path);
    if (files.length === 0) {
      console.warn(`  ⚠️  ${setConfig.name}: No files found`);
      continue;
    }
    console.log(`  ✓ ${setConfig.name}: ${files.length} files loaded`);
    sampleSets.push({
      ...setConfig,
      files
    });
  }

  if (sampleSets.length === 0) {
    console.error('\n❌ No sample sets with files found!');
    console.log('Please add research files to the training/sample-set-* folders.');
    process.exit(1);
  }

  // Run training iterations
  console.log('\n🏋️  Starting training...\n');

  const totalIterations = config.iterations * sampleSets.length;
  let currentIteration = 0;

  for (let i = 0; i < config.iterations; i++) {
    for (const sampleSet of sampleSets) {
      currentIteration++;
      const progress = ((currentIteration / totalIterations) * 100).toFixed(1);

      process.stdout.write(`\r  [${progress}%] Iteration ${currentIteration}/${totalIterations}: ${sampleSet.name}...`);

      if (config.dryRun) {
        await sleep(10);
        continue;
      }

      try {
        const startTime = Date.now();

        // Generate roadmap
        const result = await generateRoadmap(sampleSet.prompt, sampleSet.files);

        const latencyMs = Date.now() - startTime;
        stats.totalGenerations++;

        if (result.success) {
          stats.successful++;

          // Track variant usage
          if (result._variant?.id) {
            stats.variantUsage[result._variant.id] =
              (stats.variantUsage[result._variant.id] || 0) + 1;
          }

          // Calculate and record feedback
          const feedbackScore = calculateFeedbackScore(result._validation);
          stats.qualityScores.push(feedbackScore);

          // Record feedback if we have a generation ID
          if (result._generationId) {
            await collector.updateFeedback(result._generationId, {
              rating: feedbackScore,
              wasExported: feedbackScore >= 4
            });
          }
        } else {
          stats.failed++;
          console.log(`\n    ⚠️  Generation failed: ${result.error}`);
        }

        // Delay between generations
        await sleep(config.delay);

      } catch (error) {
        stats.failed++;
        console.log(`\n    ❌ Error: ${error.message}`);
      }
    }
  }

  // Flush metrics
  console.log('\n\n💾 Flushing metrics to storage...');
  await collector.flush();

  // Calculate final stats
  if (stats.qualityScores.length > 0) {
    stats.avgQuality = stats.qualityScores.reduce((a, b) => a + b, 0) / stats.qualityScores.length;
  }

  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📈 Training Results');
  console.log('='.repeat(50));
  console.log(`Total generations: ${stats.totalGenerations}`);
  console.log(`Successful: ${stats.successful} (${((stats.successful/stats.totalGenerations)*100).toFixed(1)}%)`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Average quality score: ${stats.avgQuality.toFixed(2)}/5`);

  console.log('\n📊 Variant usage:');
  for (const [variantId, count] of Object.entries(stats.variantUsage)) {
    const percentage = ((count / stats.successful) * 100).toFixed(1);
    console.log(`  ${variantId}: ${count} (${percentage}%)`);
  }

  // Show final variant stats
  console.log('\n📊 Final variant stats:');
  const finalStats = registry.getStats();
  console.log(`  Total variants: ${finalStats.totalVariants}`);
  console.log(`  Champions: ${finalStats.champions}`);

  // Show collector stats
  const collectorStats = await collector.getStats();
  console.log('\n📊 Metrics collector stats:');
  console.log(`  Total recorded: ${collectorStats.totalRecorded}`);
  console.log(`  Total flushed: ${collectorStats.totalFlushed}`);
  console.log(`  Feedback updates: ${collectorStats.totalFeedbackUpdates}`);

  console.log('\n✅ Training complete!');
  console.log('The evolution scheduler will analyze results on its next cycle (hourly).');
  console.log('Or run: curl -X POST http://localhost:3000/api/auto-optimize/evolution/run');
}

// Run
const config = parseArgs();
runTraining(config).catch(error => {
  console.error('\n❌ Training failed:', error);
  process.exit(1);
});
