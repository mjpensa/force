# V4 Gap Remediation Plan

This plan closes the four critical gaps identified during the architectural red-team review of the V1 Build Specification. Each section states the risk, concrete implementation steps, ownership boundaries, and verification actions.

## 1) Tenant RLS Context Leakage via Connection Pooling
**Risk recap:** `tenantContextMiddleware` issues `SET LOCAL app.tenant_id` on pooled connections without a request-scoped transaction or session reset, so pooled connections can leak the previous tenant’s RLS context across requests.

**Implementation steps**
- Wrap every API request that executes database queries in a request-scoped transaction (e.g., `db.transaction(async trx => { ... })`) and run `SET LOCAL app.tenant_id = $1` on the transaction connection before any query executes. Ensure all downstream repositories receive the `trx` instance instead of the global pool handle.
- Add a `beforeRelease`/`afterRelease` hook (knex `pool.afterCreate` + `pool.destroy`) that issues `RESET ALL` to scrub session state when a connection returns to the pool. Guard with logging and metrics on failures to guarantee resets.
- If pgBouncer is used, enforce *transaction* pooling mode so session state cannot persist between requests; document this as a deployment invariant in ops runbooks.
- Add an integration test harness that spawns two simulated requests on the same connection: Request A sets tenant A, executes a query, releases; Request B sets tenant B and verifies it cannot read tenant A data, proving reset/transaction isolation works.

**Outcome:** RLS context is isolated per request; no cross-tenant leakage even under pool reuse. 【F:docs/V1_BUILD_SPEC.md†L4298-L4346】

## 2) Zombie Vectors from Partial Delete
**Risk recap:** Document delete currently removes Qdrant vectors and blob content after deleting from Postgres, so a failure midway leaves orphaned vectors or blobs that still appear in search.

**Implementation steps**
- Convert delete to an outbox-backed saga: mark the document row as `status='deleting'` in a DB transaction, emit a durable outbox event, and commit the transaction only after the outbox write. Keep the user-facing API idempotent and return 202 with a deletion job ID.
- Implement a worker handler that processes the deletion event with ordered steps: (1) delete vectors in Qdrant with retries/backoff; (2) delete blobs with retries; (3) hard-delete the Postgres row (or mark `deleted_at`). If any step fails, record the failure and leave the status as `delete_failed` for retries.
- Add periodic reconciliation jobs to reprocess stuck deletion events and to scan for blobs/vectors whose document rows are gone, cleaning or rebuilding as needed.
- Extend cache invalidation to fire only after the saga reaches the terminal `deleted` state; expose metrics on deletion success/failure counts.

**Outcome:** Deletions become eventually consistent and resilient; orphaned vectors or blobs are automatically cleared. 【F:docs/V1_BUILD_SPEC.md†L6454-L6485】

## 3) Worker OOM During Concurrent PDF Parsing
**Risk recap:** Worker containers are limited to 4Gi but must process up to 50MB PDFs with OCR/DOM parsing; five concurrent jobs can exceed heap and crash the pod.

**Implementation steps**
- Enforce a worker-level concurrency cap for heavy extractors (e.g., a semaphore limiting PDF extraction to 1–2 concurrent jobs per pod) and route other tasks to separate queues where feasible.
- Replace full-buffer parsing with streamed/page-chunked extraction where the library permits; for `pdf-parse` or equivalent, switch to an external managed OCR (Azure Document Intelligence) that returns paged results and avoid retaining full DOM in memory.
- Add pre-flight guards in the ingestion job to reject or downscale files exceeding safe thresholds when the OCR service is unavailable, and persist a user-visible `rejected_reason`.
- Instrument memory usage and job sizes; configure HPA/KEDA scaling thresholds on queue depth and RSS to prevent scheduling more concurrent PDF tasks than the node can support.

**Outcome:** Worker memory use is bounded and predictable; large-file ingestion cannot crash the pod through concurrent PDF parsing. 【F:docs/V1_BUILD_SPEC.md†L260-L312】【F:docs/V1_BUILD_SPEC.md†L6131-L6205】【F:docs/V1_BUILD_SPEC.md†L6575-L6638】

## 4) Malware Scanning Race on Streaming Uploads
**Risk recap:** Files are streamed straight to blob storage and marked with final paths before malware scanning, so malicious files could be downloadable before scans finish.

**Implementation steps**
- Introduce a quarantine container/path for new uploads. Stream the file to `quarantine/{tenant}/{kb}/{tempId}` and record the temp path in the DB with status `uploading`.
- Run malware scanning on the quarantined stream or blob. Only after a clean result should the blob be moved/renamed to the final `documents/...` path and the document status set to `pending`. If infected or scan fails, delete the quarantine blob, mark the document `rejected`, and emit an audit event.
- Gate downloads and downstream processing on `status='pending'|'processing'|'complete'`; deny access to any document not marked clean. Add signed URL generation to check status before issuing links.
- Add circuit-breaker metrics and alerts for scan failures; expose an admin retry endpoint to re-scan quarantined blobs.

**Outcome:** No document becomes available or processed before malware scans pass; infected uploads are quarantined and destroyed safely. 【F:docs/V1_BUILD_SPEC.md†L6131-L6205】【F:docs/V1_BUILD_SPEC.md†L7525-L7599】
