/**
 * PresenterMode.js
 *
 * Manages dual-window presenter mode with synchronization.
 * Opens a separate presenter window with:
 * - Current slide (large preview)
 * - Next slide (small preview)
 * - Speaker notes
 * - Elapsed time timer
 * - Navigation controls
 *
 * Part of Phase 1: Presenter Mode Enhancement
 */

export class PresenterMode {
  /**
   * Create a new PresenterMode instance
   * @param {PresentationSlides} presentation - Reference to PresentationSlides instance
   */
  constructor(presentation) {
    this.presentation = presentation;
    this.presenterWindow = null;
    this.currentSlideIndex = 0;
    this.startTime = null;
    this.timerInterval = null;
    this.isActive = false;

    // Bind methods for event listeners
    this._handleMessage = this._handleMessage.bind(this);
    this._handleSlideChange = this._handleSlideChange.bind(this);
    this._handleBeforeUnload = this._handleBeforeUnload.bind(this);
  }

  /**
   * Launch presenter mode - opens new window
   */
  launch() {
    if (this.isActive) {
      console.warn('[PresenterMode] Already active');
      return;
    }

    // Calculate window position (try to open on second monitor)
    const width = 1200;
    const height = 700;
    const left = window.screenX + window.outerWidth; // Position on second monitor
    const top = window.screenY;

    // Open presenter window
    this.presenterWindow = window.open(
      'presenter-view.html',
      'presenter-view',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (!this.presenterWindow) {
      alert('Please allow pop-ups to use Presenter Mode.\n\nCheck your browser settings and try again.');
      return;
    }

    this.isActive = true;
    this.startTime = Date.now();
    this.currentSlideIndex = this.presentation.currentSlideIndex;

    // Setup event handlers
    this.setupMessageHandlers();
    this.startTimer();

    // Track window close
    const checkWindowClosed = setInterval(() => {
      if (this.presenterWindow && this.presenterWindow.closed) {
        clearInterval(checkWindowClosed);
        this.cleanup();
      }
    }, 1000);

    console.log('[PresenterMode] Presenter mode launched');
  }

  /**
   * Setup postMessage communication between windows
   */
  setupMessageHandlers() {
    // Listen for messages from presenter window
    window.addEventListener('message', this._handleMessage);

    // Listen for slide changes in main window
    // We'll hook into the presentation's navigation methods
    this._originalGoToSlide = this.presentation._goToSlide.bind(this.presentation);
    this.presentation._goToSlide = (index) => {
      this._originalGoToSlide(index);
      this._handleSlideChange(index);
    };

    // Cleanup on main window close
    window.addEventListener('beforeunload', this._handleBeforeUnload);

    console.log('[PresenterMode] Message handlers setup complete');
  }

  /**
   * Handle messages from presenter window
   * @private
   */
  _handleMessage(event) {
    // Security: Verify message is from our presenter window
    if (event.source !== this.presenterWindow) return;

    console.log('[PresenterMode] Received message:', event.data.type);

    switch (event.data.type) {
      case 'NAVIGATE':
        this.navigateToSlide(event.data.slideIndex);
        break;
      case 'RESET_TIMER':
        this.resetTimer();
        break;
      case 'PRESENTER_READY':
        console.log('[PresenterMode] Presenter window ready, sending initial sync');
        this.syncPresenterWindow();
        break;
      default:
        console.warn('[PresenterMode] Unknown message type:', event.data.type);
    }
  }

  /**
   * Handle slide changes in main window
   * @private
   */
  _handleSlideChange(newIndex) {
    this.currentSlideIndex = newIndex;
    this.syncPresenterWindow();
  }

  /**
   * Handle main window close
   * @private
   */
  _handleBeforeUnload() {
    this.cleanup();
  }

  /**
   * Sync data to presenter window
   */
  syncPresenterWindow() {
    if (!this.presenterWindow || this.presenterWindow.closed) {
      this.cleanup();
      return;
    }

    const slides = this.presentation.presentationData.slides;
    const currentSlide = slides[this.currentSlideIndex];
    const nextSlide = slides[this.currentSlideIndex + 1] || null;

    // Render slides to HTML
    const currentSlideHTML = this._renderSlideHTML(currentSlide, this.currentSlideIndex);
    const nextSlideHTML = nextSlide ? this._renderSlideHTML(nextSlide, this.currentSlideIndex + 1) : null;

    // Send sync message
    this.presenterWindow.postMessage({
      type: 'SYNC',
      data: {
        currentSlideIndex: this.currentSlideIndex,
        currentSlide: currentSlideHTML,
        nextSlide: nextSlideHTML,
        notes: currentSlide.notes || 'No notes for this slide',
        totalSlides: slides.length,
        elapsedTime: this.getElapsedTime(),
        metadata: this.presentation.presentationData.metadata
      }
    }, '*');
  }

  /**
   * Navigate to specific slide
   */
  navigateToSlide(slideIndex) {
    const slides = this.presentation.presentationData.slides;

    // Validate index
    if (slideIndex < 0 || slideIndex >= slides.length) {
      console.warn('[PresenterMode] Invalid slide index:', slideIndex);
      return;
    }

    // Update main window
    this.presentation._goToSlide(slideIndex);
    this.currentSlideIndex = slideIndex;
  }

  /**
   * Timer management
   */
  startTimer() {
    // Update every second
    this.timerInterval = setInterval(() => {
      if (this.presenterWindow && !this.presenterWindow.closed) {
        // Only send timer updates (lightweight)
        this.presenterWindow.postMessage({
          type: 'TIMER_UPDATE',
          data: {
            elapsedTime: this.getElapsedTime()
          }
        }, '*');
      }
    }, 1000);
  }

  resetTimer() {
    this.startTime = Date.now();
    this.syncPresenterWindow();
    console.log('[PresenterMode] Timer reset');
  }

  getElapsedTime() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000); // seconds
  }

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Render slide to HTML string (for postMessage)
   * @private
   */
  _renderSlideHTML(slide, slideIndex) {
    if (!slide) {
      return '<div class="slide-placeholder"><p>No slide</p></div>';
    }

    try {
      // Use the presentation's WebRenderer to generate HTML
      const totalSlides = this.presentation.presentationData.slides.length;
      const renderedSlide = this.presentation.renderer.render(slide, slideIndex + 1, totalSlides);

      // Convert DOM element to HTML string
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(renderedSlide.cloneNode(true));

      return tempDiv.innerHTML;
    } catch (error) {
      console.error('[PresenterMode] Error rendering slide:', error);
      return `<div class="slide-placeholder"><p>Error rendering slide</p></div>`;
    }
  }

  /**
   * Cleanup on exit
   */
  cleanup() {
    console.log('[PresenterMode] Cleaning up...');

    // Clear timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Close presenter window
    if (this.presenterWindow && !this.presenterWindow.closed) {
      this.presenterWindow.close();
    }
    this.presenterWindow = null;

    // Remove event listeners
    window.removeEventListener('message', this._handleMessage);
    window.removeEventListener('beforeunload', this._handleBeforeUnload);

    // Restore original navigation method
    if (this._originalGoToSlide) {
      this.presentation._goToSlide = this._originalGoToSlide;
      this._originalGoToSlide = null;
    }

    this.isActive = false;
    console.log('[PresenterMode] Cleanup complete');
  }

  /**
   * Check if presenter mode is active
   */
  isRunning() {
    return this.isActive && this.presenterWindow && !this.presenterWindow.closed;
  }

  /**
   * Get current presenter mode status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      currentSlideIndex: this.currentSlideIndex,
      elapsedTime: this.getElapsedTime(),
      elapsedTimeFormatted: this.formatTime(this.getElapsedTime())
    };
  }
}
