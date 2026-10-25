# CV — A5 Security: My CV with Mmereko

**Project:** UniversityFlow · **Feature:** My CV made by Mmereko (#85, behind `UF_CV`, off for
learners until consent v4) · **Date:** 2026-10-23
**Commit audited:** 092163c (`main`) · **Branch:** `phase-6/cv-audit-a5` · **Auditor:** agent cva5
**Result:** 0 Critical · 0 High · 4 Medium (all fixed, test-first) · 6 Low (1 fixed, 5 recorded)

Scope: the security surface of the CV feature as built against the fake (docs/design/mmereko-api-proposal.md,
D1–D17 approved): Mmereko's signed webhook, the recruiter share tokens and the public share page,
the 60-second PDF links, the Mmereko adapter (`apps/web/lib/server/mmereko.ts`) and its token, the
CV routes' CSRF and rate limits, learner-supplied links, the `UF_CV` refusals in config, the CV
jobs and migration 0035. Privacy (A11), accessibility (A2) and the crisis check (A10) on the same
feature are audited at the same time by other agents and are not repeated here.

---

## 1. Summary

The feature is in good shape. Nothing an attacker without an account can reach gives them
anything: the webhook is HMAC-verified (constant time, channel-bound, five-minute window, replay
key held under one lock) before a byte of the body is read as JSON; share tokens are 256-bit,
stored only as a SHA-256 hash, expiring (7–90 days), revocable, and the database itself refuses a
share for anyone under 18 or without their own adult agreement, at creation **and** at every view;
the PDF route needs an HMAC over the CV's id and an expiry at most 65 seconds ahead, and answers the
same 404 for anything wrong; every learner route goes through `requireReady`/`requireSignedIn`
(same-origin check) and row-level security; job payloads are ids only; `UF_CV` is refused in
production, on staging and on the demo until the wording names Mmereko, and live mode never falls
back to the stand-in.

What was found is **trust in the operator's answers** (Mmereko is our operator, but a fault or a
compromise on its side should not be able to steer our server, exhaust it, or cross learners) and
**a missing abuse limit on the one public page**. Four Mediums, each fixed with a test that failed
first.

## 2. Findings

| ID | Severity | Location | Finding | Status |
|---|---|---|---|---|
| A5-15 | Medium | apps/web/lib/server/mmereko.ts `fetchPdf`, `#send` | The PDF link Mmereko returns was fetched from **any https host**, IP literals and private names included (`https://169.254.169.254/…`, `https://10.0.0.5/…`, `https://localhost/…`), and every API call **followed redirects**, so a 307 from the partner host re-POSTed a learner's CV profile to wherever it pointed (proven: the profile reached a second local server). SSRF and data egress steered by the operator's answer | **Fixed** (2f1199a): no redirect is followed on any call (`redirect: 'error'`); a PDF link off Mmereko's own origin must be https to a public name (the same rule as a learner's links: no IP, no localhost, no private suffix) and is refused before any request |
| A5-16 | Medium | mmereko.ts `#json`, `#problem`, token, `fetchPdf` | Every answer was read **to the end before any size check**: `response.json()` with no cap, and a PDF without `content-length` buffered whole by `arrayBuffer()` (proven: 30 MB read to refuse a 10 MB cap; 12 MB of JSON read to refuse it). The bytes kept and served as `application/pdf` were never checked to be a PDF | **Fixed** (2f1199a): a capped stream reader (2 MB JSON, 64 KB problems and token answers, 10 MB PDF) that refuses a declared length over the cap and cancels the stream at it; a PDF must start `%PDF` |
| A5-17 | Medium | mmereko.ts `getJob` → apps/web/lib/server/cv.ts `collect` | `GET /jobs/{id}`'s answer was taken without checking it was **for the job and the learner asked about**: a mix-up or compromise on the operator's side could put one learner's CV text, ATS lists and PDF into another learner's record (the hash check only compares Mmereko's PDF with Mmereko's own claim) | **Fixed** (2f1199a): an answer whose `jobId` or `learnerRef` differs from the request is refused as `bad_response` |
| A5-18 | Medium | apps/web/app/cv/s/[token]/route.ts | The one public, unauthenticated page had **no abuse limit**, though §7.6 calls for "a keyed hash for abuse limits": every open of a live link writes a view count and an audit row, so one valid link could grow `audit_log` without bound, and random tokens drive a database lookup each | **Fixed** (ffd407b): 60 opens an hour per address, kept by the store only as an HMAC, checked before the token is looked up; over it a bare `429` with `Retry-After`, noindex, nothing counted, logged or served |
| A5-19 | Low | apps/web/app/api/integrations/mmereko/webhook/route.ts | A webhook without `content-length` (chunked) is read to the end before the 4 KB check. The same pattern as the messaging inbound route; the platform's body limit (4.5 MB on Vercel) bounds it | Open (recorded): read it through a capped reader, here and in `/api/messaging/[channel]/inbound` together |
| A5-20 | Low | packages/cv/src/text.ts `safeLinkProblem`; migration 0035 `uf_cv_link_ok` | A host written with a trailing dot (`https://localhost./`, `https://build.internal./`) is the same host but passed the private-name check. Nothing fetches a learner's link (D10), so the risk is a printed link, not a request | **Fixed** in the code (4cdd675), which every write path runs before the database. The database's own check (`uf_cv_link_ok`, 0035) still accepts it: defence in depth only, not changed (it needs a migration; 0037 left unused). Mmereko's validator should read hosts the same way |
| A5-21 | Low | apps/web/app/api/me/cv/shares/route.ts, entries/[id] | No per-learner cap on share links created (each a row) or on entry edits (each runs the crisis check). A signed-in adult only, so a nuisance, not a door | Open (recorded): a daily `QUOTAS` entry for shares, as drafts have |
| A5-22 | Low | apps/web/lib/server/cv.ts `signedPdfLink` | PDF links are signed with `AUTH_SECRET` (domain-separated by the `cv-pdf:` prefix, and no route returns an HMAC of chosen input), not a key of their own: rotating one rotates both, and the session secret now also guards CV files | Open (recorded): a derived key (HKDF of `AUTH_SECRET` with a `cv-pdf` label) costs nothing and separates them |
| A5-23 | Low | /cv/s/[token] (D5 design) | The share token is in the URL path, so the host's request logs (Vercel) hold live bearer tokens for up to 90 days. Inherent in a link-to-share design | Open (recorded): keep request-log retention shorter than the shortest link, or note it in the privacy page's operator list |
| A5-24 | Low | /cv/s/[token] | Link scanners and unfurlers (WhatsApp, Slack, mail filters) open a shared link: each counts a view, writes an audit row and follows to the PDF, so "views" overstate recruiters and a preview may fetch the CV | Open (recorded): count only `GET` with no `purpose: prefetch`/known-bot user agent, or a click-through page; the owner's call (it is also A11's wording on "views") |

