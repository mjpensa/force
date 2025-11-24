# Implementation Plan - Part 3: Document View, Testing & Deployment

## Phase 4: Document View Implementation
**Duration:** 5-6 days
**Priority:** High
**Dependencies:** Phase 1, Phase 2

### Step 4.1: Create DocumentView Component

#### Task 4.1.1: Build Core Component

Create `Public/components/views/DocumentView.js`:

```javascript
/**
 * DocumentView Component
 * Long-form document reader with table of contents
 */

export class DocumentView {
  constructor(container, documentData, sessionId) {
    this.container = container;
    this.documentData = documentData;
    this.sessionId = sessionId;
    this.activeSection = null;

    // Bind methods
    this.scrollToSection = this.scrollToSection.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.exportToPDF = this.exportToPDF.bind(this);
  }

  /**
   * Render the document view
   */
  render() {
    this.container.innerHTML = '';
    this.container.className = 'document-view';

    const documentContainer = document.createElement('div');
    documentContainer.className = 'document-container';

    // Table of contents (sidebar)
    const toc = this.createTableOfContents();
    documentContainer.appendChild(toc);

    // Main document content
    const content = this.createDocumentContent();
    documentContainer.appendChild(content);

    this.container.appendChild(documentContainer);

    // Attach event listeners
    this.attachEventListeners();

    // Setup scroll spy
    this.setupScrollSpy();
  }

  /**
   * Create table of contents
   */
  createTableOfContents() {
    const aside = document.createElement('aside');
    aside.className = 'document-toc';

    const nav = document.createElement('nav');
    nav.className = 'toc-nav';

    const title = document.createElement('h2');
    title.className = 'toc-title';
    title.textContent = 'Contents';

    const list = document.createElement('ul');
    list.className = 'toc-list';

    this.documentData.tableOfContents.forEach(item => {
      const li = document.createElement('li');

      const link = document.createElement('a');
      link.href = `#section-${this.slugify(item.section)}`;
      link.className = 'toc-link';
      link.textContent = item.section;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.scrollToSection(this.slugify(item.section));
      });

      li.appendChild(link);

      // Subsections
      if (item.subsections && item.subsections.length > 0) {
        const sublist = document.createElement('ul');
        sublist.className = 'toc-sublist';

        item.subsections.forEach(subitem => {
          const subli = document.createElement('li');
          const sublink = document.createElement('a');
          sublink.href = `#section-${this.slugify(subitem)}`;
          sublink.className = 'toc-link';
          sublink.textContent = subitem;
          sublink.addEventListener('click', (e) => {
            e.preventDefault();
            this.scrollToSection(this.slugify(subitem));
          });

          subli.appendChild(sublink);
          sublist.appendChild(subli);
        });

        li.appendChild(sublist);
      }

      list.appendChild(li);
    });

    nav.appendChild(title);
    nav.appendChild(list);
    aside.appendChild(nav);

    return aside;
  }

  /**
   * Create main document content
   */
  createDocumentContent() {
    const article = document.createElement('article');
    article.className = 'document-content';
    article.id = 'document-content';

    // Header
    const header = this.createDocumentHeader();
    article.appendChild(header);

    // Sections
    this.documentData.sections.forEach(section => {
      const sectionElement = this.createSection(section);
      article.appendChild(sectionElement);
    });

    // Appendices
    if (this.documentData.appendices && this.documentData.appendices.length > 0) {
      const appendicesSection = document.createElement('section');
      appendicesSection.className = 'document-section';

      const appendicesTitle = document.createElement('h2');
      appendicesTitle.className = 'section-heading';
      appendicesTitle.textContent = 'Appendices';
      appendicesSection.appendChild(appendicesTitle);

      this.documentData.appendices.forEach(appendix => {
        const appendixElement = this.createAppendix(appendix);
        appendicesSection.appendChild(appendixElement);
      });

      article.appendChild(appendicesSection);
    }

    // References
    if (this.documentData.references && this.documentData.references.length > 0) {
      const referencesSection = this.createReferences();
      article.appendChild(referencesSection);
    }

    return article;
  }

  /**
   * Create document header
   */
  createDocumentHeader() {
    const header = document.createElement('header');
    header.className = 'document-header';

    const title = document.createElement('h1');
    title.className = 'document-title';
    title.textContent = this.documentData.title;

    header.appendChild(title);

    if (this.documentData.subtitle) {
      const subtitle = document.createElement('p');
      subtitle.className = 'document-subtitle';
      subtitle.textContent = this.documentData.subtitle;
      header.appendChild(subtitle);
    }

    const meta = document.createElement('div');
    meta.className = 'document-meta';

    if (this.documentData.authors && this.documentData.authors.length > 0) {
      const authorsSpan = document.createElement('span');
      authorsSpan.className = 'meta-item';
      authorsSpan.textContent = this.documentData.authors.join(', ');
      meta.appendChild(authorsSpan);

      const divider = document.createElement('span');
      divider.className = 'meta-divider';
      divider.textContent = '•';
      meta.appendChild(divider);
    }

    const dateSpan = document.createElement('span');
    dateSpan.className = 'meta-item';
    dateSpan.textContent = this.formatDate(this.documentData.date);
    meta.appendChild(dateSpan);

    header.appendChild(meta);

    return header;
  }

  /**
   * Create section element
   */
  createSection(sectionData) {
    const section = document.createElement('section');
    section.className = 'document-section';
    section.id = `section-${this.slugify(sectionData.title)}`;

    const heading = document.createElement(`h${Math.min(sectionData.level + 1, 6)}`);
    heading.className = 'section-heading';
    heading.textContent = `${sectionData.sectionNumber}. ${sectionData.title}`;

    section.appendChild(heading);

    // Render content blocks
    sectionData.content.forEach(block => {
      const blockElement = this.renderContentBlock(block);
      if (blockElement) {
        section.appendChild(blockElement);
      }
    });

    return section;
  }

  /**
   * Render content block based on type
   */
  renderContentBlock(block) {
    switch (block.type) {
      case 'paragraph':
        return this.renderParagraph(block.data);
      case 'list':
        return this.renderList(block.data);
      case 'table':
        return this.renderTable(block.data);
      case 'quote':
        return this.renderQuote(block.data);
      case 'heading':
        return this.renderSubheading(block.data);
      default:
        console.warn('Unknown block type:', block.type);
        return null;
    }
  }

  /**
   * Render paragraph
   */
  renderParagraph(text) {
    const p = document.createElement('p');
    p.className = 'section-paragraph';
    p.textContent = text;
    return p;
  }

  /**
   * Render list
   */
  renderList(data) {
    const list = document.createElement(data.ordered ? 'ol' : 'ul');
    list.className = 'section-list';

    if (Array.isArray(data)) {
      data.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
    } else if (data.items) {
      data.items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
    }

    return list;
  }

  /**
   * Render table
   */
  renderTable(data) {
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';

    const table = document.createElement('table');
    table.className = 'section-table';

    // Headers
    if (data.headers && data.headers.length > 0) {
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');

      data.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);
    }

    // Rows
    if (data.rows && data.rows.length > 0) {
      const tbody = document.createElement('tbody');

      data.rows.forEach(row => {
        const tr = document.createElement('tr');

        row.forEach(cell => {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
    }

    tableWrapper.appendChild(table);
    return tableWrapper;
  }

  /**
   * Render quote
   */
  renderQuote(text) {
    const blockquote = document.createElement('blockquote');
    blockquote.className = 'section-quote';
    blockquote.textContent = text;
    return blockquote;
  }

  /**
   * Render subheading
   */
  renderSubheading(text) {
    const h4 = document.createElement('h4');
    h4.className = 'section-subheading';
    h4.textContent = text;
    return h4;
  }

  /**
   * Create appendix
   */
  createAppendix(appendix) {
    const div = document.createElement('div');
    div.className = 'appendix';

    const title = document.createElement('h3');
    title.className = 'appendix-title';
    title.textContent = appendix.title;
    div.appendChild(title);

    appendix.content.forEach(block => {
      const blockElement = this.renderContentBlock(block);
      if (blockElement) {
        div.appendChild(blockElement);
      }
    });

    return div;
  }

  /**
   * Create references section
   */
  createReferences() {
    const section = document.createElement('section');
    section.className = 'document-section';

    const heading = document.createElement('h2');
    heading.className = 'section-heading';
    heading.textContent = 'References';
    section.appendChild(heading);

    const list = document.createElement('ol');
    list.className = 'references-list';

    this.documentData.references.forEach(ref => {
      const li = document.createElement('li');
      li.textContent = ref;
      list.appendChild(li);
    });

    section.appendChild(list);

    return section;
  }

  /**
   * Scroll to section
   */
  scrollToSection(sectionId) {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      const headerOffset = 80; // Account for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }

  /**
   * Setup scroll spy (highlight active section in TOC)
   */
  setupScrollSpy() {
    const sections = document.querySelectorAll('.document-section');
    const tocLinks = document.querySelectorAll('.toc-link');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id;

            // Remove active class from all links
            tocLinks.forEach(link => link.classList.remove('active'));

            // Add active class to current section's link
            const activeLink = document.querySelector(
              `.toc-link[href="#${sectionId}"]`
            );
            if (activeLink) {
              activeLink.classList.add('active');
            }
          }
        });
      },
      {
        rootMargin: '-100px 0px -66%',
        threshold: 0
      }
    );

    sections.forEach(section => observer.observe(section));

    this.scrollObserver = observer;
  }

  /**
   * Export to PDF (placeholder - would use a library like jsPDF)
   */
  async exportToPDF() {
    // This would require adding jsPDF library
    alert('PDF export coming soon! For now, use browser print (Ctrl+P)');

    // Example implementation:
    // const { jsPDF } = window.jspdf;
    // const doc = new jsPDF();
    // doc.text(this.documentData.title, 10, 10);
    // ... add content ...
    // doc.save(`${this.slugify(this.documentData.title)}.pdf`);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Scroll handling (if needed)
    window.addEventListener('scroll', this.handleScroll);
  }

  /**
   * Handle scroll
   */
  handleScroll() {
    // Could add scroll-to-top button here
  }

  /**
   * Cleanup
   */
  destroy() {
    window.removeEventListener('scroll', this.handleScroll);
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
    }
  }

  /**
   * Utility: Create URL-friendly slug
   */
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim();
  }

  /**
   * Utility: Format date
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
```

#### Task 4.1.2: Create Document View Styles

Create `Public/styles/document-view.css`:

```css
/**
 * Document View Styles
 * Google Docs-inspired long-form reading experience
 */

