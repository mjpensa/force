/**
 * Utility Functions Module
 * Phase 3 Enhancement: Extracted from chart-renderer.js for better maintainability
 * Contains DOM helpers, validators, and utility functions
 */

import { CONFIG } from './config.js';

/**
 * DOM ACCESS HELPERS
 * Safely gets DOM elements with error logging
 */

/**
 * Safely gets DOM element by ID with error logging
 * @param {string} id - Element ID
 * @param {string} context - Context for error message (function name)
 * @returns {HTMLElement|null}
 */
export function safeGetElement(id, context = '') {
  const element = document.getElementById(id);
  if (!element) {
    console.error(`Element not found: #${id}${context ? ` (in ${context})` : ''}`);
  }
  return element;
}

/**
 * Safely queries DOM element with error logging
 * @param {string} selector - CSS selector
 * @param {string} context - Context for error message (function name)
 * @returns {HTMLElement|null}
 */
export function safeQuerySelector(selector, context = '') {
  const element = document.querySelector(selector);
  if (!element) {
    console.error(`Element not found: ${selector}${context ? ` (in ${context})` : ''}`);
  }
  return element;
}

/**
 * URL VALIDATION
 */

/**
 * Validates that a URL is safe (only http/https protocols).
 * Prevents javascript: and other dangerous protocols.
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if URL is safe
 */
export function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false; // Invalid URL
  }
}

/**
 * DATE/TIME UTILITIES
 */

/**
 * Gets the ISO 8601 week number for a given date.
 * ISO 8601 weeks start on Monday and the first week of the year
 * contains the first Thursday of the year.
 * @param {Date} date - The date to get the week number for
 * @returns {number} The ISO 8601 week number (1-53)
 */
