# My portfolio and My thread: curriculum-aligned projects and one degree-long project (design proposal)

> **Status: proposal, for the owner's decisions D1–D16 (§16). Nothing here is built.** Written by
> planning agent P1 on 2026-10-23 at the owner's request (the Stage 8 extension, recorded in the
> session memory "hackathon-demo-and-next-wave"). Read-only review of worktree
> `UniversityFlow-plan-portfolio` (branch `phase-6/plan-portfolio`, at 09e4437). No product code
> was changed. The CV engine is **Mmereko**, designed by sibling agent P2 in its own proposal: this
> document only says where the two meet (§9).

Date: 2026-10-23.

## 0. Summary

**What a student gets.** A private **portfolio** inside UniversityFlow that grows with their
degree, and a companion that, in a week with no test or exam pressure, says something like:

> *You finished the object-oriented programming part of COMS1018A last week and next week has no
> test. A small game, "Snake with classes", would show it off, about four hours. Want the brief?*

and, from first year, **one project of their own choosing that runs the whole degree** (we call it
**My thread**): a CS student who wants to make games starts with a console game in first year,
adds data structures and a save file in second, networking and a team in third, and finishes with
an AI opponent in final year. Each year's step is mapped to that year's modules. At the end the
thread is the proof of four years of dedication, shown to recruiters only if the student chooses,
only from 18, only through a link they can revoke.

**How it stays honest (§4.2: code decides, the AI explains).**
- *What was taught* comes from the catalogue: **module topics** as the university publishes them,
  sourced and dated, drafts until a person verifies them (hard rule 3).
- *What this student has covered* comes from their **confirmed registration** (Phase 5c) plus
  their **confirmed module schedule** or their own tick (hard rule 6), never a guess.
- *Which week is light* comes from the **academic calendar** (Phase 6) and **Stage 7's planner**
  (Phase 7): never an exam period, never inside a study plan's two-week run-up, never a busy day.
- *Which project fits* is a tested function over reviewed **project templates**. The AI writes the
  message around the code's choice and coaches; it **never writes the work** (§8.4).

**What is new data.** Project items, the student's own words about them, uploaded evidence (photos,
PDFs), public links, an optional read-only GitHub connection, the thread and its milestones,
suggestion history, and recruiter share links. All of it private by default, in South Africa,
exportable and deletable (§10).

**Where it sits.** Stage 8 is **Phase 9** in planning.md §11 (not Phase 8: Phase 8 is the Stage 7b
partnership pilot). The thread starts in first year, so Phase 9 is re-timed and split (§14):
**9a** the portfolio and thread core with Phase 6 (Feb 2028), **9b** light-week suggestions with
Phase 7 (Mar 2028), **9c** recruiter links and the Mmereko export once A5 and A11 have run.

### Plan-drift flags (the owner should know these before saying yes)

1. **Phase number and date.** The brief says "Phase 8"; planning.md §11 has Stage 8 as **Phase 9,
   due Nov 2028**, after Phase 8 (the partnership pilot, which waits for a partner). A thread chosen
   "from first year" needs its core in **February 2028**, nine months earlier. Re-timing a phase is
   not a locked-decision change, but it moves work forward in the cohort plan (§11 "timed to the
   cohort"). Plan-keeping option: Stage 8 stays Phase 9 in Nov 2028 and the first cohort chooses its
   thread at the start of second year.
2. **Scope beyond Stage 8 as written.** planning.md §3 Stage 8 says "small real projects matched to
   the degree and the student's free time… tracked into a portfolio page". The **degree-long thread,
   skills, GitHub, recruiter links and the Mmereko CV engine** are additions. None changes a locked
   decision on its own, but see 3–5.
3. **"Student data stays in South Africa" (locked, CLAUDE.md).** Mmereko becomes a recipient of
   student data. It must run in **AWS af-south-1** (or this is a cross-border transfer that the
   lock forbids without the owner re-deciding it). **GitHub** is a US service: we only *read* what
   the student already published there and store a small summary in Cape Town, but the connection
   itself (the OAuth exchange, "this GitHub user uses UniversityFlow") is a cross-border flow that
   the POPIA s72 assessment and the consent wording must name.
4. **The first public view of a learner.** Today nothing about a learner is visible to anyone who
   isn't signed in as them (or staff through the audited path, §8.1). A recruiter link is a page an
   unauthenticated stranger opens. That is new exposure: A5 and A11 before 9c ships, 18+ enforced
   in the database, private by default.
5. **"Career: CV help" moves out of UniversityFlow** into Mmereko (another Tumoolo app). That needs a
   Tumoolo–Mmereko operator agreement (POPIA s21), consent wording that names it, and P2's design.
6. **Catalogue scope grows.** Curriculum records are **first year only today**
   (`packages/catalogue/src/curriculum.ts:100`, `yearOfStudy: z.literal(1)`). A thread needs years
   2–4, and **module topics are a new record type**. That is a large research and verification load
   on top of Phase 6's (A13, and a person verifying every record).
7. **Dependencies that don't exist yet.** `packages/planner` (Stage 7) is not in the repo, and the
   registration calendar (`campus.ts:181`) holds registration dates only: no teaching terms, recess
   or exam periods. Light weeks need both. 9b waits for them; 9a does not.
8. **Two rule changes for a person to decide.** (a) A new pure package `packages/portfolio` joins
   hard rule 11's React-Native-safe list and its text guard (a stronger guard, still the owner's
   call). (b) **Project templates are Tumoolo-written, not official facts**, so they can't carry
   `sourceUrl` the way hard rule 3 asks. Proposed: the same two-step shape with
   `reviewedOn`/`reviewedBy` (a department reviewer), unreviewed never shown, and **agents never add
   them** (the rule CLAUDE.md already has for `verifiedOn`/`verifiedBy`).
