/**
 * Slide Data Model
 * Defines schemas, validation, and utilities for structured presentation data
 * Designed for dual rendering (Web + PowerPoint export)
 */

import { CUSTOM_SLIDE_TYPES } from './SlideTemplates.js';

/**
 * Validate complete presentation data
 * @param {Object} data - Presentation data object
 * @returns {Object} - {valid: boolean, errors: Array}
 */
export function validatePresentationData(data) {
  const errors = [];

  // Validate metadata
  if (!data.metadata) {
    errors.push('Missing metadata');
  } else {
    if (!data.metadata.title) errors.push('Missing metadata.title');
    if (!data.metadata.slideCount) errors.push('Missing metadata.slideCount');
  }

  // Validate theme
  if (!data.theme) {
    errors.push('Missing theme');
  } else {
    if (!data.theme.colors) errors.push('Missing theme.colors');
    if (!data.theme.fonts) errors.push('Missing theme.fonts');
  }

  // Validate slides
  if (!data.slides || !Array.isArray(data.slides)) {
    errors.push('Missing or invalid slides array');
  } else if (data.slides.length === 0) {
    errors.push('No slides found');
  } else {
    // Validate each slide
    data.slides.forEach((slide, index) => {
      const slideErrors = validateSlide(slide);
      if (slideErrors.length > 0) {
        errors.push(`Slide ${index + 1}: ${slideErrors.join(', ')}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate individual slide
 * @param {Object} slide - Slide data object
 * @returns {Array} - Array of error messages
 */
export function validateSlide(slide) {
  const errors = [];

  if (!slide.id) errors.push('Missing slide ID');
  if (!slide.type) errors.push('Missing slide type');
  if (!slide.content) errors.push('Missing slide content');

  // Type-specific validation
  if (slide.type) {
    const typeValidator = SLIDE_TYPE_VALIDATORS[slide.type];
    if (typeValidator) {
      const typeErrors = typeValidator(slide.content);
      errors.push(...typeErrors);
    } else {
      errors.push(`Unknown slide type: ${slide.type}`);
    }
  }

  return errors;
}

/**
 * Slide type validators
 * @private
 */
const SLIDE_TYPE_VALIDATORS = {
  title: (content) => {
    const errors = [];
    if (!content.title || !content.title.text) {
      errors.push('Missing title text');
    }
    if (!content.subtitle || !content.subtitle.text) {
      errors.push('Missing subtitle text');
    }
    return errors;
  },

  bullets: (content) => {
    const errors = [];
    if (!content.title || !content.title.text) {
      errors.push('Missing title text');
    }
    if (!content.bullets || !Array.isArray(content.bullets)) {
      errors.push('Missing or invalid bullets array');
    } else if (content.bullets.length === 0) {
      errors.push('Empty bullets array');
    }
    return errors;
  },

  'two-column': (content) => {
    const errors = [];
    if (!content.title || !content.title.text) {
      errors.push('Missing title text');
    }
    if (!content.leftColumn) {
      errors.push('Missing leftColumn');
    }
    if (!content.rightColumn) {
      errors.push('Missing rightColumn');
    }
    return errors;
  },

  image: (content) => {
    const errors = [];
    if (!content.title || !content.title.text) {
      errors.push('Missing title text');
    }
    if (!content.image || !content.image.src) {
      errors.push('Missing image source');
    }
    return errors;
  },

  section: (content) => {
    const errors = [];
    if (!content.sectionTitle || !content.sectionTitle.text) {
      errors.push('Missing section title');
    }
    return errors;
  },

  quote: (content) => {
    const errors = [];
    if (!content.quote || !content.quote.text) {
      errors.push('Missing quote text');
    }
    return errors;
  },

  table: (content) => {
    const errors = [];
    if (!content.title || !content.title.text) {
      errors.push('Missing title text');
    }
    if (!content.table || !content.table.headers || !content.table.rows) {
      errors.push('Invalid table structure');
    }
    return errors;
  },

  comparison: (content) => {
    const errors = [];
    if (!content.title || !content.title.text) {
      errors.push('Missing title text');
    }
    if (!content.items || !Array.isArray(content.items)) {
      errors.push('Missing or invalid items array');
    }
    return errors;
  }
};

// Register custom slide template validators
Object.keys(CUSTOM_SLIDE_TYPES).forEach(type => {
  SLIDE_TYPE_VALIDATORS[type] = CUSTOM_SLIDE_TYPES[type].validate;
});

/**
 * Generate unique slide ID
 * @returns {String} - Unique slide ID
 */
export function generateSlideId() {
  return `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create default presentation data structure
 * @param {Object} options - Optional overrides
 * @returns {Object} - Presentation data object
 */
export function createDefaultPresentation(options = {}) {
  return {
    metadata: {
      title: options.title || 'Untitled Presentation',
      author: options.author || 'AI Roadmap Generator',
      company: options.company || 'BIP',
      date: new Date().toISOString(),
      version: '1.0',
      slideCount: options.slideCount || 0
    },

    theme: options.theme || getDefaultTheme(),

    slides: options.slides || []
  };
}

/**
 * Get default theme configuration
 * @returns {Object} - Theme object
 */
export function getDefaultTheme() {
  return {
    aspectRatio: '16:9',
    width: 10,
    height: 5.625,

    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
      background: '#ffffff',
      text: {
        primary: '#1f2937',
        secondary: '#6b7280',
        muted: '#9ca3af'
      }
    },

    fonts: {
      title: {
        family: 'Work Sans',
        size: 44,
        weight: 700,
        color: '#1f2937'
      },
      subtitle: {
        family: 'Work Sans',
        size: 24,
        weight: 400,
        color: '#6b7280'
      },
      body: {
        family: 'Work Sans',
        size: 18,
        weight: 400,
        color: '#1f2937',
        lineHeight: 1.6
      },
      bullet: {
        family: 'Work Sans',
        size: 16,
        weight: 400,
        color: '#1f2937'
      }
    },

    spacing: {
      slideMargin: 0.5,
      titleTop: 0.75,
      contentTop: 1.5,
      bulletIndent: 0.5,
      lineSpacing: 1.2
    },

    branding: {
      logo: {
        enabled: false,
        position: 'top-right',
        width: 1,
        height: 0.5,
        padding: 0.25,
        imageData: null
      },
      footer: {
        enabled: false,
        text: 'Confidential',
        fontSize: 10,
        color: '#9ca3af',
        position: 'bottom-center'
      }
    }
  };
}

/**
 * Create blank slide of specified type
 * @param {String} type - Slide type
 * @param {Object} options - Optional content overrides
 * @returns {Object} - Slide data object
 */
export function createBlankSlide(type, options = {}) {
  const slideTemplates = {
    title: {
      id: generateSlideId(),
      type: 'title',
      layout: { name: 'Title Slide', variant: 'default' },
      content: {
        title: {
          text: options.title || 'Title Text',
          alignment: 'center',
          verticalAlign: 'middle'
        },
        subtitle: {
          text: options.subtitle || 'Subtitle Text',
          alignment: 'center'
        },
        accent: {
          type: 'line',
          color: '#3b82f6',
          height: 0.05,
          position: 'below-title'
        }
      },
      notes: ''
    },

    bullets: {
      id: generateSlideId(),
      type: 'bullets',
      layout: { name: 'Content', variant: 'bullets' },
      content: {
        title: {
          text: options.title || 'Bullet Points',
          alignment: 'left'
        },
        bullets: options.bullets || [
          { text: 'First point', level: 1, bullet: 'bullet' },
          { text: 'Second point', level: 1, bullet: 'bullet' },
          { text: 'Third point', level: 1, bullet: 'bullet' }
        ]
      },
      notes: ''
    },

    'two-column': {
      id: generateSlideId(),
      type: 'two-column',
      layout: { name: 'Two Content', variant: 'equal' },
      content: {
        title: {
          text: options.title || 'Two Column Layout',
          alignment: 'left'
        },
        leftColumn: options.leftColumn || {
          type: 'text',
          text: 'Left column content'
        },
        rightColumn: options.rightColumn || {
          type: 'text',
          text: 'Right column content'
        },
        ratio: '50:50'
      },
      notes: ''
    },

    image: {
      id: generateSlideId(),
      type: 'image',
      layout: { name: 'Picture with Caption', variant: 'full' },
      content: {
        title: {
          text: options.title || 'Image Slide',
          alignment: 'left'
        },
        image: {
          src: options.imageSrc || '',
          alt: options.imageAlt || 'Image',
          width: 80,
          height: 80,
          position: 'center',
          caption: options.imageCaption || ''
        }
      },
      notes: ''
    },

    section: {
      id: generateSlideId(),
      type: 'section',
      layout: { name: 'Section Header', variant: 'default' },
      content: {
        sectionNumber: options.sectionNumber || '01',
        sectionTitle: {
          text: options.title || 'Section Title',
          alignment: 'center',
          fontSize: 48,
          color: '#ffffff'
        },
        description: {
          text: options.description || '',
          alignment: 'center',
          fontSize: 20,
          color: '#ffffff'
        },
        background: {
          type: 'gradient',
          gradient: {
            type: 'linear',
            angle: 135,
            colors: ['#3b82f6', '#8b5cf6']
          }
        }
      },
      notes: ''
    },

    quote: {
      id: generateSlideId(),
      type: 'quote',
      layout: { name: 'Quote', variant: 'centered' },
      content: {
        quote: {
          text: options.quote || 'Quote text goes here',
          fontSize: 32,
          fontStyle: 'italic',
          color: '#1f2937',
          alignment: 'center'
        },
        attribution: {
          text: options.attribution || '- Author Name',
          fontSize: 18,
          color: '#6b7280',
          alignment: 'right'
        },
        quoteMarks: {
          enabled: true,
          style: 'decorative',
          color: '#3b82f6'
        }
      },
      notes: ''
    },

    table: {
      id: generateSlideId(),
      type: 'table',
      layout: { name: 'Table', variant: 'default' },
      content: {
        title: {
          text: options.title || 'Data Table',
          alignment: 'left'
        },
        table: {
          headers: options.headers || [
            { text: 'Header 1', width: 33, alignment: 'left' },
            { text: 'Header 2', width: 33, alignment: 'center' },
            { text: 'Header 3', width: 34, alignment: 'right' }
          ],
          rows: options.rows || [
            [
              { text: 'Row 1, Col 1', alignment: 'left' },
              { text: 'Row 1, Col 2', alignment: 'center' },
              { text: 'Row 1, Col 3', alignment: 'right' }
            ]
          ],
          style: {
            borderColor: '#e5e7eb',
            borderWidth: 1,
            alternateRowColors: true,
            headerBackgroundColor: '#3b82f6',
            headerTextColor: '#ffffff'
          }
        }
      },
      notes: ''
    },

    comparison: {
      id: generateSlideId(),
      type: 'comparison',
      layout: { name: 'Comparison', variant: 'two-side' },
      content: {
        title: {
          text: options.title || 'Comparison',
          alignment: 'left'
        },
        items: options.items || [
          {
            label: 'Option A',
            icon: '✓',
            bullets: [
              { text: 'Pro 1', type: 'pro', icon: '✓' },
              { text: 'Pro 2', type: 'pro', icon: '✓' }
            ],
            backgroundColor: '#f0fdf4',
            borderColor: '#10b981'
          },
          {
            label: 'Option B',
            icon: '✗',
            bullets: [
              { text: 'Con 1', type: 'con', icon: '✗' },
              { text: 'Con 2', type: 'con', icon: '✗' }
            ],
            backgroundColor: '#fef2f2',
            borderColor: '#ef4444'
          }
        ]
      },
      notes: ''
    }
  };

  const template = slideTemplates[type];
  if (!template) {
    throw new Error(`Unknown slide type: ${type}`);
  }

  return template;
}

/**
 * Migrate old slide data to new structured format
 * @param {Object} oldData - Old slide data
 * @returns {Object} - New presentation data
 */
export function migrateOldSlideData(oldData) {
  if (!oldData || !oldData.slides) {
    return createDefaultPresentation();
  }

  const presentation = createDefaultPresentation({
    title: oldData.title || 'Untitled Presentation',
    slideCount: oldData.slides.length
  });

  presentation.slides = oldData.slides.map((oldSlide, index) => {
    return migrateOldSlide(oldSlide, index);
  });

  return presentation;
}

/**
 * Migrate individual old slide to new format
 * @param {Object} oldSlide - Old slide data
 * @param {Number} index - Slide index
 * @returns {Object} - New slide data
 */
function migrateOldSlide(oldSlide, index) {
  // Attempt to determine slide type from old data
  const type = oldSlide.type || 'bullets';

  switch (type) {
    case 'title':
      return createBlankSlide('title', {
        title: oldSlide.title || 'Title',
        subtitle: oldSlide.subtitle || 'Subtitle'
      });

    case 'narrative':
    case 'content':
    case 'bullets':
      // Convert to bullets slide
      const bullets = Array.isArray(oldSlide.content)
        ? oldSlide.content.map(text => ({
            text: String(text),
            level: 1,
            bullet: 'bullet'
          }))
        : [{ text: String(oldSlide.content || 'Content'), level: 1, bullet: 'bullet' }];

      return createBlankSlide('bullets', {
        title: oldSlide.title || `Slide ${index + 1}`,
        bullets
      });

    default:
      // Default to bullets slide
      return createBlankSlide('bullets', {
        title: oldSlide.title || `Slide ${index + 1}`
      });
  }
}

/**
 * Clone slide data
 * @param {Object} slide - Slide to clone
 * @returns {Object} - Cloned slide with new ID
 */
export function cloneSlide(slide) {
  const cloned = JSON.parse(JSON.stringify(slide));
  cloned.id = generateSlideId();
  return cloned;
}

/**
 * Get slide type information
 * @param {String} type - Slide type
 * @returns {Object} - Type information
 */
export function getSlideTypeInfo(type) {
  const typeInfo = {
    title: {
      name: 'Title Slide',
      description: 'Opening or closing slide with title and subtitle',
      icon: '📊',
      category: 'Basic'
    },
    bullets: {
      name: 'Bullet Points',
      description: 'List of points with multi-level support',
      icon: '📝',
      category: 'Content'
    },
    'two-column': {
      name: 'Two Column',
      description: 'Side-by-side content layout',
      icon: '⚖️',
      category: 'Layout'
    },
    image: {
      name: 'Image',
      description: 'Full-size image with caption',
      icon: '🖼️',
      category: 'Media'
    },
    section: {
      name: 'Section Header',
      description: 'Chapter or section divider',
      icon: '🔷',
      category: 'Organization'
    },
    quote: {
      name: 'Quote',
      description: 'Executive quote or testimonial',
      icon: '💬',
      category: 'Content'
    },
    table: {
      name: 'Table',
      description: 'Data table with headers and rows',
      icon: '📋',
      category: 'Data'
    },
    comparison: {
      name: 'Comparison',
      description: 'Side-by-side comparison',
      icon: '⚖️',
      category: 'Analysis'
    }
  };

  return typeInfo[type] || {
    name: 'Unknown',
    description: 'Unknown slide type',
    icon: '❓',
    category: 'Other'
  };
}

/**
 * Get all supported slide types
 * @returns {Array} - Array of slide type strings
 */
export function getSupportedSlideTypes() {
  return ['title', 'bullets', 'two-column', 'image', 'section', 'quote', 'table', 'comparison'];
}
