# PHASE-6 — A1 Comprehensive codebase audit (wave 10: #115–#134)

**Project:** UniversityFlow · **Phase:** 6 (6a–6d) and the hackathon exceptions · **Date:** 2026-10-25
**Commit:** e09ad5b4 · **Audit source:** tumoOLO_Audits @ 29eafd7 (brief A1 + docs/audits/A1.project.md)
**Result:** 0 Critical · 0 High · 4 Medium · 4 Low · 1 known finding corrected (CI-01) · 0 waived · 5 not measured

## Scope

- Commits `c0e1545c..e09ad5b4` (#115 to #134). Paths read in full or in the parts named:
  - `packages/admissions/src/{assessment,mark-needed,client,colleges}.ts`
  - `packages/catalogue/src/{assessment,provenance,colleges}.ts` and `data/{uct,wits}-assessment.ts` (in part)
  - `packages/ui/src/mark-calculator.ts`
  - `packages/documents/src/module-outline.ts` (the confirm schema)
  - `packages/db/src/{module-outlines,module-marks}.ts`, migrations `0040` and `0041`, and in `store.ts` the demo sections, `#take`, `requestOtp` and `verifyOtp`
  - `apps/web/lib/server/{module-card,module-card-books,module-outlines,documents,cv-mmereko,services (diff),config (diff)}.ts`
  - `apps/web/lib/server/demo/{phone-signup,outline-consent}.ts`, `lib/{demo-phone-signup,mmereko-canvas}.ts`
  - routes `api/module-outlines`, `api/modules/[registrationId]/[code]`, `api/demo/sample-outline`, `api/auth/{request,verify}-pin` (diff), `api/documents` (diff); `app/(app)/cv/page.tsx`
  - the new content sections (searched for admission facts)
- **Excluded:** the pitch deck (searched for secrets only by the CI secret scan, not by me); pictures and logos; the native screens; `outline-view.tsx` (991 lines, not read line by line); the plan-map canvas beyond its reduced-motion path.

## Method

I read the code against the 11 hard rules and the overlay's load-bearing places. I hunted for wrong answers in the mark maths: rounding, weights, subminima, the supplementary range, the year, drafts, and unconfirmed values. Then I traced each Phase 6 value from the document through the confirm step, the database and `resolveScheme` to the calculator.

I proved two findings with throwaway Vitest files, run under a suite lock and then deleted (bodies and output below). `pnpm check` passes at e09ad5b4 (11 guards). I didn't run the real-Postgres suite (no `TEST_DATABASE_URL`).

## Findings

| ID | Audit | Severity | Location | Finding | Status | Plan |
|---|---|---|---|---|---|---|
| A1-81 | A1 | Medium | packages/documents/src/module-outline.ts:529-543, 272-275; apps/web/lib/server/module-card.ts:319-326; packages/catalogue/src/assessment.ts:232, 254-261 | An outline the confirm step and migration 0040 accept (two components with one name; weights like 33.333 ×3, total 99.999) is refused by `resolveScheme` (`weightingProblems`: exact sum, unique names). `moduleCardData` then quietly drops the learner's confirmed outline and uses the published scheme (or "not published"), with no conflict shown | Open | One rule in one place: the confirm schema and 0040 use `weightingProblems`' tolerance and refuse duplicate names (the learner fixes them on the confirm step). The card says when a confirmed outline couldn't be used, instead of falling back silently. Tests: both throwaways below |
| A1-82 | A1 | Medium | packages/admissions/src/mark-needed.ts:375; packages/ui/src/mark-calculator.ts:389-390; packages/content/src/en/module-card.ts:181-182 | `already-secured` reads "Your marks so far already reach this, whatever your exam mark" when no exam subminimum is published (`examSubminimum: 'not-published'`) and whatever the DP status. "Not published" turns into "none" (gotcha 40), and a learner may decide not to prepare for the exam | Open | When the subminimum is `not-published`, say the exam may still have a subminimum the rules here don't print. Show `secured` only beside a DP that isn't `not-met`. New content key for the owner's wording |
| A1-83 | A1 | Medium | apps/web/lib/server/demo/phone-signup.ts:81-85, 91-97, 100-114 | The demo's "this browser made it" cookie is HMAC(number) alone, refreshed for 24 h on every sign-in. The account is deleted 24 h after it was *made*. A browser that signed in again at hour 23 still holds a valid mark for up to 23 h after the sweep, so if another judge makes an account on the same 080 number in that time, the first browser gets its PIN on screen and signs in to the second judge's account | Open | Bind the mark to the account (HMAC of number + student id + created-at), and cap the cookie's `maxAge` at the account's remaining life. Test: two stores, sweep in between, the old cookie gets 409 `demo-080-taken` |
| A1-84 | A1 | Medium | packages/content/src/en/colleges.ts:19-20, 46-49 | Admission facts in content strings (hard rule 2): "Starts after Grade 9" (NC(V)), "Starts after matric or N3" (N4–N6), "NC(V) courses at public TVET colleges start after Grade 9". Graded below the overlay's High because they are true of DHET's NC(V)/NATED policy and no verdict reads them (`collegeOptions` decides from each record's quote). Still unsourced, and they'd go stale silently | Open | Move the two programme-type entry rules into the catalogue as sourced records (DHET's NC(V) and Report 191 pages). The words take the grade as a parameter |
| A1-85 | A1 | Low | packages/admissions/src/mark-needed.ts:445; packages/ui/src/mark-calculator.ts:397-399 | `supplementaryOutlook` compares an unrounded final mark with a range printed in whole percents. 49.3 against "45–49%" with pass 50 is `above-range` (neither may-qualify nor below), so an "impossible" card says nothing about a supplementary | Open | A printed upper bound `to` covers everything below `to + 1` (or below the pass mark, whichever is lower); or apply the printed rounding first. Test: the throwaway below |
| A1-86 | A1 | Low | packages/admissions/src/colleges.ts:182 | Teach-out notices are checked against next year's intake for every programme. A Grade 10/11 learner can't start an N4–N6 programme before the year after matric, so a notice closing N4 from that later year would still list it. Latent: both live notices close from 2027 | Open | The intake year per programme type: the year after matric for N4–N6 (from the report's grade), next year for NC(V) |
| A1-87 | A1 | Low | packages/catalogue/src/colleges.ts:432-437, 453-454 | "Is this college registered?" answers "Yes … is on DHET's list" for a bare abbreviation the college's site prints (CTC, SCC, TSC, EEC, BCC…). Those aren't on DHET's list, and other (private) institutions use the same initials. That goes against the function's own "never a false yes" (the follow-up line naming the DHET college softens it) | Open | Abbreviations count only as "did you mean" suggestions, never `listed` |
| A1-88 | A1 | Low | apps/web/app/api/module-outlines/route.ts:38-39 (PUT, `files.delete` after `saveModuleOutline`) | D10's "the file goes once confirmed" runs after the transaction commits. If storage's delete fails, the learner gets a 500 for an outline that was saved, and the file stays with no row pointing at it, so nothing ever deletes it | Open | Queue the deletion as an ID-only job, retried (or list orphan keys in the sweep), and answer 200 once the outline is saved |
| CI-01 | A1 | Low (cause corrected) | packages/db/src/demo-phone-signup.test.ts:61-73; store.ts:870-871 | The known cause ("the hour window ticking") can't be it: the store's clock is frozen at `START` (lines 76-79). Suspected cause: `tollFree()` is random, and a repeated number inside that frozen minute hits the per-number 60-s cooldown, which throws `RateLimitedError`, so `count()` counts it as refused (99). The same `START` across tests and real-Postgres reruns widens the pool | Open | Unique numbers in the test (a counter), not random ones; keep the frozen clock |

Known findings re-checked: **A1-80** stands (Low). **COL-03** stands (Low; `verdictFor` at colleges.ts:166, `grade > passedGrade`).

## Proof: the throwaway tests (run under a suite lock, then deleted; none committed)

`packages/admissions/src/aud-a1-throwaway.test.ts` (A1-81's refusal half, and A1-85):

```ts
const records = { assessmentRules: [], moduleAssessments: [] };
const base = { module: { universityId: 'uct' as const, code: 'ABC1000F', academicYear: 2026 },
  faculty: 'Commerce', records, today: new Date('2026-10-24'), includeDrafts: false };
const outline = (components) => ({ moduleCode: 'ABC1000F', academicYear: 2026, confirmedOn: '2026-10-24', components });
it('two components with one name', () => {
  expect(() => resolveScheme({ ...base, outline: outline([
    { name: 'Test', kind: 'test', weight: 20 }, { name: 'Test', kind: 'test', weight: 20 },
    { name: 'Exam', kind: 'exam', weight: 60 }]) })).not.toThrow(InvalidSchemeError);
});
it('weights 33.333 x 3', () => { /* same, three components of 33.333 */ });
it('49.3 with "45-49%" and pass 50', () => {
  // scheme with passMark 50 and supplementary { eligibleFinalMark: { from: 45, to: 49 } }
  expect(supplementaryOutlook(scheme, 49.3).kind).toBe('may-qualify');
});
```

Output: `Tests 3 failed (3)`. Among them:
- `AssertionError: expected error not to be instance of InvalidSchemeError … "The components weigh 99.999%, not 100%"`
- `AssertionError: expected 'above-range' to be 'may-qualify'`

`packages/documents/src/aud-a1-throwaway.test.ts` (A1-81's acceptance half):

```ts
it('accepts two components with one name', () => {
  expect(confirmedModuleOutlineSchema.safeParse(outline([
    { name: 'Test', kind: 'test', weight: 20 }, { name: 'Test', kind: 'test', weight: 20 },
    { name: 'Exam', kind: 'exam', weight: 60 }])).success).toBe(false);
});
it('accepts 33.333 x 3', () => { /* same shape */ });
```

Output: `Tests 2 failed (2)`: `expected true to be false` both times. The confirm step accepts what `resolveScheme` refuses. Migration 0040 accepts the second one too (`round(total, 2) <> 100`, line 130). For the fallback, `apps/web/lib/server/module-card.ts:319-326` catches `InvalidSchemeError` and returns `resolveScheme(base)`, which leaves out the outline.

**A1-83 by reasoning** (file:line):
- `ownerMark` = HMAC(`uf-demo-phone-owner:v1:` + number) (phone-signup.ts:81-85). Nothing ties it to the account.
- `markOwner` sets it with `maxAge: 24 h` on every sign-in (:100-114).
- `sweepDemoStudents` deletes by `students.createdAt <= now − 24 h` (store.ts:1678-1698).
- `requireFreeOrOwn` lets the PIN through whenever an account exists for the number and the cookie equals HMAC(number) (:91-97).

Steps:
1. Browser A makes 080-X at T0 and signs in again at T0+23 h, so its cookie runs until T0+47 h.
2. At T0+24 h or later, any start or PIN request sweeps A's account.
3. Browser B makes 080-X at T0+25 h.
4. Browser A asks for a PIN for 080-X. `requireFreeOrOwn` passes, the PIN comes back on A's screen, and `verify-pin` signs A in to B's account.

## Not measured

- The real-Postgres suites (migrations 0040/0041 under `uf_app`, RLS, the consent triggers): there was no `TEST_DATABASE_URL` in this worktree. I read the SQL and the PGlite tests instead.
- `outline-view.tsx` (the part-by-part confirm UI) and the native module card and calculator. I read the server and the confirm schema they post to, not every screen state.
- The plan-map canvas (#130) beyond its reduced-motion path, and the pictures (#121, #133).
- The live demo's headers and environment (whether `UF_DEMO_PHONE_SIGNUP` and `UF_CATALOGUE_PREVIEW` are set there now). I read no `.env`.
- Builds, E2E, bundle budgets: the integrator's.

## Waived

None.

## Remediation roadmap

- **Quick wins (< 1 day):** A1-81 (one tolerance, one duplicate-name refine, one card line); A1-82 (one content key, one condition); A1-83 (bind the mark, cap `maxAge`); A1-85; A1-87; CI-01 (a counter).
- **Medium:** A1-84 (two sourced records and the words reading them); A1-88 (an ID-only deletion job); A1-86.
- **Structural:** none.

## What holds (checked and sound)

- **`resolveScheme`:**
  - It takes each field from the most specific level, and only for the learner's own academic year (`assessmentRulesFor`/`moduleAssessmentFor` match the year exactly).
  - No default pass mark, DP, subminimum or cap exists anywhere.
  - A disagreement between the outline and a published record is carried as a `conflict`.
  - Drafts get in only through `includeDrafts` (production refuses preview, config.ts), and each field's source carries `draft`.
  - An outline for another module or year is refused.
- **The mark maths:**
  - Weights are refused, never rescaled. All 139 schemes sum to 100 (the schema refuses otherwise).
  - "Mark needed" is rounded up and says so (D13); the exam subminimum binds and says so; best-of components count the best N; outstanding work is never assumed, and both readings are labelled.
  - Printed rounding is applied only when printed.
  - Bad marks are refused, never repaired, both by the calculator and by `checkMarkSheet` and 0041's `CHECK`s.
- **Hard rule 6:**
  - The calculator uses only marks the learner typed.
  - A document's outline reaches `resolveScheme` only through `confirmedModuleOutlineSchema` (every section confirmed or "not in my outline").
  - The extraction draft is stored on the document and never read by the card.
  - `saveCardMarks` refuses marks for the exam, for unknown components or for extra attempts.
- **Hard rule 5:**
  - 0040 and 0041 put RLS on `uf_current_student() and uf_may_process(...)`.
  - The outline consent gate (guardian v4 / adult-v3) is a trigger on both `documents` (insert, or update of kind) and `module_outlines` (from_document). That covers the owner's role too.
  - A guardian's consent stops covering a learner at 18 (A1-13 kept).
  - Every table cascades on account deletion.
- **D3:** `uf_holds_mobile_number` and personal-number checks run on every outline word except ISBNs, and on component names in 0041.
- **A4-13:** the book rules and book words run on the server (`cardBooks`, `freeBooksFor`). Only links on the allow-list are shown.
- **#133 "Open Mmereko":**
  - It is decided on the server (`app/(app)/cv/page.tsx`, `mmerekoCanvasFor`). An under-18 school learner's page never carries the button, the dialog or the frame. The CSP's `frame-src` names Mmereko only on /cv.
  - Mmereko is a public site, so this gate decides what UniversityFlow offers; Mmereko must enforce its own age rule.
  - Nothing is sent to Mmereko (no query or prefill; the sandbox has no top navigation).
- **#116 the demo phone sign-up:**
  - Only 080 numbers, and only in a demo store. The constructor refuses `demoPhoneSignup` without `demo`, and readConfig refuses the switch outside a demo.
  - A taken number is refused before a PIN is issued or checked.
  - PINs are never sent or logged.
  - Sessions end 24 h after the account was made (store.ts:1144-1148), even if the lazy sweep hasn't run yet.
  - The 100/hour per-address limit applies only on that store.
  - The demo-only consent string `adult-v3-draft-demo-only` parses as 3 in `uf_wording_version` (documented in hackathon-undo-pr.md I). `/api/me/adult-consent` pins the live version, so no learner can send it.
- **Guards:** `pnpm check` passes all 11. I found no `packages/*` → `apps/*` import, no DOM in the shared packages, and no import of the native content barrel. `admissions/client` exports types only from the catalogue.
