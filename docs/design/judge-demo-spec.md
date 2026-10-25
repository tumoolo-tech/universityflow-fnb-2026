# Judge demo mode: shared spec (owner's decisions, 2026-10-23)

> **Kept for the record: the spec the judge demo was built from (#81).** Where it differs from what
> was built, [docs/deploy/demo.md](../deploy/demo.md) and planning.md §20 win. In particular the
> chat is **uncapped** (the owner overrode the per-judge cap below), with an optional daily cap
> across the demo, `UF_DEMO_AI_DAILY_CAP`, off unless set.

The owner entered UniversityFlow in the FNB "best app of the year" hackathon (deadline: within a
week). Judges must be able to open a public URL and play with the app in one click: no password,
no phone, no SMS. Never use FNB's (or anyone's) branding. Synthetic people only.

## The owner's decisions (taken; don't ask)
- **Real AI, capped:** the demo's chat uses the real Anthropic model (its own key, which the owner
  sets with a spend limit), about 20 AI messages per judge visit and a daily cap across the demo;
  the crisis check, care, every safety rule and "Report this reply" stay on. Over a cap: a kind
  line, then the scripted stand-in.
- **Everything editable, private per visit:** each judge gets their own copy of a persona (tick
  plan maps, set a goal, swap a subject, confirm a sample report, shortlist...). The copy is
  deleted after 24 hours. Uploads accept ONLY our generated SAMPLE statements (tools/results-
  generator), never a real document or photo.
- **University years:** show what exists (offers, registration/proof, My modules, campus tour,
  walking directions, first-week checklist); for each unbuilt part of Stages 6–8 (study coach,
  marks tracking, year-to-year) one honest card: "<thing>: coming next".
- **No gender field.** "Boy"/"girl" = the persona's synthetic name and their own look (theme,
  avatar, tagline, words). Nothing new stored.

## The six personas (fixed ids, deterministic)
| id | Who | Grade/year | University | Look (choose tasteful, from the existing lists) |
|---|---|---|---|---|
| `demo-grade-10` | Thabo (a boy) | Grade 10 | goal at any verified-or-draft course | his own theme/avatar |
| `demo-grade-11` | Naledi (a girl) | Grade 11 | goal + shortlist | |
| `demo-grade-12` | Amahle (a girl) | Grade 12 | applications in progress | |
| `demo-first-year` | Lerato (a girl) | First year | **UJ** (accepted offer, registered modules, first week, campus) | |
| `demo-second-year` | Sipho (a boy) | Second year | **Wits** | |
| `demo-final-year` | Kagiso (a boy) | Final year | **UCT** | |
Surnames obviously synthetic is not required on screen (they show first names), but no real
person may be implied: use first names only, plus "(demo)" where a full name would show.
Ages must be believable: the Grade 10–12 personas are minors in the data (about 15, 16 and 17),
so their **guardian consent is recorded as a synthetic demo consent** (a guardian record with a
synthetic 080 number built at runtime, consent version current); the university personas are
adults with the adult agreement recorded. Hard rule 5 holds: consent exists before processing.

