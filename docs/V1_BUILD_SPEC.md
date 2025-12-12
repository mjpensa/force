# V1 Build Specification
## Consulting-Grade Research & Proposal Generator (Azure-Ready, Portable)

**Version:** 1.2.0
**Created:** 2025-12-12
**Updated:** 2025-12-12
**Status:** Implementation Blueprint

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Service Definitions](#2-service-definitions)
3. [Postgres Schema DDL](#3-postgres-schema-ddl)
4. [Qdrant Collection Configurations](#4-qdrant-collection-configurations)
5. [Environment Variables](#5-environment-variables)
6. [API Contract Schemas](#6-api-contract-schemas)
7. [Adapter Interfaces](#7-adapter-interfaces)
8. [Container Configurations](#8-container-configurations)
9. [Service Bus Topics & Queues](#9-service-bus-topics--queues)
10. [RAG Pipeline Configuration](#10-rag-pipeline-configuration)
11. [Frontend Authentication Flow](#11-frontend-authentication-flow)
12. [Operational Resilience](#12-operational-resilience)
13. [Cost Management & Usage Tracking](#13-cost-management--usage-tracking)
14. [Testing & Performance Targets](#14-testing--performance-targets)
15. [Admin & Management APIs](#15-admin--management-apis)
16. [Document Processing Pipeline](#16-document-processing-pipeline)
17. [Graceful Degradation & Fallbacks](#17-graceful-degradation--fallbacks)
18. [Health Monitoring](#18-health-monitoring)
19. [Implementation Checklist](#19-implementation-checklist)

---

## 1. Project Structure

```
force-v2/
├── apps/
│   ├── api/                          # Sync API service
│   │   ├── src/
│   │   │   ├── index.ts              # Express/Fastify entry
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts           # Authentication routes
│   │   │   │   ├── documents.ts      # Upload & document management
│   │   │   │   ├── content.ts        # Content generation endpoints
│   │   │   │   ├── retrieval.ts      # RAG retrieval gateway
│   │   │   │   └── health.ts         # Health check
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # Entra ID JWT validation
│   │   │   │   ├── tenant.ts         # Tenant scoping middleware
│   │   │   │   ├── rateLimit.ts      # Rate limiting
│   │   │   │   └── validation.ts     # Request validation
│   │   │   ├── services/
│   │   │   │   ├── retrieval.ts      # Retrieval gateway (filter enforcement)
│   │   │   │   ├── generation.ts     # LLM generation orchestrator
│   │   │   │   └── jobs.ts           # Job creation & status
│   │   │   └── config/
│   │   │       └── index.ts          # Service configuration
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── worker/                       # Async job processor
│   │   ├── src/
│   │   │   ├── index.ts              # Worker entry point
│   │   │   ├── processors/
│   │   │   │   ├── documentExtract.ts    # PDF/DOCX text extraction
│   │   │   │   ├── documentChunk.ts      # Semantic chunking
│   │   │   │   ├── documentEmbed.ts      # Embedding generation
│   │   │   │   ├── documentIndex.ts      # Qdrant upsert
│   │   │   │   ├── contentGenerate.ts    # RAG content generation
│   │   │   │   └── githubSync.ts         # GitHub repo sync
│   │   │   ├── pipelines/
│   │   │   │   ├── ingestion.ts          # Full ingestion pipeline
│   │   │   │   └── generation.ts         # Generation pipeline
│   │   │   └── config/
│   │   │       └── index.ts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          # Frontend (existing Public/ folder)
│       ├── index.html
│       ├── viewer.html
│       ├── main.js
│       ├── viewer.js
│       ├── components/
│       ├── gantt/
│       ├── utils/
│       ├── styles/
│       └── staticwebapp.config.json  # Azure Static Web Apps config
│
├── packages/
│   ├── shared/                       # Shared utilities & types
│   │   ├── src/
│   │   │   ├── schemas/              # JSON schemas & TypeScript types
│   │   │   │   ├── gantt-chart.ts
│   │   │   │   ├── slides.ts
│   │   │   │   ├── document.ts
│   │   │   │   ├── task-analysis.ts
│   │   │   │   ├── content-response.ts
│   │   │   │   └── index.ts
│   │   │   ├── types/
│   │   │   │   ├── tenant.ts
│   │   │   │   ├── engagement.ts
│   │   │   │   ├── document.ts
│   │   │   │   ├── job.ts
│   │   │   │   └── index.ts
│   │   │   ├── constants/
│   │   │   │   ├── kb-types.ts       # Knowledge base type enum
│   │   │   │   ├── job-types.ts      # Job type enum
│   │   │   │   └── index.ts
│   │   │   └── validation/
│   │   │       ├── retrieval-filter.ts   # Filter contract validation
│   │   │       └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── adapters/                     # Cloud-portable adapters
│   │   ├── src/
│   │   │   ├── storage/
│   │   │   │   ├── interface.ts      # ObjectStoreAdapter interface
│   │   │   │   ├── azure-blob.ts     # Azure Blob implementation
│   │   │   │   ├── s3.ts             # AWS S3 implementation
│   │   │   │   └── local.ts          # Local filesystem (dev)
│   │   │   ├── queue/
│   │   │   │   ├── interface.ts      # QueueAdapter interface
│   │   │   │   ├── azure-servicebus.ts
│   │   │   │   ├── aws-sqs.ts
│   │   │   │   └── local.ts          # In-memory (dev)
│   │   │   ├── secrets/
│   │   │   │   ├── interface.ts      # SecretsAdapter interface
│   │   │   │   ├── azure-keyvault.ts
│   │   │   │   ├── aws-secretsmanager.ts
│   │   │   │   └── env.ts            # Environment variables (dev)
│   │   │   ├── vector/
│   │   │   │   ├── interface.ts      # VectorStoreAdapter interface
│   │   │   │   ├── qdrant.ts         # Qdrant implementation
│   │   │   │   └── pinecone.ts       # Pinecone implementation
│   │   │   ├── llm/
│   │   │   │   ├── interface.ts      # LLMAdapter interface
│   │   │   │   ├── azure-openai.ts   # Azure OpenAI
│   │   │   │   ├── google-gemini.ts  # Google Gemini
│   │   │   │   └── openai.ts         # OpenAI direct
│   │   │   ├── embedding/
│   │   │   │   ├── interface.ts      # EmbeddingAdapter interface
│   │   │   │   ├── azure-openai.ts   # Azure OpenAI ada-002
│   │   │   │   ├── openai.ts         # OpenAI ada-002
│   │   │   │   └── google.ts         # Google embedding
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── database/                     # Database utilities
│       ├── src/
│       │   ├── client.ts             # Postgres client
│       │   ├── migrations/           # SQL migrations
│       │   │   ├── 001_initial.sql
│       │   │   ├── 002_documents.sql
│       │   │   ├── 003_chunks.sql
│       │   │   └── 004_audit.sql
│       │   ├── repositories/
│       │   │   ├── tenant.ts
│       │   │   ├── engagement.ts
│       │   │   ├── document.ts
│       │   │   ├── chunk.ts
│       │   │   ├── job.ts
│       │   │   └── audit.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── infrastructure/                   # Infrastructure as Code
│   ├── azure/
│   │   ├── main.bicep               # Azure Bicep templates
│   │   ├── modules/
│   │   │   ├── container-apps.bicep
│   │   │   ├── postgres.bicep
│   │   │   ├── storage.bicep
│   │   │   ├── servicebus.bicep
│   │   │   ├── keyvault.bicep
│   │   │   └── static-web-app.bicep
│   │   └── parameters/
│   │       ├── dev.json
│   │       ├── staging.json
│   │       └── prod.json
│   └── docker/
│       ├── docker-compose.yml       # Local development
│       └── docker-compose.prod.yml  # Production-like local
│
├── scripts/
│   ├── setup-local.sh               # Local dev environment setup
│   ├── migrate.ts                   # Database migration runner
│   └── seed.ts                      # Seed data for development
│
├── package.json                      # Monorepo root (workspaces)
├── pnpm-workspace.yaml              # pnpm workspace config
├── turbo.json                       # Turborepo config
└── tsconfig.base.json               # Shared TypeScript config
```

---

## 2. Service Definitions

### 2.1 API Service

**Purpose:** Synchronous HTTP API for frontend communication

**Responsibilities:**
- Authentication & authorization (Entra ID JWT validation)
- Document upload endpoint
- Content retrieval endpoints
- Generation job creation
- Health checks

**Container Configuration:**
```yaml
name: api
image: force-api:latest
resources:
  cpu: 1.0
  memory: 2Gi
scale:
  minReplicas: 1
  maxReplicas: 10
  rules:
    - name: http-scaling
      http:
        metadata:
          concurrentRequests: 50
ingress:
  external: true
  targetPort: 3000
  transport: http
env:
  - name: NODE_ENV
    value: production
  - name: PORT
    value: "3000"
  - name: DATABASE_URL
    secretRef: database-url
  - name: REDIS_URL
    secretRef: redis-url
  - name: QDRANT_URL
    value: http://qdrant:6333
  - name: SERVICE_BUS_CONNECTION
    secretRef: servicebus-connection
  - name: STORAGE_CONNECTION
    secretRef: storage-connection
```

### 2.2 Worker Service

**Purpose:** Asynchronous job processing

**Responsibilities:**
- Document extraction (PDF, DOCX, MD, TXT)
- Semantic chunking
- Embedding generation
- Qdrant indexing
- Content generation (RAG pipeline)
- GitHub repository sync

**Container Configuration:**
```yaml
name: worker
image: force-worker:latest
resources:
  cpu: 2.0
  memory: 4Gi
scale:
  minReplicas: 1
  maxReplicas: 5
  rules:
    - name: queue-scaling
      custom:
        type: azure-servicebus
        metadata:
          queueName: jobs
          messageCount: "10"
ingress:
  external: false  # Internal only
env:
  - name: NODE_ENV
    value: production
  - name: DATABASE_URL
    secretRef: database-url
  - name: REDIS_URL
    secretRef: redis-url
  - name: QDRANT_URL
    value: http://qdrant:6333
  - name: SERVICE_BUS_CONNECTION
    secretRef: servicebus-connection
  - name: STORAGE_CONNECTION
    secretRef: storage-connection
  - name: OPENAI_API_KEY
    secretRef: openai-api-key
  - name: GEMINI_API_KEY
    secretRef: gemini-api-key
```

### 2.3 Qdrant Service

**Purpose:** Vector database for RAG retrieval

**Container Configuration:**
```yaml
name: qdrant
image: qdrant/qdrant:latest
resources:
  cpu: 1.0
  memory: 4Gi
scale:
  minReplicas: 1
  maxReplicas: 1  # Single instance with persistent storage
ingress:
  external: false
  targetPort: 6333
volumes:
  - name: qdrant-storage
    storageName: qdrant-files
    storageType: AzureFile
    mountPath: /qdrant/storage
```

### 2.4 Web (Static Web App)

**Purpose:** Frontend hosting with authentication

**Configuration (staticwebapp.config.json):**
```json
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"],
      "rewrite": "https://force-api.azurecontainerapps.io/api/*"
    },
    {
      "route": "/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/{TENANT_ID}/v2.0",
          "clientIdSettingName": "AAD_CLIENT_ID",
          "clientSecretSettingName": "AAD_CLIENT_SECRET"
        }
      }
    }
  },
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/aad",
      "statusCode": 302
    }
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com"
  }
}
```

---

## 3. Postgres Schema DDL

```sql
-- ============================================
-- V1 Build Spec: PostgreSQL Schema
-- Force Research & Proposal Generator
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CORE ENTITIES
-- ============================================

-- Tenants (Organizations/Firms)
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;

-- Users (linked to Entra ID)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    entra_oid       VARCHAR(255) NOT NULL UNIQUE,  -- Azure AD Object ID
    email           VARCHAR(255) NOT NULL,
    display_name    VARCHAR(255),
    role            VARCHAR(50) NOT NULL DEFAULT 'member',  -- admin, member, viewer
    settings        JSONB DEFAULT '{}',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_tenant ON users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_entra ON users(entra_oid);
CREATE INDEX idx_users_email ON users(email);

-- Engagements (Client Projects)
CREATE TABLE engagements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    client_id       UUID,  -- Optional: link to client entity if tracking
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, archived, completed
    settings        JSONB DEFAULT '{}',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_engagements_tenant ON engagements(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_engagements_status ON engagements(tenant_id, status) WHERE deleted_at IS NULL;

-- ============================================
-- KNOWLEDGE BASE ENTITIES
-- ============================================

-- Knowledge Base Types
CREATE TYPE kb_type AS ENUM ('client', 'firm', 'oss');

-- Knowledge Bases (Collections of documents)
CREATE TABLE knowledge_bases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    engagement_id   UUID REFERENCES engagements(id),  -- NULL for firm/oss
    kb_type         kb_type NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    qdrant_collection VARCHAR(255) NOT NULL UNIQUE,  -- Qdrant collection name
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT kb_engagement_required CHECK (
        (kb_type = 'client' AND engagement_id IS NOT NULL) OR
        (kb_type IN ('firm', 'oss') AND engagement_id IS NULL)
    )
);

CREATE INDEX idx_kb_tenant ON knowledge_bases(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_kb_engagement ON knowledge_bases(engagement_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_kb_type ON knowledge_bases(tenant_id, kb_type) WHERE deleted_at IS NULL;

-- Documents
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),

    -- File metadata
    filename        VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    file_size       BIGINT NOT NULL,
    file_hash       VARCHAR(64) NOT NULL,  -- SHA-256 for deduplication

    -- Storage reference
    blob_path       VARCHAR(1000) NOT NULL,

    -- Processing status
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending, extracting, chunking, embedding, indexed, failed
    error_message   TEXT,

    -- Extracted content
    extracted_text  TEXT,
    page_count      INTEGER,
    word_count      INTEGER,

    -- Source tracking (for OSS/GitHub)
    source_type     VARCHAR(50),  -- upload, github, api
    source_url      VARCHAR(2000),
    source_ref      VARCHAR(255),  -- commit SHA, version, etc.

    -- Metadata
    metadata        JSONB DEFAULT '{}',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_documents_kb ON documents(knowledge_base_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_tenant ON documents(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_status ON documents(knowledge_base_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_hash ON documents(file_hash);

-- Document Chunks
CREATE TABLE document_chunks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),

    -- Chunk data
    chunk_index     INTEGER NOT NULL,
    chunk_text      TEXT NOT NULL,
    chunk_hash      VARCHAR(64) NOT NULL,  -- SHA-256 for change detection
    token_count     INTEGER NOT NULL,

    -- Position in source
    start_char      INTEGER,
    end_char        INTEGER,
    page_number     INTEGER,

    -- Vector reference
    qdrant_point_id UUID NOT NULL,  -- Qdrant point ID
    embedding_model VARCHAR(100) NOT NULL,

    -- Metadata
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(document_id, chunk_index)
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_kb ON document_chunks(knowledge_base_id);
CREATE INDEX idx_chunks_tenant ON document_chunks(tenant_id);
CREATE INDEX idx_chunks_qdrant ON document_chunks(qdrant_point_id);

-- ============================================
-- JOB MANAGEMENT
-- ============================================

-- Job Types
CREATE TYPE job_type AS ENUM (
    'document_ingest',      -- Full document ingestion pipeline
    'document_extract',     -- Extract text from document
    'document_chunk',       -- Chunk document
    'document_embed',       -- Generate embeddings
    'document_index',       -- Index to Qdrant
    'content_generate',     -- Generate content (roadmap, slides, etc.)
    'github_sync',          -- Sync GitHub repository
    'kb_reindex'            -- Reindex entire knowledge base
);

-- Job Status
CREATE TYPE job_status AS ENUM (
    'pending',
    'queued',
    'processing',
    'completed',
    'failed',
    'cancelled'
);

-- Jobs
CREATE TABLE jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    engagement_id   UUID REFERENCES engagements(id),

    -- Job definition
    job_type        job_type NOT NULL,
    status          job_status NOT NULL DEFAULT 'pending',
    priority        INTEGER NOT NULL DEFAULT 0,  -- Higher = more urgent

    -- Input/Output
    input_payload   JSONB NOT NULL,
    output_payload  JSONB,

    -- Progress tracking
    progress        INTEGER DEFAULT 0,  -- 0-100
    progress_message VARCHAR(500),

    -- Checkpoint system for mid-pipeline recovery
    last_completed_step VARCHAR(50),  -- 'extract', 'chunk', 'embed', 'index'
    checkpoint_data JSONB,            -- State to resume from (e.g., last chunk index)
    checkpoint_at   TIMESTAMPTZ,      -- When checkpoint was saved

    -- Error handling
    error_message   TEXT,
    error_details   JSONB,
    retry_count     INTEGER DEFAULT 0,
    max_retries     INTEGER DEFAULT 3,
    failed_step     VARCHAR(50),      -- Which step failed for targeted retry

    -- Timing
    queued_at       TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,

    -- Metadata
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_tenant ON jobs(tenant_id);
CREATE INDEX idx_jobs_status ON jobs(status) WHERE status IN ('pending', 'queued', 'processing');
CREATE INDEX idx_jobs_type_status ON jobs(job_type, status);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);

-- ============================================
-- GENERATED CONTENT
-- ============================================

-- Content Types
CREATE TYPE content_type AS ENUM (
    'roadmap',
    'slides',
    'document',
    'research_analysis',
    'task_analysis'
);

-- Generated Content (cached outputs)
CREATE TABLE generated_content (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    engagement_id   UUID NOT NULL REFERENCES engagements(id),
    job_id          UUID REFERENCES jobs(id),

    -- Content identification
    content_type    content_type NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,

    -- Content data
    content         JSONB NOT NULL,

    -- Generation metadata
    prompt_used     TEXT,
    model_used      VARCHAR(100),
    tokens_used     INTEGER,
    generation_time_ms INTEGER,

    -- Source tracking
    source_chunks   UUID[],  -- Array of chunk IDs used

    -- Metadata
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ  -- Optional TTL
);

CREATE INDEX idx_content_engagement ON generated_content(engagement_id);
CREATE INDEX idx_content_type ON generated_content(engagement_id, content_type);
CREATE INDEX idx_content_created ON generated_content(created_at DESC);

-- ============================================
-- SESSIONS (for interactive features)
-- ============================================

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    engagement_id   UUID REFERENCES engagements(id),
    user_id         UUID REFERENCES users(id),

    -- Session data
    session_data    JSONB NOT NULL DEFAULT '{}',

    -- Lifecycle
    last_accessed   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- AUDIT LOGGING
-- ============================================

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    user_id         UUID,

    -- Action details
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(100) NOT NULL,
    resource_id     UUID,

    -- Request context
    ip_address      INET,
    user_agent      VARCHAR(500),

    -- Change data
    old_values      JSONB,
    new_values      JSONB,

    -- Timestamp
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for performance
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- ============================================
-- RETRIEVAL AUDIT (for compliance)
-- ============================================

CREATE TABLE retrieval_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID REFERENCES users(id),
    engagement_id   UUID REFERENCES engagements(id),

    -- Query details
    query_text      TEXT NOT NULL,
    filter_params   JSONB NOT NULL,  -- The filter contract applied

    -- Results
    kb_types_queried kb_type[] NOT NULL,
    chunks_returned INTEGER NOT NULL,
    chunk_ids       UUID[],

    -- Performance
    query_time_ms   INTEGER,

    -- Timestamp
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_retrieval_tenant ON retrieval_logs(tenant_id, created_at DESC);
CREATE INDEX idx_retrieval_engagement ON retrieval_logs(engagement_id, created_at DESC);

-- ============================================
-- EXTRACTED EVENTS (for Timeline/Gantt)
-- ============================================

CREATE TABLE extracted_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id        UUID REFERENCES document_chunks(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    engagement_id   UUID REFERENCES engagements(id),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id),

    -- Event data
    event_date      DATE,
    event_date_text VARCHAR(100),      -- Original text: "Q1 2024", "mid-2025"
    event_end_date  DATE,              -- For ranges
    event_type      VARCHAR(50) NOT NULL,  -- milestone, decision, deadline, phase_start, phase_end
    event_title     VARCHAR(500) NOT NULL,
    event_description TEXT,
    event_entity    VARCHAR(255),      -- Associated organization/system/workstream

    -- Dependencies & relationships
    depends_on      UUID[],            -- Array of other event IDs
    related_events  UUID[],            -- Non-dependency relationships

    -- Provenance (critical for citations)
    source_text     TEXT NOT NULL,     -- Exact text extracted from
    source_context  TEXT,              -- Surrounding context
    page_number     INTEGER,
    char_start      INTEGER,
    char_end        INTEGER,

    -- Extraction metadata
    extraction_model VARCHAR(100),     -- Model that extracted this
    confidence      FLOAT NOT NULL DEFAULT 0.0,  -- 0.0-1.0
    manually_verified BOOLEAN DEFAULT false,
    verified_by     UUID REFERENCES users(id),

    -- Metadata
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_document ON extracted_events(document_id);
CREATE INDEX idx_events_engagement ON extracted_events(engagement_id);
CREATE INDEX idx_events_date ON extracted_events(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX idx_events_type ON extracted_events(event_type);
CREATE INDEX idx_events_entity ON extracted_events(event_entity) WHERE event_entity IS NOT NULL;
CREATE INDEX idx_events_confidence ON extracted_events(confidence DESC);

-- ============================================
-- DOCUMENT VERSIONING
-- ============================================

CREATE TABLE document_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,

    -- Version-specific data
    file_hash       VARCHAR(64) NOT NULL,
    blob_path       VARCHAR(1000) NOT NULL,
    file_size       BIGINT NOT NULL,

    -- Change tracking
    change_summary  TEXT,
    change_type     VARCHAR(50),  -- initial, update, correction, major_revision

    -- Processing state for this version
    chunks_count    INTEGER,
    events_count    INTEGER,

    -- Metadata
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(document_id, version_number)
);

CREATE INDEX idx_doc_versions ON document_versions(document_id, version_number DESC);

-- Add current_version to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_count INTEGER DEFAULT 1;

-- ============================================
-- PROMPT VERSIONING (for A/B testing & rollback)
-- ============================================

CREATE TABLE prompts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),  -- NULL = global/system prompt

    -- Identification
    name            VARCHAR(100) NOT NULL,  -- 'roadmap', 'slides', 'document', 'event_extraction'
    version         INTEGER NOT NULL,

    -- Content
    system_prompt   TEXT NOT NULL,
    user_prompt_template TEXT,  -- Template with {placeholders}
    output_schema   JSONB,      -- JSON schema for structured output

    -- Configuration
    model_config    JSONB DEFAULT '{}',  -- temperature, max_tokens, etc.

    -- Status
    is_active       BOOLEAN DEFAULT false,
    is_default      BOOLEAN DEFAULT false,

    -- Performance tracking
    usage_count     INTEGER DEFAULT 0,
    avg_latency_ms  INTEGER,
    avg_tokens      INTEGER,
    success_rate    FLOAT,  -- Successful generations / total attempts
    quality_score   FLOAT,  -- Manual quality rating 0-5

    -- Metadata
    description     TEXT,
    changelog       TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deprecated_at   TIMESTAMPTZ,

    UNIQUE(tenant_id, name, version)
);

CREATE INDEX idx_prompts_active ON prompts(name, is_active) WHERE is_active = true;
CREATE INDEX idx_prompts_default ON prompts(name, is_default) WHERE is_default = true;

-- Link generated content to prompts
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS prompt_id UUID REFERENCES prompts(id);
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS prompt_version INTEGER;

-- ============================================
-- USAGE TRACKING & COST MANAGEMENT
-- ============================================

CREATE TABLE usage_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID REFERENCES users(id),
    engagement_id   UUID REFERENCES engagements(id),

    -- Operation details
    operation_type  VARCHAR(50) NOT NULL,  -- embedding, generation, retrieval, extraction
    provider        VARCHAR(50) NOT NULL,  -- openai, gemini, azure-openai
    model           VARCHAR(100) NOT NULL, -- text-embedding-ada-002, gemini-2.5-flash, etc.

    -- Usage metrics
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    total_tokens    INTEGER NOT NULL DEFAULT 0,

    -- Cost (in USD, calculated at log time)
    cost_usd        DECIMAL(10, 6) NOT NULL DEFAULT 0,

    -- Performance
    latency_ms      INTEGER,
    success         BOOLEAN NOT NULL DEFAULT true,
    error_code      VARCHAR(50),

    -- Context
    job_id          UUID REFERENCES jobs(id),
    request_id      VARCHAR(100),  -- Correlation ID

    -- Timestamp
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partitioned by month for performance (create partitions as needed)
CREATE INDEX idx_usage_tenant_month ON usage_logs(tenant_id, created_at);
CREATE INDEX idx_usage_operation ON usage_logs(operation_type, created_at);
CREATE INDEX idx_usage_engagement ON usage_logs(engagement_id, created_at) WHERE engagement_id IS NOT NULL;

-- Tenant usage limits
CREATE TABLE tenant_usage_limits (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) UNIQUE,

    -- Monthly limits
    monthly_embedding_tokens INTEGER DEFAULT 10000000,  -- 10M tokens
    monthly_generation_tokens INTEGER DEFAULT 5000000,  -- 5M tokens
    monthly_cost_limit_usd DECIMAL(10, 2) DEFAULT 500.00,

    -- Rate limits (per minute)
    rate_limit_embeddings INTEGER DEFAULT 1000,
    rate_limit_generations INTEGER DEFAULT 100,
    rate_limit_retrievals INTEGER DEFAULT 500,

    -- Current period tracking (reset monthly)
    current_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    current_embedding_tokens INTEGER DEFAULT 0,
    current_generation_tokens INTEGER DEFAULT 0,
    current_cost_usd DECIMAL(10, 2) DEFAULT 0,

    -- Alerts
    alert_threshold_percent INTEGER DEFAULT 80,  -- Alert at 80% usage
    alert_email VARCHAR(255),
    last_alert_sent TIMESTAMPTZ,

    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_engagements_updated_at BEFORE UPDATE ON engagements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON knowledge_bases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (Optional but recommended)
-- ============================================

-- Enable RLS on tenant-scoped tables
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

-- Example policy (requires app to set current_setting('app.tenant_id'))
-- CREATE POLICY tenant_isolation ON engagements
--     USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================
-- INDEXES FOR COMMON QUERIES
-- ============================================

-- Fast document lookup by engagement
CREATE INDEX idx_documents_engagement ON documents(knowledge_base_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

-- Fast chunk lookup for RAG
CREATE INDEX idx_chunks_for_rag ON document_chunks(knowledge_base_id, chunk_index);

-- Fast job queue processing
CREATE INDEX idx_jobs_queue ON jobs(priority DESC, created_at ASC)
    WHERE status IN ('pending', 'queued');
```

---

## 4. Qdrant Collection Configurations

### 4.1 Collection Naming Convention

```
kb_{tenant_slug}_{kb_type}_{identifier}

Examples:
- kb_acme_client_eng_abc123     # Client engagement collection
- kb_acme_firm                  # Firm proprietary collection
- kb_global_oss_isda_cdm        # OSS ISDA CDM library
- kb_global_oss_basel_iii       # OSS Basel III regulations
```

### 4.2 Collection Creation Script

```typescript
// packages/adapters/src/vector/qdrant-collections.ts

import { QdrantClient } from '@qdrant/js-client-rest';

interface CollectionConfig {
  name: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
  onDiskPayload: boolean;
  quantization?: {
    scalar: {
      type: 'int8';
      always_ram: boolean;
    };
  };
}

const DEFAULT_CONFIG: Partial<CollectionConfig> = {
  vectorSize: 1536,  // OpenAI ada-002 dimensions
  distance: 'Cosine',
  onDiskPayload: true,
  quantization: {
    scalar: {
      type: 'int8',
      always_ram: true,  // Keep quantized vectors in RAM for speed
    },
  },
};

export async function createCollection(
  client: QdrantClient,
  config: CollectionConfig
): Promise<void> {
  const { name, vectorSize, distance, onDiskPayload, quantization } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  await client.createCollection(name, {
    vectors: {
      size: vectorSize,
      distance: distance,
      on_disk: false,  // Keep vectors in RAM
    },
    on_disk_payload: onDiskPayload,
    quantization_config: quantization,
    // Optimizers for production
    optimizers_config: {
      default_segment_number: 4,
      memmap_threshold: 20000,
      indexing_threshold: 20000,
    },
    // HNSW index configuration
    hnsw_config: {
      m: 16,
      ef_construct: 100,
      full_scan_threshold: 10000,
      max_indexing_threads: 0,  // Auto
      on_disk: false,
    },
  });

  // Create payload indexes for filtering
  await client.createPayloadIndex(name, {
    field_name: 'tenant_id',
    field_schema: 'keyword',
  });

  await client.createPayloadIndex(name, {
    field_name: 'engagement_id',
    field_schema: 'keyword',
  });

  await client.createPayloadIndex(name, {
    field_name: 'kb_type',
    field_schema: 'keyword',
  });

  await client.createPayloadIndex(name, {
    field_name: 'document_id',
    field_schema: 'keyword',
  });

  await client.createPayloadIndex(name, {
    field_name: 'source_file',
    field_schema: 'keyword',
  });
}
```

### 4.3 Point Payload Schema

```typescript
// packages/shared/src/types/qdrant-payload.ts

export interface ChunkPayload {
  // Scoping (REQUIRED for filter contract)
  tenant_id: string;           // UUID
  engagement_id: string | null; // UUID, null for firm/oss
  kb_type: 'client' | 'firm' | 'oss';
  knowledge_base_id: string;   // UUID

  // Document reference
  document_id: string;         // UUID
  chunk_index: number;

  // Source metadata
  source_file: string;         // Original filename
  page_number: number | null;

  // Content metadata
  token_count: number;
  word_count: number;

  // Chunk text (stored in payload for reranking)
  text: string;

  // Optional metadata
  section_title?: string;
  language?: string;
  created_at: string;          // ISO timestamp
}
```

### 4.4 Qdrant Docker Compose (Local Dev)

```yaml
# infrastructure/docker/docker-compose.yml

version: '3.8'

services:
  qdrant:
    image: qdrant/qdrant:v1.7.4
    container_name: force-qdrant
    ports:
      - "6333:6333"   # REST API
      - "6334:6334"   # gRPC
    volumes:
      - qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__LOG_LEVEL=INFO
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  qdrant_storage:
```

### 4.5 Qdrant High Availability (Production)

**Option A: Qdrant Cloud (Recommended for Production)**

```typescript
// packages/adapters/src/vector/qdrant-cloud.ts

interface QdrantCloudConfig {
  // Managed service - handles HA, backups, scaling
  cluster: {
    url: 'https://your-cluster.qdrant.io:6333';
    apiKey: process.env.QDRANT_API_KEY;

    // Built-in replication
    replicationFactor: 2;

    // Automatic backups
    backups: {
      enabled: true;
      retention: '30d';
    };
  };
}
```

**Option B: Self-Hosted Cluster (Azure Container Apps)**

```yaml
# infrastructure/azure/qdrant-cluster.yaml

# Qdrant Cluster Configuration for Azure
# Requires 3 nodes minimum for HA

apiVersion: apps.containerapps.azure/v1
kind: ContainerApp
metadata:
  name: qdrant-node-0
spec:
  configuration:
    ingress:
      external: false
      targetPort: 6333
  template:
    containers:
      - name: qdrant
        image: qdrant/qdrant:v1.7.4
        resources:
          cpu: 2.0
          memory: 8Gi
        env:
          - name: QDRANT__CLUSTER__ENABLED
            value: "true"
          - name: QDRANT__CLUSTER__P2P__PORT
            value: "6335"
          - name: QDRANT__CLUSTER__CONSENSUS__TICK_PERIOD_MS
            value: "100"
        volumeMounts:
          - volumeName: qdrant-storage
            mountPath: /qdrant/storage
    volumes:
      - name: qdrant-storage
        storageName: qdrant-premium-files
        storageType: AzureFile

---
# Repeat for qdrant-node-1, qdrant-node-2
```

### 4.6 Qdrant Backup & Recovery

```typescript
// packages/adapters/src/vector/qdrant-backup.ts

interface QdrantBackupConfig {
  // Backup schedule
  schedule: {
    full: '0 2 * * 0';     // Full backup: Sundays at 2 AM
    snapshot: '0 */6 * * *'; // Snapshots: Every 6 hours
  };

  // Storage destination
  destination: {
    provider: 'azure-blob';
    container: 'qdrant-backups';
    path: '{date}/{collection}/';
    retention: {
      snapshots: 7;   // Keep 7 days of snapshots
      full: 30;       // Keep 30 days of full backups
    };
  };

  // Recovery configuration
  recovery: {
    // Point-in-time recovery via snapshots
    maxRecoveryTime: '15m';  // RTO target

    // Procedure
    steps: [
      '1. Stop write traffic to affected collection',
      '2. Identify latest valid snapshot',
      '3. Restore snapshot to new collection',
      '4. Validate data integrity',
      '5. Swap collection alias',
      '6. Resume traffic'
    ];
  };
}

// Backup implementation
export class QdrantBackupService {
  async createSnapshot(collectionName: string): Promise<string> {
    const response = await this.client.createSnapshot(collectionName);
    const snapshotPath = response.result.name;

    // Upload to blob storage
    await this.uploadToBlob(
      `snapshots/${collectionName}/${Date.now()}.snapshot`,
      snapshotPath
    );

    return snapshotPath;
  }

  async restoreSnapshot(
    collectionName: string,
    snapshotPath: string
  ): Promise<void> {
    // Download from blob
    const localPath = await this.downloadFromBlob(snapshotPath);

    // Restore to new collection
    const tempCollection = `${collectionName}_restore_${Date.now()}`;
    await this.client.recoverSnapshot(tempCollection, localPath);

    // Validate
    const info = await this.client.getCollectionInfo(tempCollection);
    if (info.status !== 'green') {
      throw new Error('Restored collection unhealthy');
    }

    // Swap via alias (zero-downtime)
    await this.client.updateCollectionAliases({
      actions: [
        { delete_alias: { alias_name: collectionName } },
        { create_alias: { alias_name: collectionName, collection_name: tempCollection } }
      ]
    });
  }
}
```

### 4.7 Collection Lifecycle Management

```typescript
// packages/adapters/src/vector/collection-lifecycle.ts

interface CollectionLifecycleConfig {
  // Auto-archive completed engagements
  archivePolicy: {
    // Archive when engagement status = 'completed' + N days
    archiveAfterCompletionDays: 90;

    // Archive procedure
    procedure: {
      // 1. Export vectors to blob storage
      exportToBlob: true;
      blobPath: 'archived/{tenantId}/{engagementId}/{date}/';

      // 2. Delete from Qdrant
      deleteCollection: true;

      // 3. Update DB status
      updateDbStatus: 'archived';
    };
  };

  // Restore on demand
  restorePolicy: {
    // Automatically restore when engagement accessed
    restoreOnAccess: true;
    restoreTimeout: 60000;  // 60 seconds max

    // Keep restored collections for N days before re-archiving
    keepRestoredDays: 7;
  };

  // Cleanup orphaned collections
  cleanupPolicy: {
    // Run cleanup job daily
    schedule: '0 3 * * *';

    // Delete collections with no DB reference
    deleteOrphaned: true;

    // Delete empty collections older than N days
    deleteEmptyAfterDays: 7;
  };
}
```

---

## 5. Environment Variables

### 5.1 API Service

```bash
# apps/api/.env.example

# ============================================
# Core Configuration
# ============================================
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# ============================================
# Database
# ============================================
DATABASE_URL=postgresql://user:password@localhost:5432/force
DATABASE_POOL_SIZE=20
DATABASE_SSL=false

# ============================================
# Redis Cache
# ============================================
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=3600  # 1 hour default

# ============================================
# Vector Database
# ============================================
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=  # Optional for local

# ============================================
# Object Storage (Azure Blob / S3)
# ============================================
STORAGE_PROVIDER=azure  # azure | s3 | local
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=force-documents
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_S3_BUCKET=

# ============================================
# Queue (Azure Service Bus / SQS)
# ============================================
QUEUE_PROVIDER=azure  # azure | sqs | local
AZURE_SERVICEBUS_CONNECTION_STRING=
# AWS_SQS_QUEUE_URL=

# ============================================
# Authentication (Entra ID)
# ============================================
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_AUDIENCE=api://force-api

# ============================================
# LLM Providers
# ============================================
LLM_PROVIDER=gemini  # gemini | azure-openai | openai

# Google Gemini
GEMINI_API_KEY=

# Azure OpenAI
# AZURE_OPENAI_API_KEY=
# AZURE_OPENAI_ENDPOINT=
# AZURE_OPENAI_DEPLOYMENT_NAME=

# OpenAI Direct
# OPENAI_API_KEY=

# ============================================
# Embedding Provider
# ============================================
EMBEDDING_PROVIDER=openai  # openai | azure-openai | google
EMBEDDING_MODEL=text-embedding-ada-002

# ============================================
# Rate Limiting
# ============================================
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_STRICT_MAX=20

# ============================================
# CORS
# ============================================
ALLOWED_ORIGINS=http://localhost:3000,https://force.example.com

# ============================================
# Feature Flags
# ============================================
ENABLE_AUDIT_LOGGING=true
ENABLE_RAG_RERANKING=true
MAX_UPLOAD_SIZE_MB=50
MAX_FILES_PER_UPLOAD=20
```

### 5.2 Worker Service

```bash
# apps/worker/.env.example

# Inherits most from API, plus:

# ============================================
# Worker Configuration
# ============================================
WORKER_CONCURRENCY=5
WORKER_POLL_INTERVAL_MS=1000

# ============================================
# Chunking Configuration
# ============================================
CHUNK_SIZE_TOKENS=500
CHUNK_OVERLAP_TOKENS=50
CHUNK_MIN_SIZE_TOKENS=100

# ============================================
# Embedding Configuration
# ============================================
EMBEDDING_BATCH_SIZE=100
EMBEDDING_MAX_RETRIES=3
EMBEDDING_RETRY_DELAY_MS=1000

# ============================================
# GitHub Sync (for OSS ingestion)
# ============================================
GITHUB_TOKEN=  # Personal access token for private repos
GITHUB_SYNC_ENABLED=true
GITHUB_SYNC_INTERVAL_HOURS=24
```

### 5.3 Azure Key Vault Secrets

```
# Secrets to store in Key Vault (not in env files for production)

database-url
redis-url
servicebus-connection
storage-connection
gemini-api-key
openai-api-key
azure-openai-api-key
github-token
aad-client-secret
```

---

## 6. API Contract Schemas

### 6.1 Gantt Chart Schema (Preserve Existing)

```typescript
// packages/shared/src/schemas/gantt-chart.ts

export interface GanttChartSchema {
  title: string;
  timeColumns: string[];  // e.g., ["Q1 2024", "Q2 2024", ...]
  data: GanttRow[];
  legend: LegendItem[];
  researchAnalysis?: ResearchAnalysis;
}

export interface GanttRow {
  title: string;
  isSwimlane: boolean;
  entity: string;
  bar: GanttBar | null;
  taskType?: 'milestone' | 'decision' | 'task';
}

export interface GanttBar {
  startCol: number;
  endCol: number;
  color: string;
}

export interface LegendItem {
  color: string;
  label: string;
}

export interface ResearchAnalysis {
  topics: TopicAnalysis[];
  overallScore: number;
  summary: string;
}

export interface TopicAnalysis {
  name: string;
  fitnessScore: number;
  eventDataQuality: string;
  datesFound: number;
}
```

### 6.2 Slides Schema (Preserve Existing)

```typescript
// packages/shared/src/schemas/slides.ts

export interface SlidesSchema {
  slides: Slide[];
}

export interface Slide {
  tagline: string;      // Max 21 chars
  title: string;        // Exactly 4 lines (3 newlines)
  body: string;         // 380-410 chars
  footer?: string;
}
```

### 6.3 Document Schema (Preserve Existing)

```typescript
// packages/shared/src/schemas/document.ts

export interface DocumentSchema {
  title: string;
  sections: DocumentSection[];
}

export interface DocumentSection {
  heading: string;
  paragraphs: string[];
}
```

### 6.4 Content Response Schema (Preserve Existing)

```typescript
// packages/shared/src/schemas/content-response.ts

import { GanttChartSchema } from './gantt-chart';
import { SlidesSchema } from './slides';
import { DocumentSchema } from './document';
import { ResearchAnalysisSchema } from './research-analysis';

export interface ContentGenerationResponse {
  sessionId: string;
  roadmap: GanttChartSchema;
  slides: SlidesSchema;
  document: DocumentSchema;
  analysis: ResearchAnalysisSchema;
}
```

### 6.5 Task Analysis Schema (Preserve Existing)

```typescript
// packages/shared/src/schemas/task-analysis.ts

export interface TaskAnalysisSchema {
  taskName: string;
  startDate: string;
  endDate: string;
  status: 'completed' | 'in-progress' | 'not-started';
  summary: string;           // 2-3 sentences
  rationale: string;         // 2-3 sentences
  factsText: string;         // Bulleted list
  assumptionsText: string;   // Bulleted list
  expectedDate: string;
  risksText: string;         // 3-5 risks
  businessImpact: string;    // 1-2 sentences
  stakeholderSummary: string; // 2-3 sentences
  keyMetrics: string;        // 3-5 metrics

  // Optional extended fields
  financialAnalysis?: string;
  riskAnalysis?: string;
  progressAnalysis?: string;
}
```

### 6.6 Retrieval Filter Contract

```typescript
// packages/shared/src/schemas/retrieval-filter.ts

/**
 * CRITICAL: This contract MUST be enforced on every retrieval call.
 * No retrieval can execute without explicit scope parameters.
 */
export interface RetrievalFilter {
  // REQUIRED: Tenant isolation
  tenant_id: string;

  // REQUIRED for client work, null for firm/oss only queries
  engagement_id: string | null;

  // REQUIRED: Explicit declaration of knowledge base types to query
  kb_types: Array<'client' | 'firm' | 'oss'>;

  // Optional: Specific knowledge bases (if not querying all of type)
  knowledge_base_ids?: string[];

  // Optional: Document-level filtering
  document_ids?: string[];

  // Optional: Date range filtering
  created_after?: string;
  created_before?: string;
}

/**
 * Validates that a filter meets the minimum requirements.
 * Throws if invalid.
 */
export function validateRetrievalFilter(filter: RetrievalFilter): void {
  if (!filter.tenant_id) {
    throw new Error('RetrievalFilter: tenant_id is required');
  }

  if (!filter.kb_types || filter.kb_types.length === 0) {
    throw new Error('RetrievalFilter: kb_types must be explicitly declared');
  }

  if (filter.kb_types.includes('client') && !filter.engagement_id) {
    throw new Error('RetrievalFilter: engagement_id required when querying client KB');
  }

  // Validate UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(filter.tenant_id)) {
    throw new Error('RetrievalFilter: tenant_id must be valid UUID');
  }

  if (filter.engagement_id && !uuidRegex.test(filter.engagement_id)) {
    throw new Error('RetrievalFilter: engagement_id must be valid UUID');
  }
}
```

---

## 7. Adapter Interfaces

### 7.1 Object Storage Adapter

```typescript
// packages/adapters/src/storage/interface.ts

export interface ObjectStoreAdapter {
  /**
   * Upload a file to storage
   */
  upload(
    path: string,
    content: Buffer | ReadableStream,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Download a file from storage
   */
  download(path: string): Promise<Buffer>;

  /**
   * Get a readable stream for a file
   */
  getStream(path: string): Promise<ReadableStream>;

  /**
   * Delete a file
   */
  delete(path: string): Promise<void>;

  /**
   * Check if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * List files with prefix
   */
  list(prefix: string, options?: ListOptions): Promise<ListResult>;

  /**
   * Generate a signed URL for direct access (time-limited)
   */
  getSignedUrl(path: string, expiresIn: number): Promise<string>;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

export interface UploadResult {
  path: string;
  etag: string;
  size: number;
}

export interface ListOptions {
  maxResults?: number;
  continuationToken?: string;
}

export interface ListResult {
  files: FileInfo[];
  continuationToken?: string;
}

export interface FileInfo {
  path: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}
```

### 7.2 Queue Adapter

```typescript
// packages/adapters/src/queue/interface.ts

export interface QueueAdapter {
  /**
   * Send a message to the queue
   */
  send<T>(message: QueueMessage<T>): Promise<string>;

  /**
   * Send multiple messages
   */
  sendBatch<T>(messages: QueueMessage<T>[]): Promise<string[]>;

  /**
   * Receive messages (for worker polling)
   */
  receive<T>(options?: ReceiveOptions): Promise<ReceivedMessage<T>[]>;

  /**
   * Complete a message (acknowledge processing)
   */
  complete(messageId: string, receiptHandle: string): Promise<void>;

  /**
   * Abandon a message (return to queue)
   */
  abandon(messageId: string, receiptHandle: string): Promise<void>;

  /**
   * Dead-letter a message
   */
  deadLetter(
    messageId: string,
    receiptHandle: string,
    reason: string
  ): Promise<void>;

  /**
   * Schedule a message for future delivery
   */
  schedule<T>(
    message: QueueMessage<T>,
    deliverAt: Date
  ): Promise<string>;
}

export interface QueueMessage<T> {
  body: T;
  contentType?: string;
  correlationId?: string;
  sessionId?: string;  // For ordered processing
  label?: string;
  userProperties?: Record<string, string | number | boolean>;
}

export interface ReceivedMessage<T> extends QueueMessage<T> {
  messageId: string;
  receiptHandle: string;
  deliveryCount: number;
  enqueuedTime: Date;
}

export interface ReceiveOptions {
  maxMessages?: number;
  waitTimeSeconds?: number;
  visibilityTimeout?: number;
}
```

### 7.3 Secrets Adapter

```typescript
// packages/adapters/src/secrets/interface.ts

export interface SecretsAdapter {
  /**
   * Get a secret value
   */
  get(name: string): Promise<string>;

  /**
   * Get multiple secrets
   */
  getBatch(names: string[]): Promise<Record<string, string>>;

  /**
   * Check if secret exists
   */
  exists(name: string): Promise<boolean>;

  /**
   * Set a secret (for local dev only)
   */
  set?(name: string, value: string): Promise<void>;
}
```

### 7.4 Vector Store Adapter

```typescript
// packages/adapters/src/vector/interface.ts

import { RetrievalFilter } from '@force/shared/schemas/retrieval-filter';

export interface VectorStoreAdapter {
  /**
   * Create a collection
   */
  createCollection(name: string, config: CollectionConfig): Promise<void>;

  /**
   * Delete a collection
   */
  deleteCollection(name: string): Promise<void>;

  /**
   * Upsert vectors
   */
  upsert(
    collection: string,
    points: VectorPoint[]
  ): Promise<void>;

  /**
   * Delete vectors by IDs
   */
  delete(collection: string, ids: string[]): Promise<void>;

  /**
   * Delete vectors by filter
   */
  deleteByFilter(
    collection: string,
    filter: Record<string, unknown>
  ): Promise<number>;

  /**
   * Search with mandatory filter contract
   */
  search(
    collection: string,
    vector: number[],
    filter: RetrievalFilter,
    options?: SearchOptions
  ): Promise<SearchResult[]>;

  /**
   * Scroll through all points matching filter
   */
  scroll(
    collection: string,
    filter: RetrievalFilter,
    options?: ScrollOptions
  ): AsyncIterable<VectorPoint>;

  /**
   * Get collection info
   */
  getCollectionInfo(name: string): Promise<CollectionInfo>;
}

export interface CollectionConfig {
  vectorSize: number;
  distance: 'cosine' | 'euclidean' | 'dot';
  onDiskPayload?: boolean;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchOptions {
  limit?: number;
  scoreThreshold?: number;
  withPayload?: boolean;
  withVector?: boolean;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
  vector?: number[];
}

export interface ScrollOptions {
  limit?: number;
  offset?: string;
  withPayload?: boolean;
  withVector?: boolean;
}

export interface CollectionInfo {
  name: string;
  pointsCount: number;
  vectorSize: number;
  status: 'green' | 'yellow' | 'red';
}
```

### 7.5 LLM Adapter

```typescript
// packages/adapters/src/llm/interface.ts

export interface LLMAdapter {
  /**
   * Generate text completion
   */
  generate(request: GenerateRequest): Promise<GenerateResponse>;

  /**
   * Generate with structured output (JSON schema)
   */
  generateStructured<T>(
    request: GenerateRequest,
    schema: JSONSchema
  ): Promise<T>;

  /**
   * Stream text completion
   */
  stream(request: GenerateRequest): AsyncIterable<string>;

  /**
   * Count tokens in text
   */
  countTokens(text: string): Promise<number>;
}

export interface GenerateRequest {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  seed?: number;  // For deterministic output
}

export interface GenerateResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type JSONSchema = {
  type: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: string[];
  description?: string;
};
```

### 7.6 Embedding Adapter

```typescript
// packages/adapters/src/embedding/interface.ts

export interface EmbeddingAdapter {
  /**
   * Generate embedding for single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batched)
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get the dimension of embeddings
   */
  getDimension(): number;

  /**
   * Get the model name
   */
  getModel(): string;
}
```

---

## 8. Container Configurations

### 8.1 API Dockerfile

```dockerfile
# apps/api/Dockerfile

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/database/package.json ./packages/database/
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/adapters/node_modules ./packages/adapters/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY . .
RUN pnpm --filter @force/api build

# Production
FROM base AS runner
ENV NODE_ENV=production

# Security: Run as non-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api
USER api

COPY --from=builder --chown=api:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=api:nodejs /app/apps/api/package.json ./
COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 8.2 Worker Dockerfile

```dockerfile
# apps/worker/Dockerfile

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# Install native dependencies for PDF/DOCX processing
RUN apk add --no-cache python3 make g++

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/database/package.json ./packages/database/
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/adapters/node_modules ./packages/adapters/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY . .
RUN pnpm --filter @force/worker build

# Production
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker
USER worker

COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/apps/worker/package.json ./
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules

CMD ["node", "dist/index.js"]
```

### 8.3 Docker Compose (Local Development)

```yaml
# infrastructure/docker/docker-compose.yml

version: '3.8'

services:
  # PostgreSQL
  postgres:
    image: postgres:16-alpine
    container_name: force-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: force
      POSTGRES_PASSWORD: force_dev_password
      POSTGRES_DB: force
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U force"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    container_name: force-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Qdrant
  qdrant:
    image: qdrant/qdrant:v1.7.4
    container_name: force-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      - QDRANT__LOG_LEVEL=INFO
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Azurite (Azure Storage Emulator)
  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    container_name: force-azurite
    ports:
      - "10000:10000"  # Blob
      - "10001:10001"  # Queue
      - "10002:10002"  # Table
    volumes:
      - azurite_data:/data
    command: azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0

  # API Service
  api:
    build:
      context: ../..
      dockerfile: apps/api/Dockerfile
    container_name: force-api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - PORT=3000
      - DATABASE_URL=postgresql://force:force_dev_password@postgres:5432/force
      - REDIS_URL=redis://redis:6379
      - QDRANT_URL=http://qdrant:6333
      - STORAGE_PROVIDER=local
      - QUEUE_PROVIDER=local
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      qdrant:
        condition: service_healthy
    volumes:
      - ../../apps/api/src:/app/apps/api/src  # Hot reload

  # Worker Service
  worker:
    build:
      context: ../..
      dockerfile: apps/worker/Dockerfile
    container_name: force-worker
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://force:force_dev_password@postgres:5432/force
      - REDIS_URL=redis://redis:6379
      - QDRANT_URL=http://qdrant:6333
      - STORAGE_PROVIDER=local
      - QUEUE_PROVIDER=local
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      qdrant:
        condition: service_healthy
    volumes:
      - ../../apps/worker/src:/app/apps/worker/src  # Hot reload

volumes:
  postgres_data:
  redis_data:
  qdrant_data:
  azurite_data:
```

---

## 9. Service Bus Topics & Queues

### 9.1 Queue Definitions

```typescript
// packages/shared/src/constants/queues.ts

export const QUEUES = {
  // Main job queue
  JOBS: 'jobs',

  // Dead letter queue
  JOBS_DLQ: 'jobs-dlq',

  // High priority queue (for regeneration requests)
  JOBS_PRIORITY: 'jobs-priority',
} as const;

export const TOPICS = {
  // Document lifecycle events
  DOCUMENTS: 'documents',

  // Job status updates
  JOB_STATUS: 'job-status',
} as const;

export const SUBSCRIPTIONS = {
  // Document events
  DOCUMENT_UPLOADED: 'document-uploaded',
  DOCUMENT_PROCESSED: 'document-processed',
  DOCUMENT_INDEXED: 'document-indexed',

  // Job status
  JOB_COMPLETED: 'job-completed',
  JOB_FAILED: 'job-failed',
} as const;
```

### 9.2 Job Message Schema

```typescript
// packages/shared/src/types/job-message.ts

export interface JobMessage {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  engagementId?: string;
  userId?: string;
  priority: number;
  payload: JobPayload;
  createdAt: string;
}

export type JobType =
  | 'document_ingest'
  | 'document_extract'
  | 'document_chunk'
  | 'document_embed'
  | 'document_index'
  | 'content_generate'
  | 'github_sync'
  | 'kb_reindex';

export type JobPayload =
  | DocumentIngestPayload
  | DocumentExtractPayload
  | DocumentChunkPayload
  | DocumentEmbedPayload
  | DocumentIndexPayload
  | ContentGeneratePayload
  | GithubSyncPayload
  | KbReindexPayload;

export interface DocumentIngestPayload {
  documentId: string;
  knowledgeBaseId: string;
  blobPath: string;
  filename: string;
  mimeType: string;
}

export interface DocumentExtractPayload {
  documentId: string;
  blobPath: string;
  mimeType: string;
}

export interface DocumentChunkPayload {
  documentId: string;
  extractedText: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface DocumentEmbedPayload {
  documentId: string;
  chunks: Array<{
    chunkId: string;
    text: string;
    chunkIndex: number;
  }>;
}

export interface DocumentIndexPayload {
  documentId: string;
  knowledgeBaseId: string;
  chunks: Array<{
    chunkId: string;
    embedding: number[];
    metadata: Record<string, unknown>;
  }>;
}

export interface ContentGeneratePayload {
  engagementId: string;
  contentTypes: Array<'roadmap' | 'slides' | 'document' | 'analysis'>;
  prompt: string;
  retrievalFilter: RetrievalFilter;
}

export interface GithubSyncPayload {
  knowledgeBaseId: string;
  repoUrl: string;
  branch: string;
  lastCommitSha?: string;
  pathFilter?: string;  // e.g., "docs/**/*.md"
}

export interface KbReindexPayload {
  knowledgeBaseId: string;
  force?: boolean;  // Re-embed even if unchanged
}
```

### 9.3 Azure Service Bus Configuration

```bicep
// infrastructure/azure/modules/servicebus.bicep

param location string
param namePrefix string
param sku string = 'Standard'

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${namePrefix}-servicebus'
  location: location
  sku: {
    name: sku
    tier: sku
  }
  properties: {}
}

// Main jobs queue
resource jobsQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'jobs'
  properties: {
    lockDuration: 'PT5M'  // 5 minute lock
    maxSizeInMegabytes: 1024
    requiresDuplicateDetection: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    maxDeliveryCount: 5
    deadLetteringOnMessageExpiration: true
    enablePartitioning: false
  }
}

// Priority queue
resource jobsPriorityQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'jobs-priority'
  properties: {
    lockDuration: 'PT5M'
    maxSizeInMegabytes: 256
    maxDeliveryCount: 3
    deadLetteringOnMessageExpiration: true
  }
}

// Documents topic (for event-driven processing)
resource documentsTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'documents'
  properties: {
    maxSizeInMegabytes: 1024
    requiresDuplicateDetection: true
  }
}

// Subscriptions for document events
resource documentUploadedSub 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: documentsTopic
  name: 'document-uploaded'
  properties: {
    lockDuration: 'PT5M'
    maxDeliveryCount: 5
    deadLetteringOnMessageExpiration: true
  }
}

output connectionString string = listKeys(
  '${serviceBusNamespace.id}/AuthorizationRules/RootManageSharedAccessKey',
  serviceBusNamespace.apiVersion
).primaryConnectionString
```

---

## 10. RAG Pipeline Configuration

### 10.1 Chunking Strategy

```typescript
// packages/shared/src/config/chunking.ts

export interface ChunkingConfig {
  // Chunking algorithm
  strategy: 'recursive' | 'semantic' | 'markdown-aware';

  // Size configuration
  maxTokens: number;        // Target chunk size (default: 500)
  overlapTokens: number;    // Overlap between chunks (default: 50)
  minTokens: number;        // Minimum chunk size (default: 100)

  // Structured content handling
  preserveTables: boolean;       // Keep tables as single chunks
  preserveCodeBlocks: boolean;   // Don't split code blocks
  preserveLists: boolean;        // Keep lists together
  preserveHeadings: boolean;     // Keep heading with following content

  // Parent-child chunking for context retrieval
  enableParentChunks: boolean;   // Store larger parent chunks
  parentChunkSize: number;       // Parent chunk size (default: 2000)
  parentOverlap: number;         // Parent overlap (default: 200)

  // Metadata extraction
  extractHeadings: boolean;      // Extract section headings
  extractPageNumbers: boolean;   // Track page numbers (PDF)
}

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  strategy: 'markdown-aware',
  maxTokens: 500,
  overlapTokens: 50,
  minTokens: 100,

  preserveTables: true,
  preserveCodeBlocks: true,
  preserveLists: true,
  preserveHeadings: true,

  enableParentChunks: true,
  parentChunkSize: 2000,
  parentOverlap: 200,

  extractHeadings: true,
  extractPageNumbers: true,
};

// Chunking implementation
export class DocumentChunker {
  constructor(private config: ChunkingConfig) {}

  async chunk(text: string, metadata: DocumentMetadata): Promise<Chunk[]> {
    // 1. Pre-process: identify structural elements
    const structures = this.identifyStructures(text);

    // 2. Split respecting structure boundaries
    const rawChunks = this.splitWithStructure(text, structures);

    // 3. Merge small chunks, split large ones
    const sizedChunks = this.normalizeChunkSizes(rawChunks);

    // 4. Add overlap
    const overlappedChunks = this.addOverlap(sizedChunks);

    // 5. Create parent chunks if enabled
    if (this.config.enableParentChunks) {
      return this.createParentChildChunks(overlappedChunks);
    }

    return overlappedChunks;
  }

  private identifyStructures(text: string): Structure[] {
    const structures: Structure[] = [];

    // Tables (markdown)
    const tableRegex = /\|[^\n]+\|[\s\S]*?\n(?=\n[^|]|\n*$)/g;
    // Code blocks
    const codeRegex = /```[\s\S]*?```/g;
    // Lists
    const listRegex = /(?:^|\n)(?:[-*+]|\d+\.)\s+[\s\S]*?(?=\n\n|\n(?![-*+\d]))/g;
    // Headings
    const headingRegex = /^#{1,6}\s+.+$/gm;

    // Mark regions as protected
    // ...implementation
    return structures;
  }
}

export interface Chunk {
  id: string;
  text: string;
  tokenCount: number;
  chunkIndex: number;

  // Position in source
  startChar: number;
  endChar: number;
  pageNumber?: number;

  // Hierarchy
  parentChunkId?: string;
  childChunkIds?: string[];

  // Metadata
  sectionHeading?: string;
  structureType?: 'text' | 'table' | 'code' | 'list';
}
```

### 10.2 Hybrid Search Configuration

```typescript
// packages/adapters/src/vector/hybrid-search.ts

export interface HybridSearchConfig {
  // Search mode
  mode: 'vector-only' | 'keyword-only' | 'hybrid';

  // Hybrid weights (must sum to 1.0)
  vectorWeight: number;   // Semantic similarity weight (default: 0.7)
  keywordWeight: number;  // BM25/keyword weight (default: 0.3)

  // Fusion method
  fusionMethod: 'rrf' | 'linear' | 'convex';
  rrfK: number;           // RRF parameter (default: 60)

  // Keyword search configuration
  keyword: {
    analyzer: 'standard' | 'english' | 'whitespace';
    fuzziness: number;    // Edit distance for fuzzy matching
    prefixLength: number; // Minimum prefix for fuzzy
  };
}

export const DEFAULT_HYBRID_CONFIG: HybridSearchConfig = {
  mode: 'hybrid',
  vectorWeight: 0.7,
  keywordWeight: 0.3,

  fusionMethod: 'rrf',
  rrfK: 60,

  keyword: {
    analyzer: 'english',
    fuzziness: 1,
    prefixLength: 2,
  },
};

// Hybrid search implementation
export class HybridSearchService {
  async search(
    query: string,
    filter: RetrievalFilter,
    config: HybridSearchConfig = DEFAULT_HYBRID_CONFIG
  ): Promise<SearchResult[]> {
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearch(query, filter, config),
      this.keywordSearch(query, filter, config),
    ]);

    return this.fuseResults(vectorResults, keywordResults, config);
  }

  private fuseResults(
    vectorResults: SearchResult[],
    keywordResults: SearchResult[],
    config: HybridSearchConfig
  ): SearchResult[] {
    if (config.fusionMethod === 'rrf') {
      return this.reciprocalRankFusion(vectorResults, keywordResults, config.rrfK);
    }
    // Linear combination
    return this.linearFusion(vectorResults, keywordResults, config);
  }

  private reciprocalRankFusion(
    vectorResults: SearchResult[],
    keywordResults: SearchResult[],
    k: number
  ): SearchResult[] {
    const scores = new Map<string, number>();

    // Score from vector search
    vectorResults.forEach((result, rank) => {
      const score = 1 / (k + rank + 1);
      scores.set(result.id, (scores.get(result.id) || 0) + score);
    });

    // Score from keyword search
    keywordResults.forEach((result, rank) => {
      const score = 1 / (k + rank + 1);
      scores.set(result.id, (scores.get(result.id) || 0) + score);
    });

    // Sort by combined score
    const allResults = [...vectorResults, ...keywordResults];
    const uniqueResults = new Map(allResults.map(r => [r.id, r]));

    return Array.from(uniqueResults.values())
      .map(r => ({ ...r, score: scores.get(r.id) || 0 }))
      .sort((a, b) => b.score - a.score);
  }
}
```

### 10.3 Reranking Configuration

```typescript
// packages/adapters/src/rerank/interface.ts

export interface RerankAdapter {
  rerank(
    query: string,
    documents: RerankDocument[],
    options?: RerankOptions
  ): Promise<RerankResult[]>;
}

export interface RerankDocument {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface RerankResult {
  id: string;
  score: number;        // Relevance score from reranker
  originalRank: number; // Position before reranking
  newRank: number;      // Position after reranking
}

export interface RerankOptions {
  topK?: number;           // Return top K after reranking (default: 20)
  minScore?: number;       // Drop below threshold (default: 0.0)
  returnOriginalScore?: boolean;
}

// Configuration
export interface RerankConfig {
  enabled: boolean;
  provider: 'cohere' | 'cross-encoder' | 'llm-based';

  // Provider-specific
  cohere?: {
    model: 'rerank-english-v3.0' | 'rerank-multilingual-v3.0';
    apiKey: string;
  };

  crossEncoder?: {
    model: 'cross-encoder/ms-marco-MiniLM-L-6-v2' | 'BAAI/bge-reranker-base';
    maxLength: number;  // Max input length
  };

  // When to apply reranking
  applyWhen: {
    minCandidates: number;  // Only rerank if >= N candidates (default: 10)
    maxCandidates: number;  // Max candidates to rerank (default: 100)
  };

  // Performance
  batchSize: number;      // Batch size for reranking
  timeout: number;        // Timeout per batch
}

export const DEFAULT_RERANK_CONFIG: RerankConfig = {
  enabled: true,
  provider: 'cohere',

  cohere: {
    model: 'rerank-english-v3.0',
    apiKey: process.env.COHERE_API_KEY!,
  },

  applyWhen: {
    minCandidates: 10,
    maxCandidates: 100,
  },

  batchSize: 50,
  timeout: 30000,
};

// Concrete Cohere Implementation
export class CohereRerankAdapter implements RerankAdapter {
  private client: CohereClient;
  private config: RerankConfig;

  constructor(config: RerankConfig) {
    this.config = config;
    this.client = new CohereClient({
      token: config.cohere!.apiKey,
    });
  }

  async rerank(
    query: string,
    documents: RerankDocument[],
    options: RerankOptions = {}
  ): Promise<RerankResult[]> {
    const { topK = 20, minScore = 0.0 } = options;

    // Batch documents if exceeding batch size
    const batches = this.batchDocuments(documents, this.config.batchSize);
    const allResults: RerankResult[] = [];

    for (const batch of batches) {
      try {
        const response = await this.client.rerank({
          model: this.config.cohere!.model,
          query,
          documents: batch.map(d => d.text),
          topN: Math.min(topK, batch.length),
          returnDocuments: false,
        });

        // Map results back to original indices
        for (const result of response.results) {
          const originalDoc = batch[result.index];
          allResults.push({
            id: originalDoc.id,
            score: result.relevanceScore,
            originalRank: documents.findIndex(d => d.id === originalDoc.id),
            newRank: -1, // Will be set after sorting
          });
        }
      } catch (error) {
        console.error('Cohere rerank batch failed:', error);
        // On failure, return original order for this batch
        batch.forEach((doc, idx) => {
          allResults.push({
            id: doc.id,
            score: 1 - (idx / batch.length), // Decay score by position
            originalRank: documents.findIndex(d => d.id === doc.id),
            newRank: -1,
          });
        });
      }
    }

    // Sort by score and assign new ranks
    allResults.sort((a, b) => b.score - a.score);
    allResults.forEach((r, idx) => { r.newRank = idx; });

    // Filter by minScore and limit to topK
    return allResults
      .filter(r => r.score >= minScore)
      .slice(0, topK);
  }

  private batchDocuments(
    documents: RerankDocument[],
    batchSize: number
  ): RerankDocument[][] {
    const batches: RerankDocument[][] = [];
    for (let i = 0; i < documents.length; i += batchSize) {
      batches.push(documents.slice(i, i + batchSize));
    }
    return batches;
  }
}

// Cross-Encoder Fallback Implementation
export class CrossEncoderRerankAdapter implements RerankAdapter {
  private model: CrossEncoderModel;

  constructor(config: RerankConfig) {
    // Uses local model for fallback when Cohere is unavailable
    this.model = new CrossEncoderModel(
      config.crossEncoder?.model || 'cross-encoder/ms-marco-MiniLM-L-6-v2'
    );
  }

  async rerank(
    query: string,
    documents: RerankDocument[],
    options: RerankOptions = {}
  ): Promise<RerankResult[]> {
    const { topK = 20, minScore = 0.0 } = options;

    // Score all query-document pairs
    const pairs = documents.map(d => ({ query, text: d.text }));
    const scores = await this.model.predict(pairs);

    const results: RerankResult[] = documents.map((doc, idx) => ({
      id: doc.id,
      score: scores[idx],
      originalRank: idx,
      newRank: -1,
    }));

    // Sort and assign ranks
    results.sort((a, b) => b.score - a.score);
    results.forEach((r, idx) => { r.newRank = idx; });

    return results
      .filter(r => r.score >= minScore)
      .slice(0, topK);
  }
}
```

### 10.4 Full RAG Pipeline

```typescript
// apps/api/src/services/rag-pipeline.ts

export interface RAGPipelineConfig {
  // Retrieval
  retrieval: {
    initialTopK: number;        // Initial candidates (default: 100)
    hybridSearch: HybridSearchConfig;
  };

  // Reranking
  rerank: RerankConfig;

  // Context assembly
  context: {
    maxTokens: number;          // Max context tokens (default: 8000)
    maxChunks: number;          // Max chunks in context (default: 20)
    includeMetadata: boolean;   // Include chunk metadata
    citationStyle: 'inline' | 'footnote' | 'none';
  };

  // Generation
  generation: {
    model: string;
    temperature: number;
    maxOutputTokens: number;
  };
}

export class RAGPipeline {
  constructor(
    private vectorStore: VectorStoreAdapter,
    private reranker: RerankAdapter,
    private llm: LLMAdapter,
    private config: RAGPipelineConfig
  ) {}

  async generate(
    query: string,
    filter: RetrievalFilter,
    prompt: PromptTemplate
  ): Promise<GenerationResult> {
    // 1. Retrieve candidates (hybrid search)
    const candidates = await this.retrieve(query, filter);

    // 2. Rerank if enabled and enough candidates
    const reranked = await this.maybeRerank(query, candidates);

    // 3. Build context within token budget
    const context = await this.buildContext(reranked);

    // 4. Generate with LLM
    const result = await this.llm.generateStructured(
      {
        systemPrompt: prompt.system,
        userPrompt: prompt.buildUserPrompt(query, context),
        temperature: this.config.generation.temperature,
        maxTokens: this.config.generation.maxOutputTokens,
      },
      prompt.outputSchema
    );

    // 5. Add citations
    return this.addCitations(result, context);
  }

  private async buildContext(chunks: Chunk[]): Promise<ContextPack> {
    const contextChunks: ContextChunk[] = [];
    let totalTokens = 0;

    for (const chunk of chunks) {
      if (totalTokens + chunk.tokenCount > this.config.context.maxTokens) {
        break;
      }
      if (contextChunks.length >= this.config.context.maxChunks) {
        break;
      }

      contextChunks.push({
        id: chunk.id,
        text: chunk.text,
        source: chunk.sourceFile,
        page: chunk.pageNumber,
        relevanceScore: chunk.score,
      });

      totalTokens += chunk.tokenCount;
    }

    return {
      chunks: contextChunks,
      totalTokens,
      sourceDocuments: [...new Set(contextChunks.map(c => c.source))],
    };
  }
}
```

### 10.5 Event Extraction Pipeline

```typescript
// apps/worker/src/processors/eventExtract.ts

export interface EventExtractionConfig {
  // Model configuration
  model: string;
  temperature: number;

  // Extraction settings
  confidenceThreshold: number;  // Min confidence to keep (default: 0.5)
  maxEventsPerChunk: number;    // Max events per chunk (default: 10)
  deduplicateWindow: number;    // Days window for dedup (default: 7)

  // Date parsing
  dateFormats: string[];        // Supported date formats
  inferRelativeDates: boolean;  // "next quarter" -> actual date
  referenceDate: Date;          // Reference for relative dates
}

export interface ExtractedEvent {
  date: Date | null;
  dateText: string;             // Original text: "Q1 2024"
  endDate?: Date;               // For ranges
  eventType: EventType;
  title: string;
  description?: string;
  entity?: string;

  // Provenance
  sourceText: string;
  sourceChunkId: string;
  confidence: number;

  // Dependencies (extracted from text)
  dependsOnText?: string[];     // Raw dependency mentions
}

export type EventType =
  | 'milestone'
  | 'deadline'
  | 'decision'
  | 'phase_start'
  | 'phase_end'
  | 'deliverable'
  | 'review'
  | 'dependency';

export class EventExtractor {
  async extractFromChunks(
    chunks: Chunk[],
    config: EventExtractionConfig
  ): Promise<ExtractedEvent[]> {
    const allEvents: ExtractedEvent[] = [];

    for (const chunk of chunks) {
      const events = await this.extractFromChunk(chunk, config);
      allEvents.push(...events);
    }

    // Deduplicate similar events
    const deduplicated = this.deduplicateEvents(allEvents, config);

    // Resolve dependencies between events
    const withDependencies = this.resolveDependencies(deduplicated);

    return withDependencies;
  }

  private async extractFromChunk(
    chunk: Chunk,
    config: EventExtractionConfig
  ): Promise<ExtractedEvent[]> {
    const prompt = this.buildExtractionPrompt(chunk);

    const result = await this.llm.generateStructured<EventExtractionResult>(
      {
        systemPrompt: EVENT_EXTRACTION_SYSTEM_PROMPT,
        userPrompt: prompt,
        temperature: config.temperature,
      },
      EVENT_EXTRACTION_SCHEMA
    );

    return result.events
      .filter(e => e.confidence >= config.confidenceThreshold)
      .slice(0, config.maxEventsPerChunk)
      .map(e => ({
        ...e,
        sourceChunkId: chunk.id,
        sourceText: this.extractSourceSpan(chunk.text, e),
      }));
  }
}
```

---

## 11. Frontend Authentication Flow

### 11.1 Azure Static Web Apps Authentication

```json
// apps/web/staticwebapp.config.json

{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"],
      "rewrite": "https://force-api.azurecontainerapps.io/api/*"
    },
    {
      "route": "/*",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/.auth/*",
      "allowedRoles": ["anonymous"]
    }
  ],
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/{TENANT_ID}/v2.0",
          "clientIdSettingName": "AAD_CLIENT_ID",
          "clientSecretSettingName": "AAD_CLIENT_SECRET"
        },
        "userDetailsClaim": "http://schemas.microsoft.com/identity/claims/objectidentifier",
        "login": {
          "loginParameters": ["scope=openid profile email"]
        }
      }
    }
  },
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/aad",
      "statusCode": 302
    },
    "403": {
      "rewrite": "/unauthorized.html",
      "statusCode": 403
    }
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data: https:; connect-src 'self' https://force-api.azurecontainerapps.io"
  }
}
```

### 11.2 Frontend Auth Integration

```javascript
// apps/web/utils/auth.js

/**
 * Authentication utilities for frontend
 * Handles token management, user info, and auth state
 */

export class AuthService {
  constructor() {
    this.userInfo = null;
    this.tokenRefreshInterval = null;
  }

  /**
   * Initialize auth - call on app startup
   */
  async init() {
    await this.loadUserInfo();
    this.startTokenRefresh();
  }

  /**
   * Load current user info from Static Web Apps auth
   */
  async loadUserInfo() {
    try {
      const response = await fetch('/.auth/me');
      const data = await response.json();

      if (data.clientPrincipal) {
        this.userInfo = {
          id: data.clientPrincipal.userId,
          name: data.clientPrincipal.userDetails,
          email: data.clientPrincipal.userDetails,
          roles: data.clientPrincipal.userRoles || [],
          claims: data.clientPrincipal.claims || [],
          identityProvider: data.clientPrincipal.identityProvider,
        };
        return this.userInfo;
      }
      return null;
    } catch (error) {
      console.error('Failed to load user info:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.userInfo !== null;
  }

  /**
   * Get current user
   */
  getUser() {
    return this.userInfo;
  }

  /**
   * Redirect to login
   */
  login(returnUrl = window.location.pathname) {
    const encodedReturn = encodeURIComponent(returnUrl);
    window.location.href = `/.auth/login/aad?post_login_redirect_uri=${encodedReturn}`;
  }

  /**
   * Logout user
   */
  async logout() {
    this.stopTokenRefresh();
    this.userInfo = null;
    window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
  }

  /**
   * Start periodic token refresh check
   */
  startTokenRefresh() {
    // Check token validity every 5 minutes
    this.tokenRefreshInterval = setInterval(async () => {
      const user = await this.loadUserInfo();
      if (!user) {
        // Token expired, redirect to login
        this.login();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Stop token refresh
   */
  stopTokenRefresh() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
  }

  /**
   * Check if user has required role
   */
  hasRole(role) {
    return this.userInfo?.roles?.includes(role) || false;
  }

  /**
   * Check if user has any of the required roles
   */
  hasAnyRole(roles) {
    return roles.some(role => this.hasRole(role));
  }
}

// Singleton instance
export const auth = new AuthService();

/**
 * Fetch wrapper that handles auth errors
 */
export async function authFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',  // Include cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle auth errors
  if (response.status === 401) {
    auth.login();
    throw new Error('Authentication required');
  }

  if (response.status === 403) {
    throw new Error('Access denied');
  }

  return response;
}
```

### 11.3 API Token Validation (Backend)

```typescript
// apps/api/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

interface AuthConfig {
  tenantId: string;
  clientId: string;
  audience: string;
}

const config: AuthConfig = {
  tenantId: process.env.AZURE_AD_TENANT_ID!,
  clientId: process.env.AZURE_AD_CLIENT_ID!,
  audience: process.env.AZURE_AD_AUDIENCE || `api://${process.env.AZURE_AD_CLIENT_ID}`,
};

// JWKS client for key retrieval
const jwks = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;           // Object ID from Entra
    email: string;
    name: string;
    tenantId: string;     // App tenant (from DB, not Azure tenant)
    roles: string[];
  };
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract token from header or Static Web Apps header
  const authHeader = req.headers.authorization;
  const swaHeader = req.headers['x-ms-client-principal'];

  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (swaHeader) {
    // Static Web Apps passes user info in header
    const decoded = Buffer.from(swaHeader as string, 'base64').toString('utf8');
    const principal = JSON.parse(decoded);

    // Validate and attach user
    (req as AuthenticatedRequest).user = await getUserFromPrincipal(principal);
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  // Verify JWT
  jwt.verify(
    token,
    getSigningKey,
    {
      audience: config.audience,
      issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
      algorithms: ['RS256'],
    },
    async (err, decoded) => {
      if (err) {
        console.error('Token verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid token' });
      }

      const payload = decoded as jwt.JwtPayload;

      // Get or create user in our DB
      const user = await getOrCreateUser({
        entraOid: payload.oid!,
        email: payload.email || payload.preferred_username!,
        name: payload.name,
      });

      (req as AuthenticatedRequest).user = user;
      next();
    }
  );
}

async function getUserFromPrincipal(principal: any) {
  return getOrCreateUser({
    entraOid: principal.userId,
    email: principal.userDetails,
    name: principal.userDetails,
  });
}

async function getOrCreateUser(data: {
  entraOid: string;
  email: string;
  name?: string;
}) {
  // Look up user by Entra OID
  let user = await db.users.findByEntraOid(data.entraOid);

  if (!user) {
    // Auto-provision user on first login
    // Tenant assignment logic would go here
    user = await db.users.create({
      entraOid: data.entraOid,
      email: data.email,
      displayName: data.name,
      // Default tenant assignment (customize as needed)
      tenantId: await getDefaultTenantForEmail(data.email),
      role: 'member',
    });
  }

  // Update last login
  await db.users.updateLastLogin(user.id);

  return {
    id: user.entraOid,
    email: user.email,
    name: user.displayName,
    tenantId: user.tenantId,
    roles: [user.role],
  };
}
```

---

## 12. Operational Resilience

### 12.1 Circuit Breaker Pattern

```typescript
// packages/shared/src/resilience/circuit-breaker.ts

export interface CircuitBreakerConfig {
  failureThreshold: number;     // Failures before opening (default: 5)
  successThreshold: number;     // Successes to close (default: 3)
  timeout: number;              // Time in open state before half-open (ms)
  volumeThreshold: number;      // Min requests before calculating failure rate
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailure: number = 0;
  private requestCount = 0;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.config.timeout) {
        this.state = 'half-open';
        this.successes = 0;
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.requestCount++;
    this.failures = 0;

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'closed';
        console.log(`Circuit ${this.name} closed`);
      }
    }
  }

  private onFailure() {
    this.requestCount++;
    this.failures++;
    this.lastFailure = Date.now();

    if (this.requestCount >= this.config.volumeThreshold &&
        this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      console.log(`Circuit ${this.name} opened`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// Service-specific circuit breakers
export const circuitBreakers = {
  embedding: new CircuitBreaker('embedding', {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    volumeThreshold: 10,
  }),
  llm: new CircuitBreaker('llm', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000,
    volumeThreshold: 5,
  }),
  vectorDb: new CircuitBreaker('vectorDb', {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 15000,
    volumeThreshold: 10,
  }),
};
```

### 12.2 Idempotency Pattern

```typescript
// packages/shared/src/resilience/idempotency.ts

import { createHash } from 'crypto';

export interface IdempotencyConfig {
  keyPrefix: string;
  ttlSeconds: number;       // How long to remember completed operations
  lockTimeoutMs: number;    // Lock timeout for in-progress operations
}

export class IdempotencyService {
  constructor(
    private redis: RedisClient,
    private config: IdempotencyConfig
  ) {}

  /**
   * Generate idempotency key from operation parameters
   */
  generateKey(operation: string, params: Record<string, unknown>): string {
    const hash = createHash('sha256')
      .update(JSON.stringify({ operation, params }))
      .digest('hex');
    return `${this.config.keyPrefix}:${operation}:${hash}`;
  }

  /**
   * Execute operation with idempotency guarantee
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; cached: boolean }> {
    // Check if operation already completed
    const cached = await this.redis.get(key);
    if (cached) {
      return { result: JSON.parse(cached), cached: true };
    }

    // Try to acquire lock
    const lockKey = `${key}:lock`;
    const acquired = await this.redis.set(lockKey, '1', {
      NX: true,
      PX: this.config.lockTimeoutMs,
    });

    if (!acquired) {
      // Another process is executing, wait and retry
      await this.waitForCompletion(key);
      const result = await this.redis.get(key);
      if (result) {
        return { result: JSON.parse(result), cached: true };
      }
      throw new Error('Operation failed in another process');
    }

    try {
      // Execute operation
      const result = await operation();

      // Store result
      await this.redis.set(key, JSON.stringify(result), {
        EX: this.config.ttlSeconds,
      });

      return { result, cached: false };
    } finally {
      // Release lock
      await this.redis.del(lockKey);
    }
  }

  private async waitForCompletion(key: string, maxWaitMs = 30000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const result = await this.redis.get(key);
      if (result) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Usage in job processor
export async function processDocumentIngest(
  job: DocumentIngestJob,
  idempotency: IdempotencyService
): Promise<void> {
  const key = idempotency.generateKey('document_ingest', {
    documentId: job.documentId,
    fileHash: job.fileHash,
  });

  const { cached } = await idempotency.execute(key, async () => {
    // Actual processing logic
    await extractText(job);
    await chunkDocument(job);
    await embedChunks(job);
    await indexVectors(job);
    return { success: true };
  });

  if (cached) {
    console.log(`Skipped duplicate job: ${job.documentId}`);
  }
}
```

### 12.3 Cache Invalidation Strategy

```typescript
// packages/shared/src/cache/invalidation.ts

export interface CacheInvalidationConfig {
  // Event-driven invalidation patterns
  patterns: {
    onDocumentUpdate: string[];
    onDocumentDelete: string[];
    onChunkUpdate: string[];
    onKbReindex: string[];
    onEngagementArchive: string[];
  };

  // Invalidation channels
  channel: string;
}

export const DEFAULT_INVALIDATION_CONFIG: CacheInvalidationConfig = {
  patterns: {
    onDocumentUpdate: [
      'context:{engagementId}:*',
      'retrieval:{documentId}:*',
      'chunks:{documentId}:*',
    ],
    onDocumentDelete: [
      'context:{engagementId}:*',
      'retrieval:{documentId}:*',
      'chunks:{documentId}:*',
      'document:{documentId}',
    ],
    onChunkUpdate: [
      'context:{engagementId}:*',
      'retrieval:{documentId}:*',
      'chunk:{chunkId}',
    ],
    onKbReindex: [
      'context:{engagementId}:*',
      'retrieval:kb:{kbId}:*',
    ],
    onEngagementArchive: [
      'context:{engagementId}:*',
      'retrieval:engagement:{engagementId}:*',
      'content:{engagementId}:*',
    ],
  },
  channel: 'cache-invalidation',
};

export class CacheInvalidator {
  constructor(
    private redis: RedisClient,
    private pubsub: RedisPubSub,
    private config: CacheInvalidationConfig
  ) {
    this.subscribeToInvalidations();
  }

  /**
   * Invalidate cache for document update
   */
  async onDocumentUpdate(documentId: string, engagementId: string): Promise<void> {
    await this.invalidatePatterns(
      this.config.patterns.onDocumentUpdate,
      { documentId, engagementId }
    );
  }

  /**
   * Invalidate cache for document delete
   */
  async onDocumentDelete(documentId: string, engagementId: string): Promise<void> {
    await this.invalidatePatterns(
      this.config.patterns.onDocumentDelete,
      { documentId, engagementId }
    );
  }

  /**
   * Invalidate patterns with variable substitution
   */
  private async invalidatePatterns(
    patterns: string[],
    vars: Record<string, string>
  ): Promise<void> {
    for (const pattern of patterns) {
      const resolvedPattern = this.resolvePattern(pattern, vars);
      const keys = await this.redis.keys(resolvedPattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`Invalidated ${keys.length} keys matching ${resolvedPattern}`);
      }
    }

    // Publish invalidation event for distributed cache
    await this.pubsub.publish(this.config.channel, {
      patterns,
      vars,
      timestamp: Date.now(),
    });
  }

  private resolvePattern(pattern: string, vars: Record<string, string>): string {
    return pattern.replace(/{(\w+)}/g, (_, key) => vars[key] || '*');
  }

  /**
   * Subscribe to invalidation events from other nodes
   */
  private subscribeToInvalidations(): void {
    this.pubsub.subscribe(this.config.channel, async (message) => {
      // Only process if from another node
      if (message.nodeId !== this.nodeId) {
        for (const pattern of message.patterns) {
          const resolved = this.resolvePattern(pattern, message.vars);
          const keys = await this.redis.keys(resolved);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        }
      }
    });
  }
}
```

### 12.4 Real-Time Job Progress (WebSocket)

```typescript
// apps/api/src/routes/realtime.ts

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface JobProgressMessage {
  type: 'job_progress';
  jobId: string;
  status: string;
  progress: number;
  message: string;
  updatedAt: string;
}

interface DocumentStatusMessage {
  type: 'document_status';
  documentId: string;
  status: string;
  stage: string;
  progress: number;
}

export class RealtimeService {
  private wss: WebSocketServer;
  private jobSubscriptions = new Map<string, Set<WebSocket>>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupHandlers();
    this.subscribeToJobUpdates();
  }

  private setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      // Authenticate WebSocket connection
      const token = new URL(req.url!, 'http://localhost').searchParams.get('token');
      if (!this.validateToken(token)) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        this.removeFromAllSubscriptions(ws);
      });
    });
  }

  private handleMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case 'subscribe_job':
        this.subscribeToJob(ws, message.jobId);
        break;
      case 'unsubscribe_job':
        this.unsubscribeFromJob(ws, message.jobId);
        break;
    }
  }

  private subscribeToJob(ws: WebSocket, jobId: string) {
    if (!this.jobSubscriptions.has(jobId)) {
      this.jobSubscriptions.set(jobId, new Set());
    }
    this.jobSubscriptions.get(jobId)!.add(ws);
  }

  /**
   * Broadcast job progress to subscribed clients
   */
  broadcastJobProgress(jobId: string, update: Partial<JobProgressMessage>) {
    const subscribers = this.jobSubscriptions.get(jobId);
    if (!subscribers) return;

    const message: JobProgressMessage = {
      type: 'job_progress',
      jobId,
      status: update.status || 'processing',
      progress: update.progress || 0,
      message: update.message || '',
      updatedAt: new Date().toISOString(),
    };

    const payload = JSON.stringify(message);
    subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  /**
   * Subscribe to Redis pub/sub for job updates
   */
  private subscribeToJobUpdates() {
    this.redis.subscribe('job-progress', (message) => {
      const { jobId, ...update } = JSON.parse(message);
      this.broadcastJobProgress(jobId, update);
    });
  }
}

// Frontend WebSocket client
export class JobProgressClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private baseUrl: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${this.baseUrl}/ws`);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onclose = () => {
        this.attemptReconnect();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };
    });
  }

  subscribeToJob(jobId: string, callback: (update: JobProgressMessage) => void) {
    this.callbacks.set(jobId, callback);
    this.ws?.send(JSON.stringify({ type: 'subscribe_job', jobId }));
  }
}
```

### 12.5 Distributed Tracing

```typescript
// packages/shared/src/observability/tracing.ts

import { trace, context, SpanKind, Span } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';

export interface TracingConfig {
  serviceName: string;
  environment: string;
  sampleRate: number;
  exporter: 'azure-monitor' | 'jaeger' | 'console';
}

export function initTracing(config: TracingConfig) {
  const provider = new NodeTracerProvider({
    resource: {
      attributes: {
        'service.name': config.serviceName,
        'deployment.environment': config.environment,
      },
    },
  });

  // Configure exporter
  let exporter;
  switch (config.exporter) {
    case 'azure-monitor':
      exporter = new AzureMonitorTraceExporter({
        connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
      });
      break;
    // ... other exporters
  }

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register();

  return trace.getTracer(config.serviceName);
}

// Tracing decorators for key operations
export function traced(spanName: string, kind: SpanKind = SpanKind.INTERNAL) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('force');
      return tracer.startActiveSpan(spanName, { kind }, async (span: Span) => {
        try {
          const result = await originalMethod.apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.recordException(error);
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}

// Usage example
class RetrievalService {
  @traced('retrieval.vector_search', SpanKind.CLIENT)
  async vectorSearch(query: string, filter: RetrievalFilter) {
    // Implementation
  }

  @traced('retrieval.rerank', SpanKind.INTERNAL)
  async rerank(query: string, candidates: Chunk[]) {
    // Implementation
  }
}
```

---

## 13. Cost Management & Usage Tracking

### 13.1 Cost Calculation Service

```typescript
// packages/shared/src/billing/cost-calculator.ts

export interface CostRates {
  embedding: {
    'text-embedding-ada-002': number;      // $ per 1K tokens
    'text-embedding-3-small': number;
    'text-embedding-3-large': number;
  };
  generation: {
    'gemini-2.5-flash': { input: number; output: number };
    'gpt-4o': { input: number; output: number };
    'gpt-4o-mini': { input: number; output: number };
    'claude-3-sonnet': { input: number; output: number };
  };
  rerank: {
    'cohere-rerank-v3': number;  // $ per 1K searches
  };
}

export const COST_RATES: CostRates = {
  embedding: {
    'text-embedding-ada-002': 0.0001,    // $0.0001 per 1K tokens
    'text-embedding-3-small': 0.00002,
    'text-embedding-3-large': 0.00013,
  },
  generation: {
    'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
  },
  rerank: {
    'cohere-rerank-v3': 0.002,
  },
};

export class CostCalculator {
  calculateEmbeddingCost(model: string, tokens: number): number {
    const rate = COST_RATES.embedding[model];
    if (!rate) throw new Error(`Unknown embedding model: ${model}`);
    return (tokens / 1000) * rate;
  }

  calculateGenerationCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const rates = COST_RATES.generation[model];
    if (!rates) throw new Error(`Unknown generation model: ${model}`);
    return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
  }
}
```

### 13.2 Usage Tracking Service

```typescript
// packages/shared/src/billing/usage-tracker.ts

export class UsageTracker {
  constructor(
    private db: Database,
    private redis: RedisClient,
    private costCalculator: CostCalculator
  ) {}

  /**
   * Log usage and check limits
   */
  async trackUsage(params: {
    tenantId: string;
    userId?: string;
    engagementId?: string;
    operationType: 'embedding' | 'generation' | 'retrieval';
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens?: number;
    latencyMs: number;
    success: boolean;
    jobId?: string;
    requestId?: string;
  }): Promise<{ allowed: boolean; reason?: string }> {
    // Calculate cost
    let costUsd = 0;
    if (params.operationType === 'embedding') {
      costUsd = this.costCalculator.calculateEmbeddingCost(
        params.model,
        params.inputTokens
      );
    } else if (params.operationType === 'generation') {
      costUsd = this.costCalculator.calculateGenerationCost(
        params.model,
        params.inputTokens,
        params.outputTokens || 0
      );
    }

    // Check limits before logging
    const limits = await this.getTenantLimits(params.tenantId);
    const currentUsage = await this.getCurrentUsage(params.tenantId);

    // Check monthly token limits
    if (params.operationType === 'embedding') {
      if (currentUsage.embeddingTokens + params.inputTokens > limits.monthlyEmbeddingTokens) {
        return { allowed: false, reason: 'Monthly embedding token limit exceeded' };
      }
    } else if (params.operationType === 'generation') {
      const totalTokens = params.inputTokens + (params.outputTokens || 0);
      if (currentUsage.generationTokens + totalTokens > limits.monthlyGenerationTokens) {
        return { allowed: false, reason: 'Monthly generation token limit exceeded' };
      }
    }

    // Check cost limit
    if (currentUsage.costUsd + costUsd > limits.monthlyCostLimitUsd) {
      return { allowed: false, reason: 'Monthly cost limit exceeded' };
    }

    // Log usage
    await this.db.usageLogs.create({
      tenantId: params.tenantId,
      userId: params.userId,
      engagementId: params.engagementId,
      operationType: params.operationType,
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens || 0,
      totalTokens: params.inputTokens + (params.outputTokens || 0),
      costUsd,
      latencyMs: params.latencyMs,
      success: params.success,
      jobId: params.jobId,
      requestId: params.requestId,
    });

    // Update current period counters
    await this.incrementUsage(params.tenantId, {
      embeddingTokens: params.operationType === 'embedding' ? params.inputTokens : 0,
      generationTokens: params.operationType === 'generation'
        ? params.inputTokens + (params.outputTokens || 0)
        : 0,
      costUsd,
    });

    // Check alert thresholds
    await this.checkAlerts(params.tenantId, limits, currentUsage);

    return { allowed: true };
  }

  /**
   * Get current usage for tenant (cached in Redis)
   */
  private async getCurrentUsage(tenantId: string): Promise<TenantUsage> {
    const cacheKey = `usage:${tenantId}:current`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Calculate from DB
    const limits = await this.db.tenantUsageLimits.findByTenantId(tenantId);
    const usage = await this.db.usageLogs.sumForPeriod(
      tenantId,
      limits.currentPeriodStart,
      new Date()
    );

    // Cache for 1 minute
    await this.redis.set(cacheKey, JSON.stringify(usage), { EX: 60 });

    return usage;
  }

  /**
   * Check and send alerts if thresholds exceeded
   */
  private async checkAlerts(
    tenantId: string,
    limits: TenantUsageLimits,
    usage: TenantUsage
  ): Promise<void> {
    const threshold = limits.alertThresholdPercent / 100;

    const costPercent = usage.costUsd / limits.monthlyCostLimitUsd;
    const embeddingPercent = usage.embeddingTokens / limits.monthlyEmbeddingTokens;
    const generationPercent = usage.generationTokens / limits.monthlyGenerationTokens;

    if (costPercent >= threshold || embeddingPercent >= threshold || generationPercent >= threshold) {
      // Don't send more than one alert per day
      const lastAlert = limits.lastAlertSent;
      if (lastAlert && Date.now() - lastAlert.getTime() < 24 * 60 * 60 * 1000) {
        return;
      }

      // Send alert
      await this.sendUsageAlert(tenantId, {
        costPercent,
        embeddingPercent,
        generationPercent,
        limits,
      });

      await this.db.tenantUsageLimits.updateLastAlert(tenantId);
    }
  }
}
```

### 13.3 Usage Dashboard API

```typescript
// apps/api/src/routes/usage.ts

router.get('/api/v1/usage/summary', auth, async (req, res) => {
  const { tenantId } = req.user;
  const { period = 'month' } = req.query;

  const summary = await usageService.getSummary(tenantId, period);

  res.json({
    period,
    usage: {
      embedding: {
        tokens: summary.embeddingTokens,
        cost: summary.embeddingCost,
        limit: summary.limits.monthlyEmbeddingTokens,
        percentUsed: (summary.embeddingTokens / summary.limits.monthlyEmbeddingTokens) * 100,
      },
      generation: {
        tokens: summary.generationTokens,
        cost: summary.generationCost,
        limit: summary.limits.monthlyGenerationTokens,
        percentUsed: (summary.generationTokens / summary.limits.monthlyGenerationTokens) * 100,
      },
      total: {
        cost: summary.totalCost,
        limit: summary.limits.monthlyCostLimitUsd,
        percentUsed: (summary.totalCost / summary.limits.monthlyCostLimitUsd) * 100,
      },
    },
    breakdown: {
      byModel: summary.byModel,
      byEngagement: summary.byEngagement,
      byDay: summary.dailyBreakdown,
    },
  });
});
```

---

## 14. Testing & Performance Targets

### 14.1 Performance Requirements

```typescript
// packages/shared/src/config/performance.ts

export interface PerformanceTargets {
  // Retrieval latency
  retrieval: {
    p50: number;  // 200ms
    p95: number;  // 500ms
    p99: number;  // 1000ms
  };

  // Generation latency (end-to-end RAG)
  generation: {
    p50: number;  // 5000ms (5 seconds)
    p95: number;  // 15000ms (15 seconds)
    p99: number;  // 30000ms (30 seconds)
  };

  // Document ingestion
  ingestion: {
    documentsPerMinute: number;  // 10
    pagesPerMinute: number;      // 100
    chunksPerSecond: number;     // 50
    embeddingsPerSecond: number; // 100
  };

  // API throughput
  api: {
    requestsPerSecond: number;   // 100
    concurrentUsers: number;     // 50
  };

  // Availability
  availability: {
    uptime: number;              // 99.9%
    rto: number;                 // 15 minutes (Recovery Time Objective)
    rpo: number;                 // 1 hour (Recovery Point Objective)
  };
}

export const PERFORMANCE_TARGETS: PerformanceTargets = {
  retrieval: { p50: 200, p95: 500, p99: 1000 },
  generation: { p50: 5000, p95: 15000, p99: 30000 },
  ingestion: {
    documentsPerMinute: 10,
    pagesPerMinute: 100,
    chunksPerSecond: 50,
    embeddingsPerSecond: 100,
  },
  api: { requestsPerSecond: 100, concurrentUsers: 50 },
  availability: { uptime: 99.9, rto: 15, rpo: 60 },
};
```

### 14.2 Contract Testing

```typescript
// tests/contracts/api-schemas.test.ts

import Ajv from 'ajv';
import { GanttChartSchema, SlidesSchema, DocumentSchema } from '@force/shared/schemas';

const ajv = new Ajv({ allErrors: true });

describe('API Contract Tests', () => {
  describe('GanttChart Schema', () => {
    const validate = ajv.compile(GanttChartSchema);

    it('should validate correct roadmap response', () => {
      const validResponse = {
        title: 'Project Roadmap',
        timeColumns: ['Q1 2024', 'Q2 2024', 'Q3 2024'],
        data: [
          { title: 'Workstream A', isSwimlane: true, entity: 'Team A', bar: null },
          {
            title: 'Task 1',
            isSwimlane: false,
            entity: 'Team A',
            bar: { startCol: 0, endCol: 1, color: '#4A90D9' },
            taskType: 'task',
          },
        ],
        legend: [{ color: '#4A90D9', label: 'Development' }],
      };

      expect(validate(validResponse)).toBe(true);
    });

    it('should reject invalid response', () => {
      const invalidResponse = {
        title: 'Project Roadmap',
        // Missing required fields
      };

      expect(validate(invalidResponse)).toBe(false);
    });
  });

  describe('Slides Schema', () => {
    // Similar tests for slides
  });

  describe('Document Schema', () => {
    // Similar tests for document
  });
});
```

### 14.3 Load Testing Configuration

```yaml
# tests/load/k6-config.yml

scenarios:
  # Baseline: Normal load
  baseline:
    executor: 'constant-arrival-rate'
    rate: 10
    timeUnit: '1s'
    duration: '5m'
    preAllocatedVUs: 50

  # Stress: Peak load
  stress:
    executor: 'ramping-arrival-rate'
    startRate: 10
    timeUnit: '1s'
    stages:
      - duration: '2m', target: 50
      - duration: '5m', target: 50
      - duration: '2m', target: 100
      - duration: '5m', target: 100
      - duration: '2m', target: 10
    preAllocatedVUs: 200

  # Soak: Sustained load
  soak:
    executor: 'constant-arrival-rate'
    rate: 20
    timeUnit: '1s'
    duration: '30m'
    preAllocatedVUs: 100

thresholds:
  http_req_duration:
    - 'p(50)<200'    # 50% of requests under 200ms
    - 'p(95)<1000'   # 95% of requests under 1s
    - 'p(99)<3000'   # 99% of requests under 3s
  http_req_failed:
    - 'rate<0.01'    # Less than 1% failure rate
  http_reqs:
    - 'rate>50'      # At least 50 requests per second
```

```javascript
// tests/load/scenarios/retrieval.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const retrievalLatency = new Trend('retrieval_latency');
const retrievalErrors = new Rate('retrieval_errors');

export default function () {
  const payload = JSON.stringify({
    query: 'What are the key milestones for Phase 1?',
    filter: {
      tenant_id: __ENV.TENANT_ID,
      engagement_id: __ENV.ENGAGEMENT_ID,
      kb_types: ['client', 'firm'],
    },
    options: {
      limit: 20,
      withRerank: true,
    },
  });

  const response = http.post(
    `${__ENV.API_URL}/api/v1/retrieval/search`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${__ENV.AUTH_TOKEN}`,
      },
    }
  );

  retrievalLatency.add(response.timings.duration);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has results': (r) => JSON.parse(r.body).results?.length > 0,
    'latency under 500ms': (r) => r.timings.duration < 500,
  });

  if (!success) {
    retrievalErrors.add(1);
  }

  sleep(1);
}
```

### 14.4 Integration Test Suite

```typescript
// tests/integration/rag-pipeline.test.ts

describe('RAG Pipeline Integration', () => {
  let testEngagement: Engagement;
  let testDocuments: Document[];

  beforeAll(async () => {
    // Setup test data
    testEngagement = await createTestEngagement();
    testDocuments = await uploadTestDocuments(testEngagement.id, [
      'tests/fixtures/sample-research.md',
      'tests/fixtures/sample-timeline.pdf',
    ]);

    // Wait for ingestion to complete
    await waitForDocumentsIndexed(testDocuments);
  });

  afterAll(async () => {
    await cleanupTestData(testEngagement.id);
  });

  describe('Retrieval', () => {
    it('should retrieve relevant chunks for timeline query', async () => {
      const results = await retrievalService.search(
        'What are the key dates and milestones?',
        {
          tenant_id: testEngagement.tenantId,
          engagement_id: testEngagement.id,
          kb_types: ['client'],
        }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0.7);
    });

    it('should respect tenant isolation', async () => {
      const results = await retrievalService.search(
        'What are the key dates?',
        {
          tenant_id: 'other-tenant-id',
          engagement_id: testEngagement.id,
          kb_types: ['client'],
        }
      );

      expect(results.length).toBe(0);
    });
  });

  describe('Generation', () => {
    it('should generate roadmap from research', async () => {
      const result = await generationService.generateRoadmap(
        testEngagement.id,
        'Create a roadmap for the digital transformation initiative'
      );

      expect(result.title).toBeDefined();
      expect(result.timeColumns.length).toBeGreaterThan(0);
      expect(result.data.length).toBeGreaterThan(0);

      // Validate schema
      const valid = validateGanttChart(result);
      expect(valid).toBe(true);
    });

    it('should include citations in generated content', async () => {
      const result = await generationService.generateDocument(
        testEngagement.id,
        'Summarize the key findings'
      );

      // Check that sources are cited
      expect(result.sourceDocuments.length).toBeGreaterThan(0);
    });
  });
});
```

---

## 15. Admin & Management APIs

### 15.1 Tenant Management

```typescript
// apps/api/src/routes/admin/tenants.ts

import { Router } from 'express';
import { adminAuthMiddleware } from '../../middleware/admin-auth';

const router = Router();

// All admin routes require admin role
router.use(adminAuthMiddleware);

/**
 * Create a new tenant (organization)
 */
router.post('/api/v1/admin/tenants', async (req, res) => {
  const { name, slug, settings, adminEmail } = req.body;

  // Validate unique slug
  const existing = await db.tenants.findBySlug(slug);
  if (existing) {
    return res.status(409).json({ error: 'Tenant slug already exists' });
  }

  // Create tenant
  const tenant = await db.tenants.create({
    name,
    slug,
    settings: settings || {},
  });

  // Create default usage limits
  await db.tenantUsageLimits.create({
    tenantId: tenant.id,
    monthlyEmbeddingTokens: 10000000,
    monthlyGenerationTokens: 5000000,
    monthlyCostLimitUsd: 500.00,
  });

  // Create default firm knowledge base
  await db.knowledgeBases.create({
    tenantId: tenant.id,
    kbType: 'firm',
    name: 'Firm Knowledge Base',
    qdrantCollection: `kb_${slug}_firm`,
  });

  // Provision admin user if email provided
  if (adminEmail) {
    await db.users.create({
      tenantId: tenant.id,
      email: adminEmail,
      role: 'admin',
      entraOid: null, // Will be linked on first login
    });
  }

  // Create Qdrant collection
  await qdrantService.createCollection(`kb_${slug}_firm`);

  // Audit log
  await auditLog.record({
    tenantId: tenant.id,
    action: 'tenant.created',
    resourceType: 'tenant',
    resourceId: tenant.id,
    newValues: { name, slug },
  });

  res.status(201).json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    createdAt: tenant.createdAt,
  });
});

