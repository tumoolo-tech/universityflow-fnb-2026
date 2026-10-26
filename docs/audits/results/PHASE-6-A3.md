# PHASE-6 — A3 Accessibility, WCAG 2.2 AA (wave 10: #115–#134)

**Project:** UniversityFlow · **Phase:** 6 (audit wave 10) · **Date:** 2026-10-25
**Commit:** e09ad5b4 (branch `phase-6/audit-a2-a3-a4`) · **Audit source:** tumoOLO_Audits @ 29eafd7 (brief A3 + `docs/audits/A3.project.md`)
**Result:** 0 Critical · 0 High · 0 Medium · 6 Low (new) · 2 known findings confirmed (A10-65, A7-24) · 0 waived · 5 not measured

Scope: the pages changed in `c0e1545c..e09ad5b4` (brief-aud-browser.md §1–7): the front door,
`/demo`, `/demo/guide`; results, subjects and offers with pictures; the polish of every signed-in
page; the plan-map canvas; the module card and calculator; colleges (Plan B, filters,
`/colleges/registered`); Open Mmereko. Earlier A3 findings (A3-01 to A3-31) are not repeated.
Report only; nothing was changed.

## Method

Production build of e09ad5b4 as the judge demo on `next start :3107` (environment in
PHASE-6-A4.md), Chromium (Playwright 1.64), dark theme, `prefers-reduced-motion: reduce`, at
360×780 and 1280×800; learners from `/demo`: Naledi (Grade 11), Thabo (Grade 10), Amahle
(Grade 12, 17), Lerato (first year). For every page: axe-core (`wcag2a, wcag2aa, wcag21a, wcag21aa,
wcag22aa`, as the E2E helper), a Tab walk recording each stop's focus style and whether a
fixed/sticky element covers it (2.4.11), a target-size sweep (2.5.8), horizontal overflow; 400%
zoom (a 320×256 CSS viewport) with and without the 1.4.12 text-spacing override on 17 pages;
running animations under reduced motion; contrast of text over the new pictures measured by
hiding the text and taking the lightest pixel under it. The canvas, calculator, colleges and
Mmereko dialog were operated by keyboard and by mouse in scripts (bodies kept in the session
scratchpad, `aud-br-*.mjs`). No screen reader was run.

## 1. Verdict

