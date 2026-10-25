# PHASE-4 — A1 Comprehensive codebase

**Project:** UniversityFlow · **Phase:** 4 · **Date:** 2026-10-14
**Commit:** 7d53bc6 (branch `phase-4/audits`) · **Audit source:** tumoOLO_Audits @ 29eafd7
**Result:** 0 Critical · 0 High · 3 Medium · 3 Low · 0 waived · 9 not measured

```
Phase:      4
Scope:      the whole Phase 4 diff, git diff 17ca607..7d53bc6 (#20–#34): job scheduler, AI adapters,
            consent redirects, 4a messaging, 4b goals/exam timetable, 4c what-I-need and re-checks,
            4d push/camera/store, 4e practice and care
Since:      17ca607
Excluded:   docs/verification data accuracy (A13)
```

Independent reviewer, report only. Every finding below was proven by a throwaway test
(`*.audit-tmp.test.ts`, run once, then deleted) or read directly from the code at the line cited.
Findings already in status.md (A1-01…A1-11, A8-01, A13-01) are not re-reported.

---

## 1. Executive summary

Phase 4 is in good health. 230 files and ~23k lines added, and the load-bearing rules hold: every
new route uses `requireReady`/`requireSignedIn` (CSRF and consent), every new table has row-level
security plus the consent gate, job payloads are IDs-only in the type, at runtime and in a
database constraint, every channel re-checks opt-in at the last moment, live mode never falls
back to a stand-in, and no new code touches the DOM in a shared package. The guards, lint
(committed files) and typecheck are green. No Critical or High was found.

The weaknesses are where processing now happens **without a learner's request**, which Phase 4
introduced: the reminder pipeline trusts the database's consent function, which is weaker than
the app's own readiness rule (A1-13); one path creates reminders outside the learner-reminder
limit (A1-12); and the SMS cost model counts messages, not the 2–3 UCS-2 segments every
reminder template actually costs (A1-14).

**Top 5 risks**

1. **A1-13** A learner who turns 18 under guardian consent is locked out of the app until they
   consent in their own name, but the reminder pipeline keeps reading their data and messaging them.
2. **A1-12** Re-confirming June reports creates unbounded reminders and jobs, bypassing the
   10-a-day reminder limit (cost and queue growth on the hosted scheduler).
3. **A1-14** Every SMS reminder template contains a curly apostrophe (`’`), so it goes as UCS-2:
   2–3 segments each, up to 8 at the 480-character cap; the SMS budget counts one.
4. **A1-15** A reminder whose handler fails after the claim stays in `sending` forever: never
   sent, never retried, never reported.
5. **A1-16** Copy: in live mode without a WhatsApp adapter, the WhatsApp row on About me says
   "App notifications come with the UniversityFlow app."

---

## 2. Findings

