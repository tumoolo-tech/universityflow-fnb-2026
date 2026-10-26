# PHASE-6 — A4 Performance (wave 10: #115–#134)

**Project:** UniversityFlow · **Phase:** 6 (audit wave 10) · **Date:** 2026-10-25
**Commit:** e09ad5b4 (branch `phase-6/audit-a2-a3-a4`) · **Audit source:** tumoOLO_Audits @ 29eafd7 (brief A4)
**Result:** 0 Critical · 0 High · 3 Medium · 1 Low · 0 waived · 5 not measured

Scope: `c0e1545c..e09ad5b4` as it reaches the browser: the front door's pictures (#133), course,
subject and offer pictures (#121, #133), colleges in Plan B (#131), the plan-map canvas (#130), the
module card and mark calculator (#129), Open Mmereko (#133), next 16.4.3 (#132). Findings A4-01 to
A4-18 are not repeated. Report only: no product code, test, config or budget was changed.

## How it was measured

- **Build:** `pnpm --filter @universityflow/web build` once in the worktree with `UF_DEPLOYMENT=demo`,
  `NEXT_PUBLIC_UF_DEMO_LOGOS=1` (under a suite lock).
- **Server:** `next start --port 3107` with demo-preview.ps1's environment (`UF_PROVIDERS=local`,
  `UF_CATALOGUE_PREVIEW=1`, `UF_CV=1`, `UF_MINDMAP_WORDS=1`, `UF_CV_MMEREKO_CANVAS=1`,
  `UF_DEMO_PHONE_SIGNUP=onscreen`), `DATABASE_URL=pglite:./.data/aud-browser`, its own AUTH_SECRET,
  no AI key. Learners started from `/demo` (Naledi Grade 11, Thabo Grade 10, Amahle Grade 12,
  Lerato first year). Stopped afterwards, its `.data` folders deleted.
- **Lighthouse 12.8.2** (`npx --yes lighthouse@12.8.2`), Chromium 1248 headless; mobile = its default
  (simulated slow 4G, 4× CPU), desktop = `--preset=desktop`; signed-in pages with the session cookie
  as `--extra-headers`. Each batch under a suite lock.
- **Playwright 1.64 + CDP** for document sizes, the RSC payload, image preloads, CPU-throttled
  interaction timing (4×) and layout-shift entries.
- **Caveat:** the laptop was shared. Batch r1 ran at 88% CPU load (Lighthouse `benchmarkIndex`
  850–1,290) and is reported but not used for verdicts; r2–r4 ran at 1–36% load (`benchmarkIndex`
  about 3,000).

## 1. Verdict

| Metric | Budget | Actual | Verdict |
|---|---|---|---|
| Lighthouse performance, desktop (owner's launch standard) | ≥ 90 measured | 97–100 on the six named pages; plan map 92; module card 100 | **Pass** |
| Lighthouse performance, mobile (owner: measure, aim 90) | aim ≥ 90 | 95–98 on `/`, `/demo`, `/home`, `/goals`; `/modules` 97 / 90; **`/results` 89 / 88**; plan map 89 / 93; module card 91 / 95 | **Miss on `/results`** (A4-19) |
| Lighthouse performance, mobile (suite) | ≥ 95 | as above | Fail on `/results`, the plan map, the module card, one `/modules` run |
| LCP (suite, simulated mobile) | < 2.0 s | 2.24–2.81 s; **`/results` 3.60–3.64 s** | Fail (carried root-chunk cost, plus A4-19 on `/results`) |
| CLS | < 0.05 | 0 everywhere, **except a plan map in the road layout: 0.12–0.18 on desktop** | **Fail** (A4-21) |
| TBT (suite) | < 200 ms | 62–164 ms in quiet runs; 257 ms once (`/modules`) | Pass, one noisy miss |
| INP (lab) | < 200 ms | **Opening Plan B / the colleges' group: 726–766 ms at 4× CPU** | **Fail** (A4-20) |
| A11y / Best Practices / SEO | 100 | 100 / 100 / 60–63 | SEO: `is-crawlable` only: the demo sends `noindex` on purpose. Not a finding |
| Root chunks (CI) | ≤ 150 KB gz | **129.3 KB** (was 127.8 KB at PHASE-5-DESIGN-A4) | Pass |
| Client chunks (CI) | no catalogue data / zod locales | 37 chunks clean | Pass |
| First-load JS | < 120 KB gz | 136.0 KB (`/`) to 189.9 KB (`/chat`) | Fail (carried root floor) |
| Fonts | < 90 KB | one Outfit woff2, 31.5 KB (unchanged) | Pass |

### Lighthouse, every run

Mobile = simulated slow 4G, 4× CPU. r1 ran under 88% machine load and is shown for completeness only.

| Page (learner) | r1 mobile (loaded) | r2 mobile | r3 mobile | r1 desktop | r4 desktop | Quiet mobile LCP | Quiet mobile TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | 72 (LCP 2.80 s, TBT 1,117 ms) | **98** | **98** | 100 | **100** | 2.24 / 2.24 s | 108 / 80 ms | 0 |
| `/demo` | 84 (2.65 s, 512 ms) | **97** | **96** | 100 | **100** | 2.34 / 2.31 s | 142 / 151 ms | 0 |
| `/home` (Naledi) | 90 (2.81 s, 291 ms) | **95** | **97** | 99 | **100** | 2.81 / 2.49 s | 89 / 71 ms | 0 |
| `/goals` (Naledi) | 74 (3.12 s, 819 ms) | **96** | **96** | 99 | **100** | 2.66 / 2.62 s | 87 / 68 ms | 0 |
| `/modules` (Lerato) | 77 (2.99 s, 695 ms) | **97** | **90** | 100 | **100** | 2.51 / 2.72 s | 62 / 257 ms | 0 |
| `/results` (Naledi) | 72 (3.98 s, 621 ms) | **89** | **88** | 97 | **97** | 3.60 / 3.64 s | 125 / 164 ms | 0 |
| `/goals/maps/<id>` (Naledi, road) | — | **89** | **93** | — | **92** | 2.66 / 2.62 s | 333 / 217 ms | mobile 0, **desktop 0.176** |
| `/modules/<reg>/DEMO1001` (Lerato) | — | **91** | **95** | — | **100** | 2.64 / 2.46 s | 275 / 179 ms | 0 |
| `/results`, demo logos blocked (A/B) | — | 91 | 86 | — | — | 3.33 / 3.80 s | 110 / 170 ms | 0 |

Desktop LCP: 0.55–0.75 s everywhere except `/results` 1.16–1.28 s (its LCP is a course picture,
`arts-800.avif`). Mobile LCP element: the page lead `p` everywhere (never an animated or
JavaScript-drawn element). Top opportunities in quiet runs: `unused-javascript` 29 KB (root chunk,
every page), `legacy-javascript` 13 KB (root chunk, every page), and on `/results` only:
`uses-responsive-images` 144 KB, `modern-image-formats` 94 KB, `offscreen-images` 60 KB (all the
demo logos, A4-22). Mobile LCP phases on `/results`: TTFB 454 ms, **render delay 3,147–3,188 ms**
(`/home`: 2,351 ms).

### JavaScript the new features load (gzipped first load, `scripts/ci/client-chunks.mjs`)

| Route | First load | Over the 129.3 KB root |
|---|---|---|
| `/goals/maps/[id]` (the canvas, #130) | 157.8 KB | +28.5 KB (canvas, map view and its editor) |
| `/modules/[registrationId]/[code]` (module card + calculator, #129) | 147.7 KB | +18.4 KB |
| `/modules` | 157.1 KB | +27.8 KB |
| `/goals` | 153.8 KB | +24.5 KB |
| `/cv` (Open Mmereko) | 156.5 KB | +27.2 KB |
| `/results` | 145.0 KB | +15.7 KB |
| `/`, `/demo`, `/help`, `/privacy`, `/colleges/registered` | 136.0 KB | +6.7 KB |

The calculator ships no copy and no catalogue records (`@universityflow/ui/mark-calculator`,
words as props); the CI chunk check passes.

## 2. Findings

| ID | Severity | Location | Finding | Why it matters (measured) | Fix |
|---|---|---|---|---|---|
| A4-19 | Medium | `apps/web/app/(app)/results/results-view.tsx:67-118` (every group's cards, Plan B's and 45 college cards included, rendered into `cards`), `results-list.tsx:48-176` (a client component receiving them as props, showing collapsed groups' cards only when opened) | The results page sends every card of every group in its RSC payload, the collapsed Plan B and colleges' groups included, though the HTML shows none of them until opened | **Document 1,149 KB decoded (66.6–68.5 KB gzip), of which the RSC flight scripts are 991–1,038 KB, for 1,716–1,789 DOM nodes**; the decoded flight (907 KB) holds `li` college cards (`aria-labelledby="c-letaba"` …, ~4.4 KB each) that are not in the DOM. `/subjects` is 113 KB, `/home` 56 KB. Mobile Lighthouse **88–89 (LCP 3.60–3.64 s, render delay 3.15–3.19 s vs 2.35 s on `/home`)**; PHASE-5-DESIGN-A4 measured `/results` at 98 / 2.4 s before #131. Blocking the demo logos (A/B) did not recover it (86–91), so the cost is the document, not the images. Same for Thabo (G10: the colleges' own group) and Amahle | Don't ship the collapsed groups' cards with the page: fetch them when the learner opens the group (a route handler or server action returning the group's rendered cards), or render the collapsed groups on the server inside native `details` so only one copy exists and the island filters with `hidden`; keep the server-rendered verdicts (A4-03). Test: a budget test on `/results`' HTML (for example ≤ 300 KB decoded for a G12 fixture) that fails today at 1,149 KB |
| A4-20 | Medium | `apps/web/app/(app)/results/results-list.tsx:127-169` (`isOpen` toggles render of all `shown` cards), `components/college-card.tsx` | Opening Plan B (G12) or "College courses after Grade 9" (G10) mounts every college card at once on the main thread | **726 ms (Amahle, 360 px) and 766 ms (Thabo, 1,280 px) from the click to the next frame at 4× CPU** for 45 college cards; INP budget 200 ms. Typing in the search box re-filters the same lists on each key | With A4-19's fix the cards arrive as HTML; otherwise render them in chunks (`useTransition` / `startTransition` so the button paints its new state first) and keep the collapsed lists' DOM once built. Test: a Playwright timing check at 4× CPU on the toggle (≤ 200 ms to next paint), failing today |
| A4-21 | Medium | `apps/web/app/(app)/goals/maps/[id]/plan-map-canvas.tsx:265-275` (`data-enhanced` set in `useLayoutEffect` after hydration), `apps/web/app/globals.css:2465`, `2548-2575` (`.uf-canvas-world--road` rules) | A plan map in the road layout jumps when the canvas takes the window over | **CLS 0.176 (Lighthouse desktop), 0.174 at 1,350×940 and 0.123 at 1,280×800 (Playwright `layout-shift` entries, one shift at 192–233 ms: `section.uf-map.uf-map--road`, `y 0→609, h 0→331`)**. Naledi's map (road); Thabo's (staircase) shifts 0 at both sizes; mobile 0. CLS > 0.1 is "poor" | Reserve the road world's size before hydration (the same container-query sizes the enhanced view uses, so server and client lay out alike), or set `data-enhanced` from a no-JS-safe class so the first paint already uses the canvas layout. Test: a Playwright check reading `layout-shift` entries on a road map at 1,350×940 (≤ 0.05), failing today |
| A4-22 | Low | `apps/web/components/university-mark.tsx:37-45` (demo `<img>` with no `loading`, `width`, `height`), `apps/web/public/demo-logos/` | On the judge demo every university and college logo is a plain eager `<img>`; React then emits a `<link rel="preload" as="image">` for each, including logos in collapsed groups | **`/results`: 37 image preloads, 39 images, 569–601 KB** (Chrome warns "preloaded but not used" for 31 college logos); `ukzn.png` is 110 KB for a ~20 px chip, `uct.svg` 29.7 KB. Demo only (`NEXT_PUBLIC_UF_DEMO_LOGOS`), removed after the hackathon | `loading="lazy" decoding="async" fetchPriority="low"` and explicit `width`/`height` on the demo logo; shrink `ukzn.png` to a 64 px WebP. Test: extend `college-demo-logos.test.tsx` to require `loading="lazy"` |

### Evidence

```text
# Document and payload (Playwright + CDP, 360 px)
Naledi /results: document transfer 66.6 KB (gzip), DOM nodes 1787, outerHTML 1145 KB, RSC flight scripts 991 KB
Amahle /results: document transfer 68.5 KB (gzip), DOM nodes 1716, outerHTML 1184 KB, RSC flight scripts 1038 KB
Naledi /subjects: 15.5 KB gzip, 624 nodes, 113 KB;  /home: 11.5 KB, 350 nodes, 56 KB
# Plan B toggle, CPU throttled 4x (Emulation.setCPUThrottlingRate), click -> rAF -> setTimeout
Amahle 360:  Plan B open in 726 ms at 4x; college cards 45
Thabo 1280:  College courses after Grade 9 open in 766 ms at 4x; college cards 45
# Layout shift (PerformanceObserver 'layout-shift', reducedMotion no-preference)
Naledi 1350x940 CLS 0.174 [uf-map uf-map--road 0->609 h0->331]; Naledi 1280x800 CLS 0.123; Thabo 0.000 / 0.000
```

## 3. Not measured

| Check | Why |
|---|---|
| A real mid-range Android (canvas pan/pinch frame rate, the coast after a flick, scroll on `/results` with 45 college cards open) | No device; headless Chromium composites in software |
| Safari and Firefox | Chromium only in this run (brief) |
| The live demo's own numbers (Vercel, brotli, edge caching) | Measured on `next start` locally (gzip); the live site was not load-tested (no writes allowed, sign-in needed) |
| INP in the field | No field data |
| Native app bundles | Out of this brief (A4-18 is open) |

## 4. Waived

None. (SEO `is-crawlable` on the demo is deliberate `noindex`, not a waiver of a real check.)

## 5. Remediation roadmap

**Quick wins (< 1 day)**
1. A4-22: lazy, sized demo logos and a smaller UKZN file.
2. A4-21: reserve the road world's size before hydration; a CLS check.

**Medium**
3. A4-19 + A4-20 together: stop sending the collapsed groups' cards with the page, and load or
   render them when opened. Largest measured effect: `/results` from 1.15 MB to roughly a sixth,
   mobile Lighthouse back toward the 98 it had before #131, and a Plan B tap that answers at once.

**Structural (carried)**
4. The root chunk (129.3 KB) keeps the suite's mobile LCP (< 2.0 s) and first-load (< 120 KB)
   budgets failing on every page, as recorded since 2026-10-14 (the owner's call).

## 6. What's genuinely good

- **Every page is ≥ 90 on desktop, measured** (97–100), and four of the six named pages are 95–98
  on mobile in quiet runs. CLS is 0 on every page except A4-21.
- **The pictures are done right**: AVIF/WebP `<picture>` at 400 and 800 widths, `loading="lazy"`,
  `fetchpriority="low"`, decorative (`alt=""`); the front door's people column is hidden below 64rem
  and a phone never downloads it (mobile Lighthouse on `/`: 0 image bytes). No picture is an LCP
  element on a phone.
- **The calculator is light**: the module card route is 147.7 KB, the calculator works in the
  browser from the resolved scheme with no catalogue data, and the CI chunk checks pass.
- **The canvas writes the view to custom properties once a frame, never through React state per
  move**; under reduced motion every move is a jump (0 running animations measured).
- **Root chunks moved by 1.5 KB only** across next 16.3.8 → 16.4.3 (#132): 127.8 → 129.3 KB.
- **Motion** (front door, home "settle", subjects meter): CSS, transform (and opacity on fades),
  600 ms once; none under `prefers-reduced-motion` (measured: 0 animations on every page).

## Rows for status.md → Open findings

```
| A4-19 | A4 | Medium | apps/web/app/(app)/results/results-view.tsx:67-118, results-list.tsx | /results sends every collapsed Plan B and college card in its RSC payload: 1,149 KB document (991 KB flight) for 1,787 DOM nodes; mobile Lighthouse 88–89, LCP 3.6 s (98 / 2.4 s before #131) | Open | Load or render collapsed groups' cards on open (or server-rendered details); an HTML-size budget test on /results |
| A4-20 | A4 | Medium | apps/web/app/(app)/results/results-list.tsx:127-169 | Opening Plan B / the colleges' group mounts 45 college cards at once: 726–766 ms to next frame at 4× CPU | Open | With A4-19, or startTransition/chunked render; a 4× CPU toggle timing check |
| A4-21 | A4 | Medium | apps/web/app/(app)/goals/maps/[id]/plan-map-canvas.tsx:265-275; globals.css .uf-canvas-world--road | A road-layout plan map shifts when the canvas enhances: CLS 0.12–0.18 on desktop (staircase 0) | Open | Reserve the road world's size before hydration; a layout-shift check at 1350×940 |
| A4-22 | A4 | Low | apps/web/components/university-mark.tsx:37-45 | Demo logos are eager unsized imgs: 37 image preloads, 569–601 KB on /results (ukzn.png 110 KB) | Open | lazy/async/low priority with width/height; a 64 px UKZN WebP; extend college-demo-logos.test.tsx |
```

Audit ledger row (for the integrator): `| 6 (wave 10) | **A4** Performance | 0 | 0 | 3 | 1 | — | 2026-10-25 | Desktop 97–100 on every page; mobile 95–98 except /results 88–89; root 129.3 KB |`
