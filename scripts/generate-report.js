#!/usr/bin/env node

/**
 * Report Generator Script - PROMPT ML CI/CD
 *
 * Generates markdown reports from evaluation and regression data.
 * Used in CI/CD pipeline for PR comments and documentation.
 */

import { readFileSync, writeFileSync } from 'fs';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    baseline: null,
    optimized: null,
    regression: null,
    benchmark: null,
    output: 'regression_report.md'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--baseline':
        options.baseline = args[++i];
        break;
      case '--optimized':
        options.optimized = args[++i];
        break;
      case '--regression':
        options.regression = args[++i];
        break;
      case '--benchmark':
        options.benchmark = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--help':
        console.log(`
Usage: node generate-report.js [options]

Options:
  --baseline <file>    Baseline metrics file
  --optimized <file>   Optimized metrics file
  --regression <file>  Regression report file
  --benchmark <file>   Benchmark results file
  --output <file>      Output markdown file (default: regression_report.md)
  --help               Show this help
        `);
        process.exit(0);
    }
  }

  return options;
}

/**
 * Generate status badge
 */
function getStatusBadge(hasRegression, hasCritical) {
  if (hasCritical) {
    return '🔴 **CRITICAL REGRESSION**';
  } else if (hasRegression) {
    return '🟠 **Regressions Detected**';
  }
  return '🟢 **All Checks Passed**';
}

/**
 * Format percentage change
 */
function formatChange(change) {
  if (change > 0) {
    return `+${change.toFixed(2)}% 📈`;
  } else if (change < 0) {
    return `${change.toFixed(2)}% 📉`;
  }
  return '0% ➡️';
}

/**
 * Generate markdown report
 */
function generateReport(options) {
  const lines = [];

  // Header
  lines.push('# 📊 PROMPT ML Optimization Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Load data
  let baseline = null;
  let optimized = null;
  let regression = null;
  let benchmark = null;

  if (options.baseline) {
    baseline = JSON.parse(readFileSync(options.baseline, 'utf8'));
  }
  if (options.optimized) {
    optimized = JSON.parse(readFileSync(options.optimized, 'utf8'));
  }
  if (options.regression) {
    regression = JSON.parse(readFileSync(options.regression, 'utf8'));
  }
  if (options.benchmark) {
    benchmark = JSON.parse(readFileSync(options.benchmark, 'utf8'));
  }

  // Status section
  if (regression) {
    lines.push('## Status');
    lines.push('');
    lines.push(getStatusBadge(regression.hasRegression, regression.hasCriticalRegression));
    lines.push('');
  }

  // Summary table
  if (baseline && optimized) {
    lines.push('## Performance Summary');
    lines.push('');
    lines.push('| Metric | Baseline | Optimized | Change |');
    lines.push('|--------|----------|-----------|--------|');

    const scoreChange = ((optimized.averageScore - baseline.averageScore) / baseline.averageScore) * 100;
    const latencyChange = ((optimized.averageLatency - baseline.averageLatency) / baseline.averageLatency) * 100;

    lines.push(`| Average Score | ${baseline.averageScore.toFixed(4)} | ${optimized.averageScore.toFixed(4)} | ${formatChange(scoreChange)} |`);
    lines.push(`| Average Latency | ${baseline.averageLatency}ms | ${optimized.averageLatency}ms | ${formatChange(-latencyChange)} |`);
    lines.push('');
  }

  // Content type breakdown
  if (baseline?.results && optimized?.results) {
    lines.push('## Content Type Breakdown');
    lines.push('');
    lines.push('| Content Type | Baseline Score | Optimized Score | Change |');
    lines.push('|--------------|----------------|-----------------|--------|');

    for (const [ct, baselineData] of Object.entries(baseline.results)) {
      const optimizedData = optimized.results[ct];
      if (optimizedData) {
        const change = ((optimizedData.score - baselineData.score) / baselineData.score) * 100;
        lines.push(`| ${ct} | ${baselineData.score.toFixed(4)} | ${optimizedData.score.toFixed(4)} | ${formatChange(change)} |`);
      }
    }
    lines.push('');
  }

  // Regressions section
  if (regression?.regressions?.length > 0) {
    lines.push('## ⚠️ Regressions');
    lines.push('');
    lines.push('| Metric | Baseline | Current | Change | Severity |');
    lines.push('|--------|----------|---------|--------|----------|');

    for (const r of regression.regressions) {
      const severityIcon = r.severity === 'critical' ? '🔴' : r.severity === 'warning' ? '🟠' : '🟡';
      lines.push(`| ${r.metric} | ${r.baseline} | ${r.current} | ${r.change}% | ${severityIcon} ${r.severity} |`);
    }
    lines.push('');
  }

  // Improvements section
  if (regression?.improvements?.length > 0) {
    lines.push('## ✅ Improvements');
    lines.push('');
    lines.push('| Metric | Baseline | Current | Change |');
    lines.push('|--------|----------|---------|--------|');

    for (const i of regression.improvements) {
      lines.push(`| ${i.metric} | ${i.baseline} | ${i.current} | +${i.change}% |`);
    }
    lines.push('');
  }

  // Benchmark results
  if (benchmark) {
    lines.push('## ⚡ Performance Benchmarks');
    lines.push('');
    lines.push('| Content Type | Avg Latency | P95 Latency | Success Rate | Throughput |');
    lines.push('|--------------|-------------|-------------|--------------|------------|');

    for (const result of benchmark.results) {
      lines.push(`| ${result.contentType} | ${result.latency.avg}ms | ${result.latency.p95}ms | ${result.successRate}% | ${result.throughput} req/min |`);
    }
    lines.push('');

    lines.push(`**Overall:** Avg ${benchmark.overall.latency.avg}ms | P95 ${benchmark.overall.latency.p95}ms | ${benchmark.overall.averageSuccessRate}% success`);
    lines.push('');
  }

  // Recommendations
  lines.push('## 📋 Recommendations');
  lines.push('');

  if (regression?.hasCriticalRegression) {
    lines.push('- 🔴 **Critical:** Address critical regressions before merging');
  }
  if (regression?.hasWarningRegression) {
    lines.push('- 🟠 **Warning:** Review warning-level regressions');
  }
  if (regression?.improvements?.length > 0) {
    lines.push('- ✅ Improvements detected - consider deploying optimized configuration');
  }
  if (!regression?.hasRegression) {
    lines.push('- ✅ No regressions detected - safe to merge');
  }

  lines.push('');

  // Footer
  lines.push('---');
  lines.push('*Generated by PROMPT ML CI/CD Pipeline*');

  return lines.join('\n');
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  console.log('📝 Generating Report');
  console.log('====================');

  try {
    const report = generateReport(options);
    writeFileSync(options.output, report);

    console.log(`✅ Report saved to: ${options.output}`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Report generation failed: ${error.message}`);
    process.exit(1);
  }
}

main();
