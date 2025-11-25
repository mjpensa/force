/**
 * SlidesView Component
 * Phase 3: Presentation mode for generated slides
 *
 * Features:
 * - Slide rendering with multiple layouts (title, bullets, content, quote)
 * - Navigation controls (prev/next buttons, keyboard shortcuts)
 * - Slide counter and progress indicator
 * - Thumbnail navigator for quick jumping
 * - Fullscreen mode
 * - Keyboard shortcuts (arrow keys, space, Esc)
 */

export class SlidesView {
  /**
   * @param {object} slidesData - Slides data from API
   * @param {string} sessionId - Session ID for data fetching
   */
  constructor(slidesData = null, sessionId = null) {
    this.slidesData = slidesData;
    this.sessionId = sessionId;
    this.currentSlide = 0;
    this.isFullscreen = false;
    this.container = null;
    this.slideElement = null;
    this.keyboardHandler = null;
  }

  /**
   * Render the slides view
   * @returns {HTMLElement} Container element
   */
  render() {
    this.container = document.createElement('div');
    this.container.className = 'slides-view';

    if (!this.slidesData || !this.slidesData.slides || this.slidesData.slides.length === 0) {
      this.container.appendChild(this._renderEmptyState());
      return this.container;
    }

    // Create main structure
    const slidesContainer = document.createElement('div');
    slidesContainer.className = 'slides-container';

    // Slide display area
    const slideDisplay = document.createElement('div');
    slideDisplay.className = 'slide-display';
    this.slideElement = this._renderSlide(this.currentSlide);
    slideDisplay.appendChild(this.slideElement);

    // Navigation controls
    const controls = this._renderControls();

    // Thumbnail navigator
    const thumbnails = this._renderThumbnails();

    // Keyboard hint
    const keyboardHint = this._renderKeyboardHint();

    // Assemble view
    slidesContainer.appendChild(slideDisplay);
    slidesContainer.appendChild(controls);
    slidesContainer.appendChild(thumbnails);
    slidesContainer.appendChild(keyboardHint);

    this.container.appendChild(slidesContainer);

    // Setup keyboard navigation
    this._setupKeyboardNavigation();

    return this.container;
  }

  /**
   * Render a single slide
   * @param {number} index - Slide index
   * @returns {HTMLElement} Slide element
   */
  _renderSlide(index) {
    const slide = this.slidesData.slides[index];
    const slideEl = document.createElement('div');
    slideEl.className = 'slide';
    slideEl.setAttribute('data-slide-type', slide.type);
    slideEl.setAttribute('data-slide-index', index);

    const content = document.createElement('div');
    content.className = 'slide-content';

    switch (slide.type) {
      // Title variants
      case 'title':
      case 'titleVariantA':
      case 'titleVariantB':
      case 'sectionDivider':
      case 'section':
        content.appendChild(this._renderTitleSlide(slide));
        break;
      case 'titleWithImage':
        content.appendChild(this._renderTitleWithImageSlide(slide));
        break;

      // Bullet variants
      case 'bullets':
      case 'bulletsFull':
        content.appendChild(this._renderBulletsSlide(slide));
        break;

      // Content variants
      case 'content':
        content.appendChild(this._renderContentSlide(slide));
        break;
      case 'contentMultiColumn':
        content.appendChild(this._renderContentMultiColumnSlide(slide));
        break;
      case 'contentWithImage':
        content.appendChild(this._renderContentWithImageSlide(slide));
        break;

      // Quote variants
      case 'quote':
        content.appendChild(this._renderQuoteSlide(slide));
        break;
      case 'quoteTwoColumn':
        content.appendChild(this._renderQuoteTwoColumnSlide(slide));
        break;
      case 'quoteWithMetrics':
      case 'quoteDataA':
      case 'quoteDataB':
        content.appendChild(this._renderQuoteWithMetricsSlide(slide));
        break;

      // Grid layouts
      case 'cardGrid':
        content.appendChild(this._renderCardGridSlide(slide));
        break;
      case 'featureGrid':
      case 'featureGridRed':
        content.appendChild(this._renderFeatureGridSlide(slide));
        break;

      // Process/Steps
      case 'steps':
      case 'process':
      case 'processSteps5':
      case 'processStepsAlt':
        content.appendChild(this._renderProcessStepsSlide(slide));
        break;
      case 'stepsVertical':
      case 'processStepsVertical':
        content.appendChild(this._renderStepsVerticalSlide(slide));
        break;

      // Timeline variants
      case 'timeline':
      case 'timelineCards':
      case 'timelineCardsAlt':
        content.appendChild(this._renderTimelineCardsSlide(slide));
        break;
      case 'timelinePhases':
        content.appendChild(this._renderTimelinePhasesSlide(slide));
        break;
      case 'timelineNumbered':
      case 'timelineNumberedMarkers':
        content.appendChild(this._renderTimelineNumberedSlide(slide));
        break;

      // Rollout variants
      case 'rolloutGrid':
        content.appendChild(this._renderRolloutGridSlide(slide));
        break;
      case 'rolloutTimeline':
        content.appendChild(this._renderRolloutTimelineSlide(slide));
        break;
      case 'rolloutDescription':
        content.appendChild(this._renderRolloutDescriptionSlide(slide));
        break;

      // Data displays
      case 'table':
      case 'dataTable':
        content.appendChild(this._renderTableSlide(slide));
        break;
      case 'ganttChart':
      case 'gantt':
        content.appendChild(this._renderGanttChartSlide(slide));
        break;
      case 'dualChart':
        content.appendChild(this._renderDualChartSlide(slide));
        break;

      // Navigation
      case 'tableOfContents':
      case 'toc':
        content.appendChild(this._renderTableOfContentsSlide(slide));
        break;
      case 'contentsNav':
        content.appendChild(this._renderContentsNavSlide(slide));
        break;

      // Closing slides
      case 'thankYou':
      case 'thankYouAlt':
        content.appendChild(this._renderThankYouSlide(slide));
        break;

      default:
        // Intelligent fallback based on available data
        content.appendChild(this._renderFallbackSlide(slide));
    }

    slideEl.appendChild(content);
    return slideEl;
  }

