# PHASE-6 — A11 Privacy and POPIA

**Project:** UniversityFlow · **Phase:** 6 (wave 10 audit of #115–#134) · **Date:** 2026-10-25
**Commit:** e09ad5b4 · **Audit source:** docs/audits/A11-privacy-popia.md @ e09ad5b4
**Result:** 0 Critical · 0 High · 3 Medium · 1 Low · 0 waived · 2 not measured

## Scope

`c0e1545c..e09ad5b4` (#115 to #134), the privacy-relevant parts: migrations 0040 (module outlines,
consent gate D9) and 0041 (module marks and targets, the D10 sweep), `packages/db/src/module-outlines.ts`,
`module-marks.ts` (by its tests), `store.ts` (diff: export, delete, demo store, demo sweeps),
`apps/web/lib/server/documents.ts`, `services.ts` (which reader gets an outline),
`lib/server/demo/outline-consent.ts`, `demo/personas.ts` (the draft consent use), `demo/core.ts`
(sweeps), `demo/phone-signup.ts`, `api/me/guardian`, `lib/server/cv-mmereko.ts`, `cv/page.tsx`,
`packages/content/src/en/privacy-page.ts`, `cv-mmereko.ts`, `demo-phone-signup.ts`,
docs/plans/phase-6-proposal.md D9/D10, docs/deploy/demo.md and hackathon-undo-pr.md (sweeps and
deletion steps), `.gitignore` and the photos commit. Live GETs of mmereko.tumoolo.tech `/`, `/login`,
`/terms`, `/privacy` (status codes and the home page's text only).

## Method

Code and migrations read against the A11 brief's checks 1–6 for the new tables and routes; a
search of every chat, agent and prompt file for outlines and marks (none); a search of every added
line for new logging; the route tests listed below read for what they prove. No throwaway test was
needed: nothing here is Critical or High.

## Findings

| ID | Audit | Severity | Location | Finding | Status | Plan |
|---|---|---|---|---|---|---|
| A11-61 | A11 | Medium | apps/web/lib/server/demo/core.ts:62-75; packages/db/src/store.ts:1678-1698; packages/content/src/en/demo-phone-signup.ts (noticePoints, onboardingNotice) | The demo's deletion promises rest on a **lazy** sweep that runs only when someone starts a learner or asks for a PIN, 50 accounts a call. The on-screen words say "deleted within 24 hours"; the judges' Firebase accounts (a real email) "after 30 days". Once visits stop (after judging), nothing is deleted until the next visitor or the owner's manual undo steps | Open | A scheduled sweep on the demo (a Vercel cron to a demo-only, secret-guarded route, or `pg_cron` in the demo's Supabase), or words that match the mechanism ("at the latest when the demo closes") plus a dated undo step |
| A11-62 | A11 | Medium | apps/web/lib/server/cv-mmereko.ts:12-20; packages/content/src/en/cv-mmereko.ts (separate); en/privacy-page.ts:226 | "Open Mmereko" is offered to a learner **at university whatever their age**, so 16- and 17-year-olds, and UniversityFlow tells them Mmereko runs "under its own terms and privacy policy". Live, Mmereko has neither (`/terms` and `/privacy` answer 404) and says nothing about under-18s or a guardian. The owner chose "18+ or university"; the words promise what doesn't exist yet | Open | Owner's call: 18+ only until Mmereko publishes terms and a privacy policy that say how it treats under-18s (recommended), or keep and change the words now. Widens MM-01 |
| A11-63 | A11 | Medium | packages/db/src/migrations/0040_module_outlines.ts:155-165 | D10 keeps a confirmed outline "until the learner deletes it or for the academic year plus one", but `module_outlines` has no `keep_until` and no deletion function: unlike 0041's marks there is nothing for A11-04's job to run. A11-60's row ("the D10 sweeps (module marks, outlines) exist") is therefore inaccurate for outlines | Open | A migration: `keep_until` as 0041 does and an owner-only `uf_delete_expired_module_outlines`, with a test; amend A11-60's text. **Needs a migration (main ends at 0041).** |
| A11-64 | A11 | Low | packages/content/src/en/privacy-page.ts:83 | The privacy page's "what we collect" names reports, letters and registrations, not module outlines (typed by hand they need only consent and are live for any consented university learner, with lecturers' names and work contacts, D3) or module marks and targets (0041, consent only). Same class as A11-33/A11-34 | Open | Two lines: outlines (and that lecturers' work contacts are kept), and module marks and targets with their keep-until rule |

### Why none is High

A11-61: the demo holds made-up learners by instruction; the real personal data on it (judges'
emails, any real photo, A11-51) has a documented manual deletion path (hackathon-undo-pr.md steps
2, 6, 8) that the owner runs at the end. A11-62: UniversityFlow sends Mmereko nothing, and production
cannot show the button until My CV is allowed there (wording v4). A11-63: no learner's outline
reaches the limit before 2028.

## Not measured

- **Real log output** (A11 check 3 asks for a sample): the Vercel logs are the owner's; the code adds
  one log line in scope (demo CV jobs: kind and error name only).
- **What Mmereko does with a minor** who signs up inside the frame: Mmereko's own code is out of
  scope; only its public pages were read.

## Holds (checked and sound)

- **Hard rule 5 and D9 in the data layer.** `module_outlines`, `module_marks` and `module_targets`
  have RLS policies `student_id = uf_current_student() and uf_may_process(student_id)` for read and
  write. An outline document, or a document turned into one (`before insert or update of kind`),
  and an outline saved `from_document`, are refused by triggers for every role, the owner's
  included, unless the consent names outlines (guardian v4 / adult-v3, neither live). The store
  refuses first with a reason (`ConsentOutdatedError('module-outlines')`). Tests: db
  module-outlines.test.ts:139-190, 327-345; api-module-outlines.test.ts:128.
- **The demo's draft consent** (`adult-v3-draft-demo-only`) is written only by the persona seed
  (`demo/personas.ts:420`); no route lets a learner choose a consent version, so production can't
  record it.
- **What the AI provider receives.** An uploaded outline goes whole to the outline reader
  (Anthropic, as reports do), which is why D9 gates it. Confirmed outlines, marks and targets never
  reach the chat: no file in `packages/agent` or the chat route mentions them. On the demo only the
  generator's SAMPLE outline PDFs are accepted (`api/documents/route.ts`, `isGeneratedSamplePdf`).
- **Minimisation (D3).** The confirmed outline has no field for a student number or a class list;
  ID, student and mobile numbers are refused in code and again in the database; lecturers' work
  details only. The outline's file is deleted on confirm (row in the transaction, object after it).
- **Export and deletion.** The export carries `moduleOutlines` and `moduleMarks`
  (store.ts:3944-3947); all three tables cascade from `students` on delete; tests prove both
  (module-outlines.test.ts:345, module-marks.test.ts:165). No new demo table in scope; the demo's
  080 accounts are ordinary students, deleted by "Switch learner" and the sweep with everything
  attached.
- **The marks' retention rule** is in the schema (`keep_until` generated, academic year + 2,
  1 January) and the owner-only sweep exists and is tested (module-marks.test.ts:190); that nothing
  schedules it is A11-60, known.
