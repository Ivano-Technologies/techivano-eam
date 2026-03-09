# Cloudflare R2 Signed + Multipart Uploads Implementation

Last updated: 2026-03-09

## Overview

Techivano supports:

- direct browser-to-R2 uploads using short-lived signed URLs (single part)
- multipart uploads for large files with resumable client-side progress state

This removes large file transfer load from the application server and keeps storage
credentials server-side only.

## Bucket Structure

R2 bucket: `techivano-assets`

Object key prefixes used by the signed upload API:

- `assets/`
- `inspection-images/`
- `documents/`
- `ocr/`

## Server Components

### 1) R2 utility module

File: `server/_core/r2.ts`

Responsibilities:

- Initializes S3-compatible R2 client
- Validates allowed MIME types per upload category
- Validates max file size per upload category
- Builds deterministic object keys by category and date
- Resolves public URL from `R2_PUBLIC_BASE_URL`

### 2) Signed URL endpoint

File: `server/_core/index.ts`

Endpoint:

- `POST /api/uploads/signed-url`

Request body:

- `fileName` (required)
- `fileType` (required)
- `fileSize` (required)
- `uploadType` (`assets` | `inspection-images` | `documents` | `ocr`)

Response:

- `uploadUrl`
- `fileKey`
- `expiresInSeconds` (5 minutes)

Security:

- Requires authenticated session
- Server-only credentials
- File type and file size validated before signing

### 3) Upload completion endpoint

File: `server/_core/index.ts`

Endpoint:

- `POST /api/uploads/complete`

Request body:

- `fileKey`
- `fileType`
- `uploadType`
- `tenantId` (optional but recommended for OCR jobs)

Response:

- `fileKey`
- `fileUrl`
- `queuedForOcr`

If `uploadType` is `documents` or `ocr`, a job is enqueued into queue
`ocr-processing` for worker-side OCR ingestion.

### 4) OCR queue producer

File: `server/jobs/ocrUploadQueue.ts`

Responsibilities:

- Publishes `process-uploaded-document` jobs to queue `ocr-processing`
- Payload includes tenant/user, file key, file type, and resolved file URL

### 5) Multipart upload endpoints

File: `server/_core/index.ts`

Endpoints:

- `POST /api/uploads/multipart/start`
- `POST /api/uploads/multipart/url`
- `POST /api/uploads/multipart/complete`

Multipart flow:

1. Start endpoint validates metadata and creates multipart upload session in R2
2. URL endpoint signs `UploadPart` URLs for validated part numbers
3. Client uploads each chunk directly to R2 and collects ETags
4. Complete endpoint verifies listed parts/ETags and finalizes upload
5. Metadata is recorded and OCR job is optionally queued for `documents`/`ocr`

Limits:

- Part size: 8MB
- Max parts: 1000
- Max file size: 8GB
- Allowed multipart content types: `application/pdf`, `image/png`, `image/jpeg`

## Frontend Upload Flow

File: `client/src/pages/AssetDetail.tsx`

Updated flow for asset photos:

1. Request signed URL from `/api/uploads/signed-url`
2. Upload file directly to R2 via signed `PUT` URL
3. Call `/api/uploads/complete`
4. Save resulting `fileUrl` + `fileKey` through existing `trpc.photos.create`

Upload progress is shown in UI during direct upload.

For files above multipart threshold:

1. `POST /api/uploads/multipart/start`
2. Split into 8MB chunks
3. `POST /api/uploads/multipart/url` per chunk
4. Upload each chunk with signed `PUT`
5. `POST /api/uploads/multipart/complete` with collected part ETags

Resumability:

- Browser stores in-progress multipart state (uploadId, fileKey, uploaded part ETags)
- Interrupted uploads can resume from remaining parts

## Environment Variables

Added to `.env.example`:

- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_BASE_URL`

These variables are server-only and must not be exposed via `NEXT_PUBLIC_*`.

## Deployment Configuration Requirements

Set the above R2 environment variables in:

- Vercel project environment (production + preview as needed)
- Railway worker services

Do not commit real credentials.

## CDN Asset Delivery

Target URL format after custom domain mapping:

- `https://assets.techivano.com/assets/<file>`

Set:

- `R2_PUBLIC_BASE_URL=https://assets.techivano.com`

## Architecture Diagram

User uploads file  
-> Small file path:
  `POST /api/uploads/signed-url` -> direct `PUT` -> `POST /api/uploads/complete`  
-> Large file path:
  `POST /api/uploads/multipart/start` -> part URL/sign/upload loop -> `POST /api/uploads/multipart/complete`  
-> Cloudflare R2 stores object  
-> OCR queue job enqueued (for documents/ocr uploads)  
-> Railway worker processes OCR job  
-> Metadata/extracted text persisted