  /**
   * Render title slide layout
   */
  _renderTitleSlide(slide) {
    const fragment = document.createDocumentFragment();

    const title = document.createElement('h1');
    title.className = 'slide-title';
    title.textContent = slide.title;
    fragment.appendChild(title);

    if (slide.subtitle) {
      const subtitle = document.createElement('p');
      subtitle.className = 'slide-subtitle';
      subtitle.textContent = slide.subtitle;
      fragment.appendChild(subtitle);
    }

    return fragment;
  }

  /**
   * Render bullets slide layout
   */
  _renderBulletsSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    if (slide.bullets && slide.bullets.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'slide-bullets';

      slide.bullets.forEach(bullet => {
        const li = document.createElement('li');
        li.textContent = bullet;
        ul.appendChild(li);
      });

      fragment.appendChild(ul);
    }

    return fragment;
  }

  /**
   * Render content slide layout
   */
  _renderContentSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    if (slide.content) {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'slide-text';
      // Split by newlines and create paragraphs
      const paragraphs = slide.content.split('\n\n');
      paragraphs.forEach(para => {
        if (para.trim()) {
          const p = document.createElement('p');
          p.textContent = para.trim();
          contentDiv.appendChild(p);
        }
      });
      fragment.appendChild(contentDiv);
    }

    return fragment;
  }

  /**
   * Render quote slide layout
   */
  _renderQuoteSlide(slide) {
    const fragment = document.createDocumentFragment();

    if (slide.quote) {
      const blockquote = document.createElement('blockquote');
      blockquote.className = 'slide-quote';
      blockquote.textContent = slide.quote;
      fragment.appendChild(blockquote);
    }

    if (slide.attribution) {
      const attribution = document.createElement('p');
      attribution.className = 'slide-attribution';
      attribution.textContent = `— ${slide.attribution}`;
      fragment.appendChild(attribution);
    }

    return fragment;
  }

  /**
   * Render title with image slide
   */
  _renderTitleWithImageSlide(slide) {
    const fragment = document.createDocumentFragment();

    const title = document.createElement('h1');
    title.className = 'slide-title';
    title.textContent = slide.title;
    fragment.appendChild(title);

    if (slide.subtitle) {
      const subtitle = document.createElement('p');
      subtitle.className = 'slide-subtitle';
      subtitle.textContent = slide.subtitle;
      fragment.appendChild(subtitle);
    }

    if (slide.imageUrl) {
      const imageContainer = document.createElement('div');
      imageContainer.className = 'slide-image-container';
      const img = document.createElement('img');
      img.src = slide.imageUrl;
      img.alt = slide.title || '';
      img.className = 'slide-image';
      imageContainer.appendChild(img);
      fragment.appendChild(imageContainer);
    }

    return fragment;
  }

  /**
   * Render multi-column content slide
   */
  _renderContentMultiColumnSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const columns = document.createElement('div');
    columns.className = 'slide-columns';

    // Handle columns array or single content
    const columnData = slide.columns || [{ content: slide.content }];
    columnData.forEach(col => {
      const column = document.createElement('div');
      column.className = 'slide-column';
      if (col.title) {
        const colTitle = document.createElement('h3');
        colTitle.className = 'slide-column-title';
        colTitle.textContent = col.title;
        column.appendChild(colTitle);
      }
      if (col.content) {
        const colContent = document.createElement('p');
        colContent.className = 'slide-column-content';
        colContent.textContent = col.content;
        column.appendChild(colContent);
      }
      columns.appendChild(column);
    });

    fragment.appendChild(columns);
    return fragment;
  }

  /**
   * Render content with image slide
   */
  _renderContentWithImageSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const layout = document.createElement('div');
    layout.className = 'slide-content-image-layout';

    if (slide.content) {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'slide-text';
      const p = document.createElement('p');
      p.textContent = slide.content;
      contentDiv.appendChild(p);
      layout.appendChild(contentDiv);
    }

    if (slide.imageUrl) {
      const imageContainer = document.createElement('div');
      imageContainer.className = 'slide-image-container';
      const img = document.createElement('img');
      img.src = slide.imageUrl;
      img.alt = slide.title || '';
      img.className = 'slide-image';
      imageContainer.appendChild(img);
      layout.appendChild(imageContainer);
    }

    fragment.appendChild(layout);
    return fragment;
  }

  /**
   * Render two-column quote slide
   */
  _renderQuoteTwoColumnSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const columns = document.createElement('div');
    columns.className = 'slide-quote-columns';

    const quotes = slide.quotes || [];
    quotes.forEach(q => {
      const column = document.createElement('div');
      column.className = 'slide-quote-column';

      if (q.title) {
        const qTitle = document.createElement('h3');
        qTitle.className = 'slide-quote-title';
        qTitle.textContent = q.title;
        column.appendChild(qTitle);
      }

      const blockquote = document.createElement('blockquote');
      blockquote.className = 'slide-quote-text';
      blockquote.textContent = q.text || q.quote || '';
      column.appendChild(blockquote);

      if (q.attribution) {
        const attr = document.createElement('p');
        attr.className = 'slide-quote-attr';
        attr.textContent = `— ${q.attribution}`;
        column.appendChild(attr);
      }

      columns.appendChild(column);
    });

    fragment.appendChild(columns);
    return fragment;
  }

  /**
   * Render quote with metrics slide
   */
  _renderQuoteWithMetricsSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    if (slide.quote) {
      const blockquote = document.createElement('blockquote');
      blockquote.className = 'slide-quote';
      blockquote.textContent = slide.quote;
      fragment.appendChild(blockquote);
    }

    if (slide.attribution) {
      const attribution = document.createElement('p');
      attribution.className = 'slide-attribution';
      attribution.textContent = `— ${slide.attribution}`;
      fragment.appendChild(attribution);
    }

    const metrics = slide.metrics || slide.data || [];
    if (metrics.length > 0) {
      const metricsGrid = document.createElement('div');
      metricsGrid.className = 'slide-metrics-grid';

      metrics.forEach(m => {
        const metric = document.createElement('div');
        metric.className = 'slide-metric';

        const value = document.createElement('div');
        value.className = 'slide-metric-value';
        value.textContent = m.value;
        metric.appendChild(value);

        const label = document.createElement('div');
        label.className = 'slide-metric-label';
        label.textContent = m.label || m.title || '';
        metric.appendChild(label);

        metricsGrid.appendChild(metric);
      });

      fragment.appendChild(metricsGrid);
    }

    return fragment;
  }

  /**
   * Render card grid slide
   */
  _renderCardGridSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'slide-card-grid';

    const cards = slide.cards || [];
    cards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'slide-card';

      const cardTitle = document.createElement('h3');
      cardTitle.className = 'slide-card-title';
      cardTitle.textContent = card.title;
      cardEl.appendChild(cardTitle);

      if (card.content) {
        const cardContent = document.createElement('p');
        cardContent.className = 'slide-card-content';
        cardContent.textContent = card.content;
        cardEl.appendChild(cardContent);
      }

      grid.appendChild(cardEl);
    });

    fragment.appendChild(grid);
    return fragment;
  }

  /**
   * Render feature grid slide
   */
  _renderFeatureGridSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'slide-feature-grid';

    const features = slide.features || [];
    features.forEach((feature, index) => {
      const featureEl = document.createElement('div');
      featureEl.className = 'slide-feature';

      const icon = document.createElement('div');
      icon.className = 'slide-feature-icon';
      icon.textContent = feature.icon || (index + 1);
      featureEl.appendChild(icon);

      const featureTitle = document.createElement('h3');
      featureTitle.className = 'slide-feature-title';
      featureTitle.textContent = feature.title;
      featureEl.appendChild(featureTitle);

      if (feature.description) {
        const desc = document.createElement('p');
        desc.className = 'slide-feature-desc';
        desc.textContent = feature.description;
        featureEl.appendChild(desc);
      }

      grid.appendChild(featureEl);
    });

    fragment.appendChild(grid);
    return fragment;
  }

  /**
   * Render process steps slide (horizontal)
   */
  _renderProcessStepsSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'slide-process-steps';

    const steps = slide.steps || [];
    steps.forEach((step, index) => {
      const stepEl = document.createElement('div');
      stepEl.className = 'slide-process-step';

      const number = document.createElement('div');
      number.className = 'slide-step-number';
      number.textContent = index + 1;
      stepEl.appendChild(number);

      const stepTitle = document.createElement('h3');
      stepTitle.className = 'slide-step-title';
      stepTitle.textContent = step.title;
      stepEl.appendChild(stepTitle);

      if (step.description || step.content) {
        const desc = document.createElement('p');
        desc.className = 'slide-step-desc';
        desc.textContent = step.description || step.content;
        stepEl.appendChild(desc);
      }

      stepsContainer.appendChild(stepEl);

      // Add arrow between steps
      if (index < steps.length - 1) {
        const arrow = document.createElement('div');
        arrow.className = 'slide-step-arrow';
        arrow.textContent = '→';
        stepsContainer.appendChild(arrow);
      }
    });

    fragment.appendChild(stepsContainer);
    return fragment;
  }

  /**
   * Render vertical steps slide
   */
  _renderStepsVerticalSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'slide-steps-vertical';

    const steps = slide.steps || [];
    steps.forEach((step, index) => {
      const stepEl = document.createElement('div');
      stepEl.className = 'slide-step-vertical';

      const number = document.createElement('div');
      number.className = 'slide-step-number';
      number.textContent = index + 1;
      stepEl.appendChild(number);

      const content = document.createElement('div');
      content.className = 'slide-step-content';

      const stepTitle = document.createElement('h3');
      stepTitle.className = 'slide-step-title';
      stepTitle.textContent = step.title;
      content.appendChild(stepTitle);

      if (step.description || step.content) {
        const desc = document.createElement('p');
        desc.className = 'slide-step-desc';
        desc.textContent = step.description || step.content;
        content.appendChild(desc);
      }

      stepEl.appendChild(content);
      stepsContainer.appendChild(stepEl);
    });

    fragment.appendChild(stepsContainer);
    return fragment;
  }

  /**
   * Render timeline cards slide
   */
  _renderTimelineCardsSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const timeline = document.createElement('div');
    timeline.className = 'slide-timeline';

    const items = slide.items || slide.phases || [];
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'slide-timeline-card';

      if (item.date || item.phase || item.label) {
        const date = document.createElement('div');
        date.className = 'slide-timeline-date';
        date.textContent = item.date || item.phase || item.label;
        card.appendChild(date);
      }

      const cardTitle = document.createElement('h3');
      cardTitle.className = 'slide-timeline-title';
      cardTitle.textContent = item.title || item.name || '';
      card.appendChild(cardTitle);

      if (item.content || item.description) {
        const cardContent = document.createElement('p');
        cardContent.className = 'slide-timeline-content';
        cardContent.textContent = item.content || item.description;
        card.appendChild(cardContent);
      }

      timeline.appendChild(card);
    });

    fragment.appendChild(timeline);
    return fragment;
  }

  /**
   * Render timeline phases slide
   */
  _renderTimelinePhasesSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const phasesContainer = document.createElement('div');
    phasesContainer.className = 'slide-phases';

    const phases = slide.phases || slide.items || [];
    phases.forEach(phase => {
      const phaseEl = document.createElement('div');
      phaseEl.className = 'slide-phase';

      const phaseTitle = document.createElement('h3');
      phaseTitle.className = 'slide-phase-title';
      phaseTitle.textContent = phase.title || phase.name || '';
      phaseEl.appendChild(phaseTitle);

      if (phase.description || phase.content) {
        const desc = document.createElement('p');
        desc.className = 'slide-phase-desc';
        desc.textContent = phase.description || phase.content;
        phaseEl.appendChild(desc);
      }

      if (phase.note || phase.date) {
        const note = document.createElement('div');
        note.className = 'slide-phase-note';
        note.textContent = phase.note || phase.date;
        phaseEl.appendChild(note);
      }

      phasesContainer.appendChild(phaseEl);
    });

    fragment.appendChild(phasesContainer);
    return fragment;
  }

  /**
   * Render numbered timeline slide
   */
  _renderTimelineNumberedSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const timeline = document.createElement('div');
    timeline.className = 'slide-timeline-numbered';

    const items = slide.items || slide.phases || [];
    items.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'slide-timeline-item';

      const marker = document.createElement('div');
      marker.className = 'slide-timeline-marker';
      marker.textContent = index + 1;
      itemEl.appendChild(marker);

      const content = document.createElement('div');
      content.className = 'slide-timeline-item-content';

      if (item.date || item.label) {
        const date = document.createElement('div');
        date.className = 'slide-timeline-item-date';
        date.textContent = item.date || item.label;
        content.appendChild(date);
      }

      const itemTitle = document.createElement('h3');
      itemTitle.className = 'slide-timeline-item-title';
      itemTitle.textContent = item.title || item.name || '';
      content.appendChild(itemTitle);

      if (item.content || item.description) {
        const desc = document.createElement('p');
        desc.className = 'slide-timeline-item-desc';
        desc.textContent = item.content || item.description;
        content.appendChild(desc);
      }

      itemEl.appendChild(content);
      timeline.appendChild(itemEl);
    });

    fragment.appendChild(timeline);
    return fragment;
  }

  /**
   * Render rollout grid slide
   */
  _renderRolloutGridSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'slide-rollout-grid';

    const phases = slide.phases || [];
    phases.forEach(phase => {
      const phaseEl = document.createElement('div');
      phaseEl.className = 'slide-rollout-phase';

      const phaseTitle = document.createElement('h3');
      phaseTitle.className = 'slide-rollout-title';
      phaseTitle.textContent = phase.title || phase.name || '';
      phaseEl.appendChild(phaseTitle);

      if (phase.description || phase.content) {
        const desc = document.createElement('p');
        desc.className = 'slide-rollout-desc';
        desc.textContent = phase.description || phase.content;
        phaseEl.appendChild(desc);
      }

      const items = phase.items || phase.bullets || phase.details || [];
      if (items.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'slide-rollout-items';
        items.forEach(item => {
          const li = document.createElement('li');
          li.textContent = item;
          ul.appendChild(li);
        });
        phaseEl.appendChild(ul);
      }

      grid.appendChild(phaseEl);
    });

    fragment.appendChild(grid);
    return fragment;
  }

  /**
   * Render rollout timeline slide
   */
  _renderRolloutTimelineSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const timeline = document.createElement('div');
    timeline.className = 'slide-rollout-timeline';

    const phases = slide.phases || [];
    phases.forEach(phase => {
      const phaseEl = document.createElement('div');
      phaseEl.className = 'slide-rollout-phase-timeline';

      if (phase.date || phase.note) {
        const date = document.createElement('div');
        date.className = 'slide-rollout-date';
        date.textContent = phase.date || phase.note;
        phaseEl.appendChild(date);
      }

      const phaseTitle = document.createElement('h3');
      phaseTitle.className = 'slide-rollout-title';
      phaseTitle.textContent = phase.title || phase.name || '';
      phaseEl.appendChild(phaseTitle);

      if (phase.description || phase.content) {
        const desc = document.createElement('p');
        desc.className = 'slide-rollout-desc';
        desc.textContent = phase.description || phase.content;
        phaseEl.appendChild(desc);
      }

      timeline.appendChild(phaseEl);
    });

    fragment.appendChild(timeline);
    return fragment;
  }

  /**
   * Render rollout description slide
   */
  _renderRolloutDescriptionSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    if (slide.description || slide.content) {
      const desc = document.createElement('p');
      desc.className = 'slide-text';
      desc.textContent = slide.description || slide.content;
      fragment.appendChild(desc);
    }

    const phases = slide.phases || [];
    if (phases.length > 0) {
      const phasesContainer = document.createElement('div');
      phasesContainer.className = 'slide-rollout-desc-phases';

      phases.forEach(phase => {
        const phaseEl = document.createElement('div');
        phaseEl.className = 'slide-rollout-desc-phase';

        const phaseTitle = document.createElement('h3');
        phaseTitle.textContent = phase.title || phase.name || '';
        phaseEl.appendChild(phaseTitle);

        if (phase.description || phase.content) {
          const phaseDesc = document.createElement('p');
          phaseDesc.textContent = phase.description || phase.content;
          phaseEl.appendChild(phaseDesc);
        }

        phasesContainer.appendChild(phaseEl);
      });

      fragment.appendChild(phasesContainer);
    }

    return fragment;
  }

  /**
   * Render table slide
   */
  _renderTableSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const tableContainer = document.createElement('div');
    tableContainer.className = 'slide-table-container';

    const table = document.createElement('table');
    table.className = 'slide-table';

    // Render headers
    if (slide.headers && slide.headers.length > 0) {
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      slide.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
    }

    // Render rows
    if (slide.rows && slide.rows.length > 0) {
      const tbody = document.createElement('tbody');
      slide.rows.forEach(row => {
        const tr = document.createElement('tr');
        const cells = Array.isArray(row) ? row : Object.values(row);
        cells.forEach(cell => {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }

    tableContainer.appendChild(table);
    fragment.appendChild(tableContainer);
    return fragment;
  }

  /**
   * Render Gantt chart slide
   */
  _renderGanttChartSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const chartContainer = document.createElement('div');
    chartContainer.className = 'slide-gantt-container';

    // Month labels
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthRow = document.createElement('div');
    monthRow.className = 'slide-gantt-months';
    months.forEach(m => {
      const monthLabel = document.createElement('div');
      monthLabel.className = 'slide-gantt-month';
      monthLabel.textContent = m;
      monthRow.appendChild(monthLabel);
    });
    chartContainer.appendChild(monthRow);

    // Activities
    const activities = slide.activities || [];
    activities.forEach(activity => {
      const row = document.createElement('div');
      row.className = 'slide-gantt-row';

      const label = document.createElement('div');
      label.className = 'slide-gantt-label';
      label.textContent = activity.name || activity.title || '';
      row.appendChild(label);

      const bar = document.createElement('div');
      bar.className = 'slide-gantt-bar-container';

      const barInner = document.createElement('div');
      barInner.className = 'slide-gantt-bar';
      const start = activity.startMonth || 0;
      const end = activity.endMonth || 11;
      barInner.style.marginLeft = `${(start / 12) * 100}%`;
      barInner.style.width = `${((end - start + 1) / 12) * 100}%`;
      if (activity.color) {
        barInner.style.backgroundColor = `#${activity.color}`;
      }
      bar.appendChild(barInner);
      row.appendChild(bar);

      chartContainer.appendChild(row);
    });

    fragment.appendChild(chartContainer);
    return fragment;
  }

  /**
   * Render dual chart slide
   */
  _renderDualChartSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    const chartsContainer = document.createElement('div');
    chartsContainer.className = 'slide-dual-charts';

    // Left chart placeholder
    const leftChart = document.createElement('div');
    leftChart.className = 'slide-chart-placeholder';
    if (slide.leftChart) {
      const chartTitle = document.createElement('h3');
      chartTitle.textContent = slide.leftChart.title || 'Chart 1';
      leftChart.appendChild(chartTitle);
      if (slide.leftChart.source) {
        const source = document.createElement('p');
        source.className = 'slide-chart-source';
        source.textContent = `Source: ${slide.leftChart.source}`;
        leftChart.appendChild(source);
      }
    }
    chartsContainer.appendChild(leftChart);

    // Right chart placeholder
    const rightChart = document.createElement('div');
    rightChart.className = 'slide-chart-placeholder';
    if (slide.rightChart) {
      const chartTitle = document.createElement('h3');
      chartTitle.textContent = slide.rightChart.title || 'Chart 2';
      rightChart.appendChild(chartTitle);
      if (slide.rightChart.source) {
        const source = document.createElement('p');
        source.className = 'slide-chart-source';
        source.textContent = `Source: ${slide.rightChart.source}`;
        rightChart.appendChild(source);
      }
    }
    chartsContainer.appendChild(rightChart);

    fragment.appendChild(chartsContainer);
    return fragment;
  }

  /**
   * Render table of contents slide
   */
  _renderTableOfContentsSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title || 'Table of Contents';
    fragment.appendChild(heading);

    const tocList = document.createElement('ol');
    tocList.className = 'slide-toc';

    const sections = slide.sections || slide.items || [];
    sections.forEach(section => {
      const li = document.createElement('li');
      li.className = 'slide-toc-item';
      li.textContent = section.title || section;
      tocList.appendChild(li);
    });

    fragment.appendChild(tocList);
    return fragment;
  }

  /**
   * Render contents nav slide
   */
  _renderContentsNavSlide(slide) {
    const fragment = document.createDocumentFragment();

    const heading = document.createElement('h2');
    heading.className = 'slide-heading';
    heading.textContent = slide.title || 'Contents';
    fragment.appendChild(heading);

    const nav = document.createElement('div');
    nav.className = 'slide-contents-nav';

    const sections = slide.sections || [];
    sections.forEach(section => {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'slide-contents-section';

      if (section.number) {
        const num = document.createElement('span');
        num.className = 'slide-contents-number';
        num.textContent = section.number;
        sectionEl.appendChild(num);
      }

      const title = document.createElement('span');
      title.className = 'slide-contents-title';
      title.textContent = section.title || section;
      sectionEl.appendChild(title);

      nav.appendChild(sectionEl);
    });

    fragment.appendChild(nav);
    return fragment;
  }

  /**
   * Render thank you slide
   */
  _renderThankYouSlide(slide) {
    const fragment = document.createDocumentFragment();

    const title = document.createElement('h1');
    title.className = 'slide-title slide-thank-you-title';
    title.textContent = slide.title || 'Thank You';
    fragment.appendChild(title);

    if (slide.subtitle || slide.message) {
      const subtitle = document.createElement('p');
      subtitle.className = 'slide-subtitle';
      subtitle.textContent = slide.subtitle || slide.message;
      fragment.appendChild(subtitle);
    }

    if (slide.contact) {
      const contact = document.createElement('p');
      contact.className = 'slide-contact';
      contact.textContent = slide.contact;
      fragment.appendChild(contact);
    }

    return fragment;
  }

  /**
   * Intelligent fallback renderer based on available data
   * Delegates to specific renderers when appropriate to avoid code duplication
   */
  _renderFallbackSlide(slide) {
    // Delegate to specific renderers that include their own title handling
    // This avoids duplicate titles
    if (slide.steps && slide.steps.length > 0) {
      return this._renderProcessStepsSlide(slide);
    } else if (slide.cards && slide.cards.length > 0) {
      return this._renderCardGridSlide(slide);
    } else if (slide.features && slide.features.length > 0) {
      return this._renderFeatureGridSlide(slide);
    } else if (slide.phases && slide.phases.length > 0) {
      return this._renderTimelinePhasesSlide(slide);
    } else if (slide.items && slide.items.length > 0) {
      return this._renderTimelineCardsSlide(slide);
    } else if (slide.quote) {
      return this._renderQuoteSlide(slide);
    }

    // For simple content types, render manually
    const fragment = document.createDocumentFragment();

    // Render title if present
    if (slide.title) {
      const heading = document.createElement('h2');
      heading.className = 'slide-heading';
      heading.textContent = slide.title;
      fragment.appendChild(heading);
    }

    // Render content based on available data
    if (slide.bullets && slide.bullets.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'slide-bullets';
      slide.bullets.forEach(bullet => {
        const li = document.createElement('li');
        li.textContent = bullet;
        ul.appendChild(li);
      });
      fragment.appendChild(ul);
    } else if (slide.content) {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'slide-text';
      const p = document.createElement('p');
      p.textContent = slide.content;
      contentDiv.appendChild(p);
      fragment.appendChild(contentDiv);
    } else if (slide.subtitle) {
      const subtitle = document.createElement('p');
      subtitle.className = 'slide-subtitle';
      subtitle.textContent = slide.subtitle;
      fragment.appendChild(subtitle);
    }

    return fragment;
  }

  /**
   * Render navigation controls
   */
  _renderControls() {
    const controls = document.createElement('div');
    controls.className = 'slide-controls';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'slide-nav-button';
    prevBtn.innerHTML = '←';
    prevBtn.setAttribute('aria-label', 'Previous slide');
    prevBtn.disabled = this.currentSlide === 0;
    prevBtn.addEventListener('click', () => this.previousSlide());

    // Counter
    const counter = document.createElement('div');
    counter.className = 'slide-counter';
    counter.innerHTML = `
      <span class="current-slide">${this.currentSlide + 1}</span>
      <span class="slide-divider">/</span>
      <span class="total-slides">${this.slidesData.slides.length}</span>
    `;

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'slide-nav-button';
    nextBtn.innerHTML = '→';
    nextBtn.setAttribute('aria-label', 'Next slide');
    nextBtn.disabled = this.currentSlide === this.slidesData.slides.length - 1;
    nextBtn.addEventListener('click', () => this.nextSlide());

    // Fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'slide-nav-button';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.setAttribute('aria-label', 'Toggle fullscreen');
    fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

    // Export to PowerPoint button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'slide-export-button';
    exportBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>Download PPT</span>
    `;
    exportBtn.setAttribute('aria-label', 'Download as PowerPoint');
    exportBtn.addEventListener('click', () => this.exportToPowerPoint());
    this.exportButton = exportBtn;

    controls.appendChild(prevBtn);
    controls.appendChild(counter);
    controls.appendChild(nextBtn);
    controls.appendChild(fullscreenBtn);
    controls.appendChild(exportBtn);

    // Store references for updates
    this.prevButton = prevBtn;
    this.nextButton = nextBtn;
    this.counterElement = counter;

    return controls;
  }

  /**
   * Export slides to PowerPoint
   */
  async exportToPowerPoint() {
    if (!this.sessionId) {
      console.error('No session ID available for export');
      return;
    }

    try {
      // Disable button and show loading state
      this.exportButton.disabled = true;
      this.exportButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
        </svg>
        <span>Exporting...</span>
      `;

      // Fetch the PowerPoint file
      const response = await fetch(`/api/content/${this.sessionId}/slides/export`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export slides');
      }

      // Get the blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'presentation.pptx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export error:', error);
      alert(`Failed to export: ${error.message}`);
    } finally {
      // Restore button state
      this.exportButton.disabled = false;
      this.exportButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>Download PPT</span>
      `;
    }
  }

  /**
   * Render thumbnail navigator
   */
  _renderThumbnails() {
    const thumbnailsContainer = document.createElement('div');
    thumbnailsContainer.className = 'slide-thumbnails';

    this.slidesData.slides.forEach((slide, index) => {
      const thumbnail = document.createElement('button');
      thumbnail.className = 'thumbnail';
      if (index === this.currentSlide) {
        thumbnail.classList.add('active');
      }

      const preview = document.createElement('div');
      preview.className = 'thumbnail-preview';
      preview.textContent = index + 1;

      thumbnail.appendChild(preview);
      thumbnail.setAttribute('aria-label', `Go to slide ${index + 1}`);
      thumbnail.addEventListener('click', () => this.goToSlide(index));

      thumbnailsContainer.appendChild(thumbnail);
    });

    this.thumbnailsContainer = thumbnailsContainer;

    return thumbnailsContainer;
  }

  /**
   * Render keyboard hint
   */
  _renderKeyboardHint() {
    const hint = document.createElement('div');
    hint.className = 'keyboard-hint';
    hint.innerHTML = `
      Use <kbd>←</kbd> <kbd>→</kbd> or <kbd>Space</kbd> to navigate
      • <kbd>F</kbd> for fullscreen
      • <kbd>Esc</kbd> to exit
    `;
    return hint;
  }

  /**
   * Render empty state
   */
  _renderEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="9" x2="15" y2="9"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="15" x2="13" y2="15"/>
      </svg>
      <h2>No Slides Available</h2>
      <p>Slides have not been generated yet for this session.</p>
    `;
    return emptyState;
  }

  /**
   * Navigate to next slide
   */
  nextSlide() {
    if (this.currentSlide < this.slidesData.slides.length - 1) {
      this.currentSlide++;
      this._updateSlideDisplay();
    }
  }

  /**
   * Navigate to previous slide
   */
  previousSlide() {
    if (this.currentSlide > 0) {
      this.currentSlide--;
      this._updateSlideDisplay();
    }
  }

  /**
   * Navigate to specific slide
   */
  goToSlide(index) {
    if (index >= 0 && index < this.slidesData.slides.length) {
      this.currentSlide = index;
      this._updateSlideDisplay();
    }
  }

  /**
   * Update slide display after navigation
   */
  _updateSlideDisplay() {
    // Update slide
    const newSlide = this._renderSlide(this.currentSlide);
    this.slideElement.replaceWith(newSlide);
    this.slideElement = newSlide;

    // Update buttons
    this.prevButton.disabled = this.currentSlide === 0;
    this.nextButton.disabled = this.currentSlide === this.slidesData.slides.length - 1;

    // Update counter
    this.counterElement.querySelector('.current-slide').textContent = this.currentSlide + 1;

    // Update thumbnails
    const thumbnails = this.thumbnailsContainer.querySelectorAll('.thumbnail');
    thumbnails.forEach((thumb, index) => {
      thumb.classList.toggle('active', index === this.currentSlide);
    });

    // Scroll thumbnail into view
    const activeThumbnail = thumbnails[this.currentSlide];
    if (activeThumbnail) {
      activeThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    this.container.classList.toggle('fullscreen', this.isFullscreen);

    if (this.isFullscreen) {
      // Request fullscreen API if available
      if (this.container.requestFullscreen) {
        this.container.requestFullscreen().catch(err => {
          console.warn('Fullscreen request failed:', err);
        });
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
  }

  /**
   * Setup keyboard navigation
   */
  _setupKeyboardNavigation() {
    this.keyboardHandler = (e) => {
      // Only handle keyboard events when slides view is active
      if (!this.container || !this.container.isConnected) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case ' ': // Space
          e.preventDefault();
          this.nextSlide();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.previousSlide();
          break;
        case 'Home':
          e.preventDefault();
          this.goToSlide(0);
          break;
        case 'End':
          e.preventDefault();
          this.goToSlide(this.slidesData.slides.length - 1);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case 'Escape':
          if (this.isFullscreen) {
            e.preventDefault();
            this.toggleFullscreen();
          }
          break;
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Cleanup and remove event listeners
   */
  destroy() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }

    // Exit fullscreen if active
    if (this.isFullscreen && document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen();
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  /**
   * Load slides data from API
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async loadData(sessionId) {
    try {
      const response = await fetch(`/api/content/${sessionId}/slides`);

      if (!response.ok) {
        throw new Error(`Failed to load slides: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.status === 'completed' && result.data) {
        this.slidesData = result.data;
        this.sessionId = sessionId;
      } else if (result.status === 'processing') {
        throw new Error('Slides are still being generated. Please wait...');
      } else if (result.status === 'error') {
        throw new Error(result.error || 'Failed to generate slides');
      }

    } catch (error) {
      console.error('Error loading slides:', error);
      throw error;
    }
  }
}
