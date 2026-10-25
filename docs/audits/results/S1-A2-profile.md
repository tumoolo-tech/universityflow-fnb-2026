# S1 (profile look) — A2 Design fidelity and accessibility

**Project:** UniversityFlow · **Phase:** 5, S1 (profile design step 8) · **Date:** 2026-10-23
**Commit:** 4b415b5 (branch `phase-5/profile-step-8`), fixes on the same branch · **Audit source:** tumoOLO_Audits A2 (design fidelity against the tokens and the design document) with WCAG 2.2 AA checks, as the brief asked
**Result:** 0 Critical · 0 High · 5 Medium · 10 Low · 0 waived · 10 not measured (browser and device checks, §4)
**After fixes:** 4 Medium and 3 Low fixed test-first; 1 Medium and 7 Low open, none blocking.

**Scope:** the About me card and "Make it yours" (including the photo controls and the crop), on
the web and in the app, at 360px and 1280px. Files: `apps/web/app/(app)/me/profile-look.tsx`,
`profile-photo.tsx`, `apps/web/components/avatar.tsx`, the card's and the photo's blocks of
`apps/web/app/globals.css`; `apps/native/components/profile-look.tsx`, `profile-photo.tsx`,
`look-drawing.tsx`, `apps/native/lib/motion.ts`; `packages/tokens` (`PROFILE_THEME_PAIRS`,
`TEXT_PAIRS`, `NON_TEXT_PAIRS`); `packages/ui` (`look-drawing.ts`, `photo-crop.ts`).
**Reference:** [docs/design/profile-look-proposal.md](../../design/profile-look-proposal.md)
(approved), [docs/design/README.md §2d](../../design/README.md), `packages/tokens`.