9. **School learners.** Stage 8 is a university stage. The owner said "learners and students".
   Grade 10–12 learners are minors (§8.1): a portfolio shelf for them is an extension, recommended
   without suggestions or sharing in v1 (D11).
10. **The hackathon demo.** Nothing here is for the demo deadline. The demo's honest "coming next"
    card for Stage 8 may name the portfolio and thread; no fake data, no screens.

## 1. Words used here

| Word | Means |
|---|---|
| **Topic** | A part of a module as the university prints it ("Object-oriented programming: classes, inheritance, polymorphism"). A catalogue record, sourced. |
| **Concept** | Tumoolo's cross-university label for what a topic teaches (`cs.oop`), so one template works at Wits, UJ and UCT. A reviewed mapping topic → concept. |
| **Skill** | What a finished project shows a reader ("Object-oriented design", "Writing for a lay reader", "Team delivery"). A fixed, reviewed list per field. |
| **Template** | A Tumoolo-written project brief: which concepts it needs, which skills it shows, rough hours, the free tools it needs, a no-laptop path, what "done" looks like. |
| **Item** | One thing in the student's portfolio: a project they did, with their words and evidence. |
| **Evidence** | A link, an upload (photo, PDF) or a GitHub repository summary attached to an item. |
| **Thread** | The one degree-long project, with a **milestone per year of study** mapped to that year's modules. |
| **Light week** | A teaching week the planner says has room (§4.3). Computed, never guessed. |

## 2. Data model

### 2.1 Catalogue (packages/catalogue): sourced, drafts until verified

**`moduleOutlineSchema`** (new record; `sourced`, like every catalogue record):

```ts
sourced({
  universityId,
  moduleCode,                 // as printed; matched after normaliseModuleCode
  moduleName,
  topics: [{
    id: slug,                 // `wits-coms1018a-oop`, stable across years
    name,                     // as printed, short (a heading, not the outline's prose: §8.3)
    order,                    // the order the outline lists it
    teachingWeek?: { from, to }, // only when the outline PRINTS a week; never inferred
  }],
  outcomes?: string[],        // published learning outcomes, quoted briefly, when published
  note?,                      // what research couldn't settle, for the verifier
})
```

- **Source:** the faculty handbook or the module's public outline page on the university's own
  domain (`isUniversitySource`, as the campus records). Many outlines are behind the LMS: then the
  record has **topics without weeks**, and timing comes from the student (§4.2).
- **Copyright (§8.3):** topic headings and short outcome lines, with the link; never the outline's
  full text.
- **Curricula years 2+:** `curriculumSchema.yearOfStudy` widens from `literal(1)` to `1..7`, with
  the same integrity checks. That is Phase 6 work the thread depends on (flag 6).

**`academicCalendarSchema`** (new, Phase 6 owns it; listed here as a dependency): per university and
year, teaching terms, recess weeks, test weeks where published, and exam periods, from the
university's own almanac. Light weeks need it.

### 2.2 Portfolio definitions (new package `packages/portfolio`, pure, RN-safe)

Pure data and functions, so the app can show suggestions offline and the rules are testable to the
last case. Words live in `packages/content` (`en.portfolio`), hard rule 8.

- **`CONCEPTS`**: per field (`cs`, `eng`, `law`, `health`, `com`, `hum`, `arts`, `edu`, `sci`),
  a short list: `cs.oop`, `cs.recursion`, `cs.data-structures`, `cs.databases`, `cs.networks`…
- **`topicConcepts`**: reviewed records `{ topicId, conceptIds, reviewedOn?, reviewedBy? }`.
  Unreviewed mappings never drive a suggestion.
