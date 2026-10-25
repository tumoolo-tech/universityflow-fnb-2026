# Mmereko partner API v1: the shared contract

This folder is copied as-is into UniversityFlow (`packages/cv/contract/`). Both sides test
against it (design: `docs/integrations/universityflow-partner-api.md` §6.3). A change here is a
reviewed change on both sides; within v1 changes are additive only (§5.4).

| File | What |
|---|---|
| `cv-profile.schema.json` | `uf-cv-profile/1` JSON Schema (copy of `schemas/uf-cv-profile-1.json`, also served at `GET /partner/v1/schema/cv-profile.json`) |
| `openapi.json` | The partner API's OpenAPI 3.1 document, generated from the running app |
| `cases.json` | Golden cases: each profile fixture's exact problems, and golden requests with status, code, problem paths and values that must never be echoed |
| `fixtures/profiles/*.json`, `fixtures/adverts/*.json` | Synthetic profiles and job adverts |
| `webhook-golden-vector.json` | One webhook body, secret, timestamp and the exact signature header |

Mmereko's tests (`tests/api/partner/test_contract.py`) fail if any copy drifts from its source.
Regenerate `openapi.json` after an API change:
`python -c "from services.api.app.partner.app import export_openapi; open('contract/openapi.json','w',encoding='utf-8',newline='\n').write(export_openapi())"`.

## Base URL and versions

`https://<partner host>/partner/v1` (the host is the af-south-1 cell, D3). Sandbox and production
are separate deployments with separate credentials; `GET /health` says `"sandbox": true|false`.
JSON in and out, camelCase. Unknown response fields must be ignored. A breaking change is
`/partner/v2`, announced, with `Deprecation`/`Sunset` headers on v1 for at least 12 months.

## Auth (OAuth 2.0 client credentials, RFC 6749 §4.4)

```
POST /partner/v1/oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)     (or client_id + client_secret in the form)

grant_type=client_credentials[&scope=cv:write cv:read]
```

`200 {"access_token": "<JWT>", "token_type": "Bearer", "expires_in": 600, "scope": "cv:write cv:read ..."}`
with `Cache-Control: no-store`. No `scope` = everything the client was granted. Errors are
problems that also carry the RFC 6749 `error` member: `401 invalid_client`,
`400 unsupported_grant_type`, `400 invalid_scope`, `400 invalid_request`.

- The token is an ES256 JWT, `aud: "mmereko-partner"`, `iss: "urn:mmereko:partner"`, valid
  **10 minutes**. Cache it in memory and refresh a minute before expiry. The signing keys are at
  `GET /partner/v1/.well-known/jwks.json` (two during rotation); a client need not verify the token.
- Scopes: `cv:write`, `cv:read`, `ats:scan`, `learner:read`, `learner:delete`.
- A client has **two live secrets** during rotation: add the new one, deploy it, revoke the old.
  A revoked client's tokens stop working at once (every call re-checks the client).
- Every other call: `Authorization: Bearer <access_token>`. Missing, invalid, expired or revoked:
  `401 invalid_token` with `WWW-Authenticate: Bearer`. Wrong scope: `403 insufficient_scope`
  (`requiredScope` says which).

## Endpoints

| Method | Path | Scope | Headers | Answer |
|---|---|---|---|---|
| POST | `/oauth/token` | none | | `200` token |
| POST | `/cv-drafts` | `cv:write` | `Idempotency-Key` | `202 {jobId, status: "queued"}`, `Location: /partner/v1/jobs/{jobId}` |
| POST | `/tailorings` | `cv:write` | `Idempotency-Key` | `202 {jobId, status: "queued"}` |
| GET | `/jobs/{jobId}` | `cv:read` | `X-Learner-Ref` | `200` job (below) |
| POST | `/jobs/{jobId}/ack` | `cv:write` | `Idempotency-Key`, `X-Learner-Ref` | `204`; `409 job_not_finished` while queued/running |
| POST | `/ats-scans` | `ats:scan` | `Idempotency-Key` | `200 {coveragePct, matched, missing, missingMustHaves, flags}` |
| DELETE | `/learners/{learnerRef}` | `learner:delete` | | `202 {deletionId, status}`, `Location: /partner/v1/deletions/{id}` |
| GET | `/deletions/{deletionId}` | `learner:delete` | | `200 {deletionId, learnerRef, status, counts, requestedAt, completedAt}` |
| GET | `/learners/{learnerRef}/export` | `learner:read` | | `200 {learnerRef, jobs: [...], deletions: [...]}` |
| GET | `/schema/cv-profile.json` | none | | the JSON Schema |
| GET | `/health` | none | | `{status, service, apiVersion, version, sandbox}` |
| GET | `/.well-known/jwks.json` | none | | the token signing keys |

### Write envelopes

```json
POST /cv-drafts
{ "learnerRef": "<uuid>",
  "consent": { "ref": "<uuid>", "version": "v4", "purposes": ["cv.draft", "cv.tailor"], "ageBand": "under-18" },
  "profile": { "schemaVersion": "uf-cv-profile/1.0", "...": "cv-profile.schema.json" },
  "render": { "template": "ats-classic", "paper": "A4", "locale": "en-ZA", "maxPages": 1 } }

POST /tailorings   the same, plus  "job": { "title": "...", "company": "...", "description": "... (<= 20,000 chars)" }
POST /ats-scans    { "learnerRef", "consent", "cvText": "<= 60,000 chars", "job": {...} }
```

- `learnerRef` and `consent.ref` are UUIDs. `consent.purposes` from `cv.draft`, `cv.tailor`,
  `cv.ats`, `cv.share`; `ageBand` is `under-18` or `18-plus`. `render` is optional.
