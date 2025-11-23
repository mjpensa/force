/**
 * Modern Executive Summary Document Reader
 * Clean, MS Word / Google Docs inspired interface
 * Features: Minimal toolbar, centered document, professional typography
 * Displays narrative text only - no dashboards or structured data
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
      console.log('  Summary content type:', typeof summaryData.content);
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
    if (!this.summaryData || !this.summaryData.content) {
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

    // Build document content from narrative text
    const content = this._buildDocumentContent();
    documentPage.innerHTML = content;

    container.appendChild(documentPage);

    return container;
  }

  /**
   * Builds the document content from the narrative text
   * @private
   * @returns {string} Complete document HTML
   */
  _buildDocumentContent() {
    // Get the content string from summaryData
    const narrativeText = this.summaryData.content || '';

    // Split by section headings and format
    let formattedContent = narrativeText;

    // Convert markdown-style headings to HTML
    // Handle **Section X: Title** format
    formattedContent = formattedContent.replace(/\*\*Section (\d+): ([^*]+)\*\*/g,
      '<h2 class="document-heading">Section $1: $2</h2>');

    // Handle **Title** format (for any remaining bold headings)
    formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Split by double newlines to create paragraphs
    const paragraphs = formattedContent.split('\n\n').filter(p => p.trim());

    // Build HTML
    let html = '<h1 class="document-title">Executive Summary</h1>';
    html += '<div class="document-narrative">';

    paragraphs.forEach(para => {
      const trimmed = para.trim();
      if (!trimmed) return;

      // If it's a heading (starts with <h2), add it directly
      if (trimmed.startsWith('<h2')) {
        html += trimmed;
      } else {
        // Otherwise, wrap in paragraph tag
        html += `<p class="document-paragraph">${trimmed}</p>`;
      }
    });

    html += '</div>';

    return html;
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
