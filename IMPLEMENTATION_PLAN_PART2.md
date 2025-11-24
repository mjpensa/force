# Implementation Plan - Part 2: Core Features & Integration

## Phase 2: Unified Content Generation
**Duration:** 5-6 days
**Priority:** Critical
**Dependencies:** Phase 0, Phase 1

### Step 2.1: Create Content Prompts

#### Task 2.1.1: Extract and Refactor Roadmap Prompt

Create `server/prompts/roadmap.js`:

```javascript
/**
 * Roadmap (Gantt Chart) Generation Prompt
 * Moved from server/prompts.js for better organization
 */

import { z } from 'zod';

export const roadmapSchema = z.object({
  title: z.string(),
  timeColumns: z.array(z.string()),
  data: z.array(
    z.object({
      title: z.string(),
      isSwimlane: z.boolean().optional(),
      entity: z.string(),
      taskType: z.enum(['milestone', 'decision', 'task']),
      bar: z
        .object({
          startCol: z.number(),
          endCol: z.number(),
          color: z.string()
        })
        .optional()
    })
  ),
  legend: z.array(
    z.object({
      color: z.string(),
      label: z.string()
    })
  )
});

export const roadmapPrompt = `
You are a strategic roadmap expert. Analyze the provided research files and create a comprehensive Gantt chart roadmap.

INSTRUCTIONS:
1. Extract key milestones, deliverables, and timelines from the research
2. Identify different teams/entities involved
3. Determine task types: milestones (◆), decisions (○), or tasks (bars)
4. Assign realistic time columns (quarters, months, or weeks)
5. Use color coding for priority/status
6. Group related tasks into swimlanes

COLOR SCHEME:
- priority-red: Critical path items
- medium-red: High priority
- light-red: Medium priority
- lightest-red: Low priority
- blue: Planning/research
- green: Completed/stable

OUTPUT FORMAT:
Return a JSON object matching the roadmapSchema with:
- title: Concise roadmap title
- timeColumns: Array of time periods
- data: Array of tasks (swimlanes and task bars)
- legend: Color legend

Focus on clarity and actionable timeline visualization.
`;

export function generateRoadmapPrompt(userPrompt, researchFiles) {
  const filesContext = researchFiles
    .map((file, i) => `File ${i + 1} (${file.name}):\n${file.content}`)
    .join('\n\n---\n\n');

  return `${roadmapPrompt}

USER REQUEST:
${userPrompt}

RESEARCH FILES:
${filesContext}

Generate the roadmap now in JSON format.`;
}
```

#### Task 2.1.2: Create Slides Prompt

Create `server/prompts/slides.js`:

```javascript
/**
 * Slides (Presentation) Generation Prompt
 */

import { z } from 'zod';

export const slidesSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  slides: z.array(
    z.object({
      slideNumber: z.number(),
      type: z.enum(['title', 'content', 'timeline', 'summary', 'table']),
      title: z.string(),
      content: z.object({
        subtitle: z.string().optional(),
        bullets: z.array(z.string()).optional(),
        timeline: z
          .object({
            items: z.array(
              z.object({
                date: z.string(),
                milestone: z.string(),
                description: z.string()
              })
            )
          })
          .optional(),
        summary: z
          .object({
            keyPoints: z.array(z.string()),
            nextSteps: z.array(z.string()).optional()
          })
          .optional(),
        table: z
          .object({
            headers: z.array(z.string()),
            rows: z.array(z.array(z.string()))
          })
          .optional()
      }),
      notes: z.string().optional()
    })
  ),
  theme: z.object({
    primaryColor: z.string(),
    secondaryColor: z.string()
  })
});

export const slidesPrompt = `
You are a presentation design expert. Create a compelling slide deck from the research files.

