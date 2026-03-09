# Organization Key Rotation + Worker Decrypt Flow

Last updated: 2026-03-09

## What This Adds

- Organization encryption key lifecycle helpers in `server/db.ts`:
  - `createInitialOrganizationEncryptionKey(organizationId)`
  - `getActiveOrganizationEncryptionKey(organizationId, keyVersion?)`
  - `rotateOrganizationEncryptionKey(organizationId)`
  - `getOrganizationEncryptionKeyMaterial(organizationId, keyVersion?)`
- Admin rotation endpoint:
  - `POST /api/organizations/:organizationId/encryption-keys/rotate`
- OCR queue payload metadata additions in `server/jobs/ocrUploadQueue.ts`:
  - `organizationId`
  - `encryptionKeyVersion`
  - `encryptionAlgorithm`
- Worker decrypt utility in `server/jobs/workerDecrypt.ts`:
  - `decryptWorkerPayloadInMemory(...)`

## Rotation Endpoint

### Request

- Method: `POST`
- Path: `/api/organizations/:organizationId/encryption-keys/rotate`
- Auth: required
- Authorization: `admin` role required

### Response

- `organizationId`
- `retiredVersion` (nullable)
- `activeKeyVersion`
- `algorithm`
- `rotatedAt`

## Lifecycle Semantics

1. If an organization has no active key, initial key creation generates one active key version.
2. Rotation creates a new active key version and retires the prior active version.
3. Existing encrypted content remains decryptable because workers can request a specific key version.

## OCR Queue Metadata

When document/ocr uploads are queued, the producer now includes:

- `tenantId` and legacy alias `tenant_id`
- `organizationId` when available from request/session context
- `encryptionKeyVersion` and `encryptionAlgorithm` when matching encrypted document metadata exists in `documents`

This allows downstream workers to pick the correct organization key version for decrypt-in-memory operations while keeping legacy tenant-only payloads processable.

## Worker Decrypt Pattern (No Plaintext At Rest)

Use `decryptWorkerPayloadInMemory`:

1. Resolve org key material by `(organizationId, keyVersion)` from server-side storage.
2. Decrypt ciphertext in memory (`Buffer`) with AES-256-GCM.
3. Process plaintext immediately in worker memory.
4. Do not write plaintext payloads to disk/object storage unless re-encrypted.

### Worker Payload Compatibility Helpers

`server/jobs/workerDecrypt.ts` now exposes worker-safe payload helpers for OCR/document jobs:

- `resolveWorkerTenantId(payload)`:
  - Reads canonical `tenantId`
  - Falls back to legacy `tenant_id`
- `resolveWorkerOrganizationId(payload)`:
  - Reads `organizationId` and legacy `organization_id`
  - Normalizes UUID or numeric tenant forms into canonical organization UUID
- `resolveWorkerEncryptionMetadata(payload)`:
  - Reads both camelCase and snake_case fields:
    - `encryptionKeyVersion` / `encryption_key_version`
    - `encryptionAlgorithm` / `encryption_algorithm`
  - Returns `null` when encryption metadata is absent/incomplete/unsupported
  - Accepts only supported algorithm (`aes-256-gcm`)
- `resolveWorkerOcrPayloadContext(payload)`:
  - Returns normalized `{ tenantId, organizationId, encryption }` in one call
  - Handles payloads with or without encryption metadata safely
- `assertWorkerPayloadOrganizationScope({ payload, expectedOrganizationId })`:
  - Enforces org match to avoid accidental cross-organization processing

Recommended worker behavior:

1. Resolve org/tenant with these helpers.
2. If worker runs in a single-org scope, call `assertWorkerPayloadOrganizationScope(...)` before fetch/decrypt.
3. If encryption metadata exists, decrypt with `decryptWorkerPayloadInMemory(...)`.
4. If encryption metadata is absent (legacy/plain uploads), continue with non-decrypt OCR path.

## Security Notes

- `MASTER_ENCRYPTION_KEY` remains server-side only.
- Raw decrypted key material is never returned from HTTP endpoints.
- Rotation endpoint returns metadata only, never key material.

## Operational TODOs

- Ensure `MASTER_ENCRYPTION_KEY` is configured in each runtime (API + workers).
- Runtime OCR worker integration still required:
  - Use `resolveWorkerOcrPayloadContext(...)` at job start
  - Reject jobs when an org-scoped worker sees mismatched `organizationId` via `assertWorkerPayloadOrganizationScope(...)`
  - Branch decrypt path only when `encryption` metadata is present; keep plaintext/legacy path otherwise
- Validate key rotation in staging:
  - upload and process document before rotation
  - rotate key
  - upload and process document after rotation
  - reprocess a pre-rotation encrypted document to confirm older key-version decrypt path still works

