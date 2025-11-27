# Performance Review Plan: Content Generation Latency Optimization

## Overview

This document outlines a comprehensive phase-by-phase plan to review and optimize the Force AI Research Platform for reduced content generation latency. The platform transforms research documents into interactive formats (Roadmap/Gantt, Slides, Document) using Google Gemini AI.

**Current State:**
- Total generation time: 2-5 minutes for all 4 content types
- Primary bottleneck: Gemini API response time
- Existing optimizations: Parallel generation, API queue, request deduplication

---

## Phase 1: Performance Baseline & Instrumentation

### Objective
Establish accurate performance metrics and implement comprehensive monitoring before making any optimizations.

### Step 1.1: Instrument Server-Side Timing
**Files to Review:**
- `server/routes/content.js:574 lines` - Main content generation endpoints
- `server/generators.js:225 lines` - Core generation orchestration

**Actions:**
1. Add timing markers at each generation stage:
   - File upload receipt → file processing complete
   - File processing complete → Gemini API call initiated
   - Gemini API call initiated → response received (per content type)
   - Response received → JSON parsing complete
   - JSON parsing complete → response sent to client

2. Log detailed timing for each content type:
   ```javascript
   const timings = {
     roadmap: { apiStart, apiEnd, parseTime },
     slides: { apiStart, apiEnd, parseTime },
     document: { apiStart, apiEnd, parseTime },
     researchAnalysis: { apiStart, apiEnd, parseTime }
   };
   ```

3. Track token consumption per request (input/output tokens)

### Step 1.2: Enhance Client-Side Performance Monitoring
**Files to Review:**
- `Public/components/shared/Performance.js:47 lines` - Web Vitals monitoring
- `Public/viewer.js:818 lines` - Main viewer with polling service

**Actions:**
1. Extend `reportWebVitals()` to capture:
   - Time to First Content (TTFC) - when first content type renders
   - Total Generation Wait Time (TGWT)
   - Polling overhead metrics

2. Add custom performance marks:
   ```javascript
   performance.mark('generation-started');
   performance.mark('roadmap-received');
   performance.mark('slides-received');
   performance.mark('document-received');
   performance.mark('all-content-ready');
   ```

### Step 1.3: Create Performance Dashboard/Logging
**Actions:**
1. Create a simple logging endpoint to aggregate timing data
2. Log to structured format for analysis:
   ```json
   {
     "sessionId": "uuid",
     "totalTime": 180000,
     "contentTimings": {...},
     "fileCount": 3,
     "totalInputSize": 50000,
     "tokenUsage": {...}
   }
   ```

### Deliverables
- [ ] Server-side timing instrumentation implemented
- [ ] Client-side performance marks added
- [ ] Baseline metrics document with P50/P95/P99 latencies
- [ ] Token usage tracking per content type

---

## Phase 2: Gemini API Optimization

### Objective
Reduce Gemini API response time through prompt engineering, model configuration, and request optimization.

### Step 2.1: Analyze Prompt Efficiency
**Files to Review:**
- `server/prompts/roadmapPrompt.js` - 16.3KB system prompt
- `server/prompts/slidesPrompt.js` - MVP prompt
- `server/prompts/documentPrompt.js` - 42 lines
- `server/prompts/researchAnalysisPrompt.js` - 16KB analysis prompt

**Actions:**
1. **Audit roadmap prompt (16.3KB):**
   - Identify redundant instructions
   - Remove verbose examples that don't improve output quality
   - Consider prompt compression techniques
   - Target: Reduce to <10KB without quality loss

2. **Audit research analysis prompt (16KB):**
   - Analyze if full analysis is needed for initial display
   - Consider splitting into "quick analysis" + "detailed analysis on demand"
   - Target: Reduce initial analysis prompt to <8KB

3. **Review JSON schema complexity:**
   - Simplify nested structures where possible
   - Remove optional fields from initial generation
   - Target: 20% reduction in output token requirements

### Step 2.2: Model Configuration Tuning
**Files to Review:**
- `server/generators.js` - Model parameters
- `server/config.js` - Configuration constants

