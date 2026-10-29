# Convex migration (later)

Persistence is isolated in `apps/api/src/db/store.ts`. Shared types in `packages/shared` already match the planned tables:

`profiles`, `documents`, `document_versions`, `document_edits`, `processing_jobs`, `usage_records`, `subscriptions`

## Swap plan

1. Add a Convex project and schema mirroring those types.
2. Replace `store.*` methods with Convex queries/mutations (keep the same method names where possible).
3. Move file bytes to Convex file storage or S3; keep signed URL access.
4. Replace JWT auth with Convex Auth (email/password + Google).
5. Leave route handlers and the DOCX/AI services unchanged.

Until then, local JSON + `data/storage` is the source of truth.
