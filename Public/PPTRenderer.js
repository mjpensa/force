/**
 * PPTRenderer.js
 *
 * Renders structured slide data to PowerPoint (.pptx) format using PptxGenJS.
 * Part of the PPT-export-first architecture - ensures web and PowerPoint
 * rendering are perfectly synchronized.
 *
 * Complete Implementation: Supports all 8 slide types
 * Phase 1: Title, Bullet point, Two-column slides
 * Phase 2: Image, Section, Quote, Table, Comparison slides
 *
 * Requires: PptxGenJS library (loaded via CDN in chart.html)
 */

import { SLIDE_SCHEMAS } from './SlideDataModel.js';

export class PPTRenderer {
  /**
   * Create a new PPTRenderer instance
   * @param {Object} theme - Theme configuration from presentation data
   */
  constructor(theme = {}) {
    this.theme = theme;
    this._initializeDefaults();
    this.pptx = null;
  }

  /**
   * Initialize default theme values if not provided
   * @private
   */
  _initializeDefaults() {
    // Default colors (convert hex to PowerPoint format if needed)
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

    // Default spacing (in inches)
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

    // Slide dimensions (16:9 aspect ratio)
    this.slideWidth = 10; // inches
    this.slideHeight = 5.625; // inches (10 / 16 * 9)
  }

  /**
   * Initialize a new PowerPoint presentation
   * @param {Object} metadata - Presentation metadata
   * @returns {Object} - PptxGenJS instance
   */
  initializePresentation(metadata = {}) {
    if (typeof pptxgen === 'undefined') {
      throw new Error('PptxGenJS library not loaded. Include pptxgen.bundle.js script.');
    }

    this.pptx = new pptxgen();

    // Set presentation properties
    this.pptx.layout = 'LAYOUT_16x9';
    this.pptx.author = metadata.author || 'AI Roadmap Generator';
    this.pptx.company = metadata.company || '';
    this.pptx.title = metadata.title || 'Presentation';
    this.pptx.subject = metadata.subject || '';

    return this.pptx;
  }

  /**
   * Add a single slide to the presentation
   * @param {Object} slide - Slide data object
   * @param {number} slideNumber - Slide number (1-indexed)
   * @returns {Object} - PptxGenJS slide object
   */
  addSlide(slide, slideNumber = 1) {
    if (!this.pptx) {
      throw new Error('Presentation not initialized. Call initializePresentation() first.');
    }

    if (!slide || !slide.type) {
      console.error('[PPTRenderer] Invalid slide data:', slide);
      return this._addErrorSlide('Invalid slide data');
    }

    // Route to appropriate renderer based on slide type
    switch (slide.type) {
      case 'title':
        return this._addTitleSlide(slide, slideNumber);
      case 'bullets':
        return this._addBulletsSlide(slide, slideNumber);
      case 'two-column':
        return this._addTwoColumnSlide(slide, slideNumber);
      case 'image':
        return this._addImageSlide(slide, slideNumber);
      case 'section':
        return this._addSectionSlide(slide, slideNumber);
      case 'quote':
        return this._addQuoteSlide(slide, slideNumber);
      case 'table':
        return this._addTableSlide(slide, slideNumber);
      case 'comparison':
        return this._addComparisonSlide(slide, slideNumber);
      default:
        console.warn(`[PPTRenderer] Unsupported slide type: ${slide.type}`);
        return this._addUnsupportedSlide(slide, slideNumber);
    }
  }

