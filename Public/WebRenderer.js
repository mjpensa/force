/**
 * WebRenderer.js
 *
 * Renders structured slide data to HTML/CSS for web presentation viewer.
 * Part of the PPT-export-first architecture - consumes structured data
 * from SlideDataModel and generates semantic HTML.
 *
 * Complete Implementation: Supports all 8 slide types
 * Phase 1: Title, Bullet point, Two-column slides
 * Phase 2: Image, Section, Quote, Table, Comparison slides
 */

import { SLIDE_SCHEMAS } from './SlideDataModel.js';

export class WebRenderer {
  /**
   * Create a new WebRenderer instance
   * @param {Object} theme - Theme configuration from presentation data
   */
  constructor(theme = {}) {
    this.theme = theme;
    this._initializeDefaults();
  }

  /**
   * Initialize default theme values if not provided
   * @private
   */
  _initializeDefaults() {
    // Default colors
    this.theme.colors = this.theme.colors || {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#10b981',
      text: '#1e293b',
      textSecondary: '#64748b',
      background: '#ffffff',
      surface: '#f8fafc'
    };

    // Default fonts
    this.theme.fonts = this.theme.fonts || {
      title: { family: 'Work Sans', size: 44, weight: 700, color: '#1e293b' },
      subtitle: { family: 'Work Sans', size: 28, weight: 400, color: '#64748b' },
      body: { family: 'Work Sans', size: 20, weight: 400, color: '#1e293b' },
      caption: { family: 'Work Sans', size: 16, weight: 400, color: '#64748b' }
    };

    // Default spacing (in inches, converted to pixels at 96 DPI)
    this.theme.spacing = this.theme.spacing || {
      slideMargin: 0.5,
      titleTop: 0.75,
      contentTop: 1.5,
      bulletIndent: 0.5,
      lineSpacing: 1.5
    };

    // Default branding
    this.theme.branding = this.theme.branding || {
      logo: { show: false, url: '', position: 'top-right', width: 1.5 },
      footer: { show: false, text: '', fontSize: 14 }
    };
  }

  /**
   * Render a single slide to HTML
   * @param {Object} slide - Slide data object
   * @param {number} slideNumber - Slide number (1-indexed)
   * @param {number} totalSlides - Total number of slides
   * @returns {HTMLElement} - DOM element containing the rendered slide
   */
  render(slide, slideNumber = 1, totalSlides = 1) {
    if (!slide || !slide.type) {
      console.error('[WebRenderer] Invalid slide data:', slide);
      return this._renderErrorSlide('Invalid slide data');
    }

    // Route to appropriate renderer based on slide type
    switch (slide.type) {
      case 'title':
        return this._renderTitleSlide(slide, slideNumber, totalSlides);
      case 'bullets':
        return this._renderBulletsSlide(slide, slideNumber, totalSlides);
      case 'two-column':
        return this._renderTwoColumnSlide(slide, slideNumber, totalSlides);
      case 'image':
        return this._renderImageSlide(slide, slideNumber, totalSlides);
      case 'section':
        return this._renderSectionSlide(slide, slideNumber, totalSlides);
      case 'quote':
        return this._renderQuoteSlide(slide, slideNumber, totalSlides);
      case 'table':
        return this._renderTableSlide(slide, slideNumber, totalSlides);
      case 'comparison':
        return this._renderComparisonSlide(slide, slideNumber, totalSlides);
      default:
        console.warn(`[WebRenderer] Unsupported slide type: ${slide.type}`);
        return this._renderUnsupportedSlide(slide, slideNumber, totalSlides);
    }
  }

