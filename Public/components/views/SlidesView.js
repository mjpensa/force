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
    
    // Enforce 16:9 aspect ratio
    slide.style.aspectRatio = '16 / 9';
    
    // Responsive sizing: fit within viewport with padding
    // Use min() to ensure it fits both width and height constraints
    // 1. Max width is 90% of viewport width
    // 2. Max height is 90% of viewport height (converted to width via aspect ratio)
    slide.style.width = 'min(90vw, calc(80vh * 16 / 9))';
    
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
