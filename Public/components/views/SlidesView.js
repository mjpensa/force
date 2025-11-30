export class SlidesView {
  constructor(data) {
    this.data = data;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'slides-view';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = 'white';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    
    const text = document.createElement('p');
    text.textContent = 'Slide templates coming soon...';
    text.style.color = '#ccc';
    text.style.fontFamily = 'sans-serif';
    
    container.appendChild(text);
    return container;
  }
}
