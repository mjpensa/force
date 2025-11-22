/**
 * Custom Slide Templates Library
 *
 * Add your custom slide layouts here. Each template should include:
 * - name: Display name for the template
 * - description: What the template is for
 * - schema: Expected data structure
 * - validate: Validation function
 * - render: Rendering function that returns HTMLElement
 *
 * Usage:
 * 1. Define your template below
 * 2. Import in WebRenderer.js
 * 3. Add to SlideDataModel.js validators
 */

export const CUSTOM_SLIDE_TYPES = {
  /**
   * Statistics Grid Slide
   * 2-column layout with title/text on left, 2x3 numbered stats grid on right
   */
  'stats-grid': {
    name: 'Statistics Grid',
    description: '2-column layout with numbered statistics boxes',

    // Expected data structure
    schema: {
      title: { text: 'Main Title', style: {} },
      subtitle: { text: 'Eyebrow Text', style: {} },
      bodyText: { text: 'Optional description paragraph', style: {} },
      stats: [
        {
          number: '1',
          label: 'Stat Label',
          description: 'Stat description text'
        }
        // ... up to 6 stats
      ]
    },

    // Validation function
    validate: (content) => {
      const errors = [];
      if (!content.title?.text) {
        errors.push('Missing title.text');
      }
      if (!content.stats || !Array.isArray(content.stats)) {
        errors.push('Missing or invalid stats array');
      } else if (content.stats.length === 0) {
        errors.push('Stats array is empty');
      } else if (content.stats.length > 6) {
        errors.push('Too many stats (max 6)');
      }
      return errors;
    },

    // Render function - returns HTMLElement
    render: (slide, theme, slideNumber) => {
      const container = document.createElement('div');
      container.className = 'slide-container stats-grid-slide';
      container.style.cssText = `
        display: grid;
        grid-template-columns: 42% 58%;
        gap: 3rem;
        padding: 3rem 4rem;
        background: #ffffff;
        min-height: 720px;
        max-width: 1280px;
        margin: 0 auto;
        font-family: 'Inter', 'Work Sans', sans-serif;
        position: relative;
        box-sizing: border-box;
      `;

      // Decorative graphic (top right corner)
      const graphic = document.createElement('div');
      graphic.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        width: 150px;
        height: 150px;
        background: url('vertical-stripe.svg') no-repeat center;
        background-size: contain;
        opacity: 0.8;
      `;
      container.appendChild(graphic);

      // Left column - title and body text
      const leftCol = document.createElement('div');
      leftCol.className = 'left-column';
      leftCol.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding-right: 1rem;
      `;

      // Subtitle (eyebrow)
      if (slide.content.subtitle?.text) {
        const subtitle = document.createElement('h2');
        subtitle.textContent = slide.content.subtitle.text;
        subtitle.style.cssText = `
          color: ${theme?.colors?.primary || '#dc2626'};
          font-size: 0.875rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin: 0;
        `;
        leftCol.appendChild(subtitle);
      }

      // Main title
      if (slide.content.title?.text) {
        const title = document.createElement('h1');
        title.textContent = slide.content.title.text;
        title.style.cssText = `
          font-size: 3rem;
          font-weight: 200;
          line-height: 1.2;
          color: #334155;
          margin: 0;
        `;
        leftCol.appendChild(title);
      }

      // Body text (optional)
      if (slide.content.bodyText?.text) {
        const bodyText = document.createElement('div');
        bodyText.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        `;

        // Split by paragraphs if newlines exist
        const paragraphs = slide.content.bodyText.text.split('\n\n');
        paragraphs.forEach(para => {
          if (para.trim()) {
            const p = document.createElement('p');
            p.textContent = para.trim();
            p.style.cssText = `
              color: #475569;
              font-size: 0.875rem;
              line-height: 1.6;
              margin: 0;
            `;
            bodyText.appendChild(p);
          }
        });

        leftCol.appendChild(bodyText);
      }

      container.appendChild(leftCol);

      // Right column - stats grid
      const rightCol = document.createElement('div');
      rightCol.className = 'right-column';
      rightCol.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.5rem 2.5rem;
        align-content: start;
      `;

      // Create stat boxes
      const stats = slide.content.stats || [];
      stats.slice(0, 6).forEach((stat, idx) => {
        const statBox = document.createElement('div');
        statBox.className = 'stat-box';

        // Number badge
        const badge = document.createElement('div');
        badge.textContent = stat.number || (idx + 1).toString();
        badge.style.cssText = `
          background: ${theme?.colors?.primary || '#dc2626'};
          color: white;
          font-weight: 700;
          padding: 0.125rem 0.5rem;
          display: inline-block;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
        `;
        statBox.appendChild(badge);

        // Stat label
        if (stat.label) {
          const label = document.createElement('h3');
          label.textContent = stat.label;
          label.style.cssText = `
            font-weight: 700;
            color: #334155;
            margin: 0 0 0.25rem 0;
            font-size: 0.875rem;
          `;
          statBox.appendChild(label);
        }

        // Stat description
        if (stat.description) {
          const desc = document.createElement('p');
          desc.textContent = stat.description;
          desc.style.cssText = `
            color: #475569;
            font-size: 0.75rem;
            line-height: 1.5;
            margin: 0;
          `;
          statBox.appendChild(desc);
        }

        rightCol.appendChild(statBox);
      });

      container.appendChild(rightCol);

      // Slide number (bottom right)
      const slideNum = document.createElement('div');
      slideNum.className = 'slide-number';
      slideNum.textContent = slideNumber.toString();
      slideNum.style.cssText = `
        position: absolute;
        bottom: 2rem;
        right: 3rem;
        font-size: 0.875rem;
        color: #94a3b8;
        font-weight: 500;
      `;
      container.appendChild(slideNum);

      return container;
    }
  },

  /**
   * Hero Image Slide
   * Full-bleed image with centered text overlay
   */
  'hero-image': {
    name: 'Hero Image',
    description: 'Full-screen image with centered text overlay',

    schema: {
      image: { src: '', alt: '' },
      title: { text: '', style: {} },
      subtitle: { text: '', style: {} }
    },

    validate: (content) => {
      const errors = [];
      if (!content.image?.src) {
        errors.push('Missing image.src');
      }
      if (!content.title?.text) {
        errors.push('Missing title.text');
      }
      return errors;
    },

    render: (slide, theme, slideNumber) => {
      const container = document.createElement('div');
      container.className = 'slide-container hero-image-slide';
      container.style.cssText = `
        position: relative;
        width: 100%;
        height: 720px;
        max-width: 1280px;
        margin: 0 auto;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000000;
      `;

      // Background image
      const bgImage = document.createElement('div');
      bgImage.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: url('${slide.content.image?.src || ''}');
        background-size: cover;
        background-position: center;
        opacity: 0.6;
      `;
      container.appendChild(bgImage);

      // Text overlay
      const textOverlay = document.createElement('div');
      textOverlay.style.cssText = `
        position: relative;
        z-index: 10;
        text-align: center;
        padding: 2rem;
        max-width: 800px;
      `;

      // Title
      if (slide.content.title?.text) {
        const title = document.createElement('h1');
        title.textContent = slide.content.title.text;
        title.style.cssText = `
          font-size: 4rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 1rem 0;
          text-shadow: 2px 2px 8px rgba(0,0,0,0.7);
          line-height: 1.2;
        `;
        textOverlay.appendChild(title);
      }

      // Subtitle
      if (slide.content.subtitle?.text) {
        const subtitle = document.createElement('p');
        subtitle.textContent = slide.content.subtitle.text;
        subtitle.style.cssText = `
          font-size: 1.5rem;
          font-weight: 300;
          color: #e2e8f0;
          margin: 0;
          text-shadow: 1px 1px 4px rgba(0,0,0,0.7);
        `;
        textOverlay.appendChild(subtitle);
      }

      container.appendChild(textOverlay);

      return container;
    }
  }
};

/**
 * Helper function to get all registered custom slide types
 * @returns {Array} Array of slide type names
 */
export function getCustomSlideTypes() {
  return Object.keys(CUSTOM_SLIDE_TYPES);
}

/**
 * Helper function to get template metadata
 * @param {string} type - Slide type name
 * @returns {Object|null} Template metadata or null
 */
export function getTemplateMetadata(type) {
  const template = CUSTOM_SLIDE_TYPES[type];
  if (!template) return null;

  return {
    name: template.name,
    description: template.description,
    schema: template.schema
  };
}
