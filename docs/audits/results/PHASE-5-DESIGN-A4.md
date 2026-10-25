# PHASE-5 (design refresh) — A4 Performance and Core Web Vitals

**Project:** UniversityFlow · **Phase:** 5, design refresh · **Date:** 2026-10-21
**Commit:** 38af297 (branch `phase-5/design-refresh`) · **Audit source:** tumoOLO_Audits A4 (brief `brief-A4.md`, same suite version as PHASE-5-A4)
**Result:** 0 Critical · 0 High · 1 Medium · 3 Low · 0 waived · 8 not measured

Scope: what the design refresh changed (`git diff 69f8baa..HEAD`): the self-hosted Outfit font,
glass (`backdrop-filter`), the CSS entrance animations, the split-stage front door and sign-in,
the `/home` dashboard and its SVG chart, the sidebar and the phone's Menu button, the rebuilt
chat, `/help`, and the native app's home and chat. Findings A4-01 to A4-13 are not repeated.
Independent reviewer, report only: no product code, test, config, budget or `status.md` was
changed.

**How it was measured.**
- **Builds:** the web build already in the worktree (`apps/web/.next`, BUILD_ID `C5GlF-TBjrJoZLCRZyTw3`,
  built 2026-10-20 12:38; no web or package source file is newer than it) and `apps/native/dist`
  (2026-10-21 15:59). Not rebuilt. The three CI budget scripts were run as they are.
- **Server:** `next start` on **port 3120** with the Playwright config's environment (fresh PGlite
  under `apps/web/.data/`, `UF_PROVIDERS=local`, `UF_LOCAL_PRODUCTION_BUILD=1`,
  `UF_CATALOGUE_PREVIEW=1`, `UF_CATALOGUE_E2E_FIXTURES=1`, no Anthropic key). One synthetic adult
  Grade 12 learner was made through the UI (two confirmed reports, so the chart has two points; one
  shortlisted course). Stopped afterwards; its `.data` folders deleted.
- **Lighthouse 12.8.2** (the cached copy the last A4 used), Chromium 1248 headless. Mobile = its
  default (simulated slow 4G, 4× CPU, Moto G profile); desktop = `--preset=desktop`. Signed-in
  pages with the session cookie as an extra header.
- **Traces:** Playwright + CDP (`Tracing`, `Input.synthesizeScrollGesture`, Event Timing) at 4× CPU,
  Pixel 7 and a 1366×768 desktop, each case run twice. To isolate a property's cost the same page
  was traced with one CSS override injected (`addStyleTag`), nothing else changed.
- **Caveat:** one shared Windows laptop near its memory limit; timings are noisy. Every finding
  rests on an A/B comparison or a count, not only on one timing.

---

## 1. Executive summary

The design refresh is light where it matters. Outfit is one 31.5 KB self-hosted variable woff2,
preloaded, `swap`, with a metric-matched fallback: **CLS is 0 on every page measured**. The front
door, sign-in, `/help` and the whole `/home` dashboard (chart included) render on the server with
no JavaScript of their own: `/home` is the lightest signed-in page at 140.8 KB first load and
`/help` matches `/` at 134.9 KB. The entrance animations are CSS only, transform and opacity, and
the LCP element is never one that starts invisible. The root chunks are unchanged (127.8 KB).
**Desktop Lighthouse is 100 on every page measured; mobile 94–99** (one cold-start run of 89
discarded, see §2). The suite's mobile LCP and TBT budgets still fail on the Next 16 + React 19
root chunk, as at the last A4; the observed (unthrottled) LCP equals FCP on every page
(257–587 ms), so no first screen waits on JavaScript to paint.

One design choice has a measured cost: `background-attachment: fixed` on `body` (the mauve haze)
makes desktop Chromium **repaint the whole viewport on every scroll frame** of every signed-in page,
and scrolling then **stops for as long as any main-thread task runs** (A4-14). Three Lows: the
phone's Menu button does nothing until hydration (~0.6 s after first paint on a mid phone), the
chat re-renders the whole conversation on every keystroke (a pattern the rebuild kept), and the
app's home now makes two requests in series on every return to it.

**Top risks**
1. A4-14: fixed body background: 1,359 main-thread paints (6.4 s paint + 12.4 s raster) over a 26 s scroll of `/results` at 4× CPU, against 31 (0.2 s + 0.6 s) without it; scrolling froze 572–587 ms during a 600 ms task, against 36–46 ms
2. A4-15: the phone Menu (the only way to every other signed-in page) is dead for 0.62–0.67 s after first paint (slow 4G, 4× CPU)
3. A4-16: typing in a 50-message chat costs 40–112 ms per key (p50) at 4× CPU, 16 ms in an empty one
4. A4-17: the app's home waits on `/api/me` then `/api/home` in series, on every focus
5. (Carried, not new) mobile LCP 2.2–2.8 s and TBT up to 220 ms on Lighthouse's simulation, from the root chunk; the 120 KB vs 150 KB root budget is still the owner's call (status.md, 2026-10-14)