- **Hard rule 4 in new code.** Audit rows carry fixed words and IDs (`module-outline.confirmed`,
  reason `outline`/`learner`); the PIN and number are never logged (api-demo-phone-signup.test.ts:137);
  fixtures build numbers at runtime (080 and 082 prefixes) and use made-up names.
- **Open Mmereko and school-age minors.** A school learner under 18 never gets the button, the
  dialog or the frame (decided on the server, `cv/page.tsx:52-56`; E2E demo-features.spec.ts:255-262).
  Nothing about the learner goes to Mmereko: a fixed `/login` URL, `no-referrer`, no message.
- **The privacy page's Mmereko line** matches the code's rule (18+ or university) and says
  UniversityFlow sends nothing; the "own terms and privacy" half is A11-62 (and MM-01).
- **The demo phone sign-up's minors.** A minor's data waits for the guardian's yes (403 before it,
  api-demo-phone-signup.test.ts:297-332); on the demo the "guardian" link comes back to the same
  screen, which is exception H as approved (made-up guardians, 080 numbers, nothing sent).
- **The photos folder** was never committed: `git ls-files photos` is empty, `/photos/` is in
  `.gitignore`, and fefa236e changed scripts and `.gitignore` only.

## Carried-in findings

A11-19 to A11-23 (owner and legal): unchanged by this scope. A11-60: still open, and its text should
say the outline sweep doesn't exist (A11-63). MM-01 (Low): A11-62 adds Mmereko's missing terms page
and the minors at university; consider raising MM-01 with it. AI-01: being fixed on
`fix/ai-01-gemini-notice`, not re-filed.

## Remediation roadmap

- Quick: A11-64 (two privacy-page lines, owner's wording review); A11-62's words or the 18+ rule.
- Medium: A11-61 (a scheduled demo sweep, or the words and a dated undo step).
- Structural: A11-63 (a migration), with A11-04's retention job.

## What's genuinely good

The consent gate for outlines is in the database for every role and checked on the `kind` change
too, so no later code path can turn a stored report into an outline under old wording; and the
outline's file is deleted the moment the learner confirms it.
