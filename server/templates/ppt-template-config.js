/**
 * PPT Template Configuration
 *
 * Exact positioning extracted from branded PPTX template.
 * All measurements are in inches (pptxgenjs uses inches).
 * Original PPTX uses EMUs (914400 EMUs = 1 inch)
 *
 * Slide dimensions: 13.33" x 7.5" (16:9 widescreen)
 */

// Helper to convert EMUs to inches
const emuToInch = (emu) => emu / 914400;

// Brand colors
export const COLORS = {
  navy: '0C2340',        // Primary background
  red: 'DA291C',         // Accent color
  white: 'FFFFFF',
  lightGray: 'E8E8E8',
  darkGray: '6B7280',
  black: '000000'
};

// Brand fonts
export const FONTS = {
  thin: 'Work Sans Thin',
  light: 'Work Sans Light',
  regular: 'Work Sans',
  medium: 'Work Sans Medium',
  semibold: 'Work Sans SemiBold',
  bold: 'Work Sans Bold',
  // Fallback for systems without Work Sans
  fallback: 'Arial'
};

// Slide dimensions (16:9 widescreen)
export const SLIDE_SIZE = {
  width: 13.33,
  height: 7.5
};

/**
 * Layout configurations for each slide type
 * Coordinates extracted from PPTX XML
 */