  /**
   * Add a title slide
   * @private
   */
  _addTitleSlide(slideData, slideNumber) {
    const pptSlide = this.pptx.addSlide();
    const content = slideData.content || {};

    // Set background
    pptSlide.background = { color: this._hexToRgb(this.theme.colors.background) };

    // Add branding
    this._addBranding(pptSlide, slideNumber);

    // Calculate vertical centering
    const totalHeight = this.slideHeight;
    let currentY = totalHeight * 0.35; // Start at 35% from top for centering

    // Main title
    if (content.title) {
      pptSlide.addText(content.title, {
        x: 0.5,
        y: currentY,
        w: this.slideWidth - 1,
        h: 1,
        align: 'center',
        valign: 'middle',
        fontFace: this.theme.fonts.title.family,
        fontSize: this.theme.fonts.title.size,
        bold: this.theme.fonts.title.weight >= 600,
        color: this._hexToRgb(this.theme.fonts.title.color)
      });
      currentY += 1.2;
    }

    // Subtitle
    if (content.subtitle) {
      pptSlide.addText(content.subtitle, {
        x: 0.5,
        y: currentY,
        w: this.slideWidth - 1,
        h: 0.8,
        align: 'center',
        valign: 'middle',
        fontFace: this.theme.fonts.subtitle.family,
        fontSize: this.theme.fonts.subtitle.size,
        color: this._hexToRgb(this.theme.fonts.subtitle.color)
      });
      currentY += 1;
    }

    // Author and date
    if (content.author || content.date) {
      const metaText = [];
      if (content.author) metaText.push(content.author);
      if (content.date) metaText.push(content.date);

      pptSlide.addText(metaText.join('\n'), {
        x: 0.5,
        y: currentY,
        w: this.slideWidth - 1,
        h: 0.6,
        align: 'center',
        valign: 'top',
        fontFace: this.theme.fonts.caption.family,
        fontSize: this.theme.fonts.caption.size,
        color: this._hexToRgb(this.theme.fonts.caption.color)
      });
    }

    // Add notes if present
    if (slideData.notes) {
      pptSlide.addNotes(slideData.notes);
    }

    return pptSlide;
  }

  /**
   * Add a bullets slide
   * @private
   */
  _addBulletsSlide(slideData, slideNumber) {
    const pptSlide = this.pptx.addSlide();
    const content = slideData.content || {};

    // Set background
    pptSlide.background = { color: this._hexToRgb(this.theme.colors.background) };

    // Add branding
    this._addBranding(pptSlide, slideNumber);

    let currentY = this.theme.spacing.titleTop;

    // Title
    if (content.title) {
      pptSlide.addText(content.title, {
        x: this.theme.spacing.slideMargin,
        y: currentY,
        w: this.slideWidth - (this.theme.spacing.slideMargin * 2),
        h: 0.8,
        align: 'left',
        valign: 'top',
        fontFace: this.theme.fonts.title.family,
        fontSize: this.theme.fonts.title.size,
        bold: true,
        color: this._hexToRgb(this.theme.colors.primary)
      });
      currentY += 1;
    }

    // Bullets
    if (content.bullets && content.bullets.length > 0) {
      const bulletItems = this._formatBullets(content.bullets);

      pptSlide.addText(bulletItems, {
        x: this.theme.spacing.slideMargin,
        y: currentY,
        w: this.slideWidth - (this.theme.spacing.slideMargin * 2),
        h: this.slideHeight - currentY - 0.5,
        fontFace: this.theme.fonts.body.family,
        fontSize: this.theme.fonts.body.size,
        color: this._hexToRgb(this.theme.fonts.body.color),
        bullet: { type: 'number', code: '2022', indent: 0.3 },
        lineSpacing: Math.round(this.theme.spacing.lineSpacing * 100) / 100
      });
    }

    // Add notes if present
    if (slideData.notes) {
      pptSlide.addNotes(slideData.notes);
    }

    return pptSlide;
  }

  /**
   * Format bullets for PowerPoint (supports nesting)
   * @private
   */
  _formatBullets(bullets, level = 0) {
    const formatted = [];

    bullets.forEach(bullet => {
      const text = typeof bullet === 'string' ? bullet : bullet.text;

      formatted.push({
        text: text,
        options: {
          bullet: level === 0 ? { code: '2022' } : { code: '25E6' }, // ● or ◦
          indentLevel: level,
          fontSize: this.theme.fonts.body.size - (level * 2)
        }
      });

      // Handle nested bullets
      if (typeof bullet === 'object' && bullet.subitems && bullet.subitems.length > 0) {
        const nested = this._formatBullets(bullet.subitems, level + 1);
        formatted.push(...nested);
      }
    });

    return formatted;
  }

