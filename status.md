# UniversityFlow — Project Status

> **Read this first when opening a new session.** It says where the project is, what just
> happened, and what to do next. The *what and why* lives in [planning.md](planning.md).

**Last updated:** 2026-10-24 (night) · **Updated by:** S1 session 9 (integrator), second half. **On `main` since #127:** **#128** CI green again on GitHub (the owner fixed Actions billing: the secret scan skips seven findings a person checked, unit tests two packages at a time, a profile-photo test split); **#129** Phase 6c module cards and the mark calculator (migration **0041**; the calculator's maths and words on client-only subpaths; free-book words built on the server, out of the browser and the app); **#130** My plan maps as a canvas on a card (pan, zoom, full screen, mini-map; web); **#131** all **50 public TVET colleges** as drafts (791 programmes, DHET teach-out notices, colleges in Plan B, the Institution filter, "Is this college registered?", college logos on the demo); **#132** **security**: next 16.3.8 → 16.4.3 (two Critical remote-code advisories) and patched packages, `pnpm audit --audit-level=high` passes; **#133** pictures on subjects and offers, the polish of every page (public and signed-in), the front door's pictures above "GRADE 10", and **Open Mmereko** on My CV (18+ or university only, behind `UF_CV_MMEREKO_CANVAS`). **Mmereko #6** (its own repo): only UniversityFlow may frame Mmereko, sign-in works inside the frame; live after its Vercel Git link was reconnected (another session). **The live demo moved to https://universityflow.tumoolo.tech** (the owner's domain), with the judges' Firebase sign-up and Read aloud (ElevenLabs, voice "Sarah") on; the AI chat runs on **Gemini for 15 days** (the owner's decision; Anthropic again by 2026-11-08). Live smoke: **32/32**, Open Mmereko shows Mmereko's sign-in on the live domain. Gate per PR: GitHub CI (lint, guards, typecheck, unit, builds, budgets, E2E main, red team, secret scan, audit) plus locally the demo E2E, the production rehearsal and real Postgres/S3 where the database changed. Then, the evening: **On `main` since #114:** **#115** the judge demo also shows My CV (the stand-in engine, Mmereko never called, D14), plan-map words and Read aloud (needs the owner's ElevenLabs key): hackathon exceptions E, F, G; **#116** judges sign up as a **new learner** on the demo (`UF_DEMO_PHONE_SIGNUP=onscreen`: 080 numbers only, the PIN and the guardian's link on screen, every account deleted after 24 h, a taken number belongs to the browser that made it, 100 PIN requests an hour per address on the demo only), plus a production fix (onboarding's waiting step moves on once the guardian agrees): exception H; **#117, #119** the FNB pitch deck (pitch/, 21 slides, cited figures, sharp screenshots; the PDF is best for presenting); **#118** Phase 6d free books (drafts; book rules server-side only, A4-13); **#120** a lint fix in pitch/scripts; **#121** a field picture behind every course card (the owner approved it after a local look; #122 is an empty duplicate of it, made by the integrator's merge script, now guarded against); **#123** Phase 6a, how marks work (14 rules records, 139 module schemes, 5 calendars, drafts; `resolveScheme` and the mark maths in `admissions`); **#124** Phase 6b, the learner's module outline confirmed part by part (migration **0040** with the consent gate, D9; the demo's SAMPLE outline; exception I) and a test holding an outline's components to 6a's shape; **#125** UJ's and UP's own logos on the judge demo (all six universities now); **#126** the owner's original photos in a git-ignored `photos/` folder in the main checkout, named for their use (the unused ones to the Recycle Bin). **Phase 6 approved** (planning.md §11, plan v0.10, every recommended answer D1–D14, built now on drafts). Gate per PR, verified locally (Actions has no billing): lint, guards, check:test 186, typecheck 15/15, every touched suite uncached (web 1887, db 565, documents 302, catalogue 555, admissions 299, native 470, content 167, results-generator 56, red team 18/18), **real Postgres 565/565 and real S3 302/302** (#124), builds and budgets (root chunks 127.8 KB, native +48.4 KB, within 5%), **E2E main 25/25, demo 40/40 + 6/6, production rehearsal 6/6**. **Running now:** three agents: 6c (module cards and the mark calculator, migration 0041), the plan maps as a canvas on a card (the owner's request: pan both ways inside the card, zoom, full screen), and all 50 public TVET colleges (from the earlier agent's research, spot-checked). Disk: 15 GB of old web builds and Docker's 15 GB build cache cleared (C: 13.8 → 28.9 GB free). Before that, S1 session 8. **Wave 6 merged** (four agents, each verified, rebased and gated, admin-merged with `enforce_admins` restored): **#110** the incident-response and POPIA s22 runbook, a DRAFT for the owner (A5-08); **#111** the app: the crisis card's heading read (A3-28), home refreshing in one request (A4-17), the camera and photos wording naming the profile photo (A7-23, **a new app build is needed**); **#112** the CV security Lows (A5-19, A5-21, A5-22, A11-41, A10-60, CV5-02) and **a pooled connection the server ends no longer crashes the process** (packages/db's pool `error` listener, the SQLSTATE code only; gotcha 54's flakes fixed); **#113** the web Lows (design tokens for widths, motion, easing, shapes and breakpoints; the home on Card and PageHeader; the phone Menu a native disclosure that works before hydration; the chat composer; repeated status re-announced; A3-26, A3-27). Gate per PR: lint, guards, check:test 173, typecheck 15/15, every touched suite uncached (web 1630, native 470, db 538, tokens 289), **real Postgres 538/538 and real S3 245/245** (#112), builds and budgets (native +47.9 KB, within 5%), **E2E main 25/25, demo 33/33, production rehearsal 6/6**; the front door compared with main at 1280x720 (unchanged) and 360/1280 px with no sideways scroll. Two new findings from the runbook (A5-25, A5-26). Before that, **The live judge demo works end to end** (https://universityflow.vercel.app): after the owner reset the Supabase password (another session), `pnpm demo:smoke -- --logos --browser` passes **23 of 23** (health, landing and pictures, the picker's six learners, phone sign-in off, every learner starts and stays signed in through home, goals, about me and documents, logos, sample photos kept and a real photo refused, a sample report read, the chat answering, sign-out, and the browser at 360 px with no sideways scroll). **One gap: the chat is the scripted stand-in**, because `ANTHROPIC_API_KEY` reads as empty in Vercel (saved blank): the owner sets it again. **Wave 6 started** (four agents, base 74d1ba55): web polish and accessibility Lows (A2-21..27, A3-26, A3-27, A4-15, A4-16, A2-51/52), the app's Lows (A3-28, A4-17, A7-23), CV and security Lows (A5-19, A5-21, A5-22, A11-41, A10-60, CV5-02, gotcha 54's two flakes), and the incident-response runbook draft (A5-08). Before that, S1 session 8, wave 5 (two agents). **On `main`: #104, #106, #107** (and **#105** from another session: the startup log line names the cause inside a wrapped error). **#104** the Phase 6, Phase 7 and portfolio proposals and the CS module research brought over from the stale `phase-6/proposals` branch (four files; the Phase 6 proposal notes its migration numbers need renumbering); **#106** the university years' home (A2-66: a 2nd- or final-year student gets their own home, journey Modules · Plan, next step, chat welcome and starters, never an arrival's cards or a request for a school report; "final" only from the catalogue's `durationYears`, labelled when the record is a draft) and A2-67..69 (Switch learner only when signed in; Applications at university; no next step on a closed window); **#107** Report this CV (A10-58, migration **0039** `cv_reports`), delete one CV (A11-38) and the CV preview as structure (A2-47, `cvTextBlocks` in packages/ui, Mmereko's own escaped subset). Gate on #107 (rebased on #106): lint, guards, check:test 173, typecheck 15/15; content 148 · ui 125 · cv 118 · red team 18/18 · native 466 · db 495 · web 1550; **real Postgres 537/537, real S3 245/245** (gotcha 54); web build, root chunks 127.8 KB, native +45.3 KB (within 5%); **E2E main 23/23, demo 33/33, production rehearsal 6/6**. The wording review page holds **1,034 strings** (62 added: the CV hold and AI notes, the demo's ways in and photos, the photo draft, wave 5's words), no verdicts yet; it now reads verdicts by group chunk, never one 1,000-document read. **The live demo now has Supabase** (`DATABASE_URL`, `DATABASE_CA_CERT` in Vercel) but every learner start answers 500: the log says `services could not start (Error; caused by error 28P01)`, a **wrong database password** (the owner resets it, letters and digits only, and re-runs `pnpm demo:setup`). Preview :3005 on 69630e31. Before that, S1 session 7, wave 4 (six agents, after the owner could not sign up on the live demo). **On `main`: #98–#102.** The live demo's ConfigError fixed in Vercel (the five demo switches re-set and a fresh `AUTH_SECRET`; health 200), `NEXT_PUBLIC_UF_DEMO_LOGOS=1` set. **#98** the real launch prepared: `pnpm deploy:check` (the app's own `readConfig`, never a value), a production rehearsal E2E (6/6), docs/deploy/production.md, A1-50; **#99** the demo's ways in never dead-end and a refused configuration is logged with its reason (A2-70..75); **#100** profile photos for learners ready with consent v4 (A11-31, migration 0037; "used for nothing else" proven) and the hackathon exception `UF_DEMO_REAL_PHOTOS`; **#101** `pnpm demo:setup` (keys straight into Vercel, hidden) and `pnpm demo:smoke`; **#102** **Supabase** for the demo: migration 0038 (Critical: the learner role on PG16+; Supabase's API roles), safe concurrent migrations, TLS, CI's real-Postgres tests no longer skipped. Gate on `phase-5/wave-4-int2` = main: check:test 173, typecheck 15/15, db 480 · web 1510, real Postgres 522/522, real S3 245/245, build, budgets, E2E main 23/23, demo 31/31, production rehearsal 6/6. **Live smoke (2026-10-24):** health, landing, pictures, picker pass; every learner is signed out after starting until the demo has a shared database (Supabase, the owner's morning step). Before that, S1 session 7, the integrator session with ten agents (wave 3). **Everything is on `main`** (#87–#96 and **Mmereko#5**; no CI, so each PR was verified locally and admin-merged with `enforce_admins` restored; Vercel built and deployed every merge). **#87** docs: the hackathon undo PR ready to run (docs/deploy/hackathon-undo-pr.md), the README, planning §20 (the owner's 2026-10-23 decisions); **#88** agent branch coverage 88.7% → 91.9% with real tests, and the A10-53 note for a reviewer; **#89** **A10-49 closed**: every reply records which provider wrote it (migration 0036), and a test proves Gemini never serves production; **#90** CV-A5 (security: no Critical/High, 4 Medium fixed); **#91** the phone app: the development build is a dev client (A7-22 High, `expo-dev-client` added; **a new app build is needed**), an Android dev-build checklist for the owner (docs/store/android-dev-build.md), small-width tests; **#92** the judge demo walked as six personas at 360 and 1280 px (2 High fixed: A2-60, A2-63) and a three-minute guide for judges at `/demo/guide`; **#93** CV-A10 (3 High fixed: every CV word crisis-checked, crisis words held before they leave; **the owner confirms the hold**); **#94** the real-Postgres suite runs twice on one database; **#95** CV-A11 and CV-A2 (no Critical/High; `MMEREKO_REGION=af-south-1` required for live Mmereko); **#96** the owner's **journey in pictures** on the front door (made in the preview folder, brought in: 360/540 px copies, lazy so phones never fetch them, a test); **Mmereko#5** a High fixed on its side (every audited write failed on Postgres). The wording review page now holds **972 strings** (291 added, no verdicts recorded yet). Gate: lint, guards, check:test 81, typecheck 15/15; web 1419 · native 452 · db 459 · agent 390 · catalogue 378 · messaging 311 · tokens 285 · admissions 241 · documents 234 · content 136 · cv 118 · ui 106 · results-generator 51 · jobs 41 · evals 18 (red team 100%); **real Postgres 17: db 499/499; real S3: documents 244/244**; web build, root chunks 127.8 KB, client chunks clean, native +22.9 KB (within 5%); **E2E main 23/23, demo 22/22** with axe. **`/api/health` on the live demo still answers 503** (the owner's ConfigError and `DATABASE_URL`). Before that, S1 session 6, the integrator session after the 10-agent session. **Everything is on `main`** (#81–#85, no CI: GitHub Actions has no billing, so each PR was verified locally and admin-merged with `enforce_admins` restored): **#81** the FNB hackathon **judge demo** (six synthetic personas, `UF_DEPLOYMENT=demo`) and Gemini as a second ChatModel; **#82** a fix: AWS Lambda sets `AWS_ACCESS_KEY_ID/SECRET/SESSION_TOKEN` on every Vercel function and the demo refused itself (now allowed only when `VERCEL=1`); **#83** the build wave: C2 (school record, migration 0031), A2-35..42, A5-14, A4-18 (`@universityflow/content/app`, guard `native-no-content-barrel`), the A10 round (S1-A10b, 2 Critical + 2 High fixed, red team 454 at 100%), the consent v4 / adult v3 **draft** (docs/legal/consent-v4-draft.md), demo sample photos (drawn, no real upload), demo files in its Postgres (migration 0033), the judges' **real Firebase sign-up, a HACKATHON EXCEPTION** approved verbatim ("approved: build the Firebase real sign-up for the judge demo, 18+ only, accounts deleted after 30 days", migration 0034, `UF_DEMO_SIGNUP`), and the **main landing page with a small "Demo for judges" button** (picker at `/demo`, no banner on `/`, "Back to UniversityFlow"); **#84** university **logos in the demo only** (`NEXT_PUBLIC_UF_DEMO_LOGOS=1`, a hackathon exception; Wits/TUT/UCT/UKZN, UJ/UP blocked downloads); **#85** **My CV with Mmereko** (packages/cv, migration 0035, routes, jobs, webhook, web `/cv` and the app screen) behind `UF_CV`, off for learners until consent v4; and **Mmereko#4** (Mmereko's stateless partner engine and `/partner/v1` API, contract shared and sha-checked). Gates per PR: lint, guards, check:test, typecheck, every unit suite, build, root/client/native budgets, E2E main 23/23 and demo 12/12 with axe. The demo is deployed by the owner at https://universityflow.vercel.app (Vercel project "universityflow"): the landing page is live, but **`/api/health` still answers 503** (a ConfigError only Vercel's runtime log names; owed by the owner). Before that, S1 session 5 (the 10-agent session), on **`phase-5/grade-10`**: ten agents, each in its own worktree, merged by the integrator one at a time with the touched suites re-run uncached, the web build, budgets and the whole E2E after each: **profile step 8 and its A2 audit** (A2-28 to A2-42, no Critical/High), the **profile photo** behind `UF_PROFILE_PHOTO` (migration 0029), the **neutral university mark** and `logoPermission`, **My plan maps** (migration 0030, the words behind `UF_MINDMAP_WORDS`, the crisis check on every save, red team 400 cases 100%; D9 as A10-40), the **/privacy template**, consent-box links and the **ECTA s43 footer**, **C1** (tools/results-generator and the fake `ResultsSource`), the **app's react-native-svg batch** (a new app build is needed), **deployment readiness** (render.yaml for a gated, synthetic-only staging site; production stays on Vercel cpt1 + AWS af-south-1; docs/deploy/), audits **A5 (security) and A11** of the session's work (2 High, both fixed test-first) and the owner's **wording review page** (<https://claude.ai/artifact/EsC5ktxCcd59vkfLoknitD>, 681 strings). Gate: lint, guards, check:test 78, typecheck 14/14; web 931 · native 397 · db 374 · documents 221 · catalogue 373 · tokens 285 · ui 105 · content 103 · agent 257 · results-generator 47 · evals 18 (red team 100%); web build, root chunks 127.8 KB, client chunks clean; **E2E 22/22**. **The native bundle budget fails (+15.4% Android, +16.6% iOS, A4-18): the owner's call.** Before that, S1 session 4, on **`phase-5/grade-10`** (98a752b): the **profile design built, steps 1–7** (the owner approved every recommended answer; the card laid out as the owner's poster after their review; migration 0028), the **My subjects redesign** (an agent, every recommended answer, merged) and **ElevenLabs as the only Read aloud voice** (an agent, merged; off for learners until ElevenLabs' written approval for under-18s); whole gate green uncached, E2E 16/16. Next: the 10-agent session (profile step 8 and audit, the photo behind a switch, the neutral university mark, mind maps, the privacy page template, C1, the app rebuild batch, audits, the wording review page, deployment readiness). Before that, S1 session 3, on **`phase-5/grade-10`**: last, **every open S1 Low fixed** test-first (14 findings, 11 commits; Grade 10 is the floor, migration 0027) and a **profile design proposal** for the owner (docs/design/profile-look-proposal.md); whole gate green uncached, E2E 14/14. Before that, **A11-25** (150aa74: a home notice in the 30 days before the 18th birthday) and **A10-35** (bf483ee: "Report this reply" on every AI reply, web and app; migration 0026), each designed with the owner first (every recommended answer) and built test-first; whole gate green uncached, E2E 14/14 with the report step. **No S1 Medium is open.** Next: the S1 Lows, then the web privacy page template, then C1. Earlier this session: **S1's six Mediums fixed**, each with a test that failed first (owner's go, every recommended answer): A1-34 (exam inputs read the latest report as every reader does), A10-32 (the Grade 10 note with every verdict tool), A10-33 (child-safety lines in the prompt), A10-34 (NSFAS decides, never the model), A11-24 (no sign-up under 13), A1-35 (the report kind from the document and the date, never above the learner's grade); red team 100%; then an E2E fix (each sign-in from its own address: the suite had passed the per-IP PIN limit, also at 5dfefab). Whole gate green uncached, E2E 14/14 twice. Next: A10-35 and A11-25 (designs first). Before that, S1 session 2: S1's audits A1, A3, A10, A11 run and their Criticals and Highs fixed; **G10-6** (documents only: users from about 15, the age rating 13+, a guardian's consent for up to ~3 years, the 18th-birthday gap; legal review owed; "agree ahead" and the web privacy page planned as their own items), and two research briefs commissioned (law and security, 2026-10-22); before that **G10-5, the words** ("From Grade 10 to graduation", the "Grade 10" wordmark, the sidebar's "School", "your latest school report" everywhere, the agent from Grade 10 with the learner's grade in its context; red team 100%; A10 owed with S1's audit round), then **G10-4, Stage 0 on the home** (the `grade-10` stage; journey Report · Subjects · Goal · Study; `subjectDoors`, "do my subjects keep doors open?"; My subjects on the web and in the app), the owner's answers to the plan's open choices all the recommended ones; whole gate green uncached (web 645, db 317, native 326, E2E 13/13). Next: G10-5. Before that, S1 session 1 (off `phase-5/design-refresh` at 19da0c5, worktree UniversityFlow-design): **G10-2 and G10-3** (27a0d83: a final Grade 10 report, never scored as "Qualify now"; migration 0024) and **G10-1** (a4c6bf6: the grade moves up each school year, checked each January; migration 0025). Next: G10-4 (Stage 0 on the home). Before that, design session 5: **plan v0.9 approved** by the owner, part by part, every recommended answer (planning.md §18.8, §19.2); S1 (Grade 10) and C1 (the generator) next. Before that, design session 4: **the whole uncached gate passed at f65fb36** (2,750 tests, 0 cached, coverage, all builds, budgets, E2E 10/10), so the branch is ready for the one PR when Actions has minutes; then **the app's "One rhythm"** (`PageHeader` and `EmptyState` in the app, held by `__tests__/screen-rhythm.test.tsx`, native 310). The owner's question open: Outfit in the app (`expo-font`, a new build). Checked GitHub for the other developers (Furnx, Siphosihlemorabe: read access): nothing claimed or in progress on this repo. Before that, design session 3: **one gap under every page title and one empty state** (the owner's last open review points: `Page`, `StatusLine` and `EmptyState` in `components/ui.tsx`, held by `test/page-rhythm.test.tsx`; measured 24px under every title at 1530, 1280, 1024 and 390px). Actions still has no minutes (the 2026-10-19 weekly Audits run failed with no steps). Before that, design session 2, second half: **the mobile app's home and chat in the web's design** (the home's rules and `HomeData` moved to `packages/ui`; `GET /api/home` for the app; the app's dashboard home and restyled chat; a flaky registration test fixed). Earlier the same session: **the whole gate passed uncached on the design branch at 5d63711** (2,708 tests one package at a time, coverage, both builds, budgets, E2E 10/10); then the owner's review items: a phone Menu button in place of the sideways nav row, the preview notice hidden on the chat (the composer line says "no AI connected" instead), journey steps named as actions until done, and /help 171.5 → 134.9 KB (the crisis card renders on the server). Before that, design session 1 (web): the owner's two references (a poster and a "Helios" dashboard) as the whole web app's dark theme, Outfit, a split-screen front door and sign-in that fit one screen, a signed-in dashboard at `/home`, a stage-grouped sidebar, a rebuilt chat; see docs/design/README.md. Before that, the Phase 5e build session: **5e-1 to 5e-4 built** on `phase-5/stack` (owner approved the plan 2026-10-19 with the recommended answers): Walk there and See it, accessible arrival and read-aloud, UJ's campuses and 2027 calendar, UJ's safety advice as quoted notes; whole gate green locally (2,512 tests, coverage, E2E 10/10). 5e-5 (in-app map) waits on decisions 1–3. Before that, 2026-10-17 (night), the finishing session's second round: A4-10 (each web page carries only its own copy, ~16 KB gz off every first load), A4-13 (native bundle budget and catalogue-barrel guard), a pre-push hook that no longer starves (gotcha 39), A13-11 (UKZN clinic phones, owner's decision); whole gate green locally again (2,425 tests, E2E 10/10). First round: **A1-33 delivered** (the app reads an offer letter by camera; a registration-day reminder, migration 0023) and six Lows fixed (A2-16, A2-18, A2-20, A7-17, A7-18), all on `phase-5/stack`, whole gate green locally (2,409 tests, E2E 10/10). Before that, the Low sweep and Phase 5 build session. **Phase 5 is built and audited, with no Critical or High open.** Merged to `main`: #67–#72, #74–#76. **Everything else is on `phase-5/stack`, verified locally** (2,337 tests one package at a time, both builds, E2E 10/10), because GitHub Actions is out of minutes until the owner's next payment and `main` requires CI: Wits drafts (#73), 5b (#77), 5c (#78), Phase 5's eight audits (4 Critical, 2 High, all fixed test-first) and their fixes. Earlier the same session: 33 of Phase 4's 35 Lows closed (#58, #62–#66)

---

## Right now

