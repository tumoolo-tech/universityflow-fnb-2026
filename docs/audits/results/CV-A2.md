# My CV with Mmereko: A2 Accessibility (WCAG 2.2 AA)

**Project:** UniversityFlow · **Step:** S1 session 7, wave 3 (agent cva11) · **Date:** 2026-10-23
**Commit audited:** 092163c (main, #85 merged); fixes on `phase-6/cv-audit-a11-a2`
**Audit source:** tumoOLO_Audits A2 (design fidelity against the tokens) with the WCAG 2.2 AA checks
the brief lists, as S1-A2-profile did; [docs/design/mmereko-api-proposal.md](../../design/mmereko-api-proposal.md) §10.5
**Result:** 0 Critical · 0 High · 5 Medium · 5 Low (A2-43 to A2-52) · several checks not measured (§ Not verified)
**After fixes:** 4 Medium and 3 Low fixed test-first; 1 Medium and 2 Low open, none blocking.

## Scope

Web `/cv`: `apps/web/app/(app)/cv/{page,cv-view,cv-selection,cv-entries,cv-documents}.tsx`, the
`cv-ui` block of `apps/web/app/globals.css`, the shared `components/ui.tsx` they use. App:
`apps/native/app/cv.tsx` and `components/ui.tsx`. Words: `packages/content/src/en/cv.ts`.

**Evidence:** code and the CSS cascade only, plus component tests (web: vitest + Testing Library;
app: jest-expo + RNTL v14, awaited). No browser, Playwright, axe run or device in this session (the
rules): the integrator walks `/cv` after merge (UF_CV is refused on the demo).

## Executive summary

The page is well built in its structure: one `h1`, a titled `section` per card (`h2`), `h3`s in the
preview; every field has a visible `<label>` (Field) and ticks are grouped in `fieldset`/`legend`
with where they come from; one live status line (`role="status"`) for outcomes; `aria-disabled`
rather than `disabled` keeps focus (A3-01); every target is `min-h-11` (44px) on the web and
`theme.target` in the app; colours are tokens only, and the ATS bar is a `<meter>` with its number
in words beside it and the missing keywords as a list (never colour alone); the only motion has a
reduced-motion path; the app's controls carry roles, labels and states (checkbox `checked`,
button `disabled`/`busy`, radiogroup, headers).

What was wrong, in the order a learner meets it:

1. **A2-43 (Medium, fixed, web and app):** every refusal (an ID number in an entry, a busy CV, a
   failed fitting) showed at the top of the page. On a 360px phone the learner pressing Save at
   the bottom of a long form saw nothing happen; only a screen reader heard it.
2. **A2-44 / A2-45 (Medium, fixed):** Add, Edit, Delete, Remove link and Switch off took their own
   button away and focus fell to `<body>` on the web; in the app, the screen reader stayed where
   it was when the preview opened below the list, and was dropped when a button went.