  /**
   * Render a title slide
   * @private
   */
  _renderTitleSlide(slide, slideNumber, totalSlides) {
    const container = this._createSlideContainer(slide, slideNumber);
    const content = slide.content || {};

    // Main title
    if (content.title) {
      const titleEl = document.createElement('h1');
      titleEl.className = 'slide-title-main';
      titleEl.textContent = content.title;
      titleEl.style.cssText = `
        font-family: ${this.theme.fonts.title.family}, sans-serif;
        font-size: ${this.theme.fonts.title.size}px;
        font-weight: ${this.theme.fonts.title.weight};
        color: ${this.theme.fonts.title.color};
        text-align: center;
        margin: 0;
        padding: 0;
        line-height: 1.2;
      `;
      container.appendChild(titleEl);
    }

    // Subtitle
    if (content.subtitle) {
      const subtitleEl = document.createElement('p');
      subtitleEl.className = 'slide-subtitle';
      subtitleEl.textContent = content.subtitle;
      subtitleEl.style.cssText = `
        font-family: ${this.theme.fonts.subtitle.family}, sans-serif;
        font-size: ${this.theme.fonts.subtitle.size}px;
        font-weight: ${this.theme.fonts.subtitle.weight};
        color: ${this.theme.fonts.subtitle.color};
        text-align: center;
        margin: ${this._toPixels(0.5)}px 0 0 0;
        padding: 0;
        line-height: 1.4;
      `;
      container.appendChild(subtitleEl);
    }

    // Author info
    if (content.author || content.date) {
      const metaEl = document.createElement('div');
      metaEl.className = 'slide-meta';
      metaEl.style.cssText = `
        font-family: ${this.theme.fonts.caption.family}, sans-serif;
        font-size: ${this.theme.fonts.caption.size}px;
        color: ${this.theme.fonts.caption.color};
        text-align: center;
        margin-top: ${this._toPixels(1)}px;
        line-height: 1.4;
      `;

      if (content.author) {
        const authorEl = document.createElement('div');
        authorEl.textContent = content.author;
        metaEl.appendChild(authorEl);
      }

      if (content.date) {
        const dateEl = document.createElement('div');
        dateEl.textContent = content.date;
        dateEl.style.marginTop = '8px';
        metaEl.appendChild(dateEl);
      }

      container.appendChild(metaEl);
    }

    // Apply center alignment layout
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.padding = `${this._toPixels(this.theme.spacing.slideMargin)}px`;

    return container;
  }

  /**
   * Render a bullets slide
   * @private
   */
  _renderBulletsSlide(slide, slideNumber, totalSlides) {
    const container = this._createSlideContainer(slide, slideNumber);
    const content = slide.content || {};

    // Create content wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-content-wrapper';
    wrapper.style.cssText = `
      padding: ${this._toPixels(this.theme.spacing.slideMargin)}px;
      height: 100%;
      display: flex;
      flex-direction: column;
    `;

    // Title
    if (content.title) {
      const titleEl = document.createElement('h2');
      titleEl.className = 'slide-title';
      titleEl.textContent = content.title;
      titleEl.style.cssText = `
        font-family: ${this.theme.fonts.title.family}, sans-serif;
        font-size: ${this.theme.fonts.title.size}px;
        font-weight: ${this.theme.fonts.title.weight};
        color: ${this.theme.colors.primary};
        margin: 0 0 ${this._toPixels(0.5)}px 0;
        padding: 0;
        line-height: 1.2;
      `;
      wrapper.appendChild(titleEl);
    }

    // Bullets
    if (content.bullets && content.bullets.length > 0) {
      const bulletList = this._createBulletList(content.bullets, 0);
      wrapper.appendChild(bulletList);
    }

    container.appendChild(wrapper);
    return container;
  }

