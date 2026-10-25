# PHASE-5 design refresh — A3 Accessibility (WCAG 2.2 AA)

**Project:** UniversityFlow · **Phase:** 5 (design refresh) · **Date:** 2026-10-21
**Commit:** 38af297 (branch `phase-5/design-refresh`) · **Audit source:** tumoOLO_Audits A3 brief as supplied (sha not recorded in the brief) + `docs/audits/A3.project.md`
**Result:** 0 Critical · 0 High · 3 Medium · 3 Low · 0 waived · 7 not measured

**Scope:** what the design refresh changed, `git diff 69f8baa..HEAD`: the dark theme and tokens
(`packages/tokens`), the split stage (`/`, `/sign-in`, `components/split-stage.tsx`, `globals.css`),
the `/home` dashboard and marks chart (`components/dashboard.tsx`, `components/marks-chart.tsx`), the
grouped sidebar and phone Menu button (`app/(app)/nav.tsx`, `layout.tsx`), the rebuilt chat
(`app/(app)/chat/chat.tsx`), `/help` and the crisis card split (`components/crisis-card.tsx`,
`place-links.tsx`), `Page`/`StatusLine`/`EmptyState`, the course dropdowns (`study-choice.tsx`), the
preview notice; native `components/home.tsx`, `app/chat.tsx`, `PageHeader`/`EmptyState` and the outline
button (`components/ui.tsx`). A3-01..A3-22 are not re-reported.

## 1. Verdict

**Passes WCAG 2.2 AA with no blocking failure** (0 Critical, 0 High). Three Medium failures of
specific success criteria (1.4.12 text spacing on the split stage, 1.4.10 reflow of the chat at 400%,
2.4.3 focus order in the chat) each have a workaround and do not block the gate; they should be fixed
before the refresh ships to learners.

Executive summary: the refresh was built with accessibility in view and it shows. Every colour pair is
in a tested table, glass is composited over every backdrop, focus rings are a separate light blue that
measures 3:1 everywhere, reduced motion removes every animation (measured: zero animations, every
element at opacity 1), the phone Menu is a correct disclosure (Escape returns focus, measured), and the
chart has a real table. The problems are layout ones the design's "one screen" goal created:
a fixed-height, `overflow: hidden` stage that clips its own content when text grows, and a chat column
pinned to the viewport that leaves 29px of conversation at 400% zoom. Top risks:

1. A3-23: text spacing on the split stage cuts off the app name and headline, and the sign-in button.
2. A3-24: at 400% zoom (320x256) the chat's conversation is a 29px strip.
3. A3-25: a starter or the Send button drops keyboard focus to `<body>`.
4. A3-26: 320px plus text spacing scrolls sideways (the header row).
5. A3-27: the front door's four feature tiles are links all named for features but all go to sign-in.

## 2. Findings