.document-view {
  background: var(--color-background);
  min-height: calc(100vh - var(--header-height));
}

.document-container {
  max-width: var(--container-lg);
  margin: 0 auto;
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  gap: var(--spacing-8);
  padding: var(--spacing-8);
  align-items: start;
}

/* ========== TABLE OF CONTENTS ========== */

.document-toc {
  position: sticky;
  top: calc(var(--header-height) + var(--spacing-8));
  height: fit-content;
  max-height: calc(100vh - var(--header-height) - var(--spacing-16));
  overflow-y: auto;
  padding-right: var(--spacing-4);
}

/* Custom scrollbar for TOC */
.document-toc::-webkit-scrollbar {
  width: 6px;
}

.document-toc::-webkit-scrollbar-track {
  background: var(--color-background);
  border-radius: var(--radius-full);
}

.document-toc::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-full);
}

.document-toc::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-dark);
}

.toc-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-4) 0;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc-list li {
  margin-bottom: var(--spacing-1);
}

.toc-link {
  display: block;
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: var(--text-sm);
  transition: all var(--transition-fast);
  border-left: 2px solid transparent;
  line-height: var(--leading-snug);
}

.toc-link:hover {
  background: var(--color-hover);
  color: var(--color-text-primary);
}

.toc-link.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: var(--weight-medium);
  border-left-color: var(--color-primary);
}