  /**
   * Add a two-column slide
   * @private
   */
  _addTwoColumnSlide(slideData, slideNumber) {
    const pptSlide = this.pptx.addSlide();
    const content = slideData.content || {};

    // Set background
    pptSlide.background = { color: this._hexToRgb(this.theme.colors.background) };

    // Add branding
    this._addBranding(pptSlide, slideNumber);

    let currentY = this.theme.spacing.titleTop;

    // Title
    if (content.title) {
      pptSlide.addText(content.title, {
        x: this.theme.spacing.slideMargin,
        y: currentY,
        w: this.slideWidth - (this.theme.spacing.slideMargin * 2),
        h: 0.8,
        align: 'left',
        valign: 'top',
        fontFace: this.theme.fonts.title.family,
        fontSize: this.theme.fonts.title.size,
        bold: true,
        color: this._hexToRgb(this.theme.colors.primary)
      });
      currentY += 1;
    }

    // Calculate column dimensions
    const columnGap = 0.3;
    const columnWidth = (this.slideWidth - (this.theme.spacing.slideMargin * 2) - columnGap) / 2;
    const columnHeight = this.slideHeight - currentY - 0.5;

    // Left column
    if (content.leftColumn) {
      this._addColumn(
        pptSlide,
        content.leftColumn,
        this.theme.spacing.slideMargin,
        currentY,
        columnWidth,
        columnHeight
      );
    }

    // Right column
    if (content.rightColumn) {
      this._addColumn(
        pptSlide,
        content.rightColumn,
        this.theme.spacing.slideMargin + columnWidth + columnGap,
        currentY,
        columnWidth,
        columnHeight
      );
    }

    // Add notes if present
    if (slideData.notes) {
      pptSlide.addNotes(slideData.notes);
    }

    return pptSlide;
  }

  /**
   * Add a column to a two-column slide
   * @private
   */
  _addColumn(pptSlide, columnData, x, y, w, h) {
    if (!columnData) return;

    let currentY = y;

    // Column background
    pptSlide.addShape(this.pptx.ShapeType.rect, {
      x: x,
      y: y,
      w: w,
      h: h,
      fill: { color: this._hexToRgb(this.theme.colors.surface) },
      line: { color: this._hexToRgb(this.theme.colors.surface), width: 0 }
    });

    // Column title
    if (columnData.title) {
      pptSlide.addText(columnData.title, {
        x: x + 0.2,
        y: currentY + 0.2,
        w: w - 0.4,
        h: 0.5,
        fontFace: this.theme.fonts.subtitle.family,
        fontSize: this.theme.fonts.subtitle.size,
        bold: true,
        color: this._hexToRgb(this.theme.colors.secondary)
      });
      currentY += 0.7;
    }

    // Column content (bullets or text)
    if (columnData.bullets && columnData.bullets.length > 0) {
      const bulletItems = this._formatBullets(columnData.bullets);

      pptSlide.addText(bulletItems, {
        x: x + 0.2,
        y: currentY,
        w: w - 0.4,
        h: h - (currentY - y) - 0.2,
        fontFace: this.theme.fonts.body.family,
        fontSize: this.theme.fonts.body.size - 2,
        color: this._hexToRgb(this.theme.fonts.body.color),
        bullet: { type: 'number', code: '2022', indent: 0.2 },
        lineSpacing: Math.round(this.theme.spacing.lineSpacing * 100) / 100
      });
    } else if (columnData.text) {
      pptSlide.addText(columnData.text, {
        x: x + 0.2,
        y: currentY,
        w: w - 0.4,
        h: h - (currentY - y) - 0.2,
        fontFace: this.theme.fonts.body.family,
        fontSize: this.theme.fonts.body.size - 2,
        color: this._hexToRgb(this.theme.fonts.body.color),
        valign: 'top'
      });
    }
  }