**Evidence used:** code only. This audit ran with no browser, Playwright, dev server or device
(the session's rules), so every layout and screen-reader finding is read from the code and the
CSS cascade, and the checks that need a real browser or phone are listed in §4 for the
integrator, who runs Playwright and axe at 360 and 1280 on a production build. Unit suites run:
tokens, web (the card's and the photo's files), native (the card's three files).

---

## 1. Executive summary

**Verdict: faithful to the approved design, accessible in its structure, with focus and reflow
gaps.** The card is one DOM in reading order with the decoration hidden; every colour comes from
the tokens and every pair but one is tested; every animation has a reduced-motion path on both
platforms; the crop has a keyboard path and a button for every drag (WCAG 2.1.1, 2.5.7); every
target is 44px. Nothing reached High: no control is unreachable and no text fails contrast.

What was wrong:
1. **A2-28, A2-29 (Medium, fixed):** Save, Cancel and Remove photo hid or unmounted the focused
   control, and the zoom buttons were `disabled` at their limits, so keyboard focus fell to
   `<body>`: the A3-01 pattern again, in new code.
2. **A2-32 (Medium, fixed; confirm in a browser):** from 40rem the floating words never wrap and
   start 66 to 68% across, so the longest ("First in my family to go") ran past the poster and the
   card's `overflow: hidden` cut it off at 40 to 48rem, which is also a 1280 laptop at 200% zoom.
3. **A2-31 (Medium, fixed):** the app's theme swatches had no visible names; the web's do.
4. **A2-35 (Medium, open):** in the app, a screen reader reaches the grade and the words before
   the name's header, and "My words" is not read on iOS.
5. **A2-39 (Low, open):** at 40rem and up the words are `position: relative`, not `absolute`: the
   chip's base rule, later in the file, wins the cascade, so each word's offset adds the height
   of the words above it.

## 2. Findings

| ID | Severity | Location | Finding | Failure scenario | Fix | Test | Status |
|---|---|---|---|---|---|---|---|
| A2-28 | Medium | `apps/web/app/(app)/me/profile-look.tsx:65-82, 172-180` (before the fix) | 2.4.3 Focus order. Save and Cancel sit inside the picker, which `hidden={!open}` hides on both. The focused button is no longer rendered and focus falls to `<body>`. | A keyboard learner saves their look: the next Tab starts from the top of the page; a screen-reader user hears "Saved." and is then nowhere. | `useFocusAfter` moves focus to the "Make it yours" button after Save and Cancel (`profile-look.tsx:57, 78, 88`), as My goal and My offers do (A3-01, A3-11). | `test/profile-look.test.tsx` "puts focus back on Make it yours…": failed first with `expected <button>Save</button> to be <button>Make it yours</button>`. E2E: `toBeFocused()` after Save. | **Fixed** (9676630) |
| A2-29 | Medium | `apps/web/app/(app)/me/profile-photo.tsx:93-166, 233-238` (before) | 2.4.3. Save, Cancel and Remove photo unmount the pressed button (the crop closes; Remove goes once there is no photo). Zoom in and Zoom out were `disabled` at their limits, which drops focus from the button just pressed. | A learner presses Zoom in four times: the button disables on the last press and focus goes to `<body>`. After Save the next Tab starts from the top. | Focus goes to the photo button (Add or Change photo) after each of the three; zoom buttons use `aria-disabled` (A3-12's rule) and the clamp in `zoomCrop` makes a press at a limit do nothing. | `test/profile-photo.test.tsx` "keyboard focus (A2-29)": 3 tests failed first (`expected <body> to be <input …>`; `expected true to be false` for `disabled`). | **Fixed** (19512ad) |
| A2-30 | Low | `packages/tokens/src/index.ts:307-320`; used by `buttonLook('quiet')` (`text-brand`), `Checkbox` (`accent-brand`) and the secondary button's hover and focus edge, all on the card's ground | Design fidelity, hard rule 8's "every pair tested". The picker sits on the card's soft-to-canvas ground. `brand` on `canvas` is tested; `brand` on the seven soft colours was not. Today 6.37 (ocean) to 7.01 (protea), so nothing fails. | A new theme with a lighter soft colour, or a lighter `brand`, would put Cancel and Remove photo below 4.5:1 with no test to catch it. | `['brand', soft, 'text']` added to `PROFILE_THEME_PAIRS` (7 pairs). | `index.test.ts` "has every pair the card uses": 7 failed first (`expected […] to deep equally contain ['brand','profileMauveSoft','text']`). | **Fixed** (87989d2) |
| A2-31 | Medium | `apps/native/components/profile-look.tsx:418-450, 556-565` | 1.4.1 Use of colour, and the proposal §2.4 ("Theme names are words, not swatches alone"). The app's swatches were colour circles; the name was only in `accessibilityLabel`. The web shows each name under its swatch. | A sighted learner who can't tell Ocean from Fynbos (or Jacaranda from Mauve) has nothing but colour to choose by. | `Choice named` shows the label under the swatch (`theme.text.small`, `ink` on the page: a tested pair). | `__tests__/profile-look.test.tsx` "names every theme in words…": failed first with `Unable to find an element with text: Mauve`. | **Fixed** (0ba282d) |
| A2-32 | Medium | `apps/web/app/globals.css:623-653` (float), `:724-733` (`white-space: nowrap`), `:483-488` (`overflow: hidden`) | 1.4.4 Resize text, 1.4.10 Reflow. From 40rem the words float at `left: 66%`, `4%`, `68%` and never wrap. "First in my family to go" is about 240px with its padding. The poster is at most 40rem; at a 40 to 48rem window (no sidebar until 64rem) the card is narrower still. | A laptop at 1280 zoomed to 200% is a 640px viewport: the card is about 608px wide, a word at 66% starts at about 401px and ends at about 639px, and the card cuts off its last 30px. The same on a 640 to 760px tablet. | `.uf-look-chips > .uf-look-chip { max-width: 30%; white-space: normal }` from 40rem, in its own block at the end of the layer: every word now ends by 98% across. | `test/profile-look.test.tsx` "keeps a long word inside the poster": failed first (`expected '' to match /white-space: normal/`), proven again by reverting the CSS. **E2E added** (`e2e/profile-look.spec.ts` "long words stay whole…"): the three longest words inside the card at 360, 640 and 1280. | **Fixed** (8384b62); **confirm in a browser** (§4) |
| A2-33 | Low | `apps/web/app/(app)/me/profile-look.tsx:216-236` (before) | 1.3.1 Info and relationships. Initials, Icons and Patterns were plain `p` headings above their tiles inside one radio group. | A screen reader reads 19 pictures in a row with no kind ("Rocket, radio, 2 of 19"…), and the visible headings aren't conveyed. | Each kind is a `fieldset` with the heading as its `legend`, inside the one `radiogroup` (arrow keys still move through all 19). | "opens as a disclosure…" extended: failed first with `Unable to find an accessible element with the role "group" and name "Initials"`. | **Fixed** (ac1fcba) |
| A2-34 | Low | `apps/native/components/profile-look.tsx:496-505` (before) | 4.1.3 Status messages. The web's "2 of 3 chosen" is a live region; the app only showed it. | A TalkBack user ticks a word and hears only "checked", not how many remain. | `toggleWord` announces the new count (`announce`, the app's way, A3-02). | "lets three words be chosen…": failed first (`Expected: "3 of 3 chosen"`). | **Fixed** (cbc2d1a) |
| A2-35 | Medium | `apps/native/components/profile-look.tsx:321-414` (`figure`, chips `:368-385`, intro `:386-402`) | 1.3.2 Meaningful sequence, 2.4.6 Headings. The app's poster renders the figure (the grade sticker's text) and the words before the name's header, so assistive tech meets them first; the web puts the `h2` first. The words' `accessibilityLabel` "My words" sits on a View that isn't `accessible`, which iOS ignores (and `list` has no iOS role). | VoiceOver reads "Grade 10. Future engineer. Loves maths. Thando, heading." A learner who moves by headings jumps to "Thando" and skips the grade and the words, which come under the previous heading. | Device-dependent, so left open: either render the intro first and lay the poster out with absolute positions measured `onLayout` (as the line already is), or hide the visual sticker and words (`importantForAccessibility="no-hide-descendants"`) and add one accessible summary after the header ("Grade 10. My words: …"), checked with VoiceOver and TalkBack. | A native test that the header is the first accessible element of `look-poster`, after the fix. | Open |
| A2-36 | Low | `apps/native/components/profile-look.tsx:520, 531` | 2.4.3 in the app. Save and Cancel unmount the picker, with the pressed button in it. The app announces "Saved.", but nothing sets accessibility focus. | VoiceOver's focus lands on whatever iOS picks (often the screen's top) after Save or Cancel. | `AccessibilityInfo.setAccessibilityFocus(findNodeHandle(toggleRef))` after the picker closes, as a shared helper in `components/ui.tsx`. | A native test spying `setAccessibilityFocus`. | Open |
| A2-37 | Low | `apps/native/components/profile-photo.tsx:43, 189-195` | 1.4.10 in the app. The crop window is a fixed 320pt (`space.8 × 5`). On a 360pt phone with the screen's 16pt padding it fits (328pt), but on a 320pt-wide screen (iPhone SE first generation, or iOS Display Zoom) it runs 32pt past the edge. | On an SE the right of the crop and its guide ring are off screen. | `width: '100%'`, `maxWidth: VIEWPORT`, `aspectRatio: 1`, and the image's position in percentages (the crop view already is). | A native test that the viewport style has no fixed width. | Open |
| A2-38 | Low | `apps/native/components/profile-look.tsx:666-680`; `apps/web/app/globals.css:692-709` | 1.4.4 and 1.4.12. The grade sticker is a fixed circle (80pt in the app, 5rem on the web) with "Grade 10" inside. The web's rem scales with the text, but text spacing doesn't; in the app the largest Dynamic Type sizes grow the text and not the circle. | At the largest accessibility text size in the app, "Grade 10" spills out of the circle over the avatar's ring. | App: `minWidth`/`minHeight` with padding instead of a fixed size (or `maxFontSizeMultiplier`, a weaker fix). Web: `min-width`/`min-height` and padding. Confirm on a device and with a text-spacing bookmarklet. | A native test that the sticker has no fixed `width`. | Open |
| A2-39 | Low | `apps/web/app/globals.css:633-637` vs `:724-725` | Design fidelity (the CSS doesn't do what it says). The media block sets `.uf-look-chip { position: absolute }`, but the base `.uf-look-chip { position: relative }` comes later in the same layer with the same specificity and wins. So from 40rem the words are relatively positioned in the floating list: each `top` is added to the height of the words above it (about 40px and 80px for the second and third). | Works by accident: the owner approved the poster as rendered, but anyone tuning the percentages will see them land lower than written, and a fourth word (if the cap rises) would pile up. | Raise the media rule's specificity (`.uf-look-chips > .uf-look-chip { position: absolute }`) and re-tune `top` against the approved screenshot, with the owner's eye. Not changed here: it moves the approved look and needs a browser. | A CSS test that the floating words' `position: absolute` isn't overridden later in the file. | Open |
| A2-40 | Low | `apps/native/components/profile-look.tsx:281-298`; `apps/native/lib/motion.ts:10` | Motion quality. `useReduceMotion` says `true` until the phone answers (the safe default), so the card first shows at rest; when the answer is "motion is fine" the entrance starts: the words jump to invisible (`chips.setValue(0)`) and fade back, and the name drops 8pt and rises. | Every learner without Reduce Motion sees the words flash off and on as About me opens. Not a WCAG failure (it is once, under 1s), but it isn't the designed entrance. | Start the entrance only if the answer arrives before the first layout, or keep the words visible and animate only the rise; or hold the card's first paint until the answer (a few ms). | A native test that `chips` never goes from 1 to 0. | Open |
| A2-41 | Low | `apps/web/app/globals.css:1283-1292` | Usability on touch (2.5.7 is met: buttons do every drag). The crop is `touch-action: none` and 18rem wide: on a 360px phone it is 288 of the 328px column. | A learner who scrolls the page with a thumb on the photo moves the photo instead of the page. | `touch-action: none` only while a drag has started (pointerdown on the window), or a smaller crop on a phone; check on a phone. | E2E on a touch-emulated 360px page: a vertical swipe outside the crop scrolls. | Open |
| A2-42 | Low | `apps/web/app/(app)/me/profile-photo.tsx:230-240` | 1.3.1, 4.1.2 polish. The zoom slider's value is read as "1.25" with no unit. | A screen-reader user hears "Zoom, 1.25, slider" and can't tell how far in that is. | `aria-valuetext` from a new content key, e.g. "125%" (`en.profilePhoto.zoomValue(percent)`): a new key for the owner's review. | A web test of `aria-valuetext`. | Open |

### Checked and passing (no finding)

| Check | Result |
|---|---|
| Roles, names, states (web) | The card is a `section` named by its `h2`; the words a `ul` named "My words"; "I'm", "Hello", the line and the avatar `aria-hidden`; the photo `alt=""` (the name is said). The disclosure has `aria-expanded` and `aria-controls`. Themes and pictures are native radios in `role="radiogroup"` groups named by their headings; the tagline a labelled `select`; the words a `fieldset` of checkboxes with a polite live count; the fourth `aria-disabled` with `aria-describedby` to its reason. Errors are `Notice tone="danger"` (`role="alert"`); "Saved." a `role="status"` line outside the hidden picker. |
| Roles, names, states (app) | The name `accessibilityRole="header"`; decoration `accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`; swatches and tiles `radio` with `checked`; the disclosure button `expanded`; the fourth word `disabled` with its reason as the hint; Save announces "Saved."; the photo crop's picture hidden, every move a button. Order: A2-35. |
| Focus visible | Web: the global 3px `focus` ring; swatches and tiles show it on their label through `:has(input:focus-visible)`; the crop window has its own; `focus` on every soft colour, `surface` and `canvas` is a tested pair. |
| Keyboard (2.1.1) and dragging (2.5.7) | Every choice is a native control. The crop: arrow keys and + / − on the focused window, a slider, and a button for each zoom and move: dragging is never the only way. |
| Targets (2.5.8, the project's 44px) | Swatches, tiles and word pills `min-height`/`min-width: var(--uf-target)`; buttons `min-h-11`; the slider `min-height` 44px. App: every `Choice`, `Radio`, `Checkbox` and `Button` at `theme.target`. |
| Contrast | Every colour on the card and the picker is in a tested list: `PROFILE_THEME_PAIRS` (accent on surface, canvas and soft; ink, inkMuted and now brand on soft; onAccent on accent; focus and lineStrong on soft), `TEXT_PAIRS` (ink, inkMuted, brand on canvas and surface; brand on surfaceSunk for the quiet button's hover; danger on dangerSoft), `NON_TEXT_PAIRS` (lineStrong and focus on canvas, surface and surfaceSunk). The app's picker is on the page (`canvas`). The crop's dashed guide is `ink` over the learner's own photo, a guide on content, not a control. |
| Reduced motion (hard rule 9) | Web: the card's line, words, rise, wiggle and pop are `animation: none` under `prefers-reduced-motion`, the line a solid stroke, and every duration token is 0ms there (the global rule); the photo adds no animation. App: no `Animated.timing` with a duration while `useReduceMotion()` is true (tested); the line is solid from the first frame (`PosterLine`). |
| Reflow at 360px (1.4.10) | One column, no absolute layout of text below 40rem, the curve hidden, the name `overflow-wrap: anywhere`, the crop `min(100%, 18rem)`; the existing E2E asserts no sideways scroll at 360 and 1280 with the picker closed and open. |
| Forced colours | Read, not rendered: the selected swatch's ring is `Highlight`; the selected tile keeps its (forced) ring and unselected tiles have none; every swatch and tile has a visible or programmatic name, so the swatch fills disappearing is acceptable. To confirm (§4). |

## 3. Earlier findings this touches

| ID | Note |
|---|---|
| A3-01, A3-11, A3-12 | Their rules (focus never to `<body>`; `aria-disabled` not `disabled`) were not followed by the new picker and crop: A2-28, A2-29. Worth a guard: a test in `primitives.test.tsx` that flags `disabled={` on a `Button` in `apps/web/app` outside a form's submit. |
| A2-02 (Medium, open) | Platform differences recorded in README §2d: the tagline is a select on the web and radios in the app; the theme change cross-fades only on the web. |

## 4. Not measured: checks for the integrator (a browser or a device)

Run on a production build (`pnpm --filter @universityflow/web build`, then `test:e2e`), and on a phone:

| # | Check | How | Proves |
|---|---|---|---|
| 1 | The new E2E "long words stay whole…" (360, 640, 1280) and the `toBeFocused()` after Save | `pnpm --filter @universityflow/web test:e2e -- profile-look` | A2-32, A2-28 in a real browser |
| 2 | axe with the picker open **and the photo switch on**, the crop open | Locally with `UF_PROFILE_PHOTO=1`; pick a JPEG; `expectAccessible` at 360 and 1280 | The crop's roles, the slider's label, the buttons |
| 3 | Screenshots of the poster at 640 and 1280 with the three longest words | `UF_E2E_SHOTS=…` (the new test saves `long-words-*`) | That wrapped words look right; whether the second word overlaps the grade sticker (A2-39's offsets) |
| 4 | Keyboard pass: Tab through the picker, arrow keys in each radio group, Save/Cancel, the crop's keys | Chrome, Firefox, Safari | Visible focus on the labels (`:has(:focus-visible)` is Safari 15.4+, Firefox 121+) |
| 5 | Forced colours | `page.emulateMedia({ forcedColors: 'active' })` or Windows contrast themes | Selected swatch and tile still show; names visible; patterns distinguishable |
| 6 | Text spacing (1.4.12) at 1280 | The WCAG text-spacing bookmarklet | Words, sticker, tagline not clipped (A2-38 on the web) |
| 7 | Reduced motion | The existing E2E (no running animation, solid line) | Unchanged by these fixes |
| 8 | The crop by touch on a phone | A real phone or touch emulation | Drag moves the photo; A2-41 |
| 9 | VoiceOver and TalkBack on the app's card and picker | A device on the new build (react-native-svg) | A2-35 reading order, A2-36 focus after Save, "My words" read |
| 10 | Largest Dynamic Type / font scale, and a 320pt screen | iPhone SE or Display Zoom; Android font size 200% | A2-37, A2-38 in the app |

## 5. Waived

None.

## 6. Deliberate deviations register

| Deviation | Reason | Recorded |
|---|---|---|
| The tagline is a native select on the web, radios in the app | RN has no native select; radios read better than a picker | README §2d |
| No theme cross-fade in the app | RN can't animate the colour of many views cheaply; instant is the reduced-motion behaviour anyway | README §2d |
| The tagline in `ink`, not `inkMuted` as the proposal said | The poster's tagline is white in the picture; both pairs tested | README §2d table |
| Picture tiles named for a screen reader only (web and app) | The icons are pictures to choose by sight; names are for assistive tech, as in the proposal | README §2d |

## 7. Remediation roadmap

- **Quick wins:** A2-42 (one content key), A2-37 and A2-38 in the app (layout props), A2-36 (a
  shared focus helper in the app).
- **With a browser and the owner's eye:** A2-39 (absolute words, re-tuned), A2-41 (touch on the
  crop).
- **With a device:** A2-35 (the app's reading order), A2-40 (the entrance on a real phone).

## 8. What's genuinely good

- **One set of drawings for both platforms.** "Hello", the line and the icons come from
  `packages/ui` (`look-drawing.ts`), so the app and the web can't drift.
- **The pairs are generated from the themes**, so a new theme can't skip a contrast test, and
  each accent is held apart from focus and every status by colour distance, not by eye.
- **The crop is fully operable without a pointer** and was designed that way from the start, with
  the file name never leaving the browser.
- **The card is whole without JavaScript** (server-rendered, transform-only entrance), so the first
  screen never waits on script.
