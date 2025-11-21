# Cross-LLM Research Synthesis - Implementation Plan

## Feature Overview

The "Cross-LLM Research Synthesis" feature addresses inconsistency and lack of verifiable provenance in AI-generated research by:
- Ingesting research outputs from multiple LLMs (GEMINI, GPT, CLAUDE, GROK)
- Automatically analyzing for consensus and contradictions
- Synthesizing findings into a single, cohesive, rigorously cited report

## Architecture Integration

### Backend Integration Points

1. **New Route Module**: `server/routes/research.js`
   - Follows existing pattern from `server/routes/analysis.js`
   - Implements 8-step pipeline as async job processing
   - Uses existing `storage.js` for session/job management

2. **New Prompts Module**: `server/prompts-research.js`
   - Follows existing pattern from `server/prompts.js`
   - Contains JSON schemas for structured output
   - Temperature=0 for deterministic, structured outputs

3. **Extended File Support**:
   - Add PDF parsing capability to existing Multer middleware
   - Maintain backward compatibility with .md, .txt, .docx

4. **Database Storage**:
   - Reuse existing session management
   - Store claim ledger, contradictions, reports in database
   - 1-hour expiration (existing pattern)

### Frontend Integration Points

1. **New Component**: `Public/ResearchSynthesizer.js`
   - Follows existing component pattern (TaskAnalyzer, ExecutiveSummary)
   - Self-contained ES6 class with dependency injection
   - Uses existing Utils.js for shared functionality

2. **UI Integration**:
   - Add new section to `Public/index.html`
   - Toggle visibility (similar to executive summary view)
   - Reuse existing dark theme and styling patterns

3. **Job Polling**:
   - Reuse existing polling pattern from `main.js`
   - 1-second poll interval, 5-minute timeout

---

## Implementation Details

### Phase 1: Dependencies & Configuration

#### 1.1 Update package.json

```json
"dependencies": {
  "pdf-parse": "^1.1.1",
  "chart.js": "^4.4.1"
}
```

#### 1.2 Update server/config.js

Add new configuration section:

```javascript
RESEARCH_SYNTHESIS: {
  LLM_PROVIDERS: ['GEMINI', 'GPT', 'CLAUDE', 'GROK', 'OTHER'],
  MAX_FILES_PER_PROVIDER: 10,
  MAX_CLAIMS_PER_FILE: 500,
  CONFIDENCE_THRESHOLD: 0.7,
  CITATION_REGEX: /\[(\d+)\]/g
}
```

#### 1.3 Update server/middleware.js

Extend file filter to support PDF:

```javascript
ALLOWED_MIMES: [
  ...(existing),
  'application/pdf'
],
ALLOWED_EXTENSIONS: [...(existing), 'pdf']
```

---

### Phase 2: Backend Implementation

#### 2.1 Create server/prompts-research.js

**Step 1: Claim Extraction Prompt**
```
You are a rigorous research analyst. Extract EVERY atomic claim from this text.

ATOMIC CLAIM = A single, verifiable statement that:
1. Makes ONE assertion only
2. Can be independently verified
3. Has a clear subject and predicate

For EACH claim, provide:
- claim: The exact statement
- topic: The category (e.g., "AI Safety", "Climate")
- citation: The original citation from text (e.g., "[3]") or "NONE"
- confidence: "high", "medium", "low"

Output JSON schema:
{
  "claims": [
    {
      "claim": "string",
      "topic": "string",
      "citation": "string",
      "confidence": "high|medium|low"
    }
  ]
}
```

**Step 3: Contradiction Detection Prompt**
```
Analyze this claim ledger for contradictions.

CONTRADICTION TYPES:
1. NUMERICAL: Conflicting numbers (e.g., "15%" vs "25%")
2. POLARITY: Opposite assertions (e.g., "is safe" vs "is dangerous")
3. DEFINITIONAL: Incompatible definitions
4. TEMPORAL: Conflicting timelines

For each contradiction:
- type: One of the 4 types above
- claims: Array of contradicting claim IDs
- severity: "high", "medium", "low"
- explanation: Brief explanation

Output JSON schema:
{
  "contradictions": [
    {
      "type": "NUMERICAL|POLARITY|DEFINITIONAL|TEMPORAL",
      "claims": ["claim_id_1", "claim_id_2"],
      "severity": "high|medium|low",
      "explanation": "string"
    }
  ]
}
```

