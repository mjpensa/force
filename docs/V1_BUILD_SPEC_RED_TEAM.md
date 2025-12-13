# V1 Build Specification – Red Team Review (4x Pass)

The following risks focus on the highest-impact failure modes identified during the architectural review of the V1 Build Specification. Each entry includes the scenario, impact, and recommended mitigation.

## 1) RLS context leaking across pooled connections
- **The Scenario:** A request sets `SET LOCAL app.tenant_id` through the shared knex/pg pool without wrapping it in a transaction or resetting the session on release. When the connection returns to the pool, the session GUC can persist. A subsequent request for a different tenant reuses the same connection and inherits the prior `tenant_id`, causing cross-tenant reads/writes despite proper auth on the new request.
- **The Impact:** Data Leak and cross-tenant authorization bypass.
- **The Recommended Fix:** Enforce transaction-scoped context: wrap each request in `BEGIN … COMMIT` (or a `knex.transaction`) with `SET LOCAL` inside the transaction, and reset on pool release (`RESET ALL` or explicit `SET app.tenant_id = NULL`). Prefer `pgbouncer` transaction mode or per-request transaction binding so session GUCs cannot bleed across pooled connections.

## 2) Zombie vectors after partial deletes
- **The Scenario:** Delete flow removes the Postgres row, then calls Qdrant, then deletes blob storage. If the DB commit succeeds but the Qdrant call fails/times out, vectors remain while the document record is gone. Search still returns the vector pointing to a now-null document, producing “zombie” results. The inverse (Qdrant delete succeeds, DB delete fails) leaves orphaned state in the DB without embeddings.
- **The Impact:** Data Corruption and stale/ghost search results.
- **The Recommended Fix:** Implement a delete saga/outbox. Mark the document as `pending_delete` in Postgres, enqueue idempotent vector/blob deletes, and only hard-delete the row after external deletes succeed. Include retries and dead-letter handling; compensating action should restore vectors or re-run deletes to achieve convergence.

## 3) Worker OOM on concurrent large PDF parsing
- **The Scenario:** Workers are limited to 4 GiB RAM while uploads allow 50 MB files and PDF parsing (e.g., `pdf-parse`) loads entire documents into the heap. Five concurrent jobs each process a 50 MB PDF, leading to multiple full DOMs and extracted text objects in memory simultaneously. Heap usage can exceed container limits, triggering OOM kills and job loss/retries.
- **The Impact:** Service Outage and stuck pipelines due to OOM crashes during ingestion.
- **The Recommended Fix:** Constrain concurrency and memory per job: stream PDF text instead of full DOM where possible, cap parallel workers based on heap profiling, and enforce upload size/ page-count limits. Use a job queue with backpressure (e.g., rate-limit worker concurrency) and implement chunked parsing or page-at-a-time extraction to keep peak memory bounded below container limits.

## 4) Malware scan race exposes unscanned blobs
- **The Scenario:** The upload endpoint streams files directly to blob storage while computing hashes; the malware scan runs asynchronously afterward. The blob becomes addressable as soon as the upload finishes, allowing clients or downstream tasks to fetch or process it before the scan verdict is available. A malicious file could be distributed before being flagged and removed.
- **The Impact:** Security Breach via distribution/processing of unscanned malware.
- **The Recommended Fix:** Introduce quarantine and gating. Stream uploads to a quarantined path/container with no read access, run the ClamAV stream scan before promoting the blob, and only publish metadata or create jobs after a clean verdict. On scan failure, delete the quarantined blob and return an error; ensure ACLs block reads until promotion completes.
