# Multi-View Architecture Upgrade Plan

**Version:** 1.0
**Date:** November 24, 2025
**Objective:** Refactor codebase to support Roadmap, Documents, and Slides views while maintaining 100% backward compatibility with existing Gantt chart functionality.

---

## Executive Summary

This plan outlines a phased approach to transform the current single-purpose Gantt chart application into a scalable multi-view platform. The architecture will support adding new screen types (Documents, Slides, etc.) with minimal code changes while ensuring existing charts continue to work without modification.

### Key Principles
1. **Backward Compatibility First** - No breaking changes to existing charts
2. **Progressive Enhancement** - New features don't affect old functionality
3. **Clean Separation** - Views are independent, composable modules
4. **Data-Driven** - Configuration over hard-coding
5. **Zero Impact on Current Gantt Logic** - Chart generation remains unchanged

---

## Current State Analysis

### Architecture Overview
```
┌─────────────────────────────────────────┐
│         Single-Purpose App              │
│                                         │
│  index.html  →  Generate Chart          │
│  chart.html  →  Display Gantt Chart     │
│                                         │
│  Data: { timeColumns, data }            │
│  View: Hard-coded Gantt visualization   │
└─────────────────────────────────────────┘
```

### Current Data Model (v1)
```javascript
{
  timeColumns: [...],    // Gantt time periods
  data: [...],           // Task data
  sessionId: "...",
  chartId: "..."
}
```

### Current Limitations
- ❌ Only supports Gantt chart visualization
- ❌ Hard-coded routing (single route: 'roadmap')
- ❌ Hard-coded navigation menu
- ❌ No extensibility for new view types
- ❌ Tight coupling between data and visualization

---

## Target State Architecture

### Multi-View Platform
```
┌──────────────────────────────────────────────────────────┐
│              Multi-View Platform                          │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Roadmap    │  │  Documents   │  │    Slides      │  │
│  │  (Gantt)    │  │  Viewer      │  │    Viewer      │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│                                                           │
│  ViewRegistry: Dynamic view management                    │
│  Router: Hash-based routing with parameters               │
│  Data Model v2: { views: { roadmap, documents, slides } } │
└──────────────────────────────────────────────────────────┘
```

### New Data Model (v2)
```javascript
{
  version: 2,
  chartId: "...",
  sessionId: "...",

  // Multi-view data structure
  views: {
    roadmap: {
      timeColumns: [...],
      data: [...]
    },
    documents: {
      files: [
        { name: "spec.docx", html: "...", metadata: {...} }
      ]
    },
    slides: {
      files: [
        { name: "presentation.pptx", slides: [...], metadata: {...} }
      ]
    }
  },

  // BACKWARD COMPATIBILITY: Root-level aliases
  timeColumns: views.roadmap.timeColumns,  // Alias
  data: views.roadmap.data                 // Alias
}
```

**Why This Works:**
- Old clients read `timeColumns` and `data` at root level (still works!)
- New clients use `views` object for multi-view support
- Automatic migration from v1 → v2 when charts are loaded
- Zero breaking changes

---

## Implementation Plan

### Phase 1: Foundation (Backend Data Layer) - 2-3 hours

#### 1.1 Create Multi-View Data Model

**File:** `server/dataModel.js` (new file, ~370 lines)

**Purpose:** Centralized data model management with migration and validation

**Key Functions:**
```javascript
// Create v2 data structure
createChartData({ roadmapData, documents, slides, sessionId, chartId })

// Migrate v1 → v2
migrateToV2(oldData)

// Ensure data is v2 (migrate if needed)
ensureV2Format(chartData)

// Validate structure
validateChartData(chartData)

// Get/update specific view data
getViewData(chartData, 'roadmap')
updateViewData(chartData, 'roadmap', newData)

// Add documents/slides
addDocuments(chartData, documents)
addSlides(chartData, slides)

// Create backward-compatible API response
createAPIResponse(chartData)
```

**Implementation Details:**
```javascript
// Example migration logic
export function migrateToV2(oldData) {
  // Check if already v2
  if (oldData.version === 2) return oldData;

  // Extract v1 fields
  const { timeColumns, data, sessionId, chartId } = oldData;

  // Create v2 structure
  return {
    version: 2,
    chartId,
    sessionId,
    views: {
      roadmap: { timeColumns, data }
    },
    // Backward compatibility aliases
    timeColumns,  // Points to same array
    data          // Points to same array
  };
}
```