**Step 4: Report Synthesis Prompt**
```
Synthesize the verified claims into a comprehensive Markdown report.

STRUCTURE:
1. Executive Summary (2-3 paragraphs)
2. Findings by Topic
   - For each topic:
     a. Consensus findings (claims with >70% agreement)
     b. Areas of disagreement (contradictions)
     c. Evidence gaps (uncited claims)
3. Sources Appendix (numbered list)

CITATION RULES:
- EVERY statement MUST have inline citation: [1], [2], etc.
- Citations MUST link to specific source
- Format: [source_number](source_filename.pdf)
- Flag uncited claims: ⚠️ [UNCITED]

Output Markdown text (not JSON).
```

**Step 5: Provenance Auditing Prompt**
```
Audit this generated report against original source texts for:
1. HALLUCINATION: Unsupported statements
2. INCORRECT ATTRIBUTION: Wrong source cited
3. MISSING CITATION: Statement lacks citation

For each issue:
- type: "HALLUCINATION|INCORRECT_ATTRIBUTION|MISSING_CITATION"
- statement: The problematic text
- correctSource: What the source actually says (or "NONE")
- severity: "high|medium|low"

Output JSON schema:
{
  "issues": [
    {
      "type": "string",
      "statement": "string",
      "correctSource": "string",
      "severity": "high|medium|low"
    }
  ],
  "overallScore": "number (0-100)"
}
```

**Step 7: Executive Summary Prompt**
```
Generate a concise executive summary (250 words max).

Include:
1. Research scope (# of sources, LLMs, topics)
2. Key consensus findings (top 3)
3. Major contradictions (if any)
4. Data quality assessment
5. Recommended next steps

Output JSON schema:
{
  "summary": "string (markdown)",
  "scope": {
    "sources": "number",
    "llms": "string[]",
    "topics": "string[]"
  },
  "keyFindings": "string[]",
  "contradictions": "number",
  "dataQuality": "high|medium|low"
}
```

#### 2.2 Create server/routes/research.js

**Endpoints:**

1. **POST /api/research/upload**
   - Input: FormData with files + LLM provider metadata
   - Process: Parse files (PDF, DOCX, MD, TXT), create session
   - Output: `{ sessionId, fileCount, providers }`

2. **POST /api/research/extract-claims**
   - Input: `{ sessionId }`
   - Process: Call Gemini for each file, extract claims
   - Output: `{ jobId }` → Client polls /job/:jobId

3. **GET /api/research/ledger/:sessionId**
   - Input: sessionId in URL
   - Output: `{ claims: [...], byProvider: {...}, byTopic: {...} }`

4. **POST /api/research/detect-contradictions**
   - Input: `{ sessionId }`
   - Process: Analyze claim ledger for contradictions
   - Output: `{ jobId }`

5. **POST /api/research/synthesize**
   - Input: `{ sessionId }`
   - Process: Generate Markdown report with citations
   - Output: `{ jobId }`

6. **POST /api/research/audit**
   - Input: `{ sessionId }`
   - Process: Audit report for hallucinations
   - Output: `{ jobId }`

7. **GET /api/research/verified-claims/:sessionId**
   - Input: sessionId
   - Output: `{ highConsensus: [...], disputed: [...] }`

8. **POST /api/research/executive-summary**
   - Input: `{ sessionId }`
   - Process: Generate executive summary
   - Output: `{ jobId }`

9. **GET /api/research/dashboard/:sessionId**
   - Input: sessionId
   - Output: `{ citationBreakdown, verificationBreakdown, consensusBreakdown }`

**Implementation Pattern** (following existing charts.js):

