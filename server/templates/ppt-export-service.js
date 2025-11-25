/**
 * PPT Export Service
 *
 * Generates branded PowerPoint presentations from slide JSON data.
 * Uses exact positioning from the template configuration.
 */

import PptxGenJS from 'pptxgenjs';
import {
  COLORS,
  FONTS,
  SLIDE_SIZE,
  LAYOUTS,
  DEFAULT_METADATA
} from './ppt-template-config.js';

/**
 * Generate a branded PowerPoint presentation from slides data
 * @param {Object} slidesData - Slides data from the generator
 * @param {Object} options - Export options
 * @returns {Promise<Buffer>} - PowerPoint file as buffer
 */
export async function generatePptx(slidesData, options = {}) {
  const pptx = new PptxGenJS();

  // Set presentation metadata
  pptx.author = options.author || DEFAULT_METADATA.author;
  pptx.company = options.company || DEFAULT_METADATA.company;
  pptx.title = slidesData.title || DEFAULT_METADATA.title;
  pptx.subject = options.subject || DEFAULT_METADATA.subject;
  pptx.revision = DEFAULT_METADATA.revision;

  // Set slide size (16:9 widescreen)
  pptx.defineLayout({
    name: 'CUSTOM_16_9',
    width: SLIDE_SIZE.width,
    height: SLIDE_SIZE.height
  });
  pptx.layout = 'CUSTOM_16_9';

  // Generate each slide
  for (let i = 0; i < slidesData.slides.length; i++) {
    const slideData = slidesData.slides[i];
    const slideNumber = i + 1;
    const isFirstSlide = i === 0;
    const isLastSlide = i === slidesData.slides.length - 1;

    // Determine which layout to use
    if (isFirstSlide && slideData.type === 'title') {
      addTitleSlide(pptx, slideData, slidesData);
    } else if (isLastSlide && (slideData.type === 'title' || slideData.title?.toLowerCase().includes('thank'))) {
      addThankYouSlide(pptx, slideData);
    } else {
      switch (slideData.type) {
        case 'title':
          addSectionSlide(pptx, slideData, slideNumber);
          break;
        case 'titleWithImage':
          addTitleWithImageSlide(pptx, slideData);
          break;
        case 'bullets':
          addBulletsSlide(pptx, slideData, slideNumber);
          break;
        case 'content':
          addContentSlide(pptx, slideData, slideNumber);
          break;
        case 'quote':
          addQuoteSlide(pptx, slideData, slideNumber);
          break;
        case 'cardGrid':
          addCardGridSlide(pptx, slideData, slideNumber);
          break;
        case 'tableOfContents':
        case 'toc':
          addTableOfContentsSlide(pptx, slideData, slideNumber);
          break;
        case 'steps':
        case 'process':
          addProcessStepsSlide(pptx, slideData, slideNumber);
          break;
        case 'featureGrid':
        case 'featureGridRed':
          addFeatureGridSlide(pptx, slideData, slideNumber);
          break;
        case 'quoteTwoColumn':
          addQuoteTwoColumnSlide(pptx, slideData, slideNumber);
          break;
        case 'quoteWithMetrics':
          addQuoteWithMetricsSlide(pptx, slideData, slideNumber);
          break;
        case 'timelineCards':
        case 'timeline':
          addTimelineCardsSlide(pptx, slideData, slideNumber);
          break;
        case 'timelineCardsAlt':
          addTimelineCardsAltSlide(pptx, slideData, slideNumber);
          break;
        case 'timelinePhases':
          addTimelinePhasesSlide(pptx, slideData, slideNumber);
          break;
        case 'timelineNumberedMarkers':
          addTimelineNumberedMarkersSlide(pptx, slideData, slideNumber);
          break;
        case 'stepsVertical':
        case 'processStepsVertical':
          addStepsVerticalSlide(pptx, slideData, slideNumber);
          break;
        case 'processSteps5':
          addProcessSteps5Slide(pptx, slideData, slideNumber);
          break;
        case 'processStepsAlt':
          addProcessStepsAltSlide(pptx, slideData, slideNumber);
          break;
        case 'rolloutGrid':
          addRolloutGridSlide(pptx, slideData, slideNumber);
          break;
        case 'rolloutTimeline':
          addRolloutTimelineSlide(pptx, slideData, slideNumber);
          break;
        case 'ganttChart':
        case 'gantt':
          addGanttChartSlide(pptx, slideData, slideNumber);
          break;
        case 'rolloutDescription':
          addRolloutDescriptionSlide(pptx, slideData, slideNumber);
          break;
        case 'quoteDataA':
          addQuoteDataASlide(pptx, slideData, slideNumber);
          break;
        case 'quoteDataB':
          addQuoteDataBSlide(pptx, slideData, slideNumber);
          break;
        case 'dualChart':
          addDualChartSlide(pptx, slideData, slideNumber);
          break;
        case 'table':
        case 'dataTable':
          addTableSlide(pptx, slideData, slideNumber);
          break;
        case 'titleVariantA':
          addTitleVariantASlide(pptx, slideData);
          break;
        case 'titleVariantB':
          addTitleVariantBSlide(pptx, slideData);
          break;
        case 'contentsNav':
          addContentsNavSlide(pptx, slideData, slideNumber);
          break;
        case 'thankYouAlt':
          addThankYouAltSlide(pptx, slideData);
          break;
        default:
          addBulletsSlide(pptx, slideData, slideNumber);
      }
    }
  }

  // Generate and return buffer
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  return buffer;
}

/**
 * Add title slide (first slide)
 */
function addTitleSlide(pptx, slideData, presentationData) {
  const layout = LAYOUTS.title;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Add geometric pattern placeholder (gray rectangle until graphic provided)
  slide.addShape('rect', {
    x: layout.elements.banner.x,
    y: layout.elements.banner.y,
    w: layout.elements.banner.w,
    h: layout.elements.banner.h,
    fill: { color: '4A5568' }  // Placeholder gray
  });

  // Add date
  const now = new Date();
  const dateText = `${now.toLocaleString('en-US', { month: 'long' })} | ${now.getFullYear()}`;
  slide.addText(dateText, {
    x: layout.elements.date.x,
    y: layout.elements.date.y,
    w: layout.elements.date.w,
    h: layout.elements.date.h,
    fontSize: layout.elements.date.fontSize,
    fontFace: layout.elements.date.fontFace,
    color: layout.elements.date.color,
    align: layout.elements.date.align
  });

  // Add main title
  slide.addText(slideData.title || presentationData.title || 'Presentation Title', {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align,
    lineSpacing: layout.elements.title.lineSpacing
  });

  // Add subtitle if present
  if (slideData.subtitle) {
    slide.addText(slideData.subtitle, {
      x: layout.elements.title.x,
      y: layout.elements.title.y + 1.8,
      w: layout.elements.title.w,
      h: 0.5,
      fontSize: 24,
      fontFace: FONTS.regular,
      color: COLORS.white,
      align: 'left'
    });
  }

  // Add logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo);

  // Add tagline
  slide.addText(layout.elements.tagline.text, {
    x: layout.elements.tagline.x,
    y: layout.elements.tagline.y,
    w: layout.elements.tagline.w,
    h: layout.elements.tagline.h,
    fontSize: layout.elements.tagline.fontSize,
    fontFace: layout.elements.tagline.fontFace,
    color: layout.elements.tagline.color,
    align: layout.elements.tagline.align,
    bold: true
  });
}

/**
 * Add title with image slide (split layout - Slide 2)
 */
function addTitleWithImageSlide(pptx, slideData) {
  const layout = LAYOUTS.titleWithImage;
  const slide = pptx.addSlide();

  // Left navy panel
  slide.addShape('rect', {
    x: layout.elements.leftPanel.x,
    y: layout.elements.leftPanel.y,
    w: layout.elements.leftPanel.w,
    h: layout.elements.leftPanel.h,
    fill: { color: layout.elements.leftPanel.fill }
  });

  // Tagline (top of left panel)
  if (slideData.tagline) {
    slide.addText(slideData.tagline.toUpperCase(), {
      x: layout.elements.tagline.x,
      y: layout.elements.tagline.y,
      w: layout.elements.tagline.w,
      h: layout.elements.tagline.h,
      fontSize: layout.elements.tagline.fontSize,
      fontFace: layout.elements.tagline.fontFace,
      color: layout.elements.tagline.color,
      align: layout.elements.tagline.align
    });
  }

  // Main title
  slide.addText(slideData.title || 'Presentation Title', {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align,
    lineSpacing: layout.elements.title.lineSpacing
  });

  // Logo placeholder (bottom left)
  addLogoPlaceholder(slide, layout.elements.logo, 'small');

  // Business Area
  if (slideData.businessArea) {
    slide.addText(slideData.businessArea, {
      x: layout.elements.businessArea.x,
      y: layout.elements.businessArea.y,
      w: layout.elements.businessArea.w,
      h: layout.elements.businessArea.h,
      fontSize: layout.elements.businessArea.fontSize,
      fontFace: layout.elements.businessArea.fontFace,
      color: layout.elements.businessArea.color,
      align: layout.elements.businessArea.align
    });
  }

  // Date
  const now = new Date();
  const dateText = slideData.date || `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`;
  slide.addText(dateText, {
    x: layout.elements.date.x,
    y: layout.elements.date.y,
    w: layout.elements.date.w,
    h: layout.elements.date.h,
    fontSize: layout.elements.date.fontSize,
    fontFace: layout.elements.date.fontFace,
    color: layout.elements.date.color,
    align: layout.elements.date.align
  });

  // Right image placeholder (or actual image if provided)
  if (slideData.image) {
    slide.addImage({
      path: slideData.image,
      x: layout.elements.image.x,
      y: layout.elements.image.y,
      w: layout.elements.image.w,
      h: layout.elements.image.h
    });
  } else {
    // Gray placeholder for image
    slide.addShape('rect', {
      x: layout.elements.image.x,
      y: layout.elements.image.y,
      w: layout.elements.image.w,
      h: layout.elements.image.h,
      fill: { color: '4A5568' }
    });
  }
}