---

## 2. Verdict against the budgets

### Lighthouse (two mobile runs where taken: `run 1 / run 2`)

| Page | Mobile score | Mobile LCP | Mobile TBT | CLS | Desktop score | Desktop LCP | Desktop TBT | LCP element (mobile) |
|---|---|---|---|---|---|---|---|---|
| `/` | 98 / 97 | 2.3 / 2.3 s | 120 / 130 ms | 0 | 100 | 0.5 s | 0 ms | the frost's title `p` (not animated) |
| `/sign-in` | 96 / 98 | 2.5 / 2.4 s | 150 / 80 ms | 0 | 100 | 0.5 s | 0 ms | the headline (`uf-rise`: transform only, never invisible) |
| `/help` | 94 (run 2) | 2.4 s | 220 ms | 0 | 100 / 100 | 0.5 s | 30 / 0 ms | lead `p` |
| `/home` | 94 / 99 | 2.6 / 2.2 s | 180 / 50 ms | 0 | 100 | 0.5 s | 0 ms | lead `p` |
| `/chat`, empty | 94 | 2.7 s | 190 ms | 0 | 100 | 0.6 s | 0 ms | hero `p` |
| `/chat`, 50 messages | 96 | 2.8 s | 60 ms | 0 | 100 | 0.7 s | 0 ms | a message |
| `/results` | 98 | 2.4 s | 90 ms | 0 | 100 | 0.6 s | 0 ms | lead `p` |

`/help` run 1 (89, TTFB 4.6 s) is discarded: it was the server's first request to call
`getServices()`, which opens and migrates the fresh PGlite database (a local-only cold start; run 2
TTFB 455 ms simulated, 28 ms measured with curl). Accessibility, Best Practices and SEO are **100
on every run**. Observed (unthrottled) FCP = LCP on every page: 257–587 ms. Last A4 (0554343): `/`
96 / LCP 2.2 s / TBT 160 ms; `/sign-in` 78 / 2.8 s / 720 ms (a noisy run).

