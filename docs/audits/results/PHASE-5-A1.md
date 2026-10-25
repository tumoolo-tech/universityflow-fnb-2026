# PHASE-5 — A1 Comprehensive codebase

**Project:** UniversityFlow · **Phase:** 5 · **Date:** 2026-10-17
**Commit:** 0554343 (branch `phase-5/stack`, integration trial: main at #76 + #73 + #77 + #78) · **Audit source:** tumoOLO_Audits (brief `audit-brief-A1.md`, phase-4 header) + `docs/audits/A1.project.md`
**Result:** 0 Critical · 1 High · 2 Medium · 5 Low · 1 Info · 0 waived · 6 not measured

```
Phase:      5
Scope:      git diff 7e8ddef..0554343: offers (#70, 0018), catalogue campus/place/office/calendar/
            curriculum records and compareRegistration (#68, #69, #71-#74), care and red team (#75),
            campus tour, first-week checklist (0019), crisis-card campus lines, safety pushes (#77),
            proof of registration, My modules, change-deadline reminder (0020, #78), and the
            5b/5c merge commits fa58995 and 0554343
Since:      7e8ddef (the Phase 5 plan, #67)
Excluded:   accuracy of the catalogue data itself (A13); native screen UX (A2/A3/A7)
```

Independent reviewer, report only. Every finding was proven with a throwaway probe
(`a1-phase5.audit-tmp.test.ts` in `packages/agent/src` and in `apps/web/test`, each run alone,
then deleted) or read directly from the code at the line cited. Open findings in status.md are not
re-reported.

---

## 1. Executive summary

Phase 5 is in good structural health. The three new tables (`offers`, `first_week_steps`,
`registrations`) each have row-level security plus `uf_may_process` in both `using` and
`with check`, an ownership trigger for the foreign keys RLS can't see (letter/proof and reminder),
database-level shape checks (conditions, module JSON, ids only), an advisory lock per learner
around every write that has a cross-row rule, and the partial unique index that makes "one accepted
offer" true whatever the code above does. Export (`exportAll`) includes offers, registrations and
first-week steps, deletion cascades all three, and the RLS, consent and export tests exist for each.
Every new route uses `requireReady`; job payloads stay ids-only; no new code logs; drafts never
reach a learner through `catalogueView` (safety places are verified-only even in preview, checked
twice). The 5b/5c merge seams are clean: no lost or duplicated logic in the agent, tools, sample
model, native routes, artifact switch, export or migrations.

The weaknesses are in **correctness of the new verdicts**: a new crisis rule written for Phase 5
excludes its own most natural variants (A1-25); the registration check compares a registration with
whichever rule book is newest, not the one for the registration's year (A1-26); and the curriculum
model cannot express "any first-level course from another faculty", so two records already flag
valid registrations as wrong (A1-27).

**Top 5 risks**

1. **A1-25** "I want to disappear from this world" (and "…off the face of the earth", "…from
   everyone", "…into nothing") raise **no distress at all**: the 5d rule's negative lookahead
   excludes `from`, `off`, `into`.
2. **A1-26** A 2028 registration is checked against a 2027 curriculum and told "missing compulsory
   module" with no warning, while the same artifact refuses a 2027 calendar for the deadlines.
3. **A1-27** Free-choice electives can't be modelled: a Wits LLB learner taking the required 36
   credits from another faculty is told each such module "isn't in your course's curriculum… may be
   a typo", and gets a change-deadline reminder.
4. **A1-28** Safety pushes ("Before you arrive…", "Looking for a room?") stay scheduled after the
   accepted offer is declined or deleted.
5. **A1-29** The letter confirm form preselects the first fuzzy-matched programme; the plan says the
   learner chooses, never a pick.

---

## 2. Findings

| ID | Severity | Location | Finding | Why it matters | Fix | Test |
|---|---|---|---|---|---|---|
| A1-25 | High | `packages/agent/src/crisis.ts:134` | The Phase 5d rule `want to … disappear\b(?! (?:in\|into\|to\|for\|from\|under\|with\|until\|till\|off\|on\|at)\b)` was meant to keep "disappear into bed for the weekend" out, but it also drops every death-wish variant that names where. **Proven** (`assessDistress`): "i want to disappear from this world" → `none`; "i just want to disappear from everyone" → `none`; "i wanna disappear off the face of the earth" → `none`; "i want to disappear into nothing" → `none`. Only "…for good"/"…forever" are saved by the older rule. Not even `concern`, so no card at all. | Hard rule 7 / §4.3: a crisis message gets the model instead of the reviewed reply and verified lines. The model may still call `crisis_card`, but the crisis protocol exists so that is never relied on. These are common phrasings in exactly the first-weeks context 5d targets. A10 owns the final grade; precedent (A10-01, everyday phrasings missed) was Critical. | Invert the exclusion: list the benign completions ("into bed", "under the covers/blankets", "for the weekend/a while/a bit", "to my room", "on holiday") instead of excluding whole prepositions; add `from (this\|the) world`, `off the face of the earth`, `from everyone`, `into nothing(ness)?` as crisis. | Red-team cases for the four phrases above → `crisis`; the existing benign cases stay `none`. Fails today. |
| A1-26 | Medium | `packages/agent/src/modules.ts:171` (`curriculumFor(view, programme.id)`), `packages/catalogue/src/catalogue.ts:306` | `curriculumFor` returns the newest curriculum the view holds, whatever the registration's `academicYear`, and `myModules` runs `compareRegistration` on it. The same artifact's deadlines (`changeDeadlinesFor`, `registration-deadlines.ts:92`) refuse a calendar for any other year: "a calendar for another academic year is not this year's". **Proven:** verified curriculum 2027, registration 2028 → `status: 'checked'`, `curriculum.academicYear: 2027`, differences `missing-compulsory` (+ `not-in-curriculum`), deadlines `none`. The only signal is "Checked against the 2027 first-year curriculum." Every curriculum in the data is 2026 while `likelyAcademicYear` defaults new registrations to 2027 from October. The `compare_registration` tool tells the model `verdict: 'has differences'`. | Rule books change module codes and compulsory lists year to year; planning §3 Stage 5 says "the official curriculum **for that year**". Once records are verified, a learner can be told they are missing a compulsory module that no longer exists, and nudged to change a correct registration before the deadline. Not reachable in production today (every curriculum is a draft). | Match the year: `curriculumFor(view, programmeId, academicYear)` returning only that year's record; otherwise `status: 'no-curriculum'` (or a distinct `'other-year'` status with no verdict, if the owner wants the older book shown as reference only). Same rule as the deadlines. | `myModules` with a verified 2027 curriculum and a 2028 registration → no `checked` status, no differences, no reminder. Fails today (probe above). |
| A1-27 | Medium | `packages/catalogue/src/curriculum.ts:53-63` (elective groups are closed lists), `packages/admissions/src/registration.ts:148`; data: `wits-curricula.ts:292` (wits-llb), `ukzn-curricula.ts:95` (ukzn-bsc-computer-science-it) | The schema can only say "choose N from these codes". Two records already need "any first-level course from another faculty / any Level 1 elective", and their notes say so: Wits LLB "must complete … courses from any other Faculty … to the value of 36 LLB credits"; UKZN BSc CS&IT "any Level 1 elective counts". `compareRegistration` turns every such valid module into `not-in-curriculum` ("isn't in your course's first-year curriculum. Check the code: it may be a typo, or a module from another course.", `en.ts:829`) and, with a change deadline published, `saveRegistration` schedules a change-deadline reminder for it. (Read from the code; the comparison path is the one A1-26's probe exercised.) | A verifier can't fix this in data: there is no field for it, so verifying the record as printed produces wrong verdicts for every learner on these programmes. | Add an open-elective rule to the curriculum schema (e.g. `openElectives: { credits, label }`) and have `compareRegistration` count unmatched modules against it (no `not-in-curriculum` while open credits remain; `elective-group-unsatisfied` style shortfall otherwise), or mark such a curriculum `checkable: false` so it gets no verdict. Integrity test: a curriculum whose note mentions an open elective must use the field. | Wits-LLB-shaped synthetic curriculum + a registration with the four law modules and one 36-credit module from another faculty → no differences. Fails today. |
| A1-28 | Low | `apps/web/app/api/offers/[id]/route.ts:26-29, 35`; `apps/web/lib/server/campus.ts:122` | The safety pushes are scheduled on accept, but decline and delete only drop the offer's reply-by reminder. **Proven:** push on, accept → decline → delete: both `safety.offer-accepted` and `safety.move-in` still `scheduled`. | A learner who turned down every place still gets "Before you arrive…" and, in January, "Looking for a room?"; each also spends a slot of the learner's weekly cadence that a real reminder may need. Generic copy, so not harmful. | When no offer is accepted any more (decline or delete of the accepted one), drop waiting `safety.*` reminders (`replaceLearnerReminder`'s drop half) and cancel their jobs. | The probe's sequence → both `dropped`. Fails today. |
| A1-29 | Low | `apps/web/app/(app)/offers/offers-view.tsx:367` | `useState(candidates[0] ?? '')`: the letter's programme field opens on the top fuzzy match from `programmeCandidates`. Planning §11 5a and `admissions/offers.ts:96-99` say the list is "never a decision… the learner picks one". | Hard rule 6 in spirit: a learner skimming the form saves the code's guess, and the January final-results check then runs on the wrong programme. | Start on an empty "Choose your course" option (as the "I got in" form does), with the candidates listed first. | Component test: the confirm form's programme select is empty until chosen and Save is disabled. Fails today. |
| A1-30 | Low | `packages/agent/src/tools.ts:616, 624` | The `offers` tool's `unverified_preview_data` is the programme's draft flag only; the final-results check's Plan B entries carry their own `draft` (in the artifact) but not into the per-offer or top-level flag. | A10-13 / definition of done: "each tool's output carries the preview flag for drafts". Preview mode only. | OR in `c.finalCheck?.planB.some(p => p.draft)`. | Offers tool on a preview view with a not-met final check whose Plan B is draft → flag true. |
| A1-31 | Low | `apps/web/app/api/reports/route.ts:34` vs `lib/server/offers.ts:135`, `lib/server/registration.ts:132` | Phase 5 made documents typed (`acceptance-letter`, `proof-of-registration`); offers and registrations check the document's kind, but report confirmation still accepts any of the learner's documents and marks it `confirmed`. | A proof of registration can be linked to a report and shown as confirmed. Own data only; a seam, not an exploit. | `if (document.kind !== 'grade-11-report') throw new HttpError(400, 'invalid')`. | POST /api/reports with a proof's documentId → 400. |
| A1-32 | Low | `apps/web/lib/server/offers.ts:50, 60` and `apps/web/lib/server/registration.ts:47, 66` | `reminderChannel` is copied verbatim, and `replyByReminderAt` / `changeDeadlineReminderAt` are the same function with a different constant (18:00 SAST, N days before, `now` if past, null after). 5b's safety times are a third copy of the 18:00 rule. | Three places to change when gotcha 31's hour or the channel order changes. | One `reminderChannel` and one `daysBeforeAt(day, days, now)` in `lib/server/reminders.ts`. | Existing tests cover it. |
| A1-33 | Info | `apps/native/app/offers.tsx:27`; planning §11 5d | 5d lists "letter and registration upload by camera" and "reminders for … registration day". The app reads proofs of registration, but a letter is not readable in the app ("Reading a letter by camera is Phase 5d") and there is no registration-day reminder. | A scope gap for the phase gate, not a defect. | Deliver or move to a later phase in status.md. | — |

---

## 3. Project-specific checks

| Check | Result |
|---|---|
| Rule 1: `packages/*` never import `apps/*` | Pass (guard green; no new cross-import). |
| Rule 2: admission facts only in catalogue/admissions | Pass. Templates have no digits; deadlines, credits, terms reach screens from `admissions`/`catalogue`; `OFFER_GUIDANCE`/`OFFER_RULES` describe offer kinds generically, no requirement or date. |
| Rule 3: drafts never reach a learner | Pass. `catalogueViewOf` gates campuses, places, offices, calendars and curricula; safety places verified-only even in preview, and `campusSafetyLines` re-checks `isDraft`. E2E fixtures are drafts and `readConfig` refuses `UF_CATALOGUE_E2E_FIXTURES` in production. See A1-26/27 for verdicts once verified. |
| Rule 4: no PII in logs, payloads, fixtures | Pass. No new `console.*`; reminder params `{ universityId }`; letter/proof schemas have no field for name, ID, student number, address or fees; upload file names fixed; registration columns cannot hold them (test asserts the column list). |
| Rule 5: consent in the data layer | Pass for all three tables: RLS `using` + `with check` with `uf_may_process`; `#as(..., personal=true)`; `acceptedOfferUniversity` (SMS crisis lines) checks `uf_may_process` as the learner. Tests: minor refused before consent, cross-learner isolation. |
| Rule 6: confirmed before use | Pass, with A1-29. Letter, proof and manual entries are saved only through `/api/offers` and `/api/registration` after an explicit form; extractions stay in `documents.extraction`. |
| Rule 7: red team 100% | Not measured here (A10 runs it; full-suite runs forbidden). A1-25 adds cases the suite lacks. |
| Rule 8: strings and tokens | Pass on the scan: no hard-coded JSX text or labels in the new web and native components; guard green. |
| Rule 11: shared packages RN-safe; native lists deps | Pass. New `basics.ts`, `curriculum.ts`, `campus.ts`, `registration*.ts`, `ui/artifacts.ts` are pure; `ui` now depends on `content` and declares it. |
| Data layer: export / deletion of 0018–0020 | Pass. `exportAll` returns `offers`, `registrations`, `firstWeek`; deletion cascades from `students`; letters' and proofs' storage keys are collected with all documents. |
| Concurrency | Pass. Advisory locks (`offers:`/`registrations:` per learner) taken as owner before the role drop; `offers_one_accepted` partial unique index; `unique (student_id, academic_year)`; real-Postgres race tests exist (`postgres.test.ts:227, 267`). |
| Guard coverage of new code | No guard changed in the diff; the shared-package and PII guards walk the new files by directory, so they cover them. No new `check-ignore`, `@ts-ignore`, `any` or TODO added. |
| 5b/5c merge seams | Clean: both sides kept in `index.tsx`, `artifact-card.tsx`, `push.ts` (`AppRoute` and `ROUTES` hold all seven screens), `types.ts`, `agent/index.ts`, `sample-model.ts`, `testing.ts`, `tools.ts` `TOOLS`, `content/en.ts`, migrations index (0018→0019→0020), export, nav. |
| Production refuses stand-ins | Pass. Live mode wires `AnthropicLetterReader`/`AnthropicRegistrationReader`; sample readers only behind `hasKey` in local mode; both share `readStructured`, which never returns partial output or leaks the response in an error. |
| Agent-written-code smells | None found beyond the above: tests assert behaviour (RLS counts as owner, export contents, gate timings), not mocks. |

---

## 4. Not measured

1. **Crisis red-team at 100%**: forbidden to run whole suites (gotcha 39); A10's run is the record.
2. **E2E and full package suites**: same reason; the brief states the trial passed every gate.
3. **Real-Postgres suite** (`TEST_DATABASE_URL`): port 5432 is not this auditor's.
4. **Live AI readers** (`AnthropicLetterReader`, `AnthropicRegistrationReader`) against real documents: no key, and real documents are forbidden in the repo.
5. **Quarter vs semester matching** (`offeredIn`, e.g. a UP proof printing Q1 for an S1 module): no verified curriculum with quarters exists to test against.
6. **Concurrent `PUT /api/registration` leaving a linked reminder orphaned** (`saveRegistration` then `setRegistrationReminder` outside the lock): reasoned, not reproduced, so not reported.

## 5. Waived

None.

## 6. Remediation roadmap

- **Quick wins (< 1 day):** A1-25 (regex + red-team cases), A1-28, A1-29, A1-30, A1-31, A1-32.
- **Medium:** A1-26 (year-matched curriculum lookup and a status for "no rule book for your year").
- **Structural:** A1-27 (open-elective rule in the curriculum schema, comparison and verification kit).

## 7. What's genuinely good

- The data layer for 0018–0020 is defence in depth done properly: TS checks, then database
  checks (`uf_offer_conditions_ok`, `uf_registration_modules_ok`, `starts_with(programme_id, …)`),
  ownership triggers for FK targets RLS can't see, and an index that makes "one accepted offer"
  impossible to break.
- Safety places are verified-only in the view **and** at the point of use, and the SMS crisis reply
  adds campus lines only while they fit and never at the expense of a helpline; a failing lookup
  never stops the reply (try/catch in both `crisisHelp` and `campusLinesFor`).
- `changeDeadlinesFor` is honest: another year's calendar gives nothing, a term with no published
  deadline is listed as such, never given a neighbour's date.
- Registration data minimisation is enforced by shape, not policy: no column, schema field or
  draft field can hold a student number, and a test asserts the table's columns.
- Model inputs exclude learner-typed text (letter conditions, unknown module codes) per A10-12.