/**
 * Get tenant details
 */
router.get('/api/v1/admin/tenants/:id', async (req, res) => {
  const tenant = await db.tenants.findById(req.params.id);
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  const usage = await usageService.getSummary(tenant.id, 'month');
  const limits = await db.tenantUsageLimits.findByTenantId(tenant.id);

  res.json({
    ...tenant,
    usage,
    limits,
  });
});

/**
 * Update tenant settings
 */
router.put('/api/v1/admin/tenants/:id', async (req, res) => {
  const { name, settings } = req.body;

  const tenant = await db.tenants.update(req.params.id, {
    name,
    settings,
  });

  res.json(tenant);
});

/**
 * Deactivate tenant (soft delete)
 */
router.delete('/api/v1/admin/tenants/:id', async (req, res) => {
  await db.tenants.softDelete(req.params.id);

  // Archive all Qdrant collections
  const kbs = await db.knowledgeBases.findByTenantId(req.params.id);
  for (const kb of kbs) {
    await qdrantService.archiveCollection(kb.qdrantCollection);
  }

  res.status(204).send();
});

export default router;
```

### 15.2 Knowledge Base Management

```typescript
// apps/api/src/routes/knowledge-bases.ts

import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

/**
 * List knowledge bases for tenant
 */
router.get('/api/v1/knowledge-bases', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;
  const { engagementId, kbType } = req.query;

  const kbs = await db.knowledgeBases.findByTenant(tenantId, {
    engagementId: engagementId as string,
    kbType: kbType as 'client' | 'firm' | 'oss',
  });

  // Include document counts
  const withCounts = await Promise.all(
    kbs.map(async (kb) => ({
      ...kb,
      documentCount: await db.documents.countByKb(kb.id),
      chunkCount: await db.documentChunks.countByKb(kb.id),
    }))
  );

  res.json({ knowledgeBases: withCounts });
});

