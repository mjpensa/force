/**
 * presentation-config.js
 *
 * Centralized configuration for presentation system.
 * Provides default themes, presets, and configuration utilities.
 *
 * Part of the PPT-export-first architecture.
 */

/**
 * Default presentation theme
 */
export const DEFAULT_THEME = Object.freeze({
  aspectRatio: '16:9',

  colors: {
    primary: '#3b82f6',      // Blue
    secondary: '#8b5cf6',    // Purple
    accent: '#10b981',       // Green
    text: '#1e293b',         // Dark slate
    textSecondary: '#64748b', // Slate
    background: '#ffffff',   // White
    surface: '#f8fafc'       // Light gray
  },

  fonts: {
    title: {
      family: 'Work Sans',
      size: 44,
      weight: 700,
      color: '#1e293b'
    },
    subtitle: {
      family: 'Work Sans',
      size: 28,
      weight: 400,
      color: '#64748b'
    },
    body: {
      family: 'Work Sans',
      size: 20,
      weight: 400,
      color: '#1e293b'
    },
    caption: {
      family: 'Work Sans',
      size: 16,
      weight: 400,
      color: '#64748b'
    }
  },

  spacing: {
    slideMargin: 0.5,      // inches
    titleTop: 0.75,        // inches
    contentTop: 1.5,       // inches
    bulletIndent: 0.5,     // inches
    lineSpacing: 1.5       // multiplier
  },

  branding: {
    logo: {
      show: false,
      url: '',
      position: 'top-right', // top-left, top-right, bottom-left, bottom-right
      width: 1.5             // inches
    },
    footer: {
      show: false,
      text: '',
      fontSize: 14
    }
  }
});

/**
 * Professional/Banking theme (for client presentations)
 */
export const PROFESSIONAL_THEME = Object.freeze({
  aspectRatio: '16:9',

  colors: {
    primary: '#1e40af',      // Dark blue
    secondary: '#0f172a',    // Navy
    accent: '#059669',       // Dark green
    text: '#0f172a',         // Navy text
    textSecondary: '#475569', // Gray
    background: '#ffffff',   // White
    surface: '#f1f5f9'       // Light blue-gray
  },

  fonts: {
    title: {
      family: 'Work Sans',
      size: 40,
      weight: 700,
      color: '#1e40af'
    },
    subtitle: {
      family: 'Work Sans',
      size: 24,
      weight: 400,
      color: '#475569'
    },
    body: {
      family: 'Work Sans',
      size: 18,
      weight: 400,
      color: '#0f172a'
    },
    caption: {
      family: 'Work Sans',
      size: 14,
      weight: 400,
      color: '#64748b'
    }
  },

  spacing: {
    slideMargin: 0.75,
    titleTop: 0.75,
    contentTop: 1.5,
    bulletIndent: 0.5,
    lineSpacing: 1.4
  },

  branding: {
    logo: {
      show: true,
      url: '/bip_logo.png',
      position: 'top-right',
      width: 1.5
    },
    footer: {
      show: true,
      text: 'Confidential',
      fontSize: 12
    }
  }
});

/**
 * Dark mode theme
 */
export const DARK_THEME = Object.freeze({
  aspectRatio: '16:9',

  colors: {
    primary: '#60a5fa',      // Light blue
    secondary: '#a78bfa',    // Light purple
    accent: '#34d399',       // Light green
    text: '#f8fafc',         // Almost white
    textSecondary: '#cbd5e1', // Light gray
    background: '#0f172a',   // Navy
    surface: '#1e293b'       // Dark slate
  },

  fonts: {
    title: {
      family: 'Work Sans',
      size: 44,
      weight: 700,
      color: '#f8fafc'
    },
    subtitle: {
      family: 'Work Sans',
      size: 28,
      weight: 400,
      color: '#cbd5e1'
    },
    body: {
      family: 'Work Sans',
      size: 20,
      weight: 400,
      color: '#f8fafc'
    },
    caption: {
      family: 'Work Sans',
      size: 16,
      weight: 400,
      color: '#94a3b8'
    }
  },

  spacing: {
    slideMargin: 0.5,
    titleTop: 0.75,
    contentTop: 1.5,
    bulletIndent: 0.5,
    lineSpacing: 1.5
  },

  branding: {
    logo: {
      show: false,
      url: '',
      position: 'top-right',
      width: 1.5
    },
    footer: {
      show: false,
      text: '',
      fontSize: 14
    }
  }
});