## Architecture (agent D1 owns; agent D2 plugs in)
- New deployment mode `UF_DEPLOYMENT=demo` in apps/web/lib/server/config.ts, alongside staging,
  with its own `checkDemo(...)`:
  - a production build (NODE_ENV=production) that is never production and never staging;
  - **refuses**: `UF_PROVIDERS=live`, `VERCEL_ENV=production`? NO: the demo is meant to be a
    Vercel production deployment of its own project, so instead refuse when the *real*
    production markers are present (`UF_S3_*`, SMS/WhatsApp/push/jobs providers, `UF_REVIEW_*`,
    `EXPO_ACCESS_TOKEN`, `ELEVENLABS_API_KEY` (Read aloud stays off: under-18 terms),
    `UF_PROFILE_PHOTO`, `UF_STAGING_PASSWORD`), and refuse running on the real production
    project (decide a marker: e.g. `UF_PUBLIC_URL` must not be the production domain, or a
    required `UF_DEMO_PROJECT=1`); **allows** `ANTHROPIC_API_KEY` (capped) and a demo database.
  - Database: `DATABASE_URL` either `pglite:` (local, and Vercel `/tmp` fallback) or a Postgres
    URL **only with `UF_DEMO_DATABASE=synthetic`** set (a dedicated demo database the owner
    creates, e.g. Neon free tier; synthetic data only, so region is not a POPIA matter). Recommend
    the Postgres for Vercel (functions don't share `/tmp`).
  - `UF_CATALOGUE_PREVIEW=1` allowed (drafts labelled "Draft").
  - No staging password gate in demo mode (A5-10's gate is for staging). Instead: **phone sign-in
    is OFF** in demo mode (request-pin/verify-pin answer 404; /dev/outbox 404; guardian SMS links
    never sent), so there is nothing to steal.
- **Persona picker:** in demo mode `/` and `/sign-in` show "Try UniversityFlow as…" with the six
  cards (name, grade/year, university, a one-line "what to try"), plus a short line for judges.
  Pressing one calls `POST /api/demo/start {persona}` which clones the persona's seed into a new
  private student (a new id; the clone function is D2's `cloneDemoPersona`), creates a normal
  session (cookie on web; the app is out of scope), and redirects to /home. "Switch learner"
  in the demo banner returns to the picker (and deletes the old copy).
- **Banner** on every page in demo mode: "Demo: made-up learners. Don't type real personal
  details." with "Switch learner". Content in packages/content (new section `demo`).
- **Caps:** AI messages per demo student (20) and per day across the demo (env
  `UF_DEMO_AI_DAILY_CAP`, default 300), counted in the database; over a cap: the kind line + the
  stand-in. Demo starts per IP per hour (e.g. 30) using the existing rate-limit table.
- **Sweep:** demo students older than 24 h are deleted (cascade) on a lazy sweep at
  `/api/demo/start` (and a cron-friendly route if simple).
- **Uploads in demo mode:** only PDFs whose text layer carries the SAMPLE notice and the
  generator's producer string; everything else refused with a clear message. A "Use a sample
  report" button attaches one of the generated statements for that persona's grade.
- `/api/health` unchanged.

## Seed (agent D2 owns): `apps/web/lib/server/demo/` (server-only)
- `DEMO_PERSONAS` (ids, names, grade/year, university ids from the catalogue, look ids).
- `seedDemoPersona(store, personaId)` / `cloneDemoPersona(store, personaId): Promise<studentId>`:
  creates the student through the **existing store methods** (so every rule, RLS and audit row
  applies): date of birth, consent (guardian or adult), grade, profile look, confirmed reports
  from the generator's fixture (packages/documents/fixtures/sample-results.json: pick learners
  whose marks tell each story, or extend the generator deterministically), goal, shortlist,
  applications (Grade 12), plan maps with some ticks (no free words unless the words switch is
  on: in demo mode, turn the plan-map words ON? NO: keep them off; ticks only), offers /
  registration / modules / first-week progress / campus for UJ, Wits, UCT from the catalogue
  drafts (pick real draft programmes and modules that exist in the catalogue).
- "Coming next" cards for the university personas (content keys, a small component on the home
  or a "Your year" card): study coach, marks and weak spots, a plan that fits your life,
  year-to-year portfolio. Words owed the owner's review.
- Tests: each persona seeds through the store (no direct SQL), passes consent checks, renders
  the home without errors; cloning twice gives two separate students; no real-looking PII
  (`no-real-pii` guard); the seed is deterministic.

## Common rules
All of agent-rules.md applies. Hard rules 2–11 hold in demo mode (admission facts from the
catalogue; drafts labelled; no PII in logs; consent before processing; content in
packages/content; tokens; RN-safe packages untouched by Node APIs; red team 100% if
packages/agent or packages/content change).
