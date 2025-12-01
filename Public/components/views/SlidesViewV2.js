export class SlidesView {
  constructor(data) {
    this.data = data;
    this.currentSlideIndex = 0;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'slides-view';
    // Simple full-size container
    Object.assign(container.style, {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f0f0f0',
      fontFamily: 'Segoe UI, sans-serif'
    });

    // Slide display area
    this.slideContainer = document.createElement('div');
    Object.assign(this.slideContainer.style, {
      flex: '1',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px',
      overflow: 'auto'
    });
    
    container.appendChild(this.slideContainer);
    this.renderControls(container);
    this.renderCurrentSlide();

    return container;
  }

  renderControls(container) {
    const controls = document.createElement('div');
    Object.assign(controls.style, {
      padding: '15px',
      display: 'flex',
      justifyContent: 'center',
      gap: '20px',
      backgroundColor: 'white',
      borderTop: '1px solid #ccc'
    });

    const createBtn = (text, onClick) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.onclick = onClick;
      Object.assign(btn.style, {
        padding: '8px 16px',
        cursor: 'pointer',
        fontSize: '14px'
      });
      return btn;
    };

    controls.appendChild(createBtn('Previous', () => this.prevSlide()));
    
    this.counter = document.createElement('span');
    this.counter.style.alignSelf = 'center';
    controls.appendChild(this.counter);
    
    controls.appendChild(createBtn('Next', () => this.nextSlide()));
    
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
    
    // Card-like slide element
    const slideCard = document.createElement('div');
    Object.assign(slideCard.style, {
      backgroundColor: 'white',
      width: '100%',
      maxWidth: '1000px',
      minHeight: '600px',
      padding: '60px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    });

    // Tagline
    if (slide.tagline) {
      const tagline = document.createElement('div');
      tagline.textContent = slide.tagline.toUpperCase();
      Object.assign(tagline.style, {
        color: '#666',
        fontSize: '14px',
        fontWeight: 'bold',
        letterSpacing: '1px'
      });
      slideCard.appendChild(tagline);
    }

    // Title
    const title = document.createElement('h1');
    title.textContent = slide.title;
    Object.assign(title.style, {
      margin: '0 0 20px 0',
      color: '#333',
      fontSize: '36px'
    });
    slideCard.appendChild(title);

    // Body Content
    if (slide.body) {
      const body = document.createElement('div');
      body.textContent = slide.body;
      Object.assign(body.style, {
        fontSize: '18px',
        lineHeight: '1.6',
        color: '#444',
        whiteSpace: 'pre-wrap'
      });
      slideCard.appendChild(body);
    }

    // Intro (for grid layouts)
    if (slide.intro) {
      const intro = document.createElement('div');
      intro.textContent = slide.intro;
      Object.assign(intro.style, {
        fontSize: '18px',
        marginBottom: '20px',
        color: '#444'
      });
      slideCard.appendChild(intro);
    }

    // Grid Items
    if (slide.gridItems && Array.isArray(slide.gridItems)) {
      const grid = document.createElement('div');
      Object.assign(grid.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginTop: '20px'
      });

      slide.gridItems.forEach(item => {
        const itemDiv = document.createElement('div');
        Object.assign(itemDiv.style, {
          padding: '15px',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px'
        });

        const itemTitle = document.createElement('h3');
        itemTitle.textContent = item.title;
        itemTitle.style.margin = '0 0 10px 0';
        
        const itemDesc = document.createElement('p');
        itemDesc.textContent = item.description;
        itemDesc.style.margin = '0';
        itemDesc.style.color = '#555';

        itemDiv.appendChild(itemTitle);
        itemDiv.appendChild(itemDesc);
        grid.appendChild(itemDiv);
      });
      slideCard.appendChild(grid);
    }

    this.slideContainer.appendChild(slideCard);
  }
}