/**
 * Minimal/Clean theme
 */
export const MINIMAL_THEME = Object.freeze({
  aspectRatio: '16:9',

  colors: {
    primary: '#18181b',      // Almost black
    secondary: '#52525b',    // Gray
    accent: '#3b82f6',       // Blue accent
    text: '#18181b',         // Almost black
    textSecondary: '#71717a', // Gray
    background: '#ffffff',   // White
    surface: '#fafafa'       // Off-white
  },

  fonts: {
    title: {
      family: 'Work Sans',
      size: 48,
      weight: 600,
      color: '#18181b'
    },
    subtitle: {
      family: 'Work Sans',
      size: 24,
      weight: 300,
      color: '#71717a'
    },
    body: {
      family: 'Work Sans',
      size: 20,
      weight: 300,
      color: '#18181b'
    },
    caption: {
      family: 'Work Sans',
      size: 14,
      weight: 300,
      color: '#a1a1aa'
    }
  },

  spacing: {
    slideMargin: 1.0,
    titleTop: 1.0,
    contentTop: 2.0,
    bulletIndent: 0.3,
    lineSpacing: 1.6
  },

  branding: {
    logo: {
      show: false,
      url: '',
      position: 'top-right',
      width: 1.5
    },
    footer: {
      show: false,
      text: '',
      fontSize: 14
    }
  }
});

/**
 * Available theme presets
 */
export const THEME_PRESETS = Object.freeze({
  default: DEFAULT_THEME,
  professional: PROFESSIONAL_THEME,
  dark: DARK_THEME,
  minimal: MINIMAL_THEME
});

/**
 * Presentation configuration constants
 */
export const CONFIG = Object.freeze({
  // Aspect ratios
  ASPECT_RATIOS: {
    '16:9': { width: 10, height: 5.625 },    // Standard widescreen
    '4:3': { width: 10, height: 7.5 },       // Classic
    '16:10': { width: 10, height: 6.25 }     // Widescreen alternative
  },

  // Supported slide types (Phase 1)
  SLIDE_TYPES: {
    PHASE_1: ['title', 'bullets', 'two-column'],
    PHASE_2: ['image', 'section', 'quote', 'table', 'comparison'],
    ALL: ['title', 'bullets', 'two-column', 'image', 'section', 'quote', 'table', 'comparison']
  },

  // Export formats
  EXPORT_FORMATS: {
    PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    PDF: 'application/pdf',
    PNG: 'image/png'
  },

  // Validation rules
  VALIDATION: {
    MAX_SLIDES: 100,
    MAX_BULLETS_PER_SLIDE: 10,
    MAX_TITLE_LENGTH: 200,
    MAX_BULLET_LENGTH: 500
  },

  // Default metadata
  DEFAULT_METADATA: {
    title: 'AI Roadmap Presentation',
    author: 'AI Roadmap Generator',
    company: '',
    date: new Date().toLocaleDateString(),
    version: '1.0',
    slideCount: 0
  }
});

/**
 * Get theme by name
 * @param {string} themeName - Theme name (default, professional, dark, minimal)
 * @returns {Object} - Theme configuration
 */
export function getTheme(themeName = 'default') {
  const theme = THEME_PRESETS[themeName];
  if (!theme) {
    console.warn(`[Config] Theme '${themeName}' not found. Using default.`);
    return { ...DEFAULT_THEME };
  }
  return { ...theme };
}

/**
 * Merge custom theme with base theme
 * @param {Object} baseTheme - Base theme
 * @param {Object} customizations - Custom theme properties
 * @returns {Object} - Merged theme
 */
export function mergeTheme(baseTheme, customizations) {
  return {
    ...baseTheme,
    colors: { ...baseTheme.colors, ...(customizations.colors || {}) },
    fonts: {
      title: { ...baseTheme.fonts.title, ...(customizations.fonts?.title || {}) },
      subtitle: { ...baseTheme.fonts.subtitle, ...(customizations.fonts?.subtitle || {}) },
      body: { ...baseTheme.fonts.body, ...(customizations.fonts?.body || {}) },
      caption: { ...baseTheme.fonts.caption, ...(customizations.fonts?.caption || {}) }
    },
    spacing: { ...baseTheme.spacing, ...(customizations.spacing || {}) },
    branding: {
      logo: { ...baseTheme.branding.logo, ...(customizations.branding?.logo || {}) },
      footer: { ...baseTheme.branding.footer, ...(customizations.branding?.footer || {}) }
    }
  };
}

