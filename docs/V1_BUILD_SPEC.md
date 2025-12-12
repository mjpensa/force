# V1 Build Specification
## Consulting-Grade Research & Proposal Generator (Azure-Ready, Portable)

**Version:** 1.3.0
**Created:** 2025-12-12
**Updated:** 2025-12-12
**Status:** Implementation Blueprint

### Changelog

**v1.3.0** (2025-12-12) - Critical Gap Fixes
- **P0-1**: Fixed auth architecture - MSAL + Bearer tokens end-to-end (removed SWA header fallback)
- **P0-2**: Fixed tenant isolation - server-side override + actual RLS policies
- **P0-3**: Fixed schema conflicts - `entra_oid` now nullable, added `user_invitations` table
- **P0-4**: Fixed contract validation - added JSON Schemas (not just TS interfaces) for AJV
- **P1-1**: Fixed hybrid search - added Postgres FTS implementation
- **P1-2**: Fixed document ingestion - streaming uploads, extracted text in blob storage
- **P1-3**: Fixed Qdrant posture - capacity plan + managed recommendation
- **P1-4**: Fixed reranking - added `COHERE_API_KEY`, documented fallback strategy
- **P2-1**: Added security hardening (malware scan, private networking, prompt injection)
- **P2-2**: Added data lifecycle governance
- **P2-3**: Added observability completeness (SLIs/SLOs)
- **P2-4**: Added CI/CD + migrations strategy

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
19. [Security Hardening](#19-security-hardening)
20. [Data Lifecycle & Governance](#20-data-lifecycle--governance)
21. [CI/CD & Migrations](#21-cicd--migrations)
22. [Implementation Checklist](#22-implementation-checklist)

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
-- NOTE: entra_oid is nullable to support pre-provisioned/invited users
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    entra_oid       VARCHAR(255),  -- Azure AD Object ID (NULL until first login)
    email           VARCHAR(255) NOT NULL,
    display_name    VARCHAR(255),
    role            VARCHAR(50) NOT NULL DEFAULT 'member',  -- admin, member, viewer
    status          VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, active, suspended
    settings        JSONB DEFAULT '{}',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    -- Unique constraint only on non-null entra_oid values
    CONSTRAINT users_entra_oid_unique UNIQUE (entra_oid)
);

CREATE INDEX idx_users_tenant ON users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_entra ON users(entra_oid) WHERE entra_oid IS NOT NULL;
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(tenant_id, status) WHERE deleted_at IS NULL;

-- User Invitations (for pre-provisioning users before first login)
CREATE TABLE user_invitations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by      UUID REFERENCES users(id),
    token           VARCHAR(255) NOT NULL UNIQUE,  -- Secure invitation token
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at     TIMESTAMPTZ,
    user_id         UUID REFERENCES users(id),  -- Links to user after acceptance
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate pending invitations
    CONSTRAINT unique_pending_invitation UNIQUE (tenant_id, email)
        -- Note: Partial unique index below handles this more precisely
);

CREATE INDEX idx_invitations_tenant ON user_invitations(tenant_id);
CREATE INDEX idx_invitations_email ON user_invitations(email);
CREATE INDEX idx_invitations_token ON user_invitations(token);
CREATE UNIQUE INDEX idx_invitations_pending ON user_invitations(tenant_id, email)
    WHERE accepted_at IS NULL AND expires_at > NOW();

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
-- ROW LEVEL SECURITY (REQUIRED for multi-tenant isolation)
-- ============================================

-- Enable RLS on ALL tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE retrieval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Create application role for API connections (not superuser)
-- This role will be subject to RLS policies
CREATE ROLE force_api_role NOLOGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO force_api_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO force_api_role;

-- Create actual user for API connections
CREATE USER force_api WITH PASSWORD 'CHANGE_IN_PRODUCTION' IN ROLE force_api_role;

-- CRITICAL: Tenant isolation policies
-- The API MUST call: SET LOCAL app.tenant_id = '<uuid>'; at start of each transaction

CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_engagements ON engagements
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_kb ON knowledge_bases
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_documents ON documents
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_chunks ON document_chunks
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_jobs ON jobs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_content ON generated_content
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_audit ON audit_logs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_retrieval ON retrieval_logs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_usage ON usage_logs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

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

-- ============================================
-- FULL-TEXT SEARCH (for Hybrid RAG)
-- ============================================

-- Add tsvector column for FTS on document chunks
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS
    chunk_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED;

-- GIN index for fast FTS queries
CREATE INDEX idx_chunks_fts ON document_chunks USING GIN (chunk_tsv);

-- Composite index for tenant-scoped FTS
CREATE INDEX idx_chunks_fts_tenant ON document_chunks(tenant_id)
    INCLUDE (chunk_tsv) WHERE deleted_at IS NULL;

-- Function for hybrid search combining FTS rank with vector similarity
CREATE OR REPLACE FUNCTION hybrid_search_chunks(
    p_tenant_id UUID,
    p_kb_ids UUID[],
    p_query TEXT,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    chunk_text TEXT,
    fts_rank REAL,
    qdrant_point_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.chunk_text,
        ts_rank(dc.chunk_tsv, websearch_to_tsquery('english', p_query)) AS fts_rank,
        dc.qdrant_point_id
    FROM document_chunks dc
    WHERE dc.tenant_id = p_tenant_id
      AND dc.knowledge_base_id = ANY(p_kb_ids)
      AND dc.chunk_tsv @@ websearch_to_tsquery('english', p_query)
    ORDER BY fts_rank DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to API role
GRANT EXECUTE ON FUNCTION hybrid_search_chunks(UUID, UUID[], TEXT, INTEGER) TO force_api_role;
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

### 4.8 Qdrant Capacity Planning

> **CRITICAL:** Self-hosted Qdrant on Azure Container Apps has significant limitations.
> **Recommendation: Use Qdrant Cloud for production workloads.**

```typescript
// infrastructure/capacity-planning/qdrant-estimates.ts

/**
 * Qdrant Capacity Planning Calculator
 *
 * Key factors:
 * - Embedding dimensions (ada-002 = 1536)
 * - Storage mode (RAM vs disk)
 * - Quantization (int8 reduces memory ~4x)
 * - Payload storage (chunk text in payload)
 */

interface CapacityEstimate {
  // Input parameters
  expectedDocuments: number;
  avgChunksPerDocument: number;
  embeddingDimensions: number;
  avgPayloadSizeBytes: number;  // chunk_text + metadata

  // Calculated estimates
  totalVectors: number;
  vectorMemoryGB: number;
  payloadMemoryGB: number;
  totalMemoryGB: number;
  recommendedInstance: string;
}

const EMBEDDING_CONFIGS = {
  'ada-002': { dimensions: 1536, bytesPerDim: 4 },  // float32
  'ada-002-int8': { dimensions: 1536, bytesPerDim: 1 },  // quantized
};

function calculateCapacity(params: {
  documents: number;
  chunksPerDoc: number;
  avgChunkChars: number;
  quantized: boolean;
}): CapacityEstimate {
  const { documents, chunksPerDoc, avgChunkChars, quantized } = params;

  const totalVectors = documents * chunksPerDoc;
  const config = quantized
    ? EMBEDDING_CONFIGS['ada-002-int8']
    : EMBEDDING_CONFIGS['ada-002'];

  // Vector storage: dimensions * bytes per dim * num vectors
  const vectorBytes = config.dimensions * config.bytesPerDim * totalVectors;
  const vectorMemoryGB = vectorBytes / (1024 ** 3);

  // Payload storage: avg chunk text + overhead (~20% for metadata)
  const avgPayloadBytes = avgChunkChars + (avgChunkChars * 0.2);
  const payloadBytes = avgPayloadBytes * totalVectors;
  const payloadMemoryGB = payloadBytes / (1024 ** 3);

  // Total with overhead (indexes, HNSW graph ~30%)
  const totalMemoryGB = (vectorMemoryGB + payloadMemoryGB) * 1.3;

  // Instance recommendation
  let recommendedInstance: string;
  if (totalMemoryGB <= 4) {
    recommendedInstance = 'Container Apps: 4Gi (dev/small)';
  } else if (totalMemoryGB <= 16) {
    recommendedInstance = 'Container Apps: 16Gi OR Qdrant Cloud Starter';
  } else if (totalMemoryGB <= 64) {
    recommendedInstance = 'Qdrant Cloud Standard (RECOMMENDED)';
  } else {
    recommendedInstance = 'Qdrant Cloud Enterprise (dedicated)';
  }

  return {
    expectedDocuments: documents,
    avgChunksPerDocument: chunksPerDoc,
    embeddingDimensions: config.dimensions,
    avgPayloadSizeBytes: avgPayloadBytes,
    totalVectors,
    vectorMemoryGB,
    payloadMemoryGB,
    totalMemoryGB,
    recommendedInstance,
  };
}

// Example capacity scenarios
const CAPACITY_SCENARIOS = {
  // Small deployment: 1000 docs, 50 chunks each
  small: calculateCapacity({
    documents: 1_000,
    chunksPerDoc: 50,
    avgChunkChars: 1500,
    quantized: true,
  }),
  // Medium deployment: 10,000 docs
  medium: calculateCapacity({
    documents: 10_000,
    chunksPerDoc: 50,
    avgChunkChars: 1500,
    quantized: true,
  }),
  // Large deployment: 100,000 docs
  large: calculateCapacity({
    documents: 100_000,
    chunksPerDoc: 50,
    avgChunkChars: 1500,
    quantized: true,
  }),
};

/**
 * Capacity Recommendations Summary
 *
 * | Scenario | Vectors    | Memory (Quantized) | Recommendation              |
 * |----------|------------|--------------------|-----------------------------|
 * | Small    | 50,000     | ~1.5 GB           | Container Apps 4Gi OK       |
 * | Medium   | 500,000    | ~15 GB            | Qdrant Cloud Starter        |
 * | Large    | 5,000,000  | ~150 GB           | Qdrant Cloud Standard       |
 *
 * WARNING: Container Apps with Azure Files storage has high latency.
 * For production: Qdrant Cloud provides:
 * - Managed infrastructure
 * - Auto-scaling
 * - Built-in backups
 * - Low-latency storage
 * - Multi-region support
 */
```

**Production Recommendation:**

| Workload | Storage | Recommendation |
|----------|---------|----------------|
| < 100K vectors | Dev/Test | Self-hosted Container Apps OK |
| 100K - 1M vectors | Production | **Qdrant Cloud Starter** |
| 1M - 10M vectors | Production | **Qdrant Cloud Standard** |
| > 10M vectors | Enterprise | Qdrant Cloud Enterprise or AKS |

**Azure-specific considerations:**
- Azure Files has ~2-5ms latency overhead (vs SSD)
- Container Apps have 4Gi soft limit (8Gi max with Premium)
- For >16Gi memory, use AKS with managed disks
- Consider Private Endpoints for Qdrant Cloud

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
# Reranking Provider
# ============================================
RERANK_PROVIDER=cohere  # cohere | none
COHERE_API_KEY=  # Required if RERANK_PROVIDER=cohere
RERANK_MODEL=rerank-english-v3.0  # or rerank-multilingual-v3.0

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
cohere-api-key          # For reranking service
github-token
aad-client-secret
qdrant-api-key          # For managed Qdrant Cloud
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

### 6.7 JSON Schemas for Runtime Validation (AJV)

> **IMPORTANT:** These are actual JSON Schema objects for use with AJV runtime validation.
> The TypeScript interfaces above are for compile-time type checking.
> Both must be kept in sync - consider using `zod` with `zod-to-json-schema` for single source of truth.

```typescript
// packages/shared/src/schemas/json-schemas/index.ts

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Initialize AJV with common options
export const ajv = new Ajv({
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
});
addFormats(ajv);

/**
 * Gantt Chart JSON Schema - for AJV runtime validation
 */
export const GanttChartJsonSchema = {
  $id: 'GanttChart',
  type: 'object',
  required: ['title', 'timeColumns', 'data', 'legend'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1 },
    timeColumns: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    data: {
      type: 'array',
      items: { $ref: '#/$defs/GanttRow' },
    },
    legend: {
      type: 'array',
      items: { $ref: '#/$defs/LegendItem' },
    },
    researchAnalysis: { $ref: '#/$defs/ResearchAnalysis' },
  },
  $defs: {
    GanttRow: {
      type: 'object',
      required: ['title', 'isSwimlane', 'entity', 'bar'],
      properties: {
        title: { type: 'string' },
        isSwimlane: { type: 'boolean' },
        entity: { type: 'string' },
        bar: {
          oneOf: [
            { $ref: '#/$defs/GanttBar' },
            { type: 'null' },
          ],
        },
        taskType: {
          type: 'string',
          enum: ['milestone', 'decision', 'task'],
        },
      },
    },
    GanttBar: {
      type: 'object',
      required: ['startCol', 'endCol', 'color'],
      properties: {
        startCol: { type: 'integer', minimum: 0 },
        endCol: { type: 'integer', minimum: 0 },
        color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      },
    },
    LegendItem: {
      type: 'object',
      required: ['color', 'label'],
      properties: {
        color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        label: { type: 'string' },
      },
    },
    ResearchAnalysis: {
      type: 'object',
      required: ['topics', 'overallScore', 'summary'],
      properties: {
        topics: {
          type: 'array',
          items: { $ref: '#/$defs/TopicAnalysis' },
        },
        overallScore: { type: 'number', minimum: 0, maximum: 1 },
        summary: { type: 'string' },
      },
    },
    TopicAnalysis: {
      type: 'object',
      required: ['name', 'fitnessScore', 'eventDataQuality', 'datesFound'],
      properties: {
        name: { type: 'string' },
        fitnessScore: { type: 'number', minimum: 0, maximum: 1 },
        eventDataQuality: { type: 'string' },
        datesFound: { type: 'integer', minimum: 0 },
      },
    },
  },
} as const;

/**
 * Slides JSON Schema - for AJV runtime validation
 */
export const SlidesJsonSchema = {
  $id: 'Slides',
  type: 'object',
  required: ['slides'],
  properties: {
    slides: {
      type: 'array',
      items: {
        type: 'object',
        required: ['tagline', 'title', 'body'],
        properties: {
          tagline: { type: 'string', maxLength: 21 },
          title: { type: 'string' },
          body: { type: 'string', minLength: 380, maxLength: 410 },
          footer: { type: 'string' },
        },
      },
    },
  },
} as const;

/**
 * Document JSON Schema - for AJV runtime validation
 */
export const DocumentJsonSchema = {
  $id: 'Document',
  type: 'object',
  required: ['title', 'sections'],
  properties: {
    title: { type: 'string', minLength: 1 },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        required: ['heading', 'paragraphs'],
        properties: {
          heading: { type: 'string' },
          paragraphs: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

/**
 * Retrieval Filter JSON Schema - for AJV runtime validation
 */
export const RetrievalFilterJsonSchema = {
  $id: 'RetrievalFilter',
  type: 'object',
  required: ['tenant_id', 'kb_types'],
  properties: {
    tenant_id: {
      type: 'string',
      format: 'uuid',
    },
    engagement_id: {
      oneOf: [
        { type: 'string', format: 'uuid' },
        { type: 'null' },
      ],
    },
    kb_types: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['client', 'firm', 'oss'],
      },
      minItems: 1,
    },
    knowledge_base_ids: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
    },
    document_ids: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
    },
    created_after: { type: 'string', format: 'date-time' },
    created_before: { type: 'string', format: 'date-time' },
  },
  // Custom validation: engagement_id required when querying client KB
  if: {
    properties: {
      kb_types: { contains: { const: 'client' } },
    },
  },
  then: {
    required: ['tenant_id', 'kb_types', 'engagement_id'],
    properties: {
      engagement_id: { type: 'string', format: 'uuid' },
    },
  },
} as const;

// Pre-compile validators for performance
export const validateGanttChart = ajv.compile(GanttChartJsonSchema);
export const validateSlides = ajv.compile(SlidesJsonSchema);
export const validateDocument = ajv.compile(DocumentJsonSchema);
export const validateRetrievalFilter = ajv.compile(RetrievalFilterJsonSchema);

/**
 * Type-safe validation helper
 */
export function validate<T>(
  validator: ReturnType<typeof ajv.compile>,
  data: unknown
): { valid: true; data: T } | { valid: false; errors: typeof validator.errors } {
  const valid = validator(data);
  if (valid) {
    return { valid: true, data: data as T };
  }
  return { valid: false, errors: validator.errors };
}
```

### 6.8 Contract Tests with JSON Schemas

```typescript
// tests/contracts/api-schemas.test.ts

import {
  validateGanttChart,
  validateSlides,
  validateDocument,
  validateRetrievalFilter,
  GanttChartJsonSchema,
  SlidesJsonSchema,
} from '@force/shared/schemas/json-schemas';

describe('API Contract Tests', () => {
  describe('GanttChart Schema', () => {
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

      const result = validateGanttChart(validResponse);
      expect(result).toBe(true);
      expect(validateGanttChart.errors).toBeNull();
    });

    it('should reject response missing required fields', () => {
      const invalidResponse = {
        title: 'Project Roadmap',
        // Missing required fields: timeColumns, data, legend
      };

      const result = validateGanttChart(invalidResponse);
      expect(result).toBe(false);
      expect(validateGanttChart.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required' })
      );
    });

    it('should reject invalid color format', () => {
      const invalidResponse = {
        title: 'Project Roadmap',
        timeColumns: ['Q1 2024'],
        data: [{
          title: 'Task',
          isSwimlane: false,
          entity: 'Team',
          bar: { startCol: 0, endCol: 1, color: 'red' }, // Invalid: not hex
        }],
        legend: [],
      };

      const result = validateGanttChart(invalidResponse);
      expect(result).toBe(false);
    });
  });

  describe('RetrievalFilter Schema', () => {
    it('should require engagement_id when kb_types includes client', () => {
      const filterWithoutEngagement = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        kb_types: ['client', 'firm'],
        engagement_id: null,  // Should fail: client KB requires engagement_id
      };

      const result = validateRetrievalFilter(filterWithoutEngagement);
      expect(result).toBe(false);
    });

    it('should allow null engagement_id when only querying firm/oss', () => {
      const filterFirmOnly = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        kb_types: ['firm', 'oss'],
        engagement_id: null,
      };

      const result = validateRetrievalFilter(filterFirmOnly);
      expect(result).toBe(true);
    });

    it('should validate UUID format', () => {
      const invalidUuid = {
        tenant_id: 'not-a-uuid',
        kb_types: ['firm'],
      };

      const result = validateRetrievalFilter(invalidUuid);
      expect(result).toBe(false);
      expect(validateRetrievalFilter.errors).toContainEqual(
        expect.objectContaining({ keyword: 'format' })
      );
    });
  });
});
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

> **IMPORTANT:** This implementation uses MSAL.js for token acquisition. The frontend obtains
> Bearer tokens directly from Entra ID and sends them to the Container Apps backend.
> This is the canonical auth model for Container Apps (NOT SWA header passthrough).

### 11.1 Azure Static Web Apps Configuration

```json
// apps/web/staticwebapp.config.json
// NOTE: SWA is used for hosting only. Auth is handled by MSAL in the browser.

{
  "routes": [
    {
      "route": "/api/*",
      "rewrite": "https://force-api.azurecontainerapps.io/api/*"
    },
    {
      "route": "/*",
      "allowedRoles": ["anonymous"]
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "*.{css,js,svg,png,jpg,ico}"]
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://alcdn.msauth.net; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data: https:; connect-src 'self' https://force-api.azurecontainerapps.io https://login.microsoftonline.com"
  }
}
```

### 11.2 MSAL Configuration

```typescript
// apps/web/config/auth-config.ts

import { Configuration, LogLevel } from '@azure/msal-browser';

/**
 * MSAL configuration for Entra ID authentication.
 * The frontend acquires tokens and sends them as Bearer tokens to the API.
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_AD_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',  // More secure than localStorage
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: import.meta.env.DEV ? LogLevel.Info : LogLevel.Error,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error: console.error(message); break;
          case LogLevel.Warning: console.warn(message); break;
          case LogLevel.Info: console.info(message); break;
          case LogLevel.Verbose: console.debug(message); break;
        }
      },
    },
  },
};

/**
 * Scopes required for API access.
 * The API scope is registered in Entra ID app registration.
 */
export const apiScopes = {
  // Scope for Force API access
  forceApi: [`api://${import.meta.env.VITE_AZURE_AD_CLIENT_ID}/access_as_user`],
};

/**
 * Login request configuration
 */
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', ...apiScopes.forceApi],
};
```

### 11.3 Frontend Auth Service (MSAL-based)

```typescript
// apps/web/utils/auth.ts

import {
  PublicClientApplication,
  AccountInfo,
  AuthenticationResult,
  InteractionRequiredAuthError,
  SilentRequest,
} from '@azure/msal-browser';
import { msalConfig, apiScopes, loginRequest } from '../config/auth-config';

/**
 * MSAL-based authentication service.
 * Handles token acquisition, refresh, and user management.
 */
class AuthService {
  private msalInstance: PublicClientApplication;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.msalInstance = new PublicClientApplication(msalConfig);
  }

  /**
   * Initialize MSAL - must be called before any auth operations
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      await this.msalInstance.initialize();

      // Handle redirect response (if returning from login)
      const response = await this.msalInstance.handleRedirectPromise();
      if (response) {
        this.msalInstance.setActiveAccount(response.account);
      }

      // Set active account if available
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0 && !this.msalInstance.getActiveAccount()) {
        this.msalInstance.setActiveAccount(accounts[0]);
      }

      this.initialized = true;
    })();

    return this.initPromise;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.msalInstance.getActiveAccount() !== null;
  }

  /**
   * Get current user account
   */
  getUser(): AccountInfo | null {
    return this.msalInstance.getActiveAccount();
  }

  /**
   * Get user info in normalized format
   */
  getUserInfo(): { id: string; email: string; name: string } | null {
    const account = this.getUser();
    if (!account) return null;

    return {
      id: account.localAccountId,
      email: account.username,
      name: account.name || account.username,
    };
  }

  /**
   * Initiate login (redirect flow)
   */
  async login(returnUrl?: string): Promise<void> {
    await this.init();

    const request = {
      ...loginRequest,
      state: returnUrl ? JSON.stringify({ returnUrl }) : undefined,
    };

    await this.msalInstance.loginRedirect(request);
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    const account = this.getUser();
    await this.msalInstance.logoutRedirect({
      account,
      postLogoutRedirectUri: window.location.origin,
    });
  }

  /**
   * Get access token for API calls.
   * Attempts silent token acquisition first, falls back to interactive if needed.
   */
  async getAccessToken(): Promise<string> {
    await this.init();

    const account = this.getUser();
    if (!account) {
      throw new Error('No authenticated user');
    }

    const silentRequest: SilentRequest = {
      scopes: apiScopes.forceApi,
      account,
    };

    try {
      // Try silent token acquisition (uses cached token or refresh token)
      const response = await this.msalInstance.acquireTokenSilent(silentRequest);
      return response.accessToken;
    } catch (error) {
      // If silent acquisition fails, user interaction is required
      if (error instanceof InteractionRequiredAuthError) {
        // Redirect to login for re-authentication
        await this.msalInstance.acquireTokenRedirect({
          scopes: apiScopes.forceApi,
        });
        // This will redirect, so we won't reach here
        throw new Error('Redirecting to login...');
      }
      throw error;
    }
  }

  /**
   * Check if user has specific role (from token claims)
   */
  hasRole(role: string): boolean {
    const account = this.getUser();
    if (!account?.idTokenClaims) return false;

    const roles = (account.idTokenClaims as any).roles || [];
    return roles.includes(role);
  }
}

// Singleton instance
export const auth = new AuthService();

/**
 * Authenticated fetch wrapper.
 * Automatically attaches Bearer token to requests.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get fresh access token
  const token = await auth.getAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  // Handle auth errors
  if (response.status === 401) {
    // Token may be invalid, try to re-authenticate
    await auth.login(window.location.pathname);
    throw new Error('Authentication required');
  }

  if (response.status === 403) {
    throw new Error('Access denied - insufficient permissions');
  }

  return response;
}

/**
 * React hook for auth state (if using React)
 */
export function useAuth() {
  // Implementation would use useSyncExternalStore or useState/useEffect
  // to subscribe to auth state changes
  return {
    isAuthenticated: auth.isAuthenticated(),
    user: auth.getUserInfo(),
    login: auth.login.bind(auth),
    logout: auth.logout.bind(auth),
  };
}
```

### 11.4 API Token Validation (Backend)

> **NOTE:** This middleware ONLY accepts Bearer tokens. SWA header passthrough is NOT supported.
> The frontend must acquire tokens via MSAL and send them as `Authorization: Bearer <token>`.

```typescript
// apps/api/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { db } from '../db';

interface AuthConfig {
  azureTenantId: string;  // Azure AD tenant ID
  clientId: string;
  audience: string;
}

const config: AuthConfig = {
  azureTenantId: process.env.AZURE_AD_TENANT_ID!,
  clientId: process.env.AZURE_AD_CLIENT_ID!,
  audience: process.env.AZURE_AD_AUDIENCE || `api://${process.env.AZURE_AD_CLIENT_ID}`,
};

// JWKS client for key retrieval with caching
const jwks = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${config.azureTenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, key?.getPublicKey());
  });
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;           // Internal user ID (UUID)
    entraOid: string;     // Azure AD Object ID
    email: string;
    name: string;
    tenantId: string;     // App tenant ID (from DB, NOT Azure tenant)
    roles: string[];
  };
}