.toc-sublist {
  list-style: none;
  margin: var(--spacing-1) 0 var(--spacing-2) var(--spacing-4);
  padding: 0;
}

.toc-sublist .toc-link {
  font-size: var(--text-xs);
  padding-left: var(--spacing-2);
}

/* ========== DOCUMENT CONTENT ========== */

.document-content {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-12);
  max-width: var(--content-width);
  animation: fadeIn var(--transition-base);
}

/* Document Header */
.document-header {
  margin-bottom: var(--spacing-12);
  padding-bottom: var(--spacing-8);
  border-bottom: 1px solid var(--color-border);
}

.document-title {
  font-size: var(--text-4xl);
  font-weight: var(--weight-normal);
  line-height: var(--leading-tight);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4) 0;
}

.document-subtitle {
  font-size: var(--text-xl);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-6) 0;
  font-weight: var(--weight-normal);
  line-height: var(--leading-normal);
}

.document-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.meta-item {
  display: inline-flex;
  align-items: center;
}

.meta-divider {
  color: var(--color-border);
  margin: 0 var(--spacing-1);
}

/* ========== SECTIONS ========== */

.document-section {
  margin-bottom: var(--spacing-12);
}

.section-heading {
  font-size: var(--text-3xl);
  font-weight: var(--weight-medium);
  line-height: var(--leading-tight);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-6) 0;
  scroll-margin-top: calc(var(--header-height) + var(--spacing-8));
  position: relative;
}