SLIDE STRUCTURE:
1. Title slide - Project name and overview
2. Agenda/Contents (optional)
3. Executive Summary - Key takeaways (3-5 bullets)
4. Main Content - Core findings/features (3-7 slides)
5. Timeline - Visual timeline of milestones
6. Key Metrics/Data (if applicable)
7. Recommendations/Next Steps
8. Summary/Conclusion

GUIDELINES:
- Keep slides simple and visual
- Use 3-5 bullets per content slide (max)
- Each bullet should be concise (1-2 lines)
- Include speaker notes for context
- Use consistent terminology
- Focus on insights, not data dumps

SLIDE TYPES:
- "title": Opening slide with title/subtitle
- "content": Standard bullet point slide
- "timeline": Chronological milestones
- "table": Data comparison
- "summary": Key takeaways

OUTPUT FORMAT:
Return JSON matching slidesSchema with 8-12 slides total.
`;

export function generateSlidesPrompt(userPrompt, researchFiles) {
  const filesContext = researchFiles
    .map((file, i) => `File ${i + 1} (${file.name}):\n${file.content}`)
    .join('\n\n---\n\n');

  return `${slidesPrompt}

USER REQUEST:
${userPrompt}

RESEARCH FILES:
${filesContext}

Create a professional presentation deck in JSON format.`;
}
```

#### Task 2.1.3: Create Document Prompt

Create `server/prompts/document.js`:

```javascript
/**
 * Document (Report) Generation Prompt
 */

import { z } from 'zod';

const contentBlockSchema = z.object({
  type: z.enum(['paragraph', 'list', 'table', 'quote', 'heading']),
  data: z.any()
});

export const documentSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  authors: z.array(z.string()).optional(),
  date: z.string(),
  tableOfContents: z.array(
    z.object({
      section: z.string(),
      page: z.number().optional(),
      subsections: z.array(z.string()).optional()
    })
  ),
  sections: z.array(
    z.object({
      sectionNumber: z.string(),
      title: z.string(),
      level: z.number(),
      content: z.array(contentBlockSchema)
    })
  ),
  appendices: z
    .array(
      z.object({
        title: z.string(),
        content: z.array(contentBlockSchema)
      })
    )
    .optional(),
  references: z.array(z.string()).optional()
});

export const documentPrompt = `
You are a technical documentation expert. Create a comprehensive report from the research files.

DOCUMENT STRUCTURE:
1. Executive Summary (1-2 paragraphs)
2. Introduction
   - Background
   - Objectives
   - Scope
3. Main Content (3-7 sections based on research)
   - Use subsections for organization
   - Include tables, lists where appropriate
   - Support with data/quotes
4. Analysis & Findings
5. Recommendations
6. Conclusion
7. Appendices (optional)
8. References (if applicable)

WRITING GUIDELINES:
- Professional, clear, concise
- Use active voice
- Break down complex concepts
- Include specific examples
- Use tables for comparisons
- Quote important findings
- Maintain consistent section numbering

CONTENT BLOCKS:
- paragraph: Standard text (1-3 sentences)
- list: Bulleted or numbered items
- table: Structured data with headers
- quote: Highlighted important text
- heading: Sub-headings within sections

OUTPUT FORMAT:
Return JSON matching documentSchema with proper hierarchy.
`;

export function generateDocumentPrompt(userPrompt, researchFiles) {
  const filesContext = researchFiles
    .map((file, i) => `File ${i + 1} (${file.name}):\n${file.content}`)
    .join('\n\n---\n\n');

  return `${documentPrompt}

USER REQUEST:
${userPrompt}

RESEARCH FILES:
${filesContext}

Generate a detailed document in JSON format.`;
}
```

---

### Step 2.2: Create Unified Content Generation Endpoint

#### Task 2.2.1: Create Content Routes

Create `server/routes/content.js`:

