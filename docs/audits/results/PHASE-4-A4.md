# PHASE-4 — A4 Performance and Core Web Vitals

**Project:** UniversityFlow · **Phase:** 4 · **Date:** 2026-10-14
**Commit:** 7d53bc6 (branch `phase-4/audits`) · **Audit source:** tumoOLO_Audits @ 29eafd7
**Result:** 0 Critical · 1 High · 2 Medium · 6 Low · 0 waived · 7 not measured

Scope: the Phase 4 diff (`17ca607..7d53bc6`) and the whole web bundle as it ships today; server
hot paths (reminder pipeline, job claiming, goals, exams, practice, what I need); the mobile
app's JS bundles. Independent reviewer, report only. Nothing in product code was changed.

**How it was measured.** Bundle sizes come from the production build `pnpm verify` left in
`apps/web/.next` (built 2026-10-14 12:05, not rebuilt) and `apps/native/dist` (12:03). Each
route's client JS was summed from its `page_client-reference-manifest.js` plus the build
manifest's `rootMainFiles`, gzip level 9. Runtime numbers come from `next start` on port 3100
with the E2E environment (`UF_LOCAL_PRODUCTION_BUILD=1`, local stand-ins, fresh PGlite, draft
catalogue) and **Lighthouse 12.8.2, mobile profile** (simulated Slow 4G: 150 ms RTT, 1.6 Mbps;
4× CPU slowdown), Chromium 1248, three runs on `/`, `/sign-in` and `/results`, one each on
`/chat` and `/goals`. Signed-in pages used a synthetic adult learner with synthetic marks.
Interaction latency came from Playwright (Pixel 7, CDP 4× CPU throttle) with `longtask` and
`event` PerformanceObservers. **Caveat:** another audit ran E2E on this machine at the same
time, so the throttled numbers are noisy (TBT on `/results` ranged 420 to 1,270 ms). Medians
are reported, and every finding rests on a deterministic byte count, not only on a timing.

The suite's A4 is written for a portfolio site (bokeh orbs, marquee, parallax, case-panel
zoom). None of those exist here. Those checks are reported as not applicable, not as passes
won by default.

---

## 1. Executive summary

UniversityFlow's web app is a plain, system-font, image-free interface, and it gets all the
cheap things right: no CLS anywhere (0 on every page measured), no web fonts, no images,
immutable one-year caching on hashed assets, server compute under 10 ms per request. It still
**fails every JavaScript-driven budget** on a mid-range phone profile. One line causes most of
it: `instrumentation-client.ts` imports the whole of zod just to call `z.config()`, and
Turbopack ships zod with **all ~40 of its error-message locales** (Tajik, Kurdish, Hindi,
Kannada …) in the root chunk of **every page**, sign-in and landing included. That is about
88 KB gzip of the 216 KB every visitor downloads first, and most of a 560–700 ms main-thread
task at 4× CPU. Seven signed-in routes then load a **second, different copy of zod** (4.6.5,
not 4.6.7) along with the catalogue's programme and Siyavula data, because client components
import `@universityflow/catalogue` for subject names. For learners on prepaid data and budget
Android phones, that is the difference between a page that is usable after about 2 s and one
that is usable after 3.5–4 s.