```javascript
import express from 'express';
import { callGeminiForJson, callGeminiForText } from '../gemini.js';
import { CLAIM_EXTRACTION_PROMPT, ... } from '../prompts-research.js';
import { createSession, createJob, updateJob, completeJob } from '../storage.js';
import { strictLimiter } from '../middleware.js';
import pdf from 'pdf-parse';

const router = express.Router();

// Example: Step 1 - Extract Claims
router.post('/api/research/extract-claims', strictLimiter, async (req, res) => {
  const { sessionId } = req.body;

  // Validation
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Create async job
  const jobId = createJob();
  res.json({ jobId });

  // Background processing
  processClaimExtraction(jobId, session);
});

async function processClaimExtraction(jobId, session) {
  try {
    updateJob(jobId, { status: 'processing', progress: 'Extracting claims from sources...' });

    const allClaims = [];

    for (const file of session.files) {
      updateJob(jobId, { progress: `Processing ${file.name}...` });

      const payload = {
        contents: [{ parts: [{ text: `Source: ${file.name}\n\n${file.content}` }] }],
        systemInstruction: { parts: [{ text: CLAIM_EXTRACTION_PROMPT }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: CLAIM_EXTRACTION_SCHEMA,
          temperature: 0,
          maxOutputTokens: 8192
        }
      };

      const result = await callGeminiForJson(payload);

      // Add metadata
      result.claims.forEach(claim => {
        claim.source = file.name;
        claim.provider = file.provider;
        claim.id = generateClaimId();
      });

      allClaims.push(...result.claims);
    }

    // Store in database
    updateJob(jobId, {
      status: 'complete',
      progress: 'Claims extracted successfully',
      data: { claims: allClaims }
    });

  } catch (error) {
    console.error('Claim extraction error:', error);
    updateJob(jobId, {
      status: 'error',
      error: error.message
    });
  }
}

export default router;
```

#### 2.3 Update server.js

```javascript
import researchRoutes from './server/routes/research.js';

// Mount routes (after existing routes)
app.use('/', researchRoutes);
```

---

### Phase 3: Frontend Implementation

#### 3.1 Create Public/ResearchSynthesizer.js