.section-heading::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--spacing-6));
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 0;
  background: var(--color-primary);
  border-radius: var(--radius-full);
  transition: height var(--transition-base);
}

.section-heading:hover::before {
  height: 100%;
}

.section-subheading {
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
  color: var(--color-text-primary);
  margin: var(--spacing-8) 0 var(--spacing-4) 0;
  line-height: var(--leading-tight);
}

/* ========== CONTENT BLOCKS ========== */

.section-paragraph {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4) 0;
  text-align: justify;
}

.section-paragraph:last-child {
  margin-bottom: 0;
}

.section-list {
  margin: var(--spacing-4) 0;
  padding-left: var(--spacing-6);
  color: var(--color-text-primary);
  line-height: var(--leading-relaxed);
}

.section-list li {
  margin-bottom: var(--spacing-2);
}

.section-list li:last-child {
  margin-bottom: 0;
}

/* Tables */
.table-wrapper {
  overflow-x: auto;
  margin: var(--spacing-6) 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.section-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.section-table th {
  background: var(--color-background);
  padding: var(--spacing-3) var(--spacing-4);
  text-align: left;
  font-weight: var(--weight-semibold);
  color: var(--color-text-primary);
  border-bottom: 2px solid var(--color-border);
}

.section-table td {
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-text-primary);
}

.section-table tr:last-child td {
  border-bottom: none;
}

.section-table tbody tr:hover {
  background: var(--color-hover);
}

/* Quotes */
.section-quote {
  margin: var(--spacing-6) 0;
  padding: var(--spacing-4) var(--spacing-6);
  border-left: 4px solid var(--color-primary);
  background: var(--color-background);
  border-radius: var(--radius-sm);
  font-size: var(--text-lg);
  font-style: italic;
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
}

/* ========== APPENDICES ========== */

.appendix {
  margin-top: var(--spacing-8);
  padding-top: var(--spacing-6);
  border-top: 1px solid var(--color-border-light);
}

.appendix-title {
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4) 0;
}

/* ========== REFERENCES ========== */

.references-list {
  list-style-position: inside;
  margin: var(--spacing-4) 0;
  padding: 0;
}

.references-list li {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-3);
  line-height: var(--leading-relaxed);
}

/* ========== ANIMATIONS ========== */

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========== RESPONSIVE ========== */

@media (max-width: 1024px) {
  .document-container {
    grid-template-columns: 1fr;
  }

  .document-toc {
    position: static;
    max-height: none;
    margin-bottom: var(--spacing-6);
    padding: var(--spacing-4);
    background: var(--color-surface);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }
}

@media (max-width: 768px) {
  .document-content {
    padding: var(--spacing-6);
  }

  .document-title {
    font-size: var(--text-3xl);
  }

  .section-heading {
    font-size: var(--text-2xl);
  }

  .section-paragraph {
    text-align: left; /* Remove justify on mobile */
  }
}

/* ========== PRINT STYLES ========== */

@media print {
  .document-toc {
    display: none;
  }

  .document-content {
    box-shadow: none;
    padding: 0;
    max-width: 100%;
  }

  .section-heading {
    page-break-after: avoid;
  }

  .section-paragraph {
    page-break-inside: avoid;
  }

  .table-wrapper {
    page-break-inside: avoid;
  }
}
```

**Testing Checklist for Phase 4:**
- [ ] DocumentView renders correctly
- [ ] Table of contents generated
- [ ] TOC links scroll to correct sections
- [ ] Scroll spy highlights active section
- [ ] All content block types render
- [ ] Tables display properly
- [ ] Quotes styled correctly
- [ ] Appendices and references show
- [ ] Print styles work
- [ ] Responsive layout works

---

## Phase 5: Integration & Testing
**Duration:** 4-5 days
**Priority:** Critical
**Dependencies:** All previous phases

### Step 5.1: Update Frontend Entry Points

#### Task 5.1.1: Update main.js for New Workflow

Update `Public/main.js`:

```javascript
/**
 * Main.js - Updated for three-screen architecture
 */

