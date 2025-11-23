// COMPLETELY REWRITTEN to match original HTML templates EXACTLY

export const CUSTOM_SLIDE_TYPES = {
  'bip-three-column': {
    schema: {
      eyebrow: { type: 'object', properties: { text: { type: 'string' } } },
      title: { type: 'string|object' },
      columns: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' } } } },
      showCornerGraphic: { type: 'boolean' }
    },

    validate: (slide) => {
      return [];
    },

    render: (slide, theme, slideNumber) => {
      // Outer wrapper (simulates <body class="bg-white p-12">)
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `
        width: 100%;
        aspect-ratio: 16/9;
        max-width: 1280px;
        margin: 0 auto;
        background-color: #ffffff;
        padding: 3rem;
        box-sizing: border-box;
        font-family: 'Inter', sans-serif;
        position: relative;
      `;

      // Corner graphic (fixed top-right)
      if (slide.content.showCornerGraphic !== false) {
        const graphic = document.createElement('div');
        graphic.style.cssText = `
          position: absolute;
          top: 0;
          right: 0;
          width: 150px;
          height: 150px;
          overflow: hidden;
        `;
        graphic.innerHTML = `
          <img src="vertical-stripe.svg" alt="" style="width: 150px; height: auto;">
        `;
        wrapper.appendChild(graphic);
      }

      // Main container (simulates <div class="max-w-7xl mx-auto">)
      const container = document.createElement('div');
      container.style.cssText = `
        max-width: 80rem;
        margin: 0 auto;
      `;

      // Header section (simulates <div class="mb-8">)
      const header = document.createElement('div');
      header.style.cssText = `margin-bottom: 2rem;`;

      // Eyebrow (h2 class="text-red-600 font-bold text-sm tracking-wider mb-6")
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

      // Title (h1 class="text-5xl font-extralight text-slate-800 leading-tight")
      const titleText = typeof slide.content.title === 'string'
        ? slide.content.title
        : slide.content.title?.text;
      if (titleText) {
        const title = document.createElement('h1');
        const titleLines = titleText.split(/\\n|\n/);
        titleLines.forEach((line, idx) => {
          if (idx > 0) title.appendChild(document.createElement('br'));
          title.appendChild(document.createTextNode(line));
        });
        title.style.cssText = `
          font-size: 3rem;
          font-weight: 200;
          color: #1e293b;
          line-height: 1.25;
          margin: 0;
        `;
        header.appendChild(title);
      }

      container.appendChild(header);

      // Three columns grid (simulates <div class="grid grid-cols-3 gap-10 mt-16">)
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2.5rem;
        margin-top: 4rem;
      `;

      // Render 3 columns (div class="text-slate-700 text-sm leading-relaxed")
      const columns = slide.content.columns || [];
      columns.slice(0, 3).forEach((col) => {
        const columnDiv = document.createElement('div');
        columnDiv.style.cssText = `
          color: #475569;
          font-size: 0.875rem;
          line-height: 1.625;
        `;

        // Split into paragraphs
        const paragraphs = (col.text || '').split(/\n+/);
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
      wrapper.appendChild(container);

      return wrapper;
    }
  }
};
