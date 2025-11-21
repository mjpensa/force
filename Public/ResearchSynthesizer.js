/**
 * ResearchSynthesizer Component
 * Cross-LLM Research Synthesis Feature
 *
 * Implements the 8-step pipeline for transforming multi-source LLM research
 * into verified, rigorously cited insights.
 */

/**
 * Main ResearchSynthesizer class
 * Manages the entire 8-step research synthesis pipeline
 */
export class ResearchSynthesizer {
  /**
   * @param {string} containerId - ID of container element
   * @param {string|null} sessionId - Optional existing session ID with research data
   */
  constructor(containerId, sessionId = null) {
    this.containerId = containerId;
    this.sessionId = sessionId;
    this.currentStep = 0; // 0-7 (8 steps total)
    this.uploadedFiles = []; // Array of { file, provider }
    this.hasExistingResearch = !!sessionId; // Flag to indicate if we have existing research

    // Step definitions
    this.steps = [
      { id: 1, name: 'Upload Sources', status: 'active', key: 'upload' },
      { id: 2, name: 'Extract Claims', status: 'pending', key: 'extract' },
      { id: 3, name: 'View Ledger', status: 'pending', key: 'ledger' },
      { id: 4, name: 'Detect Contradictions', status: 'pending', key: 'contradictions' },
      { id: 5, name: 'Synthesize Report', status: 'pending', key: 'report' },
      { id: 6, name: 'Audit Provenance', status: 'pending', key: 'audit' },
      { id: 7, name: 'Verified Claims', status: 'pending', key: 'claims' },
      { id: 8, name: 'Dashboard', status: 'pending', key: 'dashboard' }
    ];

    // Cached data
    this.data = {
      claims: null,
      ledger: null,
      contradictions: null,
      report: null,
      audit: null,
      verifiedClaims: null,
      executiveSummary: null,
      dashboard: null
    };
  }

