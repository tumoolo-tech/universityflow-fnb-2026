# PHASE-5 (design refresh) — A2 Design fidelity

**Project:** UniversityFlow · **Phase:** 5, design refresh · **Date:** 2026-10-21
**Commit:** 38af297 (branch `phase-5/design-refresh`) · **Audit source:** tumoOLO_Audits A2 (brief `brief-A2.md`, Phase 4 text) with the Phase 5 common rules
**Result:** 0 Critical · 0 High · 0 Medium · 7 Low · 0 waived · 5 not measured

**Scope:** what the refresh changed, `git diff 69f8baa..HEAD`: `apps/web/app`, `apps/web/components`,
`apps/native`, `packages/tokens`, `packages/ui`. **Reference:** `docs/design/README.md` (the design
document A2-11 asked for) and `packages/tokens/src/index.ts`; project rules from `CLAUDE.md`
(hard rule 8). The brief's landing-page checks (12 sections, bokeh, zero radius, `.42em`, kerf
logo, orange glow) are for another product and were skipped, not counted.

**Evidence used:** the owner's screenshots of every signed-in page at 1530, 1280, 1024 and 390px,
before and after the latest change (`scratchpad/shots/before`, `after`, with `gaps.tsv`); the front
door and sign-in rendered for this audit from the existing production build (`next start` on port
3457, local stand-ins, server stopped afterwards) at 1280x720, 1440x900, 1024x768 and 360x800 with
Playwright measurements; the built CSS in `apps/web/.next/static`; `packages/tokens` unit tests
(135 passed) and `node scripts/checks/index.mjs` (all guards pass).

---

## 1. Executive summary

**Fidelity verdict: faithful, with minor drift.** The refresh does what `docs/design/README.md`
says. The split stage fits one screen at every laptop size measured (scroll height equals the
viewport at 1280x720, 1440x900 and 1024x768), and nothing scrolls sideways at 360px. The wordmark
crosses the split at the exact middle, in light ink on the charcoal and pink on the glass. Outfit
loads from our own origin. Every signed-in page has the same 24px rhythm under its title at all
four widths. Every colour comes from the tokens, and every new pair, including the translucent
ones, is held by a test that composites it over its backdrops. No High or Medium was found. The
drift is in places where the home and chat re-spell a primitive or step outside the token scale,
and in comments that still describe the first draft of the theme.

