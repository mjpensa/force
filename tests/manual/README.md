# Manual Testing Tools

This directory contains HTML-based tools for manual testing and diagnostics during development.

## Files

### test-slide.html
**Purpose**: Test slide template rendering in isolation

**Usage**:
1. Open in browser: `http://localhost:3000/tests/manual/test-slide.html`
2. Tests individual slide templates from `Public/SlideTemplates.js`
3. Useful for verifying slide rendering without full presentation context

**Dependencies**:
- `Public/SlideTemplates.js`

### test-diagnostic.html
**Purpose**: Diagnostic testing UI for presentation components

**Usage**:
1. Open in browser: `http://localhost:3000/tests/manual/test-diagnostic.html`
2. Provides diagnostic information about slide rendering
3. Tests SlideTemplates module integration

**Dependencies**:
- `Public/SlideTemplates.js`

## Notes

- These are **development tools only**, not part of the production application
- Not linked in any production HTML files
- Used for local testing and debugging during development
- To use, start the server (`npm start`) and navigate to the URLs above

## Related Files

- Production slide rendering: `Public/PresentationSlides.js`
- Slide templates: `Public/SlideTemplates.js`
- Slide data model: `Public/SlideDataModel.js`