**Passes WCAG 2.2 AA on what was measured, with two known findings now confirmed** (A10-65 the
crisis card on a zoomed canvas, A7-24 the mark field's keyboard) and six Lows. **axe: 0 violations
on all 70 page states** (35 pages × 2 widths) and in every dialog and opened state tested.

| Check | Result |
|---|---|
| axe WCAG 2.2 AA | 0 violations on every page at 360 and 1280, Plan B and colleges open, calculator with an invalid mark, crisis card shown, canvas dialog, Mmereko dialog |
| Focus visible (2.4.7) | Every Tab stop on 19 pages × 2 widths has a ring (the sr-only file inputs ring their label through `:has(:focus-visible)`) |
| Focus not obscured (2.4.11) | 0 stops covered by a sticky or fixed element on any page |
| Target size (2.5.8) | No failing target outside inline text links (exempt) and the zoomed-out canvas (A3-37) |
| Reflow 400% (1.4.10) | 0 sideways scroll on 17 pages at 320 px |
| Text spacing (1.4.12) at 320 | 27 px sideways on the module card (A3-32); 4 px on Lerato's home (below a finding); the rest 0 |
| Reduced motion (2.3.3, hard rule 9) | 0 running animations on every page with `reduce`; with motion allowed: front door `uf-rise`/`uf-fade-rise`, home `uf-settle`, subjects `uf-meter-fill`, 600 ms, once, transform/opacity |
| Text over pictures (1.4.3) | Worst measured 8.49:1 (muted faculty line over a course picture); offer titles 14.36:1; subject names sit on their own opaque chip |

## 2. Known findings re-checked

**A10-65 (the plan map's crisis card inside the zoomable canvas): CONFIRMED.** Thabo's staircase
map at 1280×800, picture view, "Fit to view" (49%), mouse click on "Edit Finish Grade 11", typed
crisis words, clicked Save. The care panel (`plan-map-view.tsx:495`, rendered inside `mapSection`,
which sits inside `.uf-canvas-world`, `plan-map-canvas.tsx:671-700`) is drawn at the canvas's
scale: **title 24 px drawn at 11.7 px, body 17 px drawn at 8.3 px; the panel is 106×935 px inside a
974×544 window, and 5 of the 6 helpline "Call" links are outside the visible window** (only "Call
0800 36 36 36" is in view). Focus does move to the title ("Talk to someone now", an `h2`). In the
full-screen dialog at fit (59%): title 14.2 px, body 10.1 px, panel 129×1,135 px, again mostly
outside the window. At the start view (90%) the card is close to readable size but still clipped
by the window. Screenshots: scratchpad `aud-br-shots\a1065-1280-fit-crisis.png`,
`a1065-1280-dialog-fit-crisis.png`. The overlay's rule ("helpline numbers readable and dialable,
never … behind a disclosure") fails here: the numbers are behind pan and zoom at the moment a
learner has written crisis words. **Severity: this audit recommends High** (a learner in crisis
can't read the numbers without operating the canvas). Fix: render the care panel outside the
canvas world (after the canvas card, in page flow, or as a top-layer element) whenever the
picture view is shown, and/or reset the view to 100% centred on it; test that its title's drawn
font size equals its CSS size and every `tel:` link is inside the viewport after a save at 49%.

**A7-24 (mark fields' keyboard has no "/"): CONFIRMED on the web.** Every calculator field is
`<input type="text" inputmode="decimal">` (`components/mark-calculator.tsx:123`, `:147`), measured
on the module card. HTML's `decimal` mode asks for "digits and the locale's decimal separator";
iOS shows a decimal pad with no "/" and no key to a full keyboard, while the hint and the error say
"a score, like 18/24" (`packages/content/src/en/module-card.ts:133-134`). Severity as filed (not
re-rated). Not tried on a real phone.

**A5-28** (Mmereko's frame refused after a click): not filed. With the frame answered by a local
stand-in page, no CSP console error appeared on `/cv` at either width.

## 3. Findings

| ID | Severity | Location | WCAG | Finding | Why it matters | Fix |
|---|---|---|---|---|---|---|
| A3-32 | Low | `apps/web/components/module-card.tsx:214-248` (`grid grid-cols-[auto_1fr]` contact and office lists) | 1.4.12, 1.4.10 | At 320 px with the text-spacing override the module card scrolls 27 px sideways: `dd "Room S-101 (made-up)"`, `dd "Tuesdays 10:00 to 12:00"` and `a "a.sample@example.org"` end at 347 px | A learner with wider spacing on a phone loses the right edge of the people to contact | `min-w-0` and `break-words` (`overflow-wrap: anywhere`) on the `dd`s, or stack the term over the value below `sm`; E2E at 320 with the override (as A3-26) |
| A3-33 | Low | `apps/web/app/(app)/goals/maps/[id]/plan-map-canvas.tsx:790-795` (`CanvasDialog` `onKeyDown` takes every Escape) | 3.2.2 (by analogy), 3.3.4 | In the full-screen canvas, Escape pressed while typing in a part's "My words" closes the whole dialog and the words typed are gone: the editor reopens empty on the page, focus on "Open the canvas" | Escape in a field usually cancels the field, not the screen; a keyboard learner loses what they wrote | Ignore Escape from inside a part's editor (let NodeEditor handle it as Cancel), or keep the draft in the parent; component test: Escape in the dialog's textarea leaves the dialog open, failing today |
| A3-34 | Low | `apps/web/app/colleges/registered/college-registered.tsx:54` (`aria-live="polite"` section) and `:111` (`Notice tone="danger"`, `role="alert"`) | 4.1.3, 2.4.3 | "Check" is a GET form: the answer arrives on a new page with focus at the top, inside a polite live region that also holds an alert with the same words | On a new page neither region reliably speaks, and where one does the answer can be read twice; a screen-reader learner must hunt for the result | After a check, move focus to the result's heading (or render it as the page's first `h2` with `tabIndex=-1` focused), and keep one region (the alert, or the polite one, not both) |
| A3-35 | Low | `apps/web/app/(app)/results/results-list.tsx:62-173` | 4.1.3 | Search, Type and Institution change the counts in every group heading ("Plan B (45)" → "(1)") silently: no live region on `/results` | A screen-reader learner doesn't hear that the list changed or how many courses are left | One polite status line under the filters ("45 courses shown") from `en.results`, announced on change |
| A3-36 | Low | `apps/web/app/(app)/cv/mmereko-canvas.tsx:84-89` | 2.1.1 (not a trap: Tab leaves) | With focus inside Mmereko's frame, Escape does nothing (a cross-origin frame's keys never reach the page); the learner must Tab to "Close" | The dialog says Esc closes it; inside the frame it doesn't | Say it in the bar ("Press Tab to reach Close") or put Close last in the Tab order after the frame; nothing can catch keys inside another origin |
| A3-37 | Low | `apps/web/app/(app)/goals/maps/[id]/plan-map-canvas.tsx:145-171` (one CSS scale on the whole world) | 2.5.8 | At "Fit to view" (49% on Thabo's map at 1280) every part's Edit and More is drawn about 36×21 px, and Save 37×21 px | Below 24 px on a mouse or touch screen; the learner chose the zoom, so this is a judgement call, not a clear failure | Keep part buttons at a minimum drawn size (counter-scale the controls, or hide them below ~70% and open a part on tap) |

## 4. Not measured

| Check | Why |
|---|---|
| NVDA and VoiceOver read-throughs (the suite asks for a transcript) | No screen reader automation in this run; live regions and names were read from the DOM |
| Real phone keyboards (A7-24) and TalkBack/VoiceOver on the native app | No device |
| Safari and Firefox (dialog focus order, `:has()`) | Chromium only |
| Contrast over the front door's people photos at every viewport height | The photos sit beside, not under, text; measured only over course, subject and offer pictures |
| The phone sign-up journey (#116) | Writes data; outside the browser brief's list beyond `/demo` |

## 5. Waived

None.

## 6. Remediation roadmap

**Quick wins (< 1 day):** A10-65 (move the care panel out of the canvas; the safety fix first),
A3-32 (`min-w-0` + wrap), A3-33 (Escape in a field stays in the field), A3-35 (one status line),
A3-36 (one sentence).
**Medium:** A3-34 (focus the result after a check), A3-37 (minimum drawn size for part controls),
A7-24 (a keyboard that has "/": `inputmode="text"` with a pattern hint, or two number fields
"score" and "out of").

## 7. What's genuinely good

- **axe is clean everywhere**, including opened and error states, and every focus stop on 38 page
  states has a visible ring that no sticky bar covers.
- **The calculator's error handling is model**: an invalid mark sets `aria-invalid`, its error is
  joined to the hint through `aria-describedby`, nothing is worked out until it's fixed, and the
  outcome is one polite atomic summary.
- **The crisis card takes focus on its heading** wherever it appears (page, canvas, dialog); only its
  scale inside the canvas is wrong (A10-65).
- **The canvas is fully keyboard-operable**: a labelled, focusable region (2 px light-blue ring,
  `outline-offset -2px`), arrows pan, + / − zoom, 0 fits; Tab into a part pans it into view; the
  map's DOM is the reading-order list in both views.
- **Both dialogs use native `showModal()`**: the page behind is inert, focus moves in (Close / the
  map) and back to the opener on close, and the page doesn't scroll behind.
- **Pictures are decorative and quiet**: `alt=""`, forced colours drop them, the text scrims hold
  8.49:1 or better, and nothing in them moves.
- **Reduced motion**: 0 running animations on every page, and the canvas's glide and coast become
  jumps.

## Rows for status.md → Open findings

```
| A3-32 | A3 | Low | apps/web/components/module-card.tsx:214-248 | At 320px with 1.4.12 text spacing the module card's contact lists scroll 27px sideways | Open | min-w-0 + overflow-wrap on the dd, or stack below sm; E2E at 320 with the override |
| A3-33 | A3 | Low | apps/web/app/(app)/goals/maps/[id]/plan-map-canvas.tsx:790-795 | Escape while typing in a part in the full-screen canvas closes the dialog and drops the typed words | Open | Escape in a field cancels the field only; a component test |
| A3-34 | A3 | Low | apps/web/app/colleges/registered/college-registered.tsx:54, :111 | After "Check" (a GET form) focus is at the top and the answer sits in a polite region holding an alert with the same words (4.1.3, 2.4.3) | Open | Focus the result heading; one region, not two |
| A3-35 | A3 | Low | apps/web/app/(app)/results/results-list.tsx:62-173 | The Search/Type/Institution filters change group counts with no announcement (4.1.3) | Open | One polite "N courses shown" status line |
| A3-36 | A3 | Low | apps/web/app/(app)/cv/mmereko-canvas.tsx:84-89 | Inside Mmereko's frame Escape can't close the dialog (cross-origin); the learner must Tab to Close | Open | Say so in the bar, or Close after the frame in Tab order |
| A3-37 | A3 | Low | apps/web/app/(app)/goals/maps/[id]/plan-map-canvas.tsx:145-171 | At fit zoom (49%) part buttons are drawn ~36×21px (2.5.8, judgement call) | Open | A minimum drawn size for part controls |
```

Known rows to update (not new): **A10-65 confirmed** (recommend High; evidence in §2); **A7-24
confirmed on the web** (`inputmode="decimal"`).

Audit ledger row (for the integrator): `| 6 (wave 10) | **A3** Accessibility | 0 | 0 | 0 | 6 | — | 2026-10-25 | axe 0 on 70 page states; A10-65 and A7-24 confirmed |`
