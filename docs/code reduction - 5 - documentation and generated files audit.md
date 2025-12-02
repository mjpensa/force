# Code Reduction Plan 5: Documentation & Generated Files Audit

**Estimated Reduction:** Repository size reduction, improved maintainability
**Risk Level:** Very Low
**Priority:** Low (Cleanup/Housekeeping)

---

## Overview

This plan targets non-source-code files that inflate repository size without contributing to functionality:

1. **Documentation files** (28 markdown files, ~22,215 LOC)
2. **Training data** (22 DOCX files + 5 markdown samples)
3. **Training directory size** (~21 MB)
4. **Generated files** (should not be in repo)
5. **Historical/planning documents**

**Note:** The `assets/` directory referenced in earlier documentation does not exist.

---

## Current Non-Code Inventory

### Documentation (`docs/`)

**Total: 63 files | Size: 3.1 MB**

| File/Directory | Size | Purpose | Action |
|---------------|------|---------|--------|
| `CODE_CLEANUP_PLAN.md` | 17 KB | Cleanup planning | Review |
| `PERFORMANCE_REVIEW_PLAN.md` | 32 KB | Performance planning | Review |
| `REDIS_INTEGRATION_DESIGN.md` | 49 KB | Redis design | Keep |
| `code reduction - 1-5` | ~50 KB | Code reduction plans | Keep/Update |
| `docs/implementation-plans/` | 5 files | Implementation specs | Keep |
| `docs/training-plans/` | 15 files | Training documentation | Archive |
| `docs/screenshots/` | 34 PNG files (~2.5 MB) | UI screenshots | Prune old |

### Training Data (`training/`)

**Total: 33 files | Size: ~21 MB**

| Content | Count | Size | Action |
|---------|-------|------|--------|
| sample-set-1/ | 5 markdown files | ~167 KB | Review (training samples) |
| sample-set-2/ | 12 DOCX + 2 PNG | ~6.2 MB | Keep minimal set |
| sample-set-3/ | 10 DOCX files | ~15 MB | Keep minimal set |

**Note:** sample-set-3 contains large files (AI Regulation: 6.4 MB, EU AI Act: 5.6 MB)

### Assets (`assets/`)

**Status: Directory does not exist**

The `assets/` directory referenced in earlier documentation has been removed or relocated.

### Generated Files (Should Not Be Committed)

| Pattern | Action |
|---------|--------|
| `node_modules/` | Already gitignored |
| `*.log` | Ensure gitignored |
| `dist/` | Should be gitignored |
| `coverage/` | Should be gitignored |
| `data/*.db` | Should be gitignored |
| `data/cache/` | Should be gitignored |

---

## Phase 1: Documentation Audit (Day 1)

### 1.1 Inventory All Documentation

```bash
# List all markdown files with sizes
find . -name "*.md" -exec ls -lh {} \; | sort -k5 -h > reports/docs-inventory.txt

# List all documentation directories
du -sh docs/* > reports/docs-sizes.txt
```

### 1.2 Categorize Documentation

| Category | Files | Action |
|----------|-------|--------|
| **Essential** | README.md, ARCHITECTURE | Keep in repo |
| **API Documentation** | API docs | Keep in repo |
| **Historical Plans** | *_PLAN.md, *_REPORT.md | Move to wiki/archive |
| **Meeting Notes** | Any notes | Move to wiki/delete |
| **Outdated Specs** | Old design docs | Archive or delete |

### 1.3 Create Archive Strategy

**Option A: Git Archive Branch**
```bash
# Create archive branch
git checkout -b archive/historical-docs

# Move files
git mv docs/BUG_FIX_IMPLEMENTATION_PLAN.md archive/
git mv docs/BUG_REVIEW_REPORT.md archive/
# ... etc

git commit -m "Archive historical documentation"
git checkout main
```

**Option B: Separate Archive Repository**
```bash
# Create new repo for archives
# Move historical docs there
# Delete from main repo
```

**Option C: GitHub Wiki**
- Move planning docs to wiki
- Link from main README
- Delete from repo

