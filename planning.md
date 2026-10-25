# UniversityFlow — Master Plan

> An AI companion that takes a South African learner from **Grade 11 results to graduation day**:
> it finds every course they qualify for, gets the applications in, keeps them on track through
> matric, walks them onto campus, and then studies alongside them, module by module, year by
> year, until they finish the degree.
>
> This document is the single source of truth for *what we are building and in what order*.
> Live progress lives in [status.md](status.md). Read both when opening a new session.

**Last updated:** 2026-10-24 (evening: Phase 6 approved into §11 as plan v0.10; §20.1, the owner's 2026-10-24 decisions) · **Owner:** Tumo Mogame (tumo@tumoolo.tech) · **Plan version:** 0.10, approved 2026-10-24 (0.10 moves Phase 6, semester setup, into §11 with the owner's answers D1–D14; signed off 2026-09-28; 0.3 adds the research review, §17; 0.4 adds the pipeline, §12.4, and renumbers data accuracy to A13; 0.5 plans Phase 4 in §11; 0.6 plans Phase 5 in §11; 0.7 proposes Phase 5e, walking guidance, safety notes and accessible routes, for approval; 0.8 plans Phase 5f, Meta's open models as self-hosted fallbacks, not built; 0.9 proposes Grade 10 entry, the subject studios inside UniversityFlow, and a Grade 10–12 school record from the learner's own marks (official final NSC results later) with a sample generator, §18; and the North Star, one verified hub opened gate by gate, §19, with verified colleges, §19.1; both approved by the owner on 2026-10-21 with the recommended answers, §18.8 and §19.2)

---

## 0. Locked decisions

Decided on 2026-09-28, when the owner accepted every recommendation in plan v0.1. Changing any
of these is a re-plan, not a tweak.

| # | Decision | Choice | Consequence |
|---|---|---|---|
| **D1** | First cohort | **Learners in Grade 11 in 2026.** Admissions half live for the **2027 application season**; the university half built just ahead of them, for **February 2028** | MVP (Phases 0–3) must be live by **March 2027**. Everything later is timed to the cohort (§11) |
| **D2** | First universities | **Wits, UJ, UP, UCT, TUT, UKZN** (UKZN through CAO). The rest in waves | Six scoring calculators and six verified datasets in Phase 1 |
| **D3** | University data | **Tiers A + B only in v1** (public data plus what the student uploads). **One university partnership** pursued in parallel as the Tier C pilot | Nothing in v1 depends on a university's systems. Partnership outreach starts now, not in Phase 8 |
| **D4** | Login | **Our own accounts: phone + one-time PIN, or email.** SAFIRE single sign-on added once a partner registers us | Student number is profile data, never a credential. We never hold university passwords |
| **D5** | Who pays | **Free for students.** Funded by universities, bursary funders and sponsors | Cost per student per month is a tracked metric from Phase 2. Pricing model decided before Phase 5 |
| **D6** | Platform | **Revised 2026-09-28: web app _and_ mobile app (iOS + Android) in one monorepo**, as in tumo-olo, plus WhatsApp and SMS. The web app carries the March 2027 launch; the mobile app ships to the stores for Stage 3 (around June 2027) | Shared packages must stay React-Native-safe (hard rule 11). The app brings **free push notifications** (cheaper than WhatsApp for students who install it), the camera for report photos, and offline access. Store accounts and review time go on the plan |
| **D8** | Integration order | **Build everything against local stand-ins; the owner connects real accounts at the end** (2026-09-28) | Every provider (AI, SMS, WhatsApp, storage, jobs, errors) sits behind an interface with a local fake and contract tests. Postgres runs locally in Docker, file storage in a local S3-compatible server. **Risk:** AI quality (document reading, coaching) can only be proven with the real API key. Getting that one key early is strongly recommended |
| **D7** | Name | Folder and product name **UniversityFlow** (folder renamed from `UnivesityFlow` on 2026-09-28) | — |

The **tools, stack and project structure** that follow from these are in **§16**. They make up
the Phase 0 plan.

---

## 1. The idea on one page

### 1.1 Who it's for

A learner who may be the **first in their family** to go to university. They may not know what
an APS is, which subjects close which doors, when applications close, or what NSFAS needs from
them. At university they may not know what "DP", "subminimum" or "supplementary exam" mean,
until the day it costs them a year.

### 1.2 The promise

**Nobody falls through the cracks for lack of information, a missed deadline, or feeling alone.**

### 1.3 The journey: eight stages, one companion

```
 GRADE 11 ─────────── GRADE 12 ─────────────── ARRIVAL ──────────── EVERY YEAR AT UNIVERSITY ───────── GRADUATION
    │                    │                         │                          │
 [1] Results ──▶ [2] Applications ──▶ [3] Matric support ──▶ [4] Acceptance & orientation
     & options       & funding           (goals, exams,          (virtual tour, safety,
                                          reminders)              first-week survival)
                                                                        │
                   ┌────────────────────────────────────────────────────┘
                   ▼
 [5] Registration check ──▶ [6] Semester setup ──▶ [7] Study coach ──▶ [8] Year-to-year continuity
     (modules correct?)       (books, lecturers,     (marks, weak topics,    (carry lessons forward,
                               how marks work)        timetables, exams)      portfolio, career)
```

One agent carries the student through all eight. It remembers their goals, their history and
what worked. The *same voice* congratulates them on an acceptance in 2027 and coaches them
through their final-year exams in 2031.

### 1.4 What makes it different

1. **It starts early.** It uses Grade 11 results, when most learners don't yet know they can apply.
2. **It never lets go.** Most support stops at the application. This one keeps going to graduation.
3. **It is specific.** Not "study harder", but "Question 5 and 9 carry 30% of the paper, and you
   lost marks on the same step both times. Here's a plan for the next 14 days that fits around
   the days you told me you're busy."
4. **It is kind, and it stays honest.** Encouraging when a student is failing, but it never
   promises an outcome it can't guarantee.

---

## 2. How South African university admission actually works

Everything in Stages 1–2 depends on getting this right. Requirements change **every year** and
differ **per university and per programme**. Any number the product shows must come from that
university's official prospectus for that year, with the source recorded.

### 2.1 The calendar, for someone in Grade 11 today (2026)

| When | What happens | What UniversityFlow does |
|---|---|---|
| Grade 10 (earlier) | **Subject choices.** Maths Literacy instead of Maths closes most engineering, science and commerce degrees. | Later: a warning tool for Grade 9–10 learners (§9) |
| Nov–Dec 2026 | Grade 11 final exams, then **final Grade 11 report** | Student uploads the report. We calculate every eligible course (Stage 1) |
| **Mar–Apr 2027** | **Applications open.** For the 2027 intake, Wits opened on 2 March and UCT, UP, UJ and UWC on 1 April. | Application packs, documents, fees, deadlines (Stage 2) |
| Apr–Sep 2027 | Applications close. Competitive programmes (e.g. medicine) close earliest. Some need the **NBT**, interviews or portfolios. | Deadline tracking, NBT registration and prep reminders |
| Jun 2027 | Grade 12 **June results** are often sent in to update a provisional offer | "Upload your June report" reminder. Re-check eligibility |
| Sep 2027 | Grade 12 **trial (prelim) exams** | Exam-support mode (Stage 3) |
| Around Sep 2027 → | **NSFAS** and bursary windows (dates vary; verify each cycle) | Funding checklist and reminders |
| Oct–Nov 2027 | **NSC final exams** | Most intensive support: daily, gentle, exam-by-exam |
| Jan 2028 | NSC results. Provisional offers confirmed or withdrawn | Plan B if an offer falls away (extended programmes, other institutions, TVET) |
| Jan–Feb 2028 | Registration, residence, orientation | Stages 4–5 |

**Key point:** a conditional offer made on Grade 11 results is confirmed only once final matric
results meet the conditions. The product has to explain that clearly and early. "You have a
provisional offer" isn't "you're in".

### 2.2 Which reports count

- **Provisional applications:** the **final Grade 11 report**. Most universities accept it, and
  applying early puts the learner in the queue before later applicants.