import { state } from './components/shared/StateManager.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('upload-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const files = formData.getAll('files');
    const prompt = formData.get('prompt');

    if (files.length === 0) {
      alert('Please select at least one file');
      return;
    }

    if (!prompt) {
      alert('Please enter a prompt');
      return;
    }

    // Show loading state
    showLoadingModal();

    try {
      // Start content generation
      const response = await fetch('/generate-content', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { jobId, sessionId } = await response.json();

      // Poll for completion
      await pollJobStatus(jobId, sessionId);

      // Redirect to viewer
      window.location.href = `chart.html?session=${sessionId}#roadmap`;
    } catch (error) {
      console.error('Error generating content:', error);
      hideLoadingModal();
      alert('Failed to generate content. Please try again.');
    }
  });
});

/**
 * Show loading modal with progress
 */
function showLoadingModal() {
  const modal = document.createElement('div');
  modal.id = 'loading-modal';
  modal.className = 'loading-modal';
  modal.innerHTML = `
    <div class="loading-content">
      <h2>Generating Your Content</h2>
      <p>This may take a minute...</p>

      <div class="progress-items">
        <div class="progress-item" id="progress-roadmap">
          <span class="progress-icon">⏳</span>
          <span class="progress-label">Roadmap</span>
          <span class="progress-status">Pending</span>
        </div>
        <div class="progress-item" id="progress-slides">
          <span class="progress-icon">⏳</span>
          <span class="progress-label">Slides</span>
          <span class="progress-status">Pending</span>
        </div>
        <div class="progress-item" id="progress-document">
          <span class="progress-icon">⏳</span>
          <span class="progress-label">Document</span>
          <span class="progress-status">Pending</span>
        </div>
      </div>

      <div class="spinner"></div>
    </div>
  `;

  document.body.appendChild(modal);
}

/**
 * Update progress item
 */
function updateProgress(viewType, status) {
  const item = document.getElementById(`progress-${viewType}`);
  if (!item) return;

  const icon = item.querySelector('.progress-icon');
  const statusText = item.querySelector('.progress-status');

  switch (status) {
    case 'processing':
      icon.textContent = '⏳';
      statusText.textContent = 'Processing...';
      item.classList.add('processing');
      break;
    case 'complete':
      icon.textContent = '✅';
      statusText.textContent = 'Complete';
      item.classList.remove('processing');
      item.classList.add('complete');
      break;
    case 'error':
      icon.textContent = '❌';
      statusText.textContent = 'Error';
      item.classList.remove('processing');
      item.classList.add('error');
      break;
  }
}

/**
 * Poll job status
 */
async function pollJobStatus(jobId, sessionId) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/job/${jobId}`);

        if (!response.ok) {
          throw new Error('Failed to check job status');
        }

        const job = await response.json();

        // Update progress
        Object.entries(job.progress).forEach(([viewType, status]) => {
          updateProgress(viewType, status);
        });

        // Check if complete
        if (job.status === 'complete' || job.status === 'partial') {
          clearInterval(interval);
          resolve(sessionId);
        } else if (job.status === 'error') {
          clearInterval(interval);
          reject(new Error('Content generation failed'));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, 1000); // Poll every second

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Timeout waiting for content generation'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Hide loading modal
 */
function hideLoadingModal() {
  const modal = document.getElementById('loading-modal');
  if (modal) {
    modal.remove();
  }
}
```

#### Task 5.1.2: Update chart.html (Multi-View Shell)

Update `Public/chart.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Force - Research Platform</title>

  <!-- Design System -->
  <link rel="stylesheet" href="styles/design-system.css">
  <link rel="stylesheet" href="styles/app-shell.css">
  <link rel="stylesheet" href="styles/roadmap-view.css">
  <link rel="stylesheet" href="styles/slides-view.css">
  <link rel="stylesheet" href="styles/document-view.css">

  <!-- Legacy styles (for compatibility) -->
  <link rel="stylesheet" href="style.css">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <!-- Skip to content link (accessibility) -->
  <a href="#main-content" class="skip-link">Skip to content</a>

  <!-- Application Container -->
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <button class="icon-button" id="menu-button" aria-label="Open menu">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
        <h1 class="app-title">Force</h1>
      </div>

      <div class="header-center">
        <span class="document-title" id="document-title" contenteditable="true">
          Untitled
        </span>
      </div>

      <div class="header-right">
        <button class="icon-button" id="export-button" title="Export">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2z"/>
            <path fill="currentColor" d="M13 12.67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/>
          </svg>
        </button>
        <button class="icon-button" id="share-button" title="Share">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="app-main" id="main-content">
      <div id="view-container" class="view-container">
        <!-- Views render here -->
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    </main>
  </div>

  <!-- HamburgerMenu Container -->
  <div id="hamburger-menu"></div>

  <!-- Loading Modal Styles -->
  <style>
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      gap: var(--spacing-4);
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>

  <!-- Application Scripts (ES6 Modules) -->
  <script type="module" src="chart-renderer.js"></script>
</body>
</html>
```