```javascript
/**
 * ResearchSynthesizer Component
 * Implements the 8-step Cross-LLM Research Synthesis pipeline
 */
export class ResearchSynthesizer {
  constructor(containerId) {
    this.containerId = containerId;
    this.sessionId = null;
    this.currentStep = 0;
    this.steps = [
      { id: 1, name: 'Upload Sources', status: 'pending' },
      { id: 2, name: 'Extract Claims', status: 'pending' },
      { id: 3, name: 'Merge Ledger', status: 'pending' },
      { id: 4, name: 'Detect Contradictions', status: 'pending' },
      { id: 5, name: 'Synthesize Report', status: 'pending' },
      { id: 6, name: 'Audit Provenance', status: 'pending' },
      { id: 7, name: 'Verify Claims', status: 'pending' },
      { id: 8, name: 'Generate Dashboard', status: 'pending' }
    ];
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="research-synthesis-container">
        <div class="research-header">
          <h2>Cross-LLM Research Synthesis</h2>
          <p>Transform multi-source research into verified, cited insights</p>
        </div>

        <div class="pipeline-steps">
          ${this._renderSteps()}
        </div>

        <div class="pipeline-content">
          ${this._renderCurrentStepContent()}
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

  _renderSteps() {
    return this.steps.map((step, idx) => `
      <div class="step-card ${step.status}" data-step="${step.id}">
        <div class="step-number">${step.id}</div>
        <div class="step-name">${step.name}</div>
        <div class="step-status-icon">
          ${this._getStatusIcon(step.status)}
        </div>
      </div>
    `).join('');
  }

  _getStatusIcon(status) {
    switch (status) {
      case 'complete': return '✓';
      case 'processing': return '<div class="spinner"></div>';
      case 'error': return '✗';
      default: return '';
    }
  }

  _renderCurrentStepContent() {
    switch (this.currentStep) {
      case 0: return this._renderUploadStep();
      case 1: return this._renderExtractionStep();
      case 2: return this._renderLedgerStep();
      case 3: return this._renderContradictionsStep();
      case 4: return this._renderReportStep();
      case 5: return this._renderAuditStep();
      case 6: return this._renderVerifiedClaimsStep();
      case 7: return this._renderDashboardStep();
      default: return '';
    }
  }

  _renderUploadStep() {
    return `
      <div class="step-content">
        <h3>Step 1: Upload Research Sources</h3>
        <p>Upload research documents from different LLMs and assign each to its source.</p>

        <div class="upload-section">
          <div class="provider-files" id="provider-files-list">
            <!-- Dynamically populated -->
          </div>

          <button class="btn-add-source" id="btn-add-source">
            + Add Source
          </button>
        </div>

        <div class="file-attribution-modal" id="file-attribution-modal" style="display: none;">
          <div class="modal-content">
            <h4>Select LLM Provider</h4>
            <select id="llm-provider-select">
              <option value="GEMINI">Google Gemini</option>
              <option value="GPT">OpenAI GPT</option>
              <option value="CLAUDE">Anthropic Claude</option>
              <option value="GROK">xAI Grok</option>
              <option value="OTHER">Other</option>
            </select>
            <input type="file" id="source-file-input" accept=".pdf,.md,.txt,.docx" multiple />
            <button id="btn-upload-source">Upload</button>
            <button id="btn-cancel-upload">Cancel</button>
          </div>
        </div>

        <button class="btn-primary" id="btn-start-extraction" disabled>
          Start Extraction →
        </button>
      </div>
    `;
  }

  async handleUpload() {
    const files = this.uploadedFiles;
    const formData = new FormData();

    files.forEach(file => {
      formData.append('files', file.file);
      formData.append('providers', file.provider);
    });

    const response = await fetch('/api/research/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    this.sessionId = result.sessionId;
    this.advanceToNextStep();
  }

  async runStep(stepNumber) {
    const step = this.steps[stepNumber - 1];
    step.status = 'processing';
    this.render();

    try {
      let endpoint, body;

      switch (stepNumber) {
        case 2:
          endpoint = '/api/research/extract-claims';
          body = { sessionId: this.sessionId };
          break;
        case 4:
          endpoint = '/api/research/detect-contradictions';
          body = { sessionId: this.sessionId };
          break;
        case 5:
          endpoint = '/api/research/synthesize';
          body = { sessionId: this.sessionId };
          break;
        case 6:
          endpoint = '/api/research/audit';
          body = { sessionId: this.sessionId };
          break;
        case 8:
          endpoint = '/api/research/executive-summary';
          body = { sessionId: this.sessionId };
          break;
      }

      if (endpoint) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const result = await response.json();

        if (result.jobId) {
          await this.pollForCompletion(result.jobId);
        }
      }

      step.status = 'complete';
      this.advanceToNextStep();

    } catch (error) {
      console.error(`Step ${stepNumber} error:`, error);
      step.status = 'error';
      this.render();
    }
  }

  async pollForCompletion(jobId) {
    const maxAttempts = 300; // 5 minutes
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(`/job/${jobId}`);
      const job = await response.json();

      if (job.status === 'complete') {
        return job.data;
      } else if (job.status === 'error') {
        throw new Error(job.error);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Job timeout');
  }

  _renderDashboardStep() {
    return `
      <div class="step-content">
        <h3>Step 8: Analysis Dashboard</h3>

        <div class="dashboard-grid">
          <div class="dashboard-chart">
            <h4>Citation Status</h4>
            <canvas id="citation-chart"></canvas>
          </div>

          <div class="dashboard-chart">
            <h4>Verification Status</h4>
            <canvas id="verification-chart"></canvas>
          </div>

          <div class="dashboard-chart">
            <h4>Consensus Analysis</h4>
            <canvas id="consensus-chart"></canvas>
          </div>
        </div>

        <div class="dashboard-summary" id="dashboard-summary">
          <!-- Populated by API -->
        </div>
      </div>
    `;
  }

  renderDashboard(data) {
    // Use Chart.js to render pie charts
    const citationCtx = document.getElementById('citation-chart').getContext('2d');
    new Chart(citationCtx, {
      type: 'pie',
      data: {
        labels: ['Cited', 'Uncited'],
        datasets: [{
          data: [data.cited, data.uncited],
          backgroundColor: ['#4CAF50', '#F44336']
        }]
      }
    });

    // Similar for verification and consensus charts
  }
}
```

#### 3.2 Update Public/index.html

Add new section (after existing form):

```html
<!-- Research Synthesis Tool (NEW) -->
<section id="research-synthesis-section" class="hidden mt-12">
  <div id="research-synthesis-container"></div>
</section>

<!-- Toggle button to show/hide research tool -->
<button id="toggle-research-tool" class="btn-secondary">
  🔬 Cross-LLM Research Synthesis
</button>
```

