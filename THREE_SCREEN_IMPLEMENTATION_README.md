# Three-Screen Architecture Implementation Guide

## 📚 Documentation Overview

This directory contains comprehensive documentation for implementing the three-screen architecture (Roadmap, Slides, Document) for the Force research platform.

### Document Structure

```
📁 Documentation Suite
│
├── 📄 SCALABILITY_ASSESSMENT.md          (30 min read)
│   └── Overall architecture analysis and recommendations
│
├── 📄 DATA_FLOW_DIAGRAM.md               (20 min read)
│   └── Visual data flow from research to all three screens
│
├── 📄 GOOGLE_DOCS_UI_GUIDE.md            (25 min read)
│   └── Complete design system and UI implementation
│
├── 📄 IMPLEMENTATION_PLAN.md             (45 min read) ⭐ START HERE
│   └── Phase 0: Foundation & Infrastructure
│   └── Phase 1: Design System Implementation
│
├── 📄 IMPLEMENTATION_PLAN_PART2.md       (40 min read)
│   └── Phase 2: Unified Content Generation
│   └── Phase 3: Slides View Implementation
│
└── 📄 IMPLEMENTATION_PLAN_PART3.md       (35 min read)
    └── Phase 4: Document View Implementation
    └── Phase 5: Integration & Testing
    └── Phase 6: Polish & Optimization
    └── Rollback Procedures
    └── Testing Strategy
    └── Deployment Checklist
```

---

## 🚀 Quick Start Guide

### For Developers

**Step 1: Read the Assessment** (30 min)
```bash
# Understand the current state and goals
cat SCALABILITY_ASSESSMENT.md
```

**Step 2: Review Data Flow** (20 min)
```bash
# Understand how data moves through the system
cat DATA_FLOW_DIAGRAM.md
```

**Step 3: Review UI Design** (25 min)
```bash
# Understand the design system
cat GOOGLE_DOCS_UI_GUIDE.md
```

**Step 4: Follow Implementation Plan** (Start here!)
```bash
# Begin with Phase 0
cat IMPLEMENTATION_PLAN.md

# Then Phase 2-3
cat IMPLEMENTATION_PLAN_PART2.md

# Finally Phase 4-6
cat IMPLEMENTATION_PLAN_PART3.md
```

### For Project Managers

**Read these in order:**
1. `SCALABILITY_ASSESSMENT.md` - Section: "Executive Summary" and "Implementation Roadmap"
2. `IMPLEMENTATION_PLAN.md` - Section: "Table of Contents" for timeline
3. `IMPLEMENTATION_PLAN_PART3.md` - Section: "Success Metrics"

**Estimated timeline:** 6-7 weeks total

---

## 📋 Implementation Phases

### Phase 0: Foundation & Infrastructure (3-4 days) ✅
**Priority:** Critical | **Dependencies:** None

- [ ] Set up SQLite database
- [ ] Create StateManager for client-side state
- [ ] Reorganize project structure
- [ ] Test database operations

**Key Deliverables:**
- `server/db.js` - Database layer
- `Public/components/shared/StateManager.js` - State management
- Migration scripts

---

### Phase 1: Design System (3-4 days) ✅
**Priority:** High | **Dependencies:** Phase 0

- [ ] Create design tokens (CSS variables)
- [ ] Build app shell styles
- [ ] Create shared component styles
- [ ] Test responsive layouts

**Key Deliverables:**
- `Public/styles/design-system.css` - Design tokens
- `Public/styles/app-shell.css` - Application layout
- Component-specific stylesheets

---

### Phase 2: Unified Content Generation (5-6 days) ⚠️
**Priority:** Critical | **Dependencies:** Phase 0, Phase 1

- [ ] Create AI prompts for all three formats
- [ ] Build unified `/generate-content` endpoint
- [ ] Implement parallel generation
- [ ] Test with real data

**Key Deliverables:**
- `server/prompts/roadmap.js` - Roadmap generation
- `server/prompts/slides.js` - Slides generation
- `server/prompts/document.js` - Document generation
- `server/routes/content.js` - API endpoints
- `server/generators.js` - Parallel processing

**Expected Output:**
```json
{
  "jobId": "uuid",
  "sessionId": "uuid",
  "progress": {
    "roadmap": "complete",
    "slides": "processing",
    "document": "pending"
  }
}
```

---

### Phase 3: Slides View (5-6 days) 📽️
**Priority:** High | **Dependencies:** Phase 1, Phase 2

- [ ] Build SlidesView component
- [ ] Implement slide navigation
- [ ] Add keyboard controls
- [ ] Create slide templates
- [ ] Test presentation mode