/**
 * Create a new knowledge base
 */
router.post('/api/v1/knowledge-bases', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;
  const { name, kbType, engagementId, description } = req.body;

  // Validate engagement exists and belongs to tenant
  if (kbType === 'client') {
    if (!engagementId) {
      return res.status(400).json({ error: 'engagementId required for client KB' });
    }
    const engagement = await db.engagements.findById(engagementId);
    if (!engagement || engagement.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Engagement not found' });
    }
  }

  // Generate collection name
  const tenant = await db.tenants.findById(tenantId);
  const collectionSuffix = kbType === 'client'
    ? `eng_${engagementId.slice(0, 8)}`
    : kbType;
  const qdrantCollection = `kb_${tenant.slug}_${collectionSuffix}`;

  // Create KB record
  const kb = await db.knowledgeBases.create({
    tenantId,
    engagementId: kbType === 'client' ? engagementId : null,
    kbType,
    name,
    description,
    qdrantCollection,
  });

  // Create Qdrant collection
  await qdrantService.createCollection(qdrantCollection);

  res.status(201).json(kb);
});

/**
 * Get knowledge base details
 */
router.get('/api/v1/knowledge-bases/:id', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;

  const kb = await db.knowledgeBases.findById(req.params.id);
  if (!kb || kb.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Knowledge base not found' });
  }

  // Include stats
  const stats = {
    documentCount: await db.documents.countByKb(kb.id),
    chunkCount: await db.documentChunks.countByKb(kb.id),
    vectorCount: await qdrantService.getPointCount(kb.qdrantCollection),
    lastUpdated: await db.documents.getLastUpdatedAt(kb.id),
  };

  res.json({ ...kb, stats });
});

