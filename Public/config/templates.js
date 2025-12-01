/**
 * PPT Slide Templates
 * Based on PPT Templates_SHORT3.pptx
 * Slide dimensions: 13.33" x 7.5" (16:9)
 * 
 * Layout types from AI: 'title', 'content', 'grid'
 */

// Design tokens (extracted from PPTX)
const COLORS = {
  navy: '#0C2340',         // Dark navy (titles, body)
  red: '#DA291C',          // Red (section labels, logo)
  white: '#FFFFFF'
};

const FONTS = {
  title: "'Segoe UI Light', 'Helvetica Neue Light', Arial, sans-serif",
  body: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
};

// Convert inches to percentage of slide (13.33" x 7.5")
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const pct = (inches, total) => `${(inches / total) * 100}%`;

/**
 * Title Slide - centered title with tagline
 */
export function renderTitle(slide, index) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%; height: 100%;
    background: ${COLORS.white};
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    font-family: ${FONTS.body};
    padding: 40px;
    box-sizing: border-box;
  `;

  el.innerHTML = `
    ${slide.tagline ? `<div style="color: ${COLORS.red}; font-size: 14px; font-weight: 700; letter-spacing: 1px; margin-bottom: 20px;">${slide.tagline}</div>` : ''}
    <h1 style="color: ${COLORS.navy}; font-family: ${FONTS.title}; font-size: clamp(32px, 5vw, 56px); font-weight: 300; margin: 0; line-height: 1.2;">${slide.title || ''}</h1>
    ${slide.body ? `<p style="color: ${COLORS.navy}; font-size: 18px; margin-top: 30px; max-width: 70%;">${slide.body}</p>` : ''}
  `;

  return el;
}

/**
 * Content Slide - two column (title left, body right)
 * Based on PPT Templates_SHORT3.pptx Slide 1
 */
export function renderContent(slide, index) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%; height: 100%;
    background: ${COLORS.white};
    position: relative;
    font-family: ${FONTS.body};
    box-sizing: border-box;
  `;

  // Section/tagline label (top-left)
  const section = document.createElement('div');
  section.style.cssText = `
    position: absolute;
    left: ${pct(0.28, SLIDE_W)}; top: ${pct(0.26, SLIDE_H)};
    font-size: 12px;
    font-weight: 700;
    color: ${COLORS.red};
    letter-spacing: 0.5px;
  `;
  section.textContent = slide.tagline || slide.section || '';
  el.appendChild(section);

  // Title (left side)
  const title = document.createElement('h1');
  title.style.cssText = `
    position: absolute;
    left: ${pct(0.25, SLIDE_W)}; top: ${pct(0.67, SLIDE_H)};
    width: ${pct(5.94, SLIDE_W)};
    margin: 0;
    font-family: ${FONTS.title};
    font-size: clamp(28px, 4vw, 48px);
    font-weight: 300;
    line-height: 1.15;
    color: ${COLORS.navy};
  `;
  title.textContent = slide.title || '';
  el.appendChild(title);

  // Body text (right side)
  const body = document.createElement('div');
  body.style.cssText = `
    position: absolute;
    left: ${pct(6.74, SLIDE_W)}; top: ${pct(3.46, SLIDE_H)};
    width: ${pct(5.91, SLIDE_W)};
    height: ${pct(3.52, SLIDE_H)};
    font-size: 14px;
    line-height: 1.7;
    color: ${COLORS.navy};
    overflow: hidden;
  `;
  body.innerHTML = `<p style="margin: 0;">${slide.body || ''}</p>`;
  el.appendChild(body);

  // Slide number (bottom-left)
  const slideNum = document.createElement('div');
  slideNum.style.cssText = `
    position: absolute;
    left: ${pct(0.28, SLIDE_W)}; bottom: 3%;
    font-size: 10px;
    color: ${COLORS.navy};
  `;
  slideNum.textContent = index + 1;
  el.appendChild(slideNum);

  // Logo (bottom-right)
  const logo = document.createElement('div');
  logo.style.cssText = `
    position: absolute;
    right: 3%; bottom: 3%;
    font-size: 14px;
    font-weight: 700;
    color: ${COLORS.red};
  `;
  logo.textContent = 'bip.';
  el.appendChild(logo);

  return el;
}

/**
 * Grid Slide - intro text + grid of items
 */
export function renderGrid(slide, index) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%; height: 100%;
    background: ${COLORS.white};
    position: relative;
    font-family: ${FONTS.body};
    padding: 40px;
    box-sizing: border-box;
  `;

  // Tagline
  if (slide.tagline) {
    const tagline = document.createElement('div');
    tagline.style.cssText = `font-size: 12px; font-weight: 700; color: ${COLORS.red}; letter-spacing: 0.5px; margin-bottom: 10px;`;
    tagline.textContent = slide.tagline;
    el.appendChild(tagline);
  }

  // Title
  const title = document.createElement('h1');
  title.style.cssText = `font-family: ${FONTS.title}; font-size: clamp(24px, 3vw, 36px); font-weight: 300; color: ${COLORS.navy}; margin: 0 0 15px 0;`;
  title.textContent = slide.title || '';
  el.appendChild(title);

  // Intro text
  if (slide.intro) {
    const intro = document.createElement('p');
    intro.style.cssText = `font-size: 14px; color: ${COLORS.navy}; margin: 0 0 25px 0; max-width: 80%;`;
    intro.textContent = slide.intro;
    el.appendChild(intro);
  }

  // Grid items
  if (slide.gridItems?.length) {
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      flex: 1;
    `;
    
    slide.gridItems.slice(0, 6).forEach(item => {
      const card = document.createElement('div');
      card.style.cssText = `padding: 15px; background: #f8f9fa; border-radius: 4px;`;
      card.innerHTML = `
        <h3 style="font-size: 14px; font-weight: 600; color: ${COLORS.navy}; margin: 0 0 8px 0;">${item.title || ''}</h3>
        <p style="font-size: 12px; color: ${COLORS.navy}; margin: 0; line-height: 1.5;">${item.description || ''}</p>
      `;
      grid.appendChild(card);
    });
    
    el.appendChild(grid);
  }

  // Slide number
  const slideNum = document.createElement('div');
  slideNum.style.cssText = `position: absolute; left: 40px; bottom: 20px; font-size: 10px; color: ${COLORS.navy};`;
  slideNum.textContent = index + 1;
  el.appendChild(slideNum);

  // Logo
  const logo = document.createElement('div');
  logo.style.cssText = `position: absolute; right: 40px; bottom: 20px; font-size: 14px; font-weight: 700; color: ${COLORS.red};`;
  logo.textContent = 'bip.';
  el.appendChild(logo);

  return el;
}

// Template registry - matches AI schema layout types
export const PPT_TEMPLATES = {
  'title': renderTitle,
  'content': renderContent,
  'grid': renderGrid,
  'default': renderContent
};
