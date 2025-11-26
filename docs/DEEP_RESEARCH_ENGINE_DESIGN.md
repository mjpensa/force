# Deep Research Engine - Technical Design Document

## Document Information

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Draft |
| Author | System Architect |
| Last Updated | 2025-11-26 |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [System Architecture](#3-system-architecture)
4. [Core Components](#4-core-components)
5. [Data Models](#5-data-models)
6. [Agent Role Specifications](#6-agent-role-specifications)
7. [Tool Integration Layer](#7-tool-integration-layer)
8. [Context Management Strategy](#8-context-management-strategy)
9. [Source Quality & Verification](#9-source-quality--verification)
10. [Cost Management](#10-cost-management)
11. [Error Handling & Recovery](#11-error-handling--recovery)
12. [Observability & Logging](#12-observability--logging)
13. [Security Considerations](#13-security-considerations)
14. [API Specification](#14-api-specification)
15. [Implementation Phases](#15-implementation-phases)
16. [Testing Strategy](#16-testing-strategy)
17. [Risks & Mitigations](#17-risks--mitigations)
18. [Appendices](#18-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

This document specifies the architecture and implementation plan for a **Deep Research Engine** that replicates or exceeds the capabilities of commercial LLM "deep research" modes using standard API access. The system orchestrates multi-step, iterative research workflows across any LLM provider.

### 1.2 Core Concept

The engine implements a **Reason → Act → Observe → Refine** loop with five distinct phases:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEEP RESEARCH ENGINE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ PLANNING │───▶│ RESEARCH │───▶│ REFLECT  │───▶│SYNTHESTIC│          │
│  │  AGENT   │    │  AGENT   │    │  AGENT   │    │  AGENT   │          │
│  └──────────┘    └────┬─────┘    └────┬─────┘    └──────────┘          │
│                       │               │                                 │
│                       ▼               │                                 │
│                 ┌──────────┐          │                                 │
│                 │  TOOLS   │◀─────────┘                                 │
│                 │  LAYER   │     (iterate if insufficient)              │
│                 └──────────┘                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Differentiators

| Feature | Commercial Deep Research | This Engine |
|---------|-------------------------|-------------|
| Model Lock-in | Yes | No - any LLM API |
| Customizable Tools | Limited | Fully extensible |
| Source Transparency | Opaque | Full provenance chain |
| Cost Control | Fixed pricing | Granular budgets |
| Domain Specialization | Generic | Configurable per domain |

---

## 2. Goals and Non-Goals

### 2.1 Goals

| Priority | Goal | Success Criteria |
|----------|------|------------------|
| P0 | Model-agnostic orchestration | Works with Claude, GPT, Gemini, open-source |
| P0 | Iterative research with adaptive querying | System autonomously pivots based on findings |
| P0 | Source citation with verification | Every claim traceable to source URL |
| P1 | Cost-bounded execution | Hard limits enforced, never exceeded |
| P1 | Extensible tool integration | New tools addable without core changes |
| P1 | Comprehensive logging | Full audit trail for all research |
| P2 | Domain-specific optimization | Specialized prompts per research domain |
| P2 | Parallel execution | Independent sub-queries run concurrently |
| P2 | Caching and incremental updates | Avoid redundant API calls |

### 2.2 Non-Goals

| Non-Goal | Rationale |
|----------|-----------|
| Real-time streaming UI | Phase 2 enhancement, not MVP |
| Multi-user collaboration | Out of scope for v1 |
| Self-hosted LLM support | API-first design; local models can be added later |
| Automated fact-checking against databases | Complex; manual verification preferred initially |
| Multimedia research (images, video) | Text-first MVP |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Web UI    │  │  REST API   │  │     CLI     │  │   SDK/Lib   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATION LAYER                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Research Orchestrator                           │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │   │
│  │  │  Session  │ │   State   │ │   Cost    │ │  Circuit  │           │   │
│  │  │  Manager  │ │  Machine  │ │  Tracker  │ │  Breaker  │           │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             AGENT LAYER                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Planner   │  │  Researcher │  │   Critic    │  │ Synthesizer │        │
│  │    Agent    │  │    Agent    │  │    Agent    │  │    Agent    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TOOL LAYER                                     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│  │    Web    │ │    RAG    │ │  Domain   │ │   File    │ │  Database │    │
│  │  Search   │ │   Store   │ │   APIs    │ │  Parser   │ │   Query   │    │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            STORAGE LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Session   │  │   Vector    │  │    Cache    │  │    Audit    │        │
│  │    Store    │  │    Store    │  │    Store    │  │     Log     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROVIDER LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Anthropic  │  │   OpenAI    │  │   Google    │  │ Open Source │        │
│  │   Claude    │  │    GPT      │  │   Gemini    │  │   Models    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Interaction Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        RESEARCH EXECUTION FLOW                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  User Query                                                                │
│      │                                                                     │
│      ▼                                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 1. INITIALIZATION                                                   │   │
│  │    • Create session                                                 │   │
│  │    • Initialize cost tracker (set budget)                           │   │
│  │    • Load domain configuration                                      │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│      │                                                                     │
│      ▼                                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 2. PLANNING PHASE                                                   │   │
│  │    • Planner Agent decomposes query                                 │   │
│  │    • Generates 3-7 research steps                                   │   │
│  │    • Validates plan structure                                       │   │
│  │    • Estimates resource requirements                                │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│      │                                                                     │
│      ▼                                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 3. RESEARCH LOOP (max N iterations)                                 │   │
│  │    ┌─────────────────────────────────────────────────────────────┐ │   │
│  │    │ For each step (parallel where possible):                    │ │   │
│  │    │   • Route to appropriate tool(s)                            │ │   │
│  │    │   • Execute search/retrieval                                │ │   │
│  │    │   • Extract and score content                               │ │   │
│  │    │   • Research Agent analyzes results                         │ │   │
│  │    │   • Update research notes                                   │ │   │
│  │    │   • Track citations                                         │ │   │
│  │    └─────────────────────────────────────────────────────────────┘ │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│      │                                                                     │
│      ▼                                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 4. REFLECTION PHASE                                                 │   │
│  │    • Critic Agent evaluates coverage                                │   │
│  │    • Identifies gaps and contradictions                             │   │
│  │    • Scores sufficiency (1-10)                                      │   │
│  │    • If score < threshold AND budget remains:                       │   │
│  │        → Generate new queries → Return to step 3                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│      │                                                                     │
│      ▼                                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 5. SYNTHESIS PHASE                                                  │   │
│  │    • Compress research notes                                        │   │
│  │    • Synthesizer Agent generates report                             │   │
│  │    • Verify citations                                               │   │
│  │    • Editor pass (optional)                                         │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│      │                                                                     │
│      ▼                                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 6. FINALIZATION                                                     │   │
│  │    • Generate final report with citations                           │   │
│  │    • Attach provenance chain                                        │   │
│  │    • Log session metrics                                            │   │
│  │    • Return result to client                                        │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 State Machine

```
                                    ┌─────────────┐
                                    │   CREATED   │
                                    └──────┬──────┘
                                           │ initialize()
                                           ▼
                                    ┌─────────────┐
                              ┌─────│  PLANNING   │─────┐
                              │     └──────┬──────┘     │
                        error │            │ plan_ready │ timeout
                              │            ▼            │
                              │     ┌─────────────┐     │
                              │     │ RESEARCHING │◀────┼─────────────┐
                              │     └──────┬──────┘     │             │
                              │            │            │             │
                              │            ▼            │             │
                              │     ┌─────────────┐     │             │
                              │     │  REFLECTING │─────┤             │
                              │     └──────┬──────┘     │             │
                              │            │            │             │
                              │     ┌──────┴──────┐     │             │
                              │     │             │     │             │
                              │     ▼             ▼     │             │
                              │ sufficient    insufficient            │
                              │     │             │                   │
                              │     │             └───────────────────┘
                              │     ▼                   (loop back)
                              │ ┌─────────────┐
                              │ │SYNTHESIZING │
                              │ └──────┬──────┘
                              │        │
                              │        ▼
                              │ ┌─────────────┐
                              └▶│  COMPLETED  │◀── success
                                └──────┬──────┘
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
                ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                │   SUCCESS   │ │   FAILED    │ │  CANCELLED  │
                └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 4. Core Components

### 4.1 Research Orchestrator

The central coordinator managing the entire research lifecycle.

```typescript
interface ResearchOrchestrator {
  // Lifecycle
  createSession(config: ResearchConfig): Session;
  executeResearch(session: Session, query: string): Promise<ResearchResult>;
  cancelResearch(sessionId: string): void;

  // State Management
  getState(sessionId: string): ResearchState;
  transitionState(sessionId: string, event: StateEvent): void;

  // Progress
  onProgress(sessionId: string, callback: ProgressCallback): void;
  getMetrics(sessionId: string): SessionMetrics;
}
```

#### Implementation Structure

```
src/
├── orchestrator/
│   ├── ResearchOrchestrator.ts      # Main orchestrator class
│   ├── SessionManager.ts            # Session lifecycle management
│   ├── StateMachine.ts              # State transitions
│   ├── ExecutionEngine.ts           # Step execution coordinator
│   └── types.ts                     # Orchestrator types
```

### 4.2 Agent Manager

Manages the four specialized agent roles.

```typescript
interface AgentManager {
  // Agent Operations
  invokeAgent(role: AgentRole, context: AgentContext): Promise<AgentResponse>;

  // Configuration
  setModelForRole(role: AgentRole, model: ModelConfig): void;
  setPromptTemplate(role: AgentRole, template: PromptTemplate): void;

  // Agent Roles
  planner: PlannerAgent;
  researcher: ResearcherAgent;
  critic: CriticAgent;
  synthesizer: SynthesizerAgent;
}

type AgentRole = 'planner' | 'researcher' | 'critic' | 'synthesizer';
```

### 4.3 Tool Registry

Extensible registry for research tools.

```typescript
interface ToolRegistry {
  // Registration
  register(tool: ResearchTool): void;
  unregister(toolId: string): void;

  // Execution
  execute(toolId: string, params: ToolParams): Promise<ToolResult>;

  // Routing
  selectTool(query: string, context: ResearchContext): string[];

  // Built-in Tools
  webSearch: WebSearchTool;
  ragRetrieval: RAGTool;
  urlFetcher: URLFetcherTool;
  documentParser: DocumentParserTool;
}

interface ResearchTool {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  rateLimits: RateLimitConfig;
  execute(params: ToolParams): Promise<ToolResult>;
}
```

### 4.4 Memory Manager

Handles context accumulation and compression.

```typescript
interface MemoryManager {
  // Storage
  addNote(sessionId: string, note: ResearchNote): void;
  getNotes(sessionId: string, filter?: NoteFilter): ResearchNote[];

  // Compression
  compressNotes(notes: ResearchNote[], targetTokens: number): CompressedNotes;
  createHierarchy(notes: ResearchNote[]): NoteHierarchy;

  // Retrieval
  searchNotes(sessionId: string, query: string): ResearchNote[];
  getCitationsForClaim(claim: string): Citation[];
}
```

### 4.5 Cost Controller

Enforces budget constraints.

```typescript
interface CostController {
  // Budget Management
  setBudget(sessionId: string, budget: Budget): void;
  getBudgetStatus(sessionId: string): BudgetStatus;

  // Tracking
  recordUsage(sessionId: string, usage: TokenUsage): void;
  estimateCost(operation: PlannedOperation): CostEstimate;

  // Enforcement
  canProceed(sessionId: string, estimatedCost: number): boolean;
  onBudgetExceeded(callback: BudgetExceededCallback): void;
}

interface Budget {
  maxTokens: number;
  maxDollars: number;
  maxApiCalls: number;
  maxDurationMs: number;
}
```

---

## 5. Data Models

### 5.1 Core Entities

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// SESSION
// ═══════════════════════════════════════════════════════════════════════════

interface Session {
  id: string;                          // UUID
  createdAt: Date;
  updatedAt: Date;
  state: ResearchState;
  config: ResearchConfig;
  query: string;
  plan: ResearchPlan | null;
  notes: ResearchNote[];
  metrics: SessionMetrics;
  result: ResearchResult | null;
}

interface ResearchConfig {
  // Model Configuration
  models: {
    planner: ModelConfig;
    researcher: ModelConfig;
    critic: ModelConfig;
    synthesizer: ModelConfig;
  };

  // Execution Limits
  limits: {
    maxIterations: number;             // Default: 3
    maxStepsPerIteration: number;      // Default: 7
    maxSourcesPerStep: number;         // Default: 10
    sufficiencyThreshold: number;      // Default: 7 (out of 10)
  };

  // Budget
  budget: Budget;

  // Tool Configuration
  tools: {
    enabled: string[];                 // Tool IDs to use
    preferences: Record<string, any>;  // Tool-specific settings
  };

  // Domain Settings
  domain?: DomainConfig;

  // Output Settings
  output: {
    format: 'markdown' | 'html' | 'json';
    includeCitations: boolean;
    includeProvenance: boolean;
    maxLength?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH PLAN
// ═══════════════════════════════════════════════════════════════════════════

interface ResearchPlan {
  id: string;
  createdAt: Date;
  goals: string[];                     // Clarified objectives
  constraints: PlanConstraints;
  steps: ResearchStep[];
  estimatedCost: CostEstimate;
}

interface ResearchStep {
  id: string;                          // e.g., "S1", "R2_1" (refinement)
  description: string;
  searchQueries: string[];
  targetTools: string[];               // Preferred tools for this step
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];              // Step IDs this depends on
  status: StepStatus;
  results: StepResult | null;
}

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

interface StepResult {
  sources: Source[];
  analysis: string;
  keyFindings: string[];
  gaps: string[];
  tokensUsed: number;
  duration: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCES & CITATIONS
// ═══════════════════════════════════════════════════════════════════════════

interface Source {
  id: string;
  url: string;
  title: string;
  snippet: string;                     // Original snippet from search
  fullContent?: string;                // Fetched content (if retrieved)
  fetchedAt?: Date;

  // Quality Metrics
  quality: SourceQuality;

  // Metadata
  domain: string;
  publishedDate?: Date;
  author?: string;
  sourceType: SourceType;
}

interface SourceQuality {
  credibilityScore: number;            // 0-1
  relevanceScore: number;              // 0-1
  recencyScore: number;                // 0-1
  overallScore: number;                // Weighted combination
  flags: QualityFlag[];
}

type SourceType =
  | 'academic'                         // .edu, journals, arxiv
  | 'news'                             // Major news outlets
  | 'official'                         // Government, organization sites
  | 'reference'                        // Wikipedia, encyclopedias
  | 'blog'                             // Personal blogs, medium
  | 'forum'                            // Reddit, Stack Overflow
  | 'commercial'                       // Company sites
  | 'unknown';

type QualityFlag =
  | 'outdated'                         // > 2 years old for fast-moving topics
  | 'single_source'                    // Claim not corroborated
  | 'potential_bias'                   // Known biased source
  | 'low_authority'                    // Unknown/low-reputation domain
  | 'paywalled'                        // Content behind paywall
  | 'machine_generated';               // Detected AI content

interface Citation {
  id: string;
  sourceId: string;
  claim: string;                       // The claim being cited
  quote: string;                       // Supporting quote from source
  location?: string;                   // Section/paragraph reference
  verified: boolean;                   // Has been verified against source
}

// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH NOTES
// ═══════════════════════════════════════════════════════════════════════════

interface ResearchNote {
  id: string;
  stepId: string;
  createdAt: Date;

  // Content
  summary: string;
  keyPoints: string[];
  citations: Citation[];

  // Metadata
  tokensUsed: number;
  sourceCount: number;

  // Quality
  confidence: 'high' | 'medium' | 'low';
  contradictions: Contradiction[];
}

interface Contradiction {
  claim1: string;
  source1Id: string;
  claim2: string;
  source2Id: string;
  resolution?: string;                 // How was this resolved
}

// ═══════════════════════════════════════════════════════════════════════════
// REFLECTION & EVALUATION
// ═══════════════════════════════════════════════════════════════════════════

interface ReflectionResult {
  sufficient: boolean;
  sufficiencyScore: number;            // 1-10
  coverage: CoverageAssessment;
  gaps: Gap[];
  contradictions: Contradiction[];
  newQueries: string[];                // Suggested follow-up queries
  recommendation: 'proceed' | 'iterate' | 'stop';
}

interface CoverageAssessment {
  topicsAddressed: string[];
  topicsMissing: string[];
  perspectivesCovered: string[];
  perspectivesMissing: string[];
  temporalCoverage: string;            // e.g., "2020-2024"
  geographicCoverage: string[];
}

interface Gap {
  description: string;
  severity: 'critical' | 'important' | 'minor';
  suggestedQuery: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// FINAL RESULT
// ═══════════════════════════════════════════════════════════════════════════

interface ResearchResult {
  id: string;
  sessionId: string;
  completedAt: Date;

  // Content
  report: string;                      // Final synthesized report
  sections: ReportSection[];
  citations: Citation[];

  // Metadata
  confidence: number;                  // Overall confidence 0-1
  limitations: string[];
  suggestedFollowUp: string[];

  // Metrics
  metrics: ResultMetrics;

  // Provenance
  provenance: ProvenanceChain;
}

interface ReportSection {
  title: string;
  content: string;
  citations: string[];                 // Citation IDs
}

interface ResultMetrics {
  totalSources: number;
  uniqueDomains: number;
  tokensUsed: number;
  apiCalls: number;
  totalCost: number;
  duration: number;
  iterations: number;
}

interface ProvenanceChain {
  query: string;
  plan: ResearchPlan;
  iterations: IterationRecord[];
  finalSynthesis: SynthesisRecord;
}

interface IterationRecord {
  iteration: number;
  steps: StepRecord[];
  reflection: ReflectionResult;
}

interface StepRecord {
  stepId: string;
  queries: string[];
  toolsUsed: string[];
  sourcesFound: number;
  sourcesUsed: number;
  tokensUsed: number;
  timestamp: Date;
}
```

### 5.2 Configuration Models

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// MODEL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'custom';
  model: string;                       // e.g., "claude-sonnet-4-20250514"
  temperature: number;
  maxTokens: number;

  // Provider-specific
  apiKey?: string;                     // Or use env var
  baseUrl?: string;                    // For custom endpoints

  // Retry settings
  retryConfig: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface DomainConfig {
  domain: string;                      // e.g., "medical", "legal", "technical"

  // Source preferences
  preferredSources: string[];          // Domains to prioritize
  blockedSources: string[];            // Domains to exclude

  // Search modifications
  searchSuffixes: string[];            // Added to all queries
  dateRange?: DateRange;               // Restrict to date range

  // Prompt customization
  systemPromptAdditions: string;
  terminologyGuidance: string;

  // Quality thresholds
  minSourceQuality: number;
  requirePeerReview: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════

interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
  tokensPerMinute: number;
  concurrentRequests: number;
}
```

---

## 6. Agent Role Specifications

### 6.1 Planner Agent

**Purpose**: Decompose user queries into structured research plans.

```typescript
interface PlannerAgent {
  generatePlan(query: string, context: PlannerContext): Promise<ResearchPlan>;
  validatePlan(plan: ResearchPlan): ValidationResult;
  refinePlan(plan: ResearchPlan, feedback: string): Promise<ResearchPlan>;
}
```

#### System Prompt Template

```markdown
You are a Research Planner. Your role is to decompose complex research
questions into structured, actionable research plans.

## Your Responsibilities
1. Clarify the user's research goals
2. Identify 3-7 concrete research steps
3. For each step, provide specific search queries
4. Estimate which tools are most appropriate
5. Identify dependencies between steps
6. Flag any constraints or limitations

## Output Format
You MUST respond with valid JSON matching this schema:
{
  "goals": ["Primary goal", "Secondary goal"],
  "constraints": {
    "timeframe": "relevant time period",
    "scope": "geographic/topical scope",
    "excludes": ["topics to avoid"]
  },
  "steps": [
    {
      "id": "S1",
      "description": "What this step investigates",
      "searchQueries": ["query 1", "query 2"],
      "targetTools": ["web_search", "rag"],
      "priority": "high|medium|low",
      "dependencies": []
    }
  ]
}

## Guidelines
- Prefer SPECIFIC queries over broad ones
- Include multiple query variations for important topics
- Consider different perspectives (pro/con, regional, temporal)
- Limit to 7 steps maximum; use fewer for simple queries
- Flag if the query is ambiguous and needs clarification
```

#### Validation Rules

| Rule | Check | Action if Failed |
|------|-------|------------------|
| Step count | 1-7 steps | Reject, request refinement |
| Query specificity | No single-word queries | Reject, request refinement |
| Circular dependencies | No cycles in dependency graph | Reject |
| Resource estimate | Within 80% of budget | Warn user, request approval |

### 6.2 Researcher Agent

**Purpose**: Analyze tool results and extract relevant information.

```typescript
interface ResearcherAgent {
  analyzeResults(
    step: ResearchStep,
    results: ToolResult[],
    context: ResearchContext
  ): Promise<ResearchNote>;

  extractKeyFindings(content: string, query: string): KeyFinding[];
  identifyGaps(note: ResearchNote, step: ResearchStep): string[];
}
```

#### System Prompt Template

```markdown
You are a Research Analyst. Your role is to extract meaningful insights
from raw search results and documents.

## Your Responsibilities
1. Read and understand the raw results provided
2. Extract key findings relevant to the research question
3. Note the source for each finding (for citation)
4. Identify what's still missing or unclear
5. Flag any contradictions or inconsistencies

## Output Format
You MUST respond with valid JSON matching this schema:
{
  "summary": "2-3 sentence summary of findings",
  "keyPoints": [
    {
      "point": "The key finding",
      "sourceId": "source_id_from_input",
      "quote": "exact quote supporting this",
      "confidence": "high|medium|low"
    }
  ],
  "gaps": ["What's still unknown", "What needs deeper investigation"],
  "contradictions": [
    {
      "claim1": "Source A says X",
      "claim2": "Source B says Y",
      "sourceIds": ["id1", "id2"]
    }
  ]
}

## Guidelines
- Be SKEPTICAL - don't accept claims without evidence
- Note when sources disagree
- Prefer recent sources for fast-moving topics
- Flag if sources seem biased or low-quality
- Extract EXACT quotes for citations
```

### 6.3 Critic Agent

**Purpose**: Evaluate research sufficiency and identify gaps.

```typescript
interface CriticAgent {
  evaluate(
    notes: ResearchNote[],
    query: string,
    plan: ResearchPlan
  ): Promise<ReflectionResult>;

  suggestNewQueries(gaps: Gap[]): string[];
}
```

#### System Prompt Template

```markdown
You are a Research Critic. Your role is to evaluate whether the research
collected so far adequately answers the original question.

## Your Responsibilities
1. Assess coverage of the original research goals
2. Identify critical gaps in the research
3. Flag contradictions that need resolution
4. Score the overall sufficiency (1-10)
5. Recommend whether to continue researching or proceed to synthesis

## Scoring Guidelines
- 1-3: Major gaps, research is insufficient
- 4-5: Significant gaps remain, more research recommended
- 6-7: Adequate for most purposes, minor gaps
- 8-9: Comprehensive coverage, ready for synthesis
- 10: Exhaustive research, nothing more to add

## Output Format
You MUST respond with valid JSON matching this schema:
{
  "sufficient": true|false,
  "sufficiencyScore": 7,
  "coverage": {
    "topicsAddressed": ["topic1", "topic2"],
    "topicsMissing": ["topic3"],
    "perspectivesCovered": ["perspective1"],
    "perspectivesMissing": ["alternative view"]
  },
  "gaps": [
    {
      "description": "What's missing",
      "severity": "critical|important|minor",
      "suggestedQuery": "search query to fill gap"
    }
  ],
  "contradictions": [...],
  "newQueries": ["query1", "query2"],
  "recommendation": "proceed|iterate|stop",
  "reasoning": "Explanation of assessment"
}

## Guidelines
- Be RIGOROUS - don't pass insufficient research
- Consider: Would an expert find this adequate?
- "Stop" only if budget exhausted or diminishing returns
- Suggest SPECIFIC queries, not vague directions
```

### 6.4 Synthesizer Agent

**Purpose**: Generate the final research report.

```typescript
interface SynthesizerAgent {
  synthesize(
    notes: CompressedNotes,
    query: string,
    config: OutputConfig
  ): Promise<ResearchReport>;

  editReport(report: ResearchReport, feedback: string): Promise<ResearchReport>;
}
```

#### System Prompt Template

```markdown
You are a Research Synthesizer. Your role is to create a comprehensive,
well-structured report from research notes.

## Your Responsibilities
1. Organize findings into coherent themes/sections
2. Present balanced perspectives where sources disagree
3. Cite sources for all claims using [n] notation
4. Acknowledge limitations and uncertainties
5. Suggest areas for further research

## Output Structure
1. **Executive Summary** (2-3 paragraphs)
2. **Key Findings** (organized by theme)
3. **Detailed Analysis** (main body)
4. **Limitations & Caveats**
5. **Suggested Next Steps**
6. **References** (numbered list)

## Citation Rules
- Every factual claim MUST have a citation [n]
- Use the source IDs provided in the research notes
- If sources conflict, present both: "Source A claims X [1], while Source B suggests Y [2]"
- Do NOT invent or hallucinate citations

## Guidelines
- Write for an educated general audience unless domain-specific
- Prefer clarity over jargon
- Be explicit about confidence levels
- Do NOT overstate conclusions
- If evidence is weak, say so
```

---

## 7. Tool Integration Layer

### 7.1 Tool Interface

```typescript
interface ResearchTool {
  // Metadata
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;

  // Capabilities
  readonly capabilities: ToolCapability[];
  readonly supportedDomains: string[];      // Empty = all domains

  // Rate Limiting
  readonly rateLimits: RateLimitConfig;

  // Execution
  execute(params: ToolParams): Promise<ToolResult>;

  // Health
  healthCheck(): Promise<HealthStatus>;
}

type ToolCapability =
  | 'web_search'
  | 'url_fetch'
  | 'document_parse'
  | 'vector_search'
  | 'api_query'
  | 'database_query';

interface ToolParams {
  query: string;
  options?: Record<string, any>;
  timeout?: number;
}

interface ToolResult {
  success: boolean;
  sources: Source[];
  rawContent?: string;
  error?: ToolError;
  metadata: {
    tokensUsed?: number;
    latencyMs: number;
    cached: boolean;
  };
}
```

### 7.2 Built-in Tools

#### 7.2.1 Web Search Tool

```typescript
interface WebSearchTool extends ResearchTool {
  id: 'web_search';

  execute(params: WebSearchParams): Promise<WebSearchResult>;
}

interface WebSearchParams extends ToolParams {
  options?: {
    maxResults?: number;               // Default: 10
    dateRange?: DateRange;
    domains?: string[];                // Include only these
    excludeDomains?: string[];         // Exclude these
    region?: string;                   // Geographic focus
    safeSearch?: boolean;
  };
}

interface WebSearchResult extends ToolResult {
  sources: WebSource[];
  totalResults: number;
  searchEngine: string;
}
```

**Implementation Notes:**
- Primary: Bing Web Search API or Google Custom Search
- Fallback: SerpAPI, Brave Search API
- Rate limit handling with exponential backoff
- Result deduplication across queries

#### 7.2.2 URL Fetcher Tool

```typescript
interface URLFetcherTool extends ResearchTool {
  id: 'url_fetcher';

  execute(params: URLFetchParams): Promise<URLFetchResult>;
}

interface URLFetchParams extends ToolParams {
  query: string;                       // URL to fetch
  options?: {
    renderJavascript?: boolean;        // Use headless browser
    extractMainContent?: boolean;      // Remove boilerplate
    maxLength?: number;                // Truncate content
    timeout?: number;
  };
}
```

**Implementation Notes:**
- Primary: Direct HTTP fetch with cheerio parsing
- JS rendering: Puppeteer/Playwright for SPAs
- Content extraction: mozilla/readability
- Handle paywalls gracefully (return partial content)
- Respect robots.txt

#### 7.2.3 RAG Tool

```typescript
interface RAGTool extends ResearchTool {
  id: 'rag_retrieval';

  // Index management
  addDocuments(documents: Document[]): Promise<void>;
  removeDocuments(documentIds: string[]): Promise<void>;

  execute(params: RAGParams): Promise<RAGResult>;
}

interface RAGParams extends ToolParams {
  options?: {
    topK?: number;                     // Default: 5
    minSimilarity?: number;            // Default: 0.7
    filters?: Record<string, any>;     // Metadata filters
    collections?: string[];            // Search specific collections
  };
}
```

**Implementation Notes:**
- Vector store: pgvector, Pinecone, or Weaviate
- Embedding model: OpenAI ada-002 or Cohere embed
- Chunk size: 512 tokens with 50 token overlap
- Hybrid search: combine vector + keyword (BM25)

#### 7.2.4 Domain API Tool

```typescript
interface DomainAPITool extends ResearchTool {
  id: 'domain_api';

  // Supported APIs
  readonly supportedAPIs: APIConfig[];

  execute(params: DomainAPIParams): Promise<DomainAPIResult>;
}

interface APIConfig {
  name: string;
  baseUrl: string;
  authType: 'api_key' | 'oauth' | 'none';
  endpoints: EndpointConfig[];
}
```

**Example Domain APIs:**
| Domain | APIs |
|--------|------|
| Academic | Semantic Scholar, arXiv, PubMed |
| Finance | Yahoo Finance, FRED, Alpha Vantage |
| Legal | CourtListener, Congress.gov |
| Technical | GitHub API, npm registry |
| News | NewsAPI, GDELT |

### 7.3 Tool Router

```typescript
interface ToolRouter {
  // Route query to appropriate tools
  route(
    query: string,
    step: ResearchStep,
    context: ResearchContext
  ): ToolRoutingDecision;

  // Execute with routing
  executeWithRouting(
    query: string,
    step: ResearchStep,
    context: ResearchContext
  ): Promise<ToolResult[]>;
}

interface ToolRoutingDecision {
  primaryTool: string;
  fallbackTools: string[];
  parallelTools: string[];             // Run in parallel with primary
  reasoning: string;
}
```

**Routing Logic:**

```
┌─────────────────────────────────────────────────────────────────┐
│                      TOOL ROUTING LOGIC                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Query Type Detection                                           │
│      │                                                          │
│      ├─► Contains URL? ──────────────► url_fetcher             │
│      │                                                          │
│      ├─► Domain-specific keywords? ──► domain_api + web_search │
│      │   (e.g., "arxiv", "SEC filing")                         │
│      │                                                          │
│      ├─► Internal knowledge query? ──► rag_retrieval           │
│      │   (references uploaded docs)                             │
│      │                                                          │
│      └─► General query ─────────────► web_search               │
│                                                                 │
│  Parallel Execution Rules                                       │
│      • Web search + RAG for questions with internal context    │
│      • Multiple domain APIs for cross-domain queries           │
│      • Never parallel: url_fetcher (sequential for same domain)│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Context Management Strategy

### 8.1 The Context Problem

LLMs have finite context windows. A deep research session can easily generate 100k+ tokens of raw content. We need strategies to:

1. **Preserve essential information** for synthesis
2. **Maintain citation integrity** through compression
3. **Enable retrieval** of details on demand

### 8.2 Hierarchical Memory Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MEMORY HIERARCHY                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Level 1: RAW CONTENT (Full Storage)                                   │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ • Full text of all fetched URLs                                   │ │
│  │ • Complete search result snippets                                 │ │
│  │ • All tool responses                                              │ │
│  │ • Storage: Database/files, NOT in LLM context                     │ │
│  │ • Retention: Session duration + configurable archive              │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                           │                                             │
│                           ▼ Summarize per source                        │
│                                                                         │
│  Level 2: SOURCE SUMMARIES (~500 tokens each)                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ • Key points from each source                                     │ │
│  │ • Preserved quotes for citations                                  │ │
│  │ • Quality scores and metadata                                     │ │
│  │ • Storage: Session store, selectively in context                  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                           │                                             │
│                           ▼ Aggregate per step                          │
│                                                                         │
│  Level 3: STEP NOTES (~1000 tokens each)                               │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ • Synthesized findings per research step                          │ │
│  │ • Cross-source analysis                                           │ │
│  │ • Contradiction notes                                             │ │
│  │ • Storage: Always in context for reflection                       │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                           │                                             │
│                           ▼ Compress for synthesis                      │
│                                                                         │
│  Level 4: RESEARCH BRIEF (~3000 tokens total)                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ • Executive summary of all research                               │ │
│  │ • Key facts organized by theme                                    │ │
│  │ • Citation index (claim → source mapping)                         │ │
│  │ • Storage: Primary input to synthesis                             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Compression Strategies

#### 8.3.1 Source-Level Compression

```typescript
interface SourceCompressor {
  compress(source: Source, targetTokens: number): CompressedSource;
}

// Implementation approach:
// 1. Extract key sentences using extractive summarization
// 2. Preserve sentences containing key terms from query
// 3. Always preserve: title, URL, date, author
// 4. Always preserve: exact quotes used in citations
```

#### 8.3.2 Step-Level Aggregation

```typescript
interface StepAggregator {
  aggregate(
    sources: CompressedSource[],
    step: ResearchStep
  ): ResearchNote;
}

// Implementation approach:
// 1. Cluster sources by sub-topic
// 2. Identify consensus vs. disagreement
// 3. Rank findings by relevance to step goal
// 4. Preserve top findings with citations
```

#### 8.3.3 Global Compression for Synthesis

```typescript
interface GlobalCompressor {
  createBrief(
    notes: ResearchNote[],
    query: string,
    targetTokens: number
  ): ResearchBrief;
}

interface ResearchBrief {
  executiveSummary: string;           // ~500 tokens
  thematicFindings: ThemeFinding[];   // ~1500 tokens
  citationIndex: CitationIndex;       // ~500 tokens
  openQuestions: string[];            // ~200 tokens
}
```

### 8.4 Citation Preservation

**Critical**: Citations must survive compression intact.

```typescript
interface CitationIndex {
  // Maps claim ID to source chain
  claims: Map<string, ClaimRecord>;
}

interface ClaimRecord {
  claimId: string;
  claimText: string;
  sourceId: string;
  quote: string;                       // NEVER compressed
  location: string;                    // Where in source
  verified: boolean;
}

// During compression, claims are replaced with IDs:
// Original: "The market grew 15% in 2024 [source: Bloomberg]"
// Compressed: "The market grew 15% in 2024 [C1]"
// Index: C1 → { quote: "...", sourceId: "bloomberg_123", ... }
```

### 8.5 On-Demand Retrieval

For synthesis, the agent can request full source content:

```typescript
interface ContextRetriever {
  // Get full content for specific source
  getSourceContent(sourceId: string): string;

  // Search across all raw content
  searchContent(query: string, topK: number): ContentMatch[];

  // Get all quotes for a claim
  getClaimEvidence(claimId: string): Evidence[];
}
```

---

## 9. Source Quality & Verification

### 9.1 Quality Scoring Framework

```typescript
interface SourceQualityScorer {
  score(source: Source, context: ResearchContext): SourceQuality;
}

interface SourceQuality {
  credibilityScore: number;            // 0-1
  relevanceScore: number;              // 0-1
  recencyScore: number;                // 0-1
  corroborationScore: number;          // 0-1
  overallScore: number;
  flags: QualityFlag[];
}
```

### 9.2 Credibility Scoring

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CREDIBILITY SCORING MATRIX                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Domain Authority (40% weight)                                          │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Score │ Domain Type                                                ││
│  │───────│────────────────────────────────────────────────────────────││
│  │  1.0  │ .gov, .edu, major research institutions                    ││
│  │  0.9  │ Peer-reviewed journals, established news (NYT, BBC)        ││
│  │  0.8  │ Wikipedia, established encyclopedias                       ││
│  │  0.7  │ Industry publications, major tech blogs                    ││
│  │  0.6  │ Company official sites (for their own data)                ││
│  │  0.5  │ Medium, Substack (verified authors)                        ││
│  │  0.4  │ Forums (Stack Overflow, Reddit - with high scores)         ││
│  │  0.3  │ Personal blogs, unknown sources                            ││
│  │  0.1  │ Known misinformation sources                               ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Author Authority (20% weight)                                          │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ • Named expert in field: +0.3                                      ││
│  │ • Institutional affiliation: +0.2                                  ││
│  │ • Verified account/byline: +0.1                                    ││
│  │ • Anonymous/unknown: +0.0                                          ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Content Signals (20% weight)                                           │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ • Contains citations/references: +0.2                              ││
│  │ • Data/statistics with sources: +0.2                               ││
│  │ • Balanced perspective: +0.1                                       ││
│  │ • Sensationalist language: -0.2                                    ││
│  │ • No sources cited: -0.1                                           ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  External Validation (20% weight)                                       │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ • Cited by other credible sources: +0.3                            ││
│  │ • Fact-checked (Snopes, PolitiFact): +0.2                          ││
│  │ • Contradicted by credible sources: -0.3                           ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Recency Scoring

```typescript
function calculateRecencyScore(
  publishedDate: Date | null,
  topic: TopicClassification
): number {
  if (!publishedDate) return 0.5;      // Unknown date

  const ageInDays = daysSince(publishedDate);
  const decay = TOPIC_DECAY_RATES[topic.category];

  // Exponential decay based on topic type
  // Fast-moving topics (tech, news): decay = 0.01 (halves every 70 days)
  // Stable topics (history, science): decay = 0.001 (halves every 700 days)
  return Math.exp(-decay * ageInDays);
}

const TOPIC_DECAY_RATES = {
  'current_events': 0.02,              // Very fast decay
  'technology': 0.01,
  'business': 0.008,
  'science': 0.002,
  'history': 0.0005,                   // Very slow decay
  'reference': 0.001
};
```

### 9.4 Cross-Source Verification

```typescript
interface CrossSourceVerifier {
  // Check if claim appears in multiple sources
  verifyClaim(
    claim: string,
    sources: Source[]
  ): VerificationResult;
}

interface VerificationResult {
  claimId: string;
  status: 'verified' | 'unverified' | 'contradicted';
  supportingSources: string[];
  contradictingSources: string[];
  confidence: number;
}

// Verification rules:
// - "verified": 2+ independent credible sources agree
// - "contradicted": credible source explicitly disagrees
// - "unverified": single source only
```

### 9.5 Quality Enforcement

```typescript
interface QualityEnforcer {
  // Filter sources below threshold
  filterByQuality(
    sources: Source[],
    minScore: number
  ): Source[];

  // Flag issues in research notes
  flagQualityIssues(note: ResearchNote): QualityIssue[];

  // Add warnings to final report
  generateQualityWarnings(result: ResearchResult): string[];
}

// Example warnings:
// - "3 claims rely on a single source and could not be independently verified"
// - "Source X (used for 5 claims) has a credibility score of 0.4"
// - "Information about Y is from 2019 and may be outdated"
```

---

## 10. Cost Management

### 10.1 Cost Model

```typescript
interface CostModel {
  // Estimate cost before execution
  estimate(operation: PlannedOperation): CostEstimate;

  // Record actual cost after execution
  record(operation: CompletedOperation): void;

  // Get current session cost
  getSessionCost(sessionId: string): CostSummary;
}

interface CostEstimate {
  tokensInput: number;
  tokensOutput: number;
  estimatedDollars: number;
  confidence: 'high' | 'medium' | 'low';
  breakdown: CostBreakdown;
}

interface CostBreakdown {
  planning: number;
  research: number;
  reflection: number;
  synthesis: number;
  toolCalls: number;
}
```

### 10.2 Token Cost Reference

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TOKEN COST REFERENCE (as of 2024)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Model                    │ Input $/1M │ Output $/1M │ Context Window  │
│  ─────────────────────────│────────────│─────────────│─────────────────│
│  Claude Opus 4            │   $15.00   │   $75.00    │    200K         │
│  Claude Sonnet 4          │    $3.00   │   $15.00    │    200K         │
│  Claude Haiku             │    $0.25   │    $1.25    │    200K         │
│  GPT-4o                   │    $2.50   │   $10.00    │    128K         │
│  GPT-4o-mini              │    $0.15   │    $0.60    │    128K         │
│  Gemini 1.5 Pro           │    $1.25   │    $5.00    │   1000K         │
│  Gemini 1.5 Flash         │    $0.075  │    $0.30    │   1000K         │
│                                                                         │
│  Tool Costs (typical)     │                                             │
│  ─────────────────────────│────────────────────────────────────────────│
│  Web Search (Bing)        │ $0.005 per query                           │
│  Web Search (Google)      │ $0.005 per query                           │
│  URL Fetch                │ Free (compute cost only)                   │
│  RAG Retrieval            │ ~$0.0001 per query (embedding cost)        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Budget Enforcement

```typescript
interface BudgetEnforcer {
  // Check before operation
  canProceed(
    sessionId: string,
    estimatedCost: CostEstimate
  ): BudgetDecision;

  // Hard stop if exceeded
  enforceLimits(sessionId: string): void;
}

interface BudgetDecision {
  allowed: boolean;
  remainingBudget: Budget;
  warnings: string[];
  recommendation: 'proceed' | 'reduce_scope' | 'stop';
}

// Enforcement rules:
// 1. Hard cap: NEVER exceed maxDollars
// 2. Soft warning at 80% of budget
// 3. Automatic scope reduction at 90%
// 4. Emergency stop at 100%
```

### 10.4 Cost Optimization Strategies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COST OPTIMIZATION STRATEGIES                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. MODEL TIERING                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Role            │ Recommended Model  │ Rationale                   ││
│  │─────────────────│────────────────────│─────────────────────────────││
│  │ Planner         │ Haiku / GPT-4o-mini│ Structured output, simple   ││
│  │ Researcher      │ Sonnet / GPT-4o    │ Comprehension, extraction   ││
│  │ Critic          │ Haiku / GPT-4o-mini│ Checklist evaluation        ││
│  │ Synthesizer     │ Sonnet / Opus      │ Complex writing             ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  2. CACHING                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ • Cache search results for 15 minutes (same query)                 ││
│  │ • Cache URL content for 1 hour (same URL)                          ││
│  │ • Cache embeddings indefinitely (content-addressed)                ││
│  │ • Use prompt caching where available (Claude, GPT)                 ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  3. EARLY STOPPING                                                      │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ • Stop if sufficiency score >= 8 after first iteration             ││
│  │ • Stop if no new information in consecutive steps                  ││
│  │ • Stop if remaining budget < estimated iteration cost              ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  4. SCOPE REDUCTION                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ When budget is tight:                                              ││
│  │ • Reduce maxStepsPerIteration                                      ││
│  │ • Reduce maxSourcesPerStep                                         ││
│  │ • Skip low-priority steps                                          ││
│  │ • Use smaller model for all roles                                  ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.5 Typical Cost Scenarios

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     TYPICAL COST SCENARIOS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Scenario: Simple Question (1 iteration, 3 steps)                       │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Component          │ Tokens    │ Cost (Sonnet)                     ││
│  │────────────────────│───────────│───────────────────────────────────││
│  │ Planning           │ 1K in/out │ $0.018                            ││
│  │ Research (3 steps) │ 15K/3K    │ $0.090                            ││
│  │ Reflection         │ 5K/1K     │ $0.030                            ││
│  │ Synthesis          │ 8K/2K     │ $0.054                            ││
│  │ Tool calls (5)     │ -         │ $0.025                            ││
│  │────────────────────│───────────│───────────────────────────────────││
│  │ TOTAL              │ ~30K      │ ~$0.22                            ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Scenario: Complex Research (3 iterations, 5 steps each)                │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Component          │ Tokens    │ Cost (Sonnet)                     ││
│  │────────────────────│───────────│───────────────────────────────────││
│  │ Planning           │ 2K in/out │ $0.036                            ││
│  │ Research (15 steps)│ 75K/15K   │ $0.450                            ││
│  │ Reflection (3x)    │ 20K/3K    │ $0.105                            ││
│  │ Synthesis          │ 15K/4K    │ $0.105                            ││
│  │ Tool calls (25)    │ -         │ $0.125                            ││
│  │────────────────────│───────────│───────────────────────────────────││
│  │ TOTAL              │ ~135K     │ ~$0.82                            ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Scenario: Deep Dive with Opus (2 iterations, 7 steps each)             │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Component          │ Tokens    │ Cost (Opus)                       ││
│  │────────────────────│───────────│───────────────────────────────────││
│  │ All LLM calls      │ ~100K     │ ~$6.00                            ││
│  │ Tool calls (20)    │ -         │ $0.10                             ││
│  │────────────────────│───────────│───────────────────────────────────││
│  │ TOTAL              │ ~100K     │ ~$6.10                            ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Error Handling & Recovery

### 11.1 Error Taxonomy

```typescript
type ResearchError =
  | LLMError
  | ToolError
  | ValidationError
  | BudgetError
  | TimeoutError
  | StateError;

interface LLMError {
  type: 'llm_error';
  code: 'rate_limit' | 'context_overflow' | 'safety_filter' | 'api_error';
  provider: string;
  retryable: boolean;
  message: string;
}

interface ToolError {
  type: 'tool_error';
  toolId: string;
  code: 'not_found' | 'timeout' | 'rate_limit' | 'parse_error' | 'auth_error';
  retryable: boolean;
  message: string;
}

interface ValidationError {
  type: 'validation_error';
  field: string;
  expected: string;
  received: string;
}

interface BudgetError {
  type: 'budget_error';
  code: 'exceeded' | 'insufficient_for_operation';
  budgetRemaining: Budget;
}

interface TimeoutError {
  type: 'timeout_error';
  operation: string;
  timeoutMs: number;
  elapsed: number;
}
```

### 11.2 Recovery Strategies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ERROR RECOVERY STRATEGIES                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LLM Errors                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Error              │ Strategy                                      ││
│  │────────────────────│───────────────────────────────────────────────││
│  │ rate_limit         │ Exponential backoff (2s, 4s, 8s, 16s)         ││
│  │                    │ Switch to fallback model after 3 retries      ││
│  │ context_overflow   │ Compress context, retry with smaller input    ││
│  │ safety_filter      │ Log, skip step, continue with warning         ││
│  │ api_error          │ Retry 3x, then switch provider, then fail     ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Tool Errors                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Error              │ Strategy                                      ││
│  │────────────────────│───────────────────────────────────────────────││
│  │ not_found (search) │ Try alternative queries, mark step partial    ││
│  │ timeout            │ Retry with longer timeout, then skip          ││
│  │ rate_limit         │ Queue and retry, switch to fallback tool      ││
│  │ parse_error        │ Log raw content, attempt best-effort parse    ││
│  │ auth_error         │ Fail immediately, notify user                 ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Budget Errors                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Error              │ Strategy                                      ││
│  │────────────────────│───────────────────────────────────────────────││
│  │ exceeded           │ Stop immediately, synthesize with current data││
│  │ insufficient       │ Reduce scope, ask user for more budget        ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  State Errors                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Error              │ Strategy                                      ││
│  │────────────────────│───────────────────────────────────────────────││
│  │ invalid_transition │ Log, attempt recovery to last valid state     ││
│  │ corrupted_session  │ Attempt reconstruction from audit log         ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Circuit Breaker Pattern

```typescript
interface CircuitBreaker {
  // Check if circuit is open (failing)
  isOpen(serviceId: string): boolean;

  // Record success/failure
  recordSuccess(serviceId: string): void;
  recordFailure(serviceId: string, error: Error): void;

  // Execute with circuit breaker
  execute<T>(
    serviceId: string,
    operation: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T>;
}

// Configuration per service
interface CircuitBreakerConfig {
  failureThreshold: number;            // Failures before opening (default: 5)
  resetTimeout: number;                // Ms before half-open (default: 30000)
  halfOpenRequests: number;            // Test requests when half-open (default: 1)
}
```

### 11.4 Graceful Degradation

```typescript
interface DegradationPolicy {
  // What to do when components fail
  onPlannerFailure: 'use_default_plan' | 'fail';
  onToolFailure: 'skip_step' | 'use_cached' | 'fail';
  onCriticFailure: 'assume_sufficient' | 'retry' | 'fail';
  onSynthesizerFailure: 'return_notes' | 'retry' | 'fail';
}

// Default policy: maximize completion
const DEFAULT_POLICY: DegradationPolicy = {
  onPlannerFailure: 'use_default_plan',
  onToolFailure: 'skip_step',
  onCriticFailure: 'assume_sufficient',
  onSynthesizerFailure: 'return_notes'
};
```

---

## 12. Observability & Logging

### 12.1 Structured Logging

```typescript
interface ResearchLogger {
  // Session lifecycle
  logSessionStart(session: Session): void;
  logSessionEnd(session: Session, result: ResearchResult): void;

  // Phase logging
  logPhaseStart(sessionId: string, phase: Phase): void;
  logPhaseEnd(sessionId: string, phase: Phase, result: any): void;

  // Step logging
  logStepExecution(sessionId: string, step: ResearchStep, result: StepResult): void;

  // LLM calls
  logLLMCall(sessionId: string, call: LLMCallRecord): void;

  // Tool calls
  logToolCall(sessionId: string, call: ToolCallRecord): void;

  // Errors
  logError(sessionId: string, error: ResearchError): void;
}

interface LLMCallRecord {
  id: string;
  timestamp: Date;
  model: string;
  role: AgentRole;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

interface ToolCallRecord {
  id: string;
  timestamp: Date;
  toolId: string;
  query: string;
  resultCount: number;
  latencyMs: number;
  cached: boolean;
  success: boolean;
  error?: string;
}
```

### 12.2 Audit Trail

```typescript
interface AuditTrail {
  sessionId: string;
  events: AuditEvent[];
}

interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  actor: 'user' | 'system' | AgentRole;
  action: string;
  details: Record<string, any>;
  parentEventId?: string;              // For nested events
}

type AuditEventType =
  | 'session_created'
  | 'plan_generated'
  | 'step_started'
  | 'step_completed'
  | 'tool_called'
  | 'llm_called'
  | 'source_added'
  | 'note_created'
  | 'reflection_completed'
  | 'synthesis_completed'
  | 'error_occurred'
  | 'session_completed';
```

### 12.3 Metrics Collection

```typescript
interface MetricsCollector {
  // Counters
  incrementCounter(name: string, tags?: Record<string, string>): void;

  // Gauges
  setGauge(name: string, value: number, tags?: Record<string, string>): void;

  // Histograms
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;

  // Timers
  startTimer(name: string): Timer;
}

// Key metrics to track:
const METRICS = {
  // Throughput
  'research.sessions.total': 'counter',
  'research.sessions.active': 'gauge',
  'research.steps.total': 'counter',

  // Latency
  'research.session.duration_ms': 'histogram',
  'research.step.duration_ms': 'histogram',
  'research.llm.latency_ms': 'histogram',
  'research.tool.latency_ms': 'histogram',

  // Cost
  'research.tokens.input': 'counter',
  'research.tokens.output': 'counter',
  'research.cost.dollars': 'counter',

  // Quality
  'research.sufficiency_score': 'histogram',
  'research.source_quality_score': 'histogram',
  'research.iterations': 'histogram',

  // Errors
  'research.errors.total': 'counter',
  'research.errors.by_type': 'counter'
};
```

### 12.4 Provenance Chain

```typescript
interface ProvenanceChain {
  // Complete audit trail for reproducibility
  sessionId: string;
  query: string;
  config: ResearchConfig;

  planningRecord: {
    prompt: string;
    response: string;
    plan: ResearchPlan;
    timestamp: Date;
    model: string;
  };

  iterationRecords: IterationRecord[];

  synthesisRecord: {
    inputNotes: CompressedNotes;
    prompt: string;
    response: string;
    timestamp: Date;
    model: string;
  };

  sourceManifest: {
    sourceId: string;
    url: string;
    fetchedAt: Date;
    contentHash: string;              // For verification
  }[];
}
```

---

## 13. Security Considerations

### 13.1 Threat Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          THREAT MODEL                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input Threats                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Threat                    │ Mitigation                             ││
│  │───────────────────────────│────────────────────────────────────────││
│  │ Prompt injection via query│ Input sanitization, output validation  ││
│  │ Malicious URLs            │ URL allowlist, sandboxed fetching      ││
│  │ Denial of service (cost)  │ Hard budget limits, rate limiting      ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Processing Threats                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Threat                    │ Mitigation                             ││
│  │───────────────────────────│────────────────────────────────────────││
│  │ LLM jailbreak attempts    │ Role-specific system prompts           ││
│  │ Code execution in content │ No eval(), sandboxed parsing           ││
│  │ Infinite loops            │ Max iterations, timeouts               ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Output Threats                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Threat                    │ Mitigation                             ││
│  │───────────────────────────│────────────────────────────────────────││
│  │ Hallucinated citations    │ Citation verification step             ││
│  │ Misinformation amplify    │ Source quality scoring, warnings       ││
│  │ PII in results            │ PII detection and redaction            ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Data Threats                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ Threat                    │ Mitigation                             ││
│  │───────────────────────────│────────────────────────────────────────││
│  │ API key exposure          │ Env vars, secret management            ││
│  │ Session data leakage      │ Encryption at rest, access controls    ││
│  │ Audit log tampering       │ Append-only logs, checksums            ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Input Validation

```typescript
interface InputValidator {
  // Validate user query
  validateQuery(query: string): ValidationResult;

  // Validate URLs before fetching
  validateURL(url: string): ValidationResult;

  // Validate LLM output (JSON structure)
  validateLLMOutput<T>(output: string, schema: JSONSchema): T;
}

// Query validation rules:
// - Max length: 10,000 characters
// - No executable code patterns
// - No prompt injection markers
// - Rate limit per user/IP

// URL validation rules:
// - Must be http/https
// - Not on blocklist (localhost, internal IPs)
// - Domain reputation check
```

### 13.3 Secrets Management

```typescript
interface SecretsManager {
  // Get API key for provider
  getAPIKey(provider: string): string;

  // Rotate keys
  rotateKey(provider: string): void;

  // Audit key usage
  logKeyUsage(provider: string, operation: string): void;
}

// Best practices:
// - Never log API keys
// - Use environment variables or secret manager
// - Rotate keys regularly
// - Separate keys per environment (dev/staging/prod)
```

---

## 14. API Specification

### 14.1 REST API Endpoints

```yaml
openapi: 3.0.0
info:
  title: Deep Research Engine API
  version: 1.0.0

paths:
  /research/sessions:
    post:
      summary: Create a new research session
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateSessionRequest'
      responses:
        '201':
          description: Session created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Session'

  /research/sessions/{sessionId}:
    get:
      summary: Get session status and results
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Session details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Session'

    delete:
      summary: Cancel a running session
      responses:
        '204':
          description: Session cancelled

  /research/sessions/{sessionId}/execute:
    post:
      summary: Start research execution
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                query:
                  type: string
                  description: The research question
      responses:
        '202':
          description: Research started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExecutionStarted'

  /research/sessions/{sessionId}/stream:
    get:
      summary: Stream progress updates (SSE)
      responses:
        '200':
          description: SSE stream
          content:
            text/event-stream:
              schema:
                $ref: '#/components/schemas/ProgressEvent'

components:
  schemas:
    CreateSessionRequest:
      type: object
      required:
        - config
      properties:
        config:
          $ref: '#/components/schemas/ResearchConfig'

    ResearchConfig:
      type: object
      properties:
        models:
          type: object
          properties:
            planner:
              $ref: '#/components/schemas/ModelConfig'
            researcher:
              $ref: '#/components/schemas/ModelConfig'
            critic:
              $ref: '#/components/schemas/ModelConfig'
            synthesizer:
              $ref: '#/components/schemas/ModelConfig'
        limits:
          type: object
          properties:
            maxIterations:
              type: integer
              default: 3
            maxStepsPerIteration:
              type: integer
              default: 7
            sufficiencyThreshold:
              type: number
              default: 7
        budget:
          $ref: '#/components/schemas/Budget'

    Budget:
      type: object
      properties:
        maxTokens:
          type: integer
        maxDollars:
          type: number
        maxApiCalls:
          type: integer
        maxDurationMs:
          type: integer

    Session:
      type: object
      properties:
        id:
          type: string
        state:
          type: string
          enum: [created, planning, researching, reflecting, synthesizing, completed, failed, cancelled]
        config:
          $ref: '#/components/schemas/ResearchConfig'
        plan:
          $ref: '#/components/schemas/ResearchPlan'
        metrics:
          $ref: '#/components/schemas/SessionMetrics'
        result:
          $ref: '#/components/schemas/ResearchResult'

    ProgressEvent:
      type: object
      properties:
        type:
          type: string
          enum: [state_change, step_started, step_completed, source_found, note_created, reflection, error]
        timestamp:
          type: string
          format: date-time
        data:
          type: object
```

### 14.2 SDK Interface

```typescript
// TypeScript SDK

import { DeepResearchEngine, ResearchConfig } from '@research/engine';

// Initialize
const engine = new DeepResearchEngine({
  defaultProvider: 'anthropic',
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY
  }
});

// Simple usage
const result = await engine.research(
  'What are the latest developments in quantum computing?',
  {
    budget: { maxDollars: 1.00 },
    limits: { maxIterations: 2 }
  }
);

console.log(result.report);
console.log(result.citations);

// Advanced usage with streaming
const session = engine.createSession({
  models: {
    planner: { provider: 'anthropic', model: 'claude-haiku' },
    researcher: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    critic: { provider: 'anthropic', model: 'claude-haiku' },
    synthesizer: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
  },
  budget: { maxDollars: 2.00, maxDurationMs: 300000 }
});

session.on('progress', (event) => {
  console.log(`[${event.type}] ${event.message}`);
});

session.on('source_found', (source) => {
  console.log(`Found: ${source.title} (${source.url})`);
});

const result = await session.execute(
  'Compare renewable energy policies across G7 nations'
);
```

---

## 15. Implementation Phases

### Phase 1: Foundation (MVP)

**Duration**: 2-3 weeks of development effort

**Scope**:
- [ ] Core orchestrator with state machine
- [ ] Single LLM provider (Claude)
- [ ] Web search tool only
- [ ] Basic planner and synthesizer agents
- [ ] Simple reflection (threshold-based)
- [ ] In-memory session storage
- [ ] Basic cost tracking
- [ ] CLI interface

**Deliverables**:
```
src/
├── orchestrator/
│   ├── ResearchOrchestrator.ts
│   ├── StateMachine.ts
│   └── SessionManager.ts
├── agents/
│   ├── PlannerAgent.ts
│   ├── ResearcherAgent.ts
│   └── SynthesizerAgent.ts
├── tools/
│   ├── ToolRegistry.ts
│   └── WebSearchTool.ts
├── providers/
│   └── AnthropicProvider.ts
└── cli/
    └── index.ts
```

**Exit Criteria**:
- Can execute a research query end-to-end
- Produces a report with citations
- Stays within budget
- Basic error handling

---

### Phase 2: Quality & Reliability

**Duration**: 2-3 weeks of development effort

**Scope**:
- [ ] Critic agent with sophisticated evaluation
- [ ] Source quality scoring
- [ ] Citation verification
- [ ] URL fetcher tool
- [ ] Context compression/memory hierarchy
- [ ] Circuit breaker pattern
- [ ] Comprehensive error handling
- [ ] Structured logging

**Deliverables**:
```
src/
├── agents/
│   └── CriticAgent.ts
├── tools/
│   └── URLFetcherTool.ts
├── quality/
│   ├── SourceQualityScorer.ts
│   └── CitationVerifier.ts
├── memory/
│   ├── MemoryManager.ts
│   └── Compressor.ts
├── resilience/
│   ├── CircuitBreaker.ts
│   └── RetryPolicy.ts
└── logging/
    ├── ResearchLogger.ts
    └── AuditTrail.ts
```

**Exit Criteria**:
- Source quality affects results
- Citations are verified
- System recovers from failures
- Full audit trail available

---

### Phase 3: Multi-Provider & Tools

**Duration**: 2-3 weeks of development effort

**Scope**:
- [ ] OpenAI provider
- [ ] Google provider
- [ ] Model routing per agent role
- [ ] RAG tool with vector store
- [ ] Domain API tools
- [ ] Tool router
- [ ] Parallel step execution
- [ ] Caching layer

**Deliverables**:
```
src/
├── providers/
│   ├── OpenAIProvider.ts
│   ├── GoogleProvider.ts
│   └── ProviderRouter.ts
├── tools/
│   ├── RAGTool.ts
│   ├── DomainAPITool.ts
│   └── ToolRouter.ts
├── cache/
│   ├── CacheManager.ts
│   └── ResultCache.ts
└── execution/
    └── ParallelExecutor.ts
```

**Exit Criteria**:
- Works with 3+ LLM providers
- RAG integration functional
- Domain APIs available
- Parallel execution working
- Caching reduces redundant calls

---

### Phase 4: Production Readiness

**Duration**: 2-3 weeks of development effort

**Scope**:
- [ ] REST API server
- [ ] Streaming progress updates (SSE)
- [ ] Persistent session storage (PostgreSQL)
- [ ] Metrics collection (Prometheus)
- [ ] Rate limiting
- [ ] Authentication
- [ ] SDK packages (TypeScript, Python)
- [ ] Documentation

**Deliverables**:
```
src/
├── api/
│   ├── server.ts
│   ├── routes/
│   └── middleware/
├── storage/
│   ├── PostgresSessionStore.ts
│   └── migrations/
├── metrics/
│   └── PrometheusCollector.ts
├── auth/
│   └── AuthMiddleware.ts
└── sdk/
    ├── typescript/
    └── python/

docs/
├── API.md
├── SDK.md
├── DEPLOYMENT.md
└── CONFIGURATION.md
```

**Exit Criteria**:
- API fully functional
- Can be deployed to production
- Monitoring in place
- SDKs published
- Documentation complete

---

### Phase 5: Advanced Features

**Duration**: Ongoing

**Scope**:
- [ ] Web UI
- [ ] Domain-specific configurations
- [ ] Custom tool plugins
- [ ] Multi-language support
- [ ] Collaborative research sessions
- [ ] Research templates
- [ ] Export formats (PDF, DOCX)
- [ ] Webhook integrations

---

## 16. Testing Strategy

### 16.1 Test Categories

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TESTING PYRAMID                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         ┌───────────┐                                   │
│                         │   E2E     │  ← Full research sessions         │
│                         │   Tests   │    (10% of tests)                 │
│                        ─┴───────────┴─                                  │
│                      ┌─────────────────┐                                │
│                      │  Integration    │  ← Agent + Tool combos         │
│                      │     Tests       │    (30% of tests)              │
│                     ─┴─────────────────┴─                               │
│                   ┌───────────────────────┐                             │
│                   │      Unit Tests       │  ← Individual components    │
│                   │                       │    (60% of tests)           │
│                  ─┴───────────────────────┴─                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 16.2 Unit Tests

```typescript
// Example: Planner Agent Unit Tests
describe('PlannerAgent', () => {
  describe('generatePlan', () => {
    it('should generate valid plan for simple query', async () => {
      const agent = new PlannerAgent(mockLLM);
      const plan = await agent.generatePlan('What is photosynthesis?');

      expect(plan.steps.length).toBeGreaterThanOrEqual(1);
      expect(plan.steps.length).toBeLessThanOrEqual(7);
      expect(plan.steps.every(s => s.searchQueries.length > 0)).toBe(true);
    });

    it('should reject circular dependencies', async () => {
      const agent = new PlannerAgent(mockLLM);
      mockLLM.setResponse(CIRCULAR_DEPENDENCY_PLAN);

      await expect(agent.generatePlan('query'))
        .rejects.toThrow(ValidationError);
    });

    it('should estimate cost within budget', async () => {
      const agent = new PlannerAgent(mockLLM);
      const plan = await agent.generatePlan('Complex multi-part query', {
        budget: { maxDollars: 0.50 }
      });

      expect(plan.estimatedCost.estimatedDollars).toBeLessThanOrEqual(0.50);
    });
  });
});

// Example: Source Quality Scorer Unit Tests
describe('SourceQualityScorer', () => {
  it('should score .edu domains higher', () => {
    const scorer = new SourceQualityScorer();

    const eduSource = { url: 'https://mit.edu/research', ... };
    const blogSource = { url: 'https://random-blog.com/post', ... };

    expect(scorer.score(eduSource).credibilityScore)
      .toBeGreaterThan(scorer.score(blogSource).credibilityScore);
  });

  it('should penalize outdated sources for tech topics', () => {
    const scorer = new SourceQualityScorer();
    const oldSource = { publishedDate: new Date('2019-01-01'), ... };
    const newSource = { publishedDate: new Date('2024-01-01'), ... };

    const context = { topic: 'technology' };

    expect(scorer.score(newSource, context).recencyScore)
      .toBeGreaterThan(scorer.score(oldSource, context).recencyScore);
  });
});
```

### 16.3 Integration Tests

```typescript
// Example: Research Loop Integration Test
describe('Research Loop', () => {
  it('should iterate until sufficient', async () => {
    const orchestrator = createTestOrchestrator({
      mockSearchResults: MULTI_ITERATION_SCENARIO
    });

    const session = await orchestrator.createSession(DEFAULT_CONFIG);
    const result = await orchestrator.executeResearch(session, 'Complex question');

    expect(result.metrics.iterations).toBeGreaterThan(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should stop at max iterations even if insufficient', async () => {
    const orchestrator = createTestOrchestrator({
      mockCriticResponse: { sufficient: false, score: 3 }
    });

    const session = await orchestrator.createSession({
      ...DEFAULT_CONFIG,
      limits: { maxIterations: 2 }
    });

    const result = await orchestrator.executeResearch(session, 'Impossible question');

    expect(result.metrics.iterations).toBe(2);
    expect(result.limitations).toContain('Research may be incomplete');
  });
});
```

### 16.4 End-to-End Tests

```typescript
// Example: Full Research E2E Test
describe('E2E: Complete Research Session', () => {
  it('should complete research with real APIs', async () => {
    // Skip in CI without API keys
    if (!process.env.ANTHROPIC_API_KEY) {
      return;
    }

    const engine = new DeepResearchEngine({
      providers: { anthropic: { apiKey: process.env.ANTHROPIC_API_KEY } }
    });

    const result = await engine.research(
      'What are the main causes of the 2008 financial crisis?',
      {
        budget: { maxDollars: 0.50 },
        limits: { maxIterations: 1 }
      }
    );

    // Basic sanity checks
    expect(result.report.length).toBeGreaterThan(500);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.metrics.totalCost).toBeLessThanOrEqual(0.50);

    // Citation integrity
    for (const citation of result.citations) {
      expect(citation.sourceId).toBeDefined();
      expect(citation.quote).toBeDefined();
    }
  }, 120000); // 2 minute timeout
});
```

### 16.5 Evaluation Benchmarks

```typescript
// Benchmark datasets for quality evaluation
interface BenchmarkDataset {
  name: string;
  queries: BenchmarkQuery[];
}

interface BenchmarkQuery {
  query: string;
  expectedTopics: string[];           // Topics that should be covered
  requiredSources: string[];          // Domains that should appear
  factChecks: FactCheck[];            // Verifiable facts
}

interface FactCheck {
  claim: string;
  isTrue: boolean;
  source: string;
}

// Example benchmark
const GENERAL_KNOWLEDGE_BENCHMARK: BenchmarkDataset = {
  name: 'General Knowledge',
  queries: [
    {
      query: 'What caused the extinction of dinosaurs?',
      expectedTopics: ['asteroid impact', 'Chicxulub crater', 'mass extinction'],
      requiredSources: ['wikipedia.org', 'nature.com', 'nasa.gov'],
      factChecks: [
        { claim: 'Asteroid impact occurred 66 million years ago', isTrue: true, source: 'NASA' },
        { claim: 'Dinosaurs went extinct instantly', isTrue: false, source: 'common misconception' }
      ]
    }
  ]
};

// Evaluation metrics
interface BenchmarkResult {
  topicCoverage: number;              // % of expected topics mentioned
  sourceQuality: number;              // Avg quality of sources used
  factAccuracy: number;               // % of fact checks passed
  citationIntegrity: number;          // % of claims with valid citations
  executionTime: number;
  cost: number;
}
```

---

## 17. Risks & Mitigations

### 17.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM API instability | Medium | High | Multi-provider fallback, circuit breakers |
| Context window overflow | Medium | Medium | Aggressive compression, hierarchical memory |
| Search API rate limits | High | Medium | Caching, multiple providers, queuing |
| Hallucinated citations | Medium | High | Citation verification step, source linking |
| Infinite iteration loops | Low | High | Hard iteration caps, cost limits |
| Prompt injection | Medium | Medium | Input sanitization, role separation |

### 17.2 Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Poor research quality | Medium | High | Quality scoring, benchmarking, human eval |
| Excessive costs | Medium | High | Budget enforcement, cost estimation |
| Slow execution | Medium | Medium | Parallel execution, caching, streaming |
| Misinformation amplification | Medium | High | Source verification, quality warnings |

### 17.3 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API key exposure | Low | Critical | Secret management, rotation |
| Data privacy violations | Low | Critical | PII detection, data retention policies |
| Vendor lock-in | Medium | Medium | Abstraction layer, multi-provider support |
| Compliance issues | Low | High | Audit logging, provenance chain |

---

## 18. Appendices

### Appendix A: Prompt Templates

Full prompt templates for each agent role are maintained in:
```
prompts/
├── planner/
│   ├── system.md
│   └── examples.md
├── researcher/
│   ├── system.md
│   └── examples.md
├── critic/
│   ├── system.md
│   └── examples.md
└── synthesizer/
    ├── system.md
    └── examples.md
```

### Appendix B: Configuration Reference

```yaml
# Full configuration reference
research:
  models:
    planner:
      provider: anthropic
      model: claude-haiku
      temperature: 0.3
      maxTokens: 2000
    researcher:
      provider: anthropic
      model: claude-sonnet-4-20250514
      temperature: 0.5
      maxTokens: 4000
    critic:
      provider: anthropic
      model: claude-haiku
      temperature: 0.2
      maxTokens: 2000
    synthesizer:
      provider: anthropic
      model: claude-sonnet-4-20250514
      temperature: 0.7
      maxTokens: 8000

  limits:
    maxIterations: 3
    maxStepsPerIteration: 7
    maxSourcesPerStep: 10
    sufficiencyThreshold: 7
    maxParallelSteps: 3

  budget:
    maxTokens: 200000
    maxDollars: 5.00
    maxApiCalls: 100
    maxDurationMs: 600000

  tools:
    enabled:
      - web_search
      - url_fetcher
      - rag_retrieval
    webSearch:
      provider: bing
      maxResultsPerQuery: 10
    urlFetcher:
      maxContentLength: 50000
      renderJavascript: false
    rag:
      vectorStore: pgvector
      topK: 5
      minSimilarity: 0.7

  quality:
    minSourceQuality: 0.4
    requireCorroboration: true
    verifyCitations: true

  output:
    format: markdown
    includeCitations: true
    includeProvenance: true
    maxLength: 10000

  logging:
    level: info
    auditTrail: true
    logPrompts: false  # Privacy
```

### Appendix C: Error Codes

| Code | Name | Description |
|------|------|-------------|
| E1001 | BUDGET_EXCEEDED | Hard budget limit reached |
| E1002 | MAX_ITERATIONS | Maximum iterations reached |
| E1003 | TIMEOUT | Operation timed out |
| E2001 | LLM_RATE_LIMIT | LLM provider rate limited |
| E2002 | LLM_CONTEXT_OVERFLOW | Input exceeded context window |
| E2003 | LLM_SAFETY_FILTER | Response blocked by safety filter |
| E2004 | LLM_API_ERROR | General LLM API error |
| E3001 | TOOL_NOT_FOUND | Requested tool not registered |
| E3002 | TOOL_TIMEOUT | Tool execution timed out |
| E3003 | TOOL_RATE_LIMIT | Tool provider rate limited |
| E4001 | VALIDATION_FAILED | Input validation failed |
| E4002 | PLAN_INVALID | Generated plan failed validation |
| E5001 | SESSION_NOT_FOUND | Session ID not found |
| E5002 | INVALID_STATE | Invalid state transition |

### Appendix D: Glossary

| Term | Definition |
|------|------------|
| **Agent** | A specialized LLM instance with a specific role (planner, researcher, etc.) |
| **Citation** | A reference linking a claim to its source |
| **Iteration** | One complete pass through the research loop |
| **Provenance** | The complete chain of evidence for a research result |
| **RAG** | Retrieval-Augmented Generation - using vector search to find relevant context |
| **Reflection** | The evaluation step where the critic assesses sufficiency |
| **Session** | A single research execution from query to result |
| **Source** | An external document or webpage providing information |
| **Step** | A single research sub-task within a plan |
| **Sufficiency** | Whether the research adequately answers the query |
| **Synthesis** | The final step of combining notes into a report |
| **Tool** | An external capability (search, fetch, RAG) the agents can use |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-26 | System Architect | Initial version |

---

*End of Document*
