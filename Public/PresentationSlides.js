/**
 * PresentationSlides Module
 * Renders AI-generated presentation slides in a collapsible format
 * Displays professional slide content with navigation
 */

import { CONFIG } from './config.js';

/**
 * PresentationSlides Class
 * Responsible for rendering and managing the presentation slides component
 */
export class PresentationSlides {
  /**
   * Creates a new PresentationSlides instance
   * @param {Object} slidesData - The presentation slides data from the API
   * @param {string} footerSVG - The SVG content for the header/footer decoration
   */
  constructor(slidesData, footerSVG) {
    this.slidesData = slidesData;
    this.footerSVG = footerSVG;
    this.isExpanded = true; // Default to expanded on load
    this.currentSlideIndex = 0;
    this.container = null;
  }

  /**
   * Renders the presentation slides component
   * @returns {HTMLElement} The rendered presentation slides container
   */
  render() {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'presentation-slides-container';
    this.container.id = 'presentationSlides';

    // Check if slides data exists
    if (!this.slidesData || !this.slidesData.slides || this.slidesData.slides.length === 0) {
      this.container.innerHTML = '<p class="slides-unavailable">Presentation slides not available for this chart.</p>';
      return this.container;
    }

    // Build header
    const header = this._buildHeader();
    this.container.appendChild(header);

    // Build content
    const content = this._buildContent();
    this.container.appendChild(content);

    return this.container;
  }

  /**
   * Builds the header section with title and toggle button
   * @private
   * @returns {HTMLElement} The header element
   */
  _buildHeader() {
    const header = document.createElement('div');
    header.className = 'slides-header';

    const title = document.createElement('h2');
    title.className = 'slides-title';
    title.innerHTML = '<span class="icon">📊</span> Presentation Slides';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'expand-toggle';
    toggleBtn.setAttribute('aria-label', 'Toggle slides');
    toggleBtn.innerHTML = `<span class="chevron">${this.isExpanded ? '▼' : '▶'}</span>`;

    // Make entire header clickable
    header.addEventListener('click', () => this._toggleExpand());

    header.appendChild(title);
    header.appendChild(toggleBtn);

    return header;
  }

  /**
   * Builds the content section with all slides
   * @private
   * @returns {HTMLElement} The content element
   */
  _buildContent() {
    const content = document.createElement('div');
    content.className = 'slides-content';
    content.style.display = this.isExpanded ? 'block' : 'none';

    // Create slide viewer
    const slideViewer = document.createElement('div');
    slideViewer.className = 'slide-viewer';

    // Create slide display
    const slideDisplay = document.createElement('div');
    slideDisplay.className = 'slide-display';
    slideDisplay.id = 'currentSlide';

    // Render the first slide
    this._renderSlide(slideDisplay, this.currentSlideIndex);

    slideViewer.appendChild(slideDisplay);

    // Create navigation controls
    const navigation = this._buildNavigation();
    slideViewer.appendChild(navigation);

    content.appendChild(slideViewer);

    return content;
  }

  /**
   * Renders a specific slide
   * @private
   * @param {HTMLElement} container - The container to render the slide into
   * @param {number} index - The index of the slide to render
   */
  _renderSlide(container, index) {
    const slide = this.slidesData.slides[index];
    container.innerHTML = '';

    // Create swiper-slide structure matching the template
    const swiperSlide = document.createElement('div');
    swiperSlide.className = `swiper-slide slide-${slide.type}`;

    const slideContainer = document.createElement('div');
    slideContainer.className = 'slide-container';

    // Add slide number
    const slideNumber = document.createElement('div');
    slideNumber.className = 'slide-number';
    slideNumber.textContent = `${String(index + 1).padStart(2, '0')}`;

    // Render based on slide type
    switch (slide.type) {
      case 'title':
        this._renderTitleSlide(slideContainer, slide);
        break;
      case 'narrative':
        this._renderNarrativeSlide(slideContainer, slide);
        break;
      case 'drivers':
        this._renderDriversSlide(slideContainer, slide);
        break;
      case 'dependencies':
        this._renderDependenciesSlide(slideContainer, slide);
        break;
      case 'risks':
        this._renderRisksSlide(slideContainer, slide);
        break;
      case 'insights':
        this._renderInsightsSlide(slideContainer, slide);
        break;
      case 'simple':
        this._renderSimpleSlide(slideContainer, slide);
        break;
      default:
        this._renderSimpleSlide(slideContainer, slide);
    }

    slideContainer.appendChild(slideNumber);
    swiperSlide.appendChild(slideContainer);
    container.appendChild(swiperSlide);
  }

