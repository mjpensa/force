# Research QA Tabbed Interface - Implementation Plan

**Version:** 1.0
**Date:** 2025-11-26
**Based on:** RESEARCH_QA_TABBED_INTERFACE_DESIGN_SPEC.md v2.0
**Estimated Duration:** 7 working days

---

## Table of Contents

1. [Pre-Implementation Checklist](#phase-0-pre-implementation-checklist)
2. [Phase 1: Foundation & CSS Reset](#phase-1-foundation--css-reset)
3. [Phase 2: Header Component](#phase-2-header-component)
4. [Phase 3: Tab Navigation System](#phase-3-tab-navigation-system)
5. [Phase 4: Overview Tab](#phase-4-overview-tab)
6. [Phase 5: Themes Tab](#phase-5-themes-tab)
7. [Phase 6: Data Quality Tab](#phase-6-data-quality-tab)
8. [Phase 7: Actions Tab](#phase-7-actions-tab)
9. [Phase 8: Responsive & Accessibility](#phase-8-responsive--accessibility)
10. [Phase 9: Testing & Polish](#phase-9-testing--polish)
11. [Rollback Plan](#rollback-plan)

---

## Phase 0: Pre-Implementation Checklist

### 0.1 Backup Current Implementation

```bash
# Create backup branch
git checkout -b backup/research-qa-v1-$(date +%Y%m%d)
git push origin backup/research-qa-v1-$(date +%Y%m%d)

# Return to feature branch
git checkout claude/redesign-qa-screen-cards-0145KwG7aReygjyz28CWoZvp
```

### 0.2 Files to Modify

| File | Action | Backup Required |
|------|--------|-----------------|
| `Public/styles/analysis-view.css` | Full rewrite | Yes |
| `Public/components/views/ResearchAnalysisView.js` | Major refactor | Yes |
| `Public/styles/design-system.css` | Minor additions | No |

### 0.3 Dependencies Check

- [ ] Verify no other components depend on `analysis-view.css` classes
- [ ] Check for any inline styles in `ResearchAnalysisView.js`
- [ ] Identify any external CSS that might conflict

### 0.4 Create Feature Flag (Optional)

```javascript
// In config or feature flags file
const FEATURES = {
  USE_TABBED_RESEARCH_QA: false  // Toggle for gradual rollout
};
```

---

## Phase 1: Foundation & CSS Reset

**Duration:** ~2 hours
**Files:** `analysis-view.css`

### Step 1.1: Create New CSS File Structure

Replace the entire contents of `analysis-view.css` with the new foundation:

```css
/**
 * Research QA View Styles - v2.0 Tabbed Interface
 * Based on RESEARCH_QA_TABBED_INTERFACE_DESIGN_SPEC.md
 */

/* ========== ENHANCED GLASS VARIABLES ========== */

.research-analysis-view {
  /* Override base glass values for better readability */
  --glass-enhanced-bg: rgba(255, 255, 255, 0.15);
  --glass-enhanced-bg-hover: rgba(255, 255, 255, 0.18);
  --glass-enhanced-border: rgba(255, 255, 255, 0.20);
  --glass-enhanced-border-hover: rgba(255, 255, 255, 0.25);

  /* Enhanced text contrast */
  --text-primary: #FFFFFF;
  --text-secondary: rgba(255, 255, 255, 0.88);
  --text-muted: rgba(255, 255, 255, 0.72);
}

/* ========== SINGLE ENTRANCE ANIMATION ========== */

@keyframes viewFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes tabFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ========== PAGE CONTAINER ========== */

.research-analysis-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-8);
  min-height: calc(100vh - var(--header-height, 64px));

  /* Single entrance animation - NO staggered children */
  animation: viewFadeIn 0.4s ease-out forwards;
}
```

### Step 1.2: Remove All Problematic Animations

Delete these keyframes entirely:
- `@keyframes glassFadeSlideUp`
- `@keyframes scoreShine`
- `@keyframes barShine`
- `@keyframes pulse`
- `@keyframes emptyIconPulse`

Delete all staggered animation delays:
```css
/* DELETE ALL OF THESE */
.analysis-main-content > *:nth-child(1) { animation-delay: 0.15s; }
.analysis-main-content > *:nth-child(2) { animation-delay: 0.20s; }
/* ... etc */
```

### Step 1.3: Verification

- [ ] Page loads without animation errors
- [ ] No console warnings about missing keyframes
- [ ] Basic layout still functional

---

## Phase 2: Header Component

**Duration:** ~2 hours
**Files:** `analysis-view.css`, `ResearchAnalysisView.js`

### Step 2.1: Update Header CSS

```css
/* ========== HEADER ========== */

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-8);
  padding: var(--spacing-8);
  margin-bottom: var(--spacing-6);

  /* Enhanced glass - HIGHER OPACITY */
  background: var(--glass-enhanced-bg);
  backdrop-filter: blur(var(--blur-xl));
  -webkit-backdrop-filter: blur(var(--blur-xl));

  /* Visible border */
  border: 1px solid var(--glass-enhanced-border);
  border-radius: var(--radius-glass-xl);

  /* Shadow */
  box-shadow: var(--shadow-glass-3);
}

/* REMOVE the ::before gradient overlay */

.analysis-title-section {
  flex: 1;
}

.analysis-title {
  font-size: var(--text-3xl);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-3) 0;
  letter-spacing: -0.01em;
}

.analysis-timestamp {
  font-size: var(--text-base);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

/* Static indicator - NO ANIMATION */
.analysis-timestamp::before {
  content: '';
  width: 8px;
  height: 8px;
  background: var(--color-glass-success);
  border-radius: 50%;
  /* NO animation property */
}

/* Score Section with Visual Bar */
.analysis-score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  min-width: 160px;
}

.score-badge {
  padding: var(--spacing-5) var(--spacing-6);
  background: var(--glass-enhanced-bg);
  border: 2px solid;
  border-radius: var(--radius-glass-lg);
  text-align: center;
  position: relative;
  overflow: hidden;
  /* NO ::before shine animation */
}

/* REMOVE .score-badge::before entirely */

.score-badge .score-value {
  font-size: var(--text-4xl);
  font-weight: var(--weight-bold);
  color: var(--text-primary);
  line-height: 1;
}

.score-badge .score-max {
  font-size: var(--text-lg);
  color: var(--text-muted);
}

/* Score bar (new component) */
.score-bar {
  width: 100%;
  height: 8px;
  background: var(--glass-white-10);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s ease-out;
  /* NO ::after shine animation */
}

.score-rating-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Score tier colors - STATIC, no glow animations */
.score-badge.score-excellent {
  border-color: rgba(80, 175, 123, 0.60);
  background: rgba(80, 175, 123, 0.20);
}
.score-excellent .score-bar-fill { background: #50AF7B; }
.score-excellent .score-rating-label { color: #50AF7B; }

.score-badge.score-good {
  border-color: rgba(132, 204, 22, 0.60);
  background: rgba(132, 204, 22, 0.20);
}
.score-good .score-bar-fill { background: #84cc16; }
.score-good .score-rating-label { color: #84cc16; }

.score-badge.score-adequate {
  border-color: rgba(234, 179, 8, 0.60);
  background: rgba(234, 179, 8, 0.20);
}
.score-adequate .score-bar-fill { background: #eab308; }
.score-adequate .score-rating-label { color: #eab308; }

.score-badge.score-poor {
  border-color: rgba(249, 115, 22, 0.60);
  background: rgba(249, 115, 22, 0.20);
}
.score-poor .score-bar-fill { background: #f97316; }
.score-poor .score-rating-label { color: #f97316; }

.score-badge.score-inadequate {
  border-color: rgba(239, 68, 68, 0.60);
  background: rgba(239, 68, 68, 0.20);
}
.score-inadequate .score-bar-fill { background: #ef4444; }
.score-inadequate .score-rating-label { color: #ef4444; }
```

### Step 2.2: Update Header JavaScript

Modify `_renderHeader()` in `ResearchAnalysisView.js`:

```javascript
_renderHeader() {
  const header = document.createElement('div');
  header.className = 'analysis-header';

  // Title section
  const titleSection = document.createElement('div');
  titleSection.className = 'analysis-title-section';

  const title = document.createElement('h1');
  title.className = 'analysis-title';
  title.textContent = this.analysisData.title || 'Research Quality Analysis';
  titleSection.appendChild(title);

  if (this.analysisData.generatedAt) {
    const timestamp = document.createElement('span');
    timestamp.className = 'analysis-timestamp';
    timestamp.textContent = `Generated: ${new Date(this.analysisData.generatedAt).toLocaleString()}`;
    titleSection.appendChild(timestamp);
  }

  header.appendChild(titleSection);

  // Score section with bar
  const scoreSection = document.createElement('div');
  scoreSection.className = 'analysis-score-section';

  const rating = this.analysisData.overallRating || this._scoreToRating(this.analysisData.overallScore);
  const ratingClass = `score-${rating}`;

  // Score badge
  const scoreBadge = document.createElement('div');
  scoreBadge.className = `score-badge size-large ${ratingClass}`;
  scoreBadge.setAttribute('role', 'img');
  scoreBadge.setAttribute('aria-label', `Score: ${this.analysisData.overallScore} out of 10, rated ${rating}`);
  scoreBadge.innerHTML = `
    <span class="score-value">${this.analysisData.overallScore}</span>
    <span class="score-max">/10</span>
  `;
  scoreSection.appendChild(scoreBadge);

  // Score bar (visual representation)
  const scoreBar = document.createElement('div');
  scoreBar.className = 'score-bar';
  const scoreBarFill = document.createElement('div');
  scoreBarFill.className = 'score-bar-fill';
  scoreBarFill.style.width = `${(this.analysisData.overallScore / 10) * 100}%`;
  scoreBar.appendChild(scoreBarFill);
  scoreSection.appendChild(scoreBar);

  // Rating label
  const ratingLabel = document.createElement('span');
  ratingLabel.className = `score-rating-label ${ratingClass}`;
  ratingLabel.textContent = this._formatQuality(rating);
  scoreSection.appendChild(ratingLabel);

  header.appendChild(scoreSection);

  return header;
}
```

### Step 2.3: Verification

- [ ] Header displays correctly
- [ ] Score badge shows without shimmer animation
- [ ] Score bar renders and fills correctly
- [ ] Timestamp has static green dot (no pulse)
- [ ] Rating label shows correct color

---

## Phase 3: Tab Navigation System

**Duration:** ~3 hours
**Files:** `analysis-view.css`, `ResearchAnalysisView.js`

### Step 3.1: Add Tab Navigation CSS

```css
/* ========== TAB NAVIGATION ========== */

.tab-navigation {
  display: flex;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  margin-bottom: var(--spacing-6);

  background: var(--glass-white-10);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);
}

.tab-button {
  appearance: none;
  border: none;
  background: transparent;
  cursor: pointer;

  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-5);

  font-family: inherit;
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--text-secondary);

  border-radius: var(--radius-glass-md);
  position: relative;

  transition: background-color 0.15s ease, color 0.15s ease;
}

.tab-button:hover:not(.tab-button--active) {
  background: var(--glass-white-10);
  color: var(--text-primary);
}

.tab-button--active {
  background: var(--glass-enhanced-bg);
  color: var(--text-primary);
  font-weight: var(--weight-semibold);
}

.tab-button--active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: var(--spacing-3);
  right: var(--spacing-3);
  height: 3px;
  background: var(--color-glass-success);
  border-radius: var(--radius-full);
}

.tab-button:focus-visible {
  outline: 3px solid var(--color-glass-success);
  outline-offset: 2px;
}

.tab-button__icon {
  font-size: var(--text-lg);
  line-height: 1;
}

.tab-button__badge {
  background: var(--glass-white-15);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  margin-left: var(--spacing-2);
}

.tab-button--active .tab-button__badge {
  background: rgba(80, 175, 123, 0.20);
  color: var(--color-glass-success);
}

/* ========== TAB CONTENT ========== */

.tab-content-container {
  min-height: 400px;
  position: relative;
}

.tab-panel {
  display: none;
  opacity: 0;
}

.tab-panel--active {
  display: block;
  animation: tabFadeIn 0.2s ease-out forwards;
}
```

### Step 3.2: Add Tab Navigation JavaScript

Add new methods to `ResearchAnalysisView.js`:

```javascript
// Add to constructor
constructor(analysisData = null, sessionId = null) {
  this.analysisData = analysisData;
  this.sessionId = sessionId;
  this.container = null;
  this.activeTab = 'overview';
  this.expandedThemes = new Set();

  // Initialize all themes as expanded by default
  if (analysisData?.themes) {
    analysisData.themes.forEach((_, index) => {
      this.expandedThemes.add(index);
    });
  }
}

// Tab definitions
_getTabConfig() {
  return [
    { id: 'overview', icon: '📋', label: 'Overview' },
    { id: 'themes', icon: '🏷️', label: 'Themes', badge: this.analysisData?.themes?.length },
    { id: 'data-quality', icon: '📊', label: 'Data Quality' },
    { id: 'actions', icon: '✅', label: 'Actions', badge: this.analysisData?.actionItems?.length }
  ];
}

// Render tab navigation
_renderTabNavigation() {
  const nav = document.createElement('div');
  nav.className = 'tab-navigation';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Research analysis sections');

  const tabs = this._getTabConfig();

  tabs.forEach((tab, index) => {
    const button = document.createElement('button');
    button.className = `tab-button ${tab.id === this.activeTab ? 'tab-button--active' : ''}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', tab.id === this.activeTab ? 'true' : 'false');
    button.setAttribute('aria-controls', `panel-${tab.id}`);
    button.setAttribute('id', `tab-${tab.id}`);
    button.setAttribute('tabindex', tab.id === this.activeTab ? '0' : '-1');
    button.dataset.tab = tab.id;

    button.innerHTML = `
      <span class="tab-button__icon">${tab.icon}</span>
      <span class="tab-button__label">${tab.label}</span>
      ${tab.badge ? `<span class="tab-button__badge">${tab.badge}</span>` : ''}
    `;

    button.addEventListener('click', () => this._switchTab(tab.id));

    nav.appendChild(button);
  });

  // Keyboard navigation
  nav.addEventListener('keydown', (e) => this._handleTabKeydown(e));

  return nav;
}

// Render tab content container
_renderTabContent() {
  const container = document.createElement('div');
  container.className = 'tab-content-container';

  // Overview panel
  const overviewPanel = this._renderOverviewTab();
  overviewPanel.id = 'panel-overview';
  overviewPanel.className = `tab-panel ${this.activeTab === 'overview' ? 'tab-panel--active' : ''}`;
  overviewPanel.setAttribute('role', 'tabpanel');
  overviewPanel.setAttribute('aria-labelledby', 'tab-overview');
  overviewPanel.setAttribute('tabindex', '0');
  overviewPanel.hidden = this.activeTab !== 'overview';
  container.appendChild(overviewPanel);

  // Themes panel
  const themesPanel = this._renderThemesTab();
  themesPanel.id = 'panel-themes';
  themesPanel.className = `tab-panel ${this.activeTab === 'themes' ? 'tab-panel--active' : ''}`;
  themesPanel.setAttribute('role', 'tabpanel');
  themesPanel.setAttribute('aria-labelledby', 'tab-themes');
  themesPanel.setAttribute('tabindex', '0');
  themesPanel.hidden = this.activeTab !== 'themes';
  container.appendChild(themesPanel);

  // Data Quality panel
  const dataPanel = this._renderDataQualityTab();
  dataPanel.id = 'panel-data-quality';
  dataPanel.className = `tab-panel ${this.activeTab === 'data-quality' ? 'tab-panel--active' : ''}`;
  dataPanel.setAttribute('role', 'tabpanel');
  dataPanel.setAttribute('aria-labelledby', 'tab-data-quality');
  dataPanel.setAttribute('tabindex', '0');
  dataPanel.hidden = this.activeTab !== 'data-quality';
  container.appendChild(dataPanel);

  // Actions panel
  const actionsPanel = this._renderActionsTab();
  actionsPanel.id = 'panel-actions';
  actionsPanel.className = `tab-panel ${this.activeTab === 'actions' ? 'tab-panel--active' : ''}`;
  actionsPanel.setAttribute('role', 'tabpanel');
  actionsPanel.setAttribute('aria-labelledby', 'tab-actions');
  actionsPanel.setAttribute('tabindex', '0');
  actionsPanel.hidden = this.activeTab !== 'actions';
  container.appendChild(actionsPanel);

  return container;
}

// Switch tabs
_switchTab(tabId) {
  if (this.activeTab === tabId) return;

  this.activeTab = tabId;

  // Update tab buttons
  this.container.querySelectorAll('.tab-button').forEach(btn => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('tab-button--active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  // Update tab panels
  this.container.querySelectorAll('.tab-panel').forEach(panel => {
    const panelId = panel.id.replace('panel-', '');
    const isActive = panelId === tabId;
    panel.classList.toggle('tab-panel--active', isActive);
    panel.hidden = !isActive;
  });

  // Update URL hash
  if (history.replaceState) {
    history.replaceState(null, '', `#${tabId}`);
  }
}

// Keyboard navigation for tabs
_handleTabKeydown(e) {
  const tabs = this._getTabConfig();
  const currentIndex = tabs.findIndex(t => t.id === this.activeTab);
  let newIndex = currentIndex;

  switch (e.key) {
    case 'ArrowLeft':
      newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      break;
    case 'ArrowRight':
      newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      break;
    case 'Home':
      newIndex = 0;
      break;
    case 'End':
      newIndex = tabs.length - 1;
      break;
    default:
      return;
  }

  e.preventDefault();
  const newTab = tabs[newIndex];
  this._switchTab(newTab.id);

  // Focus the new tab button
  const newButton = this.container.querySelector(`[data-tab="${newTab.id}"]`);
  if (newButton) newButton.focus();
}
```

### Step 3.3: Update Main Render Method

```javascript
render() {
  this.container = document.createElement('div');
  this.container.className = 'research-analysis-view';

  if (!this.analysisData) {
    this.container.appendChild(this._renderEmptyState());
    return this.container;
  }

  // Check URL hash for initial tab
  const hash = window.location.hash.replace('#', '');
  if (['overview', 'themes', 'data-quality', 'actions'].includes(hash)) {
    this.activeTab = hash;
  }

  // Render structure
  this.container.appendChild(this._renderHeader());
  this.container.appendChild(this._renderTabNavigation());
  this.container.appendChild(this._renderTabContent());

  return this.container;
}
```

### Step 3.4: Verification

- [ ] Four tabs display correctly
- [ ] Active tab is highlighted with green underline
- [ ] Clicking tabs switches content
- [ ] Arrow keys navigate between tabs
- [ ] URL hash updates on tab switch
- [ ] Direct URL with hash loads correct tab

---

## Phase 4: Overview Tab

**Duration:** ~3 hours
**Files:** `analysis-view.css`, `ResearchAnalysisView.js`

### Step 4.1: Add Overview Tab CSS

```css
/* ========== OVERVIEW TAB ========== */

/* Readiness Banner */
.readiness-banner {
  padding: var(--spacing-6);
  margin-bottom: var(--spacing-6);

  background: var(--glass-enhanced-bg);
  border: 1px solid var(--glass-enhanced-border);
  border-radius: var(--radius-glass-xl);
  border-left: 5px solid;
}

.readiness-banner--ready {
  border-left-color: var(--color-glass-success);
  background: rgba(80, 175, 123, 0.12);
}

.readiness-banner--needs-improvement {
  border-left-color: #eab308;
  background: rgba(234, 179, 8, 0.12);
}

.readiness-banner--insufficient {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
}

.readiness-banner__status {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.readiness-banner__icon {
  font-size: var(--text-2xl);
}

.readiness-banner__title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.readiness-banner__subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: var(--spacing-2) 0 0 0;
}

.readiness-progress {
  margin-top: var(--spacing-4);
}

.readiness-progress__track {
  height: 12px;
  background: var(--glass-white-10);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.readiness-progress__fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s ease-out;
}

.readiness-progress__label {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text-secondary);
}

/* Overview Section Card */
.overview-section {
  padding: var(--spacing-6);
  margin-bottom: var(--spacing-5);

  background: var(--glass-enhanced-bg);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);
}

.overview-section__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

.overview-section__content {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--text-secondary);
}

/* Key Findings List */
.key-findings-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.key-findings-list li {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-3) 0;
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
}

.key-findings-list li::before {
  content: '';
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  margin-top: 6px;
  background: var(--color-glass-success);
  border-radius: 50%;
}

/* Critical Gaps Alert */
.critical-gaps-alert {
  padding: var(--spacing-5);
  margin-bottom: var(--spacing-5);

  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.30);
  border-left: 5px solid #ef4444;
  border-radius: var(--radius-glass-lg);
}

.critical-gaps-alert__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.critical-gaps-alert__icon {
  font-size: var(--text-xl);
}

.critical-gaps-alert__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.critical-gaps-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.critical-gaps-list li {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-2) 0;
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.critical-gaps-list li::before {
  content: '!';
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  background: rgba(239, 68, 68, 0.20);
  border: 1px solid rgba(239, 68, 68, 0.40);
  border-radius: 50%;
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: #f87171;
}

/* Quick Stats Grid */
.quick-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-4);
}

.quick-stat-card {
  padding: var(--spacing-5);
  text-align: center;

  background: var(--glass-enhanced-bg);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);

  /* Simple hover - NO transform */
  transition: background-color 0.15s ease;
}

.quick-stat-card:hover {
  background: var(--glass-enhanced-bg-hover);
}

.quick-stat-card__value {
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  color: var(--text-primary);
  line-height: 1.2;
}

.quick-stat-card__label {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: var(--spacing-2);
}
```

### Step 4.2: Add Overview Tab JavaScript

```javascript
_renderOverviewTab() {
  const panel = document.createElement('div');

  // Readiness Banner
  if (this.analysisData.ganttReadiness) {
    panel.appendChild(this._renderReadinessBanner());
  }

  // Executive Summary
  if (this.analysisData.summary) {
    panel.appendChild(this._renderExecutiveSummary());
  }

  // Key Findings
  if (this.analysisData.keyFindings?.length > 0) {
    panel.appendChild(this._renderKeyFindings());
  }

  // Critical Gaps
  if (this.analysisData.criticalGaps?.length > 0) {
    panel.appendChild(this._renderCriticalGapsAlert());
  }

  // Quick Stats
  panel.appendChild(this._renderQuickStats());

  return panel;
}

_renderReadinessBanner() {
  const readiness = this.analysisData.ganttReadiness;
  const verdictClass = `readiness-banner--${readiness.readinessVerdict}`;

  const banner = document.createElement('div');
  banner.className = `readiness-banner ${verdictClass}`;

  const icon = this._getVerdictIcon(readiness.readinessVerdict);
  const title = this._getVerdictText(readiness.readinessVerdict);
  const percent = Math.round((readiness.readyThemes / readiness.totalThemes) * 100);

  banner.innerHTML = `
    <div class="readiness-banner__status">
      <span class="readiness-banner__icon">${icon}</span>
      <h2 class="readiness-banner__title">${title.toUpperCase()}</h2>
    </div>
    <p class="readiness-banner__subtitle">
      ${readiness.readyThemes} of ${readiness.totalThemes} themes ready for Gantt chart
    </p>
    <div class="readiness-progress">
      <div class="readiness-progress__track">
        <div class="readiness-progress__fill" style="width: ${percent}%; background: ${this._getVerdictColor(readiness.readinessVerdict)};"></div>
      </div>
      <div class="readiness-progress__label">${percent}% Ready</div>
    </div>
  `;

  return banner;
}

_getVerdictColor(verdict) {
  const colors = {
    'ready': '#50AF7B',
    'needs-improvement': '#eab308',
    'insufficient': '#ef4444'
  };
  return colors[verdict] || '#eab308';
}

_renderExecutiveSummary() {
  const section = document.createElement('div');
  section.className = 'overview-section';
  section.innerHTML = `
    <h3 class="overview-section__title">Executive Summary</h3>
    <p class="overview-section__content">${this._escapeHtml(this.analysisData.summary)}</p>
  `;
  return section;
}

_renderKeyFindings() {
  const section = document.createElement('div');
  section.className = 'overview-section';

  const listItems = this.analysisData.keyFindings
    .map(finding => `<li>${this._escapeHtml(finding)}</li>`)
    .join('');

  section.innerHTML = `
    <h3 class="overview-section__title">Key Findings</h3>
    <ul class="key-findings-list">${listItems}</ul>
  `;
  return section;
}

_renderCriticalGapsAlert() {
  const alert = document.createElement('div');
  alert.className = 'critical-gaps-alert';

  const listItems = this.analysisData.criticalGaps
    .map(gap => `<li>${this._escapeHtml(gap)}</li>`)
    .join('');

  alert.innerHTML = `
    <div class="critical-gaps-alert__header">
      <span class="critical-gaps-alert__icon">⚠️</span>
      <h3 class="critical-gaps-alert__title">Critical Gaps</h3>
    </div>
    <ul class="critical-gaps-list">${listItems}</ul>
  `;
  return alert;
}

_renderQuickStats() {
  const grid = document.createElement('div');
  grid.className = 'quick-stats-grid';

  const readiness = this.analysisData.ganttReadiness || {};

  const stats = [
    { value: readiness.estimatedTasks || '—', label: 'Estimated Tasks' },
    { value: readiness.totalThemes || '—', label: 'Themes Analyzed' },
    { value: this._formatInterval(readiness.recommendedTimeInterval) || '—', label: 'Recommended Interval' }
  ];

  stats.forEach(stat => {
    const card = document.createElement('div');
    card.className = 'quick-stat-card';
    card.innerHTML = `
      <div class="quick-stat-card__value">${stat.value}</div>
      <div class="quick-stat-card__label">${stat.label}</div>
    `;
    grid.appendChild(card);
  });

  return grid;
}
```

### Step 4.3: Verification

- [ ] Readiness banner shows correct status
- [ ] Progress bar fills correctly (no animation)
- [ ] Executive summary displays
- [ ] Key findings list renders with green dots
- [ ] Critical gaps alert appears when data exists
- [ ] Quick stats grid shows values

---

## Phase 5: Themes Tab

**Duration:** ~4 hours
**Files:** `analysis-view.css`, `ResearchAnalysisView.js`

### Step 5.1: Add Themes Tab CSS

```css
/* ========== THEMES TAB ========== */

/* Theme Status Summary */
.theme-status-summary {
  padding: var(--spacing-5);
  margin-bottom: var(--spacing-6);

  background: var(--glass-enhanced-bg);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);
}

.theme-status-summary__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

.theme-status-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.theme-status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-3) 0;
  border-bottom: 1px solid var(--glass-white-10);
}