| ID | Severity | Location | WCAG | Finding | Why it matters | Fix |
|---|---|---|---|---|---|---|
| A3-23 | Medium | `apps/web/app/globals.css:161-170` (`.uf-stage` `overflow: hidden`), `:364-376` (`height: 100dvh`, `justify-content: center` on `.uf-stage-sharp`), `:383-387`; `apps/web/app/sign-in/page.tsx:26-31` | 1.4.12, 2.4.11, 1.4.10 | From 64rem wide the stage is exactly the viewport tall (min 36rem) with `overflow: hidden`, and the sharp half centres its content. When content grows it spills out of **both** ends and cannot be scrolled to. **Measured** (Playwright, production build, the WCAG 1.4.12 override: line-height 1.5, letter-spacing 0.12em, word-spacing 0.16em, paragraph spacing 2em): on `/` at 1280x720 the app name sits at y −97..−67 (gone) and the `h1` at −11..151 (top cut); the same at 1097x617, 1024x600, 1366x768, 1280x577 and 1093x520. On `/sign-in` with the "That doesn't look like a South African cellphone number" error showing, **Send my PIN is clipped**: y 582-626 against a 617px stage at 1097x617, 604-648 against 600 at 1024x600 (entirely hidden), 580-624 against 577 at 1280x577. Without any override, at 1024x600 the app name on `/` is already half cut (y −17..15). | A learner who needs wider text spacing (dyslexia, low vision) loses the page's title and, on a short laptop window, cannot see or click the sign-in button (Enter in the field still submits; a keyboard user who tabs to the button has it focused off-screen, 2.4.11). | Let the stage grow instead of clip: `min-height: 100dvh` (not `height`) from 64rem, `overflow-x: clip` instead of `overflow: hidden` (the shapes only need horizontal clipping), and `justify-content: safe center` on `.uf-stage-sharp` and the frost column so overflow goes down, never up. Regression test: an E2E that injects the 1.4.12 style at 1024x600 and asserts every focusable in the stage is inside the document's scrollable area and the app name's top is ≥ 0. |
| A3-24 | Medium | `apps/web/app/globals.css:573-591` (`.uf-app:has(.uf-chat) { height: 100dvh }`, `min-height: 0` columns); `apps/web/app/(app)/chat/chat.tsx:123-127, 219-256` | 1.4.10 | On the chat the layout is pinned to the viewport and only the conversation scrolls. **Measured at 320x256 CSS px** (1280x1024 at 400%): header 61px, composer form 126px, **conversation region 29px tall**: one line of a reply visible at a time. At 320x640 it is 413px (fine). | A low-vision learner at 400% zoom reads the companion's answers, and the crisis card's helplines, through a one-line slot; the composer and disclaimer take four times the space of the conversation. 1.4.10 asks for content usable without two-dimensional scrolling and without loss of function; a 29px viewport is functionally a loss. | Pin the chat to the viewport only when there is room: wrap the `.uf-app:has(.uf-chat)` rules in `@media (min-height: 30rem)` (or similar), so on a short viewport the page scrolls normally with the composer in flow under the list (it still never covers it). Regression test: E2E at 320x256 asserting the conversation region is at least, say, 50% of the viewport height or the document scrolls. |
| A3-25 | Medium | `apps/web/app/(app)/chat/chat.tsx:151-165` (starter buttons unmount when the first message is added), `:243-251` (`disabled={busy \|\| !draft.trim()}` on Send), `:79-110` (`send` never moves focus) | 2.4.3 | **Measured:** keyboard focus on the first starter, Enter → `document.activeElement` is `BODY` at once and still `BODY` after the reply. Focus on Send (text typed), Enter → `BODY` (the button becomes `disabled` while busy, then stays disabled because the draft is empty). The behaviour predates the refresh (the old starters and Send did the same) but was carried into the rebuilt component; it is the A3-01 pattern, not covered by A3-01..22. | The next Tab starts from the top: the skip link, then 15 sidebar stops, before the learner is back at the composer. On a phone with a switch or keyboard, the same. | After `send()` starts, move focus to the composer (`fieldRef.current?.focus()`), so the learner can type the follow-up; on Send use `aria-disabled` (as `Button` already supports, A3-01) and ignore presses while busy instead of `disabled`. While there, give the starters' list a name of its own (it is labelled "Chat", the page's `h1`). Regression test in `test/chat.test.tsx`: activate a starter and Send, assert focus is on the textbox. |
| A3-26 | Low | `apps/web/app/(app)/nav.tsx:96-108` (`.uf-sidebar-head` row: brand + Menu, `justify-between`, no wrap) | 1.4.12 (and 1.4.10) | **Measured at 320x640 with the 1.4.12 override:** `/home` and `/chat` scroll sideways (scrollWidth 335 at a 320 viewport); the only element past 321px is the Menu button (right edge 335). Without the override, no sideways scroll at 320 on any page measured (`/`, `/sign-in`, `/help`, `/home`, `/chat`). | A 15px sideways scroll on every signed-in page for text-spacing users, and the Menu button partly off-screen. | Let the row wrap or shrink: `flex-wrap` on `.uf-sidebar-head`, or `min-w-0` with `truncate`/smaller brand under 22rem. Test: E2E at 320 with the override asserts no sideways scroll on `/home`. |
| A3-27 | Low | `apps/web/app/page.tsx:33-41`; `apps/web/components/split-stage.tsx:122-146` | 2.4.4 | The four "What we do together" tiles are links named "Your results", "Applications", "Funding", "Your campus", and all four go to `/sign-in`. A screen-reader user's links list shows four feature names that each open the sign-in form. (Passes 2.4.4 at a stretch, as the section heading gives context; noted because it misleads.) | Four links that say one thing and do another; a learner on a data bundle pays a page load to find out. | Either make the tiles a plain list (they describe what the app does; the bar and the phone's Get started already link to sign-in), or keep them as links and say where they go (`aria-describedby` to a visually hidden "Sign in to start", or visible "Sign in to see your results"). |
| A3-28 | Low | `apps/native/app/chat.tsx:227-234` | 1.3.1, 4.1.2 | A crisis reply is one `accessible` View whose `accessibilityLabel` is "Companion: <reply>". The card's heading ("If you need someone now", `accessibilityRole="header"`) is inside it, so it is neither read nor reachable by the VoiceOver rotor / TalkBack heading navigation: the grouped label replaces the children. Carried over unchanged from before the refresh (the design README says the crisis reply "stays a bordered card with its heading"; to a screen reader it has none). Code read; not run on a device. | The one reply that must not be missed loses the heading that marks it out for screen-reader users; it reads like any other message. The helplines artifact after it still has its own heading, so nothing is lost outright. | Start the label with the card title (`${en.crisis.cardTitle}. ${label}`), or don't group the crisis card (`accessible={false}` on the container, the header and body as their own elements). Test in `__tests__/chat.test.tsx`: the crisis reply exposes the card title by role header or in its label. |

