# My plan maps: mind maps under My goal (design proposal)

> **Status: approved by the owner 2026-10-23, every recommended answer D1–D10.** Written by a design agent at the owner's request from five
> reference pictures (`plan-map-reference-1.jpg` to `-5.jpg` in the main checkout's `photos/design-references/`, git-ignored, not committed).
> Read-only review of worktree `UniversityFlow-design` (branch `phase-5/grade-10`). Nothing was edited.

Date: 2026-10-22.

**The owner's changes when approving (2026-10-23), which the build follows over the text below:**
the migration is **0030** (0029 is the profile photo); under today's consent (guardian v3,
adult-v2) a learner may choose a template and tick parts (statuses, order, slots), and their **own
words** (title, text, what got in the way, what to try differently) wait for consent v4, behind a
server switch `UF_MINDMAP_WORDS=1` (off by default, on in the owner's preview only, refused in
production) with the database refusing words unless the switch is on (§3.1, §5.3); the consent
line in §5.3 is a draft owed legal review, and the live consent version is not bumped; the app's
outline view now, its Picture view later (D6); the profile's "goal in their words" is
crisis-checked in its own change (D9).

The owner's request: under My goal, learners and university students write a mind map of their plans
"from young age till they finish university", from about five templates, and mark each part
achieved or not achieved, with why not and what they could do differently.

## 0. Summary

