# Frontend Integration Guide — Cloudflare R2 Storage (Demo)

> **Purpose:** Rebuild the browser client for upload / view / download / delete after the POC frontend is discarded.  
> **Audience:** AI agents + developers wiring a Next.js (or any SPA) client to this NestJS module.  
> **Backend module:** `src/modules/storage/`  
> **API base:** `{API_ORIGIN}/api/v1/demo/storage`  
> **Default API origin:** `http://localhost:4000` (env: `NEXT_PUBLIC_API_URL`)

---

## 1. Architecture (critical)

| Concern | Where it runs |
|--------|----------------|
| Orchestration (`init`, `sign-parts`, `complete`, `file/url`, `delete`) | **NestJS backend** |
| File bytes upload (PUT parts) | **Browser → R2 directly** (presigned URLs) |
| File bytes download / view (GET) | **Browser → R2 directly** (presigned URL) |
| Next.js server / API routes | **Not used** for file transfer |

```
┌────────────┐   JSON APIs    ┌────────────┐   CreateMultipart / Sign / Complete
│  Browser   │ ─────────────► │  NestJS    │ ──────────────────────────────► R2
│  (client)  │                │  Storage   │
│            │ ◄───────────── │  Module    │ ◄──────────────────────────────
│            │  uploadId,     └────────────┘
│            │  storageKey,
│            │  presigned URLs
│            │
│            │   PUT part bytes (5MB chunks)
│            │ ───────────────────────────────────────────────────────────► R2
│            │
│            │   GET file (view / download) via signed URL
│            │ ───────────────────────────────────────────────────────────► R2
└────────────┘
```

**Do not** proxy file bytes through NestJS or Next.js. Only sign + orchestrate on the server.

---

## 2. Constants (frontend must match backend)

```ts
export const STORAGE_CONTEXTS = [
  'profile',
  'bio',
  'qr',
  'email-signature',
  'cv',
  'meeting-banner',
  'misc',
] as const;

export type StorageContext = (typeof STORAGE_CONTEXTS)[number];

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const PART_SIZE_BYTES = 5 * 1024 * 1024;      // 5MB chunks
export const PRESIGNED_URL_EXPIRES_IN = 15 * 60;     // backend signs for 15 min
```

### Storage key rules (built by backend on `/multipart/init`)

Mock user (hardcoded in service): `usr_999design`

| Condition | Path |
|-----------|------|
| `context === 'profile'` | `users/{userId}/profile/{uuid}{ext}` |
| other context + `projectId` | `users/{userId}/{context}/{projectId}/{uuid}{ext}` |
| other context, no `projectId` | `users/{userId}/{context}/{uuid}{ext}` |

---

## 2.1 R2 bucket folder structure

Bucket (example): `abouttme-dev`

Sab files **user-scoped** hoti hain. Root prefix hamesha:

```text
users/{userId}/...
```

Demo mock user:

```text
users/usr_999design/
```

### Full tree (conceptual)

```text
abouttme-dev/                          ← R2 bucket
└── users/
    └── usr_999design/                 ← MOCK_USER.id (baad mein real auth user id)
        ├── profile/                   ← context = "profile" (projectId IGNORE)
        │   ├── a1b2c3d4-....png
        │   └── e5f6g7h8-....jpg
        │
        ├── bio/                       ← context = "bio"
        │   ├── x9y8z7w6-....webp      ← no projectId
        │   └── prj_abc123/            ← with projectId
        │       └── m1n2o3p4-....png
        │
        ├── qr/
        │   ├── ....svg
        │   └── prj_xyz/
        │       └── ....png
        │
        ├── email-signature/
        │   ├── ....png
        │   └── prj_sig_01/
        │       └── ....jpg
        │
        ├── cv/
        │   ├── ....pdf
        │   └── prj_resume/
        │       └── ....pdf
        │
        ├── meeting-banner/
        │   ├── ....png
        │   └── prj_meet_9/
        │       └── ....jpg
        │
        └── misc/
            ├── ....bin
            └── prj_tmp/
                └── ....zip
```

### Path formulas

1. **Profile** (always flat under `profile/`, `projectId` never used):

```text
users/{userId}/profile/{uuid}{extension}
```

Example:

```text
users/usr_999design/profile/2bf62464-9b95-40c9-b0ec-a780dcd27f8c.svg
```

2. **Product contexts** (`bio` | `qr` | `email-signature` | `cv` | `meeting-banner` | `misc`)
   **with** `projectId`:

```text
users/{userId}/{context}/{projectId}/{uuid}{extension}
```

Example:

```text
users/usr_999design/bio/prj_abc123/7c8d9e0f-1111-2222-3333-444455556666.png
```

3. **Product contexts without** `projectId`:

```text
users/{userId}/{context}/{uuid}{extension}
```

Example:

```text
users/usr_999design/cv/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf
```

### How the filename is built