/**
 * Update knowledge base
 */
router.put('/api/v1/knowledge-bases/:id', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;
  const { name, description, settings } = req.body;

  const kb = await db.knowledgeBases.findById(req.params.id);
  if (!kb || kb.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Knowledge base not found' });
  }

  const updated = await db.knowledgeBases.update(req.params.id, {
    name,
    description,
    settings,
  });

  res.json(updated);
});

/**
 * Delete knowledge base
 */
router.delete('/api/v1/knowledge-bases/:id', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;

  const kb = await db.knowledgeBases.findById(req.params.id);
  if (!kb || kb.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Knowledge base not found' });
  }

  // Prevent deletion of default firm KB
  if (kb.kbType === 'firm' && kb.name === 'Firm Knowledge Base') {
    return res.status(400).json({ error: 'Cannot delete default firm knowledge base' });
  }

  // Delete Qdrant collection
  await qdrantService.deleteCollection(kb.qdrantCollection);

  // Cascade delete documents and chunks (handled by DB)
  await db.knowledgeBases.delete(req.params.id);

  res.status(204).send();
});

/**
 * Trigger reindex of knowledge base
 */
router.post('/api/v1/knowledge-bases/:id/reindex', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;
  const { force = false } = req.body;

  const kb = await db.knowledgeBases.findById(req.params.id);
  if (!kb || kb.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Knowledge base not found' });
  }

  // Create reindex job
  const job = await jobService.create({
    tenantId,
    jobType: 'kb_reindex',
    inputPayload: {
      knowledgeBaseId: kb.id,
      force,
    },
    priority: 0,
    createdBy: req.user.id,
  });

  res.status(202).json({ jobId: job.id, status: 'queued' });
});