.theme-status-item:last-child {
  border-bottom: none;
}

.theme-status-item__name {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  font-size: var(--text-base);
  color: var(--text-primary);
}

.theme-status-item__indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.theme-status-item__indicator--ready {
  background: var(--color-glass-success);
}

.theme-status-item__indicator--needs-work {
  background: transparent;
  border: 2px solid var(--text-muted);
}

.theme-status-item__meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
}

.theme-status-item__score {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--text-secondary);
}

.theme-status-item__badge {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-full);
}

.theme-status-item__badge--ready {
  background: rgba(80, 175, 123, 0.15);
  color: var(--color-glass-success);
}

.theme-status-item__badge--needs-work {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* Theme Card - EXPANDED BY DEFAULT */
.theme-card {
  margin-bottom: var(--spacing-5);

  background: var(--glass-enhanced-bg);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-xl);

  overflow: hidden;

  /* NO hover transform */
  transition: border-color 0.15s ease;
}

.theme-card:hover {
  border-color: var(--glass-enhanced-border-hover);
}

.theme-card--ready {
  border-left: 4px solid var(--color-glass-success);
}

.theme-card--needs-work {
  border-left: 4px solid #f87171;
}

.theme-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-5) var(--spacing-6);

  background: var(--glass-white-5);
  border-bottom: 1px solid var(--glass-white-10);
}