```javascript
/**
 * Content Generation Routes
 * Unified endpoint for generating all three content types
 */

import express from 'express';
import crypto from 'crypto';
import { SessionDB, ContentDB, JobDB } from '../db.js';
import { generateAllContent } from '../generators.js';

const router = express.Router();

/**
 * POST /generate-content
 * Creates a new content generation job
 */
router.post('/generate-content', async (req, res) => {
  try {
    const { files, prompt } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    // Create IDs
    const jobId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    // Create session in database
    SessionDB.create(sessionId, prompt, files);

    // Create job
    JobDB.create(jobId, sessionId);

    // Start async generation (don't await)
    generateAllContent(sessionId, files, prompt, jobId).catch(error => {
      console.error('Content generation failed:', error);
      SessionDB.updateStatus(sessionId, 'error', error.message);
      JobDB.updateStatus(jobId, 'error');
    });

    // Return immediately
    res.json({
      jobId,
      sessionId,
      message: 'Content generation started'
    });
  } catch (error) {
    console.error('Error creating content job:', error);
    res.status(500).json({ error: 'Failed to start content generation' });
  }
});

/**
 * GET /job/:jobId
 * Check job status and progress
 */
router.get('/job/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = JobDB.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.jobId,
      sessionId: job.sessionId,
      status: job.status,
      progress: job.progress
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

/**
 * GET /content/:sessionId/:viewType
 * Get content for a specific view
 */
router.get('/content/:sessionId/:viewType', (req, res) => {
  try {
    const { sessionId, viewType } = req.params;

    // Validate view type
    if (!['roadmap', 'slides', 'document'].includes(viewType)) {
      return res.status(400).json({ error: 'Invalid view type' });
    }

    // Get session
    const session = SessionDB.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get content
    const content = ContentDB.get(sessionId, viewType);
    if (!content) {
      return res.status(404).json({ error: `${viewType} content not found` });
    }

    res.json(content.data);
  } catch (error) {
    console.error('Error getting content:', error);
    res.status(500).json({ error: 'Failed to get content' });
  }
});

/**
 * GET /session/:sessionId
 * Get all content for a session
 */
router.get('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = SessionDB.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const allContent = ContentDB.getAll(sessionId);

    res.json({
      session: {
        sessionId: session.sessionId,
        prompt: session.prompt,
        status: session.status,
        createdAt: session.createdAt
      },
      content: allContent
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * DELETE /session/:sessionId
 * Delete a session and all its content
 */
router.delete('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    SessionDB.delete(sessionId);

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
```

#### Task 2.2.2: Create Content Generators

Create `server/generators.js`:

