/**
 * Modern Executive Summary Document Reader
 * Clean, MS Word / Google Docs inspired interface
 * Features: Minimal toolbar, centered document, professional typography
 */

import { CONFIG } from './config.js';

/**
 * ExecutiveSummary Class
 * Manages the modern document reader for executive summary reports
 */
export class ExecutiveSummary {
  /**
   * Creates a new ExecutiveSummary instance
   * @param {Object} summaryData - The executive summary data from the API
   * @param {string} footerSVG - The SVG content for decorations (unused in modern reader)
   */
  constructor(summaryData, footerSVG) {
    this.summaryData = summaryData;
    this.footerSVG = footerSVG;
    this.container = null;

    // Debug logging
    console.log('📋 ExecutiveSummary constructor called');
    console.log('  Summary data exists:', !!summaryData);
    if (summaryData) {
      console.log('  Summary data keys:', Object.keys(summaryData));
    }
  }

  /**
   * Renders a clean document reader (like Word/Google Docs)
   * @returns {HTMLElement} The rendered document container
   */
  render() {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'executive-summary-reader';
    this.container.id = 'executiveSummary';

    // Check if summary data exists
    if (!this.summaryData) {
      this.container.innerHTML = this._buildEmptyState();
      return this.container;
    }

    // Build toolbar
    const toolbar = this._buildToolbar();
    this.container.appendChild(toolbar);

    // Build document content
    const documentContainer = this._buildDocumentContainer();
    this.container.appendChild(documentContainer);

    return this.container;
  }

  /**
   * Builds empty state when no data is available
   * @private
   * @returns {string} HTML for empty state
   */
  _buildEmptyState() {
    return `
      <div class="reader-empty-state">
        <div class="empty-state-icon">📄</div>
        <h2 class="empty-state-title">No executive summary available</h2>
        <p class="empty-state-text">Summary will appear here once generated</p>
      </div>
    `;
  }

  /**
   * Builds the minimal toolbar (like Google Docs)
   * @private
   * @returns {HTMLElement} Toolbar element
   */
  _buildToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'reader-toolbar';

    // Left side - Document title
    const leftSide = document.createElement('div');
    leftSide.className = 'toolbar-left';
    leftSide.innerHTML = `
      <div class="toolbar-title">
        <span class="toolbar-icon">📋</span>
        <span class="toolbar-text">Executive Summary</span>
      </div>
    `;

    // Right side - Actions
    const rightSide = document.createElement('div');
    rightSide.className = 'toolbar-right';

    // Print button
    const printBtn = this._createToolbarButton('🖨️', 'Print', () => this._print());

    // Export dropdown
    const exportDropdown = this._createExportDropdown();

    rightSide.appendChild(exportDropdown);
    rightSide.appendChild(printBtn);

    toolbar.appendChild(leftSide);
    toolbar.appendChild(rightSide);