.theme-card__title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.theme-card__meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.theme-card__score-badge {
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--glass-white-10);
  border: 1px solid var(--glass-white-20);
  border-radius: var(--radius-glass-md);

  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--text-primary);
}

.theme-card__status-badge {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-glass-sm);
}

.theme-card__status-badge--ready {
  background: rgba(80, 175, 123, 0.15);
  color: var(--color-glass-success);
}

.theme-card__status-badge--needs-work {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* Theme Card Content - VISIBLE BY DEFAULT */
.theme-card__content {
  padding: var(--spacing-6);
}

.theme-card__description {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-5) 0;
}

/* Theme Stats Row */
.theme-stats-row {
  display: flex;
  gap: var(--spacing-6);
  padding: var(--spacing-4);
  margin-bottom: var(--spacing-5);

  background: var(--glass-white-8);
  border: 1px solid var(--glass-white-10);
  border-radius: var(--radius-glass-md);
}

.theme-stat {
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.theme-stat__value {
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
}

/* Theme Lists */
.theme-list-section {
  margin-bottom: var(--spacing-5);
}

.theme-list-section__title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-3) 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.theme-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.theme-list li {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  padding: var(--spacing-2) 0;
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
}

.theme-list--strengths li::before {
  content: '+';
  color: var(--color-glass-success);
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}

