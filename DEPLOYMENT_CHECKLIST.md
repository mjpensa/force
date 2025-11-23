# Deployment Checklist - Bifurcation Style v2.3.0

**Quick Reference:** Use this checklist for deploying the bifurcation style enhancement

---

## Pre-Deployment Checklist

### Phase 2: Testing (Must Complete First)
- [ ] Run automated test suite: `cd test-cases/bifurcation && npm test`
- [ ] Average quality score ≥ 4.0
- [ ] All 10 test cases passed
- [ ] Review `test-scoring-analysis.md` for any concerns
- [ ] Document test results in `TEST_RESULTS_FINAL.md`

### Code Review
- [ ] All changes committed to feature branch
- [ ] Create PR: `gh pr create --title "Bifurcation Style Enhancement"`
- [ ] Code review completed and approved
- [ ] All tests passing (unit, integration, bifurcation)
- [ ] No merge conflicts with main
- [ ] CHANGELOG.md updated with v2.3.0 entry

### Environment Preparation
- [ ] Development/staging environment accessible
- [ ] Environment has internet connectivity (can reach generativelanguage.googleapis.com)
- [ ] Google Gemini API key configured in `.env`
- [ ] Database accessible and healthy
- [ ] Monitoring/logging configured

---

## Phase 3: Soft Launch (1 Week)

### Day 1: Deploy to Development
- [ ] Merge feature branch to main
- [ ] Deploy to dev environment
- [ ] Verify deployment: Generate 3 test roadmaps
- [ ] Confirm bifurcation style active (check for paradox hooks, branded concepts)
- [ ] All features working (drag, resize, export, task analysis)
- [ ] Document dev environment URL for testers

### Days 2-5: Internal Testing
- [ ] Identify 5-10 internal testers
- [ ] Send testing instructions and feedback form
- [ ] Collect 20+ test sessions
- [ ] Monitor error logs daily
- [ ] Track metrics:
  - [ ] Generation success rate
  - [ ] Average generation time
  - [ ] User satisfaction ratings
- [ ] Triage and fix reported issues
- [ ] Daily standup to review progress

### Day 6: Final Validation
- [ ] Review all feedback forms
- [ ] Calculate average user rating (target: ≥4.0/5.0)
- [ ] Manually score 10 executive summaries against rubric
- [ ] All critical bugs resolved
- [ ] All high-priority bugs resolved
- [ ] Generation success rate ≥95%
- [ ] No concerning patterns in feedback
- [ ] Go/No-Go meeting held
- [ ] **Decision:** ○ Go ○ No-Go ○ Delay

### Day 7: Production Preparation (if Go)
- [ ] Create release branch: `git checkout -b release/bifurcation-v2.3.0`
- [ ] Update version: `npm version minor`
- [ ] Create release notes in `RELEASE_NOTES_v2.3.0.md`
- [ ] Backup production database
- [ ] Test rollback procedure
- [ ] Schedule deployment window
- [ ] Notify team of deployment schedule
- [ ] Prepare monitoring dashboards

---

## Phase 4: Production Deployment

### Pre-Deployment (Final Checks)
- [ ] All Phase 3 items complete
- [ ] Team ready for deployment
- [ ] On-call schedule prepared for 48 hours post-deployment
- [ ] Rollback procedure documented and tested
- [ ] Communication drafted (internal/external)

### Deployment Steps
- [ ] Enable maintenance mode (if applicable)
- [ ] Pull latest code: `git pull origin main`
- [ ] Install dependencies: `npm install`
- [ ] Run migrations (if any): `npm run migrate`
- [ ] Restart server: `pm2 restart all` or similar
- [ ] Disable maintenance mode

### Smoke Test (Immediately After Deployment)
- [ ] Test health endpoint: `curl https://yourdomain.com/health`
- [ ] Generate 3 roadmaps across different industries
- [ ] Verify bifurcation style in all 3 executive summaries
- [ ] Check for: paradox hooks, branded concepts, specific stats, named companies
- [ ] Test drag-and-drop editing
- [ ] Test chart export to PNG
- [ ] Test task analysis modal
- [ ] Test Q&A chat functionality
- [ ] Review server logs for any errors