| Piece | Source |
|-------|--------|
| `{userId}` | Mock: `usr_999design` (later: authenticated user) |
| `{context}` | Frontend sends in `/multipart/init` |
| `{projectId}` | Optional DTO field (ignored when `context === 'profile'`) |
| `{uuid}` | Backend `randomUUID()` on init |
| `{extension}` | From original `fileName` via `path.extname` (e.g. `.png`, `.svg`) |

Object key = yeh pura path. R2 mein “folders” virtual hain — actually ek flat key string hai `/` separators ke saath.

### Ownership / security

Har mutate + signed-read check:

```text
storageKey.startsWith('users/' + MOCK_USER.id + '/')
```

Iske bahar ka key → `403 Forbidden`.

### Frontend tip

Upload ke baad jo `storageKey` mile, wahi save karo DB / state mein. View, download, delete sab isi key se chalte hain — public permanent URL nahi.

---

## 3. Response envelope

All NestJS success responses are wrapped by `TransformInterceptor`:

```ts
{ success: true, data: T }
```

Errors look like:

```ts
{ statusCode: number, message: string | string[], timestamp: string }
```

Frontend helpers must unwrap `data` on success and surface `message` on failure.

---

## 4. API reference

Base URL: `{API_ORIGIN}/api/v1/demo/storage`

### 4.1 Init multipart — `POST /multipart/init`

**Body**

```ts
{
  fileName: string;      // e.g. "avatar.png"
  fileType: string;      // MIME, fallback "application/octet-stream"
  fileSize: number;      // bytes, must be <= 20MB
  context: StorageContext;
  projectId?: string;    // ignored for profile; optional otherwise
}
```

**Response `data`**

```ts
{ uploadId: string; storageKey: string }
```

---

### 4.2 Sign parts — `POST /multipart/sign-parts`

**Body**

```ts
{
  storageKey: string;
  uploadId: string;
  partNumbers: number[]; // 1-based, e.g. [1, 2, 3]
}
```

**Response `data`**

```ts
Array<{ partNumber: number; presignedUrl: string }>
```

---

### 4.3 Complete multipart — `POST /multipart/complete`

**Body**

```ts
{
  storageKey: string;
  uploadId: string;
  parts: Array<{ partNumber: number; eTag: string }>; // eTag from R2 PUT response header
}
```

**Response `data`**

```ts
{ storageKey: string; location: string | null; etag: string | null }
```

---

### 4.4 View / download URL — `POST /file/url`

**Body**

```ts
{
  storageKey: string;
  disposition?: 'inline' | 'attachment'; // default inline
  fileName?: string;                     // Content-Disposition filename
}
```

**Response `data`**

```ts
{
  storageKey: string;
  url: string;           // temporary signed GET URL
  disposition: 'inline' | 'attachment';
  expiresIn: number;     // seconds (900)
}
```

| Goal | `disposition` | Client action |
|------|---------------|---------------|
| View / preview | `inline` | `window.open(url)` or `<img src={url}>` |
| Download | `attachment` | create `<a href={url} download>` and click |

**Download is NOT chunked.** One signed GET URL; browser fetches the whole object (may stream natively).

---

### 4.5 Delete — `DELETE /file`

**Body**

```ts
{ storageKey: string }
```

**Response `data`**

```ts
{ deleted: true; storageKey: string }
```

Ownership check: `storageKey` must start with `users/usr_999design/`.

---

## 5. Multipart upload algorithm (implement exactly)

Runs **entirely in the browser**.

```
1. Validate file.size <= MAX_FILE_SIZE_BYTES
2. partCount = max(1, ceil(file.size / PART_SIZE_BYTES))
3. partNumbers = [1 .. partCount]
4. POST /multipart/init  → { uploadId, storageKey }
5. POST /multipart/sign-parts with partNumbers → [{ partNumber, presignedUrl }]
6. For each partNumber (sequential is fine for demo):
     start = (partNumber - 1) * PART_SIZE_BYTES
     end   = min(start + PART_SIZE_BYTES, file.size)
     chunk = file.slice(start, end)
     PUT  presignedUrl  with body = chunk  (NO custom Content-Type required)
     Read ETag header from response (required!)
     Collect { partNumber, eTag }
7. POST /multipart/complete with collected parts
8. Done — keep storageKey for view / download / delete
```

### Reference TypeScript (client)