.theme-list--gaps li::before {
  content: '-';
  color: #f87171;
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}

.theme-list--recommendations li::before {
  content: '>';
  color: var(--text-muted);
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}

/* Sample Events Table */
.sample-events {
  margin-top: var(--spacing-5);
}

.sample-events__title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-3) 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sample-events-table {
  width: 100%;
  border-collapse: collapse;

  background: var(--glass-white-8);
  border: 1px solid var(--glass-white-10);
  border-radius: var(--radius-glass-md);
  overflow: hidden;
}

.sample-events-table th,
.sample-events-table td {
  padding: var(--spacing-3) var(--spacing-4);
  text-align: left;
  font-size: var(--text-base);
  border-bottom: 1px solid var(--glass-white-10);
}

.sample-events-table th {
  background: var(--glass-white-10);
  color: var(--text-primary);
  font-weight: var(--weight-semibold);
}

.sample-events-table td {
  color: var(--text-secondary);
}

.sample-events-table tr:last-child td {
  border-bottom: none;
}

/* Quality Indicator */
.quality-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-sm);
}

.quality-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.quality-indicator--specific .quality-indicator__dot { background: #50AF7B; }
.quality-indicator--quarterly .quality-indicator__dot { background: #84cc16; }
.quality-indicator--monthly .quality-indicator__dot { background: #eab308; }
.quality-indicator--yearly .quality-indicator__dot { background: #f97316; }
.quality-indicator--vague .quality-indicator__dot { background: #ef4444; }

/* Collapse Button */
.theme-card__collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  width: 100%;
  padding: var(--spacing-3);
  margin-top: var(--spacing-4);

  background: transparent;
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-md);

  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text-muted);

  cursor: pointer;
  transition: all 0.15s ease;
}

.theme-card__collapse-btn:hover {
  background: var(--glass-white-10);
  color: var(--text-primary);
}

/* Collapsed State */
.theme-card--collapsed .theme-card__content {
  display: none;
}
```

### Step 5.2: Add Themes Tab JavaScript

```javascript
_renderThemesTab() {
  const panel = document.createElement('div');

  // Theme Status Summary
  if (this.analysisData.themes?.length > 0) {
    panel.appendChild(this._renderThemeStatusSummary());
  }

  // Theme Cards (expanded by default)
  if (this.analysisData.themes?.length > 0) {
    this.analysisData.themes.forEach((theme, index) => {
      panel.appendChild(this._renderThemeCard(theme, index));
    });
  }

  return panel;
}

_renderThemeStatusSummary() {
  const summary = document.createElement('div');
  summary.className = 'theme-status-summary';

  const items = this.analysisData.themes.map(theme => {
    const isReady = theme.includeableInGantt;
    return `
      <li class="theme-status-item">
        <span class="theme-status-item__name">
          <span class="theme-status-item__indicator theme-status-item__indicator--${isReady ? 'ready' : 'needs-work'}"></span>
          ${this._escapeHtml(theme.name)}
        </span>
        <span class="theme-status-item__meta">
          <span class="theme-status-item__score">${theme.fitnessScore}/10</span>
          <span class="theme-status-item__badge theme-status-item__badge--${isReady ? 'ready' : 'needs-work'}">
            ${isReady ? '✓ Ready' : '✗ Needs work'}
          </span>
        </span>
      </li>
    `;
  }).join('');

  summary.innerHTML = `
    <h3 class="theme-status-summary__title">Theme Status Summary</h3>
    <ul class="theme-status-list">${items}</ul>
  `;

  return summary;
}

_renderThemeCard(theme, index) {
  const card = document.createElement('div');
  const isReady = theme.includeableInGantt;
  const isExpanded = this.expandedThemes.has(index);

  card.className = `theme-card theme-card--${isReady ? 'ready' : 'needs-work'} ${isExpanded ? '' : 'theme-card--collapsed'}`;
  card.dataset.themeIndex = index;

  // Header
  const header = document.createElement('div');
  header.className = 'theme-card__header';
  header.innerHTML = `
    <h3 class="theme-card__title">${this._escapeHtml(theme.name)}</h3>
    <div class="theme-card__meta">
      <span class="theme-card__score-badge">${theme.fitnessScore}/10</span>
      <span class="theme-card__status-badge theme-card__status-badge--${isReady ? 'ready' : 'needs-work'}">
        ${isReady ? '✓ Ready' : '✗ Needs work'}
      </span>
    </div>
  `;
  card.appendChild(header);

  // Content (visible by default)
  const content = document.createElement('div');
  content.className = 'theme-card__content';

  // Description
  if (theme.description) {
    const desc = document.createElement('p');
    desc.className = 'theme-card__description';
    desc.textContent = theme.description;
    content.appendChild(desc);
  }

  // Stats row
  const statsRow = document.createElement('div');
  statsRow.className = 'theme-stats-row';
  statsRow.innerHTML = `
    <span class="theme-stat"><span class="theme-stat__value">${theme.datesCounted || 0}</span> dates found</span>
    <span class="theme-stat"><span class="theme-stat__value">${theme.tasksPotential || 0}</span> potential tasks</span>
    <span class="theme-stat">Quality: <span class="theme-stat__value">${this._formatQuality(theme.eventDataQuality)}</span></span>
  `;
  content.appendChild(statsRow);

  // Strengths
  if (theme.strengths?.length > 0) {
    content.appendChild(this._renderThemeList('Strengths', theme.strengths, 'strengths'));
  }

  // Gaps
  if (theme.gaps?.length > 0) {
    content.appendChild(this._renderThemeList('Gaps', theme.gaps, 'gaps'));
  }

  // Recommendations
  if (theme.recommendations?.length > 0) {
    content.appendChild(this._renderThemeList('Recommendations', theme.recommendations, 'recommendations'));
  }

  // Sample Events
  if (theme.sampleEvents?.length > 0) {
    content.appendChild(this._renderSampleEventsTable(theme.sampleEvents));
  }

  // Collapse button
  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'theme-card__collapse-btn';
  collapseBtn.innerHTML = isExpanded ? 'Collapse ▲' : 'Expand ▼';
  collapseBtn.addEventListener('click', () => {
    const isNowExpanded = this.expandedThemes.has(index);
    if (isNowExpanded) {
      this.expandedThemes.delete(index);
      card.classList.add('theme-card--collapsed');
      collapseBtn.innerHTML = 'Expand ▼';
    } else {
      this.expandedThemes.add(index);
      card.classList.remove('theme-card--collapsed');
      collapseBtn.innerHTML = 'Collapse ▲';
    }
  });
  content.appendChild(collapseBtn);

  card.appendChild(content);

  return card;
}

_renderThemeList(title, items, type) {
  const section = document.createElement('div');
  section.className = 'theme-list-section';

  const listItems = items.map(item => `<li>${this._escapeHtml(item)}</li>`).join('');

  section.innerHTML = `
    <h4 class="theme-list-section__title">${title}</h4>
    <ul class="theme-list theme-list--${type}">${listItems}</ul>
  `;

  return section;
}

_renderSampleEventsTable(events) {
  const container = document.createElement('div');
  container.className = 'sample-events';

  const rows = events.slice(0, 5).map(event => `
    <tr>
      <td>${this._escapeHtml(event.event)}</td>
      <td>${this._escapeHtml(event.dateInfo)}</td>
      <td>
        <span class="quality-indicator quality-indicator--${event.quality}">
          <span class="quality-indicator__dot"></span>
          ${this._formatQuality(event.quality)}
        </span>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <h4 class="sample-events__title">Sample Events</h4>
    <table class="sample-events-table">
      <thead>
        <tr>
          <th>Event</th>
          <th>Date Info</th>
          <th>Quality</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  return container;
}
```

### Step 5.3: Verification

- [ ] Theme status summary shows all themes
- [ ] Ready themes have filled green indicator
- [ ] Theme cards are expanded by default
- [ ] Collapse button works
- [ ] No hover transform on cards
- [ ] Sample events table displays correctly

---

## Phase 6: Data Quality Tab

**Duration:** ~3 hours
**Files:** `analysis-view.css`, `ResearchAnalysisView.js`

### Step 6.1: Add Data Quality Tab CSS

```css
/* ========== DATA QUALITY TAB ========== */

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-6);
}

.metric-card {
  padding: var(--spacing-5);
  text-align: center;

  background: var(--glass-enhanced-bg);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);

  transition: background-color 0.15s ease;
}

.metric-card:hover {
  background: var(--glass-enhanced-bg-hover);
}

.metric-card__value {
  font-size: var(--text-4xl);
  font-weight: var(--weight-bold);
  color: var(--text-primary);
  line-height: 1;
}

.metric-card__label {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: var(--spacing-2);
}

/* Date Specificity Chart */
.specificity-chart {
  padding: var(--spacing-6);
  margin-bottom: var(--spacing-6);

  background: var(--glass-enhanced-bg);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-xl);
}

.specificity-chart__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-5) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

.specificity-bars {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.specificity-bar {
  display: grid;
  grid-template-columns: 100px 1fr 80px;
  align-items: center;
  gap: var(--spacing-4);
}

.specificity-bar__label {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--text-secondary);
  text-align: right;
}

.specificity-bar__track {
  height: 16px;
  background: var(--glass-white-10);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.specificity-bar__fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s ease-out;
  /* NO ::after shine animation */
}

.specificity-bar--specific .specificity-bar__fill { background: #50AF7B; }
.specificity-bar--quarterly .specificity-bar__fill { background: #84cc16; }
.specificity-bar--monthly .specificity-bar__fill { background: #eab308; }
.specificity-bar--yearly .specificity-bar__fill { background: #f97316; }
.specificity-bar--relative .specificity-bar__fill { background: #f87171; }
.specificity-bar--vague .specificity-bar__fill { background: #ef4444; }

.specificity-bar__value {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--text-muted);
}

/* Timeline Coverage */
.timeline-coverage {
  padding: var(--spacing-6);

  background: var(--glass-enhanced-bg);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-xl);
}

.timeline-coverage__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

.timeline-coverage__info {
  margin-bottom: var(--spacing-4);
}

.timeline-coverage__span {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-2);
}

.timeline-coverage__range {
  font-size: var(--text-base);
  color: var(--text-secondary);
}
```

### Step 6.2: Add Data Quality Tab JavaScript

```javascript
_renderDataQualityTab() {
  const panel = document.createElement('div');

  const data = this.analysisData.dataCompleteness;
  if (!data) {
    panel.innerHTML = '<p class="text-muted">No data completeness information available.</p>';
    return panel;
  }

  // Metrics Grid
  panel.appendChild(this._renderMetricsGrid(data));

  // Date Specificity Chart
  if (data.dateSpecificityBreakdown) {
    panel.appendChild(this._renderSpecificityChart(data.dateSpecificityBreakdown));
  }

  // Timeline Coverage
  if (data.timelineSpan) {
    panel.appendChild(this._renderTimelineCoverage(data.timelineSpan));
  }

  return panel;
}

_renderMetricsGrid(data) {
  const grid = document.createElement('div');
  grid.className = 'metrics-grid';

  const metrics = [
    { value: data.totalDatesFound || 0, label: 'Total Dates' },
    { value: data.totalEventsIdentified || 0, label: 'Total Events' },
    { value: data.eventsWithDates || 0, label: 'Events with Dates' },
    { value: data.eventsWithoutDates || 0, label: 'Events Missing Dates' }
  ];

  metrics.forEach(metric => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
      <div class="metric-card__value">${metric.value}</div>
      <div class="metric-card__label">${metric.label}</div>
    `;
    grid.appendChild(card);
  });

  return grid;
}

_renderSpecificityChart(breakdown) {
  const chart = document.createElement('div');
  chart.className = 'specificity-chart';

  const categories = [
    { key: 'specific', label: 'Specific' },
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'relative', label: 'Relative' },
    { key: 'vague', label: 'Vague' }
  ];

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;

  const bars = categories.map(cat => {
    const value = breakdown[cat.key] || 0;
    const percent = Math.round((value / total) * 100);
    return `
      <div class="specificity-bar specificity-bar--${cat.key}">
        <span class="specificity-bar__label">${cat.label}</span>
        <div class="specificity-bar__track">
          <div class="specificity-bar__fill" style="width: ${percent}%;"></div>
        </div>
        <span class="specificity-bar__value">${value} (${percent}%)</span>
      </div>
    `;
  }).join('');

  chart.innerHTML = `
    <h3 class="specificity-chart__title">Date Specificity Breakdown</h3>
    <div class="specificity-bars">${bars}</div>
  `;

  return chart;
}

