#!/usr/bin/env node

/**
 * Regression Check Script - PROMPT ML CI/CD
 *
 * Compares baseline and current metrics to detect regressions.
 * Used in CI/CD pipeline to prevent quality degradation.
 */

import { readFileSync, writeFileSync } from 'fs';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    baseline: 'baseline_metrics.json',
    current: 'optimized_metrics.json',
    threshold: 0.05,
    output: 'regression_report.json'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--baseline':
        options.baseline = args[++i];
        break;
      case '--current':
        options.current = args[++i];
        break;
      case '--threshold':
        options.threshold = parseFloat(args[++i]);
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--help':
        console.log(`
Usage: node regression-check.js [options]

Options:
  --baseline <file>    Baseline metrics file (default: baseline_metrics.json)
  --current <file>     Current metrics file (default: optimized_metrics.json)
  --threshold <value>  Regression threshold (default: 0.05 = 5%)
  --output <file>      Output file for report (default: regression_report.json)
  --help               Show this help
        `);
        process.exit(0);
    }
  }

  return options;
}

/**
 * Check for regression between two metrics
 */
function checkRegression(baselineMetrics, currentMetrics, threshold) {
  const regressions = [];
  const improvements = [];
  const unchanged = [];

  // Check overall scores
  const overallDiff = currentMetrics.averageScore - baselineMetrics.averageScore;
  const overallPctChange = overallDiff / baselineMetrics.averageScore;

  if (overallPctChange < -threshold) {
    regressions.push({
      metric: 'averageScore',
      baseline: baselineMetrics.averageScore,
      current: currentMetrics.averageScore,
      change: parseFloat((overallPctChange * 100).toFixed(2)),
      severity: Math.abs(overallPctChange) > 0.1 ? 'critical' : 'warning'
    });
  } else if (overallPctChange > threshold) {
    improvements.push({
      metric: 'averageScore',
      baseline: baselineMetrics.averageScore,
      current: currentMetrics.averageScore,
      change: parseFloat((overallPctChange * 100).toFixed(2))
    });
  } else {
    unchanged.push({
      metric: 'averageScore',
      baseline: baselineMetrics.averageScore,
      current: currentMetrics.averageScore,
      change: parseFloat((overallPctChange * 100).toFixed(2))
    });
  }

  // Check per-content-type scores
  const baselineResults = baselineMetrics.results || {};
  const currentResults = currentMetrics.results || {};

  for (const [contentType, baselineData] of Object.entries(baselineResults)) {
    const currentData = currentResults[contentType];
    if (!currentData) continue;

    const scoreDiff = currentData.score - baselineData.score;
    const scorePctChange = scoreDiff / baselineData.score;

    if (scorePctChange < -threshold) {
      regressions.push({
        metric: `${contentType}.score`,
        baseline: baselineData.score,
        current: currentData.score,
        change: parseFloat((scorePctChange * 100).toFixed(2)),
        severity: Math.abs(scorePctChange) > 0.15 ? 'critical' : 'warning'
      });
    } else if (scorePctChange > threshold) {
      improvements.push({
        metric: `${contentType}.score`,
        baseline: baselineData.score,
        current: currentData.score,
        change: parseFloat((scorePctChange * 100).toFixed(2))
      });
    }

    // Check individual metrics if available
    if (baselineData.metrics && currentData.metrics) {
      for (const [metricName, baselineValue] of Object.entries(baselineData.metrics)) {
        const currentValue = currentData.metrics[metricName];
        if (currentValue === undefined) continue;

        const metricDiff = currentValue - baselineValue;
        const metricPctChange = metricDiff / baselineValue;

        if (metricPctChange < -threshold) {
          regressions.push({
            metric: `${contentType}.${metricName}`,
            baseline: baselineValue,
            current: currentValue,
            change: parseFloat((metricPctChange * 100).toFixed(2)),
            severity: 'info'
          });
        }
      }
    }
  }

  // Check latency (increase is regression)
  const latencyDiff = currentMetrics.averageLatency - baselineMetrics.averageLatency;
  const latencyPctChange = latencyDiff / baselineMetrics.averageLatency;

  if (latencyPctChange > 0.2) { // 20% latency increase is regression
    regressions.push({
      metric: 'averageLatency',
      baseline: baselineMetrics.averageLatency,
      current: currentMetrics.averageLatency,
      change: parseFloat((latencyPctChange * 100).toFixed(2)),
      severity: latencyPctChange > 0.5 ? 'warning' : 'info'
    });
  }

  return {
    regressions,
    improvements,
    unchanged
  };
}