  /**
   * Renders a title slide
   * @private
   */
  _renderTitleSlide(container, slide) {
    const content = document.createElement('div');
    content.className = 'title-content';
    content.innerHTML = `
      <h1 class="main-title">${slide.title || 'AI-Powered Strategic Intelligence'}</h1>
      <div class="title-accent"></div>
      <p class="subtitle">${slide.subtitle || 'Strategic Intelligence Brief'}</p>
    `;
    container.appendChild(content);
  }

  /**
   * Renders a narrative slide
   * @private
   */
  _renderNarrativeSlide(container, slide) {
    const header = document.createElement('div');
    header.className = 'narrative-header';

    const title = document.createElement('h2');
    title.className = 'narrative-title';
    title.textContent = slide.title || 'Elevator Pitch';
    header.appendChild(title);

    const narrativeContent = document.createElement('div');
    narrativeContent.className = 'narrative-content';

    if (Array.isArray(slide.content)) {
      slide.content.forEach(paragraph => {
        const p = document.createElement('p');
        p.textContent = paragraph;
        narrativeContent.appendChild(p);
      });
    } else {
      const p = document.createElement('p');
      p.textContent = slide.content;
      narrativeContent.appendChild(p);
    }

    container.appendChild(header);
    container.appendChild(narrativeContent);
  }

  /**
   * Renders a drivers slide
   * @private
   */
  _renderDriversSlide(container, slide) {
    const header = document.createElement('div');
    header.className = 'drivers-header';

    const title = document.createElement('h2');
    title.className = 'drivers-title';
    title.textContent = slide.title || 'Key Strategic Drivers';
    header.appendChild(title);

    const driversList = document.createElement('div');
    driversList.className = 'drivers-list';

    if (slide.drivers && Array.isArray(slide.drivers)) {
      slide.drivers.forEach((driver, idx) => {
        const driverItem = document.createElement('div');
        driverItem.className = 'driver-item';
        driverItem.innerHTML = `
          <div class="driver-bullet">${idx + 1}</div>
          <div class="driver-content">
            <h3 class="driver-title">${driver.title}</h3>
            <p class="driver-description">${driver.description}</p>
          </div>
        `;
        driversList.appendChild(driverItem);
      });
    }

    container.appendChild(header);
    container.appendChild(driversList);
  }

  /**
   * Renders a dependencies slide
   * @private
   */
  _renderDependenciesSlide(container, slide) {
    const header = document.createElement('div');
    header.className = 'dependencies-header';

    const title = document.createElement('h2');
    title.className = 'dependencies-title';
    title.textContent = slide.title || 'Critical Dependencies';
    header.appendChild(title);

    const dependenciesFlow = document.createElement('div');
    dependenciesFlow.className = 'dependencies-flow';

    if (slide.dependencies && Array.isArray(slide.dependencies)) {
      slide.dependencies.forEach((dep, idx) => {
        const depItem = document.createElement('div');
        depItem.className = `dependency-item ${dep.criticality}`;
        depItem.innerHTML = `
          <h3 class="dependency-name">${dep.name}</h3>
          <span class="dependency-criticality criticality-${dep.criticalityLevel}">${dep.criticality}</span>
          <p class="dependency-impact">${dep.impact}</p>
          ${idx < slide.dependencies.length - 1 ? '<span class="dependency-arrow">→</span>' : ''}
        `;
        dependenciesFlow.appendChild(depItem);
      });
    }

    container.appendChild(header);
    container.appendChild(dependenciesFlow);
  }

