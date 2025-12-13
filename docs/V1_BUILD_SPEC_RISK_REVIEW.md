# V1 Build Specification Critical Risk Review

This document captures the top risks identified in the architectural review of the V1 Build Specification, focusing on high-risk intersections across RLS/connection pooling, delete workflows, and malware scanning.

## Top 3 Critical Risks

### 1) RLS Leakage via Pooled Connections
- **Scenario:** Request A sets `tenant_id` in `tenantContextMiddleware` with `SET LOCAL app.tenant_id` and returns the connection to the pool. Request B reuses the same connection before its own `SET LOCAL` executes, causing Request B's queries to inherit Request A's tenant context.
- **Impact:** Cross-tenant data leakage and incorrect reads/writes under the wrong RLS context.
- **Recommended Fix:** Acquire connections per transaction (`pool.connect()`), wrap each request in `BEGIN`/`COMMIT` with `SET LOCAL` executed inside, and scrub session state (`DISCARD ALL`/`RESET ALL`) on release. Alternatively, run pgbouncer in transaction pooling mode to enforce per-transaction isolation.

### 2) Zombie Vectors from Partial Deletes
- **Scenario:** Delete flow commits the Postgres delete first, then attempts Qdrant and blob deletions. If Qdrant fails or times out, vectors remain while the document row is gone, leaving search results pointing to missing documents.
- **Impact:** Data corruption/inconsistent search results and potential exposure of stale or sensitive embeddings.
- **Recommended Fix:** Implement a saga/transactional outbox: mark documents as `deleting`, enqueue Qdrant/blob deletions with retries and idempotency, and only finalize the Postgres removal once downstream deletes succeed (or apply compensating actions such as tombstones/retries until cleanup completes).

### 3) Malware-Scan Race During Streaming Uploads
- **Scenario:** Files stream directly to storage and become retrievable before malware scanning finishes. A malicious upload can be downloaded or processed immediately while the scan is still pending or fails.
- **Impact:** Security breach through distribution/ingestion of unscanned malware.
- **Recommended Fix:** Stream uploads into a quarantine path and gate availability on a "clean" scan result. Only move/promote the object to its public/consumable location after ClamAV (or equivalent) passes; block downloads/workers until the scan state is clean and tie signed URLs/tokens to that state.
