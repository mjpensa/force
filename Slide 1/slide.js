// slide.js – builds the slide DOM with fixed pixel coordinates

const loremCol1 = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad.`;

const loremCol2 = `Minim veniam, quis nostrud exercitation Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna magna:
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud.`;

const loremCol3 = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad.`;

/* --- Helpers --- */

function createCornerLogo() {
  const wrapper = document.createElement("div");
  wrapper.className = "slide__corner";

  // Geometric recreation of top-right art
  wrapper.innerHTML = `
    <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
      <!-- top-left navy -->
      <rect x="0" y="0" width="50" height="40" fill="#002040" />
      <!-- top-right red -->
      <rect x="50" y="0" width="50" height="40" fill="#d02010" />
      <!-- light blue triangle -->
      <polygon points="0,40 50,0 50,40" fill="#90a0b0" />
      <!-- central navy triangle -->
      <polygon points="0,40 100,40 50,80" fill="#002040" />
      <!-- mid blue right triangle -->
      <polygon points="50,80 100,40 100,80" fill="#506070" />
    </svg>
  `;

  return wrapper;
}

function createColumn(text, extraClass) {
  const col = document.createElement("div");
  col.className = `slide__column ${extraClass}`;

  // allow manual control of line breaks if you want: split on sentences
  text.split(/\n+/).forEach((para) => {
    const p = document.createElement("p");
    p.textContent = para.trim();
    if (p.textContent) col.appendChild(p);
  });

  return col;
}

/* --- Main slide builder --- */

export function createSlide() {
  const slide = document.createElement("div");
  slide.className = "slide";

  // eyebrow
  const eyebrow = document.createElement("div");
  eyebrow.className = "slide__eyebrow";
  eyebrow.textContent = "LOREM IPSUM";
  slide.appendChild(eyebrow);

  // title
  const title = document.createElement("div");
  title.className = "slide__title";
  title.textContent = "Lorem ipsum sit amet sit lorem";
  slide.appendChild(title);

  // columns
  slide.appendChild(createColumn(loremCol1, "slide__column--1"));
  slide.appendChild(createColumn(loremCol2, "slide__column--2"));
  slide.appendChild(createColumn(loremCol3, "slide__column--3"));

  return slide;
}

/* --- Mount --- */

const mountNode = document.getElementById("app");
if (mountNode) {
  mountNode.appendChild(createSlide());
}
