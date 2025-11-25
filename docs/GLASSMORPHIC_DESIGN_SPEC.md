# Glassmorphic File Upload Screen - Design Specification

> Complete redesign specification for transforming the AI Roadmap Generator upload interface into a modern glassmorphic design, based on navy (#0c2340) color palette.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Glassmorphic Design Tokens](#glassmorphic-design-tokens)
4. [Background Treatment](#background-treatment)
5. [Component Specifications](#component-specifications)
6. [Typography](#typography)
7. [Animations & Micro-interactions](#animations--micro-interactions)
8. [Accessibility Requirements](#accessibility-requirements)
9. [CSS Implementation](#css-implementation)
10. [Responsive Behavior](#responsive-behavior)

---

## 1. Design Philosophy

### Core Principles

The glassmorphic redesign follows these guiding principles from the reference design:

| Principle | Description |
|-----------|-------------|
| **Layered Depth** | Multiple translucent layers create visual hierarchy and depth |
| **Frosted Glass Effect** | Blur effects simulate frosted glass panels floating above the background |
| **Subtle Borders** | Light, semi-transparent borders define panel edges without harsh lines |
| **Soft Shadows** | Diffused shadows create elevation without stark contrasts |
| **Organic Shapes** | Rounded corners and flowing gradients create approachability |

### Visual Hierarchy (from reference image)

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 0: Rich gradient background with organic blob shapes │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  LAYER 1: Main glass panel (strongest blur)           │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  LAYER 2: Content cards (medium blur)           │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │  LAYER 3: Interactive elements (subtle)   │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Color System

### Base Color Derivation

All colors are derived from the primary navy: `#0c2340`

```
Primary Navy: #0c2340
├── HSL: 213°, 69%, 15%
├── RGB: 12, 35, 64
└── Used for: Background base, text on light surfaces
```

### Complete Palette

#### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Navy Deep** | `#0c2340` | 12, 35, 64 | Background base |
| **Navy Mid** | `#143052` | 20, 48, 82 | Secondary backgrounds |
| **Navy Light** | `#1d4168` | 29, 65, 104 | Hover states, highlights |
| **Navy Pale** | `#2a5580` | 42, 85, 128 | Accent elements |

#### Accent Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Accent Red** | `#da291c` | 218, 41, 28 | Primary CTA, brand accent |
| **Accent Red Hover** | `#b82317` | 184, 35, 23 | Button hover state |
| **Success Green** | `#50AF7B` | 80, 175, 123 | Focus rings, success states |
| **Success Green Light** | `#6BC492` | 107, 196, 146 | Valid file indicators |

#### Glass Effect Colors (RGBA)

| Name | Value | Usage |
|------|-------|-------|
| **Glass White 5** | `rgba(255, 255, 255, 0.05)` | Subtle glass panels |
| **Glass White 8** | `rgba(255, 255, 255, 0.08)` | Main form background |
| **Glass White 10** | `rgba(255, 255, 255, 0.10)` | Card backgrounds |
| **Glass White 15** | `rgba(255, 255, 255, 0.15)` | Hover states |
| **Glass White 20** | `rgba(255, 255, 255, 0.20)` | Active/selected states |
| **Glass White 30** | `rgba(255, 255, 255, 0.30)` | Borders |
| **Glass Navy 10** | `rgba(12, 35, 64, 0.10)` | Shadow base |
| **Glass Navy 30** | `rgba(12, 35, 64, 0.30)` | Deeper shadows |
| **Glass Navy 50** | `rgba(12, 35, 64, 0.50)` | Overlay backgrounds |

#### Text Colors

| Name | Value | Usage |
|------|-------|-------|
| **Text Primary** | `#FFFFFF` | Headings, primary text |
| **Text Secondary** | `rgba(255, 255, 255, 0.80)` | Body text |
| **Text Muted** | `rgba(255, 255, 255, 0.60)` | Helper text, labels |
| **Text Disabled** | `rgba(255, 255, 255, 0.40)` | Disabled states |

---

## 3. Glassmorphic Design Tokens

### Blur Values

| Token | Value | Usage |
|-------|-------|-------|
| `--blur-xs` | `4px` | Subtle depth on small elements |
| `--blur-sm` | `8px` | Inner cards, buttons |
| `--blur-md` | `12px` | Secondary panels |
| `--blur-lg` | `16px` | Main content panels |
| `--blur-xl` | `20px` | Primary glass container |
| `--blur-2xl` | `32px` | Hero elements, overlays |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `8px` | Buttons, small cards |
| `--radius-md` | `12px` | Input fields, file items |
| `--radius-lg` | `16px` | Cards, dropzone |
| `--radius-xl` | `24px` | Main container |
| `--radius-2xl` | `32px` | Hero panels |
| `--radius-full` | `9999px` | Circular elements, pills |

### Shadow System

```css
/* Elevation 1: Subtle lift */
--shadow-glass-1:
  0 4px 16px rgba(12, 35, 64, 0.15),
  inset 0 1px 0 rgba(255, 255, 255, 0.1);

/* Elevation 2: Card level */
--shadow-glass-2:
  0 8px 32px rgba(12, 35, 64, 0.20),
  inset 0 1px 0 rgba(255, 255, 255, 0.15);

/* Elevation 3: Modal/Panel level */
--shadow-glass-3:
  0 12px 48px rgba(12, 35, 64, 0.25),
  inset 0 1px 0 rgba(255, 255, 255, 0.2);

/* Elevation 4: Floating elements */
--shadow-glass-4:
  0 24px 64px rgba(12, 35, 64, 0.30),
  inset 0 2px 0 rgba(255, 255, 255, 0.15);
```

### Border Styles

```css
/* Standard glass border */
--border-glass: 1px solid rgba(255, 255, 255, 0.15);

/* Enhanced glass border */
--border-glass-strong: 1px solid rgba(255, 255, 255, 0.25);

/* Focus/Active border */
--border-glass-active: 1px solid rgba(255, 255, 255, 0.40);

/* Decorative dashed border (dropzone) */
--border-glass-dashed: 2px dashed rgba(255, 255, 255, 0.30);
```

---

## 4. Background Treatment

### Gradient Background

The background creates visual interest for the glass effect to shine:

```css
body {
  background:
    /* Organic blob 1: Top-left warm accent */
    radial-gradient(
      ellipse 80% 60% at 15% 20%,
      rgba(218, 41, 28, 0.12) 0%,
      transparent 50%
    ),
    /* Organic blob 2: Center-right cool accent */
    radial-gradient(
      ellipse 70% 50% at 85% 40%,
      rgba(42, 85, 128, 0.20) 0%,
      transparent 50%
    ),
    /* Organic blob 3: Bottom-left teal accent */
    radial-gradient(
      ellipse 60% 70% at 25% 80%,
      rgba(80, 175, 123, 0.08) 0%,
      transparent 50%
    ),
    /* Organic blob 4: Bottom-right deep navy */
    radial-gradient(
      ellipse 50% 40% at 90% 90%,
      rgba(20, 48, 82, 0.30) 0%,
      transparent 50%
    ),
    /* Base gradient */
    linear-gradient(
      135deg,
      #0c2340 0%,
      #143052 50%,
      #0c2340 100%
    );

  background-attachment: fixed;
  min-height: 100vh;
}
```

### Visual Reference

```
┌─────────────────────────────────────────┐
│  ◯ Warm red blob                        │
│     (subtle glow, top-left)             │
│                          ◯ Cool blue    │
│                           (mid-right)   │
│                                         │
│          ┌─────────────────────┐        │
│          │   GLASS PANEL       │        │
│          │   Content here      │        │
│          └─────────────────────┘        │
│                                         │
│  ◯ Teal accent                          │
│    (bottom-left)        ◯ Deep navy     │
│                          (bottom-right) │
└─────────────────────────────────────────┘
```

---

## 5. Component Specifications

### 5.1 Main Form Container

The primary glass panel containing all form elements.

```
┌────────────────────────────────────────────────────────────┐
│                                              [LOGO]        │
│                                                            │
│  Project Instructions                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Textarea (glass input)                              │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  Upload Research Documents                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │           ☁️ Cloud Icon                              │  │
│  │      Drop files here or click to browse              │  │
│  │      Supports .doc, .docx, .md, and .txt             │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [ Generate Chart ]  ○ Loading...                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
.form-glass-panel {
  /* Glass Effect */
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  /* Border */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;

  /* Shadow */
  box-shadow:
    0 12px 48px rgba(12, 35, 64, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(12, 35, 64, 0.1);

  /* Spacing */
  padding: 48px;
}
```

### 5.2 Dropzone Component

The file upload area with drag-and-drop support.

#### States

| State | Background | Border | Effect |
|-------|------------|--------|--------|
| **Default** | `rgba(255,255,255,0.05)` | Dashed `rgba(255,255,255,0.25)` | Subtle glow |
| **Hover** | `rgba(255,255,255,0.10)` | Dashed `rgba(255,255,255,0.40)` | Scale 1.01, brighter glow |
| **Drag Over** | `rgba(255,255,255,0.15)` | Solid `rgba(80,175,123,0.60)` | Pulse animation |
| **Files Selected** | `rgba(255,255,255,0.08)` | Solid `rgba(255,255,255,0.20)` | Static |
| **Error** | `rgba(218,41,28,0.10)` | Dashed `rgba(218,41,28,0.40)` | Shake animation |

#### CSS Specification

```css
.dropzone-glass {
  /* Base Glass */
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  /* Dashed Border */
  border: 2px dashed rgba(255, 255, 255, 0.25);
  border-radius: 16px;

  /* Inner Shadow for Depth */
  box-shadow:
    inset 0 2px 4px rgba(12, 35, 64, 0.1),
    0 4px 16px rgba(12, 35, 64, 0.1);

  /* Layout */
  min-height: 320px;
  padding: 48px;

  /* Smooth Transitions */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropzone-glass:hover {
  background: rgba(255, 255, 255, 0.10);
  border-color: rgba(255, 255, 255, 0.40);
  transform: scale(1.01);
  box-shadow:
    inset 0 2px 4px rgba(12, 35, 64, 0.1),
    0 8px 32px rgba(12, 35, 64, 0.15),
    0 0 0 4px rgba(255, 255, 255, 0.05);
}

.dropzone-glass.drag-over {
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(80, 175, 123, 0.60);
  animation: dropzone-pulse 1.5s ease-in-out infinite;
}

@keyframes dropzone-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(80, 175, 123, 0.4); }
  50% { box-shadow: 0 0 0 12px rgba(80, 175, 123, 0); }
}
```

### 5.3 File List Cards

Individual file items displayed after selection.

```
┌──────────────────────────────────────────────────────────┐
│ Folder Statistics                                        │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐ │
│ │ Total: 12  │ │ Valid: 10  │ │ 2.4 MB     │ │ Types  │ │
│ │ files      │ │ files ✓    │ │ total      │ │ .md... │ │
│ └────────────┘ └────────────┘ └────────────┘ └────────┘ │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Selected Files                                           │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 📄 document-name.md                    ✓  1.2 KB   │   │
│ └────────────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 📄 another-file.docx                   ✓  450 KB   │   │
│ └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

#### CSS Specification

```css
/* Statistics Grid */
.stats-grid-glass {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card-glass {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-card-glass .stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #FFFFFF;
}

.stat-card-glass .stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.60);
  margin-top: 4px;
}

/* File List Container */
.file-list-glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 12px;
  padding: 16px;
  max-height: 256px;
  overflow-y: auto;
}

/* Individual File Item */
.file-item-glass {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.file-item-glass:hover {
  background: rgba(255, 255, 255, 0.10);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateX(4px);
}

.file-item-glass:last-child {
  margin-bottom: 0;
}

.file-item-glass .file-icon {
  width: 32px;
  height: 32px;
  background: rgba(80, 175, 123, 0.15);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #50AF7B;
}

.file-item-glass .file-name {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.90);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-item-glass .file-size {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.50);
}

.file-item-glass .file-status {
  color: #50AF7B;
  font-size: 16px;
}
```

### 5.4 Textarea Input

Glass-styled textarea for project instructions.

```css
.textarea-glass {
  /* Glass Effect */
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  /* Border */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;

  /* Text */
  color: #FFFFFF;
  font-size: 18px;
  line-height: 1.6;

  /* Spacing */
  padding: 20px;
  width: 100%;
  resize: vertical;
  min-height: 160px;

  /* Transition */
  transition: all 0.2s ease;
}

.textarea-glass::placeholder {
  color: rgba(255, 255, 255, 0.40);
}

.textarea-glass:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.25);
}

.textarea-glass:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.10);
  border-color: rgba(80, 175, 123, 0.60);
  box-shadow: 0 0 0 3px rgba(80, 175, 123, 0.15);
}
```

### 5.5 Primary Button

The "Generate Chart" CTA button.

```css
.button-glass-primary {
  /* Background with gradient */
  background: linear-gradient(
    135deg,
    #da291c 0%,
    #b82317 100%
  );

  /* Border with subtle glass edge */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;

  /* Shadow */
  box-shadow:
    0 4px 16px rgba(218, 41, 28, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);

  /* Text */
  color: #FFFFFF;
  font-size: 18px;
  font-weight: 600;

  /* Spacing */
  padding: 16px 32px;

  /* Transition */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.button-glass-primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 24px rgba(218, 41, 28, 0.40),
    inset 0 1px 0 rgba(255, 255, 255, 0.20);
}

.button-glass-primary:active {
  transform: translateY(0);
  box-shadow:
    0 2px 8px rgba(218, 41, 28, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}

.button-glass-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

### 5.6 Upload Icon

Redesigned cloud upload icon with glass effect.

```css
.upload-icon-container {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  transition: all 0.3s ease;
}

.upload-icon-container svg {
  width: 40px;
  height: 40px;
  color: rgba(255, 255, 255, 0.80);
  transition: all 0.3s ease;
}

.dropzone-glass:hover .upload-icon-container {
  background: rgba(255, 255, 255, 0.12);
  transform: scale(1.05);
}

.dropzone-glass:hover .upload-icon-container svg {
  color: #FFFFFF;
  transform: translateY(-2px);
}
```

---

## 6. Typography

### Font Stack

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
             Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
```

### Type Scale

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| **H1 (Page Title)** | 48px / 3rem | 700 | 1.1 | -0.02em |
| **H2 (Section Title)** | 28px / 1.75rem | 600 | 1.2 | -0.01em |
| **Body Large** | 18px / 1.125rem | 400 | 1.6 | 0 |
| **Body** | 16px / 1rem | 400 | 1.5 | 0 |
| **Caption** | 14px / 0.875rem | 400 | 1.4 | 0.01em |
| **Small** | 12px / 0.75rem | 500 | 1.3 | 0.02em |

### Text Rendering

```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

---

## 7. Animations & Micro-interactions

### Transition Timing Functions

```css
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quad: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-in-out-quad: cubic-bezier(0.455, 0.03, 0.515, 0.955);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Hover Animations

```css
/* Lift effect for cards */
@keyframes lift {
  from { transform: translateY(0); }
  to { transform: translateY(-4px); }
}

/* Glow pulse for drag-over state */
@keyframes glow-pulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(80, 175, 123, 0.3);
  }
  50% {
    box-shadow: 0 0 40px rgba(80, 175, 123, 0.5);
  }
}

/* Subtle scale for interactive elements */
@keyframes subtle-scale {
  from { transform: scale(1); }
  to { transform: scale(1.02); }
}
```

### Loading States

```css
/* Glass spinner */
.spinner-glass {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: #da291c;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Skeleton loading for file items */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton-glass {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 25%,
    rgba(255, 255, 255, 0.10) 50%,
    rgba(255, 255, 255, 0.05) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### Page Load Animation

```css
/* Fade in and slide up for main content */
.glass-panel-animate {
  animation: fadeSlideUp 0.6s var(--ease-out-expo) forwards;
  opacity: 0;
}

@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Staggered children */
.glass-panel-animate > *:nth-child(1) { animation-delay: 0.1s; }
.glass-panel-animate > *:nth-child(2) { animation-delay: 0.2s; }
.glass-panel-animate > *:nth-child(3) { animation-delay: 0.3s; }
```

---

## 8. Accessibility Requirements

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Color Contrast** | All text meets 4.5:1 ratio against glass backgrounds |
| **Focus Indicators** | 3px green (#50AF7B) focus ring with 2px offset |
| **Reduced Motion** | Respects `prefers-reduced-motion` |
| **Screen Reader** | Proper ARIA labels, roles, and live regions |
| **Keyboard Navigation** | Full tab navigation support |

### Focus Styles

```css
/* Enhanced focus for glass elements */
.glass-focusable:focus {
  outline: none;
}

.glass-focusable:focus-visible {
  outline: 3px solid #50AF7B;
  outline-offset: 2px;
  box-shadow: 0 0 0 6px rgba(80, 175, 123, 0.15);
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .dropzone-glass:hover {
    transform: none;
  }
}
```

### High Contrast Mode

```css
@media (prefers-contrast: high) {
  .glass-panel,
  .dropzone-glass,
  .file-item-glass {
    border-width: 2px;
    border-color: rgba(255, 255, 255, 0.5);
  }

  .button-glass-primary {
    border: 2px solid #FFFFFF;
  }
}
```

---

## 9. CSS Implementation

### CSS Custom Properties (Variables)

```css
:root {
  /* Colors */
  --color-navy-deep: #0c2340;
  --color-navy-mid: #143052;
  --color-navy-light: #1d4168;
  --color-accent-red: #da291c;
  --color-accent-red-hover: #b82317;
  --color-success: #50AF7B;

  /* Glass Effects */
  --glass-bg-subtle: rgba(255, 255, 255, 0.05);
  --glass-bg-light: rgba(255, 255, 255, 0.08);
  --glass-bg-medium: rgba(255, 255, 255, 0.10);
  --glass-bg-strong: rgba(255, 255, 255, 0.15);
  --glass-border: rgba(255, 255, 255, 0.15);
  --glass-border-hover: rgba(255, 255, 255, 0.25);
  --glass-border-active: rgba(255, 255, 255, 0.40);

  /* Blur */
  --blur-sm: 8px;
  --blur-md: 12px;
  --blur-lg: 16px;
  --blur-xl: 20px;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* Shadows */
  --shadow-glass-sm:
    0 4px 16px rgba(12, 35, 64, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  --shadow-glass-md:
    0 8px 32px rgba(12, 35, 64, 0.20),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  --shadow-glass-lg:
    0 12px 48px rgba(12, 35, 64, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.2s ease;
  --transition-slow: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Tailwind CSS Extension

Add to `tailwind.config`:

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        'navy': {
          deep: '#0c2340',
          mid: '#143052',
          light: '#1d4168',
          pale: '#2a5580',
        },
        'accent-red': '#da291c',
        'accent-red-hover': '#b82317',
        'success': '#50AF7B',
      },
      backdropBlur: {
        'xs': '4px',
        'glass': '12px',
        'glass-lg': '20px',
      },
      borderRadius: {
        'glass': '16px',
        'glass-lg': '24px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(12, 35, 64, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        'glass-lg': '0 12px 48px rgba(12, 35, 64, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      },
    },
  },
}
```

### Utility Classes

```css
/* Glass background utilities */
.bg-glass-subtle { background: var(--glass-bg-subtle); }
.bg-glass-light { background: var(--glass-bg-light); }
.bg-glass-medium { background: var(--glass-bg-medium); }
.bg-glass-strong { background: var(--glass-bg-strong); }

/* Glass border utilities */
.border-glass { border: 1px solid var(--glass-border); }
.border-glass-hover { border: 1px solid var(--glass-border-hover); }
.border-glass-dashed { border: 2px dashed var(--glass-border); }

/* Blur utilities */
.blur-glass {
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
}
.blur-glass-lg {
  backdrop-filter: blur(var(--blur-xl));
  -webkit-backdrop-filter: blur(var(--blur-xl));
}

/* Combined glass effect */
.glass {
  background: var(--glass-bg-light);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-sm);
}

.glass-lg {
  background: var(--glass-bg-light);
  backdrop-filter: blur(var(--blur-xl));
  -webkit-backdrop-filter: blur(var(--blur-xl));
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-lg);
}
```

---

## 10. Responsive Behavior

### Breakpoints

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| **Mobile** | < 640px | Single column, reduced padding, smaller blur |
| **Tablet** | 640px - 1024px | Two-column stats, medium padding |
| **Desktop** | > 1024px | Full layout, maximum blur effects |

### Responsive Adjustments

```css
/* Mobile optimizations */
@media (max-width: 640px) {
  .form-glass-panel {
    padding: 24px;
    border-radius: 16px;
    backdrop-filter: blur(12px); /* Reduced for performance */
  }

  .dropzone-glass {
    min-height: 240px;
    padding: 24px;
  }

  .stats-grid-glass {
    grid-template-columns: repeat(2, 1fr);
  }

  .upload-icon-container {
    width: 60px;
    height: 60px;
  }

  .button-glass-primary {
    width: 100%;
    justify-content: center;
  }
}

/* Tablet adjustments */
@media (min-width: 640px) and (max-width: 1024px) {
  .form-glass-panel {
    padding: 36px;
  }

  .stats-grid-glass {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Large screens */
@media (min-width: 1920px) {
  .form-glass-panel {
    padding: 64px;
    backdrop-filter: blur(24px);
  }

  .dropzone-glass {
    min-height: 400px;
  }
}
```

---

## Implementation Checklist

- [ ] Add CSS custom properties to `style.css`
- [ ] Update Tailwind config with new theme extensions
- [ ] Apply gradient background to `body`
- [ ] Restyle main form container with glass effect
- [ ] Restyle textarea with glass input style
- [ ] Restyle dropzone with glass effect and new states
- [ ] Update file list display with glass cards
- [ ] Restyle statistics grid with glass cards
- [ ] Update button styling
- [ ] Add upload icon glass container
- [ ] Implement hover/drag animations
- [ ] Add loading state animations
- [ ] Test accessibility (focus, contrast, reduced motion)
- [ ] Test responsive behavior
- [ ] Cross-browser test (Safari webkit prefixes)

---

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 76+ | Full | Native backdrop-filter |
| Firefox 103+ | Full | Native backdrop-filter |
| Safari 9+ | Full | Requires -webkit- prefix |
| Edge 79+ | Full | Chromium-based |
| iOS Safari 9+ | Full | Requires -webkit- prefix |

**Fallback for older browsers:**

```css
@supports not (backdrop-filter: blur(1px)) {
  .glass, .glass-lg {
    background: rgba(20, 48, 82, 0.95);
  }
}
```

---

*Document Version: 1.0*
*Created: November 2024*
*Based on reference: Glassmorphic fitness dashboard UI*