_renderTimelineCoverage(timelineSpan) {
  const section = document.createElement('div');
  section.className = 'timeline-coverage';

  section.innerHTML = `
    <h3 class="timeline-coverage__title">Timeline Coverage</h3>
    <div class="timeline-coverage__info">
      <div class="timeline-coverage__span">Span: ${this._escapeHtml(timelineSpan.spanDescription)}</div>
      <div class="timeline-coverage__range">Range: ${this._escapeHtml(timelineSpan.earliestDate)} — ${this._escapeHtml(timelineSpan.latestDate)}</div>
    </div>
  `;

  return section;
}
```

### Step 6.3: Verification

- [ ] Four metric cards display
- [ ] No hover transform on cards
- [ ] Specificity bars render without shine animation
- [ ] Bar widths are correct percentages
- [ ] Timeline coverage section displays

---

## Phase 7: Actions Tab

**Duration:** ~3 hours
**Files:** `analysis-view.css`, `ResearchAnalysisView.js`

### Step 7.1: Add Actions Tab CSS

```css
/* ========== ACTIONS TAB ========== */

/* Section Title */
.actions-section__title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-5) 0;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--glass-white-15);
}

/* Action Items List */
.action-items-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-8);
}

.action-item {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: var(--spacing-4);
  align-items: start;

  padding: var(--spacing-5);

  background: var(--glass-enhanced-bg);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);

  /* NO hover transform */
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.action-item:hover {
  background: var(--glass-enhanced-bg-hover);
  border-color: var(--glass-enhanced-border-hover);
}

