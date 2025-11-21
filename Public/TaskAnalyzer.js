/**
 * TaskAnalyzer Module
 * Phase 3 Enhancement: Extracted from chart-renderer.js
 * Handles task analysis modal functionality
 */

import { safeGetElement, safeQuerySelector, buildAnalysisSection, buildAnalysisList, buildTimelineScenarios, buildRiskAnalysis, buildImpactAnalysis, buildSchedulingContext, buildProgressIndicators, buildAccelerators, buildFinancialImpact, buildStakeholderImpact, buildDataMigrationStrategy, buildSuccessMetrics } from './Utils.js';
import { ChatInterface } from './ChatInterface.js';

/**
 * TaskAnalyzer Class
 * Manages the analysis modal for displaying task details
 */
export class TaskAnalyzer {
  /**
   * Creates a new TaskAnalyzer instance
   */
  constructor() {
    this.modal = null;
    this.chatInterface = null;
  }

  /**
   * Shows the analysis modal for a specific task
   * @async
   * @param {Object} taskIdentifier - Task identification object
   * @param {string} taskIdentifier.taskName - Name of the task to analyze
   * @param {string} taskIdentifier.entity - Entity/organization associated with the task
   * @param {string} taskIdentifier.sessionId - Session ID for backend requests
   * @returns {Promise<void>}
   */
  async showAnalysis(taskIdentifier) {
    // Remove any old modal
    document.getElementById('analysis-modal')?.remove();

    // Create modal structure
    this._createModal();

    // Add close listeners
    this._attachCloseListeners();

    // Fetch and display analysis data
    await this._fetchAndDisplayAnalysis(taskIdentifier);
  }