  /**
   * Create a bullet list (supports nesting)
   * @private
   */
  _createBulletList(bullets, level = 0) {
    const ul = document.createElement('ul');
    ul.className = `slide-bullets level-${level}`;

    const indent = this._toPixels(this.theme.spacing.bulletIndent * level);
    const fontSize = this.theme.fonts.body.size - (level * 3); // Smaller for nested

    ul.style.cssText = `
      list-style: none;
      margin: ${level === 0 ? this._toPixels(0.5) : 0.5}rem 0;
      padding: 0;
      padding-left: ${indent}px;
    `;

    bullets.forEach(bullet => {
      const li = document.createElement('li');
      li.className = 'slide-bullet-item';

      // Bullet point styling
      li.style.cssText = `
        font-family: ${this.theme.fonts.body.family}, sans-serif;
        font-size: ${fontSize}px;
        font-weight: ${this.theme.fonts.body.weight};
        color: ${this.theme.fonts.body.color};
        line-height: ${this.theme.spacing.lineSpacing};
        margin-bottom: 0.75rem;
        padding-left: 1.5rem;
        position: relative;
      `;

      // Custom bullet point
      const bulletPoint = document.createElement('span');
      bulletPoint.className = 'bullet-marker';
      bulletPoint.textContent = level === 0 ? '●' : '○';
      bulletPoint.style.cssText = `
        position: absolute;
        left: 0;
        color: ${this.theme.colors.primary};
        font-size: ${fontSize * 0.6}px;
        top: 0.4em;
      `;
      li.appendChild(bulletPoint);

      // Bullet text
      const textSpan = document.createElement('span');
      textSpan.textContent = typeof bullet === 'string' ? bullet : bullet.text;
      li.appendChild(textSpan);

      // Handle nested bullets
      if (typeof bullet === 'object' && bullet.subitems && bullet.subitems.length > 0) {
        const nestedList = this._createBulletList(bullet.subitems, level + 1);
        li.appendChild(nestedList);
      }

      ul.appendChild(li);
    });

    return ul;
  }

  /**
   * Render a two-column slide
   * @private
   */
  _renderTwoColumnSlide(slide, slideNumber, totalSlides) {
    const container = this._createSlideContainer(slide, slideNumber);
    const content = slide.content || {};

    // Create content wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-content-wrapper';
    wrapper.style.cssText = `
      padding: ${this._toPixels(this.theme.spacing.slideMargin)}px;
      height: 100%;
      display: flex;
      flex-direction: column;
    `;

    // Title
    if (content.title) {
      const titleEl = document.createElement('h2');
      titleEl.className = 'slide-title';
      titleEl.textContent = content.title;
      titleEl.style.cssText = `
        font-family: ${this.theme.fonts.title.family}, sans-serif;
        font-size: ${this.theme.fonts.title.size}px;
        font-weight: ${this.theme.fonts.title.weight};
        color: ${this.theme.colors.primary};
        margin: 0 0 ${this._toPixels(0.5)}px 0;
        padding: 0;
        line-height: 1.2;
      `;
      wrapper.appendChild(titleEl);
    }

    // Two-column layout
    const columnsContainer = document.createElement('div');
    columnsContainer.className = 'slide-columns';
    columnsContainer.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${this._toPixels(0.5)}px;
      flex: 1;
      min-height: 0;
    `;

    // Left column
    const leftCol = this._createColumn(content.leftColumn, 'left');
    columnsContainer.appendChild(leftCol);

    // Right column
    const rightCol = this._createColumn(content.rightColumn, 'right');
    columnsContainer.appendChild(rightCol);

    wrapper.appendChild(columnsContainer);
    container.appendChild(wrapper);
    return container;
  }

  /**
   * Create a column for two-column layout
   * @private
   */
  _createColumn(columnData, side) {
    const column = document.createElement('div');
    column.className = `slide-column slide-column-${side}`;
    column.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: ${this._toPixels(0.25)}px;
      background: ${this.theme.colors.surface};
      border-radius: 8px;
      overflow: auto;
    `;

    if (!columnData) {
      return column;
    }

    // Column title
    if (columnData.title) {
      const colTitle = document.createElement('h3');
      colTitle.className = 'column-title';
      colTitle.textContent = columnData.title;
      colTitle.style.cssText = `
        font-family: ${this.theme.fonts.subtitle.family}, sans-serif;
        font-size: ${this.theme.fonts.subtitle.size}px;
        font-weight: ${this.theme.fonts.subtitle.weight};
        color: ${this.theme.colors.secondary};
        margin: 0 0 ${this._toPixels(0.3)}px 0;
        padding: 0;
        line-height: 1.2;
      `;
      column.appendChild(colTitle);
    }

    // Column content (bullets or text)
    if (columnData.bullets && columnData.bullets.length > 0) {
      const bulletList = this._createBulletList(columnData.bullets, 0);
      column.appendChild(bulletList);
    } else if (columnData.text) {
      const textEl = document.createElement('p');
      textEl.className = 'column-text';
      textEl.textContent = columnData.text;
      textEl.style.cssText = `
        font-family: ${this.theme.fonts.body.family}, sans-serif;
        font-size: ${this.theme.fonts.body.size}px;
        font-weight: ${this.theme.fonts.body.weight};
        color: ${this.theme.fonts.body.color};
        line-height: ${this.theme.spacing.lineSpacing};
        margin: 0;
        padding: 0;
      `;
      column.appendChild(textEl);
    }

    return column;
  }