**Actions:**
1. **Review temperature/topP/topK settings:**
   ```javascript
   // Current settings
   roadmap: { temperature: 0.1, topP: 0.3, topK: 5 }
   slides: { temperature: 0.1 }
   document: { temperature: 0.1, topP: 0.3, topK: 5 }
   ```
   - Test if lower topK (e.g., 3) reduces latency without quality impact
   - Benchmark different temperature values for speed vs quality

2. **Evaluate thinking budget:**
   - Current: `thinkingBudget: 0` (disabled for speed)
   - Verify this is optimal for each content type
   - Test minimal thinking budget (256) for complex roadmaps

3. **Test model variants:**
   - Current: `gemini-flash-latest`
   - Benchmark: `gemini-1.5-flash-8b` for simpler content types (slides, document)
   - Consider: Different models for different content types

### Step 2.3: Request Batching Optimization
**Files to Review:**
- `server/generators.js:APIQueue` - Concurrency control

**Actions:**
1. **Analyze current concurrency (4):**
   - Profile if increasing to 5-6 concurrent calls is safe
   - Check Gemini rate limits for your API tier
   - Monitor error rates at different concurrency levels

2. **Implement request priority:**
   - Prioritize most-viewed content type (e.g., roadmap first)
   - Return immediately when first content is ready
   - Background-generate remaining content types

3. **Test request deduplication effectiveness:**
   - Review `StateManager._pendingRequests`
   - Ensure no duplicate Gemini calls for same session

### Deliverables
- [ ] Optimized prompts with size reduction metrics
- [ ] Model configuration benchmark results
- [ ] Concurrency tuning recommendations
- [ ] Token usage reduction measurements (target: 20% reduction)

---

## Phase 3: Response Streaming Implementation

### Objective
Implement streaming responses to show content progressively instead of waiting for complete generation.

### Step 3.1: Server-Side Streaming Setup
**Files to Modify:**
- `server/routes/content.js` - Add streaming endpoint
- `server/generators.js` - Implement streaming generation

**Actions:**
1. **Add streaming generation endpoint:**
   ```javascript
   // New endpoint: POST /api/content/generate-stream
   // Returns Server-Sent Events (SSE)
   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache');
   res.setHeader('Connection', 'keep-alive');
   ```

2. **Implement Gemini streaming:**
   ```javascript
   const result = await model.generateContentStream(prompt);
   for await (const chunk of result.stream) {
     res.write(`data: ${JSON.stringify(chunk.text())}\n\n`);
   }
   ```

3. **Stream content type completion events:**
   ```javascript
   // Stream events as each content type completes
   res.write(`data: {"type":"roadmap","status":"complete"}\n\n`);
   res.write(`data: {"type":"slides","status":"complete"}\n\n`);
   ```

### Step 3.2: Client-Side Streaming Integration
**Files to Modify:**
- `Public/viewer.js` - Add EventSource handling
- `Public/components/shared/StateManager.js` - Handle streaming updates

**Actions:**
1. **Replace polling with EventSource:**
   ```javascript
   const eventSource = new EventSource(`/api/content/generate-stream?sessionId=${id}`);
   eventSource.onmessage = (event) => {
     const data = JSON.parse(event.data);
     stateManager.setViewContent(data.type, data.content);
   };
   ```

2. **Implement progressive UI updates:**
   - Show loading skeleton for pending content
   - Render each content type immediately when received
   - Update progress indicator per content type

3. **Fallback to polling for SSE-unsupported clients:**
   - Detect EventSource support
   - Fall back to current polling mechanism if needed

### Step 3.3: Partial Content Rendering
**Files to Modify:**
- `Public/viewer.js` - View rendering logic
- `Public/components/` - Individual view components

**Actions:**
1. **Enable immediate view switching:**
   - Allow switching to a view as soon as its content is ready
   - Show "Generating..." state for incomplete views

2. **Implement content priority:**
   - Generate and stream current view first
   - Background-generate other views
   - User gets first content 60-70% faster

