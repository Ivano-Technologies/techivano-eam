# Phase 4D — Worker Compatibility Validation

**Purpose:** Ensure Railway workers are organization-aware and that payloads and writes use `organization_id` where applicable.

---

## 1. Payload requirements

All job payloads that create or update tenant-scoped data **must** include `organizationId` (UUID string).

### OCR / document processing

| Queue | Payload field | Required | Notes |
|-------|----------------|---------|--------|
| ocr-processing | organizationId | Yes (preferred) | Already in OcrUploadJobPayload; enqueueUploadedDocumentForOcr sends it. |
| ocr-processing | tenantId | Backward compat | Kept until all consumers use organizationId. |

**Example payload:**

```json
{
  "organizationId": "550e8400-e29b-41d4-a716-446655440000",
  "documentId": 123,
  "fileKey": "org/550e8400.../doc.pdf",
  "fileUrl": "https://...",
  "requestedBy": 1,
  "uploadedAt": "2025-03-09T12:00:00Z"
}
```

### Background analytics jobs

| Job type | Payload | Notes |
|----------|---------|--------|
| warehouse, vendor, procurement, supply chain, dispatch, executive | tenantId (number) | Tables still use tenant_id only; organizationId optional in BaseBackgroundJobPayload for future use. |

Workers that write to **core EAM tables** (e.g. documents) must set `organization_id` from the payload when inserting/updating.

---

## 2. Validation checklist

- [ ] **OCR queue:** Producer (_core/index.ts, document upload) includes `organizationId` in the payload when enqueueing. **Verified:** getOrganizationIdFromRequest used; payload includes organizationId when available.
- [x] **OCR worker:** In-repo consumer at `server/jobs/ocrWorker.ts` (processes `ocr-processing` queue). Run via `pnpm build:ocr-worker && pnpm start:ocr-worker` (or deploy alongside main worker). Processor uses `resolveWorkerOcrPayloadContext` for org/tenant; document metadata updates can be added when schema supports it.
- [ ] **Job run store:** background_job_runs still uses tenantId; organization_id not yet on that table. No change for Phase 4.
- [ ] **Analytics workers:** Continue using tenantId for warehouse/vendor/procurement/etc. tables until those tables have organization_id.

---

## 3. Worker write rules

When a worker writes to a table that has an `organization_id` column:

1. Prefer `payload.organizationId` (UUID string).
2. If missing, resolve from `payload.tenantId` via `tenant_organization_map` or do not write (fail safe).
3. Never write a row with `organization_id` NULL for tenant-scoped tables after backfill is complete.