  /**
   * Render an image slide
   * @private
   */
  _renderImageSlide(slide, slideNumber, totalSlides) {
    const container = this._createSlideContainer(slide, slideNumber);
    const content = slide.content || {};

    const wrapper = document.createElement('div');
    wrapper.className = 'slide-content-wrapper';
    wrapper.style.cssText = `
      padding: ${this._toPixels(this.theme.spacing.slideMargin)}px;
      height: 100%;
      display: flex;
      flex-direction: column;
    `;

    // Title
    if (content.title && content.title.text) {
      const titleEl = document.createElement('h2');
      titleEl.className = 'slide-title';
      titleEl.textContent = content.title.text;
      titleEl.style.cssText = `
        font-family: ${this.theme.fonts.title.family}, sans-serif;
        font-size: ${this.theme.fonts.title.size}px;
        font-weight: ${this.theme.fonts.title.weight};
        color: ${this.theme.colors.primary};
        margin: 0 0 ${this._toPixels(0.5)}px 0;
        padding: 0;
        line-height: 1.2;
      `;
      wrapper.appendChild(titleEl);
    }

    // Image container
    if (content.image && content.image.src) {
      const imageContainer = document.createElement('div');
      imageContainer.className = 'slide-image-container';
      imageContainer.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: ${this._toPixels(0.5)}px 0;
      `;

      const img = document.createElement('img');
      img.src = content.image.src;
      img.alt = content.image.alt || 'Slide image';
      img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      `;
      imageContainer.appendChild(img);

      // Caption
      if (content.image.caption) {
        const caption = document.createElement('p');
        caption.className = 'image-caption';
        caption.textContent = content.image.caption;
        caption.style.cssText = `
          font-family: ${this.theme.fonts.caption.family}, sans-serif;
          font-size: ${this.theme.fonts.caption.size}px;
          color: ${this.theme.fonts.caption.color};
          margin-top: ${this._toPixels(0.25)}px;
          text-align: center;
        `;
        imageContainer.appendChild(caption);
      }

      wrapper.appendChild(imageContainer);
    }

    container.appendChild(wrapper);
    return container;
  }

