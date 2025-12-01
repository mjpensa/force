/**
 * PPT Slide Templates
 * Based on PPT Templates_SHORT3.pptx
 * Slide dimensions: 13.33" x 7.5" (16:9)
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
 * Template 1: Title + Body (Two Column)
 * Layout: [W] 4 Columns from PPTX
 * Left: Section label + large title
 * Right: Body paragraphs
 */
export function renderTitleBody(slide, index) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%; height: 100%;
    background: ${COLORS.white};
    position: relative;
    font-family: ${FONTS.body};
    box-sizing: border-box;
  `;

  // Section label (top-left): pos=(0.28", 0.26"), 12pt bold red
  const section = document.createElement('div');
  section.style.cssText = `
    position: absolute;
    left: ${pct(0.28, SLIDE_W)}; top: ${pct(0.26, SLIDE_H)};
    font-size: 12px;
    font-weight: 700;
    color: ${COLORS.red};
    letter-spacing: 0.5px;
  `;
  section.textContent = slide.section || '';
  el.appendChild(section);

  // Title (left): pos=(0.25", 0.67"), size=5.94"x2.35", 72pt navy
  const title = document.createElement('h1');
  title.style.cssText = `
    position: absolute;
    left: ${pct(0.25, SLIDE_W)}; top: ${pct(0.67, SLIDE_H)};
    width: ${pct(5.94, SLIDE_W)};
    margin: 0;
    font-family: ${FONTS.title};
    font-size: clamp(28px, 5vw, 54px);
    font-weight: 300;
    line-height: 1.15;
    color: ${COLORS.navy};
  `;
  title.textContent = slide.title || '';
  el.appendChild(title);

  // Body text (right): pos=(6.74", 3.46"), size=5.91"x3.52", 12pt navy
  const body = document.createElement('div');
  body.style.cssText = `
    position: absolute;
    left: ${pct(6.74, SLIDE_W)}; top: ${pct(3.46, SLIDE_H)};
    width: ${pct(5.91, SLIDE_W)};
    height: ${pct(3.52, SLIDE_H)};
    font-size: 12px;
    line-height: 1.7;
    color: ${COLORS.navy};
    overflow: hidden;
  `;
  
  const content = slide.content || slide.body || '';
  const paragraphs = Array.isArray(content) ? content : [content];
  body.innerHTML = paragraphs
    .map(p => `<p style="margin: 0 0 16px 0;">${p}</p>`)
    .join('');
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

// Template registry
export const PPT_TEMPLATES = {
  'title-body': renderTitleBody,
  'default': renderTitleBody
};