### Post-Deployment Monitoring (First 24 Hours)
- [ ] Monitor error logs every 2 hours
- [ ] Track generation success rate (target: ≥95%)
- [ ] Monitor average generation time
- [ ] Watch for user-reported issues
- [ ] Check API rate limits (Google Gemini)
- [ ] Monitor server resource usage (CPU, memory)
- [ ] Collect user feedback

### Post-Deployment Monitoring (First Week)
- [ ] Daily review of error logs
- [ ] Track generation metrics
- [ ] Monitor user feedback
- [ ] Address any reported issues
- [ ] Document lessons learned

---

## Rollback Procedure

**If ANY of these occur, consider rollback:**
- ❌ Generation failure rate >10%
- ❌ Critical bug causing data loss or security issue
- ❌ Server crashes or becomes unresponsive
- ❌ Overwhelmingly negative user feedback
- ❌ Team consensus to rollback

### Rollback Steps
1. [ ] Announce rollback to team
2. [ ] Revert code: `git revert HEAD && git push origin main`
3. [ ] Redeploy: `git pull origin main && npm install && pm2 restart all`
4. [ ] Verify old behavior restored (analytical style, not bifurcation)
5. [ ] Document reason for rollback
6. [ ] Schedule post-mortem meeting
7. [ ] Create action plan for addressing issues
8. [ ] Determine timeline for re-attempting deployment

---

## Success Criteria Summary

### Phase 2 (Testing)
- ✅ Automated tests pass with avg score ≥4.0
- ✅ All 10 test cases successful
- ✅ No systematic failures

### Phase 3 (Soft Launch)
- ✅ 20+ internal test sessions completed
- ✅ Average user rating ≥4.0/5.0
- ✅ Generation success rate ≥95%
- ✅ All critical/high bugs fixed
- ✅ Team consensus: "Go for production"

### Phase 4 (Production)
- ✅ Deployment successful
- ✅ Smoke tests pass
- ✅ No critical issues in first 24 hours
- ✅ User feedback positive
- ✅ Generation metrics healthy

---

## Quick Commands

### Testing
```bash
# Run automated bifurcation tests
cd test-cases/bifurcation
npm install
npm test

# Run just execution
npm run test:execute

# Run just scoring
npm run test:score
```

### Deployment
```bash
# Deploy to dev
git checkout main
git pull origin main
ssh user@dev-server "cd /path/to/project && git pull && npm install && pm2 restart all"

# Create release
git checkout -b release/bifurcation-v2.3.0
npm version minor
git push origin release/bifurcation-v2.3.0

# Deploy to production
ssh user@prod-server "cd /path/to/project && git pull && npm install && pm2 restart all"
```

### Monitoring
```bash
# Check server logs
pm2 logs ai-roadmap-generator

# Check generation success rate
# (Query database or check analytics dashboard)

# Test chart generation
curl -X POST https://yourdomain.com/generate-chart \
  -F "prompt=Test roadmap" \
  -F "researchFiles=@test-file.md"
```

### Rollback
```bash
# Emergency rollback
git revert HEAD
git push origin main
ssh user@prod-server "cd /path/to/project && git pull && npm install && pm2 restart all"
```

---

## Contact Information

**Primary Contact:** [Your Name/Email]
**Backup Contact:** [Backup Name/Email]
**On-Call Schedule:** [Link to schedule]
**Slack Channel:** #bifurcation-deployment
**Issue Tracker:** [GitHub Issues URL]

---

## Notes

- **Current Status:** Phase 2 complete (infrastructure ready), Phase 3 pending
- **Blocker:** Phase 2 testing needs to run in environment with internet access
- **Next Action:** Run automated tests once network connectivity available
- **Estimated Time to Production:** 1-2 weeks after tests complete successfully

---

**Last Updated:** 2025-11-23
**Version:** 1.0