.action-item__number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;

  background: var(--glass-white-12);
  border: 2px solid var(--glass-white-25);
  border-radius: 50%;

  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--text-primary);
}

.action-item--high-impact .action-item__number {
  background: rgba(80, 175, 123, 0.20);
  border-color: rgba(80, 175, 123, 0.50);
  color: var(--color-glass-success);
}

.action-item__content {
  flex: 1;
}

.action-item__text {
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  color: var(--text-primary);
  line-height: var(--leading-relaxed);
  margin: 0;
}

.action-item__badges {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: flex-end;
}

.action-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-1) var(--spacing-3);

  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  border-radius: var(--radius-full);
  white-space: nowrap;
}

.action-badge--impact-high {
  background: rgba(80, 175, 123, 0.15);
  color: var(--color-glass-success);
}

.action-badge--impact-medium {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.action-badge--impact-low {
  background: var(--glass-white-12);
  color: var(--text-muted);
}

.action-badge--effort-low {
  background: rgba(80, 175, 123, 0.10);
  color: var(--color-glass-success-light);
}

.action-badge--effort-medium {
  background: rgba(234, 179, 8, 0.10);
  color: #fbbf24;
}

.action-badge--effort-high {
  background: rgba(239, 68, 68, 0.10);
  color: #f87171;
}

/* Suggested Sources */
.sources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-4);
}

