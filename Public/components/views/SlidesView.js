/**
 * SlidesView - Single Template Only
 * ONE layout. No variations. No options. No branding.
 */

function renderSlide(slide, index) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%; height: 100%;
    background: #FFFFFF;
    position: relative;
    font-family: 'Segoe UI', Arial, sans-serif;
    box-sizing: border-box;
    padding: 40px 50px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto 1fr auto;
    gap: 0;
  `;

  // LEFT COLUMN: Tagline + Title
  const leftCol = document.createElement('div');
  leftCol.style.cssText = `
    grid-column: 1;
    grid-row: 1 / 3;
    display: flex;
    flex-direction: column;
    padding-right: 40px;
  `;

  // Tagline (red, uppercase, small)
  const tagline = document.createElement('div');
  tagline.style.cssText = `
    font-size: 11px;
    font-weight: 700;
    color: #DA291C;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 16px;
  `;
  tagline.textContent = slide.tagline || slide.section || '';
  leftCol.appendChild(tagline);

  // Title (large, thin weight, navy)
  const title = document.createElement('div');
  title.style.cssText = `
    font-family: 'Segoe UI Light', 'Helvetica Neue', Arial, sans-serif;
    font-size: clamp(32px, 4.5vw, 52px);
    font-weight: 200;
    line-height: 1.15;
    color: #0C2340;
  `;
  title.textContent = slide.title || '';
  leftCol.appendChild(title);

  el.appendChild(leftCol);

  // RIGHT COLUMN: Body content
  const rightCol = document.createElement('div');
  rightCol.style.cssText = `
    grid-column: 2;
    grid-row: 1 / 3;
    font-size: 14px;
    line-height: 1.75;
    color: #0C2340;
    display: flex;
    flex-direction: column;
    justify-content: center;
  `;

  // Gather all text content from any field
  let bodyText = slide.body || slide.subtitle || slide.intro || '';
  
  if (!bodyText && slide.content && Array.isArray(slide.content)) {
    bodyText = slide.content.map(item => 
      typeof item === 'string' ? item : (item.text || item.title || '')
    ).join('\n\n');
  }
  
  if (!bodyText && slide.gridItems && Array.isArray(slide.gridItems)) {
    bodyText = slide.gridItems.map(item => 
      `${item.title || ''}: ${item.description || item.text || ''}`
    ).join('\n\n');
  }

  // Render as paragraphs
  const paragraphs = bodyText.split(/\n\n|\n/).filter(p => p.trim());
  rightCol.innerHTML = paragraphs.map(p => 
    `<p style="margin: 0 0 18px 0;">${p.trim()}</p>`
  ).join('');

  el.appendChild(rightCol);

  // FOOTER: Slide number only (bottom left)
  const footer = document.createElement('div');
  footer.style.cssText = `
    grid-column: 1 / 3;
    grid-row: 3;
    display: flex;
    justify-content: flex-start;
    align-items: flex-end;
    padding-top: 20px;
  `;
  footer.innerHTML = `<span style="font-size: 11px; color: #0C2340;">${index + 1}</span>`;
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
