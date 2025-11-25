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
        case 'bullets':
          addBulletsSlide(pptx, slideData, slideNumber);
          break;
        case 'content':
          addContentSlide(pptx, slideData, slideNumber);
          break;
        case 'quote':
          addQuoteSlide(pptx, slideData, slideNumber);
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