**Key Deliverables:**
- `Public/components/views/SlidesView.js` - Main component
- `Public/styles/slides-view.css` - Slide styles
- Fullscreen mode
- Thumbnail navigation

**Features:**
- Previous/Next navigation
- Keyboard shortcuts (arrows, space, F11)
- Thumbnail preview
- Fullscreen mode
- 5+ slide types (title, content, timeline, table, summary)

---

### Phase 4: Document View (5-6 days) 📄
**Priority:** High | **Dependencies:** Phase 1, Phase 2

- [ ] Build DocumentView component
- [ ] Create table of contents
- [ ] Implement scroll spy
- [ ] Style content blocks
- [ ] Add print support

**Key Deliverables:**
- `Public/components/views/DocumentView.js` - Main component
- `Public/styles/document-view.css` - Document styles
- Table of contents with scroll spy
- Print-friendly layout

**Features:**
- Sticky table of contents
- Active section highlighting
- Multiple content block types (paragraph, list, table, quote)
- Responsive layout
- Print optimization

---

### Phase 5: Integration & Testing (4-5 days) 🔗
**Priority:** Critical | **Dependencies:** All previous phases

- [ ] Update frontend entry points
- [ ] Refactor chart.html for multi-view
- [ ] Update chart-renderer.js
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write E2E tests

**Key Deliverables:**
- Updated `Public/main.js` - Job submission & polling
- Updated `Public/chart.html` - Multi-view shell
- Updated `Public/chart-renderer.js` - View orchestrator
- Test suites (unit, integration, E2E)

**Test Coverage Target:** > 80%

---

### Phase 6: Polish & Optimization (3-4 days) ✨
**Priority:** Medium | **Dependencies:** Phase 5

- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Browser testing
- [ ] Error handling
- [ ] Documentation

**Key Focus Areas:**
- Lighthouse score > 90
- WCAG 2.1 AA compliance
- Cross-browser compatibility
- User-friendly error messages
- Complete documentation

---

## 📊 Success Metrics

### Technical Performance
| Metric | Target | Measurement |
|--------|--------|-------------|
| Page load time | < 2s | Lighthouse |
| Content generation | < 30s per view | Server logs |
| Error rate | < 1% | Error monitoring |
| Database queries | < 100ms | Query profiling |

### User Experience
| Metric | Target | Measurement |
|--------|--------|-------------|
| Task completion rate | > 90% | User testing |
| User satisfaction | > 4/5 | Surveys |
| Time to first view | < 5s | Analytics |
| View switching time | < 1s | Performance API |

### Code Quality
| Metric | Target | Measurement |
|--------|--------|-------------|
| Test coverage | > 80% | Jest/Coverage |
| Security vulnerabilities | 0 critical | npm audit |
| Maintainability score | > B | CodeClimate |
| Documentation coverage | > 90% | JSDoc |

---

## 🔧 Technology Stack

### Frontend
- **Language:** Vanilla JavaScript (ES6 modules)
- **Styling:** TailwindCSS + Custom CSS (Design System)
- **State Management:** Custom StateManager class
- **Routing:** Hash-based Router
- **Build Tool:** Vite (optional, recommended)

### Backend
- **Runtime:** Node.js (>= 16.x)
- **Framework:** Express.js
- **Database:** SQLite (better-sqlite3)
- **AI:** Google Gemini API
- **Validation:** Zod schemas

### Testing
- **Unit:** Jest
- **Integration:** Supertest
- **E2E:** Playwright
- **Coverage:** Istanbul/NYC

---

## 🛡️ Risk Management

### High-Risk Areas

1. **AI Generation Quality**
   - **Risk:** Gemini API may produce inconsistent results
   - **Mitigation:**
     - Implement strict Zod schemas
     - Add validation layers
     - Create fallback templates
     - Monitor generation quality

2. **Database Migration**
   - **Risk:** Data loss during in-memory → SQLite migration
   - **Mitigation:**
     - Backup before migration
     - Test migration scripts thoroughly
     - Implement rollback procedures
     - Keep in-memory as fallback

3. **Performance at Scale**
   - **Risk:** Parallel generation may overload server
   - **Mitigation:**
     - Implement rate limiting
     - Add job queuing system
     - Monitor resource usage
     - Consider worker threads

4. **Browser Compatibility**
   - **Risk:** ES6 modules may not work in older browsers
   - **Mitigation:**
     - Use Vite for transpilation
     - Add polyfills for older browsers
     - Test on target browsers
     - Document minimum requirements

---

## 📝 Rollback Strategy

### If Things Go Wrong

