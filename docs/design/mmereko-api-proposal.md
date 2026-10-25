# Mmereko as UniversityFlow's CV engine: the partner API (design proposal)

> **Approved by the owner on 2026-10-23 with every recommended answer, D1 to D17**, and built
> against the fake on `phase-6/cv-core` (UniversityFlow's side, §10.1 to §10.4 and §10.6 steps 1
> to 3). The migration is **0035** (0031 to 0034 were taken at merge time). `UF_CV` stays off for learners
> until the agreement, Mmereko's af-south-1 partner cell and consent v4 / adult-v3 exist (D1, D8).
> The text below is the proposal as approved.
>
> **Status at writing: proposal, not approved.** Written by planning agent P2 on 2026-10-23 at the owner's
> request (the next wave, memory note "hackathon-demo-and-next-wave"). Read-only review of the
> Mmereko repository (`C:\Users\tumom\Tumoolo-Tech\Mmereko`, at `67fe86c`): code, architecture docs
> and configs only. No `.env`, master CV, job folder, STATUS file or other personal file was opened.
> Nothing in either product was changed.

Date: 2026-10-23.

**Already agreed by the owner (this proposal builds on these and does not reopen them):** Mmereko
is the CV engine; the two talk **server to server**; **opt-in per learner**, with the consent
recorded; a **pseudonymous learner reference**, never a phone or ID number; **recruiter sharing
only from 18** (under-18s get drafts only); a **written Tumoolo–Mmereko agreement**.

## 0. Summary

A learner who opts in gets a **My CV** page (web `/cv`, the app's My CV screen). UniversityFlow
already knows much of what goes on a first CV: school, grade, confirmed marks, the university and
course they accepted, the modules they registered for. The learner adds what only they know:
projects (with evidence links such as a public GitHub repository or a demo), skills, part-time
work, volunteering, awards. They tick what goes on the CV. UniversityFlow sends that selection to
Mmereko, which returns an ATS-safe PDF. A learner can also paste a job advert to get a **tailored
CV** and an **ATS scan** (how well the CV covers the advert's keywords). From 18, with their own
agreement, they can make a **share link** for a recruiter.

The design, both sides:

- **Mmereko adds a versioned partner API** (`/partner/v1`, §2): create a CV draft, tailor to a job
  advert, ATS scan, job status with a short-lived PDF link, acknowledge (delete now), delete and
  export a learner's data, and signed webhooks (`cv.ready`, `tailor.ready`, `job.failed`,
  `learner.deleted`). Auth is OAuth 2.0 client credentials per partner, plus a learner reference
  and a consent reference on every call (§4).
- **Mmereko works as a stateless engine for partner learners** (recommended, D2): UniversityFlow
  keeps the CV of record (the learner's entries, the generated text, the PDF) in its own database
  and S3 in af-south-1; Mmereko holds a request's content only until UniversityFlow has collected
  the result, and at most 24 hours. That keeps "student data stays in South Africa" as true as it
  is today, makes deletion simple and avoids creating Mmereko accounts for minors.
- **The base CV needs no AI** (recommended, D7): Mmereko renders the learner's own entries into its
  ATS template deterministically. Only **tailoring** uses a model, and only Anthropic (D4), which
  the consent wording already names. The ATS scan is Mmereko's deterministic scorer (no model).
- **UniversityFlow builds** (§10): a `packages/cv` package with the `CvEngine` interface, its fake
  and contract tests (D8); a Mmereko adapter listed only after it passes the contract against
  Mmereko's sandbox; routes; the web page and app screen; migration **0031** (next free in this
  worktree; the integrator confirms at merge, §10.4); job kinds with ID-only payloads; and the
  privacy, consent and store-answer updates.
- **What has to happen before any learner uses it:** the written agreement; Mmereko's hosting
  region settled (§8, D3); guardian consent v4 and adult agreement adult-v3 naming Mmereko, after
  legal review (§9, D8); Mmereko's own build list (§12).

### Plan-drift flags (the owner should know before saying yes)

1. **This pulls Stage 8 forward.** "CV help" is Stage 8, Career (`planning.md:318`), in **Phase 9,
   November 2028** (`planning.md:610`). Building it now is a new item ahead of Phases 6–8. It
   changes no locked decision by itself. *Plan-keeping option:* approve this design now, build the
   UniversityFlow side against the fake now (D8 allows it), and switch it on for learners in
   Phase 9. *Recommended:* build against the fake after the hackathon, ship to learners only when
   the agreement, the region and consent v4 are done (D1).
2. **A new operator, and probably a new cross-border transfer.** "Student data stays in South
   Africa" (CLAUDE.md, locked decisions; `planning.md` §16.1 Hosting and Database) is today
   qualified only by the AI and messaging providers named in the consent wording. Mmereko is on
   **Supabase**, whose region is **not stated anywhere in the Mmereko repository**
   (`docs/architecture/14-supabase-setup.md` names only the project ref), and its API host is
   undecided (`docs/architecture/02-system-architecture.md` "Hosting (suggested, not locked)";
   `09-tech-stack-decisions.md` "Open decisions"). As far as this agent knows (to June 2026),
   Supabase offers no Cape Town region. Sending learners' CV data to Mmereko as it is today would
   be a cross-border transfer under POPIA s72 and would break the locked decision unless the owner
   re-plans it. *Plan-keeping option (recommended):* Mmereko serves partner traffic from
   af-south-1, statelessly (§8, D2, D3).
3. **Consent v4 grows again.** Guardian v4 / adult-v3 is already queued for the profile photo and
   the words in plan maps, owed legal review (A11-10; `docs/store/privacy-and-data-safety.md`).
   Mmereko as an operator (and, for 18+, recruiter sharing) must be named in it. *Recommended:* one
   v4 for all three, one legal review (D8).
4. **Recruiter sharing is a new purpose and a disclosure to third parties.** UniversityFlow today
   discloses nothing about a learner to anyone but its operators. A share link makes the learner's
   CV visible to whoever holds the link. Only for 18+, with their own agreement, revocable and
   expiring (§9.3, D5).
5. **Mmereko's other model providers.** Mmereko can run on Gemini or Groq (`services/api/app/config.py`
   `llm_provider`; `services/api/app/services/claude.py`). Neither is named in UniversityFlow's
   consent wording (Gemini is demo-only and refused in production, per the owner's 2026-10-23
   decision). Partner traffic must be pinned to Anthropic (D4).
6. **Hard rule 3 reaches the CV.** A module name or course name taken from an **unverified**
   catalogue record must not appear on a CV a learner downloads ("Unverified never reaches a
   student"). The CV uses the learner's own **confirmed** rows (registrations, offers, marks:
   hard rule 6), and a catalogue name only where the record is verified (§3.3).