/**
 * Authentication middleware - validates Bearer token only.
 * NO SWA header fallback - frontend must use MSAL.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // ONLY accept Bearer tokens
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Missing or invalid Authorization header. Use: Bearer <token>',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verifyToken(token);

    // Get or create user in our DB
    const user = await getOrCreateUser({
      entraOid: payload.oid!,
      email: payload.email || payload.preferred_username!,
      name: payload.name,
    });

    (req as AuthenticatedRequest).user = user;
    next();
  } catch (err) {
    console.error('Token verification failed:', (err as Error).message);
    res.status(401).json({
      error: 'Invalid token',
      message: 'Token verification failed. Please re-authenticate.',
    });
  }
}

/**
 * Verify JWT token with proper async/await handling
 */
function verifyToken(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        audience: config.audience,
        issuer: `https://login.microsoftonline.com/${config.azureTenantId}/v2.0`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded as jwt.JwtPayload);
      }
    );
  });
}

/**
 * Get existing user or create new one on first login.
 * Handles invitation acceptance and email-based tenant assignment.
 */
async function getOrCreateUser(data: {
  entraOid: string;
  email: string;
  name?: string;
}): Promise<AuthenticatedRequest['user']> {
  // First, try to find by Entra OID (existing user)
  let user = await db.users.findByEntraOid(data.entraOid);

  if (user) {
    // Update last login and activate if pending
    await db.users.update(user.id, {
      lastLoginAt: new Date(),
      status: user.status === 'pending' ? 'active' : user.status,
    });
  } else {
    // Check for pending invitation by email
    const invitation = await db.userInvitations.findPendingByEmail(data.email);

    if (invitation) {
      // Accept invitation - create user with invited role/tenant
      user = await db.users.create({
        entraOid: data.entraOid,
        email: data.email,
        displayName: data.name,
        tenantId: invitation.tenantId,
        role: invitation.role,
        status: 'active',
      });

      // Mark invitation as accepted
      await db.userInvitations.accept(invitation.id, user.id);
    } else {
      // No invitation - use email domain for tenant assignment
      const tenantId = await getTenantForEmail(data.email);

      if (!tenantId) {
        throw new Error(`No tenant found for email domain: ${data.email}`);
      }

      user = await db.users.create({
        entraOid: data.entraOid,
        email: data.email,
        displayName: data.name,
        tenantId,
        role: 'member',
        status: 'active',
      });
    }
  }

  return {
    id: user.id,
    entraOid: user.entraOid,
    email: user.email,
    name: user.displayName || user.email,
    tenantId: user.tenantId,
    roles: [user.role],
  };
}

