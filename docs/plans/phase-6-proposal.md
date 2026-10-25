# Phase 6 — Stage 6: Semester setup (proposal)

*Proposed 2026-10-23 by a planning agent, for the owner's approval. **Nothing here is built, and
planning.md is not edited, until the owner approves it**; on approval this text moves into
planning.md §11 as "Phase 6" (plan v0.10) with the owner's answers to D1–D14 recorded, as Phase 5's
were. Live by **February 2028**, when the first cohort starts its first semester. Built against
stand-ins and **draft** records (D8, hard rule 3); the owner verifies the data before it reaches
learners.*

> **Brought to `main` on 2026-10-24, unchanged apart from this note.** Its migration numbers
> (0031–0033) were taken by later work: main ends at 0038 and 0039 is reserved for A10-58. Renumber
> from the next free number when the owner approves the plan and the build starts.

Sources read for this plan: planning.md §0, §3 Stage 6, §4.2, §4.4, §5, §8.1–8.3, §11 (Phases 4, 5,
5e), §12, §16, §19; status.md (top, Phase board, Phase 5's build notes, gotchas 36, 40, 42, 44);
`packages/catalogue` (`curriculum.ts`, `campus.ts`, `provenance.ts`, `records.ts`), `packages/admissions`
(`marks.ts`, `registration.ts`), `packages/documents` (`registration.ts`, `document-types.ts`),
`packages/db` migration 0021 (the consent gate for university documents), `packages/agent/src/modules.ts`.
The rule sources named per university in "Data" below were **found by web search on 2026-10-23 and
not read**; every rule quoted there is a search snippet, **unverified**, and is there only to show
the shape the code must handle.

---

## What a learner gets

They have registered and confirmed their modules (Phase 5c, My modules). Now each module gets a
**module card**: how the marks work in plain words (year mark against exam, what **DP** means for
this module and whether they're on track for it, the **exam subminimum**, when a **supplementary
exam** is possible and what it caps the mark at), the dates that matter (tests, assignments, the
exam period, supplementary registration), the **books** (prescribed ones from their module outline,
and **legitimately free** ones beside them: OpenStax, the university's own open repository, the
library), and **who teaches it and when they see students**, where that is published or the learner
uploaded it. A **mark calculator** answers the question every first-year asks: *"to pass I need X
in the exam; to reach my 60% target, Y"*, and says honestly when a target can't be reached any more
and what happens next (a supplementary exam, if the rules allow it).

Everything on the card says where it came from: *"From UCT's 2027 Commerce handbook"* (a catalogue
record, verified by a person) or *"From your module outline, confirmed by you on 3 Feb"* (the
learner's own document, Tier B). Where nothing is published, it says so and names who to ask,
never a default (gotcha 40).

## Already in place (Phases 0–5)

- **Confirmed registrations** (`packages/db`, migration 0020) and **My modules** on web, app and
  chat (`agent/src/modules.ts`, `ui` `my-modules`): the list of the learner's modules for the year.
  The module card hangs off each row.
- **Curriculum records** with module codes, names, terms and credits for the drafted programmes
  (Wits 12, TUT 15, UKZN 11–12, UCT 7; **UJ and UP have none**: Cloudflare blocked research), and
  `normaliseModuleCode`.
- **Document upload with confirm-before-use** (`documents`: extract → draft with warnings → the
  learner confirms row by row → a strict confirmed schema; the student number never stored), and
  the **database consent gate for documents sent whole to the AI provider** (0021,
  `uf_may_process_university_documents`).
- **Faculty office** records (who to see about a refused DP or a supplementary exam) and
  **registration calendars** (`campus.ts`).
- **The reminder pipeline** (consent, cadence, quiet hours, papers; `messaging`, `jobs`) and push.
- **Pure, React-Native-safe calculators** in `admissions`; artifacts on web, app and chat (`ui`);
  provenance labels for learner data (§19, H0); the verification kit (docs/verification/).
- `documentType` already lists `marked-test` (Phase 7); it gains `module-outline` here.

## Where the code goes

No new package. **Assessment maths goes in `packages/admissions`** (`assessment.ts`, `mark-needed.ts`),
exactly as §16.2 assigns it ("mark maths (DP, subminimum, weighting)"): pure, no I/O, already depends
on `catalogue`, React-Native-safe (hard rule 11), so the app's calculator works offline.

- **`packages/catalogue`**: new sourced record types: `assessmentRules` (a university's or a
  faculty's general rules), `moduleAssessment` (a module's published scheme, where a handbook prints
  one), `academicCalendar` additions (exam periods, supplementary period and registration, optional),
  `openBook`, `bookMatch` and `libraryCatalogue` (free books), plus link builders (library search).
- **`packages/documents`**: the `module-outline` extraction schema, draft and confirmed schemas.
- **`packages/db`**: confirmed outlines, the learner's own component marks, and the consent check.
- **`packages/agent`**: tools `module_card`, `mark_needed`, `free_books` (code's verdict, the AI explains).
- **`packages/ui`**: `module-card` and `mark-calculator` artifacts and their pure view models.
- **`packages/content`**: a new section file `src/en/semester.ts` (appended, never reordered).
- **Migrations 0031–0033**, reserved before work starts (gotcha 36; 0029 and 0030 are this session's).
  If other plans approved in the meantime reserve numbers, these renumber at merge, in merge order.

---

## The rule model: how marks work, as tested code

The hard part of Stage 6 is that **the rules live at three levels and no level prints all of them**:

| Level | Typical source | Typically says | Tier |
|---|---|---|---|
| **University** | General rules (Wits Standing Orders on Assessment; UCT Handbook 3, General Rules and Policies; UKZN General Academic Rules, printed in each college handbook; UP General Academic Regulations; UJ Academic Regulations; TUT Students' Rules and Regulations, the assessment chapter) | Pass mark, who may write a supplementary, what a supplementary is capped at, deferred exams, DP refusal and appeal | A |
| **Faculty** | Faculty rules or standing orders in the faculty handbook / yearbook | Overrides: a higher subminimum, no supplementaries in some programmes, rounding | A |
| **Module** | The module outline or study guide (usually only on the LMS); some handbooks print per-course DP and assessment (UCT's faculty handbooks do; UKZN's often do) | Components and weights, the DP requirement, component subminima, best-n-of-m tests, dates, books, lecturers | A where printed, otherwise **B** (the learner's upload) |

**So the code resolves a scheme field by field, with provenance, and never invents a missing field.**

### Records (catalogue, sourced, drafts until a person verifies)

`assessmentRules` (scope: a university, or a university + faculty, as `Programme.faculty` spells it):

- `passMark` (percent) · `examAdmission` (the DP rule: a numeric year-mark minimum *and/or* the
  conditions **quoted**, e.g. attendance, submitting all assignments) · `examSubminimum` (percent) ·
  `supplementary`: `eligibleFinalMark` (a range, e.g. "40–49"), `alsoWhen` (e.g. "pass mark reached but
  exam subminimum missed", quoted), `result` (`capped-at` *n* · `replaces-exam` · `stands-alone`), and
  `notWhen` (e.g. "continuous assessment with no final exam", quoted) · `deferredExam` (quoted) ·
  `rounding` (only when printed) · `distinction` (only when printed) · `quote` and `page` per field.
- **Every field is optional (gotcha 40).** A university that prints no supplementary cap has none
  recorded, and the card says "the cap isn't published: ask the faculty office". There is no
  default pass mark of 50 anywhere in code, content or prompts (hard rule 2): a test proves that a
  scheme without `passMark` produces "not published", never 50.
- Source rule: on the university's own domain (`isUniversitySource`), as for every university record.

`moduleAssessment` (a module code + university + academic year), only where the university itself
publishes the module's scheme: `components` (name, kind: test / assignment / practical / tutorial /
exam / project, `weight`, optional `subminimum`, optional `bestOf: { count, of }`), `yearMarkWeight`
and `examWeight` when printed that way, `dpRequirement` (numeric and/or quoted), `examPapers`, `quote`.
Refinements: weights sum to 100 (or are refused, never rescaled), `bestOf` counts fit, the exam
components exist when an exam weight is printed.

`academicCalendar` additions (optional, sourced): semester dates, exam periods, supplementary exam
period and its registration deadline, the DP list publication date where printed (§8.6 lists DP
and supplementary registration among the deadlines students commonly miss).

### Resolution and the calculator (`admissions`, pure)

1. **`resolveScheme(module, programme, sources)`**: for each field, the most specific source that
   has it, for **the learner's own academic year only** (as `curriculumFor` does): the learner's
   confirmed outline → a published `moduleAssessment` → faculty `assessmentRules` → university
   `assessmentRules`. Each resolved field carries its provenance; an unverified record's field
   carries the preview flag (A10-13) and never reaches a learner outside preview.
   **Disagreements are surfaced, not settled** (D2): when the learner's outline and a published
   record disagree on a field, the result carries both and a `conflict` the card shows.
2. **`yearMark(scheme, marks)`**: the weighted year mark from the learner's confirmed component
   marks, with best-n-of-m and component subminima applied; components not yet written are reported
   as outstanding, never assumed.
3. **`dpStatus(scheme, marks)`**: `met` · `on-track` · `at-risk` · `not-met` · `unknown`, from the
   numeric part only; the quoted conditions (attendance, submissions) are shown as the learner's own
   checklist, never judged by code or AI.
4. **`markNeeded(scheme, marks, target)`**: the exam mark (or average over everything still to
   write) for `target` ∈ {the pass mark, the learner's own target}; `max` with the exam subminimum;
   `impossible` when above 100; `already-secured` when the target is reached whatever the exam;
   `unknown` when a needed rule is missing. Two readings when components are still outstanding:
   "if your remaining tests go like your average so far" and "if you score nothing more before the
   exam", both labelled.
5. **`supplementaryOutlook(scheme, final)`**: whether a final mark in that range may lead to a
   supplementary under the resolved rules, and what the result can be (`capped-at`, etc.), or
   `unknown`. Always worded as "the rules say you may qualify; the faculty decides", never a promise
   (§8.5).
6. **Presentation rule (D13):** a needed mark is shown rounded **up** to the next whole percent,
   labelled as such; a university's own rounding is applied only when its rule is printed.

Inputs follow `validateMarks`' discipline: whole or decimal percentages 0–100, or a raw score and
its total converted in code; bad input refused, never repaired. **Every mark used was typed or
confirmed by the learner** (hard rule 6).

---

## Data, per university, and the verification path

**The data is the long pole again.** The 2028 rules and module schemes appear in late 2027. As in
Phase 5, research agents draft from the **current** rule books (2026 or 2027, labelled with that
year), the 2028 books are re-researched when they appear (handbooks: November 2027 to January 2028),
and a person verifies before February 2028. Nothing is invented; a university with no readable
rules gets cards built from the learner's own outline only, and says so.

| University | General rules (search, 2026-10-23, not read) | Module schemes | Access and path |
|---|---|---|---|
| **Wits** | Standing Orders on Assessment and faculty standing orders; wits.ac.za/exams/supplementary-exams/ says a supplementary is granted "where the rules for the qualification permit it and in terms of conditions set out in Faculty Standing Orders" and the result "may only be recorded as a pass … or a fail" (snippet) | Course outlines mostly on the LMS: learner uploads | Readable by agents (Phase 5's curricula came from wits.ac.za). Draft → owner verifies |
| **UCT** | **Handbook 3, General Rules and Policies, 2026** (degree.uct.ac.za/…/2026-handbook-3.pdf); faculty handbooks 6a–9a already cited by the curricula | **Faculty handbooks print per-course DP requirements and assessment**: drafted as `moduleAssessment` for the 7 drafted curricula's first-year courses | Readable (the PDF fetch timed out once today: retry, or a person downloads it). Draft → verify |
| **UKZN** | **General Academic Rules**, printed in each 2026 college handbook (the Health Sciences 2026 handbook lists them from p. 30); the college handbooks already cited by the curricula | Module descriptions in the handbooks often print DP and assessment: drafted where printed | Readable (saa.ukzn.ac.za, college sites). Draft → verify |
| **TUT** | **Students' Rules and Regulations, the assessment chapter** (a 2024 "Chapter 4" PDF on tut.ac.za is now 404: find the current one); tut.ac.za/about-exams; TUT speaks of a **predicate mark** for exam admission | Study guides not public: learner uploads | Readable in Phase 5. The term "predicate" goes into the content as TUT's own word |
| **UP** | General Academic Regulations and faculty yearbook rules. Snippets (unverified) show the shape: a 40% semester/year-mark subminimum for exam admission, a 40% exam subminimum, a supplementary for a final mark of 40–49%, capped at 50%, and no supplementary for continuous assessment without a final exam, **varying by faculty and year** | Yearbook module pages: a person in a browser | **up.ac.za refuses automated access** (Cloudflare 403). A person reads the yearbook, as for UJ in 5e-2 |
| **UJ** | Academic Regulations | Learning guides on the LMS: learner uploads | **uj.ac.za refuses automated fetchers**; a real browser reads it (5e-2). A person reads and records |

**Verification load (hard rule 3):** each `assessmentRules`, `moduleAssessment`, calendar addition,
`openBook`, `bookMatch` and `libraryCatalogue` record joins the verification kit
(`pnpm verification:checklists`), with its quote and page for a fast check. **Agents never add
`verifiedOn`/`verifiedBy`.** A13 samples them against the sources.

---

## Code decides, the AI explains (§4.2)

| Code (tested) | AI |
|---|---|
| Resolving the scheme, provenance per field, conflicts | Explaining DP, subminimum, supplementary in plain words, from the resolved values |
| Year mark, DP status, mark needed, supplementary outlook | Encouraging, and turning "I need 64%" into the next step (Phase 7 builds the plan) |
| Which free books match (exact ISBN/title match; a person's curated `bookMatch`) | Saying why a free book may help, and to check with the lecturer |
| Library search links, OER links (allow-listed hosts only) | Nothing: the AI never writes a URL or names a book that isn't in the tool's result |
| Dates (calendar records, the confirmed outline) and reminders | Reminding, in the charter's voice |
| Reading an outline into a draft (structured output); converting "Semester 1" and "40%" in code | Nothing it reads is used until the learner confirms it (hard rule 6) |

New charter lines (A10): the agent **never computes a mark itself** (it calls `mark_needed`);
**never links or suggests pirated copies** (no LibGen, Z-Library, "free PDF" sites; it offers the
legitimate free options instead); never says "you'll pass" or "you won't get DP"; when the tool
says `unknown`, it says the rule isn't published and who to ask (the faculty office record, the
lecturer from the card).

---

## Work, in sub-phases

| Sub-phase | Delivers | Hard rules it leans on |
|---|---|---|
| **6a** How marks work | The `assessmentRules`, `moduleAssessment` and `academicCalendar` records and their refinements (every field optional; weights sum to 100 or refused; dates in the academic year; own-domain sources). **Drafts** for all six universities' general rules where readable (Wits, UCT, UKZN, TUT by research agents; UP and UJ marked "needs a person in a browser") and UCT's and UKZN's per-course schemes for the drafted first-year curricula. `admissions/assessment.ts` and `mark-needed.ts`: `resolveScheme`, `yearMark`, `dpStatus`, `markNeeded`, `supplementaryOutlook`, pure and exhaustively tested. Verification checklists gain the new records | 2, 3, 11 |
| **6b** The learner's module outline | `module-outline` document type and extraction schema: module code and name, the assessment components with weights as printed, the DP requirement (number and the words, quoted), subminima, supplementary notes as quoted, the dates, prescribed and recommended books (title, authors, edition, ISBN as printed), lecturers and consultation times (work contacts only, D3). **Draft → confirmed field by field** (components, then dates, then books, then people; "not in my outline" is a valid answer for each), refusing weights that don't add up rather than repairing them. Confirmed outlines stored per learner, module and year (**migration 0031**), RLS and the consent gate in the database like 0021 (the consent wording names module outlines, D9); export and deletion include them; the file follows the retention rule (D10). No student number, no other students' names (a class list printed in an outline is dropped by the schema) | 4, 5, 6 |
| **6c** Module cards and the calculator | The **module card** (`ui` artifact and view model) per confirmed module: How marks work (resolved scheme in plain words, each value with its source label and date; conflicts shown), Dates (calendar + outline), Books (6d), Who teaches it (outline or a published page; "not published" otherwise, plus the faculty office). The **mark calculator**: the learner types or confirms component marks (**migration 0032**, the learner's own marks, per component; Phase 7 later fills these from marked tests), sets a target, and sees year mark, DP status, mark needed for the pass mark and the target, the supplementary outlook. **Web:** `/modules` rows open `/modules/[registrationId]/[code]`; the calculator is a small client component that receives its copy as props and runs `admissions` in the browser (no round trip, no JS on the first screen beyond it). **App:** `module/[code].tsx`, the same view model, the calculator offline. Home journey gains the Stage 6 step ("Set up your semester") after My modules | 2, 6, 8, 9, 11 |
| **6d** Free books | `openBook` records (title, authors, edition, licence from an enum of open licences, URL, subject area, level), `bookMatch` records (a module or a subject area ↔ an open book, with `kind`: `is-the-prescribed-book` or `covers-similar-ground`, a person's note, drafts until verified), and `libraryCatalogue` records per university (the library's own search URL pattern, sourced). **Hosts are allow-listed** (D5): OpenStax, the six universities' own open repositories (e.g. OpenUCT), Siyavula for first-year bridging maths and science; a URL on any other host fails validation, and a deny-list test proves known piracy hosts can never pass. Code matches an outline's prescribed book to an open book **only by exact ISBN or normalised title + edition**; otherwise it shows the curated `covers-similar-ground` matches, labelled "Not your prescribed book: check with your lecturer". "Search the library" builds a link with the ISBN or title and claims nothing about availability (D7). Nothing is hosted or downloaded by us (§8.3) | 2, 3, 8 |
| **6e** In chat, in the app, reminders | Agent tools `module_card`, `mark_needed` (§4.4 already names it), `free_books`; each returns code's output with the preview flag for drafts; the AI explains. Charter lines above; **eval cases** (pirated-PDF requests refused with legal options; "how much do I need?" always through the tool; `unknown` answered honestly) and **red-team additions** for this stage's hard moments: DP refused, "I need 94% in the exam", a failed supplementary, "what's the point" (care first, then the faculty office and counselling; still 100%). **Reminders** (push and in-app, D8) for outline dates, the DP list, the exam period and supplementary registration, through the 4a pipeline (consent, cadence, quiet hours, papers): **migration 0033** if the reminder kinds need a new value. App screens for the outline upload by camera or PDF | 2, 4, 7, 9, 11 |

Order: 6a first (everything reads it), then 6b and 6d in parallel, then 6c, then 6e. One PR per
sub-phase, CI-gated (or the stacked-branch method while Actions has no minutes, gotcha 41).

---

## Decisions the owner makes (each with a recommendation)

1. **D1 Data scope.** General rules for all six universities, and published per-module schemes only
   where a handbook prints them (UCT, UKZN), for the first-year modules of the drafted curricula; or
   also research module pages at Wits/TUT. **Recommended:** the former; everything else comes from
   the learner's outline. UP and UJ by a person in a browser.
2. **D2 When the learner's outline and a published record disagree.** Use the outline (the
   learner's own year's document) for the calculation and show the published value beside it with
   "these disagree: ask your lecturer", or refuse to calculate until settled. **Recommended:** the
   former, never silently.
3. **D3 Lecturer details.** Store only what the outline or the university's page prints as a **work**
   contact (name, office, work email, office phone, consultation hours), private to the learner; drop
   personal mobile numbers. **Recommended:** yes. (Lecturers' details are their personal
   information under POPIA: minimum, purpose-bound, A11.)
4. **D4 Sharing one learner's confirmed outline with classmates** (crowd-sourced module data).
   **Recommended: not in v1.** The outline is the university's copyright, the consent was the
   learner's for their own use, and one learner's confirmation isn't verification. Revisit with a
   partner university (Tier C, gate H1).
5. **D5 The OER allow-list.** **Recommended:** start with OpenStax, the six universities' own open
   repositories and Siyavula (bridging); each further host only by the owner's decision, with its
   licence checked. Never a "free PDF" site.
6. **D6 Free books that aren't the prescribed book.** Show curated "covers similar ground" matches,
   clearly labelled, or show free books only when the prescribed book itself is open.
   **Recommended:** both kinds, labelled, curated by a person per subject area, drafts until verified.
7. **D7 Libraries.** Link out to each library's own search with the ISBN or title, claiming nothing,
   or integrate a library API. **Recommended:** link out (no API, no new origin, no account).
8. **D8 Reminders for assessment dates, the DP list and supplementary registration.**
   **Recommended:** push and in-app only (free; Meta may class study reminders as marketing), within
   the existing cadence caps; SMS/WhatsApp only if the owner later decides supplementary
   registration is worth a utility message.
9. **D9 Consent wording.** A module outline goes whole to the AI provider outside South Africa and
   names third parties (lecturers). **Recommended:** add module outlines to the pending consent v4 /
   adult v3 (not yet issued, awaiting legal review for the photo and plan-map words) rather than
   issuing a v5; the database refuses outline uploads below that version, as 0021 does for letters.
10. **D10 Retention.** **Recommended:** the outline file is deleted once confirmed (as for reports);
    the confirmed fields and the learner's marks are kept until the learner deletes them or for the
    academic year plus one (Stage 8's continuity needs last year's modules), under A11-04's schedule.
11. **D11 Hand-entered marks now.** Let learners type their test and assignment marks in Phase 6 (the
    calculator needs them), with Phase 7 adding marked-test reading. **Recommended:** yes.
12. **D12 Audits for Phase 6.** The Phase board lists A1 A3–A8; this phase also adds AI tools, a new
    document type, third-party personal data and many records. **Recommended:** A1–A8, plus **A10**,
    **A11** and **A13** (as Phase 5 ran them), A12 only if D8 adds SMS/WhatsApp.
13. **D13 Rounding.** **Recommended:** show the needed mark rounded up to a whole percent, labelled,
    and apply a university's own rounding only where printed.
14. **D14 Where the maths lives.** `packages/admissions` (§16.2, no new package) or a new
    `packages/academics`. **Recommended:** `admissions`, as planned; a rename can come with Phase 7's
    `planner` if the owner wants the split.

## Definition of done

Every sub-phase's tests pass; `pnpm verify` and CI green; the red team stays at 100%; **no mark,
pass mark, subminimum or cap is shown that code didn't resolve from a sourced record or the learner's
confirmed outline**, and nothing unverified outside preview; **a missing rule is always "not
published", never a default** (tested); every outline field is confirmed before use; every book link
is on an allow-listed host; the audits in D12 have run with no open Critical or High; the owner has
verified the general rules of the six universities (or marked a university "outline only") and the
module schemes for the modules learners have registered for; status.md says so.

## Tests

- **Assessment maths (`admissions`):** property tests over generated schemes and marks:
  `final(markNeeded(target)) ≥ target` and one percent less falls short (unless the subminimum binds);
  monotonic in target and in marks; `impossible` exactly when above 100; best-n-of-m drops the
  lowest; a component subminimum blocks a pass whatever the total; weights not summing to 100 are
  refused. **Worked examples per university** from each verified source (and from the snippets'
  shape until then: a 45% final under a "40–49, capped at 50" rule). Gotcha-40 tests: a scheme
  without a pass mark, cap or DP number yields `unknown`, never 50/40.
- **Resolution:** the most specific source wins per field; the learner's year only; conflicts carried;
  a draft's field carries the preview flag; a verified record from another year is never used.
- **Records:** every new record validates, sources from the university's own domain (OER: an
  allow-listed host), stays a draft until verified, and the view hides drafts; the piracy deny-list
  test; the verification checklists include the new records.
- **Documents:** the outline schema on synthetic outlines (several layouts, a blurred one, one with a
  class list and a personal mobile number, both dropped); confirm-before-use field by field; weights
  that don't add up flagged; terms and percentages converted in code (`termFromPrinted`'s pattern).
- **Data layer:** RLS and the consent gate (below the D9 version the database refuses, adults and
  minors); export and deletion include outlines and marks; no student number stored; IDs only in jobs.
- **Messaging:** the new reminders under 4a's property tests (cap, quiet hours, papers, STOP);
  deleting a module drops its reminders.
- **Agent:** tool outputs only from code; eval cases (piracy, maths through the tool, `unknown`);
  red-team additions, still 100%.
- **UI:** view-model tests in `ui`; web component tests (the calculator's live result announced to
  screen readers; keyboard only); app Jest + RNTL (awaited) for the card, the calculator, the upload.
- **E2E (production build, axe):** a learner with a confirmed registration uploads a synthetic
  module outline, confirms its components, sees the card with sourced rules, types two test marks,
  sets 60%, and reads the exam mark needed, the DP status and a labelled free book.

## Audits

A1 (whole phase) · A2–A3 (new screens) · A4 (web chunk budgets; **the native bundle budget already
fails, A4-18**: new screens must fit or the owner re-baselines) · A5 (outline upload, new API routes) ·
A6 · A7 (app screens) · A8 · **A10** (new tools, charter lines, piracy, red-team additions) · **A11**
(a new document type, lecturers' details, marks, retention, export) · **A13** (a sample of rules,
module schemes, calendars and book records against their sources).

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **A wrong DP, subminimum or cap shown** | Critical: a learner skips an exam they could write, or under-prepares | Sourced, verified records; optional fields; "the faculty decides" wording; worked examples per university; A13 |
| **Rules vary by faculty, module and year** | High | Three-level resolution with provenance; the learner's year only; re-research each November |
| **UP and UJ unreadable by agents** | High: two of six universities | A person in a browser (as 5e-2); until then outline-only cards, said plainly |
| **DP conditions aren't numbers** (attendance, submissions) | Medium | Quoted as the learner's checklist; code judges only numbers |
| **Pirated books slip in** | High: legal and reputational (§8.3) | Host allow-list, deny-list test, AI never writes URLs, eval cases |
| **Lecturers' personal data** | Medium (POPIA) | Work contacts only, private to the learner, D3, A11 |
| **AI cost of reading long study guides** | Medium | A page cap per outline (the existing image/PDF limits), the assessment pages first; cost per student tracked (D5) |
| **Native bundle already over budget (A4-18)** | Medium | Screens share view models from `ui`; owner's re-baseline decision first |
| **Phase 5 not closed** (on `phase-5/grade-10`, waiting for Actions minutes; curricula unverified) | High for the schedule | Build only after the one PR to `main` merges; Phase 6 needs Phase 5's registrations, not their verification |

## What it needs from Phase 5

- The **one PR to `main`** (supersedes #73, #77–#79) merged, so Phase 6 branches from a `main` that
  has registrations (0020), My modules, the consent gate (0021) and migrations to 0030.
- **Confirmed registrations** as the learner's module list, and curriculum module names and codes.
- **Faculty office records** for "who to ask" (verified for the six universities' first faculties).
- **Registration calendars** (6a extends the same record family with exam and supplementary dates).
- The **consent v4 / adult v3** work (D9), if it's still open when 6b starts.
- Gotcha 40's discipline in research briefs: optional fields, "not published", review research diffs
  for values that read like defaults (50%, 40%).

---

## Plan-drift flags (for the owner)

1. **Timing.** planning.md §11 says each phase is planned "at the start of that phase". Phase 6 is due
   February 2028 and Phase 5 hasn't closed (its PR to `main` waits for Actions minutes; its data isn't
   verified). Planning now is harmless; **building now would run ahead of the working cycle**.
   *Plan-keeping option:* approve the plan now, start 6a after Phase 5's PR merges.
2. **Audit schedule.** docs/audits/README.md and the Phase board give Phase 6 A1 A3–A8. This plan
   recommends adding A2, A10, A11 and A13 (D12). That is the owner's change to make, not an agent's.
3. **Hard rule 2 and Tier B rules.** Hard rule 2 says admission facts come only from `catalogue` and
   `admissions`. Assessment rules read from a learner's outline are Tier B facts that **never enter
   the catalogue**: they are stored in `db`, confirmed by the learner (hard rule 6), labelled "from
   your outline", and resolved by `admissions` code. This keeps the rule's intent (code decides, no
   facts in prompts or components); the owner should confirm that reading.
4. **No default pass mark.** Stage 6's example ("to pass with 50% you need X") must not become a
   literal 50 anywhere: the pass mark is a sourced field. Any brief that says "assume 50%" is drift
   (hard rule 2, gotcha 40).
5. **Consent.** Module outlines are a new document sent whole to the AI provider, with third parties'
   details in them: a consent-wording change (D9) and a legal review, not a code-only change.
6. **Crowd-sourcing outlines** (D4) would be a new processing purpose and a copyright question;
   recommended against for v1, and it would touch D3 if it ever used university systems.
