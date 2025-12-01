/**
 * SlidesView - Minimal presentation viewer
 * Preserves: 16:9 aspect ratio + navigation controls
 */
import { PPT_TEMPLATES } from '../../config/templates.js';

// Debug: verify templates loaded
console.log('PPT_TEMPLATES loaded:', PPT_TEMPLATES ? Object.keys(PPT_TEMPLATES) : 'FAILED');

export class SlidesView {
  constructor(data, options = {}) {
    this.slides = data?.slides || [];
    this.index = 0;
    this.slide = null;
    this.counter = null;
    this._keyHandler = null;
    
    // Customization hooks
    this.renderSlide = options.renderSlide || this._templateRenderSlide.bind(this);
    this.onSlideChange = options.onSlideChange || null;
  }

  render() {
    const container = document.createElement('div');
    Object.assign(container.style, {
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#1a1a1a'
    });

    // 16:9 slide area
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      flex: '1', display: 'flex',
      justifyContent: 'center', alignItems: 'center',
      padding: '20px'
    });

    this.slide = document.createElement('div');
    Object.assign(this.slide.style, {
      width: '100%', maxWidth: '1200px',
      aspectRatio: '16 / 9',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      position: 'relative'
    });
    wrapper.appendChild(this.slide);

    // Navigation controls
    const nav = document.createElement('div');
    Object.assign(nav.style, {
      padding: '16px', display: 'flex',
      justifyContent: 'center', alignItems: 'center',
      gap: '24px', background: '#2a2a2a'
    });

    const btn = (text, fn) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = fn;
      Object.assign(b.style, {
        padding: '10px 20px', cursor: 'pointer',
        background: '#444', color: 'white',
        border: 'none', borderRadius: '4px', fontSize: '14px'
      });
      return b;
    };

    this.counter = document.createElement('span');
    Object.assign(this.counter.style, { color: 'white', fontSize: '14px' });

    nav.append(btn('← Prev', () => this.go(-1)), this.counter, btn('Next →', () => this.go(1)));
    container.append(wrapper, nav);

    // Keyboard nav (with cleanup support)
    this._keyHandler = e => {
      if (e.key === 'ArrowLeft') this.go(-1);
      if (e.key === 'ArrowRight') this.go(1);
    };
    document.addEventListener('keydown', this._keyHandler);

    this._update();
    return container;
  }

  go(delta) {
    const next = this.index + delta;
    if (next >= 0 && next < this.slides.length) {
      this.index = next;
      this._update();
      this.onSlideChange?.(this.index, this.slides[this.index]);
    }
  }

  _update() {
    this.counter.textContent = this.slides.length ? `${this.index + 1} / ${this.slides.length}` : '—';
    this.slide.innerHTML = '';
    const content = this.renderSlide(this.slides[this.index], this.index);
    if (content) this.slide.appendChild(content);
  }

  _templateRenderSlide(slide, index) {
    if (!slide) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:40px;height:100%;display:flex;align-items:center;justify-content:center;background:white;color:#666;';
      div.textContent = 'No slide content';
      return div;
    }

    // Get template by slide.layout or slide.type, fallback to 'default'
    const templateKey = slide.layout || slide.type || 'default';
    const templateFn = PPT_TEMPLATES?.[templateKey] || PPT_TEMPLATES?.['default'];
    
    // Fallback if templates failed to load
    if (typeof templateFn !== 'function') {
      console.warn('Template not found:', templateKey, 'Available:', Object.keys(PPT_TEMPLATES || {}));
      const div = document.createElement('div');
      div.style.cssText = 'padding:40px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:white;';
      div.innerHTML = `<h1 style="margin:0;font-size:32px;color:#333">${slide.title || 'Untitled'}</h1>`;
      return div;
    }
    
    return templateFn(slide, index);
  }

  destroy() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }
}