## 3. Regression check (the brief's KI list)

The brief's KI items come from the shared audit's reference design; each is checked against what exists here.

| KI | Result |
|---|---|
| KI-01 orange surface with white text | **Not present.** No orange in `tokens.color`; the only filled buttons are mauve (`onBrand` dark plum on `brand`, 7.75) and danger (`onBrand` on `danger`, 8.04). |
| KI-02 accordion | **Not present as such.** Disclosures are native `details`/`summary` (preview notice, "Show as a table") and the phone Menu (`aria-expanded`, `aria-controls`). Measured: Menu opens with Enter, Tab enters it ("Home"), Escape closes it and returns focus to Menu (`aria-expanded` false). Collapsed: the list is `display: none`, out of the tab order. |
| KI-03 thumbnails reachable without a pointer | **Not present.** The front-door tiles are links and in the tab order (measured, first four Tab stops). |
| KI-04 reduced motion | **Fixed / holds.** With `prefers-reduced-motion: reduce` on `/` at 1280x720: `document.getAnimations()` = 0, every `.uf-rise`/`.uf-fade-rise` at opacity 1 and transform `none`, tile transition-duration 0s. Chat dots and starter lift have their own reduced-motion rules (`globals.css:645-653`); token durations drop to 0ms. |
| KI-07 decorative images | **Holds.** Every `Icon` is `aria-hidden`; the stage shapes and wordmark are `aria-hidden`; the chart drawing is `aria-hidden` with the table as its equivalent. No `<img>`. |
| KI-09 count-ups | **Not present.** Every number (stage numbers, headline number, days) is static text. |

## 4. Contrast (computed, not estimated)

The refresh's own tables (`TEXT_PAIRS`, `NON_TEXT_PAIRS`, `GLASS_PAIRS`) are tested in
`packages/tokens/src/index.test.ts`. Pairs the refresh renders that are **not** in those tables, computed
with the WCAG formula (sRGB alpha compositing as CSS does):