  /**
   * Add an image slide
   * @private
   */
  _addImageSlide(slideData, slideNumber) {
    const pptSlide = this.pptx.addSlide();
    const content = slideData.content || {};

    // Set background
    pptSlide.background = { color: this._hexToRgb(this.theme.colors.background) };

    // Add branding
    this._addBranding(pptSlide, slideNumber);

    let currentY = this.theme.spacing.titleTop;

    // Title
    if (content.title && content.title.text) {
      pptSlide.addText(content.title.text, {
        x: this.theme.spacing.slideMargin,
        y: currentY,
        w: this.slideWidth - (this.theme.spacing.slideMargin * 2),
        h: 0.6,
        align: 'left',
        valign: 'top',
        fontFace: this.theme.fonts.title.family,
        fontSize: this.theme.fonts.title.size,
        bold: true,
        color: this._hexToRgb(this.theme.colors.primary)
      });
      currentY += 0.8;
    }

    // Image
    if (content.image && content.image.src) {
      const imageWidth = (this.slideWidth - (this.theme.spacing.slideMargin * 2)) * 0.9;
      const imageHeight = this.slideHeight - currentY - 0.8;
      const imageX = this.theme.spacing.slideMargin + ((this.slideWidth - (this.theme.spacing.slideMargin * 2)) - imageWidth) / 2;

      try {
        pptSlide.addImage({
          path: content.image.src,
          x: imageX,
          y: currentY,
          w: imageWidth,
          h: imageHeight,
          sizing: { type: 'contain' }
        });
      } catch (error) {
        console.warn('[PPTRenderer] Could not add image:', error.message);
        // Add placeholder text
        pptSlide.addText('[Image placeholder]', {
          x: imageX,
          y: currentY + imageHeight / 2,
          w: imageWidth,
          h: 0.5,
          align: 'center',
          fontSize: 16,
          color: '999999'
        });
      }

      // Caption
      if (content.image.caption) {
        pptSlide.addText(content.image.caption, {
          x: this.theme.spacing.slideMargin,
          y: this.slideHeight - 0.5,
          w: this.slideWidth - (this.theme.spacing.slideMargin * 2),
          h: 0.3,
          align: 'center',
          fontSize: this.theme.fonts.caption.size,
          color: this._hexToRgb(this.theme.fonts.caption.color)
        });
      }
    }

    // Add notes if present
    if (slideData.notes) {
      pptSlide.addNotes(slideData.notes);
    }

    return pptSlide;
  }

  /**
   * Add a section header slide
   * @private
   */
  _addSectionSlide(slideData, slideNumber) {
    const pptSlide = this.pptx.addSlide();
    const content = slideData.content || {};

    // Apply gradient background
    if (content.background && content.background.type === 'gradient') {
      const gradient = content.background.gradient;
      const colors = gradient.colors || ['3b82f6', '8b5cf6'];

      // PptxGenJS gradient format
      pptSlide.background = {
        fill: colors[0].replace('#', '')
      };

      // Add gradient shape overlay
      pptSlide.addShape(this.pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: this.slideWidth,
        h: this.slideHeight,
        fill: {
          type: 'solid',
          color: colors[1].replace('#', ''),
          transparency: 40
        },
        line: { type: 'none' }
      });
    } else {
      pptSlide.background = { color: this._hexToRgb(this.theme.colors.primary) };
    }

    // Section number
    if (content.sectionNumber) {
      pptSlide.addText(content.sectionNumber, {
        x: 0,
        y: 1.5,
        w: this.slideWidth,
        h: 1.5,
        align: 'center',
        valign: 'middle',
        fontSize: 80,
        bold: true,
        color: 'FFFFFF',
        transparency: 70
      });
    }

    // Section title
    if (content.sectionTitle && content.sectionTitle.text) {
      pptSlide.addText(content.sectionTitle.text, {
        x: 0.5,
        y: 2.3,
        w: this.slideWidth - 1,
        h: 1,
        align: 'center',
        valign: 'middle',
        fontSize: content.sectionTitle.fontSize || 48,
        bold: true,
        color: 'FFFFFF'
      });
    }

    // Description
    if (content.description && content.description.text) {
      pptSlide.addText(content.description.text, {
        x: 1,
        y: 3.5,
        w: this.slideWidth - 2,
        h: 0.8,
        align: 'center',
        valign: 'top',
        fontSize: content.description.fontSize || 20,
        color: 'FFFFFF'
      });
    }

    // Add notes if present
    if (slideData.notes) {
      pptSlide.addNotes(slideData.notes);
    }

