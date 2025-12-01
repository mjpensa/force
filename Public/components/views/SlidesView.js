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
    font-family: 'Work Sans', sans-serif;
    box-sizing: border-box;
  `;

  // LEFT COLUMN: Tagline + Title (positioned absolutely for precise control)
  const leftCol = document.createElement('div');
  leftCol.style.cssText = `
    position: absolute;
    top: 5%;
    left: 5%;
    width: 38%;
  `;

  // Eyebrow (red, uppercase, Work Sans SemiBold 12pt)
  const tagline = document.createElement('div');
  tagline.style.cssText = `
    font-family: 'Work Sans', sans-serif;
    font-size: 12pt;
    font-weight: 600;
    color: #DA291C;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 10px;
  `;
  tagline.textContent = slide.tagline || '';
  leftCol.appendChild(tagline);

  // Title (Work Sans Thin 72pt)
  const title = document.createElement('div');
  title.style.cssText = `
    font-family: 'Work Sans', sans-serif;
    font-size: 72pt;
    font-weight: 100;
    line-height: 0.95;
    color: #0C2340;
  `;
  title.textContent = slide.title || '';
  leftCol.appendChild(title);

  el.appendChild(leftCol);

  // RIGHT COLUMN: Body content (Work Sans 12pt)
  const rightCol = document.createElement('div');
  rightCol.style.cssText = `
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: 5%;
    width: 43%;
    font-family: 'Work Sans', sans-serif;
    font-size: 12pt;
    font-weight: 400;
    line-height: 1.6;
    color: #0C2340;
  `;

  // Body text only
  const bodyText = slide.body || '';

  // Render as paragraphs
  const paragraphs = bodyText.split(/\n\n|\n/).filter(p => p.trim());
  rightCol.innerHTML = paragraphs.map(p => 
    `<p style="margin: 0 0 16px 0;">${p.trim()}</p>`
  ).join('');

  el.appendChild(rightCol);

  // FOOTER: Slide number only (bottom left)
  const footer = document.createElement('div');
  footer.style.cssText = `
    position: absolute;
    bottom: 4%;
    left: 5%;
    font-family: 'Work Sans', sans-serif;
    font-size: 12pt;
    font-weight: 400;
    color: #0C2340;
  `;
  footer.textContent = index + 1;
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