  /**
   * Render a section header slide
   * @private
   */
  _renderSectionSlide(slide, slideNumber, totalSlides) {
    const container = this._createSlideContainer(slide, slideNumber);
    const content = slide.content || {};

    // Apply gradient background
    if (content.background && content.background.type === 'gradient') {
      const gradient = content.background.gradient;
      const angle = gradient.angle || 135;
      const colors = gradient.colors || ['#3b82f6', '#8b5cf6'];
      container.style.background = `linear-gradient(${angle}deg, ${colors.join(', ')})`;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'slide-content-wrapper';
    wrapper.style.cssText = `
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: ${this._toPixels(this.theme.spacing.slideMargin)}px;
    `;

    // Section number
    if (content.sectionNumber) {
      const sectionNum = document.createElement('div');
      sectionNum.className = 'section-number';
      sectionNum.textContent = content.sectionNumber;
      sectionNum.style.cssText = `
        font-family: ${this.theme.fonts.title.family}, sans-serif;
        font-size: 80px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.3);
        margin-bottom: ${this._toPixels(0.5)}px;
      `;
      wrapper.appendChild(sectionNum);
    }

    // Section title
    if (content.sectionTitle && content.sectionTitle.text) {
      const sectionTitle = document.createElement('h1');
      sectionTitle.className = 'section-title';
      sectionTitle.textContent = content.sectionTitle.text;
      sectionTitle.style.cssText = `
        font-family: ${this.theme.fonts.title.family}, sans-serif;
        font-size: ${content.sectionTitle.fontSize || 48}px;
        font-weight: 700;
        color: ${content.sectionTitle.color || '#ffffff'};
        margin: 0 0 ${this._toPixels(0.5)}px 0;
        padding: 0;
        line-height: 1.2;
      `;
      wrapper.appendChild(sectionTitle);
    }

    // Description
    if (content.description && content.description.text) {
      const description = document.createElement('p');
      description.className = 'section-description';
      description.textContent = content.description.text;
      description.style.cssText = `
        font-family: ${this.theme.fonts.body.family}, sans-serif;
        font-size: ${content.description.fontSize || 20}px;
        color: ${content.description.color || '#ffffff'};
        margin: 0;
        max-width: 80%;
      `;
      wrapper.appendChild(description);
    }

    container.appendChild(wrapper);
    return container;
  }

  /**
   * Render a quote slide
   * @private
   */
  _renderQuoteSlide(slide, slideNumber, totalSlides) {
    const container = this._createSlideContainer(slide, slideNumber);
    const content = slide.content || {};

    const wrapper = document.createElement('div');
    wrapper.className = 'slide-content-wrapper';
    wrapper.style.cssText = `
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: ${this._toPixels(this.theme.spacing.slideMargin * 2)}px;
    `;

    // Quote marks (decorative)
    if (content.quoteMarks && content.quoteMarks.enabled) {
      const openQuote = document.createElement('div');
      openQuote.className = 'quote-mark-open';
      openQuote.textContent = '"';
      openQuote.style.cssText = `
        font-size: 120px;
        font-weight: 700;
        color: ${content.quoteMarks.color || this.theme.colors.primary};
        opacity: 0.2;
        line-height: 0.8;
        margin-bottom: ${this._toPixels(0.5)}px;
      `;
      wrapper.appendChild(openQuote);
    }

    // Quote text
    if (content.quote && content.quote.text) {
      const quoteText = document.createElement('blockquote');
      quoteText.className = 'quote-text';
      quoteText.textContent = content.quote.text;
      quoteText.style.cssText = `
        font-family: ${this.theme.fonts.title.family}, sans-serif;
        font-size: ${content.quote.fontSize || 32}px;
        font-style: ${content.quote.fontStyle || 'italic'};
        color: ${content.quote.color || this.theme.fonts.title.color};
        text-align: ${content.quote.alignment || 'center'};
        margin: 0 0 ${this._toPixels(0.75)}px 0;
        max-width: 80%;
        line-height: 1.4;
      `;
      wrapper.appendChild(quoteText);
    }

    // Attribution
    if (content.attribution && content.attribution.text) {
      const attribution = document.createElement('cite');
      attribution.className = 'quote-attribution';
      attribution.textContent = content.attribution.text;
      attribution.style.cssText = `
        font-family: ${this.theme.fonts.body.family}, sans-serif;
        font-size: ${content.attribution.fontSize || 18}px;
        font-style: normal;
        color: ${content.attribution.color || this.theme.fonts.caption.color};
        text-align: ${content.attribution.alignment || 'right'};
        display: block;
        width: 80%;
      `;
      wrapper.appendChild(attribution);
    }

    container.appendChild(wrapper);
    return container;
  }

  /**
   * Render a table slide
   * @private
   */
  _renderTableSlide(slide, slideNumber, totalSlides) {
    const container = this._createSlideContainer(slide, slideNumber);
    const content = slide.content || {};

    const wrapper = document.createElement('div');
    wrapper.className = 'slide-content-wrapper';
    wrapper.style.cssText = `
      padding: ${this._toPixels(this.theme.spacing.slideMargin)}px;
      height: 100%;
      display: flex;
      flex-direction: column;
    `;

    // Title
    if (content.title && content.title.text) {
      const titleEl = document.createElement('h2');
      titleEl.className = 'slide-title';
      titleEl.textContent = content.title.text;
      titleEl.style.cssText = `
        font-family: ${this.theme.fonts.title.family}, sans-serif;
        font-size: ${this.theme.fonts.title.size}px;
        font-weight: ${this.theme.fonts.title.weight};
        color: ${this.theme.colors.primary};
        margin: 0 0 ${this._toPixels(0.5)}px 0;
        padding: 0;
        line-height: 1.2;
      `;
      wrapper.appendChild(titleEl);
    }

    // Table
    if (content.table && content.table.headers && content.table.rows) {
      const tableContainer = document.createElement('div');
      tableContainer.className = 'table-container';
      tableContainer.style.cssText = `
        flex: 1;
        overflow: auto;
        border-radius: 8px;
      `;

      const table = document.createElement('table');
      table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        font-family: ${this.theme.fonts.body.family}, sans-serif;
        font-size: ${this.theme.fonts.body.size}px;
      `;

      // Header row
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      content.table.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header.text || header;
        th.style.cssText = `
          background-color: ${content.table.style?.headerBackgroundColor || this.theme.colors.primary};
          color: ${content.table.style?.headerTextColor || '#ffffff'};
          padding: ${this._toPixels(0.2)}px;
          text-align: ${header.alignment || 'left'};
          border: ${content.table.style?.borderWidth || 1}px solid ${content.table.style?.borderColor || '#e5e7eb'};
        `;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Data rows
      const tbody = document.createElement('tbody');
      content.table.rows.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');

        // Alternate row colors if enabled
        if (content.table.style?.alternateRowColors && rowIndex % 2 === 1) {
          tr.style.backgroundColor = '#f9fafb';
        }

        row.forEach(cell => {
          const td = document.createElement('td');
          td.textContent = cell.text || cell;
          td.style.cssText = `
            padding: ${this._toPixels(0.15)}px;
            text-align: ${cell.alignment || 'left'};
            border: ${content.table.style?.borderWidth || 1}px solid ${content.table.style?.borderColor || '#e5e7eb'};
          `;
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      tableContainer.appendChild(table);
      wrapper.appendChild(tableContainer);
    }

    container.appendChild(wrapper);
    return container;
  }

  /**
   * Render a comparison slide
   * @private
   */
  _renderComparisonSlide(slide, slideNumber, totalSlides) {
    const container = this._createSlideContainer(slide, slideNumber);
    const content = slide.content || {};

    const wrapper = document.createElement('div');
    wrapper.className = 'slide-content-wrapper';
    wrapper.style.cssText = `
      padding: ${this._toPixels(this.theme.spacing.slideMargin)}px;
      height: 100%;
      display: flex;
      flex-direction: column;
    `;

    // Title
    if (content.title && content.title.text) {
      const titleEl = document.createElement('h2');
      titleEl.className = 'slide-title';
      titleEl.textContent = content.title.text;
      titleEl.style.cssText = `
        font-family: ${this.theme.fonts.title.family}, sans-serif;
        font-size: ${this.theme.fonts.title.size}px;
        font-weight: ${this.theme.fonts.title.weight};
        color: ${this.theme.colors.primary};
        margin: 0 0 ${this._toPixels(0.5)}px 0;
        padding: 0;
        line-height: 1.2;
      `;
      wrapper.appendChild(titleEl);
    }

    // Comparison grid
    if (content.items && Array.isArray(content.items)) {
      const grid = document.createElement('div');
      grid.className = 'comparison-grid';
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(${content.items.length}, 1fr);
        gap: ${this._toPixels(0.5)}px;
        flex: 1;
      `;

      content.items.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'comparison-item';
        itemCard.style.cssText = `
          background-color: ${item.backgroundColor || this.theme.colors.surface};
          border: 2px solid ${item.borderColor || this.theme.colors.primary};
          border-radius: 8px;
          padding: ${this._toPixels(0.5)}px;
          display: flex;
          flex-direction: column;
        `;

        // Item header with icon and label
        const header = document.createElement('div');
        header.className = 'comparison-header';
        header.style.cssText = `
          display: flex;
          align-items: center;
          gap: ${this._toPixels(0.2)}px;
          margin-bottom: ${this._toPixels(0.3)}px;
          padding-bottom: ${this._toPixels(0.2)}px;
          border-bottom: 1px solid ${item.borderColor || this.theme.colors.primary};
        `;

        if (item.icon) {
          const icon = document.createElement('span');
          icon.className = 'comparison-icon';
          icon.textContent = item.icon;
          icon.style.cssText = `
            font-size: 32px;
          `;
          header.appendChild(icon);
        }

        const label = document.createElement('h3');
        label.className = 'comparison-label';
        label.textContent = item.label;
        label.style.cssText = `
          font-family: ${this.theme.fonts.subtitle.family}, sans-serif;
          font-size: ${this.theme.fonts.subtitle.size}px;
          font-weight: ${this.theme.fonts.subtitle.weight};
          color: ${this.theme.fonts.title.color};
          margin: 0;
        `;
        header.appendChild(label);

        itemCard.appendChild(header);

        // Bullets
        if (item.bullets && item.bullets.length > 0) {
          const bulletList = document.createElement('ul');
          bulletList.style.cssText = `
            list-style: none;
            margin: 0;
            padding: 0;
          `;

          item.bullets.forEach(bullet => {
            const li = document.createElement('li');
            li.style.cssText = `
              font-family: ${this.theme.fonts.body.family}, sans-serif;
              font-size: ${this.theme.fonts.body.size - 2}px;
              color: ${this.theme.fonts.body.color};
              margin-bottom: ${this._toPixels(0.15)}px;
              padding-left: ${this._toPixels(0.3)}px;
              position: relative;
            `;

            if (bullet.icon) {
              const bulletIcon = document.createElement('span');
              bulletIcon.textContent = bullet.icon;
              bulletIcon.style.cssText = `
                position: absolute;
                left: 0;
                color: ${bullet.type === 'pro' ? '#10b981' : '#ef4444'};
              `;
              li.appendChild(bulletIcon);
            }

            const bulletText = document.createElement('span');
            bulletText.textContent = bullet.text;
            bulletText.style.marginLeft = bullet.icon ? `${this._toPixels(0.25)}px` : '0';
            li.appendChild(bulletText);

            bulletList.appendChild(li);
          });

          itemCard.appendChild(bulletList);
        }

        grid.appendChild(itemCard);
      });

      wrapper.appendChild(grid);
    }