| | |
|---|---|
| **Current phase** | **Phase 5** (orientation and registration) **built and audited**, and the **FNB hackathon judge demo live** on made-up learners (planning.md §20). Phases 1–4 under it are built and audited, waiting on the owner: nothing reaches a real learner until the **catalogue is verified by a person** (hard rule 3), **legal review** (consent v4 / adult v3, the Information Officer, A11-19..23) and the **real accounts** (D8, docs/deploy/production.md) |
| **Next phase** | **Phase 6** (Stage 6, semester setup): **🔵 in progress**, approved 2026-10-24 with every recommended answer D1–D14 (planning.md §11, v0.10): 6a (#123), 6b (#124) and 6d (#118) built as drafts; 6c building; 6e next. Phase 7 (the study coach) is proposed too (docs/plans/phase-7-proposal.md); the portfolio (Stage 8) in docs/design/portfolio-proposal.md |
| **Overall progress** | ▓▓▓▓▓░░░░░ 50% (MVP, Phases 4 and 5 code done, the CV engine built early behind `UF_CV`, the judge demo live; launch waits on verification, legal review and accounts) |
| **Blocked on** | **Owner:** the demo's `ANTHROPIC_API_KEY` (set again in Vercel, with a spend limit); the ECTA footer details (A2-65); verify the catalogue (the kit: [docs/verification/](docs/verification/README.md)) and the helpline numbers; legal review (consent v4 / adult v3, A11-19..23); choose the SMS provider; connect the production accounts (docs/deploy/production.md); GitHub Actions billing |
| **Gate command** | `pnpm verify` (typecheck and tests, then the builds; gotcha 23). While Actions has no billing, the integrator runs it locally per PR: lint, guards, check:test (173), typecheck 15/15, every touched suite uncached one package at a time, **real Postgres 17 and real S3** when packages/db or documents change, the web build, root chunks (≤150 KB gzipped, now 127.8 KB) and client chunks, the native bundle budget (within 5%), and **E2E main 23, demo 33 and the production rehearsal 6** with axe against a production build; the **red team 100%** for any agent or content change |
| **Key date** | **Mar 2027**: applications open. The MVP must be live by then |

### Next 3 actions

1. **Integrator, next session (the owner's plan): verify and audit before anything new.** Phase 6's
   audits (D12: A1–A8, A10, A11, A13) over 6a–6d; A1/A13 for the colleges (against DHET and the
   colleges' own sites; the teach-out circulars); A2/A3/A4 for the canvas, the polish and the front
   door (axe, 360 px, **Lighthouse measured on mobile and desktop**, the launch standard); A5/A11 for
   Open Mmereko and the Firebase sign-up; A8 for #132. Fix every Critical/High test-first. Add the
   new content keys to the wording review page. The live smoke on universityflow.tumoolo.tech.
2. **Then:** Phase 6e (agent tools, evals and red team at 100%, reminders, migration 0042 if
   needed), the deck's slide 15, and **the judge demo's slow start** (the owner, 2026-10-24: measure
   where the time goes, then make it fast).
3. **Owner:** a new `ANTHROPIC_API_KEY` before 2026-11-08 (the demo's chat is on Gemini until then; mark `GEMINI_API_KEY` Sensitive in Vercel); add
   tumo@tumoolo.tech to your GitHub account (the Vercel preview check fails on every PR); the ECTA
   footer details; catalogue verification, now with the Phase 6 records, the 50 colleges and
   docs/verification/colleges-teach-outs.md; consent v4 / adult v3 (module outlines, the Mmereko
   line) to the lawyer; the cleanup of old worktrees (only with your yes).

**Standing owner actions:**

1. **Owner, wire the pipeline:** add the repo secrets `ANTHROPIC_API_KEY` (A9, prompt audits,
   @claude) and `AUDIT_SUITE_TOKEN` (read access to tumoOLO_Audits); until then those jobs warn
   and skip. Consider making **Crisis red-team** and **Secret scan** required checks on `main`
   alongside Static · Unit · Build. Try the mobile app on a phone (below): it has never run on a
   device.
2. **Owner, verification (blocks launch, hard rule 3):** the kit in
   [docs/verification/](docs/verification/README.md): settle the 18 open questions (drafts and
   evidence in `open-questions.md`), approve or reject corrections C1–C11
   (`proposed-corrections.md`), then tick the per-university checklists. **A programme reaches
   learners only when its record and its university's score method are both verified.** Open
   uj.ac.za, up.ac.za and saps.gov.za in a browser: they refused automated access. Re-check against
   the **2028-intake** prospectuses February to April 2027.
3. **Owner, accounts (D8):** the Anthropic key first (report reading and chat quality on real
   Grade 11 photos, kept outside the repo); **choose the SMS provider** (the adapter registry,
   `apps/web/lib/server/sms-providers.ts`, is empty and `UF_PROVIDERS=live` refuses until it has
   one); the S3 bucket (no dots; Block Public Access; CORS POST from `UF_PUBLIC_URL`; lifecycle
   expiring `incoming-` after a day; SSE-S3 or a KMS key); real SMS budget numbers (300/hour and
   2000/day are placeholders); RDS af-south-1 and Vercel `cpt1` with its deploy hook
   (`VERCEL_DEPLOY_HOOK_URL`). Also: the Information Officer; legal review of the consent
   wording; first-language review of the crisis phrases (packages/agent/src/crisis.ts).
   **For Phase 4:** choose the WhatsApp provider (Meta Cloud API or a BSP) with the SMS one;
   start the Apple Developer (D-U-N-S takes weeks) and Google Play accounts and Expo EAS; decide
   jobs in production (Trigger.dev, or the Postgres queue on a Vercel cron); see planning.md
   §11, Phase 4, "Decisions the owner makes". **From 4a, to confirm:** the cadence numbers (2 in
   any 7 days; up to 7 in an exam period, from a week before a paper; one a day; 60 min before and
   30 after a paper; give up after 28 days); the placeholder limits (10 reminders a day per
   learner, 30 inbound per 10 min per sender); the template wording (then Meta submission); the
   non-English STOP words (HOU OP, YEKA, MISA, YIMA, KHAOTSA, EMA, EMISA: first-language review).
   **From 4b and 4c:** settle Q19–21 and verify the 45 exam papers (the 2 Nov Physical Sciences P2
   clashes with a Western Cape "no exams 2–5 Nov" statement); setting a goal also shortlists it;
   the exam year follows the profile grade (consider asking learners each January); whether the
   final matric results should trigger a re-check too; the "what I need" path rule.

**Parked by the owner on 2026-10-19 to work on the design:** every open decision below (5e's
1–3 and 7–10, UJ's 8 conflicting values, the pepper-spray tip for under-18s, the 2027-01-16
checklist expiry, the late-acceptance reminder, A2-01) waits until the owner returns to them. The
design work happens on `phase-5/design-refresh` (off `phase-5/stack`); it owns A2-11 (the design
document) and the A2 findings that need it (A2-01, A2-02, A2-12).

**My subjects redesign (2026-10-22, late; branch `phase-5/subjects-redesign` off 781d72c, worktree
UniversityFlow-subjects):** the owner approved the round-2 proposal with every recommended answer
(decisions 1–10) and it is built test-first: `subjectDoors` gains `byUniversity`,
`closedCourses` (every requirement a closed course misses) and `higherBarReasons`;
`swapChoices`/`trySwap` answer the what-if (packages/admissions); `SubjectsResponse` and shared
wording helpers (packages/ui); `subjectsResponse` with the goal and `?drop=&take=` (web server and
`GET /api/me/subjects`); the web page (verdict first, By university, "Courses your subjects
close", the GET-form university filter, the higher bar's reason, "Try a different subject", CSS
motion on duration tokens) and the app's screen to match. docs/design/README.md §2 says how.
Tests: admissions 205 → 215, content 79 → 84, ui 51 → 58, web 680 → 711, native 339 → 345, red
team 15/15. **Owed:** the owner's review of the new `en.subjects` wording (every key added after
`draft`); E2E (`e2e/grade-10.spec.ts` updated to the new page, not run: no production build on
the shared machine); a look at 360px and 1280px in a browser; the NSC subject-combination rules
as researched catalogue data (planning §18.3 note, decision 10).

**S1 session 5 (2026-10-23), the 10-agent session:** the owner's brief set ten agents, each in its
own sibling worktree off `phase-5/grade-10`, at most three running suites at once; the integrator
verified each report against the code, rebased, fast-forwarded, re-ran the touched suites
uncached, then the web build, budgets and the whole E2E, pushed and restarted the preview.
**Merged:** the privacy template (/privacy, 17 "Owner to fill" placeholders, the Information
Regulator's details checked on its site 2026-10-23; the guardian box now `required`; **the adult
agreement gained a required, unticked box**, version not bumped; the ECTA s43 footer on the
public pages); deployment readiness (render.yaml = a **staging site only**, synthetic data, behind
`UF_STAGING_PASSWORD`, refusing real databases and keys; production refuses `RENDER`; /api/health;
docs/deploy/ with Vercel Hobby's non-commercial terms, the DPA covering Pro/Enterprise only, a
cost comparison and the launch checklist; **plan drift flagged: Render has no SA region; the
friend's Vercel account is not recommended**); the profile photo (`UF_PROFILE_PHOTO`, migration
0029, crop in the browser/app, server crop + 512×512 greyscale JPEG, metadata stripped, ≤2 MB,
≤16 MP, HEIC refused because sharp has no HEVC decoder, removable after consent ends, in the
export, deleted with the account, never to the AI; refused in production and on staging); C1 (a
private `tools/results-generator`, one-page SAMPLE statements with no insignia, a contract-tested
`FakeResultsSource`; guard `tools-stay-private`); the neutral university mark (monograms in our
greys beside every university name, web and app; `logoPermission` in the catalogue; a test that no
logo file ships without one; docs/brand/logo-permissions.md, UJ unverified); My plan maps (five
templates, ticking under consent v3, words behind `UF_MINDMAP_WORDS` and a database trigger,
`assessDistress` on every save with the care card, four past-tense crisis rules added to
packages/agent test-first, D9: the profile goal crisis-checked); the app's react-native-svg
15.15.4 (icon avatars, the Hello arc, the self-drawing line; **needs a new dev/store build, no
OTA**); step 8 docs (docs/design/README.md §2d) and its A2 audit. **Audits:** A5 (filed as A5, not
A8: the README defines A8 as supply chain) and A11 round 2 (docs/audits/results/S1-A8.md,
S1-A11b.md): 2 High (staging outbox public; staging accepting real data) and A5-12, A11-30 (Read
aloud on for minors in production) fixed test-first by their owners; Lows A5-13, A11-32, A11-33,
A11-34 fixed. **Integrator fixes:** two tests that assumed their content section was last; an
E2E locator matching a placeholder; the plan-maps journey (adult box, exact "Achieved"); an E2E
warm-up (gotcha 47). **The owner's preview** now sets the switches and a default ElevenLabs voice
in `preview-dev.ps1` (the `.env.local` key had no `ELEVENLABS_VOICE_ID`, so the server refused its
services since 98a752b); its output goes to `preview-server.log`.

**S1 session 4 (2026-10-22 to 23):** the owner approved the profile design (D1–D8, every
recommended answer) and it is built test-first through step 7: tokens (178a415: seven themes; a
CIE76 colour-distance test moved Sunrise to #FF9F45 and turned Coral into Protea, #FF94C2, both
owed the owner's wording review), words and ids (857ae26), migration 0028 (35ef7e1), the API
(8a9ddd0), the web card and picker (781d72c), laid out as the owner's poster after their review
(20e80f3), the home avatar (272bbb5), the app's card, picker and home avatar (c9078f6, f0398f0;
en.me.appLead reworded, owed review). An agent built **My subjects round 2** (every recommended
answer; 11 commits ending b8c8d3a) and another **ElevenLabs as the only Read aloud voice** (web and
app via a signed-in GET /api/speech/[place], public catalogue text only, expo-audio replaces
expo-speech; ending 98a752b). **ElevenLabs needs its written approval for products directed at
under-18s** (planning §11 had recommended against it): no key on the live server until then; on
the owner's list. The owner chose: the profile **photo** as option A (built behind a switch, on in
the preview only, until consent v4) and the **neutral university mark** (a real logo only with
written permission; research in the session scratchpad), both not built yet; **mind maps** under
My goal are designed (the owner's yes on D1–D10 pending). **Hosting:** the owner asked for Render
with a friend's Vercel account to save cost: that is plan drift (student data stays in South
Africa; Render has no SA region as last known) and is handed to the next session's deployment
agent to write up with the plan-keeping option. Gate at 98a752b: web 753, native 358, admissions
215, tokens 209, content 85, ui 61, evals 15; E2E 16/16; root chunks 127.8 KB. Not run: the native
bundle budget (expo-audio added).

**S1 session 3 (2026-10-22, later):** S1's six Mediums are fixed on `phase-5/grade-10` (f8e787e,
95c2c3e, f0f46ee, 8fe4e13, 83e414f, 3fa0955) and the E2E sign-ins no longer share one address
(63c7608); then A11-25 (150aa74, the notice before the 18th birthday) and A10-35 (bf483ee,
"Report this reply"), each designed with the owner first; then **every open S1 Low** (e21bf7d to
2a24290: A1-38 to A1-41, A1-43, A3-29 to A3-31, A10-37 to A10-39, A11-27 and A11-26's docs half;
the owner chose **Grade 10 as the floor**, migration 0027). **No S1 finding is open** except
A11-26's consent wording (legal, consent v4). **A profile design proposal** waits for the owner:
docs/design/profile-look-proposal.md (themes, words and avatars for everyone, no gender field, no
photo until consent v4; decisions D1 to D8). **Next, in order:** (1) the owner's answers on the
profile proposal; (2) the web privacy page as a template for the legal adviser, its consent-box
link and the ECTA s43 footer; (3) C1. **Behaviour change to know:** a Grade 11
learner's confirm form now starts on the final Grade 10 report from January to November
(December: the final Grade 11 report), unless the uploaded report prints its grade; the owner
chose this (A1-35, option A). **Reply reports go nowhere but the server log** until the owner
names where (the safeguarding lead, A11-23; an alerting account, D8). **Migrations to 0027; next
free 0028** (the profile proposal would take it).
**S1 branch (2026-10-22): `phase-5/grade-10`** is now the newest branch (it contains
`phase-5/design-refresh`), checked out in the UniversityFlow-design worktree. G10-2/G10-3
(27a0d83), G10-1 (a4c6bf6) and **G10-4** (Stage 0 on the home, 2026-10-22) are built, each with
tests that failed first, every suite green uncached (web 645, db 317, native 326, the rest 10/10,
E2E 13/13). **Migrations to 0025; next free 0026** (G10-4 needed none).
**G10-5** (the words and the agent) and **G10-6** (documents) are done too. **Next:** a Grade 10 E2E journey with axe, then S1's audits A1, A3, A10, A11; then **the web privacy page** (a template for the legal adviser; the owner gives the responsible party, information officer, address and contacts) and **"agree ahead"** (once legal confirms); then C1. Was: G10-6 (privacy,
store and consent docs), a Grade 10 E2E with axe, audits A1, A3, A10, A11; then C1. The one PR
to `main` (when Actions has minutes) now comes from this branch.
**Design branch (2026-10-21):** the whole uncached gate passed at f65fb36; 67782a8 (the app's
one rhythm) passed lint, guards, native typecheck, native 310 and the native bundle budget on top.
Since then the app's outline buttons and its last three untitled screens follow the web
(native 312); the dropdowns and course filters merged; the design refresh audited (A2, A3, A4)
with its 4 Medium fixed (web 621, E2E 13/13). **Next:** the one PR when minutes return (it
supersedes #73, #77, #78, #79); **plan v0.9 approved 2026-10-21** (§18.8, §19.2), so next S1
(Grade 10) and C1 (the generator), each planned with the owner before building; the 13 Low findings when nearby; Outfit in the app with the
first device test.
**Design branch (2026-10-19 night):** `phase-5/design-refresh` is now the newest branch (it
contains `phase-5/stack`). Its whole gate passed uncached at 5d63711 in a separate worktree, and b52a323 passed lint, guards, web 604,
content 68, the web build, budgets and E2E 10/10. **When minutes return, the one PR comes from
this branch.** Owner, still open on the design: the new wording; whether the journey should gain a
campus-tour step and a "done" for Funding (each needs a record, a migration); confirm the E2E axe
helper waiting for animations. **The app's home and chat now follow the web** (docs/design §4):
next for the app, Outfit (`expo-font`, a rebuild) when the owner says, and a try on a phone.

**Next build session (start here):** **GitHub Actions has no minutes until the owner's next
payment** (every job refuses to start; gotcha 41), and `main` requires Static · Unit · Build with
admins enforced, so nothing merges until then. **All Phase 5 work is on `phase-5/stack`** (worktree
`UniversityFlow-p5-trial`): `main` at #76 + #73 + #77 + #78, the audit results, and five fix branches
(`phase-5/fix-{crisis,ux,consent,curriculum,lows}`, migrations 0021 and 0022), then the finishing session's `phase-5/{native-letter,registration-reminder,native-campus,design-parity,fix-flaky-phone-check,fix-offers-focus-race,status-finish,content-split,native-budget,ukzn-clinics,status-perf}` (migration 0023; **the next free number is 0024**). It passes the whole
gate locally, no cache: lint, guards, check:test, typecheck, every package one at a time, both
builds, E2E 10/10. **When minutes are back:** open one PR from `phase-5/stack` to `main` (it
supersedes #73, #77, #78 and #79: close those with a link), let CI run, merge. Then Phase 5 closes
on the owner's items below; Phase 6 (semester setup, Feb 2028) is next to plan. Keep verifying
locally with `pnpm turbo run test --concurrency=1 --force` (gotchas 39, 42). Worktrees open: UniversityFlow-p5-trial (the stack; remove it after the merge) and the owner's
UniversityFlow-preview (detached at the stack, with its local-only free pass: never commit it).
**Phase 5e (approved 2026-10-19; 5e-1 to 5e-4 built), for the owner:** decisions 1–3 before 5e-5 (in-app map provider, budget, consent v4), 7–10 (ask UJ Protection Services and the Disability Unit formally, re-check cycle and second sign-off, legal review of "No warning here doesn't mean it's safe.", partner apps); **settle UJ's 8 conflicting values** (both versions and URLs are in each record's note and docs/verification/uj.md: DFC security number, DFC clinic house, clinic hours, the APK and DFC library phones, APB PsyCaD phone, residence phones, 2026 registration start); **should under-18s see UJ's "carry pepper spray or a taser" tip** (`uj-self-defence`, flagged in its note); verify UJ's security places and the 10111/112 helplines, without which **no safety note shows at all**, even in preview; review the new wording (`en.campus` wayfinding and mobility strings, `en.safetyNotes`, `en.firstWeek.changeDeadlineUnpublished`); walk APK with the Disability Unit to record accessible entrances and arrival notes (none are published); decide whether the card should say "step-free entrance not published" for places without one (only the checklist says it now). **The checklists go stale on 2027-01-16** (gotcha 44).
**From the second round (2026-10-17 night), for the owner:** dial-test the new UKZN clinic
numbers before verifying them (docs/verification/ukzn.md: Westville 031 260 7302, Medical School
031 260 4506, and the Howard, PMB and Edgewood administrator lines, each with its phone source);
Westville's clinic building is unconfirmed (a DSU page says "E Block Next to the Campus Health
Clinic": check on site); the native bundle budget allows 5% growth over the committed baseline
(raise it, or refresh the baseline with `--update-baseline`, deliberately, in a PR); the
baseline was measured on Windows and CI builds on Linux, so the first CI run may need a refresh;
**A2-01** (web spacing mapped to the tokens: a visible change on every page) waits for your go.
**From the finishing session (2026-10-17 evening), for the owner:** review the registration-day
wording (`offer.registration-day`: SMS/WhatsApp "UniversityFlow: it is nearly time to register for
the university place you added. Open the app to see the dates." + "Reply STOP to stop."; push "It's
nearly time to register for your university place. Tap to see the dates.") and submit it to Meta
as utility; **decide the late-acceptance gap**: a learner who accepts after registration has
opened gets no reminder (falling back to the closing date needs its own wording, since "nearly
time" would be wrong); in the app, the offer card's "Turn on reminders under About me" points to
the web's About me, while the app's link goes to Notifications (an app-specific line is a new
string); the app's offline copy of My campus is a file in the documents folder, included in
iPhone backups (public records, a university id and a date only); the web campus tour's place
headings are now body-size bold under a `text-lg` card title (A2-20), and the first-week tick box
is 20 px in the brand colour (A2-18): say if either should change. Apple Maps from the app has not
been tried on a device.
**From the Phase 5 audits and fixes, for the owner:** legal review of guardian consent **v3**,
adult agreement **v2** and the rewritten docs/store/privacy-and-data-safety.md (A11-10); a way for a
guardian who agreed to v2 to agree to v3 (the gap #39 left; recommendation in the fix-consent
notes); adults under adult-v1 are sent back to the agree step; keep or drop the campus name in
SMS/WhatsApp crisis replies (A11-16, documented as a safety exception); the retention of letter and
proof files (A11-14 under A11-04); first-language review of every new crisis and care phrasing
(fix-crisis and fix-lows list them; the red team is at 323 cases); confirm `kys`, "my life is over"
and "can't live like this" as crises; confirm UKZN LLB's 64 open elective credits and Wits LLB's
minimum; ask UCT SWS what the Steve Biko and Groote Schuur points offer; a native rebuild for the
new camera wording (A7-14); the nav and home grouping belong to the design document (A2-12, A2-11).
**From Phase 5 (#67–#78), for the owner:** verify the new campus, calendar, faculty office and
curriculum drafts (`docs/verification/<uni>.md`; dial-test every clinic, counselling and security
number first); open **uj.ac.za** in a browser (it blocks automated access: UJ has no Phase 5
records; the official URLs found are in the UJ section below) and **up.ac.za** (UP has no
curricula: yearbooks blocked); settle the research contradictions listed in #69 and #71–#74 (TUT's
two clinic tables, the Wits and UKZN security numbers, UKZN's handbooks against two catalogue
admission records, UCT's CPS number, Physiotherapy's Psychology module); Wits publishes no
university-wide first-year registration window (no calendar record). Wording to review: offers
(#70: the four offer kinds, especially provisional), campus, first week and the seven safety tips
(#77), the My modules explanations and suggested message (#78), the five new care topics (#75) and
first-language review of #75's new phrases. Decisions: "I want to disappear" alone triggers the
crisis protocol (#75, confirm); campus lines in SMS/WhatsApp crisis replies name the campus on the
lock screen (#77: keep, or in-app only); safety pushes after an offer is declined stay scheduled
(#77); reply-by and change-deadline reminders 3 days before at 18:00 (#70, #78); retention of
acceptance letters and proofs of registration (A11-04); keep the E2E curriculum fixture pattern
(`UF_CATALOGUE_E2E_FIXTURES`, production refuses it, #78); whether helplines should be verified-only
in preview mode too, as campus safety lines are (#68).
**UJ official URLs (found by search, unread; open in a browser):**
- Calendar and registration: `https://www.uj.ac.za/wp-content/uploads/2025/06/2027-academic-calendar.pdf`,
  `https://www.uj.ac.za/admission-aid/registration/`,
  `https://www.uj.ac.za/wp-content/uploads/2021/09/undergraduate_first_year_student_registration_2026.pdf`
- Maps: `https://www.uj.ac.za/admission-aid/assessments/maps-venues/`, `https://www.uj.ac.za/virtual-campus/`,
  `https://www.uj.ac.za/contact-us/`
- Safety: `https://www.uj.ac.za/about/transformation-unit/gender-equity/` (Protection Services and Campus
  Health per campus), `https://www.uj.ac.za/about/impact/sdg-impact/sdg-3-good-health-and-well-being/3-3-5-mental-health-support-for-students/` (PsyCaD)
- 2026 yearbooks: Science `…/2026/02/final-2026-science-apk-undergraduate-yearbook-jan2026.pdf`, FEBE
  `…/2021/09/febe-2026-undergraduate-yearbook.pdf`, FHS `…/2021/09/fhs-yearbook-2026-final-v2-as-at-24-03-2026.pdf`,
  CBE `…/2026/03/cbe-undergraduate-yearbook-2026-03-10.pdf`, Education
  `…/2021/09/edu_academic-regulations_2026-yearbook_-may2026.pdf` (all under
  `https://www.uj.ac.za/wp-content/uploads`); Law and Humanities not found
- Faculty offices: `https://www.uj.ac.za/faculties/college-of-business-and-economics/academic-administration/`,
  `https://www.uj.ac.za/faculties/science/faculty-office/staff/`,
  `https://www.uj.ac.za/member-categories/faculty-of-education/academic-administration-staff/`
**From the Low sweep (#58, #62–#65), for the owner:** review the new crisis wording (owner and
first-language: `en.crisis.replySetHours`, `replyNoLines`, `concernReplyNoLines`, `cardLeadSetHours`
and the SMS `replyNoLines`/`concernReplyNoLines`); confirm that police/ambulance/112 lines don't
count as support lines in the crisis reply; decide whether saving a goal runs the crisis check
(A10-12's open half: the recommendation is in #63's body); approve "WhatsApp reminders aren't
available yet." and the app's About me lead (`en.me.appLead`); set the WhatsApp budget
(`UF_WHATSAPP_BUDGET_PER_HOUR/PER_DAY`, 500/2000 are placeholders) and route budget alerts to
Sentry or a pager; live SMS/WhatsApp adapters must implement `sendReply` (the STOP confirmation);
legal may confirm the s11(3) objection wording (planning.md §8.1); optionally host a synthetic
SAMPLE report for store reviewers (docs/store/review-notes.md, owner step 5).
**From #53–#56, for the owner:** review the new message wording and re-submit the four WhatsApp
templates (with their Stop button) to Meta; the report-confirmation limits (10 an hour, 24 a day)
are a first guess.
**From #48–#51, for the owner:** turn on Expo enhanced push security and set `EXPO_ACCESS_TOKEN`;
give `EXPO_PUBLIC_UF_API_URL` plain (not secret) visibility in EAS, or the build check refuses it;
decide whether an adult who hasn't agreed yet may still export their data (POPIA right of access);
check the keyboard fix on an iPhone SE.
**From the Phase 4 audits, for the owner:** for each store submission, the review sign-in's steps in docs/store/review-notes.md (a company SIM, a hashed PIN, three variables for the review window only, the seed, then clean-up); legal review of consent v2
(the guardian and the new adult wording name the SMS company, Meta, Expo, Apple, Google and the
AI provider) and the Information Officer (A11-10); a retention schedule (A11-04); make
`EXPO_ACCESS_TOKEN` required before push goes live (A5-03); whether to chase A4's 120 KB
first-load budget or waive it (Next 16 + React 19 alone are ~127 KB; CI holds 150 KB); first-
language review of the 47 new red-team phrases; `AUDIT_SUITE_TOKEN`, without which the phase gate
in CI skips.
**From 4d and 4e, for the owner:** the review sign-in option; Apple (D-U-N-S), Google Play and Expo
(`eas init`, `UF_EAS_PROJECT_ID`); APNs key and a Firebase project for push; a privacy policy URL
naming Expo, Apple and Google; final artwork for the placeholder icons; the age rating; settle Q22
(18 Siyavula links; keep the closed-copyright CAT/IT books?); first-language review of the new
crisis and care phrases (15 flagged in packages/evals and crisis.ts/care.ts); try the app on a phone.

**Try the mobile app:** `pnpm --filter @universityflow/web dev`; set `EXPO_PUBLIC_UF_API_URL`
(`http://localhost:3000` iOS simulator, `http://10.0.2.2:3000` Android emulator, your LAN IP on a
phone with Expo Go); `pnpm --filter @universityflow/native dev`. PINs appear at `/dev/outbox`.

---

## Phase board

| Phase | Name | State | Due | Audits owed |
|---|---|---|---|---|
| **P** | Planning | ✅ **Closed 2026-09-28** (plan v0.2) | Oct 2026 | — |
| **0** | Foundation & tooling | 🟠 Scaffold ✅ · CI ✅ · guards ✅ · visual identity ✅ · stand-ins ✅ · A8 ✅ · A11 ✅ · spikes written up ([docs/research/spikes.md](docs/research/spikes.md)): **2 of 5 hold on stand-ins** (SMS sign-in; agent streaming), report reading proven only from upload to results, latency and the Trigger.dev reminder not started; **none run on a real service yet** (an earlier line said 3 of 5) | Nov 2026 | A1 A8 A11 ✅ |
| **1** | Knowledge layer | 🟠 Built and tested: **86 programmes at 6 universities, all drafts awaiting verification** (an earlier count said 89) | Jan 2027 | A1 A2 A3 A13 ⚪ |
| **2** | Chat core | 🟠 Built, tested and audited (A1, A10, A11). Real AI not connected yet | Feb 2027 | A1 A6 A10 A11 ⚪ |
| **3** | Stages 1–2: Results & applications (MVP) | 🟠 Built, E2E-tested with axe | **Mar 2027** | A1–A6 A10 A13 ⚪ |
| **4** | Stage 3: Messaging & matric support | 🟠 In test/audit (planning.md §11): **4a messaging foundation ✅ (#25)** · **4b goals and the exam timetable ✅ (#30)** · **4c what I need, re-checks ✅ (#29)** · **4d the app in the stores ✅ (#33)** · **4e practice and care ✅ (#32)** · **audits ✅ run 2026-10-14**, all 14 Critical/High fixed (#35–#40, #42). Open: device testing, store review | Jun 2027 | A1–A5 A7 A8 A10–A12 ✅ |
| **5** | Stages 4–5: Orientation & registration | 🟠 Built and audited (planning.md §11): **5a offers (#70)** · catalogue core (#68) and drafts for UP, TUT, UKZN, UCT (#69, #71, #72, #74) and Wits (on the stack); UJ blocked · **5b campus and first week**, **5c registration check** · **5d care and red team (#75)** · **audits run 2026-10-17**, all 4 Critical and 2 High fixed. All on `main` (squash-merged; the old stacked branches are on the cleanup list). Migrations 0018–0023. **5e-1 to 5e-4 built 2026-10-19** (wayfinding links, accessible arrival, read-aloud, UJ, safety notes; 5e-5 waits on the owner). **A1-33 delivered 2026-10-17** (the letter by camera in the app; the registration-day reminder). Open: data verification, legal review, device testing | Jan 2028 | A1–A4 A7 A10 A11 A13 ✅ |
| **6** | Stage 6: Semester setup | 🔵 Approved 2026-10-24 (planning.md §11, v0.10; D1–D14 as recommended; built now on drafts): **6a how marks work ✅ (#123)** · **6b module outlines ✅ (#124, migration 0040)** · **6d free books ✅ (#118)** · **6c module cards and the calculator ✅ (#129, 0041)** · 6e tools and reminders (next) | Feb 2028 | A1–A8 A10 A11 A13 ⚪ |
| **7** | Stage 7a: Study coach | 🟡 Proposed: docs/plans/phase-7-proposal.md (#104), waiting for the owner | Mar 2028 | A1 A10 |
| **8** | Stage 7b: Partnership pilot | ⚪ Not started (needs a partner university) | — | A1 A5 A11 |
| **9** | Stage 8: Continuity & portfolio | 🔵 **My CV with Mmereko built early** behind `UF_CV`, off for learners until consent v4 and the Tumoolo–Mmereko agreement (#85, #90, #93, #95, #107; planning §20); the portfolio and degree-long thread proposed (docs/design/portfolio-proposal.md) | Nov 2028 | A1 |

**Legend:** ⚪ Not started · 🟡 Planned · 🔵 In progress · 🟠 In test/audit · 🔴 Blocked · ✅ Gate passed

**Audits owed** is read by the audit pipeline ([docs/audits/README.md](docs/audits/README.md)):
⚪ means still owed, ✅ means every audit listed has run with no open Critical/High. Phases 1–3
were audited together (A1, A10, A11 on 2026-10-13), but A2–A6 and A13 haven't run, and A13 can't
until the catalogue is verified.

A phase closes (✅) only with no open Critical/High finding, every suite green, and, for
Phases 1–3, verified data. So they stay 🟠 until the owner's verification pass.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-10-24 (night) | **The judge demo's chat runs on Google's Gemini for 15 days, until 2026-11-08** (`UF_AI_PROVIDER=gemini`, `GEMINI_API_KEY`), then back to Anthropic; **reverses A10-46 for the demo only, knowingly** (Gemini's terms are 18+; the demo holds made-up learners and adult judges). Production still refuses Gemini. The demo must say so plainly: a demo-only line naming Gemini while it is on (the privacy page names Anthropic), never presenting Gemini as Anthropic | The owner wants the MVP's real chat for the judging without an Anthropic key yet |
| 2026-10-24 (night) | **Open Mmereko on My CV**: Mmereko's own site in a full-screen canvas, for learners **18 or over or at university only**, behind `UF_CV_MMEREKO_CANVAS`; nothing about the learner sent to it. **Changes the approved Mmereko design** (planning §20: Mmereko a stateless partner engine, the learner never signs in to it), knowingly: the owner owns Mmereko. Mmereko now lets only UniversityFlow frame it (Mmereko #6) | The owner: Mmereko is one of the apps students need to better their CVs; minors kept out by the 18+ / university rule |
| 2026-10-24 (night) | **GitHub Actions paid again** (Team plan, an Actions budget); merges go through GitHub's CI, admin-merge no longer needed | Gates no longer queue on one laptop |
| 2026-10-24 (night) | **The live demo on universityflow.tumoolo.tech**, the judges' Firebase sign-up on, Read aloud on in ElevenLabs' "Sarah" voice (the owner: "any best friendly voice") | The owner's domain and keys |
| 2026-10-24 (night) | **All four previewed features, the polish, the front-door fix and Open Mmereko merged** ("yes, merge all") after the owner looked at :3006 | Seen before merging, as agreed |
| 2026-10-24 | **The judge demo shows everything** (hackathon exceptions E–H, docs/deploy/hackathon-undo-pr.md): the real sign-up journey on made-up details (080 numbers only, the PIN and the guardian's link on screen, deleted after 24 h; 100 PIN requests an hour per address on the demo only), My CV with the stand-in engine (Mmereko never called, D14), plan-map words and Read aloud (both reversing the 2026-10-23 "no"). Not chosen: visitors' own photos | The owner: judges should see the whole product. Real people stay out (080 numbers, on-screen PIN, 24 h) |
| 2026-10-24 | **Phase 6 approved, every recommended answer D1–D14** (planning.md §11, plan v0.10), **built now on drafts**, overriding the proposal's "after Phase 5" timing (its plan-drift flag 1, told to the owner) | The owner wants the semester tools ready; drafts reach no learner until a person verifies them (hard rule 3) |
| 2026-10-24 | **Pictures behind cards:** the course cards (#121, approved after a local look), My subjects, the Phase 6 module cards and My offers; each word kept readable (a token scrim held to AA) | The owner: a fitting picture behind each card, every word clearly readable |
| 2026-10-24 | **All public TVET colleges in every province, now** (over the recommended Gauteng first; supersedes §19.2's "after the MVP"): drafts from DHET's register and each college's own site, the "Is this college registered?" check, colleges in Plan B, the "University" filter becoming "Institution", and **each college's logo on the demo only** with UJ's and UP's (the demo-only logo exception extended) | Plan B must be real for learners whose best route is a college; registered-only protects them from fake colleges |
| 2026-10-24 | **The plan maps become a canvas on a card**: their own viewport, panned both ways without scrolling the page, zoom in and out, a full-screen canvas that closes (the owner: "be very creative") | Bigger maps that are pleasant to explore on a phone |
| 2026-10-24 | **The owner's original photos live in `photos/`** in the main checkout (git-ignored, named for their use); the unused ones, and every photo of a real person, to the Recycle Bin (#126) | Only what the product uses; real people's photos never used |
| 2026-10-23 (late) | **The live site stays the judge demo; its sign-up and log in are demo-only** (made-up learners; the judges' Firebase sign-up when keyed). **The real launch is prepared separately** (#98) for the owner to connect accounts | The owner tried to sign up on the demo. Real learners' data stays in SA behind verification and legal review (locked) |
| 2026-10-23 (late) | **Profile photos for learners from Grade 10, ready now** (#100), switched on with consent v4: shown only on the learner's own profile, used for nothing else | The owner: learners stay motivated with their own photo "as long as the picture is not used for anything else" |
| 2026-10-23 (late) | **Supabase as the judge demo's database** (made-up learners only; London/Frankfurt); **real photo uploads on the demo** as a hackathon exception (`UF_DEMO_REAL_PHOTOS`, own photo only, deleted with the copy); **university logos on**. Legal work after the hackathon | The demo shows how it works and looks; real learners stay on AWS af-south-1 |
| 2026-10-23 | **The FNB hackathon judge demo:** a public deployment (`UF_DEPLOYMENT=demo`, its own Vercel project, `UF_DEMO_PROJECT=1`), no password, on **six synthetic personas** (Grade 10, 11 and 12; first year UJ, second year Wits, final year UCT; no gender field). Each judge gets a **private copy, deleted after 24 hours**. No phone/SMS sign-in; uploads take only the generator's SAMPLE statements; honest "coming next" cards for Stages 6–8. **Chat uncapped** (the owner overrode the recommended per-judge cap); an optional daily cap across the demo, `UF_DEMO_AI_DAILY_CAP`, off unless set; a spend limit on each AI key bounds the cost | Judges must try the real product in one click. Made-up learners only, and the demo refuses everything production is made of, so nothing real is at stake (docs/deploy/demo.md) |
| 2026-10-23 | **Gemini as a second `ChatModel`** (`UF_AI_PROVIDER=gemini`, `GEMINI_API_KEY`), **demo only**: production refuses both until the consent wording, the privacy page and legal review name Google. Reading documents stays with Anthropic. Paid tier only (A10-50). **A10-46: the demo runs on Anthropic**, because Gemini's terms are for users 18 and over and forbid services likely used by under-18s | A second provider for resilience and comparison, without a new operator for learners. Gemini's age terms keep it away from anything a minor may use |
| 2026-10-23 | **Real university logos in the judge demo only**, a **hackathon exception** (`NEXT_PUBLIC_UF_DEMO_LOGOS=1`; Wits, TUT, UCT, UKZN; UJ and UP kept the grey mark until #125 added theirs on 2026-10-24), with the banner line "University logos are shown for this demo only. UniversityFlow is not affiliated with or endorsed by these universities." Production and staging refuse it. Option A (docs/brand/logo-permissions.md) stands everywhere else. Only the logos were lifted: the owner declined lifting Read aloud, the photo upload and the plan-map words in the demo | For the judging only; reverted afterwards. No university has agreed in writing, so the real service shows no logo |
| 2026-10-23 | **The Firebase real sign-up for judges**, a **hackathon exception**, approved verbatim: *"approved: build the Firebase real sign-up for the judge demo, 18+ only, accounts deleted after 30 days"* (`UF_DEMO_SIGNUP=firebase`, migration 0034 `demo_signups`; email link or Google). Adults only, held in the data layer; only the uid and email kept; every account deleted 30 days after it was made; the CSP admits Firebase only on the sign-up page. Accepted for the hackathon: real adults' data in the demo database, Google Firebase as an operator, notice wording without legal review. **The owner asked that it be recorded that the real intention is safety and following the law** | Judges may want their own account beside the made-up learners. Undone after the hackathon: switch off, accounts and the Firebase project deleted, code removed, table dropped (docs/deploy/hackathon-undo-pr.md) |
| 2026-10-23 | **Mmereko built now as the CV engine** (My CV, `packages/cv`, migration 0035; Mmereko's stateless `/partner/v1`), with **every recommended answer, D1–D17**, of docs/design/mmereko-api-proposal.md §13: UniversityFlow holds the CV of record and Mmereko is stateless (≤ 24 h); a partner cell in af-south-1; Anthropic only for partner jobs; recruiter links served by UniversityFlow, from 18 only; the base CV deterministic, AI only for tailoring; one consent v4 / adult-v3 and a separate CV opt-in; and the rest as recommended. **`UF_CV` stays off for learners** until consent v4 / adult-v3 (legal review) and the Tumoolo–Mmereko agreement exist; the judge demo never calls Mmereko (D14) | Pulls Stage 8's CV help forward from Phase 9 (plan-drift flag 1 of the proposal), built against a fake (D8) so nothing reaches a learner before the agreement, the region and the consent |
| 2026-10-23 | **Sample photos only in the demo:** the profile photo is chosen from six drawn SAMPLE pictures (packages/documents `sample-photos.ts`), never a real upload; `UF_PROFILE_PHOTO` stays refused on a demo | A public demo must never receive a real person's photo |
| 2026-10-23 | **The journey in pictures on the front door** (the owner's own change, made in the preview folder and brought in as #96): three decorative pictures (Grade 10, university, graduation) behind the wordmark on laptops, hidden on phones; 360/540 px copies, `loading="lazy"` so a phone never fetches them, `fetchpriority="low"` | The owner asked for it to load fast online (the launch standard's mobile speed); decorative, so no words to read and the reduced-motion entrance applies |
| 2026-09-28 | Follow tumo-olo's working cycle and phase gates | Proven on the last project |
| 2026-09-28 | **D1** First cohort: Grade 11 in 2026. MVP live for the 2027 application season | The admissions calendar sets the deadline |
| 2026-09-28 | **D2** First universities: Wits, UJ, UP, UCT, TUT, UKZN | Six scoring systems is a manageable, verifiable start |
| 2026-09-28 | **D3** v1 runs on public plus student-provided data. One partnership pursued for Tier C | No legitimate access to university systems without a partner |
| 2026-09-28 | **D4** Own accounts (phone OTP / email). SAFIRE later | Student number + ID number isn't a secret |
| 2026-09-28 | **D5** Free for students. Funded by universities, funders and sponsors | Cost per student tracked from Phase 2 |
| 2026-09-28 | **D6** Web app (installable) + WhatsApp/SMS. No native app | One codebase. WhatsApp for low-data users |
| 2026-09-28 | **D7** Folder renamed `UnivesityFlow` → `UniversityFlow` | Before `git init`, while it was free |
| 2026-09-28 | **Stack** (§16): Next.js 16 on Vercel `cpt1` · Postgres + S3 in AWS af-south-1 · Drizzle · Better Auth · Anthropic SDK (`claude-opus-5`) · Trigger.dev · Sentry · Vitest/Playwright + evals | tumo-olo's foundations plus in-country data. To be confirmed by the five Phase 0 spikes |
| 2026-09-28 | Code decides admission facts, the AI explains them (**hard rule 2**) | A wrong requirement or deadline costs a learner a year |
| 2026-09-28 | **Q9** Tier A data: the owner verifies the first six universities with a checklist; paid student verifiers per university later | Accuracy matters most at the start, and the volume is small |
| 2026-09-28 | **Q16** UniversityFlow gets its own visual identity, on tumo-olo's token pipeline | A student product, not a studio site: friendly, high-contrast, legible on cheap phones |
| 2026-09-28 | **Q17** Private repo `tumoolo-tech/universityflow`, with tumo-olo's branch protection | Same company home, same merge discipline |
| 2026-09-28 | **D6 revised:** web app **and** Expo mobile app in one monorepo (was: web only) | Owner's call. Push notifications, camera, offline. Web carries the March 2027 launch; the app's first store release goes with Phase 4 (June 2027) |
| 2026-09-28 | **D8:** build against local stand-ins; owner connects real accounts at the end | Owner's call. Every provider behind an interface with a fake and contract tests. Risk noted: AI quality needs the real key to prove |
| 2026-09-29 | **Research review adopted** (planning.md §17) | Owner approved. Each fits the existing decisions |
| 2026-09-29 | **Research review declined** (§17.2) | Each conflicts with a locked decision; reasons recorded |
| 2026-10-13 | **Catalogue drafts:** researched records carry `sourceUrl` + `academicYear` and stay drafts until a person adds `verifiedOn`/`verifiedBy`. `catalogueView` shows drafts only when asked (`UF_CATALOGUE_PREVIEW=1`), labelled, and production refuses that flag | Hard rule 3 without blocking the build: the code can be built and tested on real-shaped data that no learner can see |
| 2026-10-13 | **Accounts: own phone OTP sign-in, not Better Auth** (planning.md §16.1 updated) | Consent for minors lives in the same database layer as sign-in; small, fully tested, swappable later |
| 2026-10-13 | **Embedded Postgres (PGlite)** for tests and zero-setup local development; real Postgres via `pg` in production and CI | Real Postgres semantics (RLS, roles) in every test without Docker |
| 2026-10-13 | **Model stays `claude-opus-5`** (planning.md §16.3), configurable via `ANTHROPIC_MODEL`. `claude-opus-5-5` is its newer, cheaper successor ($4/$20 vs $5/$25 per MTok); note it uses preserved thinking, so switching means making chat history append-only | The plan names Opus 5; the owner decides on a switch, on measured quality |
| 2026-10-13 | **The pipeline** (planning.md §12.4): confetti-confectionery's (shared tumoOLO_Audits suite, gated deploy, CODEOWNERS) plus a crisis red-team check, a gitleaks secret scan, an "Owed checks" PR comment, a native-dependency guard and a read-only @claude | Most code is written with coding agents: CI names what only a person can do, and guards catch what agents repeat |
| 2026-10-13 | **Data accuracy renumbered A9 → A13** (planning.md v0.4) | The suite's A9 (per-PR security review) is shared by every company project |
| 2026-10-13 | **A8-01 accepted:** two High advisories in Expo/Jest build tooling with no patch, ignored by exact GHSA id | A red check nobody can fix trains people to ignore red checks; any new High still fails |
| 2026-10-13 | **A score is a draft unless its method is verified too** | A verified record scored by an unverified formula is still an unverified fact (hard rule 3) |
| 2026-10-13 | **SMS provider not chosen;** the adapter registry is empty and live mode refuses to start | The owner's call (D8), on current quotes |
| 2026-10-13 | **S3: SSE-S3 by default, SSE-KMS when a key is set; region af-south-1 enforced in production; browser uploads direct to the bucket with a 5-minute signed POST** | Residency, encryption at rest, and Vercel's 4.5 MB body cap |
| 2026-10-13 | **CSP `style-src` keeps `'unsafe-inline'`** (scripts don't) | Next's built-in error pages use inline style attributes, which a nonce can't cover; style injection can't run code |
| 2026-10-14 | **The database decides consent for adults too**: an adult with no recorded agreement of their own is not processed by pages, routes or jobs (#49) | One rule everywhere (hard rule 5, A7-04). Side effect for the owner: such an adult's export is empty until they agree, as for a withdrawn minor. Whether the right of access should bypass the gate is a POPIA call |
| 2026-10-14 | **The daily session sweep re-schedules itself** (a job per day, keyed by date; also seeded at every start) | There is no recurring-job mechanism; a lost chain restarts on the next deploy |
| 2026-10-14 | **A send of unknown outcome is never retried** (`unconfirmed`) | A missed reminder costs less than a doubled one; it still counts toward the weekly cap |
| 2026-10-14 | **Two SMS budgets** (`sms-auth`, `sms-reminders`), counted in segments; limits stay placeholders | Reminders must never lock a learner out of signing in |
| 2026-10-14 | **A STOP outlives the account**, kept only as an HMAC of the number | An objection holds even with no account behind it, and the list carries no personal data |
| 2026-10-14 | **Paper protection counts draft papers** (A12-01); learners are still shown only verified ones | A draft date can only make the companion quieter. A paper that isn't shown never raises the exam-week cap (`holdOnly`) |
| 2026-10-14 | **Consent v2** for guardians, and **adults agree too** before chat and uploads (A11-01, A7-04) | Messaging and push send data to Meta, Expo, Apple and Google, and chat to an AI provider outside South Africa: POPIA transparency and App Store 5.1.2(i). Wording awaits legal review |
| 2026-10-14 | **Web root chunks held at 150 KB gzipped in CI** (A4-01), not A4's 120 KB | Next 16 and React 19 alone are ~127 KB. Chasing 120 KB or waiving it is the owner's call |
| 2026-10-16 | **Phase 5 planned and approved** (planning.md §11, v0.6): offers, campus and first week, registration check, the app | Owner's approval. Built now on drafts; the 2028 curricula are re-researched when faculties publish them (~Nov 2027) |
| 2026-10-16 | **Q14 for now:** the campus tour is text plus links to each university's own maps and tours, and "open in maps"; no hosted media, no map tiles. **Curricula:** all 86 programmes' first year, as drafts. **Safety guidance:** push and in-app only | Owner's choices (the recommendations). Data-light, no new third-party origin, nothing to pay Meta for tips |
| 2026-10-19 | **Phase 5f planned, not built: Meta's open models as self-hosted fallbacks** (planning.md §11, v0.8): Llama 3.2 as the chat fallback, Llama Guard 3 as a safety layer, Llama 3.2 Vision as the reader fallback, NLLB for translation into six SA languages (off; non-commercial licence) | Owner's request for a challenge that asks about Meta's AI technologies, then "don't implement yet, update the plan". Resilience and residency (self-hosted in af-south-1). Until built, the honest answer is "none". The three Llama models were downloaded into the local Ollama for the live tests |
| 2026-10-17 | **Phase 5e proposed (planning.md §11, v0.7): walking guidance, safety notes, accessible routes.** Owner's choices: hand-off links now (walking directions and Street View in the phone's maps app), an in-app map later as its own sub-phase; safety warnings only from what the university publishes, verified; UJ read through a real browser (done: ~30 pages, no challenge). The plan waits for approval and decisions 1–10 | Owner's request with screenshots of UJ APK; four research passes (links and maps, safety, accessibility and voice, UJ's pages). ElevenLabs not recommended: written approval needed for under-18s, no SA languages beyond Afrikaans, no African data region |
| 2026-10-17 | **A13-11: a place's building and location may be unpublished; a phone may have its own source; UKZN clinics take the administrator's line** | Owner's choice (the recommendation). The page lists staff lines, not a clinic line, and no building: optional fields beat a guessed one (gotcha 40). Drafts, dial-tested before verifying |
| 2026-10-17 | **The registration-day reminder goes like the reply-by reminder** (A1-33; planning.md §11, 5b decision 4): on the learner's first opted-in channel, push, then WhatsApp, then SMS; 18:00 SAST three days before first-year registration opens (or closes, when only the close is published), from a calendar the learner may see for the offer's year | Owner's decision. A utility reminder about the learner's own accepted place, worth an SMS where push is off; nothing personal in it (A11-02) |
| 2026-10-21 | **Plan v0.9 approved** (planning.md §18.8, §19.2), part by part, every recommended answer: Grade 10 as an extra entry (D1 kept), `grade-10-final` only in S1; studios free for our learners, their tutor through UniversityFlow's AI and crisis check, their data in South Africa, their engine in one separate studio monorepo; S1–S5 in order; Part C's C1–C3 now (generator in `tools/results-generator`), C4 later (DBE first, IEB second); the North Star and H0; gates H1 → H2 → H3, UJ first; colleges the next wave after the MVP (Gauteng TVET first, private after, the registration check may come earlier) | Owner's approval. No locked decision changes now: D3 changes only at gate H2, D2 grows when the colleges wave starts. No outreach until the owner says so |
| 2026-10-13 | **Visual identity (Q16)** built: warm paper canvas, near-black ink, deep green actions, marigold accent behind dark text; system fonts (no download); 17px base; every pair tested for WCAG AA | Legible outdoors on a budget phone, nothing to download |

---

## Completed work

### 2026-10-23 (late night) — S1 session 7: ten agents (wave 3), then the owner's front-door pictures

- **How:** ten agents, each in its own worktree off `main` at 092163c, under a shared rules file
  (at most three test runs at once, by lock files: the machine had ~60 of 81 GB committed).
  The integrator checked each diff (no weakened test, no AI attribution), merged all ten on
  `phase-5/wave-3-int`, ran the whole gate once there, then landed one PR per agent (#87–#95)
  in order; the two CV branches collided in `cv-view.tsx` and the app's `cv.tsx` and the
  resolution keeps both (the crisis hold, the AI notes and the per-card errors)
- **Shipped:** A10-49 closed (migration 0036; Gemini never serves production, proven by 23
  tests); CV-A5, CV-A10, CV-A11 and CV-A2 (3 High fixed, all in CV-A10); the judge demo walk (2
  High fixed) and `/demo/guide`; agent branch coverage 91.9%; the app's development build made a
  dev client (`expo-dev-client@~57.0.20`, a new app build is needed) and an Android checklist;
  the real-Postgres and real-S3 suites green (499/499, 244/244) and a High in Mmereko's partner
  store fixed (Mmereko#5); the hackathon undo PR ready to run; README and planning §20; the
  judge demo's spec kept as docs/design/judge-demo-spec.md
- **The owner's front door (#96):** the owner had committed six front-door commits (the journey
  in pictures) in the preview folder, so they showed on :3005 but never reached `main` or the
  live site (gotcha 51). Brought in on `phase-5/landing-pictures`; at the owner's request made
  light to load: 360 and 540 px copies with `srcset`/`sizes`, `loading="lazy"` (the column is
  hidden on phones, and a hidden lazy image is never fetched: about 174 KB saved there),
  `fetchpriority="low"`; a test that failed on `main` first
- **Wording review page:** 972 strings (291 new keys from en.cv, en.demo, en.demoPersonas,
  en.demoSignup, en.schoolRecord and two screen-reader lines); no verdicts recorded yet, so no
  wording changed. New keys this wave: `cv.make.held`, `cv.preview.tailoredNote`,
  `cv.tailor.aiNote`, `en.demoPersonas.guide.*`
- **For the owner:** see Next 3 actions (the CV hold, the A10-53 reviewer, the cleanup list, a
  phone build, the live demo's 503)

### 2026-10-22 (later still) — Every open S1 Low, and a profile design proposal

- **The owner's choice:** Grade 10 is the floor (A1-39): the API, the store and migration 0027
  refuse Grade 9 (a Grade 9 given before is cleared, so the app asks again); planning §8.1 and the
  store documents say so
- **Fixed, each test-first** (the commits are in the S1 Lows row): About me sends the grade only
  when changed; the app's confirm form waits for the grade; the home never shows "0 courses" when
  no course could be checked; the January grade check keeps focus and says "Saved" on the web and
  announces on the app; the subject chips stand out; the stand-in says "on track" on Grade 10
  marks; past matric the AI is told "finished school", not "Grade 12", and the export shows the
  grade the app shows; the hard-moments guidance fits a Grade 10 learner; the store page calls the
  grade required. `migrate()` can stop after a migration (`through`) for tests of older rows
  (migrations.test: 0025's backfill, 0027)
- **A design agent** (the owner's request, from two reference pictures kept outside the repo)
  proposed a customisable profile: docs/design/profile-look-proposal.md. Its code claims were
  checked (no Reanimated, `react-native-svg` or `expo-font` in the app; `useReduceMotion` exists;
  the app's About me only deletes, A7-09; consent v3); its contrast figures are untested until
  built. Not approved, not built
- **For the owner, wording:** `en.agent.sample.resultsGrade10`; the two hard-moments additions
  (model-facing)

### 2026-10-22 (late) — A11-25 and A10-35: designed with the owner, built test-first

The owner approved both designs with every recommended answer: reports carry reasons only, no
free text; crisis replies can be reported; reports go with a deleted account (whether
safeguarding needs them kept goes to the legal reviewer, A11-23); the birthday card can't be
dismissed and shows all 30 days; no SMS or push before the birthday for now.

- **A11-25 (150aa74):** in the 30 days before the 18th birthday, while a guardian's consent covers
  the learner, both homes show "You turn 18 on <date>" and that from then their own OK is needed
  and reminders (exam ones too) pause. `eighteenthBirthdaySoon` (packages/db age.ts, South
  African days, 29 February as `ageOn` counts it); `homeData` takes the account;
  `HomeData.turningEighteen` reaches the app through `GET /api/home`. No migration, nothing sent
- **A10-35 (bf483ee):** "Report this reply" under every stored AI reply, web and app: a reason
  from `REPLY_REPORT_REASONS` (harmful or upsetting, wrong information, something else), never
  free text; a thank-you that takes focus (web) or is announced (app); "harmful or upsetting" adds
  Get help (`/help`; the app opens it in the browser, having no help screen); "Reported" for a
  reply reported before. Migration 0026 (`reply_reports`: ids and the reason, one per reply,
  row-level security, consent gate, export, deleted with the account; audit `reply.reported`);
  `POST /api/chat/messages/[id]/report` (20 a day); the stream's `done` carries the stored reply's
  id. `ReplyReportAlerts` logs ids and the reason only (D8): **the owner names where reports go**
- **Checked:** red team 100% after the content changes; native bundles within budget (iOS
  2892.6 KB, Android 3126.2 KB, +3.8% on the baseline, 5% allowed); client chunks clean; E2E 14/14
  with the crisis journey reporting its crisis reply, axe on the open form and the thank-you
- **For the owner, wording:** `en.dashboard.turningEighteen`, `en.chat.report`. **Legal:** keep
  reply reports after account deletion for safeguarding? (A11-23)

### 2026-10-22 (later) — S1's six Mediums, test-first

The owner said go with every recommended answer (the typed-marks default: option A; a learner with
no grade on record may confirm any kind; the two new sentences as proposed). Each fix has a test
that failed before it.

- **A1-34 (f8e787e):** `examInputs` (exam papers and paper silence) reads the latest report as
  every other reader does: one ordering, `LATEST_REPORT_FIRST` in schema.ts, Grade 10 last
- **A10-32 (95c2c3e):** the Grade 10 "on track" note goes with programme_details, what_i_need,
  set_goal and show_goal, not only my_results
- **A10-33 (f0f46ee):** a "Children's safety" section in the cached system prompt (no romantic or
  sexual talk; an adult or someone online asking for secrets, photos or a meeting: not OK, not
  their fault, tell a trusted adult, crisis_card; no safety secrets from a guardian). A stopgap
  until Anthropic's child-safety prompt
- **A10-34 (8fe4e13):** `NSFAS_DECIDES` in the prompt and funding_overview's facts; the model
  explains published criteria, never says whether a learner qualifies or how much
- **A11-24 (83e414f):** no sign-up under 13: `setDateOfBirth` throws `TooYoungError` before
  anything is read or written; 409 `state`/`too-young`; both apps' date-of-birth step shows
  `en.errors.tooYoung`; the store page and release checklist say where it is enforced
- **A1-35 (3fa0955):** the report draft carries `printedKind` (the grade and term the document
  prints, only when they settle it); both confirm forms start there, else on
  `defaultReportKind(grade, today)`: in Grade 11, the final Grade 10 report from January to
  November and the final Grade 11 report in December. POST /api/reports refuses a kind above the
  current grade (409 `report-above-grade`, `en.errors.reportAboveGrade`). The journey E2E's Grade 11
  learner now picks "final Grade 11 report"
- **E2E (63c7608):** the suite's ~12 sign-ins from one address passed the product's 10 PIN
  requests per IP an hour, so the late A3-24 journey got "Too many tries" (three full runs in a
  row, and at 5dfefab too). Each `signIn` now sends its own TEST-NET-3 `x-forwarded-for`; the limit
  is unchanged (gotcha 46)
- **Red team 100%** after every agent and content change. `pnpm audit --prod` (SEC-03, by hand):
  3 moderate, all in the Expo/native chain (`uuid` via xcode, GHSA-w5hq-g745-h8pq;
  `decode-uri-component` via expo-router's query-string, GHSA-vcc3-ghjq-m6fr; `sprintf-js` via jest
  tooling, GHSA-hp3w-g68c-fv3c), plus A8-01's two accepted Highs; nothing on the web server
- **For the owner, wording:** `en.errors.tooYoung`, `en.errors.reportAboveGrade`, the prompt's
  children's-safety section and NSFAS rule (model-facing). **Ask Anthropic** for their
  child-safety prompt (A10-33)

### 2026-10-22 — S1: a Grade 10 E2E journey, and the law and security research

- **`e2e/grade-10.spec.ts`** (7bb9b6c): a 15-year-old, their guardian agreeing by SMS link, Grade
  10; Stage 0 on the home ("on track", no applications); a Grade 10 report with Mathematical
  Literacy typed and confirmed is never "You qualify now"; My subjects shows the closed doors;
  axe throughout. **E2E 14/14** (the A3-24 chat test timed out once at sign-in on a loaded
  machine, gotcha 18, and passed alone in 2 s)
- **Two research briefs** (owner's request) in docs/research/, each checked at the top; see
  "Research findings" under Open findings. Two of the security brief's claims were checked and
  **not supported** (its Next.js and React advisories); one was confirmed in code (SEC-04)

### 2026-10-22 — S1: privacy, the stores and consent from Grade 10 (G10-6, documents)

- **The owner's choices** (each the recommendation): Apple age rating **13+** (16+ would shut out
  15-year-olds) and Google's target audience 13 and over; the 18th-birthday gap documented now,
  **"agree ahead"** planned after S1's audits once legal confirms a 17-year-old may agree ahead;
  the guardian wording's "until they turn 18" to the legal review (consent v4, with the studios);
  **the web privacy page as its own item** after S1's audits
- **Changed:** docs/store/privacy-and-data-safety.md (users from about 15, Grade 9 about 14; the
  consent lasts up to ~3 years; at 18 nothing is processed and **no reminder goes, exam reminders
  included**, until they agree: many now turn 18 in matric), docs/store/release-checklist.md (aim
  for 13+), planning.md §8.1. No code: consent is by age. **Legal review owed (A11-10)**
- **Found:** there is **no privacy page in `apps/web`**, which the launch standard requires (the
  store document already said so)
- **Research commissioned (2026-10-22):** two briefs, one on South African law and regulation, one
  on security obligations and current practice, each against what is built and planned

### 2026-10-22 — S1: the words and the agent from Grade 10 (G10-5, on `phase-5/grade-10`)

- **The owner's choices** (each the recommendation): the wordmark "Grade 10" over "to
  university"; the sidebar group "School" (web and app); every "add/upload your Grade 11 report"
  becomes "your latest school report" (it was wrong in matric too); the agent learns the grade;
  no subjects tool for the agent yet; A10 runs with S1's audit round
- **Words:** the front door's title, headline "From Grade 10 to graduation", "from Grade 10 on",
  the wordmark, `en.app.tagline`, `nav.groups.before`, the chat welcome, the agent's fallback, the
  home card and My results buttons; the store description draft (Grade 10 to 12). Strings that
  speak of Grade 11 because it is true there (application documents, `results.lead`, What I need)
  are unchanged, as is every string on the owner's review list. A content test holds both rules
- **The agent:** the system prompt is "from Grade 10 to graduation"; any school marks before the
  final matric results are provisional; never say from memory which courses a subject opens or
  closes (point to My subjects and the school). The per-request context says "The learner is in
  Grade N." (the current grade) and, in Grade 10 or 9, that applications are about two years
  away. The no-marks tool message asks for the latest school report. **Red team 100%.** **A10
  owed** (with A1, A3, A11 in S1's audit round)
- **The Grade 10 home's headline card** says "Courses you're on track for" before any report too
- **Checked by hand:** the front door and sign-in still fit one screen at 1280x720 to 1920x1080
  and don't scroll sideways at 360px with the wider "Grade 10" wordmark
- **For the owner, wording:** `en.home.title/headline/numbers[2]/wordmark`, `en.app.tagline`,
  `en.nav.groups.before` ("School"), the five "latest school report" strings, the store
  description line, and the agent prompt's two new rules

### 2026-10-22 — S1: Stage 0 on the home (G10-4, on `phase-5/grade-10`)

- **The owner's choices** (asked before building; each the recommendation): the subjects check
  reads the subjects on the latest **confirmed** report (hard rule 6), none before one; Subjects is
  "done" once a report is confirmed (no migration); a My subjects page and a home card; Study goes
  to My goal's practice (`/goals#practice`) until the studios (S2); the next step is report, goal,
  study; the Grade 10 home has no applications card
- **`learnerStage`** (packages/ui) gains `grade-10` for a current grade of 10 or 9; the journey is
  Report · Subjects · Goal · Study (four columns on the web); `nextAction` add-report → goal →
  study; Study, like Funding, is never "done"
- **`subjectDoors`** (packages/admissions): a course is closed when a requirement names only
  subjects the learner doesn't take, whatever the marks; groups by the subject that would open
  them; open courses with a higher bar (an option above the lowest, or TUT's higher score with
  Mathematical Literacy) listed apart; **no course the learner may see → `unknown`, never "all
  open"** (production today, before verification)
- **My subjects:** `/subjects` (server component, `details` lists, in the sidebar after My
  results), `GET /api/me/subjects`, the app's Subjects screen (behind the signed-in guard); the
  shape (`SubjectsResponse`) is in packages/ui. The home's "Your subjects" card replaces the
  applications card in Grade 10. The app's `nativeRoute` drops a `#section`
- **Checked by hand:** axe on the Grade 10 home and My subjects; the sidebar still fits at
  1280x616, 720 and 920 with the extra link; no sideways scroll at 360px
- **For the owner, wording:** `en.subjects.*`, `en.dashboard.subtitle['grade-10']`,
  `en.dashboard.stage['grade-10']`, `journey.steps.subjects/study`, `next.study`, `en.nav.subjects`

### 2026-10-21 and 22 — S1 begins: a Grade 10 report, and a grade that keeps up (on `phase-5/grade-10`)

- **G10-2, G10-3 (27a0d83, migration 0024):** one list of report kinds, `REPORT_KINDS` in
  packages/catalogue (`/client` too), with `grade-10-final` first; the database CHECK, the API,
  both pickers, content and the chart follow it. packages/admissions takes the confirmed report
  (kind and marks), not bare marks: on Grade 10 marks "qualifies" is `on-track`, Qualify now and
  Plan B are empty, everything met is under On track (`marksBasis`, `ResultVerdict`). Results
  always use a Grade 11/12 report over a Grade 10 one (`recentReports` orders Grade 10 last). The
  agent's my_results tells the model to say "on track". Web and app: On track group, Grade 10
  lead, "Courses you're on track for" on the home. 8 tests failed first
- **G10-1 (a4c6bf6, migration 0025):** `profiles.grade_given_on`; `currentGrade` and
  `gradeCheckDue` (catalogue): +1 each school year from 1 January SAST, to 12; existing grades
  dated by the profile's last change. `profile()` returns the current grade; the exam-silence job
  reads it too. `nscExamYear`/`targetIntakeFor` fixed for Grade 9. "Are you in Grade N now?" on
  both homes each January; About me (web) edits the grade; the app asks the grade after consent;
  the report picker starts on the learner's grade (`defaultReportKind`). 4 tests failed first
- **Machine note:** a full run failed twice from memory (a worker that never started, one sharp
  test); each passed alone (gotchas 33, 45). ~7 of 31 GB free at the time
- **For the owner, wording:** `en.results.leadGrade10`, `en.results.groups.onTrack/onTrackLead`,
  `en.dashboard.qualify.titleGrade10`, the `on-track` verdicts and statuses,
  `en.reportKinds['grade-10-final']`, `en.dashboard.gradeCheck.*`, `en.onboarding.gradeLead`

### 2026-10-21 — The whole gate, and the app's one rhythm

- **Gate (f65fb36), uncached, in a fresh detached worktree:** install, lint, guards, check:test,
  typecheck, 13/13 packages one at a time with 0 cached (web 600 · catalogue 329 · db 311 (+32
  real-Postgres skipped) · messaging 311 · native 303 · agent 244 · admissions 190 · documents
  169 (+10 S3 skipped) · tokens 135 · content 68 · jobs 41 · ui 34 · evals 15, red team 100%),
  coverage (catalogue 100% · admissions 99.6% · messaging 98.8%), all builds, root and client
  chunks, native bundles, **E2E 10/10**. The first attempt never started: the folder of the
  worktree removed on 2026-10-20 was still on disk (gotcha 30)
- **App, one rhythm (67782a8):** `PageHeader` (title, lead muted 8px under it) on My results,
  What I need, My offers, My modules, My goal, My campus, First week and the three confirm
  forms; `EmptyState` (the home's empty card) for My results and What I need (→ Upload my
  report), My offers, My modules and an empty results group; My goal's "no goal yet" muted.
  Native 303 → 310 (`screen-rhythm.test.tsx`: 7); bundles iOS +3.0%, Android +2.8%
- **Preview** moved to f65fb36 and started on :3005 at the owner's request (free pass kept, local)
- **Owner's decisions (2026-10-21, "go with your recommendation"):** Outfit in the app waits for
  the first device test (a new build then anyway); the app's outline buttons match the web now
  (d76b78c: ink text in a `lineStrong` outline, mauve while pressed)
- **Upload, Notifications and About me** show their title on the screen with a muted lead, like
  every other screen; the rhythm test now requires a `PageHeader` on every screen (proven: it
  named those three before the change). Native 312
- **Owner's review, dropdowns and filters (phase-5/dropdowns, merged c321538):** My campus and
  First week choose a university from one dropdown and a Look around button (a GET form, no
  JavaScript needed); every course list (My goal, My offers twice, My modules, "What would you
  like to study?") has University and Faculty filters and a search box above it (short names,
  faculty names, accents ignored; the current choice never drops out). No campus filter: the
  catalogue doesn't record a course's campus (research owed). Web 615
- **Audits of the design refresh (A2, A3, A4), no Critical or High:** 17 findings filed; the 4
  Medium fixed the same day (c84f76c), each with a test that failed first: the split stage grows
  instead of clipping (A3-23), the chat isn't pinned on short screens (A3-24), focus stays in
  the chat (A3-25), the haze on its own fixed layer (A4-14). Lighthouse desktop 100, mobile
  94–99. Web 621, E2E 13/13 (e2e/layout.spec.ts is new)
- **Plan v0.9 proposed (planning.md §18, §19), not built:** Grade 10 entry (keeping D1), the
  three subject studios inside UniversityFlow, the school record from the learner's own marks
  (official final NSC results later, from the DBE/IEB, read-only), a sample results generator
  (preview shown: synthetic, marked SAMPLE, no insignia) and a demo learner; the North Star, one
  verified hub opened gate by gate (H0–H4); and **verified colleges** (§19.1: DHET-registered
  only, public TVET first, an "Is this college registered?" check). The owner shared two
  personal documents (an NSC certificate, a UJ transcript) for their structure only; nothing
  from them is stored or committed
- **Plan v0.9 approved** by the owner the same day, part by part, every recommended answer
  (planning.md §18.8, §19.2; the decisions log). Actions still unchecked: no run since
  2026-10-19, and the owner will say when minutes are back
- **For the owner:** review the new wording (`en.common.course*`, `en.campus.universityLabel`, `lookAround`,
  `en.chat.startersLabel`)

### 2026-10-20 — One rhythm: the gap under every title, and one empty state (docs/design "One rhythm")

- **Measured first** (a throwaway Playwright spec against the production build, deleted before
  committing): the gap under the title was 24px (Home, My campus, First week), 48px (most
  pages), 72px (My goal, My offers, My modules: an empty status line took a gap of its own), 40
  (What I need) and 44 (the marks form). Empty pages said so four ways
- **`Page`** owns every titled page (header, then parts 24px apart, as on the home); `PageHeader`
  lost its margin. **`StatusLine`** takes no space while silent (`empty:sr-only`), still announced.
  **`EmptyState`**: the home's empty card (one muted sentence, at most one outline button):
  My results and What I need → Add my Grade 11 report (My results now shows its lead too);
  Applications → Browse my results; Documents, My offers, My modules (next step already on the
  page), Funding's missing record and an empty results group: the sentence alone. In-card
  "nothing yet" lines (My goal, What the companion remembers) are muted, as on the home
- **After:** 24px under every title on 14 pages at 1530, 1280, 1024 and 390px, the marks form too
- **Tests:** `test/page-rhythm.test.tsx` (9): no `PageHeader` outside `Page`, no standing status
  line on a titled page, "nothing yet" copy only in an empty state or a muted line, each proven on
  a broken example; the three primitives rendered. Web 591 → 600; E2E 10/10; budgets green
- **For the owner:** look at the empty pages (My results, Applications, Documents, My offers,
  My modules); "Browse my results" on Applications reuses the home's wording
- Housekeeping: the leftover `UniversityFlow-gate` worktree removed

### 2026-10-19 (late night) — The mobile app's home and chat (docs/design §4)

- **Owner's review, one width (5fc65f4):** eight signed-in pages sat in a `max-w-prose` strip on
  the left; every signed-in page now fills the column (`test/page-width.test.ts` holds it). Two
  stretched buttons keep their own width
- **Owner's review, course dropdowns:** "What would you like to study?" (onboarding, About me) is
  a dropdown of courses grouped by the university's full name, plus "I don't know yet"; every
  course dropdown now groups by full name (`goalOptions`). Saved as the profile's text, so no
  migration; an earlier typed answer stays selectable. **Owner:** in production the list is
  empty until courses are verified (hard rule 3): only "I don't know yet" shows then
- **Pre-push hook:** db and web suites at `--maxWorkers=2` (owner's choice, gotcha 45): web 591
  passed that way on a loaded machine where the default run timed out

- **Owner's review, the journey strip (9e968c0):** "no consistency": every step is now the same
  box (equal columns from a tablet's width, one row each on a phone; the mauve edge only on the
  current one) and every name the same kind (Report, Shortlist, Goal, Applications, Funding;
  Offer, First week, Modules), whatever its state. This replaces the "Confirm a report" /
  "Report confirmed" names from earlier tonight. Checked in screenshots at 1530, 1280, 1024 and
  390px; web, app and E2E green

- **Shared:** `apps/web/lib/home.ts` → `packages/ui/src/home.ts` with its tests, plus `HomeData`,
  `homeJourney` and `journeyStepName`; the web imports them, so the two homes can't drift
- **`GET /api/home`:** the same `homeData` for the app, `requireReady` (hard rule 5); 3 tests
- **App home:** the dashboard in one column (welcome with the name in the accent, stage, ask bar,
  next step, journey, headline number, promo, shortlist or offers, applications or Getting ready,
  marks over time as a list, every screen grouped by stage, Sign out); reloads on return.
  `nativeRoute` maps web paths to the app's screens; applications and funding say "on the web"
- **App chat:** hero with the name, starter cards with notes, plain companion text beside a mark,
  learner bubble on `glass.pill`, crisis reply still a bordered card, send inside the field, the
  preview line under it
- **Flaky test fixed:** api-registration's "no fee" check matched a UUID (`dfeeec8b…`): IDs are
  blanked first (`withoutIds`)
- **Numbers:** ui 11 → 34, web 604 → 584 (23 moved to ui, 3 added), native 286 → 303; E2E 10/10;
  native bundles iOS +3.0%, Android +2.8% over the baseline (budget 5%: headroom is shrinking)
- **For the owner:** try the app's home and chat on a phone (Expo Go); Outfit in the app needs
  `expo-font` (a native module, so a new build): say if you want it now; the other app screens
  keep the shared cards; one web test run died to V8 "out of memory: Zone" in three workers and
  passed on the re-run (machine load, watch for it)

### 2026-10-19 (night) — The owner's review items, and the design branch's first full gate

- **Gate:** the whole local gate, uncached, at 5d63711 in its own worktree: lint, guards,
  check:test 74, typecheck, 2,708 tests one package at a time, coverage, all builds, root and
  client chunks, native bundles (+2.0%), E2E 10/10 with axe. Green
- **Phone menu** (owner's choice): the nav's sideways row and its edge fades become a Menu button
  that opens the same grouped list (group names, Sign out at the foot); closes on a tap, Escape
  (focus back) or a page change. The sidebar is unchanged
- **Chat on phones:** the preview notice is hidden on the chat; in a preview the composer's line
  says "Preview: no AI is connected, so replies come from a simple script." instead of the
  disclaimer. With the menu, the chat starts one header row from the top
- **Journey strip:** "Confirm a report", "Accept an offer", "Confirm my modules" until done, then
  "Report confirmed", "Offer accepted", "Modules confirmed"
- **/help:** the crisis card and its links moved out of the chat's client files: first load
  171.5 → 134.9 KB gzipped (/chat 176.0 → 175.5)
- **Tests:** nav (menu open/close, Escape, page change, Sign out), chat (the preview line),
  dashboard (step names); E2E's `goTo` opens the menu before a nav link (19 taps). Web 604
- **For the owner:** review `en.nav.menu`, `en.chat.sampleLine` and the step names; the
  campus-tour step and Funding "done" (records, a migration); confirm the axe helper's wait

### 2026-10-19 (evening) — The design refresh, web (on `phase-5/design-refresh`)

- **Owner's direction:** refine, then the references' own theme: a charcoal split-screen poster for
  the front door and sign-in, a near-black dashboard with dusty mauve for everything signed in;
  web first, the app next; the owner directs screen by screen
- **Tokens:** one dark theme (canvas #0E0D10, surface #17161A, ink #F4F2F5, brand mauve #C99BB8,
  accent pink #E9B8D4, statuses re-tuned for dark), glass and display sizes, pointer and dense
  targets; every pair AA, glass tested over each backdrop (tokens 135 tests); **Outfit** (OFL,
  self-hosted, 31.5 KB woff2)
- **Front door and sign-in:** a split stage (sharp | frosted), "FROM GRADE 11 TO GRADUATION", true
  product numbers only, the GRADE 11 wordmark crossing the split (light | pink), a frosted bar; one
  screen at 1280×720 to 1920×1080
- **`/home`, the dashboard:** sign-in lands here; the stage (Grade 11 / Matric / University) from
  code; a journey strip, Next step, courses you qualify for (dark glow card), What do I need,
  shortlist, applications, a marks-over-time area chart with a table alternative; every number
  from existing server code, nothing faked, an action on every empty card
- **Sidebar (A2-12):** grouped by stage, labels that read as labels, icons, fits without scrolling
  down to 1280×616; **Get help** (`/help`, public, verified helplines only); the preview notice
  as one line with More
- **Chat:** an assistant layout: a welcome hero with four suggestion cards, plain companion
  messages and mauve learner bubbles, a docked composer with send inside; crisis flow, live
  region, focus and keys unchanged
- **Tests:** E2E draft-label checks now look inside their own card (each proven by removing the
  badge); the modules focus tests wait for focus (gotcha 43); the E2E axe helper waits for
  animations to finish (owner to confirm); web 598, E2E 10/10, budgets green (/home 140.7 KB,
  /chat 176.0 KB)
- **For the owner:** all new wording; the journey's first step label ("Report confirmed" while it
  is Now); no campus-tour step and Funding never "done"; chat space on phones (~420 px); /help is
  171 KB (split the crisis card out); the native app follows

### 2026-10-19 — Phase 5e built: finding the way, safety notes, UJ (on `phase-5/stack`)

- **Plan (planning.md §11 v0.7, approved):** four research passes (hand-off links and maps, campus
  safety, accessibility and voice, UJ's own pages through a real browser); ElevenLabs not
  recommended (written approval needed for under-18s, no SA languages beyond Afrikaans, no African
  data region)
- **5e-1 and 5e-4 (`phase-5/wayfinding-links`):** `walkingLink`, `appleWalkingLink`, `streetViewLink`
  (destination only, never an origin; property-tested over 400 locations); places may carry an
  `accessibleEntrance` and an `arrivalNote` with its own source; Walk there, See it, Step-free route
  and Read aloud on every campus place card and the crisis card's campus lines (Apple and Google on
  iOS); a `Speech` interface (screen reader → `announceForAccessibility`, otherwise `expo-speech`
  ~57.0.3, web `speechSynthesis`, a fake); "Getting around with a disability" with the cane and
  guide-dog statement. **Read aloud replaced 2026-10-22 (`phase-5/elevenlabs-voice`, owner's
  choice):** the ElevenLabs voice only, on the web and in the app (expo-audio ~57.0.5, expo-speech
  removed, needs a new app build); the screen reader kept in the app; no button without
  `ELEVENLABS_API_KEY`; public catalogue text only, built on the server from a place id
  (`/api/speech/<place id>`), cached, 120 requests an hour per learner. Owed: the owner and legal
  on ElevenLabs' under-18 terms and on naming it as an operator (privacy-and-data-safety.md)
- **5e-2 (`phase-5/uj-campus`):** UJ's 4 campuses and 36 places as drafts from uj.ac.za (Protection
  Services with UJ's own coordinates, clinics, PsyCaD and its crisis line, the Disability Unit,
  libraries, student finance, residence offices, card collection, bus stops); 8 values UJ's pages
  disagree on left out with both versions in the note. **A calendar may now publish no change
  deadline** (gotcha 40), so UJ's 2027 calendar (registration 11 January to 5 February) is in and a
  UJ offer gets its registration-day reminder
- **5e-3 (`phase-5/safety-notes`):** a `safetyAdvice` record (quote required, no severity field,
  expiry required, at most 90 days); shown only when verified and current, with what to do, campus
  security, 10111 and 112, and "No warning here doesn't mean it's safe."; UJ's 9 Protection Services
  tips as drafts, word for word; the AI only relays them (charter line, `campus_tour` rules, 8
  red-team safety cases; red team 100%)
- **Owed:** an E2E journey for 5e (a UJ place with Walk there and See it, a safety note with its
  call lines) needs verified fixtures; a screen-reader test on a real iPhone and Android phone
  (the definition of done); A3, A7, A10, A11, A13 for 5e

### 2026-10-17 (night) — Speed, the app's bundle, the hook and UKZN's clinics, on `phase-5/stack`

- **A4-10 (`phase-5/content-split`):** `en` is composed from 35 per-section modules, exported by
  name; web client code imports only the sections it shows. The all-copy chunk (20.7 KB gz on 16 of
  17 routes) is gone: /sign-in 156.3 → 139.0 KB gz first load, every signed-in page ~14–16 KB less.
  Not one string changed (956 leaves compared). `client-chunks.mjs` now fails when /sign-in or the
  guardian's consent page downloads another page's copy (failed on the old build)
- **A4-13 (`phase-5/native-budget`):** a guard keeps `apps/native` on `@universityflow/catalogue/client`
  (a barrel import was proven to add ~908 KB per platform); `native-bundle-budget.mjs` with a
  committed baseline (iOS 2.78 MB, Android 3.01 MB), 5% tolerance, catalogue and zod markers in
  UTF-8 and UTF-16; a CI step after the native build
- **Pre-push hook (gotcha 39):** every package still runs, with db and web one at a time; 208 s
  uncached here, so `--no-verify` is no longer needed
- **A13-11 (`phase-5/ukzn-clinics`), owner's decision:** a place's `where` and `location` are
  optional (no maps link without a location, "not published" in the checklist) and a phone may
  carry its own `phoneSourceUrl`; Westville and Medical School clinics added and Howard, PMB and
  Edgewood given phones, each the clinic administrator's line from UKZN's Campus Health Services
  staff table, all drafts. The researcher first stopped rather than guess a building (gotcha 40)

### 2026-10-17 (evening) — Phase 5's last build items, on `phase-5/stack`

- **Preview:** the owner's preview moved to the stack (free pass re-applied by stash, never committed)
- **A1-33, the letter (`phase-5/native-letter`):** the app adds an offer from its letter by camera,
  gallery or PDF through the same API as the web, then a check form for every field (course picked
  by the learner, never preselected; kind; reply-by; conditions kept in order, editable) before
  anything is saved; one request at a time; consent refusals explained. Conditions read as quoted
  on both platforms (A2-16 1) and the app's offer card gains the final-results and reminders links
  (A2-16 5). Native 225 → 241 at the time, 15 tests failing first
- **A1-33, the reminder (`phase-5/registration-reminder`, migration 0023):** accepting an offer
  schedules one reminder at 18:00 SAST three days before first-year registration opens (or closes,
  when only the close is published), only from a calendar a learner may see for the offer's year;
  dropped on decline, delete, a switch, withdrawal or deletion, with the decline race proven on real
  Postgres 17 (32/32). The channel follows reply-by, the owner's choice (decision 4 widened)
- **App campus (`phase-5/native-campus`):** My campus works offline from the last good copy, with
  "Last updated" and the draft badges, cleared on sign-out, deletion and a 401 (A7-17;
  `expo-file-system`, no new native module); "Open in maps" opens Apple Maps on an iPhone (A7-18;
  `appleMapsLink` in the catalogue, `appleMapsUrl` on the artifact); heading levels (A2-20);
  `CallButton` (A2-18); the chat's offer, campus and first-week cards open their screens (A2-16 4)
- **Design parity (`phase-5/design-parity`):** `ButtonLink`, `FileButton` and `Checkbox` replace
  six hand-made copies on the web, held by a test (A2-18); module differences at `border.rule` and
  a passed deadline as a badge in the app (A2-16 2, 3); one card-title size (A2-20)
- **Two flaky web tests fixed** (gotcha 43): a random UUID passed for a phone number in five log
  checks, and three letter-form tests raced a deferred focus move
- Four agents in parallel worktrees; every branch merged into the stack without a conflict

### 2026-10-16 and 17 — Phase 5 planned and built (#67–#78)

- **Plan (#67):** planning.md §11 v0.6, approved by the owner with the recommended choices (a
  text-and-link-out campus tour, maps by link, all 86 first-year curricula as drafts, safety
  guidance by push and in-app only)
- **Catalogue core (#68):** campus, place, faculty office, registration calendar and curriculum
  records; clinic, counselling and security places reach the view only once verified, even in
  preview; `compareRegistration` in `admissions`, property-tested over 400 generated curricula;
  verification checklists gain campus and curriculum sections
- **Research (#69, #71, #72, #74; #73 waiting):** six agents drafted from each university's own
  site only, never invented. UJ: nothing (Cloudflare blocks it). UP: places and calendar, no
  curricula (yearbooks blocked). TUT: 15 curricula. UKZN: 12. UCT: 7. Wits: 12 (#73). Two schema
  changes came from review, both against guessing: a registration window may give only its close
  (#69), a module may have no printed term (#71), and a module may have alternative codes for
  UCT's "F/S" (#74). 85 TUT and 4 Wits modules lost a guessed year-long term
- **5a offers (#70, migration 0018):** acceptance letters read and confirmed, or "I got in";
  provisional never called final; reply-by reminders; the January final-results check, with Plan B
- **5d care and red team (#75):** five arrival hard moments get care (an offer that fell away,
  money stress, homesickness, culture shock, arrival anxiety); **red team 165 → 214 at 100%**, 31
  cases failing first; ordinary arrival talk ("this queue is murder") stays clear of helplines.
  #76 gave the red-team run its own timeout
- **5b campus and first week (#77, migration 0019)** and **5c registration check (#78, migration
  0020):** built, each green alone; merged together on `phase-5/integration-trial` with every test,
  both builds and E2E 10/10. Not merged: Actions billing (Next build session)
- **Phase 5's eight audits (A1–A4, A7, A10, A11, A13), report-only**, by independent reviewers on
  the stack: **4 Critical (A10-17 to A10-20), 2 High (A1-25, A11-13)**, 19 Medium. Fixed test-first
  on five branches merged into the stack: crisis detection by mechanism, not phrase (red team 220 →
  323); consent v3 / adult-v2 refused in the database for letters and proofs (0021); focus, field
  errors, the app's auth gate and permission wording; curricula and calendars only for the
  learner's year, open electives and "one set or the other" groups, A13's data corrections; the
  Lows (foreign-key indexes, 0022). A 5b test bug (SMS template checks sent the push-only safety
  tips by SMS) was hidden by cached green runs (gotcha 42)

### 2026-10-16 — The Low sweep (#58, #62–#65)

- **Five PRs from five parallel agents**, each in its own worktree, every fix with a test that
  failed first; merged one at a time, each re-tested on the new `main` before its push
- **Repo (#58):** two new guards: `env-documented` (every variable the code reads is in
  `.env.example`; A1-17) and `actions-pinned` (A8-03: every action and the audit suite pinned by
  SHA); only lefthook may run install scripts (A8-04); review notes use "Type my marks in instead"
  (A7-11). A8-05 was already fixed by #56
- **Web (#62):** WhatsApp's own "not available yet" hint (A1-16); hints tied to their checkboxes
  and an always-present status region (A3-04); no card in a card (A2-10); `useId` for artifact
  headings (A3-05); a surface badge on sunk panels (A2-07); `/goals` reads each record once
  (A4-07); a favicon (A4-09)
- **Agent (#63):** the crisis reply promises day-and-night help only when every shown line says
  24 hours, and points to a trusted adult when no line is verified (A10-11); learner-written name
  and goal go in a marked data block (A10-12, half); every catalogue tool flags preview data
  (A10-13); the lock-screen test derives its forbidden words from the catalogue (A11-09). Red team
  still 100%
- **Messaging (#65):** STOP confirmed on its own channel, outside cadence and quiet hours (A12-12);
  WhatsApp under a spend budget like SMS (A12-15); a live session's push token can't be taken
  (A5-05); export includes a pre-consent STOP (A11-08, the s11(3) exception written up in
  planning.md §8.1); the catalogue view built once a day (A4-06); the job claim uses its index
  (A4-08). A12-11 was already fixed by #50. The STOP E2E now expects the confirmation SMS
- **Native (#64):** border-width tokens and a guard on raw sizes in native styles (A2-05); brand on
  sunk is a tested pair (A2-06/A3-08); official-source links (A2-09); in-app upload from What I
  need (A2-08); course names in button labels (A3-06); deletion announced and confirmed (A3-09,
  A7-09); Try again on notifications (A7-10); transitions unless Reduce Motion (A7-12); the 944 KB
  Material Symbols font out of the Android export, held by a check (A4-05)
- No migrations were needed (0018 is still free)

### 2026-10-14 (night) — Speed, message wording, re-checks and accessibility (#53–#56)

- **Faster pages (A4-02, A4-03, A4-04, #56):** no client chunk carries catalogue data or a second
  zod any more (a CI check and a guard hold it); first-load JS on the signed-in pages ~250 →
  ~150 KB gzipped; the results page renders on the server with Plan B collapsed
- **Nothing personal in a message (A11-02, A12-13, A12-09, A12-10, #54):** SMS and WhatsApp carry
  no name, university or subject; every SMS ends "Reply STOP to stop." in one segment; WhatsApp
  gets a Stop button and wording Meta should class as utility; the billed category is recorded
- **Re-checks (A1-12, #53):** one waiting re-check per learner, and confirmations are limited
- **Forms (A3-01 to A3-03, A3-07, A2-03, A2-04, #55):** focus survives a save; the app announces
  errors and outcomes; every mark field names its subject; deletion is red; radios and
  checkboxes are shared and contrast at 3.8:1

### 2026-10-14 (evening) — Consent, sessions, live adapters and the app (#48–#51)

- **One consent rule (A1-13/A5-07, A11-05, #49):** the database now holds the app's rule, so a
  learner who turns 18 under a guardian's consent is not messaged or read by any job until they
  agree themselves; withdrawal turns every channel off and drops scheduled reminders
- **Sessions and push (A11-03, A5-04, A11-07, A11-11, #51):** expired sessions and their push
  tokens are swept daily; one token per session and five per learner; Expo sends batched; every
  phone's receipt checked
- **Live adapters (A5-02, A5-03/A11-06, A5-06, #50):** a live SMS or WhatsApp provider can't be
  switched on without an inbound half that hears STOP (an inbound contract, proven on a fake live
  provider); Expo push needs its access token; webhook signatures name the channel and a replay is
  refused
- **The app (A8-02, A7-05 to A7-08, #48):** a crafted link can't freeze it; a bad API URL fails
  the build instead of saying "offline"; the keyboard never hides a field; no cleartext on iOS
  release builds; no unused Face ID prompt
- Migrations 0014 and 0015 were assigned before the work began (gotcha 36), so nothing collided

### 2026-10-14 (later) — The messaging Mediums that cost money or broke a promise (#43–#46)

- **Crisis replies by SMS (A10-15, #43):** help is never refused, but after three full replies an
  hour a sender gets a one-segment reply with the most relevant number; red team still 100%
- **SMS cost (A1-14/A12-07, A5-01/A12-08, #44):** every SMS and webhook reply goes out GSM-7
  (curly quotes made each 2–3 segments, the crisis reply 4–7); segments counted by encoding and
  charged per segment; sign-in and guardian links on their own budget, so reminders can't lock
  learners out; an over-budget reminder waits for the window
- **Never twice (A12-06, A12-14, A1-15, #46):** a send the provider may have taken is
  `unconfirmed` and never retried; a runner that dies mid-send is swept to `unknown-outcome`; a
  failure before sending gives the claim back
- **STOP everywhere (A12-04, A12-05, #45):** a STOP from any number is honoured (kept only as an
  HMAC), guardian texts never go at night, and "remove me" or "please stop" work. A message that is
  both STOP and a crisis gets help as its reply, and the STOP still holds
- Four agents worked in parallel; three migrations all chose 0011 and were renumbered 0011–0013
  at merge

### 2026-10-14 — Phase 4's audits, and the fixes for their Critical and High findings (#35–#40)

- **Ten audits, report-only**, each by an independent reviewer agent: A10, A11, A12, A1, A2, A3,
  A4, A5, A7, A8 (A5, A7 and A12 for the first time). Results in docs/audits/results/PHASE-4-*.md.
  **4 Critical, 10 High, 35 Medium, 50 Low** (A10-15 found while fixing)
- **The crisis protocol (A10, #35, #36):** the red team passed 100%, yet 38 of 44 new phrasings
  were missed. Each became a red-team case that failed first; **118 → 165 cases at 100%**, no
  pattern removed. Replies by WhatsApp or SMS are now crisis-checked too, and a crisis split
  across two messages is caught. Family-pressure guidance no longer assumes good intent
- **Never during a paper (A12, #38):** only verified papers silenced messages, and none are
  verified, so production would have messaged learners mid-exam. Every sourced paper now
  silences (drafts included; learners still see only verified ones), across the grade's year and
  the next, and every NSC session for a learner with no subjects
- **Consent v2 (A11-01, A7-04, #39):** the guardian wording names reminders and every processor
  (an SMS company, Meta, Expo, Apple, Google); a messaging opt-in under v1 is refused in the data
  layer; adults agree to the same wording before chat or uploads (migration 0009). Legal review
  owed
- **The app (A7-02, A7-03, #37):** push re-registers after every sign-in and follows token
  rotation; sign-out and deletion on every onboarding step. Merged with #39's adult agreement:
  the step shows the full disclosure, then "I don't agree", Delete and Sign out
- **Speed (A4-01, #40):** every page's first JavaScript 216 → 128 KB gzipped; CI now fails on
  zod locales in the root chunks or above 150 KB
- **The store reviewer's sign-in (A7-01, #42):** option A, chosen by the owner. One synthetic
  adult account flagged `review`, a fixed PIN stored as a hash, on only while three variables are
  set and only until `UF_REVIEW_UNTIL` (at most 31 days); no SMS for that number; no guardian
  request, SMS or WhatsApp for that account, enforced in the database (migration 0010); every
  sign-in audited and alerted. Each guard proven by removing it. Its own A1 review (A1-18 to
  A1-24) found sessions outliving the window, online guessing across PIN requests, a typo'd number
  silencing a learner's SMS, and a seed that migrated production: all fixed, tests first

### 2026-10-13 (end of day) — Phase 4d and 4e (#32, #33): Phase 4's code complete

- **4e (#32):** 18 Siyavula practice links as sourced drafts (siyavula.com only; free textbooks,
  free learner practice with an account; no endorsement claim shown) and the `practice_for` tool
  (the goal's subjects that must rise, else the weakest confirmed marks). Care guidance for a bad
  result, giving up, family pressure, comparison and exam stress. Crisis protocol: patterns
  added, none removed. **Red team 64 → 118 cases at 100%**, now also failing over-triggering
- **4d (#33):** an Expo push adapter (contract-tested, DeviceNotRegistered removes the token,
  receipts checked by a job); push tokens (migration 0008); every push body free of personal data
  for the lock screen; notification permission only on opt-in; camera/gallery/PDF upload with
  confirm-before-use; in-app account deletion; app.config, eas.json, placeholder icons and
  docs/store/. The reviewer sign-in is documented, not built (a production bypass needs the
  owner's choice and an A1 review). Never run on a phone yet
- Merged together: 1,347 tests, E2E 8/8, red team 100%

### 2026-10-13 (late) — Phase 4b and 4c (#29, #30)

- **4c (#29):** "what I need per subject" in `admissions` (pure; marks only rise, capped at 100;
  subject minimums, then the DBE pass, then each university's method; unreachable targets said
  plainly), proven on every method and swept across all 86 programmes; agent tool, web page, app
  screen. Re-checks after confirmed Grade 12 June and September reports (migration 0007) with a
  `recheck.changed` message through the 4a pipeline
- **4b (#30):** the Oct/Nov 2026 NSC timetable as 45 sourced draft papers (the 2027 one isn't
  published; nothing invented); goals (migration 0006); the learner's papers from confirmed
  subjects feed the cadence, so nothing is sent during their paper; goal card and exam countdown
  on web, app and chat. Merged with 4c (eight conflicts, each resolved by rule): 1,189 tests,
  E2E 7/7. The whole-catalogue sweep test got its own timeout after one slow CI runner
- Dependabot #27 (claude-code-action 1.0.237, pinned) and #28 (setup-node v6)

### 2026-10-13 (late) — Phase 4a: the messaging foundation (#25)

- Per-channel opt-in (SMS, WhatsApp, push) with time stamps and STOP, behind RLS and the consent
  gate (migration 0005); a minor gets nothing without guardian consent; STOP is always honoured
- `MessageChannel` with SMS (over the budgeted sender), WhatsApp (24-hour window) and push
  stand-ins, an 8-test contract on each, and a last-moment recipient gate
- Message templates in `packages/content` (no admission facts; university names only from
  verified records); pure cadence rules with property tests over a simulated year
- The reminder pipeline on the job scheduler (payload: `reminderId` only), re-checking consent,
  opt-in, cadence and quiet hours at send time; racing runners can't exceed the cap
- Signed inbound webhooks (HMAC over timestamp + body, constant-time, 5-minute window); account
  deletion purges reminders and their jobs; About me gains a messages card
- 988 tests (from 801), E2E 5/5 with a messaging journey, db 147/147 on real Postgres 17.
  Owed before Phase 4 closes: A11 and A12

### 2026-10-13 (late) — Phase 0's code gaps closed; Phase 4 planned

- **#20 job scheduler (A1-08):** `packages/jobs`: `JobScheduler` (schedule, cancel, get) with
  IDs-only payloads enforced by type, at runtime and by a database constraint (hard rule 4);
  memory and Postgres stand-ins (migration 0004: skip-locked claim, lease, attempt fencing,
  backoff); an 18-test contract on memory, PGlite and real Postgres 17. Live mode refuses
  without a jobs adapter. Spike 5's stand-in verdict updated
- **#21 AI adapters (A1-07, A1-09):** 36 tests drive both Claude adapters through the real SDK
  with a fake API. They found and fixed reader failures escaping as the wrong error (an upload
  answered 500 and the document was never marked failed; refusals went unrecognised) and the
  mid-answer refusal fallback replaying the declined model's tool calls. Report photos resized
  (2576 px / 3.75 MP for Opus 5), EXIF stripped, re-encoded with sharp 0.35.5
- **#22 (A1-10, A1-11):** every signed-in page redirects before consent using the database's own
  `mayProcess()` (all seven threw before); E2E now fails on any unhandled server error. A failed
  SMS withdraws the PIN and refunds the number (never the IP; at most 5 refunds an hour)
- **Dependabot:** #16 cooldown and ignores; #18, #19 merged (checkout v7, upload-artifact v6);
  #23 `pnpm/action-setup` v6.1.0 pinned by SHA (replacing #17). Every third-party action is now
  pinned by commit
- **Phase 4 planned** in planning.md §11 (v0.5)

### 2026-10-13 (night) — Merged to main; the mobile app; Phase 0 spikes written up

- **PRs #3–#8 merged** in order (squash), each green on every check; the next branch took the
  new `main` by a merge, after confirming `main`'s tree equalled its base, so nothing was dropped
  and nothing force-pushed
- **#9** `docs/research/`: the five spikes, each with a stand-in verdict, a real-service plan and
  pass criteria (thresholds are proposals for the owner). **Fix:** functions pinned to `cpt1`
  (`apps/web/vercel.json`), and production refuses any other `VERCEL_REGION`: nothing pinned them
  before, so the first deploy would have processed student data outside South Africa
- **#10 the mobile app:** sign-in (phone → PIN; token in `expo-secure-store` 57.0.4 only),
  onboarding (date of birth; guardian form and waiting screen for minors; adult re-consent),
  results (Qualify now / Close / Plan B, every draft labelled), streaming chat (`expo/fetch` +
  an NDJSON parser; crisis replies with dialable helplines). Server: the app's pre-sign-in POSTs
  pass the same-origin check only with `x-uf-client: native` and **no Origin and no Cookie**;
  the app gets no cookie. Artifact types moved to `packages/ui`. native tests 2 → 63
- `pnpm verify` now runs typecheck and tests, then the builds (gotcha 23)

### 2026-10-13 (evening) — Pipeline, verification kit and Phase 3 hardening

**PRs:** #3 (Phase 1 → main) and #4 (Phases 2–3 → phase-1) opened, both green. #3 first failed
CI: on its own, `apps/native` didn't list `catalogue` (gotcha 14); fixed on phase-1 and merged
forward. The four branches below are stacked on phase-2, local, not yet pushed.

**`phase-0/pipeline`**
- `ci.yml`: + **Crisis red-team** and **Secret scan** (gitleaks 8.30.1, whole history,
  checksum-verified; history scanned clean), least-privilege tokens
- `audits.yml`: **Owed checks** (PR comment from `scripts/ci/obligations.mjs`), the suite's run
  plan, A8, phase gate (proven shut on an open High), A9, prompt audits on demand
- `deploy.yml` (only after CI passes on main), `claude.yml` (read-only @claude), Dependabot
  (pins ignored), CODEOWNERS, a PR template; `audits.config.json`; `docs/audits/` with overlays
  for A1, A3, A5 and the project audits A10–A13
- Guard **native-lists-workspace-deps** (gotcha 14), proven on Phase 1's original manifest
- status.md now in the suite's table shapes; actionlint clean

**`phase-1/verification-kit`** ([docs/verification/](docs/verification/README.md))
- Draft answers with official-source evidence for all 18 open questions; corrections C1–C11
  proposed, none applied; per-university checklists generated from the data
  (`pnpm verification:checklists`, drift-tested); helplines: 4 of 7 confirmed on the
  organisation's own site
- **Fix:** a programme scored by a draft method no longer reaches learners (A13-01)

**`phase-3/csp-nonces`**: per-request nonces through `proxy.ts`, `'strict-dynamic'`, no script
`'unsafe-inline'`; E2E asserts every script carries the nonce and no CSP violation occurs (A1-02)

**`phase-3/live-adapters`**: `S3FileStore` (contract suite also against a real S3-compatible
server); direct-to-S3 uploads with one-time intents, magic-byte checks on arrival and a copy to a
fresh key (A1-03); a global SMS budget in Postgres with 80%/100% alerts that fails closed (A1-01);
`UF_PROVIDERS=live` wired, refusing until an SMS adapter exists (migration 0003)

### 2026-10-13 — Phases 1–3: knowledge layer, chat core, results and applications

**Phase 1 — knowledge layer** (commit `feat(catalogue)`)
- `catalogue`: NSC subjects; sourced record schemas (universities, programmes, application
  windows, NSFAS, helplines); `catalogueView`, the gate that shows students only verified records
- **Data for Wits, UJ, UP, UCT, TUT and UKZN: 86 programmes, 2027 intake**, researched from each
  institution's own site by three research agents on 2026-10-13, all drafts. Every open question
  they raised is in [docs/data-verification.md](docs/data-verification.md)
- `admissions`: NSC pass types (DBE rules); one shared scoring engine; **one method per
  university**, tested against the UJ and UKZN prospectus worked examples; eligibility (Qualify
  now / Close / Plan B) with exactly what to improve, "any N other subjects" rules and the
  higher minimums some universities set for Maths Literacy

**Phase 2 — chat core** (commit `feat(agent)`)
- `db`: schema with **row-level security per student**, a **database-level consent gate** for
  minors (hard rule 5) and an append-only audit log; phone OTP sign-in (hashed PINs, lockout,
  limits per number and IP), sessions, guardian consent links, adult re-consent at 18, export
  and delete
- `documents`: magic-byte upload checks, file storage behind an interface (memory/disk,
  contract-tested), report extraction schema, subject-name normalisation ("Maths", "Eng FAL",
  "Wiskunde") and the **confirm-before-use draft** (hard rule 6); a Claude reader plus a labelled
  sample stand-in
- `agent`: charter-built system prompt with no admission facts, **deterministic crisis protocol
  that answers before any model is reached**, 9 tested tools, a Claude adapter (streaming,
  prompt caching, server-side refusal fallback) and a scripted stand-in
- `evals`: **crisis red-team suite, 64 cases, 100%** (hard rule 7)
- `tokens`: the visual identity, generated to CSS; `content`: every string for Phases 2–3

**Phase 3 — Stages 1–2** (this session's final commit)
- Web app: sign-in, onboarding (date of birth first; guardian consent for minors), the
  guardian's consent page, streaming chat with artifacts, report upload and row-by-row
  confirmation, **My results** (Qualify now / Close / Plan B, filters, shortlist), **Applications**
  (per-university pack: window, fee, how to apply, checklist, NBT, status), **Funding** (NSFAS
  and a document checklist), **About me** (edit, memory, export, delete), dev SMS outbox
- Security: CSRF same-origin check, CSP and headers, per-learner quotas on chat and uploads,
  production refuses every stand-in

**Bugs found by the tests themselves, each now with a regression test**
- A wrong PIN was counted inside a transaction that then rolled back, so the five-attempt
  lockout never triggered
- PGlite creates only the last folder of its path: a fresh checkout failed on first request
- Next bundles routes and pages into separate chunks: module-level singletons opened the
  database twice, and the two copies didn't see each other's writes (now on `globalThis`)
- Unlayered base CSS beat Tailwind v4 utilities: white-on-green buttons rendered dark-on-green
  (axe caught it); text links were told apart by colour alone; the sticky chat box covered the
  last controls (WCAG 2.4.11)
- The red-team suite caught "cutting myself" slipping past the self-harm pattern

### 2026-09-29 — Research review: a second report, compared against the plan

- The owner's report moved to `docs/research/`; planning.md v0.3 adopted what fits (§17)

### 2026-09-28 — Phase 0 sessions 1–2: the monorepo, CI, guards and the mobile app

- Monorepo on tumo-olo's foundations; `apps/web` (Next.js 16) and `apps/native` (Expo SDK 57);
  four guards, each proven on a broken example; CI `Static · Unit · Build`

### 2026-09-28 — Planning sessions 1–2

- planning.md v0.1 → v0.2: the journey, the agent, data tiers, law and safety, phases, stack

---

## Audit ledger

| Phase | Audit | Critical | High | Medium | Low | Status | Date | Scope and notes |
|---|---|---|---|---|---|---|---|---|
| 6 (My CV) | **A5** Security | 0 | 0 | 4 | 6 | No Critical or High; the 4 Medium and 1 Low fixed test-first (#90) | 2026-10-23 | docs/audits/results/CV-A5.md: the Mmereko adapter, webhook, share tokens and page, PDF route. Not run against Mmereko's real sandbox |
| 6 (My CV) | **A10** AI safety | 0 | 3 | 2 | 4 | **All High fixed** test-first (#93), and A10-57 | 2026-10-23 | docs/audits/results/CV-A10.md: the crisis check on every CV word, the tailoring path, learner-chosen only (proven), under-18 limits |
| 6 (My CV) | **A11** Privacy + **A2** accessibility | 0 | 0 | 4 + 5 | 4 + 5 | No Critical or High; A11-35, A11-37, A2-43 to A2-46, A2-48 to A2-50 fixed (#95) | 2026-10-23 | docs/audits/results/CV-A11.md, CV-A2.md. No browser or screen-reader walk of /cv yet |
| 5 (demo) | **A2** the judge demo walk | 0 | 2 | 6 | 3 | Both High and A2-61, A2-62, A2-64 fixed (#92) | 2026-10-23 | docs/audits/results/DEMO-walk.md: six personas at 360 and 1280 px, 266 page views, axe WCAG 2.2 AA |
| — (Mmereko) | **A1** real Postgres | 0 | 1 | 1 | 2 | All fixed (#94, Mmereko#5) | 2026-10-23 | The partner store on Postgres 17.11 for the first time; Python 3.11; the partner-cell Docker build (1.49 GB) |
| 5 (design) | **A2 + A3 + A4** | 0 | 0 | 4 | 13 | No Critical or High; the 4 Medium (A3-23, A3-24, A3-25, A4-14) fixed the same day, each with a test that failed first | 2026-10-21 | The design refresh, `69f8baa..38af297`. Three read-only agents. A3 measured in Playwright (text spacing, 400% zoom, keyboard, reduced motion); A4 Lighthouse 12.8.2: desktop 100 on every page, mobile 94–99. A2: 7 Low (home re-spells primitives, Tailwind defaults outside the tokens). Not measured: real screen readers, devices, Safari/Firefox |
| 3 | **A1 + A10 + A11** | 0 | 3 | 3 | 2 | **All High fixed**, each with a test that failed first (rule 10). Mediums and Lows fixed except the residuals below | 2026-10-13 | Phases 1–3 diff. Independent reviewer agent, read-only, exploits proven with throwaway tests. Counts are for the three audits together |
| 3 | **A8** | 1 | 7 | — | — | 13 → 5 advisories. The **2 remaining High** are accepted (A8-01) | 2026-10-13 | `pnpm audit --prod`. Next 16.3.6 → **16.3.8** (6 advisories incl. a high SSRF); overrides for `shell-quote` (critical) and `source-map-js` (high). The remaining 5 are in Expo/React Native **build tooling** with no fix available (node-forge, braces, sprintf-js) or needing a major bump of the pinned Expo SDK (uuid, decode-uri-component). Re-check at the next Expo SDK upgrade |
| 4 | **A10** AI safety and tone | 4 | 2 | 2 | 6 | **All Critical/High fixed** (#35, #36), plus A10-07 to A10-10, A10-14. Red team 118 → 165 at 100% | 2026-10-14 | The suite passed 100% but missed **38 of 44 new phrasings** (SMS spelling, "wanna", SA languages, abuse by relatives not listed, methods, a crisis split across two messages); WhatsApp/SMS replies were never checked. Checks 2, 4–8 not measured (no API key) |
| 4 | **A11** Privacy and POPIA | 0 | 1 | 6 | 4 | High fixed (#39: consent v2). A11-10 is the owner's (Information Officer, legal review) | 2026-10-14 | Messaging consent, push to Expo/Apple/Google, deletion and export of every new table |
| 4 | **A12** Messaging compliance (first run) | 0 | 2 | 7 | 6 | Both High fixed (#38), and A12-03 | 2026-10-14 | "Never during a paper" failed in production: only verified papers counted, and none are verified |
| 4 | **A1** Comprehensive | 0 | 0 | 3 | 3 | Open, none blocks | 2026-10-14 | Diff `17ca607..7d53bc6` (#20–#34) |
| 4 | **A2** Design fidelity | 0 | 0 | 4 | 7 | Open, none blocks | 2026-10-14 | No design document exists: graded against packages/tokens and both themes (A2-11) |
| 4 | **A3** Accessibility | 0 | 0 | 3 | 6 | Open, none blocks | 2026-10-14 | E2E 8/8 with axe; axe on every Phase 4 page at 320 px and reduced motion; no screen reader or device |
| 4 | **A4** Performance | 0 | 1 | 2 | 6 | High fixed (#40): root chunks 216 → 128 KB gzipped | 2026-10-14 | Lighthouse mobile (Slow 4G, 4× CPU) on a local production build; no field data |
| 4 | **A5** Security (first run) | 0 | 0 | 4 | 3 | Open, none blocks | 2026-10-14 | Whole system; no IDOR or CSRF gap in 14 changed routes; four exploits proven with throwaway tests |
| 4 | **A7** Mobile and native (first run) | 0 | 4 | 2 | 6 | All four High fixed (#37, #39, #42) | 2026-10-14 | Native 115 → 128 tests; no device, simulator or EAS build |
| 4 | **A1** The review sign-in (PR #42) | 0 | 0 | 4 | 3 | **All fixed in #42**, tests first | 2026-10-14 | Independent reviewer, security-weighted, exploits proven in a throwaway copy. docs/audits/results/PHASE-4-A1-review-sign-in.md |
| 5 | **A10** AI safety and tone | 4 | 0 | 2 | 4 | **All fixed** (fix-crisis, fix-lows); red team 220 → 323 at 100%, 63 failing first | 2026-10-17 | 33 of 40 new phrasings missed (methods, SMS spelling, SA-language inflections, abuse at university): exact phrases again. Fixed by mechanism (normalisation, stems, method + intent, condition + power). Live-model checks not measured (no key) |
| 5 | **A11** Privacy and POPIA | 0 | 1 | 2 | 3 | High fixed (consent v3 / adult-v2, refused in the database, migration 0021); A11-14, A11-16 the owner's | 2026-10-17 | Letters and proofs weren't covered by consent though the whole file goes to the AI provider |
| 5 | **A1** Comprehensive | 0 | 1 | 2 | 5 + 1 Info | High (A1-25, a crisis exclusion) and both Mediums fixed; A1-33 fixed 2026-10-17 evening (native letter upload, registration-day reminder) | 2026-10-17 | 5b/5c merge seams clean; data layer of the three new tables sound |
| 5 | **A3** Accessibility | 0 | 0 | 6 | 6 | All fixed (fix-ux, fix-lows) | 2026-10-17 | axe clean on every new page at 320 px; focus fell to `<body>` in 9 of 14 actions (A3-01 again) |
| 5 | **A13** Data accuracy | 0 | 0 | 4 | 3 + 3 Info | Mediums fixed (fix-curriculum); A13-11 fixed 2026-10-17 night (owner's decision); every sampled value matched its source, safety numbers digit by digit | 2026-10-17 | UJ and up.ac.za unreachable |
| 5 | **A2** Design fidelity | 0 | 0 | 1 | 8 | A2-12 interim (nav cue), A2-13–15, A2-17, A2-19 fixed; A2-16, A2-18, A2-20 fixed 2026-10-17 evening | 2026-10-17 | Still no design document (A2-11) |
| 5 | **A7** Mobile and native | 0 | 0 | 2 | 4 | Mediums and A7-15, A7-16 fixed; A7-17, A7-18 fixed 2026-10-17 evening | 2026-10-17 | No device or simulator |
| 5 | **A4** Performance | 0 | 0 | 0 | 4 | A4-11 (migration 0022), A4-12 fixed; A4-10, A4-13 fixed 2026-10-17 night | 2026-10-17 | Root chunks 127.6 KB; no catalogue data in any bundle; Lighthouse 78–96 |
| 4 | **A8** Dependencies | 0 | 0 | 1 | 3 | A8-01 still Accepted: no patch for either advisory | 2026-10-14 | 5 advisories (2 High accepted, 3 Moderate); pins intact; licences permissive |

**The three High findings, fixed:**
1. A minor could re-declare as an adult while waiting for (or after withdrawal of) guardian
   consent and skip it → date of birth can be set once only
2. The crisis check missed phone-typed phrasings ("i cant go on anymore", "im being abused",
   "my stepdad hit me", "kms", "i took a bunch of pills" …) → contractions restored before
   matching, past tenses, 17 new red-team cases
3. A guardian's old link could withdraw consent from a learner who had since consented as an
   adult, ending their sessions → links act only on the request still open

## Open findings

The phase gate (`audits.yml`) reads this table: an open Critical or High shuts it. IDs are
`<audit>-NN`; status is Open, Fixed, Closed or Accepted.

| ID | Audit | Severity | Location | Finding | Status | Plan |
|---|---|---|---|---|---|---|
| A8-05 | A8 | Critical | apps/web > next 16.3.8 | GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr: unauthenticated remote code execution | Fixed | next 16.4.3 (#132) |
| A8-06 | A8 | High | apps/web > next 16.3.8 | GHSA-p3m5-59mp-jv5r: App Router denial of service | Fixed | next 16.4.3 (#132) |
| A8-07 | A8 | High | firebase > @firebase/firestore > @grpc/grpc-js 1.9 | GHSA-m9gg-hp2v-232j | Fixed | override ^1.13.6; firestore never loaded (#132) |
| A8-08 | A8 | High | @vitejs/plugin-react > vite 8.3.1 | GHSA-587h-7wmj-h5pm (launch-editor) | Fixed | vite ^8.3.5 (#132) |
| A8-09 | A8 | High | expo > @expo/cli > zod 3 | GHSA-mrhx-c7xc-m3w5 | Fixed | override @expo/cli>zod ^4.6.7; native tests and expo export pass (#132) |
| A8-10 | A8 | High | jsdom > undici 8.11 | GHSA-xjj6-f33q-929c | Fixed | jsdom ^30.1.3 (#132) |
| A1-80 | A1 | Low | packages/admissions assessment.ts | A DP conflict shows when the term or quoted conditions differ, even when the numbers agree | Open | Compare the numeric part only |
| A11-60 | A11 | Medium | migrations 0040, 0041 | The D10 sweeps (module marks, outlines) exist but nothing runs them on a schedule | Open | Wire into A11-04's retention job once the schedule is written |
| A2-80 | A2 | Low | apps/web module card, mark calculator | Layout seen only in the integrator's checks; no A2 pass yet | Open | Phase 6's A2 |
| COL-01 | A13 | Medium | packages/catalogue colleges register | DHET circulars TC 0134(B), TC 0153 cited from a college's copy, not dhet.gov.za | Open | A person checks them; cite DHET's copy if one appears |
| COL-02 | A13 | Medium | packages/catalogue colleges | Lovedale, Taletso, Lephalale, Umgungundlovu have no usable site; Motheo prints no programmes | Open | A person contacts the colleges |
| COL-03 | A1 | Low | packages/admissions colleges.ts | "Passed Grade 9" is read from a Grade 10+ report; a learner moved up without passing would be miscounted | Open | The owner's wording call |
| CVE-01 | A11 | Low | apps/web /cv (demo) | The demo's "made by a stand-in, not by Mmereko" notice sits above Open Mmereko | Open | A wording key qualifying the notice |
| CI-01 | A1 | Low | packages/db demo-phone-signup.test.ts | "allows 100 an hour from one address" counted 99 once on CI (passed on re-run): likely the hour window ticking mid-test | Open | Freeze the clock in the test |
| AI-01 | A11 | High | apps/web demo wording | With `UF_AI_PROVIDER=gemini` on the demo, the privacy page and notices still name Anthropic as the AI provider: judges' chat goes to Google | Open | A demo-only line naming Gemini while it is on (first job of the next session); switch back by 2026-11-08 (hackathon-undo-pr.md) |
| PERF-01 | A4 | Medium | apps/web demo start | A judge's learner takes 49.8 s to start on the live demo (2026-10-24, measured) | Open | Measure where the time goes (the per-judge copy on Supabase London), then make it fast |
| MM-01 | A11 | Low | Mmereko | No privacy page: the canvas links Mmereko's home instead; Paystack checkout inside the frame untested | Open | Mmereko publishes one; test billing framed |
| A1-01 | A1 | Medium (residual) | packages/db (sign-in limits), packages/messaging | SMS cost across many numbers had no global cap | Fixed | `BudgetedSmsSender` + Postgres ledger, fails closed, race-tested (`phase-3/live-adapters`). The number-holding half is A1-05 |
| A1-02 | A1 | Low | apps/web/next.config.ts | CSP allowed `'unsafe-inline'` scripts (Next's bootstrap) | Fixed | Per-request nonces via `proxy.ts` (`phase-3/csp-nonces`); E2E fails on any CSP violation |
| A1-03 | A1 | Low | apps/web/app/api/documents | Vercel caps request bodies at 4.5 MB; uploads between 4.5 and 10 MB would fail there | Fixed | Direct-to-S3 signed uploads. The browser half is proven only once a real bucket exists (E2E runs locally) |
| A1-05 | A1 | Low (residual) | packages/db (sign-in limits) | Someone who controls many IP addresses can still hold a victim's number at the PIN limit; budget alerts only reach a log line | Open | Route alerts to Sentry or a pager when connected (Phase 4); revisit per-number limits with the SMS provider |
| A13-01 | A13 | Medium | packages/admissions/src/results.ts | Only records were gated: once a programme was verified, a learner would see a score from an unverified university method as fact | Fixed | Scored only when the method is verified too; test failed first (`phase-1/verification-kit`) |
| A1-06 | A1 | Medium | apps/web (Vercel config) | Nothing pinned the functions to `cpt1`: the first deploy would have processed student data outside South Africa (found by the spike write-ups) | Fixed | `vercel.json` regions + production refuses another `VERCEL_REGION`; tests (#9) |
| A1-07 | A1 | Medium | packages/agent, packages/documents | `AnthropicChatModel` and `AnthropicReportReader` have no tests at all, not even with a fake client: every chat and reading test uses a stand-in | Fixed | #21: 36 fake-API tests; two adapter bugs found and fixed |
| A1-08 | A1 | Medium | (missing) | No job-scheduler interface, stand-in or contract suite, though D8 requires one per provider; spike 5 can't start | Fixed | #20: packages/jobs, Postgres stand-in, 18-test contract |
| A1-09 | A1 | Low | packages/documents/src/reader.ts | Report photos up to 10 MB go to the AI unresized; may exceed per-image limits and cost more | Fixed | #21: resized to 2576 px / 3.75 MP, EXIF stripped |
| A1-10 | A1 | Low | apps/web (minor journey) | The minor-consent E2E passes, but the server logs an unhandled `ConsentRequiredError`: a page throws instead of redirecting | Fixed | #22: readyStudent() on every page; E2E fails on unhandled server errors |
| A1-11 | A1 | Low | apps/web/app/api/auth/request-pin | The PIN is issued before the SMS is sent: a provider failure still spends the learner's PIN allowance | Fixed | #22: withdraw and refund on a failed send; IP never refunded |
| A1-04 | A1 | Info | docker-compose.yml | Binds 5432, which other local projects may already hold | Open | Change the port if it clashes; tests don't need it (PGlite) |
| **Phase 4 audits (2026-10-14): Critical and High** | | | | Full text in docs/audits/results/PHASE-4-*.md | | |
| A10-01 | A10 | Critical | packages/agent/src/crisis.ts | Everyday phrasings missed: "i wanna die", SMS spelling (2, dnt, wnt, kil, ima), typos ("sucidal"), spaced letters | Fixed | #36: each a red-team case that failed first; shorthand normalised, "wanna" needs no "to" |
| A10-02 | A10 | Critical | packages/agent/src/crisis.ts | Indirect disclosures, plans, methods (jumping, poison, someone else's pills) and self-harm without "myself" missed | Fixed | #36 |
| A10-03 | A10 | Critical | packages/agent/src/crisis.ts | South African languages matched only the exact listed spellings ("ngizibulala", "tired of living", Afrikaans "sterf") | Fixed | #36: the `-zibulala` stem, four "tired of living" forms, accents stripped. First-language review owed |
| A10-04 | A10 | Critical | packages/agent/src/crisis.ts | Abuse by relatives not on the list (stepmom, aunt, cousin, "mom's boyfriend"), choking, forced sex, "threatened to kill me" missed | Fixed | #36: one relatives list for every rule |
| A10-05 | A10 | High | apps/web/app/api/messaging/[channel]/inbound | A WhatsApp or SMS reply was checked only for STOP: "I want to die" in reply to a reminder got silence | Fixed | #35: every inbound message crisis-checked; the reviewed words and verified helplines reply on the same channel |
| A10-06 | A10 | High | packages/agent/src/runner.ts | A crisis split across two messages ("i just want to" … "die") was missed | Fixed | #36: read with the previous message, counted only when together they are more serious |
| A11-01 | A11 | High | packages/content/src/en.ts (consent) | Guardian consent said nothing about SMS/WhatsApp/push or the processors (Meta, Expo, Apple, Google), though push and WhatsApp leave South Africa | Fixed | #39: consent v2; the data layer refuses a messaging opt-in under v1. **Legal review owed (A11-10)** |
| A12-01 | A12 | High | packages/db/src/papers.ts | "Never during a paper" counted only verified papers; none are, so production would message a learner mid-paper | Fixed | #38: every sourced paper silences, drafts included; learners still see only verified ones |
| A12-02 | A12 | High | packages/catalogue/src/exams.ts | The exam year came from a stale profile grade: a learner who signed up in Grade 11 had no protection in matric | Fixed | #38: the grade's year and the next |
| A7-01 | A7 | High | docs/store/review-notes.md | No way for an App Store or Play reviewer to sign in (an SMS PIN to a South African number): rejection under 2.1 is certain | Fixed | #42: option A (owner's choice), every guard tested by removing it; its own A1 review's findings fixed (A1-18 to A1-24) |
| A1-18 | A1 | Medium | packages/db/src/store.ts (sessions) | A review sign-in got an ordinary 30-day session that outlived the review window | Fixed | #42: ends at the window; refused once no window is open |
| A1-19 | A1 | Medium | packages/db/src/store.ts | The fixed PIN could be guessed online across PIN requests (~4.5% a window), silently | Fixed | #42: 10 wrong PINs a window lock it, counted in the database; every wrong PIN logged |
| A1-20 | A1 | Medium | packages/db/src/store.ts | A typo'd `UF_REVIEW_PHONE` matching a learner's number silenced their SMS for up to 31 days | Fixed | #42: an ordinary account always gets its SMS; the misconfiguration is logged |
| A1-21 | A1 | Medium | packages/db/scripts/review-seed.ts | The seed ran migrations against production from any checkout | Fixed | #42: refuses unless the database has exactly this checkout's migrations |
| A1-22 to A1-24 | A1 | Low ×3 | request-pin, review-notes.md, the seed | The review number skipped the SMS budget gate (an oracle); docs overstated the lock and put the PIN on the command line; the seed's error gave no remedy | Fixed | #42 |
| A7-02 | A7 | High | apps/native/lib/push.ts | Push silently stopped after a session ended while the screen said "On" | Fixed | #37: re-registers on launch and sign-in, forgets the token on a 401, follows token rotation |
| A7-03 | A7 | High | apps/native/components/onboarding.tsx | No sign-out or account deletion anywhere in onboarding; the adult step was a dead end | Fixed | #37 |
| A7-04 | A7 | High | packages/db/src/store.ts, onboarding | Adults went straight in: never told their chats and photos go to an AI provider outside South Africa (App Store 5.1.2(i), POPIA) | Fixed | #39: an agreement step on web and app, recorded with its version (migration 0009); chat and uploads refused until then |
| A4-01 | A4 | High | apps/web/instrumentation-client.ts | `import { z } from 'zod'` put all of zod and ~40 locales in every page's first JavaScript (216 KB gzipped) | Fixed | #40: imports only `config` (128 KB); a CI check fails on zod locales or above 150 KB |
| **Phase 4 audits: Medium** | | | | | | Target: before launch unless noted |
| A10-07 | A10 | Medium | crisis.ts | Over-triggering: "die my hair", "not safe to drive", "hit me with a surprise test", a literature question about suicide | Fixed | #36 |
| A10-09 | A10 | Medium | packages/agent/src/charter.ts | Family-pressure guidance assumed good intent and defended the family even when a threat was missed | Fixed | #36 |
| A10-15 | A10 | Medium | apps/web/lib/server/crisis-reply.ts | Crisis replies on SMS skip the per-sender limit (so help is never refused): once a paid SMS provider is live, a sender can trigger unlimited paid replies (found fixing A10-05) | Fixed | #43: three full replies an hour per sender, then a one-segment reply with the most relevant number; never silent; one alert per window |
| A12-03 | A12 | Medium | packages/db/src/papers.ts | A learner with no confirmed subjects had no paper protection | Fixed | #38: held during every NSC session |
| A12-06 | A12 | Medium | packages/messaging/src/reminders.ts | A provider timeout after acceptance makes the retry send again (2 deliveries proven) | Fixed | #46: a send the provider may have taken is `unconfirmed` (migration 0012) and never retried; an idempotency reference in the channel contract |
| A1-14 / A12-07 | A1, A12 | Medium | packages/content/src/messages.ts | The curly apostrophe forces UCS-2: every SMS costs 2 segments, and the budget counts messages, not segments | Fixed | #44: GSM-7 typography on the SMS channel and on webhook replies; segments counted by encoding and charged per segment (migration 0011). The full crisis reply was 4–7 UCS-2 segments: now 2 |
| A5-01 / A12-08 | A5, A12 | Medium | apps/web/lib/server/services.ts | Sign-in PINs, guardian links and reminders share one SMS budget: reminders can lock everyone out of sign-in | Fixed | #44: `sms-auth` (PINs, guardian links) and `sms-reminders` budgets; an over-budget reminder is rescheduled, not failed |
| A12-04 | A12 | Medium | inbound route, guardian route | STOP from a number with no account (a guardian) isn't recorded; guardian SMS ignores quiet hours | Fixed | #45: a STOP from any number is kept as an HMAC (migration 0013, no personal data); guardian SMS refused for it, and queued to 07:00 at night |
| A12-05 | A12 | Medium | packages/messaging/src/stop.ts | "Please stop", "remove me", "unsub" aren't treated as STOP | Fixed | #45: STOP/UNSUB anywhere in a short message and plain phrases ("remove me", "no more messages"); "can't stop worrying" does not opt out |
| A12-09 | A12 | Medium | packages/content/src/messages.ts | The check-in template reads as marketing to Meta (≈12× the cost); a recategorisation would go unseen | Fixed | #54: every WhatsApp body is the learner's own reminder or an account event; the billed category is recorded (migration 0017). **Owner:** re-submit the templates to Meta |
| A1-12 | A1 | Medium | apps/web/app/api/reports | Re-confirming reports creates unlimited re-check reminders, around the 10-a-day limit | Fixed | #53: confirmations limited to 10 an hour and 24 a day; one waiting re-check per learner, enforced by a unique index (migration 0016) |
| A1-13 / A5-07 | A1, A5 | Medium | packages/db (uf_may_process, mayMessage) | A learner who turns 18 under guardian consent is refused by the app but still messaged by jobs | Fixed | #49: `uf_may_process` holds the app's own rule (adults need their own recorded agreement; age in SAST, 29 Feb included), so pages, routes and jobs share it (migration 0014) |
| A11-02 | A11 | Medium | packages/content/src/messages.ts | SMS/WhatsApp bodies carry the first name and the university (lock screen, provider, Meta); the privacy page doesn't say so | Fixed | #54: SMS and WhatsApp carry no name, university or subject (the first name is gone from the send path); the privacy page names Meta |
| A11-03 | A11 | Medium | packages/db (sessions) | Expired sessions, and their push tokens, are never purged | Fixed | #51: a daily `session.sweep` job deletes expired sessions and their push tokens (and the review account's once its window closes) |
| A11-04 | A11 | Medium | migrations 0004, 0005 | No retention period for reminders, receipts, finished jobs, rate events (POPIA s14) | Open | **Owner writes the schedule** (planning §8); one sweep job applies it |
| A11-05 | A11 | Medium | packages/db/src/store.ts (withdrawConsent) | Withdrawing consent leaves channel opt-ins on: a later guardian's consent re-enables messages | Fixed | #49: withdrawal opts every channel out (`consent-withdrawn`) and drops scheduled reminders and their jobs |
| A5-03 / A11-06 | A5, A11 | Medium | apps/web/lib/server/messaging-providers.ts | `EXPO_ACCESS_TOKEN` is optional: anyone holding a push token can put any text on a minor's lock screen | Fixed | #50: live mode refuses Expo push without `EXPO_ACCESS_TOKEN`. **Owner:** turn on Expo enhanced push security |
| A11-10 | A11 | Medium (owner, blocks launch) | — | No Information Officer registered; no legal review of the consent wording (now v2) | Open | **Owner** |
| A5-02 | A5 | Medium | sms-providers.ts, inbound route | The live adapter contracts cover sending only: in production a STOP would reach nothing | Fixed | #50: a live SMS or WhatsApp adapter must bring an inbound verifier that passes the inbound contract; the app refuses to start without one |
| A5-04 | A5 | Medium | migration 0008, store.ts | No cap on push tokens per session or learner: cost amplification, one Expo request per token | Fixed | #51: one token per session, five per learner (oldest evicted); Expo sends batched, 100 per request (migration 0015) |
| A7-05 | A7 | Medium | apps/native/lib/api.ts | A release build with no or `http` API URL says "You're offline" and builds anyway | Fixed | #48: a missing or `http` API URL is a config error, and preview/production EAS builds refuse it |
| A7-06 | A7 | Medium | apps/native/components/ui.tsx | The keyboard covers the lower form fields on iOS | Fixed | #48: `Screen` scrolls a focused field above the keyboard |
| A8-02 | A8 | Medium | apps/native (deep links) | `decode-uri-component` DoS reachable through a crafted `universityflow://` link | Fixed | #48: `+native-intent.tsx` sends an over-long or undecodable link to `/` (remove when expo-router moves to query-string 9) |
| A4-02 | A4 | Medium | client components → catalogue barrel | 7 routes ship a 99 KB gzipped chunk: a second zod plus programme data | Fixed | #56: a zod-free, data-free `@universityflow/catalogue/client`; one zod version (a guard); a CI check fails on catalogue data in any client chunk. Pages ~250 → ~150 KB gz |
| A4-03 | A4 | Medium | apps/web/app/(app)/results | All 86 programme cards hydrate on the client: ~800 ms blocking on a mid phone | Fixed | #56: results render on the server; only the filter and the shortlist button hydrate; Plan B collapsed behind an accessible disclosure |
| A3-01 | A3 | Medium | apps/web/app/(app)/goals/goals-view.tsx | Keyboard focus drops to the page after a save (WCAG 2.4.3) | Fixed | #55: `aria-disabled` while saving; focus moves to the goal heading after a save that removes the button |
| A3-02 | A3 | Medium | apps/native/components/ui.tsx (Notice) | On iOS, errors and outcomes appear without being announced (WCAG 4.1.3) | Fixed | #55: `Notice` announces danger and warning messages; push results and goal saves are announced |
| A3-03 | A3 | Medium | confirm-marks (web and app) | Every mark field has the same label, and the error isn't announced | Fixed | #55: every mark field is labelled with its subject; errors in the hint (native) and `aria-describedby` (web) |
| A2-01 | A2 | Medium | apps/web/app/globals.css | Web spacing comes from Tailwind's scale, not `tokens.space` (20 vs 24 px at step 5) | Open | Map `--spacing-*` to the tokens |
| A2-02 | A2 | Medium | both apps' ui primitives | Card, input, badge and notice differ between web and app, undocumented | Open | Component tokens in packages/tokens; a design document (A2-11) |
| A2-03 | A2 | Medium | apps/native/app/account.tsx | Account deletion is a green primary button in the app (red on the web) | Fixed | #55: a native danger button for deletion; `onBrand` on `danger` is a tested pair |
| A2-04 | A2 | Medium | apps/native/components/confirm-marks.tsx | Hand-rolled radio: unselected border 1.68:1 | Fixed | #55: shared `Radio`, `RadioGroup` and `Checkbox` with a 3.8:1 border |
| **Phase 4 audits: Low (50)** | | | | Each in its results file; fix when nearby | | |
| A10 | A10 | Low ×6 | | A10-08, A10-10, A10-14 fixed (#36); A10-11, A10-13 fixed (#63); A10-12's escaping fixed (#63), **its crisis check on a saved goal is open** (owner: how help shows on a settings form) | Partly fixed | |
| A1, A2, A3, A4, A5, A7, A8, A11, A12 | | Low ×44 | | **Fixed:** A1-15, A12-14 (#46), A5-06 (#50), A7-07, A7-08 (#48), A11-07, A11-11 (#51), A12-10, A12-13 (#54), A4-04 (#56), A3-07 (#55); A1-17, A8-03, A8-04, A7-11 (#58); A1-16, A2-07, A2-10, A3-04, A3-05, A4-07, A4-09 (#62); A11-09 (#63); A12-12, A12-15, A5-05, A11-08, A4-06, A4-08 (#65); A2-05, A2-06, A2-08, A2-09, A3-06, A3-08, A3-09, A4-05, A7-09, A7-10, A7-12 (#64). **Already fixed:** A8-05 (#56), A12-11 (#50). **Open:** A2-11 (owner: the design document) | Partly fixed | |
| A3-10 | A3 | Low | apps/web/components/recheck-card.tsx, artifacts.tsx | `recheck-title` and `crisis-title` are fixed ids: two of either in chat duplicate them, as A3-05 found for three other artifacts (found by the sweep) | Fixed | 475d94c (phase-5/stack): `useId()`, as #62 did; `components.test.tsx` shows each card twice in the chat. The table said Open until 2026-10-21 |
| A11-12 | A11 | Low | packages/db (rate_events) | `rate_events` rows (rate limits, webhook replay keys as HMACs) are never purged; nothing personal, but kept forever (found by the sweep) | Open | Part of A11-04's retention schedule and its sweep job |
| A10-16 | A10 | Low | packages/content/src/en.ts (`agent.sample.care` family-pressure) | The family-pressure sample words still say "your family wanting the best for you": A10-09 took that assumption out of the guidance, not the sample text (found by #75) | Fixed | fix-lows: the words ask how things are at home and invite the learner to say if they don't feel safe |
| **Phase 5 audits (2026-10-17): Critical and High** | | | | Full text in docs/audits/results/PHASE-5-*.md | | |
| A10-17 | A10 | Critical | packages/agent/src/crisis.ts | Methods and indirect disclosures missed (a res roof, bleach, "a bunch of panados", traffic, "sleep forever", farewell letters) | Fixed | fix-crisis: method nouns only with a doing verb; indirect statements; red-team cases failing first |
| A10-18 | A10 | Critical | crisis.ts | SMS and slang spellings missed ("kys", "want 2 dy", "kil myslf", "suicidial") | Fixed | fix-crisis: held letters collapsed, digits read as letters, misspelling families |
| A10-19 | A10 | Critical | crisis.ts | SA-language inflections missed ("sengifuna ukufa", "ndiyafuna ukufa", "ho hwa", "my lewe neem") | Fixed | fix-crisis: stems with any concord; the negative "-funi" excluded. First-language review owed |
| A10-20 | A10 | Critical | crisis.ts | Abuse at university missed (threats, sextortion by a lecturer or landlord, groping at res) | Fixed | fix-crisis: present-tense threats; a condition plus a power word; touching without consent |
| A1-25 | A1 | High | crisis.ts | The 5d "disappear" rule's exclusions dropped real death wishes ("disappear from this world") | Fixed | fix-crisis |
| A11-13 | A11 | High | consent wording, packages/db | Consent didn't cover acceptance letters or proofs of registration | Fixed | fix-consent: guardian v3 and adult-v2 wording; migration 0021 refuses the uploads under older versions, even for the owner role. **Legal review owed** |
| **Phase 5 audits: Medium and below** | | | | | | |
| A1, A2, A3, A4, A7, A10, A11, A13 | | Medium ×19, Low ×37, Info ×4 | | **Fixed:** A10-21–26 · A1-26–32 · A11-15, A11-17, A11-18 · A3-10–22 · A13-02–06, A13-08, A13-09 · A2-13–15, A2-17, A2-19 · A7-13–18 · A4-11, A4-12 · A1-33 · A2-16, A2-18, A2-20 (the last six on 2026-10-17 evening) · A4-10, A4-13, A13-11 (2026-10-17 night). **Partly:** A2-12 (an overflow cue; grouping is the design document's). **Open:** A11-14 (file retention), A11-16 (campus name in crisis SMS) — owner · A13-07 (Wits inferred values, disclosed), A13-10 (no 2028 data yet) | Partly fixed | |
| **Design refresh audits (2026-10-21): A2, A3, A4** | | | | Full text in docs/audits/results/PHASE-5-DESIGN-*.md. No Critical or High | | |
| A2-21 | A2 | Low | apps/web/components/dashboard.tsx (HeadlineCard) | The headline card painted its empty-state outline button pink and its "Not yet" line in ink | Fixed | #113: accent on the text link only, muted sentence; dashboard test |
| A2-22 | A2 | Low | me/me-view.tsx; dashboard.tsx | Two hand-written outline buttons; "Download my data" kept the old mauve outline | Fixed | #113: buttonLook exported and used; primitives.test catches outline copies |
| A2-23 | A2 | Low | dashboard.tsx, marks-chart.tsx | The home re-spelled Card/PageHeader | Fixed | #113: the home on Card (glow) and PageHeader; dashboard test |
| A2-24 | A2 | Low | chat, sign-in, (app) layout, demo pages | Tailwind default sizes outside the tokens | Fixed | #113: width tokens; Tailwind's text/leading/container defaults reset and mapped; css-rules guard |
| A2-25 | A2 | Low | globals.css, split-stage.tsx | Hand-typed rise, lift, easing, haze, stage height, rule width and breakpoints; tiles lifted under reduced motion | Fixed | #113: motion, easing, shape and breakpoint tokens; css-rules guards; motion-reduce on the tiles |
| A2-26 | A2 | Low | apps/web/app/layout.tsx | Hand-typed font fallback; tokens.font.family never reached | Fixed | #113: no literal fallback (next/font takes literals only); the stack reaches var(--uf-font); fonts test |
| A2-27 | A2 | Low | globals.css; split-stage.tsx; tokens; apps/native/lib/theme.ts | Stale comments | Partly fixed | #113: web and tokens comments corrected; apps/native/lib/theme.ts:4,12 left |
| A2-28 | A2 | Medium | apps/web/app/(app)/me/profile-look.tsx | Save and Cancel hid the picker with the focused button in it: focus fell to `<body>` (2.4.3) | Fixed | 9676630: focus back on "Make it yours" (useFocusAfter) |
| A2-29 | A2 | Medium | apps/web/app/(app)/me/profile-photo.tsx | Save, Cancel and Remove photo unmounted the pressed button; zoom buttons `disabled` at their limits: focus to `<body>` (2.4.3) | Fixed | 19512ad: focus to the photo button; zoom `aria-disabled` |
| A2-30 | A2 | Low | packages/tokens PROFILE_THEME_PAIRS | `brand` on the seven soft colours (quiet buttons, ticked boxes on the card's ground) untested (6.37–7.01 today) | Fixed | 87989d2: `['brand', soft, 'text']` per theme |
| A2-31 | A2 | Medium | apps/native/components/profile-look.tsx (Choice) | The app's theme swatches had no visible names, only colour (1.4.1; proposal §2.4) | Fixed | 0ba282d: each swatch shows its name |
| A2-32 | A2 | Medium | apps/web/app/globals.css (.uf-look-chip from 40rem) | Floating words never wrap and start 66–68% across: the longest is cut off by the card at 40–48rem and at 200% zoom on a laptop (1.4.4, 1.4.10) | Fixed | 8384b62: wrap at 30%; E2E at 360/640/1280 added (integrator to run) |
| A2-33 | A2 | Low | apps/web/app/(app)/me/profile-look.tsx | Initials/Icons/Patterns headings not tied to their tiles (1.3.1) | Fixed | ac1fcba: a fieldset and legend per kind |
| A2-34 | A2 | Low | apps/native/components/profile-look.tsx | "2 of 3 chosen" not announced in the app (4.1.3) | Fixed | cbc2d1a: announced on each tick |
| A2-35 | A2 | Medium | apps/native/components/profile-look.tsx:321-414 | The app's poster reaches the grade and words before the name's header; "My words" label not read on iOS (1.3.2, 2.4.6) | Fixed | Fixed 2026-10-23 (#83, 4c952c9): header first, one summary after it; VoiceOver/TalkBack check owed |
| A2-36 | A2 | Low | apps/native/components/profile-look.tsx:520,531 | Save/Cancel unmount the picker; no accessibility focus set after | Fixed | Fixed 2026-10-23 (#83): focus back on the toggle after Save/Cancel (`focusOn`); device check owed |
| A2-37 | A2 | Low | apps/native/components/profile-photo.tsx:43 | Crop window fixed at 320pt: past the edge on a 320pt screen | Fixed | Fixed 2026-10-23 (#83): crop 100% wide, max 320, aspect 1, positions in %; 320pt device check owed |
| A2-38 | A2 | Low | native profile-look.tsx:666; globals.css:692 | The grade sticker is a fixed circle: large text or text spacing spills out | Fixed | Fixed 2026-10-23 (#83): min sizes and padding, web and app; large-text device check owed |
| A2-39 | A2 | Low | apps/web/app/globals.css:633 vs :724 | From 40rem the words are `position: relative` (the later base rule wins), so their offsets add up | Fixed | Fixed 2026-10-23 (#83): the floating rule wins by specificity; **the owner's look at 1280px owed** |
| A2-40 | A2 | Low | apps/native/components/profile-look.tsx:281-298 | The app's entrance starts after the at-rest first frame: words flash off and fade back | Fixed | Fixed 2026-10-23 (#83): only the rise animates; words never fade |
| A2-41 | A2 | Low | apps/web/app/globals.css:1291 | Crop `touch-action: none` over most of a phone's width: a thumb on the photo can't scroll the page | Fixed | Fixed 2026-10-23 (#83, integrator): one fixed `touch-action: pan-y` (a pointerdown switch is too late for touch); phone check owed |
| A2-42 | A2 | Low | apps/web/app/(app)/me/profile-photo.tsx:230 | Zoom slider read as "1.25" with no unit | Fixed | Fixed 2026-10-23 (#83): `aria-valuetext` "125%" from `profilePhoto.zoomValue` |
| A3-23 | A3 | Medium | apps/web/app/globals.css (.uf-stage, .uf-stage-sharp from 64rem); /sign-in | Split stage is viewport-tall with overflow hidden and centred content: with WCAG 1.4.12 text spacing the app name and h1 are cut off, and Send my PIN is clipped off-screen (1024x600, 1097x617, 1280x577) (1.4.12, 2.4.11) | Fixed | Fixed 2026-10-21: the stage is at least one screen (min-height), clips sideways only, centres with `safe center`; e2e/layout.spec.ts (1.4.12 text spacing at 1024x600: the app name, the heading and Send my PIN reachable), failed first |
| A3-24 | A3 | Medium | apps/web/app/globals.css (.uf-app:has(.uf-chat)); chat.tsx | At 400% zoom (320x256) the chat's conversation region is 29px tall: the pinned layout leaves header 61 + composer 126 (1.4.10) | Fixed | Fixed 2026-10-21: the chat is pinned to the screen only from 30rem tall; e2e/layout.spec.ts at 320x256, failed first (29px, clipped) |
| A3-25 | A3 | Medium | apps/web/app/(app)/chat/chat.tsx (starters, Send) | A starter or the Send button drops keyboard focus to BODY (measured); the next Tab restarts at the skip link (2.4.3) | Fixed | Fixed 2026-10-21: focus goes to the message field after a starter or Send; Send and the starters use aria-disabled; the starters list has its own name; chat.test.tsx, failed first |
| A3-26 | A3 | Low | apps/web/app/(app)/nav.tsx | At 320px with 1.4.12 text spacing the header row scrolled 15px sideways | Fixed | #113: the row wraps, Menu ms-auto; E2E at 320 with the override |
| A3-27 | A3 | Low | page.tsx; split-stage.tsx | Four front-door tiles named for features all went to sign-in | Fixed | #113: kept as links (design README); each name says where it leads ("Your results: Get started", an existing key) |
| A3-28 | A3 | Low | apps/native/app/chat.tsx (crisis card) | The crisis reply's heading was swallowed by the grouped accessibilityLabel: not read, not in heading navigation | Fixed | #111: card ungrouped, header announced and navigable; native test. Not yet heard on a device |
| A4-14 | A4 | Medium | apps/web/app/globals.css:68-75 | `background-attachment: fixed` on body: desktop Chromium repaints the viewport on every scroll frame (1,359 vs 31 paints on /results) and scrolling freezes during main-thread tasks (572–587 ms vs 36–46 ms) | Fixed | Fixed 2026-10-21: the haze is a fixed `body::before` layer; test/css-rules.test.ts (no fixed-attachment background), failed first |
| A4-15 | A4 | Low | apps/web/app/(app)/nav.tsx | The phone Menu was dead until hydration | Fixed | #113: a native details disclosure and CSS :has; JavaScript only for Escape and page changes; no-JS E2E. A browser without :has shows the panel open |
| A4-16 | A4 | Low | apps/web/app/(app)/chat/chat.tsx | Every keystroke re-rendered the whole conversation | Fixed | #113: the Composer owns the draft, MessageList memoised; render-count test (225 to 25) |
| A4-17 | A4 | Low | apps/native/app/index.tsx | The app's home fetched /api/me then /api/home in series on every focus | Fixed | #111: coming back costs one background /api/home with the last data on screen; a 403 or onboarding step re-asks /api/me; the first visit still asks /api/me first (hard rule 5) |
| **Research (2026-10-22), graded by the owner** | | | | Full text in docs/research/2026-10-22-*.md (not legal advice) | | |
| A11-19 | A11 | High | consent; the AI provider (US) | (Research L-1) POPIA s57 may require the Information Regulator's **prior authorisation** before children's information goes to Anthropic; up to 4 + 13 weeks to answer | Open | **Owner and legal:** decide, and file on the eServices portal if it applies, by early November 2026 for a March 2027 launch |
| A11-20 | A11 | High | (missing) | (Research L-2) Accountability: no named responsible party, information officer not registered, no PAIA manual, no privacy page, no ECTA s43 footer (with A11-10) | Open | Owner names the entity and registers the IO; code builds the privacy page and footer from the owner's details |
| A11-21 | A11 | High | consent v3, adult-v2; docs/store | (Research L-3) Special personal information (health, abuse disclosures) reaches the chat, but consent doesn't name it and the store forms say Health and Sensitive info aren't collected | Open | Consent v4 (legal review), then the forms brought into line |
| A11-22 | A11 | High | guardian consent link | (Research L-4) Nothing shows that the number the learner types belongs to a competent person (POPIA s35, s11(2)(a): we carry the burden of proof) | Open | Legal says what is "reasonable"; code adds proportionate checks |
| A11-23 | A11 | High | crisis protocol, human flag | (Research L-5) Mandatory reporting (Sexual Offences Act s54; Films and Publications Act s24C): no safeguarding policy or lead | Open | Legal and owner write the policy; code follows it |
| A5-08 | A5 | High | (missing) | (Research SEC-02) No incident-response plan or POPIA s22 breach runbook (eServices portal, notices to learners and guardians, a register) | Open | Drafted 2026-10-24 (#110): docs/security/incident-response.md, a DRAFT with "Owner to fill" contacts and 12 questions for the lawyer. Owed: the owner adopts and fills it, registers on the eServices portal, the lawyer answers §17, one tabletop exercise before launch |
| A5-09 | A5 | Medium | packages/db/src/store.ts (verifyOtp) | (Research SEC-04) A wrong-PIN count started again with each new PIN: about 1,440 guesses a day at one number (NIST SP 800-63B rev 4) | Fixed | Fixed 2026-10-22: wrong PINs count per number across all its PINs, as an HMAC; store.test.ts, failed first. The first fix (20 in 24 hours, a hard lock) was replaced by A1-36's: at most 100 wrong PINs in a row, reset by signing in |
| **S1 audits (2026-10-22): A1, A3, A10, A11** | | | | Full text in docs/audits/results/S1-*.md | | |
| A10-27 | A10 | Critical | packages/agent/src/crisis.ts | Self-harm in a younger learner's words missed ("i cut again last night", "scratching my arms till they bleed") | Fixed | Fixed 2026-10-22: first-person rules; red-team cases and controls ("i cut class again"), failed first |
| A10-28 | A10 | Critical | crisis.ts | Sexual exploitation of a child missed: nudes shared or demanded, pictures asked for in secret, an adult demanding secrecy, a stranger touching, sex for money | Fixed | Fixed 2026-10-22: red-team cases and controls (a surprise party), failed first. **First-language and owner review of the new phrasing owed** |
| A10-29 | A10 | Critical | crisis.ts | Violence from other learners, against a parent or sibling at home, and neglect missed | Fixed | Fixed 2026-10-22: red-team cases and controls ("beats my mom at chess", "food money"), failed first |
| A10-30 | A10 | High | crisis.ts | Bullying, in person or online, got nothing | Fixed | Fixed 2026-10-22: a concern (Childline on the card, a check-in), never the protocol; red-team cases, failed first. A care topic and guidance for it: with A10-33 |
| A10-31 | A10 | High | content en.chat; agent system prompt | No AI disclosure in the chat (Anthropic Usage Policy from 12 Nov 2026; minors guidance) | Fixed | Fixed 2026-10-22: the welcome says "I'm UniversityFlow's AI companion, not a person", the line under the message box says so always, and the prompt says to say so whenever asked; tests failed first. Wording owed review |
| A1-34 | A1 | Medium | packages/db/src/messaging.ts:398 | Exam inputs take the newest report by date, so an older Grade 10 report added late decides a matric learner's papers and paper silence | Fixed | Fixed 2026-10-22 (f8e787e): one ordering, `LATEST_REPORT_FIRST`, for `recentReports` and `examInputs`; messaging.test, failed first |
| A1-35 | A1 | Medium | catalogue reports, api/reports | "Never Qualify now on Grade 10" rests on the kind the learner picks; on 1 January the default is Grade 11 while December's Grade 10 report is uploaded; any kind is accepted | Fixed | Fixed 2026-10-22 (3fa0955): the draft carries `printedKind` and both forms start there; else `defaultReportKind(grade, today)` (Grade 11: Grade 10's report until December, owner's option A); POST /api/reports refuses a kind above the current grade (`report-above-grade`); tests in catalogue, documents, web and native, failed first. Wording owed review |
| A1-36 | A1 | Medium | packages/db/src/store.ts (A5-09) | The first A5-09 fix was a hard 24-hour lock after 20 wrong PINs: a stranger could lock a number out in 15 minutes | Fixed | Fixed 2026-10-22: at most 100 wrong PINs in a row (NIST), reset when the owner signs in; locking out a stranger is no easier than A1-05. Test failed without the reset |
| A10-32 | A10 | Medium | packages/agent/src/tools.ts | The Grade 10 "on track" note goes only with my_results; programme_details, what_i_need and the goal tools send a bare verdict with a score | Fixed | Fixed 2026-10-22 (95c2c3e): `grade10Note` in all four, and my_results' description; agent.test, failed first |
| A10-33 | A10 | Medium | system-prompt.ts | No child-safety guidance (an adult asking for secrets, photos or meetings) | Fixed | Fixed 2026-10-22 (f0f46ee): a "Children's safety" section in the cached prompt; agent.test, failed first; red team 100%. A stopgap: **owner, ask Anthropic for their child-safety prompt** |
| A10-34 | A10 | Medium | tools.ts funding_overview | Nothing stops the model deciding NSFAS eligibility (Anthropic high-risk: public benefits) | Fixed | Fixed 2026-10-22 (8fe4e13): `NSFAS_DECIDES` (charter) in the prompt and in funding_overview's facts; the description says "published criteria"; agent.test, failed first; red team 100% |
| A10-35 | A10 | Medium | (missing) | No "report this reply" (Films and Publications Act s24C; app stores) | Fixed | Fixed 2026-10-22 (bf483ee): "Report this reply" on each AI reply, web and app; reasons only (`REPLY_REPORT_REASONS`); `reply_reports` (migration 0026); 20 a day; `ReplyReportAlerts` logs ids until the owner names the destination; tests in db, web, native, content and the crisis E2E, failed first. Wording owed review; legal: keep reports after account deletion? (A11-23) |
| A11-24 | A11 | Medium | packages/db/src/store.ts:1049 | Sign-up accepts age 10 and over; the stores say 13 and over | Fixed | Fixed 2026-10-22 (83e414f): `setDateOfBirth` refuses under 13 (`MINIMUM_AGE`, `TooYoungError`) recording nothing; 409 `too-young`; both apps' date-of-birth step says why; store docs updated; tests in db, web and native, failed first. Wording owed review |
| A11-25 | A11 | Medium | consent wording; the home | Nobody is told before the 18th birthday that the guardian's consent ends and reminders will stop | Fixed | Fixed 2026-10-22 (150aa74): both homes say "You turn 18 on <date>" and what changes in the 30 days before, while a guardian's consent covers them (`eighteenthBirthdaySoon`, `HomeData.turningEighteen`); tests in db, web and native, failed first. Still owed: the duration in consent v4 (legal, L-7); wording owed review |
| S1 Lows | A1, A3, A10, A11 | Low ×17, Info ×1 | | **Fixed:** A1-37 (no PIN sent to a locked number; its own message), A1-42 (the other-number test now locks the other number), A10-36 (the welcome promises no applications), A1-44 (its welcome half, and the note with every verdict by A10-32). **Fixed 2026-10-22, each with a test that failed first:** A1-38 (e21bf7d, About me sends the grade only when changed), A1-39 and A1-43 (67b36b0, Grade 10 is the floor, migration 0027; 0025's backfill tested), A1-40 (e26894a, the app's form waits for the grade), A1-41 (33012d8, no false "0 courses"), A3-29 (9cd2af1), A3-30 (9b6a0e2), A3-31 (7a50af6), A10-37 (97d3fff), A10-38 and A11-27 (b52e1ea, "finished school"; the export shows the current grade), A10-39 (49e5f55), A11-26's store-page half (2a24290). **Open:** A11-26's consent-wording half (legal, consent v4) | Fixed but one (legal) | |
| **S1 session 5 audits (2026-10-23): A5 (security) and A11 round 2** | | | | Full text in docs/audits/results/S1-A8.md (security, filed as A5: README's A8 is supply chain) and S1-A11b.md | | |
| A5-10 / A11-28 | A5, A11 | High | apps/web staging (dev outbox, catalogue preview) | A staging site had `production: false`: /dev/outbox (PINs, guardian links) and unverified drafts were public; real people's numbers could land outside SA | Fixed | Fixed 2026-10-23 (agent 10): HTTP Basic gate on every staging request (`UF_STAGING_PASSWORD` ≥16, proxy + `handler()`; health open; fails closed); a test walks every API route; tests failed first |
| A5-11 / A11-29 | A5, A11 | High | apps/web/lib/server/config.ts (`checkStaging`) | Staging accepted a production `DATABASE_URL` and real provider keys | Fixed | Fixed 2026-10-23: staging refuses any non-`pglite:` database and every real key (AI, voice, S3/AWS, SMS, WhatsApp, push, jobs, review); 20 tests failed first |
| A5-12 | A5 | Medium | config.ts (`isProduction`) | `UF_LOCAL_PRODUCTION_BUILD=1` on Render switched production off and skipped its checks | Fixed | Fixed 2026-10-23: `RENDER` treated like `VERCEL_ENV`; anything but staging refuses on Render; tests failed first |
| A5-13 | A5 | Low | packages/documents/src/profile-photo.ts | 50 MP limit let a 2 MB PNG decode to ~400 MB | Fixed | Fixed 2026-10-23: refused above 16 MP or 8 bits a channel from the header; tests failed first |
| A5-14 | A5 | Low | read-aloud.ts, voice.ts | Concurrent cache misses each call (and pay) ElevenLabs; its response is buffered with no size cap or content-type check | Fixed | Fixed 2026-10-23 (#83, b89caba): single call per key, cleared on settle; audio/mpeg only; 5 MiB cap on Content-Length and while streaming; tests failed first |
| A11-30 | A11 | Medium | config.ts (voice) | Read aloud was on for every learner, minors included, whenever the key was set, though the privacy page promises otherwise | Fixed | Fixed 2026-10-23: production refuses `ELEVENLABS_API_KEY` without `UF_ELEVENLABS_MINORS_APPROVED=1` (set only once ElevenLabs' written approval exists; record where it is filed here); test failed first |
| A11-31 | A11 | Medium | migration 0029, store.ts | The photo's consent rule is only a switch, not a data-layer consent-version check | Fixed | Fixed 2026-10-23 (#100, migration 0037): kept and served only under guardian v4 / adult-v3; production refuses `UF_PROFILE_PHOTO` until that wording is live; withdrawal deletes the photo; real Postgres 522/522 |
| A11-32 | A11 | Low | api/me/photo DELETE | "Remove photo" was refused after consent was withdrawn or lapsed | Fixed | Fixed 2026-10-23: DELETE needs only sign-in + CSRF; the store removes the learner's own photo without consent; tests failed first |
| A11-33 | A11 | Low | privacy page, store doc | The profile look wasn't named | Fixed | Fixed 2026-10-23 (38e69f9); test reads `profiles`' columns from the schema |
| A11-34 | A11 | Low | privacy page | Plan maps listed as "coming later" though ticks are collected now | Fixed | Fixed 2026-10-23 (b087540); only the learner's own words are "later" |
| A10-40 | A10 | Medium | api/me (goal in their words) | The profile's "goal in their words" reaches the AI but was never crisis-checked (plan maps D9) | Fixed | Fixed 2026-10-23 (7b46af1): saved, and the care card shown, as plan maps do; tests failed first. **A10 round owed** for the four new past-tense crisis rules (ae74073) |
| A4-18 | A4 | Medium | apps/native bundles | The app bundles are +15.4% (Android 3475.8 KB) and +16.6% (iOS 3241.6 KB) over baseline (5% tolerance): +276 KB from the photo, mark, maps, expo-audio and every content section (web-only copy too), +187 KB react-native-svg's core (no CSS parser) | Fixed | Fixed 2026-10-23 (#83): the app imports `@universityflow/content/app` (guard `native-no-content-barrel`); native bundle budget passes |
| **S1 session 6 audit (2026-10-23): A10 round (S1-A10b)** | | | | Full text in docs/audits/results/S1-A10b.md | | |
| A10-41 | A10 | Critical | packages/agent/src/crisis.ts | Past-tense death wish missed in 26 of 47 phrasings ("didn't want to wake up", "tried to end it", "wishd") | Fixed | Fixed 2026-10-23 (#83, 790c33e): red-team cases failed first |
| A10-42 | A10 | Critical | crisis.ts (languages) | The same misses in Afrikaans, isiZulu, isiXhosa, Sesotho, Setswana | Fixed | Fixed 2026-10-23 (#83); first-language review of the new patterns owed |
| A10-43 | A10 | High | crisis.ts (concern) | Past-tense distress with a word between ("I felt really hopeless") missed | Fixed | Fixed 2026-10-23 (#83) |
| A10-44 | A10 | Medium | crisis.ts (substance) | Drinking or using to forget/cope caught in few forms | Fixed | Fixed 2026-10-23 (#83) |
| A10-45 | A10 | High | packages/agent/src/gemini-model.ts | Gemini's own safety filters were off (no safetySettings) | Fixed | Fixed 2026-10-23 (#83, 150b3a8) |
| A10-46 | A10 | High | config.ts (demo), docs/deploy/demo.md | Google's Gemini API terms forbid users under 18 and services likely used by them: the public demo must not run on Gemini | Open | **Owner and legal.** The demo runs on Anthropic (leave `UF_AI_PROVIDER` unset); Gemini never serves learners under the current terms |
| A10-47 | A10 | Low | packages/agent/src/tools.ts | Tool descriptions said "on Grade 10 marks" only | Fixed | Fixed 2026-10-23 (#83) |
| A10-48 | A10 | Low | packages/agent/src/charter.ts | Setback guidance pointed a Grade 11 interim report at an always-empty Plan B | Fixed | Fixed 2026-10-23 (#83) |
| A10-49 | A10 | Medium | db messages, reply_reports; agent model.ts | Nobody can tell which provider wrote a reply | Fixed | Fixed 2026-10-23 (S1 session 7, #89): every ChatModel has a writer; `runTurn` returns `writtenBy` (`system`, no model, for the crisis reply and a refusal/failure before any words); migration 0036 adds `reply_provider`/`reply_model` to messages and reply_reports (null = not recorded, no backfill, null-safe checks; real Postgres 17 499/499); the report alert names the writer; `gemini-production.test.ts` proves no Gemini in any production-like environment |
| A10-50 | A10 | Medium | docs/deploy/demo.md | A free Gemini key lets Google train on and read what judges type | Fixed | Fixed 2026-10-23 (#83): Paid tier required |
| A10-51 | A10 | Low | gemini-model.ts | `ESCALATION` finish reason was a ModelError, not a refusal | Fixed | Fixed 2026-10-23 (#83); `LANGUAGE`/`JAILBREAK` to check with a real key |
| A10-52 | A10 | Low | crisis.ts | "I wished I could die my hair" was a crisis | Fixed | Fixed 2026-10-23 (#83) |
| A10-53 | A10 | Low | crisis.ts | By choice not caught: "took pills to cope"; "felt like dying" is a concern | Open | Reviewer note written (docs/audits/results/A10-53-reviewer-note.md, #88): a reviewer answers its two yes/no questions |
| A8-01 | A8 | High | package.json (pnpm.auditConfig) | node-forge ≤1.4.0 (GHSA-86w9-cpqp-85rv, via `@expo/cli`) and braces ≤3.0.3 (GHSA-vfj7-8cjw-p6xm, via `@types/jest`): no patched version exists. Build and test tooling only; neither ships in the app or runs on the server | Accepted | Ignored by exact GHSA id so any new High still fails A8. Re-check at the next Expo SDK upgrade, and remove each id once a fix ships |
| **S1 session 7 (wave 3), 2026-10-23** | | | | Full text in docs/audits/results/CV-A5.md, CV-A10.md, CV-A11.md, CV-A2.md, DEMO-walk.md | | |
| A10-54 | A10 | High | apps/web/app/api/me/cv/entries, selection | Crisis check skipped entry keywords and link labels, and the surname/town/province typed for the CV | Fixed | #93: entryTexts/selectionTexts read every free-text field; tests failed first |
| A10-55 | A10 | High | api/me/cv/tailorings, ats-scan | The pasted job advert was never crisis-checked; a tailoring stored it and sent it to Mmereko's model | Fixed | #93: on crisis words nothing is stored or sent, the crisis card shows; a second press (`sendAnyway`) sends |
| A10-56 | A10 | High | api/me/cv/drafts, tailorings | Crisis words in ticked entries or the summary went to Mmereko at "Make my CV" with no second look | Fixed | #93: re-read in groups and held the same way. **Owner to confirm the hold (stricter than design §7.5; recommended: keep it)** |
| A10-57 | A10 | Medium | web cv-documents.tsx, app cv.tsx | A fitted (AI-written) CV wasn't marked as written by an AI | Fixed | #93: `cv.preview.tailoredNote` |
| A10-58 | A10 | Medium | CV preview (web cv-documents.tsx, cv-report.tsx; app cv.tsx) | No "Report this CV" for a fitted CV, though design §11 promises one | Fixed | #107: cv_reports (migration 0039), POST /api/me/cv/documents/[id]/report (20 a day, id-only log line), Report this CV on web and app; tests failed first. Wording owed review |
| A10-59 | A10 | Low | apps/web/lib/server/cv.ts cv.submit | An entry edited to crisis words while a CV is queued is sent without the make-time hold | Open | Accepted: a seconds-long window |
| A10-60 | A10 | Low | api/me/cv/ats-scan; lib/server/mmereko.ts | Mmereko's answer isn't crisis-checked (by choice); the ATS route returned the engine's word lists uncapped | Fixed (the cap) | #112: the live adapter caps the lists at 200 words, flags at 20; the crisis check stays off by choice |
| A10-61 | A10 | Low | crisis.ts as used for CVs | CV-shaped false alarms at crisis level ("Volunteer at a suicide prevention helpline") | Open | No rule change; review with A10-27 and A10-53; the second press is the way through |
| A10-62 | A10 | Low | Mmereko /tailorings | The advert is untrusted text sent to Mmereko's model | Open | Mmereko: the advert in a marked data block, plus a shared injection fixture |
| A5-15 | A5 | Medium | apps/web/lib/server/mmereko.ts | Mmereko's PDF link was fetched from any https host and API calls followed redirects | Fixed | #90: no redirects; a link off Mmereko's origin must be https to a public host |
| A5-16 | A5 | Medium | apps/web/lib/server/mmereko.ts | Every Mmereko answer was read whole before any size check; PDF bytes unchecked | Fixed | #90: capped reader (2 MB JSON, 64 KB problems/token, 10 MB PDF), %PDF magic |
| A5-17 | A5 | Medium | mmereko.ts getJob → cv.ts collect | A job answer wasn't checked to be for the job and learner asked | Fixed | #90: refused on jobId/learnerRef mismatch |
| A5-18 | A5 | Medium | apps/web/app/cv/s/[token]/route.ts | The public share page had no abuse limit (§7.6) | Fixed | #90: 60 opens an hour per address (HMAC-keyed), bare 429 |
| A5-19 | A5 | Low | api/integrations/mmereko/webhook; api/messaging/[channel]/inbound | A chunked webhook was read whole before the 4 KB check (also messaging inbound) | Fixed | #112: lib/server/capped-body.ts reads up to the cap for both; tests send 1 MB chunked |
| A5-20 | A5 | Low | packages/cv/src/text.ts; 0035 uf_cv_link_ok | Trailing-dot hosts (`localhost.`) passed the private-host check | Fixed | #90 in code; the DB function still accepts them (defence in depth); Mmereko's validator should match |
| A5-21 | A5 | Low | api/me/cv/shares | No per-learner cap on share links | Fixed | #112: QUOTAS.cvShare, 20 a day; entry edits left as they are (CV-A5 asks for shares only) |
| A5-22 | A5 | Low | cv.ts signedPdfLink | PDF links signed with AUTH_SECRET (domain-separated), not a key of their own | Fixed | #112: HKDF-SHA256(AUTH_SECRET, universityflow:cv-pdf-link:v1); old-scheme links refused |
| A5-23 | A5 | Low | /cv/s/[token] (D5) | Share tokens in the URL path: host request logs hold live bearer tokens up to 90 days | Open | **Owner:** shorter log retention, or name it on the privacy page |
| A5-24 | A5 | Low | /cv/s/[token] | Link scanners and unfurlers count as views and follow to the PDF | Open | **Owner's call:** a click-through page or bot filtering |
| A11-35 | A11 | Medium | apps/web/lib/server/config.ts (readCv) | Nothing tied live Mmereko to the af-south-1 partner cell | Fixed | #95: production and live runs need `MMEREKO_REGION=af-south-1`. **Owner: set it only once Mmereko confirms in writing** |
| A11-36 | A11 | Medium | services.ts; cv-routes.ts sendCvDeletions; opt-in DELETE | If `UF_CV` is switched off after use, deletions never reach Mmereko and "Stop using Mmereko" is a 404 | Open | A "deletions only" engine state; owner decides |
| A11-37 | A11 | Medium | content cv.ts; fitting card; opt-in purposes | A fitted CV is written by Anthropic outside South Africa, but the opt-in card says "in South Africa" | Fixed (at point of use) | #95: `cv.tailor.aiNote`; the opt-in wording (cv-optin-v2) and a tick per purpose wait for the wording review |
| A11-38 | A11 | Medium | /api/me/cv/documents/[id] | A learner cannot delete one CV (D13) | Fixed | #107: DELETE (filtered to the learner, refuses one being made, PDF deleted, shares and report cascade), Delete with an in-page confirm on web and app; tests failed first |
| A5-25 | A5 | Medium | apps/web/lib/server/config.ts | Production has no switch to turn off the AI on its own (UF_PROVIDERS=local and Gemini are refused); in an incident the only levers are revoking the Anthropic key (untested for learners) or taking the site down (from the #110 runbook) | Open | An AI off switch that keeps the crisis card and helplines working, with a test; the owner may regrade |
| A5-26 | A5 | Low | packages/db/src/crypto.ts (suppressionHash) | Rotating AUTH_SECRET silently forgets every STOP from a number without an account (a guardian, say): suppressions are HMACs under it; no two-key rotation (security brief §2.5, the #110 runbook) | Open | AUTH_SECRET_PREVIOUS checked on read, with a test; the owner may regrade |
| CV5-01 | A11 | Low | cv_reports cascade | A report is deleted with its CV (and its account); only the id-only log line remains for the person reviewing it | Open | Decide with A11-23 (keep reports after deletion?) |
| CV5-02 | CV5 | Low | DELETE /api/me/cv/documents/[id] | The row is deleted before the PDF; a storage failure leaves an orphan file | Fixed (transient failures) | #112: deleteWithRetry, 3 tries; an outage longer than that can still orphan one (a sweep, or the file deleted inside the transaction, recorded not built); withdrawal and account deletion have the same order |
| A11-39 | A11 | Low | content cv.ts withdraw | Withdrawal text doesn't list everything deleted | Open | Proposed wording in CV-A11.md |
| A11-40 | A11 | Low | consent-v4-draft C7; en.privacyPage | v4 C7 leaves out name, contact details, university, modules; the privacy page doesn't name the CV | Open | Legal review; switch-on change |
| A11-41 | A11 | Low | api/me/cv/ats-scan | The ATS scan sent the advert with no ID-number refusal | Fixed | #112: 409 personal-number before the quota and the engine, as checkAdvert does |
| A11-42 | A11 | Low | 0035 uf_cv_preview() | The app's role can set `uf.cv` in any transaction | Open | With v4: the preview check returns false |
| A2-43 | A2 | Medium | web cv-view.tsx; app cv.tsx | CV errors showed only at the top of the page | Fixed | #95: in the card that raised them |
| A2-44 | A2 | Medium | web cv-entries.tsx, cv-documents.tsx | Add, Edit, Delete, Remove link and Switch off dropped focus to body | Fixed | #95 |
| A2-45 | A2 | Medium | app cv.tsx | Screen-reader focus didn't move when the preview opened/closed | Fixed | #95 |
| A2-46 | A2 | Medium | web globals.css | Long words and links scrolled sideways at 320px on /cv | Fixed | #95 |
| A2-47 | A2 | Medium | web cv-documents.tsx; app preview | The CV preview shows raw Markdown (`#` read aloud) | Fixed | #107: packages/ui cvTextBlocks (Mmereko's own subset, safe_render.py at ca855f2), web h3–h5/ul/p, app headers and bullet lines; tests failed first |
| A2-48 to A2-50 | A2 | Low ×3 | /cv web and app | Make/Fit did nothing before ready; progress dots pulsed forever (2.2.2); a hint read twice | Fixed | #95 |
| A2-51 | A2 | Low | StatusLine (web) | A repeated outcome wasn't re-announced | Fixed (web) | #113: useStatus and StatusLine said, guarded on every StatusLine; the app's useAnnounce not touched |
| A2-52 | A2 | Low | CV forms; API errors | Refusals didn't name the field | Partly fixed | #113: handler passes a refusal's field path, ApiError.field, the CV forms mark the named field. Owed: packages/db's PersonalNumberError (cv.ts checkText) to set field |
| A2-60 | A2 | High | globals.css; (app)/me/profile-photo.tsx | At 360px the sample-photo fieldset grew to 488px and cut off photos and the Photo group (1.4.10) | Fixed | #92: `fieldset { min-inline-size: 0 }` |
| A2-61 | A2 | Medium | lib/server/demo/personas.ts | Thabo's and Lerato's goal pack link was a 404 (goal not shortlisted) | Fixed | #92 |
| A2-62 | A2 | Medium | demo personas (Amahle) | Her next step was a closed Wits application | Fixed | #92 |
| A2-63 | A2 | High | components/marks-chart.tsx | The chart drew all 8 report kinds and widened homes to 410px at 360 | Fixed | #92: axis = `chartKinds` (production too) |
| A2-64 | A2 | Medium | app/not-found.tsx (new) | Next's built-in 404 broke the theme and failed contrast | Fixed | #92: our own page |
| A2-65 | A2 | Medium | site footer | Judges see "Owner to fill" in the ECTA s43 footer | Open | **Owner** supplies the facts |
| A2-66 | A2 | Medium | dashboard (university stage), chat welcome | 2nd- and final-year students got an arriving student's home and a chat asking for a school report | Fixed | #106: universityYear (ui) from the registration's year of study and the catalogue's duration; later-year home, journey, next step, chat welcome and starters, web and app; tests in ui, content, web, native. Wording owed review |
| A2-67 | A2 | Low | demo banner | "Switch learner" on signed-out pages | Fixed | #106: shown only while a learner is signed in (demoLearnerSignedIn in the root layout) |
| A2-68 | A2 | Low | applications | an empty shortlist state at university | Fixed | #106: applications.atUniversity with a link to My modules |
| A2-69 | A2 | Low | ui nextAction | next step points at a closed window | Fixed | #106: an unfinished application whose published window closed is skipped |
| A7-20 | A7 | Low | apps/native/app/plan-map.tsx | A plan map's status words couldn't wrap at 320 dp | Fixed | #91 |
| A7-21 | A7 | Medium | apps/native/app.config.ts | An EAS build without `UF_EAS_PROJECT_ID` went on with no project id | Fixed | #91 |
| A7-22 | A7 | High | apps/native/eas.json, package.json | The development profile wasn't a dev client (no `developmentClient`, no `expo-dev-client`) | Fixed | #91: both; a new app build is needed |
| A7-23 | A7 | Medium | en.permissions; app.config.ts | Camera/photos purpose strings named only documents (App Store 5.1.1 if the photo is ever on) | Fixed | #111: the wording names a photo of yourself for the profile and the offer letter; config test. Owed: the owner's wording review and a new app build |
| A1-40 | A1 | Low | packages/db/src/testing.ts | The real-Postgres suite couldn't run twice on one database | Fixed | #94 |
| A1-41 | A1 | High | Mmereko partner/tables.py | `audit_logs.ip_address` inet vs Text: every audited write fails on Postgres (the partner cell couldn't take a job) | Fixed | Mmereko #5 (real Postgres 17: 67/67) |
| A1-42 | A1 | Medium | Mmereko partner/store.py | The test engine shared one SQLite connection; the worker-loop test failed every time on Python 3.11 | Fixed | Mmereko #5 |
| A1-43 | A1 | Low | Mmereko test_store.py | Two tests used idempotency keys the CHECK refuses | Fixed | Mmereko #5 |
| **S1 session 7, wave 4 (2026-10-24)** | | | | | | |
| A1-50 | A1 | Medium | config.ts readConfig | Production started without its own https `UF_PUBLIC_URL`: every guardian and SMS link pointed at localhost | Fixed | #98 |
| A1-51 | A1 | Medium | packages/db client.ts; RDS TLS | `sslmode=require` is verify-full in pg 8, and RDS's CA isn't trusted by default: the first production connection may fail | Open | Prove from the production project; RDS CA bundle (or `DATABASE_CA_CERT`, #102), never no-verify |
| A1-52 | A1 | Low | readConfig; NEXT_PUBLIC_UF_DEMO_URL | Production would show a "Demo for judges" link if set | Open | Owner: leave unset; refuse it in the hackathon undo PR |
| A1-53 | A1 | Critical | migrations 0001/0002 | On PG16+ a non-superuser owner (Supabase, likely RDS) can't `SET ROLE uf_app`: every learner query fails | Fixed | #102, migration 0038 (migrate() still refuses with UF_LEARNER_ROLE if it can't); confirm on RDS at its first deploy |
| A1-54 | A1 | High | packages/db migrate() | Concurrent cold starts on a fresh database crashed each other's migrations (5 of 6) | Fixed | #102 |
| A1-55 | A1 | High | turbo.json | Turbo 2's strict env dropped `TEST_DATABASE_URL`: CI skipped every real-Postgres test | Fixed | #102 |
| A1-56 | A1 | High | Supabase project (demo) | The Data API's anon key had grants on new tables; two tables had no RLS | Fixed | #102, migration 0038; Data API off as belt and braces |
| A1-57 | A1 | Medium | config.ts (demo) | A demo connected to a remote Postgres in plaintext | Fixed | #102: TLS required, `DATABASE_CA_CERT` |
| A2-70 to A2-75 | A2 | High ×1, Medium ×2, Low ×3 | demo entry | Raw JSON 500 on a refused configuration; ConfigError logged without its reason; the landing page didn't say it's a demo; dead-end /demo/sign-up; Firebase errors; sign-out left the copy | Fixed | #99 |
| A11-50 | A11 | Low | consent-v4-draft C5; 0037 | A photo stored under older wording (preview only) is kept unshown, not deleted | Open | Lawyer's question C5(c) |
| A11-51 | A11 | Medium | UF_DEMO_REAL_PHOTOS (demo) | Hackathon exception: real visitors' faces in the demo database; age unknown on persona copies | Open | Owner-approved; undo after judging (hackathon-undo-pr.md D); safer: own uploads on 18+ sign-up accounts only |

### Research findings (2026-10-22): the full list

The owner graded them on 2026-10-22: L-1 to L-5 are A11-19 to A11-23 (High), SEC-02 is A5-08
(High) and SEC-04 is A5-09 (Medium, fixed) in the gate table above, under the audits they belong
to (the suite's gate reads only audit IDs); the rest stay here until worked on.

From two briefs commissioned by the owner: [legal and regulatory](docs/research/2026-10-22-legal-and-regulatory-brief.md)
and [security](docs/research/2026-10-22-security-brief.md). Not legal advice. Each brief opens
with what the commissioning session checked. **The owner decides which become gate findings
(and their severity).**

| ID | Severity (proposed) | Finding | Who |
|---|---|---|---|
| L-1 | High, Critical if it applies | **POPIA s57 prior authorisation** may be needed before children's information goes to Anthropic (US); the Regulator may take up to 4 + 13 weeks, so for a 1 March 2027 launch, decide and file by **early November 2026** | Legal → owner |
| L-2 | High | Accountability: no named responsible party, information officer not registered, no PAIA manual, no privacy page, no ECTA s43 footer (A11-10) | Owner, legal, code |
| L-3 | High | Special personal information in chat (health, abuse disclosures): consent v3 doesn't name it; the store forms say "Health" and "Sensitive info" aren't collected | Legal, code |
| L-4 | High | Proving a competent person consented: the link goes to any number the learner types | Legal, code |
| L-5 | High | Mandatory reporting (Sexual Offences Act s54; Films and Publications Act s24C): a safeguarding policy and lead | Legal, owner |
| L-6 | Medium–High | **Anthropic Usage Policy from 12 Nov 2026** (confirmed): AI disclosure in each chat for minors, a child-safety prompt, a public compliance statement; high-risk areas "Education and credentials" and "Public benefits" need a qualified human: keep the AI out of eligibility decisions (NSFAS, gate H3) | Code, legal |
| L-7 | Medium | Consent v4: AI-provider retention, sensitive information, studios, "until they turn 18"; "agree ahead" probably guardian-assisted | Legal |
| SEC-01 | **Unverified** | The brief's Next.js/React advisories could not be found (GitHub Advisory DB: `next` 16.3.8 is patched for every listed advisory; the React id returns 404). Upgrade to 16.4.x as housekeeping | Code |
| SEC-02 | High | No incident-response plan or s22 breach runbook (eServices portal, notices, register) | Owner (Claude can draft) |
| SEC-03 | High | No vulnerability scanning while Actions has no minutes; run `pnpm audit --prod` weekly by hand meanwhile | Owner |
| SEC-04 | Medium (confirmed) | Wrong-PIN count restarts with each PIN: ~1,440 guesses a day at one number (NIST 800-63B rev 4 forbids the reset) | Code |
| SEC-05 | Medium | No SIM-swap / recycled-number defence; no "sign out everywhere" or new-device notice | Code, owner |
| SEC-07, 08, 10, 12, 13 | Medium | DB connects as table owner; no external pen test planned; no bot protection; no backup/restore plan; AWS baseline at connection | Code, owner |
| SEC-09, 15–18 | Low | security.txt; the report reader's "data, not instructions" line; memory poisoning; `__Host-` cookie; re-authentication for export/delete | Code |

---

## Open questions

See [planning.md §15](planning.md#15-open-questions). Q9, Q16 and Q17 are answered. Q7 (NSC only?
IEB?) is effectively "NSC only for now" in the data. Q8 (TVET in Plan B) is partly answered:
diplomas and extended programmes are in Plan B; TVET colleges themselves aren't in the catalogue yet.

---

## Test ledger

| Phase | Suite | Result | Tests | Date |
|---|---|---|---|---|
| 6 | **S1 session 9, second half, GitHub CI per PR** (lint, guards, typecheck, unit, builds, budgets, E2E main, red team 18/18, secret scan, pnpm audit) **plus locally**: #129 demo E2E 41+6, real Postgres 577/577, real S3 303/303; #131 demo 41+6, journey 10/10; #132 E2E main 25/25, demo 40+6, production rehearsal 6/6; #133 E2E main 31/31, demo 42+6, production rehearsal 6/6; check:test 188, typecheck 15/15; native bundles +110 KB of their 5% | ✅ pass | 3,900+ | 2026-10-24 |
| 6 | **S1 session 9, each PR rebased on main and gated alone, uncached:** lint, guards, check:test 186, typecheck 15/15; 6a (#123): admissions 299 · catalogue 555 · content 162 · native 470 · web 1867 (+36 skipped); 6b (#124): documents 302 (+11 skipped) · db 565 (+43 gated) · web 1887 (+36 skipped) · content 167 · evals 18 (**red team 100%**) · results-generator 56; **real Postgres 565/565, real S3 302/302**; web build, root chunks 127.8 KB, client chunks clean, native +48.4 KB (within 5%); **E2E main 25/25, demo 40/40 + 6/6, production rehearsal 6/6** with axe | ✅ pass | 3,700+ | 2026-10-24 |
| 5 | **Wave 4 on `phase-5/wave-4-int2` (= main at #102), uncached:** lint, guards, check:test 173, typecheck 15/15; db 480 (+42 gated) · web 1510 (+36 skipped); earlier on wave-4-int: native 455 · content 143 · documents 234 · evals 18 (red team 100%); **real Postgres 17 522/522 (to 0038), real S3 245/245**; build; root chunks 127.8 KB; **E2E main 23/23, demo 31/31, production rehearsal 6/6** with axe. Two runs stalled (a 30 s timeout after ~62 min; a browser launch timeout): re-run clean | ✅ pass | 2,026 | 2026-10-24 |
| 5/6 | **S1 session 7 (wave 3), the ten branches merged on `phase-5/wave-3-int`, uncached, one package at a time** (db and web `--maxWorkers=2`): lint, guards, check:test 81, typecheck 15/15; web 1419 (+32 skipped) · native 452 · db 459 (+40 skipped) · agent 390 (branches 91.87%) · catalogue 378 · messaging 311 · tokens 285 · admissions 241 · documents 234 (+10 skipped) · content 136 · cv 118 · ui 106 · results-generator 51 · jobs 41 · evals 18 (**red team 100%**); **real Postgres 17.11: db 499/499 (to migration 0036); real S3 (SeaweedFS 4.48): documents 244/244**; coverage catalogue 100% · admissions 99.85% · messaging 98.8%; web build; root chunks 127.8 KB; client chunks clean; native +22.9 KB (within 5%); **E2E main 23/23, demo 22/22** with axe. #96 (the front-door pictures) re-verified on top: web suite, build, budgets, E2E main and demo | ✅ pass | 4,639 | 2026-10-23 |
| 5 | **`phase-5/grade-10`, S1 session 5 (ten agents), after each merge, uncached:** lint, guards, check:test 78, typecheck 14/14; web 931 · native 397 · db 374 (+32 skipped) · documents 221 (+10 skipped) · catalogue 373 · tokens 285 · ui 105 · content 103 · agent 257 · results-generator 47 · evals 18 (**red team 400 cases, 100%**), one at a time (db and web `--maxWorkers=2`); the packages no agent touched as at 98a752b (admissions 215 · messaging 311 · jobs 41); web build; root chunks 127.8 KB; client chunks clean; **E2E 22/22** with axe; **native bundles ✗ +15.4% / +16.6% (A4-18, owner's call)** | ✅ pass but the native budget | 3,678 | 2026-10-23 |
| 5 | **`phase-5/grade-10` at 2a24290 (every open S1 Low), uncached:** lint, guards, check:test 74, typecheck 13/13; web 667 · db 334 (+32 skipped) · native 339 · catalogue 345 · messaging 311 · agent 257 · admissions 205 · documents 170 (+10 skipped) · tokens 135 · content 73 · jobs 41 · ui 40 · evals 15 (**red team 100%**), one at a time (db and web `--maxWorkers=2`); web build; root chunks 127.8 KB; client chunks clean; native bundles +3.8%; **E2E 14/14** with axe | ✅ pass | 2,932 | 2026-10-22 |
| 5 | **`phase-5/grade-10` at bf483ee (A11-25, A10-35), uncached:** lint, guards, typecheck 13/13 (0 cached); web 661 · db 330 (+32 skipped) · native 336 · content 73 · ui 40 · evals 15 (**red team 100%**), one at a time (db and web `--maxWorkers=2`); the packages this round didn't touch as at 63c7608 (catalogue 343 · messaging 311 · agent 254 · admissions 205 · documents 170 · tokens 135 · jobs 41); web build; root chunks 127.8 KB; client chunks clean; native bundles +3.8%; **E2E 14/14** with axe | ✅ pass | 2,914 | 2026-10-22 |
| 5 | **`phase-5/grade-10` at 63c7608 (S1's six Mediums and the E2E address fix), uncached:** lint, guards, check:test 74, typecheck 13/13 (0 cached); web 650 · db 322 (+32 skipped) · native 332 · catalogue 343 · messaging 311 · agent 254 · admissions 205 · documents 170 (+10 skipped) · tokens 135 · content 71 · jobs 41 · ui 40 · evals 15 (**red team 100%**), one package at a time (db and web `--maxWorkers=2`); catalogue coverage 100% lines; web build; root chunks 127.8 KB; **E2E 14/14** with axe, twice | ✅ pass | 2,889 | 2026-10-22 |
| 5 | **`phase-5/grade-10`, G10-5 (the words and the agent), uncached:** lint, guards, check:test 74, typecheck 13/13; web 646 · db 317 (+32 skipped) · native 327 · agent 250 · content 70 · the other 8 packages · evals 15 (**red team 100%**); web build; root chunks 127.8 KB; client chunks clean; **E2E 13/13** with axe | ✅ pass | 2,867 | 2026-10-22 |
| 5 | **`phase-5/grade-10`, G10-4 (Stage 0 on the home), uncached:** lint, guards, check:test 74, typecheck 13/13; web 645 · db 317 (+32 skipped) · native 326 · admissions 205 · catalogue 341 · agent 246 · messaging 311 · documents 169 · tokens 135 · content 68 · jobs 41 · ui 40 · evals 15 (red team 100%); web build; root chunks 127.8 KB; client chunks clean; **E2E 13/13** with axe | ✅ pass | 2,859 | 2026-10-22 |
| 5 | **`phase-5/grade-10` at a4c6bf6 (G10-1), uncached:** lint, guards, check:test 74, typecheck 13/13; web 626 · db 317 (+32 skipped) · native 319 · the other 10 packages (red team 100%) | ✅ pass | 1,262 + 10 packages | 2026-10-22 |
| 5 | **`phase-5/grade-10` at 27a0d83 (G10-2, G10-3), uncached:** web 624 · db 314 · native 314 · the other 10 packages (red team 100%) | ✅ pass | 1,252 + 10 packages | 2026-10-21 |
| 5 | **`phase-5/design-refresh` at 67782a8 (the app's one rhythm):** lint, guards, native typecheck; native 310; native bundles iOS 2863.2 KB (+3.0%), Android 3096.7 KB (+2.8%) | ✅ pass | 310 | 2026-10-21 |
| 5 | **`phase-5/design-refresh` at f65fb36, the whole gate uncached** (fresh worktree, fresh install, 0 cached): lint, guards, check:test, typecheck; web 600 · catalogue 329 · db 311 (+32 skipped) · messaging 311 · native 303 · agent 244 · admissions 190 · documents 169 (+10 skipped) · tokens 135 · content 68 · jobs 41 · ui 34 · evals 15 (red team 100%); coverage catalogue 100% · admissions 99.6% · messaging 98.8%; all builds; root chunks, client chunks, native bundles; **E2E 10/10** with axe | ✅ pass | 2,750 | 2026-10-21 |
| 5 | **`phase-5/design-refresh` at 24214f2 (one rhythm):** lint, guards, check:test, web typecheck; web 600 (`--maxWorkers=2`); the web build; root chunks 127.8 KB; client chunks clean; **E2E 10/10** with axe | ✅ pass | 610 | 2026-10-20 |
| 5 | **`phase-5/design-refresh` at 05eef80 (the app's home and chat):** lint, guards, check:test, typecheck 13/13 (no cache); ui 34 · web 584 · native 303; web and native builds; root chunks 127.8 KB; client chunks clean; native bundles iOS 2863.1 KB (+3.0%), Android 3096.5 KB (+2.8%); **E2E 10/10** with axe. One earlier web run lost three workers to V8 "out of memory: Zone" and passed whole on the re-run | ✅ pass | 921 | 2026-10-19 |
| 5 | **`phase-5/design-refresh` at b52a323 (the owner's review items):** lint, guards, typecheck (web, content), web 604, content 68, the web build, root chunks 127.8 KB, client chunks clean, /help 134.9 KB, **E2E 10/10** with axe through the phone menu | ✅ pass | 672 | 2026-10-19 |
| 5 | **`phase-5/design-refresh` at 5d63711, the whole gate uncached** (fresh worktree, fresh install): lint, guards, check:test 74, typecheck; web 598 · catalogue 329 · db 311 (+32 real-Postgres skipped) · messaging 311 · native 286 · agent 244 · admissions 190 · documents 169 (+10 S3 skipped) · tokens 135 · content 68 · jobs 41 · evals 15 (red team 100%) · ui 11, one package at a time; coverage catalogue 100% · admissions 99.6% · messaging 98.8%; all builds; root chunks 127.8 KB; client chunks clean; native bundles +2.0% (iOS 2836.3 KB, Android 3070 KB); **E2E 10/10** with axe | ✅ pass | 2,708 | 2026-10-19 |
| 5 | **CI's "Static · Unit · Build" job on Linux, in Docker with `act` 0.2.89** (catthehacker/ubuntu:act-latest, Postgres 17 service), at 7e9fe11, from a fresh clone: every step green, the same 2,512 tests, coverage, build, root chunks, page copy, native bundles within 5% of the Windows baseline. Two changes in the throwaway clone only: no host port for Postgres (5432 is another project's), and tests `--concurrency=1` (run all at once, the app's Jest suites timed out at 20 s in Docker's VM on this laptop: gotcha 39, not a Linux fault). The 32 real-Postgres db tests skipped there (the URL didn't reach them); they last ran 32/32 at migration 0023 | ✅ pass | 2,512 | 2026-10-19 |
| 5 | **`phase-5/stack` with 5e-1 to 5e-4, no cache:** web 520 · catalogue 329 · db 311 (+32 real-Postgres skipped) · messaging 311 · native 286 · agent 244 · admissions 190 · documents 169 · content 68 · jobs 41 · tokens 37 · evals 15 (red team 100%, with safety cases) · ui 11; lint, guards, check:test 74, typecheck 13/13; **coverage** (CI's step, now in the local gate): catalogue 100% · admissions 99.6% · messaging 98.8%; both builds; root chunks 127.8 KB; page copy clean; native bundles +1.7% (iOS 2825.9 KB, Android 3059.6 KB); **E2E 10/10** with axe | ✅ pass | 2,512 | 2026-10-19 |
| 5 | **`phase-5/stack` after the second round, no cache:** web 499 · db 311 (+32 real-Postgres skipped) · messaging 311 · catalogue 297 · native 265 · agent 230 · admissions 190 · documents 169 · content 60 · jobs 41 · tokens 37 · evals 11 (red team 100%) · ui 4; lint, guards, check:test, typecheck 13/13; both builds; root chunks, page copy and the native bundle budget (iOS 2797.7 KB, Android 3031.5 KB, +0.6%) pass; **E2E 10/10** with axe. One package at a time | ✅ pass | 2,425 | 2026-10-17 |
| 5 | **`phase-5/stack` after the finishing session, no cache:** web 497 · messaging 311 · db 311 (+32 real-Postgres: **32/32 on Postgres 17** in a throwaway container) · catalogue 293 · native 262 · agent 228 · admissions 190 · documents 169 · content 56 · jobs 41 · tokens 37 · evals 11 (red team 100%) · ui 3; lint, guards, check:test 58, typecheck 13/13; both builds; root chunks 127.8 KB; **E2E 10/10** with axe. One package at a time (web re-run alone after its two test fixes) | ✅ pass | 2,409 | 2026-10-17 |
| 5 | **`phase-5/stack` after every audit fix, no cache:** web 473 · agent 228 · native 225 · messaging 311 · db 302 (+31 real-Postgres skipped) · catalogue 292 · admissions 190 · documents 169 · content 55 · jobs 41 · tokens 37 · evals 11 (**red team 323, 100%**) · ui 3; lint, guards, check:test, typecheck; both builds; **E2E 10/10** with axe (now also on /campus, /first-week and the letter form). One package at a time | ✅ pass | 2,337 | 2026-10-17 |
| 5 | **Integration trial** (`main` at #76 + #73 + #77 + #78, conflicts resolved): web 442 · native 208 · messaging 310 · catalogue 286 · db 257 (+31 real-Postgres skipped) · agent 203 · admissions 177 · documents 169 · content 49 · jobs 41 · tokens 33 · evals 11 (red team 214, 100%) · ui 3; typecheck, guards, lint, both builds; **E2E 10/10** with axe (adds the offers and registration journeys). Tests one package at a time (gotcha 39) | ✅ pass | 2,189 | 2026-10-17 |
| 4 | **The Low sweep, the last branch (#64) on `main` with #58, #62, #63, #65 merged:** web 352 · native 165 · messaging 309 · db 228 (+28 real-Postgres skipped) · admissions 129 · catalogue 234 · agent 129 · documents 110 · jobs 41 · content 39 · tokens 33 · ui 3 · evals 6 (red team 100%); 26/26 tasks; both builds, no Android font over 100 KB; **E2E 8/8** with axe | ✅ pass | 1,778 | 2026-10-16 |
| 4 | `evals`: **crisis red team, 165 cases, 100%** (47 added by A10, each failing first) | ✅ pass | 6 | 2026-10-14 |
| 4 | `pnpm verify` baseline before the audits (after a stale local install was refreshed) | ✅ 26 + 2 tasks | — | 2026-10-14 |
| 4 | **E2E** with axe, against each fix branch's production build (#38, #39, #40) | ✅ pass | 8 | 2026-10-14 |
| 4 | After every fix merged (#39's branch with #35–#38, #40 in): `web` 249 · `native` 129 · `agent` 122 · `content` 27; E2E 8/8 | ✅ pass | 527 | 2026-10-14 |
| 4 | Root chunk budget (`scripts/ci/root-chunk-budget.mjs`): failed on the old build (216 KB, zod locales), passes at 128 KB | ✅ pass | 3 | 2026-10-14 |
| 0 | Guard tests (`node --test`): 5 guards, the owed-checks script, the verification checklists | ✅ pass | 32 | 2026-10-13 |
| 0 | actionlint on all four workflows · gitleaks over the full history | ✅ clean | — | 2026-10-13 |
| 3 | `documents` S3 contract against a real S3-compatible server (SeaweedFS, `TEST_S3_ENDPOINT`) · `db` incl. a 12-way budget race on real Postgres 17 | ✅ pass | 96 · 72 | 2026-10-13 |
| 0 | `native` (Jest + RNTL) and iOS + Android bundles | ✅ pass | 2 | 2026-10-13 |
| 1 | `catalogue`: schemas, every record validates and is a draft, official-domain sources, the view gate (100% coverage) | ✅ pass | 138 | 2026-10-13 |
| 1 | `admissions`: pass types, engine, every university method incl. prospectus worked examples, eligibility, results (99.5% coverage) | ✅ pass | 94 | 2026-10-13 |
| 2 | `db` on PGlite: sign-in, sessions, consent gate (data layer *and* database), RLS isolation, audit log, rate limits, export/delete, audit regressions | ✅ pass | 55 | 2026-10-13 |
| 2 | `db` on real Postgres 17 via `pg` (`TEST_DATABASE_URL`; CI service) | ✅ pass | 3 | 2026-10-13 |
| 2 | `documents`: subject normalisation, drafts, confirmation schema, uploads, storage contract | ✅ pass | 59 | 2026-10-13 |
| 2 | `agent`: prompt, tools, runner (crisis, concern, refusal, failure), stand-in | ✅ pass | 31 | 2026-10-13 |
| 2 | `evals`: **crisis red-team, 64 cases, 100%** | ✅ pass | 4 | 2026-10-13 |
| 2 | `messaging` (SMS contract), `tokens` (every pair WCAG AA), `content` (no admission promises) | ✅ pass | 16 · 27 · 5 | 2026-10-13 |
| 3 | `web`: API integration over real handlers + PGlite (sign-in, CSRF, consent end to end, upload → confirm → results, chat incl. crisis, Stage 2, export/delete, audit regressions), config, components | ✅ pass | 35 | 2026-10-13 |
| 3 | **E2E** (Playwright, Pixel 7, production build) with **axe WCAG 2.2 AA** on every key page: adult journey to an application pack; crisis; minor + guardian consent; CSP nonces (every journey also fails on any CSP violation) | ✅ pass | 4 | 2026-10-13 |
| 3 | **`main` after #10, uncached, twice:** web 98 · native 63 (sign-in, onboarding, results, chat, API client, session, NDJSON, theme) · and the rest as below | ✅ pass | 648 | 2026-10-13 |
| 3 | **Whole stack, uncached:** web 88 · documents 86 · db 68 · admissions 96 · catalogue 138 · messaging 31 · agent 31 · tokens 27 · content 5 · evals 4 · ui 1 · native 2 | ✅ pass | 577 | 2026-10-13 |

## Gotchas

| # | Gotcha |
|---|---|
| 1 | **PowerShell 5.1's `Set-Content -Encoding utf8` writes a byte-order mark**, and `Get-Content -Raw` reads UTF-8 as ANSI (mangling `–`, `§`, `→`). Write and transform files with the file tools or Node |
| 2 | **`node --test <directory>` fails with MODULE_NOT_FOUND.** Pass a quoted glob: `node --test "scripts/checks/*.test.mjs"` |
| 3 | **Vitest 4 compiles with oxc, not esbuild,** so `esbuild: { jsx }` in a config is silently ignored. Use `@vitejs/plugin-react` for JSX tests |
| 4 | **Coverage below threshold from an "unreachable" line** is a design smell. Restructure so the line doesn't exist rather than lowering the bar |
| 5 | **`jest-expo` 57.0.5 breaks on React Native 0.86.2**: pinned to 57.0.4. Revisit only with an Expo SDK upgrade |
| 6 | **Switching `node-linker` needs a clean `node_modules`.** |
| 7 | **Drizzle sends prepared statements**, which can't hold several statements: migrations go through `Database.exec` (PGlite `exec`, `pg` simple query) |
| 8 | **Throwing inside a Drizzle transaction rolls back everything in it**, including a failure you meant to record. Return the outcome, commit, then throw |
| 9 | **Next 16 bundles route handlers and pages into separate chunks.** A module-level singleton exists once per chunk: keep process-wide state on `globalThis` |
| 10 | **Tailwind v4: unlayered CSS beats utilities regardless of specificity.** Base element styles go in `@layer base` |
| 11 | **PGlite creates only the last folder** of an on-disk path; create parents first |
| 12 | **Biome formats generated CSS** (`tokens.css`) and breaks the freshness test: it's excluded in biome.json |
| 13 | **An E2E run needs a production build** (`pnpm --filter @universityflow/web build`) and sets `UF_LOCAL_PRODUCTION_BUILD=1`; any other production build refuses the stand-ins |
| 14 | **Shared packages gain dependencies the mobile app must list too** (Metro resolves from the app): adding `catalogue` to `admissions` broke the iOS bundle until `apps/native` depended on it. Now a guard. **Run the gate on each stacked branch from its own clean install**: a `node_modules` left over from a later branch hides it |
| 15 | **Zod v4 probes `Function("")`, which a CSP without `'unsafe-eval'` reports as a violation** on every page. `z.config({ jitless: true })` in `apps/web/instrumentation-client.ts` (browser only). Not in `catalogue`: on the server it slowed a cold first request from ~6 s to 8–9 s |
| 16 | **A nonce reaches only pages rendered per request.** `/_not-found` was prerendered until the root layout awaited `connection()` |
| 17 | **`proxy.ts` buffers request bodies and caps them at 10 MB.** Keep `/api` out of its matcher |
| 18 | **The first write of an E2E run takes 6–9 s** (it opens and migrates the empty embedded database), longer than Playwright's 5 s default. `signIn` waits 15 s. On a machine busy with other test suites the first PIN can take longer still: re-run on a quiet machine before blaming the change |
| 19 | **MinIO images can't be pulled anonymously any more.** Local S3 is SeaweedFS: credentials as `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env vars (its `-s3.config` flag was ignored), plus `WEED_S3_SSE_KEY` for SSE-S3. Recipe in `.env.example` |
| 20 | **`postgres.test.ts` fails on a second run against the same database** (its synthetic phone counter restarts and hits the PIN limit). Use a fresh throwaway database per run |
| 21 | **Agent worktrees start from `main`, not the current branch.** Brief agents with the exact base SHA and have them branch from it |
| 22 | **GitHub Actions: the `secrets` context isn't available in `if:`.** Resolve it into a step output and test that, or the whole workflow fails at parse |
| 23 | **Builds and tests in one Turbo run starve each other.** With three builds (Next, two Expo bundles) alongside, native Jest suites took 80 s each and timed out. `pnpm verify` runs typecheck and tests, then builds, as CI does |
| 24 | **`setup-node` v5 turns on package-manager caching when `package.json` names one**, and fails without pnpm. Node-only jobs set `package-manager-cache: false` |
| 25 | **Squash-merging stacked PRs:** after each squash, check `main`'s tree equals the next branch's base, then `git merge -s ours origin/main` into it: the PR diff stays exact, no force-push |
| 26 | **A native sign-in must not get a cookie:** the phone's cookie jar replays it, and the native pre-auth rule (no Cookie) then refuses the next sign-in. The app also sends `credentials: 'omit'` |
| 27 | **`EXPO_PUBLIC_*` is inlined only when written literally** (`process.env.EXPO_PUBLIC_X`); Turbo's build env lists `EXPO_PUBLIC_*` so a new URL rebuilds the bundle. A release Android build refuses plain `http` |
| 28 | **The app's tsconfig has no DOM lib**: `TextDecoder`/`TextEncoder` need local declarations. Jest doesn't map `@/…` aliases, so the app imports relatively |
| 29 | **PowerShell 5.1 splits a quoted multi-line `git commit -m` / `-F -` message into pathspecs.** Write the message to a file (scratchpad) and `git commit -F <file>`; same for `gh pr create --body-file` |
| 30 | **The Agent tool's `isolation: "worktree"` refuses on this machine** (a path-case redirect). Create sibling worktrees by hand (`git worktree add -b <branch> ../UniversityFlow-<name> origin/main`) and give each agent its path. `gh pr merge --delete-branch` then can't delete those worktrees (path too long inside `node_modules`): remove them with `git worktree remove --force` after, **then check the folder is gone** (`rmdir /s /q` it if not): on 2026-10-20 the remove unregistered the worktree but left its folder, and the next `worktree add` to that path failed |
| 31 | **E2E and tests that run the reminder job "tomorrow at 10:00" land inside real NSC sessions in October and November**, and a learner with no subjects is held then (A12-03). Use 18:00 SAST: after every paper and its margin, before quiet hours |
| 32 | **A stale local `node_modules` makes `next build` fail with "Can't resolve '@universityflow/…'".** `pnpm install --frozen-lockfile` relinks the workspace; CI is unaffected |
| 33 | **`documents`' sharp resize tests run close to Vitest's 5 s default on a slow CI runner** (two timed out on #39, green on re-run). Give them their own timeout, as the catalogue sweep has, if it happens again |
| 34 | **`next dev` after production builds in the same folder can answer 404 on API routes** (every `/api/auth/*` did, while `/api/me` worked). Stop the server, delete `apps/web/.next/dev`, start again |
| 35 | **.NET file APIs (`[IO.File]::WriteAllText`) resolve relative paths against the process's folder, not PowerShell's `Set-Location`.** An agent's edit landed in the main checkout that way. Agents in worktrees use absolute paths for every write |
| 36 | **Parallel agents share the scratchpad**: one overwrote another's `commit-msg.txt`. Give each agent's files a unique prefix. Parallel branches that each add a migration all pick the same number: renumber at merge, in merge order |
| 37 | **Truncating `git push`'s output (`Select-Object -First N`) kills the push with SIGPIPE (exit 141)** after the pre-push hook passes and before anything uploads. Log push output to a file instead |
| 38 | **A guard merged mid-sweep fails the sibling branches.** #58's `env-documented` failed the native branch on a variable it had added. After merging a new `main` into each branch, run `pnpm check` (and the affected tests) before pushing. Likewise an E2E that proves "nothing more arrives" by comparing the last message breaks when a confirmation is added: assert the confirmation, then nothing after it |
| 39 | **`turbo run test` at default concurrency starves on this machine:** the embedded-Postgres suites (db, web) time out at ~40–60 s each beside everything else while they pass alone. `--concurrency=4` didn't help. **Fixed in the hook (2026-10-17):** pre-push now runs every package except db and web in parallel, then db and web one at a time (`--concurrency=1`); together they still run every package, so `--no-verify` is no longer needed. A new database-heavy package belongs in the second run. Suites that run whole (the red team, the review seed) get their own timeouts (#76) |
| 40 | **A schema that requires a field pushes research to guess it.** The registration calendar required an opening date, so UP's draft carried the start of the academic year as one; curricula required a term, so 85 TUT modules got a guessed "Y". Make fields optional when sources may not print them, and have the generator say "not published". Review research diffs for values that read like defaults |
| 41 | **GitHub Actions can stop starting jobs for billing** ("recent account payments have failed or your spending limit needs to be increased"): every job fails in ~3 s with no steps and no log. `gh run view <id>` shows the annotation. Only the owner can fix it; nothing merges meanwhile. The same happens when the month's minutes run out: then build on a stacked branch (`phase-5/stack`), merge each fix branch into it, and verify the whole stack locally before one PR to `main` |
| 42 | **A green test run can be a cached one.** Two messaging tests failed on 5b's branch for days while several reports said "messaging green": Turbo replayed earlier results. Before calling a suite green after a merge, run it with `--force` (or `vitest run` directly), especially the packages the merge touched |
| 43 | **Two kinds of flaky test showed up only in the full run.** (1) "No nine-digit run in the logs" (no phone number) failed on a random UUID with nine digits in its last group: use `expectNoPhoneNumber` (apps/web/test/no-phone.ts), which blanks IDs first. The same with words: a "no fee" check matched a UUID's `dfeeec8b` (2026-10-19): blank IDs with `withoutIds` before any word check on JSON. (2) `useFocusAfter` moves focus in an effect after the render: a test that waits only for the new element to *render* and then acts can lose focus to the late move on a loaded machine. Wait for focus itself (`waitFor(() => expect(document.activeElement).toBe(el))`). The repo's `no-real-pii` guard rejects mobile-looking numbers even in tests: use an 080 number |
| 44 | **The verification checklists depend on today's date** (5e-3): a safety note past its `validUntil` is rendered "Expired: re-check", so the committed checklists go out of date on the day after a note expires and `check:test`'s drift test fails on every branch until someone re-reads the page, updates the note and runs `pnpm verification:checklists`. First date: **2027-01-16** (UJ's notes, read 2026-10-17). Deliberate, so a re-check can't be missed; the owner may prefer a non-blocking reminder. Also: CI's coverage step (`test:coverage`, 90% floor) wasn't in the local gate before 2026-10-19; it is now |
| 45 | **A web test worker can die with V8 "Fatal process out of memory: Zone"** ("Worker exited unexpectedly", tests not run, none failed) when the machine is near its commit limit: 54 of 70 GB committed on 2026-10-19 with the preview server, WSL and browsers open. It hit 2 of 3 full web runs that evening (one in the pre-push hook); the lost file (`api-review-budget.test.ts`) passed 3 of 3 alone, and the next full run and push passed. Not a test failure: re-run, and close what you can. It kept happening (two more pushes failed the same night, at 65–67 of 81 GB committed), so **the pre-push hook now runs the db and web suites with `--maxWorkers=2`** (owner's choice): every test still runs, more slowly; CI is unchanged |
| 46 | **The E2E suite hits the product's own limits, which count per address.** All journeys ran from one address, so once the suite passed 10 PIN requests (`OTP_PER_IP_PER_HOUR`) the later sign-ins got "Too many tries" (2026-10-22, the A3-24 journey). `signIn` (e2e/helpers.ts) now sends its own TEST-NET-3 `x-forwarded-for`; a journey that asks for a PIN some other way needs the same. Separately, `layout.spec.ts` run **on its own** fails its A3-23 sign-in test: its invalid-number click is the run's first write, and the error is awaited for only 5 s (gotcha 18). Run it in the whole suite, where the database is warm. Never raise the limit or the wait to make it pass |
| 47 | **The first journey of an E2E run paid the fresh database's migration inside its 15 s sign-in wait** (12 s measured at migration 0029 with other suites running): grade-10 failed three full runs in a row while passing alone. `e2e/warm-up.ts` (Playwright `globalSetup`) now makes one PIN request from a TEST-NET-2 address before any journey; the waits are unchanged (2026-10-23) |
| 48 | **Resolving "append-only" conflicts by keeping both sides can drop a line both sides shared**: a hunk that starts inside a block comment or an `export {` list loses the opener (config.ts would not parse; ui/index.ts lost `export {`). Read every hunk; after a rebase run typecheck and lint before the suites. And never write a test that a content section is the LAST key of `en`: assert it sits after the keys before it |
| 49 | **Next skips `.env.local` when `NODE_ENV=test`**, so a vitest harness that loads the env sees none of it (a config diagnosis passed while the dev server refused). The preview's own output is in `preview-server.log` (preview-dev.ps1 tees it); read that, never the env file. A server that answers `/api/health` 503 has a config refusal |
| 50 | **A rebase can bring a new dependency, and then the pre-push hook fails** ("test (all but the database suites)" ✗ in ~12 s, nothing pushed): the CV-A11 branch, rebased onto a main that had gained `expo-dev-client`, still had the old install. Run `pnpm install --offline` in a worktree after every rebase, before pushing; the suites passed at once after it (2026-10-23) |
| 51 | **Work committed in the preview folder never reaches `main` or the live site.** UniversityFlow-preview is a detached HEAD the integrator moves with `checkout --detach`; the owner's front-door pictures (six commits, 2026-10-23) were there and on an unpushed branch only, so the live site didn't show them. Before restarting the preview, check `git log <main>..HEAD` there and bring any commits in on a branch first, or the checkout leaves them behind |
| 52 | **A script that sets `TEST_DATABASE_URL` in the shell leaks it into the next suites**: after the real-services run removed its containers, the db and web suites in the same shell tried the gone database (ECONNREFUSED). Clear the TEST_* variables when the services stop; since #102 Turbo passes `TEST_DATABASE_URL` to tests, so a leaked one reaches every package |
| 53 | **Vercel's sensitive variables can't be read back**: `vercel env pull` writes a placeholder ("[sensitive]", 11 characters) for each, so a value can't be checked from here. To fix a doubtful switch, set it again (the integrator re-set the demo's five switches on 2026-10-23); `pnpm deploy:check` works on a file you fill yourself. A run that took an hour per 30 s test, or a browser that won't launch in 3 minutes, is the laptop stalling: re-run before reading anything into it |
| 54 | **The real-services run could fail on timing, not code (fixed in #112).** On #107's branch the real db suite passed 537/537 but exited 1 on an unhandled `57P01` ("terminating connection due to administrator command") from `postgres.test.ts`'s concurrent-migration test, whose `drop database … with (force)` can reach a connection still closing; the next run was clean. The real S3 suite once failed one file with 10 skipped right after the containers started, then passed 245/245 alone. Re-run before reading anything into it; a fix (await every pool's end, retry the bucket check) is a Low for a sweep. Also: after resolving an append-append conflict in an index file, run `pnpm lint`: Biome's export sort fails on blocks in the wrong order |
| 55 | **The merge script opened a second PR for a branch another session had just merged** (#122, an empty commit titled "x" on main, 2026-10-24): its lookup of an open PR failed on PowerShell 5.1's quoting of `--jq`, and the branch had been deleted and re-pushed. `land.ps1` now finds the PR with `ConvertFrom-Json` and refuses a branch whose head is already merged. Before landing, check `gh pr list --state all` when another session may be merging |
| 56 | **The disk fills up quietly** (13.8 GB free on 2026-10-24): ~70 worktrees each keep a web build (`.next`, ~0.3–1 GB) and Docker's disk file holds every project's images and build cache (60 GB). Delete `.next` in inactive worktrees and `docker builder prune` (owner-approved); Docker's file shrinks only after a compaction as administrator |
| 57 | **pnpm can't replace a native file another worktree has open** (EPERM on `next-swc…node`, `rolldown-binding…node`): the files are hard links into the shared pnpm store, so a `next`/`vitest` still running in any worktree on the old version locks them for all. Install in a fresh worktree (`git worktree add --detach`) or stop the processes; never stop one you didn't start (the classifier refuses: ask the owner) |
| 58 | **git rerere is on**: a conflict you resolved once is resolved silently the next time. Check the result anyway (markers, both sections, CSS braces) |
| 59 | **A push can die with "broken pipe" while the pre-push hook runs long** under load: retry; land.ps1 checks the remote head |
| 60 | **PowerShell 5.1 mangles `gh … --jq` with spaces or quotes**: pipe the JSON through `ConvertFrom-Json` |
| 61 | **Vercel's PR check fails on every PR** ("GitHub couldn't verify an account for the commit"): commits are authored tumo@tumoolo.tech; the owner adds that email to their GitHub account. Main deploys are unaffected |
| 62 | **When a repo moves between GitHub accounts or orgs, reconnect it in Vercel → Settings → Git**, even if it shows as connected (Mmereko stopped deploying for 3 months) |
| 63 | **globals.css's end-of-file blocks conflict on every merge**: read the hunks; the scratchpad's resolve-css-tail.mjs (both blocks inside the layer, keyframes after) and insert-css-block.mjs (one block after another's end marker) |
| 64 | **An E2E step must never load another live site**: Open Mmereko's spec loaded mmereko.tumoolo.tech, whose frame-ancestors refuses localhost; serve a stand-in with `page.route` |