| Metric | Budget | Actual | Verdict |
|---|---|---|---|
| Lighthouse performance, desktop (user's standard) | ≥ 90 | 100 on all 7 page states | **Pass** |
| Lighthouse performance, mobile (user's standard: measure, aim 90) | ≥ 90 | 94–99 | **Pass** |
| Lighthouse performance, mobile (suite) | ≥ 95 | 94–99 (`/help` 94, `/home` 94 run 1, `/chat` 94 empty) | **Fail** on 3 runs (carried: root chunk) |
| LCP (suite, simulated mobile) | < 2.0 s | 2.2–2.8 s | **Fail** (carried: Lantern puts the root chunk's 180–290 ms task before LCP; observed LCP 0.26–0.59 s) |
| CLS | < 0.05 | 0 everywhere | Pass |
| TBT (suite) | < 200 ms | 50–220 ms (`/help` 220) | **Fail** on 1 run (carried) |
| INP (field) | < 200 ms | No field data; lab Event Timing in §3 (A4-16) | Not measured (field) |
| A11y / Best Practices / SEO | 100 | 100 / 100 / 100 | Pass |
| First screen waits on no JavaScript (user's standard) | — | Front door, sign-in, `/help`, `/home` render on the server; animations CSS only; observed LCP = FCP | **Pass** for painting; the phone Menu waits on hydration (A4-15) |
| Fonts | < 90 KB | **31.5 KB**: one variable woff2 (100–900), Latin only | Pass |
| Root chunks (CI) | ≤ 150 KB gz, no zod locales | **127.8 KB**, none | Pass |
| Client chunks (CI) | no catalogue data, no zod locales, lean pages carry no other page's copy | 24 chunks clean; `/sign-in`, `/consent/[token]` clean | Pass |
| First-load JS | < 120 KB gz | 134.9 KB (`/`, `/help`) to 175.6 KB (`/chat`) | **Fail** (root floor 127.8 KB, carried) |
| Native bundles (CI) | within 5% of baseline | Android 3,096.7 KB (+83.5 KB, **+2.8%**), iOS 2,863.2 KB (+84.0 KB, **+3.0%**) | Pass, with ~60% of the tolerance used by this branch |
| Images | — | none (shapes are CSS, icons inline SVG) | N/A |
| Long tasks > 50 ms during a full scroll (4× CPU) | 0 | 0 on `/`, `/home`, `/results`, phone and desktop, except one of two phone runs on `/results` (2 tasks, the longest 55 ms) | Pass (almost) |

### Route sizes (gzip; `node scripts/ci/client-chunks.mjs apps/web/.next`)

| Route | First load | | Route | First load |
|---|---|---|---|---|
| `/chat` | 175.6 KB | | `/documents` | 145.1 KB |
| `/first-week` | 166.8 KB | | `/me` | 144.7 KB |
| `/campus` | 166.3 KB | | `/funding` | 143.0 KB |
| `/modules` | 149.1 KB | | `/results` | 142.8 KB |
| `/goals` | 148.5 KB | | `/onboarding` | 142.2 KB |
| `/offers` | 148.1 KB | | `/home` (new) | 140.8 KB |
| `/applications/[university]` | 146.4 KB | | `/applications`, `/results/what-i-need/[id]` | 140.8 KB |
| `/consent/[token]` | 140.4 KB | | `/sign-in` | 139.3 KB |
| `/help` (new) | 134.9 KB | | `/` | 134.9 KB |

Attribution (chunks mapped to routes from the client-reference manifests): `/home` downloads only
the root chunks, the shared 3.6 KB router chunk and the 9.4 KB signed-in shell chunk (the nav, its
21 icons, the Menu, Sign out): **the dashboard and the chart ship no JavaScript**. `/` and `/help`
add only `next/link` (3.5 KB). `/chat` is 174.0 KB before the refresh and 175.6 KB after (the
icons and starter notes, docs/design §2b). `/campus` and `/first-week` grew 9 KB since PHASE-5-A4
from a 13.2 KB chunk that holds Walk there and Read aloud: Phase 5e, not this branch. **No
per-route record exists at 69f8baa** and it was not rebuilt (see Not measured).

### Prefetching (checked, not a finding)

A desktop signed-in page makes 27 RSC prefetch requests (each sidebar and dashboard link, twice).
Each is a 318-byte route-tree stub that the server answers in 18–61 ms without rendering the page
(checked with `RSC: 1` + `Next-Router-Prefetch: 1`). On a phone the closed Menu hides the links, so
a page makes 15–18 requests in all.

---

## 3. Findings

| ID | Severity | Location | Finding | Why it matters (measured) | Fix |
|---|---|---|---|---|---|
| A4-14 | Medium | `apps/web/app/globals.css:68-75` (`body { background: radial-gradient(…), canvas; background-attachment: fixed }`) | The haze is a fixed-attachment background on `body`. Chromium can't scroll it on the compositor, so every scroll frame repaints the viewport on the main thread, and scrolling waits for the main thread | Desktop, 1366×768, 4× CPU, a full scroll down and up: **`/results` 1,359 paints, 6.4 s main-thread paint + 12.4 s raster in 26 s; with `background-attachment: scroll` 31 paints, 0.2 s + 0.6 s**. `/home`: 122 paints vs 4. With a 600 ms task on the main thread during a wheel scroll, the **longest gap between frames was 572 and 587 ms as built, 36 and 46 ms without the fixed background**: the page freezes under the learner's finger for as long as any task runs (hydration is 180–290 ms on a mid device; a streaming chat re-renders per token). Every signed-in page, Chrome and Edge on laptops and desktops (schools' budget Chromebooks included). Phone emulation showed no repaint either way; a real Android device and Firefox are Not measured; iOS Safari ignores `fixed` | Draw the haze on its own fixed layer instead: `body { background: var(--uf-color-canvas) }` and `body::before { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; background: radial-gradient(60rem 36rem at 85% -10%, var(--uf-glass-haze), transparent 70%) }`. Measured with exactly that injected: **longest gap 36 and 48 ms**, the look unchanged. Hold it with a test that fails on `background-attachment: fixed` in `globals.css` (a text guard like `page-width.test.ts`), proven on the current file |
| A4-15 | Low | `apps/web/app/(app)/nav.tsx:98-116` (Menu `button` with `onClick` + `useState`; the nav panel is `max-lg:hidden` until `open`) | On a phone the Menu is the only way to every other signed-in page, and it works only after React hydrates. A tap before that does nothing. The sideways link row it replaced was plain links, usable from first paint | Pixel 7, 4× CPU, slow 4G (150 ms RTT, 1.6 Mbps), 5 loads of `/home` and `/results`: FCP 832–884 ms, Menu working at 1,473–1,539 ms: **dead for 0.62–0.67 s after first paint** (longer on a real network). The E2E helper `goTo` already retries the tap for this reason (`e2e/helpers.ts:55-72`). Conflicts with the owner's "the first screen never waits on JavaScript" | Make the disclosure native: `<details>`/`<summary>` (it opens with no JavaScript) or a no-JS fallback; keep the client code only for Escape, closing on a page change and `aria-expanded`. Test: a Playwright check with JavaScript disabled opens the Menu and follows a link, proven to fail on the current component |
| A4-16 | Low | `apps/web/app/(app)/chat/chat.tsx:58-77, 170-213, 235` | `draft` lives in the same component as the message list, so every keystroke re-renders every message and artifact card; the new autosize effect then writes `height: auto` and reads `scrollHeight` (a forced layout) on each key. The list-per-keystroke pattern predates the refresh (69f8baa has it); the rebuild kept it | Event Timing while typing 95 characters, 4× CPU: **empty chat p50 16 ms, max 24–40 ms; 50 messages p50 48 ms / max 96 ms (phone), 40 / 80 ms (desktop) in a quiet run and 112 / 240 ms in a loaded one**. Script is ~90% of it (EventDispatch 1.5–2.3 s over 15 keys); style 32–39 ms, layout 57–69 ms. History loads up to 60 messages (`chat/page.tsx:15`) | Move the composer (draft state, autosize, submit) into its own component and pass `send` down, or wrap the message list in `memo` keyed on `messages`; size the field with `field-sizing: content` where supported (no script), else keep the effect. Test: a component test that counts renders of a message item while typing, failing on the current code |
| A4-17 | Low | `apps/native/app/index.tsx:26-43` | The app's home awaits `/api/me`, then `/api/home`, in series, and now on every focus (`useFocusEffect`; before the refresh it fetched `/api/me` once, on mount) | Two round trips before the dashboard shows, on every return to home: on a phone at a 4G RTT of 100–300 ms that is 200–600 ms of "Loading…" plus server time (`/api/me` 5 ms, `/api/home` 27–35 ms locally) | Ask `/api/home` first and fall back to `/api/me` only when it says the learner isn't ready (it already enforces `requireReady`), or fire both together; on focus, refresh in the background and keep the last data on screen. Test: a native test with a mocked `api` that asserts one request on a ready learner's focus, failing on the current code |

### Evidence for A4-14 (repeatable)

```js
// Playwright, desktop 1366×768, signed in, on /results after load:
await page.evaluate(() => setTimeout(() => { const t = performance.now(); while (performance.now() - t < 600) {} }, 300));
await cdp.send('Input.synthesizeScrollGesture', { x: 600, y: 400, yDistance: -3000, speed: 1500, gestureSourceType: 'mouse' });
// Trace category disabled-by-default-devtools.timeline.frame; longest gap between DrawFrame events:
// as built 572 / 587 ms · body{background-attachment:scroll} 36 / 46 ms · body::before fixed layer 36 / 48 ms
```

The traces themselves were kept in the session scratchpad only, not committed.

---

## 4. Not measured

| Check | Why |
|---|---|
| A real mid-range Android: cold start, scroll FPS, the GPU cost of the 20px `backdrop-filter` over the phone's whole frosted half with a second glass card (the bar) on top | No device. Headless Chromium composites in software, so its raster numbers don't stand for a phone GPU. Front-door scroll at 4× CPU in emulation: 0 main-thread paints and no long task with or without the blur, which proves only that it doesn't repaint on the main thread |
| `background-attachment: fixed` on Android Chrome (A4-14) | Chromium's mobile emulation drew no paints either way and its frame events were incomplete (3 `DrawFrame` events per scroll), so it can't answer this |
| Font swap on Android | The fallback face is `local(Arial)` with metric overrides (next/font's default). Android has no Arial, so its swap is unmatched; CLS was 0 in desktop Chromium, which has Arial |
| Safari, Firefox (the user's browser list) | Not installed for automation in this run; iOS Safari ignores `background-attachment: fixed` by design |
| INP in the field | No field data before launch |
| Brotli | The local `next start` serves gzip; Vercel's edge compression can only be checked once deployed. Cache headers checked: the font and CSS are `public, max-age=31536000, immutable`; HTML is `private, no-store` (per-request CSP nonce) |
| Route sizes at 69f8baa | No per-route record exists for the base commit and a second web build was not run (memory). Compared against PHASE-5-A4 and the design sessions' own notes in status.md and docs/design |
| Native: Reanimated, Hermes FPS, per-screen render cost of the new 639-line home | No device or profiler; bundle sizes measured with the CI script only. Outfit is not in the app yet |

## 5. Waived

None.

## 6. Remediation roadmap

**Quick wins (< 1 day)**
1. A4-14: replace the fixed body background with a fixed `::before` layer, plus a text guard. Largest measured effect (scroll stalls of ~0.6 s → ~0.04 s; 40× fewer paints)
2. A4-17: one request on a ready learner's home focus, keep data on screen while refreshing
3. A4-15: make the Menu a native `details` disclosure with JavaScript only as an enhancement

**Medium**
4. A4-16: split the composer from the message list (and `memo` the list) so typing costs the same in a long chat as in an empty one

**Structural (carried, owner's call)**
5. The suite's mobile LCP/TBT/first-load budgets fail on the 127.8 KB framework root chunk; chasing 120 KB or waiving it is the decision recorded on 2026-10-14
6. Native bundle tolerance: this branch used ~60% of the 5% headroom (+2.8% / +3.0%); Outfit through `expo-font` will add to it. Re-measure after that build before re-baselining (a person's call)

## 7. What's genuinely good

- **The font is done right:** one 32,292-byte variable woff2 for every weight, Latin only,
  self-hosted (`font-src 'self'`), preloaded by a `Link` header, `font-display: swap`, a
  metric-matched fallback (`ascent-override 100.84%`, `size-adjust 99.17%`), and immutable caching.
  CLS 0 on every page. Keep `next/font/local`; don't add a second family or static weights.
- **The dashboard is a server component:** `/home` ships no JavaScript beyond the shared shell, its
  SVG chart included (`components/marks-chart.tsx`: inline SVG, a `details` table, no library), and
  its data is fetched in one `Promise.all` (`lib/server/home.ts:47`), 27–35 ms per request locally.
  Don't move the chart to a client library.
- **`/help` renders the crisis card on the server** (134.9 KB, the same as `/`).
- **The entrance animations are what A4 asks for:** CSS only, once, transform and opacity, no
  scroll-triggered motion, off under reduced motion; the LCP element (the headline on sign-in, a
  plain paragraph on `/`) is never one that starts at opacity 0. Lighthouse found no
  non-composited animation on any warm run.
- **Glass has a fallback** (`@supports not (backdrop-filter…)`) and a forced-colours path, and the
  blurred "shapes" are plain CSS boxes under one backdrop blur, not `filter: blur()` elements.
- **The root chunks didn't move** (127.8 KB) and no client chunk carries catalogue data or zod;
  the prefetches the sidebar triggers are 318-byte stubs that render nothing.
- **Scrolling is clean apart from A4-14:** no long task over full scrolls of `/`, `/home` and
  `/results` on phone and desktop at 4× CPU (one phone run on `/results` aside: 55 ms at most); the chat's own scroll region repaints 10 times over
  3,000 px on desktop with no frame gap over 64 ms.

---

## Rows for status.md → Open findings

```
| A4-14 | A4 | Medium | apps/web/app/globals.css:68-75 | `background-attachment: fixed` on body: desktop Chromium repaints the viewport on every scroll frame (1,359 vs 31 paints on /results) and scrolling freezes during main-thread tasks (572–587 ms vs 36–46 ms) | Open | Draw the haze on a fixed `body::before` layer (measured 36–48 ms); a text guard against `background-attachment: fixed`, proven on the current file |
| A4-15 | A4 | Low | apps/web/app/(app)/nav.tsx:98-116 | The phone Menu (the only route to other pages) is dead until hydration: 0.62–0.67 s after first paint on slow 4G, 4× CPU | Open | A native `details` disclosure, JavaScript only for Escape and closing on navigation; a no-JS Playwright check |
| A4-16 | A4 | Low | apps/web/app/(app)/chat/chat.tsx:58-77 | Every keystroke re-renders the whole conversation (and forces a layout to autosize): p50 40–112 ms per key at 50 messages vs 16 ms empty, 4× CPU | Open | Composer in its own component, message list memoised; a render-count test |
| A4-17 | A4 | Low | apps/native/app/index.tsx:26-43 | The app's home fetches /api/me then /api/home in series, on every focus | Open | One request for a ready learner, refresh in the background on focus; a mocked-api test |
```

Audit ledger row (for the owner to add): `| 5 (design) | **A4** Performance | 0 | 0 | 1 | 3 | — | 2026-10-21 | Lighthouse desktop 100 on every page, mobile 94–99; root chunks 127.8 KB; Outfit 31.5 KB, CLS 0 |`