export default router;
```

### 15.3 Engagement Management

```typescript
// apps/api/src/routes/engagements.ts

import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

/**
 * List engagements for tenant
 */
router.get('/api/v1/engagements', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;
  const { status, limit = 50, offset = 0 } = req.query;

  const engagements = await db.engagements.findByTenant(tenantId, {
    status: status as string,
    limit: Number(limit),
    offset: Number(offset),
  });

  const total = await db.engagements.countByTenant(tenantId, { status: status as string });

  res.json({
    engagements,
    pagination: { total, limit: Number(limit), offset: Number(offset) },
  });
});

/**
 * Create a new engagement
 */
router.post('/api/v1/engagements', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;
  const { name, description, settings } = req.body;

  // Create engagement
  const engagement = await db.engagements.create({
    tenantId,
    name,
    description,
    status: 'active',
    settings: settings || {},
    createdBy: req.user.id,
  });

  // Auto-create client knowledge base
  const tenant = await db.tenants.findById(tenantId);
  const qdrantCollection = `kb_${tenant.slug}_client_eng_${engagement.id.slice(0, 8)}`;

  await db.knowledgeBases.create({
    tenantId,
    engagementId: engagement.id,
    kbType: 'client',
    name: `${name} - Client Documents`,
    qdrantCollection,
  });

  // Create Qdrant collection
  await qdrantService.createCollection(qdrantCollection);

  res.status(201).json(engagement);
});