**Testing:**
- [ ] v1 data migrates correctly to v2
- [ ] v2 data validates successfully
- [ ] Backward compatibility fields exist at root
- [ ] Old charts can still be parsed

---

#### 1.2 Update Storage Layer

**File:** `server/storage.js` (modify existing)

**Changes:**
1. Import data model utilities
2. Update `storeChart()` to auto-migrate to v2
3. Update `getChart()` to migrate old charts on retrieval

**Code Changes:**
```javascript
// Add import
import { ensureV2Format, validateChartData } from './dataModel.js';

// Update storeChart()
export function storeChart(chartData, sessionId) {
  const chartId = crypto.randomBytes(16).toString('hex');

  // Ensure v2 format (auto-migrate if v1)
  const v2Data = ensureV2Format(chartData);
  v2Data.chartId = chartId;
  v2Data.sessionId = sessionId;

  // Validate
  const validation = validateChartData(v2Data);
  if (!validation.valid) {
    console.warn('Validation warnings:', validation.errors);
  }

  // Store v2 data
  chartStore.set(chartId, {
    data: v2Data,
    sessionId,
    createdAt: Date.now(),
    expiresAt: Date.now() + CONFIG.STORAGE.EXPIRATION_MS
  });

  return chartId;
}

// Update getChart()
export function getChart(chartId) {
  const chart = chartStore.get(chartId);
  if (!chart) return null;

  // Auto-migrate old charts to v2
  let chartData = chart.data;
  if (!chartData.version || chartData.version < 2) {
    chartData = ensureV2Format(chartData);
    // Update in storage
    chartStore.set(chartId, { ...chart, data: chartData });
  }

  return { ...chart, data: chartData };
}
```

**Benefits:**
- Old charts automatically upgraded when accessed
- No manual migration needed
- Transparent to clients

**Testing:**
- [ ] Storing v1 data creates v2 in storage
- [ ] Retrieving old v1 chart returns v2
- [ ] v2 charts store/retrieve correctly
- [ ] Validation catches malformed data

---

#### 1.3 Update API Routes

**File:** `server/routes/charts.js` (modify existing)

**Changes:**
1. Import `createAPIResponse()` from dataModel
2. Update GET `/chart/:id` to return backward-compatible response

**Code Changes:**
```javascript
// Add import
import { createAPIResponse } from '../dataModel.js';

// Update GET /chart/:id endpoint
router.get('/chart/:id', (req, res) => {
  const chartId = req.params.id;
  const chart = getChart(chartId);

  if (!chart) {
    return res.status(404).json({ error: 'Chart not found' });
  }

  // Create backward-compatible response
  // Old clients: see timeColumns/data at root
  // New clients: see views object
  const responseData = createAPIResponse(chart.data);

  res.json(responseData);
});
```

**API Response Format:**
```javascript
{
  version: 2,
  chartId: "...",
  sessionId: "...",

  // New: views object
  views: {
    roadmap: { timeColumns: [...], data: [...] },
    documents: { files: [...] }  // if present
  },

  // Old: backward compatibility (at root level)
  timeColumns: [...],  // Same as views.roadmap.timeColumns
  data: [...]          // Same as views.roadmap.data
}
```

**Testing:**
- [ ] Old client code can still read `data.timeColumns`
- [ ] Old client code can still read `data.data`
- [ ] New code can access `data.views.roadmap`
- [ ] Response includes both formats

---

### Phase 2: Frontend View System - 3-4 hours

#### 2.1 Create ViewRegistry

**File:** `Public/ViewRegistry.js` (new file, ~240 lines)

**Purpose:** Centralized registry for managing all view types

**Architecture:**
```javascript
class ViewRegistry {
  constructor() {
    this.views = new Map();
    this._registerDefaultViews();
  }

  // Register a view
  register({ id, name, icon, route, dataKey, isAvailable, render }) {
    this.views.set(id, { id, name, icon, route, dataKey, isAvailable, render });
  }

  // Check if view has data
  isViewAvailable(viewId, chartData) {
    const view = this.getView(viewId);
    return view ? view.isAvailable(chartData) : false;
  }

  // Get menu items for navigation
  getMenuItems(chartData) {
    return Array.from(this.views.values()).map(view => ({
      id: view.id,
      name: view.name,
      icon: view.icon,
      route: view.route,
      enabled: view.isAvailable(chartData)
    }));
  }

  // Render a view
  renderView(viewId, container, chartData, options) {
    const view = this.getView(viewId);
    return view.render(container, chartData, options);
  }
}

// Export singleton
export const viewRegistry = new ViewRegistry();
```