  /**
   * Renders a risks slide as 3x3 matrix grid
   * @private
   */
  _renderRisksSlide(container, slide) {
    const header = document.createElement('div');
    header.className = 'risks-header';

    const title = document.createElement('h2');
    title.className = 'risks-title';
    title.textContent = slide.title || 'Strategic Risk Matrix';
    header.appendChild(title);

    // Create 3x3 risk matrix grid
    const riskMatrix = document.createElement('div');
    riskMatrix.className = 'risk-matrix';

    // Group risks by probability and impact for positioning
    const risksByCell = {};
    if (slide.risks && Array.isArray(slide.risks)) {
      slide.risks.forEach(risk => {
        const key = `${risk.probability}-${risk.impact}`;
        if (!risksByCell[key]) {
          risksByCell[key] = [];
        }
        risksByCell[key].push(risk);
      });
    }

    // Build matrix: 4 rows (header + 3 probability levels) x 4 columns (label + 3 impact levels)

    // Row 1: Column headers
    riskMatrix.appendChild(this._createMatrixLabel('')); // Empty top-left corner
    riskMatrix.appendChild(this._createMatrixLabel('Low'));
    riskMatrix.appendChild(this._createMatrixLabel('Medium'));
    riskMatrix.appendChild(this._createMatrixLabel('High'));

    // Row 2: High Probability
    riskMatrix.appendChild(this._createMatrixLabel('High'));
    riskMatrix.appendChild(this._createMatrixCell('high', 'low', risksByCell['high-low']));
    riskMatrix.appendChild(this._createMatrixCell('high', 'medium', risksByCell['high-medium']));
    riskMatrix.appendChild(this._createMatrixCell('high', 'high', risksByCell['high-high']));

    // Row 3: Medium Probability
    riskMatrix.appendChild(this._createMatrixLabel('Medium'));
    riskMatrix.appendChild(this._createMatrixCell('medium', 'low', risksByCell['medium-low']));
    riskMatrix.appendChild(this._createMatrixCell('medium', 'medium', risksByCell['medium-medium']));
    riskMatrix.appendChild(this._createMatrixCell('medium', 'high', risksByCell['medium-high']));

    // Row 4: Low Probability
    riskMatrix.appendChild(this._createMatrixLabel('Low'));
    riskMatrix.appendChild(this._createMatrixCell('low', 'low', risksByCell['low-low']));
    riskMatrix.appendChild(this._createMatrixCell('low', 'medium', risksByCell['low-medium']));
    riskMatrix.appendChild(this._createMatrixCell('low', 'high', risksByCell['low-high']));

    // Create wrapper for matrix and axis labels
    const matrixWrapper = document.createElement('div');
    matrixWrapper.style.position = 'relative';
    matrixWrapper.style.display = 'inline-block';
    matrixWrapper.style.margin = '0 auto';

    // Add axis labels
    const xAxisLabel = document.createElement('span');
    xAxisLabel.className = 'axis-label x-axis';
    xAxisLabel.textContent = 'Impact →';

    const yAxisLabel = document.createElement('span');
    yAxisLabel.className = 'axis-label y-axis';
    yAxisLabel.textContent = 'Probability';

    matrixWrapper.appendChild(riskMatrix);
    matrixWrapper.appendChild(xAxisLabel);
    matrixWrapper.appendChild(yAxisLabel);

    container.appendChild(header);
    container.appendChild(matrixWrapper);
  }

  /**
   * Creates a matrix label cell
   * @private
   */
  _createMatrixLabel(text) {
    const label = document.createElement('div');
    label.className = 'matrix-label';
    label.textContent = text;
    return label;
  }

  /**
   * Creates a matrix cell with risks
   * @private
   */
  _createMatrixCell(probability, impact, risks) {
    const cell = document.createElement('div');
    cell.className = `matrix-cell ${probability}-${impact}`;

    if (risks && risks.length > 0) {
      risks.forEach(risk => {
        const riskItem = document.createElement('div');
        riskItem.className = 'risk-item';
        riskItem.innerHTML = `<p class="risk-description">${risk.description}</p>`;
        cell.appendChild(riskItem);
      });
    }

    return cell;
  }

