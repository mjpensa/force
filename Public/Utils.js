import { CONFIG } from './config.js';

/**
 * Fetch JSON with standardized error handling
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || data.message || `Server error: ${response.status}`);
  }
  return response.json();
}

/**
 * Create a button element with the given configuration
 * @param {Object} config - Button configuration
 * @param {string} config.id - Button ID
 * @param {string} config.className - CSS class name
 * @param {string} config.text - Button text content
 * @param {string} [config.title] - Tooltip text
 * @param {string} [config.ariaLabel] - Accessibility label
 * @param {Object} [config.style] - Inline styles
 * @param {Object} [config.attributes] - Additional attributes
 * @returns {HTMLButtonElement}
 */
export function createButton(config) {
  const btn = document.createElement('button');
  if (config.id) btn.id = config.id;
  if (config.className) btn.className = config.className;
  if (config.text) btn.textContent = config.text;
  if (config.title) btn.title = config.title;
  if (config.ariaLabel) btn.setAttribute('aria-label', config.ariaLabel);
  if (config.style) {
    Object.assign(btn.style, config.style);
  }
  if (config.attributes) {
    Object.entries(config.attributes).forEach(([key, value]) => {
      btn.setAttribute(key, value);
    });
  }
  return btn;
}

/**
 * Create a modal dialog with standard structure and close behavior
 * @param {Object} config - Modal configuration
 * @param {string} [config.id] - Modal overlay ID
 * @param {string} [config.title] - Modal title text
 * @param {string} [config.content] - Initial body content HTML
 * @param {string} [config.bodyId] - ID for the modal body element
 * @param {Array} [config.actions] - Header action buttons [{id, label, title, className}]
 * @param {boolean} [config.showSpinner] - Show loading spinner initially
 * @returns {{overlay: HTMLElement, body: HTMLElement, close: Function}}
 */
export function createModal(config = {}) {
  const {
    id = 'modal-overlay',
    title = '',
    content = '',
    bodyId = 'modal-body-content',
    actions = [],
    showSpinner = false
  } = config;

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'modal-overlay';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  const actionsHtml = actions.map(action =>
    `<button class="${action.className || 'modal-action-btn'}" id="${action.id}" title="${action.title || ''}">${action.label}</button>`
  ).join('');

  const bodyContent = showSpinner ? '<div class="modal-spinner"></div>' : content;

  modalContent.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <div class="modal-actions">
        ${actionsHtml}
        <button class="modal-close" id="${id}-close-btn">&times;</button>
      </div>
    </div>
    <div class="modal-body" id="${bodyId}">${bodyContent}</div>
  `;

  overlay.appendChild(modalContent);

  const close = () => overlay.remove();

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Close on close button click
  const closeBtn = modalContent.querySelector(`#${id}-close-btn`);
  closeBtn?.addEventListener('click', close);

  document.body.appendChild(overlay);

  return {
    overlay,
    body: modalContent.querySelector(`#${bodyId}`),
    close
  };
}

export function safeGetElement(id, context = '') {
  const element = document.getElementById(id);
  if (!element) {
  }
  return element;
}
export function safeQuerySelector(selector, context = '') {
  const element = document.querySelector(selector);
  if (!element) {
  }
  return element;
}
export function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false; // Invalid URL
  }
}
export function getWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
export function findTodayColumnPosition(today, timeColumns) {
  if (timeColumns.length === 0) return null;
  const firstCol = timeColumns[0];
  const todayYear = today.getFullYear();
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
export function buildAnalysisSection(title, content) {
  if (!content) return '';
  const safeTitle = DOMPurify.sanitize(title);
  const safeContent = DOMPurify.sanitize(content);
  return `
    <div class="analysis-section">
      <h4>${safeTitle}</h4>
      <p>${safeContent}</p>
    </div>
  `;
}
export function buildAnalysisList(title, items, itemKey, sourceKey) {
  if (!items || items.length === 0) return '';
  const listItems = items.map(item => {
    const itemText = DOMPurify.sanitize(item[itemKey] || '');
    let sourceText = DOMPurify.sanitize(item[sourceKey] || 'Source not available');
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
export function buildTimelineScenarios(timelineScenarios) {
  if (!timelineScenarios) return '';
  const { expected, bestCase, worstCase, likelyDelayFactors } = timelineScenarios;
  let scenariosHTML = '';
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
export function buildProgressIndicators(progress, taskStatus) {
  if (!progress || taskStatus !== 'in-progress') return '';
  let contentHTML = '';
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
export function buildAccelerators(accelerators) {
  if (!accelerators) return '';
  let contentHTML = '';
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
export async function loadFooterSVG() {
  try {
    const footerResponse = await fetch('/horizontal-stripe.svg');
    const svg = await footerResponse.text();
    return svg;
  } catch (error) {
    return '';
  }
}
export class PerformanceTimer {
  constructor(operationName) {
    this.operationName = operationName;
    this.startTime = performance.now();
    this.marks = [];
  }
  mark(label) {
    const elapsed = Math.round(performance.now() - this.startTime);
    this.marks.push({ label, elapsed });
  }
  end() {
    const duration = Math.round(performance.now() - this.startTime);
    return duration;
  }
  getMarks() {
    return this.marks;
  }
}
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