**My plan maps** is a new section on the My goal page (web `/goals`, the app's My goal screen). A
learner picks one of **five templates** (Six stops, Thinking cloud, Staircase, Life map, The road),
each a fixed shape with default branches from Grade 10 to graduation and placeholder prompts. They
write their own words in the nodes, add or remove nodes within limits, and mark each node
**Planned**, **Achieved** or **Not achieved**. "Not achieved" opens two kind prompts: **"What got in
the way?"** and **"What could I try differently?"**

The map is **one nested list in the page** (the outline). From a set width the same list is laid out
as a picture (radial, staircase, road); on phones and in the app it stays an outline. Status is
always a word and an icon, never colour alone.

What makes this harder than the profile look (`docs/design/profile-look-proposal.md:234-243` chose fixed
words because free text "needs moderation… self-harm cues that would oblige a crisis response"):
**this feature is free text from minors by nature**, and "why didn't I achieve this" is where
distress shows up. So the proposal:

- runs the **existing deterministic crisis check** (`assessDistress`, `packages/agent/src/crisis.ts:434`)
  on every saved text and shows the **crisis card** at once, never a silent store (§5.2);
- keeps the text **out of the AI prompt** by default, out of logs, job payloads and fixtures, and **in
  Download my data**, deleted with the account (§5.1);
- needs **consent wording that names it** (guardian v4, adult v3), refused in the database under older
  wording as offer letters were (migration 0021); until then a learner can still **tick** a template's
  stops but not write (§5.3);
- lets templates **name stages only**: a requirement, a score or a deadline is always a link to the page
  that computes it (§6).

### Plan-drift flags (the owner should know before saying yes)

1. **This is a new feature outside the plan.** Planning.md §3 Stage 3 lists the Goal card, the Exam
   countdown and "What I need per subject" as My goal's artifacts (`planning.md:212-215`), and
   §11 has no mind-map phase. Building it means a new item (call it **G10-8 / Phase 5g**, the owner's
   naming), its own audits (A2 accessibility, A10 crisis, A11 privacy) and a status.md entry. It does
   not change a locked decision (§0).
2. **"From young age"**: UniversityFlow starts at Grade 10 and refuses Grade 9 and under-13s
   (`planning.md:470-472`; `docs/store/privacy-and-data-safety.md:12-16`). The templates start at
   **"Where I am now"** and Grade 10, with an optional "Before Grade 10: what got me here" reflection
   node. Nothing invites a younger child to sign up.
3. **Consent v4**: writing in a map needs new guardian wording and a legal review (A11-10 is already
   open for v3). The profile-look proposal also queued a v4 for the photo
   (`docs/design/profile-look-proposal.md:256-258`). Recommended: one v4 for both.

## 1. What the five pictures show (UI pattern only)

People, brands and text in the pictures are not described or copied.

**Picture 1 (`plan-map-reference-1.jpg`): starburst and six cards.**
- Portrait page on a warm cream ground; doodle decorations in the corners (clouds, bulbs, lenses).
- **Centre: a spiky starburst** (pink) with a two-line title in a hand-drawn font.
- **Six rounded-rectangle cards** arranged in a ring around it (top, upper-left, upper-right, lower-left,
  lower-right, bottom). Each has a **different pastel fill** (pink, green, blue, peach, lilac, mint), a
  thick dark outline and an **offset drop shadow** (sticker look), a bold heading and 4–5 centred lines.
- **Connectors: looping, curly black arrows** from the centre out to each card.
- **Levels: 2** (centre → six cards; the card body is text, not further nodes).

**Picture 2 (`plan-map-reference-2.jpg`): sketchnote cloud with notes.**
- White ground, bold black hand lettering; a large script word as the page title.
- **Centre: a light-blue cloud** with mixed type sizes (script, then a big patterned all-caps word).
- Around it, **free-placed elements of different shapes**: square sticky notes (yellow, pink) with an offset
  hatched shadow, an oval bubble, a circle, **black label strips with white monospaced caps** (like tape),
  small icons (bulb, clock, brain, heart, an exclamation dot).
- **Arrows give direction**; the layout is meant to be **read clockwise**.
- Emphasis by **all caps** for important items and a coloured multi-hue word.
- **Levels: 2**, irregular; no strict ring.

**Picture 3 (`plan-map-reference-3.jpg`): habit ring, signpost and staircase.**
- Notebook page, coloured-pencil look, small sparkles and dots.
- **Centre: a scalloped cloud** holding a quote.
- **Six circles in a ring** around it, each a different colour outline with a soft fill, an
  **uppercase label over a small icon** (target, checklist, runner, shield, rocket, calendar). **Two-headed
  dotted arrows link neighbours**, so the ring reads as a **cycle**, and short arrows point inward.
- Left: a **signpost** with four arrow boards alternating left/right (a four-step loop of verbs).
- Bottom-right: a **staircase** of coloured blocks, each step labelled, rising from a grey "start"
  block to a top step, with small figures climbing it: **progress shown as height**.
- **Levels: 2** in the ring; the staircase is an **ordered sequence** (1 level, 8 steps).

**Picture 4 (`plan-map-reference-4.jpg`): numbered life map.**
- Cream ground, fine line art, many small icons.
- **Centre: a circle** with a heading, a **ribbon banner** across it (three words) and a short statement.
- **Seven numbered branches**, each a **thick curved coloured line** from the centre to a **pill header**
  (a numbered circle + uppercase title + a bracketed subtitle in the same colour).
- Under each header, **bullets**, a numbered list with icons, or a **small flow** (three step boxes linked
  by arrows; four cloud shapes each with a down arrow to a reframed word; morning/day/evening rows).
- Footer: a quote strip and a signpost "destination".
- **Levels: 3** (centre → numbered branch → items; some items have a sub-flow).

**Picture 5 (`plan-map-reference-5.jpg`): the road map.**
- Off-white ground, muted sage, rose and sand palette, watercolour trees and mountains.
- **A winding road** from a "start" sign bottom-left to a **flag** on a mountain top-right.
- **Four milestone cards** placed alternately left and right of the road, each with a coloured tab label,
  a star bullet "what you will achieve", two "key step" bullets and a **"target date: ____" line**; a
  **round star marker** on the road ties each card to its point.
- A "big goal" card with a blank line to write on; a "why it works" tick list; a **five-step how-to strip**
  of round icons joined by chevrons.
- **Levels: 3** (destination → milestones → key steps), in **one ordered sequence**.

**What we take:** a centre with a distinct shape; branches as cards with a heading and a few lines; a
numbered, clockwise reading order; the ring-as-cycle; the staircase and the road as ordered progress;
"target date" lines; icons beside labels; the offset sticker shadow. **What we leave:** the cream paper
(we keep the one dark theme, `docs/design/README.md:6-13`), hand-drawn fonts (we keep Outfit), the
people figures, decorative doodles beyond a few tokenised icons, quotes and slogans (none of the
pictures' wording is reused).

## 2. The five templates

All prompts are **placeholders** (shown greyed in an empty node, never saved as the learner's words),
written for any learner, no gender, plain South African English. Stage names only: no requirement,
score, fee or date (§6). "Uni" is avoided in favour of "university or college". Each template's
stops are **slots** with fixed ids (`slot:grade-10`), so wording can change without migrating data.

Every template has a centre. The centre can be **linked to My goal**: it then shows the course and
university **read live from the goal card** (`packages/agent/src/goals.ts:35-48`), never copied into
the map; with no goal, the centre says "Choose a goal on this page" and keeps the learner's own words.

### T1 "Six stops" (from picture 1: starburst centre, six cards in a ring)

| Slot | Heading | Placeholder |
|---|---|---|
| centre | My plan | "What I want to be doing when I finish studying" |
| 1 (top) | Grade 10 | "Subjects I'm taking, and what I want from this year" |
| 2 | Grade 11 | "The marks I'm working on, and how" |
| 3 | Matric | "How I'll prepare for my final exams" |
| 4 | Applying | "Where I'll apply, and who will help me with forms and funding" |
| 5 | First year | "How I'll settle in: where I'll live, how I'll study" |
| 6 (bottom) | Finishing my qualification | "What I want to have done by the end" |

Levels: centre → 6 stops → up to 6 items each. Shape: a 12-point star (CSS `clip-path` polygon,
decorative) at the centre; six cards on a ring, each in one of six **map tones** (§8.3).

### T2 "Thinking cloud" (from picture 2: cloud centre, free notes, read clockwise)

A brainstorm before planning. Centre: "The life I want after my studies". Six notes, clockwise:

| Slot | Heading | Placeholder |
|---|---|---|
| 1 | Why I want it | "What matters to me about this" |
| 2 | What I'm good at | "Things people say I do well" |
| 3 | What I want to learn | "Subjects, skills or courses I'm curious about" |
| 4 | Who can help me | "A teacher, a family member, a friend, a mentor" |
| 5 | What might get in the way | "Money, distance, time, marks: write what's real for me" |
| 6 | My first small step | "Something I can do this week" |

Levels: centre → 6 notes → up to 6 items. Notes take three shapes (square note, oval, label strip) in
rotation, purely visual. "What might get in the way" is the node most likely to carry distress (§5.2).

### T3 "Staircase" (from picture 3: steps rising from a start block)

An ordered climb, bottom to top. Centre: "Where I want to reach".

| Step | Heading | Placeholder |
|---|---|---|
| 0 | Where I am now | "My grade, my subjects, how I feel about school right now" |
| 1 | Finish Grade 10 | "One thing I want to get better at" |
| 2 | Finish Grade 11 | "My plan for my end-of-year report" |
| 3 | Write matric | "How I'll study for my finals" |
| 4 | Get in | "Applications and funding I'll sort out" |
| 5 | Pass first year | "How I'll keep up with my modules" |
| 6 | Each year after | "What I'll do to keep going" |
| 7 | Graduate | "What I want to do next" |

Optional side group **"My habits"** (from the picture's ring of six circles, a cycle): Focus, Planning,
Action, Self-belief, Motivation, Keeping at it, each with "What this looks like for me". Levels:
centre → 8 steps (+ habits) → up to 4 items. A learner further on (a university student) starts by
marking the earlier steps Achieved in one go ("Mark the steps I've done").

### T4 "Life map" (from picture 4: numbered branches with headers and bullets)

Centre: "Me, and where I'm going", with an optional one-line banner of three words the learner writes.

| # | Heading (subtitle) | Placeholder |
|---|---|---|
| 1 | Who I am (my strengths) | "Three things I like about how I work" |
| 2 | What holds me back | "Thoughts or things that slow me down" |
| 3 | What I want (by the end of my studies) | "Up to four things, in my words" |
| 4 | My path (school to graduation) | "The big steps, in order" (sub-steps: Grade 10 → Graduation, as T3) |
| 5 | Turning it around | "For each thing that holds me back: what I'll tell myself instead" |
| 6 | My people | "Who I can ask, and for what" |
| 7 | My week | "Mornings, school days, evenings: one thing for each" |

Levels: centre → 7 branches → items → (branch 4 and 5 only) one more level. Branch 2 and 5 are a
reflective pair, as in the picture's "blocks → reframes" flow. Branch 2 needs the crisis check most.

### T5 "The road" (from picture 5: a winding road, milestone cards, target dates)

Centre (the flag): "My big goal" (linkable to My goal). Start sign: "Where I am now".

| Milestone | Heading | "What I'll achieve" placeholder | Key steps (up to 3) |
|---|---|---|---|
| 1 | Grade 10 and 11 done | "The report I want to walk away with" | "Step I'll take" |
| 2 | Matric done | "How I want to finish school" | |
| 3 | Accepted | "Where I'll be studying" | |
| 4 | First year passed | "How I'll know it went well" | |
| 5 | Graduated | "What it will feel like" | |

Each milestone has an optional **"Target: month and year"** the learner picks. It is their own aim,
labelled "My target", never a real deadline (§6). Levels: flag → 5 milestones → up to 3 key steps.

### Template rules common to all

- A learner may **rename, add, move and remove** nodes (within §3.3's limits). A removed slot can be put
  back from "Add a stop from this template".
- Templates are a fixed list in `packages/ui` (ids, slots, order, layout kind, links) and words in
  `packages/content` (`en.planMaps`), so both apps read one source (hard rules 8, 11).

## 3. Data, API, migration

### 3.1 Migration `0029_plan_maps.ts` (0028 is the profile look; **take the next free number** when
building, another may land first). Append-only.

```sql
create table plan_maps (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  template_id text not null check (template_id ~ '^[a-z0-9-]{1,40}$'),
  title text check (char_length(title) <= 60),
  links_goal boolean not null default false,          -- the centre shows My goal, read live
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plan_maps_student on plan_maps (student_id, created_at);

create table plan_map_nodes (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references plan_maps (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,  -- for row-level security
  parent_id uuid references plan_map_nodes (id) on delete cascade,      -- null = the centre
  depth smallint not null check (depth between 0 and 3),
  position smallint not null check (position between 0 and 59),
  slot_id text check (slot_id ~ '^slot:[a-z0-9-]{1,40}$'),             -- null = learner-added
  text text check (char_length(text) <= 120),
  status text not null default 'planned' check (status in ('planned', 'achieved', 'not-achieved')),
  why_not text check (char_length(why_not) <= 500),
  differently text check (char_length(differently) <= 500),
  target_month date check (target_month is null or extract(day from target_month) = 1),
  status_changed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (map_id, parent_id, position) deferrable initially deferred
);
create index plan_map_nodes_map on plan_map_nodes (map_id, parent_id, position);
create index plan_map_nodes_student on plan_map_nodes (student_id);

-- Free text never keeps an ID or student number (A11-17's rule, 0021's uf_holds_personal_number).
alter table plan_map_nodes add constraint plan_map_nodes_no_personal_number check (
  not uf_holds_personal_number(coalesce(text, '') || ' ' || coalesce(why_not, '') || ' ' || coalesce(differently, ''))
);
alter table plan_maps add constraint plan_maps_no_personal_number check (
  not uf_holds_personal_number(coalesce(title, ''))
);

-- Writing words needs consent wording that names plan maps (guardian v4, adult-v3), as 0021 did
-- for offer letters: uf_consent_covers_plan_text(sid), the same shape as
-- uf_consent_covers_university_documents (0021:24-42), and a trigger refusing a non-null
-- title/text/why_not/differently without it. Statuses, order and slots need only uf_may_process.

alter table plan_maps enable row level security;
alter table plan_map_nodes enable row level security;
create policy plan_maps_consented_self on plan_maps
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
create policy plan_map_nodes_consented_self on plan_map_nodes
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id)
              and exists (select 1 from plan_maps m where m.id = map_id and m.student_id = student_id));
grant select, insert, update, delete on plan_maps, plan_map_nodes to uf_app;
```

The RLS policy copies `0026_reply_reports.ts:16-20`. The function name for 0021's personal-number
rule must be checked when building (the store's twin is `holdsPersonalNumber`,
`packages/db/src/store.ts:284-297`, which says "Migration 0021's `uf_holds_personal_number` is the
same rule").

**Limits** (store checks with a reason, plus the DB where it can): **10 maps** per learner; **60 nodes**
per map; **12 children** per node; depth 0–3; text 120, each reflection 500, title 60 characters;
`target_month` from 2020 to 2040 (a sanity range, not a deadline). Reflections are **kept when a
node later becomes Achieved** ("didn't work the first time, then did"), shown as "What I learned last
time", and removed only when the learner clears them or deletes the node.

**`schema.ts`** gains `planMaps`, `planMapNodes` (next to `goals`, `packages/db/src/schema.ts:324-329`).
**Store** (`StudentStore`): `planMaps()`, `planMap(id)`, `createPlanMap(templateId, slots)`,
`updatePlanMap(id, patch)`, `deletePlanMap(id)`, `savePlanNode(mapId, node)`, `movePlanNode(...)`,
`deletePlanNode(...)`. Audit rows with **fixed action words and ids only** (`plan-map.created`,
`plan-map.node-saved`, `plan-map.deleted`), as the goal does (`packages/db/src/goals.test.ts:44-60`).

### 3.2 API routes (web; the app calls the same, D6 in CLAUDE.md)

| Route | Does | Guards |
|---|---|---|
| `GET /api/me/plan-maps` | The learner's maps (id, template, title, counts by status, updated) | `requireReady` (signed in, consent, CSRF for writes) as `apps/web/app/api/me/goal/route.ts:13-17` |
| `POST /api/me/plan-maps` | Create from a template id (+ `linksGoal`) | zod `.strict()`; `templateId` ∈ `PLAN_TEMPLATE_IDS`; 10-map cap → 409 |
| `GET /api/me/plan-maps/:id` | One map with its nodes, and the goal card's name when linked | 404 if not theirs (RLS returns nothing) |
| `PATCH /api/me/plan-maps/:id` | Title, `linksGoal` | text rules below |
| `DELETE /api/me/plan-maps/:id` | Delete a map | |
| `PUT /api/me/plan-maps/:id/nodes/:nodeId` | Create or update one node: `text`, `status`, `whyNot`, `differently`, `targetMonth` | **returns `{ node, care }`** (§5.2) |
| `POST /api/me/plan-maps/:id/nodes/:nodeId/move` | `{ parentId, position }` (keyboard "Move up/down/out/in") | depth and child caps |
| `DELETE /api/me/plan-maps/:id/nodes/:nodeId` | Delete a node and its children | the centre can't be deleted |

zod for text: `z.string().trim().max(120)` (and 500), `.nullable()`; `status: z.enum(PLAN_STATUSES)`;
`targetMonth: z.string().regex(/^\d{4}-\d{2}$/)`. Unknown keys → 400 (`.strict()`, as
`apps/web/app/api/me/goal/route.ts:19`). One save per node per press (the page's `inFlight` pattern,
`apps/web/app/(app)/goals/goals-view.tsx:48-68`).

### 3.3 Export and deletion

- **Export:** `exportAll()` (`packages/db/src/store.ts:3033-3112`) gains
  `planMaps: [{ ...map, nodes: [...] }]` under `personal`, next to `goal` (`store.ts:3090`). The
  learner's words appear in their download verbatim (it is theirs; POPIA s23).
- **Deletion:** both tables cascade from `students` (delete account); a map deletes its nodes. No files.
- **The privacy-page test** (`docs/store/privacy-and-data-safety.md:9-10`: "fails when a table
  holding a learner's rows… is not named") fails until both tables are in the Learner tables list: a
  free test-first step.

## 4. Where it lives and how it ties to My goal

- **Web `/goals`** (`apps/web/app/(app)/goals/goals-view.tsx:115-239`) today: goal card, change goal,
  exam countdown, practice (`#practice`), exam subjects. A new card **"My plan maps"** goes **after
  "Change my goal"** and before the exam countdown: the goal and the plan belong together; the
  countdown and practice stay reachable.
  - The card: the heading, one muted lead ("Map your plan from Grade 10 to graduation, in your own
    words. Only you can see it."), the learner's maps as rows (title, template, "4 achieved · 1 not
    achieved · 7 planned"), and **"Start a new map"**. Empty state per the one-rhythm rule: a muted line
    inside the card (`docs/design/README.md:43-48`).
  - Opening a map goes to **`/goals/maps/[id]`**, a full page (the map needs the width), with "Back to
    My goal". Page title: the map's title or the template's name. `Page` + `StatusLine`
    (`docs/design/README.md:38-42`).
- The page title "My goal and exams" (`packages/content/src/en/goals.ts:3`) and nav label "My goal"
  (`packages/content/src/en/nav.ts:10`) stay. The lead may gain "…and your plan" (owner's wording).
- **App:** a "My plan maps" card on the goal screen (`apps/native/app/goals.tsx:109-226`, after the
  goal buttons) opening a new screen `app/plan-map.tsx` (outline only, §8.5).
- **The goal tie:** `links_goal` only. The centre shows the course name and university from the goal
  card the page already builds (`apps/web/lib/server/goals.ts:80-89`), plus a link "Where I stand for
  this course" to the goal card on `/goals`. **Nothing about the course is stored in the map**, so a
  changed or removed goal updates the centre, and an unverified course is never shown (the goal card
  already returns null for what the learner may not see, `goals.ts:52-53`).
- **Home**: nothing in v1. (Later, a journey step? Owner's call; the journey has fixed steps,
  `docs/design/README.md:356-357`.)

## 5. Privacy, safety and consent (the hard part)

### 5.1 Free text from minors

| Question | Plan-keeping answer | Recommendation | Cost |
|---|---|---|---|
| Is it personal information about a minor? | **Yes**, and reflections can touch health, family and money: treat as **sensitive** (`planning.md:492-493`) | Same | — |
| Logs, job payloads, analytics, snapshots, fixtures (hard rule 4) | Never. API errors log ids and codes only; tests use synthetic words ("Practise past papers"); no reminders carry it | Add the routes to the existing log-capture tests and a fixtures check | Small |
| Download my data / deleted with the account | Yes (§3.3) | Same | Small |
| Length caps | 120 per node, 500 per reflection, 60 per title | Same | — |
| Personal numbers | Refuse an ID or student number shape (A11-17's rule, DB and store) | Same; **no** phone/email filter (private to the learner; a filter would refuse "call aunt Thandi" style notes and add little) | Small |
| Sent to the AI provider? | **No.** Not in the prompt, not in memory, not in any tool | **No in v1.** Later, an explicit per-map "Share this map with my companion" (D4), wrapped as `learner_text` like the goal in their words (`packages/agent/src/system-prompt.ts:107-114`) | Sharing later = a `packages/agent` change (hard rule 7), consent wording that names it, an A10 + A11 round |
| Who sees it | Only the learner; no sharing exists; the guardian sees nothing; staff only through the audited access path (`planning.md:498-501`) | Same | — |
| Moderation | None by people (it's private to the learner); the crisis check (5.2) is the only automated reading, and it runs on our server in South Africa | Same | — |

Note for the owner: free text from learners already exists in two places, the profile's "goal in
their words" (200 characters, `apps/web/app/api/me/route.ts:37`) and memory notes
(`packages/db/src/schema.ts:170-177`), and the goal text goes into the AI prompt. **The profile goal
is not crisis-checked today** (only chat and inbound SMS/WhatsApp call `assessDistress`:
`packages/agent/src/runner.ts:56`, `apps/web/lib/server/crisis-reply.ts:44,67`). If the owner adopts
5.2 for maps, the same check should run on the profile goal (a small follow-up, logged as a finding).

### 5.2 Crisis words in a map (never a silent store)

**What exists:** `assessDistress(text)` is a deterministic, pure function (`packages/agent/src/crisis.ts:1-16,434-444`)
returning `none | concern | crisis` and topics. In the chat, `crisis` stops coaching and shows the
fixed reply and the crisis card; `concern` shows the card with the answer (`runner.ts:56-85`). The
card comes from verified helpline records only (`crisisCard`, `packages/agent/src/tools.ts:886`), with
words that promise only what the lines can keep (`packages/content/src/crisis.ts:23-37`).
`assessCare` covers the non-crisis hard moments, including "wanting to give up on the goal"
(`packages/agent/src/care.ts:4-13`).

**Proposed for maps:**
1. Every `PUT …/nodes/:nodeId` and `PATCH` (title) runs `assessDistress` on the **text, why_not and
   differently joined** (and the node's text with its reflections, so "Grade 11" + "I wanted to
   disappear" is read together, as `assessWithPrevious` does for split bubbles, `crisis.ts:448-463`).
2. **The text is saved anyway.** Refusing to keep a learner's honest reflection would punish them for
   being honest. The response carries `care: null | { level, card }`, the card built by the same
   `crisisCard(helplines, topics, campusLines)` as the chat (verified lines only, the learner's campus
   lines when they have an accepted offer).
3. **The UI shows it at once**, under the field that was saved, as the existing crisis card component
   (`apps/web/components/crisis-card.tsx:13`, `apps/native/components/artifact-card.tsx:209`), with
   the reviewed words from `crisisWords(...)`. **Focus moves to the card's heading** and it is
   announced (live region; `useAnnounce` in the app). For `crisis`, a line above the card: "What you
   wrote matters. You don't have to carry it alone." (new wording, owed review) and **"Talk to someone
   now"** first; for `concern`, the softer lead and a link **"Talk it through with my companion"**
   that opens the chat **empty** (the map text is not sent, 5.1).
4. The card stays on the map page until dismissed ("I've seen this"), and comes back the next time
   that node is saved with such words. It is **never** shown to anyone else, **not stored** (no
   "distress" column, no audit row naming it, no log line: hard rule 4, as `crisis-reply.ts:19` says
   for SMS: "The message text is only read here; it is never stored or logged").
5. `assessCare` topics (give up, bad result, family pressure) → no card; one muted line under the
   reflection: "A step that didn't work out is part of the road, not the end of it." (owed review).
6. **Placement in code:** a server helper `apps/web/lib/server/plan-care.ts` calls the existing exports.
   **No change to `packages/agent`'s rules is required.** New strings go in `packages/content`, so
   **hard rule 7 applies: the red-team suite runs and must pass 100%** (it is in the gate,
   `status.md:18`: 165 cases).
7. **New red-team cases** in `packages/evals` for reflective, past-tense phrasing typical of "why
   didn't I achieve this" ("I failed because I wanted to die that year", "nothing worked so what's the
   point of living", "I didn't finish because I was hurting myself", "my uncle hit me so I couldn't
   study") and false-alarm controls ("I killed it in maths", "I died laughing at the trial results",
   "Romeo and Juliet essay on suicide") through `assessDistress`. If a reflective case fails, that is a
   `packages/agent` rule change with its own A10 round.

**Charter fit:** the prompts never shame (`planning.md:333`: "No comparing the student to others, no
'you should have'"). Hence "What got in the way?" (not "Why did you fail?") and "What could I try
differently?" (not "What should you have done?"), and "Not achieved" is shown in a neutral tone, not
the danger red (§8.3).

### 5.3 Consent wording

**Today:** guardian consent v3 (`packages/content/src/en/consent.ts:47`) lists "their cellphone number,
date of birth, marks, uploaded documents and chats, and the offers, registered modules and first-week
progress they confirm" (`consent.ts:17`) and "Chats with them about their goals and studies"
(`consent.ts:12`). The store page lists "a goal in their words" (`docs/store/privacy-and-data-safety.md:41`,
`:116`) and "Goal, shortlist, applications…" (`:51`). **Nothing names free-written plans or
reflections about not achieving them**, which may touch health or family.

| Option | What | Cost |
|---|---|---|
| **A (plan-keeping, recommended)** | **Guardian v4 and adult-v3** add: "Plans and mind maps they write in their own words, including what got in the way. Only they can see them. They are not sent to our AI provider." The database refuses **words** in a map under older wording (trigger as `0021_university_documents_consent.ts:24-60`); **statuses and template stops work under v3** (ticking "Grade 10: Achieved" is like first-week progress). The learner sees the existing kind of message ("They need to agree to the new wording first", `packages/content/src/en/errors.ts:9-15`) with "Send the new link". **Legal review** with A11-10, and the profile photo's v4 in the same bump. Privacy page and store answers updated (Apple "Other User Content", Play "Other user-generated content" already cover "goals and plans": add "plan maps and reflections"). | A consent bump, a guardian re-agreeing for each existing minor, legal review time; the words wait for it |
| B | Treat maps as covered by "goals" and "chats" in v3 | No delay, but a reflection about health or family is a new kind of information the guardian never saw named: weak under POPIA s34–35 and likely an A11 finding |
| C | Fixed reasons only (chips: "Ran out of time", "Money", "Marks", "Things at home", "Changed my mind", "Something else") and no free text | No consent change for reasons, no crisis exposure; but fails the owner's request ("why they didn't… what they could do differently" in their words) |

## 6. Admission facts stay out (hard rule 2)

- Templates **name stages**: Grade 10, Grade 11, Matric, Applying, Accepted, First year, Graduate. No
  requirement ("you need 30 APS"), score, minimum, deadline, fee or date is ever in a template, a
  placeholder, or a hint.
- Where a stop naturally wants a fact, it carries a **link** (from the template's slot, `packages/ui`)
  to the page that computes it: Matric → "Where I stand for my goal" (`/goals`), Applying →
  "Application dates and documents" (`/applications`), "See what I need per subject" (`/results` /
  What I need), Accepted → My offers, First year → My modules. The app maps them with `nativeRoute`;
  where the app has no screen, the existing "Open UniversityFlow on the web" line
  (`docs/design/README.md:317-320`).
- The **learner's own target month** (T5) is labelled "My target" and never compared with a real date.
- A test in `packages/content` fails if any `en.planMaps` string contains a digit other than the grades
  10, 11, 12, a `%`, "APS", "R" followed by a digit, or a month name (a cheap guard against a fact
  slipping into a prompt).

## 7. Accessibility (WCAG 2.2 AA)

**One DOM, two layouts.** The map is always a **nested list in reading order** (`ol` for ordered
templates T3/T5, `ul` otherwise): centre as the page's `h2`, each branch an `li` with an `h3`, its items
nested `li`s. The radial / staircase / road picture is **CSS layout of that same list** from a set
width; the connector lines are one `aria-hidden` inline SVG behind it. There is no second copy of the
content, so the screen-reader version cannot drift from the visual one.

- **Not `role="tree"`.** The ARIA tree pattern (arrow-key navigation, single tab stop) is easy to get
  wrong and unfamiliar to many learners; headings + lists + buttons are robust with every reader.
- **Each node** reads: "Grade 11. Not achieved. What got in the way: …" via text, not colour. Status is
  a visible **word plus icon**: Planned (empty circle), Achieved (tick), Not achieved (a curved
  "try again" arrow). A visually hidden "Step 3 of 8" in T3/T5.
- **Editing** is buttons, not drag: each node has **"Edit"** (opens its editor) and a **"More"** menu:
  Add a step under this, Move up, Move down, Move out a level, Move in a level, Delete. Moving keeps
  focus on the moved node. Delete asks inside the page ("Delete 'Grade 11' and its 3 steps?" with Delete /
  Keep: no `confirm()`), then focuses the previous sibling.
- **Status** is a **radio group** (fieldset + legend "How did this go?"), three 44px options. Choosing
  "Not achieved" reveals the two reflection fields right under it (`aria-expanded` on the group,
  focus stays on the radio); nothing is required.
- **Focus order** = outline order = the picture's clockwise order (picture 2's "read clockwise"): the
  radial layout places branch 1 at the top and goes clockwise, so sighted and keyboard order agree
  (WCAG 2.4.3). Focus never drops to `body` (the page's existing rule, `goals-view.tsx:41-46`).
- **Targets 44px** (`tokens.target`, `packages/tokens/src/index.ts:197-198`), 32px only for mouse rows
  from 64rem as the sidebar does.
- **Text contrast:** node text `ink` on the tone's soft fill (each pair added to the tested pairs);
  focus ring `focus` with ≥3:1 on every tone.
- **Reflow (1.4.10):** at 360px the page is the outline only; nothing scrolls sideways. The picture
  layouts switch on at **48rem** (T1, T2, T4 radial) and **40rem** (T3, T5 vertical first, then
  alternating). Zoom 200% on a 1280 screen → the outline.
- **"Show as: Picture | List"** toggle (two buttons with `aria-pressed`) from 48rem, so a learner who
  prefers the list on a big screen can have it (remembered per browser).
- Saved / error messages through `StatusLine` (announced). Crisis card per 5.2.
- Forced colours: tones drop to `CanvasText` borders; icons keep meaning.
- Placeholder prompts are **visible hint text** (`aria-describedby`), not only `placeholder=`, which
  disappears when typing and is weak for screen readers.

## 8. The look and the editing experience

### 8.1 Web, desktop (from 64rem), T1 "Six stops"

```
My goal  >  My plan maps  >  My six stops                          [ Picture | List ]
+-------------------------------------------------------------------------------------+
|                         +---------------------+                                     |
|                         | 1 GRADE 10   (tick)  |                                     |
|                         | Achieved             |                                     |
|                         | - Took Maths, not Lit|                                     |
|                         +----------\----------+                                      |
|  +---------------------+            \             +---------------------+           |
|  | 6 FINISHING         |       .-*-*-*-*-.        | 2 GRADE 11          |           |
|  | Planned  ( )        |-----* My plan    *-------| Not achieved  (<-)  |           |
|  +---------------------+    * BEng Civil, *       | Got in the way: ... |           |
|                              * UJ (goal)  *       +---------------------+           |
|  +---------------------+      '-*-*-*-*-'         +---------------------+           |
|  | 5 FIRST YEAR        |-------/      \-----------| 3 MATRIC            |           |
|  | Planned             |                          | Planned   Target: Nov |         |
|  +---------------------+    +---------------------+---------------------+           |
|                             | 4 APPLYING  Planned  |                                |
|                             | -> Application dates |   (link to /applications)      |
|                             +---------------------+                                 |
+-------------------------------------------------------------------------------------+
  Selected: "Grade 11"                                      side panel (right, 22rem) ->
  +------------------------------------+
  | Grade 11                           |
  | [ The marks I'm working on…      ] |  120 characters, counter "84 left"
  | How did this go?                   |
  | ( ) Planned (o) Not achieved ( ) Achieved |
  | What got in the way?               |
  | [                                ] |  500
  | What could I try differently?      |
  | [                                ] |  500
  | My target  [ Month v ] [ Year v ]  |
  | [ Save ]  [ Cancel ]   Saved.      |
  +------------------------------------+
```
- Click or Enter on a node's **Edit** opens the side panel; the map stays visible (the edited card
  highlighted with an outline, not colour alone). Save = one PUT.
- Connectors: curved paths from the centre to each card (picture 1's curl reduced to one gentle loop,
  drawn as an SVG path with `stroke: lineStrong`).

### 8.2 The same map at 360px (and the app)

```
+--------------------------------+
| < My goal                      |
| My six stops                   |
| Only you can see this map.     |
| [ Add a stop ]                 |
|                                |
| (*) My plan                    |
|     BEng Civil, UJ  (my goal)  |
|     Where I stand ->           |
| ------------------------------ |
| 1  Grade 10          (v) Achieved
|    - Took Maths, not Lit       |
|    [ Edit ]  [ More ]          |
| 2  Grade 11      (<-) Not achieved
|    Got in the way: …           |
|    Try differently: …          |
|    [ Edit ]  [ More ]          |
| 3  Matric         ( ) Planned  |
|    My target: Nov 2028         |
|    [ Edit ]  [ More ]          |
| 4  Applying       ( ) Planned  |
|    Application dates ->        |
| …                              |
+--------------------------------+
```
- **Edit** opens the editor **in place** under the node (not a modal: a modal on a 360px phone with a
  keyboard open is cramped, and in-place keeps the scroll position); one editor open at a time.
- A thin coloured left border per branch (its tone) is the only "map" cue; the order is the map's.

### 8.3 Shapes and tones by template (all from tokens)

| Template | Centre | Branches | Connectors | Picture layout from |
|---|---|---|---|---|
| T1 Six stops | 12-point star (`clip-path`) | 6 cards in a ring, offset sticker shadow | curved paths | 48rem |
| T2 Thinking cloud | cloud (SVG path, aria-hidden) | square note / oval / label strip in turn | short arrows, clockwise | 48rem |
| T3 Staircase | flag at the top | blocks rising left to right; habits as a ring of circles beside | none (the steps touch); ring: two-headed dotted arcs | 40rem |
| T4 Life map | circle + ribbon | 7 numbered pill headers, bullet lists | thick curved lines in the branch tone | 64rem (7 branches need width) |
| T5 The road | flag on a hill | milestone cards alternating sides of a road | the road (a wide dashed path), star markers | 40rem |

**Map tones:** six new token pairs `mapTone1..6` + `mapTone1Soft..6Soft` (dark soft fills, the accents
used for borders, numbers and lines), checked like the profile themes (`docs/design/profile-look-proposal.md:189-200`):
`ink` on each soft ≥ 4.5, accent on `surface` ≥ 3 (non-text), `focus` on each soft ≥ 3, each accent a set
distance from `focus` and from `success`/`warning`/`danger`/`info` so a branch colour never reads as a
status. The profile themes' accents (`profileOcean`, `profileFynbos`…) can be reused where the
distance test passes. **Status colours:** Achieved = `success` icon + word; Not achieved = `inkMuted`
icon + word (deliberately **not** `danger`: not achieving is not an error); Planned = `lineStrong`
outline.

### 8.4 Choosing a template ("Start a new map")

A radio group of five cards (each a small static, `aria-hidden` thumbnail of the shape + name + one
line: "Six stops: six steps around one plan"), then "Use my goal in the middle" (checkbox, on when a
goal exists), then **Start**. Creates the map with the template's slots (empty text), opens it, focus
on its title.

### 8.5 The app (Expo, no SVG module)

`react-native-svg` is not a dependency (checked `apps/native/package.json`; status.md:310 says the same
for Reanimated, `react-native-svg` and `expo-font`).

- **v1 (no new build):** the **outline view only** (8.2) for all five templates, drawn with Views:
  the tone border, the status icon as a View shape (circle, tick from two rotated Views, or text glyphs
  ✓ / ↺ with an accessibility label), T3 as numbered steps with increasing left offset (a "staircase"
  cue that stays within the width), T5 as a **vertical road**: a dashed left border with round
  markers per milestone, all Views. Editing in place; status as the app's existing radio/checkbox
  components; the crisis card as `CrisisCard`. Fully usable.
- **With the planned new build (expo-audio, icons):** add `react-native-svg` to the same build, then a
  read-only **"Picture" view** of T1/T2/T4 in a horizontally **pannable and zoomable** canvas (pinch,
  plus +/− buttons for switch and screen-reader users), while editing stays in the outline. If the
  build is not wanted, star/cloud shapes can't be drawn (straight connectors could be rotated Views,
  but it is not worth it).
- The app's About me decision (A7-09: change things on the web) doesn't apply: the app's goal screen
  already edits the goal (`apps/native/app/goals.tsx:140-157`).

## 9. Motion (each with its reduced-motion path)

Web: **CSS only** (keyframes and transitions on `transform`/`opacity`/`stroke-dashoffset`) with the
existing duration tokens (`packages/tokens/src/index.ts:189-196`: fast 120ms, normal 200ms, enter 600ms,
draw 800ms; all 0ms under reduced motion, `index.test.ts:259`). No animation library, nothing
scroll-triggered, the map is visible without JavaScript (server-rendered list). App: RN `Animated`
gated by `useReduceMotion()` (`apps/native/lib/motion.ts:9`). Nothing loops.

| # | Animation | Normal | Reduced motion |
|---|---|---|---|
| M1 | Map opens | Centre scales 0.96 → 1 (`enter`); branches fade + rise 6px, staggered 60ms in reading order | Shown at once |
| M2 | Connectors draw | Each connector/road draws itself from the centre outward (`stroke-dashoffset`, `draw`), staggered with M1, once per visit | Fully drawn |
| M3 | Marked **Achieved** | The tick draws itself (`stroke-dashoffset`, `fast`) and the card does one 1.04 pulse; T3: the figure-free step gets a filled bar; "Saved. Grade 11 marked achieved." announced | Tick appears; text only |
| M4 | Marked **Not achieved** | Reflection fields expand (height via `grid-template-rows: 0fr → 1fr`, `normal`) | Instant |
| M5 | Add / move / delete a node | The list re-flows with a 200ms `transform` (FLIP done by hand: measure, invert, play) | Instant |
| M6 | Template picker | Selected card's ring scales in (`fast`) | Ring appears |
| M7 | Crisis card appears | **No animation.** It appears at once, always | Same |

No confetti or celebration bursts: they compete with the crisis card's calm and with a learner who
just marked several steps "Not achieved".

**Inspiration (pages actually opened on 2026-10-22):**
1. **Motion, Path drawing** — https://motion.dev/examples/vue-path-drawing. Shapes drawn by animating
   `pathLength` 0 → 1, each with its own delay (`i * 0.5`s) and a quick opacity fade. **Adapt** for M2
   (connectors and the road) and M3 (the tick), in plain CSS `stroke-dasharray`/`stroke-dashoffset`
   with a `--i` delay, no Motion dependency.
2. **Motion, Accordion (JS)** — https://motion.dev/examples/js-accordion. Animates to `height: auto`
   and wires `aria-expanded`, `aria-controls`, `aria-labelledby`. **Adapt** for M4: the ARIA wiring as
   is; the height via the CSS `grid-template-rows` trick instead of a library.
3. **Motion, Reorder items (React)** — https://motion.dev/examples/react-reorder-items. Layout
   animation when DOM order changes. **Adapt** for M5 with a hand-rolled FLIP; **not** its auto-shuffle
   (the page itself has no keyboard, labels, pause or reduced-motion handling: our moves are
   button-driven and announced).
4. **Motion, Grid stagger** — https://motion.dev/examples/js-stagger-grid (listed on
   https://motion.dev/examples, which I opened; I did not open this page). For M1's stagger, as CSS
   `animation-delay: calc(var(--i) * 60ms)`, as the profile card did.
5. **FreeFrontend, JavaScript Animations** — https://freefrontend.com/javascript-animations/ (the second
   half of the page lists "Animated SVG Color Wave Effect", stroke-dashoffset along Bézier curves, and
   "Animated Star Toggle Switch", a checkbox micro-interaction). **Adapt**: the dash-offset curve for
   T5's road drawing itself (M2), and the toggle idea, simplified, for the status radios (M3/M6). The
   example pages themselves (CodePen) were not opened.
6. **GSAP showcase** — https://gsap.com/showcase/ (opened): portfolio sites and the plugin list
   (DrawSVG, MotionPath, Flip). DrawSVG and Flip do what M2 and M5 do, but GSAP would be a new
   dependency for effects CSS covers. Not used.
7. **LottieFiles, JavaScript free animations** — https://lottiefiles.com/free-animations/javascript
   (opened): developer and coding illustrations; **nothing fits** a plan map (no tick, road or growth
   animation on that page). A Lottie player would also be a new dependency. Not used.

## 10. Test-first build plan (web, then app)

Branch `phase-5/plan-maps` (or the current phase's prefix). Each step's named tests fail first.

1. **Templates and words.** `packages/ui/src/plan-maps.ts` (template ids, slots, order, layout kind,
   links, limits, `PLAN_STATUSES`, `outlineOf(nodes)` building the ordered tree, `canAdd`/`canMove`
   checks); `packages/content/src/en/plan-maps.ts`. Fail first: every slot has words and vice versa;
   no duplicate ids; `outlineOf` orders by position and nests by parent; limits (13th child, depth 4,
   61st node) refused; **the no-facts test** (§6); links point at real routes (`nativeRoute` knows
   each, or the "web only" line); RN-safety guard (`pnpm check`).
2. **Tokens.** `mapTone1..6` + soft; pair tests; distance from focus and statuses; `toCss`. Fail first:
   the pair test with no tokens.
3. **Database.** Migration (next free number); schema; store methods. Fail first (also against real
   Postgres): RLS (another learner sees nothing); nothing before consent (hard rule 5, data layer);
   **words refused under v3 / adult-v2, statuses allowed** (as the offer-letter tests); ID number in
   text, why_not, differently or title refused by store and DB; caps (10 maps, 60 nodes, 12 children,
   depth); cascade delete; **export includes maps and nodes**; audit rows have ids and fixed words only;
   the privacy-page test until the doc names both tables.
4. **Consent v4 / adult-v3** in `packages/content` (wording owed legal review) and the "new wording"
   error. Fail first: the store refuses words under v3 with the error id; the consent page lists the new
   line. Red team 100% (hard rule 7).
5. **Crisis on save.** `apps/web/lib/server/plan-care.ts` + new `packages/evals` cases (§5.2-7). Fail
   first: a crisis reflection returns `care.level = 'crisis'` with only verified lines; a concern
   returns the softer card; "I killed it in maths" returns `care: null`; **the text is saved in all
   three**; nothing about it in captured logs or the audit log; the red team at 100%.
6. **API.** Routes in §3.2. Fail first: `.strict()` 400s; unknown template 400; caps 409; another
   learner's map 404; CSRF on writes; `requireReady` before consent; `care` in the PUT response; the
   linked centre shows the goal card's name and none when the goal is unverified/removed.
7. **Web: My plan maps card on `/goals`** + "Start a new map". Fail first: page-rhythm and page-width
   tests include the card; empty line; the template radio group; create → navigates, focus on title.
8. **Web: the map page, outline first.** Fail first (RTL): nested lists in order; status as word +
   icon; Edit in place; Not achieved reveals the two fields; Save → one PUT; Move up/down/in/out keep
   focus; in-page delete confirm; crisis card shown and focused on a `care` response; no `confirm()`.
9. **Web: the picture layouts** (T1–T5) as CSS over the same list + `aria-hidden` SVG connectors;
   Picture/List toggle; motion M1–M6 with `prefers-reduced-motion` → `animation: none`. Fail first:
   reduced-motion CSS test; the DOM has one copy of each node's text. **Playwright + axe** on a
   production build at 360, 768, 1280 and 1920px: no sideways scroll at 360; keyboard-only create,
   edit, mark, move, delete; zoom 200% → outline. Lighthouse ≥ 90 desktop, budgets unchanged (the map
   page's client JS receives copy as props).
10. **App: outline screen** (`app/plan-map.tsx`, card on `goals.tsx`). RNTL v14 (`await` render and
    fireEvent): accessibility labels with status words; Not achieved reveals fields; Save → PUT;
    crisis card on `care`; reduce motion → no `Animated.timing` with a duration; screen-rhythm test.
11. **Docs and status.** `docs/design/README.md` (a "Plan maps" section), `privacy-and-data-safety.md`
    (both tables, the row "Plan maps and reflections in their words", Apple/Play rows), planning.md
    (the new item), status.md. **Audits:** A2 (design/accessibility), A10 (crisis, with the new cases),
    A11 (privacy and consent).
12. **Later:** the app's Picture view with `react-native-svg` (D6); share a map with the companion (D4).

## 11. Owner decisions (recommended answer in bold; plan-keeping option first)

- **D1 Add plan maps to the plan** as a new item with its own audits (A2, A10, A11)? Plan-keeping:
  keep My goal as planned (§3 Stage 3) and defer. **Recommended: yes, as a new item after S1's open
  work, through the usual gate.**
- **D2 Consent for writing in a map:** A) v4 / adult-v3 naming it, words refused under older wording,
  ticking allowed (plan-keeping); B) treat as covered by v3; C) fixed reasons only.
  **Recommended: A**, bundled with the photo's v4, one legal review. (Cost: existing minors' guardians
  re-agree before those learners can type in a map.)
- **D3 Crisis words in a map:** save and show the crisis card at once, nothing stored about it
  (plan-keeping with §4.3). Alternative: refuse to save. **Recommended: save and show the card.**
- **D4 Send map text to the AI?** **Recommended: no in v1**; later an explicit per-map "Share with my
  companion", with consent wording and an A10/A11 round.
- **D5 Templates:** the five in §2 (Six stops, Thinking cloud, Staircase, Life map, The road), with
  stage names only. **Recommended: these five**; wording owed the owner's review (and isiZulu,
  Sesotho etc. later).
- **D6 App:** **Recommended: outline view now; the picture view with `react-native-svg` in the planned
  new build** (with expo-audio and the icons). Plan-keeping alternative: outline only, no new module.
- **D7 "Not achieved" colour:** **Recommended: neutral (muted ink + icon + word), never danger red.**
- **D8 Limits:** **Recommended: 10 maps, 60 nodes, 12 children, depth 3, 120 / 500 / 60 characters.**
- **D9 Also crisis-check the profile's "goal in their words"** (free text that reaches the AI today,
  not checked)? **Recommended: yes, as a small follow-up finding.**
- **D10 Where:** **Recommended: a card on My goal after "Change my goal", each map on its own page
  (`/goals/maps/[id]`)**; nothing on the home in v1.

**Waits for legal:** consent v4 / adult-v3 wording, the privacy policy and store-answer lines. The
template-only (tick) mode does not.