/**
 * Main regression check function
 */
async function main() {
  const options = parseArgs();

  console.log('🔍 PROMPT ML Regression Check');
  console.log('=============================');
  console.log(`Baseline: ${options.baseline}`);
  console.log(`Current: ${options.current}`);
  console.log(`Threshold: ${(options.threshold * 100).toFixed(1)}%`);
  console.log('');

  try {
    // Load metrics
    const baselineMetrics = JSON.parse(readFileSync(options.baseline, 'utf8'));
    const currentMetrics = JSON.parse(readFileSync(options.current, 'utf8'));

    // Check for regressions
    const results = checkRegression(baselineMetrics, currentMetrics, options.threshold);

    // Determine overall status
    const hasCriticalRegression = results.regressions.some(r => r.severity === 'critical');
    const hasWarningRegression = results.regressions.some(r => r.severity === 'warning');
    const hasRegression = results.regressions.length > 0;

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      hasRegression,
      hasCriticalRegression,
      hasWarningRegression,
      threshold: options.threshold,
      summary: {
        regressionCount: results.regressions.length,
        improvementCount: results.improvements.length,
        unchangedCount: results.unchanged.length
      },
      regressions: results.regressions,
      improvements: results.improvements,
      unchanged: results.unchanged,
      baseline: {
        timestamp: baselineMetrics.timestamp,
        averageScore: baselineMetrics.averageScore,
        averageLatency: baselineMetrics.averageLatency
      },
      current: {
        timestamp: currentMetrics.timestamp,
        averageScore: currentMetrics.averageScore,
        averageLatency: currentMetrics.averageLatency
      }
    };

    // Output results
    writeFileSync(options.output, JSON.stringify(report, null, 2));

    // Console output
    if (hasCriticalRegression) {
      console.log('🔴 CRITICAL REGRESSION DETECTED');
    } else if (hasWarningRegression) {
      console.log('🟠 WARNING: Regressions detected');
    } else if (hasRegression) {
      console.log('🟡 Minor regressions detected');
    } else {
      console.log('🟢 No regressions detected');
    }

    console.log(`\nSummary:`);
    console.log(`  Regressions: ${results.regressions.length}`);
    console.log(`  Improvements: ${results.improvements.length}`);
    console.log(`  Unchanged: ${results.unchanged.length}`);

    if (results.regressions.length > 0) {
      console.log('\nRegressions:');
      for (const r of results.regressions) {
        const icon = r.severity === 'critical' ? '🔴' : r.severity === 'warning' ? '🟠' : '🟡';
        console.log(`  ${icon} ${r.metric}: ${r.baseline} → ${r.current} (${r.change}%)`);
      }
    }

    if (results.improvements.length > 0) {
      console.log('\nImprovements:');
      for (const i of results.improvements) {
        console.log(`  🟢 ${i.metric}: ${i.baseline} → ${i.current} (+${i.change}%)`);
      }
    }

    console.log(`\nReport saved to: ${options.output}`);

    // Exit with error code if critical regression
    process.exit(hasCriticalRegression ? 1 : 0);
  } catch (error) {
    console.error(`\n❌ Regression check failed: ${error.message}`);
    process.exit(1);
  }
}

main();