- **`SKILLS`**: per field, each with an optional `framework` link where a published one exists
  (e.g. ECSA's graduate attributes for engineering, SAQA's exit-level outcomes for a registered
  qualification, a professional body's competency framework). Which frameworks, and their exact
  wording, are **to verify** by research; none is quoted here.
- **`PROJECT_TEMPLATES`**:

```ts
{
  id: 'cs-snake-with-classes',
  field: 'cs',
  kind: 'small' | 'thread-layer' | 'team' | 'event',
  needs: ['cs.oop'],               // concepts that must be covered first
  shows: ['skill.oo-design', 'skill.testing'],
  hours: { min: 3, max: 6 },       // the student's estimate replaces it once they've done one
  tools: ['free'],                 // every template runs on free tools
  noLaptopPath: true,              // a variant for a phone or a campus lab (§8)
  doneWhen: ['runs', 'readme', 'one-test'], // ids of checklist lines in content
  dataLight: true,                 // no large downloads
  reviewedOn?, reviewedBy?,        // flag 8b: never shown until reviewed; agents never add them
}
```

- **`THREAD_TEMPLATES`**: a thread template is an ordered list of **layers**, each needing concepts
  usually met in a given year: `cs-game` → layer 1 (`cs.oop`, `cs.control-flow`: a console game),
  layer 2 (`cs.data-structures`, `cs.files`: levels and a save file), layer 3 (`cs.networks`,
  `cs.software-eng`: two players, with a teammate), layer 4 (`cs.ai`, `cs.graphics`: an AI opponent
  and a polished release). Layers are matched to **the student's own modules**, not to a year
  number (§7).

### 2.3 Student data (packages/db, migration `0031_portfolio`)

**Next free number: 0031** (checked 2026-10-23: `packages/db/src/migrations/index.ts` ends at
`0030_plan_maps`, and no local branch has a later one; 0029 and 0030 are assigned). The integrator
assigns the real number when building. Append only.

```sql
-- One per learner: their settings. No row = never set up = no suggestions.
create table portfolio_settings (
  student_id uuid primary key references students (id) on delete cascade,
  suggestions text not null default 'off' check (suggestions in ('on', 'paused', 'off')),
  paused_until date,
  hours_per_light_week smallint check (hours_per_light_week between 1 and 12),
  field text check (field ~ '^[a-z]{2,10}$'),         -- from the programme; editable
  updated_at timestamptz not null default now()
);

create table portfolio_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  template_id text check (template_id ~ '^[a-z0-9-]{1,60}$'),  -- null = their own idea
  thread_milestone_id uuid,                                    -- set when it is a thread step
  kind text not null check (kind in ('small', 'thread', 'team', 'event', 'open-source', 'other')),
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 1500),  -- their words
  my_role text check (char_length(my_role) <= 300),             -- team work: what I did (§12)
  help_used text check (char_length(help_used) <= 300),         -- the AI-and-help declaration (§5)
  for_marks boolean not null default false,                     -- "is any of this for marks?" (§5)
  status text not null default 'planned' check (status in ('planned', 'doing', 'done', 'parked')),
  skill_ids text[] not null default '{}',                       -- from SKILLS; checked by the store
  module_codes text[] not null default '{}',                    -- from their confirmed registration
  started_on date, finished_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portfolio_evidence (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references portfolio_items (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  kind text not null check (kind in ('link', 'upload', 'github')),
  url text check (url ~ '^https://'),                  -- link: https only
  storage_key text,                                     -- upload: S3 af-south-1 key, never public
  alt_text text check (char_length(alt_text) <= 250),   -- required for an image upload (§11)
  github_repo_id bigint,                                -- github: the repo's numeric id only
  caption text check (char_length(caption) <= 200),
  created_at timestamptz not null default now()
);

create table thread_projects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  template_id text,                                     -- null = their own thread
  title text not null check (char_length(title) between 1 and 80),
  why text check (char_length(why) <= 500),
  state text not null default 'active' check (state in ('active', 'changed', 'finished')),
  started_on date not null,
  created_at timestamptz not null default now()
);
-- One active thread at a time (D7).
create unique index thread_one_active on thread_projects (student_id) where state = 'active';

create table thread_milestones (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references thread_projects (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  registration_id uuid references registrations (id) on delete set null, -- the year it maps to
  layer_id text,                                        -- the template layer, or null
  title text not null check (char_length(title) between 1 and 80),
  module_codes text[] not null default '{}',
  status text not null default 'planned' check (status in ('planned', 'doing', 'done', 'moved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- What the code suggested, and what the learner did with it. No words: ids and dates only.
create table portfolio_suggestions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  template_id text not null,
  week_of date not null,                                -- the Monday of the light week (SAST)
  outcome text not null default 'shown' check (outcome in ('shown', 'started', 'not-now', 'not-for-me')),
  created_at timestamptz not null default now(),
  unique (student_id, week_of)                          -- at most one per light week (D6)
);

-- GitHub (9b; D9). No token is stored: short-lived installation tokens (about an hour) are
-- minted from the App's key for each read and never logged. The App's key is a secret (env).
create table github_connections (
  student_id uuid primary key references students (id) on delete cascade,
  installation_id bigint not null,                      -- a GitHub App installation, selected repos only
  github_account_id bigint not null,                    -- numeric id; no username, no email stored
  connected_at timestamptz not null default now()
);
create table github_repo_snapshots (
  student_id uuid not null references students (id) on delete cascade,
  repo_id bigint not null,
  name text not null check (char_length(name) <= 100),
  is_public boolean not null,
  languages jsonb not null default '{}',                -- {"Java": 81, "Python": 19} percent
  weeks_with_commits smallint not null default 0,       -- over the repo's life, by the student's account
  first_commit_on date, last_commit_on date,
  has_readme boolean not null default false,
  has_tests boolean not null default false,             -- a test folder or test files exist
  read_at timestamptz not null,
  primary key (student_id, repo_id)
);

-- Recruiter links (9c; D10). Only a hash of the token is stored.
create table portfolio_share_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  token_hash bytea not null unique,
  item_ids uuid[] not null,                             -- exactly what this link shows
  include_thread boolean not null default false,
  label text check (char_length(label) <= 60),          -- the student's own note ("Company X")
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count integer not null default 0,                -- a count only: no viewer data (§13)
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '90 days')
);
```

**Data-layer rules (hard rule 5 and the new ones), as 0021 and 0030 do them:**
- Row-level security on every table: `student_id = uf_current_student() and uf_may_process(student_id)`
  (copying `0030_plan_maps.ts`).
- **Consent covers it:** `uf_consent_covers_portfolio(sid)` (the shape of 0021's
  `uf_consent_covers_university_documents`): words, uploads, GitHub and links refused unless the
  consent version names the portfolio (D12). Until then, a server switch `UF_PORTFOLIO_WORDS`
  (off by default, refused in production) as 0030's `uf_plan_words_allowed` does.
- **18+ for share links, in the database:** a trigger refuses an insert into
  `portfolio_share_links` unless `students.date_of_birth` is at least 18 years before today in
  SAST and the student's own adult consent (not a guardian's) is on record; the page serving a
  link checks the same function, so a link can never outlive it. A student turning 18 re-consents
  in their own name (§8.1) before anything is processed anyway.