**Default View Registrations:**

**Roadmap View:**
```javascript
viewRegistry.register({
  id: 'roadmap',
  name: 'Roadmap',
  icon: '📊',
  route: 'roadmap',
  dataKey: 'roadmap',

  // Check if roadmap data exists
  isAvailable: (chartData) => {
    return !!(chartData?.views?.roadmap?.timeColumns?.length &&
              chartData?.views?.roadmap?.data?.length);
  },

  // Render roadmap view
  render: (container, chartData, options) => {
    const roadmapData = chartData.views?.roadmap || chartData;
    const ganttChart = new GanttChart(
      container,
      roadmapData,
      options.footerSVG || '',
      options.onTaskClick || (() => {})
    );
    ganttChart.render();
    return ganttChart;
  }
});
```

**Documents View (Placeholder):**
```javascript
viewRegistry.register({
  id: 'documents',
  name: 'Documents',
  icon: '📄',
  route: 'documents',
  dataKey: 'documents',

  isAvailable: (chartData) => {
    return !!(chartData?.views?.documents?.files?.length);
  },

  render: (container, chartData, options) => {
    // TODO: Implement DocumentViewer component
    container.innerHTML = `
      <div class="document-viewer">
        <h2>📄 Documents</h2>
        <p>Coming soon!</p>
      </div>
    `;
    return null;
  }
});
```

**Slides View (Placeholder):**
```javascript
viewRegistry.register({
  id: 'slides',
  name: 'Slides',
  icon: '📽️',
  route: 'slides',
  dataKey: 'slides',

  isAvailable: (chartData) => {
    return !!(chartData?.views?.slides?.files?.length);
  },

  render: (container, chartData, options) => {
    // TODO: Implement SlideViewer component
    container.innerHTML = `
      <div class="slide-viewer">
        <h2>📽️ Slides</h2>
        <p>Coming soon!</p>
      </div>
    `;
    return null;
  }
});
```

**Benefits:**
- Easy to add new views (just call `viewRegistry.register()`)
- Views are self-contained
- Automatic availability detection
- Data-driven navigation

**Testing:**
- [ ] Roadmap view registers correctly
- [ ] Documents/Slides placeholders work
- [ ] `isAvailable()` detects data correctly
- [ ] Menu items generated from registry

---

#### 2.2 Enhance Router

**File:** `Public/Router.js` (modify existing, ~80 lines changed)

**Current Implementation:**
```javascript
class Router {
  constructor() {
    this.routes = {
      'roadmap': () => this.showSection('roadmap')  // Hard-coded!
    };
  }

  showSection(section) {
    // Hard-coded show/hide logic
    const ganttGrid = document.querySelector('.gantt-grid');
    ganttGrid.style.display = section === 'roadmap' ? '' : 'none';
  }
}
```

