# Phase 7 — Stage 7a: the study coach (proposal)

> **Status: a proposal for the owner, not approved.** Written 2026-10-23 by a planning agent on
> branch `phase-6/plan-phase7`, in the shape of Phase 5's plan (planning.md §11). Nothing in
> planning.md is changed by it; once approved, the integrator copies the approved form into §11
> and bumps the plan version. Every decision (§9; D1–D18 are this proposal's own, not planning.md §0's locked ones) carries a recommended answer; the plan-keeping
> option is named wherever one exists. Plan-drift flags are in §0.

*Live by **March 2028**, when the first cohort writes its first university tests (planning.md
§11). Built after Phase 6, against stand-ins (locked decision D8): the sample test reader, the fake AI, local
Postgres and S3. The owner connects the real AI key (needed early, §10 R1) and consent v4 at
the end.*

---

## 0. Plan-drift flags (read these before saying yes)

| # | What | Why it is drift | Plan-keeping option | Recommended |
|---|---|---|---|---|
| F1 | **Consent v4 / adult-v3 must name marked tests and past papers** | A marked test goes whole to the AI provider abroad with the learner's name and student number on it, exactly the case audit A11-13 fixed for letters and proofs (migration 0021). Guardian v3 and adult-v2 name only reports, letters and proofs (`packages/content/src/en/consent.ts`) | Join the **one v4 bump** already queued for the profile photo and plan-map words, legal review with A11-10. Uploads wait for it; typed-in marks don't (D2) | Plan-keeping |
| F2 | **"A calendar you can drag"** (§3 Stage 7 artifacts) | WCAG 2.2 SC 2.5.7 (Dragging Movements, AA, hard rule 9) requires a single-pointer alternative; drag alone would fail A3 | A **Move** button with a day-and-time picker on every session (web and app); drag added on top on the web only | Plan-keeping + D16 |
| F3 | **"Keeps the total study time the target mark needs"** (§3 Stage 7) | No validated model maps a target mark to hours of study. Claiming one would break the charter's honesty (§4.1.2, §8.5) | A **labelled, tunable heuristic** (marks at stake → minutes, §4.3), shown as "a starting estimate, change it", never "this will get you 60%" | Plan-keeping |
| F4 | **`packages/planner` was never scaffolded** | §16.2 lists it and §16.5 said every package would exist with one passing test. The rule-11 guard (`scripts/checks/no-dom-in-shared-packages.mjs`, `SHARED_PACKAGES`) does not list it | The first commit of 7a-3 creates the package **and adds `planner` to the guard**, proven on a broken example (`pnpm check:test`) | Plan-keeping |
| F5 | **Audits owed for Phase 7** on the phase board say only **A1 A10** | Phase 7 adds a new document kind, new screens, a calendar, an offline cache of personal data and new routes; A2, A3, A4, A5, A7, A11 apply too | Owe the fuller list in §8 (stronger, not weaker; needs the owner's yes to change the board) | Fuller list |
| F6 | **The "light week" signal is new** | It is not in planning.md: the portfolio proposal (a sibling agent, Stage 8 / Phase 9) asked for it. It couples Phase 9 to Phase 7 | Defined here as a **pure output of the planner** with a contract test; Phase 9 consumes it and may not widen it without a planner change (§5) | Plan-keeping |
| F7 | **Personal data cached on the phone** | Phase 5's only offline cache (`apps/native/lib/campus-cache.ts`) holds public records only. Offline re-planning (§3 Stage 7, "so the app can re-plan offline") needs the learner's plan on the device | Cache only the planner's inputs and sessions, **no question-level marks**, outside backups, cleared at sign-out (D12); A7 and A11 review | Plan-keeping |
| F8 | **School learners (Grade 10–12) are not served at launch** | The planner could help matric exam prep (Stage 3), but §18.2 principle 4 routes school study to the studios, and Stage 7 is university-only in §3 | University students only (a confirmed registration, Phase 5c), D1; matric later as its own decision | Plan-keeping |
| F9 | **The learner's busy-time words go to the AI** | Planning §3 says the AI turns them into constraints, so this *is* the plan. It differs from plan maps (D4 there: words never sent to the AI). Flagged so nobody reads the two as one rule | The words are handled as chat (covered by v3's "chats about their goals and studies"), crisis-checked first, **never stored**; only the confirmed constraint is kept (D11) | Plan-keeping |

No locked decision (planning.md §0 D1–D8) changes. Locked D8 (stand-ins first) holds, with one strong
recommendation: the reading of handwritten marks can only be proven with the real AI key (R1).

---

## 1. What a learner gets

A first-year writes a test, gets it back marked, and takes a photo of it (or a PDF from the
LMS). The companion reads each question's number, the marks it was worth and the marks they got;
the learner checks every row and fixes what's wrong. Each question is tagged with a topic **from
their own module outline** (Phase 6); the companion may suggest a tag, the learner confirms it.

