# Cloudflare R2 Signed Uploads Implementation

Last updated: 2026-03-09

## Overview

Techivano now supports direct browser-to-R2 uploads using short-lived signed URLs.
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

## Frontend Upload Flow

File: `client/src/pages/AssetDetail.tsx`

Updated flow for asset photos:

1. Request signed URL from `/api/uploads/signed-url`
2. Upload file directly to R2 via signed `PUT` URL
3. Call `/api/uploads/complete`
4. Save resulting `fileUrl` + `fileKey` through existing `trpc.photos.create`

Upload progress is shown in UI during direct upload.

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
-> `POST /api/uploads/signed-url`  
-> Signed URL returned (5 min TTL)  
-> Browser uploads directly to Cloudflare R2  
-> `POST /api/uploads/complete`  
-> OCR queue job enqueued (for documents/ocr uploads)  
-> Railway worker processes OCR job  
-> Metadata/extracted text persisted