7. **Academic integrity (§8.4).** Tailoring is AI-written text about the learner. It is not
   assessed work, so §8.4 allows it, but it must stay "truth only": Mmereko's tailoring already
   forbids invention (`packages/prompts/tailor-cv.md`, "Truth only"), and the learner confirms the
   result before it is final or shareable (§10.6). The agent still never writes the portfolio
   project itself.
8. **The hackathon demo.** The judge demo is synthetic-only. The CV feature should appear there as
   an honest "coming next" card, or on the fake engine only, never calling Mmereko (D14).

## 1. What exists in Mmereko today vs what's missing

Mmereko is a FastAPI service (`services/api`), a Next.js web app and an Expo app, on Supabase
(Postgres, Auth, Storage), with a CLI workspace it grew from (`tools/`, `.claude/skills/`). Its
API is built for **one signed-in user working on their own CV**; there is no partner surface yet.

| Area | Exists today | Missing for a partner |
|---|---|---|
| **API** | `/api/v1` user API, routers wired in `services/api/app/main.py`: applications (`routers/applications.py`), master CV (`routers/cv.py`), GitHub (`routers/github.py`), billing (`routers/billing.py`), profile (`routers/me.py`) | A partner router (`/partner/v1`), its OpenAPI document and JSON Schema |
| **Auth** | Supabase user JWT verified by JWKS, HS256 fallback (`services/api/app/deps/auth.py`); `user_id` from `sub` | Client credentials per partner, scopes, key rotation, learner and consent references (§4) |
| **CV data model** | `cvs` with `raw_text` (Markdown) and an unused `structured` jsonb (`db/migrations/20260610_03_cv.sql`; `routers/cv.py` stores pasted Markdown only); template `cv/master-cv.example.md` | A structured profile in, JSON Resume-compatible (§3); a deterministic profile → Markdown renderer |
| **Users** | `public.users.id` references `auth.users` (`db/migrations/20260610_01_identity.sql`); `email` is NOT NULL; a trigger mirrors sign-ups (`20260610_11_seed_free_plan.sql`) | A way to process a learner without a Supabase account (stateless jobs, D2) |
| **Generation** | Parse job → match repos → tailor → verify claims → ATS → cover letter → PDF (`services/api/app/services/pipeline.py` `run_stage_a`, `run_stage_b`; prompts in `packages/prompts/manifest.json`) | Stage functions that take inputs instead of reading `Application`/`Cv`/`Repository` rows; a "base CV, no job advert" path; projects supplied in the request instead of synced repositories |
| **Jobs** | FastAPI `BackgroundTasks`, in process (`routers/applications.py:61`; `services/api/README.md` "Background work": "the Redis/arq worker split is the scale-up path"); `generation_jobs` table with retries fields (`models/generation.py`) | A durable queue (a restart today loses a running job), so a partner's job is never silently dropped |
| **Idempotency** | `generation_jobs.idempotency_key` column (`models/generation.py:28`), documented for `POST /applications` (`docs/architecture/05-api-design.md`) | Enforcement: nothing in `services/api` reads the column |
| **Rate limits** | Planned ("Rate limiting per user (Redis)", `docs/architecture/08-security-privacy.md`); monthly plan quotas (`services/api/app/services/quota.py`) | Per-partner and per-learner rate limits with `429` and `Retry-After` |
| **ATS scoring** | Deterministic, no model: `services/api/app/services/atsscan.py` wraps `tools/ats-check.py` (coverage %, matched, missing, missing must-haves, formatting flags) | A standalone endpoint (today only inside the pipeline) |
| **PDF** | Markdown → pandoc → HTML → headless Chrome print, wkhtmltopdf fallback (`tools/build-pdf.py`; called by `services/api/app/services/pdfrender.py`); `services/pdf/README.md` plans a separate service | Escaping of partner text (pandoc Markdown passes raw HTML through by default), a renderer with no network and no local-file access; the wkhtmltopdf fallback runs with `--enable-local-file-access` (`tools/build-pdf.py:117-122`) and must be off for partner jobs (§7.4) |
| **PDF links** | Supabase Storage signed URLs, default **3600 s** (`services/api/app/services/storage.py:46`) | Links of at most 5 minutes for partner results, and delete-on-collect |
| **GitHub matching** | OAuth provider token or PAT; full and delta sync (`services/api/app/services/reposync.py`; docs 06, 18); providers GitHub, GitLab, Hugging Face, Kaggle, Notion, generic URL/PDF (`tools/*-sync.py`, `tools/portfolio-ingest.py`) | Matching over **projects given in the request** (UniversityFlow sends evidence links; Mmereko fetches nothing for partner learners in v1, D10) |
| **Proof pages** | Public "Verified Project Pages" at `mmereko.app/p/<slug>` (`docs/architecture/11-private-repo-referencing.md`; `db/migrations/20260610_10_showcases.sql`) | Must be **off** for partner learners (they would be public pages about minors) |
| **Webhooks** | Inbound only: Paystack HMAC (`supabase/functions/paystack-webhook`) | Outbound signed webhooks to partners, with retries |
| **Deletion / export** | Documented: `DELETE /me`, `POST /me/export` (`docs/architecture/05-api-design.md`; `08-security-privacy.md`); FK cascades on `users` | **Not implemented**: `routers/me.py` has only `/me/profile`. A partner learner delete and export |
| **Audit log** | `audit_logs` table, service-role only (`db/migrations/20260610_09_audit.sql`) | Writes: nothing in `services/api` writes to it |
| **Logs** | Unhandled errors logged with the exception (`main.py` `unhandled_exception_handler`); some error messages quote input (`routers/cv.py`, "Could not read PDF text: {exc}") | IDs-only logging for partner traffic; no prompt or CV content in logs |
| **Other mail** | Follow-up survey e-mails via Resend (`supabase/functions/followups-cron`) | Must never reach partner learners (they have no Mmereko account or e-mail) |
| **Model providers** | Anthropic, Gemini, Groq, one global switch (`config.py` `llm_provider`) | Per-partner pinning to Anthropic (D4); usage reported back per job |
| **Hosting** | Web on Vercel (`apps/web/DEPLOYMENT.md`); API host undecided (`infra/README.md`, doc 02, ADR "Open decisions"); Supabase region unstated | A decided region for partner traffic (§8) |
| **Tests** | pytest with mocks (`tests/api`, `tests/worker`, `tests/db`), CI (`.github/workflows/ci.yml`), "no stage without tests" (doc 12) | Partner contract tests, sandbox fixtures (§6) |
| **Licence** | "Proprietary — All Rights Reserved" (`README.md`, `LICENSE`) | The agreement grants UniversityFlow the right to use it (§9.4) |

## 2. The partner API (Mmereko adds)