### Deliverables
- [ ] SSE streaming endpoint implemented
- [ ] Client EventSource integration complete
- [ ] Progressive loading UI states
- [ ] Perceived latency reduction measurement (target: 50%+ for first content)

---

## Phase 4: Caching Layer Implementation

### Objective
Implement intelligent caching to avoid redundant Gemini API calls for similar or identical requests.

### Step 4.1: Request Signature Caching
**Files to Modify:**
- `server/routes/content.js` - Add caching middleware
- New file: `server/cache/contentCache.js`

**Actions:**
1. **Create content hash function:**
   ```javascript
   function generateContentHash(researchContent, contentType) {
     return crypto.createHash('sha256')
       .update(researchContent.substring(0, 10000) + contentType)
       .digest('hex');
   }
   ```

2. **Implement LRU cache for generated content:**
   ```javascript
   const contentCache = new Map();
   const MAX_CACHE_SIZE = 50; // 50 unique content hashes
   const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
   ```

3. **Cache lookup before generation:**
   ```javascript
   const hash = generateContentHash(content, 'roadmap');
   if (contentCache.has(hash)) {
     return contentCache.get(hash);
   }
   // Generate and cache result
   ```

### Step 4.2: Similarity-Based Caching
**Actions:**
1. **Implement fuzzy content matching:**
   - For documents with >90% text similarity, reuse cached content
   - Use rolling hash or MinHash for similarity detection

2. **Cache invalidation strategy:**
   - Time-based expiry (24 hours)
   - Size-based eviction (LRU when cache full)
   - Manual invalidation endpoint for testing

### Step 4.3: Response Caching Headers
**Files to Review:**
- `server/routes/content.js` - Existing cache headers

**Actions:**
1. **Enhance Cache-Control headers:**
   ```javascript
   // Current: private, max-age=300 (5 min)
   // Consider: private, max-age=3600, stale-while-revalidate=86400
   ```

2. **Implement ETag for content:**
   - Generate ETag from content hash
   - Support conditional requests (If-None-Match)
   - Return 304 Not Modified for unchanged content

### Deliverables
- [ ] Content hash caching implemented
- [ ] Cache hit rate monitoring
- [ ] Cache size/eviction metrics
- [ ] Estimated API cost reduction (target: 30% fewer Gemini calls)

---

## Phase 5: Input Processing Optimization

### Objective
Optimize file processing and text preparation to reduce pre-generation latency.

### Step 5.1: File Processing Performance
**Files to Review:**
- `server/routes/content.js` - File processing logic
- Dependencies: `mammoth`, `pdf-parse`

**Actions:**
1. **Profile file processing:**
   - Measure time for DOCX → HTML conversion (mammoth)
   - Measure time for PDF text extraction
   - Identify slowest file types

2. **Optimize DOCX processing:**
   - Consider using mammoth with streaming
   - Pre-process common DOCX structures
   - Implement size-based processing limits

3. **Implement parallel processing:**
   - Current: `Promise.all()` for files (good)
   - Verify true parallelism with worker threads for CPU-intensive tasks

### Step 5.2: Text Preprocessing Optimization
**Files to Review:**
- `server/prompts/*.js` - Content preparation

**Actions:**
1. **Implement smart summarization:**
   - Current: First 1500 chars for slides
   - Enhance: Extract key sections (abstract, conclusions, methodology)
   - Use extractive summarization before sending to Gemini

2. **Optimize text chunking:**
   - Identify optimal chunk sizes for each content type
   - Remove redundant whitespace and formatting
   - Strip non-essential metadata

3. **Implement content deduplication:**
   - Detect and merge duplicate paragraphs
   - Remove repeated headers/footers
   - Compress repeated phrases

### Step 5.3: Upload Optimization
**Files to Review:**
- `Public/main.js` - Client-side upload handling
- `server/middleware.js` - multer configuration

**Actions:**
1. **Client-side preprocessing:**
   - Validate and compress files before upload
   - Extract text client-side for supported formats
   - Show immediate feedback during upload