```javascript
/**
 * Content Generators
 * Parallel generation of all three content types
 */

import { generateContent } from './gemini.js';
import { SessionDB, ContentDB, JobDB } from './db.js';
import {
  generateRoadmapPrompt,
  roadmapSchema
} from './prompts/roadmap.js';
import {
  generateSlidesPrompt,
  slidesSchema
} from './prompts/slides.js';
import {
  generateDocumentPrompt,
  documentSchema
} from './prompts/document.js';

/**
 * Generate all three content types in parallel
 */
export async function generateAllContent(sessionId, files, prompt, jobId) {
  console.log(`🚀 Starting content generation for session ${sessionId}`);

  try {
    // Update job status
    JobDB.updateStatus(jobId, 'processing');

    // Generate all three in parallel
    const [roadmapResult, slidesResult, documentResult] = await Promise.allSettled([
      generateRoadmap(sessionId, files, prompt, jobId),
      generateSlides(sessionId, files, prompt, jobId),
      generateDocument(sessionId, files, prompt, jobId)
    ]);

    // Check results
    const allSucceeded =
      roadmapResult.status === 'fulfilled' &&
      slidesResult.status === 'fulfilled' &&
      documentResult.status === 'fulfilled';

    if (allSucceeded) {
      console.log(`✅ All content generated for session ${sessionId}`);
      SessionDB.updateStatus(sessionId, 'complete');
      JobDB.updateStatus(jobId, 'complete');
    } else {
      console.error(`⚠️ Some content generation failed for session ${sessionId}`);
      const errors = [
        roadmapResult.status === 'rejected' ? `Roadmap: ${roadmapResult.reason}` : null,
        slidesResult.status === 'rejected' ? `Slides: ${slidesResult.reason}` : null,
        documentResult.status === 'rejected' ? `Document: ${documentResult.reason}` : null
      ]
        .filter(Boolean)
        .join('; ');

      SessionDB.updateStatus(sessionId, 'partial', errors);
      JobDB.updateStatus(jobId, 'partial');
    }
  } catch (error) {
    console.error(`❌ Content generation failed for session ${sessionId}:`, error);
    SessionDB.updateStatus(sessionId, 'error', error.message);
    JobDB.updateStatus(jobId, 'error');
    throw error;
  }
}

/**
 * Generate roadmap content
 */
async function generateRoadmap(sessionId, files, userPrompt, jobId) {
  console.log(`📊 Generating roadmap for session ${sessionId}...`);

  // Update progress
  const job = JobDB.get(jobId);
  JobDB.updateProgress(jobId, {
    ...job.progress,
    roadmap: 'processing'
  });

  try {
    const prompt = generateRoadmapPrompt(userPrompt, files);
    const content = await generateContent(prompt, roadmapSchema);

    // Save to database
    ContentDB.save(sessionId, 'roadmap', content);

    // Update progress
    const updatedJob = JobDB.get(jobId);
    JobDB.updateProgress(jobId, {
      ...updatedJob.progress,
      roadmap: 'complete'
    });

    console.log(`✅ Roadmap generated for session ${sessionId}`);
    return content;
  } catch (error) {
    console.error(`❌ Roadmap generation failed:`, error);

    // Update progress
    const updatedJob = JobDB.get(jobId);
    JobDB.updateProgress(jobId, {
      ...updatedJob.progress,
      roadmap: 'error'
    });

    throw error;
  }
}

/**
 * Generate slides content
 */
async function generateSlides(sessionId, files, userPrompt, jobId) {
  console.log(`📽️ Generating slides for session ${sessionId}...`);

  const job = JobDB.get(jobId);
  JobDB.updateProgress(jobId, {
    ...job.progress,
    slides: 'processing'
  });

  try {
    const prompt = generateSlidesPrompt(userPrompt, files);
    const content = await generateContent(prompt, slidesSchema);

    ContentDB.save(sessionId, 'slides', content);

    const updatedJob = JobDB.get(jobId);
    JobDB.updateProgress(jobId, {
      ...updatedJob.progress,
      slides: 'complete'
    });

    console.log(`✅ Slides generated for session ${sessionId}`);
    return content;
  } catch (error) {
    console.error(`❌ Slides generation failed:`, error);

    const updatedJob = JobDB.get(jobId);
    JobDB.updateProgress(jobId, {
      ...updatedJob.progress,
      slides: 'error'
    });

    throw error;
  }
}

/**
 * Generate document content
 */
async function generateDocument(sessionId, files, userPrompt, jobId) {
  console.log(`📄 Generating document for session ${sessionId}...`);

  const job = JobDB.get(jobId);
  JobDB.updateProgress(jobId, {
    ...job.progress,
    document: 'processing'
  });

  try {
    const prompt = generateDocumentPrompt(userPrompt, files);
    const content = await generateContent(prompt, documentSchema);

    ContentDB.save(sessionId, 'document', content);

    const updatedJob = JobDB.get(jobId);
    JobDB.updateProgress(jobId, {
      ...updatedJob.progress,
      document: 'complete'
    });

    console.log(`✅ Document generated for session ${sessionId}`);
    return content;
  } catch (error) {
    console.error(`❌ Document generation failed:`, error);

    const updatedJob = JobDB.get(jobId);
    JobDB.updateProgress(jobId, {
      ...updatedJob.progress,
      document: 'error'
    });

    throw error;
  }
}
```

#### Task 2.2.3: Update server.js

Update `server.js` to use new routes:

```javascript
// Add import
import contentRoutes from './server/routes/content.js';

// Replace old chart routes with new content routes
app.use('/', contentRoutes);

// Keep analysis routes for now
import analysisRoutes from './server/routes/analysis.js';
app.use('/', analysisRoutes);
```

**Testing Checklist:**
- [ ] Can create new content generation job
- [ ] Job ID and session ID returned
- [ ] Can poll job status
- [ ] Progress updates correctly (roadmap, slides, document)
- [ ] All three content types generated in parallel
- [ ] Content saved to database correctly
- [ ] Can retrieve each content type separately
- [ ] Error handling works for partial failures

---

## Phase 3: Slides View Implementation
**Duration:** 5-6 days
**Priority:** High
**Dependencies:** Phase 1, Phase 2

### Step 3.1: Create SlidesView Component

#### Task 3.1.1: Build Core Component

Create `Public/components/views/SlidesView.js`:

```javascript
/**
 * SlidesView Component
 * Presentation mode for generated slides
 */

export class SlidesView {
  constructor(container, slidesData, sessionId) {
    this.container = container;
    this.slidesData = slidesData;
    this.sessionId = sessionId;
    this.currentSlide = 0;
    this.isFullscreen = false;

    // Bind methods
    this.nextSlide = this.nextSlide.bind(this);
    this.previousSlide = this.previousSlide.bind(this);
    this.goToSlide = this.goToSlide.bind(this);
    this.handleKeyboard = this.handleKeyboard.bind(this);
    this.toggleFullscreen = this.toggleFullscreen.bind(this);
  }

  /**
   * Render the slides view
   */
  render() {
    this.container.innerHTML = '';
    this.container.className = 'slides-view';

    // Create structure
    const slidesContainer = document.createElement('div');
    slidesContainer.className = 'slides-container';

    // Slide display area
    const slideDisplay = this.createSlideDisplay();
    slidesContainer.appendChild(slideDisplay);

    // Controls
    const controls = this.createControls();
    slidesContainer.appendChild(controls);

    // Thumbnails
    const thumbnails = this.createThumbnails();
    slidesContainer.appendChild(thumbnails);

    // Keyboard hint
    const hint = this.createKeyboardHint();
    slidesContainer.appendChild(hint);

    this.container.appendChild(slidesContainer);

    // Attach event listeners
    this.attachEventListeners();

    // Render first slide
    this.renderSlide(this.currentSlide);
  }

  /**
   * Create slide display area
   */
  createSlideDisplay() {
    const display = document.createElement('div');
    display.className = 'slide-display';
    display.id = 'slide-display';

    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.id = 'current-slide';

    display.appendChild(slide);
    return display;
  }

  /**
   * Create navigation controls
   */
  createControls() {
    const controls = document.createElement('div');
    controls.className = 'slide-controls';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'slide-nav-button';
    prevBtn.id = 'prev-slide';
    prevBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24">
        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
      </svg>
    `;
    prevBtn.setAttribute('aria-label', 'Previous slide');

    // Counter
    const counter = document.createElement('div');
    counter.className = 'slide-counter';
    counter.innerHTML = `
      <span class="current-slide-num">1</span>
      <span class="slide-divider">/</span>
      <span class="total-slides">${this.slidesData.slides.length}</span>
    `;

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'slide-nav-button';
    nextBtn.id = 'next-slide';
    nextBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24">
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
      </svg>
    `;
    nextBtn.setAttribute('aria-label', 'Next slide');

    // Fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'icon-button';
    fullscreenBtn.id = 'fullscreen-toggle';
    fullscreenBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24">
        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
      </svg>
    `;
    fullscreenBtn.title = 'Toggle fullscreen';

    controls.appendChild(prevBtn);
    controls.appendChild(counter);
    controls.appendChild(nextBtn);
    controls.appendChild(fullscreenBtn);

    return controls;
  }

  /**
   * Create thumbnail navigator
   */
  createThumbnails() {
    const thumbnails = document.createElement('div');
    thumbnails.className = 'slide-thumbnails';
    thumbnails.id = 'slide-thumbnails';

    this.slidesData.slides.forEach((slide, index) => {
      const thumbnail = document.createElement('button');
      thumbnail.className = 'thumbnail';
      if (index === 0) thumbnail.classList.add('active');
      thumbnail.dataset.slide = index;

      const preview = document.createElement('div');
      preview.className = 'thumbnail-preview';
      preview.textContent = slide.slideNumber;

      thumbnail.appendChild(preview);
      thumbnails.appendChild(thumbnail);
    });

    return thumbnails;
  }

  /**
   * Create keyboard hint
   */
  createKeyboardHint() {
    const hint = document.createElement('div');
    hint.className = 'keyboard-hint';
    hint.innerHTML = `
      Use <kbd>←</kbd> <kbd>→</kbd> arrow keys or <kbd>Space</kbd> to navigate
    `;

    return hint;
  }

  /**
   * Render a specific slide
   */
  renderSlide(index) {
    const slideData = this.slidesData.slides[index];
    const slideElement = document.getElementById('current-slide');

    slideElement.className = 'slide';
    slideElement.dataset.slideNumber = slideData.slideNumber;
    slideElement.dataset.slideType = slideData.type;

    // Render based on slide type
    let content = '';

    switch (slideData.type) {
      case 'title':
        content = this.renderTitleSlide(slideData);
        break;
      case 'content':
        content = this.renderContentSlide(slideData);
        break;
      case 'timeline':
        content = this.renderTimelineSlide(slideData);
        break;
      case 'table':
        content = this.renderTableSlide(slideData);
        break;
      case 'summary':
        content = this.renderSummarySlide(slideData);
        break;
      default:
        content = this.renderContentSlide(slideData);
    }

    slideElement.innerHTML = content;

    // Update counter
    document.querySelector('.current-slide-num').textContent = index + 1;

    // Update thumbnails
    document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });

    // Update button states
    document.getElementById('prev-slide').disabled = index === 0;
    document.getElementById('next-slide').disabled =
      index === this.slidesData.slides.length - 1;
  }

  /**
   * Render title slide
   */
  renderTitleSlide(slideData) {
    return `
      <div class="slide-content">
        <h1 class="slide-title">${this.escapeHtml(slideData.title)}</h1>
        ${slideData.content.subtitle ? `
          <p class="slide-subtitle">${this.escapeHtml(slideData.content.subtitle)}</p>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render content slide
   */
  renderContentSlide(slideData) {
    const bullets = slideData.content.bullets || [];

    return `
      <div class="slide-content">
        <h2 class="slide-heading">${this.escapeHtml(slideData.title)}</h2>
        ${bullets.length > 0 ? `
          <ul class="slide-bullets">
            ${bullets.map(bullet => `
              <li>${this.escapeHtml(bullet)}</li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render timeline slide
   */
  renderTimelineSlide(slideData) {
    const items = slideData.content.timeline?.items || [];

    return `
      <div class="slide-content">
        <h2 class="slide-heading">${this.escapeHtml(slideData.title)}</h2>
        <div class="timeline">
          ${items.map(item => `
            <div class="timeline-item">
              <div class="timeline-date">${this.escapeHtml(item.date)}</div>
              <div class="timeline-content">
                <h3 class="timeline-milestone">${this.escapeHtml(item.milestone)}</h3>
                <p class="timeline-description">${this.escapeHtml(item.description)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render table slide
   */
  renderTableSlide(slideData) {
    const table = slideData.content.table;
    if (!table) return this.renderContentSlide(slideData);

    return `
      <div class="slide-content">
        <h2 class="slide-heading">${this.escapeHtml(slideData.title)}</h2>
        <table class="slide-table">
          <thead>
            <tr>
              ${table.headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${table.rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${this.escapeHtml(cell)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render summary slide
   */
  renderSummarySlide(slideData) {
    const summary = slideData.content.summary;
    if (!summary) return this.renderContentSlide(slideData);

    return `
      <div class="slide-content">
        <h2 class="slide-heading">${this.escapeHtml(slideData.title)}</h2>
        <div class="summary-section">
          <h3 class="summary-subtitle">Key Points</h3>
          <ul class="slide-bullets">
            ${summary.keyPoints.map(point => `
              <li>${this.escapeHtml(point)}</li>
            `).join('')}
          </ul>
        </div>
        ${summary.nextSteps ? `
          <div class="summary-section">
            <h3 class="summary-subtitle">Next Steps</h3>
            <ul class="slide-bullets">
              ${summary.nextSteps.map(step => `
                <li>${this.escapeHtml(step)}</li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Navigation methods
   */
  nextSlide() {
    if (this.currentSlide < this.slidesData.slides.length - 1) {
      this.currentSlide++;
      this.renderSlide(this.currentSlide);
    }
  }

  previousSlide() {
    if (this.currentSlide > 0) {
      this.currentSlide--;
      this.renderSlide(this.currentSlide);
    }
  }

  goToSlide(index) {
    if (index >= 0 && index < this.slidesData.slides.length) {
      this.currentSlide = index;
      this.renderSlide(this.currentSlide);
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    this.container.classList.toggle('fullscreen', this.isFullscreen);

    const icon = document.getElementById('fullscreen-toggle');
    icon.innerHTML = this.isFullscreen
      ? `<svg width="24" height="24" viewBox="0 0 24 24">
           <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
         </svg>`
      : `<svg width="24" height="24" viewBox="0 0 24 24">
           <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
         </svg>`;
  }

  /**
   * Keyboard navigation
   */
  handleKeyboard(event) {
    switch (event.key) {
      case 'ArrowRight':
      case ' ':
        event.preventDefault();
        this.nextSlide();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.previousSlide();
        break;
      case 'Home':
        event.preventDefault();
        this.goToSlide(0);
        break;
      case 'End':
        event.preventDefault();
        this.goToSlide(this.slidesData.slides.length - 1);
        break;
      case 'f':
      case 'F11':
        event.preventDefault();
        this.toggleFullscreen();
        break;
      case 'Escape':
        if (this.isFullscreen) {
          event.preventDefault();
          this.toggleFullscreen();
        }
        break;
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Navigation buttons
    document.getElementById('prev-slide').addEventListener('click', this.previousSlide);
    document.getElementById('next-slide').addEventListener('click', this.nextSlide);
    document.getElementById('fullscreen-toggle').addEventListener('click', this.toggleFullscreen);

    // Thumbnails
    document.querySelectorAll('.thumbnail').forEach((thumb, index) => {
      thumb.addEventListener('click', () => this.goToSlide(index));
    });

    // Keyboard
    document.addEventListener('keydown', this.handleKeyboard);
  }

  /**
   * Cleanup
   */
  destroy() {
    document.removeEventListener('keydown', this.handleKeyboard);
  }

  /**
   * Utility: Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
```

Continue in the next part...

**Testing Checklist for Phase 3:**
- [ ] SlidesView renders correctly
- [ ] Can navigate slides with buttons
- [ ] Keyboard navigation works (arrows, space)
- [ ] Thumbnails update correctly
- [ ] Fullscreen mode toggles
- [ ] All slide types render properly
- [ ] Counter updates correctly
- [ ] First/last slide button states correct

---

This implementation plan provides:
- Detailed step-by-step instructions
- Complete code examples
- Testing checklists for each phase
- Proper dependency management
- Rollback procedures (to be added in Part 3)

Would you like me to continue with:
1. Phase 4 (Document View)
2. Phase 5 (Integration & Testing)
3. Phase 6 (Polish & Optimization)
4. Rollback & Deployment procedures?
