# Phase 1 — Usage Tracking & Subscription Enforcement: Repository Audit Report

**Repository:** [Ivano-Technologies/techivano-eam](https://github.com/Ivano-Technologies/techivano-eam)  
**Stack:** Next.js (Vercel), Supabase Postgres, Railway workers, Cloudflare R2  
**Date:** 2025-03-09  
**Scope:** Organizations model, tenant data tables, R2 uploads, OCR workers, API routes that create tenant resources — to support usage metrics and plan enforcement.

---

## 1. Executive Summary

The platform uses **organization-level tenancy** (Supabase migrations define `organizations` and `organization_members`; `organization_id` appears on `documents` and in upload/encryption flows). There is **no subscription or usage model** in schema or code. Asset creation, work order creation, document creation, and asset photo creation are the main resource-creation paths; document uploads go through R2 (signed URL + multipart) and optionally an OCR queue. **Inspections** exist in Drizzle schema but **no inspection-creation API or `createInspection`** was found. This report lists where to hook usage tracking and where to enforce limits.

---

## 2. Organizations Table

| Source | Location | Notes |
|--------|----------|--------|
| **Supabase** | `supabase/migrations/20260309133000_canonical_organization_tenancy.sql` | Defines `public.organizations` (id uuid PK, name, slug, is_active, created_at, updated_at) and `public.organization_members` (organization_id, user_id, role, is_active, …). RLS enabled. |
| **Drizzle** | `drizzle/schema.ts` | **Not defined.** No `organizations` or `organization_members` tables in schema. |

Organization context is resolved in:

- **`server/_core/context.ts`** — `resolveOrganizationContext({ req, explicitOrganizationId })` returns `{ tenantId, organizationId }` (from header `x-tenant-id` / body `organizationId`, etc.).
- **`server/_core/index.ts`** — `getOrganizationIdFromRequest(req, bodyOrganizationId)` used by upload and document endpoints.

---

## 3. Tenant Data Tables (Relevant to Usage)

| Table | Drizzle table name | organization_id in schema? | Notes |
|-------|--------------------|----------------------------|--------|
| **assets** | `assets` | No | Core EAM; creation via tRPC + bulk import. |
| **work_orders** | `workOrders` | No | Creation via tRPC (+ predictive maintenance job). |
| **documents** | `documents` | Yes (`organizationId` uuid) | Created on multipart complete and encrypted upload path; has `fileSize`. |
| **inspections** | `inspections` | No (has `tenantId` int) | In schema; **no create API found** in audit. |
| **maintenance_schedules** | `maintenanceSchedules` | No | Present in schema; creation path not enumerated. |
| **asset_photos** | `assetPhotos` | No | Created via tRPC `photos.create` (photoUrl, photoKey, assetId/workOrderId). |
| **inventory_items** | `inventoryItems` | No | Tenant data. |
| **vendors** | `vendors` | No | Tenant data. |
| **compliance_records** | `complianceRecords` | No | Tenant data. |
| **sites** | `sites` | No | Tenant data. |

For **usage metrics**, the most relevant are: **assets**, **documents**, **inspections** (if/when creation is added), **work orders**, and **file storage** (R2; derived from document records or object metadata).

---

## 4. R2 Upload Logic

| Component | File | Purpose |
|-----------|------|--------|
| **R2 config / client** | `server/_core/r2.ts` | `getR2Config()`, `getR2Client()`, `buildFileKey()`, `validateUploadRequest()`, `validateMultipartStartRequest()`. Categories: `assets`, `inspection-images`, `documents`, `ocr`. Max sizes and content types per category. |
| **Signed URL** | `server/_core/index.ts` | `POST /api/uploads/signed-url` — validates file type/size, returns signed PUT URL and `fileKey`. No DB write. |
| **Complete (signed)** | `server/_core/index.ts` | `POST /api/uploads/complete` — accepts `fileKey`, `fileType`, `uploadType`, optional `organizationId`/`tenantId`. Queues OCR for documents/ocr; **does not call `createDocument`** or record file size. |
| **Multipart start** | `server/_core/index.ts` | `POST /api/uploads/multipart/start` — validates type/size, creates multipart upload in R2. |
| **Multipart URL** | `server/_core/index.ts` | `POST /api/uploads/multipart/url` — signs part URLs. |
| **Multipart complete** | `server/_core/index.ts` | `POST /api/uploads/multipart/complete` — completes R2 multipart, then **calls `db.createDocument()`** with `fileKey`, `fileUrl`, `fileType`, `fileSize`, `entityType: "organization"`, `entityId`, `organizationId`, `uploadedBy`. Queues OCR when applicable. |
| **Encrypted upload** | `server/_core/index.ts` | `POST /api/uploads/encrypted` — base64 body; requires `organizationId`; writes to R2 and creates document via `recordEncryptedDocumentUpload()` in db. |

**Gap:** Signed-url flow (`/api/uploads/complete`) does **not** create a `documents` row or record file size. Only multipart complete and encrypted upload do. So **document count and storage usage** are undercounted if clients use signed URL without a separate document record.

---

## 5. OCR Workers

| Item | Location | Notes |
|------|----------|--------|
| **Queue name** | `server/jobs/ocrUploadQueue.ts` | `OCR_UPLOAD_QUEUE_NAME = "ocr-processing"`, job name `process-uploaded-document`. |
| **Producer** | `server/jobs/ocrUploadQueue.ts` | `enqueueUploadedDocumentForOcr(payload)` — payload includes `tenantId`, `organizationId`, `fileKey`, `fileType`, `fileUrl`, `requestedBy`, `uploadedAt`, optional encryption fields. |
| **Consumer** | Not found in repo | Queue is produced to from `server/_core/index.ts` (complete + multipart complete). No `ocr-processing` worker file or `process-uploaded-document` handler found in this audit. |

OCR jobs are created with `organizationId` when available; workers (when implemented) should use the same `organization_id` for any DB writes and for usage updates.

---

## 6. API Routes / tRPC That Create Tenant Resources

| Operation | Entry point | File | organization_id / tenant scope |
|-----------|-------------|------|----------------------------------|
| **Asset creation** | tRPC `assets.create` | `server/routers.ts` (~609) | Uses `protectedOrgProcedure`; no explicit org in payload; `db.createAsset(input)`. |
| **Work order creation** | tRPC `workOrders.create` | `server/routers.ts` (~951) | `db.createWorkOrder({ ...input, requestedBy: ctx.user.id })`; audit log created. |
| **Document creation (multipart)** | `POST /api/uploads/multipart/complete` | `server/_core/index.ts` (~882) | `orgContext.organizationId` from request; `db.createDocument({ ..., organizationId, fileSize, ... })`. |
| **Document creation (encrypted)** | `POST /api/uploads/encrypted` | `server/_core/index.ts` + db | `recordEncryptedDocumentUpload()` in db — creates document with `organizationId`. |
| **Asset photo creation** | tRPC `photos.create` | `server/routers.ts` (~2156) | `db.createAssetPhoto({ ...input, uploadedBy: ctx.user.id })`. No org on `assetPhotos` in schema. |
| **Bulk asset import** | tRPC or bulk import | `server/bulkImport.ts`, `server/bulkImportExport.ts` | `db.createAsset(assetData)` in loop; no org in payload. |
| **NRCS Excel import** | Server | `server/nrcsExcelImporter.ts` | `db.createAsset(...)`. |
| **Predictive maintenance (work order)** | Background job | `server/predictiveMaintenance.ts` | `db.createWorkOrder(...)`. |
| **Compliance record** | — | `server/db.ts` | `createComplianceRecord`; no creation route enumerated in this audit. |

**Context:** tRPC uses `protectedOrgProcedure` / `createContext` which sets `ctx.tenantId` and `ctx.organizationId`; actual DB tables (e.g. `assets`, `workOrders`) may not yet have `organization_id` in Drizzle — see multi-tenant audit report. For **usage and limits**, organization should be taken from context (or from request for upload routes) and used to key usage records and subscription checks.

---

## 7. Operations That Should Contribute to Usage Metrics

| Metric | Operation | Where it happens | Org available? |
|--------|-----------|------------------|----------------|
| **Asset count** | Asset create | tRPC `assets.create`; bulk import; NRCS import | From ctx or import context |
| **Document count** | Document create | Multipart complete; encrypted upload | Yes (`orgContext.organizationId`) |
| **Inspection count** | Inspection create | **No API found** | N/A until inspections create is added |
| **Work order count** | Work order create | tRPC `workOrders.create`; predictive maintenance job | From ctx / job payload |
| **File storage (MB)** | Document upload with size | Multipart complete (`fileSize` in `createDocument`); encrypted upload (body length) | Yes |

Additional considerations:

- **Asset photos** (tRPC `photos.create`): could count as “document-like” or a separate quota depending on product design.
- **Signed URL complete** without document record: today does not add to document count or storage; if product wants all uploads to count, this path should also create a document row (or a separate storage-only usage entry) with size when available (e.g. from client or from HEAD on R2 after upload).

---

## 8. Summary: Hooks for Usage and Limits

1. **Subscription / plan and usage tables**  
   Do not exist. Need to add (e.g. `organization_subscriptions`, `organization_usage`) and, if using Drizzle, add them to the schema.

2. **Asset creation**  
   - **Count:** Increment in `server/routers.ts` (assets.create mutation) and in bulk/NRCS import paths after each successful `createAsset`.  
   - **Limit check:** Before `db.createAsset` in assets.create and at start of bulk import (e.g. `asset_count < asset_limit`).

3. **Document creation**  
   - **Count + storage:** Increment document count and add `fileSize` to storage (MB) in:  
     - `server/_core/index.ts` multipart complete (where `createDocument` is called),  
     - and in the encrypted-upload path (e.g. inside or after `recordEncryptedDocumentUpload`).  
   - **Limit check:** Before creating the document (and, for storage, before finalizing upload if possible).  
   - Optionally: have signed-url complete also create a document (and usage) when `organizationId` and size are available.

4. **Work order creation**  
   - **Count:** Increment in tRPC `workOrders.create` and in predictive maintenance job after `createWorkOrder`.  
   - **Limit check:** Before `createWorkOrder` if work orders are limited by plan.

5. **Inspections**  
   - No creation path found; when added, same pattern: increment usage and check limit before create.

6. **OCR workers**  
   - When a worker consumes `process-uploaded-document`, it should not create duplicate document rows that double-count; if it creates or updates documents, it should update **organization_usage** (e.g. document count / storage) in a single place (ideally server-side API when document is first recorded, or in worker with same org_id). Workers should read subscription/usage (e.g. storage limit) before heavy processing and fail the job with a clear code if over limit.

7. **R2**  
   - Storage usage is best derived from **document records** (e.g. sum of `fileSize` per `organization_id`) or from a dedicated usage table updated on each upload/delete. Optionally sync from R2 (e.g. bucket metrics or listing by prefix) for reconciliation.

---

## 9. Files to Modify (for later phases)

| Phase | Files |
|-------|--------|
| Subscription model | New migration + optionally `drizzle/schema.ts` (if Drizzle is used for subscriptions). |
| Usage tracking | New table + `server/db.ts` (or new usage module); call from assets.create, workOrders.create, document creation paths, bulk import. |
| Storage tracking | `server/_core/index.ts` (multipart complete, encrypted upload); optionally signed complete; db layer for `organization_usage.storage_used_mb`. |
| API enforcement | `server/routers.ts` (assets.create, workOrders.create); `server/_core/index.ts` (upload complete endpoints); bulk import entry. |
| Worker enforcement | OCR worker (when present); any other worker that creates org-scoped resources. |
| Usage reporting | New route e.g. `GET /api/usage` or tRPC `usage.get` reading `organization_usage` + subscription, scoped by `organization_id` from context. |

---

*End of Phase 1 report. No code was modified.*
