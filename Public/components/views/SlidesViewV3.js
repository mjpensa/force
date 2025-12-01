export class SlidesView {
  constructor(data) {
    console.log('SlidesViewV3 initialized');
    this.data = data;
    this.currentSlideIndex = 0;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'slides-view';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = '#f5f5f5';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow = 'hidden';
    
    this.injectStyles();

    // Wrapper for the slide to handle scaling
    const slideWrapper = document.createElement('div');
    slideWrapper.style.flex = '1';
    slideWrapper.style.width = '100%';
    slideWrapper.style.display = 'flex';
    slideWrapper.style.justifyContent = 'center';
    slideWrapper.style.alignItems = 'center';
    slideWrapper.style.overflow = 'hidden';
    this.slideWrapper = slideWrapper;

    // The fixed-resolution slide container (1280x720 base)
    this.slideContainer = document.createElement('div');
    this.slideContainer.className = 'slide-container';
    // Scaling transform will be applied here
    
    slideWrapper.appendChild(this.slideContainer);
    container.appendChild(slideWrapper);
    
    this.renderControls(container);
    this.renderCurrentSlide();
    
    // Setup scaling
    this.setupScaling();

    return container;
  }

  injectStyles() {
    // Prevent duplicate styles
    if (document.getElementById('slides-v3-styles')) return;

    const style = document.createElement('style');
    style.id = 'slides-v3-styles';
    style.textContent = `
      .slide-container {
        width: 1280px;
        height: 720px;
        background: white;
        position: relative;
        overflow: hidden;
        padding: 80px; /* Generous padding */
        box-sizing: border-box;
        display: grid;
        font-family: "Helvetica Neue", "Segoe UI", "Roboto", Arial, sans-serif;
        color: #0C2340;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        transform-origin: center center;
      }
      
      .tagline {
        color: #DA291C;
        font-size: 18px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 20px;
        grid-area: tagline;
        align-self: start;
      }
      
      .slide-title {
        font-size: 64px;
        line-height: 1.1;
        font-weight: normal;
        grid-area: title;
        align-self: start;
      }
      
      .slide-body {
        font-size: 24px;
        line-height: 1.5;
        white-space: pre-wrap;
        grid-area: body;
        color: #333;
      }

      .slide-intro {
        font-size: 20px;
        line-height: 1.5;
        color: #555;
        grid-area: intro;
        margin-top: 20px;
      }

      /* --- LAYOUTS --- */

      /* Layout: Title (Split 50/50) */
      .layout-title {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: min-content 1fr;
        grid-template-areas: 
          "tagline ."
          "title body";
        column-gap: 80px;
        align-items: start;
      }
      .layout-title .slide-title { 
        font-size: 130px; 
        font-weight: 300;
        line-height: 0.85;
        letter-spacing: -4px;
        align-self: start;
        margin-top: 0;
      }
      .layout-title .tagline {
        grid-area: tagline;
        font-size: 16px;
        font-weight: bold;
        color: #DA291C;
        letter-spacing: 1px;
        margin-bottom: 40px;
      }
      .layout-title .slide-body {
        grid-area: body;
        align-self: center;
        font-size: 18px;
        line-height: 1.6;
        color: #333;
      }

      /* Footer Elements */
      .slide-footer-number {
        position: absolute;
        bottom: 40px;
        left: 80px;
        font-size: 14px;
        font-weight: bold;
        color: #555;
      }
      
      .slide-footer-logo {
        position: absolute;
        bottom: 40px;
        right: 80px;
        font-size: 24px;
        font-weight: 900;
        color: #DA291C;
        font-family: sans-serif;
        letter-spacing: -1px;
      }

      /* Layout: Content (Split 30/70) */
      .layout-content {
        grid-template-columns: 3.5fr 8.5fr; /* Approx 30/70 */
        grid-template-rows: auto 1fr;
        grid-template-areas: 
          "tagline tagline"
          "title body";
        column-gap: 60px;
      }
      .layout-content .slide-title { 
        font-size: 56px; 
        word-wrap: break-word;
      }

      /* Layout: Grid (Split 30/70 with sub-grid) */
      .layout-grid {
        grid-template-columns: 3.5fr 8.5fr;
        grid-template-rows: auto auto 1fr;
        grid-template-areas: 
          "tagline tagline"
          "title grid-container"
          "intro grid-container";
        column-gap: 60px;
      }
      .layout-grid .slide-title { font-size: 56px; }
      
      .grid-wrapper {
        grid-area: grid-container;
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: min-content;
        gap: 40px;
        align-content: start;
      }

      .grid-item {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .grid-number {
        font-size: 32px;
        font-weight: bold;
        color: #DA291C;
        border-bottom: 2px solid #eee;
        padding-bottom: 10px;
        margin-bottom: 10px;
      }

      .grid-item-title {
        font-size: 20px;
        font-weight: bold;
        color: #0C2340;
      }

      .grid-item-desc {
        font-size: 16px;
        line-height: 1.4;
        color: #555;
      }
    `;
    document.head.appendChild(style);
  }

  setupScaling() {
    let timeout;
    const handleResize = () => {
        if (!this.slideWrapper || !this.slideContainer) return;
        
        const wrapperRect = this.slideWrapper.getBoundingClientRect();
        const padding = 40;
        const availableWidth = wrapperRect.width - padding;
        const availableHeight = wrapperRect.height - padding;
        
        if (availableWidth <= 0 || availableHeight <= 0) return;

        const scaleX = availableWidth / 1280;
        const scaleY = availableHeight / 720;
        const scale = Math.min(scaleX, scaleY);
        
        this.slideContainer.style.transform = `scale(${scale})`;
    };

    const resizeObserver = new ResizeObserver(() => {
        window.requestAnimationFrame(handleResize);
    });
    
    setTimeout(() => {
        if (this.slideWrapper) {
            resizeObserver.observe(this.slideWrapper);
        }
    }, 0);
  }

  renderControls(container) {
    const controls = document.createElement('div');
    controls.style.padding = '20px';
    controls.style.display = 'flex';
    controls.style.justifyContent = 'center';
    controls.style.gap = '10px';
    controls.style.backgroundColor = '#fff';
    controls.style.borderTop = '1px solid #ddd';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Previous';
    prevBtn.onclick = () => this.prevSlide();
    
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.onclick = () => this.nextSlide();

    const counter = document.createElement('span');
    this.counter = counter;
    this.updateCounter();

    controls.appendChild(prevBtn);
    controls.appendChild(counter);
    controls.appendChild(nextBtn);
    container.appendChild(controls);
  }

  updateCounter() {
    if (this.counter && this.data.slides) {
        this.counter.textContent = ` ${this.currentSlideIndex + 1} / ${this.data.slides.length} `;
    }
  }

  prevSlide() {
    if (this.currentSlideIndex > 0) {
        this.currentSlideIndex--;
        this.renderCurrentSlide();
        this.updateCounter();
    }
  }

  nextSlide() {
    if (this.data.slides && this.currentSlideIndex < this.data.slides.length - 1) {
        this.currentSlideIndex++;
        this.renderCurrentSlide();
        this.updateCounter();
    }
  }

  renderCurrentSlide() {
    if (!this.slideContainer || !this.data.slides) return;
    
    this.slideContainer.innerHTML = ''; // Clear current slide
    
    const slideData = this.data.slides[this.currentSlideIndex];
    const layoutName = slideData.layout || 'content';
    
    // Reset classes
    this.slideContainer.className = 'slide-container';
    this.slideContainer.classList.add(`layout-${layoutName}`);

    // 1. Tagline
    const tagline = document.createElement('div');
    tagline.className = 'tagline';
    tagline.textContent = slideData.tagline || 'TAGLINE';
    this.slideContainer.appendChild(tagline);

    // 2. Title
    const title = document.createElement('div');
    title.className = 'slide-title';
    title.textContent = slideData.title || 'Slide Title';
    this.slideContainer.appendChild(title);

    // 3. Body (for Title/Content layouts)
    if (layoutName !== 'grid') {
        const body = document.createElement('div');
        body.className = 'slide-body';
        body.textContent = slideData.body || slideData.content || '';
        this.slideContainer.appendChild(body);
    }

    // 4. Intro (for Grid layout)
    if (layoutName === 'grid') {
        const intro = document.createElement('div');
        intro.className = 'slide-intro';
        intro.textContent = slideData.intro || slideData.body || '';
        this.slideContainer.appendChild(intro);

        // 5. Grid Items
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'grid-wrapper';
        
        const items = slideData.gridItems || [];
        items.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'grid-item';
            
            const num = document.createElement('div');
            num.className = 'grid-number';
            num.textContent = (index + 1).toString().padStart(2, '0');
            
            const t = document.createElement('div');
            t.className = 'grid-item-title';
            t.textContent = item.title || '';
            
            const d = document.createElement('div');
            d.className = 'grid-item-desc';
            d.textContent = item.description || '';
            
            itemDiv.appendChild(num);
            itemDiv.appendChild(t);
            itemDiv.appendChild(d);
            gridWrapper.appendChild(itemDiv);
        });
        
        this.slideContainer.appendChild(gridWrapper);
    }

    // 6. Footer
    const pageNum = document.createElement('div');
    pageNum.className = 'slide-footer-number';
    pageNum.textContent = (this.currentSlideIndex + 1).toString();
    this.slideContainer.appendChild(pageNum);

    const logo = document.createElement('div');
    logo.className = 'slide-footer-logo';
    logo.textContent = 'bip.';
    this.slideContainer.appendChild(logo);
  }
}