    container.appendChild(wrapper);
    return container;
  }

  /**
   * Create the base slide container
   * @private
   */
  _createSlideContainer(slide, slideNumber) {
    const container = document.createElement('div');
    container.className = 'slide-content';
    container.setAttribute('data-slide-id', slide.id);
    container.setAttribute('data-slide-type', slide.type);
    container.setAttribute('data-slide-number', slideNumber);

    // Base container styling
    container.style.cssText = `
      width: 100%;
      height: 100%;
      background: ${this.theme.colors.background};
      position: relative;
      overflow: hidden;
    `;

    // Add branding if enabled
    if (this.theme.branding.logo.show && this.theme.branding.logo.url) {
      const logo = this._createLogo();
      container.appendChild(logo);
    }

    if (this.theme.branding.footer.show && this.theme.branding.footer.text) {
      const footer = this._createFooter(slideNumber);
      container.appendChild(footer);
    }

    return container;
  }

  /**
   * Create logo element
   * @private
   */
  _createLogo() {
    const logo = document.createElement('img');
    logo.className = 'slide-logo';
    logo.src = this.theme.branding.logo.url;
    logo.alt = 'Logo';

    const position = this.theme.branding.logo.position || 'top-right';
    const width = this._toPixels(this.theme.branding.logo.width || 1.5);

    logo.style.cssText = `
      position: absolute;
      width: ${width}px;
      height: auto;
      z-index: 10;
    `;

    // Position based on config
    switch (position) {
      case 'top-left':
        logo.style.top = '20px';
        logo.style.left = '20px';
        break;
      case 'top-right':
        logo.style.top = '20px';
        logo.style.right = '20px';
        break;
      case 'bottom-left':
        logo.style.bottom = '20px';
        logo.style.left = '20px';
        break;
      case 'bottom-right':
        logo.style.bottom = '20px';
        logo.style.right = '20px';
        break;
    }

    return logo;
  }

  /**
   * Create footer element
   * @private
   */
  _createFooter(slideNumber) {
    const footer = document.createElement('div');
    footer.className = 'slide-footer';
    footer.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 10px 20px;
      font-family: ${this.theme.fonts.caption.family}, sans-serif;
      font-size: ${this.theme.branding.footer.fontSize || 14}px;
      color: ${this.theme.fonts.caption.color};
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(to top, rgba(0,0,0,0.05), transparent);
    `;

    const footerText = document.createElement('span');
    footerText.textContent = this.theme.branding.footer.text;
    footer.appendChild(footerText);

    const pageNumber = document.createElement('span');
    pageNumber.textContent = slideNumber.toString();
    footer.appendChild(pageNumber);

    return footer;
  }

  /**
   * Render error slide when slide data is invalid
   * @private
   */
  _renderErrorSlide(message) {
    const container = document.createElement('div');
    container.className = 'slide-content slide-error';
    container.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fef2f2;
      color: #dc2626;
      font-family: ${this.theme.fonts.body.family}, sans-serif;
      font-size: ${this.theme.fonts.body.size}px;
      text-align: center;
      padding: ${this._toPixels(this.theme.spacing.slideMargin)}px;
    `;

    const errorMessage = document.createElement('div');
    errorMessage.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
      <div style="font-weight: 600; margin-bottom: 10px;">Error Rendering Slide</div>
      <div style="font-size: 16px; opacity: 0.8;">${message}</div>
    `;
    container.appendChild(errorMessage);

    return container;
  }

  /**
   * Render placeholder for unsupported slide types
   * @private
   */
  _renderUnsupportedSlide(slide, slideNumber, totalSlides) {
    const container = this._createSlideContainer(slide, slideNumber);
    container.style.cssText += `
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
    `;

    const placeholder = document.createElement('div');
    placeholder.style.cssText = `
      text-align: center;
      color: #64748b;
      font-family: ${this.theme.fonts.body.family}, sans-serif;
    `;

    placeholder.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
      <div style="font-size: 24px; font-weight: 600; margin-bottom: 10px;">
        ${slide.type.charAt(0).toUpperCase() + slide.type.slice(1)} Slide
      </div>
      <div style="font-size: 16px; opacity: 0.8;">
        Renderer coming soon
      </div>
    `;

    container.appendChild(placeholder);
    return container;
  }

  /**
   * Convert inches to pixels (96 DPI)
   * @private
   */
  _toPixels(inches) {
    return Math.round(inches * 96);
  }

  /**
   * Batch render multiple slides
   * @param {Array} slides - Array of slide data objects
   * @returns {Array} - Array of rendered DOM elements
   */
  renderAll(slides) {
    if (!Array.isArray(slides)) {
      console.error('[WebRenderer] Invalid slides array:', slides);
      return [];
    }

    return slides.map((slide, index) =>
      this.render(slide, index + 1, slides.length)
    );
  }

  /**
   * Update theme and re-render if needed
   * @param {Object} newTheme - New theme configuration
   */
  updateTheme(newTheme) {
    this.theme = { ...this.theme, ...newTheme };
    this._initializeDefaults();
  }
}

export default WebRenderer;