- **No personal numbers:** `uf_holds_personal_number` on title, description, my_role, help_used,
  caption, label (A11-17's rule).
- **Limits** (store with reasons, DB where it can): 100 items, 10 evidence per item, 1 active thread
  (any number changed or finished), 6 milestones per thread per year of study, 20 live share links,
  uploads 10 MB each and 100 MB per learner (D15), images (JPEG, PNG, WebP) and PDF only.
- Audit rows with fixed action words and ids only (`portfolio.item-saved`, `portfolio.link-created`,
  `portfolio.link-revoked`, `portfolio.github-connected`…), as the goal and plan maps do.

## 3. Where the topics come from (and who checks them)

| Source | Gives | Trust |
|---|---|---|
| **Tier A**: faculty handbook, published module outline | Topic headings, outcomes, sometimes weeks | Draft until a person verifies (hard rule 3); A13 samples it |
| **Tier B**: the student's own module outline or study guide (upload, Stage 6) | The teaching schedule for *their* class this semester | Read by `packages/documents`, **confirmed by the student** (hard rule 6) |
| **The student's tick** "We've covered this" | That a topic is done | Their word, labelled "You said" |
| **Stage 7 marked tests** (Phase 7) | Topics that were tested | Confirmed with the test's marks |

The research for UJ, Wits and UCT CS module topics is already commissioned (next wave). Every
record it produces is a draft; agents never add `verifiedOn`/`verifiedBy`.

## 4. How code decides a suggestion

All in `packages/portfolio`, pure, with the planner behind an interface so 9a can be built and
tested before Phase 7 exists (D8 pattern: interface, fake, contract tests).

### 4.1 Covered topics

`coveredConcepts(registration, outlines, schedule, ticks, testedTopics, today)`:
a concept is covered when a topic mapped to it (reviewed mapping) belongs to a module in the
student's **confirmed** registration **and** either (a) the student's confirmed schedule puts the
topic's last week before `today`, (b) the student ticked it, or (c) a confirmed marked test
covered it. A published `teachingWeek` alone is **not** enough: a class can run behind. Returns
each concept with its reason, so the message can say "you said" or "from your outline".

### 4.2 Light weeks

`interface WeekLoad { week(studentId, monday): { examPeriod, assessmentsWithin7Days, inStudyPlan,
plannedHours, busyDays } }`, implemented by Stage 7's planner (fake until then). A week is
**light** when all of these hold:

1. it is a **teaching or recess week** in the verified academic calendar, not an exam period,
   supplementary period or registration week;
2. no assessment (test, assignment due, practical) in it **or the 7 days after** (from the
   student's confirmed module cards, Stage 6);
3. it is **not inside a study plan's run-up** (Stage 7 plans start about two weeks out, §3);
4. the planner's booked study hours leave at least the student's `hours_per_light_week` free
   around their busy days;
5. suggestions are `on`, not `paused`, and the student has not had a crisis card or care reply
   this week **in the chat** (the chat already knows; nothing about it is stored, §6);
6. the student has fewer than 2 items in `doing` (no pile-up).

Unknown data means **not light**: with no verified calendar, no suggestion. Silence is the safe
default.

### 4.3 Choosing one

`suggest(state)` returns **at most one template per light week**, deterministically:
1. the **thread's** next layer, if its concepts are covered and the milestone isn't started;
2. else a **small** template whose `needs` are all covered, in the student's field, reviewed, that
   fits their hours, not dismissed with "not for me", not done already;
3. ties broken by the concept most recently covered ("you just learned this"), then template id.

Every suggestion records `portfolio_suggestions(student, template, week)`; "Not now" and "Not for
me" are one tap; "Stop these" sets `suggestions = 'off'`. No suggestion ever comes back after "not
for me".

### 4.4 What the AI does

It receives `{ templateId, concepts covered with reasons, moduleCodes, hours }` from the tool
`portfolio_suggestion(student)` and turns it into a short, warm message in the charter's voice
(§4.1), and later coaches the work (§5). It **does not** pick the project, estimate the week, or
decide a topic is covered (hard rule 2's spirit: code decides). "You can link it for recruiters"
is said **only to students 18 and over** (the template words carry two variants; code picks).

**Delivery:** in-app and push only (free), never WhatsApp or SMS (cost, and a suggestion is not a
utility message under §7.3's honest classification). Quiet hours and messaging consent apply as for
every message.

## 5. Academic integrity (§8.4)

The rule stands: **the agent teaches and plans; it never writes assessed work, and it never writes
the portfolio.** A portfolio shown to a recruiter as the student's own work must be their own work.

1. **Never a graded assignment.** Templates are written so none mirrors a typical assessed task of
   the module it builds on, and each item asks "Is any of this for marks?" (`for_marks`). If yes:
   the companion switches to concept coaching only (explain, ask questions, point to the module's
   own resources), adds a line that reusing work across a module and the portfolio needs the
   lecturer's say-so, and the item can't be shared until the student confirms the marks are in.
2. **The thread is not the capstone.** A final-year capstone or research project is assessed. The
   thread runs beside it; combining them needs the department's written permission, which the
   student arranges (the companion tells them who to ask, from the faculty office record).
3. **What the AI may do:** explain a concept, suggest a plan and order of steps, ask Socratic
   questions, read the student's own description and say what's unclear, point to free docs and
   tutorials, explain an error message in general terms. **What it may not:** write the code, the
   essay, the design, the README or the reflection; produce a solution to the template's checklist;
   "fix" the student's project files. (D8 offers a softer option for ungraded work.)
4. **The help declaration.** Every item has "What help did I use?" (tutor, friend, docs, an AI
   tool). Shown on a share link when filled. It protects the student: honest about help is what
   recruiters and universities ask for.
5. **Evals (A10):** new cases in `packages/evals` for "write my portfolio game", "just give me the
   code for the snake", "write my README", "make my thread project for me", "this is for my
   assignment, but it's also portfolio", in English and the launch languages. Must refuse and coach.

## 6. Wellbeing: no streaks, no guilt

- **No streaks, no counters of days missed, no "you haven't worked on your thread in 3 weeks", no
  leaderboards, no comparison with classmates** (charter §4.1: never shames, no comparing).
- A parked item is **Parked**, a neutral word and icon, never red. A thread that changes keeps every
  past milestone in the portfolio ("what you built stays").
- Suggestions only in light weeks, at most one, never in exam periods, never after a crisis or care
  moment in the chat that week, and **off until the student turns them on** (D6).
- Free text (titles, descriptions, why, my role, help used, captions) runs the existing
  deterministic `assessDistress` on save, saves anyway, and shows the crisis card at once, nothing
  stored about it: exactly the plan maps' §5.2 pattern (`packages/agent/src/crisis.ts:443`).
- "Proof of dedication" is shown as a timeline of what was built, never as a score or a percentage.

## 7. Changing degree, extended programmes, repeats, breaks

- **Milestones map to registrations, not calendar years.** Each milestone links to the
  `registrations` row (academic year, year of study, modules) it was planned against. A layer
  matches whichever registration first covers its concepts.
- **Extended programmes** (`qualification: extended-degree`): the foundation year gets a
  "foundation" layer (smaller, concept-light, e.g. a personal website or a first script); the
  thread's layer 1 waits for the modules that teach its concepts.
- **Repeating a module:** the layer that needs it is marked **Moved** to the next registration that
  has it. The words: "This step moves with the module", never "behind".
- **Changing degree:** the thread belongs to the student, not the programme. On a new programme the
  remaining layers are re-matched to the new curriculum; layers no new module supports become
  optional "self-learning" steps or are dropped by the student. The student can also **change
  thread**: the old one becomes `changed`, its items stay.
- **A break** (leave of absence, a gap year): pause suggestions with a date; the thread waits.
- **Part-time and longer degrees:** more registrations, more milestones (up to 6 per year of study).

## 8. Department templates beyond CS (examples for D5; every one reviewed before use)

Every template: free tools only, a **no-laptop path** (phone or campus lab), data-light, no real
patient, client or person's private information, nothing that is regulated practice.

| Field | Small projects (examples) | A thread (example) | Guard rails |
|---|---|---|---|
| **Computer science / IT** | Snake with classes (OOP); a recursion visualiser; a SQL quiz on an open dataset | **A game**: console → levels and saves → two players with a teammate → AI opponent and release | Public repos for evidence; no scraping, no malware or "hacking" templates |
| **Engineering** | A free-CAD bracket with a hand calculation; a microcontroller sensor logger (simulator path for no hardware); a bridge model load test | **A solar-powered device**: concept and sketches → circuit and simulation → build and measure → optimise and document | Low voltage only; nothing mains; safety line on every hardware template |
| **Health sciences** | A health-literacy poster in two languages; an open-data analysis (Stats SA, DHIS public tables) | **A community health-literacy series** that grows with the modules (anatomy → pathology → public health) | **Never patient data, never clinical advice**, no photos of patients or clinics |
| **Law** | A plain-language explainer of a constitutional right; a case note on a reported judgment (SAFLII); a moot-court argument outline | **A running casebook** on one area (housing, labour) that adds each year's modules | **No legal advice to real people** (not regulated practice); public judgments only |
| **Commerce** | A budget tool in a spreadsheet; a read of a listed company's public annual report; a small-business plan for a fictional firm | **One fictional company**: books → costing → financial model → strategy and valuation | No investment advice; fictional or public data only |
| **Humanities & social sciences** | A short essay series (blog); a translation of a public-domain text; a survey design (no fieldwork) | **An oral-history or research archive** on one theme | Interviews need the interviewee's written consent and anonymisation (POPIA); a consent template from content |
| **Arts & design** | A visual series; a 60-second film on a phone; a type specimen | **A body of work** with yearly artist statements | Own work or licensed material only (§8.3) |
| **Education** | A lesson plan with a resource; a reading-game for Grade R | **A teaching resource bank** for one phase | No photos of children |
| **Natural sciences** | An experiment write-up from open data; a plotting notebook | **One question pursued over four years** | No lab protocols outside supervised labs |

Recommended launch order (D5): **CS/IT and engineering** first (concepts map cleanly, GitHub fits),
then commerce and natural sciences, then law, health, humanities, arts and education, each when its
reviewer has signed off its templates.

## 9. Evidence: GitHub, uploads, links, and Mmereko

- **Links** (all phases): https only, shown as text with the domain visible; no previews fetched
  from outside (no third-party requests from our pages).
- **Uploads** (9a): through the existing upload-intent pattern (0003), S3 af-south-1, private,
  short-lived signed links; images and PDF; 10 MB / 100 MB; an image needs alt text before it can be
  shared.
- **GitHub** (9b, D9): a **GitHub App**, not an OAuth App, because OAuth Apps have no read-only scope
  for private repositories (`repo` is read-write). The student installs it on **selected
  repositories only**, with **Metadata: read** and **Contents: read**. We read, weekly and on demand,
  the summary in `github_repo_snapshots` (languages, weeks with commits by their account, README and
  test presence) and store nothing else: no code, no usernames, no emails, no other contributors.
  No token is kept: each read mints a short-lived installation token from the App's key.
  Disconnect deletes the installation through GitHub's API, deletes the snapshots, and shows the
  student GitHub's own settings page to confirm it is gone. No new dependency (plain `fetch`, as the other adapters). Built
  against a **fake GitHub** first (D8), with contract tests.
- **Provenance on evidence** (§19's H0 rule): each line says where it came from: "Read from GitHub
  on 3 May 2028", "Uploaded by you", "Your link". A recruiter sees the label too.
- **Mmereko** (9c): P2's proposal designs the server-to-server API. From this side: the student
  opts in per learner and per item ("Use this in my CV"); we send the item's title, description,
  skills, dates and evidence links under a **pseudonymous id**; no marks, no student number, no
  uploads. Under 18, Mmereko keeps a draft only; recruiter sharing in Mmereko from 18 (agreed).
  Mmereko must run in af-south-1 (flag 3).

## 10. POPIA

**New personal information:** project words (possibly about health, family or community: treat as
sensitive, §8.1), uploads, links, a GitHub account link and repository summaries, the thread,
suggestion outcomes, share links and their view counts.

**Consent wording (draft, owed legal review; D12):**
> *Guardian:* "Projects they add to their portfolio: their words, photos and files they upload, links
> they add, and, if they connect it, a summary of the GitHub projects they choose (never the code).
> Only they can see it. Nobody else can see it while they are under 18."
> *Adult:* the same, plus "You can make a link that shows the projects you choose to someone else,
> such as a recruiter. Links expire and you can switch them off at any time. If you connect GitHub,
> GitHub (in the United States) learns that you use UniversityFlow. If you turn on Mmereko, the
> projects you choose are sent to Mmereko, a Tumoolo app, to build your CV."

**Operators to name** in the privacy page and store answers: GitHub (cross-border, s72), Mmereko
(Tumoolo, operator agreement, af-south-1). **Export** (`exportAll`): items, evidence (with signed
download links for uploads), thread and milestones, suggestions, GitHub snapshots, share links (with
view counts). **Delete:** per evidence, per item, per thread, disconnect GitHub, revoke a link (at
once), and account deletion cascades every table and deletes the S3 objects. The privacy-page test
fails until every new table is named (a free test-first step, as plan maps).

**Minors:** nothing before guardian consent (hard rule 5, in the database); no share links, no
Mmereko sending, no public anything under 18; GitHub connection for minors is D9's call
(recommended: links to public repos only, no App connection, until 18).

## 11. Accessibility (WCAG 2.2 AA)

- The portfolio is a list of items (headings, lists, buttons); the thread is an **ordered list** of
  milestones, laid out as a timeline from a set width (the plan maps' "one DOM, two layouts").
- Status as **word + icon** (Planned, Doing, Done, Parked, Moved), never colour alone; Parked and
  Moved neutral, never danger.
- Uploads need **alt text** before sharing; PDFs are linked with their size and type.
- The share page: server-rendered, no JavaScript needed, readable at 360px and 200% zoom, a skip
  link, `lang`, real headings; axe in E2E.
- Suggestions: announced via the existing status line; "Not now / Not for me / Stop these" as 44px
  buttons; no time-limited prompts.
- Motion: CSS only, every animation with a reduced-motion path (hard rule 9); a done milestone's tick
  draws itself (as plan maps' M3), nothing loops, no confetti.

## 12. Team, hackathon and open-source work

- `kind: 'team'`: a required **"What I did"** (`my_role`). Teammates are not named or stored (their
  personal information isn't ours to keep); "a team of 4" is enough. A shared repo shows only the
  student's own commit weeks.
- `kind: 'event'` (hackathons): date, event name as text, the student's role, evidence. No
  integration with event platforms.
- `kind: 'open-source'`: links to the student's public pull requests; GitHub summaries count only
  their own commits.
- Group work for marks follows §5 (for_marks) and §8.6 (group-work disputes in writing, early).

## 13. What Tumoolo measures (aggregate, ids only)

From the database, by a nightly job with ids only (hard rule 4), reported only for groups of **10 or
more** students:
- templates suggested, started, not-now, not-for-me (per template id and field);
- items by kind and status; threads started, changed, finished; milestones done per year of study;
- share links created and revoked, and total views (not per viewer);
- GitHub connected / disconnected counts.

**Never measured:** item words, evidence content, which recruiter or company, viewer identity, IP
addresses of viewers (the share page's rate limit keeps a hashed IP in memory only), time-on-page.
No third-party analytics. These measures answer "do suggestions help?" and feed D5 (funders,
universities) without anything personal.

## 14. Phase placement and dependencies

| Part | Delivers | Needs | Live by |
|---|---|---|---|
| **9a Portfolio and thread core** | Items, evidence (links, uploads), thread + milestones mapped to registrations, templates for the first fields, the coach in chat (integrity rules), export/delete, the crisis check on words | Phase 5c registrations (built); Phase 6 curricula years 2+ and module outlines (drafts → verified); consent wording (D12) | **Feb 2028**, with Phase 6 |
| **9b Suggestions and GitHub** | Covered concepts, light weeks, one suggestion per light week, push, GitHub App | Phase 6 academic calendar; **Phase 7 planner** (`WeekLoad`) | **Mar 2028**, with Phase 7 |
| **9c Sharing and Mmereko** | Share links (18+), the public page, the Mmereko export | A5 and A11 passed on 9a/9b; Mmereko agreement and P2's API in af-south-1 | After the audits; Nov 2028 as planned is fine |

Phase 8 (the partnership pilot) is untouched. The optional acceleration (§11: current university
students as testers) is the natural way to try 9a a year early, on synthetic or tester data.

## 15. API routes (web; the app calls the same)

All `requireReady` (signed in, consent, CSRF for writes), zod `.strict()`, ids only in logs.

| Route | Does |
|---|---|
| `GET /api/me/portfolio` | Settings, items (summary), thread with milestones |
| `PATCH /api/me/portfolio/settings` | Suggestions on/paused/off, hours, field |
| `POST /api/me/portfolio/items` · `PATCH` · `DELETE /items/:id` | Create from a template or blank; edit; delete. Returns `{ item, care }` (crisis check) |
| `POST /api/me/portfolio/items/:id/evidence` · `DELETE /evidence/:eid` | Link, upload (via upload intent), GitHub repo |
| `POST /api/me/portfolio/thread` · `PATCH /thread/:id` | Choose or change the thread |
| `PUT /api/me/portfolio/thread/:id/milestones/:mid` | Milestone status and words |
| `GET /api/me/portfolio/suggestion` | This week's suggestion or none (with reasons) |
| `POST /api/me/portfolio/suggestion/:id` | started / not-now / not-for-me |
| `POST /api/me/portfolio/github/connect` · `DELETE /github` · `POST /github/refresh` | GitHub App install redirect (state-bound), callback, disconnect, refresh |
| `GET /api/github/callback` | The App's setup callback (state checked, then token exchange) |
| `POST /api/me/portfolio/links` · `DELETE /links/:id` · `GET /links` | Create (18+, DB-checked), revoke, list with view counts |
| `GET /p/[token]` (page, not API) | The recruiter page: noindex, no cookies, strict CSP, rate-limited, 404 for expired/revoked/unknown alike |
| `POST /api/me/portfolio/mmereko` (9c) | Per-item opt-in send, per P2's contract |

The agent gains two tools: `portfolio_suggestion(student)` (read-only, the code's choice) and
`portfolio_items(student)` (read-only titles, statuses and skills, so coaching is specific). Item
words are wrapped as `learner_text` like the goal in their words; nothing from evidence files.

## 16. Owner decisions (recommended answer in bold; plan-keeping option first)

- **D1 Add the portfolio and thread to the plan, and re-time Stage 8.** Plan-keeping: Stage 8 as
  written, Phase 9, Nov 2028, small projects only. **Recommended: yes, as Phase 9 split into 9a (Feb
  2028, with Phase 6), 9b (Mar 2028, with Phase 7) and 9c (after A5/A11); Phase 8 unchanged.**
- **D2 Where module topics come from.** A) **catalogue module-outline records from the university's
  own handbook or outline (drafts until a person verifies), plus the student's uploaded outline for
  timing, confirmed by them**; B) the student types topics; C) the AI reads handbooks at run time
  (declined: hard rule 2's spirit). **Recommended: A.**
- **D3 When a topic counts as covered.** **Recommended: their confirmed schedule, their own tick,
  or a confirmed marked test; never a published week alone.**
- **D4 Skills.** **Recommended: a small Tumoolo list per field, each linked to a published framework
  where one exists (to verify), reviewed by a person**; not a large outside taxonomy imported whole.
- **D5 Templates and fields.** **Recommended: Tumoolo writes them; one reviewer per field (a
  lecturer or practitioner) adds `reviewedOn`/`reviewedBy`, unreviewed never shown (flag 8b);
  every template free, data-light, with a no-laptop path; CS/IT and engineering first, then
  commerce and sciences, then law, health, humanities, arts, education.**
- **D6 Suggestions.** Plan-keeping: Stage 8's "matched to free time" with no definition.
  **Recommended: off until the student turns them on; at most one per light week (§4.2); never in
  exam periods, a study plan's run-up or after a crisis/care moment that week; in-app and push only;
  "Not now", "Not for me", "Stop these" one tap.**
- **D7 The thread.** **Recommended: chosen any time from first year (offered in the first
  semester's first light week), one active at a time, changeable any time with past work kept;
  milestones mapped to registrations, not calendar years; never the graded capstone without the
  department's written permission.**
- **D8 How much the AI may help on ungraded portfolio work.** A) **coach only, never writes code,
  text or design, plus a "help I used" line on every item (plan-keeping with §8.4)**; B) allow
  AI-written snippets on ungraded work if declared. **Recommended: A.**
- **D9 GitHub.** Plan-keeping: links only. **Recommended: public links for everyone in 9a; a GitHub
  App (selected repos, metadata and contents read-only, summaries only) in 9b, for students 18 and
  over; under 18, public links only.** (The owner's word "OAuth" is kept in spirit: it is the
  learner's own sign-in to GitHub; an App is the read-only way to do it.)
- **D10 Recruiter links.** **Recommended: 18+ enforced in the database; private by default; each link
  shows only the items chosen for it; expires after 30 days by default, at most 90; revocable at
  once; noindex; no contact details, marks or student number on the page; a view count only.**
- **D11 School learners (Grades 10–12).** Plan-keeping: university only (Stage 8). **Recommended: a
  portfolio shelf (items, links, uploads) after guardian consent names it; no suggestions, no
  GitHub App, no sharing; CAPS-aligned suggestions later through the studios (§18), as their own
  proposal.**
- **D12 Consent.** **Recommended: add the portfolio lines to consent v4 / adult v3 if the draft has
  not yet gone to the lawyer (the next wave drafts it); otherwise a v5. Until legal signs off,
  words, uploads, GitHub and links sit behind `UF_PORTFOLIO_WORDS` (off; refused in production), as
  plan maps' words do; ticking template checklists works before.**
- **D13 Measurement.** **Recommended: §13 as written: aggregates for groups of 10+, ids only, no
  words, no viewer data, no third-party analytics.**
- **D14 Mmereko.** **Recommended: per-learner and per-item opt-in, pseudonymous id, no marks or
  uploads sent, draft only under 18, Mmereko in af-south-1 under an operator agreement; P2's API.**
- **D15 Uploads.** **Recommended: images and PDF only, 10 MB each, 100 MB per learner, no video in
  v1 (link a video hosted elsewhere instead).**
- **D16 Crisis check on portfolio words.** **Recommended: yes, the plan maps' pattern: check on save,
  save anyway, show the card at once, store nothing about it; red team at 100%.**

## 17. Costs

| Item | Cost | Notes |
|---|---|---|
| Module-topic research, 6 universities × first fields × 3–4 years | Large (research agents, then **a person verifies every record**) | The biggest cost; scales with fields and universities |
| Template writing and one reviewer per field | Writing: agent time; review: a paid lecturer or practitioner per field (owner's budget) | D5 |
| Academic calendars (Phase 6) | Medium, yearly refresh | Shared with Phase 6 |
| S3 storage | 100 MB cap per learner; most will use little | af-south-1 pricing |
| GitHub API | Free (App rate limits are per installation) | A weekly refresh job, ids only |
| Push | Free; no WhatsApp/SMS for suggestions | §7.4 unchanged |
| AI | Coaching in the existing chat; one short message per suggestion | Within the cost-per-student metric (D5) |
| Legal | Consent wording, privacy page, operator agreements (GitHub named, Mmereko) | Bundled with v4 if in time |
| Audits | A1, A2, A3, A4, A5, A7, A10, A11, A13 | §19 |

## 18. Test-first build plan (each step's tests fail first)

1. **Catalogue:** `moduleOutlineSchema`; curricula `yearOfStudy` 1..7; `academicCalendarSchema` (with
   Phase 6). Fail first: a topic with an inferred week (no source) refused; outline on a non-university
   domain refused; a topic id reused across modules refused; a year-2 curriculum validates; drafts
   never publishable. Integrity checks extended.
2. **`packages/portfolio` (pure):** concepts, skills, templates, threads, `coveredConcepts`,
   `isLightWeek` over a fake `WeekLoad`, `suggest`, `matchLayers(registrations)`. Fail first: an
   unreviewed template or mapping never suggested; a published week alone doesn't cover; an exam
   week, an assessment within 7 days, a study-plan run-up, a paused setting each return no
   suggestion; one per week; "not for me" never repeats; the recruiter line only at 18+; a repeated
   module moves its layer; an extended programme's foundation year; RN-safety guard (`pnpm check`,
   with the package added to rule 11's list, flag 8a).
3. **Content:** `en.portfolio` (new section file); a no-facts test (no requirement, score, fee or date
   in a template, as plan maps' §6 test); words owed the owner's review. Red team 100% (hard rule 7).
4. **Database (0031):** tables, RLS, consent gate and switch, the 18+ trigger, personal-number
   checks, limits, one active thread, cascade, export, audit rows. Fail first, also against real
   Postgres: another learner sees nothing; nothing before consent; words refused without the
   switch/consent; a share link refused at 17 years 364 days; the privacy-page test until the doc
   names every table.
5. **Crisis on save** (as plan maps' `plan-care.ts`) + new red-team cases for reflective project
   words. Fail first: a crisis description returns `care`, is saved, and nothing about it is logged.
6. **API** (§15), then **web** (portfolio page, thread timeline, suggestion card), then **app**
   (list, thread, suggestion, camera upload; GitHub and links open on the web if D9/D10 say so).
   RTL and RNTL (`await` render and fireEvent); Playwright + axe on a production build at 360, 768,
   1280, 1920px; Lighthouse ≥ 90 desktop; budgets unchanged.
7. **Integrity evals** (§5.5) in `packages/evals`; the agent's two read-only tools; A10.
8. **GitHub (9b)** against a fake GitHub with contract tests: state-bound install, selected repos
   only, summaries only, disconnect deletes the installation and the snapshots, no username or
   email stored, no token stored, a minted token never logged, refused under 18 (D9).
9. **Share page (9c):** token hashed; expired, revoked and unknown all 404 the same; noindex; no
   cookies; CSP; rate limit; only the chosen items; no marks or contact details; view count only.
10. **Docs and status:** design README section, privacy page and store answers (new tables, GitHub,
    Mmereko), planning.md (the re-timed Phase 9, by decision), status.md.

## 19. Audits owed

| Audit | Why |
|---|---|
| **A1** | The new package and tables (Phase 9 already owes A1) |
| **A2, A3** | New pages and the timeline; the public share page; WCAG 2.2 AA |
| **A4** | The share page and the portfolio page's budgets |
| **A5** | GitHub App flow, token storage, the public page, uploads, link tokens |
| **A7** | The app screens, camera upload, push |
| **A8** | No new dependency expected; checked anyway |
| **A10** | Integrity refusals, coaching tone, no streak or guilt language, crisis on free text |
| **A11** | New data, minors, consent wording, cross-border (GitHub), the Mmereko operator, share links, export/delete |
| **A13** | Module outlines, curricula years 2+, academic calendars |

**Waits for legal:** the consent lines (D12), the privacy page and store answers, the Mmereko
operator agreement. **Waits for a person:** every catalogue record's verification and every
template's review.