/**
 * Get engagement details
 */
router.get('/api/v1/engagements/:id', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;

  const engagement = await db.engagements.findById(req.params.id);
  if (!engagement || engagement.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Engagement not found' });
  }

  // Include related data
  const knowledgeBases = await db.knowledgeBases.findByEngagement(engagement.id);
  const recentJobs = await db.jobs.findByEngagement(engagement.id, { limit: 5 });
  const generatedContent = await db.generatedContent.findByEngagement(engagement.id);

  res.json({
    ...engagement,
    knowledgeBases,
    recentJobs,
    generatedContent: generatedContent.map(c => ({
      id: c.id,
      contentType: c.contentType,
      version: c.version,
      createdAt: c.createdAt,
    })),
  });
});

/**
 * Update engagement
 */
router.put('/api/v1/engagements/:id', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;
  const { name, description, status, settings } = req.body;

  const engagement = await db.engagements.findById(req.params.id);
  if (!engagement || engagement.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Engagement not found' });
  }

  const updated = await db.engagements.update(req.params.id, {
    name,
    description,
    status,
    settings,
  });

  res.json(updated);
});

/**
 * Archive engagement
 */
router.post('/api/v1/engagements/:id/archive', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;

  const engagement = await db.engagements.findById(req.params.id);
  if (!engagement || engagement.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Engagement not found' });
  }

  // Update status
  await db.engagements.update(req.params.id, { status: 'archived' });

  // Archive Qdrant collections (export to blob, delete from Qdrant)
  const kbs = await db.knowledgeBases.findByEngagement(req.params.id);
  for (const kb of kbs) {
    await collectionLifecycle.archiveCollection(kb.qdrantCollection, {
      tenantId,
      engagementId: req.params.id,
    });
  }

  // Invalidate caches
  await cacheInvalidator.onEngagementArchive(req.params.id);

  res.json({ status: 'archived' });
});

/**
 * Restore archived engagement
 */