#### 3.3 Update Public/main.js

```javascript
import { ResearchSynthesizer } from './ResearchSynthesizer.js';

// Initialize research synthesizer
const researchSynthesizer = new ResearchSynthesizer('research-synthesis-container');

// Toggle visibility
document.getElementById('toggle-research-tool').addEventListener('click', () => {
  const section = document.getElementById('research-synthesis-section');
  section.classList.toggle('hidden');

  if (!section.classList.contains('hidden')) {
    researchSynthesizer.render();
  }
});
```

#### 3.4 Update Public/style.css

```css
/* Research Synthesis Styles */
.research-synthesis-container {
  background: #1B1A1A;
  border-radius: 12px;
  padding: 2rem;
  margin-top: 2rem;
}

.research-header {
  text-align: center;
  margin-bottom: 2rem;
}

.research-header h2 {
  font-size: 2rem;
  color: #FFFFFF;
  margin-bottom: 0.5rem;
}

.research-header p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.1rem;
}

/* Pipeline Steps */
.pipeline-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.step-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  transition: all 0.3s ease;
}

.step-card.processing {
  border-color: #da291c;
  background: rgba(218, 41, 28, 0.1);
}

.step-card.complete {
  border-color: #4CAF50;
  background: rgba(76, 175, 80, 0.1);
}

.step-card.error {
  border-color: #F44336;
  background: rgba(244, 67, 54, 0.1);
}

.step-number {
  font-size: 1.5rem;
  font-weight: bold;
  color: #da291c;
  margin-bottom: 0.5rem;
}

.step-name {
  font-size: 0.9rem;
  color: #FFFFFF;
  margin-bottom: 0.5rem;
}

.step-status-icon {
  font-size: 1.2rem;
  height: 1.5rem;
}

/* Step Content */
.step-content {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 2rem;
}

.step-content h3 {
  font-size: 1.5rem;
  color: #FFFFFF;
  margin-bottom: 1rem;
}

/* Upload Section */
.provider-files {
  margin-bottom: 1rem;
}

.provider-file-group {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.provider-label {
  font-weight: bold;
  color: #da291c;
  margin-bottom: 0.5rem;
}

/* Dashboard */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.dashboard-chart {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
}

.dashboard-chart h4 {
  font-size: 1.2rem;
  color: #FFFFFF;
  margin-bottom: 1rem;
  text-align: center;
}

.dashboard-chart canvas {
  max-height: 250px;
}

/* Buttons */
.btn-primary {
  background: #da291c;
  color: #FFFFFF;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-primary:hover:not(:disabled) {
  background: #b82317;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #FFFFFF;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: #da291c;
}

/* Spinner */
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #da291c;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Report View */
.report-view {
  background: #FFFFFF;
  color: #000000;
  padding: 2rem;
  border-radius: 8px;
  max-width: 900px;
  margin: 0 auto;
}

.report-view h1, .report-view h2, .report-view h3 {
  color: #0c2340;
}

.report-view a {
  color: #da291c;
  text-decoration: underline;
}

.citation-warning {
  background: #FFF3CD;
  border-left: 4px solid #FFC107;
  padding: 0.5rem 1rem;
  margin: 0.5rem 0;
  border-radius: 4px;
}

/* Verified Claims */
.claims-list {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.claim-item {
  background: rgba(255, 255, 255, 0.03);
  border-left: 4px solid #4CAF50;
  padding: 1rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
}

.claim-item.disputed {
  border-left-color: #F44336;
}

.claim-text {
  color: #FFFFFF;
  margin-bottom: 0.5rem;
}

.claim-metadata {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}
```

---

## Determinism & Explainability Enhancements

### 1. Deterministic Behavior

**Temperature = 0** for all structured outputs:
- Claim extraction
- Contradiction detection
- Provenance auditing
- Executive summary

**Seeded Processing**:
```javascript
// Sort files alphabetically before processing
const sortedFiles = files.sort((a, b) => a.name.localeCompare(b.name));

// Process in consistent order
for (const file of sortedFiles) {
  // Extract claims
}
```