Top risks (all Low):
1. **A2-21:** on the home's headline card, the empty state's outline button is pink, while every other outline button is ink. The README promises calm outline buttons.
2. **A2-22:** two outline buttons are hand-written, and one, About me's "Download my data", still has the old mauve outline. The A2-18 test doesn't catch outline copies.
3. **A2-23:** the home re-spells `Card` and `PageHeader`. Its cards have 16px padding where other pages have 20px, its card titles are `text-xl` where others are `text-lg` (undoing A2-20's single size), and its title-to-lead gap is 4px where others are 8px.
4. **A2-24:** the chat and sign-in use Tailwind sizes the tokens don't have. The chat hero's `sm:text-4xl` does nothing, because Tailwind's 4xl equals the tokens' 3xl.
5. **A2-26:** the font fallback stack is typed by hand in `app/layout.tsx`, so `tokens.font.family` is never reached on the web.

## 2. Findings

| ID | Severity | Location | Finding | Why it matters | Fix | Test (fails today) |
|---|---|---|---|---|---|---|
| A2-21 | Low | `apps/web/components/dashboard.tsx:219` (`[&_a]:text-accent`), `:247-252` | `HeadlineCard` colours every `a` inside it with the accent. In the empty state the card's outline button "Add your Grade 11 report" (`ButtonLink variant="secondary"`, which sets `text-ink`) is an `a`. The descendant selector (0,1,1) beats `.text-ink` (0,1,0), so the button renders pink. Seen in `after/home-1280.png` and `home-390.png`: pink beside the ink "Browse my results" and "See how applications work". The card's "Not yet: …" sentence (`:247`) is also ink, where the other empty cards (`:326`, `:373`) and `EmptyState` use `text-muted`. | README §2, "Outline buttons are calm: a neutral `lineStrong` outline and ink text, the mauve only on hover, focus and a pressed or current state", and "One rhythm": an empty card is "one muted sentence". This is the first card on the home, so it is the most visible exception. | Scope the accent to the text link only: give the "See my results" link `text-accent` and drop `[&_a]:text-accent`. Give `t.none` `text-muted`. | A `dashboard.test.tsx` case renders the empty Grade 11 home and asserts that the headline card's `a` with the add-report href has no ancestor class `[&_a]:text-accent`, or that its class list matches `buttonLook('secondary')`. Today it fails. |
| A2-22 | Low | `apps/web/app/(app)/me/me-view.tsx:135-140`; `apps/web/components/dashboard.tsx:131` | Two outline buttons are spelled by hand outside `buttonLook`. (1) About me's "Download my data" is `rounded-md border-thick border-brand px-5`, with no text colour, so it is brand on a brand outline: the pre-refresh secondary look. In `after/me-1280.png` it is the only pink-outlined button on a page whose other buttons follow the new style. (2) The home's "Start" is `border-thick border-line-strong px-4` (`buttonLook` uses `px-5`), with no `bg-surface` and its own hover. `primitives.test.tsx` (A2-18) only forbids copies of `rounded-md bg-brand`, so outline copies get past it. | A2-18 made `buttonLook` the one place a button's look lives, so that a change reaches every button. The refresh changed that look, and the export link didn't follow. | Make (1) `<ButtonLink href="/api/me/export" variant="secondary" className="self-start">`. It is a download, so either let `ButtonLink` take `download`, or keep `<a>` with `className={buttonLook('secondary')}` exported from `ui.tsx`. For (2), export `buttonLook` and use it on the span. | Extend `primitives.test.tsx` to forbid `border-thick border-(brand\|line-strong)` together with `rounded-md` and `px-` outside `components/ui.tsx`. Two hits today. |
| A2-23 | Low | `apps/web/components/dashboard.tsx:44,72,219,300`; `apps/web/components/marks-chart.tsx:37,39`; vs `apps/web/components/ui.tsx:213,317` | The home re-spells the primitives rather than using them, and comes out different. (1) **Padding:** `Panel`, `HeadlineCard`, `PromoCard` and `MarksChart` use `p-4` (16px). `Card` and `EmptyState` use `p-5` (20px). Measured on the 1280 screenshots: text sits 17px inside a home card and 21px inside My results' empty card (border included). (2) **Card titles:** the home's are `text-xl`. Card titles elsewhere are `text-lg` (About me, campus, offers, modules), the single size A2-20 settled on. (3) **Title to lead:** `gaps.tsv` measures 4px on `/home` (`gap-1`, `:72`) and 8px on every other page (`PageHeader`'s `gap-2`). | README "One rhythm": every titled page shares one header and one gap, "as on the home". The home is the page the others were measured against, and it is the one that differs. A2-20 is fixed in status.md, and the home reopens it. | Build `Panel`, `HeadlineCard` and `PromoCard` on `Card` (passing `className` for the glow), and pick one padding for both. Use `PageHeader` for the home's title and subtitle (it accepts a ReactNode title for the accent name). Pick one card-title size and record it in the README. | `page-rhythm.test.tsx` adds `/home` to the title-to-lead check (8px). A test asserts that every `section` titled by an `h2` in `Dashboard` carries `Card`'s padding class. |
| A2-24 | Low | `apps/web/app/(app)/chat/chat.tsx:120` (`max-w-3xl`), `:132` (`text-3xl sm:text-4xl`), `:193` (`leading-relaxed`); `apps/web/app/sign-in/page.tsx:28` (`max-w-md`); `apps/web/app/(app)/layout.tsx:26` (`lg:w-60`) | Sizes taken from Tailwind's default theme, not from `packages/tokens`. `globals.css` maps only `--text-sm`…`--text-3xl` and `--container-prose/page`, so these resolve to Tailwind's own values. Built CSS: `--text-4xl: 2.25rem`, `--container-3xl: 48rem`, `--leading-relaxed: 1.625`, `--container-md: 28rem`. Since the tokens' `3xl` is also 2.25rem, the chat hero's `sm:text-4xl` step changes nothing: 36px at every width. The chat's message line height (1.625) is not the tokens' `normal` (1.55). | Hard rule 8. A change to the type scale or widths in the tokens won't reach the chat hero, the conversation column, the sign-in card or the sidebar. The README already gives the 48rem column as a design value, so it belongs in `tokens.maxWidth`. | Add `maxWidth.chat: '48rem'`, `maxWidth.form` and `sidebar` (`15rem`) to the tokens, mapped in `@theme`. Drop `sm:text-4xl`, or add a `4xl` token if the hero should grow. Use the tokens' leading. Longer term, have `@theme` reset Tailwind's defaults (`--text-*: initial; --container-*: initial; --leading-*: initial`) so an unmapped class fails the build rather than falling back. | A guard case in `checks.test.mjs`: `className="max-w-3xl"` and `text-4xl` in `apps/web` are flagged. Or a test that the built CSS defines no `--text-4xl`/`--container-3xl`. Both fail today. |
| A2-25 | Low | `apps/web/app/globals.css:72,269,347,351,362,368,445,459,469,542,620`; `apps/web/components/split-stage.tsx:136` | Design values written into the new CSS rather than taken from tokens: the stage rule's width `3rem` (`:269`), the entrance's rise `0.75rem` (`:459,469`) and `ease-out` easing (the tokens have durations but no easing), the starter lift `-2px` (`:620`), the haze gradient's size and position (`60rem 36rem at 85% -10%`, `120% 90% at 100% 0%`), the stage's `min-height: 36rem`, and the `64rem`/`50rem` breakpoints that `targetPointer`/`targetDense` depend on. The guard checks CSS for colours only. Related motion detail: the stage tiles lift on hover (`group-hover:-translate-y-0.5`) even under reduced motion, where they jump instantly. README §2b says the chat's starter cards don't lift under reduced motion (`globals.css:650`), and the tiles should match. | Each value is small, but together they are the stage's look, and nothing ties them to the tokens: a second surface that wanted "the same rise" would retype it. The breakpoints are why the sidebar fits without scrolling, yet they live apart from the targets they switch. | Add `motion.rise`, `motion.lift` and `easing.enter` and `breakpoint.laptop`/`breakpoint.shortScreen` tokens (in `toCss`; breakpoints as documented constants, since CSS can't use variables in media queries), plus `space`-based rule width. Add `motion-reduce:group-hover:translate-y-0` to the tiles. | A tokens test that `toCss()` emits `--uf-easing-enter` and `--uf-rise`, and a guard case flagging `translateY(<number>` in `apps/web/**/*.css`. Fails today. |
| A2-26 | Low | `apps/web/app/layout.tsx:19`; `apps/web/app/globals.css:32,61`; `packages/tokens/src/index.ts:124-126` | The web's fallback stack is typed by hand in `localFont({ fallback: ['system-ui','Segoe UI','Roboto','Arial','sans-serif'] })`, which differs from `tokens.font.family` (no `-apple-system`, `Noto Sans` or `Helvetica Neue`). next/font puts that list inside `--font-outfit`, ending in `sans-serif`, so `var(--font-outfit), var(--uf-font)` never reaches the token stack. Measured computed `font-family`: `outfit, "outfit Fallback", system-ui, "Segoe UI", Roboto, Arial, …`. `tokens.font.brand` ('Outfit') is used nowhere. | The tokens' comment says `family` is "the web's fallback while it loads", and it isn't. A change to the token stack would move the app and not the site (hard rule 8). | Pass the fallback from the tokens: `fallback: tokens.font.family.split(',').map(s => s.trim().replace(/'/g,''))`. Drop the redundant `var(--uf-font)` or keep it knowingly. Use `tokens.font.brand` where the family is named, or remove it. | A web unit test that `layout.tsx`'s fallback equals the parsed `tokens.font.family`. Fails today. |
| A2-27 | Low | `apps/web/app/globals.css:155-157`; `apps/web/components/split-stage.tsx:10,14`; `packages/tokens/src/index.ts:232-233`; `apps/native/lib/theme.ts:4,12` | Comments describe the theme's first draft and contradict the README and the code. globals.css: wordmark "near-black on the sharp side and white on the glass" (it is light ink and pink). split-stage: "sharp on the canvas" and "ink on the canvas, light on the glass" (it is the charcoal stage, and pink on the glass). Tokens: "The stage's rule … `brand` on `stageBottom`" (the rule is `ink`, `globals.css:271`). Native theme: "planning.md Q16" (superseded for the web) and "the system font … as on the web" (the web now loads Outfit). | A2 depends on the code saying what the design is. The next person to tune the wordmark or the rule will read the comment first. | Correct the five comments. Point the tokens' `brand`/`stageBottom` pair comment at what actually uses it, or retire the pair if nothing does. | None needed (comment-only). |

### Earlier findings the refresh changed (not re-reported)

| ID | Change |
|---|---|
| A2-01 (Medium, Open) | **Widened.** The new CSS uses the token scale (`var(--uf-space-5)` = 24px for stage, sidebar and group padding), while the utilities beside it use Tailwind's (`p-5` = 20px, `gap-6` = 24px = the tokens' `space.5`, not `space.6` = 32px). The README states the page rhythm in Tailwind's units ("`gap-6` (24px)"). Built CSS still has `--spacing: .25rem`. The fix is unchanged: map `--spacing-*` to the tokens. |
| A2-02 (Medium, Open) | **New instances on native, none recorded in the README.** The headline card is a 2px brand border (`Card emphasis`, `apps/native/components/home.tsx:207,236`) where the web has a hairline and glow. Next step's "Start" is brand text (`:90`) where the web has an outline button. A to-do step's number is ink (`:113`) where the web has muted (`dashboard.tsx:186`). Native `theme.text.caps` is weight 500 (`theme.ts:120`) where the web's `.uf-caps` is 700 (`globals.css:287`). The chat starters have no icon. README §4 says "the web's dashboard in one column"; record each as a platform decision or align it. |
| A2-11 (Low, Open) | **Addressed:** `docs/design/README.md` exists and is the reference this audit used. Closing it is the owner's call. |
| A2-12 (Medium, Partly fixed) | **Addressed:** the web nav is a grouped sidebar from 64rem (labels distinct from links, a current-page pill, fitting without scrolling down to 1280x616 per the README), and a Menu disclosure on a phone. Native home lists screens grouped by stage. Seen on every after/*-1280 and *-390 screenshot. Recommend closing it after the owner's review. |
| A2-18 (Low, Fixed) | Its test misses outline copies: see A2-22. |
| A2-20 (Low, Fixed) | The home reintroduces a second card-title size: see A2-23. |

## 3. Project-specific checks

| Check | Result |
|---|---|
| Colours from tokens (hard rule 8) | **Pass.** `no-raw-design-values` passes. No hex or rgb in app code. SVG chart colours are `stroke-*` classes and `var(--uf-color-brand)`. |
| Every new colour pair tested | **Pass.** `TEXT_PAIRS`, `NON_TEXT_PAIRS` and `GLASS_PAIRS` cover the stage, glass, haze, nav pill, chart line and welcome accent. Each translucent colour is composited over each listed backdrop and its fallback. Tokens test: 135 passed. Pairs spot-checked against the screenshots: the pill on the sidebar's `surface` and the haze over `canvas`/`surface` are as listed. |
| Fluid sizes match the README | **Pass.** Tokens `display.wordmark/number/headline` are exactly the README's triples. Measured: headline 54px at 1280x720 and 60px at 1440x900 (the cap), 32px at 360. Wordmark 136.8px at 1280x720 (19dvh) and 56px at 360 (the minimum). |
| Split stage fits one screen | **Pass (measured).** `scrollHeight == clientHeight` on `/` and `/sign-in` at 1280x720, 1440x900 and 1024x768. At 360x800, vertical scroll only (`scrollWidth` 360). The wordmark copy doesn't overflow (`scrollWidth - clientWidth = 0`). |
| Wordmark crossing | **Pass.** At 1280 the clip line is at x=640, the grid's middle. Light ink left, accent right (`a2shots/front-1280x720.png`). Phone: frosted copy only. |
| Type (Outfit, self-hosted) | **Pass.** `document.fonts` shows `outfit` loaded. Fallback: A2-26. |
| One rhythm / one width | **Pass except the home's lead gap.** `gaps.tsv`: 24px under every title at all four widths. Title-to-lead 8px everywhere but `/home` (4px, A2-23). |
| Outline buttons calm | **Pass except** A2-21 and A2-22. |
| Motion | **Pass.** CSS only, on load. `animation: none` and 0ms durations under reduced motion. The headline only rises, so it never starts invisible. Tile lift: A2-25. |
| Touch targets | **Pass.** 44px on a phone. 32/28px pointer rows on the sidebar from 64rem (recorded). The preview notice's "More" is 36px (`lg:min-h-9`) from 64rem: above WCAG 2.5.8's 24px, but not in the README's list of pointer sizes (see §6). |
| Before vs after the latest change | Home, campus, first week and the UJ pack are byte-identical. Results, What I need, Documents, Offers, Modules, Goals, Funding, Me and Help changed (EmptyState, outline buttons). The after screenshots show the calm outline everywhere except A2-21 and A2-22. |

## 4. Not measured

| Check | Why |
|---|---|
| `/chat` rendered | No screenshot supplied, and signing in on a fresh server wasn't worth the memory on this machine. Judged from code (`chat.tsx`, `globals.css:572-664`). |
| Native app on a device | No simulator. Code review only (`home.tsx`, `chat.tsx`, `ui.tsx`, `theme.ts`). |
| Safari / Firefox, forced colours, the no-`backdrop-filter` fallback | Chromium only. The `@supports not` and `forced-colors` rules were read, not rendered. |
| Contrast as rendered over the blurred shapes | Pairs computed from tokens (composited). The blur's real output over `haze`/`brand` wasn't pixel-sampled. |
| 1366x768, 1920x1080 and 1280x616 (the README's other sizes) | Not re-measured. The README records Playwright measurements for them. |

**Tool artifact, not a finding:** in the full-page screenshots the sidebar's background stops after
one viewport (e.g. `after/me-1280.png` around y=995). The sidebar is `lg:sticky lg:top-0 lg:h-dvh`
(`layout.tsx:26`), so in a real window it stays in view while the page scrolls. A full-page capture
paints it only once.

## 5. Waived

None.

## 6. Deliberate deviations register

| Deviation | Reason | Recorded |
|---|---|---|
| One dark theme from the owner's two pictures; Q16's paper-and-green identity superseded for the web | Owner's pictures, 2026-10-19 | README intro, §5 |
| Non-zero radii and 1px hairlines (the brief's zero-radius, 2px rules) | Those rules are another product's; this identity uses `radius.sm/md/lg/full` | Tokens; README §1–3 |
| Outfit on the web only; the app keeps the system font | `expo-font` needs a native rebuild | README §3.3, §4 |
| Sidebar rows 32/28px from 64rem | So the sidebar never scrolls; above 24px | README "Fit the screen" |
| Chat column 48rem; the preview notice hidden on `/chat` | A centred conversation; the composer line says it instead | README §2b (the width isn't a token: A2-24) |
| The app's headline card, Next step and caps weight differ from the web | — | **Not recorded** (A2-02) |
| The preview notice's "More" at 36px from 64rem | — | **Not recorded** |
| Mauve gradient fill and dashed marker in the chart; no legend | One series; the table is the accessible version | README §2 "The chart" |

## 7. Remediation roadmap

- **Quick wins (< 1 day):** A2-21, A2-22, A2-26, A2-27, the tile's reduced-motion class in A2-25, and recording the A2-02 native differences.
- **Medium:** A2-23 (home on `Card`/`PageHeader`, one card-title size), A2-24 (width and size tokens, and resetting Tailwind's unmapped defaults).
- **Structural:** A2-01 (map `--spacing-*` to the tokens: it moves every 20px utility to 24px, so it needs a screenshot pass), and the motion, easing and breakpoint tokens in A2-25.

## 8. What's genuinely good

- **Translucency is tested properly.** `GLASS_PAIRS` composites each rgba over every colour it can sit on, and over its no-blur fallback. Most dark-glass designs never prove their contrast, and this one does it in a unit test.
- **The stage fits the screen by construction, not by luck.** Display sizes use `min(vw, dvh)`, and the grid gives the content row `minmax(0,1fr)`. Measured: the scroll height equals the viewport at three laptop sizes.
- **The wordmark crossing is two clipped copies in one grid cell**, so the colour change lands exactly on the split with no JavaScript. It is `aria-hidden`, with the headline carrying the words.
- **One rhythm is measured, not asserted.** `Page`, `StatusLine` (`empty:sr-only`) and `EmptyState`, with `page-rhythm.test.tsx`, gave 24px under every title at every width in `gaps.tsv`.
- **The chart needs no library or client JavaScript.** An inline SVG with `non-scaling-stroke`, a `details` table as the accessible version, and an honest sentence when there are fewer than two points.
- **The sidebar's labels can't be mistaken for links** (small uppercase muted text, not focusable). Its dense mode is driven by tokens (`targetPointer`, `targetDense`), not by guesswork.

## Tool runs

- `npx vitest run src/index.test.ts` in `packages/tokens`: 135 passed.
- `node scripts/checks/index.mjs`: all guards pass.
- Playwright (Chromium) against `next start -p 3457` (the existing build, local stand-ins, pglite):
  `/` and `/sign-in` at 1280x720, 1440x900, 1024x768 and 360x800. Screenshots and the script are in
  the session scratchpad (`a2shots/`). Server stopped and its temporary database removed afterwards.
- Built CSS (`apps/web/.next/static/**/*.css`): `--text-4xl: 2.25rem`, `--container-3xl: 48rem`,
  `--container-md: 28rem`, `--leading-relaxed: 1.625`, `--spacing: .25rem`.

## Rows for status.md → Open findings

```
| A2-21 | A2 | Low | apps/web/components/dashboard.tsx:219,247 | The home's headline card paints its empty-state outline button pink (`[&_a]:text-accent`) and its "Not yet" line in ink, unlike every other outline button and empty card | Open | Scope the accent to the text link; `text-muted` on the sentence; dashboard test |
| A2-22 | A2 | Low | me/me-view.tsx:135; dashboard.tsx:131 | Two hand-written outline buttons; "Download my data" keeps the old mauve outline. The A2-18 test misses outline copies | Open | Use `ButtonLink`/`buttonLook`; extend primitives.test.tsx to outline copies |
| A2-23 | A2 | Low | dashboard.tsx, marks-chart.tsx | The home re-spells Card/PageHeader: 16px vs 20px padding, `text-xl` vs `text-lg` card titles (undoes A2-20), 4px vs 8px title-to-lead | Open | Build the home's cards on `Card` and its header on `PageHeader`; add `/home` to page-rhythm |
| A2-24 | A2 | Low | chat/chat.tsx:120,132,193; sign-in/page.tsx:28; (app)/layout.tsx:26 | Tailwind default sizes outside the tokens (48rem column, `text-4xl` = 3xl so a no-op, `leading-relaxed`, `max-w-md`, `w-60`) | Open | Width tokens; drop or tokenise 4xl; reset Tailwind's unmapped defaults in @theme |
| A2-25 | A2 | Low | apps/web/app/globals.css (stage, chat), split-stage.tsx:136 | Rise distance, lift, easing, rule width, haze geometry and breakpoints hand-typed; stage tiles still lift under reduced motion | Open | Motion, easing and breakpoint tokens; `motion-reduce` on the tiles |
| A2-26 | A2 | Low | apps/web/app/layout.tsx:19 | The font fallback stack is hand-typed and differs from `tokens.font.family`, which is never reached; `font.brand` unused | Open | Pass the fallback from the tokens; test it |
| A2-27 | A2 | Low | globals.css:155; split-stage.tsx:10,14; tokens index.ts:232; native theme.ts:4,12 | Comments describe the first draft (near-black/white wordmark, canvas, brand rule, Q16, system font "as on the web") | Open | Correct the comments |
```