/**
 * Add section divider slide
 */
function addSectionSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.sectionDivider;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section number (small)
  const sectionNum = String(slideNumber).padStart(2, '0');
  slide.addText(sectionNum, {
    x: layout.elements.sectionNumber.x,
    y: layout.elements.sectionNumber.y,
    w: layout.elements.sectionNumber.w,
    h: layout.elements.sectionNumber.h,
    fontSize: layout.elements.sectionNumber.fontSize,
    fontFace: layout.elements.sectionNumber.fontFace,
    color: layout.elements.sectionNumber.color,
    align: layout.elements.sectionNumber.align
  });

  // Large section number (watermark)
  slide.addText(sectionNum, {
    x: layout.elements.largeNumber.x,
    y: layout.elements.largeNumber.y,
    w: layout.elements.largeNumber.w,
    h: layout.elements.largeNumber.h,
    fontSize: 200,  // Reduced from 413 to fit better
    fontFace: layout.elements.largeNumber.fontFace,
    color: layout.elements.largeNumber.color,
    align: layout.elements.largeNumber.align,
    valign: layout.elements.largeNumber.valign
  });

  // Section title
  slide.addText(slideData.title || 'Section Title', {
    x: layout.elements.sectionTitle.x,
    y: layout.elements.sectionTitle.y,
    w: layout.elements.sectionTitle.w,
    h: layout.elements.sectionTitle.h,
    fontSize: layout.elements.sectionTitle.fontSize,
    fontFace: layout.elements.sectionTitle.fontFace,
    color: layout.elements.sectionTitle.color,
    align: layout.elements.sectionTitle.align,
    valign: layout.elements.sectionTitle.valign,
    lineSpacing: layout.elements.sectionTitle.lineSpacing
  });
}

/**
 * Add bullets slide
 */
function addBulletsSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.bullets;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  slide.addText('LOREM IPSUM', {
    x: layout.elements.sectionLabel.x,
    y: layout.elements.sectionLabel.y,
    w: layout.elements.sectionLabel.w,
    h: layout.elements.sectionLabel.h,
    fontSize: layout.elements.sectionLabel.fontSize,
    fontFace: layout.elements.sectionLabel.fontFace,
    color: layout.elements.sectionLabel.color,
    align: layout.elements.sectionLabel.align
  });

  // Main title
  slide.addText(slideData.title || 'Slide Title', {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align,
    lineSpacing: layout.elements.title.lineSpacing
  });

  // Bullets
  if (slideData.bullets && slideData.bullets.length > 0) {
    const bulletItems = slideData.bullets.map(bullet => ({
      text: bullet,
      options: {
        bullet: { type: 'bullet', color: COLORS.red },
        fontSize: layout.elements.bullets.fontSize,
        fontFace: layout.elements.bullets.fontFace,
        color: layout.elements.bullets.color
      }
    }));

    slide.addText(bulletItems, {
      x: layout.elements.bullets.x,
      y: layout.elements.bullets.y,
      w: layout.elements.bullets.w,
      h: layout.elements.bullets.h,
      lineSpacing: layout.elements.bullets.lineSpacing / 100 * layout.elements.bullets.fontSize
    });
  }

  // Geometric accent placeholder
  slide.addShape('rect', {
    x: layout.elements.accent.x,
    y: layout.elements.accent.y,
    w: layout.elements.accent.w,
    h: layout.elements.accent.h,
    fill: { color: '4A5568' }  // Placeholder
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add content slide (paragraphs)
 */
function addContentSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.content;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  slide.addText('LOREM IPSUM', {
    x: layout.elements.sectionLabel.x,
    y: layout.elements.sectionLabel.y,
    w: layout.elements.sectionLabel.w,
    h: layout.elements.sectionLabel.h,
    fontSize: layout.elements.sectionLabel.fontSize,
    fontFace: layout.elements.sectionLabel.fontFace,
    color: layout.elements.sectionLabel.color,
    align: layout.elements.sectionLabel.align
  });

  // Main title
  slide.addText(slideData.title || 'Slide Title', {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align,
    lineSpacing: layout.elements.title.lineSpacing
  });

  // Content text
  if (slideData.content) {
    slide.addText(slideData.content, {
      x: layout.elements.content.x,
      y: layout.elements.content.y,
      w: layout.elements.content.w,
      h: layout.elements.content.h,
      fontSize: layout.elements.content.fontSize,
      fontFace: layout.elements.content.fontFace,
      color: layout.elements.content.color,
      align: 'left',
      valign: 'top',
      lineSpacing: layout.elements.content.lineSpacing / 100 * layout.elements.content.fontSize
    });
  }

  // Geometric accent placeholder
  slide.addShape('rect', {
    x: layout.elements.accent.x,
    y: layout.elements.accent.y,
    w: layout.elements.accent.w,
    h: layout.elements.accent.h,
    fill: { color: '4A5568' }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add quote slide
 */
function addQuoteSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.quote;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Pattern placeholder (left side)
  slide.addShape('rect', {
    x: layout.elements.pattern.x,
    y: layout.elements.pattern.y,
    w: layout.elements.pattern.w,
    h: layout.elements.pattern.h,
    fill: { color: '4A5568' }
  });

  // Section label
  slide.addText('LOREM IPSUM', {
    x: layout.elements.sectionLabel.x,
    y: layout.elements.sectionLabel.y,
    w: layout.elements.sectionLabel.w,
    h: layout.elements.sectionLabel.h,
    fontSize: layout.elements.sectionLabel.fontSize,
    fontFace: layout.elements.sectionLabel.fontFace,
    color: layout.elements.sectionLabel.color,
    align: layout.elements.sectionLabel.align
  });

  // Quote title
  slide.addText(slideData.title || 'Quote', {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align
  });

  // Quote text with red left border
  if (slideData.quote) {
    // Add red border line
    slide.addShape('rect', {
      x: layout.elements.quote.x - 0.1,
      y: layout.elements.quote.y,
      w: 0.05,
      h: 2,
      fill: { color: COLORS.red }
    });

    // Add quote text
    slide.addText(`"${slideData.quote}"`, {
      x: layout.elements.quote.x + 0.2,
      y: layout.elements.quote.y,
      w: layout.elements.quote.w - 0.2,
      h: layout.elements.quote.h,
      fontSize: layout.elements.quote.fontSize,
      fontFace: layout.elements.quote.fontFace,
      color: layout.elements.quote.color,
      align: layout.elements.quote.align,
      italic: true
    });

    // Attribution
    if (slideData.attribution) {
      slide.addText(`— ${slideData.attribution}`, {
        x: layout.elements.quote.x + 0.2,
        y: layout.elements.quote.y + 2.5,
        w: layout.elements.quote.w - 0.2,
        h: 0.3,
        fontSize: 12,
        fontFace: FONTS.semibold,
        color: COLORS.navy,
        align: 'left'
      });
    }
  }

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add thank you slide (last slide)
 */
function addThankYouSlide(pptx, slideData) {
  const layout = LAYOUTS.thankYou;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Pattern placeholder (top)
  slide.addShape('rect', {
    x: layout.elements.pattern.x,
    y: layout.elements.pattern.y,
    w: layout.elements.pattern.w,
    h: layout.elements.pattern.h,
    fill: { color: '4A5568' }
  });

  // Thank You text
  slide.addText(slideData.title || 'Thank You', {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align
  });

  // Contact info
  slide.addText('Website  |  Social Media', {
    x: layout.elements.contact.x,
    y: layout.elements.contact.y,
    w: layout.elements.contact.w,
    h: layout.elements.contact.h,
    fontSize: layout.elements.contact.fontSize,
    fontFace: layout.elements.contact.fontFace,
    color: layout.elements.contact.color,
    align: layout.elements.contact.align
  });

  // Large logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'large');
}

/**
 * Add table of contents slide (Slide 6)
 */
function addTableOfContentsSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.tableOfContents;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Logo (top left)
  addLogoPlaceholder(slide, layout.elements.logo, 'medium');

  // Large watermark text "Table of Contents"
  slide.addText('Table of\nContents', {
    x: layout.elements.watermark.x,
    y: layout.elements.watermark.y,
    w: layout.elements.watermark.w,
    h: layout.elements.watermark.h,
    fontSize: layout.elements.watermark.fontSize,
    fontFace: layout.elements.watermark.fontFace,
    color: layout.elements.watermark.color,
    align: layout.elements.watermark.align,
    valign: layout.elements.watermark.valign,
    lineSpacingMultiple: layout.elements.watermark.lineSpacing / 100
  });

  // TOC items (right side)
  const items = slideData.items || slideData.bullets || [];
  const itemsConfig = layout.elements.items;

  items.forEach((item, i) => {
    const y = itemsConfig.y + (i * itemsConfig.itemSpacing);

    // Number (red)
    slide.addText(`${i + 1}`, {
      x: itemsConfig.x,
      y: y,
      w: 0.5,
      h: 0.4,
      fontSize: itemsConfig.fontSize,
      fontFace: FONTS.semibold,
      color: COLORS.red,
      align: 'left'
    });

    // Item title (navy)
    slide.addText(item, {
      x: itemsConfig.x + 0.6,
      y: y,
      w: itemsConfig.w - 0.6,
      h: 0.4,
      fontSize: itemsConfig.fontSize,
      fontFace: itemsConfig.fontFace,
      color: itemsConfig.color,
      align: 'left'
    });
  });

  // Logo (bottom right)
  addLogoPlaceholder(slide, layout.elements.logoBottom, 'small');
}

/**
 * Add process steps slide (Slide 15 - horizontal numbered steps)
 */
function addProcessStepsSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.steps;
  const slide = pptx.addSlide();

  // Set background (red)
  slide.background = { color: layout.background };

  // Main title (left side)
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align,
      lineSpacingMultiple: layout.elements.title.lineSpacing / 100
    });
  }

  // Description text (top right)
  if (slideData.description) {
    slide.addText(slideData.description, {
      x: layout.elements.description.x,
      y: layout.elements.description.y,
      w: layout.elements.description.w,
      h: layout.elements.description.h,
      fontSize: layout.elements.description.fontSize,
      fontFace: layout.elements.description.fontFace,
      color: layout.elements.description.color,
      lineSpacingMultiple: layout.elements.description.lineSpacing / 100
    });
  }

  // Render steps (horizontal row)
  const steps = slideData.steps || [];
  const stepsConfig = layout.elements.stepsArea;
  const totalSteps = steps.length;
  const totalWidth = 12.33; // Available width
  const startX = 0.5;

  // Calculate dynamic step width based on number of steps
  const dynamicStepWidth = totalSteps > 0
    ? Math.min(stepsConfig.stepWidth, (totalWidth - (stepsConfig.stepGap * (totalSteps - 1))) / totalSteps)
    : stepsConfig.stepWidth;

  steps.forEach((step, i) => {
    const x = startX + (i * (dynamicStepWidth + stepsConfig.stepGap));
    const y = stepsConfig.y;

    // Step number circle
    slide.addShape('ellipse', {
      x: x + (dynamicStepWidth / 2) - 0.4,
      y: y - 0.5,
      w: 0.8,
      h: 0.8,
      fill: { color: COLORS.white }
    });

    // Step number text
    slide.addText(`${i + 1}`, {
      x: x + (dynamicStepWidth / 2) - 0.4,
      y: y - 0.5,
      w: 0.8,
      h: 0.8,
      fontSize: stepsConfig.numberFontSize,
      fontFace: FONTS.bold,
      color: COLORS.red,
      align: 'center',
      valign: 'middle'
    });

    // Step title
    if (step.title) {
      slide.addText(step.title, {
        x: x,
        y: y + 0.5,
        w: dynamicStepWidth,
        h: 0.6,
        fontSize: stepsConfig.titleFontSize,
        fontFace: FONTS.semibold,
        color: stepsConfig.color,
        align: 'center'
      });
    }

    // Step description
    if (step.description) {
      slide.addText(step.description, {
        x: x,
        y: y + 1.2,
        w: dynamicStepWidth,
        h: 1.2,
        fontSize: stepsConfig.descFontSize,
        fontFace: stepsConfig.fontFace,
        color: stepsConfig.color,
        align: 'center',
        valign: 'top'
      });
    }

    // Connecting line (except for last step)
    if (i < totalSteps - 1) {
      slide.addShape('line', {
        x: x + dynamicStepWidth,
        y: y - 0.1,
        w: stepsConfig.stepGap,
        h: 0,
        line: { color: COLORS.white, width: 2 }
      });
    }
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add card grid slide (3x3 grid of content cards)
 */
function addCardGridSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.cardGrid;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section) {
    slide.addText(slideData.section.toUpperCase(), {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  // Render cards
  const cardsConfig = layout.elements.cards;
  const cards = slideData.cards || [];

  cards.forEach((card, i) => {
    const row = Math.floor(i / cardsConfig.columns);
    const col = i % cardsConfig.columns;

    // Skip if exceeding max rows
    if (row >= cardsConfig.maxRows) return;

    const x = cardsConfig.startX + (col * (cardsConfig.cardWidth + cardsConfig.gapX));
    const y = cardsConfig.startY + (row * (cardsConfig.cardHeight + cardsConfig.gapY));

    // Card background
    slide.addShape('rect', {
      x: x,
      y: y,
      w: cardsConfig.cardWidth,
      h: cardsConfig.cardHeight,
      fill: { color: cardsConfig.cardBackground }
    });

    // Card title
    if (card.title) {
      slide.addText(card.title, {
        x: x + cardsConfig.padding,
        y: y + cardsConfig.padding,
        w: cardsConfig.cardWidth - (cardsConfig.padding * 2),
        h: 0.4,
        fontSize: cardsConfig.titleFontSize,
        fontFace: cardsConfig.titleFontFace,
        color: cardsConfig.titleColor,
        bold: true
      });
    }

    // Card content
    if (card.content) {
      slide.addText(card.content, {
        x: x + cardsConfig.padding,
        y: y + cardsConfig.padding + 0.5,
        w: cardsConfig.cardWidth - (cardsConfig.padding * 2),
        h: cardsConfig.cardHeight - cardsConfig.padding - 0.6,
        fontSize: cardsConfig.contentFontSize,
        fontFace: cardsConfig.contentFontFace,
        color: cardsConfig.contentColor,
        valign: 'top'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add feature grid slide (Slides 13-14 - icon-based feature layout)
 * Supports both white (default) and red background variants
 */
function addFeatureGridSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.featureGrid;
  const slide = pptx.addSlide();

  // Determine if this is the red variant
  const isRedVariant = slideData.type === 'featureGridRed' || slideData.variant === 'red';
  const bgColor = isRedVariant ? COLORS.red : layout.background;
  const textColor = isRedVariant ? COLORS.white : layout.elements.title.color;
  const iconBgColor = isRedVariant ? COLORS.white : layout.elements.features.iconBackground;
  const iconTextColor = isRedVariant ? COLORS.red : COLORS.white;
  const descColor = isRedVariant ? COLORS.white : layout.elements.features.descColor;

  // Set background
  slide.background = { color: bgColor };

  // Section label (only on white variant)
  if (!isRedVariant && slideData.section) {
    slide.addText(slideData.section.toUpperCase(), {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: textColor,
      align: layout.elements.title.align
    });
  }

  // Render features
  const featuresConfig = layout.elements.features;
  const features = slideData.features || [];

  features.forEach((feature, i) => {
    const row = Math.floor(i / featuresConfig.columns);
    const col = i % featuresConfig.columns;

    // Skip if exceeding max rows
    if (row >= featuresConfig.maxRows) return;

    const x = featuresConfig.startX + (col * (featuresConfig.featureWidth + featuresConfig.gapX));
    const y = featuresConfig.startY + (row * (featuresConfig.featureHeight + featuresConfig.gapY));

    // Icon circle placeholder
    slide.addShape('ellipse', {
      x: x + (featuresConfig.featureWidth - featuresConfig.iconSize) / 2,
      y: y,
      w: featuresConfig.iconSize,
      h: featuresConfig.iconSize,
      fill: { color: iconBgColor }
    });

    // Icon placeholder text (number or icon character)
    slide.addText(feature.icon || `${i + 1}`, {
      x: x + (featuresConfig.featureWidth - featuresConfig.iconSize) / 2,
      y: y,
      w: featuresConfig.iconSize,
      h: featuresConfig.iconSize,
      fontSize: 20,
      fontFace: FONTS.bold,
      color: iconTextColor,
      align: 'center',
      valign: 'middle'
    });

    // Feature title
    if (feature.title) {
      slide.addText(feature.title, {
        x: x,
        y: y + featuresConfig.iconSize + 0.2,
        w: featuresConfig.featureWidth,
        h: 0.4,
        fontSize: featuresConfig.titleFontSize,
        fontFace: featuresConfig.titleFontFace,
        color: isRedVariant ? COLORS.white : featuresConfig.titleColor,
        align: 'center'
      });
    }

    // Feature description
    if (feature.description) {
      slide.addText(feature.description, {
        x: x,
        y: y + featuresConfig.iconSize + 0.6,
        w: featuresConfig.featureWidth,
        h: 1.0,
        fontSize: featuresConfig.descFontSize,
        fontFace: featuresConfig.descFontFace,
        color: descColor,
        align: 'center',
        valign: 'top'
      });
    }
  });

  // Page number (only on white variant)
  if (!isRedVariant) {
    slide.addText(String(slideNumber), {
      x: layout.elements.pageNumber.x,
      y: layout.elements.pageNumber.y,
      w: layout.elements.pageNumber.w,
      h: layout.elements.pageNumber.h,
      fontSize: layout.elements.pageNumber.fontSize,
      fontFace: layout.elements.pageNumber.fontFace,
      color: layout.elements.pageNumber.color,
      align: layout.elements.pageNumber.align
    });
  }

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add two-column quote slide (Slide 16)
 */
function addQuoteTwoColumnSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.quoteTwoColumn;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section) {
    slide.addText(slideData.section.toUpperCase(), {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  // Helper function to render a quote column
  const renderQuoteColumn = (quoteData, config) => {
    if (!quoteData) return;

    // Red accent line
    slide.addShape('rect', {
      x: config.x - 0.1,
      y: config.y,
      w: config.accentWidth,
      h: 2,
      fill: { color: config.accentColor }
    });

    // Quote title
    if (quoteData.title) {
      slide.addText(quoteData.title, {
        x: config.x + 0.1,
        y: config.y,
        w: config.w - 0.1,
        h: 0.6,
        fontSize: config.titleFontSize,
        fontFace: config.titleFontFace,
        color: config.titleColor,
        align: 'left'
      });
    }

    // Quote text
    if (quoteData.text || quoteData.quote) {
      slide.addText(`"${quoteData.text || quoteData.quote}"`, {
        x: config.x + 0.1,
        y: config.y + 0.7,
        w: config.w - 0.1,
        h: 2.5,
        fontSize: config.textFontSize,
        fontFace: config.textFontFace,
        color: config.textColor,
        align: 'left',
        italic: true
      });
    }

    // Attribution
    if (quoteData.attribution) {
      slide.addText(`— ${quoteData.attribution}`, {
        x: config.x + 0.1,
        y: config.y + 3.3,
        w: config.w - 0.1,
        h: 0.4,
        fontSize: 11,
        fontFace: FONTS.semibold,
        color: config.titleColor,
        align: 'left'
      });
    }
  };

  // Render left quote
  renderQuoteColumn(slideData.leftQuote || slideData.quotes?.[0], layout.elements.leftQuote);

  // Render right quote
  renderQuoteColumn(slideData.rightQuote || slideData.quotes?.[1], layout.elements.rightQuote);

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add quote with metrics slide (Slide 17)
 */
function addQuoteWithMetricsSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.quoteWithMetrics;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section) {
    slide.addText(slideData.section.toUpperCase(), {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Quote with red accent line
  const quoteConfig = layout.elements.quote;
  if (slideData.quote) {
    // Red accent line
    slide.addShape('rect', {
      x: quoteConfig.x - 0.1,
      y: quoteConfig.y,
      w: quoteConfig.accentWidth,
      h: 2.5,
      fill: { color: quoteConfig.accentColor }
    });

    // Quote text
    slide.addText(`"${slideData.quote}"`, {
      x: quoteConfig.x + 0.1,
      y: quoteConfig.y,
      w: quoteConfig.w - 0.1,
      h: 2.5,
      fontSize: quoteConfig.fontSize,
      fontFace: quoteConfig.fontFace,
      color: quoteConfig.color,
      align: 'left',
      italic: true
    });

    // Attribution
    if (slideData.attribution) {
      slide.addText(`— ${slideData.attribution}`, {
        x: quoteConfig.x + 0.1,
        y: quoteConfig.y + 2.6,
        w: quoteConfig.w - 0.1,
        h: 0.4,
        fontSize: 12,
        fontFace: FONTS.semibold,
        color: quoteConfig.color,
        align: 'left'
      });
    }
  }

  // Metrics row
  const metrics = slideData.metrics || [];
  const metricsConfig = layout.elements.metrics;

  metrics.slice(0, metricsConfig.maxMetrics).forEach((metric, i) => {
    const x = metricsConfig.startX + (i * (metricsConfig.metricWidth + metricsConfig.gap));
    const y = metricsConfig.y;

    // Metric value (large red number)
    slide.addText(metric.value || '', {
      x: x,
      y: y,
      w: metricsConfig.metricWidth,
      h: 1.2,
      fontSize: metricsConfig.valueFontSize,
      fontFace: metricsConfig.valueFontFace,
      color: metricsConfig.valueColor,
      align: 'left'
    });

    // Metric label
    slide.addText(metric.label || '', {
      x: x,
      y: y + 1.2,
      w: metricsConfig.metricWidth,
      h: 0.8,
      fontSize: metricsConfig.labelFontSize,
      fontFace: metricsConfig.labelFontFace,
      color: metricsConfig.labelColor,
      align: 'left'
    });
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add timeline cards slide (Slide 22 - horizontal timeline with alternating cards)
 */
function addTimelineCardsSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.timelineCards;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section) {
    slide.addText(slideData.section.toUpperCase(), {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  const timelineConfig = layout.elements.timeline;
  const cardsConfig = layout.elements.cards;
  const items = slideData.items || slideData.timeline || [];
  const itemCount = items.length;

  // Draw timeline line
  slide.addShape('line', {
    x: timelineConfig.startX,
    y: timelineConfig.y,
    w: timelineConfig.endX - timelineConfig.startX,
    h: 0,
    line: { color: timelineConfig.lineColor, width: timelineConfig.lineWidth }
  });

  // Calculate spacing
  const totalWidth = timelineConfig.endX - timelineConfig.startX;
  const spacing = itemCount > 1 ? totalWidth / (itemCount - 1) : totalWidth / 2;

  items.forEach((item, i) => {
    const x = timelineConfig.startX + (i * spacing) - (cardsConfig.width / 2);
    const markerX = timelineConfig.startX + (i * spacing);
    const isAbove = i % 2 === 0; // Alternate above/below

    // Timeline marker
    slide.addShape('ellipse', {
      x: markerX - (timelineConfig.markerSize / 2),
      y: timelineConfig.y - (timelineConfig.markerSize / 2),
      w: timelineConfig.markerSize,
      h: timelineConfig.markerSize,
      fill: { color: timelineConfig.markerColor }
    });

    // Card position (above or below line)
    const cardY = isAbove
      ? timelineConfig.y - cardsConfig.height - 0.5
      : timelineConfig.y + 0.5;

    // Card background
    slide.addShape('rect', {
      x: x,
      y: cardY,
      w: cardsConfig.width,
      h: cardsConfig.height,
      fill: { color: cardsConfig.background }
    });

    // Card title (date/phase)
    if (item.title || item.date || item.phase) {
      slide.addText(item.title || item.date || item.phase, {
        x: x + cardsConfig.padding,
        y: cardY + cardsConfig.padding,
        w: cardsConfig.width - (cardsConfig.padding * 2),
        h: 0.35,
        fontSize: cardsConfig.titleFontSize,
        fontFace: cardsConfig.titleFontFace,
        color: cardsConfig.titleColor,
        align: 'left',
        bold: true
      });
    }

    // Card content
    if (item.content || item.description) {
      slide.addText(item.content || item.description, {
        x: x + cardsConfig.padding,
        y: cardY + cardsConfig.padding + 0.4,
        w: cardsConfig.width - (cardsConfig.padding * 2),
        h: cardsConfig.height - cardsConfig.padding - 0.5,
        fontSize: cardsConfig.contentFontSize,
        fontFace: cardsConfig.contentFontFace,
        color: cardsConfig.contentColor,
        align: 'left',
        valign: 'top'
      });
    }

    // Connector line from marker to card
    const connectorStartY = isAbove ? timelineConfig.y - (timelineConfig.markerSize / 2) : timelineConfig.y + (timelineConfig.markerSize / 2);
    const connectorEndY = isAbove ? cardY + cardsConfig.height : cardY;

    slide.addShape('line', {
      x: markerX,
      y: connectorStartY,
      w: 0,
      h: Math.abs(connectorEndY - connectorStartY),
      line: { color: timelineConfig.markerColor, width: 1, dashType: 'dash' }
    });
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add horizontal process steps alt slide (Slide 28 - white background with circles)
 */
function addProcessStepsAltSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.processStepsAlt;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section) {
    slide.addText(slideData.section.toUpperCase(), {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  const stepsConfig = layout.elements.steps;
  const steps = slideData.steps || slideData.items || [];
  const totalWidth = 12.33;
  const stepSpacing = steps.length > 1 ? totalWidth / steps.length : totalWidth;

  steps.forEach((step, i) => {
    const centerX = stepsConfig.startX + (i * stepSpacing) + (stepSpacing / 2);
    const y = stepsConfig.y;

    // Connecting line (except first)
    if (i > 0) {
      const prevCenterX = stepsConfig.startX + ((i - 1) * stepSpacing) + (stepSpacing / 2);
      slide.addShape('line', {
        x: prevCenterX + (stepsConfig.circleSize / 2),
        y: y + (stepsConfig.circleSize / 2),
        w: centerX - prevCenterX - stepsConfig.circleSize,
        h: 0,
        line: { color: stepsConfig.lineColor, width: stepsConfig.lineWidth }
      });
    }

    // Step circle (red)
    slide.addShape('ellipse', {
      x: centerX - (stepsConfig.circleSize / 2),
      y: y,
      w: stepsConfig.circleSize,
      h: stepsConfig.circleSize,
      fill: { color: stepsConfig.circleBgColor }
    });

    // Step number (white)
    slide.addText(`${i + 1}`, {
      x: centerX - (stepsConfig.circleSize / 2),
      y: y,
      w: stepsConfig.circleSize,
      h: stepsConfig.circleSize,
      fontSize: stepsConfig.numberFontSize,
      fontFace: stepsConfig.numberFontFace,
      color: stepsConfig.numberColor,
      align: 'center',
      valign: 'middle'
    });

    // Step title (navy)
    if (step.title) {
      slide.addText(step.title, {
        x: centerX - (stepsConfig.contentWidth / 2),
        y: y + stepsConfig.circleSize + 0.3,
        w: stepsConfig.contentWidth,
        h: 0.5,
        fontSize: stepsConfig.titleFontSize,
        fontFace: stepsConfig.titleFontFace,
        color: stepsConfig.titleColor,
        align: 'center'
      });
    }

    // Step description
    if (step.description || step.content) {
      slide.addText(step.description || step.content, {
        x: centerX - (stepsConfig.contentWidth / 2),
        y: y + stepsConfig.circleSize + 0.9,
        w: stepsConfig.contentWidth,
        h: 1.5,
        fontSize: stepsConfig.descFontSize,
        fontFace: stepsConfig.descFontFace,
        color: stepsConfig.descColor,
        align: 'center',
        valign: 'top'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add rollout grid slide (Slide 30 - phase boxes in grid layout)
 */
function addRolloutGridSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.rolloutGrid;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  const phasesConfig = layout.elements.phases;
  const phases = slideData.phases || slideData.items || [];

  phases.forEach((phase, i) => {
    const row = Math.floor(i / phasesConfig.columns);
    const col = i % phasesConfig.columns;

    // Skip if exceeding max rows
    if (row >= phasesConfig.maxRows) return;

    const x = phasesConfig.startX + (col * (phasesConfig.boxWidth + phasesConfig.gapX));
    const y = phasesConfig.startY + (row * (phasesConfig.boxHeight + phasesConfig.gapY));

    // Get colors for this phase (use data override or default from config)
    const colorIndex = i % phasesConfig.colors.length;
    const bgColor = phase.bgColor || phasesConfig.colors[colorIndex].bg;
    const textColor = phase.textColor || phasesConfig.colors[colorIndex].text;

    // Phase box background
    slide.addShape('rect', {
      x: x,
      y: y,
      w: phasesConfig.boxWidth,
      h: phasesConfig.boxHeight,
      fill: { color: bgColor }
    });

    // Phase title
    if (phase.title || phase.name) {
      slide.addText(phase.title || phase.name, {
        x: x + phasesConfig.padding,
        y: y + phasesConfig.padding,
        w: phasesConfig.boxWidth - (phasesConfig.padding * 2),
        h: 0.5,
        fontSize: phasesConfig.titleFontSize,
        fontFace: phasesConfig.titleFontFace,
        color: textColor,
        align: 'left',
        bold: true
      });
    }

    // Phase items/description
    const items = phase.items || phase.bullets || (phase.description ? [phase.description] : []);
    if (items.length > 0) {
      const itemsText = Array.isArray(items)
        ? items.map(item => `• ${item}`).join('\n')
        : items;

      slide.addText(itemsText, {
        x: x + phasesConfig.padding,
        y: y + phasesConfig.padding + 0.6,
        w: phasesConfig.boxWidth - (phasesConfig.padding * 2),
        h: phasesConfig.boxHeight - phasesConfig.padding - 0.8,
        fontSize: phasesConfig.itemFontSize,
        fontFace: phasesConfig.itemFontFace,
        color: textColor,
        align: 'left',
        valign: 'top'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add table slide (Slide 21 - data table layout)
 */
function addTableSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.table;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  const tableConfig = layout.elements.table;
  const headers = slideData.headers || [];
  const rows = slideData.rows || slideData.data || [];

  if (headers.length > 0 || rows.length > 0) {
    // Build table data array
    const tableData = [];

    // Add header row if present
    if (headers.length > 0) {
      tableData.push(headers.map(h => ({
        text: String(h),
        options: {
          fill: { color: tableConfig.headerBackground },
          color: tableConfig.headerColor,
          bold: true,
          fontFace: tableConfig.headerFontFace,
          fontSize: tableConfig.headerFontSize
        }
      })));
    }

    // Add data rows with alternating colors
    rows.forEach((row, rowIndex) => {
      const rowData = Array.isArray(row) ? row : Object.values(row);
      const bgColor = rowIndex % 2 === 0 ? tableConfig.evenRowBackground : tableConfig.oddRowBackground;

      tableData.push(rowData.map(cell => ({
        text: String(cell ?? ''),
        options: {
          fill: { color: bgColor },
          color: tableConfig.dataColor,
          fontFace: tableConfig.dataFontFace,
          fontSize: tableConfig.dataFontSize
        }
      })));
    });

    // Calculate column widths
    const colCount = Math.max(headers.length, rows[0]?.length || 0);
    const colWidths = slideData.colWidths || Array(colCount).fill(tableConfig.w / colCount);

    // Add the table
    slide.addTable(tableData, {
      x: tableConfig.x,
      y: tableConfig.y,
      w: tableConfig.w,
      colW: colWidths,
      rowH: tableConfig.rowHeight,
      border: { pt: tableConfig.borderWidth, color: tableConfig.borderColor },
      align: 'left',
      valign: 'middle'
    });
  }

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add title variant A slide (Slide 3 - geometric pattern top stripe)
 */
function addTitleVariantASlide(pptx, slideData) {
  const layout = LAYOUTS.titleVariantA;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Geometric pattern placeholder (top stripe)
  slide.addShape('rect', {
    x: layout.elements.pattern.x,
    y: layout.elements.pattern.y,
    w: layout.elements.pattern.w,
    h: layout.elements.pattern.h,
    fill: { color: '1a3a5c' }  // Slightly lighter navy for pattern
  });

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  // Date
  if (slideData.date) {
    slide.addText(slideData.date, {
      x: layout.elements.date.x,
      y: layout.elements.date.y,
      w: layout.elements.date.w,
      h: layout.elements.date.h,
      fontSize: layout.elements.date.fontSize,
      fontFace: layout.elements.date.fontFace,
      color: layout.elements.date.color,
      align: layout.elements.date.align
    });
  }

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'medium');
}

/**
 * Add title variant B slide (Slide 4 - different geometric accent placement)
 */
function addTitleVariantBSlide(pptx, slideData) {
  const layout = LAYOUTS.titleVariantB;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Geometric pattern placeholder (diagonal accent)
  slide.addShape('rect', {
    x: layout.elements.pattern.x,
    y: layout.elements.pattern.y,
    w: layout.elements.pattern.w,
    h: layout.elements.pattern.h,
    fill: { color: '1a3a5c' }  // Slightly lighter navy for pattern
  });

  // Subtitle/date (upper area)
  if (slideData.subtitle || slideData.date) {
    slide.addText(slideData.subtitle || slideData.date, {
      x: layout.elements.subtitle.x,
      y: layout.elements.subtitle.y,
      w: layout.elements.subtitle.w,
      h: layout.elements.subtitle.h,
      fontSize: layout.elements.subtitle.fontSize,
      fontFace: layout.elements.subtitle.fontFace,
      color: layout.elements.subtitle.color,
      align: layout.elements.subtitle.align
    });
  }

  // Main title (lower position)
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  // Tagline
  slide.addText(slideData.tagline || layout.elements.tagline.text, {
    x: layout.elements.tagline.x,
    y: layout.elements.tagline.y,
    w: layout.elements.tagline.w,
    h: layout.elements.tagline.h,
    fontSize: layout.elements.tagline.fontSize,
    fontFace: layout.elements.tagline.fontFace,
    color: layout.elements.tagline.color,
    align: layout.elements.tagline.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'medium');
}

/**
 * Add dual chart slide (Slide 20 - side by side charts)
 */
function addDualChartSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.dualChart;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Helper function to add chart section
  const addChartSection = (config, chartData) => {
    // Chart title
    if (chartData.title) {
      slide.addText(chartData.title, {
        x: config.x,
        y: config.titleY,
        w: config.w,
        h: 0.5,
        fontSize: config.titleFontSize,
        fontFace: config.titleFontFace,
        color: config.titleColor,
        align: 'left'
      });
    }

    // Chart placeholder (or actual chart)
    slide.addShape('rect', {
      x: config.x,
      y: config.chartY,
      w: config.w,
      h: config.chartH,
      fill: { color: config.chartBackground }
    });

    // Chart placeholder label
    slide.addText('Chart Placeholder', {
      x: config.x,
      y: config.chartY + (config.chartH / 2) - 0.25,
      w: config.w,
      h: 0.5,
      fontSize: 14,
      fontFace: FONTS.regular,
      color: COLORS.darkGray,
      align: 'center'
    });

    // Source text
    if (chartData.source) {
      slide.addText(`Source: ${chartData.source}`, {
        x: config.x,
        y: config.sourceY,
        w: config.w,
        h: 0.3,
        fontSize: config.sourceFontSize,
        fontFace: config.sourceFontFace,
        color: config.sourceColor,
        align: 'left'
      });
    }
  };

  // Left chart
  const leftData = slideData.leftChart || slideData.charts?.[0] || {};
  addChartSection(layout.elements.leftChart, leftData);

  // Right chart
  const rightData = slideData.rightChart || slideData.charts?.[1] || {};
  addChartSection(layout.elements.rightChart, rightData);

  // Content text (bottom)
  if (slideData.content || slideData.text) {
    slide.addText(slideData.content || slideData.text, {
      x: layout.elements.content.x,
      y: layout.elements.content.y,
      w: layout.elements.content.w,
      h: layout.elements.content.h,
      fontSize: layout.elements.content.fontSize,
      fontFace: layout.elements.content.fontFace,
      color: layout.elements.content.color,
      align: 'left'
    });
  }

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add quote with data visualization slide B (Slide 19 - quote with chart and metrics row)
 */
function addQuoteDataBSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.quoteDataB;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section || slideData.sectionLabel) {
    slide.addText(slideData.section || slideData.sectionLabel, {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  const quoteConfig = layout.elements.quote;

  // Quote title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: quoteConfig.x,
      y: quoteConfig.y,
      w: quoteConfig.w,
      h: 1.2,
      fontSize: quoteConfig.titleFontSize,
      fontFace: quoteConfig.titleFontFace,
      color: quoteConfig.titleColor,
      align: 'left'
    });
  }

  // Red accent line
  slide.addShape('rect', {
    x: quoteConfig.x - 0.1,
    y: quoteConfig.y + 1.5,
    w: quoteConfig.accentWidth,
    h: 2,
    fill: { color: quoteConfig.accentColor }
  });

  // Quote text
  if (slideData.quote || slideData.text) {
    slide.addText(slideData.quote || slideData.text, {
      x: quoteConfig.x,
      y: quoteConfig.y + 1.5,
      w: quoteConfig.w,
      h: 2.5,
      fontSize: quoteConfig.textFontSize,
      fontFace: quoteConfig.textFontFace,
      color: quoteConfig.textColor,
      align: 'left',
      valign: 'top',
      italic: true
    });
  }

  // Chart placeholder (right side)
  const chartConfig = layout.elements.chart;
  slide.addShape('rect', {
    x: chartConfig.x,
    y: chartConfig.y,
    w: chartConfig.w,
    h: chartConfig.h,
    fill: { color: chartConfig.background }
  });

  // Chart label
  slide.addText('Chart Placeholder', {
    x: chartConfig.x,
    y: chartConfig.y + (chartConfig.h / 2) - 0.25,
    w: chartConfig.w,
    h: 0.5,
    fontSize: 14,
    fontFace: FONTS.regular,
    color: COLORS.darkGray,
    align: 'center'
  });

  // Metrics row (bottom)
  const metricsConfig = layout.elements.metrics;
  const metrics = slideData.metrics || slideData.data || [];

  metrics.slice(0, metricsConfig.maxMetrics).forEach((metric, i) => {
    const x = metricsConfig.startX + (i * (metricsConfig.metricWidth + metricsConfig.gap));

    // Metric value
    if (metric.value !== undefined) {
      slide.addText(String(metric.value), {
        x: x,
        y: metricsConfig.y,
        w: metricsConfig.metricWidth,
        h: 0.8,
        fontSize: metricsConfig.valueFontSize,
        fontFace: metricsConfig.valueFontFace,
        color: metricsConfig.valueColor,
        align: 'left'
      });
    }

    // Metric label
    if (metric.label || metric.title) {
      slide.addText(metric.label || metric.title, {
        x: x,
        y: metricsConfig.y + 0.8,
        w: metricsConfig.metricWidth,
        h: 0.4,
        fontSize: metricsConfig.labelFontSize,
        fontFace: metricsConfig.labelFontFace,
        color: metricsConfig.labelColor,
        align: 'left'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add quote with data visualization slide A (Slide 18 - quote with data cards)
 */
function addQuoteDataASlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.quoteDataA;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section || slideData.sectionLabel) {
    slide.addText(slideData.section || slideData.sectionLabel, {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  const quoteConfig = layout.elements.quote;

  // Quote title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: quoteConfig.x,
      y: quoteConfig.y,
      w: quoteConfig.w,
      h: 1.2,
      fontSize: quoteConfig.titleFontSize,
      fontFace: quoteConfig.titleFontFace,
      color: quoteConfig.titleColor,
      align: 'left'
    });
  }

  // Red accent line
  slide.addShape('rect', {
    x: quoteConfig.x - 0.1,
    y: quoteConfig.y + 1.5,
    w: quoteConfig.accentWidth,
    h: 2,
    fill: { color: quoteConfig.accentColor }
  });

  // Quote text
  if (slideData.quote || slideData.text) {
    slide.addText(slideData.quote || slideData.text, {
      x: quoteConfig.x,
      y: quoteConfig.y + 1.5,
      w: quoteConfig.w,
      h: 3,
      fontSize: quoteConfig.textFontSize,
      fontFace: quoteConfig.textFontFace,
      color: quoteConfig.textColor,
      align: 'left',
      valign: 'top',
      italic: true
    });
  }

  // Attribution
  if (slideData.attribution) {
    slide.addText(`— ${slideData.attribution}`, {
      x: quoteConfig.x,
      y: quoteConfig.y + 4.8,
      w: quoteConfig.w,
      h: 0.5,
      fontSize: 12,
      fontFace: FONTS.semibold,
      color: quoteConfig.titleColor,
      align: 'left'
    });
  }

  // Data cards
  const cardsConfig = layout.elements.dataCards;
  const metrics = slideData.metrics || slideData.data || slideData.cards || [];

  metrics.slice(0, cardsConfig.maxCards).forEach((metric, i) => {
    const row = Math.floor(i / cardsConfig.columns);
    const col = i % cardsConfig.columns;

    const x = cardsConfig.startX + (col * (cardsConfig.cardWidth + cardsConfig.gapX));
    const y = cardsConfig.startY + (row * (cardsConfig.cardHeight + cardsConfig.gapY));

    // Card background
    slide.addShape('rect', {
      x: x,
      y: y,
      w: cardsConfig.cardWidth,
      h: cardsConfig.cardHeight,
      fill: { color: cardsConfig.cardBackground }
    });

    // Metric value
    if (metric.value !== undefined) {
      slide.addText(String(metric.value), {
        x: x + cardsConfig.padding,
        y: y + cardsConfig.padding,
        w: cardsConfig.cardWidth - (cardsConfig.padding * 2),
        h: 0.8,
        fontSize: cardsConfig.valueFontSize,
        fontFace: cardsConfig.valueFontFace,
        color: cardsConfig.valueColor,
        align: 'left'
      });
    }

    // Metric label
    if (metric.label || metric.title) {
      slide.addText(metric.label || metric.title, {
        x: x + cardsConfig.padding,
        y: y + cardsConfig.cardHeight - cardsConfig.padding - 0.5,
        w: cardsConfig.cardWidth - (cardsConfig.padding * 2),
        h: 0.5,
        fontSize: cardsConfig.labelFontSize,
        fontFace: cardsConfig.labelFontFace,
        color: cardsConfig.labelColor,
        align: 'left'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add rollout description slide (Slide 33 - phase cards with descriptions)
 */
function addRolloutDescriptionSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.rolloutDescription;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Main title
  slide.addText(slideData.title || 'Rollout Schedule', {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align
  });

  const phasesConfig = layout.elements.phases;
  const phases = slideData.phases || slideData.items || [];

  phases.forEach((phase, i) => {
    const row = Math.floor(i / phasesConfig.columns);
    const col = i % phasesConfig.columns;

    // Skip if exceeding max rows
    if (row >= phasesConfig.maxRows) return;

    const x = phasesConfig.startX + (col * (phasesConfig.cardWidth + phasesConfig.gapX));
    const y = phasesConfig.startY + (row * (phasesConfig.cardHeight + phasesConfig.gapY));

    // Get colors for this phase (use data override or default from config)
    const colorIndex = i % phasesConfig.colors.length;
    const bgColor = phase.bgColor || phasesConfig.colors[colorIndex].bg;
    const textColor = phase.textColor || phasesConfig.colors[colorIndex].text;
    const noteColor = phase.noteColor || phasesConfig.colors[colorIndex].note;

    // Phase card background
    slide.addShape('rect', {
      x: x,
      y: y,
      w: phasesConfig.cardWidth,
      h: phasesConfig.cardHeight,
      fill: { color: bgColor }
    });

    // Phase title
    if (phase.title || phase.name) {
      slide.addText(phase.title || phase.name, {
        x: x + phasesConfig.padding,
        y: y + phasesConfig.padding,
        w: phasesConfig.cardWidth - (phasesConfig.padding * 2),
        h: 0.5,
        fontSize: phasesConfig.titleFontSize,
        fontFace: phasesConfig.titleFontFace,
        color: textColor,
        align: 'left',
        bold: true
      });
    }

    // Phase description
    const description = phase.description || phase.content;
    if (description) {
      const descText = Array.isArray(description)
        ? description.map(item => `• ${item}`).join('\n')
        : description;

      slide.addText(descText, {
        x: x + phasesConfig.padding,
        y: y + phasesConfig.padding + 0.6,
        w: phasesConfig.cardWidth - (phasesConfig.padding * 2),
        h: phasesConfig.cardHeight - phasesConfig.padding - 1.4,
        fontSize: phasesConfig.descFontSize,
        fontFace: phasesConfig.descFontFace,
        color: textColor,
        align: 'left',
        valign: 'top'
      });
    }

    // Phase note (bottom of card)
    if (phase.note || phase.date) {
      slide.addText(phase.note || phase.date, {
        x: x + phasesConfig.padding,
        y: y + phasesConfig.cardHeight - phasesConfig.padding - 0.4,
        w: phasesConfig.cardWidth - (phasesConfig.padding * 2),
        h: 0.4,
        fontSize: phasesConfig.noteFontSize,
        fontFace: phasesConfig.noteFontFace,
        color: noteColor,
        align: 'left',
        valign: 'bottom'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add Gantt chart slide (Slide 32 - schedule with Gantt bars)
 */
function addGanttChartSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.ganttChart;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Main title
  slide.addText(slideData.title || 'Rollout Schedule', {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align
  });

  const chartConfig = layout.elements.chart;
  const activities = slideData.activities || slideData.items || [];

  // Default months (can be overridden by data)
  const months = slideData.months || ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
                                       'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  const monthCount = months.length;
  const monthWidth = chartConfig.chartWidth / monthCount;

  // Draw month headers
  months.forEach((month, i) => {
    slide.addText(month, {
      x: chartConfig.chartStartX + (i * monthWidth),
      y: chartConfig.headerY,
      w: monthWidth,
      h: chartConfig.headerHeight,
      fontSize: chartConfig.headerFontSize,
      fontFace: chartConfig.headerFontFace,
      color: chartConfig.headerColor,
      align: 'center'
    });
  });

  // Draw vertical grid lines
  for (let i = 0; i <= monthCount; i++) {
    const lineX = chartConfig.chartStartX + (i * monthWidth);
    const gridHeight = Math.min(activities.length, chartConfig.maxRows) * chartConfig.rowHeight + 0.2;

    slide.addShape('line', {
      x: lineX,
      y: chartConfig.headerY,
      w: 0,
      h: gridHeight,
      line: { color: chartConfig.gridColor, width: chartConfig.gridWidth }
    });
  }

  // Draw activity rows
  activities.slice(0, chartConfig.maxRows).forEach((activity, i) => {
    const y = chartConfig.rowStartY + (i * chartConfig.rowHeight);

    // Activity name/label
    slide.addText(activity.name || activity.title || '', {
      x: chartConfig.labelsX,
      y: y,
      w: chartConfig.labelsWidth,
      h: chartConfig.rowHeight,
      fontSize: chartConfig.labelFontSize,
      fontFace: chartConfig.labelFontFace,
      color: chartConfig.labelColor,
      align: 'left',
      valign: 'middle'
    });

    // Horizontal grid line
    slide.addShape('line', {
      x: chartConfig.chartStartX,
      y: y + chartConfig.rowHeight,
      w: chartConfig.chartWidth,
      h: 0,
      line: { color: chartConfig.gridColor, width: chartConfig.gridWidth }
    });

    // Gantt bar
    if (activity.startMonth !== undefined && activity.endMonth !== undefined) {
      const barStartX = chartConfig.chartStartX + (activity.startMonth * monthWidth);
      const barWidth = (activity.endMonth - activity.startMonth + 1) * monthWidth;
      const barY = y + (chartConfig.rowHeight - chartConfig.barHeight) / 2;

      slide.addShape('rect', {
        x: barStartX,
        y: barY,
        w: barWidth,
        h: chartConfig.barHeight,
        fill: { color: activity.color || chartConfig.defaultBarColor }
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add rollout timeline slide (Slide 31 - horizontal timeline for rollout phases)
 */
function addRolloutTimelineSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.rolloutTimeline;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  const timelineConfig = layout.elements.timeline;
  const phasesConfig = layout.elements.phases;
  const phases = slideData.phases || slideData.items || [];
  const phaseCount = phases.length;

  // Draw timeline line
  slide.addShape('line', {
    x: timelineConfig.startX,
    y: timelineConfig.y,
    w: timelineConfig.endX - timelineConfig.startX,
    h: 0,
    line: { color: timelineConfig.lineColor, width: timelineConfig.lineWidth }
  });

  // Calculate spacing
  const totalWidth = timelineConfig.endX - timelineConfig.startX;
  const spacing = phaseCount > 1 ? totalWidth / (phaseCount - 1) : totalWidth / 2;

  phases.forEach((phase, i) => {
    const markerX = timelineConfig.startX + (i * spacing);
    const contentX = markerX - (phasesConfig.contentWidth / 2);

    // Phase marker circle
    slide.addShape('ellipse', {
      x: markerX - (timelineConfig.markerSize / 2),
      y: timelineConfig.y - (timelineConfig.markerSize / 2),
      w: timelineConfig.markerSize,
      h: timelineConfig.markerSize,
      fill: { color: timelineConfig.markerColor }
    });

    // Phase number inside circle
    slide.addText(`${i + 1}`, {
      x: markerX - (timelineConfig.markerSize / 2),
      y: timelineConfig.y - (timelineConfig.markerSize / 2),
      w: timelineConfig.markerSize,
      h: timelineConfig.markerSize,
      fontSize: timelineConfig.numberFontSize,
      fontFace: timelineConfig.numberFontFace,
      color: timelineConfig.numberColor,
      align: 'center',
      valign: 'middle'
    });

    // Phase title (below marker)
    if (phase.title || phase.name) {
      slide.addText(phase.title || phase.name, {
        x: contentX,
        y: phasesConfig.contentY,
        w: phasesConfig.contentWidth,
        h: 0.5,
        fontSize: phasesConfig.titleFontSize,
        fontFace: phasesConfig.titleFontFace,
        color: phasesConfig.titleColor,
        align: 'center'
      });
    }

    // Phase details (below title)
    const details = phase.details || phase.description || phase.content;
    if (details) {
      const detailsText = Array.isArray(details) ? details.join('\n• ') : details;
      const formattedText = Array.isArray(details) ? '• ' + detailsText : detailsText;

      slide.addText(formattedText, {
        x: contentX,
        y: phasesConfig.contentY + 0.6,
        w: phasesConfig.contentWidth,
        h: phasesConfig.detailsHeight,
        fontSize: phasesConfig.detailsFontSize,
        fontFace: phasesConfig.detailsFontFace,
        color: phasesConfig.detailsColor,
        align: 'center',
        valign: 'top'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add horizontal process steps slide (Slide 27 - 5-step navy background process)
 */
function addProcessSteps5Slide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.processSteps5;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  const stepsConfig = layout.elements.steps;
  const steps = slideData.steps || slideData.items || [];

  steps.forEach((step, i) => {
    const x = stepsConfig.startX + (i * (stepsConfig.boxWidth + stepsConfig.gap));
    const y = stepsConfig.y;

    // Step box with border
    slide.addShape('rect', {
      x: x,
      y: y,
      w: stepsConfig.boxWidth,
      h: stepsConfig.boxHeight,
      fill: { color: stepsConfig.boxBackground },
      line: { color: stepsConfig.boxBorderColor, width: stepsConfig.boxBorderWidth }
    });

    // Step number (red)
    slide.addText(`${i + 1}`, {
      x: x,
      y: y + 0.2,
      w: stepsConfig.boxWidth,
      h: 0.5,
      fontSize: stepsConfig.numberFontSize,
      fontFace: stepsConfig.numberFontFace,
      color: stepsConfig.numberColor,
      align: 'center'
    });

    // Step title (white)
    if (step.title) {
      slide.addText(step.title, {
        x: x + 0.2,
        y: y + 0.8,
        w: stepsConfig.boxWidth - 0.4,
        h: 0.6,
        fontSize: stepsConfig.titleFontSize,
        fontFace: stepsConfig.titleFontFace,
        color: stepsConfig.titleColor,
        align: 'center'
      });
    }

    // Step description (white)
    if (step.description || step.content) {
      slide.addText(step.description || step.content, {
        x: x + 0.2,
        y: y + 1.5,
        w: stepsConfig.boxWidth - 0.4,
        h: 0.8,
        fontSize: stepsConfig.descFontSize,
        fontFace: stepsConfig.descFontFace,
        color: stepsConfig.descColor,
        align: 'center',
        valign: 'top'
      });
    }

    // Arrow between steps (except last)
    if (i < steps.length - 1) {
      const arrowX = x + stepsConfig.boxWidth;
      const arrowY = y + (stepsConfig.boxHeight / 2);

      // Simple arrow using triangle
      slide.addText('→', {
        x: arrowX,
        y: arrowY - 0.2,
        w: stepsConfig.gap,
        h: 0.4,
        fontSize: 16,
        fontFace: FONTS.bold,
        color: stepsConfig.arrowColor,
        align: 'center',
        valign: 'middle'
      });
    }
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add vertical numbered steps slide (Slide 26 - vertical list with numbered circles)
 */
function addStepsVerticalSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.stepsVertical;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section) {
    slide.addText(slideData.section.toUpperCase(), {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  const stepsConfig = layout.elements.steps;
  const steps = slideData.steps || slideData.items || [];
  const stepHeight = stepsConfig.titleHeight + stepsConfig.descHeight + stepsConfig.stepGap;

  steps.forEach((step, i) => {
    const y = stepsConfig.startY + (i * stepHeight);
    const centerY = y + (stepsConfig.numberSize / 2);

    // Connecting line to next step (except last)
    if (i < steps.length - 1) {
      slide.addShape('line', {
        x: stepsConfig.numberX + (stepsConfig.numberSize / 2),
        y: y + stepsConfig.numberSize,
        w: 0,
        h: stepHeight - stepsConfig.numberSize,
        line: { color: stepsConfig.lineColor, width: stepsConfig.lineWidth }
      });
    }

    // Step number circle (red background)
    slide.addShape('ellipse', {
      x: stepsConfig.numberX,
      y: y,
      w: stepsConfig.numberSize,
      h: stepsConfig.numberSize,
      fill: { color: stepsConfig.numberBgColor }
    });

    // Step number text
    slide.addText(`${i + 1}`, {
      x: stepsConfig.numberX,
      y: y,
      w: stepsConfig.numberSize,
      h: stepsConfig.numberSize,
      fontSize: stepsConfig.numberFontSize,
      fontFace: stepsConfig.numberFontFace,
      color: stepsConfig.numberColor,
      align: 'center',
      valign: 'middle'
    });

    // Step title
    if (step.title) {
      slide.addText(step.title, {
        x: stepsConfig.contentX,
        y: y + 0.1,
        w: stepsConfig.contentWidth,
        h: stepsConfig.titleHeight,
        fontSize: stepsConfig.titleFontSize,
        fontFace: stepsConfig.titleFontFace,
        color: stepsConfig.titleColor,
        align: 'left',
        valign: 'top'
      });
    }

    // Step description
    if (step.description || step.content) {
      slide.addText(step.description || step.content, {
        x: stepsConfig.contentX,
        y: y + stepsConfig.titleHeight,
        w: stepsConfig.contentWidth,
        h: stepsConfig.descHeight,
        fontSize: stepsConfig.descFontSize,
        fontFace: stepsConfig.descFontFace,
        color: stepsConfig.descColor,
        align: 'left',
        valign: 'top'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add timeline phases slide (Slide 25 - horizontal timeline with phase labels and bars)
 */
function addTimelinePhasesSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.timelinePhases;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section) {
    slide.addText(slideData.section.toUpperCase(), {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  const phasesConfig = layout.elements.phases;
  const phases = slideData.phases || slideData.items || [];

  phases.forEach((phase, i) => {
    const x = phasesConfig.startX + (i * (phasesConfig.phaseWidth + phasesConfig.gap));
    let y = phasesConfig.startY;

    // Phase label (red)
    if (phase.label || phase.title) {
      slide.addText(phase.label || phase.title, {
        x: x,
        y: y,
        w: phasesConfig.phaseWidth,
        h: 0.5,
        fontSize: phasesConfig.labelFontSize,
        fontFace: phasesConfig.labelFontFace,
        color: phasesConfig.labelColor,
        align: 'left'
      });
      y += 0.6;
    }

    // Phase bar (navy)
    slide.addShape('rect', {
      x: x,
      y: y,
      w: phasesConfig.phaseWidth,
      h: phasesConfig.barHeight,
      fill: { color: phasesConfig.barColor }
    });
    y += phasesConfig.barHeight + 0.2;

    // Phase details/description
    if (phase.details || phase.description || phase.content) {
      const detailsText = phase.details || phase.description || phase.content;
      // Handle array of details or single string
      const textContent = Array.isArray(detailsText) ? detailsText.join('\n• ') : detailsText;
      const formattedText = Array.isArray(detailsText) ? '• ' + textContent : textContent;

      slide.addText(formattedText, {
        x: x,
        y: y,
        w: phasesConfig.phaseWidth,
        h: phasesConfig.detailsHeight,
        fontSize: phasesConfig.detailsFontSize,
        fontFace: phasesConfig.detailsFontFace,
        color: phasesConfig.detailsColor,
        align: 'left',
        valign: 'top'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add timeline cards alt slide (Slide 24 - horizontal timeline with all cards below)
 */
function addTimelineCardsAltSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.timelineCardsAlt;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section) {
    slide.addText(slideData.section.toUpperCase(), {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  const timelineConfig = layout.elements.timeline;
  const labelsConfig = layout.elements.labels;
  const cardsConfig = layout.elements.cards;
  const items = slideData.items || slideData.timeline || [];
  const itemCount = items.length;

  // Draw timeline line
  slide.addShape('line', {
    x: timelineConfig.startX,
    y: timelineConfig.y,
    w: timelineConfig.endX - timelineConfig.startX,
    h: 0,
    line: { color: timelineConfig.lineColor, width: timelineConfig.lineWidth }
  });

  // Calculate spacing
  const totalWidth = timelineConfig.endX - timelineConfig.startX;
  const spacing = itemCount > 1 ? totalWidth / (itemCount - 1) : totalWidth / 2;

  items.forEach((item, i) => {
    const markerX = timelineConfig.startX + (i * spacing);
    const cardX = markerX - (cardsConfig.width / 2);

    // Timeline marker
    slide.addShape('ellipse', {
      x: markerX - (timelineConfig.markerSize / 2),
      y: timelineConfig.y - (timelineConfig.markerSize / 2),
      w: timelineConfig.markerSize,
      h: timelineConfig.markerSize,
      fill: { color: timelineConfig.markerColor }
    });

    // Date/phase label (above line)
    if (item.date || item.phase || item.label) {
      slide.addText(item.date || item.phase || item.label, {
        x: cardX,
        y: labelsConfig.y,
        w: cardsConfig.width,
        h: 0.4,
        fontSize: labelsConfig.fontSize,
        fontFace: labelsConfig.fontFace,
        color: labelsConfig.color,
        align: 'center'
      });
    }

    // Card (below line) with navy border
    slide.addShape('rect', {
      x: cardX,
      y: cardsConfig.y,
      w: cardsConfig.width,
      h: cardsConfig.height,
      fill: { color: cardsConfig.background },
      line: { color: cardsConfig.borderColor, width: cardsConfig.borderWidth }
    });

    // Card title
    if (item.title) {
      slide.addText(item.title, {
        x: cardX + cardsConfig.padding,
        y: cardsConfig.y + cardsConfig.padding,
        w: cardsConfig.width - (cardsConfig.padding * 2),
        h: 0.4,
        fontSize: cardsConfig.titleFontSize,
        fontFace: cardsConfig.titleFontFace,
        color: cardsConfig.titleColor,
        align: 'left',
        bold: true
      });
    }

    // Card content
    if (item.content || item.description) {
      slide.addText(item.content || item.description, {
        x: cardX + cardsConfig.padding,
        y: cardsConfig.y + cardsConfig.padding + 0.5,
        w: cardsConfig.width - (cardsConfig.padding * 2),
        h: cardsConfig.height - cardsConfig.padding - 0.6,
        fontSize: cardsConfig.contentFontSize,
        fontFace: cardsConfig.contentFontFace,
        color: cardsConfig.contentColor,
        align: 'left',
        valign: 'top'
      });
    }

    // Connector line from marker to card
    slide.addShape('line', {
      x: markerX,
      y: timelineConfig.y + (timelineConfig.markerSize / 2),
      w: 0,
      h: cardsConfig.y - timelineConfig.y - (timelineConfig.markerSize / 2),
      line: { color: timelineConfig.markerColor, width: 1, dashType: 'dash' }
    });
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add timeline with numbered markers slide (Slide 23 - horizontal timeline with numbered circles)
 */
function addTimelineNumberedMarkersSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.timelineNumberedMarkers;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Section label
  if (slideData.section) {
    slide.addText(slideData.section.toUpperCase(), {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Main title
  if (slideData.title) {
    slide.addText(slideData.title, {
      x: layout.elements.title.x,
      y: layout.elements.title.y,
      w: layout.elements.title.w,
      h: layout.elements.title.h,
      fontSize: layout.elements.title.fontSize,
      fontFace: layout.elements.title.fontFace,
      color: layout.elements.title.color,
      align: layout.elements.title.align
    });
  }

  const timelineConfig = layout.elements.timeline;
  const stepsConfig = layout.elements.steps;
  const steps = slideData.steps || slideData.items || [];
  const stepCount = steps.length;

  // Draw timeline line
  slide.addShape('line', {
    x: timelineConfig.startX,
    y: timelineConfig.y,
    w: timelineConfig.endX - timelineConfig.startX,
    h: 0,
    line: { color: timelineConfig.lineColor, width: timelineConfig.lineWidth }
  });

  // Calculate spacing for step markers
  const totalWidth = timelineConfig.endX - timelineConfig.startX;
  const spacing = stepCount > 1 ? totalWidth / (stepCount - 1) : totalWidth / 2;

  steps.forEach((step, i) => {
    const markerX = timelineConfig.startX + (i * spacing);
    const contentX = markerX - (stepsConfig.contentWidth / 2);

    // Numbered circle marker (on the line)
    slide.addShape('ellipse', {
      x: markerX - (timelineConfig.markerSize / 2),
      y: timelineConfig.y - (timelineConfig.markerSize / 2),
      w: timelineConfig.markerSize,
      h: timelineConfig.markerSize,
      fill: { color: timelineConfig.markerColor }
    });

    // Step number inside circle
    slide.addText(`${i + 1}`, {
      x: markerX - (timelineConfig.markerSize / 2),
      y: timelineConfig.y - (timelineConfig.markerSize / 2),
      w: timelineConfig.markerSize,
      h: timelineConfig.markerSize,
      fontSize: stepsConfig.numberFontSize,
      fontFace: stepsConfig.numberFontFace,
      color: stepsConfig.numberColor,
      align: 'center',
      valign: 'middle'
    });

    // Step title (below line)
    if (step.title) {
      slide.addText(step.title, {
        x: contentX,
        y: stepsConfig.contentY,
        w: stepsConfig.contentWidth,
        h: 0.5,
        fontSize: stepsConfig.titleFontSize,
        fontFace: stepsConfig.titleFontFace,
        color: stepsConfig.titleColor,
        align: 'center'
      });
    }

    // Step description (below title)
    if (step.description || step.content) {
      slide.addText(step.description || step.content, {
        x: contentX,
        y: stepsConfig.contentY + 0.6,
        w: stepsConfig.contentWidth,
        h: stepsConfig.contentHeight - 0.6,
        fontSize: stepsConfig.descFontSize,
        fontFace: stepsConfig.descFontFace,
        color: stepsConfig.descColor,
        align: 'center',
        valign: 'top'
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add contents navigation slide (Slide 5)
 * Interactive TOC with section list and preview area
 */
function addContentsNavSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.contentsNav;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Title ("Contents")
  slide.addText(slideData.title || 'Contents', {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align
  });

  // Section items (left side)
  const sectionsConfig = layout.elements.sections;
  const sections = slideData.sections || slideData.items || [];

  sections.forEach((section, index) => {
    const itemY = sectionsConfig.y + (index * sectionsConfig.itemHeight);
    const sectionNum = String(index + 1).padStart(2, '0');

    // Section number (red)
    slide.addText(sectionNum, {
      x: sectionsConfig.x,
      y: itemY,
      w: 0.6,
      h: sectionsConfig.itemHeight,
      fontSize: sectionsConfig.fontSize,
      fontFace: sectionsConfig.numberFontFace,
      color: sectionsConfig.numberColor,
      align: 'left',
      valign: 'middle'
    });

    // Section title
    slide.addText(section.title || section, {
      x: sectionsConfig.x + 0.6,
      y: itemY,
      w: sectionsConfig.w - 0.6,
      h: sectionsConfig.itemHeight,
      fontSize: sectionsConfig.fontSize,
      fontFace: sectionsConfig.fontFace,
      color: sectionsConfig.color,
      align: 'left',
      valign: 'middle'
    });
  });

  // Preview area (right side - gray box with number)
  const previewConfig = layout.elements.preview;
  slide.addShape('rect', {
    x: previewConfig.x,
    y: previewConfig.y,
    w: previewConfig.w,
    h: previewConfig.h,
    fill: { color: previewConfig.background }
  });

  // Preview number (shows current/highlighted section)
  const previewNumber = slideData.previewNumber || '01';
  slide.addText(previewNumber, {
    x: previewConfig.x,
    y: previewConfig.y + 1.5,
    w: previewConfig.w,
    h: 1.5,
    fontSize: previewConfig.numberFontSize,
    fontFace: previewConfig.numberFontFace,
    color: previewConfig.numberColor,
    align: 'center',
    valign: 'middle'
  });

  // Preview title
  const previewTitle = slideData.previewTitle || (sections[0]?.title || sections[0] || 'Section Title');
  slide.addText(previewTitle, {
    x: previewConfig.x,
    y: previewConfig.y + 3.5,
    w: previewConfig.w,
    h: 1,
    fontSize: previewConfig.titleFontSize,
    fontFace: previewConfig.titleFontFace,
    color: previewConfig.titleColor,
    align: 'center',
    valign: 'top'
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });

  // Logo placeholder
  addLogoPlaceholder(slide, layout.elements.logo, 'small');
}

/**
 * Add thank you alternative slide (Slide 35)
 * Navy background with pattern and QR code option
 */
function addThankYouAltSlide(pptx, slideData) {
  const layout = LAYOUTS.thankYouAlt;
  const slide = pptx.addSlide();

  // Set background
  slide.background = { color: layout.background };

  // Geometric pattern placeholder (top area)
  slide.addShape('rect', {
    x: layout.elements.pattern.x,
    y: layout.elements.pattern.y,
    w: layout.elements.pattern.w,
    h: layout.elements.pattern.h,
    fill: { color: '1a3a5c' }  // Slightly lighter navy as placeholder
  });

  // "Thank You" title
  slide.addText(slideData.title || 'Thank You', {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align
  });

  // Contact info
  const contactText = slideData.contact || slideData.email || 'contact@company.com | www.company.com';
  slide.addText(contactText, {
    x: layout.elements.contact.x,
    y: layout.elements.contact.y,
    w: layout.elements.contact.w,
    h: layout.elements.contact.h,
    fontSize: layout.elements.contact.fontSize,
    fontFace: layout.elements.contact.fontFace,
    color: layout.elements.contact.color,
    align: layout.elements.contact.align
  });

  // QR code placeholder
  if (slideData.qrCode) {
    slide.addImage({
      path: slideData.qrCode,
      x: layout.elements.qrCode.x,
      y: layout.elements.qrCode.y,
      w: layout.elements.qrCode.w,
      h: layout.elements.qrCode.h
    });
  } else {
    // QR code placeholder rectangle
    slide.addShape('rect', {
      x: layout.elements.qrCode.x,
      y: layout.elements.qrCode.y,
      w: layout.elements.qrCode.w,
      h: layout.elements.qrCode.h,
      fill: { color: COLORS.white }
    });
    slide.addText('QR', {
      x: layout.elements.qrCode.x,
      y: layout.elements.qrCode.y,
      w: layout.elements.qrCode.w,
      h: layout.elements.qrCode.h,
      fontSize: 14,
      fontFace: FONTS.semibold,
      color: COLORS.navy,
      align: 'center',
      valign: 'middle'
    });
  }

  // Large logo placeholder (right side)
  addLogoPlaceholder(slide, layout.elements.logo, 'large');
}

/**
 * Add logo placeholder (will be replaced with actual logo when provided)
 */
function addLogoPlaceholder(slide, position, size = 'medium') {
  // For now, add "bip." text as placeholder
  // This will be replaced with actual SVG/PNG logo later
  const fontSize = size === 'large' ? 48 : size === 'small' ? 18 : 24;

  slide.addText('bip.', {
    x: position.x,
    y: position.y,
    w: position.w,
    h: position.h,
    fontSize: fontSize,
    fontFace: FONTS.bold,
    color: COLORS.red,
    align: 'left',
    valign: 'middle'
  });
}

export default {
  generatePptx
};