/**
 * Get tenant ID based on email domain.
 * Looks up tenant_domains table or uses default tenant.
 */
async function getTenantForEmail(email: string): Promise<string | null> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  // Check tenant_domains table for explicit mapping
  const tenantDomain = await db.tenantDomains.findByDomain(domain);
  if (tenantDomain) {
    return tenantDomain.tenantId;
  }

  // Fall back to default tenant if configured
  const defaultTenantId = process.env.DEFAULT_TENANT_ID;
  return defaultTenantId || null;
}
```

### 11.5 Tenant Context Middleware (RLS Enforcement)

> **CRITICAL:** This middleware sets the PostgreSQL session variable for RLS policies.
> It MUST run after authMiddleware and before any database operations.

```typescript
// apps/api/src/middleware/tenant.ts

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { db } from '../db';

/**
 * Tenant context middleware - sets RLS context for database queries.
 *
 * CRITICAL: This middleware:
 * 1. Extracts tenantId from authenticated user (server-side, NOT from request body)
 * 2. Sets PostgreSQL session variable for RLS enforcement
 * 3. Validates user has access to requested resources
 */
export async function tenantContextMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { tenantId } = req.user;

  if (!tenantId) {
    res.status(403).json({
      error: 'No tenant access',
      message: 'User is not associated with any tenant',
    });
    return;
  }

  try {
    // CRITICAL: Set RLS context for this request
    // This ensures all subsequent queries are tenant-scoped
    await db.raw(`SET LOCAL app.tenant_id = '${tenantId}'`);

    // Attach tenant context to request for convenience
    req.tenantContext = {
      tenantId,
      setAt: new Date(),
    };

    next();
  } catch (err) {
    console.error('Failed to set tenant context:', err);
    res.status(500).json({
      error: 'Internal error',
      message: 'Failed to establish tenant context',
    });
  }
}