### 1.4 Documentation Cleanup Checklist

- [ ] Remove outdated screenshots
- [ ] Update README if referencing deleted docs
- [ ] Consolidate duplicate documentation
- [ ] Remove TODOs that are done
- [ ] Delete empty or placeholder docs

---

## Phase 2: Training Data Optimization (Day 2)

### 2.1 Audit Training Data

```bash
# List all training files
find training/ -type f -exec ls -lh {} \; > reports/training-inventory.txt

# Total size
du -sh training/
```

### 2.2 Determine Minimal Training Set

**Current:** 3 sample sets with 22 DOCX files + 5 markdown files (~21 MB total)

**Goal:** 1 representative sample set with 5-8 files (~5 MB)

| Keep | Reason |
|------|--------|
| 1 financial document | Tests financial parsing |
| 1 regulatory document | Tests compliance content |
| 1 technical document | Tests technical content |
| 1 presentation | Tests PPTX handling |
| 1 complex document | Tests edge cases |

### 2.3 Move Training Data

**Option A: Git LFS**
```bash
# Install Git LFS
git lfs install

# Track large training files
git lfs track "training/**/*.docx"
git lfs track "training/**/*.pptx"

# Commit changes
git add .gitattributes
git commit -m "Move training data to Git LFS"
```

**Option B: External Storage**
- Move to S3/GCS bucket
- Add download script
- Update README with instructions

**Option C: Reduce In-Repo**
```bash
# Keep minimal set
mkdir training/minimal
cp training/sample1/key-doc.docx training/minimal/
# ... copy essential files only

# Remove rest
rm -rf training/sample1 training/sample2 training/sample3

# Rename
mv training/minimal training/samples
```

### 2.4 Update Code References

```bash
# Find all training data references
grep -rn "training/" server/ Public/ --include="*.js" > reports/training-refs.txt
```

Update paths in code if needed.

---

## Phase 3: Asset Optimization (Day 3)

**Note:** The `assets/` directory does not currently exist. This phase should be skipped or repurposed.

### 3.1 Audit for Scattered Assets

```bash
# Find large binary files in the repo
find . -type f \( -name "*.pptx" -o -name "*.png" -o -name "*.jpg" -o -name "*.svg" \) -exec ls -lh {} \;

# Check training directory for large images
ls -lah training/sample-set-2/*.png
```

### 3.2 Optimize Training Images

**Large PNG files in training/sample-set-2/:**
- `Payments Roadmap_v2.png` (~3.1 MB)
- `Payments Roadmap_v3.png` (~2.7 MB)

```bash
# Options:
# 1. Compress images
# 2. Move to Git LFS
# 3. Move to releases (download on demand)
```

### 3.3 Asset Management Strategy

| Asset Type | Location | Strategy |
|------------|----------|----------|
| Training PNGs | training/sample-set-2/ | Compress or move to LFS |
| Screenshots | docs/screenshots/ | Keep essential only, prune old |
| Training DOCX | training/ | Keep minimal representative set |

---

## Phase 4: Generated Files Cleanup (Day 4)

### 4.1 Identify Generated Files in Repo

```bash
# Check what's tracked that shouldn't be
git ls-files | grep -E "\.log$|dist/|coverage/|\.cache|\.db$"
```

### 4.2 Update .gitignore

Ensure `.gitignore` includes:

```gitignore
# Dependencies
node_modules/

# Build outputs
dist/
build/
*.min.js
*.min.css

# Test outputs
coverage/
.nyc_output/

# Logs
*.log
npm-debug.log*

# Caches
.cache/
*.cache
.eslintcache

# Database files
*.db
*.sqlite
data/*.db
data/cache/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Reports (generated)
reports/

# Temp files
temp/
tmp/
*.tmp
```

### 4.3 Remove Tracked Generated Files

```bash
# Remove from git but keep locally
git rm --cached <file>

# Or remove completely
git rm <file>
```

### 4.4 Verify Build Regenerates Files

```bash
# Ensure build creates needed files
npm run build

# Check nothing critical was removed
npm start
npm test
```

---