#### Task 5.1.3: Update chart-renderer.js (Multi-View Orchestrator)

Update `Public/chart-renderer.js`:

```javascript
/**
 * Chart Renderer - Updated for multi-view architecture
 */

import { state } from './components/shared/StateManager.js';
import { Router } from './Router.js';
import { HamburgerMenu } from './HamburgerMenu.js';
import { GanttChart } from './GanttChart.js';  // Legacy, will become RoadmapView
import { SlidesView } from './components/views/SlidesView.js';
import { DocumentView } from './components/views/DocumentView.js';

// Container elements
const viewContainer = document.getElementById('view-container');
const menuContainer = document.getElementById('hamburger-menu');

// Current view instance
let currentView = null;

// Initialize application
async function initializeApp() {
  try {
    // Initialize state from URL
    state.initializeFromURL();

    // Setup router
    const router = new Router();

    // Register routes
    router.addRoute('roadmap', () => loadView('roadmap'));
    router.addRoute('slides', () => loadView('slides'));
    router.addRoute('document', () => loadView('document'));

    // Setup hamburger menu
    const menuItems = [
      {
        id: 'roadmap',
        icon: '📊',
        label: 'Roadmap',
        hash: '#roadmap'
      },
      {
        id: 'slides',
        icon: '📽️',
        label: 'Slides',
        hash: '#slides'
      },
      {
        id: 'document',
        icon: '📄',
        label: 'Document',
        hash: '#document'
      }
    ];

    const menu = new HamburgerMenu(menuContainer, menuItems, router);
    menu.render();

    // Initialize router (will trigger initial route)
    router.init();

    // Setup export button
    document.getElementById('export-button').addEventListener('click', handleExport);

    // Setup share button
    document.getElementById('share-button').addEventListener('click', handleShare);

  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError('Failed to load content. Please try again.');
  }
}

/**
 * Load and render a specific view
 */
async function loadView(viewName) {
  console.log(`Loading view: ${viewName}`);

  // Show loading state
  viewContainer.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading ${viewName}...</p>
    </div>
  `;

  try {
    // Load view data
    const data = await state.loadView(viewName);

    // Destroy current view
    if (currentView && currentView.destroy) {
      currentView.destroy();
    }

    // Render new view
    viewContainer.innerHTML = '';

    switch (viewName) {
      case 'roadmap':
        currentView = new GanttChart(viewContainer, data);
        currentView.render();
        break;

      case 'slides':
        currentView = new SlidesView(viewContainer, data, state.getState().sessionId);
        currentView.render();
        break;

      case 'document':
        currentView = new DocumentView(viewContainer, data, state.getState().sessionId);
        currentView.render();
        break;

      default:
        throw new Error(`Unknown view: ${viewName}`);
    }

    // Update document title
    updateDocumentTitle(data);

    // Prefetch other views
    state.prefetchOtherViews(viewName);

  } catch (error) {
    console.error(`Error loading ${viewName}:`, error);
    showError(`Failed to load ${viewName}. ${error.message}`);
  }
}

/**
 * Update document title in header
 */
function updateDocumentTitle(data) {
  const titleElement = document.getElementById('document-title');

  if (data.title) {
    titleElement.textContent = data.title;
  } else if (state.getState().currentView === 'roadmap' && data.ganttData?.title) {
    titleElement.textContent = data.ganttData.title;
  }
}

/**
 * Handle export
 */
function handleExport() {
  const currentViewName = state.getState().currentView;

  if (currentView && currentView.export) {
    currentView.export();
  } else {
    // Fallback: trigger browser print
    window.print();
  }
}

/**
 * Handle share
 */
function handleShare() {
  const url = window.location.href;

  if (navigator.share) {
    navigator.share({
      title: document.getElementById('document-title').textContent,
      url: url
    }).catch(err => console.log('Share cancelled'));
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
    });
  }
}

/**
 * Show error message
 */
