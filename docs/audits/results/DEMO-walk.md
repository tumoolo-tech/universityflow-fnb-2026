# Judge-demo walk (FNB hackathon), 2026-10-23

Agent `demo`, wave 3, branch `phase-5/demo-polish` (from main 092163c). A walk of the judge demo
as each of its six made-up learners, at a phone and a desktop width, looking for what a judge
would trip over: layout, accessibility, dead ends and confusing content.

## Method

- **Target:** the integrator's production build of main in demo mode at `http://localhost:3006`
  (`UF_DEPLOYMENT=demo`, local providers: its pages say "no AI connected", so the chat's replies
  there were the practice script, not the real AI).
- **Widths:** 360 × 800 and 1280 × 800, one Chromium (the repo's Playwright), one context per
  learner and width.
- **Pages:** signed out `/`, `/demo`, `/sign-in`, `/privacy`, `/help`; then, as each learner (picked
  on `/demo`), `/home` and every sidebar page (results, subjects, applications, funding, my goal,
  documents, offers, campus, first week, modules, about me, chat, get help), plus every in-app link
  found on those pages up to 45 pages per learner (application packs, What I need, plan maps,
  privacy, the landing page; at most two of each kind of detail page), and the About me "Make it
  yours" panel with its sample photos. 266 page views in all; each copy deleted after with
  "Switch learner".
- **On each page:** a full-page screenshot (kept outside the repo, in the session scratchpad);
  axe with the WCAG 2.2 AA tags the E2E suite uses (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`,
  `wcag22aa`) after animations settle; sideways scroll (`scrollingElement.scrollWidth >
  innerWidth`); text elements whose box ends past the screen's right edge (outside any scroll
  container); clipped text in `overflow: hidden` boxes; broken images; console errors; every
  same-origin link requested once (status ≥ 400 = dead); and pages with little text in `main`.
  Then the screenshots were read by eye for what a judge would find confusing or empty.
- Fixes were checked against the live page where a browser alone shows them (the fieldset rule
  injected into the live page: 0 elements past the edge, was 4); the rest by unit tests that
  failed first, and by E2E additions the integrator runs against a fresh build.

## Results

No axe violation on any page except the not-found page; no broken image; no console error except
the two 404s below; one dead link (below); sideways scroll on two homes at 360 px.

| ID | Sev | Where | Finding | State |
|---|---|---|---|---|
| A2-60 | High | About me → "Make it yours" (all six learners, 360 px) | The "Choose a sample photo" fieldset kept a fieldset's default `min-inline-size: min-content`; its auto-fill grid made it 488 px wide in a 326 px card, whose `overflow: hidden` cut off sample photos 4 and 5 and the end of every line of the Photo group's text (1.4.10) | Fixed: `fieldset { min-inline-size: 0 }` (globals.css, `demo` block); css-rules.test.ts; E2E at 360 px |
| A2-61 | Medium | Thabo `/goals` → "Open the Wits application pack"; Lerato the same for UJ | Dead link, a 404: the seed set a goal without putting it on the shortlist (the app's own goal route and the agent always do), so no pack existed for the goal's university | Fixed in the seed (lib/server/demo/personas.ts); demo-personas.test.ts; E2E |
| A2-62 | Medium | Amahle's home, "Next step" | "Finish your Wits application checklist", but Wits closed on 30 September 2026: on the judging day her one action was on a closed application | Fixed in the seed: Wits submitted, UJ (open to 31 October) under way; demo-personas.test.ts checks the window is open on the test date |
| A2-63 | High | Home "My marks over time" (Amahle, Lerato; any learner with two or more reports), 360 px | The x-axis drew all eight report kinds; their labels ran into each other and their min-content widened the whole home to 410 px (sideways scroll, 1.4.10). `chartKinds` (packages/ui), written for this axis, was never used | Fixed: the chart's axis and positions use `chartKinds`; labels `min-w-0`; dashboard.test.tsx; E2E: no learner's home scrolls sideways at 360 px |
| A2-64 | Medium | Any missing page (e.g. the A2-61 links) | No not-found page: Next's built-in one drew its own white box and styles inside the app, and axe failed color-contrast on the preview strip above it. The launch standard asks for a 404 page | Fixed: `app/not-found.tsx` (existing copy `errors.notFound`, `nav.home`); not-found.test.tsx; E2E with axe |
| A2-65 | Medium | Footer on every signed-out page (`/`, `/demo`, `/sign-in`, `/privacy`, `/help`) | The ECTA s43 block shows "Owner to fill: full legal name", "…registration number", "…phone number" etc. to judges | Open: owner's facts (legal name, status, registration, address, phone, email); nothing an agent may fill |
| A2-66 | Medium | Sipho (second year) and Kagiso (final year): Home, Chat | The university home reads as an arriving student's: "your first weeks at a glance", "Registration: Not yet…", "Know your campus… before your first day", "My marks over time… once you've confirmed a school report"; the chat's welcome asks a second-year to upload a school report | Open: stage copy by year of study (new keys) in dashboard and chat welcome; hide the school-marks chart for a university student with no school reports |
| A2-67 | Low | Demo banner on signed-out pages (`/demo`, `/sign-in`, `/privacy`, `/help`, the guide) | "Switch learner" shows when no learner is chosen | Open: show it only with a demo session (the banner would need the session; the root layout is static today) |
| A2-68 | Low | Applications for Sipho and Kagiso | An empty "shortlist courses first" state for a student already at university | Open: say the stage instead (with A2-66) |
| A2-69 | Low | Home "Next step" (product, not the demo) | `nextAction` (packages/ui) sends a learner to finish an application whose window has closed (the cause behind A2-62, for real learners) | Open: skip an unfinished application whose window closed; test in packages/ui home.test.ts |

## The judges' guide

Added `/demo/guide` (demo only; not found elsewhere), linked from the picker as "New here? A
three-minute guide": first what is made up or a stand-in (made-up learners and reports, "Not yet
verified" catalogue facts, the AI or the practice script, SAMPLE-only uploads, nothing sent to a
phone, "Coming next" for the university years), then for each learner two to four concrete things
to try and the same "Try as …" button as the picker. Copy in `en.demoPersonas.guide`.

## For the integrator

E2E additions in `apps/web/e2e/demo.spec.ts` (run with `test:e2e:demo` against a fresh build):
no learner's home scrolls sideways at 360 px; all six sample photos fit at 360 px; the goal
card's pack link opens a pack; a missing page is our not-found page (axe); the guide is linked
from the picker, is accessible, and starts a learner. `e2e/journey.spec.ts` already checks that a
missing page answers 404 with the nonce: re-run it, since the not-found page is now ours.