Base URL `https://<mmereko-partner-host>/partner/v1` (the host is D3's answer). A separate prefix
from the user API's `/api/v1`, so a partner token can never call a user route or the reverse.
JSON in and out, camelCase (as Mmereko's doc 15). Errors are RFC 9457 `application/problem+json`
with a stable `code` and a `retryable` flag, and **never echo a submitted value**.

| Method | Path | Scope | What it does | Answer |
|---|---|---|---|---|
| POST | `/oauth/token` | — | Client credentials → access token (§4.1) | `200` |
| POST | `/cv-drafts` | `cv:write` | A base CV from a profile, no job advert, no model (D7) | `202` `{ jobId, status: "queued" }` |
| POST | `/tailorings` | `cv:write` | A CV tailored to one job advert (Anthropic only) | `202` `{ jobId, status: "queued" }` |
| GET | `/jobs/{jobId}` | `cv:read` | Status, and when done: the CV text, gaps, ATS result, a PDF link valid ≤ 5 min, usage | `200` |
| POST | `/jobs/{jobId}/ack` | `cv:write` | "Collected": Mmereko deletes the job's content now | `204` |
| POST | `/ats-scans` | `ats:scan` | Deterministic ATS score of a CV against a job advert | `200` (synchronous) |
| DELETE | `/learners/{learnerRef}` | `learner:delete` | Delete everything held for this learner, in-flight jobs cancelled | `202` `{ deletionId }` |
| GET | `/deletions/{deletionId}` | `learner:delete` | Done or not, with counts by kind | `200` |
| GET | `/learners/{learnerRef}/export` | `learner:read` | Everything Mmereko still holds for this learner (POPIA s23) | `200` |
| GET | `/schema/cv-profile.json` | — | The JSON Schema for §3 | `200` |
| GET | `/health` | — | Liveness, version, `sandbox: true/false` | `200` |

Job states: `queued → running → succeeded | failed`, and `expired` once the content was deleted
(acknowledged, or 24 hours passed).

**Every write carries an envelope:**

```json
{
  "learnerRef": "3f0c2a9e-6b7d-4e21-9a0f-1c2d3e4f5a6b",
  "consent": {
    "ref": "8d1e7c55-2b3a-4f60-8e19-0a1b2c3d4e5f",
    "version": "v4",
    "purposes": ["cv.draft", "cv.tailor"],
    "ageBand": "under-18"
  },
  "profile": { "...": "§3" },
  "render": { "template": "ats-classic", "paper": "A4", "locale": "en-ZA", "maxPages": 1 }
}
```

`/tailorings` adds `"job": { "title": "…", "company": "…", "description": "… (≤ 20,000 chars)" }`.
`ageBand` lets Mmereko refuse what an under-18 may not have (§9.3), as a second wall behind
UniversityFlow's own. No date of birth is sent.

**A finished job** (`GET /jobs/{jobId}`):

```json
{
  "jobId": "…", "kind": "tailoring", "status": "succeeded",
  "result": {
    "markdown": "…the CV text…",
    "gaps": ["The advert asks for a driver's licence; the profile has none."],
    "ats": { "coveragePct": 78, "matched": ["Python"], "missing": ["Docker"],
             "missingMustHaves": [], "flags": [] },
    "pdf": { "url": "https://…signed…", "expiresAt": "…", "sha256": "…", "bytes": 48211 },
    "promptVersion": "tailor-cv@2026-06-11.2",
    "usage": { "model": "claude-…", "inputTokens": 0, "outputTokens": 0, "costUsd": 0 }
  }
}
```

`usage` lets UniversityFlow keep cost per student (D5 in planning.md §0). `gaps` mirrors Mmereko's
existing gap list (`pipeline.py` `split_gaps`).

**Limits:** a request body ≤ 256 KB; a profile ≤ 40 entries per section; every string plain text,
trimmed, with per-field caps (§3.2); every URL `https:` only, ≤ 500 characters.

## 3. The shared schema: `uf-cv-profile/1`

### 3.1 Shape

JSON Resume-compatible where it fits, so Mmereko can also take a JSON Resume from elsewhere later.
Fields JSON Resume does not have sit under names prefixed `x` and are optional.

```json
{
  "schemaVersion": "uf-cv-profile/1.0",
  "basics": {
    "name": "Naledi M.",
    "label": "First-year BSc Computer Science student",
    "email": null,
    "phone": null,
    "summary": "…the learner's own words, optional…",
    "location": { "city": "Johannesburg", "region": "Gauteng", "countryCode": "ZA" },
    "profiles": [ { "network": "GitHub", "url": "https://github.com/…" } ]
  },
  "education": [
    {
      "institution": "University of Johannesburg",
      "area": "Computer Science",
      "studyType": "BSc",
      "startDate": "2027-02",
      "endDate": null,
      "courses": ["CSC1A10 Introduction to Programming"],
      "xModules": [
        { "code": "CSC1A10", "name": "Introduction to Programming", "year": 2027, "term": "S1",
          "credits": 15, "result": null }
      ],
      "xSource": "confirmed-registration"
    },
    {
      "institution": "…school name…",
      "studyType": "National Senior Certificate",
      "endDate": "2026-12",
      "xSubjects": [ { "name": "Mathematics", "result": "78%" } ],
      "xSource": "confirmed-report"
    }
  ],
  "projects": [
    {
      "name": "Campus bus tracker",
      "description": "…",
      "highlights": ["…"],
      "keywords": ["Python", "Flask"],
      "startDate": "2027-03",
      "endDate": "2027-05",
      "url": "https://github.com/…",
      "roles": ["Solo developer"],
      "xEvidence": [
        { "kind": "repository", "url": "https://github.com/…", "label": "Source code" },
        { "kind": "demo", "url": "https://…", "label": "Live demo" }
      ],
      "xLinkedModules": ["CSC1A10"]
    }
  ],
  "skills": [ { "name": "Programming", "keywords": ["Python", "Java"] } ],
  "work": [
    { "name": "…", "position": "Weekend shop assistant", "startDate": "2026-06",
      "endDate": "2026-12", "highlights": ["…"] }
  ],
  "volunteer": [],
  "awards": [ { "title": "…", "date": "2026-11", "awarder": "…" } ],
  "certificates": [],
  "languages": [ { "language": "isiZulu", "fluency": "Native" } ],
  "interests": []
}
```

- `url` on a project is its first evidence link, for JSON Resume readers; `xEvidence` holds all.
- `xModules` is the structured form; `courses` the JSON Resume strings, generated from it.
- Dates are ISO 8601 `YYYY-MM` (or `YYYY`), `endDate: null` for ongoing.
- **Left out on purpose:** `references` (other people's personal information), `image` (Mmereko's
  ATS rules forbid photos, `CLAUDE.md` "ATS rules"; and the profile photo never leaves
  UniversityFlow), date of birth, gender, ID number, home address, student number.

### 3.2 Rules both sides enforce (each with a test on each side)

- **No ID or student number shapes** anywhere (the A11-17 refusal UniversityFlow already applies
  in the data layer, `packages/db/src/errors.ts`, reused for CV entries; Mmereko refuses the same
  shapes with `422`, without echoing them).
- **Plain text only.** No HTML, no Markdown control syntax passes through; Mmereko escapes every
  string before it reaches pandoc or the browser (§7.4).
- **Caps:** name 80, label 120, summary 600, description 600, highlight 200 (≤ 5 per entry),
  keyword 40 (≤ 15), title 120.
- **URLs:** `https:` only; no credentials in the URL; no IP-address hosts; no `localhost`.
  **Neither side fetches them** in v1 (D10): they are printed as links, so there is no server-side
  request to forge.
- `basics.email` and `basics.phone` are **null unless the learner typed them on the CV page**
  (D9). UniversityFlow never fills them from the account's sign-in phone.

### 3.3 Where each section comes from in UniversityFlow

| Section | Source | Rule |
|---|---|---|
| School, subjects, marks | `reports`, `report_marks`, confirmed only (hard rule 6) | Off by default; the learner ticks each subject (D11) |
| University, course | An **accepted** offer (`offers`), as the learner confirmed it | The course name as on the learner's confirmed offer, not from a draft catalogue record (hard rule 3) |
| Modules | `registrations` (confirmed rows) | A module's name from the confirmed row; a catalogue name only when that record is verified |
| Projects, skills, work, volunteering, awards, languages | New `cv_entries` (the learner's own words) | Crisis-checked on save (§7.5); words wait for consent v4 (§9) |
| Name, city | `profiles` (first name), learner-typed surname and city on the CV page | Optional |

## 4. Auth

### 4.1 Partner credentials

- **OAuth 2.0 client credentials** (RFC 6749 §4.4): UniversityFlow posts `client_id` and
  `client_secret` to `/oauth/token` and gets a JWT access token valid **10 minutes**, scoped
  (`cv:write cv:read ats:scan learner:read learner:delete`), audience `mmereko-partner`. Tokens are
  cached in memory by the adapter and refreshed a minute before expiry.
- One partner record per organisation, one client per environment (sandbox, production). Secrets
  are stored by Mmereko as **hashes**, generated with ≥ 256 bits, shown once.
- **Rotation:** each client may hold **two active secrets**. Rotate by adding the new one, deploying
  it to Vercel's environment, then revoking the old. Rotate every 90 days and at once on suspicion.
  Mmereko signs its access tokens with a key it publishes as JWKS, rotated the same way (Mmereko's
  user auth already handles a JWKS refresh on an unknown `kid`, `deps/auth.py`).
- **Webhook secret:** a separate shared secret per partner (random, at least 32 characters:
  UniversityFlow's `MIN_WEBHOOK_SECRET_LENGTH`), also two-at-a-time during rotation: UniversityFlow accepts a
  signature from either while both are configured.
- Optional later: mutual TLS, or an IP allow-list of Vercel's egress, once the host is chosen.

*Alternatives:* a static API key (simpler, but no expiry, no scopes, a leaked key works until
noticed) or HMAC-signed requests (no token endpoint, but both sides must canonicalise requests
identically). **Recommended: client credentials (D12).**

### 4.2 The learner and the consent

- **`learnerRef`**: a random UUID UniversityFlow makes **per learner, for Mmereko only**, stored in
  `cv_links` (§10.4). It is not the UniversityFlow student id, so Mmereko's records can't be joined
  to UniversityFlow's by id alone, and it is never a phone, ID or student number. A learner who
  withdraws and later opts in again gets a new one.
- **`consent.ref`**: the id of UniversityFlow's consent record for this opt-in, with the wording
  version and the purposes the learner agreed to. Mmereko records it on every job and refuses
  (`403 consent_required`) a request without one, or for a purpose not in it. Mmereko cannot check
  UniversityFlow's database, so the agreement makes UniversityFlow warrant that a ref is current;
  withdrawal reaches Mmereko as a deletion (§7.3).
- **Pseudonymous is not anonymous.** A CV names its learner. The reference only keeps identifiers
  out of the join keys and the logs. Mmereko is an **operator** processing personal information,
  and under the agreement it acts only on UniversityFlow's instructions (POPIA ss 20–21).

## 5. Reliability: idempotency, rate limits, retries, timeouts, versioning

### 5.1 Idempotency

- `Idempotency-Key` header, **required** on every POST. UniversityFlow uses the row id of the
  `cv_documents` row the request is for (a UUID, which `validateIdempotencyKey` in
  `packages/jobs/src/payload.ts` accepts), so a retried job sends the same key.
- Mmereko keeps a key for **24 hours** with a hash of the body: the same key and body returns the
  first answer (same `jobId`); the same key with a different body is `409 idempotency_conflict`.

### 5.2 Rate limits

- Per partner: 120 requests a minute, 2,000 CV jobs a day (sandbox: 30 a minute). Per learner: 10
  drafts and 20 tailorings a day. Mmereko answers `429` with `Retry-After`.
- UniversityFlow's own per-learner limit sits in front (5 drafts, 10 tailorings, 20 ATS scans a
  day), so a learner sees our message long before Mmereko's limit.

### 5.3 Retries and timeouts (UniversityFlow's jobs package)

- Every call to Mmereko runs in a job (`packages/jobs`), never in the learner's request: the route
  writes a `cv_documents` row (`queued`) and schedules `cv.submit`. Payloads are **IDs only**
  (hard rule 4; `payload.ts`): `{ cvDocumentId }`.
- The job re-reads the row, rebuilds the profile at run time (so a deleted learner yields nothing,
  as every job does), and calls Mmereko with a **10 s** timeout for submit and status and **30 s**
  for fetching a PDF.
- Retry on network errors, `5xx` and `429`, with the package's backoff (1, 2, 4 … minutes,
  `retryDelayMs`), `maxAttempts` 6. On `429` the handler schedules a fresh attempt at `Retry-After`
  instead of using up an attempt. No retry on `4xx` other than `408`/`429`: the row goes `failed`
  with the problem `code`.
- **Webhook first, polling as a backstop.** On `202`, the handler also schedules `cv.poll` at +2
  and +10 minutes; it does nothing if the webhook already completed the row.
- `cv.collect` (from the webhook or the poll): fetch the PDF from the short link, check its
  `sha256`, store it in UniversityFlow's S3 (af-south-1), store the text and ATS numbers, then
  `POST /jobs/{id}/ack`. If the ack fails, Mmereko's 24-hour expiry deletes it anyway.

### 5.4 Versioning and deprecation

- Path-versioned (`/partner/v1`). Within v1, changes are **additive only**: new optional fields,
  new endpoints, new enum values that clients are told to treat as unknown. UniversityFlow's
  parsers ignore unknown fields.
- A breaking change is `/partner/v2`, with v1 kept for **at least 12 months** after v2 is stable,
  announced in writing, and marked on every v1 answer with `Deprecation` (RFC 9745) and `Sunset`
  (RFC 8594) headers. UniversityFlow's adapter logs (ids only) and alerts when it sees either.
- The schema carries `schemaVersion`; Mmereko accepts `1.x` and refuses an unknown major with
  `422 schema_version`.

## 6. Sandbox, fake and contract tests

### 6.1 Mmereko's sandbox

A separate deployment (`sandbox: true` on `/health`), its own credentials and webhook secret,
**synthetic data only** (the agreement forbids real learner data there). Deterministic: the
tailoring answer is canned per template rather than a model call, so UniversityFlow's contract run
costs nothing and repeats. It can be asked to misbehave for tests: a header
`X-Sandbox-Simulate: 429 | 500 | timeout | slow-webhook | duplicate-webhook | expired-link`.

### 6.2 UniversityFlow's fake

`MemoryCvEngine` in `packages/cv`, the same way `MemoryOutbox` stands in for SMS
(`packages/messaging/src/sms.ts`): deterministic, in memory, renders a tiny fixed PDF, scores ATS
by simple keyword overlap, sends its "webhooks" through the same signed path the live one uses
(`signWebhook` / `verifyWebhook`, `packages/messaging/src/webhook.ts`), and can be told to fail.
Local development, unit tests and E2E run on it.

### 6.3 Contract tests, both sides

- **UniversityFlow:** `cvEngineContract(make)` in `packages/cv/src/cv-engine.contract.ts`, run
  against the fake now and against Mmereko's sandbox at integration (an opt-in env switch, never in
  CI by default). As with SMS (`sms-providers.ts`), **the Mmereko adapter is listed in
  `CV_ADAPTERS` only after it passes the contract against the sandbox** (D8); until then
  `UF_PROVIDERS=live` refuses to start with the CV feature on, naming the missing adapter.
- **What the contract checks:** a draft returns a job and later a PDF with the advertised hash; the
  same idempotency key twice is one job; a changed body under a used key is refused; ID-number
  shapes and non-https URLs are refused without echo; a missing consent ref is refused; an
  under-18 band cannot ask for anything share-related; ack makes the job `expired`; delete removes
  every job of the learner and its status reaches `completed`; webhooks verify, and forged, stale,
  replayed or altered ones are refused; `429` carries `Retry-After`.
- **Mmereko:** pytest contract tests in `tests/api/partner/` over the same **shared golden
  fixtures** (synthetic profiles and job adverts, plus expected problem codes), published with
  `/schema/cv-profile.json`. UniversityFlow vendors the schema and fixtures into
  `packages/cv/contract/`; a test fails when the TypeScript validator and the schema disagree on any
  fixture, and a version bump on either side is a reviewed change.

## 7. Privacy and safety

### 7.1 Data minimisation

- Only what the learner ticked goes, every time (no "send the whole account").
- The base CV uses no model (D7). Only tailoring reaches Anthropic, which the consent wording
  already names; nothing reaches Gemini or Groq (D4).
- No date of birth (an age band only), no sign-in phone, no ID or student number, no guardian
  details, no photo, no chat, no plan maps, no wellbeing anything.
- Marks only when ticked (D11). Evidence links only (D10).

### 7.2 Retention on Mmereko's side (the agreement fixes these)

| What | Kept |
|---|---|
| Request content (profile, job advert), generated text, PDF | Until acknowledged, **at most 24 hours** |
| Job record: ids, kind, status, timings, problem code, token counts | 30 days |
| Idempotency keys (with a body hash, not the body) | 24 hours |
| Audit records (ids only, §7.6) | 12 months |
| Database backups | Mmereko's provider's backup window (to be stated, ≤ 7 days recommended); a deleted learner's rows age out with them |

Mmereko's model provider keeps what it is sent under its own API terms; that is UniversityFlow's
existing Anthropic arrangement, already in the consent wording.

### 7.3 Deletion, withdrawal and export

- **Withdrawal of the CV opt-in** (About me → My CV → "Stop using Mmereko"): UniversityFlow revokes
  every share link at once, schedules `cv.delete-learner`, and offers the learner a download of
  their CVs first. Recommended: it then deletes UniversityFlow's own CV rows and PDFs as well (D15).
- **Account deletion** and **a guardian revoking consent**: the same propagation. Because the
  student row is gone by the time the job runs, the job reads a tombstone row
  (`cv_deletions`: `learnerRef`, requested and confirmed times, no link to the student) and calls
  `DELETE /learners/{learnerRef}`, retried until Mmereko confirms. The tombstone is the record that
  the deletion reached the operator.
- **Export:** UniversityFlow's "Download my data" gains the CV tables and the PDFs from its own S3.
  It also calls `GET /learners/{learnerRef}/export` and includes what Mmereko still holds
  (normally only job records with ids and timings), so the learner's s23 answer is complete.

### 7.4 Rendering safely

The learner's text becomes a PDF in a headless browser. Mmereko renders partner jobs from the JSON
through a template that **escapes every string** (pandoc reads raw HTML in Markdown by default, so
partner text must never be passed to it as Markdown source, or must be read with raw HTML turned
off), runs the browser **with no network and no file access** beyond the one input, and never
falls back to wkhtmltopdf with `--enable-local-file-access` (`tools/build-pdf.py:117-122`). Links
stay clickable; images are not allowed.

### 7.5 Crisis words in a CV entry

A CV entry is free text from a minor ("Why I left that job", a summary). As with plan maps
(`docs/design/plan-maps-proposal.md` §5.2), UniversityFlow runs the existing deterministic check
(`assessDistress`, `packages/agent/src/crisis.ts:443`) on every saved entry and shows the crisis
card at once, saving the entry and storing nothing about the check. Nothing is sent to Mmereko
until the learner presses "Make my CV". No change to `packages/agent` is needed, so the red team
need not re-run for this item, but an A10 round covers the new surface.

### 7.6 Audit logging (ids only)

- **UniversityFlow** `audit_log`, fixed action words only: `cv.opt-in`, `cv.opt-out`,
  `cv.draft.requested`, `cv.tailor.requested`, `cv.collected`, `cv.confirmed`,
  `cv.share.created`, `cv.share.revoked`, `cv.share.viewed` (count, no viewer details beyond a
  keyed hash for abuse limits), `cv.deletion.requested`, `cv.deletion.confirmed`.
- **Mmereko** `audit_logs` (today unwritten): partner id, `learnerRef`, job id, action, time. No IP
  of the learner (the caller is UniversityFlow's server), no content.
- Neither side logs request or response bodies, prompts or PDFs (hard rule 4; Mmereko's own
  "PII-redacted logs", doc 08).

## 8. Hosting region and POPIA s72

What is known: Mmereko's database, auth and file storage are **Supabase** (ADR-004, ADR-005,
ADR-009); the region is not in the repository; the API's host is undecided; the web app is on
Vercel. What follows assumes Supabase is outside South Africa, which is the owner's to confirm in
the Supabase dashboard (Project Settings → General).

POPIA s72 allows a transfer abroad only if, among others, the recipient is bound by law or a
binding agreement giving adequate protection (s72(1)(a)), or the data subject consents (s72(1)(b)),
or the transfer is needed for a contract with the data subject (s72(1)(c)). For a minor, the
consent is the guardian's. UniversityFlow already relies on (a) plus named consent for Anthropic.

| Option | What it means | For | Against |
|---|---|---|---|
| **A. Stateless partner cell in af-south-1** (recommended) | Mmereko deploys its partner API, worker and renderer as containers in AWS af-south-1 (Cape Town, the same region as UniversityFlow), with its own small Postgres for job records and an S3 bucket for in-flight PDFs, both in af-south-1. No partner data in Supabase at all | Keeps the locked decision; the only cross-border hop is Anthropic, already consented; deletion is trivial | Mmereko runs a second deployment; pandoc and Chrome in a container (they already need one: `services/pdf/README.md`) |
| B. Mmereko as it is, abroad | Learner data in Supabase's region, under an s72(1)(a) agreement and consent v4 naming the country | No extra deployment | Breaks "student data stays in South Africa" (a re-plan of a locked decision); a minor's data stored abroad; harder deletion |
| C. Stateless, but compute abroad | Mmereko processes in its current region, stores nothing | Less to run than A | Still a transfer for every request; still needs naming in consent; still drift |
| D. Wait | No CV feature until Mmereko has a South African home | No risk | Delay |

**Recommended: A** (D3), with D2's stateless design. If the owner prefers B or C, it must go into
the consent wording and the privacy page by country, through the legal review, and planning.md §0
must record the change.

## 9. Consent, sharing and the agreement

### 9.1 What has to be in place

1. The **agreement** signed (§9.4).
2. **Guardian consent v4** and **adult agreement adult-v3** naming Mmereko (as an operator, what it
   receives, where it runs, how long it keeps it), and for adults, recruiter sharing. Owed legal
   review, bundled with the photo and plan-map words (D8). The live consent version is not bumped
   by this proposal.
3. The learner's own **CV opt-in**, recorded (who, when, wording version, purposes), separate from
   the account consent, revocable on the same page.
4. The database refuses CV entries, CV requests and share links under older consent wording, as it
   refuses offer letters below v3 (migration 0021, `UNIVERSITY_DOCUMENTS_CONSENT_VERSION` in
   `packages/db/src/store.ts`), and refuses all of it without an opt-in row. A server switch
   `UF_CV=1` (off by default, the owner's preview only, refused in production until v4 is live)
   follows the photo's and plan maps' precedent.

### 9.2 Draft wording (owed legal review and the owner's wording review; not content keys yet)

- **Opt-in card:** "Make a CV with Mmereko. Mmereko is a company that turns what you choose into a
  CV file. We send it only what you tick on this page, never your phone number or ID number. It
  keeps it only until your CV is made, at most one day, in South Africa. You can stop any time."
- **Guardian v4 line:** "If your child chooses to make a CV, we send what they choose for it (their
  school, subjects, marks they tick, projects and skills in their words) to Mmereko, which makes
  the CV file for us in South Africa and deletes it within a day. If they ask for a CV fitted to a
  job advert, the AI provider named above writes the fitted version. Nobody else sees a CV made
  before your child turns 18."
- **Adult-v3 line:** the same, plus: "From 18 you can make a link to share your CV with a
  recruiter. Anyone with the link can see that CV until it expires or you switch it off."
- **Withdrawal:** "Stop using Mmereko? We'll switch off your share links and ask Mmereko to delete
  anything it still has. You can download your CVs first."

### 9.3 Under 18, at 18, and sharing

- **Under 18:** drafts only. No share link; Mmereko refuses share-related options for
  `ageBand: "under-18"`; no Mmereko proof page, ever, for a partner learner. Recommended: the
  learner may download their own PDF (their own data; s23), with no watermark (D6).
- **Turning 18:** a guardian's consent ends on the 18th birthday and nothing of theirs is
  processed until they agree in their own name (A1-13). So on that day CV requests stop (the jobs
  re-check consent when they run and do nothing); the stored CVs stay, unprocessed. After adult-v3
  and a fresh CV opt-in in their own name, sharing unlocks. "Agree ahead" (planned, §8.1) applies
  here too once it is built.
- **Sharing (18+):** a link `https://<uf-host>/cv/s/<token>`, served by **UniversityFlow**, not
  Mmereko (D5): a random token (stored as a hash), one CV version, expires after 30 days by default
  (the learner can choose 7–90), revocable, `noindex`, views counted. Opening it redirects to a
  60-second signed link to the PDF in UniversityFlow's S3. Mmereko never sees who views it, and
  stays an operator rather than becoming a party that discloses learner data. The database refuses
  a share row when the learner is under 18 or has no adult-v3 agreement (hard rule 5's pattern:
  enforced in the data layer, not just the route).

### 9.4 The Tumoolo–Mmereko agreement must cover

Operator terms (POPIA ss 20–21: act only on instruction, confidentiality, security measures,
notify a breach without delay, ss 19 and 22); purposes (draft, tailor, scan, nothing else; no
training, no marketing, no profiling, no contact with learners); where processing happens (§8);
sub-operators (the model provider; any change notified in advance); retention (§7.2); deletion on
request and at the end of the agreement; export support; audit and inspection rights; the sandbox
holding synthetic data only; the licence for UniversityFlow to use the proprietary service
(`LICENSE`); price per job or per learner and who pays (planning D5: free for students); service
levels (availability, the 60-second target in Mmereko's doc 07); versioning and the 12-month
deprecation promise (§5.4); who operates Mmereko (its docs describe a two-person team, doc 10
"Division of work"), so the agreement binds the right legal person even though the owner is behind
both.

## 10. What UniversityFlow builds

### 10.1 `packages/cv` (new; server-side, may use `node:crypto`)

- Types and validator for `uf-cv-profile/1` (zod, already a web dependency), the shared fixtures
  and schema copy (`contract/`).
- `CvEngine` interface: `createDraft`, `tailor`, `getJob`, `ack`, `atsScan`, `deleteLearner`,
  `exportLearner`, and `verifyWebhook(headers, body)`.
- `MemoryCvEngine` (the fake, §6.2) and `cvEngineContract` (§6.3).
- `buildCvProfile(sources, selection)`: pure mapping from the learner's confirmed rows and entries
  to the profile (§3.3), with the hard-rule-3 check (verified catalogue names only).
- Not imported by `apps/native` (the app never holds keys or calls Mmereko).

### 10.2 Web server

- `apps/web/lib/server/cv-providers.ts`: `CV_ADAPTERS = {}` (empty until the sandbox contract
  passes), and `mmereko.ts` (the adapter: token cache, envelope, problem codes, webhook verify with
  the channel `mmereko`, reusing `packages/messaging/src/webhook.ts`'s scheme and replay window).
- `services.ts`: `cv: CvEngine` and the CV job handlers; `config.ts`: `UF_CV`, `UF_CV_PROVIDER`,
  `MMEREKO_API_URL`, `MMEREKO_CLIENT_ID`, `MMEREKO_CLIENT_SECRET`, `MMEREKO_WEBHOOK_SECRET`
  (+ `_NEXT` for rotation), all in `.env.example`.
- Job kinds (IDs only): `cv.submit { cvDocumentId }`, `cv.poll { cvDocumentId }`,
  `cv.collect { cvDocumentId }`, `cv.delete-learner { cvDeletionId }`.

### 10.3 Routes (the app calls the same, D6)

| Route | Does |
|---|---|
| `GET/POST/DELETE /api/me/cv/opt-in` | Read, give, withdraw the CV opt-in |
| `GET/POST /api/me/cv/entries`, `PATCH/DELETE /api/me/cv/entries/[id]` | The learner's projects, skills, work, etc. (crisis check on save) |
| `GET/PUT /api/me/cv/selection` | What is ticked for the CV (subjects, modules, entries, contact fields) |
| `POST /api/me/cv/drafts` | Queue a base CV |
| `POST /api/me/cv/tailorings` | Queue a tailored CV (job advert in the body) |
| `POST /api/me/cv/ats-scan` | Score a stored CV against a pasted advert |
| `GET /api/me/cv/documents`, `GET /api/me/cv/documents/[id]` | List; one, with a 60-second signed PDF link from our S3 |
| `POST /api/me/cv/documents/[id]/confirm` | "Every line is true" (needed before sharing) |
| `POST/DELETE /api/me/cv/shares` | 18+ only |
| `GET /cv/s/[token]` | The public share page (redirect to the PDF) |
| `POST /api/integrations/mmereko/webhook` | Signed webhooks; ids only; schedules `cv.collect` |

### 10.4 Migration `0031_cv.ts` (next free here; 0029 photo, 0030 plan maps)

Other agents in this wave may claim numbers too; **the integrator assigns the final number at
merge**. Tables, each with row-level security per learner, in the data export, deleted with the
account, and named in `docs/store/privacy-and-data-safety.md` (which `packages/db/src/privacy-page.test.ts`
enforces):

- `cv_links`: student, `learner_ref` (unique), opted-in time, consent version, purposes,
  withdrawn time.
- `cv_entries`: student, kind (`project`, `skill`, `work`, `volunteer`, `award`, `language`,
  `certificate`), title, organisation, dates, description, highlights, keywords, evidence links,
  linked module codes, position; the A11-17 refusal and the caps of §3.2 as check constraints.
- `cv_selections`: student, what is ticked (ids and flags).
- `cv_documents`: student, kind (`draft`, `tailored`), status, Mmereko job id, the advert's title
  and company (the advert text itself is kept only until the job finishes; D13), the CV text, gaps,
  ATS numbers and keyword lists, S3 key, sha256, confirmed time, created time.
- `cv_shares`: document, token hash, expiry, revoked time, view count; refused for under-18s and
  without adult-v3, in the database.
- `cv_deletions`: `learner_ref`, requested, confirmed. No student link (it outlives the account by
  design and holds no personal information).

The consent check (version ≥ v4 / adult-v3, plus an opt-in row) is a trigger, as 0021's is.

### 10.5 The page and the screen

- **Web `/cv`** ("My CV", in the sidebar's later-stage group): the opt-in card (§9.2); "What goes on
  my CV" (ticks, grouped by section, each with where it came from); "My projects and skills" (an
  editor list, each entry its own small form with evidence links); "Make my CV"; a list of CVs with
  status words ("Being made", "Ready", "Couldn't be made, try again"); each CV opens a preview
  (the text, then "Download PDF"), the gaps, "Check every line is true"; "Fit it to a job" (paste an
  advert → a tailored CV and its ATS score as a bar with the number and the missing keywords as a
  list, never colour alone); 18+: "Share with a recruiter" (expiry, copy link, switch off).
- **App `cv.tsx`**: the same sections as an outline; the PDF opens through the signed link in the
  system viewer (`Linking`), so no new native module is needed.
- All strings in a new `packages/content/src/en/cv.ts`; every value from tokens; WCAG 2.2 AA; the
  only motion is the status line's progress, with its reduced-motion path (a static word).

### 10.6 Test-first build order

1. `packages/cv`: schema, validator, mapping (hard rules 3 and 6), fake, contract (red first).
2. `packages/db`: migration, consent refusal under old wording, under-18 share refusal at the
   database, A11-17 refusal, RLS, export, delete with tombstone (real-Postgres suite too).
3. Web: routes, jobs (retry, `Retry-After`, poll backstop, idempotent collect), webhook (forged,
   stale, replayed, wrong channel), share page; privacy-page test.
4. Web UI, then the app screen (RNTL, `await` render and fireEvent).
5. E2E on the fake (opt in → entries → draft → download; withdrawal); axe.
6. Audits: A5 (security: webhook, share tokens, rendering), A11 (privacy), A2 (accessibility), A10
   (crisis check on entries). The Mmereko adapter joins `CV_ADAPTERS` only after the sandbox run.

## 11. Errors and edge cases

| Case | What happens |
|---|---|
| Mmereko down or slow | The CV stays "Being made"; jobs retry with backoff; after the last attempt it shows "Couldn't be made, try again" and keeps the learner's ticks. No fallback to another provider |
| A webhook never comes | `cv.poll` at +2 and +10 minutes finds the result |
| A webhook comes twice, or before our row is written | Collect is idempotent (by job id and sha256); an unknown job id is answered `200` and ignored, logged by id |
| The PDF link expired before we fetched it | `GET /jobs/{id}` again gives a fresh link while the content exists; after 24 h the row is `failed` with "try again" |
| Partial profile | UniversityFlow requires a name and at least one education entry before "Make my CV"; Mmereko renders only sections present; a `422` names the field path, never the value |
| The learner edits entries while a CV is being made | The CV reflects the ticks at request time (the job rebuilds from the rows when it runs; the button is disabled while one is queued) |
| A tailored CV claims something not in the profile | Mmereko's verify-claims stage drops it (`packages/prompts/verify-claims.md`); the learner's "every line is true" step is the last check; a report button as on AI replies (A10-35's pattern) |
| A job advert with personal details in it | Kept only until the job finishes (D13); never logged |
| Learner turns 18 mid-job | The job re-checks consent at run time and does nothing; the learner sees the 18th-birthday notice (A11-25) |
| Guardian revokes consent | All CV processing stops; propagation to Mmereko as on deletion (§7.3) |
| Learner withdraws the CV opt-in | Share links off at once, Mmereko deletion, then UniversityFlow's own CV data (D15) |
| Account deleted | As above via the tombstone; the share links die with the rows |
| Mmereko deletes a partner (end of agreement) | It deletes all partner data and confirms in writing; UniversityFlow switches `UF_CV` off and keeps the learners' PDFs (they are UniversityFlow's records) unless they delete them |
| A breaking API change | Seen early through `Deprecation`/`Sunset`; v1 stays for 12 months (§5.4) |
| Key leak | Revoke that secret (the second one keeps service up), rotate, review Mmereko's audit by partner id |

## 12. What Mmereko must change (the owner's build list there)

1. **A partner router** at `/partner/v1` with its OpenAPI and `/schema/cv-profile.json` (§2).
2. **Partner auth:** `partners`, `partner_clients` (two secret hashes, scopes, rotation, revocation),
   a token endpoint and a signing key with JWKS (§4.1), apart from the Supabase user auth in
   `services/api/app/deps/auth.py`.
3. **Stateless stage functions:** refactor `services/api/app/services/pipeline.py` so tailor, match,
   verify and ATS take inputs rather than `Application`/`Cv`/`Repository` rows; match over projects
   given in the request; a deterministic profile → CV renderer with no model (D7).
4. **A durable queue** for partner jobs (doc 07's Redis worker, or a Postgres queue), replacing
   in-process `BackgroundTasks` for this path.
5. **Idempotency** enforcement (§5.1) and **rate limits** with `Retry-After` (§5.2).
6. **Outbound signed webhooks** with retries for 24 hours, same signature scheme as UniversityFlow's
   (`x-…-signature: t=<s>,v1=<HMAC-SHA256 of "<t>.mmereko.<body>">`).
7. **Safe rendering** for partner text: escape everything, no raw HTML into pandoc, no network or
   file access for the browser, the wkhtmltopdf fallback off (§7.4).
8. **Short links and delete-on-ack:** PDF links ≤ 5 minutes (not the default 3600 s,
   `services/storage.py:46`); content deleted at ack or after 24 hours (§7.2).
9. **Deletion and export** for a partner learner (and, separately, the user-level `DELETE /me` and
   `POST /me/export` its own docs promise, which are not built).
10. **Audit writes** to `audit_logs` (ids only) and **IDs-only logging** on the partner path.
11. **Provider pinning:** partner jobs on Anthropic only, whatever `llm_provider` says (D4).
12. **Partner learners excluded** from proof pages, follow-up e-mails, GitHub sync, Paystack quotas
    and the `users`/`auth.users` tables (§1).
13. **The af-south-1 partner deployment** (D3) and a statement of where every part runs.
14. **The sandbox** (§6.1) and **partner contract tests** in `tests/api/partner/` (§6.3).
15. **Its own paperwork:** a privacy notice and sub-operator list (doc 08 lists them as "to produce
    before launch"), the agreement (§9.4).

## 13. Owner decisions (recommended answer in bold; plan-keeping option first where there is one)

- **D1 Add the CV builder to the plan now?** Plan-keeping: keep it in Stage 8 / Phase 9 (Nov 2028)
  and approve only this design. **Recommended: a new item after the hackathon: build UniversityFlow's
  side against the fake now (D8), switch it on for learners only after the agreement, the region
  (D3) and consent v4 (D8 below), through the usual gate and audits (A2, A5, A10, A11).**
- **D2 Who holds the CV of record?** A) UniversityFlow, with Mmereko stateless (content ≤ 24 h);
  B) Mmereko holds learners' CVs (accounts per learner). **Recommended: A.**
- **D3 Where Mmereko processes partner traffic:** A) a stateless partner cell in AWS af-south-1
  (plan-keeping); B) Mmereko's current Supabase region with an s72 agreement and consent naming the
  country; C) stateless but abroad; D) wait. **Recommended: A.** (Owner to confirm Supabase's region
  either way.)