  /**
   * Renders an insights slide
   * @private
   */
  _renderInsightsSlide(container, slide) {
    const header = document.createElement('div');
    header.className = 'insights-header';

    const title = document.createElement('h2');
    title.className = 'insights-title';
    title.textContent = slide.title || 'Expert Conversation Points';
    header.appendChild(title);

    const insightsGrid = document.createElement('div');
    insightsGrid.className = 'insights-grid';

    if (slide.insights && Array.isArray(slide.insights)) {
      slide.insights.forEach(insight => {
        const insightCard = document.createElement('div');
        insightCard.className = 'insight-card';
        insightCard.innerHTML = `
          <span class="insight-category">${insight.category}</span>
          <p class="insight-text">${insight.text}</p>
        `;
        insightsGrid.appendChild(insightCard);
      });
    }

    container.appendChild(header);
    container.appendChild(insightsGrid);
  }

  /**
   * Renders a simple text slide
   * @private
   */
  _renderSimpleSlide(container, slide) {
    const content = document.createElement('div');
    content.className = 'simple-content';

    const header = document.createElement('h2');
    header.className = 'simple-title';
    header.textContent = slide.title || 'Summary';

    const textContent = document.createElement('div');
    textContent.className = 'simple-text';

    // Handle content as array or string for backwards compatibility
    if (Array.isArray(slide.content)) {
      slide.content.forEach(item => {
        const p = document.createElement('p');
        p.textContent = item;
        textContent.appendChild(p);
      });
    } else {
      const p = document.createElement('p');
      p.textContent = slide.content || slide.text || '';
      textContent.appendChild(p);
    }

    content.appendChild(header);
    content.appendChild(textContent);
    container.appendChild(content);
  }

  /**
   * Builds the navigation controls
   * @private
   * @returns {HTMLElement} The navigation element
   */
  _buildNavigation() {
    const nav = document.createElement('div');
    nav.className = 'slide-navigation';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'nav-btn prev-btn';
    prevBtn.innerHTML = '◀ Previous';
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._previousSlide();
    });

    const slideIndicator = document.createElement('div');
    slideIndicator.className = 'slide-indicator';
    slideIndicator.id = 'slideIndicator';
    slideIndicator.textContent = `${this.currentSlideIndex + 1} / ${this.slidesData.slides.length}`;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'nav-btn next-btn';
    nextBtn.innerHTML = 'Next ▶';
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._nextSlide();
    });

    nav.appendChild(prevBtn);
    nav.appendChild(slideIndicator);
    nav.appendChild(nextBtn);

    return nav;
  }

  /**
   * Navigates to the previous slide
   * @private
   */
  _previousSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      const slideDisplay = document.getElementById('currentSlide');
      const slideIndicator = document.getElementById('slideIndicator');

      if (slideDisplay) {
        this._renderSlide(slideDisplay, this.currentSlideIndex);
      }

      if (slideIndicator) {
        slideIndicator.textContent = `${this.currentSlideIndex + 1} / ${this.slidesData.slides.length}`;
      }
    }
  }

  /**
   * Navigates to the next slide
   * @private
   */
  _nextSlide() {
    if (this.currentSlideIndex < this.slidesData.slides.length - 1) {
      this.currentSlideIndex++;
      const slideDisplay = document.getElementById('currentSlide');
      const slideIndicator = document.getElementById('slideIndicator');

      if (slideDisplay) {
        this._renderSlide(slideDisplay, this.currentSlideIndex);
      }

      if (slideIndicator) {
        slideIndicator.textContent = `${this.currentSlideIndex + 1} / ${this.slidesData.slides.length}`;
      }
    }
  }

  /**
   * Toggles the expand/collapse state of the slides
   * @private
   */
  _toggleExpand() {
    this.isExpanded = !this.isExpanded;

    const content = this.container.querySelector('.slides-content');
    const chevron = this.container.querySelector('.chevron');

    if (content) {
      content.style.display = this.isExpanded ? 'block' : 'none';
    }

    if (chevron) {
      chevron.textContent = this.isExpanded ? '▼' : '▶';
    }
  }
}
