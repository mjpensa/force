# Current API Endpoints Documentation

**Generated:** 2025-11-24
**Purpose:** Baseline documentation before implementing three-screen architecture

---

## Chart Generation & Retrieval

### POST /generate-chart
**Purpose:** Create a new chart generation job

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Rate Limit: Strict (10 requests per 15 minutes)

**Body:**
```javascript
{
  prompt: string,              // User's chart generation prompt
  researchFiles: File[]        // Uploaded research files (PDF, DOCX, TXT)
}
```

**Response:**
```javascript
{
  jobId: string,               // UUID for polling job status
  message: "Chart generation started"
}
```

**Files Supported:**
- `.txt` - Plain text
- `.docx` - Microsoft Word (converted to HTML via mammoth)
- `.pdf` - PDF documents
- Other text-based formats

---

### GET /job/:id
**Purpose:** Poll job status during async chart generation

**Request:**
- Method: `GET`
- Path Parameter: `id` (jobId from /generate-chart)

**Response (Processing):**
```javascript
{
  status: "processing",
  progress: "Processing 3 uploaded file(s)..."
}
```

**Response (Complete):**
```javascript
{
  status: "complete",
  chartId: string,             // UUID for retrieving chart
  sessionId: string            // UUID for session (used in analysis)
}
```

**Response (Error):**
```javascript
{
  status: "error",
  error: "Error message here"
}
```

**Status Values:**
- `queued` - Job created, waiting to start
- `processing` - AI is generating the chart
- `complete` - Chart ready, chartId provided
- `error` - Generation failed

---

### GET /chart/:id
**Purpose:** Retrieve generated chart data

**Request:**
- Method: `GET`
- Path Parameter: `id` (chartId from job completion)

**Response:**
```javascript
{
  ganttData: {
    title: string,
    timeColumns: string[],     // e.g., ["Q1 2024", "Q2 2024"]
    data: [
      {
        title: string,
        isSwimlane: boolean,
        entity: string,
        taskType: "milestone" | "decision" | "task",
        bar: {
          startCol: number,
          endCol: number,
          color: string          // e.g., "priority-red"
        }
      }
    ],
    legend: [
      {
        color: string,
        label: string
      }
    ]
  },
  sessionId: string
}
```

**Error Response:**
```javascript
{
  error: "Chart not found or expired"
}
```

---

## Task Analysis & Q&A

### POST /get-task-analysis
**Purpose:** Get AI analysis of a specific task from the roadmap

**Request:**
- Method: `POST`
- Content-Type: `application/json`
- Rate Limit: API limit (100 requests per 15 minutes)

**Body:**
```javascript
{
  taskIdentifier: string,      // Task title from the roadmap
  sessionId: string            // Session ID from chart data
}
```

**Response:**
```javascript
{
  taskName: string,
  startDate: string,
  endDate: string,
  status: string,
  summary: string,
  rationale: string,
  factsText: string,
  risksText: string,
  businessImpact: string,
  totalCost: string,
  stakeholderSummary: string,
  // ... other analysis fields
}
```

---

### POST /ask-question
**Purpose:** Ask follow-up questions about a task

**Request:**
- Method: `POST`
- Content-Type: `application/json`
- Rate Limit: API limit (100 requests per 15 minutes)

**Body:**
```javascript
{
  question: string,            // User's question
  taskIdentifier: string,      // Current task being analyzed
  sessionId: string            // Session ID
}
```

**Response:**
```javascript
{
  answer: string               // AI-generated answer
}
```

---

## Edit Operations

### POST /update-task-dates
**Purpose:** Update task dates after drag-to-edit interaction

**Request:**
- Method: `POST`
- Content-Type: `application/json`

**Body:**
```javascript
{
  chartId: string,
  taskTitle: string,
  newStartCol: number,
  newEndCol: number
}
```

**Response:**
```javascript
{
  success: true,
  message: "Task dates updated successfully"
}
```

---

### POST /update-task-color
**Purpose:** Update task color after color picker interaction

**Request:**
- Method: `POST`
- Content-Type: `application/json`

**Body:**
```javascript
{
  chartId: string,
  taskTitle: string,
  newColor: string             // e.g., "priority-red"
}
```

**Response:**
```javascript
{
  success: true,
  message: "Task color updated successfully"
}
```

---

## Storage & Session Management

### Current Implementation: In-Memory