/**
 * Validate engagement access - use in routes that operate on engagements.
 * ALWAYS validate server-side, never trust client-provided IDs.
 */
export async function validateEngagementAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const engagementId = req.params.engagementId || req.body.engagementId;

  if (!engagementId) {
    return next(); // No engagement in request, skip validation
  }

  const { tenantId } = req.user;

  // Query will be RLS-scoped, so if it returns null, user doesn't have access
  const engagement = await db.engagements.findById(engagementId);

  if (!engagement) {
    res.status(404).json({
      error: 'Not found',
      message: 'Engagement not found or access denied',
    });
    return;
  }

  // Double-check tenant matches (belt and suspenders with RLS)
  if (engagement.tenantId !== tenantId) {
    console.error(`Tenant mismatch: user=${tenantId}, engagement=${engagement.tenantId}`);
    res.status(403).json({
      error: 'Access denied',
      message: 'You do not have access to this engagement',
    });
    return;
  }

  // Attach engagement to request
  req.engagement = engagement;
  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      tenantContext?: {
        tenantId: string;
        setAt: Date;
      };
      engagement?: {
        id: string;
        tenantId: string;
        name: string;
        status: string;
      };
    }
  }
}
```

### 11.6 Route Configuration with Auth

```typescript
// apps/api/src/index.ts

