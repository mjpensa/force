# V1 Build Specification
## Consulting-Grade Research & Proposal Generator (Azure-Ready, Portable)

**Version:** 1.0.0
**Created:** 2025-12-12
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
10. [Implementation Checklist](#10-implementation-checklist)

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

    -- Error handling
    error_message   TEXT,
    error_details   JSONB,
    retry_count     INTEGER DEFAULT 0,
    max_retries     INTEGER DEFAULT 3,

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

## 10. Implementation Checklist

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
