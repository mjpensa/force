/**
 * BIP Slide Templates - Template Population Approach
 * Uses actual HTML template structure from bip-slide-2.html and bip-slide-4.html
 * Populates templates with dynamic content instead of building from scratch
 */

export const CUSTOM_SLIDE_TYPES = {
  /**
   * BIP Three-Column Layout (bip-slide-2.html)
   * Template population approach - uses exact HTML structure
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
      console.log('[BIP Three-Column] Using template population approach v2');

      // Create container using EXACT template structure from bip-slide-2.html
      const template = `
        <div style="font-family: 'Inter', sans-serif; width: 100%; height: 100%; background: white;" data-template-version="v2">
          <div class="max-w-7xl mx-auto">
            <!-- Header -->
            <div class="mb-8">
              <h2 class="text-red-600 font-bold text-sm tracking-wider mb-6" data-placeholder="eyebrow">EYEBROW</h2>
              <h1 class="text-5xl font-extralight text-slate-800 leading-tight" data-placeholder="title">
                Title
              </h1>
            </div>

            <!-- Three Column Layout -->
            <div class="grid grid-cols-3 gap-10 mt-16">
              <!-- Column 1 -->
              <div class="text-slate-700 text-sm leading-relaxed" data-placeholder="column1">
                <p>Column 1</p>
              </div>

              <!-- Column 2 -->
              <div class="text-slate-700 text-sm leading-relaxed" data-placeholder="column2">
                <p>Column 2</p>
              </div>

              <!-- Column 3 -->
              <div class="text-slate-700 text-sm leading-relaxed" data-placeholder="column3">
                <p>Column 3</p>
              </div>
            </div>
          </div>
        </div>
      `;

      // Parse template as DOM
      const parser = new DOMParser();
      const doc = parser.parseFromString(template, 'text/html');
      const container = doc.body.firstElementChild;

      // Populate eyebrow
      const eyebrow = container.querySelector('[data-placeholder="eyebrow"]');
      if (slide.content.eyebrow?.text) {
        eyebrow.textContent = slide.content.eyebrow.text;
      } else {
        eyebrow.style.display = 'none';
      }

      // Populate title
      const titleText = typeof slide.content.title === 'string'
        ? slide.content.title
        : slide.content.title?.text || 'Title';
      const title = container.querySelector('[data-placeholder="title"]');
      title.innerHTML = ''; // Clear placeholder
      const lines = titleText.split(/\\n|\n/);
      lines.forEach((line, idx) => {
        if (idx > 0) title.appendChild(document.createElement('br'));
        title.appendChild(document.createTextNode(line));
      });

      // Populate columns
      const columns = slide.content.columns || [];
      for (let i = 0; i < 3; i++) {
        const columnDiv = container.querySelector(`[data-placeholder="column${i + 1}"]`);
        columnDiv.innerHTML = ''; // Clear placeholder

        if (columns[i]?.text) {
          const paragraphs = columns[i].text.split(/\n\n+/);
          paragraphs.forEach((para, idx) => {
            if (para.trim()) {
              const p = document.createElement('p');
              p.textContent = para.trim();
              if (idx < paragraphs.length - 1) {
                p.className = 'mb-4';
              }
              columnDiv.appendChild(p);
            }
          });
        } else {
          const p = document.createElement('p');
          p.textContent = 'Column ' + (i + 1);
          columnDiv.appendChild(p);
        }
      }

      return container;
    }
  },

  /**
   * BIP Single-Column Layout (bip-slide-4.html)
   * Template population approach - uses exact HTML structure
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
      console.log('[BIP Single-Column] Using template population approach v2');

      // Create container using EXACT template structure from bip-slide-4.html
      const template = `
        <div style="font-family: 'Inter', sans-serif; width: 100%; height: 100%; background: white;" data-template-version="v2">
          <div class="max-w-7xl mx-auto">
            <!-- Header -->
            <div class="mb-8">
              <h2 class="text-red-600 font-bold text-sm tracking-wider mb-6" data-placeholder="eyebrow">EYEBROW</h2>
            </div>

            <!-- Content Grid -->
            <div class="grid grid-cols-2 gap-20">
              <!-- Left Column - Title -->
              <div>
                <h1 class="text-6xl font-extralight text-slate-800 leading-tight" data-placeholder="title">
                  Title
                </h1>
              </div>

              <!-- Right Column - Body Text -->
              <div class="space-y-8 text-slate-700 text-base leading-relaxed" data-placeholder="body">
                <p>Body text</p>
              </div>
            </div>
          </div>
        </div>
      `;

      // Parse template as DOM
      const parser = new DOMParser();
      const doc = parser.parseFromString(template, 'text/html');
      const container = doc.body.firstElementChild;

      // Populate eyebrow
      const eyebrow = container.querySelector('[data-placeholder="eyebrow"]');
      if (slide.content.eyebrow?.text) {
        eyebrow.textContent = slide.content.eyebrow.text;
      } else {
        eyebrow.style.display = 'none';
      }

      // Populate title
      const titleText = typeof slide.content.title === 'string'
        ? slide.content.title
        : slide.content.title?.text || 'Title';
      const title = container.querySelector('[data-placeholder="title"]');
      title.innerHTML = ''; // Clear placeholder
      const lines = titleText.split(/\\n|\n/);
      lines.forEach((line, idx) => {
        if (idx > 0) title.appendChild(document.createElement('br'));
        title.appendChild(document.createTextNode(line));
      });

      // Populate body text
      const bodyDiv = container.querySelector('[data-placeholder="body"]');
      bodyDiv.innerHTML = ''; // Clear placeholder

      if (slide.content.bodyText?.text) {
        const paragraphs = slide.content.bodyText.text.split(/\n\n+/);
        paragraphs.forEach((para) => {
          if (para.trim()) {
            const p = document.createElement('p');
            p.textContent = para.trim();
            bodyDiv.appendChild(p);
          }
        });
      }

      return container;
    }
  },

  /**
   * BIP Title Slide (gradient background)
   * Kept as-is (not from HTML templates)
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