import express from 'express';
import { authMiddleware } from './middleware/auth';
import { tenantContextMiddleware, validateEngagementAccess } from './middleware/tenant';
import { documentsRouter } from './routes/documents';
import { engagementsRouter } from './routes/engagements';
import { healthRouter } from './routes/health';

const app = express();

app.use(express.json());

// Health check - no auth required
app.use('/api/v1/health', healthRouter);

// Protected routes - require auth + tenant context
app.use('/api/v1',
  authMiddleware,
  tenantContextMiddleware,
  // All routes below are authenticated and tenant-scoped
);

app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/engagements', engagementsRouter);

// Routes with engagement validation
app.use('/api/v1/engagements/:engagementId',
  validateEngagementAccess,
  engagementsRouter
);
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
   * Invalidate patterns with variable substitution.
   *
   * IMPORTANT: Uses SCAN instead of KEYS to avoid blocking Redis.
   * KEYS is O(N) and blocks the server - dangerous at scale.
   */
  private async invalidatePatterns(
    patterns: string[],
    vars: Record<string, string>
  ): Promise<void> {
    for (const pattern of patterns) {
      const resolvedPattern = this.resolvePattern(pattern, vars);

      // Use SCAN for non-blocking iteration (NOT redis.keys!)
      const deletedCount = await this.scanAndDelete(resolvedPattern);

      if (deletedCount > 0) {
        console.log(`Invalidated ${deletedCount} keys matching ${resolvedPattern}`);
      }
    }

    // Publish invalidation event for distributed cache
    await this.pubsub.publish(this.config.channel, {
      patterns,
      vars,
      timestamp: Date.now(),
      nodeId: this.nodeId,
    });
  }

  /**
   * SCAN-based key deletion - non-blocking alternative to KEYS.
   *
   * SCAN is O(1) per iteration and doesn't block Redis.
   * Processes keys in batches for efficiency.
   */
  private async scanAndDelete(pattern: string): Promise<number> {
    let cursor = '0';
    let deletedCount = 0;
    const batchSize = 100;

    do {
      // SCAN returns [cursor, keys] - non-blocking iteration
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH', pattern,
        'COUNT', batchSize
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        // Delete in pipeline for efficiency
        const pipeline = this.redis.pipeline();
        for (const key of keys) {
          pipeline.del(key);
        }
        await pipeline.exec();
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    return deletedCount;
  }

  private resolvePattern(pattern: string, vars: Record<string, string>): string {
    return pattern.replace(/{(\w+)}/g, (_, key) => vars[key] || '*');
  }

  /**
   * Subscribe to invalidation events from other nodes.
   * Uses SCAN for safety.
   */
  private subscribeToInvalidations(): void {
    this.pubsub.subscribe(this.config.channel, async (message) => {
      // Only process if from another node
      if (message.nodeId !== this.nodeId) {
        for (const pattern of message.patterns) {
          const resolved = this.resolvePattern(pattern, message.vars);
          // Use SCAN, not KEYS
          await this.scanAndDelete(resolved);
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

### 15.4 Document Management (Streaming Upload)

> **IMPORTANT:** This implementation uses streaming uploads to avoid memory issues.
> Files are streamed directly to blob storage while computing hash, never held in memory.

```typescript
// apps/api/src/routes/documents.ts

import { Router } from 'express';
import { Readable, PassThrough } from 'stream';
import crypto from 'crypto';
import Busboy from 'busboy';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { objectStore } from '../adapters/storage';
import { db } from '../db';
import { jobService } from '../services/jobs';

const router = Router();

// Supported file types
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

router.use(authMiddleware);

/**
 * Upload document to knowledge base - STREAMING implementation
 *
 * Key improvements over memory-based multer:
 * - File is streamed directly to blob storage (never fully in memory)
 * - Hash computed during streaming (no second pass)
 * - Handles 50MB files with minimal memory footprint
 */
router.post(
  '/api/v1/documents/upload',
  async (req: AuthenticatedRequest, res) => {
    const { tenantId } = req.user;

    // Parse multipart form with streaming
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    });

    let knowledgeBaseId: string | undefined;
    let fileProcessed = false;

    // Handle text fields
    busboy.on('field', (name, value) => {
      if (name === 'knowledgeBaseId') {
        knowledgeBaseId = value;
      }
    });

    // Handle file stream
    busboy.on('file', async (fieldname, fileStream, { filename, mimeType }) => {
      if (fileProcessed) return;
      fileProcessed = true;

      // Validate mime type
      if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
        fileStream.resume(); // Drain stream
        return res.status(400).json({ error: `Unsupported file type: ${mimeType}` });
      }

      // Validate KB exists (may need to wait for field)
      await new Promise(resolve => setTimeout(resolve, 10)); // Brief wait for fields
      if (!knowledgeBaseId) {
        fileStream.resume();
        return res.status(400).json({ error: 'knowledgeBaseId is required' });
      }

      const kb = await db.knowledgeBases.findById(knowledgeBaseId);
      if (!kb || kb.tenantId !== tenantId) {
        fileStream.resume();
        return res.status(404).json({ error: 'Knowledge base not found' });
      }

      try {
        // Stream file to blob storage while computing hash
        const result = await streamUploadWithHash(
          fileStream,
          tenantId,
          kb.id,
          filename,
          mimeType
        );

        // Check for duplicate using computed hash
        const existing = await db.documents.findByHash(kb.id, result.fileHash);
        if (existing) {
          // Delete the uploaded blob (duplicate)
          await objectStore.delete(result.blobPath);
          return res.status(409).json({
            error: 'Document already exists',
            existingDocumentId: existing.id,
          });
        }

        // Create document record
        const document = await db.documents.create({
          knowledgeBaseId: kb.id,
          tenantId,
          filename: `${result.fileHash}_${filename}`,
          originalFilename: filename,
          mimeType,
          fileSize: result.fileSize,
          fileHash: result.fileHash,
          blobPath: result.blobPath,
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
            blobPath: result.blobPath,
            filename,
            mimeType,
          },
          priority: 1,
          createdBy: req.user.id,
        });

        res.status(202).json({
          documentId: document.id,
          jobId: job.id,
          status: 'processing',
          fileSize: result.fileSize,
        });
      } catch (error) {
        console.error('Upload failed:', error);
        res.status(500).json({ error: 'Upload failed' });
      }
    });

    busboy.on('filesLimit', () => {
      res.status(400).json({ error: 'Too many files. Only one file allowed.' });
    });

    busboy.on('error', (error) => {
      console.error('Busboy error:', error);
      res.status(500).json({ error: 'Upload processing failed' });
    });

    req.pipe(busboy);
  }
);

/**
 * Stream file to blob storage while computing SHA-256 hash.
 * This avoids holding the entire file in memory.
 */
async function streamUploadWithHash(
  fileStream: Readable,
  tenantId: string,
  kbId: string,
  filename: string,
  mimeType: string
): Promise<{ blobPath: string; fileHash: string; fileSize: number }> {
  // Create hash stream
  const hash = crypto.createHash('sha256');

  // Create passthrough to tee the stream
  const uploadStream = new PassThrough();

  let fileSize = 0;

  // Pipe through hash computation
  fileStream.on('data', (chunk: Buffer) => {
    hash.update(chunk);
    fileSize += chunk.length;
    uploadStream.write(chunk);
  });

  fileStream.on('end', () => {
    uploadStream.end();
  });

  fileStream.on('error', (err) => {
    uploadStream.destroy(err);
  });

  // Generate temporary blob path (will rename after hash computed)
  const tempId = crypto.randomUUID();
  const tempPath = `uploads/temp/${tenantId}/${tempId}`;

  // Upload stream to blob storage
  await objectStore.uploadStream(tempPath, uploadStream, {
    contentType: mimeType,
    metadata: { originalName: filename, status: 'uploading' },
  });

  // Compute final hash
  const fileHash = hash.digest('hex');

  // Move to final location
  const finalPath = `documents/${tenantId}/${kbId}/${fileHash}/${filename}`;
  await objectStore.move(tempPath, finalPath);

  return { blobPath: finalPath, fileHash, fileSize };
}
```

### 15.4.1 Extracted Text Storage Strategy

> **NOTE:** Full extracted text is stored in blob storage, NOT in Postgres.
> Only metadata and pointers are kept in the documents table.

```typescript
// apps/worker/src/processors/documentExtract.ts

/**
 * After text extraction, store the full text in blob storage.
 * Update the document record with a pointer, not the text itself.
 */
async function storeExtractedText(
  documentId: string,
  extractedText: string,
  tenantId: string
): Promise<void> {
  // Store extracted text in blob storage (compressed)
  const textBlobPath = `extracted/${tenantId}/${documentId}/text.txt.gz`;

  const compressed = await gzip(extractedText);
  await objectStore.upload(textBlobPath, compressed, {
    contentType: 'text/plain',
    contentEncoding: 'gzip',
    metadata: {
      documentId,
      extractedAt: new Date().toISOString(),
      charCount: String(extractedText.length),
    },
  });

  // Update document with pointer (NOT the text itself)
  await db.documents.update(documentId, {
    extractedTextPath: textBlobPath,
    wordCount: extractedText.split(/\s+/).length,
    status: 'extracted',
    // extracted_text column stays NULL - use blob storage
  });
}

/**
 * Retrieve extracted text when needed (for re-processing, etc.)
 */
async function getExtractedText(document: Document): Promise<string> {
  if (!document.extractedTextPath) {
    throw new Error('Document has no extracted text');
  }

  const compressed = await objectStore.download(document.extractedTextPath);
  return gunzip(compressed).toString('utf-8');
}
```

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

## 19. Security Hardening

### 19.1 Malware Scanning for Uploads

> **Enterprise requirement:** All uploaded documents must be scanned for malware
> before processing. This prevents malicious content from entering the RAG pipeline.

```typescript
// apps/api/src/services/malware-scanner.ts

import { ClamScan } from 'clamscan';
import { Readable } from 'stream';

interface ScanResult {
  isClean: boolean;
  malwareType?: string;
  scannedAt: Date;
  scanDurationMs: number;
}

/**
 * Malware scanning service using ClamAV.
 *
 * Options:
 * - Self-hosted ClamAV container (recommended for Azure)
 * - Microsoft Defender for Storage (Azure-native)
 * - Third-party API (VirusTotal, etc.)
 */
export class MalwareScanner {
  private scanner: ClamScan;

  constructor(private config: {
    host: string;       // ClamAV daemon host
    port: number;       // Default: 3310
    timeout: number;    // Scan timeout in ms
  }) {}

  async initialize(): Promise<void> {
    this.scanner = await new ClamScan().init({
      clamdscan: {
        host: this.config.host,
        port: this.config.port,
        timeout: this.config.timeout,
      },
    });
  }

  /**
   * Scan a stream for malware (during upload, before storage)
   */
  async scanStream(stream: Readable): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      const { isInfected, viruses } = await this.scanner.scanStream(stream);

      return {
        isClean: !isInfected,
        malwareType: viruses?.[0],
        scannedAt: new Date(),
        scanDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Malware scan failed:', error);
      // Fail closed - treat scan failures as infected
      return {
        isClean: false,
        malwareType: 'SCAN_ERROR',
        scannedAt: new Date(),
        scanDurationMs: Date.now() - startTime,
      };
    }
  }
}

// Environment configuration
// MALWARE_SCAN_ENABLED=true
// CLAMAV_HOST=clamav.internal
// CLAMAV_PORT=3310
// CLAMAV_TIMEOUT=60000
```

### 19.2 Private Networking (Azure)

```yaml
# infrastructure/azure/private-networking.bicep
# (Simplified - use Azure Bicep or Terraform for production)

# Virtual Network with subnets
resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' = {
  name: 'force-vnet'
  location: location
  properties:
    addressSpace:
      addressPrefixes: ['10.0.0.0/16']
    subnets:
      - name: 'container-apps'
        properties:
          addressPrefix: '10.0.1.0/24'
      - name: 'postgres'
        properties:
          addressPrefix: '10.0.2.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
      - name: 'redis'
        properties:
          addressPrefix: '10.0.3.0/24'

# Private Endpoint for Postgres
resource postgresPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-04-01' = {
  name: 'force-postgres-pe'
  properties:
    subnet: { id: vnet.properties.subnets[1].id }
    privateLinkServiceConnections:
      - name: 'postgres-connection'
        properties:
          privateLinkServiceId: postgresServer.id
          groupIds: ['postgresqlServer']

# Private DNS Zone for internal resolution
resource privateDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
```

**Egress Controls:**

```typescript
// apps/api/src/middleware/egress-control.ts

/**
 * Control which external services the API can communicate with.
 * Prevents data exfiltration to unauthorized endpoints.
 */
const ALLOWED_EGRESS_HOSTS = [
  // LLM providers
  'api.openai.com',
  'generativelanguage.googleapis.com',
  '*.openai.azure.com',

  // Reranking
  'api.cohere.ai',

  // Vector DB
  '*.qdrant.io',

  // Azure services
  '*.blob.core.windows.net',
  '*.servicebus.windows.net',
  '*.vault.azure.net',

  // Auth
  'login.microsoftonline.com',
];

// In production, use Azure Firewall or NSG rules for network-level enforcement
```

### 19.3 Prompt Injection Defenses

```typescript
// apps/worker/src/services/prompt-guard.ts

/**
 * Prompt injection defense layer.
 *
 * Strategies:
 * 1. Input validation - detect injection patterns
 * 2. Context isolation - separate user content from system prompts
 * 3. Output filtering - redact sensitive information
 */
export class PromptGuard {
  // Known injection patterns (regularly update from threat intelligence)
  private static INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
    /disregard\s+(all\s+)?instructions/i,
    /you\s+are\s+now\s+(?:a|in)\s+(?:different|new)\s+mode/i,
    /system\s*:\s*/i,
    /\[INST\]|\[\/INST\]/i,  // Llama-style markers
    /<\|im_start\|>|<\|im_end\|>/i,  // ChatML markers
    /```\s*(?:system|assistant|user)\s*\n/i,
  ];

  // Sensitive data patterns for output filtering
  private static SENSITIVE_PATTERNS = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,  // Email
    /\b\d{3}-\d{2}-\d{4}\b/g,  // SSN
    /\b\d{16}\b/g,  // Credit card
    /(?:api[_-]?key|secret|password|token)\s*[=:]\s*['\"]?[\w-]+['\"]?/gi,
  ];

  /**
   * Check input for injection attempts
   */
  static detectInjection(input: string): {
    detected: boolean;
    patterns: string[];
    riskScore: number;
  } {
    const detectedPatterns: string[] = [];

    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.source);
      }
    }

    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns,
      riskScore: Math.min(1, detectedPatterns.length * 0.3),
    };
  }

  /**
   * Sanitize user content before including in prompts.
   * Use XML-style delimiters for clear context separation.
   */
  static wrapUserContent(content: string, source: string): string {
    // Escape any XML-like tags in user content
    const escaped = content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<user_content source="${source}">\n${escaped}\n</user_content>`;
  }

  /**
   * Filter sensitive data from LLM output
   */
  static filterOutput(output: string): string {
    let filtered = output;

    for (const pattern of this.SENSITIVE_PATTERNS) {
      filtered = filtered.replace(pattern, '[REDACTED]');
    }

    return filtered;
  }
}

// Usage in RAG pipeline:
// const userQuery = PromptGuard.wrapUserContent(rawQuery, 'user_input');
// const detection = PromptGuard.detectInjection(rawQuery);
// if (detection.detected) { log and potentially reject }
```

---

## 20. Data Lifecycle & Governance

### 20.1 Retention Policies

```typescript
// packages/shared/src/governance/retention-policy.ts

interface RetentionPolicy {
  // Per-resource retention settings
  documents: {
    default: number;        // Days to retain (0 = indefinite)
    afterEngagementClose: number;  // Days after engagement archived
    minimumLegalHold: number;      // Minimum for legal compliance
  };

  generatedContent: {
    default: number;
    afterEngagementClose: number;
  };

  auditLogs: {
    default: number;        // Typically 7 years for compliance
    accessLogs: number;     // Shorter for operational logs
  };

  vectors: {
    syncWithDocuments: boolean;  // Delete vectors when doc deleted
    orphanCleanupDays: number;   // Clean orphaned vectors after N days
  };

  backups: {
    daily: number;         // Days to retain daily backups
    weekly: number;        // Weeks to retain weekly backups
    monthly: number;       // Months to retain monthly backups
  };
}

const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  documents: {
    default: 0,              // Keep indefinitely by default
    afterEngagementClose: 365,  // 1 year after engagement closes
    minimumLegalHold: 2555,     // 7 years for financial services
  },
  generatedContent: {
    default: 0,
    afterEngagementClose: 365,
  },
  auditLogs: {
    default: 2555,           // 7 years
    accessLogs: 90,          // 90 days for operational logs
  },
  vectors: {
    syncWithDocuments: true,
    orphanCleanupDays: 30,
  },
  backups: {
    daily: 7,
    weekly: 4,
    monthly: 12,
  },
};
```

### 20.2 Tenant Offboarding

```typescript
// apps/api/src/services/tenant-offboarding.ts

interface OffboardingPlan {
  tenantId: string;
  requestedAt: Date;
  requestedBy: string;
  reason: string;

  // Phases
  phases: {
    dataExport: { status: string; completedAt?: Date };
    userNotification: { status: string; completedAt?: Date };
    gracePeriod: { endsAt: Date; acknowledged: boolean };
    dataAnonymization: { status: string; completedAt?: Date };
    vectorDeletion: { status: string; completedAt?: Date };
    blobDeletion: { status: string; completedAt?: Date };
    auditRetention: { status: string; retainUntil: Date };
    finalDeletion: { status: string; completedAt?: Date };
  };
}

/**
 * Tenant offboarding service - handles data export and deletion.
 */
export class TenantOffboardingService {
  /**
   * Initiate tenant offboarding with required grace period
   */
  async initiateOffboarding(
    tenantId: string,
    requestedBy: string,
    reason: string
  ): Promise<OffboardingPlan> {
    const plan: OffboardingPlan = {
      tenantId,
      requestedAt: new Date(),
      requestedBy,
      reason,
      phases: {
        dataExport: { status: 'pending' },
        userNotification: { status: 'pending' },
        gracePeriod: {
          endsAt: addDays(new Date(), 30),  // 30-day grace period
          acknowledged: false,
        },
        dataAnonymization: { status: 'pending' },
        vectorDeletion: { status: 'pending' },
        blobDeletion: { status: 'pending' },
        auditRetention: {
          status: 'pending',
          retainUntil: addYears(new Date(), 7),  // Keep audit logs 7 years
        },
        finalDeletion: { status: 'pending' },
      },
    };

    await db.offboardingPlans.create(plan);

    // Notify tenant admins
    await this.notifyTenantAdmins(tenantId, plan);

    return plan;
  }

  /**
   * Export all tenant data to blob storage for download
   */
  async exportTenantData(tenantId: string): Promise<string> {
    const exportPath = `exports/${tenantId}/${Date.now()}/`;

    // Export documents
    const documents = await db.documents.findByTenant(tenantId);
    for (const doc of documents) {
      await this.exportDocument(doc, exportPath);
    }

    // Export generated content
    const content = await db.generatedContent.findByTenant(tenantId);
    await objectStore.upload(
      `${exportPath}generated_content.json`,
      JSON.stringify(content, null, 2)
    );

    // Export metadata
    const metadata = await this.collectTenantMetadata(tenantId);
    await objectStore.upload(
      `${exportPath}metadata.json`,
      JSON.stringify(metadata, null, 2)
    );

    return exportPath;
  }

  /**
   * Execute final deletion after grace period
   */
  async executeFinalDeletion(plan: OffboardingPlan): Promise<void> {
    const { tenantId } = plan;

    // 1. Delete vectors from Qdrant
    const kbs = await db.knowledgeBases.findByTenant(tenantId);
    for (const kb of kbs) {
      await qdrant.deleteCollection(kb.qdrantCollection);
    }

    // 2. Delete blobs
    await objectStore.deletePrefix(`documents/${tenantId}/`);
    await objectStore.deletePrefix(`extracted/${tenantId}/`);

    // 3. Anonymize PII in audit logs (don't delete - compliance)
    await db.raw(`
      UPDATE audit_logs
      SET user_id = NULL,
          details = jsonb_set(details, '{user_email}', '"[REDACTED]"')
      WHERE tenant_id = $1
    `, [tenantId]);

    // 4. Delete tenant data
    await db.transaction(async (trx) => {
      await trx('document_chunks').where({ tenantId }).delete();
      await trx('documents').where({ tenantId }).delete();
      await trx('generated_content').where({ tenantId }).delete();
      await trx('knowledge_bases').where({ tenantId }).delete();
      await trx('engagements').where({ tenantId }).delete();
      await trx('users').where({ tenantId }).delete();
      await trx('tenant_usage_limits').where({ tenantId }).delete();
      await trx('tenants').where({ id: tenantId }).delete();
    });
  }
}
```

### 20.3 Legal Hold

```typescript
// packages/shared/src/governance/legal-hold.ts

interface LegalHold {
  id: string;
  tenantId: string;
  name: string;
  reason: string;
  custodians: string[];      // User IDs under hold
  scope: {
    engagementIds?: string[];
    documentIds?: string[];
    dateRange?: { start: Date; end: Date };
    keywords?: string[];
  };
  createdAt: Date;
  createdBy: string;
  releasedAt?: Date;
  releasedBy?: string;
}

/**
 * When legal hold is active:
 * - Prevent deletion of in-scope documents
 * - Preserve all versions
 * - Disable retention policy for scope
 * - Log all access
 */
export async function checkLegalHold(
  tenantId: string,
  documentId: string
): Promise<{ isHeld: boolean; holds: LegalHold[] }> {
  const activeHolds = await db.legalHolds.findActive(tenantId);

  const applicableHolds = activeHolds.filter(hold => {
    if (hold.scope.documentIds?.includes(documentId)) return true;
    // Additional scope checks...
    return false;
  });

  return {
    isHeld: applicableHolds.length > 0,
    holds: applicableHolds,
  };
}
```

---

## 21. CI/CD & Migrations

### 21.1 Database Migration Strategy

```typescript
// packages/shared/src/migrations/migration-runner.ts

/**
 * Idempotent migration system.
 *
 * Principles:
 * - All migrations are idempotent (safe to run multiple times)
 * - Forward-only (no automatic rollbacks)
 * - Version controlled in git
 * - Tested in staging before production
 */
interface Migration {
  version: string;         // Semver: 1.0.0, 1.1.0, etc.
  name: string;            // Descriptive name
  up: () => Promise<void>; // Apply migration
  verify: () => Promise<boolean>;  // Verify migration succeeded
}

// Migration files: migrations/001_initial_schema.ts, etc.

export class MigrationRunner {
  /**
   * Run pending migrations in order
   */
  async runPendingMigrations(): Promise<void> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations(applied);

    for (const migration of pending) {
      console.log(`Running migration: ${migration.version} - ${migration.name}`);

      await db.transaction(async (trx) => {
        // Run migration
        await migration.up();

        // Verify
        const verified = await migration.verify();
        if (!verified) {
          throw new Error(`Migration verification failed: ${migration.version}`);
        }

        // Record as applied
        await trx('schema_migrations').insert({
          version: migration.version,
          name: migration.name,
          appliedAt: new Date(),
        });
      });

      console.log(`Completed: ${migration.version}`);
    }
  }

  /**
   * Verify current schema matches expected state
   */
  async verifySchema(): Promise<boolean> {
    // Check critical tables exist
    const tables = ['tenants', 'users', 'engagements', 'documents', 'document_chunks'];

    for (const table of tables) {
      const exists = await db.schema.hasTable(table);
      if (!exists) {
        console.error(`Missing table: ${table}`);
        return false;
      }
    }

    return true;
  }
}
```

### 21.2 CI/CD Pipeline

```yaml
# .github/workflows/ci-cd.yml

name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '8'

jobs:
  # ============================================
  # Lint, Type Check, Unit Tests
  # ============================================
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type Check
        run: pnpm typecheck

      - name: Unit Tests
        run: pnpm test:unit

      - name: Contract Tests
        run: pnpm test:contracts

  # ============================================
  # Integration Tests (with real services)
  # ============================================
  integration:
    runs-on: ubuntu-latest
    needs: test
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
      qdrant:
        image: qdrant/qdrant:v1.7.4
        ports:
          - 6333:6333

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4

      - run: pnpm install --frozen-lockfile

      - name: Run Migrations
        run: pnpm db:migrate
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test

      - name: Integration Tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
          QDRANT_URL: http://localhost:6333

  # ============================================
  # Build & Push Container Images
  # ============================================
  build:
    runs-on: ubuntu-latest
    needs: [test, integration]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Build and Push API
        uses: azure/docker-login@v1
        with:
          login-server: ${{ secrets.ACR_LOGIN_SERVER }}
      - run: |
          docker build -t ${{ secrets.ACR_LOGIN_SERVER }}/force-api:${{ github.sha }} ./apps/api
          docker push ${{ secrets.ACR_LOGIN_SERVER }}/force-api:${{ github.sha }}

      - name: Build and Push Worker
        run: |
          docker build -t ${{ secrets.ACR_LOGIN_SERVER }}/force-worker:${{ github.sha }} ./apps/worker
          docker push ${{ secrets.ACR_LOGIN_SERVER }}/force-worker:${{ github.sha }}

  # ============================================
  # Deploy to Staging
  # ============================================
  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
      - uses: azure/login@v1
      - name: Deploy to Container Apps (Staging)
        run: |
          az containerapp update \
            --name force-api-staging \
            --resource-group force-staging-rg \
            --image ${{ secrets.ACR_LOGIN_SERVER }}/force-api:${{ github.sha }}

  # ============================================
  # Deploy to Production (requires approval)
  # ============================================
  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - uses: azure/login@v1

      - name: Run Migrations
        run: |
          # Connect to production DB and run migrations
          az containerapp job start \
            --name force-migrate \
            --resource-group force-prod-rg

      - name: Deploy to Container Apps (Production)
        run: |
          az containerapp update \
            --name force-api \
            --resource-group force-prod-rg \
            --image ${{ secrets.ACR_LOGIN_SERVER }}/force-api:${{ github.sha }}
```

### 21.3 Secret Rotation

```typescript
// infrastructure/scripts/rotate-secrets.ts

/**
 * Secret rotation process for Key Vault secrets.
 *
 * Run periodically (e.g., monthly) or on-demand.
 */
async function rotateSecrets(): Promise<void> {
  const secretsToRotate = [
    'database-url',      // Rotate DB password
    'cohere-api-key',    // External API keys
    'github-token',
  ];

  for (const secretName of secretsToRotate) {
    console.log(`Rotating: ${secretName}`);

    // 1. Generate new secret value
    const newValue = await generateNewSecretValue(secretName);

    // 2. Create new version in Key Vault
    await keyVault.setSecret(secretName, newValue);

    // 3. Update external system (if needed)
    await updateExternalSystem(secretName, newValue);

    // 4. Trigger app restart to pick up new secret
    await triggerAppRestart();

    // 5. Verify connectivity with new secret
    await verifyConnectivity(secretName);

    console.log(`Rotated: ${secretName}`);
  }
}

// Schedule: Run via Azure Automation or GitHub Action
// Alerting: PagerDuty if rotation fails
```

---

## 22. Implementation Checklist

### Phase 1: Foundation

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
