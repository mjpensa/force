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
   * BIP Three-Column Layout (from Slide 1)
   * Eyebrow + Title + 3 text columns with corner graphic
   */
  'bip-three-column': {
    name: 'BIP Three-Column Layout',
    description: 'Eyebrow, title, and three text columns with geometric corner graphic',

    schema: {
      eyebrow: { text: 'LOREM IPSUM', style: {} },
      title: { text: 'Lorem ipsum sit amet sit lorem', style: {} },
      columns: [
        { text: 'Column 1 text...' },
        { text: 'Column 2 text...' },
        { text: 'Column 3 text...' }
      ],
      showCornerGraphic: true
    },

    validate: (content) => {
      const errors = [];
      if (!content.title?.text) {
        errors.push('Missing title.text');
      }
      if (!content.columns || !Array.isArray(content.columns)) {
        errors.push('Missing or invalid columns array');
      } else if (content.columns.length !== 3) {
        errors.push('Must have exactly 3 columns');
      }
      return errors;
    },

    render: (slide, theme, slideNumber) => {
      const container = document.createElement('div');
      container.className = 'slide-container bip-three-column-slide';
      container.style.cssText = `
        position: relative;
        width: 1478px;
        height: 835px;
        background-color: #ffffff;
        border: 1px solid #d4d4d4;
        overflow: hidden;
        font-family: 'Work Sans', sans-serif;
        box-sizing: border-box;
      `;

      // Corner graphic (top-right)
      if (slide.content.showCornerGraphic !== false) {
        const cornerGraphic = document.createElement('div');
        cornerGraphic.style.cssText = `
          position: absolute;
          top: 0;
          right: 0;
          width: 377px;
          height: 299px;
        `;
        cornerGraphic.innerHTML = `
          <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" style="display: block; width: 100%; height: 100%;">
            <rect x="0" y="0" width="50" height="40" fill="#002040" />
            <rect x="50" y="0" width="50" height="40" fill="#d02010" />
            <polygon points="0,40 50,0 50,40" fill="#90a0b0" />
            <polygon points="0,40 100,40 50,80" fill="#002040" />
            <polygon points="50,80 100,40 100,80" fill="#506070" />
          </svg>
        `;
        container.appendChild(cornerGraphic);
      }

      // Eyebrow
      if (slide.content.eyebrow?.text) {
        const eyebrow = document.createElement('div');
        eyebrow.textContent = slide.content.eyebrow.text;
        eyebrow.style.cssText = `
          position: absolute;
          left: 40px;
          top: 40px;
          font-size: 12pt;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${theme?.colors?.primary || '#d02010'};
          font-weight: 600;
        `;
        container.appendChild(eyebrow);
      }

      // Main title
      if (slide.content.title?.text) {
        const title = document.createElement('div');
        title.textContent = slide.content.title.text;
        title.style.cssText = `
          position: absolute;
          left: 40px;
          top: 72px;
          width: 276px;
          font-size: 44pt;
          line-height: 1;
          color: #002040;
          font-weight: 300;
          letter-spacing: -0.02em;
        `;
        container.appendChild(title);
      }

      // Three columns
      const columns = slide.content.columns || [];
      const columnPositions = [
        { left: '396px', width: '276px' },
        { left: '752px', width: '276px' },
        { left: '1108px', width: '276px' }
      ];

      columns.slice(0, 3).forEach((col, idx) => {
        const columnDiv = document.createElement('div');
        columnDiv.style.cssText = `
          position: absolute;
          top: 384px;
          left: ${columnPositions[idx].left};
          width: ${columnPositions[idx].width};
          font-size: 12pt;
          line-height: 1.5;
          color: #333333;
          text-align: justify;
          letter-spacing: -0.2px;
        `;

        // Split by paragraphs
        const paragraphs = (col.text || '').split(/\n+/);
        paragraphs.forEach(para => {
          if (para.trim()) {
            const p = document.createElement('p');
            p.textContent = para.trim();
            p.style.cssText = 'margin: 0 0 24px 0;';
            columnDiv.appendChild(p);
          }
        });

        container.appendChild(columnDiv);
      });

      return container;
    }
  },

  /**
   * BIP Single-Column Layout (from Slide 2)
   * Eyebrow + Large Title + Single wide text column
   */
  'bip-single-column': {
    name: 'BIP Single-Column Layout',
    description: 'Eyebrow, large title, and single wide text column',

    schema: {
      eyebrow: { text: 'LOREM IPSUM', style: {} },
      title: { text: 'Lorem\nipsum sit\namet sit\nlorem', style: {} },
      bodyText: { text: 'Body text content...', style: {} }
    },

    validate: (content) => {
      const errors = [];
      if (!content.title?.text) {
        errors.push('Missing title.text');
      }
      if (!content.bodyText?.text) {
        errors.push('Missing bodyText.text');
      }
      return errors;
    },

    render: (slide, theme, slideNumber) => {
      const container = document.createElement('div');
      container.className = 'slide-container bip-single-column-slide';
      container.style.cssText = `
        position: relative;
        width: 1478px;
        height: 835px;
        background-color: white;
        overflow: hidden;
        font-family: 'Work Sans', sans-serif;
        box-sizing: border-box;
      `;

      // Eyebrow
      if (slide.content.eyebrow?.text) {
        const eyebrow = document.createElement('div');
        eyebrow.textContent = slide.content.eyebrow.text;
        eyebrow.style.cssText = `
          position: absolute;
          top: 40px;
          left: 40px;
          width: 276px;
          font-weight: 600;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: ${theme?.colors?.primary || '#d02010'};
          line-height: 1;
        `;
        container.appendChild(eyebrow);
      }

      // Main Title (large, thin font)
      if (slide.content.title?.text) {
        const title = document.createElement('h1');
        // Preserve line breaks in title
        const titleLines = slide.content.title.text.split('\n');
        titleLines.forEach((line, idx) => {
          if (idx > 0) title.appendChild(document.createElement('br'));
          title.appendChild(document.createTextNode(line));
        });

        title.style.cssText = `
          position: absolute;
          top: 72px;
          left: 40px;
          width: 632px;
          font-weight: 100;
          font-size: 96px;
          line-height: 0.9;
          letter-spacing: -0.02em;
          color: #002040;
          margin: 0;
        `;
        container.appendChild(title);
      }

      // Body text column (wide)
      if (slide.content.bodyText?.text) {
        const bodyColumn = document.createElement('div');
        bodyColumn.style.cssText = `
          position: absolute;
          top: 456px;
          left: 752px;
          width: 632px;
          font-weight: 400;
          font-size: 16px;
          line-height: 24px;
          letter-spacing: -0.2px;
          color: #333333;
          text-align: justify;
        `;

        // Split by paragraphs
        const paragraphs = slide.content.bodyText.text.split(/\n\n+/);
        paragraphs.forEach(para => {
          if (para.trim()) {
            const p = document.createElement('p');
            p.textContent = para.trim();
            p.style.cssText = 'margin-bottom: 24px;';
            bodyColumn.appendChild(p);
          }
        });

        container.appendChild(bodyColumn);
      }

      return container;
    }
  },


  /**
   * BIP Title Slide (from Slide 3)
   * Large centered title with footer
   */
  'bip-title-slide': {
    name: 'BIP Title Slide',
    description: 'Large centered title with branded footer',

    schema: {
      title: { text: 'Title of the\nPresentation', style: {} },
      footerLeft: { text: 'Here to Dare.', style: {} },
      footerRight: { text: 'Month | Year', style: {} }
    },

    validate: (content) => {
      const errors = [];
      if (!content.title?.text) {
        errors.push('Missing title.text');
      }
      return errors;
    },

    render: (slide, theme, slideNumber) => {
      const container = document.createElement('div');
      container.className = 'slide-container bip-title-slide';
      container.style.cssText = `
        position: relative;
        width: 1478px;
        height: 835px;
        background: linear-gradient(135deg, #002040 0%, #003060 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        font-family: 'Work Sans', sans-serif;
        box-sizing: border-box;
      `;

      // Main content wrapper
      const mainContent = document.createElement('div');
      mainContent.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 80px;
      `;

      // Title
      if (slide.content.title?.text) {
        const title = document.createElement('h1');

        // Split title into lines
        const titleLines = slide.content.title.text.split('\n');
        titleLines.forEach((line, idx) => {
          const span = document.createElement('span');
          span.textContent = line;
          span.style.display = 'block';
          title.appendChild(span);
        });

        title.style.cssText = `
          font-size: 120px;
          font-weight: 100;
          line-height: 1.1;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0;
          text-align: left;
        `;
        mainContent.appendChild(title);
      }

      // Footer
      const footer = document.createElement('div');
      footer.style.cssText = `
        position: absolute;
        bottom: 40px;
        left: 80px;
        right: 80px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 18px;
        color: #ffffff;
        font-weight: 400;
      `;

      // Footer left (tagline)
      const footerLeft = document.createElement('div');
      footerLeft.textContent = slide.content.footerLeft?.text || 'Here to Dare.';
      footerLeft.style.cssText = 'font-weight: 600; letter-spacing: 0.02em;';
      footer.appendChild(footerLeft);

      // Footer right (date)
      const footerRight = document.createElement('div');
      if (slide.content.footerRight?.text) {
        footerRight.textContent = slide.content.footerRight.text;
      } else {
        // Auto-generate current month/year if not provided
        const now = new Date();
        const month = now.toLocaleString('default', { month: 'long' });
        const year = now.getFullYear();
        footerRight.textContent = `${month} | ${year}`;
      }
      footerRight.style.cssText = 'font-weight: 300;';
      footer.appendChild(footerRight);

      mainContent.appendChild(footer);
      container.appendChild(mainContent);

      return container;
    }
  },
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