**New Implementation:**
```javascript
import { viewRegistry } from './ViewRegistry.js';

class Router {
  constructor() {
    this.routes = {};
    this.currentView = null;
    this.chartData = null;
    this.viewInstances = new Map();
  }

  /**
   * Initialize router with chart data
   */
  init(chartData, options = {}) {
    this.chartData = chartData;
    this.options = options;

    // Dynamically register routes from ViewRegistry
    const views = viewRegistry.getAllViews();
    views.forEach(view => {
      this.routes[view.route] = () => this.showView(view.id);
    });

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleHashChange());

    // Handle initial route
    this.handleHashChange();
  }

  /**
   * Show a specific view
   */
  showView(viewId) {
    console.log(`🔄 Switching to view: ${viewId}`);

    // Hide all views
    this.hideAllViews();

    // Get or create view container
    const container = this.getViewContainer(viewId);

    // Render view if not already rendered
    if (!this.viewInstances.has(viewId)) {
      const viewInstance = viewRegistry.renderView(
        viewId,
        container,
        this.chartData,
        this.options
      );
      this.viewInstances.set(viewId, viewInstance);
    }

    // Show container
    container.style.display = '';
    this.currentView = viewId;

    // Update hamburger menu active state
    if (this.options.hamburgerMenu) {
      this.options.hamburgerMenu.updateActiveItem(viewId);
    }
  }

  /**
   * Hide all view containers
   */
  hideAllViews() {
    const views = viewRegistry.getAllViews();
    views.forEach(view => {
      const container = document.getElementById(`view-${view.id}`);
      if (container) {
        container.style.display = 'none';
      }
    });
  }

  /**
   * Get or create view container
   */
  getViewContainer(viewId) {
    let container = document.getElementById(`view-${viewId}`);

    if (!container) {
      container = document.createElement('div');
      container.id = `view-${viewId}`;
      container.className = 'view-container';

      // Insert into chart root
      const chartRoot = document.getElementById('chart-root');
      chartRoot.appendChild(container);
    }

    return container;
  }

  /**
   * Handle hash changes
   */
  handleHashChange() {
    const hash = window.location.hash.slice(1) || 'roadmap';

    if (this.routes[hash]) {
      this.routes[hash]();
    } else {
      console.warn(`Unknown route: ${hash}, defaulting to roadmap`);
      this.navigate('roadmap');
    }
  }

  /**
   * Navigate to a route
   */
  navigate(route) {
    window.location.hash = route;
  }
}

export { Router };
```