    return toolbar;
  }

  /**
   * Creates a toolbar button
   * @private
   */
  _createToolbarButton(icon, text, onClick) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.innerHTML = `<span class="toolbar-btn-icon">${icon}</span><span class="toolbar-btn-text">${text}</span>`;
    btn.setAttribute('aria-label', text);
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * Creates export dropdown menu
   * @private
   */
  _createExportDropdown() {
    const container = document.createElement('div');
    container.className = 'export-dropdown';

    const button = document.createElement('button');
    button.className = 'toolbar-btn';
    button.innerHTML = `
      <span class="toolbar-btn-icon">📥</span>
      <span class="toolbar-btn-text">Export</span>
      <span class="dropdown-arrow">▼</span>
    `;
    button.setAttribute('aria-label', 'Export document');
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'export-dropdown-menu';

    const menuItems = [
      { icon: '📄', text: 'Export as PDF', action: () => this._exportToPDF() },
      { icon: '🖼️', text: 'Export as PNG', action: () => this._exportToPNG() }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('button');
      menuItem.className = 'export-dropdown-item';
      menuItem.innerHTML = `<span class="export-item-icon">${item.icon}</span><span>${item.text}</span>`;
      menuItem.addEventListener('click', () => {
        item.action();
        this._closeDropdown(container);
      });
      menu.appendChild(menuItem);
    });

    container.appendChild(button);
    container.appendChild(menu);

    // Toggle dropdown
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = container.classList.contains('open');

      // Close all other dropdowns
      document.querySelectorAll('.export-dropdown.open').forEach(dropdown => {
        if (dropdown !== container) {
          dropdown.classList.remove('open');
        }
      });

      if (isOpen) {
        container.classList.remove('open');
        button.setAttribute('aria-expanded', 'false');
      } else {
        container.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        this._closeDropdown(container);
      }
    });

    return container;
  }

  /**
   * Close dropdown menu
   * @private
   */
  _closeDropdown(container) {
    container.classList.remove('open');
    const button = container.querySelector('.toolbar-btn');
    if (button) {
      button.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Builds the document container with centered content
   * @private
   * @returns {HTMLElement} Document container
   */
  _buildDocumentContainer() {
    const container = document.createElement('div');
    container.className = 'reader-document-container';

    const documentPage = document.createElement('div');
    documentPage.className = 'reader-document-page';

    // Build document content
    const content = this._buildDocumentContent();
    documentPage.innerHTML = content;

    container.appendChild(documentPage);

    return container;
  }

  /**
   * Builds the complete document content
   * @private
   * @returns {string} Complete document HTML
   */
  _buildDocumentContent() {
    let html = '';

    // Document title
    html += '<h1 class="document-title">Executive Summary</h1>';

    // Render all sections in order
    const sections = [
      'strategicNarrative',
      'strategicPriorities',
      'drivers',
      'dependencies',
      'risks',
      'keyInsights',
      'competitiveIntelligence',
      'industryBenchmarks'
    ];

    sections.forEach(sectionName => {
      const sectionData = this.summaryData[sectionName];
      if (!sectionData) return;

      switch (sectionName) {
        case 'strategicNarrative':
          html += this._renderStrategicNarrative(sectionData);
          break;
        case 'strategicPriorities':
          html += this._renderStrategicPriorities(sectionData);
          break;
        case 'drivers':
          html += this._renderDrivers(sectionData);
          break;
        case 'dependencies':
          html += this._renderDependencies(sectionData);
          break;
        case 'risks':
          html += this._renderRisks(sectionData);
          break;
        case 'keyInsights':
          html += this._renderKeyInsights(sectionData);
          break;
        case 'competitiveIntelligence':
          html += this._renderCompetitiveIntelligence(sectionData);
          break;
        case 'industryBenchmarks':
          html += this._renderIndustryBenchmarks(sectionData);
          break;
      }
    });

    return html;
  }

  /**
   * Renders Strategic Narrative section
   * @private
   */
  _renderStrategicNarrative(data) {
    return `
      <div class="document-section">
        <p class="document-paragraph">${data.elevatorPitch || ''}</p>
        ${data.valueProposition ? `<p class="document-paragraph">${data.valueProposition}</p>` : ''}
        ${data.callToAction ? `<p class="document-paragraph document-paragraph-emphasis">${data.callToAction}</p>` : ''}
      </div>
    `;
  }

  /**
   * Renders Strategic Priorities section
   * @private
   */
  _renderStrategicPriorities(data) {
    if (!Array.isArray(data) || data.length === 0) return '';

    return `
      <div class="document-section">
        <h2 class="document-heading">Strategic Priorities</h2>
        ${data.map((priority, index) => `
          <div class="document-list-item">
            <div class="document-list-number">${index + 1}</div>
            <div class="document-list-content">
              <strong class="document-strong">${priority.title}.</strong>
              <span class="document-text">${priority.description}</span>
              ${priority.bankingContext ? `<span class="document-text"> ${priority.bankingContext}</span>` : ''}
              ${priority.dependencies ? `<span class="document-text-muted"> Dependencies: ${priority.dependencies}.</span>` : ''}
              ${priority.deadline ? `<span class="document-text-muted"> Deadline: ${priority.deadline}.</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Renders Strategic Drivers section
   * @private
   */
  _renderDrivers(data) {
    if (!Array.isArray(data) || data.length === 0) return '';

    return `
      <div class="document-section">
        <h2 class="document-heading">Strategic Drivers</h2>
        ${data.map((driver, index) => {
          const metricsText = driver.metrics && driver.metrics.length > 0
            ? ` <span class="document-metrics">Key metrics: ${driver.metrics.join(', ')}.</span>`
            : '';
          return `
            <div class="document-list-item">
              <div class="document-list-number">${index + 1}</div>
              <div class="document-list-content">
                <strong class="document-strong">${driver.title}.</strong>
                <span class="document-text">${driver.description}</span>${metricsText}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Renders Dependencies section
   * @private
   */
  _renderDependencies(data) {
    if (!Array.isArray(data) || data.length === 0) return '';

    return `
      <div class="document-section">
        <h2 class="document-heading">Critical Dependencies</h2>
        ${data.map(dep => {
          const criticalityClass = (dep.criticality || '').toLowerCase();
          const criticalityBadge = `<span class="dependency-badge dependency-badge-${criticalityClass}">${dep.criticality || 'Medium'}</span>`;
          const phasesText = dep.impactedPhases && dep.impactedPhases.length > 0
            ? ` <span class="document-text-muted">Impacts: ${dep.impactedPhases.join(', ')}.</span>`
            : '';
          const mitigationText = dep.mitigationStrategy
            ? ` <span class="document-text">Mitigation: ${dep.mitigationStrategy}</span>`
            : '';
          return `
            <div class="document-dependency-item">
              <div class="document-dependency-header">
                <strong class="document-strong">${dep.name}</strong>
                ${criticalityBadge}
              </div>
              <div class="document-dependency-content">
                ${phasesText}${mitigationText}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Renders Risks section
   * @private
   */
  _renderRisks(data) {
    if (!Array.isArray(data) || data.length === 0) return '';

    return `
      <div class="document-section">
        <h2 class="document-heading">Risk Intelligence</h2>
        ${data.map(risk => {
          const riskLevel = this._calculateRiskLevel(risk.probability, risk.impact);
          const riskBadge = `<span class="risk-badge risk-badge-${riskLevel}">${riskLevel.toUpperCase()}</span>`;
          const indicatorsText = risk.earlyIndicators && risk.earlyIndicators.length > 0
            ? ` <span class="document-text-muted">Early indicators: ${risk.earlyIndicators.join(', ')}.</span>`
            : '';
          return `
            <div class="document-risk-item">
              <div class="document-risk-header">
                <strong class="document-strong">${risk.category || 'General'} Risk</strong>
                ${riskBadge}
              </div>
              <div class="document-risk-meta">
                <span class="risk-meta-item">Probability: ${risk.probability || 'Medium'}</span>
                <span class="risk-meta-separator">•</span>
                <span class="risk-meta-item">Impact: ${risk.impact || 'Moderate'}</span>
              </div>
              <div class="document-risk-content">
                <span class="document-text">${risk.description}</span>${indicatorsText}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Calculate risk level from probability and impact
   * @private
   */
  _calculateRiskLevel(probability, impact) {
    const probLower = (probability || '').toLowerCase();
    const impactLower = (impact || '').toLowerCase();

    if ((probLower.includes('high') || probLower.includes('likely')) &&
        (impactLower.includes('high') || impactLower.includes('severe'))) {
      return 'critical';
    } else if ((probLower.includes('high') || impactLower.includes('high')) ||
               (probLower.includes('medium') && impactLower.includes('medium'))) {
      return 'high';
    } else if (probLower.includes('low') && impactLower.includes('low')) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Renders Key Insights section
   * @private
   */
  _renderKeyInsights(data) {
    if (!Array.isArray(data) || data.length === 0) return '';

    return `
      <div class="document-section">
        <h2 class="document-heading">Key Strategic Insights</h2>
        <div class="document-insights-grid">
          ${data.map((insight, index) => `
            <div class="document-insight-card">
              <div class="insight-card-number">${index + 1}</div>
              <div class="insight-card-content">
                <p class="insight-card-text">${insight.insight}</p>
                ${insight.supportingData ? `<p class="insight-card-data">${insight.supportingData}</p>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Renders Competitive Intelligence section
   * @private
   */
  _renderCompetitiveIntelligence(data) {
    if (!data) return '';

    const hasContent = data.marketTiming || data.competitorMoves ||
                       data.competitiveAdvantage || data.marketWindow;

    if (!hasContent) return '';

    return `
      <div class="document-section">
        <h2 class="document-heading">Competitive Intelligence</h2>
        <div class="document-competitive-grid">
          ${data.marketTiming ? `
            <div class="competitive-card">
              <div class="competitive-card-label">Market Timing</div>
              <div class="competitive-card-content">${data.marketTiming}</div>
            </div>
          ` : ''}
          ${data.competitorMoves && data.competitorMoves.length > 0 ? `
            <div class="competitive-card">
              <div class="competitive-card-label">Competitor Moves</div>
              <div class="competitive-card-content">${data.competitorMoves.join(' ')}</div>
            </div>
          ` : ''}
          ${data.competitiveAdvantage ? `
            <div class="competitive-card">
              <div class="competitive-card-label">Competitive Advantage</div>
              <div class="competitive-card-content">${data.competitiveAdvantage}</div>
            </div>
          ` : ''}
          ${data.marketWindow ? `
            <div class="competitive-card">
              <div class="competitive-card-label">Market Window</div>
              <div class="competitive-card-content">${data.marketWindow}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Renders Industry Benchmarks section
   * @private
   */
  _renderIndustryBenchmarks(data) {
    if (!data) return '';

    const hasContent = data.timeToMarket || data.investmentLevel || data.riskProfile;

    if (!hasContent) return '';

    return `
      <div class="document-section">
        <h2 class="document-heading">Industry Benchmarks</h2>
        <div class="document-benchmarks">
          ${data.timeToMarket ? `
            <div class="benchmark-item">
              <div class="benchmark-label">Time to Market</div>
              <div class="benchmark-comparison">
                <div class="benchmark-value">
                  <span class="benchmark-label-small">Your Plan</span>
                  <span class="benchmark-number">${data.timeToMarket.yourPlan}</span>
                </div>
                <div class="benchmark-vs">vs</div>
                <div class="benchmark-value">
                  <span class="benchmark-label-small">Industry Avg</span>
                  <span class="benchmark-number">${data.timeToMarket.industryAverage}</span>
                </div>
              </div>
              <div class="benchmark-variance">${data.timeToMarket.variance}</div>
              <div class="benchmark-insight">${data.timeToMarket.insight}</div>
            </div>
          ` : ''}
          ${data.investmentLevel ? `
            <div class="benchmark-item">
              <div class="benchmark-label">Investment Level</div>
              <div class="benchmark-comparison">
                <div class="benchmark-value">
                  <span class="benchmark-label-small">Your Plan</span>
                  <span class="benchmark-number">${data.investmentLevel.yourPlan}</span>
                </div>
                <div class="benchmark-vs">vs</div>
                <div class="benchmark-value">
                  <span class="benchmark-label-small">Industry Median</span>
                  <span class="benchmark-number">${data.investmentLevel.industryMedian}</span>
                </div>
              </div>
              <div class="benchmark-variance">${data.investmentLevel.variance}</div>
              <div class="benchmark-insight">${data.investmentLevel.insight}</div>
            </div>
          ` : ''}
          ${data.riskProfile ? `
            <div class="benchmark-item">
              <div class="benchmark-label">Risk Profile</div>
              <div class="benchmark-single">
                <div class="benchmark-value-full">
                  <span class="benchmark-label-small">Your Plan</span>
                  <span class="benchmark-text">${data.riskProfile.yourPlan}</span>
                </div>
                <div class="benchmark-value-full">
                  <span class="benchmark-label-small">Industry Comparison</span>
                  <span class="benchmark-text">${data.riskProfile.industryComparison}</span>
                </div>
              </div>
              <div class="benchmark-insight">${data.riskProfile.insight}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Print document
   * @private
   */
  _print() {
    window.print();
  }

  /**
   * Export to PDF (using browser print to PDF)
   * @private
   */
  _exportToPDF() {
    alert('Use your browser\'s Print function (Ctrl/Cmd+P) and select "Save as PDF" to export as PDF.');
    window.print();
  }

  /**
   * Export to PNG using html2canvas
   * @private
   */
  async _exportToPNG() {
    try {
      // Check if html2canvas is available
      if (typeof html2canvas === 'undefined') {
        alert('Export feature requires html2canvas library. Please check your setup.');
        return;
      }

      const documentPage = this.container.querySelector('.reader-document-page');
      if (!documentPage) {
        alert('Unable to find document content to export.');
        return;
      }

      // Capture the document
      const canvas = await html2canvas(documentPage, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `executive-summary-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(url);
      });

    } catch (error) {
      console.error('[ExecutiveSummary] PNG export failed:', error);
      alert('Failed to export as PNG. Please try again.');
    }
  }

  /**
   * Cleanup method to remove event listeners
   */
  destroy() {
    // Clean up any event listeners if needed
    console.log('[ExecutiveSummary] Cleanup complete');
  }
}
