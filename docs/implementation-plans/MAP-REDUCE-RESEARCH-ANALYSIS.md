# Map-Reduce Research Analysis Implementation Plan

## Overview

Implement a chunked analysis strategy that ensures **100% of user-provided research** is analyzed regardless of size, while maintaining generation quality and reasonable latency.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER UPLOADS RESEARCH                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTENT SIZE CHECK                                   │
│                                                                              │
│   Total chars < 50,000?  ──YES──►  Direct Processing (current flow)         │
│         │                                                                    │
│         NO                                                                   │
│         ▼                                                                    │
│   CHUNKED ANALYSIS FLOW                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 1: CHUNKING                                  │
│                                                                              │
│   Split research into semantic chunks (~20,000 chars each)                  │
│   Preserve file boundaries where possible                                    │
│   Maintain context overlap between chunks                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: PARALLEL EXTRACTION                              │
│                                                                              │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│   │ Chunk 1  │   │ Chunk 2  │   │ Chunk 3  │   │ Chunk N  │                │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘                │
│        │              │              │              │                        │
│        ▼              ▼              ▼              ▼                        │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│   │ Extract  │   │ Extract  │   │ Extract  │   │ Extract  │   (parallel)   │
│   │ Insights │   │ Insights │   │ Insights │   │ Insights │                │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘                │
│        │              │              │              │                        │
│        └──────────────┴──────────────┴──────────────┘                        │
│                              │                                               │
│                              ▼                                               │
│                    Consolidated Insights                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: ARTIFACT GENERATION                              │
│                                                                              │
│   Use consolidated insights (not raw research) for:                         │
│   • Roadmap generation                                                       │
│   • Slides generation                                                        │
│   • Document generation                                                      │
│   • Research analysis                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Infrastructure

### Duration: 2-3 days

### 1.1 Create Chunking Utility

**File**: `server/utils/chunker.js`

```javascript
/**
 * Research Content Chunker
 * 
 * Splits large research content into semantically meaningful chunks
 * while preserving context and file boundaries.
 */

export const CHUNK_CONFIG = {
  targetChunkSize: 20000,      // ~5000 tokens per chunk
  overlapSize: 500,            // Context overlap between chunks
  minChunkSize: 5000,          // Don't create tiny chunks
  maxChunks: 10                // Safety limit
};

/**
 * Split research files into processable chunks
 * @param {Array<{filename: string, content: string}>} files 
 * @returns {Array<{chunkId: number, content: string, sourceFiles: string[]}>}
 */
export function chunkResearchFiles(files) {
  // Implementation
}

/**
 * Check if content needs chunking
 * @param {Array<{filename: string, content: string}>} files 
 * @returns {boolean}
 */
export function needsChunking(files) {
  const totalChars = files.reduce((sum, f) => sum + f.content.length, 0);
  return totalChars > 50000; // ~12,500 tokens
}
```

### 1.2 Create Extraction Service

**File**: `server/utils/insightExtractor.js`

```javascript
/**
 * Insight Extractor
 * 
 * Extracts structured insights from research chunks
 * using targeted LLM prompts.
 */

export const EXTRACTION_SCHEMA = {
  keyFacts: [],           // Important factual statements
  dates: [],              // Dates, timelines, deadlines
  entities: [],           // Companies, people, products
  themes: [],             // Major topics/themes
  recommendations: [],    // Suggested actions
  metrics: [],            // Numbers, statistics, KPIs
  quotes: []              // Important direct quotes
};

/**
 * Extract insights from a single chunk
 * @param {string} chunkContent 
 * @param {number} chunkId 
 * @returns {Promise<ExtractedInsights>}
 */
export async function extractInsights(chunkContent, chunkId) {
  // Implementation - calls Gemini with extraction prompt
}

/**
 * Process all chunks in parallel
 * @param {Array<Chunk>} chunks 
 * @returns {Promise<ConsolidatedInsights>}
 */
export async function processChunksParallel(chunks) {
  // Implementation - Promise.all with rate limiting
}
```

### 1.3 Create Insight Consolidator

**File**: `server/utils/insightConsolidator.js`