**Top 5 risks**
1. A4-01: zod plus every locale in the root chunk on every page (≈88 KB gz, ~59% of the root chunk's bytes)
2. A4-02: catalogue barrel in client components brings a second zod and the programme data to 7 routes (99 KB gz)
3. A4-03: `/results` hydrates all 86 programme cards on the client (TBT median 800 ms)
4. A4-04: the mobile bundles carry the same zod locales and catalogue data; Android grew by 256 KB in Phase 4
5. A4-05: an unused 944 KB Material Symbols font ships in the Android build

---

## 2. Verdict against the budgets

Lighthouse mobile, medians. "—" = one run only.

| Metric | Budget | `/` | `/sign-in` | `/results` | `/chat` | `/goals` | Verdict |
|---|---|---|---|---|---|---|---|
| LCP | < 2.0 s | 3.3 s | 3.4 s | 3.6 s | 3.7 s — | 3.5 s — | **Fail** |
| CLS | < 0.05 | 0 | 0 | 0 | 0 | 0 | Pass |
| TBT | < 200 ms | 470 ms | 460 ms | 800 ms | 570 ms — | 400 ms — | **Fail** |
| INP (field) | < 200 ms | Not measured (no field data). Lab: 64–104 ms per input once hydration has finished; **568 ms** for an input during hydration (`/chat`) | | | | | **Fail (lab, during hydration)** |
| Lighthouse Performance | ≥ 95 | 82 | 80 | 69 | 75 — | 81 — | **Fail** |
| Accessibility / SEO | 100 | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 | Pass |
| Best Practices | 100 | 96 | 96 | 96 | 96 | 96 | **Fail** (A4-09, the favicon 404) |
| First-load JS on `/` | < 120 KB gz | **222.8 KB** | 232.1 KB | 336.5 KB | 340.0 KB | 337.7 KB | **Fail** |
| Fonts | < 90 KB | 0 KB (system stack, no `@font-face`) | | | | | Pass |
| Images | — | None on any page; `next/image` not used | | | | | N/A |
| Long tasks > 50 ms (load) | 0 | 4 (longest 592 ms) | 2 (336 ms) | 5 (365 ms) | 5 (561 ms) | 5 | **Fail** |

FCP is good everywhere (0.8–1.1 s) because the HTML is server-rendered and small (4–23 KB
gzip). LCP is late because Lighthouse's simulation puts the LCP text behind the root JS:
observed (unthrottled) LCP equals FCP on every page. The real cost is the main thread. The
page shows early but doesn't respond until 3–4 s on this profile.

### Route sizes (client JS, gzip level 9; root = 215.7 KB gz / 813 KB raw on every route)

| Route | Route-only JS | First load | Raw (parse cost) |
|---|---|---|---|
| `/chat` | 124.3 KB | 340.0 KB | 1,320 KB |
| `/goals` | 122.0 KB | 337.7 KB | 1,310 KB |
| `/documents` | 121.2 KB | 336.9 KB | 1,305 KB |
| `/applications/[university]` | 121.1 KB | 336.8 KB | 1,306 KB |
| `/results` | 120.9 KB | 336.5 KB | 1,304 KB |
| `/funding` | 119.8 KB | 335.5 KB | 1,301 KB |
| `/onboarding` | 116.3 KB | 332.0 KB | 1,294 KB |
| `/me` | 21.3 KB | 237.0 KB | 874 KB |
| `/applications`, `/results/what-i-need/[id]` | 19.4 KB | 235.1 KB | 869 KB |
| `/sign-in` | 16.4 KB | 232.1 KB | 861 KB |
| `/consent/[token]` | 16.3 KB | 232.0 KB | 861 KB |
| `/` | 7.1 KB | 222.8 KB | 836 KB |

Plus 4.3 KB gzip CSS per route. The 38.6 KB `noModule` polyfill is fetched only by legacy
browsers.

**Top 5 contributors to `/`:** `32k-wew0wlvw6.js` 158.3 KB gz (React DOM **and zod with every
locale**: Lighthouse marks 107 KB of its 152 KB transfer unused on `/`) · `199n129_1d095.js`
42.8 KB (Next router) · `2mmpezlrfmbu5.js` 8.5 KB · `turbopack-*.js` 4.2 KB · route chunks
7.1 KB. On the seven heavy routes add `3q9mfyeey5_dx.js`, 99.4 KB gz / 430 KB raw (the second
zod, 4.6.5, plus catalogue data: Lighthouse marks 71 KB of it unused).

What zod costs, measured: the full `zod` namespace bundled on its own (rolldown, minified) is
**359.7 KB raw / 88.6 KB gzip**. With proper tree-shaking, `z.config({ jitless: true })` costs
0.2 KB. The two version strings in the shipped chunks (`minor:6,patch:7` in the root,
`minor:6,patch:5` in the route chunk) prove there are two copies.

### Native (from `apps/native/dist`, Hermes bytecode)

| Platform | Bundle | gzip | Assets | Previous build (2026-10-13 20:05) | Change |
|---|---|---|---|---|---|
| Android | 3,714 KB | 1,595 KB | 27 files, **966 KB** (944 KB is one font) | 3,459 KB | +256 KB (+7.4%) |
| iOS | 3,375 KB | 1,437 KB | 23 files, 23 KB | 3,123 KB | +252 KB (+8.1%) |

Hermes is on (`.hbc`). No source maps in `dist`. Both bundles contain zod's non-English
locales and the catalogue's programme and Siyavula text (string search of the `.hbc`). No
server code is in them (no `drizzle`, `pglite` or `anthropic` strings).

---

## 3. Findings

| ID | Severity | Location | Finding | Why it matters | Fix |
|---|---|---|---|---|---|
| A4-01 | **High** | `apps/web/instrumentation-client.ts:1,11` | `import { z } from 'zod'`, just to call `z.config({ jitless: true })`, puts zod 4.6.7 with **every locale** into the root chunk loaded by **every page**. The full namespace measures 360 KB raw / 88.6 KB gz, about 59% of the 607 KB root chunk. Lighthouse: 107 KB of 152 KB unused on `/` and `/sign-in`. One 560–700 ms main-thread task at 4× CPU on load, in the chunk that holds it | It costs learners prepaid data on the first visit and after every deploy (hashes change). It is parse and compile time on low-end Android on every page, before the page responds. The landing and sign-in pages, which need no zod at all, go from ≈135 KB to 223 KB first load. It is the largest single reason all five pages measured fail the JS, TBT, LCP and Performance budgets | Import only what's needed and measure the chunk: `import { config } from 'zod/v4/core'` (or zod/mini), then confirm no non-English locale string remains in `rootMainFiles`. If Turbopack still pulls the namespace in, set the documented `globalThis.__zod_globalConfig` flag in a small module that imports nothing. The gotcha 15 CSP fix (no `Function()` probe) must still pass E2E |
| A4-02 | Medium | `apps/web/components/artifacts.tsx:5`, `components/programme-card.tsx:4`, `components/what-i-need.tsx:2`, `app/(app)/goals/goals-view.tsx:4`, `app/(app)/documents/confirm-marks.tsx:3`, `app/(app)/funding/funding-view.tsx:4`, `app/onboarding/steps.tsx:3`; `packages/catalogue/src/subjects.ts:97`; `packages/catalogue/package.json:16` | Client components import `subject`/`SUBJECTS`/`PROVINCES`/`isDraft`/`dialable` from the `@universityflow/catalogue` barrel. The barrel has module-scope zod schemas (`subjects.ts:97` `z.string().refine(…)`) and no `sideEffects: false`, so 7 routes ship a 99 KB gz / 430 KB raw chunk: a **second zod** (4.6.5, because `catalogue` asks for `^4.4.3` while `web` asks for `^4.6.7`) plus programme records (`Bachelor of Science` ×12, `siyavula` ×28). Lighthouse: 71 KB of it unused | Another ~100 KB gzip and 430 KB parse on the seven pages a learner uses most (results, chat, goals, documents, onboarding). It also undercuts hard rule 2 in spirit: admission records reach the browser although the server decides | Give the client a zod-free entry (for example `@universityflow/catalogue/subjects`, plain arrays and `subject()`, the zod `subjectId` schema moved to a separate module), or pass subject and province names from the server component as props. Add `"sideEffects": false` to `catalogue`, `content`, `admissions` and `ui` where true. Align every package on one zod specifier (a pnpm catalog or `overrides`) so one copy resolves |
| A4-03 | Medium | `apps/web/app/(app)/results/results-view.tsx:94-115`; `app/(app)/results/page.tsx:35-45` | `ResultsView` is one client component that receives all 86 results (86 KB of RSC payload in a 254 KB, 22.6 KB gz HTML) and renders and hydrates every `ProgrammeCard`. Measured at 4× CPU: load long tasks 579 + 441 ms (a quieter run: 145 + 207 ms); Lighthouse TBT median **800 ms** (420 / 800 / 1,270), Performance 67–80, the worst page measured. Re-selecting "All" universities costs a 128 ms task | `/results` is the payoff of Stage 1: the page a learner opens straight after confirming their marks, and the most likely to be opened on a weak phone. Long hydration means taps on "Add to my shortlist" are dropped or delayed | Render the groups and cards in a server component. Keep client islands only for the filter inputs and each card's shortlist button, or filter with `useDeferredValue`. Collapse "Plan B" by default (render on expand). Pass the card data once, not as props and HTML both |
| A4-04 | Low | `apps/native/components/confirm-marks.tsx:1`, `components/programme-card.tsx:2`, `components/what-i-need.tsx:2`, `components/artifact-card.tsx:1` (via `packages/catalogue/src/index.ts`) | The same barrel import puts zod with every locale and the catalogue data into both Hermes bundles. Phase 4 grew Android 3,459 → 3,714 KB (+256 KB) and iOS +252 KB | Store download size on prepaid data. Hermes loads bytecode lazily, so the runtime cost is small: Low | The same zod-free subjects entry as A4-02. Track `.hbc` size per platform in CI, as A4 §7 asks ("bundle size per platform, tracked release over release") |
| A4-05 | Low | `apps/native/dist/assets/2d743919…` ← `node_modules/@expo-google-fonts/material-symbols/400Regular/MaterialSymbols_400Regular.ttf` (pulled in through `expo-symbols`) | The Android build ships a 944 KB Material Symbols font that no app code uses: no `expo-symbols`, vector-icon or `.ttf` reference in `apps/native`. Android assets total 966 KB against 23 KB on iOS | It nearly doubles what Android downloads beyond the JS (+944 KB in the APK/AAB and in OTA asset sets) | Find which dependency imports `expo-symbols` on Android (expo-router's native tabs or header). Exclude it with a Metro `resolver.blockList` or a platform stub if unused, then assert in the app-config test that no `.ttf` above 100 KB is in the Android export |
| A4-06 | Low | `apps/web/lib/server/services.ts:183-184`; `packages/catalogue/src/catalogue.ts:77-93` | `catalogue()` rebuilds the view on every call and runs a zod `safeParse` on every draft record. Measured: **4.0 ms** with drafts, 2.1 ms verified-only per call. It runs once or more per page request, and **twice per reminder job** (`TimetablePaperSlots` papers and `catalogueResolver`) | Small per request. At a 07:00 reminder burst it is CPU time the job runner spends on identical results | Memoise the view per (UTC day, `includeDrafts`) in `createServices`. The data is static per deploy |
| A4-07 | Low | `apps/web/app/(app)/goals/page.tsx:20-24`; `apps/web/lib/server/goals.ts:55,85-89,126-130` | `/goals` runs `goalResponse`, `examsResponse` and `practiceResponse` in parallel, each reading for itself: `latestReport()` ×3, `profile()` ×2, `goal()` ×2. Every read is its own transaction (BEGIN, `set_config`, `set role`, `uf_may_process`, query, COMMIT), and `latestReport` adds a marks query: ≈45 statements and up to 3 pool connections for one page. TTFB on PGlite 115–123 ms against 70 ms for `/chat` | Round trips and pool pressure on results day (spike 2 already flags serverless connection storms) | Read the report, goal, profile and choices once in the page and route handlers, and pass them to pure builders. Or add a `StudentStore.snapshot()` that reads them in one transaction |
| A4-08 | Low | `packages/db/src/jobs.ts:136-153` | The claim query ORs the pending and expired-lease branches, so Postgres can't use the `jobs_due` index order: it bitmap-scans **every** due job and sorts them all for each claim. Measured (PGlite, 50 k due, 200 k done): **202.9 ms per claim**, against **0.6 ms** for the pending branch alone. Draining a backlog is O(n²). **Reachability:** this is the local stand-in. `UF_PROVIDERS=live` refuses to start without a hosted adapter (`job-providers.ts`), so production never runs it today. It becomes High if the residency question in spike 5 makes the Postgres scheduler the production path | A results-day or exam-morning backlog would stall the reminder queue | Claim in two statements: the pending branch first (`order by run_at, id limit 1 for update skip locked` uses `jobs_due`), then the expired-lease branch only if that returned nothing. Add an EXPLAIN-based test |
| A4-09 | Low | `apps/web/app/` (no `icon`/`favicon`) | `GET /favicon.ico` returns 404 on every first visit: a wasted 150 ms-RTT round trip on Slow 4G, and the console error is the only Best Practices failure (96, budget 100) | Small, and it's the one thing between Best Practices and 100 | Add `app/icon.png` (or a tiny `favicon.ico`) from the existing app icon |

---

## 4. Not measured

| Check | Why |
|---|---|
| Field Core Web Vitals (CrUX / Vercel Speed Insights) from `cpt1` | Not deployed. Every number here is lab data |
| Brotli, and compression of API responses | `next start` serves gzip only, and its API responses come back uncompressed (`/api/results`: 70 KB). Vercel compresses at its edge. Check on the first preview deploy |
| TTFB with a cold Vercel function | Every page is rendered per request (the CSP nonce, gotcha 16), so the landing page can't come from the edge cache. Gotcha 15 records a 6–9 s cold first request locally. Needs a deployed preview |
| Database round-trip cost on real Postgres (RDS af-south-1) | Measured on in-process PGlite only. A4-07's statement count is exact; its wall time on RDS is not |
| A real budget Android phone | Emulated (4× CPU) only. A real low-end device is usually slower than this profile |
| Native cold start, JS FPS, UI-thread animations (A4 §7) | No device or emulator in this run. §7 is phase 5+ in the suite; recorded here so it isn't assumed |
| Waterfall and trace screenshots | This run produced JSON (Lighthouse reports, `longtask` entries), not images. The numbers in §2 and §3 are taken from them |

Not applicable (nothing to measure): bokeh/blur layers, parallax, marquee, case-panel zoom,
`backdrop-filter`, `will-change`, scroll handlers (the only scroll call is
`scrollIntoView` in `chat.tsx:51`, once per message update), `next/image`, `blurDataURL`, web
fonts and `size-adjust`.

## 5. Waived

None.

---

## 6. Remediation roadmap

Ordered by measured impact per unit of effort.

**Quick wins (< 1 day)**
1. **A4-01**: change one import in `instrumentation-client.ts`, check the root chunk. Expected: ≈88 KB gz off every page; `/` drops to ≈135 KB first load. The remaining ~15 KB over the 120 KB budget is roughly the Next 16 + React 19 floor (root without zod ≈127 KB): **revisit the budget or waive it as a platform limit after the fix, with the measured number.**
2. **A4-02 (half)**: align zod to one version (pnpm catalog/overrides) and add `sideEffects: false`. Removes the duplicate copy even before the client entry exists.
3. **A4-09**: add an icon. Best Practices 96 → 100.
4. **A4-06**: memoise `catalogue()` per day.

**Medium (1–3 days)**
5. **A4-02 (rest)** and **A4-04**: a zod-free client entry for subjects, provinces and helpline dialling. Removes ≈100 KB gz from seven web routes and shrinks both native bundles.
6. **A4-03**: the results list as a server component with client islands. Largest remaining TBT.
7. **A4-07**: one read per page for the goals page and the three `/api/me/*` routes.
8. **Bundle budget in CI**: a post-build script (beside `pnpm check`) that fails when root JS or any route's first-load JS goes over a recorded number, when a non-English zod locale string appears in a client chunk, or when the `.hbc` grows more than 5% with no note.

**Structural**
9. **A4-05**: remove the unused Android symbol font (needs a look at the expo-router / expo-symbols dependency).
10. **A4-08**: before the Postgres scheduler is ever considered for production, split the claim query and add an EXPLAIN test.

---

## 7. What's genuinely good

Keep these. Don't "optimise" them into a regression.

- **Zero layout shift** on every page measured (CLS 0, five pages, three runs). There are no
  images or web fonts to shift, and form and card sizes are fixed (`min-h-11`).
- **No web fonts at all**: the system stack costs 0 KB and has no swap risk. Don't add a brand
  face without a subset and `size-adjust`.
- **Server-rendered first paint**: FCP 0.8–1.1 s on Slow 4G. HTML is 4–23 KB gzip, even
  `/results` with 86 programmes (22.6 KB).
- **Caching**: hashed assets are `public, max-age=31536000, immutable`; HTML is `no-store`,
  which is correct for per-request nonces and personal pages.
- **Server compute is cheap**: measured per call, `assessAll` 5.9 ms, `whatINeedFor` for
  **every one of the 86 programmes** 39 ms in total (0.45 ms each; the API computes one),
  `practicePlan` 0.26 ms, `goalCard` 0.05 ms, `examCountdown` 0.26 ms. The "86-programme sweep"
  is not a hot path: no request runs `whatINeedFor` over the whole catalogue.
- **Messaging queries are indexed for their access paths**: `reminders_student_sent` serves
  the cadence lookback, `reminders_receipt` serves delivery reports, `push_tokens_session` and
  `push_tokens_student` serve the joins, and `jobs_due` and `jobs_leased` are partial indexes.
  The cadence read is bounded to 8 days and runs under RLS for one learner. `claimSend` holds a
  per-learner advisory lock, not a table lock.
- **Hydrated interactions are fast**: after load, typing and clicking in chat cost 40–104 ms
  per event at 4× CPU, and searching `/results` 40–48 ms. Streaming chat deltas cause no long
  task beyond the first reply's render.
- **Hermes is on and no source maps ship** in the native export. No server code
  (`drizzle`, `pglite`, the AI SDK) reaches either the browser or the app bundle.
- **Reduced motion is global** (`globals.css:97`) and transitions are colour-only.