    return pptSlide;
  }

  /**
   * Add a quote slide
   * @private
   */
  _addQuoteSlide(slideData, slideNumber) {
    const pptSlide = this.pptx.addSlide();
    const content = slideData.content || {};

    // Set background
    pptSlide.background = { color: this._hexToRgb(this.theme.colors.background) };

    // Add branding
    this._addBranding(pptSlide, slideNumber);

    // Quote marks (decorative)
    if (content.quoteMarks && content.quoteMarks.enabled) {
      pptSlide.addText('"', {
        x: 1,
        y: 1.5,
        w: 1,
        h: 1,
        fontSize: 120,
        bold: true,
        color: this._hexToRgb(content.quoteMarks.color || this.theme.colors.primary),
        transparency: 80
      });
    }

    // Quote text
    if (content.quote && content.quote.text) {
      pptSlide.addText(content.quote.text, {
        x: 1,
        y: 2,
        w: this.slideWidth - 2,
        h: 1.5,
        align: content.quote.alignment || 'center',
        valign: 'middle',
        fontSize: content.quote.fontSize || 32,
        italic: content.quote.fontStyle === 'italic',
        color: this._hexToRgb(content.quote.color || this.theme.fonts.title.color)
      });
    }

    // Attribution
    if (content.attribution && content.attribution.text) {
      pptSlide.addText(content.attribution.text, {
        x: 1,
        y: 4,
        w: this.slideWidth - 2,
        h: 0.4,
        align: content.attribution.alignment || 'right',
        fontSize: content.attribution.fontSize || 18,
        color: this._hexToRgb(content.attribution.color || this.theme.fonts.caption.color)
      });
    }

    // Add notes if present
    if (slideData.notes) {
      pptSlide.addNotes(slideData.notes);
    }

    return pptSlide;
  }

  /**
   * Add a table slide
   * @private
   */
  _addTableSlide(slideData, slideNumber) {
    const pptSlide = this.pptx.addSlide();
    const content = slideData.content || {};

    // Set background
    pptSlide.background = { color: this._hexToRgb(this.theme.colors.background) };

    // Add branding
    this._addBranding(pptSlide, slideNumber);

    let currentY = this.theme.spacing.titleTop;

    // Title
    if (content.title && content.title.text) {
      pptSlide.addText(content.title.text, {
        x: this.theme.spacing.slideMargin,
        y: currentY,
        w: this.slideWidth - (this.theme.spacing.slideMargin * 2),
        h: 0.6,
        align: 'left',
        valign: 'top',
        fontFace: this.theme.fonts.title.family,
        fontSize: this.theme.fonts.title.size,
        bold: true,
        color: this._hexToRgb(this.theme.colors.primary)
      });
      currentY += 0.8;
    }

    // Table
    if (content.table && content.table.headers && content.table.rows) {
      const tableRows = [];

      // Header row
      const headerCells = content.table.headers.map(header => ({
        text: header.text || header,
        options: {
          bold: true,
          fontSize: this.theme.fonts.body.size - 2,
          color: this._hexToRgb(content.table.style?.headerTextColor || '#ffffff'),
          fill: this._hexToRgb(content.table.style?.headerBackgroundColor || this.theme.colors.primary),
          align: header.alignment || 'left'
        }
      }));
      tableRows.push(headerCells);

      // Data rows
      content.table.rows.forEach((row, rowIndex) => {
        const cells = row.map(cell => ({
          text: cell.text || cell,
          options: {
            fontSize: this.theme.fonts.body.size - 4,
            color: this._hexToRgb(this.theme.fonts.body.color),
            fill: (content.table.style?.alternateRowColors && rowIndex % 2 === 1)
              ? 'F9FAFB'
              : 'FFFFFF',
            align: cell.alignment || 'left'
          }
        }));
        tableRows.push(cells);
      });

      pptSlide.addTable(tableRows, {
        x: this.theme.spacing.slideMargin,
        y: currentY,
        w: this.slideWidth - (this.theme.spacing.slideMargin * 2),
        h: this.slideHeight - currentY - 0.5,
        border: {
          pt: content.table.style?.borderWidth || 1,
          color: this._hexToRgb(content.table.style?.borderColor || '#e5e7eb')
        }
      });
    }

    // Add notes if present
    if (slideData.notes) {
      pptSlide.addNotes(slideData.notes);
    }

    return pptSlide;
  }

  /**
   * Add a comparison slide
   * @private
   */
  _addComparisonSlide(slideData, slideNumber) {
    const pptSlide = this.pptx.addSlide();
    const content = slideData.content || {};

    // Set background
    pptSlide.background = { color: this._hexToRgb(this.theme.colors.background) };

    // Add branding
    this._addBranding(pptSlide, slideNumber);

    let currentY = this.theme.spacing.titleTop;

    // Title
    if (content.title && content.title.text) {
      pptSlide.addText(content.title.text, {
        x: this.theme.spacing.slideMargin,
        y: currentY,
        w: this.slideWidth - (this.theme.spacing.slideMargin * 2),
        h: 0.6,
        align: 'left',
        valign: 'top',
        fontFace: this.theme.fonts.title.family,
        fontSize: this.theme.fonts.title.size,
        bold: true,
        color: this._hexToRgb(this.theme.colors.primary)
      });
      currentY += 0.8;
    }

    // Comparison items
    if (content.items && Array.isArray(content.items)) {
      const itemCount = content.items.length;
      const gap = 0.2;
      const itemWidth = (this.slideWidth - (this.theme.spacing.slideMargin * 2) - (gap * (itemCount - 1))) / itemCount;
      const itemHeight = this.slideHeight - currentY - 0.5;

      content.items.forEach((item, index) => {
        const itemX = this.theme.spacing.slideMargin + (index * (itemWidth + gap));

        // Item background box
        pptSlide.addShape(this.pptx.ShapeType.rect, {
          x: itemX,
          y: currentY,
          w: itemWidth,
          h: itemHeight,
          fill: { color: this._hexToRgb(item.backgroundColor || this.theme.colors.surface) },
          line: {
            color: this._hexToRgb(item.borderColor || this.theme.colors.primary),
            width: 2
          }
        });

        let itemY = currentY + 0.2;

        // Icon + Label header
        const headerText = item.icon ? `${item.icon} ${item.label}` : item.label;
        pptSlide.addText(headerText, {
          x: itemX + 0.1,
          y: itemY,
          w: itemWidth - 0.2,
          h: 0.5,
          fontSize: this.theme.fonts.subtitle.size - 4,
          bold: true,
          color: this._hexToRgb(this.theme.fonts.title.color)
        });

        itemY += 0.6;

        // Add divider line
        pptSlide.addShape(this.pptx.ShapeType.line, {
          x: itemX + 0.1,
          y: itemY,
          w: itemWidth - 0.2,
          h: 0,
          line: {
            color: this._hexToRgb(item.borderColor || this.theme.colors.primary),
            width: 1
          }
        });

        itemY += 0.1;

        // Bullets
        if (item.bullets && item.bullets.length > 0) {
          const bulletText = item.bullets.map(bullet => ({
            text: `${bullet.icon || '•'} ${bullet.text}`,
            options: {
              bullet: false,
              fontSize: this.theme.fonts.body.size - 6,
              color: this._hexToRgb(this.theme.fonts.body.color)
            }
          }));

          pptSlide.addText(bulletText, {
            x: itemX + 0.15,
            y: itemY,
            w: itemWidth - 0.3,
            h: itemHeight - (itemY - currentY) - 0.2,
            fontSize: this.theme.fonts.body.size - 6,
            color: this._hexToRgb(this.theme.fonts.body.color)
          });
        }
      });
    }

    // Add notes if present
    if (slideData.notes) {
      pptSlide.addNotes(slideData.notes);
    }

    return pptSlide;
  }

  /**
   * Add branding (logo and footer) to slide
   * @private
   */
  _addBranding(pptSlide, slideNumber) {
    // Add logo if enabled
    if (this.theme.branding.logo.show && this.theme.branding.logo.url) {
      const logoWidth = this.theme.branding.logo.width || 1.5;
      const logoHeight = logoWidth * 0.5; // Assume 2:1 aspect ratio
      const position = this.theme.branding.logo.position || 'top-right';

      let logoX, logoY;
      switch (position) {
        case 'top-left':
          logoX = 0.2;
          logoY = 0.2;
          break;
        case 'top-right':
          logoX = this.slideWidth - logoWidth - 0.2;
          logoY = 0.2;
          break;
        case 'bottom-left':
          logoX = 0.2;
          logoY = this.slideHeight - logoHeight - 0.2;
          break;
        case 'bottom-right':
          logoX = this.slideWidth - logoWidth - 0.2;
          logoY = this.slideHeight - logoHeight - 0.2;
          break;
        default:
          logoX = this.slideWidth - logoWidth - 0.2;
          logoY = 0.2;
      }

      // Note: PptxGenJS requires image path or data URL
      // For now, we'll add a placeholder if URL is provided
      try {
        pptSlide.addImage({
          path: this.theme.branding.logo.url,
          x: logoX,
          y: logoY,
          w: logoWidth,
          h: logoHeight
        });
      } catch (error) {
        console.warn('[PPTRenderer] Could not add logo:', error.message);
      }
    }

    // Add footer if enabled
    if (this.theme.branding.footer.show && this.theme.branding.footer.text) {
      pptSlide.addText(this.theme.branding.footer.text, {
        x: 0.5,
        y: this.slideHeight - 0.4,
        w: this.slideWidth - 1.5,
        h: 0.3,
        fontFace: this.theme.fonts.caption.family,
        fontSize: this.theme.branding.footer.fontSize || 12,
        color: this._hexToRgb(this.theme.fonts.caption.color),
        align: 'left',
        valign: 'bottom'
      });

      // Add slide number
      pptSlide.addText(slideNumber.toString(), {
        x: this.slideWidth - 1,
        y: this.slideHeight - 0.4,
        w: 0.5,
        h: 0.3,
        fontFace: this.theme.fonts.caption.family,
        fontSize: this.theme.branding.footer.fontSize || 12,
        color: this._hexToRgb(this.theme.fonts.caption.color),
        align: 'right',
        valign: 'bottom'
      });
    }
  }

  /**
   * Add error slide when slide data is invalid
   * @private
   */
  _addErrorSlide(message) {
    const pptSlide = this.pptx.addSlide();
    pptSlide.background = { color: 'FEF2F2' };

    pptSlide.addText(message, {
      x: 1,
      y: 2,
      w: this.slideWidth - 2,
      h: 1.5,
      align: 'center',
      valign: 'middle',
      fontSize: 28,
      color: 'DC2626',
      bold: true
    });

    return pptSlide;
  }

  /**
   * Add placeholder for unsupported slide types
   * @private
   */
  _addUnsupportedSlide(slideData, slideNumber) {
    const pptSlide = this.pptx.addSlide();
    pptSlide.background = { color: this._hexToRgb(this.theme.colors.surface) };

    const slideTypeName = slideData.type.charAt(0).toUpperCase() + slideData.type.slice(1);

    pptSlide.addText(`${slideTypeName} Slide`, {
      x: 1,
      y: 2,
      w: this.slideWidth - 2,
      h: 1,
      align: 'center',
      valign: 'middle',
      fontSize: 32,
      color: this._hexToRgb(this.theme.colors.textSecondary),
      bold: true
    });

    pptSlide.addText('Renderer coming soon', {
      x: 1,
      y: 3,
      w: this.slideWidth - 2,
      h: 0.5,
      align: 'center',
      valign: 'top',
      fontSize: 18,
      color: this._hexToRgb(this.theme.colors.textSecondary)
    });

    return pptSlide;
  }

  /**
   * Convert hex color to RGB format for PowerPoint
   * @private
   */
  _hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Return hex string without # (PowerPoint format)
    return hex.toUpperCase();
  }

  /**
   * Add multiple slides to the presentation
   * @param {Array} slides - Array of slide data objects
   */
  addAllSlides(slides) {
    if (!Array.isArray(slides)) {
      console.error('[PPTRenderer] Invalid slides array:', slides);
      return;
    }

    slides.forEach((slide, index) => {
      this.addSlide(slide, index + 1);
    });
  }

  /**
   * Export the presentation to PowerPoint file
   * @param {string} filename - Output filename (without extension)
   * @returns {Promise} - Resolves when file is downloaded
   */
  async export(filename = 'presentation') {
    if (!this.pptx) {
      throw new Error('Presentation not initialized. Call initializePresentation() first.');
    }

    try {
      await this.pptx.writeFile({ fileName: `${filename}.pptx` });
      console.log(`[PPTRenderer] Exported: ${filename}.pptx`);
    } catch (error) {
      console.error('[PPTRenderer] Export failed:', error);
      throw error;
    }
  }

  /**
   * Update theme and reinitialize if needed
   * @param {Object} newTheme - New theme configuration
   */
  updateTheme(newTheme) {
    this.theme = { ...this.theme, ...newTheme };
    this._initializeDefaults();
  }

  /**
   * Get current PowerPoint instance
   * @returns {Object} - PptxGenJS instance
   */
  getPresentation() {
    return this.pptx;
  }
}

export default PPTRenderer;