```javascript
/**
 * Insight Consolidator
 * 
 * Merges insights from multiple chunks, deduplicates,
 * and creates a coherent consolidated context.
 */

/**
 * Merge insights from all chunks
 * @param {Array<ExtractedInsights>} allInsights 
 * @returns {ConsolidatedInsights}
 */
export function consolidateInsights(allInsights) {
  // Deduplicate facts
  // Merge timelines
  // Combine themes
  // Rank by importance/frequency
}

/**
 * Format consolidated insights for prompt inclusion
 * @param {ConsolidatedInsights} insights 
 * @param {string} contentType - 'roadmap' | 'slides' | 'document'
 * @returns {string}
 */
export function formatForPrompt(insights, contentType) {
  // Different formats optimized for each content type
}
```

---

## Phase 2: Extraction Prompts

### Duration: 1-2 days

### 2.1 Create Extraction Prompt

**File**: `server/prompts/extraction.js`

```javascript
export const extractionSchema = {
  // JSON schema for structured extraction
};

export function generateExtractionPrompt(chunkContent, chunkId, totalChunks) {
  return `You are analyzing research document chunk ${chunkId} of ${totalChunks}.

Extract ALL important information from this content into a structured format.
Be thorough - capture every key fact, date, entity, and insight.

CONTENT TO ANALYZE:
${chunkContent}

Extract into these categories:
1. KEY FACTS: Important statements, findings, conclusions
2. DATES & TIMELINES: Any dates, deadlines, milestones, time periods
3. ENTITIES: Companies, people, products, technologies mentioned
4. THEMES: Major topics, trends, patterns discussed
5. METRICS: Numbers, statistics, percentages, KPIs
6. RECOMMENDATIONS: Suggested actions, next steps, advice
7. QUOTES: Important direct quotes worth preserving

Be comprehensive. Do not summarize - extract specific details.`;
}
```

### 2.2 Content-Type Specific Formatters

Each generator needs insights formatted differently:

```javascript
// For Roadmap - emphasize dates, milestones, phases
export function formatForRoadmap(insights) { }

// For Slides - emphasize key messages, themes, high-impact facts
export function formatForSlides(insights) { }

// For Document - comprehensive, structured by theme
export function formatForDocument(insights) { }

// For Research Analysis - all details, metrics, entities
export function formatForResearchAnalysis(insights) { }
```

---

## Phase 3: Generator Integration

### Duration: 2-3 days

### 3.1 Update generators.js

Modify the main generation flow to use map-reduce when needed:

```javascript
import { needsChunking, chunkResearchFiles } from './utils/chunker.js';
import { processChunksParallel } from './utils/insightExtractor.js';
import { consolidateInsights, formatForPrompt } from './utils/insightConsolidator.js';

async function prepareResearchContext(researchFiles, contentType) {
  // Check if chunking needed
  if (!needsChunking(researchFiles)) {
    // Use existing direct approach
    return formatDirectContent(researchFiles);
  }
  
  console.log(`[MapReduce] Large content detected, using chunked analysis`);
  
  // Chunk the content
  const chunks = chunkResearchFiles(researchFiles);
  console.log(`[MapReduce] Split into ${chunks.length} chunks`);
  
  // Extract insights in parallel
  const allInsights = await processChunksParallel(chunks);
  console.log(`[MapReduce] Extracted insights from all chunks`);
  
  // Consolidate and format
  const consolidated = consolidateInsights(allInsights);
  return formatForPrompt(consolidated, contentType);
}
```

### 3.2 Update Each Generator

Modify `generateRoadmap`, `generateSlides`, `generateDocument`, `generateResearchAnalysis` to use the new `prepareResearchContext` function.

---

## Phase 4: Performance Optimization

### Duration: 1-2 days

### 4.1 Parallel Processing with Rate Limiting

```javascript
import pLimit from 'p-limit';

const limit = pLimit(3); // Max 3 concurrent extraction calls

async function processChunksParallel(chunks) {
  const promises = chunks.map(chunk => 
    limit(() => extractInsights(chunk.content, chunk.chunkId))
  );
  return Promise.all(promises);
}
```

### 4.2 Caching Layer

Cache extracted insights by content hash to avoid re-processing:

```javascript
import { createHash } from 'crypto';

function getContentHash(content) {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

async function extractWithCache(chunk) {
  const hash = getContentHash(chunk.content);
  const cached = await redis.get(`insights:${hash}`);
  if (cached) return JSON.parse(cached);
  
  const insights = await extractInsights(chunk.content, chunk.chunkId);
  await redis.set(`insights:${hash}`, JSON.stringify(insights), 'EX', 3600);
  return insights;
}
```