**Claim ID Generation**:
```javascript
// Deterministic claim IDs based on content hash
function generateClaimId(claim, source, index) {
  const hash = crypto.createHash('md5');
  hash.update(`${source}:${index}:${claim.substring(0, 100)}`);
  return hash.digest('hex').substring(0, 16);
}
```

### 2. Explainability

**Provenance Tracking**:
Every claim includes:
- `source`: Original filename
- `provider`: LLM that generated it
- `citation`: Original citation from source text
- `confidence`: AI's confidence level
- `extractedAt`: Timestamp

**Audit Trail**:
```javascript
const auditLog = {
  sessionId,
  steps: [
    {
      stepNumber: 1,
      name: 'Claim Extraction',
      startTime: '2025-01-01T00:00:00Z',
      endTime: '2025-01-01T00:01:30Z',
      filesProcessed: 5,
      claimsExtracted: 127,
      errors: []
    },
    // ... more steps
  ]
};
```

**Contradiction Explanations**:
```javascript
{
  "type": "NUMERICAL",
  "claims": ["claim_abc", "claim_def"],
  "explanation": "Source A claims '15% improvement' while Source B claims '25% improvement' for the same metric.",
  "severity": "high"
}
```

### 3. Consistency Between Runs

**Frozen Prompts**:
- Store prompt versions in database
- Track which prompt version generated each result
- Allow re-running with same prompt for reproducibility

**Snapshot Storage**:
```javascript
// Store intermediate results at each step
{
  sessionId: 'abc123',
  step1_claims: {...},
  step2_ledger: {...},
  step3_contradictions: {...},
  // ... etc
}
```

---

## Testing Strategy

### Unit Tests

1. **Claim Extraction**:
   - Test with known input, verify exact JSON structure
   - Test with uncited text (should flag "NONE")
   - Test with malformed citations

2. **Contradiction Detection**:
   - Test numerical contradictions (15% vs 25%)
   - Test polarity contradictions (safe vs dangerous)
   - Test non-contradictory similar claims

3. **Provenance Auditing**:
   - Test with hallucinated statement → flag as HALLUCINATION
   - Test with correct citation → pass audit
   - Test with wrong citation → flag as INCORRECT_ATTRIBUTION

### Integration Tests

1. **End-to-End Pipeline**:
   - Upload 3 files (GEMINI, GPT, CLAUDE)
   - Run all 8 steps
   - Verify final report has inline citations
   - Verify dashboard charts render

2. **Determinism Test**:
   - Run same files through pipeline twice
   - Compare claim IDs → should be identical
   - Compare final report → should be identical

3. **Error Handling**:
   - Test with unsupported file type → reject
   - Test with too many files → rate limit
   - Test with API failure → graceful degradation

---

## Security Considerations

1. **Input Validation**:
   - Limit file size: 10MB per file
   - Limit total files: 50 per session
   - Sanitize filenames (prevent path traversal)

2. **Output Sanitization**:
   - DOMPurify all rendered Markdown
   - Escape all user-provided filenames
   - Validate all JSON schemas

3. **Rate Limiting**:
   - Use `strictLimiter` for extraction (20 requests / 15 min)
   - Prevent abuse of expensive AI operations

4. **PDF Security**:
   - Use `pdf-parse` with max pages limit (100 pages)
   - Timeout after 30 seconds per PDF
   - Reject encrypted PDFs

---

## Deployment Checklist

- [ ] Run `npm install` to install new dependencies
- [ ] Update `.env` with `API_KEY` (Gemini)
- [ ] Test locally with sample files
- [ ] Run unit tests: `npm test`
- [ ] Run integration tests
- [ ] Commit changes with descriptive message
- [ ] Push to branch: `claude/cross-llm-research-synthesis-01EKvAtjboJ18Rgc9w2eWPhN`
- [ ] Test on Railway deployment
- [ ] Create pull request

---

## Next Steps After Implementation

1. **User Feedback**: Gather feedback on citation accuracy
2. **Prompt Tuning**: Refine prompts based on real-world contradictions
3. **Export Features**: Add PDF export of final report
4. **Collaboration**: Multi-user sessions for team research
5. **Advanced Analytics**: Track consensus trends over time

---

**Version**: 1.0
**Last Updated**: 2025-11-18
**Status**: Ready for Implementation
