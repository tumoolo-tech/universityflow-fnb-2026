# PHASE-5 — A4 Performance and Core Web Vitals

**Project:** UniversityFlow · **Phase:** 5 · **Date:** 2026-10-17
**Commit:** 0554343 (branch `phase-5/stack`, the integration trial) · **Audit source:** tumoOLO_Audits A4 (brief `audit-brief-A4.md`, same suite version as PHASE-4-A4)
**Result:** 0 Critical · 0 High · 0 Medium · 4 Low · 0 waived · 6 not measured

Scope: the Phase 5 diff (`git diff 7e8ddef..HEAD`): offers (#70), the catalogue's campus, place,
faculty-office, registration-calendar and curriculum records (#68, #69, #71–#74), care and red
team (#75), the campus tour, first-week checklist and safety pushes (#77), and the registration
check and My modules (#78). Checked: first-load JS of the new pages (the #40 and #56 chunk
checks), whether any page ships catalogue data or a second zod, server work per request (campus
and curriculum lookups, offers and registration reads), the native bundles after 5b/5c, and the
catalogue's growth. Independent reviewer, report only. No product code, test, data or doc was
changed.

**How it was measured.** Bundle numbers come from the production builds already in the trial
worktree (`apps/web/.next`, built 2026-10-17 14:04; `apps/native/dist`, 14:04), not rebuilt. The
CI scripts `scripts/ci/root-chunk-budget.mjs` and `scripts/ci/client-chunks.mjs` were run as-is,
and each shared chunk was attributed to its routes from the client-reference manifests (gzip level
9). Catalogue and content growth were measured by bundling `packages/content/src/en.ts` and
`packages/catalogue/src/index.ts` at `7e8ddef` and at HEAD with rolldown 1.2.11 (`--minify`, zod
external). Runtime: `next start` on **port 3102** with the Playwright environment
(`UF_PROVIDERS=local`, `UF_LOCAL_PRODUCTION_BUILD=1`, `UF_CATALOGUE_PREVIEW=1`,
`UF_CATALOGUE_E2E_FIXTURES=1`, a fresh PGlite in the scratchpad). A synthetic adult learner with
an accepted UP offer and a confirmed (sample) registration was made through the UI. **Lighthouse
12.8.2, mobile profile** (simulated Slow 4G, 4× CPU), Chromium 1248: one run on `/` and
`/sign-in`, two each on `/offers`, `/modules`, `/campus`, `/first-week`. Load long tasks came from
Playwright (Pixel 7, CDP 4× CPU). The server was stopped afterwards. **Caveat:** other audits ran
on this machine at the same time (gotcha 39), so timings are noisy; every finding rests on a byte
count, a row count or a statement count, not only on a timing.

Two throwaway probes ran and were deleted: `packages/db/src/a4-phase5.audit-tmp.test.ts` (FK
delete cost, A4-11) and `packages/agent/src/a4-phase5.audit-tmp.test.ts` (catalogue view and
Phase 5 builder timings). Each was run alone with `pnpm --filter <pkg> exec vitest run <file>`.

---

## 1. Executive summary

Phase 5 kept the gains from #40 and #56. The root chunks are unchanged at **127.6 KB gzipped**
(CI budget 150 KB), and **no client chunk, web or native, carries catalogue data or a second
zod**. None of the 366 module codes or 93 place names now in the catalogue appears in any web chunk
or either Hermes bundle. The four new pages (`/offers`, `/modules`, `/campus`, `/first-week`) cost
151–159 KB first load, in line with the Phase 4 pages after the fix, with 2.5–4.5 KB gz of their
own. Server work is cheap: the catalogue view with drafts builds in 3.0 ms (memoised per day,
A4-06), a campus tour for all six universities takes 0.8 ms, and My modules for every one of the
46 curricula 4.9 ms in total. The new tables are indexed for how they are read. The suite's
budgets still fail on a mid-range phone profile (Performance 82–96, TBT 160–720 ms, LCP
2.2–2.8 s), but the cause is the same Next 16 + React 19 root chunk as at the end of Phase 4, not
Phase 5 code. Phase 5's measurable costs are small and spread out: every page now carries every
string the app has, including Phase 5's (+6.6 KB gz on 16 of 17 pages); four new foreign keys
make deletes scan whole tables; and the native bundles still have no per-platform record, so
Phase 5's growth there can't be stated.

**Top risks**
1. A4-10: all of `en` (now 55.7 KB min / 18.2 KB gz, +57% this phase) ships on every page but `/`, sign-in and guardian consent included
2. A4-11: `offers` and `registrations` have unindexed `document_id`/`reminder_id` foreign keys with `on delete set null`: every document or reminder delete scans both tables (measured 17 ms against 0.4 ms at 200 k rows)
3. A4-13: native bundle size per platform is still not recorded or checked, and no guard stops `apps/native` importing the catalogue barrel
4. A4-12: confirming a registration reads the registration and the messaging preferences twice each
5. (Carried, not new) the suite's TBT/LCP/Performance budgets fail on the framework floor; the 120 KB vs 150 KB root budget is still the owner's call (status.md decision of 2026-10-14)

---

## 2. Verdict against the budgets

Lighthouse mobile. Two runs shown as `run 1 / run 2`.

| Metric | Budget | `/` | `/sign-in` | `/offers` | `/modules` | `/campus` | `/first-week` | Verdict |
|---|---|---|---|---|---|---|---|---|
| LCP | < 2.0 s | 2.2 s | 2.8 s | 2.4 / 2.7 s | 2.6 / 2.6 s | 2.8 / 2.5 s | 2.6 / 2.6 s | **Fail** |
| CLS | < 0.05 | 0 | 0 | 0 | 0 | 0 | 0 | Pass |
| TBT | < 200 ms | 160 ms | 720 ms | 190 / 290 ms | 500 / 370 ms | 550 / 350 ms | 370 / 420 ms | **Fail** (all but `/`, `/offers` run 1) |
| INP (field) | < 200 ms | Not measured (no field data) | | | | | | Not measured |
| Lighthouse Performance | ≥ 95 | 96 | 78 | 95 / 90 | 84 / 88 | 82 / 89 | 88 / 87 | **Fail** (all but `/`) |
| Accessibility / Best Practices / SEO | 100 | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 | Pass (A4-09's favicon fix holds) |
| First-load JS | < 120 KB gz | 134.7 KB | 151.8 KB | 158.5 KB | 159.4 KB | 157.3 KB | 157.6 KB | **Fail** (root floor 127.6 KB) |
| Root chunks (CI) | ≤ 150 KB gz, no zod locales | 127.6 KB, none | | | | | | Pass |
| Catalogue data / second zod in a client chunk (CI) | none | none in 24 chunks | | | | | | Pass |
| Fonts | < 90 KB | 0 KB (system stack) | | | | | | Pass |
| Images | — | none on any page | | | | | | N/A |
| Long tasks > 50 ms on load (Playwright, 4× CPU) | 0 | — | — | 67, 267, 421 ms | 253, 53 ms | 50, 206 ms | 246 ms | **Fail** |

**Where the blocking time goes.** Lighthouse's `bootup-time` and `long-tasks` put the largest
task on every page in the root chunk `3gvund59e-tt0.js` (React DOM, 70.1 KB gz, 28.9 KB of it
unused on these pages): 332–682 ms. The page's own document cost (HTML parse, style, layout) is
the second: 217–395 ms on the new pages, whose HTML is 25–55 KB (6–8 KB gz) with an RSC payload of
12–22 KB. Phase 5 didn't change the root chunk (127.6 KB now, 128 KB after #40). The one
`/sign-in` run at 720 ms TBT ran beside another audit's work; Phase 4 measured `/sign-in` at
460 ms before #40.

### Route sizes (client JS, gzip level 9; root = 127.6 KB gz on every route)

From `node scripts/ci/client-chunks.mjs apps/web/.next`:

| Route | First load | | Route | First load |
|---|---|---|---|---|
| `/chat` | 165.1 KB | | `/applications/[university]` | 157.9 KB |
| `/modules` (new) | 159.4 KB | | `/first-week` (new) | 157.6 KB |
| `/goals` | 159.0 KB | | `/campus` (new) | 157.3 KB |
| `/offers` (new) | 158.5 KB | | `/me` | 156.8 KB |
| `/documents` | 158.1 KB | | `/results` | 156.1 KB |
| `/funding` | 155.9 KB | | `/applications`, `/results/what-i-need/[id]` | 154.9 KB |
| `/onboarding` | 152.8 KB | | `/sign-in` | 151.8 KB |
| `/consent/[token]` | 151.7 KB | | `/` | 134.7 KB |

**Shared chunks above the root:** `1jqmxfg36ri_s.js` **19.6 KB gz / 59 KB raw on 16 of 17 routes
(the whole of `en`, A4-10)**; `2nhym28qkjiyk.js` 4.1 KB on the 13 signed-in routes;
`3fntmmi971322.js` 3.6 KB on all. Route-only chunks for the new pages: `/modules` 4.5 KB, `/offers`
3.7 KB, `/first-week` 2.7 KB, `/campus` 2.5 KB. `/chat` adds 10.3 KB (the artifact panel, which
now renders offers, campus, first-week and My modules cards too).

### Native (Hermes bytecode, `apps/native/dist`)

| Platform | Bundle | Assets | Phase 4 audit (before #56) |
|---|---|---|---|
| Android | 2,992 KB | 26 files, 26 KB in total (no `.ttf`: A4-05 fix holds) | 3,714 KB |
| iOS | 2,758 KB | 23 files | 3,375 KB |

No source maps in `dist`. A string search of both `.hbc` files finds no "Bachelor of", no
"siyavula", none of the 366 curriculum module codes, none of the 93 orientation place names, no
"zod", "drizzle" or "pglite". All four new native screens import only `@universityflow/catalogue/client`
(type-only from the barrel), and their programme pickers are capped at 20 options
(`offers.tsx:32`, `confirm-modules.tsx:20`). **Phase 5's own growth can't be stated**: there is no
bundle record from the end of Phase 4 after #56 (A4-13).

### Catalogue growth (server-only)

| | At `7e8ddef` | At HEAD | Change |
|---|---|---|---|
| `@universityflow/catalogue` bundled, minified (zod external) | 64.1 KB / 15.3 KB gz | 191.2 KB / 48.7 KB gz | ×3.0 |
| Records | 6 universities, 86 programmes, 45 papers, 18 practice | + 25 campuses, 116 places, 28 faculty offices, 4 registration calendars, 46 curricula | |
| `catalogueView` with drafts (median of 50) | 4.0 ms (Phase 4) | 3.0 ms; 10.3 ms the first call in a process; 1.4 ms verified only | memoised per UTC day (A4-06) |

None of it reaches a client (above). On the server the cost is one parse at cold start and one
view build per day per instance. `catalogueProblems` (integrity) runs only in tests.

---

## 3. Findings

| ID | Severity | Location | Finding | Why it matters | Fix | Test |
|---|---|---|---|---|---|---|
| A4-10 | Low | `packages/content/src/en.ts` (one `en` object, 73 KB of source, +540 lines this phase); imported by client components incl. `apps/web/components/campus.tsx:9`, `components/modules.tsx`, `components/offers.tsx`, `app/(app)/offers/offers-view.tsx`, `app/(app)/modules/modules-view.tsx` and every Phase 1–4 client view | Every client component that reads a string pulls in the **whole** `en` object, so one 19.6 KB gz / 59 KB raw chunk (`1jqmxfg36ri_s.js`) is on 16 of 17 routes. Phase 5 grew it from **33.0 KB min / 11.6 KB gz to 55.7 KB / 18.2 KB (+6.6 KB gz, +57%)**. Proven by string search: the campus copy ("On campus at", "Your campus clinic…") and "My modules" are in that chunk, so `/sign-in` and the guardian's `/consent/[token]` download them. Property access on one object can't be tree-shaken | Small per phase, but it is now the largest chunk above the framework floor and grows with every feature (Phases 6+ add more copy). It is paid on the two pages where first impressions and guardians land, on prepaid data, and again after every deploy | Split `en` into per-area modules (`en/common`, `en/campus`, `en/modules`, …) that client components import directly, keeping `en` as a server-side aggregate (hard rule 8 still holds: strings stay in `packages/content`). Or pass the strings a client island needs as props from its server component | Extend `client-chunks.mjs` with "route must not carry" markers: fail when `/sign-in` or `/consent/[token]` chunks contain a Phase 5 string ("On campus at"). Fails today |
| A4-11 | Low | `packages/db/src/migrations/0018_offers.ts:32,37`; `0020_registrations.ts:64,66` | Four new foreign keys, `offers.document_id`, `offers.reminder_id`, `registrations.document_id`, `registrations.reminder_id`, are `on delete set null` with **no index**. Postgres runs the referential action as a full scan of the referencing table per deleted parent row, outside RLS (all learners' rows). **Measured** (PGlite probe, 200,000 offers): `delete from documents where id = …` **16–21 ms** per row, **0.4–0.9 ms** once `offers(document_id)` is indexed. Deleting a document scans both tables; deleting an account cascades every reminder of that learner, each scanning `offers` and `registrations` again. Derived, not measured: ~50 reminders × 2 tables × ~17 ms ≈ 1.7 s per account deletion at that size, inside one transaction | Learners delete documents (POPIA) and accounts; on results day and in registration week these tables are at their biggest. The cost grows linearly with the number of learners, and the delete holds its locks for the scan | Add `create index … on offers (document_id) where document_id is not null`, and the same for `offers.reminder_id`, `registrations.document_id`, `registrations.reminder_id` in a new migration (also `reports.document_id` from 0001, same pattern) | An EXPLAIN-free test: a migration test asserting every FK column with `on delete` has a covering index (query `pg_constraint` against `pg_index`). Fails today on these four |
| A4-12 | Low | `apps/web/app/api/registration/route.ts:33-39`; `apps/web/lib/server/registration.ts:96-100,146,152` | `PUT /api/registration` calls `saveRegistration`, which re-reads `student.registration()` (line 146) and, when there is something to fix, `messagingPreferences()` (152); then `registrationResponse` reads `registration()`, `offers()` and `messagingPreferences()` again (96-100). Two of each read, each its own transaction (BEGIN, `set_config`, `set role`, `uf_may_process`, query, COMMIT): the A4-07 pattern on a write path | Small: this runs a few times a year per learner. It adds round trips and a pool connection in registration week, when many learners confirm at once | Return the saved record and the chosen channel from `saveRegistration` and pass them to a pure `registrationResponseFrom(record, offers, channel, view)`, as #62 did for goals | A route test counting `StudentStore` calls (a spy store): `registration` and `messagingPreferences` once each per PUT. Fails today (2 each) |
| A4-13 | Low | `.github/workflows/ci.yml:96-100` (web checks only); `scripts/checks/` (no native import rule); `apps/native/dist` | A4 §7 asks for "bundle size per platform, tracked release over release". The web has a root budget and a client-chunk data check; the phone app has neither. Nothing records the `.hbc` size per platform, nothing fails when it jumps, and no guard stops `apps/native` importing the `@universityflow/catalogue` barrel (A4-04's fix rests on `client.test.ts`, which tests the entry, not the app). Today the bundles are clean (above), but Phase 5's growth (two new stages, ~1,900 lines of native code, the larger `en`) **can't be measured**, because there is no baseline | The app is downloaded on prepaid data, from the stores and as OTA updates. A barrel import in one native component would silently put the catalogue (now 191 KB min) and zod back into both bundles, and no check would see it | Add `scripts/ci/native-bundle.mjs`: after `expo export`, record each platform's `.hbc` size in a committed file, fail on > 5% growth with no note, and fail on catalogue markers ("Bachelor of", a module code) or zod locale strings in the `.hbc`. Add a `pnpm check` rule: no `from '@universityflow/catalogue'` value import in `apps/native` (type-only allowed) | The new script's own test (as `client-chunks.test.mjs` does): a fake `.hbc` carrying "Bachelor of" fails. The check-rule test: a native file with a barrel value import fails |

---

## 4. Project-specific checks

| Check | Result |
|---|---|
| Root chunks (`root-chunk-budget.mjs`) | ✓ 5 root chunks, 127.6 KB gz (budget 150 KB), no zod locales. Unchanged from #40 |
| Client chunks (`client-chunks.mjs`) | ✓ 24 client chunks, none with catalogue data or zod locales |
| Phase 5 catalogue data in any web client chunk | None: 0 of 366 module codes, 0 of 93 place names; the only `ac.za` strings are the NBT link in content |
| A second zod on a new page | None: no locale marker, no zod version string beside the root's `config` import |
| `@universityflow/catalogue/client` growth | Plain values only (`PLACE_KINDS`, `mapsLink`, `normaliseModuleCode`, `MODULE_TERMS`, …); `client.test.ts` now also fails if `./campus`, `./curriculum` or `./integrity` load |
| `packages/ui` → catalogue | `ui/src/artifacts.ts` imports catalogue and content **types only**; nothing reaches a bundle |
| Server compute per request (probe) | Catalogue view 3.0 ms (memoised); `campusTour` for all 6 universities 0.78 ms; `firstWeek` ×6 0.02 ms; `myModules` for all 46 curricula 4.9 ms |
| DB reads per page | `/offers`: offers, latest report, preferences in parallel (3 distinct reads). `/modules`: registration, offers, preferences (3). `/campus`: offers (1). `/first-week`: offers, then that university's ticked steps (2). No duplicate reads on GET pages |
| Indexes for the new reads | `offers_student_created (student_id, created_at)`, `offers_one_accepted` (partial), `unique (student_id, programme_id)`; `registrations unique (student_id, academic_year)`; `first_week_steps` PK `(student_id, university_id, step)`; `students.phone` unique serves `acceptedOfferUniversity`. The gap is the FK side (A4-11) |
| Crisis path | Campus lines add one offers read before the crisis card, only when distress is found; a failure falls back to no campus lines (`tools.ts:824-832`, `crisis-reply.ts`). Measured cost is one transaction |
| TTFB (local, PGlite, median of 7) | `/offers` 118 ms, `/modules` 117 ms, `/first-week` 109 ms, `/campus` 98 ms, against `/goals` 120 ms and `/chat` 156 ms. APIs: `/api/registration` 72 ms (11.7 KB), `/api/offers` 65 ms (9.2 KB), `/api/first-week` 51 ms (1.6 KB), `/api/campus` 45 ms (7.7 KB) |
| HTML size of the new pages | `/campus` 48 KB (7.1 KB gz; Wits 55 KB / 7.6 KB gz), `/modules` 36 KB (7.0), `/offers` 37 KB (6.8), `/first-week` 26 KB (5.9). RSC payload 12–22 KB. Comparable to `/goals` |
| Native pickers | Programme lists capped at 20 options with a search (`offers.tsx:32`, `confirm-modules.tsx:20`) |
| Native assets | Android 26 KB, no `.ttf` (A4-05 holds) |

## 5. Not measured

| Check | Why |
|---|---|
| Phase 5's native bundle growth | No `.hbc` record from the end of Phase 4 after #56; the main checkout's `dist` predates #56. Rebuilding `7e8ddef` was out of bounds for a read-only audit (A4-13) |
| Phase 5's web growth per route against `7e8ddef` | No build of `7e8ddef` exists and building one was out of bounds. The content chunk's growth (A4-10) was measured from source with rolldown instead |
| Field Core Web Vitals and INP | Not deployed. Lab data only |
| Native cold start, JS FPS, UI-thread animation (A4 §7) | No device or emulator in this run |
| Database cost on real Postgres (RDS af-south-1) | PGlite only. A4-11's ratio (scan vs index) holds on Postgres; its absolute times don't transfer |
| Waterfall and trace screenshots | Lighthouse JSON and `longtask` entries only, kept in the auditor's scratchpad |

Not applicable (nothing to measure): blur, parallax, marquee, case-panel zoom, `backdrop-filter`,
`will-change`, scroll handlers, `next/image`, web fonts. The campus tour links out to the
university's own maps and tours: no map tiles, no media, no extra origin.

## 6. Waived

None. The 120 KB first-load budget against the 150 KB CI ceiling remains the owner's open call
(status.md decision of 2026-10-14); this audit doesn't waive it on the owner's behalf.

---

## 7. Remediation roadmap

**Quick wins (< 1 day)**
1. **A4-11**: one migration with four partial indexes (five with `reports.document_id`) and the FK-index test.
2. **A4-12**: return the saved record and channel from `saveRegistration`; a spy-store test.

**Medium**
3. **A4-13**: `native-bundle.mjs` with a committed size record per platform, and the `pnpm check` rule against native barrel imports. Do it before Phase 6 adds more, so the next audit has a baseline.
4. **A4-10**: split `en` per area for client components; add per-route "must not carry" markers to `client-chunks.mjs`. Expected: −10 to −15 KB gz on `/sign-in` and `/consent/[token]`, and growth that stays with the pages that need it.

**Structural (carried)**
5. The remaining TBT is React DOM and the Next router on a 4× CPU profile. Getting under 200 ms needs less client React per page (more server components, smaller islands), not bundle trimming.

---

## 8. What's genuinely good

Keep these. Don't "optimise" them into a regression.

- **The #40 and #56 fixes held through a phase that tripled the catalogue.** Root chunks
  unchanged at 127.6 KB; no catalogue record, module code, place name or second zod in any web
  chunk or Hermes bundle. The client entry grew only by plain values, and `client.test.ts` was
  extended to fail if the new campus, curriculum or integrity modules ever load from it.
- **Hard rule 2 shows in the bundles:** offers, campus tours, first-week checklists and My
  modules all arrive as server-built artifacts; the browser never gets the data to recompute them.
- **Server compute stays in single-digit milliseconds**: the per-day memoised view absorbs the
  bigger catalogue, and the lookups are linear scans over a few dozen records. `myModules` for every
  curriculum in the catalogue costs under 5 ms in total.
- **GET pages read each record once**: no repeat of A4-07 in `/offers`, `/modules`, `/campus` or
  `/first-week`. Reads run in parallel where independent.
- **The new tables are indexed for how they are read** (per-learner order, one accepted offer,
  one registration per year, the first-week primary key), and `acceptedOfferUniversity` goes
  through the unique phone index.
- **Text first, link out**: the campus tour adds no map tiles, images or third-party origins; CLS
  stays 0 on every page; Accessibility, Best Practices and SEO are 100 on all six pages measured.
- **Native pickers are capped at 20 options** with search, so 86+ programmes never render as one
  list on a budget phone.