function showError(message) {
  viewContainer.innerHTML = `
    <div class="error-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="var(--color-error)" stroke-width="2"/>
        <path d="M12 8v4M12 16h.01" stroke="var(--color-error)" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <h2>Error</h2>
      <p>${message}</p>
      <button onclick="window.location.href='index.html'" class="btn-primary">
        Go Back
      </button>
    </div>
  `;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
```

**Testing Checklist for Phase 5:**
- [ ] Can generate all three content types
- [ ] Progress indicator updates correctly
- [ ] Redirects to roadmap view after generation
- [ ] Can switch between views using menu
- [ ] URL hash updates when switching views
- [ ] Data persists when switching views
- [ ] Export button works for each view
- [ ] Share button works
- [ ] Error handling works correctly
- [ ] Loading states display properly

---

## Phase 6: Polish & Optimization
**Duration:** 3-4 days
**Priority:** Medium
**Dependencies:** Phase 5

### Key Tasks

#### Task 6.1: Performance Optimization
- [ ] Implement code splitting (if using Vite)
- [ ] Optimize images and assets
- [ ] Add service worker for offline support (optional)
- [ ] Implement lazy loading for images
- [ ] Minimize initial bundle size

#### Task 6.2: Accessibility Improvements
- [ ] Add ARIA labels to all interactive elements
- [ ] Ensure keyboard navigation works everywhere
- [ ] Test with screen readers
- [ ] Add skip links
- [ ] Ensure color contrast meets WCAG 2.1 AA

#### Task 6.3: Browser Testing
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test in Edge
- [ ] Test on mobile devices
- [ ] Test on tablets

#### Task 6.4: Error Handling
- [ ] Add error boundaries
- [ ] Implement retry logic for API calls
- [ ] Add user-friendly error messages
- [ ] Log errors for debugging

#### Task 6.5: Documentation
- [ ] Update README with new features
- [ ] Add JSDoc comments to all functions
- [ ] Create user guide
- [ ] Document API endpoints

---

## Rollback Procedures

### If Database Migration Fails

```bash
# 1. Stop the server
pkill -f server.js

# 2. Restore from backup
cp data/force.db.backup data/force.db

# 3. Rollback code changes
git revert <commit-hash>

# 4. Restart with in-memory storage
# Comment out database imports in server.js
# Un-comment in-memory storage imports

# 5. Restart server
npm start
```

### If Content Generation Fails

```bash
# Check logs
tail -f logs/error.log

# Check database
sqlite3 data/force.db "SELECT * FROM jobs WHERE status='error';"

# Manual retry
curl -X POST http://localhost:3000/retry-job/<jobId>
```

### Complete Rollback to Previous Version

```bash
# 1. Checkout previous stable version
git checkout backup-before-three-screens

# 2. Reinstall dependencies
npm install

# 3. Migrate data back (if needed)
node server/rollback-migration.js

# 4. Restart server
npm start
```

---

## Testing Strategy

### Unit Tests

Create `tests/unit/StateManager.test.js`:

```javascript
import { StateManager } from '../../Public/components/shared/StateManager.js';

describe('StateManager', () => {
  let state;

  beforeEach(() => {
    state = new StateManager();
  });

  test('initializes with default state', () => {
    expect(state.getState().sessionId).toBeNull();
    expect(state.getState().currentView).toBe('roadmap');
  });

  test('setState updates state', () => {
    state.setState({ sessionId: 'test-123' });
    expect(state.getState().sessionId).toBe('test-123');
  });

  test('subscribers are notified of changes', () => {
    const listener = jest.fn();
    state.subscribe(listener);

    state.setState({ sessionId: 'test-456' });

    expect(listener).toHaveBeenCalled();
  });

  // Add more tests...
});
```

### Integration Tests

Create `tests/integration/content-generation.test.js`:

```javascript
import request from 'supertest';
import app from '../../server.js';

describe('Content Generation Flow', () => {
  test('generates all three content types', async () => {
    // 1. Start job
    const createResponse = await request(app)
      .post('/generate-content')
      .field('prompt', 'Test prompt')
      .attach('files', 'test/fixtures/sample.pdf');

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.jobId).toBeDefined();

    const { jobId, sessionId } = createResponse.body;

    // 2. Poll until complete (with timeout)
    let complete = false;
    let attempts = 0;

    while (!complete && attempts < 60) {
      const jobResponse = await request(app).get(`/job/${jobId}`);

      if (jobResponse.body.status === 'complete') {
        complete = true;
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    expect(complete).toBe(true);

    // 3. Verify content exists
    const roadmapResponse = await request(app).get(`/content/${sessionId}/roadmap`);
    expect(roadmapResponse.status).toBe(200);

    const slidesResponse = await request(app).get(`/content/${sessionId}/slides`);
    expect(slidesResponse.status).toBe(200);

    const documentResponse = await request(app).get(`/content/${sessionId}/document`);
    expect(documentResponse.status).toBe(200);
  });
});
```

### E2E Tests (using Playwright)

Create `tests/e2e/full-workflow.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test('full content generation workflow', async ({ page }) => {
  // 1. Navigate to home page
  await page.goto('http://localhost:3000');

  // 2. Upload file
  await page.setInputFiles('input[type="file"]', 'test/fixtures/sample.pdf');

  // 3. Enter prompt
  await page.fill('textarea[name="prompt"]', 'Generate roadmap for Q1 2025');

  // 4. Submit form
  await page.click('button[type="submit"]');

  // 5. Wait for progress modal
  await expect(page.locator('.loading-modal')).toBeVisible();

  // 6. Wait for completion (max 2 minutes)
  await page.waitForURL('**/chart.html**', { timeout: 120000 });

  // 7. Verify roadmap view loaded
  await expect(page.locator('.roadmap-view')).toBeVisible();

  // 8. Switch to slides view
  await page.click('a[href="#slides"]');
  await expect(page.locator('.slides-view')).toBeVisible();

  // 9. Switch to document view
  await page.click('a[href="#document"]');
  await expect(page.locator('.document-view')).toBeVisible();

  // 10. Test navigation
  await page.keyboard.press('ArrowRight'); // Next slide in slides view should work when switched back

  // 11. Test export
  await page.click('#export-button');
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code review completed
- [ ] Database migrations tested
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] Browser compatibility verified
- [ ] Documentation updated
- [ ] Changelog updated

### Deployment Steps

1. **Backup Current System**
```bash
# Backup database
cp data/force.db data/force.db.backup.$(date +%Y%m%d)

# Backup code
git tag pre-three-screens-deployment
```

2. **Deploy New Code**
```bash
git checkout feature/three-screen-architecture
npm install
npm run build  # If using build system
```

3. **Run Database Migrations**
```bash
node server/migrate-to-db.js
```

4. **Verify Deployment**
```bash
# Run health check
curl http://localhost:3000/health

# Test content generation
curl -X POST http://localhost:3000/generate-content \
  -F "files=@test-file.pdf" \
  -F "prompt=test"
```

5. **Monitor**
```bash
# Watch logs
tail -f logs/application.log

# Monitor database
watch 'sqlite3 data/force.db "SELECT status, COUNT(*) FROM jobs GROUP BY status;"'
```

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify all three views working
- [ ] Test on production with real data
- [ ] Collect user feedback
- [ ] Document any issues

### Rollback Plan

If critical issues arise:

```bash
# 1. Stop server
pm2 stop force

# 2. Rollback code
git checkout pre-three-screens-deployment

# 3. Restore database
cp data/force.db.backup.20251124 data/force.db

# 4. Restart server
pm2 start force

# 5. Notify users
# Send notification about temporary rollback
```

---

## Success Metrics

Track these metrics to measure success:

1. **Technical Metrics**
   - [ ] Page load time < 2 seconds
   - [ ] Content generation time < 30 seconds per view
   - [ ] Error rate < 1%
   - [ ] Database query time < 100ms

2. **User Experience Metrics**
   - [ ] Task completion rate > 90%
   - [ ] User satisfaction score > 4/5
   - [ ] Time to first view < 5 seconds
   - [ ] Navigation between views < 1 second

3. **Code Quality Metrics**
   - [ ] Test coverage > 80%
   - [ ] No critical security vulnerabilities
   - [ ] Code maintainability score > B
   - [ ] Documentation coverage > 90%

---

## Conclusion

This comprehensive implementation plan provides:

✅ Detailed step-by-step instructions for each phase
✅ Complete code examples for all components
✅ Testing strategies at unit, integration, and E2E levels
✅ Rollback procedures for safety
✅ Deployment checklist for production readiness
✅ Success metrics to track progress

**Estimated Total Timeline:** 6-7 weeks

**Next Steps:**
1. Review this plan with your team
2. Set up development environment (Phase 0)
3. Begin with database implementation
4. Follow phases sequentially
5. Test thoroughly at each step
6. Deploy incrementally if possible

Good luck with the implementation! 🚀