2. **Optimize multer configuration:**
   ```javascript
   // Consider memory vs disk storage tradeoffs
   // Implement streaming upload processing
   ```

### Deliverables
- [ ] File processing timing breakdown
- [ ] Optimized text preprocessing pipeline
- [ ] Upload performance improvements
- [ ] Input processing latency reduction (target: 30% faster preprocessing)

---

## Phase 6: Frontend Rendering Optimization

### Objective
Optimize client-side rendering to reduce time-to-interactive after content is received.

### Step 6.1: Component Rendering Analysis
**Files to Review:**
- `Public/viewer.js` - View orchestration
- `Public/components/roadmap/` - Gantt chart rendering
- `Public/components/slides/` - Slides rendering
- `Public/components/document/` - Document rendering

**Actions:**
1. **Profile render times:**
   - Measure time from content receipt to DOM complete
   - Identify slow rendering components
   - Target: <100ms for initial render

2. **Implement virtualization for large content:**
   - Gantt charts with many tasks: virtualize rows
   - Long documents: virtualize sections
   - Use Intersection Observer for on-demand rendering

3. **Optimize DOM operations:**
   - Batch DOM updates
   - Use DocumentFragment for multiple insertions
   - Minimize layout thrashing

### Step 6.2: State Management Optimization
**Files to Review:**
- `Public/components/shared/StateManager.js:335 lines`

**Actions:**
1. **Implement memoization:**
   ```javascript
   // Cache computed content
   getMemoizedContent(viewType) {
     if (this._memoCache[viewType]?.hash === this._contentHash[viewType]) {
       return this._memoCache[viewType].value;
     }
     // Recompute and cache
   }
   ```

2. **Optimize listener notifications:**
   - Current: All listeners notified on any change
   - Improve: Only notify relevant view listeners
   - Use shallow comparison for unchanged content

3. **Reduce re-renders:**
   - Review `batchSetState()` usage
   - Ensure batch updates are working correctly
   - Profile render count per user action

### Step 6.3: Code Splitting and Lazy Loading
**Files to Review:**
- `Public/viewer.js` - Module loading
- Build configuration

**Actions:**
1. **Implement view-based code splitting:**
   ```javascript
   // Load view modules on demand
   async function loadView(viewType) {
     const module = await import(`./components/${viewType}/index.js`);
     return module.default;
   }
   ```

2. **Lazy load heavy dependencies:**
   - Gantt chart library: load only when roadmap view selected
   - Export functionality: load on demand
   - Analytics: defer loading

3. **Optimize initial bundle:**
   - Review esbuild configuration
   - Implement tree shaking
   - Target: <100KB initial JS payload

### Deliverables
- [ ] Component render time profiling report
- [ ] State management optimizations
- [ ] Code splitting implementation
- [ ] Time-to-interactive improvement (target: <100ms after content received)

---

## Phase 7: Network Optimization

### Objective
Reduce network latency and improve request/response efficiency.

### Step 7.1: Request/Response Compression
**Files to Review:**
- `server/server.js` - Express middleware
- `server/middleware.js` - Compression settings

**Actions:**
1. **Verify compression effectiveness:**
   - Current: `compression()` middleware enabled
   - Measure compression ratios for content responses
   - Test Brotli vs gzip for JSON responses

2. **Optimize JSON response size:**
   - Remove null/undefined fields from responses
   - Use shorter property names for large arrays
   - Consider response minification

3. **Implement response chunking:**
   - For large content responses (>100KB)
   - Enable HTTP/2 server push if supported

### Step 7.2: Connection Optimization
**Files to Review:**
- `server/server.js` - Server configuration

**Actions:**
1. **Enable HTTP/2:**
   - Check Railway HTTP/2 support
   - Implement HTTP/2 push for critical resources

2. **Optimize Keep-Alive:**
   ```javascript
   // Verify Keep-Alive settings
   server.keepAliveTimeout = 65000;
   server.headersTimeout = 66000;
   ```