  /**
   * Renders the complete research synthesis interface
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error('Research synthesis container not found:', this.containerId);
      return;
    }

    // If we have existing research, show option to use it
    const existingResearchBanner = this.hasExistingResearch && this.currentStep === 0 ? `
      <div class="existing-research-banner" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">✨ Research Already Available</h3>
        <p style="margin: 0 0 1rem 0; font-size: 0.9rem;">Your uploaded research files from the roadmap are available for synthesis.</p>
        <button id="btn-use-existing-research" class="btn-primary" style="background: white; color: #667eea; margin-right: 0.5rem;">
          Use Existing Research →
        </button>
        <button id="btn-upload-new-research" class="btn-secondary" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid white;">
          Upload New Files Instead
        </button>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="research-synthesis-container">
        <div class="research-header">
          <h2>🔬 Cross-LLM Research Synthesis</h2>
          <p>Transform multi-source research into verified, cited insights</p>
        </div>

        ${existingResearchBanner}

        <div class="pipeline-steps" id="pipeline-steps">
          ${this._renderSteps()}
        </div>

        <div class="pipeline-content" id="pipeline-content">
          ${this._renderStepContent()}
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  /**
   * Renders the pipeline step cards
   * @private
   */
  _renderSteps() {
    return this.steps.map((step, idx) => {
      const statusClass = step.status;
      const isClickable = idx <= this.currentStep ? 'clickable' : '';

      return `
        <div class="step-card ${statusClass} ${isClickable}"
             data-step="${idx}"
             ${idx <= this.currentStep ? 'role="button" tabindex="0"' : ''}>
          <div class="step-number">${step.id}</div>
          <div class="step-name">${step.name}</div>
          <div class="step-status-icon">
            ${this._getStatusIcon(step.status)}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Returns status icon HTML based on status
   * @private
   */
  _getStatusIcon(status) {
    switch (status) {
      case 'complete':
        return '<span class="status-check">✓</span>';
      case 'processing':
        return '<div class="spinner-small"></div>';
      case 'error':
        return '<span class="status-error">✗</span>';
      case 'active':
        return '<span class="status-active">●</span>';
      default:
        return '';
    }
  }

  /**
   * Renders content for the current step
   * @private
   */
  _renderStepContent() {
    switch (this.currentStep) {
      case 0: return this._renderUploadStep();
      case 1: return this._renderExtractionStep();
      case 2: return this._renderLedgerStep();
      case 3: return this._renderContradictionsStep();
      case 4: return this._renderReportStep();
      case 5: return this._renderAuditStep();
      case 6: return this._renderVerifiedClaimsStep();
      case 7: return this._renderDashboardStep();
      default: return '<p>Invalid step</p>';
    }
  }

  // ========================================================================
  // STEP 1: UPLOAD SOURCES
  // ========================================================================

  /**
   * Renders the file upload interface
   * @private
   */
  _renderUploadStep() {
    const filesHtml = this.uploadedFiles.length > 0
      ? this._renderUploadedFilesList()
      : '';

    return `
      <div class="step-content">
        <h3>Step 1: Upload Research Sources</h3>
        <p>Upload research documents from different LLMs and assign each to its source provider.</p>

        <div class="upload-section">
          <div class="provider-selector-grid">
            ${this._renderProviderButtons()}
          </div>

          <div id="uploaded-files-list" class="uploaded-files-list">
            ${filesHtml}
          </div>

          <input type="file"
                 id="research-file-input"
                 accept=".pdf,.md,.txt,.docx"
                 multiple
                 style="display: none;" />
        </div>

        <div class="step-actions">
          <button class="btn-primary"
                  id="btn-start-extraction"
                  ${this.uploadedFiles.length === 0 ? 'disabled' : ''}>
            Start Extraction →
          </button>
          <p class="help-text">Upload at least one file to continue</p>
        </div>
      </div>
    `;
  }

  /**
   * Renders provider selection buttons
   * @private
   */
  _renderProviderButtons() {
    const providers = ['GEMINI', 'GPT', 'CLAUDE', 'GROK', 'OTHER'];
    return providers.map(provider => `
      <button class="provider-btn" data-provider="${provider}">
        <span class="provider-icon">${this._getProviderIcon(provider)}</span>
        <span class="provider-name">${provider}</span>
      </button>
    `).join('');
  }

  /**
   * Gets icon for provider
   * @private
   */
  _getProviderIcon(provider) {
    const icons = {
      'GEMINI': '💎',
      'GPT': '🤖',
      'CLAUDE': '🧠',
      'GROK': '🚀',
      'OTHER': '📄'
    };
    return icons[provider] || '📄';
  }

  /**
   * Renders list of uploaded files
   * @private
   */
  _renderUploadedFilesList() {
    if (this.uploadedFiles.length === 0) {
      return '<p class="no-files">No files uploaded yet</p>';
    }

    const byProvider = this._groupFilesByProvider();

    return Object.entries(byProvider).map(([provider, files]) => `
      <div class="provider-file-group">
        <div class="provider-label">
          ${this._getProviderIcon(provider)} ${provider} (${files.length} file${files.length !== 1 ? 's' : ''})
        </div>
        <ul class="file-list">
          ${files.map((fileData, idx) => `
            <li class="file-item">
              <span class="file-name">${DOMPurify.sanitize(fileData.file.name)}</span>
              <span class="file-size">${this._formatFileSize(fileData.file.size)}</span>
              <button class="btn-remove-file"
                      data-provider="${provider}"
                      data-index="${idx}"
                      title="Remove file">×</button>
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('');
  }

  /**
   * Groups uploaded files by provider
   * @private
   */
  _groupFilesByProvider() {
    return this.uploadedFiles.reduce((groups, fileData) => {
      if (!groups[fileData.provider]) {
        groups[fileData.provider] = [];
      }
      groups[fileData.provider].push(fileData);
      return groups;
    }, {});
  }

  /**
   * Formats file size for display
   * @private
   */
  _formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ========================================================================
  // STEP 2: EXTRACT CLAIMS
  // ========================================================================

  /**
   * Renders claim extraction interface
   * @private
   */
  _renderExtractionStep() {
    const summary = this.data.claims?.summary;

    return `
      <div class="step-content">
        <h3>Step 2: Extract Atomic Claims</h3>
        <p>AI is analyzing ${this.uploadedFiles.length} source file(s) to extract verifiable claims.</p>

        ${summary ? `
          <div class="extraction-summary">
            <div class="summary-card">
              <div class="summary-number">${summary.total}</div>
              <div class="summary-label">Total Claims</div>
            </div>
            <div class="summary-card">
              <div class="summary-number">${summary.cited}</div>
              <div class="summary-label">Cited Claims</div>
            </div>
            <div class="summary-card">
              <div class="summary-number">${summary.uncited}</div>
              <div class="summary-label">Uncited Claims</div>
            </div>
          </div>

          <div class="claims-breakdown">
            <h4>Claims by Provider</h4>
            <div class="breakdown-grid">
              ${Object.entries(summary.byProvider || {}).map(([provider, count]) => `
                <div class="breakdown-item">
                  <span class="breakdown-label">${this._getProviderIcon(provider)} ${provider}</span>
                  <span class="breakdown-value">${count}</span>
                </div>
              `).join('')}
            </div>

            <h4>Claims by Topic</h4>
            <div class="breakdown-grid">
              ${Object.entries(summary.byTopic || {}).slice(0, 8).map(([topic, count]) => `
                <div class="breakdown-item">
                  <span class="breakdown-label">${DOMPurify.sanitize(topic)}</span>
                  <span class="breakdown-value">${count}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="processing-message">
            <div class="spinner"></div>
            <p id="extraction-status">Starting extraction...</p>
          </div>
        `}

        <div class="step-actions">
          <button class="btn-secondary" onclick="window.researchSynthesizer.goToStep(0)">
            ← Back to Upload
          </button>
          <button class="btn-primary"
                  id="btn-view-ledger"
                  ${!summary ? 'disabled' : ''}>
            View Claim Ledger →
          </button>
        </div>
      </div>
    `;
  }

  // ========================================================================
  // STEP 3: VIEW CLAIM LEDGER
  // ========================================================================

  /**
   * Renders claim ledger view
   * @private
   */
  _renderLedgerStep() {
    const ledger = this.data.ledger;

    return `
      <div class="step-content">
        <h3>Step 3: Claim Ledger</h3>
        <p>All extracted claims aggregated with metadata.</p>

        ${ledger ? `
          <div class="ledger-controls">
            <div class="search-box">
              <input type="text"
                     id="ledger-search"
                     placeholder="Search claims..."
                     class="search-input" />
            </div>
            <div class="filter-controls">
              <select id="filter-provider" class="filter-select">
                <option value="">All Providers</option>
                ${Object.keys(ledger.summary.byProvider).map(p =>
                  `<option value="${p}">${p}</option>`
                ).join('')}
              </select>
              <select id="filter-topic" class="filter-select">
                <option value="">All Topics</option>
                ${Object.keys(ledger.summary.byTopic).map(t =>
                  `<option value="${t}">${DOMPurify.sanitize(t)}</option>`
                ).join('')}
              </select>
              <select id="filter-confidence" class="filter-select">
                <option value="">All Confidence</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div class="ledger-table-container" id="ledger-table-container">
            ${this._renderLedgerTable(ledger.claims)}
          </div>

          <div class="ledger-pagination">
            <span id="ledger-count">${ledger.claims.length} claim(s)</span>
          </div>
        ` : `
          <div class="loading-message">
            <div class="spinner"></div>
            <p>Loading claim ledger...</p>
          </div>
        `}

        <div class="step-actions">
          <button class="btn-secondary" onclick="window.researchSynthesizer.goToStep(1)">
            ← Back
          </button>
          <button class="btn-primary"
                  id="btn-detect-contradictions"
                  ${!ledger ? 'disabled' : ''}>
            Detect Contradictions →
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renders ledger table
   * @private
   */
  _renderLedgerTable(claims) {
    return `
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Claim</th>
            <th>Topic</th>
            <th>Source</th>
            <th>Provider</th>
            <th>Citation</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          ${claims.slice(0, 50).map(claim => `
            <tr class="ledger-row" data-claim-id="${claim.id}">
              <td class="claim-text">${DOMPurify.sanitize(claim.claim)}</td>
              <td class="claim-topic">
                <span class="topic-badge">${DOMPurify.sanitize(claim.topic)}</span>
              </td>
              <td class="claim-source">${DOMPurify.sanitize(claim.source)}</td>
              <td class="claim-provider">
                <span class="provider-badge">${claim.provider}</span>
              </td>
              <td class="claim-citation">
                ${claim.citation !== 'NONE'
                  ? `<span class="citation-badge">${DOMPurify.sanitize(claim.citation)}</span>`
                  : '<span class="uncited-badge">NONE</span>'}
              </td>
              <td class="claim-confidence">
                <span class="confidence-${claim.confidence}">${claim.confidence}</span>
              </td>
            </tr>
          `).join('')}
          ${claims.length > 50 ? `
            <tr><td colspan="6" class="ledger-truncated">
              Showing first 50 of ${claims.length} claims
            </td></tr>
          ` : ''}
        </tbody>
      </table>
    `;
  }

  // ========================================================================
  // STEP 4: DETECT CONTRADICTIONS
  // ========================================================================

  /**
   * Renders contradiction detection results
   * @private
   */
  _renderContradictionsStep() {
    const data = this.data.contradictions;

    return `
      <div class="step-content">
        <h3>Step 4: Contradiction Detection</h3>
        <p>Analyzing claim ledger for conflicts and inconsistencies.</p>

        ${data ? `
          <div class="contradiction-summary">
            <div class="summary-card">
              <div class="summary-number">${data.summary.totalContradictions}</div>
              <div class="summary-label">Total Contradictions</div>
            </div>
            <div class="summary-card severity-high">
              <div class="summary-number">${data.summary.highSeverity}</div>
              <div class="summary-label">High Severity</div>
            </div>
            <div class="summary-card severity-medium">
              <div class="summary-number">${data.summary.mediumSeverity}</div>
              <div class="summary-label">Medium Severity</div>
            </div>
            <div class="summary-card severity-low">
              <div class="summary-number">${data.summary.lowSeverity}</div>
              <div class="summary-label">Low Severity</div>
            </div>
          </div>

          <div class="contradiction-types">
            <h4>By Type</h4>
            <div class="type-grid">
              ${Object.entries(data.summary.byType).map(([type, count]) => `
                <div class="type-item">
                  <span class="type-icon">${this._getContradictionIcon(type)}</span>
                  <span class="type-label">${type}</span>
                  <span class="type-count">${count}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="contradiction-list">
            <h4>Identified Contradictions</h4>
            ${data.contradictions.slice(0, 10).map((c, idx) => `
              <div class="contradiction-card severity-${c.severity}">
                <div class="contradiction-header">
                  <span class="contradiction-type">${c.type}</span>
                  <span class="severity-badge severity-${c.severity}">${c.severity.toUpperCase()}</span>
                </div>
                <div class="contradiction-explanation">
                  ${DOMPurify.sanitize(c.explanation)}
                </div>
                <div class="contradiction-claims">
                  <strong>Conflicting Claims:</strong>
                  <ul>
                    ${c.claimIds.map(id => {
                      const claim = this.data.ledger?.claims.find(cl => cl.id === id);
                      return claim ? `
                        <li>${DOMPurify.sanitize(claim.claim)}
                          <em>(${claim.provider})</em>
                        </li>
                      ` : '';
                    }).join('')}
                  </ul>
                </div>
              </div>
            `).join('')}
            ${data.contradictions.length > 10 ? `
              <p class="truncated-notice">Showing 10 of ${data.contradictions.length} contradictions</p>
            ` : ''}
          </div>
        ` : `
          <div class="processing-message">
            <div class="spinner"></div>
            <p id="contradiction-status">Analyzing claims...</p>
          </div>
        `}

        <div class="step-actions">
          <button class="btn-secondary" onclick="window.researchSynthesizer.goToStep(2)">
            ← Back to Ledger
          </button>
          <button class="btn-primary"
                  id="btn-synthesize-report"
                  ${!data ? 'disabled' : ''}>
            Synthesize Report →
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Gets icon for contradiction type
   * @private
   */
  _getContradictionIcon(type) {
    const icons = {
      'numerical': '🔢',
      'polarity': '⚡',
      'definitional': '📖',
      'temporal': '⏰'
    };
    return icons[type.toLowerCase()] || '⚠️';
  }

  // ========================================================================
  // STEP 5: SYNTHESIZE REPORT
  // ========================================================================

  /**
   * Renders synthesized report view
   * @private
   */
  _renderReportStep() {
    const report = this.data.report;

    return `
      <div class="step-content">
        <h3>Step 5: Synthesized Report</h3>
        <p>Comprehensive Markdown report with inline citations.</p>

        ${report ? `
          <div class="report-controls">
            <button class="btn-export" id="btn-export-report">
              📥 Export as Markdown
            </button>
            <button class="btn-export" id="btn-copy-report">
              📋 Copy to Clipboard
            </button>
          </div>

          <div class="report-view-container">
            <div class="report-view" id="report-markdown-view">
              <!-- Rendered Markdown will go here -->
            </div>
          </div>
        ` : `
          <div class="processing-message">
            <div class="spinner"></div>
            <p id="report-status">Synthesizing report...</p>
          </div>
        `}

        <div class="step-actions">
          <button class="btn-secondary" onclick="window.researchSynthesizer.goToStep(3)">
            ← Back
          </button>
          <button class="btn-primary"
                  id="btn-audit-provenance"
                  ${!report ? 'disabled' : ''}>
            Audit Provenance →
          </button>
        </div>
      </div>
    `;
  }

  // ========================================================================
  // STEP 6: AUDIT PROVENANCE
  // ========================================================================

  /**
   * Renders provenance audit results
   * @private
   */
  _renderAuditStep() {
    const audit = this.data.audit;

    return `
      <div class="step-content">
        <h3>Step 6: Provenance Audit</h3>
        <p>Verifying citations and detecting attribution issues.</p>

        ${audit ? `
          <div class="audit-score-card">
            <div class="score-circle score-${this._getScoreClass(audit.overallScore)}">
              <div class="score-number">${audit.overallScore}</div>
              <div class="score-label">/ 100</div>
            </div>
            <div class="score-summary">
              <h4>Overall Attribution Quality</h4>
              <p>${DOMPurify.sanitize(audit.summary)}</p>
            </div>
          </div>

          <div class="audit-statistics">
            <div class="stat-item">
              <span class="stat-label">Total Statements</span>
              <span class="stat-value">${audit.statistics.totalStatements}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Issues Found</span>
              <span class="stat-value">${audit.statistics.issuesFound}</span>
            </div>
            <div class="stat-item issue-type">
              <span class="stat-label">🚫 Hallucinations</span>
              <span class="stat-value">${audit.statistics.hallucinations}</span>
            </div>
            <div class="stat-item issue-type">
              <span class="stat-label">❌ Incorrect Citations</span>
              <span class="stat-value">${audit.statistics.incorrectAttributions}</span>
            </div>
            <div class="stat-item issue-type">
              <span class="stat-label">⚠️ Missing Citations</span>
              <span class="stat-value">${audit.statistics.missingCitations}</span>
            </div>
          </div>

          ${audit.issues.length > 0 ? `
            <div class="audit-issues">
              <h4>Identified Issues</h4>
              ${audit.issues.slice(0, 10).map(issue => `
                <div class="audit-issue severity-${issue.severity}">
                  <div class="issue-header">
                    <span class="issue-type">${issue.type.replace(/_/g, ' ')}</span>
                    <span class="severity-badge severity-${issue.severity}">${issue.severity.toUpperCase()}</span>
                  </div>
                  <div class="issue-statement">
                    <strong>Statement:</strong> ${DOMPurify.sanitize(issue.statement)}
                  </div>
                  <div class="issue-correction">
                    <strong>Correct Source:</strong> ${DOMPurify.sanitize(issue.correctSource)}
                  </div>
                  <div class="issue-recommendation">
                    <strong>Recommendation:</strong> ${DOMPurify.sanitize(issue.recommendedCitation)}
                  </div>
                </div>
              `).join('')}
              ${audit.issues.length > 10 ? `
                <p class="truncated-notice">Showing 10 of ${audit.issues.length} issues</p>
              ` : ''}
            </div>
          ` : `
            <div class="no-issues-message">
              <span class="success-icon">✓</span>
              <p>No attribution issues found! All citations are accurate.</p>
            </div>
          `}
        ` : `
          <div class="processing-message">
            <div class="spinner"></div>
            <p id="audit-status">Auditing report...</p>
          </div>
        `}

        <div class="step-actions">
          <button class="btn-secondary" onclick="window.researchSynthesizer.goToStep(4)">
            ← Back to Report
          </button>
          <button class="btn-primary"
                  id="btn-view-verified-claims"
                  ${!audit ? 'disabled' : ''}>
            View Verified Claims →
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Gets CSS class for audit score
   * @private
   */
  _getScoreClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  // ========================================================================
  // STEP 7: VERIFIED CLAIMS
  // ========================================================================

  /**
   * Renders verified claims categorization
   * @private
   */
  _renderVerifiedClaimsStep() {
    const claims = this.data.verifiedClaims;

    return `
      <div class="step-content">
        <h3>Step 7: Verified Claims</h3>
        <p>Claims separated into high-consensus and disputed categories.</p>

        ${claims ? `
          <div class="claims-summary-tabs">
            <button class="tab-btn active" data-tab="high-consensus">
              ✓ High Consensus (${claims.summary.highConsensus})
            </button>
            <button class="tab-btn" data-tab="disputed">
              ⚠️ Disputed (${claims.summary.disputed})
            </button>
            ${claims.summary.flagged > 0 ? `
              <button class="tab-btn" data-tab="flagged">
                🚩 Flagged (${claims.summary.flagged})
              </button>
            ` : ''}
          </div>

          <div class="claims-tab-content">
            <div class="tab-panel active" id="high-consensus-panel">
              ${this._renderClaimsList(claims.highConsensus, 'high-consensus')}
            </div>
            <div class="tab-panel" id="disputed-panel">
              ${this._renderClaimsList(claims.disputed, 'disputed')}
            </div>
            ${claims.summary.flagged > 0 ? `
              <div class="tab-panel" id="flagged-panel">
                ${this._renderClaimsList(
                  claims.highConsensus.filter(c => c.flagged),
                  'flagged'
                )}
              </div>
            ` : ''}
          </div>
        ` : `
          <div class="loading-message">
            <div class="spinner"></div>
            <p>Loading verified claims...</p>
          </div>
        `}

        <div class="step-actions">
          <button class="btn-secondary" onclick="window.researchSynthesizer.goToStep(5)">
            ← Back to Audit
          </button>
          <button class="btn-primary"
                  id="btn-view-dashboard"
                  ${!claims ? 'disabled' : ''}>
            View Dashboard →
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renders a list of claims
   * @private
   */
  _renderClaimsList(claims, category) {
    if (!claims || claims.length === 0) {
      return `<p class="no-claims">No ${category} claims</p>`;
    }

    return `
      <div class="claims-list">
        ${claims.slice(0, 20).map(claim => `
          <div class="claim-card ${category} ${claim.flagged ? 'flagged' : ''}">
            <div class="claim-header">
              <span class="claim-provider">${this._getProviderIcon(claim.provider)} ${claim.provider}</span>
              <span class="claim-confidence confidence-${claim.confidence}">${claim.confidence}</span>
            </div>
            <div class="claim-body">
              ${DOMPurify.sanitize(claim.claim)}
            </div>
            <div class="claim-footer">
              <span class="claim-topic">${DOMPurify.sanitize(claim.topic)}</span>
              <span class="claim-source">${DOMPurify.sanitize(claim.source)}</span>
              ${claim.citation !== 'NONE'
                ? `<span class="claim-citation">${DOMPurify.sanitize(claim.citation)}</span>`
                : '<span class="uncited-tag">UNCITED</span>'}
              ${claim.flagged ? '<span class="flagged-tag">🚩 FLAGGED</span>' : ''}
            </div>
          </div>
        `).join('')}
        ${claims.length > 20 ? `
          <p class="truncated-notice">Showing 20 of ${claims.length} claims</p>
        ` : ''}
      </div>
    `;
  }

  // ========================================================================
  // STEP 8: DASHBOARD
  // ========================================================================

  /**
   * Renders the final dashboard with visualizations
   * @private
   */
  _renderDashboardStep() {
    const dashboard = this.data.dashboard;
    const executive = this.data.executiveSummary;

    return `
      <div class="step-content">
        <h3>Step 8: Analysis Dashboard</h3>
        <p>Visual summary of research synthesis quality.</p>

        ${dashboard && executive ? `
          <div class="executive-summary-box">
            <h4>Executive Summary</h4>
            <div class="executive-content" id="executive-markdown-view">
              <!-- Will be rendered as Markdown -->
            </div>
          </div>

          <div class="dashboard-charts-grid">
            <div class="chart-card">
              <h5>Citation Coverage</h5>
              <canvas id="citation-chart"></canvas>
            </div>
            <div class="chart-card">
              <h5>Verification Status</h5>
              <canvas id="verification-chart"></canvas>
            </div>
            <div class="chart-card">
              <h5>Consensus Analysis</h5>
              <canvas id="consensus-chart"></canvas>
            </div>
          </div>

          <div class="dashboard-summary-stats">
            <h4>Summary Statistics</h4>
            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-number">${dashboard.summary.totalClaims}</div>
                <div class="stat-label">Total Claims</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">${dashboard.summary.totalSources}</div>
                <div class="stat-label">Source Files</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">${dashboard.summary.providers.length}</div>
                <div class="stat-label">LLM Providers</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">${dashboard.summary.topics}</div>
                <div class="stat-label">Topics Covered</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">${dashboard.summary.contradictions}</div>
                <div class="stat-label">Contradictions</div>
              </div>
              <div class="stat-box ${this._getScoreClass(dashboard.auditScore)}">
                <div class="stat-number">${dashboard.auditScore}</div>
                <div class="stat-label">Audit Score</div>
              </div>
            </div>
          </div>

          <div class="dashboard-actions">
            <button class="btn-export" id="btn-export-full-report">
              📥 Export Complete Report
            </button>
            <button class="btn-export" id="btn-download-data">
              💾 Download Raw Data (JSON)
            </button>
            <button class="btn-primary" onclick="window.researchSynthesizer.reset()">
              🔄 Start New Synthesis
            </button>
          </div>
        ` : `
          <div class="processing-message">
            <div class="spinner"></div>
            <p id="dashboard-status">Generating dashboard...</p>
          </div>
        `}

        <div class="step-actions">
          <button class="btn-secondary" onclick="window.researchSynthesizer.goToStep(6)">
            ← Back to Claims
          </button>
        </div>
      </div>
    `;
  }

  // ========================================================================
  // EVENT HANDLERS & NAVIGATION
  // ========================================================================

  /**
   * Attaches all event listeners
   * @private
   */
  _attachEventListeners() {
    // Existing research banner buttons
    const btnUseExisting = document.getElementById('btn-use-existing-research');
    if (btnUseExisting) {
      btnUseExisting.addEventListener('click', () => this._useExistingResearch());
    }

    const btnUploadNew = document.getElementById('btn-upload-new-research');
    if (btnUploadNew) {
      btnUploadNew.addEventListener('click', () => this._startFreshUpload());
    }

    // Provider buttons
    document.querySelectorAll('.provider-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const provider = e.currentTarget.dataset.provider;
        this._handleProviderSelect(provider);
      });
    });

    // Remove file buttons
    document.querySelectorAll('.btn-remove-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const provider = e.currentTarget.dataset.provider;
        const index = parseInt(e.currentTarget.dataset.index);
        this._handleRemoveFile(provider, index);
      });
    });

    // Step navigation (clickable completed steps)
    document.querySelectorAll('.step-card.clickable').forEach(card => {
      card.addEventListener('click', (e) => {
        const stepIndex = parseInt(e.currentTarget.dataset.step);
        this.goToStep(stepIndex);
      });
    });

    // Step action buttons
    this._attachStepActionListeners();

    // Tab switching (for verified claims)
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this._switchTab(e.currentTarget.dataset.tab);
      });
    });
  }

  /**
   * Attaches step-specific action listeners
   * @private
   */
  _attachStepActionListeners() {
    const btnStartExtraction = document.getElementById('btn-start-extraction');
    if (btnStartExtraction) {
      btnStartExtraction.addEventListener('click', () => this.startExtraction());
    }

    const btnViewLedger = document.getElementById('btn-view-ledger');
    if (btnViewLedger) {
      btnViewLedger.addEventListener('click', () => this.viewLedger());
    }

    const btnDetectContradictions = document.getElementById('btn-detect-contradictions');
    if (btnDetectContradictions) {
      btnDetectContradictions.addEventListener('click', () => this.detectContradictions());
    }

    const btnSynthesizeReport = document.getElementById('btn-synthesize-report');
    if (btnSynthesizeReport) {
      btnSynthesizeReport.addEventListener('click', () => this.synthesizeReport());
    }

    const btnAuditProvenance = document.getElementById('btn-audit-provenance');
    if (btnAuditProvenance) {
      btnAuditProvenance.addEventListener('click', () => this.auditProvenance());
    }

    const btnViewVerifiedClaims = document.getElementById('btn-view-verified-claims');
    if (btnViewVerifiedClaims) {
      btnViewVerifiedClaims.addEventListener('click', () => this.viewVerifiedClaims());
    }

    const btnViewDashboard = document.getElementById('btn-view-dashboard');
    if (btnViewDashboard) {
      btnViewDashboard.addEventListener('click', () => this.viewDashboard());
    }

    // Export buttons
    const btnExportReport = document.getElementById('btn-export-report');
    if (btnExportReport) {
      btnExportReport.addEventListener('click', () => this._exportReport());
    }

    const btnCopyReport = document.getElementById('btn-copy-report');
    if (btnCopyReport) {
      btnCopyReport.addEventListener('click', () => this._copyReport());
    }

    const btnExportFullReport = document.getElementById('btn-export-full-report');
    if (btnExportFullReport) {
      btnExportFullReport.addEventListener('click', () => this._exportFullReport());
    }

    const btnDownloadData = document.getElementById('btn-download-data');
    if (btnDownloadData) {
      btnDownloadData.addEventListener('click', () => this._downloadRawData());
    }
  }

  /**
   * Handles provider button click - opens file picker
   * @private
   */
  _handleProviderSelect(provider) {
    const fileInput = document.getElementById('research-file-input');
    if (!fileInput) return;

    // Store selected provider
    this.selectedProvider = provider;

    // Trigger file picker
    fileInput.click();

    // Handle file selection
    fileInput.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        files.forEach(file => {
          this.uploadedFiles.push({ file, provider });
        });
        this.render(); // Re-render to show uploaded files
      }
      // Reset input
      fileInput.value = '';
    };
  }

  /**
   * Handles file removal
   * @private
   */
  _handleRemoveFile(provider, index) {
    // Find and remove the file
    const byProvider = this._groupFilesByProvider();
    const fileToRemove = byProvider[provider][index];

    const globalIndex = this.uploadedFiles.indexOf(fileToRemove);
    if (globalIndex > -1) {
      this.uploadedFiles.splice(globalIndex, 1);
    }

    this.render(); // Re-render
  }

  /**
   * Switches between tabs (verified claims)
   * @private
   */
  _switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}-panel`);
    });
  }

  /**
   * Navigates to a specific step
   */
  goToStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) return;
    if (stepIndex > this.currentStep && this.steps[this.currentStep].status !== 'complete') {
      return; // Can't skip ahead
    }

    this.currentStep = stepIndex;
    this.steps.forEach((step, idx) => {
      if (idx === stepIndex) {
        step.status = 'active';
      } else if (idx < stepIndex) {
        step.status = 'complete';
      } else {
        step.status = 'pending';
      }
    });

    this.render();
  }

  /**
   * Advances to next step
   */
  advanceToNextStep() {
    this.steps[this.currentStep].status = 'complete';
    this.currentStep++;
    if (this.currentStep < this.steps.length) {
      this.steps[this.currentStep].status = 'active';
    }
    this.render();
  }

  /**
   * Uses existing research from the roadmap session
   * @private
   */
  async _useExistingResearch() {
    if (!this.sessionId) {
      alert('No existing research session found.');
      return;
    }

    try {
      console.log('✅ Using existing research from session:', this.sessionId);

      // Skip directly to extraction step
      this.advanceToNextStep();

      // Start extraction using existing session
      const extractResponse = await fetch('/api/research/extract-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });

      if (!extractResponse.ok) {
        throw new Error(`Extraction failed: ${extractResponse.statusText}`);
      }

      const extractData = await extractResponse.json();
      const jobId = extractData.jobId;

      // Poll for completion
      await this.pollJob(jobId, (job) => {
        const statusEl = document.getElementById('extraction-status');
        if (statusEl) {
          statusEl.textContent = job.progress || 'Processing...';
        }
      });

      // Job complete - store claims data
      const job = await this._getJob(jobId);
      this.data.claims = job.data;

      this.render();

    } catch (error) {
      console.error('Error using existing research:', error);
      alert(`Error: ${error.message}`);
      this.steps[this.currentStep].status = 'error';
      this.render();
    }
  }

  /**
   * Starts fresh with new file uploads
   * @private
   */
  _startFreshUpload() {
    this.hasExistingResearch = false;
    this.sessionId = null;
    this.render();
  }

  /**
   * Resets the entire synthesis
   */
  reset() {
    if (!confirm('Are you sure you want to start a new synthesis? All current data will be lost.')) {
      return;
    }

    this.sessionId = null;
    this.currentStep = 0;
    this.uploadedFiles = [];
    this.hasExistingResearch = false;
    this.data = {
      claims: null,
      ledger: null,
      contradictions: null,
      report: null,
      audit: null,
      verifiedClaims: null,
      executiveSummary: null,
      dashboard: null
    };
    this.steps.forEach((step, idx) => {
      step.status = idx === 0 ? 'active' : 'pending';
    });
    this.render();
  }

  // ========================================================================
  // API CALLS & DATA FETCHING
  // ========================================================================

  /**
   * Starts claim extraction process
   */
  async startExtraction() {
    try {
      // Upload files first
      const formData = new FormData();
      const providers = [];

      this.uploadedFiles.forEach(({ file, provider }) => {
        formData.append('files', file);
        providers.push(provider);
      });

      providers.forEach(p => formData.append('providers', p));

      const uploadResponse = await fetch('/api/research/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      this.sessionId = uploadData.sessionId;

      console.log('✅ Files uploaded, session:', this.sessionId);

      // Start extraction
      const extractResponse = await fetch('/api/research/extract-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });

      if (!extractResponse.ok) {
        throw new Error(`Extraction failed: ${extractResponse.statusText}`);
      }

      const extractData = await extractResponse.json();
      const jobId = extractData.jobId;

      // Advance to extraction step and start polling
      this.advanceToNextStep();
      await this.pollJob(jobId, (job) => {
        // Update status message
        const statusEl = document.getElementById('extraction-status');
        if (statusEl) {
          statusEl.textContent = job.progress || 'Processing...';
        }
      });

      // Job complete - store claims data
      const job = await this._getJob(jobId);
      this.data.claims = job.data;

      this.render();

    } catch (error) {
      console.error('Extraction error:', error);
      alert(`Error: ${error.message}`);
      this.steps[this.currentStep].status = 'error';
      this.render();
    }
  }

  /**
   * Views the claim ledger
   */
  async viewLedger() {
    try {
      const response = await fetch(`/api/research/ledger/${this.sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to load ledger: ${response.statusText}`);
      }

      this.data.ledger = await response.json();
      this.advanceToNextStep();

    } catch (error) {
      console.error('Ledger error:', error);
      alert(`Error: ${error.message}`);
    }
  }

  /**
   * Detects contradictions
   */
  async detectContradictions() {
    try {
      const response = await fetch('/api/research/detect-contradictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });

      if (!response.ok) {
        throw new Error(`Detection failed: ${response.statusText}`);
      }

      const { jobId } = await response.json();

      this.advanceToNextStep();
      await this.pollJob(jobId, (job) => {
        const statusEl = document.getElementById('contradiction-status');
        if (statusEl) statusEl.textContent = job.progress || 'Processing...';
      });

      const job = await this._getJob(jobId);
      this.data.contradictions = job.data;
      this.render();

    } catch (error) {
      console.error('Contradiction detection error:', error);
      alert(`Error: ${error.message}`);
      this.steps[this.currentStep].status = 'error';
      this.render();
    }
  }

  /**
   * Synthesizes the report
   */
  async synthesizeReport() {
    try {
      const response = await fetch('/api/research/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });

      if (!response.ok) {
        throw new Error(`Synthesis failed: ${response.statusText}`);
      }

      const { jobId } = await response.json();

      this.advanceToNextStep();
      await this.pollJob(jobId, (job) => {
        const statusEl = document.getElementById('report-status');
        if (statusEl) statusEl.textContent = job.progress || 'Processing...';
      });

      const job = await this._getJob(jobId);
      this.data.report = job.data;

      // Render Markdown
      this.render();
      this._renderMarkdown(this.data.report.report, 'report-markdown-view');

    } catch (error) {
      console.error('Report synthesis error:', error);
      alert(`Error: ${error.message}`);
      this.steps[this.currentStep].status = 'error';
      this.render();
    }
  }

  /**
   * Audits provenance
   */
  async auditProvenance() {
    try {
      const response = await fetch('/api/research/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });

      if (!response.ok) {
        throw new Error(`Audit failed: ${response.statusText}`);
      }

      const { jobId } = await response.json();

      this.advanceToNextStep();
      await this.pollJob(jobId, (job) => {
        const statusEl = document.getElementById('audit-status');
        if (statusEl) statusEl.textContent = job.progress || 'Processing...';
      });

      const job = await this._getJob(jobId);
      this.data.audit = job.data.audit;
      this.render();

    } catch (error) {
      console.error('Provenance audit error:', error);
      alert(`Error: ${error.message}`);
      this.steps[this.currentStep].status = 'error';
      this.render();
    }
  }

  /**
   * Views verified claims
   */
  async viewVerifiedClaims() {
    try {
      const response = await fetch(`/api/research/verified-claims/${this.sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to load claims: ${response.statusText}`);
      }

      this.data.verifiedClaims = await response.json();
      this.advanceToNextStep();

    } catch (error) {
      console.error('Verified claims error:', error);
      alert(`Error: ${error.message}`);
    }
  }

  /**
   * Views dashboard and generates executive summary
   */
  async viewDashboard() {
    try {
      // Load dashboard data
      const dashboardResponse = await fetch(`/api/research/dashboard/${this.sessionId}`);
      if (!dashboardResponse.ok) {
        throw new Error(`Dashboard failed: ${dashboardResponse.statusText}`);
      }
      this.data.dashboard = await dashboardResponse.json();

      // Generate executive summary
      const summaryResponse = await fetch('/api/research/executive-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });

      if (!summaryResponse.ok) {
        throw new Error(`Summary failed: ${summaryResponse.statusText}`);
      }

      const { jobId } = await summaryResponse.json();

      this.advanceToNextStep();
      await this.pollJob(jobId, (job) => {
        const statusEl = document.getElementById('dashboard-status');
        if (statusEl) statusEl.textContent = job.progress || 'Processing...';
      });

      const job = await this._getJob(jobId);
      this.data.executiveSummary = job.data.executiveSummary;

      this.render();

      // Render executive summary as Markdown
      this._renderMarkdown(this.data.executiveSummary.summary, 'executive-markdown-view');

      // Render charts
      this._renderCharts();

    } catch (error) {
      console.error('Dashboard error:', error);
      alert(`Error: ${error.message}`);
      this.steps[this.currentStep].status = 'error';
      this.render();
    }
  }

  /**
   * Polls a job until completion
   * @param {string} jobId - Job ID to poll
   * @param {Function} onProgress - Callback for progress updates
   */
  async pollJob(jobId, onProgress = null) {
    const maxAttempts = 300; // 5 minutes
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(`/job/${jobId}`);
      const job = await response.json();

      if (onProgress) {
        onProgress(job);
      }

      if (job.status === 'complete') {
        return job;
      } else if (job.status === 'error') {
        throw new Error(job.error || 'Job failed');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Job timeout after 5 minutes');
  }

  /**
   * Gets job data
   * @private
   */
  async _getJob(jobId) {
    const response = await fetch(`/job/${jobId}`);
    if (!response.ok) {
      throw new Error('Failed to get job data');
    }
    return await response.json();
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Renders Markdown content to HTML
   * @private
   */
  _renderMarkdown(markdown, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Simple Markdown rendering (basic support)
    // For production, use a library like marked.js
    let html = markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p><h/g, '<h').replace(/<\/h(\d)><\/p>/g, '</h$1>');
    html = html.replace(/<p><li>/g, '<ul><li>').replace(/<\/li><\/p>/g, '</li></ul>');

    container.innerHTML = DOMPurify.sanitize(html);
  }

  /**
   * Renders Chart.js visualizations
   * @private
   */
  _renderCharts() {
    if (typeof Chart === 'undefined') {
      console.error('Chart.js not loaded');
      return;
    }

    const dashboard = this.data.dashboard;

    // Citation Chart
    const citationCtx = document.getElementById('citation-chart')?.getContext('2d');
    if (citationCtx) {
      new Chart(citationCtx, {
        type: 'pie',
        data: {
          labels: ['Cited', 'Uncited'],
          datasets: [{
            data: [
              dashboard.citationBreakdown.cited,
              dashboard.citationBreakdown.uncited
            ],
            backgroundColor: ['#4CAF50', '#F44336']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    // Verification Chart
    const verificationCtx = document.getElementById('verification-chart')?.getContext('2d');
    if (verificationCtx) {
      new Chart(verificationCtx, {
        type: 'pie',
        data: {
          labels: ['High Confidence', 'Medium Confidence', 'Low Confidence'],
          datasets: [{
            data: [
              dashboard.verificationBreakdown.highConfidence,
              dashboard.verificationBreakdown.mediumConfidence,
              dashboard.verificationBreakdown.lowConfidence
            ],
            backgroundColor: ['#4CAF50', '#FFC107', '#F44336']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    // Consensus Chart
    const consensusCtx = document.getElementById('consensus-chart')?.getContext('2d');
    if (consensusCtx) {
      new Chart(consensusCtx, {
        type: 'pie',
        data: {
          labels: ['High Consensus', 'Medium Consensus', 'Disputed'],
          datasets: [{
            data: [
              dashboard.consensusBreakdown.highConsensus,
              dashboard.consensusBreakdown.mediumConsensus,
              dashboard.consensusBreakdown.disputed
            ],
            backgroundColor: ['#4CAF50', '#FFC107', '#F44336']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }
  }

  /**
   * Exports report as Markdown file
   * @private
   */
  _exportReport() {
    if (!this.data.report?.report) return;

    const blob = new Blob([this.data.report.report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_synthesis_report_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Copies report to clipboard
   * @private
   */
  async _copyReport() {
    if (!this.data.report?.report) return;

    try {
      await navigator.clipboard.writeText(this.data.report.report);
      alert('Report copied to clipboard!');
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Failed to copy to clipboard');
    }
  }

  /**
   * Exports complete report with all sections
   * @private
   */
  async _exportFullReport() {
    try {
      const response = await fetch(`/api/research/report/${this.sessionId}`);
      if (!response.ok) throw new Error('Failed to load full report');

      const fullReport = await response.json();

      const markdown = `# Cross-LLM Research Synthesis Report

Generated: ${new Date().toISOString()}

---

## Executive Summary

${fullReport.executiveSummary.summary}

---

## Full Report

${fullReport.report}

---

## Provenance Audit

**Overall Score:** ${fullReport.audit.overallScore}/100

**Summary:** ${fullReport.audit.summary}

### Issues Found

${fullReport.audit.issues.map(issue => `
- **${issue.type}** (${issue.severity}): ${issue.statement}
  - Recommended: ${issue.recommendedCitation}
`).join('\n')}

---

## Metadata

- Total Claims: ${fullReport.metadata.totalClaims}
- Cited Claims: ${fullReport.metadata.citedClaims}
- Topics: ${fullReport.metadata.topics.join(', ')}
- Contradictions: ${fullReport.metadata.contradictions}
`;

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `complete_research_synthesis_${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
    }
  }

  /**
   * Downloads raw data as JSON
   * @private
   */
  _downloadRawData() {
    const jsonData = JSON.stringify({
      sessionId: this.sessionId,
      claims: this.data.claims,
      ledger: this.data.ledger,
      contradictions: this.data.contradictions,
      report: this.data.report,
      audit: this.data.audit,
      verifiedClaims: this.data.verifiedClaims,
      executiveSummary: this.data.executiveSummary,
      dashboard: this.data.dashboard
    }, null, 2);

    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_synthesis_data_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Make component globally accessible for inline event handlers
window.ResearchSynthesizer = ResearchSynthesizer;
