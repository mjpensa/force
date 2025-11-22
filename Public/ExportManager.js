/**
 * ExportManager.js
 *
 * Handles multiple export formats for presentations.
 * Features:
 * - PDF export (full presentation)
 * - PNG export (current slide or all slides)
 * - Print-optimized view
 * - Export progress indicators
 *
 * Part of Phase 3: Enhanced Export Capabilities
 */

export class ExportManager {
  /**
   * Create a new ExportManager instance
   * @param {PresentationSlides} presentation - Reference to PresentationSlides instance
   */
  constructor(presentation) {
    this.presentation = presentation;
    this.isExporting = false;
  }

  /**
   * Export entire presentation as PDF
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
        orientation: 'landscape',
        unit: 'in',
        format: [10, 5.625] // 16:9 aspect ratio
      });

      const slides = this.presentation.presentationData.slides;
      const totalSlides = slides.length;

      for (let i = 0; i < totalSlides; i++) {
        this.updateProgress(
          `Rendering slide ${i + 1} of ${totalSlides}...`,
          ((i / totalSlides) * 90) // Reserve 10% for final processing
        );

        // Render slide to temporary container
        const slideHTML = await this.renderSlideForExport(slides[i], i);

        // Capture as image using html2canvas
        const canvas = await this.captureSlideAsCanvas(slideHTML);

        // Add to PDF
        const imgData = canvas.toDataURL('image/png');

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'PNG', 0, 0, 10, 5.625);

        // Cleanup temporary container
        slideHTML.remove();
      }

      this.updateProgress('Generating PDF file...', 95);

      // Save PDF
      const filename = this.getFilename('pdf');
      pdf.save(filename);

      this.updateProgress('PDF export complete!', 100);

      setTimeout(() => {
        this.hideProgress();
      }, 1500);

      console.log('[ExportManager] PDF exported successfully:', filename);
    } catch (error) {
      console.error('[ExportManager] PDF export failed:', error);
      this.hideProgress();
      alert(`PDF export failed: ${error.message}\n\nPlease try again.`);
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Export current slide as PNG
   */
  async exportCurrentSlideToPNG() {
    if (this.isExporting) {
      alert('Export already in progress. Please wait...');
      return;
    }

    this.isExporting = true;
    this.showProgress('Exporting current slide to PNG...', 50);

    try {
      const currentSlideEl = document.getElementById('slideContent');
      if (!currentSlideEl) {
        throw new Error('Current slide element not found');
      }

      // Capture slide as canvas
      const canvas = await this.captureSlideAsCanvas(currentSlideEl);

      // Download as PNG
      const slideNumber = this.presentation.currentSlideIndex + 1;
      const filename = this.getFilename(`slide-${slideNumber}.png`);
      this.downloadCanvas(canvas, filename);

      this.updateProgress('PNG export complete!', 100);

      setTimeout(() => {
        this.hideProgress();
      }, 1000);

      console.log('[ExportManager] Current slide exported as PNG:', filename);
    } catch (error) {
      console.error('[ExportManager] PNG export failed:', error);
      this.hideProgress();
      alert(`PNG export failed: ${error.message}\n\nPlease try again.`);
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Export all slides as individual PNGs
   */
  async exportAllSlidesToPNG() {
    if (this.isExporting) {
      alert('Export already in progress. Please wait...');
      return;
    }

    const confirmExport = confirm(
      `This will download ${this.presentation.presentationData.slides.length} PNG files.\n\nContinue?`
    );

    if (!confirmExport) {
      return;
    }

    this.isExporting = true;
    this.showProgress('Preparing to export all slides...', 0);

    try {
      const slides = this.presentation.presentationData.slides;
      const totalSlides = slides.length;

      for (let i = 0; i < totalSlides; i++) {
        this.updateProgress(
          `Exporting slide ${i + 1} of ${totalSlides}...`,
          (i / totalSlides) * 100
        );

        // Render slide to temporary container
        const slideHTML = await this.renderSlideForExport(slides[i], i);

        // Capture as canvas
        const canvas = await this.captureSlideAsCanvas(slideHTML);

        // Download with delay to avoid browser blocking
        await this.downloadCanvasWithDelay(canvas, this.getFilename(`slide-${i + 1}.png`), i * 500);

        // Cleanup
        slideHTML.remove();
      }

      this.updateProgress('All slides exported!', 100);

      setTimeout(() => {
        this.hideProgress();
      }, 1500);

      console.log('[ExportManager] All slides exported as PNG');
    } catch (error) {
      console.error('[ExportManager] PNG export failed:', error);
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

      console.log('[ExportManager] Print view opened');
    } catch (error) {
      console.error('[ExportManager] Print view failed:', error);
      alert(`Print view failed: ${error.message}\n\nPlease try again.`);
    }
  }

  /**
   * Render slide to temporary container for export
   * @private
   */
  async renderSlideForExport(slide, slideIndex) {
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 1920px;
      height: 1080px;
      background-color: #ffffff;
    `;

    document.body.appendChild(tempContainer);

    // Render slide using WebRenderer
    const totalSlides = this.presentation.presentationData.slides.length;
    const renderedSlide = this.presentation.renderer.render(slide, slideIndex + 1, totalSlides);

    tempContainer.appendChild(renderedSlide);

    // Small delay to ensure rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    return tempContainer;
  }

  /**
   * Capture slide element as canvas
   * @private
   */
  async captureSlideAsCanvas(slideElement) {
    if (typeof html2canvas === 'undefined') {
      throw new Error('html2canvas library not loaded. Please check CDN connection.');
    }

    return await html2canvas(slideElement, {
      width: 1920,
      height: 1080,
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
    const slides = this.presentation.presentationData.slides;
    const metadata = this.presentation.presentationData.metadata;

    // Render all slides
    const slidesHTML = slides.map((slide, index) => {
      const renderer = this.presentation.renderer;
      const renderedSlide = renderer.render(slide, index + 1, slides.length);

      // Convert to HTML string
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(renderedSlide);

      return `
        <div class="print-slide" data-slide="${index + 1}">
          ${tempDiv.innerHTML}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${metadata?.title || 'Presentation'} - Print View</title>
        <link rel="stylesheet" href="style.css">
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

            .print-slide {
              page-break-after: always;
              page-break-inside: avoid;
              width: 10in;
              height: 5.625in;
              margin: 0;
              padding: 0;
              background-color: #ffffff;
            }

            .print-slide:last-child {
              page-break-after: auto;
            }

            .no-print {
              display: none !important;
            }
          }

          @media screen {
            .print-slide {
              margin: 20px auto;
              width: 1000px;
              height: 562.5px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              background-color: #ffffff;
            }

            .print-header {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
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
          <h1>${metadata?.title || 'Presentation'}</h1>
          <p>${slides.length} slides • ${metadata?.author || ''} • ${new Date().toLocaleDateString()}</p>
          <button class="print-btn" onclick="window.print()">🖨️ Print Presentation</button>
        </div>

        ${slidesHTML}

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
    const baseFilename = this.presentation.presentationData.metadata?.title || 'presentation';
    const sanitized = baseFilename.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    return `${sanitized}.${extension}`;
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
      totalSlides: this.presentation.presentationData.slides.length
    };
  }
}