.source-card {
  padding: var(--spacing-5);

  background: var(--glass-enhanced-bg);
  border: 1px solid var(--glass-white-15);
  border-radius: var(--radius-glass-lg);

  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.source-card:hover {
  background: var(--glass-enhanced-bg-hover);
  border-color: var(--glass-enhanced-border-hover);
}

.source-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-4);
}

.source-card__type {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
}

.source-card__priority {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
}

.source-card__priority--high {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.source-card__priority--medium {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.source-card__priority--low {
  background: var(--glass-white-12);
  color: var(--text-muted);
}

.source-card__reason {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-4);
}

.source-card__improvement {
  font-size: var(--text-sm);
  color: var(--text-muted);
  padding-top: var(--spacing-3);
  border-top: 1px solid var(--glass-white-15);
}

.source-card__improvement strong {
  color: var(--text-secondary);
}
```

### Step 7.2: Add Actions Tab JavaScript

```javascript
_renderActionsTab() {
  const panel = document.createElement('div');

  // Action Items
  if (this.analysisData.actionItems?.length > 0) {
    const actionsSection = document.createElement('div');
    actionsSection.className = 'actions-section';

    const title = document.createElement('h2');
    title.className = 'actions-section__title';
    title.textContent = 'Recommended Actions';
    actionsSection.appendChild(title);

    actionsSection.appendChild(this._renderActionItemsList());
    panel.appendChild(actionsSection);
  }

  // Suggested Sources
  if (this.analysisData.suggestedSources?.length > 0) {
    const sourcesSection = document.createElement('div');
    sourcesSection.className = 'sources-section';

    const title = document.createElement('h2');
    title.className = 'actions-section__title';
    title.textContent = 'Suggested Sources';
    sourcesSection.appendChild(title);

    sourcesSection.appendChild(this._renderSourcesGrid());
    panel.appendChild(sourcesSection);
  }

  return panel;
}

_renderActionItemsList() {
  const list = document.createElement('div');
  list.className = 'action-items-list';

  this.analysisData.actionItems.forEach((item, index) => {
    const actionEl = document.createElement('div');
    const isHighImpact = item.impact === 'high';
    actionEl.className = `action-item ${isHighImpact ? 'action-item--high-impact' : ''}`;

    actionEl.innerHTML = `
      <div class="action-item__number">${index + 1}</div>
      <div class="action-item__content">
        <p class="action-item__text">${this._escapeHtml(item.action)}</p>
      </div>
      <div class="action-item__badges">
        <span class="action-badge action-badge--impact-${item.impact}">${item.impact} impact</span>
        <span class="action-badge action-badge--effort-${item.effort}">${item.effort} effort</span>
      </div>
    `;

    list.appendChild(actionEl);
  });

  return list;
}

_renderSourcesGrid() {
  const grid = document.createElement('div');
  grid.className = 'sources-grid';

  this.analysisData.suggestedSources.forEach(source => {
    const card = document.createElement('div');
    card.className = 'source-card';

    card.innerHTML = `
      <div class="source-card__header">
        <span class="source-card__type">${this._escapeHtml(source.sourceType)}</span>
        <span class="source-card__priority source-card__priority--${source.priority}">${source.priority}</span>
      </div>
      <p class="source-card__reason">${this._escapeHtml(source.reason)}</p>
      <div class="source-card__improvement">
        <strong>Expected improvement:</strong> ${this._escapeHtml(source.expectedImprovement)}
      </div>
    `;

    grid.appendChild(card);
  });

  return grid;
}
```

### Step 7.3: Verification

- [ ] Action items display with numbered badges
- [ ] High-impact items have green number badges
- [ ] No hover transform on action items
- [ ] Impact/effort badges show correct colors
- [ ] Source cards grid displays correctly
- [ ] Priority badges show correct colors

---

## Phase 8: Responsive & Accessibility

**Duration:** ~3 hours
**Files:** `analysis-view.css`

### Step 8.1: Add Responsive Styles

```css
/* ========== RESPONSIVE STYLES ========== */

@media (max-width: 639px) {
  .research-analysis-view {
    padding: var(--spacing-4);
  }

  /* Stack tab navigation vertically */
  .tab-navigation {
    flex-direction: column;
  }

  .tab-button {
    width: 100%;
    justify-content: flex-start;
  }

  /* Header stack */
  .analysis-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-5);
    padding: var(--spacing-5);
  }

  .analysis-score-section {
    width: 100%;
  }

  .score-bar {
    max-width: 200px;
  }

  /* Single column grids */
  .metrics-grid,
  .quick-stats-grid {
    grid-template-columns: 1fr;
  }

  .sources-grid {
    grid-template-columns: 1fr;
  }

  /* Action items stack badges */
  .action-item {
    grid-template-columns: 40px 1fr;
  }

  .action-item__badges {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: flex-start;
    margin-top: var(--spacing-3);
  }

  /* Theme card header stack */
  .theme-card__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-3);
  }

  .theme-card__meta {
    width: 100%;
    justify-content: flex-start;
  }

  /* Stats row wrap */
  .theme-stats-row {
    flex-wrap: wrap;
    gap: var(--spacing-3);
  }

  /* Specificity bars */
  .specificity-bar {
    grid-template-columns: 80px 1fr 60px;
    gap: var(--spacing-2);
  }

  .specificity-bar__label {
    font-size: var(--text-sm);
  }
}

