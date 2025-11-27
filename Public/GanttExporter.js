/**
 * GanttExporter - Handles chart export functionality
 * Extracted from GanttChart.js for modularity
 * Contains: PNG export, SVG export, URL copy, notifications
 */

export class GanttExporter {
  constructor(chartContainer, callbacks = {}) {
    this.chartContainer = chartContainer;
    this.onAnnounce = callbacks.onAnnounce || (() => {});
  }

  /**
   * Initialize all export listeners
   */
  initializeListeners() {
    this._addExportListener();
    this._addSvgExportListener();
    this._addCopyUrlListener();
  }

  /**
   * PNG export listener
   */
  _addExportListener() {
    const exportBtn = document.getElementById('export-png-btn');
    if (!exportBtn || !this.chartContainer) return;

    exportBtn.addEventListener('click', async () => {
      const startTime = performance.now();
      exportBtn.textContent = 'Exporting...';
      exportBtn.disabled = true;

      const loadingOverlay = this._createExportLoadingOverlay();
      document.body.appendChild(loadingOverlay);

      try {
        await new Promise(resolve => requestAnimationFrame(resolve));

        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        const canvas = await html2canvas(this.chartContainer, {
          useCORS: true,
          logging: false,
          scale: 2,
          allowTaint: false,
          backgroundColor: null,
          scrollY: -scrollY,
          scrollX: -scrollX,
          windowWidth: this.chartContainer.scrollWidth,
          windowHeight: this.chartContainer.scrollHeight,
          width: this.chartContainer.scrollWidth,
          height: this.chartContainer.scrollHeight
        });

        const link = document.createElement('a');
        link.download = 'gantt-chart.png';
        link.href = canvas.toDataURL('image/png');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        exportBtn.textContent = 'Export as PNG';
        exportBtn.disabled = false;
        document.body.removeChild(loadingOverlay);
      } catch (err) {
        exportBtn.textContent = 'Export as PNG';
        exportBtn.disabled = false;
        if (loadingOverlay.parentNode) {
          document.body.removeChild(loadingOverlay);
        }
        alert('Error exporting chart. See console for details.');
      }
    });
  }

  /**
   * SVG export listener
   */
  _addSvgExportListener() {
    const exportBtn = document.getElementById('export-svg-btn');
    if (!exportBtn || !this.chartContainer) return;

    exportBtn.addEventListener('click', async () => {
      exportBtn.textContent = 'Exporting...';
      exportBtn.disabled = true;

      const loadingOverlay = this._createExportLoadingOverlay('Generating vector SVG...');
      document.body.appendChild(loadingOverlay);

      try {
        await new Promise(resolve => requestAnimationFrame(resolve));

        const bbox = this.chartContainer.getBoundingClientRect();
        const width = bbox.width;
        const height = bbox.height;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        const canvas = await html2canvas(this.chartContainer, {
          useCORS: true,
          logging: false,
          scale: 2,
          allowTaint: false,
          backgroundColor: null,
          scrollY: -scrollY,
          scrollX: -scrollX,
          windowWidth: this.chartContainer.scrollWidth,
          windowHeight: this.chartContainer.scrollHeight,
          width: this.chartContainer.scrollWidth,
          height: this.chartContainer.scrollHeight
        });

        const imageData = canvas.toDataURL('image/png');
        const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>Gantt Chart Export</title>
  <desc>AI-generated Gantt chart exported as SVG with embedded raster image</desc>
  <image x="0" y="0" width="${width}" height="${height}"
         xlink:href="${imageData}"
         preserveAspectRatio="xMidYMid meet"/>
</svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = 'gantt-chart.svg';
        link.href = url;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        exportBtn.textContent = 'Export as SVG';
        exportBtn.disabled = false;
        document.body.removeChild(loadingOverlay);
      } catch (err) {
        exportBtn.textContent = 'Export as SVG';
        exportBtn.disabled = false;
        if (loadingOverlay.parentNode) {
          document.body.removeChild(loadingOverlay);
        }
        alert('Error exporting chart as SVG. See console for details.');
      }
    });
  }

  /**
   * Copy URL listener
   */
  _addCopyUrlListener() {
    const copyUrlBtn = document.getElementById('copy-url-btn');
    if (!copyUrlBtn) return;

    copyUrlBtn.addEventListener('click', async () => {
      const currentUrl = window.location.href;

      try {
        await navigator.clipboard.writeText(currentUrl);

        const originalText = copyUrlBtn.textContent;
        copyUrlBtn.textContent = '✓ URL Copied!';
        copyUrlBtn.style.backgroundColor = '#50AF7B';

        this.showNotification('Chart URL copied to clipboard! Share this link to give others access to this chart.', 'success');
        this.onAnnounce('Chart URL copied to clipboard');

        setTimeout(() => {
          copyUrlBtn.textContent = originalText;
          copyUrlBtn.style.backgroundColor = '';
        }, 2000);
      } catch (err) {
        alert(`Copy this URL to share:\n\n${currentUrl}`);
        this.showNotification('Could not copy URL automatically. Please copy it from the address bar.', 'error');
      }
    });
  }

  /**
   * Create loading overlay for export operations
   */
  _createExportLoadingOverlay(messageText = 'Generating high-resolution PNG...') {
    const overlay = document.createElement('div');
    overlay.className = 'export-loading-overlay';

    const spinner = document.createElement('div');
    spinner.className = 'export-spinner';

    const message = document.createElement('div');
    message.className = 'export-loading-message';
    message.textContent = messageText;

    overlay.appendChild(spinner);
    overlay.appendChild(message);

    return overlay;
  }

  /**
   * Show notification toast
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `chart-notification chart-notification-${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? '#50AF7B' : type === 'error' ? '#DC3545' : '#1976D2'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      max-width: 400px;
      font-family: 'Work Sans', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
}
