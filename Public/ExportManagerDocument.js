/**
 * ExportManagerDocument.js
 *
 * Handles multiple export formats for executive summary documents.
 * Features:
 * - PDF export (full document)
 * - PNG export (current page or all pages)
 * - Print-optimized view
 * - Export progress indicators
 *
 * Adapted from ExportManager.js for document viewer (8.5x11 format)
 */

export class ExportManagerDocument {
  /**
   * Create a new ExportManagerDocument instance
   * @param {ExecutiveSummary} documentViewer - Reference to ExecutiveSummary instance
   */
  constructor(documentViewer) {
    this.documentViewer = documentViewer;
    this.isExporting = false;
  }

  /**
   * Export entire document as PDF
   */
  async exportToPDF() {
    if (this.isExporting) {
      alert('Export already in progress. Please wait...');
      return;
    }

    this.isExporting = true;
    this.showProgress('Preparing PDF export...', 0);

    try {
      // Dynamically import jsPDF (assuming CDN loaded)
      if (typeof window.jspdf === 'undefined') {
        throw new Error('jsPDF library not loaded. Please check CDN connection.');
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter' // 8.5x11 inch
      });

      const pages = this.documentViewer.pages;
      const totalPages = pages.length;

      for (let i = 0; i < totalPages; i++) {
        this.updateProgress(
          `Rendering page ${i + 1} of ${totalPages}...`,
          ((i / totalPages) * 90) // Reserve 10% for final processing
        );

        // Render page to temporary container
        const pageHTML = await this.renderPageForExport(pages[i], i);

        // Capture as image using html2canvas
        const canvas = await this.capturePageAsCanvas(pageHTML);

        // Add to PDF
        const imgData = canvas.toDataURL('image/png');

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'PNG', 0, 0, 8.5, 11);

        // Cleanup temporary container
        pageHTML.remove();
      }

      this.updateProgress('Generating PDF file...', 95);

      // Save PDF
      const filename = this.getFilename('pdf');
      pdf.save(filename);

      this.updateProgress('PDF export complete!', 100);

      setTimeout(() => {
        this.hideProgress();
      }, 1500);

