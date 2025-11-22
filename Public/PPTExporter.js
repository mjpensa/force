/**
 * PPTExporter.js
 *
 * Main export controller for PowerPoint presentations.
 * Orchestrates the export workflow: validation → rendering → download
 *
 * Part of the PPT-export-first architecture.
 * Ensures data integrity and formatting precision during export.
 */

import { validatePresentationData } from './SlideDataModel.js';
import { PPTRenderer } from './PPTRenderer.js';

export class PPTExporter {
  /**
   * Create a new PPTExporter instance
   * @param {Object} options - Exporter options
   */
  constructor(options = {}) {
    this.options = {
      validateBeforeExport: true,
      throwOnValidationError: false,
      progressCallback: null,
      ...options
    };

    this.renderer = null;
    this.isExporting = false;
  }

  /**
   * Export presentation data to PowerPoint
   * @param {Object} presentationData - Complete presentation data
   * @param {string} filename - Output filename (without extension)
   * @returns {Promise} - Resolves when export completes
   */
  async export(presentationData, filename = 'presentation') {
    if (this.isExporting) {
      throw new Error('Export already in progress');
    }

    this.isExporting = true;

    try {
      // Step 1: Validate data
      this._reportProgress('Validating presentation data...', 10);
      if (this.options.validateBeforeExport) {
        const validation = validatePresentationData(presentationData);
        if (!validation.valid) {
          const errorMsg = `Validation failed:\n${validation.errors.join('\n')}`;
          console.error('[PPTExporter]', errorMsg);

          if (this.options.throwOnValidationError) {
            throw new Error(errorMsg);
          } else {
            console.warn('[PPTExporter] Proceeding with invalid data');
          }
        }
      }

      // Step 2: Initialize renderer
      this._reportProgress('Initializing PowerPoint renderer...', 20);
      const theme = presentationData.theme || {};
      this.renderer = new PPTRenderer(theme);

      // Step 3: Create presentation
      this._reportProgress('Creating presentation structure...', 30);
      const metadata = presentationData.metadata || {};
      this.renderer.initializePresentation(metadata);

      // Step 4: Add slides
      this._reportProgress('Rendering slides...', 40);
      const slides = presentationData.slides || [];

      if (slides.length === 0) {
        throw new Error('No slides to export');
      }

      // Add slides with progress updates
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const progress = 40 + Math.round((i / slides.length) * 50);
        this._reportProgress(`Rendering slide ${i + 1} of ${slides.length}...`, progress);

        try {
          this.renderer.addSlide(slide, i + 1);
        } catch (error) {
          console.error(`[PPTExporter] Error rendering slide ${i + 1}:`, error);
          // Continue with other slides
        }
      }

      // Step 5: Export file
      this._reportProgress('Generating PowerPoint file...', 90);
      await this.renderer.export(filename);

      // Step 6: Complete
      this._reportProgress('Export complete!', 100);

      return {
        success: true,
        filename: `${filename}.pptx`,
        slideCount: slides.length
      };

    } catch (error) {
      console.error('[PPTExporter] Export failed:', error);
      this._reportProgress('Export failed', 0);
      throw error;

    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Export with custom rendering options
   * @param {Object} presentationData - Complete presentation data
   * @param {Object} exportOptions - Export-specific options
   * @returns {Promise} - Resolves when export completes
   */
  async exportWithOptions(presentationData, exportOptions = {}) {
    const {
      filename = 'presentation',
      includeNotes = true,
      slidesToExport = null, // null = all slides, or array of slide indices
      themOverrides = null
    } = exportOptions;

    // Clone data to avoid mutations
    const dataCopy = JSON.parse(JSON.stringify(presentationData));

    // Apply theme overrides if provided
    if (themOverrides) {
      dataCopy.theme = {
        ...dataCopy.theme,
        ...themOverrides
      };
    }

    // Filter slides if specific indices provided
    if (slidesToExport && Array.isArray(slidesToExport)) {
      dataCopy.slides = slidesToExport.map(index => dataCopy.slides[index]);
    }

    // Remove notes if not included
    if (!includeNotes) {
      dataCopy.slides.forEach(slide => {
        delete slide.notes;
      });
    }

    return this.export(dataCopy, filename);
  }

  /**
   * Export a single slide preview
   * @param {Object} slide - Single slide data
   * @param {Object} theme - Theme configuration
   * @param {string} filename - Output filename
   * @returns {Promise} - Resolves when export completes
   */
  async exportSlidePreview(slide, theme = {}, filename = 'slide-preview') {
    const presentationData = {
      metadata: {
        title: 'Slide Preview',
        author: 'AI Roadmap Generator'
      },
      theme: theme,
      slides: [slide]
    };

    return this.export(presentationData, filename);
  }

  /**
   * Validate presentation data without exporting
   * @param {Object} presentationData - Complete presentation data
   * @returns {Object} - Validation result
   */
  validate(presentationData) {
    return validatePresentationData(presentationData);
  }

  /**
   * Get export progress/status
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      isExporting: this.isExporting,
      hasRenderer: this.renderer !== null
    };
  }

  /**
   * Cancel ongoing export (if possible)
   */
  cancel() {
    if (this.isExporting) {
      this.isExporting = false;
      this._reportProgress('Export cancelled', 0);
      console.log('[PPTExporter] Export cancelled by user');
    }
  }

  /**
   * Report progress to callback if configured
   * @private
   */
  _reportProgress(message, percent) {
    if (typeof this.options.progressCallback === 'function') {
      this.options.progressCallback({
        message,
        percent,
        isComplete: percent >= 100,
        isFailed: percent === 0 && message.includes('failed')
      });
    }
  }

  /**
   * Static method: Quick export without instantiation
   * @param {Object} presentationData - Complete presentation data
   * @param {string} filename - Output filename
   * @returns {Promise} - Resolves when export completes
   */
  static async quickExport(presentationData, filename = 'presentation') {
    const exporter = new PPTExporter();
    return exporter.export(presentationData, filename);
  }

  /**
   * Static method: Export with progress tracking
   * @param {Object} presentationData - Complete presentation data
   * @param {string} filename - Output filename
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise} - Resolves when export completes
   */
  static async exportWithProgress(presentationData, filename, progressCallback) {
    const exporter = new PPTExporter({ progressCallback });
    return exporter.export(presentationData, filename);
  }
}

/**
 * Convenience function: Export presentation to PowerPoint
 * @param {Object} presentationData - Complete presentation data
 * @param {string} filename - Output filename (without extension)
 * @returns {Promise} - Resolves when download completes
 */
export async function exportToPowerPoint(presentationData, filename = 'presentation') {
  return PPTExporter.quickExport(presentationData, filename);
}

/**
 * Convenience function: Export with progress dialog
 * @param {Object} presentationData - Complete presentation data
 * @param {string} filename - Output filename
 * @returns {Promise} - Resolves when download completes
 */
export async function exportWithProgressDialog(presentationData, filename = 'presentation') {
  // Create simple progress overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const progressBox = document.createElement('div');
  progressBox.style.cssText = `
    background: white;
    padding: 2rem;
    border-radius: 8px;
    min-width: 400px;
    text-align: center;
  `;

  const messageEl = document.createElement('div');
  messageEl.style.cssText = `
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #1e293b;
  `;
  messageEl.textContent = 'Preparing export...';

  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    width: 100%;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
  `;

  const progressFill = document.createElement('div');
  progressFill.style.cssText = `
    height: 100%;
    background: #3b82f6;
    width: 0%;
    transition: width 0.3s ease;
  `;

  const percentEl = document.createElement('div');
  percentEl.style.cssText = `
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #64748b;
  `;
  percentEl.textContent = '0%';

  progressBar.appendChild(progressFill);
  progressBox.appendChild(messageEl);
  progressBox.appendChild(progressBar);
  progressBox.appendChild(percentEl);
  overlay.appendChild(progressBox);
  document.body.appendChild(overlay);

  try {
    const result = await PPTExporter.exportWithProgress(
      presentationData,
      filename,
      (progress) => {
        messageEl.textContent = progress.message;
        progressFill.style.width = `${progress.percent}%`;
        percentEl.textContent = `${progress.percent}%`;

        if (progress.isComplete) {
          messageEl.style.color = '#10b981';
        } else if (progress.isFailed) {
          messageEl.style.color = '#dc2626';
        }
      }
    );

    // Keep overlay visible for 1 second to show completion
    await new Promise(resolve => setTimeout(resolve, 1000));

    return result;

  } finally {
    document.body.removeChild(overlay);
  }
}

export default PPTExporter;
