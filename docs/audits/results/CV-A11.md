# My CV with Mmereko: A11 Privacy and POPIA

**Project:** UniversityFlow · **Step:** S1 session 7, wave 3 (agent cva11) · **Date:** 2026-10-23
**Commit audited:** 092163c (main, #85 merged); fixes on `phase-6/cv-audit-a11-a2`
**Audit source:** [docs/audits/A11-privacy-popia.md](../A11-privacy-popia.md), against
[docs/design/mmereko-api-proposal.md](../../design/mmereko-api-proposal.md) (D1 to D17 approved with
every recommended answer) and [docs/legal/consent-v4-draft.md](../../legal/consent-v4-draft.md)
**Result:** 0 Critical · 0 High · 4 Medium · 4 Low (A11-35 to A11-42)
**After fixes:** 2 Medium fixed test-first (A11-35, A11-37); 2 Medium and 4 Low open, none blocking
(the CV is off for learners until consent v4, `UF_CV` refused in production).

Not legal advice: the open items are for the owner and the legal review of consent v4.

## Scope

Everything My CV (#85) adds that touches personal information: `packages/cv` (the profile shape,
`buildCvProfile`, the fake engine), migration 0035 and `packages/db/src/cv.ts`, the store's
export, deletion and guardian withdrawal (`store.ts`), `apps/web/lib/server/{cv,cv-routes,config,
services,mmereko}.ts`, every `/api/me/cv/*` route, `/api/me` DELETE, `/api/me/export`,
`/api/consent/[token]`, the webhook, the page (`apps/web/app/(app)/cv/*`) and the app screen
(`apps/native/app/cv.tsx`), `packages/content/src/en/cv.ts`, the privacy page template
(`en.privacyPage`), `docs/store/privacy-and-data-safety.md` and the consent v4 draft (C7).
The security surface (webhook signatures, share tokens, the PDF route, the adapter's transport) is
audit CV-A5's; the crisis check and the tailoring prompt are CV-A10's.

**Evidence:** code read at 092163c; the fixes' tests run (web, native, content). No server, no
browser, no real Mmereko: `CV_ADAPTERS` is empty and the stand-in engine runs in process.

## Executive summary

The CV is built privacy-first, and almost everything the proposal promised is in the code:

- **Hard rule 5 holds in the data layer.** `uf_consent_covers_cv` (0035) refuses every CV write
  unless the learner's own adult agreement (adult-v3) or the latest live guardian consent (v4)
  names Mmereko, and triggers on `cv_links`, `cv_entries`, `cv_selections`, `cv_documents` and
  `cv_shares` enforce it whatever the code does. The owner's preview stands in for the *wording*
  only: a minor still needs a granted guardian consent (`consent_status = 'granted'`), and the RLS
  policies still need `uf_may_process`. A pending minor can write nothing.
- **Under-18s never share.** `uf_cv_share_allowed` needs `uf_is_adult` and `consent_status =
  'not-required'`, checked when a share row is written (trigger) and again each time a link is
  opened (`CvJobStore.openShare`). `readCvSubmission` strips `cv.share` from an under-18's purposes
  and sends an age band, never a date of birth.
- **Pseudonymous to Mmereko.** `learner_ref` is a random UUID per opt-in (a new one after a
  withdrawal), never the student id; `consent.ref` is the opt-in row's id. The profile carries
  only what was ticked or typed on the CV page: no sign-in phone (D9), no ID or student number
  (refused by the database's `uf_holds_personal_number` and the store), no date of birth, no
  photo, no guardian, no chat.
- **Hard rule 4 holds.** Job payloads are `{ cvDocumentId }` or `{ cvDeletionId }`; the logs print
  an error's name or a problem code; the webhook's replay key is a hash; audit rows carry fixed
  words (`cv.opt-in`, `cv.collected`, …) and ids. The advert's text is dropped when a CV finishes
  or fails (D13, a check constraint).
- **Deletion reaches the operator.** Account deletion, a guardian's withdrawal and "Stop using
  Mmereko" all write a `cv_deletions` tombstone (no link to the student) that `cv.delete-learner`
  carries to Mmereko until it confirms; a server start schedules any left behind. Withdrawal also
  deletes UniversityFlow's own CV rows and PDFs (D15). Account deletion deletes the PDFs from S3.
- **Export is complete.** "Download my data" includes every CV table (without the PDFs' keys or
  the links' token hashes), each PDF itself (base64) and what Mmereko still holds for each of the
  learner's references (`GET /learners/{ref}/export`), or "unavailable".
- **Nothing leaves South Africa today.** `CV_ADAPTERS` is empty, so no configuration can reach
  Mmereko; the stand-in runs in our process; `UF_CV` is refused in production, on staging and on
  the demo until the wording names Mmereko.

What was wrong:

1. **A11-35 (Medium, fixed):** once the adapter is listed and v4 is live, the configuration would
   have accepted *any* https `MMEREKO_API_URL`. Mmereko is on Supabase in an unstated region; the
   approved plan (D3) is a partner cell in af-south-1. Nothing tied the two. Now production and any
   live run refuse Mmereko unless the owner declares `MMEREKO_REGION=af-south-1`.
2. **A11-37 (Medium, fixed for the point of use):** a fitted CV is written by Anthropic, in the
   United States, but the learner's opt-in card says Mmereko keeps their CV "in South Africa", the
   fitting card said nothing of the AI, and the opt-in grants fitting in the same tap. The fitting
   card now says so where the advert is pasted (a new content key, web and app).
3. **A11-36 (Medium, open):** if `UF_CV` is switched off after learners used it, no CV engine is
   built, so account deletions' tombstones are never carried to Mmereko, and "Stop using Mmereko"
   answers 404.
4. **A11-38 (Medium, open):** a learner can't delete one CV. D13 says UniversityFlow keeps the CVs
   "until the learner deletes them", but the only ways are stopping altogether or deleting the
   account.

## Findings

| ID | Severity | Where | Finding | Status |
|---|---|---|---|---|
| A11-35 | Medium | apps/web/lib/server/config.ts (`readCv`) | Nothing tied the live Mmereko adapter to the af-south-1 partner cell (D3, POPIA s72): once listed and with v4 live, any https URL was accepted, so a configuration pointing at Mmereko's Supabase region abroad would have started | Fixed |
| A11-36 | Medium | apps/web/lib/server/services.ts:461-467; cv-routes.ts `sendCvDeletions`; opt-in DELETE | With `UF_CV` off after use there is no engine: tombstones from account deletions and guardian withdrawals are never scheduled, `cv.delete-learner` has no handler, and "Stop using Mmereko" 404s. Mmereko's 24-hour content limit bounds the content, not its 30-day job records or 12-month audit rows keyed by `learner_ref` | Open |
| A11-37 | Medium | packages/content cv.ts; the fitting card (web, app); `opt-in` POST purposes | A fitted CV is written by Anthropic outside South Africa (D4), but the opt-in card says "in South Africa", the fitting card didn't mention the AI, and the opt-in grants `cv.tailor` with `cv.draft` in one tap | Fixed (point of use); the card and per-purpose choice wait for the wording review |
| A11-38 | Medium | apps/web/app/api/me/cv/documents/[id] (GET only); packages/db cv.ts | No way to delete one CV (its text, PDF, gaps, a fitted CV's advert title and company); "kept until the learner deletes them" (D13) is reachable only by stopping altogether or deleting the account (POPIA s14, s24) | Open |
| A11-39 | Low | packages/content cv.ts `withdraw.body`, `withdraw.done` | "Stop using Mmereko" deletes the learner's projects and skills, ticks and typed contact details too (D15), but the words name only share links, Mmereko's copy and "your CVs" | Open |
| A11-40 | Low | docs/legal/consent-v4-draft.md C7; en.privacyPage | The v4 draft lists school, subjects, marks, projects and skills, but not the name, the typed e-mail, phone and town, the university and modules, or that a fitted CV's advert goes to the AI; the privacy page's "Coming later" doesn't name the CV, and "We do not collect … email address" changes the day it switches on | Open |
| A11-41 | Low | apps/web/app/api/me/cv/ats-scan/route.ts | The ATS scan sends a pasted advert to Mmereko with no ID-number refusal; the fitting path refuses one (`checkAdvert`). No page calls it yet | Open |
| A11-42 | Low | migration 0035 `uf_cv_preview()` | The preview's stand-in for the wording is a setting (`uf.cv`) the app's own role can set in any transaction, so the database's "whatever the code does" check of the wording is only as strong as the server code that sets it (0030's precedent) | Open |

### A11-35: the partner cell's region, declared and enforced (fixed)

`readCv` checked that `MMEREKO_API_URL` was https and that the secrets were long, but nothing about
where Mmereko runs, and a URL can't say. The proposal's §8 and the v4 draft (C7, Part 3) are true
only with D3 option A (af-south-1). Now, in production and in any live run, `UF_CV_PROVIDER=mmereko`
needs `MMEREKO_REGION=af-south-1` exactly; any other value, or none, refuses to start with a message
naming D3 and s72. A staging site and the demo refuse the variable, like Mmereko's other settings.
If the owner ever chooses option B or C, that is a code change (and a re-plan of the locked
decision), not a setting. A developer running the sandbox contract locally (synthetic data only,
by the agreement) is not held to it.

- Test: `apps/web/test/cv-config.test.ts` "keeps learners' CV data in South Africa…". Proven red
  first: `expected [Function] to throw an error` (no region was asked for).
- `.env.example` documents it (the `env-documented` guard and `config.test.ts` read it).
- **For the owner:** set `MMEREKO_REGION=af-south-1` only once Mmereko confirms in writing that the
  partner cell runs there (§12 item 13).
- **Not fixed, for the record:** on a local run with the wording not yet live, naming a live
  adapter (once one is listed) sends whatever is in that database to Mmereko under the preview.
  Local databases hold synthetic data (hard rule 4) and the sandbox takes synthetic data only (the
  agreement), so this is left as the developer's sandbox path the services comment describes.

### A11-36: switching the CV off after use (open)

`createServices` builds the engine, its job handlers and `seedCvDeletions` only when `config.cv`
(live) holds. `sendCvDeletions` returns at once without an engine. Account deletion and a
guardian's withdrawal still write tombstones, but nothing carries them until the CV is on again;
and `DELETE /api/me/cv/opt-in` is behind `cvOn()`, so a learner can't withdraw while it is off
(export and account deletion still work).
**Plan:** a "deletions only" state: with the adapter configured but `UF_CV` off, keep the engine
for `cv.delete-learner` and `exportLearner` only, register that handler and seed the tombstones;
let the opt-in DELETE work whenever a learner has CV rows. Owner decision: whether `UF_CV_PROVIDER`
may then stay set without `UF_CV=1` (today a half-set configuration is refused, deliberately).

### A11-37: fitting goes to the AI abroad (fixed at the point of use)

The opt-in card (`cv.optIn.body`, version `cv-optin-v1`) says Mmereko keeps what is sent "at most
one day, in South Africa", which is Mmereko's part. A fitted CV is written by Anthropic (D4), in
the United States, from what was ticked and the advert, and `POST /api/me/cv/opt-in` records
`cv.draft`, `cv.tailor` and `cv.ats` together. The fitting card now says, before the advert goes:

> "To fit your CV, Mmereko sends what you ticked and the advert to our AI provider, Anthropic,
> which works outside South Africa and doesn't use it to train its AI."

(`cv.tailor.aiNote`, new; on the web it also describes the Fit my CV button.) Its claims are the
live v3 consent's ("processes it outside South Africa and does not keep it for training"); no
retention number is added before the v4 review (C2).
- Tests: `packages/content/src/cv.test.ts` "says, before an advert is sent…" (red first:
  `.toMatch() expects to receive a string, but got undefined`); `apps/web/test/cv-page.test.tsx`
  "says where the advert is pasted…" (red: element not found); `apps/native/__tests__/cv.test.tsx`
  "says on the fitting card…" (red: element not found).
- **For the owner's wording review (with v4):** add the AI line to the opt-in card itself (a new
  `optInVersion`, `cv-optin-v2`), and consider separate ticks for "make my CV" and "fit it to a job
  with the AI", recorded as separate purposes (the database already takes them separately).

### A11-38: deleting one CV (open)

`/api/me/cv/documents/[id]` has GET only; the store has no `deleteCvDocument`. A failed fitted
CV keeps its advert's title and company indefinitely. **Plan:** `DELETE
/api/me/cv/documents/[id]` (sign-in and CSRF only, like photo removal, A11-32): the store deletes
the row as the learner (shares cascade), the route deletes the PDF from S3, an audit word
`cv.deleted`; a Delete button in the preview, web and app. No Mmereko call is needed (it held the
content at most a day).

### Lower findings

- **A11-39:** proposed words for the owner's review: "Stop using Mmereko? We'll switch off your
  share links, ask Mmereko to delete anything it still has, and delete your CVs, projects and
  skills, ticks and contact details here. You can download your CVs first." (`withdraw.body`) and
  "…Your CVs, projects, skills and share links are deleted." (`withdraw.done`).
- **A11-40:** for the legal review, C7's guardian line could read "(their name, the school,
  university and modules they tick, any marks they tick, projects and skills in their own words, and
  any e-mail, phone number or town they type for the CV)". The privacy page: move the CV into "What
  we collect" and Mmereko into "Who helps us" in the switch-on change, as the store document already
  says (`docs/store/privacy-and-data-safety.md`, "My CV's operator"); meanwhile a "Coming later" line
  would match the photo and the plan-map words.
- **A11-41:** refuse an ID-number shape in the advert in the ATS route as `checkAdvert` does
  (`422 personal-number`), with a route test, when a page first calls it.
- **A11-42:** when v4 is live, a migration makes `uf_cv_preview()` return false (and the server
  stops setting `uf.cv`), so only the wording can open the gate; the same for 0030's plan-map words.

## Checks that passed (no finding)

| Check (A11 brief) | Evidence |
|---|---|
| What is collected and why | Every 0035 column maps to §3.3 or §10.4 (entries, ticks, typed contact details, CVs, links, the opt-in, tombstones). Caps and plain-text checks in the database; marks only when ticked (D11); `phone` never filled from the sign-in phone (`cv-selection.tsx`, `build.ts` D9) |
| Pseudonymous id | `cv_links.learner_ref` default `gen_random_uuid()`, unique; never derived from the student id; a new row (and ref) after a withdrawal |
| Minors, before consent | `uf_cv_allowed`/`uf_consent_covers_cv` false for `pending`; RLS needs `uf_may_process`; routes use `requireReady` (GET/POST) |
| Minors, sharing | Trigger `uf_cv_share_row_allowed`, `openShare` re-check, `cv.share` stripped for under-18s in the envelope, `ageBand` only |
| Turning 18 | The guardian's consent stops covering the CV (`uf_is_adult` branch needs adult-v3); jobs re-read consent and close the row (`consent_required`) |
| Cross-border today | `CV_ADAPTERS = {}`; stand-in in process; `UF_CV` refused in production, staging and demo; now the region too (A11-35) |
| Retention at Mmereko | Proposal §7.2 is the agreement's to fix; our side acks on collect and expires the row after 24 h 5 min (`cv.expire`) |
| Deletion | `tombstoneCv` on account deletion (store.ts:3717), guardian withdrawal (store.ts:1405) and withdrawal (`withdrawCv`); PDFs deleted from S3 on both paths; `cv_deletions` holds no student link |
| Export | `exportCv` + `cvPdfs` + `engineExport` in `/api/me/export` |
| Hard rule 4 | Payloads ids only (`defineJobKind` keys); `console.*` prints names and codes only (cv.ts:398, cv-routes.ts:176, services.ts:256, mmereko.ts:300 route and sunset header); audit words fixed |
| Security safeguards (s19) | RLS on every CV table; share tokens stored as SHA-256 hashes; PDFs in our S3 (encrypted at rest, the files service) |

## Not verified

- Mmereko's real region, retention and deletion (owner and agreement, §12).
- A real Postgres run of 0035's triggers in this session (the db package wasn't changed; its
  embedded-Postgres suite is the CV build's, `packages/db/src/cv.test.ts`).
- The share page and PDF route's behaviour (CV-A5's).