      console.log('[ExportManagerDocument] PDF exported successfully:', filename);
    } catch (error) {
      console.error('[ExportManagerDocument] PDF export failed:', error);
      this.hideProgress();
      alert(`PDF export failed: ${error.message}\n\nPlease try again.`);
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Export current page as PNG
   */
  async exportCurrentPageToPNG() {
    if (this.isExporting) {
      alert('Export already in progress. Please wait...');
      return;
    }

    this.isExporting = true;
    this.showProgress('Exporting current page to PNG...', 50);

    try {
      const currentPageEl = document.querySelector('.doc-page.active') ||
                            document.querySelector('.doc-page');
      if (!currentPageEl) {
        throw new Error('Current page element not found');
      }

      // Capture page as canvas
      const canvas = await this.capturePageAsCanvas(currentPageEl);

      // Download as PNG
      const pageNumber = this.documentViewer.currentPageIndex + 1;
      const filename = this.getFilename(`page-${pageNumber}.png`);
      this.downloadCanvas(canvas, filename);

      this.updateProgress('PNG export complete!', 100);

      setTimeout(() => {
        this.hideProgress();
      }, 1000);

      console.log('[ExportManagerDocument] Current page exported as PNG:', filename);
    } catch (error) {
      console.error('[ExportManagerDocument] PNG export failed:', error);
      this.hideProgress();
      alert(`PNG export failed: ${error.message}\n\nPlease try again.`);
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Export all pages as individual PNGs
   */
  async exportAllPagesToPNG() {
    if (this.isExporting) {
      alert('Export already in progress. Please wait...');
      return;
    }

    const confirmExport = confirm(
      `This will download ${this.documentViewer.pages.length} PNG files.\n\nContinue?`
    );

    if (!confirmExport) {
      return;
    }

    this.isExporting = true;
    this.showProgress('Preparing to export all pages...', 0);

    try {
      const pages = this.documentViewer.pages;
      const totalPages = pages.length;

      for (let i = 0; i < totalPages; i++) {
        this.updateProgress(
          `Exporting page ${i + 1} of ${totalPages}...`,
          (i / totalPages) * 100
        );

        // Render page to temporary container
        const pageHTML = await this.renderPageForExport(pages[i], i);

        // Capture as canvas
        const canvas = await this.capturePageAsCanvas(pageHTML);

        // Download with delay to avoid browser blocking
        await this.downloadCanvasWithDelay(canvas, this.getFilename(`page-${i + 1}.png`), i * 500);

        // Cleanup
        pageHTML.remove();
      }

      this.updateProgress('All pages exported!', 100);

      setTimeout(() => {
        this.hideProgress();
      }, 1500);

      console.log('[ExportManagerDocument] All pages exported as PNG');
    } catch (error) {
      console.error('[ExportManagerDocument] PNG export failed:', error);
      this.hideProgress();
      alert(`PNG export failed: ${error.message}\n\nPlease try again.`);
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Open print-optimized view
   */
  openPrintView() {
    try {
      const printWindow = window.open('', '_blank', 'width=1200,height=800');

      if (!printWindow) {
        alert('Please allow pop-ups to use Print View.\n\nCheck your browser settings and try again.');
        return;
      }

      const printHTML = this.generatePrintHTML();
      printWindow.document.write(printHTML);
      printWindow.document.close();

      // Trigger print dialog after content loads
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500); // Small delay to ensure rendering
      };

      console.log('[ExportManagerDocument] Print view opened');
    } catch (error) {
      console.error('[ExportManagerDocument] Print view failed:', error);
      alert(`Print view failed: ${error.message}\n\nPlease try again.`);
    }
  }

  /**
   * Render page to temporary container for export
   * @private
   */
  async renderPageForExport(page, pageIndex) {
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 816px;
      height: 1056px;
      background-color: #ffffff;
      padding: 48px;
      box-sizing: border-box;
    `;

    document.body.appendChild(tempContainer);

    // Render page content (simplified - you may need to adapt based on actual page structure)
    const pageContent = document.createElement('div');
    pageContent.className = 'doc-page-export';
    pageContent.innerHTML = this._generatePageContent(page, pageIndex);

    tempContainer.appendChild(pageContent);

    // Small delay to ensure rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    return tempContainer;
  }

  /**
   * Generate page content HTML
   * @private
   */
  _generatePageContent(page, pageIndex) {
    // This is a simplified version - adapt based on your actual page structure
    const summaryData = this.documentViewer.summaryData;

    if (!summaryData) {
      return `<div style="padding: 20px; font-family: 'Work Sans', sans-serif;">
        <h1>Executive Summary - Page ${pageIndex + 1}</h1>
        <p>Content unavailable</p>
      </div>`;
    }

    // Build page content based on summary data
    let content = `<div style="font-family: 'Work Sans', sans-serif; color: #1a1a1a;">`;

    // Page title/header
    content += `<h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #1e293b;">
      Executive Summary
    </h1>`;

    // Add summary sections based on page number
    if (pageIndex === 0 && summaryData.strategicNarrative) {
      content += `<section style="margin-bottom: 24px;">
        <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #334155;">Strategic Overview</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">${summaryData.strategicNarrative}</p>
      </section>`;
    }

    if (summaryData.keyDrivers && summaryData.keyDrivers.length > 0) {
      content += `<section style="margin-bottom: 24px;">
        <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #334155;">Key Drivers</h2>`;
      summaryData.keyDrivers.forEach((driver, idx) => {
        content += `<div style="margin-bottom: 12px;">
          <strong style="color: #1e293b;">${idx + 1}. ${driver.driver || driver.name || 'Driver'}</strong>
          <p style="font-size: 13px; margin-top: 4px; color: #64748b;">${driver.description || ''}</p>
        </div>`;
      });
      content += `</section>`;
    }

    content += `</div>`;

    return content;
  }

  /**
   * Capture page element as canvas
   * @private
   */
  async capturePageAsCanvas(pageElement) {
    if (typeof html2canvas === 'undefined') {
      throw new Error('html2canvas library not loaded. Please check CDN connection.');
    }

    return await html2canvas(pageElement, {
      width: 816,
      height: 1056,
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true
    });
  }

  /**
   * Download canvas as PNG
   * @private
   */
  downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /**
   * Download canvas with delay (to avoid browser blocking multiple downloads)
   * @private
   */
  async downloadCanvasWithDelay(canvas, filename, delay) {
    return new Promise(resolve => {
      setTimeout(() => {
        this.downloadCanvas(canvas, filename);
        resolve();
      }, delay);
    });
  }

  /**
   * Generate print-optimized HTML
   * @private
   */
  generatePrintHTML() {
    const pages = this.documentViewer.pages;
    const summaryData = this.documentViewer.summaryData;

    // Render all pages
    const pagesHTML = pages.map((page, index) => {
      const pageContent = this._generatePageContent(page, index);

      return `
        <div class="print-page" data-page="${index + 1}">
          ${pageContent}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Executive Summary - Print View</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Work Sans', sans-serif;
            background-color: #f5f5f5;
          }

          @media print {
            body {
              background-color: #ffffff;
            }

            .print-page {
              page-break-after: always;
              page-break-inside: avoid;
              width: 8.5in;
              height: 11in;
              margin: 0;
              padding: 0.5in;
              background-color: #ffffff;
            }

            .print-page:last-child {
              page-break-after: auto;
            }

            .no-print {
              display: none !important;
            }
          }

          @media screen {
            .print-page {
              margin: 20px auto;
              width: 8.5in;
              min-height: 11in;
              padding: 0.5in;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              background-color: #ffffff;
            }

            .print-header {
              background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
              color: #ffffff;
              padding: 1.5rem 2rem;
              text-align: center;
            }

            .print-header h1 {
              margin: 0;
              font-size: 1.75rem;
              font-weight: 700;
            }

            .print-header p {
              margin: 0.5rem 0 0 0;
              font-size: 1rem;
              opacity: 0.9;
            }

            .print-footer {
              background-color: #1e293b;
              color: #ffffff;
              padding: 1.5rem 2rem;
              text-align: center;
              margin-top: 2rem;
            }

            .print-btn {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: #ffffff;
              border: none;
              padding: 0.875rem 2rem;
              border-radius: 8px;
              font-size: 1rem;
              font-weight: 600;
              cursor: pointer;
              margin: 1.5rem;
              transition: all 0.2s;
            }

            .print-btn:hover {
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
            }
          }
        </style>
      </head>
      <body>
        <div class="print-header no-print">
          <h1>Executive Summary</h1>
          <p>${pages.length} pages • ${new Date().toLocaleDateString()}</p>
          <button class="print-btn" onclick="window.print()">🖨️ Print Document</button>
        </div>

        ${pagesHTML}

        <div class="print-footer no-print">
          <p>Generated by AI Roadmap Presentation System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get filename for export
   * @private
   */
  getFilename(extension) {
    const baseFilename = 'executive-summary';
    return `${baseFilename}.${extension}`;
  }

  /**
   * Progress indicator methods
   */

  showProgress(message, percent) {
    let modal = document.getElementById('export-progress-modal');

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'export-progress-modal';
      modal.className = 'export-progress-modal';
      modal.innerHTML = `
        <div class="export-progress-content">
          <div class="export-progress-spinner"></div>
          <div class="export-progress-message"></div>
          <div class="export-progress-bar">
            <div class="export-progress-fill"></div>
          </div>
          <div class="export-progress-percent"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.querySelector('.export-progress-message').textContent = message;
    modal.querySelector('.export-progress-fill').style.width = `${percent}%`;
    modal.querySelector('.export-progress-percent').textContent = `${Math.round(percent)}%`;
    modal.style.display = 'flex';
  }

  updateProgress(message, percent) {
    this.showProgress(message, percent);
  }

  hideProgress() {
    const modal = document.getElementById('export-progress-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Get export status
   */
  getStatus() {
    return {
      isExporting: this.isExporting,
      totalPages: this.documentViewer.pages.length
    };
  }
}