**Immediate Rollback** (< 5 minutes)
```bash
# Stop server
pm2 stop force

# Checkout previous version
git checkout pre-three-screens-deployment

# Restore database
cp data/force.db.backup.latest data/force.db

# Restart
pm2 start force
```

**Partial Rollback** (keep database, rollback code)
```bash
# Rollback code only
git revert <commit-hash>

# Restart server
pm2 restart force
```

**Graceful Rollback** (migrate users back)
```bash
# Run reverse migration
node server/rollback-migration.js

# Update code
git checkout stable-branch

# Restart
pm2 restart force
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue: Database locked**
```bash
# Solution: Check for stale connections
lsof | grep force.db
kill <pid>
```

**Issue: Content generation hangs**
```bash
# Solution: Check job status
curl http://localhost:3000/job/<jobId>

# Restart job
curl -X POST http://localhost:3000/retry-job/<jobId>
```

**Issue: View not loading**
```bash
# Solution: Check browser console for errors
# Verify session exists
curl http://localhost:3000/session/<sessionId>
```

### Debug Mode

Enable debug logging:
```javascript
// In server/config.js
export const config = {
  logLevel: 'debug',  // Change from 'info'
  // ...
};
```

---

## 🎯 Next Steps

### For Development Team

1. **Week 1-2:** Complete Phases 0-1 (Foundation & Design)
2. **Week 3:** Complete Phase 2 (Content Generation)
3. **Week 4:** Complete Phase 3 (Slides View)
4. **Week 5:** Complete Phase 4 (Document View)
5. **Week 6:** Complete Phase 5 (Integration & Testing)
6. **Week 7:** Complete Phase 6 (Polish & Deployment)

### For Stakeholders

- **Weekly demos:** Every Friday, demo progress
- **Milestone reviews:** After each phase completion
- **UAT (User Acceptance Testing):** Week 6
- **Production deployment:** Week 7

---

## 📚 Additional Resources

### Documentation
- [Google Docs-like UI Guide](./GOOGLE_DOCS_UI_GUIDE.md) - Complete design system
- [Data Flow Diagram](./DATA_FLOW_DIAGRAM.md) - Visual architecture
- [Scalability Assessment](./SCALABILITY_ASSESSMENT.md) - Architecture analysis

### External Resources
- [Express.js Documentation](https://expressjs.com/)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)
- [Zod Validation](https://github.com/colinhacks/zod)
- [Playwright Testing](https://playwright.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## ✅ Checklist: Before You Start

- [ ] Read `SCALABILITY_ASSESSMENT.md`
- [ ] Review `DATA_FLOW_DIAGRAM.md`
- [ ] Study `GOOGLE_DOCS_UI_GUIDE.md`
- [ ] Set up development environment
- [ ] Create feature branch
- [ ] Backup current database
- [ ] Install dependencies (`npm install better-sqlite3`)
- [ ] Review all three implementation plan documents
- [ ] Understand rollback procedures
- [ ] Set up monitoring and logging

---

## 📈 Progress Tracking

Track your progress:

```markdown
### Phase 0: Foundation ⬜ 0/3
- [ ] Database setup
- [ ] StateManager
- [ ] Project restructuring

### Phase 1: Design System ⬜ 0/4
- [ ] Design tokens
- [ ] App shell
- [ ] Component styles
- [ ] Responsive testing

### Phase 2: Content Generation ⬜ 0/4
- [ ] Prompts created
- [ ] API endpoints
- [ ] Parallel generation
- [ ] Testing

### Phase 3: Slides View ⬜ 0/5
- [ ] Component built
- [ ] Navigation working
- [ ] Styles complete
- [ ] Keyboard controls
- [ ] Testing

### Phase 4: Document View ⬜ 0/5
- [ ] Component built
- [ ] TOC working
- [ ] Scroll spy
- [ ] Styles complete
- [ ] Testing

### Phase 5: Integration ⬜ 0/5
- [ ] Frontend updated
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] All passing

### Phase 6: Polish ⬜ 0/5
- [ ] Performance optimized
- [ ] Accessibility audit
- [ ] Browser testing
- [ ] Documentation
- [ ] Ready for deployment
```

---

## 🎉 Conclusion

This implementation will transform your Force platform from a single Gantt chart view into a comprehensive three-screen research platform with:

✅ **Roadmap View** - Interactive Gantt chart (existing, enhanced)
✅ **Slides View** - Professional presentation mode (new)
✅ **Document View** - Long-form report reader (new)

**Total Effort:** 6-7 weeks
**Expected Outcome:** Google Docs-like UI with three complementary views
**Maintainability:** Significantly improved with modular architecture

Good luck! 🚀

---

**Questions?** Review the detailed implementation plans or open an issue in the repository.
