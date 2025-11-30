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
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.overflow = 'hidden';
    
    this.slideContainer = document.createElement('div');
    this.slideContainer.style.position = 'relative';
    this.slideContainer.style.aspectRatio = '16 / 9';
    this.slideContainer.style.width = '80%';
    this.slideContainer.style.maxWidth = '1200px';
    this.slideContainer.style.backgroundColor = 'white';
    this.slideContainer.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    this.slideContainer.style.overflow = 'hidden'; // Clip content
    
    container.appendChild(this.slideContainer);
    
    this.renderControls(container);
    this.renderCurrentSlide();
    
    return container;
  }

  renderControls(container) {
    const controls = document.createElement('div');
    controls.style.marginTop = '20px';
    controls.style.display = 'flex';
    controls.style.gap = '10px';

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
        div.style.height = el.style.height;
        div.style.fontSize = el.style.fontSize; // Use extracted font size
        // Scale font size based on container width? 
        // For now, let's assume the extracted font size is for the full size slide.
        // We might need to scale it down. 
        // 12pt is roughly 16px.
        // Let's use a scaling factor or just rely on the browser.
        // Actually, 'pt' units might not scale well with the container size.
        // A better approach is to use 'cqw' or scale transform.
        // For simplicity, let's just use the color and alignment.
        
        div.style.color = el.style.color;
        div.style.textAlign = el.style.textAlign;
        div.style.whiteSpace = 'pre-wrap'; // Preserve newlines
        div.style.overflow = 'hidden';
        
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