/**
 * Create custom theme from scratch
 * @param {Object} customizations - Custom theme properties
 * @returns {Object} - Custom theme based on defaults
 */
export function createCustomTheme(customizations) {
  return mergeTheme(DEFAULT_THEME, customizations);
}

/**
 * Get slide dimensions for aspect ratio
 * @param {string} aspectRatio - Aspect ratio (16:9, 4:3, 16:10)
 * @returns {Object} - Width and height in inches
 */
export function getSlideDimensions(aspectRatio = '16:9') {
  const dimensions = CONFIG.ASPECT_RATIOS[aspectRatio];
  if (!dimensions) {
    console.warn(`[Config] Aspect ratio '${aspectRatio}' not found. Using 16:9.`);
    return CONFIG.ASPECT_RATIOS['16:9'];
  }
  return dimensions;
}

/**
 * Validate theme configuration
 * @param {Object} theme - Theme to validate
 * @returns {Object} - Validation result { valid: boolean, errors: string[] }
 */
export function validateTheme(theme) {
  const errors = [];

  // Check required sections
  if (!theme.colors) errors.push('Missing colors configuration');
  if (!theme.fonts) errors.push('Missing fonts configuration');
  if (!theme.spacing) errors.push('Missing spacing configuration');
  if (!theme.branding) errors.push('Missing branding configuration');

  // Check required colors
  const requiredColors = ['primary', 'secondary', 'text', 'background'];
  requiredColors.forEach(color => {
    if (!theme.colors?.[color]) {
      errors.push(`Missing required color: ${color}`);
    }
  });

  // Check required fonts
  const requiredFonts = ['title', 'body'];
  requiredFonts.forEach(font => {
    if (!theme.fonts?.[font]) {
      errors.push(`Missing required font: ${font}`);
    }
  });

  // Check aspect ratio
  if (theme.aspectRatio && !CONFIG.ASPECT_RATIOS[theme.aspectRatio]) {
    errors.push(`Invalid aspect ratio: ${theme.aspectRatio}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get default metadata with current date
 * @param {Object} overrides - Metadata overrides
 * @returns {Object} - Complete metadata object
 */
export function getDefaultMetadata(overrides = {}) {
  return {
    ...CONFIG.DEFAULT_METADATA,
    date: new Date().toLocaleDateString(),
    ...overrides
  };
}

/**
 * Check if slide type is supported in current phase
 * @param {string} slideType - Slide type to check
 * @param {number} phase - Phase number (1 or 2)
 * @returns {boolean} - True if supported
 */
export function isSlideTypeSupported(slideType, phase = 1) {
  if (phase === 1) {
    return CONFIG.SLIDE_TYPES.PHASE_1.includes(slideType);
  } else if (phase === 2) {
    return CONFIG.SLIDE_TYPES.ALL.includes(slideType);
  }
  return false;
}

/**
 * Get list of supported slide types for current phase
 * @param {number} phase - Phase number (1 or 2)
 * @returns {Array} - Array of supported slide type names
 */
export function getSupportedSlideTypes(phase = 1) {
  if (phase === 1) {
    return [...CONFIG.SLIDE_TYPES.PHASE_1];
  } else if (phase === 2) {
    return [...CONFIG.SLIDE_TYPES.ALL];
  }
  return [];
}

/**
 * Create presentation configuration object
 * @param {Object} options - Configuration options
 * @returns {Object} - Complete presentation configuration
 */
export function createPresentationConfig(options = {}) {
  const {
    themeName = 'default',
    themeCustomizations = {},
    metadata = {},
    aspectRatio = '16:9'
  } = options;

  const baseTheme = getTheme(themeName);
  const theme = mergeTheme(baseTheme, themeCustomizations);
  theme.aspectRatio = aspectRatio;

  return {
    metadata: getDefaultMetadata(metadata),
    theme,
    slides: []
  };
}

export default {
  DEFAULT_THEME,
  PROFESSIONAL_THEME,
  DARK_THEME,
  MINIMAL_THEME,
  THEME_PRESETS,
  CONFIG,
  getTheme,
  mergeTheme,
  createCustomTheme,
  getSlideDimensions,
  validateTheme,
  getDefaultMetadata,
  isSlideTypeSupported,
  getSupportedSlideTypes,
  createPresentationConfig
};