**Storage Modules:**
- `sessionStore` - Map of research data by sessionId
- `chartStore` - Map of chart data by chartId
- `jobStore` - Map of job status by jobId

**TTL (Time-to-Live):**
- All data expires after 1 hour
- Cleanup runs every 15 minutes

**Limitations:**
- Data lost on server restart
- No persistence
- Limited to server memory

---

## Rate Limiting

### Strict Limiter
- Applied to: `/generate-chart`
- Limit: 10 requests per 15 minutes
- Purpose: Prevent API abuse on expensive operations

### API Limiter
- Applied to: `/get-task-analysis`, `/ask-question`
- Limit: 100 requests per 15 minutes
- Purpose: Prevent API abuse on AI operations

---

## File Upload Configuration

**Middleware:** Multer
**Storage:** Memory (buffer)
**Max Files:** 100 files per request
**Max File Size:** 10 MB per file
**Max Total Size:** 100 MB per request

**Supported MIME Types:**
- `text/plain`
- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)

---

## Security Features

### Helmet.js Security Headers
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HSTS)

### CORS Configuration
- Configurable allowed origins
- Methods: GET, POST, OPTIONS
- Credentials: Supported
- Max Age: 24 hours

### Input Sanitization
- User prompts sanitized to prevent prompt injection
- Chart IDs validated (UUID format)
- Job IDs validated (UUID format)

### Request Timeouts
- Default: 2 minutes (120 seconds)
- Prevents hanging requests

---

## Changes Coming in Three-Screen Architecture

### New Endpoints (Phase 2)

**POST /generate-content**
- Replaces `/generate-chart`
- Generates all three content types in parallel
- Returns jobId and sessionId

**GET /content/:sessionId/:viewType**
- Retrieves specific view data
- viewType: `roadmap` | `slides` | `document`

**GET /session/:sessionId**
- Retrieves all content for a session

### Storage Changes (Phase 0 - Already Implemented)

**Database:** SQLite (better-sqlite3)
- Persistent storage
- No more 1-hour expiration
- Survives server restarts

**Tables:**
- `sessions` - Research files, prompts, status
- `content` - View-specific data (roadmap/slides/document)
- `jobs` - Async generation job tracking

### Backwards Compatibility

**Strategy:**
- Keep existing endpoints for compatibility
- Gradually migrate to new endpoints
- Support both old and new formats during transition

---

## Testing the API

### Generate a Chart
```bash
curl -X POST http://localhost:3000/generate-chart \
  -F "prompt=Create a Q1 2025 roadmap" \
  -F "researchFiles=@research.pdf"
```

### Poll Job Status
```bash
curl http://localhost:3000/job/{jobId}
```

### Get Chart
```bash
curl http://localhost:3000/chart/{chartId}
```

### Analyze Task
```bash
curl -X POST http://localhost:3000/get-task-analysis \
  -H "Content-Type: application/json" \
  -d '{"taskIdentifier": "Phase 1: Research", "sessionId": "{sessionId}"}'
```

---

## Error Handling

### Common Error Responses

**400 Bad Request:**
```javascript
{ error: "Missing required field: prompt" }
```

**404 Not Found:**
```javascript
{ error: "Chart not found or expired" }
{ error: "Job not found" }
```

**429 Too Many Requests:**
```javascript
{ error: "Rate limit exceeded. Please try again in 15 minutes." }
```

**500 Internal Server Error:**
```javascript
{ error: "Failed to generate chart: [details]" }
```

---

## Dependencies

**NPM Packages:**
- `express` - Web framework
- `multer` - File upload handling
- `mammoth` - DOCX to HTML conversion
- `helmet` - Security headers
- `compression` - Response compression
- `cors` - CORS handling
- `express-rate-limit` - Rate limiting
- `zod` - Schema validation
- `@google/generative-ai` - Gemini API

**New (Phase 0):**
- `better-sqlite3` - SQLite database

---

## Monitoring & Logging

**Current Logging:**
- Console logs for each request
- Job status updates
- Error logging
- Storage cleanup summaries

**Metrics Tracked:**
- Active sessions count
- Active charts count
- Active jobs count
- Storage health

---

## Production Considerations

**Environment Variables:**
```bash
GEMINI_API_KEY=required
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com
TRUST_PROXY=1
```

**Railway Deployment:**
- Trust proxy enabled
- Environment variables configured
- Static file serving from Public/
- Compression enabled

---

This documentation reflects the current state before implementing the three-screen architecture. It will be updated as new endpoints are added in Phase 2.