| Pair (where) | Ratio | Needs | |
|---|---|---|---|
| ink on `glass.pill` over the body's haze-over-canvas `#282128` (learner's bubble, chat) | 7.04 | 4.5 | pass |
| `lineStrong` vs haze-over-canvas (ask bar's edge) | 3.36 | 3 | pass |
| `accent` on `glass.pill` over surface (current nav item's icon) | 5.21 | 3 | pass |
| `focus` vs `stageTop` (focus ring on the charcoal) | 7.84 | 3 | pass |
| `inkMuted` on `warningSoft` / ink on `warningSoft` (preview notice) | 8.22 / 15.04 | 4.5 | pass |
| `lineStrong` vs surface (journey "to do" ring, chart's dashed marker) | 3.86 | 3 | pass |
| `line` vs surface / vs canvas (starter cards, journey boxes, icon-button edges) | 1.31 / 1.40 | n/a | the controls are identified by their text and icons, which pass; the hairline is not the only cue (1.4.11 does not require a boundary here) |

Focus rings, measured settled (after the 200ms colour transition): `#9CC2FF` on every signed-in stop and
in the glass cards; white on the frosted half's tiles. All 30 Tab stops on `/home` and all stops on `/`
and `/sign-in` had a 3px solid outline. Note: `* { transition-duration }` with the default
`transition-property: all` makes the ring fade in from the text colour over 200ms (for a primary button it
starts as dark plum); not a failure, but `transition-property` on `*` would avoid it.

## 5. Read-through (accessibility tree, not a real screen reader)

Derived from the DOM and roles; **not** an NVDA/VoiceOver transcript (see Not measured).

`/`: skip link · main · "UniversityFlow" · heading 1 "From Grade 11 to graduation" · separator · lead ·
heading 2 (visually hidden) numbers label, list of 3 ("6 universities"…) · "Results. Apply. Arrive." ·
"<title>" · heading 2 "What we do together", list of 4 links **(A3-27: all to sign-in)** · region (bar
label): list "Free for learners", "Your information stays in South Africa", link Get started, link I
already have an account. The wordmark is not read (aria-hidden), so the headline is heard once. Good.

`/home`: banner with the brand link and navigation "Main" (group names read as plain text before each
list) · note (preview, collapsed details) · main · heading 1 "Welcome, Sipho" · subtitle · links "Reminders
and messages", "About me" · heading 2 "Your journey" (hidden), ordered list of 5, the current step a link
"2 Shortlist Now" (number hidden; reads "Shortlist Now") · link "Ask your companion anything" · heading 2
"Next step", link "Shortlist the courses you want Start" · cards, each a region named by its heading 2 ·
"My marks over time": lead, drawing hidden, "Show as a table" disclosure with a captioned table (9 rows).
Heading levels never skip.

## 6. Not measured

| Check | Why |
|---|---|
| Real screen readers (NVDA, VoiceOver iOS/macOS, TalkBack) on `/`, `/home`, `/chat` and the app | None available in this session; §5 is from the DOM, not a listen-through. Live-region behaviour of the rebuilt chat (unchanged `aria-live` list) is therefore code-read only. |
| The native app (home, chat, PageHeader/EmptyState, outline button) on a device or simulator | No device or emulator run; touch targets are read from styles (`minHeight: theme.target`, 44pt), not measured; Dynamic Type at 200% not tried. A3-28 is from code. |
| Safari and Firefox | Only Chromium (Playwright) was run: `backdrop-filter` with the `-webkit-` prefix, the `@supports not` fallback, and `summary { display: flex }` (Safari hides the marker) not seen in those engines. |
| Forced colours / Windows High Contrast | The `@media (forced-colors: active)` rules were read, not rendered. |
| Text-only zoom (Firefox "Zoom text only", Android font size) | Not emulated; viewport-size zoom was measured instead. The display sizes use `vw`/`dvh` and will not grow with text-only zoom. |
| University-stage home (registration card, Getting ready, offers list) in a browser | The E2E learner measured was Grade 12 with two reports; the university cards were code-read. |
| The marks chart's value card at an average near 100% (overlap with the lead) | Not rendered at that value; visual only (the drawing is aria-hidden). |

## 7. Waived

None.

## 8. Remediation roadmap

- **Quick wins (< 1 day):** A3-25 (focus the composer after send; `aria-disabled` on Send), A3-26
  (wrap the header row), A3-27 (tiles as a list, or say where they go), A3-28 (crisis label), A3-23 (three
  CSS declarations: `min-height`, `overflow-x: clip`, `safe center`) with its E2E.
- **Medium:** A3-24 (a height media query for the pinned chat, and an E2E at 320x256).
- **Structural:** add the 1.4.12 override to the E2E suite as a standing check at 320px and at one short
  laptop size (1024x600) on every key page; it found three of the six findings here.

## 9. What's genuinely good

- **Every colour is proven, glass included.** `GLASS_PAIRS` composites each translucent colour over
  every backdrop it can sit over and over its no-blur fallback; the tables name where each pair is used.
  Keep this pattern for any light theme.
- **Focus is never the accent.** A separate light-blue ring (`focus`, 4.91 even on the nav pill) means
  focus can't be mistaken for "current page" or "selected"; on the glass it switches to white by a
  scoped rule, not per component.
- **Reduced motion is total and measured:** token durations to 0ms plus an `!important` backstop, and the
  headline only *rises* (never starts invisible), so nothing can be lost if an animation never runs.
- **The phone Menu is the simple, correct disclosure:** `aria-expanded`/`aria-controls`, the name stays
  "Menu", Escape returns focus (measured), it closes on route change, and one nav exists either way.
- **The chart has a real equivalent:** the drawing is hidden and a `details` table (caption, row and
  column headers, every subject on every report) carries the data without JavaScript.
- **The decorative wordmark is hidden** and the headline says the same thing once; the journey says
  Done/Now/To do in words, never by colour alone.
- **The chat's scroll region is focusable and named** ("Conversation"), and the composer is docked
  under it rather than over it (2.4.11).
- No sideways scroll at 320px on any page measured without overrides; the sidebar fits from 1920x920
  down to 1280x616 with 28-32px rows (above 2.5.8's 24px).

## Rows for status.md → Open findings

```
| A3-23 | A3 | Medium | apps/web/app/globals.css (.uf-stage, .uf-stage-sharp from 64rem); /sign-in | Split stage is viewport-tall with overflow hidden and centred content: with WCAG 1.4.12 text spacing the app name and h1 are cut off, and Send my PIN is clipped off-screen (1024x600, 1097x617, 1280x577) (1.4.12, 2.4.11) | Open | min-height not height, overflow-x: clip, justify-content: safe center; E2E with the 1.4.12 override at 1024x600 |
| A3-24 | A3 | Medium | apps/web/app/globals.css (.uf-app:has(.uf-chat)); chat.tsx | At 400% zoom (320x256) the chat's conversation region is 29px tall: the pinned layout leaves header 61 + composer 126 (1.4.10) | Open | Pin the chat to the viewport only above a min-height; E2E at 320x256 |
| A3-25 | A3 | Medium | apps/web/app/(app)/chat/chat.tsx (starters, Send) | A starter or the Send button drops keyboard focus to BODY (measured); the next Tab restarts at the skip link (2.4.3) | Open | Focus the composer after send(); aria-disabled on Send; name the starters list; unit test |
| A3-26 | A3 | Low | apps/web/app/(app)/nav.tsx (.uf-sidebar-head) | At 320px with 1.4.12 text spacing the header row (brand + Menu) scrolls sideways by 15px on every signed-in page (1.4.12) | Open | flex-wrap or min-w-0/truncate on the row; E2E at 320 with the override |
| A3-27 | A3 | Low | apps/web/app/page.tsx; components/split-stage.tsx (StageTiles) | Four front-door tiles are links named for features ("Your results", "Funding"…) that all go to /sign-in (2.4.4) | Open | Make them a plain list, or say they lead to sign-in |
| A3-28 | A3 | Low | apps/native/app/chat.tsx (MessageView, crisis) | The crisis reply's heading is swallowed by the grouped accessibilityLabel: not read, not in heading navigation (1.3.1) | Open | Put the card title in the label or ungroup; native test |
```