3. **A2-46 (Medium, fixed, web):** a long word or link the learner typed (an entry's name, an
   advert's title, a link in the CV text) didn't wrap: the page scrolled sideways at 320px.
4. **A2-47 (Medium, open):** the preview shows the CV as raw Markdown (`# Name`, `## Education`,
   `- …`), so its headings aren't headings and a screen reader reads "number sign".

## Findings

| ID | Severity | Where | Finding | Status |
|---|---|---|---|---|
| A2-43 | Medium | web cv-view.tsx:120 (the page Notice); app cv.tsx:218 | A refused save or press showed its error only at the top of the page, far from the control on a phone; sighted keyboard and touch users saw nothing (3.3.1, 3.3.3) | Fixed |
| A2-44 | Medium | web cv-entries.tsx:129-137, 170, 414-419; cv-documents.tsx:335-343 | Add, Edit, "Delete …", "Remove link n" and "Switch off" unmounted their own button: focus fell to `<body>` (2.4.3, the A3-01 pattern) | Fixed |
| A2-45 | Medium | app cv.tsx (preview, entries, withdraw, sharing) | The screen reader wasn't moved to the preview when it opened below the list, nor back to Open when it closed; Delete, Keep it, Add, Cancel, Stop using Mmereko, Every line is true and Switch off dropped it (2.4.3, the A2-36 pattern) | Fixed |
| A2-46 | Medium | web globals.css (no `overflow-wrap` for the page) | The learner's own long words and links (entry names, advert titles, the CV text, organisations) didn't wrap: sideways scroll at 320-360px (1.4.10) | Fixed |
| A2-47 | Medium | web cv-documents.tsx:179; app cv.tsx (preview `Text`) | The preview prints the CV's Markdown as it is: `#`/`##` lines aren't headings and `-` lines aren't a list (1.3.1); screen readers read the marks ("number sign number sign Education") | Open |
| A2-48 | Low | web cv-view.tsx MakeCard, TailorCard | Make my CV and Fit my CV, `aria-disabled` before a CV can be made or while one is being made, did nothing at all when pressed | Fixed |
| A2-49 | Low | web globals.css `.uf-cv-progress span` | The progress dots pulsed `infinite` beside "Being made" for the minute or two a CV takes, with no way to stop them except reduced motion (2.2.2) | Fixed |
| A2-50 | Low | app cv.tsx OptInCard | The share box's hint was its `accessibilityHint` and also the text under it: read twice | Fixed |
| A2-51 | Low | web `StatusLine`; app `useAnnounce` | The same outcome twice in a row (Save, then Save again) isn't announced the second time: the status text doesn't change (4.1.3). App-wide pattern | Open |
| A2-52 | Low | web cv-entries.tsx, cv-selection.tsx | A refusal names the problem ("That looks like an ID or student number") but not the field: the routes don't say which field, so no field gets `aria-invalid` or the message (3.3.1) | Open |

### Fixes, with how each test was proven to fail first

| Finding | Fix | Test (red first) |
|---|---|---|
| A2-43 web | `kit.fail(error, at)`: the error shows once, in the card or the open form whose press it answers (`CvError`, a `role="alert"` Notice beside Save); the page's top only for errors that belong to no card; a cancelled form lets go of its error | cv-page.test.tsx "shows a refused entry inside its form…", "shows a refused selection, a refused fitting and a refused CV in their own cards…" (red: `Unable to find role="alert"` in the form/card) |
| A2-43 app | The same: each card renders its own error (`CardError`, Notice announces it on both platforms); the first read's error stays on top | cv.test.tsx "shows a refused save in its own card…" (red: `Unable to find an element with testID: cv-what`) |
| A2-44 | `focusAfter` to: the form's first field on Add and Edit; the "Delete …?" question (`tabIndex=-1`); "Add a link" after Remove link; the sharing heading (`tabIndex=-1`) after Switch off | cv-page.test.tsx "keeps focus when Add, Edit and Delete…", "…a link is removed…", "…a share link is switched off" (red: `expected <body> to be <select…>`, `<body>` to be `<button>`, `<h2>` to be `<h3>`) |
| A2-45 | `useFocusLater` + `focusOn` (A2-36's pattern); `Heading`, `Body`, `SectionTitle` and `RadioGroup` take a `ref`; `focusOn` takes a Text | cv.test.tsx "moves the screen reader to the preview…", "…when Delete, Add and Stop using Mmereko take their button away" (red: `sendAccessibilityEvent` called 0 times) |
| A2-46 | `.uf-cv { overflow-wrap: anywhere }` on the page's root, in the `cv-ui` block (as `.uf-privacy`) | cv-page.test.tsx "wraps long words and links at 320px…" (red: root had no `uf-cv`) |
| A2-48 | `notYet()`: says `make.waiting` or `errors['cv-incomplete']` in the status line | cv-page.test.tsx "says why Make my CV and Fit it to a job do nothing yet…" (red: status `''`) |
| A2-49 | `animation-iteration-count: 4` (1.2 s a cycle: stops at 4.8 s); reduced motion still removes them | cv-page.test.tsx "stops the progress dots within five seconds" (red: matched `infinite`) |
| A2-50 | The `hint` prop dropped; the visible line under the box is read in turn | cv.test.tsx "reads the sharing hint once…" (red: `accessibilityHint` was the hint) |

### Open

- **A2-47:** render the CV text as structure, text only (no HTML is ever injected): `#` → `h3`,
  `##` → `h4`, `- ` lines → a list, the rest paragraphs; in the app, `Heading level 3` and bullet
  lines. Best done once Mmereko's real template is fixed in the contract fixtures (§3, §7.4), so
  the renderer matches what Mmereko sends, not only the stand-in's `renderCvMarkdown`.
- **A2-51:** a status line that clears and re-sets the same text (or a counter in a key) on the web,
  and `announce()` called per outcome rather than per text change in the app; repo-wide, so its own
  change.
- **A2-52:** the routes return the field path with the reason (`{ detail: 'personal-number', field:
  'description' }`), never the value; the forms put the message in that `Field`'s `error` (which
  already sets `aria-invalid` and `aria-describedby`, A3-14).

## Checks that passed (no finding)

| Check | Evidence |
|---|---|
| Labels | Every input through `Field` (visible `<label htmlFor>`); ticks are `<label>` wrapping the box; app `Field` and `Checkbox` labels; share link field labelled, read-only |
| Headings | `h1` (Page), `h2` per card and the preview, `h3` in the preview (gaps, score, check, sharing); app `Heading`/`SectionTitle` are headers |
| Groups | `fieldset`/`legend` for each tick group and for the links; app `RadioGroup` for the kind and the link's length |
| Names that repeat | "Open My CV, (date)", "Download PDF: …", "Switch off the link that works until …", "Edit/Delete (title)": each starts with the visible text (2.5.3) |
| Status announcements | One `role="status"` line on the web; `useAnnounce` in the app; Notice `danger` is `role="alert"` and announced on iOS too |
| Target sizes | Web buttons, inputs and tick labels `min-h-11` (44px, above 2.5.8's 24px); app `theme.target` on buttons, fields, ticks, radios |
| Contrast | Tokens only; `inkMuted` on `surfaceSunk`, `brand` on `surfaceSunk` (the meter's fill), `lineStrong` on `surface` (its track) are tested pairs in `packages/tokens` |
| Colour alone | Status words, the ATS number in words, missing keywords as a list |
| Reduced motion | The dots are `display: none` under `prefers-reduced-motion`; `--uf-duration-enter` is 0ms there; the app has no motion |
| Focus kept while busy | `aria-disabled` (not `disabled`) on every web button that waits |
| Focus after the existing flows | Opt in → "What goes on my CV"; preview opens → its title; confirm → the line that replaces the button; stop → the opt-in card's title (already tested) |

## Not verified

- A browser walk of `/cv` at 320, 360 and 1280px, at 200% zoom and with 1.4.12 text spacing; axe on
  a production build; the focus ring's visibility on each control (the integrator, after merge).
- VoiceOver and TalkBack on a device: whether `sendAccessibilityEvent(…, 'focus')` lands on a Text
  header on both platforms, as it does for a Pressable (A2-36 was checked on a Pressable).
- The PDF Mmereko makes: tagged, with a language and a reading order (headless Chrome tags its
  PDFs; the stand-in's tiny PDF is not representative). For Mmereko's build list (§12 item 7).
