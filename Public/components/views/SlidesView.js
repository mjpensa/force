/**
 * SlidesView - SELF-CONTAINED Slide Viewer
 * Zero external dependencies. Everything inline.
 * This ensures no import errors can occur.
 */

// ============================================
// INLINE TEMPLATE RENDERER (no imports needed)
// ============================================
const COLORS = {
  navy: '#0C2340',
  red: '#DA291C',
  white: '#FFFFFF',
  gray: '#666666'
};

const FONTS = {
  title: "'Segoe UI Light', 'Helvetica Neue Light', Arial, sans-serif",
  body: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
};

function formatBody(text) {
  if (!text) return '';
  const lines = text.split('\n').filter(l => l.trim());
  const isBullets = lines.some(l => /^[\s•\-\*]/.test(l.trim()));
  
  if (isBullets) {
    const items = lines.map(l => l.replace(/^[\s•\-\*]+/, '').trim());
    return '<ul style="margin:0;padding-left:20px;">' + 
      items.map(i => `<li style="margin-bottom:8px;">${i}</li>`).join('') + 
      '</ul>';
  }
  return lines.map(l => `<p style="margin:0 0 10px 0;">${l}</p>`).join('');
}

function renderSlide(slide, index) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%; height: 100%;
    background: ${COLORS.white};
    position: relative;
    font-family: ${FONTS.body};
    box-sizing: border-box;
    padding: 40px;
    display: flex;
    flex-direction: column;
  `;

  // Tagline/section
  if (slide.tagline || slide.section) {
    const tagline = document.createElement('div');
    tagline.style.cssText = `
      font-size: 12px; font-weight: 700;
      color: ${COLORS.red}; letter-spacing: 1px;
      margin-bottom: 20px; text-transform: uppercase;
    `;
    tagline.textContent = slide.tagline || slide.section;
    el.appendChild(tagline);
  }

  // Title
  if (slide.title) {
    const title = document.createElement('h1');
    title.style.cssText = `
      font-family: ${FONTS.title};
      font-size: clamp(28px, 4vw, 48px);
      font-weight: 300; line-height: 1.2;
      color: ${COLORS.navy}; margin: 0 0 20px 0;
    `;
    title.textContent = slide.title;
    el.appendChild(title);
  }

  // Subtitle
  if (slide.subtitle) {
    const subtitle = document.createElement('p');
    subtitle.style.cssText = `font-size: 18px; color: ${COLORS.navy}; margin: 0 0 20px 0;`;
    subtitle.textContent = slide.subtitle;
    el.appendChild(subtitle);
  }

  // Intro
  if (slide.intro) {
    const intro = document.createElement('p');
    intro.style.cssText = `font-size: 14px; color: ${COLORS.navy}; margin: 0 0 25px 0; max-width: 80%;`;
    intro.textContent = slide.intro;
    el.appendChild(intro);
  }

  // Body text
  if (slide.body) {
    const body = document.createElement('div');
    body.style.cssText = `font-size: 14px; line-height: 1.7; color: ${COLORS.navy}; flex: 1;`;
    body.innerHTML = formatBody(slide.body);
    el.appendChild(body);
  }

  // Content array (bullet points)
  if (slide.content && Array.isArray(slide.content)) {
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `font-size: 14px; line-height: 1.7; color: ${COLORS.navy}; flex: 1;`;
    
    const ul = document.createElement('ul');
    ul.style.cssText = 'margin: 0; padding-left: 20px;';
    slide.content.forEach(item => {
      const li = document.createElement('li');
      li.style.cssText = 'margin-bottom: 10px;';
      li.textContent = typeof item === 'string' ? item : (item.text || item.title || JSON.stringify(item));
      ul.appendChild(li);
    });
    contentDiv.appendChild(ul);
    el.appendChild(contentDiv);
  }

  // Grid items
  if (slide.gridItems?.length > 0) {
    const grid = document.createElement('div');
    const cols = Math.min(slide.gridItems.length, 3);
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(${cols}, 1fr);
      gap: 20px; flex: 1; margin-top: 20px;
    `;
    
    slide.gridItems.slice(0, 6).forEach(item => {
      const card = document.createElement('div');
      card.style.cssText = `
        padding: 20px; background: #f8f9fa;
        border-radius: 4px; border-left: 3px solid ${COLORS.red};
      `;
      card.innerHTML = `
        <h3 style="font-size: 16px; font-weight: 600; color: ${COLORS.navy}; margin: 0 0 10px 0;">
          ${item.title || ''}
        </h3>
        <p style="font-size: 13px; color: ${COLORS.gray}; margin: 0; line-height: 1.5;">
          ${item.description || item.text || ''}
        </p>
      `;
      grid.appendChild(card);
    });
    el.appendChild(grid);
  }

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    position: absolute; bottom: 20px; left: 40px; right: 40px;
    display: flex; justify-content: space-between; align-items: center;
  `;
  footer.innerHTML = `
    <span style="font-size: 10px; color: ${COLORS.navy};">${index + 1}</span>
    <span style="font-size: 14px; font-weight: 700; color: ${COLORS.red};">bip.</span>
  `;
  el.appendChild(footer);

  return el;
}

// ============================================
// SLIDES VIEW CLASS
// ============================================
export class SlidesView {
  constructor(data) {
    if (!data?.slides?.length) {
      throw new Error('SlidesView requires data.slides array with at least one slide');
    }
    this.slides = data.slides;
    this.index = 0;
    this.slideEl = null;
    this.counter = null;
    this._keyHandler = null;
  }

  render() {
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      background: #1a1a1a;
    `;

    // Slide wrapper (centered, 16:9)
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      flex: 1; display: flex;
      justify-content: center; align-items: center;
      padding: 20px;
    `;

    this.slideEl = document.createElement('div');
    this.slideEl.style.cssText = `
      width: 100%; max-width: 1200px;
      aspect-ratio: 16 / 9;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      overflow: hidden; position: relative;
      background: white;
    `;
    wrapper.appendChild(this.slideEl);

    // Navigation bar
    const nav = document.createElement('div');
    nav.style.cssText = `
      padding: 16px; display: flex;
      justify-content: center; align-items: center;
      gap: 24px; background: #2a2a2a;
    `;

    const prevBtn = this._btn('← Prev', () => this.go(-1));
    const nextBtn = this._btn('Next →', () => this.go(1));
    
    this.counter = document.createElement('span');
    this.counter.style.cssText = 'color: white; font-size: 14px; min-width: 60px; text-align: center;';

    nav.appendChild(prevBtn);
    nav.appendChild(this.counter);
    nav.appendChild(nextBtn);
    
    container.appendChild(wrapper);
    container.appendChild(nav);

    // Keyboard navigation
    this._keyHandler = e => {
      if (e.key === 'ArrowLeft') this.go(-1);
      if (e.key === 'ArrowRight') this.go(1);
    };
    document.addEventListener('keydown', this._keyHandler);

    this._update();
    return container;
  }

  _btn(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.onclick = onClick;
    btn.style.cssText = `
      padding: 10px 20px; cursor: pointer;
      background: #444; color: white;
      border: none; border-radius: 4px; font-size: 14px;
    `;
    return btn;
  }

  go(delta) {
    const next = this.index + delta;
    if (next >= 0 && next < this.slides.length) {
      this.index = next;
      this._update();
    }
  }

  _update() {
    this.counter.textContent = `${this.index + 1} / ${this.slides.length}`;
    this.slideEl.innerHTML = '';
    const content = renderSlide(this.slides[this.index], this.index);
    this.slideEl.appendChild(content);
  }

  destroy() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }
}
