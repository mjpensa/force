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
   * Responsive 16:9 aspect ratio
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
        width: 100%;
        aspect-ratio: 16/9;
        max-width: 1200px;
        max-height: 90vh;
        margin: 0 auto;
        background-color: #ffffff;
        overflow: hidden;
        font-family: 'Inter', sans-serif;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      `;

      // Corner graphic (top-right) - scaled to container
      if (slide.content.showCornerGraphic !== false) {
        const cornerGraphic = document.createElement('div');
        cornerGraphic.style.cssText = `
          position: absolute;
          top: 0;
          right: 0;
          width: 25.5%;
          height: 35.8%;
          z-index: 1;
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

      // Content wrapper
      const contentWrapper = document.createElement('div');
      contentWrapper.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        padding: 2.7%;
        box-sizing: border-box;
        z-index: 2;
      `;

      // Eyebrow
      if (slide.content.eyebrow?.text) {
        const eyebrow = document.createElement('div');
        eyebrow.textContent = slide.content.eyebrow.text;
        eyebrow.style.cssText = `
          font-size: clamp(10px, 0.8vw, 14px);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${theme?.colors?.primary || '#DC2626'};
          font-weight: 700;
          margin-bottom: 1%;
        `;
        contentWrapper.appendChild(eyebrow);
      }

      // Main title (left column, narrow)
      const titleText = typeof slide.content.title === 'string'
        ? slide.content.title
        : slide.content.title?.text;
      if (titleText) {
        const title = document.createElement('div');
        title.textContent = titleText;
        title.style.cssText = `
          width: 18.7%;
          font-size: clamp(20px, 3vw, 48px);
          line-height: 1.2;
          color: #1e293b;
          font-weight: 200;
          letter-spacing: -0.02em;
          margin-bottom: 8%;
        `;
        contentWrapper.appendChild(title);
      }

      // Three columns container
      const columnsContainer = document.createElement('div');
      columnsContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 3.4%;
        margin-left: 26.8%;
        width: 73.2%;
      `;

      const columns = slide.content.columns || [];
      columns.slice(0, 3).forEach((col) => {
        const columnDiv = document.createElement('div');
        columnDiv.style.cssText = `
          font-size: clamp(10px, 0.85vw, 14px);
          line-height: 1.6;
          color: #475569;
          text-align: justify;
          letter-spacing: -0.01em;
        `;

        // Split by paragraphs
        const paragraphs = (col.text || '').split(/\n+/);
        paragraphs.forEach(para => {
          if (para.trim()) {
            const p = document.createElement('p');
            p.textContent = para.trim();
            p.style.cssText = 'margin: 0 0 1.5em 0;';
            columnDiv.appendChild(p);
          }
        });

        columnsContainer.appendChild(columnDiv);
      });

      contentWrapper.appendChild(columnsContainer);
      container.appendChild(contentWrapper);

      return container;
    }
  },

  /**
   * BIP Single-Column Layout (from Slide 2)
   * Eyebrow + Large Title + Single wide text column
   * Responsive 16:9 aspect ratio
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
        width: 100%;
        aspect-ratio: 16/9;
        max-width: 1200px;
        max-height: 90vh;
        margin: 0 auto;
        background-color: white;
        overflow: hidden;
        font-family: 'Inter', sans-serif;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      `;

      // Content wrapper
      const contentWrapper = document.createElement('div');
      contentWrapper.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        padding: 2.7%;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5%;
      `;

      // Left column (eyebrow + title)
      const leftColumn = document.createElement('div');
      leftColumn.style.cssText = `
        display: flex;
        flex-direction: column;
      `;

      // Eyebrow
      if (slide.content.eyebrow?.text) {
        const eyebrow = document.createElement('div');
        eyebrow.textContent = slide.content.eyebrow.text;
        eyebrow.style.cssText = `
          font-weight: 700;
          font-size: clamp(10px, 1vw, 14px);
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: ${theme?.colors?.primary || '#DC2626'};
          line-height: 1;
          margin-bottom: 2%;
        `;
        leftColumn.appendChild(eyebrow);
      }

      // Main Title (large, thin font)
      const titleText = typeof slide.content.title === 'string'
        ? slide.content.title
        : slide.content.title?.text;
      if (titleText) {
        const title = document.createElement('h1');
        // Preserve line breaks in title
        const titleLines = titleText.split('\n');
        titleLines.forEach((line, idx) => {
          if (idx > 0) title.appendChild(document.createElement('br'));
          title.appendChild(document.createTextNode(line));
        });

        title.style.cssText = `
          font-weight: 200;
          font-size: clamp(32px, 6.5vw, 96px);
          line-height: 0.9;
          letter-spacing: -0.02em;
          color: #1e293b;
          margin: 0;
        `;
        leftColumn.appendChild(title);
      }

      contentWrapper.appendChild(leftColumn);

      // Right column (body text) - positioned in lower half
      const rightColumn = document.createElement('div');
      rightColumn.style.cssText = `
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding-bottom: 8%;
      `;

      // Body text column (wide)
      if (slide.content.bodyText?.text) {
        const bodyColumn = document.createElement('div');
        bodyColumn.style.cssText = `
          font-weight: 400;
          font-size: clamp(10px, 1vw, 14px);
          line-height: 1.6;
          letter-spacing: -0.01em;
          color: #475569;
          text-align: justify;
        `;

        // Split by paragraphs
        const paragraphs = slide.content.bodyText.text.split(/\n\n+/);
        paragraphs.forEach(para => {
          if (para.trim()) {
            const p = document.createElement('p');
            p.textContent = para.trim();
            p.style.cssText = 'margin-bottom: 1.5em;';
            bodyColumn.appendChild(p);
          }
        });

        rightColumn.appendChild(bodyColumn);
      }

      contentWrapper.appendChild(rightColumn);
      container.appendChild(contentWrapper);

      return container;
    }
  },


  /**
   * BIP Title Slide (from Slide 3)
   * Large centered title with footer
   * Responsive 16:9 aspect ratio
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
        width: 100%;
        aspect-ratio: 16/9;
        max-width: 1200px;
        max-height: 90vh;
        margin: 0 auto;
        background: linear-gradient(135deg, #002040 0%, #003060 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        font-family: 'Inter', sans-serif;
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
        padding: 5.4%;
        box-sizing: border-box;
      `;

      // Title
      const titleText = typeof slide.content.title === 'string'
        ? slide.content.title
        : slide.content.title?.text;
      if (titleText) {
        const title = document.createElement('h1');

        // Split title into lines
        const titleLines = titleText.split('\n');
        titleLines.forEach((line, idx) => {
          const span = document.createElement('span');
          span.textContent = line;
          span.style.display = 'block';
          title.appendChild(span);
        });

        title.style.cssText = `
          font-size: clamp(40px, 8.1vw, 120px);
          font-weight: 200;
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
        bottom: 4.8%;
        left: 5.4%;
        right: 5.4%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: clamp(12px, 1.2vw, 18px);
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
