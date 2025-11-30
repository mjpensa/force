export class SlidesView {
  constructor(data) {
    this.data = data;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'slides-view';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = '#f5f5f5';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.overflow = 'hidden';
    
    const slide = document.createElement('div');
    slide.className = 'slide-placeholder';
    slide.style.backgroundColor = 'white';
    slide.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    slide.style.display = 'flex';
    slide.style.justifyContent = 'center';
    slide.style.alignItems = 'center';
    
    // Enforce 16:9 aspect ratio with robust sizing
    slide.style.aspectRatio = '16 / 9';
    slide.style.width = '80vw'; 
    slide.style.maxWidth = '1200px';
    // Fallback for aspect-ratio support or calculation issues
    slide.style.height = 'auto';
    
    const text = document.createElement('p');
    text.textContent = 'Slide templates coming soon...';
    text.style.color = '#999';
    text.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    text.style.fontSize = '1.5rem';
    text.style.fontWeight = '500';
    
    slide.appendChild(text);
    container.appendChild(slide);
    return container;
  }
}