export function getWeek(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Finds the column index and percentage offset for today's date.
 * Analyzes the time column format to determine granularity (Year/Quarter/Month/Week),
 * then calculates where today falls within that column.
 * @param {Date} today - The current date
 * @param {string[]} timeColumns - The array of time columns (determines format)
 * @returns {{index: number, percentage: number}|null} Position object with column index and percentage offset, or null if not found
 */
export function findTodayColumnPosition(today, timeColumns) {
  if (timeColumns.length === 0) return null;

  const firstCol = timeColumns[0];
  const todayYear = today.getFullYear();

  // 1. Check for Year columns (e.g., "2025")
  if (/^\d{4}$/.test(firstCol)) {
    const todayYearStr = todayYear.toString();
    const index = timeColumns.indexOf(todayYearStr);
    if (index === -1) return null;

    const startOfYear = new Date(todayYear, 0, 1);
    const endOfYear = new Date(todayYear, 11, 31);
    const dayOfYear = (today - startOfYear) / (1000 * 60 * 60 * 24);
    const totalDays = (endOfYear - startOfYear) / (1000 * 60 * 60 * 24);
    const percentage = dayOfYear / totalDays;
    return { index, percentage };
  }

  // 2. Check for Quarter columns (e.g., "Q4 2025")
  if (/^Q[1-4]\s\d{4}$/.test(firstCol)) {
    const month = today.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    const todayQuarterStr = `Q${quarter} ${todayYear}`;
    const index = timeColumns.indexOf(todayQuarterStr);
    if (index === -1) return null;

    const quarterStartMonth = (quarter - 1) * 3;
    const startOfQuarter = new Date(todayYear, quarterStartMonth, 1);
    const endOfQuarter = new Date(todayYear, quarterStartMonth + 3, 0); // 0th day of next month
    const dayInQuarter = (today - startOfQuarter) / (1000 * 60 * 60 * 24);
    const totalDays = (endOfQuarter - startOfQuarter) / (1000 * 60 * 60 * 24);
    const percentage = dayInQuarter / totalDays;
    return { index, percentage };
  }

  // 3. Check for Month columns (e.g., "Nov 2025")
  if (/^[A-Za-z]{3}\s\d{4}$/.test(firstCol)) {
    const todayMonthStr = today.toLocaleString('en-US', { month: 'short' }) + ` ${todayYear}`;
    const index = timeColumns.indexOf(todayMonthStr);
    if (index === -1) return null;

    const startOfMonth = new Date(todayYear, today.getMonth(), 1);
    const endOfMonth = new Date(todayYear, today.getMonth() + 1, 0);
    const dayInMonth = today.getDate(); // 14th
    const totalDays = endOfMonth.getDate(); // 30 for Nov
    const percentage = dayInMonth / totalDays;
    return { index, percentage };
  }

  // 4. Check for Week columns (e.g., "W46 2025")
  if (/^W\d{1,2}\s\d{4}$/.test(firstCol)) {
    const todayWeekStr = `W${getWeek(today)} ${todayYear}`;
    const index = timeColumns.indexOf(todayWeekStr);
    if (index === -1) return null;

    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
    const percentage = (dayOfWeek + 0.5) / 7; // Place line in middle of the day
    return { index, percentage };
  }

  return null; // Unknown format
}

/**
 * HTML BUILDER HELPERS
 * Functions to build sanitized HTML for modal content
 */

/**
 * Builds an HTML string for a <section> in the modal.
 * Skips if content is null or empty.
 * Content is sanitized to prevent XSS.
 */
export function buildAnalysisSection(title, content) {
  if (!content) return '';
  // Sanitize title and content using DOMPurify (assumed to be globally available)
  const safeTitle = DOMPurify.sanitize(title);
  const safeContent = DOMPurify.sanitize(content);
  return `
    <div class="analysis-section">
      <h4>${safeTitle}</h4>
      <p>${safeContent}</p>
    </div>
  `;
}

/**
 * Builds an HTML string for a <ul> of facts/assumptions.
 * Skips if list is null or empty.
 * Content is sanitized to prevent XSS.
 */
export function buildAnalysisList(title, items, itemKey, sourceKey) {
  if (!items || items.length === 0) return '';

  const listItems = items.map(item => {
    const itemText = DOMPurify.sanitize(item[itemKey] || '');
    let sourceText = DOMPurify.sanitize(item[sourceKey] || 'Source not available');

    // If URL is present, validate and make the source a link
    if (item.url && isSafeUrl(item.url)) {
      const safeUrl = DOMPurify.sanitize(item.url);
      sourceText = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${sourceText}</a>`;
    }

    return `
      <li>
        <p>${itemText}</p>
        <p class="source">${sourceText}</p>
      </li>
    `;
  }).join('');

  const safeTitle = DOMPurify.sanitize(title);
  return `
    <div class="analysis-section">
      <h4>${safeTitle}</h4>
      <ul class="analysis-list">
        ${listItems}
      </ul>
    </div>
  `;
}

/**
 * PHASE 1 ENHANCEMENT - NEW RENDERING FUNCTIONS
 */

/**
 * Builds HTML for Timeline Scenarios section with visual bars
 * Shows best-case, expected, and worst-case completion dates
 */
export function buildTimelineScenarios(timelineScenarios) {
  if (!timelineScenarios) return '';

  const { expected, bestCase, worstCase, likelyDelayFactors } = timelineScenarios;

  let scenariosHTML = '';

  // Best Case
  if (bestCase && bestCase.date) {
    scenariosHTML += `
      <div class="timeline-scenario best-case">
        <div class="scenario-header">
          <span class="scenario-label">Best-Case:</span>
          <span class="scenario-date">${DOMPurify.sanitize(bestCase.date)}</span>
        </div>
        <div class="timeline-bar best-case-bar"></div>
        ${bestCase.assumptions ? `<p class="scenario-detail">${DOMPurify.sanitize(bestCase.assumptions)}</p>` : ''}
      </div>
    `;
  }

  // Expected
  if (expected && expected.date) {
    const confidenceBadge = expected.confidence ?
      `<span class="confidence-badge confidence-${expected.confidence}">${DOMPurify.sanitize(expected.confidence)} confidence</span>` : '';
    scenariosHTML += `
      <div class="timeline-scenario expected">
        <div class="scenario-header">
          <span class="scenario-label">Expected:</span>
          <span class="scenario-date">${DOMPurify.sanitize(expected.date)}</span>
          ${confidenceBadge}
        </div>
        <div class="timeline-bar expected-bar"></div>
      </div>
    `;
  }

  // Worst Case
  if (worstCase && worstCase.date) {
    scenariosHTML += `
      <div class="timeline-scenario worst-case">
        <div class="scenario-header">
          <span class="scenario-label">Worst-Case:</span>
          <span class="scenario-date">${DOMPurify.sanitize(worstCase.date)}</span>
        </div>
        <div class="timeline-bar worst-case-bar"></div>
        ${worstCase.risks ? `<p class="scenario-detail">${DOMPurify.sanitize(worstCase.risks)}</p>` : ''}
      </div>
    `;
  }

  // Likely Delay Factors
  let delayFactorsHTML = '';
  if (likelyDelayFactors && likelyDelayFactors.length > 0) {
    const factorItems = likelyDelayFactors.map(factor =>
      `<li>${DOMPurify.sanitize(factor)}</li>`
    ).join('');
    delayFactorsHTML = `
      <div class="delay-factors">
        <h5>Most Likely Delay Factors:</h5>
        <ul>${factorItems}</ul>
      </div>
    `;
  }

  return `
    <div class="analysis-section timeline-scenarios-section">
      <h4>📅 Timeline Scenarios</h4>
      <div class="scenarios-container">
        ${scenariosHTML}
      </div>
      ${delayFactorsHTML}
    </div>
  `;
}

/**
 * Builds HTML for Risk Analysis section with severity badges
 * Shows structured risks with impact and mitigation
 */
export function buildRiskAnalysis(risks) {
  if (!risks || risks.length === 0) return '';

  const riskCards = risks.map(risk => {
    const severityClass = risk.severity || 'low';
    const likelihoodClass = risk.likelihood || 'unlikely';

    return `
      <div class="risk-card risk-${severityClass}">
        <div class="risk-header">
          <span class="risk-severity-badge severity-${severityClass}">
            ${severityClass === 'high' ? '🔴' : severityClass === 'medium' ? '🟡' : '⚫'}
            ${DOMPurify.sanitize(severityClass.toUpperCase())}
          </span>
          <span class="risk-likelihood">[${DOMPurify.sanitize(likelihoodClass)}]</span>
          <span class="risk-name">${DOMPurify.sanitize(risk.name || '')}</span>
        </div>
        ${risk.impact ? `<p class="risk-impact"><strong>Impact:</strong> ${DOMPurify.sanitize(risk.impact)}</p>` : ''}
        ${risk.mitigation ? `<p class="risk-mitigation"><strong>Mitigation:</strong> ${DOMPurify.sanitize(risk.mitigation)}</p>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="analysis-section risks-section">
      <h4>🚨 Risks & Roadblocks</h4>
      <div class="risks-container">
        ${riskCards}
      </div>
    </div>
  `;
}

/**
 * Builds HTML for Impact Analysis section
 * Shows downstream effects and stakeholder impact
 */
export function buildImpactAnalysis(impact) {
  if (!impact) return '';

  let contentHTML = '';

  if (impact.downstreamTasks !== undefined && impact.downstreamTasks !== null) {
    contentHTML += `
      <p class="impact-item">
        <strong>Downstream Tasks:</strong>
        <span class="impact-value">${impact.downstreamTasks} task${impact.downstreamTasks !== 1 ? 's' : ''} blocked if delayed</span>
      </p>
    `;
  }

  if (impact.businessImpact) {
    contentHTML += `
      <p class="impact-item">
        <strong>Business Impact:</strong>
        ${DOMPurify.sanitize(impact.businessImpact)}
      </p>
    `;
  }

  if (impact.strategicImpact) {
    contentHTML += `
      <p class="impact-item">
        <strong>Strategic Impact:</strong>
        ${DOMPurify.sanitize(impact.strategicImpact)}
      </p>
    `;
  }

  if (impact.stakeholders && impact.stakeholders.length > 0) {
    const stakeholderList = impact.stakeholders.map(s => DOMPurify.sanitize(s)).join(', ');
    contentHTML += `
      <p class="impact-item">
        <strong>Stakeholders:</strong>
        ${stakeholderList}
      </p>
    `;
  }

  if (!contentHTML) return '';

  return `
    <div class="analysis-section impact-section">
      <h4>📊 Impact Analysis</h4>
      <div class="impact-content">
        ${contentHTML}
      </div>
    </div>
  `;
}

/**
 * Builds HTML for Scheduling Context section
 * Shows why task starts when it does and dependencies
 */
export function buildSchedulingContext(schedulingContext) {
  if (!schedulingContext) return '';

  let contentHTML = '';

  if (schedulingContext.rationale) {
    contentHTML += `
      <p class="scheduling-item">
        <strong>Scheduling Rationale:</strong>
        ${DOMPurify.sanitize(schedulingContext.rationale)}
      </p>
    `;
  }

  if (schedulingContext.predecessors && schedulingContext.predecessors.length > 0) {
    const predList = schedulingContext.predecessors.map(p =>
      `<li>${DOMPurify.sanitize(p)}</li>`
    ).join('');
    contentHTML += `
      <div class="scheduling-item">
        <strong>Depends On:</strong>
        <ul class="dependency-list">${predList}</ul>
      </div>
    `;
  }

  if (schedulingContext.successors && schedulingContext.successors.length > 0) {
    const succList = schedulingContext.successors.map(s =>
      `<li>${DOMPurify.sanitize(s)}</li>`
    ).join('');
    contentHTML += `
      <div class="scheduling-item">
        <strong>Blocks:</strong>
        <ul class="dependency-list">${succList}</ul>
      </div>
    `;
  }

  if (schedulingContext.isCriticalPath !== undefined) {
    const criticalPathIcon = schedulingContext.isCriticalPath ? '✅' : '❌';
    contentHTML += `
      <p class="scheduling-item">
        <strong>Critical Path:</strong>
        ${criticalPathIcon} ${schedulingContext.isCriticalPath ? 'Yes' : 'No'}
        ${schedulingContext.isCriticalPath ? '- Any delay impacts final deadline' : '- Has schedule flexibility'}
      </p>
    `;
  }

  if (schedulingContext.slackDays !== undefined && schedulingContext.slackDays !== null) {
    contentHTML += `
      <p class="scheduling-item">
        <strong>Schedule Slack:</strong>
        ${schedulingContext.slackDays} day${schedulingContext.slackDays !== 1 ? 's' : ''}
      </p>
    `;
  }

  if (!contentHTML) return '';

  return `
    <div class="analysis-section scheduling-section">
      <h4>🎯 Why This Task Starts Now</h4>
      <div class="scheduling-content">
        ${contentHTML}
      </div>
    </div>
  `;
}

/**
 * PHASE 2 ENHANCEMENT - NEW RENDERING FUNCTIONS
 */

/**
 * Builds HTML for Progress Indicators section (in-progress tasks only)
 * Shows completion percentage, milestones, velocity, and active blockers
 */
export function buildProgressIndicators(progress, taskStatus) {
  // Only show for in-progress tasks
  if (!progress || taskStatus !== 'in-progress') return '';

  let contentHTML = '';

  // Progress bar with percentage
  if (progress.percentComplete !== undefined && progress.percentComplete !== null) {
    const percent = Math.min(100, Math.max(0, progress.percentComplete)); // Clamp to 0-100
    const velocityClass = progress.velocity || 'on-track';
    const velocityLabel = velocityClass === 'on-track' ? 'On Track' :
                          velocityClass === 'behind' ? 'Behind Schedule' : 'Ahead of Schedule';
    const velocityIcon = velocityClass === 'on-track' ? '✓' :
                         velocityClass === 'behind' ? '⚠️' : '⚡';

    contentHTML += `
      <div class="progress-bar-container">
        <div class="progress-header">
          <span class="progress-percent">${percent}% Complete</span>
          <span class="velocity-badge velocity-${velocityClass}">
            ${velocityIcon} ${velocityLabel}
          </span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill progress-${velocityClass}" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }

  // Milestones
  if (progress.milestones && progress.milestones.length > 0) {
    const milestoneItems = progress.milestones.map(milestone => {
      const statusIcon = milestone.completed ? '✅' : '⬜';
      const statusClass = milestone.completed ? 'completed' : 'pending';
      return `
        <li class="milestone-item milestone-${statusClass}">
          <span class="milestone-icon">${statusIcon}</span>
          <div class="milestone-details">
            <span class="milestone-name">${DOMPurify.sanitize(milestone.name)}</span>
            <span class="milestone-date">${DOMPurify.sanitize(milestone.date || 'TBD')}</span>
          </div>
        </li>
      `;
    }).join('');

    contentHTML += `
      <div class="milestones-section">
        <h5>Milestones</h5>
        <ul class="milestones-list">${milestoneItems}</ul>
      </div>
    `;
  }

  // Active Blockers
  if (progress.activeBlockers && progress.activeBlockers.length > 0) {
    const blockerItems = progress.activeBlockers.map(blocker =>
      `<li>🚫 ${DOMPurify.sanitize(blocker)}</li>`
    ).join('');

    contentHTML += `
      <div class="blockers-section">
        <h5>Active Blockers</h5>
        <ul class="blockers-list">${blockerItems}</ul>
      </div>
    `;
  }

  if (!contentHTML) return '';

  return `
    <div class="analysis-section progress-section">
      <h4>📈 Progress Tracking</h4>
      <div class="progress-content">
        ${contentHTML}
      </div>
    </div>
  `;
}

/**
 * Builds HTML for Motivators & Accelerators section
 * Shows factors that can speed up completion or ensure success
 */
export function buildAccelerators(accelerators) {
  if (!accelerators) return '';

  let contentHTML = '';

  // External Drivers
  if (accelerators.externalDrivers && accelerators.externalDrivers.length > 0) {
    const driverItems = accelerators.externalDrivers.map(driver =>
      `<li>${DOMPurify.sanitize(driver)}</li>`
    ).join('');
    contentHTML += `
      <div class="accelerator-subsection">
        <h5>External Drivers</h5>
        <ul class="accelerator-list">${driverItems}</ul>
      </div>
    `;
  }

  // Internal Incentives
  if (accelerators.internalIncentives && accelerators.internalIncentives.length > 0) {
    const incentiveItems = accelerators.internalIncentives.map(incentive =>
      `<li>${DOMPurify.sanitize(incentive)}</li>`
    ).join('');
    contentHTML += `
      <div class="accelerator-subsection">
        <h5>Internal Incentives</h5>
        <ul class="accelerator-list">${incentiveItems}</ul>
      </div>
    `;
  }

  // Efficiency Opportunities
  if (accelerators.efficiencyOpportunities && accelerators.efficiencyOpportunities.length > 0) {
    const opportunityItems = accelerators.efficiencyOpportunities.map(opportunity =>
      `<li>${DOMPurify.sanitize(opportunity)}</li>`
    ).join('');
    contentHTML += `
      <div class="accelerator-subsection">
        <h5>Efficiency Opportunities</h5>
        <ul class="accelerator-list">${opportunityItems}</ul>
      </div>
    `;
  }

  // Success Factors
  if (accelerators.successFactors && accelerators.successFactors.length > 0) {
    const factorItems = accelerators.successFactors.map(factor =>
      `<li>${DOMPurify.sanitize(factor)}</li>`
    ).join('');
    contentHTML += `
      <div class="accelerator-subsection">
        <h5>Success Factors</h5>
        <ul class="accelerator-list">${factorItems}</ul>
      </div>
    `;
  }

  if (!contentHTML) return '';

  return `
    <div class="analysis-section accelerators-section">
      <h4>⚡ Motivators & Accelerators</h4>
      <div class="accelerators-content">
        ${contentHTML}
      </div>
    </div>
  `;
}

/**
 * BANKING ENHANCEMENT - Financial Impact Dashboard
 * Builds the Financial Impact Dashboard section
 * Shows costs, benefits, and ROI metrics in executive-friendly format
 * @param {Object} financialImpact - Financial impact data from AI analysis
 * @returns {string} HTML string for the financial impact section
 */
export function buildFinancialImpact(financialImpact) {
  if (!financialImpact || !financialImpact.costs) return '';

  const costs = financialImpact.costs || {};
  const benefits = financialImpact.benefits || {};
  const roi = financialImpact.roiMetrics || {};

  // Confidence level badge color
  const confidenceColors = {
    high: '#50AF7B',
    medium: '#EE9E20',
    low: '#BA3930'
  };
  const confidenceColor = confidenceColors[roi.confidenceLevel] || '#666666';

  return `
    <div class="analysis-section financial-impact-section">
      <h4>💰 Financial Impact Analysis</h4>

      <div class="financial-dashboard">
        <!-- ROI Summary Card (Most Prominent) -->
        <div class="roi-summary-card">
          <div class="roi-header">
            <h5>Investment Summary</h5>
            <span class="confidence-badge" style="background-color: ${confidenceColor};">
              ${roi.confidenceLevel ? roi.confidenceLevel.toUpperCase() : 'MEDIUM'} CONFIDENCE
            </span>
          </div>

          <div class="roi-metrics">
            <div class="roi-metric primary">
              <span class="metric-label">Payback Period</span>
              <span class="metric-value">${DOMPurify.sanitize(roi.paybackPeriod || 'TBD')}</span>
            </div>
            <div class="roi-metric primary">
              <span class="metric-label">First Year ROI</span>
              <span class="metric-value highlight-green">${DOMPurify.sanitize(roi.firstYearROI || 'TBD')}</span>
            </div>
            <div class="roi-metric">
              <span class="metric-label">3-Year NPV</span>
              <span class="metric-value">${DOMPurify.sanitize(roi.threeYearNPV || 'TBD')}</span>
            </div>
          </div>
        </div>

        <!-- Cost Breakdown -->
        <div class="financial-breakdown-card">
          <h5>Investment Required</h5>
          <div class="financial-items">
            ${costs.laborCosts ? `
              <div class="financial-item cost">
                <span class="item-label">Labor Costs</span>
                <span class="item-value">${DOMPurify.sanitize(costs.laborCosts)}</span>
              </div>
            ` : ''}
            ${costs.technologyCosts ? `
              <div class="financial-item cost">
                <span class="item-label">Technology</span>
                <span class="item-value">${DOMPurify.sanitize(costs.technologyCosts)}</span>
              </div>
            ` : ''}
            ${costs.vendorCosts ? `
              <div class="financial-item cost">
                <span class="item-label">Vendors/Consulting</span>
                <span class="item-value">${DOMPurify.sanitize(costs.vendorCosts)}</span>
              </div>
            ` : ''}
            <div class="financial-item cost total">
              <span class="item-label">Total Investment</span>
              <span class="item-value">${DOMPurify.sanitize(costs.totalCost || 'TBD')}</span>
            </div>
          </div>
        </div>

        <!-- Benefit Breakdown -->
        <div class="financial-breakdown-card">
          <h5>Expected Annual Benefits</h5>
          <div class="financial-items">
            ${benefits.revenueIncrease ? `
              <div class="financial-item benefit">
                <span class="item-label">Revenue Increase</span>
                <span class="item-value">${DOMPurify.sanitize(benefits.revenueIncrease)}</span>
              </div>
            ` : ''}
            ${benefits.costSavings ? `
              <div class="financial-item benefit">
                <span class="item-label">Cost Savings</span>
                <span class="item-value">${DOMPurify.sanitize(benefits.costSavings)}</span>
              </div>
            ` : ''}
            ${benefits.riskReduction ? `
              <div class="financial-item benefit">
                <span class="item-label">Risk Mitigation</span>
                <span class="item-value">${DOMPurify.sanitize(benefits.riskReduction)}</span>
              </div>
            ` : ''}
            <div class="financial-item benefit total">
              <span class="item-label">Total Annual Benefit</span>
              <span class="item-value highlight-green">${DOMPurify.sanitize(benefits.totalAnnualBenefit || 'TBD')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * BANKING ENHANCEMENT - Stakeholder & Change Management Analysis
 * Builds the Stakeholder Impact section
 * Shows customer impact, internal stakeholders, executive alignment, change readiness, and resistance risks
 * @param {Object} stakeholderImpact - Stakeholder analysis data from AI
 * @returns {string} HTML string for the stakeholder impact section
 */
export function buildStakeholderImpact(stakeholderImpact) {
  if (!stakeholderImpact) return '';

  const customer = stakeholderImpact.customerExperience || {};
  const stakeholders = stakeholderImpact.internalStakeholders || [];
  const alignment = stakeholderImpact.executiveAlignment || {};
  const readiness = stakeholderImpact.changeReadiness || {};
  const risks = stakeholderImpact.resistanceRisks || [];

  // Helper function to build stakeholder cards
  const buildStakeholderCards = () => {
    if (!stakeholders.length) return '<p class="no-data">No stakeholder data available</p>';

    return stakeholders.map(sh => {
      const impactColor = {
        high: '#BA3930',
        medium: '#EE9E20',
        low: '#50AF7B'
      }[sh.impactLevel] || '#666666';

      return `
        <div class="stakeholder-card">
          <div class="stakeholder-header">
            <h6>${DOMPurify.sanitize(sh.group || 'Unknown Group')}</h6>
            <span class="impact-badge" style="background-color: ${impactColor};">
              ${DOMPurify.sanitize(sh.impactLevel || 'medium').toUpperCase()} IMPACT
            </span>
          </div>
          <div class="stakeholder-details">
            <div class="detail-row">
              <span class="detail-label">Size:</span>
              <span class="detail-value">${DOMPurify.sanitize(sh.size || 'Unknown')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Current Role:</span>
              <span class="detail-value">${DOMPurify.sanitize(sh.currentRole || 'N/A')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Future Role:</span>
              <span class="detail-value">${DOMPurify.sanitize(sh.futureRole || 'N/A')}</span>
            </div>
            ${sh.concerns && sh.concerns.length ? `
              <div class="detail-row">
                <span class="detail-label">Key Concerns:</span>
                <ul class="concerns-list">
                  ${sh.concerns.map(c => `<li>${DOMPurify.sanitize(c)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${sh.trainingNeeds ? `
              <div class="detail-row">
                <span class="detail-label">Training Needs:</span>
                <span class="detail-value">${DOMPurify.sanitize(sh.trainingNeeds)}</span>
              </div>
            ` : ''}
            ${sh.championOpportunity ? `
              <div class="champion-badge">⭐ Potential Change Champion</div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  };

  // Helper function to build executive alignment visualization
  const buildExecutiveAlignment = () => {
    if (!alignment.sponsor && !alignment.supporters && !alignment.neutrals && !alignment.resistors) {
      return '<p class="no-data">No executive alignment data available</p>';
    }

    return `
      <div class="executive-alignment-grid">
        ${alignment.sponsor ? `
          <div class="alignment-section sponsor">
            <h6>👔 Executive Sponsor</h6>
            <p>${DOMPurify.sanitize(alignment.sponsor)}</p>
          </div>
        ` : ''}

        ${alignment.supporters && alignment.supporters.length ? `
          <div class="alignment-section supporters">
            <h6>✅ Supporters</h6>
            <ul>
              ${alignment.supporters.map(s => `<li>${DOMPurify.sanitize(s)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${alignment.neutrals && alignment.neutrals.length ? `
          <div class="alignment-section neutrals">
            <h6>⚪ Neutrals</h6>
            <ul>
              ${alignment.neutrals.map(n => `<li>${DOMPurify.sanitize(n)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${alignment.resistors && alignment.resistors.length ? `
          <div class="alignment-section resistors">
            <h6>⛔ Potential Resistors</h6>
            <ul>
              ${alignment.resistors.map(r => `<li>${DOMPurify.sanitize(r)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${alignment.alignmentStrategy ? `
          <div class="alignment-section strategy">
            <h6>🎯 Alignment Strategy</h6>
            <p>${DOMPurify.sanitize(alignment.alignmentStrategy)}</p>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Helper function to build change readiness gauge
  const buildChangeReadiness = () => {
    const score = readiness.score || 50;
    const scoreColor = score >= 70 ? '#50AF7B' : score >= 40 ? '#EE9E20' : '#BA3930';
    const scoreLabel = score >= 70 ? 'Good Readiness' : score >= 40 ? 'Moderate Readiness' : 'Low Readiness';

    return `
      <div class="change-readiness-card">
        <div class="readiness-gauge">
          <div class="gauge-container">
            <div class="gauge-bar" style="width: ${score}%; background-color: ${scoreColor};"></div>
          </div>
          <div class="gauge-label">
            <span class="score-value">${score}/100</span>
            <span class="score-label">${scoreLabel}</span>
          </div>
        </div>

        <div class="readiness-factors">
          ${readiness.culturalFit ? `
            <div class="factor">
              <strong>Cultural Fit:</strong> ${DOMPurify.sanitize(readiness.culturalFit)}
            </div>
          ` : ''}
          ${readiness.historicalChangeSuccess ? `
            <div class="factor">
              <strong>Past Change Success:</strong> ${DOMPurify.sanitize(readiness.historicalChangeSuccess)}
            </div>
          ` : ''}
          ${readiness.leadershipSupport ? `
            <div class="factor">
              <strong>Leadership Support:</strong> ${DOMPurify.sanitize(readiness.leadershipSupport)}
            </div>
          ` : ''}
          ${readiness.resourceAvailability ? `
            <div class="factor">
              <strong>Resource Availability:</strong> ${DOMPurify.sanitize(readiness.resourceAvailability)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  };

  // Helper function to build resistance risks table
  const buildResistanceRisks = () => {
    if (!risks.length) return '<p class="no-data">No resistance risks identified</p>';

    return `
      <div class="resistance-risks-table">
        ${risks.map(risk => {
          const probColor = {
            high: '#BA3930',
            medium: '#EE9E20',
            low: '#50AF7B'
          }[risk.probability] || '#666666';

          const impactColor = {
            critical: '#DA291C',
            major: '#BA3930',
            moderate: '#EE9E20'
          }[risk.impact] || '#666666';

          return `
            <div class="risk-card">
              <div class="risk-header">
                <h6>${DOMPurify.sanitize(risk.risk || 'Unknown Risk')}</h6>
                <div class="risk-badges">
                  <span class="risk-badge" style="background-color: ${probColor};">
                    ${DOMPurify.sanitize(risk.probability || 'medium').toUpperCase()} PROB
                  </span>
                  <span class="risk-badge" style="background-color: ${impactColor};">
                    ${DOMPurify.sanitize(risk.impact || 'moderate').toUpperCase()} IMPACT
                  </span>
                </div>
              </div>
              ${risk.mitigation ? `
                <div class="risk-mitigation">
                  <strong>Mitigation:</strong> ${DOMPurify.sanitize(risk.mitigation)}
                </div>
              ` : ''}
              ${risk.earlyWarnings && risk.earlyWarnings.length ? `
                <div class="early-warnings">
                  <strong>Early Warning Signs:</strong>
                  <ul>
                    ${risk.earlyWarnings.map(w => `<li>${DOMPurify.sanitize(w)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  // Main section HTML
  return `
    <div class="analysis-section stakeholder-impact-section">
      <h4>👥 Stakeholder & Change Management Analysis</h4>

      <!-- Customer Experience Impact -->
      ${customer.currentState || customer.futureState ? `
        <div class="stakeholder-subsection customer-experience">
          <h5>🎯 Customer Experience Impact</h5>
          <div class="customer-comparison">
            ${customer.currentState ? `
              <div class="customer-state current">
                <h6>Current State</h6>
                <p>${DOMPurify.sanitize(customer.currentState)}</p>
              </div>
            ` : ''}
            ${customer.futureState ? `
              <div class="customer-state future">
                <h6>Future State</h6>
                <p>${DOMPurify.sanitize(customer.futureState)}</p>
              </div>
            ` : ''}
          </div>
          ${customer.primaryBenefits && customer.primaryBenefits.length ? `
            <div class="customer-benefits">
              <h6>Primary Benefits</h6>
              <ul>
                ${customer.primaryBenefits.map(b => `<li>✓ ${DOMPurify.sanitize(b)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${customer.potentialConcerns && customer.potentialConcerns.length ? `
            <div class="customer-concerns">
              <h6>Potential Concerns</h6>
              <ul>
                ${customer.potentialConcerns.map(c => `<li>⚠ ${DOMPurify.sanitize(c)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${customer.communicationStrategy ? `
            <div class="communication-strategy">
              <h6>Communication Strategy</h6>
              <p>${DOMPurify.sanitize(customer.communicationStrategy)}</p>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Internal Stakeholders -->
      ${stakeholders.length ? `
        <div class="stakeholder-subsection internal-stakeholders">
          <h5>🏢 Internal Stakeholders</h5>
          <div class="stakeholders-grid">
            ${buildStakeholderCards()}
          </div>
        </div>
      ` : ''}

      <!-- Executive Alignment -->
      ${alignment.sponsor || alignment.supporters ? `
        <div class="stakeholder-subsection executive-alignment">
          <h5>👔 Executive Alignment</h5>
          ${buildExecutiveAlignment()}
        </div>
      ` : ''}

      <!-- Change Readiness -->
      ${readiness.score !== undefined ? `
        <div class="stakeholder-subsection change-readiness">
          <h5>📊 Organizational Change Readiness</h5>
          ${buildChangeReadiness()}
        </div>
      ` : ''}

      <!-- Resistance Risks -->
      ${risks.length ? `
        <div class="stakeholder-subsection resistance-risks">
          <h5>⚠️ Resistance Risk Analysis</h5>
          ${buildResistanceRisks()}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * BANKING ENHANCEMENT - Data Migration & Analytics Strategy
 * Builds the Data Migration Strategy section
 * Shows migration complexity, data quality, analytics roadmap, governance, and privacy/security
 * @param {Object} dataMigrationStrategy - Data migration analysis from AI
 * @returns {string} HTML string for the data migration section
 */
export function buildDataMigrationStrategy(dataMigrationStrategy) {
  if (!dataMigrationStrategy) return '';

  const migration = dataMigrationStrategy.migrationComplexity || {};
  const quality = dataMigrationStrategy.dataQuality || {};
  const analytics = dataMigrationStrategy.analyticsRoadmap || {};
  const governance = dataMigrationStrategy.dataGovernance || {};
  const privacy = dataMigrationStrategy.privacySecurity || {};

  // Helper function to build migration complexity visualization
  const buildMigrationComplexity = () => {
    if (!migration.complexityLevel) return '<p class="no-data">No migration complexity data available</p>';

    const complexityColors = {
      low: '#50AF7B',
      medium: '#EE9E20',
      high: '#BA3930',
      critical: '#DA291C'
    };
    const complexityColor = complexityColors[migration.complexityLevel] || '#666666';

    return `
      <div class="migration-complexity-card">
        <div class="complexity-header">
          <span class="complexity-badge" style="background-color: ${complexityColor};">
            ${DOMPurify.sanitize(migration.complexityLevel || 'unknown').toUpperCase()} COMPLEXITY
          </span>
          ${migration.volumeEstimate ? `
            <span class="volume-estimate">${DOMPurify.sanitize(migration.volumeEstimate)}</span>
          ` : ''}
        </div>

        ${migration.systemsInvolved && migration.systemsInvolved.length ? `
          <div class="systems-involved">
            <h6>Systems Involved</h6>
            <div class="systems-grid">
              ${migration.systemsInvolved.map(sys => `
                <div class="system-chip">${DOMPurify.sanitize(sys)}</div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${migration.estimatedDuration ? `
          <div class="migration-duration">
            <strong>Estimated Duration:</strong> ${DOMPurify.sanitize(migration.estimatedDuration)}
          </div>
        ` : ''}

        ${migration.technicalChallenges && migration.technicalChallenges.length ? `
          <div class="technical-challenges">
            <h6>Technical Challenges</h6>
            <ul>
              ${migration.technicalChallenges.map(challenge => `
                <li>${DOMPurify.sanitize(challenge)}</li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Helper function to build data quality assessment
  const buildDataQuality = () => {
    if (quality.currentQualityScore === undefined && !quality.qualityIssues?.length) {
      return '<p class="no-data">No data quality assessment available</p>';
    }

    const score = quality.currentQualityScore || 0;
    const scoreColor = score >= 80 ? '#50AF7B' : score >= 60 ? '#EE9E20' : '#BA3930';
    const scoreLabel = score >= 80 ? 'Good Quality' : score >= 60 ? 'Needs Improvement' : 'Poor Quality';

    return `
      <div class="data-quality-card">
        ${score !== undefined ? `
          <div class="quality-score-gauge">
            <div class="gauge-container">
              <div class="gauge-bar" style="width: ${score}%; background-color: ${scoreColor};"></div>
            </div>
            <div class="gauge-label">
              <span class="score-value">${score}/100</span>
              <span class="score-label">${scoreLabel}</span>
            </div>
          </div>
        ` : ''}

        ${quality.qualityIssues && quality.qualityIssues.length ? `
          <div class="quality-issues">
            <h6>Quality Issues</h6>
            ${quality.qualityIssues.map(issue => {
              const severityColors = {
                critical: '#DA291C',
                high: '#BA3930',
                medium: '#EE9E20',
                low: '#50AF7B'
              };
              const severityColor = severityColors[issue.severity] || '#666666';

              return `
                <div class="quality-issue">
                  <div class="issue-header">
                    <span class="issue-description">${DOMPurify.sanitize(issue.issue)}</span>
                    <span class="severity-badge" style="background-color: ${severityColor};">
                      ${DOMPurify.sanitize(issue.severity || 'medium').toUpperCase()}
                    </span>
                  </div>
                  ${issue.remediation ? `
                    <div class="issue-remediation">
                      <strong>Remediation:</strong> ${DOMPurify.sanitize(issue.remediation)}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${quality.cleansingStrategy ? `
          <div class="cleansing-strategy">
            <h6>Cleansing Strategy</h6>
            <p>${DOMPurify.sanitize(quality.cleansingStrategy)}</p>
          </div>
        ` : ''}

        ${quality.validationRules && quality.validationRules.length ? `
          <div class="validation-rules">
            <h6>Validation Rules</h6>
            <ul>
              ${quality.validationRules.map(rule => `
                <li>${DOMPurify.sanitize(rule)}</li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Helper function to build analytics roadmap
  const buildAnalyticsRoadmap = () => {
    if (!analytics.currentMaturity && !analytics.phases?.length) {
      return '<p class="no-data">No analytics roadmap available</p>';
    }

    const maturityLevels = {
      descriptive: { order: 1, label: 'Descriptive', color: '#6B7280' },
      diagnostic: { order: 2, label: 'Diagnostic', color: '#4A9D6F' },
      predictive: { order: 3, label: 'Predictive', color: '#50AF7B' },
      prescriptive: { order: 4, label: 'Prescriptive', color: '#2D6A4F' }
    };

    const currentLevel = maturityLevels[analytics.currentMaturity] || {};
    const targetLevel = maturityLevels[analytics.targetMaturity] || {};

    return `
      <div class="analytics-roadmap-card">
        ${analytics.currentMaturity || analytics.targetMaturity ? `
          <div class="maturity-progression">
            <div class="maturity-labels">
              <div class="maturity-item">
                <span class="maturity-label">Current:</span>
                <span class="maturity-value" style="color: ${currentLevel.color};">
                  ${DOMPurify.sanitize(currentLevel.label || 'Unknown')}
                </span>
              </div>
              ${analytics.targetMaturity ? `
                <div class="maturity-arrow">→</div>
                <div class="maturity-item">
                  <span class="maturity-label">Target:</span>
                  <span class="maturity-value" style="color: ${targetLevel.color};">
                    ${DOMPurify.sanitize(targetLevel.label || 'Unknown')}
                  </span>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        ${analytics.phases && analytics.phases.length ? `
          <div class="analytics-phases">
            <h6>Implementation Phases</h6>
            ${analytics.phases.map((phase, idx) => `
              <div class="analytics-phase">
                <div class="phase-header">
                  <span class="phase-number">${idx + 1}</span>
                  <div class="phase-title-group">
                    <h6>${DOMPurify.sanitize(phase.phase)}</h6>
                    ${phase.timeline ? `
                      <span class="phase-timeline">${DOMPurify.sanitize(phase.timeline)}</span>
                    ` : ''}
                  </div>
                </div>

                ${phase.capabilities && phase.capabilities.length ? `
                  <div class="phase-capabilities">
                    <strong>Capabilities:</strong>
                    <ul>
                      ${phase.capabilities.map(cap => `
                        <li>${DOMPurify.sanitize(cap)}</li>
                      `).join('')}
                    </ul>
                  </div>
                ` : ''}

                ${phase.prerequisites && phase.prerequisites.length ? `
                  <div class="phase-prerequisites">
                    <strong>Prerequisites:</strong>
                    <ul>
                      ${phase.prerequisites.map(prereq => `
                        <li>${DOMPurify.sanitize(prereq)}</li>
                      `).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  };

  // Helper function to build data governance framework
  const buildDataGovernance = () => {
    if (!governance.ownershipModel && !governance.dataClassification?.length) {
      return '<p class="no-data">No data governance framework available</p>';
    }

    return `
      <div class="data-governance-card">
        ${governance.ownershipModel ? `
          <div class="ownership-model">
            <h6>Ownership Model</h6>
            <p>${DOMPurify.sanitize(governance.ownershipModel)}</p>
          </div>
        ` : ''}

        ${governance.dataClassification && governance.dataClassification.length ? `
          <div class="data-classification">
            <h6>Data Classification</h6>
            ${governance.dataClassification.map(item => {
              const classColors = {
                public: '#50AF7B',
                internal: '#4A9D6F',
                confidential: '#EE9E20',
                restricted: '#DA291C'
              };
              const classColor = classColors[item.classification] || '#666666';

              return `
                <div class="classification-item">
                  <div class="classification-header">
                    <span class="data-type">${DOMPurify.sanitize(item.dataType)}</span>
                    <span class="classification-badge" style="background-color: ${classColor};">
                      ${DOMPurify.sanitize(item.classification || 'unknown').toUpperCase()}
                    </span>
                  </div>
                  ${item.handlingRequirements ? `
                    <div class="handling-requirements">
                      ${DOMPurify.sanitize(item.handlingRequirements)}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${governance.retentionPolicies && governance.retentionPolicies.length ? `
          <div class="retention-policies">
            <h6>Retention Policies</h6>
            <ul>
              ${governance.retentionPolicies.map(policy => `
                <li>${DOMPurify.sanitize(policy)}</li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${governance.qualityMetrics && governance.qualityMetrics.length ? `
          <div class="quality-metrics">
            <h6>Quality Metrics</h6>
            <div class="metrics-grid">
              ${governance.qualityMetrics.map(metric => `
                <div class="metric-item">${DOMPurify.sanitize(metric)}</div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${governance.auditRequirements ? `
          <div class="audit-requirements">
            <h6>Audit Requirements</h6>
            <p>${DOMPurify.sanitize(governance.auditRequirements)}</p>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Helper function to build privacy & security controls
  const buildPrivacySecurity = () => {
    if (!privacy.complianceRequirements?.length && !privacy.encryptionStrategy) {
      return '<p class="no-data">No privacy & security controls available</p>';
    }

    return `
      <div class="privacy-security-card">
        ${privacy.complianceRequirements && privacy.complianceRequirements.length ? `
          <div class="compliance-requirements">
            <h6>Compliance Requirements</h6>
            <div class="requirements-grid">
              ${privacy.complianceRequirements.map(req => `
                <div class="requirement-chip">${DOMPurify.sanitize(req)}</div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${privacy.encryptionStrategy ? `
          <div class="encryption-strategy">
            <h6>Encryption Strategy</h6>
            <p>${DOMPurify.sanitize(privacy.encryptionStrategy)}</p>
          </div>
        ` : ''}

        ${privacy.accessControls ? `
          <div class="access-controls">
            <h6>Access Controls</h6>
            <p>${DOMPurify.sanitize(privacy.accessControls)}</p>
          </div>
        ` : ''}

        ${privacy.dataLineage ? `
          <div class="data-lineage">
            <h6>Data Lineage & Tracking</h6>
            <p>${DOMPurify.sanitize(privacy.dataLineage)}</p>
          </div>
        ` : ''}

        ${privacy.incidentResponse ? `
          <div class="incident-response">
            <h6>Incident Response</h6>
            <p>${DOMPurify.sanitize(privacy.incidentResponse)}</p>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Main section HTML
  return `
    <div class="analysis-section data-migration-section">
      <h4>💾 Data Migration & Analytics Strategy</h4>

      <!-- Migration Complexity -->
      ${migration.complexityLevel || migration.volumeEstimate ? `
        <div class="data-subsection migration-complexity">
          <h5>🔄 Migration Complexity Assessment</h5>
          ${buildMigrationComplexity()}
        </div>
      ` : ''}

      <!-- Data Quality -->
      ${quality.currentQualityScore !== undefined || quality.qualityIssues?.length ? `
        <div class="data-subsection data-quality">
          <h5>📊 Data Quality Analysis</h5>
          ${buildDataQuality()}
        </div>
      ` : ''}

      <!-- Analytics Roadmap -->
      ${analytics.currentMaturity || analytics.phases?.length ? `
        <div class="data-subsection analytics-roadmap">
          <h5>📈 Analytics Maturity Roadmap</h5>
          ${buildAnalyticsRoadmap()}
        </div>
      ` : ''}

      <!-- Data Governance -->
      ${governance.ownershipModel || governance.dataClassification?.length ? `
        <div class="data-subsection data-governance">
          <h5>⚖️ Data Governance Framework</h5>
          ${buildDataGovernance()}
        </div>
      ` : ''}

      <!-- Privacy & Security -->
      ${privacy.complianceRequirements?.length || privacy.encryptionStrategy ? `
        <div class="data-subsection privacy-security">
          <h5>🔒 Privacy & Security Controls</h5>
          ${buildPrivacySecurity()}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * BANKING ENHANCEMENT: Success Metrics & KPI Framework
 * Builds the success metrics and KPI framework section for banking task analysis.
 * Displays North Star Metric, business metrics, leading indicators, KPI dashboard, and continuous improvement.
 * @param {Object} successMetrics - The success metrics data structure
 * @returns {string} HTML string for the success metrics section
 */
export function buildSuccessMetrics(successMetrics) {
  if (!successMetrics) return '';

  const northStar = successMetrics.northStarMetric || {};
  const businessMetrics = successMetrics.businessMetrics || {};
  const leadingIndicators = successMetrics.leadingIndicators || [];
  const kpiDashboard = successMetrics.kpiDashboard || [];
  const continuousImprovement = successMetrics.continuousImprovement || {};

  // Helper function to build North Star Metric visualization
  const buildNorthStarMetric = () => {
    if (!northStar.metric) return '';

    const frequencyIcons = {
      daily: '📅',
      weekly: '📊',
      monthly: '📈',
      quarterly: '🎯'
    };

    const frequencyIcon = frequencyIcons[northStar.measurementFrequency] || '📊';

    return `
      <div class="north-star-metric-card">
        <div class="north-star-header">
          <div class="north-star-icon">⭐</div>
          <div class="north-star-title">
            <h5>North Star Metric</h5>
            <p class="north-star-metric-name">${DOMPurify.sanitize(northStar.metric)}</p>
          </div>
        </div>

        <div class="north-star-body">
          <div class="metric-definition">
            <span class="metric-label">Definition:</span>
            <span class="metric-value">${DOMPurify.sanitize(northStar.definition || 'Not specified')}</span>
          </div>

          <div class="metric-comparison">
            <div class="metric-baseline">
              <span class="comparison-label">Current Baseline</span>
              <span class="comparison-value baseline">${DOMPurify.sanitize(northStar.currentBaseline || 'N/A')}</span>
            </div>
            <div class="metric-arrow">→</div>
            <div class="metric-target">
              <span class="comparison-label">Target</span>
              <span class="comparison-value target">${DOMPurify.sanitize(northStar.targetValue || 'N/A')}</span>
            </div>
          </div>

          ${northStar.measurementFrequency ? `
            <div class="metric-frequency">
              <span class="frequency-icon">${frequencyIcon}</span>
              <span class="frequency-text">Measured ${DOMPurify.sanitize(northStar.measurementFrequency)}</span>
            </div>
          ` : ''}

          ${northStar.rationale ? `
            <div class="metric-rationale">
              <span class="rationale-label">Why This Matters:</span>
              <p class="rationale-text">${DOMPurify.sanitize(northStar.rationale)}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  };

  // Helper function to build business metrics (4 categories)
  const buildBusinessMetrics = () => {
    const revenueMetrics = businessMetrics.revenueMetrics || [];
    const costMetrics = businessMetrics.costMetrics || [];
    const experienceMetrics = businessMetrics.experienceMetrics || [];
    const riskMetrics = businessMetrics.riskMetrics || [];

    if (revenueMetrics.length === 0 && costMetrics.length === 0 &&
        experienceMetrics.length === 0 && riskMetrics.length === 0) {
      return '';
    }

    const buildMetricCard = (metric, icon, categoryColor) => {
      return `
        <div class="business-metric-card" style="border-left: 3px solid ${categoryColor};">
          <div class="metric-card-header">
            <span class="metric-icon">${icon}</span>
            <span class="metric-name">${DOMPurify.sanitize(metric.name)}</span>
          </div>
          <div class="metric-card-body">
            <div class="metric-comparison-row">
              <div class="metric-baseline-col">
                <span class="metric-mini-label">Baseline</span>
                <span class="metric-mini-value">${DOMPurify.sanitize(metric.baseline || 'N/A')}</span>
              </div>
              <div class="metric-target-col">
                <span class="metric-mini-label">Target</span>
                <span class="metric-mini-value">${DOMPurify.sanitize(metric.target || 'N/A')}</span>
              </div>
            </div>
            ${metric.timeframe ? `
              <div class="metric-timeframe">
                <span class="timeframe-label">⏱️ Timeframe:</span> ${DOMPurify.sanitize(metric.timeframe)}
              </div>
            ` : ''}
            ${metric.trackingMethod ? `
              <div class="metric-tracking">
                <span class="tracking-label">📊 Tracking:</span> ${DOMPurify.sanitize(metric.trackingMethod)}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    };

    return `
      <div class="business-metrics-section">
        <h5 class="business-metrics-title">📊 Business Outcome Metrics</h5>
        <div class="business-metrics-grid">
          ${revenueMetrics.length > 0 ? `
            <div class="metric-category revenue-category">
              <h6 class="category-title">💰 Revenue Impact</h6>
              <div class="metrics-list">
                ${revenueMetrics.map(m => buildMetricCard(m, '💰', '#50AF7B')).join('')}
              </div>
            </div>
          ` : ''}

          ${costMetrics.length > 0 ? `
            <div class="metric-category cost-category">
              <h6 class="category-title">💵 Cost Reduction</h6>
              <div class="metrics-list">
                ${costMetrics.map(m => buildMetricCard(m, '💵', '#4A9D6F')).join('')}
              </div>
            </div>
          ` : ''}

          ${experienceMetrics.length > 0 ? `
            <div class="metric-category experience-category">
              <h6 class="category-title">⭐ Customer Experience</h6>
              <div class="metrics-list">
                ${experienceMetrics.map(m => buildMetricCard(m, '⭐', '#1a3a52')).join('')}
              </div>
            </div>
          ` : ''}

          ${riskMetrics.length > 0 ? `
            <div class="metric-category risk-category">
              <h6 class="category-title">🛡️ Risk Mitigation</h6>
              <div class="metrics-list">
                ${riskMetrics.map(m => buildMetricCard(m, '🛡️', '#BA3930')).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  };

  // Helper function to build leading indicators
  const buildLeadingIndicators = () => {
    if (leadingIndicators.length === 0) return '';

    const frequencyColors = {
      daily: '#50AF7B',
      weekly: '#4A9D6F',
      monthly: '#1a3a52'
    };

    return `
      <div class="leading-indicators-section">
        <h5 class="leading-indicators-title">🎯 Leading Indicators (Early Warning System)</h5>
        <div class="leading-indicators-grid">
          ${leadingIndicators.map(indicator => {
            const color = frequencyColors[indicator.monitoringFrequency] || '#4A9D6F';
            return `
              <div class="leading-indicator-card">
                <div class="indicator-header">
                  <span class="indicator-name">${DOMPurify.sanitize(indicator.indicator)}</span>
                  ${indicator.monitoringFrequency ? `
                    <span class="indicator-frequency" style="background-color: ${color};">
                      ${DOMPurify.sanitize(indicator.monitoringFrequency)}
                    </span>
                  ` : ''}
                </div>

                ${indicator.predictedOutcome ? `
                  <div class="indicator-outcome">
                    <span class="outcome-label">📊 Predicts:</span>
                    <span class="outcome-text">${DOMPurify.sanitize(indicator.predictedOutcome)}</span>
                  </div>
                ` : ''}

                ${indicator.thresholdAlert ? `
                  <div class="indicator-threshold">
                    <span class="threshold-label">⚠️ Alert Threshold:</span>
                    <span class="threshold-text">${DOMPurify.sanitize(indicator.thresholdAlert)}</span>
                  </div>
                ` : ''}

                ${indicator.actionTrigger ? `
                  <div class="indicator-action">
                    <span class="action-label">🎬 Action:</span>
                    <span class="action-text">${DOMPurify.sanitize(indicator.actionTrigger)}</span>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  // Helper function to build KPI dashboard
  const buildKPIDashboard = () => {
    if (kpiDashboard.length === 0) return '';

    const statusColors = {
      green: '#50AF7B',
      yellow: '#EE9E20',
      red: '#DA291C'
    };

    const trendIcons = {
      improving: '📈',
      declining: '📉',
      stable: '➡️',
      new: '🆕'
    };

    const categoryIcons = {
      revenue: '💰',
      cost: '💵',
      experience: '⭐',
      risk: '🛡️',
      operational: '⚙️'
    };

    return `
      <div class="kpi-dashboard-section">
        <h5 class="kpi-dashboard-title">📊 Executive KPI Dashboard</h5>
        <div class="kpi-dashboard-table">
          <div class="kpi-table-header">
            <div class="kpi-col kpi-name-col">KPI</div>
            <div class="kpi-col kpi-current-col">Current</div>
            <div class="kpi-col kpi-target-col">Target</div>
            <div class="kpi-col kpi-trend-col">Trend</div>
            <div class="kpi-col kpi-status-col">Status</div>
            <div class="kpi-col kpi-owner-col">Owner</div>
          </div>

          ${kpiDashboard.map(kpi => {
            const statusColor = statusColors[kpi.statusIndicator] || '#666666';
            const trendIcon = trendIcons[kpi.trend] || '➡️';
            const categoryIcon = categoryIcons[kpi.category] || '📊';

            return `
              <div class="kpi-table-row">
                <div class="kpi-col kpi-name-col">
                  <span class="kpi-category-icon">${categoryIcon}</span>
                  <span class="kpi-name-text">${DOMPurify.sanitize(kpi.kpi)}</span>
                </div>
                <div class="kpi-col kpi-current-col">${DOMPurify.sanitize(kpi.currentValue || 'N/A')}</div>
                <div class="kpi-col kpi-target-col">${DOMPurify.sanitize(kpi.targetValue || 'N/A')}</div>
                <div class="kpi-col kpi-trend-col">
                  <span class="trend-indicator">${trendIcon}</span>
                  <span class="trend-text">${DOMPurify.sanitize(kpi.trend || 'stable')}</span>
                </div>
                <div class="kpi-col kpi-status-col">
                  <span class="status-dot" style="background-color: ${statusColor};"></span>
                  <span class="status-text">${DOMPurify.sanitize(kpi.statusIndicator || 'yellow')}</span>
                </div>
                <div class="kpi-col kpi-owner-col">
                  ${kpi.owner ? DOMPurify.sanitize(kpi.owner) : 'Not assigned'}
                  ${kpi.reviewCadence ? `<br><span class="review-cadence">(${DOMPurify.sanitize(kpi.reviewCadence)} review)</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  // Helper function to build continuous improvement
  const buildContinuousImprovement = () => {
    const hasContent = continuousImprovement.reviewCycle ||
                      (continuousImprovement.improvementTargets && continuousImprovement.improvementTargets.length > 0) ||
                      (continuousImprovement.optimizationOpportunities && continuousImprovement.optimizationOpportunities.length > 0) ||
                      continuousImprovement.benchmarkComparison ||
                      continuousImprovement.iterationPlan;

    if (!hasContent) return '';

    return `
      <div class="continuous-improvement-section">
        <h5 class="continuous-improvement-title">🔄 Continuous Improvement Framework</h5>

        ${continuousImprovement.reviewCycle ? `
          <div class="improvement-review-cycle">
            <span class="review-cycle-label">📅 Review Cycle:</span>
            <span class="review-cycle-text">${DOMPurify.sanitize(continuousImprovement.reviewCycle)}</span>
          </div>
        ` : ''}

        ${continuousImprovement.improvementTargets && continuousImprovement.improvementTargets.length > 0 ? `
          <div class="improvement-targets">
            <h6 class="improvement-subtitle">🎯 Improvement Targets</h6>
            <ul class="improvement-list">
              ${continuousImprovement.improvementTargets.map(target => `
                <li class="improvement-item">${DOMPurify.sanitize(target)}</li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${continuousImprovement.optimizationOpportunities && continuousImprovement.optimizationOpportunities.length > 0 ? `
          <div class="optimization-opportunities">
            <h6 class="improvement-subtitle">💡 Quick Win Opportunities</h6>
            <ul class="optimization-list">
              ${continuousImprovement.optimizationOpportunities.map(opportunity => `
                <li class="optimization-item">${DOMPurify.sanitize(opportunity)}</li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${continuousImprovement.benchmarkComparison ? `
          <div class="benchmark-comparison">
            <h6 class="improvement-subtitle">📊 Industry Benchmark Comparison</h6>
            <p class="benchmark-text">${DOMPurify.sanitize(continuousImprovement.benchmarkComparison)}</p>
          </div>
        ` : ''}

        ${continuousImprovement.iterationPlan ? `
          <div class="iteration-plan">
            <h6 class="improvement-subtitle">🗺️ Metrics Evolution Plan</h6>
            <p class="iteration-text">${DOMPurify.sanitize(continuousImprovement.iterationPlan)}</p>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Build main section HTML
  return `
    <div class="analysis-section success-metrics-section">
      <h4>🎯 Success Metrics & KPI Framework</h4>

      ${buildNorthStarMetric()}
      ${buildBusinessMetrics()}
      ${buildLeadingIndicators()}
      ${buildKPIDashboard()}
      ${buildContinuousImprovement()}
    </div>
  `;
}

/**
 * Builds the HTML legend element for the Gantt chart.
 * Creates a visual legend showing color-coded categories and their meanings.
 * @param {Array<Object>} legendData - Array of legend items
 * @param {string} legendData[].color - Color identifier for the legend item
 * @param {string} legendData[].label - Text label for the legend item
 * @returns {HTMLElement} The constructed legend DOM element
 */
export function buildLegend(legendData) {
  const legendContainer = document.createElement('div');
  legendContainer.className = 'gantt-legend';

  const title = document.createElement('h3');
  title.className = 'legend-title';
  title.textContent = 'Legend';
  legendContainer.appendChild(title);

  const list = document.createElement('div');
  list.className = 'legend-list';

  for (const item of legendData) {
    const itemEl = document.createElement('div');
    itemEl.className = 'legend-item';

    const colorBox = document.createElement('div');
    colorBox.className = 'legend-color-box';
    colorBox.setAttribute('data-color', item.color);

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = item.label;

    itemEl.appendChild(colorBox);
    itemEl.appendChild(label);
    list.appendChild(itemEl);
  }

  legendContainer.appendChild(list);
  return legendContainer;
}

/**
 * SVG LOADING
 */

/**
 * Loads horizontal SVG graphics for the chart decorations.
 * These SVGs are used for the footer stripe pattern.
 * @async
 * @returns {Promise<string>} The SVG content as a string
 */
export async function loadFooterSVG() {
  try {
    const footerResponse = await fetch('/horizontal-stripe.svg');
    const svg = await footerResponse.text();
    console.log('SVG graphics loaded successfully');
    return svg;
  } catch (error) {
    console.error('Error loading SVG graphics:', error);
    return '';
  }
}

/**
 * PERFORMANCE MONITORING
 * Utilities for measuring and tracking performance metrics
 */

/**
 * Performance timer class for measuring operation duration
 * Usage:
 *   const timer = new PerformanceTimer('Chart Render');
 *   // ... do work ...
 *   timer.end(); // Logs: "✓ Chart Render completed in 150ms"
 */
export class PerformanceTimer {
  constructor(operationName) {
    this.operationName = operationName;
    this.startTime = performance.now();
    this.marks = [];
  }

  /**
   * Adds an intermediate timing mark
   * @param {string} label - Label for this mark
   */
  mark(label) {
    const elapsed = Math.round(performance.now() - this.startTime);
    this.marks.push({ label, elapsed });
    console.log(`  ⏱ ${this.operationName} - ${label}: ${elapsed}ms`);
  }

  /**
   * Ends the timer and logs the total duration
   * @returns {number} Total duration in milliseconds
   */
  end() {
    const duration = Math.round(performance.now() - this.startTime);
    console.log(`✓ ${this.operationName} completed in ${duration}ms`);
    return duration;
  }

  /**
   * Gets all timing marks
   * @returns {Array} Array of timing marks
   */
  getMarks() {
    return this.marks;
  }
}

/**
 * Simple performance wrapper for async functions
 * @param {string} label - Operation label
 * @param {Function} fn - Async function to measure
 * @returns {Promise<*>} Result of the function
 */
export async function measureAsync(label, fn) {
  const timer = new PerformanceTimer(label);
  try {
    const result = await fn();
    timer.end();
    return result;
  } catch (error) {
    timer.end();
    throw error;
  }
}

/**
 * Simple performance wrapper for sync functions
 * @param {string} label - Operation label
 * @param {Function} fn - Function to measure
 * @returns {*} Result of the function
 */
export function measureSync(label, fn) {
  const timer = new PerformanceTimer(label);
  try {
    const result = fn();
    timer.end();
    return result;
  } catch (error) {
    timer.end();
    throw error;
  }
}

/**
 * Debounces a function call
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttles a function call
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Measures the performance of DOM operations
 * Useful for measuring reflows and repaints
 * @param {string} label - Operation label
 * @param {Function} fn - Function that performs DOM operations
 * @returns {*} Result of the function
 */
export function measureDOM(label, fn) {
  // Mark the start
  const startMark = `${label}-start`;
  const endMark = `${label}-end`;
  const measureName = label;

  performance.mark(startMark);

  try {
    const result = fn();

    performance.mark(endMark);
    performance.measure(measureName, startMark, endMark);

    const measure = performance.getEntriesByName(measureName)[0];
    console.log(`✓ DOM Operation: ${label} completed in ${Math.round(measure.duration)}ms`);

    // Clean up marks
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);

    return result;
  } catch (error) {
    performance.mark(endMark);
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    throw error;
  }
}

/**
 * Gets current memory usage (if available)
 * Note: Only works in browsers that support performance.memory (Chrome)
 * @returns {Object|null} Memory usage info or null if not supported
 */
export function getMemoryUsage() {
  if (performance.memory) {
    return {
      usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
      totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
      jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
    };
  }
  return null;
}

/**
 * Logs performance metrics summary
 * @param {string} context - Context label (e.g., "Chart Render")
 */
export function logPerformanceMetrics(context = '') {
  const memory = getMemoryUsage();
  const prefix = context ? `[${context}] ` : '';

  console.group(`${prefix}Performance Metrics`);

  if (memory) {
    console.log(`Memory Usage: ${memory.usedJSHeapSize}MB / ${memory.totalJSHeapSize}MB (Limit: ${memory.jsHeapSizeLimit}MB)`);
  }

  // Get navigation timing if available
  if (performance.timing) {
    const timing = performance.timing;
    const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
    const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;

    if (pageLoadTime > 0) {
      console.log(`Page Load Time: ${pageLoadTime}ms`);
    }
    if (domReadyTime > 0) {
      console.log(`DOM Ready Time: ${domReadyTime}ms`);
    }
  }

  console.groupEnd();
}

/**
 * ANALYTICS TRACKING
 * FEATURE #9: Track user events for analytics and ROI demonstration
 */

/**
 * Tracks an analytics event by sending it to the backend
 * @param {string} eventType - Type of event (export_png, feature_executive_view, etc.)
 * @param {Object} eventData - Additional event data
 * @param {string|null} chartId - Optional chart ID
 * @param {string|null} sessionId - Optional session ID
 * @returns {Promise<void>}
 */
export async function trackEvent(eventType, eventData = {}, chartId = null, sessionId = null) {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const currentChartId = chartId || urlParams.get('id');
    const currentSessionId = sessionId || sessionStorage.getItem('sessionId');

    const response = await fetch('/track-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventType,
        eventData,
        chartId: currentChartId,
        sessionId: currentSessionId
      })
    });

    if (!response.ok) {
      console.warn(`Analytics tracking failed: ${response.statusText}`);
    }
  } catch (error) {
    // Silently fail - analytics should not break user experience
    console.warn('Analytics tracking error:', error.message);
  }
}