**Key Changes:**
1. ✅ Dynamic route registration from ViewRegistry
2. ✅ View container management (create/hide/show)
3. ✅ View instance caching (don't re-render on nav)
4. ✅ Support for route parameters (future)

**Benefits:**
- No hard-coded routes
- Easy to add new views (auto-registered)
- Better performance (cached instances)
- Clean separation of concerns

**Testing:**
- [ ] Roadmap route works
- [ ] Switching between views works
- [ ] View instances cached correctly
- [ ] Hash changes trigger navigation

---

#### 2.3 Update HamburgerMenu

**File:** `Public/HamburgerMenu.js` (modify existing, ~60 lines changed)

**Current Implementation:**
```javascript
export class HamburgerMenu {
  render() {
    // Hard-coded menu items!
    navMenu.innerHTML = `
      <ul>
        <li><a href="#roadmap">📊 Roadmap</a></li>
      </ul>
    `;
  }
}
```

**New Implementation:**
```javascript
import { viewRegistry } from './ViewRegistry.js';

export class HamburgerMenu {
  constructor(chartData) {
    this.chartData = chartData;
    this.isOpen = false;
    this.menuElement = null;
    this.currentSection = 'roadmap';
  }

  /**
   * Renders the hamburger menu with dynamic items from ViewRegistry
   */
  render() {
    const container = document.createElement('div');
    container.className = 'hamburger-menu-container';

    // Create hamburger button
    const hamburgerBtn = document.createElement('button');
    hamburgerBtn.className = 'hamburger-button';
    hamburgerBtn.innerHTML = `
      <div class="hamburger-icon">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;

    // Create navigation menu
    const navMenu = document.createElement('nav');
    navMenu.className = 'hamburger-nav';

    // Build menu items dynamically from ViewRegistry
    const menuItems = viewRegistry.getMenuItems(this.chartData);
    const menuHTML = menuItems.map(item => {
      const disabledClass = item.enabled ? '' : 'disabled';
      const disabledAttr = item.enabled ? '' : 'disabled';

      return `
        <li>
          <a href="#${item.route}"
             class="hamburger-nav-item ${disabledClass}"
             data-section="${item.id}"
             ${disabledAttr}>
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-text">${item.name}</span>
          </a>
        </li>
      `;
    }).join('');

    navMenu.innerHTML = `<ul class="hamburger-nav-list">${menuHTML}</ul>`;

    container.appendChild(hamburgerBtn);
    container.appendChild(navMenu);

    this.menuElement = container;
    this._attachEventListeners(hamburgerBtn, navMenu);

    return container;
  }

  /**
   * Update active menu item
   */
  updateActiveItem(section) {
    this.currentSection = section;

    const navItems = this.menuElement?.querySelectorAll('.hamburger-nav-item');
    if (navItems) {
      navItems.forEach(item => {
        const itemSection = item.getAttribute('data-section');
        if (itemSection === section) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
  }

  // ... existing _attachEventListeners, _toggleMenu, etc.
}
```

**Key Changes:**
1. ✅ Accept `chartData` in constructor
2. ✅ Generate menu items from `viewRegistry.getMenuItems()`
3. ✅ Disable menu items if no data available
4. ✅ Dynamic icons and labels from registry

**Benefits:**
- No hard-coded menu items
- Automatically shows/hides views based on data
- Easy to add new views (auto-appears in menu)
- Disabled state for unavailable views

**Testing:**
- [ ] Roadmap always appears (has data)
- [ ] Documents/Slides appear only if data exists
- [ ] Disabled items don't navigate
- [ ] Active state updates on navigation

---

#### 2.4 Refactor chart-renderer.js

**File:** `Public/chart-renderer.js` (modify existing, ~40 lines changed)

**Current Implementation:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // Load chart data
  const chartId = urlParams.get('id');
  await loadChartFromServer(chartId);

  // Render gantt chart (hard-coded!)
  const ganttChart = new GanttChart(container, ganttData, footerSVG, onTaskClick);
  ganttChart.render();
});
```

**New Implementation:**
```javascript
import { viewRegistry } from './ViewRegistry.js';
import { Router } from './Router.js';
import { HamburgerMenu } from './HamburgerMenu.js';

let ganttData = null;
let router = null;
let hamburgerMenu = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Load chart data from server
  const chartId = urlParams.get('id');
  if (chartId) {
    await loadChartFromServer(chartId);
  }

  if (!ganttData) {
    displayNoChartDataMessage();
    return;
  }

  // Ensure data is in v2 format (migrate if needed)
  ganttData = ensureV2FormatClient(ganttData);

  // Load footer SVG
  const footerSVG = await loadFooterSVG();

  // Initialize hamburger menu with chart data
  hamburgerMenu = new HamburgerMenu(ganttData);
  const menuElement = hamburgerMenu.render();
  document.body.insertBefore(menuElement, document.body.firstChild);

  // Initialize router with chart data and options
  router = new Router();
  router.init(ganttData, {
    footerSVG,
    onTaskClick: handleTaskClick,
    hamburgerMenu
  });
});

/**
 * Ensure client-side data is in v2 format
 * (Mirrors server-side migration logic)
 */
function ensureV2FormatClient(chartData) {
  // If already v2, return as-is
  if (chartData.version === 2 && chartData.views) {
    return chartData;
  }

  // Migrate v1 → v2
  console.log('🔄 Migrating chart data to v2 format (client-side)');

  return {
    version: 2,
    chartId: chartData.chartId,
    sessionId: chartData.sessionId,
    views: {
      roadmap: {
        timeColumns: chartData.timeColumns,
        data: chartData.data
      }
    },
    // Backward compatibility
    timeColumns: chartData.timeColumns,
    data: chartData.data
  };
}
```

**Key Changes:**
1. ✅ Import ViewRegistry and Router
2. ✅ Initialize HamburgerMenu with chartData
3. ✅ Initialize Router with chartData and options
4. ✅ Client-side v2 format migration
5. ✅ Remove hard-coded GanttChart instantiation (Router handles it)

**Benefits:**
- Data-driven rendering (Router + ViewRegistry)
- Automatic view switching
- Client-side migration for old data
- Clean initialization flow

**Testing:**
- [ ] Old chart data (v1) loads correctly
- [ ] New chart data (v2) loads correctly
- [ ] Default view (roadmap) renders
- [ ] Navigation between views works

---

### Phase 3: Document & Slide Viewers (Future) - 6-8 hours

**Note:** This phase is for future implementation. The architecture from Phases 1-2 makes this easy.

#### 3.1 Document Viewer

**File:** `Public/DocumentViewer.js` (new file, ~150 lines)

**Purpose:** Display uploaded documents (DOCX → HTML)

**Implementation:**
```javascript
export class DocumentViewer {
  constructor(container, documentData) {
    this.container = container;
    this.files = documentData.files || [];
    this.currentFileIndex = 0;
  }

  render() {
    if (this.files.length === 0) {
      this.container.innerHTML = '<p>No documents available</p>';
      return;
    }

    // Render document navigation
    const nav = this.renderNavigation();
    const content = this.renderDocument(this.currentFileIndex);

    this.container.innerHTML = '';
    this.container.appendChild(nav);
    this.container.appendChild(content);
  }

  renderNavigation() {
    // File selector, prev/next buttons
    const nav = document.createElement('div');
    nav.className = 'document-nav';

    const select = document.createElement('select');
    this.files.forEach((file, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = file.name;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      this.currentFileIndex = parseInt(e.target.value);
      this.render();
    });

    nav.appendChild(select);
    return nav;
  }

  renderDocument(index) {
    const file = this.files[index];
    const contentDiv = document.createElement('div');
    contentDiv.className = 'document-content';

    // Sanitize and render HTML
    contentDiv.innerHTML = DOMPurify.sanitize(file.html);

    return contentDiv;
  }
}
```

**Register in ViewRegistry:**
```javascript
import { DocumentViewer } from './DocumentViewer.js';

viewRegistry.register({
  id: 'documents',
  name: 'Documents',
  icon: '📄',
  route: 'documents',
  dataKey: 'documents',
  component: DocumentViewer,

  isAvailable: (chartData) => {
    return !!(chartData?.views?.documents?.files?.length);
  },

  render: (container, chartData, options) => {
    const documentData = chartData.views.documents;
    const viewer = new DocumentViewer(container, documentData);
    viewer.render();
    return viewer;
  }
});
```

**Backend Changes Needed:**
- Store parsed DOCX HTML in chart data
- Update file upload processing to preserve document HTML

---

#### 3.2 Slide Viewer

**File:** `Public/SlideViewer.js` (new file, ~200 lines)

**Purpose:** Display presentation slides

**Implementation:**
```javascript
export class SlideViewer {
  constructor(container, slideData) {
    this.container = container;
    this.files = slideData.files || [];
    this.currentFileIndex = 0;
    this.currentSlideIndex = 0;
  }

  render() {
    // Render slide navigation (file selector, slide thumbnails)
    // Render current slide (full screen or preview)
    // Render controls (prev/next, fullscreen)
  }

  nextSlide() {
    // Navigate to next slide
  }

  prevSlide() {
    // Navigate to previous slide
  }
}
```

**Register in ViewRegistry:**
```javascript
import { SlideViewer } from './SlideViewer.js';

viewRegistry.register({
  id: 'slides',
  name: 'Slides',
  icon: '📽️',
  route: 'slides',
  dataKey: 'slides',
  component: SlideViewer,

  isAvailable: (chartData) => {
    return !!(chartData?.views?.slides?.files?.length);
  },

  render: (container, chartData, options) => {
    const slideData = chartData.views.slides;
    const viewer = new SlideViewer(container, slideData);
    viewer.render();
    return viewer;
  }
});
```

**Backend Changes Needed:**
- Add PPTX parser (e.g., `pptx2json`)
- Extract slides as images or structured data
- Store in chart data

---

## Testing Strategy

### Backward Compatibility Tests

**Critical Tests (Must Pass):**
```javascript
// Test 1: Old chart data still works
test('v1 chart data renders Gantt chart', async () => {
  const oldChartData = {
    timeColumns: ['Q1 2025', 'Q2 2025'],
    data: [{ taskName: 'Task 1', ... }],
    sessionId: 'abc123',
    chartId: 'xyz789'
  };

  // Store old data
  const chartId = storeChart(oldChartData, 'abc123');

  // Retrieve and verify migration
  const retrieved = getChart(chartId);
  expect(retrieved.data.version).toBe(2);
  expect(retrieved.data.timeColumns).toEqual(oldChartData.timeColumns);
  expect(retrieved.data.data).toEqual(oldChartData.data);
});

// Test 2: Old API consumers still work
test('API response includes root-level timeColumns/data', async () => {
  const response = await fetch('/chart/xyz789');
  const data = await response.json();

  // Old clients expect these at root
  expect(data.timeColumns).toBeDefined();
  expect(data.data).toBeDefined();

  // New clients can use views
  expect(data.views.roadmap).toBeDefined();
});

// Test 3: Existing Gantt chart rendering unchanged
test('Gantt chart renders with v2 data', () => {
  const v2Data = {
    version: 2,
    views: {
      roadmap: {
        timeColumns: [...],
        data: [...]
      }
    },
    timeColumns: [...],
    data: [...]
  };

  const gantt = new GanttChart(container, v2Data, '', () => {});
  gantt.render();

  // Verify chart rendered
  expect(container.querySelector('.gantt-grid')).toBeTruthy();
});
```

### Integration Tests

```javascript
// Test: Multi-view navigation
test('switching views works', () => {
  const router = new Router();
  router.init(chartDataWithMultipleViews, {});

  // Start on roadmap
  expect(router.currentView).toBe('roadmap');

  // Navigate to documents
  router.navigate('documents');
  expect(router.currentView).toBe('documents');

  // Navigate back to roadmap
  router.navigate('roadmap');
  expect(router.currentView).toBe('roadmap');
});

// Test: Menu items reflect data availability
test('menu shows only available views', () => {
  const chartData = {
    version: 2,
    views: {
      roadmap: { timeColumns: [...], data: [...] }
      // No documents or slides
    }
  };

  const menu = new HamburgerMenu(chartData);
  const menuItems = viewRegistry.getMenuItems(chartData);

  expect(menuItems.find(item => item.id === 'roadmap').enabled).toBe(true);
  expect(menuItems.find(item => item.id === 'documents').enabled).toBe(false);
  expect(menuItems.find(item => item.id === 'slides').enabled).toBe(false);
});
```

---

## Migration Path for Existing Charts

### Automatic Migration on Access

All existing charts will be automatically migrated when accessed:

```
User Request: GET /chart/abc123
    ↓
Server: getChart('abc123')
    ↓
Storage detects v1 format
    ↓
ensureV2Format() migrates data
    ↓
Storage updates cached data to v2
    ↓
createAPIResponse() adds backward compat fields
    ↓
Response sent with both v1 and v2 fields
    ↓
Old clients read timeColumns/data (root level)
New clients read views.roadmap
```

**Key Points:**
- ✅ Zero downtime
- ✅ No manual migration scripts
- ✅ Lazy migration (on-demand)
- ✅ Old clients unaffected

---

## Rollout Strategy

### Stage 1: Backend Foundation (Low Risk)
**Deploy:** Data model + storage updates
**Impact:** None (backward compatible)
**Rollback:** Easy (no breaking changes)

**Verification:**
- Old charts still load
- New charts created in v2 format
- API responses include both formats

---

### Stage 2: Frontend ViewRegistry (Medium Risk)
**Deploy:** ViewRegistry + Router + HamburgerMenu
**Impact:** UI changes (new menu structure)
**Rollback:** Moderate (requires code revert)

**Verification:**
- Roadmap view works identically
- Menu shows only roadmap (documents/slides disabled)
- Navigation works

---

### Stage 3: Document/Slide Viewers (Low Risk)
**Deploy:** DocumentViewer + SlideViewer components
**Impact:** New features only (no existing feature changes)
**Rollback:** Easy (just disable in registry)

**Verification:**
- Documents view works when data present
- Slides view works when data present
- Roadmap unaffected

---

## Performance Considerations

### View Instance Caching
**Problem:** Re-rendering views on every navigation is expensive

**Solution:** Router caches view instances
```javascript
// First visit to roadmap
router.showView('roadmap');  // Creates GanttChart instance

// Navigate away
router.showView('documents');  // Hides roadmap, shows documents

// Navigate back to roadmap
router.showView('roadmap');  // Reuses cached GanttChart instance (no re-render)
```

**Benefit:**
- Faster navigation (no re-render)
- Preserves view state (scroll position, etc.)

---

### Lazy Loading (Future Optimization)
```javascript
// Instead of importing all views upfront:
import { GanttChart } from './GanttChart.js';
import { DocumentViewer } from './DocumentViewer.js';
import { SlideViewer } from './SlideViewer.js';

// Use dynamic imports:
render: async (container, chartData, options) => {
  const { DocumentViewer } = await import('./DocumentViewer.js');
  const viewer = new DocumentViewer(container, chartData.views.documents);
  viewer.render();
  return viewer;
}
```

**Benefit:**
- Smaller initial bundle size
- Faster page load
- Only load what's needed

---

## File Structure After Implementation

```
force/
├── Public/
│   ├── main.js                 (unchanged)
│   ├── chart-renderer.js       (modified - uses ViewRegistry)
│   ├── Router.js               (modified - dynamic routes)
│   ├── HamburgerMenu.js        (modified - data-driven)
│   ├── GanttChart.js           (unchanged)
│   ├── ViewRegistry.js         (NEW - view management)
│   ├── DocumentViewer.js       (NEW - future)
│   ├── SlideViewer.js          (NEW - future)
│   ├── TaskAnalyzer.js         (unchanged)
│   ├── ChatInterface.js        (unchanged)
│   └── Utils.js                (unchanged)
│
├── server/
│   ├── config.js               (unchanged)
│   ├── database.js             (unchanged)
│   ├── storage.js              (modified - auto-migration)
│   ├── dataModel.js            (NEW - multi-view data)
│   ├── gemini.js               (unchanged)
│   ├── prompts.js              (unchanged)
│   ├── middleware.js           (unchanged)
│   ├── utils.js                (unchanged)
│   └── routes/
│       ├── charts.js           (modified - v2 API responses)
│       ├── analysis.js         (unchanged)
│       └── analytics.js        (unchanged)
│
└── server.js                   (unchanged)
```

**Summary:**
- ✅ 2 new files (Public/ViewRegistry.js, server/dataModel.js)
- ✅ 4 modified files (Router.js, HamburgerMenu.js, chart-renderer.js, storage.js, charts.js)
- ✅ All other files unchanged (GanttChart.js, main.js, etc.)

---

## Success Criteria

### Must Have (Phase 1 & 2)
- [ ] All existing charts load and display correctly
- [ ] Old chart data (v1) automatically migrates to v2
- [ ] API returns backward-compatible responses
- [ ] Gantt chart functionality unchanged
- [ ] ViewRegistry manages roadmap view
- [ ] Router supports dynamic routes
- [ ] HamburgerMenu is data-driven
- [ ] Zero breaking changes

### Nice to Have (Phase 3)
- [ ] Document viewer displays DOCX files
- [ ] Slide viewer displays presentations
- [ ] Views appear/disappear based on data
- [ ] Smooth navigation between views

---

## Risk Assessment

### High Risk (Mitigated)
**Risk:** Breaking existing Gantt chart functionality
**Mitigation:**
- Gantt chart code completely unchanged
- Backward compatibility enforced in data model
- Comprehensive testing of old charts
- Progressive enhancement (new code doesn't touch old paths)

### Medium Risk
**Risk:** Performance degradation from view management
**Mitigation:**
- View instance caching (no re-renders)
- Lazy loading (future optimization)
- Minimal overhead (simple Map lookups)

### Low Risk
**Risk:** Migration errors in data transformation
**Mitigation:**
- Extensive validation in `ensureV2Format()`
- Error logging and monitoring
- Fallback to v1 if migration fails
- Automatic migration on read (not write)

---

## Estimated Timeline

### Phase 1: Backend Foundation
- Create dataModel.js: **1 hour**
- Update storage.js: **30 minutes**
- Update charts.js API: **30 minutes**
- Testing: **1 hour**
**Total: 3 hours**

### Phase 2: Frontend ViewRegistry
- Create ViewRegistry.js: **1.5 hours**
- Update Router.js: **1.5 hours**
- Update HamburgerMenu.js: **1 hour**
- Update chart-renderer.js: **30 minutes**
- Testing: **1.5 hours**
**Total: 6 hours**

### Phase 3: Document/Slide Viewers (Future)
- DocumentViewer.js: **3 hours**
- SlideViewer.js: **4 hours**
- Backend DOCX/PPTX parsing: **2 hours**
- Testing: **2 hours**
**Total: 11 hours**

**Grand Total: 20 hours (Phases 1-3)**
**Core Architecture (Phases 1-2): 9 hours**

---

## Conclusion

This architectural upgrade provides a solid foundation for scaling the application to support multiple view types while maintaining 100% backward compatibility with existing functionality.

**Key Benefits:**
1. **Scalability** - Easy to add new views (Documents, Slides, etc.)
2. **Maintainability** - Clean separation of concerns, data-driven architecture
3. **Backward Compatibility** - Zero breaking changes, automatic migration
4. **Future-Proof** - Extensible design ready for new features
5. **Performance** - View caching, lazy loading potential

**Next Steps:**
1. Review and approve this plan
2. Implement Phase 1 (backend foundation)
3. Test backward compatibility thoroughly
4. Implement Phase 2 (frontend ViewRegistry)
5. Test multi-view navigation
6. (Future) Implement Phase 3 (Document/Slide viewers)

**Questions to Consider:**
- Do you want to implement all phases at once or incrementally?
- Are there any other view types you'd like to support?
- Do you have specific requirements for document/slide viewing?
- Should we add route parameters (e.g., `/chart.html?id=123&view=documents&file=0`)?