No Critical or High was found, so no phase gate is shut by this audit.

## 3. Method

Read, line by line: `packages/cv` (`webhook.ts`, `engine.ts`, `text.ts`, `build.ts`, `memory.ts`,
the contract and the golden vector), `packages/messaging/src/webhook.ts`, `packages/db/src/cv.ts`,
`crypto.ts` and migration 0035, `apps/web/lib/server/{cv,cv-routes,cv-providers,mmereko,http,config}.ts`
(the CV parts of `services.ts`), every route under `apps/web/app/api/me/cv`, the webhook route,
`/api/cv/pdf/[id]`, `/cv/s/[token]`, `proxy.ts` and `next.config.ts` (CSP and security headers on
the share page and the PDF), and the web and app screens for how the CV text and links are shown.
Each fix was written test-first and each test seen to fail on `main`'s code:

| Test | File | Failed on 092163c with |
|---|---|---|
| never fetches a PDF link to a private or IP host (×8) | apps/web/test/mmereko.test.ts | `Expected a refusal` (each fetched) |
| never follows a redirect away from Mmereko | same | `expected [ '/steal' ] to deeply equal []` |
| stops reading a PDF at the cap when no length is given | same | `expected 31457280 to be less than or equal to 10616832` |
| stops reading an API answer at the cap | same | `expected 12582912 to be less than or equal to 4194304` |
| refuses a "PDF" that isn't one | same | `Expected a refusal` |
| refuses a job answer for another job or another learner | same | `Expected a refusal` |
| holds each address to a limit, and counts nothing over it | apps/web/test/api-cv.test.ts | `expected "allow" to be called with arguments` (no limit) |
| refuses a private name written with a trailing dot (×5) | packages/cv/src/text.test.ts | `expected null to be 'private-host'` (or `'invalid'`): each accepted |

## 4. What was checked and holds