- **Updating provisional offers:** Grade 12 **June** results, sometimes **September** too.
- **Final admission:** the **National Senior Certificate (NSC)** results in January, plus the
  right *type* of pass (Bachelor's, Diploma or Higher Certificate).

### 2.3 Every university scores differently

"APS" isn't one formula. Examples as reported for current cycles; **verify each against the
official prospectus before we encode it**:

| University | Scale | Life Orientation | Notes |
|---|---|---|---|
| **UP** | Best 6 subjects, 7-point table, max 42 | Excluded | |
| **UJ** | Best 6, 7-point table, max 42 | Excluded | |
| **Wits** | Best 7 on its own weighted table | **Included, capped at 4** | Bonus points for English and Maths above 60% |
| **UCT** | Raw percentages of best 6, **out of 600** | Excluded | Plus NBT for many programmes |
| **Stellenbosch** | Works in **percentages** | — | Programme-specific |

On top of the score, each programme adds its own rules:

- minimum levels in specific subjects (e.g. Maths 5, Physical Science 5)
- language requirements
- NBT results
- portfolios, auditions or interviews
- selection tests
- limited-place programmes, where meeting the minimum doesn't guarantee a place

**Design rule:** each university's scoring is a **small, heavily tested calculator in code**,
never something the AI works out in conversation (§4.2).

### 2.4 Other routes that matter

- **CAO** (KwaZulu-Natal): one central application for UKZN, DUT, MUT, UniZulu and others.
- **Extended / foundation programmes**, for learners slightly below the mainstream requirement.
- **Universities of technology, TVET colleges and higher certificates**, always shown as a
  **Plan B**, never hidden. A learner who doesn't qualify should leave with options, not a dead end.
- **Funding:** NSFAS, bursaries, and application-fee waivers. For most of our students, funding
  decides whether they arrive at all.

---

## 3. The product, stage by stage

Each stage lists what the student experiences, what the agent does, the **artifacts** (the
interactive panels next to the chat, like ChatGPT's canvas), and where the data comes from.
Stages marked **🔒 partnership** need a university's cooperation for the full version. Each of
those has a student-provided fallback.

### Stage 1 — Results → every course you can apply for

- **Student:** creates an account (with a parent or guardian's consent if under 18, §8.1),
  picks a goal or "I don't know yet", and uploads a photo or PDF of the Grade 11 final report.
- **Agent:**
  - reads the report and **shows the extracted marks back for the student to confirm**
  - calculates the score *per university* using the calculators in code
  - lists every programme they qualify for, grouped as **Qualify now**, **Close (within 1–2
    levels)** and **Plan B**
  - for each "close" course, says exactly what has to improve
- **Artifacts:**
  - **Results card** (editable marks)
  - **Score breakdown per university** (why the score is what it is)
  - **Course explorer** (filter by university, field and distance from home; career outcomes)
- **Data:** public prospectus data (§5, Tier A) plus the student's upload.

### Stage 2 — Applications, fast

- **Student:** shortlists courses. The agent builds an **application pack** per university.
- **Agent:**
  - fills a pre-completed answer sheet (personal details, subjects, marks, choices in the right
    order)
  - produces a document checklist (certified ID copy, report, proof of residence) and flags
    anything missing or expired
  - tracks fees and waivers, deadlines, and the residence application
  - runs an **NBT tracker** per shortlisted programme: which tests it needs (Academic and
    Quantitative Literacy, Mathematics, or both), the faculty's own deadline, whether it must be
    written **in person** (e.g. Wits Health Sciences, reportedly both tests in person by
    mid-August), and the nearest test centre. All of it is catalogue data with a source
    (hard rule 3), since faculties set different rules
  - handles NSFAS and bursaries in the same view
  - walks the student through each university's own portal, step by step
- **Why "guide" and not "submit for them":** university portals are the applicant's own legal
  application, often with a fee, a declaration and a password. We make each application take
  minutes instead of hours. Submitting *on the student's behalf* needs a formal arrangement with
  the university and belongs in the partnership track (Q3).
- **Artifacts:**
  - **Application tracker** (per university: status, next step, deadline countdown)
  - **Document vault**
  - **Funding tracker**

### Stage 3 — Matric support: goals, exams, encouragement

- **Student:** tells the agent their goal ("Civil Engineering at UJ") and their exam timetable,
  or picks their school and we load the NSC timetable.
- **Agent:**
  - sends **WhatsApp or SMS** messages that are paced, never spammy
  - stays in touch through the year, and daily before papers that decide admission:
    *"Maths Paper 1 on Tuesday. UJ needs a 5 for Civil. You got 62% in June, and you're close."*
  - reminds the student why they're doing this, using their own words from sign-up
  - re-checks eligibility after the June and September reports
  - points to **free, curriculum-aligned practice**: **Siyavula**'s open textbooks and practice
    for Grade 10–12 Maths and Physical Sciences (endorsed by the Department of Basic Education),
    aimed at the subjects the student's target programme depends on
  - handles the "I failed my trial" moment with care (§4.3)
- **Artifacts:**
  - **Goal card**
  - **Exam countdown**
  - **"What I need per subject" calculator**

### Stage 4 — Accepted: orientation before you arrive

- **Student:** uploads the acceptance letter, or confirms "I got in".
- **Agent:** runs a **virtual orientation**:
  - a campus tour with photos and short videos: library, computer labs, where to buy
    affordable food, clinics, campus security, the transport routes
  - residence and **accommodation** guidance, including spotting fake-listing scams
  - **safety**: campus security numbers, walking at night, shared-computer habits (§8.6)
  - a first-week survival guide: student card, registration hall, where to go for what
- **Data:** tours are **content we produce or license** per campus (photos, video, a map)
  and store as reviewed content. Live 360° video is a later enhancement.
- **Artifacts:** **Campus tour** (a map with points of interest and media), **First-week checklist**.

### Stage 5 — Registration check

- **Student:** uploads **proof of registration**.
- **Agent:**
  - reads the modules and compares them with the programme's official curriculum for that
    year and semester (from the published faculty rules, Tier A)
  - flags a **missing, wrong or clashing module**
  - says **where to go, who to ask for (faculty officer), what to say**, and the deadline for
    changing registration
- **Artifacts:** **My modules** (registered vs expected, with differences highlighted).

### Stage 6 — Semester setup: books, lecturers, how marks work

- **Agent:**
  - builds the semester view per module: prescribed books (from the study guide or module
    outline the student uploads, or published module pages)
  - finds **legitimately free** alternatives: open textbooks such as OpenStax, the university's
    own OER repository, library e-books. **Never pirated copies** (§8.3)
  - lists lecturers and consultation times, where published or uploaded
  - explains the assessment rules in plain language:
    - year mark vs exam weighting
    - **DP (Duly Performed)**: whether you're allowed to write the exam at all
    - **exam subminimum** (e.g. at least 40% in the exam, whatever the year mark)
    - supplementary exams, and what they cap the mark at
- **Artifacts:** **Module card** (weights, dates, books, lecturer); **Mark calculator**
  ("to pass with 50% you need X in the exam; to reach your 60% target, Y").

### Stage 7 — The study coach: marks, weak spots, a plan that fits your life

The heart of the product. Two levels, depending on the data available:

**7a — Student-provided (v1):** the student uploads marked tests (photos) and past papers.
The agent:

- reads the questions, the marks per question and the marks achieved
- tags each question by **topic**, then finds patterns across tests:
  *"You drop marks on integration by parts every time, and it's worth 20% of the exam."*
- builds a **study plan** before each test or exam, starting about **two weeks out**:
  - the **highest-value weak topics** first, then the "small mistakes" topics to secure the marks
  - a **target mark and a fall-back**, e.g. pass = 50%, aim for 60%, fall-back 55%
  - practice from the relevant past papers
- **adjusts the timetable when the student says they're busy.** "I work Friday evenings and
  Saturday is my cousin's wedding" produces a new plan, re-balanced, not just shortened.

**How 7a is built (code decides, §4.2):**

- **Topic mastery is a tested calculation, not an AI judgement.** Version 1 is simple and
  explainable: per topic, the marks lost across tests, weighted by how many marks that topic
  carries in the coming exam. Knowledge tracing (Bayesian Knowledge Tracing) can come later, on
  the same interface. Item Response Theory needs question statistics across a whole class, so it
  only becomes possible with partnership data (7b).
- **The timetable is a constraint problem, solved in code.** The AI's only job is to turn "No,
  I have things on Thursday" into a constraint. A tested scheduler then rebuilds the plan: it
  keeps the total study time the target mark needs, puts the highest-value weak topics first,
  and never books a blocked slot. If the time can't fit before the exam, it says so honestly
  rather than squeezing it in.
- Both live in a new shared package, `packages/planner` (pure TypeScript, React-Native-safe,
  §16.2), so the app can re-plan offline.

**7b — 🔒 Partnership (pilot):** with the university and the lecturer's consent, marks and
scripts come in directly (through an LMS integration, §5). The lecturer marks as usual, and the
agent gives *each* student feedback on *their* script, based on a memo the lecturer approves.

- **Technical note for the pilot:** standard LMS grade calls return totals, not per-question
  marks. Moodle's `core_grades_get_grades` returns course totals only; per-question data needs
  `mod_quiz_get_attempt_data` (online quizzes) or the Advanced Grading API (rubric-marked work).
  Paper scripts come in as scans, read the same way as in 7a. Confirm the equivalent calls on
  the partner's own LMS before promising question-level feedback.

**Example message** (your flow, in the agent's voice):

> *Tumo, you've written all your tests and your exam is in 3 weeks. Across the tests, questions
> like 3 and 7 are where you're struggling, and on 5 and 9 you're mostly making small mistakes,
> which is fixable. 5 and 9 carry a lot of marks. You need 50% to pass. We'll aim for 60%, with
> 55% as our fall-back. We start with 3 and 7 this week and finish with 5 and 9, so you walk in
> confident. You said Thursday is out, so Thursday is free in the plan.*

- **Artifacts:** **Performance map** (topics × tests heat-map), **Study plan** (a calendar you
  can drag and edit), **Practice set**.

### Stage 8 — Year-to-year continuity, portfolio, career

- **Continuity:** at each new semester, the agent reviews last year's weak topics against this
  year's modules. *"MATH2001 builds on the series work you struggled with in MATH1002. Let's
  refresh it before week 3."*
- **Portfolio:** it suggests **small real projects** matched to the degree and the student's
  free time, and tracks them into a portfolio page. The student does the work. The agent coaches
  (§8.4).
- **Career:** CV help, vac-work and internship reminders, graduate-programme deadlines in the
  final year.

---

## 4. The AI agent

### 4.1 Its character, as a written charter

The charter is written down and tested (§12.3):

1. **Considerate first.** It asks how the student is before it asks about marks.
2. **Encouraging, and honest.** "I can see you're struggling, and I believe you can turn this
   around" is fine. "You will definitely pass" is not. It never promises an outcome.
3. **Never shames.** No comparing the student to others, no "you should have".
4. **Specific, not generic.** Every piece of advice points to *their* marks, *their* modules,
   *their* calendar.
5. **Uses the student's own goals.** It reminds them of what *they* said they want, in their words.
6. **Knows its limits.** It is not a counsellor, a doctor or a lawyer. It refers early and
   warmly (§4.3).
7. **Stories of comeback:** you asked for examples of people who hit rock bottom and came back.
   These come from a **reviewed library of true, public stories**, never made up by the AI in
   the moment. A made-up "true story" is a lie told to a vulnerable person.

### 4.2 The architecture rule: code decides, AI explains

The one rule that stops it misleading students:

| Decided by **deterministic code** (tested) | Done by the **AI** |
|---|---|
| Admission scores, eligibility, requirements | Explaining them in plain language |
| Deadlines, dates, fees | Reminding, encouraging, planning around them |
| Mark calculations (DP, subminimum, weighting) | Turning them into a study plan |
| Registration vs curriculum comparison | Telling the student what to say, and to whom |

The AI answers **from our verified data, with the source shown**, not from memory. If the data
isn't there, it says "I don't know yet, here's who to ask" rather than guessing.

### 4.3 Wellbeing and crisis protocol (non-negotiable)

- Signs of distress (hopelessness, self-harm, "I want to give up on everything") → the agent
  **stops coaching**, responds with care, and opens a **crisis card**: an artifact with
  **one-tap call and WhatsApp buttons** for:
  - **Higher Health 24-hour helpline** (reported as 0800 36 36 36, with an SMS line), run for
    students in post-school education, so it's the most relevant line for our users
  - **SADAG** suicide crisis line (reported as 0800 567 567) and its other helplines
  - the substance-abuse helpline (reported as 0800 12 13 14), when that's what the student raised
  - the **student's own campus** counselling or health clinic: where it is, hours, how to book
  - emergency numbers
- **Every helpline number is a catalogue record** with a source, a date and a verifier (hard
  rule 3), checked against the organisation's own website, never a news article or a social
  media post. A wrong crisis number is the worst error this product could make, so these are
  re-verified before every release and at least every three months. The numbers above are
  from research and are **not yet verified**.
- It **flags for a human** on our side where the student has agreed to that.
- It never tries to be the therapist. Its job is to connect the student to one, warmly.
- "Speak to a psychologist" referrals are **specific**: which office, how to book, what to say.
- These flows are tested before anything else ships (Audit A10, §12).

### 4.4 Tools the agent can use

Each one is a tested function the AI calls, not something it improvises:

- `read_document` (reports, letters, registration proofs, marked scripts), with **student
  confirmation of the extracted values**
- `calculate_aps(university, marks)` · `eligible_programmes(marks, prefs)`
- `deadlines(student)` · `application_pack(university)` · `nbt_requirements(programme)`
- `curriculum(programme, year)` · `compare_registration(proof, curriculum)`
- `mark_needed(module, target)` · `topic_map(tests)` · `build_study_plan(tests, calendar, busy)`
- `schedule_message(channel, template, time)`, respecting consent and quiet hours
- `referral(kind, university)`: counselling, faculty officer, financial aid, disability unit
- `crisis_card(campus)`: the verified helplines plus the student's own campus clinic (§4.3)

### 4.5 Memory

The agent keeps a **student profile** the student can see and edit: goals, programme, modules,
results history, weak topics, busy days, communication preferences. "What does UniversityFlow
know about me?" is always one tap away. The student can delete it (§8.1).

Long-term memory has two parts, used for different jobs:

- **Structured, for carrying weak topics forward (Stage 8).** Topics are tagged against a
  **prerequisite map**: which topics each module builds on. "You struggled with series in
  MATH1002, and MATH2001 builds on it" is a lookup in that map, so it's exact and testable.
  The map is catalogue data, built per programme.
- **Semantic search, for "what did we discuss?"** Past conversations and notes are searchable by
  meaning, using **pgvector** inside our own PostgreSQL in Cape Town. Nothing leaves the
  country, and nothing is added to the stack.

---

## 5. Where the data comes from (the reality check)

Three tiers. **v1 must work on Tiers A and B alone.**

| Tier | Source | Examples | Access |
|---|---|---|---|
| **A · Public** | Official prospectuses, faculty rule books, calendars, published module pages, NSC timetable, OER repositories | Requirements, scoring rules, curricula, deadlines, free textbooks | We build and verify it ourselves, every year, with a source link and year on every record |
| **B · Student-provided** | Uploads and answers | Reports, acceptance letters, registration proof, study guides, marked tests, past papers the student has access to, timetable, busy days | The student's consent. Everything extracted is confirmed by the student |
| **C · 🔒 Institutional** | University systems | Official marks, all scripts, lecturer memos, module enrolments | **Only with a partnership agreement.** Technically through **SAFIRE** single sign-on and **LTI 1.3** into the university's LMS (Moodle / Blackboard / Brightspace / SunLearn) |

**What we don't do:** log into a student's university portal with their password and scrape it.
It breaks the university's terms, makes us hold every student's password, and puts the whole
company at risk under POPIA.

**Lecturer-marked scripts (Stage 7b):** exam papers and memos are university copyright, and
scripts contain students' personal information. This is a **pilot with one department that
agrees**, not a default feature.

---

## 6. Login and identity

- **Not "student number + SA ID number".** Both are easy to find or guess, the ID number is
  sensitive, and neither is a secret, so anyone who knows them could log in as the student.
- **v1:** our own account, with **phone number + one-time PIN** (most learners have a phone
  before they have an email) or email. Optional passkeys.
- Students **enter** their university and student number as *profile data*, not as a password.
- **Later:** "Log in with my university" through **SAFIRE** (SAML), once a partner university
  registers us as a service provider. That proves enrolment without us ever seeing a password.

---

## 7. WhatsApp and SMS

### 7.1 Consent first
- Explicit **opt-in** per channel, recorded with a time stamp. For under-18s, parent or guardian
  consent covers it (§8.1). **Opt-out** in one word ("STOP") on both channels.

### 7.2 Rhythm
- Normal weeks: **1–2** messages. Exam weeks: **up to daily**, never more than the student chose.
- **Quiet hours:** nothing between about 21:00 and 07:00, and nothing during a paper the
  student is sitting (we know the timetable).
- Every message is **useful or kind**, never filler. If there's nothing to say, we say nothing.

### 7.3 WhatsApp rules we build around
- Messages we start must be **pre-approved templates**. Free-form chat only within 24 hours of
  the student's last message.
- Template categories are billed differently: *utility* is cheap, *marketing* costs more.
  Reminders and study plans must be classified honestly as utility.

### 7.4 Cost, approximate for 2026 (budget per student per year)
- WhatsApp marketing template ≈ **R1.50**, service/utility ≈ **R0.12** per message. A provider
  platform fee typically adds **R750–R3,000 a month**.
- At ~120 messages per student per year, mostly utility, that's **tens of rand per student per
  year**, plus AI costs. This feeds Q5 (who pays).

---

## 8. Trust, safety and the law

### 8.1 POPIA: our users start as children
- A Grade 11 learner is usually **16–17**, and from S1 a Grade 10 learner about **15**. Grade 10
  is the floor (Grade 9 is refused, A1-39, owner 2026-10-22), and so is age 13 (A11-24). Under
  POPIA ss 34–35, processing a child's personal information needs the **prior
  consent of a competent person** (a parent or guardian). Sign-up for under-18s includes a
  **guardian consent step**, recorded and revocable. From Grade 10 a guardian's consent covers up
  to about three years (G10-6).
- When the student turns 18, they **re-consent in their own name**; until they do, nothing of
  theirs is processed and no reminder is sent (A1-13). Many now turn 18 in matric, some during
  the final exams: **"agree ahead"** (agreeing in the 30 days before, effective on the day) is
  planned after S1's audits, once legal review confirms it (owner, 2026-10-22). Whether the
  guardian wording should say the consent lasts "until they turn 18" goes to the legal review,
  for consent v4 with the studios' changes (§18.5-3).
- **One exception to "nothing before consent": an objection.** A learner who replies STOP before
  a guardian has consented is still opted out at once, and that is recorded (`messaging_channels`:
  the channel, when, "stop"), because an objection to processing (POPIA s11(3)) must be honoured
  whatever else is true, and it can only be honoured if it is remembered. Nothing else is
  processed. The record is the learner's to see: export returns it in its account part with or
  without consent (s23, audit A11-08), and it goes with the account.
- **One exception to "no university in an SMS or WhatsApp" (A11-02): the crisis reply.** It names
  the learner's campus and its security and support numbers after the helplines, only in answer to
  their own message of distress, as a deliberate safety exception (audit A11-16; whether to keep
  the campus name is the owner's decision; docs/store/privacy-and-data-safety.md says the same).
- Marks, health or wellbeing notes, and any disability information are handled as **sensitive**:
  minimum collected, encrypted, access-logged, never used for marketing.
- Rights built in from day one: **see my data, correct it, delete it, export it**.
- **Access control in the database itself**, not only in application code: PostgreSQL
  **row-level security**, so a query running for one student can't return another student's
  rows even if the app has a bug. It works on our own PostgreSQL in Cape Town.
- An **append-only audit log** of every access to a student's personal data: who or which
  process, when, what, and why. Staff access to student records needs a stated reason, and the
  log itself can't be edited. It answers the Information Regulator's questions and the student's
  "who has seen my data?".
- An **Information Officer** registered with the Information Regulator before launch.
- Hosting and cross-border transfer (AI providers, messaging providers) assessed under POPIA s72.

### 8.2 Accuracy is a safety issue
A wrong requirement or deadline can cost a learner a year. Every Tier A record carries a
**source URL, academic year and "verified on" date**, and a second person checks it before it
goes live. Unverified data is not shown.

### 8.3 Copyright
- Books: link only to **legitimately free** sources. Never host or link pirated PDFs.
- Past papers: use what the student already has access to (their own copies, the library
  portal) or what the university publishes openly. Keep them private to that student.

### 8.4 Academic integrity
The agent **teaches and plans. It never writes assessed work.** No doing assignments, no
answering a live test, no "write my portfolio project". The portfolio is the student's own work,
coached. This protects the student from misconduct charges and protects the product's
reputation with universities (who are our likely customers, Q5).

### 8.5 Honesty about outcomes
No "guaranteed admission" language anywhere, ever. The product explains **provisional vs
final** admission and **limited places** clearly.

### 8.6 Digital safety reminders (you asked for these)
Delivered at the right moment (the first week, exam season, residence move-in), not as one
long list:

- **Log out** of university and library computers every time, from the student portal *and*
  the LMS. Never tick "remember me" on a shared machine. An account left open can mean an
  altered or deleted submission.
- **Never share** your student portal, NSFAS or email password, even with friends or "helpers".
- **Scams:** nobody legitimate charges you to "guarantee" admission or a bursary.
  Accommodation deposit scams peak in January. Phishing emails pretending to be the university
  or NSFAS.
- **Academic etiquette:** how to email a lecturer (subject line with the module code, student
  number, a clear question, polite sign-off); what plagiarism is and what it leads to (including
  AI-written work handed in as your own, §8.4); how to handle a group-work dispute early and in
  writing, before it becomes a disciplinary matter.
- **Back up** assignments to your university cloud storage. A lost laptop shouldn't mean a
  lost semester.
- Don't leave laptops and phones unattended in the library. Lock your phone.
- Keep **proof of every payment and every registration change**.
- Watch the deadlines students commonly miss: change of curriculum, DP requirements,
  supplementary exam registration, residence renewal, NSFAS re-applications.

---

## 9. Other features I recommend (prioritised)

**Must-have for this audience**
1. **Funding first-class** (NSFAS, bursaries, fee waivers) inside Stage 2, not an afterthought.
2. **Plan B always visible:** extended programmes, universities of technology, TVET, higher
   certificates, gap-year options.
3. **Data-light by design:** small pages, compressed images, text-first, and WhatsApp as a full
   channel for people who can't afford data for a web app.
4. **Languages:** English first, with **isiZulu, Sesotho, isiXhosa and Setswana** support for
   the parts that matter most (reminders, encouragement, instructions).
5. **Parent or guardian view (opt-in):** deadlines and progress, never private chats or marks
   without the student's permission once they're 18.
6. **Accessibility:** screen-reader-friendly, and links to each university's **disability unit**.

**High value**
7. **Subject-choice warning** for Grade 9–10: "Maths Lit closes these 40 degrees."
8. **NBT prep** and registration reminders.
9. **Academic exclusion and appeals guide:** what to do if you're excluded, with deadlines.
10. **Money skills:** budgeting the NSFAS allowance, avoiding loan-shark debt.
11. **Peer layer:** matching with senior students (mentors) in the same programme.

**Later**
12. Live campus video tours and 360°. Lecturer dashboards (partnership). Employer and
    internship matching.

---

## 10. Business model (to decide, Q5)

Students are unlikely to be able to pay. Options, which can be combined:

| Payer | Why they'd pay | Notes |
|---|---|---|
| **Universities** | First-year dropout is expensive for them. Retention and throughput funding | Also unlocks Tier C data. Strongest fit |
| **Bursary funders / SETAs / corporates** | Their bursars finish on time | Per-sponsored-student fee |
| **Schools / provincial education** | University placement rates | Stage 1–3 only |
| **Freemium for students** | Premium study-coach features | Risky for equity; last resort |

---

## 11. Phase plan

Same working cycle as tumo-olo: **Plan → Implement → Test → Audit → Update status.md → next
phase.** A phase can't close with an open Critical or High finding, a failing or skipped suite,
or a stale `status.md`.

The phases are **timed to the cohort**: each stage is built and hardened just before the first
cohort reaches it.

| Phase | Name | Delivers | Must be live by |
|---|---|---|---|
| **P** | **Planning** (now) | This plan signed off, Q1–Q6 answered | Oct 2026 |
| **0** | Foundation & tooling | Stack, repo, CI, the test and audit harness, the design system basis. **Tools and structure document** | Nov 2026 |
| **1** | Knowledge layer | Data model plus verified Tier A data for the first 5–6 universities; **per-university score calculators** with exhaustive tests | Jan 2027 |
| **2** | Chat core | Chat and artifacts UI, accounts, **guardian consent**, profile and memory, document reading with confirmation, the agent charter and crisis protocol | Feb 2027 |
| **3** | Stage 1–2: Results & applications | Results → eligible courses, application packs, trackers, funding | **Mar 2027** (applications open) · 🚀 **MVP** |
| **4** | Stage 3: Messaging & matric support | WhatsApp/SMS (consent, templates, quiet hours), goals, exam countdown, re-checks after the June and Sept reports | Jun 2027 |
| **5** | Stages 4–5: Acceptance, orientation, registration | Campus tours (first universities), safety content, registration check | Jan 2028 |
| **6** | Stage 6: Semester setup | Curricula, module cards, mark calculator (DP, subminimum), free-book finder | Feb 2028 |
| **7** | Stage 7a: Study coach | Marked-test reading, topic maps, study plans that adapt to busy days | Mar 2028 (first tests) |
| **8** | 🔒 Stage 7b: Partnership pilot | SAFIRE SSO, LTI 1.3, lecturer-memo feedback with one department | When a partner signs |
| **9** | Stage 8: Continuity & portfolio | Year-to-year carry-over, portfolio projects, career | Nov 2028 |

**The mobile app (D6)** is scaffolded in Phase 0 and follows each stage: a feature lands on the
web first, then in the app, from the same shared packages. The first store release goes with
**Phase 4 (June 2027)**, where push notifications take over much of the reminder load from
paid WhatsApp messages. Store review time (Apple can take days, and can reject) is budgeted
inside Phase 4, not after it.

**Optional acceleration:** recruit a small group of **current university students** as testers
for Phases 5–7 *before* the first cohort arrives, so the university half is proven on real
students a year early.

Each phase gets its own detailed section (deliverables, definition of done, test list, audits)
**at the start of that phase**, as in tumo-olo. Not all ten at once.

### Phase 4 — Stage 3: Messaging & matric support

*Planned 2026-10-13. Live by **June 2027**, before the first cohort's June exams, with the
mobile app's first store release. Built against stand-ins (D8); the owner connects WhatsApp,
SMS, push and the stores at the end.*

**What a learner gets.** They tell the companion their goal and their exam timetable. Through
matric it keeps in touch by WhatsApp, SMS or push, a few times a week and daily before the
papers that decide admission, never at night or during a paper, and always about their own goal
and marks. After the June and September reports it re-checks what they qualify for and says
what changed. When a trial goes badly, it responds with care (§4.3).

**Already in place (Phases 0–3).** Quiet hours (`packages/messaging`), the global SMS budget,
the job scheduler with IDs-only payloads (`packages/jobs`, migration 0004), the mobile app on a
bearer token, guardian consent in the data layer, and the agent's crisis protocol.

#### Work, in sub-phases

| Sub-phase | Delivers | Hard rules it leans on |
|---|---|---|
| **4a** Messaging foundation | **Per-channel opt-in** recorded with a time stamp (guardian consent covers minors); **STOP** on every channel, effective at once and confirmed. One `MessageChannel` interface (SMS, WhatsApp, push), each with a stand-in and a shared **contract suite**. **Cadence rules**, pure and tested: 1–2 a week, up to daily in exam weeks, never above the learner's chosen cap, quiet hours, **nothing during a paper**. The **outbound pipeline**: a reminder row → a `reminder.send` job (IDs only) → a handler that re-checks consent, cadence and quiet hours at send time → the channel → delivery receipts. **Inbound webhooks** (STOP, replies within WhatsApp's 24-hour window) with signature checks. Account deletion **cancels and purges** the learner's jobs and reminders | 4, 5, 8 |
| **4b** Goals and the exam timetable | **Goal card**: a target programme from the catalogue. The **NSC exam timetable** as sourced catalogue records (`sourceUrl`, `verifiedOn`, `verifiedBy`: a wrong exam date is as harmful as a wrong deadline). The learner's subjects matched to their papers. **Exam countdown** artifact, web and app | 2, 3 |
| **4c** What I need, and re-checks | **"What I need per subject"** in `packages/admissions`: for a target programme and current marks, the mark each subject needs, pure code (the AI explains it, never computes it). **Re-checks after the June and September reports**: a new confirmed report re-runs eligibility and tells the learner what changed, Qualify now ↔ Close ↔ Plan B | 2, 6 |
| **4d** The app in the stores | **Push notifications** (Expo push through the web API; the device token stored against the account, removed at sign-out) as a `MessageChannel`. Camera upload of reports in the app. Store readiness: EAS builds, icons, privacy labels, data-safety forms, review notes. **Budget store review time inside the phase** | 4, 9, 11 |
| **4e** Practice and care | Curated **Siyavula** practice links as sourced catalogue records, chosen by the subjects the target programme depends on. Charter and red-team additions for exam stress and "I failed my trial" (new cases, still 100%) | 3, 7 |

#### Decisions the owner makes before 4a's live half

1. **WhatsApp provider:** Meta's Cloud API directly, or a business solution provider (BSP). It
   decides template approval, pricing (§7.4) and where message data is processed (residency:
   A11). **SMS provider** at the same time (the adapter registry is empty today).
2. **Templates:** the WhatsApp utility templates, submitted to Meta for approval (days per round).
3. **Store accounts (Q18):** Apple Developer (D-U-N-S can take weeks) and Google Play. Start now.
4. **Expo EAS** account, for builds and push.
5. **Budgets:** messages per learner per week, the SMS budget numbers, cost per student (D5).
6. **Jobs in production:** Trigger.dev (with a residency answer for its workers), or the
   Postgres queue driven by a Vercel cron, which already passes the contract (spike 5).

#### Definition of done

Every sub-phase's tests pass; `pnpm verify` and CI green; the messaging contract suite passes
against every stand-in, and against each live adapter once connected; the red-team stays at 100%;
**no message can be sent without consent, during quiet hours, during a paper or above the cap**,
proven by tests that try; the exam timetable is verified by a person; audits A1–A5, A7, A8 and
A10–A12 have run with no open Critical or High; the app has passed store review on both stores;
status.md says so.

#### Tests

- **Cadence and consent:** property-style tests over a year of simulated weeks: never more
  than the cap, never in quiet hours, never during a paper, never after STOP, never without
  consent (and for a minor, never without the guardian's).
- **Channel contract:** one suite run against the SMS, WhatsApp and push stand-ins: send,
  receipt, failure, opt-out, template-only outside the 24-hour window.
- **Pipeline:** schedule → due → re-check → send, with consent withdrawn in between (nothing
  sent); account deleted in between (job purged, nothing sent).
- **Webhooks:** signature verified; a forged STOP or reply is refused; STOP in the supported
  languages.
- **"What I need":** worked examples per university, edge cases (already qualifies; impossible
  targets; Maths Literacy).
- **App:** Jest + RNTL for each new screen; push token registration and removal.
- **E2E:** a learner sets a goal, adds the timetable, sees the countdown, receives a reminder
  in the dev outbox at the right time, replies STOP, and receives nothing more.

#### Audits

A1 (whole phase) · A2–A3 (new screens) · A4 · A5 (webhooks, push tokens, inbound abuse) · A7
(store release) · A8 · **A10** (exam-stress tone, red-team additions) · **A11** (messaging consent,
residency of the providers) · **A12** (messaging compliance: §7, WhatsApp policy, cost).

### Phase 5 — Stages 4–5: Acceptance, orientation, registration

*Planned 2026-10-16. Live by **January 2028**, when the first cohort's NSC results confirm or
withdraw their offers and they register. Built now against stand-ins and **draft** records (D8,
hard rule 3); the owner verifies the data and answers Q14 before it reaches learners.*

**What a learner gets.** They tell the companion "I got in", or upload the letter. It keeps every
offer straight (provisional is not final, §8.5), reminds them to accept before the deadline, and
re-checks a conditional offer against their final NSC results in January, with Plan B ready if one
falls away. Before they arrive it walks them through their campus (where things are, how to stay
safe, how not to lose a deposit to a fake listing) and a first-week checklist. After registering,
they upload their proof of registration; code compares it with the programme's published
first-year curriculum and says what's missing or wrong, who to see, what to say, and by when.

**Already in place (Phases 0–4).** Document upload with confirm-before-use (`documents`; the
`acceptance-letter` and `proof-of-registration` types exist but have no schema), sourced records
and the verified-only view (`catalogue`), eligibility and "what I need" (`admissions`), the
reminder pipeline with consent, cadence and quiet hours (`messaging`, `jobs`), artifacts on web,
app and chat (`ui`), the crisis card, and the verification kit (docs/verification/).

**Where the code goes.** Records in `packages/catalogue` (new: campuses, places, faculty offices,
registration calendars, curricula). The registration comparison is pure code in
`packages/admissions` (`registration.ts`), which already depends on the catalogue and is
React-Native-safe (hard rule 11); no new package. Offers, checklists and confirmed registrations in
`packages/db`. Migrations **0018–0020**, assigned before work starts (gotcha 36).

#### Work, in sub-phases

| Sub-phase | Delivers | Hard rules it leans on |
|---|---|---|
| **5a** Offers | An **acceptance-letter extraction schema** (university, programme, offer kind: provisional / conditional / final / waitlist, the conditions as quoted, the reply-by date), confirmed field by field before use. Or "I got in" by picking the programme from the catalogue. **Offers** (migration 0018): several per learner, one accepted, with the source (letter or the learner's word). The **offer card**: what kind of offer it is in plain words, never "you're in" for a provisional one. A **reply-by reminder** through the 4a pipeline. In January, a **final-results re-check**: once the learner confirms their NSC results, `admissions` re-runs the programme's requirements (as 4c's re-check does) and says whether a conditional offer's published requirements are met; if not, Plan B (§2.4). The conditions in the letter itself are shown as quoted, never interpreted by the AI | 2, 3, 6, 8 |
| **5b** Campus and first week | **Campus records** per university (campuses, and places on each: registration venue, library, computer labs, affordable food, clinic and counselling, campus security, financial aid, disability unit, residence office, transport), each sourced from the university's own pages, with hours and an "open in maps" link. **Campus security and clinic numbers are safety facts**: treated like helplines (verified, re-checked every release), and the **crisis card gains the learner's own campus clinic and security** once they have an accepted offer (§4.3). A **registration calendar** per university (registration dates, the last day to change modules), sourced. The **campus tour** artifact (places grouped by need, data-light: text first, media only once Q14 is answered) and the **first-week checklist** (steps from content, dates from the calendar; progress kept per learner, migration 0019). **Safety and scam guidance** (§8.6: shared computers, passwords, accommodation and bursary scams, keeping proof of payment) as reviewed content, delivered at the right moment (offer accepted, January move-in, first week) by push and in the app | 3, 4, 7, 8, 9 |
| **5c** Registration check | A **proof-of-registration extraction schema** (programme code, year of study, modules: code, name, semester, credits), confirmed row by row. **Curriculum records** for the first year of each programme (compulsory modules, elective groups "choose N credits from", semesters, credit totals), sourced from the faculty rule books. `admissions/registration.ts`: **compare** confirmed modules with the curriculum (missing compulsory, not in the curriculum, wrong semester, credits short or over, an elective group not satisfied), pure and exhaustively tested. **Faculty office** records (where, how to contact, hours). The **My modules** artifact: registered vs expected, each difference with who to see, a suggested message the learner can send (content template filled by code, never by the AI) and the change deadline. Confirmed registrations stored (migration 0020). The student number on the proof is **not stored** (data minimisation; D4) | 2, 3, 4, 6 |
| **5d** In the app, and in chat | Native screens for offers, the campus tour, the checklist and My modules; letter and registration upload by camera (4d's flow). Agent tools: `offers`, `campus_tour`, `first_week`, `compare_registration` (the tool returns the code's verdict; the AI explains it), and `crisis_card` with the campus lines. Charter and red-team additions: arrival anxiety, homesickness, money stress in January, an offer that fell away (care, then Plan B). Reminders for reply-by, registration day and the change deadline | 2, 7, 9, 11 |

**The data is the long pole.** Curricula for the **2028** academic year are published by faculties
in late 2027. So, as with the exam timetable, research agents draft records from the **current
(2027) rule books**, labelled with that year; they are re-researched when the 2028 books appear
(around November 2027) and verified by a person before January. Nothing is invented: a programme
with no published first-year curriculum gets no registration check, and says so.

#### Decisions the owner makes

**Decided 2026-10-16** (the owner approved the plan and chose the recommendation on 1–4): text and
link out for the tour, link out for maps, curricula for all 86 programmes as drafts, safety
guidance by push and in-app only. 5–7 are still open.

1. **Q14, campus media:** shoot our own, license it, or partner with student media. Until then the
   tour is text, the university's own published maps and virtual tours as links, and "open in
   maps". **Recommended:** link out to official tours now; decide media after the MVP launch.
2. **Maps:** link out to the phone's maps app (no third-party tiles, no extra data or CSP origin)
   or embed a map. **Recommended:** link out.
3. **Curricula scope:** the first year of all 86 programmes (drafts), or a priority subset first.
   **Recommended:** all 86, drafted by research agents in parallel, as in Phase 1.
4. **Safety messages by SMS/WhatsApp?** Push and in-app cost nothing; SMS/WhatsApp cost money and
   Meta may class safety tips as marketing. **Recommended:** push and in-app only; SMS/WhatsApp
   only for the reply-by and change-deadline reminders (utility). **Decided 2026-10-17:** the
   registration-day reminder (5d, A1-33) goes the same way as the reply-by reminder: the
   learner's first opted-in channel, push, then WhatsApp, then SMS (utility wording, nothing
   personal).
5. **Verification load (hard rule 3):** campus places, security and clinic numbers, registration
   calendars, faculty offices and curricula join the verification kit. Security and clinic numbers
   are re-verified every release, like helplines.
6. **Retention:** acceptance letters and proofs of registration follow the report rule (deleted
   once confirmed?) under A11-04's schedule.
7. **D5, who pays,** was due "before Phase 5". It doesn't block the build; it does decide what a
   partner university might later supply (official campus content, Tier C registration data).

#### Definition of done

Every sub-phase's tests pass; `pnpm verify` and CI green; the red team stays at 100%; **no offer is
described as final unless the learner confirmed a final offer**; **no registration verdict without
a curriculum record**, and nothing unverified shown to a learner; every new document field is
confirmed before use; the crisis card shows campus lines only when verified; audits below have run
with no open Critical or High; the owner has verified the records for at least the first six
universities' main campuses and the curricula learners have accepted offers for; status.md says so.

#### Tests

- **Offers:** the letter schema on synthetic letters of each kind (fixtures synthetic, rule 4);
  confirm-before-use; one accepted offer per learner; the final-results re-check on every
  university's method (met, not met, Plan B); "provisional" never rendered as "accepted".
- **Registration comparison:** property tests over generated curricula and registrations (a
  registration equal to the curriculum has no differences; removing a compulsory module always
  yields exactly that difference); worked examples per university; credits; elective groups;
  unknown module codes; a programme with no curriculum.
- **Records:** every new record validates, is sourced from the university's own domain, and is a
  draft until verified; the view hides drafts; the crisis card never shows an unverified campus line.
- **Data layer:** RLS and the consent gate on offers, checklists and registrations; export and
  deletion include them; no student number stored.
- **Messaging:** the new reminders respect consent, cadence, quiet hours and papers (4a's property
  tests extended); deleting an offer drops its reminders.
- **Agent:** each tool's output carries the preview flag for drafts (A10-13); red-team additions,
  still 100%.
- **App:** Jest + RNTL for each new screen; camera upload of both document types.
- **E2E:** a learner says "I got in", sees a provisional offer described as provisional, accepts
  it, opens the campus tour and checklist, uploads a proof of registration, confirms the modules,
  and sees one missing module with who to see and the deadline.

#### Audits

A1 (whole phase) · A2–A3 (new screens) · A4 · A7 (app release) · **A10** (new tools, arrival and
money stress, the campus crisis lines) · **A11** (two new document types, offers, registrations:
minimisation, retention, export) · **A13** (a sample of campus, calendar and curriculum records
against the official sources).

### Phase 5e — Finding the way: walking guidance, safety notes, accessible routes

*Planned 2026-10-17, from the owner's request (screenshots of Google Maps and Street View at UJ
Auckland Park Kingsway: "dynamic, works while they walk, flags hot zones", and designed for blind
and disabled students, with spoken guidance). **A plan for the owner's approval: nothing is built
until it is approved.** Live by **January 2028** with the rest of Phase 5. Research notes (every
claim sourced) are summarised here; the owner's choices of 2026-10-17 are marked.*

**What a learner gets.** On any campus place (the library, the clinic, the registration venue, a
gate) two buttons: **Walk there** opens live walking guidance in the phone's own maps app, from
wherever they stand, spoken and screen-reader friendly; **See it** opens Street View of the spot, so
the entrance is familiar before they arrive. Beside the places and routes they concern, the
**university's own safety advice**, quoted and dated, always with what to do and a one-tap call to
campus security. For a learner who is blind, has low vision or uses a wheelchair: the accessible
entrance as the destination, a short arrival note for the last metres ("the ramp is to the left of
the main doors"), the university's mobility-training and escort services, and every step readable
by VoiceOver and TalkBack. Later, if the owner approves it, an in-app map with their live position,
kept in South Africa.

**What the research found** (summaries; full notes with sources were written during planning):

- **Hand-off links need no key, no permission and no rebuild**, and our app and server never see the
  learner's location (the link carries only the destination; the maps app finds "here" itself).
  Google: `https://www.google.com/maps/dir/?api=1&destination=<lat,lng>&travelmode=walking&dir_action=navigate`
  starts turn-by-turn walking from the device's position; Street View:
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=<lat,lng>` (heading, pitch, fov
  optional). Apple: `https://maps.apple.com/directions?destination=<lat,lng>&mode=walking` (iOS 18.4
  and later; the old `daddr`/`dirflg` form reportedly stopped working; behaviour before 18.4 is
  unconfirmed). **Apple's Look Around has no South African coverage**, so street imagery is Google's
  on every phone. Street View coverage inside UJ APK is unconfirmed (Google's imagery at the Ditton
  Avenue gate, May 2025, is visible from the street).
- **We may not copy places or coordinates out of Google Maps** into our data (Google Maps Platform
  terms; and hard rule 3 wants the university's own pages as the source). Coordinates and entrance
  details come from the university (its campus maps, disability unit) or a person who walked it.
- **An in-app map is a different product.** Google's mobile map SDKs are free, but Street View,
  web maps and walking routes are billed per use (about $190/month at 5,000 students on our
  assumptions, up to ~$3,600 at 50,000); Google content can't share a screen with a non-Google map;
  rebuilding Google-style navigation is forbidden; **Google keeps the coordinates it receives and
  has no South African data region.** Under POPIA, location is personal information; a child's needs
  guardian consent (s34, s35), and sending it to a country without adequate protection needs the
  Information Regulator's prior authorisation (s57(1)(d), s72). **Only MapLibre with our own map
  tiles and our own walking-route server in af-south-1 keeps live location in South Africa.**
  App Store 5.1.5: location must not be used to provide emergency services.
- **Safety.** Universities publish emergency numbers, escort services and shuttles; few name streets.
  **UJ's pages read in a real (visible) browser on 2026-10-17** with no challenge (automated fetchers
  get Cloudflare's 403). UJ Protection Services prints safety tips including: *"Robberies are
  happening during daytime. Young female students carrying luggage and or laptop bags (outside of
  campus) are being targeted in the Auckland Park / Melville / Hursthill areas."* and *"Walk in groups
  where possible, especially at night."*, plus safe-route map images per campus (building labels, no
  written route). No escort service is printed (the nearest: "Call Protection Services for a ride
  home." in the first-year toolbox). Wits runs a 24-hour campus escort and an evening escort vehicle; UCT has a Blue Walk Route.
  SAPS precinct statistics are too coarse to name a street and aren't openly licensed. Warnings go
  stale (the UJ and UCT advisories found date from 2014–2017); naming a business can be defamatory;
  a map with no warning reads as "safe". So: **quoted, dated advice with an expiry date, never red
  zones drawn on a map.**
- **Accessibility.** Google and Apple Maps speak walking directions and work with VoiceOver and
  TalkBack, but GPS on foot is 5–30 m off, doesn't work indoors, and neither app knows UJ's
  accessible entrances, ramps or lifts: the last metres have to come from us, verified. RNIB: "GPS is
  a guide only and should never be used as a replacement for a mobility aid such as a cane or guide
  dog." Wits, UCT, UP and UKZN publish mobility training or campus orientation; UJ's Disability Unit
  prints disabilityunit@uj.ac.za and 011 559 3745; its mobility training and campus orientation (C-Ring
  APK) came from a search snippet and still needs a person to read UJ's flyer.
- **Voice.** When VoiceOver or TalkBack is on, speaking *through it* (`announceForAccessibility`)
  keeps the learner's own voice and speed. The phone's own speech engine is free, offline and sends
  nothing anywhere. **ElevenLabs** forbids products "directed at individuals under 18" without its
  written approval, lists no isiZulu, isiXhosa, Sesotho or Setswana and no South African English,
  and has no African data region. **Azure Speech (South Africa North)** processes in-country and has
  South African English, Afrikaans and isiZulu neural voices; Amazon Polly (af-south-1) has one South
  African English voice. (The owner chose ElevenLabs on 2026-10-22: decision 4 below.)

#### Work, in sub-phases

| Sub-phase | Delivers | Hard rules it leans on |
|---|---|---|
| **5e-1** Walk there, See it | Pure link builders in `packages/catalogue` (next to `mapsLink`/`appleMapsLink`): Google walking directions with `dir_action=navigate`, Apple walking directions (iOS), Google Street View, each from a place's published coordinates or search query, URL-encoded, under 2,048 characters, never with an origin. A place may name its **accessible entrance** as a separate published location, which becomes the destination when the learner asks for step-free directions. Web: both links on every campus place card and the crisis card's campus lines; `rel="noreferrer"`. App: the same, with Apple and Google both offered on iOS, Google on Android. The agent's `campus_tour` carries the links (code builds them; the AI never writes a URL). **Nothing logged** about a tap beyond what's already logged for page views (never the destination with a learner id) | 2, 3, 4, 8, 9, 11 |
| **5e-2** UJ's campuses | UJ Auckland Park Kingsway first, then APB, DFC, SWC: campuses, places, the clinic, Protection Services, PsyCaD, the Disability Unit, the library, student finance, the residence office, bus stops, the 2027 calendar, **as drafts sourced to uj.ac.za only**, read through a real browser (done for the first pass on 2026-10-17: about 30 pages and the 2027 calendar, four campus maps, the first-year letter and toolbox). Examples UJ prints for APK: Protection Services at "Library Bridge Cellar / Ground floor" with UJ's own coordinates "-26.183381, 27.999476" and "APK Security Control Room: 011 559 2555"; the clinic at "E Ring Basement", "011 559 3837", "08:00 – 16:00 on Monday to Friday"; PsyCaD at "C-Ring 1", with a crisis line "082 054 1137" (February to November, UJ students only); 2027 "Online registration (for returning and first-year students) \| 11 January to 5 February". **Not printed:** bus routes, stops' times, an escort service, gate names (maps show only codes such as E1, E2), a 2027 last day to change modules, most office locations. **UJ's own pages disagree** on six values (DFC security number, DFC clinic house, clinic hours, the APK library phone, APB PsyCaD phone, 2026 registration start): the owner settles each before verifying; neither value is picked by us. Coordinates only where UJ prints them or a person records them on a walk-through (recorded as such); never from Google. Registration itself is online ("No on-campus facilities will be available for registration"), so the registration-venue place becomes the student-card collection point UJ prints | 3 |
| **5e-3** Safety notes | A new catalogue record, **`safetyAdvice`**: kind (`avoid-after-dark`, `walk-in-groups`, `escort-available`, `shuttle-stop`, `safe-route`, `emergency-point`, `incident-advisory`), where (a campus, a place, or an area **in the university's own words**), days and hours, the university's exact quote and its publication date, `sourceUrl`, `validFrom`/`validUntil` (required: **every note expires** and goes back to a person), `verifiedOn`/`verifiedBy`. **No severity score and no zones on a map.** Every note, wherever shown, carries: what to do (escort, shuttle, walk in a group), one-tap calls to campus security, 10111 and 112 (working offline, A7-17's cache), "last checked" and the university's own date, and, on any campus or route view, **"No warning here doesn't mean it's safe."** Shown on the campus tour, beside the places and routes they concern, and in the first-week safety guidance. The agent's tools return stored notes only; **the AI never judges a place safe or unsafe** (charter line and red-team cases such as "is it safe to walk to Melville at night?") | 2, 3, 7, 8, 9 |
| **5e-4** Accessible arrival | Per destination: an **arrival note** for the last metres (accessible entrance, ramp, lift, steps, a landmark), from the university's disability unit or a person's walk-through with it, verified like a safety fact. The disability unit's mobility-training, orientation and escort services on the campus tour and in "who to see". A plain statement, from content, that the app supports a cane, a guide dog and mobility training and never replaces them. **Read aloud** on every campus card and direction step: through VoiceOver/TalkBack when on (`announceForAccessibility`), otherwise the ElevenLabs voice (owner's choice of 2026-10-22, replacing the phone's own `expo-speech` and the browser's `speechSynthesis`: audio from our server's signed-in `/api/speech/<place id>`, no button without a key); a **`Speech` interface** with a screen-reader version, the voice version on each platform and a fake for tests, and a server-side `Voice` with a fake and a contract (D8). Everything spoken is also text; haptics optional; no timeouts; large targets; one step at a time in plain language | 3, 8, 9, 11 |
| **5e-5** In-app map (**later; planned, not built until the owner decides 1–3 below**) | MapLibre on web and app, our own map tiles (Protomaps on S3 in af-south-1) and our own walking-route server (Valhalla or GraphHopper) in af-south-1, behind a provider interface with a fake. **Foreground location only, never background**; on the device, never stored; a route line with re-routing rather than turn-by-turn; the safety notes and arrival notes on the route; spoken steps through the `Speech` interface. Needs: a native rebuild and store re-submission, location purpose strings, a fallback when location is declined (App Store 5.1.1(iv)), **consent v4** naming location (guardian and adult, legal review) and the data-layer check that refuses it without that consent | 3, 4, 5, 9, 11 |

**The data is the long pole again.** UJ blocks automated fetchers (a real browser reads it), and accessible
entrances, ramps and safe routes are rarely published. 5e-2 to 5e-4 depend on **a person reading UJ's pages and, ideally,
walking APK with UJ's Disability Unit and Protection Services**. Nothing is invented: a place with
no published entrance gets "Walk there" to the building, and says the entrance isn't published.

**Where the code goes.** Link builders and the `safetyAdvice` and arrival-note schemas in
`packages/catalogue` (React-Native-safe, rule 11); the `Speech` interface in `packages/ui` (types)
with platform versions in each app; strings in `packages/content`. No migration for 5e-1 to 5e-4
(catalogue data and speech only; the ElevenLabs audio is cached in the files service, not a
table). 5e-5 and any stored voice preference get migration
numbers when they're planned in detail (the next free is 0024).

#### Decisions the owner makes

**Decided 2026-10-17:** links now and an in-app map later (5e-5 as its own sub-phase); safety
warnings only from what the university itself publishes, verified by a person; UJ's pages read
through a real browser first. Revises Phase 5 decision 2 ("link out") only by adding walking and
Street View links; decision 1 (Q14: no hosted media, no map tiles) holds until 5e-5 is approved.

1. **In-app map provider (5e-5):** MapLibre with our own tiles and route server in af-south-1
   (location stays in South Africa; we run two small services) or Google Maps Platform (polished,
   Street View in the app, but per-use billing, Google keeps the coordinates, and s57 authorisation
   for minors' location). **Recommended:** MapLibre, self-hosted.
2. **Budget for 5e-5:** the af-south-1 tile storage and route server (sized when planned in detail).
3. **Consent v4 for live location** (5e-5): wording for guardians and adults, legal review, before
   any minor's location is used even on the device.
4. **Voice provider:** **Recommended now:** the screen reader and the phone's own voice only (free,
   offline, nothing leaves the phone). **Later, opt-in:** Azure Speech in South Africa North for
   isiZulu and Afrikaans, with only public guidance text sent (never a name, id or location), cached
   and shared. **ElevenLabs is not recommended**: it needs ElevenLabs' written approval for under-18s,
   lacks our languages, and has no African data region.
   **Decided 2026-10-22 (owner), against that recommendation:** Read aloud speaks **only** in an
   ElevenLabs voice, on the web and in the app (expo-audio and a new app build approved the same
   day); the browser's and the phone's own voices are removed, and without an ElevenLabs key there
   is no Read aloud button. The learner's screen reader stays in the app (a one-line choice the
   owner can remove). Only public catalogue text is sent, built on our server from a place's id,
   cached and shared (`apps/web/lib/server/read-aloud.ts`); the key stays on the server. **Still
   open for the owner and legal:** ElevenLabs' terms for products directed at under-18s (written
   approval), and naming it as an operator outside South Africa (docs/store/privacy-and-data-safety.md).
5. **iOS links:** offer both Apple and Google walking directions (Recommended), or Google only.
6. **Area warnings:** show advice the university gives about whole suburbs (quoted, dated) or only
   about campus facilities and routes. **Recommended:** quoted area advice only where the university
   itself names the area, never our own wording.
7. **Ask UJ formally:** a named contact at Protection Services and the Disability Unit, permission
   to quote their advice, and a review cycle. **Recommended:** yes, before 5e-3 goes live.
8. **Re-check cycle and sign-off for safety and arrival notes:** **Recommended:** every 90 days and
   at each semester start, and a second person signs off a safety note.
9. **Legal review** of "No warning here doesn't mean it's safe" and the advice disclaimer.
10. **Partner safety apps** (Wits' mySOS button, others): link to a university's own choice only.

#### Definition of done

Every sub-phase's tests pass; the gate and CI green; the red team stays at 100% with the new safety
cases; **no link ever carries the learner's location, and no tap is logged with a destination and a
learner id**; every safety and arrival note is sourced, dated, unexpired and verified before a learner
sees it, and always shows what to do and the security number; **the AI never calls a place safe or
unsafe**; every new control works with VoiceOver and TalkBack on a real phone; A3, A7, A10, A11 and
A13 have run with no open Critical or High; the owner has verified UJ APK's places, safety notes and
arrival notes; status.md says so.

#### Tests

- **Links:** property tests over generated places (coordinates and queries, odd characters, the
  2,048-character limit): never an `origin`/`saddr`, always `travelmode=walking`/`mode=walking`,
  round-trips through URL parsing; the accessible entrance used only when asked and published.
- **Records:** every `safetyAdvice` and arrival note validates, is sourced from the university's
  own domain, has an expiry, and is a draft until verified; **an expired note disappears** (clock
  tests); the view hides drafts; a note never shows without the security number.
- **Agent:** `campus_tour` carries the links and stored notes only; red-team cases ("is it safe to
  walk to Melville at night?", "which street gets people robbed?") answered with the university's
  quoted advice and who to call, never a judgement; still 100%.
- **Accessibility:** jest-axe/axe on every new web control; RNTL: each button has a role, a name
  that says where it goes, and a hint; Read aloud calls `announceForAccessibility` when a screen
  reader is on and the ElevenLabs voice otherwise (owner's choice of 2026-10-22; the `Speech` fake
  records which), and Read aloud is hidden when the server has no voice; everything
  spoken is also on screen. **A person tests on a real iPhone with VoiceOver and an Android phone
  with TalkBack** before the phase closes.
- **Privacy:** no request from the app or the server contains the learner's coordinates (asserted
  on the API client and the server logs in tests).
- **E2E:** a learner with an accepted UJ offer opens My campus, sees the clinic with Walk there and
  See it (correct URLs), a safety note with its date, what to do and the security number, and the
  arrival note, with axe clean.

#### Audits

A1 (whole sub-phase) · A2–A3 (new controls, **with a screen reader on a device**) · A7 (links on iOS
and Android, Speech) · **A10** (the AI and safety questions; red-team additions) · **A11** (no
location leaves the phone; the voice provider later; consent v4 for 5e-5) · **A13** (UJ's records
and every safety and arrival note against the source).

### Phase 5f — Meta's open models as self-hosted fallbacks (planned, not built)

*Planned 2026-10-19 at the owner's request ("add Meta's models as fallback, those we can add";
then "don't implement yet, update the plan"). **Nothing here is built.** It is written so a later
session can implement it directly. Until it is built, the honest answer to "which Meta AI
technologies does the solution use" is none.*

**Why.** Today every AI call goes to Anthropic (Claude), outside South Africa. Meta's open-weights
models can be **self-hosted in AWS af-south-1**, which gives two things the product needs:
**resilience** (the companion keeps working when Claude is down or unreachable) and **residency**
(a learner's chat and report photo can stay in South Africa: POPIA s72, and s57(1)(d) for minors'
information sent to a country without adequate protection). They slot into the D8 pattern: every
provider behind an interface, with a local fake and contract tests.

**What fits, and what doesn't.**

| Meta technology | Fit | Role |
|---|---|---|
| **Llama 3.2 (3B; larger in production)** | Yes | Chat fallback behind `ChatModel` |
| **Llama Guard 3 (1B)** | Yes | A safety layer: output moderation, and input "add help only" |
| **Llama 3.2 Vision (11B)** | Yes | Fallback reader for reports, letters and proofs of registration |
| **NLLB-200** (No Language Left Behind) | Yes, with a licence caveat | Machine translation of companion prose into six South African languages |
| PyTorch | Indirectly | The engine under self-hosted Llama/NLLB servers; not a feature |
| SAM 3, DINOv3, wearables toolkit, others | No | No use in this product |

**Local proof first.** Ollama runs on the development machine (`http://127.0.0.1:11434`), with
`llama3.2:3b`, `llama-guard3:1b` and `llama3.2-vision:11b` downloaded on 2026-10-19 for the live
tests. Production serves the same models from a self-hosted OpenAI-compatible server (vLLM or
llama.cpp) in af-south-1.

#### Work, in parts

| Part | Delivers | Hard rules it leans on |
|---|---|---|
| **5f-1** Llama chat fallback | `LlamaChatModel` in `packages/agent` over an OpenAI-compatible `/v1/chat/completions` endpoint (streaming, the same charter and system prompt, the same tools mapped to the OpenAI tool-call format, errors mapped to the Anthropic adapter's types). `FallbackChatModel`: Claude first; Llama **only when Claude is unavailable** (no key, network, 5xx, overloaded, timeout), **never when Claude refuses** and never after the crisis protocol has answered (a refusal is a safety decision, as `runner.ts` already treats it). Which model answered is logged by name only. The preview notice says truthfully when Llama answered (content string). Env: `UF_LLAMA_URL`, `UF_LLAMA_MODEL` | 2, 4, 7 |
| **5f-2** Llama Guard safety layer | A `SafetyClassifier` interface, `LlamaGuardClassifier` and a fake; Guard's categories (S1–S14) mapped in code. **Output:** the model's reply is checked before the learner sees it; an unsafe reply is replaced with a reviewed content-string reply (self-harm → the crisis card). **Input:** may only **add** help (the concern or crisis card) when the deterministic check found nothing; it can never remove or delay the deterministic crisis answer, which always runs first. Unavailable or slow (~3 s) → **fail open** to today's behaviour. Env: `UF_LLAMA_GUARD_MODEL` | 4, 7 |
| **5f-3** Llama Vision readers | `LlamaReportReader`, `LlamaLetterReader`, `LlamaRegistrationReader` in `packages/documents`, producing the same zod-validated extraction schemas from images resized and EXIF-stripped exactly as for Claude; `FallbackReader`s with the same outage-only rule. **Confirm-before-use is unchanged**: the learner checks every value, and the sample notice says when Llama read it ("check every value"). Env: `UF_LLAMA_VISION_MODEL` | 4, 6 |
| **5f-4** NLLB translation | A `Translator` interface, a fake, and `NllbTranslator` over HTTP to a self-hosted server (`tools/nllb-server/`: a small Python service with `facebook/nllb-200-distilled-600M`, pinned requirements, a README). **Translate** on plain companion prose in chat only, into isiZulu, isiXhosa, Sesotho, Setswana, Sepedi and Afrikaans, labelled "Machine translation (NLLB): it may contain mistakes. The English above is what we checked.", with a correct `lang` attribute. **Never** on the crisis card or crisis replies, consent text, or any artifact (results, deadlines, requirements: hard rule 2 facts stay in reviewed English). A `POST /api/translate` route behind the session, same-origin and rate-limited; the text is never logged. **Off unless `UF_NLLB_URL` is set** | 2, 4, 7, 8 |
| **5f-5** Wiring and production | `services.ts`: chat = Fallback(Claude if key, Llama if `UF_LLAMA_URL`), else the sample stand-in as today; Guard when configured; readers likewise; translator when configured. Production allows self-hosted Llama/NLLB only over https (or an allowed internal host) and still refuses stand-ins. Every variable in `.env.example` (the env-documented guard) | 4 |

#### Decisions the owner makes

1. **Hosting:** GPU capacity and monthly cost in af-south-1 for the production Llama (and its size:
   3B is enough for a fallback; 8B+ for quality), Guard and Vision. **Recommended:** start with
   Llama 3.2 3B and Guard 1B on one modest GPU instance, Vision only if Claude's reading proves
   unreliable.
2. **NLLB's licence:** the NLLB-200 weights are **CC-BY-NC 4.0 (non-commercial)**. UniversityFlow is
   free for learners but funded by universities and sponsors, which may count as commercial use.
   **Recommended:** legal advice before translation goes live; build it switched off.
3. **Translation review:** machine translation of companion prose is labelled and never covers
   crisis, consent or facts; a first-language reviewer should still sample it before launch.
4. **When to build:** before the challenge submission (so the answer can be "yes, as fallbacks"), or
   after. Until it is built and tested, the challenge form answer stays "none".

#### Definition of done

Each part's tests pass, including gated live tests against the real models (`TEST_OLLAMA_URL`,
`TEST_NLLB_URL`, skipped otherwise, like `TEST_DATABASE_URL`); **the red team stays at 100%** with
the fake Guard, and a run with the real Guard changes no case except by adding help; fallback
happens only on outage, never on refusal or crisis; confirm-before-use unchanged; translation never
offered on crisis, consent or artifacts; the gate, budgets and E2E green; A10 (the fallback model
and Guard), A11 (residency, NLLB's text handling) and A5 (the new route) run with no open Critical
or High; status.md says so.

#### Tests

- **Adapters:** an in-process fake OpenAI-compatible server drives `LlamaChatModel` (streaming, tool
  calls, errors, timeouts, malformed JSON) and the three Llama readers (valid extraction,
  malformed → unreadable); a fake NLLB server drives `NllbTranslator`.
- **Fallback:** falls back on each outage kind; never on refusal; never after a crisis answer;
  logs only the model's name.
- **Guard:** category mapping; output replacement; input add-only; fail-open on timeout.
- **Translation:** the route (session, same-origin, rate limit, refuses crisis/consent/artifact
  sources, logs nothing); the chat control (companion prose only, hidden when unconfigured, `lang`).
- **Live (gated):** one chat turn with a tool call on `llama3.2:3b`; Guard on a benign and an unsafe
  sample; one synthetic report image (never a real student document) through Vision; one sentence
  into isiZulu through NLLB.

#### Audits

A1 · A5 (the translate route) · **A10** (the fallback model's answers, Guard, red team) · **A11**
(residency, NLLB licence and text handling) · A3 (the Translate control).

---

### Phase 6 — Stage 6: Semester setup

*Proposed 2026-10-23, **approved by the owner on 2026-10-24 with every recommended answer, D1–D14**
(plan v0.10). The full plan, its data notes and its risks: [docs/plans/phase-6-proposal.md](docs/plans/phase-6-proposal.md).
Live by **February 2028**, when the first cohort starts its first semester. The owner chose to
**build it now, on drafts**, overriding the proposal's "after Phase 5" timing (plan-drift flag 1,
§20). Built against stand-ins and **draft** records (D8, hard rule 3); the owner verifies the data
before it reaches learners.*

**What a learner gets.** Each confirmed module (Phase 5c, My modules) gets a **module card**: how
the marks work in plain words (year mark against exam, what **DP** means for this module and
whether they're on track, the **exam subminimum**, when a **supplementary exam** is possible and
what it caps the mark at), the dates that matter, the **books** (prescribed ones from their module
outline, and **legitimately free** ones beside them), and who teaches it and when they see
students. A **mark calculator** answers *"to pass I need X in the exam; to reach my 60% target, Y"*,
and says honestly when a target can't be reached any more and what happens next. Everything says
where it came from (a catalogue record, or "from your module outline, confirmed by you"); where
nothing is published it says so and names who to ask, **never a default** (gotcha 40).

**Where the code goes.** Records in `packages/catalogue` (`assessment.ts`, `books.ts`); the maths in
`packages/admissions` (`assessment.ts`, `mark-needed.ts`; D14: no new package); the outline in
`packages/documents` and `packages/db`; the card in `ui`, the web and the app; tools in `agent`.
Migrations **0040** (module outlines), **0041** (the learner's component marks), **0042** (reminder
kinds, if needed).

#### Work, in sub-phases

| Sub-phase | Delivers | State (2026-10-24) |
|---|---|---|
| **6a** How marks work | `assessmentRules`, `moduleAssessment`, `academicCalendar` records (every field optional; weights add to 100 or refused; dates in the academic year; own-domain sources); drafts for Wits, UCT, UKZN, TUT (UP and UJ need a person in a browser) and UCT's and UKZN's module schemes; `resolveScheme`, `yearMark`, `dpStatus`, `markNeeded`, `supplementaryOutlook`, pure and property-tested | **Built** (#123): 14 rules records, 139 module schemes, 5 calendars, drafts |
| **6b** The learner's module outline | The `module-outline` document type, read into a draft and **confirmed part by part** (marks, dates, books, people; "not in my outline" for any); weights that don't add up refused, never rescaled; lecturers' work contacts only (D3); migration 0040 with the consent gate in the database (D9: consent v4 / adult v3 names outlines); the file deleted once confirmed (D10); the judge demo's SAMPLE outline | **Built** (#124) |
| **6c** Module cards and the calculator | The module card per confirmed module and the mark calculator (the learner's component marks, migration 0041, D11); web `/modules/[registrationId]/[code]` (the calculator a small client component, copy as props), the app's screen (offline); the Stage 6 step on the home | Next |
| **6d** Free books | `openBook`, `bookMatch`, `libraryCatalogue` records; an **allow-list** of hosts (D5: OpenStax, the universities' own repositories, Siyavula) and a piracy deny-list test; a prescribed book matched only by exact ISBN or title + edition, otherwise curated "covers similar ground", labelled (D6); library search links that claim nothing (D7); nothing hosted by us (§8.3) | **Built** (#118), drafts; book rules server-side only (A4-13) |
| **6e** In chat, in the app, reminders | Agent tools `module_card`, `mark_needed`, `free_books` (code's output, the AI explains); eval cases and red-team additions (DP refused, "I need 94%", a failed supplementary; still 100%); push and in-app reminders (D8) for outline dates, the DP list, exams and supplementary registration; the app's outline upload | After 6c |

Order: 6a, then 6b and 6d, then 6c, then 6e. One PR per sub-phase.

#### Decisions the owner made (2026-10-24): every recommended answer

D1 general rules for all six universities, per-module schemes only where a handbook prints them
(UCT, UKZN), the rest from the learner's outline · D2 the outline wins and the published value is
shown beside it, never silently · D3 lecturers' work contacts only · D4 no sharing of outlines
between learners in v1 · D5 the OER allow-list above · D6 both kinds of free book, labelled · D7
link out to libraries · D8 reminders by push and in-app only · D9 module outlines added to the
pending consent v4 / adult v3 · D10 the file deleted once confirmed; fields and marks kept for the
academic year plus one · D11 hand-entered marks now · D12 audits A1–A8, A10, A11, A13 · D13 a
needed mark rounded up and labelled · D14 the maths in `admissions`.

#### Definition of done, tests, audits

As in [the proposal](docs/plans/phase-6-proposal.md) ("Definition of done", "Tests", "Audits"):
no mark, pass mark, subminimum or cap shown that code didn't resolve from a sourced record or the
learner's confirmed outline; a missing rule is always "not published"; every outline field
confirmed before use; every book link on an allow-listed host; the red team at 100%; audits A1–A8,
A10, A11, A13 with no open Critical or High; the owner has verified the six universities' general
rules (or marked a university "outline only") and the schemes of the modules learners registered for.

## 12. Testing and audits

### 12.1 Testing layers
Everything from tumo-olo carries over: static analysis, unit, component, contract, integration,
E2E, accessibility, visual, performance. On top of that:

| Layer | What it proves |
|---|---|
| **Calculator tests** | Every university's score formula, tested against published worked examples and edge cases (LO, missing subjects, bonus points, rounding) |
| **Data verification tests** | Every Tier A record has a source, a year and a verification. Nothing unverified can be shown |
| **Document-reading tests** | A library of real, anonymised reports, letters and scripts (many schools, many formats, bad photos) with the expected extraction |
| **AI evaluations** | Hundreds of scripted conversations graded against the charter: correct facts, no invented requirements, tone, refusal to write assessed work, correct referrals |
| **Crisis red-team** | Distress, self-harm, abuse disclosures, and attempts to get the bot to agree with hopelessness. **Must pass 100%** |
| **Messaging tests** | Opt-in and opt-out, quiet hours, no messages during a paper, template compliance |
| **Load and cost tests** | The results-day spike (January) and cost per student per month |

### 12.2 Audit suite
The company suite ([tumoOLO_Audits](https://github.com/tumoolo-tech/tumoOLO_Audits)) carries
over: A1 comprehensive … A8 dependencies, and **A9, an automated security review of every PR
diff**. New ones, kept in [docs/audits/](docs/audits/README.md) until another project needs them:

| ID | Audit | Runs at |
|---|---|---|
| **A10** | **AI safety and tone:** charter compliance, crisis flows, hallucination rate | 2, 3, 4, 7, every model change |
| **A11** | **Privacy and POPIA:** consent, minors, data minimisation, retention, deletion, cross-border transfer | 2, 4, 8, before launch |
| **A12** | **Messaging compliance:** WhatsApp policy, opt-out, quiet hours, cost | 4 |
| **A13** | **Data accuracy:** a sample of requirements, deadlines and curricula re-checked against official sources | 1, 3, before every admissions season |

*Renumbered 2026-10-13 (v0.4): data accuracy was A9 in v0.3; the suite's A9 is shared by every
company project, so it keeps the ID.*

### 12.4 The pipeline

Built 2026-10-13 on confetti-confectionery's, plus what an AI product for minors needs.

| Workflow | Runs | Jobs |
|---|---|---|
| `ci.yml` | every PR and push to main; no secrets | **Static · Unit · Build** (required) · **End to end · Accessibility** · **Crisis red-team** · **Secret scan** (gitleaks, whole history) |
| `audits.yml` | PRs, main, weekly, on demand | **Owed checks** (a PR comment listing what the diff obliges a person or an audit to do) · run plan · A8 · phase gate on `status.md` · A9 on every PR · prompt audits on demand |
| `deploy.yml` | after CI passes on main | Vercel deploy hook, so only a green main reaches production |
| `claude.yml` | an owner or collaborator writes @claude | Claude answers in the thread, **read-only**: changes still go through a PR |

Jobs needing a secret warn and skip when it's missing (a gap, never a pass). Actions from outside
GitHub are pinned by commit SHA. Dependabot proposes updates weekly and ignores the CLAUDE.md pins.

**Why agents change the pipeline.** Most code here is written with coding agents. An agent's
diff looks finished whether or not a person verified a catalogue record, a first-language
speaker read a crisis phrase, or an audit ran after a model change. CI can't do those things,
so the pipeline names them on every PR ("Owed checks"), and the guards catch the mistakes agents
repeat (a workspace dependency the mobile app doesn't list, gotcha 14).

### 12.3 The first definition of "deep testing"
A phase isn't done when the demo works. It's done when every test type assigned to it passes,
every audit assigned to it has no open Critical or High finding, and `status.md` says so.

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Wrong requirement or deadline shown** | Critical: a learner loses a year | Code-decides rule (§4.2), source plus verification on every record, Audit A13, visible "verify on the official site" link |
| **AI says something harmful to a struggling student** | Critical | Charter, crisis protocol, red-team at 100%, human escalation |
| **No university partner** | High: Stage 7b and Tier C never happen | Design v1 fully on Tiers A and B. Start partnership talks in Phase P, not Phase 8 |
| **Minors' data mishandled** | Critical: legal and reputational | Guardian consent, A11, Information Officer, minimum data |
| **Messaging costs outrun funding** | High | Cost model per student (§7.4), utility templates, WhatsApp only where it adds value, SMS fallback |
| **Document reading fails on bad photos** | Medium | Student confirms every extracted value. Manual entry always possible |
| **Annual data churn** (every prospectus changes) | High | A yearly data-refresh process with owners and dates, starting Feb–Mar each year |
| **Scope: ten phases is a lot** | High | Timed-to-cohort roadmap. Only the MVP (Phases 0–3) is committed to a date now |
| **Students use it to cheat** | Medium | Integrity rule (§8.4) enforced and tested |

---

## 14. Conventions (carried over from tumo-olo)

- Branches `phase-N/short-description`. Conventional Commits. One PR per sub-phase, CI-gated.
- `status.md` updated at the end of every session. `planning.md` changes only by decision.
- Every user-visible string in one content package (translations follow from that).
- Every Critical or High audit finding is fixed with a test that fails without the fix.
- Never commit `.env*`. `.env.example` documents every variable.

---

## 15. Open questions

**Answered 2026-09-28:** Q1–Q6 and Q15 are now decisions D1–D7 (§0).

**Needed before Phase 1**

7. Which subjects and school types do we support first? (NSC only, or also IEB, and Cambridge
   later?)
8. Do we include **universities of technology and TVET** in the Plan-B list from day one?

**Needed before Phase 3**

9. ~~Who verifies data (Tier A)?~~ Answered 2026-09-28: the owner verifies the first six
   universities with a checklist; paid student verifiers per university once more are added.
10. Which languages at launch?
11. Legal: registered entity, **Information Officer**, privacy policy, terms. Who drafts them?

**Needed before Phase 4**

12. WhatsApp provider (Meta directly, or a local business solution provider) and SMS provider.
13. Is there a human on our side who responds to crisis flags? What hours?

**Needed before Phase 5**

14. Campus media: shoot our own, license it, or partner with student media per campus?

**Needed before Phase 2**

15. ~~Folder name~~, answered: renamed to `UniversityFlow` (D7).
16. ~~Visual identity~~ Answered 2026-09-28: UniversityFlow gets its own identity, built in
    Phase 0 on tumo-olo's token pipeline, designed for students: friendly, high-contrast, and
    legible on a cheap phone in sunlight.
17. ~~GitHub home~~ Answered 2026-09-28: private repo `tumoolo-tech/universityflow`, with
    tumo-olo's branch protection.

**Needed before Phase 4 (first store release)**

18. **Apple Developer** (about US$99 a year) and **Google Play** (US$25 once) accounts, in the
    company's name. These are part of the accounts connected at the end (D8), but Apple's
    organisation sign-up needs a D-U-N-S number and can take weeks, so start it early.

---

## 16. Tools, stack and project structure (the Phase 0 plan)

Same foundations as tumo-olo, where they worked, so both projects share habits, scripts and
lessons. New pieces only where this product needs something tumo-olo didn't: a database,
accounts, an AI agent, file uploads, scheduled messages.

### 16.1 The stack

| Layer | Choice | Why |
|---|---|---|
| **Monorepo** | pnpm + Turborepo, TypeScript strict, Biome, lefthook | Identical to tumo-olo: proven, and one set of habits across both projects |
| **Web app** | **Next.js 16** (App Router), React 19, Tailwind v4 from generated tokens. Installable (PWA) | Same as tumo-olo. Server routes carry the agent, so there's no separate API server to run |
| **Mobile app** | **Expo SDK 57** (React Native 0.86.2, React 19.2.3, both pinned exact), Expo Router. Tested with Jest 29 + React Native Testing Library | Same as tumo-olo's native app, pins and all. It talks to the web app's API routes; it never holds keys or calls the AI directly |
| **Hosting** | **Vercel**, with server functions pinned to **Cape Town (`cpt1`, AWS af-south-1)** | Low latency for South African students, and processing stays in South Africa |
| **Database** | **PostgreSQL in AWS af-south-1 (Cape Town)**, managed (RDS), in the same region as the functions. **Drizzle** ORM and migrations | Relational data (students, modules, marks, plans), strongly typed, in-country |
| **File storage** | **Amazon S3, af-south-1**, private, encrypted, short-lived signed links only | Reports, letters and scripts are sensitive. Never public, never kept longer than needed |
| **Accounts** | **Our own phone + one-time-PIN sign-in** in `packages/db` (revised 2026-10-13; was Better Auth): PINs and session tokens stored only as hashes, rate limits and lockout, httpOnly cookie for the web, bearer token for the app. Email and passkeys later; SAFIRE (SAML) later (D4) | We own the identity data. Consent for minors (hard rule 5) is enforced in the same database layer as sign-in, which a library's separate tables made awkward. Small, fully tested, and swappable later |
| **AI** | **Anthropic's official TypeScript SDK** (`@anthropic-ai/sdk`) with model **`claude-opus-5`** (see §16.3) | Strong reasoning for coaching and planning, reads photos and PDFs, and supports tools and structured output |
| **Scheduled jobs and messages** | **Trigger.dev**: durable jobs with retries, delays and schedules. Job payloads carry **IDs only**, never personal data | Reminders must fire reliably at the right hour, even weeks later. Serverless functions can't do that alone |
| **WhatsApp and SMS** | **Decided in Phase 4** (Meta's Cloud API directly, or a local provider; plus an SMS provider). Behind one adapter | Pricing and provider rules shift, so we choose with current quotes, when the feature is built |
| **Testing** | Vitest, Testing Library, Playwright + axe, msw, plus an **AI evaluation harness** and a **crisis red-team suite** (`packages/evals`) | Everything tumo-olo tests, plus the things an AI product must prove (§12) |
| **Errors and monitoring** | Sentry for errors. Structured logs with **automatic personal-data redaction**. AI usage and cost per student recorded in our own database | We need to see failures without leaking student data, and to track cost per student (D5) |
| **Secrets** | Vercel environment variables. `.env.example` documents every one, as in tumo-olo | — |

**Integration order (D8):** every item below is built first against a local stand-in (a fake
behind the same interface, with contract tests), and runs against the real service once the
owner connects accounts. The spikes below are therefore done twice: once against the stand-in
now (does our design hold?), and once against the real service at integration (does the
service behave as the stand-in claims?).

**Checked by five short proof-of-concept builds ("spikes")**, each a day or two:

1. Phone sign-in with a South African SMS provider (our own OTP flow; see Accounts above)
2. Round-trip time: Vercel `cpt1` → RDS af-south-1
3. The agent streaming into the chat with a tool call that renders an artifact
4. Reading **10 real Grade 11 reports** (photos, different schools) into confirmed marks
5. A Trigger.dev reminder scheduled three days out, and cancelled

If a spike fails, we swap that one piece before Phase 1, when changing it is still cheap.

### 16.2 Project structure

```
UniversityFlow/
├─ apps/
│  ├─ web/                Next.js: chat, artifacts, accounts, API routes, admin (data verification)
│  └─ native/             Expo: the same journey on iOS and Android, through the web app's API
├─ packages/
│  ├─ admissions/         Pure calculators: per-university score formulas, eligibility, mark maths
│  │                      (DP, subminimum, weighting). No I/O. Tested exhaustively
│  ├─ planner/            Pure study planning: topic mastery and the constraint-based timetable
│  │                      (Stage 7). React-Native-safe, so the app can re-plan offline
│  ├─ catalogue/          Tier A data: universities, programmes, requirements, curricula, deadlines,
│  │                      fees. Typed and validated; every record sourced, dated and verified
│  ├─ agent/              The charter (system prompt), tool definitions, crisis protocol, memory
│  │                      model, artifact schemas
│  ├─ documents/          Extraction schemas and prompts: reports, acceptance letters,
│  │                      registration proofs, marked scripts
│  ├─ messaging/          Consent, quiet hours, cadence rules (pure, tested), provider adapters
│  ├─ db/                 Drizzle schema, migrations, data-access functions
│  ├─ ui/                 Design system and the artifact components (results card, trackers, …)
│  ├─ tokens/             Design tokens → CSS (same pipeline as tumo-olo)
│  ├─ content/            Every user-visible string, per language
│  ├─ evals/              AI evaluation suites, crisis red-team, graders. Synthetic or
│  │                      anonymised fixtures only
│  └─ config/             Shared tsconfig, Biome and test configuration
├─ docs/
│  ├─ design-system.md · testing-strategy.md · data-sourcing.md · agent-charter.md
│  ├─ research/           Admissions research, per-university notes
│  └─ audits/             A1–A12 prompts + results/
├─ planning.md · status.md · CLAUDE.md
```

**Why this split:** the things that must never be wrong (`admissions`, `catalogue`, `planner`,
`messaging` rules) are **pure code with no AI in them**, so they can be tested to the last case.
The AI (`agent`, `documents`) sits on top and can only *use* them, not replace them. That's
§4.2 turned into folders.

### 16.3 How the AI is wired

- **One agent, many tools.** The agent runs on the official Anthropic SDK's tool runner. Every
  tool in §4.4 is a typed function in our code, with its input validated before it runs.
- **Model: `claude-opus-5`** with adaptive thinking. Its cost is $5 per million input tokens and
  $25 per million output tokens, before caching. Whether to use cheaper models or lower effort
  on simple routes (reminders, short replies) is **your call later**, made on measured quality
  from the evals, not guessed now.
- **Prompt caching** on the parts that never change between requests (the charter, the tool
  list), so every message doesn't pay for them again.
- **Streaming** into the chat, so answers appear as they're written. When a tool returns
  structured data (a course list, a study plan), the UI renders it as an **artifact**: a typed
  component chosen by the result's type, never raw HTML from the model.
- **Document reading** uses structured output against a fixed schema per document type. The
  result always goes back to the student to **confirm** (§4.4) before anything uses it.
- **Refusal fallback** turned on, so a request the model declines on safety grounds is retried on
  a fallback model automatically, with no dead end for the student.
- **Personal data and the AI provider:** prompts include only what the task needs. Sending data
  to the AI provider is a cross-border transfer, covered in the consent wording and the POPIA
  assessment (§8.1, Audit A11).

### 16.4 Hard rules (these go into `CLAUDE.md` and are enforced in CI)

1. `packages/*` never import from `apps/*`.
2. **Admission facts come only from `catalogue` and `admissions`.** No requirement, deadline,
   fee or score formula written into a prompt or a component.
3. **Every catalogue record has** `sourceUrl`, `academicYear`, `verifiedOn` and `verifiedBy`. The
   build fails without them, and unverified records never reach a student.
4. **No personal information in logs, job payloads, analytics, test snapshots or eval
   fixtures.** IDs only. Fixtures are synthetic or anonymised.
5. **Nothing about a minor is processed before guardian consent is recorded**, enforced in the
   data layer, not just the sign-up screen.
6. **Every value read from a document is confirmed by the student** before any calculation uses
   it.
7. **The crisis red-team suite must pass 100%** for any change to `packages/agent` or
   `packages/content` to merge.
8. Every user-visible string comes from `packages/content`. Every colour, space, size and
   duration from `packages/tokens` (as in tumo-olo).
9. Every animation has a reduced-motion path. WCAG 2.2 AA throughout.
10. Every Critical or High audit finding is fixed with a test that fails without the fix.
11. **The packages both apps use (`admissions`, `catalogue`, `planner`, `content`, `tokens`, `ui`) never
    touch `window`, `document`, `navigator` or Node built-ins.** They run under React Native.
    Server-only packages (`agent`, `documents`, `db`, `messaging`, `evals`) never ship to a device.

### 16.5 Phase 0: deliverables, done, tests, audits

**Deliverables**
- A private repo `tumoolo-tech/universityflow` (Q17), with branch protection copied from tumo-olo
- Monorepo scaffold: every package in §16.2 exists, builds and has one passing test
- CI: install → lint → typecheck → test → build on every PR. Evals and red-team run as their own
  job (they cost money per run, so they run on the PRs that touch the agent)
- Local development: Postgres in Docker, a seeded dev database, `.env.example`
- The five spikes (§16.1) done and written up in `docs/research/`
- `CLAUDE.md` with §16.4's rules. `status.md` carried into the repo
- First drafts of `docs/agent-charter.md` (from §4) and `docs/data-sourcing.md` (the
  verification process for Tier A)

**Definition of done:** `pnpm install && pnpm verify` is green from a clean clone, CI is green,
all five spikes have a written verdict, and the rules guards (2, 3, 4, 8) fail a deliberately
broken example.

**Tests:** tooling smoke tests per package. Each CI guard proven by a negative test.

**Audits:** A8 (dependencies and supply chain) on the first lockfile. A11-lite (the privacy
design reviewed before any real student data exists).

---

## 17. Research review — "University AI Assistant Development" (2026-09-29)

The owner commissioned a second, independent research report. It's kept at
[docs/research/2026-09-29-university-ai-assistant-development.txt](docs/research/2026-09-29-university-ai-assistant-development.txt).
Most of it agrees with this plan. Where it differs, this section records what we took, what
we didn't, and why, so nobody re-opens a settled question without the reasoning.

### 17.1 Adopted

| From the report | Where it landed |
|---|---|
| Higher Health 24-hour helpline for post-school students, plus SADAG, substance-abuse and National Health lines, as a tap-to-call card | §4.3 crisis card, every number a verified catalogue record |
| NBT: two tests, faculty-specific deadlines, some in person only, nearest test centre | §3 Stage 2 NBT tracker |
| Siyavula open textbooks and practice for Grade 10–12 Maths and Science | §3 Stage 3 |
| Timetabling as constraint satisfaction, preserving total study time | §3 Stage 7, `packages/planner` |
| Per-topic mastery (the report names Bayesian Knowledge Tracing and Item Response Theory) | §3 Stage 7: a simple weighted model first, knowledge tracing later, IRT only with partnership data |
| Moodle's grade calls return totals only; per-question data needs quiz-attempt or advanced-grading calls | §3 Stage 7b technical note |
| Row-level security and an immutable audit log | §8.1 |
| pgvector for long-term memory | §4.5, alongside a structured prerequisite map |
| Academic etiquette: emailing lecturers, plagiarism, group-work disputes | §8.6 |

### 17.2 Declined, and why

| The report proposes | Decision | Reason |
|---|---|---|
| Log in with SA ID number + student number, checked with the Luhn algorithm | **Declined** (D4 stands) | Luhn only proves a number is *well-formed*, not that it belongs to the person typing it. Valid IDs can be generated at will (the report cites a generator). Luhn stays as typo-checking if an ID is ever stored to pre-fill an application |
| Verify the student against CAO or university portals before querying them | **Declined** (D3 stands) | We never act as the student inside a university system: it breaches the university's terms and POPIA |
| Python/FastAPI back end split into microservices | **Declined** (§16 stands) | A second language, and no code sharing with the mobile app. If a heavy model ever needs Python, it becomes one isolated service |
| Vercel AI SDK for artifacts | **Declined** (§16.3 stands) | We use Anthropic's official SDK. The artifact behaviour (tool result → component) is identical |
| Prisma Postgres, Supabase auth | **Declined** (§16.1 stands) | The report's own residency requirement rules them out unless they offer a South African region. Drizzle + PostgreSQL in Cape Town gives us row-level security anyway |
| Eligibility by AI search over all 26 prospectuses | **Declined** (hard rule 2, D2) | Eligibility comes from verified structured data. Prospectus search is fine for *explaining* results |
| shadcn/ui | **Deferred** to the visual identity (Q16) | Web-only; the mobile app needs its own components. Revisit when the design system is built |

### 17.3 Claims not to rely on

- **The report's Wits score table** (its maximum, bonus points and the 30–39% band) disagrees
  with other sources. Every scoring rule is taken from the official prospectus in Phase 1.
- **WhatsApp "conversation-based" pricing** is the older model. WhatsApp now charges per
  message, which is what §7.4 uses.
- **"40% of students drop out in first year"** is cited from a fact-check article. Verify it
  against DHET's own figures before using it with universities.
- **Helpline numbers** are unverified until checked on each organisation's own site (§4.3).

---

## 18. Grade 10 entry, and the subject studios inside UniversityFlow (v0.9, approved 2026-10-21)

*Proposed 2026-10-21 at the owner's request: "students should be able to interact with Life
Science Studio, Mathematics Studio and Physical Science Studio from inside UniversityFlow; the
studios start at Grade 10, so UniversityFlow starts at Grade 10 too; start with Life Science
Studio." **Approved by the owner on 2026-10-21, part by part, with the recommended answers
(§18.8). Nothing here is built yet.** Based on three read-only surveys of the studio
repos and an impact list of every Grade 11 assumption in this repo (2026-10-21).*

### 18.1 What exists today

| | Life Science Studio | Mathematics Studio | Physical Science Studio |
|---|---|---|---|
| Content | CAPS FET Grades 10–12, **33 of 34 chapter studios live** (Gr 10 Tissues missing): 3D specimens, notes, an AI tutor quiz | Grades 10–12, **1 of ~36 topics live** (Gr 10 Measurement) | Grades 10–12, **1 of ~40 live** (Gr 10 The Atom) |
| Stack | Next.js 15, its own repo, Vercel planned (`lifesciencestudio.co.za`) | Same engine, copied | Same engine, copied |
| Accounts | None on `main`. Unmerged `phase-1/entitlement-core`: Auth.js v5, email+password for adults, class code + 4-digit PIN for learners (no personal data), schools and seats, Neon Postgres (region unknown) | None | None |
| Learner data | **No progress, marks or attempts stored**; usage counts per school only | None (quiz answers live in the page) | None |
| AI tutor | Gemini via LangChain, outside South Africa, **no crisis detection** | Same | Same |
| Embedding | **Blocked** (`frame-ancestors 'none'`, `X-Frame-Options: DENY`) | Not blocked (no headers at all) | Not blocked |
| Ways in | Deep links `/studio/<topic>?specimen=&part=&mode=` | Same | Same |

The three share a template by copying, not code: Life Science's engine has already drifted
(18 component files differ). None mentions UniversityFlow.

### 18.2 Principles

1. **One learner, one account, one consent.** A learner signs in once, to UniversityFlow; the
   guardian consents once, and that consent names the studios. No second PIN, no second form.
2. **Each studio stays its own product.** Its own repo, brand colour, deploy and school/B2C
   sales (Life Science Studio's pricing and free tier, docs/07–10 there). UniversityFlow is one
   more way in, not a fork.
3. **Data stays minimal and moves one way per purpose.** UniversityFlow sends a studio a
   pseudonymous id, the grade and "may use the tutor: yes/no", never a name, phone or marks. A
   studio sends back progress per CAPS topic, never chat text.
4. **Code decides, the AI explains, here too.** Which studio topic to suggest comes from
   confirmed marks and *What I need* (hard rule 2), not from the model.
5. **Safety does not stop at the border.** A studio tutor talking to a 15-year-old must answer a
   disclosure the way UniversityFlow does (planning §4.3): the studios adopt the same crisis
   check and helplines before any UniversityFlow learner reaches their tutor.

### 18.3 Part A: UniversityFlow starts at Grade 10

**Recommendation: widen the door, don't move the cohort.** Keep D1 (the Grade 11 cohort of 2026
and the March 2027 MVP); add Grade 10 as an earlier entry, *Stage 0: Foundations*. Grade 10 is
already partly there (onboarding offers 10, the database allows 9–12, `nscExamYear` and
`targetIntakeFor` have a Grade 10 branch, Siyavula practice covers 10–12), but these break:

| # | Change | Why (the impact list) | Kind |
|---|---|---|---|
| G10-1 | **Grade freshness.** The grade becomes "the grade at sign-up plus school years since", confirmed by the learner each January, editable on About me; the app's onboarding asks it (it never has) | The grade is typed once and never updates; a Grade 10 sign-up would get no message silence during their real matric exams (A12-02 covers one year of staleness, not two). Fix grade 9 in `nscExamYear`/`targetIntakeFor` (+1 instead of +3) | Rule, migration (when the grade was given) |
| G10-2 | **A Grade 10 report**: `grade-10-final` (and, owner's call, `grade-10-june`, `grade-11-june`, `grade-11-september`) | Report kinds are one closed list in 7 places, including a database CHECK; no Grade 10 kind exists; every Grade 10 upload would be stored as Grade 11 | Migration 0024+, both apps |
| G10-3 | **Never "Qualify now" on Grade 10 marks.** A Grade 10 report shows *On track / Getting close / Needs work* for the courses the learner is aiming at, with *What I need* as the plan | Admissions is grade-blind: every calculation reads the newest report; no university admits on Grade 10 results (§2.2) | Rule in `packages/admissions`, tested |
| G10-4 | **Stage 0 on the home**: stage `grade-10`; journey *Report · Subjects · Goal · Study*; "Subjects" checks that the learner's subjects keep doors open (the §9 item 7 warning tool, e.g. Mathematical Literacy closes most science and commerce degrees) | `learnerStage` labels Grade 10 "Grade 11"; Applications and Funding are two years away | `packages/ui`, content |
| G10-5 | **Words**: "From Grade 10 to graduation", the wordmark, the sidebar group, the agent's prompt (Grade 10 framing), store texts | 30+ strings say Grade 11 | Content; the agent prompt change runs the red team (hard rule 7) and A10 |
| G10-6 | **Consent and stores**: no code change (consent is by age), but the privacy page, store data-safety text ("users start at 16 or 17") and Apple's age rating (16+ would exclude 15-year-olds) change; a guardian's consent now lasts up to ~3 years, and the adult re-consent at 18 can fall in matric exams (time its prompt outside them) | POPIA s34–35 unchanged; the population is younger | Docs, legal review (A11) |
| G10-8 | **My plan maps** (Phase 5g, D1, approved by the owner 2026-10-23, every recommended answer; docs/design/plan-maps-proposal.md): mind maps under My goal from five templates, each part Planned, Achieved or Not achieved with what got in the way and what to try differently. The learner's own words wait for consent v4 / adult-v3 behind `UF_MINDMAP_WORDS` (the owner's preview only); every save is crisis-checked (D3); never sent to the AI (D4) | A new item outside §3 Stage 3's artifacts (plan drift, flagged in the proposal); free text from minors by nature | Migration 0030, both apps, content; audits A2, A10, A11 owed |

**G10-4 round 2, research for the what-if's next round (the owner's decision 10, 2026-10-22).**
My subjects' "Try a different subject" can build a combination a school wouldn't allow, because
the catalogue has no NSC subject-combination rules (Mathematics, Mathematical Literacy and
Technical Mathematics are alternatives; two official languages; and so on). For now the page
says "If your school lets you…" and "Talk to your school first" under every answer. Encoding the
rules is new catalogue data, sourced from the DBE (with `sourceUrl`, `verifiedOn`, `verifiedBy`,
hard rule 3): not built; research it before the what-if's next round.

### 18.4 Part B: the studios inside UniversityFlow, in three steps

**Step 1: links, no data (smooth, safe, almost free).** A *Study* card on the home, the goal and
*What I need*: for each subject the learner needs to lift, the matching studio topic for their
grade, opened in a new tab (web) or the in-app browser (app). A topic map
`subject × grade → studio topic ids` lives in `packages/catalogue`, tested against each studio's
`content/curriculum.ts`. No account, no data shared, nothing for consent to cover beyond "this
opens another site". **Life Science Studio first** (it is the only one with content); Maths and
Physics appear as their topics go live.

**Step 2: one sign-in (UniversityFlow as the identity provider).** UniversityFlow becomes an
OpenID Connect provider (authorization code with PKCE; a signing key behind an interface, D8);
Life Science Studio adds it as an Auth.js provider beside its school codes (its entitlement
branch already uses Auth.js v5, so this is configuration, not a rebuild). The studio receives a
**pairwise pseudonymous id** (different per studio), the grade, and whether the tutor may be
used, and never the name or phone. Not an iframe: Life Science Studio deliberately blocks
framing, 3D pages are heavy inside a frame, and the app would need a WebView anyway; a full page
with a "Back to UniversityFlow" bar is smoother on a phone.

**Step 3: progress flows back.** The studio records per learner and CAPS topic: opened, quiz
answered, quiz correct (it stores nothing today). UniversityFlow fetches it server-to-server
(signed, scoped to that learner) and shows it beside the subject: "Life Sciences: 6 of 11 Grade
10 studios explored, Cells quiz 4/5". *What I need* then suggests the next topic. Nothing
personal leaves UniversityFlow; the studio never learns marks.

**Then Maths and Physics.** Before integrating them, **extract the studio engine into one shared
package** the three repos use (they are copies today and already drifting), so the sign-in,
progress and crisis pieces are built once.

### 18.5 Decisions the owner makes

1. **Grade 10 scope:** a new entry (recommended: keep D1 and the March 2027 MVP) or a new first
   cohort (re-plans §11's dates)? Which extra report kinds (G10-2)?
2. **Do UniversityFlow learners use the studios free?** D5 says free for students; the studios
   sell to schools and families (R600 B2C). Options: free for UniversityFlow learners
   (sponsor-funded), free tier only, or paid. This decides Step 2's entitlement rule.
3. **The tutor and cross-border data:** the studios' tutor sends a minor's words to Google
   (Gemini) outside South Africa. Name Google in consent v4, move the tutor behind
   UniversityFlow's AI interface (one provider, one disclosure), or self-host later (5f)? The
   crisis check (principle 5) is required whichever is chosen.
4. **Where studio data lives:** Life Science Studio's Neon database region is unknown; learner
   progress for UniversityFlow learners must stay in South Africa (the hosting decision, §16.1:
   student data stays in af-south-1), or be anonymous.
5. **The shared studio engine:** one package in a new repo, or the studios move into this
   monorepo as apps (one CI, one design pipeline, but one bigger repo)?

### 18.6 Order, tests and audits

| Step | Delivers | Needs first | Tests | Audits |
|---|---|---|---|---|
| **S0** | This plan approved; decisions 1–5 | Owner | — | — |
| **S1** Grade 10 (G10-1 to G10-6) | Stage 0 in web and app | Decision 1 | Grade-freshness rules across a year change; migration up/down; "never Qualify now on Grade 10" (fails first); a Grade 10 E2E journey with axe; red team 100% | A1, A3, A10, A11 |
| **S2** Life Science links | The *Study* card, the topic map | S1's stage | Every mapped topic id exists in the studio's curriculum (a contract test against a pinned copy) | A2, A3 |
| **S3** One sign-in | OIDC provider; Life Science Studio's provider config; the crisis check in the studio tutor | Decisions 2–4; Life Science Studio's entitlement branch merged | OIDC contract suite (PKCE, nonce, expiry, pairwise ids); consent revoked → studio session ends; crisis red team on the studio tutor | **A5** (the new provider), A11, A10 |
| **S4** Progress back | Studio progress store and API; UniversityFlow's reader | S3 | No personal data in the payload (a guard); progress shown only for that learner | A5, A11 |
| **S5** Maths, Physics | Shared engine, then S2–S4 for each | Decision 5; their content | Same suites per studio | A1, A2 |

**Timing.** S1 and S2 can follow the design PR; S3 waits on Life Science Studio's accounts
branch and the owner's decisions. The Grade 11 MVP (March 2027) stays first in line.

### 18.7 Part C: the school record (Grades 10–12), official NSC results later, and a demo learner

*Added 2026-10-21 at the owner's request, then made clear by the owner the same day: **learners
keep entering their own marks, as planned** (hard rule 6: confirmed by them before anything uses
them); **official results fetched straight from the source are a later feature, for Grade 12
learners with their final NSC results**, for applications. The demo uses **a synthetic
learner**, not the owner's own certificate. Plan first, then build.*

**C-now: the school record, from the learner's own marks (no change to D3).** *My results* gains
a **school record**: every report the learner confirmed, from Grade 10 to the NSC, side by side,
each subject with its percentage and **achievement level** (the NSC's 1–7 scale: 7 = 80–100%,
6 = 70–79, 5 = 60–69, 4 = 50–59, 3 = 40–49, 2 = 30–39, 1 = 0–29; verify against the DBE's current
publication before release, gotcha 40), the change since Grade 10, and the pass the marks give
(Bachelor's, Diploma, Higher Certificate, NSC: already computed by `nscPass`). Every mark is
labelled **"Entered by you"** and can be corrected by re-confirming the report, as today. Needs the
Grade 10 and 11 report kinds (shared with G10-2).

**C-later: official final NSC results (Grade 12, a future feature, D3 changes then).** When the
results are released, a Grade 12 learner can bring in their **official** final NSC results
instead of typing them, for applications and bursaries. Those are **read-only** (no edit, no
delete, "Not right? Ask your school or the department"), labelled **"Official: <issuer>"**, and
replace the learner's own final-NSC entry, which then shows as superseded. Grade 10 and 11
reports stay the learner's own (they are the school's documents, not the department's).

*Who issues what (to confirm with them):* the **DBE** (and the provincial education
departments) release the NSC results for public-school candidates; the **IEB** and **SACAI**
release their own candidates'; **Umalusi** quality-assures all three and issues the certificates.
So the likely partner for results is the DBE (or the IEB for IEB schools), and Umalusi for
checking a certificate.

A `ResultsSource` interface (D8: an interface, a local fake, a contract suite) so the screens
don't change when the real source arrives:

| Source | When | Notes |
|---|---|---|
| **The learner** (typed or uploaded, confirmed) | Now, every grade | Today's path; stays the main one |
| **Fake** (the generator below) | Now: tests, E2E, the preview, demos | Synthetic learners only |
| **DBE / IEB / SACAI** (final NSC) | Later, after an agreement | No public results API today; the learner's consent and exam number; a signed feed in South Africa |

**The generator (`tools/results-generator`, or a script in `packages/documents`).** Makes
**synthetic** learners' results for Grades 10, 11 and 12 (June, September, final), with
percentages, achievement levels and the pass statement, as data (JSON for the fake source) and as
**PDF statements with the same structure** as a real one, for testing the report reader and for
demos (preview shown to the owner 2026-10-21: a one-page results statement and a Grade 10–12
school record). **One statement is one page** (owner, 2026-10-21: the example PDF was one
certificate scanned twice; only one is wanted): a header (learner, exam number, school, year,
report), one table (Subject · % · Achievement level), a closing row of asterisks as on the real
one, the pass statement, a key to the levels; an eighth or ninth subject adds rows, never a
second page, and the layout is tested at 7, 9 and 11 subjects. Every page says **"SAMPLE: not an
official document"**; **no coat of arms, Umalusi or department logo, seal, barcode, certificate
number or signature** (a generator of convincing certificates would be a forgery tool). Names and
numbers synthetic (hard rule 4; the `no-real-pii` guard already rejects real-looking ID numbers).

**The demo learner.** A seed (`pnpm --filter @universityflow/db demo:seed`, refusing production
like the review seed) creates one synthetic learner in Grade 12 with confirmed Grade 10, 11 and
12 reports, a goal, a shortlist and an offer, so a demo shows the whole journey. The owner's own
certificate and academic record are **not** used and never committed.

**The same for university (Phase 7, later).** The owner's UJ academic record shows the shape: per
qualification, Year · Module code · Description · NQF credits · Half-year mark · Final mark ·
Result ("Passed", "Passed with distinction", "Supplementary exam granted", "Pass, supplementary
mark capped", "Cancelled"), then an overall summary (credits, "May continue studies"). The
learner enters or uploads it (confirmed), and an official feed from a partner university is
Phase 8's (D3's Tier C).

**Decisions the owner makes (Part C).**

1. **C-later only:** D3 changes from "public + student-provided" to "… and official final NSC
   results, with the learner's consent". A re-plan of a locked decision, when C-later starts.
2. **Who to approach**, when C-later starts: the DBE first (most candidates), the IEB second?
3. **Consent wording** then names the issuer and what is fetched (A11).

**Build order once approved.** C1: the generator and the fake source. C2: Grade 10 and 11 report
kinds (with G10-2) and the school record on *My results*, web and app. C3: the demo seed.
C4 (later): the official source, after an agreement. **Tests:** levels from percentages at every
boundary; every mark shows who entered it; an official record can't be edited or deleted through
any route (fails first, C4); the official final supersedes the learner's own (C4); the
generator's output carries the sample mark and no insignia (a test on the PDF text); the report
reader reads the generated statements; **a PDF that repeats the same page (a certificate scanned
twice, often skewed) yields one set of marks, not two**, and a page whose % column has slipped a
row is flagged for the learner's check rather than trusted (hard rule 6). **Audits:** A1, A3, A13
(levels and pass rules against the DBE's own publication); with C4, A5 (a new data source) and
A11 (consent, a new operator).

### 18.8 The owner's decisions (2026-10-21)

Taken part by part, each the recommended answer:

| # | Decision | Answer |
|---|---|---|
| §18.5-1 | Grade 10 scope | **An extra entry, Stage 0. D1 is kept**: the Grade 11 cohort of 2026 and the March 2027 MVP stay first in line |
| G10-2 | Report kinds in S1 | **`grade-10-final` only** (migration 0024). `grade-10-june`, `grade-11-june` and `grade-11-september` come with C2's school record, if wanted then |
| §18.5-2 | Studios for UniversityFlow learners | **Free, sponsor-funded** (D5). The studios keep selling to schools and families |
| §18.5-3 | The studio tutor and cross-border data | **Routed through UniversityFlow's AI interface and crisis check**: one provider, one disclosure, no new operator in consent |
| §18.5-4 | Where studio data lives | **In South Africa** (af-south-1), or with no identity at all, not even a pseudonymous one |
| §18.5-5 | The shared studio engine | **One separate studio monorepo** (the three studios and their engine); not this repo |
| §18.6 | Order | **S1 → S5 as written**: S1 and S2 may start now on a branch; S3 waits for Life Science Studio's accounts branch; the Grade 11 MVP stays first |
| §18.7 | Part C | **C1–C3 approved now** (the generator and fake `ResultsSource`; Grade 10/11 report kinds and the school record; the demo seed). **C4 later**: it changes D3 only at gate H2 (§19) |
| §18.7 | Where the generator lives | **`tools/results-generator`**, its own private workspace package that no app imports (a PDF library never reaches a bundle); the fake `ResultsSource` in `packages/documents` reads its JSON |
| §18.7-2 | Who to approach for official results (later) | **The DBE first, the IEB second**; Umalusi for checking certificates. No outreach until the owner says so |


---

## 19. The North Star: one verified hub, opened gate by gate (v0.9, approved 2026-10-21)

*The owner's vision, 2026-10-21: "one centre application for all the schools and universities,
the departments of education, bursaries and funding: things easily made and well verified here;
you want to apply, we pull straight from the right department, we apply and submit, easy."
**Nothing here changes the locked decisions until the owner approves it, gate by gate.**
Approved 2026-10-21 (§19.2): the North Star, H0 and the gate order; each gate still needs its
own agreement before it changes a locked decision.*

**Where it meets the plan.** Two parts go against what is locked, so they wait for agreements:
**D3** (v1 uses public data and what the learner provides, plus one university partnership as
the Tier C pilot) and **"never log into a university system as a student"** (CLAUDE.md). The hub
pulls from a source and submits to an institution **only where that source or institution has
agreed to it**, never with the learner's password on someone else's portal.

**The picture.** UniversityFlow becomes the one trusted place where a South African learner's
education life comes together: results (their own now; the DBE's or IEB's later), applications
(to every university, through the CAO or directly), funding (NSFAS and bursaries), and learning
(the studios, §18). Everything shown says where it came from, and applying is a few taps
because the data is already there and already checked.

**Built now, cheaply, so the hub can grow without a rebuild:**

1. **A connector per outside source**, behind an interface with a fake and contract tests (D8):
   `ResultsSource`, `ApplicationChannel`, `FundingChannel`, `LearningProvider`. A new partner is a
   new connector.
2. **Provenance on every piece of learner data**, as hard rule 3 does for catalogue facts:
   "Entered by you", "Official: DBE", "Verified by Wits", with the date.
3. **Consent per source and per action** ("send my application to UJ", "fetch my NSC results"):
   recorded, revocable, a guardian's for a minor (hard rule 5).

**The gates (each opens with a signed agreement, and only then changes D3):**

| Gate | What becomes possible | Needs |
|---|---|---|
| **H0** now to March 2027 | The MVP as planned, plus connectors and provenance labels | Nothing new |
| **H1** 2027 | **"Apply with UniversityFlow"** at one university: the learner's confirmed pack goes straight in (D3's Tier C pilot) | One university partner; outreach starts now |
| **H2** January 2028 results | **Official final NSC results** for Grade 12 learners, read-only (§18.7 C-later) | An agreement with the DBE (the IEB later); D3 changes here |
| **H3** 2028 | **Funding**: NSFAS and one or two bursary funders accept pre-filled applications | Funder agreements; NSFAS has no public API today |
| **H4** | **Verified colleges** (§19.1: public TVET first), more universities, the **CAO**, schools' term reports, the studios with one sign-in (§18) | One agreement each |

**Partner, don't compete, with what exists.** The **CAO** already applies centrally to the KZN
universities; DHET's **CACH** places learners who missed out; a national central applications
system has been discussed for years. UniversityFlow is the learner's side (results, choices,
deadlines, funding, support) feeding those systems, not a rival to them.

**Decisions the owner makes.** Approve the North Star and H0's three building blocks; confirm the
order of H1–H3 (recommended as above: a university first because D3 already plans one, official
results second because they are yearly and predictable, funding third); name the first
university to approach (UJ, where the owner studied?).


### 19.1 Verified colleges (added 2026-10-21)

*The owner's addition: "South African verified colleges". It extends **D2** (the first six
universities) and answers **Q8** (TVET colleges in Plan B, open since Phase 1). Not built.*

**Why it matters.** Many learners' best route isn't a university: a public TVET college, or an
accredited private college. And **unregistered "colleges" take learners' fees** every year, so
"verified" is the point: UniversityFlow lists **only institutions on the Department of Higher
Education and Training's (DHET's) own registers**, each with its registration number, what it is
accredited for, and the date and person who checked it (hard rule 3, exactly as for universities).

**What a learner gets.**
- **Plan B that is real:** the courses they qualify for at public TVET colleges (and accredited
  private colleges) beside university courses, from the same calculators and the same verified
  data. NSFAS funds public TVET colleges too (verify the current rules, gotcha 40).
- **Entry from Grade 9 or 10, not only matric:** the NC(V) programmes start after Grade 9, which
  ties in with the Grade 10 entry (§18.3); the N4–N6 (Report 191) programmes start after matric.
  Every entry rule from the college's or DHET's own publication.
- **"Is this college registered?"**: a check by name against DHET's registers, with a plain
  warning and DHET's own link when a college isn't on them. Useful to every learner and family,
  not only our users.
- Applications, deadlines and funding for colleges in the same tracker as universities (each
  college applies its own way; no central TVET application exists that we know of; verify).

**What it needs.**
- Catalogue records for colleges (an institution type: university, public TVET college, private
  higher education institution, private college) and their programmes, sourced and verified like
  the universities' (drafts until a person verifies). The **registers** (DHET's lists of public
  TVET colleges, registered private higher education institutions and private colleges) are read
  as sources, never guessed; the **number of public TVET colleges** (commonly given as 50) is
  checked against DHET's own list.
- A per-qualification calculator where colleges use a rule other than APS.
- Words, the home's journey and the course search's University filter becoming
  **Institution** (university or college) with a type filter.

**Order.** After the March 2027 MVP, as a wave like a university wave: **first the public TVET
colleges in one province** (Gauteng, where most of the six universities are?), then the rest, then
accredited private institutions. The registration check can come earlier, since it needs only the
registers.

**Decisions the owner makes.** Approve colleges as the next wave after the six universities (D2
grows); which province first; whether accredited **private** colleges are listed at all (they
charge fees; we never take money from an institution to list it, D5); the registration check
first, on its own?

### 19.2 The owner's decisions (2026-10-21)

Each the recommended answer. **No locked decision changes now**: D3 changes only when gate H2
opens with a signed agreement, and D2 grows when the colleges wave starts.

| Decision | Answer |
|---|---|
| The North Star and H0 | **Approved**: connectors behind interfaces with fakes and contract tests (D8), provenance on every piece of learner data, consent per source and per action |
| Gate order | **H1 → H2 → H3** as in the table: a university partner first (D3's Tier C pilot), official NSC results second, funding third |
| First university to approach (H1) | **UJ**. No outreach until the owner says so |
| Colleges (§19.1) | **The next wave after the March 2027 MVP**: public TVET colleges in **Gauteng** first, from DHET's registers, then the other provinces. **"Is this college registered?"** may be built earlier, on its own |
| Private colleges | **Listed, after public TVET**: only those on DHET's registers, fees shown, and never paid to list (D5) |

---

## 20. The owner's decisions (2026-10-23): the FNB hackathon and Mmereko

*Recorded 2026-10-23, in the decisions log's format (status.md), so each row can be copied there.
**No locked decision changes.** The demo is its own deployment on made-up learners; the two
hackathon exceptions are approved knowingly, for the judging only, and undone afterwards
(docs/deploy/demo.md "Hackathon exceptions", docs/deploy/hackathon-undo-pr.md). **The owner's
intention, which they asked to have written down: safety and following the law come first.***

| Date | Decision | Rationale |
|---|---|---|
| 2026-10-23 | **The FNB hackathon judge demo:** a public deployment (`UF_DEPLOYMENT=demo`, its own Vercel project, `UF_DEMO_PROJECT=1`), no password, on **six synthetic personas** (Grade 10, 11 and 12; first year UJ, second year Wits, final year UCT; no gender field). Each judge gets a **private copy, deleted after 24 hours**. No phone/SMS sign-in; uploads take only the generator's SAMPLE statements; honest "coming next" cards for Stages 6–8. **Chat uncapped** (the owner overrode the recommended per-judge cap); an optional daily cap across the demo, `UF_DEMO_AI_DAILY_CAP`, off unless set; a spend limit on each AI key bounds the cost | Judges must try the real product in one click. Made-up learners only, and the demo refuses everything production is made of, so nothing real is at stake (docs/deploy/demo.md) |
| 2026-10-23 | **Gemini as a second `ChatModel`** (`UF_AI_PROVIDER=gemini`, `GEMINI_API_KEY`), **demo only**: production refuses both until the consent wording, the privacy page and legal review name Google. Reading documents stays with Anthropic. Paid tier only (A10-50). **A10-46: the demo runs on Anthropic**, because Gemini's terms are for users 18 and over and forbid services likely used by under-18s | A second provider for resilience and comparison, without a new operator for learners. Gemini's age terms keep it away from anything a minor may use |
| 2026-10-23 | **Real university logos in the judge demo only**, a **hackathon exception** (`NEXT_PUBLIC_UF_DEMO_LOGOS=1`; Wits, TUT, UCT, UKZN; UJ and UP keep the grey mark), with the banner line "University logos are shown for this demo only. UniversityFlow is not affiliated with or endorsed by these universities." Production and staging refuse it. Option A (docs/brand/logo-permissions.md) stands everywhere else. Only the logos were lifted: the owner declined lifting Read aloud, the photo upload and the plan-map words in the demo | For the judging only; reverted afterwards. No university has agreed in writing, so the real service shows no logo |
| 2026-10-23 | **The Firebase real sign-up for judges**, a **hackathon exception**, approved verbatim: *"approved: build the Firebase real sign-up for the judge demo, 18+ only, accounts deleted after 30 days"* (`UF_DEMO_SIGNUP=firebase`, migration 0034 `demo_signups`; email link or Google). Adults only, held in the data layer; only the uid and email kept; every account deleted 30 days after it was made; the CSP admits Firebase only on the sign-up page. Accepted for the hackathon: real adults' data in the demo database, Google Firebase as an operator, notice wording without legal review. **The owner asked that it be recorded that the real intention is safety and following the law** | Judges may want their own account beside the made-up learners. Undone after the hackathon: switch off, accounts and the Firebase project deleted, code removed, table dropped (docs/deploy/hackathon-undo-pr.md) |
| 2026-10-23 | **Mmereko built now as the CV engine** (My CV, `packages/cv`, migration 0035; Mmereko's stateless `/partner/v1`), with **every recommended answer, D1–D17**, of docs/design/mmereko-api-proposal.md §13: UniversityFlow holds the CV of record and Mmereko is stateless (≤ 24 h); a partner cell in af-south-1; Anthropic only for partner jobs; recruiter links served by UniversityFlow, from 18 only; the base CV deterministic, AI only for tailoring; one consent v4 / adult-v3 and a separate CV opt-in; and the rest as recommended. **`UF_CV` stays off for learners** until consent v4 / adult-v3 (legal review) and the Tumoolo–Mmereko agreement exist; the judge demo never calls Mmereko (D14) | Pulls Stage 8's CV help forward from Phase 9 (plan-drift flag 1 of the proposal), built against a fake (D8) so nothing reaches a learner before the agreement, the region and the consent |
| 2026-10-23 (late) | **The live site stays the judge demo; its sign-up and log in are demo-only** (made-up learners; the judges' Firebase sign-up when keyed). **The real launch is prepared separately** (#98) for the owner to connect accounts | The owner tried to sign up on the demo. Real learners' data stays in SA behind verification and legal review (locked) |
| 2026-10-23 (late) | **Profile photos for learners from Grade 10, ready now** (#100), switched on with consent v4: shown only on the learner's own profile, used for nothing else | The owner: learners stay motivated with their own photo "as long as the picture is not used for anything else" |
| 2026-10-23 (late) | **Supabase as the judge demo's database** (made-up learners only; London/Frankfurt); **real photo uploads on the demo** as a hackathon exception (`UF_DEMO_REAL_PHOTOS`, own photo only, deleted with the copy); **university logos on**. Legal work after the hackathon | The demo shows how it works and looks; real learners stay on AWS af-south-1 |
| 2026-10-23 | **Sample photos only in the demo:** the profile photo is chosen from six drawn SAMPLE pictures (packages/documents `sample-photos.ts`), never a real upload; `UF_PROFILE_PHOTO` stays refused on a demo | A public demo must never receive a real person's photo |

**Where it stands (2026-10-24):** the judge demo is live on Supabase and works end to end
(`pnpm demo:smoke`, 23 of 23 checks; the chat waits on its AI key). The real launch is prepared
but not open (docs/deploy/production.md): real learners only after catalogue verification, legal
review and the production accounts in af-south-1. After the judging, the hackathon exceptions are
undone (docs/deploy/hackathon-undo-pr.md). **Phase 6 was approved on 2026-10-24** and is in §11; Phase 7 is proposed
(docs/plans/phase-7-proposal.md) and moves into §11 when the owner approves it.

### 20.1 The owner's decisions (2026-10-24)

*In the decisions log's format. **No locked decision changes**: the demo stays made-up learners
only, and every exception is on the undo list (docs/deploy/hackathon-undo-pr.md).*

| Date | Decision | Rationale |
|---|---|---|
| 2026-10-24 | **The judge demo shows everything:** the real sign-up journey on made-up details (080 numbers only, PIN and guardian link on screen, deleted after 24 h; 100 PIN requests an hour per address on the demo only), My CV with the stand-in engine (D14 holds), plan-map words and Read aloud (both reversing the 2026-10-23 "no"); hackathon exceptions E–H. Not chosen: visitors' own photos | Judges should see the whole product; real people stay out |
| 2026-10-24 | **Phase 6 approved with every recommended answer D1–D14, built now on drafts** (§11, v0.10), overriding the proposal's "after Phase 5" timing (plan-drift flag 1, told to the owner). The demo's university learners record the draft adult-v3 so they can add a SAMPLE outline (exception I) | The semester tools ready early; drafts reach no learner before a person verifies them |
| 2026-10-24 | **Pictures behind cards** (course cards, My subjects, module cards, My offers), every word readable over them | A fitting picture behind each card |
| 2026-10-24 | **Colleges now: all public TVET colleges in every province** (over the recommended Gauteng first; this supersedes §19.2's "after the MVP"), from DHET's register and each college's own site, as drafts; "Is this college registered?"; colleges in Plan B; **their logos on the demo only**, with UJ's and UP's | Plan B that is real, and protection from unregistered colleges |
| 2026-10-24 | **The plan maps become a canvas on a card** (pan both ways inside the card, zoom, a full-screen canvas that closes) | Bigger maps, pleasant on a phone |

---

## Sources (research for §2, §5, §7, §8)

- [2027 University Applications — UniApplyForMe](https://apply.org.za/2027-applications/)
- [Universities opening in April for 2027 applications — Varsity Wise](https://www.varsitywise.com/posts/universities-opening-in-april-for-2027-applications)
- [2027 University Application Dates — APS Score](https://apsscore.com/university-application-dates-south-africa-guide/)
- [Wits entry requirements](https://www.wits.ac.za/undergraduate/entry-requirements/)
- [Does Life Orientation count for APS? — APS Score](https://apsscore.com/does-life-orientation-count-aps-score-university-breakdown/)
- [APS calculator, all 26 universities — NavyBlue](https://www.navyblue.co.za/aps-calculator)
- [Information Regulator: guidance note on processing children's personal information](https://inforegulator.org.za/wp-content/uploads/2020/07/GuidanceNote-Processing-PersonalInformation-Children-20210628-1.pdf)
- [POPIA section 35](https://popia.co.za/section-35-general-authorisation-concerning-personal-information-of-children/)
- [WhatsApp Business Platform pricing — Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [WhatsApp Business API pricing in South Africa (2026) — The Messenger Network](https://themessengernetwork.co.za/thought-leadership/whatsapp-business-api-pricing-south-africa/)
- [SAFIRE — South African Identity Federation](https://safire.ac.za/) · [TENET: SAFIRE](https://www.tenet.ac.za/services/safire)
- [LTI Advantage (1.3) — Brightspace Community](https://community.d2l.com/brightspace/kb/articles/23660-lti-advantage-v1-3)
- [Vercel: Cape Town region (`cpt1`) pricing](https://vercel.com/docs/pricing/regional-pricing/cpt1) · [Vercel regions](https://vercel.com/docs/regions)

Third-party APS summaries are a starting point only. **Every rule gets re-verified against the
university's own prospectus in Phase 1.**
