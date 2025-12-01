export class SlidesView {
  constructor(data) {
    this.data = data;
    this.currentSlideIndex = 0;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'slides-view';
    container.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #1a1a1a;
    `;

    // 16:9 Aspect Ratio Container
    const slideWrapper = document.createElement('div');
    slideWrapper.style.cssText = `
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    `;

    this.slideContainer = document.createElement('div');
    this.slideContainer.style.cssText = `
      width: 100%;
      max-width: 1200px;
      aspect-ratio: 16 / 9;
      background: white;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    slideWrapper.appendChild(this.slideContainer);
    container.appendChild(slideWrapper);
    this.renderControls(container);
    this.renderCurrentSlide();

    return container;
  }

  renderControls(container) {
    const controls = document.createElement('div');
    controls.style.cssText = `
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 30px;
      background: #2a2a2a;
    `;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.onclick = () => this.prevSlide();
    prevBtn.style.cssText = `
      padding: 10px 20px;
      cursor: pointer;
      background: #444;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
    `;

    this.counter = document.createElement('span');
    this.counter.style.cssText = `
      color: white;
      font-size: 16px;
      min-width: 80px;
      text-align: center;
    `;

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.onclick = () => this.nextSlide();
    nextBtn.style.cssText = `
      padding: 10px 20px;
      cursor: pointer;
      background: #444;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
    `;

    controls.appendChild(prevBtn);
    controls.appendChild(this.counter);
    controls.appendChild(nextBtn);
    
    container.appendChild(controls);
    this.updateCounter();
  }

  updateCounter() {
    if (this.counter && this.data.slides) {
      this.counter.textContent = `${this.currentSlideIndex + 1} / ${this.data.slides.length}`;
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
    
    this.slideContainer.innerHTML = '';
    const slide = this.data.slides[this.currentSlideIndex];
    
    // Minimal slide content - just display raw data
    const content = document.createElement('div');
    content.style.cssText = `
      padding: 40px;
      height: 100%;
      overflow: auto;
    `;

    content.innerHTML = `<pre>${JSON.stringify(slide, null, 2)}</pre>`;
    
    this.slideContainer.appendChild(content);
  }
}