### 4.3 Streaming Progress Updates

Report progress to the frontend during long operations:

```javascript
async function processChunksWithProgress(chunks, onProgress) {
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const insights = await extractInsights(chunks[i]);
    results.push(insights);
    onProgress({ 
      phase: 'extraction', 
      current: i + 1, 
      total: chunks.length 
    });
  }
  return results;
}
```

---

## Phase 5: Testing & Validation

### Duration: 2 days

### 5.1 Unit Tests

```javascript
// tests/server/utils/chunker.test.js
describe('Research Chunker', () => {
  test('small content bypasses chunking', () => {});
  test('large content is split correctly', () => {});
  test('file boundaries are preserved', () => {});
  test('overlap is maintained between chunks', () => {});
});

// tests/server/utils/insightExtractor.test.js
describe('Insight Extractor', () => {
  test('extracts dates correctly', () => {});
  test('extracts entities correctly', () => {});
  test('handles empty content', () => {});
});

// tests/server/utils/insightConsolidator.test.js
describe('Insight Consolidator', () => {
  test('deduplicates facts', () => {});
  test('merges timelines', () => {});
  test('ranks by importance', () => {});
});
```

### 5.2 Integration Tests

```javascript
describe('Map-Reduce Integration', () => {
  test('generates roadmap from large research', async () => {});
  test('generates slides from large research', async () => {});
  test('all research content is reflected in output', async () => {});
});
```

### 5.3 Quality Validation

Create test cases comparing:
- Output from full content (if fits in context)
- Output from map-reduce approach
- Verify key facts from ALL chunks appear in final output

---

## Phase 6: Monitoring & Observability

### Duration: 1 day

### 6.1 Logging

```javascript
console.log(`[MapReduce] Content size: ${totalChars} chars`);
console.log(`[MapReduce] Chunks created: ${chunks.length}`);
console.log(`[MapReduce] Extraction time: ${extractionMs}ms`);
console.log(`[MapReduce] Consolidation time: ${consolidationMs}ms`);
console.log(`[MapReduce] Total insights extracted: ${totalInsights}`);
```

### 6.2 Metrics

Track:
- Percentage of requests using map-reduce vs direct
- Average chunks per large request
- Extraction latency per chunk
- Total processing time comparison
- Cache hit rate for repeated content

---

## Implementation Timeline

| Phase | Task | Duration | Dependencies |
|-------|------|----------|--------------|
| 1 | Core Infrastructure | 2-3 days | None |
| 2 | Extraction Prompts | 1-2 days | Phase 1 |
| 3 | Generator Integration | 2-3 days | Phases 1, 2 |
| 4 | Performance Optimization | 1-2 days | Phase 3 |
| 5 | Testing & Validation | 2 days | Phase 4 |
| 6 | Monitoring | 1 day | Phase 5 |

**Total: 9-13 days**

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Extraction loses important details | Use comprehensive extraction prompt, test thoroughly |
| Too many API calls | Implement caching, rate limiting, parallel processing |
| Latency too high | Show progress to user, cache results |
| Consolidation creates duplicates | Implement deduplication, semantic similarity matching |
| Cost increase | Monitor usage, implement caching aggressively |

---

## Success Criteria

1. ✅ **Completeness**: Every fact from every chunk appears in consolidated insights
2. ✅ **Quality**: Generated artifacts match or exceed current quality
3. ✅ **Latency**: Total time < 2x current time for large content
4. ✅ **Reliability**: No failures due to content size
5. ✅ **Transparency**: User sees progress during processing

---

## File Structure After Implementation

```
server/
├── utils/
│   ├── chunker.js              # NEW - Content chunking
│   ├── insightExtractor.js     # NEW - Parallel extraction
│   ├── insightConsolidator.js  # NEW - Insight merging
│   └── utils.js                # Existing utilities
├── prompts/
│   ├── extraction.js           # NEW - Extraction prompts
│   ├── roadmap.js              # Modified
│   ├── slides.js               # Modified
│   └── document.js             # Modified
└── generators.js               # Modified - uses map-reduce
```