- **Webhook.** `verifyWebhook`: HMAC-SHA256 over `<t>.mmereko.<body>` (the exact raw body, read as
  text, never re-serialised), `timingSafeEqual` on equal-length buffers, a strict header shape
  (`t=\d{1,12},v1=[0-9a-f]{64}`, ≤ 300 chars), ±5 minutes; secrets under 32 characters ignored and
  refused by config; either of two secrets in a rotation. Replay: a SHA-256 of the header counted
  under one database lock for twice the tolerance (a leading-zero or case variant changes the HMAC
  input or fails the regex, so it can't mint a second key). The event is parsed only after
  verifying, ids only, unknown fields dropped; an unknown job is ignored. Mmereko's golden vector
  verifies (`contract.test.ts`). The route is 404 with `UF_CV` off, and 400 over 4 KB declared.
- **Share tokens.** 32 random bytes, base64url (256 bits); only `sha256(token)` stored (unique);
  looked up by hash, so no timing oracle on the token; format checked before the database; expiry
  and revocation checked on every open; the token is returned once and never in a list or export.
  Under-18s: `uf_cv_share_allowed` (adult by date of birth in SAST, own agreement, opt-in naming
  sharing) at creation (trigger and store) and again at every open; `optInToCv` refuses `cv.share`
  below 18; `readCvSubmission` strips `cv.share` and sends `ageBand: under-18`. The owner's preview
  never stands in for the age rules.
- **Share page.** `no-store`, `X-Robots-Tag: noindex, nofollow`, `<meta name="robots">`,
  `Referrer-Policy: no-referrer`, the proxy's nonce CSP, `nosniff`, `X-Frame-Options: DENY`; the gone
  page is fixed text from `packages/content`, nothing reflected. Revoked, expired, unknown and
  no-longer-allowed all look the same.
- **PDF links.** HMAC over `cv-pdf:<id>:<exp>`, exp no more than 65 s ahead, constant-time compare,
  then the file only for a `ready` row; one 404 for every failure; `application/pdf`,
  `inline; filename="cv.pdf"`, `private, no-store`, `nosniff`, noindex, no referrer, the API CSP. A
  learner's own link is signed only after `ownCv` under row-level security, so no IDOR across
  learners; ids are UUID-checked before any query. Size is capped at collect (10 MB, and now read
  capped).
- **Learner links (SSRF).** https only, ≤ 500 chars, no credentials, no IP literal (WHATWG
  normalises `0x7f.1`, `2130706433`, IPv6), no `localhost`/private suffixes, checked in the store and
  again by the database; nothing fetches them (D10). Only the trailing-dot gap (A5-20).
- **The adapter's credentials.** The client secret goes only in the Basic header of
  `/oauth/token`; the access token only to Mmereko's own origin (a storage link gets none); neither
  is in an error (codes and statuses only), a log (the deprecation line names the route), the
  config object (only `apiUrl` and `clientId`) or a client response (`CvEngineError` maps to
  `cv-unavailable` + code). 10 s and 30 s timeouts. Every answer is schema-checked (zod) with
  string and list caps; unknown problem codes fall back by status.
- **Rate limits and CSRF.** Every mutating CV route uses `requireReady`/`requireSignedIn`, so the
  same-origin check applies (bearer and native pre-auth exemptions as elsewhere); drafts 5, tailorings
  10 and ATS scans 20 a day per learner; one CV in flight at a time (advisory lock).
- **Learner-chosen only.** `buildCvProfile` sends only ticked subjects, modules and entries, the
  offer and school only when ticked, e-mail and phone only as typed on the CV page (never the
  sign-in phone); the job rebuilds from the rows when it runs.
- **`UF_CV` in config.** Refused on a demo always; refused in production and on staging until the
  live wording names Mmereko (then `cvPreview` is false); live mode needs a listed adapter
  (`CV_ADAPTERS` is empty, so `UF_CV=1` with live providers refuses to start); every Mmereko secret
  ≥ 32 chars, `MMEREKO_API_URL` https. The stand-in's webhook secret is a development constant, used
  only with local providers, which production refuses.
- **Rendering on our side.** The CV text is shown as text (`whitespace-pre-wrap`, React escaping;
  `<Text>` in the app), never as HTML or Markdown; links from the server only.

## 5. Not checked

- Mmereko's own side (its partner API, renderer sandbox, storage link lifetime): another repository,
  audited there.
- The adapter against Mmereko's real sandbox (`mmereko-sandbox.test.ts` is opt-in and needs the
  owner's credentials); every adapter test here runs against the local fake or a fetch spy.
- A deployed build: no `next build`, E2E or live headers were run in this audit (the integrator
  runs them); the headers above are read from the route and `next.config.ts`, and the share and PDF
  headers are asserted by `api-cv.test.ts`.
- The real-Postgres suite for migration 0035 (PGlite only).

## 6. Handed to other audits

- **A11:** the ATS-scan advert (`POST /api/me/cv/ats-scan`) goes to Mmereko without the ID-number
  check stored adverts get (`checkAdvert`); it isn't stored, but it is sent. And A5-24's "views".
