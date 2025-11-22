console.log('Slide 3 (Title Slide) Loaded');

// Example: Dynamic Date
const dateElement = document.querySelector('.footer-right');
if (dateElement) {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    // dateElement.textContent = `${month} | ${year}`;
}