@media (min-width: 640px) and (max-width: 1023px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .quick-stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .research-analysis-view {
    padding: var(--spacing-10);
  }
}
```

### Step 8.2: Add Accessibility Styles

```css
/* ========== ACCESSIBILITY ========== */

/* Focus states */
.tab-button:focus-visible,
.theme-card__collapse-btn:focus-visible,
.action-item:focus-visible,
.source-card:focus-visible {
  outline: 3px solid var(--color-glass-success);
  outline-offset: 2px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .research-analysis-view,
  .tab-panel {
    animation: none !important;
  }

  .tab-button,
  .action-item,
  .source-card,
  .theme-card,
  .metric-card,
  .quick-stat-card {
    transition: none !important;
  }

  .score-bar-fill,
  .readiness-progress__fill,
  .specificity-bar__fill {
    transition: none !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .analysis-header,
  .overview-section,
  .theme-card,
  .action-item,
  .source-card,
  .metric-card,
  .quick-stat-card,
  .tab-navigation {
    border-width: 2px;
    border-color: rgba(255, 255, 255, 0.5);
  }

  .score-badge,
  .action-badge,
  .theme-status-item__badge,
  .source-card__priority {
    border: 1px solid currentColor;
  }
}

/* Forced colors mode (Windows High Contrast) */
@media (forced-colors: active) {
  .analysis-header,
  .overview-section,
  .theme-card,
  .action-item,
  .source-card,
  .tab-navigation {
    border: 2px solid CanvasText;
    background: Canvas;
  }

  .tab-button--active::after {
    background: Highlight;
  }

  .score-badge,
  .action-badge {
    border: 1px solid CanvasText;
  }
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Step 8.3: Verification

- [ ] Test on mobile viewport (375px)
- [ ] Test on tablet viewport (768px)
- [ ] Test on desktop viewport (1280px)
- [ ] Keyboard navigation works (Tab, Arrow keys)
- [ ] Focus indicators visible
- [ ] Test with prefers-reduced-motion
- [ ] Test with prefers-contrast: high

---

## Phase 9: Testing & Polish

**Duration:** ~4 hours

### Step 9.1: Functional Testing Checklist

**Header:**
- [ ] Score badge displays correct tier color
- [ ] Score bar fills to correct percentage
- [ ] Rating label shows correct text
- [ ] Timestamp displays correctly
- [ ] No shimmer animation on score badge

**Tab Navigation:**
- [ ] All 4 tabs render
- [ ] Active tab highlighted with green underline
- [ ] Tab click switches content
- [ ] Arrow keys navigate tabs
- [ ] URL hash updates
- [ ] Direct URL hash loads correct tab
- [ ] Badge counts are accurate

**Overview Tab:**
- [ ] Readiness banner shows correct status
- [ ] Progress bar fills (no shine animation)
- [ ] Executive summary displays
- [ ] Key findings list with green dots
- [ ] Critical gaps alert (if data exists)
- [ ] Quick stats grid displays

**Themes Tab:**
- [ ] Status summary shows all themes
- [ ] Theme cards expanded by default
- [ ] Collapse/expand works
- [ ] Ready/needs-work indicators correct
- [ ] Sample events table displays
- [ ] No hover transform on cards

**Data Quality Tab:**
- [ ] Metrics grid shows 4 cards
- [ ] Specificity chart bars render
- [ ] No bar shine animation
- [ ] Timeline coverage displays

**Actions Tab:**
- [ ] Action items numbered correctly
- [ ] High-impact items have green numbers
- [ ] Impact/effort badges correct
- [ ] Suggested sources grid displays
- [ ] No hover transform

### Step 9.2: Accessibility Testing

- [ ] Run axe DevTools audit
- [ ] Test with VoiceOver (Mac) or NVDA (Windows)
- [ ] Verify all ARIA attributes
- [ ] Check tab order is logical
- [ ] Test at 200% zoom

### Step 9.3: Cross-Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Step 9.4: Performance Check

- [ ] No layout shift on load
- [ ] Animations run at 60fps
- [ ] No memory leaks on tab switching

---

## Rollback Plan

If critical issues are discovered:

### Quick Rollback

```bash
# Restore from backup branch
git checkout backup/research-qa-v1-YYYYMMDD -- Public/styles/analysis-view.css
git checkout backup/research-qa-v1-YYYYMMDD -- Public/components/views/ResearchAnalysisView.js
git commit -m "Rollback: Restore v1.0 Research QA implementation"
```

### Feature Flag Rollback

If using feature flag:

```javascript
// Set to false to use v1.0
const FEATURES = {
  USE_TABBED_RESEARCH_QA: false
};
```

### Partial Rollback

If only specific features are problematic:

1. Keep tab navigation, rollback theme cards
2. Keep new CSS, rollback JS changes
3. Keep Overview tab, rollback other tabs

---

## Summary Timeline

| Phase | Description | Duration | Dependencies |
|-------|-------------|----------|--------------|
| 0 | Pre-implementation | 30 min | None |
| 1 | Foundation & CSS Reset | 2 hrs | Phase 0 |
| 2 | Header Component | 2 hrs | Phase 1 |
| 3 | Tab Navigation | 3 hrs | Phase 2 |
| 4 | Overview Tab | 3 hrs | Phase 3 |
| 5 | Themes Tab | 4 hrs | Phase 3 |
| 6 | Data Quality Tab | 3 hrs | Phase 3 |
| 7 | Actions Tab | 3 hrs | Phase 3 |
| 8 | Responsive & Accessibility | 3 hrs | Phases 4-7 |
| 9 | Testing & Polish | 4 hrs | Phase 8 |
| **Total** | | **~27 hrs** | |

---

*End of Implementation Plan*