3. **Reduce round trips:**
   - Bundle related requests
   - Prefetch predictable resources
   - Implement connection warming

### Step 7.3: CDN Integration
**Actions:**
1. **Evaluate CDN for static assets:**
   - CSS, JS, images already have long cache times
   - Consider Cloudflare or AWS CloudFront
   - Estimated latency reduction: 20-50ms for global users

2. **Edge caching strategy:**
   - Cache static content at edge
   - Session-specific content remains at origin
   - Consider edge functions for validation

### Deliverables
- [ ] Compression optimization report
- [ ] HTTP/2 implementation (if feasible)
- [ ] CDN integration plan
- [ ] Network latency reduction (target: 20% improvement)

---

## Phase 8: Database & Persistence Layer

### Objective
Implement persistent storage to enable horizontal scaling and improve session reliability.

### Step 8.1: Evaluate Storage Options
**Current State:**
- In-memory session storage (Map)
- Lost on server restart
- MAX_SESSIONS = 100 limit

**Actions:**
1. **Evaluate database options:**
   | Option | Pros | Cons | Latency |
   |--------|------|------|---------|
   | Redis | Fast, built-in TTL | Additional service | <1ms |
   | PostgreSQL | ACID, complex queries | Slower for K-V | 5-10ms |
   | SQLite | Simple, file-based | Single server | <1ms |
   | MongoDB | Document model fits content | Additional service | 2-5ms |

2. **Recommendation:** Redis for session storage
   - Sub-millisecond latency
   - Built-in TTL for session expiry
   - Supports horizontal scaling
   - Works well with Railway

### Step 8.2: Implement Redis Session Storage
**Files to Modify:**
- New file: `server/storage/redisStorage.js`
- `server/routes/content.js` - Replace Map with Redis

**Actions:**
1. **Create Redis storage abstraction:**
   ```javascript
   class SessionStorage {
     async get(sessionId) { /* Redis GET with JSON parse */ }
     async set(sessionId, data, ttl) { /* Redis SETEX */ }
     async delete(sessionId) { /* Redis DEL */ }
     async exists(sessionId) { /* Redis EXISTS */ }
   }
   ```

2. **Implement connection pooling:**
   - Use ioredis with connection pool
   - Implement retry logic for connection failures
   - Add health check endpoint

3. **Migration strategy:**
   - Support both in-memory and Redis (feature flag)
   - Gradual rollout with monitoring
   - Fallback to in-memory if Redis unavailable

### Step 8.3: Content Storage Optimization
**Actions:**
1. **Compress stored content:**
   - Compress JSON before storing in Redis
   - Use LZ4 or gzip for content compression
   - Target: 60-70% size reduction

2. **Implement lazy loading from storage:**
   - Store content types separately
   - Load only requested view type
   - Reduces memory and transfer time

### Deliverables
- [ ] Storage option evaluation document
- [ ] Redis integration implementation
- [ ] Session reliability improvements
- [ ] Horizontal scaling capability

---

## Phase 9: Advanced Optimization Techniques

### Objective
Implement advanced techniques for further latency reduction.

### Step 9.1: Predictive Generation
**Actions:**
1. **Implement prefetch for likely actions:**
   - When user selects file, begin background analysis
   - Pre-warm Gemini connection
   - Cache common prompt templates

2. **Speculative generation:**
   - Generate most common content type first
   - Background-generate others based on usage patterns
   - A/B test different generation orders

### Step 9.2: Prompt Caching (Gemini Feature)
**Actions:**
1. **Research Gemini prompt caching:**
   - Check if Gemini supports context/prompt caching
   - Implement cached prompts for system instructions
   - Estimated token reduction: 30-50%

2. **Implement prompt templates:**
   - Pre-compile static portions of prompts
   - Cache compiled prompts in memory
   - Reduce string concatenation overhead

### Step 9.3: Worker Thread Optimization
**Actions:**
1. **Offload CPU-intensive tasks:**
   - File processing → worker thread
   - JSON parsing/validation → worker thread
   - Response compression → worker thread