router.post('/api/v1/engagements/:id/restore', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;

  const engagement = await db.engagements.findById(req.params.id);
  if (!engagement || engagement.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Engagement not found' });
  }

  if (engagement.status !== 'archived') {
    return res.status(400).json({ error: 'Engagement is not archived' });
  }

  // Restore Qdrant collections from blob storage
  const kbs = await db.knowledgeBases.findByEngagement(req.params.id);
  for (const kb of kbs) {
    await collectionLifecycle.restoreCollection(kb.qdrantCollection, {
      tenantId,
      engagementId: req.params.id,
    });
  }

  // Update status
  await db.engagements.update(req.params.id, { status: 'active' });

  res.json({ status: 'active' });
});

/**
 * Delete engagement (permanent)
 */
router.delete('/api/v1/engagements/:id', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;

  const engagement = await db.engagements.findById(req.params.id);
  if (!engagement || engagement.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Engagement not found' });
  }

  // Must be archived first
  if (engagement.status !== 'archived') {
    return res.status(400).json({ error: 'Engagement must be archived before deletion' });
  }

  // Delete Qdrant collections permanently
  const kbs = await db.knowledgeBases.findByEngagement(req.params.id);
  for (const kb of kbs) {
    await qdrantService.deleteCollection(kb.qdrantCollection);
    // Also delete archived backups
    await objectStore.deletePrefix(`archived/${tenantId}/${req.params.id}/`);
  }

  // Cascade delete (KBs, docs, chunks, generated content)
  await db.engagements.delete(req.params.id);

  res.status(204).send();
});

export default router;
```

### 15.4 Document Management

```typescript
// apps/api/src/routes/documents.ts

import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Supported file types
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
];

router.use(authMiddleware);

/**
 * Upload document to knowledge base
 */
router.post(
  '/api/v1/documents/upload',
  upload.single('file'),
  async (req: AuthenticatedRequest, res) => {
    const { tenantId } = req.user;
    const { knowledgeBaseId } = req.body;

    // Validate KB exists and belongs to tenant
    const kb = await db.knowledgeBases.findById(knowledgeBaseId);
    if (!kb || kb.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const file = req.file!;
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Check for duplicate
    const existing = await db.documents.findByHash(knowledgeBaseId, fileHash);
    if (existing) {
      return res.status(409).json({
        error: 'Document already exists',
        existingDocumentId: existing.id,
      });
    }

    // Upload to blob storage
    const blobPath = `documents/${tenantId}/${kb.id}/${fileHash}/${file.originalname}`;
    await objectStore.upload(blobPath, file.buffer, {
      contentType: file.mimetype,
      metadata: { originalName: file.originalname },
    });

    // Create document record
    const document = await db.documents.create({
      knowledgeBaseId: kb.id,
      tenantId,
      filename: `${fileHash}_${file.originalname}`,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      fileHash,
      blobPath,
      status: 'pending',
      sourceType: 'upload',
      createdBy: req.user.id,
    });

    // Create ingestion job
    const job = await jobService.create({
      tenantId,
      engagementId: kb.engagementId,
      jobType: 'document_ingest',
      inputPayload: {
        documentId: document.id,
        knowledgeBaseId: kb.id,
        blobPath,
        filename: file.originalname,
        mimeType: file.mimetype,
      },
      priority: 1,
      createdBy: req.user.id,
    });

    res.status(202).json({
      documentId: document.id,
      jobId: job.id,
      status: 'processing',
    });
  }
);

/**
 * List documents in knowledge base
 */
router.get('/api/v1/documents', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;
  const { knowledgeBaseId, status, limit = 50, offset = 0 } = req.query;

  // Validate KB access
  if (knowledgeBaseId) {
    const kb = await db.knowledgeBases.findById(knowledgeBaseId as string);
    if (!kb || kb.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }
  }

  const documents = await db.documents.find({
    tenantId,
    knowledgeBaseId: knowledgeBaseId as string,
    status: status as string,
    limit: Number(limit),
    offset: Number(offset),
  });

  res.json({ documents });
});

/**
 * Get document details
 */
router.get('/api/v1/documents/:id', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;

  const document = await db.documents.findById(req.params.id);
  if (!document || document.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Include chunks summary
  const chunks = await db.documentChunks.findByDocument(document.id);

  res.json({
    ...document,
    chunks: {
      count: chunks.length,
      totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
    },
  });
});

/**
 * Delete document
 */
router.delete('/api/v1/documents/:id', async (req: AuthenticatedRequest, res) => {
  const { tenantId } = req.user;

  const document = await db.documents.findById(req.params.id);
  if (!document || document.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Delete from Qdrant
  const kb = await db.knowledgeBases.findById(document.knowledgeBaseId);
  await qdrantService.deleteByFilter(kb.qdrantCollection, {
    document_id: document.id,
  });

  // Delete from blob storage
  await objectStore.delete(document.blobPath);

  // Delete from database (cascades to chunks)
  await db.documents.delete(document.id);

  // Invalidate caches
  await cacheInvalidator.onDocumentDelete(document.id, kb.engagementId);

  res.status(204).send();
});

export default router;
```

---

## 16. Document Processing Pipeline

### 16.1 File Type Handling Configuration

```typescript
// packages/shared/src/config/document-processing.ts

export interface DocumentProcessingConfig {
  // Supported file types
  supportedTypes: {
    mimeType: string;
    extensions: string[];
    extractor: 'pdf' | 'docx' | 'text' | 'markdown' | 'csv' | 'json';
    maxSizeMb: number;
  }[];

  // PDF-specific configuration
  pdf: {
    // OCR settings for scanned documents
    ocr: {
      enabled: boolean;
      provider: 'tesseract' | 'azure-document-intelligence';
      languages: string[];
      dpi: number;
      // Threshold: if text extraction yields < N chars per page, use OCR
      textThreshold: number;
    };

    // Table extraction
    tables: {
      enabled: boolean;
      provider: 'camelot' | 'azure-document-intelligence' | 'tabula';
      outputFormat: 'markdown' | 'html' | 'csv';
    };

    // Layout analysis
    layout: {
      enabled: boolean;
      preserveColumns: boolean;
      preserveHeaders: boolean;
    };
  };

  // DOCX-specific configuration
  docx: {
    preserveFormatting: boolean;
    extractImages: boolean;
    extractTables: boolean;
  };
}

export const DEFAULT_PROCESSING_CONFIG: DocumentProcessingConfig = {
  supportedTypes: [
    {
      mimeType: 'application/pdf',
      extensions: ['.pdf'],
      extractor: 'pdf',
      maxSizeMb: 50,
    },
    {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extensions: ['.docx'],
      extractor: 'docx',
      maxSizeMb: 25,
    },
    {
      mimeType: 'text/plain',
      extensions: ['.txt'],
      extractor: 'text',
      maxSizeMb: 10,
    },
    {
      mimeType: 'text/markdown',
      extensions: ['.md', '.markdown'],
      extractor: 'markdown',
      maxSizeMb: 10,
    },
    {
      mimeType: 'text/csv',
      extensions: ['.csv'],
      extractor: 'csv',
      maxSizeMb: 50,
    },
    {
      mimeType: 'application/json',
      extensions: ['.json'],
      extractor: 'json',
      maxSizeMb: 10,
    },
  ],

  pdf: {
    ocr: {
      enabled: true,
      provider: 'azure-document-intelligence',
      languages: ['en'],
      dpi: 300,
      textThreshold: 100, // chars per page
    },
    tables: {
      enabled: true,
      provider: 'azure-document-intelligence',
      outputFormat: 'markdown',
    },
    layout: {
      enabled: true,
      preserveColumns: true,
      preserveHeaders: true,
    },
  },

  docx: {
    preserveFormatting: true,
    extractImages: false, // Images need separate embedding
    extractTables: true,
  },
};
```

### 16.2 PDF Extraction with OCR

```typescript
// apps/worker/src/processors/pdfExtract.ts

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

export interface PdfExtractionResult {
  text: string;
  pages: PageContent[];
  tables: TableContent[];
  metadata: {
    pageCount: number;
    wordCount: number;
    usedOcr: boolean;
    language: string;
  };
}

export class PdfExtractor {
  private docIntelClient: DocumentAnalysisClient;

  constructor(config: DocumentProcessingConfig) {
    this.config = config;

    if (config.pdf.ocr.provider === 'azure-document-intelligence') {
      this.docIntelClient = new DocumentAnalysisClient(
        process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT!,
        new AzureKeyCredential(process.env.AZURE_DOC_INTELLIGENCE_KEY!)
      );
    }
  }

  async extract(buffer: Buffer, filename: string): Promise<PdfExtractionResult> {
    // First, try standard text extraction
    const basicResult = await this.basicExtraction(buffer);

    // Check if OCR is needed
    const needsOcr = this.config.pdf.ocr.enabled &&
      this.shouldUseOcr(basicResult);

    if (needsOcr) {
      return await this.ocrExtraction(buffer);
    }

    return basicResult;
  }

  private shouldUseOcr(result: PdfExtractionResult): boolean {
    // Use OCR if average chars per page is below threshold
    const avgCharsPerPage = result.text.length / result.metadata.pageCount;
    return avgCharsPerPage < this.config.pdf.ocr.textThreshold;
  }

  private async basicExtraction(buffer: Buffer): Promise<PdfExtractionResult> {
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse(buffer);

    return {
      text: data.text,
      pages: this.splitIntoPages(data),
      tables: [], // Basic extraction doesn't get tables
      metadata: {
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).length,
        usedOcr: false,
        language: 'en', // Could use langdetect
      },
    };
  }

  private async ocrExtraction(buffer: Buffer): Promise<PdfExtractionResult> {
    console.log('Using Azure Document Intelligence for OCR extraction');

    const poller = await this.docIntelClient.beginAnalyzeDocument(
      'prebuilt-document',
      buffer
    );
    const result = await poller.pollUntilDone();

    const pages: PageContent[] = [];
    const tables: TableContent[] = [];
    let fullText = '';

    // Extract text from pages
    for (const page of result.pages || []) {
      const pageText = (page.lines || [])
        .map(line => line.content)
        .join('\n');
      pages.push({
        pageNumber: page.pageNumber,
        text: pageText,
        width: page.width,
        height: page.height,
      });
      fullText += pageText + '\n\n';
    }

    // Extract tables
    for (const table of result.tables || []) {
      const tableContent: TableContent = {
        pageNumber: table.boundingRegions?.[0]?.pageNumber || 1,
        rowCount: table.rowCount,
        columnCount: table.columnCount,
        cells: table.cells.map(cell => ({
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          content: cell.content,
          isHeader: cell.kind === 'columnHeader',
        })),
        markdown: this.tableToMarkdown(table),
      };
      tables.push(tableContent);
    }

    return {
      text: fullText,
      pages,
      tables,
      metadata: {
        pageCount: pages.length,
        wordCount: fullText.split(/\s+/).length,
        usedOcr: true,
        language: result.languages?.[0] || 'en',
      },
    };
  }

  private tableToMarkdown(table: any): string {
    const rows: string[][] = [];
    const headers: string[] = [];

    // Build 2D array from cells
    for (const cell of table.cells) {
      if (!rows[cell.rowIndex]) {
        rows[cell.rowIndex] = [];
      }
      rows[cell.rowIndex][cell.columnIndex] = cell.content;

      if (cell.kind === 'columnHeader') {
        headers[cell.columnIndex] = cell.content;
      }
    }

    // Generate markdown
    let md = '| ' + headers.join(' | ') + ' |\n';
    md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    for (let i = 1; i < rows.length; i++) {
      md += '| ' + (rows[i] || []).join(' | ') + ' |\n';
    }

    return md;
  }
}

interface PageContent {
  pageNumber: number;
  text: string;
  width?: number;
  height?: number;
}

interface TableContent {
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  cells: TableCell[];
  markdown: string;
}

interface TableCell {
  rowIndex: number;
  columnIndex: number;
  content: string;
  isHeader: boolean;
}
```

### 16.3 Checkpoint-Based Pipeline Recovery

```typescript
// apps/worker/src/pipelines/ingestion.ts

export interface PipelineCheckpoint {
  step: 'extract' | 'chunk' | 'embed' | 'index';
  completedAt: Date;
  data: {
    // For chunking resume
    extractedText?: string;
    lastChunkIndex?: number;

    // For embedding resume
    chunks?: Array<{ id: string; text: string }>;
    lastEmbeddedIndex?: number;

    // For indexing resume
    chunksWithEmbeddings?: Array<{ id: string; embedding: number[] }>;
    lastIndexedIndex?: number;
  };
}

export class DocumentIngestionPipeline {
  async process(job: DocumentIngestJob): Promise<void> {
    const startStep = this.determineStartStep(job);

    console.log(`Starting ingestion from step: ${startStep}`);

    try {
      // Step 1: Extract
      if (startStep === 'extract') {
        await this.extractStep(job);
        await this.saveCheckpoint(job, 'extract');
      }

      // Step 2: Chunk
      if (['extract', 'chunk'].includes(startStep)) {
        await this.chunkStep(job);
        await this.saveCheckpoint(job, 'chunk');
      }

      // Step 3: Embed
      if (['extract', 'chunk', 'embed'].includes(startStep)) {
        await this.embedStep(job);
        await this.saveCheckpoint(job, 'embed');
      }

      // Step 4: Index
      await this.indexStep(job);

      // Mark job complete
      await this.completeJob(job);

    } catch (error) {
      await this.handleStepFailure(job, error);
      throw error;
    }
  }

  private determineStartStep(job: DocumentIngestJob): string {
    if (!job.lastCompletedStep) {
      return 'extract';
    }

    const steps = ['extract', 'chunk', 'embed', 'index'];
    const lastIndex = steps.indexOf(job.lastCompletedStep);

    // Resume from next step
    return steps[lastIndex + 1] || 'extract';
  }

  private async saveCheckpoint(
    job: DocumentIngestJob,
    step: string
  ): Promise<void> {
    const checkpointData = await this.buildCheckpointData(job, step);

    await db.jobs.update(job.id, {
      lastCompletedStep: step,
      checkpointData,
      checkpointAt: new Date(),
      progress: this.calculateProgress(step),
    });

    console.log(`Checkpoint saved: ${step}`);
  }

  private async handleStepFailure(
    job: DocumentIngestJob,
    error: Error
  ): Promise<void> {
    const currentStep = await this.getCurrentStep(job);

    await db.jobs.update(job.id, {
      failedStep: currentStep,
      errorMessage: error.message,
      errorDetails: {
        stack: error.stack,
        step: currentStep,
        timestamp: new Date().toISOString(),
      },
    });

    // If retryable, queue for retry from failed step
    if (job.retryCount < job.maxRetries && this.isRetryableError(error)) {
      await this.scheduleRetry(job);
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'rate_limit',
      'service_unavailable',
    ];
    return retryableErrors.some(e =>
      error.message.toLowerCase().includes(e.toLowerCase())
    );
  }

  private calculateProgress(step: string): number {
    const progressMap: Record<string, number> = {
      extract: 25,
      chunk: 50,
      embed: 75,
      index: 100,
    };
    return progressMap[step] || 0;
  }

  private async embedStep(job: DocumentIngestJob): Promise<void> {
    const chunks = await this.getChunksToEmbed(job);
    const startIndex = job.checkpointData?.lastEmbeddedIndex || 0;

    // Process in batches with checkpointing
    const batchSize = 100;

    for (let i = startIndex; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // Generate embeddings
      const embeddings = await embeddingAdapter.embedBatch(
        batch.map(c => c.text)
      );

      // Store embeddings
      for (let j = 0; j < batch.length; j++) {
        batch[j].embedding = embeddings[j];
      }

      // Checkpoint after each batch
      await db.jobs.update(job.id, {
        checkpointData: {
          ...job.checkpointData,
          lastEmbeddedIndex: i + batch.length,
        },
        progress: 50 + Math.round(25 * (i + batch.length) / chunks.length),
      });

      // Broadcast progress
      await realtimeService.broadcastJobProgress(job.id, {
        progress: 50 + Math.round(25 * (i + batch.length) / chunks.length),
        message: `Embedding chunk ${i + batch.length} of ${chunks.length}`,
      });
    }
  }
}
```

---

## 17. Graceful Degradation & Fallbacks

### 17.1 Service Fallback Chain

```typescript
// packages/shared/src/resilience/fallback-chain.ts

export interface FallbackChainConfig {
  reranking: {
    primary: 'cohere';
    fallbacks: ('cross-encoder' | 'none')[];
    healthCheck: {
      endpoint: string;
      timeout: number;
      interval: number;
    };
  };

  embedding: {
    primary: 'openai';
    fallbacks: ('azure-openai' | 'local')[];
  };

  llm: {
    primary: 'gemini';
    fallbacks: ('azure-openai' | 'openai')[];
  };

  vectorDb: {
    primary: 'qdrant';
    fallbacks: ('qdrant-cloud' | 'pinecone')[];
  };
}

export const DEFAULT_FALLBACK_CONFIG: FallbackChainConfig = {
  reranking: {
    primary: 'cohere',
    fallbacks: ['cross-encoder', 'none'],
    healthCheck: {
      endpoint: 'https://api.cohere.ai/v1/check',
      timeout: 5000,
      interval: 60000,
    },
  },

  embedding: {
    primary: 'openai',
    fallbacks: ['azure-openai'],
  },

  llm: {
    primary: 'gemini',
    fallbacks: ['azure-openai', 'openai'],
  },

  vectorDb: {
    primary: 'qdrant',
    fallbacks: ['qdrant-cloud'],
  },
};

export class FallbackChainManager {
  private serviceStatus: Map<string, ServiceStatus> = new Map();

  constructor(
    private config: FallbackChainConfig,
    private circuitBreakers: CircuitBreakerRegistry
  ) {
    this.startHealthChecks();
  }

  /**
   * Get the current active provider for a service
   */
  async getActiveProvider<T>(
    service: keyof FallbackChainConfig,
    providers: Map<string, T>
  ): Promise<{ provider: T; name: string }> {
    const chain = this.config[service];
    const allProviders = [chain.primary, ...chain.fallbacks];

    for (const name of allProviders) {
      // Skip 'none' fallback
      if (name === 'none') {
        return { provider: null as any, name: 'none' };
      }

      const status = this.serviceStatus.get(`${service}.${name}`);
      const breaker = this.circuitBreakers.get(`${service}.${name}`);

      // Check if service is healthy
      if (status?.healthy && breaker?.getState() !== 'open') {
        const provider = providers.get(name);
        if (provider) {
          return { provider, name };
        }
      }
    }

    throw new Error(`No healthy provider available for ${service}`);
  }