```ts
async function putPart(url: string, blob: Blob): Promise<string> {
  const res = await fetch(url, { method: 'PUT', body: blob });
  if (!res.ok) throw new Error(`Part upload failed (${res.status})`);
  const eTag = res.headers.get('ETag') ?? res.headers.get('etag');
  if (!eTag) throw new Error('Missing ETag from R2 part upload response');
  return eTag;
}

async function uploadFileMultipart(
  file: File,
  options: { context: StorageContext; projectId?: string; onProgress?: (p: Progress) => void },
) {
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('File exceeds the 20MB limit');

  const partCount = Math.max(1, Math.ceil(file.size / PART_SIZE_BYTES));
  const partNumbers = Array.from({ length: partCount }, (_, i) => i + 1);

  const { uploadId, storageKey } = await apiPost('/multipart/init', {
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    context: options.context,
    projectId: options.projectId || undefined,
  });

  const signed = await apiPost('/multipart/sign-parts', {
    storageKey,
    uploadId,
    partNumbers,
  });

  const byPart = new Map(signed.map((s) => [s.partNumber, s.presignedUrl]));
  const parts: Array<{ partNumber: number; eTag: string }> = [];

  for (const partNumber of partNumbers) {
    const url = byPart.get(partNumber)!;
    const start = (partNumber - 1) * PART_SIZE_BYTES;
    const end = Math.min(start + PART_SIZE_BYTES, file.size);
    const eTag = await putPart(url, file.slice(start, end));
    parts.push({ partNumber, eTag });
  }

  return apiPost('/multipart/complete', { storageKey, uploadId, parts });
}
```

### Progress phases (UI)

```ts
type Phase = 'init' | 'signing' | 'uploading' | 'completing' | 'done';
```

Report `uploadedBytes / totalBytes` and `currentPart / totalParts` during `uploading`.

---

## 6. View / download / delete flows

### View

```ts
const { url } = await apiPost('/file/url', {
  storageKey,
  disposition: 'inline',
  fileName: originalName,
});
window.open(url, '_blank', 'noopener,noreferrer');
// Optional image preview: <img src={url} /> for png/jpg/gif/webp/svg/avif
```

### Download

```ts
const { url } = await apiPost('/file/url', {
  storageKey,
  disposition: 'attachment',
  fileName: originalName,
});
const a = document.createElement('a');
a.href = url;
a.download = originalName || storageKey.split('/').pop() || 'download';
a.rel = 'noopener';
document.body.appendChild(a);
a.click();
a.remove();
```

### Delete

```ts
await apiDelete('/file', { storageKey });
// Clear local lastKey / preview state
```

---

## 7. Suggested UI for a demo page (`/demo/storage`)

**Page route:** `/demo/storage` (client component)

**Controls**
- Context `<select>` over `STORAGE_CONTEXTS`
- Optional Project ID input (disabled when `context === 'profile'`)
- Drag-and-drop / file picker (reject > 20MB)
- Buttons: **Upload**, **View**, **Download**, **Delete**
- Progress bar during multipart phases
- After success: show `storageKey`; for images, show inline preview via signed `inline` URL

**Env**

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 8. Cloudflare R2 CORS (required for browser PUT/GET)

Without this, `sign-parts` succeeds but browser `PUT` to R2 fails with CORS.

Bucket settings → CORS:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "etag"],
    "MaxAgeSeconds": 3600
  }
]
```

- Add production frontend origins to `AllowedOrigins` later.
- **`ExposeHeaders: ETag` is mandatory** — complete multipart needs the ETag from each PUT.

---

## 9. Backend pitfalls already fixed (do not regress)

1. **S3 client for R2** must use:
   - `region: 'auto'`
   - `endpoint: R2_ENDPOINT`
   - `forcePathStyle: true`
   - `requestChecksumCalculation: 'WHEN_REQUIRED'`
   - `responseChecksumValidation: 'WHEN_REQUIRED'`  
   Flexible CRC32 checksums in AWS SDK v3 break browser PUTs (extra signed query params → CORS-looking failures).

2. Env vars:
   - `R2_ENDPOINT`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME` (real bucket name, not placeholder)

3. Ownership: mutate/read only keys under `users/{MOCK_USER.id}/`.

---

## 10. Minimal client API helpers

```ts
const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/demo/storage`;

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    throw new Error(msg || res.statusText);
  }
  return json.data as T;
}

async function apiDelete<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    throw new Error(msg || res.statusText);
  }
  return json.data as T;
}
```

---

## 11. Checklist to recreate frontend later

- [ ] Client-only page (no Next.js server upload)
- [ ] Constants: 20MB max, 5MB parts, storage contexts
- [ ] `apiPost` / `apiDelete` unwrapping `{ success, data }`
- [ ] `uploadFileMultipart`: init → sign → PUT parts → complete
- [ ] Capture **ETag** from each R2 PUT
- [ ] View via `/file/url` + `disposition: 'inline'`
- [ ] Download via `/file/url` + `disposition: 'attachment'` (single GET, not chunked)
- [ ] Delete via `DELETE /file`
- [ ] Confirm R2 CORS + `ExposeHeaders: ETag`
- [ ] Point `NEXT_PUBLIC_API_URL` at NestJS

---

## 12. Related backend files

| File | Role |
|------|------|
| `src/modules/storage/storage.controller.ts` | Routes |
| `src/modules/storage/storage.service.ts` | R2 S3 client + key builder |
| `src/modules/storage/dto/*.ts` | class-validator DTOs |
| `src/config/env.schema.ts` | R2 env validation |
| `.env.example` | Env template |

When asked to “recreate the storage frontend like before,” follow this document end-to-end.
