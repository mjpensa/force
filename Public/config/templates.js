/**
 * SIMPLIFIED Slide Templates
 * Single template that handles ALL slide layouts
 * 16:9 aspect ratio (13.33" x 7.5")
 * Clean, professional design with no branding.
 */

const COLORS = {
  primary: '#1a1a2e',
  accent: '#4a90d9',
  white: '#FFFFFF',
  gray: '#666666',
  lightGray: '#f5f5f5'
};

const FONTS = {
  title: "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  body: "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
};

/**
 * Universal slide renderer - handles any slide data structure
 */
export function renderSlide(slide, index) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%;
    height: 100%;
    background: ${COLORS.white};
    position: relative;
    font-family: ${FONTS.body};
    box-sizing: border-box;
    padding: 40px;
    display: flex;
    flex-direction: column;
  `;

  // Tagline/section
  if (slide.tagline || slide.section) {
    const tagline = document.createElement('div');
    tagline.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: ${COLORS.accent};
      letter-spacing: 1px;
      margin-bottom: 20px;
      text-transform: uppercase;
    `;
    tagline.textContent = slide.tagline || slide.section;
    el.appendChild(tagline);
  }

  // Title
  if (slide.title) {
    const title = document.createElement('h1');
    title.style.cssText = `
      font-family: ${FONTS.title};
      font-size: clamp(28px, 4vw, 48px);
      font-weight: 600;
      line-height: 1.2;
      color: ${COLORS.primary};
      margin: 0 0 20px 0;
    `;
    title.textContent = slide.title;
    el.appendChild(title);
  }

  // Subtitle (for title slides)
  if (slide.subtitle) {
    const subtitle = document.createElement('p');
    subtitle.style.cssText = `
      font-size: 18px;
      color: ${COLORS.primary};
      margin: 0 0 20px 0;
    `;
    subtitle.textContent = slide.subtitle;
    el.appendChild(subtitle);
  }

  // Intro text (for grid layouts)
  if (slide.intro) {
    const intro = document.createElement('p');
    intro.style.cssText = `
      font-size: 14px;
      color: ${COLORS.primary};
      margin: 0 0 25px 0;
      max-width: 80%;
    `;
    intro.textContent = slide.intro;
    el.appendChild(intro);
  }

  // Body text
  if (slide.body) {
    const body = document.createElement('div');
    body.style.cssText = `
      font-size: 14px;
      line-height: 1.7;
      color: ${COLORS.primary};
      flex: 1;
    `;
    body.innerHTML = formatBody(slide.body);
    el.appendChild(body);
  }

  // Content array (bullet points)
  if (slide.content && Array.isArray(slide.content)) {
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
      font-size: 14px;
      line-height: 1.7;
      color: ${COLORS.primary};
      flex: 1;
    `;
    
    const ul = document.createElement('ul');
    ul.style.cssText = 'margin: 0; padding-left: 20px;';
    slide.content.forEach(item => {
      const li = document.createElement('li');
      li.style.cssText = 'margin-bottom: 10px;';
      li.textContent = typeof item === 'string' ? item : (item.text || item.title || JSON.stringify(item));
      ul.appendChild(li);
    });
    contentDiv.appendChild(ul);
    el.appendChild(contentDiv);
  }

  // Grid items
  if (slide.gridItems && Array.isArray(slide.gridItems) && slide.gridItems.length > 0) {
    const grid = document.createElement('div');
    const cols = slide.gridItems.length <= 3 ? slide.gridItems.length : 3;
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      gap: 20px;
      flex: 1;
      margin-top: 20px;
    `;
    
    slide.gridItems.slice(0, 6).forEach(item => {
      const card = document.createElement('div');
      card.style.cssText = `
        padding: 20px;
        background: ${COLORS.lightGray};
        border-radius: 8px;
        border-left: 3px solid ${COLORS.accent};
      `;
      card.innerHTML = `
        <h3 style="font-size: 16px; font-weight: 600; color: ${COLORS.primary}; margin: 0 0 10px 0;">
          ${item.title || ''}
        </h3>
        <p style="font-size: 13px; color: ${COLORS.gray}; margin: 0; line-height: 1.5;">
          ${item.description || item.text || ''}
        </p>
      `;
      grid.appendChild(card);
    });
    
    el.appendChild(grid);
  }

  // Footer - just slide number, no branding
  const footer = document.createElement('div');
  footer.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 40px;
    right: 40px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  `;
  footer.innerHTML = `
    <span style="font-size: 12px; color: ${COLORS.gray};">${index + 1}</span>
  `;
  el.appendChild(footer);

  return el;
}

/**
 * Format body text - handle newlines, bullet points
 */
function formatBody(text) {
  if (!text) return '';
  
  // Convert newlines to <br> or paragraphs
  const lines = text.split('\n').filter(l => l.trim());
  
  // Check if it looks like bullet points
  const isBullets = lines.some(l => l.trim().startsWith('•') || l.trim().startsWith('-') || l.trim().startsWith('*'));
  
  if (isBullets) {
    const items = lines.map(l => l.replace(/^[\s•\-\*]+/, '').trim());
    return '<ul style="margin:0;padding-left:20px;">' + 
      items.map(i => `<li style="margin-bottom:8px;">${i}</li>`).join('') + 
      '</ul>';
  }
  
  return lines.map(l => `<p style="margin:0 0 10px 0;">${l}</p>`).join('');
}

// Export single universal renderer for all layouts
export const PPT_TEMPLATES = {
  'title': renderSlide,
  'content': renderSlide,
  'grid': renderSlide,
  'default': renderSlide
};
