import { PPT_TEMPLATES } from '../../config/templates.js';

export class SlidesView {
  constructor(data) {
    console.log('SlidesViewV2 initialized with data:', data);
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
    this.slideContainer.style.position = 'relative';
    this.slideContainer.style.width = '1280px';
    this.slideContainer.style.height = '720px';
    this.slideContainer.style.backgroundColor = 'white';
    this.slideContainer.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    this.slideContainer.style.overflow = 'hidden'; // Clip content
    this.slideContainer.style.transformOrigin = 'center center';
    
    slideWrapper.appendChild(this.slideContainer);
    container.appendChild(slideWrapper);
    
    this.renderControls(container);
    this.renderCurrentSlide();
    
    // Setup scaling
    this.setupScaling();

    return container;
  }

  setupScaling() {
    // Debounce resize to avoid excessive updates
    let timeout;
    const handleResize = () => {
        if (!this.slideWrapper || !this.slideContainer) return;
        
        const wrapperRect = this.slideWrapper.getBoundingClientRect();
        const padding = 40; // 20px padding on each side
        const availableWidth = wrapperRect.width - padding;
        const availableHeight = wrapperRect.height - padding;
        
        if (availableWidth <= 0 || availableHeight <= 0) return;

        const scaleX = availableWidth / 1280;
        const scaleY = availableHeight / 720;
        
        // Fit containment
        const scale = Math.min(scaleX, scaleY);
        
        this.slideContainer.style.transform = `scale(${scale})`;
    };

    // Use ResizeObserver for robust size tracking
    const resizeObserver = new ResizeObserver(() => {
        window.requestAnimationFrame(handleResize);
    });
    
    // Start observing once mounted
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
    const layoutName = slideData.layout || 'content'; // Default to content
    const template = PPT_TEMPLATES[layoutName] || PPT_TEMPLATES['content'];
    
    if (!template) {
        this.slideContainer.textContent = 'Template not found';
        return;
    }

    // Render elements based on template
    template.elements.forEach(el => {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.left = el.style.left;
        div.style.top = el.style.top;
        div.style.width = el.style.width;
        div.style.minHeight = el.style.height; // Use as minimum height to allow expansion
        div.style.fontSize = el.style.fontSize;
        
        div.style.color = el.style.color;
        div.style.textAlign = el.style.textAlign;
        div.style.whiteSpace = 'pre-wrap'; // Preserve newlines
        div.style.lineHeight = '1.2'; // Ensure consistent line height
        div.style.wordWrap = 'break-word'; // Prevent horizontal overflow
        
        // Populate content
        let content = '';
        if (el.key === 'tagline') content = slideData.tagline || 'TAGLINE';
        else if (el.key === 'title') content = slideData.title || 'Title';
        else if (el.key === 'body') content = slideData.body || slideData.content || '';
        else if (el.key === 'intro') content = slideData.intro || '';
        else if (el.key.startsWith('number_')) {
            const index = parseInt(el.key.split('_')[1]) - 1;
            if (slideData.gridItems && slideData.gridItems[index]) {
                content = (index + 1).toString();
            }
        }
        else if (el.key.startsWith('item_title_')) {
            const index = parseInt(el.key.split('_')[2]) - 1;
            if (slideData.gridItems && slideData.gridItems[index]) {
                content = slideData.gridItems[index].title;
            }
        }
        else if (el.key.startsWith('item_desc_')) {
            const index = parseInt(el.key.split('_')[2]) - 1;
            if (slideData.gridItems && slideData.gridItems[index]) {
                content = slideData.gridItems[index].description;
            }
        }
        
        // Only append if we have content or it's a static element (like numbers if hardcoded)
        // But numbers are dynamic in my logic above.
        
        if (content) {
            div.textContent = content;
            this.slideContainer.appendChild(div);
        }
    });
  }
}
