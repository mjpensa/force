/**
 * BIP Slide Templates - COMPLETE REWRITE
 * Direct 1:1 translation of original HTML templates to JavaScript
 */

export const CUSTOM_SLIDE_TYPES = {
  /**
   * BIP Three-Column Layout (bip-slide-2.html)
   * Exact replica of original HTML structure
   */
  'bip-three-column': {
    schema: {
      eyebrow: { type: 'object', properties: { text: { type: 'string' } } },
      title: { type: 'string|object' },
      columns: { type: 'array', minItems: 3, maxItems: 3 }
    },

    validate: (slide) => {
      const errors = [];
      if (!slide.content.columns || slide.content.columns.length !== 3) {
        errors.push('bip-three-column requires exactly 3 columns');
      }
      return errors;
    },

    render: (slide, theme, slideNumber) => {
      // <body class="bg-white p-12">
      // NOTE: Presentation viewer .slide-content already adds 3rem padding
      const body = document.createElement('div');
      body.style.cssText = `
        background-color: #ffffff;
        padding: 0;
        font-family: 'Inter', sans-serif;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        position: relative;
      `;

      // <div class="max-w-7xl mx-auto">
      const container = document.createElement('div');
      container.style.cssText = `
        max-width: 80rem;
        margin-left: auto;
        margin-right: auto;
      `;

      // Header: <div class="mb-8">
      const header = document.createElement('div');
      header.style.cssText = `margin-bottom: 2rem;`;

      // Eyebrow: <h2 class="text-red-600 font-bold text-sm tracking-wider mb-6">
      if (slide.content.eyebrow?.text) {
        const eyebrow = document.createElement('h2');
        eyebrow.textContent = slide.content.eyebrow.text;
        eyebrow.style.cssText = `
          color: #DC2626;
          font-weight: 700;
          font-size: 0.875rem;
          letter-spacing: 0.05em;
          margin-bottom: 1.5rem;
        `;
        header.appendChild(eyebrow);
      }

      // Title: <h1 class="text-5xl font-extralight text-slate-800 leading-tight">
      const titleText = typeof slide.content.title === 'string'
        ? slide.content.title
        : slide.content.title?.text;
      if (titleText) {
        const title = document.createElement('h1');
        const lines = titleText.split(/\\n|\n/);
        lines.forEach((line, idx) => {
          if (idx > 0) title.appendChild(document.createElement('br'));
          title.appendChild(document.createTextNode(line));
        });
        title.style.cssText = `
          font-family: 'Inter', sans-serif;
          font-size: 3rem;
          font-weight: 200;
          color: #1e293b;
          line-height: 1.25;
          letter-spacing: 0.05em;
          margin: 0;
        `;
        header.appendChild(title);
      }

      container.appendChild(header);

      // Three columns: <div class="grid grid-cols-3 gap-10 mt-16">
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 2.5rem;
        margin-top: 4rem;
      `;

      // Column divs: <div class="text-slate-700 text-sm leading-relaxed">
      const columns = slide.content.columns || [];
      columns.slice(0, 3).forEach((col) => {
        const columnDiv = document.createElement('div');
        columnDiv.style.cssText = `
          color: #475569;
          font-size: 0.875rem;
          line-height: 1.625;
        `;

        // Paragraphs: <p class="mb-4">
        const paragraphs = (col.text || '').split(/\n\n+/);
        paragraphs.forEach((para, idx) => {
          if (para.trim()) {
            const p = document.createElement('p');
            p.textContent = para.trim();
            p.style.cssText = idx < paragraphs.length - 1 ? 'margin-bottom: 1rem;' : 'margin: 0;';
            columnDiv.appendChild(p);
          }
        });

        grid.appendChild(columnDiv);
      });

      container.appendChild(grid);
      body.appendChild(container);

      return body;
    }
  },

  /**
   * BIP Single-Column Layout (bip-slide-4.html)
   * Exact replica of original HTML structure
   */
  'bip-single-column': {
    schema: {
      eyebrow: { type: 'object', properties: { text: { type: 'string' } } },
      title: { type: 'string|object' },
      bodyText: { type: 'object', properties: { text: { type: 'string' } } }
    },

    validate: (slide) => {
      const errors = [];
      if (!slide.content.bodyText || !slide.content.bodyText.text) {
        errors.push('bip-single-column requires bodyText field');
      }
      return errors;
    },

    render: (slide, theme, slideNumber) => {
      // <body class="bg-white p-12">
      // NOTE: Presentation viewer .slide-content already adds 3rem padding
      const body = document.createElement('div');
      body.style.cssText = `
        background-color: #ffffff;
        padding: 0;
        font-family: 'Inter', sans-serif;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        position: relative;
      `;

      // <div class="max-w-7xl mx-auto">
      const container = document.createElement('div');
      container.style.cssText = `
        max-width: 80rem;
        margin-left: auto;
        margin-right: auto;
      `;

      // Header with eyebrow ONLY: <div class="mb-8">
      const header = document.createElement('div');
      header.style.cssText = `margin-bottom: 2rem;`;

      // Eyebrow: <h2 class="text-red-600 font-bold text-sm tracking-wider mb-6">
      if (slide.content.eyebrow?.text) {
        const eyebrow = document.createElement('h2');
        eyebrow.textContent = slide.content.eyebrow.text;
        eyebrow.style.cssText = `
          color: #DC2626;
          font-weight: 700;
          font-size: 0.875rem;
          letter-spacing: 0.05em;
          margin-bottom: 1.5rem;
        `;
        header.appendChild(eyebrow);
      }

      container.appendChild(header);

      // Two-column grid: <div class="grid grid-cols-2 gap-20">
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 5rem;
      `;

      // Left column - Title ONLY: <div><h1 class="text-6xl font-extralight text-slate-800 leading-tight">
      const leftCol = document.createElement('div');
      const titleText = typeof slide.content.title === 'string'
        ? slide.content.title
        : slide.content.title?.text;
      if (titleText) {
        const title = document.createElement('h1');
        const lines = titleText.split(/\\n|\n/);
        lines.forEach((line, idx) => {
          if (idx > 0) title.appendChild(document.createElement('br'));
          title.appendChild(document.createTextNode(line));
        });
        title.style.cssText = `
          font-family: 'Inter', sans-serif;
          font-size: 3.75rem;
          font-weight: 200;
          color: #1e293b;
          line-height: 1.25;
          letter-spacing: 0.05em;
          margin: 0;
        `;
        leftCol.appendChild(title);
      }
      grid.appendChild(leftCol);

      // Right column - Body text: <div class="space-y-8 text-slate-700 text-base leading-relaxed">
      const rightCol = document.createElement('div');
      rightCol.style.cssText = `
        color: #475569;
        font-size: 1rem;
        line-height: 1.625;
      `;

      // Paragraphs with space-y-8 (2rem gap)
      if (slide.content.bodyText?.text) {
        const paragraphs = slide.content.bodyText.text.split(/\n\n+/);
        paragraphs.forEach((para, idx) => {
          if (para.trim()) {
            const p = document.createElement('p');
            p.textContent = para.trim();
            // space-y-8 means margin-top: 2rem on all but first child
            p.style.cssText = idx > 0 ? 'margin-top: 2rem;' : 'margin: 0;';
            rightCol.appendChild(p);
          }
        });
      }
      grid.appendChild(rightCol);

      container.appendChild(grid);
      body.appendChild(container);

      return body;
    }
  },

  /**
   * BIP Title Slide (gradient background)
   * Simple branded title slide - NOT from HTML templates
   */
  'bip-title-slide': {
    schema: {
      title: { type: 'string|object' },
      footerLeft: { type: 'object', properties: { text: { type: 'string' } } },
      footerRight: { type: 'object', properties: { text: { type: 'string' } } }
    },

    validate: (slide) => {
      const errors = [];
      if (!slide.content.title) {
        errors.push('bip-title-slide requires title field');
      }
      return errors;
    },

    render: (slide, theme, slideNumber) => {
      const container = document.createElement('div');
      container.style.cssText = `
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #002040 0%, #003060 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', sans-serif;
        box-sizing: border-box;
        position: relative;
      `;

      const mainContent = document.createElement('div');
      mainContent.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 4rem;
        box-sizing: border-box;
      `;

      // Title
      const titleText = typeof slide.content.title === 'string'
        ? slide.content.title
        : slide.content.title?.text;
      if (titleText) {
        const title = document.createElement('h1');
        const lines = titleText.split(/\\n|\n/);
        lines.forEach((line, idx) => {
          const span = document.createElement('span');
          span.textContent = line;
          span.style.display = 'block';
          title.appendChild(span);
        });
        title.style.cssText = `
          font-size: 5rem;
          font-weight: 200;
          line-height: 1.1;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0;
        `;
        mainContent.appendChild(title);
      }

      // Footer
      const footer = document.createElement('div');
      footer.style.cssText = `
        position: absolute;
        bottom: 3rem;
        left: 4rem;
        right: 4rem;
        display: flex;
        justify-content: space-between;
        font-size: 1.125rem;
        color: #ffffff;
      `;

      const footerLeft = document.createElement('div');
      footerLeft.textContent = slide.content.footerLeft?.text || 'Here to Dare.';
      footerLeft.style.cssText = 'font-weight: 600;';
      footer.appendChild(footerLeft);

      const footerRight = document.createElement('div');
      if (slide.content.footerRight?.text) {
        footerRight.textContent = slide.content.footerRight.text;
      } else {
        const now = new Date();
        footerRight.textContent = `${now.toLocaleString('default', { month: 'long' })} | ${now.getFullYear()}`;
      }
      footerRight.style.cssText = 'font-weight: 300;';
      footer.appendChild(footerRight);

      mainContent.appendChild(footer);
      container.appendChild(mainContent);

      return container;
    }
  }
};