## Phase 5: Repository Size Analysis (Day 5)

### 5.1 Analyze Git History Size

```bash
# Install git-sizer
# (or use git's built-in)

# Check repository size
git count-objects -vH

# Find large files in history
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  awk '/^blob/ {print $3,$4}' | \
  sort -rn | head -20
```

### 5.2 Large File History Cleanup (Optional)

If large files were committed historically:

```bash
# WARNING: Rewrites history - coordinate with team

# Install git-filter-repo
pip install git-filter-repo

# Remove large files from history
git filter-repo --path assets/large-file.pptx --invert-paths
```

### 5.3 Final Size Check

```bash
# After cleanup
git gc --aggressive --prune=now
git count-objects -vH
```

---

## Phase 6: Documentation Standards (Day 6)

### 6.1 Establish Documentation Policy

Create `CONTRIBUTING.md` section:

```markdown
## Documentation Standards

### What to Include in Repo
- README.md - Project overview
- ARCHITECTURE.md - System design
- API documentation
- Code comments for complex logic

### What NOT to Include
- Meeting notes
- Historical planning documents
- Large binary files (>1MB)
- Generated files
- Personal notes

### Where to Put Other Docs
- Planning docs → GitHub Wiki
- Historical docs → Archive branch
- Large assets → GitHub Releases
```

### 6.2 Create Documentation Index

Update README with clear documentation structure:

```markdown
## Documentation

- [Architecture](./ARCHITECTURE.md) - System design overview
- [API Reference](./docs/api.md) - API documentation
- [Contributing](./CONTRIBUTING.md) - How to contribute

### Historical Documentation
Archived planning documents are available in the [archive branch](link) or [wiki](link).
```

---

## Phase 7: Implementation & Verification (Day 7)

### 7.1 Execute Cleanup

```bash
# Create backup branch first
git checkout -b backup/pre-doc-cleanup
git checkout main

# Execute each phase
# ... (follow steps above)

# Commit incrementally
git add -A
git commit -m "docs: archive historical planning documents"

git add -A
git commit -m "chore: optimize training data set"

git add -A
git commit -m "chore: optimize assets"

git add -A
git commit -m "chore: update gitignore for generated files"
```

### 7.2 Verify Application Works

```bash
npm install
npm run build
npm test
npm start
```

### 7.3 Verify Nothing Critical Removed

- [ ] Application starts
- [ ] All tests pass
- [ ] Documentation links work
- [ ] Training/sample data accessible
- [ ] Assets load correctly

---

## Expected Outcomes

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Docs LOC | ~22,215 | ~5,000 | ~17,000 LOC |
| Docs Size | ~3.1 MB | ~1 MB | ~2 MB |
| Training Data | ~21 MB | ~5 MB | ~16 MB |
| Screenshots | 34 files (~2.5 MB) | 10-15 files (~1 MB) | ~1.5 MB |
| Total Repo Reduction | - | - | ~20 MB |
| Doc Files | 28 markdown | 8-10 | 18-20 files |

---

## Files to Archive/Remove

### Archive to Wiki/Branch
- [ ] `docs/training-plans/*` (15 files)
- [ ] `docs/implementation-plans/*` (5 files - review which are still active)
- [ ] Old screenshots (34 files - keep only recent/relevant)

### Remove from Repo
- [ ] Duplicate training samples (sample-set-2 or sample-set-3)
- [ ] Generated/cached files
- [ ] Log files
- [ ] Temporary files

### Optimize
- [ ] `training/sample-set-2/*.png` (compress ~5.8 MB in images)
- [ ] Consider Git LFS for large DOCX files in sample-set-3

---

## Success Criteria

- [ ] Repository size reduced by ~20 MB
- [ ] Essential documentation preserved (README, key design docs)
- [ ] Historical docs archived appropriately (training-plans, old implementation plans)
- [ ] Training data reduced to minimal set (~5 MB from ~21 MB)
- [ ] Screenshots pruned (keep 10-15 from 34)
- [ ] Generated files properly gitignored
- [ ] Application fully functional
- [ ] Clean, professional repository structure