- Purpose needed: drafts `cv.draft`; tailorings `cv.tailor`; ATS scans `cv.ats` or `cv.tailor`.
- Order of checks: no consent or no `consent.ref` → `403 consent_required`; envelope shape →
  `422 validation_failed`; purpose missing → `403 consent_required`; `under-18` with `cv.share` →
  `403 share_not_allowed`; the profile → `422 validation_failed` (or `422 schema_version` for an
  unknown major), paths prefixed `/profile`; the advert → paths prefixed `/job`.
- Body at most 256 KB (`413 payload_too_large`); not JSON → `400 invalid_json`.

### Idempotency

`Idempotency-Key` is required on every POST (8 to 255 of `A-Z a-z 0-9 - _ : .`; UniversityFlow
sends the `cv_documents` row id). Kept 24 hours with a hash of the route and the canonical body
(key order does not matter). Same key and body: the first answer again, with
`Idempotent-Replayed: true` (same `jobId`). Same key, different body or route:
`409 idempotency_conflict`. Missing: `400 idempotency_key_required`; malformed:
`400 idempotency_key_invalid`.

### Rate limits (`429 rate_limited`, `retryable: true`, `Retry-After: <seconds>`)

Per partner: 120 requests a minute (sandbox 30) and 2,000 CV jobs a day. Per learner: 10 drafts
and 20 tailorings a day (UTC days). A replay never counts as a new job. Schedule the retry at
`Retry-After` without spending an attempt.

### A job

```json
{ "jobId": "...", "kind": "cv-draft | tailoring", "status": "queued | running | succeeded | failed | expired",
  "learnerRef": "...", "createdAt": "2026-10-23T08:00:00Z", "finishedAt": null,
  "problem": { "code": "render_failed", "retryable": true },
  "result": {
    "markdown": "...", "gaps": ["..."],
    "ats": { "coveragePct": 78, "matched": [], "missing": [], "missingMustHaves": [], "flags": [] },
    "pdf": { "url": "https://...", "expiresAt": "...", "sha256": "<hex>", "bytes": 48211 },
    "promptVersion": "tailor-cv@2026-06-11.2",
    "usage": { "model": "claude-...", "inputTokens": 0, "outputTokens": 0, "costUsd": null } } }
```

`problem` only when `failed`; `result` only when `succeeded` and not yet collected. A draft has
`ats: null`, `promptVersion: null`, `usage.model: null`. The PDF link lives **at most 5 minutes**;
`GET` the job again for a fresh one while the content exists. Check the PDF's `sha256`, store it,
then `POST /jobs/{id}/ack`: the content is deleted and the job becomes `expired`. Unacknowledged
content is deleted 24 hours after the job was created; job records are kept 30 days.
Problem codes on a failed job: `render_failed`, `engine_failed`, `storage_failed`,
`attempts_exhausted` (retryable: submit again) and `validation_failed` (not retryable).
`X-Learner-Ref` must be the job's learner, or the answer is `404 not_found`.

## Webhooks (Mmereko → partner)

`POST <partner webhook URL>` with `Content-Type: application/json` and:

```
x-mmereko-signature: t=<unix seconds>,v1=<lowercase hex HMAC-SHA256(secret, "<t>.mmereko.<body>")>
x-mmereko-event-id: <uuid>          (same as body.id)
x-mmereko-event-type: cv.ready | tailor.ready | job.failed | learner.deleted
```

The body is the exact bytes signed: compact JSON, keys sorted, UTF-8. This is UniversityFlow's own
scheme (`packages/messaging/src/webhook.ts`) with the channel `mmereko`, so
`verifyWebhook(secret, 'mmereko', header, rawBody, now)` checks it unchanged: 5-minute window,
constant-time compare, secret at least 32 characters. See `webhook-golden-vector.json`.

```json
{"createdAt":"...","data":{"jobId":"...","kind":"cv-draft","learnerRef":"...","status":"succeeded"},"id":"<event uuid>","type":"cv.ready"}
job.failed adds  "problemCode": "...", "retryable": true|false  to data
learner.deleted: "data": {"deletionId": "...", "learnerRef": "...", "status": "completed"}
```

Events carry ids and states only, never CV text: fetch `GET /jobs/{jobId}`. Answer any `2xx`
quickly; anything else (or no answer within 10 s) is retried with backoff (30 s, doubling, at most
hourly) for **24 hours**, each attempt **signed afresh**, so the body (and `id`) repeats but the
header changes. Deduplicate by `id`/`jobId`; answer `200` to an unknown job id. One webhook secret
per partner; during rotation UniversityFlow accepts either of its two configured secrets.

## Problems (RFC 9457)

Every error is `application/problem+json`:
`{"type": "https://mmereko.app/problems/partner/<code>", "title", "status", "code", "retryable", "problems"?: [{"path", "code"}]}`.
A problem **never echoes a submitted value**: `problems` hold JSON-pointer paths and codes; an
unknown field is reported at its parent's path, never by name. Path codes: `required`,
`wrong_type`, `too_long`, `too_short`, `too_many`, `too_few`, `invalid_format`, `invalid_value`,
`out_of_range`, `unknown_field`, `duplicate`, `id_number`, `student_number`, `url_host`,
`schema_version`.

## Sandbox

`X-Sandbox-Simulate: 429 | 500 | timeout | slow-webhook | duplicate-webhook | expired-link`
(ignored in production). Tailoring is canned and deterministic (no model, `promptVersion:
"tailor-cv@sandbox"`, `usage.model: "sandbox"`). Synthetic data only.