Across tests, code works out where the marks went: *"You lost 14 of 20 marks on Integration by
parts across two tests, and it carries about 20% of the exam."* About two weeks before an exam,
it builds a study plan: the highest-value weak topics first, the "small mistakes" topics last so
they walk in confident, a target and a fall-back mark from the Phase 6 mark calculator ("you need
50% to pass; we'll aim for 60%, with 55% as the fall-back"), and a past paper near the end.

When they say *"I work Friday evenings and Saturday is my cousin's wedding"*, the companion turns
that into two blocked times, shows them, and once the learner says yes the planner rebuilds the
plan: re-balanced into the free time that is left, never booked into a blocked slot, and if the
time can't fit before the exam, it says so honestly and offers the fall-back plan. The app can
re-plan offline. Nothing pushes: rest days, no late nights, no streaks, no red.

---

## 2. Already in place (Phases 0–6)

- **Documents (Phases 2, 5):** upload by photo or PDF (`checkUpload`, 10 MB, magic-byte sniffing),
  camera upload in the app (4d), direct uploads with tickets, S3 in af-south-1, `readStructured`
  against a fixed schema, a sample reader per type for locked D8, drafts confirmed row by row
  (`registration.ts`'s pattern) and **`marked-test` already in `documentType`** with no schema.
- **Consent in the database:** `uf_may_process` (hard rule 5) and the per-kind consent trigger of
  migration 0021 (`uf_consent_covers_university_documents`), the model for marked tests.
- **The agent (Phases 2–5):** tools as typed functions (`packages/agent/src/tools.ts`), `learner_text`
  wrapping for the learner's own words, `assessDistress` and `assessCare` (the `exam-stress`,
  `setback` and `giving-up` care topics), the crisis card from verified lines only, the red team
  (400 cases, 100%).
- **Free-text handling (plan maps, approved 2026-10-23):** every save crisis-checked server-side
  (`apps/web/lib/server/plan-care.ts`), the card shown and focused at once, nothing about distress
  stored, words kept out of logs, payloads and fixtures, in the export, deleted with the account.
- **Messaging (Phase 4):** consent per channel, cadence, quiet hours, nothing during a paper, the
  lock-screen wording rules (`packages/messaging/src/lock-screen.ts`), push as the free channel.
- **Exam countdown and practice (Phase 4b, 4e):** the countdown artifact, `exam_countdown` and
  `practice_for` tools, sourced Siyavula links (school only).
- **Phase 6 (dependency, §11):** module cards (assessments, dates, weights), the **module outline**
  read and confirmed by the learner (its topics), and the **mark calculator** (DP, subminimum,
  weighting; `mark_needed(module, target)` in `packages/admissions`, §4.2, §4.4).
- **Property testing:** the house seeded generator (`mulberry32` in `registration.test.ts` and
  `cadence.test.ts`), with replayable seeds; no `fast-check` in the repo.

---

## 3. Where the code goes

| Package | New in Phase 7 | Runs on |
|---|---|---|
| **`packages/planner` (new)** | `mastery.ts` (v1 calculation + `MasteryModel` interface), `weights.ts` (topic exam weights and their source), `targets.ts` (target and fall-back from the calculator's output), `demand.ts` (minutes per topic), `constraints.ts` (zod schemas for blocked times and preferences), `time.ts` (local date + minute arithmetic, SAST), `scheduler.ts` (the solver), `light-week.ts` (the signal, §5), `explain.ts` (numbers for content templates, never words). **Pure, deterministic, no I/O, no clock** (`now` is an argument), **no workspace dependencies but `config`** (its inputs are plain types; adapters live in `agent` and `web`), React-Native-safe (hard rule 11) | Web server, web client, **the app** |
| `packages/documents` | `marked-test.ts` (extraction schema, `draftFromMarkedTest`, `confirmedMarkedTestSchema`), `marked-test-reader.ts` (Anthropic + `SampleMarkedTestReader`), multi-page reading (D3), `past-paper` type (D18) | Server |
| `packages/db` | Tables and store functions (§7), consent trigger for the new kinds, RLS, export, deletion | Server |
| `packages/agent` | Tools `my_tests`, `topic_map`, `build_study_plan`, `propose_busy_times`, `study_plan`, `practice_set`; charter additions (study-coach tone, integrity); the live-assessment context line (§6.2) | Server |
| `packages/ui` | Artifact types: `test-review`, `performance-map`, `study-plan`, `busy-times-confirm`, `practice-set` | Both apps |
| `packages/content` | `en/study.ts` (new section file, appended export); every string, including the explanation templates the planner's numbers fill | Both apps |
| `packages/evals` | Red-team cases (busy words with crisis, exam stress, low marks), integrity cases (§6.2), tagging and reading evals on synthetic tests | CI |
| `apps/web`, `apps/native` | Screens (§7.3); the app lists `@universityflow/planner` in its dependencies (gotcha 14, guarded) | — |

**Why a new package and not `admissions`:** the planner is study planning, not admission or mark
maths; §16.2 names it; and keeping it dependency-free lets the app bundle it alone (A4).

---

## 4. The parts, in detail

### 4.1 Reading marked tests (hard rule 6)

**Extraction schema** (structured output, as `extractedRegistrationSchema`):

```ts
extractedMarkedTestSchema = z.object({
  isMarkedTest: z.boolean(),            // false: not a marked test (or not marked yet)
  moduleCodeAsPrinted: z.string().nullable(),
  titleAsPrinted: z.string().nullable(), // "Test 2", "Class test 1"
  dateAsPrinted: z.string().nullable(),
  totalAvailableAsPrinted: z.number().nullable(),
  totalAchievedAsPrinted: z.number().nullable(),
  questions: z.array(z.object({
    label: z.string(),                  // "3", "3(b)", "Q7.2" exactly as printed
    page: z.number().nullable(),
    marksAvailable: z.number().nullable(),
    marksAchieved: z.number().nullable(), // null when the marker's figure can't be read
    suggestedTopicId: z.string().nullable(), // only from the outline list given (4.2), or null
  })),
  partlyUnreadable: z.boolean(),
});
```

- **Never returned:** name, student number, ID number, the marker's written comments, the
  question text. The schema has no place for them and the instructions forbid them (minimisation,
  §8.1; copyright, §8.3). Practice points back to "Question 3 on page 2" of the learner's own file.
- **Code checks, never the AI** (`draftFromMarkedTest`, tested): achieved ≤ available; non-negative;
  half marks allowed (0.5 steps); labels de-duplicated; sub-questions rolled up only when the
  learner chooses; the sum of question marks against the printed total (`total-mismatch` warning,
  shown, never silently "fixed"); a test with no marks at all (`not-marked-yet`: refused for
  reading, see §6.2); `partly-unreadable`, `questions-cut` (max 60 rows), `module-unknown`.
- **The draft is confirmed row by row** before anything is calculated: label, out of, got, topic.
  The learner may add, remove or fix rows, and pick the module (from their confirmed registration)
  and the assessment (from Phase 6's module card), so the test lands on the right exam.
- **Typed in by hand, no upload:** the same confirm form, empty. Works under today's consent (D2).
- **Multi-page:** one PDF, or up to 8 photos read together as one test (D3). Each page goes
  through `prepareForReading` (EXIF stripped, resized).
- **Locked D8:** `SampleMarkedTestReader` returns a plainly synthetic test (module `TEST101`, topics
  "Sample topic A/B/C"), labelled as a sample and refused in production, as the other readers.

### 4.2 Topic tagging: where topics come from

**Topics are never invented.** The only topic list is the learner's **confirmed module outline**
from Phase 6 (its topic rows, each with an id). Precedence:

1. **The outline's topics** (Phase 6, confirmed by the learner). This is Tier B data: the
   learner's own document, not a catalogue fact, so hard rule 3 doesn't apply, but it carries
   provenance ("From your module outline, confirmed 3 Feb 2028", §19 H0).
2. **No outline yet:** tagging is offered only after the learner adds one (a link to Phase 6's
   outline upload). Marks still count in the test total; topic analysis waits.
3. **A question the outline doesn't cover:** tagged **"Not on my outline"**. It is shown with
   the marks lost there and a link to fix the outline in Phase 6's confirm form; it is never
   ranked by exam weight (D5).

**When the AI may suggest a tag:** during reading, the reader is given the outline's topic ids and
names (not the learner's marks) and may return `suggestedTopicId` from that list or null.
Code drops any id not in the list. In the confirm form a suggested tag shows as **"Suggested"**
beside a picker of the outline's topics; the learner confirms or changes each (or taps "These
are right" with every row visible, the Phase 5c pattern). **An unconfirmed tag never counts in
mastery** (enforced in `planner`: evidence carries `tagConfirmed: true` or is refused). A
question may carry one topic in v1; split-topic questions are a later decision.

### 4.3 Topic mastery v1: an explainable, tested calculation

For a module and its upcoming exam, over the learner's **confirmed** tests and **confirmed** tags:

| Symbol | Meaning |
|---|---|
| `A_t`, `S_t` | marks available and achieved on questions tagged topic `t`, summed over tests |
| `ℓ_t = (A_t − S_t) / A_t` | share of marks lost on `t` (defined only when `A_t > 0`) |
| `m_t = 1 − ℓ_t` | mastery, v1 |
| `w_t` | the topic's share of the exam (Σ `w_t` = 1 over the exam's topics), with its **source** (D7): the outline when it prints weights; else the share of marks per topic across past papers the learner gave us (an estimate, labelled); else **equal shares** (labelled "your outline doesn't give topic weights") |
| `X_t = ℓ_t × w_t × 100` | **exam marks at stake** on `t`, in percentage points of the exam |

- **Bands** (D6): *needs work* `ℓ_t ≥ 0.5`; *small mistakes* `0.1 ≤ ℓ_t < 0.5`; *secure*
  `ℓ_t < 0.1`; *not enough to say* when `A_t < 10` and fewer than 2 questions; *not tested yet*
  when the outline lists `t` for the exam and no question is tagged (shown with `w_t`, planned as
  "cover", never called weak).
- **Order:** by `X_t` descending, then `ℓ_t`, then topic id (fully deterministic).
- **Explanation:** `explain.ts` returns numbers only; content templates make the words: *"You lost
  14 of 20 marks on Integration by parts across 2 tests. It carries about 20% of the exam (from
  your module outline). About 14 exam marks depend on it."* The AI quotes this; it never computes
  it (§4.2 of planning).
- **No recency weighting in v1** (every test counts the same: easiest to explain and test). A
  learner who has improved sees it in the per-test columns of the performance map.
- **No predicted exam mark is shown** (D8): tests are not the exam, and a number like "you're on
  52%" reads as a promise or a verdict. Code may use the gap internally (§4.4).

**The interface for later models:**

```ts
interface MasteryModel {
  readonly id: 'marks-lost-v1' | 'bkt-v1';
  estimate(evidence: ReadonlyArray<TopicEvidence>): ReadonlyArray<TopicEstimate>;
}
```

- **Bayesian Knowledge Tracing, later:** per topic `P(L0)`, `P(T)`, `P(G)`, `P(S)`, updated over
  the learner's questions in time order. It needs right/wrong (or a partial-credit variant) and
  parameters fitted per module across many learners; with one learner's data it reduces to
  defaults. It replaces v1 only when an eval on consented, de-identified data shows it predicts the
  next test better than v1, after an A10 and A11 round.
- **Item Response Theory:** needs every question's statistics across a whole class, so only with
  partnership data (Stage 7b, Phase 8). Same interface.

### 4.4 The study plan: target and fall-back

- **From Phase 6's calculator, never computed here:** the pass mark, the year mark so far, DP
  status, the exam subminimum, and `mark_needed(module, target)` (the exam mark needed for a final
  mark). The planner takes that output as input.
- **Target and fall-back** (D9): the learner chooses a target (default pass + 10, e.g. 60); the
  fall-back defaults to the midpoint rounded down to 5 (55); both editable. The card shows the exam
  mark each needs ("for 60% overall you need about 64% in the exam") as the calculator says.
- **Honest edges, from the calculator:** DP not met → no exam plan; it says what DP means and who
  to see (Phase 6's lecturer and faculty office). Target needs more than 100% in the exam → "that
  target can't be reached on the exam alone", and offers the highest reachable one. Subminimum
  shown when it binds.
- **Scope:** topics are taken in priority order (§4.3) until their marks at stake cover the gap
  between the target's needed exam mark and the learner's tested share (`Σ w_t m_t`), plus a
  margin; the rest are "secure" sessions. The **fall-back plan** is the same with the fall-back's
  gap: fewer topics, highest stake first. The gap stays inside code and never shows as a
  prediction.
- **Demand (minutes per topic), a labelled heuristic** (F3, D10): a base per band (needs work 90,
  not tested 60, small mistakes 45) plus `minutesPerMark × X_t`, rounded up to whole sessions, then
  two review sessions (a past paper in exam conditions when the learner has one, else mixed
  questions from their own tests). Shown as "a starting estimate; change it", with a "more / less
  time on this topic" control.
- **Horizon:** from now (default two weeks before the exam, §3 Stage 7; the learner may start
  earlier) to the exam's start (Phase 6 module card).

### 4.5 The constraint scheduler (`packages/planner/scheduler.ts`)

**Inputs** (all plain data, validated by zod; times are a local date + minutes from midnight,
South African Standard Time, UTC+2, no daylight saving; instants are stored in UTC):

- **Preferences:** study windows per weekday (default weekdays 16:00–21:00, weekends 09:00–17:00),
  daily cap (D10: 150 min weekdays, 240 weekends; max 360), session length (45, min 25), break
  ≥ 15, quiet hours (default 22:00–06:00, never booked), one rest day per 7 (on by default).
- **Blocked times:** weekly (`weekday`, start, end) or once (date range, all day or start–end),
  each **confirmed by the learner** (§4.6). No reason is stored.
- **Assessments:** every test and exam on the learner's module cards (Phase 6): nothing booked
  during one, in the 2 hours before one, or on the target exam's day.
- **Topic demand** (§4.4), in priority order and band, and **fixed sessions**: done, in the past,
  or moved by hand (pinned).

**Algorithm (deterministic, explainable):** build free slots (windows − quiet hours − blocked −
assessment buffers − fixed sessions), reserve the last two before the exam for review, then fill
chronologically: first *needs work* by stake, then *not tested yet*, then *small mistakes* ("finish
with 5 and 9, so you walk in confident"), round-robin among the top topics so no topic takes more
than two sessions in a row or two a day, with a short revisit of each needs-work topic at least
two days after its first session when the budget allows.

**Output:** `{ fits: true, sessions }` or `{ fits: false, sessions, shortfallMinutes, dropped,
fallback }`, where `dropped` lists the lowest-stake topics that didn't fit and `fallback` is the
fall-back plan. **It never shortens a session below the minimum, breaks the daily cap, the rest
day or quiet hours to make it fit.** The words, from content: *"There isn't time for everything
before 14 March. This plan covers the topics worth the most marks, built around your fall-back of
55%."* with three actions: add study time, use the fall-back plan, see who can help (Phase 6's
lecturer consultation times).

**Re-planning:** done, past and pinned sessions never move; everything after "now" is rebuilt. A
pinned session that becomes blocked is flagged for the learner, never silently deleted.
**Re-balanced, not shortened:** when the remaining capacity still covers the remaining demand, the
total booked minutes don't drop (a property, §8.1).

**Moving a session by hand:** the same rules check the new time; a blocked or quiet-hour time is
refused with a reason ("You said Friday evenings are out").

**Performance budget (A4):** a 6-week horizon with 15 topics solves in under 50 ms on a low-end
Android in the app's Jest perf check, and the package stays under 25 KB minified.

### 4.6 Busy times in the learner's words

- **Two ways in.** (a) A **picker**: day, from, to, every week or once; works offline in the app,
  no AI. (b) **Words**, in chat or in the "Tell me what's on" box on the plan page (online only).
- **Crisis check first, on the server** (as `plan-care.ts`): `assessDistress` on the words (with
  `assessWithPrevious` in chat). `crisis` → the crisis card, **nothing parsed**, coaching stops.
  `concern` → the card beside the answer. `assessCare` `exam-stress` → the care guidance, then the
  parse.
- **The AI's only job:** the tool `propose_busy_times` with a strict input schema (weekly or once,
  weekday or ISO date, start and end or all day). Today's date and the plan's horizon are given;
  **code then checks** that a date is real, in the horizon, and on the weekday the learner named
  ("Saturday" with a Sunday date is flagged, never "corrected"); vague words get visible defaults
  ("evenings" → 17:00–22:00, shown for the learner to change).
- **Confirm before use:** the `busy-times-confirm` artifact lists each proposed block in plain
  words ("Every Friday, 17:00 to 22:00"; "Saturday 11 March, all day"). Nothing is saved or
  scheduled until the learner taps **Use these**. The same principle as hard rule 6, applied to
  the AI's reading of their words (proposed as a planner rule and test, §8.1).
- **Not stored:** the words themselves (beyond the chat history chats already keep), and no
  reason column ("wedding", "work"). Only the confirmed block (D11).

---

## 5. The "light week" signal (an output of the planner, for the portfolio)

The portfolio proposal (Stage 8, Phase 9) suggests small projects in weeks with room. Phase 7
defines that room; Phase 9 only reads it.

```ts
/** packages/planner/src/light-week.ts — the whole contract. */
export interface LightWeekSignal {
  readonly weekStart: string;     // ISO date, a Monday, SAST
  readonly light: boolean;
  readonly freeMinutes: number;   // study-window minutes left after sessions, blocks and assessments
}
export function lightWeeks(input: WeekLoadInput, weeks: ReadonlyArray<string>): LightWeekSignal[];
```

- **Light** (D14) when, in that Monday–Sunday week: no assessment on any module card falls in it
  **or in the 3 days after it**; it is not inside any study plan's last 14 days before an exam;
  booked study minutes are at most 25% of the week's study-window capacity; and `freeMinutes ≥ 180`.
- **Carries nothing else:** no topics, marks, module codes or reasons. Phase 9 can't learn a
  learner's weak spots from it.
- **Computed on demand** (server and app), never stored; deterministic for the same inputs.
- **Contract test** (`light-week.contract.ts`), which the portfolio's tests import: a week with an
  exam is never light; a week before a test is never light; adding a blocked time never makes a
  week light; adding a session never makes it light; the output has exactly the three fields.
- **Wellbeing rule for consumers** (written into the contract's doc comment): a light week is
  room, not an obligation. A suggestion made from it must be skippable with no nudge.

---

## 6. Wellbeing and academic integrity

### 6.1 No pressure (charter §4.1, §4.3)

- **Defaults that protect rest** (D10): a daily cap, a rest day, no sessions in quiet hours or on
  the exam day, breaks between sessions. The learner can loosen them only within bounds.
- **No streaks, no guilt:** a missed session is moved, quietly ("Plans change. I've moved it to
  Wednesday."), never counted against them; no "behind schedule", no red. "Needs work" is the
  muted ink with an icon and a word, never the danger colour (as plan maps D7).
- **A low mark on upload:** the test review leads with "Here's where the marks went", never a
  verdict; `setback` care wording under it; the companion asks how they are before the plan
  (charter 1).
- **Never promises:** no "you will pass", no predicted mark (D8); the fall-back is framed as a
  real plan, not a failure.
- **Exam stress:** `assessCare` `exam-stress` already exists; red-team and care additions for the
  university exam season (supplementary exams, "I'll lose my bursary", "NSFAS will cut me off"
  → money-stress care and Phase 6's rules on DP and supplementaries, never invented).
- **Crisis check on every piece of free text** Phase 7 receives: the busy-times words, the chat,
  and any note field (v1 has none beyond the busy box). Distress is never stored (plan maps §5.2).
- **Reminders:** study-session nudges through the 4a pipeline (consent, cadence, quiet hours,
  nothing during a paper), **push and in-app only** (D15), lock-screen text generic ("A study
  session starts at 18:00"), never a module, mark or topic.

### 6.2 Help to study, never answers to a live assessment (§8.4)

- **Code decides what is live:** `liveAssessments(moduleCards, now)` (pure, in `planner`) returns
  any test or exam in progress today and any assignment open now. The agent's context carries a
  line "an assessment is open for MATH1001 until 17:00" (ids and times only).
- **The charter's rule:** during a live assessment the companion won't work through questions for
  that module; it explains the idea with a different example and says why ("I can't help with a
  test that's open, so this stays yours"). Assignments: explains, plans, gives feedback on the
  learner's own understanding; never writes the work.
- **Uploads:** an unmarked test (`not-marked-yet`) is refused for reading: "Upload it once it's
  been marked and handed back."
- **Past papers and the learner's own marked tests** are fair practice; worked explanations are
  labelled "worked by your companion: check with your lecturer or tutor".
- **Evals:** integrity cases in `packages/evals` ("here's question 3, my test is open now", "write
  my assignment", "solve this past paper for me" (allowed, explained), "pretend the test is
  finished") graded on refusing and redirecting; run with the red team on any agent change.

---

## 7. Data, screens, migrations

### 7.1 Migrations (assigned before work starts, gotcha 36)

Numbers: 0029 (profile photo) and 0030 (plan maps) are taken; **Phase 6's proposal takes the next
numbers first**. Phase 7 takes the three after Phase 6's last (if Phase 6 ends at 0033: 0034–0036).
Named here P7-1 to P7-3; append-only, each with up and down tests and the real-Postgres suite.

| # | Adds |
|---|---|
| **P7-1** marked tests | `marked_tests` (student, module code, Phase 6 assessment ref, document ref nullable, taken on, totals, confirmed at); `marked_test_questions` (test, label ≤ 12 chars matching a label pattern, page, available, achieved, topic ref nullable → Phase 6's outline topic, `tag_source` `learner`/`suggested-confirmed`); CHECKs (0 ≤ achieved ≤ available, half-mark steps). **Consent:** `uf_consent_covers_study_documents` (guardian v4 / adult-v3) and the documents trigger extended to refuse `marked-test` and `past-paper` uploads, and questions read from them, under older wording (as 0021); typed tests allowed under v3. RLS, `uf_may_process` gate, cascade from `students` |
| **P7-2** availability | `study_preferences` (windows, cap, session length, rest day, quiet hours), `study_blocks` (weekly or once, times, `source` `picked`/`words`, confirmed at). **No free-text column** anywhere |
| **P7-3** plans | `study_plans` (student, module, assessment, pass/target/fall-back, `fits`, shortfall, `planner_version`, inputs hash, created), `study_sessions` (plan, starts at, minutes, topic ref, kind `learn`/`revisit`/`secure`/`review`, state `planned`/`done`/`skipped`, `pinned`) |

**Export** (Download my data) includes all of it; **deletion** cascades; the job payload of a
session reminder carries the session id only (hard rule 4). The light-week signal needs no table.

### 7.2 API routes (web; the app calls the same)

`POST /api/study/tests` (upload ticket → read → draft), `PUT /api/study/tests/:id` (confirm),
`GET /api/study/modules/:code/map`, `POST /api/study/plans` (build), `PATCH
/api/study/sessions/:id` (move, done, skip), `GET|PUT /api/study/availability`, `POST
/api/study/busy-words` (crisis check → AI → proposal; nothing saved), `GET /api/study/light-weeks`
(for Phase 9). Each owner-scoped (IDOR tests, A5), rate-limited like report confirmation.

### 7.3 Screens, web and app

| Screen | Web | App |
|---|---|---|
| **Study coach** (per module: next exam, tests, plan status) | `/study` | Study tab |
| **Add a marked test**: upload or type → confirm rows → confirm tags | `/study/tests/new` | camera flow (4d) |
| **Test review** (where the marks went) | `/study/tests/[id]` | ✓ |
| **Performance map** (topics × tests) | `/study/[module]/map`: a real `<table>` with the numbers in every cell, the shade as an extra (never colour alone, 1.4.1), a list view at 360 px | list view; the grid later |
| **Study plan** (week and list views, Move, Done, Skip; drag on desktop web, D16) | `/study/[module]/plan` | ✓, **re-plans offline** |
| **My busy times** (picker + "Tell me what's on") | `/study/busy` | picker offline; words online |
| **Practice set** (redo your own questions by topic; your past papers) | in the plan | ✓ |

Every string from `en.study` (owed the owner's wording review); every value from tokens; every
motion with a reduced-motion path; focus to the crisis card when it appears.

### 7.4 Offline in the app (D12)

`apps/native/lib/study-cache.ts`, in the pattern of `campus-cache.ts`: the last good **planner
input and sessions** (topic ids and names, minutes, bands, blocks, preferences, assessment times),
**no question-level marks**, in the app's cache directory (excluded from iCloud/Google backups),
versioned, cleared by `clearToken` (sign-out, deletion, 401). Offline: the picker, Move, Done,
Skip and a full re-plan with `packages/planner`; the changes queue and sync when online. **Sync:**
each plan has a version; on a mismatch the server re-runs the planner on the merged blocks and
sessions (done and pinned kept) and the app shows the result. Words, uploads and the AI need a
connection, and say so.

---

## 8. Work, in sub-phases

Named 7a-1 to 7a-4 to avoid clashing with Stage 7a/7b.

| Sub-phase | Delivers | Hard rules it leans on |
|---|---|---|
| **7a-1** Marked tests in | The marked-test schema, draft and confirm (4.1), multi-page reading, the sample reader, typed entry, P7-1 with the consent trigger, the test review screen (web), export and deletion. **A reading spike on 10 real marked tests with the real key** (consented, owner-run, kept out of the repo, R1) | 4, 5, 6, 8 |
| **7a-2** Topics and mastery | `packages/planner` scaffolded **and added to the rule-11 guard** (F4); tags from the outline with confirmed AI suggestions (4.2); mastery v1, weights and their source, bands, explanation numbers (4.3); the performance map (web); `topic_map` and `my_tests` tools | 2, 6, 8, 9, 11 |
| **7a-3** The plan and the scheduler | Targets from the calculator (4.4), demand, the solver and re-planning (4.5), preferences and blocks (P7-2), plans and sessions (P7-3), the plan screen with Move (and drag on desktop web), busy times by picker and by words with the crisis check and the confirm card (4.6), `build_study_plan`, `propose_busy_times`, `study_plan`; the **light-week signal** and its contract (5); `liveAssessments` | 2, 4, 6, 7, 8, 9, 11 |
| **7a-4** App, reminders, care and integrity | Native screens and camera flow; the offline cache and sync (7.4); session reminders by push (4a pipeline, D15); `practice_set` and past papers (D18); charter additions (study tone, integrity); red-team and integrity evals | 4, 7, 8, 9, 11 |

---

## 9. Decisions the owner makes (recommended answer in bold)

| # | Decision | Options | Recommended |
|---|---|---|---|
| **D1** | Who gets the study coach at launch | University students with a confirmed registration · also Grade 10–12 learners for school tests | **University students only**; school learners later, as its own decision with the studios (§18.2) |
| **D2** | Consent | Treat marked tests as covered by v3's "uploaded documents" · name them in v4 / adult-v3 | **Name marked tests, past papers, study plans and busy times in the one v4 bump** (with the photo and plan maps), legal review with A11-10; uploads refused under older wording; typed tests and the picker allowed under v3 |
| **D3** | Pages per test | One file · a PDF or up to 8 photos | **A PDF, or up to 8 photos read as one test** |
| **D4** | May the AI suggest topic tags | No, the learner tags every question · yes, from the outline only | **Yes, from the outline's list only; each tag confirmed; unconfirmed tags never count** |
| **D5** | A question the outline doesn't cover | The learner names a topic · "Not on my outline" | **"Not on my outline"**, shown with its marks lost and a link to fix the outline; no learner-invented topics in v1 |
| **D6** | Bands and evidence | As 4.3 · other thresholds · recency weighting | **As 4.3** (≥ 50% lost, 10–50%, < 10%; ≥ 10 marks or 2 questions); **no recency weighting in v1** |
| **D7** | Where a topic's exam weight comes from | Outline only · outline → past papers → equal | **Outline → the learner's past papers (labelled estimate) → equal shares (labelled)** |
| **D8** | Show a predicted exam mark | Yes · no | **No**: marks at stake and the calculator's exam mark needed only |
| **D9** | Target and fall-back defaults | As 4.4 · learner must choose | **Target pass + 10, fall-back the midpoint rounded down to 5; both editable** |
| **D10** | Wellbeing defaults and the minutes heuristic | As 4.4–4.5 · other numbers | **As written**, owed the owner's review with a first-year tester group (§11 optional acceleration) |
| **D11** | Keep the busy-time words or reasons | Store them · store only the confirmed block | **Only the confirmed block; no reason column; the box online only** |
| **D12** | Offline cache of the plan | No offline re-plan · cache without marks · encrypted full cache | **Cache without question-level marks, outside backups, cleared at sign-out** |
| **D13** | Property-test tool | Add `fast-check` · the house seeded generator | **The house generator** (`mulberry32`, replayable seeds; no new dependency, A8) |
| **D14** | Light-week thresholds | As §5 · other | **As §5** (no assessment in or 3 days after, outside the 14-day pre-exam window, ≤ 25% booked, ≥ 180 free minutes) |
| **D15** | Study reminders by SMS/WhatsApp | Yes · push and in-app only | **Push and in-app only** (free; Meta may class them as marketing), as Phase 5 decision 4 |
| **D16** | Dragging sessions | Drag only · Move only · both | **Move on every platform (WCAG 2.5.7), drag added on desktop web** |
| **D17** | Integrity during live assessments | The AI judges · code says what's open | **Code (`liveAssessments` from the module cards) decides; the charter refuses and redirects** |
| **D18** | Past papers in v1 | None · the learner's own uploads, private · hosted papers | **The learner's own uploads, private, tagged the same way**; openly published university papers as sourced links later |

---

## 10. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Reading handwritten marks** (ticks, circled scores, crossed-out figures) can't be proven against the stand-in (locked D8) | Get the real AI key for 7a-1's spike; every row confirmed; unreadable → null, never a guess; typed entry always available |
| R2 | **Phase 6 lands differently** (no topic rows, no assessment refs, a calculator elsewhere) | §11's interface list is checked against Phase 6's approved plan before 7a-1; if outlines carry no topics, 7a-2 adds outline topic reading itself |
| R3 | **Outlines rarely print topic weights** | Weight source shown everywhere; equal shares labelled; past papers as a labelled estimate |
| R4 | **Consent v4 is late** for March 2028 | Typed tests and the picker work under v3, so the coach launches; uploads wait; v4 is shared with two other features already queued |
| R5 | **The heuristic is mistaken for a promise** | "A starting estimate"; no predicted mark; A10 tone review; first-year testers |
| R6 | **The AI misreads busy words** | Code checks dates and weekdays; visible defaults; nothing used until confirmed |
| R7 | **Free text hides distress** ("busy Saturday, I won't be around after the exam") | Crisis check before the parse; red-team cases for exactly this; nothing parsed on `crisis` |
| R8 | **Personal data on the phone** | No question-level marks cached, outside backups, cleared at sign-out; A7, A11 |
| R9 | **Cost per student** (multi-page images to `claude-opus-5`) | Pages resized; one read per test; cost per student tracked (locked D5); a cheaper model for reading only on measured eval quality |
| R10 | **Copyright of tests and papers** | No question text stored; files private to the learner (§8.3); no hosting or sharing |
| R11 | **The light-week contract is widened** by Phase 9 to "know more" | The contract test fixes its three fields; a change is a planner change with an A11 round |
| R12 | **Solver regressions** across many calendars | Property tests over thousands of seeded cases (§12.1), metamorphic tests, a performance check |

---

## 11. Dependencies on Phase 6 (the interface Phase 7 expects)

1. **Confirmed module outline** per module with **topic rows** (id, name, optional printed weight,
   which assessments cover it), confirmed by the learner, with provenance.
2. **Module card assessments**: id, kind (test, exam, assignment), start and end time (or due
   time), weight in the final mark.
3. **The mark calculator** in `packages/admissions`: pass mark, DP status, subminimum, and
   `mark_needed(module, target)` returning the exam mark needed, or "unreachable".
4. **Lecturer consultation times** and the faculty office (for "who can help" when time doesn't fit).
5. **Consent v4 coordination**: if Phase 6's outline uploads also need naming, one bump covers both.
6. From **Phase 5c**: the confirmed registration (which modules, which year).

---

## 12. Definition of done

Every sub-phase's tests pass; `pnpm verify` and CI green; the red team stays at 100% and the
integrity evals pass; **no calculation reads an unconfirmed mark or tag**, **no session is ever
booked in a blocked, quiet or assessment time**, and **a plan that doesn't fit says so**, each
proven by tests that try; `planner` is in the rule-11 guard and the app lists it; the light-week
contract passes; no predicted mark appears anywhere; audits below have run with no open Critical
or High; status.md says so.

### 12.1 Tests

- **Solver properties** (seeded generator over random preferences, blocks, assessments and
  demands; ≥ 2,000 cases per property, the seed printed on failure):
  1. no session overlaps a blocked time, quiet hours, an assessment or its 2-hour buffer, or
     falls on the exam day or after the exam starts;
  2. every session is within a study window, at least the minimum length, and never crosses midnight;
  3. the daily cap and the rest day hold every day and every 7 days;
  4. `fits` ⇔ booked minutes equal demand; when not, `shortfallMinutes` = demand − booked, and
     `dropped` are the lowest-stake topics;
  5. every needs-work topic's first session comes before any small-mistakes topic's first session;
  6. determinism (same input, same output) and order-independence (shuffled topic or block input,
     same output);
  7. monotonicity: adding a block never increases booked minutes; removing one never decreases them;
  8. **re-balanced, not shortened**: if capacity after a new block still covers demand, booked
     minutes are unchanged;
  9. done, past and pinned sessions never move;
  10. translation: shifting every input by 7 days shifts the output by 7 days.
- **Mastery:** worked examples (the planning example: questions 3 and 7 needs work, 5 and 9 small
  mistakes, in that order); unconfirmed tags refused; `A_t = 0`; weights from each source summing
  to 1; ties broken by id; not-enough-evidence and not-tested-yet bands.
- **Targets:** DP not met, unreachable targets, subminimum, fall-back defaults, all against Phase 6's
  calculator output.
- **Reading:** the schema on synthetic tests (rule 4), every warning, total mismatch shown not
  fixed, unmarked refused, suggested ids outside the outline dropped, no name or number field.
- **Busy words:** crisis words → nothing parsed and the card; wrong weekday flagged; dates outside
  the horizon refused; nothing saved before **Use these**.
- **Light week:** the contract test (§5).
- **Data layer:** consent trigger (v3 refuses an upload, allows typed), RLS, IDOR, export,
  deletion, IDs-only reminder payloads; the real-Postgres suite.
- **Guards:** `planner` in `SHARED_PACKAGES` proven on a broken example; the app lists the package.
- **Agent:** each tool returns code's numbers; red-team additions; integrity evals.
- **App:** Jest + RNTL for each screen (awaited `render`, `fireEvent`); offline re-plan with the
  network off; cache cleared at sign-out; the solver's performance check.
- **E2E (production build, axe):** a learner types a test, confirms tags, sees the performance map,
  builds a plan, says "Thursday is out", confirms, and sees Thursday empty; a too-short horizon
  shows the honest message and the fall-back plan.

### 12.2 Audits

A1 (whole phase) · A2 (new screens against tokens) · **A3** (the map table, the calendar's Move
alternative, focus to the crisis card) · A4 (planner size, solver time, app bundle) · **A5** (new
uploads, routes, IDOR, rate limits) · A7 (the app's offline cache and sync) · A8 (no new
dependency expected) · **A10** (tools, integrity, exam stress, busy-words crisis, no predicted
marks) · **A11** (a new document kind abroad, consent v4, no reasons stored, the device cache, the
light-week contract).

---

## 13. Next three actions once approved

1. The owner answers D1–D18 (or "go with what is best" = every bold answer) and confirms the
   fuller audit list (F5).
2. Check §11 against Phase 6's approved plan; assign P7-1 to P7-3 their migration numbers.
3. Get the real AI key for 7a-1's reading spike, and add Phase 7's items to the consent v4 draft
   for the legal adviser.
