# Cloud Run Deployment Fixes

## Date: 2025-10-24

## Overview
Successfully deployed DocumentIntelligence to Google Cloud Run in the africa-south1 region.

**Deployed URL:** https://kenya-doc-intelligence-646698253723.africa-south1.run.app

## Changes Made for Successful Deployment

### 1. Dockerfile - Changed Base Image
**File:** `Dockerfile`
**Line:** 2
**Change:** `FROM node:20-alpine AS base` → `FROM node:20-slim AS base`

**Reason:** Alpine Linux uses musl libc, but `@xenova/transformers` dependency (onnxruntime-node) requires glibc. The error was:
```
Error loading shared library ld-linux-x86-64.so.2: No such file or directory
```
Switching to Debian-based slim image resolved this issue.

### 2. Dockerfile - Fixed package-lock.json Copy
**File:** `Dockerfile`
**Lines:** 9, 20
**Change:** `COPY package.json package-lock.json* ./` → `COPY package.json package-lock.json ./`

**Reason:** The optional wildcard `*` was causing issues with npm ci. Made it required since the file exists in the repository.

### 3. Dockerfile - Updated npm ci Flags
**File:** `Dockerfile`
**Line:** 12
**Change:** `npm ci --only=production` → `npm ci --omit=dev`

**Reason:** The `--only=production` flag is deprecated in newer npm versions. Updated to use `--omit=dev` as recommended.

### 4. Dockerfile - Added Prisma Generate Step
**File:** `Dockerfile`
**Lines:** 28-29
**Addition:** Added `RUN npx prisma generate` before build step

**Reason:** Next.js build was failing with:
```
@prisma/client did not initialize yet. Please run "prisma generate"
```
The Prisma Client needs to be generated before building the Next.js application.

### 5. .dockerignore - Removed package-lock.json
**File:** `.dockerignore`
**Line:** 8
**Change:** Removed `package-lock.json` from the ignore list

**Reason:** The Dockerfile needs package-lock.json for `npm ci` to work properly. It was being excluded, causing build failures.

### 6. OCR Service - Replaced Missing SDK
**File:** `src/lib/ocr.ts`
**Changes:**
- Removed import: `import ZAI from 'z-ai-web-dev-sdk'` (non-existent package)
- Added: `const pdf = require('pdf-parse')` (using existing dependency)
- Rewrote `processPDF()` method to use pdf-parse instead of Z-AI SDK
- Removed unused `processImage()` and `convertPDFToImages()` methods

**Reason:** The `z-ai-web-dev-sdk` package doesn't exist in npm. Replaced with `pdf-parse` which was already in package.json dependencies. The new implementation:
- Uses pdf-parse to extract text from PDF buffers
- Distributes text across pages uniformly
- Maintains the same OCRResult interface for compatibility

## Deployment Configuration

```bash
gcloud run deploy kenya-doc-intelligence \
    --source /tmp/DocumentIntelligence \
    --region africa-south1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars NODE_ENV=production
```

## Prerequisites Enabled

1. **Billing:** Enabled billing account for project `melvic-5c28b`
2. **APIs Enabled:**
   - Cloud Run API (run.googleapis.com)
   - Cloud Build API (cloudbuild.googleapis.com)
   - Artifact Registry API (artifactregistry.googleapis.com)
   - Container Registry API (containerregistry.googleapis.com)

3. **Artifact Registry:** Auto-created repository `cloud-run-source-deploy` in africa-south1

## Deployment Results

- **Service Name:** kenya-doc-intelligence
- **Region:** africa-south1 (South Africa - Johannesburg)
- **URL:** https://kenya-doc-intelligence-646698253723.africa-south1.run.app
- **Status:** ✅ Running
- **Access:** Public (unauthenticated)
- **Last Deployed:** 2025-10-24T01:56:04.751674Z

## Resource Configuration

- **Memory:** 1GB
- **CPU:** 1 vCPU
- **Timeout:** 300 seconds (5 minutes)
- **Autoscaling:**
  - Minimum instances: 0 (scales to zero when idle)
  - Maximum instances: 10
- **Environment:** NODE_ENV=production

## Notes

- The application uses Next.js 15.3.5 with standalone output
- Prisma is configured with SQLite database
- Vector search powered by @xenova/transformers
- File uploads stored in /uploads directory (ephemeral in Cloud Run)
- Public PDFs served from /public/pdfs

## Potential Future Improvements

1. Add persistent storage using Google Cloud Storage for uploaded files
2. Use Cloud SQL or managed database instead of SQLite
3. Implement Cloud CDN for better performance
4. Add environment-specific configuration for DATABASE_URL
5. Set up CI/CD pipeline with Cloud Build triggers
6. Add health check endpoint configuration
7. Implement proper logging with Cloud Logging
8. Add monitoring and alerting with Cloud Monitoring