- **D4 Model provider for partner jobs:** **Recommended: Anthropic only**, pinned per partner; no
  Gemini or Groq for UniversityFlow learners.
- **D5 Who serves recruiter links:** A) UniversityFlow (`/cv/s/<token>`, our S3); B) Mmereko
  (proof pages). **Recommended: A** (Mmereko stays an operator; proof pages off for partner learners).
- **D6 Under-18 PDFs:** A) the learner downloads their own PDF, no watermark, no sharing features;
  B) a "Draft" watermark; C) preview on screen only. **Recommended: A** (the owner's "draft only"
  read as "nobody else gets it from us"). Please confirm that reading.
- **D7 The base CV:** A) deterministic, no model; B) AI-written. **Recommended: A**; AI only for
  tailoring.
- **D8 Consent:** one guardian v4 / adult-v3 for the photo, plan-map words and Mmereko (and 18+
  sharing), one legal review, plus a separate recorded CV opt-in, and `UF_CV` off until then.
  **Recommended: yes.**
- **D9 Contact details on the CV:** **Recommended: optional, typed by the learner on the CV page
  (e-mail, phone, city, profile links), never filled from the sign-in phone; ID and student numbers
  refused.**
- **D10 Evidence links:** **Recommended: links only in v1, neither side fetches them; Mmereko never
  calls GitHub for partner learners.** Later, a public-repository summary fetched by Mmereko, with
  its own A5/A11 round.