  /**
   * Execute with automatic fallback
   */
  async executeWithFallback<T, R>(
    service: keyof FallbackChainConfig,
    providers: Map<string, T>,
    operation: (provider: T) => Promise<R>,
    options: { skipFallback?: boolean } = {}
  ): Promise<{ result: R; usedProvider: string }> {
    const chain = this.config[service];
    const allProviders = [chain.primary, ...chain.fallbacks];
    const errors: Error[] = [];

    for (const name of allProviders) {
      // Handle 'none' fallback (skip operation)
      if (name === 'none') {
        console.warn(`Using 'none' fallback for ${service}`);
        return {
          result: null as any,
          usedProvider: 'none',
        };
      }

      const provider = providers.get(name);
      if (!provider) continue;

      const breaker = this.circuitBreakers.get(`${service}.${name}`);

      try {
        const result = await breaker.execute(() => operation(provider));

        // Log if using fallback
        if (name !== chain.primary) {
          console.warn(`Using fallback provider ${name} for ${service}`);
        }

        return { result, usedProvider: name };
      } catch (error) {
        errors.push(error as Error);
        console.error(`Provider ${name} failed for ${service}:`, error);

        if (options.skipFallback) {
          throw error;
        }
      }
    }

    // All providers failed
    const aggregateError = new Error(
      `All providers failed for ${service}: ${errors.map(e => e.message).join('; ')}`
    );
    (aggregateError as any).errors = errors;
    throw aggregateError;
  }

  private startHealthChecks(): void {
    // Check reranking service health periodically
    setInterval(async () => {
      await this.checkServiceHealth('reranking', 'cohere');
    }, this.config.reranking.healthCheck.interval);
  }

  private async checkServiceHealth(
    service: string,
    provider: string
  ): Promise<void> {
    const key = `${service}.${provider}`;
    try {
      // Provider-specific health check
      await this.performHealthCheck(service, provider);
      this.serviceStatus.set(key, { healthy: true, lastCheck: new Date() });
    } catch (error) {
      this.serviceStatus.set(key, {
        healthy: false,
        lastCheck: new Date(),
        lastError: (error as Error).message,
      });
    }
  }
}

interface ServiceStatus {
  healthy: boolean;
  lastCheck: Date;
  lastError?: string;
}
```

### 17.2 RAG Pipeline with Fallbacks

```typescript
// apps/api/src/services/rag-pipeline-resilient.ts

export class ResilientRAGPipeline {
  constructor(
    private fallbackManager: FallbackChainManager,
    private embeddingProviders: Map<string, EmbeddingAdapter>,
    private rerankProviders: Map<string, RerankAdapter>,
    private llmProviders: Map<string, LLMAdapter>
  ) {}

  async generate(
    query: string,
    filter: RetrievalFilter,
    prompt: PromptTemplate
  ): Promise<GenerationResult> {
    // 1. Generate query embedding with fallback
    const { result: queryEmbedding, usedProvider: embeddingProvider } =
      await this.fallbackManager.executeWithFallback(
        'embedding',
        this.embeddingProviders,
        (adapter) => adapter.embed(query)
      );

    // 2. Retrieve candidates
    const candidates = await this.vectorStore.search(
      filter.knowledge_base_ids?.[0] || 'default',
      queryEmbedding,
      filter,
      { limit: 100 }
    );

    // 3. Rerank with fallback (graceful degradation to no reranking)
    let rerankedResults: SearchResult[];
    const { result: reranked, usedProvider: rerankProvider } =
      await this.fallbackManager.executeWithFallback(
        'reranking',
        this.rerankProviders,
        async (adapter) => {
          if (adapter === null) {
            // 'none' fallback - skip reranking
            return candidates;
          }
          const rerankDocs = candidates.map(c => ({
            id: c.id,
            text: c.payload.text as string,
          }));
          const reranked = await adapter.rerank(query, rerankDocs);
          return reranked.map(r => candidates.find(c => c.id === r.id)!);
        }
      );
    rerankedResults = reranked;

    // Log degradation
    if (rerankProvider === 'none') {
      console.warn('Reranking skipped - using vector search ordering');
    }

    // 4. Build context
    const context = this.buildContext(rerankedResults);

    // 5. Generate with LLM fallback
    const { result: generated, usedProvider: llmProvider } =
      await this.fallbackManager.executeWithFallback(
        'llm',
        this.llmProviders,
        (adapter) =>
          adapter.generateStructured(
            {
              systemPrompt: prompt.system,
              userPrompt: prompt.buildUserPrompt(query, context),
              temperature: 0.7,
              maxTokens: 4000,
            },
            prompt.outputSchema
          )
      );

    return {
      content: generated,
      metadata: {
        embeddingProvider,
        rerankProvider,
        llmProvider,
        chunksUsed: context.chunks.length,
        degraded: rerankProvider === 'none',
      },
    };
  }
}
```

---

## 18. Health Monitoring

### 18.1 Health Check Endpoint

```typescript
// apps/api/src/routes/health.ts

import { Router } from 'express';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    [service: string]: {
      status: 'up' | 'down' | 'degraded';
      latency?: number;
      message?: string;
    };
  };
}

/**
 * Lightweight liveness probe
 */
router.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Comprehensive readiness probe
 */
router.get('/health/ready', async (req, res) => {
  const health = await performHealthChecks();

  const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

/**
 * Deep health check with all dependencies
 */
router.get('/health', async (req, res) => {
  const health = await performHealthChecks({ deep: true });

  const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

async function performHealthChecks(options: { deep?: boolean } = {}): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {};

  // Database check
  checks.database = await checkDatabase();

  // Redis check
  checks.redis = await checkRedis();

  // Qdrant check
  checks.qdrant = await checkQdrant();

  // Queue check
  checks.queue = await checkQueue();

  if (options.deep) {
    // External services (only on deep check to avoid rate limits)
    checks.embedding = await checkEmbeddingService();
    checks.llm = await checkLLMService();
    checks.reranking = await checkRerankService();
  }

  // Determine overall status
  const statuses = Object.values(checks).map(c => c.status);
  let overallStatus: HealthStatus['status'];

  if (statuses.every(s => s === 'up')) {
    overallStatus = 'healthy';
  } else if (statuses.some(s => s === 'down')) {
    // Core services down = unhealthy
    const coreDown = ['database', 'redis', 'qdrant'].some(
      s => checks[s]?.status === 'down'
    );
    overallStatus = coreDown ? 'unhealthy' : 'degraded';
  } else {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    checks,
  };
}

async function checkDatabase(): Promise<{ status: 'up' | 'down'; latency?: number; message?: string }> {
  const start = Date.now();
  try {
    await db.raw('SELECT 1');
    return { status: 'up', latency: Date.now() - start };
  } catch (error) {
    return { status: 'down', message: (error as Error).message };
  }
}

async function checkRedis(): Promise<{ status: 'up' | 'down'; latency?: number; message?: string }> {
  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'up', latency: Date.now() - start };
  } catch (error) {
    return { status: 'down', message: (error as Error).message };
  }
}

async function checkQdrant(): Promise<{ status: 'up' | 'down' | 'degraded'; latency?: number; message?: string }> {
  const start = Date.now();
  try {
    const info = await qdrantClient.getCollections();
    return { status: 'up', latency: Date.now() - start };
  } catch (error) {
    return { status: 'down', message: (error as Error).message };
  }
}

async function checkQueue(): Promise<{ status: 'up' | 'down' | 'degraded'; latency?: number; message?: string }> {
  const start = Date.now();
  try {
    // Check queue depth
    const depth = await queueAdapter.getQueueDepth('jobs');
    const status = depth > 1000 ? 'degraded' : 'up';
    return {
      status,
      latency: Date.now() - start,
      message: status === 'degraded' ? `Queue depth: ${depth}` : undefined,
    };
  } catch (error) {
    return { status: 'down', message: (error as Error).message };
  }
}

async function checkEmbeddingService(): Promise<{ status: 'up' | 'down' | 'degraded'; latency?: number }> {
  const start = Date.now();
  try {
    // Quick embedding test
    await embeddingAdapter.embed('health check');
    return { status: 'up', latency: Date.now() - start };
  } catch (error) {
    // Check if fallback is available
    const hasFallback = fallbackManager.hasHealthyFallback('embedding');
    return {
      status: hasFallback ? 'degraded' : 'down',
      latency: Date.now() - start,
    };
  }
}

async function checkLLMService(): Promise<{ status: 'up' | 'down' | 'degraded'; latency?: number }> {
  const start = Date.now();
  try {
    // Quick generation test (minimal tokens)
    await llmAdapter.generate({
      userPrompt: 'Reply with OK',
      maxTokens: 5,
    });
    return { status: 'up', latency: Date.now() - start };
  } catch (error) {
    const hasFallback = fallbackManager.hasHealthyFallback('llm');
    return {
      status: hasFallback ? 'degraded' : 'down',
      latency: Date.now() - start,
    };
  }
}

async function checkRerankService(): Promise<{ status: 'up' | 'down' | 'degraded'; latency?: number }> {
  const start = Date.now();
  try {
    await rerankAdapter.rerank('test', [{ id: '1', text: 'test document' }]);
    return { status: 'up', latency: Date.now() - start };
  } catch (error) {
    // Reranking has 'none' fallback, so never fully down
    return { status: 'degraded', latency: Date.now() - start };
  }
}

export default router;
```

### 18.2 Monitoring Dashboard Metrics

```typescript
// packages/shared/src/observability/metrics.ts

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

export const metricsRegistry = new Registry();

// Request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [metricsRegistry],
});

// RAG pipeline metrics
export const ragRetrievalDuration = new Histogram({
  name: 'rag_retrieval_duration_seconds',
  help: 'RAG retrieval duration in seconds',
  labelNames: ['kb_type'],
  buckets: [0.1, 0.2, 0.5, 1, 2],
  registers: [metricsRegistry],
});

export const ragRerankDuration = new Histogram({
  name: 'rag_rerank_duration_seconds',
  help: 'RAG reranking duration in seconds',
  labelNames: ['provider'],
  buckets: [0.1, 0.3, 0.5, 1, 2],
  registers: [metricsRegistry],
});

export const ragGenerationDuration = new Histogram({
  name: 'rag_generation_duration_seconds',
  help: 'RAG generation duration in seconds',
  labelNames: ['content_type', 'model'],
  buckets: [1, 3, 5, 10, 20, 30],
  registers: [metricsRegistry],
});

// Document processing metrics
export const documentsProcessed = new Counter({
  name: 'documents_processed_total',
  help: 'Total documents processed',
  labelNames: ['status', 'mime_type'],
  registers: [metricsRegistry],
});

export const chunksCreated = new Counter({
  name: 'chunks_created_total',
  help: 'Total chunks created',
  labelNames: ['kb_type'],
  registers: [metricsRegistry],
});

// Queue metrics
export const queueDepth = new Gauge({
  name: 'queue_depth',
  help: 'Current queue depth',
  labelNames: ['queue_name'],
  registers: [metricsRegistry],
});

export const jobDuration = new Histogram({
  name: 'job_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['job_type', 'status'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

// Cost metrics
export const tokensUsed = new Counter({
  name: 'tokens_used_total',
  help: 'Total tokens used',
  labelNames: ['operation', 'model', 'tenant_id'],
  registers: [metricsRegistry],
});

export const costUsd = new Counter({
  name: 'cost_usd_total',
  help: 'Total cost in USD',
  labelNames: ['operation', 'model', 'tenant_id'],
  registers: [metricsRegistry],
});

// Service availability
export const serviceStatus = new Gauge({
  name: 'service_status',
  help: 'Service health status (1=up, 0=down, 0.5=degraded)',
  labelNames: ['service', 'provider'],
  registers: [metricsRegistry],
});

// Metrics endpoint
export function metricsMiddleware(app: Express) {
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  });
}
```

---

## 19. Implementation Checklist

### Phase 1: Foundation (Weeks 1-2)

- [ ] **Monorepo Setup**
  - [ ] Initialize pnpm workspace
  - [ ] Configure Turborepo
  - [ ] Set up shared TypeScript config
  - [ ] Create package structure

- [ ] **Database Setup**
  - [ ] Create Postgres schema (DDL above)
  - [ ] Set up migration system
  - [ ] Implement repositories
  - [ ] Test with Docker Compose

- [ ] **Storage Setup**
  - [ ] Implement ObjectStoreAdapter interface
  - [ ] Create Azure Blob implementation
  - [ ] Create local filesystem implementation (dev)
  - [ ] Test upload/download

- [ ] **API Foundation**
  - [ ] Express/Fastify setup
  - [ ] Health check endpoint
  - [ ] Error handling middleware
  - [ ] Request validation
  - [ ] Logging setup

- [ ] **Frontend Migration**
  - [ ] Copy existing Public/ to apps/web/
  - [ ] Create staticwebapp.config.json
  - [ ] Test static serving
  - [ ] Verify no regressions

### Phase 2: Ingestion & Memory (Weeks 3-4)

- [ ] **Queue Setup**
  - [ ] Implement QueueAdapter interface
  - [ ] Create Azure Service Bus implementation
  - [ ] Create local in-memory implementation
  - [ ] Test job creation and processing

- [ ] **Worker Foundation**
  - [ ] Worker entry point
  - [ ] Job polling/processing loop
  - [ ] Error handling and retry
  - [ ] DLQ handling

- [ ] **Document Processing**
  - [ ] PDF extraction (pdf-parse)
  - [ ] DOCX extraction (mammoth)
  - [ ] MD/TXT handling
  - [ ] Text cleaning/normalization

- [ ] **Chunking Pipeline**
  - [ ] Implement semantic chunking
  - [ ] Configure chunk size/overlap
  - [ ] Token counting
  - [ ] Chunk storage to Postgres

- [ ] **Embedding Pipeline**
  - [ ] Implement EmbeddingAdapter
  - [ ] OpenAI ada-002 integration
  - [ ] Batch processing
  - [ ] Rate limiting

- [ ] **Vector Indexing**
  - [ ] Implement VectorStoreAdapter
  - [ ] Qdrant integration
  - [ ] Collection management
  - [ ] Upsert with payloads

- [ ] **Redis Caching**
  - [ ] Cache retrieval results
  - [ ] Cache context packs
  - [ ] TTL management

### Phase 3: RAG Generators (Weeks 5-6)

- [ ] **Retrieval Gateway**
  - [ ] Implement filter contract validation
  - [ ] Scope enforcement
  - [ ] Audit logging
  - [ ] Post-retrieval validation

- [ ] **Context Building**
  - [ ] Chunk retrieval (top-k)
  - [ ] Optional reranking
  - [ ] Context pack assembly
  - [ ] Token budget management

- [ ] **Generation Pipeline**
  - [ ] Implement LLMAdapter
  - [ ] Gemini integration
  - [ ] Structured output handling
  - [ ] JSON repair

- [ ] **Content Generators**
  - [ ] Roadmap generator (preserve schema)
  - [ ] Slides generator (preserve schema)
  - [ ] Document generator (preserve schema)
  - [ ] Research analysis generator

- [ ] **API Endpoints**
  - [ ] POST /api/content/generate
  - [ ] POST /get-task-analysis
  - [ ] POST /ask-question
  - [ ] POST /generate-chart (legacy compat)

### Phase 4: Library Ingestion (Weeks 7-8)

- [ ] **GitHub Sync**
  - [ ] GitHub API integration
  - [ ] Repository cloning/fetching
  - [ ] Commit tracking for incremental
  - [ ] File filtering (glob patterns)

- [ ] **Scheduled Jobs**
  - [ ] Container Apps Job setup
  - [ ] Cron scheduling
  - [ ] Monitoring and alerts

- [ ] **OSS Knowledge Bases**
  - [ ] ISDA CDM ingestion
  - [ ] Basel III regulations
  - [ ] Other standard libraries

### Phase 5: Production Readiness (Weeks 9-10)

- [ ] **Authentication**
  - [ ] Entra ID integration
  - [ ] JWT validation middleware
  - [ ] Role-based access control

- [ ] **Security**
  - [ ] Key Vault integration
  - [ ] Managed identity setup
  - [ ] Network security (VNet)
  - [ ] Rate limiting

- [ ] **Monitoring**
  - [ ] Application Insights
  - [ ] Log aggregation
  - [ ] Alerting rules
  - [ ] Health dashboards

- [ ] **Testing**
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] Contract tests (API schemas)
  - [ ] Load testing

- [ ] **Documentation**
  - [ ] API documentation
  - [ ] Deployment guide
  - [ ] Runbook

---

## Appendix A: File Paths Reference

### Frontend Files to Preserve (Copy to apps/web/)

```
Public/
├── index.html
├── viewer.html
├── main.js
├── viewer.js
├── Router.js
├── GanttChart.js
├── Utils.js
├── config.js
├── components/
│   ├── SidebarNav.js
│   ├── shared/
│   │   ├── StateManager.js
│   │   ├── ErrorHandler.js
│   │   ├── Accessibility.js
│   │   ├── Performance.js
│   │   └── LazyLoader.js
│   └── views/
│       ├── SlidesView.js
│       ├── DocumentView.js
│       └── ResearchAnalysisView.js
├── gantt/
│   ├── index.js
│   ├── renderer.js
│   ├── components.js
│   ├── GanttEditor.js
│   ├── GanttExporter.js
│   ├── DraggableGantt.js
│   ├── ResizableGantt.js
│   ├── ContextMenu.js
│   ├── InteractiveGanttHandler.js
│   └── analysis.js
├── analysis/
│   ├── TaskAnalyzer.js
│   └── ChatInterface.js
├── utils/
│   ├── index.js
│   ├── fetch.js
│   ├── dom.js
│   ├── date.js
│   ├── performance.js
│   ├── assets.js
│   └── analysis-builders.js
├── config/
│   └── shared.js
├── styles/
│   ├── design-system.css
│   ├── gantt.css
│   ├── slides-view.css
│   ├── document-view.css
│   ├── analysis-view.css
│   ├── tailwind.css
│   └── [other CSS files]
└── [images, logos, SVGs]
```

### Backend Files to Reference (Not Copy)

These files contain logic/prompts to adapt to the new architecture:

```
server/
├── gemini.js           → packages/adapters/src/llm/google-gemini.ts
├── generators.js       → apps/worker/src/pipelines/generation.ts
├── prompts.js          → apps/api/src/prompts/ (modularize)
├── prompts/
│   ├── roadmap.js      → apps/api/src/prompts/roadmap.ts
│   ├── slides.js       → apps/api/src/prompts/slides.ts
│   ├── document.js     → apps/api/src/prompts/document.ts
│   └── research-analysis.js → apps/api/src/prompts/research-analysis.ts
├── utils.js            → packages/shared/src/validation/
└── middleware.js       → apps/api/src/middleware/
```

---

## Appendix B: API Endpoint Mapping

| Legacy Endpoint | New Endpoint | Notes |
|-----------------|--------------|-------|
| `POST /generate-chart` | `POST /api/v1/content/generate` | Combined endpoint |
| `POST /api/content/generate` | `POST /api/v1/content/generate` | Same |
| `POST /get-task-analysis` | `POST /api/v1/analysis/task` | Renamed |
| `POST /ask-question` | `POST /api/v1/analysis/question` | Renamed |
| - | `POST /api/v1/documents/upload` | New |
| - | `GET /api/v1/documents/:id` | New |
| - | `GET /api/v1/jobs/:id` | New |
| - | `GET /api/v1/engagements/:id/content` | New |

---

*End of V1 Build Specification*