export const LAYOUTS = {

  // ============================================
  // TITLE SLIDE - Navy background with geometric pattern
  // ============================================
  title: {
    name: 'Title Slide',
    background: COLORS.navy,
    elements: {
      // Geometric pattern banner (placeholder - image position)
      banner: {
        x: 0,
        y: 0,
        w: SLIDE_SIZE.width,
        h: 2.3,  // ~30% of slide height
        placeholder: true  // Will use placeholder until graphic provided
      },
      // Month/Year text
      date: {
        x: 0.23,
        y: 2.7,
        w: 4.74,
        h: 0.4,
        fontSize: 18,
        fontFace: FONTS.light,
        color: COLORS.white,
        align: 'left'
      },
      // Main title
      title: {
        x: 0.23,
        y: 3.3,
        w: 8.5,
        h: 2.5,
        fontSize: 54,
        fontFace: FONTS.light,
        color: COLORS.white,
        align: 'left',
        lineSpacing: 80  // 80% line height
      },
      // Logo placeholder (bottom left)
      logo: {
        x: 0.29,
        y: 6.78,
        w: 0.69,
        h: 0.48,
        placeholder: true
      },
      // "Here to Dare." tagline (bottom right)
      tagline: {
        x: 10.5,
        y: 7.0,
        w: 2.5,
        h: 0.3,
        fontSize: 14,
        fontFace: FONTS.medium,
        color: COLORS.white,
        align: 'right',
        text: 'Here to Dare.'
      }
    }
  },

  // ============================================
  // TITLE WITH IMAGE - Split layout
  // ============================================
  titleWithImage: {
    name: 'Title with Image',
    background: COLORS.navy,
    elements: {
      // Left content area (navy)
      leftPanel: {
        x: 0,
        y: 0,
        w: 5.22,
        h: SLIDE_SIZE.height,
        fill: COLORS.navy
      },
      // Tagline (top)
      tagline: {
        x: 0.18,
        y: 0.36,
        w: 4.74,
        h: 0.34,
        fontSize: 16,
        fontFace: FONTS.semibold,
        color: COLORS.white,
        align: 'left'
      },
      // Main title
      title: {
        x: 0.23,
        y: 1.1,
        w: 4.74,
        h: 1.46,
        fontSize: 54,
        fontFace: FONTS.light,
        color: COLORS.white,
        align: 'left',
        lineSpacing: 80
      },
      // Logo (bottom left)
      logo: {
        x: 0.29,
        y: 6.78,
        w: 0.69,
        h: 0.48,
        placeholder: true
      },
      // Business Area
      businessArea: {
        x: 1.39,
        y: 6.78,
        w: 1.38,
        h: 0.48,
        fontSize: 16,
        fontFace: FONTS.regular,
        color: COLORS.white,
        align: 'left'
      },
      // Date
      date: {
        x: 3.08,
        y: 6.78,
        w: 1.38,
        h: 0.48,
        fontSize: 16,
        fontFace: FONTS.regular,
        color: COLORS.white,
        align: 'left'
      },
      // Image placeholder (right half)
      image: {
        x: 5.21,
        y: 0,
        w: 8.17,
        h: SLIDE_SIZE.height,
        placeholder: true
      }
    }
  },

  // ============================================
  // SECTION DIVIDER - Navy with large number
  // ============================================
  sectionDivider: {
    name: 'Section Divider',
    background: COLORS.navy,
    elements: {
      // Section number (small, top left)
      sectionNumber: {
        x: 0.29,
        y: 0.24,
        w: 4.48,
        h: 0.51,
        fontSize: 28,
        fontFace: FONTS.light,
        color: COLORS.white,
        align: 'left'
      },
      // Presentation title (small)
      presentationTitle: {
        x: 0.29,
        y: 0.76,
        w: 4.38,
        h: 0.29,
        fontSize: 12,
        fontFace: FONTS.semibold,
        color: COLORS.white,
        align: 'left'
      },
      // Large section number (watermark style)
      largeNumber: {
        x: -0.09,
        y: 2.71,
        w: 6.69,
        h: 5.98,
        fontSize: 413,
        fontFace: FONTS.thin,
        color: COLORS.white,
        align: 'left',
        valign: 'bottom'
      },
      // Section title (right side)
      sectionTitle: {
        x: 6.94,
        y: 3.64,
        w: 6.11,
        h: 3.89,
        fontSize: 80,
        fontFace: FONTS.medium,
        color: COLORS.white,
        align: 'right',
        valign: 'bottom',
        lineSpacing: 80
      }
    }
  },

  // ============================================
  // CONTENT - Title + Bullets (white background)
  // ============================================
  bullets: {
    name: 'Content with Bullets',
    background: COLORS.white,
    elements: {
      // Section label (red, top)
      sectionLabel: {
        x: 0.33,
        y: 0.17,
        w: 3,
        h: 0.25,
        fontSize: 10,
        fontFace: FONTS.semibold,
        color: COLORS.red,
        align: 'left'
      },
      // Main title
      title: {
        x: 0.33,
        y: 0.42,
        w: 5.5,
        h: 1.5,
        fontSize: 32,
        fontFace: FONTS.light,
        color: COLORS.navy,
        align: 'left',
        lineSpacing: 90
      },
      // Intro paragraph
      intro: {
        x: 0.33,
        y: 2.0,
        w: 5.5,
        h: 1.5,
        fontSize: 11,
        fontFace: FONTS.regular,
        color: COLORS.navy,
        align: 'left',
        lineSpacing: 140
      },
      // Bullets area (right side)
      bullets: {
        x: 6.5,
        y: 1.5,
        w: 6.5,
        h: 5.0,
        fontSize: 11,
        fontFace: FONTS.regular,
        color: COLORS.navy,
        bulletColor: COLORS.red,
        lineSpacing: 180
      },
      // Geometric accent (top right corner)
      accent: {
        x: 11.33,
        y: 0,
        w: 2,
        h: 1.5,
        placeholder: true
      },
      // Page number (bottom left)
      pageNumber: {
        x: 0.33,
        y: 7.15,
        w: 0.5,
        h: 0.2,
        fontSize: 8,
        fontFace: FONTS.regular,
        color: COLORS.darkGray,
        align: 'left'
      },
      // Logo (bottom right)
      logo: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  },

  // ============================================
  // CONTENT - Paragraph text
  // ============================================
  content: {
    name: 'Content with Text',
    background: COLORS.white,
    elements: {
      // Section label
      sectionLabel: {
        x: 0.33,
        y: 0.17,
        w: 3,
        h: 0.25,
        fontSize: 10,
        fontFace: FONTS.semibold,
        color: COLORS.red,
        align: 'left'
      },
      // Main title (large, left side)
      title: {
        x: 0.33,
        y: 0.5,
        w: 4.5,
        h: 2.5,
        fontSize: 48,
        fontFace: FONTS.thin,
        color: COLORS.navy,
        align: 'left',
        lineSpacing: 85
      },
      // Content paragraphs (right side, multiple columns)
      content: {
        x: 5.5,
        y: 1.5,
        w: 7.5,
        h: 5.0,
        fontSize: 10,
        fontFace: FONTS.regular,
        color: COLORS.navy,
        lineSpacing: 150,
        columns: 2
      },
      // Geometric accent
      accent: {
        x: 11.33,
        y: 0,
        w: 2,
        h: 1.5,
        placeholder: true
      },
      // Page number
      pageNumber: {
        x: 0.33,
        y: 7.15,
        w: 0.5,
        h: 0.2,
        fontSize: 8,
        fontFace: FONTS.regular,
        color: COLORS.darkGray,
        align: 'left'
      },
      // Logo
      logo: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  },

  // ============================================
  // QUOTE - Large quote with attribution
  // ============================================
  quote: {
    name: 'Quote',
    background: COLORS.white,
    elements: {
      // Geometric pattern (left side)
      pattern: {
        x: 0,
        y: 0,
        w: 3.5,
        h: SLIDE_SIZE.height,
        placeholder: true
      },
      // Section label
      sectionLabel: {
        x: 4.0,
        y: 0.5,
        w: 3,
        h: 0.25,
        fontSize: 10,
        fontFace: FONTS.semibold,
        color: COLORS.red,
        align: 'left'
      },
      // Quote title/intro
      title: {
        x: 4.0,
        y: 0.8,
        w: 8.5,
        h: 1.2,
        fontSize: 28,
        fontFace: FONTS.light,
        color: COLORS.navy,
        align: 'left',
        lineSpacing: 100
      },
      // Quote text (larger, with colored line)
      quote: {
        x: 4.0,
        y: 2.5,
        w: 8.5,
        h: 3.5,
        fontSize: 14,
        fontFace: FONTS.regular,
        color: COLORS.navy,
        align: 'left',
        lineSpacing: 180,
        borderLeft: {
          width: 3,
          color: COLORS.red
        }
      },
      // Logo
      logo: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  },

  // ============================================
  // THANK YOU - Closing slide
  // ============================================
  thankYou: {
    name: 'Thank You',
    background: COLORS.navy,
    elements: {
      // Geometric pattern (top half)
      pattern: {
        x: 0,
        y: 0,
        w: SLIDE_SIZE.width,
        h: 4.0,
        placeholder: true
      },
      // "Thank You" text
      title: {
        x: 0.5,
        y: 5.0,
        w: 5,
        h: 1.2,
        fontSize: 48,
        fontFace: FONTS.light,
        color: COLORS.white,
        align: 'left'
      },
      // Contact info
      contact: {
        x: 0.5,
        y: 6.5,
        w: 5,
        h: 0.5,
        fontSize: 10,
        fontFace: FONTS.regular,
        color: COLORS.white,
        align: 'left'
      },
      // Large logo (right side)
      logo: {
        x: 10.5,
        y: 4.5,
        w: 2.0,
        h: 1.4,
        placeholder: true
      }
    }
  },

  // ============================================
  // TABLE OF CONTENTS
  // ============================================
  tableOfContents: {
    name: 'Table of Contents',
    background: COLORS.lightGray,
    elements: {
      // Logo (top left)
      logo: {
        x: 0.33,
        y: 0.33,
        w: 0.69,
        h: 0.48,
        placeholder: true
      },
      // Large "Table of Contents" watermark
      watermark: {
        x: 0.33,
        y: 3.0,
        w: 6,
        h: 4,
        fontSize: 72,
        fontFace: FONTS.thin,
        color: COLORS.navy,
        align: 'left',
        valign: 'bottom',
        lineSpacing: 75
      },
      // TOC items (right side)
      items: {
        x: 7.5,
        y: 0.8,
        w: 5.5,
        h: 6.0,
        fontSize: 14,
        fontFace: FONTS.regular,
        color: COLORS.navy,
        lineSpacing: 180,
        itemSpacing: 0.6  // Space between numbered items
      },
      // Logo (bottom right)
      logoBottom: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  },

  // ============================================
  // STEPS/PROCESS - Red background with steps
  // ============================================
  steps: {
    name: 'Process Steps',
    background: COLORS.red,
    elements: {
      // Main title (left side)
      title: {
        x: 0.5,
        y: 1.0,
        w: 4,
        h: 2,
        fontSize: 48,
        fontFace: FONTS.light,
        color: COLORS.white,
        align: 'left',
        lineSpacing: 85
      },
      // Description text (top right)
      description: {
        x: 5.0,
        y: 0.5,
        w: 8,
        h: 2.0,
        fontSize: 11,
        fontFace: FONTS.regular,
        color: COLORS.white,
        lineSpacing: 150,
        columns: 3
      },
      // Steps row (bottom)
      stepsArea: {
        y: 4.5,
        stepWidth: 2.4,
        stepHeight: 2.5,
        stepGap: 0.2,
        numberFontSize: 18,
        titleFontSize: 14,
        descFontSize: 10,
        fontFace: FONTS.regular,
        color: COLORS.white
      },
      // Logo
      logo: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  },

  // ============================================
  // CARD GRID - 3x3 card layout (Slide 11)
  // ============================================
  cardGrid: {
    name: 'Card Grid Layout',
    background: COLORS.white,
    elements: {
      // Section label (red, top left)
      sectionLabel: {
        x: 0.33,
        y: 0.17,
        w: 3,
        h: 0.25,
        fontSize: 10,
        fontFace: FONTS.semibold,
        color: COLORS.red,
        align: 'left'
      },
      // Title row
      title: {
        x: 0.5,
        y: 0.5,
        w: 12.5,
        h: 0.5,
        fontSize: 18,
        fontFace: FONTS.light,
        color: COLORS.navy,
        align: 'left'
      },
      // Cards configuration
      cards: {
        startX: 0.5,
        startY: 1.2,
        cardWidth: 4,
        cardHeight: 1.8,
        gapX: 0.2,
        gapY: 0.2,
        columns: 3,
        maxRows: 3,
        cardBackground: COLORS.lightGray,
        titleFontSize: 14,
        titleFontFace: FONTS.semibold,
        titleColor: COLORS.navy,
        contentFontSize: 10,
        contentFontFace: FONTS.regular,
        contentColor: COLORS.navy,
        padding: 0.2
      },
      // Page number (bottom left)
      pageNumber: {
        x: 0.33,
        y: 7.15,
        w: 0.5,
        h: 0.2,
        fontSize: 8,
        fontFace: FONTS.regular,
        color: COLORS.darkGray,
        align: 'left'
      },
      // Logo (bottom right)
      logo: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  },

  // ============================================
  // FEATURE GRID - Icon-based feature layout (Slides 13-14)
  // ============================================
  featureGrid: {
    name: 'Feature Grid',
    background: COLORS.white,  // Can be overridden for red variant
    elements: {
      // Section label (red, top left)
      sectionLabel: {
        x: 0.33,
        y: 0.17,
        w: 3,
        h: 0.25,
        fontSize: 10,
        fontFace: FONTS.semibold,
        color: COLORS.red,
        align: 'left'
      },
      // Title row
      title: {
        x: 0.5,
        y: 0.3,
        w: 12,
        h: 0.8,
        fontSize: 28,
        fontFace: FONTS.light,
        color: COLORS.navy,
        align: 'left'
      },
      // Features configuration
      features: {
        startX: 0.5,
        startY: 1.5,
        featureWidth: 2.4,
        featureHeight: 2.2,
        gapX: 0.3,
        gapY: 0.5,
        columns: 5,
        maxRows: 2,
        iconSize: 0.8,
        iconBackground: COLORS.navy,
        titleFontSize: 12,
        titleFontFace: FONTS.semibold,
        titleColor: COLORS.navy,
        descFontSize: 10,
        descFontFace: FONTS.regular,
        descColor: COLORS.darkGray
      },
      // Page number (bottom left)
      pageNumber: {
        x: 0.33,
        y: 7.15,
        w: 0.5,
        h: 0.2,
        fontSize: 8,
        fontFace: FONTS.regular,
        color: COLORS.darkGray,
        align: 'left'
      },
      // Logo (bottom right)
      logo: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  },

  // ============================================
  // TWO-COLUMN QUOTE - Side by side quotes (Slide 16)
  // ============================================
  quoteTwoColumn: {
    name: 'Two-Column Quote',
    background: COLORS.white,
    elements: {
      // Section label (red, top left)
      sectionLabel: {
        x: 0.33,
        y: 0.17,
        w: 3,
        h: 0.25,
        fontSize: 10,
        fontFace: FONTS.semibold,
        color: COLORS.red,
        align: 'left'
      },
      // Main title
      title: {
        x: 0.5,
        y: 0.5,
        w: 12,
        h: 0.8,
        fontSize: 28,
        fontFace: FONTS.light,
        color: COLORS.navy,
        align: 'left'
      },
      // Left quote configuration
      leftQuote: {
        x: 0.5,
        y: 1.5,
        w: 5.8,
        h: 4.5,
        titleFontSize: 16,
        titleFontFace: FONTS.semibold,
        titleColor: COLORS.navy,
        textFontSize: 12,
        textFontFace: FONTS.regular,
        textColor: COLORS.navy,
        accentColor: COLORS.red,
        accentWidth: 0.05
      },
      // Right quote configuration
      rightQuote: {
        x: 6.8,
        y: 1.5,
        w: 5.8,
        h: 4.5,
        titleFontSize: 16,
        titleFontFace: FONTS.semibold,
        titleColor: COLORS.navy,
        textFontSize: 12,
        textFontFace: FONTS.regular,
        textColor: COLORS.navy,
        accentColor: COLORS.red,
        accentWidth: 0.05
      },
      // Page number (bottom left)
      pageNumber: {
        x: 0.33,
        y: 7.15,
        w: 0.5,
        h: 0.2,
        fontSize: 8,
        fontFace: FONTS.regular,
        color: COLORS.darkGray,
        align: 'left'
      },
      // Logo (bottom right)
      logo: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  },

  // ============================================
  // QUOTE WITH METRICS - Quote + data visualization (Slide 17)
  // ============================================
  quoteWithMetrics: {
    name: 'Quote with Metrics',
    background: COLORS.white,
    elements: {
      // Section label (red, top left)
      sectionLabel: {
        x: 0.33,
        y: 0.17,
        w: 3,
        h: 0.25,
        fontSize: 10,
        fontFace: FONTS.semibold,
        color: COLORS.red,
        align: 'left'
      },
      // Quote area (top)
      quote: {
        x: 0.5,
        y: 0.8,
        w: 12,
        h: 3,
        fontSize: 16,
        fontFace: FONTS.regular,
        color: COLORS.navy,
        accentColor: COLORS.red,
        accentWidth: 0.05
      },
      // Metrics row (bottom)
      metrics: {
        y: 4.5,
        startX: 0.5,
        metricWidth: 2.8,
        gap: 0.5,
        maxMetrics: 4,
        valueFontSize: 48,
        valueFontFace: FONTS.light,
        valueColor: COLORS.red,
        labelFontSize: 11,
        labelFontFace: FONTS.regular,
        labelColor: COLORS.navy
      },
      // Page number (bottom left)
      pageNumber: {
        x: 0.33,
        y: 7.15,
        w: 0.5,
        h: 0.2,
        fontSize: 8,
        fontFace: FONTS.regular,
        color: COLORS.darkGray,
        align: 'left'
      },
      // Logo (bottom right)
      logo: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  },

  // ============================================
  // TIMELINE NUMBERED MARKERS - Horizontal timeline with numbered markers (Slide 23)
  // ============================================
  timelineNumberedMarkers: {
    name: 'Timeline with Numbered Markers',
    background: COLORS.white,
    elements: {
      // Section label (red, top left)
      sectionLabel: {
        x: 0.33,
        y: 0.17,
        w: 3,
        h: 0.25,
        fontSize: 10,
        fontFace: FONTS.semibold,
        color: COLORS.red,
        align: 'left'
      },
      // Main title
      title: {
        x: 0.5,
        y: 0.3,
        w: 12,
        h: 0.6,
        fontSize: 28,
        fontFace: FONTS.light,
        color: COLORS.navy,
        align: 'left'
      },
      // Timeline line configuration
      timeline: {
        y: 3.5,
        startX: 1,
        endX: 12,
        lineColor: COLORS.red,
        lineWidth: 3,
        markerSize: 0.8,
        markerColor: COLORS.red
      },
      // Step configuration
      steps: {
        contentWidth: 2,
        contentHeight: 2,
        contentY: 4.2,
        numberFontSize: 18,
        numberFontFace: FONTS.bold,
        numberColor: COLORS.white,
        titleFontSize: 12,
        titleFontFace: FONTS.semibold,
        titleColor: COLORS.navy,
        descFontSize: 10,
        descFontFace: FONTS.regular,
        descColor: COLORS.darkGray
      },
      // Page number (bottom left)
      pageNumber: {
        x: 0.33,
        y: 7.15,
        w: 0.5,
        h: 0.2,
        fontSize: 8,
        fontFace: FONTS.regular,
        color: COLORS.darkGray,
        align: 'left'
      },
      // Logo (bottom right)
      logo: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  },

  // ============================================
  // TIMELINE CARDS - Horizontal timeline with cards (Slide 22)
  // ============================================
  timelineCards: {
    name: 'Timeline Cards',
    background: COLORS.white,
    elements: {
      // Section label (red, top left)
      sectionLabel: {
        x: 0.33,
        y: 0.17,
        w: 3,
        h: 0.25,
        fontSize: 10,
        fontFace: FONTS.semibold,
        color: COLORS.red,
        align: 'left'
      },
      // Main title
      title: {
        x: 0.5,
        y: 0.5,
        w: 12,
        h: 0.8,
        fontSize: 28,
        fontFace: FONTS.light,
        color: COLORS.navy,
        align: 'left'
      },
      // Timeline line configuration
      timeline: {
        y: 3.5,
        startX: 0.5,
        endX: 12.83,
        lineColor: COLORS.navy,
        lineWidth: 3,
        markerSize: 0.5,
        markerColor: COLORS.red
      },
      // Cards configuration
      cards: {
        width: 2.5,
        height: 1.8,
        gap: 0.3,
        background: COLORS.lightGray,
        titleFontSize: 12,
        titleFontFace: FONTS.semibold,
        titleColor: COLORS.navy,
        contentFontSize: 10,
        contentFontFace: FONTS.regular,
        contentColor: COLORS.darkGray,
        padding: 0.15
      },
      // Page number (bottom left)
      pageNumber: {
        x: 0.33,
        y: 7.15,
        w: 0.5,
        h: 0.2,
        fontSize: 8,
        fontFace: FONTS.regular,
        color: COLORS.darkGray,
        align: 'left'
      },
      // Logo (bottom right)
      logo: {
        x: 12.5,
        y: 7.0,
        w: 0.69,
        h: 0.35,
        placeholder: true
      }
    }
  }
};

/**
 * Map current slide types to template layouts
 */
export const SLIDE_TYPE_MAP = {
  'title': 'title',
  'titleWithImage': 'titleWithImage',
  'bullets': 'bullets',
  'content': 'content',
  'quote': 'quote',
  'quoteTwoColumn': 'quoteTwoColumn',
  'quoteWithMetrics': 'quoteWithMetrics',
  'timelineCards': 'timelineCards',
  'timelineNumberedMarkers': 'timelineNumberedMarkers',
  'section': 'sectionDivider',
  'thankyou': 'thankYou',
  'toc': 'tableOfContents',
  'steps': 'steps',
  'cardGrid': 'cardGrid',
  'featureGrid': 'featureGrid',
  'featureGridRed': 'featureGrid'
};

/**
 * Default presentation metadata
 */
export const DEFAULT_METADATA = {
  title: 'Presentation',
  author: 'BIP',
  company: 'BIP',
  revision: '1',
  subject: 'Generated Presentation'
};

export default {
  COLORS,
  FONTS,
  SLIDE_SIZE,
  LAYOUTS,
  SLIDE_TYPE_MAP,
  DEFAULT_METADATA
};