- **D11 Marks on the CV:** **Recommended: off by default, ticked per subject, confirmed marks only;
  final NSC results preferred once official.**
- **D12 Auth:** **Recommended: OAuth 2.0 client credentials, two live secrets for rotation, 90-day
  rotation, 10-minute tokens.**
- **D13 Retention numbers:** **Recommended: Mmereko content ≤ 24 h (deleted at ack), job records 30
  days, audit 12 months, backups ≤ 7 days; UniversityFlow keeps the advert text only until the job
  ends, the CVs until the learner deletes them.**
- **D14 The hackathon demo:** **Recommended: an honest "coming next" card, or the fake engine only;
  no Mmereko call from the judge demo.**
- **D15 Withdrawal:** A) delete UniversityFlow's CV data too, after offering a download; B) keep
  it, unprocessed. **Recommended: A.**
- **D16 Cover letters** (Mmereko has them): **Recommended: not in v1**; a later additive endpoint.
- **D17 Price and who pays:** **Recommended: per completed job, paid by Tumoolo under the
  agreement, free for learners (planning D5), with Mmereko's `usage` feeding cost per student.**

**Waits for legal:** consent v4 / adult-v3 wording, the privacy page and store answers, the
agreement, and (if D3 is not A) the s72 basis. **Waits for the owner:** Supabase's region, the
agreement, Mmereko's build list (§12), the sandbox credentials (D8 integration order: the owner
connects real accounts at the end).