2. **Implement worker pool:**
   ```javascript
   const workerPool = new Piscina({
     filename: './workers/processFile.js',
     maxThreads: 4
   });
   ```

### Deliverables
- [ ] Predictive generation implementation
- [ ] Prompt caching investigation results
- [ ] Worker thread optimization
- [ ] Additional latency reduction (target: 10-20%)

---

## Phase 10: Monitoring & Continuous Optimization

### Objective
Implement ongoing monitoring and establish processes for continuous performance improvement.

### Step 10.1: Performance Monitoring Dashboard
**Actions:**
1. **Implement metrics collection:**
   - Request latency histograms
   - Content generation times by type
   - Cache hit rates
   - Error rates and types

2. **Create alerting rules:**
   - P95 latency exceeds threshold
   - Cache hit rate drops below target
   - Error rate spike detection

### Step 10.2: A/B Testing Framework
**Actions:**
1. **Implement feature flags:**
   - Toggle optimizations on/off
   - Gradual rollout capability
   - Quick rollback support

2. **Create A/B testing capability:**
   - Route percentage of traffic to variants
   - Measure impact on latency
   - Statistical significance testing

### Step 10.3: Performance Regression Prevention
**Actions:**
1. **Add performance tests:**
   ```javascript
   test('roadmap generation completes under 30s', async () => {
     const start = Date.now();
     await generateRoadmap(testContent);
     expect(Date.now() - start).toBeLessThan(30000);
   });
   ```

2. **CI/CD performance gates:**
   - Block deploys that regress performance
   - Automatic benchmark comparison
   - Performance budget enforcement

### Deliverables
- [ ] Monitoring dashboard deployed
- [ ] Alerting rules configured
- [ ] Performance regression tests
- [ ] Continuous optimization process documented

---

## Implementation Timeline Summary

| Phase | Description | Priority | Complexity |
|-------|-------------|----------|------------|
| 1 | Baseline & Instrumentation | Critical | Low |
| 2 | Gemini API Optimization | Critical | Medium |
| 3 | Response Streaming | High | High |
| 4 | Caching Layer | High | Medium |
| 5 | Input Processing | Medium | Low |
| 6 | Frontend Rendering | Medium | Medium |
| 7 | Network Optimization | Medium | Low |
| 8 | Database & Persistence | Medium | High |
| 9 | Advanced Techniques | Low | High |
| 10 | Monitoring & CI | Ongoing | Medium |

---

## Expected Outcomes

### Latency Reduction Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Time to First Content | 60-120s | 15-30s | 75% |
| Total Generation Time | 2-5 min | 1-2 min | 50% |
| API Token Usage | Baseline | -30% | Cost savings |
| Cache Hit Rate | 0% | 30%+ | API savings |
| Frontend Render Time | Unknown | <100ms | Instant feel |

### Success Criteria

1. **Time to First Content (TTFC):** <30 seconds for first view ready
2. **Total Generation:** <2 minutes for all 4 content types
3. **Cache Hit Rate:** >30% for repeat/similar requests
4. **API Cost:** 30% reduction in Gemini API calls
5. **User Satisfaction:** Perceived instant response after upload

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Streaming complexity | High | Fallback to polling, feature flag |
| Cache invalidation bugs | Medium | Conservative TTL, manual purge endpoint |
| Redis unavailability | High | In-memory fallback, health checks |
| Prompt changes break output | High | Version prompts, A/B test changes |
| Performance regression | Medium | CI gates, automated benchmarks |

---

## Next Steps

1. **Immediate:** Implement Phase 1 instrumentation to establish baseline
2. **Week 1-2:** Focus on Phase 2 (Gemini optimization) for quick wins
3. **Week 3-4:** Implement Phase 3 (streaming) for perceived latency improvement
4. **Ongoing:** Phases 4-10 based on measured impact and priorities

---

*Document Version: 1.0*
*Created: Performance Review Planning Phase*
*Last Updated: Initial Creation*