| ID | Severity | Location | Finding | Why it matters | Fix |
|---|---|---|---|---|---|
| A1-12 | Medium | `apps/web/app/api/reports/route.ts:18-48`, `apps/web/lib/server/rechecks.ts:67-80` | Each confirmed `grade-12-june`/`-september` report whose results differ from the previous one schedules a `recheck.changed` reminder and a job. `/api/reports` has no rate limit and `saveConfirmedReport` (`packages/db/src/store.ts:742`) none either, so a learner (or a script holding a session) alternating two sets of marks creates any number of reminders. **Proven:** 25 alternating June confirmations → 25 reminders in `GET /api/me/reminders`, where `POST /api/me/reminders` refuses the 11th in a day (`REMINDERS_PER_DAY`, `apps/web/app/api/me/reminders/route.ts:19`). | The 10-a-day limit exists "not [as] a way to spam the queue"; this path skips it. Cadence still holds sends to ≤1 a day, but every extra reminder is a row, a job, and up to 20 reschedules, each a billed run on a hosted scheduler (Trigger.dev, spike 5). Unbounded per-learner writes. | Rate-limit report confirmations per learner (`store.allow('report', studentId, …)`), and make `recheckAfterConfirm` schedule at most one open `recheck.changed` reminder per learner (skip when one is still `scheduled`). Test: 25 alternating confirmations → at most one scheduled `recheck.changed` reminder, and a 429 past the limit. |
| A1-13 | Medium | `packages/db/src/messaging.ts:104-107` (`claimSend`), `:317-350` (`mayMessage`), `:276-284` (`examInputs`); `uf_may_process` in `packages/db/src/migrations/0002_audit_hardening.ts:23-28`; vs `apps/web/lib/server/session.ts:41-46` | The app treats a learner who turns 18 under guardian consent as **not ready** until they consent as an adult (`needsAdultConsent`, planning.md §8.1): every route answers 403. The database's `uf_may_process` checks only `consent_status in ('not-required','granted')`, and the reminder pipeline relies on it alone, so it keeps reading the learner's phone, display name and report subjects and sends them messages. **Proven:** DOB 2008-10-20, guardian grants, SMS opt-in, reminder for 2026-10-21; on 2026-10-21 `GET /api/me/reminders` → 403, yet `POST /api/dev/jobs/run` delivers the SMS. Reachability: needs the learner's own opt-in; the content is a reminder they set. | The request layer and the data layer disagree on who may be processed: the class of defect A1-10 fixed for pages, now in the first processing that runs without a request (Phase 4). Hard rule 5 says consent is enforced **in the data layer**; here the data layer is the weaker check. | Put the adult re-consent rule in the database: `uf_may_process` returns false when `consent_status = 'granted'` and the date of birth is 18+ in SAST (or flip `granted` → `needs-adult-consent` at the birthday and exclude it). Then `claimSend`, `mayMessage`, `examInputs` and every `StudentStore` read agree with `isReady`. Test: the scenario above drops the reminder as `no-consent` and the outbox stays empty. |
| A1-14 | Medium | `packages/content/src/messages.ts:78, 88, 98, 112`; `packages/messaging/src/sms.ts:27-28` | Every SMS template body contains `’` (U+2019), which is not in the GSM 03.38 alphabet, so the whole message is sent as UCS-2: 70 characters in one segment, 67 per segment after that. **Proven:** every SMS template renders non-GSM and longer than one segment (e.g. `recheck.changed` with a first name ≈ 135 characters → 3 segments). `SMS_MAX_LENGTH = 480` is documented as "160 GSM characters; we never send more than three", but 480 UCS-2 characters is **8** segments. The PIN SMS (`en.auth.smsBody`) is GSM and unaffected. | Reminders cost 2–3× what one message per send assumes; the global SMS budget (A1-01's fix) counts messages, so its 300/hour and 2,000/day caps under-count real spend by the same factor. The comment states a guarantee the code doesn't keep. | Use straight apostrophes (`'`) in SMS bodies (or transliterate to GSM in `SmsChannel` before sending), and cap by **segments**, not characters: compute the encoding, refuse above 3 segments, and charge the budget per segment. Test: every SMS template renders GSM-7 and ≤ 1 segment with the longest allowed variables; a UCS-2 text over 3 segments is refused. |
| A1-15 | Low | `packages/messaging/src/reminders.ts:204, 249-252, 290`; `packages/db/src/messaging.ts:142-145` | `claimSend` commits the reminder as `sending` before the send. If the handler then throws for any reason other than a provider error (the resolver, `recordSent`, a DB blip, a lost worker), the job is retried, but the retry sees `status !== 'scheduled'` and returns; the job is marked done. **Proven** with an in-memory store: resolver fails once → reminder stays `sending` through attempts 2 and 3, nothing sent. No sweeper exists (no other code reads `sending`). | The reminder is silently lost (or, if `recordSent` failed after a send, shown as never sent with no receipt check), and its `sent_at` counts against the learner's cadence for a week. Not harmful to anyone, but invisible. | Release the claim on any error after it (wrap the post-claim section; on failure call `store.release` before rethrowing), or let a retry resume a `sending` reminder whose claim is older than the job lease. Test: a resolver that throws once → the retry sends, status `sent`. |
| A1-16 | Low | `apps/web/app/(app)/me/messages-card.tsx:82-85` | For any channel that isn't offered and isn't push-in-app, the hint is `t.pushLater` ("App notifications come with the UniversityFlow app."). In live mode WhatsApp is not offered until the owner connects a provider (`WHATSAPP_ADAPTERS` is empty), so the **WhatsApp** row says this, and so does a WhatsApp row the learner had opted in to before it was withdrawn. **Proven:** rendering with `offeredChannels: ['sms']` shows `pushLater` twice (WhatsApp and push). | Wrong microcopy on the consent screen; a learner can't tell why WhatsApp is greyed out. | A per-channel "not available yet" string in `packages/content` (`en.me.messages.notOffered(channel)`), and `pushLater` only for push. Test: the same render shows `pushLater` once, under push. |
| A1-17 | Low | `apps/native/app.config.ts:51` | `UF_EAS_PROJECT_ID` (needed for Expo push tokens in a store build, `apps/native/lib/push.ts:44-48`) is read but not documented in `.env.example`; it appears only in status.md and `docs/store/release-checklist.md`. | Convention: `.env.example` documents every variable. Without it a production build silently has no project id and `turnOnPush` answers `no-device`. | Add it to `.env.example` with a one-line note (set after `eas init`; not a secret). Test: a check that every `process.env[...]` name in `apps/**` and `packages/**` appears in `.env.example` (a guard), failing today on `UF_EAS_PROJECT_ID`. |

---

## 3. Project-specific checks

| Check | Result |
|---|---|
| `packages/*` import from `apps/*` | **Pass** — guard `no-app-imports-in-packages` green |
| DOM/Node globals in `admissions`, `catalogue`, `content`, `tokens`, `ui` | **Pass** — guard green; `jobs` added to the server-only list in the guard's comment only (no weakening) |
| `apps/native` lists every workspace package | **Pass** — guard green |
| Admission facts only in `catalogue`/`admissions` (hard rule 2) | **Pass** — goal card, what-I-need, re-check and countdown all come from `packages/admissions`/`agent/goals.ts`; the system prompt forbids marks, dates and resources from memory; templates carry no facts |
| Drafts never reach a learner (hard rule 3) | **Pass** — goals (`programmeById` on the view), what-I-need (`scorable`), re-check names (view lookup, unseen programmes dropped), countdown, practice, and the reminder `universityName` resolver all go through `catalogueView` |
| No personal data in logs, payloads, fixtures (hard rule 4) | **Pass** — job payloads IDs-only (type, runtime, DB constraint); webhook and route errors log names only; push bodies variable-free; synthetic numbers built at runtime in tests |
| Consent in the data layer (hard rule 5) | **Partial** — new tables RLS + `uf_may_process`; push-token registration checks consent as the learner; but see **A1-13** (adult re-consent) |
| Confirm before use (hard rule 6) | **Pass** — what-I-need, re-checks, exam subjects and practice read only `latestReport()`/`recentReports()` (confirmed); native upload ends in the confirm screen |
| Strings from `content`, design values from `tokens` | **Pass** — no hard-coded JSX text found in new components; native radii are `theme.radius.*`, web uses token-backed Tailwind classes; the two hex values in `app.config.ts` mirror tokens and are drift-tested |
| Motion | **Pass** — no new animation; native stack `animation: 'none'`; no scroll handlers or `will-change` in the diff |
| Content `status: 'placeholder'` | **Pass** — none in `packages/content` |
| Guards, coverage floors, CI weakened | **Pass** — no guard logic changed; CI changes are action version bumps, all pinned by SHA or major |

---

## 4. Not measured

| Check | Why |
|---|---|
| Radius-zero rule (`docs/design-system.md` §3) | That file does not exist in this repo; the overlay line was written for another project. UniversityFlow's identity uses token radii (`theme.radius.sm/md/full`, Tailwind `rounded-*`), which is consistent, so no radius finding is raised |
| Inherited defects (`docs/known-issues.md`) | That file does not exist in this repo |
| Build, E2E with axe, contrast in the browser | Not run, by instruction (nine reviewers run concurrently) |
| `db` suite on real Postgres 17 (`TEST_DATABASE_URL`) | Ports 5432/55432/55433 are off limits for this run; PGlite paths were exercised through the web API tests instead |
| The app on a real phone (push delivery, camera, Android back stack) | No device; status.md says it has never run on one |
| Coverage for packages other than `messaging` | Only `messaging` was measured (98.86% statements, 99.57% lines, above its floor). status.md's "messaging 100%" is stale |
| Crisis and care phrase coverage | Owned by A10, running concurrently |
| POPIA, push residency, WhatsApp policy, cost model in depth | Owned by A11/A12; A1-14 is raised here because it is a code defect behind a false comment |
| Dependency CVEs | Owned by A8 |

`pnpm lint` exits non-zero at the time of this run only because of other reviewers' untracked
`*.audit-tmp.*` files (`packages/evals/src/phrasings.audit-tmp.test.ts`); the committed tree had
no lint error. `pnpm check` and `pnpm typecheck` passed.

## 5. Waived

None.

---

## 6. Remediation roadmap

**Quick wins (< 1 day)**
- A1-14: straight apostrophes in SMS template bodies, plus a test that every SMS template is GSM-7
  and one segment; then budget per segment.
- A1-16: a per-channel "not available yet" string.
- A1-17: document `UF_EAS_PROJECT_ID`; consider an env-documentation guard.
- A1-12: a per-learner limit on report confirmations; one open `recheck.changed` reminder at a time.

**Medium**
- A1-15: release the claim on any post-claim failure (or resume stale `sending` claims), with the
  failing-resolver test.

**Structural**
- A1-13: move adult re-consent into the database's own consent function, so the data layer, the
  pages and the background jobs share one definition of "may process". Re-run the consent suites
  (PGlite and real Postgres) after.

---

## 7. What's genuinely good

- **The send-time pipeline.** `claimSend` takes a per-learner advisory lock, drops to the
  learner's role, re-checks consent, opt-in, cadence and address in one transaction, and the
  channel asks `mayMessage` again just before the provider. Racing runners can't both take the
  last slot, and a STOP a moment ago still counts.
- **IDs-only job payloads, three times over:** the `defineJobKind` type, a runtime check on the
  way in and out of storage, and `uf_job_payload_is_ids` in the database.
- **Cadence as pure code** (`cadence.ts`): each rule only moves the candidate time forward, so the
  answer is provably the earliest legal time; property-tested over a simulated year.
- **Live mode never falls back to a stand-in:** empty WhatsApp, SMS and job registries make
  `UF_PROVIDERS=live` refuse to start, naming what's missing; the webhook route 404s outside local.
- **Signed webhooks** done properly: HMAC over timestamp and exact body, 5-minute window,
  constant-time compare on fixed-length buffers, size cap before reading, STOP never rate-limited,
  same answer for known and unknown numbers.
- **Push minimises data by construction:** the lock-screen body is a variable-free `pushBody`,
  `data.screen` is a word from a fixed list the app re-validates (`routeForNotification`), tokens
  hang off sessions so sign-out removes them, `DeviceNotRegistered` forgets the token at once,
  and the token is never echoed or logged.
- **"What I need"** says plainly when no marks would do it (`blockers`), never invents a route
  around a missing subject, and is shared by the chat, the web page and the app, so they can't
  disagree.
- **The reports confirmation is strictly ordered** (advisory lock plus a monotonic
  `confirmed_at`), so "latest" and "previous" for a re-check never depend on two clicks landing in
  the same millisecond; the re-check trigger also checks it is still the newest report.
- **The native upload** names the file `report.<ext>` (no learner file name leaves the phone),
  deletes only the app's own cached copy, and sends `credentials: 'omit'` on every request.