  /**
   * Creates the modal structure
   * @private
   */
  _createModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'analysis-modal';
    modalOverlay.className = 'modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Analyzing...</h3>
        <div class="modal-actions">
          <button class="modal-export-btn" id="modal-export-btn" title="Export Analysis">📥</button>
          <button class="modal-close" id="modal-close-btn">&times;</button>
        </div>
      </div>
      <div class="modal-body" id="modal-body-content">
        <div class="modal-spinner"></div>
      </div>
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    this.modal = modalOverlay;
  }

  /**
   * Attaches close event listeners to the modal
   * @private
   */
  _attachCloseListeners() {
    if (!this.modal) return;

    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.modal?.remove();
      }
    });

    // Close on button click
    const closeBtn = document.getElementById('modal-close-btn');
    closeBtn?.addEventListener('click', () => {
      this.modal?.remove();
    });
  }

  /**
   * Fetches analysis data from the server and displays it
   * @async
   * @param {Object} taskIdentifier - Task identification object
   * @private
   */
  async _fetchAndDisplayAnalysis(taskIdentifier) {
    try {
      const response = await fetch('/get-task-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskIdentifier)
      });

      if (!response.ok) {
        // Handle non-JSON error responses gracefully
        let errorMessage = `Server error: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const err = await response.json();
            errorMessage = err.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text.substring(0, 200) || errorMessage;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const analysis = await response.json();
      this._displayAnalysis(analysis, taskIdentifier);

    } catch (error) {
      console.error('Error fetching analysis:', error);
      this._displayError(error.message);
    }
  }

  /**
   * Displays the analysis data in the modal
   * @param {Object} analysis - The analysis data from the server
   * @param {Object} taskIdentifier - Task identification object
   * @private
   */
  _displayAnalysis(analysis, taskIdentifier) {
    const modalBody = safeGetElement('modal-body-content', 'TaskAnalyzer._displayAnalysis');
    if (!modalBody) return;

    // Update modal title with confidence badge (Phase 3)
    const modalTitle = safeQuerySelector('.modal-title', 'TaskAnalyzer._displayAnalysis');
    if (modalTitle) {
      const confidenceBadge = this._buildConfidenceBadge(analysis.confidence);
      modalTitle.innerHTML = `${DOMPurify.sanitize(analysis.taskName)} ${confidenceBadge}`;
    }

    // Build quick facts sidebar (Phase 3)
    const quickFactsHTML = this._buildQuickFacts(analysis);

    // Build main analysis content
    // ORDER: Financial Impact, Stakeholder Impact, Data Migration Strategy, Success Metrics (Banking Enhancements), Timeline Scenarios, Risks, Impact, Scheduling Context, Progress (Phase 2), Accelerators (Phase 2), Facts, Assumptions, Summary/Rationale
    const mainContentHTML = `
      ${buildFinancialImpact(analysis.financialImpact)}
      ${buildStakeholderImpact(analysis.stakeholderImpact)}
      ${buildDataMigrationStrategy(analysis.dataMigrationStrategy)}
      ${buildSuccessMetrics(analysis.successMetrics)}
      ${buildTimelineScenarios(analysis.timelineScenarios)}
      ${buildRiskAnalysis(analysis.risks)}
      ${buildImpactAnalysis(analysis.impact)}
      ${buildSchedulingContext(analysis.schedulingContext)}
      ${buildProgressIndicators(analysis.progress, analysis.status)}
      ${buildAccelerators(analysis.accelerators)}
      ${buildAnalysisList('Facts', analysis.facts, 'fact', 'source')}
      ${buildAnalysisList('Assumptions', analysis.assumptions, 'assumption', 'source')}
      ${buildAnalysisSection('Summary', analysis.summary)}
      ${buildAnalysisSection('Rationale / Hurdles', analysis.rationale)}
    `;

    // Create two-column layout with sidebar (Phase 3)
    const analysisHTML = `
      <div class="analysis-layout">
        <aside class="analysis-sidebar">
          ${quickFactsHTML}
        </aside>
        <main class="analysis-main">
          ${mainContentHTML}
        </main>
      </div>
    `;

    modalBody.innerHTML = DOMPurify.sanitize(analysisHTML);

    // Add collapsible functionality to major sections
    this._initializeCollapsibleSections();

    // Add export button listener (Phase 3)
    this._attachExportListener(analysis);

    // Add chat interface
    this.chatInterface = new ChatInterface(modalBody, taskIdentifier);
    this.chatInterface.render();
  }

  /**
   * Attaches export button event listener (Phase 3)
   * @param {Object} analysis - The analysis data
   * @private
   */
  _attachExportListener(analysis) {
    const exportBtn = document.getElementById('modal-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this._exportAnalysis(analysis);
      });
    }
  }

  /**
   * Exports analysis as a text file (Phase 3)
   * @param {Object} analysis - The analysis data
   * @private
   */
  _exportAnalysis(analysis) {
    let content = `TASK ANALYSIS: ${analysis.taskName}\n`;
    content += `${'='.repeat(60)}\n\n`;

    // Status and dates
    content += `Status: ${analysis.status}\n`;
    content += `Timeline: ${analysis.startDate || 'N/A'} - ${analysis.endDate || 'N/A'}\n\n`;

    // Timeline Scenarios
    if (analysis.timelineScenarios) {
      content += `TIMELINE SCENARIOS\n${'─'.repeat(40)}\n`;
      if (analysis.timelineScenarios.bestCase) {
        content += `Best-Case: ${analysis.timelineScenarios.bestCase.date}\n`;
        if (analysis.timelineScenarios.bestCase.assumptions) {
          content += `  ${analysis.timelineScenarios.bestCase.assumptions}\n`;
        }
      }
      if (analysis.timelineScenarios.expected) {
        content += `Expected: ${analysis.timelineScenarios.expected.date} (${analysis.timelineScenarios.expected.confidence} confidence)\n`;
      }
      if (analysis.timelineScenarios.worstCase) {
        content += `Worst-Case: ${analysis.timelineScenarios.worstCase.date}\n`;
        if (analysis.timelineScenarios.worstCase.risks) {
          content += `  ${analysis.timelineScenarios.worstCase.risks}\n`;
        }
      }
      content += '\n';
    }

    // Risks
    if (analysis.risks && analysis.risks.length > 0) {
      content += `RISKS & ROADBLOCKS\n${'─'.repeat(40)}\n`;
      analysis.risks.forEach((risk, i) => {
        content += `${i + 1}. [${risk.severity?.toUpperCase()}] ${risk.name}\n`;
        content += `   Impact: ${risk.impact}\n`;
        content += `   Mitigation: ${risk.mitigation}\n\n`;
      });
    }

    // Impact
    if (analysis.impact) {
      content += `IMPACT ANALYSIS\n${'─'.repeat(40)}\n`;
      if (analysis.impact.downstreamTasks !== undefined) {
        content += `Downstream Tasks: ${analysis.impact.downstreamTasks}\n`;
      }
      if (analysis.impact.businessImpact) {
        content += `Business Impact: ${analysis.impact.businessImpact}\n`;
      }
      if (analysis.impact.strategicImpact) {
        content += `Strategic Impact: ${analysis.impact.strategicImpact}\n`;
      }
      content += '\n';
    }

    // Download the file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.taskName.replace(/[^a-z0-9]/gi, '_')}_analysis.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Builds confidence badge HTML for the modal header (Phase 3)
   * @param {Object} confidence - Confidence assessment data
   * @returns {string} HTML for confidence badge
   * @private
   */
  _buildConfidenceBadge(confidence) {
    if (!confidence || !confidence.level) return '';

    const level = confidence.level.toLowerCase();
    const icon = level === 'high' ? '✓' : level === 'medium' ? '◐' : '!';
    const title = confidence.rationale || `${confidence.dataQuality || ''} data quality`;

    return `<span class="confidence-badge-header confidence-${level}" title="${DOMPurify.sanitize(title)}">${icon} ${DOMPurify.sanitize(level)} confidence</span>`;
  }

  /**
   * Builds quick facts sidebar HTML (Phase 3)
   * @param {Object} analysis - The analysis data
   * @returns {string} HTML for quick facts panel
   * @private
   */
  _buildQuickFacts(analysis) {
    const statusClass = analysis.status.replace(/\s+/g, '-').toLowerCase();
    const criticalPath = analysis.schedulingContext?.isCriticalPath;
    const downstreamTasks = analysis.impact?.downstreamTasks;

    let quickFactsHTML = `
      <div class="quick-facts-panel">
        <h4>Quick Facts</h4>

        <div class="quick-fact">
          <span class="fact-label">Status</span>
          <span class="status-pill status-${statusClass}">${DOMPurify.sanitize(analysis.status)}</span>
        </div>

        <div class="quick-fact">
          <span class="fact-label">Timeline</span>
          <span class="fact-value">${DOMPurify.sanitize(analysis.startDate || 'N/A')} - ${DOMPurify.sanitize(analysis.endDate || 'N/A')}</span>
        </div>
    `;

    // Add critical path indicator
    if (criticalPath !== undefined) {
      const cpIcon = criticalPath ? '🔴' : '🟢';
      const cpText = criticalPath ? 'Critical Path' : 'Has Flexibility';
      quickFactsHTML += `
        <div class="quick-fact">
          <span class="fact-label">Path Status</span>
          <span class="fact-value">${cpIcon} ${cpText}</span>
        </div>
      `;
    }

    // Add downstream impact
    if (downstreamTasks !== undefined && downstreamTasks !== null) {
      quickFactsHTML += `
        <div class="quick-fact">
          <span class="fact-label">Downstream</span>
          <span class="fact-value impact-highlight">${downstreamTasks} task${downstreamTasks !== 1 ? 's' : ''}</span>
        </div>
      `;
    }

    // Add confidence assessment
    if (analysis.confidence) {
      const conf = analysis.confidence;
      const levelIcon = conf.level === 'high' ? '✓' : conf.level === 'medium' ? '◐' : '!';
      quickFactsHTML += `
        <div class="quick-fact">
          <span class="fact-label">Confidence</span>
          <span class="fact-value confidence-${conf.level}">${levelIcon} ${DOMPurify.sanitize(conf.level)}</span>
        </div>
        <div class="quick-fact">
          <span class="fact-label">Data Quality</span>
          <span class="fact-value">${DOMPurify.sanitize(conf.dataQuality || 'Unknown')}</span>
        </div>
      `;

      if (conf.assumptionCount !== undefined) {
        quickFactsHTML += `
          <div class="quick-fact">
            <span class="fact-label">Assumptions</span>
            <span class="fact-value">${conf.assumptionCount}</span>
          </div>
        `;
      }
    }

    // Add high-severity risks count
    if (analysis.risks && analysis.risks.length > 0) {
      const highRisks = analysis.risks.filter(r => r.severity === 'high').length;
      if (highRisks > 0) {
        quickFactsHTML += `
          <div class="quick-fact alert-fact">
            <span class="fact-label">🔴 High Risks</span>
            <span class="fact-value">${highRisks}</span>
          </div>
        `;
      }
    }

    quickFactsHTML += `</div>`;

    return quickFactsHTML;
  }

  /**
   * Initializes collapsible functionality for analysis sections
   * @private
   */
  _initializeCollapsibleSections() {
    const sections = document.querySelectorAll('.analysis-section.timeline-scenarios-section, .analysis-section.risks-section, .analysis-section.impact-section, .analysis-section.scheduling-section, .analysis-section.progress-section, .analysis-section.accelerators-section');

    sections.forEach(section => {
      const header = section.querySelector('h4');
      if (!header) return;

      // Add collapsible class and toggle icon
      section.classList.add('collapsible');
      header.classList.add('collapsible-header');
      header.innerHTML += ' <span class="collapse-toggle">▼</span>';

      // Add click handler
      header.addEventListener('click', () => {
        section.classList.toggle('collapsed');
        const toggle = header.querySelector('.collapse-toggle');
        if (toggle) {
          toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
        }
      });
    });
  }

  /**
   * Displays an error message in the modal
   * @param {string} errorMessage - The error message to display
   * @private
   */
  _displayError(errorMessage) {
    const modalBody = document.getElementById('modal-body-content');
    if (modalBody) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'modal-error';

      // Check if this is a quota/rate limit error
      const isQuotaError = errorMessage.includes('quota') ||
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('429');

      if (isQuotaError) {
        // Create a more helpful error display for quota errors
        errorDiv.innerHTML = `
          <div style="text-align: left;">
            <h3 style="color: #da291c; margin-top: 0;">⚠️ API Quota Exceeded</h3>
            <p><strong>What happened?</strong></p>
            <p>The Google Gemini API has rate limits to prevent abuse. You've reached the free tier limit.</p>

            <p><strong>What can you do?</strong></p>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Wait a few minutes</strong> and try again (the quota resets automatically)</li>
              <li><strong>Upgrade your API plan</strong> at <a href="https://ai.google.dev/pricing" target="_blank" style="color: #0066cc;">https://ai.google.dev/pricing</a></li>
              <li><strong>Check your usage</strong> at <a href="https://ai.dev/usage?tab=rate-limit" target="_blank" style="color: #0066cc;">https://ai.dev/usage</a></li>
            </ol>

            <p style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-left: 3px solid #da291c; font-size: 0.9em;">
              <strong>Technical details:</strong><br>
              ${DOMPurify.sanitize(errorMessage)}
            </p>
          </div>
        `;
      } else {
        // Regular error display
        errorDiv.textContent = `Failed to load analysis: ${errorMessage}`;
      }

      modalBody.innerHTML = '';
      modalBody.appendChild(errorDiv);
    }
  }
}
